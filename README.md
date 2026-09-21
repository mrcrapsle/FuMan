# Anstoß Mobile Pro - FM13

Modulare Quellcode-Struktur: `index.html` + `css/styles.css` + `js/*.js`.

## Spielen

**Online:** https://mrcrapsle.github.io/FuMan/ — wird bei jedem Push auf `main`
automatisch neu gebaut und veröffentlicht (siehe `deploy`-Job in
`.github/workflows/build-test.yml`), aber nur wenn die Testsuite auf demselben
Commit grün war. Läuft auf jedem Gerät, Spielstände werden im Browser gespeichert.

**Offline:** `dist/anstoss-fm13-standalone.html` ist das komplette Spiel in einer
Datei. Auf Android in einem echten Browser öffnen (Chrome), nicht in der
Dateivorschau des Dateimanagers - die blockiert den lokalen Speicher.

## Bauen
python3 build.py
→ erzeugt dist/anstoss-fm13-standalone.html

## Lokal spielen/entwickeln (empfohlen)
npm run serve            # oder: python3 server.py
→ baut dist/ und startet einen lokalen Server auf Port 8000. Ausgegeben wird
auch die Adresse im lokalen Netz - damit lässt sich das Spiel direkt auf dem
Handy im Browser öffnen, ohne die HTML-Datei zu kopieren.

Das ist nicht nur bequemer: über `file://` blockieren manche Android-WebViews
den Zugriff auf localStorage komplett (genau daran scheiterte das Speichern in
der Dateivorschau, siehe `safeLocalSet()` in index.html). Über `http://` tritt
das Problem nicht auf.

Erreichbar sind:
- `/` — die modulare Fassung (index.html + css/ + js/), Änderungen sind nach
  einem Reload sofort sichtbar
- `/spiel` — die gebaute Standalone-Datei; sie wird automatisch neu gebaut,
  sobald eine Quelldatei neuer ist als das Build-Ergebnis

Optionen: `--port 5000` für einen anderen Port, `--no-build` zum Starten ohne
Neubau.

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
CSS-3D-Ebenen mit elf anklickbaren Objekten, die in die jeweiligen
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

**Der Raum spiegelt den Spielstand.** Der Blick aus dem Fenster wird von
`getOfficeOutlook()` aus echtem Zustand abgeleitet: Steht ein Heimspiel oder ein
Pokal-/Europapokaltermin an UND ist eine Flutlichtanlage gebaut
(`stadium.flutlicht`), brennt draußen das Flutlicht und es ist Abend - ohne
Anlage wird bei Tageslicht gespielt, der Ausbau verändert also sichtbar die
Kulisse. Dazu kommt das aktuelle Wetter aus `js/weather.js` (Regen, Schnee,
Sturm, Hitze). Das gerahmte Vereinswappen an der Wand nutzt exakt dieselben
Daten wie das Header-Logo (`applyClubCrest()` in `crest.js`) samt Muster-Badge,
Maskottchen und Sponsorenring.

Bewusst **kein Three.js/WebGL** - das Spiel muss eine einzige, offline
lauffähige HTML-Datei bleiben; eine 3D-Bibliothek wären ~600 KB Fremdcode
plus WebGL-Zwang im Android-WebView. Dieselbe CSS-3D-Technik nutzen
Taktiktafel und Stadionschüssel bereits.

**Klicks lösen sich NICHT über die native Trefferprüfung des Browsers auf.**
`officeHotspotAtPoint()` vergleicht stattdessen selbst die projizierten
Bildschirmrechtecke (`getBoundingClientRect()`), und ein einzelner
Click-/Mousemove-Handler am Viewport verteilt daraus Klick, Hervorhebung und
Satzzeile. Grund: für 3D-transformierte Elemente ist die native Hit-Detection
je nach Chromium-Version unzuverlässig - in einer neueren Version waren 9 von
10 damaligen Objekten nicht mehr anklickbar, obwohl das Bild unverändert aussah
(in der CI aufgefallen, lokal nicht reproduzierbar). Deshalb auch kein
CSS-`:hover` für die Hervorhebung, sondern eine aus JS gesetzte Klasse.

**Zwei weitere Fallstricke**, die hier real zugeschlagen haben und von außen
unsichtbar sind (das Bild bleibt korrekt, nur die Geometrie wandert weg):

1. `filter` und `opacity` sind "grouping properties": auf einer
   3D-positionierten Ebene erzwingen sie `transform-style: flat` und
   klappen sie in die Elternebene. Zum Abdunkeln/Hervorheben deshalb
   Hintergrundschichten bzw. `box-shadow` verwenden.
2. Laufende `transform`-Animationen befördern das Element auf eine eigene
   Compositing-Ebene. Animationen im Raum daher ohne `transform`
   (z.B. pulsendes `box-shadow`).

