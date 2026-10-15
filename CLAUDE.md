# CLAUDE.md

Anleitung für Claude Code in diesem Repository. Die vollständige Historie mit Messungen und Begründungen steht in `docs/PROJEKT-HISTORIE.md` und wird nur bei Bedarf gelesen.

## Projekt

**Anstoß Mobile Pro - FM13**: browserbasierter Fußballmanager. Modular aufgebaut (`index.html`, `css/styles.css`, `js/*.js`), gebaut zu einer einzelnen standalone HTML-Datei. Läuft offline, speichert lokal und ist auf Handys bedienbar.

## Zusammenarbeit

- Antworten immer auf Deutsch.
- Vor jedem Merge auf `main`: `npm run check` muss grün sein. **Nur auf ausdrücklichen Wunsch mergen**, nie automatisch nach einer Runde: Es sollen möglichst viele Funktionen in einen Patch passen. Bis dahin auf dem `claude/…`-Branch committen und pushen; Version erhöhen, ZIP und Deploy-Kontrolle erst beim Merge.
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
scripts/bot-hintergrund.sh <datei> <bot-args>  # Bot-Lauf mit Abschlusszeile "=== ENDE exit=<code> ===" in der Datei
python3 scripts/auswertung.py <datei>…         # Zusammenfassung je Bot-Lauf (Saisons, Liga, Entlassungen, Talente)
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
- Werkzeuge (Phase 26): `js/matchprep.js` (Aufstellungs-/Taktikvorlagen, Spieltag-Check inkl. Rotations-Assistent und Erschöpfungs-Hinweis), `js/contract-tools.js` (Gehalts-Ampel, Verlängerungs-Assistent, Marktwert-Kurve, Transferbilanz-Historie, Entwicklungsprognose), `js/insights.js` (Serien, Formkurve, CSV, Spielbericht teilen, Fachwort-Hilfe `fw()`), `js/player-compare.js` (Spieler-Vergleich im Spielerdetail), `js/manager-tools.js` (Liquiditäts-Vorschau, Konto-Alarm, Spieler-Etiketten mit kleiner Spielwirkung (`ETIKETT_WIRKUNG`), Manager-Assistent, Lizenz-Laufbahn). Sie lesen echte Daten und verändern die Mannschaft nur auf Tipp; neue Felder (`game.lineupPresets`, `tacticPresets`, `serien`, `transferBilanzHistory`, `p.tags`, `p.formNoten`, `p.injuryLog`, `game.gegnerNotizen`, `game.vorlageBilanz`, `game.vorlageBilanzArchiv`, `game.vorlageImEinsatz`, `game.assistentZurueck`, `game.assistentVorher`, `game.assistentErledigt`, `game.etikettBilanz`, `game.etikettBilanzVorjahr`, `game.etikettImEinsatz`, `scoutingNetwork.preisGrenzen`) brauchen in alten Spielständen eine Absicherung (`ensure…State()` oder `|| []`).
- Sprache: `js/i18n.js` (`t()`), `js/i18n-ui.js` (`I18N_UI_EN`), `js/lexicon.js` und `js/lexicon-en.js` (Lexikon, Englisch muss dieselbe Tippzahl und dieselben Ziffern haben).

**Ein System pro Bereich:** Verletzungen nur über die Rolle nach dem Spiel in `processPostMatchRoutine()` und `js/medical-department.js`; Medien über `js/media-department.js`; Jugend über `youthTalents`. Vor einem neuen Panel prüfen, ob es das Thema schon gibt. Ein Panel muss echte Daten zeigen, ein Bonus muss aus dem Stärke-Pfad (`calcTeamStrength()`, `getOwnLeagueMatchStrength()`) kommen.

## Grundregeln

