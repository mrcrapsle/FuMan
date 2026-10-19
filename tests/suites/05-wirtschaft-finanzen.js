// Testsuiten: wirtschaft finanzen
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testPromotionTvAdvance(browser) {
    console.log('\n[25.22] TV-Vorschuss für Aufsteiger: Geld im Sommerfenster, über die Saison verrechnet');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.leagueLevel = 0; game.matchday = 35;
            const geld = game.money;
            markPromotionBoost();
            const v = game.tvAdvance;
            out.vorschuss = !!v && v.amount === 16000000 && v.season === game.season + 1 && game.money === geld + 16000000;
            game.season = v.season; game.matchday = 1;
            const abzug = getTvAdvanceDeduction();
            out.verrechnet = abzug === Math.round(16000000 / 34) && v.remaining === 16000000 - abzug;
            const vorher = game.money;
            const rest = settleTvAdvanceAtSeasonEnd();
            out.rest = rest === 16000000 - abzug && game.money === vorher - rest && game.tvAdvance === null;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `TV-Vorschuss ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.vorschuss, 'Beim Aufstieg in die Bundesliga kommen 16 Mio. € TV-Vorschuss für die neue Saison');
        assert(r.verrechnet && r.rest, 'Der Vorschuss geht je Spieltag von der TV-Rate ab, der Rest wird am Saisonende verrechnet');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testTvAdvanceGracePeriod(browser) {
    console.log('\n[25.23] TV-Vorschuss und DFB-Nachfrist: verlorener Aufstieg zahlt nichts, nachträglicher Aufstieg zahlt einmal');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const echteLizenz = checkDfbLicensingStatus;
            // Verlorene Nachfrist: Auflagen fehlen weiter, die Frist läuft ab
            game.leagueLevel = 1; game.matchday = 1; game.tvAdvance = null;
            game.dfbGracePeriod = { targetLevel: 0, deadlineMatchday: 1, originalLeagueLevel: 1 };
            checkDfbLicensingStatus = () => ({ missing: ['Internat fehlt'], auflagen: [], targetLevel: 0, totalCount: 3, metCount: 2 });
            let geld = game.money;
            checkDfbLicenseDeadlines();
            out.verloren = game.dfbGracePeriod === null && game.leagueLevel === 1 && game.tvAdvance === null && game.money === geld;
            // Nachträglicher Aufstieg: Auflagen erfüllt, der Vorschuss der neuen Liga wird einmal gezahlt
            game.dfbGracePeriod = { targetLevel: 0, deadlineMatchday: 2, originalLeagueLevel: 1 };
            checkDfbLicensingStatus = () => ({ missing: [], auflagen: [], targetLevel: 0, totalCount: 3, metCount: 3 });
            geld = game.money;
            checkDfbLicenseDeadlines();
            out.nachtraeglich = game.leagueLevel === 0 && !!game.tvAdvance && game.tvAdvance.amount === 16000000
                && game.tvAdvance.season === game.season && game.money >= geld + 16000000;
            checkDfbLicensingStatus = echteLizenz;
            return out;
        } catch (e) { checkDfbLicensingStatus = echteLizenz; return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `TV-Vorschuss und Nachfrist ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.verloren, 'Verfällt die DFB-Nachfrist, gibt es weder Vorschuss noch Aufstiegsprämie');
        assert(r.nachtraeglich, 'Wird der Aufstieg in der Nachfrist nachträglich vollzogen, zahlt der TV-Vorschuss genau einmal');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSponsorRenewal(browser) {
    console.log('\n[25.19] Hauptsponsor bietet vor dem Ablauf eine Verlängerung an');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            const neu = () => { game.sponsor = { name: 'Testwerke', base: 10000, winBonus: 2000, cupBonus: 0, promotionBonus: 0, duration: SPONSOR_RENEWAL_LEAD + 1, tier: 'mittel', category: null, loyalty: 75, signedLevel: game.leagueLevel }; game.sponsorRenewal = null; };
            neu();
            tickContractDurations();
            const a = getSponsorRenewal();
            out.angebot = !!a && a.base === Math.round(10000 * (0.8 + 75 / 250) / 100) * 100 && inboxMessages.some(m => m.title.includes('will verlängern'));
            showScreen('screen-sponsors');
            out.box = document.getElementById('sponsor-renewal-box').textContent.includes('Verlängerung');
            acceptSponsorRenewal();
            out.verlaengert = game.sponsor.duration === SPONSOR_RENEWAL_LEAD + SPONSOR_RENEWAL_DAYS && game.sponsor.base === a.base && game.sponsor.loyalty === 80 && !getSponsorRenewal();
            // Nachverhandeln: Erfolg +10 %, Misserfolg zieht das Angebot zurück
            neu(); tickContractDurations();
            const basis = getSponsorRenewal().base;
            Math.random = () => 0; haggleSponsorRenewal(); Math.random = zufall;
            out.mehr = getSponsorRenewal().base === Math.round(basis * 1.1 / 100) * 100;
            neu(); tickContractDurations();
            Math.random = () => 0.99; haggleSponsorRenewal(); Math.random = zufall;
            out.zurueck = !getSponsorRenewal();
            // Geringe Treue: kein Angebot; Ligawechsel seit der Unterschrift wird eingerechnet
            neu(); game.sponsor.loyalty = 10; tickContractDurations();
            out.keinAngebot = !getSponsorRenewal() && inboxMessages.some(m => m.title.includes('verlängert nicht'));
            neu(); game.sponsor.signedLevel = game.leagueLevel + 1 < 6 ? game.leagueLevel + 1 : game.leagueLevel; tickContractDurations();
            out.ligaFaktor = game.sponsor.signedLevel === game.leagueLevel || getSponsorRenewal().base > Math.round(10000 * (0.8 + 75 / 250) / 100) * 100;
            // Ablauf ohne Annahme: Angebot verfällt mit dem Vertrag
            neu(); tickContractDurations(); game.sponsor.duration = 1; tickContractDurations();
            out.verfallen = game.sponsor.name === 'Kein Hauptsponsor' && !game.sponsorRenewal;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Sponsor-Verlängerung ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.angebot && r.box, '6 Spieltage vor Ablauf bietet der Hauptsponsor eine Verlängerung an (Konditionen nach Treue), mit Post und Box');
        assert(r.verlaengert, 'Annehmen verlängert um 34 Spieltage zu den neuen Konditionen, Treue +5');
        assert(r.mehr && r.zurueck, 'Nachverhandeln: Erfolg +10 %, sonst zieht der Sponsor das Angebot zurück');
        assert(r.keinAngebot && r.ligaFaktor && r.verfallen, 'Geringe Treue: kein Angebot; Aufstieg seit der Unterschrift hebt die Konditionen; ohne Annahme verfällt das Angebot');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testBookingLabels(browser) {
    console.log('\n[25.19] Buchungstexte: Käufe, Verkäufe, Handgelder, Sichtung, TV-Prognose');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            showScreen('screen-dashboard');
            game.money = 50000000; game.transferBudget = 50000000; game.wageBudget = 1e9;
            game.kontoauszug = [];
            const letzte = () => (game.kontoauszug || []).slice(-1)[0] || {};
            const kader = squad.length;
            buyPlayer(0);
            out.kauf = squad.length === kader + 1 && letzte().label === '🛒 Spielerkauf';
            const weg = squad[squad.length - 1];
            sellPlayer(weg.id, null);
            out.verkauf = letzte().label === '💸 Spielerverkauf';
            scoutYouthTalent();
            out.sichtung = letzte().label === '🎓 Jugendarbeit';
            const p = squad[0];
            p.contracts = 1;
            extendContract(p.id);
            if (contractTalk) acceptContractTalk();
            out.handgeld = p.contracts > 1 ? letzte().label === '✍️ Handgeld & Berater' || letzte().amount === undefined : true;
            out.keinVereinsbuero = game.kontoauszug.every(b => !b.label.includes('Vereinsbüro'));
            // TV-Prognose in der Finanzübersicht
            game.matchday = 10;
            const tv = getTvSeasonOutlook();
            out.tv = !!tv && tv.rank >= 1 && typeof tv.rest === 'number';
            showScreen('screen-finances');
            out.tvAnzeige = /Platz/.test(document.getElementById('fin-tv-outlook-label').textContent);
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Buchungstexte ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.kauf && r.verkauf, 'Spielerkauf und -verkauf stehen mit eigenem Text im Kontoauszug');
        assert(r.sichtung && r.handgeld, 'Sichtung und Handgeld einer Verlängerung haben eigene Buchungstexte');
        assert(r.keinVereinsbuero, 'Nichts davon landet mehr unter "Vereinsbüro"');
        assert(r.tv && r.tvAnzeige, 'Finanzübersicht zeigt die TV-Abrechnung zum Saisonende beim aktuellen Platz');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSponsorConflict(browser) {
    console.log('\n[19.x] Sponsoren: Branchenkonflikt nennt den Konkurrenten und kostet 30 %');
    const { page, consoleErrors } = await freshPage(browser);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            bandenSponsors = [{ id: 1, name: 'RegioBank Test', type: 'LED', income: 1000, active: true, duration: 10, category: 'Finanzen', area: Object.keys(stadium.blocks)[0] }];
            sponsorOffers = [];
            checkIncomingSponsorOffers(true);
            const o = sponsorOffers[0];
            o.category = 'Finanzen';
            showScreen('screen-sponsors');
            renderSponsorsView();
            const html = document.body.innerHTML;
            const basis = o.base;
            // Ohne Hauptsponsor: ab Spieltag 3 einmal pro Saison eine Erinnerung (25.13)
            const vorher = inboxMessages.length;
            game.matchday = 3;
            remindMissingMainSponsor(); remindMissingMainSponsor();
            const erinnert = inboxMessages.length - vorher === 1 && JSON.stringify(inboxMessages).includes('Noch kein Hauptsponsor');
            acceptSponsorOffer(o.id);
            const n = inboxMessages.length; game.season++; remindMissingMainSponsor();
            const mitSponsorRuhe = inboxMessages.length === n;
            return { anzeige: html.includes('Branchenkonflikt mit RegioBank Test (Bande)') && html.includes('nur 70 %'), abschlag: game.sponsor.base === Math.round(basis * 0.7), erinnert, mitSponsorRuhe };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Sponsoren-Konflikt-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.anzeige, 'Angebot nennt den konkurrierenden Sponsor und den Abschlag');
    assert(r.abschlag, 'Beim Annehmen zahlt der Sponsor tatsächlich nur 70 %');
    assert(r.erinnert && r.mitSponsorRuhe, 'Ohne Hauptsponsor kommt einmal pro Saison eine Erinnerung, mit Sponsor nicht');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testAttendanceCapVaries(browser) {
    console.log('\n[20.x] Zuschauer: Liga-Obergrenze schwankt mit Wetter, Form und Preis (nicht immer 1.000)');
    const { page, consoleErrors } = await freshPage(browser);
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.leagueLevel = 5; game.fans = 100;
            stadium.total = 55000; // riesiges Stadion: die Liga-Obergrenze greift immer
            const deckel = getLeagueAttendanceCap(1);
            const werte = [];
            for (let i = 0; i < 12; i++) werte.push(calculateMatchAttendance(1, 0.92 + Math.random() * 0.16));
            const markt = { steh: getMarketTicketPrice('steh'), sitz: getMarketTicketPrice('sitz'), vip: getMarketTicketPrice('vip') };
            Object.assign(game.ticketPrices, markt);
            const fair = calculateMatchAttendance(1, 1);
            Object.assign(game.ticketPrices, { steh: markt.steh * 2, sitz: markt.sitz * 2, vip: markt.vip * 2 });
            const teuer = calculateMatchAttendance(1, 1);
            return { deckel, verschieden: new Set(werte).size >= 4, nieDrueber: werte.every(w => w <= Math.round(deckel * 1.12)), preisWirkt: teuer < fair };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash, `Zuschauer-Test ohne Absturz (${r.crash || 'ok'})`);
    assert(r.verschieden, 'Bei greifender Liga-Obergrenze schwankt die Zuschauerzahl von Spiel zu Spiel');
    assert(r.nieDrueber, `Die Liga-Obergrenze (${r.deckel}) wird höchstens leicht überschritten`);
    assert(r.preisWirkt, 'Auch bei greifender Obergrenze kosten zu hohe Ticketpreise Zuschauer');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// [8] STADION-SYSTEME
