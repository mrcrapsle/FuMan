// Testsuiten: personal
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testStaffAufgabenModi(browser) {
    console.log('\n[25.45] Personal: Torwarttrainer, Physio und Pressesprecher haben wählbare Aufgaben');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        ['twTrainer', 'physio', 'pressOfficer'].forEach(k => { staffMembers[k].hired = true; });
        // Standard ohne gesetzte Aufgabe
        out.twStandard = getTwTrainerEffekt().elfmeter === 0.04 && getTwTrainerEffekt().abwehr === 0.4;
        out.physioStandard = getPhysioEffekt().ausfall === 0.5 && getPhysioEffekt().fitFaktor === 1;
        out.pressStandard = getPressOfficerEffekt().fans === getPressOfficerEffekt().vorstand && getPressOfficerEffekt().fans < 0.85;
        // Alternativmodi
        setTwTrainerTask('elfmeter');
        out.twElfmeter = staffMembers.twTrainer.task === 'elfmeter' && getTwTrainerEffekt().elfmeter === 0.07;
        setTwTrainerTask('unbekannt');
        out.ungueltigAbgelehnt = staffMembers.twTrainer.task === 'elfmeter';
        setPhysioTask('belastung');
        out.physioBelastung = getPhysioEffekt().ausfall === 0.3 && getPhysioEffekt().fitFaktor === 0.9;
        setPressOfficerTask('offensiv');
        out.pressOffensiv = getPressOfficerEffekt().vorstand === 1 && getPressOfficerEffekt().fans === 0.5;
        // Die Auswahl erscheint in der Personalliste
        renderStaffView();
        const liste = document.getElementById('staff-list-container').innerText;
        out.auswahlSichtbar = liste.includes('Elfmeter-Spezialtraining') && liste.includes('Belastungssteuerung') && liste.includes('Offensiv');
        return out;
    });
    assert(r.twStandard, 'Torwarttrainer ohne Wahl: Standardwerte (4 %, 0,4)');
    assert(r.physioStandard, 'Physio ohne Wahl: Standardwerte (Ausfall halbiert, kein Fitnessbonus)');
    assert(r.pressStandard, 'Pressesprecher ohne Wahl: Standard-Dämpfung für Vorstand und Fans');
    assert(r.twElfmeter, 'Elfmeter-Spezialtraining erhöht die Elfmeterabwehr auf 7 %');
    assert(r.ungueltigAbgelehnt, 'Eine unbekannte Aufgabe wird nicht übernommen');
    assert(r.physioBelastung, 'Belastungssteuerung: Ausfall nur um 30 % verkürzt, Fitnessverlust -10 %');
    assert(r.pressOffensiv, 'Offensiv: Vorstand trifft voll, Fans nur halb');
    assert(r.auswahlSichtbar, 'Die Aufgabenauswahl erscheint in der Personalliste');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Aufgaben');
    await page.close();
}

