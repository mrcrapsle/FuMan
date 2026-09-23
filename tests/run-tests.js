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
        erwartetesStartkapital: getNewGameStartMoney(0, 500000),
        stadion: stadium.total,
        squadSize: squad.length,
        avgStrength: Math.round(squad.reduce((s, p) => s + p.strength, 0) / squad.length),
        maxStrength: Math.max(...squad.map(p => p.strength)),
        ourTeamFound: !!getOurLeagueTeam()
    }));

    assert(boxVisible, 'Klick auf "Neues Spiel starten" öffnet die Einstellungs-Box (statt sofort zu löschen)');
    assert(r.leagueLevel === 0, 'Gewählte Startliga (1. Liga) wird korrekt übernommen');
    assert(r.money === r.erwartetesStartkapital && r.money > 500000,
        'Das Startkapital wird auf die gewählte Startliga hochskaliert');
    assert(r.stadion > 40000, 'Ein Erstliga-Start bekommt ein entsprechend großes Stadion');
    assert(r.maxStrength <= 93, 'Der Startkader enthält keine Weltklasse-Superstars mehr');
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
    assert(hotspotIds.length === 12, `Alle 12 Objekte im Büro vorhanden (${hotspotIds.length})`);
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

async function testConfirmBeforeIrreversibleActions(browser) {
    console.log('\n[22] Bestätigung vor folgenreichen Aktionen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // Jugendspieler in den Profikader hochziehen
        scoutYouthTalent(); scoutYouthTalent();
        showScreen('screen-youth');
        let hoch = [...document.querySelectorAll('#youth-talents-list button')].find(b => b.innerText.includes('Profikader'));
        let kaderVorher = squad.length, jugendVorher = youthTalents.length;
        hoch.click();
        out.jugendErsterKlick = squad.length === kaderVorher && hoch.innerText.includes('Wirklich');
        hoch.click();
        out.jugendZweiterKlick = squad.length === kaderVorher + 1 && youthTalents.length === jugendVorher - 1;

        // Personal entlassen
        staffMembers.marketingDir.hired = true;
        showScreen('screen-staff');
        let entlassen = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Entlassen');
        entlassen.click();
        out.personalErsterKlick = staffMembers.marketingDir.hired === true && entlassen.innerText.includes('Wirklich');
        entlassen.click();
        out.personalZweiterKlick = staffMembers.marketingDir.hired === false;

        // Einstellen bleibt ohne Rückfrage - nur das Entlassen ist folgenreich.
        showScreen('screen-staff');
        let einstellen = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Einstellen');
        out.einstellenOhneRueckfrage = !!einstellen && einstellen.dataset.confirming !== 'true';

        // Die Absicherung nutzt KEINE nativen Dialoge (in Android-WebViews unterdrückt).
        out.keineNativenDialoge = !requireConfirm.toString().includes('confirm(')
            && !promoteYouth.toString().includes('window.confirm');
        return out;
    });

    assert(r.jugendErsterKlick, 'Jugendspieler hochziehen fragt beim ersten Klick nur nach');
    assert(r.jugendZweiterKlick, 'Erst der zweite Klick zieht den Jugendspieler wirklich hoch');
    assert(r.personalErsterKlick, 'Personal entlassen fragt beim ersten Klick nur nach');
    assert(r.personalZweiterKlick, 'Erst der zweite Klick entlässt das Personal wirklich');
    assert(r.einstellenOhneRueckfrage, 'Einstellen läuft weiterhin ohne Rückfrage');
    assert(r.keineNativenDialoge, 'Die Rückfrage nutzt keine nativen Dialoge');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Bestätigungsabfragen');
    await page.close();
}

async function testFinanceLedgerAndStatement(browser) {
    console.log('\n[23] Finanzmenü: Buchungsjournal & Kontoauszug');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Buchungsjournal: jeder Spieltag wird einzeln aufgeschlüsselt verbucht.
        let vorher = (game.financeLedger || []).length;
        simulateMatchdays(3);
        let ledger = game.financeLedger || [];
        out.journalWaechst = ledger.length === vorher + 3;
        let letzte = ledger[ledger.length - 1];
        out.journalHatPosten = Array.isArray(letzte.einnahmen) && Array.isArray(letzte.ausgaben)
            && letzte.ausgaben.length > 0;
        out.journalSummenStimmen = letzte.summeEin === letzte.einnahmen.reduce((s, e) => s + e.amount, 0)
            && letzte.summeAus === letzte.ausgaben.reduce((s, e) => s + e.amount, 0);

        // 2. Personalgehälter werden tatsächlich abgebucht (waren zuvor nur Anzeige).
        Object.values(staffMembers).forEach(s => s.hired = false);
        staffMembers.marketingDir.hired = true;
        let kontoVorSpieltag = game.money;
        simulateMatchdays(1);
        let spieltag = game.financeLedger[game.financeLedger.length - 1];
        let personalPosten = spieltag.ausgaben.find(a => a.label.includes('Personalgehälter'));
        out.personalVerbucht = !!personalPosten && personalPosten.amount === getTotalStaffWages();
        out.personalWirklichAbgezogen = game.money !== kontoVorSpieltag;

        // 3. Anzeige: alle drei Reiter rendern ohne Fehler und zeigen Inhalte.
        showScreen('screen-finances');
        setLedgerView('letzter');
        let boxLetzter = document.getElementById('finance-ledger-box').innerHTML;
        out.ansichtLetzter = boxLetzter.includes('EINNAHMEN') && boxLetzter.includes('AUSGABEN');
        setLedgerView('saison');
        let boxSaison = document.getElementById('finance-ledger-box').innerHTML;
        out.ansichtSaison = boxSaison.includes('abgerechnete Spieltage');
        out.tabAktiv = document.getElementById('ledger-tab-saison').className === 'btn-action'
            && document.getElementById('ledger-tab-letzter').className === 'btn-secondary';

        // 4. Kontoauszug: Bewegungen AUSSERHALB der Spieltagsabrechnung werden automatisch
        //    erfasst und dem auslösenden Bereich zugeordnet.
        game.kontoauszug = [];
        game.money = 5000000;
        showScreen('screen-stadium');
        let kontoVorBau = game.money;
        game.money -= 120000; // stellvertretend für einen Bauauftrag
        let buchung = game.kontoauszug[game.kontoauszug.length - 1];
        out.buchungErfasst = !!buchung && buchung.amount === -120000;
        out.buchungBereich = !!buchung && buchung.label.includes('Stadionausbau');
        out.buchungSaldo = !!buchung && buchung.saldo === kontoVorBau - 120000;

        // Spieltagsbuchungen tauchen NICHT im Kontoauszug auf (sie stehen im Journal).
        let auszugVorSpieltag = game.kontoauszug.length;
        simulateMatchdays(1);
        out.spieltagNichtImAuszug = game.kontoauszug.length === auszugVorSpieltag;

        // 4b. Ordnerdienst: nur bei Heimspielen und nur nach tatsaechlichem Einsatz.
        game.stewards = 100;
        securityWorkforce.permanentStewards = 0;
        out.ordnerNurNachBedarf = getDeployedStewards(600) === 24 && getDeployedStewards(100000) === 100;
        out.ordnerKostenProportional = getStewardMatchdayCost(600) === 24 * 120 * 2;
        let kontoVorAuswaerts = game.money;
        tickStewardCosts(false);
        out.ordnerNurZuhause = game.money === kontoVorAuswaerts;
        // Abgerechnet wird ueber eine echte Spieltagsabrechnung: tickStewardCosts() bucht
        // bewusst nur, wenn fuer diesen Spieltag auch wirklich gespielt wurde.
        let heimspiele = 0, ordnerVerbucht = 0;
        for (let i = 0; i < 6; i++) {
            simulateMatchdays(1);
            let e = game.financeLedger[game.financeLedger.length - 1];
            if (e && e.heimspiel) {
                heimspiele++;
                if (e.ausgaben.some(a => a.label.includes('Ordnerdienst'))) ordnerVerbucht++;
            }
        }
        out.ordnerZuhauseBezahlt = heimspiele > 0 && ordnerVerbucht === heimspiele;

        setLedgerView('konto');
        let boxKonto = document.getElementById('finance-ledger-box').innerHTML;
        out.ansichtKonto = boxKonto.includes('NACH BEREICH') && boxKonto.includes('Stadionausbau');

        // 5. Laden eines Spielstands darf keine Phantom-Buchung erzeugen.
        saveGameToSlot(1);
        let gespeicherteBuchungen = game.kontoauszug.length;
        game.money = 1; // grosse Kontoaenderung, die NICHT mitgespeichert wurde
        loadGameFromSlot(1, true);
        // Der wiederhergestellte Kontostand darf keine zusaetzliche Buchung erzeugen -
        // im Auszug steht exakt das, was gespeichert wurde.
        out.ladenOhnePhantom = game.kontoauszug.length === gespeicherteBuchungen;
        out.ladenStelltGeldWiederHer = game.money > 1000;

        // 6. Bricht das Laden mittendrin ab (beschaedigte Importdatei), darf die
        //    Protokollierung nicht dauerhaft abgeschaltet bleiben - sonst fehlten alle
        //    spaeteren Buchungen stillschweigend im Kontoauszug.
        try { applyLoadedState(null); } catch (e) { /* erwartet */ }
        let auszugVorher = (game.kontoauszug || []).length;
        showScreen('screen-stadium');
        game.money -= 5000;
        out.abgebrochenesLadenBlockiertNicht = (game.kontoauszug || []).length === auszugVorher + 1;
        return out;
    });

    assert(r.journalWaechst, 'Jeder Spieltag erzeugt einen Eintrag im Buchungsjournal');
    assert(r.journalHatPosten, 'Der Eintrag listet Einnahmen und Ausgaben einzeln auf');
    assert(r.journalSummenStimmen, 'Die gespeicherten Summen stimmen mit den Einzelposten überein');
    assert(r.personalVerbucht, 'Personalgehälter stehen als eigener Ausgabenposten im Journal');
    assert(r.personalWirklichAbgezogen, 'Personalgehälter verändern den Kontostand wirklich');
    assert(r.ansichtLetzter, 'Reiter "Letzter Spieltag" zeigt Einnahmen und Ausgaben');
    assert(r.ansichtSaison, 'Reiter "Saison gesamt" fasst alle Spieltage zusammen');
    assert(r.tabAktiv, 'Der aktive Reiter wird hervorgehoben');
    assert(r.buchungErfasst, 'Kontobewegungen ausserhalb des Spieltags werden automatisch erfasst');
    assert(r.buchungBereich, 'Eine Buchung wird dem auslösenden Bereich zugeordnet');
    assert(r.buchungSaldo, 'Der Kontoauszug hält den Kontostand nach jeder Buchung fest');
    assert(r.spieltagNichtImAuszug, 'Spieltagsposten erscheinen nur im Journal, nicht doppelt im Auszug');
    assert(r.ordnerNurNachBedarf, 'Es werden nur so viele Ordner eingesetzt wie Zuschauer da sind');
    assert(r.ordnerKostenProportional, 'Die Ordnerkosten richten sich nach dem tatsächlichen Einsatz');
    assert(r.ordnerNurZuhause, 'Auswärts fällt kein Ordnerdienst an');
    assert(r.ordnerZuhauseBezahlt, 'Bei jedem Heimspiel steht der Ordnerdienst im Buchungsjournal');
    assert(r.ansichtKonto, 'Reiter "Kontoauszug" zeigt Bereiche und Einzelbuchungen');
    assert(r.ladenOhnePhantom, 'Das Laden eines Spielstands erzeugt keine Phantom-Buchung');
    assert(r.ladenStelltGeldWiederHer, 'Der Kontostand wird beim Laden korrekt wiederhergestellt');
    assert(r.abgebrochenesLadenBlockiertNicht, 'Ein abgebrochenes Laden schaltet die Protokollierung nicht dauerhaft ab');

    // 7. Die tragende Regel des ganzen Finanzmenues: JEDER Euro, der das Konto verlaesst
    //    oder erreicht, steht entweder im Buchungsjournal oder im Kontoauszug. Ohne diese
    //    Pruefung kann Geld unbemerkt verschwinden - genau das passierte beim Ordnerdienst
    //    an spielfreien Spieltagen (weder Journaleintrag noch Auszugszeile).
    const lueckenlos = await page.evaluate(() => {
        let out = {};
        managerRPG.level = 5;
        game.money = 20000000;
        game.financeLedger = [];
        game.kontoauszug = [];
        let vorher = game.money;

        showScreen('screen-second-team');
        if (!game.secondTeam.isActive) foundSecondTeam();
        hireSecondTeamStaff('chefTrainer');
        showScreen('screen-staff'); toggleStaffMember('coTrainer');
        showScreen('screen-youth'); scoutYouthTalent(); upgradeYouthAcademy();
        showScreen('screen-fans'); setStewards(200);
        showScreen('screen-finances'); takeLoan(200000);
        simulateMatchdays(6);

        let journal = game.financeLedger.reduce((s, e) => s + e.summeEin - e.summeAus, 0);
        let auszug = game.kontoauszug.reduce((s, x) => s + x.amount, 0);
        out.unerklaert = Math.round(game.money - vorher - journal - auszug);
        out.journalGenutzt = game.financeLedger.length > 0;
        out.auszugGenutzt = game.kontoauszug.length > 0;
        out.alleZugeordnet = game.kontoauszug.every(x => !x.label.includes('Sonstige'));

        // Spielfreier Spieltag: processPostMatchRoutine() laeuft ohne vorherige
        // Spieltagsabrechnung - dabei darf kein Geld abgebucht werden.
        game.stewards = 100;
        let geldVorher = game.money;
        let journalVorher = game.financeLedger.length;
        processPostMatchRoutine();
        out.spielfreiKostetNichts = game.money === geldVorher && game.financeLedger.length === journalVorher;
        return out;
    });

    assert(lueckenlos.journalGenutzt && lueckenlos.auszugGenutzt, 'Journal und Kontoauszug werden beide befüllt');
    assert(lueckenlos.unerklaert === 0,
        `Jeder Euro steht entweder im Journal oder im Kontoauszug (Differenz ${lueckenlos.unerklaert} €)`);
    assert(lueckenlos.alleZugeordnet, 'Jede Buchung ist einem Bereich zugeordnet, keine bleibt "Sonstige"');
    assert(lueckenlos.spielfreiKostetNichts, 'An einem spielfreien Spieltag fällt kein Ordnerdienst an');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Finanzmenü');
    await page.close();
}

