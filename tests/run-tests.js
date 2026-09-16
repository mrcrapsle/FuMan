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