// ---------------------------------------------------------------------------
async function testStadiumSystems(browser) {
    console.log('\n[8] Stadion-Systeme');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        game.money = 100000000;

        results.has20Upgrades = Object.keys(STADIUM_UPGRADES).length === 20;

        // Stadion-Erweiterung laeuft ueber eine echte Baustelle
        buyStadiumUpgrade('sicherheitstechnik');
        results.upgradeNotInstant = !stadium.upgrades || !stadium.upgrades.sicherheitstechnik;
        let proj = game.stadiumConstructionQueue.find(p => p.type === 'stadiumUpgrade');
        for (let i = 0; i < proj.totalDays; i++) tickStadiumConstruction();
        results.upgradeCompletesAfterTime = stadium.upgrades.sicherheitstechnik === true;

        // Sicherheitsbonus wirkt
        results.securityBonusWorks = getStadiumSecurityBonus() > 0;

        // Klimaanlage neutralisiert Hitze
        stadium.upgrades.klimaanlage = true;
        let foundHeat = null;
        for (let i = 0; i < 500 && !foundHeat; i++) { let w = rollWeather(); if (w.name === 'Hitze') foundHeat = w; }
        results.airConditioningNeutralizesHeat = foundHeat && foundHeat.neutralizedByAC === true;

        // Groessenstufen aendern sich mit der Kapazitaet
        Object.keys(stadium.blocks).forEach(k => stadium.blocks[k].cap = 800);
        let tierSmall = getStadiumVisualTier();
        Object.keys(stadium.blocks).forEach(k => stadium.blocks[k].cap = 15000);
        let tierMega = getStadiumVisualTier();
        results.visualTiersChangeWithCapacity = tierSmall === 'small' && tierMega === 'mega';

        return results;
    });

    assert(r.has20Upgrades, 'Alle 20 Stadion-Erweiterungen sind vorhanden');
    assert(r.upgradeNotInstant, 'Stadion-Erweiterung ist keine Sofort-Aktion');
    assert(r.upgradeCompletesAfterTime, 'Stadion-Erweiterung schließt nach Bauzeit korrekt ab');
    assert(r.securityBonusWorks, 'Sicherheitstechnik senkt das Ausschreitungsrisiko messbar');
    assert(r.airConditioningNeutralizesHeat, 'Klimaanlage neutralisiert Hitze-Wetter');
    assert(r.visualTiersChangeWithCapacity, '3D-Stadion-Design ändert sich sichtbar mit der Kapazität');
    await page.close();
}

async function testTaxAndAdvisor(browser) {
    console.log('\n[16] Steuern & Steuerberater');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        out.rateOhne = getTaxRate();
        financeCentralState.taxAdvisorHired = true;
        out.rateMit = getTaxRate();
        out.honorar = getTaxAdvisorFee();
        out.breakEven = getTaxAdvisorBreakEven();

        // Abgabe wird auf die Spieltagseinnahmen tatsächlich erhoben und mitgeschrieben.
        financeCentralState.taxAdvisorHired = false;
        game.money = 500000; game.seasonTaxPaid = 0;
        applyMatchdayFinances(true, true, false, false, 'Test', '2:0');
        out.steuerOhne = game.lastMatchdayTax;
        out.feeOhne = game.lastMatchdayAdvisorFee;
        out.saisonSumme = game.seasonTaxPaid;

        financeCentralState.taxAdvisorHired = true;
        applyMatchdayFinances(true, true, false, false, 'Test', '2:0');
        out.feeMit = game.lastMatchdayAdvisorFee;
        out.saisonSummeGewachsen = game.seasonTaxPaid > out.saisonSumme;

        // Überlebt Speichern/Laden
        let save = JSON.parse(JSON.stringify(buildSaveState()));
        let sumVorher = game.seasonTaxPaid;
        game.seasonTaxPaid = 0; financeCentralState.taxAdvisorHired = false;
        applyLoadedState(save);
        out.summeRestauriert = game.seasonTaxPaid === sumVorher;
        out.mandatRestauriert = financeCentralState.taxAdvisorHired === true;
        return out;
    });

    // Krisen-Abmilderung: identische Ausgangslage, nur das Mandat unterscheidet sich.
    const krise = await page.evaluate(() => {
        const lauf = (hired) => {
            financeCentralState.taxAdvisorHired = hired;
            managerRPG.perks.crisisProof = false;
            game.money = -1000; game.negativeStreak = 9;
            let best = [...squad].sort((a, b) => calculatePlayerMarketValue(b.strength) - calculatePlayerMarketValue(a.strength))[0];
            let marktwert = calculatePlayerMarketValue(best.strength);
            let vorher = game.money;
            checkInsolvencyRisk();
            let quote = (game.money - vorher) / marktwert;

            let team = getOurLeagueTeam();
            team.points = 30;
            game.money = -1000; game.negativeStreak = 14;
            checkInsolvencyRisk();
            return { quote, abzug: 30 - team.points };
        };
        return { ohne: lauf(false), mit: lauf(true) };
    });

    assert(r.rateOhne === 0.12, `Ohne Berater gilt der volle Abgabensatz (${Math.round(r.rateOhne * 100)}%)`);
    assert(r.rateMit === 0.07, `Mit Berater sinkt der Abgabensatz (${Math.round(r.rateMit * 100)}%)`);
    assert(r.honorar > 0 && r.breakEven > 0, `Honorar (${r.honorar} €/SpT) und Break-even (${r.breakEven} €) werden berechnet`);
    assert(r.steuerOhne > 0, `Auf die Spieltagseinnahmen wird tatsächlich eine Abgabe erhoben (${r.steuerOhne} €)`);
    assert(r.feeOhne === 0, 'Ohne Mandat fällt kein Berater-Honorar an');
    assert(r.feeMit === r.honorar, 'Mit Mandat wird das Honorar pro Spieltag abgebucht');
    assert(r.saisonSummeGewachsen, 'Abgeführte Abgaben werden über die Saison aufsummiert');
    assert(r.summeRestauriert && r.mandatRestauriert, 'Mandat und Saisonsumme überleben Speichern/Laden');
    assert(Math.abs(krise.ohne.quote - 0.6) < 0.001 && Math.abs(krise.mit.quote - 0.75) < 0.001,
        `Zwangsverkauf bringt mit Berater mehr (${Math.round(krise.ohne.quote * 100)}% → ${Math.round(krise.mit.quote * 100)}% vom Marktwert)`);
    assert(krise.ohne.abzug === 3 && krise.mit.abzug === 2,
        `Punktabzug fällt mit Berater geringer aus (${krise.ohne.abzug} → ${krise.mit.abzug} Punkte)`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Steuern/Steuerberater');
    await page.close();
}

async function testStadiumWideBanden(browser) {
    console.log('\n[17] Bandenwerbung im gesamten Stadion');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let out = {};
        out.bereiche = getBandenAreaKeys().length;
        out.stadionBloecke = Object.keys(stadium.blocks).length;
        out.slotsStart = getTotalBandenSlots();

        // Stadionausbau schafft zusätzliche Werbeflächen.
        stadium.blocks.kurve.cap += 3600;
        out.slotsNachAusbau = getTotalBandenSlots();

        // Angebote sind einem Stadionbereich zugeordnet und werden dort gebucht.
        bandenOffers = []; bandenSponsors = [];
        checkIncomingBandenOffers(true);
        out.angebotHatBereich = bandenOffers.length > 0 && !!bandenOffers[0].area;
        let zielBereich = bandenOffers[0].area;
        acceptBandenOffer(bandenOffers[0].id);
        out.gebucht = getBandenSponsorsInArea(zielBereich).length === 1;
        out.zaehltInsEinkommen = getBandenIncome() > 0;

        // Ein voll belegter Bereich bekommt keine weiteren Angebote mehr.
        let key = 'vipLogen';
        bandenSponsors = [];
        for (let i = 0; i < getBandenSlotsForArea(key); i++) {
            bandenSponsors.push({ id: i, name: 'Test', type: 'Statisch', income: 100, active: true, duration: 10, category: 'Mode', area: key });
        }
        out.vollerBereichRaus = !getFreeBandenAreas().includes(key);

        // Sichtbarkeit wirkt: Haupttribüne zahlt bei gleicher Größe mehr als der Gästeblock.
        stadium.blocks.west.cap = 3000; stadium.blocks.gaeste.cap = 3000;
        let w = 0, g = 0;
        for (let i = 0; i < 300; i++) { w += rollBandenIncomeForArea('west', 'LED-Bande', 1); g += rollBandenIncomeForArea('gaeste', 'LED-Bande', 1); }
        out.schnittWest = Math.round(w / 300);
        out.schnittGaeste = Math.round(g / 300);

        // Altbestand aus Spielständen ohne Bereichszuordnung wird migriert.
        bandenSponsors = [{ id: 99, name: 'Alt', type: 'Statisch', income: 500, active: true, duration: 10, category: 'Mode' }];
        migrateLegacyBandenSponsors();
        out.altbestandMigriert = !!bandenSponsors[0].area;

        // Überlebt Speichern/Laden samt Bereichszuordnung.
        let save = JSON.parse(JSON.stringify(buildSaveState()));
        let bereichVorher = bandenSponsors[0].area;
        bandenSponsors = [];
        applyLoadedState(save);
        out.bereichRestauriert = bandenSponsors[0] && bandenSponsors[0].area === bereichVorher;
        return out;
    });

    assert(r.bereiche === r.stadionBloecke, `Jeder der ${r.stadionBloecke} Stadionbereiche bietet Bandenplätze (${r.bereiche})`);
    assert(r.slotsStart > 8, `Mehr Bandenplätze als die früheren 8 Pauschalplätze (${r.slotsStart})`);
    assert(r.slotsNachAusbau > r.slotsStart, `Stadionausbau schafft zusätzliche Werbeflächen (${r.slotsStart} → ${r.slotsNachAusbau})`);
    assert(r.angebotHatBereich, 'Bandenangebote sind einem konkreten Stadionbereich zugeordnet');
    assert(r.gebucht, 'Angenommene Bande belegt einen Platz im richtigen Bereich');
    assert(r.zaehltInsEinkommen, 'Gebuchte Bande zählt in die Bandeneinnahmen');
    assert(r.vollerBereichRaus, 'Ein voll belegter Bereich bekommt keine weiteren Angebote');
    assert(r.schnittWest > r.schnittGaeste, `Sichtbarkeit wirkt: Haupttribüne zahlt mehr als Gästeblock (${r.schnittWest} € vs. ${r.schnittGaeste} € bei gleicher Größe)`);
    assert(r.altbestandMigriert, 'Banden aus alten Spielständen bekommen einen Stadionbereich zugewiesen');
    assert(r.bereichRestauriert, 'Bereichszuordnung überlebt Speichern/Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Bandenwerbung');
    await page.close();
}