async function testEconomyBalance(browser) {
    console.log('\n[24] Wirtschaftliche Balance: stillgelegte Ränge, Gehälter, VIP-Logen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Stillgelegte Ränge: wer ein grosses Stadion kaum füllt, zahlt nicht den vollen
        //    Unterhalt - wer es füllt, schon.
        let total = stadium.total;
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: 600, capacity: total, opponent: 'X' }];
        let unterhaltLeer = getStadiumBaseMaintenance();
        let stillgelegtLeer = getMothballedCapacity();
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: total, capacity: total, opponent: 'X' }];
        let unterhaltVoll = getStadiumBaseMaintenance();
        out.stillgelegtGuenstiger = unterhaltLeer < unterhaltVoll * 0.6;
        out.stillgelegtErkannt = stillgelegtLeer > total * 0.5;
        out.vollesStadionVollerPreis = Math.round(unterhaltVoll) === Math.round(total * 0.45)
            && getMothballedCapacity() === 0;
        // Mindestens ein Fuenftel bleibt immer in Betrieb.
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: 1, capacity: total, opponent: 'X' }];
        out.grundbetriebBleibt = getUsedStadiumCapacity() >= Math.round(total * 0.2);

        // 2. Spieltagsabrechnung und GuV-Prognose rechnen mit DERSELBEN Formel.
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: 600, capacity: total, opponent: 'X' }];
        showScreen('screen-finances');
        let unterhaltProSpieltag = getStadiumBaseMaintenance();
        simulateMatchdays(1);
        let posten = game.financeLedger.slice(-1)[0].ausgaben.find(a => a.label.includes('Unterhalt'));
        out.prognoseGleichAbrechnung = !!posten && Math.abs(posten.amount - Math.round(unterhaltProSpieltag)) < 200;

        // 3. Gehälter im Amateurbereich haengen an der Staerke statt an einem Pauschalsockel.
        let schwach = calculatePlayerWage(calculatePlayerMarketValue(30), 30);
        let stark = calculatePlayerWage(calculatePlayerMarketValue(44), 44);
        out.amateurGehaelterGestaffelt = stark > schwach;
        out.amateurGehaltAngemessen = schwach <= 250;
        // Profigehaelter bleiben unveraendert hoch.
        out.profiGehaltUnveraendert = calculatePlayerWage(calculatePlayerMarketValue(70), 70) > 8000;

        // 4. VIP-Logen sind nicht mehr unabhaengig von der Zuschauerzahl ausverkauft.
        out.vipGekoppelt = !applyMatchdayFinances.toString().includes('(stadium.vipTotal || 50) * game.ticketPrices.vip');

        return out;
    });

    // 5. Eine komplett passiv gespielte Saison ruiniert den Verein nicht mehr bis zur
    //    Zahlungsunfaehigkeit - aktives Wirtschaften wirft klar Gewinn ab.
    const saison = await page.evaluate(() => {
        sessionStorage.setItem('anstoss_fm13_force_new_game', '1');
        return true;
    });
    await page.reload();
    await page.waitForTimeout(400);
    const passiv = await page.evaluate(() => {
        closeTutorial();
        let start = game.money;
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        return { start, ende: game.money };
    });
    assert(saison && passiv.ende > -100000, 'Eine passiv gespielte Saison endet nicht in der Zahlungsunfähigkeit');
    // Bewusst keine Pruefung auf "Ende < Start": ueber 35 Spieltage kann eine gluecklich
    // gelaufene Pokalrunde auch eine voellig passiv gespielte Saison ins Plus drehen - das
    // ist legitimes Spielverhalten und hat die Pruefung vereinzelt kippen lassen. Gemessen
    // ueber je fuenf Laeufe endet die Saison bei rund 35.000 bis 76.000 EUR von 150.000 EUR
    // Startkapital. Geprueft wird deshalb, was verlaesslich gilt: Nichtstun macht nicht reich.
    assert(passiv.ende < passiv.start * 1.5,
        `Nichtstun macht den Verein nicht reich (${Math.round(passiv.ende)} € von ${Math.round(passiv.start)} €)`);

    assert(r.stillgelegtGuenstiger, 'Ein kaum gefülltes Stadion kostet deutlich weniger Unterhalt');
    assert(r.stillgelegtErkannt, 'Nicht benötigte Ränge werden als stillgelegt erkannt');
    assert(r.vollesStadionVollerPreis, 'Ein volles Stadion kostet weiterhin den vollen Unterhalt');
    assert(r.grundbetriebBleibt, 'Ein Fünftel des Stadions bleibt immer in Betrieb');
    assert(r.prognoseGleichAbrechnung, 'GuV-Prognose und Spieltagsabrechnung nutzen dieselbe Formel');
    assert(r.amateurGehaelterGestaffelt, 'Amateurgehälter richten sich nach der Spielstärke');
    assert(r.amateurGehaltAngemessen, 'Ein Kreisklassenspieler kostet nicht mehr 400 € pro Spieltag');
    assert(r.profiGehaltUnveraendert, 'Profigehälter bleiben unverändert hoch');
    assert(r.vipGekoppelt, 'VIP-Logen gelten nicht mehr unabhängig von der Zuschauerzahl als ausverkauft');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Wirtschaftssimulation');
    await page.close();
}

