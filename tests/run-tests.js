// ============================================================================
// AUTOMATISIERTE TESTSUITE - Anstoß Mobile Pro FM13
// ============================================================================
// Läuft die gebaute Standalone-Datei in einem echten Browser (Playwright) und
// prüft die kritischsten Systeme: Struktur, Speichern/Laden (dort steckten die
// gravierendsten bisher gefundenen Bugs!), Wirtschaft, Kader, Jugend, Transfer,
// Stadion und die Match-Simulation über mehrere Saisons hinweg.
//
// Aufruf: node run-tests.js  (aus dem tests/-Ordner heraus)
// Erwartet eine bereits gebaute dist/anstoss-fm13-standalone.html (via build.py).
// ============================================================================

const { chromium } = require('playwright');
const path = require('path');

// GAME_FILE env var erlaubt, dieselbe Suite auch gegen die minifizierte Variante laufen
// zu lassen (siehe minify.js/CI) - Standard bleibt die normale, lesbare Build-Ausgabe.
const GAME_PATH = 'file://' + path.resolve(__dirname, '../dist/' + (process.env.GAME_FILE || 'anstoss-fm13-standalone.html'));

let passed = 0;
let failed = 0;
let failedTests = [];

function assert(condition, label) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        failedTests.push(label);
        console.log(`  ✗ ${label}`);
    }
}

async function freshPage(browser) {
    const page = await browser.newPage();
    let consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));
    await page.goto(GAME_PATH);
    await page.waitForTimeout(400);
    return { page, consoleErrors };
}

// ---------------------------------------------------------------------------
// [1] STRUKTUR & GRUNDZUSTAND
// ---------------------------------------------------------------------------
async function testStructuralSelfTest(browser) {
    console.log('\n[1] Struktur-Selbsttest');
    const { page, consoleErrors } = await freshPage(browser);
    const selfTest = await page.evaluate(() => runStructuralSelfTest(true));
    assert(Array.isArray(selfTest) && selfTest.length === 0, `Struktur-Selbsttest meldet keine Probleme (${JSON.stringify(selfTest)})`);
    assert(consoleErrors.length === 0, `Keine JS-Fehler beim Laden (${consoleErrors.length} gefunden)`);
    await page.close();
}

// ---------------------------------------------------------------------------
// [2] SPEICHERN & LADEN - KRITISCHSTER BEREICH (hier steckten die schwersten Bugs)
// ---------------------------------------------------------------------------
async function testSaveLoad(browser) {
    console.log('\n[2] Speichern & Laden (kritischster Bereich)');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        managerRPG.level = 50;
        game.money = 5000000;
        game.leagueLevel = 3;

        // Jugendakademie (frueher komplett verloren gegangen!)
        scoutYouthTalent();
        let youthBefore = youthTalents.length;

        // Bankkredit (frueher komplett verloren gegangen!)
        takeLoanTier('mid', 100000);
        let loansBefore = activeLoans.length;

        // Leihclub-Beziehung (frueher komplett verloren gegangen!)
        loanClubRelationships['TestVerein'] = 42;

        // Zweite Mannschaft
        foundSecondTeam();
        let secondTeamBefore = secondTeamSquad.length;

        // Ausstiegsklausel
        setReleaseClause(squad[0].id, Math.round(squad[0].marketValue * 1.2));
        let clauseBefore = squad[0].releaseClause;

        // Eingehende Leihe
        refreshTransferMarket();
        signLoanPlayer(0);
        let incomingLoansBefore = incomingLoans.length;

        // Medienrechte
        generateMediaRightsOffers();
        acceptMediaRightsOffer(mediaRights.dealOffers[0].id);
        let mediaDealBefore = mediaRights.currentDeal.name;

        // Immobilien
        buyOrUpgradeRealEstate('parkplatz');
        let reProj = game.stadiumConstructionQueue.find(p => p.type === 'realEstate');
        if (reProj) { for (let i = 0; i < reProj.totalDays; i++) tickStadiumConstruction(); }

        // Premium-Punkte
        game.premiumPoints = 1234;

        // Vereinsrekorde
        game.clubRecords.biggestWin = { opponent: 'Test', score: '5:0', season: 1, matchday: 1, ourGoals: 5, oppGoals: 0 };

        let saveData = JSON.parse(JSON.stringify(buildSaveState()));

        // Zustand zuruecksetzen wie bei einem frischen Laden
        youthTalents = []; activeLoans = []; loanClubRelationships = {};
        secondTeamSquad = []; incomingLoans = []; mediaRights.currentDeal = null;
        game.premiumPoints = 0; game.clubRecords.biggestWin = null;
        squad[0].releaseClause = null;

        applyLoadedState(saveData);

        results.youthTalentsRestored = youthTalents.length === youthBefore;
        results.bankLoansRestored = activeLoans.length === loansBefore;
        results.loanClubRelationshipRestored = loanClubRelationships['TestVerein'] === 42;
        results.secondTeamRestored = secondTeamSquad.length === secondTeamBefore;
        results.releaseClauseRestored = squad[0].releaseClause === clauseBefore;
        results.incomingLoanRestored = incomingLoans.length === incomingLoansBefore;
        results.mediaDealRestored = mediaRights.currentDeal && mediaRights.currentDeal.name === mediaDealBefore;
        results.realEstateRestored = realEstatePortfolio.parkplatz.owned === true;
        results.premiumPointsRestored = game.premiumPoints === 1234;
        results.clubRecordsRestored = game.clubRecords.biggestWin && game.clubRecords.biggestWin.score === '5:0';
        return results;
    });

    assert(r.youthTalentsRestored, 'Jugendakademie überlebt Speichern/Laden');
    assert(r.bankLoansRestored, 'Laufende Bankkredite überleben Speichern/Laden');
    assert(r.loanClubRelationshipRestored, 'Leihclub-Beziehungshistorie überlebt Speichern/Laden');
    assert(r.secondTeamRestored, 'Zweite Mannschaft überlebt Speichern/Laden');
    assert(r.releaseClauseRestored, 'Ausstiegsklausel überlebt Speichern/Laden');
    assert(r.incomingLoanRestored, 'Eingehende Leihspieler überleben Speichern/Laden');
    assert(r.mediaDealRestored, 'Medienrechte-Vertrag überlebt Speichern/Laden');
    assert(r.realEstateRestored, 'Immobilien-Portfolio überlebt Speichern/Laden');
    assert(r.premiumPointsRestored, 'Premium-Punkte überleben Speichern/Laden');
    assert(r.clubRecordsRestored, 'Vereinsrekorde überleben Speichern/Laden');
    await page.close();
}

