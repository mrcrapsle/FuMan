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

## Sprache (DE/EN)

Wörterbuch-basierter Sprachumschalter in `js/i18n.js` (Funktion `t(key)`,
Umschaltknopf 🌐 DE/EN im Header). Deutsch ist die Quelle der Wahrheit -
fehlt ein Übersetzungs-Key für Englisch, fällt `t()` automatisch auf den
deutschen Text zurück statt auf einen leeren/kaputten String.

**Aktueller Umfang:** Header, Seitenmenü und Tutorial sind vollständig
übersetzt. Die riesige Menge an Bildschirm-Inhalten (Kader, Transfermarkt,
Finanzen, Stadion, ...) folgt schrittweise in weiteren Ausbaustufen und
bleibt bis dahin auch bei gewählter Sprache "Englisch" auf Deutsch (dank
des Fallbacks kein Fehler, nur noch nicht übersetzter Text).
