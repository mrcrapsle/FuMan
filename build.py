#!/usr/bin/env python3
"""
Baut aus der modularen Struktur (index.html + css/styles.css + js/*.js) eine einzelne
standalone HTML-Datei, die überall (auch als lokale Datei auf Android) läuft.
"""
import os
import re
import sys

import hashlib

HTML_FILE = "index.html"
CSS_FILE = "css/styles.css"
OUTPUT_FILE = "dist/anstoss-fm13-standalone.html"          # Entwickler-Fassung (mit Admin-Menü): Tests, Bots, lokal
OEFFENTLICH_FILE = "dist/anstoss-fm13-oeffentlich.html"    # öffentliche Fassung (ohne Admin-Menü): GitHub Pages
GRUNDSPIEL_FILE = "dist/anstoss-fm13-grundspiel.html"      # Ausbaustufe 0 ohne Admin: Test der Grundfassung (testGrundfassung)

# Grundfassung mit großen Updates: Stufe n enthält die ersten n Pakete. Ein Paket bringt eigene Module und
# alles zwischen <!-- PAKET-START:name --> und <!-- PAKET-ENDE:name --> in index.html; Blöcke zwischen
# <!-- OHNE-PAKET-START:name --> und <!-- OHNE-PAKET-ENDE:name --> stehen nur in Fassungen ohne das Paket.
# Die zweite Mannschaft bleibt als Code (js/secondteam.js enthält auch die Leihen), dort fallen nur Menü
# und Bildschirm weg. Ein Update = OEFFENTLICHE_STUFE erhöhen und mergen.
PAKETE = [
    ("vereinswachstum", {"js/women-team.js"}, ['id="screen-second-team"', 'id="screen-women"', 'id="stadium-upgrades-grid"', 'id="capacity-projects-grid"', "function foundWomenTeam"]),
    ("finanzwelt", {"js/stocks.js", "js/betting.js", "js/real-estate.js"}, ['id="screen-stocks"', 'id="screen-betting"', 'id="screen-real-estate"', "function placeBet", "function buyStockShares", "function buyOrUpgradeRealEstate"]),
    ("konzern", {"js/holding.js", "js/industry.js"}, ['id="screen-holding"', 'id="screen-industry"', 'id="top-holding-money"', "function buyFactory", "function transferClubToHolding"]),
]
VOLLE_STUFE = len(PAKETE)
OEFFENTLICHE_STUFE = VOLLE_STUFE   # öffentliche Seite und Download: heute alle Updates
PAKETE_PLATZHALTER = "let SPIEL_PAKETE = ['vereinswachstum', 'finanzwelt', 'konzern'];"

# Öffentliche Fassung (Phase 26.20): ohne diese Module und ohne die Blöcke zwischen den NUR-ENTWICKLER-Markern in index.html
ENTWICKLER_MODULE = {"js/admin.js", "js/admin-tools.js"}
NUR_ENTWICKLER_RE = re.compile(r"[ \t]*<!-- NUR-ENTWICKLER-START.*?-->.*?<!-- NUR-ENTWICKLER-ENDE -->[ \t]*\n?", re.DOTALL)
# Nichts davon darf in der öffentlichen Fassung stehen, sonst bricht der Build ab
ADMIN_KENNZEICHEN = ['id="screen-admin"', "adminAddClubMoney", "renderAdminTools", "adminGrantPremiumPoints", "adminPinHash", "NUR-ENTWICKLER"]
# PIN der Entwickler-Seite: build.py setzt den SHA-256-Wert von PIN_PREFIX + DEV_PIN in js/admin.js ein (siehe adminZugangFrei)
PIN_PREFIX = "anstoss-fm13:"
PIN_PLATZHALTER = "let adminPinHash = '';"

# Module, die per Lazy Loading bei Bedarf geladen werden (kein Eintrag in index.html nötig)
LAZY_LOADED_MODULES = set()

SCRIPT_TAG_RE = re.compile(r'<script src="(js/[^"?]+\.js)(\?[^"]*)?"></script>')