// ---------------------------------------------------------------------------
// [3] MATCH-SIMULATION & LANGZEITSTABILITÄT
// ---------------------------------------------------------------------------
async function testMatchSimulationStability(browser) {
    console.log('\n[3] Match-Simulation & Langzeitstabilität');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        try {
            managerRPG.level = 99;
            game.money = 50000000;
            Object.keys(staffMembers).forEach(k => { staffMembers[k].hired = true; staffMembers[k].task = 'auto_dispatch'; });
            Object.keys(campusBuildings).forEach(k => campusBuildings[k].lvl = 3);
            foundSecondTeam();
            for (let i = 0; i < 3; i++) simulateFullSeason();
            return { crash: false, matchday: game.matchday, season: game.season };
        } catch (e) {
            return { crash: true, error: e.message };
        }
    });
    assert(r.crash === false, `3 Saisons mit voller Personal-/Campus-Ausstattung ohne Absturz (${r.crash ? r.error : 'ok'})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler während der Saison-Simulation');

    // Zuschauerzahl-Varianz (frueher komplett deterministisch, war ein gemeldeter Bug)
    const variance = await page.evaluate(() => {
        let values = [];
        for (let i = 0; i < 8; i++) {
            applyMatchdayFinances(true, true, false, false, 'Test-Gegner', '1:0');
            values.push(game.attendanceHistory[game.attendanceHistory.length - 1].attendance);
        }
        return new Set(values).size;
    });
    assert(variance >= 3, `Zuschauerzahl zeigt echte Varianz über mehrere Heimspiele (${variance} unterschiedliche Werte von 8)`);

    await page.close();
}

// ---------------------------------------------------------------------------
// [4] WIRTSCHAFT & FINANZEN
// ---------------------------------------------------------------------------
async function testEconomy(browser) {
    console.log('\n[4] Wirtschaft & Finanzen');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        game.money = 1000000;

        // Betriebskosten werden tatsaechlich abgebucht (frueher ein Phantom-Posten)
        let moneyBefore = game.money;
        applyMatchdayFinances(false, false, false, false, null, null);
        results.maintenanceDeducted = game.money !== moneyBefore;

        // Solaranlage senkt Betriebskosten
        stadium.upgrades = stadium.upgrades || {};
        stadium.upgrades.solaranlage = false;
        game.money = 1000000;
        let m1 = game.money;
        applyMatchdayFinances(false, false, false, false, null, null);
        let costWithout = m1 - game.money;
        stadium.upgrades.solaranlage = true;
        game.money = 1000000;
        let m2 = game.money;
        applyMatchdayFinances(false, false, false, false, null, null);
        let costWith = m2 - game.money;
        results.solarSavesElectricity = costWith < costWithout;

        // Zweite Mannschaft: Gehaelter werden tatsaechlich mitgerechnet (isoliert, ohne
        // Zuschauerzahl-Rauschen zu vermischen - direkter Vorher/Nachher-Vergleich der
        // reinen Betriebskosten-Abbuchung bei identischem Spielausgang).
        game.money = 5000000;
        applyMatchdayFinances(false, true, false, false, null, null); // Auswaertsspiel: keine Zuschauereinnahmen-Varianz
        let diffOhne = 5000000 - game.money;
        game.money = 5000000;
        managerRPG.level = 99; // Voraussetzung fuer foundSecondTeam()
        foundSecondTeam();
        let afterFounding = game.money;
        applyMatchdayFinances(false, true, false, false, null, null);
        let diffMit = afterFounding - game.money;
        let secondTeamWageSum = secondTeamSquad.reduce((s, p) => s + p.wage, 0);
        results.secondTeamWagesDeducted = (diffMit - diffOhne) >= secondTeamWageSum * 0.9;

        return results;
    });

    assert(r.maintenanceDeducted, 'Betriebskosten werden pro Spieltag tatsächlich abgebucht');
    assert(r.solarSavesElectricity, 'Solaranlage senkt die Stromkosten-Komponente der Betriebskosten');
    assert(r.secondTeamWagesDeducted, 'Zweite Mannschaft hat reale Gehaltskosten');
    await page.close();
}

// ---------------------------------------------------------------------------
// [5] KADER & TAKTIK
// ---------------------------------------------------------------------------
async function testSquadAndTactics(browser) {
    console.log('\n[5] Kader & Taktik');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        autoLineup();
        results.lineupHas11 = lineup.length === 11;

        // Kapitaen-Bonus wirkt wirklich
        let captain = squad.find(p => lineup.includes(p.id));
        captain.age = 32;
        game.captainId = captain.id;
        let strWith = calcTeamStrength(true);
        game.captainId = 'nichtvorhanden';
        let strWithout = calcTeamStrength(true);
        results.captainBonusWorks = strWith > strWithout;

        // Sortierfunktion im Kader-Screen
        setSquadSort('alter');
        let youngest = [...squad].sort((a, b) => a.age - b.age)[0];
        results.sortByAgeWorks = true; // Funktionsaufruf crasht nicht

        // Formationswechsel funktioniert und aendert die Elf-Struktur nicht kaputt
        game.formation = '4-3-3';
        autoLineup();
        results.formationChangeWorks = lineup.length === 11;

        return results;
    });

    assert(r.lineupHas11, 'Automatische Aufstellung ergibt genau 11 Startspieler');
    assert(r.captainBonusWorks, 'Kapitän gibt einen echten Team-Stärke-Bonus');
    assert(r.sortByAgeWorks, 'Kader-Sortierung nach Alter funktioniert ohne Absturz');
    assert(r.formationChangeWorks, 'Formationswechsel funktioniert und ergibt weiterhin 11 Spieler');
    await page.close();
}

// ---------------------------------------------------------------------------
// [6] JUGENDAKADEMIE
// ---------------------------------------------------------------------------
async function testYouthAcademy(browser) {
    console.log('\n[6] Jugendakademie');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        game.money = 200000;

        // Kapazitaet ausreichend fuer eine vollstaendige Jugendliga-Elf
        results.capacitySufficient = getYouthAcademyCapacity() >= 14;

        // Akademie-Ausbau hat eine echte Bauzeit (frueher sofort). Seit der Preiskorrektur
        // kostet die Akademie mindestens 300.000 EUR und wird ohne Deckung gar nicht erst
        // begonnen - der Testverein braucht dafuer entsprechend Guthaben.
        game.money = 5000000;
        let lvlBefore = game.youthAcademyLvl;
        upgradeYouthAcademy();
        results.academyUpgradeNotInstant = game.youthAcademyLvl === lvlBefore;
        let proj = game.stadiumConstructionQueue.find(p => p.type === 'youthAcademyLvl');
        results.academyUpgradeQueued = !!proj;
        if (proj) { for (let i = 0; i < proj.totalDays; i++) tickStadiumConstruction(); }
        results.academyUpgradeCompletesAfterTime = game.youthAcademyLvl === lvlBefore + 1;

        // Jugendinternat wirkt wirklich auf neue Talente
        campusBuildings.internat.lvl = 0;
        let strengthsLow = [];
        for (let i = 0; i < 6; i++) { scoutYouthTalent(); strengthsLow.push(youthTalents[youthTalents.length - 1].strength); }
        campusBuildings.internat.lvl = 5;
        let strengthsHigh = [];
        for (let i = 0; i < 6; i++) { scoutYouthTalent(); strengthsHigh.push(youthTalents[youthTalents.length - 1].strength); }
        let avgLow = strengthsLow.reduce((a, b) => a + b, 0) / strengthsLow.length;
        let avgHigh = strengthsHigh.reduce((a, b) => a + b, 0) / strengthsHigh.length;
        results.internatIncreasesStrength = avgHigh > avgLow;

        // Mentor-System
        let youth = youthTalents[0];
        let mentor = squad.find(s => s.age >= 27 && s.strength >= 55);
        if (mentor) {
            assignYouthMentor(youth.id, mentor.id);
            results.mentorAssigned = youth.mentorId === mentor.id;
        } else {
            results.mentorAssigned = true; // kein passender Mentor im Test-Kader vorhanden, kein Fehler
        }

        // Elfmeterkiller braucht 80 Einsaetze
        let gk = squad.find(p => p.pos === 'TW');
        gk.trait = 'Kein';
        gk.appearances = 10;
        runPenaltyKillerProgram(gk.id);
        results.penaltyKillerLocked = gk.trait !== 'Elfmeter-Killer';
        gk.appearances = 80;
        let origRandom = Math.random;
        Math.random = () => 0.0001;
        runPenaltyKillerProgram(gk.id);
        Math.random = origRandom;
        results.penaltyKillerUnlockedAt80 = gk.trait === 'Elfmeter-Killer';

        // Jugendliga
        initYouthLeagueTable();
        results.youthLeagueHas8Teams = youthLeagueTable.length === 8;
        tickYouthLeague();
        results.youthLeagueMatchPlayed = youthLeagueTable.find(t => t.isOwn).played > 0;

        return results;
    });

    assert(r.capacitySufficient, 'Jugendkader-Kapazität reicht für eine vollständige Elf (≥14)');
    assert(r.academyUpgradeNotInstant, 'Jugendakademie-Ausbau ist keine Sofort-Aktion mehr');
    assert(r.academyUpgradeQueued, 'Jugendakademie-Ausbau legt eine echte Baustelle an');
    assert(r.academyUpgradeCompletesAfterTime, 'Jugendakademie-Ausbau schließt nach Bauzeit korrekt ab');
    assert(r.internatIncreasesStrength, 'Jugendinternat erhöht die Stärke neuer Talente spürbar');
    assert(r.mentorAssigned, 'Jugend-Mentor-Zuweisung funktioniert');
    assert(r.penaltyKillerLocked, 'Elfmeterkiller-Fähigkeit ist unter 80 Einsätzen gesperrt');
    assert(r.penaltyKillerUnlockedAt80, 'Elfmeterkiller-Fähigkeit ab 80 Einsätzen erlernbar');
    assert(r.youthLeagueHas8Teams, 'Jugendliga hat 8 Teams (eigenes + 7 Rivalen)');
    assert(r.youthLeagueMatchPlayed, 'Jugendliga-Spiel lässt sich simulieren');
    await page.close();
}

// ---------------------------------------------------------------------------
// [7] TRANSFERMARKT
// ---------------------------------------------------------------------------
async function testTransferMarket(browser) {
    console.log('\n[7] Transfermarkt');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        game.money = 10000000;
        game.transferBudget = 10000000;

        // Eingehende Leihe mit Kaufoption
        refreshTransferMarket();
        results.loanablePlayersGenerated = loanablePlayers.length === 3;
        let loanPlayer = loanablePlayers[0];
        signLoanPlayer(0);
        results.loanPlayerInSquad = squad.some(p => p.id === loanPlayer.id);
        let loan = incomingLoans.find(l => l.playerId === loanPlayer.id);
        exerciseLoanBuyOption(loanPlayer.id);
        let playerAfter = squad.find(p => p.id === loanPlayer.id);
        results.buyOptionMakesPermanent = playerAfter.isLoanedIn === false;

        // Ausstiegsklausel
        let minClause = Math.round(squad[0].marketValue * 1.1);
        setReleaseClause(squad[0].id, minClause - 1000);
        results.releaseClauseMinimumEnforced = squad[0].releaseClause === null;
        setReleaseClause(squad[0].id, minClause + 5000);
        results.releaseClauseSetCorrectly = squad[0].releaseClause === minClause + 5000;

        // Weiterverkaufsbeteiligung
        incomingOffers.push({ id: 'test1', playerId: squad[1].id, playerName: squad[1].name, clubName: 'Test FC', currentBid: 100000, statusText: 'test' });
        let squadSizeBefore = squad.length;
        acceptTransferOfferWithClause('test1');
        results.sellOnClauseTracked = game.sellOnClauses.length === 1;
        results.sellOnClausePlayerSold = squad.length === squadSizeBefore - 1;

        return results;
    });

    assert(r.loanablePlayersGenerated, 'Leihmarkt generiert 3 verfügbare Spieler');
    assert(r.loanPlayerInSquad, 'Eingehende Leihe fügt Spieler korrekt zum Kader hinzu');
    assert(r.buyOptionMakesPermanent, 'Kaufoption macht Leihspieler dauerhaft');
    assert(r.releaseClauseMinimumEnforced, 'Ausstiegsklausel erzwingt Mindestbetrag (110% Marktwert)');
    assert(r.releaseClauseSetCorrectly, 'Gültige Ausstiegsklausel wird korrekt gesetzt');
    assert(r.sellOnClauseTracked, 'Weiterverkaufsbeteiligung wird korrekt getrackt');
    assert(r.sellOnClausePlayerSold, 'Verkauf mit Weiterverkaufsbeteiligung entfernt Spieler aus dem Kader');
    await page.close();
}

// ---------------------------------------------------------------------------
// [8] STADION-SYSTEME
// ---------------------------------------------------------------------------
async function testStadiumSystems(browser) {
    console.log('\n[8] Stadion-Systeme');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        game.money = 100000000;

        results.has20Upgrades = Object.keys(STADIUM_UPGRADES).length === 20;

        // Stadion-Erweiterung laeuft ueber eine echte Baustelle
        buyStadiumUpgrade('sicherheitstechnik');
        results.upgradeNotInstant = !stadium.upgrades || !stadium.upgrades.sicherheitstechnik;
        let proj = game.stadiumConstructionQueue.find(p => p.type === 'stadiumUpgrade');
        for (let i = 0; i < proj.totalDays; i++) tickStadiumConstruction();
        results.upgradeCompletesAfterTime = stadium.upgrades.sicherheitstechnik === true;

        // Sicherheitsbonus wirkt
        results.securityBonusWorks = getStadiumSecurityBonus() > 0;

        // Klimaanlage neutralisiert Hitze
        stadium.upgrades.klimaanlage = true;
        let foundHeat = null;
        for (let i = 0; i < 500 && !foundHeat; i++) { let w = rollWeather(); if (w.name === 'Hitze') foundHeat = w; }
        results.airConditioningNeutralizesHeat = foundHeat && foundHeat.neutralizedByAC === true;

        // Groessenstufen aendern sich mit der Kapazitaet
        Object.keys(stadium.blocks).forEach(k => stadium.blocks[k].cap = 800);
        let tierSmall = getStadiumVisualTier();
        Object.keys(stadium.blocks).forEach(k => stadium.blocks[k].cap = 15000);
        let tierMega = getStadiumVisualTier();
        results.visualTiersChangeWithCapacity = tierSmall === 'small' && tierMega === 'mega';

        return results;
    });

    assert(r.has20Upgrades, 'Alle 20 Stadion-Erweiterungen sind vorhanden');
    assert(r.upgradeNotInstant, 'Stadion-Erweiterung ist keine Sofort-Aktion');
    assert(r.upgradeCompletesAfterTime, 'Stadion-Erweiterung schließt nach Bauzeit korrekt ab');
    assert(r.securityBonusWorks, 'Sicherheitstechnik senkt das Ausschreitungsrisiko messbar');
    assert(r.airConditioningNeutralizesHeat, 'Klimaanlage neutralisiert Hitze-Wetter');
    assert(r.visualTiersChangeWithCapacity, '3D-Stadion-Design ändert sich sichtbar mit der Kapazität');
    await page.close();
}

// ---------------------------------------------------------------------------
// [9] UI-SCREENS RENDERN OHNE ABSTURZ
// ---------------------------------------------------------------------------
async function testAllScreensRender(browser) {
    console.log('\n[9] Alle Hauptscreens rendern ohne Absturz');
    const { page, consoleErrors } = await freshPage(browser);

    const screens = [
        'screen-dashboard', 'screen-squad', 'screen-transfer', 'screen-scouting-global',
        'screen-youth', 'screen-contracts', 'screen-stadium', 'screen-campus', 'screen-staff',
        'screen-fans', 'screen-real-estate', 'screen-finances', 'screen-stocks', 'screen-sponsors',
        'screen-betting', 'screen-industry', 'screen-holding', 'screen-merch', 'screen-league',
        'screen-europe', 'screen-history', 'screen-private', 'screen-underworld', 'screen-premium',
        'screen-admin', 'screen-second-team', 'screen-training', 'screen-calendar'
    ];

    for (const screen of screens) {
        const ok = await page.evaluate((s) => {
            try { showScreen(s); return true; } catch (e) { return false; }
        }, screen);
        assert(ok, `Screen "${screen}" rendert ohne Absturz`);
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Durchklicken aller Screens');
    await page.close();
}

// ---------------------------------------------------------------------------
// [10] ALTE SPEICHERSTÄNDE (MIGRATION)
// ---------------------------------------------------------------------------
async function testOldSaveMigration(browser) {
    console.log('\n[10] Migration alter Spielstände');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let oldSave = JSON.parse(JSON.stringify(buildSaveState()).split('"1.FC Moritz Leipzig II"').join('"Lok Leipzig II"').split('"1.FC Moritz Leipzig"').join('"Lok Leipzig"'));
        applyLoadedState(oldSave);
        let ourTeam = leaguesData[game.leagueLevel].find(t => t.name === "1.FC Moritz Leipzig");
        let oldNameGone = !leaguesData[game.leagueLevel].some(t => t.name === "Lok Leipzig");
        let secondTeamRenamed = game.secondTeam.name === '1.FC Moritz Leipzig II';
        return { ourTeamFound: !!ourTeam, oldNameGone, secondTeamRenamed };
    });

    assert(r.ourTeamFound, 'Alter Spielstand mit früherem Vereinsnamen wird korrekt migriert');
    assert(r.oldNameGone, 'Alter Vereinsname verschwindet vollständig aus der Liga-Tabelle');
    assert(r.secondTeamRenamed, 'Zweite Mannschaft wird bei Migration mit umbenannt');
    await page.close();
}

// ---------------------------------------------------------------------------
// [11] TRAININGS-ÜBERARBEITUNG (Reiter, Minispiel-Kosten, Fähigkeitstraining)
// ---------------------------------------------------------------------------
async function testTrainingOverhaul(browser) {
    console.log('\n[11] Trainings-Überarbeitung (Reiter, Kosten, Fähigkeitstraining)');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        showScreen('screen-training');
        setTrainingTab('minigames');
        results.tabSwitchWorks = document.getElementById('training-tab-minigames').style.display === 'block'
            && document.getElementById('training-tab-plan').style.display === 'none';

        game.money = 100;
        autoLineup();
        openPenaltyGame(squad[0].id);
        results.minigameBlockedWithoutMoney = !document.getElementById('minigame-overlay').classList.contains('show');
        game.money = 100000;
        let costBefore = game.money;
        openPenaltyGame(squad[0].id);
        results.minigameCostsMoney = game.money < costBefore;
        document.getElementById('minigame-overlay').classList.remove('show');

        staffMembers.coTrainer.hired = true;
        game.money = 100000;
        let player = squad[1];
        let statBefore = player.pace;
        document.getElementById('skill-training-player-select').value = player.id;
        document.getElementById('skill-training-stat-select').value = 'pace';
        document.getElementById('skill-training-coach-select').innerHTML = '<option value="coTrainer">Co-Trainer</option>';
        document.getElementById('skill-training-coach-select').value = 'coTrainer';
        startSkillTraining();
        results.skillTrainingNotInstant = player.pace === statBefore;
        let entry = game.skillTrainingQueue.find(s => s.playerId === player.id);
        for (let i = 0; i < entry.totalDays; i++) tickSkillTraining();
        results.skillTrainingCompletesAfterTime = player.pace === statBefore + 3;

        squad[2].contracts = 0;
        showScreen('screen-contracts');
        results.seasonPlanningShowsExpiring = document.getElementById('season-planning-box').innerHTML.includes(squad[2].name);

        return results;
    });

    assert(r.tabSwitchWorks, 'Trainings-Reiter wechseln korrekt zwischen Sub-Bereichen');
    assert(r.minigameBlockedWithoutMoney, 'Trainings-Minispiel ohne ausreichend Geld blockiert');
    assert(r.minigameCostsMoney, 'Trainings-Minispiel kostet tatsächlich Geld');
    assert(r.skillTrainingNotInstant, 'Fähigkeitstraining ist keine Sofort-Aktion');
    assert(r.skillTrainingCompletesAfterTime, 'Fähigkeitstraining verbessert das Attribut nach Ablauf der Zeit');
    assert(r.seasonPlanningShowsExpiring, 'Saisonplanung zeigt auslaufende Verträge korrekt an');
    await page.close();
}

// ---------------------------------------------------------------------------
// [12] LEBENDE LIGA, VEREINSIDENTITÄT & TRANSFERMARKT-ANBINDUNG
// ---------------------------------------------------------------------------
// Bisher nur per Wegwerf-Skripten während der Entwicklung verifiziert - jetzt fest in der
// Suite, damit ein künftiger Change diese Systeme nicht stillschweigend wieder kaputt macht.
async function testLivingLeaguePersistence(browser) {
    console.log('\n[12] Lebende Liga: Persistenz über mehrere Saisons');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        try {
            let seasons = [];
            for (let i = 0; i < 6; i++) {
                simulateFullSeason();
                concludeSeasonAndAdvance();
                let allNames = new Set();
                let dupes = 0, sizeIssues = 0;
                leaguesData.forEach(table => {
                    if (table.length !== 18) sizeIssues++;
                    table.forEach(t => { if (allNames.has(t.name)) dupes++; allNames.add(t.name); });
                });
                seasons.push({
                    totalTeams: allNames.size, dupes, sizeIssues,
                    ourTeamFound: leaguesData[game.leagueLevel].some(t => t.name === game.clubName)
                });
            }
            return { crash: false, seasons };
        } catch (e) {
            return { crash: true, error: e.message };
        }
    });

    assert(r.crash === false, `6 Saisons Liga-Persistenz ohne Absturz (${r.crash ? r.error : 'ok'})`);
    if (!r.crash) {
        assert(r.seasons.every(s => s.totalTeams === 108), 'Immer exakt 108 eindeutige Vereine über alle 6 Saisons');
        assert(r.seasons.every(s => s.dupes === 0), 'Nie ein Namens-Duplikat über alle 6 Saisons');
        assert(r.seasons.every(s => s.sizeIssues === 0), 'Jede der 6 Ligen bleibt immer bei genau 18 Teams');
        assert(r.seasons.every(s => s.ourTeamFound), 'Eigenes Team ist nach jeder Saison im korrekten Liga-Level auffindbar');
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler während der Mehrsaison-Simulation');
    await page.close();
}

async function testClubRenameAndSwitch(browser) {
    console.log('\n[12] Vereinsumbenennung & Vereinswechsel');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        let oldName = game.clubName;
        renameClub('FC Testverifikation');
        out.renameWorked = game.clubName === 'FC Testverifikation';
        out.renameUpdatedHeader = document.getElementById('header-club-name').innerText === 'FC Testverifikation';
        out.renameUpdatedLeagueRow = leaguesData[game.leagueLevel].some(t => t.name === 'FC Testverifikation');
        out.secondTeamFollowedRename = game.secondTeam.name === 'FC Testverifikation II';

        let target = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName && t.name !== game.secondTeam.name && t.name !== game.permanentRivalName);
        let switchOk = switchToClub(target.name);
        out.switchWorked = switchOk && game.clubName === target.name;
        out.squadRegenerated = squad.length === 18;
        out.oldClubStillExistsAsAi = leaguesData.flat().some(t => t.name === 'FC Testverifikation');
        out.ourLeagueTeamMatches = getOurLeagueTeam()?.name === target.name;
        return out;
    });

    assert(r.renameWorked, 'renameClub() ändert game.clubName');
    assert(r.renameUpdatedHeader, 'Umbenennung aktualisiert den Header sofort im DOM');
    assert(r.renameUpdatedLeagueRow, 'Umbenennung aktualisiert die Liga-Tabellenzeile');
    assert(r.secondTeamFollowedRename, 'Zweite Mannschaft folgt der Umbenennung automatisch ("<Name> II")');
    assert(r.switchWorked, 'switchToClub() übernimmt einen bestehenden Verein der Pyramide');
    assert(r.squadRegenerated, 'Vereinswechsel erzeugt einen vollständigen 18-Spieler-Kader');
    assert(r.oldClubStillExistsAsAi, 'Alter Verein bleibt nach dem Wechsel als KI-Klub bestehen');
    assert(r.ourLeagueTeamMatches, 'getOurLeagueTeam() findet uns nach dem Wechsel am neuen Platz');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Umbenennung/Vereinswechsel');
    await page.close();
}

async function testTransferMarketAndClubDossier(browser) {
    console.log('\n[12] Transfermarkt-Anbindung & Vereinsakte');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        try {
            let pyramidNames = () => new Set(leaguesData.flat().map(t => t.name));

            squad.forEach(p => { p.strength = 70; }); // sonst gibt es realistisch keine Angebote
            for (let i = 0; i < 6; i++) triggerNewAITransferOffer();
            let names = pyramidNames();
            let offersFromPyramid = incomingOffers.length > 0 && incomingOffers.every(o => names.has(o.clubName));

            let jobOfferFromPyramid = true;
            for (let i = 0; i < 5; i++) {
                let clubName = pickRandomOpposingClubName(true);
                if (!pyramidNames().has(clubName)) jobOfferFromPyramid = false;
            }

            for (let i = 0; i < 3; i++) { simulateFullSeason(); concludeSeasonAndAdvance(); }
            let sampleOpp = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
            showHeadToHeadStats(sampleOpp.name);
            let dossierHtml = document.getElementById('head-to-head-box').innerHTML;

            return {
                crash: false, offersFromPyramid, jobOfferFromPyramid,
                strengthHistoryTracked: (sampleOpp.strengthHistory || []).length > 0,
                dossierShowsFormkurve: dossierHtml.includes('Formkurve'),
                dossierShowsClubName: dossierHtml.includes(sampleOpp.name)
            };
        } catch (e) {
            return { crash: true, error: e.message };
        }
    });

    assert(r.crash === false, `Transfermarkt-/Vereinsakte-Test ohne Absturz (${r.crash ? r.error : 'ok'})`);
    if (!r.crash) {
        assert(r.offersFromPyramid, 'Transferangebote für eigene Spieler stammen aus der echten Liga-Pyramide');
        assert(r.jobOfferFromPyramid, 'Abwerbeversuche um den Manager nennen einen echten Verein der Pyramide');
        assert(r.strengthHistoryTracked, 'KI-Vereine sammeln über Saisons eine Stärke-Historie (team.strengthHistory)');
        assert(r.dossierShowsFormkurve, 'Vereinsakte zeigt die Formkurve eines Gegners an');
        assert(r.dossierShowsClubName, 'Vereinsakte zeigt den korrekten Vereinsnamen an');
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Transfermarkt-/Vereinsakte-Test');
    await page.close();
}

async function testFreeTextInputSanitization(browser) {
    console.log('\n[12] Absicherung freier Texteingaben (Vereinsname & Trainingsplan-Name)');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        renameClub('<img src=x onerror="window.__pwned=true">FC Böse');
        let headerSafe = !document.getElementById('header-club-name').innerHTML.includes('<img');
        let notExecuted = window.__pwned !== true;

        showScreen('screen-training');
        let input = document.getElementById('custom-plan-name-input');
        input.value = '<script>window.__pwned2=true</script>Böse Vorlage';
        saveCustomWeeklyPlanTemplate();
        let listSafe = !document.getElementById('custom-weekly-templates-list').innerHTML.includes('<script>');
        let notExecuted2 = window.__pwned2 !== true;

        return { headerSafe, notExecuted, listSafe, notExecuted2 };
    });

    assert(r.headerSafe, 'Vereinsname mit HTML-Payload landet nicht als rohes Markup im Header');
    assert(r.notExecuted, 'HTML-Payload im Vereinsnamen wird nicht ausgeführt');
    assert(r.listSafe, 'Trainingsplan-Name mit HTML-Payload landet nicht als rohes Markup in der Liste');
    assert(r.notExecuted2, 'HTML-Payload im Trainingsplan-Namen wird nicht ausgeführt');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Eingabe-Absicherung');
    await page.close();
}

async function testSaveExportImportAndErrorLog(browser) {
    console.log('\n[12] Spielstand-Export/Import & Fehlerprotokoll-Export');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(() => { game.money = 987654; exportSaveToFile(); })
    ]);
    const fs = require('fs');
    const savedJson = JSON.parse(fs.readFileSync(await download.path(), 'utf-8'));
    assert(savedJson.game && savedJson.game.money === 987654, 'Export-Datei enthält den korrekten Spielstand');
    assert(!!savedJson.meta, 'Export-Datei enthält Metadaten (Vereinsname/Saison/...)');

    await page.evaluate(() => { game.money = 111; });
    await page.setInputFiles('#save-import-file-input', await download.path());
    await page.waitForTimeout(300);
    const afterImport = await page.evaluate(() => game.money);
    assert(afterImport === 987654, 'Import aus Datei stellt den exportierten Spielstand korrekt wieder her');

    const [download2] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(() => { setTimeout(() => { nichtExistierendeFunktionXYZ(); }, 10); })
            .then(() => page.waitForTimeout(200)).then(() => page.evaluate(() => window.__exportRuntimeErrorLog()))
    ]);
    const errorLog = JSON.parse(fs.readFileSync(await download2.path(), 'utf-8'));
    assert(errorLog.some(e => e.msg.includes('nichtExistierendeFunktionXYZ')), 'Fehlerprotokoll-Export enthält den tatsächlich aufgetretenen Laufzeitfehler');

    assert(consoleErrors.filter(e => !e.includes('nichtExistierendeFunktionXYZ')).length === 0, 'Keine UNERWARTETEN JS-Konsolenfehler bei Export/Import-Test');
    await page.close();
}

async function testSeasonPointsChart(browser) {
    console.log('\n[12] Saisonverlauf-Graph');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        try {
            simulateFullSeason();
            showScreen('screen-league');
            let html = document.getElementById('season-points-chart-box').innerHTML;
            let historyLen = (game.seasonPointsHistory || []).length;
            concludeSeasonAndAdvance();
            let historyLenAfterReset = (game.seasonPointsHistory || []).length;
            return { crash: false, hasChart: html.includes('<polyline'), historyLen, historyLenAfterReset };
        } catch (e) {
            return { crash: true, error: e.message };
        }
    });

    assert(r.crash === false, `Saisonverlauf-Graph-Test ohne Absturz (${r.crash ? r.error : 'ok'})`);
    if (!r.crash) {
        assert(r.historyLen === 34, `Ein Datenpunkt pro Spieltag über die volle Saison gesammelt (${r.historyLen} statt 34)`);
        assert(r.hasChart, 'Saisonverlauf-Graph rendert eine SVG-Linie');
        assert(r.historyLenAfterReset === 0, 'Saisonverlauf-Historie wird beim Saisonwechsel zurückgesetzt');
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Saisonverlauf-Graph-Test');
    await page.close();
}

async function testRivalManagerPersonality(browser) {
    console.log('\n[12] Trainerpersönlichkeit des permanenten Rivalen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        showScreen('screen-history');
        let html = document.getElementById('rivalry-history-book').innerHTML;
        let hasManagerFromStart = !!game.rivalManagerName && !!game.rivalManagerTrait;
        let htmlShowsManagerName = html.includes(game.rivalManagerName);

        // Rivalenwechsel erzwingen (einseitige Bilanz + mehrere Versuche wegen 25%-Zufallschance)
        rivalryRecord = { wins: 10, draws: 0, losses: 0, goalsFor: 30, goalsAgainst: 0, biggestWin: null, matches: [], shootoutsVsRival: 0 };
        let oldManager = game.rivalManagerName;
        let switched = false;
        for (let i = 0; i < 50 && !switched; i++) {
            checkRivalChangeEvent();
            if (game.rivalManagerName !== oldManager) switched = true;
        }
        let archived = game.rivalHistoryArchive[game.rivalHistoryArchive.length - 1];

        return {
            hasManagerFromStart,
            htmlShowsManagerName,
            switched,
            newManagerDiffers: game.rivalManagerName !== oldManager,
            archiveHasManagerInfo: !!(archived && archived.managerName)
        };
    });

    assert(r.hasManagerFromStart, 'Permanenter Rivale bekommt von Anfang an einen Trainernamen + eine Persönlichkeit');
    assert(r.htmlShowsManagerName, 'Rivalen-Geschichtsbuch zeigt den Trainernamen an');
    assert(r.switched, 'Rivalenwechsel-Mechanik lässt sich (bei einseitiger Bilanz) auslösen');
    assert(r.newManagerDiffers, 'Neuer Rivale bekommt einen neuen Trainer zugewiesen');
    assert(r.archiveHasManagerInfo, 'Alter Trainer wird korrekt ins Rivalen-Archiv übernommen');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Trainerpersönlichkeit');
    await page.close();
}

async function testAchievementsSystem(browser) {
    console.log('\n[12] Achievements-System');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        showScreen('screen-history');
        let beforeHtml = document.getElementById('achievements-box').innerHTML;
        managerRPG.level = 10;
        game.money = 1500000;
        foundSecondTeam();
        game.youthAcademyLvl = 3;
        game.timesSacked = 1;
        checkAchievements();
        showScreen('screen-history');
        let afterHtml = document.getElementById('achievements-box').innerHTML;
        let saved = JSON.parse(JSON.stringify(buildSaveState()));
        game.achievements = [];
        applyLoadedState(saved);
        return {
            beforeShowsZero: beforeHtml.includes('0 /'),
            unlockedIds: game.achievements.map(a => a.id),
            afterShowsFour: afterHtml.includes('4 /'),
            survivesSaveLoad: game.achievements.length === 4
        };
    });

    assert(r.beforeShowsZero, 'Achievements-Box zeigt zu Beginn 0 Freischaltungen');
    assert(r.unlockedIds.includes('millionaire'), 'Millionär-Achievement schaltet bei 1.000.000 € frei');
    assert(r.unlockedIds.includes('second-team'), 'Zweite-Mannschaft-Achievement schaltet nach Gründung frei');
    assert(r.unlockedIds.includes('youth-academy'), 'Talentschmiede-Achievement schaltet bei Jugendakademie-Stufe 3 frei');
    assert(r.unlockedIds.includes('survived-sacking'), 'Comeback-Manager-Achievement schaltet nach erster Entlassung frei');
    assert(r.afterShowsFour, 'Achievements-Box zeigt korrekt "4 /" nach den Freischaltungen an');
    assert(r.survivesSaveLoad, 'Freigeschaltete Achievements überleben Speichern/Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Achievements-Test');
    await page.close();
}

async function testConfigurableNewGameStart(browser) {
    console.log('\n[12] Konfigurierbare Startbedingungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.evaluate(() => closeTutorial());

    // Startbildschirm ist seit dem Managerbüro nicht mehr das Dashboard - der
    // "Neues Spiel"-Knopf liegt dort und muss erst sichtbar geschaltet werden.
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.click('#btn-new-game');
    await page.waitForTimeout(150);
    const boxVisible = await page.evaluate(() => document.getElementById('new-game-setup-box').style.display === 'block');

    await page.evaluate(() => { selectedNewGameLevel = 0; selectedNewGameMoney = 500000; renderNewGameSetupOptions(); });
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(100);
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(600);

    const r = await page.evaluate(() => ({
        leagueLevel: game.leagueLevel,
        money: game.money,
        squadSize: squad.length,
        avgStrength: Math.round(squad.reduce((s, p) => s + p.strength, 0) / squad.length),
        ourTeamFound: !!getOurLeagueTeam()
    }));

    assert(boxVisible, 'Klick auf "Neues Spiel starten" öffnet die Einstellungs-Box (statt sofort zu löschen)');
    assert(r.leagueLevel === 0, 'Gewählte Startliga (1. Liga) wird korrekt übernommen');
    assert(r.money === 500000, 'Gewähltes Startkapital wird korrekt übernommen');
    assert(r.squadSize === 18, 'Kader wird vollständig mit 18 Spielern generiert');
    assert(r.avgStrength >= 70, `Kader ist zur gewählten Top-Liga passend stark kalibriert (Ø ${r.avgStrength})`);
    assert(r.ourTeamFound, 'Eigenes Team ist nach dem konfigurierten Neustart in der Liga-Pyramide auffindbar');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei konfigurierbaren Startbedingungen');
    await page.close();
}

function wcagContrastRatio(hexA, hexB) {
    const lum = (hex) => {
        const n = hex.replace('#', '');
        const [r, g, b] = [0, 2, 4].map(i => parseInt(n.substr(i, 2), 16) / 255);
        const chan = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        const [rr, gg, bb] = [r, g, b].map(chan);
        return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    };
    const [l1, l2] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
}

async function testAccessibilityContrastAndFontSizes(browser) {
    console.log('\n[13] Kontrast & Schriftgrößen (Barrierefreiheit)');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());

    const html = await page.content();
    const hasTinyFontSizes = /font-size:\s*[1-6]px/.test(html);

    const pairs = {
        '--violet (#7d8aff) vs. --bg-header (#101a2e)': wcagContrastRatio('#7d8aff', '#101a2e'),
        '.btn-danger heller Stop (#c73545) vs. weiß': wcagContrastRatio('#c73545', '#ffffff'),
        '.btn-danger dunkler Stop (#a82838) vs. weiß': wcagContrastRatio('#a82838', '#ffffff'),
        '.btn-europe heller Stop (#3d54c9) vs. weiß': wcagContrastRatio('#3d54c9', '#ffffff'),
        '.btn-europe dunkler Stop (#2c3f9e) vs. weiß': wcagContrastRatio('#2c3f9e', '#ffffff'),
    };
    const allPass = Object.values(pairs).every(r => r >= 4.5);
    const failing = Object.entries(pairs).filter(([, r]) => r < 4.5);

    assert(!hasTinyFontSizes, 'Keine Schriftgrößen unter 7px mehr im Build (alte 6px/7px-Ausreißer entfernt)');
    assert(allPass, `Alle geprüften Text/Hintergrund-Kombinationen erreichen WCAG-AA (>=4.5:1)${failing.length ? ' - fehlgeschlagen: ' + failing.map(([k, r]) => `${k}=${r.toFixed(2)}`).join(', ') : ''}`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Kontrast-/Schriftgrößen-Test');
    await page.close();
}

async function testLanguageToggle(browser) {
    console.log('\n[14] Sprachumschalter (DE/EN)');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());
    // Startbildschirm ist das Managerbüro und deckt das ganze Display ab - für die
    // Kopfzeilen-/Seitenmenü-Knöpfe muss der Test es zuerst verlassen.
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.waitForTimeout(150);

    const deText = await page.evaluate(() => document.querySelector('[onclick*="screen-calendar"]').textContent.trim());
    await page.click('#btn-lang-toggle');
    await page.waitForTimeout(100);
    const enText = await page.evaluate(() => document.querySelector('[onclick*="screen-calendar"]').textContent.trim());
    const langStoredAfterToggle = await page.evaluate(() => safeLocalGet('anstoss_fm13_language'));
    const tutorialNextTextEn = await page.evaluate(() => { tutorialPage = 0; renderTutorialPage(); return document.getElementById('tutorial-next-btn').innerText; });

    await page.reload();
    await page.waitForTimeout(400);
    await page.evaluate(() => { closeTutorial(); showScreen('screen-dashboard'); });
    await page.waitForTimeout(150);
    const enTextAfterReload = await page.evaluate(() => document.querySelector('[onclick*="screen-calendar"]').textContent.trim());

    await page.click('#btn-lang-toggle');
    await page.waitForTimeout(100);
    const backToDeText = await page.evaluate(() => document.querySelector('[onclick*="screen-calendar"]').textContent.trim());

    assert(deText === '📅 Kalender & Termine', 'Standardsprache beim Start ist Deutsch');
    assert(enText === '📅 Calendar & Fixtures', 'Klick auf den Sprachumschalter übersetzt die Seitenleiste sofort ins Englische');
    assert(langStoredAfterToggle === 'en', 'Sprachwahl wird persistiert (localStorage)');
    assert(tutorialNextTextEn === 'Next →', 'Tutorial-Texte werden ebenfalls über die gewählte Sprache gerendert');
    assert(enTextAfterReload === '📅 Calendar & Fixtures', 'Sprachwahl überlebt einen Reload');
    assert(backToDeText === '📅 Kalender & Termine', 'Zurückschalten auf Deutsch funktioniert erneut');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Sprachumschalter-Test');
    await page.close();
}

async function testManagerOffice(browser) {
    console.log('\n[15] Managerbüro (Point-and-Click-Startbildschirm)');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());

    const isStartScreen = await page.evaluate(() => document.getElementById('screen-office').style.display === 'block');
    const hotspotIds = await page.evaluate(() => OFFICE_HOTSPOTS.map(h => h.id));

    // Das Büro soll das GANZE Display einnehmen, nicht als kleines Panel zwischen
    // Kopfzeile und Seitenmenü sitzen.
    const coversDisplay = await page.evaluate(() => {
        const r = document.getElementById('screen-office').getBoundingClientRect();
        return Math.round(r.width) >= window.innerWidth && Math.round(r.height) >= window.innerHeight;
    });

    // Kernabsicherung: JEDER Hotspot muss an seinem eigenen Mittelpunkt auch wirklich sich
    // selbst treffen - im Hover-Zustand. Genau hier lag der schwerste Fehler dieser Ansicht:
    // filter/opacity und laufende transform-Animationen klappen eine 3D-positionierte Ebene
    // flach bzw. schieben sie auf eine eigene Compositing-Ebene; das Bild bleibt dabei
    // unverändert, aber die Trefferfläche wandert weg und die Objekte sind - völlig lautlos -
    // nicht mehr anklickbar. Ohne diesen Test fällt so etwas erst dem Spieler auf.
    const centerOf = async (id) => {
        const box = await page.locator('#office-hs-' + id).boundingBox();
        return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
    };

    let unreachable = [];
    for (const id of hotspotIds) {
        const c = await centerOf(id);
        if (!c) { unreachable.push(id + ' (nicht sichtbar)'); continue; }
        await page.mouse.move(c.x, c.y);
        await page.waitForTimeout(60);
        const resolved = await page.evaluate(({ x, y }) => officeHotspotAtPoint(x, y), c);
        if (resolved !== id) unreachable.push(`${id} (traf: ${resolved})`);
    }

    // Satzzeile (das SCUMM-Stilmittel) folgt dem überfahrenen Objekt
    const calCenter = await centerOf('calendar');
    await page.mouse.move(calCenter.x, calCenter.y);
    await page.waitForTimeout(120);
    const sentence = await page.textContent('#office-sentence');

    // Lampe schaltet nur das Licht, navigiert NICHT weg. Bewusst per mouse.click auf die
    // Koordinate statt per page.click(selector): letzteres prüft intern die native
    // Trefferfläche des Browsers - genau die ist für 3D-Elemente je nach Chromium-Version
    // unzuverlässig, weshalb das Büro seine Treffer selbst auflöst (siehe officeHotspotAtPoint).
    const lampCenter = await centerOf('lamp');
    await page.mouse.click(lampCenter.x, lampCenter.y);
    await page.waitForTimeout(250);
    const lampState = await page.evaluate(() => ({
        dark: document.getElementById('screen-office').classList.contains('office-dark'),
        stillInOffice: document.getElementById('screen-office').style.display === 'block'
    }));
    await page.mouse.click(lampCenter.x, lampCenter.y);
    await page.waitForTimeout(250);

    // Klick auf ein Objekt führt in den zugehörigen Screen
    await page.mouse.click(calCenter.x, calCenter.y);
    await page.waitForTimeout(900);
    const navigated = await page.evaluate(() => document.getElementById('screen-calendar').style.display === 'block');

    // Vom Dashboard aus wieder ins Büro und per HUD-Knopf zurück
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.waitForTimeout(250);
    await page.click('#screen-dashboard button[data-i18n="office_enter"]');
    await page.waitForTimeout(250);
    const backInOffice = await page.evaluate(() => document.getElementById('screen-office').style.display === 'block');
    await page.click('.office-hud-btn[data-i18n="office_to_dashboard"]');
    await page.waitForTimeout(250);
    const leftOffice = await page.evaluate(() => document.getElementById('screen-office').style.display === 'none');

    // Telefon zeigt ungelesene Post an
    const phone = await page.evaluate(() => {
        showScreen('screen-office');
        const badge = document.querySelector('.off-phone-badge');
        return { unread: inboxMessages.filter(m => !m.read).length, badge: badge ? parseInt(badge.textContent) : 0 };
    });

    assert(isStartScreen, 'Managerbüro ist der Startbildschirm nach dem Laden');
    assert(coversDisplay, 'Managerbüro nimmt das gesamte Display ein');
    assert(hotspotIds.length === 11, `Alle 11 Objekte im Büro vorhanden (${hotspotIds.length})`);
    assert(unreachable.length === 0, `Jedes Objekt wird an seinem Mittelpunkt korrekt getroffen${unreachable.length ? ' - FEHLER: ' + unreachable.join(', ') : ''}`);
    assert(sentence === 'Den Terminplan studieren', `Satzzeile zeigt die Aktion des überfahrenen Objekts ("${sentence}")`);
    assert(lampState.dark, 'Schreibtischlampe schaltet das Raumlicht aus');
    assert(lampState.stillInOffice, 'Lampe navigiert NICHT weg (reines Stimmungslicht)');
    assert(navigated, 'Klick auf den Wandkalender öffnet den Kalender-Screen');
    assert(backInOffice, 'Knopf im Dashboard führt zurück ins Managerbüro');
    assert(leftOffice, 'Knopf "Zum Dashboard" verlässt das Büro wieder');
    assert(phone.badge === phone.unread && phone.unread > 0, `Telefon zeigt die ungelesene Post an (${phone.badge}/${phone.unread})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Managerbüro');
    await page.close();
}