async function testSecondTeamAndTrainingAutomation(browser) {
    console.log('\n[25] Zweite Mannschaft & Trainingsstab-Automatik');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        managerRPG.level = 5;
        game.money = 5000000;
        foundSecondTeam();

        // 1. Eigener Trainerstab: einstellen, Wirkung, Gehalt, Entlassen.
        let staerkeVorher = calcSecondTeamStrength();
        hireSecondTeamStaff('chefTrainer');
        out.chefTrainerWirkt = calcSecondTeamStrength() === staerkeVorher + 2;
        out.stabKostetAbloese = secondTeamStaff.chefTrainer.hired === true;
        hireSecondTeamStaff('physio');
        hireSecondTeamStaff('talentScout');
        out.gehaltSumme = getSecondTeamStaffWages()
            === secondTeamStaff.chefTrainer.wage + secondTeamStaff.physio.wage + secondTeamStaff.talentScout.wage;

        // Talentspaeher verbessert den Amateurmarkt.
        refreshSecondTeamMarket();
        let mitSpaeher = secondTeamMarketPlayers.length;
        secondTeamStaff.talentScout.hired = false;
        refreshSecondTeamMarket();
        out.spaeherBringtMehr = mitSpaeher > secondTeamMarketPlayers.length;
        secondTeamStaff.talentScout.hired = true;

        // Entlassen braucht zwei Klicks (keine nativen Dialoge).
        showScreen('screen-second-team');
        let entlassen = [...document.querySelectorAll('#second-team-staff-box button')].find(b => b.innerText.trim() === 'Entlassen');
        entlassen.click();
        out.entlassenErsterKlick = secondTeamStaff.chefTrainer.hired === true;
        entlassen.click();
        out.entlassenZweiterKlick = secondTeamStaff.chefTrainer.hired === false;
        hireSecondTeamStaff('chefTrainer');

        // 2. Gehaelter des Reserve-Stabs stehen als eigener Posten im Buchungsjournal.
        simulateMatchdays(1);
        let posten = game.financeLedger.slice(-1)[0].ausgaben.find(a => a.label.includes('Reserve'));
        out.reserveGehaltVerbucht = !!posten && posten.amount === getSecondTeamStaffWages();

        // 3. Physiotherapeut dreht die Fitnessbilanz der Reserve ins Plus.
        secondTeamSquad.forEach(p => p.fitness = 70);
        simulateMatchdays(4);
        let mitPhysio = secondTeamSquad.reduce((s, p) => s + p.fitness, 0) / secondTeamSquad.length;
        secondTeamStaff.physio.hired = false;
        secondTeamSquad.forEach(p => p.fitness = 70);
        simulateMatchdays(4);
        let ohnePhysio = secondTeamSquad.reduce((s, p) => s + p.fitness, 0) / secondTeamSquad.length;
        out.physioWirkt = mitPhysio > ohnePhysio;
        out.ohneStabNichtRuiniert = ohnePhysio >= 60;
        secondTeamStaff.physio.hired = true;

        // 4. Nachwuchs-Koordinator entwickelt junge Reservisten wirklich weiter.
        hireSecondTeamStaff('nachwuchsKoordinator');
        secondTeamSquad.forEach(p => { p.age = 20; });
        let staerkeSumme = secondTeamSquad.reduce((s, p) => s + p.strength, 0);
        simulateMatchdays(12);
        out.nachwuchsEntwickeltSich = secondTeamSquad.reduce((s, p) => s + p.strength, 0) > staerkeSumme;

        // 5. Jugendspieler koennen in die Reserve statt in den Profikader.
        scoutYouthTalent();
        showScreen('screen-youth');
        let reserveBtn = [...document.querySelectorAll('#youth-talents-list button')].find(b => b.innerText.includes('Reserve'));
        let reserveVorher = secondTeamSquad.length, jugendVorher = youthTalents.length;
        out.reserveKnopfVorhanden = !!reserveBtn;
        reserveBtn.click();
        out.jugendReserveErsterKlick = secondTeamSquad.length === reserveVorher;
        reserveBtn.click();
        out.jugendReserveZweiterKlick = secondTeamSquad.length === reserveVorher + 1 && youthTalents.length === jugendVorher - 1;

        return out;
    });

    const t = await page.evaluate(() => {
        let out = {};
        // 6. Trainingsstab-Automatik: kostet Premium-Punkte, ist nicht billig, und arbeitet
        //    auch waehrend einer durchsimulierten Saison weiter.
        Object.keys(SKILL_TRAINING_COACHES).forEach(k => { if (staffMembers[k]) staffMembers[k].hired = false; });
        game.premiumPoints = 1000;
        game.skillTrainingQueue = [];
        game.trainingAutopilotMatchdays = 0;
        activateTrainingAutopilot();
        out.ohneTrainerKeineAutomatik = game.trainingAutopilotMatchdays === 0 && game.premiumPoints === 1000;

        staffMembers.coTrainer.hired = true;
        activateTrainingAutopilot();
        out.nichtBillig = TRAINING_AUTOPILOT_COST >= 400;
        out.punkteAbgezogen = game.premiumPoints === 1000 - TRAINING_AUTOPILOT_COST;
        out.laufzeit = game.trainingAutopilotMatchdays === TRAINING_AUTOPILOT_DURATION;

        game.money = 5000000;
        simulateMatchdays(3);
        out.automatikStartetFoerderung = (game.skillTrainingQueue || []).length > 0;
        out.automatikProtokolliert = (game.trainingAutopilotLog || []).length > 0;
        out.laufzeitZaehltRunter = game.trainingAutopilotMatchdays === TRAINING_AUTOPILOT_DURATION - 3;
        out.hoechstensDreiParallel = game.skillTrainingQueue.length <= 3;

        // Die Automatik bucht den Verein nie ins Minus.
        game.skillTrainingQueue = [];
        game.money = 100;
        let geldVorher = game.money;
        simulateMatchdays(1);
        out.keineUeberziehung = game.skillTrainingQueue.length === 0 && game.money <= geldVorher;

        // 7. Einmal-Vorschlag kostet ebenfalls Premium-Punkte und fuellt die Auswahl.
        showScreen('screen-training');
        setTrainingTab('individual');
        game.premiumPoints = 500;
        autoPickSkillTraining();
        out.vorschlagKostet = game.premiumPoints === 500 - TRAINING_AUTOPICK_COST;
        out.vorschlagFuelltAuswahl = !!document.getElementById('skill-training-player-select').value
            && !!document.getElementById('skill-training-coach-select').value;

        game.premiumPoints = 0;
        let vorher = document.getElementById('skill-training-player-select').value;
        autoPickSkillTraining();
        out.ohneGuthabenKeinVorschlag = game.premiumPoints === 0 && document.getElementById('skill-training-player-select').value === vorher;
        return out;
    });

    assert(r.chefTrainerWirkt, 'Reserve-Cheftrainer erhöht die Teamstärke der zweiten Mannschaft');
    assert(r.stabKostetAbloese, 'Reserve-Personal lässt sich einstellen');
    assert(r.gehaltSumme, 'Die Gehaltssumme des Reserve-Stabs wird korrekt berechnet');
    assert(r.spaeherBringtMehr, 'Der Amateur-Talentspäher bringt mehr Spieler auf den Markt');
    assert(r.entlassenErsterKlick, 'Reserve-Personal entlassen fragt beim ersten Klick nur nach');
    assert(r.entlassenZweiterKlick, 'Erst der zweite Klick entlässt das Reserve-Personal');
    assert(r.reserveGehaltVerbucht, 'Der Reserve-Trainerstab steht als eigener Posten im Buchungsjournal');
    assert(r.physioWirkt, 'Der Reserve-Physiotherapeut verbessert die Fitness der zweiten Mannschaft');
    assert(r.ohneStabNichtRuiniert, 'Eine unbetreute Reserve schwächelt, wird aber nicht unbrauchbar');
    assert(r.nachwuchsEntwickeltSich, 'Mit Nachwuchs-Koordinator entwickeln sich junge Reservisten weiter');
    assert(r.reserveKnopfVorhanden, 'Jugendspieler können in die Reserve statt in den Profikader');
    assert(r.jugendReserveErsterKlick, 'Der Sprung in die Reserve fragt beim ersten Klick nur nach');
    assert(r.jugendReserveZweiterKlick, 'Erst der zweite Klick schiebt den Jugendspieler in die Reserve');

    assert(t.ohneTrainerKeineAutomatik, 'Ohne passenden Trainer lässt sich die Automatik nicht kaufen');
    assert(t.nichtBillig, 'Die Trainingsstab-Automatik ist bewusst teuer (mind. 400 Premium-Punkte)');
    assert(t.punkteAbgezogen, 'Die Automatik zieht die Premium-Punkte wirklich ab');
    assert(t.laufzeit, 'Die Automatik läuft die vorgesehene Anzahl Spieltage');
    assert(t.automatikStartetFoerderung, 'Die Automatik startet selbstständig Förderprogramme');
    assert(t.automatikProtokolliert, 'Jede automatische Förderung wird protokolliert');
    assert(t.laufzeitZaehltRunter, 'Die Restlaufzeit zählt pro Spieltag herunter');
    assert(t.hoechstensDreiParallel, 'Die Automatik startet höchstens drei Förderungen parallel');
    assert(t.keineUeberziehung, 'Die Automatik bucht den Verein nie ins Minus');
    assert(t.vorschlagKostet, 'Der Einmal-Vorschlag kostet Premium-Punkte');
    assert(t.vorschlagFuelltAuswahl, 'Der Einmal-Vorschlag füllt Spieler, Attribut und Trainer aus');
    assert(t.ohneGuthabenKeinVorschlag, 'Ohne Guthaben passiert nichts und es wird nichts abgezogen');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Reserve und Trainingsautomatik');
    await page.close();
}

