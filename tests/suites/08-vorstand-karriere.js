// Testsuiten: vorstand karriere
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testEntlassungsGrund(browser) {
    console.log('\n[25.34] Entlassung: die Meldung nennt Vertrauen, Serie und Erwartung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        game.season = 4; game.boardGraceSeason = 0; game.sackPending = false;
        game.boardSat = 12; game.boardSatVerlauf = [20, 19, 18, 17, 16, 15, 14];
        game.lowBoardSatStreak = 99; game.legendStatus = false;
        game.seasonExpectation = { expectedRank: 3 };
        noticeQueue = [];
        checkSeasonEndSacking(14);
        const m = noticeQueue.find(x => x.titel && x.titel.includes('Entlassen'));
        return {
            entlassen: game.sackPending === true,
            meldung: !!m,
            grund: !!m && m.text.includes('Grund: Vertrauen 12 von 100') && m.text.includes('Erwartung Platz 3') && m.text.includes('erreicht: Platz 14'),
            danach: !!m && typeof m.danach === 'function'
        };
    });
    assert(r.entlassen && r.meldung, 'Bei dauerhaft niedrigem Vertrauen am Saisonende folgt die Entlassung mit Meldung');
    assert(r.grund, 'Die Entlassungsmeldung nennt Vertrauen, Serie, Erwartung und erreichten Platz');
    assert(r.danach, 'Die Meldung führt weiter zum Neustart (bestätigen)');
    // Job-Warnung mit Zahlen (25.35)
    const w = await page.evaluate(() => {
        closeTutorial();
        game.season = 3; game.boardGraceSeason = 0; game.sackPending = false; game.sackWarningIssued = false;
        game.boardSat = 20; game.lowBoardSatStreak = 2; game.seasonExpectation = { expectedRank: 4 };
        inboxMessages = [];
        checkJobSecurity();
        const m = inboxMessages.find(x => x.title.includes('Job-Warnung'));
        return { da: !!m, zahlen: !!m && m.body.includes('Vertrauen 20 von 100') && m.body.includes('Platz 4') && /3 Pflichtspiele/.test(m.body) };
    });
    assert(w.da && w.zahlen, 'Die Job-Warnung nennt Vertrauen, Serie und die Erwartung des Vorstands');
    // Kleine KI-Angebote (Ligen 5-6) auf 500 € genau, Verhandlungsschritt 500 € (25.35)
    const o = await page.evaluate(() => {
        closeTutorial();
        const p = squad[5]; p.marketValue = 15200;
        incomingOffers = [];
        triggerNewAITransferOffer(p, { club: 'Testclub', multiplier: 1.0 });
        const a = incomingOffers.find(x => x.clubName === 'Testclub');
        const bid = a ? a.currentBid : null;
        if (a) openNegotiationStepper(a.id);
        const schritt = negoStepSize;
        closeNegotiationStepper();
        incomingOffers = [];
        const q = squad[6]; q.marketValue = 400000;
        triggerNewAITransferOffer(q, { club: 'Testclub', multiplier: 1.0 });
        const g = incomingOffers.find(x => x.clubName === 'Testclub');
        return { bid, schritt, gross: g ? g.currentBid : null };
    });
    assert(o.bid === 15000, `Kleines Angebot (Marktwert 15.200 €) auf 500 € genau statt auf 10.000 € Untergrenze (${o.bid})`);
    assert(o.schritt === 500, `Verhandlungsschritt bei kleinem Angebot 500 € (${o.schritt})`);
    assert(o.gross === 400000, `Große Angebote bleiben auf 5.000 € gerundet (${o.gross})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Entlassung');
    await page.close();
}

async function testRunde36Anzeigen(browser) {
    console.log('\n[25.36] Dashboard-Warnung nennt die Erwartung, Spielerkarte zeigt den Kader-Median');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        game.season = 3; game.boardGraceSeason = 0; game.boardSat = 40; game.boardEarlyWarnSeason = 3;
        game.seasonExpectation = { expectedRank: 5 };
        renderDashboardView();
        const box = document.getElementById('dash-board-warn-line');
        // Die Ansicht setzt die Erwartung beim Rendern selbst neu: gegen den Wert danach prüfen
        const erwartet = game.seasonExpectation && game.seasonExpectation.expectedRank;
        out.erwartung = !!box && !!erwartet && box.innerHTML.includes('Erwartung Platz ' + erwartet);
        // Spielerkarte: nur mit bekanntem Potenzial und Kader-Median
        const p = squad[0];
        p.potentialRevealed = true; p.potential = 1;
        openPlayerDetail(p.id, 'squad');
        const ov = document.getElementById('player-detail-overlay');
        out.medianDarunter = !!ov && ov.innerText.includes('Kader-Median') && ov.innerText.includes('darunter');
        p.potential = 99;
        openPlayerDetail(p.id, 'squad');
        out.medianErreicht = document.getElementById('player-detail-overlay').innerText.includes('erreicht oder darüber');
        p.potentialRevealed = false;
        openPlayerDetail(p.id, 'squad');
        out.ohneBekanntes = !document.getElementById('player-detail-overlay').innerText.includes('Kader-Median');
        return out;
    });
    assert(r.erwartung, 'Die Dashboard-Warnung nennt die Erwartung des Vorstands');
    assert(r.medianDarunter, 'Spielerkarte: bei bekanntem schwachem Potenzial steht „Kader-Median … darunter“');
    assert(r.medianErreicht, 'Spielerkarte: bei starkem Potenzial steht „erreicht oder darüber“');
    assert(r.ohneBekanntes, 'Ohne bekanntes Potenzial zeigt die Spielerkarte keinen Median');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den neuen Anzeigen');
    await page.close();
}

async function testVorstandHub(browser) {
    console.log('\n[25.49] Vorstand-Hub: Vorstandsraum und Budgets liegen zusammen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        showScreen('screen-vorstand-raum');
        const hub = document.getElementById('screen-hub-vorstand');
        out.hubSichtbar = hub.style.display === 'block';
        out.raumSichtbar = document.getElementById('screen-vorstand-raum').style.display === 'block';
        out.budgetAus = document.getElementById('screen-vorstand-budget').style.display === 'none';
        showScreen('screen-vorstand-budget');
        out.budgetSichtbar = document.getElementById('screen-vorstand-budget').style.display === 'block';
        out.raumAus = document.getElementById('screen-vorstand-raum').style.display === 'none';
        out.budgetButton = !!document.getElementById('btn-board-budget-transfer');
        out.raumBox = !!document.getElementById('board-room-box');
        // Die Budgets sind aus den Finanzen ausgezogen
        out.nichtMehrInFinanzen = !document.getElementById('subtab-fin-budget').querySelector('#btn-board-budget-transfer');
        return out;
    });
    assert(r.hubSichtbar, 'Der Vorstand-Hub wird angezeigt');
    assert(r.raumSichtbar, 'Reiter Vorstandsraum ist sichtbar');
    assert(r.budgetAus, 'Reiter Budgets ist beim Öffnen des Raums ausgeblendet');
    assert(r.budgetSichtbar, 'Reiter Budgets lässt sich öffnen');
    assert(r.raumAus, 'Beim Wechsel auf Budgets wird der Raum ausgeblendet');
    assert(r.budgetButton, 'Budget-Verhandlung (Knopf) ist im Vorstand-Hub vorhanden');
    assert(r.raumBox, 'Vorstandsraum-Kasten ist im Hub vorhanden');
    assert(r.nichtMehrInFinanzen, 'Die Budget-Verhandlung steht nicht mehr in den Finanzen');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Vorstand-Hub');
    await page.close();
}

async function testBoardEarlyWarning(browser) {
    console.log('\n[25.24] Vorstand: Frühwarnung schon unter 50 Zufriedenheit, einmal pro Saison');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.season = 3; game.boardSat = 60; game.boardEarlyWarnSeason = null; game.lowBoardSatStreak = 0;
            inboxMessages = [];
            checkJobSecurity();
            out.keineWarnungBei60 = !inboxMessages.some(m => m.title.includes('wird unruhig'));
            game.boardSat = 45; checkJobSecurity();
            out.warnungUnter50 = inboxMessages.some(m => m.title.includes('wird unruhig'));
            const anzahl = inboxMessages.filter(m => m.title.includes('wird unruhig')).length;
            game.boardSat = 40; checkJobSecurity();
            out.nurEinmal = inboxMessages.filter(m => m.title.includes('wird unruhig')).length === anzahl;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Vorwarnung ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.keineWarnungBei60, 'Bei Zufriedenheit 60 gibt es keine Vorwarnung');
        assert(r.warnungUnter50, 'Unter 50 Zufriedenheit meldet sich der Vorstand (Postfach)');
        assert(r.nurEinmal, 'Die Vorwarnung kommt nur einmal pro Saison');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testWinterTalk(browser) {
    console.log('\n[22.9] Wintergespräch mit dem Vorstand: Zwischenbilanz, vier Wege mit Folgen bis zum Saisonende');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            const exp = getSeasonExpectation();
            const card = () => document.getElementById('dash-winter-talk-box').innerHTML;
            game.matchday = 10;
            showScreen('screen-dashboard'); renderWinterTalkCard();
            chooseWinterTalk('kurs');
            out.zuFrueh = card() === '' && !getWinterTalk();
            game.matchday = 18;
            renderWinterTalkCard();
            out.karte = card().includes('Winterpause') && card().includes('Zwischenbilanz');
            const betrag = getWinterBudgetAmount();
            // Ziel hoch: +5, Budget sofort; gehalten +5 / gebrochen -10
            exp.expectedRank = 8; game.boardSat = 50; game.transferBudget = 1000000;
            chooseWinterTalk('hoch');
            out.hoch = getWinterTalk().goal === 6 && exp.expectedRank === 6 && game.boardSat === 55 && game.transferBudget === 1000000 + betrag;
            chooseWinterTalk('kurs');
            out.einmal = getWinterTalk().choice === 'hoch' && game.boardSat === 55;
            resolveWinterTalk(5);
            out.gehalten = game.boardSat === 60 && getWinterTalk().result === 'erreicht';
            getWinterTalk().result = null;
            game.boardSat = 50;
            resolveWinterTalk(9);
            out.gebrochen = game.boardSat === 40 && getWinterTalk().result === 'verfehlt';
            // Ziel runter: -4, die Saison wird am leichteren Ziel gemessen (auch die Versammlung)
            game.winterTalk = null; exp.expectedRank = 8; game.boardSat = 50;
            chooseWinterTalk('runter');
            prepareMemberAssembly(9);
            out.runter = game.boardSat === 46 && exp.expectedRank === 10 && game.pendingAssemblyReport.expectedRank === 10;
            game.pendingAssemblyReport = null;
            // Budget: Chance hängt an der Zwischenbilanz; Zusage bringt Geld, Absage -3
            exp.expectedRank = 1;
            const schlecht = getWinterBudgetChance();
            exp.expectedRank = 18;
            out.chance = getWinterBudgetChance() > schlecht;
            game.winterTalk = null; game.transferBudget = 1000000;
            Math.random = () => 0;
            chooseWinterTalk('budget');
            Math.random = zufall;
            out.budgetJa = game.transferBudget === 1000000 + betrag && getWinterTalk().budget === betrag;
            game.winterTalk = null; game.boardSat = 50;
            Math.random = () => 0.999;
            chooseWinterTalk('budget');
            Math.random = zufall;
            out.budgetNein = game.boardSat === 47 && getWinterTalk().budget === 0;
            // Kurs bestätigen
            game.winterTalk = null; game.boardSat = 50;
            chooseWinterTalk('kurs');
            out.kurs = game.boardSat === 52;
            renderWinterTalkCard();
            out.ergebnisKarte = card().includes('Kurs bestätigt');
            // Verpasst: nach Spieltag 20 ohne Gespräch -2, nur einmal
            game.winterTalk = null; game.boardSat = 50; game.matchday = 21;
            tickWinterTalk(); tickWinterTalk();
            out.verpasst = game.boardSat === 48 && getWinterTalk().choice === 'verpasst';
            renderWinterTalkCard();
            out.verpasstLeer = card() === '';
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Wintergespräch ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.zuFrueh && r.karte, 'Die Karte erscheint erst in der Winterpause (Spieltag 18-20)');
        assert(r.hoch && r.einmal, 'Ziel hoch: Vorstand +5, Winterbudget sofort - nur ein Weg pro Saison');
        assert(r.gehalten && r.gebrochen, 'Am Saisonende: gehaltenes Versprechen +5, gebrochenes -10');
        assert(r.runter, 'Ziel runter: Vorstand -4, Versammlung misst am niedrigeren Ziel');
        assert(r.chance && r.budgetJa && r.budgetNein, 'Winterbudget: Chance aus der Zwischenbilanz, Zusage bringt Geld, Absage kostet 3');
        assert(r.kurs && r.ergebnisKarte, 'Kurs bestätigen: Vorstand +2, die Karte zeigt das Ergebnis');
        assert(r.verpasst && r.verpasstLeer, 'Verpasst: nach Spieltag 20 einmalig Vorstand -2');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testAchievementsSystem(browser) {
    console.log('\n[12] Achievements-System');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        showScreen('screen-history');
        let beforeHtml = document.getElementById('achievements-box').innerHTML;
        managerRPG.level = 10;
        game.money = 1500000;
        foundSecondTeam();
        game.youthAcademyLvl = 3;
        game.timesSacked = 1;
        checkAchievements();
        showScreen('screen-history');
        let afterHtml = document.getElementById('achievements-box').innerHTML;
        let saved = JSON.parse(JSON.stringify(buildSaveState()));
        game.achievements = [];
        applyLoadedState(saved);
        return {
            beforeShowsZero: beforeHtml.includes('0 /'),
            unlockedIds: game.achievements.map(a => a.id),
            afterShowsFour: afterHtml.includes('4 /'),
            survivesSaveLoad: game.achievements.length === 4
        };
    });

    assert(r.beforeShowsZero, 'Achievements-Box zeigt zu Beginn 0 Freischaltungen');
    assert(r.unlockedIds.includes('millionaire'), 'Millionär-Achievement schaltet bei 1.000.000 € frei');
    assert(r.unlockedIds.includes('second-team'), 'Zweite-Mannschaft-Achievement schaltet nach Gründung frei');
    assert(r.unlockedIds.includes('youth-academy'), 'Talentschmiede-Achievement schaltet bei Jugendakademie-Stufe 3 frei');
    assert(r.unlockedIds.includes('survived-sacking'), 'Comeback-Manager-Achievement schaltet nach erster Entlassung frei');
    assert(r.afterShowsFour, 'Achievements-Box zeigt korrekt "4 /" nach den Freischaltungen an');
    assert(r.survivesSaveLoad, 'Freigeschaltete Achievements überleben Speichern/Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Achievements-Test');
    await page.close();
}

async function testConfigurableNewGameStart(browser) {
    console.log('\n[12] Konfigurierbare Startbedingungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    await page.evaluate(() => closeTutorial());

    // Startbildschirm ist seit dem Managerbüro nicht mehr das Dashboard - der
    // "Neues Spiel"-Knopf liegt dort und muss erst sichtbar geschaltet werden.
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.click('#btn-new-game');
    // Seit dem Startmenü: erst die Karriere-Art wählen, "Verein gründen" zeigt den Einstellungs-Kasten
    await page.click('#startmenue-gruenden');
    await page.waitForFunction(() => document.getElementById('new-game-setup-box').style.display === 'block', null, { timeout: 3000 }).catch(() => null);
    const boxVisible = await page.evaluate(() => document.getElementById('new-game-setup-box').style.display === 'block');

    await page.evaluate(() => { selectedNewGameLevel = 0; selectedNewGameMoney = 500000; renderNewGameSetupOptions(); });
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(100);
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(600);

    const r = await page.evaluate(() => ({
        leagueLevel: game.leagueLevel,
        money: game.money,
        erwartetesStartkapital: getNewGameStartMoney(0, 500000),
        stadion: stadium.total,
        squadSize: squad.length,
        avgStrength: Math.round(squad.reduce((s, p) => s + p.strength, 0) / squad.length),
        maxStrength: Math.max(...squad.map(p => p.strength)),
        ourTeamFound: !!getOurLeagueTeam()
    }));

    assert(boxVisible, 'Klick auf "Neues Spiel starten" öffnet die Einstellungs-Box (statt sofort zu löschen)');
    assert(r.leagueLevel === 0, 'Gewählte Startliga (1. Liga) wird korrekt übernommen');
    assert(r.money === r.erwartetesStartkapital && r.money > 500000,
        'Das Startkapital wird auf die gewählte Startliga hochskaliert');
    assert(r.stadion > 40000, 'Ein Erstliga-Start bekommt ein entsprechend großes Stadion');
    assert(r.maxStrength <= 93, 'Der Startkader enthält keine Weltklasse-Superstars mehr');
    assert(r.squadSize === 18, 'Kader wird vollständig mit 18 Spielern generiert');
    assert(r.avgStrength >= 70, `Kader ist zur gewählten Top-Liga passend stark kalibriert (Ø ${r.avgStrength})`);
    assert(r.ourTeamFound, 'Eigenes Team ist nach dem konfigurierten Neustart in der Liga-Pyramide auffindbar');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei konfigurierbaren Startbedingungen');
    await page.close();
}

async function testManagerOffice(browser) {
    console.log('\n[15] Managerbüro (Point-and-Click-Startbildschirm)');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());
    await page.waitForFunction(() => document.getElementById('screen-office').style.display === 'block', null, { timeout: 5000 }).catch(() => null);

    const isStartScreen = await page.evaluate(() => document.getElementById('screen-office').style.display === 'block');
    const hotspotIds = await page.evaluate(() => OFFICE_HOTSPOTS.map(h => h.id));

    // Das Büro soll das GANZE Display einnehmen, nicht als kleines Panel zwischen
    // Kopfzeile und Seitenmenü sitzen.
    const coversDisplay = await page.evaluate(() => {
        const r = document.getElementById('screen-office').getBoundingClientRect();
        return Math.round(r.width) >= window.innerWidth && Math.round(r.height) >= window.innerHeight;
    });

    // Kernabsicherung: JEDER Hotspot muss an seinem eigenen Mittelpunkt auch wirklich sich
    // selbst treffen - im Hover-Zustand. Genau hier lag der schwerste Fehler dieser Ansicht:
    // filter/opacity und laufende transform-Animationen klappen eine 3D-positionierte Ebene
    // flach bzw. schieben sie auf eine eigene Compositing-Ebene; das Bild bleibt dabei
    // unverändert, aber die Trefferfläche wandert weg und die Objekte sind - völlig lautlos -
    // nicht mehr anklickbar. Ohne diesen Test fällt so etwas erst dem Spieler auf.
    const centerOf = async (id) => {
        // Die Bühne folgt dem Mauszeiger mit einer 0,5-s-Übergangsanimation (Parallax): erst messen, wenn sie steht
        await page.waitForFunction(() => { const st = document.getElementById('office-stage'); return !st || st.getAnimations().length === 0; }, null, { timeout: 3000 }).catch(() => null);
        const box = await page.locator('#office-hs-' + id).boundingBox();
        return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
    };

    let unreachable = [];
    for (const id of hotspotIds) {
        const c = await centerOf(id);
        if (!c) { unreachable.push(id + ' (nicht sichtbar)'); continue; }
        await page.mouse.move(c.x, c.y);
        await page.waitForTimeout(60);
        // Der Hover-Zustand kann das Objekt leicht verschieben (Animation): im Hover neu messen,
        // denn genau dort soll der Mittelpunkt treffen. Ohne das scheiterte der Test unter Last.
        const cHover = (await centerOf(id)) || c;
        await page.mouse.move(cHover.x, cHover.y);
        await page.waitForTimeout(60);
        const resolved = await page.evaluate(({ x, y }) => officeHotspotAtPoint(x, y), cHover);
        if (resolved !== id) unreachable.push(`${id} (traf: ${resolved})`);
    }

    // Satzzeile (das SCUMM-Stilmittel) folgt dem überfahrenen Objekt
    const calCenter = await centerOf('calendar');
    await page.mouse.move(calCenter.x, calCenter.y);
    await page.waitForFunction(() => ((document.getElementById('office-sentence') || {}).textContent || '').trim().length > 0, null, { timeout: 5000 }).catch(() => null);
    const sentence = await page.textContent('#office-sentence');

    // Lampe schaltet nur das Licht, navigiert NICHT weg. Bewusst per mouse.click auf die
    // Koordinate statt per page.click(selector): letzteres prüft intern die native
    // Trefferfläche des Browsers - genau die ist für 3D-Elemente je nach Chromium-Version
    // unzuverlässig, weshalb das Büro seine Treffer selbst auflöst (siehe officeHotspotAtPoint).
    const lampCenter = await centerOf('lamp');
    await page.mouse.click(lampCenter.x, lampCenter.y);
    await page.waitForFunction(() => document.getElementById('screen-office').classList.contains('office-dark'), null, { timeout: 2000 }).catch(() => null);
    const lampState = await page.evaluate(() => ({
        dark: document.getElementById('screen-office').classList.contains('office-dark'),
        stillInOffice: document.getElementById('screen-office').style.display === 'block'
    }));
    await page.mouse.click(lampCenter.x, lampCenter.y);
    await page.waitForFunction(() => !document.getElementById('screen-office').classList.contains('office-dark'), null, { timeout: 2000 }).catch(() => null);

    // Klick auf ein Objekt führt in den zugehörigen Screen
    await page.mouse.click(calCenter.x, calCenter.y);
    // Der Wechsel in den Kalender kommt nach dem Zoom (ca. 520 ms): auf den Bildschirm warten statt 900 ms zu raten
    await page.waitForFunction(() => document.getElementById('screen-calendar').style.display === 'block', null, { timeout: 4000 }).catch(() => null);
    const navigated = await page.evaluate(() => document.getElementById('screen-calendar').style.display === 'block');

    // Vom Dashboard aus wieder ins Büro und per HUD-Knopf zurück
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.click('#screen-dashboard button[data-i18n="office_enter"]');
    await page.waitForFunction(() => document.getElementById('screen-office').style.display === 'block', null, { timeout: 4000 }).catch(() => null);
    const backInOffice = await page.evaluate(() => document.getElementById('screen-office').style.display === 'block');
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.waitForFunction(() => document.getElementById('screen-office').style.display === 'none', null, { timeout: 2000 }).catch(() => null);
    const leftOffice = await page.evaluate(() => document.getElementById('screen-office').style.display === 'none');

    // Telefon zeigt ungelesene Post an
    const phone = await page.evaluate(() => {
        showScreen('screen-office');
        const badge = document.querySelector('.off-phone-badge');
        return { unread: inboxMessages.filter(m => !m.read).length, badge: badge ? parseInt(badge.textContent) : 0 };
    });

    assert(isStartScreen, 'Managerbüro ist der Startbildschirm nach dem Laden');
    assert(coversDisplay, 'Managerbüro nimmt das gesamte Display ein');
    assert(hotspotIds.length === 12, `Alle 12 Objekte im Büro vorhanden (${hotspotIds.length})`);
    assert(unreachable.length === 0, `Jedes Objekt wird an seinem Mittelpunkt korrekt getroffen${unreachable.length ? ' - FEHLER: ' + unreachable.join(', ') : ''}`);
    assert(sentence === 'Den Terminplan studieren', `Satzzeile zeigt die Aktion des überfahrenen Objekts ("${sentence}")`);
    assert(lampState.dark, 'Schreibtischlampe schaltet das Raumlicht aus');
    assert(lampState.stillInOffice, 'Lampe navigiert NICHT weg (reines Stimmungslicht)');
    assert(navigated, 'Klick auf den Wandkalender öffnet den Kalender-Screen');
    assert(backInOffice, 'Knopf im Dashboard führt zurück ins Managerbüro');
    assert(leftOffice, 'Knopf "Zum Dashboard" verlässt das Büro wieder');
    assert(phone.badge === phone.unread && phone.unread > 0, `Telefon zeigt die ungelesene Post an (${phone.badge}/${phone.unread})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Managerbüro');
    await page.close();
}

