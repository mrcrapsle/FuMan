// Testsuiten: grundlagen
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

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
// [10] ALTE Speicherstände (MIGRATION)
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
    fs.readdirSync(path.join(TESTS_DIR, '..', 'js')).filter(f => f.endsWith('.js')).forEach(f => {
        fs.readFileSync(path.join(TESTS_DIR, '..', 'js', f), 'utf-8').split('\n').forEach((zeile, i) => {
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
    // Ohne JavaScript läuft nichts, worauf waitForFunction warten könnte (es hielt jeden Lauf volle 20 s auf):
    // das Dokument ist fertig geladen, sobald das load-Ereignis kam.
    await page.waitForLoadState('load');
    await page.waitForTimeout(100);  // Längeres Timeout um sicherzustellen, dass Ladeanzeige vollständig sichtbar ist

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

// ---------------------------------------------------------------------------
// CODE-INTEGRITÄT: Handler, Element-IDs, Diagramme in versteckten Screens, 3D-Szenen
// ---------------------------------------------------------------------------
async function testCodeIntegrity(browser) {
    console.log('\n[I] Code-Integrität: Handler, IDs, versteckte Diagramme, 3D-Szenen');
    const fs = require('fs');
    const root = path.resolve(TESTS_DIR, '..');
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

async function testNoWriteOnlyGameFields() {
    console.log('\n[P16d] Aufräumen: keine game-Felder, die nur geschrieben und nie gelesen werden');
    const fs = require('fs');
    const root = path.resolve(TESTS_DIR, '..');
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

async function testStartzeit(browser) {
    console.log('\n[25.26] Startzeit: Neues Spiel bis bedienbar, 4x CPU gedrosselt, allein gemessen (bestes von 3 Läufen)');
    const werte = [];
    for (let i = 0; i < 3; i++) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        page.on('dialog', d => d.accept());
        await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* egal */ } });
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const t0 = Date.now();
        await page.goto(GAME_PATH);
        await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 120000 });
        werte.push(Date.now() - t0);
        await ctx.close();
    }
    const bestes = Math.min(...werte);
    assert(bestes < 3500, `Neues Spiel ist bedienbar nach ${bestes} ms (Läufe ${werte.join(', ')} ms; Obergrenze 3500 ms, gemessen 2200-2400 ms bei der Standalone-Datei)`);
}

module.exports = {
    testStructuralSelfTest,
    testSaveLoad,
    testMatchSimulationStability,
    testEconomy,
    testSquadAndTactics,
    testAllScreensRender,
    testOldSaveMigration,
    testNoNativeDialogs,
    testLoadingGuard,
    testRuntimeRoundTrip,
    testCodeIntegrity,
    testNoWriteOnlyGameFields,
    testOnboarding,
    testCompactSave,
    testStartzeit,
};
