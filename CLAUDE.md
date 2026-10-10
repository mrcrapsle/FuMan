# CLAUDE.md

Anleitung für Claude Code in diesem Repository. Die vollständige Historie mit Messungen und Begründungen steht in `docs/PROJEKT-HISTORIE.md` und wird nur bei Bedarf gelesen.

## Projekt

**Anstoß Mobile Pro - FM13**: browserbasierter Fußballmanager. Modular aufgebaut (`index.html`, `css/styles.css`, `js/*.js`), gebaut zu einer einzelnen standalone HTML-Datei. Läuft offline, speichert lokal und ist auf Handys bedienbar.

## Zusammenarbeit

- Antworten immer auf Deutsch.
- Vor jedem Merge auf `main`: `npm run check` muss grün sein. Erst auf ausdrücklichen Wunsch mergen.
- Die Version in `js/state.js` (`GAME_VERSION`) bei jedem Merge erhöhen. Sie erscheint in der Kopfzeile (`#header-version-tag`).
- Nach jedem Merge eine ZIP `anstoss-fm13-vX.zip` schicken: minifizierter Build als `anstoss-fm13.html` plus Quellcode im Ordner `anstoss-fm13/` (`git archive origin/main -- . ':!dist'`). Mit beiden Links:
  - Spielen: https://mrcrapsle.github.io/FuMan/
  - Download: https://github.com/mrcrapsle/FuMan/raw/main/dist/anstoss-fm13-standalone.min.html
- Eine Runde bündeln: alle Änderungen sammeln, einmal `npm run check`, Fehler gesammelt beheben, gezielte Wiederholung mit `TEST_ONLY=<Name>`.

## Befehle

```bash
npm run check            # Build, Lint, Tests standalone und minifiziert (Logs: dist/check-logs/)
npm run check -- fast    # ohne die minifizierte Variante
python3 build.py         # baut dist/anstoss-fm13-standalone.html
npm run lint             # Lint über alle JS-Dateien inkl. Inline-Skripte in index.html
npm run minify           # dist/anstoss-fm13-standalone.min.html
npm run serve            # Entwicklungsserver mit Neubau auf http://localhost:8000 (/ = modular, /spiel = gebaut)
cd tests && npm test     # Testsuite gegen den gebauten Stand
cd tests && TEST_ONLY=Name node run-tests.js   # einzelne Suite (Teilstring des Funktionsnamens)
```

## Architektur

**Zentraler Zustand:** Alle persistenten Spieldaten liegen im globalen Objekt `game` (`js/state.js`). Funktionen lesen und schreiben `game` direkt, Zustand wird nicht als Parameter weitergereicht. Der Kader ist das Array `squad`; Spieler immer über `squad.find(p => p.id === X)` suchen, nie über Indizes.

**Feature-Muster:** Jedes Feature hat einen eigenen Zustand, eine Tick-Funktion (monatlich oder pro Spieltag), eine Render-Funktion für einen Container mit fester `id` in `index.html`. Aufrufe immer mit `typeof … === 'function'` absichern, damit optionale Module nicht brechen. Render-Funktionen dürfen nie `game.money` ändern.

**Monatliche Ticks** laufen in `runMonthlyClubTicks()` (`js/match.js`), nicht in `processPostMatchRoutine()`. Der Spieltag-Ablauf ist `playMatch()` → `processPostMatchRoutine()`. Saisonende: `concludeSeasonAndAdvance()` (`js/season-end.js`).

**Finanzen:** Buchungen laufen über `bucheMitLabel(label, betrag)` (`js/finances.js`), damit jede Position im Kontoauszug ein Etikett hat. Neue Einnahmen oder Ausgaben mit Etikett buchen.

**Systeme nach Datei** (nur Orientierung; Details im Code und in der Historie):
- Jugend: `js/youth.js`, `js/youth-pathway.js`, `js/youth-sales.js` (Angebote, Entscheidungshilfe `getYouthOfferSquadHint`).
- Transfers: `js/transfermarket.js` (Angebote, `completeOfferSale`), `js/transfer-poker.js` (Verhandlung, `pokerRunden`), `js/medical-check.js`, `js/pre-contracts.js`, `js/buyback.js`, `js/rumors.js`.
- Verträge und Kader: `js/contracts.js`, `js/contract-ultimatum.js`, `js/squadplanning.js`, `js/pro-loans.js`, `js/secondteam.js`.
- Vorstand und Entlassung: `js/match-post.js` (`checkJobSecurity`, `checkSeasonEndSacking`, `getSacked`), `js/winter-talk.js`, `js/board-room.js`.
- Spielstand: `js/save.js`, `js/save-safety.js` (jedes Laden über `loadSaveSafely`, jedes Schreiben über `writeSaveVerified`; nie `applyLoadedState()` direkt aufrufen).
- Liga und Pokal: `js/leagues.js`, `js/cup.js`, `js/cup-live.js`, `js/europe.js`, `js/relegation.js`, `js/promotion-boost.js`.
- Live-Spiel: `js/match-live.js`, `js/co-trainer-live.js`, `js/set-pieces.js`, `js/referee-critique.js`; Simulation und Live nutzen dieselbe Torformel `getExpectedGoals()` (`js/utils.js`).
- Finanzsystem: `js/season-end.js` (Budgets, `applyCashSurplusBudgets`, `getWageBudgetFloor`), `js/sponsors.js`, `js/sponsor-renewal.js`.
- Geografie und Derbys: `js/club-geo.js` (`isDerbyMatch` ist die einzige Derby-Regel), `js/derby-week.js`.
- Büro: `js/office.js` (eigene Trefferprüfung über `officeHotspotAtPoint()`), `js/one-hand.js` (Bedienung mit einer Hand, Handy bis 650 px).
- Sprache: `js/i18n.js` (`t()`), `js/i18n-ui.js` (`I18N_UI_EN`), `js/lexicon.js` und `js/lexicon-en.js` (Lexikon, Englisch muss dieselbe Tippzahl und dieselben Ziffern haben).

