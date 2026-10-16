// Testsuiten: spielstand
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testAutosaveResume(browser) {
    console.log('\n[19.x] Autosave: Start lädt den zuletzt geschriebenen Stand, Fehler werden gemeldet');
    // 1. Spielen bis zum Autosave (ein gemeinsamer Kontext = gemeinsamer Speicher wie im Browser)
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const fehler = [];
    page1.on('pageerror', e => fehler.push(e.message));
    page1.on('dialog', d => d.accept());
    await page1.goto(GAME_PATH);
    await page1.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page1.waitForTimeout(100);
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
    await page2.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page2.waitForTimeout(100);
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
            out.kopieHinweis = describeSaveFailure({ reason: 'voll', backupDropped: true }).includes('Sicherheitskopie wurde dafür schon entfernt');
            out.ohneKopieKeinHinweis = !describeSaveFailure({ reason: 'voll' }).includes('Sicherheitskopie');
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
        assert(r.kopieHinweis && r.ohneKopieKeinHinweis, 'Ist die Sicherheitskopie umsonst entfernt worden, sagt die Meldung das ausdrücklich');
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
    await p2.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await p2.waitForTimeout(100);
    await p2.evaluate(() => {
        closeTutorial();
        game.money = 345678; saveGameToSlot(1);
        localStorage.setItem(SAVE_SLOT_PREFIX + 2, '{"kaputt":');
        localStorage.setItem('anstoss_fm13_last_save', 'slot2');
    });
    await p2.reload();
    await p2.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await p2.waitForTimeout(100);
    const start = await p2.evaluate(() => ({ money: game.money, toast: (document.getElementById('app-toast') || {}).innerText || '' }));
    assert(start.money === 345678, `Start: beschädigter letzter Stand (Slot 2) wird übersprungen, Slot 1 geladen (${start.money})`);
    assert(fehler2.length === 0, `Keine JS-Fehler beim Start mit beschädigtem Stand (${fehler2.slice(0, 2).join(' | ')})`);
    await p2.close();
}

async function testAlteAngebotKappung(browser) {
    console.log('\n[25.44] Gebote aus älteren Spielständen werden beim Laden auf die Obergrenze gekappt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const vier = leaguesData[3][0].name;   // 4. Liga: Obergrenze 5 Mio. €
        const zwei = leaguesData[2][0].name;   // 3. Liga: Obergrenze 15 Mio. €
        incomingOffers = [
            { id: 'a', playerId: 1, clubName: vier, currentBid: 367380000, originalBid: 367380000 },
            { id: 'b', playerId: 2, clubName: zwei, currentBid: 300000, originalBid: 300000 }
        ];
        bereinigeEingehendeAngebote();
        return { hoch: incomingOffers[0].currentBid, hochOriginal: incomingOffers[0].originalBid, klein: incomingOffers[1].currentBid };
    });
    assert(r.hoch === 5000000, 'Ein Gebot von 367 Mio. € aus der 4. Liga wird auf 5 Mio. € gekappt');
    assert(r.hochOriginal === 5000000, 'Auch das Ursprungsgebot wird gekappt');
    assert(r.klein === 300000, 'Ein kleines Gebot bleibt unverändert');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Kappung');
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
    // Import läuft asynchron (Datei lesen, prüfen, laden): auf den Zustand warten statt feste Zeit (unter Parallellast zu knapp)
    await page.waitForFunction(() => game.money === 987654, null, { timeout: 5000 }).catch(() => {});
    const afterImport = await page.evaluate(() => game.money);
    assert(afterImport === 987654, 'Import aus Datei stellt den exportierten Spielstand korrekt wieder her');

    await page.evaluate(() => { setTimeout(() => { nichtExistierendeFunktionXYZ(); }, 10); });
    // Auf den Eintrag im gespeicherten Fehlerprotokoll warten statt einer festen Zeit (unter Parallellast zu knapp).
    // Gelesen wird der Zwischenspeicher, nicht der Export: der würde einen Download auslösen.
    await page.waitForFunction(() => ((window.sessionStorage && sessionStorage.getItem('anstoss_fm13_runtime_errors')) || '').includes('nichtExistierendeFunktionXYZ'), null, { timeout: 10000 });
    const [download2] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(() => window.__exportRuntimeErrorLog())
    ]);
    const errorLog = JSON.parse(fs.readFileSync(await download2.path(), 'utf-8'));
    assert(errorLog.some(e => e.msg.includes('nichtExistierendeFunktionXYZ')), 'Fehlerprotokoll-Export enthält den tatsächlich aufgetretenen Laufzeitfehler');

    assert(consoleErrors.filter(e => !e.includes('nichtExistierendeFunktionXYZ')).length === 0, 'Keine UNERWARTETEN JS-Konsolenfehler bei Export/Import-Test');
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
        out.fuenfKnopf = !!document.querySelector('[onclick="simulateMatchdays(5, true)"]'); // mit Zusammenfassung (Phase 26.17)
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