`testManagerOffice` in `tests/run-tests.js` prüft, dass jeder Hotspot an
seinem Mittelpunkt korrekt aufgelöst wird, und klickt per Koordinate
(`mouse.click`) statt per Selektor - `page.click(selektor)` prüft intern
ebenfalls die native Trefferfläche.

## Sponsoren & Finanzen

**Bandenwerbung** hängt an den echten Stadionbereichen (`stadium.blocks`): jeder
Block hat eigene Bandenplätze, deren Anzahl mit seiner Kapazität wächst - jeder
Stadionausbau schafft also zusätzliche Werbeflächen. Was eine Bande einbringt,
ergibt sich aus Ligastufe x Sichtbarkeit des Bereichs (`BANDEN_AREA_META` in
`js/sponsors.js` - Haupttribüne und Gegengerade liegen im Kameraschwenk, die
Presse-Tribüne im Rücken der Interviews, VIP-Logen erreichen zahlungskräftiges
Publikum) x Größe des Blocks. Banden aus älteren Spielständen ohne
Bereichszuordnung werden beim Laden automatisch auf freie Plätze verteilt.

**Steuern**: Auf jede Spieltagseinnahme (Tickets, Fanartikel, Sponsoren) wird
eine Abgabe fällig (12%, mit Steuerberater 7%, siehe `getTaxRate()` in
`js/finances.js`, verbucht in `applyMatchdayFinances`). Der Steuerberater kostet
dafür ein laufendes Honorar, das mit der Ligastufe steigt - unten trägt er sich
gerade so, oben lohnt er sich deutlich. Zusätzlich mildert er die
Insolvenz-Eskalationen ab (`checkInsolvencyRisk()`).

**Buchungsjournal & Kontoauszug** (Finanzen-Screen, Reiter unter der GuV):

* `game.financeLedger` - `applyMatchdayFinances()` schreibt zu JEDEM Spieltag
  einen echten Buchungssatz mit allen Einzelposten (Ticket, Fanartikel, jeder
  Sponsor einzeln, Gehälter, Unterhalt, Ordnerdienst, Steuern). Kosten, die erst
  NACH `applyMatchdayFinances()` anfallen, tragen sich über
  `bucheInSpieltagsjournal(label, betrag)` nach.
* `game.kontoauszug` - alle übrigen Kontobewegungen. **Achtung, tragende
  Konstruktion:** Geld wird an über 150 Stellen direkt über `game.money`
  verrechnet. Statt jede davon einzeln zu protokollieren, macht
  `installKontoauszug()` (Ende von `js/finances.js`) aus `game.money` eine
  Accessor-Property. Jede Zuweisung läuft damit durch einen Kontrollpunkt.
  Folgen, die man kennen muss:
  * Beim Laden eines Spielstands (`Object.assign(game, p.game)`) muss die
    Protokollierung über `kontoauszugPausieren()` / `kontoauszugFortsetzen()`
    ausgesetzt werden, sonst erscheint der geladene Kontostand als Phantombuchung.
  * Die Beschriftung einer Buchung kommt aus `aktiverScreen` (gesetzt in
    `showScreen()`) oder aus einem explizit gesetzten `setzeBuchungskontext()`.
    Neue Screens gehören deshalb in `SCREEN_BUCHUNGS_LABELS`.
  * Spieltagsbuchungen laufen unter `SPIELTAG_KONTEXT` und werden bewusst NICHT
    in den Kontoauszug geschrieben - sie stehen vollständig im Journal.

**Betriebskosten des Stadions**: Nicht benötigte Ränge gelten als stillgelegt und
kosten nur 30 % Unterhalt (`getStadiumBaseMaintenance()` in `js/stadium.js`,
genutzt von `applyMatchdayFinances()`, der GuV-Prognose und dem Dashboard -
die Formel steht bewusst nur an EINER Stelle). Die genutzte Kapazität ergibt
sich aus dem Zuschauerschnitt der letzten fünf Heimspiele plus 15 % Reserve,
mindestens aber einem Fünftel des Stadions. Der Rabatt verschwindet von allein,
sobald der Verein das Stadion füllt.

**Gehälter im Amateurbereich**: Der Marktwert ist bis Stärke 44 konstant
15.000 €. Mit dem früheren Pauschalsockel von 300 € kostete dadurch JEDER
Spieler dort exakt 400 € pro Spieltag - über eine Saison fast so viel wie sein
gesamter Marktwert. `calculatePlayerWage()` staffelt unten jetzt nach Stärke
(`60 + str * 3 + Marktwert * 0.004`); ab Stärke 59 ist die Formel unverändert.

**Ordnerdienst**: Gemietete Ordner werden pro Heimspiel nach Bedarf gebucht
(~1 Ordner je 25 Zuschauer, gedeckelt durch die vorgehaltene Zahl, siehe
`getDeployedStewards()`); auswärts stellt der Gastgeber das Personal. Vorher
wurde an jedem Spieltag die volle vorgehaltene Zahl abgerechnet.

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
