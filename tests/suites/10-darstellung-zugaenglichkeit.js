// Testsuiten: darstellung zugaenglichkeit
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

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

// Phase 25.52: Farben nur über Tokens. Ausnahmen: Illustrationen (Büro, Stadion, Spielfeld,
// Avatare, Wappen), Canvas-Grafiken (Karrierekarte) und die Token-/Theme-Blöcke selbst.
function findeFesteFarben() {
    const fs = require('fs');
    const root = path.join(TESTS_DIR, '..');
    const literal = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
    const ausnahmeDateien = ['avatars.js', 'office.js', 'office-events.js', 'crest.js', 'stadium.js', 'career.js', 'design-settings.js', 'live-3d.js', 'ausschreitungen-szene.js', 'stadion-canvas.js'];
    const ausnahmeZeile = /ctx\.|fillStyle|strokeStyle|addColorStop|crest|theme-color|^\s*(\/\/|\*|\/\*)/i;
    const funde = [];
    const pruefe = (datei, text) => text.split('\n').forEach((zeile, i) => {
        if (ausnahmeZeile.test(zeile)) return;
        const ohneEntities = zeile.replace(/&#\d+;|&#x[0-9a-f]+;/gi, '');
        const m = ohneEntities.match(literal);
        if (m) funde.push(`${datei}:${i + 1} ${m[0]}`);
    });
    fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js') && !ausnahmeDateien.includes(f))
        .forEach(f => pruefe('js/' + f, fs.readFileSync(path.join(root, 'js', f), 'utf-8')));
    pruefe('index.html', fs.readFileSync(path.join(root, 'index.html'), 'utf-8'));
    // CSS: nur Regeln außerhalb der Token-/Theme-Blöcke und Illustrationen
    const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf-8');
    const illu = /^\s*(:root|html\[data-|\.office|\.off-|#office|\.stadium-(?!hero-metric|condition)|#stadium|\.stand\b|\.stand-|\.live-stadium|\.soccer-pitch|\.pitch|\.player-pin|\.dashboard-hero|\.club-logo|\.crossing-zone|\.goal-|\.formation-preview|#live-ball|\.design-swatches|body::|\.office-bg)/;
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim().split('\n').pop().replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (illu.test(sel)) continue;
        const f = m[2].replace(/\/\*[\s\S]*?\*\//g, '').match(literal);
        if (f) funde.push(`css ${sel.slice(0, 50)} ${f[0]}`);
    }
    return funde;
}

async function testOneHandControls(browser) {
    console.log('\n[20.8] Bedienung mit einer Hand: Weiter-Knopf, Zurück-Taste, Fenster unten, Livespiel-Leiste');
    const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));
    await page.addInitScript(() => { try { localStorage.removeItem('anstoss_fm13_last_save'); localStorage.removeItem('anstoss_fm13_ui_fab'); } catch (e) { /* egal */ } });
    await page.goto(GAME_PATH);
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
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
            const fabEl = document.getElementById('one-hand-fab');
            const fabSichtbar = fabEl && getComputedStyle(fabEl).display !== 'none' && fabEl.getBoundingClientRect().height > 0;
            // Seit 3.157 läuft das Spiel im eigenen Fenster, das die untere Leiste verdeckt: dort zählt die Fensterkante
            const fensterOffen = document.getElementById('live-fenster').style.display === 'flex';
            const navTop = fensterOffen ? window.innerHeight : Math.min(document.querySelector('.bottom-nav-bar').getBoundingClientRect().top, fabSichtbar ? fabEl.getBoundingClientRect().top : 99999);
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
    // Auf das Schließen warten statt fester Zeit (unter Parallellast kam das Fenster später)
    await page.waitForFunction(() => !document.getElementById('player-detail-overlay').classList.contains('show'), null, { timeout: 3000 }).catch(() => null);
    const nachBack = await page.evaluate(() => ({ zu: !document.getElementById('player-detail-overlay').classList.contains('show'), da: typeof game === 'object' }));
    assert(nachBack.zu && nachBack.da, 'Browser-Zurück schließt das Fenster und bleibt im Spiel');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testEnglishUi(browser) {
    console.log('\n[25.20] Englische Oberfläche: feste Texte, neu gerenderte Inhalte, zurück auf Deutsch');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const kopf = [...document.querySelectorAll('.panel-header')].find(el => el.textContent.trim() === '💼 Budgets & Vorstands-Verhandlungen');
            out.vorhanden = !!kopf;
            setLanguage('en');
            out.englisch = !!kopf && kopf.textContent.trim() === I18N_UI_EN['💼 Budgets & Vorstands-Verhandlungen'];
            out.anzahl = Object.keys(I18N_UI_EN).length;
            setLanguage('de');
            out.deutsch = !!kopf && kopf.textContent.trim() === '💼 Budgets & Vorstands-Verhandlungen';
            setLanguage('en');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Sprachwechsel ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.vorhanden && r.englisch && r.anzahl >= 500, `Feste Panel-Texte werden englisch (${r.anzahl} Einträge)`);
        assert(r.deutsch, 'Zurück auf Deutsch stellt die Originaltexte wieder her');
    }
    // Neu gerenderte Inhalte (MutationObserver) werden übersetzt
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'i18n-probe'; d.textContent = 'Abbrechen'; document.body.appendChild(d); });
    // Der MutationObserver übersetzt asynchron: auf die Übersetzung warten statt 50 ms zu hoffen
    await page.waitForFunction(() => { const e = document.getElementById('i18n-probe'); return !!e && e.textContent !== 'Abbrechen'; }, null, { timeout: 2000 }).catch(() => null);
    const probe = await page.evaluate(() => document.getElementById('i18n-probe').textContent);
    assert(probe === 'Cancel', `Neu eingefügte Texte werden übersetzt (${probe})`);
    // Durch das Spiel geänderte Texte bleiben nicht auf dem alten Original stehen
    await page.evaluate(() => { const d = document.getElementById('i18n-probe'); d.firstChild.nodeValue = 'Speichern'; });
    await page.waitForFunction(() => document.getElementById('i18n-probe').textContent === 'Save', null, { timeout: 3000 }).catch(() => null);
    const probe2 = await page.evaluate(() => { const v = document.getElementById('i18n-probe').textContent; setLanguage('de'); return v + '|' + document.getElementById('i18n-probe').textContent; });
    assert(probe2 === 'Save|Speichern', `Später geänderte Texte werden neu übersetzt und korrekt zurückgestellt (${probe2})`);
    // Alle Bildschirme auf Englisch öffnen ohne Fehler
    await page.evaluate(() => { setLanguage('en'); ['screen-dashboard', 'screen-finances', 'screen-squad', 'screen-transfer', 'screen-training', 'screen-stadium'].forEach(s => { try { showScreen(s); } catch (e) { /* fehlende Screens zählen nicht */ } }); setLanguage('de'); });
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testLexiconEnglish(browser) {
    console.log('\n[25.22] Lexikon auf Englisch: jeder Eintrag übersetzt, Zahlen wie im Original');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = { fehlend: [], zahlen: [] };
            const ziffern = t => (t.match(/\d+/g) || []);
            LEXICON_ENTRIES.forEach(e => {
                const en = LEXICON_EN[e.title];
                if (!en || !en.title || !en.text || !Array.isArray(en.tips) || en.tips.length !== e.tips.length) { out.fehlend.push(e.title); return; }
                const enZ = ziffern(en.text + ' ' + en.tips.join(' '));
                const fehlt = ziffern(e.text + ' ' + e.tips.join(' ')).filter(z => !enZ.includes(z));
                if (fehlt.length) out.zahlen.push(e.title + ': ' + fehlt.join(','));
            });
            showScreen('screen-lexicon');
            setLanguage('en');
            const html = document.getElementById('lexicon-list').innerHTML;
            out.englisch = html.includes('Strength') && html.includes('Base value of every player') && !html.includes('Grundwert jedes Spielers');
            out.kategorie = document.getElementById('lexicon-categories').textContent.includes('Players');
            const suche = document.getElementById('lexicon-search');
            if (suche) {
                suche.value = 'pressing'; renderLexicon(); out.suche = document.getElementById('lexicon-list').innerHTML.includes('Tactical duel');
                // Zusammengesetzte Begriffe: Bindestrich und Leerzeichen zählen nicht
                suche.value = 'set-piece'; renderLexicon(); out.suchePunkt = document.getElementById('lexicon-list').innerHTML.includes('Set pieces');
                suche.value = 'setpieces'; renderLexicon(); out.sucheOhne = document.getElementById('lexicon-list').innerHTML.includes('Set pieces');
                suche.value = 'Base value'; renderLexicon(); out.sucheLeerzeichen = document.getElementById('lexicon-list').innerHTML.includes('Strength');
                suche.value = 'focus'; renderLexicon(); out.sucheFokus = document.getElementById('lexicon-list').innerHTML.includes('Keyboard and focus');
                suche.value = ''; renderLexicon();
            } else out.suche = out.suchePunkt = out.sucheOhne = true;
            setLanguage('de');
            out.deutsch = document.getElementById('lexicon-list').innerHTML.includes('Grundwert jedes Spielers');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Lexikon englisch ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.fehlend.length === 0, `Jeder Lexikon-Eintrag hat eine englische Fassung mit gleich vielen Tipps (${r.fehlend.join(' | ')})`);
        assert(r.zahlen.length === 0, `Die englische Fassung enthält alle Zahlen des deutschen Textes (${r.zahlen.slice(0, 3).join(' | ')})`);
        assert(r.englisch && r.kategorie && r.suche, 'Auf Englisch zeigt das Lexikon englische Titel, Texte und Kategorien, die Suche findet englische Begriffe');
        assert(r.sucheFokus, 'Der englische Lexikon-Eintrag zur Tastatur findet sich über "focus"');
        assert(r.sucheLeerzeichen, 'Die englische Suche findet mit Leerzeichen ("Base value" → Strength)');
        assert(r.suchePunkt && r.sucheOhne, 'Die Suche ignoriert Bindestriche und Leerzeichen ("set-piece" findet "Set pieces")');
        assert(r.deutsch, 'Zurück auf Deutsch zeigt das Lexikon wieder deutsch');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testDesignThemes(browser) {
    console.log('\n[25.51] Darstellung: Farb-Themes mit WCAG-Kontrast, Textgröße, Speicherung und Karten');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 412, height: 900 });
    const r = await page.evaluate(async () => {
        closeTutorial();
        game.sackPending = false; simulateMatchdays(3);
        const out = { kontrast: [], ueberlauf: [] };
        const probe = document.createElement('div');
        document.querySelector('.app-content').appendChild(probe);
        const farbe = (prop, wert) => { probe.style[prop] = wert; const c = getComputedStyle(probe)[prop].match(/[\d.]+/g).map(Number); probe.style[prop] = ''; return c; };
        const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const mische = (oben, unten) => { const a = oben.length > 3 ? oben[3] : 1; return [0, 1, 2].map(i => oben[i] * a + unten[i] * (1 - a)); };
        const verhaeltnis = (a, b) => { const [h, d] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (d + 0.05); };
        for (const t of DESIGN_THEMES) {
            setzeDesignTheme(t.id);
            const app = farbe('backgroundColor', 'var(--surface-app)');
            const panel = mische(farbe('backgroundColor', 'var(--surface-panel)'), app);
            for (const tok of ['--text-main', '--text-muted', '--accent', '--primary', '--danger']) {
                const v = verhaeltnis(farbe('color', `var(${tok})`), panel);
                if (v < 4.5) out.kontrast.push(`${t.id} ${tok} ${v.toFixed(2)}`);
            }
        }
        out.kontrastMin = out.kontrast.length;
        // Speichern pro Gerät und ungültige Werte
        setzeDesignTheme('kontrast');
        setzeDesignTheme('gibtsnicht');
        out.ungueltigIgnoriert = document.documentElement.getAttribute('data-theme') === 'kontrast';
        const normal = parseFloat(getComputedStyle(document.body).fontSize);
        setzeTextGroesse('sehr-gross');
        out.groesser = parseFloat(getComputedStyle(document.body).fontSize) / normal;
        // Handy: bei sehr großer Schrift läuft nichts über
        const W = document.documentElement.clientWidth;
        const alle = [...document.querySelectorAll('[id^="screen-"]')].map(e => e.id).filter(id => !id.includes('prematch') && id !== 'screen-matchday' && id !== 'screen-office');
        for (const name of alle) {
            showScreen(name);
            await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 40))));
            if (document.documentElement.scrollWidth > W + 2) out.ueberlauf.push(name);
        }
        // Bildschirm "Darstellung": alle Themes und Größen als Knöpfe, Vorschau mit echtem Spieler
        showScreen('screen-design');
        out.karten = document.querySelectorAll('#design-settings-box .design-theme-card').length;
        out.groessen = document.querySelectorAll('#design-settings-box .design-size-btn').length;
        out.vorschau = document.querySelector('#design-settings-box .ui-card-title')?.textContent === [...squad].sort((a, b) => b.strength - a.strength)[0].name;
        out.navKnopf = !!document.querySelector(`.nav-btn[onclick="showScreen('screen-design')"]`);
        // Transfermarkt-Karte nach dem Kartenmuster: Titel, Kennzahl Stärke, Chips
        showScreen('screen-transfer'); setTransferTab('market');
        const karte = document.querySelector('#market-list .ui-card-head');
        out.marktKarte = !!karte && karte.querySelector('.ui-card-title').textContent === marketPlayers[0].name
            && karte.querySelector('.ui-card-kpi-wert').textContent.trim() === String(marketPlayers[0].strength)
            && karte.querySelectorAll('.ui-chip').length >= 2;
        probe.remove();
        return out;
    });
    // Zufällige Spieltag-Ereignisse (z. B. Derby-Ausschreitungen) öffnen eine Meldung, die den Klick abfangen würde
    await page.evaluate(() => { const box = document.getElementById('app-notice'); let n = 0; while (box && box.style.display === 'flex' && n++ < 20) dismissNotice(); showScreen('screen-design'); });
    await page.click("#design-settings-box .design-theme-card[onclick=\"setzeDesignTheme('klassik')\"]");
    const geklickt = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    // Neustart: Selten (nur unter Last, nur im minifizierten Lauf) liefert Chromium nach dem Neuladen einen leeren
    // Speicher, obwohl der Wert eben noch gelesen wurde und nichts im Spiel ihn löscht. Deshalb wird der Neustart
    // einmal wiederholt (Wert vorher erneut setzen); schlägt es danach wieder fehl, ist es ein echter Fehler.
    let vorNeustart = null, nachStart = null;
    for (let versuch = 1; versuch <= 2; versuch++) {
        vorNeustart = await page.evaluate(() => { try { return { theme: localStorage.getItem(DESIGN_THEME_KEY), groesse: localStorage.getItem(DESIGN_TEXT_KEY) }; } catch (e) { return { fehler: String(e) }; } });
        await page.reload();
        await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
        await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'klassik', null, { timeout: 5000 }).catch(() => null);
        nachStart = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), groesse: document.documentElement.getAttribute('data-text-size'),
            gespeichert: safeLocalGet(DESIGN_THEME_KEY) }));
        nachStart.versuch = versuch;
        if (nachStart.theme === 'klassik' && nachStart.groesse === 'sehr-gross') break;
        await page.evaluate(() => { setzeDesignTheme('klassik'); setzeTextGroesse('sehr-gross'); });
    }
    assert(r.kontrast.length === 0, `Alle Themes: Text, Nebentext, Akzent, Gut und Schlecht erreichen 4,5:1 auf Karten (${r.kontrast.join(', ')})`);
    assert(r.ungueltigIgnoriert, 'Ein unbekanntes Theme ändert nichts');
    assert(r.groesser > 1.2, `Textgröße "sehr groß" vergrößert die Schrift (Faktor ${r.groesser.toFixed(2)})`);
    assert(r.ueberlauf.length === 0, `Sehr große Schrift läuft auf dem Handy auf keinem Bildschirm über (${r.ueberlauf.join(', ')})`);
    assert(r.karten === 7 && r.groessen === 8, `Darstellung zeigt 7 Themes (inkl. Automatisch) sowie 3 Textgrößen, 3 Bewegungs-Stufen und An/Aus für das Wischen (${r.karten}/${r.groessen})`);
    assert(r.vorschau, 'Die Vorschau zeigt den stärksten eigenen Spieler');
    assert(r.navKnopf, 'Menüpunkt "Darstellung" ist vorhanden');
    assert(r.marktKarte, 'Transfermarkt-Karte: Name als Titel, Stärke als Kennzahl, Chips mit Zusatzangaben');
    assert(geklickt === 'klassik', `Antippen einer Theme-Karte wechselt das Farbschema (${geklickt})`);
    assert(nachStart.theme === 'klassik' && nachStart.groesse === 'sehr-gross', `Theme und Textgröße bleiben nach dem Neustart erhalten (vorher ${JSON.stringify(vorNeustart)}, nachher ${JSON.stringify(nachStart)})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in der Darstellung (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testKeineFestenFarben() {
    console.log('\n[25.52] Farben nur über Tokens (kein fester Farbwert in JS, HTML und UI-Regeln)');
    const funde = findeFesteFarben();
    assert(funde.length === 0, `Kein fester Farbwert außerhalb der Tokens und Illustrationen (${funde.length}: ${funde.slice(0, 8).join(' | ')})`);
}

async function testKontrastAlleThemes(browser) {
    console.log('\n[25.52] Kontrast: jeder sichtbare Text in jedem Theme mindestens 4,5:1 (große Schrift 3:1)');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 900 });
    const themes = await page.evaluate(() => DESIGN_THEMES.map(t => t.id).filter(id => id !== 'auto'));
    await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(4);
        const st = document.createElement('style');
        st.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
        document.head.appendChild(st);
    });
    const fehler = {};
    for (const theme of themes) {
        fehler[theme] = await page.evaluate(async (theme) => {
            setzeDesignTheme(theme);
            document.querySelectorAll('.app-toast').forEach(t => t.remove());
            const parse = c => {
                const m = c && c.match(/[\d.]+/g); if (!m) return null; const n = m.map(Number);
                if (/^color\(/.test(c)) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1];
                return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
            };
            const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
            const ueber = (o, u) => [0, 1, 2].map(i => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
            const verh = (a, b) => { const [h, d] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (d + 0.05); };
            const probe = document.createElement('div'); document.body.appendChild(probe);
            const aufloesen = c => { probe.style.color = ''; probe.style.color = c; return parse(getComputedStyle(probe).color); };
            // Hintergrund eines Elements = eigene Schichten über dem Hintergrund des Elternelements (bis zur ersten
            // deckenden Schicht). Je Element zwischengespeichert: die Elternkette wird so nur einmal berechnet.
            const basis = aufloesen('var(--surface-app)') || [0, 0, 0, 1];
            const bgCache = new Map();
            const hintergrund = el => {
                if (bgCache.has(el)) return bgCache.get(el);
                let res;
                if (!el || el === document.documentElement) res = basis;
                else {
                    const cs = getComputedStyle(el);
                    const eigene = [];
                    let deckend = false;
                    if (/gradient/.test(cs.backgroundImage)) {
                        const f = cs.backgroundImage.match(/(rgba?|color)\([^()]*(\([^()]*\)[^()]*)*\)|#[0-9a-f]{3,6}/gi) || [];
                        const c = f.length ? aufloesen(f[0]) : null;
                        if (c) { eigene.push(c); if (c[3] > 0.95) deckend = true; }
                    }
                    if (!deckend) {
                        const c = parse(cs.backgroundColor);
                        if (c && c[3] > 0) { eigene.push(c); if (c[3] > 0.95) deckend = true; }
                    }
                    res = eigene.reverse().reduce((u, o) => ueber(o, u), deckend ? basis : hintergrund(el.parentElement));
                }
                bgCache.set(el, res);
                return res;
            };
            const ids = [...document.querySelectorAll('[id^="screen-"]')].map(e => e.id).filter(id => !id.includes('prematch') && id !== 'screen-matchday' && id !== 'screen-office');
            const out = new Set();
            const scan = (id, auswahl) => {
                bgCache.clear(); // Klassen und Hintergründe ändern sich beim Wechsel des Bildschirms
                document.querySelectorAll(auswahl).forEach(el => {
                    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
                    if (![...el.childNodes].some(n => n.nodeType === 3 && /[A-Za-z0-9ÄÖÜäöü€]/.test(n.textContent))) return;
                    if (el.closest('button[disabled], .office-viewport, svg, .club-logo')) return;
                    const cs = getComputedStyle(el);
                    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) return;
                    const fg = parse(cs.color); if (!fg) return;
                    const bg = hintergrund(el);
                    const v = verh(ueber(fg, bg), bg);
                    const gross = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && parseInt(cs.fontWeight) >= 700);
                    if (v < (gross ? 3 : 4.5)) out.add(`${id} "${el.textContent.trim().slice(0, 24)}" ${v.toFixed(2)}`);
                });
            };
            for (const id of ids) {
                showScreen(id);
                await new Promise(res => setTimeout(res, 10));
                scan(id, '.app-content *, .app-header *, .bottom-nav-bar *');
            }
            // Phase 26: Spieltag-Check und die neuen Fenster (liegen außerhalb von .app-content)
            showScreen('screen-prematch-press'); renderPrematchCheck();
            document.querySelectorAll('#prematch-check-box details').forEach(d => { d.open = true; });
            scan('spieltag-check', '#prematch-check-box *');
            showScreen('screen-contracts'); openRenewalAssistant();
            scan('verlaengerung', '#renewal-assistant-overlay *'); closeRenewalAssistant();
            document.getElementById('share-report-text').value = 'Testbericht';
            document.getElementById('share-report-overlay').classList.add('show');
            scan('bericht', '#share-report-overlay *'); closeShareReport();
            openFachwort('Moral');
            scan('fachwort', '#fachwort-overlay *'); closeFachwort();
            openPlayerDetail(squad[0].id, 'squad'); openPlayerCompare();
            scan('vergleich', '#compare-overlay *'); closePlayerCompare();
            squad[0].timesInjured = 2; logPlayerInjury(squad[0], 2, 'Spiel'); renderInjuryHistory(squad[0], 'squad');
            document.querySelectorAll('#pd-injuries details').forEach(d => { d.open = true; });
            scan('verletzungsverlauf', '#pd-injuries *'); closePlayerDetail();
            // Runde 26.8 bis 26.10: Assistent mit Fristen und „Später“, Rückkehr-Zeile, Kaderplaner-Ausfälle, Vorlagen-Bilanz,
            // Ausfall-Rangliste, Etiketten-Erklärung und die Notiz in der Halbzeit-Ansicht
            const merk = { vertr: squad.map(x => x.contracts), inj: squad.map(x => x.injured), supp: squad.map(x => x.suspended), tags: squad.map(x => x.tags), spons: game.sponsor, bil: game.vorlageBilanz, arch: game.vorlageBilanzArchiv, notizen: game.gegnerNotizen, h2h: game.headToHeadRecords['FC Beispiel'], cm: currentMatch };
            game.assistentZurueck = {};
            squad.forEach(x => { x.contracts = 4; x.injured = 0; x.suspended = 0; });
            squad[0].contracts = 0; squad[3].injured = 2; squad[4].injured = 4; squad[5].suspended = 1; squad[6].injured = 6;
            game.sponsor = { ...game.sponsor, duration: 4 };
            showScreen('screen-dashboard'); renderManagerAssistant();
            scan('assistent', '#manager-assistant-box *');
            snoozeManagerTodo('vertraege-aus'); scan('assistent-zurueckgestellt', '#manager-assistant-box *'); resetManagerSnooze();
            squad.filter(x => x.pos === 'TW').forEach(x => { x.injured = 3; });
            showScreen('screen-squad-planning'); renderSquadPlanningView();
            scan('kaderplaner-ausfaelle', '#squad-planning-warnings-box *');
            game.vorlageBilanz = { 0: { name: 'Heim offensiv', spiele: 5, s: 3, u: 1, n: 1, tore: 9, gegentore: 4, diffSumme: 6 } };
            game.vorlageBilanzArchiv = [{ season: 1, eintraege: { 0: { name: 'Heim offensiv', spiele: 12, s: 8, u: 2, n: 2, tore: 25, gegentore: 10, diffSumme: 14 } } }];
            showScreen('screen-squad'); setSquadTab('analyse'); renderSquadView();
            scan('vorlagen-bilanz', '#preset-bilanz-box *'); scan('gegner-notizbuch', '#opp-notes-box *');
            squad[2].injuryLog = [{ season: 1, matchday: 2, tage: 5, anlass: 'Spiel' }]; squad[2].timesInjured = 1;
            showScreen('screen-training'); renderMedicalDepartmentPanel();
            document.querySelectorAll('#medical-department-box details').forEach(d => { d.open = true; });
            scan('ausfall-rangliste', '#medical-department-box *');
            squad[5].tags = ['stamm', 'schonen']; showScreen('screen-squad'); openPlayerDetail(squad[5].id, 'squad');
            scan('etiketten-wirkung', '#pd-tags *'); closePlayerDetail();
            game.gegnerNotizen = { 'FC Beispiel': { text: 'Gefährlich bei Standards', season: 1, matchday: 3 } };
            game.headToHeadRecords['FC Beispiel'] = { wins: 3, draws: 1, losses: 2, goalsFor: 9, goalsAgainst: 7, lastResults: ['2:1', '0:0'] };
            currentMatch = { isHome: true, homeName: game.clubName, awayName: 'FC Beispiel', homeGoals: 1, awayGoals: 0 };
            renderHalftimeNotiz(); document.getElementById('halftime-talk-overlay').classList.add('show');
            scan('halbzeit-notiz', '#halftime-talk-overlay *'); document.getElementById('halftime-talk-overlay').classList.remove('show');
            squad.forEach((x, i) => { x.contracts = merk.vertr[i]; x.injured = merk.inj[i]; x.suspended = merk.supp[i]; x.tags = merk.tags[i]; });
            game.sponsor = merk.spons; game.vorlageBilanz = merk.bil; game.vorlageBilanzArchiv = merk.arch; game.gegnerNotizen = merk.notizen; currentMatch = merk.cm;
            if (merk.h2h) game.headToHeadRecords['FC Beispiel'] = merk.h2h; else delete game.headToHeadRecords['FC Beispiel'];
            probe.remove();
            return [...out];
        }, theme);
    }
    for (const theme of themes) {
        assert(fehler[theme].length === 0, `Theme ${theme}: jeder Text erreicht den WCAG-Kontrast (${fehler[theme].length}: ${fehler[theme].slice(0, 5).join(' | ')})`);
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Kontrast-Scan');
    await page.close();
}

async function testBedienelementeHabenNamen(browser) {
    console.log('\n[25.54] Zugänglichkeit: jeder Knopf, jedes Auswahlfeld und jeder Regler hat einen Namen');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 900 });
    const r = await page.evaluate(async () => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(5);
        try { game.secondTeam.isActive = true; } catch (e) { /* egal */ }
        const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim()
            || (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' ? (el.textContent || '').replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '') : '')
            || (el.id && document.querySelector(`label[for="${el.id}"]`) ? 'label' : '') || (el.closest('label') ? 'label' : '') || el.getAttribute('placeholder') || '';
        const stumm = [];
        const finde = wo => [...document.querySelectorAll('button, [role="button"], select, input:not([type="hidden"]), textarea')].filter(el => (el.offsetParent || getComputedStyle(el).position === 'fixed') && !name(el))
            .map(el => `${wo}: ${el.tagName.toLowerCase()}#${el.id || ''} "${(el.textContent || '').trim().slice(0, 8)}" ${(el.getAttribute('onclick') || '').slice(0, 36)}`);
        const pruefe = wo => stumm.push(...finde(wo));
        // Der Beobachter arbeitet gebündelt (120 ms): warten, bis nichts Unbenanntes mehr übrig ist oder sich nichts mehr ändert
        const ruhe = async () => { let letzte = -1, still = 0; for (let i = 0; i < 60 && still < 5; i++) { await new Promise(res => setTimeout(res, 50)); const n = finde('').length; still = (n === 0 || n === letzte) ? still + 1 : 0; letzte = n; if (n === 0 && i > 0) break; } };
        const ids = [...document.querySelectorAll('[id^="screen-"]')].map(e => e.id).filter(id => id !== 'screen-office');
        for (const id of ids) {
            showScreen(id);
            await ruhe();
            pruefe(id);
        }
        document.querySelectorAll('.generic-modal-overlay').forEach(o => o.classList.add('show'));
        await ruhe();
        pruefe('Fenster');
        document.querySelectorAll('.generic-modal-overlay').forEach(o => o.classList.remove('show'));
        // Beispiele: Namen sind verständlich, vorhandene Beschriftungen bleiben
        const beispiel = sel => document.querySelector(sel)?.getAttribute('aria-label') || '';
        const out = { stumm: [...new Set(stumm)] };
        out.schliessen = [...document.querySelectorAll('.generic-modal-close')].every(b => /schlie/i.test(b.getAttribute('aria-label') || b.title || ''));
        out.elfmeter = beispiel('button[onclick="takePenaltyShot(1)"]');
        showScreen('screen-manager-tree'); await ruhe();
        out.wappen = beispiel('button[onclick="setCrestAnimal(\'🦊\')"]');
        out.farbe = beispiel('button[onclick^="setCrestColor("]');
        // Neu gerenderte Teile werden ebenfalls benannt (Beobachter)
        const probe = document.createElement('div');
        probe.innerHTML = '<button id="probe-btn" onclick="void 0">✕</button><select id="probe-sel"><option>a</option></select>';
        document.body.appendChild(probe);
        for (let i = 0; i < 60 && !(document.getElementById('probe-sel').getAttribute('aria-label') && document.getElementById('probe-btn').getAttribute('aria-label')); i++) await new Promise(res => setTimeout(res, 50));
        out.neu = beispiel('#probe-btn') === 'Schließen' && !!document.getElementById('probe-sel').getAttribute('aria-label');
        const eigen = document.createElement('button'); eigen.title = 'Eigener Titel'; eigen.textContent = '✕'; document.body.appendChild(eigen);
        verbessereZugaenglichkeit(document);
        out.titelBleibt = !eigen.getAttribute('aria-label');
        probe.remove(); eigen.remove();
        return out;
    });
    assert(r.stumm.length === 0, `Kein Bedienelement ohne Namen auf ${'allen'} Bildschirmen und in den Fenstern (${r.stumm.length}: ${r.stumm.slice(0, 6).join(' | ')})`);
    assert(r.schliessen, 'Alle Schließen-Knöpfe der Fenster heißen „Schließen“');
    assert(r.elfmeter === 'Mitte oben', `Elfmeter-Pfeile sind benannt (${r.elfmeter})`);
    assert(r.wappen === 'Wappentier Fuchs' && /^Heimfarbe /.test(r.farbe), `Wappen-Auswahl nennt Tier und Farbe (${r.wappen} / ${r.farbe})`);
    assert(r.neu, 'Neu eingefügte Knöpfe und Auswahlfelder werden automatisch benannt');
    assert(r.titelBleibt, 'Ein vorhandener Titel wird nicht überschrieben');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Namensprüfung');
    await page.close();
}

