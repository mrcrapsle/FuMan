# Projekt-Historie (Archiv)

Vollständiger Stand der bisherigen CLAUDE.md mit allen Phasen, Messungen und Begründungen. Wird nur bei Bedarf gelesen; die geltenden Regeln stehen in CLAUDE.md.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anstoß Mobile Pro - FM13** is a fully-featured browser-based football manager simulation game. The codebase is modular (index.html + css/styles.css + 111 js/*.js files) that bundles into a single 1.8 MB standalone HTML file. The game runs entirely in the browser with local storage for save games, works offline, and supports mobile devices.

## Working With the User

- Always reply in German.
- After every merge to `main`, send a ZIP `anstoss-fm13-vX.zip` containing the minified build as `anstoss-fm13.html` PLUS the source code in a folder `anstoss-fm13/` (`git archive origin/main` without `dist/`: css, js, tests, build.py, index.html, README.md, ...), and always include both links:
  - Spielen: https://mrcrapsle.github.io/FuMan/
  - Download: https://github.com/mrcrapsle/FuMan/raw/main/dist/anstoss-fm13-standalone.min.html
- The game version is shown in the header (`#header-version-tag`, from `GAME_VERSION`); bump it on every merge.

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
- Media: `game.managerMediaImage` is the single image; actions/events and the pre-match press conference (`renderPressConference()`, situation-based answers with real effects, promises settled in `resolvePressPromise()`) in `js/media-department.js`.
- Youth: `youthTalents` (js/youth.js) plus coach/ranking/monthly development in `js/youth-academy-extended.js` / `js/academy-ranking.js`. The pathway lives in `js/youth-pathway.js`: real ceiling `p.potential` (`ensureYouthPotential()`, shown only after the paid check), aging via `ageYouthAtSeasonEnd()` (from `agePlayersAtSeasonEnd()`), pro-contract decision at 19 (`p.proDecisionLeft`, `promoteYouth()` signs via `signYouthProContract()`), development loans through `loanedPlayers` with `youthLoan: true` (ticked in `tickLoanedPlayers()`), moments in `game.youthMoments` (breakthroughs, debut/first goal via `checkYouthMilestones()` in `gradeOwnMatch()`). Youth screen uses sub-tabs `setSubTab('jug', …)`. Scouting is league-relative (25.17): `scoutYouthTalent()` costs `getYouthScoutCost()` (2 % of `getLeagueTransferBudget()`, min 2,000 €) and starts the talent at `getYouthLeagueBase()` (average AI strength of the own league) -24..-14 plus academy/internat bonus (25.18: academy max level `YOUTH_ACADEMY_MAX_LVL` 5, `getYouthAcademyStartBonus()` +2 per level, `getYouthAcademyTierShift()` +4 % top-talent chance per level above 1, shown in `#youth-academy-effect` - before +3 per level without a cap); `p.youthLeagueBase` makes `ensureYouthPotential()` use `YOUTH_POTENTIAL_OFFSET` per tier (25.22: 1: -12..-5, 2: -6..0, 3: 0..+6 around that base - with -10..-3 / -3..+4 / +4..+10 the Bundesliga bot had 8-10 own talents in its best XI after 9-10 seasons, now ~5; a first try at -14..-4 / up to +15 gave the Bundesliga bot 7-8 own youth players in the XI after 5 seasons) - before, a fixed 46-58 start was a starter in Liga 6 and useless in the Bundesliga. Talent sales: `js/youth-sales.js` - monthly `tickYouthOffers()` (runMonthlyClubTicks) creates AI offers for talents >= 16 (`YOUTH_OFFER_CHANCE` per tier, max 2 in `game.youthOffers`, 4 matchdays), fee = market value of the current strength × (1 + headroom/20), capped at 30 % of the value at the potential (the first draft, value halfway to the potential, paid the Bundesliga bot up to 43 M€ per season); `acceptYouthOffer(id, mitBeteiligung)` (85 % into the transfer budget; with sell-on 20 % less now + `game.sellOnClauses` entry with `resaleValue` halfway to the potential), `rejectYouthOffer()` (tier 3 +1), box `#youth-offers-box`; each offer shows `getYouthOfferSquadHint(p)` (squad median vs the revealed potential, 25.33 - the Bundesliga bot selling talents below the median, or up to median +5, lost no measurable XI strength and earned 16-45 M€ per 10 seasons; selling stays the player's choice).
- Sponsoring: `js/sponsors.js` (main, kit, sleeve, boards, bus). Same-branch sponsors pay only 70 % (`getExclusivityRival()` names the active rival on the offer). Without a main sponsor `remindMissingMainSponsor()` (per matchday from md 3, once per season via `game.sponsorReminderSeason`) sends an inbox message + toast - a Bundesliga club without one loses ~0.7 M€ per matchday and after 10 matchdays in the red the board sells the BEST player (`checkInsolvencyRisk()`).
- Sponsor renewal: `js/sponsor-renewal.js` (25.19) - `checkSponsorRenewalOffer()` from `tickContractDurations()` when the main sponsor has `SPONSOR_RENEWAL_LEAD` (6) matchdays left: `game.sponsorRenewal` with base/win bonus × (0.8 + loyalty/250) × league factor change since `game.sponsor.signedLevel`; accept (+34 matchdays, loyalty +5), haggle once (+10 % with chance = loyalty, else withdrawn), decline; no offer below loyalty 20. Box `#sponsor-renewal-box`; the bot accepts.
- Squad planning: `js/squadplanning.js` (screen-squad-planning) - positions/age/contract cliffs plus the wage outlook `getSquadPlanningWageOutlook()` (#squad-planning-wage-box, 25.17): expiring wages, cost of renewing the expiring starters, pre-contracts vs the expected next budget.
- Contracts: `p.contracts` = remaining years (counted down in season-end.js); extensions are salary talks via `getContractDemand(p)` (sign-on fee `CONTRACT_HANDGELD_MATCHDAYS` 4 matchday wages per contract year since 25.20 - 5 % of the market value per year cost a Bundesliga club 12-35 M€ per season; the wage check `contractWageTotalWith()` counts, for an expiring contract, only the players who stay - 25.18) (manual talk, sport director and ultimatum all use it; playtime promises checked in `checkPlaytimePromises()`), release clauses in `js/contracts.js`, ultimatums in `js/contract-ultimatum.js`. Wages are `p.wage` per matchday (there is no `p.salary`). Agents are `p.agent` (fee via `getAgentFee()`).
- Scouting: the regional network in `js/scouting.js`. Opponent prediction: `js/match-scout.js` (uses `simulateGoals` on real fixtures).
- Board: `game.boardSat`, explained per member in `js/board-room.js`. Trust never drops below 10 (the board can be angry, not gone for good); sacking is only checked at season end (`checkSeasonEndSacking()` in js/match-post.js) and not when the trust has risen over the last 6 league matches (`game.boardSatVerlauf`) or the season goal was reached (`checkSeasonEndSacking(myRank)`: rank 1-2 or `seasonExpectation.expectedRank` - 25.12 long run sacked a 3. Liga champion after two relegations). After a relegation the expectation is at least rank `RELEGATION_EXPECTED_RANK` 3 for one season (`game.relegatedIntoSeason`, 25.20 - the strongest XI always meant 'rank 1', a relegated favourite was sacked after rank 8); `grantRelegationRestart()` lifts it to at least 60 once - not after a second relegation in a row (`game.boardRestartSeason`). The per-match shift is expectation-based (`getOwnMatchExpectation()` in js/match.js: favorite/open/underdog by opponent strength vs. own XI, ±4 = open) - a flat win/loss shift sank mid-table clubs to ~5 in the 20-season test.
- Locker room: ONE council (`js/team-council.js`: captain + 2 by `getLeadershipScore()`, concerns, `getCouncilMoraleStabilizer()` used by calcTeamStrength and the post-defeat morale) - the old second "Führungsspieler-Rat" in campus-staff.js is gone. `js/locker-room.js`: status (`getLockerRoomStatus()`), cliques by nation+age (`computeSquadCliques()`, mood < 40 = rumort: strength malus in `getCliqueChemistryModifier()`, monthly `tickLockerRoom()` drags the rest down unless a captain with authority), council concerns `clique`/`kapitaen` via `findLockerRoomConcern()`, captain changes only through `handleCaptainChange()` (select in `assignRoles()` and the council), unhappy key players visit the office (`pickUnhappyVisitor()` → `OFFICE_VISITOR_UNHAPPY` in js/office-events.js: playtime promise / demand performance / allow transfer = `triggerNewAITransferOffer(p)`).
- Fans: `js/fans.js` (`game.fans`, fan actions/groups). Training: `js/training.js` + minigames in `js/training-games.js`. Stadium: `js/stadium.js` (blocks/capacity) + `js/stadium-events.js`.
- DFB-Pokal field: `buildDfbPokalTeams()` in js/cup.js - 32 real clubs (`DFB_POKAL_QUOTEN` 18 Bundesliga / 8 2. Liga / 4 3. Liga / 2 Regionalliga, own club takes a slot of its league), every match uses `getOpponentStrength()` (21.6: before, 31 invented clubs with a flat 75 let a mid-table Bundesliga club win three cups in a row).
- Cup and league share a matchday: the cup tie is played live first, then `finishMatch()` (match-post.js) starts the league match of the same matchday ('Weiter zum Ligaspiel'); the calendar (`renderCalendarView()` in js/calendar.js) lists the cup/Landespokal/Europe tie together with '⚽ Ligaspiel' (25.23, it showed only the cup before, so the league game looked missing). 25.24: `getUpcomingOwnTie(md)` / `getOwnCupTieOn(md)` / `istImDfbPokal()` / `getOwnEuropeGroupStanding()` in js/cup-live.js feed the calendar (opponent per tie, DFB only when the club is in the cup, group standing) and the dashboard (`renderDashboardView()` shows the cup opponent and the cup title on a cup day until the tie is played). Board early warning: `checkJobSecurity()` (match-post.js) sends one inbox message per season when `game.boardSat < 50`, or below 60 after three falls in a row (`game.boardSatVerlauf`, 25.26); it also writes an autosave at once (`writeAutoSaveNow()` in save.js, the cadence stays `maybeAutoSave()`) and the dashboard shows the warning with its way out in `#dash-board-warn-line` (`renderDashBoardWarnLine()`, until trust is 60 again). Measured with 5 passive bot runs: first warning in seasons 2-8, lead before dismissal 0-2 seasons (5 runs each side, small sample). Calendar labels switch with `setLanguage()`. Lexicon entry 'Tastatur und Fokus' (cat Bedienung) describes the focus behaviour. The generic overlays (`.generic-modal-overlay`) get focus handling in js/ui-core.js (`initModalFocus()`, 25.25): focus moves in on open, Tab stays inside, focus returns to the opener on close (watched via the `show` class).
- Cup matches live: `js/cup-live.js` - on a cup matchday `startMatchdayFlow()` first plays the own DFB-Pokal/Landespokal/Champions-Cup tie in the live engine (relegation legs via `startRelegationLive()`); the result goes to `game.liveCupResult` and the competitions take it via `takeLiveCupResult(comp, home, away)` instead of `simulateGoals`.
- Season events: `js/season-events.js` (season opening at matchday 1, Hallenturnier invite after md 15 / played after md 17 via `tickSeasonEvents()`, farewell matches from `registerFarewellMatch()`, Supercup prepared in `prepareSupercup()` before leagues advance and resolved in `resolveSupercup()`); all shown in `#dash-season-events-box`.
- AI clubs: `js/ai-clubs.js` - every AI team has `team.star`; `tickAiTransfers()` (matchdays 2 and 19, via `tickTransferWindows()`) moves stars to top clubs with strength moving along (zero-sum), news in `game.aiTransferNews`; `ageAiStars()` at season end.
- Player stats: `js/player-stats.js` - every own goal goes through `creditOwnGoal()` (scorer + 75 % assist, live and simulated); `gradeOwnMatch()` in `processPostMatchRoutine()` gives Kicker grades (`p.statsSeason`, `p.lastGrade`, Elf des Spieltags <= 1.5); cup matches reset `matchEvents` so they don't count for league grades.
- Onboarding: `js/onboarding.js` - "Erste Schritte" checklist (`game.onboarding`, `#dash-onboarding-box`, first season only) ticks off via `onScreenShown()` in `showScreen()` (ignored while `runStructuralSelfTest()` visits every screen at boot) and `markOnboardingStep('speichern')` in `saveGameToSlot()`; per-screen tips in `SCREEN_HINTS`. Tutorial texts in js/i18n.js use `{CLUB}`/`{LIGA}`.
- Buying from the market: `js/transfer-poker.js` - every market player gets a real AI seller (`ensureTransferTerms()`: `p.sellerClub`, `p.askingPrice`, hidden `p.sellerMinimum`); the poker (`openTransferPoker()`/`submitPokerOffer()`) has limited patience, lowballs cost double, a rival can raise the floor and snatch the player, then a wage talk (`haggleWage()`). `buyPlayer()` is the instant buy at the asking price; both end in `finalizePlayerPurchase(p, ablose, gehalt, tauschId)` (all budget checks). Swap deals (25.20): after the fee is agreed `setPokerSwap(id)` picks an own player (`isSwapCandidate()`: <= 30, healthy, at least `getSwapClubMinimum()` = seller club strength - `SWAP_CLUB_GAP` 4 (25.22, before 10 below the market player: the bot swapped up to 12 squad players per season), squad > 17) credited at `SWAP_VALUE_SHARE` 85 % of his market value (`getSwapValue()`); cash and the wage check only see the rest, the transfer budget is charged like a sale (`bar` + 15 % of the credit = 85 % of the credit flows back, as in `completeOfferSale()`) and his agent gets a fee on the credit (25.21 - before the full credit without fee made a swap better for the budget than any sale; injured players are no candidates), the player leaves with the usual departure hooks.
- Medical check: `js/medical-check.js` - every market player gets a hidden `p.medical` (`ensureMedicalProfile()`: ok / chronisch / verletzt, older players more often chronic); `runMedicalCheck()` only in the transfer poker AFTER the fee is agreed (3 % of the fee, half with the physio, min 1,500 €; a finding lowers `t.agreedFee`, `p.askingPrice` and `p.sellerMinimum`: chronic -20 %, injured -15 %). `applyMedicalOnArrival()` in `finalizePlayerPurchase()` makes it real (the instant buy is blind): chronic → `p.chronicIssue` (x1.5 via `getChronicInjuryFactor()` in the post-match injury roll and `getPlayerInjuryRiskIndex()`) + `p.timesInjured`, injured → `p.injured`; unchecked findings send an inbox message. Tags via `getMedicalTag()` (market list, poker), `describeMedical()` in the player popup.
- Pre-contracts: `js/pre-contracts.js` - from matchday 18 `ensurePreContractPool()` creates 4 AI players with expiring contracts per season (`game.preContractPool`, box `#precontract-box` in the transfer tab "Vereinslose"); `offerPreContract(id, 'normal'|'doppelt')`: no fee, sign-on 12/24 matchday wages paid now, wage +20 %, one try per player (`getPreContractChance()`), max 3 pending in `game.preContracts`, wage check against next season (`getNextSeasonWageTotal()`); they join via `joinPreContractPlayers()` in `concludeSeasonAndAdvance()` after aging (dropped after a club change). `tickPreContracts()` per matchday: rivals take waiting candidates (8 %), own last-year players (>= median) get `p.preContractOffer` (deadline +3, `getContractDemand()` +15 %); missed → `p.preContractSigned` (extension blocked, leaves at season end).
- Pro loans: `js/pro-loans.js` (25.20) - in a transfer window `loanOutProPlayer(id, btn)` (button in the sell list, box `#pro-loans-box`) loans a first-team player until season end to an AI club of the own or next-lower league (`getProLoanTerms()`: club pays 40-100 % of the wage), stored in `loanedPlayers` with `proLoan: true`; `tickLoanedPlayers()` (secondteam.js) calls `tickProLoan()`: own share booked as '🔁 Leihspieler-Gehalt', return after md 34 (morale +5, <= 23 +1 via `grantTrainingStrength`). The player is out of `squad`, so the wage budget ignores him; max 3, at least 16 stay; the second-team loan list skips pro loans. 25.21: no injured players, open `incomingOffers` for him are dropped, `switchToClub()` clears `loanedPlayers`/`incomingLoans`/`incomingOffers` (they belonged to the old club - a pro loan used to return to the new squad). The squad planner's wage box lists the 3 most expensive non-starters when over budget (`getWageReliefCandidates()`: <= 25 loan via `getProLoanTerms()`, else sell).
- Selling offers: every way to accept an incoming offer goes through `completeOfferSale(offerId, betrag)` in js/transfermarket.js (squad minimum, chemistry check, negotiator perk, agent fee, departure hooks); variants: `acceptTransferOffer`, `acceptTransferOfferWithClause` (15 % sell-on, 6 % less now), `acceptTransferOfferWithBuyback` (js/buyback.js: players <= 25, 10 % less now, buy-back for 140 % until the end of season+2 in `game.buybackOptions`; `tickBuybackOptions()` before `game.season++` develops/ages the player and expires options; `exerciseBuyback()` only in a transfer window, box `#buyback-box` in the sell tab).
- Rumours: `js/rumors.js` - `tickRumors()` per matchday (after `tickPreContracts()`) resolves due rumours and adds one (30 %, max 3 open) to `game.rumors`; sources `RUMOR_SOURCES` with a hidden truth rate (boulevard 0.3, blog 0.5, fach 0.75), hits/misses in `game.rumorStats`. 'abwerbung' (own player): if true, `resolveRumor()` sends a real offer via `triggerNewAITransferOffer(p, {club, multiplier})`; `reactToRumor(id, 'dementieren'|'anheizen'|'schweigen')`: deny = club backs off 50 % if true, morale +3 (Ehrgeizig/Selbstbewusst -5); hype = offer +15 %, morale -3, media -2 on a fake. 'markt': if true the market player is gone after 2 matchdays. Box `#rumor-box` in the transfer tab Angebote.
- Transfer strategy: `js/transfer-strategy.js` - card `#dash-transfer-strategy-box` until matchday 3, one choice per season in `game.transferStrategy` via `chooseTransferStrategy('jugend'|'sofort'|'sparen'|'ausgewogen')` (`TRANSFER_STRATEGIES`: transfer budget ±share of `getLeagueTransferBudget()`, `expectedRank` shift; 'jugend' halves `getYouthScoutCost()`), `tickTransferStrategy()` after `game.matchday++` sets 'ausgewogen' when missed, `resolveTransferStrategy(myRank)` after `resolveWinterTalk()` (jugend: `STRATEGY_YOUTH_PLAYERS` 3 academy graduates with 10+ league games +6/fans +3 else -6 - with 2 the Bundesliga bot hit it in 12 of 18 seasons; sofort: goal reached +5 else -8; sparen: `ffpSeasonNet` >= 0 +5 else -6).
- DFB licence (25.20): `checkDfbLicensingStatus()` (js/stadium.js) counts running constructions for capacity, floodlight and internat (`getLicenceBuildsInProgress()`, returned as `auflagen`) - the grace period is 3 matchdays, every build takes 10+, so a promoted 2. Liga runner-up without internat level 2 lost promotion and went down the next season; the season-end promotion check uses the same function (only the cash reserve must really be there). AI relegated clubs adjust with `AI_RELEGATED_ADJUST` 0.55 instead of 0.4 in `evolveAiTeamStrength()` (ex-Bundesliga clubs at 80+ crowded the top of the 2. Liga).
- Promotion boost: `js/promotion-boost.js` - AI promoted clubs gain ~4 strength in `evolveAiTeamStrength()`, our club came up ~7 below the new league average and went straight back down (bot: 2. Liga with 8 and 18 points). `applyPromotionRewards()` calls `markPromotionBoost()` (`game.promotionBoost` {level, season}, plus the TV advance `payPromotionTvAdvance()` in js/media-rights.js: 25 % of the new league's TV base at once - Bundesliga 16 M€ - in `game.tvAdvance`, deducted from each TV instalment via `getTvAdvanceDeduction()` in `applyMatchdayFinances()`, rest settled by `settleTvAdvanceAtSeasonEnd()`; 25.22: a promoted club arrived with ~15 M€ cash and could not spend its 33 M€ transfer budget on 20-40 M€ Bundesliga players): transfer budget +`getPromotionTransferBonus()` (50 % of the new league budget, added after the season-end budgets or directly in the DFB grace period) and `getPromotionEuphoriaBonus()` (+3 strength until md 10, +1.5 until md 17) in `getOwnLeagueMatchStrength()` and live via `applyPromotionEuphoriaLive()` in `setupMatch()`. Bot after 25.18: promoted to 2. Liga 26-33 points (1 of 3 straight down), Bundesliga 35-48.
- Winter board talk: `js/winter-talk.js` - card `#dash-winter-talk-box` while `game.matchday` is 18-20 (`isWinterTalkOpen()`), one choice per season in `game.winterTalk` via `chooseWinterTalk('hoch'|'runter'|'budget'|'kurs')`: hoch/runter move `game.seasonExpectation.expectedRank` by 2 (so the member assembly and the sport board member judge against the new goal), hoch +5 board and `getWinterBudgetAmount()` (30 % of `getLeagueTransferBudget()`, `WINTER_BUDGET_SHARE` - 25.16, the old fixed amounts were 8 % of the new Bundesliga budget and 62 % in Liga 6) now, settled by `resolveWinterTalk(myRank)` before `prepareMemberAssembly()` (+5 / -10); budget chance `getWinterBudgetChance()` from rank vs expectation and boardSat (refusal -3); kurs +2. `tickWinterTalk()` right after `game.matchday++`: missed after md 20 → -2.
- Player career profile: `js/player-profile.js` - `renderPlayerProfile(p)` in the player popup (`#pd-career-progression`, replaces the old short `renderPlayerCareerPanel`): join info `p.joined` {season, via, from, fee} set by `stampPlayerJoin()` at every way into the squad (finalizePlayerPurchase, signFreeAgent, loan buy option, joinPreContractPlayers, exerciseBuyback (overwrites), signYouthProContract, reserve promotion), season rows from `p.strengthHistory` (now also `elf` from `resetPlayerSeasonStats()`) plus the running season, honours `p.honours` via `addPlayerHonour()`/`addSquadHonour()` (champion + player of the season in `recordSeasonHonours(myRank)` before `prepareMemberAssembly()`, promotion in `applyPromotionRewards()`, cup wins in `recordCupFinal()`, player of the month). `isClubLegend()` (>= 150 apps or 6 seasons): `checkLegendDeparture()` from `checkCrowdFavoriteDeparture()` (every departure) costs fans 8 and board 2.
- Club geography & regional leagues: `js/club-geo.js` - every club has a real city (`getClubCity(name)`; names stay minimally altered). Leagues 1-3 are national (`TOP_LEAGUE_CLUB_NAMES` in entities.js); leagues 4-6 come from the home region of `game.homeCity` (`HOME_CITIES`: state, region, Oberliga key, 6th-tier key, Landesverband): `REGIONALLIGA_CLUBS` (5 regions × 18 real clubs), `OBERLIGEN` (real clubs, filled from `REGION_TOWNS`), `LIGA6` (Sachsenliga real, else clubs from real towns via `buildTownClubs()`). `getLeagueClubPool(level)` / `generateTeamName(level)` take real clubs first (`getRegionalRealCount()`). `applyHomeRegion()` sets `leagueNames[3..5]` and `landesPokal.region` (window.onload and every load in save.js; old saves without homeCity → `ensureHomeCity()` = Leipzig/Nordost). New-game dialog: `#new-game-city-box`, sessionStorage `anstoss_fm13_newgame_city` (default club name follows the city). A club switch keeps the home region.
- Tactic duel: `js/opponent-tactics.js` - rock-paper-scissors of archetypes (Pressing > Ballbesitz > Konter > Pressing, ±2 strength, `getTacticMatchupBonus()`), league matches only. AI coaches read `game.recentTacticStyles` (recorded after each own league match) and counter a predictable manager (3 of 5); the plan is fixed per matchday in `game.oppTacticPlan` (`getOppTacticPlan()`), used by the live engine (current style each step), the matchday simulation and match-scout via `getOwnLeagueMatchStrength()`; shown in `#prematch-tactic-box` (full plan only with the analyst).
- Opponent preparation: `js/match-prep.js` - the 'matchprep' team focus (formerly a flat +1, dominated by 'taktik' +2) now needs a target style for the next league opponent (`setMatchPrepTarget(arch)`, `game.matchPrep` stamped with season/matchday): +2.5 when it matches `getOppTacticPlan(opp).arch`, else 0; added in `getOwnLeagueMatchStrength()` and live via `applyMatchPrepLive()` in `setupMatch()` (league only). UI `#matchprep-target-box` in the training screen; the fitness coach's 'auto-matchprep' task calls `autoSetMatchPrepTarget()` (public base style).
- Set pieces (live only): `js/set-pieces.js` - `rollLiveSetPiece()` in `simulateMatchStep()` (before the goal roll, not after minute 88) starts an own penalty (shooter choice via `getPenaltyCandidates()`/`getLivePenaltyChance()`) or a free kick (`getFreeKickOptions()`: direkt/flanke/kurz) and pauses like the halftime talk (`currentMatch.awaitingSetPiece`, `#setpiece-overlay`); `simulateRestOfMatch()` auto-resolves via `resolveSetPiece(null, true)`. Opponent penalties and VAR (`varOverturnsGoal()`) need no decision. Goals with a fixed scorer go through `creditOwnGoal(players, scorer, assist)`. Shootouts: keeper choice in the shooter modal (`chooseShootoutKeeper()`, bench keeper costs a substitution), `getShootoutKeeperModifier()` in `simulatePenaltyShootout()`. Measured over 400 live matches: goals per match unchanged (1.10:0.76 vs 1.12:0.72).
- Set-piece drills: `js/set-piece-drills.js` - 'standards' is a real weekly plan unit (the presets already wrote it before it existed; `computeWeeklyTrainingStats()` maps a standards-dominant week to 'ausgeglichen'); `game.setPieceDrills` {focus, mastery 0-100 per direkt/flanke/kurz/elfmeter/ecke}, `tickSetPieceDrills()` per matchday in `processPostMatchRoutine()` (+10 per standards day for the focus, x1.5 with the set-piece coach, others -2); `getDrillMastery()` used in set-pieces.js (penalty +6 %, free kick options, flank counter risk halved) and the corner line in `simulateMatchStep()`. Box `#setpiece-drill-box` in the training screen.
- Referee critique: `js/referee-critique.js` - the live match records disputed scenes in `currentMatch.controversies` via `noteRefereeControversy()` (own red card in the card branch, opponent penalty in `playOpponentPenalty()`, own goal overturned by VAR); `offerRefereeCritique()` in `endMatchSimulation()` (before the cup early return) shows `#ref-critique-box` only without a win: kritik (fine by league `REF_CRITIQUE_FINES`, doubled per critique in `game.refCritiques` season, fans +3, media -2, `game.refereeGrudges[refId]` = 2), beschwerde (fee, 35 % lifts a red-card ban, else board +1), schweigen (board +2, fans -1); one choice per match (`currentMatch.critiquePending`), log `game.refereeCritiqueLog` shown in `renderRefereePreview()` via `getRefereeGrudgeNote()`. `applyRefereeGrudge()` in `setupMatch()` makes that referee's `cardMult` x1.2 for the next 2 own matches under him.
- Co-trainer live: `js/co-trainer-live.js` - `tickCoTrainerLive()` at the end of `simulateMatchStep()` picks ONE hint from the real match state (`findCoTrainerHint()`: level 1 tired starter/late deficit/late 1-goal lead, level 2 + second-yellow risk/lost tactic duel, level 3 + winnable duel; each type once per match, 15-minute gap, reliability = `getStaffEffectivenessMultiplier('coTrainer')`), shown in `#live-cotrainer-box` (sticky above the controls on phones); actions use the normal live functions (`coTrainerSubstitute()` → `makeLiveSubstitution()`, `liveSetTackleHardness`, `liveSetTacticStyle`, `setLiveShout`). Counts in `game.coTrainerHistory.liveFollowed/liveIgnored`, following raises `game.coTrainerTrust`. 25.25: per live match `recordLiveCoTrainerMatch(result, currentMatch)` (called in `processPostMatchRoutine()` when live) fills `liveMatchesFollowed/liveFollowedWins` (match with a followed hint) and `liveMatchesOwn/liveOwnWins` (without); `coTrainerLiveBilanzText(h)` shows it in the co-trainer box. Hints are rare: `scripts/cotrainer-live.js [spiele] [datei] [fitness]` (module: `messeLiveSpiele`, `zusammenfassung`, also run by the bot with `COTRAINER=<n>`) measured hints in about 1-2 % of simulated matches (rueckstand after minute 70 is the usual one). The fatigue hint (`muede`) needs a bench player at least `COTRAINER_MUEDE_ERSATZ` (0.85, was 0.95 - then almost never) of the tired starter's strength: 2 -> 20 hints per 1000 matches at fitness 65. Between minutes, the box shows how many hints were given since kick-off (`renderCoTrainerLiveBox()`, 25.26). Following vs ignoring cannot be told apart at a few hundred matches; at 5000 matches (fitness 65) 31.3 % wins for following against 31.6 % for ignoring. Hint 'druck' (25.26): at minute 60+ with an opponent at least 4 shots ahead it offers 'Bus parken'. The opponent's plan is fixed before kickoff - never invent an "opponent switches" hint. 25.33 decision: the hints stay although following them shows no win-rate effect - they are shortcuts to real live actions, not a bonus.
- Pre-match team talk: `js/pregame-talk.js` - `#prematch-talk-box` (rendered in `startMatchdayFlow()` and `startCupLiveFlow()`), `choosePregameTalk(type)` stores `game.pregameTalk` for this matchday; `computePregameTalkBonus()` = situation (`getPregameSituation()` from own XI vs `pendingMatchInfo.oppStr`) + starting XI characters (`p.character`), halved when the same talk was used twice in a row (`game.pregameTalkHistory`); applied once in `setupMatch()` via `applyPregameTalk()` (live and "Nur Ergebnis", league and cup), 'druck' settled in `endMatchSimulation()` via `resolvePregameTalk()` (win morale +3, loss -4).
- Cup finals: `js/cup-final.js` - DFB-Pokal and Landespokal final (`getUpcomingOwnFinal()`), "Finalwoche" card `#dash-cup-final-box` from 3 matchdays before (tickets fans/sponsors, trains, camp → `getCupFinalBonus(comp)`, only on the final matchday; live via `applyCupFinalPreparation()` in `markCupLiveMatch()`, simulated via the strength lines in cup.js/landescup.js), `recordCupFinal()` from the round finalizers writes `game.cupFinals` (Historie > Titel) and opens the celebration choice (`chooseCupCelebration()`). Dashboard cards are not redrawn by `updateUI()` - every card action re-renders its own card.
- Derby week: `js/derby-week.js` - `isDerbyOpponent(name)` is the ONE derby check for the own club (place-based, see Derbys); card `#dash-derby-box` from 3 matchdays before (`getUpcomingDerby()`, state `game.derbyWeek`: choreo/special train, security (home only), premium (morale +5, paid only on a win), press kampf/respekt). `getDerbyBonus(opp)` only on the derby matchday (simulation via `getOwnLeagueMatchStrength()`, live via `applyDerbyPreparation()` after the ticker is initialised in `setupMatch()`), `getDerbyRiskFactor()` in `checkHooliganIncident()`, `resolveDerbyWeek()` from `recordRivalryResult()` (all three matchday paths) → `game.derbyHistory` (Historie > Rivalen). The old test leftover `forceDerbyMatchdays` (first 3 matchdays of every career were derbies) is gone.
- Derbys: `isDerbyMatch(a, b)` in js/club-geo.js is THE derby rule (Phase 24.2): same locality (`getClubLocality()`: city, or the district for generated district clubs in Berlin/Hamburg/Bremen) or a real tradition pair in `TRADITION_DERBIES` (`getDerbyLabel()`); within a league only the `DERBY_LOCAL_CAP` (3) strongest same-locality clubs count (`getLocalDerbyCircle()`), otherwise big-city leagues were all derbies. `isDerbyOpponent(name)` (derby-week.js) = `isDerbyMatch(game.clubName, name)`; used by live/sim/admin matchday paths, league fixtures, media, training, league stats, shootout 'Nervenkrieg'. There is NO permanent rival, NO random `rivalName` pairs and NO nemesis coach any more (all removed in 24.2/24.3; `cleanupRemovedModuleState()` deletes `permanentRivalName`, `rivalManager*`, `rivalHistoryArchive`, `nemesis` and team `rivalName`). `rivalryRecord` = derby record over all derby opponents (`matches[].opp`), filled by `recordRivalryResult()`; `getOwnDerbyRivals()` feeds Historie > Rivalen and the derby friendly (`scheduleDerbyFriendly()`).
- Champions Cup: `js/europe.js` - qualification only for the next season via `decideEuropeQualification(myRank)` in `concludeSeasonAndAdvance()` (Bundesliga rank 1-4 or `game.europeCupTicket === game.season` from the DFB-Pokal win; formerly `game.inEurope` was never reset, even after relegation). `initEuropeCup()` draws from `EUROPE_POTS` (4 pots, strength `EUROPE_POT_STRENGTH` around the average of the 4 strongest other Bundesliga clubs - 21.6: anchored to the squad average the elite was weaker than the Bundesliga's third and a passive club won the title twice in a row), one per pot per group, plus the strongest other Bundesliga club (its `team.strength`) in the other group; own pot from `getEuropePot()`; group home/away via `getEuropeGroupPairings(grp, gi)` (also used by `getOwnEuropeFixture()` in cup-live.js - before 25.20 the return round kept the home side, so pot 1 played six home games and a pot-4 newcomer six away: group survival at Bundesliga-top strength 40 % → now 49 %) (coefficient `getEuropeCoefficient()` over the last 5 seasons of `game.europeHistory`, written by `recordEuropeSeason()` before the new qualification). Box `#europe-history-box`.
- Transfer windows: matchday-based (summer 1-3, winter 18-20) with `runDeadlineDay()` in `js/transfermarket.js`, driven by `tickTransferWindows()` after every matchday.
- Season end extras: `js/relegation.js` (own club on rank 3/16, legs on the dashboard, auto-resolved in `concludeSeasonAndAdvance()`), `js/league-awards.js` (`game.leagueAwards`), `js/coach-carousel.js` (AI `team.coach`, temporary `team.coachBounce` - removed via `tickCoachBounce(true)` before leagues advance).
- League statistics: `js/league-stats.js` (tab "Statistik" on the league screen: league-wide scorer list from `getLeagueScorers()` - own `p.goalsSeason` plus AI `team.star`/`team.striker` goals credited by `creditAiLeagueGoals()` in js/ai-clubs.js -, form table, home/away table `t.homeRec`/`t.awayRec`, rank history `t.rankHist`). The league screen views `getLeagueViewLevel()`; never change `game.leagueLevel` from UI buttons. The Torjägerkanone (league-awards.js) uses the same scorer list.
- Statistics: manager career in `game.managerCareer` (js/manager-analytics.js), Hall of Fame computed from squad + `game.playerRetirement` + `game.managerCareer` (js/hall-of-fame.js). Loans: `js/secondteam.js` / transfermarket loans only (incoming loans check transfer budget for the fee and the wage budget since 25.17 - before only the cash, a loan bypassed both budgets).
- Holding: `js/holding.js` - `getHoldingValuation()` (50k + 80 % of the factory investment; the old fixed `holdingCompany.valuation` is gone) feeds the screen and the acquisition offers in js/industry.js (only with an owned factory); `refreshB2BContracts()` after `game.season++` adds one contract per owned factory (payout ~3x material cost). The pre-match analysis (`renderPreMatchAnalysis()`) shows the real `team.star` and, for derby/cup only, the base style from `getTeamPlaystyle()` - never random names or tips in render functions.
- Side income: stock `dividendRate` is an annual rate (paid monthly as rate/8.5); betting odds come from `simulateBetProbabilities()` (same `simulateGoals` as matches) using the best available XI (`pickBestLineupIds()`), no bets on own defeat; real estate income grows with cumulative cost (~10 seasons payback). Measure new income sources before adding them - several were money machines. Long-run bot: `node scripts/longrun-bundesliga.js [seasons] [aktiv|passiv] [runs] [file]` (start league `LIGA=0..5`; DIAG=1 lists refused actions, open licence items and inbox per season, FINDIAG=1 bookings by label, STRDIAG=1 the matchday strength split, BOARDDIAG=1 board changes by function). The aktiv bot extends contracts (keeps >= 18 players), fills thin positions with youth/free agents, answers ultimatums, holds the member assembly and plans the DFB licence of the next league as a promotion candidate (rank <= 6 or XI >= league average: floodlight, internat, cheapest seats per block - builds take >= 10 matchdays, the grace period only 3) while holding that money back in transfer windows; it accepts the sponsor offers that arrive (best value, sector conflict -30 %) and sells the naming rights once; since 25.17 it scouts up to 2 talents on matchdays 1 and 18 (cash above the licence reserve), sells talents whose potential is below the squad median when an offer arrives (with sell-on, TV column = revenue), prints LIZENZ-SPERRE only when a promotion place was blocked by the licence (before 'Liz-offen' counted the next league after every promotion), promotes youth at squad-median strength, sells the weakest non-starters above 24 players and the most expensive non-starters while over the wage budget, and prints K/V (buys/sales), L/T (pro loans for over-budget players <= 25 instead of a sale, swaps of the weakest fitting non-starter when buying with >= 22 players - 25.21), E (board expected rank) and J (own youth in XI/squad) per season. Start time: `node scripts/measure-startup.js`.
- Career balance (Phase 16, measured with an active-manager bot over 10-14 seasons: Liga 6 -> 2. Liga in 6-9 seasons, passive clubs sink; 25.13 after the home/trait/live changes: Liga 6 -> 2. Liga in 10 seasons, Liga 4 -> 2. Liga in 4, passive clubs end in Liga 6; 25.19 (promotion boost, youth, relegation parachute; 4 runs × 14 seasons): Liga 6 -> 2. Liga in 9-13 seasons, then mid-table in the 2. Liga, no Bundesliga promotion within 14 seasons; 25.23 (captain on the pitch, switch-season grace, TV advance/DFB grace test, youth gaps 10/16/22 relative to the league base at every level - no league anomaly, lexicon search ignoring hyphens/spaces); 25.22 (TV advance, youth offsets; 6 runs from the 3. Liga/2. Liga): 5 of 8 Bundesliga promotions stayed up in the first season (before the 25.21 reserve change 1 of 4); 25.21 (training cap, licence conditions, pro loans/swaps; 6 runs × 14 from Liga 6, 5 runs × 12 from the 3. Liga): Liga 6 -> 2. Liga in 8-12 seasons (1 of 6 stuck in the 3. Liga), from the 3. Liga to the Bundesliga in 8-10 seasons, Bundesliga newcomers 77-80 vs league average 84-88; cups over ~350 bot seasons: DFB-Pokal ~4 % per Bundesliga season, never from 2./3. Liga, Landespokal 28 % in Liga 4; Champions Cup group at field strength 51 %, title 9 %): starters recover a quarter of the bench recovery between matchdays; the market has 10 players and refreshes at the winter window; licence items scale with the league (`getSpecialInstallCost()`, campus via `getStadiumCostScale()`). Promotion walls must stay affordable for a club of that league (19.6, 20 seasons: a 2. Liga club grosses ~15 M€/season, so the 1. Liga licence needs 15,000 seats like the DFL - 20,000 cost a climber from the 15,550 start stadium ~25 M€ with the internat).
- Budgets at season end (season-end.js): league/placement formula (transfer budget = `getLeagueTransferBudget(level)` from `LEAGUE_TRANSFER_BUDGET` in js/squad.js: 25 M / 3 M / 900k / 250k / 60k / 40k per season ≈ 1-3.5x a typical reinforcement of that league (40 M / 2.4 M / 470k / 85k / 18k / 18k) - 25.15: before 2.5 M × (1 + league factor × 2.5), 3.5-5.6 M€ in leagues 4-6 but only 8.75 M€ in the Bundesliga; wage budget = `getLeagueWageBudget(level)` from `LEAGUE_WAGE_BUDGET` in js/squad.js: 1.575 M / 520k / 110k / 36k / 11k / 8k per matchday ≈ 1.35-2x the start squad wages of that league, × placement 1.3/1.0/0.8 - 25.14: before it was 450k × (1 + league factor × 2.5), 637,500 € in Liga 6 with 4,000 € wages, so it never limited anything below the Bundesliga; new game, club switch and season end all use it; on relegation `applyRelegationWageClause()` cuts every wage by `RELEGATION_WAGE_CUT` (40 % since 25.19, was 30 %; min 150 €, morale -3, inbox) and `payRelegationParachute()` (js/media-rights.js) books 25 % of the old league's TV base once (Bundesliga 16 M€ - with 30 % and no parachute a relegated Bundesliga club carried 53 M€ wages against ~35 M€ 2. Liga income: 62 M€ forced sales, emergency squad) and the first budget covers at least `RELEGATION_BUDGET_SHARE` (90 %) of the cut wages - without it a relegated Bundesliga squad (1.36 M€) could not extend a single contract under the 2. Liga budget), wage budget never below `getWageBudgetFloor()` (25.18: current wage bill plus `getRenewalWageBuffer()`, +5 % only after a season without loss; from `WAGE_FLOOR_GROWTH_CAP` (1.5) × the league wage budget frozen at the bill, the renewal buffer only with half a season of wages in cash (25.19: the raises drove strong Bundesliga squads to 3-4 M€ per matchday and -18 M€ cash; frozen without the cash exception a club with 106 M€ fell into the emergency squad); with negative cash frozen at the bill without buffer (25.19 - 95 % let 0.7 M€ in the red plus a 17-man squad end in the emergency squad) - the old unconditional +5 % let a Bundesliga bot climb from 1.6 to 2.8 M€ per matchday, lose 27 M€ and drop into the emergency squad once the floor vanished at negative cash; freezing the bill after a loss season was tried and failed when half the squad expired at once; `contractWageTotalWith()` ignores the other expiring players. Before 25.18: +5 %, after a loss season +0 %, plus `getRenewalWageBuffer()` = the raises `getContractDemand()` asks from players whose contract runs out in the new season (`contracts === 2` before the countdown); no floor only while the cash is negative - 21.6 long run: the formula put a Bundesliga mid-table club at 1.26 M€ with 1.5 M€ wages; 25.17: the old 'cash covers a quarter season' condition (~15 M€ in the Bundesliga) and the 85 % after a loss season still failed every extension in about a third of the Bundesliga seasons (emergency squad), now 3 of 31), plus `applyCashSurplusBudgets()` (21.6 Bundesliga long run: 40 % of the cash above half a season of wages into the transfer budget, 10 %/34 into the wage budget - since 25.21 the reserve is half a season of the real wage bill, at least of half the wage budget: with the full budget a club promoted to the 2. Liga (120k wages, 676k budget, 10 M€ cash) never got anything, stayed 10 below the league average and 3 of 4 bot promotions to the Bundesliga went straight back down - afterwards 1 of 4 - before, a Bundesliga club piled up 200+ M€ with a wage budget below its wage bill). 25.31 Test: 60 % statt 40 % Überschuss ins Transferbudget (Bot-Schalter `KASSE_ANTEIL=0.6`, Liga 6, 6 Läufe × 12 Saisons): nur 3 von 6 Läufen am Ende in der 2. Liga gegen 5 von 6 in der Basis, Elf im Rauschen - nicht übernommen. The Bundesliga market has 3 international stars (87-93, slots 7-9 in `refreshTransferMarket()`). Prize money inside the matchday simulation goes through `bucheMitLabel(label, betrag)` (finances.js) - unlabeled bookings take the label of the open screen (the bot plays from the dashboard: "Vereinsbüro"); 25.19 labelled buys ('🛒 Spielerkauf'), sales ('💸 Spielerverkauf'), contract sign-on fees ('✍️ Handgeld & Berater', 12-35 M€ per Bundesliga season), free agents, sponsor sign-on bonuses, naming rights, sell-on payouts, training compensation and scouting (VBDIAG=1 lists what is still unlabeled); the finance overview shows the expected TV settlement (`getTvSeasonOutlook()`, `#fin-tv-outlook`); new-game/scenario start money is booked as '🏁 Startkapital' (FFP-exempt).
- Sponsor money (25.10): every sponsor income (main, kit, sleeve, boards, naming rights) scales with `getSponsorLeagueFactor()` (`SPONSOR_LEAGUE_FACTOR` in js/sponsors.js: 74/20/6.5/3.2/1/0.75) - `leagueScaleFactor()` (2 … 0.75) stays for costs, ticket prices, media partners and events. Before, sponsors were 0.7 % of a Bundesliga club's income (bot, all slots filled), now ~25 M€/season (~17-25 % per league).
- Operating costs (25.9/25.10): `getOperatingCostPerMatchday()` in js/finances.js (`LEAGUE_OPERATING_COST` per season: 40 M Bundesliga, 5 M 2. Liga, 0.5 M 3. Liga, 0 below; raised with the sponsor money) is booked every matchday in `applyMatchdayFinances()` as '🏢 Spielbetrieb & Verwaltung' and shown in the forecast (`#fin-out-operations`). Before, a Bundesliga club with the start squad made +40-60 M€ per season and passive long-run clubs piled up 200-770 M€; with 20 M an active Bundesliga club holds ~0-40 M€. Emergency squads get at least `EMERGENCY_WAGE_FLOOR` (season-end.js) per matchday - their strength-based wages were 2. Liga level, a passive club lived years in the Bundesliga on 5 M€ wages. The long-run bot's `FINDIAG=1` sums every booking per season by label (journal + Kontoauszug).
- Attendance: `calculateMatchAttendance()` (js/stadium.js) is the only place a home crowd is computed: min(capacity share via `getAttendanceFactor()`, league interest `getLeagueAttendanceCap()` × matchday swing). The swing (weather/form/crowd favourite from `getMatchdayAttendanceMood()`, ticket price elasticity, noise, max 1.12) also applies at the cap - without it lower-league clubs with big stadiums saw exactly the cap every match (6. Liga: always 1,000) and ticket prices had no attendance cost.
- Autosave every 5 matchdays (`maybeAutoSave()`, own key); every save writes `anstoss_fm13_last_save` ('auto' or 'slotN') and the boot loads exactly that one via `loadMostRecentGame()` (formerly always slot 1, so autosaves seemed lost). A failing autosave warns once per session. Tests: `freshPage()` removes that key; each `browser.newPage()` is its own storage context.
- Save safety: `js/save-safety.js` - EVERY load (slots, autosave, import, admin JSON, boot) goes through `loadSaveSafely(raw, {label, backup, silent})`: `validateAndRepairSave()` rejects unusable states BEFORE applying (current game untouched) and repairs small damage (duplicate ids, NaN values, orphan lineup → `autoLineup()`); never call `applyLoadedState()` directly. One backup key (`SAVE_BACKUP_KEY`): current game before a load/new game, old slot content before an overwrite (`restoreSaveBackup()` is reversible). Writes go through `writeSaveVerified()` (blocked vs. quota, read-back check, the backup is dropped first when full); meta from `buildSaveMeta()` (`savedTs`, `version`). Boot: `loadNewestIntactSave()` falls back to the newest intact save. A rejected load says which slot is broken and what stays (`saveLoadHinweis(label)`, 25.25; the autosave names a slot as the way out); the dashboard shows the last autosave in `#dash-autosave-line` (`renderDashAutosaveLine()`, save.js). Usage gauge counts ALL keys (file:// shares the origin); export reminder every 3 seasons (`remindSaveExport()`, `game.lastExportSeason`).
- Save format: `buildSaveState()` packs `fixturesData` as `[home, away, hg, ag]` arrays (`packFixtures()`/`unpackFixtures()` in js/save.js, old object saves still load). There is no structural self-test at boot any more (it cost ~1.5 s on the first start after every update, 4x CPU throttle); `testStructuralSelfTest` covers it and the admin button still runs it.
- Removed modules leave save-game fields behind: add them to `cleanupRemovedModuleState()` in js/state.js (runs on load and monthly). 25.23: eight never-read fields (transferHistory, recentResults, namingRightsHistory, …) left the initial game object and are listed there too.
- Career scenarios: `js/scenarios.js` - `CAREER_SCENARIOS` (absteiger, pleite, tradition, titel) chosen in the new-game dialog (`selectNewGameScenario()`, sessionStorage marker read in window.onload → `applyScenarioStart()`); `recordScenarioSeasonRank(myRank)` before promotion, `evaluateScenarioAtSeasonEnd()` after season change (stars 1-3, `game.scenario`, `game.scenarioResults` shown in the career summary); card `#dash-scenario-box`. Balance measured with a scenario bot (20.6, aktiv/passiv/sparen × 8 runs): active play should usually win, passive mostly fail - pleite counts loans as debt (`getScenarioNetCash()`) and forced sales (`game.forcedSalesCount`, -1 star each, 2 = failed) because forced sales alone used to rescue a passive club with 3 stars; absteiger starts -7 strength (with -5 the 'too weak' squad was the league's strongest before 25.11; -11 after the 25.11 home/trait change saved only 1 of 4 active runs). 25.12 remeasure (6 runs each): absteiger aktiv 4/6 passiv 0/6, tradition (+4 strength, floodlight already built - the licence blocked a 2nd place in the Regionalliga) aktiv 4/6 passiv 1/6, titel (+7, no AI club above own XI +1 in `setup()`) ~50 %, pleite: sparen 3/4, aktiv 1/4, passiv 0/4.
- Club change: `switchToClub()` in js/career.js (25.22: the new board starts at boardSat 60 with `recordSeasonExpectation()` for the new squad and the switch season is a grace season (`game.boardGraceSeason`, checked in `checkSeasonEndSacking()` like season 1 - 25.23, before a switch in season 5 could be sacked at its first season end); buy-back options, transfer poker, 'abwerbung' rumours, derby week, loans and offers of the old club are dropped; the reserve is renamed '<new> II'; stadium/campus/staff/fans/cash travel by design) - used by `showClubSwitchOptions()` and by job offers (`checkJobOfferApproach()` in js/match.js: chance from rank/media/level every 6 matchdays and at season end, offering clubs from own or next-higher league, move recorded in `game.careerStations`). Player retirements: `tickPlayerRetirement()` (js/player-retirement.js), shown in the Hall of Fame.
- National teams: `js/national-team.js` - fixed international breaks after matchdays 6/13/24/30 (`tickInternationalBreak()` in `processPostMatchRoutine()`), nomination by country threshold (`getNominationThreshold()`, good grades lower it); no league match is missed, the trip costs fitness/injury risk and adds caps (`p.caps`, `p.intlGoals`), morale and market value. The club receives release fees via `payReleaseFee()` (booked as "🌍 Abstellungsprämien": 15,000 € per player and break, 10,000/12,000 € per player and tournament day for WC/EC). WC/EC after every even season via `playSummerTournament()` in `concludeSeasonAndAdvance()` (`game.intlTournaments`, `p.intlTitles`). Panel `#national-team-box` in the squad tab Analyse (the Team tab is capped at 3 panels by a test).
- Season preview: `js/season-preview.js` - `createSeasonPreview()` after `recordSeasonExpectationRank()` (own predicted rank = `game.seasonExpectation.expectedRank`, AI teams by strength ±3 noise) in `game.seasonPreview`, card `#dash-season-preview-box` (matchdays 1-8); `buildSeasonExpertCheck(myRank)` before leagues advance writes `game.seasonReviews` (3+ places better: media +3/fans +2, 4+ worse: media -3), shown in the season review overlay and Historie > Chronik. `pickPlayerOfSeason()` (best avg grade, >= 10 league games) is the ONLY player-of-the-season pick (gala, chronicle, review). `showSeasonReviewSummary()` gets a snapshot of the table row (the live row is reset by `advanceLeaguesToNewSeason()`).
- English UI: `js/i18n.js` (`t()` keys: nav, header, office, tutorial) plus `js/i18n-ui.js` (25.20): `I18N_UI_EN` maps exact trimmed German texts (text nodes, title/placeholder) to English; `applyUiTranslation(lang)` from `setLanguage()`/`initLanguage()` translates the DOM and keeps a MutationObserver for new content, 'de' restores the stored originals (`node.__i18nDe`; text changed by the game since then is dropped). The lexicon has its own English version: `LEXICON_EN` in js/lexicon-en.js keyed by the German title (`getLexiconEntryLocalized()` in `renderLexicon()`, `setLanguage()` re-renders it; `testLexiconEnglish` requires every entry with the same tip count and all digits of the German text - change both when a rule changes). Dynamic texts with numbers/names (notices, inbox, match report) stay German; 25.21 added ~170 texts that only modules render (found by scanning every screen in English). Cost: +71 KB minified, switching ~0.1 s at 4x CPU throttle, start time unchanged. New fixed UI texts: add the English to `I18N_UI_EN` (no duplicate keys - lint `no-dupe-keys`).
- One-handed use: `js/one-hand.js` (phone, <= 650 px) - FAB `#one-hand-fab` (`oneHandContinue()` → `startMatchdayFlow()`, hidden on prematch/matchday, right/left/off per device in `anstoss_fm13_ui_fab`), back button via one history guard entry (`initOneHand()`, `handleOneHandBack()`: notice without `danach` → overlay with ✕/close button → office visitor → drawer → previous screen from `recordScreenVisit()` (called at the start of `showScreen()`); decision overlays like the interview stay; a second back on the start screen leaves), backdrop tap closes overlays with ✕, lang/sound buttons move into the drawer (`#one-hand-settings-toggles`). CSS: generic modals and notices are bottom sheets, `#matchday-controls` is sticky above the bottom nav (`--bottom-nav-h`), body padding leaves room for the FAB, bottom nav has 7 items incl. "☰ Menü".
- Game glossary: `js/lexicon.js` - `LEXICON_ENTRIES` (cat, title, text, tips, target screen) on `screen-lexicon` (menu "Karriere & Spezial"; search `#lexicon-search`, category chips, `openLexiconForScreen()` from the per-screen hints filters to one screen). When a rule or number changes, update its entry - `testLexicon` checks the licence capacities against `DFB_LICENSING_REQUIREMENTS`.
- Match balance (25.11): own matches use `getOpponentMatchStrength(str, oppIsHome)` (js/match.js: sabotage + `AI_HOME_ADVANTAGE` 3 when the opponent is at home) in league sim/live/admin, prediction, betting, relegation and the cups/Champions Cup; trait bonuses in `calcTeamStrength()` are capped at `TRAIT_BONUS_CAP` (3). Before, only our club had a home advantage and traits stacked to +5..7: a league-average XI played ~+9 above an equal AI team and won the 3. Liga in 7-9 of 16 starts (now 3 of 16, Bundesliga start median rank 5.5, 4/12 relegated in 3 seasons).
- Live = simulation (25.12): `getExpectedGoals(myStr, oppStr, myTeam, oppTeam)` in js/utils.js is THE goal formula - `simulateGoals()` rolls it as Poisson, `simulateMatchStep()` rolls `poissonRandom(xg * minutes/90)` per side for each step's minutes (the halftime and set-piece steps carry their minutes on via `currentMatch.carrySpan`); team playstyles via `currentMatch.homeTeamObj/awayTeamObj`. Live-only extras are xG per 90 (shouts, sabotage, set-piece coach, corners); traits only act through `calcTeamStrength()` (no extra live share/saves). The opponent also gets free kicks (`playOpponentFreeKick()`). Playstyle `concedeBonus` > 0 = concedes more (the sign was inverted before). Before, live had its own steeper formula (home share 0.5 + 2 %/point plus trait extras): the same pairing won ~25 points more often live (`testLiveMatchEngine` checks parity). AI vs AI also gets `AI_HOME_ADVANTAGE` (match-post.js, match-live.js, admin.js). Live shouts (25.13, measured from minute 60/70 over 800 matches): brechstange +0.9/+0.7 xG (pays when trailing: 0.39 → 0.51 points at 0:1, costs with a lead), pressing +0.3/+0.2, bus ×0.6/×0.7 (2.60 → 2.70 points at 1:0, halves a comeback); brechstange/pressing minutes (`currentMatch.kraftMinuten`, counted after the set-piece check) cost the XI up to `LIVE_SHOUT_FITNESS_COST` (8) extra fitness in `processPostMatchRoutine()` (live only) - before, shouts were free and brechstange paid even at 0:0.
- Market value (25.16): `calculatePlayerMarketValue(str)` (js/entities.js) is continuous across its segments (58 → ~150k, 68 → ~1 M, 85 → ~35 M; `testPhase13Teil3` checks it never falls) - before, the lowest segment (`MARKET_VALUE_LOW_COEFF` was 450, now 83) priced a 58 at ~740k and a 59 at 150k, so Regionalliga players cost more than 3. Liga players and forced sales in the pleite scenario brought ~380k each. Wages up to strength 58 stay as before: `calculatePlayerWage()` scales the value above 15k back by `MARKET_VALUE_LOW_COEFF_OLD / MARKET_VALUE_LOW_COEFF`. The pleite scenario starts at -320k (was -600k; with the real values sparen 3/6, passiv 1/6 - at -600k nobody could avoid 2+ forced sales). The winter talk budget is 30 % of the season transfer budget (`WINTER_BUDGET_SHARE`).
- Captain: `ensureCaptainPresent()` (js/locker-room.js, from `setupMatch()` and `processPostMatchRoutine()`) hands the armband to the best `getLeadershipScore()` when the captain left (sale, loan, swap, expiry - 25.22, before `game.captainId` dangled and the bonus silently vanished) or is injured (25.23: an injured captain is not on the pitch, so the bonus of `calcTeamStrength()` was lost too). The player popup shows 'Potenzial' (`getYouthPotentialText()`) instead of the old 'Talent' field that repeated the strength.
- Player aging/development: only `agePlayersAtSeasonEnd()` in `js/player-development.js` (age +1, strength by archetype). Training gains go through `grantTrainingStrength(p)` (25.20, `getTrainingStrengthCap()`: +3/+2/+1/0 per season up to 21/25/29/older; individual focus in processPostMatchRoutine and the training minigames; shown as 'Trainingsplus' in the player popup via `getTrainingGainsLabel()`) - before every player with a focus (the co-trainer automation sets one for all) got +1 with 15-20 % per matchday without limit. Training camps (`bookTrainingCamp()`, js/calendar.js) once per season (`game.trainingCampSeason`), cost × `leagueScaleFactor()`, no permanent strength (before: unlimited bookings, +1/+2 for the whole squad each).
- Fatigue & summer break (25.8, long-run bot: XI fitness fell to ~73 % in relegation seasons): `pickBestLineupIds()` gives position slots only to outfield players with fitness >= 50, the free slots go to the strongest rest (fresh players of other positions, else the tired one; a goalkeeper only when no outfield player is left) - before, four defenders played down to 10 % and "Ausgeruhte Elf" changed nothing. Season end halves `privateLife.stress` (it only rose: loss +3, max -3 strength) and lifts morale < 70 halfway to 70. The emergency squad (< 14 players after expiries, season-end.js) is created at the new league's average -14..-6 (passive long-run clubs live on it - -12..-4 kept one in the Bundesliga for 11 seasons) (formerly 82 - level*10 - 14, 15-17 below average).

### Game Loop & Monthly Ticks

The main game loop is in `js/match.js` → `playMatch()` → `processPostMatchRoutine()`.

**Monthly Ticks** (every 4 matchdays, since 34 matchdays ≈ 8.5 months) live in `runMonthlyClubTicks()` (js/match.js), called from `processPostMatchRoutine()`; the block below shows the idea:
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

**Lint rules that matter:** a file-level `/* eslint-disable no-undef */` only applies to that file (the lint bundle re-enables rules between files). `no-redeclare` catches two modules defining the same global name - a later `function x()` would otherwise silently replace an existing one. Rename the new one instead. `no-unused-vars` (local variables) is an error since Phase 19.5 - delete leftovers instead of keeping them.

**Monthly ticks:** feature ticks belong into `runMonthlyClubTicks()` (js/match.js), not into `processPostMatchRoutine()` itself - otherwise they run every matchday. Per-matchday blocks were split out of the 585-line routine in 20.5 (`checkDfbLicenseDeadlines()` in season-end.js, `tickLockerFriendships()` in locker-room.js); legacy save cleanups all run from `cleanupRemovedModuleState()` (load + monthly). Promotion rewards only via `applyPromotionRewards()` (prize by the NEW league, `getPromotionPrize()`: 150k Oberliga … 5 M Bundesliga - a flat 1.5 M was more than a whole Regionalliga season) (season end and the DFB grace period, which now also moves the club via `insertOurTeamIntoLeagues()`). Render functions must never change `game.money` (checked by the runtime round-trip test). Measure sizes with a fallback (`el.offsetWidth || 320`): screens are `display:none` while not shown.

**Why one big file:** Game must run offline as a single draggable-and-droppable file on Android/mobile (Chrome, Firefox, etc.). No server, no network, no external dependencies.

### Important Architectural Decisions & Gotchas

1. **No `alert()`, `confirm()` or `prompt()`** – Many Android WebViews suppress native dialogs silently. Use `showToast()` for notifications, `requireConfirm()` for confirmations and an inline input for text. `testNoNativeDialogs` scans all js/*.js.

   **No silent buttons or fake choices** – a button that cannot act (no money, wrong state) must say why via `showToast()`; every option needs a real effect and a trade-off (Phase 18.6: team instructions cost fitness, fan actions are per-match boosts, caps/limits really block/warn).

   **No display-only panels** (Phase 25.1 removed 17 Phase-23 modules): a promised bonus must be called from the strength path (`calcTeamStrength()`, `getOwnLeagueMatchStrength()`, `setupMatch()`), a `record…()` function must be called from the match flow, and a panel must read real data (`lineup` is a global array, there is no `game.lineup.starters`, `league.fixtures` or `league.table`). Before adding an analysis/tactic panel, check the existing one: tactic record `game.tacticRecords`, team instructions, player roles `p.role`/`PLAYER_ROLES`, opponent duel js/opponent-tactics.js, prediction js/match-scout.js, live hints js/co-trainer-live.js, set pieces js/set-pieces.js + js/set-piece-drills.js. Green tests do not prove an effect - grep that the new function is called outside its own file.

2. **Manager's Office: Custom Hit Detection** – The office 3D scene (`js/office.js`) uses custom `getBoundingClientRect()` hit testing, not native browser hit detection. Native hit testing is unreliable on 3D-transformed elements across browser versions. See `officeHotspotAtPoint()`.

3. **Mobile performance (19.8, measured at 4x CPU throttle):** no `backdrop-filter` on elements that appear many times or scroll (`.panel` had `blur(12px)`: squad scroll frames up to 42 ms instead of 17 ms) - only on short-lived overlays. No endless animations on the office start screen: the phone ring (`officePhoneRing`) runs 4 times per visit, idle CPU dropped from ~13 % to <1 %. Infinite animations go into the `prefers-reduced-motion` block at the end of css/styles.css.

4. **CSS-3D Pitfalls:**
   - Never use `filter` or `opacity` on 3D-positioned elements (forces `transform-style: flat`)
   - Use `box-shadow` for shading, not `filter`
   - Don't animate `transform` properties (breaks compositing); use `box-shadow` animations instead

5. **localStorage Access** – Android WebViews block localStorage on `file://` URLs completely. Always serve over `http://` for development/testing. `safeLocalSet()` wraps all storage access in try-catch for WebViews that don't support it.

6. **Squad Array Consistency** – The squad roster is a simple array (`let squad = [...]` in `js/state.js`). When adding players in transfers/recruitment, ensure each player has a unique `id`, else state becomes ambiguous. Use `squad.find(p => p.id === X)` for lookups, never array indices.

7. **Game Version & Compatibility** – `GAME_VERSION` in state.js is user-facing and logged when save games load. Update it on major features; it helps debug save-state issues.

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
# Suites run 3 in parallel (TEST_JOBS, default 3; TEST_JOBS=1 = serial, ~2.5x slower). The slowest suites start first (25.25).
# Timing suites (testStartzeit: new game until playable, 4x CPU throttled, best of 3, limit 3500 ms; standalone build measures 2200-2400 ms) run alone after the parallel ones (25.26).
# Old saves: tests/fixtures/saves/v<version>.json (3.22.1, 3.26, 3.77, 3.94) and karriere-*.json (careers after 3 seasons, written
# by the bot with SPEICHERN=... : v3.98 start Bundesliga, liga6 with LIGA=5, passiv) are loaded by testAeltereStaende, each also as autosave and with one matchday played.
# Regenerate old ones with: node scripts/make-old-saves.js tests/fixtures/saves <version>=<old build html> ...
# Each suite gets its own browser context (own localStorage); its console output is buffered
# and printed as one block. Full run ~60 s parallel. A suite must not depend on another suite's storage. The 30-matchday economy test seeds `Math.random` via `addInitScript` (fixed seed, same threshold) - unseeded it failed in about 1 of 7 runs.

# The test file (tests/run-tests.js) includes:
# - testManagerOffice: 3D hotspot hit-detection for all office objects
# - Dialog suppression: verifies no alert/confirm in codebase
# - Financial ledger: spot-checks income/expense calculations
# - Screen rendering: loads key screens and checks for errors
# - Save/load: verifies game state persists and loads correctly
```

`testCodeIntegrity` checks statically and in the browser: every function called from an `on*` attribute (index.html and generated HTML) exists, every `getElementById('…')` id exists somewhere, charts rendered while their screen is hidden (`offsetWidth` 0) have no negative sizes, and no `filter`/`opacity` sits on a `preserve-3d` element or its ancestors (office light/dark, every office event, stadium).

`testNoWriteOnlyGameFields` fails when a `game.x` field is only ever written (or only counts itself up) - either use it or remove it (plus `cleanupRemovedModuleState()`). `testMobileLayout` checks every screen/tab at 412 px (no overflow, buttons >= 32 px, no font < 8 px).

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
- **js/*.js** – Game logic modules (111 files); loaded in order of dependencies
- **tests/run-tests.js** – Playwright test suite
- **build.py** – Bundler script; concatenates and lints
- **server.py** / `npm run serve` – Local dev server
- **dist/anstoss-fm13-standalone.html** – Built game file (1.8 MB, generated by build.py)
- **.github/workflows/build-test.yml** – CI/CD automation

## Messungen der Runden 25.35 bis 25.37

**Transferpoker mit 100-€-Schritt (25.37, je 20 Verhandlungen pro Spieler und Strategie, Startliga 5 und 6):**

| Strategie | Liga 5 Abschluss / Preis | Liga 6 Abschluss / Preis |
|---|---|---|
| knapp (85 %, +5) | 90 % / 88,7 % | 91 % / 89,8 % |
| fair (92 %, +4) | 99 % / 93,6 % | 98 % / 93,4 % |
| hoch (98 %, +2) | 100 % / 98,0 % | 98 % / 97,7 % |

Die Rundung auf 100 € unter 100.000 € ändert gegenüber der Messung mit 1.000-€-Schritten praktisch nichts.

**Aufstieg in die nächsthöhere Liga, Elf minus Ligaschnitt im ersten Jahr (25.36, Läufe aus Liga 6, Liga 3 und der Bundesliga-Stichprobe):**

| Aufstieg in Liga | Fälle | Elf minus Schnitt | Nach dem ersten Jahr nicht abgestiegen |
|---|---|---|---|
| 5 | 12 | −0,5 | 12/12 |
| 4 | 12 | −0,3 | 12/12 |
| 3 | 13 | −3,6 | 12/12 |
| 2 | 20 | −5,7 | 14/16 |
| 1 | 7 | −7,5 | 5/5 |

**Aufstieg aus der 3. Liga (25.36, 6 Läufe × 12 Saisons, Startliga 3):** 14 Aufstiege in die 2. Liga, Elf im ersten Jahr im Schnitt −1,8 unter dem Ligaschnitt.

**Vollläufe der Testsuite (25.36):** dreimal hintereinander 1365 von 1365 grün.

**Laufzeit der Testsuite (25.35, drei Läufe):** 306, 298 und 290 Sekunden. Keine Suite schwankt um mehr als 1,1 s, die Wackler kamen von Zufallsinhalten, nicht von der Zeit.

**Entlassung im Bot (25.37, `ENTLASSUNG_ERZWINGEN=2`):** Die Ausgabe nennt jetzt den Stand vor dem Saisonwechsel, also Vertrauen, die letzten Werte, Erwartung und den erreichten Platz. Beispiel: „Vorstand 5 Verlauf 17/16/15/14 erwartet Platz 1 Platz 5“.

**Transferbudget je Liga (25.36):** Der Test nimmt jetzt sechs Märkte mit je zehn Spielern statt einem. Vorher lag das Verhältnis von Budget zu typischem Marktpreis über alle Ligen zwischen 1,9 und 5,1 und sprang von Lauf zu Lauf; mit sechs Märkten je Liga liegt es zwischen 0,9 und 3,3, und die Werte aus drei Läufen stimmen gut überein.

## Passive Entlassungs-Messung (r38)

Sechs Läufe mit je bis zu zehn Saisons, Startliga 0 (1. Liga), `passiv`. Lauf 1 bis 5 enden mit einer Entlassung, Lauf 6 läuft alle zehn Saisons durch.

| Lauf | Entlassung in Saison | Liga bei Entlassung | Vorstand | Verlauf | Erwartung → Platz |
|---|---|---|---|---|---|
| 1 | 8 | 3. Liga | 13 | 14/13/12/13 | Platz 15 → 18 |
| 2 | 6 | 3. Liga | 10 | 11/12/11/10 | Platz 3 → 12 |
| 3 | 3 | 2. Liga | 19 | 23/24/20/19 | Platz 1 → 4 |
| 4 | 6 | 2. Liga | 10 | 10/11/12/10 | Platz 8 → 18 |
| 5 | 6 | 2. Liga | 10 | 10/10/10/10 | Platz 16 → 18 |
| 6 | – | 3. Liga (Ende) | – | – | – |

Die Gründe stehen jetzt in der Ausgabe, und zwar vor dem Saisonwechsel. Auffällig ist Lauf 3: Der Verein wird mit Platz 4 entlassen, obwohl Platz 1 erwartet war und der Vorstand bei 19 steht. Die Regel in `checkSeasonEndSacking()` (`js/match-post.js`) wirkt so: Entlassung, wenn der Vertrauenswert sechs Pflichtspiele in Folge unter 25 lag (Schwelle plus 3 mit Legendenstatus) und das Saisonziel verfehlt ist (Platz 1 bis 2 oder die Erwartung). Der Verlauf geht nur in die Prüfung „erholt“ ein, und die braucht sieben Werte. Platz 4 bei Erwartung 1 ist kein erreichtes Ziel, deshalb greift die Entlassung. Das ist eine Spielregel-Frage und wird nicht geändert, solange der Nutzer nicht freigibt.

Vergleich mit den früheren passiven Läufen derselben Auswertung: 4 von 10, 5 von 10 und 7 von 8 Läufen mit Entlassung. Die Startliga der älteren Läufe ist in der Ausgabe nicht gesichert vermerkt, deshalb ist der Vergleich nur grob.

## Diagnosen der Runde 25.38 (ohne Regeländerung)

**Talentschwelle (Punkt 2).** Je 6 Läufe mit 10 Saisons, ausgewertet mit dem Talent-Skript aus der Messung:

| Schwelle | Talent-Erlös Schnitt | Abgelehnte Angebote Schnitt |
|---|---|---|
| Basis (Datei `talent-basis2`) | 15,9 M€ | 12,2 |
| Aufschlag 5 (`TALENT_AUFSCHLAG=5`) | 45,5 M€ | 6,2 |

Die Basis-Datei nennt die Schwelle nicht im Inhalt, die Zuordnung folgt nur dem Dateinamen. Die Wirkung auf die Elf ist nicht gemessen. Vor einer Regel ist das nötig.

**Aufsteiger-Anschub (Punkt 3).** Aus der Tabelle der Runden 25.35 bis 25.37: Elf-Lücke bei Aufstieg in Liga 3 −3,6, in Liga 2 −5,7, in Liga 1 −7,5. Nach dem ersten Jahr nicht abgestiegen: 12/12, 14/16, 5/5. Die Lücke ist messbar, der Abstieg kommt selten vor. Eine Anschubhilfe ist durch die Daten nicht gedeckt. Die frühere Aussage, Aufsteiger in der 3. Liga stiegen oft sofort ab, war falsch.

**Transferpoker-Korridor (Punkt 4).** Die Messung aus 25.37 liegt bei Preis 88 bis 98 % der Forderung und Abschluss 90 bis 100 %. Ein Zielkorridor ist nicht festgelegt. Ohne Zielwert gibt es keinen Eingriff, der Zielwert ist eine Spielregel-Entscheidung.

**Testlaufzeit (Punkt 5).** Je ein Lauf der Testsuite: vier Jobs 103 Sekunden, drei Jobs 109 Sekunden, beide 1377 von 1377 grün. Der Unterschied liegt im Rauschen. Der Standard bleibt bei drei Jobs, weil mehr Parallelität die Zeit- und Ladezustandstests unter Last riskiert.

**Kader-Median im Transferdialog (Punkt 7).** Nicht umgesetzt. Das Potenzial wird in den Transferdialogen (`js/transfermarket.js`, `js/transfer-poker.js`) nicht angezeigt, ein Median hätte dort also keinen Bezug. Der Hinweis bleibt bei Jugendspielern und auf der Spielerkarte.

## Entscheidungen der Runde 25.42 (ohne Rückfrage)

**Legenden-Sperre nur bei Karriereende.** Der Legendenstatus entsteht im Spiel nur beim Karriereende (`checkForLegendStatus()` in `js/player-retirement.js`). Ein verkaufter Spieler wird nie Legende. Die Sperre der Rückennummer gilt deshalb nur für Legenden aus dem Karriereende. Eine Änderung wäre erst nötig, wenn ein Verkauf den Legendenstatus bekommen soll.

**Zahlen für Reisekosten und Saisonwette bleiben.** Die Auswärtsfahrt wird nach Bundesland mit dem Faktor 0,7 (gleiches Bundesland) oder 1,3 (anderes) verrechnet, die bisherigen Kosten liegen je Ligastufe bei 800 bis 2.300 €. Die Saisonwette zahlt 150.000 € je Ligastufe unter der 1. Bundesliga und hebt das Vertrauen um 12, bei Verlust senkt sie es um 10. Beides liegt in der Größenordnung der bestehenden Buchungen. Eine Messung mit dem Bot ist offen und kann die Werte später nachjustieren.

## Phase 25.51: Designsystem, Lesbarkeit und Farb-Themes

**Befund (Handy, 390 px):** Im Code standen über 1.270 feste Schriftgrößen, die meisten 8 bis 10 px; die Handy-Regeln verkleinerten Kästen und Überschriften zusätzlich. Abschnittstitel (12 px, gold) hoben sich kaum vom Fließtext ab, Karten hatten keine feste Rangfolge (Name, Werte, Verein und Marktwert in gleicher Größe). Das Zoomen war per `user-scalable=no` gesperrt (WCAG 1.4.4), Nebentext in `#64748b` lag unter 4,5:1.

**Umsetzung:**
- Schriftskala als Tokens (`--fs-micro` bis `--fs-display`): alte Pixelwerte 8/9/10/11/12/13-14/15-16 sind auf Stufen abgebildet, die Rangfolge bleibt. Desktop beginnt bei 10 px, Handy bei 11 px. Die Handy-Regeln verkleinern nicht mehr. Eingabefelder auf dem Handy mindestens 16 px (kein Zoom-Sprung auf iOS).
- Textgröße einstellbar (Normal, Groß ×1,12, Sehr groß ×1,25) über `--fs-scale`.
- Kartenmuster `renderUiCard()` (`js/ui-cards.js`): Bild mit Positionsabzeichen, Titel (2 Zeilen), Untertitel, Chips, große Kennzahl, Werteleiste, Knöpfe. Umgestellt: Transfermarkt, Personal; die Vorschau unter Darstellung nutzt es ebenfalls.
- Flächen als Tokens (`--surface-*`, `--chip-bg`, `--text-box`, `--nav-*`), Themes setzen nur Tokens: Flutlicht-Nacht (Standard), Anstoß-Klassik, Rasengrün, Hoher Kontrast (Text ≥ 7:1), Farbsicher (Okabe-Ito, Blau/Orange statt Grün/Rot). Auswahl unter Menü → System & Hilfe → 🎨 Darstellung, pro Gerät gespeichert, nicht im Spielstand.
- Zoomen wieder erlaubt, sichtbarer Tastaturfokus (`:focus-visible`), Menü-Kategorien kontrastreicher.
- `testMobileLayout` prüft jetzt mindestens 11 px statt 8 px; `testDesignThemes` prüft Kontrast aller Themes (Text, Nebentext, Akzent, Gut, Schlecht ≥ 4,5:1 auf Karten), Speicherung, Textgröße und Überlauf bei sehr großer Schrift.

**Offen (bewusst nicht in dieser Runde):** helles Theme (rund 135 fest eingetragene Farben in JS, z. B. weiße Texte, würden auf hellem Grund unlesbar), weitere Karten auf das Muster umstellen (Kader-Liste, Postfach, Angebote, Jugend), Großbuchstaben-Überschriften in `index.html` auf normale Schreibung.

## Phase 25.52: Zentrales Farbsystem, helles Theme, Kartenmuster Teil 2, Schreibung

- **Farben:** rund 330 feste Farbwerte in CSS, JS und HTML auf Tokens umgestellt (Konverter: weiße Aufhellungen → `--ink`, Schatten → `--shade`, Tönungen → Farb-Token per `color-mix`, dunkle Flächen → `--surface-0…3`, Schrift auf Füllungen → `--on-strong`/`--on-accent`). Knöpfe und Positionsabzeichen haben eigene Füll-Tokens (`--accent-fill`, `--danger-fill`, `--violet-fill`, `--pos-*`). Undefinierte Tokens (`--green`, `--text`, `--bg-panel`, `--text-primary` …) ersetzt. Illustrationen behalten ihre Farben und setzen lokal Nacht-Tokens.
- **Neues Theme Tageslicht** (hell). Kontrast-Scan über alle Bildschirme × 6 Themes: vorher über 300 Stellen unter WCAG AA, danach 0. Dabei auch im Standard-Theme verbessert: violette Hauptknöpfe (3,0 → 5,5:1), Rot (#ff6b7a), Nebentext (#91a3c4).
- **Kartenmuster** jetzt auch für Kaderliste, Postfach und Jugend. Postfach: gelesene Nachrichten nicht mehr per Transparenz (Kontrast), Symbol-Knöpfe mit 32 px Tippfläche.
- **Schreibung:** rund 250 Überschriften von Großbuchstaben auf korrekte deutsche Schreibung (von Hand festgelegt), kurze Etiketten über `.ui-overline` in Großbuchstaben per CSS; englische Übersetzungen mitgezogen.
- **Tests:** `testKeineFestenFarben` (Quelltext), `testKontrastAlleThemes` (Laufzeit, ca. 20 s).

## Phase 25.53: Bewerbungspool als Fenster

- **Befund:** Der Bewerbungspool erschien als Kasten oben im Personal-Bildschirm; die Seite scrollte per `scrollIntoView` dorthin. Das schlug auf dem Handy zeitweise fehl (sanftes Scrollen unter Layoutänderungen), dann sah „Einstellen“ wirkungslos aus.
- **Umsetzung:** `openCandidatePool()` öffnet das Fenster `#staff-pool-overlay` (Kartenmuster: Stelle, Gehalt, Kasse; je Bewerber Preis, Qualität, Start-Stufe, Start-Moral, Grund bei Sperre, Einstellen-Knopf). Kein Scrollen mehr; schließen per ✕, „Abbrechen“, Tipp neben das Fenster oder Zurück-Taste. Beim Laden wird ein alter Pool-Zustand verworfen.
- **Nebenbei:** Nicht verfügbare Knöpfe (`disabled`) sehen jetzt gedämpft und gestrichelt aus, vorher waren sie von aktiven nicht zu unterscheiden.
- **Tests:** `testPersonalEinstellen` und `testPersonalEinstellenHandy` prüfen, dass das Fenster vollständig im Bild liegt, alle drei Einstell-Knöpfe ohne Scrollen erreichbar sind, die Seite nicht springt und Abbrechen/Tipp daneben schließen.

## Phase 25.54: Zugänglichkeit, Automatisch-Theme, Bewegung, Fenster statt Scroll-Sprung

- **Namen für Bedienelemente:** `js/a11y.js` setzt fehlende `aria-label` für Symbol-Knöpfe (✕, −, ☆ …), Farbpunkte, Wappen-Auswahl, Auswahlfelder und Regler nach dem Rendern (MutationObserver, gebündelt). Vorhandene `title`/`aria-label` bleiben. `testBedienelementeHabenNamen` prüft das über alle Bildschirme.
- **Theme „Automatisch“:** folgt `prefers-color-scheme` (hell → Tageslicht, dunkel → Flutlicht) und `prefers-contrast: more` (→ Hoher Kontrast), wandert bei Wechsel mit. Die Medienabfragen werden global festgehalten (Chromium verliert Listener kurzlebiger `matchMedia`-Objekte).
- **Bewegung:** „Wie Handy“ / „Reduziert“ / „Normal“ (`html[data-motion]`), zusätzlich zu `prefers-reduced-motion`.
- **Transferpoker** öffnet als Fenster (`#transfer-poker-overlay`) statt per `scrollIntoView`; **Kopfzeile** auf dem Handy zeigt per Randverlauf, dass sich seitlich mehr Kennzahlen verbergen (`kpi-mehr-rechts/-links`).
- **Kartenmuster** nun auch für Training (individueller Fokus), Zweite Mannschaft (beschriftete Knöpfe statt reiner Symbole) und die Schützenauswahl im Elfmeterschießen.
- **FAB-Verdeckung** geprüft: kein Problem, `testMobileLayout` prüft Verdeckung durch `#one-hand-fab` jetzt mit.
- **Offen:** seltener Fehler „Theme bleibt nach Neustart nicht erhalten“ (CI, nicht lokal reproduzierbar); Diagnose im Test eingebaut.

## Phase 25.55: Test-Stabilität, Fenster per Tastatur, Karten, Sichtprüfung

- **Feste Wartezeiten:** 11 `waitForTimeout`/`setTimeout`-Stellen in `tests/run-tests.js` durch Zustandsprüfungen ersetzt (Neues-Spiel-Neustart, Dashboard/Büro, Verträge, i18n, Poker, a11y-Test mit „Ruhe“-Schleife). Übrig sind 100-ms-Beruhigungszeiten nach dem Start (`app-loading` weg) und Hover-Animationen im Büro-Test. Auslöser: der CI-Fehler von 3.121 („Kopfzeile am Ende“, 150 ms zu knapp).
- **Darstellung doppelt:** `designLesen`/`designSchreiben` halten Theme, Textgröße und Bewegung in localStorage und sessionStorage; fehlt der dauerhafte Wert nach dem Neuladen, kommt er aus dem Tab-Speicher zurück. Hintergrund: der seltene Fehler „Theme nach Neustart leer“ in CI (Ursache im Browser, nicht im Spiel gefunden).
- **Seitensprünge:** Im Code gibt es kein `scrollIntoView`/`window.scrollTo` mehr (nur innere Ticker-Listen scrollen); der Test prüft den Quelltext.
- **Fenster:** alle 19 Fenster tragen `role="dialog"`, `aria-modal` und einen Namen aus der Überschrift; Escape schließt das oberste Fenster (Fokus-Fang und Rückgabe des Fokus gab es schon).
- **Kartenmuster:** Zweite Mannschaft (Markt, Wechsel in die Zweite, Verliehene) und K.O.-Spiele im Europapokal; Personal-Karten zeigen die Aufgabenbeschreibung vollständig (`ui-card-voll`), Ausstiegsklausel-Feld wächst bei großer Schrift.
- **Messung Start:** Neues Spiel 1,4 s, Spielstand laden 1,0 s (CPU 4x gedrosselt, minifiziert).
- **Sichtprüfung:** Screenshots von 12 Bildschirmen in Flutlicht, Tageslicht und „Sehr groß“ auf 390 px; gefunden und behoben: abgeschnittene Personal-Beschreibung, zu schmales Ausstiegsklausel-Feld.

## Phase 25.56: Verträge als Karten, Reiter per Tastatur, Meldungen, Sichtprüfung 2

- **Verträge-Bildschirm** im Kartenmuster: Bild mit Position, Name, Gehalt, Restlaufzeit als Chip (rot bei 0-1 Jahren, gelb bei 2), Berater, Einsatzgarantie, Vorvertrag als Chips, Stärke groß, „Verhandeln“ als Knopf; Ausstiegsklausel und Erfolgsboni in einem aufklappbaren Bereich (`ui-fold`, Zustand bleibt beim Neuzeichnen über `contractsFoldOffen`). `testBonusClauses` klappt den Bereich vor dem Ausfüllen auf.
- **Meldungen:** `#app-toast` ist ein Statusbereich (`role=status`, `aria-live=polite`), fängt keine Tipps ab (3.125, zuvor antippbar: im CI lag sie über dem Knopf „Einstellen“ und blockierte den Klick), auf dem Handy sitzt die Meldung über dem Weiter-Knopf statt darauf; Test prüft die Überdeckung gegen das sichtbare FAB (`position: fixed`, deshalb nicht über `offsetParent` messen).
- **Reiter per Tastatur:** Hub-Reiter und Unterreiter sind `tablist`/`tab` mit `aria-selected`, Pfeil links/rechts, Pos1 und Ende wechseln den Reiter und halten den Fokus.
- **Weitere Karten:** Training-Vorlagen und Hospitanz in der Jugend. Bewusst Zeilen geblieben: Finanzjournal und Liga-/Gruppentabellen (Hauptbuch-Charakter, Karten wären dichter und länger).
- **Sichtprüfung 2** (Zweite Mannschaft, Frauen, Stadion, Campus, Fans, Liga, Historie, Pokal, Planung, Verträge, Sponsoren, Lexikon, Kalender, Scouting in Flutlicht und Tageslicht/Sehr groß): behoben wurde das Wortbrechen „Nachverhand-eln“ in den Sponsor-Angebotsreihen (jetzt `auto-fit`). Offen, unkritisch: im Kalender sind Knopfformen uneinheitlich (Pillen und Rechtecke).
- **Theme-Speicher unter Last:** 180 Neustarts mit 4 bis 10 parallelen Seiten und vier CPU-Brennern, kein einziger Verlust des localStorage-Werts; der CI-Fehler bleibt unerklärt, die doppelte Speicherung (25.55) fängt ihn ab.
- **Bot-Absicherung 25.56:** `longrun-bundesliga.js 5 aktiv 1` (Liga 1): 5 Saisons in 20 s, keine Fehler, keine Entlassung, 3 Talente. Zwei Test-Anpassungen aus dem Check: die Seitenende-Messung ignoriert Inhalte in eingeklappten `<details>` (sie haben Layout-Maße, sind aber unsichtbar); die Live-gegen-Simulation-Prüfung (80 Spiele, Toleranz 0,45) läuft mit festem Seed (einmal 2,71 statt 2,08 im CI).

## Phase 25.57: Sichtprüfung 3, Spielerdetail-Kopf, Orientierung, Renderzeiten

- **Sichtprüfung 3** (Postfach, Lexikon, Frauenmannschaft, Historie, Pokal, Spielerdetail, Live-Spiel inklusive Halbzeit-Ansprache und Wechsel/Taktik-Bereich in Flutlicht und Tageslicht/Sehr groß): keine Überläufe oder abgeschnittenen Texte. Kleine Beobachtung, bewusst offen: auf dem Spielfeld-Bild im Live-Spiel überlappen bei „Sehr groß“ die Namensschilder (Illustration, Schrift darf dort nicht schrumpfen). Das Vertragsgespräch ist kein Fenster, sondern ein Bereich in der Vertragskarte (`renderContractTalkBox`).
- **Spielerdetail:** Kopf nach dem Kartenmuster (`#pd-summary`): Chips (Position, Alter, Nation, Charakter, Berater, Vertrag, Robust/Verletzungsanfällig) und Werteleiste (Stärke, Moral, Fitness, Marktwert), darunter die vollständige Liste unter „Alle Angaben“.
- **Orientierung:** Sprunglink „Zum Inhalt springen“ (`.skip-link`, setzt den Fokus auf `#main-content`), die beiden Navigationen heißen „Hauptmenü“ und „Schnellzugriff“; Test: genau ein `main` und ein `header`, alle `nav` benannt.
- **Renderzeiten** (CPU 4x gedrosselt, minifiziert, 18 Spieler): Verträge-Liste 27 ms, mit Namensvergabe 71 ms, `verbessereZugaenglichkeit` über die ganze Seite 59 ms, Wechsel Verträge→Kader 148 ms inklusive beider Zeichnungen. Alles unter der Schwelle von 100 ms je Zeichnung, keine Optimierung nötig; der Beobachter arbeitet entprellt (120 ms) und blockiert nicht.

- **3.125 (Korrektur zu 3.124):** Der CI-Lauf für 3.124 scheiterte in `testPersonalEinstellen`, weil die antippbare Meldung Klicks auf den Knopf darunter abfing; das Antippen ist entfernt (`pointer-events: none`), ein Test prüft es. Außerdem lag eine versehentlich committete Bot-Ausgabedatei `0` (367 KB, aus `SPEICHERN=0`) im Repository: entfernt und in `.gitignore`. Bot-Läufe künftig ohne `SPEICHERN=0` starten (der Wert wird als Dateiname gelesen).

## Phase 26: 20 neue Funktionen (Runde 1 von 4)

### 26.1 Aufstellung und Taktik (`js/matchprep.js`)
- **Aufstellungsvorlagen:** 5 benannte Slots (Startelf + Formation) im Reiter Aufstellung; beim Laden ersetzt der Trainer Ausfälle (verletzt, gesperrt, verkauft) auf demselben Platz durch den besten freien Spieler derselben Position. Vorlagennamen werden maskiert. `game.lineupPresets`.
- **Taktikvorlagen:** 5 Slots (Formation, Spielstil, Zweikampfhärte) im Reiter Taktik, im Livespiel als Schnellwahl im Live-Panel (`liveSet*`, die Kaderauswahl bleibt unberührt). `game.tacticPresets`. Alte Spielstände bekommen die Felder über `ensureMatchPrepState()`.
- **Spieltag-Check vor dem Anpfiff** (`#prematch-check-box`): *Aufstellungs-Check* (Torwart, Elfanzahl, Formation gegen Positionen, Ausgefallene Spieler in der Elf), *Wer fehlt?* (Verletzte mit Rückkehr in Spieltagen, Gesperrte mit Spielen, Stammspieler markiert) und *Rotations-Assistent* (tauscht müde Stammspieler gegen deutlich frischere Spieler derselben Position, wenn die effektive Stärke nicht schlechter wird). Die Teamstärke bleibt unverändert, getauscht wird nur auf Tipp.
- **Bewusst abweichend vom Vorschlag:** „Gelbgefährdete“ und gegnerische Ausfälle gibt es nicht, weil das Spiel keine Gelbsperren und keine Gegnerkader kennt; der Check zeigt nur echte Daten.
- Test: `testSpielvorbereitung`.

### 26.2 Verträge und Transfers (`js/contract-tools.js`)
- **Gehalts-Ampel:** Chip in Vertragskarte und Spielerdetail, Gehalt gegenüber dem Marktgehalt, das `calculatePlayerWage()` für Stärke und Marktwert ergibt (unter 85 % günstig, bis 115 % marktüblich, bis 140 % teuer, darüber überbezahlt). Statt eines „Ligadurchschnitts“, den das Spiel nicht führt, gilt die Spiel-Formel selbst.
- **Verlängerungs-Assistent** (Fenster `#renewal-assistant-overlay`, Knopf im Verträge-Bildschirm): alle Verträge mit höchstens 1 Jahr Rest, je Karte Forderung, Laufzeit, Handgeld + Berater, Gehaltsänderung und Ampel. „Zum Angebot verlängern“ nutzt `acceptContractTalk()` (gleiche Prüfung von Kasse und Gehaltsbudget, gleiche Buchung), Vorvertrag und Gesprächssperre blockieren mit Begründung, „Verhandeln“ springt ins normale Vertragsgespräch.
- **Marktwert-Kurve** im Spielerdetail: Marktwert je Saison abgeleitet aus dem Stärkeverlauf (`calculatePlayerMarketValue`), letzter Punkt der echte aktuelle Wert.
- **Transferbilanz je Saison:** `archiveTransferBilanz()` hält am Saisonende Käufe (inkl. Handgeld), Verkäufe (inkl. Weiterverkaufsbeteiligung) und Saldo in `game.transferBilanzHistory` fest (höchstens 20 Saisons), weil das Kontojournal nur die letzten Buchungen behält. Anzeige als „Frühere Saisons“ unter der Bilanz der laufenden Saison.
- **Entwicklungsprognose:** Spielerdetail zeigt die erwartete Stärke in 1, 2 und 3 Jahren als Spanne, fortgeschrieben mit `getDevelopmentRange()` (Training und Spielpraxis nicht eingerechnet, so steht es dabei).
- Test: `testVertragsWerkzeuge`.

### 26.3 Statistik und Information (`js/insights.js`)
- **Serien-Tracker:** `recordOwnLeagueResult()` (aus `updateLeagueTable()`, jedes eigene Ligaspiel live wie simuliert) führt `game.serien` mit sieben laufenden Serien (Siege, Ungeschlagen, Heimsiege, ohne Gegentor, ohne Sieg, Niederlagen, ohne eigenes Tor) und je einem Rekord mit Saison; Anzeige im Reiter Analyse („🏆“ bei laufendem Rekord). Gezählt wird die Liga, über den Saisonwechsel hinweg.
- **Formkurve:** `gradeOwnMatch()` merkt je Spieler die letzten fünf Noten (`p.formNoten`); Spielerdetail zeigt Noten, Schnitt und Trend (steigend/fallend/stabil, ab 4 Noten).
- **CSV-Export:** Kader mit Saisonwerten und Ligatabelle (Semikolon, UTF-8-BOM für deutsche Tabellenkalkulationen, Zellen mit Semikolon oder Anführungszeichen maskiert), Download über Blob und `<a download>` wie der Spielstand-Export.
- **Spielbericht teilen:** Knopf nach dem Abpfiff, Fenster mit Text (Ergebnis, Tore aus dem Ticker, bester Spieler, Tabellenplatz), „Kopieren“ (Zwischenablage mit Ersatzweg) und „Teilen …“ wenn das Gerät `navigator.share` kann.
- **Fachwort-Hilfe:** `fw(label, begriff)` macht einen Begriff antippbar, `openFachwort()` zeigt den passenden Lexikon-Eintrag (Text, Tipps, Sprung ins Lexikon und zum Bildschirm). Eingebaut im Spielerdetail (Stärke, Moral, Fitness, Marktwert) und im Verlängerungs-Assistenten (Gehaltsbudget). Neue Begriffe müssen als Eintragstitel im Lexikon stehen; `testStatistikWerkzeuge` prüft, dass jedes Fachwort einen Eintrag findet.
- Test: `testStatistikWerkzeuge`.

### 26.4 Manager-Werkzeuge (`js/manager-tools.js`)
- **Liquiditäts-Vorschau** (Finanzen, Übersicht): Ø Netto je Spieltag aus `game.financeLedger` (letzte 6 Abrechnungen, Heim und Auswärts getrennt), Kasse in 5 und 10 Spieltagen, Hinweis „rutscht in etwa N Spieltagen ins Minus“. Einmalige Käufe, Bauten und Handgelder sind ausdrücklich nicht eingerechnet (steht im Text).
- **Konto-Alarm:** Grenze in `financeCentralState.kontoAlarm`; `checkKontoAlarm()` (nach jeder Spieltagsabrechnung) meldet das Unterschreiten genau einmal im Postfach und per Meldung und schärft sich wieder, wenn die Kasse darüber liegt; Vorwarnung, wenn die Kasse bei diesem Schnitt in drei Spieltagen unter die Grenze fällt.
- **Spieler-Etiketten:** sechs feste (Verkaufskandidat, Aufbauspieler, Stammkraft, Beobachten, Vertrag klären, Schonen) im Spielerdetail umschaltbar, als Chips auf der Kaderkarte, Filterleiste in der Kaderliste; „Schonen“ in der Startelf erscheint im Aufstellungs-Check.
- **Manager-Assistent** (Dashboard): bis zu drei nächste Schritte nach Dringlichkeit (Aufstellungsfehler 95, Minus-Kasse 92, auslaufende Verträge 85, offene Angebote 88 (seit 3.130), Profivertrag-Entscheidung 72, erschöpfte Stammspieler 65, Verträge mit einem Jahr Rest 55, verletzte Stammspieler 50, viele ungelesene Nachrichten 20), jeweils mit Knopf; sonst „alles im grünen Bereich“.
- **Lizenz-Laufbahn (Regeländerung, freigegeben):** Die Trainerlizenzen C/B/A/Pro gab es schon (`licenseConfig`, Kauf aus dem Privatvermögen, +0/+1/+2/+4 Teamstärke); neu sind **Voraussetzungen**: B nach 1 abgeschlossenen Saison, A nach 3 Saisons und Manager-Level 3, Pro nach 6 Saisons, Level 6 und 1 Trophäe. `upgradeLicense()` nennt jetzt per Meldung, was fehlt oder warum der Kauf nicht geht (vorher stiller Knopf); der Privatleben-Bildschirm zeigt die Laufbahn mit erfüllten und offenen Voraussetzungen. Die Boni selbst sind unverändert; bereits gekaufte Lizenzen in alten Spielständen bleiben gültig.
- Test: `testManagerWerkzeuge`.

## 3.130: Feinschliff nach Phase 26
- **Sichtprüfung:** Spieltag-Check, Vorlagen, Verlängerungs-Assistent, Serien, Liquiditäts-Vorschau, Manager-Assistent, Lizenz-Laufbahn, Spielbericht, Fachwort-Fenster und Spielerdetail in Flutlicht, Tageslicht und Kontrast, jeweils normal und „Sehr groß“ (390 px): keine Überläufe, keine Kontrastfehler. `testKontrastAlleThemes` prüft jetzt auch Spieltag-Check, Verlängerungs-Assistent, Spielbericht und Fachwort-Fenster (liegen außerhalb von `.app-content`).
- **Doppelte Hinweise zusammengelegt:** Der alte Erschöpfungs-Kasten (`#prematch-fatigue-box`) ist im Rotations-Assistenten des Spieltag-Checks aufgegangen (Chip „erschöpft“, Liste, Knopf „Ausgeruhte Elf aufstellen“; `renderFatigueWarning()` leert den alten Kasten und zeichnet den Check, auch vor Pokalspielen). Die Zeile „unter 50 % fit“ im Aufstellungs-Check entfällt. Der Dashboard-Kasten „offene Transferangebote“ (`#dash-offers-alert`) entfällt, der Manager-Assistent führt die Angebote mit Priorität 88 (vor auslaufenden Verträgen, damit sie nie aus den drei Plätzen fallen).
- **Etiketten greifen ein:** Angebotskarten zeigen „Verkaufskandidat – passt zum Plan“ bzw. warnen bei „Stammkraft/Aufbauspieler“; der Verlängerungs-Assistent sortiert „Vertrag klären“ nach oben und zeigt den Chip; der Manager-Assistent meldet „Beobachten“-Spieler nur bei Auffälligkeit (verletzt, Form fällt oder steigt, Vertrag endet bald) und springt in den gefilterten Kader.
- **Entprellt:** `renderManagerAssistant()` schreibt das DOM nur bei geändertem Inhalt. Gemessen bei 6-facher CPU-Drosselung: `updateUI()` 2,55 → 0,81 ms, Assistent 1,22 → 0,16 ms.
- **Fixture:** `tests/fixtures/saves/v3.129.json` (12 Spieltage, Aufstellungs- und Taktikvorlage, Etiketten); `testAeltereStaende` prüft, dass Vorlagen, Etiketten und Serien erhalten bleiben.
- **Langzeit-Messung mit den neuen Modulen (Build 3.129, je 1 Lauf, 20 Saisons):** aktiv Bundesliga von Saison 1 bis 20, keine Entlassung, 11 Talentverkäufe (26,8 Mio. €), kein Absturz, keine Konsolenfehler; passiv 5 Abstiege bis Liga 6 (erwartet, Kader wird nie angefasst), ebenfalls ohne Absturz. Serien, Konto-Alarm, Formnoten und Lizenz-Hooks laufen über 20 Saisons fehlerfrei.

## 3.131: Vier weitere Werkzeuge (Phase 26.6)
Vor dem Bauen gegen den Bestand geprüft: Die geplante **Zwischenbilanz nach Spieltag 17** entfällt, weil das Winterpausen-Gespräch (`js/winter-talk.js`, Spieltag 18-20) die Hinrunden-Bilanz schon zeigt.
- **Spieler-Vergleich** (`js/player-compare.js`, Fenster `#compare-overlay`, Knopf im Spielerdetail): zwei Spieler nebeneinander mit ✓ beim besseren Wert und Zählung „X vorn“. Der erste Spieler darf aus Kader, Transfermarkt, Scouting oder Jugend kommen, der zweite wird aus dem eigenen Kader gewählt (Standard: bester andere Spieler derselben Position). Alter, Marktwert und Vertragslaufzeit haben keinen Sieger, fehlende Werte (z. B. Gehalt externer Spieler) zählen nicht.
- **Verletzungs-Verlauf** (`logPlayerInjury()`, `renderInjuryHistory()` in `js/medical-department.js`, Container `#pd-injuries`): `p.injuryLog` hält die letzten 8 Ausfälle (Saison, Spieltag, Dauer, Anlass: Spiel, Länderspiel, Ereignis, bei Verpflichtung entdeckt). Reine Buchführung an den vier Stellen, an denen Verletzungen entstehen; die Regeln bleiben unverändert (ein System pro Bereich).
- **Vorlage im Spieltag-Check** (`js/matchprep.js`, Abschnitt „Aufstellung aus Vorlage“): jede gespeicherte Vorlage mit Stärke, Abstand zur aktuellen Elf und zum Gegner (`pendingMatchInfo.oppStr`), Ausfälle werden wie beim Laden ersetzt (`resolveLineupPreset()`), ein Tipp stellt auf. `getLineupStrengthPreview()` tauscht Elf und Formation nur kurz und stellt sie wieder her; die Vorschau stimmt mit `calcTeamStrength()` nach dem Aufstellen überein.
- **Gegner-Notizbuch** (`game.gegnerNotizen`, höchstens 300 Zeichen je Verein, über Saisons erhalten): Notizfeld im Spieltag-Check, Chip „Notiz vorhanden“, Liste mit Löschen im Reiter Analyse (`#opp-notes-box`). Alte Spielstände ohne das Feld werden ergänzt.
- Test: `testVergleichUndNotizen`; `testKontrastAlleThemes` prüft zusätzlich Vergleichsfenster und Verletzungs-Verlauf. Sichtprüfung in Flutlicht, Tageslicht, Kontrast (normal und „Sehr groß“): Kontrastfehler beim Notizbuch-Titel im Theme Kontrast gefunden und behoben (`--purple` statt `--violet`).

## 3.132: Feinschliff 2 (Phase 26.7)
- **Bilanz im Notizbuch:** Der Spieltag-Check zeigt über dem Notizfeld die Bilanz gegen den Gegner (S/U/N, Tore, letzte drei Ergebnisse). Die Daten gab es schon (`game.headToHeadRecords`, gepflegt in `updateLeagueTable`, angezeigt in der Vereinsakte und im Vorhersage-Kasten); nichts neu erfasst, nur eingebunden.
- **Vergleich direkt von der Karte:** `openPlayerCompare(id, pool)` mit Angaben öffnet ohne Umweg über das Spielerdetail; Knopf „⚖️“ auf Transfermarkt-Karten, „⚖️ Vergleich“ auf Kaderkarten (Kaderspieler gegen Kaderspieler).
- **Ausfall-Rangliste** im Medizin-Panel (`getInjuryRanking()`, `renderInjuryRanking()`): wer die meisten Spiele verpasst hat, Summe der laufenden Saison, Antippen öffnet den Verlauf im Spielerdetail. Aus `p.injuryLog`, keine neue Regel.
- **Fokus in neu gezeichneten Fenstern:** Das Fenstersystem (`js/ui-core.js`) setzte Fokus beim Öffnen und stellte ihn beim Schließen wieder her; verloren ging er, wenn ein offenes Fenster seinen Inhalt ersetzte (Wechsel im Vergleich, Verlängern im Assistenten). `mpFokusHalten()` (js/matchprep.js) holt ihn dann zurück. Test mit echter Tastatur (Enter, Pfeil, Escape).
- **Startzeit nach Phase 26 gemessen** (4-fache CPU-Drosselung, Median von 6 Starts, minifizierte Datei, mit Bot-Last im Hintergrund): 3.125 → 1,41 s und 1,66 MB, 3.131 → 1,34 s und 1,72 MB (+3,8 % Größe). Keine Verschlechterung, nichts zu tun.
- **Altpunkte:** Kalender-Aktionen haben eine einheitliche Form (`.cal-aktionen`, vorher Pillen und Rechtecke mit uneinheitlichem Abstand). Bei der Sichtprüfung gefunden und behoben: Die Kader-Reiter (und alle `.hub-tab-bar`) brachen bei „Sehr groß“ mitten im Wort („Aufstellun-g“); jetzt zwei Spalten bei „Sehr groß“, bei „Groß“ unter 400 px und unter 340 px, dazu `hyphens: auto` auf Knöpfen. Fahrtart-Knöpfe (Finanzen) und „Entsenden“ (Scouting) brechen in einer Spalte um, wenn zwei nicht passen. Bekannt und offen: bei 320 px und normaler Schrift sind einige Knöpfe in Industrie und Holding für einzelne lange Wörter („Auftrag“, „Manager-Dividende“) zu schmal.
- Die Spielfeld-Namensschilder bleiben bewusst unverändert (Illustration, ein Eingriff würde das Bild verändern).
- **Langzeit-Messung (Build 3.131, aktiv, je 1 Lauf):** Start Liga 4 nach 20 Saisons in der 2. Liga (2 Aufstiege, 20 Talentverkäufe); Start Liga 6 nach 20 Saisons in der 2. Liga (5 Aufstiege, 1 Abstieg); erzwungene Entlassung (Saison 3) greift. Keine Abstürze, keine Konsolenfehler.
- Test: `testFeinschliffNachPhase26`.

## Testdatei aufgeteilt (auf dem Feature-Branch, noch nicht gemergt; Version folgt beim nächsten Merge)
- `tests/run-tests.js` (über 11.000 Zeilen, 171 Suiten) ist jetzt nur noch der Ablauf (rund 290 Zeilen: Browser starten, Suiten parallel laufen lassen, Zusammenfassung). `tests/lib.js` hält `assert`, `freshPage`, `GAME_PATH`, die Zähler (`stats`) und die Ausgabepuffer paralleler Suiten. Die Suiten liegen nach Themen in `tests/suites/` (01 Grundlagen, 02 Spielstand, 03 Transfers und Verträge, 04 Kader/Jugend/Training, 05 Wirtschaft und Finanzen, 06 Spiel und Live, 07 Liga und Wettbewerbe, 08 Vorstand und Karriere, 09 Personal, 10 Darstellung und Zugänglichkeit, 11 Phase-26-Werkzeuge, 12 ältere Aufräumphasen). Jede Datei exportiert ihre `test…`-Funktionen; `run-tests.js` lädt alle Dateien und führt sie in der Liste `suites` aus.
- Mechanisch erzeugt (Skript), Inhalt der Suiten unverändert (nur `__dirname` → `TESTS_DIR`). Abgleich vor und nach dem Aufteilen am selben Build: 171 Suiten, 1603 bestanden, 0 fehlgeschlagen, `TEST_ONLY`, `GAME_FILE` (minifiziert) und `npm run check` unverändert.

## Phase 26.8 bis 26.10: Feinschliff 3 (Feature-Branch, noch nicht gemergt)
- **Fristen im Manager-Assistenten** (`getManagerTodos(alle)`): Transferfenster schließt in höchstens 2 Spieltagen (Sommer: `SUMMER_WINDOW_LAST_MATCHDAY`, Winter: `winterWindowCloseMatchday`), Hauptsponsor läuft in ≤6 Spieltagen aus oder bietet eine Verlängerung an (Priorität 75/68), Kasse deckt weniger als drei Kreditraten (78). Angezeigt bleiben höchstens drei Schritte. Der Parameter `alle` liefert die ungekürzte Liste (für Tests).
- **Kaderplaner mit Ausfällen** (`js/squadplanning.js`): je Position „aktuell nur N von mindestens M einsatzbereit“ (mit den Ausfällen) und verletzungsanfällige Spieler (ab 3 Verletzungen) bei dünner Besetzung. Eigener Hinweis, die Risikostufe (`riskScore`) bleibt unverändert.
- **Bilanz je Aufstellungsvorlage** (`game.vorlageBilanz`, `game.vorlageImEinsatz`): `markPresetInUse()` merkt sich beim Anstoß (nur Ligaspiele über `startMatchdayFlow()`), ob die Startelf samt Formation einer Vorlage entspricht und wie die Stärke zum Gegner stand; `recordPresetResult()` (aus `recordOwnLeagueResult`) trägt S/U/N, Tore und den Ø-Abstand ein. Anzeige auf der Vorlagenkarte und im Spieltag-Check. Slot neu belegt oder gelöscht: Bilanz beginnt von vorn; ein Merker eines anderen Spieltags zählt nicht (simulierte Spieltage).
- **Enge Handys:** Die Knopf-Wort-Prüfung ist Dauertest (`testKnopfWorteHandy`: 320 px normal, 360 px groß, 390 px sehr groß, alle Bildschirme außer Admin; Bindestrich-Wörter dürfen umbrechen). Gefunden und behoben: Industrie-Aufträge, Holding-Kapitaltransfer, Stadion-Sonderausbauten und Transfer-Reiter (`repeat(auto-fit, minmax(min(100%, Nem), 1fr))` statt feste zwei oder drei Spalten).
- **Kaderliste auf dem Handy:** Messung bei 6-facher CPU-Drosselung und 40 Spielern: `renderSquadView()` 482 ms. 63 % davon kamen vom Kader-Radar, das mitten im Neuzeichnen `container.offsetWidth` las und so ein komplettes Layout erzwang. Feste Größe mit `viewBox` (schrumpft über `max-width`): 120 ms gesamt, Radar 3,9 ms. Test prüft, dass beim Zeichnen keine Breite gelesen wird.
- **Laufzeit von `npm run check`:** `testLoadingGuard` wartete ohne JavaScript jedes Mal volle 20 s auf eine Bedingung, die dort nie eintreten kann (jetzt `waitForLoadState('load')`: 23 → 2,3 s). Der Kontrast-Test speichert den Hintergrund je Element zwischen (je Scan geleert): 22 → 14,7 s. Mehr Parallelität bringt auf vier Kernen wenig (TEST_JOBS 3: 111 s, 4: 108 s, 6: 96 s), darum bleibt 3 der Standard.
- **README** auf den Stand gebracht (npm run check, Phase-26-Werkzeuge, Darstellung und Zugänglichkeit, Bot).
- **Etiketten mit Wirkung (Regeländerung, mit „Alle“ freigegeben):** `ETIKETT_WIRKUNG` in `js/manager-tools.js`, angewendet nach jedem eigenen Spiel in `processPostMatchRoutine()` (Moral, Mehrermüdung) und im Verletzungswurf der Spieler, die gespielt haben. Stammkraft: +1 Moral bei Einsatz (nur bis 90), −2 Moral auf der Bank (nicht unter 45; Verletzte und Gesperrte ausgenommen). Aufbauspieler: +1 Moral bei Einsatz (bis 90), keine Unzufriedenheit auf der Bank. Schonen: spielt er trotzdem, Verletzungsrisiko ×1,3 (auf der Bank gibt es kein Verletzungsrisiko, daher dort keine Wirkung; bewusst keine Mehrermüdung, siehe Messung). Verkaufskandidat, Beobachten und Vertrag klären bleiben Planungshilfen. Das Spielerdetail erklärt die Wirkung.
  - Messung (Bot aktiv, `ETIKETTEN=stamm|schonen|beides`: vor jedem Spieltag die elf Stärksten als Stammkraft und/oder die drei Stärksten als Schonen, die trotzdem durchspielen; je Variante 3 Läufe × 12 Saisons, Bundesliga-Start, Ø über alle Saisons):

    | Variante | Ø Platz | Ø Punkte | Entlassungen |
    |---|---|---|---|
    | ohne Etiketten (drei unabhängige Messungen) | 7,39 / 6,94 / 7,11 | 52,1 / 53,4 / 53,7 | 0 |
    | nur Stammkraft | 7,64 | 52,3 | 0 |
    | Stammkraft + Schonen, mit 3 Punkten Mehrermüdung | 8,78 | 47,8 | 1 |
    | Stammkraft + Schonen, mit 1 Punkt Mehrermüdung | 10,94 | 44,1 | 1 |
    | nur Schonen, ohne Mehrermüdung (endgültig) | 6,92 | 53,3 | 0 |
    | Stammkraft + Schonen, ohne Mehrermüdung (endgültig) | 7,00 | 52,4 | 0 |

    Erkenntnis: Schon ein Punkt zusätzlicher Fitnessverlust je Spiel verschiebt bei Dauerspielern das Fitness-Gleichgewicht dauerhaft nach unten (die Fitness geht multiplikativ in die Stärke ein) und kostet mehrere Punkte je Saison; deshalb wirkt „Schonen“ nur noch über das Verletzungsrisiko. Die Moral-Boni (nur bis 90) liegen im Rauschen der Basislinie. Direktmessung mit festem Zufall (1500 Spiele): Verletzungsquote der drei Etikettierten 2,84 % → 3,31 %.

## 3.133 und 3.134
- **3.133** (alle Punkte der Phase 26.8 bis 26.10 und die aufgeteilte Testdatei) ging mit grünem lokalem `npm run check` auf `main`, die CI scheiterte aber in `testKnopfWorteHandy` (320 px, normale Schrift): In der CI-Umgebung ist die Schrift breiter, und „💾 Speichern“ in der Zeile „Eigene Vorlagen“ im Trainingsbildschirm (Eingabefeld und Knopf nebeneinander) wurde auf 60 px Innenbreite gedrückt, schmaler als das Wort. Der Deploy wurde dadurch übersprungen (die Veröffentlichung hängt an grünen Tests).
- **3.134:** Knopf mit `flex:0 0 auto; white-space:nowrap`, Eingabefeld mit `min-width:0` (gibt nach). Lehre: Der neue Wortbruch-Test findet echte Engstellen, die von der Schriftbreite abhängen; lokal unauffällige Zeilen mit `width:auto` neben einem `flex:1`-Feld sind die typischen Kandidaten.

## Phase 26.11 bis 26.12: Feinschliff 4 (Version 3.135)
- **CSV-Export des Kaders** mit den Spalten Etiketten, Verletzungen (gesamt) und verpasste Spiele (letzte Ausfälle).
- **Rückkehr-Termine** im Manager-Assistenten (`getReturnInfo()`, `getReturnLineHtml()`): „🩹 Zurück: ⭐ Name in 1 Spiel, … und N weitere“, Stammspieler (die elf Stärksten) zuerst, Gesperrte gekennzeichnet. Aus `p.injured` und `p.suspended`, keine neue Regel.
- **Schritte zurückstellen** (`game.assistentZurueck`, `snoozeManagerTodo()`, `resetManagerSnooze()`): Jeder Schritt hat eine feste Kennung; „⏸️ Später“ blendet ihn 3 Spieltage aus (verfällt mit der Saison), „Alle wieder zeigen“ holt alles zurück. Aufstellungsfehler und Minus-Kasse sind nicht zurückstellbar.
- **Vorlagen-Bilanz je Saison** (`game.vorlageBilanzArchiv`, `archiveVorlageBilanz()` im Saisonende): Die Bilanz zählt pro Saison, wird danach archiviert (die letzten fünf) und beginnt neu. Kasten „Bilanz der Aufstellungsvorlagen“ im Reiter Analyse mit 🏅 für die beste Vorlage (Punkte je Spiel, mindestens drei Einsätze), dazu eine Postfach-Meldung zum Saisonende.
- **Notiz und Bilanz zum Gegner in der Halbzeit-Ansicht** (`renderHalftimeNotiz()`, `#halftime-notiz-box`).
- **Sichtprüfung der neuen Teile** (Flutlicht, Tageslicht, Kontrast, jeweils normal und „Sehr groß“): Gefunden und behoben: die Assistent-Zeile mit zwei Knöpfen lief bei „Sehr groß“ über den Rand (jetzt Umbruch), das Notizfeld im Spielerdetail ragte 6 px hinaus (`.modal-field-grid` mit `minmax(0, 1fr)`). `testKontrastAlleThemes` deckt Assistent, Kaderplaner-Ausfälle, Vorlagen-Bilanz, Gegner-Notizbuch, Ausfall-Rangliste, Etiketten-Erklärung und Halbzeit-Notiz ab.
- **Stresstest mit breiterer Schrift** (`testKnopfWorteHandy`): zusätzlich zu 320/360/390 px wird jede Konfiguration mit 5 % mehr Zeichenabstand (rund 9 % breiter, wie in der CI) geprüft, außerdem, dass die Seite nie breiter als der Bildschirm wird. Der Test setzt jetzt einen festen Zufall schon vor dem Start (Kadernamen, Gerüchte, Saisonziele waren sonst bei jedem Lauf anders und die Ergebnisse flackerten). Gefunden und behoben: Kalender-Aktionen, Rasenpflege im Stadion, Rohstoffkäufe und Privatleben (feste zwei oder drei Spalten → `auto-fit`), die Saisonziel-Zeilen im Dashboard und **die Namensschilder auf dem Spielfeld**: Randspieler mit langem Namen machten die Aufstellungsansicht bei 320 px breiter als der Bildschirm. Das Schild ist jetzt nach dem Abstand zum Rand in der Breite begrenzt, gekürzt wird nur der Name (`.pin-name`), Stärke und Symbole bleiben (`.pin-rest`).
- **Layout-Lesen und Renderzeiten** (6-fach gedrosselt, 40 Spielern, mit erzwungenem Layout nach dem Neuzeichnen): Alle `offsetWidth`/`getBoundingClientRect`-Zugriffe in Render-Pfaden gesucht; übrig ist nur `financial-charts.js` (einmal je Neuzeichnen der Finanzen, unkritisch) neben dem Scrollen der Tickerlisten. Teuer ist das Layout der langen Kartenlisten: Kaderansicht 517 ms, Vertragsliste 367 ms, Training 187 ms, Transfer 100 ms. `content-visibility: auto` für Kader-, Vertrags-, Transfermarkt- und Vereinslosen-Listen senkt das auf 196 ms (Kader) und 159 ms (Verträge); optisch unverändert. Dashboard (5 ms), Finanzen (31 ms), Spielerdetail (66 ms) und die übrigen Bildschirme sind unkritisch.
- **Skripte** laden Playwright über `scripts/playwright-laden.js` (erst `tests/node_modules`, dann ein global bereitgestelltes Paket), damit Bot und Messskripte auch ohne `npm install` im Ordner `tests/` laufen.
- Tests: `testRunde27Funktionen` (jetzt 17 Prüfungen) und erweiterte Suiten; `npm run check` zuletzt 1635 Tests (nur Standalone-Lauf, der volle Check folgt vor dem Merge).

## 3.135
- Der erste Merge-Versuch scheiterte in der CI an `testKnopfWorteHandy` (320 px, breitere Schrift): „Verstanden“ im Tipp-Kasten (`js/onboarding.js`) war in einer nicht umbrechenden Knopfreihe zu schmal. Die Reihe darf jetzt umbrechen (`flex-wrap`), die Knöpfe behalten ihre Textbreite. Deployt wurde nichts, weil die CI vor dem Veröffentlichen testet; derselbe Stand ging danach als 3.135 durch.

## Phase 26.13: Feinschliff 5 (Version 3.136)
- **Layout-Test mit echter breiter Schrift** (`testKnopfWorteHandy`): Die CI-Maschine hat statt der Standardschrift eine breitere (DejaVu Sans, rund 12 % breiter). Neu: die Schrift wird auf DejaVu Sans gestellt (320/360/390 px), dazu 280 px (kleinste Handys, normale Schrift) und Querformat 640 × 360; der Buchstabenabstand im Stressmodus ist jetzt 0,08 em. Die untere Navigation (`.bottom-nav-bar`) ist jetzt in der Prüfung (unter 300 px ausgenommen, dort gelten gleich breite Spalten mit Auslassungspunkten).
  - Gefunden und behoben: Die sieben Spalten der unteren Navigation waren gleich breit (46 px bei 320 px), „Speichern“ braucht 56 px und wurde abgeschnitten; die Spalten richten sich jetzt nach der Textbreite (`minmax(min-content, 1fr)`). Die Reiterleisten der Hubs (`.hub-tab-bar`, 13 Stück) und die Trainings-Voreinstellungen waren feste 3 oder 4 Spalten; jetzt `repeat(auto-fit, minmax(min(100%, 8.8em), 1fr))` („Regeneration“, „Transfermarkt“ passen auch in breiter Schrift und im Querformat). Der Transfer-Reiter nutzt 9 em.
- **Notiz nach dem Abpfiff** (`openNachspielNotiz()`, `getNachspielNotizEntwurf()` in `js/matchprep.js`, Fenster `#opp-note-overlay`): Nach jedem Spiel erscheint „📓 Niederlage notieren“ (nach Niederlage hervorgehoben) oder „📓 Notiz zum Gegner“. Das Fenster zeigt Bilanz und die vorhandene Notiz plus einen Entwurf „Sp. 12: Niederlage 0:2 (heim).“; gespeichert wird nur auf Tipp, über 300 Zeichen werden die ältesten Zeichen gekürzt. `renderGegnerNotizSection()` hat jetzt ein eigenes Feld-ID je Aufrufer, damit es keine doppelten IDs gibt.
- **Etiketten-Bilanz** (`js/manager-tools.js`, `game.etikettBilanz`, `game.etikettBilanzVorjahr`, `game.etikettImEinsatz`): Für jedes im Kader vergebene Etikett werden die Ligaspiele der Saison danach gezählt, ob ein Spieler mit diesem Etikett in der Startelf stand („mit“) oder nicht („ohne“): Spiele, S/U/N, Tore, Punkte je Spiel. Das Urteil („mit besser“, „ohne besser“, „kein klarer Unterschied“, Schwelle 0,3 Punkte) erscheint erst ab fünf Spielen je Seite; dazu der Hinweis, dass das keine Ursache belegt. `markTagsInUse()` merkt die Startelf vor dem Anpfiff (neben `markPresetInUse()`), `recordTagResult()` zählt in `recordOwnLeagueResult()`; ohne Merker (simulierte Spieltage) gilt die aktuelle Startelf. Am Saisonende wandert die Bilanz nach `etikettBilanzVorjahr` (`archiveTagBilanz()`). Kasten im Reiter Analyse. Nur Auswertung, keine Regeländerung.
- **Verletzungs-Warnung im Spieltag-Check** (`getFragileStarters()`): Spieler der Startelf mit mindestens drei Verletzungen oder dem Etikett „Schonen“ erscheinen mit Chip „🩹 N verletzungsanfällig“, einem Aufklapp-Abschnitt (Verletzungen, verpasste Spiele aus `p.injuryLog`) und dem stärksten einsatzbereiten Ersatz auf derselben Position (mindestens 60 % fit) samt Stärkeunterschied; „🔄 Schonen und … bringen“ tauscht über `applyRotationSwap()` (Meldung jetzt „X ersetzt Y“). Nur ein Hinweis.
- **Saisonrückblick** (`js/insights.js`: `getReviewSeasons()`, `buildSeasonReviewHtml()`, `openSeasonReview()`, `announceSeasonReview()`, Fenster `#season-review-overlay`, Knopf-Kasten `#season-review-box` im Reiter Analyse): Ein Fenster je abgeschlossener Saison (die letzten drei) mit Tabelle (aus `game.managerCareer`), bester Aufstellungsvorlage, Etiketten-Bilanz (nur die letzte Saison ist archiviert), Transferbilanz, Ausfällen der heutigen Spieler (aus `p.injuryLog` der Saison) und den Notizen zu Gegnern. Zum Saisonende kommt eine Postfach-Nachricht statt eines automatischen Fensters, weil sich ein Fenster mit den Meldungen des Saisonwechsels (Warteschlange von 12) stapeln würde.
- **Assistent: „Erledigt seit dem letzten Spieltag“** (`trackAssistentErledigt()`, `game.assistentVorher`, `game.assistentErledigt`): Verschwindet ein Schritt zwischen zwei Anzeigen im selben Spieltag aus der Liste (zurückgestellte zählen nicht, ebenso wenig auslaufende Fristen), steht er eingeklappt unter „✅ Erledigt …“. Ein Spieltagswechsel setzt die Liste zurück, ein wieder auftauchender Schritt verschwindet daraus.
- **Preis-Alarm** (Abweichung vom Vorschlag: der Transfermarkt wird bei jedem Neuaufbau komplett neu gewürfelt, ein dauerhafter Preis ließe sich dort nicht beobachten; deshalb hängt der Alarm an der bestehenden Scouting-Beobachtungsliste, deren Funde bis zur Verpflichtung bleiben): Zu beobachteten Spielern lässt sich eine Preisgrenze in Mio. € setzen (`scoutingNetwork.preisGrenzen`, `setScoutPriceAlarm()`). Liegt die Ablöse (`getScoutPrice()`, Marktwert mit Scout- und Synergie-Rabatt) darunter und reichen Kasse, Transferbudget und Kaderplatz (und keine Transfersperre), meldet der Manager-Assistent „🔔 Preis-Alarm“. Der Preis ändert sich durch Scout-Einstellung, Synergien und Marktwertänderungen; die Kasse durch Einnahmen.
- Tests: neue Suite `testRunde28Funktionen` (20 Prüfungen, davon eine für Knopfwörter in breiter Schrift bei 320 px) und erweiterter `testKnopfWorteHandy` (jetzt 11 Konfigurationen).

## Phase 26.14: Feinschliff 6 (Version 3.136)
- **Saisonrückblick mit Vorsaison-Vergleich und Text** (`js/insights.js`): Unter der Tabelle steht „Vorsaison: Platz 5, 44 Punkte → +12 Punkte, Platz +2, Tordifferenz +15“ (bei anderer Liga der Hinweis, dass Punkte nicht vergleichbar sind), unter den Transfers der Saldo der Vorsaison samt Unterschied. „📋 Als Text kopieren oder teilen“ schließt den Rückblick und öffnet das Teilen-Fenster des Spielberichts (`#share-report-overlay`, Titel je Aufruf umgestellt) mit dem Rückblick als reinem Text (`buildSeasonReviewText()`).
- **Dashboard-Knopf zum Rückblick** (`renderSeasonReviewHint()`, `#season-review-hint`, `game.rueckblickGesehen`): Nach dem Saisonwechsel steht bis zum dritten Spieltag „📚 Saisonrückblick N öffnen“ über dem Manager-Assistenten, bis der Rückblick einmal geöffnet wurde. Aufgerufen aus `renderManagerAssistant()`. Es öffnet sich nichts von selbst (Meldungswarteschlange von 12).
- **Marktwert-Hinweis** (`getMarketValueMoves()`, Schritt `marktwert` im Assistenten, Priorität 40): vergleicht den aktuellen Marktwert mit dem aus der Stärke der Vorsaison (`p.strengthHistory`; der Verlauf ist je Saison gespeichert, nicht je Spieltag). Ab +25 % und mindestens 300.000 € Unterschied „Zeit für einen Verkauf?“, ab −20 % eine reine Meldung. **Fehler im ersten Entwurf (vom Test gefunden):** `calculatePlayerMarketValue()` würfelt ±8 % Streuung, der Vergleichswert wäre bei jeder Anzeige ein anderer gewesen und der Hinweis hätte geflackert; `getMarketValueBase()` rechnet deshalb mit festem Mittelwert (`Math.random` kurz auf 0,5).
- **Bilanz je Spieler** (`p.startBilanz`, `recordPlayerStartResult()`, `renderPlayerStartBilanz()`, `#pd-startbilanz` im Spielerdetail): Ligaspiele der Saison mit und ohne den Spieler in der Startelf (S/U/N, Punkte je Spiel), Urteil erst ab fünf Spielen je Seite, mit Hinweis auf die fehlende Ursache. `markTagsInUse()` merkt jetzt auch die Startelf-IDs; gezählt wird in `recordTagResult()`, am Saisonende (`archiveTagBilanz()`) beginnt jede Bilanz von vorn. Neues Feld je Spieler: etwa 60 Byte.
- **Notizbuch mit Schlagwörtern und Suche** (`js/matchprep.js`, `NOTIZ_SCHLAGWOERTER`, `notizFilter`): Acht feste Schlagwörter (Konter, Standards, Pressing, Abwehr links/rechts, Flügel, Langer Ball, Heimstark) als Knöpfe unter dem Notizfeld (auch im Fenster nach dem Abpfiff, `aria-pressed`), gespeichert in `game.gegnerNotizen[verein].tags`. Im Notizbuch Suche (Verein, Text, Schlagwort) und Filter nach benutzten Schlagwörtern; beim Tippen wird nur die Liste neu gezeichnet, das Suchfeld behält den Fokus. Chips zeigen die Schlagwörter im Spieltag-Check und in der Halbzeit-Ansicht. Alte Notizen ohne Schlagwörter und unbekannte Schlagwörter bleiben unauffällig.
- **Sichtprüfung** (Flutlicht, Tageslicht, Kontrast, jeweils normal und Sehr groß): Notiz-Fenster, Rückblick, Spieltag-Check, Notizbuch, Etiketten-Bilanz, Scouting-Karte mit Preis-Alarm, Assistent, Spielerdetail. Gefunden und behoben: das Notizfeld nutzte die Monospace-Schrift des Browsers (`font-family: inherit`), der Platzhalter des Suchfelds war abgeschnitten („Notizen suchen“).
- **Testlaufzeit (Messung):** Der Lauf gegen den gebauten Stand braucht mit 3 parallelen Suiten 112 s, mit 4 Suiten 102 s (4 Kerne); bei 2 Kernen in der CI lohnt der Unterschied das Flackerrisiko nicht, der Standard bleibt 3. Summe aller 175 Suiten: 318 s; die längsten sind `testKnopfWorteHandy` (25 s), `testKontrastAlleThemes` (20 s), `testAeltereStaende` (12 s), `testMobileLayout` (12 s) und `testBedienelementeHabenNamen` (9 s); sie stehen jetzt alle in der Liste der Suiten, die zuerst starten, damit am Ende kein langer Rest übrig bleibt.
- Tests: neue Suite `testRunde29Funktionen` (14 Prüfungen, darunter Knopfwörter in breiter Schrift bei 320 px).

## Phase 26.15: Feinschliff 7 (Version 3.136)
Auf ausdrücklichen Wunsch („neue Funktionen, keine Test- und Messpunkte“) acht neue Funktionen; die zugehörigen Tests entstanden wie immer mit (`testRunde30Funktionen`, 18 Prüfungen).
- **Matchplan je Gegner** (`js/matchprep.js`: `game.matchplaene = { verein: { aufstellung: Slot|null, taktik: Slot|null } }`): Im Spieltag-Check verknüpft ein Abschnitt eine Aufstellungs- und/oder Taktikvorlage mit dem Gegner; „📋 Matchplan anwenden“ wendet beides an. **Fehler im ersten Entwurf (vom Test gefunden):** Die Taktikvorlage speichert auch eine Formation und überschrieb nach dem Laden der Aufstellung deren Formation, die Elf stand dann in der falschen Formation. Jetzt zuerst die Taktik, dann die Aufstellung (deren Formation gilt, von der Taktik kommen Spielstil und Härte), mit Hinweis im Abschnitt. Gelöschte Vorlagen werden als „gibt es nicht mehr“ gemeldet, ein Plan ohne gültige Vorlage sagt per Toast warum.
- **Belastungsampel** (`js/manager-tools.js`, `p.startFolge`): Punkte aus Fitness (unter 80/65/50: 1/2/3), Dauereinsatz (5 von 5 Ligaspielen in der Startelf: 1) und Verletzungen (2: 1, ab 3: 2); Rot ab 4, Gelb ab 2, Verletzte immer rot. Chip „🚦 Belastung rot/gelb“ samt Grund auf der Kaderkarte, Filter „🚦 Belastung rot (N)“ neben den Etiketten-Filtern. `p.startFolge` hält die letzten fünf Einsätze (1/0), gepflegt in `recordPlayerStartResult()`, nicht am Saisonende zurückgesetzt. Reine Anzeige.
- **Markt-Merkliste** (`js/transfermarket.js`, `game.marktMerkliste`, höchstens 8): „⭐ Merken“ auf der Marktkarte, Kasten oben im Markt-Reiter. Der Markt wird bei jedem Neuaufbau komplett neu gewürfelt; `syncMarktMerkliste()` (am Ende von `refreshTransferMarket()` und beim Zeichnen) meldet einmal per Postfach und Assistent-Schritt `merkliste-weg`, wenn ein gemerkter Spieler fehlt; gekaufte fallen still weg, ein leerer Markt ändert nichts, ein zurückgekehrter Spieler ist wieder „auf dem Markt“.
- **Notiz-Vorschläge** (`getNotizVorschlaege()`, `addNotizVorschlag()`): Antippbare Textbausteine aus öffentlichen Daten (Spielstil, Tabellenplatz und Stärke, Ø Tore/Gegentore ab 3 Spielen, letzte Duelle), eingefügt ohne Doppeleintrag und nur bis 300 Zeichen. Bewusst nicht der geheime Taktikplan des Gegners (`game.oppTacticPlan`), der bleibt dem Chef-Analysten vorbehalten.
- **Wischen zwischen Reitern** (neues Modul `js/swipe-tabs.js`, Einstellung `anstoss_fm13_wischen` über `designLesen()`/`designSchreiben()`, Standard an, Schalter im Bildschirm Darstellung): Wisch nach links/rechts (mindestens 70 px, höchstens 45 px senkrecht, doppelt so lang wie hoch, unter 700 ms, nicht innerhalb von 24 px vom Rand) wechselt in den Kader-Reitern und der Hub-Reiterleiste zum Nachbar; am Rand kein Umlauf. Gesperrt bei Eingabefeldern, offenen Fenstern, Meldungen, Spielfeld, Diagrammen, der unteren Navigation und Flächen, die selbst seitlich scrollen.
- **Zurückgestellte Schritte als Liste** (`unsnoozeManagerTodo()`): aufklappbar mit Grund und „bis Spieltag N“, „Wieder zeigen“ je Schritt; die Zählung gilt nur für noch bestehende Schritte (erledigte verschwinden), der Aufklappzustand bleibt beim Neuzeichnen erhalten.
- **Etiketten-Archiv** (`game.etikettBilanzArchiv`, fünf Saisons): Der Saisonrückblick zeigt Etiketten jetzt für alle drei Rückblick-Saisons; alte Spielstände fallen auf `etikettBilanzVorjahr` zurück.
- **Kader-CSV** mit Spalten „Startelf-Spiele (Saison)“, „Pkt/Spiel mit ihm in der Startelf“ und „Pkt/Spiel ohne ihn“.
- Neue Spielstand-Felder (alle mit Absicherung für alte Stände): `game.matchplaene`, `game.marktMerkliste`, `game.etikettBilanzArchiv`, `p.startFolge`.

## Phase 26.16: Feinschliff 8 (Version 3.137)
Acht weitere neue Funktionen (`testRunde31Funktionen`, 12 Prüfungen):
- **Aufstellung als Text teilen** (`buildLineupText()`, `shareLineup()`, Knopf unter der 3D-Taktiktafel): Formation, Spielstil, Härte, Spieler nach Positionen mit Stärke und (C) für den Kapitän, die sieben stärksten Ersatzspieler (verletzte markiert), Hinweis bei weniger als elf. Das Teilen-Fenster des Spielberichts wurde zu `openShareText(titel, text)` verallgemeinert; Saisonrückblick, Aufstellung und Archiv nutzen es.
- **Zuletzt geöffnet** (`js/one-hand.js`: `getZuletzt()`, `merkeZuletzt()`, `renderZuletzt()`, `#recent-screens-box` oben im Menü): die letzten fünf besuchten Bildschirme mit Menüeintrag, ohne den aktuellen und ohne Vorbericht/Livespiel; Beschriftung aus dem Menüeintrag (stimmt in jeder Sprache). Einstellung dieses Geräts (`anstoss_fm13_zuletzt` in localStorage), kein Spielstand. Die Knöpfe nutzen `data-s` statt Bildschirmnamen im `onclick`, damit die Menü-Hervorhebung (die `onclick` nach Namen durchsucht) sie nicht fälschlich markiert.
- **Leistbar-Chips auf Marktkarten** (`getKaufHindernisse()`, `getKaufChip()` in `js/transfermarket.js`): dieselben Prüfungen wie `finalizePlayerPurchase()` (Transfersperre, Kasse inklusive Beraterprovision, Transferbudget, Gehaltsbudget), nur ohne etwas zu ändern. „✓ leistbar“ oder „⛔ Grund, Grund“. Ein Test vergleicht den Chip mit dem echten Sofortkauf.
- **Rotations-Assistent mit Belastungsampel** (`getRotationSuggestions()`): Wer rot ist, oder bei Gelb im Dauereinsatz steht (5 von 5 Ligaspielen) und nicht schon einen Tausch hat, bekommt eine Pause vorgeschlagen, wenn ein Ersatz auf derselben Position mindestens 70 % fit, nicht selbst rot und höchstens 3 effektive Stärke schwächer ist; die Karte nennt „🚦 Belastung: …“. Der bisherige Fitness-Weg bleibt unverändert.
- **Eigene Erinnerungen** (`game.erinnerungen`, `game.erinnerungNr`, Fenster `#reminder-overlay`, `js/manager-tools.js`): Text (höchstens 80 Zeichen, Leerraum zusammengefasst) und Spieltag (1 bis 34), höchstens 10; ab dem Spieltag, oder in einer späteren Saison, erscheint „📝 Erinnerung: …“ als Schritt im Assistenten (Priorität 60) mit „Abhaken“. Knopf „📝 Erinnerungen (N)“ im Assistenten.
- **Spielbericht-Archiv** (`game.spielberichte`, `archiveMatchReport()` aus `endMatchSimulation()`): die letzten zehn Berichte von Livespielen (auch Pokal, 🏆) im Reiter Analyse, antippen öffnet das Teilen-Fenster; derselbe Spieltag ersetzt den alten Eintrag. Simulierte Spieltage haben keinen Bericht.
- **Vertragsplan** (`getVertragsplan()`, `renderVertragsplan()`, Kasten im Bildschirm Verträge): Am Saisonende zählt `contracts` um eins herunter und wer bei 0 steht, geht (`season-end.js`); Restlaufzeit 1 oder weniger heißt also Ende dieser Saison, 2 Ende der nächsten, 3 Ende der übernächsten. Je Saison Anzahl, die drei Stärksten, frei werdendes Gehalt, kumulierter Spielraum im heutigen Gehaltsbudget.
- **Saisonziel-Rechner** (`getSaisonZiele()`, `renderSaisonZiele()`, `#season-goal-box` im Dashboard): Bundesliga: Europa (Platz 4) und Klassenerhalt ohne Relegation (Platz 15); tiefere Ligen: direkter Aufstieg (Platz 2) und Klassenerhalt; unterste Liga nur Aufstieg. Außerhalb des Zielplatzes der Rückstand auf dessen Inhaber („nicht mehr erreichbar“, wenn auch alle restlichen Siege nicht reichen), innerhalb der Vorsprung auf den ersten Platz dahinter („gesichert“, wenn der Verfolger dich auch mit allen restlichen Siegen nicht mehr einholt). Reine Tabellenwerte, Torverhältnis zählt nicht.
- **Von den Tests gefunden und behoben:** „2 Vertrage“ statt „2 Verträge“ und „1 Vertrag laufen aus“ im Vertragsplan; der Status im Saisonziel-Rechner stand zuerst in einem nicht umbrechenden Chip und sprengte bei langen Vereinsnamen die Seitenbreite auf dem Handy (jetzt umbrechender Text); frei eingegebene Texte (Erinnerungen, Notizen, Rückblick) haben `overflow-wrap:anywhere`, damit ein langes Wort ohne Leerzeichen die Seite nicht verbreitert.
- Neue Spielstand-Felder (alle mit Absicherung für alte Stände): `game.erinnerungen`, `game.erinnerungNr`, `game.spielberichte`.

## Phase 26.17: 24 neue Funktionen (Version 3.137)
Drei Vorschlagslisten (1 bis 24) auf einmal umgesetzt, in vier Paketen mit je einer Testsuite (`testRunde32Markt`, `testRunde32Spieltag`, `testRunde32Uebersicht`, `testRunde32Statistik`). Keine Regeländerung.

**Paket A, Markt und Kader**
- **Marktfilter** (`marktFilter`, `getMarktAnsicht()`, `#market-filter-box`): Position, „✓ Nur leistbar“ (nutzt `getKaufHindernisse()`), Sortierung nach Stärke, Preis oder Alter; gilt nur für die Sitzung. Die Karten behalten ihren Index in `marketPlayers`, ein Test prüft, dass der Sofortkauf nach Filter und Sortierung den Spieler der Karte kauft.
- **Kaderlücke** (`openMarktFuerPosition()`): Positionen im Kaderplaner mit dünner Besetzung, Ausfall-, Alters- oder Vertragsrisiko bekommen „🔎 Passende Spieler auf dem Markt“.
- **Kaderfolgen bei Angeboten** (`getVerkaufsFolgen()`): Restbesetzung der Position gegen die Mindestbesetzung des Kaderplaners (`SQUAD_PLANNING_MIN_HEALTHY`), Startelf, bester Spieler und Nachfolger, auf jeder Angebotskarte.
- **Ersatz finden** (`getErsatzKandidaten()`, `#pd-ersatz`): bis zu drei Marktspieler gleicher Position, höchstens 3 Stärke schwächer, mit Preis, Leistbar-Chip und Vergleich.
- **Kompakte Kaderliste** (`renderKaderZeile()`, Gerät: `anstoss_fm13_kaderansicht`): eine Zeile je Spieler mit Stärke, Fitness, Moral, Vertrag, Ampel und Startelf-Knopf. Die Liste wird über `getSquadListeSortiert()` gebildet (aus `renderSquadView()` herausgelöst), damit Karten, Zeilen und Blättern dieselbe Reihenfolge haben.
- **Blättern im Spielerdetail** (`blaetterSpielerDetail()`, `#pd-nav`): ‹ ›, Position „3 / 22“, Reihenfolge der Herkunftsliste (Kader wie gefiltert, Markt wie gefiltert, sonst der Bereich); ein Wisch im offenen Detail blättert ebenfalls (`swipeImSpielerdetail()` in `js/swipe-tabs.js`).
- **Spielersuche** (`sucheSpieler()`, Feld oben im Menü): ab zwei Zeichen, ohne Groß-/Kleinschreibung und Akzente, in Kader, Zweiter Mannschaft, Jugend, Markt, Vereinslosen und Scouting; höchstens acht Treffer.

**Paket B, Spieltag**
- **Tabellen-Vorschau** (`getTabellenVorschau()`): Platz nach 1:0, 0:0 und 0:1 bei sonst unveränderter Tabelle, auf Kopien gerechnet.
- **Lieblings- und Angstgegner** (`getGegnerBilanzListen()`, `#gegner-bilanz-box` im Reiter Analyse): aus `game.headToHeadRecords`, ab zwei Duellen, Lieblingsgegner ab 2,0 Punkten je Spiel, Angstgegner bis 0,75; Chip im Spieltag-Check.
- **Spielstil-Empfehlung** (`getStilEmpfehlung()`): nach der vorhandenen Regel des Taktik-Duells; ohne Chef-Analyst der öffentlich bekannte Grundstil, mit Analyst dessen Plan. „Übernehmen“ setzt den Stil; der Hinweis nennt, dass andere Wirkungen des Stils bleiben.
- **Rekord-Hinweise** (`getRekordHinweise()`): aus `game.serien`, z. B. „Mit einem Sieg: neuer Vereinsrekord, 6 Siege in Folge“, endende Serien, Negativrekorde; die Heimserie nur bei Heimspielen.
- **Empfohlene Vorbereitung** (`getEmpfohleneVorbereitung()`, `applyEmpfohleneVorbereitung()`): Matchplan, sonst Rotationstausche, dazu die Stil-Empfehlung, falls kein Matchplan eine Taktik setzt; Liste der Änderungen und ein Knopf, eine Sammelmeldung statt vieler Einzelmeldungen.
- **Ampel im Livespiel**: Raus-Liste und Wechselbank zeigen Fitness und Belastungsampel.

**Paket C, Übersicht**
- **Restprogramm** (`getRestprogramm()`, `#rest-programm-box` im Dashboard): nächste fünf Gegner aus `fixturesData` mit Heim/Auswärts, Platz, Stärke und Symbolen für Notiz, Matchplan, Lieblings-/Angstgegner; Ø-Stärke und schwerste Phase (drei Spiele).
- **Zusammenfassung nach „5 Spieltage simulieren“** (`simulateMatchdays(anzahl, zusammenfassung)`, Fenster `#sim-summary-overlay`): eigene Ergebnisse, Bilanz, Tabellenplatz vorher → nachher, Kasse, neue Verletzte und Angebote. Nur der Dashboard-Knopf übergibt `true`; Bot, Tests und `simulateFullSeason()` bleiben ohne Fenster.
- **Kalender** (`getKalenderExtras()`): je Spieltag Gegner mit Ergebnis, eigene Erinnerungen, Tagebuch, Ende des Transferfensters und am 34. Spieltag die auslaufenden Verträge.
- **Managertagebuch** (`game.tagebuch`, Fenster `#diary-overlay`, Knopf im Kalender): eine Notiz je Spieltag (200 Zeichen), erscheint im Kalender und im Saisonrückblick.
- **Erinnern-Knöpfe** (`erinnerungVorbelegen()`): im Spielerdetail („Vertrag von X klären“ bei Restlaufzeit bis 2) und je Saison im Vertragsplan.
- **Tag/Nacht-Schnellschalter** (`wechsleTagNacht()`, `#theme-quick-btn` oben im Menü): Tageslicht ↔ Flutlicht über `setzeDesignTheme()`.
- **Favoriten-Leiste** (Gerät: `anstoss_fm13_favoriten`, `#favoriten-box` im Dashboard, Auswahlfenster `#favoriten-overlay`): bis zu vier Bildschirme aus dem Menü.

**Paket D, Statistik**
- **Tor-Meilensteine** (`pruefeTorMeilenstein()`, aus `creditOwnGoal()` und dem Relegations-Ticker): 10., 25., 50., 100., 150., 200. Tor mit Postfach-Nachricht. Das Pflichtspiel-Jubiläum gab es schon (Nachspiel-Ablauf, mit Moral und Fans); es setzt jetzt zusätzlich `p.meilenstein`. Beide zeigen drei Spieltage lang einen Chip auf der Kaderkarte.
- **Saisonverlauf** (Reiter im Liga-Bildschirm, `getSaisonverlauf()`): alle 34 Spieltage mit Ergebnis und Platz danach (aus `t.rankHist`), offene Spiele mit Platz und Stärke des Gegners; ein Tipp öffnet den archivierten Spielbericht, falls es einen gibt. Die Reiterleiste ist jetzt `auto-fit`.
- **Vorsaison im Tabellenverlauf** (`archivePlatzVerlauf()`, `game.platzVerlaufVorjahr`): Statt einer zweiten Platzierungskurve (der Tabellenverlauf in der Liga-Statistik existierte schon, „ein System pro Bereich“) zeichnet der vorhandene Verlauf in der eigenen Liga die Vorsaison gestrichelt mit Endplatz in der Legende.
- **Kaderwert-Kurve** (`archiveKaderwert()`, `game.kaderwertVerlauf`, höchstens 20 Saisons, `#kaderwert-box` im Reiter Analyse): Gesamtmarktwert am Saisonende plus heutiger Wert.
- Neue Spielstand-Felder (mit Absicherung): `game.tagebuch`, `game.kaderwertVerlauf`, `game.platzVerlaufVorjahr`, `p.meilenstein`. Neue Geräte-Einstellungen: Kaderansicht, Favoriten.

## Phase 26.18: Fünf neue Funktionen (Version 3.138)
Aus acht Vorschlägen; drei gab es schon und wurden nicht gebaut: Postfach anheften (★ Wichtig sortiert nach oben und schützt vor dem Löschen), Bilanz je Formation und Spielstil (Taktik-Bilanz, `game.tacticRecords` in `js/tactic-system.js`), Kader nächste Saison (Kaderplaner: Besetzung, Alter, auslaufende Verträge je Position, Restkader nach Vertragsende). Testsuite `testRunde33Funktionen`. Keine Regeländerung.
- **Kauf-Vorschau** (`getKaufVorschau()`, `renderKaufVorschau()` in `js/transfermarket.js`, im Spielerdetail von Marktspielern in `#pd-ersatz`; Chip „⚽ Startelf statt X“ auf der Marktkarte): ersetzt den schwächsten Starter derselben Position, wenn der Marktspieler stärker ist; Teamstärke vorher und nachher über `calcTeamStrength()` mit einer Kopie des Spielers (ohne Eingespieltheit, wie nach einem echten Kauf), Kader und Elf werden in `finally` wiederhergestellt. Dazu Kasse, Transferbudget und freies Gehaltsbudget nach dem Kauf.
- **Punkte-Vergleich mit der Vorsaison** (`getPunkteVerlauf()`, `getPunkteVergleich()`): Punkte nach jedem eigenen Ligaspiel aus dem Spielplan; `archivePlatzVerlauf()` speichert die Reihe als `game.platzVerlaufVorjahr.punkte`. Zeile im Saisonziel-Kasten des Dashboards und Kurve (Vorsaison gestrichelt) im Saisonverlauf. Ältere Archive ohne `punkte` zeigen nichts bis zum nächsten Saisonende.
- **Monatsbericht** (`schreibeMonatsbericht()` am Ende von `runMonthlyClubTicks()`, alle vier Spieltage): Postfach-Nachricht (Analyse) mit Bilanz, Ergebnissen, Tabellenplatz vorher → nachher, Spieltags-Einnahmen und -Ausgaben mit größtem Posten (`game.financeLedger`), Kasse seit dem letzten Bericht, Verletzten und dem Spieler des Monats (`game.playerOfMonthHistory`). `game.monatsStand` hält Spieltag, Platz und Kasse; in einer neuen Saison beginnt der Bericht bei Spieltag 1.
- **Rückkehrer im Kalender** (`getRueckkehrSpieltag()` in `js/calendar.js`): Verletzung und Sperre zählen je Spieltag herunter, der Kalender zeigt „🔙 Wieder dabei“ am Spieltag der Rückkehr; „Wer fehlt?“ im Spieltag-Check nennt „zurück ab SpT N“ oder „über das Saisonende hinaus“.
- **Aufstellungs-Gedächtnis** (`merkeStartelf()` aus `recordOwnLeagueResult()`, live und simuliert; `game.startelfGedaechtnis`, höchstens fünf): Startelf vom Anpfiff (Merkzettel `game.etikettImEinsatz`, jetzt mit Formation) mit Gegner und Ergebnis. Im Spieltag-Check und unter den Aufstellungsvorlagen mit heutiger Stärke; „Diese Elf aufstellen“ ersetzt Ausfälle wie bei Vorlagen (`resolveLineupPreset()`) und nennt sie.
- **Von den Tests gefunden:** Die Postfach-Kategorie „Analyse“ färbte den Titel mit `--violet`, das im Kontrast-Theme eine dunkle Fläche ist (Kontrast 1,66); die Kategorie war bis zum Monatsbericht unbenutzt. Jetzt `--blue`.
- Neue Spielstand-Felder (mit Absicherung): `game.startelfGedaechtnis`, `game.monatsStand`, `game.platzVerlaufVorjahr.punkte`.

## Phase 26.19: Admin-Modus und Privatleben erweitert (Version 3.138)
Vor dem Bau gegen die vorhandenen Knöpfe in `js/admin.js` und `js/private-life.js` geprüft. Testsuiten `testAdminWerkzeuge` und `testPrivatlebenPlus`.

**Admin-Modus** (`js/admin-tools.js`, Kasten „🧰 Test- und Diagnosewerkzeuge“, `renderAdminTools()` aus `renderAdminView()`), 16 Werkzeuge:
- Spieler-Editor (Stärke 1 bis 99, Alter, Vertrag, Fitness, Moral, Position; Marktwert neu berechnet; leere Felder werden abgelehnt).
- Bis zum Saisonende vorspulen (über `adminAdvanceMatchdays()`).
- Wetter für genau einen Spieltag festlegen (`game.adminWetter`, ausgewertet in `rollWeather()`).
- Stärke des nächsten Ligagegners setzen.
- Transfermarkt neu erzeugen; Transferangebot für einen gewählten Spieler erzwingen (`triggerNewAITransferOffer()`).
- Jugendtalent ohne Kosten (die Scouting-Kosten werden mit Etikett „🛠️ Admin“ ausgeglichen); alle Erfolge freischalten.
- Teamstärke-Diagnose: Startelf-Basis und benannte Posten wie in `calcTeamStrength()`, der Rest als „übrige Boni“.
- Speicher-Diagnose: Größe des Spielstands, größte Teile und Felder, Belegung des Gerätespeichers; Favoriten, „Zuletzt geöffnet“ und Kaderansicht zurücksetzen.
- Datenprüfung und Reparatur: doppelte Spieler-IDs, Werte, die keine Zahl sind, Verträge unter 1, unbekannte oder doppelte IDs in der Aufstellung, Kassenwerte.
- Sicherungspunkt setzen und laden (nur bis zum Neuladen, Laden über `loadSaveSafely()`).
- Bildschirm direkt öffnen (Haupt- und Hub-Unterbildschirme).
- Zufall mit Startwert festlegen und wieder freigeben (wiederholbare Testläufe).
- Zeichenzeiten der wichtigsten Bildschirme messen.

**Privatleben** (`js/private-life-extra.js`, neue Kästen `#priv-finanz-box`, `#priv-kurse-box`, `#priv-ziele-box`, Haustier im Hobby-Kasten), 12 Funktionen:
- Besitz verkaufen (70 % des Kaufpreises, Prestige geht zurück).
- Sparkonto mit 3 % Zinsen im Jahr, je Spieltag gutgeschrieben.
- Fortbildungen mit Abklingzeit (Sprachkurs, Sportpsychologie, Medientraining, Hospitation): Kosten, Erfahrung über `addManagerXP()`, Stress und Prestige.
- Mentaltraining: sechs Spieltage halber Stresszuwachs nach Niederlagen und Remis (in `processPostMatchRoutine()` neben „Eiserne Nerven“), Abklingzeit 17 Spieltage.
- Gehaltsverhandlung einmal je Saison: +15 % Gehalt, sonst Vorstand -3; Chance aus Vorstandszufriedenheit und Tabellenhälfte, angezeigt.
- Haustier (Katze, Hund, Reitpferd): Anschaffung, Unterhalt und Stressabbau je Spieltag.
- Finanzübersicht je Spieltag mit Saldo und dem aktuellen Teamstärke-Abzug durch Stress.
- Vermögensverlauf je Saison (`archivePrivatVermoegen()` am Saisonende, höchstens 20) und private Ziele mit Fortschritt (reine Anzeige).
- Mehr Inhalte: vier Besitztümer (Ferienhaus und Weingut mit Ertrag je Spieltag, Penthouse, Privatjet), vier Hobbys, vier Nebenjobs.
- Spielwirkung nur über vorhandene Wege: Stress (Teamstärke), Manager-Erfahrung, Vorstand bei abgelehnter Gehaltsforderung.
- **Von den Tests gefunden:** Der Spieler-Editor übergab den Spieler statt seiner Stärke an `calculatePlayerMarketValue()` (Marktwert wurde keine Zahl); die Bildschirmliste ließ die Unterbildschirme der Hubs aus; beim Laden eines älteren Stands wären die neuen Privatleben-Felder des laufenden Spiels stehen geblieben (jetzt `getPrivatExtrasStandard()` vor `Object.assign` in `js/save.js`). Beim Merge-Lauf scheiterte `testRunde31Funktionen` (Rotations-Assistent) an einem Zufallskader mit zwei passenden Ersatzspielern auf derselben Position; der Test macht die übrigen Bankspieler der Position jetzt eindeutig schwächer.

## Phase 26.20: Öffentliche Fassung ohne Admin-Menü, geheime Entwickler-Seite mit PIN (Version 3.139)
- **Zwei Fassungen** (`build.py`): `dist/anstoss-fm13-standalone.html` ist die Entwickler-Fassung mit Admin-Menü (Tests, Bots, lokal, `noindex`), `dist/anstoss-fm13-oeffentlich.html` die öffentliche ohne `js/admin.js`, `js/admin-tools.js` und ohne die `NUR-ENTWICKLER`-Blöcke in `index.html` (Menüknopf, Admin-Bildschirm, PIN-Fenster). Der Build bricht ab, wenn in der öffentlichen Fassung noch Admin-Kennzeichen stehen. `minify.js` erzeugt den öffentlichen Download `dist/anstoss-fm13-standalone.min.html` und `dist/anstoss-fm13-dev.min.html` für den minifizierten Testlauf.
- **Repository:** Nur die öffentliche minifizierte Datei bleibt eingecheckt; die Entwickler-Fassung wird nicht mehr committet (`.gitignore`). Der Quellcode in `js/` bleibt öffentlich lesbar, solange das Repository öffentlich ist.
- **Deploy:** Startseite ist die öffentliche Fassung. Ist das Secret `DEV_PFAD` gesetzt (8 bis 64 Zeichen aus Buchstaben, Ziffern, Bindestrich), baut der Deploy dort mit `build.py --nur-dev` die Entwickler-Fassung; das Secret `DEV_PIN` setzt `build.py` als SHA-256 von „anstoss-fm13:“ + PIN in `js/admin.js` ein. Gleiche Domain, also dieselben Spielstände wie auf der öffentlichen Seite.
- **PIN-Sperre** (`adminZugangFrei()`, `adminPinPruefen()`, `adminSperren()`, eigene SHA-256-Funktion `adminSha256()` ohne `crypto.subtle`): `showScreen('screen-admin')` öffnet ohne Freischaltung das PIN-Fenster; die Freischaltung gilt je Gerät (`anstoss_fm13_admin_frei`), eine neue PIN macht sie ungültig. Ohne gesetzte PIN (lokal, Tests) ist das Menü frei.
- `showScreen()` fängt Ziele ab, die es in der Fassung nicht gibt (zum Beispiel Admin aus Favoriten oder „Zuletzt geöffnet“ eines Entwickler-Geräts), statt alle Bildschirme auszublenden. `adminGrantPremiumPoints()` zog von `js/premium.js` nach `js/admin.js`.
- Tests: `testOeffentlicheFassung` (öffentliche Datei bzw. Download-Link: kein Admin-Bildschirm, keine Admin-Funktionen, Spiel läuft, alte Admin-Ziele führen nicht auf eine leere Seite) und `testAdminPin` (SHA-256-Testwerte, PIN-Ablauf, `build.py --nur-dev` mit `DEV_PIN`). Der minifizierte Testlauf nutzt jetzt `anstoss-fm13-dev.min.html`.

## Board-Karte t3: Knöpfe in Industrie und Holding (Version 3.140)
- **Ursache:** `button { hyphens: auto }` (aus Phase 25.x gegen „Aufstellun-g“) bei `lang="de"`. Browser mit deutschem Trennwörterbuch, etwa Chrome auf Android, trennen damit am Zeilenende auch Wörter, die in die nächste Zeile gepasst hätten („in Auf-trag geben“, „Manager-Divi-dende“). Die Linux-Testumgebung hat kein Trennwörterbuch, deshalb fiel es in keinem Test auf; gemessen ist bei 320 px kein Wort breiter als sein Knopf.
- **Änderung:** Knöpfe mit `hyphens: manual` und `overflow-wrap: break-word` (bricht nur ein Wort, das allein breiter ist als der Knopf). `testKnopfWorteHandy` prüft zusätzlich, dass kein Knopf automatische Silbentrennung hat (gegen den alten Stand rot: 1288 Knöpfe).


## Phase 26.21: Stadion – Fans ohne Karte, Rendite je Ausbau, Bau-Chronik, Kalender, Topspiel-Zuschlag (Version 3.140)
- **Nachfrage je Heimspiel:** `calculateMatchAttendanceDetails(boost, noise, preisMult)` in `js/stadium.js` rechnet dieselbe Zuschauerzahl wie bisher (`calculateMatchAttendance()` ruft sie auf) und dazu die Nachfrage ohne Kapazitätsgrenze: `min(Liga-Interesse, Kapazität × Faktor × Streuung)`. Fans ohne Karte gibt es nur bei vollem Stadion. Der Anpfiff (`setupMatch()`, `js/match.js`) merkt Zahl, Nachfrage und Preisfaktor in `currentMatch`, die Abrechnung (`applyMatchdayFinances()`) übernimmt sie oder rechnet selbst. Jeder Eintrag in `game.attendanceHistory` trägt jetzt `nachfrage` und `ohneKarte`, bei Zuschlag auch `zuschlag` (Prozent) und `zuschlagErloes`.
- **Fans ohne Karte** (`js/stadium-tools.js`, Kasten in den Stadion-Kennzahlen): letztes Heimspiel, Summe der Saison, ausverkaufte Spiele, Ausverkauft-Serie. Alte Einträge ohne `nachfrage` zählen nicht („wird ab dem nächsten Heimspiel erfasst“).
- **Rendite je Ausbau:** Für Platz-Ausbauten (Block-Erweiterung, Kapazitätsprojekte mit mehr Plätzen) zählen nur Fans, die bisher keine Karte bekamen: je Heimspiel `min(Plätze, ohneKarte)` im Schnitt der Saison (ab drei Heimspielen, sonst die letzten einer Saison), mal Ticketerlös je Zuschauer (Steh/Sitz nach Anteilen) und Heimspielen, abzüglich Unterhalt der neuen Plätze wie in `getStadiumBaseMaintenance()`. Einnahme-Erweiterungen zeigen Erlös je Heimspiel und Saison. Ausgabe: Mehrerlös je Saison und Amortisation in Saisons.
- **Bau-Chronik** (`game.bauChronik`, höchstens 60, Kasten im Bereich Bauprojekte): `tickStadiumConstruction()` trägt jedes fertige Projekt mit Saison, Spieltag, Kosten und Art ein, Weiterbildungen nicht.
- **Kalender:** `getKalenderExtras()` zeigt das Bauende (`game.matchday + daysLeft - 1`, gezählt wird nach jedem Spieltag) und ein geplantes Stadion-Event ab seinem Spieltag.
- **Topspiel-Zuschlag** (Spielregel, freigegeben; `game.topspielZuschlag` 0/10/20/30, Standard aus): Bei Derbys (`isDerbyOpponent()`) und Heimspielen gegen Platz 1 bis 3 der eigenen Liga (ab dem 4. Spieltag) steigen alle Ticketpreise um den Aufschlag. Die vorhandene Preis-Nachfrage (`getTicketPriceElasticityFactor(preisMult)`, über `getAttendanceFactor(preisMult)` auch im Kapazitätsteil) senkt die Zuschauerzahl; der Erlös rechnet mit dem höheren Preis. Kasten unter den Ticketpreisen mit Auswahl, Vorschau des nächsten Topspiels (mit und ohne Zuschlag, ohne Zufall) und Saisonbilanz. Weil die Preis-Nachfrage in Stufen wirkt, kostet +10 % bei Marktpreisen keine Zuschauer, +20 % rund ein Achtel.
- **Beobachtet, nicht geändert (Spielregel):** In `calculateMatchAttendance()` wird die Tagesstreuung erst nach der Kapazitätsgrenze angewandt. Bei einer Nachfrage weit über der Kapazität bleiben an einem „schwachen“ Tag trotzdem bis zu 8 % Plätze leer. Außerdem amortisieren sich die Einnahme-Erweiterungen (VIP-Lounges, Public Viewing, Ladestationen) erst nach rund 75 bis 100 Saisons.
- Test: `testStadionWerkzeuge` (Nachfrage und Erfassung, Rendite-Rechnung und Anzeige, Chronik mit Obergrenze, Kalender, Zuschlag mit Preis-Nachfrage und Erlös, alte Stände, 320 px).

## Phase 26.22: Zwei Stadion-Regeln angepasst (freigegeben, Version 3.141)
- **Streuung vor der Kapazität:** `calculateMatchAttendanceDetails()` wendet die Tagesstreuung (0,92 bis 1,08) jetzt auf die Nachfrage an, erst danach greift die Kapazität (`kapazitaet × min(1, faktor × streuung)`). Vorher stand sie hinter der Grenze, sodass bei Andrang weit über der Kapazität an einem schwachen Tag bis zu 8 % leer blieben. Messung mit 15.550 Plätzen und Marktpreisen (je 2.000 Streuwerte): Bundesliga mit 100 % Fans ausverkauft an 96 % statt 50 % der Tage, Schnitt 15.548 statt 15.239; Derbys in Liga 1 und 2 immer ausverkauft statt an der Hälfte. Wo die Nachfrage unter der Kapazität liegt, ändert sich nichts.
- **Einnahme-Anlagen:** `incomeBase` so, dass sich die Anlage in rund 10 Saisons bezahlt macht (Kosten / 170 bei 17 Heimspielen): VIP-Lounges 79.000 statt 8.000, Public-Viewing 26.500 statt 3.500, Ladestationen 16.000 statt 1.800 je Heimspiel, alles mal `getStadiumCostScale()`. Vorher 75 bis 100 Saisons. Die Obergrenze in der Bonus-Übersicht rechnet jetzt aus `STADIUM_UPGRADES` statt aus festen Zahlen.
- **Buchungsjournal:** Die Erlöse der Stadion-Anlagen kamen schon immer aufs Konto, standen aber nicht im Spieltags-Journal (und zählten damit nicht im FFP-Saisonergebnis). Jetzt als „🏟️ Stadion-Anlagen“ wie die Campus-Anlagen.
- **Nicht geändert (beobachtet):** Die Campus-Gebäude mit Erlös je Heimspiel amortisieren sich ebenfalls kaum, die Fan-Kneipe Stufe 1 etwa in der Bundesliga erst nach weit über 100 Saisons (fester Erlös 1.800 €, Unterhalt 650 € je Spieltag, Kosten 1,5 Mio.).
- Test: `testStadionWerkzeuge` um beide Regeln und den Journal-Eintrag erweitert; der Topspiel-Teil wählt das Spitzenteam jetzt ohne Derbygegner (zufällige Tabelle).

## Phase 26.23: Campus-Gebäude mit Erlös in rund 10 Saisons (freigegeben, Version 3.141)
- **Vorher:** Fan-Kneipe, Catering-Meile, Parkhaus und VIP-Tagungshotel zahlten fest 1.800 / 2.400 / 1.500 / 5.000 € je Stufe und Heimspiel, in jeder Liga. Die Baukosten steigen aber mit Liga und Stufe (`baseCost × Stufe × getStadiumCostScale()`, mindestens 250.000 €), und jede Stufe kostet 650 € Unterhalt je Spieltag. Die Fan-Kneipe Stufe 1 brauchte in der Bundesliga so rund 175 Saisons, höhere Stufen noch länger.
- **Jetzt** (`js/campus-staff.js`): `getCampusStufenErloes(key, stufe)` = Baukosten der Stufe in der aktuellen Liga / 170 + 1.300 € Unterhalt je Heimspiel, auf 100 € gerundet; `getCampusHeimspielErloes(key)` summiert die gebauten Stufen. Jede Stufe bezahlt sich damit nach Unterhalt in rund 10 Saisons, in jeder Liga. Wie bei den Stadion-Anlagen wächst der Erlös mit der Liga (Auf- und Abstieg ändern ihn). Stufe 1 je Heimspiel: Bundesliga Fan-Kneipe 10.100 €, Catering 9.500 €, Parkhaus 39.500 €, Hotel 133.700 €; 3. Liga 3.800 / 3.600 / 12.000 / 38.400 €; 6. Liga 2.800 € (Mindestbaukosten), Hotel 5.900 €. Die übrigen Wirkungen (Ultra-Stimmung, Parkhaus-Auslastung) bleiben.
- `getCampusUpgradeCost()` nutzt jetzt `getCampusStufenKosten()`. Die Abrechnung (`applyMatchdayFinances()`) und die Nebeneinnahmen-Übersicht im Stadion lesen dieselbe Funktion; die Campus-Karten zeigen den aktuellen Erlös und den der nächsten Stufe, die festen Beträge in den Beschreibungen sind entfallen.
- Tests: `testStadionWerkzeuge` prüft jede Stufe in Liga 0, 2 und 5 (9,5 bis 10,5 Saisons), die Summe, den Journal-Posten und die Anzeige; `testStadiumAusbau2` rechnet die Nebeneinnahmen mit der neuen Funktion.

## Board-Karte „Postfach sollte auch löschen von Mails möglich sein“ (Version 3.142)
- **Vorher:** Löschen ging nur einzeln über ein kleines ✕, das wie die anderen Symbole aussah, ohne Rückweg. Nach wenigen Spieltagen liegen 20 bis 30 Mails im Postfach.
- **Jetzt** (`js/inbox.js`, neuer Bereich `#inbox-aktionen` unter „Alle als gelesen markieren“):
  - Einzeln über 🗑️ („Löschen“) an jeder Mail.
  - „🗑️ Gelesene löschen (N)“ löscht die gelesenen Mails der gerade gewählten Ansicht, ★ Wichtig bleibt; im Archiv heißt der Knopf „Archiv leeren (N)“. Beide fragen über `requireConfirm()` nach.
  - „☑ Auswählen“: Mails antippen (Karte als Checkbox, kompakt ohne Text), „Alle/Keine auswählen“, „Ausgewählte löschen (N)“ mit Rückfrage, „Fertig“. Ein Filterwechsel leert die Auswahl.
  - „↩ Rückgängig“ für den letzten Löschvorgang setzt die Mails an ihre alte Stelle im Postfach oder Archiv zurück. Nur im Speicher; das Laden eines Spielstands verwirft Rückgängig und Auswahl (`applyLoadedStateInner()`).
- Test: `testPostfachLoeschen`.

## Board-Karte „Freischaltungssystem“ (Spielregel, freigegeben; Version 3.142)
- **Wunsch:** Bereiche, die erst mit einem gewachsenen Verein Sinn ergeben, sollen anspruchsvoll über Erfolge freigeschaltet werden (Titel, Champions Cup, Spiele, Siege, Tore, Level). Entscheidungen des Nutzers: Bedingungen nach eigenem Vorschlag („überrasch mich“), laufende Spielstände nach den neuen Regeln sperren, alle vier vorgeschlagenen Gruppen.
- **Bereiche und Bedingungen** (`FREISCHALT_BEREICHE` in `js/freischaltungen.js`, alle Bedingungen eines Bereichs nötig):

| Bereich | Bedingungen |
|---|---|
| 🎲 Sportwetten | 68 Ligaspiele, Manager-Level 3 |
| 🥈 Zweite Mannschaft | Regionalliga erreicht, 1 Meistertitel, 50 Ligasiege |
| 👩 Frauenmannschaft | Regionalliga erreicht, 2 Meistertitel, 150 Ligatore |
| 🏘️ Immobilien | 3. Liga erreicht, 1 Pokalsieg, Manager-Level 4 |
| 🏗️ Stadion-Anlagen (20 Erweiterungen) | 3. Liga erreicht, 3 Meistertitel, 100 Ligasiege |
| 📈 Aktien & Kapitalmarkt | 2. Liga erreicht, 150 Ligasiege, Manager-Level 5 |
| 🏟️ Große Ausbauprojekte | 2. Liga erreicht, 4 Meistertitel, 500 Ligatore |
| 🏢 Holding & B2B | Bundesliga erreicht, 300 Ligaspiele, Manager-Level 6 |
| 🏭 Industrie & Rohstoffe | Holding offen, Deutscher Meister, Champions Cup gewonnen |

- **Zahlen:** aus `game.managerCareer` (abgeschlossene Saisons mit Liga, Platz, Siegen, Toren; `js/manager-analytics.js`) plus der laufenden Saison; Pokalsiege und Champions Cup aus `game.trophies`; Level aus `managerRPG`. Damit bringen laufende Spielstände ihre Laufbahn mit. Aufstiege zählen bewusst nicht: wer in der Bundesliga beginnt, könnte sie nie sammeln. Was Lizenzauflagen braucht (Plätze über Block-Erweiterungen, Flutlicht, Internat), bleibt immer offen.
- **Kalibrierung:** Probelauf aus der 6. Liga mit gestärktem Kader, nur simuliert: nach 6 Saisons 204 Ligaspiele, 127 Siege, 454 Tore, 4 Meistertitel, Manager-Level 4 (live gespielt steigt das Level deutlich schneller, +150 XP je Sieg). Die Level-Schwellen liegen deshalb bei 3 bis 6.
- **Gesperrt:** Der Bildschirm (zweite Mannschaft, Frauen, Wetten, Aktien, Immobilien, Holding, Fabriken, Rohstoffe) zeigt nur eine Karte mit den Bedingungen und Fortschrittsbalken; Reiter und Menüpunkte tragen ein Schloss (im Hub nur der Reiter, damit „Industrie & Merchandising“ für den Fanshop offen aussieht). Die Raster der Stadion-Anlagen und Ausbauprojekte zeigen dieselbe Karte. Alle Aktionen beginnen mit `bereichGesperrt()`, das per Toast sagt, was fehlt.
- **Laufender Betrieb ruht** (Wunsch „alles neu sperren“): gebaute Stadion-Anlagen ohne Wirkung (Boni, Erlöse, Solar, Klimaanlage), keine Mieten, Fabriken produzieren nicht, keine Konkurrenz-Übernahmeangebote, keine B2B-Aufträge, Limits und Sparpläne pausieren, Training der zweiten Mannschaft pausiert. Die Ligaspiele der zweiten Mannschaft und der Frauen laufen weiter, weil ihre Tabellen sie brauchen; Gehälter laufen weiter. Gebaute Plätze aus Ausbauprojekten bleiben.
- **Freischalten:** `pruefeFreischaltungen()` nach jedem Spieltag (`processPostMatchRoutine()`), am Saisonende (nach Titel und Aufstieg) und beim Laden. Neue Bereiche: Postfach-Nachricht, ein Fenster, je 250 Manager-XP. Offen bleibt offen (`game.freischaltungen` mit Saison und Spieltag), auch nach Abstieg oder Vereinswechsel.
- **Alte Stände:** Ohne `game.freischaltungen` wird beim Laden nach der Laufbahn still freigeschaltet, dazu eine Nachricht „🔓 Neu: Freischaltungen“ mit offenen und gesperrten Bereichen. Kein Übertrag aus dem vorher laufenden Spiel.
- **Übersicht:** Kasten „🔓 Freischaltungen“ oben im Manager-Talentbaum mit Laufbahn-Zahlen und Stand je Bereich.
- Die alte Voraussetzung „Manager-Level 3“ für die zweite Mannschaft ist im neuen System aufgegangen (`SECOND_TEAM_MIN_MANAGER_LEVEL` entfernt).
- **Tests:** `tests/run-tests.js` setzt für alle Suiten das Fenster-Kennzeichen `window.anstossTestAllesFrei` (im Spiel gibt es den Admin-Schalter mit dem Schlüssel `anstoss_fm13_alles_frei`), damit die Suiten die Bereiche selbst testen können; es wirkt nur in der Entwickler-Fassung. Der erste Versuch schrieb den Schlüssel per Init-Skript in den localStorage: Beim Neuladen gingen dadurch frisch geschriebene Werte verloren (Autosave und Sprachwahl rot) (`testOeffentlicheFassung` prüft, dass die öffentliche Fassung sperrt). `testFreischaltungen` nimmt ihn weg und prüft Sperren, ruhenden Betrieb, Freischalten, Reihenfolge, alte Stände, Übersicht, Schalter und 320 px. Bots laufen gegen die Entwickler-Fassung ohne Schlüssel, nutzen die gesperrten Bereiche aber nicht.

## Freischaltungen 2 und Grundfassung mit großen Updates (Version 3.143)
Auf „Alle“ zu neun Vorschlägen:
1. **Graue Vorschau statt Ausblenden:** Gesperrte Bildschirme verschieben ihren Inhalt in eine `.freischalt-vorschau` (inert, aria-hidden, grau überlagert ohne `filter`/`opacity`), oben die Karte mit den Bedingungen. Teilbereiche in fremden Bildschirmen über `freischaltVorschau(key, html)`. Gesperrte Reiter und Menüpunkte grau mit gestricheltem Rand und 🔒, einzelne gesperrte Knöpfe (Luxus) ebenso; ein Tipp sagt per Toast, was fehlt.
2. **🏷️ Stadion-Namensrechte** (Regionalliga, 40 Ligasiege, Level 3): Verkauf, Zeremonie und Auflösen gesperrt; die Zahlung je Heimspiel ruht (`getNamingRightsMatchIncome()`, an allen drei Stellen der Abrechnung).
3. **📺 Medienrechte-Partner** (3. Liga, 2 Meistertitel, Level 4): Unterschreiben und Kündigen gesperrt; ein laufender Vertrag ruht (keine Zahlung, Restlaufzeit bleibt).
4. **💎 Privatleben-Luxus** (2. Liga, 3 Meistertitel, Level 5): Besitz ab 250.000 € (Villa, Yacht, Penthouse, Weingut, Privatjet), Nebenjobs ab 30 Prestige (TV-Experte, Workshop, Biografie) und das Reitpferd. Ertrag des Weinguts ruht, das Reitpferd kostet weiter, entspannt aber nicht; Verkaufen bleibt möglich.
5. **Nächste Freischaltung** auf dem Dashboard (`#dashboard-freischaltung-box`): der gesperrte Bereich mit dem meisten Fortschritt und was fehlt („noch 65 Ligaspiele, Manager-Level 3 (jetzt 1)“); verschwindet, wenn alles offen ist.
6. **NEU-Kennzeichen** (`game.freischaltNeu`): frisch freigeschaltete Bereiche an Reiter und Menüpunkt (im Hub auch der Menüpunkt des Hubs), bis man den Bereich einmal öffnet.
7. **Freischalt-Tempo beim Spielstart** (`game.freischaltTempo`): Normal, Schnell (Zahlen halbiert, eine Liga weniger; Deutscher Meister und Champions Cup bleiben), Alles offen. Gewählt im Fenster „Neues Spiel“, über den Sitzungsspeicher wie Startliga und Kapital.
8. **Erfolge und Saisonrückblick:** je Bereich ein Erfolg „… freigespielt“ (`frei-<key>`, zählt nur echtes Freispielen); der Rückblick nennt die in der Saison freigeschalteten Bereiche. Die Prüfung am Saisonende läuft dafür jetzt vor `game.season++`.
9. **Grundfassung mit drei großen Updates:**
   - **Pakete:** Vereinswachstum (zweite Mannschaft, Frauen, Stadion-Anlagen, große Ausbauprojekte), Finanzwelt (Aktien, Wetten, Immobilien), Konzern (Holding, Industrie, Rohstoffe). `build.py` baut je Ausbaustufe; fehlende Pakete verlieren ihre Module ganz und ihre Seitenteile zwischen den `PAKET`-Markern (Menüpunkte, Reiter, Bildschirme, Stadion-Panels, Holding-Konto in der Kopfzeile). Ohne Konzern führt der Menüpunkt direkt in den Fanshop.
   - **Ausnahme zweite Mannschaft:** `js/secondteam.js` enthält auch die Leihen der ersten Mannschaft und bleibt deshalb als Code; nur Menü und Bildschirm fehlen.
   - **Absicherung:** Die wenigen Aufrufe von außen haben `typeof`-Prüfungen bekommen; `realEstatePortfolio` und `STOCK_KEYS` liegen jetzt in `js/state.js`, damit Spielstände in allen Stufen dieselben Daten tragen. `showScreen()` sagt bei einem fehlenden Bereich „Dieser Bereich kommt mit dem Update …“. Der Selbsttest überspringt Bildschirme fehlender Pakete und (öffentliche Fassung) den Admin-Bildschirm; der meldete dort bisher fälschlich einen Fehler.
   - **Update-Fenster:** `game.bekanntePakete`; beim Laden eines Stands, dem seitdem Pakete fehlten, kommen ein Fenster und eine Postfach-Nachricht „🎁 Neu in diesem Update“. Stände ohne die Liste übernehmen sie still.
   - **Öffentliche Fassung:** `OEFFENTLICHE_STUFE` steht auf allen drei Paketen, an der Seite ändert sich also nichts. Ein großes Update heißt künftig: Stufe erhöhen, mergen.
   - **Probelauf:** Grundspiel, Stufe 1 und Stufe 2 jeweils eine Saison mit Abschluss, alle Bildschirme, alter Spielstand: keine Fehler, alle onclick-Funktionen vorhanden.
- Tests: `testFreischaltungen` (12 Bereiche, Vorschau statt Ausblenden), `testFreischaltungenPlus` (2 bis 8, inklusive Spielstart mit Tempo „Schnell“ über einen echten Neustart), `testGrundfassung` (Stufe 0 und Update-Fenster in der vollen Fassung).

## Phase 26.24: Kopfzeilen-Fenster (Version 3.144)

Wunsch aus dem Ausprobieren: Ein Tipp auf die Kennzahlen oben sollte nicht ins Leere gehen, sondern einen leichten Einstieg bieten. `js/kopfzeile-fenster.js` öffnet je Feld ein kleines Fenster (`#kopf-fenster-overlay`, ein Overlay für alle fünf) mit den wichtigsten Zahlen, einer schnellen Einstellung und dem Weg zur vollen Seite:

- **Vereinskonto:** Kasse, Ergebnis des letzten Spieltags (`game.financeLedger`), Ø je Spieltag und Vorschau aus `getLiquidityForecast()`, Transferbudget, Kadergehälter gegen das Gehaltsbudget; Ticketpreise per Schnellwahl Günstig (80 % des Marktpreises), Marktpreis, Premium (125 %). → Finanzen.
- **Holding-Konto:** Konto, Unternehmenswert, offene B2B-Aufträge; Überweisung 10.000/50.000/100.000 € über `transferClubToHolding()`. Gesperrt: was laut Freischaltung noch fehlt. Das Feld fehlt in Fassungen ohne Paket Konzern ganz. → Holding.
- **Manager-Level:** XP-Balken, XP bis zum nächsten Level, freie Skill-Punkte, nächste Freischaltung. → Talentbaum.
- **Fans und Vorstand:** beide Werte mit Ampel, Vorstandsverlauf, Tabellenplatz gegen die Erwartung (nur gelesen, `game.seasonExpectation`), Warnungen. → Vorstandsraum, Fans.
- **Spieltag:** nächster Gegner mit Heim/Auswärts, Tabellenplatz und Derby, die drei Spiele danach, Probleme aus `getLineupProblems()`, gespeicherte Aufstellungsvorlagen zum Laden. → Aufstellung, Kalender.

Die Felder sind `role="button"` mit `tabindex="0"` und einem kleinen „›“; Enter/Leertaste öffnen, Escape schließt und gibt den Fokus an das Feld zurück. Ansehen ändert nichts am Spielstand. Test: `testKopfzeilenFenster`.

## Phase 26.25: Ausschreitungen ausgebaut (Version 3.144, Board-Karte tmvjuiapap9y9)

- Neues Modul `js/ausschreitungen.js` ersetzt `checkHooliganIncident()`. Bisher gab es nur einen Wurf im Heim-Derby (12 % vor Ordnern) mit immer gleicher Folge (Geisterspiel).
- Risiko jetzt auch im Auswärts-Derby (6 %) und in Brisanzspielen (beide Top 4 oder beide letzte 4 ab Spieltag 5: 4 % daheim, 2,5 % auswärts). Ordner, Sicherheitstechnik und Derby-Woche wirken nur daheim.
- Bisher wirkungslose Schalter wirken jetzt: Fanprojekt ×0,75; Pyro-Verbot lockern (Ultras-Aktion) ×1,4 für drei Heimspiele. Dazu verärgerte Ultras (<35 %) ×1,25, Bewährung (ab 2 Krawallen/schweren Vorfällen in dieser und der Vorsaison) ×1,2 und schwerere Stufen, Klatsche (≤ -3) ×1,3, Deckel 50 %.
- Stufen: Pyro (Strafe 3.000 + 1.500 je früherem Vorfall, Fans -2), Krawall (6.000 + 3.000 je Vorfall, Fans -6, Vorstand -4), schwer (wie bisher, auswärts Strafe ×1,5 statt Geisterspiel). Strafen laufen über `bucheMitLabel('Verbandsstrafe Ausschreitungen')`.
- Fan-Dialog (3.000 €) vor einem Risikospiel ×0,6. Panel „Ausschreitungen“ in der Fan-Zentrale (Reiter Sicherheit): Risiko des nächsten Spiels mit allen Faktoren, Bewährung, Pyro-Status, Chronik.
- Test `testAusschreitungen` ([26.25]).

## Phase 26.26: Startmenü und Testangebot im Diamanten-Shop (Version 3.145)

- Titelbildschirm bei jedem Start (`js/startmenue.js`): Weiterspielen (mit Verein, Liga, Saison, Spieltag), Neue Karriere, Spielstand laden (Slots, Autosave, Datei). Beim ersten Start ohne Spielstand kein Weiterspielen; das Tutorial kommt erst nach der Wahl.
- Neue Karriere: Heimatstadt plus drei Arten. Verein gründen nutzt den bisherigen Neues-Spiel-Kasten und neu einen eigenen Vereinsnamen (statt immer „1.FC Moritz …“), beim ersten Start ohne Rückfrage. Verein übernehmen: Neustart mit frischen Ligen der Stadt, dann freie Wahl aus allen sechs Ligen (Favorit/Mittelfeld/Abstiegskandidat, Stärkebalken). Trainer gesucht: je Karriere-Szenario ein passender Verein der Szenario-Liga (Absteiger/Pleite: schwache Vereine, Meister: Favoriten) mit Ziel und Frist.
- Antritt bei einem bestehenden Verein über `switchToClub()`, Startkapital, Stadion und Lizenz wie beim Start in dieser Liga; der automatisch angelegte Startverein bleibt unter neuem Namen als Gegner.
- „Neue Karriere starten“ (früher „Neues Spiel starten“) öffnet das Menü bei der Karriere-Wahl.
- Testangebot im Diamanten-Shop: 1.000 Diamanten gegen 2 Mio. € (`TESTANGEBOT_DIAMANTEN_GELD`).
- Test `testStartmenue` ([26.26]); die übrigen Suiten starten ohne Menü (`window.anstossOhneStartmenue`).

## Phase 26.27: Einsteiger-Hilfen nach der Neulings-Analyse (Version 3.146)

Analyse als Neuling (390 px, öffentliche Fassung): Start im Büro ohne Leiste, Kopfzeile mit gesperrter Holding, Übersicht 4,5 Handyhöhen mit doppeltem „Saison-Ziele“, Menü mit 20 Einträgen, Kader beginnt mit Schützen und zehn Formationen, vor Spiel 1 Notizbuch, Taktik-Duell, Ansprache und Presse.

1. Einsteiger-Modus beim Karrierestart (Startmenü und Neues-Spiel-Kasten, Standard an): `js/einsteiger.js`, Schalter im Menü unter Einstellungen.
2. Neue Karriere startet auf der Übersicht; Büro-Schnellknöpfe nennen das Ziel („Aktenschrank → Transfers“).
3. Kopfzeile: Holding-Konto erst mit Freischaltung, Manager-Level im Einsteiger-Modus ab Level 2.
4. „Erste Schritte“ ganz oben auf der Übersicht; Wochenrückblick, Industrie & Holding, Europa & Manager und Transferstrategie im Einsteiger-Modus bis Spieltag 17 ausgeblendet (mit Hinweis und „Alles jetzt zeigen“); das untere Panel heißt „Saison-Aufgaben“, die doppelte Überschrift ist weg.
5. Menü „Wichtig“ (Übersicht, Kader, Training, Transfers, Finanzen, Postfach, Wettbewerbe) und „Mehr Bereiche“ (im Einsteiger-Modus zu, Zustand gemerkt).
6. Kader: „Trainer stellt Top-Elf auf“ und Taktiktafel zuerst, Formation und Schützen im aufklappbaren Bereich (im Einsteiger-Modus zu).
7. Spieltag: oben immer „Ohne Vorbereitung anpfeifen“ und „Nur Ergebnis“; im Einsteiger-Modus ist die Vorbereitung eingeklappt, die ersten drei Spiele erklären den Ablauf.
8. Fachwörter: Stärke, Fitness, Tagesform, Gehaltsbudget, Financial Fairplay, Lizenzauflagen und Taktik-Duell öffnen den Lexikon-Eintrag; Formationskarten zeigen „Abwehr/Angriff“ statt „Def/Off“.
9. Keine Sponsoren-Meldung beim neuen Klub mehr, der Schritt „Sponsoren-Angebote ansehen“ führt zu den Angeboten.
10. Leitfaden für einen Kurztest mit Neulingen: `docs/EINSTEIGER-TEST.md`.

Test `testEinsteiger` ([26.27]), `testStartmenue` prüft Einsteiger-Modus und Start auf der Übersicht.

## Phase 26.28: Einsteiger-Hilfen, zweite Runde (Version 3.146)

1. „Neuer Klub gestartet!“ nur noch 1,5 s.
2. Saisoneröffnung im Einsteiger-Modus erst nach drei erledigten Ersten Schritten, dafür in der ersten Saison bis Spieltag 2 wählbar (`isSeasonOpeningOpen()`).
3. Fenster nach der Hinrunde (Spieltag 18, einmal, `game.einsteigerAbschluss`): Grundlagen sitzen, neue Bereiche, Einsteiger-Modus ausschalten oder anlassen.
4. Nach den ersten zwei Ligaspielen im Einsteiger-Modus eine Einordnung im Spielbericht: Stärkevergleich, Fitness der Startelf, Notenskala mit Lexikon-Link.
5. „Was jetzt?“ ganz oben auf der Übersicht: die wichtigste Aufgabe des Manager-Assistenten mit Knopf, sonst der nächste Spieltag.
6. Gesperrte Bereiche stehen am Ende von „Mehr Bereiche“ mit 🔒 und Hinweis.
7. Nächste Begegnung mit den Spielknöpfen direkt unter den Ersten Schritten (für alle).
8. Englische Texte für Startmenü, Einsteiger-Spieltag, Menü-Gruppen, Abschluss-Fenster und Erste Schritte.

`testEinsteiger` prüft alle acht Punkte.

## Lexikon auf Vordermann (Version 3.146, Board-Karte tmvjzpzsss8cu)

- 9 neue Einträge (Deutsch und Englisch, je mit Zahlen aus dem Code): Ausschreitungen & Sicherheit, Freischaltungen, Startmenü & Karriere-Arten, Einsteiger-Modus, Kopfzeile & Schnellfenster, Fans ohne Karte & Topspiel-Zuschlag, Spieler-Etiketten, Aufstellungs- und Taktikvorlagen, Liquiditäts-Vorschau & Konto-Alarm. Jetzt 72 statt 63 Einträge.
- Veraltetes korrigiert: Heimatstadt und Karriere-Szenarien verweisen aufs Startmenü (Trainer gesucht), Speichern nennt „Weiterspielen“, Fanstimmung den Einfluss verärgerter Ultras auf Ausschreitungen.
- Ansicht: Anzahl je Kategorie, Filter „🆕 Neu“ (Feld `neu`), „Neu“-Chip am Eintrag, Sprungknopf mit Ziel („➜ Zum Kader“ statt „Zum Bildschirm“).
- `testLexicon` prüft neue Einträge, Neu-Filter, Anzahl und Sprungziel; `testLexiconEnglish` die Übersetzungen.

## Phase 26.29: 3D-Livespiel (Version 3.146, Board-Karte tmvjy5q6ljhwr)

- Neues Modul `js/live-3d.js`: Canvas-Ansicht mit echter Perspektive (Kamera 45 m hinter der nahen Seitenlinie, an der nahen Linie 58 m im Bild), Tribüne mit Zuschauern, Rasen mit Mähstreifen, Linien, Strafräume, Tore mit Netz.
- 22 Figuren mit Schatten, Laufanimation, Trikot in Vereinsfarbe (auswärts Auswärtsfarbe, Gegner mit gut unterscheidbarer Farbe), Torhüter in eigener Farbe. Grundordnung je Team, zur Ballseite verschoben, das Team im Ballbesitz rückt auf, der nächste Gegenspieler presst. Ruhiges Passspiel mit Ballverlusten zwischen den Szenen.
- Szenen aus dem echten Spiel: Tor (Kombination über zwei Stationen, Schuss, Jubel, Anstoß), Chance (gehalten oder knapp vorbei, Torwart hechtet), Karte (Spielunterbrechung, Karte über dem Spieler), Halbzeit (Seitenwechsel), Abpfiff. Hinkt die Ansicht dem Ticker hinterher, läuft sie doppelt so schnell und lässt alte Chancen weg.
- Leistung: rund 1-2 ms je Bild; der Lauf endet beim Verlassen des Livespiels und bei verstecktem Tab. Reduzierte Bewegung: nur Einzelbilder bei Ereignissen.
- Umschalter „Taktiktafel zeigen / 3D-Ansicht zeigen“, gemerkt in `anstoss_fm13_live3d`.
- Test `testLive3D` ([26.29]).

## Phase 26.30: Ausschreitungen als Bild (Version 3.147)

- `js/ausschreitungen-szene.js`: Fenster nach dem Vorfall mit 8-Sekunden-Canvas-Szene aus dem Fanblock. Pyro: Bengalos und aufsteigender Rauch, hüpfende Fans. Krawall: Gästegruppe drückt in den Block, Ordnerkette in Warnwesten, fliegende Becher. Schwer: Blaulicht, Polizeikette, Fans klettern über den Zaun aufs Feld. Danach bleibt das letzte Bild stehen; Text, Strafe und Folgen wie bisher.
- Im noch offenen 3D-Livespiel nach dem Abpfiff: Bengalos und Rauch auf der Tribüne hinter der betroffenen Kurve, bei schweren Ausschreitungen laufen Fans aufs Feld, die Kamera schwenkt hin.
- Fan-Zentrale (Sicherheit): Stadionkarte mit Heimkurve, Gästeblock, Haupttribüne und Gegengerade, gefärbt nach dem Risiko des nächsten Spiels, mit Symbolen für die Vorfälle dieser Saison.
- Keine Regeländerung: der Wurf bleibt nach dem Abpfiff in `processPostMatchRoutine()`.
- Test `testAusschreitungSzene` ([26.30]); `testAusschreitungen` fängt das neue Fenster wie die alte Meldung ab.

## Fan-Feindschaften als Risikospiele (Version 3.147, Regeländerung auf Wunsch)

- `FAN_FEINDSCHAFTEN` in `js/ausschreitungen.js`: 36 Paarungen verfeindeter Fanszenen, die keine Derbys sind (z. B. BFC gegen Lok Leipzig, Lok gegen Jena und Halle, Cottbus gegen Babelsberg, Offenbach gegen Waldhof, 1860 gegen Augsburg). Grundrisiko 8 % daheim und 4 % auswärts, zwischen Derby (12/6) und Brisanzspiel (4/2,5); alle Faktoren (Ordner, Fanprojekt, Dialog …) gelten wie gehabt. Die Fan-Zentrale nennt die Feindschaft als Faktor.
- Lexikon (DE/EN) ergänzt, `testAusschreitungen` prüft die Feindschaft.
- Erweitert auf alle Ligen (51 Paarungen, Recherche: Wikipedia „German football rivalries“, Fanfreundschaft-Übersichten, Polizei- und Regionalberichte): z. B. Dortmund gegen RB Leipzig, Hertha gegen Rostock und Union, Union gegen Rostock und Dresden, Rostock gegen Magdeburg und Aue, HSV gegen St. Pauli, Bayern und Nürnberg gegen 1860, KSC gegen Hannover, Darmstadt gegen Offenbach, Aachen gegen Münster. Ein Testlauf prüft, dass jeder Name im Spiel vorkommt und keine Paarung doppelt oder schon Traditionsduell ist.

## „Zuletzt geöffnet“ entfernt (Version 3.148)

- Auf Wunsch: die Liste der zuletzt geöffneten Bildschirme oben im Menü (Phase 26.16, `js/one-hand.js`, `#recent-screens-box`) ist entfernt; der alte Geräte-Eintrag `anstoss_fm13_zuletzt` wird beim Start einmal gelöscht. Favoriten bleiben.

## Phase 26.31: Stadionansicht als Canvas (Version 3.149)

Wunsch: im Stadionbereich eine Canvas-Ansicht, in der man sich das Stadion ansehen kann. Umgesetzt wurden alle acht Vorschläge in `js/stadion-canvas.js` (Illustration, feste Farben erlaubt). Spielregeln unverändert, die Ansicht liest nur.

- **Drehbares Stadion** oben auf der Stadionseite (`#stadion-3d-box`, ersetzt die CSS-Schüssel; Umschalter `anstoss_fm13_stadion3d` zur klassischen Ansicht). Perspektive mit Kamera auf einer Kreisbahn, drei Kameras (Luftbild, Haupttribüne, hinter dem Tor), Wischen dreht, zwei Finger, Mausrad oder ➕/➖ zoomen, Pfeiltasten drehen. Flächen werden mit Normalen gefiltert und von hinten nach vorn gezeichnet.
- **Tribünen aus den echten Plätzen:** 0,5 m je Sitz, 0,8 m je Reihe; Oberränge rücken hinter den Unterrang, die Logen sind ein Glasband auf der Haupttribüne, die Presse daneben, `bonusCapacity` verteilt sich auf beide Hintertortribünen.
- **Blöcke antippen:** Treffer über die gezeichneten Flächen, das Fenster `#stadion-block-overlay` zeigt Plätze, Auslastung, Fankultur, Risiko, laufende Bauten und den bisherigen Ausbau (`selectStadiumBlock(key, zielId, leise)`). Imbiss, Fanshop und Toiletten stehen je Stufe als Buden hinter dem Block.
- **Ränge nach den Heimspielen:** Auslastung aus `game.attendanceHistory` (diese Saison, sonst die letzten der Vorsaison, ohne Heimspiel die Prognose aus `calculateMatchAttendanceDetails`), je Block gewichtet (Kurve zuerst voll, Gästeblock zuletzt), die Summe entspricht der echten Zahl. Blättern mit ◀/▶.
- **Tag, Abend, Nacht und Wetter:** Flutlichtmasten mit Lichtkegeln (nachts ohne Flutlicht dunkel mit Hinweis), Regen, Schnee und Sturm aus `currentWeather`, Abnutzung des Rasens nach `stadium.pitchCondition`.
- **Baustellen und Anlagen:** Kran mit Fortschrittsbalken je Bau aus `game.stadiumConstructionQueue`, beim Rangausbau ein Gerüst über dem neuen Rang; gebaute Anlagen (Museum, Flagship-Store, Pressezentrum, Ladestationen, Bahnhof, Public Viewing …) als Gebäude, Dach mit Solarfeld, Anzeigetafeln mit dem letzten Ergebnis, Lichtshow bei Nacht, Denkmal der Publikumslieblinge.
- **Kurve:** Choreo in Vereinsfarben vor einem Heim-Derby oder nach drei Siegen in Folge, Fahnen ab Fankultur 50, Gästeblock in den Farben des Gegners mit Zaun; Risiko-Ebene färbt die Blöcke nach `getAusschreitungsLage()` für das nächste Spiel.
- **Rundflug:** 15 Sekunden um das Stadion mit Name, Namensgeber, Kapazität, Zuschauerrekord und Stadionwert. Fertige Ausbauten (Rang, Spezial-Installation, Kapazitätsprojekt, Erweiterung) setzen `game.stadionRundflug`; beim nächsten Besuch startet der Rundflug und der Marker wird gelöscht.
- **Vorher/Nachher:** „Ausbau im Bild zeigen“ im Block-Fenster blendet den nächsten Rang als Geisterbild ein, ein Schieber wechselt zwischen heute und nach dem Ausbau; der Oberrang rückt mit.
- Leistung: rund 4–5 ms je Bild; gezeichnet wird nur bei Bewegung (Rundflug, Kamerafahrt, Wetter, Fahnen, Kran, Lichtshow), sonst bei Änderungen. Läuft nur, solange die Stadionseite im Hub sichtbar ist; bei reduzierter Bewegung Standbilder.
- Test `testStadionAnsicht`, Lexikon-Eintrag „Stadionansicht“ (neu).

## Start nach dem Laden, Wappen-Kürzel, Hinweis auf neue Version (ungemergt)

Gemeldet mit einem Screenshot (3.148 auf dem Handy, Lokomotiv Leipzig in der Regionalliga):

- **Übersicht nach dem Laden:** `window.onload` zeigte bei einem geladenen Stand keinen Bildschirm an. Die Übersicht steht im Markup schon sichtbar, wurde aber nie gezeichnet; es blieben die Platzhalter „6. Liga · Spieltag 1“, „Gegner (Str: 58)“ stehen, bis man den Bildschirm wechselte. Der Fehler ist älter als das Startmenü. Jetzt `updateUI()` und `showScreen('screen-dashboard')` nach dem Laden.
- **Wappen-Kürzel:** `game.clubCrestSymbol` hatte den Startwert „FCM“ für jeden Verein, auch nach „Verein übernehmen“ oder einem Jobwechsel. Neu `getWappenKuerzel()` und `vereinsKuerzelAusName()` (`js/crest.js`): ohne selbst gewähltes Kürzel aus dem Namen (FC, SV, BSG ganz, sonst Anfangsbuchstaben, höchstens drei Zeichen; Lokomotiv Leipzig → LL). Neues Feld `game.clubCrestSymbolEigen` (Wappen-Editor); alte Stände mit einem anderen Symbol als „FCM“ behalten es. `switchToClub()` setzt das Kürzel auf den neuen Verein zurück. Im Editor ist das erste Kürzel das des Vereins.
- **Neue Version:** GitHub Pages lässt Browser die Seite bis zu 10 Minuten zwischenspeichern, direkt nach einem Deploy lief noch die alte Fassung. `js/neue-version.js` holt beim Start (nach 4 s) und beim Zurückkehren zur Seite (höchstens alle 30 Minuten) `version.json` ohne Zwischenspeicher; der Deploy schreibt sie aus `GAME_VERSION` (auch in den Entwickler-Pfad). Ist sie neuer, öffnet `#neue-version-overlay` mit „Jetzt neu laden“ (vorher `writeAutoSaveNow()`, dann eine eigene Adresse `?v=<version>`) und „Später“. Als Datei oder offline passiert nichts.
- Test `testStartUndVersion`; dazu ein seltener Zufallsfehler in `testTransferMarketFairness` (Version 3.149).