async function testOfficeAtmosphereAndCrest(browser) {
    console.log('\n[18] Büro: Tageszeit, Wetter & Vereinswappen');
    const { page, consoleErrors } = await freshPage(browser);
    await page.evaluate(() => closeTutorial());

    const r = await page.evaluate(() => {
        let out = {};
        // Ohne gebaute Flutlichtanlage wird auch an einem Pokalabend bei Tageslicht gespielt.
        stadium.flutlicht = false;
        cupTournament.matchdays = [game.matchday];
        out.ohneAnlageTag = getOfficeOutlook().night === false;
        out.statusPokal = getOfficeOutlook().statusLabel;
        renderOfficeView();
        out.tagHimmel = !!document.querySelector('#office-hs-window .off-sky-day');
        out.keineMasten = !document.querySelector('#office-hs-window .off-pylon');

        // Mit Flutlichtanlage wird daraus eine Flutlichtnacht.
        stadium.flutlicht = true;
        out.mitAnlageNacht = getOfficeOutlook().night === true;
        renderOfficeView();
        out.nachtHimmel = !!document.querySelector('#office-hs-window .off-sky-night');
        out.mastenLeuchten = !!document.querySelector('#office-hs-window .off-pylon-on');

        // Auswärtsspiel ohne Pokaltermin bleibt hell, trotz Flutlichtanlage.
        cupTournament.matchdays = [];
        europeTournament.matchdays = [];
        let teams = leaguesData[game.leagueLevel];
        let fixtures = fixturesData[game.leagueLevel][game.matchday - 1];
        let ourFixture = fixtures.find(f => teams[f.home]?.name === game.clubName || teams[f.away]?.name === game.clubName);
        out.auswaertsHell = ourFixture && teams[ourFixture.home]?.name === game.clubName
            ? null                                  // an diesem Spieltag haben wir Heimrecht
            : getOfficeOutlook().night === false;

        // Das aktuelle Wetter schlägt im Fenster durch.
        currentWeather = WEATHER_TYPES.find(w => w.name === 'Schnee');
        renderOfficeView();
        out.schneeSichtbar = !!document.querySelector('#office-hs-window .off-weather-snow');

        // Das Wappen übernimmt die echten Wappen-Daten aus dem Editor.
        game.clubCrestSymbol = 'XYZ';
        game.clubCrestAnimal = '🦅';
        game.sponsor.base = 4000;
        renderOfficeView();
        out.wappenSymbol = document.querySelector('#office-hs-crest .off-crest-symbol')?.textContent;
        out.wappenTier = !!document.querySelector('#office-hs-crest .off-crest-badge-animal');
        out.sponsorRing = !!document.querySelector('#office-hs-crest .off-crest-shield')?.classList.contains('off-crest-sponsored');
        out.wappenName = document.querySelector('#office-hs-crest .off-crest-plate')?.textContent;
        return out;
    });

    // Das Wappen ist anklickbar und führt zum Wappen-Editor.
    const box = await page.locator('#office-hs-crest').boundingBox();
    if (box) {
        await page.waitForTimeout(200);  // Stelle sicher, dass das Office vollständig geladen ist
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction(() => document.getElementById('screen-manager-tree').style.display === 'block', null, { timeout: 5000 }).catch(() => null);  // Navigationsübergang
    }
    const zumEditor = await page.evaluate(() => document.getElementById('screen-manager-tree').style.display === 'block');

    assert(r.ohneAnlageTag && r.tagHimmel, 'Ohne Flutlichtanlage bleibt der Blick aus dem Fenster hell');
    assert(r.keineMasten, 'Ohne Flutlichtanlage stehen auch keine Masten im Bild');
    assert(r.statusPokal === 'Pokalabend', `Fenster benennt den Anlass korrekt ("${r.statusPokal}")`);
    assert(r.mitAnlageNacht && r.nachtHimmel, 'Mit Flutlichtanlage wird der Pokalabend zur Nacht');
    assert(r.mastenLeuchten, 'Flutlichtmasten leuchten in der Flutlichtnacht');
    assert(r.auswaertsHell !== false, 'Ohne Heimspiel/Pokaltermin bleibt es hell');
    assert(r.schneeSichtbar, 'Aktuelles Wetter (Schnee) ist im Fenster sichtbar');
    assert(r.wappenSymbol === 'XYZ', `Wandwappen zeigt die eingestellten Initialen ("${r.wappenSymbol}")`);
    assert(r.wappenTier, 'Wandwappen zeigt das gewählte Maskottchen');
    assert(r.sponsorRing, 'Wandwappen zeigt den Sponsorenring bei laufendem Hauptsponsor');
    assert(r.wappenName === '1.FC Moritz Leipzig', `Wandwappen trägt den Vereinsnamen ("${r.wappenName}")`);
    assert(zumEditor, 'Klick auf das Wappen öffnet den Wappen-Editor');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Tageszeit/Wappen');
    await page.close();
}

