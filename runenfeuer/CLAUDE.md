# Runenfeuer

Clan-Kriegsspiel im Browser mit Orks und Magiern. Das ganze Spiel steckt in **einer Datei**: `runenfeuer.html` (HTML + CSS + JS, keine Abhängigkeiten außer Google Fonts). Zum Testen einfach im Browser öffnen.

Sprache im Spiel und in Kommentaren: Deutsch.

## Aufbau von `runenfeuer.html`

Die Datei hat oben `<title>` und `<style>`, dann das HTML-Gerüst, dann ein `<script>`. Das Script ist in Blöcke gegliedert (Kommentare `/* ===== ... ===== */`):

| Block | Inhalt |
|---|---|
| basics | Canvas-Setup, Hilfsfunktionen (`rand`, `clamp`, `hash`, `shade`) |
| data | `CLASSES` (ork, magier), `ABIL` (4 Fähigkeiten je Klasse), `UT` (Einheitentypen), `ITEMS` (Ausrüstung, Stufe 1–5), `BUILD` (6 Gebäude), `SKILLS` (Fähigkeitenbaum, 3 Zweige), `RIVALS` (6 Clans), `WILD` (Wildnis-Kämpfe), `RANKS` |
| state | `newState()`, `save()`/`load()` über `localStorage` (Schlüssel `runenfeuer_v1`), `heroStats()`, Erfahrung/Level, Kosten |
| power / difficulty | `playerPower()`, `cfgPower()`, `diffTag()`; Kampf-Konfigurationen `raidCfg()`, `wildCfg()`, `defenseCfg()` |
| audio | WebAudio-Soundeffekte (`sfx(name)`), standardmäßig stumm |
| HUD / UI | Sheets (Bottom-Panels) `shBurg`, `shTag`, `shHeld`, `shKrieg`, `shMarkt`; Aktionen, Tagesende mit Zufallsereignissen, Modals, Startbildschirm; zentraler Klick-Dispatcher `act(a, arg)` über `data-act`/`data-arg` |
| iso drawing helpers | `P(x,y,z)` = isometrische Projektion (Kachel 64×32 px bei Zoom 1), `isoBox`, `gable`, `pyramid`, `glow` |
| figures | Zeichenfunktionen pro Körper: `drawOrk`, `drawMage`, `drawGolem`, `drawWolf`, `drawGhost`; `drawFigure()` macht Schatten, Lebensbalken, Status-Effekte |
| hub | Burgansicht (13×13 Raster), Gebäude, laufende Clanmitglieder, Partikel, Antippen von Gebäuden |
| battle | Echtzeit-Kampf: `startBattle(cfg)`, Wellen, `heroUpdate`, `aiUpdate`, `hurt`, Projektile, Partikel, Ringe, Schadenszahlen, `endBattle()` mit Belohnungen |
| loop & boot | `requestAnimationFrame`-Schleife, Szenen `hub` und `battle` |

Wichtige Konventionen:
- Welt-Koordinaten sind Kachel-Einheiten; Tiefensortierung nach `x + y`.
- Ein Kreis mit Radius r (Kacheln) erscheint als Ellipse mit Halbachsen `r*45*Z` und `r*22.6*Z`.
- Steuerung: virtueller Joystick links (Touch), Fähigkeiten-Buttons rechts; am PC WASD, Leertaste, K, L, I.
- Spielstand-Änderungen immer mit `refresh()` (rendert HUD und Sheet, speichert).
- Jede Kampf-Aktion kostet eine Tagesaktion (`useAction()`).

## Geplante Erweiterung (nächster Schritt)

### 1. Weltkarte mit 8 Gebieten
Neue Szene `map` (Navigationspunkt „Karte“ ersetzt „Krieg“). Isometrische Insel als lang gezogener Streifen (25×25-Raster, Ellipse entlang der Diagonale), Gebiete per Voronoi um Startpunkte, Höhen pro Gelände, statische Karte in Offscreen-Canvas cachen, Animationen (Lava-Glühen, Wolken, Flaggen) live darüber. Ziehen zum Verschieben, Tippen öffnet das Gebiets-Panel.