- **Keine nativen Dialoge** (`alert`, `confirm`, `prompt`). Stattdessen `showToast()`, `showNotice()` und `requireConfirm()`. `testNoNativeDialogs` prüft das.
- **Keine stillen Knöpfe:** Ein Knopf, der nichts tun kann, sagt per `showToast()`, warum.
- **Speicher:** Jedes Laden geht durch `loadSaveSafely()`, jedes Schreiben durch `writeSaveVerified()`. Entfernte Felder in `cleanupRemovedModuleState()` (`js/state.js`) aufräumen.
- **Lint:** `no-redeclare` verhindert doppelte globale Funktionsnamen. `no-unused-vars` ist ein Fehler. `no-dupe-keys` gilt auch für `I18N_UI_EN`.
- **CSS-3D:** Kein `filter` oder `opacity` auf 3D-Elementen oder deren Vorfahren. Schatten über `box-shadow`. Keine Dauer-Animationen auf dem Startbildschirm des Büros; unendliche Animationen gehören in den `prefers-reduced-motion`-Block.
- **Mobile Leistung:** Kein `backdrop-filter` auf oft wiederholten oder scrollenden Elementen. In Render-Funktionen keine Größen lesen (`offsetWidth` & Co. erzwingen mitten im Neuzeichnen ein Layout, beim Kader-Radar waren das 63 % der Zeit); lange Kartenlisten tragen `content-visibility: auto`.
- **Designsystem (Phase 25.51):** Schriftgrößen nur über die Stufen `var(--fs-micro|caption|small|body|body-lg|title-sm|title|display)` (`css/styles.css`, `:root`), nie feste Pixel; die Stufen wachsen auf dem Handy und mit der Textgröße (`--fs-scale`). Farben und Flächen nur über Tokens (`--text-main`, `--text-muted`, `--accent`, `--surface-panel`, `--chip-bg` …), damit die Themes (`html[data-theme]`, `js/design-settings.js`) alles umfärben. Neue Karten mit `renderUiCard()` und `uiChip()` (`js/ui-cards.js`): Bild, Titel, Untertitel, Chips, Kennzahl, Knöpfe. Neue Themes müssen `testDesignThemes` und `testKontrastAlleThemes` (WCAG 4,5:1 auf allen Bildschirmen) bestehen.
- **Keine festen Farben (Phase 25.52):** In JS, HTML und UI-Regeln kein Hex-/rgb-Wert, sondern Tokens: Aufhellungen `color-mix(in srgb, var(--ink) N%, transparent)`, Schatten mit `--shade`, Flächen `--surface-0…3`, Schrift auf Füllungen `--on-strong`/`--on-accent`, Knopf-Füllungen `--*-fill`. `testKeineFestenFarben` prüft das. Ausnahmen: Illustrationen (Büro, Stadion, Spielfeld, Avatare, Wappen) und Canvas; Illustrationen setzen in CSS lokal Nacht-Tokens.
- **Schreibung:** Überschriften im Code in normaler deutscher Schreibung, nie in Großbuchstaben. Kurze Etiketten bekommen `class="ui-overline"` (Großbuchstaben per CSS). Beim Ändern deutscher UI-Texte den Schlüssel in `I18N_UI_EN` mitziehen.
- **Fenster statt Seitensprung (Phase 25.55):** Neue Meldungs- und Auswahlbereiche öffnen als `.generic-modal-overlay` (mit `.generic-modal-close`), nie als Kasten über der Liste mit `scrollIntoView`/`window.scrollTo` (`testFensterTastaturUndSpeicher` prüft den Quelltext). `js/ui-core.js` macht jedes Fenster zum Dialog (`role`, `aria-modal`), Escape schließt das oberste, Tab bleibt im Fenster.
- **Bedienelement-Namen:** `js/a11y.js` vergibt fehlende `aria-label` automatisch (Symbol-Knöpfe, Farbpunkte, Auswahlfelder). Neue Symbol-Knöpfe trotzdem mit `title` oder sichtbarem Text versehen; ein vorhandenes `title`/`aria-label` bleibt unangetastet.
- **Reiter und Meldungen (Phase 25.56):** Reiterknöpfe heißen `hubtab-btn-…` oder `btn-tab-…` und zeigen den aktiven Reiter über die Klasse `btn-action`; `js/a11y.js` macht daraus `tablist`/`tab` mit `aria-selected` und Pfeiltasten. Meldungen immer über `showToast()` (Statusbereich; fängt keine Tipps ab, `pointer-events: none`, sonst blockiert sie Knöpfe darunter; auf dem Handy über dem Weiter-Knopf).
- **Orientierung (Phase 25.57):** Genau ein `main#main-content`, die Navigationen tragen `aria-label`; neue Hauptbereiche nicht als weiteres `main`/`header` anlegen. Spielerdetail-Kopf (`#pd-summary`) zeigt Chips und Werteleiste, neue Angaben dort nur aufnehmen, wenn sie auf einen Blick wichtig sind.
- **Darstellung doppelt gespeichert:** Theme, Textgröße und Bewegung liegen über `designLesen()`/`designSchreiben()` (`js/design-settings.js`) in localStorage und sessionStorage; nie direkt mit `safeLocalSet` schreiben. Das Theme „Automatisch“ löst `loeseThemeAuf()` über festgehaltene `matchMedia`-Objekte auf.
- **Tests warten auf Zustände:** Statt `waitForTimeout` mit festen Zeiten `waitForFunction` auf den erwarteten Zustand (in CI scheiterten Tests an zu knappen 150 ms).
- **Handy-Layout:** Kein horizontaler Überlauf, Knöpfe mindestens 32 px, Schrift mindestens 11 px. Knopfreihen mit langen Wörtern als `repeat(auto-fit, minmax(min(100%, Nem), 1fr))` statt fester Spalten, Knöpfe neben `flex:1`-Feldern mit `flex:0 0 auto` (`testKnopfWorteHandy` prüft 320/360/390 px, auch mit 9 % breiterer Schrift wie in der CI). Messungen mit Rückfall `el.offsetWidth || 320`, da Bildschirme ausgeblendet sein können.
- **localStorage:** Auf `file://` blockiert Android WebView den Zugriff. Alle Zugriffe über `safeLocalSet()` und Gegenstücke.

