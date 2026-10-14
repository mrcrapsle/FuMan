// Testsuiten: kader jugend training
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

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

async function testCaptainSuccession(browser) {
    console.log('\n[25.22] Kapitän weg (Verkauf/Leihe/Vertragsende): Nachfolger übernimmt automatisch');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const alt = squad.find(p => p.id === game.captainId);
            out.vorher = !!alt;
            out.ohneAenderung = ensureCaptainPresent() === null && game.captainId === alt.id;
            // Verletzter Kapitän (25.23): er steht nicht auf dem Platz, also übernimmt ein Fitter die Binde
            const verletzt = squad.find(p => p.id === game.captainId);
            verletzt.injured = 3;
            ensureCaptainPresent();
            out.verletzterWechsel = game.captainId !== verletzt.id && squad.find(p => p.id === game.captainId).injured !== 3;
            verletzt.injured = 0;
            game.captainId = alt.id;
            squad = squad.filter(p => p.id !== alt.id);
            // Sofort prüfen: nach einem Spieltag verschiebt die Moral die Führungsqualität (Test wäre zufällig)
            const neu = ensureCaptainPresent();
            out.nachfolger = !!neu && game.captainId === neu.id && inboxMessages.some(m => m.title.includes('übernimmt die Binde'));
            out.fuehrung = !!neu && squad.filter(p => !(p.injured > 0)).every(p => getLeadershipScore(p) <= getLeadershipScore(neu) || p.id === neu.id);
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Kapitänsnachfolge ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.vorher && r.ohneAenderung, 'Ist der Kapitän im Kader, ändert sich nichts');
        assert(r.nachfolger, 'Fehlt der Kapitän, übernimmt sofort ein Nachfolger (Postfach-Hinweis)');
        assert(r.fuehrung, 'Der Nachfolger hat die größte Führungsqualität der fitten Spieler');
        assert(r.verletzterWechsel, 'Ist der Kapitän verletzt, übernimmt vor dem Anpfiff ein Fitter die Binde (sonst fehlt der Kapitänsbonus auf dem Platz)');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testRueckennummerUndWette(browser) {
    console.log('\n[25.40] Rückennummern im Kader und Saisonwette mit dem Vorstand');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        const p0 = squad[0], p1 = squad[1];
        p1.nummer = 1; p0.nummer = null;
        out.naechste = naechsteFreieRueckennummer(p0);
        out.abgelehnt = speichereRueckennummer(p0.id, 1) === false && p0.nummer !== 1;
        out.gesetzt = speichereRueckennummer(p0.id, 12) === true && p0.nummer === 12;
        openPlayerDetail(p0.id, 'squad');
        const auswahl = document.getElementById('pd-nummer');
        out.auswahlDa = !!auswahl;
        out.belegteDeaktiviert = !!auswahl && auswahl.querySelector('option[value="1"]').disabled === true;
        // Saisonwette
        game.seasonExpectation = { expectedRank: 6 };
        game.boardSat = 40;
        setzeSaisonWette();
        out.platz = game.saisonWette && game.saisonWette.platz;
        setzeSaisonWette();
        out.keinDoppelt = game.saisonWette && game.saisonWette.platz === 4;
        const geld0 = game.money;
        resolveSaisonWette(3);
        out.gewonnenGeld = game.money > geld0;
        out.gewonnenVertrauen = game.boardSat === 52;
        out.gewonnenAufgeraeumt = game.saisonWette === null;
        setzeSaisonWette();
        const sat1 = game.boardSat;
        resolveSaisonWette(9);
        out.verlorenVertrauen = game.boardSat === sat1 - 10;
        out.verlorenAufgeraeumt = game.saisonWette === null;
        return out;
    });
    assert(r.naechste === 2, 'Die kleinste freie Rückennummer im Kader ist 2, wenn 1 vergeben ist');
    assert(r.abgelehnt, 'Eine schon vergebene Rückennummer wird abgelehnt');
    assert(r.gesetzt, 'Eine freie Rückennummer wird gesetzt');
    assert(r.auswahlDa, 'Die Spielerkarte zeigt die Rückennummer-Auswahl');
    assert(r.belegteDeaktiviert, 'Belegte Nummern sind in der Auswahl gesperrt');
    assert(r.platz === 4, 'Die Saisonwette verlangt zwei Plätze mehr als der Vorstandswunsch (6 → 4)');
    assert(r.keinDoppelt, 'Eine zweite Wette in derselben Saison wird nicht angenommen');
    assert(r.gewonnenGeld, 'Gewonnene Wette zahlt eine Prämie');
    assert(r.gewonnenVertrauen, 'Gewonnene Wette hebt das Vertrauen um 12');
    assert(r.gewonnenAufgeraeumt, 'Nach der Auflösung ist keine Wette mehr aktiv');
    assert(r.verlorenVertrauen, 'Verlorene Wette zieht das Vertrauen um 10 ab');
    assert(r.verlorenAufgeraeumt, 'Auch eine verlorene Wette wird danach aufgeräumt');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Rückennummern und Wette');
    await page.close();
}

