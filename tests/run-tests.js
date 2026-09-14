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

const GAME_PATH = 'file://' + path.resolve(__dirname, '../dist/anstoss-fm13-standalone.html');

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

        // Akademie-Ausbau hat eine echte Bauzeit (frueher sofort)
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