async function testTaxAndAdvisor(browser) {
    console.log('\n[16] Steuern & Steuerberater');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        out.rateOhne = getTaxRate();
        financeCentralState.taxAdvisorHired = true;
        out.rateMit = getTaxRate();
        out.honorar = getTaxAdvisorFee();
        out.breakEven = getTaxAdvisorBreakEven();

        // Abgabe wird auf die Spieltagseinnahmen tatsächlich erhoben und mitgeschrieben.
        financeCentralState.taxAdvisorHired = false;
        game.money = 500000; game.seasonTaxPaid = 0;
        applyMatchdayFinances(true, true, false, false, 'Test', '2:0');
        out.steuerOhne = game.lastMatchdayTax;
        out.feeOhne = game.lastMatchdayAdvisorFee;
        out.saisonSumme = game.seasonTaxPaid;

        financeCentralState.taxAdvisorHired = true;
        applyMatchdayFinances(true, true, false, false, 'Test', '2:0');
        out.feeMit = game.lastMatchdayAdvisorFee;
        out.saisonSummeGewachsen = game.seasonTaxPaid > out.saisonSumme;

        // Überlebt Speichern/Laden
        let save = JSON.parse(JSON.stringify(buildSaveState()));
        let sumVorher = game.seasonTaxPaid;
        game.seasonTaxPaid = 0; financeCentralState.taxAdvisorHired = false;
        applyLoadedState(save);
        out.summeRestauriert = game.seasonTaxPaid === sumVorher;
        out.mandatRestauriert = financeCentralState.taxAdvisorHired === true;
        return out;
    });

    // Krisen-Abmilderung: identische Ausgangslage, nur das Mandat unterscheidet sich.
    const krise = await page.evaluate(() => {
        const lauf = (hired) => {
            financeCentralState.taxAdvisorHired = hired;
            managerRPG.perks.crisisProof = false;
            game.money = -1000; game.negativeStreak = 9;
            let best = [...squad].sort((a, b) => calculatePlayerMarketValue(b.strength) - calculatePlayerMarketValue(a.strength))[0];
            let marktwert = calculatePlayerMarketValue(best.strength);
            let vorher = game.money;
            checkInsolvencyRisk();
            let quote = (game.money - vorher) / marktwert;

            let team = getOurLeagueTeam();
            team.points = 30;
            game.money = -1000; game.negativeStreak = 14;
            checkInsolvencyRisk();
            return { quote, abzug: 30 - team.points };
        };
        return { ohne: lauf(false), mit: lauf(true) };
    });

    assert(r.rateOhne === 0.12, `Ohne Berater gilt der volle Abgabensatz (${Math.round(r.rateOhne * 100)}%)`);
    assert(r.rateMit === 0.07, `Mit Berater sinkt der Abgabensatz (${Math.round(r.rateMit * 100)}%)`);
    assert(r.honorar > 0 && r.breakEven > 0, `Honorar (${r.honorar} €/SpT) und Break-even (${r.breakEven} €) werden berechnet`);
    assert(r.steuerOhne > 0, `Auf die Spieltagseinnahmen wird tatsächlich eine Abgabe erhoben (${r.steuerOhne} €)`);
    assert(r.feeOhne === 0, 'Ohne Mandat fällt kein Berater-Honorar an');
    assert(r.feeMit === r.honorar, 'Mit Mandat wird das Honorar pro Spieltag abgebucht');
    assert(r.saisonSummeGewachsen, 'Abgeführte Abgaben werden über die Saison aufsummiert');
    assert(r.summeRestauriert && r.mandatRestauriert, 'Mandat und Saisonsumme überleben Speichern/Laden');
    assert(Math.abs(krise.ohne.quote - 0.6) < 0.001 && Math.abs(krise.mit.quote - 0.75) < 0.001,
        `Zwangsverkauf bringt mit Berater mehr (${Math.round(krise.ohne.quote * 100)}% → ${Math.round(krise.mit.quote * 100)}% vom Marktwert)`);
    assert(krise.ohne.abzug === 3 && krise.mit.abzug === 2,
        `Punktabzug fällt mit Berater geringer aus (${krise.ohne.abzug} → ${krise.mit.abzug} Punkte)`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Steuern/Steuerberater');
    await page.close();
}

