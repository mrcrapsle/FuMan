# Runenfeuer

Clan-Kriegsspiel im Browser mit Orks und Magiern. Das ganze Spiel steckt in **einer Datei**: `runenfeuer.html` (HTML + CSS + JS, keine Abhängigkeiten außer Google Fonts). Zum Testen einfach im Browser öffnen.

Sprache im Spiel und in Kommentaren: Deutsch.

## Aufbau von `runenfeuer.html`

Die Datei hat oben `<title>` und `<style>`, dann das HTML-Gerüst, dann ein `<script>`. Das Script ist in Blöcke gegliedert (Kommentare `/* ===== ... ===== */`):

| Block | Inhalt |
|---|---|
| basics | Canvas-Setup, Hilfsfunktionen (`rand`, `clamp`, `hash`, `shade`) |
| data | `CLASSES` (ork, magier), `ABIL` (4 Fähigkeiten je Klasse), `UT` (Einheitentypen), `ITEMS` (Ausrüstung, Stufe 1–5), `BUILD` (6 Gebäude), `SKILLS` (Fähigkeitenbaum, 3 Zweige), `RIVALS` (6 Clans), `WILD` (Wolfsjagd), `REGIONS`, `BOSS`, `RANKS` |
| state | `newState()`, `save()`/`load()` über `localStorage` (Schlüssel `runenfeuer_v1`), `heroStats()`, Erfahrung/Level, Kosten |
| power / difficulty | `playerPower()`, `cfgPower()`, `diffTag()`; Kampf-Konfigurationen `raidCfg()`, `wildCfg()`, `defenseCfg()` |
| audio | WebAudio-Soundeffekte (`sfx(name)`), standardmäßig stumm |
| HUD / UI | Sheets (Bottom-Panels) `shBurg`, `shTag`, `shHeld`, `shGebiete`, `shRegion`, `shMarkt`; Aktionen, Tagesende mit Zufallsereignissen, Modals, Startbildschirm; zentraler Klick-Dispatcher `act(a, arg)` über `data-act`/`data-arg` |
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

## Erweiterung (umgesetzt)

**Weltkarte** (`REGIONS`, Block „world map“): Szene `map` (Navigationspunkt „Karte“ ersetzt „Krieg“), 25×25-Raster als Streifen entlang der Diagonale. Gebiete per Voronoi um `seed`, Höhe über `h`. Die statische Karte steckt in einem Offscreen-Canvas (`mapBuildCache()`, neu gebaut, wenn sich `mapSig()` ändert; dafür wird `ctx` kurz getauscht), Lava, Wolken, Flaggen, Beschriftung und Auswahl laufen live darüber (`renderMap()`). Ziehen, Zwei-Finger-Zoom, Mausrad, Tippen öffnet das Gebietsfenster (`shRegion`); „Gebiete & Rangliste“ (`shGebiete`) enthält die Rivalen und die Rangliste.
- Zustand: `S.regions[id].stage` (0 bis 2 = nächste Etappe, 3 = erobert; Heimattal startet erobert), `S.trophies`, `S.won`. `migrate()` ergänzt alte Spielstände beim Laden. Sichtbar ist ein Gebiet, wenn ein Vorgänger (`links`) erobert ist (`regionVisible`).
- Feldzug: `regionCfg(id, stage, patrol)` mit Seed-Zufall (`rng(strHash(...))`), 3 Etappen, danach Patrouille und täglicher Tribut (`tributeSum()` in `endDay`). Ergebnis in `regionWon()`; Sieg über Brazgul setzt `S.victory` und zeigt über `checkVictory()` den Siegesbildschirm.
- Rivalen haben ein Heimatgebiet (`RIVALS[].home`) und sind nur angreifbar, wenn es sichtbar ist.

**Gegner** (`UT`): Skelettkrieger, Nekromant (beschwört, hält Abstand), Ork-Schamane (heilt), Riesenspinne (verlangsamt), Goblin-Sprenger (Zündschnur mit Warnkreis), Schildträger (blockt Projektile), Feuerelementar (explodiert). Sonderverhalten in `specialAct()` und `aiUpdate()`; neue Figuren `drawSkel`, `drawSpider`, `drawElem`, `drawDemon`, Ork-Waffen `stab`, `bombe`, `schild`.

**Bosse** (`BOSS`, `PAT`, `bossAct()`): Telegraphen (`B.tele`, werden in `resolveTele()` ausgelöst), Giftzonen (`B.zones`), Boss-Lebensbalken `#bossbar`, Phase 2 bei 50 % Leben, Betäubung nur zu 30 % (`stunU`). Gorrak, Spinnenkönigin, Morvath und Brazgul lassen Trophäen fallen (`ITEMS[].tro`, im Markt anlegbar); Murg, Uralter Golem und Hrymm sind Festungswächter ohne Trophäe. Neue Muster in `PAT` eintragen und in `BOSS[...].pats` nennen.

**Kampfgelände** (`THEMES`): Moor, Schlucht, Gipfel und Glut mit Bodenzeichen (`drawDecal`), Hindernissen (`deadTree`, `fir`, `basalt`, `rock` mit Farben) und Wetter (`drawAmbient`).