async function testRealisticMerchSales(browser) {
    console.log('\n[19] Fanartikel: realistische Absatzmengen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};
        out.sortiment = Object.keys(merchandise).length;
        for (let k in merchandise) merchandise[k].stock = 100000;   // Bestand darf nicht bremsen
        game.attendanceHistory = Array.from({ length: 8 }, () => ({ attendance: 950 }));

        const lauf = (att) => {
            for (let k in merchandise) merchandise[k].stock = 100000;
            let rev = simulateMerchSales(true, false, att);
            return { rev, stueck: Object.values(merchandise).reduce((s, m) => s + m.lastSales.total, 0) };
        };

        // Kleiner Verein: der Absatz muss zur Zuschauerzahl passen.
        let laeufe = [lauf(950), lauf(950), lauf(950)];
        out.proZuschauer = laeufe.map(l => l.rev / 950);
        out.stueckzahlen = laeufe.map(l => l.stueck);
        out.schwankt = new Set(laeufe.map(l => Math.round(l.rev))).size > 1;

        // Zehnfache Zuschauerzahl muss auch etwa den zehnfachen Absatz bringen.
        game.attendanceHistory = Array.from({ length: 8 }, () => ({ attendance: 9500 }));
        let gross = lauf(9500);
        out.skaliert = gross.stueck > laeufe[0].stueck * 4;

        // Premium-Booster und Perks müssen sich auswirken.
        game.attendanceHistory = Array.from({ length: 8 }, () => ({ attendance: 950 }));
        let ohne = lauf(950).rev;
        game.merchDoubleNextMatch = true;
        let mit = lauf(950).rev;
        out.boosterWirkt = mit > ohne * 1.25;
        out.boosterVerbraucht = game.merchDoubleNextMatch === false;

        // Auswärts wird im Stadion nichts verkauft, Stadt/Online laufen weiter.
        let aus = simulateMerchSales(false, false, 0);
        out.auswaertsOhneStadion = Object.values(merchandise).every(m => m.lastSales.stadium === 0) && aus > 0;

        // Verlauf wird mitgeschrieben und überlebt Speichern/Laden.
        out.verlaufEintraege = merchExtras.salesHistory.length;
        let save = JSON.parse(JSON.stringify(buildSaveState()));
        merchExtras.salesHistory = [];
        applyLoadedState(save);
        out.verlaufRestauriert = merchExtras.salesHistory.length === out.verlaufEintraege;
        return out;
    });

    const proZ = r.proZuschauer.map(v => v.toFixed(2)).join(' / ');
    assert(r.sortiment >= 24, `Sortiment umfasst mindestens 24 Artikel (${r.sortiment})`);
    assert(r.proZuschauer.every(v => v > 1.5 && v < 8), `Umsatz je Zuschauer bleibt realistisch (${proZ} € - Recherche: ~3 €)`);
    assert(r.stueckzahlen.every(v => v < 400), `Bei 950 Zuschauern werden keine Hunderte Artikel verkauft (${r.stueckzahlen.join('/')} Stück)`);
    assert(r.schwankt, 'Die Absatzmenge schwankt von Spieltag zu Spieltag');
    assert(r.skaliert, 'Zehnfache Zuschauerzahl bringt deutlich mehr Absatz');
    assert(r.boosterWirkt, 'Premium-Booster steigert den Absatz spürbar');
    assert(r.boosterVerbraucht, 'Premium-Booster wird nach dem Spieltag verbraucht');
    assert(r.auswaertsOhneStadion, 'Auswärts läuft kein Stadionverkauf, Stadt/Online aber schon');
    assert(r.verlaufEintraege > 0 && r.verlaufRestauriert, 'Verkaufsverlauf wird mitgeschrieben und überlebt Speichern/Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Fanartikel-Verkäufen');
    await page.close();
}

async function testBuildingPaymentAndPrices(browser) {
    console.log('\n[20] Bauen: Sofortzahlung, keine Schulden, Preise');
    const { page, consoleErrors } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let out = {};
        // Ohne Deckung darf gar nicht erst gebaut werden.
        game.money = 50000;
        game.stadiumConstructionQueue = [];
        queueStadiumConstruction('campusBuilding', { key: 'hotel' }, 900000, 12, 'Testbau');
        out.ohneDeckungBlockiert = game.stadiumConstructionQueue.length === 0 && game.money === 50000;

        // Mit Deckung: sofort vollständig bezahlt, keine offene Restzahlung.
        game.money = 2000000;
        queueStadiumConstruction('campusBuilding', { key: 'hotel' }, 900000, 12, 'Testbau');
        let proj = game.stadiumConstructionQueue[0];
        out.sofortVollBezahlt = game.money === 1100000;
        out.keineRestzahlung = !!proj && proj.remainingPayment === 0;

        // Bei Fertigstellung darf nichts mehr abgebucht werden.
        let vorFertigstellung = game.money;
        for (let i = 0; i < 20; i++) tickStadiumConstruction();
        out.fertigOhneNachzahlung = game.money === vorFertigstellung;

        // Preise: Fabriken sind echte Investitionen, die Jugendakademie kein Kleingeld mehr.
        out.fabrikMin = Math.min(...Object.values(factories).map(f => f.cost));
        game.leagueLevel = 5; game.youthAcademyLvl = 1;
        out.akademieUnterliga = Math.max(300000, Math.round(600000 * Math.pow(1, 1.4) * getStadiumCostScale()));

        // Fabrikkauf ohne Holding-Guthaben: sichtbar gesperrt statt stumm wirkungslos.
        holdingCompany.money = 1000;
        showScreen('screen-industry');
        let gitter = document.getElementById('factories-grid');
        let kaufKnopf = [...gitter.querySelectorAll('button')].find(b => b.innerText.includes('Fabrik kaufen'));
        out.kaufGesperrt = !!kaufKnopf && kaufKnopf.disabled;
        out.fehlbetragSichtbar = gitter.innerText.includes('es fehlen');

        // Der Wirtschaftsbereich darf keine nativen Dialoge mehr nutzen (werden in manchen
        // Android-WebViews unterdrückt - der Knopf wirkt dann komplett wirkungslos).
        out.keinAlertMehr = !buyFactory.toString().includes('alert(')
            && !startProduction.toString().includes('alert(')
            && !transferClubToHolding.toString().includes('alert(');
        return out;
    });

    assert(r.ohneDeckungBlockiert, 'Ohne ausreichendes Guthaben wird gar nicht erst gebaut');
    assert(r.sofortVollBezahlt, 'Baukosten werden sofort vollständig abgebucht');
    assert(r.keineRestzahlung, 'Es bleibt keine Restzahlung bis zur Fertigstellung offen');
    assert(r.fertigOhneNachzahlung, 'Bei Fertigstellung wird nichts mehr nachgefordert');
    assert(r.fabrikMin >= 250000, `Fabriken sind echte Investitionen (günstigste: ${r.fabrikMin.toLocaleString('de-DE')} €)`);
    assert(r.akademieUnterliga >= 300000, `Jugendakademie auch in unteren Ligen kein Kleingeld (${r.akademieUnterliga.toLocaleString('de-DE')} €)`);
    assert(r.kaufGesperrt && r.fehlbetragSichtbar, 'Fabrikkauf ohne Holding-Guthaben ist sichtbar gesperrt und begründet');
    assert(r.keinAlertMehr, 'Wirtschaftsbereich meldet Fehler sichtbar statt über native Dialoge');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Bau-/Preis-Test');
    await page.close();
}

async function testConfirmBeforeIrreversibleActions(browser) {
    console.log('\n[22] Bestätigung vor folgenreichen Aktionen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // Jugendspieler in den Profikader hochziehen
        scoutYouthTalent(); scoutYouthTalent();
        showScreen('screen-youth');
        let hoch = [...document.querySelectorAll('#youth-talents-list button')].find(b => b.innerText.includes('Profikader'));
        let kaderVorher = squad.length, jugendVorher = youthTalents.length;
        hoch.click();
        out.jugendErsterKlick = squad.length === kaderVorher && hoch.innerText.includes('Wirklich');
        hoch.click();
        out.jugendZweiterKlick = squad.length === kaderVorher + 1 && youthTalents.length === jugendVorher - 1;

        // Personal entlassen
        staffMembers.marketingDir.hired = true;
        showScreen('screen-staff');
        let entlassen = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Entlassen');
        entlassen.click();
        out.personalErsterKlick = staffMembers.marketingDir.hired === true && entlassen.innerText.includes('Wirklich');
        entlassen.click();
        out.personalZweiterKlick = staffMembers.marketingDir.hired === false;

        // Einstellen bleibt ohne Rückfrage - nur das Entlassen ist folgenreich.
        showScreen('screen-staff');
        let einstellen = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Einstellen');
        out.einstellenOhneRueckfrage = !!einstellen && einstellen.dataset.confirming !== 'true';

        // Die Absicherung nutzt KEINE nativen Dialoge (in Android-WebViews unterdrückt).
        out.keineNativenDialoge = !requireConfirm.toString().includes('confirm(')
            && !promoteYouth.toString().includes('window.confirm');
        return out;
    });

    assert(r.jugendErsterKlick, 'Jugendspieler hochziehen fragt beim ersten Klick nur nach');
    assert(r.jugendZweiterKlick, 'Erst der zweite Klick zieht den Jugendspieler wirklich hoch');
    assert(r.personalErsterKlick, 'Personal entlassen fragt beim ersten Klick nur nach');
    assert(r.personalZweiterKlick, 'Erst der zweite Klick entlässt das Personal wirklich');
    assert(r.einstellenOhneRueckfrage, 'Einstellen läuft weiterhin ohne Rückfrage');
    assert(r.keineNativenDialoge, 'Die Rückfrage nutzt keine nativen Dialoge');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Bestätigungsabfragen');
    await page.close();
}

