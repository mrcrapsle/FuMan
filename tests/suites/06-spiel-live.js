// Testsuiten: spiel live
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

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
            out.befolgt = activeLiveShout === 'brechstange' && game.coTrainerTrust === Math.min(100, trust + 1) && game.coTrainerHistory.liveFollowed === 1 && !document.getElementById('live-cotrainer-box').innerHTML.includes('Nein danke');
            // Abstand: sofort danach kein neuer Hinweis
            currentMatch.minute = 75;
            tickCoTrainerLive();
            out.abstand = !document.getElementById('live-cotrainer-box').innerHTML.includes('Nein danke');
            // Stufe 1 kennt keine Karten-Hinweise
            const elf = squad.filter(p => lineup.includes(p.id) && p.pos !== 'TW');
            stand(1, 1); frisch(); currentMatch.minute = 40; game.tackleHardness = 'normal';
            currentMatch.yellowCards[elf[0].id] = 1;
            tickCoTrainerLive();
            out.stufe1OhneKarte = !document.getElementById('live-cotrainer-box').innerHTML.includes('Nein danke');
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
            out.laune = !document.getElementById('live-cotrainer-box').innerHTML.includes('Nein danke');
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
            out.box = box().includes('Kabinenansprache') && box().includes('Keine Überheblichkeit') && box().includes('nichts zu verlieren') && box().includes('zählt nur der Sieg');
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

async function testCupAndLeagueSameDay(browser) {
    console.log('\n[25.24] Pokal und Liga am selben Spieltag: Kalender und Dashboard zeigen den Pokalgegner');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const us = game.clubName;
            // Der Spielplan des Pokaltags gilt in der echten Liga des Vereins (vor dem Umsetzen unten prüfen)
            const echteLiga = game.leagueLevel;
            const fixsEcht = fixturesData[echteLiga][3] || [];
            out.ligaspielVorhanden = fixsEcht.some(f => leaguesData[echteLiga][f.home]?.name === us || leaguesData[echteLiga][f.away]?.name === us);
            // Deterministische Auslosung: Runde 1 am 4. Spieltag mit unserem Verein gegen "Testgegner Pokal"
            game.leagueLevel = 0; game.matchday = 1; game.liveCupResult = null;
            cupTournament.roundsHistory = [{ roundIndex: 0, name: cupTournament.roundNames[0], matchday: 4, prize: 0, completed: false,
                pairings: [{ home: us, away: 'Testgegner Pokal', homeGoals: null, awayGoals: null, penaltyWinner: null, played: false }] }];
            // Der Pokalgegner hat eine Spielstärke (25.25): sie steht im Kalender neben dem Namen
            leaguesData[0].push({ name: 'Testgegner Pokal', strength: 61, played: 0, gf: 0, ga: 0, pts: 0 });
            renderCalendarView();
            const eintraege = [...document.getElementById('cal-schedule-list').children].map(e => e.innerText);
            const tag = n => eintraege.find(t => t.includes('Spieltag ' + n + ' ')) || '';
            out.pokalGegner = tag(4).includes('DFB-Pokal gegen Testgegner Pokal') && tag(4).includes('Ligaspiel');
            out.pokalStaerke = tag(4).includes('Testgegner Pokal (Stärke 61)');
            out.nurLiga = tag(5).includes('Ligaspiel') && !tag(5).includes('DFB-Pokal');
            // Dashboard am Pokaltag: Gegner und Wettbewerb der Pokalpartie
            game.matchday = 4;
            renderDashboardView();
            out.dashGegner = document.getElementById('dash-opp-name').innerText === 'Testgegner Pokal';
            out.dashTitel = document.getElementById('dash-league-name').innerText.includes('DFB-Pokal');
            // Champions-Cup-Spieltag: eigener Gruppenstand im Kalender
            europeTournament.groupA = [{ name: us, pts: 4, gf: 3, ga: 1 }, { name: 'Gruppe X', pts: 6, gf: 5, ga: 0 },
                { name: 'Gruppe Y', pts: 1, gf: 1, ga: 4 }, { name: 'Gruppe Z', pts: 0, gf: 0, ga: 3 }];
            europeTournament.groupB = [];
            game.matchday = 1; game.leagueLevel = echteLiga;
            renderCalendarView();
            const europaTag = [...document.getElementById('cal-schedule-list').children].map(e => e.innerText).find(t => t.includes('Spieltag 3 ')) || '';
            out.gruppenstand = europaTag.includes('Gruppe A') && europaTag.includes('Platz 2') && europaTag.includes('4 Pkt.');
            europeTournament.groupA = []; 
            // Vorschau vor dem Pokalspiel: Gegner, Stärke und der Hinweis auf das folgende Ligaspiel
            startCupLiveFlow({ comp: 'dfb', titel: '🏆 DFB-Pokal', home: us, away: 'Testgegner Pokal', oppStr: 61, elfmeter: true });
            const vorschau = document.getElementById('prematch-analysis-box')?.innerHTML || '';
            out.vorschauGegner = vorschau.includes('Testgegner Pokal');
            out.vorschauLiga = vorschau.includes('Das Ligaspiel folgt');
            // Englische Kalenderbegriffe (25.24): Pokalgegner und Ligaspiel auf Englisch, danach zurück auf Deutsch
            game.leagueLevel = 0; game.matchday = 1;
            setLanguage('en');
            renderCalendarView();
            const englischTag = [...document.getElementById('cal-schedule-list').children].map(e => e.innerText).find(t => t.includes('Matchday 4 ')) || '';
            out.englisch = englischTag.includes('DFB Cup vs Testgegner Pokal') && englischTag.includes('League match') && !englischTag.includes('Ligaspiel');
            setLanguage('de');
            // Unterklassig: kein DFB-Pokal im Kalender
            game.leagueLevel = echteLiga; game.matchday = 1;
            renderCalendarView();
            out.unterklassig = ![...document.getElementById('cal-schedule-list').children].some(e => e.innerText.includes('DFB-Pokal'));
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Kalender und Dashboard ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.pokalGegner, 'Am Pokaltag steht im Kalender Pokal gegen den Gegner UND das Ligaspiel');
        assert(r.pokalStaerke, 'Im Kalender steht die Spielstärke des Pokalgegners');
        assert(r.nurLiga, 'An normalen Spieltagen steht nur das Ligaspiel');
        assert(r.ligaspielVorhanden, 'Die Liga-Partie des Pokaltags ist im Spielplan vorhanden');
        assert(r.dashGegner && r.dashTitel, 'Das Dashboard zeigt am Pokaltag den Pokalgegner und den Wettbewerb');
        assert(r.unterklassig, 'Unterhalb der 3. Liga steht im Kalender kein DFB-Pokal');
        assert(r.englisch, 'Der Kalender zeigt auf Englisch Pokalgegner und League match (ohne deutsche Begriffe)');
        assert(r.gruppenstand, 'Am Champions-Cup-Spieltag steht der eigene Gruppenstand (Gruppe, Platz, Punkte) im Kalender');
        assert(r.vorschauGegner && r.vorschauLiga, 'Die Vorschau vor dem Pokalspiel nennt den Gegner und dass das Ligaspiel direkt folgt');
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
            out.freistossOptionen = document.querySelectorAll('#setpiece-options button[onclick^="standardWaehlen"]').length === 3;   // dazu der Schalter für die Reaktionsspiele
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

