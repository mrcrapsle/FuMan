// Testsuiten: ultras
// Fanszene (js/ultras.js): Aktionen mit Tageslimit, Ausrüstung, Fähigkeiten, Level, Canvas-Duell,
// Ticks und Schnittstellen zu Stadion, Ausschreitungen und Stärke.
const { assert, freshPage } = require('../lib');

async function testUltras(browser) {
    console.log('\n[Fanszene] Ultras: Aktionen, Ausrüstung, Level, Duell im Canvas, Ticks und Schnittstellen');
    const { page, consoleErrors } = await freshPage(browser);
    await page.setViewportSize({ width: 320, height: 800 });
    const r = await page.evaluate(() => {
        if (typeof closeTutorial === 'function') closeTutorial();
        const out = {};
        const toasts = []; const toastAlt = showToast; showToast = (t) => { toasts.push(t); };
        const notices = []; const noticeAlt = showNotice; showNotice = (t) => { notices.push(t); };

        // Alte Stände ohne Fanszene: Zustand wird beim ersten Zugriff ergänzt
        delete game.ultras;
        ensureUltrasState();
        out.start = game.ultras.level === 1 && game.ultras.mitglieder === 40 && game.ultras.skills.anfeuern === 1 && game.ultras.akten === 0;

        // Anfeuern kostet nichts, hebt die Stimmung, zählt als Aktion
        game.ultras.stimmung = 40;
        ultrasAktionAusfuehren('anfeuern');
        out.anfeuern = game.ultras.stimmung > 40 && ultrasAktionenFrei() === 1;

        // Tageslimit: zwei Aktionen je Spieltag
        ultrasAktionAusfuehren('werben');
        const vorher = game.ultras.mitglieder;
        ultrasAktionAusfuehren('anfeuern');
        out.limit = ultrasAktionenFrei() === 0 && game.ultras.mitglieder === vorher + 0 && toasts.some(t => t.includes('Aktionen'));

        // Nächster Spieltag: Limit zurück
        game.matchday++;
        out.neuerTag = ultrasAktionenFrei() === 2;
        game.matchday--;

        // Pyro ohne Lager sagt warum; mit Lager zündet es, das nächste Spiel wird riskanter
        game.matchday++;
        game.ultras.ausruestung.pyro = 0;
        ultrasAktionAusfuehren('pyro');
        out.pyroLeer = toasts.some(t => t.includes('Kein Pyro'));
        game.ultras.ausruestung.pyro = 3;
        ultrasAktionAusfuehren('pyro');
        out.pyro = game.ultras.ausruestung.pyro === 2 && game.ultras.pyroNaechstesSpiel === true && getUltrasRisikoFaktor(true) > 1;
        game.matchday--;

        // Ausrüstung kaufen mit Kassenprüfung
        game.ultras.kasse = 100;
        ultrasAusruestungKaufen('fahnen');
        out.kasseZu = game.ultras.ausruestung.fahnen === 0 && toasts.some(t => t.includes('Gruppenkasse'));
        game.ultras.kasse = 50000;
        ultrasAusruestungKaufen('fahnen');
        out.kaufen = game.ultras.ausruestung.fahnen === 1 && game.ultras.kasse < 50000;

        // Level und Fähigkeiten: XP löst Aufstieg aus, Punkte steigern eine Fähigkeit
        ultrasXpGeben(500);
        out.level = game.ultras.level > 1 && game.ultras.skillPunkte >= 1;
        const punkte = game.ultras.skillPunkte;
        ultrasFaehigkeitSteigern('choreo');
        out.skill = game.ultras.skills.choreo === 2 && game.ultras.skillPunkte === punkte - 1;

        // Spieltag-Tick: Merchandise je Heimspiel, XP, Stimmung der Fangruppe folgt der Szene
        const kasseVorher = game.ultras.kasse;
        ultrasSpieltagTick({ heim: true, gegner: 'Testverein' });
        out.spieltag = game.ultras.kasse >= kasseVorher && typeof fanGroups.find(g => g.id === 'ultras').mood === 'number';

        // Monatstick: Mitgliedsbeiträge in die Gruppenkasse, Polizeidruck sinkt
        game.ultras.polizei = 20;
        const kasseMonat = game.ultras.kasse;
        ultrasMonatsTick();
        out.monat = game.ultras.kasse > kasseMonat && game.ultras.polizei === 14;

        // Schnittstellen: Heimstärke wirkt nur daheim, Risikofaktor bleibt im Rahmen
        game.ultras.stimmung = 90;
        out.staerke = getUltrasStaerkeBonus(true) > 0 && getUltrasStaerkeBonus(false) === 0;
        const rf = getUltrasRisikoFaktor(true);
        out.risiko = rf >= 0.7 && rf <= 1.5;

        // Duell: Gegnergruppe ist fest, drei Runden im Canvas, Ende mit Bilanz
        game.ultras.mitglieder = 40;
        game.ultras.verletzte = [];
        game.ultras.kasse = 50000;
        game.ultras.aktionen = { schluessel: '', anzahl: 0 };
        const g1 = ultrasGegnerGruppe('Testverein'); const g2 = ultrasGegnerGruppe('Testverein');
        out.gegnerFest = g1.name === g2.name && g1.mitglieder === g2.mitglieder;
        showScreen('screen-ultras');
        ultrasAktionAusfuehren('duell', 'Testverein');
        out.duellStart = !!ultrasDuell && ultrasDuell.phase === 'wahl' && game.ultras.kasse === 50000 - ULTRAS_DUELL_ANREISE;
        const canvas = document.getElementById('ultras-canvas');
        out.canvas = !!canvas && canvas.width === 640 && canvas.height === 240;

        out.duellFelder = typeof ultrasWaehleTaktik === 'function' && !!document.querySelector('#ultras-duell-box button');
        return out;
    });

    // Drei Runden im Canvas: jede Runde nach Taktik wählen und die Animation abwarten
    for (let i = 0; i < 3; i++) {
        await page.waitForFunction(() => ultrasDuell && ultrasDuell.phase === 'wahl', null, { timeout: 10000 });
        await page.evaluate(() => ultrasWaehleTaktik(['vorstoss', 'halten', 'rueckzug'][ultrasDuell.gespielt]));
    }
    await page.waitForFunction(() => ultrasDuell && ultrasDuell.phase === 'ende', null, { timeout: 10000 });
    const d = await page.evaluate(() => ({
        verlauf: ultrasDuell.verlauf.length,
        ausgang: ultrasDuell.siege + ultrasDuell.niederlagen,
        ergebnis: ultrasDuell.ergebnis,
        bilanz: Object.keys(game.ultras.bilanz).length,
        chronik: game.ultras.chronik.some(c => c.text.includes('Duell gegen')),
        boxEnde: document.getElementById('ultras-duell-box').innerText.includes('Duell beendet'),
        nav: [...document.querySelectorAll('.nav-btn')].some(b => (b.getAttribute('onclick') || '').includes("showScreen('screen-ultras')"))
    }));
    const sichtbar = await page.evaluate(() => { showScreen('screen-ultras'); return document.getElementById('screen-ultras').style.display === 'block' && !!document.getElementById('ultras-status-box').innerText.trim(); });
    // Zurück auf den Startbildschirm: die Animationsschleife endet, es bleibt kein Fehler
    await page.evaluate(() => showScreen('screen-dashboard'));

    const ok = (...keys) => keys.every(k => r[k] === true);
    const werte = (keys) => keys.map(k => `${k}=${r[k]}`).join(', ');
    assert(ok('start'), `Fanszene startet mit Level 1 und ergänzt alte Stände (${werte(['start'])})`);
    assert(ok('anfeuern', 'limit', 'neuerTag'), `Aktionen: Anfeuern kostenlos, zwei Aktionen je Spieltag, Limit am nächsten Spieltag zurück (${werte(['anfeuern', 'limit', 'neuerTag'])})`);
    assert(ok('pyroLeer', 'pyro'), `Pyro: ohne Lager Hinweis, mit Lager zündet es und erhöht das Risiko (${werte(['pyroLeer', 'pyro'])})`);
    assert(ok('kasseZu', 'kaufen'), `Ausrüstung: Kassenprüfung und Kauf (${werte(['kasseZu', 'kaufen'])})`);
    assert(ok('level', 'skill'), `XP und Level, Fähigkeitspunkte steigern eine Fähigkeit (${werte(['level', 'skill'])})`);
    assert(ok('spieltag', 'monat'), `Spieltag- und Monatstick: Einnahmen, Polizeidruck sinkt (${werte(['spieltag', 'monat'])})`);
    assert(ok('staerke', 'risiko'), `Heimstärke nur daheim, Risikofaktor im Rahmen (${werte(['staerke', 'risiko'])})`);
    assert(ok('gegnerFest', 'duellStart', 'canvas', 'duellFelder'), `Duell: feste Gegnergruppe, Anreise abgebucht, Canvas 640×240, Taktik-Knöpfe (${werte(['gegnerFest', 'duellStart', 'canvas', 'duellFelder'])})`);
    assert(d.verlauf === 3 && d.ausgang === 3 && d.ergebnis !== null && d.bilanz === 1 && d.chronik && d.boxEnde,
        `Duell über drei Runden: Verlauf, Bilanz, Chronik und Endanzeige (Runden ${d.verlauf}, Ergebnis ${d.ergebnis})`);
    assert(d.nav && sichtbar, 'Menüpunkt führt zum Bildschirm, Fanszene zeigt Inhalt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.join(' | ')})`);
    await page.close();
}

module.exports = {
    testUltras,
};