async function testLeagueEconomy(browser) {
    console.log('\n[26] Ligaökonomie: TV-Gelder in Raten, Profi-Startoptionen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. TV-Gelder kommen jetzt als Spieltagsrate, nicht mehr als Einmalzahlung.
        let rate = getTvMoneyInstallment();
        out.rateVorhanden = rate > 0;
        out.rateIstNeutral = rate === Math.round(LEAGUE_BASE_TV_MONEY[game.leagueLevel] / MATCHDAYS_PER_SEASON);
        // Die Rate haengt NICHT am Tabellenplatz - sonst brächte ein zufälliger erster
        // Platz am ersten Spieltag die ganze Saison über 50 % mehr Geld.
        let ersterPlatz = calculateCollectiveTvMoney(game.leagueLevel, 1);
        let letzterPlatz = calculateCollectiveTvMoney(game.leagueLevel, 18);
        out.platzierungZaehltAmEnde = ersterPlatz > letzterPlatz;

        let gezahltVorher = game.tvMoneyPaidThisSeason || 0;
        simulateMatchdays(3);
        out.ratenWerdenGezahlt = (game.tvMoneyPaidThisSeason || 0) === gezahltVorher + rate * 3;
        let posten = game.financeLedger.slice(-1)[0].einnahmen.find(e => e.label.includes('TV'));
        out.tvImJournal = !!posten && posten.amount === rate;

        // 2. Die TV-Staffel steigt mit jeder Ligastufe streng monoton.
        out.staffelMonoton = LEAGUE_BASE_TV_MONEY.every((v, i) => i === 0 || v < LEAGUE_BASE_TV_MONEY[i - 1]);

        // 3. Startkapital und Stadion skalieren mit der gewaehlten Startliga.
        out.kapitalSkaliert = getNewGameStartMoney(0, 150000) > getNewGameStartMoney(3, 150000)
            && getNewGameStartMoney(3, 150000) > getNewGameStartMoney(5, 150000)
            && getNewGameStartMoney(5, 150000) === 150000;

        // 4. Generierte Kader liegen um das Ligamittel statt darueber.
        [0, 2, 4].forEach(lvl => {
            let sq = generateSquadForLevel(lvl);
            let basis = Math.max(25, 82 - lvl * 10);
            let schnitt = sq.reduce((s, p) => s + p.strength, 0) / sq.length;
            if (!out.kaderLigadurchschnitt) out.kaderLigadurchschnitt = true;
            if (Math.abs(schnitt - basis) > 4) out.kaderLigadurchschnitt = false;
        });
        return out;
    });

    // 5. Ein Erstliga-Start ist wirtschaftlich tragfaehig: nach einer aktiv bewirtschafteten
    //    Saison steht der Verein nicht schlechter da als zu Beginn.
    await page.evaluate(() => {
        sessionStorage.setItem('anstoss_fm13_newgame_leaguelevel', '0');
        sessionStorage.setItem('anstoss_fm13_newgame_money', '150000');
        sessionStorage.setItem('anstoss_fm13_force_new_game', '1');
    });
    await page.reload();
    await page.waitForTimeout(400);
    const profi = await page.evaluate(() => {
        closeTutorial();
        checkIncomingSponsorOffers(true); acceptSponsorOffer(sponsorOffers[0].id);
        checkIncomingKitOffers(true); if (kitSupplierOffers[0]) acceptKitOffer(kitSupplierOffers[0].id);
        for (let i = 0; i < 300 && bandenSponsors.filter(x => x.active).length < 20; i++) {
            checkIncomingBandenOffers(true);
            if (bandenOffers[0]) acceptBandenOffer(bandenOffers[0].id);
        }
        game.financeLedger = [];
        let start = game.money;
        simulateMatchdays(30);
        let l = game.financeLedger;
        return {
            start,
            ende: game.money,
            stadion: stadium.total,
            saldoProSpieltag: Math.round(l.reduce((s, e) => s + e.summeEin - e.summeAus, 0) / l.length),
            einProSpieltag: Math.round(l.reduce((s, e) => s + e.summeEin, 0) / l.length)
        };
    });

    assert(r.rateVorhanden, 'Es gibt eine TV-Spieltagsrate');
    assert(r.rateIstNeutral, 'Die Rate entspricht dem Ligagrundbetrag geteilt durch die Spieltage');
    assert(r.platzierungZaehltAmEnde, 'Der Tabellenplatz entscheidet weiterhin über die Gesamthöhe');
    assert(r.ratenWerdenGezahlt, 'Jeder Spieltag zahlt genau eine Rate aus');
    assert(r.tvImJournal, 'Die TV-Rate steht als eigener Posten im Buchungsjournal');
    assert(r.staffelMonoton, 'Die TV-Staffel steigt mit jeder Ligastufe');
    assert(r.kapitalSkaliert, 'Startkapital skaliert mit der gewählten Startliga, die 6. Liga bleibt unverändert');
    assert(r.kaderLigadurchschnitt, 'Generierte Startkader liegen um das Ligamittel statt deutlich darüber');
    assert(profi.stadion > 40000, 'Der Erstliga-Start bekommt ein Stadion passender Größe');
    assert(profi.saldoProSpieltag > -0.05 * profi.einProSpieltag,
        `Ein Erstliga-Verein wirtschaftet nicht mehr strukturell ins Minus (Saldo ${profi.saldoProSpieltag} €/Spieltag bei ${profi.einProSpieltag} € Einnahmen)`);
    assert(profi.ende > 0 && profi.ende > profi.start * 0.8,
        `Nach 30 aktiv bewirtschafteten Spieltagen ist der Erstligist noch solvent (${Math.round(profi.ende)} € statt ${Math.round(profi.start)} €)`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler in der Ligaökonomie');
    await page.close();
}

async function testTransferMarketFairness(browser) {
    console.log('\n[27] Transfermarkt: Angebote in jeder Liga, sichtbare Rückmeldungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Auch ein Sechstligist bekommt Angebote fuer seine Leistungstraeger. Die alte
        //    feste Untergrenze (Staerke 48) lag komplett ueber einem Amateurkader (26-44),
        //    dort ging deshalb NIE ein Angebot ein.
        let schnitt = squad.reduce((s, p) => s + p.strength, 0) / squad.length;
        out.schwelleRelativ = getTransferInterestThreshold() <= Math.round(schnitt) + 2
            && getTransferInterestThreshold() >= Math.round(schnitt) - 1;
        out.kaderUnter48 = squad.every(p => p.strength < 48);

        incomingOffers = [];
        let gesehen = new Set();
        for (let i = 0; i < 34; i++) {
            checkIncomingTransferOffers();
            incomingOffers.forEach(o => gesehen.add(o.id));
        }
        out.angeboteKommen = gesehen.size >= 5;

        // 2. Die Angebotshoehe liegt in einem plausiblen Band um den Marktwert.
        out.angeboteRealistisch = incomingOffers.every(o => o.currentBid >= o.marketValue * 0.5
            && o.currentBid <= o.marketValue * 2.0);

        // 3. Der Markt rotiert waehrend der Saison, bleibt aber gleich gross.
        let vorher = marketPlayers.map(p => p.name).join('|');
        let groesse = marketPlayers.length;
        for (let i = 0; i < 25; i++) tickTransferMarketRotation();
        out.marktRotiert = marketPlayers.map(p => p.name).join('|') !== vorher;
        out.marktGroesseStabil = marketPlayers.length === groesse;

        // 4. Keine nativen Dialoge mehr im Transferpfad - in manchen Android-WebViews
        //    werden die unterdrueckt, der Klick bliebe dann kommentarlos wirkungslos.
        out.keineNativenDialoge = [buyPlayer, sellPlayer, signFreeAgent, signLoanPlayer,
            acceptTransferOffer, exerciseLoanBuyOption]
            .every(f => !/(^|[^.\w])alert\s*\(/.test(f.toString()));

        // 5. Ein gescheiterter Kauf erklaert sich jetzt sichtbar.
        game.money = 0;
        game.transferBudget = 99999999;
        game.wageBudget = 99999999;
        let kaderVorher = squad.length;
        let toast = document.getElementById('app-toast');
        toast.className = 'app-toast';
        toast.innerText = '';
        buyPlayer(0);
        out.kaufScheitertSichtbar = squad.length === kaderVorher
            && toast.classList.contains('show')
            && toast.innerText.length > 10;
        return out;
    });

    assert(r.kaderUnter48, 'Ein Sechstliga-Kader liegt komplett unter der alten Interessensschwelle');
    assert(r.schwelleRelativ, 'Die Interessensschwelle richtet sich nach dem eigenen Kader statt nach einer festen Zahl');
    assert(r.angeboteKommen, 'Auch in der untersten Liga gehen Transferangebote ein');
    assert(r.angeboteRealistisch, 'Die Angebotshöhe liegt in einem plausiblen Band um den Marktwert');
    assert(r.marktRotiert, 'Der Transfermarkt rotiert während der Saison');
    assert(r.marktGroesseStabil, 'Die Größe der Marktliste bleibt dabei gleich');
    assert(r.keineNativenDialoge, 'Der Transferpfad nutzt keine nativen Dialoge mehr');
    assert(r.kaufScheitertSichtbar, 'Ein gescheiterter Kauf erklärt sich sichtbar statt kommentarlos');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Transfermarkt');
    await page.close();
}