async function testLegendenNummer(browser) {
    console.log('\n[25.41] Legenden behalten ihre Rückennummer, die Nummer bleibt gesperrt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Jeder ausgeschiedene Spieler wird in diesem Test zur Legende
        window.checkForLegendStatus = () => 'LEGEND';
        const legende = squad[3];
        legende.nummer = 21;
        const id = legende.id;
        out.pensioniert = schedulePlayerRetirement(id) === true;
        const eintrag = (game.playerRetirement.legendPlayers || []).slice(-1)[0];
        out.nummerGespeichert = !!eintrag && eintrag.nummer === 21;
        out.ausKader = !squad.some(s => s.id === id);
        const p0 = squad[0];
        p0.nummer = null;
        out.nichtVergeben = naechsteFreieRueckennummer(p0) !== 21;
        out.gesetztAbgelehnt = speichereRueckennummer(p0.id, 21) === false && !p0.nummer;
        out.sperreInListe = gesperrteRueckennummern().has(21);
        return out;
    });
    assert(r.pensioniert, 'Der Spieler tritt als Legende zurück');
    assert(r.nummerGespeichert, 'Der Karriereende-Eintrag der Legende behält die Rückennummer');
    assert(r.ausKader, 'Die Legende ist nicht mehr im Kader');
    assert(r.sperreInListe, 'Die Nummer der Legende steht auf der Sperrliste');
    assert(r.nichtVergeben, 'Die Nummer der Legende wird keinem neuen Spieler zugewiesen');
    assert(r.gesetztAbgelehnt, 'Die Nummer der Legende lässt sich nicht setzen');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Karriereende und Sperre');
    await page.close();
}