**Ein System pro Bereich:** Verletzungen nur über die Rolle nach dem Spiel in `processPostMatchRoutine()` und `js/medical-department.js`; Medien über `js/media-department.js`; Jugend über `youthTalents`. Vor einem neuen Panel prüfen, ob es das Thema schon gibt. Ein Panel muss echte Daten zeigen, ein Bonus muss aus dem Stärke-Pfad (`calcTeamStrength()`, `getOwnLeagueMatchStrength()`) kommen.

## Grundregeln

- **Keine nativen Dialoge** (`alert`, `confirm`, `prompt`). Stattdessen `showToast()`, `showNotice()` und `requireConfirm()`. `testNoNativeDialogs` prüft das.
- **Keine stillen Knöpfe:** Ein Knopf, der nichts tun kann, sagt per `showToast()`, warum.
- **Speicher:** Jedes Laden geht durch `loadSaveSafely()`, jedes Schreiben durch `writeSaveVerified()`. Entfernte Felder in `cleanupRemovedModuleState()` (`js/state.js`) aufräumen.
- **Lint:** `no-redeclare` verhindert doppelte globale Funktionsnamen. `no-unused-vars` ist ein Fehler. `no-dupe-keys` gilt auch für `I18N_UI_EN`.
- **CSS-3D:** Kein `filter` oder `opacity` auf 3D-Elementen oder deren Vorfahren. Schatten über `box-shadow`. Keine Dauer-Animationen auf dem Startbildschirm des Büros; unendliche Animationen gehören in den `prefers-reduced-motion`-Block.
- **Mobile Leistung:** Kein `backdrop-filter` auf oft wiederholten oder scrollenden Elementen.
- **Handy-Layout:** Kein horizontaler Überlauf, Knöpfe mindestens 32 px, Schrift mindestens 8 px. Messungen mit Rückfall `el.offsetWidth || 320`, da Bildschirme ausgeblendet sein können.
- **localStorage:** Auf `file://` blockiert Android WebView den Zugriff. Alle Zugriffe über `safeLocalSet()` und Gegenstücke.

## Tests

- `tests/run-tests.js` (Playwright) läuft gegen den gebauten Stand. Suiten laufen parallel (`TEST_JOBS`, Standard 3) in eigenen Browser-Kontexten. Zeitmessungen laufen allein am Ende.
- Feste Wartezeiten möglichst durch Zustandsprüfungen ersetzen (`waitForFunction`). Der Zufall wird in Suiten, die Reihenfolgen oder Tabellen auswerten, mit festem Seed gesetzt.
- Wichtige Querschnittstests: `testCodeIntegrity` (on*-Funktionen, `getElementById`-IDs), `testNoWriteOnlyGameFields`, `testRuntimeRoundTrip`, `testMobileLayout`, `testLexiconEnglish`.
- Alte Spielstände liegen in `tests/fixtures/saves/`. Jede Datei wird automatisch geladen (`testAeltereStaende`, auch als Autosave). Neue Fixtures mit `node scripts/make-old-saves.js tests/fixtures/saves <version>=<html>` erzeugen.

## Bot-Messungen

`node scripts/longrun-bundesliga.js [saisons] [aktiv|passiv] [läufe] [datei]`. Umgebungsschalter: `LIGA` (Startliga 0 bis 5), `SPEICHERN`, `COTRAINER`, `TALENT_AUFSCHLAG`, `KASSE_ANTEIL`, `VORSTAND_START`, `ENTLASSUNG_ERZWINGEN`, `FINDIAG`, `DIAG`. Lange Läufe im Hintergrund starten, nicht im Vordergrund. Die Messergebnisse stehen in `docs/PROJEKT-HISTORIE.md`.

## Deployment

Commits auf `main` lösen über `.github/workflows/build-test.yml` den Test und das Veröffentlichen auf GitHub Pages aus. Nur auf `main` pushen, wenn `npm run check` grün ist. Feature-Arbeit auf `claude/…`-Branches.

## Repository

- `index.html` – Seite, lädt alle Module, enthält die Bildschirm-Container.
- `css/styles.css` – alle Styles, nach Bereichen gegliedert.
- `js/` – Spiellogik (über 100 Module, Reihenfolge in `index.html`).
- `tests/run-tests.js` – Testsuite.
- `scripts/` – Bot, Messungen, Hilfsskripte.
- `build.py` – Bundler und Lint-Vorlauf.
- `docs/PROJEKT-HISTORIE.md` – Archiv der früheren Fassung dieser Datei mit allen Phasen und Messungen.
