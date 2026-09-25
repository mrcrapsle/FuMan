#!/usr/bin/env python3
"""
Baut aus der modularen Struktur (index.html + css/styles.css + js/*.js) eine einzelne
standalone HTML-Datei, die überall (auch als lokale Datei auf Android) läuft.
"""
import re

HTML_FILE = "index.html"
CSS_FILE = "css/styles.css"
OUTPUT_FILE = "dist/anstoss-fm13-standalone.html"

JS_ORDER = [
    "js/audio.js",
    "js/utils.js",
    "js/i18n.js",
    "js/state.js",
    "js/inbox.js",
    "js/entities.js",
    "js/avatars.js",
    "js/playerdetail.js",
    "js/squad.js",
    "js/squadplanning.js",
    "js/secondteam.js",
    "js/career.js",
    "js/crest.js",
    "js/leagues.js",
    "js/cup.js",
    "js/landescup.js",
    "js/europe.js",
    "js/transfermarket.js",
    "js/manager-rpg.js",
    "js/scouting.js",
    "js/commodities.js",
    "js/merchandise.js",
    "js/office.js",
    "js/office-events.js",
    "js/ui-core.js",
    "js/render-dashboard.js",
    "js/industry.js",
    "js/holding.js",
    "js/calendar.js",
    "js/training.js",
    "js/training-games.js",
    "js/finances.js",
    "js/ffp.js",
    "js/stocks.js",
    "js/sponsors.js",
    "js/media-rights.js",
    "js/betting.js",
    "js/stadium.js",
    "js/real-estate.js",
    "js/campus-staff.js",
    "js/fans.js",
    "js/youth.js",
    "js/bonusclauses.js",
    "js/contracts.js",
    "js/private-life.js",
    "js/underworld.js",
    "js/history.js",
    "js/achievements.js",
    "js/weather.js",
    "js/match.js",
    "js/contract-ultimatum.js",
    "js/season-end.js",
    "js/admin.js",
    "js/premium.js",
    "js/save.js",
]


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
    content = "\n".join(read(p) for p in JS_ORDER) + "\n" + "\n".join(inline_scripts)
    import os
    os.makedirs("dist", exist_ok=True)
    with open("dist/lint-bundle.js", "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fertig: dist/lint-bundle.js ({len(content)} Zeichen)")


def build():
    html = read(HTML_FILE)

    # 1. CSS einbetten
    css_content = read(CSS_FILE)
    html = re.sub(
        r'<link rel="stylesheet" href="css/styles\.css">',
        f"<style>\n{css_content}\n</style>",
        html,
    )

    # 2. Jedes <script src="js/XYZ.js"></script> durch den echten Inhalt ersetzen
    for js_path in JS_ORDER:
        js_content = read(js_path)
        tag = f'<script src="{js_path}"></script>'
        if tag not in html:
            print(f"WARNUNG: Tag für {js_path} nicht gefunden, wird übersprungen.")
            continue
        html = html.replace(tag, f"<script>\n{js_content}\n</script>")

    import os
    os.makedirs("dist", exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Fertig: {OUTPUT_FILE} ({len(html)} Zeichen)")


if __name__ == "__main__":
    import sys
    if "--lint-bundle" in sys.argv:
        build_lint_bundle()
    else:
        build()