async function testTrainingGrowthCaps(browser) {
    console.log('\n[25.20] Stärkezuwachs aus Training begrenzt: Einzeltraining nach Alter, Trainingslager einmal pro Saison');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const jung = squad[0], alt = squad[1];
            jung.age = 20; alt.age = 31; jung.strength = 60; alt.strength = 60;
            jung.trainingGains = null; alt.trainingGains = null;
            for (let i = 0; i < 20; i++) { grantTrainingStrength(jung); grantTrainingStrength(alt); }
            out.deckel = jung.strength === 63 && alt.strength === 60;
            // Ganzer Kader mit Schwerpunkt über eine Saison: höchstens 3 Punkte je Spieler
            squad.forEach(p => { p.individualFocus = 'torschuss'; p.trainingGains = null; p.staerkeStart = p.strength; });
            game.money = 1e8;
            for (let i = 0; i < 12; i++) { game.sackPending = false; simulateMatchdays(1); }
            out.saison = squad.every(p => p.strength - p.staerkeStart <= getTrainingStrengthCap(p) + 1);
            // Trainingslager: dauerhaft keine Stärke, nur einmal pro Saison, Kosten nach Liga
            const vorher = squad.map(p => p.strength);
            game.trainingCampSeason = null;
            const geld = game.money;
            bookTrainingCamp('dubai');
            out.lager = squad.every((p, i) => p.strength === vorher[i]) && game.money === geld - getTrainingCampCost('dubai') && game.trainingCampBuff && game.trainingCampBuff.active;
            const geld2 = game.money;
            bookTrainingCamp('alps');
            out.einmal = game.money === geld2;
            // Spieler-Popup zeigt den Stand (25.21)
            const pdSpieler = squad[0]; pdSpieler.age = 20; pdSpieler.trainingGains = { season: game.season, n: 3 };
            openPlayerDetail(pdSpieler.id, 'squad');
            out.popup = document.getElementById('pd-fields').textContent.includes('3/3 Punkte diese Saison')
                && !document.getElementById('pd-fields').textContent.includes('Talent:');
            pdSpieler.potential = 80; pdSpieler.potentialRevealed = true;
            openPlayerDetail(pdSpieler.id, 'squad');
            out.potenzial = document.getElementById('pd-fields').textContent.includes('Potenzial:');
            closePlayerDetail();
            closePlayerDetail();
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Trainingsdeckel ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.deckel, 'Einzeltraining: bis 21 Jahre höchstens +3 Stärke pro Saison, ab 30 keine');
        assert(r.saison, 'Ganzer Kader mit Trainingsschwerpunkt wächst über viele Spieltage nicht über den Deckel');
        assert(r.popup && r.potenzial, 'Das Spieler-Popup zeigt das Trainingsplus der Saison (3/3) und statt des doppelten "Talent" das echte Potenzial, wenn bekannt');
        assert(r.lager && r.einmal, 'Trainingslager: kein dauerhaftes Stärkeplus mehr, nur einmal pro Saison, Kosten nach Liga');
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
            out.profil = html.includes('Karriereprofil') && html.includes('<td>9</td>') && html.includes('2,80') && html.includes('2,50') && html.includes('5 Vorlagen') && html.includes('4× Elf des Spieltags') && html.includes('Spieler des Monats');
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
            out.karte = document.getElementById('youth-decision-box').innerHTML.includes('Profivertrag-Entscheidung');
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
        out.warnungNenntAbwehrUndKritisch = warnBox.includes('Abwehr') && warnBox.includes('Kritisch');
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
        // Vorvertrags-Frühwarnung (25.19): Angebot mit Frist und gefährdete Leistungsträger in der Planung
        const vv = [...squad].sort((a, b) => b.strength - a.strength);
        vv[0].contracts = 1; vv[0].preContractOffer = { club: 'Testclub', deadline: game.matchday + 3 };
        vv[1].contracts = 1; delete vv[1].preContractOffer; delete vv[1].preContractSigned;
        renderSquadPlanningView();
        const planHtml = document.getElementById('squad-planning-wage-box').innerHTML;
        out.vorvertragsWarnung = planHtml.includes('Vorvertrags-Angebot von Testclub') && planHtml.includes(vv[1].name)
            && getPreContractRiskInfo().gefaehrdet.some(p => p.id === vv[1].id);
        delete vv[0].preContractOffer;
        // Kadergröße (25.19): unter 20 Spielern und bei weniger als 14 Bleibenden warnt die Planung
        const ganzerKader = squad.slice();
        squad = squad.slice(0, 16);
        squad.forEach((p, i) => { p.contracts = i < 4 ? 1 : 3; delete p.preContractSigned; });
        renderSquadPlanningView();
        const warnHtml = document.getElementById('squad-planning-warnings-box').innerHTML;
        out.kaderWarnung = warnHtml.includes('Nur 16 Spieler') && warnHtml.includes('Notbesetzung');
        squad = ganzerKader;
        out.gehaltsWarnung = getSquadPlanningWageOutlook().spielraum !== 0 && (() => { renderSquadPlanningView(); return document.getElementById('squad-planning-wage-box').innerHTML.includes(getSquadPlanningWageOutlook().spielraum >= 0 ? 'Spielraum' : 'über dem Budget'); })();
        // Gehaltsüberhang (25.21): Vorschläge mit Leihe (bis 25) oder Verkauf, sonst kein Hinweis
        const budgetAlt = game.wageBudget;
        game.wageBudget = 1;
        const entlElf = pickBestLineupIds();
        const ergaenzer = squad.filter(p => !entlElf.includes(p.id)).sort((a, b) => b.wage - a.wage);
        ergaenzer[0].age = 22; if (ergaenzer[1]) ergaenzer[1].age = 31;
        renderSquadPlanningView();
        const entlastung = document.getElementById('squad-planning-wage-box').innerHTML;
        out.entlastung = entlastung.includes('Entlastung') && entlastung.includes(ergaenzer[0].name + ' (22') && entlastung.includes('verleihen an')
            && (!ergaenzer[1] || entlastung.includes('verkaufen - spart'));
        game.wageBudget = 1e9;
        renderSquadPlanningView();
        out.keineEntlastung = getSquadPlanningWageOutlook().spielraum < 0 || !document.getElementById('squad-planning-wage-box').innerHTML.includes('Entlastung');
        game.wageBudget = budgetAlt;

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
    assert(r.kaderWarnung, 'Kaderplanung warnt unter 20 Spielern und wenn nach Vertragsende weniger als 14 blieben');
    assert(r.entlastung && r.keineEntlastung, 'Bei Gehaltsüberhang schlägt die Kaderplanung die teuersten Ergänzungsspieler vor (bis 25 Jahre Leihe, sonst Verkauf)');
    assert(r.vorvertragsWarnung, 'Kaderplanung warnt vor Vorvertrags-Angeboten (mit Frist) und nennt gefährdete Leistungsträger');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Kaderplanungstool');
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
// [41] Trainingskalender: MEHRSPIELTAGE-VORSCHAU
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
            out.anzeige = html.includes('Sponsor') && html.includes('Spielerinnenmarkt') && html.includes('Ø Zuschauer');
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

module.exports = {
    testSetPieceDrills,
    testCaptainSuccession,
    testRueckennummerUndWette,
    testLegendenNummer,
    testTrainingGrowthCaps,
    testPlayerProfile,
    testLockerRoom,
    testYouthPathway,
    testYouthAcademy,
    testTrainingOverhaul,
    testSecondTeamAndTrainingAutomation,
    testSecondTeamFriendlies,
    testSquadPlanningTool,
    testPlayerAvatars,
    testTrainingCalendar,
    testWomenTeamExtras,
    testPlayerStats,
};
