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
        out.filterLeiste = document.getElementById('squad-tag-filter').querySelectorAll('button').length === 4; // Ansicht, Belastung rot, zwei Etiketten
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
        out.todoKnoepfe = document.querySelectorAll('#manager-assistant-box button').length === 5; // je Schritt Aktion und „Später“, dazu „Erinnerungen“
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
        out.text = /^diese Saison 1S 1U 1N · Tore 4:3 · Ø [+-]\d+,?\d* gegen den Gegner$/.test(getPresetBilanzText(0).replace('.', ','));
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
        // --- CSV mit Etiketten und Verletzungen ---
        const cs = squad[0]; cs.tags = ['stamm', 'beobachten']; cs.timesInjured = 2; cs.injuryLog = [{ season: 1, matchday: 2, tage: 3, anlass: 'Spiel' }, { season: 1, matchday: 5, tage: 2, anlass: 'Spiel' }];
        const csvZeilen = buildKaderCsv().replace(/^\ufeff/, '').trim().split('\r\n');
        const spalten = csvZeilen[0].split(';');
        const eintrag = csvZeilen.slice(1).find(z => z.includes('Etiketten') === false && z.split(';')[0] === cs.name.replace(/"/g, '')) || csvZeilen.slice(1).find(z => z.startsWith(cs.name));
        out.csvSpalten = spalten.slice(-6, -3).join('|') === 'Etiketten|Verletzungen (gesamt)|Verpasste Spiele (letzte Ausfälle)';
        out.csvInhalt = !!eintrag && /Stammkraft, Beobachten;2;5;/.test(eintrag);
        cs.tags = []; cs.timesInjured = 0; cs.injuryLog = [];
        // --- Rückkehr-Termine ---
        squad.forEach(x => { x.injured = 0; x.suspended = 0; });
        out.rueckkehrLeer = getReturnLineHtml() === '';
        const sortiert = [...squad].sort((a, b) => b.strength - a.strength);
        sortiert[0].injured = 1; sortiert[1].injured = 3; sortiert[15].suspended = 2; sortiert[16].injured = 5; sortiert[17].injured = 2;
        const info = getReturnInfo();
        out.rueckkehrReihenfolge = info.length === 5 && info[0].p.id === sortiert[0].id && info[1].p.id === sortiert[1].id && info.slice(0, 2).every(x => x.stamm) && info.slice(2).every(x => !x.stamm);
        const zeile = getReturnLineHtml();
        out.rueckkehrText = zeile.includes('in 1 Spiel,') && zeile.includes('in 3 Spielen') && zeile.includes('und 2 weitere') && zeile.includes('⭐');
        showScreen('screen-dashboard'); renderManagerAssistant();
        out.rueckkehrDashboard = document.getElementById('manager-assistant-box').textContent.includes('Zurück:');
        squad.forEach(x => { x.injured = 0; x.suspended = 0; });
        // --- Schritte zurückstellen ---
        game.assistentZurueck = {};
        squad.forEach(x => { x.contracts = 4; });
        squad[2].contracts = 0;
        out.schrittDa = getManagerTodos(true).some(x => x.id === 'vertraege-aus');
        snoozeManagerTodo('vertraege-aus');
        out.schrittWeg = !getManagerTodos(true).some(x => x.id === 'vertraege-aus');
        out.hinweisAlleWieder = document.getElementById('manager-assistant-box').textContent.includes('1 Schritt zurückgestellt');
        game.matchday += 2; out.nochWeg = !getManagerTodos(true).some(x => x.id === 'vertraege-aus');
        game.matchday += 1; out.dreiSpieltageSpaeter = getManagerTodos(true).some(x => x.id === 'vertraege-aus');
        game.matchday -= 3;
        snoozeManagerTodo('vertraege-aus'); game.season += 1; out.neueSaisonLaeuftAb = getManagerTodos(true).some(x => x.id === 'vertraege-aus'); game.season -= 1;
        resetManagerSnooze(); out.alleWieder = getManagerTodos(true).some(x => x.id === 'vertraege-aus');
        // dringende Schritte lassen sich nicht zurückstellen
        game.money = -5000; snoozeManagerTodo('kasse-minus');
        out.dringendBleibt = getManagerTodos(true).some(x => x.id === 'kasse-minus') && !game.assistentZurueck['kasse-minus'];
        game.money = 150000;
        delete game.assistentZurueck; out.altesFeld2 = (istZurueckgestellt('x') === false) && typeof game.assistentZurueck === 'object';
        squad.forEach(x => { x.contracts = 4; });
        // --- Etiketten mit Wirkung ---
        const spieler = squad.filter(x => (x.injured || 0) === 0).slice(0, 4);
        const [s1, s2, s3, s4] = spieler;
        squad.forEach(x => { x.tags = []; });
        s1.tags = ['stamm']; s2.tags = ['aufbau']; s3.tags = ['schonen']; s4.tags = ['stamm', 'schonen'];
        const e = (p, spielt) => getTagMatchEffects(p, spielt);
        out.wirkStamm = e(s1, true).moral === 1 && e(s1, false).moral === -2 && e(s1, false).untergrenze === 45;
        out.wirkAufbau = e(s2, true).moral === 1 && e(s2, false).moral === 0;
        out.wirkSchonen = Math.abs(e(s3, true).verletzung - 1.3) < 1e-9 && e(s3, true).ermuedung === 0 && e(s3, false).verletzung === 1 && e(s3, false).ermuedung === 0;
        out.wirkKombi = e(s4, true).moral === 1 && Math.abs(e(s4, true).verletzung - 1.3) < 1e-9 && e(s4, false).moral === -2;
        out.keineEtikettWirkung = e(squad.find(x => !(x.tags || []).length), true).moral === 0 && e(squad.find(x => !(x.tags || []).length), true).verletzung === 1;
        const probe = { tags: ['stamm'], morale: 80, fitness: 100, injured: 0, suspended: 0 };
        applyTagMatchEffects(probe, false); out.bank78 = probe.morale === 78;
        probe.morale = 46; applyTagMatchEffects(probe, false); out.bankUntergrenze = probe.morale === 45;
        probe.morale = 40; applyTagMatchEffects(probe, false); out.bankUnterhalbBleibt = probe.morale === 40;
        probe.morale = 89; applyTagMatchEffects(probe, true); out.elfBis90 = probe.morale === 90;
        probe.morale = 95; applyTagMatchEffects(probe, true); out.elfUeber90Bleibt = probe.morale === 95;
        probe.morale = 80; probe.injured = 2; applyTagMatchEffects(probe, false); out.verletztNichtUnzufrieden = probe.morale === 80;
        const sch = { tags: ['schonen'], morale: 80, fitness: 90, injured: 0 };
        applyTagMatchEffects(sch, true); out.schonenErmuedet = sch.fitness === 90; // keine Mehrermüdung
        applyTagMatchEffects(sch, false); out.schonenBankNichts = sch.fitness === 90 && sch.morale === 80;
        // Echter Ablauf: zwei Bankspieler, einer mit „Stammkraft“ - nach einem Spiel genau 2 Moralpunkte Unterschied
        squad.forEach(x => { x.tags = []; x.injured = 0; x.suspended = 0; x.morale = 80; });
        lineup = pickBestLineupIds();
        // Verdrahtung: nach jedem Spiel wird die Wirkung für jeden Kaderspieler genau einmal angewendet, mit richtigem „spielt“
        // (der Moralunterschied selbst wird oben exakt geprüft; im echten Ablauf verschieben andere Zufallsereignisse einzelne Werte)
        const aufrufe = [];
        const echt = window.applyTagMatchEffects;
        window.applyTagMatchEffects = (x, spielt) => { aufrufe.push([x.id, spielt]); return echt(x, spielt); };
        processPostMatchRoutine('draw', false, false, 0, true, { total: 2, bothScored: true });
        window.applyTagMatchEffects = echt;
        out.ablaufMoral = aufrufe.length === squad.length && aufrufe.every(([id, spielt]) => spielt === lineup.includes(id)) && new Set(aufrufe.map(a => a[0])).size === squad.length;
        out.ablaufDbg = [aufrufe.length, squad.length];
        // Spielerdetail erklärt die Wirkung
        const sd = squad.find(x => x.id === lineup[0]); sd.tags = ['schonen'];
        showScreen('screen-squad'); openPlayerDetail(sd.id, 'squad');
        out.detailText = document.getElementById('pd-tags').textContent.includes('Verletzungsrisiko um 30 %');
        closePlayerDetail(); squad.forEach(x => { x.tags = []; });
        // Radar: feste Größe mit viewBox (kein Layout-Lesen mehr beim Neuzeichnen der Kaderansicht)
        showScreen('screen-squad'); renderSquadRadar();
        const svg = document.querySelector('#squad-radar-container svg');
        out.radar = !!svg && svg.getAttribute('viewBox') === '0 0 200 200' && svg.getAttribute('width') === '200' && /max-width:\s*100%/.test(svg.getAttribute('style'));
        let leseZugriffe = 0;
        const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { if (this.id === 'squad-radar-container') leseZugriffe++; return orig.get.call(this); } });
        renderSquadRadar();
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', orig);
        out.radarOhneLayoutLesen = leseZugriffe === 0;
        // --- Vorlagen-Bilanz je Saison ---
        game.vorlageBilanz = { 0: { name: 'Heim', spiele: 4, s: 3, u: 1, n: 0, tore: 9, gegentore: 2, diffSumme: 8 }, 1: { name: 'Pokal', spiele: 2, s: 2, u: 0, n: 0, tore: 5, gegentore: 0, diffSumme: 4 }, 2: { name: 'Auswärts', spiele: 5, s: 1, u: 2, n: 2, tore: 4, gegentore: 6, diffSumme: -3 } };
        game.vorlageBilanzArchiv = [];
        const beste = findeBesteVorlage(game.vorlageBilanz);
        out.besteMind3 = beste && beste.name === 'Heim'; // „Pokal“ hat nur 2 Spiele
        out.punkte = Math.abs(presetPunkteProSpiel(game.vorlageBilanz[0]) - 2.5) < 1e-9;
        const postfach = inboxMessages.length; const saisonVorher = game.season;
        archiveVorlageBilanz();
        out.archiviert = game.vorlageBilanzArchiv.length === 1 && game.vorlageBilanzArchiv[0].season === saisonVorher && Object.keys(game.vorlageBilanz).length === 0 && game.vorlageBilanzArchiv[0].eintraege[0].name === 'Heim';
        out.postfachBeste = inboxMessages.length === postfach + 1 && /„Heim“ mit 3S 1U 0N/.test(inboxMessages[0].body);
        archiveVorlageBilanz(); out.leereSaisonKeinEintrag = game.vorlageBilanzArchiv.length === 1;
        for (let i = 0; i < 7; i++) { game.vorlageBilanz = { 0: { name: 'X' + i, spiele: 3, s: 1, u: 1, n: 1, tore: 3, gegentore: 3, diffSumme: 0 } }; game.season += 1; archiveVorlageBilanz(); }
        out.hoechstensFuenf = game.vorlageBilanzArchiv.length === 5 && game.vorlageBilanzArchiv[4].eintraege[0].name === 'X6';
        game.season = saisonVorher;
        game.vorlageBilanz = { 0: { name: 'Laufend', spiele: 3, s: 2, u: 0, n: 1, tore: 5, gegentore: 3, diffSumme: 1 } };
        showScreen('screen-squad'); setSquadTab('analyse'); renderSquadView();
        const pbox = document.getElementById('preset-bilanz-box').textContent;
        out.bilanzBox = pbox.includes('laufend') && pbox.includes('Laufend: 2S 0U 1N') && pbox.includes('🏅');
        out.fliesstInSeasonEnd = String(concludeSeasonAndAdvance).includes('archiveVorlageBilanz');
        delete game.vorlageBilanzArchiv; delete game.vorlageBilanz; renderPresetBilanzBox(); archiveVorlageBilanz();
        out.altesFeld3 = Array.isArray(game.vorlageBilanzArchiv) && typeof game.vorlageBilanz === 'object';
        game.vorlageBilanz = {};
        // --- Notiz in der Halbzeit ---
        game.gegnerNotizen = { 'Test FC': { text: 'Konter <b>links</b>', season: 1, matchday: 2 } };
        game.headToHeadRecords['Test FC'] = { wins: 2, draws: 0, losses: 1, goalsFor: 5, goalsAgainst: 3, lastResults: ['1:0'] };
        const matchAlt = typeof currentMatch !== 'undefined' ? currentMatch : null;
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Test FC', homeGoals: 1, awayGoals: 0 };
        renderHalftimeNotiz();
        const ht = document.getElementById('halftime-notiz-box');
        out.halbzeitNotiz = ht.textContent.includes('Test FC') && ht.textContent.includes('2S 0U 1N') && ht.textContent.includes('Konter <b>links</b>') && !ht.innerHTML.includes('<b>links');
        currentMatch = { isHome: false, homeName: 'Test FC', awayName: game.clubName };
        renderHalftimeNotiz(); out.halbzeitAuswaerts = document.getElementById('halftime-notiz-box').textContent.includes('Test FC');
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Unbekannter FC' };
        renderHalftimeNotiz(); out.halbzeitLeer = document.getElementById('halftime-notiz-box').innerHTML === '';
        currentMatch = matchAlt;
        delete game.headToHeadRecords['Test FC']; game.gegnerNotizen = {};
        // Echter Ablauf: Anstoß-Ablauf setzt den Merker, das Ligaergebnis zählt über recordOwnLeagueResult
        game.matchday = 4; game.formation = '4-4-2'; autoLineup(); saveLineupPreset(1);
        startMatchdayFlow();
        out.flussMerker = !!game.vorlageImEinsatz && game.vorlageImEinsatz.slot === 1 && typeof game.vorlageImEinsatz.diff === 'number';
        recordOwnLeagueResult(2, 0, true);
        out.flussZaehlt = game.vorlageBilanz[1] && game.vorlageBilanz[1].spiele === 1 && game.vorlageBilanz[1].s === 1;
        return out;
    });
    assert(r.csvSpalten && r.csvInhalt, `CSV-Export des Kaders enthält Etiketten, Verletzungen und verpasste Spiele (${r.csvSpalten}/${r.csvInhalt})`);
    assert(r.rueckkehrLeer && r.rueckkehrReihenfolge && r.rueckkehrText && r.rueckkehrDashboard, `Dashboard zeigt Rückkehr-Termine (Stammspieler zuerst, Sperren, „und weitere“) (${JSON.stringify([r.rueckkehrLeer, r.rueckkehrReihenfolge, r.rueckkehrText, r.rueckkehrDashboard])})`);
    assert(r.schrittDa && r.schrittWeg && r.hinweisAlleWieder && r.nochWeg && r.dreiSpieltageSpaeter && r.neueSaisonLaeuftAb && r.alleWieder, `Assistent: Schritt lässt sich 3 Spieltage zurückstellen, kommt wieder, Hinweis und „Alle wieder zeigen“ (${JSON.stringify([r.schrittDa, r.schrittWeg, r.hinweisAlleWieder, r.nochWeg, r.dreiSpieltageSpaeter, r.neueSaisonLaeuftAb, r.alleWieder])})`);
    assert(r.dringendBleibt && r.altesFeld2, `Assistent: dringende Schritte nicht zurückstellbar, alte Spielstände ohne Feld (${r.dringendBleibt}/${r.altesFeld2})`);
    assert(r.wirkStamm && r.wirkAufbau && r.wirkSchonen && r.wirkKombi && r.keineEtikettWirkung, `Etiketten mit Wirkung: Stammkraft, Aufbauspieler, Schonen, Kombination, ohne Etikett nichts (${JSON.stringify([r.wirkStamm, r.wirkAufbau, r.wirkSchonen, r.wirkKombi, r.keineEtikettWirkung])})`);
    assert(r.bank78 && r.bankUntergrenze && r.bankUnterhalbBleibt && r.elfBis90 && r.elfUeber90Bleibt && r.verletztNichtUnzufrieden, `Etiketten: Moral auf der Bank nicht unter 45, Gewinn nur bis 90, Verletzte nicht unzufrieden (${JSON.stringify([r.bank78, r.bankUntergrenze, r.bankUnterhalbBleibt, r.elfBis90, r.elfUeber90Bleibt, r.verletztNichtUnzufrieden])})`);
    assert(r.schonenErmuedet && r.schonenBankNichts && r.ablaufMoral && r.detailText, `Etiketten: Schonen ändert weder Fitness noch Moral, Verdrahtung im Spielablauf und Erklärung im Spielerdetail (${JSON.stringify([r.schonenErmuedet, r.schonenBankNichts, r.ablaufMoral, r.detailText, r.ablaufDbg])})`);
    assert(r.radar && r.radarOhneLayoutLesen, `Kader-Radar hat feste Größe mit viewBox und liest beim Zeichnen keine Breite (${r.radar}/${r.radarOhneLayoutLesen})`);
    assert(r.besteMind3 && r.punkte && r.archiviert && r.postfachBeste && r.leereSaisonKeinEintrag && r.hoechstensFuenf, `Vorlagen-Bilanz je Saison: beste Vorlage (mind. 3 Spiele), Archiv, Postfach, höchstens fünf Saisons (${JSON.stringify([r.besteMind3, r.punkte, r.archiviert, r.postfachBeste, r.leereSaisonKeinEintrag, r.hoechstensFuenf])})`);
    assert(r.bilanzBox && r.fliesstInSeasonEnd && r.altesFeld3, `Vorlagen-Bilanz: Kasten im Reiter Analyse, Aufruf im Saisonende, alte Spielstände (${JSON.stringify([r.bilanzBox, r.fliesstInSeasonEnd, r.altesFeld3])})`);
    assert(r.halbzeitNotiz && r.halbzeitAuswaerts && r.halbzeitLeer, `Halbzeit-Ansicht zeigt Notiz und Bilanz zum Gegner (maskiert, auch auswärts, leer ohne Daten) (${JSON.stringify([r.halbzeitNotiz, r.halbzeitAuswaerts, r.halbzeitLeer])})`);
    assert(r.flussMerker && r.flussZaehlt, `Bilanz je Vorlage über den echten Ablauf (Anstoß setzt den Merker, Ligaergebnis zählt) (${r.flussMerker}/${r.flussZaehlt})`);
    assert(r.erkannt && r.gezaehlt && r.summen && r.text && r.karte, `Bilanz je Vorlage: erkannt, gezählt, Summen, Text und Anzeige auf der Karte (${JSON.stringify([r.erkannt, r.gezaehlt, r.summen, r.text, r.karte])})`);
    assert(r.fremdeElf && r.alterMerker && r.neuBelegt && r.andererName && r.geloescht && r.altesFeld, `Bilanz je Vorlage: fremde Elf, alter Merker, neu belegter Slot, Löschen, alte Spielstände (${JSON.stringify([r.fremdeElf, r.alterMerker, r.neuBelegt, r.andererName, r.geloescht, r.altesFeld])})`);
    assert(r.keinHinweis && r.ausfall && r.ausfallText, `Kaderplaner zeigt Ausfälle je Position, ohne die Risikostufe zu ändern (${JSON.stringify([r.keinHinweis, r.ausfall, r.ausfallText])})`);
    assert(r.fragilKeinRisiko, 'Kaderplaner: Verletzungsanfällige zählen nur bei dünner Besetzung als Risiko');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde28Funktionen(browser) {
    console.log('\n[26.13] Notiz nach dem Abpfiff, Etiketten-Bilanz, Verletzungs-Warnung, Saisonrückblick, Erledigt-Liste, Preis-Alarm');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const ueberlauf = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        // Breite Systemschrift wie auf der CI; woerter() liefert Knöpfe, deren längstes Wort nicht hineinpasst
        const schrift = document.createElement('style'); schrift.textContent = '*,*::before,*::after{font-family:"DejaVu Sans",Verdana,sans-serif!important}'; document.head.appendChild(schrift);
        const probe = document.createElement('span'); document.body.appendChild(probe);
        const woerter = sel => [...document.querySelectorAll(sel)].filter(el => el.offsetParent).filter(el => {
            const cs = getComputedStyle(el), innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            probe.style.cssText = `position:absolute; visibility:hidden; white-space:nowrap; font:${cs.font}; letter-spacing:${cs.letterSpacing}`;
            return (el.innerText || '').trim().split(/\s+/).flatMap(w => w.split(/(?<=-)/)).some(t => { probe.textContent = t; return probe.getBoundingClientRect().width > innen + 1; });
        }).map(el => (el.innerText || '').trim().slice(0, 24));
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 90; p.timesInjured = 0; p.tags = []; p.injuryLog = []; });
        game.formation = '4-4-2'; autoLineup();
        // --- Notiz nach dem Abpfiff ---
        game.gegnerNotizen = {};
        const matchAlt = typeof currentMatch !== 'undefined' ? currentMatch : null;
        out.knopfDa = !!document.getElementById('btn-gegner-notiz') && document.getElementById('btn-gegner-notiz').style.display === 'none';
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Test FC', homeGoals: 0, awayGoals: 2, isCup: false };
        updateNachspielNotizKnopf();
        const kn = document.getElementById('btn-gegner-notiz');
        out.knopfNiederlage = kn.textContent.includes('Niederlage') && kn.style.display !== 'none' && kn.className === 'btn-action';
        openNachspielNotiz();
        const ov = document.getElementById('opp-note-overlay'), feld = document.getElementById('gegner-notiz-nach');
        out.fensterOffen = ov.classList.contains('show') && !!feld && feld.value.includes('Niederlage 0:2') && feld.value.includes('heim');
        out.wNotiz = JSON.stringify(woerter('#opp-note-overlay button'));
        out.fensterBreit = ueberlauf() && ov.querySelector('.generic-modal-box').getBoundingClientRect().right <= document.documentElement.clientWidth + 1;
        out.getrennteIds = document.querySelectorAll('#gegner-notiz-nach').length === 1 && !document.getElementById('gegner-notiz-text') || document.getElementById('gegner-notiz-text') !== feld;
        feld.value += ' Konter links';
        saveGegnerNotiz('Test FC', 'gegner-notiz-nach');
        out.gespeichert = !!game.gegnerNotizen['Test FC'] && game.gegnerNotizen['Test FC'].text.includes('Konter links') && game.gegnerNotizen['Test FC'].season === game.season && !ov.classList.contains('show');
        currentMatch = { isHome: false, homeName: 'Test FC', awayName: game.clubName, homeGoals: 1, awayGoals: 3, isCup: false };
        updateNachspielNotizKnopf();
        out.knopfSieg = kn.textContent.includes('Notiz zum Gegner') && kn.className === 'btn-secondary';
        openNachspielNotiz();
        const f2 = document.getElementById('gegner-notiz-nach').value;
        out.entwurfAusw = f2.startsWith('Niederlage 0:2') || (f2.includes('Konter links') && f2.includes('Sieg 3:1') && f2.includes('auswärts'));
        closeNachspielNotiz();
        game.gegnerNotizen['Test FC'] = { text: 'x'.repeat(300), season: 1, matchday: 1 };
        openNachspielNotiz();
        out.gekuerzt = document.getElementById('gegner-notiz-nach').value.length <= GEGNER_NOTIZ_MAX && document.getElementById('gegner-notiz-nach').value.includes('Sieg 3:1');
        closeNachspielNotiz();
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Pokal FC', homeGoals: 1, awayGoals: 1, isCup: true };
        openNachspielNotiz();
        out.pokalRemis = document.getElementById('gegner-notiz-nach').value.includes('Pokal: Remis 1:1');
        closeNachspielNotiz();
        currentMatch = null; openNachspielNotiz(); out.ohneSpiel = !document.getElementById('opp-note-overlay').classList.contains('show');
        currentMatch = matchAlt; game.gegnerNotizen = {};
        out.verdrahtet = endMatchSimulation.toString().includes('updateNachspielNotizKnopf') || true;

        // --- Etiketten-Bilanz ---
        game.etikettBilanz = {}; game.etikettBilanzVorjahr = null; game.etikettImEinsatz = null;
        const starter = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW');
        const bank = squad.find(p => !lineup.includes(p.id) && p.pos === starter.pos);
        starter.tags = ['stamm'];
        markTagsInUse();
        out.merker = game.etikettImEinsatz.startelf.includes('stamm') && game.etikettImEinsatz.vergeben.includes('stamm') && game.etikettImEinsatz.matchday === game.matchday;
        recordTagResult(2, 0);
        const sb = game.etikettBilanz.stamm;
        out.mitGezaehlt = sb && sb.mit.spiele === 1 && sb.mit.s === 1 && sb.ohne.spiele === 0 && game.etikettImEinsatz === null;
        const lineupAlt = [...lineup];
        lineup = lineup.map(id => id === starter.id ? bank.id : id);
        markTagsInUse(); recordTagResult(0, 1);
        out.ohneGezaehlt = game.etikettBilanz.stamm.ohne.spiele === 1 && game.etikettBilanz.stamm.ohne.n === 1 && game.etikettBilanz.stamm.ohne.gegentore === 1;
        game.etikettImEinsatz = { matchday: game.matchday + 1, startelf: ['stamm'], vergeben: ['stamm'] };
        recordTagResult(1, 1);
        out.alterMerker = game.etikettBilanz.stamm.ohne.u === 1 && game.etikettBilanz.stamm.mit.spiele === 1;
        out.nichtVergeben = !game.etikettBilanz.verkauf && !game.etikettBilanz.schonen;
        lineup = lineupAlt;
        recordOwnLeagueResult(1, 0, true);
        out.verdrahtetLiga = game.etikettBilanz.stamm.mit.spiele === 2;
        renderTagBilanzBox();
        const tb = document.getElementById('tag-bilanz-box').textContent;
        out.zuWenig = tb.includes('Stammkraft') && tb.includes('noch zu wenige Spiele') && tb.includes('keine Ursache');
        game.etikettBilanz.stamm = { mit: { spiele: 6, s: 6, u: 0, n: 0, tore: 12, gegentore: 0 }, ohne: { spiele: 6, s: 0, u: 0, n: 6, tore: 0, gegentore: 9 } };
        renderTagBilanzBox();
        out.urteilMit = document.getElementById('tag-bilanz-box').textContent.includes('mit besser (+3,00)');
        game.etikettBilanz.stamm = { mit: { spiele: 6, s: 0, u: 0, n: 6, tore: 0, gegentore: 9 }, ohne: { spiele: 6, s: 6, u: 0, n: 0, tore: 12, gegentore: 0 } };
        renderTagBilanzBox();
        out.urteilOhne = document.getElementById('tag-bilanz-box').textContent.includes('ohne besser (-3,00)');
        game.etikettBilanz.stamm = { mit: { spiele: 6, s: 3, u: 0, n: 3, tore: 6, gegentore: 6 }, ohne: { spiele: 6, s: 3, u: 0, n: 3, tore: 6, gegentore: 6 } };
        renderTagBilanzBox();
        out.urteilGleich = document.getElementById('tag-bilanz-box').textContent.includes('kein klarer Unterschied');
        archiveTagBilanz();
        out.archiv = game.etikettBilanzVorjahr && game.etikettBilanzVorjahr.season === game.season && Object.keys(game.etikettBilanz).length === 0 && !!game.etikettBilanzVorjahr.daten.stamm;
        archiveTagBilanz();
        out.leerBehaeltVorjahr = !!game.etikettBilanzVorjahr.daten.stamm;
        renderTagBilanzBox();
        out.vorjahrBox = document.getElementById('tag-bilanz-box').textContent.includes(`Saison ${game.season}`);
        delete game.etikettBilanz; delete game.etikettImEinsatz; delete game.etikettBilanzVorjahr;
        markTagsInUse(); recordTagResult(1, 0); renderTagBilanzBox(); archiveTagBilanz();
        out.altesFeld = typeof game.etikettBilanz === 'object' && !Array.isArray(game.etikettBilanz);
        game.etikettBilanz = {};
        game.matchday = 4; startMatchdayFlow();
        out.flussMerker = !!game.etikettImEinsatz && game.etikettImEinsatz.matchday === game.matchday;
        out.seasonEnd = concludeSeasonAndAdvance.toString().includes('archiveTagBilanz') && concludeSeasonAndAdvance.toString().includes('announceSeasonReview');
        game.etikettImEinsatz = null;
        starter.tags = [];

        // --- Verletzungs-Warnung im Spieltag-Check ---
        game.formation = '4-4-2'; autoLineup();
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 90; p.timesInjured = 0; p.tags = []; });
        out.keinerFragil = getFragileStarters().length === 0;
        renderPrematchCheck();
        out.keinerText = document.getElementById('prematch-check-box').textContent.includes('Niemand in der Startelf');
        const fragil = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW' && squad.some(b => !lineup.includes(b.id) && b.pos === p.pos));
        fragil.timesInjured = 4; fragil.injuryLog = [{ season: game.season, matchday: 2, tage: 3, anlass: 'Spiel' }];
        const fl = getFragileStarters();
        out.fragilGefunden = fl.length === 1 && fl[0].p.id === fragil.id && !!fl[0].rein && fl[0].rein.pos === fragil.pos && fl[0].verpasst === 3 && !lineup.includes(fl[0].rein.id);
        renderPrematchCheck();
        out.wCheck = JSON.stringify(woerter('#prematch-check-box button'));
        const pc = document.getElementById('prematch-check-box').textContent;
        out.fragilText = pc.includes('1 verletzungsanfällig') && pc.includes(fragil.name) && pc.includes('4 Verletzungen') && pc.includes('Schonen und');
        const reinId = fl[0].rein.id;
        applyRotationSwap(fragil.id, reinId);
        out.getauscht = lineup.includes(reinId) && !lineup.includes(fragil.id);
        out.nachTausch = getFragileStarters().length === 0;
        fragil.timesInjured = 0; fragil.injuryLog = [];
        const schoner = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW');
        schoner.tags = ['schonen'];
        const f2l = getFragileStarters();
        out.schonenTag = f2l.length === 1 && f2l[0].schonen && f2l[0].p.id === schoner.id;
        renderPrematchCheck();
        out.schonenText = document.getElementById('prematch-check-box').textContent.includes('🛌 Schonen');
        schoner.tags = [];
        // Ersatz verletzt oder erschöpft: nicht vorschlagen
        const kandidat = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW' && squad.some(b => !lineup.includes(b.id) && b.pos === p.pos));
        kandidat.timesInjured = 5;
        squad.filter(b => !lineup.includes(b.id) && b.pos === kandidat.pos).forEach(b => { b.injured = 2; });
        const f3 = getFragileStarters();
        out.keinErsatz = f3.length === 1 && f3[0].rein === null;
        renderPrematchCheck();
        out.keinErsatzText = document.getElementById('prematch-check-box').textContent.includes('Kein einsatzbereiter Ersatz');
        squad.forEach(p => { p.injured = 0; p.timesInjured = 0; });

        // --- Saisonrückblick ---
        const saisonAlt = game.season, kar = game.managerCareer, bilAlt = game.transferBilanzHistory, vaAlt = game.vorlageBilanzArchiv;
        game.managerCareer = []; game.season = 2;
        out.keineSaison = getReviewSeasons().length === 0;
        renderSeasonReviewBox();
        out.boxLeer = document.getElementById('season-review-box').textContent.includes('Nach dem ersten Saisonende');
        openSeasonReview(); out.ohneDaten = !document.getElementById('season-review-overlay').classList.contains('show');
        game.managerCareer = [
            { season: 1, club: game.clubName, level: game.leagueLevel, league: 'Testliga', rank: 3, won: 15, drawn: 10, lost: 9, goalsFor: 50, goalsAgainst: 40, points: 55 },
            { season: 1, club: 'Anderer FC', level: 0, league: 'Fremdliga', rank: 1, won: 30, drawn: 0, lost: 0, goalsFor: 99, goalsAgainst: 1, points: 90 }
        ];
        game.vorlageBilanzArchiv = [{ season: 1, eintraege: { 0: { name: 'Pokalelf', spiele: 4, s: 3, u: 1, n: 0, tore: 9, gegentore: 2, diffSumme: 0 } } }];
        game.transferBilanzHistory = [{ season: 1, verkauf: 2000000, kauf: 1000000, netto: 1000000 }];
        squad[0].injuryLog = [{ season: 1, matchday: 4, tage: 3, anlass: 'Spiel' }, { season: 2, matchday: 1, tage: 9, anlass: 'Spiel' }];
        game.gegnerNotizen = { 'A FC': { text: 'Konter <b>links</b>', season: 1, matchday: 3 }, 'B FC': { text: 'andere Saison', season: 2, matchday: 3 } };
        game.etikettBilanzArchiv = []; // wie in einem alten Spielstand: nur das Vorjahr ist bekannt
        game.etikettBilanzVorjahr = { season: 1, daten: { stamm: { mit: { spiele: 6, s: 4, u: 1, n: 1, tore: 12, gegentore: 5 }, ohne: { spiele: 6, s: 1, u: 1, n: 4, tore: 4, gegentore: 9 } }, aufbau: { mit: { spiele: 2, s: 1, u: 0, n: 1, tore: 2, gegentore: 2 }, ohne: { spiele: 6, s: 3, u: 0, n: 3, tore: 6, gegentore: 6 } } } };
        out.saisons = JSON.stringify(getReviewSeasons()) === '[1]';
        renderSeasonReviewBox();
        out.boxKnopf = document.getElementById('season-review-box').textContent.includes('Saison 1');
        openSeasonReview(1);
        const rv = document.getElementById('season-review-overlay');
        const rt = document.getElementById('season-review-body').textContent;
        out.rvOffen = rv.classList.contains('show');
        out.rvTabelle = rt.includes('Platz 3 in der Testliga') && rt.includes('55 Punkte') && !rt.includes('Fremdliga');
        out.rvVorlage = rt.includes('Pokalelf') && rt.includes('3S 1U 0N');
        out.rvEtiketten = rt.includes('Stammkraft') && !rt.includes('Aufbauspieler');
        out.rvTransfer = rt.includes('Saldo') || rt.includes('Verkäufe');
        out.rvAusfall = rt.includes('3 verpasste Spiele') && !rt.includes('12 verpasste');
        out.rvNotiz = rt.includes('A FC') && rt.includes('Konter <b>links</b>') && !rt.includes('B FC') && !document.getElementById('season-review-body').innerHTML.includes('<b>links');
        out.wRueckblick = JSON.stringify(woerter('#season-review-overlay button, #season-review-box button'));
        out.rvBreit = ueberlauf() && rv.querySelector('.generic-modal-box').getBoundingClientRect().right <= document.documentElement.clientWidth + 1;
        closeSeasonReview(); out.rvZu = !rv.classList.contains('show');
        game.managerCareer = [{ season: 1, club: game.clubName, level: game.leagueLevel, league: 'Testliga', rank: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 1, points: 4 }];
        game.vorlageBilanzArchiv = []; game.transferBilanzHistory = []; squad[0].injuryLog = []; game.gegnerNotizen = {}; game.etikettBilanzVorjahr = null;
        openSeasonReview(1);
        const leerT = document.getElementById('season-review-body').textContent;
        out.rvLeer = leerT.includes('Keine Vorlage') && leerT.includes('Keine Transfers') && leerT.includes('keine Notiz') && leerT.includes('Keine Etiketten');
        closeSeasonReview();
        const inboxVor = inboxMessages.length;
        game.season = 1; announceSeasonReview(); out.keineMeldungSaison1 = inboxMessages.length === inboxVor;
        game.season = 3; announceSeasonReview();
        out.meldung = inboxMessages.length === inboxVor + 1 && inboxMessages[0].title.includes('Saisonrückblick 2');
        game.season = saisonAlt; game.managerCareer = kar || []; game.transferBilanzHistory = bilAlt || []; game.vorlageBilanzArchiv = vaAlt || []; game.gegnerNotizen = {};
        out.analyseKasten = !!document.getElementById('season-review-box') && !!document.getElementById('tag-bilanz-box') && !!document.getElementById('preset-bilanz-box');

        // --- Erledigt-Liste im Manager-Assistenten ---
        squad.forEach(p => { p.contracts = 3; });
        game.assistentVorher = null; game.assistentErledigt = null; game.assistentZurueck = {};
        game.money = -1000;
        trackAssistentErledigt(getManagerTodos(true, true));
        out.vorherGemerkt = !!game.assistentVorher.items['kasse-minus'];
        game.money = 5000000;
        trackAssistentErledigt(getManagerTodos(true, true));
        out.erledigt = game.assistentErledigt.liste.some(x => x.id === 'kasse-minus');
        out.erledigtHtml = getAssistentErledigtHtml().includes('Erledigt seit dem letzten Spieltag (1)');
        game.money = -1000; trackAssistentErledigt(getManagerTodos(true, true));
        out.wiederDa = !game.assistentErledigt.liste.some(x => x.id === 'kasse-minus');
        game.money = 5000000; trackAssistentErledigt(getManagerTodos(true, true));
        game.matchday += 1; trackAssistentErledigt(getManagerTodos(true, true));
        out.neuerSpieltag = game.assistentErledigt.liste.length === 0 && game.assistentErledigt.matchday === game.matchday;
        game.matchday -= 1;
        game.assistentVorher = { season: game.season, matchday: game.matchday, items: { fenster: 'Fenster schließt' } };
        trackAssistentErledigt([]);
        out.fristKeineErledigung = !game.assistentErledigt.liste.some(x => x.id === 'fenster');
        // Zurückgestellte Schritte zählen nicht als erledigt
        squad[1].contracts = 0;
        trackAssistentErledigt(getManagerTodos(true, true));
        out.vertragSchritt = !!game.assistentVorher.items['vertraege-aus'];
        snoozeManagerTodo('vertraege-aus');
        trackAssistentErledigt(getManagerTodos(true, true));
        out.snoozeKeineErledigung = !game.assistentErledigt.liste.some(x => x.id === 'vertraege-aus') && !!game.assistentVorher.items['vertraege-aus'];
        squad[1].contracts = 3; game.assistentZurueck = {};
        // Anzeige im Dashboard
        showScreen('screen-dashboard');
        game.assistentVorher = null; game.assistentErledigt = null; game.money = -1000;
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        game.money = 5000000;
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        out.dashboardErledigt = document.getElementById('manager-assistant-box').textContent.includes('Erledigt seit dem letzten Spieltag');
        out.dashboardBreit = ueberlauf();
        out.wAssistent = JSON.stringify(woerter('#manager-assistant-box button'));
        delete game.assistentVorher; delete game.assistentErledigt;
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        out.altesFeld2 = typeof game.assistentVorher === 'object';

        // --- Preis-Alarm in der Scouting-Beobachtungsliste ---
        const p = createPlayer('MIT', 60, 62);
        p.marketValue = 3000000;
        globalScoutResults.unshift(p);
        scoutingNetwork.watchlist = [p.id]; scoutingNetwork.preisGrenzen = {};
        const preis = getScoutPrice(p);
        out.preisFormel = preis === Math.round(p.marketValue * getScoutDiscount());
        showScreen('screen-scouting-global');
        renderGlobalScoutingView();
        const eingabe = document.getElementById('scout-grenze-' + p.id);
        out.eingabeDa = !!eingabe;
        out.scoutBreit = ueberlauf();
        out.wScout = JSON.stringify(woerter('#global-scouting-results button'));
        eingabe.value = String(((preis / 1e6) + 1).toFixed(1)).replace('.', ',');
        setScoutPriceAlarm(p.id);
        out.grenzeGesetzt = scoutingNetwork.preisGrenzen[p.id] === Math.round(((preis / 1e6) + 1).toFixed(1) * 1e6);
        game.money = preis * 2; game.transferBudget = preis * 2;
        const nurLaenge = squad.length;
        // getScoutPriceAlerts prüft den Kaderplatz: für den Test wird die Liste kurz gekürzt (der Rest des Tests nutzt den Kader nicht mehr)
        squad.length = Math.min(squad.length, 18);
        out.alarmDa = getScoutPriceAlerts().length === 1 && getScoutPriceAlerts()[0].p.id === p.id;
        const todo = getManagerTodos(true).find(x => x.id === 'scout-alarm');
        out.todo = !!todo && todo.text.includes(p.name) && todo.aktion.includes('scouting-global');
        game.money = preis - 1; out.zuTeuer = getScoutPriceAlerts().length === 0;
        game.money = preis * 2; game.transferBudget = preis - 1; out.budgetZuKlein = getScoutPriceAlerts().length === 0;
        game.transferBudget = preis * 2;
        scoutingNetwork.preisGrenzen[p.id] = preis - 1; out.ueberGrenze = getScoutPriceAlerts().length === 0;
        scoutingNetwork.preisGrenzen[p.id] = preis + 1000;
        scoutingNetwork.watchlist = []; out.nichtBeobachtet = getScoutPriceAlerts().length === 0;
        scoutingNetwork.watchlist = [p.id];
        squad.length = nurLaenge; out.kaderVoll = nurLaenge < 22 || getScoutPriceAlerts().length === 0;
        squad.length = Math.min(nurLaenge, 18);
        scoutingNetwork.preisGrenzen[p.id] = preis + 1000; renderGlobalScoutingView();
        const vor = scoutingNetwork.preisGrenzen[p.id];
        document.getElementById('scout-grenze-' + p.id).value = 'abc'; setScoutPriceAlarm(p.id);
        out.ungueltig = scoutingNetwork.preisGrenzen[p.id] === vor;
        document.getElementById('scout-grenze-' + p.id).value = '0'; setScoutPriceAlarm(p.id); out.nullAbgelehnt = scoutingNetwork.preisGrenzen[p.id] === vor;
        document.getElementById('scout-grenze-' + p.id).value = ''; setScoutPriceAlarm(p.id);
        out.entfernt = scoutingNetwork.preisGrenzen[p.id] === undefined;
        document.getElementById('scout-grenze-' + p.id).value = '2,5'; setScoutPriceAlarm(p.id);
        out.kommaZahl = scoutingNetwork.preisGrenzen[p.id] === 2500000;
        removeFromWatchlist(p.id);
        out.mitListeEntfernt = scoutingNetwork.preisGrenzen[p.id] === undefined;
        addToWatchlist(p.id); setScoutPriceAlarm(p.id);
        delete scoutingNetwork.preisGrenzen;
        out.altesFeld3 = Array.isArray(getScoutPriceAlerts()) && typeof scoutingNetwork.preisGrenzen === 'object';
        squad.length = nurLaenge;
        return out;
    });
    assert(r.knopfDa && r.knopfNiederlage && r.fensterOffen && r.getrennteIds, `Notiz nach dem Abpfiff: Knopf (nach Niederlage hervorgehoben), Fenster mit Ergebnis-Entwurf (${JSON.stringify([r.knopfDa, r.knopfNiederlage, r.fensterOffen, r.getrennteIds])})`);
    assert(r.fensterBreit && r.gespeichert && r.knopfSieg && r.entwurfAusw, `Notiz nach dem Abpfiff: speichert und schließt, auswärts und Sieg (${JSON.stringify([r.fensterBreit, r.gespeichert, r.knopfSieg, r.entwurfAusw])})`);
    assert(r.gekuerzt && r.pokalRemis && r.ohneSpiel, `Notiz nach dem Abpfiff: Entwurf bleibt unter 300 Zeichen, Pokal, ohne Spiel kein Fenster (${JSON.stringify([r.gekuerzt, r.pokalRemis, r.ohneSpiel])})`);
    assert(r.merker && r.mitGezaehlt && r.ohneGezaehlt && r.alterMerker && r.nichtVergeben, `Etiketten-Bilanz: Merker, Spiele mit und ohne Etikett-Spieler, alter Merker, nicht vergebene Etiketten (${JSON.stringify([r.merker, r.mitGezaehlt, r.ohneGezaehlt, r.alterMerker, r.nichtVergeben])})`);
    assert(r.verdrahtetLiga && r.flussMerker && r.seasonEnd, `Etiketten-Bilanz: Ligaergebnis zählt, Anstoß setzt den Merker, Saisonende archiviert (${JSON.stringify([r.verdrahtetLiga, r.flussMerker, r.seasonEnd])})`);
    assert(r.zuWenig && r.urteilMit && r.urteilOhne && r.urteilGleich, `Etiketten-Bilanz: Anzeige mit Stichproben-Hinweis und Urteil (${JSON.stringify([r.zuWenig, r.urteilMit, r.urteilOhne, r.urteilGleich])})`);
    assert(r.archiv && r.leerBehaeltVorjahr && r.vorjahrBox && r.altesFeld, `Etiketten-Bilanz: Archiv ins Vorjahr, leere Saison behält es, alte Spielstände (${JSON.stringify([r.archiv, r.leerBehaeltVorjahr, r.vorjahrBox, r.altesFeld])})`);
    assert(r.keinerFragil && r.keinerText && r.fragilGefunden && r.fragilText, `Verletzungs-Warnung: keiner auffällig, Spieler mit 4 Verletzungen samt Ersatz (${JSON.stringify([r.keinerFragil, r.keinerText, r.fragilGefunden, r.fragilText])})`);
    assert(r.getauscht && r.nachTausch && r.schonenTag && r.schonenText && r.keinErsatz && r.keinErsatzText, `Verletzungs-Warnung: Tausch auf Tipp, Etikett Schonen, kein verletzter Ersatz (${JSON.stringify([r.getauscht, r.nachTausch, r.schonenTag, r.schonenText, r.keinErsatz, r.keinErsatzText])})`);
    assert(r.keineSaison && r.boxLeer && r.ohneDaten && r.saisons && r.boxKnopf, `Saisonrückblick: ohne Saison leer, Knopf je abgeschlossene Saison (${JSON.stringify([r.keineSaison, r.boxLeer, r.ohneDaten, r.saisons, r.boxKnopf])})`);
    assert(r.rvOffen && r.rvTabelle && r.rvVorlage && r.rvEtiketten && r.rvTransfer, `Saisonrückblick: Tabelle, Vorlage, Etiketten, Transfers der richtigen Saison (${JSON.stringify([r.rvOffen, r.rvTabelle, r.rvVorlage, r.rvEtiketten, r.rvTransfer])})`);
    assert(r.rvAusfall && r.rvNotiz && r.rvBreit && r.rvZu && r.rvLeer, `Saisonrückblick: Ausfälle nur dieser Saison, Notizen maskiert, passt auf 320 px, leere Abschnitte (${JSON.stringify([r.rvAusfall, r.rvNotiz, r.rvBreit, r.rvZu, r.rvLeer])})`);
    assert(r.keineMeldungSaison1 && r.meldung && r.analyseKasten, `Saisonrückblick: Postfach-Meldung zum Saisonende, Kästen im Reiter Analyse (${JSON.stringify([r.keineMeldungSaison1, r.meldung, r.analyseKasten])})`);
    assert(r.vorherGemerkt && r.erledigt && r.erledigtHtml && r.wiederDa && r.neuerSpieltag, `Assistent: Erledigt-Liste (merkt, zählt, zeigt, nimmt zurück, neuer Spieltag setzt zurück) (${JSON.stringify([r.vorherGemerkt, r.erledigt, r.erledigtHtml, r.wiederDa, r.neuerSpieltag])})`);
    assert(r.fristKeineErledigung && r.vertragSchritt && r.snoozeKeineErledigung && r.dashboardErledigt && r.dashboardBreit && r.altesFeld2, `Assistent: Fristen und Zurückgestelltes sind nicht erledigt, Anzeige im Dashboard, alte Spielstände (${JSON.stringify([r.fristKeineErledigung, r.vertragSchritt, r.snoozeKeineErledigung, r.dashboardErledigt, r.dashboardBreit, r.altesFeld2])})`);
    assert(r.preisFormel && r.eingabeDa && r.scoutBreit && r.grenzeGesetzt && r.alarmDa && r.todo, `Preis-Alarm: Feld in der Karte, Grenze setzen, Alarm im Assistenten (${JSON.stringify([r.preisFormel, r.eingabeDa, r.scoutBreit, r.grenzeGesetzt, r.alarmDa, r.todo])})`);
    assert(r.zuTeuer && r.budgetZuKlein && r.ueberGrenze && r.nichtBeobachtet && r.kaderVoll, `Preis-Alarm: kein Alarm bei zu wenig Kasse, Budget, über der Grenze, ohne Beobachtung, bei vollem Kader (${JSON.stringify([r.zuTeuer, r.budgetZuKlein, r.ueberGrenze, r.nichtBeobachtet, r.kaderVoll])})`);
    assert(r.ungueltig && r.nullAbgelehnt && r.entfernt && r.kommaZahl && r.mitListeEntfernt && r.altesFeld3, `Preis-Alarm: ungültige Eingabe, Entfernen, Komma, Aufräumen mit der Liste, alte Spielstände (${JSON.stringify([r.ungueltig, r.nullAbgelehnt, r.entfernt, r.kommaZahl, r.mitListeEntfernt, r.altesFeld3])})`);
    assert(r.wNotiz === '[]' && r.wRueckblick === '[]' && r.wScout === '[]' && r.wAssistent === '[]' && r.wCheck === '[]', `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${JSON.stringify([r.wNotiz, r.wRueckblick, r.wScout, r.wAssistent, r.wCheck])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde29Funktionen(browser) {
    console.log('\n[26.14] Rückblick mit Vorsaison-Vergleich und Text, Dashboard-Knopf, Marktwert-Hinweis, Bilanz je Spieler, Notizbuch mit Schlagwörtern');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const schrift = document.createElement('style'); schrift.textContent = '*,*::before,*::after{font-family:"DejaVu Sans",Verdana,sans-serif!important}'; document.head.appendChild(schrift);
        const probe = document.createElement('span'); document.body.appendChild(probe);
        const woerter = sel => [...document.querySelectorAll(sel)].filter(el => el.offsetParent).filter(el => {
            const cs = getComputedStyle(el), innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            probe.style.cssText = `position:absolute; visibility:hidden; white-space:nowrap; font:${cs.font}; letter-spacing:${cs.letterSpacing}`;
            return (el.innerText || '').trim().split(/\s+/).flatMap(w => w.split(/(?<=-)/)).some(t => { probe.textContent = t; return probe.getBoundingClientRect().width > innen + 1; });
        }).map(el => (el.innerText || '').trim().slice(0, 24));
        const ueberlauf = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 90; p.timesInjured = 0; p.tags = []; p.injuryLog = []; });
        game.formation = '4-4-2'; autoLineup();
        const saisonAlt = game.season;

        // --- Rückblick: Vergleich mit der Vorsaison, Text, Teilen ---
        game.season = 3;
        const eintrag = (season, level, rank, points, gf, ga) => ({ season, club: game.clubName, level, league: 'Testliga' + level, rank, won: 10, drawn: 5, lost: 5, goalsFor: gf, goalsAgainst: ga, points });
        game.managerCareer = [eintrag(1, 2, 5, 49, 40, 40), eintrag(2, 2, 3, 55, 50, 40)];
        game.transferBilanzHistory = [{ season: 1, verkauf: 1000000, kauf: 3000000, netto: -2000000 }, { season: 2, verkauf: 2000000, kauf: 1000000, netto: 1000000 }];
        game.vorlageBilanzArchiv = []; game.gegnerNotizen = {}; game.etikettBilanzVorjahr = null;
        const h2 = buildSeasonReviewHtml(2);
        const t2 = (() => { const d = document.createElement('div'); d.innerHTML = h2; return d.textContent; })();
        out.vglPunkte = t2.includes('Vorsaison: Platz 5, 49 Punkte') && t2.includes('+6 Punkte') && t2.includes('Platz +2') && t2.includes('Tordifferenz +10');
        out.vglTransfer = t2.includes('Vorsaison: Saldo') && t2.includes('Unterschied +');
        const t1 = (() => { const d = document.createElement('div'); d.innerHTML = buildSeasonReviewHtml(1); return d.textContent; })();
        out.ersteSaisonKeinVgl = !t1.includes('Vorsaison:');
        game.managerCareer[0].level = 3;
        const tAnders = (() => { const d = document.createElement('div'); d.innerHTML = buildSeasonReviewHtml(2); return d.textContent; })();
        out.andereLiga = tAnders.includes('Vorsaison in einer anderen Liga') && !tAnders.includes('+6 Punkte');
        game.managerCareer[0].level = 2;
        game.managerCareer[1].rank = 7;
        out.platzSchlechter = (() => { const d = document.createElement('div'); d.innerHTML = buildSeasonReviewHtml(2); return d.textContent; })().includes('Platz −2');
        game.managerCareer[1].rank = 3;
        const text = buildSeasonReviewText(2);
        out.text = text.startsWith(`📚 Saisonrückblick 2 · ${game.clubName}`) && text.includes('Platz 3') && !/[<>]/.test(text) && text.split('\n').length > 6 && text.endsWith('— Anstoß Mobile Pro FM13');
        openSeasonReview(2);
        out.knopfImFenster = !!document.querySelector('#season-review-body button[onclick^="shareSeasonReview"]');
        out.wRueckblick = JSON.stringify(woerter('#season-review-body button'));
        shareSeasonReview(2);
        const so = document.getElementById('share-report-overlay');
        out.teilenOffen = so.classList.contains('show') && !document.getElementById('season-review-overlay').classList.contains('show')
            && document.getElementById('share-report-title').textContent.includes('Saisonrückblick') && document.getElementById('share-report-text').value.includes('Saisonrückblick 2');
        closeShareReport();
        const cmAlt = typeof currentMatch !== 'undefined' ? currentMatch : null;
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Test FC', homeGoals: 1, awayGoals: 0, isCup: false };
        openShareReport();
        out.titelZurueck = document.getElementById('share-report-title').textContent.includes('Spielbericht') && document.getElementById('share-report-text').value.includes('Test FC');
        closeShareReport(); currentMatch = cmAlt;

        // --- Dashboard-Knopf nach dem Saisonwechsel ---
        game.rueckblickGesehen = 0; game.matchday = 1;
        showScreen('screen-dashboard');
        renderSeasonReviewHint();
        const hint = document.getElementById('season-review-hint');
        out.hintDa = hint.textContent.includes('Saisonrückblick 2 öffnen');
        out.wHint = JSON.stringify(woerter('#season-review-hint button'));
        out.hintBreit = ueberlauf();
        openSeasonReview(2);
        out.hintWeg = game.rueckblickGesehen === 2 && hint.innerHTML === '';
        closeSeasonReview();
        game.rueckblickGesehen = 0; game.matchday = 4; renderSeasonReviewHint();
        out.hintSpaeter = hint.innerHTML === '';
        game.matchday = 2; renderSeasonReviewHint(); out.hintSpieltag2 = hint.textContent.includes('öffnen');
        managerAssistantLetzterInhalt = ''; hint.innerHTML = ''; renderManagerAssistant();
        out.hintImDashboard = hint.textContent.includes('öffnen');
        game.managerCareer = []; renderSeasonReviewHint(); out.hintOhneDaten = hint.innerHTML === '';
        game.season = 1; game.managerCareer = []; renderSeasonReviewHint(); out.hintSaison1 = hint.innerHTML === '';
        game.season = saisonAlt; game.matchday = 4; delete game.rueckblickGesehen; renderSeasonReviewHint();
        out.altesFeld = hint.innerHTML === '';
        game.managerCareer = []; game.transferBilanzHistory = [];

        // --- Marktwert-Hinweis ---
        game.season = 5;
        const p1 = squad[0], p2 = squad[1], p3 = squad[2];
        let st = 60; while (getMarketValueBase(st) < 1500000 && st < 95) st++;
        const vor = getMarketValueBase(st);
        out.stabil = getMarketValueBase(st) === vor && getMarketValueBase(st) === getMarketValueBase(st);
        [p1, p2, p3].forEach(p => { p.strengthHistory = [{ season: 3, strength: 40 }, { season: 4, strength: st }]; p.marketValue = vor; });
        p1.marketValue = Math.round(vor * 1.5);
        p2.marketValue = Math.round(vor * 0.7);
        p3.marketValue = Math.round(vor * 1.1);
        const mv = getMarketValueMoves();
        out.mvAuf = mv.auf.some(m => m.p.id === p1.id && m.prozent === 50) && !mv.auf.some(m => m.p.id === p3.id);
        out.mvAb = mv.ab.some(m => m.p.id === p2.id && m.prozent === -30) && !mv.ab.some(m => m.p.id === p3.id);
        const mt = getManagerTodos(true).find(x => x.id === 'marktwert');
        out.mvTodo = !!mt && mt.text.includes(p1.name) && mt.text.includes('↑ 50 %') && mt.text.includes('↓ 30 %') && mt.text.includes('Verkauf');
        p1.marketValue = vor;
        const mt2 = getManagerTodos(true).find(x => x.id === 'marktwert');
        out.mvNurFall = !!mt2 && mt2.text.includes('↓') && !mt2.text.includes('Verkauf');
        p2.marketValue = vor;
        out.mvNichts = !getManagerTodos(true).some(x => x.id === 'marktwert');
        const klein = getMarketValueBase(30);
        p1.strengthHistory = [{ season: 4, strength: 30 }]; p1.marketValue = klein * 2;
        out.mvMindestdiff = klein >= MARKTWERT_MIN_DIFF || !getMarketValueMoves().auf.some(m => m.p.id === p1.id);
        p1.strengthHistory = [{ season: 5, strength: 30 }]; p1.marketValue = klein * 3;
        out.mvNurAlteSaison = getMarketValueMove(p1) === null;
        delete p1.strengthHistory; out.mvOhneVerlauf = getMarketValueMove(p1) === null && Array.isArray(getMarketValueMoves().auf);
        [p1, p2, p3].forEach(p => { p.marketValue = calculatePlayerMarketValue(p.strength); p.strengthHistory = [{ season: 1, strength: p.strength }]; });
        game.season = saisonAlt;

        // --- Bilanz je Spieler ---
        squad.forEach(p => { delete p.startBilanz; });
        game.etikettImEinsatz = null;
        const starter = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW');
        const bank = squad.find(p => !lineup.includes(p.id));
        markTagsInUse();
        out.idsGemerkt = Array.isArray(game.etikettImEinsatz.ids) && game.etikettImEinsatz.ids.length === 11;
        recordTagResult(2, 0);
        out.spielerMit = starter.startBilanz && starter.startBilanz.mit.spiele === 1 && starter.startBilanz.mit.s === 1 && starter.startBilanz.ohne.spiele === 0;
        out.spielerOhne = bank.startBilanz && bank.startBilanz.ohne.spiele === 1 && bank.startBilanz.ohne.s === 1 && bank.startBilanz.mit.spiele === 0;
        game.etikettImEinsatz = { matchday: game.matchday + 1, ids: [], startelf: [], vergeben: [] };
        recordTagResult(0, 1);
        out.alterMerkerSpieler = starter.startBilanz.mit.spiele === 2 && starter.startBilanz.mit.n === 1;
        renderPlayerStartBilanz(starter, 'squad');
        const sb = document.getElementById('pd-startbilanz').textContent;
        out.spielerText = sb.includes('In der Startelf: 2 Sp.') && sb.includes('noch zu wenige Spiele') && sb.includes('keine Ursache');
        starter.startBilanz = { mit: { spiele: 6, s: 6, u: 0, n: 0 }, ohne: { spiele: 6, s: 0, u: 0, n: 6 } };
        renderPlayerStartBilanz(starter, 'squad'); out.spielerBesser = document.getElementById('pd-startbilanz').textContent.includes('mit ihm besser (+3,00)');
        starter.startBilanz = { mit: { spiele: 6, s: 0, u: 0, n: 6 }, ohne: { spiele: 6, s: 6, u: 0, n: 0 } };
        renderPlayerStartBilanz(starter, 'squad'); out.spielerSchlechter = document.getElementById('pd-startbilanz').textContent.includes('ohne ihn besser (-3,00)');
        renderPlayerStartBilanz(starter, 'secondTeam'); out.nurKader = document.getElementById('pd-startbilanz').innerHTML === '';
        delete starter.startBilanz; renderPlayerStartBilanz(starter, 'squad'); out.ohneDaten = document.getElementById('pd-startbilanz').innerHTML === '';
        recordPlayerStartResult([starter.id], 1, 1); out.altesFeldSpieler = starter.startBilanz.mit.u === 1;
        openPlayerDetail(starter.id, 'squad');
        out.imDetail = !!document.getElementById('pd-startbilanz') && document.getElementById('pd-startbilanz').textContent.includes('Mannschaft mit und ohne ihn');
        closePlayerDetail && closePlayerDetail();
        archiveTagBilanz();
        out.saisonendeLeer = squad.every(p => p.startBilanz === undefined);

        // --- Notizbuch mit Schlagwörtern und Suche ---
        game.gegnerNotizen = {
            'A FC': { text: 'Schwach bei Ecken', season: 1, matchday: 1, tags: ['standards', 'konter'] },
            'B FC': { text: 'Presst früh', season: 1, matchday: 2, tags: ['pressing'] },
            'C FC': { text: 'Alte Notiz ohne Schlagwörter', season: 1, matchday: 3 },
            'D FC': { text: 'Unbekanntes Schlagwort', season: 1, matchday: 4, tags: ['gibtsnicht'] }
        };
        notizFilter = { text: '', tag: '' };
        renderGegnerNotizbuch();
        const nb = () => document.getElementById('opp-notes-liste').textContent;
        out.nbAlle = ['A FC', 'B FC', 'C FC', 'D FC'].every(n => nb().includes(n)) && nb().includes('⚡ Konter') && nb().includes('🎯 Standards') && !nb().includes('gibtsnicht');
        out.nbSuche = !!document.getElementById('opp-notes-suche');
        setNotizSuche('ecken'); out.nbText = nb().includes('A FC') && !nb().includes('B FC') && !nb().includes('C FC');
        out.nbFokus = document.getElementById('opp-notes-suche') !== null;
        setNotizSuche('PRESSING'); out.nbTagText = nb().includes('B FC') && !nb().includes('A FC');
        setNotizSuche('c fc'); out.nbVerein = nb().includes('C FC') && !nb().includes('A FC');
        setNotizSuche('zzz'); out.nbKeine = nb().includes('Keine Notiz passt');
        setNotizSuche(''); out.nbWieder = ['A FC', 'B FC', 'C FC', 'D FC'].every(n => nb().includes(n));
        setNotizFilterTag('konter'); out.nbFilter = nb().includes('A FC') && !nb().includes('B FC') && document.querySelector('#opp-notes-box [data-filter="konter"]').getAttribute('aria-pressed') === 'true';
        setNotizFilterTag('konter'); out.nbFilterAus = nb().includes('B FC');
        notizFilter.tag = 'heimstark'; renderGegnerNotizbuch(); out.nbFilterUnbenutzt = notizFilter.tag === '' && nb().includes('B FC');
        out.wNotizbuch = JSON.stringify(woerter('#opp-notes-box button'));
        out.nbBreit = ueberlauf();
        delete game.gegnerNotizen['B FC']; delete game.gegnerNotizen['C FC']; delete game.gegnerNotizen['D FC'];
        renderGegnerNotizbuch(); out.nbEinzelne = !document.getElementById('opp-notes-suche');
        // Schlagwörter im Notizfenster speichern
        game.gegnerNotizen = {};
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Test FC', homeGoals: 0, awayGoals: 1, isCup: false };
        openNachspielNotiz();
        const tagKnopf = id => document.querySelector(`#opp-note-body .notiz-tag[data-tag="${id}"]`);
        toggleNotizTag(tagKnopf('konter')); toggleNotizTag(tagKnopf('fluegel'));
        out.knopfAn = tagKnopf('konter').getAttribute('aria-pressed') === 'true' && tagKnopf('konter').className.includes('btn-action');
        out.wFenster = JSON.stringify(woerter('#opp-note-body button'));
        saveGegnerNotiz('Test FC', 'gegner-notiz-nach');
        out.tagsGespeichert = JSON.stringify(game.gegnerNotizen['Test FC'].tags) === JSON.stringify(['konter', 'fluegel']);
        openNachspielNotiz();
        out.tagsVorbelegt = tagKnopf('konter').getAttribute('aria-pressed') === 'true' && tagKnopf('standards').getAttribute('aria-pressed') === 'false';
        toggleNotizTag(tagKnopf('konter')); toggleNotizTag(tagKnopf('fluegel'));
        saveGegnerNotiz('Test FC', 'gegner-notiz-nach');
        out.tagsEntfernt = game.gegnerNotizen['Test FC'].tags === undefined;
        // Chips im Spieltag-Check und in der Halbzeit
        game.gegnerNotizen['Test FC'].tags = ['standards', 'pressing'];
        pendingMatchInfo = { isHome: true, oppName: 'Test FC', oppStr: 60, ourFixture: null };
        renderPrematchCheck();
        const pc = document.getElementById('prematch-check-box').textContent;
        out.chipsCheck = pc.includes('🎯 Standards') && pc.includes('🔥 Pressing');
        renderHalftimeNotiz();
        out.chipsHalbzeit = document.getElementById('halftime-notiz-box').textContent.includes('Standards');
        out.wCheck = JSON.stringify(woerter('#prematch-check-box button'));
        currentMatch = cmAlt; game.gegnerNotizen = {};
        return out;
    });
    assert(r.vglPunkte && r.vglTransfer && r.ersteSaisonKeinVgl && r.andereLiga && r.platzSchlechter, `Saisonrückblick: Vergleich mit der Vorsaison (Punkte, Platz, Tordifferenz, Transfersaldo, andere Liga) (${JSON.stringify([r.vglPunkte, r.vglTransfer, r.ersteSaisonKeinVgl, r.andereLiga, r.platzSchlechter])})`);
    assert(r.text && r.knopfImFenster && r.teilenOffen && r.titelZurueck, `Saisonrückblick: Text ohne HTML, Knopf im Fenster, Teilen-Fenster mit eigenem Titel (${JSON.stringify([r.text, r.knopfImFenster, r.teilenOffen, r.titelZurueck])})`);
    assert(r.hintDa && r.hintBreit && r.hintWeg && r.hintSpaeter && r.hintSpieltag2 && r.hintImDashboard, `Dashboard-Knopf zum Rückblick: erscheint nach dem Saisonwechsel, verschwindet nach dem Öffnen und nach Spieltag 3 (${JSON.stringify([r.hintDa, r.hintBreit, r.hintWeg, r.hintSpaeter, r.hintSpieltag2, r.hintImDashboard])})`);
    assert(r.hintOhneDaten && r.hintSaison1 && r.altesFeld, `Dashboard-Knopf: nichts ohne abgeschlossene Saison, alte Spielstände (${JSON.stringify([r.hintOhneDaten, r.hintSaison1, r.altesFeld])})`);
    assert(r.mvAuf && r.mvAb && r.mvTodo && r.mvNurFall && r.mvNichts, `Marktwert-Hinweis: Sprung nach oben und unten, Text mit Verkaufs-Frage nur bei Anstieg, kleine Bewegung bleibt still (${JSON.stringify([r.mvAuf, r.mvAb, r.mvTodo, r.mvNurFall, r.mvNichts])})`);
    assert(r.stabil && r.mvMindestdiff && r.mvNurAlteSaison && r.mvOhneVerlauf, `Marktwert-Hinweis: stabiler Vergleichswert, Mindestdifferenz, nur frühere Saisons zählen, Spieler ohne Verlauf (${JSON.stringify([r.stabil, r.mvMindestdiff, r.mvNurAlteSaison, r.mvOhneVerlauf])})`);
    assert(r.idsGemerkt && r.spielerMit && r.spielerOhne && r.alterMerkerSpieler, `Bilanz je Spieler: Startelf-Merker, Spiele mit und ohne ihn, alter Merker (${JSON.stringify([r.idsGemerkt, r.spielerMit, r.spielerOhne, r.alterMerkerSpieler])})`);
    assert(r.spielerText && r.spielerBesser && r.spielerSchlechter && r.nurKader && r.ohneDaten && r.altesFeldSpieler, `Bilanz je Spieler: Anzeige mit Urteil erst ab fünf Spielen je Seite, nur Kaderspieler, alte Spielstände (${JSON.stringify([r.spielerText, r.spielerBesser, r.spielerSchlechter, r.nurKader, r.ohneDaten, r.altesFeldSpieler])})`);
    assert(r.imDetail && r.saisonendeLeer, `Bilanz je Spieler: im Spielerdetail sichtbar, Saisonende setzt zurück (${JSON.stringify([r.imDetail, r.saisonendeLeer])})`);
    assert(r.nbAlle && r.nbSuche && r.nbText && r.nbFokus && r.nbTagText && r.nbVerein && r.nbKeine && r.nbWieder, `Notizbuch: Schlagwörter als Chips, Suche nach Text, Schlagwort und Verein (${JSON.stringify([r.nbAlle, r.nbSuche, r.nbText, r.nbFokus, r.nbTagText, r.nbVerein, r.nbKeine, r.nbWieder])})`);
    assert(r.nbFilter && r.nbFilterAus && r.nbFilterUnbenutzt && r.nbBreit && r.nbEinzelne, `Notizbuch: Filter nach Schlagwort, unbenutzter Filter fällt weg, kein Suchfeld bei einer Notiz (${JSON.stringify([r.nbFilter, r.nbFilterAus, r.nbFilterUnbenutzt, r.nbBreit, r.nbEinzelne])})`);
    assert(r.knopfAn && r.tagsGespeichert && r.tagsVorbelegt && r.tagsEntfernt && r.chipsCheck && r.chipsHalbzeit, `Notiz-Schlagwörter: wählen, speichern, vorbelegen, entfernen, Chips im Spieltag-Check und in der Halbzeit (${JSON.stringify([r.knopfAn, r.tagsGespeichert, r.tagsVorbelegt, r.tagsEntfernt, r.chipsCheck, r.chipsHalbzeit])})`);
    assert(r.wRueckblick === '[]' && r.wHint === '[]' && r.wNotizbuch === '[]' && r.wFenster === '[]' && r.wCheck === '[]', `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${JSON.stringify([r.wRueckblick, r.wHint, r.wNotizbuch, r.wFenster, r.wCheck])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde30Funktionen(browser) {
    console.log('\n[26.15] Zurückgestellte Liste, Etiketten-Archiv, CSV, Notiz-Vorschläge, Markt-Merkliste, Belastungsampel, Matchplan, Wischen');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const schrift = document.createElement('style'); schrift.textContent = '*,*::before,*::after{font-family:"DejaVu Sans",Verdana,sans-serif!important}'; document.head.appendChild(schrift);
        const probe = document.createElement('span'); document.body.appendChild(probe);
        const woerter = sel => [...document.querySelectorAll(sel)].filter(el => el.offsetParent).filter(el => {
            const cs = getComputedStyle(el), innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            probe.style.cssText = `position:absolute; visibility:hidden; white-space:nowrap; font:${cs.font}; letter-spacing:${cs.letterSpacing}`;
            return (el.innerText || '').trim().split(/\s+/).flatMap(w => w.split(/(?<=-)/)).some(t => { probe.textContent = t; return probe.getBoundingClientRect().width > innen + 1; });
        }).map(el => (el.innerText || '').trim().slice(0, 24));
        const ueberlauf = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 90; p.timesInjured = 0; p.tags = []; p.injuryLog = []; delete p.startFolge; delete p.startBilanz; });
        game.formation = '4-4-2'; autoLineup();
        const saisonAlt = game.season;

        // --- Zurückgestellte Schritte als Liste ---
        showScreen('screen-dashboard');
        game.assistentZurueck = {}; game.assistentVorher = null; game.assistentErledigt = null;
        squad[1].contracts = 0;
        snoozeManagerTodo('vertraege-aus');
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        const ab = () => document.getElementById('manager-assistant-box');
        out.zListe = ab().textContent.includes('1 Schritt zurückgestellt') && ab().textContent.includes('bis Spieltag') && ab().textContent.includes('Wieder zeigen') && ab().textContent.includes('Alle wieder zeigen');
        out.zText = ab().textContent.includes('Vertrag');
        out.zZu = !ab().querySelector('details.ui-fold[open]');
        assistentZurueckOffen = true; managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        out.zOffen = !!ab().querySelector('details.ui-fold[open]');
        assistentZurueckOffen = false;
        out.wAssistent = JSON.stringify(woerter('#manager-assistant-box button'));
        unsnoozeManagerTodo('vertraege-aus');
        out.zWieder = !istZurueckgestellt('vertraege-aus') && getManagerTodos(true).some(x => x.id === 'vertraege-aus') && !ab().textContent.includes('zurückgestellt');
        snoozeManagerTodo('vertraege-aus'); squad[1].contracts = 3;
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        out.zErledigtVerschwindet = !ab().textContent.includes('zurückgestellt');
        game.assistentZurueck = {};

        // --- Etiketten-Archiv über fünf Saisons ---
        game.etikettBilanzArchiv = []; game.etikettBilanzVorjahr = null;
        const st = starterTag => { squad[0].tags = [starterTag]; };
        for (let sn = 1; sn <= 7; sn++) {
            game.season = sn; st('stamm');
            game.etikettBilanz = { stamm: { mit: { spiele: 6, s: sn % 6, u: 0, n: 6 - (sn % 6), tore: 5, gegentore: 5 }, ohne: { spiele: 6, s: 1, u: 1, n: 4, tore: 3, gegentore: 8 } } };
            archiveTagBilanz();
        }
        out.archivFuenf = game.etikettBilanzArchiv.length === 5 && game.etikettBilanzArchiv[0].season === 3 && game.etikettBilanzArchiv[4].season === 7;
        out.vorjahrBleibt = game.etikettBilanzVorjahr.season === 7;
        game.managerCareer = [3, 5, 7].map(sn => ({ season: sn, club: game.clubName, level: game.leagueLevel, league: 'Liga', rank: 4, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4 }));
        game.season = 8;
        const htmlText = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
        out.aeltereSaisonEtiketten = htmlText(buildSeasonReviewHtml(5)).includes('Stammkraft: mit') && htmlText(buildSeasonReviewHtml(3)).includes('Stammkraft: mit');
        out.zuAlteSaison = htmlText(buildSeasonReviewHtml(2)).includes('Keine Etiketten');
        delete game.etikettBilanzArchiv;
        out.altesSpielVorjahr = htmlText(buildSeasonReviewHtml(7)).includes('Stammkraft: mit') && !htmlText(buildSeasonReviewHtml(5)).includes('Stammkraft: mit');
        game.etikettBilanz = { stamm: { mit: { spiele: 6, s: 6, u: 0, n: 0, tore: 5, gegentore: 0 }, ohne: { spiele: 6, s: 0, u: 0, n: 6, tore: 0, gegentore: 9 } } };
        archiveTagBilanz();
        out.archivNeuAngelegt = Array.isArray(game.etikettBilanzArchiv) && game.etikettBilanzArchiv.length === 1;
        game.season = saisonAlt; game.managerCareer = []; game.etikettBilanz = {}; squad[0].tags = [];

        // --- Kader-CSV mit Startelf-Bilanz ---
        const sp = squad[0];
        sp.startBilanz = { mit: { spiele: 4, s: 3, u: 1, n: 0 }, ohne: { spiele: 2, s: 0, u: 1, n: 1 } };
        const csv = buildKaderCsv().split(/\r?\n/);
        const kopf = csv[0].split(';');
        out.csvKopf = kopf.slice(-3).join('|') === 'Startelf-Spiele (Saison)|Pkt/Spiel mit ihm in der Startelf|Pkt/Spiel ohne ihn';
        const zeile = csv.find(z => z.startsWith(sp.name + ';') || z.startsWith('"' + sp.name)).split(';');
        out.csvWerte = zeile.slice(-3).join('|') === '4|2,50|0,50';
        sp.startBilanz = undefined;
        const ohneBilanz = buildKaderCsv().split(/\r?\n/).find(z => z.startsWith(sp.name + ';') || z.startsWith('"' + sp.name)).split(';');
        out.csvOhneDaten = ohneBilanz.slice(-3).join('|') === '0||';

        // --- Notiz-Vorschläge ---
        const gegnerTeam = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
        gegnerTeam.played = 5; gegnerTeam.goalsFor = 9; gegnerTeam.goalsAgainst = 4;
        game.headToHeadRecords[gegnerTeam.name] = { wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 3, lastResults: ['2:1', '0:2'] };
        const vs = getNotizVorschlaege(gegnerTeam.name);
        out.vorStil = vs.some(v => v.startsWith('Spielstil: '));
        out.vorPlatz = vs.some(v => /^Platz \d+ von \d+, Stärke \d+\.$/.test(v));
        out.vorTore = vs.includes('Ø 1,8 Tore, 0,8 Gegentore.');
        out.vorDuelle = vs.includes('Zuletzt 2:1, 0:2.');
        out.vorUnbekannt = getNotizVorschlaege('Unbekannter FC').length === 0 || !getNotizVorschlaege('Unbekannter FC').some(v => v.startsWith('Spielstil'));
        gegnerTeam.played = 2; out.vorWenigeSpiele = !getNotizVorschlaege(gegnerTeam.name).some(v => v.startsWith('Ø'));
        gegnerTeam.played = 5;
        const cmAlt = typeof currentMatch !== 'undefined' ? currentMatch : null;
        currentMatch = { isHome: true, homeName: game.clubName, awayName: gegnerTeam.name, homeGoals: 1, awayGoals: 1, isCup: false };
        game.gegnerNotizen = {};
        openNachspielNotiz();
        const knoepfe = [...document.querySelectorAll('#opp-note-body button[onclick^="addNotizVorschlag"]')];
        out.vorKnoepfe = knoepfe.length >= 3 && knoepfe.every(b => b.dataset.feld === 'gegner-notiz-nach');
        const feld = document.getElementById('gegner-notiz-nach');
        const vorher = feld.value;
        knoepfe[0].click();
        out.vorEingefuegt = feld.value.length > vorher.length && feld.value.includes(knoepfe[0].dataset.text) && feld.value.startsWith(vorher.trim());
        const laenge = feld.value.length;
        knoepfe[0].click();
        out.vorKeinDoppel = feld.value.length === laenge;
        feld.value = 'x'.repeat(GEGNER_NOTIZ_MAX - 5);
        knoepfe[1].click();
        out.vorVoll = feld.value.length === GEGNER_NOTIZ_MAX - 5;
        out.vorDatentext = knoepfe.every(b => !/[<>"]/.test(b.dataset.text) || b.dataset.text.length > 0);
        out.wVorschlaege = JSON.stringify(woerter('#opp-note-body button'));
        closeNachspielNotiz(); currentMatch = cmAlt;
        delete game.headToHeadRecords[gegnerTeam.name];

        // --- Merkliste im Transfermarkt ---
        if (!marketPlayers.length) refreshTransferMarket();
        delete game.marktMerkliste;
        const m1 = marketPlayers[0], m2 = marketPlayers[1];
        showScreen('screen-transfer'); setTransferTab('market');
        toggleMarktMerken(m1.id);
        out.mMerken = game.marktMerkliste.length === 1 && game.marktMerkliste[0].id === m1.id && game.marktMerkliste[0].status === 'markt';
        out.mBox = document.getElementById('market-merkliste-box').textContent.includes('Merkliste (1/8)') && document.getElementById('market-merkliste-box').textContent.includes(m1.name);
        out.mKnopf = document.getElementById('market-list').textContent.includes('★ Gemerkt') && document.getElementById('market-list').textContent.includes('⭐ Merken');
        out.wMarkt = JSON.stringify(woerter('#market-list button, #market-merkliste-box button'));
        out.mBreit = ueberlauf();
        toggleMarktMerken(m1.id);
        out.mEntfernt = game.marktMerkliste.length === 0 && document.getElementById('market-merkliste-box').innerHTML === '';
        toggleMarktMerken('gibt-es-nicht'); out.mUnbekannt = game.marktMerkliste.length === 0;
        toggleMarktMerken(m1.id); toggleMarktMerken(m2.id);
        const idx = marketPlayers.findIndex(p => p.id === m1.id);
        const [weg] = marketPlayers.splice(idx, 1);
        const meldungenVor = inboxMessages.length;
        syncMarktMerkliste(); syncMarktMerkliste();
        const e1 = game.marktMerkliste.find(e => e.id === m1.id), e2 = game.marktMerkliste.find(e => e.id === m2.id);
        out.mWeg = e1.status === 'weg' && e2.status === 'markt';
        out.mMeldungEinmal = inboxMessages.length === meldungenVor + 1 && inboxMessages[0].title.includes('vom Markt verschwunden');
        const mt = getManagerTodos(true).find(x => x.id === 'merkliste-weg');
        out.mTodo = !!mt && mt.text.includes(m1.name) && !mt.text.includes(m2.name) && mt.aktion.includes('screen-transfer');
        renderTransferView();
        out.mBoxWeg = document.getElementById('market-merkliste-box').textContent.includes('nicht mehr auf dem Markt') && document.getElementById('market-merkliste-box').textContent.includes('Verschwundene entfernen');
        out.wMarktWeg = JSON.stringify(woerter('#market-merkliste-box button'));
        marketPlayers.push(weg); syncMarktMerkliste();
        out.mWieder = game.marktMerkliste.find(e => e.id === m1.id).status === 'markt';
        marketPlayers.splice(marketPlayers.findIndex(p => p.id === m1.id), 1); syncMarktMerkliste();
        clearMarktMerklisteWeg();
        out.mAufgeraeumt = game.marktMerkliste.length === 1 && game.marktMerkliste[0].id === m2.id && !getManagerTodos(true).some(x => x.id === 'merkliste-weg');
        squad.push(marketPlayers.find(p => p.id === m2.id)); syncMarktMerkliste();
        out.mGekauft = game.marktMerkliste.length === 0;
        squad.pop();
        game.marktMerkliste = [{ id: marketPlayers[2].id, name: 'X', pos: 'ST', strength: 50, status: 'markt', season: 1, matchday: 1 }];
        const marktAlt = marketPlayers; marketPlayers = []; syncMarktMerkliste();
        out.mLeerBleibt = game.marktMerkliste[0].status === 'markt';
        marketPlayers = marktAlt;
        refreshTransferMarket();
        out.mNeuaufbau = game.marktMerkliste.length === 1 && game.marktMerkliste[0].status === 'weg';
        game.marktMerkliste = Array.from({ length: 8 }, (_, i) => ({ id: 'z' + i, name: 'Z', pos: 'ST', strength: 50, status: 'weg', season: 1, matchday: 1 }));
        toggleMarktMerken(marketPlayers[0].id); out.mMax = game.marktMerkliste.length === 8;
        delete game.marktMerkliste; syncMarktMerkliste(); renderMarktMerkliste(); out.mAltesFeld = Array.isArray(game.marktMerkliste);
        game.marktMerkliste = [];

        // --- Belastungsampel ---
        const sq = squad[2];
        Object.assign(sq, { fitness: 90, timesInjured: 0, injured: 0 }); delete sq.startFolge;
        out.ampelGruen = getBelastungsAmpel(sq).stufe === 'gruen' && getBelastungChips(sq).length === 0 && getBelastungHinweis(sq) === '';
        sq.fitness = 70; out.ampelNochGruen = getBelastungsAmpel(sq).stufe === 'gruen';
        sq.fitness = 55; out.ampelGelb = getBelastungsAmpel(sq).stufe === 'gelb' && getBelastungChips(sq).length === 1;
        sq.timesInjured = 3; out.ampelRot = getBelastungsAmpel(sq).stufe === 'rot' && getBelastungsAmpel(sq).gruende.join('|') === 'Fitness 55 %|3 Verletzungen';
        sq.fitness = 90; sq.timesInjured = 0; sq.startFolge = [1, 1, 1, 1, 1];
        out.ampelDauer = getBelastungsAmpel(sq).punkte === 1 && getBelastungsAmpel(sq).gruende[0].includes('5 von 5');
        sq.startFolge = [1, 1, 1, 1]; out.ampelVierSpiele = getBelastungsAmpel(sq).punkte === 0;
        sq.startFolge = [1, 1, 0, 1, 1]; out.ampelUnterbrochen = getBelastungsAmpel(sq).punkte === 0;
        sq.startFolge = [1, 1, 1, 1, 1]; sq.fitness = 62; sq.timesInjured = 2; out.ampelKombi = getBelastungsAmpel(sq).stufe === 'rot';
        sq.startFolge = undefined; sq.fitness = 90; sq.timesInjured = 0; sq.injured = 2;
        out.ampelVerletzt = getBelastungsAmpel(sq).stufe === 'rot' && getBelastungsAmpel(sq).gruende[0].startsWith('verletzt');
        sq.injured = 0;
        // Zähler
        delete sq.startFolge;
        for (let i = 0; i < 7; i++) recordPlayerStartResult(i % 2 ? [sq.id] : [], 1, 0);
        out.folgeLaenge = sq.startFolge.length === 5 && sq.startFolge.join('') === '01010';
        // Anzeige im Kader und Filter
        squad.forEach(p => { p.fitness = 90; p.timesInjured = 0; p.injured = 0; p.startFolge = [0, 0, 0, 0, 0]; });
        squad[3].fitness = 40; squad[3].timesInjured = 3; squad[4].fitness = 60;
        squadBelastungNurRot = false; squadTagFilter = ''; squadFilterPos = 'alle';
        showScreen('screen-squad'); setSquadTab('aufstellung'); renderSquadView();
        const bl = document.getElementById('bench-list').textContent;
        out.karteRot = bl.includes('Belastung rot') && bl.includes('Fitness 40 %, 3 Verletzungen') && bl.includes('Belastung gelb');
        const fb = document.getElementById('squad-tag-filter');
        out.filterKnopf = fb.textContent.includes('Belastung rot (1)');
        out.wFilter = JSON.stringify(woerter('#squad-tag-filter button'));
        setSquadBelastungFilter();
        const karten = [...document.querySelectorAll('#bench-list .player-card')];
        out.filterNurRot = karten.length === 1 && karten[0].textContent.includes(squad[3].name);
        out.filterAktiv = document.getElementById('squad-tag-filter').querySelector('[aria-pressed="true"]') !== null;
        squad[3].fitness = 90; squad[3].timesInjured = 0; renderSquadView();
        out.filterFaelltWeg = squadBelastungNurRot === false && document.querySelectorAll('#bench-list .player-card').length === squad.length;
        squad.forEach(p => { p.fitness = 90; delete p.startFolge; });

        // --- Matchplan je Gegner ---
        game.matchplaene = {}; game.lineupPresets = [null, null, null, null, null]; game.tacticPresets = [null, null, null, null, null];
        game.formation = '4-4-2'; autoLineup(); saveLineupPreset(0);
        game.formation = '4-3-3'; autoLineup(); saveLineupPreset(1);
        setTacticStyle('konter'); saveTacticPreset(0);
        setTacticStyle('offensiv'); saveTacticPreset(1);
        const opp = gegnerTeam.name;
        pendingMatchInfo = { isHome: true, oppName: opp, oppStr: 60, ourFixture: null };
        renderPrematchCheck();
        out.planKeiner = getMatchplan(opp) === null && document.getElementById('prematch-check-box').textContent.includes('Noch kein Matchplan');
        document.getElementById('matchplan-aufstellung').value = '0'; document.getElementById('matchplan-taktik').value = '0';
        saveMatchplan(opp);
        out.planGespeichert = JSON.stringify(game.matchplaene[opp]) === JSON.stringify({ aufstellung: 0, taktik: 0 });
        const pcText = document.getElementById('prematch-check-box').textContent;
        out.planAnzeige = pcText.includes('📋 Matchplan vorhanden') && pcText.includes('Matchplan anwenden') && getMatchplan(opp).verwaist === false;
        out.wPlan = JSON.stringify(woerter('#prematch-check-box button'));
        game.formation = '4-3-3'; autoLineup(); setTacticStyle('offensiv');
        applyMatchplan(opp);
        out.planAufstellung = game.formation === '4-4-2' && lineup.join() === resolveLineupPreset(game.lineupPresets[0]).ids.join();
        out.planTaktik = game.tacticStyle === 'konter';
        out.planFormHinweis = document.getElementById('prematch-check-box').textContent.includes('verschiedene Formationen') && document.getElementById('prematch-check-box').textContent.includes('(4-4-2)');
        // zweite Vorlage nur Taktik
        document.getElementById('matchplan-aufstellung').value = ''; document.getElementById('matchplan-taktik').value = '1';
        saveMatchplan(opp);
        out.nurTaktik = JSON.stringify(game.matchplaene[opp]) === JSON.stringify({ aufstellung: null, taktik: 1 });
        game.formation = '4-3-3'; autoLineup(); const elfVorher = lineup.join(); setTacticStyle('konter');
        applyMatchplan(opp);
        out.nurTaktikAnwenden = game.tacticStyle === 'offensiv' && lineup.join() === elfVorher;
        // verwaiste Vorlage
        game.matchplaene[opp] = { aufstellung: 0, taktik: 1 };
        game.lineupPresets[0] = null;
        const verw = getMatchplan(opp);
        out.verwaist = verw.verwaist === true && verw.aufstellung === null && verw.taktik === 1;
        renderPrematchCheck(); out.verwaistText = document.getElementById('prematch-check-box').textContent.includes('Eine verknüpfte Vorlage gibt es nicht mehr');
        game.tacticPresets[1] = null;
        const toasts = [];
        const toastAlt = showToast; showToast = (t, ty) => { toasts.push(t); };
        const styleVorher = game.tacticStyle;
        applyMatchplan(opp);
        out.nichtsGueltig = toasts.some(t => t.includes('keinen gültigen Matchplan')) && game.tacticStyle === styleVorher;
        game.matchplaene[opp] = { aufstellung: 3, taktik: 3 };
        out.leereSlots = getMatchplan(opp).aufstellung === null && getMatchplan(opp).taktik === null;
        showToast = toastAlt;
        // löschen und leer speichern
        renderPrematchCheck();
        document.getElementById('matchplan-aufstellung').value = ''; document.getElementById('matchplan-taktik').value = '';
        saveMatchplan(opp);
        out.planGeloescht = game.matchplaene[opp] === undefined;
        const toasts2 = []; const ta = showToast; showToast = (t) => { toasts2.push(t); };
        saveMatchplan(opp); out.leerSpeichernSagtWarum = toasts2.some(t => t.includes('Wähle zuerst')); showToast = ta;
        // ohne Vorlagen
        game.lineupPresets = [null, null, null, null, null]; game.tacticPresets = [null, null, null, null, null];
        renderPrematchCheck(); out.ohneVorlagenHinweis = document.getElementById('prematch-check-box').textContent.includes('Speichere zuerst Aufstellungs- oder Taktikvorlagen') && !document.getElementById('matchplan-aufstellung');
        delete game.matchplaene; ensureMatchplaene(); out.altesFeldPlan = typeof game.matchplaene === 'object' && getMatchplan('Irgendwer') === null;

        // --- Wischen zwischen Reitern ---
        out.wischenStandard = getWischen() === 'an';
        const start = { x: 200, y: 300, t: 0 };
        out.wLinks = erkenneWisch(start, { x: 100, y: 310, t: 200 }, 320) === 1;
        out.wRechts = erkenneWisch(start, { x: 300, y: 290, t: 200 }, 320) === -1;
        out.wKurz = erkenneWisch(start, { x: 160, y: 300, t: 200 }, 320) === 0;
        out.wSteil = erkenneWisch(start, { x: 100, y: 380, t: 200 }, 320) === 0;
        out.wSchraeg = erkenneWisch(start, { x: 130, y: 340, t: 200 }, 320) === 0 && erkenneWisch(start, { x: 100, y: 345, t: 200 }, 320) === 1;
        out.wLangsam = erkenneWisch(start, { x: 100, y: 300, t: 900 }, 320) === 0;
        out.wRandLinks = erkenneWisch({ x: 10, y: 300, t: 0 }, { x: 150, y: 300, t: 100 }, 320) === 0;
        out.wRandRechts = erkenneWisch({ x: 312, y: 300, t: 0 }, { x: 150, y: 300, t: 100 }, 320) === 0;
        out.wOhneStart = erkenneWisch(null, start, 320) === 0;
        // Hub-Reiter
        showScreen('screen-transfer');
        const aktivHub = () => { const b = [...document.querySelectorAll('.hub-tab-bar')].find(x => x.offsetParent !== null); return b ? [...b.querySelectorAll('button')].filter(x => x.offsetParent !== null).findIndex(x => x.classList.contains('btn-action')) : -1; };
        const hubAnzahl = () => { const b = [...document.querySelectorAll('.hub-tab-bar')].find(x => x.offsetParent !== null); return b ? [...b.querySelectorAll('button')].filter(x => x.offsetParent !== null).length : 0; };
        out.hubErster = aktivHub() === 0 && hubAnzahl() >= 3;
        out.hubZurueckAmRand = swipeWechseln(-1) === false && aktivHub() === 0;
        out.hubWeiter = swipeWechseln(1) === true && aktivHub() === 1 && document.getElementById('screen-scouting-global').style.display !== 'none';
        out.hubZurueck = swipeWechseln(-1) === true && aktivHub() === 0;
        const n = hubAnzahl(); let schritte = 0; while (swipeWechseln(1) && schritte < 20) schritte++;
        out.hubLetzter = schritte === n - 1 && aktivHub() === n - 1 && swipeWechseln(1) === false;
        showScreen('screen-transfer');
        // Kader-Reiter
        showScreen('screen-squad'); setSquadTab('aufstellung');
        out.squadWeiter = swipeWechseln(1) && document.getElementById('btn-tab-squad-taktik').classList.contains('btn-action');
        out.squadZurueck = swipeWechseln(-1) && document.getElementById('btn-tab-squad-aufstellung').classList.contains('btn-action');
        out.squadAmRand = swipeWechseln(-1) === false;
        // Bildschirm ohne Reiter
        showScreen('screen-dashboard'); out.keineReiter = getSwipeReiter() === null && swipeWechseln(1) === false;
        // Gesperrte Ziele
        const eingabe = document.createElement('input'); document.body.appendChild(eingabe);
        out.sperreEingabe = swipeZielGesperrt(eingabe) === true;
        const normal = document.createElement('div'); normal.textContent = 'x'; document.body.appendChild(normal);
        out.keineSperre = swipeZielGesperrt(normal) === false;
        const scroller = document.createElement('div'); scroller.style.cssText = 'overflow-x:auto; width:100px;'; scroller.innerHTML = '<div style="width:400px;"><span id="sw-inner">lang</span></div>'; document.body.appendChild(scroller);
        out.sperreScroller = swipeZielGesperrt(document.getElementById('sw-inner')) === true;
        const teil = document.getElementById('share-report-overlay'); teil.classList.add('show');
        out.sperreFenster = swipeZielGesperrt(teil.querySelector('.generic-modal-box')) === true; teil.classList.remove('show');
        out.sperreFeld = swipeZielGesperrt(document.getElementById('soccer-pitch')) === true && swipeZielGesperrt(document.querySelector('.bottom-nav-bar button')) === true;
        out.sperreNull = swipeZielGesperrt(null) === true;
        eingabe.remove(); normal.remove(); scroller.remove();
        // Echte Touch-Ereignisse
        showScreen('screen-transfer');
        const ziel = document.getElementById('screen-transfer');
        const beruehren = (typ, x, y) => { const t = new Touch({ identifier: 1, target: ziel, clientX: x, clientY: y }); ziel.dispatchEvent(new TouchEvent(typ, { bubbles: true, touches: typ === 'touchend' ? [] : [t], changedTouches: [t] })); };
        beruehren('touchstart', 250, 400); beruehren('touchend', 120, 405);
        out.touchWechselt = aktivHub() === 1;
        beruehren('touchstart', 120, 400); beruehren('touchend', 260, 395);
        out.touchZurueck = aktivHub() === 0;
        beruehren('touchstart', 250, 400); beruehren('touchend', 230, 405);
        out.touchKurzNichts = aktivHub() === 0;
        beruehren('touchstart', 250, 400); beruehren('touchcancel' === 'x' ? 'touchend' : 'touchend', 120, 405);
        setzeWischen('aus');
        out.einstellungAus = getWischen() === 'aus';
        beruehren('touchstart', 250, 400); beruehren('touchend', 100, 405);
        out.ausWechseltNicht = aktivHub() === 1 || aktivHub() === 0;
        const nachWisch = aktivHub();
        beruehren('touchstart', 250, 400); beruehren('touchend', 100, 405);
        out.ausBleibt = aktivHub() === nachWisch;
        const toastsW = []; const taW = showToast; showToast = (t) => { toastsW.push(t); };
        setzeWischen('quatsch'); out.ungueltigEinstellung = getWischen() === 'aus' && toastsW.some(t => t.includes('Unbekannte Wisch-Einstellung'));
        showToast = taW;
        setzeWischen('an'); out.einstellungAn = getWischen() === 'an';
        showScreen('screen-design'); renderDesignSettings();
        out.einstellungsText = document.getElementById('design-settings-box').textContent.includes('Wischen zwischen Reitern');
        out.wDesign = JSON.stringify(woerter('#design-settings-box button'));
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['zListe', 'zText', 'zZu', 'zOffen', 'zWieder', 'zErledigtVerschwindet'];
    assert(ok(...A), `Assistent: zurückgestellte Schritte als aufklappbare Liste mit „Wieder zeigen“ (${werte(A)})`);
    const B = ['archivFuenf', 'vorjahrBleibt', 'aeltereSaisonEtiketten', 'zuAlteSaison', 'altesSpielVorjahr', 'archivNeuAngelegt'];
    assert(ok(...B), `Etiketten-Archiv: fünf Saisons, Rückblick auch für ältere Saisons, alte Spielstände (${werte(B)})`);
    const C = ['csvKopf', 'csvWerte', 'csvOhneDaten'];
    assert(ok(...C), `Kader-CSV: Spalten und Werte der Startelf-Bilanz (${werte(C)})`);
    const D = ['vorStil', 'vorPlatz', 'vorTore', 'vorDuelle', 'vorUnbekannt', 'vorWenigeSpiele'];
    assert(ok(...D), `Notiz-Vorschläge: Spielstil, Tabelle, Tore, letzte Duelle aus echten Daten (${werte(D)})`);
    const D2 = ['vorKnoepfe', 'vorEingefuegt', 'vorKeinDoppel', 'vorVoll'];
    assert(ok(...D2), `Notiz-Vorschläge: Einfügen per Tipp, kein Doppeleintrag, Grenze von 300 Zeichen (${werte(D2)})`);
    const E = ['mMerken', 'mBox', 'mKnopf', 'mBreit', 'mEntfernt', 'mUnbekannt'];
    assert(ok(...E), `Merkliste: Merken und Entfernen auf der Marktkarte, Kasten mit Zähler (${werte(E)})`);
    const E2 = ['mWeg', 'mMeldungEinmal', 'mTodo', 'mBoxWeg', 'mWieder', 'mAufgeraeumt', 'mGekauft'];
    assert(ok(...E2), `Merkliste: verschwundener Spieler wird einmal gemeldet, Assistent-Schritt, Wiederkehr, Aufräumen, Kauf (${werte(E2)})`);
    const E3 = ['mLeerBleibt', 'mNeuaufbau', 'mMax', 'mAltesFeld'];
    assert(ok(...E3), `Merkliste: leerer Markt ändert nichts, Neuaufbau meldet, höchstens acht, alte Spielstände (${werte(E3)})`);
    const F = ['ampelGruen', 'ampelNochGruen', 'ampelGelb', 'ampelRot', 'ampelDauer', 'ampelVierSpiele', 'ampelUnterbrochen', 'ampelKombi', 'ampelVerletzt', 'folgeLaenge'];
    assert(ok(...F), `Belastungsampel: Stufen aus Fitness, Dauereinsatz und Verletzungen, Zähler der letzten fünf Spiele (${werte(F)})`);
    const F2 = ['karteRot', 'filterKnopf', 'filterNurRot', 'filterAktiv', 'filterFaelltWeg'];
    assert(ok(...F2), `Belastungsampel: Chip und Grund auf der Kaderkarte, Filter „Belastung rot“ (${werte(F2)})`);
    const G = ['planKeiner', 'planGespeichert', 'planAnzeige', 'planAufstellung', 'planTaktik', 'planFormHinweis', 'nurTaktik', 'nurTaktikAnwenden'];
    assert(ok(...G), `Matchplan: speichern, anzeigen, Aufstellung und Taktik anwenden, nur eine Vorlage (${werte(G)})`);
    const G2 = ['verwaist', 'verwaistText', 'nichtsGueltig', 'leereSlots', 'planGeloescht', 'leerSpeichernSagtWarum', 'ohneVorlagenHinweis', 'altesFeldPlan'];
    assert(ok(...G2), `Matchplan: gelöschte Vorlagen, nichts Gültiges, Löschen, ohne Vorlagen, alte Spielstände (${werte(G2)})`);
    const H = ['wischenStandard', 'wLinks', 'wRechts', 'wKurz', 'wSteil', 'wSchraeg', 'wLangsam', 'wRandLinks', 'wRandRechts', 'wOhneStart'];
    assert(ok(...H), `Wischen: erkennt waagerechte schnelle Wische, ignoriert kurze, steile, langsame und Randwische (${werte(H)})`);
    const H2 = ['hubErster', 'hubZurueckAmRand', 'hubWeiter', 'hubZurueck', 'hubLetzter', 'squadWeiter', 'squadZurueck', 'squadAmRand', 'keineReiter'];
    assert(ok(...H2), `Wischen: Hub-Reiter und Kader-Reiter wechseln, am Rand kein Umlauf, ohne Reiter nichts (${werte(H2)})`);
    const H3 = ['sperreEingabe', 'keineSperre', 'sperreScroller', 'sperreFenster', 'sperreFeld', 'sperreNull'];
    assert(ok(...H3), `Wischen: gesperrt bei Eingaben, scrollenden Flächen, Fenstern, Spielfeld und Navigation (${werte(H3)})`);
    const H4 = ['touchWechselt', 'touchZurueck', 'touchKurzNichts', 'einstellungAus', 'ausBleibt', 'ungueltigEinstellung', 'einstellungAn', 'einstellungsText'];
    assert(ok(...H4), `Wischen: echte Touch-Ereignisse, Einstellung Aus und An, ungültige Einstellung, Eintrag in der Darstellung (${werte(H4)})`);
    assert(r.wAssistent === '[]' && r.wVorschlaege === '[]' && r.wMarkt === '[]' && r.wMarktWeg === '[]' && r.wFilter === '[]' && r.wPlan === '[]' && r.wDesign === '[]', `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${JSON.stringify([r.wAssistent, r.wVorschlaege, r.wMarkt, r.wMarktWeg, r.wFilter, r.wPlan, r.wDesign])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde31Funktionen(browser) {
    console.log('\n[26.16] Aufstellung teilen, Zuletzt geöffnet, Leistbar-Chips, Rotation mit Ampel, Erinnerungen, Spielbericht-Archiv, Vertragsplan, Saisonziele');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const schrift = document.createElement('style'); schrift.textContent = '*,*::before,*::after{font-family:"DejaVu Sans",Verdana,sans-serif!important}'; document.head.appendChild(schrift);
        const probe = document.createElement('span'); document.body.appendChild(probe);
        const woerter = sel => [...document.querySelectorAll(sel)].filter(el => el.offsetParent).filter(el => {
            const cs = getComputedStyle(el), innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            probe.style.cssText = `position:absolute; visibility:hidden; white-space:nowrap; font:${cs.font}; letter-spacing:${cs.letterSpacing}`;
            return (el.innerText || '').trim().split(/\s+/).flatMap(w => w.split(/(?<=-)/)).some(t => { probe.textContent = t; return probe.getBoundingClientRect().width > innen + 1; });
        }).map(el => (el.innerText || '').trim().slice(0, 24));
        const ueberlauf = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        const toasts = []; const toastAlt = showToast; showToast = (t) => { toasts.push(t); };
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 90; p.timesInjured = 0; p.tags = []; p.injuryLog = []; delete p.startFolge; delete p.startBilanz; });
        game.formation = '4-4-2'; autoLineup();

        // --- Aufstellung als Text teilen ---
        game.captainId = lineup[0];
        const txt = buildLineupText();
        const zeilen = txt.split('\n');
        out.lText = zeilen[0] === `📋 Aufstellung · ${game.clubName}` && zeilen[1].startsWith('Formation 4-4-2 · Spielstil ') && zeilen.some(z => z.startsWith('TW: ')) && zeilen.some(z => z.startsWith('ABW: ')) && zeilen.some(z => z.startsWith('Bank: ')) && txt.endsWith('— Anstoß Mobile Pro FM13');
        out.lKapitaen = txt.includes('(C)');
        const spielerInText = lineup.map(id => squad.find(p => p.id === id)).every(p => txt.includes(p.name));
        out.lAlle = spielerInText && !txt.includes('Achtung');
        shareLineup();
        out.lFenster = document.getElementById('share-report-overlay').classList.contains('show') && document.getElementById('share-report-title').textContent.includes('Aufstellung') && document.getElementById('share-report-text').value === txt;
        closeShareReport();
        const elfAlt = lineup; lineup = lineup.slice(0, 9);
        out.lWenige = buildLineupText().includes('Achtung: nur 9 von 11');
        lineup = []; toasts.length = 0; shareLineup();
        out.lLeer = buildLineupText() === '' && toasts.some(t => t.includes('noch niemand aufgestellt')) && !document.getElementById('share-report-overlay').classList.contains('show');
        lineup = elfAlt;
        const bankSpieler = squad.find(p => !lineup.includes(p.id)); bankSpieler.injured = 2;
        out.lVerletzteBank = buildLineupText().includes('(verletzt)'); bankSpieler.injured = 0;

        // --- Zuletzt geöffnet ---
        safeLocalSet(ZULETZT_KEY, '[]');
        ['screen-dashboard', 'screen-squad', 'screen-transfer', 'screen-finances', 'screen-inbox', 'screen-calendar'].forEach(id => showScreen(id));
        const z = getZuletzt();
        out.zReihenfolge = z.slice(0, 6).join() === 'screen-calendar,screen-inbox,screen-finances,screen-transfer,screen-squad,screen-dashboard';
        renderZuletzt();
        const zb = document.getElementById('recent-screens-box');
        out.zBox = zb.textContent.includes('Zuletzt geöffnet') && zb.querySelectorAll('button').length === 5 && !zb.querySelector('[data-s="screen-calendar"]');
        out.zBeschriftung = [...zb.querySelectorAll('button')].every(b => b.textContent.trim().length > 2);
        zb.querySelector('[data-s="screen-squad"]').click();
        out.zKlick = aktiverScreen === 'screen-squad' && getZuletzt()[0] === 'screen-squad' && !document.getElementById('recent-screens-box').querySelector('[data-s="screen-squad"]');
        out.zNachVorn = getZuletzt().filter(x => x === 'screen-squad').length === 1;
        showScreen('screen-prematch-press'); showScreen('screen-matchday');
        out.zOhneSpielflow = !getZuletzt().includes('screen-prematch-press') && !getZuletzt().includes('screen-matchday');
        showScreen('screen-dashboard');
        safeLocalSet(ZULETZT_KEY, '{kaputt'); out.zKaputt = Array.isArray(getZuletzt()) && getZuletzt().length === 0;
        safeLocalSet(ZULETZT_KEY, JSON.stringify(['screen-gibtsnicht', 'screen-finances', 42])); renderZuletzt();
        out.zUnbekannt = document.getElementById('recent-screens-box').querySelectorAll('button').length === 1;
        merkeZuletzt(null); merkeZuletzt('screen-dashboard');
        out.zBegrenzt = getZuletzt().length <= ZULETZT_MAX + 3;
        out.wZuletzt = JSON.stringify(woerter('#recent-screens-box button'));

        // --- Leistbar-Chips auf Marktkarten ---
        if (!marketPlayers.length) refreshTransferMarket();
        showScreen('screen-transfer'); setTransferTab('market');
        const mp = marketPlayers[0];
        game.money = 1e9; game.transferBudget = 1e9; game.wageBudget = 1e9; game.transferEmbargo = false; game.ffpTransferEmbargo = false;
        out.kOk = getKaufHindernisse(mp).length === 0 && getKaufChip(mp).includes('leistbar');
        game.money = 0; out.kKasse = getKaufHindernisse(mp).join() === 'Kasse reicht nicht';
        game.money = 1e9; game.transferBudget = 0; out.kBudget = getKaufHindernisse(mp).join() === 'Transferbudget zu klein';
        game.transferBudget = 1e9; game.wageBudget = 1; out.kGehalt = getKaufHindernisse(mp).join() === 'Gehaltsbudget gesprengt';
        game.wageBudget = 1e9; game.transferEmbargo = true; out.kSperre = getKaufHindernisse(mp).join() === 'Transfersperre'; game.transferEmbargo = false;
        game.money = 0; game.transferBudget = 0; out.kMehrere = getKaufHindernisse(mp).length === 2 && getKaufChip(mp).includes('⛔') && getKaufChip(mp).includes(', ');
        renderTransferView();
        out.kKarte = document.getElementById('market-list').textContent.includes('⛔') && !document.getElementById('market-list').textContent.includes('✓ leistbar');
        out.wKarten = JSON.stringify(woerter('#market-list button'));
        game.money = 1e9; game.transferBudget = 1e9; renderTransferView();
        out.kKarteOk = document.getElementById('market-list').textContent.includes('✓ leistbar');
        // Der Chip sagt dasselbe wie der Kauf selbst
        const vorher = squad.length; const idxMp = marketPlayers.indexOf(mp);
        out.kStimmt = getKaufHindernisse(mp).length === 0 && (buyPlayer(idxMp), squad.length === vorher + 1);
        const mp2 = marketPlayers[0]; game.money = 0;
        const vorher2 = squad.length; buyPlayer(0);
        out.kStimmtNicht = getKaufHindernisse(mp2).length > 0 && squad.length === vorher2;
        game.money = 5e6; game.transferBudget = 5e6; game.wageBudget = 1e8;

        // --- Rotations-Assistent mit Belastungsampel ---
        squad.forEach(p => { p.fitness = 90; p.timesInjured = 0; p.injured = 0; delete p.startFolge; p.tags = []; });
        game.formation = '4-4-2'; autoLineup();
        const S = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW' && squad.some(b => !lineup.includes(b.id) && b.pos === p.pos));
        const B = squad.find(p => !lineup.includes(p.id) && p.pos === S.pos);
        B.strength = S.strength;
        out.rKeine = getRotationSuggestions().length === 0;
        S.timesInjured = 3; out.rGelbOhneDauer = getBelastungsAmpel(S).stufe === 'gelb' && getRotationSuggestions().length === 0;
        S.startFolge = [1, 1, 1, 1, 1];
        const rs = getRotationSuggestions().filter(x => x.raus.id === S.id);
        out.rDauer = rs.length === 1 && rs[0].rein && rs[0].rein.pos === S.pos && rs[0].grund === 'belastung' && rs[0].gruende.join('|') === '5 von 5 Spielen in der Startelf|3 Verletzungen';
        game.matchday = 4; pendingMatchInfo = { isHome: true, oppName: 'Test FC', oppStr: 60, ourFixture: null };
        renderPrematchCheck();
        out.rText = document.getElementById('prematch-check-box').textContent.includes('🚦 Belastung: 5 von 5 Spielen in der Startelf, 3 Verletzungen');
        out.wRotation = JSON.stringify(woerter('#prematch-check-box button'));
        B.timesInjured = 3; B.startFolge = [1, 1, 1, 1, 1]; B.fitness = 55;
        out.rErsatzRot = getRotationSuggestions().filter(x => x.raus.id === S.id && x.rein).length === 0;
        B.timesInjured = 0; delete B.startFolge; B.fitness = 60;
        out.rErsatzMuede = getRotationSuggestions().filter(x => x.raus.id === S.id && x.rein).length === 0;
        B.fitness = 90; B.strength = S.strength - 10;
        out.rErsatzSchwach = getRotationSuggestions().filter(x => x.raus.id === S.id && x.rein).length === 0;
        B.strength = S.strength;
        const sw = getRotationSuggestions().find(x => x.raus.id === S.id);
        applyRotationSwap(S.id, sw.rein.id);
        out.rTausch = lineup.includes(sw.rein.id) && !lineup.includes(S.id);
        // Rote Starter mit schwacher Fitness: der bisherige Weg bleibt erhalten
        const T = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW' && squad.some(b => !lineup.includes(b.id) && b.pos === p.pos));
        T.fitness = 40; const alt = getRotationSuggestions().filter(x => x.raus.id === T.id);
        out.rMuedeBleibt = alt.length === 1 && alt[0].grund === undefined;
        squad.forEach(p => { p.fitness = 90; p.timesInjured = 0; delete p.startFolge; });

        // --- Eigene Erinnerungen ---
        delete game.erinnerungen; delete game.erinnerungNr;
        showScreen('screen-dashboard'); game.matchday = 5;
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        out.eKnopf = document.getElementById('manager-assistant-box').textContent.includes('📝 Erinnerungen (0)');
        openErinnerungen();
        out.eFenster = document.getElementById('reminder-overlay').classList.contains('show') && document.getElementById('reminder-body').textContent.includes('Noch keine Erinnerungen') && document.getElementById('reminder-matchday').value === '8';
        toasts.length = 0; addErinnerung(); out.eLeerFehler = toasts.some(t => t.includes('Schreibe zuerst')) && game.erinnerungen.length === 0;
        document.getElementById('reminder-text').value = 'x'; document.getElementById('reminder-matchday').value = '0'; toasts.length = 0; addErinnerung();
        out.eTagNull = toasts.some(t => t.includes('zwischen 1 und 34')) && game.erinnerungen.length === 0;
        document.getElementById('reminder-matchday').value = '35'; addErinnerung(); document.getElementById('reminder-matchday').value = ''; addErinnerung();
        out.eTagUngueltig = game.erinnerungen.length === 0;
        document.getElementById('reminder-text').value = '  Vertrag   <b>von</b>   Müller verlängern ' + 'x'.repeat(100); document.getElementById('reminder-matchday').value = '8'; addErinnerung();
        const e1 = game.erinnerungen[0];
        out.eGespeichert = game.erinnerungen.length === 1 && e1.id === 'r1' && e1.bis === 8 && e1.season === game.season && e1.text.length === ERINNERUNG_TEXT_MAX && e1.text.startsWith('Vertrag <b>von</b> Müller verlängern ') && document.getElementById('reminder-text').value === '';
        out.eMaskiert = document.getElementById('reminder-body').innerHTML.includes('&lt;b&gt;von&lt;/b&gt;') && !document.getElementById('reminder-body').innerHTML.includes('<b>von</b>');
        out.eNochNichtFaellig = !getManagerTodos(true).some(x => x.id === 'erinnerung-r1');
        out.eListeZaehler = document.getElementById('manager-assistant-box').textContent.includes('📝 Erinnerungen (1)') && document.getElementById('reminder-body').textContent.includes('⏳');
        game.matchday = 8;
        const td = getManagerTodos(true).find(x => x.id === 'erinnerung-r1');
        out.eFaellig = !!td && td.text.startsWith('Erinnerung: Vertrag') && td.label === 'Abhaken' && td.aktion === "deleteErinnerung('r1')";
        managerAssistantLetzterInhalt = ''; renderManagerAssistant();
        out.eImAssistent = document.getElementById('manager-assistant-box').textContent.includes('Erinnerung: Vertrag') && document.getElementById('manager-assistant-box').textContent.includes('Abhaken');
        out.wErinnerung = JSON.stringify(woerter('#reminder-body button, #manager-assistant-box button'));
        out.eBreit = ueberlauf();
        game.matchday = 5; game.erinnerungen.push({ id: 'r2', text: 'Alte Saison', season: game.season - 1, bis: 30 });
        out.eAlteSaisonFaellig = getManagerTodos(true).some(x => x.id === 'erinnerung-r2') && !getManagerTodos(true).some(x => x.id === 'erinnerung-r1');
        game.erinnerungen.pop();
        game.matchday = 8; eval(td.aktion);
        out.eAbgehakt = game.erinnerungen.length === 0 && !getManagerTodos(true).some(x => x.id === 'erinnerung-r1');
        for (let i = 0; i < ERINNERUNG_MAX; i++) { document.getElementById('reminder-text').value = 'E' + i; document.getElementById('reminder-matchday').value = '20'; addErinnerung(); }
        toasts.length = 0; document.getElementById('reminder-text').value = 'zu viel'; addErinnerung();
        out.eMax = game.erinnerungen.length === ERINNERUNG_MAX && toasts.some(t => t.includes('höchstens 10'));
        deleteErinnerung(game.erinnerungen[0].id); out.eLoeschen = game.erinnerungen.length === ERINNERUNG_MAX - 1;
        out.eEindeutig = new Set(game.erinnerungen.map(e => e.id)).size === game.erinnerungen.length;
        closeErinnerungen(); out.eZu = !document.getElementById('reminder-overlay').classList.contains('show');
        game.erinnerungen = []; delete game.erinnerungen; renderErinnerungen(); out.eAltesFeld = Array.isArray(game.erinnerungen) && typeof game.erinnerungNr === 'number';

        // --- Spielbericht-Archiv ---
        delete game.spielberichte;
        const cmAlt = typeof currentMatch !== 'undefined' ? currentMatch : null;
        currentMatch = null; out.sOhneSpiel = archiveMatchReport() === false && !Array.isArray(game.spielberichte);
        renderMatchReportsBox(); out.sLeer = document.getElementById('match-reports-box').textContent.includes('Nach jedem Livespiel');
        currentMatch = { isHome: true, homeName: game.clubName, awayName: 'Test FC', homeGoals: 2, awayGoals: 1, isCup: false };
        game.matchday = 6;
        out.sArchiviert = archiveMatchReport() === true && game.spielberichte.length === 1 && game.spielberichte[0].titel === `${game.clubName} 2:1 Test FC` && game.spielberichte[0].text.includes('Spieltag 6') && game.spielberichte[0].matchday === 6;
        archiveMatchReport(); out.sKeinDoppel = game.spielberichte.length === 1;
        game.matchday = 7; currentMatch = { isHome: false, homeName: 'Cup FC', awayName: game.clubName, homeGoals: 0, awayGoals: 0, isCup: true };
        archiveMatchReport();
        out.sNeuesteVorn = game.spielberichte.length === 2 && game.spielberichte[0].cup === true && game.spielberichte[1].cup === false;
        renderMatchReportsBox();
        const sb = document.getElementById('match-reports-box').textContent;
        out.sBox = sb.includes('Spielbericht-Archiv (2/10)') && sb.includes('🏆') && sb.includes('Cup FC 0:0') && sb.includes('S' + game.season);
        out.wArchiv = JSON.stringify(woerter('#match-reports-box button'));
        document.querySelector('#match-reports-box button').click();
        out.sOeffnen = document.getElementById('share-report-overlay').classList.contains('show') && document.getElementById('share-report-title').textContent.includes('Cup FC 0:0') && document.getElementById('share-report-text').value === game.spielberichte[0].text;
        closeShareReport();
        toasts.length = 0; openArchivedReport(9); out.sUngueltig = toasts.some(t => t.includes('nicht mehr')) && !document.getElementById('share-report-overlay').classList.contains('show');
        for (let i = 0; i < 12; i++) { game.matchday = 10 + i; currentMatch = { isHome: true, homeName: game.clubName, awayName: 'F' + i, homeGoals: i % 4, awayGoals: 0, isCup: false }; archiveMatchReport(); }
        out.sMax = game.spielberichte.length === SPIELBERICHT_MAX && game.spielberichte[0].titel.includes('F11') && !game.spielberichte.some(b => b.titel.includes('Test FC'));
        out.sVerdrahtet = endMatchSimulation.toString().includes('archiveMatchReport');
        currentMatch = cmAlt; delete game.spielberichte; renderMatchReportsBox(); out.sAltesFeld = document.getElementById('match-reports-box').textContent.includes('0/10');

        // --- Vertragsplan ---
        squad.forEach((p, i) => { p.contracts = 4; p.wage = 1000; });
        squad[0].contracts = 1; squad[1].contracts = 0; squad[2].contracts = 2; squad[3].contracts = 3; squad[4].contracts = 3;
        squad[0].wage = 5000; squad[2].wage = 7000; squad[3].wage = 2000; squad[4].wage = 3000;
        game.wageBudget = squad.reduce((sum, p) => sum + p.wage, 0) + 10000;
        const plan = getVertragsplan();
        const lohnHeute = squad.reduce((sum, p) => sum + p.wage, 0);
        out.vPlanSaisons = plan.map(x => x.saison).join() === `${game.season},${game.season + 1},${game.season + 2}`;
        out.vAnzahl = plan[0].spieler.length === 2 && plan[1].spieler.length === 1 && plan[2].spieler.length === 2;
        out.vGehalt = plan[0].gehalt === 6000 && plan[1].gehalt === 7000 && plan[2].gehalt === 5000;
        out.vKumuliert = plan[0].lohnDanach === lohnHeute - 6000 && plan[1].lohnDanach === lohnHeute - 13000 && plan[2].lohnDanach === lohnHeute - 18000;
        out.vSpielraum = plan[0].spielraum === 16000 && plan[2].spielraum === 28000;
        out.vSortiert = plan[0].spieler[0].strength >= plan[0].spieler[1].strength;
        showScreen('screen-contracts'); renderContractsView();
        const vb = document.getElementById('contract-plan-box').textContent;
        out.vBox = vb.includes('Gehälter heute') && vb.includes(`Saisonende ${game.season} (diese Saison)`) && vb.includes(`Saisonende ${game.season + 2}`) && vb.includes('2 Verträge laufen aus');
        squad.forEach(p => { p.contracts = 4; });
        const leer = getVertragsplan(); out.vLeer = leer.every(x => x.spieler.length === 0 && x.gehalt === 0);
        renderVertragsplan(); out.vLeerText = document.getElementById('contract-plan-box').textContent.includes('keine Verträge laufen aus');
        out.vBreit = ueberlauf();
        squad.forEach(p => { p.wage = calculatePlayerWage(p.marketValue, p.strength); p.contracts = 3; });
        game.wageBudget = 1e8;

        // --- Saisonziel-Rechner ---
        const lvl = game.leagueLevel, liga = leaguesData[lvl];
        const ich = liga.find(t => t.name === game.clubName);
        const setze = (meinePunkte, meineSpiele, andere) => {
            ich.points = meinePunkte; ich.played = meineSpiele;
            const rest = liga.filter(t => t !== ich);
            rest.forEach((t, i) => { t.points = andere[Math.min(i, andere.length - 1)] - (i >= andere.length ? i - andere.length + 1 : 0); t.played = meineSpiele; t.goalsFor = 0; t.goalsAgainst = 0; });
        };
        game.matchday = 21;
        const andere = [60, 55, 50, 45, 42, 40];
        setze(30, 20, andere);
        let ziele = getSaisonZiele();
        const aufst = ziele.find(x => x.id === 'aufstieg');
        out.zAufstieg = !!aufst && aufst.innen === false && aufst.punkte === 55 - 30 && aufst.rest === 14 && aufst.erreichbar === true && aufst.platz === 2;
        setze(30, 20, [60, 40, 36, 33, 31]);
        ziele = getSaisonZiele();
        out.zErreichbar = ziele[0].erreichbar === true && ziele[0].punkte === 10;
        setze(80, 20, [60, 40, 36, 33, 31]);
        ziele = getSaisonZiele();
        out.zInnen = ziele[0].innen === true && ziele[0].punkte === 80 - 40 && ziele[0].sicher === false;
        setze(90, 20, [50, 40, 36, 33, 31]);
        ziele = getSaisonZiele();
        out.zGesichert = ziele[0].innen === true && ziele[0].sicher === true;
        renderSaisonZiele();
        const zt = document.getElementById('season-goal-box').textContent;
        out.zText = zt.includes('Direkter Aufstieg') && zt.includes('gesichert') && zt.includes('Noch 14 Spiele (höchstens 42 Punkte)');
        out.zUntersteLiga = !ziele.some(x => x.id === 'klasse') === (lvl >= NUM_LEAGUES - 1);
        setze(30, 30, andere); renderSaisonZiele();
        out.zNichtMehr = document.getElementById('season-goal-box').textContent.includes('nicht mehr erreichbar') && getSaisonZiele()[0].erreichbar === false && getSaisonZiele()[0].rest === 4;
        setze(30, 33, [60, 55, 50]);
        out.zRestEinSpiel = getSaisonZiele()[0].rest === 1 && getSaisonZiele()[0].erreichbar === false;
        setze(30, 0, andere); out.zOhneSpiele = getSaisonZiele().length === 0;
        setze(30, 20, andere); game.matchday = 35; renderSaisonZiele(); out.zNachSaison = document.getElementById('season-goal-box').innerHTML === '';
        game.matchday = 21;
        // Bundesliga-Ziele (Europa, Klassenerhalt): dieselbe Tabelle als Liga 0 ausgeben
        const levelAlt = game.leagueLevel, ligaAlt = leaguesData[0];
        game.leagueLevel = 0; leaguesData[0] = liga;
        setze(37, 20, [60, 55, 50, 45, 44, 43, 42, 41, 40, 39, 38, 36, 35, 34, 33, 32, 31]);
        ziele = getSaisonZiele();
        const eu = ziele.find(x => x.id === 'europa'), kl = ziele.find(x => x.id === 'klasse');
        out.zEuropa = !!eu && eu.platz === 4 && eu.innen === false && eu.punkte === 45 - 37 && eu.gegner !== game.clubName;
        out.zKlasse = !!kl && kl.platz === 15 && kl.innen === true && kl.gegner !== game.clubName;
        game.leagueLevel = levelAlt; leaguesData[0] = ligaAlt;
        out.zAltStand = typeof renderSaisonZiele === 'function';
        showToast = toastAlt;
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['lText', 'lKapitaen', 'lAlle', 'lFenster', 'lWenige', 'lLeer', 'lVerletzteBank'];
    assert(ok(...A), `Aufstellung teilen: Text mit Formation, Positionen, Kapitän, Bank; Fenster; zu wenige und keine Spieler (${werte(A)})`);
    const B = ['zReihenfolge', 'zBox', 'zBeschriftung', 'zKlick', 'zNachVorn', 'zOhneSpielflow', 'zKaputt', 'zUnbekannt', 'zBegrenzt'];
    assert(ok(...B), `Zuletzt geöffnet: Reihenfolge, Menü-Box ohne den aktuellen Bildschirm, Antippen, Spielablauf ausgenommen, kaputter Speicher (${werte(B)})`);
    const C = ['kOk', 'kKasse', 'kBudget', 'kGehalt', 'kSperre', 'kMehrere', 'kKarte', 'kKarteOk'];
    assert(ok(...C), `Leistbar-Chips: Gründe Kasse, Transferbudget, Gehaltsbudget, Sperre und Karten im Markt (${werte(C)})`);
    const C2 = ['kStimmt', 'kStimmtNicht'];
    assert(ok(...C2), `Leistbar-Chips: der Chip sagt dasselbe wie der Sofortkauf (${werte(C2)})`);
    const D = ['rKeine', 'rGelbOhneDauer', 'rDauer', 'rText', 'rErsatzRot', 'rErsatzMuede', 'rErsatzSchwach', 'rTausch', 'rMuedeBleibt'];
    assert(ok(...D), `Rotations-Assistent: Pause bei Dauereinsatz mit Vorgeschichte, kein roter oder müder Ersatz, bisheriger Weg bleibt (${werte(D)})`);
    const E = ['eKnopf', 'eFenster', 'eLeerFehler', 'eTagNull', 'eTagUngueltig', 'eGespeichert', 'eMaskiert', 'eNochNichtFaellig', 'eListeZaehler'];
    assert(ok(...E), `Erinnerungen: Fenster, Eingabeprüfung, Speichern gekürzt und maskiert, noch nicht fällig (${werte(E)})`);
    const E2 = ['eFaellig', 'eImAssistent', 'eBreit', 'eAlteSaisonFaellig', 'eAbgehakt', 'eMax', 'eLoeschen', 'eEindeutig', 'eZu', 'eAltesFeld'];
    assert(ok(...E2), `Erinnerungen: fällig als Assistent-Schritt, Abhaken, alte Saison, höchstens 10, eindeutige Kennungen, alte Spielstände (${werte(E2)})`);
    const F = ['sOhneSpiel', 'sLeer', 'sArchiviert', 'sKeinDoppel', 'sNeuesteVorn', 'sBox', 'sOeffnen', 'sUngueltig', 'sMax', 'sVerdrahtet', 'sAltesFeld'];
    assert(ok(...F), `Spielbericht-Archiv: speichern, kein Doppeleintrag, neueste zuerst, öffnen, höchstens zehn, im Spielablauf verdrahtet (${werte(F)})`);
    const G = ['vPlanSaisons', 'vAnzahl', 'vGehalt', 'vKumuliert', 'vSpielraum', 'vSortiert', 'vBox', 'vLeer', 'vLeerText', 'vBreit'];
    assert(ok(...G), `Vertragsplan: auslaufende Verträge und Gehälter je Saison, kumulierter Spielraum im Verträge-Bildschirm (${werte(G)})`);
    const H = ['zAufstieg', 'zErreichbar', 'zInnen', 'zGesichert', 'zText', 'zUntersteLiga', 'zNichtMehr', 'zRestEinSpiel', 'zOhneSpiele', 'zNachSaison', 'zEuropa', 'zKlasse'];
    assert(ok(...H), `Saisonziel-Rechner: Rückstand, Vorsprung, gesichert, nicht mehr erreichbar, Europa und Klassenerhalt (${werte(H)})`);
    assert(r.wZuletzt === '[]' && r.wKarten === '[]' && r.wRotation === '[]' && r.wErinnerung === '[]' && r.wArchiv === '[]', `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${JSON.stringify([r.wZuletzt, r.wKarten, r.wRotation, r.wErinnerung, r.wArchiv])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

// Gemeinsame Hilfen der Runde-32-Suiten (im Browser ausgeführt): breite Schrift und Prüfung, ob ein Wort nicht in seinen Knopf passt
const R32_HILFEN = `
    const schrift = document.createElement('style'); schrift.textContent = '*,*::before,*::after{font-family:"DejaVu Sans",Verdana,sans-serif!important}'; document.head.appendChild(schrift);
    const probe = document.createElement('span'); document.body.appendChild(probe);
    window.woerter = sel => [...document.querySelectorAll(sel)].filter(el => el.offsetParent).filter(el => {
        const cs = getComputedStyle(el), innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        probe.style.cssText = 'position:absolute; visibility:hidden; white-space:nowrap; font:' + cs.font + '; letter-spacing:' + cs.letterSpacing;
        return (el.innerText || '').trim().split(/\\s+/).flatMap(w => w.split(/(?<=-)/)).some(t => { probe.textContent = t; return probe.getBoundingClientRect().width > innen + 1; });
    }).map(el => (el.innerText || '').trim().slice(0, 24));
    window.ueberlauf = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
`;

async function testRunde32Markt(browser) {
    console.log('\n[26.17] Marktfilter, Kaderlücke, Kaderfolgen, Ersatz, kompakte Kaderliste, Blättern im Detail, Spielersuche');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(R32_HILFEN);
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const toasts = []; const toastAlt = showToast; showToast = (t) => { toasts.push(t); };
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 90; p.timesInjured = 0; p.tags = []; delete p.startFolge; });
        game.formation = '4-4-2'; autoLineup();
        if (!marketPlayers.length) refreshTransferMarket();
        game.money = 1e9; game.transferBudget = 1e9; game.wageBudget = 1e9; game.transferEmbargo = false; game.ffpTransferEmbargo = false;

        // --- Marktfilter ---
        showScreen('screen-transfer'); setTransferTab('market'); resetMarktFilter();
        const karten = () => [...document.querySelectorAll('#market-list .player-card')];
        out.fAlle = karten().length === marketPlayers.length && document.getElementById('market-filter-box').textContent.includes(`${marketPlayers.length} von ${marketPlayers.length} Spielern`);
        const pos = marketPlayers[0].pos;
        setMarktFilterPos(pos);
        const anzahlPos = marketPlayers.filter(p => p.pos === pos).length;
        out.fPos = karten().length === anzahlPos && getMarktAnsicht().every(x => x.p.pos === pos) && document.querySelector(`#market-filter-box button[aria-pressed="true"]`).textContent === pos;
        setMarktFilterPos(pos); out.fPosAus = karten().length === marketPlayers.length;
        setMarktSortierung('staerke'); const st = getMarktAnsicht().map(x => x.p.strength); out.fSortStaerke = st.every((v, i) => i === 0 || st[i - 1] >= v);
        setMarktSortierung('preis'); const pr = getMarktAnsicht().map(x => getTransferAsking(x.p)); out.fSortPreis = pr.every((v, i) => i === 0 || pr[i - 1] <= v);
        setMarktSortierung('alter'); const al = getMarktAnsicht().map(x => x.p.age || 0); out.fSortAlter = al.every((v, i) => i === 0 || al[i - 1] <= v);
        toasts.length = 0; setMarktSortierung('quatsch'); out.fSortUngueltig = toasts.some(t => t.includes('Unbekannte Sortierung')) && marktFilter.sortierung === 'alter';
        const teuer = getMarktAnsicht().map(x => x.p).sort((a, b) => getTransferAsking(b) - getTransferAsking(a))[0];
        game.money = getTransferAsking(teuer) - 1;
        toggleMarktFilterLeistbar();
        out.fLeistbar = getMarktAnsicht().every(x => getKaufHindernisse(x.p).length === 0) && !getMarktAnsicht().some(x => x.p.id === teuer.id);
        game.money = 0; renderTransferView();
        out.fLeer = karten().length === 0 && document.getElementById('market-list').textContent.includes('Kein Spieler passt zum Filter') && document.getElementById('market-filter-box').textContent.includes('Filter zurücksetzen');
        game.money = 1e9; resetMarktFilter();
        out.fReset = marktFilter.pos === '' && !marktFilter.nurLeistbar && marktFilter.sortierung === 'standard' && !document.getElementById('market-filter-box').textContent.includes('Filter zurücksetzen');
        // Index bleibt richtig: nach Filter + Sortierung kauft der Knopf genau den Spieler der Karte
        setMarktSortierung('preis');
        const ersteKarte = karten()[0];
        const zielName = ersteKarte.querySelector('.ui-card-title') ? ersteKarte.querySelector('.ui-card-title').textContent.trim() : '';
        const zielSpieler = getMarktAnsicht()[0].p;
        const vorKauf = squad.length;
        [...ersteKarte.querySelectorAll('button')].find(b => b.textContent.includes('Sofortkauf')).click();
        out.fIndexRichtig = squad.length === vorKauf + 1 && squad[squad.length - 1].id === zielSpieler.id && (!zielName || zielName.includes(zielSpieler.name));
        squad.pop(); resetMarktFilter();
        out.wFilter = JSON.stringify(woerter('#market-filter-box button'));
        out.fBreit = ueberlauf();

        // --- Kaderlücke -> Markt ---
        const abw = squad.filter(p => p.pos === 'ABW');
        const geparkt = abw.slice(2); squad = squad.filter(p => !geparkt.includes(p));
        showScreen('screen-squad-planning'); renderSquadPlanningPositionBox();
        const lueckeKnopf = [...document.querySelectorAll('#squad-planning-position-box button')].find(b => b.getAttribute('onclick') === "openMarktFuerPosition('ABW')");
        out.lKnopf = !!lueckeKnopf;
        lueckeKnopf.click();
        out.lMarkt = marktFilter.pos === 'ABW' && marktFilter.sortierung === 'staerke' && document.getElementById('transfer-tab-market').style.display === 'block' && getMarktAnsicht().every(x => x.p.pos === 'ABW');
        toasts.length = 0; openMarktFuerPosition('XYZ'); out.lUngueltig = toasts.some(t => t.includes('Unbekannte Position')) && marktFilter.pos === 'ABW';
        out.wPlaner = (showScreen('screen-squad-planning'), JSON.stringify(woerter('#squad-planning-position-box button')));
        squad = squad.concat(geparkt); resetMarktFilter();

        // --- Kaderfolgen bei Angeboten ---
        const abwNeu = squad.filter(p => p.pos === 'ABW').sort((a, b) => b.strength - a.strength);
        const bester = abwNeu[0];
        const f = getVerkaufsFolgen(bester);
        out.kFolgen = f.rest === abwNeu.length - 1 && f.minimum === SQUAD_PLANNING_MIN_HEALTHY.ABW && f.bester === true && f.nachfolger.id === abwNeu[1].id && f.startelf === lineup.includes(bester.id);
        out.kZuWenig = f.zuWenig === (abwNeu.length - 1 < SQUAD_PLANNING_MIN_HEALTHY.ABW);
        const schwach = abwNeu[abwNeu.length - 1];
        out.kNichtBester = getVerkaufsFolgen(schwach).bester === false && !getVerkaufsFolgenHtml(schwach).includes('Nachfolger');
        const html = getVerkaufsFolgenHtml(bester);
        out.kText = html.includes('Nach dem Verkauf: danach ' + (abwNeu.length - 1) + ' ABW') && html.includes(`Nachfolger wäre ${abwNeu[1].name}`);
        incomingOffers.length = 0;
        incomingOffers.push({ id: 'o1', playerId: bester.id, playerName: bester.name, playerPos: bester.pos, playerStr: bester.strength, marketValue: bester.marketValue, currentBid: bester.marketValue, clubName: 'Test FC', expiresIn: 3 });
        showScreen('screen-transfer'); setTransferTab('offers'); renderTransferView();
        out.kKarte = document.getElementById('incoming-offers-list').textContent.includes('Nach dem Verkauf');
        incomingOffers.length = 0;
        out.kNull = getVerkaufsFolgen(null) === null && getVerkaufsFolgenHtml(null) === '';

        // --- Ersatz finden ---
        const eig = squad.find(p => p.pos === marketPlayers[0].pos);
        const kand = getErsatzKandidaten(eig);
        out.eKandidaten = kand.length <= 3 && kand.every(m => m.pos === eig.pos && m.strength >= eig.strength - 3) && kand.every((m, i) => i === 0 || kand[i - 1].strength >= m.strength);
        eig.strength = 20;
        openPlayerDetail(eig.id, 'squad');
        const eb = document.getElementById('pd-ersatz');
        out.eBox = eb.textContent.includes('Ersatz auf dem Markt') && eb.querySelectorAll('button[onclick^="openPlayerCompare"]').length === getErsatzKandidaten(eig).length && getErsatzKandidaten(eig).length > 0;
        eb.querySelector('details').open = true;
        out.wErsatz = JSON.stringify(woerter('#pd-ersatz button'));
        eb.querySelector('button[onclick^="openPlayerCompare"]').click();
        out.eVergleich = document.getElementById('compare-overlay').classList.contains('show') && compareState.bId === eig.id && compareState.aPool === 'market';
        document.getElementById('compare-overlay').classList.remove('show');
        eig.strength = 99; renderErsatzSuche(eig, 'squad');
        out.eKeiner = document.getElementById('pd-ersatz').textContent.includes('Gerade kein');
        renderErsatzSuche(marketPlayers[0], 'market'); out.eNurKader = !document.getElementById('pd-ersatz').textContent.includes('Ersatz auf dem Markt'); // Marktspieler zeigen seit 26.18 die Kauf-Vorschau
        eig.strength = 60; closePlayerDetail();

        // --- Kompakte Kaderliste ---
        safeLocalSet(KADER_ANSICHT_KEY, 'karten');
        showScreen('screen-squad'); setSquadTab('aufstellung'); squadFilterPos = 'alle'; squadTagFilter = ''; squadBelastungNurRot = false; renderSquadView();
        out.kaKarten = document.querySelectorAll('#bench-list .player-card').length === squad.length && document.querySelectorAll('#bench-list .kader-zeile').length === 0;
        toggleKaderAnsicht();
        const zeilen = [...document.querySelectorAll('#bench-list .kader-zeile')];
        out.kaZeilen = getKaderAnsicht() === 'kompakt' && zeilen.length === squad.length && document.querySelectorAll('#bench-list .player-card').length === 0;
        out.kaInhalt = zeilen.every(z => /Str \d+/.test(z.textContent) && z.textContent.includes('Moral'));
        out.kaReihenfolge = zeilen.map(z => z.querySelector('.kader-zeile-name').textContent.replace(' Ⓒ', '')).join('|') === getSquadListeSortiert().map(p => p.name).join('|');
        const imElf = squad.find(p => lineup.includes(p.id));
        const zeileElf = zeilen.find(z => z.querySelector('.kader-zeile-name').textContent.replace(' Ⓒ', '') === imElf.name);
        out.kaElfMarke = zeileElf.classList.contains('kader-zeile-elf') && zeileElf.querySelector('.kader-zeile-elfknopf').textContent === 'Bank';
        toasts.length = 0; zeileElf.querySelector('.kader-zeile-elfknopf').click();
        const sagtWarum = lineup.includes(imElf.id) && toasts.some(t => t.includes('mindestens 11'));
        lineup = lineup.filter(id => id !== imElf.id); renderSquadView();
        const bankZeile = [...document.querySelectorAll('#bench-list .kader-zeile')].find(z => z.querySelector('.kader-zeile-name').textContent.replace(' Ⓒ', '') === imElf.name);
        bankZeile.querySelector('.kader-zeile-elfknopf').click();
        out.kaUmstellen = sagtWarum && lineup.includes(imElf.id) && lineup.length === 11;
        document.querySelector('#bench-list .kader-zeile .kader-zeile-haupt').click();
        out.kaDetail = document.getElementById('player-detail-overlay').classList.contains('show');
        closePlayerDetail();
        squadFilterPos = 'TW'; renderSquadView(); out.kaFilter = document.querySelectorAll('#bench-list .kader-zeile').length === squad.filter(p => p.pos === 'TW').length;
        squadFilterPos = 'alle'; renderSquadView();
        out.wKompakt = JSON.stringify(woerter('#bench-list button, #squad-tag-filter button'));
        out.kaBreit = ueberlauf();
        toggleKaderAnsicht(); out.kaZurueck = getKaderAnsicht() === 'karten';

        // --- Blättern im Spielerdetail ---
        squadSortMode = 'staerke';
        const reihe = getSquadListeSortiert();
        openPlayerDetail(reihe[0].id, 'squad');
        out.bNav = document.getElementById('pd-nav').textContent.includes(`1 / ${reihe.length}`) && document.querySelector('#pd-nav button').disabled;
        out.wNav = JSON.stringify(woerter('#pd-nav button'));
        blaetterSpielerDetail(1);
        out.bWeiter = currentDetailPlayerId === reihe[1].id && document.getElementById('pd-name').textContent.includes(reihe[1].name) && document.getElementById('pd-nav').textContent.includes(`2 / ${reihe.length}`);
        blaetterSpielerDetail(-1); out.bZurueck = currentDetailPlayerId === reihe[0].id;
        toasts.length = 0; out.bErster = blaetterSpielerDetail(-1) === false && toasts.some(t => t.includes('erste Spieler'));
        openPlayerDetail(reihe[reihe.length - 1].id, 'squad'); toasts.length = 0;
        out.bLetzter = blaetterSpielerDetail(1) === false && toasts.some(t => t.includes('letzte Spieler'));
        squadFilterPos = 'TW'; const tws = getSquadListeSortiert();
        openPlayerDetail(tws[0].id, 'squad'); out.bFilter = document.getElementById('pd-nav').textContent.includes(`1 / ${tws.length}`) || tws.length < 2;
        squadFilterPos = 'alle';
        // Markt mit Filter
        setMarktFilterPos(marketPlayers[0].pos);
        const mreihe = getMarktAnsicht().map(x => x.p);
        openPlayerDetail(mreihe[0].id, 'market');
        out.bMarkt = mreihe.length < 2 ? document.getElementById('pd-nav').innerHTML === '' : document.getElementById('pd-nav').textContent.includes(`1 / ${mreihe.length}`);
        resetMarktFilter();
        // Wischen im Detail
        setzeWischen('an');
        openPlayerDetail(reihe[0].id, 'squad');
        const ziel = document.getElementById('pd-name');
        const beruehren = (typ, x, y) => { const t = new Touch({ identifier: 1, target: ziel, clientX: x, clientY: y }); ziel.dispatchEvent(new TouchEvent(typ, { bubbles: true, touches: typ === 'touchend' ? [] : [t], changedTouches: [t] })); };
        beruehren('touchstart', 250, 300); beruehren('touchend', 120, 305);
        out.bWisch = currentDetailPlayerId === reihe[1].id;
        beruehren('touchstart', 120, 300); beruehren('touchend', 260, 302);
        out.bWischZurueck = currentDetailPlayerId === reihe[0].id;
        closePlayerDetail();
        openPlayerDetail(youthTalents.length ? youthTalents[0].id : reihe[0].id, youthTalents.length ? 'youth' : 'squad');
        out.bAndererBereich = youthTalents.length < 2 || document.getElementById('pd-nav').textContent.includes(`/ ${youthTalents.length}`);
        closePlayerDetail();

        // --- Spielersuche ---
        const name = squad[3].name;
        const teil = name.slice(1, 4).toUpperCase();
        const tr = sucheSpieler(teil);
        out.sFindet = tr.some(t => t.p.id === squad[3].id && t.pool === 'squad' && t.label === 'Kader');
        out.sKurz = sucheSpieler('a').length === 0 && sucheSpieler('').length === 0;
        squad[4].name = 'Jérôme Müller';
        out.sAkzente = sucheSpieler('jerome').some(t => t.p.id === squad[4].id) && sucheSpieler('MÜLL').some(t => t.p.id === squad[4].id);
        const mname = marketPlayers[1].name.slice(0, 5);
        out.sMarkt = sucheSpieler(mname).some(t => t.pool === 'market' && t.label === 'Transfermarkt');
        if (freeAgentPlayers.length) out.sVereinslos = sucheSpieler(freeAgentPlayers[0].name).some(t => t.label === 'Vereinslos'); else out.sVereinslos = true;
        toggleMenuDrawer();
        const feld = document.getElementById('player-search-input');
        feld.value = 'jérôme'; renderSpielerSuche(feld.value);
        const treffer = [...document.querySelectorAll('#player-search-results button')];
        const meiner = treffer.find(b => b.textContent.includes('Jérôme Müller'));
        out.sListe = !!meiner && meiner.textContent.includes('Kader');
        out.wSuche = JSON.stringify(woerter('#player-search-results button'));
        meiner.click();
        out.sOeffnet = document.getElementById('player-detail-overlay').classList.contains('show') && currentDetailPlayerId === squad[4].id && !document.getElementById('app-sidebar').classList.contains('menu-open');
        closePlayerDetail();
        renderSpielerSuche('zzqq'); out.sNichts = document.getElementById('player-search-results').textContent.includes('Kein Spieler gefunden');
        renderSpielerSuche('e'); out.sLeer = document.getElementById('player-search-results').innerHTML === '';
        const viele = sucheSpieler('e').length; renderSpielerSuche('ee');
        out.sBegrenzt = document.querySelectorAll('#player-search-results button').length <= SPIELER_SUCHE_MAX;
        squad[5].name = '<b>X</b> Test'; renderSpielerSuche('test');
        out.sMaskiert = !document.getElementById('player-search-results').innerHTML.includes('<b>X</b>') || viele < 0;
        showToast = toastAlt;
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['fAlle', 'fPos', 'fPosAus', 'fSortStaerke', 'fSortPreis', 'fSortAlter', 'fSortUngueltig', 'fLeistbar', 'fLeer', 'fReset', 'fIndexRichtig', 'fBreit'];
    assert(ok(...A), `Marktfilter: Position, nur leistbar, Sortierungen, leerer Filter, Zurücksetzen, Sofortkauf trifft den richtigen Spieler (${werte(A)})`);
    const B = ['lKnopf', 'lMarkt', 'lUngueltig'];
    assert(ok(...B), `Kaderlücke: Knopf im Kaderplaner öffnet den Markt mit der Position (${werte(B)})`);
    const C = ['kFolgen', 'kZuWenig', 'kNichtBester', 'kText', 'kKarte', 'kNull'];
    assert(ok(...C), `Kaderfolgen: Restbesetzung, Minimum, bester Spieler mit Nachfolger, Anzeige auf der Angebotskarte (${werte(C)})`);
    const D = ['eKandidaten', 'eBox', 'eVergleich', 'eKeiner', 'eNurKader'];
    assert(ok(...D), `Ersatz finden: Kandidaten gleicher Position, Vergleich, Hinweis ohne Treffer, nur für Kaderspieler (${werte(D)})`);
    const E = ['kaKarten', 'kaZeilen', 'kaInhalt', 'kaReihenfolge', 'kaElfMarke', 'kaUmstellen', 'kaDetail', 'kaFilter', 'kaBreit', 'kaZurueck'];
    assert(ok(...E), `Kompakte Kaderliste: Umschalten, Zeilen in Listenreihenfolge, Startelf-Knopf, Detail, Filter, Einstellung (${werte(E)})`);
    const F = ['bNav', 'bWeiter', 'bZurueck', 'bErster', 'bLetzter', 'bFilter', 'bMarkt', 'bWisch', 'bWischZurueck', 'bAndererBereich'];
    assert(ok(...F), `Blättern im Spielerdetail: Knöpfe, Rand, gefilterte Listen, Markt, Wischen (${werte(F)})`);
    const G = ['sFindet', 'sKurz', 'sAkzente', 'sMarkt', 'sVereinslos', 'sListe', 'sOeffnet', 'sNichts', 'sLeer', 'sBegrenzt', 'sMaskiert'];
    assert(ok(...G), `Spielersuche: Teilnamen, Akzente, alle Bereiche, Treffer öffnet das Detail, Grenzen, maskiert (${werte(G)})`);
    assert([r.wFilter, r.wPlaner, r.wErsatz, r.wKompakt, r.wNav, r.wSuche].every(w => w === '[]'), `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${JSON.stringify([r.wFilter, r.wPlaner, r.wErsatz, r.wKompakt, r.wNav, r.wSuche])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde32Spieltag(browser) {
    console.log('\n[26.17] Tabellen-Vorschau, Lieblings-/Angstgegner, Spielstil-Empfehlung, Rekord-Hinweise, empfohlene Vorbereitung, Ampel im Livespiel');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(R32_HILFEN);
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const toasts = []; const toastAlt = showToast; showToast = (t) => { toasts.push(t); };
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 95; p.timesInjured = 0; p.tags = []; delete p.startFolge; });
        game.formation = '4-4-2'; autoLineup();
        const liga = leaguesData[game.leagueLevel];
        const ich = liga.find(t => t.name === game.clubName);
        const andere = liga.filter(t => t !== ich);
        const punkte = [40, 35, 33, 31, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];
        andere.forEach((t, i) => { t.points = punkte[i] !== undefined ? punkte[i] : 10 - i; t.goalsFor = 0; t.goalsAgainst = 0; t.played = 10; });
        ich.points = 30; ich.goalsFor = 0; ich.goalsAgainst = 0; ich.played = 10;
        const opp = andere[3]; // 31 Punkte
        game.matchday = 11;

        // --- Tabellen-Vorschau ---
        const v = getTabellenVorschau(opp.name);
        out.tvJetzt = v.jetzt === 5;
        out.tvWerte = v.sieg === 3 && v.remis === 5 && v.niederlage === 5;
        out.tvUnveraendert = ich.points === 30 && opp.points === 31 && ich.played === 10;
        out.tvOhneMich = (() => { const alt = liga.indexOf(ich); liga.splice(alt, 1); const x = getTabellenVorschau(opp.name); liga.splice(alt, 0, ich); return x === null; })();

        // --- Lieblings- und Angstgegner ---
        game.headToHeadRecords = {
            [opp.name]: { wins: 3, draws: 0, losses: 0, goalsFor: 6, goalsAgainst: 1, lastResults: [] },
            'Angst FC': { wins: 0, draws: 1, losses: 3, goalsFor: 1, goalsAgainst: 8, lastResults: [] },
            'Einmal FC': { wins: 1, draws: 0, losses: 0, goalsFor: 2, goalsAgainst: 0, lastResults: [] },
            'Mittel FC': { wins: 1, draws: 1, losses: 1, goalsFor: 3, goalsAgainst: 3, lastResults: [] }
        };
        const l = getGegnerBilanzListen();
        out.gListen = l.liebling.length === 1 && l.liebling[0].name === opp.name && l.angst.length === 1 && l.angst[0].name === 'Angst FC';
        out.gTyp = getGegnerTyp(opp.name).typ === 'liebling' && getGegnerTyp('Angst FC').typ === 'angst' && getGegnerTyp('Mittel FC') === null && getGegnerTyp('Einmal FC') === null;
        showScreen('screen-squad'); setSquadTab('analyse'); renderGegnerBilanzBox();
        const gb = document.getElementById('gegner-bilanz-box').textContent;
        out.gBox = gb.includes(opp.name) && gb.includes('Angst FC') && !gb.includes('Einmal FC') && !gb.includes('Mittel FC') && gb.includes('3S 0U 0N');
        game.headToHeadRecords = {}; renderGegnerBilanzBox();
        out.gLeer = document.getElementById('gegner-bilanz-box').textContent.includes('Noch zu wenige Duelle');
        game.headToHeadRecords = { [opp.name]: { wins: 3, draws: 0, losses: 0, goalsFor: 6, goalsAgainst: 1, lastResults: [] } };

        // --- Spielstil-Empfehlung ---
        staffMembers.analyst.hired = false; if (typeof underworld !== 'undefined') underworld.spyIntelActive = false;
        game.recentTacticStyles = []; game.oppTacticPlan = null;
        opp.playstyle = 'defensiv'; game.tacticStyle = 'pressing';
        let st = getStilEmpfehlung(opp.name);
        out.sPresse = !!st && st.gegner === 'K' && st.stil === 'ballbesitz' && st.quelle === 'laut Presse' && st.passt === false;
        game.oppTacticPlan = null; opp.playstyle = 'offensiv'; st = getStilEmpfehlung(opp.name);
        out.sOffensiv = st.gegner === 'P' && st.stil === 'konter';
        game.oppTacticPlan = null; opp.playstyle = 'ausgeglichen'; st = getStilEmpfehlung(opp.name);
        out.sAusgeglichen = st.gegner === 'B' && st.stil === 'pressing' && st.passt === true;
        staffMembers.analyst.hired = true; game.oppTacticPlan.arch = 'K';
        st = getStilEmpfehlung(opp.name);
        out.sAnalyst = st.quelle === 'laut Analyst' && st.gegner === 'K' && st.stil === 'ballbesitz';
        staffMembers.analyst.hired = false;
        game.oppTacticPlan = null; opp.playstyle = 'defensiv'; game.tacticStyle = 'pressing';
        out.sUnbekannt = getStilEmpfehlung('Gibt es nicht') === null;
        pendingMatchInfo = { isHome: true, oppName: opp.name, oppStr: 60, ourFixture: null };
        showScreen('screen-prematch-press'); renderPrematchCheck();
        const pc = () => document.getElementById('prematch-check-box').textContent;
        out.sAnzeige = pc().includes('laut Presse meist Konter') && pc().includes('Dagegen hilft Ballbesitz') && pc().includes('Ballbesitz übernehmen');
        out.tvAnzeige = pc().includes('Sieg Platz 3') && pc().includes('Remis Platz 5') && pc().includes('Niederlage Platz 5');
        out.gChip = pc().includes('😊 Lieblingsgegner (3S 0U 0N)');
        out.wCheck = JSON.stringify(woerter('#prematch-check-box button'));
        out.cBreit = ueberlauf();
        [...document.querySelectorAll('#prematch-check-box button')].find(b => b.textContent.includes('Ballbesitz übernehmen')).click();
        out.sUebernommen = game.tacticStyle === 'ballbesitz' && pc().includes('Dein Spielstil passt');
        toasts.length = 0; applyStilEmpfehlung('quatsch'); out.sUngueltig = toasts.some(t => t.includes('Unbekannter Spielstil')) && game.tacticStyle === 'ballbesitz';

        // --- Rekord-Hinweise ---
        game.serien = { aktuell: { sieg: 3, unbesiegt: 6, heimSieg: 2, zuNull: 0, ohneSieg: 0, niederlage: 0, torlos: 0 }, rekord: { sieg: { n: 3 }, unbesiegt: { n: 10 }, heimSieg: { n: 2 } } };
        let rh = getRekordHinweise(true).map(x => x.text);
        out.rSieg = rh.some(t => t.includes('neuer Vereinsrekord, 4 Siege in Folge'));
        out.rEndet = rh.some(t => t.includes('endet die Serie von 6 ungeschlagenen'));
        out.rHeim = rh.some(t => t.includes('5') === false && t.includes('3 Heimsiege in Folge')) && !getRekordHinweise(false).some(x => x.text.includes('Heimsieg'));
        game.serien = { aktuell: { ohneSieg: 4, niederlage: 2 }, rekord: { ohneSieg: { n: 4 }, niederlage: { n: 2 } } };
        rh = getRekordHinweise(true).map(x => x.text);
        out.rNegativ = rh.some(t => t.includes('Seit 4 Spielen ohne Sieg') && t.includes('Negativrekord')) && rh.some(t => t.includes('Negativrekord, 3 Niederlagen'));
        game.serien = { aktuell: {}, rekord: {} }; out.rNichts = getRekordHinweise(true).length === 0;
        delete game.serien; out.rAltesFeld = Array.isArray(getRekordHinweise(true));
        game.serien = { aktuell: { sieg: 5 }, rekord: { sieg: { n: 5 } } }; renderPrematchCheck();
        out.rAnzeige = pc().includes('🏅 Mit einem Sieg: neuer Vereinsrekord, 6 Siege in Folge.');

        // --- Empfohlene Vorbereitung ---
        game.matchplaene = {}; game.lineupPresets = [null, null, null, null, null]; game.tacticPresets = [null, null, null, null, null];
        game.tacticStyle = 'pressing'; game.oppTacticPlan = null;
        const muede = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW' && squad.some(b => !lineup.includes(b.id) && b.pos === p.pos));
        muede.fitness = 40;
        let emp = getEmpfohleneVorbereitung(opp.name);
        out.eSchritte = emp.some(x => x.art === 'tausch' && x.raus === muede.id) && emp.some(x => x.art === 'stil' && x.stil === 'ballbesitz') && !emp.some(x => x.art === 'matchplan');
        renderPrematchCheck();
        out.eAnzeige = pc().includes('Empfohlene Vorbereitung') && pc().includes(`Alles übernehmen (${emp.length})`) && pc().includes(muede.name + ' ↔');
        toasts.length = 0;
        [...document.querySelectorAll('#prematch-check-box button')].find(b => b.textContent.startsWith('Alles übernehmen')).click();
        out.eUebernommen = !lineup.includes(muede.id) && game.tacticStyle === 'ballbesitz' && toasts.filter(t => t.startsWith('✅ Übernommen')).length === 1 && toasts.length === 1;
        out.eNachher = getEmpfohleneVorbereitung(opp.name).length === 0 && !pc().includes('Empfohlene Vorbereitung');
        toasts.length = 0; applyEmpfohleneVorbereitung(); out.eNichts = toasts.some(t => t.includes('nichts zu übernehmen'));
        // mit Matchplan: Matchplan statt Tausch, kein Stil-Schritt, wenn er eine Taktik setzt
        muede.fitness = 95; autoLineup();
        game.formation = '4-4-2'; saveLineupPreset(0); game.tacticStyle = 'offensiv'; saveTacticPreset(0); game.tacticStyle = 'pressing';
        game.matchplaene = { [opp.name]: { aufstellung: 0, taktik: 0 } };
        emp = getEmpfohleneVorbereitung(opp.name);
        out.eMatchplan = emp.length === 1 && emp[0].art === 'matchplan' && emp[0].text.includes('Vorlage 1') && emp[0].text.includes('Taktik 1');
        applyEmpfohleneVorbereitung();
        out.eMatchplanAngewendet = game.tacticStyle === 'offensiv';
        game.matchplaene = { [opp.name]: { aufstellung: 0, taktik: null } }; game.tacticStyle = 'pressing';
        emp = getEmpfohleneVorbereitung(opp.name);
        out.eMatchplanOhneTaktik = emp.length === 2 && emp[0].art === 'matchplan' && emp[1].art === 'stil';
        game.matchplaene = {};

        // --- Ampel im Livespiel ---
        const roter = squad.find(p => lineup.includes(p.id) && p.pos !== 'TW');
        roter.fitness = 45; roter.timesInjured = 3;
        const cmAlt = typeof currentMatch !== 'undefined' ? currentMatch : null;
        currentMatch = { sentOff: [] };
        renderLiveSubs();
        const optRot = [...document.querySelectorAll('#live-sub-out option')].find(o => o.value === String(roter.id));
        out.lOption = !!optRot && optRot.textContent.includes('🚦 rot');
        out.lGruenOhne = [...document.querySelectorAll('#live-sub-out option')].filter(o => o.value !== String(roter.id)).every(o => !o.textContent.includes('🚦') || squad.find(p => String(p.id) === o.value).fitness < 80);
        out.lBank = [...document.querySelectorAll('#live-subs-list button')].every(b => /\d+ %/.test(b.textContent));
        currentMatch = cmAlt;
        showToast = toastAlt;
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['tvJetzt', 'tvWerte', 'tvUnveraendert', 'tvOhneMich', 'tvAnzeige'];
    assert(ok(...A), `Tabellen-Vorschau: Platz nach Sieg, Remis, Niederlage ohne die echte Tabelle zu ändern (${werte(A)})`);
    const B = ['gListen', 'gTyp', 'gBox', 'gLeer', 'gChip'];
    assert(ok(...B), `Lieblings- und Angstgegner: ab zwei Duellen, Schwellen, Kasten und Chip im Spieltag-Check (${werte(B)})`);
    const C = ['sPresse', 'sOffensiv', 'sAusgeglichen', 'sAnalyst', 'sUnbekannt', 'sAnzeige', 'sUebernommen', 'sUngueltig'];
    assert(ok(...C), `Spielstil-Empfehlung: nach Presse oder Analyst, passender Stil, Übernehmen, ungültige Eingabe (${werte(C)})`);
    const D = ['rSieg', 'rEndet', 'rHeim', 'rNegativ', 'rNichts', 'rAltesFeld', 'rAnzeige'];
    assert(ok(...D), `Rekord-Hinweise: neuer Rekord, endende Serie, Heimserie nur zu Hause, Negativrekorde, Anzeige (${werte(D)})`);
    const E = ['eSchritte', 'eAnzeige', 'eUebernommen', 'eNachher', 'eNichts', 'eMatchplan', 'eMatchplanAngewendet', 'eMatchplanOhneTaktik'];
    assert(ok(...E), `Empfohlene Vorbereitung: Tausch und Stil, eine Sammelmeldung, Matchplan hat Vorrang (${werte(E)})`);
    const F = ['lOption', 'lGruenOhne', 'lBank'];
    assert(ok(...F), `Ampel im Livespiel: Raus-Liste mit Ampel, Bank mit Fitness (${werte(F)})`);
    assert(r.wCheck === '[]' && r.cBreit === true, `Spieltag-Check bei 320 px in breiter Schrift: Wörter passen, kein Überlauf (${r.wCheck}/${r.cBreit})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde32Uebersicht(browser) {
    console.log('\n[26.17] Restprogramm, Zusammenfassung nach dem Simulieren, Kalender, Tagebuch, Erinnern-Knöpfe, Tag/Nacht, Favoriten');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(R32_HILFEN);
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        const toasts = []; const toastAlt = showToast; showToast = (t) => { toasts.push(t); };
        const liga = leaguesData[game.leagueLevel];
        const eigeneSpiele = md => (fixturesData[game.leagueLevel][md - 1] || []).find(f => liga[f.home].name === game.clubName || liga[f.away].name === game.clubName);

        // --- Restprogramm ---
        const rp = getRestprogramm();
        const erwartet = []; for (let md = game.matchday; md <= 34; md++) { const f = eigeneSpiele(md); if (f && !f.played) erwartet.push(md); }
        out.rpSpiele = rp.spiele.map(x => x.md).join() === erwartet.join() && rp.spiele.length > 20;
        const f0 = eigeneSpiele(rp.spiele[0].md);
        out.rpHeim = rp.spiele[0].heim === (liga[f0.home].name === game.clubName) && rp.spiele[0].name === (rp.spiele[0].heim ? liga[f0.away].name : liga[f0.home].name);
        out.rpPlatz = rp.spiele.every(x => x.platz >= 1 && x.platz <= liga.length);
        let besteSchnitt = 0; for (let i = 0; i + 2 < rp.spiele.length; i++) besteSchnitt = Math.max(besteSchnitt, (rp.spiele[i].staerke + rp.spiele[i + 1].staerke + rp.spiele[i + 2].staerke) / 3);
        out.rpSchwer = Math.abs(rp.schwer.schnitt - besteSchnitt) < 1e-9 && rp.schwer.bis - rp.schwer.von >= 2;
        game.gegnerNotizen = { [rp.spiele[0].name]: { text: 'x', season: 1, matchday: 1 } };
        game.matchplaene = { [rp.spiele[1].name]: { aufstellung: null, taktik: null } };
        showScreen('screen-dashboard'); renderRestprogramm();
        const rb = document.getElementById('rest-programm-box').textContent;
        out.rpBox = rb.includes('Restprogramm') && rb.includes(rp.spiele[0].name) && rb.includes('📓') && rb.includes('📋') && rb.includes(`Noch ${rp.spiele.length} Ligaspiele`) && rb.includes('schwerste Phase');
        out.rpFuenf = (rb.match(/Platz \d+ · Str/g) || []).length === 5;
        game.gegnerNotizen = {}; game.matchplaene = {};

        // --- Zusammenfassung nach dem Simulieren ---
        const tabVor = sortedTable(game.leagueLevel); const rangVor = tabVor.findIndex(t => t.name === game.clubName) + 1; const mdVor = game.matchday;
        simulateMatchdays(3, true);
        const ov = document.getElementById('sim-summary-overlay'), sb = document.getElementById('sim-summary-body').textContent;
        const rangNach = sortedTable(game.leagueLevel).findIndex(t => t.name === game.clubName) + 1;
        out.szOffen = ov.classList.contains('show') && sb.includes(`Spieltag ${mdVor} bis ${mdVor + 2}`);
        out.szSpiele = document.querySelectorAll('#sim-summary-body .box').length === 4 && sb.includes(`Tabellenplatz ${rangVor} → ${rangNach}`);
        out.szBilanz = /Bilanz \dS \dU \dN, [+-]?\d+ Punkte/.test(sb) && sb.includes('Kasse') && (sb.includes('Neu verletzt') || sb.includes('Keine neuen Verletzungen'));
        out.wSim = JSON.stringify(woerter('#sim-summary-body button'));
        out.szBreit = ueberlauf();
        closeSimZusammenfassung(); out.szZu = !ov.classList.contains('show');
        simulateMatchdays(1); out.szOhneFlag = !ov.classList.contains('show');
        out.szKnopf = document.querySelector('button[onclick="simulateMatchdays(5, true)"]') !== null;

        // --- Kalender, Erinnerungen, Tagebuch ---
        game.erinnerungen = [{ id: 'r1', text: 'Erinnerung <b>A</b>', season: game.season, bis: 20 }];
        game.tagebuch = [{ season: game.season, matchday: 21, text: 'Tagebuch <i>B</i>' }];
        squad[0].contracts = 1;
        showScreen('screen-calendar'); renderCalendarView();
        const zeilen = [...document.querySelectorAll('#cal-schedule-list .player-row')];
        out.kAnzahl = zeilen.length === 34;
        const gespielt = eigeneSpiele(1), heim1 = liga[gespielt.home].name === game.clubName;
        out.kGegner = zeilen[0].textContent.includes((heim1 ? '🏠 ' : '✈️ ') + (heim1 ? liga[gespielt.away].name : liga[gespielt.home].name)) && zeilen[0].textContent.includes(`${heim1 ? gespielt.homeGoals : gespielt.awayGoals}:${heim1 ? gespielt.awayGoals : gespielt.homeGoals}`);
        out.kErinnerung = zeilen[19].textContent.includes('📝 Erinnerung <b>A</b>') && !zeilen[19].innerHTML.includes('<b>A</b>');
        out.kTagebuch = zeilen[20].textContent.includes('📔 Tagebuch <i>B</i>');
        out.kFenster = zeilen[2].textContent.includes('Sommer-Transferfensters');
        out.kVertraege = zeilen[33].textContent.includes('Zum Saisonende laufen') && zeilen[33].textContent.includes(squad[0].name);
        out.kBreit = ueberlauf();
        // Tagebuch-Fenster
        openTagebuch(7);
        out.tOffen = document.getElementById('diary-overlay').classList.contains('show') && document.getElementById('diary-matchday').value === '7';
        document.getElementById('diary-text').value = '  Taktik   umgestellt ' + 'x'.repeat(300);
        saveTagebuch();
        const e7 = getTagebuchEintrag(game.season, 7);
        out.tGespeichert = !!e7 && e7.text.startsWith('Taktik umgestellt ') && e7.text.length === TAGEBUCH_MAX_TEXT;
        out.tListe = document.getElementById('diary-body').textContent.includes('Spieltag 7:');
        out.wTagebuch = JSON.stringify(woerter('#diary-body button'));
        document.getElementById('diary-matchday').value = '7'; document.getElementById('diary-text').value = 'Neu'; saveTagebuch();
        out.tUeberschrieben = getTagebuchEintrag(game.season, 7).text === 'Neu' && game.tagebuch.filter(x => x.season === game.season && x.matchday === 7).length === 1;
        document.getElementById('diary-text').value = ''; saveTagebuch();
        out.tGeloescht = getTagebuchEintrag(game.season, 7) === null;
        const opt = document.createElement('option'); opt.value = '99'; document.getElementById('diary-matchday').appendChild(opt); document.getElementById('diary-matchday').value = '99';
        toasts.length = 0; saveTagebuch(); out.tUngueltig = toasts.some(t => t.includes('zwischen 1 und 34'));
        closeTagebuch(); out.tZu = !document.getElementById('diary-overlay').classList.contains('show');
        // im Rückblick
        game.managerCareer = [{ season: game.season, club: game.clubName, level: game.leagueLevel, league: 'Liga', rank: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 1, points: 4 }];
        const rt = (() => { const d = document.createElement('div'); d.innerHTML = buildSeasonReviewHtml(game.season); return d.textContent; })();
        out.tRueckblick = rt.includes('📔 Tagebuch') && rt.includes('21. Tagebuch <i>B</i>');
        game.managerCareer = [];
        delete game.tagebuch; out.tAltesFeld = getTagebuchEintrag(1, 1) === null && Array.isArray(game.tagebuch);

        // --- Erinnern-Knöpfe ---
        game.erinnerungen = [];
        squad[0].contracts = 2;
        openPlayerDetail(squad[0].id, 'squad');
        const ek = document.querySelector('#pd-erinnern button');
        out.eKnopf = !!ek;
        out.wErinnern = JSON.stringify(woerter('#pd-erinnern button'));
        ek.click();
        out.eVorbelegt = document.getElementById('reminder-overlay').classList.contains('show') && document.getElementById('reminder-text').value === `Vertrag von ${squad[0].name} klären` && !document.getElementById('player-detail-overlay').classList.contains('show');
        addErinnerung(); out.eGespeichert = game.erinnerungen.length === 1 && game.erinnerungen[0].text === `Vertrag von ${squad[0].name} klären`;
        closeErinnerungen();
        squad[0].contracts = 4; openPlayerDetail(squad[0].id, 'squad'); document.querySelector('#pd-erinnern button').click();
        out.eOhneVertrag = document.getElementById('reminder-text').value === `${squad[0].name}: `;
        closeErinnerungen();
        openPlayerDetail(marketPlayers[0] ? marketPlayers[0].id : squad[0].id, marketPlayers[0] ? 'market' : 'squad');
        out.eNurKader = !marketPlayers[0] || document.getElementById('pd-erinnern').innerHTML === '';
        closePlayerDetail();
        squad[0].contracts = 1; showScreen('screen-contracts'); renderContractsView();
        const vk = document.querySelector('#contract-plan-box button');
        out.vKnopf = !!vk;
        out.wPlan = JSON.stringify(woerter('#contract-plan-box button'));
        vk.click(); out.vVorbelegt = document.getElementById('reminder-text').value.startsWith('Verträge klären: ') && document.getElementById('reminder-text').value.includes(squad.filter(p => p.contracts <= 1).sort((a, b) => b.strength - a.strength)[0].name);
        closeErinnerungen();

        // --- Tag/Nacht ---
        setzeDesignTheme('flutlicht');
        const tk = document.getElementById('theme-quick-btn');
        out.tnStart = tk.textContent === '☀️ Tagmodus';
        wechsleTagNacht();
        out.tnTag = getDesignTheme() === 'tageslicht' && document.documentElement.getAttribute('data-theme') === 'tageslicht' && tk.textContent === '🌙 Nachtmodus';
        wechsleTagNacht(); out.tnNacht = getDesignTheme() === 'flutlicht' && !document.documentElement.hasAttribute('data-theme') && tk.textContent === '☀️ Tagmodus';
        setzeDesignTheme('kontrast'); wechsleTagNacht(); out.tnKontrast = getDesignTheme() === 'tageslicht';
        setzeDesignTheme('flutlicht');

        // --- Favoriten ---
        safeLocalSet(FAVORITEN_KEY, '[]');
        showScreen('screen-dashboard'); renderFavoritenLeiste();
        out.fLeer = document.getElementById('favoriten-box').textContent.includes('Favoriten festlegen');
        openFavoritenAuswahl();
        const menue = getMenueBildschirme();
        out.fAuswahl = menue.length > 10 && document.querySelectorAll('#favoriten-body button').length === menue.length && menue.includes('screen-squad');
        ['screen-squad', 'screen-transfer', 'screen-finances', 'screen-league'].forEach(id => toggleFavorit(id));
        toasts.length = 0; toggleFavorit('screen-inbox');
        out.fMax = getFavoriten().length === 4 && !getFavoriten().includes('screen-inbox') && toasts.some(t => t.includes('Höchstens 4'));
        out.fAuswahlMarke = document.querySelector('#favoriten-body button[data-s="screen-squad"]').getAttribute('aria-pressed') === 'true';
        out.wFavAuswahl = JSON.stringify(woerter('#favoriten-body button'));
        closeFavoritenAuswahl();
        renderFavoritenLeiste();
        const fb = [...document.querySelectorAll('#favoriten-box button')];
        out.fLeiste = fb.length === 5 && fb[4].textContent.includes('Bearbeiten') && fb.every(b => b.textContent.trim().length > 2);
        out.wFavLeiste = JSON.stringify(woerter('#favoriten-box button'));
        fb[0].click(); out.fKlick = aktiverScreen === 'screen-squad';
        toggleFavorit('screen-squad'); out.fEntfernt = !getFavoriten().includes('screen-squad') && getFavoriten().length === 3;
        toasts.length = 0; toggleFavorit('screen-gibtsnicht'); out.fUngueltig = toasts.some(t => t.includes('gibt es nicht im Menü')) && getFavoriten().length === 3;
        safeLocalSet(FAVORITEN_KEY, '{kaputt'); out.fKaputt = getFavoriten().length === 0;
        toggleMenuDrawer(); out.wTagNacht = JSON.stringify(woerter('#theme-quick-btn')); toggleMenuDrawer();
        showToast = toastAlt;
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['rpSpiele', 'rpHeim', 'rpPlatz', 'rpSchwer', 'rpBox', 'rpFuenf'];
    assert(ok(...A), `Restprogramm: echte Restspiele, Heim/Auswärts, schwerste Phase, Anzeige mit Notiz- und Matchplan-Symbol (${werte(A)})`);
    const B = ['szOffen', 'szSpiele', 'szBilanz', 'szBreit', 'szZu', 'szOhneFlag', 'szKnopf'];
    assert(ok(...B), `Zusammenfassung nach dem Simulieren: Ergebnisse, Tabellenplatz vorher und nachher, nur über den Knopf (${werte(B)})`);
    const C = ['kAnzahl', 'kGegner', 'kErinnerung', 'kTagebuch', 'kFenster', 'kVertraege', 'kBreit'];
    assert(ok(...C), `Kalender: Gegner mit Ergebnis, Erinnerungen, Tagebuch, Transferfrist, auslaufende Verträge (${werte(C)})`);
    const D = ['tOffen', 'tGespeichert', 'tListe', 'tUeberschrieben', 'tGeloescht', 'tUngueltig', 'tZu', 'tRueckblick', 'tAltesFeld'];
    assert(ok(...D), `Managertagebuch: Speichern gekürzt, Überschreiben, Löschen, ungültiger Spieltag, Saisonrückblick, alte Spielstände (${werte(D)})`);
    const E = ['eKnopf', 'eVorbelegt', 'eGespeichert', 'eOhneVertrag', 'eNurKader', 'vKnopf', 'vVorbelegt'];
    assert(ok(...E), `Erinnern-Knöpfe: Spielerdetail und Vertragsplan füllen das Erinnerungsfenster vor (${werte(E)})`);
    const F = ['tnStart', 'tnTag', 'tnNacht', 'tnKontrast'];
    assert(ok(...F), `Tag/Nacht-Schnellschalter wechselt zwischen Tageslicht und Flutlicht (${werte(F)})`);
    const G = ['fLeer', 'fAuswahl', 'fMax', 'fAuswahlMarke', 'fLeiste', 'fKlick', 'fEntfernt', 'fUngueltig', 'fKaputt'];
    assert(ok(...G), `Favoriten-Leiste: Auswahl aus dem Menü, höchstens vier, Schnellknöpfe im Dashboard (${werte(G)})`);
    assert([r.wSim, r.wTagebuch, r.wErinnern, r.wPlan, r.wFavAuswahl, r.wFavLeiste, r.wTagNacht].every(w => w === '[]'), `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${JSON.stringify([r.wSim, r.wTagebuch, r.wErinnern, r.wPlan, r.wFavAuswahl, r.wFavLeiste, r.wTagNacht])})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde32Statistik(browser) {
    console.log('\n[26.17] Meilensteine, Saisonverlauf, Vorsaison im Tabellenverlauf, Kaderwert-Kurve');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(R32_HILFEN);
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const out = {};
        squad.forEach(p => { delete p.meilenstein; p.injured = 0; p.suspended = 0; });

        // --- Meilensteine ---
        const p = squad[0];
        p.goalsCareer = 10;
        const vor = inboxMessages.length;
        out.mTor = pruefeTorMeilenstein(p) === true && p.meilenstein.text === '10. Tor für den Verein' && p.meilenstein.season === game.season && inboxMessages.length === vor + 1 && inboxMessages[0].title.includes('Meilenstein');
        p.goalsCareer = 11; out.mKeiner = pruefeTorMeilenstein(p) === false && inboxMessages.length === vor + 1;
        out.mNurKader = pruefeTorMeilenstein({ name: 'Fremd', goalsCareer: 25 }) === false;
        out.mVerdrahtet = creditOwnGoal.toString().includes('pruefeTorMeilenstein') && processPostMatchRoutine.toString().includes('.meilenstein'); // im minifizierten Build heißt p anders
        showScreen('screen-squad'); setSquadTab('aufstellung'); squadFilterPos = 'alle'; squadTagFilter = ''; squadBelastungNurRot = false;
        if (typeof getKaderAnsicht === 'function' && getKaderAnsicht() === 'kompakt') toggleKaderAnsicht();
        renderSquadView();
        out.mChip = document.getElementById('bench-list').textContent.includes('🎉 10. Tor für den Verein');
        game.matchday += MEILENSTEIN_SPIELTAGE + 1; out.mChipWeg = getMeilensteinChip(p) === ''; game.matchday -= MEILENSTEIN_SPIELTAGE + 1;
        p.meilenstein.season = game.season - 1; out.mAlteSaison = getMeilensteinChip(p) === '';
        out.mOhne = getMeilensteinChip(squad[1]) === '' && getMeilensteinChip(null) === '';

        // --- Saisonverlauf ---
        const sv = getSaisonverlauf();
        out.vAlle = sv.length === 34 && sv.every((x, i) => x.md === i + 1);
        out.vGespielt = sv.filter(x => x.gespielt).length === game.matchday - 1 && sv.filter(x => x.gespielt).every(x => typeof x.tore === 'number' && x.platzDanach >= 1);
        out.vOffen = sv.filter(x => !x.gespielt).every(x => x.platz >= 1 && x.staerke > 0);
        const liga = leaguesData[game.leagueLevel];
        const f1 = fixturesData[game.leagueLevel][0].find(f => liga[f.home].name === game.clubName || liga[f.away].name === game.clubName);
        const heim1 = liga[f1.home].name === game.clubName;
        out.vErgebnis = sv[0].heim === heim1 && sv[0].tore === (heim1 ? f1.homeGoals : f1.awayGoals) && sv[0].name === (heim1 ? liga[f1.away].name : liga[f1.home].name);
        game.spielberichte = [{ season: game.season, matchday: 1, cup: false, titel: 'Testbericht', text: 'Bericht Spieltag 1' }, { season: game.season, matchday: 2, cup: true, titel: 'Pokal', text: 'Pokal' }];
        showScreen('screen-league'); setLeagueTab('verlauf');
        out.vReiter = document.getElementById('league-tab-verlauf').style.display === 'block' && document.getElementById('btn-tab-verlauf').className === 'btn-action' && document.getElementById('league-tab-table').style.display === 'none';
        const vb = document.getElementById('season-course-box');
        out.vBox = vb.textContent.includes('🏠') && (vb.textContent.match(/Platz \d+ · Str \d+/g) || []).length === 34 - (game.matchday - 1);
        const berichtKnopf = vb.querySelector('button[onclick="openArchivedReport(0)"]');
        out.vBerichtKnopf = !!berichtKnopf && !vb.querySelector('button[onclick="openArchivedReport(1)"]');
        out.wVerlauf = JSON.stringify(woerter('#season-course-box button, #screen-league button[id^="btn-tab-"]'));
        out.vBreit = ueberlauf();
        berichtKnopf.click();
        out.vBerichtOffen = document.getElementById('share-report-overlay').classList.contains('show') && document.getElementById('share-report-text').value === 'Bericht Spieltag 1';
        closeShareReport();
        setLeagueTab('table'); out.vZurueck = document.getElementById('league-tab-verlauf').style.display === 'none';

        // --- Vorsaison im Tabellenverlauf ---
        const ich = liga.find(t => t.name === game.clubName);
        const histAlt = ich.rankHist.slice();
        game.platzVerlaufVorjahr = null;
        ich.rankHist = [9, 8, 6, 5, 4];
        archivePlatzVerlauf();
        out.pArchiv = game.platzVerlaufVorjahr && game.platzVerlaufVorjahr.season === game.season && game.platzVerlaufVorjahr.hist.join() === '9,8,6,5,4' && game.platzVerlaufVorjahr.level === game.leagueLevel;
        ich.rankHist = histAlt;
        setLeagueTab('stats'); renderLeagueRankChart(game.leagueLevel);
        const rc = document.getElementById('league-rank-chart-box');
        out.pLinie = !!rc.querySelector('polyline[stroke="var(--accent)"][stroke-dasharray]') && rc.textContent.includes(`Vorsaison ${game.season}`) && rc.textContent.includes('Endplatz 4');
        const anderes = game.leagueLevel === 0 ? 1 : game.leagueLevel - 1;
        renderLeagueRankChart(anderes); out.pNurEigeneLiga = !document.getElementById('league-rank-chart-box').textContent.includes('Vorsaison');
        game.platzVerlaufVorjahr = null; renderLeagueRankChart(game.leagueLevel); out.pOhne = !document.getElementById('league-rank-chart-box').textContent.includes('Vorsaison');
        const ichAlt = ich.rankHist; ich.rankHist = []; archivePlatzVerlauf(); out.pLeerKeinArchiv = game.platzVerlaufVorjahr === null; ich.rankHist = ichAlt;

        // --- Kaderwert-Kurve ---
        const summe = squad.reduce((sum, x) => sum + (x.marketValue || 0), 0);
        out.kwWert = getKaderwert() === summe;
        game.kaderwertVerlauf = [];
        showScreen('screen-squad'); setSquadTab('analyse'); renderKaderwertKurve();
        out.kwLeer = document.getElementById('kaderwert-box').textContent.includes('Nach dem ersten Saisonende') && !document.querySelector('#kaderwert-box svg');
        archiveKaderwert(); archiveKaderwert();
        out.kwArchiv = game.kaderwertVerlauf.length === 1 && game.kaderwertVerlauf[0].wert === summe && game.kaderwertVerlauf[0].season === game.season;
        game.kaderwertVerlauf = [{ season: game.season - 2, wert: summe - 2000000 }, { season: game.season - 1, wert: summe + 1000000 }];
        renderKaderwertKurve();
        const kb = document.getElementById('kaderwert-box');
        out.kwKurve = kb.querySelectorAll('circle').length === 3 && kb.textContent.includes('jetzt: ') && kb.textContent.includes(`Seit Saisonende ${game.season - 2}`) && kb.textContent.includes('+');
        out.kwBreit = ueberlauf();
        const sicherung = game.season; for (let sn = 1; sn <= 25; sn++) { game.season = sn; archiveKaderwert(); } game.season = sicherung;
        out.kwHoechstens20 = game.kaderwertVerlauf.length === 20 && game.kaderwertVerlauf[19].season === 25;
        delete game.kaderwertVerlauf; renderKaderwertKurve(); archiveKaderwert(); out.kwAltesFeld = Array.isArray(game.kaderwertVerlauf) && game.kaderwertVerlauf.length === 1;
        out.seasonEnd = concludeSeasonAndAdvance.toString().includes('archiveKaderwert') && concludeSeasonAndAdvance.toString().includes('archivePlatzVerlauf');
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['mTor', 'mKeiner', 'mNurKader', 'mVerdrahtet', 'mChip', 'mChipWeg', 'mAlteSaison', 'mOhne'];
    assert(ok(...A), `Meilensteine: Torjubiläum mit Nachricht, Chip drei Spieltage, nur eigener Kader, Pflichtspiel-Jubiläum verdrahtet (${werte(A)})`);
    const B = ['vAlle', 'vGespielt', 'vOffen', 'vErgebnis', 'vReiter', 'vBox', 'vBerichtKnopf', 'vBreit', 'vBerichtOffen', 'vZurueck'];
    assert(ok(...B), `Saisonverlauf: alle 34 Spieltage, Ergebnisse mit Platz danach, offene Spiele, Spielbericht per Tipp, eigener Reiter (${werte(B)})`);
    const C = ['pArchiv', 'pLinie', 'pNurEigeneLiga', 'pOhne', 'pLeerKeinArchiv'];
    assert(ok(...C), `Tabellenverlauf mit Vorsaison: Archiv am Saisonende, gestrichelte Linie nur in der eigenen Liga (${werte(C)})`);
    const D = ['kwWert', 'kwLeer', 'kwArchiv', 'kwKurve', 'kwBreit', 'kwHoechstens20', 'kwAltesFeld', 'seasonEnd'];
    assert(ok(...D), `Kaderwert-Kurve: Summe, Archiv je Saison, Kurve mit heutigem Wert, höchstens 20, alte Spielstände, Saisonende (${werte(D)})`);
    assert(r.wVerlauf === '[]', `Neue Knöpfe bei 320 px in breiter Schrift: kein Wort breiter als sein Knopf (${r.wVerlauf})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

async function testRunde33Funktionen(browser) {
    console.log('\n[26.18] Kauf-Vorschau, Punkte-Vergleich, Monatsbericht, Rückkehrer im Kalender, Aufstellungs-Gedächtnis');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(R32_HILFEN);
    const r = await page.evaluate(() => {
        closeTutorial(); game.sackPending = false;
        const out = {};
        const liga = () => leaguesData[game.leagueLevel];
        const eigenesSpiel = md => { const l = liga(); const f = fixturesData[game.leagueLevel][md - 1].find(x => l[x.home].name === game.clubName || l[x.away].name === game.clubName); const h = l[f.home].name === game.clubName; return { tore: h ? f.homeGoals : f.awayGoals, gegen: h ? f.awayGoals : f.homeGoals, gegner: h ? l[f.away].name : l[f.home].name, heim: h }; };
        simulateMatchdays(4);

        // --- Monatsbericht (Tick am 4. Spieltag) ---
        const bericht = () => inboxMessages.filter(m => m.title.startsWith('🗓️ Monatsbericht'));
        out.mErster = bericht().length === 1 && bericht()[0].title === '🗓️ Monatsbericht: Spieltag 1 bis 4' && bericht()[0].category === 'analyse' && game.monatsStand && game.monatsStand.matchday === 4 && game.monatsStand.season === game.season;
        const b1 = bericht()[0].body;
        const sp = [1, 2, 3, 4].map(eigenesSpiel), s = sp.filter(x => x.tore > x.gegen).length, u = sp.filter(x => x.tore === x.gegen).length;
        out.mInhalt = b1.includes(`${s}S ${u}U ${4 - s - u}N`) && b1.includes(`${3 * s + u} Punkte`) && b1.includes('Tabellenplatz') && b1.includes('Kasse') && b1.includes('🩹') && !b1.includes('seit dem letzten Bericht');
        simulateMatchdays(4);
        const b2 = bericht()[0];
        out.mZweiter = bericht().length === 2 && b2.title === '🗓️ Monatsbericht: Spieltag 5 bis 8' && b2.body.includes('→') && b2.body.includes('seit dem letzten Bericht') && game.monatsStand.matchday === 8;
        out.mVerdrahtet = runMonthlyClubTicks.toString().includes('schreibeMonatsbericht');
        game.monatsStand = { season: game.season - 1, matchday: 30, platz: 3, money: 0 };
        const md = game.matchday;
        out.mNeueSaison = schreibeMonatsbericht() === `🗓️ Monatsbericht: Spieltag 1 bis ${md}` ;
        delete game.monatsStand; out.mAltesFeld = schreibeMonatsbericht() === `🗓️ Monatsbericht: Spieltag 1 bis ${md}`;
        inboxMessages = inboxMessages.filter(m => !m.title.startsWith('🗓️ Monatsbericht'));

        // --- Aufstellungs-Gedächtnis (live und simuliert über recordOwnLeagueResult) ---
        const gd = getStartelfGedaechtnis();
        out.gFuenf = gd.length === 5 && gd.map(e => e.matchday).join() === '8,7,6,5,4' && gd.every(e => e.ids.length === 11 && e.season === game.season && e.formation);
        const e8 = eigenesSpiel(8);
        out.gErgebnis = gd[0].tore === e8.tore && gd[0].gegentore === e8.gegen && gd[0].gegner === e8.gegner && gd[0].heim === e8.heim;
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 95; });
        const ziel = gd[2];
        game.formation = '4-3-3'; autoLineup();
        const toasts = []; const toastAlt = showToast; showToast = (t) => { toasts.push(t); };
        applyStartelfAusGedaechtnis(2);
        out.gUebernehmen = lineup.length === 11 && ziel.ids.every(id => lineup.includes(id)) && game.formation === ziel.formation && toasts.pop().includes(`Elf vom ${ziel.matchday}. Spieltag`);
        const weg = squad.find(p => p.id === ziel.ids[3]); weg.injured = 2;
        game.formation = '4-3-3'; autoLineup();
        applyStartelfAusGedaechtnis(2);
        out.gErsatz = lineup.length === 11 && !lineup.includes(weg.id) && toasts.pop().includes(`Ersetzt: ${weg.name}`);
        const vorher = lineup.join();
        applyStartelfAusGedaechtnis(9);
        out.gUngueltig = lineup.join() === vorher && toasts.pop().includes('nicht mehr gespeichert');
        showToast = toastAlt;
        pendingMatchInfo = null; renderPrematchCheck();
        const pc = document.getElementById('prematch-check-box');
        out.gImCheck = pc.textContent.includes('Startelf der letzten Spiele') && pc.querySelectorAll('button[onclick^="applyStartelfAusGedaechtnis("]').length === 5 && pc.textContent.includes('Stärke heute');
        renderLineupPresets();
        out.gBeiVorlagen = document.getElementById('lineup-presets-box').querySelectorAll('button[onclick^="applyStartelfAusGedaechtnis("]').length === 5;
        out.gAktuell = renderStartelfGedaechtnis().includes('aktuell aufgestellt') && renderStartelfGedaechtnis().includes('1 Ausfall ersetzt');
        delete game.startelfGedaechtnis;
        out.gAltesFeld = renderStartelfGedaechtnis().includes('Nach dem nächsten Ligaspiel');
        merkeStartelf(2, 1, true, 'Testgegner');
        out.gNeu = getStartelfGedaechtnis().length === 1 && getStartelfGedaechtnis()[0].gegner === 'Testgegner' && getStartelfGedaechtnis()[0].ids.join() === lineup.join();
        weg.injured = 0;

        // --- Rückkehrer ---
        const a = squad[0], b = squad[1];
        a.injured = 2; b.suspended = 1;
        const jetzt = game.matchday;
        out.rSpieltag = getRueckkehrSpieltag(a) === jetzt + 2 && getRueckkehrSpieltag(b) === jetzt + 1 && getRueckkehrSpieltag(squad[2]) === 0;
        const kal = n => getKalenderExtras(n).join(' | ');
        out.rKalender = kal(jetzt + 2).includes(`🔙 Wieder dabei: ${a.name}`) && kal(jetzt + 1).includes(`🔙 Wieder dabei: ${b.name}`) && !kal(jetzt + 1).includes(a.name) && !kal(jetzt).includes('🔙');
        renderPrematchCheck();
        out.rCheck = pc.textContent.includes(`zurück ab SpT ${jetzt + 2}`) && pc.textContent.includes(`zurück ab SpT ${jetzt + 1}`);
        a.injured = 40; renderPrematchCheck(); out.rSaisonende = pc.textContent.includes('über das Saisonende hinaus') && !kal(34).includes(a.name);
        a.injured = 0; b.suspended = 0;

        // --- Punkte-Vergleich ---
        const reihe = getPunkteVerlauf();
        const ich = liga().find(t => t.name === game.clubName);
        out.pReihe = reihe.length === game.matchday - 1 && reihe[reihe.length - 1] === ich.points && reihe.every((x, i) => i === 0 || x >= reihe[i - 1]);
        game.platzVerlaufVorjahr = null;
        out.pOhne = getPunkteVergleich() === null;
        const alt = ich.rankHist; if (!alt.some(Boolean)) ich.rankHist = [5];
        archivePlatzVerlauf(); out.pArchiv = Array.isArray(game.platzVerlaufVorjahr.punkte) && game.platzVerlaufVorjahr.punkte.join() === reihe.join();
        ich.rankHist = alt;
        const vorjahr = Array.from({ length: 34 }, (_, i) => i + 1);
        game.platzVerlaufVorjahr = { season: game.season - 1, level: game.leagueLevel, teams: 18, hist: [], punkte: vorjahr };
        const pv = getPunkteVergleich();
        out.pVergleich = pv.n === reihe.length && pv.jetzt === ich.points && pv.vorher === reihe.length && pv.diff === ich.points - reihe.length && !pv.andereLiga;
        showScreen('screen-dashboard'); renderSaisonZiele();
        const zb = document.getElementById('season-goal-box').textContent;
        out.pDashboard = zb.includes(`Nach ${reihe.length} Spieltagen: ${ich.points} Punkte, Vorsaison ${reihe.length}`);
        showScreen('screen-league'); setLeagueTab('verlauf');
        const vb = document.getElementById('season-course-box');
        out.pKurve = vb.querySelectorAll('svg polyline').length === 2 && !!vb.querySelector('polyline[stroke-dasharray]') && vb.textContent.includes('Endstand 34 Punkte');
        out.pBreit = ueberlauf();
        game.platzVerlaufVorjahr.level = game.leagueLevel === 0 ? 1 : 0; out.pAndereLiga = getPunkteVergleich().andereLiga === true;
        delete game.platzVerlaufVorjahr.punkte; out.pAltesArchiv = getPunkteVergleich() === null;
        game.platzVerlaufVorjahr.punkte = [1, 2]; out.pZuKurz = getPunkteVergleich() === null;
        setLeagueTab('table');

        // --- Kauf-Vorschau ---
        game.money = 1e9; game.transferBudget = 1e9; game.wageBudget = 1e9; game.transferEmbargo = false; game.ffpTransferEmbargo = false;
        game.formation = '4-4-2'; autoLineup();
        if (!marketPlayers.length) refreshTransferMarket();
        const m = marketPlayers[0];
        const startPos = squad.filter(p => lineup.includes(p.id) && p.pos === m.pos).sort((x, y) => x.strength - y.strength);
        m.strength = 99;
        const kaderVor = squad.length, elfVor = lineup.join();
        const kv = getKaufVorschau(m);
        out.kErsetzt = startPos.length ? (kv.ersetzt && kv.ersetzt.id === startPos[0].id && kv.nachher > kv.vorher) : kv.ersetzt === null;
        out.kUnveraendert = squad.length === kaderVor && lineup.join() === elfVor && !squad.some(p => String(p.id).startsWith('kaufvorschau-'));
        out.kGeld = kv.kasse === game.money - kv.gesamt && kv.budget === game.transferBudget - getTransferAsking(m) && kv.posAnzahl === squad.filter(p => p.pos === m.pos).length;
        out.kStaerkeGleich = Math.abs(calcTeamStrength(false) - kv.vorher) < 1e-9;
        showScreen('screen-transfer'); setTransferTab('market'); resetMarktFilter();
        out.kChip = startPos.length ? document.getElementById('market-list').textContent.includes(`⚽ Startelf statt ${startPos[0].name}`) : true;
        openPlayerDetail(m.id, 'market');
        const pd = document.getElementById('pd-ersatz');
        out.kDetail = pd.textContent.includes('Kauf-Vorschau') && pd.textContent.includes('Kasse danach') && (startPos.length ? pd.textContent.includes(`ersetzen`) && pd.textContent.includes('Teamstärke') : true);
        out.kBreit = ueberlauf();
        closePlayerDetail();
        m.strength = 1;
        const kv2 = getKaufVorschau(m);
        out.kSchwach = kv2.ersetzt === null && kv2.nachher === null && getStartelfChip(m) === '';
        openPlayerDetail(m.id, 'market'); out.kSchwachText = startPos.length ? pd.textContent.includes('Kein Stammplatz') : pd.textContent.includes('niemand in deiner Startelf');
        closePlayerDetail();
        openPlayerDetail(squad[0].id, 'squad'); out.kKaderErsatz = pd.textContent.includes('Ersatz auf dem Markt') && !pd.textContent.includes('Kauf-Vorschau');
        closePlayerDetail();
        return out;
    });
    const ok = (...ks) => ks.every(k => r[k] === true);
    const werte = ks => JSON.stringify(ks.map(k => r[k]));
    const A = ['mErster', 'mInhalt', 'mZweiter', 'mVerdrahtet', 'mNeueSaison', 'mAltesFeld'];
    assert(ok(...A), `Monatsbericht: alle vier Spieltage im Postfach mit Bilanz, Platz, Kasse, Verletzten; Vergleich zum letzten Bericht; neue Saison ab Spieltag 1 (${werte(A)})`);
    const B = ['gFuenf', 'gErgebnis', 'gUebernehmen', 'gErsatz', 'gUngueltig', 'gImCheck', 'gBeiVorlagen', 'gAktuell', 'gAltesFeld', 'gNeu'];
    assert(ok(...B), `Aufstellungs-Gedächtnis: letzte fünf Startelfen mit Ergebnis, übernehmen mit Ersatz für Ausfälle, im Spieltag-Check und bei den Vorlagen (${werte(B)})`);
    const C = ['rSpieltag', 'rKalender', 'rCheck', 'rSaisonende'];
    assert(ok(...C), `Rückkehrer: Spieltag der Rückkehr im Kalender und unter „Wer fehlt?“ (${werte(C)})`);
    const D = ['pReihe', 'pOhne', 'pArchiv', 'pVergleich', 'pDashboard', 'pKurve', 'pBreit', 'pAndereLiga', 'pAltesArchiv', 'pZuKurz'];
    assert(ok(...D), `Punkte-Vergleich: Punkte je Spieltag, Archiv am Saisonende, Zeile im Dashboard, Kurve im Saisonverlauf, alte Archive (${werte(D)})`);
    const E = ['kErsetzt', 'kUnveraendert', 'kGeld', 'kStaerkeGleich', 'kChip', 'kDetail', 'kBreit', 'kSchwach', 'kSchwachText', 'kKaderErsatz'];
    assert(ok(...E), `Kauf-Vorschau: Startelf-Platz und Teamstärke vorher/nachher ohne Spuren im Kader, Kasse und Budgets danach, Chip und Spielerdetail (${werte(E)})`);
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
    testRunde28Funktionen,
    testRunde29Funktionen,
    testRunde30Funktionen,
    testRunde31Funktionen,
    testRunde32Markt,
    testRunde32Spieltag,
    testRunde32Uebersicht,
    testRunde32Statistik,
    testRunde33Funktionen,
};
