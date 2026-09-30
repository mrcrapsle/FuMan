# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anstoß Mobile Pro - FM13** is a fully-featured browser-based football manager simulation game. The codebase is modular (index.html + css/styles.css + 78 js/*.js files) that bundles into a single 1.8 MB standalone HTML file. The game runs entirely in the browser with local storage for save games, works offline, and supports mobile devices.

## Common Commands

```bash
# PFLICHT vor jedem Merge/Push auf main: Build, Lint, Tests (normal + minifiziert)
npm run check          # "npm run check -- fast" lässt die minifizierte Variante weg
# Logs bei Fehlern: dist/check-logs/

# Build standalone HTML (required before deploying)
python3 build.py
# Output: dist/anstoss-fm13-standalone.html

# Serve for local development (recommended - rebuilds automatically)
npm run serve        # or: python3 server.py
# Serves on http://localhost:8000
# Watches source files and rebuilds dist/ on changes
# Two versions available:
#   - http://localhost:8000/       (modular, immediate edits visible)
#   - http://localhost:8000/spiel  (built standalone, auto-rebuilt)

# Run tests against the built game
python3 build.py
cd tests && npm install && npm test

# Lint all JavaScript (including inline <script> blocks from index.html)
npm install && npm run lint

# Minify the standalone file (optional, ~30% smaller)
npm run minify
# Output: dist/anstoss-fm13-standalone.min.html
```

**Dev Workflow:** Run `npm run serve` once, then edit files and reload the browser. The page at `/` loads index.html with your changes immediately; `/spiel` shows the built version (which rebuilds automatically when sources change).

## High-Level Architecture

### State Management: Global `game` Object

All persistent game state lives in a single `game` object (defined in `js/state.js`). This contains:
- Season, matchday, money, squad roster
- All club facilities, upgrades, finances
- Results history, achievements
- Settings and customizations

**Pattern:** Never pass state as function parameters. All systems read from and write to `game` directly.

### Feature System Pattern (Key Architecture)

Each major feature (manager analytics, player scandals, fanclub management, etc.) follows an identical pattern:

```javascript
// 1. State isolation: Feature-specific state object (never pollute global `game`)
let featureNameState = {
    data: [],
    settings: { ... }
};

// 2. Initialization/tick functions (called during game loop)
function tickFeatureName() { ... }

// 3. Render function: updates HTML panel from state
function renderFeatureNamePanel() {
    const container = document.getElementById('feature-name-box');
    if (!container) return;
    // Build HTML and set container.innerHTML
}

// 4. HTML container: always added to index.html
<div id="feature-name-box"></div>

// 5. Safe loading: typeof check in render and monthly ticks
if (typeof tickFeatureName === 'function') tickFeatureName();
if (typeof renderFeatureNamePanel === 'function') renderFeatureNamePanel();
```

This pattern ensures:
- New features don't break if files aren't loaded
- State is encapsulated and debuggable
- Render functions are idempotent (safe to call multiple times)
- Testing individual features is straightforward

**Current Integrated Systems:**
- Manager Analytics (career stats, rating breakdown)
- Player Scandals (controversies, suspensions, team morale)
- Tactic record (`game.tacticRecords`: real results per formation + style, js/tactic-system.js; formation/style effects live in `FORMATION_RATINGS` / `TACTIC_STYLE_CONFIG`)
- Fans (fan groups, actions, club network) in `js/fans.js`
- Board Room (four members explaining `game.boardSat`)
- Hall of Fame, Youth Academy, Player Development
- Plus 60+ other game systems