async function testPersonalEinstellen(browser) {
    console.log('\n[25.45] Personal einstellen: der Bewerbungspool öffnet als Fenster mitten im Bild und lässt sich direkt nutzen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.evaluate(() => { closeTutorial(); game.money = 90000000; showScreen('screen-staff'); renderStaffView(); });
    // Liste ans Ende scrollen: genau dort war der Pool vorher außer Sicht
    await page.evaluate(() => { const l = document.getElementById('staff-list-container'); l.scrollTop = l.scrollHeight; });
    const knopf = page.locator('#staff-list-container button', { hasText: 'Einstellen' }).last();
    await knopf.click();
    await page.waitForFunction(() => document.getElementById('staff-pool-overlay').classList.contains('show'), null, { timeout: 3000 }).catch(() => null);
    const fenster = await page.evaluate(() => {
        const ov = document.getElementById('staff-pool-overlay');
        const box = ov.querySelector('.generic-modal-box').getBoundingClientRect();
        const knoepfe = [...ov.querySelectorAll('button[onclick^="hireFromCandidatePool"]')];
        return { offen: ov.classList.contains('show'), imBild: box.top >= 0 && box.bottom <= window.innerHeight + 1, bewerber: knoepfe.length,
            titel: ov.querySelector('.ui-card-title')?.textContent || '', zeigtKasse: ov.innerText.includes('Kasse') };
    });
    // Abbrechen schließt ohne Einstellung
    await page.locator('#staff-pool-overlay button', { hasText: 'Abbrechen' }).click();
    const nachAbbruch = await page.evaluate(() => ({ offen: document.getElementById('staff-pool-overlay').classList.contains('show'), eingestellt: Object.keys(staffMembers).filter(k => staffMembers[k].hired).length, pool: staffCentralState.candidatePool }));
    await page.locator('#staff-list-container button', { hasText: 'Einstellen' }).last().click();
    await page.locator('#staff-pool-overlay button[onclick^="hireFromCandidatePool"]').first().click();
    const eingestellt = await page.evaluate(() => ({ anzahl: Object.keys(staffMembers).filter(k => staffMembers[k].hired).length, offen: document.getElementById('staff-pool-overlay').classList.contains('show') }));
    assert(fenster.offen && fenster.imBild, 'Nach dem Tippen auf „Einstellen“ öffnet sich das Bewerbungsfenster vollständig im sichtbaren Bereich');
    assert(fenster.bewerber === 3, `Das Fenster zeigt alle 3 Bewerber zur direkten Auswahl (${fenster.bewerber})`);
    assert(fenster.zeigtKasse && fenster.titel.length > 0, 'Das Fenster nennt die Stelle und die aktuelle Kasse');
    assert(!nachAbbruch.offen && nachAbbruch.eingestellt === 0 && nachAbbruch.pool === null, 'Abbrechen schließt das Fenster, ohne jemanden einzustellen');
    assert(eingestellt.anzahl >= 1 && !eingestellt.offen, 'Ein Bewerber lässt sich direkt im Fenster einstellen, danach schließt es');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Einstellen');
    await page.close();
}

async function testGreenkeeperAufgabe(browser) {
    console.log('\n[25.46] Greenkeeper: Rasenpflege oder Schnellrasen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        staffMembers.greenkeeper.hired = true;
        const out = {};
        out.standard = getGreenkeeperEffekt().heim === 2 && getGreenkeeperEffekt().ermuedung === 1;
        setGreenkeeperTask('tempo');
        out.tempo = getGreenkeeperEffekt().heim === 3 && getGreenkeeperEffekt().ermuedung === 1.1;
        setGreenkeeperTask('unbekannt');
        out.ungueltig = staffMembers.greenkeeper.task === 'tempo';
        renderStaffView();
        out.sichtbar = document.getElementById('staff-list-container').innerText.includes('Schnellrasen');
        return out;
    });
    assert(r.standard, 'Ohne Wahl: Heimvorteil +2 je Stufe, normale Ermüdung');
    assert(r.tempo, 'Schnellrasen: Heimvorteil +3 je Stufe, Ermüdung auf Heimspielen +10 %');
    assert(r.ungueltig, 'Eine unbekannte Greenkeeper-Aufgabe wird nicht übernommen');
    assert(r.sichtbar, 'Die Greenkeeper-Aufgabe erscheint in der Personalliste');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Greenkeeper');
    await page.close();
}