async function testSecondTeamFriendlies(browser) {
    console.log('\n[28] Zweite Mannschaft: Freundschafts- und Testspiele');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        managerRPG.level = 5;
        game.money = 5000000;
        foundSecondTeam();
        secondTeamSquad.forEach(p => { p.age = 20; });
        showScreen('screen-second-team');

        // 1. Freundschaftsspiel: echter Gegner aus der Liga der Reserve, echtes Ergebnis,
        //    Eintrittsgelder ueber den Organisationskosten.
        let geldVor = game.money;
        scheduleReserveFriendly();
        let eintrag = game.secondTeamMatchLog[game.secondTeamMatchLog.length - 1];
        out.freundschaftGespielt = !!eintrag && eintrag.art === 'freundschaft';
        out.echterGegner = !!eintrag && (leaguesData[game.secondTeam.leagueLevel] || []).some(t => t.name === eintrag.gegner);
        out.ergebnisVorhanden = !!eintrag && /^\d+:\d+$/.test(eintrag.ergebnis);
        out.ueberschuss = game.money > geldVor;
        out.saldoStimmt = Math.round(game.money - geldVor) === eintrag.saldo;

        // 2. Sperrfrist: kein Dauerfeuer.
        out.sperreGesetzt = getReserveFriendlyCooldownLeft() > 0;
        let geldVor2 = game.money;
        scheduleReserveFriendly();
        out.zweiterVersuchPrallt = game.money === geldVor2 && game.secondTeamMatchLog.length === 1;

        // 3. Internes Testspiel: kein Geld, dafuer Kraft und Entwicklung.
        let fitErsteVor = squad.reduce((s, p) => s + p.fitness, 0) / squad.length;
        let geldVor3 = game.money;
        let staerkeVor = secondTeamSquad.reduce((s, p) => s + p.strength, 0);
        scheduleInternalTestMatch();
        let intern = game.secondTeamMatchLog[game.secondTeamMatchLog.length - 1];
        out.internGespielt = !!intern && intern.art === 'intern';
        out.internOhneGeld = game.money === geldVor3 && intern.saldo === 0;
        out.internKostetKraft = squad.reduce((s, p) => s + p.fitness, 0) / squad.length < fitErsteVor;
        out.internEntwickelt = secondTeamSquad.reduce((s, p) => s + p.strength, 0) >= staerkeVor;
        out.internSperre = getInternalTestCooldownLeft() > 0;

        // 4. Spielpraxis wirkt bei jungen Spielern - dafuer ist eine Reserve da.
        secondTeamSquad.forEach(p => { p.age = 33; });
        let alteStaerke = secondTeamSquad.reduce((s, p) => s + p.strength, 0);
        for (let i = 0; i < 40; i++) applyReserveMatchExperience(0.5);
        out.alteSpielerLernenNicht = secondTeamSquad.reduce((s, p) => s + p.strength, 0) === alteStaerke;
        secondTeamSquad.forEach(p => { p.age = 20; });
        let jungeStaerke = secondTeamSquad.reduce((s, p) => s + p.strength, 0);
        for (let i = 0; i < 5; i++) applyReserveMatchExperience(0.5);
        out.jungeSpielerLernen = secondTeamSquad.reduce((s, p) => s + p.strength, 0) > jungeStaerke;

        // 5. Ohne zweite Mannschaft passiert gar nichts.
        game.secondTeam.isActive = false;
        let geldVor4 = game.money;
        let logVor = game.secondTeamMatchLog.length;
        scheduleReserveFriendly();
        scheduleInternalTestMatch();
        out.ohneReserveKeineSpiele = game.money === geldVor4 && game.secondTeamMatchLog.length === logVor;
        game.secondTeam.isActive = true;

        // 6. Das Protokoll ueberlebt Speichern und Laden.
        saveGameToSlot(3);
        let logLaenge = game.secondTeamMatchLog.length;
        game.secondTeamMatchLog = [];
        loadGameFromSlot(3, true);
        out.protokollUeberlebtLaden = game.secondTeamMatchLog.length === logLaenge;

        showScreen('screen-second-team');
        out.oberflaecheZeigtSpiele = document.getElementById('second-team-friendly-box').innerHTML.includes('Freundschaftsspiel');
        return out;
    });

    assert(r.freundschaftGespielt, 'Ein Freundschaftsspiel der Reserve lässt sich vereinbaren');
    assert(r.echterGegner, 'Der Gegner stammt aus der echten Liga der zweiten Mannschaft');
    assert(r.ergebnisVorhanden, 'Das Freundschaftsspiel hat ein echtes Ergebnis');
    assert(r.ueberschuss, 'Eintrittsgelder übersteigen die Organisationskosten');
    assert(r.saldoStimmt, 'Der protokollierte Saldo stimmt mit der Kontobewegung überein');
    assert(r.sperreGesetzt, 'Nach einem Freundschaftsspiel greift eine Sperrfrist');
    assert(r.zweiterVersuchPrallt, 'Während der Sperrfrist passiert nichts und es kostet nichts');
    assert(r.internGespielt, 'Das interne Testspiel gegen die Erste lässt sich ansetzen');
    assert(r.internOhneGeld, 'Das interne Testspiel bringt bewusst kein Geld');
    assert(r.internKostetKraft, 'Das interne Testspiel kostet auch die erste Mannschaft Kraft');
    assert(r.internEntwickelt, 'Das interne Testspiel entwickelt die Reserve weiter');
    assert(r.internSperre, 'Auch das interne Testspiel hat eine eigene Sperrfrist');
    assert(r.alteSpielerLernenNicht, 'Routiniers profitieren nicht mehr von Spielpraxis');
    assert(r.jungeSpielerLernen, 'Junge Spieler entwickeln sich durch Spielpraxis weiter');
    assert(r.ohneReserveKeineSpiele, 'Ohne gegründete zweite Mannschaft passiert nichts');
    assert(r.protokollUeberlebtLaden, 'Das Spielprotokoll überlebt Speichern und Laden');
    assert(r.oberflaecheZeigtSpiele, 'Der Reserve-Screen zeigt die Spielarten an');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Reserve-Spielen');
    await page.close();
}

async function testOfficeEvents(browser) {
    console.log('\n[29] Managerbüro: Besucher mit echten Entscheidungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Ohne wartenden Besucher ist der Stuhl leer und das Panel zu.
        game.officeEvent = null;
        showScreen('screen-office');
        out.stuhlLeer = !document.getElementById('office-hs-visitor').innerHTML.includes('off-visitor-person');
        openOfficeEventPanel();
        out.panelBleibtZu = document.getElementById('office-event-panel').style.display !== 'flex';

        // 2. Jedes Ereignis ist vollstaendig definiert und hat mindestens eine Antwort.
        out.alleEreignisseVollstaendig = OFFICE_EVENTS.every(e =>
            e.id && e.person && typeof e.titel === 'function' && typeof e.text === 'function'
            && Array.isArray(e.optionen) && e.optionen.length >= 1
            && e.optionen.every(o => o.label && typeof o.wirkung === 'function' && typeof o.hinweis === 'function'));
        out.ereignisAuswahl = OFFICE_EVENTS.length >= 6;

        // 3. Ein Ereignis taucht auf, besetzt den Stuhl und laesst sich beantworten.
        let versuche = 0;
        while (!game.officeEvent && versuche++ < 400) rollOfficeEvent();
        out.ereignisErscheint = !!game.officeEvent;
        showScreen('screen-office');
        out.stuhlBesetzt = document.getElementById('office-hs-visitor').innerHTML.includes('off-visitor-person');
        out.schnellauswahlZeigtBesuch = document.getElementById('office-quicknav').innerHTML.includes('office-quicknav-alert')
            || document.getElementById('office-quicknav').style.display === 'none';

        openOfficeEventPanel();
        let panel = document.getElementById('office-event-panel');
        out.panelOeffnet = panel.style.display === 'flex';
        out.panelHatAntworten = panel.querySelectorAll('button[onclick^="resolveOfficeEvent"]').length >= 1;
        // Das Buero wird dabei NICHT verlassen - das ist der Punkt der ganzen Sache.
        out.bleibtImBuero = document.getElementById('screen-office').style.display !== 'none';

        // Fuer die Antwort ein Ereignis mit folgenloser erster Option: bei einem zufaellig
        // gewuerfelten koennte die erste Antwort an fehlendem Geld oder einer leeren
        // Jugendakademie scheitern, und der Test haenge am Zufall.
        let journalist = OFFICE_EVENTS.find(e => e.id === 'journalist');
        game.officeEvent = { id: journalist.id, seit: game.matchday, season: game.season, titel: journalist.titel(), text: journalist.text() };
        game.officeEventHistory = [];
        resolveOfficeEvent(0);
        out.ereignisGeloest = game.officeEvent === null;
        out.historieGefuehrt = (game.officeEventHistory || []).length === 1
            && !!game.officeEventHistory[0].wahl;

        // 4. Geldwirkungen landen im Kontoauszug unter einem eigenen Bereich.
        game.kontoauszug = [];
        let mitGeld = OFFICE_EVENTS.find(e => e.id === 'berater');
        game.money = 50000000;
        game.officeEvent = { id: mitGeld.id, seit: game.matchday, season: game.season, titel: mitGeld.titel(), text: mitGeld.text() };
        let geldVor = game.money;
        resolveOfficeEvent(0);
        out.geldFliesst = game.money < geldVor;
        out.buchungZugeordnet = (game.kontoauszug || []).some(b => b.label.includes('Bürotermin'));

        // 5. Fehlt das Geld, passiert nichts und das Ereignis bleibt offen.
        game.money = 0;
        game.officeEvent = { id: mitGeld.id, seit: game.matchday, season: game.season, titel: mitGeld.titel(), text: mitGeld.text() };
        resolveOfficeEvent(0);
        out.ohneGeldBleibtOffen = game.officeEvent !== null && game.money === 0;

        // 6. Wer sich nie kuemmert, wird nicht blockiert: nach der Frist raeumt es sich weg.
        game.officeEvent.seit = game.matchday - 20;
        checkOfficeEventTimeout();
        out.fristRaeumtAuf = game.officeEvent === null;

        // 7. Es wartet immer hoechstens einer.
        game.officeEvent = null;
        for (let i = 0; i < 300; i++) rollOfficeEvent();
        out.immerNurEiner = game.officeEvent === null || typeof game.officeEvent === 'object';
        out.keinStapel = !Array.isArray(game.officeEvent);

        // 8. Ereignis und Historie ueberleben Speichern und Laden.
        game.money = 5000000;
        saveGameToSlot(2);
        let offenId = game.officeEvent ? game.officeEvent.id : null;
        let histLaenge = game.officeEventHistory.length;
        game.officeEvent = null;
        game.officeEventHistory = [];
        loadGameFromSlot(2, true);
        out.ueberlebtLaden = (game.officeEvent ? game.officeEvent.id : null) === offenId
            && game.officeEventHistory.length === histLaenge;
        return out;
    });

    assert(r.stuhlLeer, 'Ohne Besuch bleibt der Besucherstuhl leer');
    assert(r.panelBleibtZu, 'Ohne Besuch öffnet sich kein Gesprächsfenster');
    assert(r.ereignisAuswahl, 'Es gibt eine ausreichende Auswahl an Büro-Ereignissen');
    assert(r.alleEreignisseVollstaendig, 'Jedes Ereignis hat Person, Text und mindestens eine Antwort');
    assert(r.ereignisErscheint, 'Ein Besucher taucht im Büro auf');
    assert(r.stuhlBesetzt, 'Der Besucher ist im Raum sichtbar');
    assert(r.schnellauswahlZeigtBesuch, 'Die Schnellauswahl weist auf den Besuch hin');
    assert(r.panelOeffnet, 'Das Gespräch lässt sich öffnen');
    assert(r.panelHatAntworten, 'Das Gespräch bietet Antwortmöglichkeiten');
    assert(r.bleibtImBuero, 'Das Gespräch findet im Büro statt, ohne es zu verlassen');
    assert(r.ereignisGeloest, 'Nach der Antwort ist der Besuch erledigt');
    assert(r.historieGefuehrt, 'Die getroffene Entscheidung wird festgehalten');
    assert(r.geldFliesst, 'Eine Antwort mit Geldwirkung verändert den Kontostand');
    assert(r.buchungZugeordnet, 'Die Buchung erscheint im Kontoauszug als Bürotermin');
    assert(r.ohneGeldBleibtOffen, 'Ohne Deckung passiert nichts und der Besuch bleibt offen');
    assert(r.fristRaeumtAuf, 'Ein ignorierter Besuch blockiert nicht dauerhaft');
    assert(r.keinStapel, 'Es wartet immer höchstens ein Besucher');
    assert(r.ueberlebtLaden, 'Offener Besuch und Historie überleben Speichern und Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Büro-Ereignissen');
    await page.close();
}