async function testAutoThemeUndBewegung(browser) {
    console.log('\n[25.54] Darstellung: Theme „Automatisch“ folgt dem Handy, Bewegung lässt sich reduzieren');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => { closeTutorial(); setzeDesignTheme('auto'); });
    const lies = () => page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), meta: document.querySelector('meta[name="theme-color"]').getAttribute('content') }));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => applyDesignSettings());
    const dunkel = await lies();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'tageslicht', null, { timeout: 3000 }).catch(() => null);
    const hell = await lies();
    await page.emulateMedia({ colorScheme: 'light', contrast: 'more' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'kontrast', null, { timeout: 3000 }).catch(() => null);
    const kontrast = await lies();
    // Feste Wahl ignoriert die Handy-Einstellung
    await page.emulateMedia({ colorScheme: 'dark', contrast: 'no-preference' });
    await page.evaluate(() => setzeDesignTheme('klassik'));
    const fest = await lies();
    // Bewegung: Handy-Einstellung "reduzieren" wirkt, "Normal" überstimmt sie, "Reduziert" gilt ohne Handy-Wunsch
    const dauer = () => page.evaluate(() => {
        const e = document.createElement('div'); e.style.transition = 'opacity 1s'; document.body.appendChild(e);
        const d = parseFloat(getComputedStyle(e).transitionDuration); e.remove(); return d;
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => setzeBewegung('system'));
    const normalDauer = await dauer();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const systemReduziert = await dauer();
    await page.evaluate(() => setzeBewegung('normal'));
    const ueberstimmt = await dauer();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => setzeBewegung('reduziert'));
    const eigenReduziert = await dauer();
    const gespeichert = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-motion'), wert: safeLocalGet(DESIGN_MOTION_KEY) }));
    assert(dunkel.theme === null && dunkel.meta === '#070b14', `Automatisch + dunkles Handy ergibt Flutlicht-Nacht (${JSON.stringify(dunkel)})`);
    assert(hell.theme === 'tageslicht', `Automatisch + helles Handy ergibt Tageslicht (${hell.theme})`);
    assert(kontrast.theme === 'kontrast', `Automatisch + „Hoher Kontrast“ am Handy ergibt das Kontrast-Theme (${kontrast.theme})`);
    assert(fest.theme === 'klassik', `Eine feste Wahl ignoriert die Handy-Einstellung (${fest.theme})`);
    assert(normalDauer === 1, `Normale Bewegung behält die Übergangsdauer (${normalDauer} s)`);
    assert(systemReduziert < 0.1, `„Wie Handy“ übernimmt „Bewegung reduzieren“ (${systemReduziert} s)`);
    assert(ueberstimmt === 1, `„Normal“ überstimmt die Handy-Einstellung (${ueberstimmt} s)`);
    assert(eigenReduziert < 0.1, `„Reduziert“ wirkt auch ohne Handy-Wunsch (${eigenReduziert} s)`);
    assert(gespeichert.attr === 'reduziert' && gespeichert.wert === 'reduziert', `Die Bewegungs-Wahl wird gespeichert (${JSON.stringify(gespeichert)})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Automatik und Bewegung');
    await page.close();
}

async function testKopfzeileHinweisUndPokerFenster(browser) {
    console.log('\n[25.54] Handy: Kopfzeilen-Chips zeigen per Rand, dass man scrollen kann; Transferpoker öffnet als Fenster');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(async () => {
        closeTutorial();
        const out = {};
        const el = document.querySelector('.header-kpis');
        // Die Hinweis-Klassen folgen Scroll-Ereignissen und Layout; unter Last dauert das länger als 150 ms
        const warteBis = async (bedingung) => { for (let i = 0; i < 60 && !bedingung(); i++) await new Promise(res => setTimeout(res, 50)); };
        await new Promise(res => setTimeout(res, 150));
        await warteBis(() => !(el.scrollWidth > el.clientWidth) || el.classList.contains('kpi-mehr-rechts'));
        out.anfang = { rechts: el.classList.contains('kpi-mehr-rechts'), links: el.classList.contains('kpi-mehr-links'), scrollbar: el.scrollWidth > el.clientWidth };
        el.scrollLeft = el.scrollWidth;
        await warteBis(() => !(el.scrollWidth > el.clientWidth) || (el.classList.contains('kpi-mehr-links') && !el.classList.contains('kpi-mehr-rechts')));
        out.ende = { rechts: el.classList.contains('kpi-mehr-rechts'), links: el.classList.contains('kpi-mehr-links') };
        // Transferpoker: Fenster statt Kasten über der Liste
        showScreen('screen-transfer'); setTransferTab('market');
        window.scrollTo(0, document.documentElement.scrollHeight);
        const y0 = window.scrollY;
        openTransferPoker(marketPlayers.length - 1);
        await warteBis(() => document.getElementById('transfer-poker-overlay').classList.contains('show'));
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const ov = document.getElementById('transfer-poker-overlay');
        const box = ov.querySelector('.generic-modal-box').getBoundingClientRect();
        out.poker = { offen: ov.classList.contains('show'), imBild: box.top >= 0 && box.bottom <= window.innerHeight + 1, sprung: Math.abs(window.scrollY - y0), inhalt: ov.innerText.includes('Transferpoker'),
            knopf: !!ov.querySelector('button[onclick="submitPokerOffer()"]') };
        closeTransferPoker();
        out.zu = !ov.classList.contains('show');
        return out;
    });
    assert(r.anfang.scrollbar ? (r.anfang.rechts && !r.anfang.links) : true, `Kopfzeile am Anfang: Rand rechts zeigt „mehr“ (${JSON.stringify(r.anfang)})`);
    assert(!r.ende.rechts && r.ende.links, `Kopfzeile am Ende: Rand wandert nach links (${JSON.stringify(r.ende)})`);
    assert(r.poker.offen && r.poker.imBild && r.poker.inhalt && r.poker.knopf, `Transferpoker öffnet als Fenster mit Inhalt, vollständig im Bild (${JSON.stringify(r.poker)})`);
    assert(r.poker.sprung <= 1, `Die Seite springt beim Öffnen des Transferpokers nicht (${r.poker.sprung} px)`);
    assert(r.zu, 'Abbrechen schließt das Poker-Fenster');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Kopfzeile und Poker');
    await page.close();
}

async function testFensterTastaturUndSpeicher(browser) {
    console.log('\n[25.55] Fenster per Tastatur, kein Seitensprung im Code, Darstellung doppelt gespeichert');
    // Quelltext: keine Seitensprünge (scrollIntoView / window.scrollTo); innere Ticker-Listen dürfen scrollen
    const fs = require('fs');
    const jsDir = path.join(TESTS_DIR, '..', 'js');
    const sprung = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).filter(f => /scrollIntoView|window\.scrollTo\(|window\.scrollBy\(/.test(fs.readFileSync(path.join(jsDir, f), 'utf8')));
    assert(sprung.length === 0, `Kein Modul scrollt die ganze Seite per Code - Meldungen öffnen als Fenster (${sprung.join(', ')})`);

    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { closeTutorial(); showScreen('screen-staff'); });
    const r = await page.evaluate(() => {
        const ovs = [...document.querySelectorAll('.generic-modal-overlay')];
        const out = { dialoge: ovs.length, alleDialog: ovs.every(o => o.getAttribute('role') === 'dialog' && o.getAttribute('aria-modal') === 'true') };
        const key = Object.keys(staffMembers).find(k => !staffMembers[k].hired);
        out.key = key || null;
        if (key) openCandidatePool(key);
        out.offen = document.getElementById('staff-pool-overlay').classList.contains('show');
        return out;
    });
    await page.keyboard.press('Escape');
    const zu = await page.evaluate(() => !document.getElementById('staff-pool-overlay').classList.contains('show'));
    await page.keyboard.press('Escape'); // ohne offenes Fenster: nichts passiert, kein Fehler
    // Reiter per Tastatur: Pfeil rechts wechselt zum nächsten Reiter, aria-selected folgt
    await page.evaluate(() => { showScreen('screen-staff'); document.getElementById('hubtab-btn-screen-staff').focus(); });
    const leiste = await page.evaluate(() => { const l = document.getElementById('hubtab-btn-screen-staff').parentElement; return { rolle: l.getAttribute('role'), tabs: l.querySelectorAll('[role="tab"]').length, aktiv: l.querySelector('[aria-selected="true"]')?.id }; });
    await page.keyboard.press('ArrowRight');
    const nachPfeil = await page.evaluate(() => ({ fans: document.getElementById('screen-fans').style.display === 'block', aktiv: document.querySelector('#hubtab-btn-screen-fans')?.getAttribute('aria-selected'), fokus: document.activeElement.id }));
    await page.keyboard.press('Home');
    const nachHome = await page.evaluate(() => document.getElementById('screen-stadium').style.display === 'block');
    // Orientierung: ein Hauptbereich, benannte Navigationen, Sprunglink setzt den Fokus auf den Inhalt
    const orient = await page.evaluate(() => {
        document.querySelector('.skip-link').click();
        return { main: document.querySelectorAll('main').length, header: document.querySelectorAll('header').length,
            navs: [...document.querySelectorAll('nav')].map(n => n.getAttribute('aria-label') || ''), fokus: document.activeElement.id, skip: !!document.querySelector('.skip-link') };
    });
    // Spielerdetail: Kopf mit Chips und Werteleiste vor der vollständigen Liste
    const detail = await page.evaluate(() => {
        openPlayerDetail(squad[0].id);
        const sum = document.getElementById('pd-summary');
        const werte = [...sum.querySelectorAll('.ui-stat-row span')].map(e => e.textContent.trim());
        const out = { chips: sum.querySelectorAll('.ui-chip').length, werte, alleAngaben: sum.textContent.includes('Alle Angaben'), liste: document.getElementById('pd-fields').textContent.includes('Marktwert') };
        document.querySelectorAll('.generic-modal-overlay.show').forEach(o => o.classList.remove('show'));
        return out;
    });
    // Meldung: Statusbereich, fängt keine Tipps ab, sie verdeckt den Weiter-Knopf nicht
    const toast = await page.evaluate(async () => {
        showToast('Probe-Meldung', 'success', 8000);
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 320))));
        const t = document.getElementById('app-toast'), fab = document.getElementById('one-hand-fab');
        const a = t.getBoundingClientRect(), f = fab && getComputedStyle(fab).display !== 'none' ? fab.getBoundingClientRect() : null;
        const out = { rolle: t.getAttribute('role'), live: t.getAttribute('aria-live'), sichtbar: t.classList.contains('show'),
            ueberdeckt: !!f && !(a.right <= f.left || a.left >= f.right || a.bottom <= f.top || a.top >= f.bottom), fab: !!f };
        // Die Meldung darf keine Tipps abfangen: Knöpfe darunter müssen bedienbar bleiben
        out.zu = getComputedStyle(t).pointerEvents === 'none';
        return out;
    });
    // Darstellung: fehlt der dauerhafte Wert nach dem Neuladen, kommt er aus dem Tab-Speicher zurück
    await page.evaluate(() => { setzeDesignTheme('klassik'); setzeTextGroesse('gross'); localStorage.removeItem(DESIGN_THEME_KEY); localStorage.removeItem(DESIGN_TEXT_KEY); });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    const nach = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), groesse: document.documentElement.getAttribute('data-text-size'),
        zurueck: localStorage.getItem(DESIGN_THEME_KEY) === 'klassik' }));
    assert(r.dialoge >= 10 && r.alleDialog, `Alle Fenster sind als Dialog gekennzeichnet (${r.dialoge}, role=dialog und aria-modal)`);
    assert(r.key && r.offen, `Das Bewerbungs-Fenster lässt sich öffnen (${r.key})`);
    assert(zu, 'Escape schließt das oberste Fenster');
    assert(leiste.rolle === 'tablist' && leiste.tabs >= 4 && leiste.aktiv === 'hubtab-btn-screen-staff', `Reiterleiste ist tablist mit Reitern, der aktive ist aria-selected (${JSON.stringify(leiste)})`);
    assert(nachPfeil.fans && nachPfeil.aktiv === 'true' && nachPfeil.fokus === 'hubtab-btn-screen-fans', `Pfeil rechts wechselt den Reiter und hält den Fokus (${JSON.stringify(nachPfeil)})`);
    assert(nachHome, 'Pos1 springt zum ersten Reiter');
    assert(toast.rolle === 'status' && toast.live === 'polite' && toast.sichtbar, `Meldung ist ein Statusbereich (${JSON.stringify(toast)})`);
    assert(toast.fab && !toast.ueberdeckt, `Meldung verdeckt den sichtbaren Weiter-Knopf nicht (${JSON.stringify(toast)})`);
    assert(toast.zu, 'Die Meldung fängt keine Tipps ab (pointer-events: none)');
    assert(orient.main === 1 && orient.header === 1 && orient.navs.length >= 2 && orient.navs.every(n => n.length > 2) && orient.fokus === 'main-content' && orient.skip, `Genau ein Hauptbereich, benannte Navigationen, Sprunglink fokussiert den Inhalt (${JSON.stringify(orient)})`);
    assert(detail.chips >= 4 && ['Stärke', 'Moral', 'Fitness', 'Marktwert'].every(w => detail.werte.includes(w)) && detail.alleAngaben && detail.liste, `Spielerdetail zeigt Chips und Werteleiste vor der vollständigen Liste (${JSON.stringify(detail)})`);
    assert(nach.theme === 'klassik' && nach.groesse === 'gross' && nach.zurueck, `Darstellung kommt nach leerem Speicher aus dem Tab-Speicher zurück (${JSON.stringify(nach)})`);
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
            suche.value = ''; renderLexicon();
            // Neue Funktionen: eigene Einträge, Filter "Neu", Anzahl je Kategorie, Sprungknopf mit Ziel
            out.neueEintraege = ['Ausschreitungen & Sicherheit', 'Freischaltungen', 'Startmenü & Karriere-Arten', 'Einsteiger-Modus'].every(t => LEXICON_ENTRIES.some(e => e.title === t && e.neu));
            lexiconNurNeu = true; renderLexicon();
            out.nurNeu = liste().length === LEXICON_ENTRIES.filter(e => e.neu).length && liste().length > 0;
            setLexiconCategory('Alle');
            out.anzahl = document.getElementById('lexicon-categories').textContent.includes(String(LEXICON_ENTRIES.length));
            out.sprungZiel = document.getElementById('lexicon-list').textContent.includes('➜ Zum Kader');
            suche.value = 'Geisterspiel'; renderLexicon();
            out.sucheNeu = document.getElementById('lexicon-list').textContent.includes('Ausschreitungen & Sicherheit');
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
    const N = ['neueEintraege', 'nurNeu', 'anzahl', 'sprungZiel', 'sucheNeu'];
    assert(N.every(k => r[k] === true), `Lexikon aktuell: Einträge zu den neuen Funktionen, Filter „Neu“, Anzahl je Kategorie, Sprungknopf mit Ziel (${JSON.stringify(N.map(k => r[k]))})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
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
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
    await page.evaluate(() => closeTutorial());
    // Startbildschirm ist das Managerbüro und deckt das ganze Display ab - für die
    // Kopfzeilen-/Seitenmenü-Knöpfe muss der Test es zuerst verlassen.
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.waitForFunction(() => document.getElementById('screen-dashboard').style.display === 'block', null, { timeout: 5000 }).catch(() => null);

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
    await zweite.goto('file://' + path.resolve(TESTS_DIR, 'package.json'));
    for (let i = 0; i < 30; i++) {
        if (await zweite.evaluate(() => localStorage.getItem('anstoss_fm13_language')) === 'en') break;
        await zweite.waitForTimeout(100);
    }
    await zweite.close();
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
    await page.evaluate(() => { closeTutorial(); showScreen('screen-dashboard'); });
    await page.waitForFunction(() => document.getElementById('screen-dashboard').style.display === 'block', null, { timeout: 5000 }).catch(() => null);
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
            // Zwei Frames plus kurze Pause: unter Parallellast werden Inhalte später gezeichnet als 20 ms
            await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 40))));
            if (document.documentElement.scrollWidth > W + 2) {
                // Verursacher benennen, damit ein Fehlschlag sofort zeigt, welches Element breit ist
                const breit = [...document.querySelectorAll('body *')].filter(el => {
                    const rc = el.getBoundingClientRect();
                    return rc.width && rc.right > W + 2 && getComputedStyle(el).display !== 'none';
                }).slice(0, 3).map(el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} (${Math.round(el.getBoundingClientRect().right)}px, "${(el.textContent || '').trim().slice(0, 30)}")`);
                ueberlauf.push(breit.length ? `${name}: ${breit.join('; ')}` : name);
            }
            // Seitenende muss nach dem Herunterscrollen über der unteren Leiste stehen
            window.scrollTo(0, document.documentElement.scrollHeight);
            const navTop = document.querySelector('.bottom-nav-bar').getBoundingClientRect().top;
            const sichtbar = [...document.querySelectorAll('.app-content button, .app-content .box')].filter(e => e.getBoundingClientRect().height > 0 && !e.closest('[style*="overflow-y"]') && !e.closest('details:not([open])'));
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
                if (parseFloat(getComputedStyle(el).fontSize) < 11) schrift.push(`${name}: "${el.textContent.trim().slice(0, 20)}" ${getComputedStyle(el).fontSize}`);
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
    // Lange Vereinsnamen in den Europa-Gruppen (Punkt 9): die Tabellen dürfen die Handy-Breite nicht sprengen
    const langEuropa = await page.evaluate(() => {
        closeTutorial(); game.inEurope = true; initEuropeCup(); simulateMatchdays(3);
        [...europeTournament.groupA, ...europeTournament.groupB].forEach((t, i) => { if (t.name !== game.clubName) t.name = 'Fußballclub Sportverein Bürgerschaft ' + i; });
        showScreen('screen-europe');
        return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => res(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), 40))));
    });
    assert(langEuropa, 'Lange Vereinsnamen in den Europa-Gruppen laufen nicht über die Handy-Breite');
    assert(r.knoepfe.length === 0, `Alle Knöpfe mindestens 32 px hoch (${r.knoepfe.slice(0, 4).join(' | ')})`);
    assert(r.schrift.length === 0, `Keine Schrift unter 11 px auf dem Handy (${r.schrift.length}: ${r.schrift.slice(0, 60).join(' | ')})`);
    assert(r.navZeilen === 1, `Untere Leiste in einer Zeile (${r.navZeilen})`);
    assert(r.streifen.length === 0, `Akzentstreifen der Kästen liegt nirgends auf dem Text (${r.streifen.length}: ${r.streifen.slice(0, 4).join(' | ')})`);
    assert(r.verdeckt.length === 0, `Seitenende nirgends von der unteren Leiste oder dem schwebenden Weiter-Knopf verdeckt (${r.verdeckt.slice(0, 5).join(', ')})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testTastaturFokus(browser) {
    console.log('\n[25.25] Tastatur: sichtbarer Fokusrahmen auf Schaltflächen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.evaluate(() => { try { closeTutorial(); } catch (e) { /* egal */ } });
    // Bis zu 8 Tabs: die ersten Stationen können Bildelemente sein, die kein Tastaturziel sind
    let treffer = { fokus: false, sichtbar: false, tag: '-' };
    for (let i = 0; i < 8 && !treffer.fokus; i++) {
        await page.keyboard.press('Tab');
        treffer = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return { fokus: false, sichtbar: false, tag: '-' };
            return { fokus: el.matches('button, input, select, textarea, a[href]'), sichtbar: getComputedStyle(el).outlineStyle === 'solid', tag: el.tagName };
        });
    }
    assert(treffer.fokus && treffer.sichtbar, `Die Tab-Taste setzt den Fokus auf eine Schaltfläche mit sichtbarem Rahmen (${treffer.tag})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Tastaturbedienung');
    await page.close();
}

async function testDashAutosaveZeile(browser) {
    console.log('\n[25.25] Dashboard: letzter Autosave in einer Zeile');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            localStorage.removeItem(AUTOSAVE_KEY);
            renderDashboardView();
            const leer = document.getElementById('dash-autosave-line').innerText;
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ meta: { season: 3, matchday: 5, savedAt: '12:34', clubName: 'X', league: 'L', money: 1 } }));
            renderDashboardView();
            const mit = document.getElementById('dash-autosave-line').innerText;
            return { leer: leer.includes('noch keiner'), mit: mit.includes('Spieltag 5/34') && mit.includes('12:34') };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.leer, 'Ohne Autosave steht auf dem Dashboard: noch keiner');
    assert(!r.crash && r.mit, 'Mit Autosave steht Saison, Spieltag und Uhrzeit auf dem Dashboard');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Dashboard mit Autosave');
    await page.close();
}

async function testModalFokus(browser) {
    console.log('\n[25.25] Tastatur in Overlays: Fokus springt hinein, Tab bleibt drin, Schließen geht zum Auslöser zurück');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.evaluate(() => {
        closeTutorial();
        const sichtbar = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null);
        sichtbar.id = 'test-ausloeser';
        sichtbar.focus();
    });
    const oeffnen = await page.evaluate(async () => {
        const ov = document.getElementById('formation-modal-overlay');
        ov.classList.add('show');
        await new Promise(res => setTimeout(res, 60));
        const els = modalFokusElemente(ov);
        return { innen: ov.contains(document.activeElement), anzahl: els.length };
    });
    assert(oeffnen.innen, 'Beim Öffnen springt der Fokus in den Dialog');
    assert(oeffnen.anzahl > 1, `Der Dialog hat mehrere Tastaturziele (${oeffnen.anzahl})`);
    await page.evaluate(() => { const els = modalFokusElemente(document.getElementById('formation-modal-overlay')); els[els.length - 1].focus(); });
    await page.keyboard.press('Tab');
    const tab = await page.evaluate(() => {
        const ov = document.getElementById('formation-modal-overlay');
        const els = modalFokusElemente(ov);
        return ov.contains(document.activeElement) && document.activeElement === els[0];
    });
    assert(tab, 'Tab auf dem letzten Element springt zum ersten - der Fokus verlässt den Dialog nicht');
    const zurueck = await page.evaluate(async () => {
        document.getElementById('formation-modal-overlay').classList.remove('show');
        await new Promise(res => setTimeout(res, 60));
        return document.activeElement && document.activeElement.id === 'test-ausloeser';
    });
    assert(zurueck, 'Beim Schließen kehrt der Fokus zum Auslöser zurück');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Overlays mit Tastatur');
    await page.close();
}

async function testEnglischDynamischeTexte(browser) {
    console.log('\n[25.25] Englisch: Autosave-Zeile, Co-Trainer-Bilanz und Vorvertrags-Frist sind übersetzt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            setLanguage('en');
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ meta: { season: 3, matchday: 5, savedAt: '12:34' } }));
            renderDashAutosaveLine();
            const auto = document.getElementById('dash-autosave-line').textContent;
            game.coTrainerHistory = { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 };
            recordLiveCoTrainerMatch('win', { coTrainerFollowed: 1 });
            const bilanz = coTrainerLiveBilanzText(game.coTrainerHistory);
            squad[0].preContractOffer = { club: 'Testklub Vorvertrag', deadline: 27 };
            renderPreContractBox();
            const vorvertrag = document.getElementById('precontract-box').textContent;
            setLanguage('de');
            return { auto, bilanz, vorvertrag };
        } catch (e) { setLanguage('de'); return { crash: e.message }; }
    });
    assert(!r.crash && r.auto.includes('Autosave: season 3') && r.auto.includes('matchday 5/34'), `Autosave-Zeile auf Englisch (${r.auto || r.crash})`);
    assert(!r.crash && r.bilanz.includes('Live match record') && r.bilanz.includes('1/1 wins'), `Co-Trainer-Bilanz auf Englisch (${r.bilanz || r.crash})`);
    assert(!r.crash && r.vorvertrag.includes('Pre-contract offers') && r.vorvertrag.includes('deadline matchday 27'), 'Vorvertrags-Frist auf Englisch');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den englischen Texten');
    await page.close();
}

async function testKnopfWorteHandy(browser) {
    console.log('\n[26.9] Handy: kein Wort in einem Knopf ist breiter als der Knopf, kein Überlauf der Seite (320 px normal, 360 px groß, 390 px sehr groß, jeweils auch mit breiterer Schrift)');
    const { page, consoleErrors } = await freshPage(browser);
    // Fester Zufall schon vor dem Start des Spiels (Kadernamen, Gerüchte, Saisonziele sind sonst bei jedem Lauf anders
    // und der Test würde flackern): Seite mit Initialisierungsskript neu laden
    await page.addInitScript(() => { let seed = 20260115; Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 });
    await page.evaluate(() => {
        closeTutorial(); game.sackPending = false; simulateMatchdays(3);
        const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st);
    });
    // Die CI hat breitere Schrift als die Entwicklungsmaschinen (3.133 scheiterte dort an „Speichern“): der Stressmodus
    // verbreitert jede Schrift um rund 9 % (letter-spacing), damit Engstellen schon lokal auffallen.
    // Dritter Modus „breit“: echte breite Systemschrift (DejaVu Sans, rund 12 % breiter als die Standardschrift) statt
    // Buchstabenabstand; die Schrift ist auf der CI-Maschine ähnlich breit. Weitere Größen: 280 px (kleinste Handys)
    // und Querformat (640 x 360, wenig Höhe).
    const konfigs = [[320, 'normal', false, 800], [360, 'gross', false, 800], [390, 'sehr-gross', false, 800], [320, 'normal', true, 800], [360, 'gross', true, 800], [390, 'sehr-gross', true, 800],
        [320, 'normal', 'breit', 800], [360, 'gross', 'breit', 800], [390, 'sehr-gross', 'breit', 800], [280, 'normal', false, 800], [640, 'normal', 'breit', 360]];
    for (const [breite, groesse, stress, hoehe] of konfigs) {
        await page.setViewportSize({ width: breite, height: hoehe });
        const ergebnis = await page.evaluate(async ([groesse, stress]) => {
            setzeTextGroesse(groesse);
            let st = document.getElementById('schrift-stress');
            if (st) st.remove();
            if (stress === 'breit') { st = document.createElement('style'); st.id = 'schrift-stress'; st.textContent = '*,*::before,*::after{font-family:"DejaVu Sans",Verdana,sans-serif!important}'; document.head.appendChild(st); }
            else if (stress) { st = document.createElement('style'); st.id = 'schrift-stress'; st.textContent = '*,*::before,*::after{letter-spacing:0.08em!important}'; document.head.appendChild(st); }
            const zuBreit = new Set(), seitenBreit = new Set();
            const probe = document.createElement('span'); document.body.appendChild(probe);
            const ids = [...document.querySelectorAll('[id^="screen-"]')].map(e => e.id).filter(id => !['screen-office', 'screen-matchday', 'screen-admin'].includes(id));
            const pruefe = wo => {
                if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
                    const schuldige = [...document.querySelectorAll('.app-content *')].filter(el => (el.offsetParent || getComputedStyle(el).position === 'fixed') && el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !el.closest('.kpi-strip, .kpi-row, [style*="overflow-x"]'))
                        .slice(0, 3).map(el => `${el.tagName.toLowerCase()}#${el.id}.${String(el.className).slice(0, 24)} "${(el.textContent || "").trim().slice(0, 30)}" in ${el.parentElement ? el.parentElement.id || el.parentElement.className : ""}`);
                    seitenBreit.add(`${wo} (${document.documentElement.scrollWidth} px; ${schuldige.join(', ') || 'unbekannt'})`);
                }
                document.querySelectorAll(window.innerWidth < 300 ? '.app-content button' : '.app-content button, .bottom-nav-bar button').forEach(el => {
                    if (!el.offsetParent || el.closest('details:not([open]) > :not(summary)')) return;
                    const txt = (el.innerText || '').trim(); if (!txt) return;
                    const cs = getComputedStyle(el);
                    const innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
                    if (innen <= 0) return;
                    probe.style.cssText = `position:absolute; visibility:hidden; white-space:nowrap; font:${cs.font}; letter-spacing:${cs.letterSpacing}`;
                    // Bindestrich-Wörter dürfen am Bindestrich umbrechen
                    txt.split(/\s+/).flatMap(w => w.split(/(?<=-)/)).forEach(teil => { probe.textContent = teil; if (probe.getBoundingClientRect().width > innen + 1) zuBreit.add(`${wo}: "${teil}" in "${txt.slice(0, 28)}" (${Math.round(innen)} px)`); });
                });
            };
            for (const id of ids) {
                showScreen(id);
                if (id === 'screen-squad') for (const t of ['aufstellung', 'taktik', 'analyse', 'team']) { setSquadTab(t); pruefe('squad-' + t); }
                await new Promise(res => setTimeout(res, 15));
                pruefe(id);
            }
            probe.remove();
            if (st) st.remove();
            setzeTextGroesse('normal');
            // Automatische Silbentrennung trennt auf Handys mit Trennwörterbuch auch Wörter, die passen (Board-Karte t3)
            const silben = [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).hyphens === 'auto').map(b => (b.innerText || b.id || '').trim().slice(0, 28));
            return { zuBreit: [...zuBreit], seitenBreit: [...seitenBreit], silben };
        }, [groesse, stress]);
        const wie = `${breite} px${hoehe < 800 ? ' quer' : ''}, Schrift ${groesse}${stress === 'breit' ? ', breite Systemschrift' : stress ? ', breiter' : ''}`;
        assert(ergebnis.zuBreit.length === 0, `${wie}: kein Wort breiter als sein Knopf (${ergebnis.zuBreit.length}: ${ergebnis.zuBreit.slice(0, 4).join(' | ')})`);
        assert(ergebnis.seitenBreit.length === 0, `${wie}: die Seite wird nicht breiter als der Bildschirm (${ergebnis.seitenBreit.length}: ${ergebnis.seitenBreit.slice(0, 4).join(' | ')})`);
        assert(ergebnis.silben.length === 0, `${wie}: kein Knopf mit automatischer Silbentrennung (${ergebnis.silben.length}: ${ergebnis.silben.slice(0, 4).join(' | ')})`);
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

module.exports = {
    testOneHandControls,
    testEnglishUi,
    testLexiconEnglish,
    testDesignThemes,
    testKeineFestenFarben,
    testKontrastAlleThemes,
    testBedienelementeHabenNamen,
    testAutoThemeUndBewegung,
    testKopfzeileHinweisUndPokerFenster,
    testFensterTastaturUndSpeicher,
    testLexicon,
    testAccessibilityContrastAndFontSizes,
    testLanguageToggle,
    testMobileLayout,
    testTastaturFokus,
    testDashAutosaveZeile,
    testModalFokus,
    testEnglischDynamischeTexte,
    testKnopfWorteHandy,
};