async function testPersonalEinstellenHandy(browser) {
    console.log('\n[25.46] Personal einstellen auf dem Handy (390 x 844): Fenster ohne Scrollen bedienbar, kein seitlicher Überlauf');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { closeTutorial(); game.money = 90000000; showScreen('screen-staff'); renderStaffView(); });
    await page.evaluate(() => { const l = document.getElementById('staff-list-container'); l.scrollTop = l.scrollHeight; window.scrollTo(0, document.documentElement.scrollHeight); });
    // Den Knopf selbst ins Bild holen und per Seitenskript antippen: Playwrights eigenes Scrollen vor dem Klick
    // würde sonst die Messung verfälschen, ob die Seite beim Öffnen des Fensters springt.
    const scrollVorher = await page.evaluate(() => {
        const knopf = [...document.querySelectorAll('#staff-list-container button')].filter(b => b.textContent.includes('Einstellen')).pop();
        knopf.scrollIntoView({ block: 'center' });
        return new Promise(res => {
            // Weiches Scrollen abwarten: erst messen, wenn die Position drei Bilder lang stillsteht
            let letzte = -1, still = 0;
            const schritt = () => { if (window.scrollY === letzte) still++; else { still = 0; letzte = window.scrollY; } still >= 3 ? res(window.scrollY) : requestAnimationFrame(schritt); };
            requestAnimationFrame(schritt);
        });
    });
    await page.evaluate(() => [...document.querySelectorAll('#staff-list-container button')].filter(b => b.textContent.includes('Einstellen')).pop().click());
    await page.waitForFunction(() => document.getElementById('staff-pool-overlay').classList.contains('show'), null, { timeout: 3000 }).catch(() => null);
    const r = await page.evaluate(() => {
        const ov = document.getElementById('staff-pool-overlay');
        const box = ov.querySelector('.generic-modal-box');
        const rc = box.getBoundingClientRect();
        // Alle Einstell-Knöpfe müssen ohne Scrollen im Fenster erreichbar sein (im Bild und nicht verdeckt)
        const knoepfe = [...ov.querySelectorAll('button[onclick^="hireFromCandidatePool"]')];
        const imBild = knoepfe.every(b => { const k = b.getBoundingClientRect(); return k.top >= 0 && k.bottom <= window.innerHeight; });
        return { offen: ov.classList.contains('show'), imBild, anzahl: knoepfe.length, fensterImBild: rc.top >= 0 && rc.bottom <= window.innerHeight + 1,
            scrollY: window.scrollY, ueberlauf: document.documentElement.scrollWidth > window.innerWidth,
            boxUeberlauf: box.scrollWidth > box.clientWidth + 1 };
    });
    // Tipp neben das Fenster (auf die abgedunkelte Fläche) schließt es
    await page.mouse.click(195, 8);
    const zu = await page.evaluate(() => !document.getElementById('staff-pool-overlay').classList.contains('show'));
    await page.locator('#staff-list-container button', { hasText: 'Einstellen' }).last().click();
    await page.locator('#staff-pool-overlay button[onclick^="hireFromCandidatePool"]').nth(1).click();
    const eingestellt = await page.evaluate(() => Object.keys(staffMembers).filter(k => staffMembers[k].hired).length);
    assert(r.offen && r.fensterImBild, 'Auf dem Handy öffnet sich das Bewerbungsfenster vollständig im Bild');
    assert(r.anzahl === 3 && r.imBild, 'Alle drei Einstell-Knöpfe sind direkt sichtbar, ohne Scrollen im Fenster');
    assert(r.scrollY === scrollVorher, `Die Seite springt beim Öffnen nicht (Scroll ${scrollVorher} → ${r.scrollY})`);
    assert(!r.ueberlauf && !r.boxUeberlauf, 'Auf dem Handy gibt es keinen seitlichen Überlauf im Personal-Bildschirm und im Fenster');
    assert(zu, 'Ein Tipp neben das Fenster schließt es');
    assert(eingestellt >= 1, 'Auf dem Handy lässt sich ein Bewerber im Fenster einstellen');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler auf dem Handy');
    await page.close();
}