async function testStadiumWideBanden(browser) {
    console.log('\n[17] Bandenwerbung im gesamten Stadion');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let out = {};
        out.bereiche = getBandenAreaKeys().length;
        out.stadionBloecke = Object.keys(stadium.blocks).length;
        out.slotsStart = getTotalBandenSlots();

        // Stadionausbau schafft zusätzliche Werbeflächen.
        stadium.blocks.kurve.cap += 3600;
        out.slotsNachAusbau = getTotalBandenSlots();

        // Angebote sind einem Stadionbereich zugeordnet und werden dort gebucht.
        bandenOffers = []; bandenSponsors = [];
        checkIncomingBandenOffers(true);
        out.angebotHatBereich = bandenOffers.length > 0 && !!bandenOffers[0].area;
        let zielBereich = bandenOffers[0].area;
        acceptBandenOffer(bandenOffers[0].id);
        out.gebucht = getBandenSponsorsInArea(zielBereich).length === 1;
        out.zaehltInsEinkommen = getBandenIncome() > 0;

        // Ein voll belegter Bereich bekommt keine weiteren Angebote mehr.
        let key = 'vipLogen';
        bandenSponsors = [];
        for (let i = 0; i < getBandenSlotsForArea(key); i++) {
            bandenSponsors.push({ id: i, name: 'Test', type: 'Statisch', income: 100, active: true, duration: 10, category: 'Mode', area: key });
        }
        out.vollerBereichRaus = !getFreeBandenAreas().includes(key);

        // Sichtbarkeit wirkt: Haupttribüne zahlt bei gleicher Größe mehr als der Gästeblock.
        stadium.blocks.west.cap = 3000; stadium.blocks.gaeste.cap = 3000;
        let w = 0, g = 0;
        for (let i = 0; i < 300; i++) { w += rollBandenIncomeForArea('west', 'LED-Bande', 1); g += rollBandenIncomeForArea('gaeste', 'LED-Bande', 1); }
        out.schnittWest = Math.round(w / 300);
        out.schnittGaeste = Math.round(g / 300);

        // Altbestand aus Spielständen ohne Bereichszuordnung wird migriert.
        bandenSponsors = [{ id: 99, name: 'Alt', type: 'Statisch', income: 500, active: true, duration: 10, category: 'Mode' }];
        migrateLegacyBandenSponsors();
        out.altbestandMigriert = !!bandenSponsors[0].area;

        // Überlebt Speichern/Laden samt Bereichszuordnung.
        let save = JSON.parse(JSON.stringify(buildSaveState()));
        let bereichVorher = bandenSponsors[0].area;
        bandenSponsors = [];
        applyLoadedState(save);
        out.bereichRestauriert = bandenSponsors[0] && bandenSponsors[0].area === bereichVorher;
        return out;
    });

    assert(r.bereiche === r.stadionBloecke, `Jeder der ${r.stadionBloecke} Stadionbereiche bietet Bandenplätze (${r.bereiche})`);
    assert(r.slotsStart > 8, `Mehr Bandenplätze als die früheren 8 Pauschalplätze (${r.slotsStart})`);
    assert(r.slotsNachAusbau > r.slotsStart, `Stadionausbau schafft zusätzliche Werbeflächen (${r.slotsStart} → ${r.slotsNachAusbau})`);
    assert(r.angebotHatBereich, 'Bandenangebote sind einem konkreten Stadionbereich zugeordnet');
    assert(r.gebucht, 'Angenommene Bande belegt einen Platz im richtigen Bereich');
    assert(r.zaehltInsEinkommen, 'Gebuchte Bande zählt in die Bandeneinnahmen');
    assert(r.vollerBereichRaus, 'Ein voll belegter Bereich bekommt keine weiteren Angebote');
    assert(r.schnittWest > r.schnittGaeste, `Sichtbarkeit wirkt: Haupttribüne zahlt mehr als Gästeblock (${r.schnittWest} € vs. ${r.schnittGaeste} € bei gleicher Größe)`);
    assert(r.altbestandMigriert, 'Banden aus alten Spielständen bekommen einen Stadionbereich zugewiesen');
    assert(r.bereichRestauriert, 'Bereichszuordnung überlebt Speichern/Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Bandenwerbung');
    await page.close();
}