**One system per area** (Phases 12/13 merged duplicates - don't add parallel ones again):
- Injuries: only the post-match roll in `processPostMatchRoutine()`; extra factors and the panel live in `js/medical-department.js`. Events injure via `injurePlayerByEvent()` (never reduce strength).
- Media: `game.managerMediaImage` is the single image; actions/events in `js/media-department.js`.
- Youth: `youthTalents` (js/youth.js) plus coach/ranking/monthly development in `js/youth-academy-extended.js` / `js/academy-ranking.js`.
- Sponsoring: `js/sponsors.js` (main, kit, sleeve, boards, bus).
- Contracts: `p.contracts` = remaining years (counted down in season-end.js); extensions/release clauses in `js/contracts.js`, ultimatums in `js/contract-ultimatum.js`. Wages are `p.wage` per matchday (there is no `p.salary`). Agents are `p.agent` (fee via `getAgentFee()`).
- Scouting: the regional network in `js/scouting.js`. Opponent prediction: `js/match-scout.js` (uses `simulateGoals` on real fixtures).
- Board: `game.boardSat`, explained per member in `js/board-room.js`.
- Fans: `js/fans.js` (`game.fans`, fan actions/groups). Training: `js/training.js` + minigames in `js/training-games.js`. Stadium: `js/stadium.js` (blocks/capacity) + `js/stadium-events.js`.
- Transfer windows: matchday-based (summer 1-3, winter 18-20) with `runDeadlineDay()` in `js/transfermarket.js`, driven by `tickTransferWindows()` after every matchday.
- Season end extras: `js/relegation.js` (own club on rank 3/16, legs on the dashboard, auto-resolved in `concludeSeasonAndAdvance()`), `js/league-awards.js` (`game.leagueAwards`), `js/coach-carousel.js` (AI `team.coach`, temporary `team.coachBounce` - removed via `tickCoachBounce(true)` before leagues advance).
- Statistics: manager career in `game.managerCareer` (js/manager-analytics.js), Hall of Fame computed from squad + `game.playerRetirement` + `game.managerCareer` (js/hall-of-fame.js). Loans: `js/secondteam.js` / transfermarket loans only.
- Side income: stock `dividendRate` is an annual rate (paid monthly as rate/8.5); betting odds come from `simulateBetProbabilities()` (same `simulateGoals` as matches) using the best available XI (`pickBestLineupIds()`), no bets on own defeat; real estate income grows with cumulative cost (~10 seasons payback). Measure new income sources before adding them - several were money machines.
- Removed modules leave save-game fields behind: add them to `cleanupRemovedModuleState()` in js/state.js (runs on load and monthly).
- Club change: only `showClubSwitchOptions()` in js/career.js. Player retirements: `tickPlayerRetirement()` (js/player-retirement.js), shown in the Hall of Fame.
- Player aging/development: only `agePlayersAtSeasonEnd()` in `js/player-development.js` (age +1, strength by archetype).

### Game Loop & Monthly Ticks

The main game loop is in `js/match.js` → `playMatch()` → `processPostMatchRoutine()`.

**Monthly Ticks** (called every 4 matchdays, since 34 matchdays ≈ 8.5 months):
```javascript
if (game.matchday % 4 === 0) {
    // Financial ticks: income, expenses, board salary
    if (typeof tickRealEstateIncome === 'function') tickRealEstateIncome();
    if (typeof tickSponsoringIncome === 'function') tickSponsoringIncome();
    if (typeof processFanRevenue === 'function') {
        game.money += processFanRevenue();
    }
    
    // Relationship ticks: fan engagement, board relations, youth programs
    if (typeof tickFanEngagement === 'function') tickFanEngagement();
    if (typeof tickBoardRelations === 'function') tickBoardRelations();
    if (typeof tickYouthAcademyPrograms === 'function') tickYouthAcademyPrograms();
    
    // Post-match analysis and record-keeping
    if (typeof recordFinancialMonth === 'function') recordFinancialMonth();
}
```

**Season End** (called in `js/season-end.js` → `concludeSeasonAndAdvance()`):
```javascript
// before promotion/relegation changes game.leagueLevel:
if (typeof recordSeasonalManagerStats === 'function') recordSeasonalManagerStats(myRank, myTeamRecord, game.leagueLevel);
if (typeof awardLeagueHonours === 'function') awardLeagueHonours(myRank);
if (typeof agePlayersAtSeasonEnd === 'function') agePlayersAtSeasonEnd();
```

Always use `typeof ... === 'function'` checks before calling feature functions—this allows features to be optional.

### UI Rendering Pattern

Most game screens follow this pattern:
1. Main render function collects all data from `game` state
2. Calls sub-render functions via typeof checks
3. Each sub-render builds HTML and updates a specific container
4. Container exists in index.html with a fixed `id` (e.g., `<div id="squad-box"></div>`)

Long screens use sub-tabs instead of stacking panels (`setTrainingTab()`, `setSquadTab()` with `squad-tab-*` containers, and the generic `setSubTab(prefix, tab)` in js/ui-core.js with `subtab-<prefix>-<tab>` containers for history `hist` and finances `fin`): put a new panel into the matching tab, not directly into the screen.

Screen render functions are typically called:
- On screen switch: `showScreen('screen-squad')` calls `renderSquadView()`
- After match: `updateUI()` re-renders all visible panels
- On monthly tick: feature panels update their state and re-render

### Financial System

Finances are tracked per matchday in a **ledger** (`game.financeLedger`):
```javascript
let net = grossIncome - taxAmount - advisorFee - wages - staffWages 
          - secondTeamStaffWages - boardExpenses - travelCost;
game.money += net;

// All income/expense items recorded for transparency
let einnahmen = [...]; // income items
let ausgaben = [...];  // expense items
```

This ensures users can see exactly where money comes from/goes. Add new income or expense items to these arrays (they auto-filter out zero amounts).

### Building & Bundling

`build.py` does:
1. Reads `index.html` for `<script src="js/*.js">` tags - the ONLY list of modules (no second list in build.py)
2. Aborts on duplicate script tags, missing files, or `js/*.js` files without a script tag
3. Embeds every referenced .js file and the CSS from `css/styles.css`
4. Writes single `dist/anstoss-fm13-standalone.html`
5. `npm run lint` lints the combined bundle (all files treated as one global scope)

**Lint rules that matter:** a file-level `/* eslint-disable no-undef */` only applies to that file (the lint bundle re-enables rules between files). `no-redeclare` catches two modules defining the same global name - a later `function x()` would otherwise silently replace an existing one. Rename the new one instead.

**Monthly ticks:** feature ticks belong inside the `if (game.matchday % 4 === 0)` block in `processPostMatchRoutine()` (js/match.js), not next to it - otherwise they run every matchday. Render functions must never change `game.money` (checked by the runtime round-trip test). Measure sizes with a fallback (`el.offsetWidth || 320`): screens are `display:none` while not shown.

**Why one big file:** Game must run offline as a single draggable-and-droppable file on Android/mobile (Chrome, Firefox, etc.). No server, no network, no external dependencies.

### Important Architectural Decisions & Gotchas

1. **No `alert()` or `confirm()`** – Many Android WebViews suppress native dialogs silently. Use `showToast()` for notifications or `addInboxMessage()` for confirmations instead. This is enforced by linting and tests.

2. **Manager's Office: Custom Hit Detection** – The office 3D scene (`js/office.js`) uses custom `getBoundingClientRect()` hit testing, not native browser hit detection. Native hit testing is unreliable on 3D-transformed elements across browser versions. See `officeHotspotAtPoint()`.

3. **CSS-3D Pitfalls:**
   - Never use `filter` or `opacity` on 3D-positioned elements (forces `transform-style: flat`)
   - Use `box-shadow` for shading, not `filter`
   - Don't animate `transform` properties (breaks compositing); use `box-shadow` animations instead

4. **localStorage Access** – Android WebViews block localStorage on `file://` URLs completely. Always serve over `http://` for development/testing. `safeLocalSet()` wraps all storage access in try-catch for WebViews that don't support it.

5. **Squad Array Consistency** – The squad roster is a simple array (`let squad = [...]` in `js/state.js`). When adding players in transfers/recruitment, ensure each player has a unique `id`, else state becomes ambiguous. Use `squad.find(p => p.id === X)` for lookups, never array indices.

6. **Game Version & Compatibility** – `GAME_VERSION` in state.js is user-facing and logged when save games load. Update it on major features; it helps debug save-state issues.

## Common Editing Tasks

### Adding a New Feature System

1. Create `js/new-feature.js` with your `featureState` object
2. Export render function: `function renderNewFeaturePanel() { ... }`
3. Export tick functions if needed: `function tickNewFeature() { ... }`
4. Add `<div id="new-feature-box"></div>` to appropriate screen in `index.html`
5. Add `<script src="js/new-feature.js?v=2.1"></script>` to index.html script section
6. Add typeof-guarded calls in render and tick functions:
   - Monthly tick in `match.js`: `if (typeof tickNewFeature === 'function') tickNewFeature();`
   - Screen render in (e.g.) `squad.js`: `if (typeof renderNewFeaturePanel === 'function') renderNewFeaturePanel();`
   - Season-end in `season-end.js` if needed: `if (typeof recordNewFeatureStats === 'function') recordNewFeatureStats();`
7. Run `python3 build.py` to bundle
8. Commit: describe the feature and note its integration points

### Fixing a Finance Bug

1. Identify which `tickXXXIncome()` or expense is wrong
2. Check it's being called during monthly ticks (line ~1722 in match.js)
3. Verify the amount is added/subtracted correctly
4. Add it to the `einnahmen` or `ausgaben` array in `processPostMatchRoutine()`
5. Run `npm run lint` and test with `npm test`

### Modifying Squad/Player State

1. Always use `squad.find(p => p.id === X)` for lookups
2. Never modify `squad[index]` directly—get the player object first
3. Update `game` object if the change affects carry-over state (e.g., `game.money`, `game.season`)
4. Call `updateUI()` after state changes to re-render all panels

## Testing

```bash
# Full test suite (Playwright, runs against built standalone HTML)
cd tests && npm install && npm test
# Single suite by function name
cd tests && TEST_ONLY=LandesPokal node run-tests.js

# The test file (tests/run-tests.js) includes:
# - testManagerOffice: 3D hotspot hit-detection for all office objects
# - Dialog suppression: verifies no alert/confirm in codebase
# - Financial ledger: spot-checks income/expense calculations
# - Screen rendering: loads key screens and checks for errors
# - Save/load: verifies game state persists and loads correctly
```

`testCodeIntegrity` checks statically and in the browser: every function called from an `on*` attribute (index.html and generated HTML) exists, every `getElementById('…')` id exists somewhere, charts rendered while their screen is hidden (`offsetWidth` 0) have no negative sizes, and no `filter`/`opacity` sits on a `preserve-3d` element or its ancestors (office light/dark, every office event, stadium).

`testRuntimeRoundTrip` wraps every game function, plays two seasons and opens every screen; it lists ALL runtime errors with the function name at once, plus screens that move money. When it fails, fix each listed function.

## Deployment

Commits to `main` branch trigger an automated build-and-deploy via GitHub Actions (`.github/workflows/build-test.yml`):
1. Run test suite on the built standalone HTML
2. If tests pass, deploy dist/anstoss-fm13-standalone.html to GitHub Pages
3. Live at https://mrcrapsle.github.io/FuMan/

CI runs on every branch; only `main` deploys. Only push to `main` after `npm run check` is green. Use feature branches (e.g., `claude/feature-name`) for development and testing.

## Repository Structure

- **index.html** – Main page; embeds CSS, loads all js/ modules, defines screen containers
- **css/styles.css** – All styles; organized by section (DASHBOARD, SQUAD, MANAGER'S OFFICE, etc.)
- **js/*.js** – Game logic modules (78 files); loaded in order of dependencies
- **tests/run-tests.js** – Playwright test suite
- **build.py** – Bundler script; concatenates and lints
- **server.py** / `npm run serve` – Local dev server
- **dist/anstoss-fm13-standalone.html** – Built game file (1.8 MB, generated by build.py)
- **.github/workflows/build-test.yml** – CI/CD automation
