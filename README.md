# Anstoß Mobile Pro - FM13

Modulare Quellcode-Struktur: `index.html` + `css/styles.css` + `js/*.js`.

## Bauen
python3 build.py
→ erzeugt dist/anstoss-fm13-standalone.html

## Testen
python3 build.py
cd tests
npm install
npm test
→ prüft die gebaute dist/anstoss-fm13-standalone.html per Playwright gegen
die Testsuite in `tests/run-tests.js`.

## Linten
npm install
npm run lint
→ lintet alle js/*.js-Module + die inline <script>-Blöcke aus index.html
als EIN zusammengefügter globaler Scope (siehe build.py --lint-bundle),
damit ESLint keine falschen "undefined"-Meldungen für Funktionen aus
anderen Dateien wirft.

## Minifizieren (optional)
python3 build.py
npm install
npm run minify
→ erzeugt zusätzlich dist/anstoss-fm13-standalone.min.html (~30% kleiner) -
praktisch zum Weitergeben/Teilen. Die normale, lesbare Datei bleibt für
Entwicklung/Tests unverändert bestehen. mangle ist bewusst deaktiviert, da
Buttons ihre Funktionen über onclick="..." als HTML-String aufrufen, den ein
Minifizierer nicht sieht.