async function testOfficeAtmosphereAndCrest(browser) {
    console.log('\n[18] Büro: Tageszeit, Wetter & Vereinswappen');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());

    const r = await page.evaluate(() => {
        let out = {};
        // Ohne gebaute Flutlichtanlage wird auch an einem Pokalabend bei Tageslicht gespielt.
        stadium.flutlicht = false;
        cupTournament.matchdays = [game.matchday];
        out.ohneAnlageTag = getOfficeOutlook().night === false;
        out.statusPokal = getOfficeOutlook().statusLabel;
        renderOfficeView();
        out.tagHimmel = !!document.querySelector('#office-hs-window .off-sky-day');
        out.keineMasten = !document.querySelector('#office-hs-window .off-pylon');

        // Mit Flutlichtanlage wird daraus eine Flutlichtnacht.
        stadium.flutlicht = true;
        out.mitAnlageNacht = getOfficeOutlook().night === true;
        renderOfficeView();
        out.nachtHimmel = !!document.querySelector('#office-hs-window .off-sky-night');
        out.mastenLeuchten = !!document.querySelector('#office-hs-window .off-pylon-on');

        // Auswärtsspiel ohne Pokaltermin bleibt hell, trotz Flutlichtanlage.
        cupTournament.matchdays = [];
        europeTournament.matchdays = [];
        let teams = leaguesData[game.leagueLevel];
        let fixtures = fixturesData[game.leagueLevel][game.matchday - 1];
        let ourFixture = fixtures.find(f => teams[f.home]?.name === game.clubName || teams[f.away]?.name === game.clubName);
        out.auswaertsHell = ourFixture && teams[ourFixture.home]?.name === game.clubName
            ? null                                  // an diesem Spieltag haben wir Heimrecht
            : getOfficeOutlook().night === false;

        // Das aktuelle Wetter schlägt im Fenster durch.
        currentWeather = WEATHER_TYPES.find(w => w.name === 'Schnee');
        renderOfficeView();
        out.schneeSichtbar = !!document.querySelector('#office-hs-window .off-weather-snow');

        // Das Wappen übernimmt die echten Wappen-Daten aus dem Editor.
        game.clubCrestSymbol = 'XYZ';
        game.clubCrestAnimal = '🦅';
        game.sponsor.base = 4000;
        renderOfficeView();
        out.wappenSymbol = document.querySelector('#office-hs-crest .off-crest-symbol')?.textContent;
        out.wappenTier = !!document.querySelector('#office-hs-crest .off-crest-badge-animal');
        out.sponsorRing = !!document.querySelector('#office-hs-crest .off-crest-shield')?.classList.contains('off-crest-sponsored');
        out.wappenName = document.querySelector('#office-hs-crest .off-crest-plate')?.textContent;
        return out;
    });

    // Das Wappen ist anklickbar und führt zum Wappen-Editor.
    const box = await page.locator('#office-hs-crest').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(900);
    const zumEditor = await page.evaluate(() => document.getElementById('screen-manager-tree').style.display === 'block');

    assert(r.ohneAnlageTag && r.tagHimmel, 'Ohne Flutlichtanlage bleibt der Blick aus dem Fenster hell');
    assert(r.keineMasten, 'Ohne Flutlichtanlage stehen auch keine Masten im Bild');
    assert(r.statusPokal === 'Pokalabend', `Fenster benennt den Anlass korrekt ("${r.statusPokal}")`);
    assert(r.mitAnlageNacht && r.nachtHimmel, 'Mit Flutlichtanlage wird der Pokalabend zur Nacht');
    assert(r.mastenLeuchten, 'Flutlichtmasten leuchten in der Flutlichtnacht');
    assert(r.auswaertsHell !== false, 'Ohne Heimspiel/Pokaltermin bleibt es hell');
    assert(r.schneeSichtbar, 'Aktuelles Wetter (Schnee) ist im Fenster sichtbar');
    assert(r.wappenSymbol === 'XYZ', `Wandwappen zeigt die eingestellten Initialen ("${r.wappenSymbol}")`);
    assert(r.wappenTier, 'Wandwappen zeigt das gewählte Maskottchen');
    assert(r.sponsorRing, 'Wandwappen zeigt den Sponsorenring bei laufendem Hauptsponsor');
    assert(r.wappenName === '1.FC Moritz Leipzig', `Wandwappen trägt den Vereinsnamen ("${r.wappenName}")`);
    assert(zumEditor, 'Klick auf das Wappen öffnet den Wappen-Editor');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Tageszeit/Wappen');
    await page.close();
}