## Tests

- `tests/run-tests.js` (Playwright) ist nur der Ablauf (Reihenfolge, Parallelität, Zusammenfassung); `tests/lib.js` hält `assert`, `freshPage` und die Zähler, die Suiten liegen nach Themen in `tests/suites/*.js` (jede Datei exportiert ihre `test…`-Funktionen, `run-tests.js` lädt alle Dateien dort und führt sie in der Liste `suites` aus). Neue Suite: Funktion in die passende Datei, im `module.exports` der Datei und in der Liste `suites` in `run-tests.js` eintragen. Die Suiten laufen gegen den gebauten Stand. Suiten laufen parallel (`TEST_JOBS`, Standard 3) in eigenen Browser-Kontexten. Zeitmessungen laufen allein am Ende.
- Feste Wartezeiten möglichst durch Zustandsprüfungen ersetzen (`waitForFunction`). Der Zufall wird in Suiten, die Reihenfolgen, Tabellen oder Layouts auswerten, mit festem Seed gesetzt (für Layouts schon vor dem Start des Spiels per `addInitScript` und `page.reload()`, sonst sind die Kadernamen bei jedem Lauf anders).
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
- `tests/` – `run-tests.js` (Ablauf), `lib.js` (Hilfen), `suites/` (Suiten nach Themen), `fixtures/saves/` (alte Spielstände).
- `scripts/` – Bot, Messungen, Hilfsskripte.
- `build.py` – Bundler und Lint-Vorlauf.
- `docs/PROJEKT-HISTORIE.md` – Archiv der früheren Fassung dieser Datei mit allen Phasen und Messungen.
