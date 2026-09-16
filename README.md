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

## Managerbüro (Startbildschirm)

`js/office.js` + der CSS-Block "MANAGERBÜRO" in `css/styles.css` bauen den
Point-and-Click-Startbildschirm: eine begehbare Bürokulisse aus fünf
CSS-3D-Ebenen mit zehn anklickbaren Objekten, die in die jeweiligen
Spielbereiche führen. Das Büro liegt als Vollbild-Ebene (`position:fixed`,
z-index 940) über der übrigen Oberfläche und ist über den Knopf oben im
Dashboard jederzeit wieder erreichbar; zurück geht es über "Zum Dashboard"
in der Leiste oben rechts.

Die Szene wird immer für eine feste Logikgröße (900x560) komponiert und als
Ganzes skaliert - sonst fiele auf schmalen Geräten der komplette
Seitenwand-Bereich (Tür, Taktiktafel, Tresor, Aktenschrank) aus dem
Sichtkegel. Bleibt dabei viel Platz über/unter der Kulisse (Hochformat),
erscheint darunter automatisch eine beschriftete Schnellauswahl derselben
Ziele, weil die Objekte dort klein zum Antippen sind.

Bewusst **kein Three.js/WebGL** - das Spiel muss eine einzige, offline
lauffähige HTML-Datei bleiben; eine 3D-Bibliothek wären ~600 KB Fremdcode
plus WebGL-Zwang im Android-WebView. Dieselbe CSS-3D-Technik nutzen
Taktiktafel und Stadionschüssel bereits.

**Fallstricke bei Änderungen an dieser Ansicht** (beide haben hier real
zugeschlagen und sind von außen unsichtbar - das Bild bleibt korrekt, nur
die Trefferflächen wandern weg, Objekte sind dann lautlos nicht mehr
anklickbar):

1. `filter` und `opacity` sind "grouping properties": auf einer
   3D-positionierten Ebene erzwingen sie `transform-style: flat` und
   klappen sie in die Elternebene. Zum Abdunkeln/Hervorheben deshalb
   Hintergrundschichten bzw. `box-shadow` verwenden.
2. Laufende `transform`-Animationen befördern das Element auf eine eigene
   Compositing-Ebene und nehmen es aus der Trefferprüfung. Animationen im
   Raum daher ohne `transform` (z.B. pulsendes `box-shadow`).

`testManagerOffice` in `tests/run-tests.js` prüft genau das ab: jeder
Hotspot muss an seinem eigenen Mittelpunkt auch sich selbst treffen.

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