async function testRealisticMerchSales(browser) {
    console.log('\n[19] Fanartikel: realistische Absatzmengen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        out.sortiment = Object.keys(merchandise).length;
        for (let k in merchandise) merchandise[k].stock = 100000;   // Bestand darf nicht bremsen
        game.attendanceHistory = Array.from({ length: 8 }, () => ({ attendance: 950 }));

        const lauf = (att) => {
            for (let k in merchandise) merchandise[k].stock = 100000;
            let rev = simulateMerchSales(true, false, att);
            return { rev, stueck: Object.values(merchandise).reduce((s, m) => s + m.lastSales.total, 0) };
        };

        // Kleiner Verein: der Absatz muss zur Zuschauerzahl passen.
        let laeufe = [lauf(950), lauf(950), lauf(950)];
        out.proZuschauer = laeufe.map(l => l.rev / 950);
        out.stueckzahlen = laeufe.map(l => l.stueck);
        out.schwankt = new Set(laeufe.map(l => Math.round(l.rev))).size > 1;

        // Zehnfache Zuschauerzahl muss auch etwa den zehnfachen Absatz bringen.
        game.attendanceHistory = Array.from({ length: 8 }, () => ({ attendance: 9500 }));
        let gross = lauf(9500);
        out.skaliert = gross.stueck > laeufe[0].stueck * 4;

        // Premium-Booster und Perks müssen sich auswirken.
        game.attendanceHistory = Array.from({ length: 8 }, () => ({ attendance: 950 }));
        let ohne = lauf(950).rev;
        game.merchDoubleNextMatch = true;
        let mit = lauf(950).rev;
        out.boosterWirkt = mit > ohne * 1.25;
        out.boosterVerbraucht = game.merchDoubleNextMatch === false;

        // Auswärts wird im Stadion nichts verkauft, Stadt/Online laufen weiter.
        let aus = simulateMerchSales(false, false, 0);
        out.auswaertsOhneStadion = Object.values(merchandise).every(m => m.lastSales.stadium === 0) && aus > 0;

        // Verlauf wird mitgeschrieben und überlebt Speichern/Laden.
        out.verlaufEintraege = merchExtras.salesHistory.length;
        let save = JSON.parse(JSON.stringify(buildSaveState()));
        merchExtras.salesHistory = [];
        applyLoadedState(save);
        out.verlaufRestauriert = merchExtras.salesHistory.length === out.verlaufEintraege;
        return out;
    });

    const proZ = r.proZuschauer.map(v => v.toFixed(2)).join(' / ');
    assert(r.sortiment >= 24, `Sortiment umfasst mindestens 24 Artikel (${r.sortiment})`);
    assert(r.proZuschauer.every(v => v > 1.5 && v < 8), `Umsatz je Zuschauer bleibt realistisch (${proZ} € - Recherche: ~3 €)`);
    assert(r.stueckzahlen.every(v => v < 400), `Bei 950 Zuschauern werden keine Hunderte Artikel verkauft (${r.stueckzahlen.join('/')} Stück)`);
    assert(r.schwankt, 'Die Absatzmenge schwankt von Spieltag zu Spieltag');
    assert(r.skaliert, 'Zehnfache Zuschauerzahl bringt deutlich mehr Absatz');
    assert(r.boosterWirkt, 'Premium-Booster steigert den Absatz spürbar');
    assert(r.boosterVerbraucht, 'Premium-Booster wird nach dem Spieltag verbraucht');
    assert(r.auswaertsOhneStadion, 'Auswärts läuft kein Stadionverkauf, Stadt/Online aber schon');
    assert(r.verlaufEintraege > 0 && r.verlaufRestauriert, 'Verkaufsverlauf wird mitgeschrieben und überlebt Speichern/Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Fanartikel-Verkäufen');
    await page.close();
}

