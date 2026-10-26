// Testsuiten: liga wettbewerbe
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

// ---------------------------------------------------------------------------
// [6] Jugendakademie
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
            // Fester Zufall: Verletzungen während der Saison entscheiden, ob eine Pause ausfällt (sonst wackelt der Test)
            const zufallVorher = Math.random;
            let saat = 42;
            Math.random = () => { saat = (saat * 16807) % 2147483647; return saat / 2147483647; };
            try { simulateFullSeason(); } finally { window.tickInternationalBreak = originalPause; Math.random = zufallVorher; }
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

async function testCareerScenarios(browser) {
    console.log('\n[19.4] Karriere-Szenarien: Start über den Neues-Spiel-Dialog, Ziele und Sterne');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    // Start über den Dialog (mit Neuladen wie im echten Spiel)
    await page.evaluate(() => { closeTutorial(); startNewGame(); selectNewGameScenario('absteiger'); });
    const dialog = await page.evaluate(() => document.getElementById('new-game-scenario-btns').innerHTML);
    await Promise.all([page.waitForNavigation(), page.evaluate(() => confirmNewGameWithSettings(null))]);
    await page.waitForFunction(() => !document.getElementById('app-loading') && typeof game !== 'undefined', null, { timeout: 20000 }).catch(() => null);
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
    await page.waitForFunction(() => !document.getElementById('app-loading') && typeof game !== 'undefined', null, { timeout: 20000 }).catch(() => null);
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
            // Gruppenphase (25.20): jedes Team spielt dreimal zu Hause, Livespiel und Simulation gleich
            const heim = {};
            [0, 1, 2, 3, 4, 5].forEach(gi => getEuropeGroupPairings(europeTournament.groupA, gi).forEach(([h]) => { heim[h.name] = (heim[h.name] || 0) + 1; }));
            out.heimrecht = europeTournament.groupA.every(t => heim[t.name] === 3);
            // Livespiel und Simulation nehmen dieselbe Paarung (25.23): jede eigene Gruppenpartie stimmt überein
            game.inEurope = true;
            const passt = [3, 7, 11, 15, 19, 23].every((md, gi) => {
                const live = getOwnEuropeFixture(md);
                if (!live) return true;
                const eigene = [europeTournament.groupA, europeTournament.groupB].map(g => getEuropeGroupPairings(g, gi))
                    .flat().find(([h, a]) => h.name === live.home && a.name === live.away);
                return !!eigene;
            });
            out.liveWieSim = passt;
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
        assert(r.heimrecht, 'Gruppenphase: jedes Team hat drei Heimspiele (vorher Topf 1 sechs, Topf 4 keins)');
        assert(r.liveWieSim, 'Das Livespiel spielt dieselben Gruppenpaarungen (Heim/Gast) wie die Simulation');
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
            // Rücklagen: nur was über einer halben Saison Gehälter (mindestens halbes Budget) liegt, wird freigegeben
            const lohnVorher = squad.map(p => p.wage);
            squad.forEach(p => { p.wage = Math.round(400000 / squad.length); });
            game.wageBudget = 1000000;
            game.money = 8000000;
            const knapp = getCashSurplusBudgetShare();
            game.money = 28500000;
            const reich = getCashSurplusBudgetShare();
            out.ruecklagen = knapp.transfer === 0 && knapp.wage === 0 && reich.transfer === 8000000 && reich.wage === Math.round(2000000 / 34 / 1000) * 1000;
            // Teurer Kader: die Reserve folgt den echten Gehältern
            squad.forEach(p => { p.wage = Math.round(1000000 / squad.length); });
            out.ruecklagenTeuer = getCashSurplusBudgetShare().transfer < reich.transfer;
            squad.forEach((p, i) => { p.wage = lohnVorher[i]; });
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
            out.gehaltsBoden = boden >= summe * 1.04 && verlust >= summe && verlust <= boden && knappeKasse >= summe * 1.04
                && out.gehaltsBodenWerte.minus >= summe && out.gehaltsBodenWerte.minus <= summe + 1000;
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
            // 25.19: ab dem 1,5-fachen Liga-Gehaltsbudget eingefroren (kein Zuschlag, keine Erhöhungen)
            const loehneVorher = squad.map(p => p.wage);
            const faktor = Math.ceil(getLeagueWageBudget(game.leagueLevel) * WAGE_FLOOR_GROWTH_CAP / Math.max(1, squad.reduce((a, p) => a + p.wage, 0))) + 1;
            squad.forEach(p => { p.wage *= faktor; });
            const grosseSumme = squad.reduce((a, p) => a + p.wage, 0);
            const geldVorDeckel = game.money;
            game.money = grosseSumme * 5;
            out.deckelEingefroren = getWageBudgetFloor() === Math.ceil(grosseSumme / 1000) * 1000;
            // Budget-Forderung beim Vorstand skaliert mit der Liga (25.20)
            const ligaAlt = game.leagueLevel;
            game.leagueLevel = 0; const askBl = getBoardBudgetAsk('wage');
            game.leagueLevel = 5; const askL6 = getBoardBudgetAsk('wage');
            game.leagueLevel = ligaAlt;
            out.forderungNachLiga = askBl === Math.round(getLeagueWageBudget(0) * 0.05 / 1000) * 1000 && askL6 < askBl && askL6 <= getLeagueWageBudget(5) * 0.2;
            game.money = geldVorDeckel;
            squad.forEach((p, i) => { p.wage = loehneVorher[i]; });
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
        assert(r.ruecklagen && r.ruecklagenTeuer && r.freigabe, 'Der Vorstand gibt Rücklagen über der Reserve (halbe Saison der echten Gehälter, mindestens halbes Budget) als Transfer- und Gehaltsbudget frei');
        assert(r.gehaltsBoden, `Gehaltsbudget deckt laufende Gehälter plus Erhöhungen (+5 % nur ohne Verlustsaison, mit Minus auf dem Konto eingefroren) (${JSON.stringify(r.gehaltsBodenWerte)})`);
        assert(r.forderungNachLiga, 'Budget-Forderung beim Vorstand richtet sich nach der Liga (5 % des Liga-Gehaltsbudgets)');
        assert(r.deckelEingefroren, 'Ab dem 1,5-fachen Liga-Gehaltsbudget friert die Untergrenze die Gehälter ein');
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
            // Lizenz unter Auflagen (25.20): ein laufender Internat-Ausbau zählt, die Reserve nicht
            const ligaVorher = game.leagueLevel, internatVorher = campusBuildings.internat.lvl, queueVorher = game.stadiumConstructionQueue;
            game.leagueLevel = 1; campusBuildings.internat.lvl = 1; game.stadiumConstructionQueue = [];
            const ohneBau = checkDfbLicensingStatus();
            game.stadiumConstructionQueue = [{ type: 'campusBuilding', params: { key: 'internat' }, daysLeft: 12, totalDays: 12 }];
            const mitBau = checkDfbLicensingStatus();
            out.auflagen = ohneBau.missing.some(m => m.includes('Jugendinternat')) && !mitBau.missing.some(m => m.includes('Jugendinternat'))
                && mitBau.auflagen.some(a => a.includes('Jugendinternat') && a.includes('im Bau'));
            game.leagueLevel = ligaVorher; campusBuildings.internat.lvl = internatVorher; game.stadiumConstructionQueue = queueVorher;
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
    assert(r.auflagen, 'Lizenz unter Auflagen: ein laufender Internat-Ausbau zählt für die DFB-Lizenz (die Nachfrist ist kürzer als jede Bauzeit)');
        assert(r.aufgestiegen && r.inNeuerTabelle && r.groessen, 'Nachträglicher Aufstieg: der Verein spielt wirklich in der neuen Liga (vorher nur leagueLevel umgestellt)');
    assert(r.praemie && r.spieltWeiter, 'Nachträglicher Aufstieg bringt die Aufstiegsprämie, die Saison läuft dort weiter');
    assert(r.altlasten && r.monat, 'Altlasten alter Spielstände werden beim Laden entfernt, Monats-Ticks gebündelt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// [12] LEBENDE LIGA, Vereinsidentität & TRANSFERMARKT-ANBINDUNG
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
        // Schonfrist nach dem Wechsel (25.23): auch außerhalb von Saison 1 keine Entlassung in der Wechselsaison
        game.season = 5;
        game.boardSat = 15; game.buybackOptions = [{ id: 'x' }];
        game.rumors = [{ type: 'abwerbung', playerId: squad[0].id }, { type: 'markt', playerId: 'm1' }];
        let switchOk = switchToClub(target.name);
        out.altlasten = game.boardSat === 60 && game.buybackOptions.length === 0 && game.rumors.length === 1
            && game.secondTeam.name === target.name + ' II' && game.seasonExpectation.expectedRank >= 1;
        game.boardSat = 10; game.lowBoardSatStreak = 99; game.boardSatVerlauf = []; game.sackPending = false;
        checkSeasonEndSacking(18);
        out.schonfrist = game.sackPending === false;
        game.season = 6;
        checkSeasonEndSacking(18);
        out.danach = game.sackPending === true;
        game.sackPending = false; game.lowBoardSatStreak = 0;
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
    assert(r.altlasten, 'Vereinswechsel: neuer Vorstand (60), neues Saisonziel, zweite Mannschaft heißt "<Neu> II", Rückkaufoptionen und Abwerbe-Gerüchte des alten Vereins verfallen');
    assert(r.schonfrist && r.danach, 'Nach einem Vereinswechsel gilt die Schonfrist für die Wechselsaison (Entlassung erst in der Folgesaison möglich)');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Umbenennung/Vereinswechsel');
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

async function testEuropeanCup(browser) {
    console.log('\n[31] Europapokal: erreichbares Teilnehmerfeld und Startprämie');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    // 25.35: fester Zufall schon vor dem Boot (Ligen, Teams, Spielverlauf) - sonst fiel die Gruppe in seltenen Läufen
    // auf 0 Punkte. Schwellen unverändert.
    await page.addInitScript(() => { let seed = 20251010; Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);

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
        // Fester Zufallsstrom für diese Saison: ohne Seed fiel die Gruppe in seltenen Läufen auf 0 Punkte
        const alterZufall = Math.random;
        let seed = 20251010;
        Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        try {
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
        } finally {
            Math.random = alterZufall;
        }
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

async function testEuropaGruppenPlatz(browser) {
    console.log('\n[25.25] Champions Cup: Gruppentabelle mit Platz, die beiden Ersten sind hervorgehoben');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const us = game.clubName;
            europeTournament.groupA = [
                { name: 'Gruppe Z', played: 2, gf: 0, ga: 3, pts: 0 },
                { name: us, played: 2, gf: 3, ga: 1, pts: 4 },
                { name: 'Gruppe X', played: 2, gf: 5, ga: 0, pts: 6 },
                { name: 'Gruppe Y', played: 2, gf: 1, ga: 4, pts: 1 }];
            europeTournament.groupB = [];
            renderEuropeView();
            const tabelle = document.getElementById('europe-group-a-body').closest('table');
            return {
                kopf: tabelle.querySelector('th').innerText,
                zeilen: [...tabelle.querySelectorAll('tbody tr')].map(tr => [tr.children[0].innerText, tr.children[1].innerText]),
                verein: us
            };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.kopf === 'Pl', `Die Gruppentabelle hat eine Platz-Spalte (${r.kopf || r.crash})`);
    assert(!r.crash && r.zeilen[0] && r.zeilen[0][0] === '1' && r.zeilen[0][1] === 'Gruppe X' && r.zeilen[1][0] === '2' && r.zeilen[1][1] === r.verein, 'Die Tabelle ist nach Punkten sortiert, Platz 1 und 2 stehen oben');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Gruppentabelle');
    await page.close();
}

module.exports = {
    testNationalTeam,
    testCareerScenarios,
    testScenarioBalance,
    testHomeRegion,
    testEuropeDraw,
    testCleanupNine,
    testBundesligaLongRun,
    testSeasonPreview,
    testCleanupPart8,
    testLivingLeaguePersistence,
    testClubRenameAndSwitch,
    testLeagueStats,
    testEuropeanCup,
    testClubAndPlayerNames,
    testLandesPokal,
    testLongRun,
    testSeasonEvents,
    testAiClubs,
    testEuropaGruppenPlatz,
};