// ---------------------------------------------------------------------------
// [42] TAKTIKTAFEL: Taktik-Automatik
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
    // 25.35: fester Zufall vor dem Boot - der Relegationsteil setzt den Verein per Simulation auf einen Tabellenplatz
    // und scheiterte in seltenen Läufen. Schwellen unverändert.
    await page.addInitScript(() => { let seed = 20251010; Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
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
        // Fester Seed: bei 80 Spielen streut der Mittelwert um etwa 0,16 Tore, eine freie Stichprobe riss die Toleranz selten (CI, 2,71 statt 2,08)
        { let seed = 20251012; Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
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
    // Minuten einer Standardsituation zählen nicht als Pressing-Minuten: gemessen 43 bis 81 von 68, daher Untergrenze 25 (0 hieße: nicht gezählt, -1: nicht abgerechnet)
    assert(r.kraftMinuten >= 25, `Pressing-Minuten werden gezählt und nach dem Abpfiff als Fitnessverlust abgerechnet (${r.kraftMinuten})`);
    assert(r.statistik && r.statistikSichtbar && r.abpfiffZeile, 'Statistik (Ballbesitz, Schüsse) passt zum Spiel und wird angezeigt');
    assert(r.vorauswahlFeldspieler, 'Auswechslung: Vorauswahl ist ein Feldspieler, nicht der Torwart');
    assert(r.wechselWirkt && r.wechselTicker, 'Auswechslung ersetzt den gewählten Spieler und ändert die Teamstärke');
    assert(r.nachAbpfiffRuhe, 'Nach dem Abpfiff fallen keine Tore mehr');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testCoTrainerLiveBilanz(browser) {
    console.log('\n[25.25] Co-Trainer im Livespiel: Bilanz mit befolgten Hinweisen gegen ohne');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.coTrainerHistory = { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 };
            recordLiveCoTrainerMatch('win', { coTrainerFollowed: 2 });
            recordLiveCoTrainerMatch('loss', { coTrainerFollowed: 1 });
            recordLiveCoTrainerMatch('win', {});
            recordLiveCoTrainerMatch('draw', null);
            const h = game.coTrainerHistory;
            return { h: { mf: h.liveMatchesFollowed, fw: h.liveFollowedWins, mo: h.liveMatchesOwn, ow: h.liveOwnWins }, text: coTrainerLiveBilanzText(h), leer: coTrainerLiveBilanzText({}) };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.h.mf === 2 && r.h.fw === 1 && r.h.mo === 1 && r.h.ow === 1, `Befolgte Hinweise: 2 Spiele (1 Sieg), ohne: 1 Spiel (1 Sieg), ein Spiel ohne Lauf wird nicht gewertet (${r.crash || JSON.stringify(r.h)})`);
    assert(!r.crash && r.text.includes('1/2 Siege') && r.text.includes('1/1 Siege'), `Die Bilanz steht im Co-Trainer-Bereich (${r.text || r.crash})`);
    assert(!r.crash && r.leer === '', 'Ohne gewertetes Livespiel bleibt die Zeile leer');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Co-Trainer-Bilanz');
    await page.close();
}

async function testHinweisAnzeige(browser) {
    console.log('\n[25.26] Co-Trainer im Livespiel: ohne offenen Hinweis steht da, wie viele es seit Anpfiff gab');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            staffMembers.coTrainer.hired = true;
            lineup = pickBestLineupIds();
            setupMatch(game.clubName, 'Testgegner Live', calcTeamStrength(true), true, false, null);
            stopLiveTickerAutoplay();
            currentMatch.halftimeShown = true;
            coTrainerActiveHint = null;
            currentMatch.coHintsUsed = [];
            renderCoTrainerLiveBox();
            const null0 = document.getElementById('live-cotrainer-box').innerText;
            currentMatch.coHintsUsed = ['muede'];
            renderCoTrainerLiveBox();
            const eins = document.getElementById('live-cotrainer-box').innerText;
            return { null0, eins };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.null0.includes('Bisher kein Hinweis seit Anpfiff'), `Ohne Hinweis steht im Kasten: noch kein Hinweis (${r.crash || r.null0})`);
    assert(!r.crash && r.eins.includes('Der Co-Trainer hat seit Anpfiff 1 Hinweis gegeben'), `Mit einem Hinweis zählt der Kasten ihn (${r.eins})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Hinweisanzeige');
    await page.close();
}

async function testDruckHinweis(browser) {
    console.log('\n[25.26] Co-Trainer: Hinweis, wenn der Gegner klar mehr Abschlüsse hat');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            staffMembers.coTrainer.hired = true;
            lineup = pickBestLineupIds();
            setupMatch(game.clubName, 'Testgegner Live', calcTeamStrength(true), true, false, null);
            stopLiveTickerAutoplay();
            currentMatch.halftimeShown = true;
            currentMatch.minute = 62;
            coTrainerActiveHint = null;
            currentMatch.coHintsUsed = [];
            activeLiveShout = 'standard';
            currentMatch.stats = currentMatch.stats || {};
            currentMatch.stats.shots = [1, 6];
            const a = findCoTrainerHint();
            currentMatch.stats.shots = [4, 5];
            const b = findCoTrainerHint();
            return { mit: a && a.id, ohne: b && b.id };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.mit === 'druck', `Bei 1:6 Abschlüssen nach der 60. Minute kommt der Hinweis „druck“ (${r.crash || r.mit})`);
    assert(!r.crash && r.ohne !== 'druck', 'Bei 4:5 Abschlüssen kommt kein Dominanz-Hinweis');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Dominanz-Hinweis');
    await page.close();
}

module.exports = {
    testOpponentTactics,
    testDerbyWeek,
    testCoTrainerLive,
    testPregameTalk,
    testMatchPrep,
    testRefereeCritique,
    testCupAndLeagueSameDay,
    testLocalDerbies,
    testSetPieces,
    testCupFinal,
    testTacticAutomation,
    testTacticRecords,
    testCupLive,
    testLiveMatchEngine,
    testCoTrainerLiveBilanz,
    testHinweisAnzeige,
    testDruckHinweis,
};