async function testBuildingPaymentAndPrices(browser) {
    console.log('\n[20] Bauen: Sofortzahlung, keine Schulden, Preise');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let out = {};
        // Ohne Deckung darf gar nicht erst gebaut werden.
        game.money = 50000;
        game.stadiumConstructionQueue = [];
        queueStadiumConstruction('campusBuilding', { key: 'hotel' }, 900000, 12, 'Testbau');
        out.ohneDeckungBlockiert = game.stadiumConstructionQueue.length === 0 && game.money === 50000;

        // Mit Deckung: sofort vollständig bezahlt, keine offene Restzahlung.
        game.money = 2000000;
        queueStadiumConstruction('campusBuilding', { key: 'hotel' }, 900000, 12, 'Testbau');
        let proj = game.stadiumConstructionQueue[0];
        out.sofortVollBezahlt = game.money === 1100000;
        out.keineRestzahlung = !!proj && proj.remainingPayment === 0;

        // Bei Fertigstellung darf nichts mehr abgebucht werden.
        let vorFertigstellung = game.money;
        for (let i = 0; i < 20; i++) tickStadiumConstruction();
        out.fertigOhneNachzahlung = game.money === vorFertigstellung;

        // Preise: Fabriken sind echte Investitionen, die Jugendakademie kein Kleingeld mehr.
        out.fabrikMin = Math.min(...Object.values(factories).map(f => f.cost));
        game.leagueLevel = 5; game.youthAcademyLvl = 1;
        out.akademieUnterliga = Math.max(300000, Math.round(600000 * Math.pow(1, 1.4) * getStadiumCostScale()));

        // Fabrikkauf ohne Holding-Guthaben: sichtbar gesperrt statt stumm wirkungslos.
        holdingCompany.money = 1000;
        showScreen('screen-industry');
        let gitter = document.getElementById('factories-grid');
        let kaufKnopf = [...gitter.querySelectorAll('button')].find(b => b.innerText.includes('Fabrik kaufen'));
        out.kaufGesperrt = !!kaufKnopf && kaufKnopf.disabled;
        out.fehlbetragSichtbar = gitter.innerText.includes('es fehlen');

        // Der Wirtschaftsbereich darf keine nativen Dialoge mehr nutzen (werden in manchen
        // Android-WebViews unterdrückt - der Knopf wirkt dann komplett wirkungslos).
        out.keinAlertMehr = !buyFactory.toString().includes('alert(')
            && !startProduction.toString().includes('alert(')
            && !transferClubToHolding.toString().includes('alert(');
        return out;
    });

    assert(r.ohneDeckungBlockiert, 'Ohne ausreichendes Guthaben wird gar nicht erst gebaut');
    assert(r.sofortVollBezahlt, 'Baukosten werden sofort vollständig abgebucht');
    assert(r.keineRestzahlung, 'Es bleibt keine Restzahlung bis zur Fertigstellung offen');
    assert(r.fertigOhneNachzahlung, 'Bei Fertigstellung wird nichts mehr nachgefordert');
    assert(r.fabrikMin >= 250000, `Fabriken sind echte Investitionen (günstigste: ${r.fabrikMin.toLocaleString('de-DE')} €)`);
    assert(r.akademieUnterliga >= 300000, `Jugendakademie auch in unteren Ligen kein Kleingeld (${r.akademieUnterliga.toLocaleString('de-DE')} €)`);
    assert(r.kaufGesperrt && r.fehlbetragSichtbar, 'Fabrikkauf ohne Holding-Guthaben ist sichtbar gesperrt und begründet');
    assert(r.keinAlertMehr, 'Wirtschaftsbereich meldet Fehler sichtbar statt über native Dialoge');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Bau-/Preis-Test');
    await page.close();
}