| Gebiet | Stufe | Gegner | Abschluss | Tribut/Tag |
|---|---|---|---|---|
| Heimattal | 1 | Wölfe | (Startgebiet) | – |
| Grauwald | 2 | Wolf, Spinne, Ork-Krieger | Festung: Waldtroll Murg | 60 Gold, 2 Kristalle |
| Aschensteppe | 3 | Ork-Krieger, Speerwerfer, Goblin-Sprenger, Schamane | Boss: Gorrak der Schlächter | 90 / 3 |
| Nebelruinen | 5 | Geist, Lehrling, Golem | Festung: Uralter Golem | 80 / 10 |
| Spinnenschlucht | 5 | Spinnen, Sprenger | Boss: Die Spinnenkönigin | 110 / 5 |
| Sturmgipfel | 7 | Troll, Schildträger, Krieger, Wolf | Festung: Frostriese Hrymm | 140 / 8 |
| Knochenmoor | 8 | Skelette, Nekromant, Geist | Boss: Morvath der Lichkönig | 130 / 14 |
| Glutberge | 11 | Feuerelementar, Schildträger, Sprenger, Schamane | Boss: Brazgul der Feuerdämon | 220 / 20 |

Verbindungen: Heimattal → Grauwald, Aschensteppe; Grauwald → Nebelruinen, Spinnenschlucht; Aschensteppe → Nebelruinen, Sturmgipfel; Nebelruinen → Knochenmoor; Spinnenschlucht → Knochenmoor; Sturmgipfel → Glutberge; Knochenmoor → Glutberge.

- Jedes Gebiet hat 3 Etappen (Vorposten säubern, Lager stürmen, Boss/Festung). Danach erobert: täglicher Tribut, Nachbargebiete werden sichtbar, „Patrouille“ als wiederholbarer Kampf.
- Gegnerlisten per Seed-Zufall erzeugen, damit die Schwierigkeitsanzeige nicht flackert.
- Rivalen-Clans bekommen ein Heimatgebiet und sind nur angreifbar, wenn es sichtbar ist.
- Besiegt man Brazgul, ist das Spiel gewonnen (Siegesbildschirm), danach geht es weiter.
- Spielstand-Migration: alte Saves ohne `regions` bekommen Heimattal erobert, Rest Etappe 0.

### 2. Neue Gegnertypen
Skelettkrieger, Nekromant (beschwört Skelette), Ork-Schamane (heilt Verbündete), Riesenspinne (verlangsamt), Goblin-Sprenger (läuft auf dich zu, Zündschnur mit rotem Warnkreis, explodiert), Schildträger (blockt Projektile), Feuerelementar (explodiert beim Tod). Neue Zeichenfunktionen: Spinne, Skelett, Elementar, Dämon; Ork-Varianten mit Schild, Bombe, Schamanenstab.

### 3. Bosse
Gemeinsames System: **Telegraphen** (Warnkreise am Boden, die sich füllen und dann treffen), Giftzonen, eigener Boss-Lebensbalken oben, zweite Phase bei 50 % Leben, Betäubung wirkt nur abgeschwächt. Jeder Boss lässt eine Trophäe fallen (im Markt anlegbar).

- **Gorrak der Schlächter:** Sprungangriff auf deine Position, Wirbelwind um sich, ruft in Phase 2 Krieger und Schamanen. Trophäe: Gorraks Kriegspanzer.
- **Die Spinnenkönigin:** Netzschüsse im Fächer (verlangsamen), Giftlachen, brütet Spinnen aus, in Phase 2 schneller. Trophäe: Herz der Spinnenkönigin.
- **Morvath der Lichkönig:** hält Abstand und teleportiert sich weg, grüne Geschosse, erweckt Skelette, Frostfeld auf deiner Position. Trophäe: Krone des Lichkönigs.
- **Brazgul der Feuerdämon:** Meteoritenregen (mehrere Warnkreise), Flammenwelle im Kreis, Prankenhieb, ruft in Phase 2 Feuerelementare. Trophäe: Brazguls Glutaxt bzw. Höllenstab.

### 4. Neue Kampfgelände
Moor (Pfützen, tote Bäume, Nebel), Schlucht (rote Felsen, Spinnennetze, Staub), Gipfel (Schnee, Tannen, Schneefall), Glut (Basalt, Lavaspalten, Funkenflug).
