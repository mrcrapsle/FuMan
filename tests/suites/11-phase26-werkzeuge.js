// Testsuiten: phase26 werkzeuge
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testSpielvorbereitung(browser) {
    console.log('\n[26.1] Spielvorbereitung: Aufstellungs- und Taktikvorlagen, Spieltag-Check');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        showScreen('screen-squad'); renderSquadView();
        out.slots = document.querySelectorAll('#lineup-presets-box .player-card').length;
        autoLineup();
        document.getElementById('lineup-preset-name').value = 'Heim <b>A</b>';
        saveLineupPreset(0);
        const v = game.lineupPresets[0];
        out.gespeichert = !!v && v.ids.length === 11 && v.name === 'Heim <b>A</b>' && v.formation === game.formation;
        out.nameEscaped = document.getElementById('lineup-presets-box').innerHTML.includes('Heim &lt;b&gt;A&lt;/b&gt;');
        // Ausfall: ein Spieler der Vorlage ist verletzt -> Ersatz auf demselben Platz
        const ausId = lineup[3]; const aus = squad.find(p => p.id === ausId); aus.injured = 3;
        loadLineupPreset(0);
        out.ersatz = lineup.length === 11 && !lineup.includes(ausId) && lineup.every(id => { const p = squad.find(x => x.id === id); return p && !p.injured && !p.suspended; });
        out.ersatzPos = (() => { const neu = squad.find(p => p.id === lineup[3]); return neu && neu.pos === aus.pos; })();
        aus.injured = 0;
        deleteLineupPreset(0); out.geloescht = game.lineupPresets[0] === null;
        // Taktikvorlagen
        setTacticStyle('offensiv'); setTackleHardness('hart');
        document.getElementById('tactic-preset-name').value = 'Alles nach vorn';
        saveTacticPreset(0);
        setTacticStyle('defensiv'); setTackleHardness('vorsichtig');
        applyTacticPreset(0);
        out.taktik = game.tacticStyle === 'offensiv' && game.tackleHardness === 'hart';
        // Alte Spielstände ohne Vorlagen
        delete game.lineupPresets; delete game.tacticPresets; ensureMatchPrepState();
        out.altesFeld = game.lineupPresets.length === 5 && game.tacticPresets.length === 5;
        setTacticStyle('offensiv'); setTackleHardness('hart'); saveTacticPreset(0);
        return out;
    });
    const live = await page.evaluate(() => {
        const out = {};
        startMatchdayFlow();
        out.checkBox = document.getElementById('prematch-check-box').textContent.includes('Spieltag-Check');
        skipPressAndPlay(); stopLiveTickerAutoplay();
        game.tacticStyle = 'defensiv'; game.tackleHardness = 'vorsichtig'; renderLiveTacticsPanel();
        out.liveKnopf = document.querySelectorAll('#live-tactic-presets button').length;
        applyTacticPreset(0);
        out.liveTaktik = game.tacticStyle === 'offensiv' && game.tackleHardness === 'hart' && document.getElementById('ticker-log').textContent.includes('live');
        return out;
    });
    const check = await page.evaluate(() => {
        const out = {};
        currentMatch = null; showScreen('screen-dashboard');
        autoLineup();
        const stamm = squad.find(p => p.id === lineup.find(id => squad.find(x => x.id === id).pos !== 'TW'));
        stamm.fitness = 40;
        let bank = squad.find(p => !lineup.includes(p.id) && p.pos === stamm.pos && !p.injured && !p.suspended);
        if (!bank) { bank = squad.find(p => !lineup.includes(p.id) && !p.injured && !p.suspended); bank.pos = stamm.pos; }
        bank.fitness = 100; bank.strength = stamm.strength;
        const vor = getRotationSuggestions().find(x => x.raus.id === stamm.id);
        out.rotation = !!vor && !!vor.rein;
        if (vor) { applyRotationSwap(stamm.id, vor.rein.id); out.getauscht = lineup.includes(vor.rein.id) && !lineup.includes(stamm.id); }
        // Fehlende: Verletzter und Gesperrter mit Rückkehr
        const a = squad[2], b = squad[5]; a.injured = 4; b.suspended = 2;
        const fehlt = getAbsentPlayers();
        out.fehlt = fehlt.length >= 2 && fehlt.some(x => x.p.id === a.id && x.grund === 'verletzt' && x.tage === 4) && fehlt.some(x => x.p.id === b.id && x.grund === 'gesperrt' && x.tage === 2);
        // Aufstellungs-Check: ohne Torwart und mit Verletztem in der Elf
        lineup = lineup.filter(id => squad.find(p => p.id === id).pos !== 'TW');
        lineup.push(a.id);
        const probleme = getLineupProblems().map(x => x.text).join(' | ');
        out.problemTw = probleme.includes('Kein Torwart');
        out.problemVerletzt = probleme.includes(a.name);
        out.problemAnzahl = probleme.includes('Startelf');
        renderPrematchCheck();
        out.box = document.getElementById('prematch-check-box').textContent.includes('Rotations-Assistent') && document.getElementById('prematch-check-box').textContent.includes('Wer fehlt?');
        return out;
    });
    assert(r.slots === 5, `Fünf Slots für Aufstellungsvorlagen (${r.slots})`);
    assert(r.gespeichert && r.nameEscaped, 'Vorlage speichert Elf, Formation und Namen (Name wird maskiert)');
    assert(r.ersatz && r.ersatzPos, 'Beim Laden wird ein Ausfall auf demselben Platz durch einen Spieler derselben Position ersetzt');
    assert(r.geloescht, 'Vorlage lässt sich löschen');
    assert(r.taktik, 'Taktikvorlage stellt Stil und Zweikampfhärte wieder her');
    assert(r.altesFeld, 'Alte Spielstände ohne Vorlagenfelder werden ergänzt');
    assert(live.checkBox, 'Der Spieltag-Check erscheint vor dem Anpfiff');
    assert(live.liveKnopf >= 1 && live.liveTaktik, `Im Livespiel lässt sich eine Taktikvorlage übernehmen (${JSON.stringify(live)})`);
    assert(check.rotation && check.getauscht, `Rotations-Assistent schlägt den frischeren Spieler vor und tauscht ihn (${JSON.stringify(check)})`);
    assert(check.fehlt, 'Wer fehlt? zeigt Verletzte und Gesperrte mit Rückkehr');
    assert(check.problemTw && check.problemVerletzt && check.problemAnzahl, `Aufstellungs-Check findet fehlenden Torwart, Verletzten in der Elf und falsche Elfanzahl (${JSON.stringify(check)})`);
    assert(check.box, 'Der Spieltag-Check zeigt alle drei Bereiche');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testVertragsWerkzeuge(browser) {
    console.log('\n[26.2] Vertrags- und Transfer-Werkzeuge: Gehalts-Ampel, Verlängerungs-Assistent, Marktwert-Kurve, Transferbilanz, Entwicklungsprognose');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Gehalts-Ampel
        const p = squad[3]; const markt = calculatePlayerWage(p.marketValue, p.strength);
        const text = f => { p.wage = Math.round(markt * f); return getWageRating(p); };
        out.ampel = [text(0.7).ton, text(1.0).ton, text(1.3).ton, text(1.6).ton].join(',');
        p.wage = Math.round(markt * 1.6);
        showScreen('screen-contracts'); renderContractsView();
        out.ampelImKartenChip = document.getElementById('contracts-list').textContent.includes('Überbezahlt');
        p.wage = markt;
        // Verlängerungs-Assistent
        squad.forEach(x => { x.contracts = 4; });
        const a = squad[0], b = squad[1], c = squad[2];
        a.contracts = 1; b.contracts = 0; c.contracts = 1; c.preContractSigned = 'FC Test';
        game.money = 900000000; game.wageBudget = 900000000;
        openRenewalAssistant();
        out.offen = document.getElementById('renewal-assistant-overlay').classList.contains('show');
        out.karten = document.querySelectorAll('#renewal-assistant-content .player-card').length;
        out.gesperrt = [...document.querySelectorAll('#renewal-assistant-content .player-card')].some(k => k.textContent.includes(c.name) && k.textContent.includes('Vorvertrag') && k.querySelector('button.btn-action').disabled);
        const v = getRenewalProposal(a); const geldVor = game.money; const restVor = a.contracts;
        renewWithProposal(a.id);
        out.verlaengert = a.contracts === restVor + v.jahre && a.wage === v.gehalt && game.money === geldVor - v.kosten;
        out.talkFrei = typeof contractTalk === 'undefined' || contractTalk === null;
        // Kasse zu knapp: nichts passiert, kein offenes Gespräch
        game.money = 0; const bVor = b.contracts; renewWithProposal(b.id);
        out.kasse = b.contracts === bVor && (typeof contractTalk === 'undefined' || contractTalk === null);
        closeRenewalAssistant();
        game.money = 900000000;
        // Marktwert-Kurve
        const q = squad[4]; q.strengthHistory = [{ season: 1, strength: q.strength - 6 }, { season: 2, strength: q.strength - 3 }, { season: 3, strength: q.strength }];
        game.season = 3;
        showScreen('screen-squad'); openPlayerDetail(q.id);
        const kurve = document.getElementById('pd-marketcurve');
        out.kurve = kurve.querySelectorAll('circle').length === 3 && kurve.textContent.includes('Marktwert');
        out.kurveWerte = getMarketValueCurve(q).length === 3 && getMarketValueCurve(q)[0].wert <= getMarketValueCurve(q)[2].wert;
        // Entwicklungsprognose
        const jung = squad[5]; jung.age = 20; jung.archetype = 'early-bloomer';
        const alt = squad[6]; alt.age = 34; alt.archetype = 'steady-eddy';
        const fj = getDevelopmentForecast(jung), fa = getDevelopmentForecast(alt);
        out.prognoseJung = fj.ergebnis.length === 3 && fj.ergebnis.every(e => e.tief <= e.hoch) && fj.ergebnis[2].hoch > jung.strength && fj.ergebnis[0].alter === 21;
        out.prognoseAlt = fa.ergebnis[2].tief < alt.strength && fa.ergebnis[2].hoch <= alt.strength;
        openPlayerDetail(jung.id);
        out.prognoseBox = document.getElementById('pd-forecast').textContent.includes('Entwicklungsprognose') && document.getElementById('pd-forecast').querySelectorAll('.ui-chip').length === 3;
        document.querySelectorAll('.generic-modal-overlay.show').forEach(o => o.classList.remove('show'));
        // Transferbilanz je Saison
        game.kontoauszug = [{ season: 3, matchday: 5, label: '🛒 Spielerkauf', amount: -500000, saldo: 0 }, { season: 3, matchday: 9, label: '💰 Spielerverkauf', amount: 800000, saldo: 0 }];
        archiveTransferBilanz(); archiveTransferBilanz();
        const hist = game.transferBilanzHistory;
        out.bilanz = hist.length === 1 && hist[0].season === 3 && hist[0].kauf === 500000 && hist[0].verkauf === 800000 && hist[0].netto === 300000;
        game.kontoauszug = [];
        out.bilanzAnzeige = renderTransferBilanzBox().includes('Frühere Saisons') && renderTransferBilanzBox().includes('Saison 3');
        delete game.transferBilanzHistory; archiveTransferBilanz(); out.altesFeld = Array.isArray(game.transferBilanzHistory);
        return out;
    });
    assert(r.ampel === 'gut,,warn,schlecht', `Gehalts-Ampel: günstig, marktüblich, teuer, überbezahlt (${r.ampel})`);
    assert(r.ampelImKartenChip, 'Die Vertragskarte zeigt die Gehalts-Ampel');
    assert(r.offen && r.karten === 3, `Der Verlängerungs-Assistent listet auslaufende Verträge (${r.karten})`);
    assert(r.gesperrt, 'Wer einen Vorvertrag unterschrieben hat, ist gesperrt, mit Begründung');
    assert(r.verlaengert && r.talkFrei, 'Verlängern zum Angebot: Laufzeit, Gehalt und Handgeld wie im Vorschlag, kein Gespräch bleibt offen');
    assert(r.kasse, 'Bei zu knapper Kasse passiert nichts');
    assert(r.kurve && r.kurveWerte, 'Marktwert-Kurve im Spielerdetail mit einem Punkt je Saison');
    assert(r.prognoseJung && r.prognoseAlt, `Prognose: Junge legen zu, Alte bauen ab (${JSON.stringify([r.prognoseJung, r.prognoseAlt])})`);
    assert(r.prognoseBox, 'Das Spielerdetail zeigt die Entwicklungsprognose mit drei Jahren');
    assert(r.bilanz && r.altesFeld, 'Transferbilanz wird je Saison festgehalten (nur einmal je Saison, alte Spielstände ergänzt)');
    assert(r.bilanzAnzeige, 'Frühere Saisons erscheinen in der Transferbilanz');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testStatistikWerkzeuge(browser) {
    console.log('\n[26.3] Statistik und Information: Serien, Formkurve, CSV, Spielbericht teilen, Fachwort-Hilfe');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Serien: Buchführung
        game.serien = { aktuell: {}, rekord: {} };
        recordOwnLeagueResult(2, 0, true); recordOwnLeagueResult(1, 0, false);
        const a = { ...game.serien.aktuell };
        out.serie1 = a.sieg === 2 && a.unbesiegt === 2 && a.zuNull === 2 && a.heimSieg === 1;
        recordOwnLeagueResult(0, 0, true);
        const b = { ...game.serien.aktuell };
        out.serie2 = b.sieg === 0 && b.unbesiegt === 3 && b.ohneSieg === 1 && b.torlos === 1 && b.heimSieg === 0 && b.zuNull === 3;
        recordOwnLeagueResult(0, 1, true);
        const c = game.serien.aktuell;
        out.serie3 = c.niederlage === 1 && c.unbesiegt === 0 && c.zuNull === 0 && c.torlos === 2 && game.serien.rekord.sieg.n === 2 && game.serien.rekord.unbesiegt.n === 3;
        // Echter Ablauf: die Serien laufen mit den simulierten Ligaspielen
        game.serien = { aktuell: {}, rekord: {} };
        game.sackPending = false; simulateMatchdays(3);
        const n = game.serien.aktuell;
        out.echt = n.sieg + n.ohneSieg > 0 && (n.sieg > 0 || n.ohneSieg >= 1) && Object.keys(game.serien.rekord).length > 0;
        showScreen('screen-squad'); setSquadTab('analyse');
        out.serieAnzeige = document.getElementById('series-tracker-box').textContent.includes('Siegesserie') && document.getElementById('series-tracker-box').textContent.includes('Rekord');
        // Formkurve
        const stamm = squad.find(p => lineup.includes(p.id));
        out.formNoten = Array.isArray(stamm.formNoten) && stamm.formNoten.length >= 1 && stamm.formNoten.length <= 5;
        const t = squad[7]; t.formNoten = []; [3, 3, 3, 3, 3, 2, 2].forEach(x => recordPlayerFormGrade(t, x));
        out.formMax5 = t.formNoten.length === 5 && t.formNoten[4] === 2;
        out.trend = getFormTrend([4, 4, 3, 2, 2]) + '|' + getFormTrend([2, 2, 3, 4, 4]) + '|' + getFormTrend([3, 3, 3, 3, 3]) + '|' + getFormTrend([2, 3]);
        t.formNoten = [4, 4, 3, 2, 2];
        openPlayerDetail(t.id);
        out.formAnzeige = document.getElementById('pd-form').textContent.includes('Formkurve') && document.querySelectorAll('#pd-form .ui-chip').length >= 6;
        // Fachwort-Hilfe
        const ziele = [...document.querySelectorAll('#pd-summary [data-fachwort], #pd-fields [data-fachwort]')];
        out.fachworte = ziele.length >= 6 && ziele.every(el => !!findFachwort(el.dataset.fachwort));
        document.querySelector('#pd-summary [data-fachwort="Moral"]').click();
        const ov = document.getElementById('fachwort-overlay');
        out.fachwortOffen = ov.classList.contains('show') && document.getElementById('fachwort-content').textContent.includes('Moral');
        closeFachwort();
        document.querySelectorAll('.generic-modal-overlay.show').forEach(o => o.classList.remove('show'));
        // CSV
        squad[0].name = 'Max; "Maxi" Test';
        const csv = buildKaderCsv();
        const zeilen = csv.replace(/^\ufeff/, '').trim().split('\r\n');
        out.csvKopf = csv.charCodeAt(0) === 0xFEFF && zeilen[0].startsWith('Name;Position;Alter');
        out.csvZeilen = zeilen.length === squad.length + 1;
        out.csvEscape = csv.includes('"Max; ""Maxi"" Test"');
        const tab = buildTabelleCsv().replace(/^\ufeff/, '').trim().split('\r\n');
        out.csvTabelle = tab.length === leaguesData[game.leagueLevel].length + 1 && tab[1].startsWith('1;');
        exportKaderCsv();
        out.csvToast = document.getElementById('app-toast').innerText.includes('exportiert');
        return out;
    });
    const teilen = await page.evaluate(() => {
        const out = {};
        game.sackPending = false;
        startMatchdayFlow(); skipPressAndPlay(); stopLiveTickerAutoplay();
        out.knopfVorher = document.getElementById('btn-share-match').style.display === 'none';
        simulateRestOfMatch();
        out.knopf = document.getElementById('btn-share-match').style.display !== 'none';
        openShareReport();
        const text = document.getElementById('share-report-text').value;
        out.text = text.includes(game.clubName) && text.includes('Spieltag') && /\d+:\d+/.test(text) && text.includes('Anstoß Mobile Pro');
        out.offen = document.getElementById('share-report-overlay').classList.contains('show');
        copyShareReport();
        closeShareReport();
        return out;
    });
    assert(r.serie1 && r.serie2 && r.serie3, `Serien-Buchführung: Siege, Ungeschlagen, Heimsiege, zu Null, ohne Tor, Niederlagen (${JSON.stringify([r.serie1, r.serie2, r.serie3])})`);
    assert(r.echt && r.serieAnzeige, 'Serien laufen mit den echten Ligaspielen und erscheinen im Reiter Analyse');
    assert(r.formNoten && r.formMax5, 'Je Spieler werden die letzten fünf Noten gemerkt');
    assert(r.trend === 'steigend|fallend|stabil|null', `Formtrend (${r.trend})`);
    assert(r.formAnzeige, 'Das Spielerdetail zeigt die Formkurve mit Noten, Schnitt und Trend');
    assert(r.fachworte && r.fachwortOffen, 'Fachwörter im Spielerdetail öffnen den Lexikon-Eintrag als Fenster');
    assert(r.csvKopf && r.csvZeilen && r.csvEscape, `Kader-CSV: BOM, Kopfzeile, eine Zeile je Spieler, Semikolon und Anführungszeichen maskiert (${JSON.stringify([r.csvKopf, r.csvZeilen, r.csvEscape])})`);
    assert(r.csvTabelle && r.csvToast, 'Tabellen-CSV und Export melden sich');
    assert(teilen.knopfVorher && teilen.knopf, 'Der Teilen-Knopf erscheint erst nach Abpfiff');
    assert(teilen.text && teilen.offen, 'Der Spielbericht enthält Vereine, Ergebnis, Spieltag und Signatur');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testManagerWerkzeuge(browser) {
    console.log('\n[26.4] Manager-Werkzeuge: Liquiditäts-Vorschau, Konto-Alarm, Etiketten, Manager-Assistent, Lizenz-Laufbahn');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Liquiditäts-Vorschau
        game.financeLedger = [];
        game.money = 100000;
        out.leer = getLiquidityForecast().avg === null;
        showScreen('screen-finances'); renderLiquidityBox();
        out.leerText = document.getElementById('fin-liquidity-box').textContent.includes('Noch keine Spieltagsabrechnung');
        game.financeLedger = Array.from({ length: 6 }, (_, i) => ({ season: game.season, matchday: i + 1, heimspiel: i % 2 === 0, summeEin: i % 2 === 0 ? 130000 : 90000, summeAus: 120000 }));
        const f = getLiquidityForecast();
        out.avg = f.avg === -10000 && f.avgHeim === 10000 && f.avgAusw === -30000;
        out.punkte = f.punkte[0].wert === 50000 && f.punkte[1].wert === 0 && f.minusIn === 11;
        renderLiquidityBox();
        out.box = document.getElementById('fin-liquidity-box').textContent.includes('ins Minus') && document.getElementById('fin-liquidity-box').textContent.includes('In 5 Spieltagen');
        // Konto-Alarm
        document.getElementById('konto-alarm-input').value = '';
        setKontoAlarm();
        out.ohneWert = !(financeCentralState.kontoAlarm > 0);
        document.getElementById('konto-alarm-input').value = '60000';
        setKontoAlarm();
        out.gesetzt = financeCentralState.kontoAlarm === 60000;
        game.money = 40000; const n0 = inboxMessages.length;
        checkKontoAlarm(); const n1 = inboxMessages.length; checkKontoAlarm();
        out.alarm = n1 === n0 + 1 && inboxMessages.length === n1 && inboxMessages[0].title.includes('Konto-Alarm') && financeCentralState.kontoAlarmGemeldet;
        game.money = 500000; checkKontoAlarm();
        out.zurueck = financeCentralState.kontoAlarmGemeldet === false;
        game.money = 100000; game.financeLedger.forEach(e => { e.summeEin = 100000; e.summeAus = 130000; });
        const n2 = inboxMessages.length; checkKontoAlarm(); checkKontoAlarm();
        out.vorwarnung = inboxMessages.length === n2 + 1 && inboxMessages[0].title.includes('Vorwarnung');
        clearKontoAlarm();
        out.aus = financeCentralState.kontoAlarm === 0;
        game.financeLedger = [];
        // Etiketten
        showScreen('screen-squad'); setSquadTab('aufstellung');
        const p = squad[3], q = squad[4];
        toggleSquadTag(p.id, 'verkauf'); toggleSquadTag(p.id, 'quatsch'); toggleSquadTag(q.id, 'beobachten');
        out.tags = JSON.stringify(p.tags) === '["verkauf"]' && JSON.stringify(q.tags) === '["beobachten"]';
        renderSquadView();
        out.filterLeiste = document.getElementById('squad-tag-filter').querySelectorAll('button').length === 2;
        setSquadTagFilter('verkauf');
        out.gefiltert = document.querySelectorAll('#bench-list .player-card').length === 1 && document.getElementById('bench-list').textContent.includes(p.name) && document.getElementById('bench-list').textContent.includes('Verkaufskandidat');
        setSquadTagFilter('verkauf');
        out.alleWieder = document.querySelectorAll('#bench-list .player-card').length === squad.length;
        openPlayerDetail(p.id);
        out.detailTags = document.querySelectorAll('#pd-tags button').length === 6 && document.querySelector('#pd-tags button[aria-pressed="true"]').textContent.includes('Verkaufskandidat');
        toggleSquadTag(p.id, 'verkauf'); out.entfernt = p.tags.length === 0;
        document.querySelectorAll('.generic-modal-overlay.show').forEach(o => o.classList.remove('show'));
        autoLineup();
        const stamm = squad.find(x => lineup.includes(x.id)); stamm.tags = ['schonen'];
        out.schonen = getLineupProblems().some(x => x.text.includes('Schonen') && x.text.includes(stamm.name));
        stamm.tags = [];
        // Manager-Assistent
        showScreen('screen-dashboard');
        squad.forEach(x => { x.contracts = 4; x.injured = 0; x.fitness = 100; }); autoLineup();
        incomingOffers.length = 0; inboxMessages.forEach(m => { m.read = true; });
        out.gruen = getManagerTodos().length === 0;
        renderManagerAssistant();
        out.gruenText = document.getElementById('manager-assistant-box').textContent.includes('Alles im grünen Bereich');
        squad[0].contracts = 0; incomingOffers.push({ id: 999 });
        const todos = getManagerTodos();
        out.todos = todos.length === 2 && todos[0].text.includes('Angebot') && todos[1].text.includes('läuft');
        out.keinDoppelKasten = !document.getElementById('dash-offers-alert');
        renderManagerAssistant();
        out.todoKnoepfe = document.querySelectorAll('#manager-assistant-box button').length === 2;
        // Unveränderter Inhalt wird nicht neu ins DOM geschrieben (updateUI läuft oft)
        const kasten = document.getElementById('manager-assistant-box'); const knoten = kasten.firstChild;
        renderManagerAssistant(); renderManagerAssistant();
        out.entprellt = kasten.firstChild === knoten;
        squad[1].contracts = 0; renderManagerAssistant();
        out.aktualisiert = kasten.firstChild !== knoten && kasten.textContent.includes('Vertrag');
        squad[1].contracts = 4;
        lineup = lineup.filter(id => squad.find(x => x.id === id).pos !== 'TW');
        out.prioAufstellung = getManagerTodos()[0].text.includes('Aufstellung');
        incomingOffers.length = 0; autoLineup();
        // Fristen im Assistenten: Transferfenster, Hauptsponsor, Kreditraten
        const alleTexte = () => getManagerTodos(true).map(x => x.text).join(' | ');
        game.winterWindowActive = false; game.matchday = 3;
        out.fensterSommer = /Sommer-Transferfenster schließt in diesem Spieltag/.test(alleTexte());
        game.matchday = 1; out.fensterFern = !/Transferfenster/.test(alleTexte());
        game.matchday = 11; game.winterWindowActive = true; game.winterWindowCloseMatchday = 12;
        out.fensterWinter = /Winter-Transferfenster schließt in zwei Spieltagen/.test(alleTexte());
        game.winterWindowCloseMatchday = 14; out.fensterWinterFern = !/Transferfenster/.test(alleTexte());
        game.winterWindowActive = false; game.matchday = 4;
        const spAlt = game.sponsor; game.sponsor = { ...spAlt, name: 'Test AG', duration: 5 }; game.sponsorRenewal = null;
        out.sponsorEnde = /Hauptsponsor Test AG läuft in 5 Spieltagen aus/.test(alleTexte());
        game.sponsor.duration = 20; out.sponsorFern = !/Hauptsponsor/.test(alleTexte());
        game.sponsor = spAlt;
        const kreditAlt = activeLoans.slice(); const geldAlt = game.money;
        activeLoans.push({ tierName: 'Test', installment: 40000, matchdaysLeft: 12 }); game.money = 50000;
        out.kreditWarnung = /deckt nur 1 von 3 anstehenden Kreditraten/.test(alleTexte());
        game.money = 500000; out.kreditOk = !/Kreditraten/.test(alleTexte());
        activeLoans.length = 0; kreditAlt.forEach(l => activeLoans.push(l)); game.money = geldAlt;
        game.matchday = Math.max(game.matchday, 4);
        // Etiketten greifen in andere Bereiche ein: Angebote, Verlängerungs-Assistent, Manager-Assistent
        const kand = squad[7]; kand.tags = ['verkauf'];
        incomingOffers.push({ id: 'test-offer', playerId: kand.id, playerName: kand.name, playerPos: kand.pos, playerStr: kand.strength, clubName: 'FC Test', marketValue: 1000000, currentBid: 1100000, expiresIn: 3, statusText: '' });
        renderTransferView();
        const angebote = document.getElementById('incoming-offers-list').textContent;
        out.verkaufChip = angebote.includes('Verkaufskandidat');
        kand.tags = ['stamm']; renderTransferView();
        out.stammWarnung = document.getElementById('incoming-offers-list').textContent.includes('nicht verkaufen');
        incomingOffers.length = 0; kand.tags = [];
        squad.forEach(x => { x.contracts = 4; });
        const mitEtikett = squad[9], ohneEtikett = squad[3];
        ohneEtikett.contracts = 0; mitEtikett.contracts = 1; mitEtikett.tags = ['vertrag'];
        out.vertragOben = getRenewalCandidates(1)[0].id === mitEtikett.id && getRenewalCandidates(1)[1].id === ohneEtikett.id;
        openRenewalAssistant();
        out.vertragChip = document.getElementById('renewal-assistant-content').textContent.includes('Vertrag klären');
        closeRenewalAssistant();
        mitEtikett.tags = []; squad.forEach(x => { x.contracts = 4; });
        const beob = squad[4]; beob.tags = ['beobachten'];
        out.beobachtenRuhig = !getManagerTodos().some(x => x.text.includes('Beobachtet'));
        beob.injured = 2;
        out.beobachtenMeldung = getManagerTodos().some(x => x.text.includes('Beobachtet') && x.text.includes(beob.name));
        beob.injured = 0; beob.tags = [];
        return out;
    });
    const lizenz = await page.evaluate(() => {
        const out = {};
        privateLife.license = 0; privateLife.money = 1000000; game.season = 1; managerRPG.level = 1; game.trophies = [];
        out.fehltB = getLicenseMissing(1).length === 1;
        upgradeLicense();
        out.gesperrtB = privateLife.license === 0 && document.getElementById('app-toast').innerText.includes('noch nötig');
        game.season = 2; upgradeLicense();
        out.kaufB = privateLife.license === 1;
        out.fehltA = getLicenseMissing(2).length === 2;
        game.season = 4; managerRPG.level = 3;
        out.freiA = getLicenseMissing(2).length === 0;
        privateLife.money = 100; upgradeLicense();
        out.geldA = privateLife.license === 1 && document.getElementById('app-toast').innerText.includes('Privatvermögen');
        privateLife.money = 1000000; upgradeLicense();
        out.kaufA = privateLife.license === 2;
        game.season = 7; managerRPG.level = 6;
        out.fehltPro = getLicenseMissing(3).length === 1 && getLicenseMissing(3)[0].includes('Trophäe');
        game.trophies = ['Meister'];
        upgradeLicense();
        out.kaufPro = privateLife.license === 3;
        showScreen('screen-private'); renderPrivateLifeView();
        out.anzeige = document.getElementById('priv-license-box').textContent.includes('Lizenz-Laufbahn') && document.getElementById('priv-license-box').textContent.includes('UEFA Pro Lizenz');
        out.boost = licenseConfig[privateLife.license].boost === 4;
        return out;
    });
    assert(r.leer && r.leerText, 'Ohne Spieltagsabrechnung zeigt die Vorschau einen ehrlichen Hinweis');
    assert(r.avg && r.punkte && r.box, `Liquiditäts-Vorschau: Schnitt, Heim/Auswärts, 5 und 10 Spieltage, Minus-Warnung (${JSON.stringify([r.avg, r.punkte, r.box])})`);
    assert(r.ohneWert && r.gesetzt, 'Konto-Alarm braucht eine Grenze über 0');
    assert(r.alarm && r.zurueck, 'Konto-Alarm meldet sich genau einmal beim Unterschreiten und schärft sich wieder');
    assert(r.vorwarnung && r.aus, 'Vorwarnung drei Spieltage vorher (einmal), Alarm lässt sich ausschalten');
    assert(r.tags && r.filterLeiste && r.gefiltert && r.alleWieder, `Etiketten setzen, nur bekannte erlaubt, Filter in der Kaderliste (${JSON.stringify([r.tags, r.filterLeiste, r.gefiltert, r.alleWieder])})`);
    assert(r.detailTags && r.entfernt, 'Etiketten im Spielerdetail umschaltbar');
    assert(r.schonen, 'Der Aufstellungs-Check erinnert an „Schonen“-Spieler in der Startelf');
    assert(r.gruen && r.gruenText, 'Manager-Assistent: ohne Handlungsbedarf „alles im grünen Bereich“');
    assert(r.verkaufChip && r.stammWarnung, `Angebote zeigen das Etikett Verkaufskandidat und warnen bei Stammkraft (${r.verkaufChip}/${r.stammWarnung})`);
    assert(r.vertragOben && r.vertragChip, `Verlängerungs-Assistent stellt „Vertrag klären“ nach oben (${r.vertragOben}/${r.vertragChip})`);
    assert(r.beobachtenRuhig && r.beobachtenMeldung, `Manager-Assistent meldet beobachtete Spieler nur bei Auffälligkeit (${r.beobachtenRuhig}/${r.beobachtenMeldung})`);
    assert(r.fensterSommer && r.fensterFern && r.fensterWinter && r.fensterWinterFern, `Manager-Assistent meldet das Schließen des Transferfensters nur kurz vorher (${JSON.stringify([r.fensterSommer, r.fensterFern, r.fensterWinter, r.fensterWinterFern])})`);
    assert(r.sponsorEnde && r.sponsorFern && r.kreditWarnung && r.kreditOk, `Manager-Assistent meldet auslaufenden Hauptsponsor und zu knappe Kasse für Kreditraten (${JSON.stringify([r.sponsorEnde, r.sponsorFern, r.kreditWarnung, r.kreditOk])})`);
    assert(r.entprellt && r.aktualisiert, `Manager-Assistent schreibt das DOM nur bei Änderung neu (${r.entprellt}/${r.aktualisiert})`);
    assert(r.todos && r.keinDoppelKasten && r.todoKnoepfe && r.prioAufstellung, `Manager-Assistent: Schritte nach Dringlichkeit, höchstens drei, mit Knopf (${JSON.stringify([r.todos, r.todoKnoepfe, r.prioAufstellung])})`);
    assert(lizenz.fehltB && lizenz.gesperrtB && lizenz.kaufB, `Lizenz-Laufbahn: B-Lizenz erst nach einer abgeschlossenen Saison (${JSON.stringify(lizenz)})`);
    assert(lizenz.fehltA && lizenz.freiA && lizenz.geldA && lizenz.kaufA, 'A-Lizenz: Saisons und Manager-Level nötig, danach Kosten aus dem Privatvermögen');
    assert(lizenz.fehltPro && lizenz.kaufPro && lizenz.boost, 'Pro-Lizenz verlangt zusätzlich eine Trophäe und gibt weiter +4 Teamstärke');
    assert(lizenz.anzeige, 'Die Laufbahn mit Voraussetzungen erscheint im Privatleben-Bildschirm');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testVergleichUndNotizen(browser) {
    console.log('\n[26.6] Spieler-Vergleich, Verletzungs-Verlauf, Vorlage im Spieltag-Check, Gegner-Notizbuch');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        // --- Spieler-Vergleich ---
        const a = squad[0];
        openPlayerDetail(a.id, 'squad');
        out.knopf = !!document.getElementById('pd-compare-btn');
        openPlayerCompare();
        const ov = document.getElementById('compare-overlay');
        out.offen = ov.classList.contains('show');
        const sel = document.getElementById('compare-b');
        out.optionen = sel && sel.options.length === squad.length - 1;
        out.standardGleichePos = (() => { const b = squad.find(p => String(p.id) === String(sel.value)); return b && b.pos === a.pos && b.id !== a.id; })();
        const text = document.getElementById('compare-content').textContent;
        out.tabelle = text.includes('Stärke') && text.includes('Tempo') && text.includes('✓');
        const anderer = [...sel.options].find(o => o.value !== sel.value).value;
        sel.value = anderer; sel.dispatchEvent(new Event('change'));
        out.wechsel = String(compareState.bId) === String(anderer);
        closePlayerCompare(); out.zu = !ov.classList.contains('show');
        // Transfermarkt-Spieler gegen den eigenen Kader
        const m = marketPlayers[0];
        if (m) { openPlayerDetail(m.id, 'market'); openPlayerCompare(); out.extern = document.getElementById('compare-content').textContent.includes('extern'); closePlayerCompare(); }
        else out.extern = true;
        closePlayerDetail();
        // --- Verletzungs-Verlauf ---
        const p = squad[3]; p.injured = 0; p.timesInjured = 0; p.injuryLog = [];
        renderInjuryHistory(p, 'squad');
        out.nieVerletzt = document.getElementById('pd-injuries').textContent.includes('noch nie verletzt');
        p.timesInjured = 2; logPlayerInjury(p, 3, 'Spiel'); logPlayerInjury(p, 1, 'Länderspiel');
        renderInjuryHistory(p, 'squad');
        const verlauf = document.getElementById('pd-injuries').textContent;
        out.verlauf = verlauf.includes('Verletzungs-Verlauf (2 Verletzungen)') && verlauf.includes('Länderspiel') && verlauf.includes('4 verpasste');
        for (let i = 0; i < 12; i++) logPlayerInjury(p, 1, 'x');
        out.deckel = p.injuryLog.length === 8;
        renderInjuryHistory(p, 'market'); out.nurKader = document.getElementById('pd-injuries').innerHTML === '';
        const q = squad[4]; q.injured = 0; q.injuryLog = []; q.timesInjured = 0;
        injurePlayerByEvent(q, 'Trainingsunfall');
        out.ereignis = q.injuryLog.length === 1 && q.injuryLog[0].anlass === 'Trainingsunfall';
        // Spiel nach dem Spiel: irgendwann verletzt sich jemand und wird protokolliert
        squad.forEach(x => { x.injuryLog = []; x.timesInjured = 0; x.injured = 0; });
        let gefunden = false;
        for (let i = 0; i < 80 && !gefunden; i++) {
            squad.forEach(x => { x.fitness = 30; x.injured = 0; });
            lineup = pickBestLineupIds();
            processPostMatchRoutine('draw', false, false, 0, true, { total: 2, bothScored: true });
            gefunden = squad.some(x => (x.injuryLog || []).some(e => e.anlass === 'Spiel') && x.injuryLog.length === x.timesInjured);
        }
        out.nachSpiel = gefunden;
        squad.forEach(x => { x.fitness = 100; x.injured = 0; x.suspended = 0; });
        // --- Vorlage im Spieltag-Check ---
        game.formation = '4-4-2'; autoLineup();
        saveLineupPreset(0);
        const presetIds = [...game.lineupPresets[0].ids];
        pendingMatchInfo = { isHome: true, oppName: 'Test FC', oppStr: 60, ourFixture: null };
        renderPrematchCheck();
        const check = document.getElementById('prematch-check-box').textContent;
        out.vorlageAbschnitt = check.includes('Aufstellung aus Vorlage') && check.includes('Aktuelle Elf') && check.includes('gegen den Gegner');
        // Eine Elf mit schwächsten Spielern: Vorschau ändert nichts, Aufstellen holt die Vorlage zurück
        const schwach = [...squad].sort((x, y) => x.strength - y.strength).slice(0, 11).map(x => x.id);
        lineup = schwach; const formVorher = game.formation;
        const vorschau = getLineupStrengthPreview(presetIds, '4-4-2', true);
        out.vorschauNeutral = lineup === schwach && game.formation === formVorher;
        applyPresetPrematch(0);
        out.aufgestellt = presetIds.every(id => lineup.includes(id)) && lineup.length === 11;
        out.vorschauStimmt = Math.abs(calcTeamStrength(true) - vorschau) < 0.01;
        // --- Gegner-Notizbuch ---
        out.notizFeld = !!document.getElementById('gegner-notiz-text');
        document.getElementById('gegner-notiz-text').value = 'Schwach <b>links</b>';
        saveGegnerNotiz('Test FC');
        out.notizGespeichert = !!game.gegnerNotizen['Test FC'] && game.gegnerNotizen['Test FC'].text === 'Schwach <b>links</b>';
        out.notizMaskiert = document.getElementById('prematch-check-box').innerHTML.includes('Schwach &lt;b&gt;links') && !document.getElementById('prematch-check-box').innerHTML.includes('<b>links');
        out.notizChip = document.getElementById('prematch-check-box').textContent.includes('Notiz vorhanden');
        showScreen('screen-squad'); setSquadTab('analyse'); renderSquadView();
        out.notizListe = document.getElementById('opp-notes-box').textContent.includes('Test FC');
        document.getElementById('gegner-notiz-text') && (document.getElementById('gegner-notiz-text').value = 'x'.repeat(500));
        pendingMatchInfo = { isHome: true, oppName: 'Test FC', oppStr: 60, ourFixture: null }; renderPrematchCheck();
        document.getElementById('gegner-notiz-text').value = 'x'.repeat(500); saveGegnerNotiz('Test FC');
        out.notizDeckel = game.gegnerNotizen['Test FC'].text.length === 300;
        document.getElementById('gegner-notiz-text').value = ''; saveGegnerNotiz('Test FC');
        out.notizLeerLoescht = !game.gegnerNotizen['Test FC'];
        game.gegnerNotizen['Anderer FC'] = { text: 'abc', season: 1, matchday: 2 };
        deleteGegnerNotiz('Anderer FC'); out.notizLoeschen = !game.gegnerNotizen['Anderer FC'];
        delete game.gegnerNotizen; out.altesFeld = getGegnerNotiz('Test FC') === null && typeof game.gegnerNotizen === 'object';
        pendingMatchInfo = null;
        return out;
    });
    assert(r.knopf && r.offen && r.optionen && r.standardGleichePos && r.tabelle, `Spieler-Vergleich öffnet mit Auswahl, Standard gleiche Position und Tabelle (${JSON.stringify([r.knopf, r.offen, r.optionen, r.standardGleichePos, r.tabelle])})`);
    assert(r.wechsel && r.zu && r.extern, `Vergleich: anderer Spieler wählbar, schließt, funktioniert auch mit Transfermarkt-Spielern (${JSON.stringify([r.wechsel, r.zu, r.extern])})`);
    assert(r.nieVerletzt && r.verlauf && r.deckel && r.nurKader, `Verletzungs-Verlauf: leer, mit Einträgen, höchstens acht, nur für den eigenen Kader (${JSON.stringify([r.nieVerletzt, r.verlauf, r.deckel, r.nurKader])})`);
    assert(r.ereignis && r.nachSpiel, `Verletzungen aus Ereignis und aus dem Spiel werden protokolliert (${r.ereignis}/${r.nachSpiel})`);
    assert(r.vorlageAbschnitt && r.vorschauNeutral && r.aufgestellt && r.vorschauStimmt, `Vorlage im Spieltag-Check: Vorschau gegen den Gegner ändert nichts, Aufstellen stimmt mit der Vorschau überein (${JSON.stringify([r.vorlageAbschnitt, r.vorschauNeutral, r.aufgestellt, r.vorschauStimmt])})`);
    assert(r.notizFeld && r.notizGespeichert && r.notizMaskiert && r.notizChip && r.notizListe, `Gegner-Notizbuch: speichern, maskieren, Chip und Liste im Reiter Analyse (${JSON.stringify([r.notizFeld, r.notizGespeichert, r.notizMaskiert, r.notizChip, r.notizListe])})`);
    assert(r.notizDeckel && r.notizLeerLoescht && r.notizLoeschen && r.altesFeld, `Notizen: höchstens 300 Zeichen, leer löscht, Löschen, alte Spielstände (${JSON.stringify([r.notizDeckel, r.notizLeerLoescht, r.notizLoeschen, r.altesFeld])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testFeinschliffNachPhase26(browser) {
    console.log('\n[26.7] Feinschliff: Bilanz, Vergleich von der Karte, Ausfall-Rangliste, Fokus, Reiter und Kalender bei großer Schrift');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        // Bilanz im Notizbuch (aus game.headToHeadRecords)
        pendingMatchInfo = { isHome: true, oppName: 'Test FC', oppStr: 60, ourFixture: null };
        game.headToHeadRecords['Test FC'] = { wins: 3, draws: 1, losses: 2, goalsFor: 9, goalsAgainst: 6, lastResults: ['2:1', '0:0', '1:3'] };
        renderPrematchCheck();
        const t1 = document.getElementById('prematch-check-box').textContent;
        out.bilanz = t1.includes('Bilanz: 3S 1U 2N') && t1.includes('Tore 9:6') && t1.includes('zuletzt 2:1, 0:0, 1:3');
        delete game.headToHeadRecords['Test FC']; renderPrematchCheck();
        out.keineBilanz = document.getElementById('prematch-check-box').textContent.includes('Noch keine Ligaduelle');
        pendingMatchInfo = null;
        // Vergleich direkt von der Karte
        showScreen('screen-squad'); setSquadTab('aufstellung'); renderSquadView();
        out.kaderKarte = [...document.querySelectorAll('#screen-squad button')].some(b => /Vergleich/.test(b.textContent));
        openPlayerCompare(squad[2].id, 'squad');
        out.direkt = document.getElementById('compare-overlay').classList.contains('show') && compareState.aId === squad[2].id && String(compareState.bId) !== String(squad[2].id);
        closePlayerCompare();
        showScreen('screen-transfer'); renderTransferView();
        out.marktKarte = !!document.querySelector('#market-list button[onclick^="openPlayerCompare("]');
        // Ausfall-Rangliste
        squad.forEach(x => { x.injuryLog = []; });
        squad[1].injuryLog = [{ season: game.season, matchday: 2, tage: 5, anlass: 'Spiel' }, { season: game.season, matchday: 3, tage: 2, anlass: 'Spiel' }];
        squad[6].injuryLog = [{ season: game.season, matchday: 1, tage: 3, anlass: 'Länderspiel' }];
        const rang = getInjuryRanking();
        out.rangfolge = rang.length === 2 && rang[0].p.id === squad[1].id && rang[0].tage === 7 && rang[1].tage === 3;
        renderMedicalDepartmentPanel();
        const med = document.getElementById('medical-department-box').textContent;
        out.rangliste = med.includes('Ausfall-Rangliste (2 Spieler') && med.includes('Diese Saison verpasst: 10');
        out.rangKnopf = !!document.querySelector('#medical-department-box button[onclick^="openPlayerDetail("]');
        squad.forEach(x => { x.injuryLog = []; });
        renderMedicalDepartmentPanel();
        out.rangLeer = document.getElementById('medical-department-box').textContent.includes('Noch keine Ausfälle');
        // Kalender: einheitliche Form
        showScreen('screen-calendar');
        const knoepfe = [...document.querySelectorAll('.cal-aktionen > button')];
        out.kalenderForm = knoepfe.length >= 7 && new Set(knoepfe.map(b => getComputedStyle(b).borderRadius)).size === 1 && knoepfe.every(b => parseFloat(getComputedStyle(b).marginTop) === 0);
        return out;
    });
    assert(r.bilanz && r.keineBilanz, `Notizbuch zeigt die Bilanz gegen den Gegner aus den Kopf-an-Kopf-Daten (${r.bilanz}/${r.keineBilanz})`);
    assert(r.kaderKarte && r.direkt && r.marktKarte, `Vergleich direkt von Kader- und Transfermarkt-Karte (${JSON.stringify([r.kaderKarte, r.direkt, r.marktKarte])})`);
    assert(r.rangfolge && r.rangliste && r.rangKnopf && r.rangLeer, `Ausfall-Rangliste im Medizin-Panel: Reihenfolge, Summe der Saison, Knopf zum Spielerdetail, leerer Zustand (${JSON.stringify([r.rangfolge, r.rangliste, r.rangKnopf, r.rangLeer])})`);
    assert(r.kalenderForm, 'Kalender-Aktionen haben eine einheitliche Form und gleiche Abstände');

    // Fokus mit echter Tastatur: Vergleich öffnen, Auswahl ändern (Fokus bleibt), Escape (Fokus kehrt zurück)
    await page.evaluate(() => { showScreen('screen-squad'); openPlayerDetail(squad[4].id, 'squad'); });
    await page.focus('#pd-compare-btn');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('compare-overlay').classList.contains('show') && document.getElementById('compare-overlay').contains(document.activeElement));
    const vorher = await page.evaluate(() => document.getElementById('compare-b').value);
    await page.focus('#compare-b');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(v => document.getElementById('compare-b') && document.getElementById('compare-b').value !== v, vorher);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'compare-b');
    assert(true, 'Vergleich: nach dem Wechsel des Spielers bleibt der Fokus auf der Auswahl');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('compare-overlay').classList.contains('show') && document.activeElement && document.activeElement.id === 'pd-compare-btn');
    assert(true, 'Vergleich: Escape schließt das Fenster, der Fokus kehrt zum Auslöser zurück');
    await page.evaluate(() => closePlayerDetail());
    // Verlängerungs-Assistent: nach dem Verlängern bleibt der Fokus im Fenster
    await page.evaluate(() => { squad.forEach(x => { x.contracts = 4; }); squad[0].contracts = 0; squad[1].contracts = 1; game.money = 5000000; showScreen('screen-contracts'); openRenewalAssistant(); });
    await page.waitForFunction(() => document.getElementById('renewal-assistant-overlay').contains(document.activeElement));
    await page.focus('#renewal-assistant-content button.btn-action:not([disabled])');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('renewal-assistant-overlay').contains(document.activeElement));
    assert(true, 'Verlängerungs-Assistent: der Fokus bleibt nach dem Neuzeichnen im Fenster');
    await page.evaluate(() => closeRenewalAssistant());

    // Große Schrift auf dem Handy: Reiter im Kader brechen nicht mitten im Wort, Leiste hat zwei Spalten
    const gross = await page.evaluate(() => {
        setzeTextGroesse('sehr-gross');
        showScreen('screen-squad'); setSquadTab('aufstellung');
        const leiste = document.querySelector('#screen-squad .hub-tab-bar');
        const spalten = getComputedStyle(leiste).gridTemplateColumns.split(' ').length;
        const probe = document.createElement('span'); document.body.appendChild(probe);
        const zuBreit = [...leiste.querySelectorAll('button')].filter(b => {
            const cs = getComputedStyle(b);
            probe.style.cssText = `position:absolute; visibility:hidden; white-space:nowrap; font:${cs.font}`;
            const innen = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            return b.innerText.trim().split(/\s+/).some(w => { probe.textContent = w; return probe.getBoundingClientRect().width > innen + 1; });
        }).map(b => b.innerText.trim());
        probe.remove();
        setzeTextGroesse('normal');
        return { spalten, zuBreit };
    });
    assert(gross.spalten === 2 && gross.zuBreit.length === 0, `Sehr große Schrift: Kader-Reiter in zwei Spalten, kein Wort zu breit (${JSON.stringify(gross)})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde27Funktionen(browser) {
    console.log('\n[26.8] Kaderplaner mit Ausfällen, Nachbetrachtung der Vorlagen, Kaderliste, Etiketten mit Wirkung');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        // --- Kaderplaner: Ausfälle und Verletzungsanfälligkeit ---
        squad.forEach(p => { p.injured = 0; p.timesInjured = 0; });
        const torhueter = squad.filter(p => p.pos === 'TW');
        const basis = getSquadPlanningAnalysis().find(a => a.pos === 'TW');
        out.keinHinweis = !basis.ausfallRisiko && !basis.fragilRisiko;
        torhueter.forEach(p => { p.injured = 2; });
        const a1 = getSquadPlanningAnalysis().find(a => a.pos === 'TW');
        out.ausfall = a1.ausfallRisiko && a1.fit === torhueter.length - torhueter.length && a1.riskScore === basis.riskScore;
        renderSquadPlanningWarningsBox();
        out.ausfallText = document.getElementById('squad-planning-warnings-box').textContent.includes('aktuell nur 0 von mindestens');
        torhueter.forEach(p => { p.injured = 0; });
        const kleinerAbwehrBestand = squad.filter(p => p.pos === 'ABW').slice(0, 2);
        kleinerAbwehrBestand[0].timesInjured = 4;
        const a2 = getSquadPlanningAnalysis().find(a => a.pos === 'ABW');
        out.fragilKeinRisiko = a2.fragil.length >= 1 && (a2.count > a2.minHealthy + 1 ? !a2.fragilRisiko : a2.fragilRisiko);
        squad.forEach(p => { p.injured = 0; p.timesInjured = 0; });
        // --- Bilanz je Vorlage ---
        game.formation = '4-4-2'; autoLineup(); saveLineupPreset(0);
        game.vorlageBilanz = {};
        pendingMatchInfo = { isHome: true, oppName: 'Bilanz FC', oppStr: 60, ourFixture: null };
        markPresetInUse();
        out.erkannt = !!game.vorlageImEinsatz && game.vorlageImEinsatz.slot === 0 && game.vorlageImEinsatz.matchday === game.matchday;
        recordPresetResult(3, 1);
        out.gezaehlt = game.vorlageBilanz[0] && game.vorlageBilanz[0].spiele === 1 && game.vorlageBilanz[0].s === 1 && game.vorlageBilanz[0].tore === 3 && game.vorlageImEinsatz === null;
        markPresetInUse(); recordPresetResult(0, 0);
        game.lineupPresets[0].name = game.lineupPresets[0].name; markPresetInUse(); recordPresetResult(1, 2);
        const b = game.vorlageBilanz[0];
        out.summen = b.spiele === 3 && b.s === 1 && b.u === 1 && b.n === 1 && b.tore === 4 && b.gegentore === 3;
        out.text = /^1S 1U 1N · Tore 4:3 · Ø [+-]\d+,?\d* gegen den Gegner$/.test(getPresetBilanzText(0).replace('.', ','));
        renderLineupPresets();
        out.karte = document.getElementById('lineup-presets-box').textContent.includes('1S 1U 1N');
        // andere Elf: keine Vorlage -> nichts wird gezählt
        lineup = [...squad].sort((x, y) => x.strength - y.strength).slice(0, 11).map(x => x.id);
        markPresetInUse(); recordPresetResult(5, 0);
        out.fremdeElf = game.vorlageBilanz[0].spiele === 3;
        lineup = [...game.lineupPresets[0].ids];
        // Merker von einem anderen Spieltag zählt nicht (simulierte Spieltage)
        markPresetInUse(); game.matchday += 1; recordPresetResult(2, 0); game.matchday -= 1;
        out.alterMerker = game.vorlageBilanz[0].spiele === 3;
        // Slot neu belegt: Bilanz beginnt von vorn; Löschen räumt auf
        saveLineupPreset(0); out.neuBelegt = !game.vorlageBilanz[0];
        game.vorlageBilanz[0] = { name: 'Alt', spiele: 2, s: 1, u: 0, n: 1, tore: 2, gegentore: 2, diffSumme: 1 };
        out.andererName = getPresetBilanzText(0) === '';
        deleteLineupPreset(0); out.geloescht = !game.vorlageBilanz[0];
        // alte Spielstände ohne Feld
        delete game.vorlageBilanz; out.altesFeld = getPresetBilanzText(0) === '' && (ensureVorlageBilanz(), typeof game.vorlageBilanz === 'object');
        pendingMatchInfo = null;
        // Echter Ablauf: Anstoß-Ablauf setzt den Merker, das Ligaergebnis zählt über recordOwnLeagueResult
        game.matchday = 4; game.formation = '4-4-2'; autoLineup(); saveLineupPreset(1);
        startMatchdayFlow();
        out.flussMerker = !!game.vorlageImEinsatz && game.vorlageImEinsatz.slot === 1 && typeof game.vorlageImEinsatz.diff === 'number';
        recordOwnLeagueResult(2, 0, true);
        out.flussZaehlt = game.vorlageBilanz[1] && game.vorlageBilanz[1].spiele === 1 && game.vorlageBilanz[1].s === 1;
        return out;
    });
    assert(r.flussMerker && r.flussZaehlt, `Bilanz je Vorlage über den echten Ablauf (Anstoß setzt den Merker, Ligaergebnis zählt) (${r.flussMerker}/${r.flussZaehlt})`);
    assert(r.erkannt && r.gezaehlt && r.summen && r.text && r.karte, `Bilanz je Vorlage: erkannt, gezählt, Summen, Text und Anzeige auf der Karte (${JSON.stringify([r.erkannt, r.gezaehlt, r.summen, r.text, r.karte])})`);
    assert(r.fremdeElf && r.alterMerker && r.neuBelegt && r.andererName && r.geloescht && r.altesFeld, `Bilanz je Vorlage: fremde Elf, alter Merker, neu belegter Slot, Löschen, alte Spielstände (${JSON.stringify([r.fremdeElf, r.alterMerker, r.neuBelegt, r.andererName, r.geloescht, r.altesFeld])})`);
    assert(r.keinHinweis && r.ausfall && r.ausfallText, `Kaderplaner zeigt Ausfälle je Position, ohne die Risikostufe zu ändern (${JSON.stringify([r.keinHinweis, r.ausfall, r.ausfallText])})`);
    assert(r.fragilKeinRisiko, 'Kaderplaner: Verletzungsanfällige zählen nur bei dünner Besetzung als Risiko');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

module.exports = {
    testSpielvorbereitung,
    testVertragsWerkzeuge,
    testStatistikWerkzeuge,
    testManagerWerkzeuge,
    testVergleichUndNotizen,
    testFeinschliffNachPhase26,
    testRunde27Funktionen,
};