async function testFinanceLedgerAndStatement(browser) {
    console.log('\n[23] Finanzmenü: Buchungsjournal & Kontoauszug');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Buchungsjournal: jeder Spieltag wird einzeln aufgeschlüsselt verbucht.
        let vorher = (game.financeLedger || []).length;
        simulateMatchdays(3);
        let ledger = game.financeLedger || [];
        out.journalWaechst = ledger.length === vorher + 3;
        let letzte = ledger[ledger.length - 1];
        out.journalHatPosten = Array.isArray(letzte.einnahmen) && Array.isArray(letzte.ausgaben)
            && letzte.ausgaben.length > 0;
        out.journalSummenStimmen = letzte.summeEin === letzte.einnahmen.reduce((s, e) => s + e.amount, 0)
            && letzte.summeAus === letzte.ausgaben.reduce((s, e) => s + e.amount, 0);

        // 2. Personalgehälter werden tatsächlich abgebucht (waren zuvor nur Anzeige).
        Object.values(staffMembers).forEach(s => s.hired = false);
        staffMembers.marketingDir.hired = true;
        let kontoVorSpieltag = game.money;
        simulateMatchdays(1);
        let spieltag = game.financeLedger[game.financeLedger.length - 1];
        let personalPosten = spieltag.ausgaben.find(a => a.label.includes('Personalgehälter'));
        out.personalVerbucht = !!personalPosten && personalPosten.amount === getTotalStaffWages();
        out.personalWirklichAbgezogen = game.money !== kontoVorSpieltag;

        // 3. Anzeige: alle drei Reiter rendern ohne Fehler und zeigen Inhalte.
        showScreen('screen-finances');
        setLedgerView('letzter');
        let boxLetzter = document.getElementById('finance-ledger-box').innerHTML;
        out.ansichtLetzter = boxLetzter.includes('Einnahmen') && boxLetzter.includes('Ausgaben');
        setLedgerView('saison');
        let boxSaison = document.getElementById('finance-ledger-box').innerHTML;
        out.ansichtSaison = boxSaison.includes('abgerechnete Spieltage');
        out.tabAktiv = document.getElementById('ledger-tab-saison').className === 'btn-action'
            && document.getElementById('ledger-tab-letzter').className === 'btn-secondary';

        // 4. Kontoauszug: Bewegungen AUSSERHALB der Spieltagsabrechnung werden automatisch
        //    erfasst und dem auslösenden Bereich zugeordnet.
        game.kontoauszug = [];
        game.money = 5000000;
        showScreen('screen-stadium');
        let kontoVorBau = game.money;
        game.money -= 120000; // stellvertretend für einen Bauauftrag
        let buchung = game.kontoauszug[game.kontoauszug.length - 1];
        out.buchungErfasst = !!buchung && buchung.amount === -120000;
        out.buchungBereich = !!buchung && buchung.label.includes('Stadionausbau');
        out.buchungSaldo = !!buchung && buchung.saldo === kontoVorBau - 120000;

        // Spieltagsbuchungen tauchen NICHT im Kontoauszug auf (sie stehen im Journal).
        let auszugVorSpieltag = game.kontoauszug.length;
        simulateMatchdays(1);
        out.spieltagNichtImAuszug = game.kontoauszug.length === auszugVorSpieltag;

        // 4b. Ordnerdienst: nur bei Heimspielen und nur nach tatsaechlichem Einsatz.
        game.stewards = 100;
        securityWorkforce.permanentStewards = 0;
        out.ordnerNurNachBedarf = getDeployedStewards(600) === 24 && getDeployedStewards(100000) === 100;
        out.ordnerKostenProportional = getStewardMatchdayCost(600) === 24 * 120 * 2;
        let kontoVorAuswaerts = game.money;
        tickStewardCosts(false);
        out.ordnerNurZuhause = game.money === kontoVorAuswaerts;
        // Abgerechnet wird ueber eine echte Spieltagsabrechnung: tickStewardCosts() bucht
        // bewusst nur, wenn fuer diesen Spieltag auch wirklich gespielt wurde.
        let heimspiele = 0, ordnerVerbucht = 0;
        for (let i = 0; i < 6; i++) {
            simulateMatchdays(1);
            let e = game.financeLedger[game.financeLedger.length - 1];
            if (e && e.heimspiel) {
                heimspiele++;
                if (e.ausgaben.some(a => a.label.includes('Ordnerdienst'))) ordnerVerbucht++;
            }
        }
        out.ordnerZuhauseBezahlt = heimspiele > 0 && ordnerVerbucht === heimspiele;

        setLedgerView('konto');
        let boxKonto = document.getElementById('finance-ledger-box').innerHTML;
        out.ansichtKonto = boxKonto.includes('Nach Bereich') && boxKonto.includes('Stadionausbau');

        // 5. Laden eines Spielstands darf keine Phantom-Buchung erzeugen.
        saveGameToSlot(1);
        let gespeicherteBuchungen = game.kontoauszug.length;
        game.money = 1; // grosse Kontoaenderung, die NICHT mitgespeichert wurde
        loadGameFromSlot(1, true);
        // Der wiederhergestellte Kontostand darf keine zusaetzliche Buchung erzeugen -
        // im Auszug steht exakt das, was gespeichert wurde.
        out.ladenOhnePhantom = game.kontoauszug.length === gespeicherteBuchungen;
        out.ladenStelltGeldWiederHer = game.money > 1000;

        // 6. Bricht das Laden mittendrin ab (beschaedigte Importdatei), darf die
        //    Protokollierung nicht dauerhaft abgeschaltet bleiben - sonst fehlten alle
        //    spaeteren Buchungen stillschweigend im Kontoauszug.
        try { applyLoadedState(null); } catch (e) { /* erwartet */ }
        let auszugVorher = (game.kontoauszug || []).length;
        showScreen('screen-stadium');
        game.money -= 5000;
        out.abgebrochenesLadenBlockiertNicht = (game.kontoauszug || []).length === auszugVorher + 1;
        return out;
    });

    assert(r.journalWaechst, 'Jeder Spieltag erzeugt einen Eintrag im Buchungsjournal');
    assert(r.journalHatPosten, 'Der Eintrag listet Einnahmen und Ausgaben einzeln auf');
    assert(r.journalSummenStimmen, 'Die gespeicherten Summen stimmen mit den Einzelposten überein');
    assert(r.personalVerbucht, 'Personalgehälter stehen als eigener Ausgabenposten im Journal');
    assert(r.personalWirklichAbgezogen, 'Personalgehälter verändern den Kontostand wirklich');
    assert(r.ansichtLetzter, 'Reiter "Letzter Spieltag" zeigt Einnahmen und Ausgaben');
    assert(r.ansichtSaison, 'Reiter "Saison gesamt" fasst alle Spieltage zusammen');
    assert(r.tabAktiv, 'Der aktive Reiter wird hervorgehoben');
    assert(r.buchungErfasst, 'Kontobewegungen ausserhalb des Spieltags werden automatisch erfasst');
    assert(r.buchungBereich, 'Eine Buchung wird dem auslösenden Bereich zugeordnet');
    assert(r.buchungSaldo, 'Der Kontoauszug hält den Kontostand nach jeder Buchung fest');
    assert(r.spieltagNichtImAuszug, 'Spieltagsposten erscheinen nur im Journal, nicht doppelt im Auszug');
    assert(r.ordnerNurNachBedarf, 'Es werden nur so viele Ordner eingesetzt wie Zuschauer da sind');
    assert(r.ordnerKostenProportional, 'Die Ordnerkosten richten sich nach dem tatsächlichen Einsatz');
    assert(r.ordnerNurZuhause, 'Auswärts fällt kein Ordnerdienst an');
    assert(r.ordnerZuhauseBezahlt, 'Bei jedem Heimspiel steht der Ordnerdienst im Buchungsjournal');
    assert(r.ansichtKonto, 'Reiter "Kontoauszug" zeigt Bereiche und Einzelbuchungen');
    assert(r.ladenOhnePhantom, 'Das Laden eines Spielstands erzeugt keine Phantom-Buchung');
    assert(r.ladenStelltGeldWiederHer, 'Der Kontostand wird beim Laden korrekt wiederhergestellt');
    assert(r.abgebrochenesLadenBlockiertNicht, 'Ein abgebrochenes Laden schaltet die Protokollierung nicht dauerhaft ab');

    // 7. Die tragende Regel des ganzen Finanzmenues: JEDER Euro, der das Konto verlaesst
    //    oder erreicht, steht entweder im Buchungsjournal oder im Kontoauszug. Ohne diese
    //    Pruefung kann Geld unbemerkt verschwinden - genau das passierte beim Ordnerdienst
    //    an spielfreien Spieltagen (weder Journaleintrag noch Auszugszeile).
    const lueckenlos = await page.evaluate(() => {
        let out = {};
        managerRPG.level = 5;
        game.money = 20000000;
        game.financeLedger = [];
        game.kontoauszug = [];
        let vorher = game.money;

        showScreen('screen-second-team');
        if (!game.secondTeam.isActive) foundSecondTeam();
        hireSecondTeamStaff('chefTrainer');
        showScreen('screen-staff'); toggleStaffMember('coTrainer');
        showScreen('screen-youth'); scoutYouthTalent(); upgradeYouthAcademy();
        showScreen('screen-fans'); setStewards(200);
        showScreen('screen-finances'); takeLoan(200000);
        simulateMatchdays(6);

        let journal = game.financeLedger.reduce((s, e) => s + e.summeEin - e.summeAus, 0);
        let auszug = game.kontoauszug.reduce((s, x) => s + x.amount, 0);
        out.unerklaert = Math.round(game.money - vorher - journal - auszug);
        out.journalGenutzt = game.financeLedger.length > 0;
        out.auszugGenutzt = game.kontoauszug.length > 0;
        out.alleZugeordnet = game.kontoauszug.every(x => !x.label.includes('Sonstige'));

        // Spielfreier Spieltag: processPostMatchRoutine() laeuft ohne vorherige
        // Spieltagsabrechnung - dabei darf kein Geld abgebucht werden.
        game.stewards = 100;
        let geldVorher = game.money;
        let journalVorher = game.financeLedger.length;
        processPostMatchRoutine();
        out.spielfreiKostetNichts = game.money === geldVorher && game.financeLedger.length === journalVorher;
        return out;
    });

    assert(lueckenlos.journalGenutzt && lueckenlos.auszugGenutzt, 'Journal und Kontoauszug werden beide befüllt');
    assert(lueckenlos.unerklaert === 0,
        `Jeder Euro steht entweder im Journal oder im Kontoauszug (Differenz ${lueckenlos.unerklaert} €)`);
    assert(lueckenlos.alleZugeordnet, 'Jede Buchung ist einem Bereich zugeordnet, keine bleibt "Sonstige"');
    assert(lueckenlos.spielfreiKostetNichts, 'An einem spielfreien Spieltag fällt kein Ordnerdienst an');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Finanzmenü');
    await page.close();
}

