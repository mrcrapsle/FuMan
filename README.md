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