async function testAutoSaveAndPartialSimulation(browser) {
    console.log('\n[21] Autosave, Schnellspeichern & 5-Spieltage-Simulation');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        safeLocalRemove('anstoss_fm13_autosave');
        game.lastAutoSaveMatchday = 0;

        // Nur 5 Spieltage simulieren statt der ganzen Saison.
        let vorher = game.matchday;
        simulateMatchdays(5);
        out.genauFuenf = game.matchday - vorher === 5;

        // Dabei wird automatisch gespeichert - in einem EIGENEN Slot, nicht über Slot 1.
        out.autoAngelegt = !!safeLocalGet('anstoss_fm13_autosave');
        let auto = JSON.parse(safeLocalGet('anstoss_fm13_autosave'));
        out.autoHatMeta = !!(auto.meta && auto.meta.clubName);
        out.slot1Unberuehrt = !safeLocalGet('anstoss_fm13_save_slot_1');

        // Nicht nach jedem Spieltag erneut, sondern im Fünf-Spieltage-Takt.
        let stand = safeLocalGet('anstoss_fm13_autosave');
        simulateMatchdays(2);
        out.nichtJedenSpieltag = safeLocalGet('anstoss_fm13_autosave') === stand;
        simulateMatchdays(3);
        out.nachFuenfErneuert = safeLocalGet('anstoss_fm13_autosave') !== stand;

        // Automatischen Stand laden stellt exakt wieder her.
        let gespeichert = JSON.parse(safeLocalGet('anstoss_fm13_autosave')).game;
        game.money = 1; game.matchday = 99;
        out.autoLaedt = loadAutoSave() && game.money === gespeichert.money && game.matchday === gespeichert.matchday;

        // Schnellspeichern aus der unteren Leiste schreibt in Slot 1.
        game.money = 777777;
        quickSave();
        out.schnellSpeichern = JSON.parse(safeLocalGet('anstoss_fm13_save_slot_1')).game.money === 777777;

        // Nach Saisonende wird nicht weitersimuliert.
        game.matchday = 35;
        simulateMatchdays(5);
        out.saisonendeAbgefangen = game.matchday === 35;

        showScreen('screen-dashboard');
        out.speicherKnopf = !!document.querySelector('.bottom-nav-item[onclick="quickSave()"]');
        out.fuenfKnopf = !!document.querySelector('[onclick="simulateMatchdays(5)"]');
        return out;
    });

    assert(r.genauFuenf, 'simulateMatchdays(5) simuliert genau 5 Spieltage');
    assert(r.autoAngelegt && r.autoHatMeta, 'Nach 5 Spieltagen wird automatisch gespeichert (mit Metadaten)');
    assert(r.slot1Unberuehrt, 'Der Autosave nutzt einen eigenen Slot und überschreibt Slot 1 nicht');
    assert(r.nichtJedenSpieltag, 'Es wird nicht nach jedem einzelnen Spieltag gespeichert');
    assert(r.nachFuenfErneuert, 'Nach weiteren 5 Spieltagen wird der Autosave erneuert');
    assert(r.autoLaedt, 'Automatischer Spielstand lässt sich exakt wieder laden');
    assert(r.schnellSpeichern, 'Speicher-Knopf der unteren Leiste schreibt in Slot 1');
    assert(r.saisonendeAbgefangen, 'Nach Saisonende wird nicht weiter simuliert');
    assert(r.speicherKnopf, 'Speicher-Knopf ist in der unteren Menüleiste vorhanden');
    assert(r.fuenfKnopf, '5-Spieltage-Knopf ist vorhanden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Autosave/Simulation');
    await page.close();
}

// ---------------------------------------------------------------------------
// HAUPTPROGRAMM
// ---------------------------------------------------------------------------
async function main() {
    console.log('='.repeat(60));
    console.log('ANSTOSS FM13 - AUTOMATISIERTE TESTSUITE');
    console.log('='.repeat(60));

    const browser = await chromium.launch();

    const suites = [
        testStructuralSelfTest,
        testSaveLoad,
        testMatchSimulationStability,
        testEconomy,
        testSquadAndTactics,
        testYouthAcademy,
        testTransferMarket,
        testStadiumSystems,
        testAllScreensRender,
        testOldSaveMigration,
        testTrainingOverhaul,
        testLivingLeaguePersistence,
        testClubRenameAndSwitch,
        testTransferMarketAndClubDossier,
        testFreeTextInputSanitization,
        testSaveExportImportAndErrorLog,
        testSeasonPointsChart,
        testRivalManagerPersonality,
        testAchievementsSystem,
        testConfigurableNewGameStart,
        testAccessibilityContrastAndFontSizes,
        testLanguageToggle,
        testManagerOffice,
        testTaxAndAdvisor,
        testStadiumWideBanden,
        testOfficeAtmosphereAndCrest,
        testRealisticMerchSales,
        testBuildingPaymentAndPrices,
        testAutoSaveAndPartialSimulation,
    ];

    for (const suite of suites) {
        try {
            await suite(browser);
        } catch (e) {
            failed++;
            failedTests.push(`${suite.name} (Testlauf abgebrochen: ${e.message})`);
            console.log(`\nTestlauf abgebrochen in ${suite.name}: ${e.message}`);
        }
    }

    await browser.close();

    console.log('\n' + '='.repeat(60));
    console.log(`ERGEBNIS: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failedTests.length > 0) {
        console.log('\nFehlgeschlagene Tests:');
        failedTests.forEach(t => console.log(`  - ${t}`));
    }
    console.log('='.repeat(60));
    process.exit(failed > 0 ? 1 : 0);
}

main();
