#!/usr/bin/env python3
"""
Build-Skript für Anstoß Mobile Pro - FM13
Setzt aus den modularen Quelldateien (index.html + css/ + js/)
eine einzelne, in sich geschlossene HTML-Datei zusammen, die sich
auch per Dateimanager (content://-URI) auf dem Handy öffnen lässt.

Aufruf:  python3 build.py
Ausgabe: dist/anstoss-fm13-standalone.html
"""
import re
import os

SRC_HTML = "index.html"
OUT_DIR = "dist"
OUT_FILE = os.path.join(OUT_DIR, "anstoss-fm13-standalone.html")

# Reihenfolge der JS-Module ist wichtig (Ladereihenfolge wie im Original)
JS_ORDER = [
    "js/audio.js",
    "js/utils.js",
    "js/state.js",
    "js/inbox.js",
    "js/entities.js",
    "js/playerdetail.js",
    "js/squad.js",
    "js/secondteam.js",
    "js/career.js",
    "js/crest.js",
    "js/leagues.js",
    "js/cup.js",
    "js/europe.js",
    "js/transfermarket.js",
    "js/manager-rpg.js",
    "js/scouting.js",
    "js/commodities.js",
    "js/merchandise.js",
    "js/ui-core.js",
    "js/render-dashboard.js",
    "js/industry.js",
    "js/holding.js",
    "js/calendar.js",
    "js/training.js",
    "js/training-games.js",
    "js/finances.js",
    "js/stocks.js",
    "js/sponsors.js",
    "js/media-rights.js",
    "js/betting.js",
    "js/stadium.js",
    "js/real-estate.js",
    "js/campus-staff.js",
    "js/fans.js",
    "js/youth.js",
    "js/contracts.js",
    "js/private-life.js",
    "js/underworld.js",
    "js/history.js",
    "js/match.js",
    "js/admin.js",
    "js/save.js",
]

CSS_FILE = "css/styles.css"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def main():
    html = read(SRC_HTML)

    # 1. <link rel="stylesheet" href="css/styles.css"> durch <style>...</style> ersetzen
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

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Fertig: {OUT_FILE} ({len(html)} Zeichen)")


if __name__ == "__main__":
    main()
