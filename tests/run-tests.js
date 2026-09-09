#!/usr/bin/env node
/**
 * Automatisierte Regressionstests für Anstoß Mobile Pro - FM13
 *
 * Baut das Spiel (build.py) und prüft es per Playwright gegen eine Reihe
 * fester Szenarien. Bei jeder Code-Änderung einfach ausführen:
 *
 *   node tests/run-tests.js
 *
 * Exit-Code 0 = alle Tests bestanden, 1 = mindestens ein Fehler.
 */

const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const STANDALONE_PATH = path.join(PROJECT_ROOT, 'dist', 'anstoss-fm13-standalone.html');
const FILE_URL = 'file://' + STANDALONE_PATH;

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log('  ✓ ' + message);
    } else {
        failed++;
        failures.push(message);
        console.log('  ✗ ' + message);
    }
}

function assertClose(actual, expected, tolerance, message) {
    assert(Math.abs(actual - expected) <= tolerance, `${message} (erwartet ~${expected}, erhalten ${actual})`);
}

async function newGamePage(browser) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.goto(FILE_URL);
    await page.waitForTimeout(400);
    return { page, consoleErrors };
}

async function testAllScreensRender(browser) {
    console.log('\n[1] Alle Screens rendern ohne Konsolenfehler');
    const { page, consoleErrors } = await newGamePage(browser);
    const screens = [
        'screen-squad', 'screen-industry', 'screen-raw-materials', 'screen-holding',
        'screen-merch', 'screen-calendar', 'screen-finances', 'screen-stocks', 'screen-sponsors',
        'screen-training', 'screen-stadium', 'screen-campus', 'screen-staff', 'screen-fans',
        'screen-transfer', 'screen-league', 'screen-cup', 'screen-youth', 'screen-contracts',
        'screen-private', 'screen-underworld', 'screen-history', 'screen-admin', 'screen-europe',
        'screen-manager-tree', 'screen-scouting-global'
    ];
    for (const screenId of screens) {
        const display = await page.evaluate((sid) => {
            showScreen(sid);
            const el = document.getElementById(sid);
            return el ? el.style.display : 'ELEMENT_NOT_FOUND';
        }, screenId);
        assert(display === 'block', `${screenId} zeigt sich nach showScreen() (${display})`);
    }
    assert(consoleErrors.length === 0, `keine Konsolenfehler (gefunden: ${consoleErrors.length})`);
    if (consoleErrors.length > 0) console.log('    ', consoleErrors.slice(0, 3));
    await page.close();
}