def js_order():
    """Reihenfolge und Umfang der Module kommen ausschließlich aus den <script src>-Tags
    in index.html - eine zweite, handgepflegte Liste lief früher unbemerkt auseinander,
    sodass neue Module im Standalone-Build fehlten."""
    order = [path for path, _ in SCRIPT_TAG_RE.findall(read(HTML_FILE))]
    doppelt = sorted({p for p in order if order.count(p) > 1})
    if doppelt:
        sys.exit(f"FEHLER: doppelte <script>-Tags in index.html (Modul liefe zweimal): {doppelt}")
    missing = [p for p in order if not os.path.isfile(p)]
    if missing:
        sys.exit(f"FEHLER: in index.html referenziert, aber nicht vorhanden: {missing}")
    verwaist = sorted(f"js/{f}" for f in os.listdir("js") if f.endswith(".js") and f"js/{f}" not in order and f"js/{f}" not in LAZY_LOADED_MODULES)
    if verwaist:
        sys.exit(f"FEHLER: Dateien in js/ ohne <script>-Tag in index.html (würden nie geladen): {verwaist}")
    return order


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def build_lint_bundle():
    """Reine Aneinanderreihung aller js/*.js-Dateien PLUS der inline <script>-Blöcke aus
    index.html (kein HTML/CSS) für ESLint - alle Module UND die inline Boot-Logik
    (safeLocalGet() & Co., window.onload) teilen sich zur Laufzeit denselben globalen
    Scope (siehe build()), einzeln gelintet würde jede Datei fälschlich 'undefined' für
    jede Funktion aus einer anderen Datei/dem inline Skript melden. Zusammengefügt sieht
    ESLint den echten globalen Scope und meldet nur noch tatsächliche Tippfehler/
    undefinierte Referenzen."""
    html = read(HTML_FILE)
    inline_scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
    content = "\n/* eslint-enable */\n".join(read(p) for p in js_order()) + "\n/* eslint-enable */" + "\n" + "\n".join(inline_scripts)
    os.makedirs("dist", exist_ok=True)
    with open("dist/lint-bundle.js", "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fertig: dist/lint-bundle.js ({len(content)} Zeichen)")


def paket_bloecke(html, stufe):
    """Entfernt die Seitenteile fehlender Pakete und die Ersatzteile vorhandener."""
    for i, (name, _, _) in enumerate(PAKETE):
        for art in ("PAKET", "OHNE-PAKET"):
            if html.count(f"<!-- {art}-START:{name} -->") != html.count(f"<!-- {art}-ENDE:{name} -->"):
                sys.exit(f"FEHLER: {art}-START und -ENDE für {name} in index.html passen nicht zusammen")
        weg = "PAKET" if i >= stufe else "OHNE-PAKET"
        html = re.sub(rf"[ \t]*<!-- {weg}-START:{name} -->.*?<!-- {weg}-ENDE:{name} -->[ \t]*\n?", "", html, flags=re.DOTALL)
    # Markierungen der behaltenen Blöcke
    return re.sub(r"[ \t]*<!-- (?:OHNE-)?PAKET-(?:START|ENDE):[a-z]+ -->[ \t]*\n?", "", html)