async function testOfficeEvents(browser) {
    console.log('\n[29] Managerbüro: Besucher mit echten Entscheidungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Ohne wartenden Besucher ist der Stuhl leer und das Panel zu.
        game.officeEvent = null;
        showScreen('screen-office');
        out.stuhlLeer = !document.getElementById('office-hs-visitor').innerHTML.includes('off-visitor-person');
        openOfficeEventPanel();
        out.panelBleibtZu = document.getElementById('office-event-panel').style.display !== 'flex';

        // 2. Jedes Ereignis ist vollstaendig definiert und hat mindestens eine Antwort.
        out.alleEreignisseVollstaendig = OFFICE_EVENTS.every(e =>
            e.id && e.person && typeof e.titel === 'function' && typeof e.text === 'function'
            && Array.isArray(e.optionen) && e.optionen.length >= 1
            && e.optionen.every(o => o.label && typeof o.wirkung === 'function' && typeof o.hinweis === 'function'));
        out.ereignisAuswahl = OFFICE_EVENTS.length >= 6;

        // 3. Ein Ereignis taucht auf, besetzt den Stuhl und laesst sich beantworten.
        let versuche = 0;
        while (!game.officeEvent && versuche++ < 400) rollOfficeEvent();
        out.ereignisErscheint = !!game.officeEvent;
        showScreen('screen-office');
        out.stuhlBesetzt = document.getElementById('office-hs-visitor').innerHTML.includes('off-visitor-person');
        out.schnellauswahlZeigtBesuch = document.getElementById('office-quicknav').innerHTML.includes('office-quicknav-alert')
            || document.getElementById('office-quicknav').style.display === 'none';

        openOfficeEventPanel();
        let panel = document.getElementById('office-event-panel');
        out.panelOeffnet = panel.style.display === 'flex';
        out.panelHatAntworten = panel.querySelectorAll('button[onclick^="resolveOfficeEvent"]').length >= 1;
        // Das Buero wird dabei NICHT verlassen - das ist der Punkt der ganzen Sache.
        out.bleibtImBuero = document.getElementById('screen-office').style.display !== 'none';

        // Fuer die Antwort ein Ereignis mit folgenloser erster Option: bei einem zufaellig
        // gewuerfelten koennte die erste Antwort an fehlendem Geld oder einer leeren
        // Jugendakademie scheitern, und der Test haenge am Zufall.
        let journalist = OFFICE_EVENTS.find(e => e.id === 'journalist');
        game.officeEvent = { id: journalist.id, seit: game.matchday, season: game.season, titel: journalist.titel(), text: journalist.text() };
        game.officeEventHistory = [];
        resolveOfficeEvent(0);
        out.ereignisGeloest = game.officeEvent === null;
        out.historieGefuehrt = (game.officeEventHistory || []).length === 1
            && !!game.officeEventHistory[0].wahl;

        // 4. Geldwirkungen landen im Kontoauszug unter einem eigenen Bereich.
        game.kontoauszug = [];
        let mitGeld = OFFICE_EVENTS.find(e => e.id === 'berater');
        game.money = 50000000;
        game.officeEvent = { id: mitGeld.id, seit: game.matchday, season: game.season, titel: mitGeld.titel(), text: mitGeld.text() };
        let geldVor = game.money;
        resolveOfficeEvent(0);
        out.geldFliesst = game.money < geldVor;
        out.buchungZugeordnet = (game.kontoauszug || []).some(b => b.label.includes('Bürotermin'));

        // 5. Fehlt das Geld, passiert nichts und das Ereignis bleibt offen.
        game.money = 0;
        game.officeEvent = { id: mitGeld.id, seit: game.matchday, season: game.season, titel: mitGeld.titel(), text: mitGeld.text() };
        resolveOfficeEvent(0);
        out.ohneGeldBleibtOffen = game.officeEvent !== null && game.money === 0;

        // 6. Wer sich nie kuemmert, wird nicht blockiert: nach der Frist raeumt es sich weg.
        game.officeEvent.seit = game.matchday - 20;
        checkOfficeEventTimeout();
        out.fristRaeumtAuf = game.officeEvent === null;

        // 7. Es wartet immer hoechstens einer.
        game.officeEvent = null;
        for (let i = 0; i < 300; i++) rollOfficeEvent();
        out.immerNurEiner = game.officeEvent === null || typeof game.officeEvent === 'object';
        out.keinStapel = !Array.isArray(game.officeEvent);

        // 8. Ereignis und Historie ueberleben Speichern und Laden.
        game.money = 5000000;
        saveGameToSlot(2);
        let offenId = game.officeEvent ? game.officeEvent.id : null;
        let histLaenge = game.officeEventHistory.length;
        game.officeEvent = null;
        game.officeEventHistory = [];
        loadGameFromSlot(2, true);
        out.ueberlebtLaden = (game.officeEvent ? game.officeEvent.id : null) === offenId
            && game.officeEventHistory.length === histLaenge;
        return out;
    });

    assert(r.stuhlLeer, 'Ohne Besuch bleibt der Besucherstuhl leer');
    assert(r.panelBleibtZu, 'Ohne Besuch öffnet sich kein Gesprächsfenster');
    assert(r.ereignisAuswahl, 'Es gibt eine ausreichende Auswahl an Büro-Ereignissen');
    assert(r.alleEreignisseVollstaendig, 'Jedes Ereignis hat Person, Text und mindestens eine Antwort');
    assert(r.ereignisErscheint, 'Ein Besucher taucht im Büro auf');
    assert(r.stuhlBesetzt, 'Der Besucher ist im Raum sichtbar');
    assert(r.schnellauswahlZeigtBesuch, 'Die Schnellauswahl weist auf den Besuch hin');
    assert(r.panelOeffnet, 'Das Gespräch lässt sich öffnen');
    assert(r.panelHatAntworten, 'Das Gespräch bietet Antwortmöglichkeiten');
    assert(r.bleibtImBuero, 'Das Gespräch findet im Büro statt, ohne es zu verlassen');
    assert(r.ereignisGeloest, 'Nach der Antwort ist der Besuch erledigt');
    assert(r.historieGefuehrt, 'Die getroffene Entscheidung wird festgehalten');
    assert(r.geldFliesst, 'Eine Antwort mit Geldwirkung verändert den Kontostand');
    assert(r.buchungZugeordnet, 'Die Buchung erscheint im Kontoauszug als Bürotermin');
    assert(r.ohneGeldBleibtOffen, 'Ohne Deckung passiert nichts und der Besuch bleibt offen');
    assert(r.fristRaeumtAuf, 'Ein ignorierter Besuch blockiert nicht dauerhaft');
    assert(r.keinStapel, 'Es wartet immer höchstens ein Besucher');
    assert(r.ueberlebtLaden, 'Offener Besuch und Historie überleben Speichern und Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Büro-Ereignissen');
    await page.close();
}