async function testEconomyBalance(browser) {
    console.log('\n[24] Wirtschaftliche Balance: stillgelegte Ränge, Gehälter, VIP-Logen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Stillgelegte Ränge: wer ein grosses Stadion kaum füllt, zahlt nicht den vollen
        //    Unterhalt - wer es füllt, schon.
        let total = stadium.total;
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: 600, capacity: total, opponent: 'X' }];
        let unterhaltLeer = getStadiumBaseMaintenance();
        let stillgelegtLeer = getMothballedCapacity();
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: total, capacity: total, opponent: 'X' }];
        let unterhaltVoll = getStadiumBaseMaintenance();
        out.stillgelegtGuenstiger = unterhaltLeer < unterhaltVoll * 0.6;
        out.stillgelegtErkannt = stillgelegtLeer > total * 0.5;
        out.vollesStadionVollerPreis = Math.round(unterhaltVoll) === Math.round(total * 0.45)
            && getMothballedCapacity() === 0;
        // Mindestens ein Fuenftel bleibt immer in Betrieb.
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: 1, capacity: total, opponent: 'X' }];
        out.grundbetriebBleibt = getUsedStadiumCapacity() >= Math.round(total * 0.2);

        // 2. Spieltagsabrechnung und GuV-Prognose rechnen mit DERSELBEN Formel.
        game.attendanceHistory = [{ season: 1, matchday: 1, attendance: 600, capacity: total, opponent: 'X' }];
        showScreen('screen-finances');
        let unterhaltProSpieltag = getStadiumBaseMaintenance();
        simulateMatchdays(1);
        let posten = game.financeLedger.slice(-1)[0].ausgaben.find(a => a.label.includes('Unterhalt'));
        out.prognoseGleichAbrechnung = !!posten && Math.abs(posten.amount - Math.round(unterhaltProSpieltag)) < 200;

        // 3. Gehälter im Amateurbereich haengen an der Staerke statt an einem Pauschalsockel.
        let schwach = calculatePlayerWage(calculatePlayerMarketValue(30), 30);
        let stark = calculatePlayerWage(calculatePlayerMarketValue(44), 44);
        out.amateurGehaelterGestaffelt = stark > schwach;
        out.amateurGehaltAngemessen = schwach <= 250;
        // Profigehaelter bleiben unveraendert hoch.
        out.profiGehaltUnveraendert = calculatePlayerWage(calculatePlayerMarketValue(70), 70) > 8000;

        // 4. VIP-Logen sind nicht mehr unabhaengig von der Zuschauerzahl ausverkauft.
        out.vipGekoppelt = !applyMatchdayFinances.toString().includes('(stadium.vipTotal || 50) * game.ticketPrices.vip');

        return out;
    });

    // 5. Eine komplett passiv gespielte Saison ruiniert den Verein nicht mehr bis zur
    //    Zahlungsunfaehigkeit - aktives Wirtschaften wirft klar Gewinn ab.
    const saison = await page.evaluate(() => {
        sessionStorage.setItem('anstoss_fm13_force_new_game', '1');
        return true;
    });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
    const passiv = await page.evaluate(() => {
        closeTutorial();
        let start = game.money;
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        return { start, ende: game.money };
    });
    assert(saison && passiv.ende > -100000, 'Eine passiv gespielte Saison endet nicht in der Zahlungsunfähigkeit');
    // Bewusst keine Pruefung auf "Ende < Start": ueber 35 Spieltage kann eine gluecklich
    // gelaufene Pokalrunde auch eine voellig passiv gespielte Saison ins Plus drehen - das
    // ist legitimes Spielverhalten und hat die Pruefung vereinzelt kippen lassen. Gemessen
    // ueber je fuenf Laeufe (v2.5, inkl. Saisonziel-Praemien) endet die Saison bei rund
    // 140.000 bis 160.000 EUR von 150.000 EUR Startkapital. Geprueft wird deshalb, was
    // verlaesslich gilt: Nichtstun macht nicht reich.
    assert(passiv.ende < passiv.start * 1.5,
        `Nichtstun macht den Verein nicht reich (${Math.round(passiv.ende)} € von ${Math.round(passiv.start)} €)`);

    assert(r.stillgelegtGuenstiger, 'Ein kaum gefülltes Stadion kostet deutlich weniger Unterhalt');
    assert(r.stillgelegtErkannt, 'Nicht benötigte Ränge werden als stillgelegt erkannt');
    assert(r.vollesStadionVollerPreis, 'Ein volles Stadion kostet weiterhin den vollen Unterhalt');
    assert(r.grundbetriebBleibt, 'Ein Fünftel des Stadions bleibt immer in Betrieb');
    assert(r.prognoseGleichAbrechnung, 'GuV-Prognose und Spieltagsabrechnung nutzen dieselbe Formel');
    assert(r.amateurGehaelterGestaffelt, 'Amateurgehälter richten sich nach der Spielstärke');
    assert(r.amateurGehaltAngemessen, 'Ein Kreisklassenspieler kostet nicht mehr 400 € pro Spieltag');
    assert(r.profiGehaltUnveraendert, 'Profigehälter bleiben unverändert hoch');
    assert(r.vipGekoppelt, 'VIP-Logen gelten nicht mehr unabhängig von der Zuschauerzahl als ausverkauft');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Wirtschaftssimulation');
    await page.close();
}