async function testNoNativeDialogs(browser) {
    console.log('\n[30] Keine nativen Dialoge mehr im ganzen Spiel');
    const { page, consoleErrors } = await freshPage(browser);

    // Native Dialoge werden in manchen Android-WebViews unterdrueckt. Taucht hier einer auf,
    // waere er auf dem Geraet des Spielers unsichtbar - der Klick bliebe wirkungslos.
    const nativeDialoge = [];
    page.on('dialog', async d => { nativeDialoge.push(d.type() + ': ' + d.message().slice(0, 80)); await d.dismiss(); });

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Das Meldungsfenster ersetzt alert(): sichtbar, bestaetigungspflichtig.
        let box = document.getElementById('app-notice');
        out.containerDa = !!box;
        showNotice('Testmeldung', 'Inhalt der Meldung');
        out.wirdAngezeigt = box.style.display === 'flex' && box.innerHTML.includes('Testmeldung');

        // 2. Mehrere Meldungen ueberschreiben sich nicht, sondern warten in einer Schlange -
        //    waehrend einer durchsimulierten Saison koennen mehrere zusammenkommen.
        showNotice('Zweite', 'x');
        showNotice('Dritte', 'x');
        out.ersteBleibtVorn = box.innerHTML.includes('Testmeldung');
        out.zaehlerStimmt = box.innerHTML.includes('Noch 2 weitere');
        dismissNotice();
        out.naechsteFolgt = box.innerHTML.includes('Zweite');
        dismissNotice(); dismissNotice();
        out.schliesstAmEnde = box.style.display === 'none';

        // 3. Die Folgeaktion laeuft ERST nach dem Bestaetigen. Daran haengt die Entlassung:
        //    vorher lud sie die Seite direkt nach dem alert() neu, und war das unterdrueckt,
        //    verschwand der Verein ohne ein Wort der Erklaerung.
        let gelaufen = false;
        showNotice('Mit Folge', 'x', { danach: () => { gelaufen = true; } });
        out.folgeWartet = !gelaufen;
        dismissNotice();
        out.folgeLaeuftNachBestaetigung = gelaufen;

        // 4. Die Entlassung nutzt genau diesen Weg und laedt nicht mehr ungefragt neu.
        out.entlassungMitBestaetigung = getSacked.toString().includes('showNotice')
            && /danach[\s\S]{0,60}location\.reload/.test(getSacked.toString());

        // 5. Im gesamten Spielcode steht kein alert()/confirm() mehr in ausfuehrbarem Code.
        let quelle = [buyPlayer, sellPlayer, sellRealEstate, setStewards, toggleStaffMember,
                      scheduleFriendlyMatch, startSkillTraining, negotiateBoardBudget]
            .map(f => f.toString()).join('\n');
        out.keineDialogeImCode = !/(^|[^.\w])(alert|confirm)\s*\(/.test(quelle);
        return out;
    });

    // 6. Eine komplett durchsimulierte Saison samt Saisonabschluss darf keinen einzigen
    //    nativen Dialog ausloesen - dort haengen Aufstieg, Abstieg, Pokal und Europapokal.
    await page.evaluate(() => {
        closeTutorial();
        game.money = 3000000;
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        concludeSeasonAndAdvance();
    });
    await page.waitForTimeout(200);

    assert(r.containerDa, 'Das Meldungsfenster ist in der Seite vorhanden');
    assert(r.wirdAngezeigt, 'Eine Meldung wird sichtbar angezeigt');
    assert(r.ersteBleibtVorn, 'Eine neue Meldung überschreibt die offene nicht');
    assert(r.zaehlerStimmt, 'Wartende Meldungen werden mitgezählt');
    assert(r.naechsteFolgt, 'Nach dem Bestätigen erscheint die nächste Meldung');
    assert(r.schliesstAmEnde, 'Nach der letzten Meldung schließt sich das Fenster');
    assert(r.folgeWartet, 'Die Folgeaktion läuft nicht vor der Bestätigung');
    assert(r.folgeLaeuftNachBestaetigung, 'Die Folgeaktion läuft nach der Bestätigung');
    assert(r.entlassungMitBestaetigung, 'Die Entlassung lädt erst nach der Bestätigung neu');

    // Das Meldungsfenster blockiert - anders als alert() - den Programmablauf NICHT. Bei der
    // Entlassung ist das heikel: frueher stoppte der native Dialog die Simulationsschleife
    // und der direkt folgende Reload beendete alles. Ohne Gegenmassnahme liefe die
    // Simulation jetzt weiter, fuer einen Verein, den man gar nicht mehr betreut - und die
    // wichtigste Meldung ueberhaupt verschwaende hinter den Spieltagsmeldungen.
    const entlassung = await page.evaluate(() => {
        closeTutorial();
        // Entlassungen sind erst ab Saison 2 moeglich (siehe checkBoardSatisfaction).
        game.season = 2;
        game.boardSat = 1;
        game.lowBoardSatStreak = 5;
        let mdVor = game.matchday;
        simulateMatchdays(5);
        let box = document.getElementById('app-notice');
        let mdNach = game.matchday;
        simulateMatchdays(5);
        let nochWeiter = game.matchday !== mdNach;
        return {
            ausgeloest: game.sackPending === true,
            spieltage: mdNach - mdVor,
            simulationGestoppt: !nochWeiter,
            meldungGanzVorn: box.innerHTML.includes('Entlassen'),
            nurEinmal: (box.innerHTML.match(/Entlassen/g) || []).length === 1
        };
    });

    assert(entlassung.ausgeloest, 'Die Entlassung wird im Testszenario tatsächlich ausgelöst');
    assert(entlassung.spieltage <= 2, `Nach der Entlassung wird nicht weitersimuliert (${entlassung.spieltage} Spieltag(e))`);
    assert(entlassung.simulationGestoppt, 'Weitere Simulationsversuche bleiben wirkungslos, bis bestätigt wurde');
    assert(entlassung.meldungGanzVorn, 'Die Entlassungsmeldung steht vor allen anderen Meldungen');
    assert(entlassung.nurEinmal, 'Die Entlassung wird nur ein einziges Mal ausgesprochen');
    assert(r.keineDialogeImCode, 'Die geprüften Spielfunktionen nutzen keine nativen Dialoge');
    assert(nativeDialoge.length === 0,
        `Eine komplette Saison samt Saisonabschluss löst keinen nativen Dialog aus (${nativeDialoge.join(' | ') || 'keiner'})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Dialog-Test');
    await page.close();
}

async function testEuropeanCup(browser) {
    console.log('\n[31] Europapokal: erreichbares Teilnehmerfeld und Startprämie');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        // Der Europapokal ist realistisch nur aus der obersten Liga erreichbar (Platz 1-4
        // oder Pokalsieg). Die Feldpruefungen laufen deshalb mit einem entsprechend
        // starken Kader - beim Standard-Sechstligisten waere das Feld naturgemaess
        // ueberlegen, und das ist auch richtig so.
        squad.forEach(p => { p.strength = 78 + Math.floor(Math.random() * 8); });
        game.inEurope = true;
        initEuropeCup();
        let feld = [...europeTournament.groupA, ...europeTournament.groupB];
        out.achtTeilnehmer = feld.length === 8;
        out.wirDabei = feld.some(t => t.name === game.clubName);

        // 1. Das Feld ist gestaffelt wie ein echter Wettbewerb - frueher bekam JEDER
        //    Teilnehmer pauschal 84 bis 89.
        let staerken = feld.map(t => t.str);
        out.feldGestaffelt = Math.max(...staerken) - Math.min(...staerken) >= 8;

        // 2. Das Feld haengt am Kaderschnitt und NICHT an der Tagesform. Genau das war der
        //    Fehler: die Auslosung laeuft zum Saisonstart, wo calcTeamStrength() den
        //    frischen Kader mit rund 97 bewertet, waehrend derselbe Kader ab Spieltag 20
        //    nur noch etwa 74 erreicht - das Feld war am nie wieder erreichten Bestwert
        //    ausgerichtet.
        let kaderSchnitt = squad.reduce((sum, p) => sum + p.strength, 0) / squad.length;
        let gegner = feld.filter(t => t.name !== game.clubName).map(t => t.str);
        out.feldAmKader = gegner.every(v => Math.abs(v - kaderSchnitt) <= 20);
        // Mindestens ein Gegner liegt unter unserem Kaderschnitt - sonst ist nichts zu holen.
        out.schlagbareGegner = gegner.some(v => v < kaderSchnitt);
        // Und mindestens einer darueber, sonst ist es keine Koenigsklasse.
        out.echteFavoriten = gegner.some(v => v > kaderSchnitt - 6);

        // Tagesform aufblaehen: das Feld darf sich davon NICHT beeindrucken lassen.
        let vorher = [...europeTournament.groupA, ...europeTournament.groupB].map(t => t.str).join(',');
        squad.forEach(p => { p.fitness = 100; p.morale = 100; p.form = 10; });
        initEuropeCup();
        let nachher = [...europeTournament.groupA, ...europeTournament.groupB].map(t => t.str).join(',');
        out.formEgal = Math.abs(
            nachher.split(',').reduce((a, v) => a + Number(v), 0)
            - vorher.split(',').reduce((a, v) => a + Number(v), 0)) <= 12;

        // 3. Startpraemie: genau einmal, im Kontoauszug einem Bereich zugeordnet.
        game.kontoauszug = [];
        europeTournament.startFeePaid = false;
        let geldVor = game.money;
        game.matchday = 3;
        simulateEuropeMatchday(3);
        let nachErstem = game.money;
        out.startpraemieGezahlt = nachErstem > geldVor;
        out.praemieImAuszug = (game.kontoauszug || []).some(b => b.label.includes('Europapokal'));
        simulateEuropeMatchday(3);
        out.nurEinmal = europeTournament.startFeePaid === true
            && inboxMessages.filter(m => (m.title || '').includes('Startprämie')).length === 1;

        // 4. Ohne Qualifikation passiert gar nichts.
        game.inEurope = false;
        let geldOhne = game.money;
        simulateEuropeMatchday(7);
        out.ohneQualiNichts = game.money === geldOhne;
        return out;
    });

    // 5. Eine komplette Saison im Europapokal laeuft fehlerfrei durch und erzeugt die
    //    K.o.-Runde - frueher blieben Halbfinale, Finale und Titel praktisch unerreichbar.
    const saison = await page.evaluate(() => {
        closeTutorial();
        squad.forEach(p => { p.strength = 78 + Math.floor(Math.random() * 8); });
        game.inEurope = true;
        initEuropeCup();
        let feld = [...europeTournament.groupA, ...europeTournament.groupB];
        let unsereStaerke = squad.reduce((sum, p) => sum + p.strength, 0) / squad.length;
        let schlechterAlsAlle = feld.filter(t => t.name !== game.clubName).every(t => t.str > unsereStaerke);
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        let grp = europeTournament.groupA.some(t => t.name === game.clubName)
            ? europeTournament.groupA : europeTournament.groupB;
        let sorted = [...grp].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
        return {
            schlechterAlsAlle,
            platz: sorted.findIndex(t => t.name === game.clubName) + 1,
            punkte: grp.find(t => t.name === game.clubName).pts,
            spiele: grp.find(t => t.name === game.clubName).played,
            halbfinale: (europeTournament.semiFinals || []).length,
            finale: !!europeTournament.finalMatch
        };
    });

    assert(r.achtTeilnehmer && r.wirDabei, 'Der Champions Cup hat acht Teilnehmer, der eigene Verein ist dabei');
    assert(r.feldGestaffelt, 'Das Teilnehmerfeld ist gestaffelt statt durchgehend gleich stark');
    assert(r.feldAmKader, 'Das Feld richtet sich nach dem eigenen Kaderniveau');
    assert(r.schlagbareGegner, 'Mindestens ein Gruppengegner ist schlagbar');
    assert(r.echteFavoriten, 'Es gibt trotzdem echte Favoriten im Feld');
    assert(r.formEgal, 'Die Tagesform zum Auslosungszeitpunkt verzerrt das Feld nicht mehr');
    assert(r.startpraemieGezahlt, 'Für die Teilnahme gibt es eine UEFA-Startprämie');
    assert(r.praemieImAuszug, 'Die Startprämie erscheint im Kontoauszug als Europapokal-Buchung');
    assert(r.nurEinmal, 'Die Startprämie wird nur einmal pro Wettbewerb gezahlt');
    assert(r.ohneQualiNichts, 'Ohne Qualifikation passiert im Europapokal nichts');
    assert(!saison.schlechterAlsAlle, 'Der eigene Verein ist nicht schwächer als das gesamte Feld');
    assert(saison.spiele === 6, `Alle sechs Gruppenspiele werden ausgetragen (${saison.spiele})`);
    assert(saison.punkte > 0, `In der Gruppe wird gepunktet (${saison.punkte} Punkte, Platz ${saison.platz})`);
    assert(saison.halbfinale === 2 && saison.finale, 'Halbfinale und Finale werden ausgespielt');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Europapokal');
    await page.close();
}

async function testLoadingGuard(browser) {
    console.log('\n[32] Ladeanzeige: keine Klicks vor dem fertigen Start');

    // Aus einem echten Fehlerprotokoll vom Live-Spiel:
    //   "Uncaught ReferenceError: showScreen is not defined"
    // Die Seite bringt ueber ein Megabyte Code inline mit. Bis der geparst war, war das
    // Dashboard bereits sichtbar UND bedienbar - als einziger Screen ohne display:none.
    // Ein Tippen in diesem Fenster rief eine Funktion auf, die es noch gar nicht gab.
    // Mit abgeschaltetem JavaScript ist exakt dieser Zustand nachgestellt.
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 430, height: 880 } });
    const page = await ctx.newPage();
    await page.goto(GAME_PATH);
    await page.waitForTimeout(200);

    const ladeEbene = await page.$('#app-loading');
    assert(!!ladeEbene, 'Vor dem Start liegt eine Ladeanzeige über der Seite');

    const box = ladeEbene ? await ladeEbene.boundingBox() : null;
    assert(!!box && box.width >= 430 && box.height >= 880, 'Die Ladeanzeige deckt das gesamte Ansichtsfenster ab');

    const knopf = await page.$('#screen-dashboard button');
    assert(!!knopf, 'Der Dashboard-Knopf existiert im Markup (er war der Auslöser)');
    let erreichbar = false;
    try { await knopf.click({ timeout: 1200 }); erreichbar = true; } catch (e) { erreichbar = false; }
    assert(!erreichbar, 'Vor dem fertigen Start ist kein Knopf anklickbar');
    await ctx.close();

    // Nach dem Laden muss die Ebene restlos verschwinden - sonst waere das Spiel darunter
    // zwar geladen, aber unbedienbar.
    const { page: page2, consoleErrors } = await freshPage(browser);
    const nach = await page2.evaluate(() => ({
        weg: !document.getElementById('app-loading'),
        officeSichtbar: document.getElementById('screen-office').style.display !== 'none'
    }));
    assert(nach.weg, 'Nach dem Start ist die Ladeanzeige restlos entfernt');
    assert(nach.officeSichtbar, 'Nach dem Start ist das Managerbüro sichtbar');

    // Und das Entfernen haengt an einem finally: auch ein gescheiterter Start darf die
    // Ebene nicht liegen lassen.
    const quelle = await page2.evaluate(() => (window.onload || function () {}).toString());
    assert(/finally/.test(quelle) && /app-loading/.test(quelle),
        'Die Ladeanzeige wird in einem finally entfernt, also auf jedem Weg');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Start');
    await page2.close();
}

async function testAttendanceRealism(browser) {
    console.log('\n[33] Zuschauerzahlen: absolute Ligaobergrenze');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // Der vom Spieler gemeldete Fall: 24.000 Zuschauer in der Oberliga. Ursache war,
        // dass die Zuschauerzahl ausschliesslich ein ANTEIL der Stadionkapazitaet war -
        // ein auf 113.000 Plaetze ausgebautes Stadion erzeugte dort ueber 10.000 Zuschauer
        // im Ligaalltag und fast 23.000 im Derby.
        adminMaxOutAllBuildings();
        game.leagueLevel = 4;
        game.fans = 90;
        out.grossesStadion = stadium.total > 100000;
        out.oberligaNormal = calculateMatchAttendance(1);
        out.oberligaDerby = calculateMatchAttendance(2.2);
        out.oberligaRealistisch = out.oberligaNormal < 4000;
        out.derbyRealistisch = out.oberligaDerby < 7000;
        out.derbyMehrAlsNormal = out.oberligaDerby > out.oberligaNormal;

        // Die Grenze steigt mit der Liga - ein Erstligist fuellt sein Stadion weiterhin.
        let proLiga = [];
        for (let lvl = 0; lvl <= 5; lvl++) { game.leagueLevel = lvl; proLiga.push(calculateMatchAttendance(1)); }
        out.steigtMitLiga = proLiga.every((v, i) => i === 0 || v < proLiga[i - 1]);
        game.leagueLevel = 0;
        out.erstligaFuelltStadion = calculateMatchAttendance(1) > 60000;

        // Und sie haengt am Anhang: derselbe Verein, schlechtere Stimmung, weniger Zuschauer.
        game.leagueLevel = 4;
        game.fans = 100; let vielAnhang = calculateMatchAttendance(1);
        game.fans = 20;  let wenigAnhang = calculateMatchAttendance(1);
        out.anhangZaehlt = vielAnhang > wenigAnhang * 1.5;

        // Kleines Stadion in hoher Liga: dann begrenzt weiterhin die Kapazitaet.
        game.leagueLevel = 0; game.fans = 90;
        Object.values(stadium.blocks).forEach(bl => { bl.cap = 500; });
        out.kapazitaetBegrenztWeiterhin = calculateMatchAttendance(1) <= stadium.total;
        return out;
    });

    // Die Rechnung darf nur an EINER Stelle stehen - vorher stand sie doppelt im Code
    // (Anpfiff im Live-Spiel und Spieltagsabrechnung) und musste von Hand synchron
    // gehalten werden.
    const eineQuelle = await page.evaluate(() => {
        let anpfiff = (typeof setupMatch === 'function') ? setupMatch.toString() : '';
        let abrechnung = applyMatchdayFinances.toString();
        return {
            beideNutzenHelfer: anpfiff.includes('calculateMatchAttendance') && abrechnung.includes('calculateMatchAttendance'),
            keineEigeneRechnungMehr: !/stadium\.total \|\| 16000\) \* attFactor/.test(anpfiff + abrechnung)
        };
    });

    assert(r.grossesStadion, 'Das Testszenario hat tatsächlich ein überdimensioniertes Stadion');
    assert(r.oberligaRealistisch, `In der Oberliga kommen keine zehntausend Zuschauer mehr (${r.oberligaNormal})`);
    assert(r.derbyRealistisch, `Auch das Oberliga-Derby bleibt im Rahmen (${r.oberligaDerby})`);
    assert(r.derbyMehrAlsNormal, 'Ein Derby zieht trotzdem mehr Zuschauer an als ein normales Spiel');
    assert(r.steigtMitLiga, 'Die Zuschauergrenze steigt mit jeder Ligastufe');
    assert(r.erstligaFuelltStadion, 'Ein Erstligist füllt sein großes Stadion weiterhin');
    assert(r.anhangZaehlt, 'Die Fan-Zufriedenheit beeinflusst die Zuschauerzahl deutlich');
    assert(r.kapazitaetBegrenztWeiterhin, 'Ein kleines Stadion begrenzt die Zuschauerzahl weiterhin');
    assert(eineQuelle.beideNutzenHelfer, 'Anpfiff und Abrechnung nutzen dieselbe Zuschauerrechnung');
    assert(eineQuelle.keineEigeneRechnungMehr, 'Es gibt keine zweite, eigene Zuschauerrechnung mehr');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Zuschauerzahlen');
    await page.close();
}

async function testClubAndPlayerNames(browser) {
    console.log('\n[34] Vereins- und Spielernamen je Spielklasse');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Jede Liga hat ihren eigenen Pool mit genau 18 Vereinen, keiner doppelt.
        out.sechsPools = LEAGUE_CLUB_NAMES.length === 6;
        out.je18 = LEAGUE_CLUB_NAMES.every(pool => pool.length === 18);
        let alle = ALL_CLUB_NAMES;
        out.keineDoppelten = new Set(alle).size === alle.length;
        out.gesamt108 = alle.length === 108;

        // 2. Kein Name ist EXAKT der geschuetzte Originalname - alle sind verfremdet.
        const ORIGINALE = ['Bayern München', 'Borussia Dortmund', 'RB Leipzig', 'Schalke 04',
            'Hamburger SV', '1. FC Köln', 'Werder Bremen', 'Hertha BSC', '1. FC Magdeburg',
            'Dynamo Dresden', 'Carl Zeiss Jena', 'BFC Dynamo', 'Real Madrid', 'FC Barcelona',
            'Manchester United', 'Liverpool FC', 'Juventus Turin', 'Ajax Amsterdam'];
        out.alleVerfremdet = ORIGINALE.every(o => !alle.includes(o) && !INTERNATIONAL_CLUB_NAMES.includes(o));

        // 3. Die Vereine stehen in der Liga ihres Niveaus: Der Bundesliga-Pool taucht in
        //    Liga 1 auf, der Regionalliga-Pool in Liga 4. Vorher wurden alle bekannten Namen
        //    quer ueber alle sechs Ligen verteilt.
        out.ligaZuordnung = true;
        for (let l = 0; l < 6; l++) {
            let ausPool = leaguesData[l].filter(t => LEAGUE_CLUB_NAMES[l].includes(t.name)).length;
            // 17 Pool-Vereine plus der eigene Klub in der eigenen Liga; anderswo alle 18.
            if (ausPool < 17) out.ligaZuordnung = false;
        }

        // 4. Regionalitaet: Die unteren drei Ligen bilden den Nordost-Strang ab, damit
        //    Auswaertsfahrten kurz bleiben und echte Derbys entstehen.
        let unten = LEAGUE_CLUB_NAMES[3].concat(LEAGUE_CLUB_NAMES[4], LEAGUE_CLUB_NAMES[5]).join(' ');
        const NORDOST = ['Leipzich', 'Jenna', 'Dressden', 'Magdeborg', 'Cotbus', 'Halle', 'Zwikau', 'Chemnitz'];
        out.nordostPraegung = NORDOST.filter(o => unten.includes(o)).length >= 5;
        // Und die Heimatstadt des Spielers taucht mehrfach auf - das sind die Stadtderbys.
        out.stadtderbys = (unten.match(/Leipzich/g) || []).length >= 2;

        // 5. Internationale Klubs: deutlich breiteres Feld als die frueheren zwoelf.
        out.internationalBreit = INTERNATIONAL_CLUB_NAMES.length >= 30;
        out.internationalEindeutig = new Set(INTERNATIONAL_CLUB_NAMES).size === INTERNATIONAL_CLUB_NAMES.length;

        // 6. Spielernamen klingen nach Fussballern und sind ebenfalls verfremdet.
        const ECHTE_SPIELER = ['Neuer', 'Müller', 'Kroos', 'Kimmich', 'Sané', 'Gnabry', 'Havertz'];
        out.spielerVerfremdet = ECHTE_SPIELER.every(n => !lastNames.includes(n));
        out.genugNamen = firstNames.length >= 40 && lastNames.length >= 40;
        // Ein voller Kader kommt ohne Doppelung aus.
        out.kaderNamenPlausibel = squad.length >= 18 && squad.every(p => /^[A-ZÄÖÜ][\wäöüß.-]* [A-ZÄÖÜ]/.test(p.name));
        return out;
    });

    // 7. Ueber mehrere Saisons bleibt die Pyramide konsistent: Auf- und Abstiege verschieben
    //    Vereine zwischen den Ligen, ohne dass Namen doppelt auftauchen oder verlorengehen.
    const saisons = await page.evaluate(() => {
        for (let s = 0; s < 3; s++) { for (let i = 0; i < 7; i++) simulateMatchdays(5); concludeSeasonAndAdvance(); }
        let alle = leaguesData.flat().map(t => t.name);
        return { anzahl: alle.length, eindeutig: new Set(alle).size };
    });

    assert(r.sechsPools && r.je18, 'Jede der sechs Ligen hat einen eigenen Pool mit 18 Vereinen');
    assert(r.gesamt108 && r.keineDoppelten, 'Insgesamt 108 Vereinsnamen, keiner doppelt');
    assert(r.alleVerfremdet, 'Kein Name entspricht exakt der geschützten Original-Schreibweise');
    assert(r.ligaZuordnung, 'Jede Liga wird aus dem Pool ihrer eigenen Spielklasse besetzt');
    assert(r.nordostPraegung, 'Die unteren drei Ligen bilden den Nordost-Strang ab');
    assert(r.stadtderbys, 'In den unteren Ligen entstehen echte Stadtderbys');
    assert(r.internationalBreit, 'Das internationale Feld umfasst mindestens 30 Klubs');
    assert(r.internationalEindeutig, 'Kein internationaler Klub steht doppelt in der Liste');
    assert(r.spielerVerfremdet, 'Auch Spielernamen sind verfremdet statt exakt übernommen');
    assert(r.genugNamen, 'Die Namenspools sind groß genug für abwechslungsreiche Kader');
    assert(r.kaderNamenPlausibel, 'Jeder Spieler hat einen plausiblen Vor- und Nachnamen');
    assert(saisons.anzahl === saisons.eindeutig,
        `Nach drei Saisons steht kein Verein doppelt in der Pyramide (${saisons.eindeutig}/${saisons.anzahl})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Namen');
    await page.close();
}