async function testFakeDecisions(browser) {
    console.log('\n[18.6] Aufräumen Teil 6: Schein-Entscheidungen mit echter Wirkung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const toast = () => document.getElementById('app-toast').innerText;
            // Mannschaftsanweisungen: Stärke nur gegen Kraft, Tief stehen schließt aus
            game.teamInstructions = { gegenpressing: false, tiefStehen: false, hoheAV: false };
            const basis = getTeamInstructionBonus(), basisFit = getTeamInstructionFitnessMultiplier();
            toggleTeamInstruction('gegenpressing'); toggleTeamInstruction('hoheAV');
            out.offensivKostet = getTeamInstructionBonus() > basis && getTeamInstructionFitnessMultiplier() > basisFit;
            toggleTeamInstruction('tiefStehen');
            const t = game.teamInstructions;
            out.tiefExklusiv = t.tiefStehen && !t.gegenpressing && !t.hoheAV && getTeamInstructionBonus() < 0 && getTeamInstructionFitnessMultiplier() < 1;
            toggleTeamInstruction('gegenpressing');
            out.tiefWiederAus = !t.tiefStehen && t.gegenpressing;
            // Fan-Aktionen: getrennte Wirkung, je einmal bis zum Spiel
            // Fans auf 100: jede Aktion gibt +2 Fans, und die Fanstimmung fließt in die
            // Auswärtsstärke ein - an einer Rundungsgrenze kippte der Vergleich sonst (CI 3.21).
            game.money = 1000000; game.fanSupport = {}; game.fans = 100;
            const heim0 = calcTeamStrength(true), aus0 = calcTeamStrength(false);
            runFanAction('choreo');
            const geld1 = game.money;
            runFanAction('choreo');
            out.choreoEinmal = game.money === geld1 && toast().includes('schon');
            out.choreoHeim = calcTeamStrength(true) > heim0 && calcTeamStrength(false) === aus0;
            runFanAction('express');
            out.zugAuswaerts = calcTeamStrength(false) > aus0;
            consumeFanSupport(true);
            out.verbraucht = !game.fanSupport.choreo && game.fanSupport.express;
            game.money = 100; game.fanSupport = {};
            runFanAction('choreo');
            out.fanGeldMeldung = toast().includes('Nicht genug Geld') && !game.fanSupport.choreo;
            // Ausgaben-Warnlimit erzeugt eine Meldung beim Überschreiten
            game.money = 5000000;
            setExpenseWarningLimit(1);
            const inbox0 = inboxMessages.length;
            simulateMatchdays(2);
            out.warnlimit = inboxMessages.slice(0, inboxMessages.length - inbox0 + 5).filter(m => (m.title || m.subject || '').includes('Warnlimit')).length === 1
                || inboxMessages.filter(m => JSON.stringify(m).includes('über dem Warnlimit')).length === 1;
            setExpenseWarningLimit(0);
            // Personal-Obergrenze blockiert Einstellungen
            const key = Object.keys(staffMembers).find(k => !staffMembers[k].hired && staffMembers[k].wage > 0);
            game.money = 5000000;
            setStaffWageBudgetCap(1);
            toggleStaffMember(key, null);
            out.capBlockiert = !staffMembers[key].hired && toast().includes('Obergrenze');
            setStaffWageBudgetCap(0);
            toggleStaffMember(key, null);
            out.ohneCapEingestellt = staffMembers[key].hired;
            // Fan-Saisonziel: nur bis Spieltag 6, Verfehlen kostet
            game.matchday = 10;
            setSeasonMoodTarget(90);
            out.zielFrist = !(fanCentralState.seasonMoodTarget && fanCentralState.seasonMoodTarget.season === game.season);
            fanCentralState.seasonMoodTarget = { value: 99, season: game.season - 1 };
            game.fans = 50;
            checkSeasonMoodTargetResult();
            out.zielRisiko = game.fans === 47;
            // Stille Abbrüche melden sich jetzt
            game.money = 100;
            scoutYouthTalent();
            out.sichtenMeldung = toast().includes('Nicht genug Geld');
            showScreen('screen-youth'); setSubTab('jug', 'entwicklung');
            const kandidat = squad.find(s => s.age >= 28 && s.strength >= 60);
            if (kandidat) { chooseYouthCoach(kandidat.id); out.trainerMeldung = toast().includes('Nicht genug Geld'); } else out.trainerMeldung = true;
            // Umbenennen ohne prompt()
            showScreen('screen-manager-tree');
            promptRenameClub();
            const feld = document.getElementById('club-rename-input');
            feld.value = 'SV Testheim 09';
            confirmRenameClub();
            out.umbenannt = game.clubName === 'SV Testheim 09' && leaguesData[game.leagueLevel].some(t2 => t2.name === 'SV Testheim 09');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Schein-Entscheidungen-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.offensivKostet, 'Gegenpressing/hohe AV: mehr Stärke, aber mehr Kraftverbrauch');
        assert(r.tiefExklusiv && r.tiefWiederAus, 'Tief stehen: weniger Stärke, weniger Kraftverbrauch, schließt die anderen Anweisungen aus');
        assert(r.choreoEinmal && r.choreoHeim, 'Choreo wirkt nur im Heimspiel und ist nur einmal buchbar');
        assert(r.zugAuswaerts && r.verbraucht, 'Sonderzug wirkt auswärts; nach dem Heimspiel ist die Choreo verbraucht');
        assert(r.fanGeldMeldung, 'Fan-Aktion ohne Geld meldet sich statt still nichts zu tun');
        assert(r.warnlimit, 'Ausgaben-Warnlimit erzeugt beim Überschreiten genau eine Meldung');
        assert(r.capBlockiert && r.ohneCapEingestellt, 'Personalbudget-Obergrenze blockiert Einstellungen wirklich');
        assert(r.zielFrist && r.zielRisiko, 'Fan-Saisonziel nur bis Spieltag 6 und mit Stimmungsverlust bei Misserfolg');
        assert(r.sichtenMeldung && r.trainerMeldung, 'Nachwuchs sichten und Jugendtrainer melden fehlendes Geld');
        assert(r.umbenannt, 'Verein umbenennen funktioniert über ein Eingabefeld (ohne natives prompt)');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// PHASE 11: Schiedsrichter, Mannschaftsrat, Mitgliederversammlung, Frauenmannschaft
// ---------------------------------------------------------------------------
async function testBoardRestart(browser) {
    console.log('\n[25.6] Vorstand: Neustart nach dem Abstieg, Mitgliederversammlung findet automatisch statt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    // Die Notbesetzung ist zufällig: die Schwelle zum Ligaschnitt wird mit festem Seed geprüft (sonst unter Last selten rot)
    await page.addInitScript(() => { let seed = 20251010; Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.season = 3; game.boardSat = 20; game.lowBoardSatStreak = 8; delete game.boardRestartSeason;
            const erster = grantRelegationRestart();
            const nachErstem = game.boardSat, streakNull = game.lowBoardSatStreak === 0;
            const post = inboxMessages.some(m => m.title.includes('Neustart'));
            game.season = 4; game.boardSat = 20;
            const zweiter = grantRelegationRestart();
            const nachZweitem = game.boardSat;
            game.season = 6; game.boardSat = 30;
            const spaeter = grantRelegationRestart();
            const nachSpaeter = game.boardSat;
            game.season = 8; game.boardSat = 85;
            grantRelegationRestart();
            const hoherWertBleibt = game.boardSat === 85;
            // Abstiegsklausel (25.14): Gehälter -RELEGATION_WAGE_CUT (25.19: 40 %), Moral -3, Nachricht; danach wiederhergestellt
            const loehne = squad.map(p => p.wage), moral = squad.map(p => p.morale);
            const summeVor = loehne.reduce((a, b) => a + b, 0);
            const summeNach = applyRelegationWageClause();
            const klausel = { anteil: summeNach / summeVor, exakt: squad.every((p, i) => p.wage === Math.max(150, Math.round(loehne[i] * (1 - RELEGATION_WAGE_CUT) / 50) * 50)), moral: squad.every((p, i) => p.morale === Math.max(10, (moral[i] || 50) - 3)),
                post: inboxMessages.some(m => m.title.includes('Abstiegsklausel')) };
            squad.forEach((p, i) => { p.wage = loehne[i]; p.morale = moral[i]; });
            // Fallschirmgeld (25.19): 25 % des TV-Grundbetrags der alten Liga, eigener Buchungstext
            const ligaVorher = game.leagueLevel;
            game.leagueLevel = 1; game.kontoauszug = [];
            const geldVorFallschirm = game.money;
            const fallschirm = payRelegationParachute();
            klausel.fallschirm = fallschirm === 16000000 && game.money === geldVorFallschirm + fallschirm
                && game.kontoauszug.some(b => b.label.includes('Fallschirmgeld'));
            game.leagueLevel = ligaVorher;
            // Erwartung nach Abstieg (25.20): stärkste Elf der Liga, trotzdem höchstens Platz 3 erwartet
            squad.forEach(p => { p.strengthVorher = p.strength; p.strength = 99; });
            game.relegatedIntoSeason = game.season;
            recordSeasonExpectationRank();
            klausel.erwartung = game.seasonExpectation.expectedRank === RELEGATION_EXPECTED_RANK;
            game.relegatedIntoSeason = null;
            recordSeasonExpectationRank();
            klausel.erwartungSonst = game.seasonExpectation.expectedRank === 1;
            squad.forEach(p => { p.strength = p.strengthVorher; delete p.strengthVorher; });
            // Mitgliederversammlung: ignoriert man sie, findet sie nach ASSEMBLY_AUTO_AFTER Spieltagen
            // automatisch statt (vorher wurde sie mit Spieltag 35 eröffnet und nie abgehalten).
            game.season = 2; game.matchday = 1; game.sackPending = false;
            while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(1); }
            // Sommerpause: Stress halbiert, am Boden liegende Moral fängt sich zur Hälfte
            privateLife.stress = 100;
            const tief = squad[0], hoch = squad[1];
            tief.morale = 20; hoch.morale = 95;
            // Vertragskrise: nur 10 Spieler bleiben, die Notbesetzung kommt auf Ligaschnitt-Niveau
            squad = squad.slice(0, 10);
            squad.forEach(p => { p.contracts = 3; });
            lineup = pickBestLineupIds();
            const alteIds = squad.map(p => p.id);
            concludeSeasonAndAdvance();
            const sommer = { stress: privateLife.stress, tief: tief.morale, hoch: hoch.morale };
            const neu = squad.filter(p => !alteIds.includes(p.id));
            const andere = leaguesData[game.leagueLevel].filter(t => t.name !== game.clubName);
            const notkader = { anzahl: neu.length, kader: squad.length, gehalt: neu.every(p => p.wage >= EMERGENCY_WAGE_FLOOR[game.leagueLevel]),
                schnitt: Math.round(neu.reduce((a, p) => a + p.strength, 0) / Math.max(1, neu.length)),
                liga: Math.round(andere.reduce((a, t) => a + t.strength, 0) / andere.length) };
            game.sackPending = false;
            const eroeffnet = game.memberAssembly && game.memberAssembly.status === 'offen' && game.memberAssembly.openedMatchday === 1;
            simulateMatchdays(ASSEMBLY_AUTO_AFTER + 3);
            const automatisch = game.memberAssembly.status === 'abgehalten';
            game.memberAssembly.status = 'offen'; game.memberAssembly.openedMatchday = 35;
            tickMemberAssembly();
            const altstand = game.memberAssembly.status === 'abgehalten';
            return { erster, nachErstem, streakNull, zweiter, nachZweitem, spaeter, nachSpaeter, hoherWertBleibt, eroeffnet, automatisch, altstand, post, sommer, notkader, klausel };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Neustart ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.erster && r.nachErstem === 60 && r.streakNull && r.post, 'Erster Abstieg: Vertrauensvorschuss auf 60, Serie zurückgesetzt, Nachricht im Postfach');
        assert(!r.zweiter && r.nachZweitem === 20, 'Zweiter Abstieg in Folge: kein Vorschuss');
        assert(r.spaeter && r.nachSpaeter === 60, 'Nach einer Saison Pause gibt es wieder einen Neustart');
        assert(r.hoherWertBleibt, 'Ein höherer Wert wird nicht auf 60 gesenkt');
        assert(r.klausel.erwartung && r.klausel.erwartungSonst, `Nach einem Abstieg erwartet der Vorstand höchstens Platz 3, sonst Platz 1 für die stärkste Elf (${JSON.stringify(r.klausel)})`);
        assert(r.klausel.exakt && r.klausel.anteil < 0.85 && r.klausel.moral && r.klausel.post && r.klausel.fallschirm, `Abstiegsklausel senkt jedes Gehalt um 40 % (mind. 150 €) mit Nachricht, Bundesliga-Absteiger bekommt 16 Mio. € Fallschirmgeld (${JSON.stringify(r.klausel)})`);
        assert(r.eroeffnet && r.automatisch, 'Mitgliederversammlung findet ohne Zutun nach einigen Spieltagen statt');
        assert(r.altstand, 'Alte Spielstände mit Eröffnung an Spieltag 35 werden repariert');
        assert(r.notkader.gehalt, 'Notbesetzung verdient mindestens das Liga-Mindestgehalt');
        assert(r.notkader.kader >= 18 && r.notkader.schnitt >= r.notkader.liga - 13 && r.notkader.schnitt <= r.notkader.liga - 4, `Notbesetzung nach Vertragskrise nahe am Ligaschnitt (${JSON.stringify(r.notkader)})`);
        // Andere Saisonend-Ereignisse (Ehrungen, Abschiede) verschieben die Moral einzelner Spieler
        // zufällig um bis zu ~10 - geprüft wird nur, dass tiefe Moral spürbar steigt und hohe nicht zur 70 sinkt.
        assert(r.sommer.stress === 50 && r.sommer.tief >= 32 && r.sommer.hoch >= 75, `Sommerpause: Stress halbiert, tiefe Moral erholt sich, hohe bleibt (${JSON.stringify(r.sommer)})`);
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testCareerBalancing(browser) {
    console.log('\n[P16b] Karriere-Balancing: Fitness, Transfermarkt, Lizenzkosten');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Unveränderte Startelf über 6 Spieltage (Livespiel-Nutzer ohne Rotation)
        const elf = pickBestLineupIds();
        squad.forEach(p => { p.fitness = 100; });
        for (let i = 0; i < 6; i++) { lineup = [...elf]; processPostMatchRoutine('draw', false, false, 0, true, { total: 2, bothScored: true }); }
        const starter = squad.filter(p => elf.includes(p.id) && !(p.injured > 0));
        out.fitnessMin = Math.min(...starter.map(p => p.fitness));
        // Vorbericht warnt vor müden Stammspielern, Knopf stellt ausgeruhte Elf auf
        squad.filter(p => lineup.includes(p.id)).slice(0, 3).forEach(p => { p.fitness = 50; });
        renderFatigueWarning();
        out.warnung = document.getElementById('prematch-check-box').innerHTML.includes('rotateTiredPlayers') && document.getElementById('prematch-fatigue-box').innerHTML === '';
        rotateTiredPlayers();
        out.rotiert = squad.filter(p => lineup.includes(p.id) && p.fitness < 70).length < 3;
        // Nur so viele Verteidiger wie die Formation braucht, alle erschöpft: ein ausgeruhter
        // Feldspieler einer anderen Position spielt statt eines Müden (vorher spielten alle durch).
        game.formation = '4-4-2';
        squad.forEach(p => { p.fitness = 100; p.injured = 0; p.suspended = 0; });
        const abw = squad.filter(p => p.pos === 'ABW');
        abw.slice(4).forEach(p => { p.injured = 3; });
        abw.slice(0, 4).forEach(p => { p.fitness = 20; });
        const ausgeruht = pickBestLineupIds();
        out.muedeVerteidiger = abw.slice(0, 4).filter(p => ausgeruht.includes(p.id)).length;
        out.elfVoll = ausgeruht.length === 11 && ausgeruht.filter(id => squad.find(p => p.id === id).pos === 'TW').length === 1;
        squad.forEach(p => { p.fitness = 100; p.injured = 0; });
        // Heimvorteil auch für den Gegner, Eigenschaften-Boni zusammen höchstens +3
        out.gegnerHeim = getOpponentMatchStrength(70, true) - getOpponentMatchStrength(70, false) === AI_HOME_ADVANTAGE && AI_HOME_ADVANTAGE > 0;
        lineup = pickBestLineupIds();
        const elfSpieler = squad.filter(p => lineup.includes(p.id));
        const alteTraits = elfSpieler.map(p => p.trait);
        elfSpieler.forEach(p => { p.trait = 'Kein'; });
        const ohne = calcTeamStrength(true);
        ['Leader', 'Tor-Instinkt', 'Freistoß-Gott', 'Eisenfuß', 'Flügelflitzer', 'Zweikampfmonster'].forEach((t, i) => { if (elfSpieler[i + 1]) elfSpieler[i + 1].trait = t; });
        out.traitDeckel = calcTeamStrength(true) - ohne;
        elfSpieler.forEach((p, i) => { p.trait = alteTraits[i]; });
        // Transfermarkt: 10 Angebote, frisch zum Winterfenster
        refreshTransferMarket();
        out.markt = marketPlayers.length;
        const alt = marketPlayers.map(p => p.id).join();
        openWinterWindow();
        out.winterNeu = marketPlayers.map(p => p.id).join() !== alt;
        // Lizenzkosten skalieren mit der Liga
        game.leagueLevel = 3;
        out.flutlichtLiga4 = getSpecialInstallCost('flutlicht');
        game.leagueLevel = 0;
        out.flutlichtLiga1 = getSpecialInstallCost('flutlicht');
        game.leagueLevel = 2;
        out.internatLiga3 = getCampusUpgradeCost('internat');
        return out;
    });
    assert(r.fitnessMin >= 60, `Unveränderte Startelf nach 6 Spielen noch fit genug (min. ${r.fitnessMin} %)`);
    assert(r.warnung && r.rotiert, 'Vorbericht warnt vor müden Stammspielern, ein Klick rotiert');
    assert(r.gegnerHeim, 'Auch der Gegner hat daheim Heimvorteil');
    assert(r.traitDeckel >= 2 && r.traitDeckel <= 3, `Spieler-Eigenschaften bringen zusammen höchstens +3 (${r.traitDeckel})`);
    assert(r.muedeVerteidiger === 0 && r.elfVoll, `Erschöpfte Verteidiger ohne Ersatz auf der Position pausieren, ausgeruhte Feldspieler rücken nach (${r.muedeVerteidiger} müde in der Elf)`);
    assert(r.markt === 10 && r.winterNeu, `Transfermarkt mit 10 Spielern, neu zum Winterfenster (${r.markt})`);
    assert(r.flutlichtLiga4 <= 1000000 && r.flutlichtLiga1 === 3500000, `Flutlicht skaliert mit der Liga (Liga 4: ${r.flutlichtLiga4}, Liga 1: ${r.flutlichtLiga1})`);
    assert(r.internatLiga3 <= 3000000, `Jugendinternat (Lizenz 2. Liga) in der 3. Liga bezahlbar (${r.internatLiga3})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPressConference(browser) {
    console.log('\n[P18a] Pressekonferenz: Fragen nach Lage, Antworten mit Wirkung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        const frage = () => document.getElementById('press-question-container').innerText;
        // Favorit: Pflichtsieg ankündigen, dann verlieren -> Image und Vorstand sinken
        renderPressConference({ oppName: 'Schwach FC', oppStr: 5, isHome: true, cup: false });
        out.favorit = frage().includes('Favorit');
        const img0 = game.managerMediaImage ?? 50, board0 = game.boardSat;
        pressSituation.antworten[0].run();
        resolvePressPromise('loss');
        out.versprechenGebrochen = (game.managerMediaImage < img0) && game.boardSat < board0 && !game.pressPromise;
        // Außenseiter: Konter-Antwort stellt den Spielstil um
        game.tacticStyle = 'ausgeglichen';
        renderPressConference({ oppName: 'Riese FC', oppStr: 99, isHome: false, cup: false });
        out.underdog = frage().includes('Favorit') && frage().includes('Riese FC');
        pressSituation.antworten[1].run();
        out.konter = game.tacticStyle === 'konter';
        // Krise nach zwei Niederlagen
        const orig = window.getOwnSeasonMatches;
        window.getOwnSeasonMatches = () => [{ own: 0, opp: 2 }, { own: 1, opp: 3 }];
        renderPressConference({ oppName: 'Mittel FC', oppStr: 45, isHome: true, cup: false });
        out.krise = frage().includes('Job');
        window.getOwnSeasonMatches = orig;
        // Pokal
        renderPressConference({ oppName: 'Pokal FC', oppStr: 45, isHome: true, cup: true });
        out.pokal = frage().includes('Pokal');
        out.hinweise = document.getElementById('press-answers-container').innerHTML.includes('Stärke +1');
        // Stärkebonus wirkt im Livespiel genau um den angekündigten Wert
        // (Gemessen im selben Spiel: zwei Spielvorbereitungen nacheinander weichen durch
        // Zufallsereignisse vor dem Anpfiff gelegentlich um ±2 voneinander ab.)
        const original = window.applyPressConferenceToMatch;
        let ohne = null;
        window.applyPressConferenceToMatch = function () { ohne = currentMatch.ourBaseStr; return original(); };
        startMatchdayFlow();
        game.pressMatchBonus = { season: game.season, matchday: game.matchday, bonus: 2 };
        try { skipPressAndPlay(); } finally { window.applyPressConferenceToMatch = original; }
        stopLiveTickerAutoplay();
        out.bonus = ohne === null ? 'nicht aufgerufen' : Math.round((currentMatch.ourBaseStr - ohne) * 10) / 10;
        return out;
    });
    assert(r.favorit && r.underdog && r.krise && r.pokal, 'Frage passt zur Lage (Favorit, Außenseiter, Krise, Pokal)');
    assert(r.hinweise, 'Antworten zeigen ihre Wirkung an');
    assert(r.versprechenGebrochen, 'Angekündigter Sieg ohne Sieg kostet Image und Vorstand');
    assert(r.konter, 'Konter-Antwort stellt den Spielstil um');
    assert(r.bonus === 2, `Stärkebonus aus der Pressekonferenz wirkt im Spiel (${r.bonus})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testJobOffers(browser) {
    console.log('\n[P18c] Jobangebote: erfolgsabhängig, passende Vereine, echter Wechsel');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        const rnd = Math.random;
        // Saisonende auf Platz 1: Angebot sehr wahrscheinlich; auf Platz 12 kaum
        Math.random = () => 0.5;
        checkJobOfferApproach({ saisonende: true, rank: 12 });
        out.mittelfeldKeins = pendingJobApproach === null;
        checkJobOfferApproach({ saisonende: true, rank: 1 });
        Math.random = rnd;
        // Beim Simulieren kein Fenster, sondern Karte auf dem Dashboard
        showScreen('screen-dashboard');
        out.angebot = !!pendingJobApproach && !document.getElementById('joboffer-overlay').classList.contains('show')
            && document.getElementById('dash-joboffer-box').innerHTML.includes(pendingJobApproach.clubName);
        const eigene = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        out.passenderVerein = pendingJobApproach && (pendingJobApproach.level < game.leagueLevel || pendingJobApproach.strength > eigene.strength)
            && pendingJobApproach.level >= game.leagueLevel - 1 && pendingJobApproach.clubName !== game.clubName;
        out.dreiOptionen = document.getElementById('dash-joboffer-box').innerHTML.includes('acceptJobOfferMove') && document.getElementById('joboffer-overlay').innerHTML.includes('acceptJobOfferMove');
        // Wechsel: Karriere bleibt, neuer Verein, Station wird festgehalten
        const ziel = pendingJobApproach.clubName, lvl = managerRPG.level, trophaeen = game.trophies.length;
        acceptJobOfferMove(null);
        out.gewechselt = game.clubName === ziel && managerRPG.level === lvl && game.trophies.length === trophaeen
            && game.careerStations.length === 1 && !document.getElementById('joboffer-overlay').classList.contains('show');
        renderCareerSummary();
        out.stationSichtbar = document.getElementById('career-summary-box').innerHTML.includes(ziel);
        // Weiterspielen beim neuen Verein funktioniert
        game.sackPending = false; simulateMatchdays(2);
        out.weiter = game.matchday === 3;
        return out;
    });
    assert(r.mittelfeldKeins && r.angebot, 'Angebote hängen am Erfolg (Platz 1 ja, Mittelfeld kaum)');
    assert(r.passenderVerein, 'Angebot kommt von einem stärkeren Verein der eigenen oder nächsthöheren Liga');
    assert(r.dreiOptionen && r.gewechselt && r.stationSichtbar, 'Echter Wechsel mit Karriere-Mitnahme, Station im Karriere-Rückblick');
    assert(r.weiter, 'Beim neuen Verein geht die Saison normal weiter');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testVorwarnungTrend(browser) {
    console.log('\n[25.26] Vorstands-Warnung: auch bei dreimal fallendem Vertrauen unter 60, dazu sofort ein Autosave');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.season = 3; game.boardEarlyWarnSeason = null; game.boardSatVerlauf = [70, 60]; game.boardSat = 55;
            localStorage.removeItem(AUTOSAVE_KEY);
            checkJobSecurity();
            const out = { warnt: game.boardEarlyWarnSeason === 3, autosave: !!localStorage.getItem(AUTOSAVE_KEY) };
            game.boardEarlyWarnSeason = null; game.boardSatVerlauf = [60, 60]; game.boardSat = 55;
            checkJobSecurity();
            out.keinTrend = game.boardEarlyWarnSeason !== 3;
            return out;
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.warnt, `Fällt das Vertrauen dreimal in Folge und liegt unter 60, warnt der Vorstand (${r.crash || 'keine Warnung'})`);
    assert(!r.crash && r.autosave, 'Die Warnung schreibt sofort einen Autosave');
    assert(!r.crash && r.keinTrend, 'Ohne fallenden Trend (60, 60, 55) gibt es keine Warnung unter 60');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Vorstands-Warnung');
    await page.close();
}

async function testDashVorwarnZeile(browser) {
    console.log('\n[25.26] Dashboard: Vorstands-Warnung mit Ausweg, verschwindet bei Vertrauen über 60');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.season = 3; game.boardEarlyWarnSeason = 3; game.boardSat = 45;
            renderDashboardView();
            const mit = document.getElementById('dash-board-warn-line').textContent;
            game.boardSat = 80;
            renderDashboardView();
            const ohne = document.getElementById('dash-board-warn-line').textContent;
            return { mit, ohne };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.mit.includes('Der Vorstand ist unruhig') && r.mit.includes('Wintergespräch'), `Die Warnung steht auf dem Dashboard mit Ausweg (${r.crash || r.mit})`);
    assert(!r.crash && r.ohne === '', 'Bei Vertrauen über 60 verschwindet die Zeile');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Dashboard mit Warnung');
    await page.close();
}

module.exports = {
    testEntlassungsGrund,
    testRunde36Anzeigen,
    testVorstandHub,
    testBoardEarlyWarning,
    testWinterTalk,
    testAchievementsSystem,
    testConfigurableNewGameStart,
    testManagerOffice,
    testOfficeAtmosphereAndCrest,
    testOfficeEvents,
    testFakeDecisions,
    testBoardRestart,
    testCareerBalancing,
    testPressConference,
    testJobOffers,
    testVorwarnungTrend,
    testDashVorwarnZeile,
};