async function testAnalystErnaehrung(browser) {
    console.log('\n[25.47] Chef-Analyst und Ernährungsberater: Vorbericht oder Tiefenanalyse, Fitness oder Leistungsküche');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        staffMembers.analyst.hired = true;
        staffMembers.nutritionist.hired = true;
        const out = {};
        out.analystStandard = getAnalystEffekt().bericht === true && getAnalystEffekt().staerke === 0;
        out.vorberichtDa = hasMatchAnalyst() === true;
        setAnalystTask('tiefe');
        out.tiefe = getAnalystEffekt().bericht === false && getAnalystEffekt().staerke === 1;
        out.keinVorbericht = hasMatchAnalyst() === false;
        setAnalystTask('unbekannt');
        out.analystUngueltig = staffMembers.analyst.task === 'tiefe';
        const lvl = getStaffLevelMultiplier('nutritionist');
        out.ernStandard = Math.abs(getNutritionistEffekt().ermuedung - (0.92 - 0.04 * lvl)) < 1e-9 && getNutritionistEffekt().staerke === 0;
        setNutritionistTask('leistung');
        out.ernLeistung = Math.abs(getNutritionistEffekt().ermuedung - (0.98 - 0.02 * lvl)) < 1e-9 && getNutritionistEffekt().staerke === 1;
        setNutritionistTask('unbekannt');
        out.ernUngueltig = staffMembers.nutritionist.task === 'leistung';
        renderStaffView();
        const liste = document.getElementById('staff-list-container').innerText;
        out.sichtbar = liste.includes('Tiefenanalyse') && liste.includes('Leistungsküche');
        return out;
    });
    assert(r.analystStandard, 'Chef-Analyst ohne Wahl: Vorbericht, kein Stärkebonus');
    assert(r.vorberichtDa, 'Mit Vorbericht ist die Gegneranalyse verfügbar');
    assert(r.tiefe, 'Tiefenanalyse: kein Vorbericht, +1 Teamstärke je Stufe');
    assert(r.keinVorbericht, 'Im Modus Tiefenanalyse ist keine Gegneranalyse mehr verfügbar');
    assert(r.analystUngueltig, 'Eine unbekannte Analyst-Aufgabe wird nicht übernommen');
    assert(r.ernStandard, 'Ernährungsberater ohne Wahl: bisheriger Fitnessverlust, kein Stärkebonus');
    assert(r.ernLeistung, 'Leistungsküche: schwächer gedämpfter Fitnessverlust, +1 Teamstärke je Stufe');
    assert(r.ernUngueltig, 'Eine unbekannte Ernährungs-Aufgabe wird nicht übernommen');
    assert(r.sichtbar, 'Beide Aufgaben erscheinen in der Personalliste');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Analyst und Ernährung');
    await page.close();
}

async function testPersonalGrundAnzeige(browser) {
    console.log('\n[25.48] Personal: wer nicht einstellbar ist, sieht den Grund beim Bewerber');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        showScreen('screen-staff');
        game.money = 1000;
        openCandidatePool('fanshopManager');
        const box = document.getElementById('staff-pool-content');
        out.kasseGrund = box.innerText.includes('Kasse zu klein');
        out.kasseDeaktiviert = [...box.querySelectorAll('button[onclick^="hireFromCandidatePool"]')].every(b => b.disabled);
        // Obergrenze: Kasse reicht, aber der Personalbudget-Cap wird gesprengt
        staffCentralState.candidatePool = null;
        game.money = 90000000;
        staffCentralState.wageBudgetCap = 1;
        openCandidatePool('marketingDir');
        const box2 = document.getElementById('staff-pool-content');
        out.capGrund = box2.innerText.includes('Obergrenze');
        out.capDeaktiviert = [...box2.querySelectorAll('button[onclick^="hireFromCandidatePool"]')].every(b => b.disabled);
        // Ohne Grund ist der Knopf aktiv
        staffCentralState.wageBudgetCap = 0;
        openCandidatePool('marketingDir');
        const box3 = document.getElementById('staff-pool-content');
        out.frei = [...box3.querySelectorAll('button[onclick^="hireFromCandidatePool"]')].some(b => !b.disabled);
        return out;
    });
    assert(r.kasseGrund, 'Bei zu wenig Geld steht beim Bewerber der Grund „Kasse zu klein“');
    assert(r.kasseDeaktiviert, 'Bei zu wenig Geld ist der Einstell-Knopf deaktiviert');
    assert(r.capGrund, 'Bei gesprengter Personalbudget-Obergrenze steht der Grund beim Bewerber');
    assert(r.capDeaktiviert, 'Bei gesprengter Obergrenze ist der Einstell-Knopf deaktiviert');
    assert(r.frei, 'Ohne Hindernis ist der Einstell-Knopf aktiv');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Grundanzeige');
    await page.close();
}

module.exports = {
    testStaffAufgabenModi,
    testPersonalEinstellen,
    testGreenkeeperAufgabe,
    testPersonalEinstellenHandy,
    testAnalystErnaehrung,
    testPersonalGrundAnzeige,
};
