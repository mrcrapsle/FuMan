#!/usr/bin/env python3
"""
Baut aus der modularen Struktur (index.html + css/styles.css + js/*.js) eine einzelne
standalone HTML-Datei, die überall (auch als lokale Datei auf Android) läuft.
"""
import os
import re
import sys

HTML_FILE = "index.html"
CSS_FILE = "css/styles.css"
OUTPUT_FILE = "dist/anstoss-fm13-standalone.html"

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
    verwaist = sorted(f"js/{f}" for f in os.listdir("js") if f.endswith(".js") and f"js/{f}" not in order)
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


def build():
    html = read(HTML_FILE)

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
        js_content = read(js_path)
        match = re.search(rf'<script src="{re.escape(js_path)}(\?[^"]*)?"></script>', html)
        html = html.replace(match.group(0), f"<script>\n{js_content}\n</script>", 1)
    leftover = SCRIPT_TAG_RE.findall(html)
    if leftover:
        sys.exit(f"FEHLER: nicht eingebettete Script-Tags im Build: {leftover}")

    os.makedirs("dist", exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Fertig: {OUTPUT_FILE} ({len(html)} Zeichen)")


if __name__ == "__main__":
    if "--lint-bundle" in sys.argv:
        build_lint_bundle()
    else:
        build()