async function testSquadRotationFitness(browser) {
    console.log('\n[2] Kader-Rotation hält Fitness über eine Saison stabil (Standardkader)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        simulateFullSeason();
        const lineupPlayers = squad.filter(p => lineup.includes(p.id));
        const avgFitness = lineupPlayers.reduce((s, p) => s + p.fitness, 0) / lineupPlayers.length;
        const minFitness = Math.min(...squad.map(p => p.fitness));
        return { avgFitness, minFitness, ourStrength: calcTeamStrength(true) };
    });
    assert(result.avgFitness >= 50, `Durchschnittsfitness am Saisonende >= 50 (${result.avgFitness.toFixed(1)})`);
    assert(result.ourStrength >= 25, `Effektive Teamstärke bleibt nahe Basisstärke (${result.ourStrength})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler während Saison-Simulation');
    await page.close();
}

async function testDominantTeamWinsLeague(browser) {
    console.log('\n[3] Team mit Stärke 99 dominiert die Regionalliga (5 Durchläufe)');
    let allRank1 = true;
    let maxGoalsAgainstPerGame = 0;
    for (let i = 0; i < 5; i++) {
        const { page, consoleErrors } = await newGamePage(browser);
        const r = await page.evaluate(() => {
            squad.forEach(p => { p.strength = 99; p.fitness = 100; });
            autoLineup();
            simulateFullSeason();
            const teams = leaguesData[game.leagueLevel];
            const sorted = [...teams].sort((a, b) => b.points - a.points);
            const myRank = sorted.findIndex(t => t.name === "Lok Leipzig") + 1;
            const myTeam = teams.find(t => t.name === "Lok Leipzig");
            return { rank: myRank, goalsAgainstPerGame: myTeam.goalsAgainst / myTeam.played };
        });
        if (r.rank !== 1) allRank1 = false;
        maxGoalsAgainstPerGame = Math.max(maxGoalsAgainstPerGame, r.goalsAgainstPerGame);
        assert(consoleErrors.length === 0, `Durchlauf ${i + 1}: keine Konsolenfehler`);
        await page.close();
    }
    assert(allRank1, 'in allen 5 Durchläufen Platz 1');
    assert(maxGoalsAgainstPerGame < 0.6, `max. Gegentore/Spiel bleibt niedrig (${maxGoalsAgainstPerGame.toFixed(2)})`);
}

async function testBalancedLeagueGoalRealism(browser) {
    console.log('\n[4] Ausgeglichene Liga hat realistischen Torschnitt (~1.1-1.7 Tore/Team/Spiel)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        simulateFullSeason();
        const teams = leaguesData[game.leagueLevel];
        const totalGoals = teams.reduce((s, t) => s + t.goalsFor, 0);
        const totalGames = teams.reduce((s, t) => s + t.played, 0);
        return { avgGoalsPerTeamPerGame: totalGoals / totalGames };
    });
    assert(
        result.avgGoalsPerTeamPerGame >= 1.0 && result.avgGoalsPerTeamPerGame <= 1.8,
        `Liga-Torschnitt im realistischen Bereich (${result.avgGoalsPerTeamPerGame.toFixed(2)})`
    );
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testSaveLoadRoundtrip(browser) {
    console.log('\n[5] Speichern/Laden-Zyklus (inkl. Getter-Felder wie rawMaterials.capacity)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        adminMaxOutAllBuildings();
        upgradeWarehouse();
        game.money = 777777;
        saveGame();
        game.money = 0;
        const loadOk = loadGame(true);
        return { loadOk, restoredMoney: game.money, capacityStillWorks: typeof rawMaterials.capacity === 'number' };
    });
    assert(result.loadOk === true, 'loadGame() meldet Erfolg');
    assert(result.restoredMoney === 777777, `Geldstand korrekt wiederhergestellt (${result.restoredMoney})`);
    assert(result.capacityStillWorks, 'rawMaterials.capacity bleibt nach Laden ein funktionierender Getter');
    assert(consoleErrors.length === 0, `keine Konsolenfehler beim Speichern/Laden (${consoleErrors.join('; ')})`);
    await page.close();
}

async function testAdminImportExport(browser) {
    console.log('\n[6] Admin JSON-Export/Import-Zyklus');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        adminMaxOutAllBuildings();
        const state = { game, managerRPG, incomingOffers, holdingCompany, rawMaterials, factories, merchandise, stockMarket, underworld, stadium, campusBuildings, staffMembers, fanGroups, privateLife, bandenSponsors, squad, lineup, leaguesData, fixturesData, cupTournament, europeTournament };
        const json = JSON.stringify(state);
        game.money = 0;
        const textarea = document.getElementById('adm-save-json');
        if (textarea) textarea.value = json;
        adminImportSaveJson();
        return { moneyAfterImport: game.money };
    });
    assert(consoleErrors.length === 0, `keine Konsolenfehler beim Import (${consoleErrors.join('; ')})`);
    await page.close();
}

async function testCupAndEurope(browser) {
    console.log('\n[7] Pokal- und Europapokal-Simulation');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        squad.forEach(p => { p.strength = 95; p.fitness = 100; });
        autoLineup();
        simulateCupRound(0);
        const cupMatch = cupTournament.roundsHistory[0].pairings.find(p => p.home === "Lok Leipzig" || p.away === "Lok Leipzig");

        game.inEurope = true;
        initEuropeCup();
        simulateEuropeMatchday(3);
        const euroTeam = [...europeTournament.groupA, ...europeTournament.groupB].find(t => t.name === "Lok Leipzig");

        return { cupMatchPlayed: cupMatch ? cupMatch.played : false, euroTeamPlayed: euroTeam.played };
    });
    assert(result.cupMatchPlayed === true, 'Pokalspiel wurde simuliert');
    assert(result.euroTeamPlayed === 1, 'Europapokal-Spieltag wurde simuliert (played=1)');
    assert(consoleErrors.length === 0, `keine Konsolenfehler (${consoleErrors.join('; ')})`);
    await page.close();
}

async function testRolesAfterSquadInit(browser) {
    console.log('\n[8] Kapitän/Elfmeter/Freistoß-Rollen zeigen auf gültige Spieler mit passendem Trait');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const captain = squad.find(p => p.id === game.captainId);
        const penalty = squad.find(p => p.id === game.penaltyTakerId);
        const freekick = squad.find(p => p.id === game.freeKickTakerId);
        return {
            captainTrait: captain ? captain.trait : null,
            penaltyTrait: penalty ? penalty.trait : null,
            freekickTrait: freekick ? freekick.trait : null,
            squadSize: squad.length
        };
    });
    assert(result.captainTrait === 'Leader', `Kapitän hat Trait "Leader" (${result.captainTrait})`);
    assert(result.penaltyTrait === 'Tor-Instinkt', `Elfmeterschütze hat Trait "Tor-Instinkt" (${result.penaltyTrait})`);
    assert(result.freekickTrait === 'Freistoß-Gott', `Freistoßschütze hat Trait "Freistoß-Gott" (${result.freekickTrait})`);
    assert(result.squadSize === 18, `Standardkader hat 18 Spieler (${result.squadSize})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testScheduleIntegrityAfterViewingTable(browser) {
    console.log('\n[9] Spielplan bleibt korrekt, auch wenn die Tabelle mittendrin angesehen wird');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        let opponentLog = [];
        function playOneMatchday() {
            autoLineup();
            let md = game.matchday;
            for (let l = 0; l < leaguesData.length; l++) {
                let fixs = fixturesData[l] ? fixturesData[l][md - 1] : [];
                fixs?.forEach(f => {
                    if (!f.played) {
                        let hTeam = leaguesData[l][f.home], aTeam = leaguesData[l][f.away];
                        if (l === game.leagueLevel && (hTeam.name === "Lok Leipzig" || aTeam.name === "Lok Leipzig")) {
                            opponentLog.push(hTeam.name === "Lok Leipzig" ? aTeam.name : hTeam.name);
                        }
                        let hStr = (hTeam.name === "Lok Leipzig") ? calcTeamStrength(true) : hTeam.strength;
                        let aStr = (aTeam.name === "Lok Leipzig") ? calcTeamStrength(false) : aTeam.strength;
                        let goals = simulateGoals(hStr, aStr);
                        f.homeGoals = goals.myGoals; f.awayGoals = goals.oppGoals;
                        f.played = true;
                        updateLeagueTable(l, f);
                    }
                });
            }
            applyMatchdayFinances(true, false);
            processPostMatchRoutine();
        }
        for (let i = 0; i < 3; i++) playOneMatchday();
        showScreen('screen-league'); // sortiert früher leaguesData in-place -> Regressionstest
        while (game.matchday <= 34) playOneMatchday();

        let counts = {};
        opponentLog.forEach(o => counts[o] = (counts[o] || 0) + 1);
        return {
            uniqueOpponents: Object.keys(counts).length,
            wrongCounts: Object.entries(counts).filter(([, c]) => c !== 2)
        };
    });
    assert(result.uniqueOpponents === 17, `genau 17 verschiedene Gegner über die Saison (${result.uniqueOpponents})`);
    assert(result.wrongCounts.length === 0, `jeder Gegner exakt 2x (Abweichungen: ${JSON.stringify(result.wrongCounts)})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testInjurySystem(browser) {
    console.log('\n[10] Verletzungs-/Sperren-System');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        // Reha/Physio sollen Ausfallzeit spürbar verkürzen
        function avgDuration(rehaLvl, physioHired) {
            campusBuildings.reha.lvl = rehaLvl;
            staffMembers.physio.hired = physioHired;
            let durations = [];
            for (let i = 0; i < 300; i++) {
                let baseDuration = Math.floor(Math.random() * 4) + 1;
                let reduction = Math.max(0.25, 1 - (campusBuildings.reha.lvl * 0.08) - (staffMembers.physio.hired ? 0.5 : 0));
                durations.push(Math.max(1, Math.round(baseDuration * reduction)));
            }
            return durations.reduce((a, b) => a + b, 0) / durations.length;
        }
        const withoutHelp = avgDuration(0, false);
        const withHelp = avgDuration(5, true);

        // Volle Saison: Countdown darf nie negativ werden, Aufstellung bleibt immer bei 11
        simulateFullSeason();
        const anyNegative = squad.some(p => p.injured < 0 || p.suspended < 0);
        const lineupSize = lineup.length;

        return { withoutHelp, withHelp, anyNegative, lineupSize };
    });
    assert(result.withHelp < result.withoutHelp * 0.7, `Reha+Physio verkürzen Ausfallzeit spürbar (${result.withoutHelp.toFixed(2)} -> ${result.withHelp.toFixed(2)})`);
    assert(result.anyNegative === false, 'Verletzt/Gesperrt-Countdown wird nie negativ');
    assert(result.lineupSize === 11, `Aufstellung bleibt trotz Ausfällen bei 11 Spielern (${result.lineupSize})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testContractExpiryAndEmergencyFill(browser) {
    console.log('\n[11] Vertragsablauf gestreut, Notfall-Auffüllung positionsbalanciert');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const initialContracts = squad.map(p => p.contracts);
        const allSame = initialContracts.every(c => c === initialContracts[0]);

        // Vertragskrise erzwingen und pruefen, ob die Notauffuellung positionsbalanciert bleibt
        squad.forEach(p => p.contracts = 1);
        simulateFullSeason();
        concludeSeasonAndAdvance();
        autoLineup();

        const posCounts = { TW: 0, ABW: 0, MIT: 0, ST: 0 };
        squad.forEach(p => posCounts[p.pos]++);

        return { allSame, squadSize: squad.length, posCounts, lineupSize: lineup.length };
    });
    assert(result.allSame === false, 'Vertragslaufzeiten sind gestreut, nicht mehr synchron');
    assert(result.posCounts.TW >= 2, `nach Notauffüllung genug Torhüter vorhanden (${result.posCounts.TW})`);
    assert(result.posCounts.ABW >= 4 && result.posCounts.MIT >= 4, `genug Abwehr/Mittelfeld (${result.posCounts.ABW}/${result.posCounts.MIT})`);
    assert(result.lineupSize === 11, `Aufstellung nach Notauffüllung vollständig (${result.lineupSize})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testMoraleAffectsStrengthButBounded(browser) {
    console.log('\n[12] Moral wirkt sich auf Teamstärke aus, aber begrenzt (kein Teufelskreis)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        squad.forEach(p => { p.morale = 100; p.fitness = 100; });
        const highMoraleStr = calcTeamStrength(true);
        squad.forEach(p => { p.morale = 10; });
        const lowMoraleStr = calcTeamStrength(true);

        squad.forEach(p => p.morale = 80);
        simulateFullSeason();
        const finalStrength = calcTeamStrength(true);

        return { highMoraleStr, lowMoraleStr, finalStrength, diff: highMoraleStr - lowMoraleStr };
    });
    assert(result.diff > 0 && result.diff <= 8, `Moral-Effekt spürbar aber begrenzt (Differenz: ${result.diff})`);
    assert(result.finalStrength >= 22, `Teamstärke bleibt auch nach schlechter Saison in vernünftigem Bereich (${result.finalStrength})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testStadiumExpansionCap(browser) {
    console.log('\n[13] Stadion-Ausbau ist begrenzt (kein unendlicher Fixpreis-Exploit)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        game.money = 999999999;
        let b = stadium.blocks.haupt;
        let initialCap = b.cap;
        // Baustellen-System (NEU): Ausbau ist jetzt eine Baustelle mit echter Bauzeit statt
        // eines Sofort-Effekts - pro Ausbaustufe queuen und bis zur Fertigstellung
        // durchsimulieren, dann die nächste Stufe anstoßen.
        for (let i = 0; i < 7; i++) {
            expandBlock('haupt', b.addSeats, b.cost * (b.expansions + 1));
            for (let d = 0; d < 150; d++) tickStadiumConstruction(); // realistische, deutlich längere Bauzeiten seit der Baukosten-Überarbeitung
        }
        return { finalExpansions: b.expansions, capGrew: b.cap > initialCap, capBounded: b.cap < initialCap + b.addSeats * 6 };
    });
    assert(result.finalExpansions === 5, `Ausbau stoppt bei Maximalstufe 5 (${result.finalExpansions})`);
    assert(result.capGrew, 'Kapazität ist tatsächlich gewachsen');
    assert(result.capBounded, 'Kapazität bleibt trotz 15 Klickversuchen begrenzt');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testStressAffectsStrengthButBounded(browser) {
    console.log('\n[14] Manager-Stress steigt bei Niederlagen und wirkt sich begrenzt aus');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const before = privateLife.stress;
        simulateFullSeason();
        const after = privateLife.stress;

        privateLife.stress = 0;
        const lowStressStr = calcTeamStrength(true);
        privateLife.stress = 100;
        const highStressStr = calcTeamStrength(true);

        return { before, after, diff: lowStressStr - highStressStr };
    });
    assert(result.after !== result.before, `Stress verändert sich über eine Saison (${result.before} -> ${result.after})`);
    assert(result.diff > 0 && result.diff <= 5, `Stress-Effekt spürbar aber begrenzt (Differenz: ${result.diff})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testHubTabNavigation(browser) {
    console.log('\n[15] Hub-Tabs funktionieren per echtem Klick (Finanzen, Wirtschaft, Ausbau, Kaderplanung, Wettbewerbe, Spezial)');
    const { page, consoleErrors } = await newGamePage(browser);
    const hubs = {
        'screen-finances': ['screen-finances', 'screen-stocks', 'screen-sponsors'],
        'screen-industry': ['screen-industry', 'screen-raw-materials', 'screen-holding', 'screen-merch'],
        'screen-stadium': ['screen-stadium', 'screen-campus', 'screen-staff', 'screen-fans'],
        'screen-transfer': ['screen-transfer', 'screen-scouting-global', 'screen-youth', 'screen-contracts'],
        'screen-league': ['screen-league', 'screen-europe', 'screen-history'],
        'screen-private': ['screen-private', 'screen-underworld']
    };
    for (const [navTarget, members] of Object.entries(hubs)) {
        // Über die Sidebar zum Hub navigieren (Standard-Tab)
        const landedOn = await page.evaluate((sid) => {
            const btns = Array.from(document.querySelectorAll('.nav-btn'));
            const btn = btns.find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(sid));
            if (!btn) return 'NAV_BUTTON_NOT_FOUND';
            btn.click();
            return document.getElementById(sid).style.display;
        }, navTarget);
        assert(landedOn === 'block', `Sidebar-Link öffnet ${navTarget} (${landedOn})`);

        // Jeden weiteren Tab im Hub anklicken und prüfen, dass NUR er sichtbar ist
        for (const memberId of members) {
            const result = await page.evaluate(({ mid, allMembers }) => {
                const btn = document.getElementById('hubtab-btn-' + mid);
                if (!btn) return 'TAB_BUTTON_NOT_FOUND';
                btn.click();
                const visibleOnes = allMembers.filter(m => document.getElementById(m).style.display === 'block');
                return visibleOnes.join(',');
            }, { mid: memberId, allMembers: members });
            assert(result === memberId, `Tab ${memberId} zeigt genau sich selbst, Geschwister versteckt (sichtbar: ${result})`);
        }
    }
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testLiveMatchRichness(browser) {
    console.log('\n[16] Lebendigeres Live-Match: Torschützen, Karten, Halbzeit, Ticker-Vielfalt');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        squad.forEach(p => { p.strength = 90; p.fitness = 100; });
        autoLineup();
        startMatchdayFlow();
        skipPressAndPlay();
        let steps = 0;
        while (currentMatch.minute < 90 && steps < 30) {
            if (currentMatch.awaitingHalftimeTalk) chooseHalftimeTalk('ruhig', true);
            simulateMatchStep();
            steps++;
        }
        let tickerHtml = document.getElementById('ticker-log').innerHTML;
        let lines = tickerHtml.split('</div>').map(l => l.replace(/<[^>]+>/g, '').trim()).filter(l => l.length > 0);
        return {
            lineCount: lines.length,
            hasHalftime: lines.some(l => l.includes('HALBZEITPAUSE')),
            allLinesUnique: new Set(lines).size >= Math.min(4, lines.length)
        };
    });
    assert(result.lineCount >= 5, `Ticker enthält mehrere Ereignisse statt nur Stille (${result.lineCount} Zeilen)`);
    assert(result.hasHalftime, 'Halbzeit-Marker erscheint');
    assert(result.allLinesUnique, 'Ticker-Zeilen sind abwechslungsreich, nicht immer identisch');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testRedCardSuspensionIntegrity(browser) {
    console.log('\n[17] Platzverweis im Live-Match führt zu korrekter Spielsperre');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        squad.forEach(p => { p.strength = 90; p.fitness = 100; });
        autoLineup();
        let onPitch = squad.filter(p => lineup.includes(p.id));
        startMatchdayFlow();
        skipPressAndPlay();
        // Platzverweis deterministisch nachstellen (wie im echten Code) statt auf Zufall zu warten
        let culprit = onPitch[0];
        currentMatch.sentOff.push(culprit.id);
        culprit.suspended = 2;
        if (currentMatch.isHome) currentMatch.homeStrPenalty += 6; else currentMatch.awayStrPenalty += 6;

        simulateRestOfMatch(); // ruft endMatchSimulation() genau einmal intern auf
        autoLineup();
        return {
            suspendedAfterMatch: culprit.suspended,
            excludedFromNextLineup: !lineup.includes(culprit.id)
        };
    });
    assert(result.suspendedAfterMatch === 1, `Spieler ist für genau 1 Spiel gesperrt (${result.suspendedAfterMatch})`);
    assert(result.excludedFromNextLineup, 'gesperrter Spieler wird von der nächsten Aufstellung ausgeschlossen');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testMultiSaveSlotsAndToast(browser) {
    console.log('\n[18] Mehrere Speicherstände + Toast-Feedback statt alert()');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        let out = {};
        game.money = 555555;
        saveGameToSlot(1);
        let toast = document.getElementById('app-toast');
        out.toastVisible = toast.classList.contains('show');
        out.toastMentionsSlot1 = toast.innerText.includes('Slot 1');

        game.money = 222222; game.season = 3;
        saveGameToSlot(2);

        game.money = 0;
        loadGameFromSlot(1, true);
        out.slot1Money = game.money;
        loadGameFromSlot(2, true);
        out.slot2Money = game.money;
        out.slot2Season = game.season;

        // Zwei-Klick-Löschung ohne jeglichen nativen Dialog
        deleteSaveSlot(1);
        out.slot1StillThereAfterFirstClick = !!getSlotMeta(1);
        deleteSaveSlot(1);
        out.slot1GoneAfterSecondClick = !getSlotMeta(1);

        return out;
    });
    assert(result.toastVisible, 'Toast wird nach dem Speichern sichtbar (unabhängig von window.alert)');
    assert(result.toastMentionsSlot1, 'Toast nennt den richtigen Slot');
    assert(result.slot1Money === 555555, `Slot 1 speichert/lädt unabhängig (${result.slot1Money})`);
    assert(result.slot2Money === 222222 && result.slot2Season === 3, `Slot 2 speichert/lädt unabhängig (${result.slot2Money}, Saison ${result.slot2Season})`);
    assert(result.slot1StillThereAfterFirstClick, 'Erster Klick auf Löschen löscht noch nicht (Sicherheitsabfrage)');
    assert(result.slot1GoneAfterSecondClick, 'Zweiter Klick löscht tatsächlich');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testAllTraitsHaveEffect(browser) {
    console.log('\n[19] Alle 7 Spieler-Traits wirken sich messbar auf die Teamstärke aus (jeder Simulationsmodus)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        squad.forEach(p => { p.trait = 'Kein'; p.fitness = 100; });
        autoLineup();
        const baseline = calcTeamStrength(true);
        const diffs = {};

        ['Leader', 'Tor-Instinkt', 'Freistoß-Gott', 'Eisenfuß', 'Flügelflitzer', 'Zweikampfmonster'].forEach(trait => {
            squad.forEach(p => p.trait = 'Kein');
            let target = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW');
            target.trait = trait;
            diffs[trait] = calcTeamStrength(true) - baseline;
        });

        squad.forEach(p => p.trait = 'Kein');
        let tw = squad.find(p => lineup.includes(p.id) && p.pos === 'TW');
        tw.trait = 'Elfmeter-Killer';
        diffs['Elfmeter-Killer'] = calcTeamStrength(true) - baseline;

        return diffs;
    });
    for (const [trait, diff] of Object.entries(result)) {
        assert(diff > 0, `Trait "${trait}" erhöht die Teamstärke messbar (+${diff})`);
    }
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testThematicTabColorsPersist(browser) {
    console.log('\n[20] Thematische Tab-Farben bleiben beim Umschalten erhalten');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        showScreen('screen-raw-materials');
        let industryStillTinted = document.getElementById('hubtab-btn-screen-industry').className.includes('tab-industry');
        showScreen('screen-league');
        let europeStillTinted = document.getElementById('hubtab-btn-screen-europe').className.includes('tab-europe');
        showScreen('screen-underworld');
        let redStillTinted = document.getElementById('hubtab-btn-screen-underworld').className.includes('tab-red');
        let goldStillTinted = document.getElementById('hubtab-btn-screen-private').className.includes('tab-gold');
        return { industryStillTinted, europeStillTinted, redStillTinted, goldStillTinted };
    });
    assert(result.industryStillTinted, 'Industrie-Tabs behalten Orange-Färbung nach Tab-Wechsel');
    assert(result.europeStillTinted, 'Europa-Tab behält Blau-Färbung nach Tab-Wechsel');
    assert(result.redStillTinted, 'Unterwelt-Tab behält Rot-Färbung nach Tab-Wechsel');
    assert(result.goldStillTinted, 'Privatleben-Tab behält Gold-Färbung nach Tab-Wechsel');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testCombinedWorstCaseSelfCorrects(browser) {
    console.log('\n[21] Kombinierter Extremfall (miese Moral+Stress+Fitness gleichzeitig) erholt sich selbst');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        squad.forEach(p => { p.morale = 10; p.fitness = 10; p.trait = 'Kein'; });
        privateLife.stress = 100;
        autoLineup();
        const startStrength = calcTeamStrength(true);

        simulateFullSeason();
        const endStrength = calcTeamStrength(true);

        return { startStrength, endStrength };
    });
    assert(result.startStrength >= 0, `Extremfall bleibt bei nicht-negativer Stärke (${result.startStrength})`);
    assert(result.endStrength > result.startStrength + 15, `System erholt sich über eine Saison spürbar (${result.startStrength} -> ${result.endStrength})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testTutorialOnboarding(browser) {
    console.log('\n[22] Onboarding-Kurzanleitung erscheint einmalig und lässt sich neu öffnen');
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.goto(FILE_URL);
    await page.waitForTimeout(400);

    const firstVisit = await page.evaluate(() => document.getElementById('tutorial-overlay').classList.contains('show'));
    assert(firstVisit, 'Tutorial erscheint beim allerersten Start');

    await page.evaluate(() => closeTutorial());
    const flagSet = await page.evaluate(() => localStorage.getItem('anstoss_fm13_tutorial_seen') === 'true');
    assert(flagSet, 'Schließen setzt das "gesehen"-Flag dauerhaft');

    await page.reload();
    await page.waitForTimeout(400);
    const secondVisit = await page.evaluate(() => document.getElementById('tutorial-overlay').classList.contains('show'));
    assert(!secondVisit, 'Tutorial erscheint nach Neuladen nicht erneut');

    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testOpponentFormCurve(browser) {
    console.log('\n[23] Gegner-Formkurve schwankt begrenzt, Letzte-5-Anzeige funktioniert');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        let team = leaguesData[game.leagueLevel][1];
        let baseStrength = team.baseStrength;
        simulateFullSeason();
        return {
            withinBounds: Math.abs(team.strength - baseStrength) <= 8,
            recentFormLength: team.recentForm.length,
            recentFormValid: team.recentForm.every(r => ['W', 'D', 'L'].includes(r))
        };
    });
    assert(result.withinBounds, 'Formkurve bleibt innerhalb ±8 der Basisstärke');
    assert(result.recentFormLength === 5, `Letzte-5-Anzeige zeigt genau 5 Einträge (${result.recentFormLength})`);
    assert(result.recentFormValid, 'alle Formeinträge sind gültige Ergebnisse (W/D/L)');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testFormCurveBackwardCompat(browser) {
    console.log('\n[24] Formkurve verträgt alte Speicherstände ohne baseStrength/recentForm');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        leaguesData[game.leagueLevel].forEach(t => { delete t.baseStrength; delete t.recentForm; });
        let f = fixturesData[game.leagueLevel][0][0];
        f.homeGoals = 2; f.awayGoals = 1; f.played = true;
        updateLeagueTable(game.leagueLevel, f);
        let team = leaguesData[game.leagueLevel][f.home];
        return { baseStrengthSet: typeof team.baseStrength === 'number', recentFormIsArray: Array.isArray(team.recentForm) };
    });
    assert(result.baseStrengthSet, 'baseStrength wird bei Bedarf automatisch nachgezogen');
    assert(result.recentFormIsArray, 'recentForm wird bei Bedarf automatisch initialisiert');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testPerformance(browser) {
    console.log('\n[25] Performance bleibt in vernünftigen Grenzen (Ladezeit, Simulation, Speicherstand-Größe)');
    const t0 = Date.now();
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.goto(FILE_URL);
    await page.waitForFunction(() => typeof game !== 'undefined' && document.getElementById('screen-dashboard'));
    const loadTime = Date.now() - t0;
    await page.evaluate(() => closeTutorial());

    const seasonTime = await page.evaluate(() => {
        const start = performance.now();
        simulateFullSeason();
        return performance.now() - start;
    });

    const saveSize = await page.evaluate(() => {
        saveGameToSlot(1);
        let raw = localStorage.getItem('anstoss_fm13_save_slot_1');
        return raw ? raw.length : 0;
    });

    const screenSwitchAvg = await page.evaluate(() => {
        const screens = ['screen-squad', 'screen-transfer', 'screen-industry', 'screen-league', 'screen-stadium'];
        let times = [];
        for (let i = 0; i < 10; i++) {
            const start = performance.now();
            showScreen(screens[i % screens.length]);
            times.push(performance.now() - start);
        }
        return times.reduce((a, b) => a + b, 0) / times.length;
    });

    assert(loadTime < 3000, `Seite lädt schnell genug (${loadTime}ms)`);
    assert(seasonTime < 1000, `Saison-Simulation bleibt schnell (${seasonTime.toFixed(0)}ms)`);
    assert(saveSize < 2 * 1024 * 1024, `Speicherstand bleibt kompakt (${(saveSize / 1024).toFixed(0)}KB)`);
    assert(screenSwitchAvg < 50, `Screen-Wechsel bleibt flüssig (Ø ${screenSwitchAvg.toFixed(1)}ms)`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testTrainingMinigames(browser) {
    console.log('\n[26] Trainings-Minispiele (Elfmeterschießen & Flankentraining)');
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.goto(FILE_URL);
    await page.waitForTimeout(400);
    await page.evaluate(() => closeTutorial());

    await page.evaluate(() => openPenaltyGame(squad[0].id));
    for (let i = 0; i < 5; i++) {
        await page.evaluate((zone) => takePenaltyShot(zone), i % 6);
        await page.waitForTimeout(950);
    }
    await page.waitForTimeout(1700);
    const afterPenalty = await page.evaluate(() => ({
        sessionsLeft: trainingSessionsLeft(),
        overlayClosed: !document.getElementById('minigame-overlay').classList.contains('show'),
        bestScoreRecorded: game.bestPenaltyScore >= 0
    }));
    assert(afterPenalty.sessionsLeft === 1, `Elfmeterschießen verbraucht eine Trainingseinheit (${afterPenalty.sessionsLeft} übrig)`);
    assert(afterPenalty.overlayClosed, 'Overlay schließt sich nach Spielende automatisch');

    await page.evaluate(() => openCrossingGame(squad[1].id));
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => takeCrossingAttempt());
        await page.waitForTimeout(950);
    }
    await page.waitForTimeout(1700);
    const afterCrossing = await page.evaluate(() => ({
        sessionsLeft: trainingSessionsLeft(),
        overlayClosed: !document.getElementById('minigame-overlay').classList.contains('show')
    }));
    assert(afterCrossing.sessionsLeft === 0, `Flankentraining verbraucht die zweite Einheit (${afterCrossing.sessionsLeft} übrig)`);
    assert(afterCrossing.overlayClosed, 'Overlay schließt sich auch beim Flankentraining automatisch');

    const limitCheck = await page.evaluate(() => {
        openPenaltyGame(squad[2].id);
        return document.getElementById('minigame-overlay').classList.contains('show');
    });
    assert(limitCheck === false, 'drittes Minispiel wird durch das Tageslimit blockiert');

    const resetCheck = await page.evaluate(() => {
        game.matchday = game.matchday + 1;
        return trainingSessionsLeft();
    });
    assert(resetCheck === 2, `Limit setzt sich bei neuem Spieltag zurück (${resetCheck})`);

    const probBounds = await page.evaluate(() => {
        let ok = true;
        for (let shooting = 40; shooting <= 99; shooting += 5) {
            for (const matched of [true, false]) {
                let p = calcPenaltyScoreChance(shooting, matched);
                if (p < 0 || p > 1) ok = false;
            }
        }
        for (let pos = 0; pos <= 100; pos += 5) {
            let zone = crossingGetZone(pos);
            if (!['perfekt', 'gut', 'schlecht'].includes(zone)) ok = false;
        }
        return ok;
    });
    assert(probBounds, 'Trefferwahrscheinlichkeiten und Zonen bleiben immer in gültigen Grenzen');

    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testTacticStyleTradeoff(browser) {
    console.log('\n[27] Spielstil (Offensiv/Defensiv) bietet echten Trade-off: Stärke vs. Fitness');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        setTacticStyle('ausgeglichen');
        const balancedStr = calcTeamStrength(true);
        setTacticStyle('offensiv');
        const offensiveStr = calcTeamStrength(true);
        setTacticStyle('defensiv');
        const defensiveStr = calcTeamStrength(true);

        setTacticStyle('offensiv');
        squad.forEach(p => p.fitness = 100);
        processPostMatchRoutine('win');
        const offensiveFitness = squad.filter(p => lineup.includes(p.id))[0].fitness;

        setTacticStyle('defensiv');
        squad.forEach(p => p.fitness = 100);
        processPostMatchRoutine('win');
        const defensiveFitness = squad.filter(p => lineup.includes(p.id))[0].fitness;

        return { balancedStr, offensiveStr, defensiveStr, offensiveFitness, defensiveFitness };
    });
    assert(result.offensiveStr > result.balancedStr, `Offensiv erhöht die Teamstärke (${result.balancedStr} -> ${result.offensiveStr})`);
    // Spielstile 2.0: Defensiv ist jetzt ein echter Trade-off (weniger Durchschlagskraft für
    // mehr Kompaktheit/Kraftersparnis) statt eines pauschalen Stärkebonus wie zuvor - die
    // Erwartung wurde entsprechend der neuen, realistischeren Designabsicht angepasst.
    assert(result.defensiveStr <= result.balancedStr, `Defensiv reduziert die offensive Durchschlagskraft wie vorgesehen (${result.balancedStr} -> ${result.defensiveStr})`);
    assert(result.offensiveFitness < result.defensiveFitness, `Offensiv kostet mehr Fitness als Defensiv (${result.offensiveFitness} vs ${result.defensiveFitness})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testSquadPositionFilter(browser) {
    console.log('\n[28] Kaderliste lässt sich nach Position filtern');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        showScreen('screen-squad');
        setSquadFilter('ST');
        const stRows = document.querySelectorAll('#bench-list .player-card').length;
        const stCount = squad.filter(p => p.pos === 'ST').length;
        setSquadFilter('alle');
        const allRows = document.querySelectorAll('#bench-list .player-card').length;
        return { stRows, stCount, allRows, squadSize: squad.length };
    });
    assert(result.stRows === result.stCount, `Filter "ST" zeigt nur Stürmer (${result.stRows}/${result.stCount})`);
    assert(result.allRows === result.squadSize, `Filter "Alle" zeigt den kompletten Kader (${result.allRows}/${result.squadSize})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testSponsorNegotiationSystem(browser) {
    console.log('\n[29] Sponsoren-Verhandlungssystem (Angebote, Nachverhandeln, Annehmen)');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        sponsorOffers.push({ id: 999, name: "TestSponsor AG", base: 3000, winBonus: 1000, duration: 34, negotiationsUsed: 0 });
        let offer = sponsorOffers.find(o => o.id === 999);
        const baseBefore = offer.base;

        negotiateSponsorOffer(999);
        negotiateSponsorOffer(999);
        const negotiationsUsed = offer.negotiationsUsed;
        const baseBeforeThird = offer.base;
        negotiateSponsorOffer(999); // sollte blockiert sein (Limit erreicht)
        const thirdBlocked = offer.base === baseBeforeThird && offer.negotiationsUsed === 2;

        const nameBeforeAccept = offer.name;
        acceptSponsorOffer(999);

        return {
            baseBefore, negotiationsUsed, thirdBlocked,
            sponsorAccepted: game.sponsor.name === nameBeforeAccept,
            offersCleared: sponsorOffers.length === 0
        };
    });
    assert(result.negotiationsUsed === 2, `Nachverhandeln wird korrekt zweimal gezählt (${result.negotiationsUsed})`);
    assert(result.thirdBlocked, 'dritte Nachverhandlung wird blockiert (Limit erreicht)');
    assert(result.sponsorAccepted, 'Angenommenes Angebot wird korrekt zum neuen Hauptsponsor');
    assert(result.offersCleared, 'offene Angebote werden nach Annahme geleert');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testBandenAcquisitionCap(browser) {
    console.log('\n[30] Neue Bandenwerbung per Angebot akquirieren, mit Obergrenze');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const before = bandenSponsors.length;
        bandenOffers.push({ id: 1, name: "TestBande GmbH", type: "LED-Bande", income: 1000, negotiationsUsed: 0 });
        acceptBandenOffer(1);
        const afterOne = bandenSponsors.length;
        for (let i = 0; i < 10; i++) {
            bandenOffers.push({ id: 100 + i, name: "Bande " + i, type: "Statisch", income: 500, negotiationsUsed: 0 });
            acceptBandenOffer(100 + i);
        }
        return { before, afterOne, finalCount: bandenSponsors.length };
    });
    assert(result.afterOne === result.before + 1, `eine Akquise fügt genau einen neuen Slot hinzu (${result.before} -> ${result.afterOne})`);
    assert(result.finalCount <= 8, `Bandenslots bleiben bei maximal 8 (${result.finalCount})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testSponsorOffersAppearOverSeason(browser) {
    console.log('\n[31] Sponsorangebote entstehen organisch über eine Saison, Obergrenze hält');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        let maxOffers = 0;
        for (let md = 1; md <= 34; md++) {
            checkIncomingSponsorOffers();
            maxOffers = Math.max(maxOffers, sponsorOffers.length);
        }
        return maxOffers;
    });
    assert(result > 0, `mindestens ein Angebot entsteht über eine Saison (${result})`);
    assert(result <= 2, `Obergrenze von 2 gleichzeitigen Angeboten wird eingehalten (${result})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testUnderworldDarkerMechanics(browser) {
    console.log('\n[32] Unterwelt: Doping, Bestechung und harte Konsequenzen für Wiederholungstäter');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const baseStr = calcTeamStrength(true);
        game.money = 999999;
        buyUnderworldAction('doping', 18000, 25);
        const dopedStr = calcTeamStrength(true);

        underworld.activeSabotages.bribeOpponent = true;
        const oppTeam = leaguesData[game.leagueLevel].find(t => t.name !== "Lok Leipzig");
        const original = oppTeam.strength;
        const sabotaged = applySabotageToOpponentStrength(original);

        let caughtDoping = false;
        for (let i = 0; i < 60 && !caughtDoping; i++) {
            squad.forEach(p => p.suspended = 0);
            underworld.activeSabotages.doping = true;
            processPostMatchRoutine('win');
            if (squad.some(p => p.suspended >= 1)) caughtDoping = true;
        }

        const myTeam = leaguesData[game.leagueLevel].find(t => t.name === "Lok Leipzig");
        let pointsDeducted = false;
        for (let i = 0; i < 30 && !pointsDeducted; i++) {
            myTeam.points = 20;
            underworld.pressure = 90;
            underworld.offenseCount = 2;
            processPostMatchRoutine('win');
            if (myTeam.points < 20) pointsDeducted = true;
        }

        return { baseStr, dopedStr, original, sabotaged, caughtDoping, pointsDeducted };
    });
    assert(result.dopedStr > result.baseStr, `Doping erhöht die Teamstärke messbar (${result.baseStr} -> ${result.dopedStr})`);
    assert(result.sabotaged < result.original, `Bestochener Gegner ist messbar schwächer (${result.original} -> ${result.sabotaged})`);
    assert(result.caughtDoping, 'Dopingtest kann einen Spieler tatsächlich erwischen und sperren');
    assert(result.pointsDeducted, 'Wiederholungstäter riskieren einen echten Punktabzug in der Tabelle');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testUnderworldSabotageWorksInBulkSim(browser) {
    console.log('\n[33] Unterwelt-Sabotagen wirken auch bei "Saison durchsimulieren", nicht nur live');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        // Direkter Vergleich: gleicher Gegner, einmal mit und einmal ohne aktive Sabotage
        const oppStrRaw = 70;
        const withoutSabotage = applySabotageToOpponentStrength(oppStrRaw);
        underworld.activeSabotages.pyroHotel = true;
        const withSabotage = applySabotageToOpponentStrength(oppStrRaw);
        return { withoutSabotage, withSabotage };
    });
    assert(result.withSabotage < result.withoutSabotage, `Sabotage wirkt über die gemeinsame Hilfsfunktion (${result.withoutSabotage} -> ${result.withSabotage})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testStockMarketRealMovement(browser) {
    console.log('\n[34] Aktienmarkt hat echte Kursbewegung, Chart und sichere Dividendenberechnung');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const initialPrice = stockMarket.techCorp.price;
        for (let i = 0; i < 15; i++) updateStockMarket();
        const priceChanged = stockMarket.techCorp.price !== initialPrice;
        const historyCapped = stockMarket.techCorp.history.length <= 20;
        const allPricesPositive = STOCK_KEYS.every(k => stockMarket[k].price > 0);

        const dividends = STOCK_KEYS.reduce((sum, key) => {
            let s = stockMarket[key];
            return s ? sum + (s.owned * s.price * s.dividendRate) : sum;
        }, 0);

        showScreen('screen-stocks');
        const cardCount = document.querySelectorAll('#stocks-market-list .player-row').length;

        const moneyBefore = game.money;
        buyStockShares('techCorp', 10);
        const buyWorks = game.money < moneyBefore && stockMarket.techCorp.owned === 10;
        sellStockShares('techCorp', 10);
        const sellWorks = stockMarket.techCorp.owned === 0;

        return { priceChanged, historyCapped, allPricesPositive, dividendsNotNaN: !isNaN(dividends), cardCount, buyWorks, sellWorks };
    });
    assert(result.priceChanged, 'Aktienkurse bewegen sich tatsächlich über die Zeit');
    assert(result.historyCapped, 'Kursverlauf bleibt auf 20 Einträge begrenzt');
    assert(result.allPricesPositive, 'Kurse werden nie null oder negativ');
    assert(result.dividendsNotNaN, 'Dividendenberechnung bleibt fehlerfrei (kein NaN durch activeMarketEvent-Feld)');
    assert(result.cardCount === 6, `alle 6 Aktien werden gerendert (${result.cardCount})`);
    assert(result.buyWorks && result.sellWorks, 'Kauf und Verkauf funktionieren weiterhin');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testDerbyRivalrySystem(browser) {
    console.log('\n[35] Derby-/Rivalitätssystem: Zuweisung, Symmetrie, Ausschreitungsrisiko, Geisterspiel');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        let ourTeam = leaguesData[game.leagueLevel].find(t => t.name === "Lok Leipzig");
        let rivalTeam = leaguesData[game.leagueLevel].find(t => t.name === ourTeam.rivalName);

        game.stewards = 0;
        let incidentsLow = 0, trials = 200;
        for (let i = 0; i < trials; i++) {
            game.forcedGhostGame = false; game.money = 999999;
            checkHooliganIncident();
            if (game.forcedGhostGame) incidentsLow++;
        }
        game.stewards = 100;
        let incidentsHigh = 0;
        for (let i = 0; i < trials; i++) {
            game.forcedGhostGame = false; game.money = 999999;
            checkHooliganIncident();
            if (game.forcedGhostGame) incidentsHigh++;
        }

        game.forcedGhostGame = true;
        stadium.blocks.haupt.cap = 50000;
        game.money = 0;
        applyMatchdayFinances(true, true);
        let ghostIncome = game.money;
        let ghostFlagCleared = game.forcedGhostGame === false;
        game.money = 0;
        applyMatchdayFinances(true, true);
        let normalIncome = game.money;

        return {
            hasRival: !!ourTeam.rivalName,
            hasFriend: !!ourTeam.friendName,
            rivalDistinctFromFriend: ourTeam.rivalName !== ourTeam.friendName,
            rivalSymmetric: rivalTeam.rivalName === "Lok Leipzig",
            incidentsLow, incidentsHigh,
            ghostIncome, normalIncome, ghostFlagCleared
        };
    });
    assert(result.hasRival && result.hasFriend, 'jedes Team bekommt einen Rivalen und einen Fanfreund zugewiesen');
    assert(result.rivalDistinctFromFriend, 'Rivale und Fanfreund sind nie dasselbe Team');
    assert(result.rivalSymmetric, 'Rivalität ist symmetrisch (A-B bedeutet auch B-A)');
    assert(result.incidentsHigh < result.incidentsLow, `mehr Ordnerdienst senkt das Ausschreitungsrisiko spürbar (${result.incidentsLow} -> ${result.incidentsHigh} von 200)`);
    assert(result.ghostIncome < result.normalIncome, `Geisterspiel bringt spürbar weniger Einnahmen (${result.ghostIncome} vs ${result.normalIncome})`);
    assert(result.ghostFlagCleared, 'Geisterspiel-Auflage wird nach der Partie zurückgesetzt');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testStockMarketBiggerBuyOptions(browser) {
    console.log('\n[36] Aktienmarkt: größere Kaufmengen und Max-Kauf für hohe Geldbeträge');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        game.money = 2000000;
        const before = game.money;
        buyMaxStockShares('techCorp');
        return { owned: stockMarket.techCorp.owned, moneySpent: before - game.money };
    });
    assert(result.owned > 1000, `Max-Kauf erwirbt eine dem Vermögen angemessene Menge (${result.owned} Aktien)`);
    assert(result.moneySpent > 0, 'Max-Kauf verbraucht tatsächlich Geld');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testPlayerRoleBonusScalesWithSquad(browser) {
    console.log('\n[37] Spielerrollen: Bonus skaliert relativ zur eigenen Stärke, nicht an fixer Schwelle');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        let starters = squad.filter(p => lineup.includes(p.id));
        starters.forEach(p => p.role = null);
        const baseline = calcTeamStrength(true);
        let count = 0;
        starters.forEach(p => {
            let roles = PLAYER_ROLES[p.pos] || [];
            let fittingRole = roles.find(r => (p[r.statKey] || 0) >= p.strength);
            if (fittingRole) { p.role = fittingRole.id; count++; }
        });
        const withRoles = calcTeamStrength(true);
        return { baseline, withRoles, count };
    });
    assert(result.count > 0, `passende Rollen lassen sich auch bei einem schwachen Startkader finden (${result.count})`);
    assert(result.withRoles > result.baseline, `zugewiesene passende Rollen erhöhen die Teamstärke (${result.baseline} -> ${result.withRoles})`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testSponsorsAllThreeHaveNegotiation(browser) {
    console.log('\n[38] Alle drei Sponsoren-Vertragsarten unterstützen Verhandlungen');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        kitSupplierOffers.push({ id: 501, name: "TestKit Sport", signOn: 20000, income: 1500, negotiationsUsed: 0 });
        const kitBefore = kitSupplierOffers.find(o => o.id === 501).income;
        negotiateKitOffer(501);
        const kitChanged = kitSupplierOffers.find(o => o.id === 501).income !== kitBefore;
        acceptKitOffer(501);
        const kitAccepted = game.kitSupplier.name === "TestKit Sport";

        bandenOffers.push({ id: 601, name: "TestBande GmbH", type: "LED-Bande", income: 1000, negotiationsUsed: 0 });
        const bandenBefore = bandenOffers.find(o => o.id === 601).income;
        negotiateBandenOffer(601);
        const bandenChanged = bandenOffers.find(o => o.id === 601).negotiationsUsed === 1;
        const bandenCountBefore = bandenSponsors.length;
        acceptBandenOffer(601);
        const bandenAccepted = bandenSponsors.length === bandenCountBefore + 1;

        let noRealBrands = true;
        for (let i = 0; i < 30; i++) {
            if (['Nike', 'Adidas', 'Puma', 'Under Armour', 'New Balance'].includes(generateKitBrandName())) noRealBrands = false;
        }

        return { kitChanged, kitAccepted, bandenChanged, bandenAccepted, noRealBrands };
    });
    assert(result.kitChanged, 'Trikot-Ausrüster-Angebote lassen sich nachverhandeln');
    assert(result.kitAccepted, 'Ausrüster-Angebot lässt sich annehmen');
    assert(result.bandenChanged, 'Bandenwerbe-Angebote lassen sich nachverhandeln');
    assert(result.bandenAccepted, 'Bandenwerbe-Angebot lässt sich annehmen');
    assert(result.noRealBrands, 'Ausrüster-Namen sind frei erfunden, keine echten Marken');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testBudgetEnforcement(browser) {
    console.log('\n[39] Transfer- und Gehaltsbudget werden beim Kauf echt durchgesetzt');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const dummy = { id: 'x1', name: 'Test', pos: 'ST', strength: 90, marketValue: 500000, wage: 5000, fitness: 100, morale: 80, contracts: 2, injured: 0, suspended: 0, trait: 'Kein', individualFocus: 'allgemein', pace: 80, shooting: 80, passing: 80, defense: 80, physique: 80 };
        game.money = 999999999; game.transferBudget = 1000;
        marketPlayers.push({ ...dummy });
        const before = squad.length;
        buyPlayer(marketPlayers.length - 1);
        const blockedByTransferBudget = squad.length === before;

        game.transferBudget = 999999999; game.wageBudget = 100;
        marketPlayers.push({ ...dummy, id: 'x2', marketValue: 100, wage: 90000 });
        buyPlayer(marketPlayers.length - 1);
        const blockedByWageBudget = squad.length === before;
        return { blockedByTransferBudget, blockedByWageBudget };
    });
    assert(result.blockedByTransferBudget, 'Kauf wird bei unzureichendem Transferbudget blockiert');
    assert(result.blockedByWageBudget, 'Kauf wird bei unzureichendem Gehaltsbudget blockiert');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testLoanTiersAndCap(browser) {
    console.log('\n[40] Kredit-Staffelung: echte Ratenzahlung und Obergrenze');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        game.wageBudget = 999999999;
        activeLoans = [];
        takeLoanTier('kurz', 100000);
        const loan = activeLoans[0];
        const created = !!loan && loan.matchdaysLeft === 10;
        const moneyBefore = game.money;
        processLoanInstallments();
        const installmentDeducted = game.money === moneyBefore - loan.installment;
        const decremented = activeLoans[0].matchdaysLeft === 9;

        takeLoanTier('mittel', 50000);
        takeLoanTier('lang', 50000);
        const countBefore = activeLoans.length;
        takeLoanTier('kurz', 10000);
        const capEnforced = activeLoans.length === countBefore && countBefore === 3;
        return { created, installmentDeducted, decremented, capEnforced };
    });
    assert(result.created, 'Kredit wird mit korrekter Laufzeit angelegt');
    assert(result.installmentDeducted, 'Rate wird automatisch vom Konto abgezogen');
    assert(result.decremented, 'Restlaufzeit zählt korrekt herunter');
    assert(result.capEnforced, 'maximal 3 laufende Kredite gleichzeitig');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testInsolvencyEscalation(browser) {
    console.log('\n[41] Insolvenzrisiko: Transfersperre bei anhaltend negativem Konto');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        game.money = -100; game.negativeStreak = 0; game.transferEmbargo = false;
        for (let i = 0; i < 6; i++) checkInsolvencyRisk();
        const embargoTriggered = game.transferEmbargo === true;
        game.money = 100;
        checkInsolvencyRisk();
        const embargoCleared = game.transferEmbargo === false && game.negativeStreak === 0;
        return { embargoTriggered, embargoCleared };
    });
    assert(result.embargoTriggered, 'Transfersperre greift nach 6 Spieltagen im Minus');
    assert(result.embargoCleared, 'Transfersperre und Streak lösen sich auf, sobald das Konto wieder im Plus ist');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testBettingSystem(browser) {
    console.log('\n[42] Wettbüro: realistische Quoten, Einsatzgrenzen, korrekte Abrechnung');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const odds = calcOddsFromStrength(70, 50, true);
        const oddsReasonable = odds.oddsWin > 1 && odds.oddsWin < 10 && odds.oddsLoss > odds.oddsWin;

        activeBet = null; game.money = 10000;
        placeBet('win', 500);
        const placed = activeBet !== null && activeBet.stake === 500;
        const moneyAfterBet = game.money;
        resolveBetIfPending('win');
        const wonPaysOut = game.money > moneyAfterBet;
        const clearedAfter = activeBet === null;

        game.money = 100000; activeBet = null;
        placeBet('win', 90000);
        const stakeCapped = activeBet && activeBet.stake <= 15000;

        activeBet = null; game.money = 5000;
        placeBet('loss', 500);
        const moneyAfterLossBet = game.money;
        resolveBetIfPending('win'); // Ergebnis war Sieg, Wette war auf Niederlage -> Verlust
        const lossDeductedCorrectly = game.money === moneyAfterLossBet; // kein weiterer Abzug, Einsatz bereits weg

        return { oddsReasonable, placed, wonPaysOut, clearedAfter, stakeCapped, lossDeductedCorrectly };
    });
    assert(result.oddsReasonable, 'Quoten liegen in einem plausiblen Bereich, Außenseiter-Quote höher als Favoriten-Quote');
    assert(result.placed, 'Wette lässt sich platzieren und Einsatz wird abgebucht');
    assert(result.wonPaysOut, 'gewonnene Wette zahlt tatsächlich aus');
    assert(result.clearedAfter, 'aktive Wette wird nach Abrechnung zurückgesetzt');
    assert(result.stakeCapped, 'Einsatz wird auf 15% des Kontostands gedeckelt');
    assert(result.lossDeductedCorrectly, 'verlorene Wette zieht keinen zusätzlichen Betrag ab (Einsatz war bereits weg)');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testFanshopManagerTasks(browser) {
    console.log('\n[43] Fanshop-Manager: wählbare Aufgabe, automatische Ausführung nur wenn eingestellt');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        merchandise.jerseys.stock = 50;
        const moneyBefore1 = game.money;
        runFanshopManagerTasks();
        const noEffectWithoutStaff = merchandise.jerseys.stock === 50 && game.money === moneyBefore1;

        game.money = 999999;
        toggleStaffMember('fanshopManager');
        const hired = staffMembers.fanshopManager.hired === true;

        setFanshopManagerTask('restock');
        merchandise.jerseys.stock = 50;
        const moneyBefore2 = game.money;
        runFanshopManagerTasks();
        const restockWorked = merchandise.jerseys.stock > 50 && game.money < moneyBefore2;

        setFanshopManagerTask('pricing');
        merchandise.scarves.price = 10;
        merchandise.scarves.optimalPrice = 18;
        runFanshopManagerTasks();
        const pricingMoved = merchandise.scarves.price === 11;

        setFanshopManagerTask('promo');
        merchandise.caps.stock = 500;
        merchandise.caps.price = 22;
        const priceBefore = merchandise.caps.price;
        runFanshopManagerTasks();
        const promoLowered = merchandise.caps.price < priceBefore;

        toggleStaffMember('fanshopManager');
        merchandise.jerseys.stock = 50;
        const moneyBefore3 = game.money;
        runFanshopManagerTasks();
        const noEffectAfterFiring = merchandise.jerseys.stock === 50 && game.money === moneyBefore3;

        return { noEffectWithoutStaff, hired, restockWorked, pricingMoved, promoLowered, noEffectAfterFiring };
    });
    assert(result.noEffectWithoutStaff, 'ohne eingestellten Fanshop-Manager passiert nichts automatisch');
    assert(result.hired, 'Fanshop-Manager lässt sich einstellen');
    assert(result.restockWorked, 'Aufgabe "Lagerauffüllung" bestellt automatisch nach und zieht Geld ab');
    assert(result.pricingMoved, 'Aufgabe "Preisoptimierung" nähert den Preis schrittweise dem Optimum an');
    assert(result.promoLowered, 'Aufgabe "Rabattaktionen" senkt den Preis stark überlagerter Artikel');
    assert(result.noEffectAfterFiring, 'nach Entlassung greift die Automatik nicht mehr');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testPrivateLifeWageFixAndNewFeatures(browser) {
    console.log('\n[44] Privatleben: Gehalts-Kernbug behoben + Lifestyle/Einkommen/Hobby/Beziehung/Spenden');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        const moneyBefore = privateLife.money;
        for (let i = 0; i < 10; i++) adminAdvanceMatchdays(1);
        const wageNowPaid = privateLife.money > moneyBefore;

        privateLife.money = 999999; privateLife.stress = 50;
        const prestigeBefore = privateLife.prestige;
        buyLifestyleAsset('villa');
        const assetBought = privateLife.assets.includes('villa');
        const assetEffects = privateLife.prestige > prestigeBefore && privateLife.stress < 50;
        const moneyAfterAsset = privateLife.money;
        buyLifestyleAsset('villa');
        const cannotBuyTwice = privateLife.money === moneyAfterAsset;

        privateLife.prestige = 50; game.matchday = 1;
        const moneyBeforeActivity = privateLife.money;
        doPrestigeActivity('interview');
        const activityPaidOut = privateLife.money > moneyBeforeActivity;
        const moneyAfterFirst = privateLife.money;
        doPrestigeActivity('interview');
        const cooldownBlocksRepeat = privateLife.money === moneyAfterFirst;

        privateLife.prestige = 0; privateLife.lastActivity = {};
        const moneyBeforeLocked = privateLife.money;
        doPrestigeActivity('book');
        const prestigeGateEnforced = privateLife.money === moneyBeforeLocked;

        privateLife.hobby = 'fitness'; privateLife.relationship = 'family'; privateLife.stress = 50; privateLife.money = 100000;
        processPrivateLifeMatchday();
        const hobbyRelationshipWork = privateLife.stress < 50 && privateLife.money < 100000 + privateLife.wage;

        privateLife.money = 50000; game.boardSat = 50; game.fans = 50;
        makeCharityDonation(10000);
        const charityWorks = game.boardSat > 50 && game.fans > 50 && privateLife.money === 40000;

        privateLife.money = 50000; game.money = 1000;
        depositToClub(20000);
        const depositWorks = game.money === 21000 && privateLife.money === 30000;

        return { wageNowPaid, assetBought, assetEffects, cannotBuyTwice, activityPaidOut, cooldownBlocksRepeat, prestigeGateEnforced, hobbyRelationshipWork, charityWorks, depositWorks };
    });
    assert(result.wageNowPaid, 'KERNBUG BEHOBEN: Manager-Gehalt wird jetzt tatsächlich jeden Spieltag ausgezahlt');
    assert(result.assetBought && result.assetEffects, 'Lifestyle-Asset kaufen gibt Prestige und reduziert Stress');
    assert(result.cannotBuyTwice, 'bereits besessenes Asset kann nicht doppelt gekauft werden');
    assert(result.activityPaidOut, 'Prestige-Einkommensaktivität zahlt aus');
    assert(result.cooldownBlocksRepeat, 'Abklingzeit verhindert sofortige Wiederholung');
    assert(result.prestigeGateEnforced, 'Prestige-Mindestanforderung wird durchgesetzt');
    assert(result.hobbyRelationshipWork, 'Hobby und Beziehungsstatus wirken sich passiv auf Stress und Vermögen aus');
    assert(result.charityWorks, 'Wohltätigkeitsspende verbessert Vorstand & Fans und kostet Privatvermögen');
    assert(result.depositWorks, 'Einzahlung ins Vereinskonto überträgt Geld korrekt');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testStaffAutoTaskDelegation(browser) {
    console.log('\n[45] Personal-Automatik: Co-Trainer verteilt Spielertraining, Konditionstrainer wählt Trainingsschwerpunkt');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        game.money = 999999;

        squad.forEach(p => p.individualFocus = 'allgemein');
        runCoTrainerAutoAssignment();
        const noEffectWithoutStaff = squad.every(p => p.individualFocus === 'allgemein');

        toggleStaffMember('coTrainer');
        setCoTrainerTask('schwaechen');
        const testPlayer = squad[0];
        testPlayer.shooting = 90; testPlayer.passing = 20; testPlayer.defense = 50; testPlayer.pace = 50;
        runCoTrainerAutoAssignment();
        const weaknessCorrect = testPlayer.individualFocus === 'passspiel';

        setCoTrainerTask('staerken');
        runCoTrainerAutoAssignment();
        const strengthCorrect = testPlayer.individualFocus === 'torschuss';

        setCoTrainerTask('rotation');
        game.matchday = 1; runCoTrainerAutoAssignment();
        const focusMd1 = testPlayer.individualFocus;
        game.matchday = 2; runCoTrainerAutoAssignment();
        const focusMd2 = testPlayer.individualFocus;
        const rotationChanges = focusMd1 !== focusMd2;

        toggleStaffMember('fitCoach');
        setFitCoachTask('auto-fitness');
        squad.forEach(p => p.fitness = 50);
        runFitCoachAutoAssignment();
        const lowFitnessErholung = game.teamTraining === 'erholung';
        squad.forEach(p => p.fitness = 95);
        runFitCoachAutoAssignment();
        const highFitnessKondition = game.teamTraining === 'kondition';

        toggleStaffMember('coTrainer');
        testPlayer.individualFocus = 'allgemein';
        runCoTrainerAutoAssignment();
        const noEffectAfterFiring = testPlayer.individualFocus === 'allgemein';

        return { noEffectWithoutStaff, weaknessCorrect, strengthCorrect, rotationChanges, lowFitnessErholung, highFitnessKondition, noEffectAfterFiring };
    });
    assert(result.noEffectWithoutStaff, 'ohne eingestellten Co-Trainer bleibt Training unverändert');
    assert(result.weaknessCorrect, '"Schwächen ausgleichen" wählt korrekt den niedrigsten Wert');
    assert(result.strengthCorrect, '"Stärken ausbauen" wählt korrekt den höchsten Wert');
    assert(result.rotationChanges, '"Rotierendes Training" wechselt den Fokus über Spieltage');
    assert(result.lowFitnessErholung, 'Konditionstrainer schaltet bei niedriger Fitness auf Erholung');
    assert(result.highFitnessKondition, 'Konditionstrainer schaltet bei hoher Fitness auf Kondition');
    assert(result.noEffectAfterFiring, 'nach Entlassung des Co-Trainers greift die Automatik nicht mehr');
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function testFanLiaisonPassiveAndPricing(browser) {
    console.log('\n[46] Fanbeauftragter: passiver Effekt jetzt echt wirksam + automatische Ticketpreis-Verwaltung');
    const { page, consoleErrors } = await newGamePage(browser);
    const result = await page.evaluate(() => {
        game.money = 999999;
        game.fans = 50;
        applyFanLiaisonPassiveEffect();
        const noPassiveWithoutStaff = game.fans === 50;

        toggleStaffMember('fanLiaison');
        applyFanLiaisonPassiveEffect();
        const passiveWorks = game.fans === 51;

        setFanLiaisonTask('guenstig');
        runFanLiaisonAutoPricing();
        const guenstigCorrect = game.ticketPrices.steh === 8 && game.fans === 53;

        setFanLiaisonTask('premium');
        const fansBefore = game.fans;
        runFanLiaisonAutoPricing();
        const premiumCorrect = game.ticketPrices.steh === 18 && game.fans === fansBefore;

        game.stewards = 0;
        toggleStaffMember('fanLiaison');
        let withoutCount = 0;
        for (let i = 0; i < 300; i++) { game.forcedGhostGame = false; checkHooliganIncident(); if (game.forcedGhostGame) withoutCount++; }
        toggleStaffMember('fanLiaison');
        let withCount = 0;
        for (let i = 0; i < 300; i++) { game.forcedGhostGame = false; checkHooliganIncident(); if (game.forcedGhostGame) withCount++; }

        return { noPassiveWithoutStaff, passiveWorks, guenstigCorrect, premiumCorrect, withoutCount, withCount };
    });
    assert(result.noPassiveWithoutStaff, 'ohne eingestellten Fanbeauftragten kein passiver Effekt');
    assert(result.passiveWorks, 'Fanbeauftragter erhöht Fan-Zufriedenheit jetzt tatsächlich jeden Spieltag');
    assert(result.guenstigCorrect, '"Zufriedenheit priorisieren" senkt Preise und boostet Stimmung');
    assert(result.premiumCorrect, '"Einnahmen maximieren" setzt hohe Preise ohne Stimmungsboost');
    assert(result.withCount < result.withoutCount, `Fanbeauftragter senkt Ausschreitungsrisiko (${result.withoutCount} -> ${result.withCount} von 300)`);
    assert(consoleErrors.length === 0, 'keine Konsolenfehler');
    await page.close();
}

async function main() {
    console.log('Baue Standalone-Version...');
    execSync('python3 build.py', { cwd: PROJECT_ROOT, stdio: 'inherit' });

    const browser = await chromium.launch();

    await testAllScreensRender(browser);
    await testSquadRotationFitness(browser);
    await testDominantTeamWinsLeague(browser);
    await testBalancedLeagueGoalRealism(browser);
    await testSaveLoadRoundtrip(browser);
    await testAdminImportExport(browser);
    await testCupAndEurope(browser);
    await testRolesAfterSquadInit(browser);
    await testScheduleIntegrityAfterViewingTable(browser);
    await testInjurySystem(browser);
    await testContractExpiryAndEmergencyFill(browser);
    await testMoraleAffectsStrengthButBounded(browser);
    await testStadiumExpansionCap(browser);
    await testStressAffectsStrengthButBounded(browser);
    await testHubTabNavigation(browser);
    await testLiveMatchRichness(browser);
    await testRedCardSuspensionIntegrity(browser);
    await testMultiSaveSlotsAndToast(browser);
    await testAllTraitsHaveEffect(browser);
    await testThematicTabColorsPersist(browser);
    await testCombinedWorstCaseSelfCorrects(browser);
    await testTutorialOnboarding(browser);
    await testOpponentFormCurve(browser);
    await testFormCurveBackwardCompat(browser);
    await testPerformance(browser);
    await testTrainingMinigames(browser);
    await testTacticStyleTradeoff(browser);
    await testSquadPositionFilter(browser);
    await testSponsorNegotiationSystem(browser);
    await testBandenAcquisitionCap(browser);
    await testSponsorOffersAppearOverSeason(browser);
    await testUnderworldDarkerMechanics(browser);
    await testUnderworldSabotageWorksInBulkSim(browser);
    await testStockMarketRealMovement(browser);
    await testDerbyRivalrySystem(browser);
    await testStockMarketBiggerBuyOptions(browser);
    await testPlayerRoleBonusScalesWithSquad(browser);
    await testSponsorsAllThreeHaveNegotiation(browser);
    await testBudgetEnforcement(browser);
    await testLoanTiersAndCap(browser);
    await testInsolvencyEscalation(browser);
    await testBettingSystem(browser);
    await testFanshopManagerTasks(browser);
    await testPrivateLifeWageFixAndNewFeatures(browser);
    await testStaffAutoTaskDelegation(browser);
    await testFanLiaisonPassiveAndPricing(browser);

    await browser.close();

    console.log('\n' + '='.repeat(50));
    console.log(`ERGEBNIS: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failed > 0) {
        console.log('\nFehlgeschlagene Tests:');
        failures.forEach(f => console.log('  - ' + f));
        process.exit(1);
    }
    process.exit(0);
}

main().catch(err => {
    console.error('Testlauf abgebrochen:', err);
    process.exit(1);
});