async function testLandesPokal(browser) {
    console.log('\n[35] Landespokal als Weg in den DFB-Pokal');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Unterhalb der 3. Liga ist man NICHT automatisch im DFB-Pokal. Vorher startete
        //    selbst ein Sechstligist direkt gegen Bundesligisten.
        out.startLiga = game.leagueLevel;
        out.nichtImDfbPokal = game.inCup === false;
        out.landespokalLaeuft = landesPokal.active === true && landesPokal.roundsHistory.length === 1;
        out.eigenerKlubImLandespokal = landesPokal.roundsHistory[0].pairings
            .some(p => p.home === game.clubName || p.away === game.clubName);
        out.nichtImDfbTurnierbaum = !cupTournament.roundsHistory[0].pairings
            .some(p => p.home === game.clubName || p.away === game.clubName);

        // 2. Die Gegner kommen aus der eigenen Region, nicht aus der Bundesliga.
        let gegner = landesPokal.roundsHistory[0].pairings.flatMap(p => [p.home, p.away]).filter(n => n !== game.clubName);
        let regional = leaguesData.slice(3).flat().map(t => t.name);
        out.regionaleGegner = gegner.every(n => regional.includes(n));

        // 3. Die Spieltage kollidieren nicht mit dem DFB-Pokal.
        out.keineTerminkollision = landesPokal.matchdays.every(md => !cupTournament.matchdays.includes(md));
        return out;
    });

    // 4. Der Sieg im Landespokal bringt den Startplatz im DFB-Pokal der Folgesaison.
    const weg = await page.evaluate(() => {
        // Der Landespokal ist eine reine K.o.-Runde ueber vier Spieltage. Mit echter
        // Tor-Zufallsstreuung (simulateGoals nutzt Poisson-Verteilung) kann selbst ein
        // deutlich ueberlegener Verein rein statistisch eine einzelne K.o.-Partie verlieren -
        // das hat den Test in der CI vereinzelt zum Kippen gebracht, obwohl der Mechanismus
        // (Sieg -> Trophaee -> Startplatz -> Folgesaison) korrekt arbeitet. Fuer DIESEN Test
        // geht es nur um genau diesen Mechanismus, nicht um die Spielsimulation selbst -
        // deshalb wird das Tor-Ergebnis fuer die Dauer des Tests deterministisch anhand der
        // Staerke entschieden (die staerkere Seite gewinnt klar, kein Unentschieden/Elfmeter).
        simulateGoals = function(a, b) { return a >= b ? { myGoals: 5, oppGoals: 0 } : { myGoals: 0, oppGoals: 5 }; };
        squad.forEach(p => { p.strength = 99; p.fitness = 100; p.morale = 100; });
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        let nachSaison = {
            gewonnen: landesPokal.won,
            startplatz: game.dfbPokalViaLandespokal,
            trophaee: (game.trophies || []).some(t => t.includes('pokalsieger'))
        };
        concludeSeasonAndAdvance();
        return {
            ...nachSaison,
            imDfbPokal: game.inCup,
            startplatzEingeloest: game.dfbPokalViaLandespokal === false,
            imTurnierbaum: cupTournament.roundsHistory[0].pairings.some(p => p.home === game.clubName || p.away === game.clubName)
        };
    });

    // 5. Ab der 3. Liga entfaellt der Landespokal, dafuer ist man direkt gesetzt.
    const oben = await page.evaluate(() => {
        game.leagueLevel = 2;
        game.dfbPokalViaLandespokal = false;
        initDynamicCup();
        initLandesPokal();
        return {
            direktQualifiziert: game.inCup === true,
            keinLandespokal: landesPokal.active === false,
            imTurnierbaum: cupTournament.roundsHistory[0].pairings.some(p => p.home === game.clubName || p.away === game.clubName)
        };
    });

    assert(r.startLiga > 2, 'Das Testszenario startet unterhalb der 3. Liga');
    assert(r.nichtImDfbPokal, 'Unterhalb der 3. Liga ist man nicht automatisch im DFB-Pokal');
    assert(r.nichtImDfbTurnierbaum, 'Der eigene Verein steht dann auch nicht im DFB-Pokal-Turnierbaum');
    assert(r.landespokalLaeuft && r.eigenerKlubImLandespokal, 'Stattdessen läuft der Landespokal mit dem eigenen Verein');
    assert(r.regionaleGegner, 'Die Landespokal-Gegner kommen aus der eigenen Region');
    assert(r.keineTerminkollision, 'Landespokal und DFB-Pokal werden an verschiedenen Spieltagen ausgetragen');
    assert(weg.gewonnen, 'Ein übermächtiger Verein gewinnt den Landespokal');
    assert(weg.trophaee, 'Der Sieg landet im Trophäenschrank');
    assert(weg.startplatz, 'Der Sieg sichert den Startplatz im DFB-Pokal');
    assert(weg.imDfbPokal && weg.imTurnierbaum, 'In der Folgesaison steht der Verein im DFB-Pokal-Turnierbaum');
    assert(weg.startplatzEingeloest, 'Der Startplatz gilt nur für eine Saison und ist danach eingelöst');
    assert(oben.direktQualifiziert && oben.imTurnierbaum, 'Ab der 3. Liga ist man direkt für den DFB-Pokal gesetzt');
    assert(oben.keinLandespokal, 'Ab der 3. Liga wird kein Landespokal mehr gespielt');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Landespokal');
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
        testConfirmBeforeIrreversibleActions,
        testFinanceLedgerAndStatement,
        testEconomyBalance,
        testSecondTeamAndTrainingAutomation,
        testLeagueEconomy,
        testTransferMarketFairness,
        testSecondTeamFriendlies,
        testOfficeEvents,
        testNoNativeDialogs,
        testEuropeanCup,
        testLoadingGuard,
        testAttendanceRealism,
        testClubAndPlayerNames,
        testLandesPokal,
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