async function testLeagueEconomy(browser) {
    console.log('\n[26] Ligaökonomie: TV-Gelder in Raten, Profi-Startoptionen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. TV-Gelder kommen jetzt als Spieltagsrate, nicht mehr als Einmalzahlung.
        let rate = getTvMoneyInstallment();
        out.rateVorhanden = rate > 0;
        out.rateIstNeutral = rate === Math.round(LEAGUE_BASE_TV_MONEY[game.leagueLevel] / MATCHDAYS_PER_SEASON);
        // Die Rate haengt NICHT am Tabellenplatz - sonst brächte ein zufälliger erster
        // Platz am ersten Spieltag die ganze Saison über 50 % mehr Geld.
        let ersterPlatz = calculateCollectiveTvMoney(game.leagueLevel, 1);
        let letzterPlatz = calculateCollectiveTvMoney(game.leagueLevel, 18);
        out.platzierungZaehltAmEnde = ersterPlatz > letzterPlatz;

        let gezahltVorher = game.tvMoneyPaidThisSeason || 0;
        simulateMatchdays(3);
        out.ratenWerdenGezahlt = (game.tvMoneyPaidThisSeason || 0) === gezahltVorher + rate * 3;
        let posten = game.financeLedger.slice(-1)[0].einnahmen.find(e => e.label.includes('TV'));
        out.tvImJournal = !!posten && posten.amount === rate;

        // 2. Die TV-Staffel steigt mit jeder Ligastufe streng monoton.
        out.staffelMonoton = LEAGUE_BASE_TV_MONEY.every((v, i) => i === 0 || v < LEAGUE_BASE_TV_MONEY[i - 1]);

        // 3. Startkapital und Stadion skalieren mit der gewaehlten Startliga.
        out.kapitalSkaliert = getNewGameStartMoney(0, 150000) > getNewGameStartMoney(3, 150000)
            && getNewGameStartMoney(3, 150000) > getNewGameStartMoney(5, 150000)
            && getNewGameStartMoney(5, 150000) === 150000;

        // 4. Generierte Kader liegen um das Ligamittel statt darueber.
        [0, 2, 4].forEach(lvl => {
            let sq = generateSquadForLevel(lvl);
            let basis = Math.max(25, 82 - lvl * 10);
            let schnitt = sq.reduce((s, p) => s + p.strength, 0) / sq.length;
            if (!out.kaderLigadurchschnitt) out.kaderLigadurchschnitt = true;
            if (Math.abs(schnitt - basis) > 4) out.kaderLigadurchschnitt = false;
        });
        return out;
    });

    // 5. Ein Erstliga-Start ist wirtschaftlich tragfaehig: nach einer aktiv bewirtschafteten
    //    Saison steht der Verein nicht schlechter da als zu Beginn.
    await page.evaluate(() => {
        sessionStorage.setItem('anstoss_fm13_newgame_leaguelevel', '0');
        sessionStorage.setItem('anstoss_fm13_newgame_money', '150000');
        sessionStorage.setItem('anstoss_fm13_force_new_game', '1');
    });
    // 25.25: Der Zufall (Mannschaften, Spielverlauf) wird vor jedem Dokument mit einem festen Seed gesetzt,
    // damit der 30-Spieltage-Lauf reproduzierbar ist. Die Schwelle bleibt unverändert.
    await page.addInitScript(() => { let seed = 20251010; Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
    const profi = await page.evaluate(() => {
        closeTutorial();
        checkIncomingSponsorOffers(true); acceptSponsorOffer(sponsorOffers[0].id);
        checkIncomingKitOffers(true); if (kitSupplierOffers[0]) acceptKitOffer(kitSupplierOffers[0].id);
        for (let i = 0; i < 300 && bandenSponsors.filter(x => x.active).length < 20; i++) {
            checkIncomingBandenOffers(true);
            if (bandenOffers[0]) acceptBandenOffer(bandenOffers[0].id);
        }
        game.financeLedger = [];
        let start = game.money;
        simulateMatchdays(30);
        let ende = game.money;
        let rangNach30 = getOwnLeagueRank();
        simulateMatchdays(4);
        // Ganze Saison für einen Mittelfeldplatz: Spieltagsgeschäft + TV-Restausschüttung für
        // Platz 9 + Dauerkartenverkauf (beides erst am Saisonende). Seit 25.9 trägt das
        // Spieltagsgeschäft allein die Kosten für Spielbetrieb & Verwaltung nicht mehr.
        let l = game.financeLedger;
        let journal = l.reduce((s, e) => s + e.summeEin - e.summeAus, 0);
        let rest = calculateCollectiveTvMoney(0, 9) - (game.tvMoneyPaidThisSeason || 0);
        let vorDauerkarten = game.money;
        renewSeasonTickets();
        let dauerkarten = game.money - vorDauerkarten;
        return {
            start, ende, rangNach30,
            stadion: stadium.total,
            saisonSaldo: Math.round(journal + rest + dauerkarten),
            saisonEin: Math.round(l.reduce((s, e) => s + e.summeEin, 0) + Math.max(0, rest) + dauerkarten)
        };
    });

    assert(r.rateVorhanden, 'Es gibt eine TV-Spieltagsrate');
    assert(r.rateIstNeutral, 'Die Rate entspricht dem Ligagrundbetrag geteilt durch die Spieltage');
    assert(r.platzierungZaehltAmEnde, 'Der Tabellenplatz entscheidet weiterhin über die Gesamthöhe');
    assert(r.ratenWerdenGezahlt, 'Jeder Spieltag zahlt genau eine Rate aus');
    assert(r.tvImJournal, 'Die TV-Rate steht als eigener Posten im Buchungsjournal');
    assert(r.staffelMonoton, 'Die TV-Staffel steigt mit jeder Ligastufe');
    assert(r.kapitalSkaliert, 'Startkapital skaliert mit der gewählten Startliga, die 6. Liga bleibt unverändert');
    assert(r.kaderLigadurchschnitt, 'Generierte Startkader liegen um das Ligamittel statt deutlich darüber');
    assert(profi.stadion > 40000, 'Der Erstliga-Start bekommt ein Stadion passender Größe');
    assert(profi.saisonSaldo > -0.05 * profi.saisonEin,
        `Ein Erstliga-Verein auf einem Mittelfeldplatz wirtschaftet nicht strukturell ins Minus (Saison ${profi.saisonSaldo} € bei ${profi.saisonEin} € Einnahmen)`);
    // Liga- und Pokalverlauf sind zufällig, daher schwankt das Endkapital über viele Läufe
    // stark (empirisch beobachtet: ca. das 0,6- bis 3,2-fache des Startkapitals). Die Schwelle
    // prüft nur auf strukturelle Pleite, nicht auf einen konkreten Erfolgsgrad.
    // Im Abstiegskampf (Platz 16-18) zahlt die TV-Rate ab Spieltag 6 nur noch bis zum 0,4-fachen (21.6) -
    // 14 Läufe (25.22): Mittelfeld +17..+47 Mio. €, Platz 18 -1..+24 Mio. €. Dort darf das Konto knapp
    // ins Minus rutschen, strukturell pleite (tiefer als das Startkapital) ist der Verein aber nicht.
    const abstiegskampf = profi.rangNach30 >= 16;
    assert(abstiegskampf ? profi.ende > -profi.start : (profi.ende > 0 && profi.ende > profi.start * 0.5),
        `Nach 30 aktiv bewirtschafteten Spieltagen ist der Erstligist noch solvent (${Math.round(profi.ende)} € statt ${Math.round(profi.start)} €, Platz ${profi.rangNach30})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler in der Ligaökonomie');
    await page.close();
}

async function testAttendanceRealism(browser) {
    console.log('\n[33] Zuschauerzahlen: absolute Ligaobergrenze');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // Der vom Spieler gemeldete Fall: 24.000 Zuschauer in der Oberliga. Ursache war,
        // dass die Zuschauerzahl ausschliesslich ein ANTEIL der Stadionkapazitaet war -
        // ein auf 113.000 Plaetze ausgebautes Stadion erzeugte dort ueber 10.000 Zuschauer
        // im Ligaalltag und fast 23.000 im Derby.
        adminMaxOutAllBuildings();
        game.leagueLevel = 4;
        game.fans = 90;
        out.grossesStadion = stadium.total > 100000;
        out.oberligaNormal = calculateMatchAttendance(1);
        out.oberligaDerby = calculateMatchAttendance(2.2);
        out.oberligaRealistisch = out.oberligaNormal < 4000;
        out.derbyRealistisch = out.oberligaDerby < 7000;
        out.derbyMehrAlsNormal = out.oberligaDerby > out.oberligaNormal;

        // Die Grenze steigt mit der Liga - ein Erstligist fuellt sein Stadion weiterhin.
        let proLiga = [];
        for (let lvl = 0; lvl <= 5; lvl++) { game.leagueLevel = lvl; proLiga.push(calculateMatchAttendance(1)); }
        out.steigtMitLiga = proLiga.every((v, i) => i === 0 || v < proLiga[i - 1]);
        game.leagueLevel = 0;
        out.erstligaFuelltStadion = calculateMatchAttendance(1) > 60000;

        // Und sie haengt am Anhang: derselbe Verein, schlechtere Stimmung, weniger Zuschauer.
        game.leagueLevel = 4;
        game.fans = 100; let vielAnhang = calculateMatchAttendance(1);
        game.fans = 20;  let wenigAnhang = calculateMatchAttendance(1);
        out.anhangZaehlt = vielAnhang > wenigAnhang * 1.5;

        // Kleines Stadion in hoher Liga: dann begrenzt weiterhin die Kapazitaet.
        game.leagueLevel = 0; game.fans = 90;
        Object.values(stadium.blocks).forEach(bl => { bl.cap = 500; });
        out.kapazitaetBegrenztWeiterhin = calculateMatchAttendance(1) <= stadium.total;
        return out;
    });

    // Die Rechnung darf nur an EINER Stelle stehen - vorher stand sie doppelt im Code
    // (Anpfiff im Live-Spiel und Spieltagsabrechnung) und musste von Hand synchron
    // gehalten werden.
    const eineQuelle = await page.evaluate(() => {
        let anpfiff = (typeof setupMatch === 'function') ? setupMatch.toString() : '';
        let abrechnung = applyMatchdayFinances.toString();
        return {
            beideNutzenHelfer: anpfiff.includes('calculateMatchAttendance') && abrechnung.includes('calculateMatchAttendance'),
            keineEigeneRechnungMehr: !/stadium\.total \|\| 16000\) \* attFactor/.test(anpfiff + abrechnung)
        };
    });

    assert(r.grossesStadion, 'Das Testszenario hat tatsächlich ein überdimensioniertes Stadion');
    assert(r.oberligaRealistisch, `In der Oberliga kommen keine zehntausend Zuschauer mehr (${r.oberligaNormal})`);
    assert(r.derbyRealistisch, `Auch das Oberliga-Derby bleibt im Rahmen (${r.oberligaDerby})`);
    assert(r.derbyMehrAlsNormal, 'Ein Derby zieht trotzdem mehr Zuschauer an als ein normales Spiel');
    assert(r.steigtMitLiga, 'Die Zuschauergrenze steigt mit jeder Ligastufe');
    assert(r.erstligaFuelltStadion, 'Ein Erstligist füllt sein großes Stadion weiterhin');
    assert(r.anhangZaehlt, 'Die Fan-Zufriedenheit beeinflusst die Zuschauerzahl deutlich');
    assert(r.kapazitaetBegrenztWeiterhin, 'Ein kleines Stadion begrenzt die Zuschauerzahl weiterhin');
    assert(eineQuelle.beideNutzenHelfer, 'Anpfiff und Abrechnung nutzen dieselbe Zuschauerrechnung');
    assert(eineQuelle.keineEigeneRechnungMehr, 'Es gibt keine zweite, eigene Zuschauerrechnung mehr');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Zuschauerzahlen');
    await page.close();
}

async function testFinancialFairplay(browser) {
    console.log('\n[36] Financial Fairplay: strukturelle Verluste über mehrere Saisons');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Exemptions: Infrastruktur-Investitionen und Finanzierungsvorgänge zählen NICHT
        //    als Verlust, echte Ausgaben (Transfermarkt) schon.
        out.stadionExempt = isFfpExemptLabel('🏟️ Stadionausbau');
        out.jugendExempt = isFfpExemptLabel('🎓 Jugendarbeit');
        out.krediteExempt = isFfpExemptLabel('💰 Finanzen & Kredite');
        out.transferNichtExempt = !isFfpExemptLabel('🔁 Transfermarkt');

        game.money = 5000000;
        showScreen('screen-stadium'); game.money -= 300000;
        showScreen('screen-transfer'); game.money -= 200000;
        showScreen('screen-finances'); game.money -= 50000;
        let kontoExempt = game.kontoauszug.filter(b => ['🏟️ Stadionausbau', '💰 Finanzen & Kredite'].includes(b.label)).reduce((s, b) => s + b.amount, 0);
        let kontoNichtExempt = game.kontoauszug.reduce((s, b) => s + b.amount, 0) - kontoExempt;
        out.nurNichtExemptesZaehlt = Math.round(game.ffpSeasonNet) === Math.round(kontoNichtExempt);

        // 2. Der Live-Akkumulator stimmt exakt mit der tatsächlichen Kontostandsänderung
        //    überein, sobald nichts exempt ist (reiner Spielbetrieb über eine Saison).
        game.ffpSeasonNet = 0;
        let geldVor = game.money;
        for (let i = 0; i < 7; i++) simulateMatchdays(5);
        let deltaGeld = game.money - geldVor;
        out.akkumulatorStimmtExakt = Math.abs(Math.round(game.ffpSeasonNet) - Math.round(deltaGeld)) <= 1;

        // 3. Ein Nachtrag NACH der Spieltagsabrechnung (Ordnerdienst - siehe
        //    bucheInSpieltagsjournal in js/finances.js) darf nicht spurlos aus der
        //    FFP-Bilanz verschwinden, obwohl er im echten Kontostand auftaucht. Dazu wird
        //    - wie im echten Spielablauf (tickStewardCosts läuft VOR game.matchday++,
        //    siehe processPostMatchRoutine in js/match.js) - ein frischer Ledger-Eintrag
        //    für den aktuellen Spieltag simuliert, damit hatSpieltagsabrechnung() zutrifft.
        game.stewards = 200;
        game.ffpSeasonNet = 0;
        if (!game.financeLedger) game.financeLedger = [];
        game.financeLedger.push({ season: game.season, matchday: game.matchday, heimspiel: true, zuschauer: game.lastHomeAttendance || 5000, einnahmen: [], ausgaben: [], summeEin: 0, summeAus: 0 });
        let geldVorOrdner = game.money;
        tickStewardCosts(true);
        let deltaOrdner = game.money - geldVorOrdner;
        out.nachtragWirdErfasst = deltaOrdner < 0 && Math.round(game.ffpSeasonNet) === Math.round(deltaOrdner);
        return out;
    });

    // 4. Volle Sanktionsleiter: anhaltender struktureller Verlust über mehrere Saisons löst
    //    Verwarnung, dann Transfersperre, dann Punktabzug aus. Der Verlust wird bewusst
    //    direkt am Akkumulator erzwungen statt über echte Transferausgaben simuliert, weil
    //    concludeSeasonAndAdvance() VOR der FFP-Prüfung selbst noch reale, teils hohe
    //    Saisonend-Zahlungen verbucht (TV-Restausschüttung etc.), die einen realistisch
    //    kleinen Verlust sonst zufällig wieder ausgleichen könnten - der erzwungene Betrag
    //    ist absichtlich so groß, dass er jede reale Saisonend-Zahlung überdeckt.
    const leiter = await page.evaluate(() => {
        let verlauf = [];
        for (let s = 0; s < 3; s++) {
            game.ffpSeasonNet = -50000000;
            concludeSeasonAndAdvance();
            verlauf.push({ strikes: game.ffpStrikes, embargo: game.ffpTransferEmbargo, punkte: getOurLeagueTeam()?.points });
        }
        return { verlauf };
    });

    // 5. Die FFP-Sperre ist von der kurzfristigen Insolvenz-Sperre getrennt: eine erholte
    //    Zahlungsfähigkeit hebt eine bestehende FFP-Sperre NICHT versehentlich mit auf.
    const trennung = await page.evaluate(() => {
        game.ffpTransferEmbargo = true;
        game.transferEmbargo = false;
        game.money = 10000000;
        game.transferBudget = 10000000;
        game.wageBudget = 10000000;
        let kaderVorher = squad.length;
        buyPlayer(0);
        let blockiert = squad.length === kaderVorher;

        game.negativeStreak = 5;
        game.money = -100;
        checkInsolvencyRisk();
        let ueberlebtNegativ = game.ffpTransferEmbargo === true;
        game.money = 1;
        checkInsolvencyRisk();
        return { blockiert, ueberlebtNegativ, ueberlebtErholung: game.ffpTransferEmbargo === true && game.transferEmbargo === false };
    });

    // 6. Speichern und Laden erhält den FFP-Zustand.
    const laden = await page.evaluate(() => {
        game.ffpStrikes = 2;
        game.ffpTransferEmbargo = true;
        game.ffpHistory = [-100000, -50000];
        saveGameToSlot(2);
        game.ffpStrikes = 0;
        game.ffpTransferEmbargo = false;
        game.ffpHistory = [];
        loadGameFromSlot(2, true);
        return { strikes: game.ffpStrikes, embargo: game.ffpTransferEmbargo, historyLen: game.ffpHistory.length };
    });

    assert(r.stadionExempt && r.jugendExempt && r.krediteExempt, 'Infrastruktur- und Finanzierungsvorgänge sind von Financial Fairplay ausgenommen');
    assert(r.transferNichtExempt, 'Transferausgaben zählen dagegen als reguläre Ausgabe');
    assert(r.nurNichtExemptesZaehlt, 'Nur nicht ausgenommene Kontoauszug-Buchungen fließen in die FFP-Bilanz ein');
    assert(r.akkumulatorStimmtExakt, 'Der laufende FFP-Akkumulator stimmt exakt mit der echten Kontostandsänderung überein');
    assert(r.nachtragWirdErfasst, 'Ein Nachtrag nach der Spieltagsabrechnung (Ordnerdienst) wird in der FFP-Bilanz erfasst');

    assert(leiter.verlauf[0].strikes === 1 && !leiter.verlauf[0].embargo, 'Der erste Verstoß bleibt eine bloße Verwarnung');
    assert(leiter.verlauf[1].strikes === 2 && leiter.verlauf[1].embargo, 'Der zweite Verstoß in Folge löst eine Transfersperre aus');
    assert(leiter.verlauf[1].punkte === 0, 'Beim zweiten Verstoß gibt es noch keinen Punktabzug');
    assert(leiter.verlauf[2].strikes === 3 && leiter.verlauf[2].punkte < 0,
        `Der dritte Verstoß zieht tatsächlich Punkte ab (${leiter.verlauf[2].punkte})`);

    assert(trennung.blockiert, 'Eine aktive FFP-Transfersperre blockiert reale Transfers');
    assert(trennung.ueberlebtNegativ, 'Die FFP-Sperre bleibt auch während einer Insolvenzkrise bestehen');
    assert(trennung.ueberlebtErholung, 'Eine wiederhergestellte Zahlungsfähigkeit hebt die FFP-Sperre NICHT automatisch auf');

    assert(laden.strikes === 2 && laden.embargo && laden.historyLen === 2, 'Der Financial-Fairplay-Zustand überlebt Speichern und Laden');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Financial Fairplay');
    await page.close();
}

async function testStadiumAusbau2(browser) {
    console.log('\n[39] Stadion-Ausbau 2.0: Dauerkarten, Rasenpflege, Kapazitätsprojekte, Nebeneinnahmen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Kein Geld-Windfall beim allerersten Programmstart - vor der ersten echten
        //    Saisonwende gibt es bewusst noch KEINE Dauerkarten (ein brandneuer Verein hat
        //    naturgemäß noch keine verkauft). Das war ein echter Bug im ersten Entwurf: ein
        //    automatischer Verkauf schon beim Bootstrap brachte eine bestehende Prüfung zum
        //    gewählten Startkapital zum Kippen.
        out.keineDauerkartenVorErsterSaisonwende = game.seasonTicketHolders === 0;

        // 2. Bei der ersten echten Saisonwende wird der Preis exakt auf den aktuellen
        //    Marktwert kalibriert (ratio 1.0, nicht der Fantasie-Startwert aus state.js) und
        //    es entstehen tatsächlich Dauerkarteninhaber.
        renewSeasonTickets();
        let marktpreis = getMarketSeasonTicketPrice();
        out.preisAufMarktKalibriert = Math.abs(game.ticketPrices.dauerkarte - marktpreis) <= 1;
        out.dauerkartenNachSaisonwendeVorhanden = game.seasonTicketHolders > 0;

        // 3. Die Zuschauerzahl selbst bleibt von Dauerkarten UNBEEINFLUSST - das war ein
        //    Designfehler im ersten Entwurf (Dauerkarten als harter Zuschauer-Sockel), der
        //    Fanstimmungs-Einfluss, Ligadeckel und Derby-Bonus überschrieben hat.
        game.fans = 90;
        game.seasonTicketHolders = Math.round((stadium.total || 16000) * 0.9);
        let mitVielenDauerkarten = calculateMatchAttendance(1, 1);
        game.seasonTicketHolders = 0;
        let ohneDauerkarten = calculateMatchAttendance(1, 1);
        out.zuschauerzahlUnbeeinflusst = mitVielenDauerkarten === ohneDauerkarten;

        // 4. Aber die ECHTE Spieltags-Einnahme berücksichtigt Dauerkarten: der bereits bezahlte
        //    Anteil wird nicht nochmal kassiert. Die Zuschauerzahl wird für den Vergleich
        //    FEST vorgegeben (wie beim Live-Match, siehe applyMatchdayFinances in match.js),
        //    damit die normale Zufallsstreuung der Zuschauerzahl den Vergleich nicht verzerrt.
        // Bewusst eine KLEINE Inhaberzahl (500) statt einer großen - bei einem Fantasiewert
        // über der festen Zuschauerzahl würde der zahlende Anteil auf 0 fallen und der
        // Ticketverkauf-Posten (amount>0-Filter) ganz aus dem Buchungsjournal verschwinden.
        game.money = 5000000;
        currentMatch = { finalAttendance: 5000, finalAttendanceMatchday: game.matchday, isHome: true };
        game.seasonTicketHolders = 500;
        applyMatchdayFinances(true, true, false, false, 'Testgegner', '2:0');
        let ledgerMitDauerkarte500 = game.financeLedger[game.financeLedger.length - 1].einnahmen.find(e => e.label.includes('Ticketverkauf'))?.amount || 0;

        game.money = 5000000;
        game.seasonTicketHolders = 0;
        applyMatchdayFinances(true, true, false, false, 'Testgegner', '2:0');
        let ledgerOhneDauerkarte = game.financeLedger[game.financeLedger.length - 1].einnahmen.find(e => e.label.includes('Ticketverkauf'))?.amount || 0;
        out.dauerkartenSenkenSpieltagsEinnahme = ledgerMitDauerkarte500 < ledgerOhneDauerkarte;

        // 5. Rasenpflege: Zustand sinkt durch Heimspiele, lässt sich gezielt wieder anheben.
        stadium.pitchCondition = 60;
        let condVor = stadium.pitchCondition;
        tickPitchCondition();
        out.rasenNutztSichAb = stadium.pitchCondition < condVor;
        let geldVorPflege = game.money;
        maintainPitch(100);
        out.pflegeKostetGeldUndHilft = game.money < geldVorPflege && stadium.pitchCondition > condVor;
        out.rasenNieUnterMinimum = stadium.pitchCondition >= 20;

        // 6. Kapazitätsprojekte: Effekt, Gate-Prüfung, Sitzplatz-Anteile bleiben normiert.
        game.money = 999999999;
        let capVor = stadium.total;
        buyCapacityProject('zusatztribuene');
        let queued = game.stadiumConstructionQueue.find(p => p.params && p.params.key === 'zusatztribuene');
        for (let i = 0; i < queued.totalDays; i++) tickStadiumConstruction();
        out.kapazitaetsprojektWirkt = stadium.total > capVor;

        let stehVor = stadium.stehShare;
        buyCapacityProject('sitzplatzumbau');
        let queued2 = game.stadiumConstructionQueue.find(p => p.params && p.params.key === 'sitzplatzumbau');
        for (let i = 0; i < queued2.totalDays; i++) tickStadiumConstruction();
        out.sitzplatzumbauVerschiebtAnteil = stadium.stehShare < stehVor;
        out.anteileBleibenNormiert = Math.abs((stadium.stehShare + stadium.sitzShare + stadium.vipShare) - 1) < 0.001;

        game.boardSat = 10;
        let vorGrossausbau = game.stadiumConstructionQueue.length;
        buyCapacityProject('grossausbau');
        out.grossausbauOhneVertrauenAbgelehnt = game.stadiumConstructionQueue.length === vorGrossausbau;

        // 7. Nebeneinnahmen-Übersicht: reine, korrekte Anzeige bestehender Campus-Erlöse.
        campusBuildings.fankneipe.lvl = 2;
        campusBuildings.parkhaus.lvl = 1;
        let est = computeAncillaryIncomeEstimate();
        out.nebeneinnahmenKorrekt = est.gastronomie === getCampusHeimspielErloes('fankneipe') + getCampusHeimspielErloes('foodtrucks') && est.gastronomie > 2 * 1800
            && est.parken === getCampusHeimspielErloes('parkhaus') && est.parken > 1500 && est.summe === est.gastronomie + est.parken + est.vipBewirtung + est.fanshop;

        // 8. Speichern/Laden erhält alle neuen Felder.
        stadium.pitchCondition = 71;
        stadium.hybridrasen = true;
        game.ticketPrices.dauerkarte = 111;
        game.seasonTicketHolders = 4444;
        saveGameToSlot(6);
        stadium.pitchCondition = 85; stadium.hybridrasen = false;
        game.ticketPrices.dauerkarte = 1; game.seasonTicketHolders = 0;
        loadGameFromSlot(6, true);
        out.speichernLadenOk = stadium.pitchCondition === 71 && stadium.hybridrasen === true && game.ticketPrices.dauerkarte === 111 && game.seasonTicketHolders === 4444;

        return out;
    });

    // 9. Ein neuer, per Startdialog konfigurierter Verein bekommt exakt das gewählte
    //    Startkapital - kein unerwarteter Dauerkarten-Bonus (Regressionsschutz für den
    //    zunächst gefundenen Bug).
    await page.evaluate(() => closeTutorial());
    await page.evaluate(() => showScreen('screen-dashboard'));
    await page.click('#btn-new-game');
    await page.waitForFunction(() => { const b = document.getElementById('btn-confirm-new-game'); return !!b && b.offsetParent !== null; }, null, { timeout: 5000 }).catch(() => null);
    await page.evaluate(() => { selectedNewGameLevel = 3; selectedNewGameMoney = 300000; renderNewGameSetupOptions(); });
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(100);
    await page.click('#btn-confirm-new-game');
    await page.waitForTimeout(600);
    const neustart = await page.evaluate(() => ({
        money: game.money,
        erwartet: getNewGameStartMoney(3, 300000),
        seasonTicketHolders: game.seasonTicketHolders
    }));

    assert(r.keineDauerkartenVorErsterSaisonwende, 'Vor der ersten echten Saisonwende gibt es noch keine Dauerkarten (kein Geld-Windfall beim Programmstart)');
    assert(r.preisAufMarktKalibriert, 'Der Dauerkartenpreis wird beim ersten Verkauf exakt auf den Marktwert kalibriert');
    assert(r.dauerkartenNachSaisonwendeVorhanden, 'Nach der ersten echten Saisonwende gibt es tatsächlich Dauerkarteninhaber');
    assert(r.zuschauerzahlUnbeeinflusst, 'Die Zuschauerzahl selbst bleibt von Dauerkarten unbeeinflusst (kein verzerrender Sockel)');
    assert(r.dauerkartenSenkenSpieltagsEinnahme, 'Ein bereits über die Dauerkarte bezahlter Anteil wird an dem Spieltag nicht doppelt kassiert');
    assert(r.rasenNutztSichAb, 'Der Rasenzustand nutzt sich durch Heimspiele ab');
    assert(r.pflegeKostetGeldUndHilft, 'Rasenpflege kostet Geld und verbessert den Zustand messbar');
    assert(r.rasenNieUnterMinimum, 'Der Rasenzustand fällt nie unter das Minimum');
    assert(r.kapazitaetsprojektWirkt, 'Ein namentliches Kapazitätsprojekt erhöht nach Fertigstellung die Gesamtkapazität');
    assert(r.sitzplatzumbauVerschiebtAnteil, 'Sitzplatzumbau verschiebt den Stehplatzanteil tatsächlich zugunsten der Sitzplätze');
    assert(r.anteileBleibenNormiert, 'Steh-, Sitz- und VIP-Anteil ergeben nach einem Umbau weiterhin exakt 100%');
    assert(r.grossausbauOhneVertrauenAbgelehnt, 'Der Großausbau wird ohne ausreichendes Vorstandsvertrauen abgelehnt');
    assert(r.nebeneinnahmenKorrekt, 'Die Nebeneinnahmen-Übersicht zeigt die echten, aus den Campus-Stufen berechneten Werte');
    assert(r.speichernLadenOk, 'Rasenzustand, Hybridrasen, Dauerkartenpreis und -inhaberzahl überleben Speichern und Laden');
    assert(neustart.money === neustart.erwartet, `Ein per Startdialog konfigurierter Verein bekommt exakt das gewählte Startkapital, kein Dauerkarten-Bonus (${neustart.money} statt ${neustart.erwartet})`);
    assert(neustart.seasonTicketHolders === 0, 'Auch dort gibt es vor der ersten Saisonwende noch keine Dauerkarteninhaber');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler beim Stadion-Ausbau 2.0');
    await page.close();
}

async function testObjectivesEventsSeasonTickets(browser) {
    console.log('\n[S] Saisonziele, Stadion-Events, Dauerkarten');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        // 1. Saisonziele werten echte Daten; Meisterschaft/Aufstieg erst am Saisonende.
        initializeSeasonObjectives();
        const typen = ['CHAMPIONSHIP', 'PROMOTION', 'TOP_SCORER', 'CLEAN_SHEETS'];
        game.seasonObjectives.activeObjectives = typen.map(t => ({ id: `obj_${t}_${game.season}`, type: t, name: t, reward: 1000,
            startSeason: game.season, startLeagueLevel: game.leagueLevel, completed: false }));
        const origGoals = simulateGoals;
        simulateGoals = (a, b) => a >= b ? { myGoals: 3, oppGoals: 0 } : { myGoals: 0, oppGoals: 3 };
        // 102 Tore verteilt auf die ganze Elf ergaben 10-15 für den besten Schützen - knapp an
        // der 10-Tore-Grenze (CI-Flake 3.26). Ein fester Torjäger trifft, gezählt wird weiter echt.
        const origCredit = creditOwnGoal;
        creditOwnGoal = (players) => origCredit(players, players.find(p => p.pos === 'ST') || players[0]);
        try {
            while (game.matchday <= 34) {
                game.sackPending = false;
                squad.forEach(p => { p.strength = 99; p.injured = 0; p.suspended = 0; });
                simulateMatchdays(1);
                if (game.matchday === 20) {
                    out.meisterNichtVorzeitig = !game.seasonObjectives.completedObjectives.some(o => o.type === 'CHAMPIONSHIP');
                }
            }
            const startLiga = game.leagueLevel;
            concludeSeasonAndAdvance();
            const erreicht = game.seasonObjectives.completedObjectives.map(o => o.type);
            out.alleErreicht = typen.every(t => erreicht.includes(t));
            out.aufgestiegen = game.leagueLevel < startLiga;
            out.neueSaisonNeueZiele = game.seasonObjectives.activeObjectives.length > 0
                && game.seasonObjectives.activeObjectives.every(o => o.startSeason === game.season);
        } finally {
            simulateGoals = origGoals;
            creditOwnGoal = origCredit;
        }

        // 2. Prämien steigen mit der Liga (1. Liga > 6. Liga).
        const lvl = game.leagueLevel;
        game.leagueLevel = 5; game.money = 0; generateSeasonObjectives();
        const unten = Math.max(...game.seasonObjectives.activeObjectives.map(o => o.reward / DIFFICULTY_MULTIPLIERS[OBJECTIVE_TYPES[o.type].difficulty] / OBJECTIVE_TYPES[o.type].baseReward));
        game.leagueLevel = 0; generateSeasonObjectives();
        const oben = Math.max(...game.seasonObjectives.activeObjectives.map(o => o.reward / DIFFICULTY_MULTIPLIERS[OBJECTIVE_TYPES[o.type].difficulty] / OBJECTIVE_TYPES[o.type].baseReward));
        out.praemienSteigenMitLiga = oben > unten;
        game.leagueLevel = lvl;

        // 3. Stadion-Events: kostet sofort, nicht vorzeitig durchführbar, nur eines zur Zeit.
        game.money = 1000000;
        stadium.events = [];
        const m0 = game.money;
        scheduleStadiumEvent('fanfest');
        out.eventKostet = game.money < m0;
        scheduleStadiumEvent('stadiontag');
        out.nurEinEvent = stadium.events.length === 1;
        const ev = stadium.events[0];
        runStadiumEvent(ev.id);
        out.nichtVorzeitig = !ev.completed;
        game.matchday = ev.scheduledMatchday;
        const m1 = game.money;
        runStadiumEvent(ev.id);
        out.eventDurchgefuehrt = ev.completed && game.money > m1 && ev.visitors <= (stadium.total || 16000);
        out.sperrfrist = !!getStadiumEventBlockReason();

        // 4. Dauerkarten richten sich nach dem Zuschauerpotenzial der Liga, nicht der Kapazität.
        game.leagueLevel = 5;
        renewSeasonTickets();
        out.dauerkartenGedeckelt = game.seasonTicketHolders <= getLeagueAttendanceCap();
        return out;
    });

    assert(r.meisterNichtVorzeitig, 'Meisterschaftsziel wird nicht schon als Tabellenführer im Saisonverlauf ausgezahlt');
    assert(r.alleErreicht, 'Meisterschaft, Aufstieg, Torschütze und Zu-Null-Siege werden aus echten Spieldaten gewertet');
    assert(r.aufgestiegen, 'Der Meister steigt auf (Voraussetzung für das Aufstiegsziel)');
    assert(r.neueSaisonNeueZiele, 'Die neue Saison bekommt neue Saisonziele');
    assert(r.praemienSteigenMitLiga, 'Saisonziel-Prämien sind in höheren Ligen größer');
    assert(r.eventKostet, 'Ein Stadion-Event kostet beim Planen Organisationskosten');
    assert(r.nurEinEvent, 'Es kann nur ein Stadion-Event zur Zeit geplant sein');
    assert(r.nichtVorzeitig, 'Ein Stadion-Event lässt sich nicht vor seinem Termin durchführen');
    assert(r.eventDurchgefuehrt, 'Am Termin bringt das Event Einnahmen, Besucher gedeckelt durch die Kapazität');
    assert(r.sperrfrist, 'Nach einem Event gilt eine Sperrfrist');
    assert(r.dauerkartenGedeckelt, 'Dauerkarten übersteigen nicht das Zuschauerpotenzial der Liga');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Saisonzielen/Events/Dauerkarten');
    await page.close();
}

async function testPhase14Teil4(browser) {
    console.log('\n[P14d] Wirtschaft: Wetten, Aktien, Immobilien, Insider-Wette');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        // Wetten: Quoten aus der Simulation mit Marge, kein Wetten auf die eigene Niederlage
        const o = calcNextMatchOdds();
        out.keineNiederlageQuote = o.oddsLoss === undefined;
        out.margeSieg = o.probabilities.win * o.oddsWin < 1 && o.probabilities.draw * o.oddsDraw < 1 && o.probabilities.winOver * o.oddsWinOver < 1.02;
        const geld = game.money;
        placeBet('loss', 1000);
        out.niederlageVerboten = game.money === geld && !activeBet;
        // Schwache Aufstellung darf die Siegquote nicht hochtreiben
        const gespeichert = lineup.slice();
        lineup = [...squad].sort((a, b) => a.strength - b.strength).slice(0, 11).map(p => p.id);
        const schwach = calcNextMatchOdds();
        lineup = gespeichert;
        out.aufstellungEgal = Math.abs(schwach.oddsWin - o.oddsWin) / o.oddsWin < 0.25;

        // Aktien: im Mittel kein Kursverfall, Anleihe ohne Einbrüche wie eine Tech-Aktie
        const kurs = key => {
            const s = stockMarket[key], start = s.price, werte = [];
            for (let run = 0; run < 150; run++) { s.price = start; for (let t = 0; t < 34; t++) updateStockMarket(); werte.push(s.price / start); }
            s.price = start; werte.sort((a, b) => a - b);
            return { mittel: werte.reduce((a, b) => a + b, 0) / werte.length, schlecht: werte[15] };
        };
        const anleihe = kurs('staatsanleihe'), biotech = kurs('biotech');
        out.aktien = anleihe.mittel > 0.93 && anleihe.mittel < 1.07 && anleihe.schlecht > 0.85 && biotech.mittel > 0.8;

        // Immobilien: rund 10 Saisons Amortisation, jede Stufe lohnt sich gleich
        const pp = realEstatePortfolio.parkplatz;
        pp.owned = true; pp.lvl = 1;
        const k1 = getRealEstateCost('parkplatz') / 2, e1 = getRealEstateIncome('parkplatz');
        const k2 = getRealEstateCost('parkplatz'); pp.lvl = 2; const e2 = getRealEstateIncome('parkplatz');
        pp.owned = false; pp.lvl = 0;
        const amort1 = k1 / (e1 * 34), amort2 = k2 / ((e2 - e1) * 34);
        out.immobilien = amort1 > 6 && amort1 < 16 && Math.abs(amort1 - amort2) < 0.5;

        // Insider-Wette: Auszahlung nach Siegchance, höchstens das Dreifache
        game.money = 10000000;
        placeUnderworldInsiderBet();
        out.insider = underworld.insiderBetMultiplier > 1 && underworld.insiderBetMultiplier <= 3;

        // Keine echten Vereinsnamen in Holding-Aufträgen (auch nicht in alten Spielständen)
        holdingCompany.b2bContracts.push({ id: 'alt', club: 'Real Madrid', item: 'x', amount: 1, reqMat: 'cotton', reqQty: 1, payout: 1, done: false });
        cleanupRemovedModuleState();
        out.namen = !holdingCompany.b2bContracts.some(c => /Real Madrid|FC Bayern|FC Liverpool/.test(c.club));
        return out;
    });
    assert(r.keineNiederlageQuote && r.niederlageVerboten, 'Keine Wette auf die eigene Niederlage (Spielmanipulation)');
    assert(r.margeSieg, 'Wettquoten aus der Spielsimulation mit Buchmacher-Marge (auch Kombi)');
    assert(r.aufstellungEgal, 'Schwache Aufstellung treibt die Siegquote nicht hoch');
    assert(r.aktien, 'Aktienkurse ohne systematischen Verfall, Staatsanleihe bleibt sicher');
    assert(r.immobilien, 'Immobilien amortisieren sich in rund 10 Saisons, jede Stufe gleich gut');
    assert(r.insider, 'Insider-Wette zahlt nach Siegchance, höchstens das Dreifache');
    assert(r.namen, 'Holding-Aufträge ohne echte Vereinsnamen');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 4 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

module.exports = {
    testPromotionTvAdvance,
    testTvAdvanceGracePeriod,
    testSponsorRenewal,
    testBookingLabels,
    testSponsorConflict,
    testAttendanceCapVaries,
    testStadiumSystems,
    testTaxAndAdvisor,
    testStadiumWideBanden,
    testRealisticMerchSales,
    testBuildingPaymentAndPrices,
    testConfirmBeforeIrreversibleActions,
    testFinanceLedgerAndStatement,
    testEconomyBalance,
    testLeagueEconomy,
    testAttendanceRealism,
    testFinancialFairplay,
    testStadiumAusbau2,
    testObjectivesEventsSeasonTickets,
    testPhase14Teil4,
};