def build_html(oeffentlich, stufe=VOLLE_STUFE):
    html = read(HTML_FILE)
    if html.count("<!-- NUR-ENTWICKLER-START") != html.count("<!-- NUR-ENTWICKLER-ENDE -->"):
        sys.exit("FEHLER: NUR-ENTWICKLER-START und -ENDE in index.html passen nicht zusammen")
    html = paket_bloecke(html, stufe)
    paket_module = set().union(*(m for _, m, _ in PAKETE[stufe:])) if stufe < VOLLE_STUFE else set()
    for modul in paket_module:
        html = re.sub(rf'<script src="{re.escape(modul)}(\?[^"]*)?"></script>\n?', "", html)
    if oeffentlich:
        html = NUR_ENTWICKLER_RE.sub("", html)
        for modul in ENTWICKLER_MODULE:
            html = re.sub(rf'<script src="{re.escape(modul)}(\?[^"]*)?"></script>\n?', "", html)
    else:
        html = html.replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow">', 1)

    # 1. CSS einbetten (mit optionalem Cache-Busting-Parameter wie ?v=2.1)
    css_content = read(CSS_FILE)
    html = re.sub(
        r'<link rel="stylesheet" href="css/styles\.css(\?[^"]*)?">',
        f"<style>\n{css_content}\n</style>",
        html,
    )

    # 2. Jedes <script src="js/XYZ.js"></script> durch den echten Inhalt ersetzen
    # (unterstützt auch Cache-Busting wie ?v=2.1)
    for js_path in js_order():
        if (oeffentlich and js_path in ENTWICKLER_MODULE) or js_path in paket_module:
            continue
        js_content = read(js_path)
        if js_path == "js/pakete.js":
            if PAKETE_PLATZHALTER not in js_content:
                sys.exit(f"FEHLER: {PAKETE_PLATZHALTER} fehlt in js/pakete.js")
            enthalten = ", ".join(f"'{name}'" for name, _, _ in PAKETE[:stufe])
            js_content = js_content.replace(PAKETE_PLATZHALTER, f"let SPIEL_PAKETE = [{enthalten}];", 1)
        if js_path == "js/admin.js" and os.environ.get("DEV_PIN"):
            if PIN_PLATZHALTER not in js_content:
                sys.exit(f"FEHLER: {PIN_PLATZHALTER} fehlt in js/admin.js")
            wert = hashlib.sha256((PIN_PREFIX + os.environ["DEV_PIN"]).encode("utf-8")).hexdigest()
            js_content = js_content.replace(PIN_PLATZHALTER, f"let adminPinHash = '{wert}';", 1)
        match = re.search(rf'<script src="{re.escape(js_path)}(\?[^"]*)?"></script>', html)
        html = html.replace(match.group(0), f"<script>\n{js_content}\n</script>", 1)
    leftover = SCRIPT_TAG_RE.findall(html)
    if leftover:
        sys.exit(f"FEHLER: nicht eingebettete Script-Tags im Build: {leftover}")

    if oeffentlich:
        rest = [k for k in ADMIN_KENNZEICHEN if k in html]
        if rest:
            sys.exit(f"FEHLER: öffentliche Fassung enthält noch Admin-Teile: {rest}")
    rest = [k for _, _, kennzeichen in PAKETE[stufe:] for k in kennzeichen if k in html]
    if rest:
        sys.exit(f"FEHLER: Fassung der Stufe {stufe} enthält noch Teile fehlender Pakete: {rest}")
    if "PAKET-START" in html or "PAKET-ENDE" in html:
        sys.exit("FEHLER: Paket-Markierungen im Build übrig")
    return html


def schreibe(pfad, html):
    os.makedirs(os.path.dirname(pfad) or ".", exist_ok=True)
    with open(pfad, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Fertig: {pfad} ({len(html)} Zeichen)")


def build():
    # --nur-dev: nur die Entwickler-Fassung, Ziel aus DEV_AUSGABE (Deploy der geheimen Entwickler-Seite)
    if "--nur-dev" in sys.argv:
        schreibe(os.environ.get("DEV_AUSGABE") or OUTPUT_FILE, build_html(False))
        return
    # --stufe N: zusätzlich eine öffentliche Fassung der Ausbaustufe N zur Ansicht (dist/anstoss-fm13-stufe-N.html)
    if "--stufe" in sys.argv:
        stufe = int(sys.argv[sys.argv.index("--stufe") + 1])
        schreibe(f"dist/anstoss-fm13-stufe-{stufe}.html", build_html(True, stufe))
        return
    schreibe(OUTPUT_FILE, build_html(False))
    schreibe(OEFFENTLICH_FILE, build_html(True, OEFFENTLICHE_STUFE))
    schreibe(GRUNDSPIEL_FILE, build_html(True, 0))


if __name__ == "__main__":
    if "--lint-bundle" in sys.argv:
        build_lint_bundle()
    else:
        build()