async function testSpielstandAeltereVersion(browser) {
    console.log('\n[25.25] Spielstand aus älterer Version: lädt ohne Fehler, Verein und Kader bleiben erhalten');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.money = 222333;
            saveGameToSlot(1);
            const alt = JSON.parse(localStorage.getItem(SAVE_SLOT_PREFIX + 1));
            alt.meta.version = '3.94';
            // Felder, die erst spätere Versionen eingeführt haben, fehlen im alten Stand
            ['boardEarlyWarnSeason', 'coTrainerTrust', 'preContracts', 'boardGraceSeason', 'tvAdvance'].forEach(k => delete alt.game[k]);
            localStorage.setItem(SAVE_SLOT_PREFIX + 2, JSON.stringify(alt));
            const verein = game.clubName, kader = squad.length;
            const ok = loadGameFromSlot(2, true);
            const out = { ok: ok === true, geladen: game.money === 222333, verein: game.clubName === verein, kader: squad.length === kader };
            updateUI();
            renderDashboardView();
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Ältere Version lädt ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.ok && r.geladen, 'Der Spielstand aus 3.94 wird geladen, das Geld bleibt erhalten');
        assert(r.verein && r.kader, 'Verein und Kader bleiben nach dem Laden erhalten');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler beim Laden älterer Stände (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSpielstandFehlermeldung(browser) {
    console.log('\n[25.25] Beschädigter Spielstand: Meldung nennt den Slot und sagt, was bleibt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            localStorage.setItem(SAVE_SLOT_PREFIX + 2, '{"kaputt":');
            loadGameFromSlot(2, false);
            const ohneKopie = document.getElementById('app-toast').innerText;
            // Ein erfolgreiches Laden legt eine Sicherheitskopie des laufenden Spiels an
            saveGameToSlot(1);
            loadGameFromSlot(1, false);
            localStorage.setItem(SAVE_SLOT_PREFIX + 2, '{"kaputt":');
            loadGameFromSlot(2, false);
            const mitKopie = document.getElementById('app-toast').innerText;
            return { ohneKopie, mitKopie };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.ohneKopie.includes('Slot 2') && r.ohneKopie.includes('nicht lesbar'), `Die Meldung nennt den beschädigten Slot (${r.ohneKopie || r.crash})`);
    assert(!r.crash && r.ohneKopie.includes('bleibt unverändert') && r.ohneKopie.includes('anderen Slot oder den Autosave'), 'Ohne Sicherheitskopie: das laufende Spiel bleibt, es gibt einen Ausweg');
    assert(!r.crash && r.mitKopie.includes('Sicherheitskopie wiederherstellen'), 'Mit Sicherheitskopie verweist die Meldung auf die Wiederherstellung');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Laden eines beschädigten Stands');
    await page.close();
}

async function testAeltereStaende(browser) {
    console.log('\n[25.25] Spielstände aus älteren Versionen (tests/fixtures/saves) laden in den aktuellen Build');
    const fs = require('fs');
    const ordner = path.resolve(TESTS_DIR, 'fixtures/saves');
    const dateien = fs.readdirSync(ordner).filter(f => f.endsWith('.json')).sort();
    assert(dateien.length >= 3, `Es liegen Fixtures aus mehreren Versionen vor (${dateien.join(', ')})`);
    for (const datei of dateien) {
        const raw = fs.readFileSync(path.join(ordner, datei), 'utf8');
        const erwartet = JSON.parse(raw);
        const version = datei.replace(/\.json$/, '').replace(/^v/, '');
        const { page, consoleErrors } = await freshPage(browser);
        page.on('dialog', d => d.accept());
        const r = await page.evaluate((raw) => {
            try {
                closeTutorial();
                localStorage.setItem(SAVE_SLOT_PREFIX + 2, raw);
                const ok = loadGameFromSlot(2, true);
                updateUI();
                renderDashboardView();
                const phase26 = typeof getPlayerTags === 'function' ? { vorlage: !!(game.lineupPresets && game.lineupPresets[0] && game.lineupPresets[0].ids.length === 11), tags: squad.filter(p => getPlayerTags(p).length).length, serien: !!(game.serien && game.serien.aktuell), assistent: (renderManagerAssistant(), true) } : null;
                return { ok: ok === true, money: game.money, kader: squad.length, verein: game.clubName, phase26 };
            } catch (e) { return { crash: e.message + ' ' + e.stack }; }
        }, raw);
        assert(!r.crash, `Stand ${version} lädt ohne Absturz (${r.crash || 'ok'})`);
        if (!r.crash) {
            assert(r.ok, `Stand ${version} wird angenommen, nicht als beschädigt abgewiesen`);
            assert(Math.round(r.money) === Math.round(erwartet.game.money), `Stand ${version}: Geld bleibt erhalten (${Math.round(r.money)} statt ${Math.round(erwartet.game.money)})`);
            assert(r.kader === erwartet.squad.length && r.verein === erwartet.game.clubName, `Stand ${version}: Verein und Kader bleiben erhalten`);
            if (version === '3.129') assert(r.phase26 && r.phase26.vorlage && r.phase26.tags === 2 && r.phase26.serien && r.phase26.assistent, `Stand ${version}: Vorlagen, Etiketten und Serien aus Phase 26 bleiben erhalten (${JSON.stringify(r.phase26)})`);
        }
        // Derselbe Stand als Autosave, und danach läuft ein Spieltag normal weiter (25.26)
        const weiter = await page.evaluate((raw) => {
            try {
                localStorage.setItem(AUTOSAVE_KEY, raw);
                const autoOk = loadAutoSave() === true;
                const md = game.matchday;
                // Ein Stand mit gesetzter Entlassung bleibt stehen, bis die Meldung bestätigt ist (Regel, kein Fehler)
                const entlassen = game.sackPending === true;
                simulateMatchdays(1);
                return { autoOk, entlassen, weiter: entlassen ? game.matchday === md : game.matchday === md + 1 };
            } catch (e) { return { crash: e.message }; }
        }, raw);
        assert(!weiter.crash && weiter.autoOk, `Stand ${version}: lädt auch als Autosave`);
        assert(!weiter.crash && weiter.weiter, `Stand ${version}: nach dem Laden läuft ein Spieltag normal weiter bzw. steht bei gesetzter Entlassung still (${weiter.crash || ''})`);
        assert(consoleErrors.length === 0, `Stand ${version}: keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
        await page.close();
    }
}

async function testAutosaveLadeMeldung(browser) {
    console.log('\n[25.25] Beschädigter Autosave: Meldung nennt den Autosave und den Ausweg über einen Slot');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            localStorage.setItem(AUTOSAVE_KEY, '{"kaputt":');
            loadAutoSave();
            return document.getElementById('app-toast').innerText;
        } catch (e) { return 'CRASH ' + e.message; }
    });
    assert(r.includes('Autosave') && r.includes('nicht lesbar'), `Die Meldung nennt den Autosave als unlesbar (${r})`);
    assert(r.includes('lade einen Spielstand aus einem Slot') && r.includes('bleibt unverändert'), 'Die Meldung sagt, dass das Spiel bleibt und welcher Slot der Ausweg ist');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Laden eines beschädigten Autosaves');
    await page.close();
}

module.exports = {
    testAutosaveResume,
    testSaveSafety,
    testAlteAngebotKappung,
    testFreeTextInputSanitization,
    testSaveExportImportAndErrorLog,
    testAutoSaveAndPartialSimulation,
    testSpielstandAeltereVersion,
    testSpielstandFehlermeldung,
    testAeltereStaende,
    testAutosaveLadeMeldung,
};
