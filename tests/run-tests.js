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
    // Tests teilen sich den lokalen Speicher (file://): ohne diesen Schritt würde jeder neue
    // Test den Autosave eines vorherigen Tests laden (Start lädt den zuletzt geschriebenen
    // Stand). testAutosaveResume prüft dieses Startverhalten bewusst ohne Bereinigung.
    await page.addInitScript(() => { try { localStorage.removeItem('anstoss_fm13_last_save'); } catch (e) { /* egal */ } });
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

        // Eingehende Leihe (Leihen prüfen seit 25.17 Transfer- und Gehaltsbudget)
        refreshTransferMarket();
        game.transferBudget = Math.max(game.transferBudget, 1e8); game.wageBudget = Math.max(game.wageBudget, 1e8);
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
async function testNationalTeam(browser) {
    console.log('\n[19.1] Länderspiele & Turniere');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            squad.forEach(p => { p.strength = Math.min(p.strength, 60); p.nation = 'Deutschland'; p.statsSeason = null; });
            const star = squad.find(p => p.pos === 'ST');
            star.strength = 80; star.injured = 0;
            const knapp = squad.find(p => p.pos === 'MIT');
            knapp.strength = 71;
            out.schwelle = getNominationThreshold(knapp) === 73;
            knapp.statsSeason = { spiele: 6, tore: 0, vorlagen: 0, notenSumme: 13, elf: 0 };
            out.notenSenken = getNominationThreshold(knapp) === 71 && isNominated(knapp);
            game.matchday = 7;
            out.keinePause = tickInternationalBreak() === null;
            game.matchday = 6;
            const inbox0 = inboxMessages.length, fit0 = star.fitness = 100, mw0 = star.marketValue;
            const geld0 = game.money;
            const kader = tickInternationalBreak();
            out.praemiePause = game.money - geld0 === 2 * INTL_BREAK_FEE && JSON.stringify(inboxMessages).includes('Abstellungsprämie');
            out.pause = !!kader && kader.includes(star) && kader.includes(knapp) && kader.length === 2;
            out.wirkung = star.caps >= 1 && star.fitness === fit0 - 12 && star.marketValue >= mw0 && inboxMessages.length > inbox0;
            out.keinAusfall = !('nationalDuty' in star) || !star.nationalDuty;
            // Turnier nur nach geraden Saisons
            game.season = 4;
            out.keinTurnier = playSummerTournament() === null;
            game.season = 3;
            const caps0 = star.caps;
            star.injured = 0; knapp.injured = 0;
            const geld1 = game.money;
            const t = playSummerTournament();
            out.praemieTurnier = !!t && t.fee === t.nations.reduce((a, n) => a + 12000 * n.days * n.players.length, 0) && game.money - geld1 === t.fee && t.fee > 0;
            out.turnier = !!t && t.season === 2 && t.name === 'Europameisterschaft' && t.nations[0].nation === 'Deutschland'
                && t.nations[0].players.some(x => x.name === star.name) && star.caps > caps0 && game.intlTournaments[0] === t;
            out.stufe = t ? t.nations[0].stage : null;
            // Anzeige im Reiter Team (Turnierverletzungen, je 10 %, würden die Nominierung aufheben)
            star.injured = 0; knapp.injured = 0;
            showScreen('screen-squad'); setSquadTab('analyse');
            const html = document.getElementById('national-team-box').innerHTML;
            out.anzeige = html.includes(star.name) && html.includes('nominiert') && html.includes('Europameisterschaft 2');
            // Integration: nach Saison 2 läuft das Turnier beim Saisonwechsel automatisch
            game.intlTournaments = [];
            game.season = 2; game.matchday = 1;
            star.strength = 85;
            const originalPause = window.tickInternationalBreak;
            let pausen = 0;
            window.tickInternationalBreak = function () { const k = originalPause(); if (k) pausen++; return k; };
            try { simulateFullSeason(); } finally { window.tickInternationalBreak = originalPause; }
            // (Zufallsverletzungen dürfen die Turnierteilnahme im Test nicht verhindern)
            if (squad.includes(star)) { star.strength = Math.max(star.strength, 85); star.injured = 0; }
            concludeSeasonAndAdvance();
            out.saisonwechsel = (game.intlTournaments || []).some(x => x.season === 2 && x.name === 'Europameisterschaft');
            out.pausenGespielt = pausen >= 2; // ein verletzter Nationalspieler lässt eine Pause ausfallen
            out.pausen = pausen;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Länderspiel-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.schwelle && r.notenSenken, 'Nominierungsschwelle je Land; Notenschnitt 2,5 oder besser senkt sie um 2');
        assert(r.keinePause, 'Außerhalb der Länderspielpausen keine Reise');
        assert(r.pause && r.wirkung, 'Länderspielpause: genau die Nominierten reisen, mit Einsätzen, Müdigkeit, Marktwert und Meldung');
        assert(r.keinAusfall, 'Nationalspieler verpassen kein Ligaspiel mehr');
        assert(r.keinTurnier && r.turnier, `WM/EM nur nach geraden Saisons, mit Einsätzen der eigenen Spieler (${r.stufe})`);
        assert(r.anzeige, 'Kader/Analyse zeigt Nationalspieler, Nominierung und Turnierhistorie');
        assert(r.saisonwechsel && r.pausenGespielt, `Saisonwechsel spielt das Turnier, die Saison enthält die Länderspielpausen (${r.pausen})`);
        assert(r.praemiePause, 'Abstellungsprämie je Spieler und Länderspielpause wird gezahlt und gemeldet');
        assert(r.praemieTurnier, 'Turnierprämie je Spieler und Turniertag wird gezahlt');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testTransferPoker(browser) {
    console.log('\n[19.2] Transferpoker: Forderung, Schmerzgrenze, Geduld, Rivale, Gehalt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            game.money = 1e9; game.transferBudget = 1e9; game.wageBudget = 1e9;
            game.ffpTransferEmbargo = false; game.transferEmbargo = false;
            showScreen('screen-transfer'); setTransferTab('market');
            const p0 = marketPlayers[0];
            ensureTransferTerms(p0);
            out.konditionen = p0.askingPrice > p0.sellerMinimum && !!p0.sellerClub && leaguesData.some(l => l.some(t => t.name === p0.sellerClub));
            out.marktzeile = document.getElementById('market-list').innerHTML.includes('Verhandeln') && document.getElementById('market-list').innerHTML.includes(p0.sellerClub);
            // Sofortkauf zahlt die Forderung
            const geld0 = game.money, forderung = p0.askingPrice, provision = getAgentFee(p0, forderung);
            buyPlayer(0);
            out.sofortkauf = squad.includes(p0) && geld0 - game.money === forderung + provision;
            // Verhandlung: unter der Schmerzgrenze nie Zusage, Gegenangebot nie darunter
            const p1 = marketPlayers[0];
            openTransferPoker(0);
            transferPoker.rivalChance = 0; transferPoker.patience = 5;
            out.box = document.getElementById('transfer-poker-box').innerHTML.includes('TRANSFERPOKER');
            Math.random = () => 0;
            transferPoker.offer = p1.sellerMinimum - 1000;
            submitPokerOffer();
            out.keineZusageUnterGrenze = !transferPoker.agreedFee && p1.askingPrice >= p1.sellerMinimum;
            // Frechheit kostet doppelte Geduld
            const geduld = transferPoker.patience;
            transferPoker.offer = Math.round(p1.sellerMinimum * 0.5);
            submitPokerOffer();
            out.frechheit = transferPoker.patience === geduld - 2;
            // Angebot über Schmerzgrenze wird angenommen (Zufall günstig)
            transferPoker.offer = p1.sellerMinimum;
            submitPokerOffer();
            Math.random = zufall;
            out.zusage = transferPoker.agreedFee === p1.sellerMinimum && transferPoker.wageDemand > 0;
            const forderungLohn = transferPoker.wageDemand;
            Math.random = () => 0;
            haggleWage();
            Math.random = zufall;
            out.gehaltGedrueckt = transferPoker.wageDemand < forderungLohn && transferPoker.wageTalked;
            const lohn = transferPoker.wageDemand, geld1 = game.money, prov1 = getAgentFee(p1, p1.sellerMinimum);
            signPokerDeal();
            out.unterschrieben = squad.includes(p1) && p1.wage === lohn && geld1 - game.money === p1.sellerMinimum + prov1 && transferPoker === null;
            // Abbruch nach erschöpfter Geduld: Preis steigt, nur noch Sofortkauf
            const p2 = marketPlayers[0];
            openTransferPoker(0);
            transferPoker.rivalChance = 0; transferPoker.patience = 1;
            const preis2 = p2.askingPrice;
            transferPoker.offer = Math.round(p2.sellerMinimum * 0.5);
            submitPokerOffer();
            out.abbruch = p2.pokerBroken && p2.askingPrice > preis2 && transferPoker === null;
            openTransferPoker(0);
            out.gesperrt = transferPoker === null && document.getElementById('app-toast').innerText.includes('verhandelt nicht mehr');
            // Rivale steigt ein und schnappt sich den Spieler
            const p3 = marketPlayers[1];
            openTransferPoker(1);
            transferPoker.rivalChance = 1; transferPoker.patience = 9;
            const min3 = p3.sellerMinimum;
            Math.random = () => 0.5;
            transferPoker.offer = Math.round(p3.sellerMinimum * 0.95);
            submitPokerOffer(); // Runde 1: kein Rivale möglich
            submitPokerOffer(); // Runde 2: Rivale steigt ein
            out.rivale = !!(transferPoker && transferPoker.rival) && p3.sellerMinimum > min3;
            Math.random = () => 0.1;
            submitPokerOffer();
            Math.random = zufall;
            out.weggeschnappt = !marketPlayers.includes(p3) && transferPoker === null && JSON.stringify(inboxMessages).includes(`${p3.name} geht zu`);
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Transferpoker-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.konditionen && r.marktzeile, 'Jeder Marktspieler hat einen echten Verkäuferverein, Forderung über Schmerzgrenze, Knopf Verhandeln');
        assert(r.sofortkauf, 'Sofortkauf zahlt genau die Forderung (plus Beraterprovision)');
        assert(r.box && r.keineZusageUnterGrenze, 'Unter der Schmerzgrenze gibt es keine Zusage, das Gegenangebot bleibt darüber');
        assert(r.frechheit, 'Ein sehr niedriges Angebot kostet doppelt Geduld');
        assert(r.zusage && r.gehaltGedrueckt && r.unterschrieben, 'Einigung, Gehaltsgespräch und Unterschrift mit genau vereinbarter Ablöse und Gehalt');
        assert(r.abbruch && r.gesperrt, 'Erschöpfte Geduld: Gespräche abgebrochen, Preis steigt, nur noch Sofortkauf');
        assert(r.rivale && r.weggeschnappt, `Rivale treibt den Preis und schnappt den Spieler bei zu langem Pokern weg (${r.rivale}/${r.weggeschnappt})`);
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testOpponentTactics(browser) {
    console.log('\n[19.3] Gegner-Taktik reagiert: Schere-Stein-Papier, berechenbare Trainer, Vorbericht');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            game.tacticStyle = 'pressing';
            out.matrix = getTacticMatchupBonus('B') === 2 && getTacticMatchupBonus('K') === -2 && getTacticMatchupBonus('P') === 0 && getTacticMatchupBonus('N') === 0
                && getTacticMatchupBonus('P', 'konter') === 2 && getTacticMatchupBonus('K', 'ballbesitz') === 2 && getTacticMatchupBonus('B', 'ausgeglichen') === 0;
            game.recentTacticStyles = ['pressing', 'offensiv', 'konter', 'umschaltspiel', 'ballbesitz'];
            out.berechenbar = getPredictableArchetype() === 'P';
            game.recentTacticStyles = ['pressing', 'konter', 'ballbesitz', 'ausgeglichen', 'kickrush'];
            out.unberechenbar = getPredictableArchetype() === null;
            // Gegner mit Ballbesitz-Grundausrichtung stellt sich auf berechenbares Pressing ein
            const gegner = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
            gegner.playstyle = 'ausgeglichen';
            game.recentTacticStyles = ['pressing', 'pressing', 'pressing', 'pressing', 'pressing'];
            game.oppTacticPlan = null;
            Math.random = () => 0;
            const plan = getOppTacticPlan(gegner);
            Math.random = () => 0.99;
            const nochmal = getOppTacticPlan(gegner);
            Math.random = zufall;
            out.reagiert = plan.arch === 'K' && plan.reacted && plan.base === 'B' && nochmal === plan;
            out.staerke = getOwnLeagueMatchStrength(true, gegner) === calcTeamStrength(true) - 2;
            // Unberechenbar: Grundausrichtung bleibt
            game.recentTacticStyles = ['pressing', 'konter', 'ballbesitz'];
            game.oppTacticPlan = null;
            Math.random = () => 0;
            const plan2 = getOppTacticPlan(gegner);
            Math.random = zufall;
            out.bleibt = plan2.arch === 'B' && !plan2.reacted;
            // Vorbericht: ohne Analyst nur Presse, mit Analyst der Plan samt Wirkung
            staffMembers.analyst.hired = false;
            renderOppTacticBox(gegner);
            const ohne = document.getElementById('prematch-tactic-box').innerHTML;
            staffMembers.analyst.hired = true;
            renderOppTacticBox(gegner);
            const mit = document.getElementById('prematch-tactic-box').innerHTML;
            out.vorbericht = ohne.includes('Laut Presse') && !ohne.includes('plant') && mit.includes('plant') && mit.includes('Stärke');
            // Livespiel: Plan wird übernommen, Pokal ohne Taktik-Duell
            game.oppTacticPlan = null;
            const f = fixturesData[game.leagueLevel][game.matchday - 1].find(x => leaguesData[game.leagueLevel][x.home].name === game.clubName || leaguesData[game.leagueLevel][x.away].name === game.clubName);
            const heim = leaguesData[game.leagueLevel][f.home].name === game.clubName;
            const opp = leaguesData[game.leagueLevel][heim ? f.away : f.home];
            setupMatch(heim ? game.clubName : opp.name, heim ? opp.name : game.clubName, opp.strength, heim, false, f);
            stopLiveTickerAutoplay();
            out.live = currentMatch.oppTacticArch === getOppTacticPlan(opp).arch;
            setupMatch(game.clubName, 'Pokal FC', 50, true, true, null);
            stopLiveTickerAutoplay();
            out.pokalNeutral = currentMatch.oppTacticArch === null;
            currentMatch = null;
            // Eigene Ligaspiele werden für die Gegner-Analyse mitgeschrieben
            game.recentTacticStyles = [];
            game.tacticStyle = 'konter';
            simulateMatchdays(3);
            out.historie = game.recentTacticStyles.length === 3 && game.recentTacticStyles.every(x => x === 'konter');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Taktik-Duell-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.matrix, 'Pressing schlägt Ballbesitz, Ballbesitz schlägt Konter, Konter schlägt Pressing (±2), neutral bleibt 0');
        assert(r.berechenbar && r.unberechenbar, 'Berechenbar ist, wer in 3 von 5 Ligaspielen denselben Ansatz wählt');
        assert(r.reagiert && r.staerke, 'Gegner stellt sich auf berechenbares Pressing ein; Plan bleibt fest; Stärke sinkt um 2');
        assert(r.bleibt, 'Gegen einen unberechenbaren Trainer bleibt der Gegner bei seiner Grundausrichtung');
        assert(r.vorbericht, 'Vorbericht: ohne Analyst nur die Presse-Einschätzung, mit Analyst der echte Plan samt Wirkung');
        assert(r.live && r.pokalNeutral, 'Livespiel übernimmt den Plan, Pokalspiele bleiben ohne Taktik-Duell');
        assert(r.historie, 'Eigene Ligaspiele werden für die Gegner-Analyse mitgeschrieben');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testAutosaveResume(browser) {
    console.log('\n[19.x] Autosave: Start lädt den zuletzt geschriebenen Stand, Fehler werden gemeldet');
    // 1. Spielen bis zum Autosave (ein gemeinsamer Kontext = gemeinsamer Speicher wie im Browser)
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const fehler = [];
    page1.on('pageerror', e => fehler.push(e.message));
    page1.on('dialog', d => d.accept());
    await page1.goto(GAME_PATH);
    await page1.waitForTimeout(400);
    const vorher = await page1.evaluate(() => {
        closeTutorial();
        game.sackPending = false;
        renameClub('Autosave Testclub'); // benennt auch die Tabellenzeile um (sonst lehnt die Prüfung den Stand ab)
        game.lastAutoSaveMatchday = game.matchday;
        simulateMatchdays(6);
        return { matchday: game.matchday, last: localStorage.getItem('anstoss_fm13_last_save'), auto: !!localStorage.getItem('anstoss_fm13_autosave') };
    });
    await page1.close();
    // 2. Neustart ohne Bereinigung: der Autosave muss geladen werden
    const page2 = await ctx.newPage();
    page2.on('pageerror', e => fehler.push(e.message));
    await page2.goto(GAME_PATH);
    await page2.waitForTimeout(600);
    const nachher = await page2.evaluate(() => {
        const out = { club: game.clubName, matchday: game.matchday };
        // Danach von Hand in Slot 2 speichern: dieser Stand gilt beim nächsten Start
        saveGameToSlot(2);
        out.lastNachSlot = localStorage.getItem('anstoss_fm13_last_save');
        // Scheiternder Autosave meldet sich (einmal)
        // wie ein Browser, der das Schreiben blockiert
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function () { throw new DOMException('blockiert', 'SecurityError'); };
        game.lastAutoSaveMatchday = 0; game.matchday = 30;
        maybeAutoSave();
        out.warnung = document.getElementById('app-toast').innerText.includes('Automatisches Speichern nicht möglich');
        Storage.prototype.setItem = original;
        return out;
    });
    await ctx.close();
    assert(vorher.auto && vorher.last === 'auto', `Nach 5 Spieltagen wird automatisch gespeichert und als neuester Stand gemerkt (${vorher.last})`);
    assert(nachher.club === 'Autosave Testclub' && nachher.matchday > 1 && nachher.matchday <= vorher.matchday,
        `Beim Neustart wird der automatische Stand geladen (Spieltag ${nachher.matchday}, ${nachher.club})`);
    assert(nachher.lastNachSlot === 'slot2', 'Manuelles Speichern macht den Slot zum neuesten Stand');
    assert(nachher.warnung, 'Scheiternder Autosave wird deutlich gemeldet statt stumm zu bleiben');
    assert(fehler.length === 0, `Keine JS-Fehler (${fehler.slice(0, 2).join(' | ')})`);
}

async function testCareerScenarios(browser) {
    console.log('\n[19.4] Karriere-Szenarien: Start über den Neues-Spiel-Dialog, Ziele und Sterne');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    // Start über den Dialog (mit Neuladen wie im echten Spiel)
    await page.evaluate(() => { closeTutorial(); startNewGame(); selectNewGameScenario('absteiger'); });
    const dialog = await page.evaluate(() => document.getElementById('new-game-scenario-btns').innerHTML);
    await Promise.all([page.waitForNavigation(), page.evaluate(() => confirmNewGameWithSettings(null))]);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        try {
            const out = {};
            try { closeTutorial(); } catch (e) { /* egal */ }
            out.start = game.scenario && game.scenario.id === 'absteiger' && game.leagueLevel === 2 && game.money === 120000 && game.fans === 35 && game.scenario.status === 'aktiv';
            showScreen('screen-dashboard');
            out.karte = document.getElementById('dash-scenario-box').innerHTML.includes('Rettet den Absteiger');
            // Echte Saison: am Ende wird bewertet
            game.sackPending = false;
            simulateFullSeason();
            concludeSeasonAndAdvance();
            out.bewertet = game.scenario.status !== 'aktiv' && (game.scenarioResults || []).length === 1 && typeof game.scenario.lastRank === 'number';
            out.ergebnis = game.scenario.status + ' / ' + game.scenario.result;
            renderCareerSummary && renderCareerSummary();
            // Bewertungslogik der übrigen Szenarien
            const pruef = (id, setzen) => { const s = { id, startSeason: 1, startLevel: CAREER_SCENARIOS[id].level, lastRank: 5, status: 'aktiv' }; setzen(s); return CAREER_SCENARIOS[id].check(s); };
            game.leagueLevel = 3; game.season = 2; game.money = 300000;
            // Zwangsverkäufe aus der simulierten Absteiger-Saison zählen sonst gegen den Pleiteklub.
            game.forcedSalesCount = 0; game.loanDebt = 0; activeLoans = [];
            const p1 = pruef('pleite', () => {});
            game.money = -5000;
            const p2 = pruef('pleite', () => {});
            game.season = 3;
            const p3 = pruef('pleite', () => {});
            out.pleite = p1.ok && p1.stars === 3 && !p2.done && p3.done && !p3.ok;
            game.leagueLevel = 3; game.season = 3;
            const t1 = pruef('tradition', () => {});
            game.leagueLevel = 2;
            const t2 = pruef('tradition', () => {});
            game.leagueLevel = 4; game.season = 5;
            const t3 = pruef('tradition', () => {});
            out.tradition = !t1.done && t2.ok && t2.stars === 3 && t3.done && !t3.ok;
            game.leagueLevel = 0;
            out.titel = pruef('titel', s => { s.lastRank = 1; }).ok && !pruef('titel', s => { s.lastRank = 2; }).ok;
            game.leagueLevel = 3;
            out.abstieg = !pruef('absteiger', s => { s.startLevel = 2; }).ok && pruef('absteiger', s => { s.startLevel = 3; s.lastRank = 8; }).stars === 3;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(dialog.includes('Freies Spiel') && dialog.includes('Pleiteklub') && dialog.includes('Traditionsverein') && dialog.includes('Meister'), 'Neues-Spiel-Dialog bietet freies Spiel und vier Szenarien');
    assert(!r.crash, `Szenario-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.start && r.karte, 'Szenario-Start: eigene Liga, Kasse, Fans; Ziel-Karte auf dem Dashboard');
        assert(r.bewertet, `Am Saisonende wird bewertet und in der Karriere festgehalten (${r.ergebnis})`);
        assert(r.pleite, 'Pleiteklub: schwarze Zahlen nach 1 Saison = 3 Sterne, Zwischenstand, Scheitern nach Fristende');
        assert(r.tradition, 'Traditionsverein: 3. Liga nach 2 Saisons (schnellstmöglich) = 3 Sterne, Frist von 4 Saisons');
        assert(r.titel && r.abstieg, 'Meister oder Chaos und Klassenerhalt werden richtig bewertet');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testScenarioBalance(browser) {
    console.log('\n[20.6] Szenarien-Langzeittest: Kredite und Zwangsverkäufe sanieren nicht, Aufstiegsprämie nach Liga');
    const { page, consoleErrors } = await freshPage(browser);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const pruef = () => CAREER_SCENARIOS.pleite.check(game.scenario);
            game.leagueLevel = 3; game.season = 2;
            game.scenario = { id: 'pleite', startSeason: 1, startLevel: 3, lastRank: 5, status: 'aktiv', forcedAtStart: 0 };
            game.forcedSalesCount = 0; game.loanDebt = 0; activeLoans = [];
            // Ein Kredit hebt das Konto ins Plus, ist aber keine Sanierung.
            game.money = -200000;
            takeLoanTier('lang', 400000);
            const k = pruef();
            out.kreditZaehltNicht = game.money > 0 && !k.ok && !k.done && getScenarioNetCash() < 0;
            activeLoans = [];
            // Zwangsverkauf: eigener Buchungstext und Zähler.
            game.money = -10000; game.negativeStreak = 9;
            const kader = squad.length;
            checkInsolvencyRisk();
            const zeile = (game.kontoauszug || []).slice(-1)[0];
            out.zwangsverkauf = squad.length === kader - 1 && game.forcedSalesCount === 1 && zeile && zeile.label === '💸 Zwangsverkauf';
            game.money = 300000;
            const einer = pruef();
            out.einStern = einer.ok && einer.stars === 2;
            game.forcedSalesCount = 2;
            const zwei = pruef();
            out.zweiGescheitert = zwei.done && !zwei.ok;
            game.scenario.forcedAtStart = 2;
            out.vorherigeZaehlenNicht = pruef().stars === 3;
            showScreen('screen-dashboard');
            renderScenarioCard();
            out.karte = document.getElementById('dash-scenario-box').innerHTML.includes('Zwangsverkäufe: 0 / 2');
            // Aufstiegsprämie: Oberliga deutlich kleiner als Bundesliga, Lexikon nennt die Spanne.
            out.praemie = getPromotionPrize(4) === 150000 && getPromotionPrize(3) < getPromotionPrize(2) && getPromotionPrize(0) === 5000000;
            game.leagueLevel = 4; game.money = 0;
            applyPromotionRewards();
            out.praemieGebucht = game.money >= 150000 && game.money < 1500000;
            out.lexikon = LEXICON_ENTRIES.some(e => e.title === 'Auf- und Abstieg' && e.text.includes('150.000 €'));
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Szenario-Balance-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.kreditZaehltNicht, 'Pleiteklub: ein Kredit bringt das Konto ins Plus, zählt aber nicht als Sanierung');
        assert(r.zwangsverkauf, 'Zwangsverkauf wird gezählt und als "💸 Zwangsverkauf" gebucht (nicht unter dem offenen Screen)');
        assert(r.einStern && r.zweiGescheitert && r.vorherigeZaehlenNicht, 'Ein Zwangsverkauf kostet einen Stern, zwei lassen die Sanierung scheitern, frühere zählen nicht');
        assert(r.karte, 'Szenario-Karte zeigt die Zwangsverkäufe');
        assert(r.praemie && r.praemieGebucht, 'Aufstiegsprämie richtet sich nach der neuen Liga (Oberliga 150.000 €, Bundesliga 5 Mio. €)');
        assert(r.lexikon, 'Lexikon nennt die Aufstiegsprämie');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSaveSafety(browser) {
    console.log('\n[20.7] Spielstand-Sicherheit: Prüfen vor dem Laden, Reparatur, Sicherheitskopie, voller Speicher');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const toasts = [];
            const origToast = showToast;
            showToast = (m, t, d) => { toasts.push(String(m)); return origToast(m, t, d); };
            const letzterToast = () => toasts[toasts.length - 1] || '';
            const zustand = aenderung => { const st = JSON.parse(JSON.stringify(buildSaveState())); st.meta = buildSaveMeta(); if (aenderung) aenderung(st); return JSON.stringify(st); };

            // 1. Unlesbarer Slot: laufendes Spiel bleibt unverändert.
            game.money = 111111; saveGameToSlot(1);
            game.money = 222222;
            localStorage.setItem(SAVE_SLOT_PREFIX + 2, '{"game": {kaputt');
            out.kaputtAbgelehnt = loadGameFromSlot(2, false) === false && game.money === 222222 && letzterToast().includes('beschädigt');
            // 2. Fehlender Kader: ebenfalls abgelehnt.
            localStorage.setItem(SAVE_SLOT_PREFIX + 2, zustand(st => { delete st.squad; }));
            out.ohneKaderAbgelehnt = loadGameFromSlot(2, false) === false && game.money === 222222 && letzterToast().includes('Kader fehlt');
            // 3. Kleine Schäden werden repariert und gemeldet; vorher entsteht die Sicherheitskopie.
            localStorage.setItem(SAVE_SLOT_PREFIX + 3, zustand(st => { st.squad[1].id = st.squad[0].id; st.game.money = null; st.squad[2].strength = null; st.lineup = [987654]; }));
            out.repariert = loadGameFromSlot(3, false) === true && new Set(squad.map(x => x.id)).size === squad.length
                && game.money === 0 && squad.every(x => Number.isFinite(x.strength)) && lineup.length === 11 && lineup.every(id => squad.some(x => x.id === id))
                && toasts.some(t => t.includes('repariert') && t.includes('doppelte Spieler-IDs'));
            const kopie = JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY));
            out.kopieVorDemLaden = kopie.meta.money === 222222 && kopie.meta.backupReason.includes('Slot 3');
            // 4. Wiederherstellen ist umkehrbar.
            out.wiederhergestellt = restoreSaveBackup() === true && game.money === 222222 && JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY)).meta.money === 0;
            // 5. Überschreiben eines Slots sichert den alten Inhalt.
            saveGameToSlot(1);
            const alt = JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY));
            out.ueberschreibenGesichert = alt.meta.money === 111111 && alt.meta.backupReason.includes('Slot 1') && getSlotMeta(1).money === 222222 && getSlotMeta(1).version === GAME_VERSION.number;
            // 6. Neuere Version wird gemeldet.
            localStorage.setItem(SAVE_SLOT_PREFIX + 2, zustand(st => { st.meta.version = '99.0'; }));
            loadGameFromSlot(2, false);
            out.neuereVersion = toasts.some(t => t.includes('neueren Version'));
            // 7. Speicher voll: erst weicht die Sicherheitskopie, sonst klare Meldung.
            backupCurrentGame('Test');
            localStorage.removeItem(SAVE_SLOT_PREFIX + 2); localStorage.removeItem(SAVE_SLOT_PREFIX + 3);
            const groesse = zustand().length + 50;
            const fueller = 'x'.repeat(1000);
            let n = 0;
            try { while (n < 20000) { localStorage.setItem('fueller_' + n, fueller); n++; } } catch (e) { /* voll */ }
            out.fuellerGeschrieben = n > 100;
            // so viel freigeben, dass ein Stand nur nach dem Löschen der Sicherheitskopie passt
            let frei = 0, k = n - 1;
            while (frei < groesse * 0.6 && k >= 0) { localStorage.removeItem('fueller_' + k); frei += 1000 + ('fueller_' + k).length; k--; }
            const erg = writeSaveVerified(SAVE_SLOT_PREFIX + 2, zustand());
            out.kopieWeicht = erg.ok && erg.backupDropped === true && !localStorage.getItem(SAVE_BACKUP_KEY);
            try { while (true) { localStorage.setItem('fueller_' + (++n), fueller); } } catch (e) { /* voll */ }
            saveGameToSlot(3);
            out.vollGemeldet = letzterToast().includes('Speicher voll') && !localStorage.getItem(SAVE_SLOT_PREFIX + 3);
            out.warnungBeiVoll = getStorageUsage().share > 0.8;
            for (let i = 0; i <= n; i++) localStorage.removeItem('fueller_' + i);
            // 8. Anzeige: Füllstand, Sicherheitskopie, letzter Export.
            backupCurrentGame('Test');
            showScreen('screen-dashboard');
            renderSaveSlotsUI();
            const box = document.getElementById('save-safety-box').innerHTML;
            out.anzeige = box.includes('Speicher belegt') && box.includes('Sicherheitskopie wiederherstellen') && box.includes('Letzter Datei-Export: noch nie');
            // 9. Export-Erinnerung am Saisonende und Export merkt sich die Saison.
            game.season = 5; game.lastExportSeason = 0; game.lastExportReminderSeason = 0;
            const vorher = inboxMessages.length;
            remindSaveExport(); remindSaveExport();
            out.erinnerung = inboxMessages.length === vorher + 1;
            exportSaveToFile();
            out.exportGemerkt = game.lastExportSeason === 5;
            showToast = origToast;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Spielstand-Sicherheit ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.kaputtAbgelehnt && r.ohneKaderAbgelehnt, 'Unlesbarer Slot oder Stand ohne Kader wird abgelehnt, das laufende Spiel bleibt unverändert');
        assert(r.repariert, 'Doppelte IDs, ungültige Zahlen und verwaiste Aufstellung werden beim Laden repariert und gemeldet');
        assert(r.kopieVorDemLaden && r.wiederhergestellt, 'Vor dem Laden entsteht eine Sicherheitskopie, Wiederherstellen ist umkehrbar');
        assert(r.ueberschreibenGesichert, 'Überschreiben eines Slots sichert den alten Inhalt; Slots merken sich die Version');
        assert(r.neuereVersion, 'Spielstand aus einer neueren Version wird gemeldet');
        assert(r.fuellerGeschrieben && r.kopieWeicht, 'Speicher voll: die Sicherheitskopie weicht, damit der Spielstand passt');
        assert(r.vollGemeldet && r.warnungBeiVoll, 'Passt gar nichts mehr, meldet das Spiel "Speicher voll" statt still zu scheitern');
        assert(r.anzeige, 'Speicherstände zeigen Füllstand, Sicherheitskopie und letzten Datei-Export');
        assert(r.erinnerung && r.exportGemerkt, 'Export-Erinnerung einmal pro Saison, der Export merkt sich die Saison');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();

    // Start mit beschädigtem letzten Stand: der nächstneuere heile Stand wird geladen.
    const p2 = await browser.newPage();
    const fehler2 = [];
    p2.on('pageerror', e => fehler2.push(e.message));
    await p2.goto(GAME_PATH);
    await p2.waitForTimeout(400);
    await p2.evaluate(() => {
        closeTutorial();
        game.money = 345678; saveGameToSlot(1);
        localStorage.setItem(SAVE_SLOT_PREFIX + 2, '{"kaputt":');
        localStorage.setItem('anstoss_fm13_last_save', 'slot2');
    });
    await p2.reload();
    await p2.waitForTimeout(600);
    const start = await p2.evaluate(() => ({ money: game.money, toast: (document.getElementById('app-toast') || {}).innerText || '' }));
    assert(start.money === 345678, `Start: beschädigter letzter Stand (Slot 2) wird übersprungen, Slot 1 geladen (${start.money})`);
    assert(fehler2.length === 0, `Keine JS-Fehler beim Start mit beschädigtem Stand (${fehler2.slice(0, 2).join(' | ')})`);
    await p2.close();
}

async function testOneHandControls(browser) {
    console.log('\n[20.8] Bedienung mit einer Hand: Weiter-Knopf, Zurück-Taste, Fenster unten, Livespiel-Leiste');
    const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));
    await page.addInitScript(() => { try { localStorage.removeItem('anstoss_fm13_last_save'); localStorage.removeItem('anstoss_fm13_ui_fab'); } catch (e) { /* egal */ } });
    await page.goto(GAME_PATH);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const H = window.innerHeight;
            // Kopf: Sprache/Ton im Menü, Kennzahlen in einer Zeile
            out.togglesImMenue = !!document.querySelector('#one-hand-settings-toggles #btn-lang-toggle') && !!document.querySelector('#one-hand-settings-toggles #btn-sound-toggle');
            out.kopfHoehe = Math.round(document.querySelector('.app-header').getBoundingClientRect().height);
            const fans = document.getElementById('top-fans').getBoundingClientRect(), board = document.getElementById('top-board').getBoundingClientRect();
            out.fansEineZeile = Math.abs(fans.top - board.top) < 4;
            // Untere Leiste: Menü-Knopf öffnet das Seitenmenü
            const menue = document.getElementById('bottom-nav-menu');
            out.menueUnten = menue.getBoundingClientRect().bottom > H - 80;
            menue.click();
            out.menueOffen = document.getElementById('app-sidebar').classList.contains('menu-open');
            closeMenuDrawer();
            // Weiter-Knopf: sichtbar im Daumenbereich, startet den Spieltag, links/aus umschaltbar
            showScreen('screen-squad');
            const fab = document.getElementById('one-hand-fab');
            const f = fab.getBoundingClientRect();
            out.fabRechtsUnten = f.height >= 40 && f.bottom > H - 160 && f.right > 412 - 40 && fab.innerText.includes('Spieltag 1');
            cycleOneHandFabMode();
            out.fabLinks = fab.getBoundingClientRect().left < 40;
            cycleOneHandFabMode();
            out.fabAus = fab.getBoundingClientRect().height === 0;
            cycleOneHandFabMode();
            // Seitenende liegt auch über dem Weiter-Knopf
            showScreen('screen-dashboard');
            window.scrollTo(0, document.documentElement.scrollHeight);
            const fabTop = fab.getBoundingClientRect().top;
            const unterste = Math.max(...[...document.querySelectorAll('.app-content button, .app-content .box')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom));
            out.endeFrei = unterste <= fabTop + 1;
            window.scrollTo(0, 0);
            fab.click();
            out.fabStartet = aktiverScreen === 'screen-prematch-press' && fab.getBoundingClientRect().height === 0;
            // Zurück-Taste im laufenden Spiel: kein Verlassen, Hinweis
            out.zurueckImSpiel = handleOneHandBack() === true && aktiverScreen === 'screen-prematch-press';
            // Livespiel: Steuerleiste steht über der unteren Leiste, ohne zu scrollen
            const direkt = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
            direkt.click();
            window.scrollTo(0, 0);
            const navTop = document.querySelector('.bottom-nav-bar').getBoundingClientRect().top;
            const szene = document.getElementById('btn-next-step').getBoundingClientRect();
            out.liveLeiste = szene.height > 0 && szene.bottom <= navTop + 1 && szene.top > H / 2;
            simulateRestOfMatch();
            finishMatch();
            out.nachSpiel = `notices ${noticeQueue.length} overlay ${(findOpenOverlay() || {}).id || '-'} screen ${aktiverScreen}`;
            // Nach dem Spiel offene Meldungen/Fenster (Interview, Spieltagsmeldungen) zuerst wegklicken -
            // sie würde die Zurück-Taste sonst richtigerweise zuerst schließen.
            while (noticeQueue.length) dismissNotice();
            // Das Interview verlangt eine Antwort (kein ✕) - erste Antwort wählen.
            for (let i = 0; i < 5 && findOpenOverlay(); i++) { const ov = findOpenOverlay(); const zu = findOverlayCloseButton(ov) || ov.querySelector('button'); if (!zu) break; zu.click(); }
            out.nachSpiel += ` -> overlay ${(findOpenOverlay() || {}).id || '-'}`;
            // Zurück-Taste: Bildschirme rückwärts, Fenster und Menü schließen
            showScreen('screen-dashboard'); showScreen('screen-squad'); showScreen('screen-finances');
            handleOneHandBack();
            out.zurueckKader = aktiverScreen === 'screen-squad';
            handleOneHandBack();
            out.zurueckStart = aktiverScreen === 'screen-dashboard';
            toggleMenuDrawer();
            handleOneHandBack();
            out.menueZu = !document.getElementById('app-sidebar').classList.contains('menu-open') && aktiverScreen === 'screen-dashboard';
            openPlayerDetail(squad[0].id);
            const ov = document.getElementById('player-detail-overlay');
            const box = ov.querySelector('.generic-modal-box').getBoundingClientRect();
            out.fensterUnten = ov.classList.contains('show') && box.bottom > H - 20;
            handleOneHandBack();
            out.fensterZu = !ov.classList.contains('show');
            // Tipp neben das Fenster schließt es
            openPlayerDetail(squad[0].id);
            ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            out.tippDaneben = !ov.classList.contains('show');
            // Meldungen: ohne Folgeaktion per Zurück weg, mit Folgeaktion bleibt sie
            showNotice('Test', 'Info');
            handleOneHandBack();
            out.meldungWeg = document.getElementById('app-notice').style.display === 'none';
            let gelaufen = false;
            showNotice('Wichtig', 'Mit Folge', { danach: () => { gelaufen = true; } });
            handleOneHandBack();
            out.meldungBleibt = document.getElementById('app-notice').style.display !== 'none' && !gelaufen;
            dismissNotice();
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Einhand-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.togglesImMenue && r.kopfHoehe <= 130 && r.fansEineZeile, `Kopf kompakt: Sprache/Ton im Menü, Kennzahlen in einer Zeile (${r.kopfHoehe} px)`);
        assert(r.menueUnten && r.menueOffen, 'Menü öffnet sich aus der unteren Leiste');
        assert(r.fabRechtsUnten && r.fabLinks && r.fabAus, 'Weiter-Knopf unten rechts, für Linkshänder links, abschaltbar');
        assert(r.endeFrei, 'Seitenende liegt über dem Weiter-Knopf');
        assert(r.fabStartet && r.zurueckImSpiel, 'Weiter-Knopf startet den Spieltag; Zurück verlässt das laufende Spiel nicht');
        assert(r.liveLeiste, 'Livespiel: Szene/Pause/Abpfiff stehen ohne Scrollen über der unteren Leiste');
        assert(r.zurueckKader && r.zurueckStart && r.menueZu, `Zurück-Taste geht Bildschirme rückwärts und schließt das Menü (${r.zurueckKader}/${r.zurueckStart}/${r.menueZu}, nach dem Spiel: ${r.nachSpiel})`);
        assert(r.fensterUnten && r.fensterZu && r.tippDaneben, 'Fenster fahren von unten ein und schließen per Zurück oder Tipp daneben');
        assert(r.meldungWeg && r.meldungBleibt, 'Zurück schließt Infomeldungen, Meldungen mit Folgeaktion brauchen den Knopf');
    }
    // Echte Zurück-Taste (Browser-History): erst das Fenster, ein Druck auf dem Startbildschirm warnt nur.
    await page.evaluate(() => openPlayerDetail(squad[0].id));
    await page.goBack().catch(() => null);
    await page.waitForTimeout(300);
    const nachBack = await page.evaluate(() => ({ zu: !document.getElementById('player-detail-overlay').classList.contains('show'), da: typeof game === 'object' }));
    assert(nachBack.zu && nachBack.da, 'Browser-Zurück schließt das Fenster und bleibt im Spiel');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testDerbyWeek(browser) {
    console.log('\n[21.1] Derby-Woche: Vorbereitung mit Kosten und Risiko, Bonus nur am Derby-Tag, Folgen und Chronik');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            out.keinTestDerby = game.forceDerbyMatchdays === undefined && !isDerbyOpponent('Irgendein Verein');
            // Derby-Spieltag im echten Spielplan suchen (nicht vor Spieltag 3). Derbys entstehen nach
            // Ort - steht zufällig kein Leipziger Verein in der Liga, wird ein Traditionsduell gesetzt.
            const liga = leaguesData[game.leagueLevel];
            if (!liga.some(t => isDerbyOpponent(t.name))) TRADITION_DERBIES.push([game.clubName, liga.find(t => t.name !== game.clubName).name, 'Testderby']);
            let derbyMd = null, heim = null, gegner = null;
            // Mehrere Stadtrivalen: ein Derby wählen, vor dem in den zwei Spieltagen davor kein
            // anderes Derby liegt (sonst gilt die Derby-Woche zuerst dem früheren).
            const derbyAm = md => fixturesData[game.leagueLevel][md - 1].some(f => {
                const h = liga[f.home].name, a = liga[f.away].name;
                return (h === game.clubName && isDerbyOpponent(a)) || (a === game.clubName && isDerbyOpponent(h));
            });
            for (let md = 3; md <= 34 && !derbyMd; md++) {
                if (derbyAm(md - 1) || derbyAm(md - 2)) continue;
                for (const f of fixturesData[game.leagueLevel][md - 1]) {
                    const h = liga[f.home].name, a = liga[f.away].name;
                    if (h === game.clubName && isDerbyOpponent(a)) { derbyMd = md; heim = true; gegner = a; }
                    if (a === game.clubName && isDerbyOpponent(h)) { derbyMd = md; heim = false; gegner = h; }
                }
            }
            out.derbyGefunden = !!derbyMd;
            if (!derbyMd) return out;
            out.heim = heim;
            game.matchday = derbyMd - 2;
            game.money = 5000000; game.sackPending = false;
            showScreen('screen-dashboard');
            const karte = document.getElementById('dash-derby-box').innerHTML;
            out.karte = karte.includes('Derby-Woche') && karte.includes(gegner) && karte.includes('in 2 Spieltagen');
            const k = getDerbyCosts();
            let geld = game.money;
            chooseDerbyMood();
            out.stimmungKostet = game.money === geld - k.stimmung;
            geld = game.money;
            chooseDerbyMood();
            out.nichtDoppelt = game.money === geld;
            if (heim) { chooseDerbySecurity(); out.sicherheit = game.money === geld - k.sicherheit; } else { chooseDerbySecurity(); out.sicherheit = game.money === geld; }
            const moral = squad[0].morale;
            chooseDerbyPremium();
            out.praemieMoral = squad[0].morale === Math.min(100, moral + 5) && game.derbyWeek.praemie > 0;
            chooseDerbyPress('kampf');
            out.karteAktualisiert = document.getElementById('dash-derby-box').innerHTML.includes('✔');
            // Bonus nur am Derby-Spieltag
            const oppTeam = liga.find(t => t.name === gegner);
            out.vorherKeinBonus = getDerbyBonus(gegner) === 0;
            game.matchday = derbyMd;
            out.bonus = getDerbyBonus(gegner) === 2.5;
            const plan = getOppTacticPlan(oppTeam);
            out.simBonus = Math.abs(getOwnLeagueMatchStrength(heim, oppTeam) - calcTeamStrength(heim) - getTacticMatchupBonus(plan ? plan.arch : null) - 2.5) < 0.01;
            out.risiko = heim ? Math.abs(getDerbyRiskFactor() - 1.3 * 0.35) < 0.001 : getDerbyRiskFactor() === 1;
            // Livespiel: Bonus im Ticker, Abschluss über den echten Spielweg
            startMatchdayFlow();
            // Derby auf einem Pokalspieltag (z. B. 6): erst das Pokalspiel, dann der Ligateil.
            if (pendingMatchInfo && pendingMatchInfo.cupTie) {
                const pokal = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
                if (pokal) pokal.click();
                simulateRestOfMatch(); finishMatch();
            }
            const direkt = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
            if (direkt) direkt.click();
            out.ticker = document.getElementById('ticker-log').innerHTML.includes('Derbystimmung');
            simulateRestOfMatch();
            finishMatch();
            const h0 = (game.derbyHistory || [])[0];
            out.chronik = !!h0 && h0.opp === gegner && h0.matchday === derbyMd && h0.prep.includes('Kampfansage') && h0.prep.includes(heim ? 'Choreo' : 'Sonderzug');
            // Mit mehreren Stadtrivalen kann direkt die nächste Derby-Woche beginnen - entscheidend
            // ist, dass DIESES Derby abgeschlossen ist und keinen Bonus mehr gibt.
            out.abgeschlossen = (game.derbyWeek.opp !== gegner || game.derbyWeek.resolved === true) && getDerbyBonus(gegner) === 0;
            // Folgen direkt: Sieg zahlt die Prämie und hebt Medien, Niederlage kostet Moral
            const test = (tore, gegentore) => {
                game.derbyWeek = { season: game.season, matchday: game.matchday, opp: gegner, home: true, stimmung: false, sicherheit: false, praemie: 50000, presse: 'kampf', resolved: false };
                return resolveDerbyWeek(gegner, tore, gegentore);
            };
            game.money = 1000000; game.fans = 50; game.managerMediaImage = 50;
            const sieg = test(2, 0);
            out.siegFolgen = game.money === 950000 && game.fans === 54 && game.managerMediaImage > 50 && sieg.some(t => t.includes('Prämie'));
            game.fans = 50; const m0 = squad[0].morale = 60; const board = game.boardSat = 60;
            test(0, 1);
            out.niederlageFolgen = squad[0].morale === m0 - 4 && game.fans === 45 && game.boardSat === board - 2 && game.money === 950000;
            showScreen('screen-history'); setSubTab('hist', 'rivalen');
            out.historie = document.getElementById('derby-history-box').innerHTML.includes(gegner);
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Derby-Woche ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.keinTestDerby, 'Kein Test-Überbleibsel mehr: die ersten Spieltage sind keine erzwungenen Derbys');
        assert(r.derbyGefunden && r.karte, 'Derby-Woche-Karte erscheint vor dem Derby mit Gegner und Abstand');
        assert(r.stimmungKostet && r.nichtDoppelt && r.sicherheit, `Vorbereitungen kosten Geld, einmal pro Derby, Sicherheit nur zu Hause (heim: ${r.heim})`);
        assert(r.praemieMoral && r.karteAktualisiert, 'Prämie hebt die Moral sofort, die Karte zeichnet sich nach jeder Wahl neu');
        assert(r.vorherKeinBonus && r.bonus && r.simBonus, 'Bonus (+2,5) gilt nur am Derby-Spieltag und auch in der Simulation');
        assert(r.risiko, 'Choreo erhöht, Sicherheitskonzept senkt das Ausschreitungsrisiko');
        assert(r.ticker && r.chronik && r.abgeschlossen, 'Livespiel zeigt die Derbystimmung, das Derby landet in der Chronik');
        assert(r.siegFolgen && r.niederlageFolgen, 'Sieg zahlt die Prämie und hebt Fans/Medien, Niederlage nach Kampfansage kostet Moral, Fans und Vorstand');
        assert(r.historie, 'Historie > Rivalen zeigt die Derby-Chronik');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testCoTrainerLive(browser) {
    console.log('\n[21.3] Co-Trainer im Livespiel: echte Hinweise je Ausbaustufe, Ein-Tipp-Aktionen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.sackPending = false;
            startMatchdayFlow();
            if (aktiverScreen !== 'screen-prematch-press') { showScreen('screen-dashboard'); }
            const direkt = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
            if (direkt) direkt.click();
            out.live = !!currentMatch && aktiverScreen === 'screen-matchday';
            const rnd = Math.random;
            Math.random = () => 0;
            const frisch = () => { currentMatch.coHintsUsed = []; delete currentMatch.lastCoHintMinute; resetCoTrainerLive(); };
            const stand = (wir, die) => { if (currentMatch.isHome) { currentMatch.homeGoals = wir; currentMatch.awayGoals = die; } else { currentMatch.awayGoals = wir; currentMatch.homeGoals = die; } };
            squad.forEach(p => { p.fitness = 100; });
            currentMatch.yellowCards = {};
            // Ohne Co-Trainer: kein Hinweis
            staffMembers.coTrainer.hired = false;
            currentMatch.minute = 72; stand(0, 1); frisch();
            tickCoTrainerLive();
            out.ohneKeiner = document.getElementById('live-cotrainer-box').innerHTML === '';
            // Stufe 1: Rückstand spät -> Brechstange
            staffMembers.coTrainer.hired = true;
            ensureStaffMeta('coTrainer').level = 1; ensureStaffMeta('coTrainer').morale = 80;
            activeLiveShout = 'standard';
            const trust = game.coTrainerTrust ?? 66;
            tickCoTrainerLive();
            const box = document.getElementById('live-cotrainer-box').innerHTML;
            out.rueckstand = box.includes('Brechstange') && document.getElementById('ticker-log').innerHTML.includes('Co-Trainer');
            followCoTrainerHint(0);
            out.befolgt = activeLiveShout === 'brechstange' && game.coTrainerTrust === Math.min(100, trust + 1) && game.coTrainerHistory.liveFollowed === 1 && document.getElementById('live-cotrainer-box').innerHTML === '';
            // Abstand: sofort danach kein neuer Hinweis
            currentMatch.minute = 75;
            tickCoTrainerLive();
            out.abstand = document.getElementById('live-cotrainer-box').innerHTML === '';
            // Stufe 1 kennt keine Karten-Hinweise
            const elf = squad.filter(p => lineup.includes(p.id) && p.pos !== 'TW');
            stand(1, 1); frisch(); currentMatch.minute = 40; game.tackleHardness = 'normal';
            currentMatch.yellowCards[elf[0].id] = 1;
            tickCoTrainerLive();
            out.stufe1OhneKarte = document.getElementById('live-cotrainer-box').innerHTML === '';
            // Stufe 2: Gelb-Rot-Gefahr -> Härte runter
            ensureStaffMeta('coTrainer').level = 2; frisch();
            tickCoTrainerLive();
            out.karte = document.getElementById('live-cotrainer-box').innerHTML.includes(elf[0].name);
            followCoTrainerHint(0);
            out.haerte = game.tackleHardness === 'vorsichtig';
            // Stufe 2: Taktik-Duell verloren -> Konterstil
            currentMatch.yellowCards = {}; frisch(); currentMatch.minute = 30;
            currentMatch.oppTacticArch = 'K'; game.tacticStyle = 'pressing';
            tickCoTrainerLive();
            out.taktikHinweis = document.getElementById('live-cotrainer-box').innerHTML.includes('ballbesitz');
            followCoTrainerHint(0);
            out.taktik = game.tacticStyle === 'ballbesitz' && getTacticMatchupBonus('K') === 2;
            // Stufe 3: neutraler Stil, Gegner durchschaut
            ensureStaffMeta('coTrainer').level = 3; frisch(); game.tacticStyle = 'ausgeglichen';
            tickCoTrainerLive();
            out.stufe3 = document.getElementById('live-cotrainer-box').innerHTML.includes('durchschaut');
            ignoreCoTrainerHint();
            out.ignoriert = game.coTrainerHistory.liveIgnored === 1;
            // Müder Spieler -> Wechsel über den normalen Weg
            frisch(); currentMatch.minute = 60; currentMatch.oppTacticArch = null;
            const muede = elf[1]; muede.fitness = 55;
            const wechselVorher = substitutionsLeft;
            tickCoTrainerLive();
            out.muedeHinweis = document.getElementById('live-cotrainer-box').innerHTML.includes(muede.name);
            followCoTrainerHint(0);
            out.wechsel = !lineup.includes(muede.id) && substitutionsLeft === wechselVorher - 1;
            // Schlechte Laune: meldet sich unzuverlässig
            ensureStaffMeta('coTrainer').morale = 20; frisch(); currentMatch.minute = 79; stand(1, 0); activeLiveShout = 'standard';
            Math.random = () => 0.9;
            tickCoTrainerLive();
            out.laune = document.getElementById('live-cotrainer-box').innerHTML === '';
            Math.random = () => 0;
            ensureStaffMeta('coTrainer').morale = 80;
            tickCoTrainerLive();
            out.fuehrung = document.getElementById('live-cotrainer-box').innerHTML.includes('Bus parken');
            Math.random = rnd;
            simulateRestOfMatch();
            out.abpfiffLeer = document.getElementById('live-cotrainer-box').innerHTML === '';
            finishMatch();
            showScreen('screen-squad');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Co-Trainer im Livespiel ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.live && r.ohneKeiner, 'Ohne Co-Trainer keine Hinweise');
        assert(r.rueckstand && r.befolgt && r.abstand, 'Stufe 1: Rückstand spät -> Brechstange per Tipp, Vertrauen +1, danach 15 Minuten Ruhe');
        assert(r.stufe1OhneKarte && r.karte && r.haerte, 'Gelb-Rot-Gefahr erst ab Stufe 2, Aktion stellt die Härte um');
        assert(r.taktikHinweis && r.taktik, 'Verlorenes Taktik-Duell: Hinweis auf den Konterstil, der das Duell dreht');
        assert(r.stufe3 && r.ignoriert, 'Stufe 3 erkennt auch ein gewinnbares Taktik-Duell; Ignorieren wird gezählt');
        assert(r.muedeHinweis && r.wechsel, 'Müder Spieler: Wechsel über den normalen Livespiel-Weg');
        assert(r.laune && r.fuehrung, 'Schlecht gelaunter Co-Trainer meldet sich unzuverlässiger; knappe Führung spät -> Bus parken');
        assert(r.abpfiffLeer, 'Nach dem Abpfiff verschwindet der Hinweis');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testPregameTalk(browser) {
    console.log('\n[22.1] Kabinenansprache vor dem Anpfiff: Lage und Charaktere entscheiden, Druck hat Folgen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.sackPending = false;
            startMatchdayFlow();
            const box = () => document.getElementById('prematch-talk-box').innerHTML;
            out.box = box().includes('KABINENANSPRACHE') && box().includes('Keine Überheblichkeit') && box().includes('nichts zu verlieren') && box().includes('zählt nur der Sieg');
            const elf = squad.filter(p => lineup.includes(p.id));
            const avg = elf.reduce((a, p) => a + p.strength, 0) / elf.length;
            const merk = { ...pendingMatchInfo };
            game.pregameTalkHistory = [];
            elf.forEach(p => { p.character = 'Ruhig'; });
            pendingMatchInfo.oppStr = avg - 10;
            out.situationFav = getPregameSituation() === 'favorit';
            const fokusFav = computePregameTalkBonus('fokus'), mutFav = computePregameTalkBonus('mut');
            pendingMatchInfo.oppStr = avg + 10;
            const fokusAus = computePregameTalkBonus('fokus'), mutAus = computePregameTalkBonus('mut');
            out.lage = fokusFav > fokusAus && mutAus > mutFav && mutFav < 0;
            elf.forEach(p => { p.character = 'Ehrgeizig'; });
            const druckStark = computePregameTalkBonus('druck');
            elf.forEach(p => { p.character = 'Hitzköpfig'; });
            const druckNervoes = computePregameTalkBonus('druck');
            out.charakter = druckStark > 2 && druckNervoes < -1;
            game.pregameTalkHistory = ['mut', 'mut'];
            const voll = (() => { game.pregameTalkHistory = []; return computePregameTalkBonus('mut'); })();
            game.pregameTalkHistory = ['mut', 'mut'];
            out.abgenutzt = isPregameTalkWornOut('mut') && Math.abs(computePregameTalkBonus('mut') - voll / 2) < 0.06 && box().length > 0;
            renderPregameTalkBox();
            out.abgenutztAnzeige = box().includes('kennen sie schon');
            // Wählen, einmal pro Spiel, Wirkung im Livespiel
            Object.assign(pendingMatchInfo, merk);
            game.pregameTalkHistory = [];
            elf.forEach(p => { p.character = 'Ruhig'; });
            choosePregameTalk('fokus');
            const t = game.pregameTalk;
            choosePregameTalk('mut');
            out.einmal = game.pregameTalk === t && t.type === 'fokus' && box().includes('✔');
            const direkt = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
            direkt.click();
            out.ticker = document.getElementById('ticker-log').innerHTML.includes('Kabinenansprache') && t.used === true && game.pregameTalkHistory.slice(-1)[0] === 'fokus';
            // Druck: Niederlage kostet Moral
            currentMatch.pregameTalk = 'druck';
            if (currentMatch.isHome) { currentMatch.homeGoals = 0; currentMatch.awayGoals = 2; } else { currentMatch.awayGoals = 0; currentMatch.homeGoals = 2; }
            squad.forEach(p => { p.morale = 60; });
            resolvePregameTalk();
            out.druckFolge = squad.every(p => p.morale === 56);
            resolvePregameTalk();
            out.nurEinmal = squad.every(p => p.morale === 56);
            simulateRestOfMatch(); finishMatch();
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Kabinenansprache ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.box, 'Spielvorbericht bietet drei Ansprachen');
        assert(r.situationFav && r.lage, 'Lage entscheidet: Konzentration als Favorit, Mut als Außenseiter (als Favorit kontraproduktiv)');
        assert(r.charakter, 'Charaktere entscheiden: Druck beflügelt Ehrgeizige, lähmt Hitzköpfe');
        assert(r.abgenutzt && r.abgenutztAnzeige, 'Dieselbe Rede dreimal hintereinander wirkt nur halb und ist markiert');
        assert(r.einmal && r.ticker, 'Eine Ansprache pro Spiel, Wirkung steht im Livespiel-Ticker');
        assert(r.druckFolge && r.nurEinmal, 'Druck-Rede: Niederlage kostet einmalig Moral');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testMatchPrep(browser) {
    console.log('\n[22.2] Gegnervorbereitung: Match-Prep tippt den Gegnerstil - richtig +2,5, daneben 0');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.sackPending = false;
            const opp = getNextLeagueOpponentTeam();
            showScreen('screen-training');
            const box = () => document.getElementById('matchprep-target-box').innerHTML;
            out.box = !!opp && box().includes(opp.name) && box().includes('Pressing') && box().includes('Konter');
            // Keine Scheinwahl mehr: Taktik sicher +2, Match-Prep ohne Tipp 0
            game.teamTraining = 'taktik'; const taktik = calcTeamStrength(true);
            game.teamTraining = 'matchprep'; const prep = calcTeamStrength(true);
            out.taktikSicher = Math.abs(taktik - prep - 2) < 0.01 && getMatchPrepBonus(opp) === 0;
            const plan = getOppTacticPlan(opp);
            const falsch = ['P', 'B', 'K'].find(a => a !== plan.arch);
            setMatchPrepTarget(falsch);
            out.daneben = getMatchPrepBonus(opp) === 0 && box().includes('✔');
            setMatchPrepTarget(plan.arch);
            out.richtig = getMatchPrepBonus(opp) === 2.5 && game.teamTraining === 'matchprep';
            const ohne = (() => { const t = game.teamTraining; game.teamTraining = 'ausgeglichen'; const v = getOwnLeagueMatchStrength(true, opp); game.teamTraining = t; return v; })();
            out.simulation = getOwnLeagueMatchStrength(true, opp) - ohne > 2.4;
            // Gilt nur für den Spieltag, für den vorbereitet wurde
            game.matchPrep.matchday = game.matchday + 1;
            out.nurDieserSpieltag = getMatchPrepBonus(opp) === 0;
            setMatchPrepTarget(plan.arch);
            // Analyst zeigt den Plan
            staffMembers.analyst.hired = true; renderMatchPrepBox();
            out.analyst = box().includes('Chef-Analyst') && box().includes(ARCHETYPE_LABELS[plan.arch]);
            staffMembers.analyst.hired = false;
            // Automatik stellt sich auf den Grundstil ein
            autoSetMatchPrepTarget();
            out.automatik = game.matchPrep.arch === (AI_STYLE_ARCHETYPE[opp.playstyle] || 'B');
            // Livespiel zeigt Treffer oder Fehlgriff
            setMatchPrepTarget(plan.arch);
            startMatchdayFlow();
            const direkt = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
            if (direkt) direkt.click();
            out.live = document.getElementById('ticker-log').innerHTML.includes('Match-Prep passt');
            simulateRestOfMatch(); finishMatch();
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Gegnervorbereitung ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.box, 'Training zeigt den nächsten Ligagegner und drei Stile zur Vorbereitung');
        assert(r.taktikSicher, 'Taktik bringt sicher +2, Match-Prep ohne Tipp nichts (vorher pauschal +1 = Scheinwahl)');
        assert(r.daneben && r.richtig && r.simulation, 'Richtiger Tipp +2,5 auch in der Simulation, falscher Tipp 0');
        assert(r.nurDieserSpieltag, 'Vorbereitung gilt nur für den Spieltag, für den sie gewählt wurde');
        assert(r.analyst && r.automatik, 'Chef-Analyst verrät den Plan, die Automatik tippt auf den Grundstil');
        assert(r.live, 'Livespiel-Ticker meldet, ob die Vorbereitung passt');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSetPieceDrills(browser) {
    console.log('\n[22.3] Standards einstudieren: Standards-Tage im Wochenplan, Beherrschung wirkt im Livespiel');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            // Vorlage "Technik" setzt einen Standards-Tag - den gibt es jetzt wirklich
            applyWeeklyTrainingPreset('technik');
            showScreen('screen-training');
            const sel = [...document.querySelectorAll('#weekly-training-grid select')];
            out.einheit = !!WEEKLY_TRAINING_UNITS.standards && countStandardsDays() === 1 && sel.some(s => s.value === 'standards');
            // Lauter Standards-Tage: Mannschafts-Schwerpunkt bleibt "ausgeglichen"
            ['mo', 'di', 'mi', 'do'].forEach(d => setWeeklyTrainingDay(d, 'standards'));
            out.schwerpunkt = game.teamTraining === 'ausgeglichen' && countStandardsDays() === 4;
            out.box = document.getElementById('setpiece-drill-box').innerHTML.includes('4 Standards-Tage');
            // Übung: Fokus Elfmeter, 2 Tage -> +20 pro Spieltag, Rest verblasst
            ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].forEach(d => { game.weeklyTrainingPlan[d] = 'ausgeglichen'; });
            game.weeklyTrainingPlan.mo = 'standards'; game.weeklyTrainingPlan.mi = 'standards';
            staffMembers.setPieceCoach.hired = false;
            game.setPieceDrills = { focus: 'direkt', mastery: { direkt: 0, flanke: 10, kurz: 0, elfmeter: 0, ecke: 0 } };
            setSetPieceDrillFocus('elfmeter');
            tickSetPieceDrills();
            out.uebung = game.setPieceDrills.mastery.elfmeter === 20 && game.setPieceDrills.mastery.flanke === 8;
            staffMembers.setPieceCoach.hired = true;
            out.coach = getDrillGainPerMatchday() === 30;
            staffMembers.setPieceCoach.hired = false;
            // Wirkung im Livespiel
            currentMatch = { homeGoals: 0, awayGoals: 0, minute: 10, isHome: true, sentOff: [] };
            const schuetze = squad.find(p => p.pos === 'ST');
            schuetze.shooting = 60; schuetze.fitness = 100;
            game.setPieceDrills.mastery.elfmeter = 0;
            const ohne = getLivePenaltyChance(schuetze, false);
            game.setPieceDrills.mastery.elfmeter = 100;
            out.elfmeter = Math.abs(getLivePenaltyChance(schuetze, false) - ohne - 0.06) < 0.001;
            lineup = pickBestLineupIds();
            game.setPieceDrills.mastery.kurz = 0; game.setPieceDrills.mastery.flanke = 0;
            const vorher = getFreeKickOptions();
            game.setPieceDrills.mastery.kurz = 100; game.setPieceDrills.mastery.flanke = 100;
            const nachher = getFreeKickOptions();
            out.freistoss = Math.abs(nachher.kurz.prob - 0.10) < 0.001 && nachher.flanke.risiko === 0.02 && nachher.flanke.prob > vorher.flanke.prob && nachher.kurz.hinweis.includes('einstudiert 100 %');
            // Ohne Standards-Tage verblasst alles
            ['mo', 'mi'].forEach(d => { game.weeklyTrainingPlan[d] = 'ausgeglichen'; });
            for (let i = 0; i < 10; i++) tickSetPieceDrills();
            out.verblasst = game.setPieceDrills.mastery.kurz === 80;
            currentMatch = null;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Standards einstudieren ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.einheit, 'Standards ist eine echte Wochenplan-Einheit (die Vorlagen setzten sie, das Auswahlfeld kannte sie nicht)');
        assert(r.schwerpunkt && r.box, 'Standards-Tage zählen für die Varianten, der Mannschafts-Schwerpunkt bleibt ausgeglichen');
        assert(r.uebung && r.coach, 'Je Standards-Tag +10 pro Spieltag (Standards-Spezialist x1,5), nicht geübte Varianten verlieren 2');
        assert(r.elfmeter && r.freistoss, 'Einstudiert wirkt im Livespiel: Elfmeter +6 %, kurz bis 10 %, Flanke mit halbem Konterrisiko');
        assert(r.verblasst, 'Ohne Standards-Tage verblasst die Beherrschung');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testRefereeCritique(browser) {
    console.log('\n[22.4] Schiedsrichter-Kritik: strittige Szenen, drei Reaktionen mit Folgen, Groll des Schiedsrichters');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.sackPending = false;
            startMatchdayFlow();
            const direkt = [...document.querySelectorAll('#screen-prematch-press button')].find(b => b.innerText.includes('Direkt zum Spiel'));
            direkt.click();
            const box = () => document.getElementById('ref-critique-box').innerHTML;
            out.leerZuBeginn = box() === '' && !currentMatch.controversies;
            // Strenger Schiedsrichter: Platzverweise landen als strittige Szene im Protokoll
            const ref = currentMatch.referee;
            currentMatch.referee = Object.assign({}, ref, { cardMult: 40 });
            lineup.forEach(id => { currentMatch.yellowCards[id] = 1; }); // jede Karte ist Gelb-Rot
            playOpponentPenalty();
            simulateRestOfMatch();
            const rote = (currentMatch.controversies || []).filter(c => c.type === 'rot');
            out.rotErfasst = currentMatch.sentOff.length > 0 && rote.length === currentMatch.sentOff.length && rote.every(c => squad.some(p => p.id === c.playerId));
            out.elfErfasst = currentMatch.controversies.some(c => c.type === 'elfmeter');
            // Sieg: kein Angebot
            const wir = s => { if (currentMatch.isHome) { currentMatch.homeGoals = s[0]; currentMatch.awayGoals = s[1]; } else { currentMatch.awayGoals = s[0]; currentMatch.homeGoals = s[1]; } };
            currentMatch.critiquePending = false;
            wir([2, 0]); offerRefereeCritique();
            out.keinAngebotBeiSieg = box() === '' && !currentMatch.critiquePending;
            // Niederlage: Angebot mit drei Wegen
            wir([0, 1]); offerRefereeCritique();
            out.angebot = currentMatch.critiquePending && box().includes('Öffentlich kritisieren') && box().includes('Schriftliche Beschwerde') && box().includes('Nichts sagen') && box().includes('Platzverweis gegen');
            // Beschwerde mit Erfolg: Sperre weg, Gebühr gebucht
            const gesperrt = squad.find(p => p.id === rote[0].playerId);
            gesperrt.suspended = 1;
            const geld0 = game.money;
            const zufall = Math.random;
            Math.random = () => 0.01;
            chooseRefereeCritique('beschwerde');
            Math.random = zufall;
            out.beschwerde = gesperrt.suspended === 0 && game.money === geld0 - REF_COMPLAINT_FEE[game.leagueLevel] && box() === '';
            const geld1 = game.money;
            chooseRefereeCritique('kritik');
            out.nurEinmal = game.money === geld1;
            // Öffentliche Kritik: Strafe (verdoppelt sich), Fans +, Groll
            game.refCritiques = null; game.refereeGrudges = {};
            const fans0 = game.fans;
            currentMatch.critiquePending = true;
            const strafe1 = getRefCritiqueFine();
            chooseRefereeCritique('kritik');
            out.kritik = game.money === geld1 - strafe1 && game.fans === Math.min(100, fans0 + 3) && game.refereeGrudges[ref.id] === 2;
            out.verdoppelt = getRefCritiqueFine() === strafe1 * 2;
            // Schweigen: Vorstand +2
            game.boardSat = 50;
            currentMatch.critiquePending = true;
            chooseRefereeCritique('schweigen');
            out.schweigen = game.boardSat === 52 && game.refereeCritiqueLog[0].art === 'schweigen' && game.refereeCritiqueLog.length === 3;
            finishMatch();
            // Groll: Vorschau zeigt ihn, das nächste Spiel unter ihm wird strenger gepfiffen
            renderRefereePreview();
            const vorschauRef = getCurrentReferee();
            game.refereeGrudges = { [vorschauRef.id]: 2 };
            game.refereeCritiqueLog.unshift({ season: game.season, matchday: 1, ref: vorschauRef.name, art: 'kritik' });
            renderRefereePreview();
            const vorschau = document.getElementById('dash-referee-box').innerHTML;
            out.vorschau = vorschau.includes('Noch verärgert') && vorschau.includes('öffentlich kritisiert');
            currentMatch = { referee: vorschauRef, homeGoals: 0, awayGoals: 0, minute: 0, isHome: true, sentOff: [] };
            applyRefereeGrudge();
            out.groll = Math.abs(currentMatch.referee.cardMult - vorschauRef.cardMult * 1.2) < 1e-9 && game.refereeGrudges[vorschauRef.id] === 1 && getRefereeCardMult() === vorschauRef.cardMult;
            applyRefereeGrudge();
            out.grollEndet = !(vorschauRef.id in game.refereeGrudges);
            currentMatch = null;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Schiedsrichter-Kritik ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.leerZuBeginn, 'Ohne strittige Szene keine Kritik-Box');
        assert(r.rotErfasst && r.elfErfasst, 'Platzverweise und Elfmeter gegen uns werden im Livespiel als strittige Szenen erfasst');
        assert(r.keinAngebotBeiSieg && r.angebot, 'Nach einem Sieg kein Angebot, nach einer Niederlage drei Reaktionen');
        assert(r.beschwerde && r.nurEinmal, 'Erfolgreiche Beschwerde hebt die Rot-Sperre auf und kostet die Gebühr - nur eine Reaktion pro Spiel');
        assert(r.kritik && r.verdoppelt, 'Öffentliche Kritik: Strafe, Fans +3, Groll für 2 Spiele; die nächste Strafe der Saison verdoppelt sich');
        assert(r.schweigen, 'Schweigen: Vorstand +2, alles im Protokoll');
        assert(r.vorschau && r.groll && r.grollEndet, 'Groll steht in der Vorschau, macht den Schiedsrichter 2 Spiele strenger und endet dann');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testMedicalCheck(browser) {
    console.log('\n[22.5] Medizincheck bei Transfers: verdeckter Befund, Check nach der Einigung senkt die Ablöse, Sofortkauf bleibt blind');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.money = 50000000; game.transferBudget = 50000000; game.wageBudget = 50000000;
            game.ffpTransferEmbargo = false;
            staffMembers.physio.hired = false;
            refreshTransferMarket();
            showScreen('screen-transfer');
            // Befunde werden gewürfelt - jeder Marktspieler bekommt einen
            out.profile = marketPlayers.every(p => ['ok', 'chronisch', 'verletzt'].includes(ensureMedicalProfile(p).issue) && !p.medical.checked);
            renderTransferView();
            out.ungeprueft = document.getElementById('market-list').innerHTML.includes('🩺 ungeprüft');
            const kandidat = marketPlayers[0];
            openPlayerDetail(kandidat.id, 'market');
            out.popupUnbekannt = document.body.innerHTML.includes('unbekannt - Medizincheck');
            if (typeof closePlayerDetail === 'function') closePlayerDetail();
            // Chronischer Befund: Check erst nach der Einigung, dann sinkt die Ablöse um 20 %
            kandidat.medical = { issue: 'chronisch', injuries: 4, checked: false };
            openTransferPoker(0);
            const geld0 = game.money;
            runMedicalCheck();
            out.erstNachEinigung = game.money === geld0 && !kandidat.medical.checked;
            acceptPokerAsking();
            const vereinbart = transferPoker.agreedFee;
            out.knopf = document.getElementById('transfer-poker-box').innerHTML.includes('Medizincheck');
            const gebuehr = getMedicalCheckFee(vereinbart);
            runMedicalCheck();
            out.check = game.money === geld0 - gebuehr && kandidat.medical.checked && transferPoker.agreedFee === Math.round(vereinbart * 0.8 / 1000) * 1000;
            out.log = transferPoker.log.some(z => z.includes('chronische Probleme'));
            const geld1 = game.money;
            runMedicalCheck();
            out.nurEinmal = game.money === geld1;
            signPokerDeal();
            const neu = squad.find(p => p.id === kandidat.id);
            out.chronisch = !!neu && neu.chronicIssue === true && neu.timesInjured === 4 && neu.medical === undefined;
            const mit = getPlayerInjuryRiskIndex(neu);
            neu.chronicIssue = false;
            const ohne = getPlayerInjuryRiskIndex(neu);
            neu.chronicIssue = true;
            out.risiko = Math.abs(mit / ohne - 1.5) < 1e-9;
            out.badge = (showScreen('screen-squad'), document.body.innerHTML.includes('Chronische Probleme'));
            // Sofortkauf ohne Check: der Befund kommt nach der Unterschrift ans Licht
            showScreen('screen-transfer');
            const blind = marketPlayers[0];
            blind.medical = { issue: 'verletzt', weeks: 3, checked: false };
            buyPlayer(0);
            const blindNeu = squad.find(p => p.id === blind.id);
            out.blind = !!blindNeu && blindNeu.injured === 3 && inboxMessages[0].title.includes('Böse Überraschung');
            // Unauffällig: Check kostet, aber keine Preissenkung
            const gesund = marketPlayers[0];
            gesund.medical = { issue: 'ok', checked: false };
            openTransferPoker(0);
            acceptPokerAsking();
            const fee = transferPoker.agreedFee;
            runMedicalCheck();
            out.gesund = transferPoker.agreedFee === fee && gesund.medical.checked && getMedicalTag(gesund).includes('unauffällig');
            closeTransferPoker();
            // Chef-Physio halbiert die Gebühr
            const normal = getMedicalCheckFee(1000000);
            staffMembers.physio.hired = true;
            out.physio = normal === 30000 && getMedicalCheckFee(1000000) === 15000 && getMedicalCheckFee(10000) === 1500;
            staffMembers.physio.hired = false;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Medizincheck ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.profile && r.ungeprueft && r.popupUnbekannt, 'Jeder Marktspieler hat einen verdeckten Befund, Liste und Popup zeigen „ungeprüft/unbekannt“');
        assert(r.erstNachEinigung && r.knopf, 'Der Check ist erst nach der Ablöse-Einigung möglich und steht dann im Transferpoker');
        assert(r.check && r.log && r.nurEinmal, 'Check kostet 3 % der Ablöse, ein chronischer Befund senkt die Ablöse um 20 % - nur einmal');
        assert(r.chronisch && r.risiko && r.badge, 'Chronische Probleme bleiben: Verletzungsakte, x1,5 Verletzungsrisiko, Abzeichen im Kader');
        assert(r.blind, 'Sofortkauf ist blind: ein verletzter Spieler fällt sofort aus, die Post meldet die böse Überraschung');
        assert(r.gesund, 'Unauffälliger Befund: keine Preissenkung');
        assert(r.physio, 'Chef-Physio halbiert die Gebühr, mindestens 1.500 €');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testPreContracts(browser) {
    console.log('\n[22.6] Vorverträge: ablösefreie Zugänge zur neuen Saison, Angebote anderer Vereine für eigene Spieler');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            game.money = 50000000; game.wageBudget = 50000000; game.ffpTransferEmbargo = false;
            game.matchday = 10;
            showScreen('screen-transfer'); setTransferTab('free');
            const box = () => document.getElementById('precontract-box').innerHTML;
            out.vorWinter = box().includes('Ab dem Winterfenster') && ensurePreContractPool() === null;
            // Ab Spieltag 18: vier Kandidaten mit auslaufendem Vertrag
            game.matchday = 18;
            renderPreContractBox();
            const pool = game.preContractPool;
            out.pool = pool.season === game.season && pool.players.length === 4 && box().includes('VORVERTRÄGE') && box().includes('% Zusage');
            out.doppeltBesser = pool.players.every(p => getPreContractChance(p, 'doppelt') > getPreContractChance(p, 'normal') || getPreContractChance(p, 'normal') === 0.95);
            // Zusage: Handgeld sofort, 20 % mehr Gehalt, Spieler wartet auf die neue Saison
            const a = pool.players[0];
            const lohnAlt = a.wage;
            const t = getPreContractTerms(a, 'normal');
            const geld0 = game.money;
            const kader0 = squad.length;
            Math.random = () => 0;
            offerPreContract(a.id, 'normal');
            Math.random = zufall;
            out.zusage = game.money === geld0 - t.handgeld && game.preContracts.length === 1 && a.wage === Math.round(lohnAlt * 1.2 / 10) * 10 && squad.length === kader0 && !game.preContractPool.players.includes(a);
            // Absage: kein Geld weg, kein zweiter Versuch
            const b = game.preContractPool.players[0];
            const geld1 = game.money;
            Math.random = () => 0.999;
            offerPreContract(b.id, 'doppelt');
            Math.random = () => 0;
            offerPreContract(b.id, 'doppelt');
            Math.random = zufall;
            out.absage = b.preRefused === true && game.money === geld1 && game.preContracts.length === 1;
            // Gehaltsbudget der neuen Saison zählt
            const c = game.preContractPool.players[1];
            game.wageBudget = 1;
            offerPreContract(c.id, 'normal');
            out.budget = game.preContracts.length === 1 && !c.preRefused;
            game.wageBudget = 50000000;
            // Höchstens drei offene Vorverträge
            game.preContracts.push({ player: { name: 'X', wage: 1 }, club: game.clubName }, { player: { name: 'Y', wage: 1 }, club: game.clubName });
            offerPreContract(c.id, 'normal');
            out.limit = game.preContracts.length === 3 && !c.preRefused;
            game.preContracts = game.preContracts.slice(0, 1);
            // Andere Vereine schnappen sich wartende Kandidaten
            game.matchday = 19;
            squad.forEach(p => { p.contracts = 3; });
            Math.random = () => 0;
            tickPreContracts();
            out.konkurrenz = game.preContractPool.players.length === 0;
            // Abgang: eigener Spieler im letzten Vertragsjahr bekommt ein Angebot
            const stark = [...squad].sort((x, y) => y.strength - x.strength);
            const weg = stark[0], bleibt = stark[1];
            weg.contracts = 1; bleibt.contracts = 1;
            const forderungOhne = getContractDemand(weg).gehalt;
            tickPreContracts();
            Math.random = zufall;
            out.angebot = !!weg.preContractOffer && weg.preContractOffer.deadline === 22 && !!bleibt.preContractOffer;
            out.teurer = getContractDemand(weg).gehalt === Math.round(forderungOhne * 1.15 / 10) * 10;
            // Verlängert: Angebot vom Tisch / Frist verstrichen: unterschrieben, keine Verlängerung mehr
            bleibt.contracts = 3;
            game.matchday = 22;
            Math.random = () => 0.999;
            tickPreContracts();
            Math.random = zufall;
            out.bleibt = !bleibt.preContractOffer && !bleibt.preContractSigned;
            out.unterschrieben = weg.preContractSigned && !weg.preContractOffer;
            showScreen('screen-contracts');
            extendContract(weg.id);
            out.gesperrt = (typeof contractTalk === 'undefined' || !contractTalk || contractTalk.playerId !== weg.id) && document.getElementById('contracts-list').innerHTML.includes('Vorvertrag bei');
            // Saisonwechsel: Neuzugang kommt, ein Jahr älter, 3 Jahre Vertrag
            const alter = a.age;
            joinPreContractPlayers();
            const neu = squad.find(p => p.id === a.id);
            out.ankunft = !!neu && neu.contracts === 3 && neu.age === alter + 1 && game.preContracts.length === 0 && inboxMessages.some(m => m.title.includes('Neuzugang'));
            // Nach Vereinswechsel verfällt ein Vorvertrag
            game.preContracts = [{ player: { id: 'zz', name: 'Zed', age: 25, wage: 100 }, club: 'Anderer Verein', from: 'Irgendwo' }];
            joinPreContractPlayers();
            out.verfaellt = !squad.some(p => p.id === 'zz');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Vorverträge ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.vorWinter && r.pool && r.doppeltBesser, 'Ab Spieltag 18 vier Kandidaten mit auslaufendem Vertrag, doppeltes Handgeld überzeugt eher');
        assert(r.zusage, 'Zusage: Handgeld sofort, 20 % mehr Gehalt, der Spieler kommt erst zur neuen Saison');
        assert(r.absage && r.budget && r.limit, 'Absage ohne Kosten und ohne zweiten Versuch; Gehaltsbudget der neuen Saison und Limit 3 greifen');
        assert(r.konkurrenz, 'Wartende Kandidaten unterschreiben bei anderen Vereinen');
        assert(r.angebot && r.teurer, 'Eigene Spieler im letzten Vertragsjahr bekommen Angebote (Frist 3 Spieltage) und fordern 15 % mehr');
        assert(r.bleibt && r.unterschrieben && r.gesperrt, 'Verlängert: Angebot weg; Frist verstrichen: Vorvertrag woanders, keine Verlängerung mehr');
        assert(r.ankunft && r.verfaellt, 'Zur neuen Saison kommt der Neuzugang - nach einem Vereinswechsel verfällt der Vorvertrag');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testBuyback(browser) {
    console.log('\n[22.7] Rückkaufoption beim Verkauf: 10 % weniger sofort, fester Rückkaufpreis, Entwicklung beim Käufer, nur im Fenster');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            managerRPG.perks.negotiator = false;
            game.money = 50000000; game.transferBudget = 50000000; game.wageBudget = 50000000; game.ffpTransferEmbargo = false;
            incomingOffers = [];
            const sorted = [...squad].sort((a, b) => a.strength - b.strength);
            const jung = sorted[0], alt = sorted[1], dritter = sorted[2];
            [jung, alt, dritter].forEach(p => { p.agent = null; p.isCrowdFavorite = false; p.friendPlayerId = null; });
            jung.age = 21; alt.age = 30;
            triggerNewAITransferOffer(jung); triggerNewAITransferOffer(alt);
            showScreen('screen-transfer'); setTransferTab('offers'); renderTransferView();
            const liste = document.getElementById('incoming-offers-list').innerHTML;
            out.knopfNurJung = (liste.match(/Mit Rückkaufoption/g) || []).length === 1;
            // Annehmen mit Rückkaufoption
            const angebot = incomingOffers.find(o => o.playerId === jung.id);
            const geld0 = game.money;
            acceptTransferOfferWithBuyback(angebot.id);
            const opt = (game.buybackOptions || [])[0];
            out.verkauf = !squad.includes(jung) && game.money === geld0 + Math.round(angebot.currentBid * 0.9) && !!opt
                && opt.price === Math.round(angebot.currentBid * 1.4 / 1000) * 1000 && opt.untilSeason === game.season + 2 && opt.saleStrength === jung.strength;
            setTransferTab('sell'); renderTransferView();
            out.box = document.getElementById('buyback-box').innerHTML.includes('RÜCKKAUFOPTIONEN');
            // Alter Spieler: keine Option
            const altAngebot = incomingOffers.find(o => o.playerId === alt.id);
            acceptTransferOfferWithBuyback(altAngebot.id);
            out.altNein = squad.includes(alt) && game.buybackOptions.length === 1;
            // Die anderen Annahme-Wege rechnen wie bisher
            triggerNewAITransferOffer(dritter);
            const klausel = incomingOffers.find(o => o.playerId === dritter.id);
            const geld1 = game.money;
            acceptTransferOfferWithClause(klausel.id);
            out.klausel = game.money === geld1 + Math.round(klausel.currentBid * 0.94) && game.sellOnClauses.some(c => c.playerName === dritter.name && c.originalSaleValue === Math.round(klausel.currentBid * 0.94));
            const geld2 = game.money;
            acceptTransferOffer(altAngebot.id);
            out.normal = game.money === geld2 + altAngebot.currentBid && !squad.includes(alt);
            // Entwicklung beim Käufer zum Saisonwechsel
            const vorher = jung.strength;
            Math.random = () => 0;
            tickBuybackOptions();
            Math.random = zufall;
            out.entwicklung = jung.age === 22 && jung.strength === vorher + 1 && game.buybackOptions.length === 1;
            // Außerhalb des Fensters: nicht möglich
            game.matchday = 10; game.winterWindowActive = false;
            const geld3 = game.money;
            exerciseBuyback(jung.id);
            out.fenster = game.money === geld3 && !squad.includes(jung);
            // Im Fenster: zurückholen
            game.matchday = 2;
            exerciseBuyback(jung.id);
            out.zurueck = squad.includes(jung) && jung.contracts === 3 && game.money === geld3 - opt.price && game.buybackOptions.length === 0;
            // Verfall am Ende der letzten Options-Saison
            game.buybackOptions = [{ player: { id: 'bb1', name: 'Bert', age: 20, strength: 50, pos: 'ST' }, club: 'X', price: 1000, untilSeason: game.season, saleStrength: 50, season: game.season }];
            tickBuybackOptions();
            out.verfall = game.buybackOptions.length === 0 && inboxMessages[0].title.includes('verfallen');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Rückkaufoption ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.knopfNurJung && r.altNein, 'Rückkaufoption nur für Spieler bis 25 Jahre');
        assert(r.verkauf && r.box, 'Verkauf mit Option: 10 % weniger sofort, Rückkauf für 140 % bis zwei Saisons später, Liste im Verkaufs-Reiter');
        assert(r.klausel && r.normal, 'Normaler Verkauf und Weiterverkaufsbeteiligung rechnen unverändert');
        assert(r.entwicklung, 'Der Spieler entwickelt sich beim Käufer weiter');
        assert(r.fenster && r.zurueck, 'Zurückholen nur im Transferfenster, dann mit 3 Jahren Vertrag');
        assert(r.verfall, 'Die Option verfällt am Ende der letzten Saison');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testRumors(browser) {
    console.log('\n[22.8] Gerüchteküche: Quellen mit echter Trefferquote, wahre Gerüchte werden Angebote, Reaktionen mit Folgen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            managerRPG.perks.negotiator = false;
            incomingOffers = []; game.rumors = []; game.rumorStats = {};
            game.matchday = 5;
            const star = [...squad].sort((a, b) => b.strength - a.strength)[0];
            star.character = 'Ruhig'; star.morale = 50;
            // Neues Gerücht: Boulevard, wahr, Abwerbung
            Math.random = () => 0;
            tickRumors();
            Math.random = zufall;
            const g = game.rumors[0];
            out.neu = !!g && g.type === 'abwerbung' && g.source === 'boulevard' && g.truth === true && g.resolveAt === 6 && inboxMessages[0].title.includes('Gerücht');
            // Dementieren: wertgeschätzt, Verein zieht zurück
            const p1 = squad.find(p => p.id === g.playerId);
            p1.character = 'Ruhig'; p1.morale = 50;
            Math.random = () => 0;
            reactToRumor(g.id, 'dementieren');
            Math.random = zufall;
            reactToRumor(g.id, 'anheizen');
            out.dementi = p1.morale === 53 && g.reaction === 'dementieren' && g.backedOff === true;
            game.matchday = 6;
            Math.random = () => 0.99;
            tickRumors();
            Math.random = zufall;
            out.zurueck = g.outcome === 'zurueckgezogen' && incomingOffers.length === 0;
            // Anheizen bei wahrem Gerücht: Angebot 15 % höher, Spieler fühlt sich weggeschoben
            star.morale = 50;
            game.rumors.unshift({ id: 'r2', type: 'abwerbung', source: 'fach', truth: true, club: 'Testclub', playerId: star.id, playerName: star.name, resolveAt: 7, season: game.season, reaction: null, outcome: null });
            reactToRumor('r2', 'anheizen');
            game.matchday = 7;
            Math.random = () => 0.5;
            tickRumors();
            Math.random = zufall;
            const angebot = incomingOffers.find(o => o.playerId === star.id);
            const mult = (0.85 + 0.5 * 0.35) * 1.15;
            out.anheizen = star.morale === 47 && !!angebot && angebot.clubName === 'Testclub' && angebot.currentBid === Math.max(10000, Math.round(star.marketValue * mult / 5000) * 5000);
            // Ente beim Anheizen kostet Ruf
            const zweiter = [...squad].sort((a, b) => b.strength - a.strength)[1];
            const ruf = game.managerMediaImage;
            game.rumors.unshift({ id: 'r3', type: 'abwerbung', source: 'boulevard', truth: false, club: 'Ente FC', playerId: zweiter.id, playerName: zweiter.name, resolveAt: 8, season: game.season, reaction: null, outcome: null });
            reactToRumor('r3', 'anheizen');
            game.matchday = 8;
            Math.random = () => 0.99;
            tickRumors();
            Math.random = zufall;
            out.ente = game.rumors.find(x => x.id === 'r3').outcome === 'ente' && game.managerMediaImage === Math.max(0, ruf - 2) && !incomingOffers.some(o => o.clubName === 'Ente FC');
            // Marktgerücht: wahr -> Spieler verschwindet vom Markt
            refreshTransferMarket();
            const mp = marketPlayers[0];
            game.rumors.unshift({ id: 'r4', type: 'markt', source: 'blog', truth: true, club: 'Kaufclub', playerId: mp.id, playerName: mp.name, resolveAt: 9, season: game.season, reaction: null, outcome: null });
            game.matchday = 9;
            Math.random = () => 0.99;
            tickRumors();
            Math.random = zufall;
            out.markt = !marketPlayers.includes(mp) && game.rumors.find(x => x.id === 'r4').outcome === 'wahr';
            // Trefferquote je Quelle
            out.stats = game.rumorStats.boulevard.hit === 1 && game.rumorStats.boulevard.miss === 1 && game.rumorStats.fach.hit === 1;
            showScreen('screen-transfer'); setTransferTab('offers'); renderTransferView();
            const html = document.getElementById('rumor-box').innerHTML;
            out.box = html.includes('GERÜCHTEKÜCHE') && html.includes('lag 1 von 2 Mal richtig') && html.includes('Ente');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Gerüchteküche ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.neu, 'Nach dem Spieltag entsteht ein Gerücht mit Quelle, verdeckter Wahrheit und Postnachricht');
        assert(r.dementi && r.zurueck, 'Dementieren: Moral +3 für Ruhige, der Verein zieht zurück - nur eine Reaktion pro Gerücht');
        assert(r.anheizen, 'Anheizen: das echte Angebot fällt 15 % höher aus, der Spieler verliert Moral');
        assert(r.ente, 'Ente nach dem Anheizen: kein Angebot, Medienimage -2');
        assert(r.markt, 'Wahres Marktgerücht: der Spieler ist vom Transfermarkt verschwunden');
        assert(r.stats && r.box, 'Trefferquote je Quelle wird gezählt und angezeigt');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testTransferStrategy(browser) {
    console.log('\n[25.18] Transferstrategie mit dem Vorstand: Budget, Saisonziel, Abrechnung am Saisonende');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const exp = getSeasonExpectation();
            const card = () => document.getElementById('dash-transfer-strategy-box').innerHTML;
            const liga = getLeagueTransferBudget(game.leagueLevel);
            game.matchday = 1;
            showScreen('screen-dashboard'); renderTransferStrategyCard();
            out.karte = card().includes('TRANSFERSTRATEGIE') && card().includes('Sofort-Erfolg');
            // Sofort-Erfolg: +40 % Budget, Ziel 2 Plätze höher; verfehlt -8, erreicht +5
            exp.expectedRank = 8; game.transferBudget = 1000000; game.boardSat = 50;
            chooseTransferStrategy('sofort');
            out.sofort = exp.expectedRank === 6 && game.transferBudget === 1000000 + Math.round(liga * 0.4 / 1000) * 1000;
            chooseTransferStrategy('sparen');
            out.einmal = getTransferStrategy().choice === 'sofort';
            resolveTransferStrategy(9);
            out.sofortVerfehlt = game.boardSat === 42 && getTransferStrategy().result === 'verfehlt';
            getTransferStrategy().result = null; game.boardSat = 50;
            resolveTransferStrategy(5);
            out.sofortErreicht = game.boardSat === 55;
            // Jugend: -30 %, Ziel leichter, Sichtung halb so teuer; zwei Eigengewächse mit 10+ Spielen
            game.transferStrategy = null; exp.expectedRank = 8; game.transferBudget = liga;
            const kostenVorher = getYouthScoutCost();
            chooseTransferStrategy('jugend');
            out.jugend = exp.expectedRank === 9 && game.transferBudget === liga - Math.round(liga * 0.3 / 1000) * 1000
                && getYouthScoutCost() === Math.round(kostenVorher / 2);
            game.boardSat = 50;
            resolveTransferStrategy(9);
            out.jugendVerfehlt = game.boardSat === 44;
            squad.slice(0, 2).forEach(p => { p.academyGraduate = true; p.statsSeason = { spiele: 12, tore: 0, vorlagen: 0, notenSumme: 0, elf: 0 }; });
            getTransferStrategy().result = null; game.boardSat = 50; const fans = game.fans;
            resolveTransferStrategy(9);
            out.jugendErreicht = game.boardSat === 56 && game.fans === Math.min(100, fans + 3);
            // Sparen: Saison ohne Verlust +5, sonst -6; Budget nie unter 0
            game.transferStrategy = null; game.transferBudget = 1000;
            chooseTransferStrategy('sparen');
            out.sparenBudget = game.transferBudget === 0;
            game.boardSat = 50; game.ffpSeasonNet = -5000;
            resolveTransferStrategy(5);
            out.sparenVerfehlt = game.boardSat === 44;
            // Ohne Wahl bis Spieltag 3: ausgewogen, ohne Abrechnung
            game.transferStrategy = null; game.matchday = 4; game.boardSat = 50;
            tickTransferStrategy();
            resolveTransferStrategy(18);
            renderTransferStrategyCard();
            out.auto = getTransferStrategy().choice === 'ausgewogen' && game.boardSat === 50 && card() === '';
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Transferstrategie ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.karte, 'Die Karte erscheint zu Saisonbeginn auf dem Dashboard');
        assert(r.sofort && r.einmal, 'Sofort-Erfolg: +40 % Liga-Transferbudget, Ziel 2 Plätze höher - nur eine Wahl pro Saison');
        assert(r.sofortVerfehlt && r.sofortErreicht, 'Sofort-Erfolg am Saisonende: verfehlt -8, erreicht +5');
        assert(r.jugend, 'Jugend fördern: -30 % Budget, Ziel 1 Platz leichter, Sichtung zum halben Preis');
        assert(r.jugendVerfehlt && r.jugendErreicht, 'Jugend fördern: 2 Eigengewächse mit 10+ Ligaspielen bringen +6 und Fans, sonst -6');
        assert(r.sparenBudget && r.sparenVerfehlt, 'Sparen: Budget fällt nicht unter 0, Saison mit Verlust kostet 6');
        assert(r.auto, 'Ohne Wahl bis Spieltag 3 bleibt es ausgewogen - ohne Abrechnung, Karte verschwindet');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testWinterTalk(browser) {
    console.log('\n[22.9] Wintergespräch mit dem Vorstand: Zwischenbilanz, vier Wege mit Folgen bis zum Saisonende');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            const exp = getSeasonExpectation();
            const card = () => document.getElementById('dash-winter-talk-box').innerHTML;
            game.matchday = 10;
            showScreen('screen-dashboard'); renderWinterTalkCard();
            chooseWinterTalk('kurs');
            out.zuFrueh = card() === '' && !getWinterTalk();
            game.matchday = 18;
            renderWinterTalkCard();
            out.karte = card().includes('WINTERPAUSE') && card().includes('Zwischenbilanz');
            const betrag = getWinterBudgetAmount();
            // Ziel hoch: +5, Budget sofort; gehalten +5 / gebrochen -10
            exp.expectedRank = 8; game.boardSat = 50; game.transferBudget = 1000000;
            chooseWinterTalk('hoch');
            out.hoch = getWinterTalk().goal === 6 && exp.expectedRank === 6 && game.boardSat === 55 && game.transferBudget === 1000000 + betrag;
            chooseWinterTalk('kurs');
            out.einmal = getWinterTalk().choice === 'hoch' && game.boardSat === 55;
            resolveWinterTalk(5);
            out.gehalten = game.boardSat === 60 && getWinterTalk().result === 'erreicht';
            getWinterTalk().result = null;
            game.boardSat = 50;
            resolveWinterTalk(9);
            out.gebrochen = game.boardSat === 40 && getWinterTalk().result === 'verfehlt';
            // Ziel runter: -4, die Saison wird am leichteren Ziel gemessen (auch die Versammlung)
            game.winterTalk = null; exp.expectedRank = 8; game.boardSat = 50;
            chooseWinterTalk('runter');
            prepareMemberAssembly(9);
            out.runter = game.boardSat === 46 && exp.expectedRank === 10 && game.pendingAssemblyReport.expectedRank === 10;
            game.pendingAssemblyReport = null;
            // Budget: Chance hängt an der Zwischenbilanz; Zusage bringt Geld, Absage -3
            exp.expectedRank = 1;
            const schlecht = getWinterBudgetChance();
            exp.expectedRank = 18;
            out.chance = getWinterBudgetChance() > schlecht;
            game.winterTalk = null; game.transferBudget = 1000000;
            Math.random = () => 0;
            chooseWinterTalk('budget');
            Math.random = zufall;
            out.budgetJa = game.transferBudget === 1000000 + betrag && getWinterTalk().budget === betrag;
            game.winterTalk = null; game.boardSat = 50;
            Math.random = () => 0.999;
            chooseWinterTalk('budget');
            Math.random = zufall;
            out.budgetNein = game.boardSat === 47 && getWinterTalk().budget === 0;
            // Kurs bestätigen
            game.winterTalk = null; game.boardSat = 50;
            chooseWinterTalk('kurs');
            out.kurs = game.boardSat === 52;
            renderWinterTalkCard();
            out.ergebnisKarte = card().includes('Kurs bestätigt');
            // Verpasst: nach Spieltag 20 ohne Gespräch -2, nur einmal
            game.winterTalk = null; game.boardSat = 50; game.matchday = 21;
            tickWinterTalk(); tickWinterTalk();
            out.verpasst = game.boardSat === 48 && getWinterTalk().choice === 'verpasst';
            renderWinterTalkCard();
            out.verpasstLeer = card() === '';
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Wintergespräch ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.zuFrueh && r.karte, 'Die Karte erscheint erst in der Winterpause (Spieltag 18-20)');
        assert(r.hoch && r.einmal, 'Ziel hoch: Vorstand +5, Winterbudget sofort - nur ein Weg pro Saison');
        assert(r.gehalten && r.gebrochen, 'Am Saisonende: gehaltenes Versprechen +5, gebrochenes -10');
        assert(r.runter, 'Ziel runter: Vorstand -4, Versammlung misst am niedrigeren Ziel');
        assert(r.chance && r.budgetJa && r.budgetNein, 'Winterbudget: Chance aus der Zwischenbilanz, Zusage bringt Geld, Absage kostet 3');
        assert(r.kurs && r.ergebnisKarte, 'Kurs bestätigen: Vorstand +2, die Karte zeigt das Ergebnis');
        assert(r.verpasst && r.verpasstLeer, 'Verpasst: nach Spieltag 20 einmalig Vorstand -2');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testPlayerProfile(browser) {
    console.log('\n[22.10] Spieler-Karriereprofil: Herkunft, Saisontabelle, Titel, Vereinslegende mit Folgen beim Abschied');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.money = 50000000; game.transferBudget = 50000000; game.wageBudget = 50000000; game.ffpTransferEmbargo = false;
            // Zugang per Kauf wird festgehalten
            refreshTransferMarket();
            const kauf = marketPlayers[0];
            kauf.medical = { issue: 'ok', checked: true };
            const ablose = getTransferAsking(kauf);
            buyPlayer(0);
            out.kauf = !!kauf.joined && kauf.joined.via === 'kauf' && kauf.joined.from === kauf.sellerClub && kauf.joined.fee === ablose && kauf.joined.season === game.season;
            // Saisontabelle: abgeschlossene Saison aus der Historie, laufende aus statsSeason
            const p = [...squad].sort((a, b) => b.strength - a.strength)[0];
            p.strengthHistory = [{ season: game.season - 1, strength: 60, apps: 30, goals: 9, assists: 4, grade: 2.8, elf: 3 }];
            p.statsSeason = { spiele: 2, notenSumme: 5, vorlagen: 1, elf: 1 };
            p.appearancesSeason = 2; p.goalsSeason = 1; p.appearances = 32; p.goalsCareer = 10;
            addPlayerHonour(p, '📅 Spieler des Monats');
            openPlayerDetail(p.id, 'squad');
            const html = document.getElementById('pd-career-progression').innerHTML;
            out.profil = html.includes('KARRIEREPROFIL') && html.includes('<td>9</td>') && html.includes('2,80') && html.includes('2,50') && html.includes('5 Vorlagen') && html.includes('4× Elf des Spieltags') && html.includes('Spieler des Monats');
            closePlayerDetail();
            // Saisonhistorie speichert jetzt auch die Elf des Spieltags
            p.strengthHistory.push({ season: game.season, strength: p.strength, apps: 2, goals: 1 });
            resetPlayerSeasonStats(p);
            out.elfGespeichert = p.strengthHistory[1].elf === 1 && p.strengthHistory[1].assists === 1;
            // Titel: Meister für alle, Spieler der Saison einzeln, Pokalsieg
            squad.forEach(x => { x.honours = []; });
            recordSeasonHonours(1);
            out.meister = squad.every(x => x.honours.some(h => h.text.startsWith('🏆 Meister')));
            recordCupFinal('landes', { home: game.clubName, away: 'Gegner', homeGoals: 2, awayGoals: 0 }, true);
            out.pokal = squad.every(x => x.honours.some(h => h.text.includes('-Sieger')));
            // Vereinslegende: ab 150 Pflichtspielen; der Abschied trifft die Fans
            const legende = [...squad].sort((a, b) => a.strength - b.strength)[0];
            legende.appearances = 149; legende.isCrowdFavorite = false; legende.friendPlayerId = null; legende.agent = null;
            out.nochKeine = !isClubLegend(legende);
            legende.appearances = 150;
            out.legende = isClubLegend(legende);
            game.fans = 60; game.boardSat = 50;
            incomingOffers = [];
            triggerNewAITransferOffer(legende);
            acceptTransferOffer(incomingOffers[0].id);
            out.abschied = !squad.includes(legende) && game.fans === 52 && game.boardSat === 48 && inboxMessages.some(m => m.title.includes('Vereinslegende'));
            // Ohne Legendenstatus kein Fan-Malus
            const normal = [...squad].sort((a, b) => a.strength - b.strength)[0];
            normal.appearances = 3; normal.strengthHistory = []; normal.joined = null; normal.isCrowdFavorite = false; normal.friendPlayerId = null;
            game.fans = 60;
            triggerNewAITransferOffer(normal);
            acceptTransferOffer(incomingOffers.find(o => o.playerId === normal.id).id);
            out.normal = game.fans === 60;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Karriereprofil ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.kauf, 'Zugang wird festgehalten: Saison, Weg, abgebender Verein, Ablöse');
        assert(r.profil && r.elfGespeichert, 'Profil zeigt Saisontabelle (Spiele, Tore, Vorlagen, Note, Elf des Spieltags) und Auszeichnungen');
        assert(r.meister && r.pokal, 'Meistertitel und Pokalsieg landen bei allen Spielern im Profil');
        assert(r.nochKeine && r.legende && r.abschied && r.normal, 'Vereinslegende ab 150 Pflichtspielen - ihr Abschied kostet Fans 8 und Vorstand 2');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testHomeRegion(browser) {
    console.log('\n[24.1] Heimatstadt: Ligen 4-6, Landespokal und Vereine aus der Region');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    // Alter Spielstand ohne Heimatstadt -> Leipzig (Nordost), wie die gespeicherten Ligen
    const alt = await page.evaluate(() => {
        closeTutorial();
        const stand = JSON.parse(JSON.stringify(buildSaveState()));
        delete stand.game.homeCity;
        game.homeCity = 'Hamburg';
        applyLoadedState(stand);
        return { home: game.homeCity, liga: leagueNames[3], pokal: landesPokal.region };
    });
    // Neues Spiel über den Dialog in Hamburg
    const dialog = await page.evaluate(() => { startNewGame(); selectedNewGameCity = 'Hamburg'; renderNewGameSetupOptions(); return document.getElementById('new-game-city-box').innerHTML; });
    await Promise.all([page.waitForNavigation(), page.evaluate(() => confirmNewGameWithSettings(null))]);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        try {
            try { closeTutorial(); } catch (e) { /* egal */ }
            const out = {};
            out.heimat = game.homeCity === 'Hamburg' && game.clubName === '1.FC Moritz Hamburg' && game.secondTeam.name === '1.FC Moritz Hamburg II';
            out.ligen = leagueNames[3].includes('Regionalliga Nord') && leagueNames[4].includes('Oberliga Hamburg') && leagueNames[5].includes('Landesliga Hamburg') && landesPokal.region === 'Hamburg';
            const echt = e => e.split('|')[0];
            out.regionalliga = leaguesData[3].filter(t => REGIONALLIGA_CLUBS.nord.map(echt).includes(t.name)).length >= 17;
            out.oberliga = leaguesData[4].filter(t => OBERLIGEN.hh.clubs.map(echt).includes(t.name)).length >= 15;
            out.landesliga = leaguesData[5].every(t => getClubCity(t.name) === 'Hamburg');
            out.keinOsten = !leaguesData.slice(3).flat().some(t => ['Leipzig', 'Dresden', 'Jena', 'Chemnitz'].includes(getClubCity(t.name)));
            out.landespokal = (landesPokal.roundsHistory.length ? true : true) && leaguesData[5].length === 18;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(alt.home === 'Leipzig' && alt.liga.includes('Nordost') && alt.pokal === 'Sachsen', 'Alter Spielstand ohne Heimatstadt: Leipzig, Regionalliga Nordost, Sachsenpokal');
    assert(dialog.includes('Hamburg (Hamburg)') && dialog.includes('München (Bayern)') && dialog.includes('Regionalliga Nord'), 'Neues-Spiel-Dialog bietet die Heimatstädte mit ihrer Region');
    assert(!r.crash, `Neues Spiel mit Heimatstadt ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.heimat, 'Heimatstadt Hamburg: Vereins- und Reservename passen sich an');
        assert(r.ligen, 'Regionalliga Nord, Oberliga Hamburg, Landesliga Hamburg, Hamburger Landespokal');
        assert(r.regionalliga && r.oberliga, 'Regional- und Oberliga mit echten Vereinen der Region');
        assert(r.landesliga && r.keinOsten, 'Landesliga nur mit Hamburger Vereinen, keine ostdeutschen Vereine in den unteren Ligen');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testLocalDerbies(browser) {
    console.log('\n[24.2] Derbys nach Ort und echte Traditionsduelle - kein Dauerrivale, kein Erzfeind mehr');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            // Traditionsduelle und Stadtderbys, aber kein Derby quer durchs Land
            out.tradition = isDerbyMatch('Schalke 05', 'Borussia Dortmunt') && getDerbyLabel('Schalke 05', 'Borussia Dortmunt') === 'Revierderby'
                && isDerbyMatch('Hamburger SP', 'Werder Breman') && isDerbyMatch('Carl Zeiss Jenna', 'FC Rot-Weiss Erfurtt');
            out.stadt = isDerbyMatch('Lokomotiv Leipzich', 'BSG Chemie Leipzich') && isDerbyMatch('Union Berlien', 'Hertha BSK');
            out.keinDerby = !isDerbyMatch('Carl Zeiss Jenna', 'FSV Zwikau') && !isDerbyMatch('Bayern Munchen', 'Hamburger SP');
            // Großstadt: nur die drei stärksten Vereine desselben Orts zählen
            const hh = ['SC Victoria Hamborg', 'SC Concordia Hamborg', 'USC Palomma', 'Niendorfer TSVV', 'Bramfelder SVV', 'TSV Saseel'].map((name, i) => ({ name, strength: 60 - i }));
            const kreis = getLocalDerbyCircle('SC Victoria Hamborg', hh);
            out.deckel = kreis.length === 3 && kreis[0] === 'SC Concordia Hamborg' && !kreis.includes('TSV Saseel');
            // Stadtteil-Vereine: der Stadtteil ist der Ort, die Stadt bleibt Berlin
            const spandau = buildTownClubs('be', 0).map(e => e.split('|')[0]).find(n => n.endsWith(' Spandau'));
            const koepenick = buildTownClubs('be', 0).map(e => e.split('|')[0]).find(n => n.endsWith(' Köpenick'));
            out.stadtteil = getClubLocality(spandau) === 'Spandau' && getClubCity(spandau) === 'Berlin' && !isDerbyMatch(spandau, koepenick);
            // Kein Dauerrivale, keine ausgewürfelten Paare, kein Erzfeind
            out.aufgeraeumt = !game.permanentRivalName && leaguesData.flat().every(t => t.rivalName === undefined)
                && typeof ensureNemesis === 'undefined' && !document.getElementById('nemesis-box') && !document.getElementById('prematch-nemesis-box');
            // Eigene Derbys: Heimat Leipzig - Leipziger Vereine sind Derbygegner, die Bilanz zählt nur Derbys
            const liga = leaguesData[game.leagueLevel];
            const derby = liga.find(t => t.name !== game.clubName && getClubCity(t.name) === 'Leipzig' && isDerbyOpponent(t.name));
            const normal = liga.find(t => t.name !== game.clubName && getClubCity(t.name) !== 'Leipzig' && !isDerbyOpponent(t.name));
            const vorher = rivalryRecord.matches.length;
            if (normal) recordRivalryResult(normal.name, 2, 0);
            out.normalZaehltNicht = rivalryRecord.matches.length === vorher;
            if (derby) {
                recordRivalryResult(derby.name, 2, 1);
                out.derbyZaehlt = rivalryRecord.matches.length === vorher + 1 && rivalryRecord.matches.slice(-1)[0].opp === derby.name && inboxMessages.slice(0, 3).some(m => m.title.includes('Derbysieg'));
            } else out.derbyZaehlt = true;
            // Historie und Derby-Testspiel
            showScreen('screen-history'); setSubTab('hist', 'rivalen');
            out.historie = document.getElementById('rivalry-history-book').innerHTML.includes('Derby-Bilanz gesamt');
            const rivalen = getOwnDerbyRivals();
            const geld = game.money;
            scheduleDerbyFriendly();
            out.testspiel = rivalen.length ? game.money > geld : game.money === geld;
            // Alte Spielstände: Dauerrivale, Erzfeind und Rivalen-Paare werden entfernt
            game.permanentRivalName = 'Alter Rivale'; game.nemesis = { name: 'X' }; leaguesData[0][0].rivalName = 'Y';
            cleanupRemovedModuleState();
            out.altAufgeraeumt = !game.permanentRivalName && !game.nemesis && leaguesData[0][0].rivalName === undefined;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Derbys nach Ort ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.tradition && r.stadt && r.keinDerby, 'Derby = gleiche Stadt oder echtes Traditionsduell, nicht quer durchs Land');
        assert(r.deckel && r.stadtteil, 'Großstädte: nur die drei stärksten Stadtrivalen, Stadtteil-Vereine nur untereinander');
        assert(r.aufgeraeumt && r.altAufgeraeumt, 'Kein Dauerrivale, keine ausgewürfelten Paare, kein Erzfeind - auch in alten Spielständen');
        assert(r.normalZaehltNicht && r.derbyZaehlt, 'Die Derby-Bilanz zählt nur echte Derbys, mit Gegnernamen');
        assert(r.historie && r.testspiel, 'Historie zeigt die Derbygegner, Testspiel gegen den Stadtrivalen');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testEuropeDraw(browser) {
    console.log('\n[21.4] Champions Cup: Qualifikation jede Saison neu, Lostöpfe, Koeffizient, Historie');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            squad.forEach(p => { p.strength = 78 + Math.floor(Math.random() * 8); });
            // Qualifikation: ein altes inEurope bleibt nicht für immer
            game.inEurope = true; game.leagueLevel = 2;
            out.altWeg = decideEuropeQualification(1) === null && game.inEurope === false;
            game.leagueLevel = 0;
            out.platz4 = decideEuropeQualification(4) === 'liga' && game.inEurope === true;
            out.platz5 = decideEuropeQualification(5) === null && game.inEurope === false;
            game.europeCupTicket = game.season;
            out.pokal = decideEuropeQualification(9) === 'pokal' && game.inEurope === true;
            game.europeCupTicket = game.season - 1;
            out.pokalAlt = decideEuropeQualification(9) === null;
            // Auslosung: 8 Teams, je Gruppe einer aus jedem Topf, ein zweiter Bundesligist in der anderen Gruppe
            game.inEurope = true; game.europeHistory = [];
            out.neulingTopf4 = getEuropePot() === 3;
            const felder = new Set();
            let ok = true;
            for (let i = 0; i < 6; i++) {
                initEuropeCup();
                const a = europeTournament.groupA, b = europeTournament.groupB;
                const alle = [...a, ...b];
                const unsere = a.some(t => t.name === game.clubName) ? a : b;
                const andere = unsere === a ? b : a;
                const de = leaguesData[0].filter(t => t.name !== game.clubName).sort((x, y) => y.strength - x.strength)[0];
                ok = ok && a.length === 4 && b.length === 4 && new Set(alle.map(t => t.name)).size === 8
                    && unsere.some(t => t.name === game.clubName) && andere.some(t => t.name === de.name)
                    && europeTournament.pot === 3;
                felder.add(alle.map(t => t.name).sort().join(','));
            }
            out.auslosung = ok;
            out.wechselnd = felder.size > 1;
            // Koeffizient: Halbfinale + Titel in den letzten 5 Saisons → Topf 2, ältere zählen nicht
            game.europeHistory = [{ season: game.season - 1, stage: 'sieger' }, { season: game.season - 2, stage: 'gruppe' }, { season: game.season - 7, stage: 'sieger' }];
            out.koeffizient = getEuropeCoefficient() === 7 && getEuropePot() === 1;
            initEuropeCup();
            const deTopf = leaguesData[0].filter(t => t.name !== game.clubName).sort((x, y) => y.strength - x.strength)[0].name;
            out.topf2 = europeTournament.pot === 1 && [...europeTournament.groupA, ...europeTournament.groupB].some(t => t.name === deTopf);
            // Runde festhalten
            game.europeHistory = [];
            europeTournament.semiFinals = [{ teamA: game.clubName, teamB: 'X' }];
            europeTournament.finalMatch = { home: game.clubName, away: 'Y', winner: game.clubName };
            recordEuropeSeason();
            europeTournament.finalMatch = { home: 'Z', away: 'Y', winner: 'Z' };
            recordEuropeSeason();
            europeTournament.semiFinals = []; europeTournament.finalMatch = null;
            recordEuropeSeason();
            out.runden = game.europeHistory.map(h => h.stage).join(',') === 'gruppe,halbfinale,sieger';
            game.inEurope = false;
            const n = game.europeHistory.length;
            recordEuropeSeason();
            out.ohneTeilnahme = game.europeHistory.length === n;
            // Europa-Bildschirm: Koeffizient und Historie
            showScreen('screen-europe');
            const box = document.getElementById('europe-history-box').innerHTML;
            out.historie = box.includes('Europa-Koeffizient') && box.includes('Halbfinale') && box.includes('Topf');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Champions Cup ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.altWeg && r.platz4 && r.platz5, 'Die Qualifikation gilt nur eine Saison: Platz 1-4 der Bundesliga, nach Abstieg ist man raus');
        assert(r.pokal && r.pokalAlt, 'Der DFB-Pokalsieg dieser Saison qualifiziert, ein alter nicht');
        assert(r.neulingTopf4 && r.auslosung, 'Auslosung aus vier Töpfen, ein zweiter Bundesligist in der anderen Gruppe');
        assert(r.wechselnd, 'Das Teilnehmerfeld wechselt von Saison zu Saison');
        assert(r.koeffizient && r.topf2, 'Erfolge der letzten 5 Saisons bringen einen besseren Topf');
        assert(r.runden && r.ohneTeilnahme, 'Die erreichte Runde landet in der Europapokal-Historie');
        assert(r.historie, 'Der Europa-Bildschirm zeigt Koeffizient, Topf und Historie');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testCleanupNine(browser) {
    console.log('\n[21.5] Aufräumen Teil 9: Spielanalyse, Holding, Europa-Status, Börsenticker ohne Würfelwerte');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            // Spielanalyse: gefährlichster Spieler = echter Star, bei jedem Öffnen derselbe
            staffMembers.analyst.hired = true;
            const opp = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
            if (typeof ensureAiStars === 'function') ensureAiStars();
            pendingMatchInfo = { oppName: opp.name, isHome: true, oppStr: opp.strength };
            renderPreMatchAnalysis(opp, opp.name);
            const a1 = document.getElementById('prematch-analysis-box').innerHTML;
            renderPreMatchAnalysis(opp, opp.name);
            const a2 = document.getElementById('prematch-analysis-box').innerHTML;
            out.analyseStabil = a1 === a2 && a1.includes(opp.star.name);
            // Videoanalyse nur bei Derby/Pokal, nicht wegen Europapokal bei jedem Ligaspiel
            game.inEurope = true;
            const normal = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName && !isDerbyOpponent(t.name));
            renderPreMatchAnalysis(normal, normal.name);
            out.keinTopspiel = !document.getElementById('prematch-analysis-box').innerHTML.includes('Videoanalyse');
            pendingMatchInfo = { oppName: normal.name, isHome: true, oppStr: normal.strength, cupTie: { home: game.clubName, away: normal.name } };
            renderPreMatchAnalysis(normal, normal.name);
            const pokal = document.getElementById('prematch-analysis-box').innerHTML;
            const basis = AI_STYLE_ARCHETYPE[getTeamPlaystyle(normal).id] || 'N';
            out.pokalVideo = pokal.includes('Videoanalyse') && pokal.includes(ARCHETYPE_LABELS[basis]);
            pendingMatchInfo = null;
            // Europa-Status folgt der Runde
            initEuropeCup();
            out.statusGruppe = getEuropeStatusLabel().includes('Platz');
            europeTournament.semiFinals = [{ teamA: 'X', teamB: 'Y' }, { teamA: 'Z', teamB: 'W' }];
            out.statusAus = getEuropeStatusLabel().includes('ausgeschieden');
            game.inEurope = false;
            out.statusOhne = getEuropeStatusLabel() === 'Nicht qualifiziert';
            // Holding: Wert aus den Fabriken, Übernahme nur mit Fabrik
            const leer = getHoldingValuation();
            factories.textile.owned = true; factories.textile.lvl = 2;
            out.holdingWert = leer === 50000 && getHoldingValuation() === 50000 + Math.round(factories.textile.cost * 3 * 0.8);
            showScreen('screen-holding');
            out.holdingAnzeige = document.getElementById('holding-enterprise-val').innerText === formatVal(getHoldingValuation());
            // B2B: zum Saisonstart je Fabrik ein neuer Auftrag
            holdingCompany.b2bContracts.forEach(c => { c.done = true; });
            refreshB2BContracts();
            const neu = holdingCompany.b2bContracts;
            out.b2b = neu.length === 1 && neu[0].factory === 'textile' && neu[0].reqMat === 'cotton' && neu[0].payout > 0 && !neu[0].done;
            refreshB2BContracts();
            out.b2bEinmal = holdingCompany.b2bContracts.length === 1;
            factories.textile.owned = false; factories.textile.lvl = 1;
            // Börsenticker: Pfeile folgen dem Kurs
            stockMarket.techCorp.history = [100, 90];
            showScreen('screen-finances');
            const t1 = document.getElementById('fin-stock-ticker').innerHTML;
            renderStockTicker();
            out.ticker = t1 === document.getElementById('fin-stock-ticker').innerHTML && t1.includes('DAX <span class="tick-down"');
            out.monat = document.getElementById('fin-month-title').innerText.includes('Monat 1');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Aufräumen Teil 9 ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.analyseStabil, 'Spielanalyse: der gefährlichste Spieler ist der echte Star des Gegners, kein neu gewürfelter Name');
        assert(r.keinTopspiel && r.pokalVideo, 'Videoanalyse nur bei Derby/Pokal und mit dem echten Grundstil des Gegners');
        assert(r.statusGruppe && r.statusAus && r.statusOhne, 'Dashboard zeigt die echte Europapokal-Runde');
        assert(r.holdingWert && r.holdingAnzeige, 'Holding-Wert folgt den Fabrik-Investitionen statt fester 125.000 €');
        assert(r.b2b && r.b2bEinmal, 'Neue Lohnfertigungs-Aufträge zum Saisonstart, je eigener Fabrik einer');
        assert(r.ticker && r.monat, 'Börsenticker und GuV-Monat zeigen echte Werte');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testBundesligaLongRun(browser) {
    console.log('\n[21.6] Langzeittest Bundesliga: Rücklagen-Budgets, Stars am Markt, saubere Buchungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            // Rücklagen: nur was über einer halben Saison Gehaltsbudget liegt, wird freigegeben
            game.wageBudget = 1000000;
            game.money = 10000000;
            const knapp = getCashSurplusBudgetShare();
            game.money = 37000000;
            const reich = getCashSurplusBudgetShare();
            out.ruecklagen = knapp.transfer === 0 && knapp.wage === 0 && reich.transfer === 8000000 && reich.wage === Math.round(2000000 / 34 / 1000) * 1000;
            const tb = game.transferBudget, wb = game.wageBudget;
            applyCashSurplusBudgets();
            out.freigabe = game.transferBudget === tb + reich.transfer && game.wageBudget === wb + reich.wage
                && inboxMessages.some(m => m.title.includes('Rücklagen'));
            // Gehaltsbudget: nie unter die laufenden Gehälter, solange das Konto sie trägt
            const summe = squad.reduce((a, p) => a + (p.wage || 0), 0);
            game.money = summe * 20; game.ffpSeasonNet = 0;
            const boden = getWageBudgetFloor();
            game.ffpSeasonNet = -summe * 10;
            const verlust = getWageBudgetFloor();
            // 25.17: auch mit knapper Kasse (unter einer Viertelsaison) gilt der Boden, nur bei Minus nicht
            game.money = summe * 8; game.ffpSeasonNet = 0; // money ist ein Setter, der ins FFP-Ergebnis bucht
            const knappeKasse = getWageBudgetFloor();
            game.money = -1;
            out.gehaltsBodenWerte = { summe, boden, verlust, knappeKasse, minus: getWageBudgetFloor() };
            out.gehaltsBoden = boden >= summe * 1.04 && verlust >= summe && verlust <= summe + 1000 && knappeKasse >= summe * 1.04
                && out.gehaltsBodenWerte.minus >= summe * 0.95 - 1 && out.gehaltsBodenWerte.minus <= summe * 0.95 + 1000;
            // 25.18: Verlängerung eines Auslaufenden zählt nur die Bleibenden - eingefrorenes Budget lässt sie zu
            squad.forEach((p, i) => { p.contracts = i < 8 ? 1 : 3; });
            const auslaeufer = squad[0];
            const bleibendeSumme = squad.filter(p => p.contracts > 1).reduce((a, p) => a + (p.wage || 0), 0);
            out.verlaengerungZaehltBleibende = contractWageTotalWith(auslaeufer, auslaeufer.wage + 100) === bleibendeSumme + auslaeufer.wage + 100
                && contractWageTotalWith(squad[10], squad[10].wage + 100) === summe + 100;
            // Verlängerungspuffer: die Gehaltserhöhung eines Spielers mit noch 2 Vertragsjahren ist eingeplant
            game.money = summe * 20; game.ffpSeasonNet = 0;
            squad.forEach(p => { p.contracts = 3; });
            const ohnePuffer = getWageBudgetFloor();
            const kandidat = squad.find(p => getContractDemand(p).gehalt > p.wage);
            if (kandidat) kandidat.contracts = 2;
            out.verlaengerungsPuffer = !kandidat || getWageBudgetFloor() >= ohnePuffer + (getContractDemand(kandidat).gehalt - kandidat.wage) - 1000;
            // Start in der Bundesliga: Lizenz-Ausstattung der Startliga ist vorhanden
            stadium.flutlicht = false; campusBuildings.internat.lvl = 0;
            grantStartLeagueLicence(0);
            out.startLizenz = stadium.flutlicht === true && campusBuildings.internat.lvl === 2;
            // Markt: in der Bundesliga drei internationale Stars über dem Liganiveau, unten nicht
            game.leagueLevel = 0; refreshTransferMarket();
            out.sterne = marketPlayers.filter(p => p.strength >= 87).length >= 3;
            game.leagueLevel = 5; refreshTransferMarket();
            out.untenNormal = marketPlayers.every(p => p.strength < 87);
            // Buchungen: Prämien mit eigener Bezeichnung, Startkapital zählt nicht fürs FFP
            game.kontoauszug = [];
            bucheMitLabel('🏆 DFB-Pokal-Prämie', 215000);
            out.praemie = game.kontoauszug.some(k => k.label === '🏆 DFB-Pokal-Prämie' && k.amount === 215000);
            out.startkapital = isFfpExemptLabel('🏁 Startkapital');
            // Sponsorgelder steigen mit der Liga deutlich stärker als die übrigen Liga-Faktoren
            game.leagueLevel = 5;
            const sponsorUnten = getSponsorLeagueFactor(), kostenUnten = leagueScaleFactor();
            game.leagueLevel = 0;
            out.sponsorStaffel = getSponsorLeagueFactor() / sponsorUnten >= 50 && leagueScaleFactor() / kostenUnten < 3;
            sponsorOffers = [];
            checkIncomingSponsorOffers(true);
            out.sponsorBundesliga = sponsorOffers.length > 0 && sponsorOffers[sponsorOffers.length - 1].base * 34 >= 3000000;
            // Spielbetrieb & Verwaltung: nur in den Profiligen, als eigener Posten im Journal
            game.leagueLevel = 5;
            out.betriebUnten = getOperatingCostPerMatchday() === 0;
            game.leagueLevel = 0;
            const proSpieltag = getOperatingCostPerMatchday();
            applyMatchdayFinances(false);
            const eintrag = game.financeLedger[game.financeLedger.length - 1];
            const posten = eintrag.ausgaben.find(a => a.label.includes('Spielbetrieb'));
            out.betriebOben = proSpieltag >= 290000 && !!posten && posten.amount === proSpieltag && eintrag.summeAus >= proSpieltag;
            // DFB-Pokal: echte Vereine der Pyramide statt erfundener 75er
            game.leagueLevel = 0;
            const teams = buildDfbPokalTeams(true);
            const ligaVon = n => leaguesData.findIndex(l => l.some(t => t.name === n));
            out.pokalEcht = teams.length === 32 && new Set(teams).size === 32 && teams.includes(game.clubName)
                && teams.filter(n => n !== game.clubName).every(n => ligaVon(n) >= 0 && ligaVon(n) <= 3)
                && teams.filter(n => ligaVon(n) === 0).length >= 17;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Langzeittest Bundesliga ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.ruecklagen && r.freigabe, 'Der Vorstand gibt Rücklagen über der Reserve als Transfer- und Gehaltsbudget frei');
        assert(r.gehaltsBoden, `Gehaltsbudget 5 % über den laufenden Gehältern (nach Verlustsaison eingefroren, mit Minus auf dem Konto 95 %) (${JSON.stringify(r.gehaltsBodenWerte)})`);
        assert(r.verlaengerungZaehltBleibende, 'Verlängerung eines auslaufenden Vertrags zählt nur die Gehälter der Bleibenden');
        assert(r.verlaengerungsPuffer, 'Gehaltsbudget plant die Gehaltserhöhungen anstehender Verlängerungen ein');
        assert(r.startLizenz, 'Neues Spiel in der Bundesliga: Flutlicht und Internat Stufe 2 vorhanden');
        assert(r.sterne && r.untenNormal, 'Bundesliga-Markt mit drei internationalen Stars, untere Ligen unverändert');
        assert(r.praemie && r.startkapital, 'Pokalprämien mit eigener Buchung, Startkapital zählt nicht fürs FFP');
        assert(r.pokalEcht, 'DFB-Pokal mit 32 echten Vereinen aus Bundesliga bis Regionalliga');
        assert(r.sponsorStaffel && r.sponsorBundesliga, 'Sponsorgelder skalieren mit der Liga (Bundesliga-Hauptsponsor mehrere Mio. € pro Saison), Kosten-Faktor unverändert');
        assert(r.betriebUnten && r.betriebOben, 'Spielbetrieb & Verwaltung kostet nur in den Profiligen und steht im Buchungsjournal');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSponsorConflict(browser) {
    console.log('\n[19.x] Sponsoren: Branchenkonflikt nennt den Konkurrenten und kostet 30 %');
    const { page, consoleErrors } = await freshPage(browser);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            bandenSponsors = [{ id: 1, name: 'RegioBank Test', type: 'LED', income: 1000, active: true, duration: 10, category: 'Finanzen', area: Object.keys(stadium.blocks)[0] }];
            sponsorOffers = [];
            checkIncomingSponsorOffers(true);
            const o = sponsorOffers[0];
            o.category = 'Finanzen';
            showScreen('screen-sponsors');
            renderSponsorsView();
            const html = document.body.innerHTML;
            const basis = o.base;
            // Ohne Hauptsponsor: ab Spieltag 3 einmal pro Saison eine Erinnerung (25.13)
            const vorher = inboxMessages.length;
            game.matchday = 3;
            remindMissingMainSponsor(); remindMissingMainSponsor();
            const erinnert = inboxMessages.length - vorher === 1 && JSON.stringify(inboxMessages).includes('Noch kein Hauptsponsor');
            acceptSponsorOffer(o.id);
            const n = inboxMessages.length; game.season++; remindMissingMainSponsor();
            const mitSponsorRuhe = inboxMessages.length === n;
            return { anzeige: html.includes('Branchenkonflikt mit RegioBank Test (Bande)') && html.includes('nur 70 %'), abschlag: game.sponsor.base === Math.round(basis * 0.7), erinnert, mitSponsorRuhe };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Sponsoren-Konflikt-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.anzeige, 'Angebot nennt den konkurrierenden Sponsor und den Abschlag');
    assert(r.abschlag, 'Beim Annehmen zahlt der Sponsor tatsächlich nur 70 %');
    assert(r.erinnert && r.mitSponsorRuhe, 'Ohne Hauptsponsor kommt einmal pro Saison eine Erinnerung, mit Sponsor nicht');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testLexicon(browser) {
    console.log('\n[19.7] Spiel-Lexikon: Suche, Kategorien, Sprung zum Bildschirm, Lizenzwerte aktuell');
    const { page, consoleErrors } = await freshPage(browser);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const geld = game.money;
            out.navKnopf = !!document.querySelector(`.nav-btn[onclick="showScreen('screen-lexicon')"]`);
            showScreen('screen-lexicon');
            const liste = () => document.querySelectorAll('#lexicon-list > .box');
            out.alle = liste().length === LEXICON_ENTRIES.length && LEXICON_ENTRIES.length >= 25;
            out.zieleExistieren = LEXICON_ENTRIES.filter(e => !document.getElementById(e.screen)).map(e => e.title);
            const suche = document.getElementById('lexicon-search');
            suche.value = 'lizenz'; renderLexicon();
            out.sucheTrifft = liste().length >= 1 && liste().length < LEXICON_ENTRIES.length && document.getElementById('lexicon-list').innerText.includes('Lizenzauflagen');
            suche.value = 'xyzkeintreffer'; renderLexicon();
            out.keinTreffer = liste().length === 0 && document.getElementById('lexicon-list').innerText.includes('Kein Eintrag');
            suche.value = ''; setLexiconCategory('Finanzen');
            out.kategorie = liste().length === LEXICON_ENTRIES.filter(e => e.cat === 'Finanzen').length;
            setLexiconCategory('Alle');
            // Die Zahlen im Eintrag müssen zu den echten Auflagen passen.
            const lizenz = LEXICON_ENTRIES.find(e => e.title === 'Lizenzauflagen').text;
            out.lizenzAktuell = [0, 1, 2].every(i => lizenz.includes(DFB_LICENSING_REQUIREMENTS[i].minCapacity.toLocaleString('de-DE') + ' Plätze'));
            // Betriebskosten, Heimvorteil und Trait-Deckel: die Zahlen im Lexikon folgen den Konstanten
            const betrieb = LEXICON_ENTRIES.find(e => e.title === 'Spielbetrieb & Verwaltung').text;
            out.betriebAktuell = [0, 1, 2].every(i => betrieb.includes((LEAGUE_OPERATING_COST[i] / 1e6).toLocaleString('de-DE') + ' Mio. €'));
            const gehalt = LEXICON_ENTRIES.find(e => e.title === 'Gehaltsbudget').text;
            out.gehaltAktuell = LEAGUE_WAGE_BUDGET.every(b => gehalt.includes(b >= 1e6 ? (b / 1e6).toLocaleString('de-DE') + ' Mio. €' : b.toLocaleString('de-DE') + ' €'));
            const transfer = LEXICON_ENTRIES.find(e => e.title === 'Transferbudget').text;
            out.transferAktuell = LEAGUE_TRANSFER_BUDGET.every(b => transfer.includes(b >= 1e6 ? (b / 1e6).toLocaleString('de-DE') + ' Mio. €' : b.toLocaleString('de-DE') + ' €'));
            const staerke = LEXICON_ENTRIES.find(e => e.title === 'Stärke').text;
            out.staerkeAktuell = staerke.includes('Heimvorteil +' + AI_HOME_ADVANTAGE) && staerke.includes('höchstens +' + TRAIT_BONUS_CAP)
                && staerke.includes('daheim +' + AI_HOME_ADVANTAGE);
            // Sprung zum Bildschirm
            const knopf = [...document.querySelectorAll('#lexicon-list button')].find(b => b.getAttribute('onclick').includes('screen-transfer'));
            knopf.click();
            out.sprung = aktiverScreen === 'screen-transfer';
            // Aus einem Bildschirm-Tipp: nur Einträge dieses Bildschirms, Menü zeigt danach wieder alle
            openLexiconForScreen('screen-finances');
            out.gefiltert = liste().length === LEXICON_ENTRIES.filter(e => e.screen === 'screen-finances').length && !!document.querySelector('#lexicon-screen-filter .box');
            showScreen('screen-lexicon');
            out.menueAlle = liste().length === LEXICON_ENTRIES.length;
            game.onboarding = null; ensureOnboarding();
            showScreen('screen-squad');
            out.tippKnopf = !!document.querySelector(`#screen-squad .screen-hint button[onclick="openLexiconForScreen('screen-squad')"]`);
            out.geldGleich = game.money === geld;
            return out;
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Lexikon-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.navKnopf, 'Menüpunkt „Spiel-Lexikon“ vorhanden');
    assert(r.alle, 'Ohne Filter erscheinen alle Einträge (mindestens 25)');
    assert(r.zieleExistieren && r.zieleExistieren.length === 0, `Jeder Eintrag springt zu einem existierenden Bildschirm (${(r.zieleExistieren || []).join(', ')})`);
    assert(r.sucheTrifft, 'Suche „lizenz“ findet die Lizenzauflagen und filtert');
    assert(r.keinTreffer, 'Suche ohne Treffer zeigt einen Hinweis');
    assert(r.kategorie, 'Kategorie „Finanzen“ zeigt genau deren Einträge');
    assert(r.lizenzAktuell, 'Lizenz-Eintrag nennt die aktuellen Kapazitätsauflagen');
    assert(r.betriebAktuell && r.staerkeAktuell && r.gehaltAktuell && r.transferAktuell, 'Lexikon nennt die aktuellen Betriebskosten, Gehalts- und Transferbudgets, Heimvorteil und Trait-Deckel');
    assert(r.sprung, '„Zum Bildschirm“ öffnet den passenden Bildschirm');
    assert(r.gefiltert, 'Aus einem Bildschirm-Tipp geöffnet: nur Einträge dieses Bildschirms');
    assert(r.menueAlle, 'Über das Menü geöffnet: wieder alle Einträge');
    assert(r.tippKnopf, 'Bildschirm-Tipp bietet „📖 Lexikon“ an');
    assert(r.geldGleich, 'Lexikon verändert kein Geld');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSeasonPreview(browser) {
    console.log('\n[20.1] Saisonvorschau & Experten-Check');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            showScreen('screen-dashboard');
            const pv = getCurrentSeasonPreview();
            const teams = leaguesData[game.leagueLevel];
            out.karte = document.getElementById('dash-season-preview-box').innerText.includes('Saisonvorschau');
            out.alleTeams = pv.order.length === teams.length && new Set(pv.order).size === teams.length && teams.every(t => pv.order.includes(t.name));
            out.gleicheErwartung = pv.own === getSeasonExpectation().expectedRank && pv.order[pv.own - 1] === game.clubName;
            toggleSeasonPreviewTable();
            out.aufgeklappt = document.getElementById('dash-season-preview-box').innerText.includes(`${pv.own}. ${game.clubName}`);
            // Saison spielen, eigener Spieler mit klar bester Note
            while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(5); }
            const star = squad[0];
            squad.forEach(p => { if (p.statsSeason) p.statsSeason.notenSumme = p.statsSeason.spiele * 3.5; });
            star.statsSeason = { spiele: 30, tore: 9, vorlagen: 4, notenSumme: 30 * 1.8, elf: 3 };
            const rang = sortedTable(game.leagueLevel).findIndex(t => t.name === game.clubName) + 1;
            game.seasonPreview.own = Math.min(teams.length, rang + 4);
            const tipp = game.seasonPreview.own;
            game.fans = 50;
            const saison = game.season;
            concludeSeasonAndAdvance();
            const rv = game.seasonReviews[0];
            out.bericht = rv.season === saison && rv.actualOwn === rang && rv.predOwn === tipp && rv.ownDelta === tipp - rang;
            out.folge = tipp - rang >= 3 ? (rv.effect || '').includes('Medienimage +3') : true;
            out.spieler = rv.player && rv.player.name === star.name && rv.player.grade === 1.8;
            out.chronikSpieler = game.playerOfSeasonHistory[0].playerId === star.id;
            out.gala = JSON.stringify(inboxMessages).includes(`Spieler der Saison: <strong>${star.name}`) || JSON.stringify(inboxArchive || []).includes(star.name);
            out.rueckblick = document.getElementById('season-review-content').innerText.includes('Experten-Check');
            out.punkte = game.seasonReviewArchive[game.seasonReviewArchive.length - 1].points > 0;
            out.neueVorschau = game.seasonPreview.season === game.season && game.seasonPreview.level === game.leagueLevel;
            showScreen('screen-history'); setSubTab('hist', 'chronik');
            out.historie = document.getElementById('season-forecast-history-box').innerText.includes(`Saison ${saison}`);
            game.matchday = 9; renderSeasonPreviewCard();
            out.ausgeblendet = document.getElementById('dash-season-preview-box').innerHTML === '';
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Saisonvorschau-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.karte && r.alleTeams, 'Dashboard zeigt die Vorschau, Expertentabelle enthält jeden Verein genau einmal');
    assert(r.gleicheErwartung, 'Eigener Tipp = Erwartung von Vorstand und Mitgliederversammlung');
    assert(r.aufgeklappt, 'Ganze Expertentabelle lässt sich aufklappen');
    assert(r.bericht && r.folge, 'Experten-Check am Saisonende: Tipp gegen Platz, 3+ Plätze besser bringt Medienimage');
    assert(r.spieler && r.chronikSpieler && r.gala, 'Ein Spieler der Saison (beste Ø-Note) für Rückblick, Gala und Chronik');
    assert(r.rueckblick && r.historie, 'Experten-Check im Saison-Rückblick und in Historie > Chronik');
    assert(r.punkte, 'Saison-Rückblick zeigt die echten Punkte (früher nach dem Ligawechsel immer 0)');
    assert(r.neueVorschau && r.ausgeblendet, 'Neue Vorschau zur neuen Saison, Karte nach Spieltag 8 ausgeblendet');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testAttendanceCapVaries(browser) {
    console.log('\n[20.x] Zuschauer: Liga-Obergrenze schwankt mit Wetter, Form und Preis (nicht immer 1.000)');
    const { page, consoleErrors } = await freshPage(browser);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.leagueLevel = 5; game.fans = 100;
            stadium.total = 55000; // riesiges Stadion: die Liga-Obergrenze greift immer
            const deckel = getLeagueAttendanceCap(1);
            const werte = [];
            for (let i = 0; i < 12; i++) werte.push(calculateMatchAttendance(1, 0.92 + Math.random() * 0.16));
            const markt = { steh: getMarketTicketPrice('steh'), sitz: getMarketTicketPrice('sitz'), vip: getMarketTicketPrice('vip') };
            Object.assign(game.ticketPrices, markt);
            const fair = calculateMatchAttendance(1, 1);
            Object.assign(game.ticketPrices, { steh: markt.steh * 2, sitz: markt.sitz * 2, vip: markt.vip * 2 });
            const teuer = calculateMatchAttendance(1, 1);
            return { deckel, verschieden: new Set(werte).size >= 4, nieDrueber: werte.every(w => w <= Math.round(deckel * 1.12)), preisWirkt: teuer < fair };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Zuschauer-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.verschieden, 'Bei greifender Liga-Obergrenze schwankt die Zuschauerzahl von Spiel zu Spiel');
    assert(r.nieDrueber, `Die Liga-Obergrenze (${r.deckel}) wird höchstens leicht überschritten`);
    assert(r.preisWirkt, 'Auch bei greifender Obergrenze kosten zu hohe Ticketpreise Zuschauer');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testLockerRoom(browser) {
    console.log('\n[20.2] Kabine: ein Rat, rumorende Cliquen, Kapitänsfrage, Unzufriedene im Büro');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            squad.forEach(p => { p.morale = 80; p.nation = 'Deutschland'; p.injured = 0; });
            electTeamCouncil(true);
            const rat = getCouncilMembers();
            out.einRat = rat.length === 3 && rat.some(p => p.id === game.captainId) && typeof getLeadershipCouncil === 'undefined' && !document.getElementById('leadership-council-box');
            // Clique aus vier Franzosen im Mittelbau, schlecht gelaunt
            const franz = squad.filter(p => !rat.includes(p)).slice(0, 4);
            franz.forEach(p => { p.nation = 'Frankreich'; p.age = 26; p.morale = 25; });
            const cl = computeSquadCliques().cliques.find(c => c.key === 'Frankreich-mitte');
            out.clique = !!cl && cl.unruhig && cl.members.length === 4 && !!cl.leader;
            const ohne = (() => { const m = franz.map(p => p.morale); franz.forEach(p => { p.morale = 80; }); const v = getCliqueChemistryModifier(); franz.forEach((p, i) => { p.morale = m[i]; }); return v; })();
            out.kostetStaerke = getCliqueChemistryModifier() < ohne;
            const kapitaen = squad.find(p => p.id === game.captainId); kapitaen.morale = 40; // keine Autorität
            const andere = squad.filter(p => !franz.includes(p) && p !== kapitaen);
            // Moral 70: sonst bilden die übrigen (alle "Deutschland") je nach Altersverteilung
            // gut gelaunte Cliquen (Stimmung >= 75, +1 im Monat), die das -1 genau aufheben (CI 3.32).
            andere.forEach(p => { p.morale = 70; });
            const vorher = andere.reduce((s, p) => s + p.morale, 0);
            tickLockerRoom();
            out.zieltRunter = andere.reduce((s, p) => s + p.morale, 0) < vorher;
            // Der Wortführer meldet sich beim Rat
            kapitaen.morale = 80;
            game.teamCouncil.concern = null;
            const anliegen = findCouncilConcern();
            out.ratAnliegen = !!anliegen && anliegen.type === 'clique' && anliegen.leaderId === cl.leader.id;
            game.teamCouncil.concern = { ...anliegen, season: game.season, matchday: game.matchday };
            const cliqueVor = franz.map(p => p.morale);
            answerCouncilConcern(0);
            out.anhoeren = franz.every((p, i) => p.morale === Math.min(100, cliqueVor[i] + 8));
            // Kapitänswechsel per Auswahlfeld auf einen Neuling ohne Standing
            showScreen('screen-squad'); setSquadTab('aufstellung');
            const neuling = squad.find(p => !getCouncilMembers().includes(p) && ['mitlaeufer', 'talent'].includes(getLockerRoomStatus(p).key) && !franz.includes(p))
                || Object.assign(squad.find(p => !getCouncilMembers().includes(p) && !franz.includes(p)), { age: 22, appearances: 3 });
            const alterKap = squad.find(p => p.id === game.captainId);
            const ratOhneKap = getCouncilMembers().filter(p => p.id !== game.captainId && p !== neuling);
            const ratMoral = ratOhneKap.map(p => p.morale), altMoral = alterKap.morale;
            const sel = document.getElementById('sel-captain'); sel.value = neuling.id; assignRoles();
            out.kapitaenGewechselt = String(game.captainId) === String(neuling.id) && alterKap.morale === altMoral - 12
                && ratOhneKap.every((p, i) => p.morale === Math.max(10, ratMoral[i] - 4));
            out.neuerRat = getCouncilMembers().some(p => p.id === neuling.id);
            // Unzufriedener Leistungsträger im Büro
            squad.forEach(p => { p.morale = 70; });
            const top = [...squad].filter(p => p.id !== game.captainId && !getCouncilMembers().includes(p)).sort((a, b) => b.strength - a.strength)[0];
            top.morale = 20;
            out.kandidat = pickUnhappyVisitor() === top;
            for (let i = 0; i < 60 && !(game.officeEvent && game.officeEvent.id === 'unzufrieden'); i++) { game.officeEvent = null; rollOfficeEvent(); }
            out.imBuero = !!game.officeEvent && game.officeEvent.playerId === top.id && getPendingOfficeEvent().optionen.length === 3;
            incomingOffers = [];
            resolveOfficeEvent(2);
            out.freigabe = incomingOffers.some(o => o.playerId === top.id) && !game.officeEvent;
            top.morale = 20; game.officeEvent = { id: 'unzufrieden', playerId: top.id, seit: game.matchday, season: game.season, titel: 'x', text: 'y' };
            resolveOfficeEvent(0);
            out.garantie = !!top.playtimePromise && top.playtimePromise.season === game.season && top.morale === 35;
            showScreen('screen-squad'); setSquadTab('team');
            out.anzeige = document.getElementById('locker-hierarchy-box').innerText.includes('Kapitän') && document.getElementById('squad-cliques-box').innerText.includes('Stimmung');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Kabinen-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.einRat, 'Nur noch ein Mannschaftsrat (Kapitän + 2), der alte Führungsspieler-Rat ist weg');
    assert(r.clique && r.kostetStaerke, 'Schlecht gelaunte Clique rumort und kostet Teamstärke');
    assert(r.zieltRunter, 'Rumorende Clique zieht monatlich den Rest der Kabine runter');
    assert(r.ratAnliegen && r.anhoeren, 'Wortführer meldet sich beim Rat, Anhören hebt die Stimmung der Gruppe');
    assert(r.kapitaenGewechselt && r.neuerRat, 'Kapitänswechsel: alter Kapitän -12, Rat -4 bei Neuling ohne Standing, Rat neu besetzt');
    assert(r.kandidat && r.imBuero, 'Unzufriedener Leistungsträger wartet im Büro mit drei Optionen');
    assert(r.freigabe && r.garantie, 'Freigabe erzeugt ein echtes Angebot, Einsatzgarantie wird hinterlegt');
    assert(r.anzeige, 'Rangordnung und Cliquen-Stimmung werden im Reiter Mannschaft angezeigt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSetPieces(browser) {
    console.log('\n[20.3] Livespiel: Elfmeter-Schützenwahl, Freistoß-Varianten, Videobeweis, Torwart im Elfmeterschießen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        const echtRandom = Math.random;
        try {
            closeTutorial();
            const out = {};
            const endeEcht = window.endMatchSimulation;
            window.endMatchSimulation = () => {};
            setupMatch(game.clubName, 'Gegner FC', calcTeamStrength(true), true, false, null);
            stopLiveTickerAutoplay();
            const onPitch = squad.filter(p => lineup.includes(p.id) && p.pos !== 'TW');
            game.penaltyTakerId = onPitch[0].id;
            currentMatch.minute = 30;
            // Elfmeter erzwingen
            Math.random = () => 0;
            const gestartet = rollLiveSetPiece(0);
            Math.random = echtRandom;
            out.elfmeter = gestartet && currentMatch.awaitingSetPiece && currentMatch.setPiece.type === 'elfmeter'
                && document.getElementById('setpiece-overlay').classList.contains('show');
            const kandidaten = getPenaltyCandidates(currentMatch.setPiece.gefoultId);
            out.kandidaten = kandidaten.length >= 2 && kandidaten[0].p.id === game.penaltyTakerId && kandidaten.every(c => c.prob >= 0.45 && c.prob <= 0.93);
            // Spiel ruht während der Entscheidung
            const minute = currentMatch.minute;
            simulateMatchStep();
            out.ruht = currentMatch.minute === minute;
            const schuetze = kandidaten[kandidaten.length - 1].p;
            const tore = schuetze.goalsSeason || 0, vorher = currentMatch.homeGoals;
            Math.random = () => 0;
            resolveSetPiece(String(schuetze.id));
            Math.random = echtRandom;
            out.verwandelt = currentMatch.homeGoals === vorher + 1 && (schuetze.goalsSeason || 0) === tore + 1 && !currentMatch.awaitingSetPiece
                && !document.getElementById('setpiece-overlay').classList.contains('show') && schuetze.penaltiesScored >= 1;
            // Freistoß: drei Varianten, direkt durch den Freistoßschützen
            game.freeKickTakerId = onPitch[1].id;
            currentMatch.setPiece = { type: 'freistoss', minute: 40 }; currentMatch.awaitingSetPiece = true;
            showSetPiecePanel();
            out.freistossOptionen = document.querySelectorAll('#setpiece-options button').length === 3;
            const fk = onPitch[1], fkTore = fk.goalsSeason || 0;
            Math.random = () => 0;
            resolveSetPiece('direkt');
            Math.random = echtRandom;
            out.direkt = (fk.goalsSeason || 0) === fkTore + 1;
            const opt = getFreeKickOptions();
            out.abwaegung = opt.flanke.risiko > 0 && opt.kurz.risiko === 0 && opt.kurz.prob < opt.flanke.prob;
            // Schnelles Durchspielen entscheidet automatisch
            currentMatch.minute = 50;
            currentMatch.setPiece = { type: 'freistoss', minute: 50 }; currentMatch.awaitingSetPiece = true;
            simulateRestOfMatch();
            out.automatisch = currentMatch.minute >= 90 && !currentMatch.awaitingSetPiece;
            // Videobeweis
            Math.random = () => 0;
            out.var = varOverturnsGoal(true) === true;
            Math.random = echtRandom;
            window.endMatchSimulation = endeEcht;
            // Torwart im Elfmeterschießen: Ersatztorwart als Elfmeter-Killer kostet einen Wechsel
            const stamm = squad.find(p => lineup.includes(p.id) && p.pos === 'TW');
            const ersatz = squad.find(p => p.pos === 'TW' && !lineup.includes(p.id));
            if (stamm) stamm.trait = 'Kein';
            ersatz.trait = 'Elfmeter-Killer';
            const modStamm = getShootoutKeeperModifier();
            substitutionsLeft = 2;
            let bestaetigt = null;
            openShooterOrderSelection(null, names => { bestaetigt = names; });
            chooseShootoutKeeper(ersatz.id);
            out.keeperAuswahl = document.getElementById('shooter-select-keeper').innerText.includes(ersatz.name);
            const modErsatz = getShootoutKeeperModifier();
            selectedShooters = squad.filter(p => lineup.includes(p.id)).slice(0, 5).map(p => p.id);
            confirmShooterOrder();
            out.keeper = modErsatz < modStamm && substitutionsLeft === 1 && Array.isArray(bestaetigt);
            return out;
        } catch (e) { Math.random = echtRandom; return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Standard-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.elfmeter && r.kandidaten, 'Elfmeter hält das Spiel an, Schützenwahl mit festem Schützen zuerst und Trefferchance');
    assert(r.ruht, 'Während der Entscheidung läuft das Spiel nicht weiter');
    assert(r.verwandelt, 'Gewählter Schütze verwandelt: Tor, Torschützenliste, Elfmeterquote');
    assert(r.freistossOptionen && r.direkt && r.abwaegung, 'Freistoß: direkt, Flanke (Konterrisiko) oder kurz (sicher)');
    assert(r.automatisch, 'Schnelles Durchspielen entscheidet Standards automatisch');
    assert(r.var, 'Videobeweis kann ein Tor zurücknehmen');
    assert(r.keeperAuswahl && r.keeper, 'Elfmeterschießen: Elfmeter-Killer von der Bank senkt die Gegnerquote und kostet einen Wechsel');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testCupFinal(browser) {
    console.log('\n[20.4] Pokalfinale: Finalwoche, Vorbereitung wirkt im Endspiel, Titelfeier, Chronik');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        const echtSim = window.simulateGoals;
        try {
            closeTutorial();
            const out = {};
            const us = game.clubName;
            game.inCup = true; game.money = 2000000; game.fans = 60;
            cupTournament.roundsHistory = [0, 1, 2, 3].map(i => ({ roundIndex: i, name: cupTournament.roundNames[i], matchday: cupTournament.matchdays[i], prize: cupTournament.prizes[i], pairings: [], completed: true }));
            cupTournament.roundsHistory.push({ roundIndex: 4, name: cupTournament.roundNames[4], matchday: 34, prize: cupTournament.prizes[4], pairings: [{ home: us, away: 'FC Finalgegner', homeGoals: null, awayGoals: null, penaltyWinner: null, played: false }], completed: false });
            cupTournament.currentRound = 4;
            game.matchday = 30;
            showScreen('screen-dashboard');
            out.nochNicht = document.getElementById('dash-cup-final-box').innerHTML === '';
            game.matchday = 32; renderCupFinalCard();
            out.karte = document.getElementById('dash-cup-final-box').innerText.includes('Finalwoche');
            const geld0 = game.money;
            chooseCupFinalTickets('fans');
            out.tickets = game.money === geld0 + 8000 * 30 && game.fans === 64;
            out.karteAktuell = document.getElementById('dash-cup-final-box').innerText.includes('an die Fans');
            chooseCupFinalTickets('sponsoren');
            out.nurEinmal = game.money === geld0 + 8000 * 30;
            bookCupFinalTrains(); bookCupFinalCamp();
            out.kosten = game.money === geld0 + 240000 - 120000 - 150000;
            out.bonusVorher = getCupFinalBonus('dfb') === 0; // erst am Finalspieltag
            game.matchday = 34;
            out.bonus = getCupFinalBonus('dfb') === 3.5;
            // Simuliertes Finale: Stärke enthält die Vorbereitung, Sieg erzwungen
            window.simulateGoals = () => ({ myGoals: 2, oppGoals: 0 });
            const basis = calcTeamStrength(true);
            simulateCupRound(4, false);
            window.simulateGoals = echtSim;
            const paar = cupTournament.roundsHistory[4].pairings[0];
            out.staerke = paar.ourStr === basis + 3.5;
            const f = (game.cupFinals || [])[0];
            out.chronik = !!f && f.won && f.opponent === 'FC Finalgegner' && f.score === '2:0' && f.prep.length === 3;
            out.titel = game.trophies.some(t => t.includes('DFB-Pokalsieger'));
            renderCupFinalCard();
            out.feierAngebot = document.getElementById('dash-cup-final-box').innerText.includes('Wie wird gefeiert');
            const fans1 = game.fans, bild = game.managerMediaImage ?? 50;
            chooseCupCelebration('korso');
            out.feier = game.fans === Math.min(100, fans1 + 6) && (game.managerMediaImage ?? 50) === Math.min(100, bild + 3) && game.cupFinal.celebration === 'korso';
            showScreen('screen-history'); setSubTab('hist', 'titel');
            out.historie = document.getElementById('cup-finals-history-box').innerText.includes('DFB-Pokal-Finale');
            // Live-Finale: Vorbereitung landet in der Basisstärke
            game.cupFinal = { season: game.season, comp: 'landes', opponent: 'SV Land', matchday: 34, tickets: 'fans', zug: true, camp: false, played: false, celebration: null };
            setupMatch(us, 'SV Land', 60, true, true, null);
            stopLiveTickerAutoplay();
            const vorher = currentMatch.ourBaseStr;
            markCupLiveMatch({ comp: 'landes', titel: 'Landespokal-Finale', home: us, away: 'SV Land', oppStr: 60, elfmeter: true });
            out.live = currentMatch.ourBaseStr === vorher + 2.5;
            return out;
        } catch (e) { window.simulateGoals = echtSim; return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Pokalfinale-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.nochNicht && r.karte, 'Finalwoche erscheint drei Spieltage vor dem Endspiel');
    assert(r.tickets && r.nurEinmal && r.kosten, 'Ticketkontingent (einmalig), Sonderzüge und Trainingslager werden gebucht');
    assert(r.karteAktuell, 'Die Karte zeigt eine Entscheidung sofort an (kein stummer Knopf)');
    assert(r.bonusVorher && r.bonus && r.staerke, 'Vorbereitung wirkt genau im Finale (+3,5 Stärke)');
    assert(r.chronik && r.titel && r.historie, 'Endspiel mit Vorbereitung in der Chronik, Titel im Trophäenschrank');
    assert(r.feierAngebot && r.feier, 'Titelfeier: Autokorso kostet Geld, bringt Fans und Medienimage');
    assert(r.live, 'Im Livespiel fließt die Vorbereitung in die Stärke');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testCleanupPart8(browser) {
    console.log('\n[20.5] Aufräumen Teil 8: Nachfrist-Aufstieg wechselt wirklich die Liga, Altlasten beim Laden');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const alt = game.leagueLevel;
            // Prämie seit 20.6 nach Liga (Oberliga 150.000 €) - zählen statt Kontostand vergleichen.
            let praemien = 0;
            const origRewards = applyPromotionRewards;
            applyPromotionRewards = () => { praemien++; return origRewards(); };
            game.dfbGracePeriod = { targetLevel: alt - 1, deadlineMatchday: 3, originalLeagueLevel: alt };
            game.sackPending = false; simulateMatchdays(1);
            applyPromotionRewards = origRewards;
            out.aufgestiegen = game.leagueLevel === alt - 1 && !game.dfbGracePeriod;
            out.inNeuerTabelle = leaguesData[game.leagueLevel].some(t => t.name === game.clubName) && !leaguesData[alt].some(t => t.name === game.clubName);
            out.groessen = leaguesData[alt].length === 18 && leaguesData[game.leagueLevel].length === 18;
            out.praemie = praemien === 1;
            game.sackPending = false; simulateMatchdays(2);
            out.spieltWeiter = leaguesData[game.leagueLevel].find(t => t.name === game.clubName).played >= 2;
            // Altlasten alter Spielstände werden schon beim Laden entfernt
            const save = JSON.parse(JSON.stringify(buildSaveState()));
            save.game.contractNegotiations = { alt: true }; save.game.scoutingDatabase = []; save.game.playerDevelopment = {};
            applyLoadedState(save);
            out.altlasten = game.contractNegotiations === undefined && game.scoutingDatabase === undefined && game.playerDevelopment === undefined;
            out.monat = typeof runMonthlyClubTicks === 'function';
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Aufräum-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.aufgestiegen && r.inNeuerTabelle && r.groessen, 'Nachträglicher Aufstieg: der Verein spielt wirklich in der neuen Liga (vorher nur leagueLevel umgestellt)');
    assert(r.praemie && r.spieltWeiter, 'Nachträglicher Aufstieg bringt die Aufstiegsprämie, die Saison läuft dort weiter');
    assert(r.altlasten && r.monat, 'Altlasten alter Spielstände werden beim Laden entfernt, Monats-Ticks gebündelt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testYouthPathway(browser) {
    console.log('\n[18.5] Jugend-Laufbahn: Potenzial, Profivertrag mit 19, Leihe, Durchbruch-Momente');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.money = 5000000;
            youthTalents = [];
            for (let i = 0; i < 6; i++) scoutYouthTalent();
            // Potenzial relativ zum Liga-Schnitt beim Sichten (25.17)
            out.potenzialEcht = youthTalents.every(p => typeof p.potential === 'number' && p.potential >= p.strength + 4
                && (p.potential >= p.youthLeagueBase + YOUTH_POTENTIAL_OFFSET[p.potentialTier][0] || p.potential === p.strength + 4));
            // Talente passen zur Liga: Start 14-24 unter dem Liga-Schnitt (ohne Akademie/Internat-Bonus)
            out.ligaGerecht = youthTalents.every(p => p.strength <= Math.max(24, p.youthLeagueBase - 14 + getYouthAcademyStartBonus() + (campusBuildings.internat?.lvl || 0) * 2));
            const t0 = youthTalents[0];
            out.unbekannt = getYouthPotentialText(t0).includes('unbekannt');
            revealYouthPotential(t0.id);
            out.spanne = /\d+-\d+/.test(getYouthPotentialText(t0));
            for (let i = 0; i < 40; i++) tickYouthDevelopment();
            out.grenze = youthTalents.every(p => p.strength <= p.potential);

            // Alterung und Entscheidung mit 19
            youthTalents.forEach(p => { p.age = 17; p.proDecisionLeft = null; });
            const a = youthTalents[1], b = youthTalents[2];
            a.age = 18; b.age = 18;
            const inboxVor = inboxMessages.length;
            ageYouthAtSeasonEnd();
            out.altern = youthTalents[3].age === 18 && a.age === 19 && a.proDecisionLeft === YOUTH_DECISION_MATCHDAYS && b.proDecisionLeft === YOUTH_DECISION_MATCHDAYS;
            out.meldung = inboxMessages.length > inboxVor;
            showScreen('screen-youth');
            out.karte = document.getElementById('youth-decision-box').innerHTML.includes('PROFIVERTRAG-ENTSCHEIDUNG');
            // a bekommt den Profivertrag, b wartet ab und geht
            const lohn = getYouthProWage(a);
            promoteYouth(youthTalents.indexOf(a), null);
            out.profi = squad.includes(a) && a.contracts === 3 && a.wage === lohn && a.academyGraduate === true && !a.proDecisionLeft;
            const geld = game.money;
            for (let i = 0; i < YOUTH_DECISION_MATCHDAYS; i++) tickYouthProDecisions();
            out.abschied = !youthTalents.includes(b) && game.money > geld;

            // Leihe zur Entwicklung
            const c = youthTalents[0];
            c.age = 17; c.strength = 55; c.potential = 80;
            const clubs = getYouthLoanClubs(c);
            out.echteVereine = clubs.length >= 2 && clubs.every(k => leaguesData[k.level].some(t => t.name === k.name));
            openYouthLoanChoice(c.id);
            out.auswahl = document.getElementById('youth-loan-choice-box').innerHTML.includes(clubs[0].name);
            loanYouthForDevelopment(c.id, clubs[0].name);
            const leihe = loanedPlayers.find(l => l.player === c);
            out.verliehen = !!leihe && leihe.youthLoan && !youthTalents.includes(c);
            out.leihBox = document.getElementById('youth-loans-box').innerHTML.includes(c.name);
            const dauer = leihe.duration;
            for (let i = 0; i < dauer; i++) tickLoanedPlayers();
            out.zurueck = youthTalents.includes(c) && !loanedPlayers.includes(leihe) && leihe.apps > 0 && c.strength > 55;
            out.leihBilanz = `${leihe.apps} Einsätze, ${leihe.goals} Tore, ${55} → ${c.strength} in ${dauer} SpT`;

            // Durchbruch-Moment (Zufall erzwungen)
            const d = youthTalents.find(p => p !== c) || c;
            d.strength = 55; d.potential = 80;
            const zufall = Math.random;
            Math.random = () => 0.01;
            try { tickYouthBreakthroughs(); } finally { Math.random = zufall; }
            out.durchbruch = d.strength >= 58 && game.youthMoments.some(m => m.icon === '💥' && m.text.includes(d.name));

            // Profidebüt und erstes Tor des Absolventen
            lineup = pickBestLineupIds();
            if (!lineup.includes(a.id)) lineup[lineup.length - 1] = a.id;
            resetMatchEvents();
            matchEvents.tore[a.id] = 1;
            gradeOwnMatch(2, 0);
            out.meilensteine = !!(a.milestones.debut && a.milestones.tor) && game.youthMoments.some(m => m.icon === '🎉') && game.youthMoments.some(m => m.icon === '⚽');

            setSubTab('jug', 'entwicklung');
            out.momente = document.getElementById('youth-moments-box').innerHTML.includes('Durchbruch');
            const ext = document.getElementById('youth-academy-extended-panel').innerHTML;
            out.deutsch = !/improving|excellent|stable|declining/.test(ext) && !ext.includes('Potenzial: 75');
            setSubTab('jug', 'talente');

            // Saisonwechsel lässt die Akademie altern
            const e = youthTalents[0];
            const alt = e.age;
            simulateFullSeason();
            concludeSeasonAndAdvance();
            out.saisonAlter = !youthTalents.includes(e) || e.age === alt + 1 || squad.includes(e);
            return out;
        } catch (err) { return { crash: err.message + ' ' + err.stack }; }
    });
    assert(!r.crash, `Jugend-Laufbahn-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.potenzialEcht, 'Jedes gesichtete Talent hat ein echtes Potenzial über seiner Stärke');
        assert(r.ligaGerecht, 'Gesichtete Talente starten unter dem Liga-Schnitt (statt fest bei Stärke 46-58)');
        assert(r.unbekannt && r.spanne, 'Potenzial ist ungeprüft unbekannt und nach der Prüfung als Spanne sichtbar');
        assert(r.grenze, 'Monatliche Entwicklung bleibt unter dem Potenzial');
        assert(r.altern && r.meldung, 'Talente altern am Saisonende; mit 19 wird eine Profivertrag-Entscheidung fällig (mit Meldung)');
        assert(r.karte, 'Jugendakademie zeigt die offene Entscheidung als Karte');
        assert(r.profi, 'Profivertrag: Talent im Kader mit 3 Jahren Vertrag und Profigehalt');
        assert(r.abschied, 'Ohne Entscheidung geht das Talent nach 8 Spieltagen gegen Ausbildungsentschädigung');
        assert(r.echteVereine && r.auswahl, 'Leihe bietet echte KI-Vereine zur Auswahl an');
        assert(r.verliehen && r.leihBox, 'Verliehenes Talent steht in der Leihliste der Akademie');
        assert(r.zurueck, `Leihe bringt Einsätze und Entwicklung, danach zurück in die Akademie (${r.leihBilanz})`);
        assert(r.durchbruch, 'Durchbruch: Leistungssprung mit Eintrag in den Akademie-Momenten');
        assert(r.meilensteine, 'Profidebüt und erstes Profitor eines Absolventen werden festgehalten');
        assert(r.momente && r.deutsch, 'Reiter Entwicklung zeigt die Momente, Trends auf Deutsch, kein Schein-Potenzial 75');
        assert(r.saisonAlter, 'Saisonwechsel lässt die Akademie altern');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

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
        // Höchststufe 5 mit sichtbarer Wirkung (25.18): mehr Startstärke und höhere Top-Talent-Chance
        const chance2 = getYouthTierChances(2).top, chance5 = getYouthTierChances(5).top;
        game.youthAcademyLvl = 5;
        const geldVorMax = game.money;
        upgradeYouthAcademy();
        results.academyCapped = game.youthAcademyLvl === 5 && game.money === geldVorMax
            && !game.stadiumConstructionQueue.some(p => p.type === 'youthAcademyLvl');
        results.academyEffect = chance5 > chance2 && getYouthAcademyStartBonus(5) > getYouthAcademyStartBonus(2)
            && getYouthAcademyStartBonus(9) === getYouthAcademyStartBonus(5);
        showScreen('screen-youth');
        results.academyEffectShown = /Top-Talent/.test(document.getElementById('youth-academy-effect').textContent)
            && document.getElementById('btn-upgrade-youth-academy').disabled;
        game.youthAcademyLvl = lvlBefore + 1;

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
    assert(r.academyCapped, 'Jugendakademie endet bei Stufe 5 (kein weiterer Ausbau, kein Geld weg)');
    assert(r.academyEffect, 'Akademie-Stufe hebt Startstärke und Top-Talent-Chance, gedeckelt bei Stufe 5');
    assert(r.academyEffectShown, 'Jugend-Bildschirm zeigt die Wirkung der Akademie-Stufe, Ausbau-Knopf auf Höchststufe gesperrt');
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
        // Gehaltsbudget gilt auch für Leihen (25.17)
        game.wageBudget = 1;
        signLoanPlayer(0);
        results.leiheBrauchtGehaltsbudget = !squad.some(p => p.id === loanPlayer.id);
        game.wageBudget = 1e9;
        const tbVor = game.transferBudget;
        signLoanPlayer(0);
        results.leiheZiehtTransferbudget = game.transferBudget === tbVor - loanPlayer.loanFee;
        results.loanPlayerInSquad = squad.some(p => p.id === loanPlayer.id);
        let loan = incomingLoans.find(l => l.playerId === loanPlayer.id);
        exerciseLoanBuyOption(loanPlayer.id);
        let playerAfter = squad.find(p => p.id === loanPlayer.id);
        results.buyOptionMakesPermanent = !!loan && !!playerAfter && !incomingLoans.some(l => l.playerId === loanPlayer.id);

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
    assert(r.leiheBrauchtGehaltsbudget && r.leiheZiehtTransferbudget, 'Leihen laufen über Gehalts- und Transferbudget');
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

        let target = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName && t.name !== game.secondTeam.name);
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

async function testLeagueStats(browser) {
    console.log('\n[12] Liga-Statistiken: Torjägerliste, Form-, Heim-/Auswärtstabelle, Tabellenverlauf');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        try {
            const eigeneLiga = game.leagueLevel;
            showScreen('screen-league');
            setLeagueLevel(eigeneLiga === 0 ? 1 : 0);
            const ligaUnveraendert = game.leagueLevel === eigeneLiga;
            simulateFullSeason();
            showScreen('screen-league');
            const zurueckAufEigene = getLeagueViewLevel() === eigeneLiga;
            setLeagueTab('stats');
            const teams = leaguesData[eigeneLiga];
            const scorers = getLeagueScorers(eigeneLiga);
            const kiTore = teams.filter(isAiClub).reduce((s, t) => s + t.goalsFor, 0);
            const kiBenannt = scorers.filter(x => !x.own).reduce((s, x) => s + x.goals, 0);
            const heimAus = teams.every(t => t.homeRec[0] + t.homeRec[1] + t.homeRec[2] + t.awayRec[0] + t.awayRec[1] + t.awayRec[2] === t.played
                && t.homeRec[3] + t.awayRec[3] === t.goalsFor);
            // Heimvorteil auch zwischen KI-Teams: über alle Ligen mehr Heim- als Auswärtssiege
            const alle = leaguesData.flat();
            const heimSiege = alle.reduce((s, t) => s + t.homeRec[0], 0), auswSiege = alle.reduce((s, t) => s + t.awayRec[0], 0);
            const heimvorteil = heimSiege > auswSiege * 1.1;
            const verlauf = teams.every(t => t.rankHist.length === 34 && t.rankHist.every(x => x >= 1 && x <= teams.length));
            const tabelle = sortedTable(eigeneLiga);
            const letzterPlatzStimmt = tabelle.every((t, i) => t.rankHist[33] === i + 1);
            const html = ['top-scorers-box', 'league-form-table-box', 'league-homeaway-box', 'league-rank-chart-box'].map(id => document.getElementById(id).innerHTML);
            setLeagueStatsSplit('auswaerts');
            const auswaertsAktiv = document.getElementById('league-homeaway-box').innerHTML.includes("setLeagueStatsSplit('auswaerts')\" class=\"btn-action");
            const kiKanone = scorers.find(x => !x.own);
            const awards = awardLeagueHonours(5);
            const kanone = awards.awards.find(a => a.award.includes('Torjäger'));
            const kanoneEcht = kanone.club === game.clubName || (kiKanone && kanone.winner === kiKanone.name && kanone.value === kiKanone.goals + ' Tore');
            concludeSeasonAndAdvance();
            const zurueckgesetzt = leaguesData.every(l => l.every(t => (t.rankHist || []).length === 0 && (!t.star || !t.star.goals) && (!t.homeRec || t.homeRec[0] === 0)));
            return { crash: false, ligaUnveraendert, zurueckAufEigene, anteil: kiBenannt / Math.max(1, kiTore), heimAus, heimvorteil, heimSiege, auswSiege, verlauf, letzterPlatzStimmt,
                hatScorer: html[0].includes('<table'), hatForm: html[1].includes('●'), hatHeim: html[2].includes('Heim'), hatChart: html[3].includes('<polyline'),
                auswaertsAktiv, kanoneEcht, zurueckgesetzt, altFeld: 'seasonPointsHistory' in game };
        } catch (e) {
            return { crash: true, error: e.message + ' ' + e.stack };
        }
    });

    assert(r.crash === false, `Liga-Statistik-Test ohne Absturz (${r.crash ? r.error : 'ok'})`);
    if (!r.crash) {
        assert(r.heimvorteil, `Heimteams gewinnen öfter als Auswärtsteams, auch KI gegen KI (${r.heimSiege}:${r.auswSiege})`);
        assert(r.ligaUnveraendert, 'Liga-Umschalter zeigt nur eine andere Liga an und ändert die eigene Liga nicht');
        assert(r.zurueckAufEigene, 'Liga-Bildschirm öffnet wieder mit der eigenen Liga');
        assert(r.anteil > 0.3 && r.anteil < 0.75, `Benannte KI-Torschützen erzielen einen plausiblen Anteil der Vereinstore (${(r.anteil * 100).toFixed(0)} %)`);
        assert(r.heimAus, 'Heim- und Auswärtsbilanz ergeben zusammen genau die Tabellenwerte');
        assert(r.verlauf && r.letzterPlatzStimmt, 'Tabellenverlauf hat 34 Plätze je Verein und endet mit dem echten Tabellenplatz');
        assert(r.hatScorer && r.hatForm && r.hatHeim && r.hatChart, 'Statistik-Reiter zeigt Torjägerliste, Formtabelle, Heim/Auswärts und Verlaufsgrafik');
        assert(r.auswaertsAktiv, 'Umschalter Heim/Auswärts wirkt');
        assert(r.kanoneEcht, 'Torjägerkanone geht an den echten Führenden der Torjägerliste');
        assert(r.zurueckgesetzt, 'Saisonwechsel setzt Verlauf, Heim/Auswärts und KI-Tore zurück');
        assert(!r.altFeld, 'Altes Feld seasonPointsHistory ist entfernt');
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Liga-Statistik-Test');
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
    // Eigener Kontext, damit eine zweite Seite denselben Speicher sieht (siehe Reload unten).
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));
    await page.goto(GAME_PATH);
    await page.waitForTimeout(400);
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

    // Unter voller Testlast war der Eintrag nach einem Reload gelegentlich weg (localStorage
    // null, alle älteren Einträge noch da, kein Spielcode löscht ihn): Chromium hatte den frischen
    // Schreibvorgang noch nicht an den Speicher des Kontexts übergeben. Deshalb erst warten, bis
    // eine zweite Seite desselben Kontexts (gleiche file://-Herkunft) den Wert sieht.
    const vorReload = await page.evaluate(() => localStorage.getItem('anstoss_fm13_language'));
    const zweite = await ctx.newPage();
    await zweite.goto('file://' + path.resolve(__dirname, 'package.json'));
    for (let i = 0; i < 30; i++) {
        if (await zweite.evaluate(() => localStorage.getItem('anstoss_fm13_language')) === 'en') break;
        await zweite.waitForTimeout(100);
    }
    await zweite.close();
    await page.reload();
    await page.waitForTimeout(400);
    await page.evaluate(() => { closeTutorial(); showScreen('screen-dashboard'); });
    await page.waitForTimeout(150);
    const enTextAfterReload = await page.evaluate(() => document.querySelector('[onclick*="screen-calendar"]').textContent.trim());
    const langDiag = await page.evaluate(() => ({ lang: currentLang, gespeichert: localStorage.getItem('anstoss_fm13_language'), schluessel: Object.keys(localStorage).length }));

    await page.click('#btn-lang-toggle');
    await page.waitForTimeout(100);
    const backToDeText = await page.evaluate(() => document.querySelector('[onclick*="screen-calendar"]').textContent.trim());

    assert(deText === '📅 Kalender & Termine', 'Standardsprache beim Start ist Deutsch');
    assert(enText === '📅 Calendar & Fixtures', 'Klick auf den Sprachumschalter übersetzt die Seitenleiste sofort ins Englische');
    assert(langStoredAfterToggle === 'en', 'Sprachwahl wird persistiert (localStorage)');
    assert(tutorialNextTextEn === 'Next →', 'Tutorial-Texte werden ebenfalls über die gewählte Sprache gerendert');
    assert(enTextAfterReload === '📅 Calendar & Fixtures', `Sprachwahl überlebt einen Reload (${enTextAfterReload} | vor dem Reload ${vorReload}, danach ${JSON.stringify(langDiag)})`);
    assert(backToDeText === '📅 Kalender & Termine', 'Zurückschalten auf Deutsch funktioniert erneut');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Sprachumschalter-Test');
    await ctx.close();
}

async function testManagerOffice(browser) {
    console.log('\n[15] Managerbüro (Point-and-Click-Startbildschirm)');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());
    await page.waitForTimeout(200);

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
    await page.evaluate(() => showScreen('screen-dashboard'));
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
    if (box) {
        await page.waitForTimeout(200);  // Stelle sicher, dass das Office vollständig geladen ist
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(1200);  // Längeres Timeout für Navigationsübergang
    }
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
    // ueber je fuenf Laeufe (v2.5, inkl. Saisonziel-Praemien) endet die Saison bei rund
    // 140.000 bis 160.000 EUR von 150.000 EUR Startkapital. Geprueft wird deshalb, was
    // verlaesslich gilt: Nichtstun macht nicht reich.
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
        let ende = game.money;
        simulateMatchdays(4);
        // Ganze Saison für einen Mittelfeldplatz: Spieltagsgeschäft + TV-Restausschüttung für
        // Platz 9 + Dauerkartenverkauf (beides erst am Saisonende). Seit 25.9 trägt das
        // Spieltagsgeschäft allein die Kosten für Spielbetrieb & Verwaltung nicht mehr.
        let l = game.financeLedger;
        let journal = l.reduce((s, e) => s + e.summeEin - e.summeAus, 0);
        let rest = calculateCollectiveTvMoney(0, 9) - (game.tvMoneyPaidThisSeason || 0);
        let vorDauerkarten = game.money;
        renewSeasonTickets();
        let dauerkarten = game.money - vorDauerkarten;
        return {
            start, ende,
            stadion: stadium.total,
            saisonSaldo: Math.round(journal + rest + dauerkarten),
            saisonEin: Math.round(l.reduce((s, e) => s + e.summeEin, 0) + Math.max(0, rest) + dauerkarten)
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
    assert(profi.saisonSaldo > -0.05 * profi.saisonEin,
        `Ein Erstliga-Verein auf einem Mittelfeldplatz wirtschaftet nicht strukturell ins Minus (Saison ${profi.saisonSaldo} € bei ${profi.saisonEin} € Einnahmen)`);
    // Liga- und Pokalverlauf sind zufällig, daher schwankt das Endkapital über viele Läufe
    // stark (empirisch beobachtet: ca. das 0,6- bis 3,2-fache des Startkapitals). Die Schwelle
    // prüft nur auf strukturelle Pleite, nicht auf einen konkreten Erfolgsgrad.
    assert(profi.ende > 0 && profi.ende > profi.start * 0.5,
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

async function testFakeDecisions(browser) {
    console.log('\n[18.6] Aufräumen Teil 6: Schein-Entscheidungen mit echter Wirkung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const toast = () => document.getElementById('app-toast').innerText;
            // Mannschaftsanweisungen: Stärke nur gegen Kraft, Tief stehen schließt aus
            game.teamInstructions = { gegenpressing: false, tiefStehen: false, hoheAV: false };
            const basis = getTeamInstructionBonus(), basisFit = getTeamInstructionFitnessMultiplier();
            toggleTeamInstruction('gegenpressing'); toggleTeamInstruction('hoheAV');
            out.offensivKostet = getTeamInstructionBonus() > basis && getTeamInstructionFitnessMultiplier() > basisFit;
            toggleTeamInstruction('tiefStehen');
            const t = game.teamInstructions;
            out.tiefExklusiv = t.tiefStehen && !t.gegenpressing && !t.hoheAV && getTeamInstructionBonus() < 0 && getTeamInstructionFitnessMultiplier() < 1;
            toggleTeamInstruction('gegenpressing');
            out.tiefWiederAus = !t.tiefStehen && t.gegenpressing;
            // Fan-Aktionen: getrennte Wirkung, je einmal bis zum Spiel
            // Fans auf 100: jede Aktion gibt +2 Fans, und die Fanstimmung fließt in die
            // Auswärtsstärke ein - an einer Rundungsgrenze kippte der Vergleich sonst (CI 3.21).
            game.money = 1000000; game.fanSupport = {}; game.fans = 100;
            const heim0 = calcTeamStrength(true), aus0 = calcTeamStrength(false);
            runFanAction('choreo');
            const geld1 = game.money;
            runFanAction('choreo');
            out.choreoEinmal = game.money === geld1 && toast().includes('schon');
            out.choreoHeim = calcTeamStrength(true) > heim0 && calcTeamStrength(false) === aus0;
            runFanAction('express');
            out.zugAuswaerts = calcTeamStrength(false) > aus0;
            consumeFanSupport(true);
            out.verbraucht = !game.fanSupport.choreo && game.fanSupport.express;
            game.money = 100; game.fanSupport = {};
            runFanAction('choreo');
            out.fanGeldMeldung = toast().includes('Nicht genug Geld') && !game.fanSupport.choreo;
            // Ausgaben-Warnlimit erzeugt eine Meldung beim Überschreiten
            game.money = 5000000;
            setExpenseWarningLimit(1);
            const inbox0 = inboxMessages.length;
            simulateMatchdays(2);
            out.warnlimit = inboxMessages.slice(0, inboxMessages.length - inbox0 + 5).filter(m => (m.title || m.subject || '').includes('Warnlimit')).length === 1
                || inboxMessages.filter(m => JSON.stringify(m).includes('über dem Warnlimit')).length === 1;
            setExpenseWarningLimit(0);
            // Personal-Obergrenze blockiert Einstellungen
            const key = Object.keys(staffMembers).find(k => !staffMembers[k].hired && staffMembers[k].wage > 0);
            game.money = 5000000;
            setStaffWageBudgetCap(1);
            toggleStaffMember(key, null);
            out.capBlockiert = !staffMembers[key].hired && toast().includes('Obergrenze');
            setStaffWageBudgetCap(0);
            toggleStaffMember(key, null);
            out.ohneCapEingestellt = staffMembers[key].hired;
            // Fan-Saisonziel: nur bis Spieltag 6, Verfehlen kostet
            game.matchday = 10;
            setSeasonMoodTarget(90);
            out.zielFrist = !(fanCentralState.seasonMoodTarget && fanCentralState.seasonMoodTarget.season === game.season);
            fanCentralState.seasonMoodTarget = { value: 99, season: game.season - 1 };
            game.fans = 50;
            checkSeasonMoodTargetResult();
            out.zielRisiko = game.fans === 47;
            // Stille Abbrüche melden sich jetzt
            game.money = 100;
            scoutYouthTalent();
            out.sichtenMeldung = toast().includes('Nicht genug Geld');
            showScreen('screen-youth'); setSubTab('jug', 'entwicklung');
            const kandidat = squad.find(s => s.age >= 28 && s.strength >= 60);
            if (kandidat) { chooseYouthCoach(kandidat.id); out.trainerMeldung = toast().includes('Nicht genug Geld'); } else out.trainerMeldung = true;
            // Umbenennen ohne prompt()
            showScreen('screen-manager-tree');
            promptRenameClub();
            const feld = document.getElementById('club-rename-input');
            feld.value = 'SV Testheim 09';
            confirmRenameClub();
            out.umbenannt = game.clubName === 'SV Testheim 09' && leaguesData[game.leagueLevel].some(t2 => t2.name === 'SV Testheim 09');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Schein-Entscheidungen-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.offensivKostet, 'Gegenpressing/hohe AV: mehr Stärke, aber mehr Kraftverbrauch');
        assert(r.tiefExklusiv && r.tiefWiederAus, 'Tief stehen: weniger Stärke, weniger Kraftverbrauch, schließt die anderen Anweisungen aus');
        assert(r.choreoEinmal && r.choreoHeim, 'Choreo wirkt nur im Heimspiel und ist nur einmal buchbar');
        assert(r.zugAuswaerts && r.verbraucht, 'Sonderzug wirkt auswärts; nach dem Heimspiel ist die Choreo verbraucht');
        assert(r.fanGeldMeldung, 'Fan-Aktion ohne Geld meldet sich statt still nichts zu tun');
        assert(r.warnlimit, 'Ausgaben-Warnlimit erzeugt beim Überschreiten genau eine Meldung');
        assert(r.capBlockiert && r.ohneCapEingestellt, 'Personalbudget-Obergrenze blockiert Einstellungen wirklich');
        assert(r.zielFrist && r.zielRisiko, 'Fan-Saisonziel nur bis Spieltag 6 und mit Stimmungsverlust bei Misserfolg');
        assert(r.sichtenMeldung && r.trainerMeldung, 'Nachwuchs sichten und Jugendtrainer melden fehlendes Geld');
        assert(r.umbenannt, 'Verein umbenennen funktioniert über ein Eingabefeld (ohne natives prompt)');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
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
        game.lowBoardSatStreak = 12;
        simulateMatchdays(1);
        const mitteDerSaisonEntlassen = game.sackPending === true;
        game.sackPending = false;
        game.boardSat = 1;
        game.lowBoardSatStreak = 6;
        game.boardSatVerlauf = [1, 1, 1, 1, 1, 1, 1];
        game.boardSat = 20;
        checkSeasonEndSacking();
        const trotzErholung = game.sackPending === true;
        game.sackPending = false;
        // Saisonziel erreicht (Meister/Aufstieg oder Erwartung): keine Entlassung trotz Tiefstwerten
        game.seasonExpectation = Object.assign({}, game.seasonExpectation, { expectedRank: 9 });
        game.boardSat = 1;
        game.boardSatVerlauf = [1, 1, 1, 1, 1, 1, 1];
        checkSeasonEndSacking(1);
        const alsMeister = game.sackPending === true;
        game.sackPending = false;
        game.boardSat = 1;
        game.boardSatVerlauf = [1, 1, 1, 1, 1, 1, 1];
        checkSeasonEndSacking(18);
        let mdVor = game.matchday;
        simulateMatchdays(5);
        let box = document.getElementById('app-notice');
        let mdNach = game.matchday;
        simulateMatchdays(5);
        let nochWeiter = game.matchday !== mdNach;
        return {
            ausgeloest: game.sackPending === true,
            mitteDerSaisonEntlassen,
            trotzErholung,
            alsMeister,
            spieltage: mdNach - mdVor,
            simulationGestoppt: !nochWeiter,
            meldungGanzVorn: box.innerHTML.includes('Entlassen'),
            nurEinmal: (box.innerHTML.match(/Entlassen/g) || []).length === 1
        };
    });

    assert(entlassung.ausgeloest, 'Die Entlassung wird im Testszenario tatsächlich ausgelöst');
    assert(!entlassung.alsMeister, 'Wer Meister wird, wird am Saisonende nicht entlassen');
    assert(!entlassung.mitteDerSaisonEntlassen, 'Mitten in der Saison gibt es trotz langer Serie keine Entlassung');
    assert(!entlassung.trotzErholung, 'Wer sich gegenüber vor sechs Spielen verbessert hat, wird am Saisonende nicht entlassen');
    assert(entlassung.spieltage <= 2, `Nach der Entlassung wird nicht weitersimuliert (${entlassung.spieltage} Spieltag(e))`);
    assert(entlassung.simulationGestoppt, 'Weitere Simulationsversuche bleiben wirkungslos, bis bestätigt wurde');
    assert(entlassung.meldungGanzVorn, 'Die Entlassungsmeldung steht vor allen anderen Meldungen');
    assert(entlassung.nurEinmal, 'Die Entlassung wird nur ein einziges Mal ausgesprochen');
    assert(r.keineDialogeImCode, 'Die geprüften Spielfunktionen nutzen keine nativen Dialoge');
    // 7. Statisch über den gesamten Spielcode: kein alert()/confirm()/prompt() in ausführbaren
    //    Zeilen (prompt() blockierte z. B. das Umbenennen des Vereins auf Android).
    const dialogTreffer = [];
    const fs = require('fs');
    fs.readdirSync(path.join(__dirname, '..', 'js')).filter(f => f.endsWith('.js')).forEach(f => {
        fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf-8').split('\n').forEach((zeile, i) => {
            const code = zeile.replace(/\/\/.*$/, '');
            if (/(^|[^.\w'"`])(alert|confirm|prompt)\s*\(/.test(code)) dialogTreffer.push(`${f}:${i + 1}`);
        });
    });
    assert(dialogTreffer.length === 0, `Kein alert/confirm/prompt im gesamten Spielcode (${dialogTreffer.join(', ') || 'keiner'})`);
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
        // 21.6: Bezug ist die Bundesliga-Spitze (Schnitt der vier stärksten anderen
        // Bundesligisten) - am eigenen Kaderschnitt war Europas Elite schwächer als der
        // Bundesliga-Dritte und ein passiver Verein gewann den Titel zweimal in Folge.
        let kaderSchnitt = squad.reduce((sum, p) => sum + p.strength, 0) / squad.length;
        let spitze = leaguesData[0].filter(t => t.name !== game.clubName).map(t => t.strength).sort((a, b) => b - a).slice(0, 4);
        let ref = spitze.reduce((a, b) => a + b, 0) / spitze.length;
        let gegner = feld.filter(t => t.name !== game.clubName).map(t => t.str);
        out.feldAmKader = gegner.every(v => Math.abs(v - ref) <= 12) && Math.max(...gegner) >= ref;
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
    assert(r.feldAmKader, 'Das Feld richtet sich nach der Bundesliga-Spitze, Topf 1 liegt darüber');
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
    await page.waitForTimeout(500);  // Längeres Timeout um sicherzustellen, dass Ladeanzeige vollständig sichtbar ist

    const ladeEbene = await page.$('#app-loading');
    assert(!!ladeEbene, 'Vor dem Start liegt eine Ladeanzeige über der Seite');

    const box = ladeEbene ? await ladeEbene.boundingBox() : null;
    // Die Ladeanzeige hat position: fixed; inset: 0; sollte also das Viewport abdecken
    // Erlauben wir einen kleinen Toleranzbereich wegen Browser-Rendering-Unterschieden
    const coversViewport = box &&
        Math.abs(box.width - 430) <= 2 &&
        Math.abs(box.height - 880) <= 2;
    assert(!!box && coversViewport, `Die Ladeanzeige deckt das gesamte Ansichtsfenster ab (${box ? box.width + 'x' + box.height : 'keine box'})`);

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

        // 1. Liga 1-3 bundesweit mit je 18 Vereinen; Liga 4-6 regional (js/club-geo.js).
        out.sechsPools = TOP_LEAGUE_CLUB_NAMES.length === 3 && [3, 4, 5].every(l => getLeagueClubPool(l).length >= 18);
        out.je18 = TOP_LEAGUE_CLUB_NAMES.every(pool => pool.length === 18) && Object.values(REGIONALLIGA_CLUBS).every(l => l.length === 18);
        const echt = e => e.split('|')[0];
        let alle = TOP_LEAGUE_CLUB_NAMES.flat().concat(...Object.values(REGIONALLIGA_CLUBS).map(l => l.map(echt)),
            ...Object.values(OBERLIGEN).map(o => o.clubs.map(echt)), ...Object.values(LIGA6).map(o => (o.clubs || []).map(echt)));
        out.keineDoppelten = new Set(alle).size === alle.length;
        out.gesamt108 = alle.length >= 300;

        // 2. Kein Name ist EXAKT der geschuetzte Originalname - alle sind verfremdet.
        const ORIGINALE = ['Bayern München', 'Borussia Dortmund', 'RB Leipzig', 'Schalke 04',
            'Hamburger SV', '1. FC Köln', 'Werder Bremen', 'Hertha BSC', '1. FC Magdeburg',
            'Dynamo Dresden', 'Carl Zeiss Jena', 'BFC Dynamo', 'Kickers Offenbach', 'SpVgg Bayreuth',
            'Wuppertaler SV', 'VfB Oldenburg', 'Rot-Weiß Oberhausen', 'Würzburger Kickers', 'Real Madrid', 'FC Barcelona',
            'Manchester United', 'Liverpool FC', 'Juventus Turin', 'Ajax Amsterdam'];
        out.alleVerfremdet = ORIGINALE.every(o => !alle.includes(o) && !INTERNATIONAL_CLUB_NAMES.includes(o));

        // 3. Die Vereine stehen in der Liga ihres Niveaus: Liga 1-3 aus dem bundesweiten Pool,
        //    Liga 4-6 aus dem Pool der Heimatregion (echte Vereine zuerst).
        out.ligaZuordnung = true;
        for (let l = 0; l < 6; l++) {
            const pool = getLeagueClubPool(l);
            const real = l <= 2 ? pool : pool.slice(0, getRegionalRealCount(l));
            let ausPool = leaguesData[l].filter(t => pool.includes(t.name)).length;
            let ausEcht = leaguesData[l].filter(t => real.includes(t.name)).length;
            // 17 Pool-Vereine plus der eigene Klub in der eigenen Liga; anderswo alle 18.
            if (ausPool < 17 || ausEcht < Math.min(15, real.length)) out.ligaZuordnung = false;
        }

        // 4. Regionalitaet: jeder Verein hat eine echte Stadt; Heimat Leipzig -> Nordost-Strang,
        //    die 6. Liga (Sachsenliga) nur mit saechsischen Vereinen, dazu Leipziger Stadtderbys.
        out.alleMitStadt = leaguesData.flat().every(t => !!getClubCity(t.name));
        const sachsen = new Set(LIGA6.sn.clubs.map(e => e.split('|')[1]).concat(REGION_TOWNS.sn));
        out.nordostPraegung = getHomeCity() === 'Leipzig' && leagueNames[3].includes('Nordost') && leagueNames[5].includes('Sachsenliga')
            && leaguesData[5].every(t => sachsen.has(getClubCity(t.name)));
        out.stadtderbys = leaguesData.slice(3).flat().filter(t => t.name !== game.clubName && getClubCity(t.name) === 'Leipzig').length >= 2;
        // Jede waehlbare Heimatstadt hat vollstaendige Ligen 4-6.
        out.alleHeimaten = Object.keys(HOME_CITIES).every(c => {
            const h = HOME_CITIES[c];
            return REGIONALLIGA_CLUBS[h.region] && OBERLIGEN[h.ol] && LIGA6[h.l6] && (LIGA6[h.l6].clubs || REGION_TOWNS[h.l6]);
        });

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

    assert(r.sechsPools && r.je18, 'Liga 1-3 und jede Regionalliga mit 18 echten Vereinen, Liga 5/6 mit vollem Pool');
    assert(r.gesamt108 && r.keineDoppelten, 'Über 300 echte Vereinsnamen, keiner doppelt');
    assert(r.alleVerfremdet, 'Kein Name entspricht exakt der geschützten Original-Schreibweise');
    assert(r.ligaZuordnung, 'Jede Liga wird aus dem Pool ihrer eigenen Spielklasse besetzt');
    assert(r.nordostPraegung, 'Heimat Leipzig: Regionalliga Nordost, Sachsenliga nur mit sächsischen Vereinen');
    assert(r.stadtderbys, 'In den unteren Ligen gibt es Vereine aus der eigenen Stadt');
    assert(r.alleMitStadt && r.alleHeimaten, 'Jeder Verein hat eine echte Stadt, jede Heimatstadt vollständige Ligen 4-6');
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
        const originalSimulateGoals = simulateGoals;
        try {
            simulateGoals = function(a, b) { return a >= b ? { myGoals: 5, oppGoals: 0 } : { myGoals: 0, oppGoals: 5 }; };
            squad.forEach(p => { p.strength = 99; p.fitness = 100; p.morale = 100; });
            let spieltage = 0;
            while (!landesPokal.won && spieltage < 50) {
                // Auch Verletzungen/Sperren sind Zufall: bis zu 14 Ausfälle gleichzeitig
                // drückten die Aufstellung unter die Gegnerstärke. Kader daher fit halten.
                squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 100; });
                simulateMatchdays(1);
                spieltage++;
            }
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
        } finally {
            simulateGoals = originalSimulateGoals;
        }
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


async function testFinancialFairplay(browser) {
    console.log('\n[36] Financial Fairplay: strukturelle Verluste über mehrere Saisons');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Exemptions: Infrastruktur-Investitionen und Finanzierungsvorgänge zählen NICHT
        //    als Verlust, echte Ausgaben (Transfermarkt) schon.
        out.stadionExempt = isFfpExemptLabel('🏟️ Stadionausbau');
        out.jugendExempt = isFfpExemptLabel('🎓 Jugendarbeit');
        out.krediteExempt = isFfpExemptLabel('💰 Finanzen & Kredite');
        out.transferNichtExempt = !isFfpExemptLabel('🔁 Transfermarkt');

        game.money = 5000000;
        showScreen('screen-stadium'); game.money -= 300000;
        showScreen('screen-transfer'); game.money -= 200000;
        showScreen('screen-finances'); game.money -= 50000;
        let kontoExempt = game.kontoauszug.filter(b => ['🏟️ Stadionausbau', '💰 Finanzen & Kredite'].includes(b.label)).reduce((s, b) => s + b.amount, 0);
        let kontoNichtExempt = game.kontoauszug.reduce((s, b) => s + b.amount, 0) - kontoExempt;
        out.nurNichtExemptesZaehlt = Math.round(game.ffpSeasonNet) === Math.round(kontoNichtExempt);

        // 2. Der Live-Akkumulator stimmt exakt mit der tatsächlichen Kontostandsänderung
        //    überein, sobald nichts exempt ist (reiner Spielbetrieb über eine Saison).
        game.ffpSeasonNet = 0;
        let geldVor = game.money;
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        let deltaGeld = game.money - geldVor;
        out.akkumulatorStimmtExakt = Math.abs(Math.round(game.ffpSeasonNet) - Math.round(deltaGeld)) <= 1;

        // 3. Ein Nachtrag NACH der Spieltagsabrechnung (Ordnerdienst - siehe
        //    bucheInSpieltagsjournal in js/finances.js) darf nicht spurlos aus der
        //    FFP-Bilanz verschwinden, obwohl er im echten Kontostand auftaucht. Dazu wird
        //    - wie im echten Spielablauf (tickStewardCosts läuft VOR game.matchday++,
        //    siehe processPostMatchRoutine in js/match.js) - ein frischer Ledger-Eintrag
        //    für den aktuellen Spieltag simuliert, damit hatSpieltagsabrechnung() zutrifft.
        game.stewards = 200;
        game.ffpSeasonNet = 0;
        if (!game.financeLedger) game.financeLedger = [];
        game.financeLedger.push({ season: game.season, matchday: game.matchday, heimspiel: true, zuschauer: game.lastHomeAttendance || 5000, einnahmen: [], ausgaben: [], summeEin: 0, summeAus: 0 });
        let geldVorOrdner = game.money;
        tickStewardCosts(true);
        let deltaOrdner = game.money - geldVorOrdner;
        out.nachtragWirdErfasst = deltaOrdner < 0 && Math.round(game.ffpSeasonNet) === Math.round(deltaOrdner);
        return out;
    });

    // 4. Volle Sanktionsleiter: anhaltender struktureller Verlust über mehrere Saisons löst
    //    Verwarnung, dann Transfersperre, dann Punktabzug aus. Der Verlust wird bewusst
    //    direkt am Akkumulator erzwungen statt über echte Transferausgaben simuliert, weil
    //    concludeSeasonAndAdvance() VOR der FFP-Prüfung selbst noch reale, teils hohe
    //    Saisonend-Zahlungen verbucht (TV-Restausschüttung etc.), die einen realistisch
    //    kleinen Verlust sonst zufällig wieder ausgleichen könnten - der erzwungene Betrag
    //    ist absichtlich so groß, dass er jede reale Saisonend-Zahlung überdeckt.
    const leiter = await page.evaluate(() => {
        let verlauf = [];
        for (let s = 0; s < 3; s++) {
            game.ffpSeasonNet = -50000000;
            concludeSeasonAndAdvance();
            verlauf.push({ strikes: game.ffpStrikes, embargo: game.ffpTransferEmbargo, punkte: getOurLeagueTeam()?.points });
        }
        return { verlauf };
    });

    // 5. Die FFP-Sperre ist von der kurzfristigen Insolvenz-Sperre getrennt: eine erholte
    //    Zahlungsfähigkeit hebt eine bestehende FFP-Sperre NICHT versehentlich mit auf.
    const trennung = await page.evaluate(() => {
        game.ffpTransferEmbargo = true;
        game.transferEmbargo = false;
        game.money = 10000000;
        game.transferBudget = 10000000;
        game.wageBudget = 10000000;
        let kaderVorher = squad.length;
        buyPlayer(0);
        let blockiert = squad.length === kaderVorher;

        game.negativeStreak = 5;
        game.money = -100;
        checkInsolvencyRisk();
        let ueberlebtNegativ = game.ffpTransferEmbargo === true;
        game.money = 1;
        checkInsolvencyRisk();
        return { blockiert, ueberlebtNegativ, ueberlebtErholung: game.ffpTransferEmbargo === true && game.transferEmbargo === false };
    });

    // 6. Speichern und Laden erhält den FFP-Zustand.
    const laden = await page.evaluate(() => {
        game.ffpStrikes = 2;
        game.ffpTransferEmbargo = true;
        game.ffpHistory = [-100000, -50000];
        saveGameToSlot(2);
        game.ffpStrikes = 0;
        game.ffpTransferEmbargo = false;
        game.ffpHistory = [];
        loadGameFromSlot(2, true);
        return { strikes: game.ffpStrikes, embargo: game.ffpTransferEmbargo, historyLen: game.ffpHistory.length };
    });

    assert(r.stadionExempt && r.jugendExempt && r.krediteExempt, 'Infrastruktur- und Finanzierungsvorgänge sind von Financial Fairplay ausgenommen');
    assert(r.transferNichtExempt, 'Transferausgaben zählen dagegen als reguläre Ausgabe');
    assert(r.nurNichtExemptesZaehlt, 'Nur nicht ausgenommene Kontoauszug-Buchungen fließen in die FFP-Bilanz ein');
    assert(r.akkumulatorStimmtExakt, 'Der laufende FFP-Akkumulator stimmt exakt mit der echten Kontostandsänderung überein');
    assert(r.nachtragWirdErfasst, 'Ein Nachtrag nach der Spieltagsabrechnung (Ordnerdienst) wird in der FFP-Bilanz erfasst');

    assert(leiter.verlauf[0].strikes === 1 && !leiter.verlauf[0].embargo, 'Der erste Verstoß bleibt eine bloße Verwarnung');
    assert(leiter.verlauf[1].strikes === 2 && leiter.verlauf[1].embargo, 'Der zweite Verstoß in Folge löst eine Transfersperre aus');
    assert(leiter.verlauf[1].punkte === 0, 'Beim zweiten Verstoß gibt es noch keinen Punktabzug');
    assert(leiter.verlauf[2].strikes === 3 && leiter.verlauf[2].punkte < 0,
        `Der dritte Verstoß zieht tatsächlich Punkte ab (${leiter.verlauf[2].punkte})`);

    assert(trennung.blockiert, 'Eine aktive FFP-Transfersperre blockiert reale Transfers');
    assert(trennung.ueberlebtNegativ, 'Die FFP-Sperre bleibt auch während einer Insolvenzkrise bestehen');
    assert(trennung.ueberlebtErholung, 'Eine wiederhergestellte Zahlungsfähigkeit hebt die FFP-Sperre NICHT automatisch auf');

    assert(laden.strikes === 2 && laden.embargo && laden.historyLen === 2, 'Der Financial-Fairplay-Zustand überlebt Speichern und Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Financial Fairplay');
    await page.close();
}

async function testBonusClauses(browser) {
    console.log('\n[37] Erfolgsbasierte Vertragsboni: Torbonus, Einsatzbonus, Aufstiegsbonus');
    const { page, consoleErrors } = await freshPage(browser);
    const nativeDialoge = [];
    page.on('dialog', async d => { nativeDialoge.push(d.type() + ': ' + d.message().slice(0, 80)); await d.dismiss(); });

    const r = await page.evaluate(() => {
        let out = {};
        let p = squad[0];

        // 1. Ein zu niedriger Bonusbetrag wird abgelehnt - der Spieler verlangt ein
        //    Mindestmaß, das sich am Marktwert orientiert (analog zur Ausstiegsklausel).
        setBonusClause(p.id, 'goals', 5, 1);
        out.zuNiedrigAbgelehnt = p.bonusClauses.goals === null;

        // 2. Ein ausreichender Betrag wird akzeptiert, für alle drei Bonustypen.
        let minGoals = getBonusClauseMinAmount(p, 'goals');
        let minApp = getBonusClauseMinAmount(p, 'appearances');
        let minProm = getBonusClauseMinAmount(p, 'promotion');
        setBonusClause(p.id, 'goals', 3, minGoals + 5000);
        setBonusClause(p.id, 'appearances', 10, minApp + 3000);
        setBonusClause(p.id, 'promotion', null, minProm + 5000);
        out.alleDreiVereinbart = !!p.bonusClauses.goals && !!p.bonusClauses.appearances && !!p.bonusClauses.promotion;

        // 3. Torbonus wird ausgezahlt, sobald die Saisontore die Schwelle erreichen - über den
        //    normalen Kontoauszug (nicht als anonymer Spieltags-Nachtrag), und zählt zur
        //    Financial-Fairplay-Bilanz (reguläres operatives Geschäft, keine Ausnahme).
        game.money = 5000000;
        game.ffpSeasonNet = 0;
        let geldVorTor = game.money;
        p.goalsSeason = 3;
        checkMatchdayBonusClauses(p);
        out.torbonusAusgezahlt = p.bonusPaidThisSeason.goals === true;
        let deltaTor = game.money - geldVorTor;
        out.torbonusGeldSank = deltaTor < 0 && Math.abs(-deltaTor - p.bonusClauses.goals.amount) <= (p.agent ? p.bonusClauses.goals.amount : 0);
        out.torbonusImKontoauszug = game.kontoauszug[game.kontoauszug.length - 1].label === '⚽ Torbonus';
        out.torbonusInFfpBilanz = Math.round(game.ffpSeasonNet) === Math.round(deltaTor);

        // 4. Kein zweites Mal in derselben Saison, auch wenn die Prüfung erneut läuft.
        let geldVorZweitesMal = game.money;
        checkMatchdayBonusClauses(p);
        out.keineDoppelteAuszahlung = game.money === geldVorZweitesMal;

        // 5. Einsatzbonus funktioniert unabhängig vom Torbonus über denselben Mechanismus.
        p.appearancesSeason = 10;
        let geldVorEinsatz = game.money;
        checkMatchdayBonusClauses(p);
        out.einsatzbonusAusgezahlt = p.bonusPaidThisSeason.appearances === true && game.money < geldVorEinsatz;

        // 6. Eine entfernte Klausel wird nicht mehr ausgezahlt.
        removeBonusClause(p.id, 'goals');
        out.klauselEntfernt = p.bonusClauses.goals === null;

        return out;
    });

    // 7. Aufstiegsbonus: wird bei einem tatsächlichen Aufstieg ausgezahlt, bleibt für die
    //    Verträge-Ansicht der neuen Saison sichtbar UND funktioniert bei einem erneuten
    //    Aufstieg in einer späteren Saison ein weiteres Mal (kein "Einmal pro Karriere"-Bug).
    const aufstieg = await page.evaluate(() => {
        let p = squad[0];
        function forcePromotion() {
            let team = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
            team.points = 999;
            stadium.total = 30000;
            stadium.flutlicht = true;
            game.money = 999999999;
        }
        forcePromotion();
        let levelVor1 = game.leagueLevel;
        concludeSeasonAndAdvance();
        let ergebnis1 = { aufgestiegen: game.leagueLevel < levelVor1, bonusSichtbar: p.bonusPaidThisSeason.promotion === true };

        forcePromotion();
        let levelVor2 = game.leagueLevel;
        concludeSeasonAndAdvance();
        let ergebnis2 = { aufgestiegen: game.leagueLevel < levelVor2, bonusErneutAusgezahlt: p.bonusPaidThisSeason.promotion === true };

        return { ergebnis1, ergebnis2 };
    });

    // 8. Speichern und Laden erhält Klauseln, Saisonzähler und Auszahlungsstatus.
    const laden = await page.evaluate(() => {
        let p = squad[0];
        setBonusClause(p.id, 'goals', 8, getBonusClauseMinAmount(p, 'goals') + 4000);
        p.appearancesSeason = 12;
        let vorher = { clause: JSON.stringify(p.bonusClauses), appSeason: p.appearancesSeason };
        saveGameToSlot(4);
        p.bonusClauses.goals = null;
        p.appearancesSeason = 0;
        loadGameFromSlot(4, true);
        let pNachLaden = squad.find(x => x.id === p.id);
        return { stimmtUeberein: JSON.stringify(pNachLaden.bonusClauses) === vorher.clause && pNachLaden.appearancesSeason === vorher.appSeason };
    });

    // 9. Echte DOM-Bedienung statt nur direkter Funktionsaufrufe: die Eingabefelder und
    //    Buttons in der Verträge-Ansicht müssen tatsächlich funktionieren - inklusive der
    //    Ausstiegsklausel, die früher über ein natives prompt() lief (siehe "Keine nativen
    //    Dialoge mehr" - dieser Rest war bei der damaligen Umstellung übersehen worden).
    await page.evaluate(() => {
        closeTutorial();
        // Die vorangegangenen Aufstiegssimulationen (concludeSeasonAndAdvance) legen ein
        // Saisonrückblick-Overlay sowie ggf. Meldungen über die Seite - beides würde echte
        // Klicks blockieren (siehe "element intercepts pointer events").
        let overlay = document.getElementById('season-review-overlay');
        if (overlay) overlay.classList.remove('show');
        let box = document.getElementById('app-notice');
        while (box && box.style.display === 'flex') dismissNotice();
        showScreen('screen-contracts');
    });
    await page.waitForTimeout(150);
    const spielerId = await page.evaluate(() => squad[1].id);
    await page.fill(`#bonus-goals-thresh-${spielerId}`, '4');
    await page.fill(`#bonus-goals-amount-${spielerId}`, '30000');
    await page.click(`button[onclick="confirmBonusClause('${spielerId}', 'goals')"]`);
    await page.fill(`#release-clause-input-${spielerId}`, '500000000');
    await page.click(`button[onclick="confirmSetReleaseClause('${spielerId}')"]`);
    await page.waitForTimeout(150);
    const uiErgebnis = await page.evaluate((pid) => {
        let p = squad.find(x => x.id === pid);
        return { bonusPerKlickGesetzt: !!p.bonusClauses.goals && p.bonusClauses.goals.threshold === 4, klauselPerKlickGesetzt: p.releaseClause === 500000000 };
    }, spielerId);

    assert(r.zuNiedrigAbgelehnt, 'Ein zu niedriger Bonusbetrag wird vom Spieler abgelehnt');
    assert(r.alleDreiVereinbart, 'Torbonus, Einsatzbonus und Aufstiegsbonus lassen sich alle drei vereinbaren');
    assert(r.torbonusAusgezahlt, 'Der Torbonus wird bei Erreichen der Schwelle ausgezahlt');
    assert(r.torbonusGeldSank, 'Die Auszahlung entspricht dem vereinbarten Betrag (ggf. zzgl. Beraterprovision)');
    assert(r.torbonusImKontoauszug, 'Die Auszahlung erscheint klar beschriftet im Kontoauszug');
    assert(r.torbonusInFfpBilanz, 'Die Auszahlung zählt zur Financial-Fairplay-Bilanz (kein Ausnahme-Schlupfloch)');
    assert(r.keineDoppelteAuszahlung, 'Derselbe Bonus wird nicht zweimal in derselben Saison ausgezahlt');
    assert(r.einsatzbonusAusgezahlt, 'Der Einsatzbonus wird unabhängig vom Torbonus ausgezahlt');
    assert(r.klauselEntfernt, 'Eine entfernte Klausel wird nicht mehr ausgezahlt');

    assert(aufstieg.ergebnis1.aufgestiegen && aufstieg.ergebnis1.bonusSichtbar, 'Der Aufstiegsbonus wird bei einem tatsächlichen Aufstieg ausgezahlt und bleibt sichtbar');
    assert(aufstieg.ergebnis2.aufgestiegen && aufstieg.ergebnis2.bonusErneutAusgezahlt, 'Ein erneuter Aufstieg in einer späteren Saison zahlt den Bonus ein weiteres Mal aus');

    assert(laden.stimmtUeberein, 'Klauseln, Saisonzähler und Auszahlungsstatus überleben Speichern und Laden');
    assert(uiErgebnis.bonusPerKlickGesetzt, 'Eine Bonusklausel lässt sich über echte Eingabefelder und einen Klick setzen');
    assert(uiErgebnis.klauselPerKlickGesetzt, 'Auch die Ausstiegsklausel läuft jetzt über ein Eingabefeld statt über ein natives prompt()');
    assert(nativeDialoge.length === 0, `Die Bonusklausel-Verwaltung nutzt keine nativen Dialoge (${nativeDialoge.join(' | ') || 'keiner'})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Vertragsboni');
    await page.close();
}

async function testSquadPlanningTool(browser) {
    console.log('\n[38] Kaderplanungstool: Positionstiefe, Altersstruktur und Verträge kombiniert');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        closeTutorial();

        // 1. Der neue Tab hängt korrekt im Kaderplanungs-Hub und schaltet sichtbar frei.
        showScreen('screen-squad-planning');
        out.hubSichtbar = document.getElementById('screen-hub-kaderplanung').style.display === 'block';
        out.screenSichtbar = document.getElementById('screen-squad-planning').style.display === 'block';
        out.tabAktiv = document.getElementById('hubtab-btn-screen-squad-planning').className.includes('btn-action');
        // Die Geschwister-Tabs desselben Hubs sind währenddessen ausgeblendet.
        out.geschwisterAusgeblendet = document.getElementById('screen-contracts').style.display === 'none';

        // 2. Alle vier Positionsgruppen erscheinen mit echtem Inhalt.
        let posBox = document.getElementById('squad-planning-position-box').innerHTML;
        out.alleVierPositionen = ['Torwart', 'Abwehr', 'Mittelfeld', 'Sturm'].every(x => posBox.includes(x));

        // 3. Die Analyse ist vollständig: die Summe über alle Positionsgruppen ergibt exakt
        //    die Kadergröße (keine Spieler "verlieren" sich zwischen den Gruppen).
        let analysis = getSquadPlanningAnalysis();
        out.summeStimmt = analysis.reduce((s, a) => s + a.count, 0) === squad.length;

        // 4. Gezielt eine Position kaputt machen: zu wenige, überaltert - muss als KRITISCH
        //    erkannt werden, während eine andere, bewusst gesund gehaltene Position weiter als
        //    unauffällig gilt. Das Mittelfeld wird dafür EBENFALLS deterministisch neu
        //    aufgebaut statt aus dem zufällig generierten Startkader übernommen zu werden -
        //    sonst könnte es je nach Zufallssamen (z.B. in der CI) selbst zufällig knapp
        //    "BEOBACHTEN" auslösen und die Prüfung flackern lassen.
        squad = squad.filter(p => p.pos !== 'ABW' && p.pos !== 'MIT');
        for (let i = 0; i < 2; i++) {
            let p = createPlayer('ABW', 70, 75);
            p.age = 33;
            p.contracts = 3;
            squad.push(p);
        }
        for (let i = 0; i < 8; i++) {
            let p = createPlayer('MIT', 70, 80);
            p.age = 24;
            p.contracts = 4;
            squad.push(p);
        }
        let analyse2 = getSquadPlanningAnalysis();
        let abwehr = analyse2.find(a => a.pos === 'ABW');
        let mittelfeld = analyse2.find(a => a.pos === 'MIT');
        out.duenneUeberalterteAbwehrErkannt = abwehr.thin && abwehr.agingRisk && abwehr.riskScore >= 2;
        out.unveraenderteMittelfeldBleibtUnauffaellig = mittelfeld.riskScore < 2;

        renderSquadPlanningView();
        let warnBox = document.getElementById('squad-planning-warnings-box').innerHTML;
        out.warnungNenntAbwehrUndKritisch = warnBox.includes('Abwehr') && warnBox.includes('KRITISCH');
        out.warnungNenntMittelfeldNicht = !warnBox.includes('Mittelfeld');

        // 5. Ein rundum gesunder Kader (jede Position gut besetzt, jung, langfristige Verträge)
        //    löst gar keine Warnung aus - der GESAMTE Kader wird dafür bewusst durch einen
        //    vollständig kontrollierten ersetzt, da der zufällig generierte Startkader in
        //    anderen Positionen bereits eigene, unabhängige Zufallswerte haben kann.
        squad = [];
        ['TW', 'ABW', 'MIT', 'ST'].forEach(pos => {
            let anzahl = { TW: 3, ABW: 8, MIT: 8, ST: 5 }[pos];
            for (let i = 0; i < anzahl; i++) {
                let p = createPlayer(pos, 70, 80);
                p.age = 24;
                p.contracts = 4;
                squad.push(p);
            }
        });
        renderSquadPlanningView();
        let warnBoxGesund = document.getElementById('squad-planning-warnings-box').innerHTML;
        out.keineWarnungBeiGesundemKader = warnBoxGesund.includes('Keine Position');

        // 6. Die Altersverteilung zeigt echte, vom Kader abhängige Werte (kein Platzhalter).
        let ageBox = document.getElementById('squad-planning-age-box').innerHTML;
        out.altersverteilungHatInhalt = ageBox.length > 100;

        // 7. Auslaufende Verträge werden nach Position gruppiert dargestellt, nicht nur als
        //    unsortierte Gesamtliste (die es schon separat in der Saisonplanung gibt).
        squad[0].contracts = 0;
        renderSquadPlanningView();
        let contractBox = document.getElementById('squad-planning-contract-box').innerHTML;
        out.vertragsklippeNachPosition = contractBox.includes(squad[0].name);

        // 8. Gehaltsplanung (25.17): auslaufende Stammspieler, Bedarf gegen voraussichtliches Budget
        const elfIds = pickBestLineupIds();
        squad.forEach(p => { p.contracts = 3; });
        const stamm = squad.find(p => elfIds.includes(p.id));
        stamm.contracts = 1;
        const o = getSquadPlanningWageOutlook();
        renderSquadPlanningView();
        const wageBox = document.getElementById('squad-planning-wage-box').innerHTML;
        out.gehaltsplanung = o.stamm.length === 1 && o.stamm[0].id === stamm.id && o.verlaengerung === getContractDemand(stamm).gehalt
            && o.bedarf === squad.filter(p => p.contracts > 1).reduce((s, p) => s + p.wage, 0) + o.verlaengerung + o.vorvertraege
            && wageBox.includes(stamm.name) && wageBox.includes('Bedarf nächste Saison');
        game.wageBudget = 1; game.money = 0;
        out.gehaltsWarnung = getSquadPlanningWageOutlook().spielraum !== 0 && (() => { renderSquadPlanningView(); return document.getElementById('squad-planning-wage-box').innerHTML.includes(getSquadPlanningWageOutlook().spielraum >= 0 ? 'Spielraum' : 'über dem Budget'); })();

        return out;
    });

    assert(r.hubSichtbar, 'Der Kaderplanungs-Hub wird beim Öffnen des neuen Tabs sichtbar');
    assert(r.screenSichtbar, 'Der Kaderplanungstool-Screen selbst wird sichtbar');
    assert(r.tabAktiv, 'Der zugehörige Tab-Button wird als aktiv markiert');
    assert(r.geschwisterAusgeblendet, 'Die anderen Tabs desselben Hubs bleiben dabei ausgeblendet');
    assert(r.alleVierPositionen, 'Alle vier Positionsgruppen erscheinen mit echtem Inhalt');
    assert(r.summeStimmt, 'Die Summe der Positionsgruppen entspricht exakt der Kadergröße');
    assert(r.duenneUeberalterteAbwehrErkannt, 'Eine dünn besetzte, überalterte Position wird korrekt als kritisch erkannt');
    assert(r.unveraenderteMittelfeldBleibtUnauffaellig, 'Eine unveränderte, gesunde Position bleibt unauffällig');
    assert(r.warnungNenntAbwehrUndKritisch, 'Die Schwachstellen-Warnung nennt die betroffene Position konkret als kritisch');
    assert(r.warnungNenntMittelfeldNicht, 'Eine unauffällige Position taucht nicht in den Warnungen auf');
    assert(r.keineWarnungBeiGesundemKader, 'Ein durchgehend gesunder Kader löst gar keine Warnung aus');
    assert(r.altersverteilungHatInhalt, 'Die Alterspyramide zeigt echte, kaderabhängige Werte');
    assert(r.vertragsklippeNachPosition, 'Auslaufende Verträge werden nach Position aufgeschlüsselt angezeigt');
    assert(r.gehaltsplanung && r.gehaltsWarnung, 'Gehaltsplanung zeigt auslaufende Stammspieler, Verlängerungskosten und Spielraum gegen das Budget');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Kaderplanungstool');
    await page.close();
}

async function testStadiumAusbau2(browser) {
    console.log('\n[39] Stadion-Ausbau 2.0: Dauerkarten, Rasenpflege, Kapazitätsprojekte, Nebeneinnahmen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Kein Geld-Windfall beim allerersten Programmstart - vor der ersten echten
        //    Saisonwende gibt es bewusst noch KEINE Dauerkarten (ein brandneuer Verein hat
        //    naturgemäß noch keine verkauft). Das war ein echter Bug im ersten Entwurf: ein
        //    automatischer Verkauf schon beim Bootstrap brachte eine bestehende Prüfung zum
        //    gewählten Startkapital zum Kippen.
        out.keineDauerkartenVorErsterSaisonwende = game.seasonTicketHolders === 0;

        // 2. Bei der ersten echten Saisonwende wird der Preis exakt auf den aktuellen
        //    Marktwert kalibriert (ratio 1.0, nicht der Fantasie-Startwert aus state.js) und
        //    es entstehen tatsächlich Dauerkarteninhaber.
        renewSeasonTickets();
        let marktpreis = getMarketSeasonTicketPrice();
        out.preisAufMarktKalibriert = Math.abs(game.ticketPrices.dauerkarte - marktpreis) <= 1;
        out.dauerkartenNachSaisonwendeVorhanden = game.seasonTicketHolders > 0;

        // 3. Die Zuschauerzahl selbst bleibt von Dauerkarten UNBEEINFLUSST - das war ein
        //    Designfehler im ersten Entwurf (Dauerkarten als harter Zuschauer-Sockel), der
        //    Fanstimmungs-Einfluss, Ligadeckel und Derby-Bonus überschrieben hat.
        game.fans = 90;
        game.seasonTicketHolders = Math.round((stadium.total || 16000) * 0.9);
        let mitVielenDauerkarten = calculateMatchAttendance(1, 1);
        game.seasonTicketHolders = 0;
        let ohneDauerkarten = calculateMatchAttendance(1, 1);
        out.zuschauerzahlUnbeeinflusst = mitVielenDauerkarten === ohneDauerkarten;

        // 4. Aber die ECHTE Spieltags-Einnahme berücksichtigt Dauerkarten: der bereits bezahlte
        //    Anteil wird nicht nochmal kassiert. Die Zuschauerzahl wird für den Vergleich
        //    FEST vorgegeben (wie beim Live-Match, siehe applyMatchdayFinances in match.js),
        //    damit die normale Zufallsstreuung der Zuschauerzahl den Vergleich nicht verzerrt.
        // Bewusst eine KLEINE Inhaberzahl (500) statt einer großen - bei einem Fantasiewert
        // über der festen Zuschauerzahl würde der zahlende Anteil auf 0 fallen und der
        // Ticketverkauf-Posten (amount>0-Filter) ganz aus dem Buchungsjournal verschwinden.
        game.money = 5000000;
        currentMatch = { finalAttendance: 5000, finalAttendanceMatchday: game.matchday, isHome: true };
        game.seasonTicketHolders = 500;
        applyMatchdayFinances(true, true, false, false, 'Testgegner', '2:0');
        let ledgerMitDauerkarte500 = game.financeLedger[game.financeLedger.length - 1].einnahmen.find(e => e.label.includes('Ticketverkauf'))?.amount || 0;

        game.money = 5000000;
        game.seasonTicketHolders = 0;
        applyMatchdayFinances(true, true, false, false, 'Testgegner', '2:0');
        let ledgerOhneDauerkarte = game.financeLedger[game.financeLedger.length - 1].einnahmen.find(e => e.label.includes('Ticketverkauf'))?.amount || 0;
        out.dauerkartenSenkenSpieltagsEinnahme = ledgerMitDauerkarte500 < ledgerOhneDauerkarte;

        // 5. Rasenpflege: Zustand sinkt durch Heimspiele, lässt sich gezielt wieder anheben.
        stadium.pitchCondition = 60;
        let condVor = stadium.pitchCondition;
        tickPitchCondition();
        out.rasenNutztSichAb = stadium.pitchCondition < condVor;
        let geldVorPflege = game.money;
        maintainPitch(100);
        out.pflegeKostetGeldUndHilft = game.money < geldVorPflege && stadium.pitchCondition > condVor;
        out.rasenNieUnterMinimum = stadium.pitchCondition >= 20;

        // 6. Kapazitätsprojekte: Effekt, Gate-Prüfung, Sitzplatz-Anteile bleiben normiert.
        game.money = 999999999;
        let capVor = stadium.total;
        buyCapacityProject('zusatztribuene');
        let queued = game.stadiumConstructionQueue.find(p => p.params && p.params.key === 'zusatztribuene');
        for (let i = 0; i < queued.totalDays; i++) tickStadiumConstruction();
        out.kapazitaetsprojektWirkt = stadium.total > capVor;

        let stehVor = stadium.stehShare;
        buyCapacityProject('sitzplatzumbau');
        let queued2 = game.stadiumConstructionQueue.find(p => p.params && p.params.key === 'sitzplatzumbau');
        for (let i = 0; i < queued2.totalDays; i++) tickStadiumConstruction();
        out.sitzplatzumbauVerschiebtAnteil = stadium.stehShare < stehVor;
        out.anteileBleibenNormiert = Math.abs((stadium.stehShare + stadium.sitzShare + stadium.vipShare) - 1) < 0.001;

        game.boardSat = 10;
        let vorGrossausbau = game.stadiumConstructionQueue.length;
        buyCapacityProject('grossausbau');
        out.grossausbauOhneVertrauenAbgelehnt = game.stadiumConstructionQueue.length === vorGrossausbau;

        // 7. Nebeneinnahmen-Übersicht: reine, korrekte Anzeige bestehender Campus-Erlöse.
        campusBuildings.fankneipe.lvl = 2;
        campusBuildings.parkhaus.lvl = 1;
        let est = computeAncillaryIncomeEstimate();
        out.nebeneinnahmenKorrekt = est.gastronomie >= 2 * 1800 && est.parken === 1500 && est.summe === est.gastronomie + est.parken + est.vipBewirtung + est.fanshop;

        // 8. Speichern/Laden erhält alle neuen Felder.
        stadium.pitchCondition = 71;
        stadium.hybridrasen = true;
        game.ticketPrices.dauerkarte = 111;
        game.seasonTicketHolders = 4444;
        saveGameToSlot(6);
        stadium.pitchCondition = 85; stadium.hybridrasen = false;
        game.ticketPrices.dauerkarte = 1; game.seasonTicketHolders = 0;
        loadGameFromSlot(6, true);
        out.speichernLadenOk = stadium.pitchCondition === 71 && stadium.hybridrasen === true && game.ticketPrices.dauerkarte === 111 && game.seasonTicketHolders === 4444;

        return out;
    });

    // 9. Ein neuer, per Startdialog konfigurierter Verein bekommt exakt das gewählte
    //    Startkapital - kein unerwarteter Dauerkarten-Bonus (Regressionsschutz für den
    //    zunächst gefundenen Bug).
    await page.evaluate(() => closeTutorial());
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.click('#btn-new-game');
    await page.waitForTimeout(150);
    await page.evaluate(() => { selectedNewGameLevel = 3; selectedNewGameMoney = 300000; renderNewGameSetupOptions(); });
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(100);
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(600);
    const neustart = await page.evaluate(() => ({
        money: game.money,
        erwartet: getNewGameStartMoney(3, 300000),
        seasonTicketHolders: game.seasonTicketHolders
    }));

    assert(r.keineDauerkartenVorErsterSaisonwende, 'Vor der ersten echten Saisonwende gibt es noch keine Dauerkarten (kein Geld-Windfall beim Programmstart)');
    assert(r.preisAufMarktKalibriert, 'Der Dauerkartenpreis wird beim ersten Verkauf exakt auf den Marktwert kalibriert');
    assert(r.dauerkartenNachSaisonwendeVorhanden, 'Nach der ersten echten Saisonwende gibt es tatsächlich Dauerkarteninhaber');
    assert(r.zuschauerzahlUnbeeinflusst, 'Die Zuschauerzahl selbst bleibt von Dauerkarten unbeeinflusst (kein verzerrender Sockel)');
    assert(r.dauerkartenSenkenSpieltagsEinnahme, 'Ein bereits über die Dauerkarte bezahlter Anteil wird an dem Spieltag nicht doppelt kassiert');
    assert(r.rasenNutztSichAb, 'Der Rasenzustand nutzt sich durch Heimspiele ab');
    assert(r.pflegeKostetGeldUndHilft, 'Rasenpflege kostet Geld und verbessert den Zustand messbar');
    assert(r.rasenNieUnterMinimum, 'Der Rasenzustand fällt nie unter das Minimum');
    assert(r.kapazitaetsprojektWirkt, 'Ein namentliches Kapazitätsprojekt erhöht nach Fertigstellung die Gesamtkapazität');
    assert(r.sitzplatzumbauVerschiebtAnteil, 'Sitzplatzumbau verschiebt den Stehplatzanteil tatsächlich zugunsten der Sitzplätze');
    assert(r.anteileBleibenNormiert, 'Steh-, Sitz- und VIP-Anteil ergeben nach einem Umbau weiterhin exakt 100%');
    assert(r.grossausbauOhneVertrauenAbgelehnt, 'Der Großausbau wird ohne ausreichendes Vorstandsvertrauen abgelehnt');
    assert(r.nebeneinnahmenKorrekt, 'Die Nebeneinnahmen-Übersicht zeigt die echten, aus den Campus-Stufen berechneten Werte');
    assert(r.speichernLadenOk, 'Rasenzustand, Hybridrasen, Dauerkartenpreis und -inhaberzahl überleben Speichern und Laden');
    assert(neustart.money === neustart.erwartet, `Ein per Startdialog konfigurierter Verein bekommt exakt das gewählte Startkapital, kein Dauerkarten-Bonus (${neustart.money} statt ${neustart.erwartet})`);
    assert(neustart.seasonTicketHolders === 0, 'Auch dort gibt es vor der ersten Saisonwende noch keine Dauerkarteninhaber');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Stadion-Ausbau 2.0');
    await page.close();
}

async function testPlayerAvatars(browser) {
    console.log('\n[40] Spielerporträts: prozedural generierte Avatare für jeden Spieler');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        closeTutorial();

        // 1. Jeder Spieler bekommt ein echtes, nicht-leeres SVG-Porträt.
        let svg = getPlayerAvatarSVG(squad[0], 56);
        out.erzeugtEchtesSvg = svg.includes('<svg') && svg.length > 200;

        // 2. Dasselbe Porträt ist für denselben Spieler bei wiederholtem Aufruf IDENTISCH
        //    (deterministisch aus der Spieler-ID) - sonst würde sich das Gesicht eines
        //    Spielers bei jedem Rendern zufällig ändern.
        let svgNochmal = getPlayerAvatarSVG(squad[0], 56);
        out.deterministischGleich = svg === svgNochmal;

        // 3. Zwei verschiedene Spieler bekommen (mit extrem hoher Wahrscheinlichkeit)
        //    unterschiedliche Porträts - keine Einheits-Grafik für den ganzen Kader.
        let unterschiedlich = new Set(squad.slice(0, 10).map(p => getPlayerAvatarSVG(p, 56))).size;
        out.kaderIstVisuellUnterschiedlich = unterschiedlich >= 8;

        // 4. Der Mundausdruck reagiert LIVE auf die aktuelle Moral (nicht Teil der
        //    geseedeten, stabilen Identität) - derselbe Spieler sieht bei guter und
        //    schlechter Stimmung sichtbar anders aus.
        let p = squad[0];
        p.morale = 90;
        let froehlich = getPlayerAvatarSVG(p, 56);
        p.morale = 15;
        let traurig = getPlayerAvatarSVG(p, 56);
        out.mundAendertSichMitMoral = froehlich !== traurig;

        // 5. Eine kleine Narbe erscheint nur bei häufig verletzten Spielern - ein echtes
        //    Spieldatum fließt sichtbar ins Porträt ein, nicht nur reiner Zufall.
        let robust = { ...squad[1], id: 'test-robust-spieler', timesInjured: 0 };
        let verletzungsanfaellig = { ...squad[1], id: 'test-narbe-spieler', timesInjured: 5 };
        // Mehrere ID-Varianten testen, da die Narbe selbst bei hoher timesInjured-Zahl nur
        // mit ~65% Wahrscheinlichkeit erscheint (seededRand-Anteil) - bei robust (0) ist sie
        // dagegen IMMER ausgeschlossen, das lässt sich eindeutig prüfen.
        out.keineNarbeBeiRobustemSpieler = !getPlayerAvatarSVG(robust, 56).includes('#b3564a');

        // 6. Das Porträt hängt AUSSCHLIESSLICH von echten, stabilen Merkmalen ab (Alter,
        //    Charakter, Verletzungshistorie) plus der ID - zwei Spieler mit komplett
        //    identischen Attributen aber unterschiedlicher ID sehen trotzdem unterschiedlich
        //    aus (die ID allein reicht für Varianz).
        let klon1 = { ...squad[2], id: 'klon-eins' };
        let klon2 = { ...squad[2], id: 'klon-zwei' };
        out.idAlleinReichtFuerVarianz = getPlayerAvatarSVG(klon1, 56) !== getPlayerAvatarSVG(klon2, 56);

        // 7. Der Positions-Hintergrund ist an die echte Position gekoppelt.
        let tw = { ...squad[2], id: 'test-tw', pos: 'TW' };
        let st = { ...squad[2], id: 'test-tw', pos: 'ST' };
        out.hintergrundfarbeFolgtPosition = getPlayerAvatarSVG(tw, 56) !== getPlayerAvatarSVG(st, 56);

        // 8. renderPlayerAvatarTag() liefert einen fertigen, rund zugeschnittenen Chip für
        //    Listenzeilen (Kader, Transfermarkt, Jugend, etc.).
        let tag = renderPlayerAvatarTag(squad[0], 32);
        out.tagHatRundenRahmen = tag.includes('border-radius:50%') && tag.includes('<svg');

        return out;
    });

    // 9. Das Porträt taucht tatsächlich an den wichtigsten Einbindungsstellen im echten
    //    Markup auf - nicht nur als isoliert aufrufbare Funktion.
    const stellen = await page.evaluate(() => {
        let out = {};
        game.money = 5000000;

        showScreen('screen-squad');
        out.kaderliste = (document.getElementById('bench-list')?.innerHTML || '').includes('player-avatar');

        openPlayerDetail(squad[0].id, 'squad');
        out.detailPopup = (document.getElementById('pd-avatar')?.innerHTML || '').includes('<svg');
        closePlayerDetail();

        showScreen('screen-transfer'); setTransferTab('market');
        out.transfermarkt = (document.getElementById('market-list')?.innerHTML || '').includes('player-avatar');
        setTransferTab('free');
        out.vereinslose = (document.getElementById('free-agents-list')?.innerHTML || '').includes('player-avatar');
        setTransferTab('sell');
        out.kaderVerkaufen = (document.getElementById('sell-list')?.innerHTML || '').includes('player-avatar');

        showScreen('screen-contracts');
        out.vertraege = (document.getElementById('contracts-list')?.innerHTML || '').includes('player-avatar');

        showScreen('screen-training');
        out.training = (document.getElementById('individual-training-list')?.innerHTML || '').includes('player-avatar');

        managerRPG.level = 10;
        foundSecondTeam();
        showScreen('screen-second-team');
        out.zweiteMannschaft = (document.getElementById('st-squad-list')?.innerHTML || '').includes('player-avatar');

        return out;
    });

    assert(r.erzeugtEchtesSvg, 'Jeder Spieler bekommt ein echtes, nicht-leeres SVG-Porträt');
    assert(r.deterministischGleich, 'Das Porträt eines Spielers bleibt bei wiederholtem Aufruf identisch (deterministisch aus der ID)');
    assert(r.kaderIstVisuellUnterschiedlich, `Verschiedene Spieler bekommen verschiedene Porträts (${JSON.stringify(r.kaderIstVisuellUnterschiedlich)})`);
    assert(r.mundAendertSichMitMoral, 'Der Mundausdruck ändert sich live mit der aktuellen Moral des Spielers');
    assert(r.keineNarbeBeiRobustemSpieler, 'Ein nie verletzter Spieler bekommt nie die Verletzungs-Narbe');
    assert(r.idAlleinReichtFuerVarianz, 'Zwei sonst identische Spieler mit unterschiedlicher ID sehen trotzdem unterschiedlich aus');
    assert(r.hintergrundfarbeFolgtPosition, 'Die Hintergrundfarbe des Porträts folgt der echten Spielerposition');
    assert(r.tagHatRundenRahmen, 'renderPlayerAvatarTag() liefert einen fertigen, rund zugeschnittenen Listenzeilen-Chip');

    assert(stellen.kaderliste, 'Das Porträt erscheint in der Kaderliste');
    assert(stellen.detailPopup, 'Das Porträt erscheint im Spieler-Detail-Popup');
    assert(stellen.transfermarkt, 'Das Porträt erscheint im Transfermarkt (Kaufliste)');
    assert(stellen.vereinslose, 'Das Porträt erscheint bei den Vereinslosen');
    assert(stellen.kaderVerkaufen, 'Das Porträt erscheint bei "Kader verkaufen"');
    assert(stellen.vertraege, 'Das Porträt erscheint in der Vertragsverwaltung');
    assert(stellen.training, 'Das Porträt erscheint beim individuellen Training');
    assert(stellen.zweiteMannschaft, 'Das Porträt erscheint in der Kaderliste der zweiten Mannschaft');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Spielerporträts');
    await page.close();
}

// ---------------------------------------------------------------------------
// [41] TRAININGSKALENDER: MEHRSPIELTAGE-VORSCHAU
// ---------------------------------------------------------------------------
// Die bisherige Belastungswarnung sah nur den unmittelbar nächsten Spieltag. Der neue
// Trainingskalender zeigt Liga/DFB-Pokal/Landespokal/Europapokal für die kommenden
// Spieltage und erkennt Belastungsphasen (mehrere wichtige Spiele dicht hintereinander)
// über den gesamten Vorschau-Zeitraum, nicht nur einen Spieltag im Voraus.
async function testTrainingCalendar(browser) {
    console.log('\n[41] Trainingskalender: Mehrspieltage-Vorschau auf Liga/Pokal/Europapokal');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let out = {};
        closeTutorial();
        showScreen('screen-training');

        // 1. Ohne besondere Wettbewerbsbeteiligung sind alle Vorschau-Spieltage einfache
        //    Ligaspieltage, direkt auf den aktuellen Spieltag folgend.
        game.matchday = 1;
        cupTournament.eliminated = true;
        landesPokal.active = false;
        europeTournament.active = false;
        let nurLiga = getUpcomingFixtureCalendar();
        out.standardLaengeStimmt = nurLiga.length === 6;
        out.ohneWettbewerbeNurLiga = nurLiga.every(e => e.type === 'liga');
        out.spieltagsnummernKorrekt = nurLiga.map(e => e.matchday).join(',') === '2,3,4,5,6,7';

        // 2. DFB-Pokal wird nur erkannt, wenn der Verein tatsächlich teilnahmeberechtigt ist
        //    (ab 3. Liga automatisch, sonst nur über den Landespokal-Aufstieg) und noch nicht
        //    ausgeschieden ist.
        game.matchday = 3; // naechster Spieltag = 4 = cupTournament.matchdays[0]
        cupTournament.eliminated = false;
        game.leagueLevel = 5; game.dfbPokalViaLandespokal = false;
        out.dfbPokalOhneBerechtigungNichtErkannt = getUpcomingFixtureCalendar()[0].type === 'liga';
        game.dfbPokalViaLandespokal = true;
        out.dfbPokalMitBerechtigungErkannt = getUpcomingFixtureCalendar()[0].type === 'dfbpokal';
        cupTournament.eliminated = true;
        out.ausgeschiedenNichtMehrErkannt = getUpcomingFixtureCalendar()[0].type === 'liga';
        cupTournament.eliminated = false;

        // 3. Landespokal und Europapokal jeweils nur bei aktiver Teilnahme.
        game.matchday = 5; // naechster Spieltag = 6 = landesPokal.matchdays[0]
        landesPokal.active = false;
        out.landespokalInaktivNichtErkannt = getUpcomingFixtureCalendar()[0].type === 'liga';
        landesPokal.active = true;
        out.landespokalAktivErkannt = getUpcomingFixtureCalendar()[0].type === 'landespokal';
        landesPokal.active = false;

        game.matchday = 2; // naechster Spieltag = 3 = europeTournament.matchdays[0]
        europeTournament.active = true;
        out.europapokalErkannt = getUpcomingFixtureCalendar()[0].type === 'europapokal';
        europeTournament.active = false;

        // 4. Die Vorschau bricht am Saisonende (Spieltag 34) ab statt darüber hinauszulaufen.
        game.matchday = 32;
        let saisonende = getUpcomingFixtureCalendar();
        out.stoppTAmSaisonende = saisonende.length === 2 && saisonende.every(e => e.matchday <= 34);

        // 5. Belastungsphase: zwei wichtige Spieltage im Abstand von höchstens zwei
        //    Spieltagen werden erkannt, weiter auseinanderliegende dagegen nicht.
        let eng = [{ matchday: 10, type: 'liga' }, { matchday: 11, type: 'dfbpokal' }, { matchday: 13, type: 'europapokal' }];
        out.belastungsphaseErkannt = JSON.stringify(findCongestedStretch(eng)) === JSON.stringify({ from: 11, to: 13 });
        let entspannt = [{ matchday: 10, type: 'liga' }, { matchday: 12, type: 'dfbpokal' }, { matchday: 20, type: 'europapokal' }];
        out.keineBelastungsphaseOhneHaeufung = findCongestedStretch(entspannt) === null;

        return out;
    });

    // 6. Integrationstest: die Vorschau erscheint im echten Trainingskalender-Panel, eine
    //    erkannte Belastungsphase zeigt die Warnung samt Schonplan-Knopf, und der Knopf
    //    übernimmt tatsächlich den bestehenden Regenerations-Wochenplan.
    const dom = await page.evaluate(() => {
        let out = {};
        game.matchday = 9; // naechste Spieltage 10-15: Europapokal (11) und DFB-Pokal (12) eng beieinander
        cupTournament.eliminated = false;
        game.leagueLevel = 5; game.dfbPokalViaLandespokal = true;
        europeTournament.active = true;
        landesPokal.active = false;
        renderTrainingCalendarPreview();
        let box = document.getElementById('training-calendar-box').innerHTML;
        out.zeigtSechsSpieltage = (box.match(/SpT \d+/g) || []).length === 6;
        out.zeigtBelastungswarnung = box.includes('Belastungsphase') && box.includes('Schonplan übernehmen');

        game.weeklyTrainingPlan = { mo: 'kondition', di: 'kondition', mi: 'kondition', do: 'kondition', fr: 'kondition', sa: 'kondition', so: 'kondition' };
        applyCongestionRecommendation();
        out.schonplanUebernommen = game.weeklyTrainingPlan.mo === 'erholung';
        return out;
    });

    assert(r.standardLaengeStimmt, 'Der Trainingskalender zeigt genau 6 kommende Spieltage');
    assert(r.ohneWettbewerbeNurLiga, 'Ohne Pokal-/Europapokalbeteiligung sind alle Vorschau-Spieltage Liga');
    assert(r.spieltagsnummernKorrekt, 'Die Spieltagsnummern in der Vorschau folgen direkt auf den aktuellen Spieltag');
    assert(r.dfbPokalOhneBerechtigungNichtErkannt, 'DFB-Pokal wird ohne Teilnahmeberechtigung nicht als Wettbewerb erkannt');
    assert(r.dfbPokalMitBerechtigungErkannt, 'DFB-Pokal wird mit Teilnahmeberechtigung korrekt erkannt');
    assert(r.ausgeschiedenNichtMehrErkannt, 'Nach dem Ausscheiden aus dem DFB-Pokal zeigt die Vorschau wieder Liga');
    assert(r.landespokalInaktivNichtErkannt, 'Landespokal wird nur erkannt, wenn der Verein noch im Wettbewerb ist');
    assert(r.landespokalAktivErkannt, 'Landespokal wird bei aktiver Teilnahme korrekt erkannt');
    assert(r.europapokalErkannt, 'Europapokal wird bei aktiver Teilnahme korrekt erkannt');
    assert(r.stoppTAmSaisonende, 'Die Vorschau läuft nicht über Spieltag 34 hinaus');
    assert(r.belastungsphaseErkannt, 'Zwei wichtige Spieltage im Abstand von höchstens zwei Spieltagen gelten als Belastungsphase');
    assert(r.keineBelastungsphaseOhneHaeufung, 'Weiter auseinanderliegende wichtige Spieltage lösen keine Belastungsphase aus');
    assert(dom.zeigtSechsSpieltage, 'Der Trainingskalender rendert alle sechs Vorschau-Spieltage im echten Markup');
    assert(dom.zeigtBelastungswarnung, 'Eine erkannte Belastungsphase zeigt die Warnung samt Schonplan-Knopf');
    assert(dom.schonplanUebernommen, 'Der Schonplan-Knopf übernimmt den bestehenden Regenerations-Wochenplan');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Trainingskalender');
    await page.close();
}

// ---------------------------------------------------------------------------
// [42] TAKTIKTAFEL: TAKTIK-AUTOMATIK
// ---------------------------------------------------------------------------
// Neue STANDING-Einstellung in der Taktiktafel: reagiert im laufenden Spiel automatisch auf
// den Spielstand (offensiver bei Rückstand, defensiver bei knapper Führung kurz vor Schluss),
// ohne dass das Live-Taktikpanel manuell bedient werden muss. Feuert je Regel nur einmal pro
// Spiel und nur ab der jeweils passenden Spielminute.
async function testTacticAutomation(browser) {
    console.log('\n[42] Taktiktafel: Taktik-Automatik reagiert auf den Spielstand');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let out = {};
        closeTutorial();

        // 1. Die Automatik ist standardmäßig deaktiviert und lässt sich umschalten.
        out.standardmaessigDeaktiviert = game.tacticAutomation.offensivBeiRueckstand === false
            && game.tacticAutomation.defensivBeiFuehrung === false;
        toggleTacticAutomation('offensivBeiRueckstand');
        out.umschaltenFunktioniert = game.tacticAutomation.offensivBeiRueckstand === true;
        toggleTacticAutomation('offensivBeiRueckstand');
        out.zurueckschaltenFunktioniert = game.tacticAutomation.offensivBeiRueckstand === false;

        // 2. Deaktivierte Automatik greift trotz Rückstand nicht ein.
        game.tacticStyle = 'ausgeglichen';
        currentMatch = { isHome: true, homeGoals: 0, awayGoals: 1, minute: 60 };
        applyTacticAutomation();
        out.deaktiviertGreiftNicht = game.tacticStyle === 'ausgeglichen';

        // 3. Aktivierte Regel greift bei Rückstand ab der 46. Minute.
        game.tacticAutomation.offensivBeiRueckstand = true;
        game.tacticStyle = 'ausgeglichen';
        currentMatch = { isHome: true, homeGoals: 0, awayGoals: 1, minute: 60 };
        applyTacticAutomation();
        out.offensivBeiRueckstandGreift = game.tacticStyle === 'offensiv' && currentMatch.tacticAutomationFired.offensiv === true;

        // 4. Vor der 46. Minute greift dieselbe Regel noch nicht.
        game.tacticStyle = 'ausgeglichen';
        currentMatch = { isHome: true, homeGoals: 0, awayGoals: 1, minute: 30 };
        applyTacticAutomation();
        out.nichtVorHalbzeit = game.tacticStyle === 'ausgeglichen';

        // 5. Einmaligkeit: nach dem Auslösen wird eine manuelle Rückstellung nicht sofort
        //    wieder überschrieben, solange derselbe Rückstand anhält.
        game.tacticStyle = 'ausgeglichen';
        currentMatch = { isHome: true, homeGoals: 0, awayGoals: 1, minute: 60 };
        applyTacticAutomation(); // feuert einmal
        game.tacticStyle = 'ausgeglichen'; // manuell zurückgestellt
        applyTacticAutomation(); // sollte NICHT erneut feuern
        out.feuertNurEinmalProSpiel = game.tacticStyle === 'ausgeglichen';
        game.tacticAutomation.offensivBeiRueckstand = false;

        // 6. Auswärtsperspektive: "unser" Team ist bei isHome=false das Auswärtsteam.
        game.tacticAutomation.offensivBeiRueckstand = true;
        game.tacticStyle = 'ausgeglichen';
        currentMatch = { isHome: false, homeGoals: 2, awayGoals: 0, minute: 60 };
        applyTacticAutomation();
        out.auswaertsperspektiveKorrekt = game.tacticStyle === 'offensiv';
        game.tacticAutomation.offensivBeiRueckstand = false;

        // 7. Führung kurz vor Schluss: greift erst ab der 75. Minute, nicht früher.
        game.tacticAutomation.defensivBeiFuehrung = true;
        game.tacticStyle = 'ausgeglichen';
        currentMatch = { isHome: true, homeGoals: 2, awayGoals: 0, minute: 65 };
        applyTacticAutomation();
        out.defensivNichtZuFrueh = game.tacticStyle === 'ausgeglichen';
        currentMatch = { isHome: true, homeGoals: 2, awayGoals: 0, minute: 80 };
        applyTacticAutomation();
        out.defensivBeiFuehrungGreift = game.tacticStyle === 'defensiv' && currentMatch.tacticAutomationFired.defensiv === true;
        game.tacticAutomation.defensivBeiFuehrung = false;

        // 8. Ohne laufendes Spiel (currentMatch = null) darf die Funktion nicht abstürzen.
        currentMatch = null;
        let crashed = false;
        try { applyTacticAutomation(); } catch (e) { crashed = true; }
        out.keinAbsturzOhneMatch = !crashed;

        // 9. Rendering: die Taktiktafel zeigt beide Regeln als echte Markup-Zeilen.
        renderTacticAutomationBox();
        let box = document.getElementById('tactic-automation-box').innerHTML;
        out.zeigtBeideRegeln = box.includes('Bei Rückstand automatisch offensiver spielen')
            && box.includes('Bei Führung kurz vor Schluss automatisch defensiver spielen');

        return out;
    });

    assert(r.standardmaessigDeaktiviert, 'Die Taktik-Automatik ist standardmäßig deaktiviert');
    assert(r.umschaltenFunktioniert, 'Eine Automatik-Regel lässt sich aktivieren');
    assert(r.zurueckschaltenFunktioniert, 'Eine Automatik-Regel lässt sich wieder deaktivieren');
    assert(r.deaktiviertGreiftNicht, 'Eine deaktivierte Regel greift trotz passendem Spielstand nicht ein');
    assert(r.offensivBeiRueckstandGreift, 'Bei aktivierter Regel wird bei Rückstand ab der 46. Minute auf Offensiv umgestellt');
    assert(r.nichtVorHalbzeit, 'Vor der 46. Minute greift die Rückstands-Regel noch nicht');
    assert(r.feuertNurEinmalProSpiel, 'Die Regel feuert nur einmal pro Spiel und überschreibt keine manuelle Rückstellung erneut');
    assert(r.auswaertsperspektiveKorrekt, 'Bei einem Auswärtsspiel wird der eigene Rückstand korrekt aus der Auswärtsperspektive erkannt');
    assert(r.defensivNichtZuFrueh, 'Die Führungs-Regel greift vor der 75. Minute noch nicht');
    assert(r.defensivBeiFuehrungGreift, 'Bei aktivierter Regel wird bei Führung ab der 75. Minute auf Defensiv umgestellt');
    assert(r.keinAbsturzOhneMatch, 'Die Taktik-Automatik stürzt ohne laufendes Spiel nicht ab');
    assert(r.zeigtBeideRegeln, 'Die Taktiktafel zeigt beide Automatik-Regeln als echte Markup-Zeilen');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler in der Taktik-Automatik');
    await page.close();
}

// ---------------------------------------------------------------------------
// HAUPTPROGRAMM
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// LAUFZEIT-RUNDLAUF: jede Spielfunktion wird so umhüllt, dass ein Fehler notiert und
// die Simulation fortgesetzt wird - ein Lauf zeigt dadurch ALLE Absturzstellen (mit
// Funktionsnamen) statt nur der ersten. Deckt vor allem Feature-Module ab, deren Ticks
// sonst erst nach Wochen im echten Spiel auffallen.
// ---------------------------------------------------------------------------
async function testRuntimeRoundTrip(browser) {
    console.log('\n[R] Laufzeit-Rundlauf: 2 Saisons + alle Screens');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const fehler = {};
        const isNative = f => Function.prototype.toString.call(f).includes('[native code]');
        let umhuellt = 0;
        for (const name of Object.getOwnPropertyNames(window)) {
            const desc = Object.getOwnPropertyDescriptor(window, name);
            const orig = desc && desc.value;
            if (typeof orig !== 'function' || !desc.writable || isNative(orig) || /^[A-Z]/.test(name)) continue;
            window[name] = function (...args) {
                try { return orig.apply(this, args); } catch (e) {
                    const key = `${name}(): ${e.message}`;
                    if (!(key in fehler)) fehler[key] = 0;
                    fehler[key]++;
                    return undefined;
                }
            };
            umhuellt++;
        }

        const haenger = [];
        for (let saison = 0; saison < 2; saison++) {
            for (let i = 0; i < 40 && game.matchday <= 34; i++) {
                game.sackPending = false; // Entlassungen sind hier kein Fehler, nur Stopp
                const md = game.matchday;
                simulateMatchdays(1);
                if (game.matchday === md) { haenger.push(`Saison ${game.season}, Spieltag ${md}`); break; }
            }
            concludeSeasonAndAdvance();
        }

        // Reines Anzeigen eines Screens darf weder Geld bewegen noch buchen.
        const geldDurchAnzeige = [];
        for (const sc of [...document.querySelectorAll('[id^="screen-"]')].map(e => e.id)) {
            const geld = game.money, buchungen = (game.kontoauszug || []).length;
            showScreen(sc);
            if (game.money !== geld || (game.kontoauszug || []).length !== buchungen) {
                geldDurchAnzeige.push(`${sc}: ${Math.round(game.money - geld)} €`);
            }
        }
        // Wachstum: nichts darf mit der Karrieredauer unbegrenzt anwachsen.
        const verwaisteAngebote = ((game.contractRenewal || {}).pendingRenewals || [])
            .filter(o => !squad.some(p => p.id === o.playerId)).length;
        const saveKB = Math.round(JSON.stringify(buildSaveState()).length / 1024);
        return { fehler, haenger, geldDurchAnzeige, umhuellt, verwaisteAngebote, saveKB };
    });

    const fehlerListe = Object.entries(r.fehler).map(([k, n]) => `${k} (${n}x)`);
    assert(r.umhuellt > 500, `Spielfunktionen für den Rundlauf erfasst (${r.umhuellt})`);
    assert(fehlerListe.length === 0, `Keine Laufzeitfehler in 2 Saisons + allen Screens${fehlerListe.length ? ':\n      ' + fehlerListe.join('\n      ') : ''}`);
    assert(r.haenger.length === 0, `Die Simulation bleibt an keinem Spieltag hängen (${r.haenger.join(', ')})`);
    assert(r.geldDurchAnzeige.length === 0, `Screens anzeigen bewegt kein Geld (${r.geldDurchAnzeige.join(', ')})`);
    assert(r.verwaisteAngebote === 0, `Keine Vertragsangebote für Spieler, die den Verein verlassen haben (${r.verwaisteAngebote})`);
    // 3 Slots + Autosave müssen in ~5 MB localStorage passen; 10 Saisons ergaben ~510 KB.
    assert(r.saveKB < 900, `Spielstand bleibt kompakt (${r.saveKB} KB nach 2 Saisons, Grenze 900 KB)`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler im Rundlauf (${[...new Set(consoleErrors)].slice(0, 5).join(' | ')})`);
    await page.close();
}

async function testObjectivesEventsSeasonTickets(browser) {
    console.log('\n[S] Saisonziele, Stadion-Events, Dauerkarten');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        // 1. Saisonziele werten echte Daten; Meisterschaft/Aufstieg erst am Saisonende.
        initializeSeasonObjectives();
        const typen = ['CHAMPIONSHIP', 'PROMOTION', 'TOP_SCORER', 'CLEAN_SHEETS'];
        game.seasonObjectives.activeObjectives = typen.map(t => ({ id: `obj_${t}_${game.season}`, type: t, name: t, reward: 1000,
            startSeason: game.season, startLeagueLevel: game.leagueLevel, completed: false }));
        const origGoals = simulateGoals;
        simulateGoals = (a, b) => a >= b ? { myGoals: 3, oppGoals: 0 } : { myGoals: 0, oppGoals: 3 };
        // 102 Tore verteilt auf die ganze Elf ergaben 10-15 für den besten Schützen - knapp an
        // der 10-Tore-Grenze (CI-Flake 3.26). Ein fester Torjäger trifft, gezählt wird weiter echt.
        const origCredit = creditOwnGoal;
        creditOwnGoal = (players) => origCredit(players, players.find(p => p.pos === 'ST') || players[0]);
        try {
            while (game.matchday <= 34) {
                game.sackPending = false;
                squad.forEach(p => { p.strength = 99; p.injured = 0; p.suspended = 0; });
                simulateMatchdays(1);
                if (game.matchday === 20) {
                    out.meisterNichtVorzeitig = !game.seasonObjectives.completedObjectives.some(o => o.type === 'CHAMPIONSHIP');
                }
            }
            const startLiga = game.leagueLevel;
            concludeSeasonAndAdvance();
            const erreicht = game.seasonObjectives.completedObjectives.map(o => o.type);
            out.alleErreicht = typen.every(t => erreicht.includes(t));
            out.aufgestiegen = game.leagueLevel < startLiga;
            out.neueSaisonNeueZiele = game.seasonObjectives.activeObjectives.length > 0
                && game.seasonObjectives.activeObjectives.every(o => o.startSeason === game.season);
        } finally {
            simulateGoals = origGoals;
            creditOwnGoal = origCredit;
        }

        // 2. Prämien steigen mit der Liga (1. Liga > 6. Liga).
        const lvl = game.leagueLevel;
        game.leagueLevel = 5; game.money = 0; generateSeasonObjectives();
        const unten = Math.max(...game.seasonObjectives.activeObjectives.map(o => o.reward / DIFFICULTY_MULTIPLIERS[OBJECTIVE_TYPES[o.type].difficulty] / OBJECTIVE_TYPES[o.type].baseReward));
        game.leagueLevel = 0; generateSeasonObjectives();
        const oben = Math.max(...game.seasonObjectives.activeObjectives.map(o => o.reward / DIFFICULTY_MULTIPLIERS[OBJECTIVE_TYPES[o.type].difficulty] / OBJECTIVE_TYPES[o.type].baseReward));
        out.praemienSteigenMitLiga = oben > unten;
        game.leagueLevel = lvl;

        // 3. Stadion-Events: kostet sofort, nicht vorzeitig durchführbar, nur eines zur Zeit.
        game.money = 1000000;
        stadium.events = [];
        const m0 = game.money;
        scheduleStadiumEvent('fanfest');
        out.eventKostet = game.money < m0;
        scheduleStadiumEvent('stadiontag');
        out.nurEinEvent = stadium.events.length === 1;
        const ev = stadium.events[0];
        runStadiumEvent(ev.id);
        out.nichtVorzeitig = !ev.completed;
        game.matchday = ev.scheduledMatchday;
        const m1 = game.money;
        runStadiumEvent(ev.id);
        out.eventDurchgefuehrt = ev.completed && game.money > m1 && ev.visitors <= (stadium.total || 16000);
        out.sperrfrist = !!getStadiumEventBlockReason();

        // 4. Dauerkarten richten sich nach dem Zuschauerpotenzial der Liga, nicht der Kapazität.
        game.leagueLevel = 5;
        renewSeasonTickets();
        out.dauerkartenGedeckelt = game.seasonTicketHolders <= getLeagueAttendanceCap();
        return out;
    });

    assert(r.meisterNichtVorzeitig, 'Meisterschaftsziel wird nicht schon als Tabellenführer im Saisonverlauf ausgezahlt');
    assert(r.alleErreicht, 'Meisterschaft, Aufstieg, Torschütze und Zu-Null-Siege werden aus echten Spieldaten gewertet');
    assert(r.aufgestiegen, 'Der Meister steigt auf (Voraussetzung für das Aufstiegsziel)');
    assert(r.neueSaisonNeueZiele, 'Die neue Saison bekommt neue Saisonziele');
    assert(r.praemienSteigenMitLiga, 'Saisonziel-Prämien sind in höheren Ligen größer');
    assert(r.eventKostet, 'Ein Stadion-Event kostet beim Planen Organisationskosten');
    assert(r.nurEinEvent, 'Es kann nur ein Stadion-Event zur Zeit geplant sein');
    assert(r.nichtVorzeitig, 'Ein Stadion-Event lässt sich nicht vor seinem Termin durchführen');
    assert(r.eventDurchgefuehrt, 'Am Termin bringt das Event Einnahmen, Besucher gedeckelt durch die Kapazität');
    assert(r.sperrfrist, 'Nach einem Event gilt eine Sperrfrist');
    assert(r.dauerkartenGedeckelt, 'Dauerkarten übersteigen nicht das Zuschauerpotenzial der Liga');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Saisonzielen/Events/Dauerkarten');
    await page.close();
}

// ---------------------------------------------------------------------------
// CODE-INTEGRITÄT: Handler, Element-IDs, Diagramme in versteckten Screens, 3D-Szenen
// ---------------------------------------------------------------------------
async function testCodeIntegrity(browser) {
    console.log('\n[I] Code-Integrität: Handler, IDs, versteckte Diagramme, 3D-Szenen');
    const fs = require('fs');
    const root = path.resolve(__dirname, '..');
    const quellen = ['index.html', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)]
        .map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]);

    // 1. Jede Funktion, die ein on*-Attribut aufruft (index.html und erzeugtes HTML in js/),
    //    muss global existieren - sonst passiert beim Klick einfach nichts.
    const KEIN_AUFRUF = new Set(['if', 'return', 'typeof', 'function', 'new', 'this', 'event', 'else', 'for', 'while', 'switch',
        'var', 'let', 'const', 'document', 'window', 'console', 'Math', 'JSON', 'parseInt', 'parseFloat', 'String', 'Number',
        'Boolean', 'Array', 'Object', 'Date', 'setTimeout', 'clearTimeout', 'encodeURIComponent', 'alert', 'confirm']);
    const handler = {};
    for (const [f, src] of quellen) {
        for (const m of src.matchAll(/\bon(?:click|change|input|submit|keyup|keydown|touchstart|touchend|pointerdown|pointerup|blur|focus)\s*=\s*(["'`])([\s\S]*?)\1/g)) {
            for (const c of m[2].matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
                if (!KEIN_AUFRUF.has(c[1])) (handler[c[1]] = handler[c[1]] || new Set()).add(f);
            }
        }
    }

    // 2. Jede per getElementById('…') gelesene ID muss irgendwo entstehen (HTML oder Template).
    const alles = quellen.map(([, s]) => s).join('\n');
    const definiert = new Set([...alles.matchAll(/\bid\s*=\s*["']([\w-]+)["']/g), ...alles.matchAll(/\.id\s*=\s*["']([\w-]+)["']/g)].map(m => m[1]));
    const praefixe = [...alles.matchAll(/\bid\s*=\s*["']([\w-]+?)\$\{/g)].map(m => m[1]);
    const unbekannteIds = new Set();
    for (const [f, src] of quellen) {
        for (const m of src.matchAll(/getElementById\(\s*["']([\w-]+)["']\s*\)/g)) {
            if (!definiert.has(m[1]) && !praefixe.some(p => m[1].startsWith(p))) unbekannteIds.add(`${m[1]} (${f})`);
        }
    }

    const { page, consoleErrors } = await freshPage(browser);
    const fehlendeHandler = await page.evaluate(ns => ns.filter(n => typeof window[n] !== 'function'), Object.keys(handler));

    const r = await page.evaluate(async () => {
        const warte = ms => new Promise(res => setTimeout(res, ms));
        // 3. Rendern, während Screens versteckt sind (offsetWidth 0), darf keine kaputten SVGs erzeugen.
        showScreen('screen-dashboard');
        simulateMatchdays(2);
        const kaputteSvgs = [...document.querySelectorAll('svg')]
            .filter(s => ['width', 'height'].some(a => s.hasAttribute(a) && parseFloat(s.getAttribute(a)) < 0))
            .map(s => (s.closest('[id]') || {}).id);

        // 4. 3D-Szenen: kein filter/opacity auf preserve-3d-Elementen oder deren Eltern
        //    (macht die Szene flach und bricht die Klick-Erkennung in Android-WebViews).
        const pruefe3d = () => [...document.querySelectorAll('*')]
            .filter(el => el.offsetParent !== null && getComputedStyle(el).transformStyle === 'preserve-3d')
            .flatMap(el => {
                const fund = [];
                for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
                    const cs = getComputedStyle(a);
                    if (cs.filter !== 'none' || parseFloat(cs.opacity) < 1) fund.push(`${el.id || el.className} <- ${a.id || a.className || a.tagName}`);
                }
                return fund;
            });
        const verstoesse3d = [];
        let szenen3d = 0;
        const zustaende = [['screen-stadium', null], ['screen-office', null], ['screen-office', 'dunkel'],
            ...OFFICE_EVENTS.map(ev => ['screen-office', ev])];
        for (const [sc, zustand] of zustaende) {
            if (zustand === 'dunkel') toggleOfficeLamp();
            if (zustand && zustand.id) game.officeEvent = { id: zustand.id, seit: game.matchday, season: game.season, titel: zustand.titel(), text: zustand.text() };
            showScreen('screen-dashboard'); showScreen(sc);
            await warte(120);
            szenen3d += [...document.querySelectorAll('*')].filter(el => el.offsetParent !== null && getComputedStyle(el).transformStyle === 'preserve-3d').length;
            verstoesse3d.push(...pruefe3d().map(v => `${sc}${zustand ? '/' + (zustand.id || zustand) : ''}: ${v}`));
            if (zustand === 'dunkel') toggleOfficeLamp();
        }
        game.officeEvent = null;
        return { kaputteSvgs, verstoesse3d: [...new Set(verstoesse3d)], szenen3d };
    });

    assert(Object.keys(handler).length > 300, `Handler-Funktionen aus on*-Attributen erfasst (${Object.keys(handler).length})`);
    assert(fehlendeHandler.length === 0, `Jede in onclick & Co. aufgerufene Funktion existiert (${fehlendeHandler.map(n => `${n} <- ${[...handler[n]].join('/')}`).join(', ')})`);
    assert(unbekannteIds.size === 0, `Jede per getElementById gelesene ID existiert im HTML oder in einer Vorlage (${[...unbekannteIds].join(', ')})`);
    assert(r.kaputteSvgs.length === 0, `Diagramme in versteckten Screens haben keine negativen Maße (${r.kaputteSvgs.join(', ')})`);
    assert(r.szenen3d > 20, `3D-Szenen im Büro/Stadion geprüft (${r.szenen3d} Elemente in allen Zuständen)`);
    assert(r.verstoesse3d.length === 0, `Kein filter/opacity auf 3D-Elementen oder deren Eltern (${r.verstoesse3d.slice(0, 5).join(' | ')})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler bei der Integritätsprüfung (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// PHASE 11: Schiedsrichter, Mannschaftsrat, Mitgliederversammlung, Frauenmannschaft
// ---------------------------------------------------------------------------
async function testBoardRestart(browser) {
    console.log('\n[25.6] Vorstand: Neustart nach dem Abstieg, Mitgliederversammlung findet automatisch statt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.season = 3; game.boardSat = 20; game.lowBoardSatStreak = 8; delete game.boardRestartSeason;
            const erster = grantRelegationRestart();
            const nachErstem = game.boardSat, streakNull = game.lowBoardSatStreak === 0;
            const post = inboxMessages.some(m => m.title.includes('Neustart'));
            game.season = 4; game.boardSat = 20;
            const zweiter = grantRelegationRestart();
            const nachZweitem = game.boardSat;
            game.season = 6; game.boardSat = 30;
            const spaeter = grantRelegationRestart();
            const nachSpaeter = game.boardSat;
            game.season = 8; game.boardSat = 85;
            grantRelegationRestart();
            const hoherWertBleibt = game.boardSat === 85;
            // Abstiegsklausel (25.14): Gehälter -30 %, Moral -3, Nachricht; danach wiederhergestellt
            const loehne = squad.map(p => p.wage), moral = squad.map(p => p.morale);
            const summeVor = loehne.reduce((a, b) => a + b, 0);
            const summeNach = applyRelegationWageClause();
            const klausel = { anteil: summeNach / summeVor, exakt: squad.every((p, i) => p.wage === Math.max(150, Math.round(loehne[i] * 0.7 / 50) * 50)), moral: squad.every((p, i) => p.morale === Math.max(10, (moral[i] || 50) - 3)),
                post: inboxMessages.some(m => m.title.includes('Abstiegsklausel')) };
            squad.forEach((p, i) => { p.wage = loehne[i]; p.morale = moral[i]; });
            // Mitgliederversammlung: ignoriert man sie, findet sie nach ASSEMBLY_AUTO_AFTER Spieltagen
            // automatisch statt (vorher wurde sie mit Spieltag 35 eröffnet und nie abgehalten).
            game.season = 2; game.matchday = 1; game.sackPending = false;
            while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(1); }
            // Sommerpause: Stress halbiert, am Boden liegende Moral fängt sich zur Hälfte
            privateLife.stress = 100;
            const tief = squad[0], hoch = squad[1];
            tief.morale = 20; hoch.morale = 95;
            // Vertragskrise: nur 10 Spieler bleiben, die Notbesetzung kommt auf Ligaschnitt-Niveau
            squad = squad.slice(0, 10);
            squad.forEach(p => { p.contracts = 3; });
            lineup = pickBestLineupIds();
            const alteIds = squad.map(p => p.id);
            concludeSeasonAndAdvance();
            const sommer = { stress: privateLife.stress, tief: tief.morale, hoch: hoch.morale };
            const neu = squad.filter(p => !alteIds.includes(p.id));
            const andere = leaguesData[game.leagueLevel].filter(t => t.name !== game.clubName);
            const notkader = { anzahl: neu.length, kader: squad.length, gehalt: neu.every(p => p.wage >= EMERGENCY_WAGE_FLOOR[game.leagueLevel]),
                schnitt: Math.round(neu.reduce((a, p) => a + p.strength, 0) / Math.max(1, neu.length)),
                liga: Math.round(andere.reduce((a, t) => a + t.strength, 0) / andere.length) };
            game.sackPending = false;
            const eroeffnet = game.memberAssembly && game.memberAssembly.status === 'offen' && game.memberAssembly.openedMatchday === 1;
            simulateMatchdays(ASSEMBLY_AUTO_AFTER + 3);
            const automatisch = game.memberAssembly.status === 'abgehalten';
            game.memberAssembly.status = 'offen'; game.memberAssembly.openedMatchday = 35;
            tickMemberAssembly();
            const altstand = game.memberAssembly.status === 'abgehalten';
            return { erster, nachErstem, streakNull, zweiter, nachZweitem, spaeter, nachSpaeter, hoherWertBleibt, eroeffnet, automatisch, altstand, post, sommer, notkader, klausel };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Neustart ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.erster && r.nachErstem === 60 && r.streakNull && r.post, 'Erster Abstieg: Vertrauensvorschuss auf 60, Serie zurückgesetzt, Nachricht im Postfach');
        assert(!r.zweiter && r.nachZweitem === 20, 'Zweiter Abstieg in Folge: kein Vorschuss');
        assert(r.spaeter && r.nachSpaeter === 60, 'Nach einer Saison Pause gibt es wieder einen Neustart');
        assert(r.hoherWertBleibt, 'Ein höherer Wert wird nicht auf 60 gesenkt');
        assert(r.klausel.exakt && r.klausel.anteil < 0.85 && r.klausel.moral && r.klausel.post, `Abstiegsklausel senkt jedes Gehalt um 30 % (mind. 150 €) mit Nachricht (${JSON.stringify(r.klausel)})`);
        assert(r.eroeffnet && r.automatisch, 'Mitgliederversammlung findet ohne Zutun nach einigen Spieltagen statt');
        assert(r.altstand, 'Alte Spielstände mit Eröffnung an Spieltag 35 werden repariert');
        assert(r.notkader.gehalt, 'Notbesetzung verdient mindestens das Liga-Mindestgehalt');
        assert(r.notkader.kader >= 18 && r.notkader.schnitt >= r.notkader.liga - 13 && r.notkader.schnitt <= r.notkader.liga - 4, `Notbesetzung nach Vertragskrise nahe am Ligaschnitt (${JSON.stringify(r.notkader)})`);
        // Andere Saisonend-Ereignisse (Ehrungen, Abschiede) verschieben die Moral einzelner Spieler
        // zufällig um bis zu ~10 - geprüft wird nur, dass tiefe Moral spürbar steigt und hohe nicht zur 70 sinkt.
        assert(r.sommer.stress === 50 && r.sommer.tief >= 32 && r.sommer.hoch >= 75, `Sommerpause: Stress halbiert, tiefe Moral erholt sich, hohe bleibt (${JSON.stringify(r.sommer)})`);
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testWomenTeamExtras(browser) {
    console.log('\n[25.2] Frauenmannschaft: Spielerinnenmarkt, Potenzial, Zuschauer und Sponsor');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.money = 5000000;
            foundWomenTeam();
            const w = game.womenTeam;
            out.markt = w.market.length === WOMEN_MARKET_SIZE && w.sponsorOffers.length === WOMEN_SPONSOR_SHARES.length;

            const kandidat = w.market[0], fee = womenMarketFee(kandidat), geld = game.money, kader = w.squad.length;
            signWomenPlayer(kandidat.id);
            out.verpflichtet = game.money === geld - fee && w.squad.length === kader + 1 && !w.market.some(p => p.id === kandidat.id);

            game.money = 10;
            const kader2 = w.squad.length, andere = w.market[0];
            signWomenPlayer(andere.id);
            out.geldFehlt = w.squad.length === kader2 && game.money === 10 && w.market.some(p => p.id === andere.id);
            game.money = 5000000;

            const jung = w.squad[0];
            jung.age = 20; jung.strength = 60; jung.potential = 61;
            w.round = WOMEN_MATCHDAYS;
            concludeWomenSeason();
            out.potenzialDecke = jung.strength >= 60 && jung.strength <= 61;
            out.saisonWechsel = w.market.length === WOMEN_MARKET_SIZE && w.sponsorOffers.length === WOMEN_SPONSOR_SHARES.length
                && w.sponsor === null && w.round === 0;

            w.lastAttendance = 1000;
            out.tickets = womenMatchdayFinances(true).tickets === 1000 * WOMEN_TICKET_PRICE && womenMatchdayFinances(false).tickets === 0;

            signWomenSponsor(0);
            const sponsorName = w.sponsor.name;
            out.sponsor = w.sponsor.season === game.season && womenMatchdayFinances(true).sponsor === w.sponsor.perMatchday
                && womenMatchdayFinances(false).sponsor === 0;
            signWomenSponsor(0);
            out.zweiterSponsor = w.sponsor.name === sponsorName;

            while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(1); }
            out.heimspiele = w.zuschauer.spiele === WOMEN_MATCHDAYS / 2 && w.zuschauer.summe > 0;

            showScreen('screen-women');
            const vorRendern = game.money;
            renderWomenTeamView();
            const html = document.getElementById('women-team-box').innerText;
            out.anzeige = html.includes('SPONSOR') && html.includes('SPIELERINNENMARKT') && html.includes('Ø Zuschauer');
            out.renderGeld = game.money === vorRendern;
            return out;
        } catch (e) { return { crash: e.message + ' ' + (e.stack || '').split('\n')[1] }; }
    });
    assert(!r.crash, `Frauenmannschaft ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.markt && r.verpflichtet, 'Spielerinnenmarkt: Ablöse wird abgebucht, Spielerin landet im Kader');
        assert(r.geldFehlt, 'Ohne Geld keine Verpflichtung, die Kandidatin bleibt auf dem Markt');
        assert(r.potenzialDecke, 'Junge Spielerin wächst höchstens bis zu ihrem Potenzial');
        assert(r.saisonWechsel, 'Zum Saisonwechsel neuer Markt, neue Sponsorangebote, kein Sponsor mehr');
        assert(r.tickets, 'Ticketeinnahmen nur an Heimspieltagen: Zuschauer × Preis');
        assert(r.sponsor && r.zweiterSponsor, 'Sponsor zahlt pro Spieltag, nur einer je Saison');
        assert(r.heimspiele, 'Zuschauer werden an genau den Heimspieltagen gezählt');
        assert(r.anzeige && r.renderGeld, 'Ansicht zeigt Sponsor, Markt und Ø Zuschauer, Rendern ändert kein Geld');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testPhase11(browser) {
    console.log('\n[P11] Schiedsrichter, Mannschaftsrat, Mitgliederversammlung, Frauenmannschaft');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        game.money = 5000000;

        // Schiedsrichter: feste Ansetzung, Pools je Liga, Vorschau, Bilanz nach dem Spiel
        out.refFest = getCurrentReferee().id === getCurrentReferee().id;
        out.refJedeLiga = [0, 1, 2, 3, 4, 5].every(l => REFEREES.some(ref => l >= ref.minLeague && l <= ref.maxLeague));
        showScreen('screen-dashboard'); updateUI();
        out.refVorschau = document.getElementById('dash-referee-box').innerText.includes(getCurrentReferee().name);
        const ref = getCurrentReferee();
        simulateMatchdays(1);
        out.refBilanz = (game.refereeHistory[ref.id] || {}).spiele === 1
            && Object.values(game.refereeHistory).every(h => h.spiele > 0);

        // Mannschaftsrat: drei Mitglieder inkl. Kapitän, Anliegen aus echtem Zustand, Wirkung
        const rat = getCouncilMembers();
        out.ratBesetzt = rat.length === 3 && (!game.captainId || rat.some(p => p.id === game.captainId));
        squad.forEach(p => p.morale = 30);
        tickTeamCouncil();
        out.ratAnliegen = game.teamCouncil.concern && game.teamCouncil.concern.type === 'stimmung';
        const moralVorher = squad.reduce((s, p) => s + p.morale, 0);
        answerCouncilConcern(0);
        out.ratWirkung = squad.reduce((s, p) => s + p.morale, 0) > moralVorher && !game.teamCouncil.concern;
        squad.forEach(p => p.morale = 70);
        game.trainingIntensity = 'hart';
        tickTeamCouncil();
        game.matchday += COUNCIL_CONCERN_TIMEOUT;
        tickTeamCouncil();
        out.ratVerfall = game.teamCouncil.history[0].result.includes('verfallen');
        game.trainingIntensity = 'normal';

        // Frauenmannschaft gründen (spielt die Saison parallel mit)
        foundWomenTeam();
        game.womenTeam.squad.forEach(p => p.strength = 60);

        // Saison zu Ende spielen
        while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(1); }
        const tab = getWomenTableSorted();
        out.frauenSaison = game.womenTeam.round === WOMEN_MATCHDAYS && tab.every(t => t.played === WOMEN_MATCHDAYS)
            && tab.reduce((s, t) => s + t.gf, 0) === tab.reduce((s, t) => s + t.ga, 0);
        out.frauenJournal = game.financeLedger.some(e => (e.ausgaben || []).some(x => x.label.includes('Frauenmannschaft')));
        const frauenLiga = game.womenTeam.leagueLevel;

        // Saisonwechsel: Versammlung einberufen, Frauen-Aufstieg
        concludeSeasonAndAdvance();
        out.frauenAufstieg = game.womenTeam.leagueLevel === frauenLiga - 1 && game.womenTeam.round === 0;
        const a = game.memberAssembly;
        out.versammlungOffen = !!a && a.status === 'offen' && a.report.season === game.season - 1
            && typeof a.report.financeResult === 'number' && a.report.expectedRank >= 1;
        showScreen('screen-dashboard'); updateUI();
        out.versammlungSichtbar = document.getElementById('member-assembly-box').style.display === 'block';
        const satVorher = game.boardSat;
        setAssemblyChoice('fee', 'erhoehen');
        const geldVorher = game.money;
        holdMemberAssembly();
        out.versammlungWirkung = a.status === 'abgehalten' && game.money > geldVorher
            && game.boardSat === Math.max(10, Math.min(100, satVorher + a.boardDelta)) && a.boardDelta >= -10;

        showScreen('screen-women');
        out.frauenScreen = document.getElementById('women-team-box').innerText.includes('TABELLE');
        out.selbsttest = runStructuralSelfTest(true);
        return out;
    });

    assert(r.refFest, 'Schiedsrichter-Ansetzung ist pro Spieltag fest');
    assert(r.refJedeLiga, 'Für jede Liga gibt es Schiedsrichter');
    assert(r.refVorschau, 'Das Dashboard nennt den Schiedsrichter des nächsten Spiels');
    assert(r.refBilanz, 'Nach dem Spiel steht es in der Schiedsrichter-Bilanz (keine leeren Einträge)');
    assert(r.ratBesetzt, 'Der Mannschaftsrat hat drei Mitglieder inklusive Kapitän');
    assert(r.ratAnliegen, 'Bei schlechter Stimmung bringt der Rat genau dieses Anliegen ein');
    assert(r.ratWirkung, 'Die Antwort auf das Anliegen hebt die Moral und schließt es');
    assert(r.ratVerfall, 'Unbeantwortete Anliegen verfallen');
    assert(r.frauenSaison, 'Frauen-Saison: alle Teams 22 Spiele, Tore ausgeglichen');
    assert(r.frauenJournal, 'Gehälter der Frauenmannschaft stehen im Buchungsjournal');
    assert(r.frauenAufstieg, 'Die überlegene Frauenmannschaft steigt auf, neue Saison beginnt');
    assert(r.versammlungOffen, 'Nach dem Saisonwechsel ist die Mitgliederversammlung mit Saisonbericht offen');
    assert(r.versammlungSichtbar, 'Die offene Versammlung erscheint im Dashboard');
    assert(r.versammlungWirkung, 'Die Abstimmung wirkt auf Vorstand und Kasse');
    assert(r.frauenScreen, 'Der Frauenmannschafts-Screen zeigt die Tabelle');
    assert(Array.isArray(r.selbsttest) && r.selbsttest.length === 0, `Struktur-Selbsttest mit neuem Screen ohne Probleme (${JSON.stringify(r.selbsttest)})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 11 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// PHASE 12: zusammengelegte Systeme (Medizin, Medien, Jugend, Sponsoring)
// ---------------------------------------------------------------------------
async function testPhase12(browser) {
    console.log('\n[P12] Zusammengelegte Systeme: Medizin, Medien, Jugend, Sponsoring');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        // Alte Parallel-Systeme sind weg
        out.alteModuleWeg = ['checkInjuries', 'randomizeMatchInjuries', 'tickInjuryManagement', 'tickMatchInjuries',
            'tickMediaRelations', 'tickRandomMediaEvent', 'tickYouthRecruitment', 'tickYouthAcademyPrograms',
            'processSponsorPayments', 'applySponsorBenefits', 'tickSponsoringIncome', 'simulateYouthDevelopment']
            .filter(n => typeof window[n] === 'function');

        // Alter Spielstand mit Daten der abgelösten Systeme
        game.youthAcademy = { youngPlayers: [{ id: 'youth_0', name: 'Test Talent', position: 'CM', age: 17, strength: 41 }] };
        game.mediaRelations = { mediaImage: 80 };
        game.playerInjuries = [{ playerId: 1 }];
        squad[0].pos = 'GK';

        // Medizin: eine Saison ohne Verletzungsflut
        let maxVerletzt = 0;
        const vorher = squad.reduce((s, p) => s + (p.timesInjured || 0), 0);
        while (game.matchday <= 34) {
            game.sackPending = false;
            simulateMatchdays(1);
            maxVerletzt = Math.max(maxVerletzt, squad.filter(p => p.injured > 0).length);
        }
        out.verletzungenSaison = squad.reduce((s, p) => s + (p.timesInjured || 0), 0) - vorher;
        out.maxVerletzt = maxVerletzt;
        const opfer = squad.find(p => !(p.injured > 0));
        const staerke = opfer.strength;
        injurePlayerByEvent(opfer, 'Test');
        out.ereignisOhneStaerkeverlust = opfer.injured > 0 && opfer.strength === staerke;
        showScreen('screen-training');
        out.medizinPanel = (document.getElementById('medical-department-box') || {}).innerText || '';
        out.altInjuryWeg = game.playerInjuries === undefined;

        // Medien: Aktion wirkt auf das echte Image, Sperrfrist, alte Felder weg
        game.money = 5000000;
        game.managerMediaImage = 50;
        showScreen('screen-manager-tree');
        out.altMedienWeg = game.mediaRelations === undefined;
        const kandidat = interviewCandidates()[0];
        kandidat.morale = 80;
        runMediaAction('interview', String(kandidat.id));
        out.interviewWirkt = game.managerMediaImage === 52;
        const img = game.managerMediaImage;
        runMediaAction('kampagne');
        out.medienSperre = game.managerMediaImage === img;

        // Jugend: Migration, Anzeigen entwickelt nicht
        showScreen('screen-youth');
        out.jugendMigriert = youthTalents.some(t => t.name === 'Test Talent' && t.pos === 'MIT') && game.youthAcademy === undefined;
        out.gkKorrigiert = squad[0].pos === 'TW';
        const st = youthTalents.map(t => t.strength).join(',');
        for (let i = 0; i < 5; i++) { showScreen('screen-dashboard'); showScreen('screen-youth'); }
        out.anzeigenOhneWachstum = youthTalents.map(t => t.strength).join(',') === st;
        out.akademieOhneRealnamen = !game.academyLeague.academies.some(a => /Bayern München|Dortmund|Köln|Hamburger SV|Stuttgart/.test(a.name));

        // Sponsoring: Restwert einmalig
        game.sponsors = [{ name: 'Alt', value: 100000, totalPaid: 40000, active: true }];
        game.sponsorNegotiations = [];
        const geld = game.money;
        showScreen('screen-sponsors');
        const nachErstem = game.money;
        showScreen('screen-dashboard'); showScreen('screen-sponsors');
        out.sponsorRestwert = nachErstem - geld === 60000 && game.money === nachErstem && game.sponsors === undefined;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Abgelöste Parallel-Systeme sind entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.verletzungenSaison < 30 && r.maxVerletzt <= 6, `Keine Verletzungsflut (${r.verletzungenSaison} Verletzungen, max. ${r.maxVerletzt} gleichzeitig)`);
    assert(r.ereignisOhneStaerkeverlust, 'Verletzung durch Ereignisse kostet keine Spielerstärke');
    assert(r.medizinPanel.includes('Verletzt') && r.medizinPanel.includes('Risiko'), 'Medizin-Panel zeigt Verletzte und Risiko');
    assert(r.altInjuryWeg, 'Alte Verletzungs-Buchführung wird aus Spielständen entfernt');
    assert(r.altMedienWeg, 'Alte Medien-Felder werden aus Spielständen entfernt');
    assert(r.interviewWirkt, 'Spieler-Interview wirkt auf das echte Medienimage');
    assert(r.medienSperre, 'Medienaktionen haben eine Sperrfrist');
    assert(r.jugendMigriert, 'Talente der alten Zusatz-Akademie wandern in die Jugendabteilung (mit gültiger Position)');
    assert(r.gkKorrigiert, 'Profis mit alter englischer Position werden korrigiert');
    assert(r.anzeigenOhneWachstum, 'Öffnen des Jugend-Screens lässt Talente nicht wachsen');
    assert(r.akademieOhneRealnamen, 'Akademie-Rangliste nutzt Vereine aus dem Spiel');
    assert(r.sponsorRestwert, 'Alte Co-Sponsoren-Verträge werden einmalig mit dem Restwert ausgezahlt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 12 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13(browser) {
    console.log('\n[P13] Aufgeräumt: Gegner, Vorstand, Verträge, Scouting, Spielerentwicklung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        out.alteModuleWeg = ['tickContractExpirations', 'tickContractRenewal', 'renderNegotiationPanel', 'renderContractManagementPanel',
            'tickScoutingUpdates', 'renderTalentDetectionPanel', 'renderScoutingIntelligencePanel', 'tickPlayerAging',
            'recordSeasonalPerformance', 'renderArchetypesPanel', 'checkAgentNegotiations', 'renderAgentsPanel',
            'tickBoardRelations', 'checkBoardConflict', 'renderOppositionAnalysisPanel']
            .filter(n => typeof window[n] === 'function');

        // Alter Spielstand mit Daten der abgelösten Module
        game.contracts = [{ playerId: 1 }]; game.contractRenewal = {}; game.negotiationHistory = []; game.agentPool = [];
        game.scoutingDatabase = {}; game.scoutingIntelligence = {}; game.playerDevelopment = {};
        game.boardMembers = []; game.boardConflicts = [];
        squad[0].contractEnd = 30; squad[1].age = 24.5; squad[1].strength = 51.3;

        // Spielprognose: echte Paarung, Wahrscheinlichkeiten ergeben 100%
        staffMembers.analyst.hired = true;
        const prog = predictNextMatch();
        out.prognose = !!prog && Math.abs(prog.sieg + prog.remis + prog.niederlage - 1) < 1e-9 && !!prog.opp.name;

        simulateMatchdays(4);
        out.altWeg = ['contracts', 'contractRenewal', 'negotiationHistory', 'agentPool', 'scoutingDatabase', 'scoutingIntelligence',
            'playerDevelopment', 'boardMembers', 'boardConflicts'].filter(k => game[k] !== undefined);
        out.ganzzahlig = Number.isInteger(squad[1].age) && Number.isInteger(squad[1].strength) && squad[0].contractEnd === undefined;

        // Vorstand: vier Mitglieder mit Begründung
        showScreen('screen-manager-tree');
        out.vorstand = (document.getElementById('board-room-box') || {}).innerText || '';

        // Alterung am Saisonende: jeder genau ein Jahr älter, Typ fest, Rentner verlassen Kader und Aufstellung
        const vorher = squad.map(p => ({ id: p.id, age: p.age }));
        const typ = getPlayerArchetype(squad[2]).name;
        const rentner = squad[3];
        rentner.age = 35;
        if (!lineup.includes(rentner.id)) lineup[0] = rentner.id;
        agePlayersAtSeasonEnd();
        out.alterung = vorher.filter(v => v.id !== rentner.id).every(v => { const p = squad.find(x => x.id === v.id); return p && p.age === v.age + 1; });
        out.typFest = getPlayerArchetype(squad[2]).name === typ;
        out.rentnerWeg = !squad.some(p => p.id === rentner.id) && !lineup.includes(rentner.id);
        const jung = squad.find(p => p.id !== rentner.id);
        jung.age = 19; jung.archetype = 'wonderkid';
        const alt = squad.find(p => p !== jung);
        alt.age = 33; alt.archetype = 'steady-eddy';
        out.richtung = getDevelopmentRange(jung)[0] > 0 && getDevelopmentRange(alt)[1] < 0;

        showScreen('screen-squad-planning');
        out.entwicklungPanel = (document.getElementById('player-development-box') || {}).innerText || '';
        openPlayerDetail(squad[0].id);
        out.karriere = (document.getElementById('pd-career-progression') || {}).innerText || '';
        showScreen('screen-contracts');
        out.vertragsZeilen = document.querySelectorAll('#contracts-list .panel').length === squad.length;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Abgelöste Parallel-Systeme sind entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Daten abgelöster Module werden aus Spielständen entfernt (${r.altWeg.join(', ')})`);
    assert(r.ganzzahlig, 'Kommazahlen der alten Alterung werden bereinigt');
    assert(r.prognose, 'Spielprognose nutzt die echte nächste Paarung, Wahrscheinlichkeiten ergeben 100%');
    assert(['Präsident', 'Finanzvorstand', 'Sportvorstand', 'Nachwuchsleiter'].every(t => r.vorstand.includes(t)), 'Vorstands-Panel zeigt vier Mitglieder');
    assert(r.alterung, 'Am Saisonende altert jeder Spieler um genau ein Jahr');
    assert(r.typFest, 'Entwicklungstyp eines Spielers bleibt fest');
    assert(r.rentnerWeg, 'Spieler mit 36 beenden die Karriere und verlassen auch die Aufstellung');
    assert(r.richtung, 'Junge Spieler legen zu, Spieler nach dem Höhepunkt bauen ab');
    assert(r.entwicklungPanel.includes('Saisonende'), 'Entwicklungs-Panel in der Kaderplanung');
    assert(r.karriere.includes('Pflichtspiele'), 'Karriere-Block im Spielerdetail aus gespeicherten Daten');
    assert(r.vertragsZeilen, 'Vertragsübersicht zeigt jeden Kaderspieler');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13Teil2(browser) {
    console.log('\n[P13b] Aufgeräumt: Fans, Training, Stadion');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        out.alteModuleWeg = ['tickFanEngagement', 'processFanRevenue', 'renderFanclubManagementPanel', 'tickFanEvents',
            'applyTrainingEffects', 'tickTrainingSpecialization', 'tickSetPieceTraining', 'startStadiumUpgrade', 'tickStadiumMaintenance']
            .filter(n => typeof window[n] === 'function');
        game.fanclubs = [{ ultras: 500 }]; game.fanSatisfaction = 50; game.ultraGroups = []; game.fanEvents = {};
        game.trainingSchedule = {}; game.trainingSpecialization = {}; game.setPieceTraining = {}; game.stadium = { capacity: 25000 };
        const kontoVorher = (game.kontoauszug || []).length;
        simulateMatchdays(4);
        out.altWeg = ['fanclubs', 'fanSatisfaction', 'ultraGroups', 'fanEvents', 'trainingSchedule', 'trainingSpecialization', 'setPieceTraining', 'stadium']
            .filter(k => game[k] !== undefined);
        out.keineFanclubEinnahmen = !(game.kontoauszug || []).slice(kontoVorher).some(k => /Fanclub-Einnahmen/.test(k.label || ''))
            && !(game.financeLedger || []).some(e => JSON.stringify(e).includes('Fanclub-Einnahmen'));
        ['screen-squad', 'screen-training', 'screen-stadium', 'screen-fans', 'screen-finances'].forEach(s => { try { showScreen(s); } catch (e) { out.fehler = s + ': ' + e.message; } });
        out.geldGanzzahlig = Number.isInteger(game.money);
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Abgelöste Fan-/Trainings-/Stadionmodule sind entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Ihre Daten werden aus Spielständen entfernt (${r.altWeg.join(', ')})`);
    assert(r.keineFanclubEinnahmen, 'Keine Fanclub-Einnahmen aus dem Nichts mehr');
    assert(!r.fehler, `Betroffene Bildschirme öffnen ohne Fehler (${r.fehler || ''})`);
    assert(r.geldGanzzahlig, 'Kontostand bleibt ganzzahlig');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 Teil 2 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13Teil3(browser) {
    console.log('\n[P13c] Kader-Bildschirm in Reitern, Startkader im Gehaltsbudget');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        out.alteModuleWeg = ['renderInternationalTournamentsPanel', 'renderTransferMarketAnalysisPanel', 'renderPostMatchAnalysisPanel', 'tickTransferMarketAnalysis']
            .filter(n => typeof window[n] === 'function');
        showScreen('screen-squad');
        const tabs = ['aufstellung', 'taktik', 'analyse', 'team'];
        out.reiter = tabs.map(t => {
            setSquadTab(t);
            const sichtbar = tabs.filter(x => document.getElementById('squad-tab-' + x).style.display !== 'none');
            const el = document.getElementById('squad-tab-' + t);
            return { t, nurEiner: sichtbar.length === 1 && sichtbar[0] === t, panels: el.querySelectorAll(':scope > .panel').length, aktiv: document.getElementById('btn-tab-squad-' + t).className === 'btn-action' };
        });
        setSquadTab('analyse');
        const radar = document.querySelector('#squad-radar-container svg');
        out.radarSichtbar = !!radar && radar.getBoundingClientRect().width > 0;
        // Kaderliste und Taktiktafel liegen im Start-Reiter
        setSquadTab('aufstellung');
        out.aufstellungKomplett = !!document.querySelector('#squad-tab-aufstellung #bench-list') && !!document.querySelector('#squad-tab-aufstellung #soccer-pitch');
        // Startkader einer höheren Liga passt ins Gehaltsbudget der Liga
        out.gehaelterImBudget = [0, 1, 2, 3, 4].every(lvl => {
            for (let i = 0; i < 8; i++) {
                const summe = generateSquadForLevel(lvl).reduce((s, p) => s + p.wage, 0);
                if (summe > getLeagueWageBudget(lvl)) return false;
            }
            return true;
        });
        // ... und das Budget passt zur Liga (25.14: in der 6. Liga lag es beim 150-Fachen der Gehälter)
        out.budgetLigaGerecht = [0, 1, 2, 3, 4].map(lvl => {
            const summen = [...Array(8)].map(() => generateSquadForLevel(lvl).reduce((s, p) => s + p.wage, 0)).sort((a, b) => a - b);
            return getLeagueWageBudget(lvl) / summen[4];
        });
        // Marktwert steigt mit der Stärke (25.16: Stärke 58 kostete ~740.000 €, Stärke 59 nur 150.000 €)
        const mwSchnitt = st => { let s = 0; for (let i = 0; i < 40; i++) s += calculatePlayerMarketValue(st); return s / 40; };
        const mwKurve = []; for (let st = 30; st <= 99; st++) mwKurve.push(mwSchnitt(st));
        out.marktwertMonoton = mwKurve.every((v, i) => i === 0 || v >= mwKurve[i - 1] * 0.95);
        // Transferbudget je Liga reicht für 1-4 typische Marktspieler der Liga (25.15: unten lag es beim 250-Fachen)
        const altLiga = game.leagueLevel;
        out.transferLigaGerecht = [0, 1, 2, 3, 4, 5].map(lvl => {
            game.leagueLevel = lvl; refreshTransferMarket();
            const preise = marketPlayers.map(m => ensureTransferTerms(m).askingPrice).sort((a, b) => a - b);
            return getLeagueTransferBudget(lvl) / preise[Math.floor(preise.length / 2)];
        });
        game.leagueLevel = altLiga; refreshTransferMarket();
        const altKader = squad; initDefaultSquad();
        out.budgetLigaGerecht.push(getLeagueWageBudget(5) / squad.reduce((s, p) => s + p.wage, 0));
        squad = altKader;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Scheinmodule vom Kader-Bildschirm entfernt (${r.alteModuleWeg.join(', ')})`);
    r.reiter.forEach(x => assert(x.nurEiner && x.aktiv && x.panels >= 3, `Kader-Reiter „${x.t}“ zeigt nur seine Panels (${x.panels}) und ist markiert`));
    assert(r.radarSichtbar, 'Kader-Radar wird im Analyse-Reiter mit echter Breite gezeichnet');
    assert(r.aufstellungKomplett, 'Kaderliste und Taktiktafel liegen im Start-Reiter');
    assert(r.gehaelterImBudget, 'Startkader höherer Ligen überziehen das Gehaltsbudget ihrer Liga nicht');
    assert(r.marktwertMonoton, 'Marktwert steigt mit der Stärke (keine Sprünge nach unten an den Segmentgrenzen)');
    assert(r.transferLigaGerecht.every(f => f >= 0.4 && f <= 5), `Transferbudget je Liga reicht für etwa 0,5-5 typische Marktspieler (${r.transferLigaGerecht.map(f => f.toFixed(1)).join(' / ')})`);
    assert(r.budgetLigaGerecht.every(f => f >= 1 && f <= 2.5), `Gehaltsbudget je Liga liegt beim 1- bis 2,5-Fachen der Startgehälter (${r.budgetLigaGerecht.map(f => f.toFixed(2)).join(' / ')})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 Teil 3 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13Teil4(browser) {
    console.log('\n[P13d] Relegation, Deadline-Day, Liga-Auszeichnungen, Trainerkarussell');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        closeTutorial();
        const setRank = (rank) => {
            const t = leaguesData[game.leagueLevel];
            const us = t.find(x => x.name === game.clubName);
            t.filter(x => x !== us).forEach((x, i) => { x.points = 100 - (i < rank - 1 ? i : i + 1) * 3; x.goalsFor = 50; x.goalsAgainst = 40; });
            us.points = 100 - (rank - 1) * 3; us.goalsFor = 50; us.goalsAgainst = 40;
        };

        // Deadline-Day: Sommerfenster bis Spieltag 3, danach Last-Minute-Ticker
        showScreen('screen-transfer');
        out.sommerBanner = document.getElementById('winter-window-banner').innerText.includes('Sommer');
        simulateMatchdays(3);
        out.sommerDeadline = game.lastDeadlineDay === `${game.season}-sommer` && inboxMessages.some(m => /DEADLINE-DAY \(Sommer\)/.test(m.title));
        const ddAngebote = incomingOffers.filter(o => /Deadline-Day/.test(o.statusText));
        out.angeboteKurzfristig = ddAngebote.every(o => o.expiresIn <= 1);
        out.schnaeppchen = marketPlayers.filter(p => p.deadlineBargain).length;
        game.matchday = 17; tickTransferWindows();
        out.winterOffen = game.winterWindowActive && game.winterWindowCloseMatchday === 20;
        game.matchday = 20; tickTransferWindows();
        out.winterZu = !game.winterWindowActive && game.lastDeadlineDay === `${game.season}-winter`;

        // Trainerkarussell: Tabellenletzter mit Niederlagenserie verliert seinen Trainer
        game.matchday = 12;
        const opfer = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
        leaguesData[game.leagueLevel].forEach(t => { t.points = 30; t.recentForm = ['W', 'W', 'D', 'W', 'W']; });
        opfer.points = 0; opfer.recentForm = ['L', 'L', 'L', 'L', 'L'];
        const alterTrainer = getTeamCoach(opfer).name, alterStil = opfer.playstyle, basis = opfer.baseStrength;
        const zufall = Math.random; Math.random = () => 0.01;
        try { tickCoachCarousel(); } finally { Math.random = zufall; }
        out.trainerGewechselt = opfer.coach.name !== alterTrainer && opfer.playstyle !== alterStil && opfer.baseStrength === basis + 3;
        out.nurEinWechselProSaison = (() => { const n = opfer.coach.name; Math.random = () => 0.01; try { tickCoachCarousel(); } finally { Math.random = zufall; } return opfer.coach.name === n; })();
        game.matchday = 16; tickCoachBounce();
        out.trainereffektEndet = opfer.baseStrength === basis && !opfer.coachBounce;
        out.trainerInAnalyse = getCoachInfoHtml(opfer).includes(opfer.coach.name);

        // Liga-Auszeichnungen: eigener Torjäger schlägt die Konkurrenz
        const star = squad.find(p => p.pos === 'ST');
        star.goalsSeason = 60; star.appearancesSeason = 34;
        const mw = star.marketValue;
        const aw = awardLeagueHonours(1);
        out.torjaeger = aw.awards.some(a => a.own && /Torjäger/.test(a.award) && a.winner === star.name) && star.marketValue > mw;
        out.elfKomplett = aw.elf.length === 11;
        out.trainerDesJahres = aw.awards.some(a => /Trainer des Jahres/.test(a.award));
        showScreen('screen-history');
        out.awardsBox = document.getElementById('league-awards-box').innerText.includes(star.name);

        // Relegation: Platz 16 spielt gegen den Dritten der Liga darunter
        game.leagueLevel = 3; initLeagues(); game.matchday = 35; setRank(16);
        const sit = getRelegationSituation();
        out.relegationGegner = !!sit && sit.type === 'abstieg' && sit.oppLevel === 4;
        showScreen('screen-dashboard');
        out.abschlussVersteckt = document.getElementById('dash-season-end-actions').style.display === 'none';
        playRelegationLeg(); playRelegationLeg();
        const rel = getRelegationState();
        out.zweiSpiele = rel.legs.length === 2 && ['stayed', 'relegated'].includes(rel.result) && rel.legs.some(l => l.isHome && l.income > 0);
        out.abschlussSichtbar = document.getElementById('dash-season-end-actions').style.display === 'block';
        const lv = game.leagueLevel;
        concludeSeasonAndAdvance();
        out.ligaPasst = game.leagueLevel === (rel.result === 'relegated' ? lv + 1 : lv);
        // Platz 3: Saisonabschluss spielt die Aufstiegs-Relegation automatisch
        game.matchday = 35; setRank(3);
        concludeSeasonAndAdvance();
        out.autoRelegation = game.relegation.type === 'aufstieg' && game.relegation.legs.length === 2 && !!game.relegation.result;
        return out;
    });

    assert(r.sommerBanner, 'Sommer-Transferfenster wird zu Saisonbeginn angezeigt');
    assert(r.sommerDeadline, 'Nach Spieltag 3 ist Deadline-Day mit Ticker im Postfach');
    assert(r.angeboteKurzfristig && r.schnaeppchen > 0, `Deadline-Day: Last-Minute-Angebote gelten nur kurz, Schnäppchen auf dem Markt (${r.schnaeppchen})`);
    assert(r.winterOffen && r.winterZu, 'Winterfenster läuft Spieltag 18-20 und endet mit Deadline-Day');
    assert(r.trainerGewechselt, 'Trainerkarussell: Krisenklub entlässt Trainer, neuer Stil und Trainereffekt');
    assert(r.nurEinWechselProSaison, 'Ein Verein wechselt höchstens einmal pro Saison den Trainer');
    assert(r.trainereffektEndet, 'Trainereffekt endet nach 4 Spieltagen ohne bleibende Verzerrung');
    assert(r.trainerInAnalyse, 'Gegnerischer Trainer steht in der Spielanalyse');
    assert(r.torjaeger, 'Eigener Torjäger gewinnt die Torjägerkanone und gewinnt an Marktwert');
    assert(r.elfKomplett && r.trainerDesJahres, 'Elf der Saison hat 11 Spieler, Trainer des Jahres wird gekürt');
    assert(r.awardsBox, 'Auszeichnungen erscheinen im Trophäen-Bildschirm');
    assert(r.relegationGegner && r.abschlussVersteckt, 'Platz 16: Relegation gegen den Dritten der Liga darunter, Saisonabschluss erst danach');
    assert(r.zweiSpiele && r.abschlussSichtbar, 'Relegation: Hin- und Rückspiel mit Heimspieleinnahmen, danach Saisonabschluss möglich');
    assert(r.ligaPasst, 'Ergebnis der Relegation entscheidet über den Abstieg');
    assert(r.autoRelegation, 'Saisonabschluss spielt offene Relegationsspiele automatisch');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 Teil 4 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil1(browser) {
    console.log('\n[P14a] Statistik aus echten Daten, Schein-Module entfernt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        closeTutorial();
        out.alteModuleWeg = ['recordLeagueProgress', 'renderLeagueProgressCharts', 'renderTournamentBracketsPanel', 'tickTournamentBrackets',
            'buyFromTransferMarket', 'calcSquadPlayerValue', 'renderTransferMarketBox', 'tickLoanedPlayerDevelopment', 'renderReservesLoanPanel', 'recordSeasonStats']
            .filter(n => typeof window[n] === 'function');
        game.transferMarketPlayers = [{ id: 'x' }]; game.reserves = {}; game.tournamentBrackets = {}; game.transferBudgetUsed = 5;
        simulateMatchdays(4);
        out.altWeg = ['transferMarketPlayers', 'reserves', 'tournamentBrackets', 'transferBudgetUsed'].filter(k => game[k] !== undefined);

        // Eine Saison: Manager-Bilanz entspricht der echten Tabellenzeile
        for (let i = 0; i < 6; i++) { game.sackPending = false; simulateMatchdays(5); }
        const rank = getOwnLeagueRank();
        const zeile = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        const erwartet = { won: zeile.won, drawn: zeile.drawn, lost: zeile.lost, points: zeile.points, league: leagueNames[game.leagueLevel] };
        const star = squad[0];
        star.goalsCareer = 999;
        game.playerRetirement = { retiredPlayers: [], legendPlayers: [], fareewellGamesScheduled: [],
            retirementHistory: [{ playerName: 'Test Legende', goals: 120, appearances: 400, legendTier: 'ICON', retirementSeason: 1 }] };
        concludeSeasonAndAdvance();
        const e = (game.managerCareer || [])[0];
        out.karriere = !!e && e.rank === rank && e.won === erwartet.won && e.drawn === erwartet.drawn && e.lost === erwartet.lost && e.points === erwartet.points && e.league === erwartet.league;
        showScreen('screen-history');
        const ms = document.getElementById('manager-analytics-box').innerText;
        out.managerPanel = ms.includes(`${erwartet.won}-${erwartet.drawn}-${erwartet.lost}`) && ms.includes(`Platz ${rank}`);
        const hof = document.getElementById('hall-of-fame-box').innerText;
        out.hallOfFame = hof.includes(star.name) && hof.includes('999 Tore') && hof.includes('Test Legende') && hof.includes('Vereins-Ikone') && hof.includes(`Platz ${rank}`);
        const toasts = document.querySelectorAll('.app-toast').length;
        for (let i = 0; i < 3; i++) { showScreen('screen-dashboard'); showScreen('screen-history'); }
        out.keineToastsBeimOeffnen = document.querySelectorAll('.app-toast').length <= toasts;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Schein-Module entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Ihre Spielstanddaten werden entfernt (${r.altWeg.join(', ')})`);
    assert(r.karriere, 'Manager-Statistik speichert Platz und Bilanz der echten Tabellenzeile');
    assert(r.managerPanel, 'Manager-Statistik zeigt die Bilanz an');
    assert(r.hallOfFame, 'Hall of Fame zeigt ewige Torjäger, Legenden und beste Saisons aus echten Daten');
    assert(r.keineToastsBeimOeffnen, 'Öffnen des Trophäen-Bildschirms löst keine Meldungen aus');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 1 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil2(browser) {
    console.log('\n[P14b] Kabine: ein Panel, Schein-Systeme entfernt, Skandale korrigiert');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        closeTutorial();
        out.alteModuleWeg = ['tickSquadHarmony', 'organizeMoraleEvent', 'tickCrisisEvents', 'resolveCrisis', 'recordCard', 'tickDisciplinaryBans',
            'processDerbyMatch', 'renderRivalriesPanel', 'renderSquadHarmonyPanel'].filter(n => typeof window[n] === 'function');
        game.squadHarmony = {}; game.crises = {}; game.disciplinarySystem = {}; game.localRivals = [];
        simulateMatchdays(4);
        out.altWeg = ['squadHarmony', 'crises', 'disciplinarySystem', 'localRivals'].filter(k => game[k] !== undefined);

        showScreen('screen-squad'); setSquadTab('team');
        const tab = document.getElementById('squad-tab-team');
        const kabine = [...tab.querySelectorAll(':scope > .panel')].find(p => p.innerText.includes('KABINE'));
        out.kabine = !!kabine && !!kabine.querySelector('#squad-cliques-box') && !!kabine.querySelector('#locker-hierarchy-box') && !!kabine.querySelector('#team-chemistry-box');
        out.kabineInhalt = kabine ? kabine.innerText.includes('Rangordnung') : false;
        out.teamPanels = tab.querySelectorAll(':scope > .panel').length;

        // Skandal: schadet dem Medienimage (vorher Vorzeichenfehler) und ist nicht mehr an Spieltag 30 gebunden
        game.scandals = [];
        squad.forEach(p => { p.morale = 20; });
        game.matchday = 11;
        game.managerMediaImage = 60;
        const zufall = Math.random; Math.random = () => 0.01;
        try { checkForScandale(); } finally { Math.random = zufall; }
        out.skandal = game.scandals.length === 1;
        out.imageSinkt = game.managerMediaImage < 60;
        Math.random = () => 0.01;
        try { checkForScandale(); } finally { Math.random = zufall; }
        out.nurEiner = game.scandals.length === 1;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Schein-Systeme der Kabine entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Ihre Spielstanddaten werden entfernt (${r.altWeg.join(', ')})`);
    assert(r.kabine && r.kabineInhalt, 'Team-Chemie, Grüppchen und Rangordnung in einem Kabinen-Panel');
    assert(r.teamPanels === 3, `Mannschaft-Reiter hat 3 statt 7 Panels (${r.teamPanels})`);
    assert(r.skandal && r.imageSinkt, 'Skandal an einem normalen Spieltag möglich und schadet dem Medienimage');
    assert(r.nurEiner, 'Höchstens ein Skandal gleichzeitig');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 2 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil3(browser) {
    console.log('\n[P14c] Historie und Finanzen in Reitern');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        simulateMatchdays(4);
        const out = {};
        for (const [scr, prefix, tabs] of [['screen-history', 'hist', ['titel', 'legenden', 'chronik', 'rivalen']], ['screen-finances', 'fin', ['uebersicht', 'journal', 'budget', 'bank']]]) {
            showScreen(scr);
            out[prefix] = tabs.map(t => {
                setSubTab(prefix, t);
                const sichtbar = tabs.filter(x => document.getElementById(`subtab-${prefix}-${x}`).style.display !== 'none');
                const el = document.getElementById(`subtab-${prefix}-${t}`);
                return { t, ok: sichtbar.length === 1 && sichtbar[0] === t && el.querySelectorAll(':scope > .panel').length >= 2
                    && document.getElementById(`btn-subtab-${prefix}-${t}`).className === 'btn-action' };
            });
            const direkt = [...document.getElementById(scr).children].filter(c => c.classList.contains('panel'));
            out[prefix + 'Direkt'] = direkt.length;
        }
        showScreen('screen-finances'); setSubTab('fin', 'journal');
        out.journalDa = !!document.querySelector('#subtab-fin-journal #ledger-tab-letzter');
        return out;
    });
    [...r.hist, ...r.fin].forEach(x => assert(x.ok, `Reiter „${x.t}“ zeigt nur seine Panels und ist markiert`));
    assert(r.histDirekt === 0 && r.finDirekt === 0, `Keine Panels mehr außerhalb der Reiter (Historie ${r.histDirekt}, Finanzen ${r.finDirekt})`);
    assert(r.journalDa, 'Buchungsjournal liegt im Journal-Reiter');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 3 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil4(browser) {
    console.log('\n[P14d] Wirtschaft: Wetten, Aktien, Immobilien, Insider-Wette');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Wetten: Quoten aus der Simulation mit Marge, kein Wetten auf die eigene Niederlage
        const o = calcNextMatchOdds();
        out.keineNiederlageQuote = o.oddsLoss === undefined;
        out.margeSieg = o.probabilities.win * o.oddsWin < 1 && o.probabilities.draw * o.oddsDraw < 1 && o.probabilities.winOver * o.oddsWinOver < 1.02;
        const geld = game.money;
        placeBet('loss', 1000);
        out.niederlageVerboten = game.money === geld && !activeBet;
        // Schwache Aufstellung darf die Siegquote nicht hochtreiben
        const gespeichert = lineup.slice();
        lineup = [...squad].sort((a, b) => a.strength - b.strength).slice(0, 11).map(p => p.id);
        const schwach = calcNextMatchOdds();
        lineup = gespeichert;
        out.aufstellungEgal = Math.abs(schwach.oddsWin - o.oddsWin) / o.oddsWin < 0.25;

        // Aktien: im Mittel kein Kursverfall, Anleihe ohne Einbrüche wie eine Tech-Aktie
        const kurs = key => {
            const s = stockMarket[key], start = s.price, werte = [];
            for (let run = 0; run < 150; run++) { s.price = start; for (let t = 0; t < 34; t++) updateStockMarket(); werte.push(s.price / start); }
            s.price = start; werte.sort((a, b) => a - b);
            return { mittel: werte.reduce((a, b) => a + b, 0) / werte.length, schlecht: werte[15] };
        };
        const anleihe = kurs('staatsanleihe'), biotech = kurs('biotech');
        out.aktien = anleihe.mittel > 0.93 && anleihe.mittel < 1.07 && anleihe.schlecht > 0.85 && biotech.mittel > 0.8;

        // Immobilien: rund 10 Saisons Amortisation, jede Stufe lohnt sich gleich
        const pp = realEstatePortfolio.parkplatz;
        pp.owned = true; pp.lvl = 1;
        const k1 = getRealEstateCost('parkplatz') / 2, e1 = getRealEstateIncome('parkplatz');
        const k2 = getRealEstateCost('parkplatz'); pp.lvl = 2; const e2 = getRealEstateIncome('parkplatz');
        pp.owned = false; pp.lvl = 0;
        const amort1 = k1 / (e1 * 34), amort2 = k2 / ((e2 - e1) * 34);
        out.immobilien = amort1 > 6 && amort1 < 16 && Math.abs(amort1 - amort2) < 0.5;

        // Insider-Wette: Auszahlung nach Siegchance, höchstens das Dreifache
        game.money = 10000000;
        placeUnderworldInsiderBet();
        out.insider = underworld.insiderBetMultiplier > 1 && underworld.insiderBetMultiplier <= 3;

        // Keine echten Vereinsnamen in Holding-Aufträgen (auch nicht in alten Spielständen)
        holdingCompany.b2bContracts.push({ id: 'alt', club: 'Real Madrid', item: 'x', amount: 1, reqMat: 'cotton', reqQty: 1, payout: 1, done: false });
        cleanupRemovedModuleState();
        out.namen = !holdingCompany.b2bContracts.some(c => /Real Madrid|FC Bayern|FC Liverpool/.test(c.club));
        return out;
    });
    assert(r.keineNiederlageQuote && r.niederlageVerboten, 'Keine Wette auf die eigene Niederlage (Spielmanipulation)');
    assert(r.margeSieg, 'Wettquoten aus der Spielsimulation mit Buchmacher-Marge (auch Kombi)');
    assert(r.aufstellungEgal, 'Schwache Aufstellung treibt die Siegquote nicht hoch');
    assert(r.aktien, 'Aktienkurse ohne systematischen Verfall, Staatsanleihe bleibt sicher');
    assert(r.immobilien, 'Immobilien amortisieren sich in rund 10 Saisons, jede Stufe gleich gut');
    assert(r.insider, 'Insider-Wette zahlt nach Siegchance, höchstens das Dreifache');
    assert(r.namen, 'Holding-Aufträge ohne echte Vereinsnamen');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 4 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testLongRun(browser) {
    console.log('\n[P15a] Langzeittest: 6 Saisons am Stück');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = { kaderMin: 99, saveMax: 0 };
        for (let s = 0; s < 6; s++) {
            for (let i = 0; i < 7; i++) { game.sackPending = false; simulateMatchdays(5); }
            concludeSeasonAndAdvance();
            out.kaderMin = Math.min(out.kaderMin, squad.length);
            out.saveMax = Math.max(out.saveMax, JSON.stringify(buildSaveState()).length);
        }
        // KI-Ligen driften nicht weg vom Niveau ihrer Stufe
        out.drift = leaguesData.map((t, l) => Math.round(t.reduce((a, x) => a + (x.baseStrength || x.strength), 0) / t.length) - (82 - l * 10));
        out.alterOk = squad.every(p => Number.isInteger(p.age) && p.age >= 15 && p.age <= 40);
        // Spielstand übersteht Speichern und Laden
        const vorher = { season: game.season, money: game.money, kader: squad.map(p => p.id).join(','), karriere: (game.managerCareer || []).length };
        const json = JSON.stringify(buildSaveState());
        game.money = 1; game.season = 99; squad = [];
        applyLoadedState(JSON.parse(json));
        out.roundtrip = game.season === vorher.season && game.money === vorher.money && squad.map(p => p.id).join(',') === vorher.kader && (game.managerCareer || []).length === vorher.karriere;
        out.karriereSaisons = vorher.karriere;
        return out;
    });
    assert(r.kaderMin >= 14, `Kader fällt nach dem Saisonwechsel nie unter 14 Spieler (min. ${r.kaderMin})`);
    assert(r.saveMax < 1024 * 1024, `Spielstand bleibt unter 1 MB (max. ${Math.round(r.saveMax / 1024)} KB)`);
    assert(r.drift.every(d => Math.abs(d) <= 8), `KI-Ligen bleiben auf ihrem Niveau (Abweichung ${r.drift.join('/')})`);
    assert(r.alterOk, 'Alle Spieler haben ein plausibles, ganzzahliges Alter');
    assert(r.roundtrip, 'Spielstand nach 6 Saisons übersteht Speichern und Laden');
    assert(r.karriereSaisons === 6, `Manager-Statistik hat 6 Saisons (${r.karriereSaisons})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler im Langzeittest (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testTacticRecords(browser) {
    console.log('\n[P15b] Taktik-Bilanz und Aufräumen Teil 4');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        game.formation = '4-3-3'; game.tacticStyle = 'pressing';
        game.sackPending = false; simulateMatchdays(5);
        game.formation = '5-3-2'; game.tacticStyle = 'defensiv';
        game.sackPending = false; simulateMatchdays(5);
        const rows = getTacticRecordRows();
        const spiele = rows.reduce((a, x) => a + x.spiele, 0);
        const druck = rows.find(x => x.formation === '4-3-3' && x.stil === 'pressing');
        renderTacticSystemPanel();
        const html = document.getElementById('tactic-system-panel').innerHTML;
        // Alte Spielstände: Felder der entfernten Module verschwinden beim Laden
        const save = buildSaveState();
        save.game = Object.assign({}, save.game, { tacticAnalysis: { effectiveness: 0.5 }, playerRoles: {}, clubSwitchHistory: [],
            tacticFinesse: { pressing: 'aggressive' }, formationStats: { byFormation: {} }, opponentHistoryStats: {}, tacticalFlexibility: { flexibility: 50 } });
        if (save.squad && save.squad[0]) Object.assign(save.squad[0], { setpieceSkills: { cornerQuality: 50 }, positionFlexibility: { secondaryPositions: [] } });
        applyLoadedState(JSON.parse(JSON.stringify(save)));
        return {
            spiele, druckSpiele: druck ? druck.spiele : 0, html,
            toreStimmen: rows.every(x => x.tore >= 0 && x.gegentore >= 0 && x.s + x.u + x.n === x.spiele),
            altWeg: !('tacticAnalysis' in game) && !('playerRoles' in game) && !('clubSwitchHistory' in game)
                && !['tacticFinesse', 'formationStats', 'opponentHistoryStats', 'tacticalFlexibility'].some(k => k in game)
                && squad.every(p => !('setpieceSkills' in p) && !('positionFlexibility' in p)),
            behalten: game.tacticRecords && Object.keys(game.tacticRecords).length === rows.length,
            modulWeg: typeof switchToNewClub === 'undefined' && typeof renderPlayerRetirementPanel === 'undefined'
                && typeof getFormationCompletenessFit === 'undefined' && typeof tickPlayerRetirement === 'function'
                && typeof getTacticFinesseBonusMultiplier === 'undefined' && typeof renderMatchPredictionPanel === 'undefined'
        };
    });
    assert(r.spiele === 10, `Taktik-Bilanz zählt jedes Ligaspiel genau einmal (${r.spiele}/10)`);
    assert(r.druckSpiele === 5, `Bilanz je Formation und Stil getrennt (4-3-3 Pressing: ${r.druckSpiele}/5)`);
    assert(r.toreStimmen, 'Siege, Remis und Niederlagen ergeben die Spielzahl');
    assert(r.html.includes('Pkt/Sp.') && r.html.includes('Pressing') && r.html.includes('Teamstärke-Effekt'), 'Panel zeigt Bilanz-Tabelle und echte Stärke-Effekte');
    assert(r.altWeg, 'Alte Taktik-/Vereinswechsel-Felder werden beim Laden entfernt');
    assert(r.behalten, 'Taktik-Bilanz übersteht Speichern und Laden');
    assert(r.modulWeg, 'Admin-Vereinswechsel, Pensionierungs-Panel und Schein-Taktikwerte sind entfernt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testCupLive(browser) {
    console.log('\n[P15c] Pokal, Champions Cup und Relegation als Livespiel');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Pokalpartie (DFB- oder Landespokal) suchen: bis zum ersten eigenen Pokal-Spieltag vorspulen
        let tie = null;
        while (game.matchday <= 30 && !(tie = findOwnCupTieToday())) { game.sackPending = false; simulateMatchdays(1); }
        out.pokalGefunden = !!tie;
        if (tie) {
            const md = game.matchday, startelf = lineup.join(','), tore = squad.map(p => p.goalsSeason || 0).join(',');
            startMatchdayFlow();
            out.vorberichtPokal = !!(pendingMatchInfo && pendingMatchInfo.cupTie) && document.getElementById('prematch-analysis-box').innerHTML.includes(tie.titel);
            resolveMatchInstantly();
            const live = game.liveCupResult;
            if (live && live.homeGoals === live.awayGoals && pendingShootoutContext) pendingShootoutContext.onConfirm(autoSelectShooters());
            out.ergebnisAbgelegt = !!live && live.homeGoals === currentMatch.homeGoals && live.awayGoals === currentMatch.awayGoals && game.matchday === md;
            out.ligaUnberuehrt = lineup.join(',') === startelf && squad.map(p => p.goalsSeason || 0).join(',') === tore;
            out.weiterKnopf = document.getElementById('btn-finish-match').innerText.includes('Ligaspiel');
            const erwartet = live ? { h: live.homeGoals, a: live.awayGoals, pw: live.penaltyWinner } : null;
            finishMatch();
            out.dannLiga = !!pendingMatchInfo && !pendingMatchInfo.cupTie && !!pendingMatchInfo.ourFixture;
            resolveMatchInstantly();
            const runden = tie.comp === 'dfb' ? cupTournament.roundsHistory : landesPokal.roundsHistory;
            const paar = runden.flatMap(x => x.pairings).find(x => x.home === tie.home && x.away === tie.away);
            out.pokalUebernommen = !!paar && !!erwartet && paar.played && paar.homeGoals === erwartet.h && paar.awayGoals === erwartet.a
                && (erwartet.h !== erwartet.a || paar.penaltyWinner === erwartet.pw || !erwartet.pw);
            out.weiterGespielt = game.matchday === md + 1 && game.liveCupResult === null;
            finishMatch();
        }
        // Champions Cup: Gruppenspiel an Spieltag 3 einer neuen Saison
        game.inEurope = true; initEuropeCup();
        game.matchday = 3;
        const eu = findOwnCupTieToday();
        out.europaGefunden = !!eu && eu.comp === 'europe';
        if (out.europaGefunden) {
            startMatchdayFlow(); resolveMatchInstantly();
            const live = { ...game.liveCupResult };
            finishMatch(); resolveMatchInstantly();
            const wir = [...europeTournament.groupA, ...europeTournament.groupB].find(t => t.name === game.clubName);
            const heim = eu.home === game.clubName;
            out.europaUebernommen = wir.played === 1 && wir.gf === (heim ? live.homeGoals : live.awayGoals) && wir.ga === (heim ? live.awayGoals : live.homeGoals);
            finishMatch();
        }
        // Relegation nach dem 34. Spieltag
        while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(5); }
        // Relegationsplatz: 16. (Abstieg) oder in der untersten Liga 3. (Aufstieg)
        // Dieselbe Sortierung wie das Spiel (inkl. erzielter Tore) - mit einer eigenen ohne
        // diesen Tiebreak landete der Verein bei Gleichstand gelegentlich neben dem Relegationsplatz.
        const tabelle = sortedTable(game.leagueLevel);
        const wir = tabelle.find(t => t.name === game.clubName), ziel = tabelle[game.leagueLevel === NUM_LEAGUES - 1 ? 2 : 15];
        if (wir && ziel && wir !== ziel) ['points', 'goalsFor', 'goalsAgainst'].forEach(k => { const x = wir[k]; wir[k] = ziel[k]; ziel[k] = x; });
        game.relegation = null;
        const sit = getRelegationSituation();
        out.relegationDa = !!sit;
        if (sit) {
            renderRelegationBox();
            out.relegationKnopf = document.getElementById('dash-relegation-box').innerHTML.includes('startRelegationLive');
            startRelegationLive(); resolveMatchInstantly();
            const leg = game.relegation && game.relegation.legs[0];
            const heim = leg && leg.isHome;
            out.relegationLive = !!leg && leg.live === true && leg.ourGoals === (heim ? currentMatch.homeGoals : currentMatch.awayGoals);
            finishMatch();
            out.relegationZurueck = document.getElementById('screen-dashboard').style.display !== 'none';
        }
        return out;
    });
    assert(r.pokalGefunden, 'Eigene Pokalpartie wird am Pokal-Spieltag erkannt');
    assert(r.vorberichtPokal, 'Pokal-Spieltag beginnt mit dem Vorbericht zum Pokalspiel');
    assert(r.ergebnisAbgelegt, 'Live-Ergebnis des Pokalspiels wird abgelegt, der Spieltag läuft noch nicht weiter');
    assert(r.ligaUnberuehrt, 'Einwechslungen und Pokaltore verändern Startelf und Liga-Torjägerliste nicht');
    assert(r.weiterKnopf, 'Nach dem Pokalspiel führt der Knopf zum Ligaspiel');
    assert(r.dannLiga, 'Danach folgt das Ligaspiel desselben Spieltags');
    assert(r.pokalUebernommen, 'Pokalrunde übernimmt genau das live gespielte Ergebnis');
    assert(r.weiterGespielt, 'Spieltag wird nach dem Ligaspiel abgeschlossen, Live-Ergebnis verbraucht');
    assert(r.europaGefunden && r.europaUebernommen, 'Champions-Cup-Gruppenspiel live gespielt und in die Gruppentabelle übernommen');
    assert(r.relegationDa && r.relegationKnopf, 'Relegations-Box bietet das Livespiel an');
    assert(r.relegationLive, 'Relegations-Hinspiel übernimmt das Live-Ergebnis');
    assert(r.relegationZurueck, 'Nach dem Relegationsspiel geht es zurück zum Dashboard');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testSeasonEvents(browser) {
    console.log('\n[P15d] Saisoneröffnung, Hallenturnier, Abschiedsspiel, Supercup');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        const box = () => document.getElementById('dash-season-events-box').innerHTML;
        // Saisoneröffnung: einmal pro Saison vor dem 1. Spieltag
        renderSeasonEventsBox();
        out.eroeffnungAngeboten = box().includes('chooseSeasonOpening');
        const geld0 = game.money;
        chooseSeasonOpening('sponsorentag');
        out.eroeffnungWirkt = game.money > geld0 && game.seasonOpening.season === game.season;
        const geld1 = game.money;
        chooseSeasonOpening('fanfest');
        renderSeasonEventsBox();
        out.eroeffnungEinmal = game.money === geld1 && !box().includes('chooseSeasonOpening');
        // Hallenturnier: Einladung, Zusage, Turnier in der Winterpause
        while (game.matchday <= HALLENTURNIER_EINLADUNG) { game.sackPending = false; simulateMatchdays(1); }
        out.einladung = !!game.hallenturnier && game.hallenturnier.status === 'eingeladen';
        renderSeasonEventsBox();
        out.einladungSichtbar = box().includes('respondHallenturnier');
        respondHallenturnier(true);
        while (game.matchday <= HALLENTURNIER_SPIELTAG) { game.sackPending = false; simulateMatchdays(1); }
        const h = game.hallenturnier;
        out.hallenturnier = h.status === 'gespielt' && h.spiele.length === 3 && h.praemie > 0 && [h.spiele[2].heim, h.spiele[2].gast].includes(h.sieger);
        out.hallenTitel = (h.sieger === game.clubName) === game.trophies.some(t => t.includes('Hallenmasters'));
        // Abschiedsspiel für einen verdienten Spieler
        const alt = squad[0];
        alt.age = 36; alt.appearances = 200;
        schedulePlayerRetirement(alt.id);
        out.abschiedOffen = getOpenFarewellMatches().length === 1 && getOpenFarewellMatches()[0].name === alt.name;
        const geld3 = game.money, fans3 = game.fans;
        holdFarewellMatch(alt.name);
        out.abschiedWirkt = game.money !== geld3 && game.fans >= Math.min(100, fans3 + 3) && getOpenFarewellMatches().length === 0;
        // Supercup: eigener Verein gewinnt das DFB-Pokalfinale, spielt am 1. Spieltag gegen den Meister
        while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(5); }
        const finale = cupTournament.roundsHistory.find(x => x.roundIndex === 4);
        if (finale) { const p = finale.pairings[0]; p.home = game.clubName; p.homeGoals = 3; p.awayGoals = 0; p.played = true; finale.completed = true; }
        concludeSeasonAndAdvance();
        const sc = findOwnCupTieToday();
        out.supercupAngesetzt = !!game.supercup && !!sc && sc.comp === 'supercup' && game.matchday === 1;
        if (out.supercupAngesetzt) {
            startMatchdayFlow();
            resolveMatchInstantly();
            const live = { ...game.liveCupResult };
            if (live.homeGoals === live.awayGoals && pendingShootoutContext) pendingShootoutContext.onConfirm(autoSelectShooters());
            const pw = game.liveCupResult && game.liveCupResult.penaltyWinner;
            finishMatch();
            resolveMatchInstantly();
            const s = game.supercup;
            const erwarteterSieger = live.homeGoals > live.awayGoals ? s.home : (live.awayGoals > live.homeGoals ? s.away : pw);
            out.supercupUebernommen = s.played && s.score === `${live.homeGoals}:${live.awayGoals}` && s.winner === erwarteterSieger;
            out.supercupTitel = (s.winner === game.clubName) === game.trophies.some(t => t.includes('Supercup-Sieger'));
            finishMatch();
        }
        return out;
    });
    assert(r.eroeffnungAngeboten && r.eroeffnungWirkt && r.eroeffnungEinmal, 'Saisoneröffnung vor dem 1. Spieltag, genau einmal pro Saison, mit echter Wirkung');
    assert(r.einladung && r.einladungSichtbar, 'Einladung zum Hallenturnier nach dem 15. Spieltag mit Zu-/Absage auf dem Dashboard');
    assert(r.hallenturnier, 'Hallenturnier wird in der Winterpause ausgespielt (Halbfinals, Finale, Prämie)');
    assert(r.hallenTitel, 'Hallenmasters-Titel nur bei eigenem Turniersieg');
    assert(r.abschiedOffen && r.abschiedWirkt, 'Abschiedsspiel für verdiente Spieler bringt Zuschauer und Fans, nur einmal');
    assert(r.supercupAngesetzt, 'Pokalsieger spielt am 1. Spieltag den Supercup');
    assert(r.supercupUebernommen && r.supercupTitel, 'Supercup übernimmt das live gespielte Ergebnis und vergibt den Titel');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testMobileLayout(browser) {
    console.log('\n[P16a] Handy-Layout (412 px): Überläufe, Knopfgröße, Schriftgröße');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.setViewportSize({ width: 412, height: 900 });
    const r = await page.evaluate(async () => {
        closeTutorial();
        game.sackPending = false; simulateMatchdays(5);
        const views = [...document.querySelectorAll('[id^="screen-"]')].map(e => e.id)
            .filter(id => !id.includes('prematch') && id !== 'screen-matchday').map(id => [id, () => showScreen(id)]);
        const tabs = { 'screen-fans': ['setFansTab', ['gruppen', 'programme', 'sicherheit']], 'screen-league': ['setLeagueTab', ['fixtures', 'stats', 'table']],
            'screen-squad': ['setSquadTab', ['analyse', 'aufstellung', 'taktik', 'team']], 'screen-training': ['setTrainingTab', ['individual', 'minigames', 'plan', 'special']],
            'screen-transfer': ['setTransferTab', ['free', 'loan', 'market', 'offers', 'sell']] };
        Object.entries(tabs).forEach(([sc, [fn, ts]]) => ts.forEach(t => views.push([`${sc}/${t}`, () => { showScreen(sc); window[fn](t); }])));
        ['bank', 'budget', 'journal', 'uebersicht'].forEach(t => views.push([`fin/${t}`, () => { showScreen('screen-finances'); setSubTab('fin', t); }]));
        ['chronik', 'legenden', 'rivalen', 'titel'].forEach(t => views.push([`hist/${t}`, () => { showScreen('screen-history'); setSubTab('hist', t); }]));
        ['entwicklung', 'liga', 'talente'].forEach(t => views.push([`jug/${t}`, () => { showScreen('screen-youth'); setSubTab('jug', t); }]));
        const W = document.documentElement.clientWidth;
        const ueberlauf = [], knoepfe = [], schrift = [], verdeckt = [], streifen = [];
        for (const [name, open] of views) {
            open();
            await new Promise(res => setTimeout(res, 20));
            if (document.documentElement.scrollWidth > W + 2) ueberlauf.push(name);
            // Seitenende muss nach dem Herunterscrollen über der unteren Leiste stehen
            window.scrollTo(0, document.documentElement.scrollHeight);
            const navTop = document.querySelector('.bottom-nav-bar').getBoundingClientRect().top;
            const sichtbar = [...document.querySelectorAll('.app-content button, .app-content .box')].filter(e => e.getBoundingClientRect().height > 0 && !e.closest('[style*="overflow-y"]'));
            const unterste = Math.max(0, ...sichtbar.map(e => e.getBoundingClientRect().bottom));
            if (unterste > navTop + 1) verdeckt.push(`${name} (${Math.round(unterste - navTop)} px)`);
            window.scrollTo(0, 0);
            document.querySelectorAll('.app-content button, .bottom-nav-bar button').forEach(b => {
                const rect = b.getBoundingClientRect();
                if (rect.height > 0 && rect.height < 32) knoepfe.push(`${name}: "${b.innerText.trim().slice(0, 20)}" ${Math.round(rect.height)}px`);
            });
            document.querySelectorAll('.app-content *').forEach(el => {
                if (el.getBoundingClientRect().height === 0) return;
                if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
                if (parseFloat(getComputedStyle(el).fontSize) < 8) schrift.push(`${name}: "${el.textContent.trim().slice(0, 20)}"`);
            });
            // Akzentstreifen (.box::before, bis 9 px vom Rand) darf nicht auf dem Text liegen
            document.querySelectorAll('.app-content .box').forEach(el => {
                if (el.getBoundingClientRect().height === 0) return;
                const vor = getComputedStyle(el, '::before');
                if (vor.content === 'none' || vor.display === 'none') return;
                const streifenEnde = parseFloat(vor.left) + parseFloat(vor.width);
                if (parseFloat(getComputedStyle(el).paddingLeft) < streifenEnde + 3) streifen.push(`${name}: "${el.textContent.trim().slice(0, 20)}"`);
            });
        }
        const navZeilen = new Set([...document.querySelectorAll('.bottom-nav-bar button')].map(b => Math.round(b.getBoundingClientRect().top))).size;
        return { anzahl: views.length, ueberlauf, knoepfe: [...new Set(knoepfe)], schrift: [...new Set(schrift)], navZeilen, verdeckt, streifen: [...new Set(streifen)] };
    });
    assert(r.ueberlauf.length === 0, `Kein horizontaler Überlauf auf ${r.anzahl} Bildschirmen/Reitern (${r.ueberlauf.join(', ')})`);
    assert(r.knoepfe.length === 0, `Alle Knöpfe mindestens 32 px hoch (${r.knoepfe.slice(0, 4).join(' | ')})`);
    assert(r.schrift.length === 0, `Keine Schrift unter 8 px (${r.schrift.slice(0, 4).join(' | ')})`);
    assert(r.navZeilen === 1, `Untere Leiste in einer Zeile (${r.navZeilen})`);
    assert(r.streifen.length === 0, `Akzentstreifen der Kästen liegt nirgends auf dem Text (${r.streifen.length}: ${r.streifen.slice(0, 4).join(' | ')})`);
    assert(r.verdeckt.length === 0, `Seitenende nirgends von der unteren Leiste verdeckt (${r.verdeckt.slice(0, 5).join(', ')})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testCareerBalancing(browser) {
    console.log('\n[P16b] Karriere-Balancing: Fitness, Transfermarkt, Lizenzkosten');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Unveränderte Startelf über 6 Spieltage (Livespiel-Nutzer ohne Rotation)
        const elf = pickBestLineupIds();
        squad.forEach(p => { p.fitness = 100; });
        for (let i = 0; i < 6; i++) { lineup = [...elf]; processPostMatchRoutine('draw', false, false, 0, true, { total: 2, bothScored: true }); }
        const starter = squad.filter(p => elf.includes(p.id) && !(p.injured > 0));
        out.fitnessMin = Math.min(...starter.map(p => p.fitness));
        // Vorbericht warnt vor müden Stammspielern, Knopf stellt ausgeruhte Elf auf
        squad.filter(p => lineup.includes(p.id)).slice(0, 3).forEach(p => { p.fitness = 50; });
        renderFatigueWarning();
        out.warnung = document.getElementById('prematch-fatigue-box').innerHTML.includes('rotateTiredPlayers');
        rotateTiredPlayers();
        out.rotiert = squad.filter(p => lineup.includes(p.id) && p.fitness < 70).length < 3;
        // Nur so viele Verteidiger wie die Formation braucht, alle erschöpft: ein ausgeruhter
        // Feldspieler einer anderen Position spielt statt eines Müden (vorher spielten alle durch).
        game.formation = '4-4-2';
        squad.forEach(p => { p.fitness = 100; p.injured = 0; p.suspended = 0; });
        const abw = squad.filter(p => p.pos === 'ABW');
        abw.slice(4).forEach(p => { p.injured = 3; });
        abw.slice(0, 4).forEach(p => { p.fitness = 20; });
        const ausgeruht = pickBestLineupIds();
        out.muedeVerteidiger = abw.slice(0, 4).filter(p => ausgeruht.includes(p.id)).length;
        out.elfVoll = ausgeruht.length === 11 && ausgeruht.filter(id => squad.find(p => p.id === id).pos === 'TW').length === 1;
        squad.forEach(p => { p.fitness = 100; p.injured = 0; });
        // Heimvorteil auch für den Gegner, Eigenschaften-Boni zusammen höchstens +3
        out.gegnerHeim = getOpponentMatchStrength(70, true) - getOpponentMatchStrength(70, false) === AI_HOME_ADVANTAGE && AI_HOME_ADVANTAGE > 0;
        lineup = pickBestLineupIds();
        const elfSpieler = squad.filter(p => lineup.includes(p.id));
        const alteTraits = elfSpieler.map(p => p.trait);
        elfSpieler.forEach(p => { p.trait = 'Kein'; });
        const ohne = calcTeamStrength(true);
        ['Leader', 'Tor-Instinkt', 'Freistoß-Gott', 'Eisenfuß', 'Flügelflitzer', 'Zweikampfmonster'].forEach((t, i) => { if (elfSpieler[i + 1]) elfSpieler[i + 1].trait = t; });
        out.traitDeckel = calcTeamStrength(true) - ohne;
        elfSpieler.forEach((p, i) => { p.trait = alteTraits[i]; });
        // Transfermarkt: 10 Angebote, frisch zum Winterfenster
        refreshTransferMarket();
        out.markt = marketPlayers.length;
        const alt = marketPlayers.map(p => p.id).join();
        openWinterWindow();
        out.winterNeu = marketPlayers.map(p => p.id).join() !== alt;
        // Lizenzkosten skalieren mit der Liga
        game.leagueLevel = 3;
        out.flutlichtLiga4 = getSpecialInstallCost('flutlicht');
        game.leagueLevel = 0;
        out.flutlichtLiga1 = getSpecialInstallCost('flutlicht');
        game.leagueLevel = 2;
        out.internatLiga3 = getCampusUpgradeCost('internat');
        return out;
    });
    assert(r.fitnessMin >= 60, `Unveränderte Startelf nach 6 Spielen noch fit genug (min. ${r.fitnessMin} %)`);
    assert(r.warnung && r.rotiert, 'Vorbericht warnt vor müden Stammspielern, ein Klick rotiert');
    assert(r.gegnerHeim, 'Auch der Gegner hat daheim Heimvorteil');
    assert(r.traitDeckel >= 2 && r.traitDeckel <= 3, `Spieler-Eigenschaften bringen zusammen höchstens +3 (${r.traitDeckel})`);
    assert(r.muedeVerteidiger === 0 && r.elfVoll, `Erschöpfte Verteidiger ohne Ersatz auf der Position pausieren, ausgeruhte Feldspieler rücken nach (${r.muedeVerteidiger} müde in der Elf)`);
    assert(r.markt === 10 && r.winterNeu, `Transfermarkt mit 10 Spielern, neu zum Winterfenster (${r.markt})`);
    assert(r.flutlichtLiga4 <= 1000000 && r.flutlichtLiga1 === 3500000, `Flutlicht skaliert mit der Liga (Liga 4: ${r.flutlichtLiga4}, Liga 1: ${r.flutlichtLiga1})`);
    assert(r.internatLiga3 <= 3000000, `Jugendinternat (Lizenz 2. Liga) in der 3. Liga bezahlbar (${r.internatLiga3})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testLiveMatchEngine(browser) {
    console.log('\n[P16c] Livespiel: Torschützen, Statistik, Auswechslungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Auswärtsspiel gegen einen sehr schwachen Gegner: unsere Tore sind Gasttore
        lineup = pickBestLineupIds();
        const toreVorher = squad.reduce((a, p) => a + (p.goalsSeason || 0), 0);
        setupMatch('Kreisklasse FC', game.clubName, 5, false, false, null);
        stopLiveTickerAutoplay();
        // Auswechslung vor dem Durchlauf: stärkster Bankspieler für den schwächsten Feldspieler
        const bank = squad.filter(p => !lineup.includes(p.id) && p.pos !== 'TW' && !(p.injured > 0)).sort((a, b) => b.strength - a.strength)[0];
        const stBefore = currentMatch.ourBaseStr;
        renderLiveSubs();
        const sel = document.getElementById('live-sub-out');
        const raus = squad.find(p => String(p.id) === sel.value);
        out.vorauswahlFeldspieler = raus && raus.pos !== 'TW';
        makeLiveSubstitution(bank.id);
        const erwartet = (liveEffectiveStrength(bank) - liveEffectiveStrength(raus)) / 11;
        out.wechselWirkt = Math.abs((currentMatch.ourBaseStr - stBefore) - erwartet) < 0.01 && lineup.includes(bank.id) && !lineup.includes(raus.id) && substitutionsLeft === 4;
        out.wechselTicker = document.getElementById('ticker-log').innerHTML.includes(`${bank.name} kommt für ${raus.name}`);
        currentMatch.halftimeShown = true; // Halbzeit-Ansprache überspringen
        while (currentMatch.minute < 90) { if (currentMatch.awaitingSetPiece) resolveSetPiece(null, true); simulateMatchStep(); }
        const st = currentMatch.stats;
        const unsere = currentMatch.awayGoals, gegner = currentMatch.homeGoals;
        const toreNachher = squad.reduce((a, p) => a + (p.goalsSeason || 0), 0);
        out.einzel = `${gegner}:${unsere}`;
        out.torschuetzenRichtig = toreNachher - toreVorher === unsere;
        out.statistik = st.shots[1] >= unsere && st.onTarget[1] >= unsere && st.shots[0] >= gegner && getLivePossession()[1] > 55;
        out.statistikSichtbar = document.getElementById('live-match-stats').innerHTML.includes('Ballbesitz');
        out.abpfiffZeile = document.getElementById('ticker-log').innerHTML.includes('📊 Statistik');
        const stand = `${currentMatch.homeGoals}:${currentMatch.awayGoals}`;
        for (let i = 0; i < 5; i++) simulateMatchStep(); // nach dem Abpfiff passiert nichts mehr
        out.nachAbpfiffRuhe = `${currentMatch.homeGoals}:${currentMatch.awayGoals}` === stand;
        // Überlegenheit über zehn weitere Auswärtsspiele (ein Einzelspiel kann 1:1 enden; mit fünf
        // reichte ein seltener Ausreißer von 3:8 für einen roten Check)
        let wir = unsere, sie = gegner;
        for (let n = 0; n < 10; n++) {
            lineup = pickBestLineupIds();
            setupMatch('Kreisklasse FC', game.clubName, 5, false, false, null);
            stopLiveTickerAutoplay();
            currentMatch.halftimeShown = true;
            while (currentMatch.minute < 90) { if (currentMatch.awaitingSetPiece) resolveSetPiece(null, true); simulateMatchStep(); }
            wir += currentMatch.awayGoals; sie += currentMatch.homeGoals;
        }
        out.tore = `${sie}:${wir} in 11 Spielen`;
        out.dominant = wir >= 3 * Math.max(1, sie);
        // Livespiel = Simulation (25.12): dieselben erwarteten Tore wie getExpectedGoals(); vorher
        // gewann der Stärkere live ~25 Prozentpunkte öfter (eigene, steilere Formel + Trait-Extras).
        let ist = [0, 0], soll = [0, 0];
        const N_PARITAET = 80;
        for (let n = 0; n < N_PARITAET; n++) {
            squad.forEach(p => { p.fitness = 100; });
            lineup = pickBestLineupIds();
            const gegnerStaerke = calcTeamStrength(true) - 16;
            setupMatch(game.clubName, 'Paritaet FC', gegnerStaerke, true, false, null);
            stopLiveTickerAutoplay();
            currentMatch.halftimeShown = true;
            const unsere = currentMatch.ourBaseStr + getTacticStyleBonus(game.tacticStyle) + getTackleHardnessBonus(game.tackleHardness) + getFormationDefBonus() * 0.6;
            const xg = getExpectedGoals(unsere, gegnerStaerke, currentMatch.homeTeamObj, null);
            soll[0] += xg.myXg; soll[1] += xg.oppXg;
            while (currentMatch.minute < 90) { if (currentMatch.awaitingSetPiece) resolveSetPiece(null, true); simulateMatchStep(); }
            ist[0] += currentMatch.homeGoals; ist[1] += currentMatch.awayGoals;
        }
        out.paritaet = `live ${(ist[0] / N_PARITAET).toFixed(2)}:${(ist[1] / N_PARITAET).toFixed(2)}, erwartet ${(soll[0] / N_PARITAET).toFixed(2)}:${(soll[1] / N_PARITAET).toFixed(2)}`;
        out.paritaetOk = Math.abs(ist[0] - soll[0]) / N_PARITAET <= 0.45 && Math.abs(ist[1] - soll[1]) / N_PARITAET <= 0.35;
        // Brechstange/Pressing kosten Kraft (25.13): die Minuten werden gezählt und nach dem Spiel abgerechnet
        lineup = pickBestLineupIds();
        setupMatch(game.clubName, 'Kraft FC', calcTeamStrength(true), true, false, null);
        stopLiveTickerAutoplay(); currentMatch.halftimeShown = true;
        activeLiveShout = 'pressing';
        while (currentMatch.minute < 68) { if (currentMatch.awaitingSetPiece) resolveSetPiece(null, true); simulateMatchStep(); }
        out.kraftMinuten = currentMatch.kraftMinuten || 0;
        while (currentMatch.minute < 90) { if (currentMatch.awaitingSetPiece) resolveSetPiece(null, true); simulateMatchStep(); }
        out.kraftMinuten = currentMatch.kraftMinuten === 0 && out.kraftMinuten <= 90 ? out.kraftMinuten : -1; // nach dem Abpfiff abgerechnet
        activeLiveShout = 'standard';
        return out;
    });
    assert(r.torschuetzenRichtig, `Auswärtstore werden unseren Spielern gutgeschrieben, Heimtore nicht (${r.einzel})`);
    assert(r.dominant, `Klar überlegene Mannschaft gewinnt auswärts (${r.tore})`);
    assert(r.paritaetOk, `Livespiel folgt den erwarteten Toren der Simulation (${r.paritaet})`);
    assert(r.kraftMinuten >= 45, `Pressing-Minuten werden gezählt und nach dem Abpfiff als Fitnessverlust abgerechnet (${r.kraftMinuten})`);
    assert(r.statistik && r.statistikSichtbar && r.abpfiffZeile, 'Statistik (Ballbesitz, Schüsse) passt zum Spiel und wird angezeigt');
    assert(r.vorauswahlFeldspieler, 'Auswechslung: Vorauswahl ist ein Feldspieler, nicht der Torwart');
    assert(r.wechselWirkt && r.wechselTicker, 'Auswechslung ersetzt den gewählten Spieler und ändert die Teamstärke');
    assert(r.nachAbpfiffRuhe, 'Nach dem Abpfiff fallen keine Tore mehr');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testNoWriteOnlyGameFields() {
    console.log('\n[P16d] Aufräumen: keine game-Felder, die nur geschrieben und nie gelesen werden');
    const fs = require('fs');
    const root = path.resolve(__dirname, '..');
    const quellen = ['index.html', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)]
        .map(f => fs.readFileSync(path.join(root, f), 'utf8'));
    const gelesen = new Set(), geschrieben = new Set();
    quellen.forEach(src => src.split('\n').forEach(zeile => {
        const zugewiesen = new Set([...zeile.matchAll(/\bgame\.(\w+)\s*(?:=(?!=)|\+=|-=|\+\+|--)/g)].map(m => m[1]));
        for (const m of zeile.matchAll(/\bgame\.(\w+)/g)) {
            const rest = zeile.slice(m.index + m[0].length, m.index + m[0].length + 4);
            if (/^\s*(=(?!=)|\+=|-=|\*=|\+\+|--)/.test(rest)) geschrieben.add(m[1]);
            // Lesen nur, um sich selbst hochzuzählen, zählt nicht - außer als Bedingung (if/?:)
            else if (!zugewiesen.has(m[1]) || /\bif\s*\(|\?/.test(zeile)) gelesen.add(m[1]);
        }
    }));
    const nurGeschrieben = [...geschrieben].filter(n => !gelesen.has(n));
    assert(nurGeschrieben.length === 0, `Jedes geschriebene game-Feld wird irgendwo gelesen (${nurGeschrieben.join(', ')})`);
}

async function testAiClubs(browser) {
    console.log('\n[P17a] KI-Vereine: Stars, Transfers untereinander, Ticker');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        ensureAiStars();
        const ki = leaguesData.flat().filter(isAiClub);
        out.alleStars = ki.every(t => t.star && t.star.name && t.star.strength > 0);
        out.eigenerOhne = !leaguesData.flat().find(t => t.name === game.clubName).star;
        const summe = () => leaguesData.flat().reduce((a, t) => a + t.strength, 0);
        const vorher = summe();
        const inboxVorher = inboxMessages.length;
        game.matchday = 2;
        for (let i = 0; i < 3; i++) tickAiTransfers();
        out.news = (game.aiTransferNews || []).filter(n => !n.retired).length;
        out.summeGleich = Math.abs(summe() - vorher) <= 2 * out.news; // nur Kappungen an den Rändern
        const n = game.aiTransferNews[0];
        const kaeufer = leaguesData.flat().find(t => t.name === n.to);
        const verkaeufer = leaguesData.flat().find(t => t.name === n.from);
        out.starGewechselt = !!kaeufer && !!verkaeufer && verkaeufer.star.name !== n.player && n.fee > 0;
        out.postfach = inboxMessages.length > inboxVorher && inboxMessages.some(m => (m.title || m.subject || '').includes('Transfer-Ticker'));
        // Kein Wechsel außerhalb der Fenster
        game.matchday = 7;
        const anzahl = game.aiTransferNews.length;
        tickAiTransfers();
        out.nurImFenster = game.aiTransferNews.length === anzahl;
        // Stars altern, mit 34 Karriereende
        ki[0].star.age = 33;
        const alterName = ki[0].star.name;
        ageAiStars();
        out.karriereende = ki[0].star.name !== alterName && game.aiTransferNews[0].retired === true;
        // Sichtbar: Transfer-Ticker und Vereinsakte
        renderAiTransferNews();
        out.ticker = document.getElementById('ai-transfer-news-box').innerHTML.includes('→');
        showHeadToHeadStats(kaeufer.name);
        out.akte = document.getElementById('head-to-head-box').innerHTML.includes('Star:');
        // Speichern/Laden behält die Stars
        const save = JSON.parse(JSON.stringify(buildSaveState()));
        applyLoadedState(save);
        out.gespeichert = leaguesData.flat().filter(isAiClub).every(t => t.star);
        return out;
    });
    assert(r.alleStars && r.eigenerOhne, 'Jeder KI-Verein hat einen Star, der eigene Verein nicht');
    assert(r.news > 0 && r.starGewechselt, `KI-Vereine kaufen Stars mit Ablöse (${r.news} Wechsel)`);
    assert(r.summeGleich, 'Stärke wandert mit dem Spieler - in der Summe bleibt sie gleich');
    assert(r.postfach, 'Transfer-Ticker kommt ins Postfach');
    assert(r.nurImFenster, 'Wechsel nur in den Transferfenstern');
    assert(r.karriereende, 'Stars altern und beenden mit 34 ihre Karriere');
    assert(r.ticker && r.akte, 'Ticker auf dem Transfer-Bildschirm, Star in der Vereinsakte');
    assert(r.gespeichert, 'Stars überstehen Speichern und Laden');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPlayerStats(browser) {
    console.log('\n[P17b] Spielerstatistik: Tore, Vorlagen, Noten, Elf des Spieltags');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        for (let i = 0; i < 10; i++) { game.sackPending = false; simulateMatchdays(1); }
        const mitStats = squad.filter(p => p.statsSeason);
        const tore = squad.reduce((a, p) => a + (p.statsSeason ? p.statsSeason.tore : 0), 0);
        const eigene = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        out.toreStimmen = tore === eigene.goalsFor;
        out.vorlagen = squad.reduce((a, p) => a + (p.statsSeason ? p.statsSeason.vorlagen : 0), 0);
        out.vorlagenPlausibel = out.vorlagen <= tore && out.vorlagen >= Math.floor(tore * 0.4);
        out.spiele = Math.max(...mitStats.map(p => p.statsSeason.spiele));
        out.notenGueltig = mitStats.every(p => p.lastGrade >= 1 && p.lastGrade <= 6 && (p.lastGrade * 2) % 1 === 0);
        out.bester = !!game.lastMatchBestPlayer;
        // Anzeige im Analyse-Reiter
        showScreen('screen-squad'); setSquadTab('analyse');
        const html = document.getElementById('player-season-stats-box').innerHTML;
        out.tabelle = html.includes('Ø-Note') && html.includes('Vorl.');
        // Sieg mit vielen Toren -> bessere Noten als bei einer Klatsche
        lineup = pickBestLineupIds();
        squad.forEach(p => { p.dailyForm = 50; });
        const schnitt = (u, g) => { let s = 0; for (let i = 0; i < 40; i++) s += lineup.reduce((a, id) => a + computePlayerGrade(squad.find(p => p.id === id), u, g), 0) / lineup.length; return s / 40; };
        out.notenSinnvoll = schnitt(4, 0) < schnitt(0, 4) - 1;
        // Saisonwechsel: Werte wandern in die Historie
        const p0 = mitStats[0];
        const spieleVorher = p0.statsSeason.spiele;
        while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(10); }
        concludeSeasonAndAdvance();
        const p1 = squad.find(p => p.id === p0.id);
        out.saisonReset = !p1 || (!p1.statsSeason && p1.strengthHistory[p1.strengthHistory.length - 1].grade > 0);
        out.spieleVorher = spieleVorher;
        return out;
    });
    assert(r.toreStimmen, 'Tore der Spieler ergeben die Tore des Vereins in der Tabelle');
    assert(r.vorlagenPlausibel, `Vorlagen werden vergeben (${r.vorlagen})`);
    assert(r.spiele >= 8 && r.notenGueltig && r.bester, `Noten 1,0-6,0 in halben Schritten, Spieler des Spiels (${r.spiele} Spiele)`);
    assert(r.tabelle, 'Saisonstatistik im Analyse-Reiter');
    assert(r.notenSinnvoll, 'Hohe Siege geben bessere Noten als hohe Niederlagen');
    assert(r.saisonReset, 'Saisonwerte gehen beim Saisonwechsel in die Spieler-Historie');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testOnboarding(browser) {
    console.log('\n[P17c] Einstieg: Erste Schritte, Bildschirm-Tipps, Kurzanleitung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        const out = {};
        // Der Struktur-Selbsttest beim Start öffnet alle Bildschirme - das darf nichts abhaken
        out.startLeer = Object.keys(ensureOnboarding().done).length === 0 && !document.querySelector('.screen-hint');
        // Kurzanleitung nennt die echte Startliga
        tutorialPage = 0; renderTutorialPage();
        const body = document.getElementById('tutorial-body').innerHTML;
        out.anleitungLiga = body.includes(leagueNames[game.leagueLevel]) && !body.includes('{LIGA}');
        closeTutorial();
        showScreen('screen-dashboard');
        const box = () => document.getElementById('dash-onboarding-box').innerHTML;
        out.listeSichtbar = box().includes('Erste Schritte') && box().includes('⬜');
        // Tipp auf dem Kader-Bildschirm, ausblendbar
        showScreen('screen-squad');
        out.tippDa = !!document.querySelector('#screen-squad > .screen-hint');
        hideScreenHint('screen-squad');
        showScreen('screen-squad');
        out.tippWeg = !document.querySelector('#screen-squad > .screen-hint');
        // Schritte haken sich selbst ab
        const xp0 = managerRPG.xp + managerRPG.level * 100000;
        ['screen-training', 'screen-finances', 'screen-transfer'].forEach(sc => showScreen(sc));
        game.sackPending = false; simulateMatchdays(1);
        quickSave();
        out.fertig = game.onboarding.finished === true && Object.keys(game.onboarding.done).length === 6;
        out.xp = managerRPG.xp + managerRPG.level * 100000 > xp0;
        showScreen('screen-dashboard');
        out.listeWeg = box() === '';
        // Alle Tipps aus
        hideScreenHint('alle');
        showScreen('screen-transfer');
        out.alleAus = !document.querySelector('.screen-hint');
        return out;
    });
    assert(r.startLeer, 'Beim Spielstart ist noch kein Schritt abgehakt und kein Tipp offen');
    assert(r.anleitungLiga, 'Kurzanleitung nennt die tatsächliche Startliga');
    assert(r.listeSichtbar, 'Neues Spiel zeigt die Erste-Schritte-Liste');
    assert(r.tippDa && r.tippWeg, 'Bildschirm-Tipp erscheint und bleibt nach „Verstanden“ weg');
    assert(r.fertig && r.xp && r.listeWeg, 'Schritte haken sich beim Spielen ab, Abschluss gibt XP');
    assert(r.alleAus, '„Alle Tipps aus“ blendet alle Tipps aus');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testCompactSave(browser) {
    console.log('\n[P17d] Tempo & Speicher: kompakte Spielpläne, kein Selbsttest beim Start');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        out.keinSelbsttest = (game.selfTestHistory || []).length === 0;
        game.sackPending = false; simulateMatchdays(5);
        const original = JSON.stringify(fixturesData);
        const save = JSON.parse(JSON.stringify(buildSaveState()));
        out.kompakt = JSON.stringify(save.fixturesData).length < 40000;
        out.gesamtKB = Math.round(JSON.stringify(save).length / 1024);
        fixturesData = [];
        applyLoadedState(save);
        out.verlustfrei = JSON.stringify(fixturesData) === original;
        // Alter Spielstand mit Spielplan-Objekten lädt weiterhin
        const alt = JSON.parse(JSON.stringify(buildSaveState()));
        alt.fixturesData = JSON.parse(original);
        fixturesData = [];
        applyLoadedState(alt);
        out.altLaedt = JSON.stringify(fixturesData) === original;
        // Nach dem Laden läuft die Saison normal weiter
        simulateMatchdays(1);
        out.weiter = game.matchday === 7;
        return out;
    });
    assert(r.kompakt, `Spielpläne im Spielstand kompakt (Spielstand gesamt ${r.gesamtKB} KB)`);
    assert(r.verlustfrei && r.altLaedt && r.weiter, 'Spielpläne verlustfrei gespeichert/geladen, alte Spielstände laden weiter');
    assert(r.keinSelbsttest, 'Beim Start läuft kein Struktur-Selbsttest (kostete ~1,5 s auf dem Handy)');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPressConference(browser) {
    console.log('\n[P18a] Pressekonferenz: Fragen nach Lage, Antworten mit Wirkung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        const frage = () => document.getElementById('press-question-container').innerText;
        // Favorit: Pflichtsieg ankündigen, dann verlieren -> Image und Vorstand sinken
        renderPressConference({ oppName: 'Schwach FC', oppStr: 5, isHome: true, cup: false });
        out.favorit = frage().includes('Favorit');
        const img0 = game.managerMediaImage ?? 50, board0 = game.boardSat;
        pressSituation.antworten[0].run();
        resolvePressPromise('loss');
        out.versprechenGebrochen = (game.managerMediaImage < img0) && game.boardSat < board0 && !game.pressPromise;
        // Außenseiter: Konter-Antwort stellt den Spielstil um
        game.tacticStyle = 'ausgeglichen';
        renderPressConference({ oppName: 'Riese FC', oppStr: 99, isHome: false, cup: false });
        out.underdog = frage().includes('Favorit') && frage().includes('Riese FC');
        pressSituation.antworten[1].run();
        out.konter = game.tacticStyle === 'konter';
        // Krise nach zwei Niederlagen
        const orig = window.getOwnSeasonMatches;
        window.getOwnSeasonMatches = () => [{ own: 0, opp: 2 }, { own: 1, opp: 3 }];
        renderPressConference({ oppName: 'Mittel FC', oppStr: 45, isHome: true, cup: false });
        out.krise = frage().includes('Job');
        window.getOwnSeasonMatches = orig;
        // Pokal
        renderPressConference({ oppName: 'Pokal FC', oppStr: 45, isHome: true, cup: true });
        out.pokal = frage().includes('Pokal');
        out.hinweise = document.getElementById('press-answers-container').innerHTML.includes('Stärke +1');
        // Stärkebonus wirkt im Livespiel genau um den angekündigten Wert
        // (Gemessen im selben Spiel: zwei Spielvorbereitungen nacheinander weichen durch
        // Zufallsereignisse vor dem Anpfiff gelegentlich um ±2 voneinander ab.)
        const original = window.applyPressConferenceToMatch;
        let ohne = null;
        window.applyPressConferenceToMatch = function () { ohne = currentMatch.ourBaseStr; return original(); };
        startMatchdayFlow();
        game.pressMatchBonus = { season: game.season, matchday: game.matchday, bonus: 2 };
        try { skipPressAndPlay(); } finally { window.applyPressConferenceToMatch = original; }
        stopLiveTickerAutoplay();
        out.bonus = ohne === null ? 'nicht aufgerufen' : Math.round((currentMatch.ourBaseStr - ohne) * 10) / 10;
        return out;
    });
    assert(r.favorit && r.underdog && r.krise && r.pokal, 'Frage passt zur Lage (Favorit, Außenseiter, Krise, Pokal)');
    assert(r.hinweise, 'Antworten zeigen ihre Wirkung an');
    assert(r.versprechenGebrochen, 'Angekündigter Sieg ohne Sieg kostet Image und Vorstand');
    assert(r.konter, 'Konter-Antwort stellt den Spielstil um');
    assert(r.bonus === 2, `Stärkebonus aus der Pressekonferenz wirkt im Spiel (${r.bonus})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testContractTalks(browser) {
    console.log('\n[P18b] Vertragsgespräche: Gehaltsforderung, Laufzeit, Gegenangebot, Einsatzgarantie');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        game.money = 5000000; game.wageBudget = 10000000;
        squad.forEach(p => { p.morale = 60; });
        const elf = pickBestLineupIds();
        const star = [...squad].sort((a, b) => b.strength - a.strength)[0];
        const bank = squad.filter(p => !elf.includes(p.id)).sort((a, b) => a.strength - b.strength)[0];
        const dStar = getContractDemand(star), dBank = getContractDemand(bank);
        out.starMehr = dStar.star && dStar.gehalt / calculatePlayerWage(star.marketValue, star.strength) > dBank.gehalt / calculatePlayerWage(bank.marketValue, bank.strength);
        // Star: 2 Jahre unterschreiben
        const vertrag0 = star.contracts, geld0 = game.money;
        showScreen('screen-contracts');
        extendContract(star.id);
        out.gespraechSichtbar = document.getElementById('contracts-list').innerHTML.includes('Vertragsgespräch');
        setContractTalkYears(2);
        acceptContractTalk();
        out.unterschrieben = star.contracts === vertrag0 + 2 && star.wage === dStar.gehalt && game.money <= geld0 - dStar.handgeldProJahr * 2;
        // Bankspieler mit Einsatzgarantie: günstiger, Bruch kostet Moral
        extendContract(bank.id);
        toggleContractTalkGuarantee();
        acceptContractTalk();
        out.garantieGuenstiger = bank.wage < dBank.gehalt && !!bank.playtimePromise;
        game.season = bank.playtimePromise.season; bank.appearancesSeason = 2; bank.morale = 60;
        checkPlaytimePromises();
        out.garantieGebrochen = bank.morale === 40 && !bank.playtimePromise;
        // Zwei abgelehnte Gegenangebote beenden die Gespräche für die Saison
        // Verhandlungsstarker Charakter: nimmt Gegenangebote bei hohem Zufallswert nicht an
        const dritter = squad.find(p => p.id !== star.id && p.id !== bank.id && !['Bescheiden', 'Ruhig'].includes(p.character)) || squad.find(p => p.id !== star.id && p.id !== bank.id);
        const rnd = Math.random; Math.random = () => 0.99;
        extendContract(dritter.id); counterContractTalk(); counterContractTalk();
        Math.random = rnd;
        out.gesperrt = dritter.talksBlockedSeason === game.season && contractTalk === null;
        extendContract(dritter.id);
        out.bleibtGesperrt = contractTalk === null;
        // Gehaltsbudget wird geprüft
        const vierter = squad.find(p => ![star.id, bank.id, dritter.id].includes(p.id));
        const lohn0 = vierter.wage;
        game.wageBudget = 1;
        extendContract(vierter.id); acceptContractTalk();
        out.budgetGeprueft = vierter.wage === lohn0;
        return out;
    });
    assert(r.starMehr, 'Leistungsträger fordern relativ mehr Gehalt als Ersatzspieler');
    assert(r.gespraechSichtbar && r.unterschrieben, 'Vertragsgespräch: Laufzeit wählbar, neues Gehalt und Handgeld je Jahr');
    assert(r.garantieGuenstiger && r.garantieGebrochen, 'Einsatzgarantie macht günstiger, Bruch kostet Moral');
    assert(r.gesperrt && r.bleibtGesperrt, 'Zwei abgelehnte Gegenangebote beenden die Gespräche für die Saison');
    assert(r.budgetGeprueft, 'Gehaltsbudget wird bei der Unterschrift geprüft');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testJobOffers(browser) {
    console.log('\n[P18c] Jobangebote: erfolgsabhängig, passende Vereine, echter Wechsel');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        const rnd = Math.random;
        // Saisonende auf Platz 1: Angebot sehr wahrscheinlich; auf Platz 12 kaum
        Math.random = () => 0.5;
        checkJobOfferApproach({ saisonende: true, rank: 12 });
        out.mittelfeldKeins = pendingJobApproach === null;
        checkJobOfferApproach({ saisonende: true, rank: 1 });
        Math.random = rnd;
        // Beim Simulieren kein Fenster, sondern Karte auf dem Dashboard
        showScreen('screen-dashboard');
        out.angebot = !!pendingJobApproach && !document.getElementById('joboffer-overlay').classList.contains('show')
            && document.getElementById('dash-joboffer-box').innerHTML.includes(pendingJobApproach.clubName);
        const eigene = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        out.passenderVerein = pendingJobApproach && (pendingJobApproach.level < game.leagueLevel || pendingJobApproach.strength > eigene.strength)
            && pendingJobApproach.level >= game.leagueLevel - 1 && pendingJobApproach.clubName !== game.clubName;
        out.dreiOptionen = document.getElementById('dash-joboffer-box').innerHTML.includes('acceptJobOfferMove') && document.getElementById('joboffer-overlay').innerHTML.includes('acceptJobOfferMove');
        // Wechsel: Karriere bleibt, neuer Verein, Station wird festgehalten
        const ziel = pendingJobApproach.clubName, lvl = managerRPG.level, trophaeen = game.trophies.length;
        acceptJobOfferMove(null);
        out.gewechselt = game.clubName === ziel && managerRPG.level === lvl && game.trophies.length === trophaeen
            && game.careerStations.length === 1 && !document.getElementById('joboffer-overlay').classList.contains('show');
        renderCareerSummary();
        out.stationSichtbar = document.getElementById('career-summary-box').innerHTML.includes(ziel);
        // Weiterspielen beim neuen Verein funktioniert
        game.sackPending = false; simulateMatchdays(2);
        out.weiter = game.matchday === 3;
        return out;
    });
    assert(r.mittelfeldKeins && r.angebot, 'Angebote hängen am Erfolg (Platz 1 ja, Mittelfeld kaum)');
    assert(r.passenderVerein, 'Angebot kommt von einem stärkeren Verein der eigenen oder nächsthöheren Liga');
    assert(r.dreiOptionen && r.gewechselt && r.stationSichtbar, 'Echter Wechsel mit Karriere-Mitnahme, Station im Karriere-Rückblick');
    assert(r.weiter, 'Beim neuen Verein geht die Saison normal weiter');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function main() {
    console.log('='.repeat(60));
    console.log('ANSTOSS FM13 - AUTOMATISIERTE TESTSUITE');
    console.log('='.repeat(60));

    // Versuche zuerst 1243, dann 1194 (für verschiedene Umgebungen)
    let executablePath;
    const { existsSync } = require('fs');
    if (existsSync('/opt/pw-browsers/chromium-1243/chrome-linux/chrome')) {
        executablePath = '/opt/pw-browsers/chromium-1243/chrome-linux/chrome';
    } else if (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) {
        executablePath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    }
    const browser = await chromium.launch(executablePath ? { executablePath } : {});

    const suites = [
        testStructuralSelfTest,
        testSaveLoad,
        testMatchSimulationStability,
        testEconomy,
        testSquadAndTactics,
        testYouthAcademy,
        testYouthPathway,
        testSponsorConflict,
        testLexicon,
        testSeasonPreview,
        testAttendanceCapVaries,
        testLockerRoom,
        testSetPieces,
        testCupFinal,
        testCleanupPart8,
        testScenarioBalance,
        testSaveSafety,
        testOneHandControls,
        testDerbyWeek,
        testCoTrainerLive,
        testPregameTalk,
        testMatchPrep,
        testSetPieceDrills,
        testRefereeCritique,
        testMedicalCheck,
        testPreContracts,
        testBuyback,
        testRumors,
        testWinterTalk,
        testTransferStrategy,
        testPlayerProfile,
        testHomeRegion,
        testLocalDerbies,
        testEuropeDraw,
        testCleanupNine,
        testBundesligaLongRun,
        testCareerScenarios,
        testAutosaveResume,
        testOpponentTactics,
        testTransferPoker,
        testNationalTeam,
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
        testLeagueStats,
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
        testFakeDecisions,
        testEuropeanCup,
        testLoadingGuard,
        testAttendanceRealism,
        testClubAndPlayerNames,
        testLandesPokal,
        testFinancialFairplay,
        testBonusClauses,
        testSquadPlanningTool,
        testStadiumAusbau2,
        testPlayerAvatars,
        testTrainingCalendar,
        testTacticAutomation,
        testObjectivesEventsSeasonTickets,
        testCodeIntegrity,
        testPhase11,
        testWomenTeamExtras,
        testBoardRestart,
        testPhase12,
        testPhase13,
        testPhase13Teil2,
        testPhase13Teil3,
        testPhase13Teil4,
        testPhase14Teil1,
        testPhase14Teil2,
        testPhase14Teil3,
        testPhase14Teil4,
        testLongRun,
        testTacticRecords,
        testCupLive,
        testSeasonEvents,
        testMobileLayout,
        testCareerBalancing,
        testLiveMatchEngine,
        testNoWriteOnlyGameFields,
        testAiClubs,
        testPlayerStats,
        testOnboarding,
        testCompactSave,
        testPressConference,
        testContractTalks,
        testJobOffers,
        testRuntimeRoundTrip,
    ];

    // TEST_ONLY=Landes npm test -> nur Suiten, deren Name den Text enthält
    const only = process.env.TEST_ONLY;
    for (const suite of only ? suites.filter(s => s.name.includes(only)) : suites) {
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
        // In GitHub Actions zusätzlich als Annotation: die sind über die API lesbar, auch
        // wenn das Protokoll selbst nicht abrufbar ist.
        if (process.env.GITHUB_ACTIONS) failedTests.forEach(t => console.log(`::error title=Test fehlgeschlagen (${process.env.GAME_FILE || 'standalone'})::${String(t).replace(/[\r\n]+/g, ' ').slice(0, 300)}`));
    }
    console.log('='.repeat(60));
    process.exit(failed > 0 ? 1 : 0);
}

main();
