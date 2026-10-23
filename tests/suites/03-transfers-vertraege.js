// Testsuiten: transfers vertraege
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testTransferPoker(browser) {
    console.log('\n[19.2] Transferpoker: Forderung, Schmerzgrenze, Geduld, Rivale, Gehalt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            game.money = 1e9; game.transferBudget = 1e9; game.wageBudget = 1e9;
            game.ffpTransferEmbargo = false; game.transferEmbargo = false;
            showScreen('screen-transfer'); setTransferTab('market');
            const p0 = marketPlayers[0];
            ensureTransferTerms(p0);
            out.konditionen = p0.askingPrice > p0.sellerMinimum && !!p0.sellerClub && leaguesData.some(l => l.some(t => t.name === p0.sellerClub));
            out.marktzeile = document.getElementById('market-list').innerHTML.includes('Verhandeln') && document.getElementById('market-list').innerHTML.includes(p0.sellerClub);
            // Sofortkauf zahlt die Forderung
            const geld0 = game.money, forderung = p0.askingPrice, provision = getAgentFee(p0, forderung);
            buyPlayer(0);
            out.sofortkauf = squad.includes(p0) && geld0 - game.money === forderung + provision;
            // Verhandlung: unter der Schmerzgrenze nie Zusage, Gegenangebot nie darunter
            const p1 = marketPlayers[0];
            openTransferPoker(0);
            transferPoker.rivalChance = 0; transferPoker.patience = 5;
            out.box = document.getElementById('transfer-poker-box').innerHTML.includes('Transferpoker');
            Math.random = () => 0;
            transferPoker.offer = p1.sellerMinimum - 1000;
            submitPokerOffer();
            out.keineZusageUnterGrenze = !transferPoker.agreedFee && p1.askingPrice >= p1.sellerMinimum;
            // Frechheit kostet doppelte Geduld
            const geduld = transferPoker.patience;
            transferPoker.offer = Math.round(p1.sellerMinimum * 0.5);
            submitPokerOffer();
            out.frechheit = transferPoker.patience === geduld - 2;
            // Angebot über Schmerzgrenze wird angenommen (Zufall günstig)
            transferPoker.offer = p1.sellerMinimum;
            submitPokerOffer();
            Math.random = zufall;
            out.zusage = transferPoker.agreedFee === p1.sellerMinimum && transferPoker.wageDemand > 0;
            const forderungLohn = transferPoker.wageDemand;
            Math.random = () => 0;
            haggleWage();
            Math.random = zufall;
            out.gehaltGedrueckt = transferPoker.wageDemand < forderungLohn && transferPoker.wageTalked;
            const lohn = transferPoker.wageDemand, geld1 = game.money, prov1 = getAgentFee(p1, p1.sellerMinimum);
            signPokerDeal();
            out.unterschrieben = squad.includes(p1) && p1.wage === lohn && geld1 - game.money === p1.sellerMinimum + prov1 && transferPoker === null;
            // Abbruch nach erschöpfter Geduld: Preis steigt, nur noch Sofortkauf
            const p2 = marketPlayers[0];
            openTransferPoker(0);
            transferPoker.rivalChance = 0; transferPoker.patience = 1;
            const preis2 = p2.askingPrice;
            transferPoker.offer = Math.round(p2.sellerMinimum * 0.5);
            submitPokerOffer();
            out.abbruch = p2.pokerBroken && p2.askingPrice > preis2 && transferPoker === null;
            openTransferPoker(0);
            out.gesperrt = transferPoker === null && document.getElementById('app-toast').innerText.includes('verhandelt nicht mehr');
            // Rivale steigt ein und schnappt sich den Spieler
            const p3 = marketPlayers[1];
            openTransferPoker(1);
            transferPoker.rivalChance = 1; transferPoker.patience = 9;
            const min3 = p3.sellerMinimum;
            Math.random = () => 0.5;
            transferPoker.offer = Math.round(p3.sellerMinimum * 0.95);
            submitPokerOffer(); // Runde 1: kein Rivale möglich
            submitPokerOffer(); // Runde 2: Rivale steigt ein
            out.rivale = !!(transferPoker && transferPoker.rival) && p3.sellerMinimum > min3;
            Math.random = () => 0.1;
            submitPokerOffer();
            Math.random = zufall;
            out.weggeschnappt = !marketPlayers.includes(p3) && transferPoker === null && JSON.stringify(inboxMessages).includes(`${p3.name} geht zu`);
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Transferpoker-Test ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.konditionen && r.marktzeile, 'Jeder Marktspieler hat einen echten Verkäuferverein, Forderung über Schmerzgrenze, Knopf Verhandeln');
        assert(r.sofortkauf, 'Sofortkauf zahlt genau die Forderung (plus Beraterprovision)');
        assert(r.box && r.keineZusageUnterGrenze, 'Unter der Schmerzgrenze gibt es keine Zusage, das Gegenangebot bleibt darüber');
        assert(r.frechheit, 'Ein sehr niedriges Angebot kostet doppelt Geduld');
        assert(r.zusage && r.gehaltGedrueckt && r.unterschrieben, 'Einigung, Gehaltsgespräch und Unterschrift mit genau vereinbarter Ablöse und Gehalt');
        assert(r.abbruch && r.gesperrt, 'Erschöpfte Geduld: Gespräche abgebrochen, Preis steigt, nur noch Sofortkauf');
        assert(r.rivale && r.weggeschnappt, `Rivale treibt den Preis und schnappt den Spieler bei zu langem Pokern weg (${r.rivale}/${r.weggeschnappt})`);
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testMedicalCheck(browser) {
    console.log('\n[22.5] Medizincheck bei Transfers: verdeckter Befund, Check nach der Einigung senkt die Ablöse, Sofortkauf bleibt blind');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.money = 50000000; game.transferBudget = 50000000; game.wageBudget = 50000000;
            game.ffpTransferEmbargo = false;
            staffMembers.physio.hired = false;
            refreshTransferMarket();
            showScreen('screen-transfer');
            // Befunde werden gewürfelt - jeder Marktspieler bekommt einen
            out.profile = marketPlayers.every(p => ['ok', 'chronisch', 'verletzt'].includes(ensureMedicalProfile(p).issue) && !p.medical.checked);
            renderTransferView();
            out.ungeprueft = document.getElementById('market-list').innerHTML.includes('🩺 ungeprüft');
            const kandidat = marketPlayers[0];
            openPlayerDetail(kandidat.id, 'market');
            out.popupUnbekannt = document.body.innerHTML.includes('unbekannt - Medizincheck');
            if (typeof closePlayerDetail === 'function') closePlayerDetail();
            // Chronischer Befund: Check erst nach der Einigung, dann sinkt die Ablöse um 20 %
            kandidat.medical = { issue: 'chronisch', injuries: 4, checked: false };
            openTransferPoker(0);
            const geld0 = game.money;
            runMedicalCheck();
            out.erstNachEinigung = game.money === geld0 && !kandidat.medical.checked;
            acceptPokerAsking();
            const vereinbart = transferPoker.agreedFee;
            out.knopf = document.getElementById('transfer-poker-box').innerHTML.includes('Medizincheck');
            const gebuehr = getMedicalCheckFee(vereinbart);
            runMedicalCheck();
            out.check = game.money === geld0 - gebuehr && kandidat.medical.checked && transferPoker.agreedFee === Math.round(vereinbart * 0.8 / 1000) * 1000;
            out.log = transferPoker.log.some(z => z.includes('chronische Probleme'));
            const geld1 = game.money;
            runMedicalCheck();
            out.nurEinmal = game.money === geld1;
            signPokerDeal();
            const neu = squad.find(p => p.id === kandidat.id);
            out.chronisch = !!neu && neu.chronicIssue === true && neu.timesInjured === 4 && neu.medical === undefined;
            const mit = getPlayerInjuryRiskIndex(neu);
            neu.chronicIssue = false;
            const ohne = getPlayerInjuryRiskIndex(neu);
            neu.chronicIssue = true;
            out.risiko = Math.abs(mit / ohne - 1.5) < 1e-9;
            out.badge = (showScreen('screen-squad'), document.body.innerHTML.includes('Chronische Probleme'));
            // Sofortkauf ohne Check: der Befund kommt nach der Unterschrift ans Licht
            showScreen('screen-transfer');
            const blind = marketPlayers[0];
            blind.medical = { issue: 'verletzt', weeks: 3, checked: false };
            buyPlayer(0);
            const blindNeu = squad.find(p => p.id === blind.id);
            out.blind = !!blindNeu && blindNeu.injured === 3 && inboxMessages[0].title.includes('Böse Überraschung');
            // Unauffällig: Check kostet, aber keine Preissenkung
            const gesund = marketPlayers[0];
            gesund.medical = { issue: 'ok', checked: false };
            openTransferPoker(0);
            acceptPokerAsking();
            const fee = transferPoker.agreedFee;
            runMedicalCheck();
            out.gesund = transferPoker.agreedFee === fee && gesund.medical.checked && getMedicalTag(gesund).includes('unauffällig');
            closeTransferPoker();
            // Chef-Physio halbiert die Gebühr
            const normal = getMedicalCheckFee(1000000);
            staffMembers.physio.hired = true;
            out.physio = normal === 30000 && getMedicalCheckFee(1000000) === 15000 && getMedicalCheckFee(10000) === 1500;
            staffMembers.physio.hired = false;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Medizincheck ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.profile && r.ungeprueft && r.popupUnbekannt, 'Jeder Marktspieler hat einen verdeckten Befund, Liste und Popup zeigen „ungeprüft/unbekannt“');
        assert(r.erstNachEinigung && r.knopf, 'Der Check ist erst nach der Ablöse-Einigung möglich und steht dann im Transferpoker');
        assert(r.check && r.log && r.nurEinmal, 'Check kostet 3 % der Ablöse, ein chronischer Befund senkt die Ablöse um 20 % - nur einmal');
        assert(r.chronisch && r.risiko && r.badge, 'Chronische Probleme bleiben: Verletzungsakte, x1,5 Verletzungsrisiko, Abzeichen im Kader');
        assert(r.blind, 'Sofortkauf ist blind: ein verletzter Spieler fällt sofort aus, die Post meldet die böse Überraschung');
        assert(r.gesund, 'Unauffälliger Befund: keine Preissenkung');
        assert(r.physio, 'Chef-Physio halbiert die Gebühr, mindestens 1.500 €');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testPreContracts(browser) {
    console.log('\n[22.6] Vorverträge: ablösefreie Zugänge zur neuen Saison, Angebote anderer Vereine für eigene Spieler');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            game.money = 50000000; game.wageBudget = 50000000; game.ffpTransferEmbargo = false;
            game.matchday = 10;
            showScreen('screen-transfer'); setTransferTab('free');
            const box = () => document.getElementById('precontract-box').innerHTML;
            out.vorWinter = box().includes('Ab dem Winterfenster') && ensurePreContractPool() === null;
            // Ab Spieltag 18: vier Kandidaten mit auslaufendem Vertrag
            game.matchday = 18;
            renderPreContractBox();
            const pool = game.preContractPool;
            out.pool = pool.season === game.season && pool.players.length === 4 && box().includes('Vorverträge') && box().includes('% Zusage');
            out.doppeltBesser = pool.players.every(p => getPreContractChance(p, 'doppelt') > getPreContractChance(p, 'normal') || getPreContractChance(p, 'normal') === 0.95);
            // Zusage: Handgeld sofort, 20 % mehr Gehalt, Spieler wartet auf die neue Saison
            const a = pool.players[0];
            const lohnAlt = a.wage;
            const t = getPreContractTerms(a, 'normal');
            const geld0 = game.money;
            const kader0 = squad.length;
            Math.random = () => 0;
            offerPreContract(a.id, 'normal');
            Math.random = zufall;
            out.zusage = game.money === geld0 - t.handgeld && game.preContracts.length === 1 && a.wage === Math.round(lohnAlt * 1.2 / 10) * 10 && squad.length === kader0 && !game.preContractPool.players.includes(a);
            // Absage: kein Geld weg, kein zweiter Versuch
            const b = game.preContractPool.players[0];
            const geld1 = game.money;
            Math.random = () => 0.999;
            offerPreContract(b.id, 'doppelt');
            Math.random = () => 0;
            offerPreContract(b.id, 'doppelt');
            Math.random = zufall;
            out.absage = b.preRefused === true && game.money === geld1 && game.preContracts.length === 1;
            // Gehaltsbudget der neuen Saison zählt
            const c = game.preContractPool.players[1];
            game.wageBudget = 1;
            offerPreContract(c.id, 'normal');
            out.budget = game.preContracts.length === 1 && !c.preRefused;
            game.wageBudget = 50000000;
            // Höchstens drei offene Vorverträge
            game.preContracts.push({ player: { name: 'X', wage: 1 }, club: game.clubName }, { player: { name: 'Y', wage: 1 }, club: game.clubName });
            offerPreContract(c.id, 'normal');
            out.limit = game.preContracts.length === 3 && !c.preRefused;
            game.preContracts = game.preContracts.slice(0, 1);
            // Andere Vereine schnappen sich wartende Kandidaten
            game.matchday = 19;
            squad.forEach(p => { p.contracts = 3; });
            Math.random = () => 0;
            tickPreContracts();
            out.konkurrenz = game.preContractPool.players.length === 0;
            // Abgang: eigener Spieler im letzten Vertragsjahr bekommt ein Angebot
            const stark = [...squad].sort((x, y) => y.strength - x.strength);
            const weg = stark[0], bleibt = stark[1];
            weg.contracts = 1; bleibt.contracts = 1;
            const forderungOhne = getContractDemand(weg).gehalt;
            tickPreContracts();
            Math.random = zufall;
            out.angebot = !!weg.preContractOffer && weg.preContractOffer.deadline === 22 && !!bleibt.preContractOffer;
            out.teurer = getContractDemand(weg).gehalt === Math.round(forderungOhne * 1.15 / 10) * 10;
            // Verlängert: Angebot vom Tisch / Frist verstrichen: unterschrieben, keine Verlängerung mehr
            bleibt.contracts = 3;
            game.matchday = 22;
            Math.random = () => 0.999;
            tickPreContracts();
            Math.random = zufall;
            out.bleibt = !bleibt.preContractOffer && !bleibt.preContractSigned;
            out.unterschrieben = weg.preContractSigned && !weg.preContractOffer;
            showScreen('screen-contracts');
            extendContract(weg.id);
            out.gesperrt = (typeof contractTalk === 'undefined' || !contractTalk || contractTalk.playerId !== weg.id) && document.getElementById('contracts-list').innerHTML.includes('Vorvertrag bei');
            // Saisonwechsel: Neuzugang kommt, ein Jahr älter, 3 Jahre Vertrag
            const alter = a.age;
            joinPreContractPlayers();
            const neu = squad.find(p => p.id === a.id);
            out.ankunft = !!neu && neu.contracts === 3 && neu.age === alter + 1 && game.preContracts.length === 0 && inboxMessages.some(m => m.title.includes('Neuzugang'));
            // Nach Vereinswechsel verfällt ein Vorvertrag
            game.preContracts = [{ player: { id: 'zz', name: 'Zed', age: 25, wage: 100 }, club: 'Anderer Verein', from: 'Irgendwo' }];
            joinPreContractPlayers();
            out.verfaellt = !squad.some(p => p.id === 'zz');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Vorverträge ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.vorWinter && r.pool && r.doppeltBesser, 'Ab Spieltag 18 vier Kandidaten mit auslaufendem Vertrag, doppeltes Handgeld überzeugt eher');
        assert(r.zusage, 'Zusage: Handgeld sofort, 20 % mehr Gehalt, der Spieler kommt erst zur neuen Saison');
        assert(r.absage && r.budget && r.limit, 'Absage ohne Kosten und ohne zweiten Versuch; Gehaltsbudget der neuen Saison und Limit 3 greifen');
        assert(r.konkurrenz, 'Wartende Kandidaten unterschreiben bei anderen Vereinen');
        assert(r.angebot && r.teurer, 'Eigene Spieler im letzten Vertragsjahr bekommen Angebote (Frist 3 Spieltage) und fordern 15 % mehr');
        assert(r.bleibt && r.unterschrieben && r.gesperrt, 'Verlängert: Angebot weg; Frist verstrichen: Vorvertrag woanders, keine Verlängerung mehr');
        assert(r.ankunft && r.verfaellt, 'Zur neuen Saison kommt der Neuzugang - nach einem Vereinswechsel verfällt der Vorvertrag');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testBuyback(browser) {
    console.log('\n[22.7] Rückkaufoption beim Verkauf: 10 % weniger sofort, fester Rückkaufpreis, Entwicklung beim Käufer, nur im Fenster');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            managerRPG.perks.negotiator = false;
            game.money = 50000000; game.transferBudget = 50000000; game.wageBudget = 50000000; game.ffpTransferEmbargo = false;
            incomingOffers = [];
            const sorted = [...squad].sort((a, b) => a.strength - b.strength);
            const jung = sorted[0], alt = sorted[1], dritter = sorted[2];
            [jung, alt, dritter].forEach(p => { p.agent = null; p.isCrowdFavorite = false; p.friendPlayerId = null; });
            jung.age = 21; alt.age = 30;
            triggerNewAITransferOffer(jung); triggerNewAITransferOffer(alt);
            showScreen('screen-transfer'); setTransferTab('offers'); renderTransferView();
            const liste = document.getElementById('incoming-offers-list').innerHTML;
            out.knopfNurJung = (liste.match(/Mit Rückkaufoption/g) || []).length === 1;
            // Annehmen mit Rückkaufoption
            const angebot = incomingOffers.find(o => o.playerId === jung.id);
            const geld0 = game.money;
            acceptTransferOfferWithBuyback(angebot.id);
            const opt = (game.buybackOptions || [])[0];
            out.verkauf = !squad.includes(jung) && game.money === geld0 + Math.round(angebot.currentBid * 0.9) && !!opt
                && opt.price === Math.round(angebot.currentBid * 1.4 / 1000) * 1000 && opt.untilSeason === game.season + 2 && opt.saleStrength === jung.strength;
            setTransferTab('sell'); renderTransferView();
            out.box = document.getElementById('buyback-box').innerHTML.includes('Rückkaufoptionen');
            // Alter Spieler: keine Option
            const altAngebot = incomingOffers.find(o => o.playerId === alt.id);
            acceptTransferOfferWithBuyback(altAngebot.id);
            out.altNein = squad.includes(alt) && game.buybackOptions.length === 1;
            // Die anderen Annahme-Wege rechnen wie bisher
            triggerNewAITransferOffer(dritter);
            const klausel = incomingOffers.find(o => o.playerId === dritter.id);
            const geld1 = game.money;
            acceptTransferOfferWithClause(klausel.id);
            out.klausel = game.money === geld1 + Math.round(klausel.currentBid * 0.94) && game.sellOnClauses.some(c => c.playerName === dritter.name && c.originalSaleValue === Math.round(klausel.currentBid * 0.94));
            const geld2 = game.money;
            acceptTransferOffer(altAngebot.id);
            out.normal = game.money === geld2 + altAngebot.currentBid && !squad.includes(alt);
            // Entwicklung beim Käufer zum Saisonwechsel
            const vorher = jung.strength;
            Math.random = () => 0;
            tickBuybackOptions();
            Math.random = zufall;
            out.entwicklung = jung.age === 22 && jung.strength === vorher + 1 && game.buybackOptions.length === 1;
            // Außerhalb des Fensters: nicht möglich
            game.matchday = 10; game.winterWindowActive = false;
            const geld3 = game.money;
            exerciseBuyback(jung.id);
            out.fenster = game.money === geld3 && !squad.includes(jung);
            // Im Fenster: zurückholen
            game.matchday = 2;
            exerciseBuyback(jung.id);
            out.zurueck = squad.includes(jung) && jung.contracts === 3 && game.money === geld3 - opt.price && game.buybackOptions.length === 0;
            // Verfall am Ende der letzten Options-Saison
            game.buybackOptions = [{ player: { id: 'bb1', name: 'Bert', age: 20, strength: 50, pos: 'ST' }, club: 'X', price: 1000, untilSeason: game.season, saleStrength: 50, season: game.season }];
            tickBuybackOptions();
            out.verfall = game.buybackOptions.length === 0 && inboxMessages[0].title.includes('verfallen');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Rückkaufoption ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.knopfNurJung && r.altNein, 'Rückkaufoption nur für Spieler bis 25 Jahre');
        assert(r.verkauf && r.box, 'Verkauf mit Option: 10 % weniger sofort, Rückkauf für 140 % bis zwei Saisons später, Liste im Verkaufs-Reiter');
        assert(r.klausel && r.normal, 'Normaler Verkauf und Weiterverkaufsbeteiligung rechnen unverändert');
        assert(r.entwicklung, 'Der Spieler entwickelt sich beim Käufer weiter');
        assert(r.fenster && r.zurueck, 'Zurückholen nur im Transferfenster, dann mit 3 Jahren Vertrag');
        assert(r.verfall, 'Die Option verfällt am Ende der letzten Saison');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testRumors(browser) {
    console.log('\n[22.8] Gerüchteküche: Quellen mit echter Trefferquote, wahre Gerüchte werden Angebote, Reaktionen mit Folgen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            managerRPG.perks.negotiator = false;
            incomingOffers = []; game.rumors = []; game.rumorStats = {};
            game.matchday = 5;
            const star = [...squad].sort((a, b) => b.strength - a.strength)[0];
            star.character = 'Ruhig'; star.morale = 50;
            // Neues Gerücht: Boulevard, wahr, Abwerbung
            Math.random = () => 0;
            tickRumors();
            Math.random = zufall;
            const g = game.rumors[0];
            out.neu = !!g && g.type === 'abwerbung' && g.source === 'boulevard' && g.truth === true && g.resolveAt === 6 && inboxMessages[0].title.includes('Gerücht');
            // Dementieren: wertgeschätzt, Verein zieht zurück
            const p1 = squad.find(p => p.id === g.playerId);
            p1.character = 'Ruhig'; p1.morale = 50;
            Math.random = () => 0;
            reactToRumor(g.id, 'dementieren');
            Math.random = zufall;
            reactToRumor(g.id, 'anheizen');
            out.dementi = p1.morale === 53 && g.reaction === 'dementieren' && g.backedOff === true;
            game.matchday = 6;
            Math.random = () => 0.99;
            tickRumors();
            Math.random = zufall;
            out.zurueck = g.outcome === 'zurueckgezogen' && incomingOffers.length === 0;
            // Anheizen bei wahrem Gerücht: Angebot 15 % höher, Spieler fühlt sich weggeschoben
            star.morale = 50;
            game.rumors.unshift({ id: 'r2', type: 'abwerbung', source: 'fach', truth: true, club: 'Testclub', playerId: star.id, playerName: star.name, resolveAt: 7, season: game.season, reaction: null, outcome: null });
            reactToRumor('r2', 'anheizen');
            game.matchday = 7;
            Math.random = () => 0.5;
            tickRumors();
            Math.random = zufall;
            const angebot = incomingOffers.find(o => o.playerId === star.id);
            const mult = (0.85 + 0.5 * 0.35) * 1.15;
            out.anheizen = star.morale === 47 && !!angebot && angebot.clubName === 'Testclub' && angebot.currentBid === (star.marketValue * mult < 50000 ? Math.max(1000, Math.round(star.marketValue * mult / 500) * 500) : Math.max(10000, Math.round(star.marketValue * mult / 5000) * 5000));
            // Ente beim Anheizen kostet Ruf
            const zweiter = [...squad].sort((a, b) => b.strength - a.strength)[1];
            const ruf = game.managerMediaImage;
            game.rumors.unshift({ id: 'r3', type: 'abwerbung', source: 'boulevard', truth: false, club: 'Ente FC', playerId: zweiter.id, playerName: zweiter.name, resolveAt: 8, season: game.season, reaction: null, outcome: null });
            reactToRumor('r3', 'anheizen');
            game.matchday = 8;
            Math.random = () => 0.99;
            tickRumors();
            Math.random = zufall;
            out.ente = game.rumors.find(x => x.id === 'r3').outcome === 'ente' && game.managerMediaImage === Math.max(0, ruf - 2) && !incomingOffers.some(o => o.clubName === 'Ente FC');
            // Marktgerücht: wahr -> Spieler verschwindet vom Markt
            refreshTransferMarket();
            const mp = marketPlayers[0];
            game.rumors.unshift({ id: 'r4', type: 'markt', source: 'blog', truth: true, club: 'Kaufclub', playerId: mp.id, playerName: mp.name, resolveAt: 9, season: game.season, reaction: null, outcome: null });
            game.matchday = 9;
            Math.random = () => 0.99;
            tickRumors();
            Math.random = zufall;
            out.markt = !marketPlayers.includes(mp) && game.rumors.find(x => x.id === 'r4').outcome === 'wahr';
            // Trefferquote je Quelle
            out.stats = game.rumorStats.boulevard.hit === 1 && game.rumorStats.boulevard.miss === 1 && game.rumorStats.fach.hit === 1;
            showScreen('screen-transfer'); setTransferTab('offers'); renderTransferView();
            const html = document.getElementById('rumor-box').innerHTML;
            out.box = html.includes('Gerüchteküche') && html.includes('lag 1 von 2 Mal richtig') && html.includes('Ente');
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Gerüchteküche ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.neu, 'Nach dem Spieltag entsteht ein Gerücht mit Quelle, verdeckter Wahrheit und Postnachricht');
        assert(r.dementi && r.zurueck, 'Dementieren: Moral +3 für Ruhige, der Verein zieht zurück - nur eine Reaktion pro Gerücht');
        assert(r.anheizen, 'Anheizen: das echte Angebot fällt 15 % höher aus, der Spieler verliert Moral');
        assert(r.ente, 'Ente nach dem Anheizen: kein Angebot, Medienimage -2');
        assert(r.markt, 'Wahres Marktgerücht: der Spieler ist vom Transfermarkt verschwunden');
        assert(r.stats && r.box, 'Trefferquote je Quelle wird gezählt und angezeigt');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testSwapDeals(browser) {
    console.log('\n[25.20] Tauschgeschäft: eigener Spieler wird auf die Ablöse angerechnet');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.money = 1e8; game.transferBudget = 1e8; game.wageBudget = 1e9;
            while (squad.length < 22) { const n = createPlayer('MIT', 50, 55); n.contracts = 2; squad.push(n); }
            const ziel = marketPlayers[0];
            ensureTransferTerms(ziel);
            const tausch = squad.filter(x => (x.age || 25) <= 30).sort((a, b) => b.strength - a.strength)[0];
            tausch.strength = Math.max(tausch.strength, getSwapClubMinimum(ziel));
            // Zu schwach für den Verkäufer (25.22): unter Vereinsstärke - 4 nimmt er keinen
            const schwach = squad.find(x => x !== tausch && (x.age || 25) <= 30);
            const s0 = schwach.strength; schwach.strength = getSwapClubMinimum(ziel) - 1;
            out.zuSchwach = !isSwapCandidate(schwach, ziel) && getSwapClubMinimum(ziel) >= ziel.strength - 10;
            schwach.strength = s0;
            tausch.marketValue = calculatePlayerMarketValue(tausch.strength);
            openTransferPoker(0);
            acceptPokerAsking();
            const fee = transferPoker.agreedFee;
            showScreen('screen-transfer');
            renderTransferPokerBox();
            out.auswahl = document.getElementById('transfer-poker-box').innerHTML.includes('in Zahlung geben');
            setPokerSwap(tausch.id);
            const wert = getSwapValue(tausch, ziel, fee);
            const geld = game.money, tb = game.transferBudget, agent = getAgentFee(ziel, fee) + getAgentFee(tausch, wert);
            signPokerDeal();
            out.angerechnet = wert > 0 && wert <= fee && wert <= Math.round(tausch.marketValue * 0.85 / 1000) * 1000;
            out.bar = game.money === geld - (fee - wert) - agent && game.transferBudget === tb - (fee - wert) - Math.round(wert * 0.15);
            out.weg = !squad.some(x => x.id === tausch.id) && squad.some(x => x.id === ziel.id);
            // Zu schwache oder zu alte Spieler nimmt der Verkäufer nicht
            const alt = squad[0]; const age0 = alt.age; alt.age = 33;
            out.zuAlt = !isSwapCandidate(alt, ziel);
            alt.age = age0;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Tauschgeschäft ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.auswahl, 'Nach der Einigung lässt sich im Transferpoker ein eigener Spieler in Zahlung geben');
        assert(r.angerechnet && r.bar, 'Angerechnet werden höchstens 85 % des Marktwerts; die Kasse zahlt den Rest, das Transferbudget wie bei einem Verkauf (85 % der Anrechnung), Provision für beide Berater');
        assert(r.weg && r.zuAlt, 'Der Tauschspieler verlässt den Verein; über 30-Jährige nimmt der Verkäufer nicht');
        assert(r.zuSchwach, 'Der Verkäufer nimmt nur Spieler, die höchstens 4 Punkte unter seiner Vereinsstärke liegen');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testProLoans(browser) {
    console.log('\n[25.20] Profis verleihen: Gehaltsanteil, raus aus dem Gehaltsbudget, Rückkehr zum Saisonende');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            game.matchday = 2;
            while (squad.length < 20) { const n = createPlayer('MIT', 50, 55); n.contracts = 2; squad.push(n); }
            const p = [...squad].sort((a, b) => a.strength - b.strength)[0];
            p.age = 22; p.trainingGains = null;
            const t = getProLoanTerms(p);
            out.bedingungen = !!t && t.anteil >= 0.4 && t.anteil <= 1 && t.eigen === Math.round(p.wage * (1 - t.anteil) / 10) * 10;
            showScreen('screen-transfer');
            renderTransferView();
            out.knopf = document.getElementById('sell-list').innerHTML.includes('Verleihen');
            const summeVor = squad.reduce((a, x) => a + x.wage, 0);
            loanOutProPlayer(p.id, null);
            const l = getProLoans()[0];
            out.verliehen = !squad.some(x => x.id === p.id) && !!l && l.duration === 33 && contractWageTotalWith(squad[0], squad[0].wage) === summeVor - p.wage;
            // Eigenanteil je Spieltag, Rückkehr nach Ablauf mit Moral und (bis 23) +1
            game.kontoauszug = [];
            const staerke = p.strength, moral = p.morale || 50;
            l.duration = 1;
            tickLoanedPlayers();
            out.zurueck = squad.some(x => x.id === p.id) && getProLoans().length === 0 && p.morale === Math.min(100, moral + 5) && p.strength === staerke + 1;
            out.anteilGebucht = l.eigen === 0 || game.kontoauszug.some(b => b.label.includes('Leihspieler-Gehalt'));
            // Randfälle (25.21): Verletzte bleiben, Speichern/Laden behält die Leihe, Vereinswechsel löst sie
            const verletzt = squad.find(x => x.id !== p.id); verletzt.injured = 3;
            loanOutProPlayer(verletzt.id, null);
            out.verletztBleibt = squad.some(x => x.id === verletzt.id);
            verletzt.injured = 0;
            const leihling = squad.find(x => x.id !== p.id && x.id !== verletzt.id);
            incomingOffers.push({ id: 'test-off', playerId: leihling.id, amount: 1000 });
            loanOutProPlayer(leihling.id, null);
            out.angebotWeg = !incomingOffers.some(o => o.playerId === leihling.id);
            const gespeichert = JSON.parse(JSON.stringify(buildSaveState()));
            out.gespeichert = (gespeichert.loanedPlayers || []).some(l => l.proLoan && l.player.id === leihling.id);
            const ziel = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName && !(game.secondTeam && t.name === game.secondTeam.name));
            switchToClub(ziel.name);
            out.wechselLoest = getProLoans().length === 0 && !squad.some(x => x.id === leihling.id);
            // Außerhalb des Fensters nicht möglich
            game.matchday = 10; game.winterWindowActive = false;
            loanOutProPlayer(squad[0].id, null);
            out.nurImFenster = getProLoans().length === 0;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Profi-Leihe ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.bedingungen && r.knopf, 'Leihbedingungen: Leihverein übernimmt 40-100 % des Gehalts, Knopf in der Verkaufsliste');
        assert(r.verliehen, 'Verliehen bis Saisonende, der Spieler zählt nicht mehr im Gehaltsbudget');
        assert(r.zurueck && r.anteilGebucht, 'Eigenanteil wird gebucht, Rückkehr mit Moral +5 und (bis 23 Jahre) +1 Stärke');
        assert(r.nurImFenster, 'Profis lassen sich nur im Wechselfenster verleihen');
        assert(r.verletztBleibt && r.angebotWeg, 'Verletzte lassen sich nicht verleihen; offene Angebote für einen verliehenen Spieler verfallen');
        assert(r.gespeichert && r.wechselLoest, 'Die Leihe steht im Spielstand; ein Vereinswechsel löst sie (der Spieler bleibt beim alten Verein)');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testKiAngebotObergrenze(browser) {
    console.log('\n[25.38] KI-Angebote: ein Klub kann nur so viel bieten, wie seine Liga zahlen kann');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        game.leagueLevel = 3; // 4. Liga: vorher konnte hier ein Bundesliga-Klub mit 367 Mio. bieten
        const star = squad[0];
        star.marketValue = 300000000;
        const obergrenzen = [];
        let zuHoch = 0, kaeuferFalsch = 0;
        for (let i = 0; i < 20; i++) {
            incomingOffers.length = 0;
            triggerNewAITransferOffer(star);
            const o = incomingOffers[0];
            if (!o) continue;
            obergrenzen.push(o.currentBid);
            if (o.currentBid > KI_ANGEBOT_OBERGRENZE[0]) zuHoch++;
            // Teurer Spieler: Käufer nur aus der Bundesliga (Stufe 0), weil nur dort 250 Mio. gezahlt werden können
            if (kiStufeVonVerein(o.clubName) !== 0) kaeuferFalsch++;
        }
        // Normaler Spieler: kein Kappen, Käufer aus allen Stufen erlaubt
        const klein = squad[1];
        klein.marketValue = 2000000;
        incomingOffers.length = 0;
        triggerNewAITransferOffer(klein);
        const kleinesAngebot = incomingOffers[0] ? incomingOffers[0].currentBid : 0;
        return { anzahl: obergrenzen.length, zuHoch, kaeuferFalsch, kleinesAngebot, max: Math.max(0, ...obergrenzen) };
    });
    assert(r.anzahl === 20, 'Bei jedem Versuch entsteht ein Angebot');
    assert(r.zuHoch === 0, 'Kein Angebot über der Obergrenze der Bundesliga (250 Mio. €)');
    assert(r.kaeuferFalsch === 0, 'Für einen Spieler für 300 Mio. € kommt der Käufer nur aus der Bundesliga');
    assert(r.kleinesAngebot > 0 && r.kleinesAngebot < 3000000, 'Ein normales Angebot (2 Mio. € Marktwert) wird nicht gekappt');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den KI-Angeboten');
    await page.close();
}

async function testRunde40Funktionen(browser) {
    console.log('\n[25.40] Transferbilanz, Reisefaktor und Spielernotizen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        game.kontoauszug = [
            { season: game.season, matchday: 1, label: '💸 Spielerverkauf', amount: 1000000, saldo: 0 },
            { season: game.season, matchday: 2, label: '🛒 Spielerkauf', amount: -400000, saldo: 0 },
            { season: game.season - 1, matchday: 9, label: '💸 Spielerverkauf', amount: 5000000, saldo: 0 }
        ];
        const b = getTransferBilanz(game.season);
        out.verkauf = b.verkauf; out.kauf = b.kauf; out.netto = b.netto;
        out.boxText = renderTransferBilanzBox().includes('Transferbilanz');
        // Reisefaktor: eigener Verein liegt in der Heimatstadt, also im eigenen Bundesland
        out.faktorEigen = getReiseFaktor(game.clubName);
        out.faktorUnbekannt = getReiseFaktor('Gibt Es Nicht FC');
        // Notiz: speichern, mit Leerzeichen trimmen, leeren entfernt sie
        const p = squad[0];
        speichereSpielerNotiz(p.id, '  Testnotiz  ');
        out.notiz = (p.notizen || {})[game.season];
        openPlayerDetail(p.id, 'squad');
        out.notizFeld = document.getElementById('pd-notiz') ? document.getElementById('pd-notiz').value : null;
        speichereSpielerNotiz(p.id, '   ');
        out.notizWeg = !((p.notizen || {})[game.season]);
        return out;
    });
    assert(r.verkauf === 1000000 && r.kauf === 400000, 'Transferbilanz zählt Verkäufe und Käufe der laufenden Saison');
    assert(r.netto === 600000, 'Transferbilanz-Netto ist Verkäufe minus Käufe (alte Saison bleibt außen vor)');
    assert(r.boxText, 'Der Transferbilanz-Kasten wird gerendert');
    assert(r.faktorEigen === 0.7, 'Reisefaktor: Gegner im eigenen Bundesland kostet weniger (0,7)');
    assert(r.faktorUnbekannt === 1, 'Reisefaktor: unbekannter Gegner bleibt bei 1');
    assert(r.notiz === 'Testnotiz', 'Notiz wird gespeichert und getrimmt');
    assert(r.notizFeld === 'Testnotiz', 'Notizfeld auf der Spielerkarte zeigt die gespeicherte Notiz');
    assert(r.notizWeg, 'Eine leere Notiz wird entfernt');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den neuen Funktionen');
    await page.close();
}

async function testYouthSales(browser) {
    console.log('\n[25.18] Talente verkaufen: KI-Angebote für Akademie-Talente');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const zufall = Math.random;
            game.money = 5000000;
            youthTalents = [];
            for (let i = 0; i < 3; i++) scoutYouthTalent();
            youthTalents.forEach((p, i) => { p.age = 17; p.potentialTier = i === 0 ? 3 : 2; p.potential = p.strength + 12; });
            game.youthOffers = [];
            Math.random = () => 0.01;
            tickYouthOffers();
            Math.random = zufall;
            out.angebote = game.youthOffers.length === 2 && game.youthOffers.every(o => o.betrag >= 5000 && o.club && o.bis === game.matchday + 4);
            out.post = inboxMessages.some(m => m.title.includes('Angebot für Talent'));
            showScreen('screen-youth');
            out.box = document.getElementById('youth-offers-box').textContent.includes('Angebote für Talente');
            // Entscheidungshilfe: jedes Angebot nennt den Kader-Median; mit bekanntem Potenzial die Einordnung
            out.medianHinweis = document.getElementById('youth-offers-box').textContent.includes('Kader-Median');
            const tHinweis = youthTalents.find(x => x.id === game.youthOffers[0].playerId);
            const altRev = tHinweis.potentialRevealed, altPot = tHinweis.potential;
            tHinweis.potentialRevealed = true; tHinweis.potential = 1;
            out.unterMedian = getYouthOfferSquadHint(tHinweis).includes('unter dem Kader-Median');
            tHinweis.potential = 1;
            out.profiHinweis = getYouthOfferSquadHint(tHinweis, 'profi').includes('Verleihen oder Verkaufen');
            tHinweis.potential = 99;
            out.ueberMedian = getYouthOfferSquadHint(tHinweis).includes('erreicht den Kader-Median');
            tHinweis.potentialRevealed = altRev; tHinweis.potential = altPot;
            // Verkaufen: volle Ablöse, 85 % ins Transferbudget, Talent weg
            const o1 = game.youthOffers[0];
            const geld = game.money, tb = game.transferBudget;
            acceptYouthOffer(o1.id, false);
            out.verkaufWerte = { betrag: o1.betrag, dGeld: game.money - geld, dTb: game.transferBudget - tb, da: youthTalents.some(p => p.id === o1.playerId), offen: game.youthOffers.map(o => o.id + ":" + o.playerId), o1: o1.id };
            out.verkauft = game.money === geld + o1.betrag && game.transferBudget === tb + Math.round(o1.betrag * 0.85)
                && !youthTalents.some(p => p.id === o1.playerId) && !game.youthOffers.some(o => o.id === o1.id);
            // Mit Beteiligung: 25 % weniger, Klausel mit Weiterverkaufswert am Potenzial
            const o2 = game.youthOffers[0];
            const geld2 = game.money;
            game.sellOnClauses = [];
            acceptYouthOffer(o2.id, true);
            const klausel = game.sellOnClauses[0];
            out.beteiligung = game.money === geld2 + Math.round(o2.betrag * 0.8 / 1000) * 1000 && klausel && klausel.percent === 20 && klausel.resaleValue > 0;
            // Ablöse am heutigen Wert: höchstens 30 % des Marktwerts am Potenzial
            const t = { strength: 72, potential: 86 };
            out.ablose = Array.from({ length: 20 }, () => getYouthOfferAmount(t)).every(b => b <= calculatePlayerMarketValue(86) * 0.3 + 1000 && b >= calculatePlayerMarketValue(72));
            // Ablehnen: ein Top-Talent legt zu; abgelaufene Angebote verschwinden
            const top = youthTalents[0];
            top.potentialTier = 3; top.potential = top.strength + 10;
            const vorher = top.strength;
            game.youthOffers = [{ id: 'x1', playerId: top.id, name: top.name, club: 'Test', betrag: 10000, season: game.season, bis: game.matchday + 4 }];
            rejectYouthOffer('x1');
            out.abgelehnt = top.strength === vorher + 1 && game.youthOffers.length === 0;
            game.youthOffers = [{ id: 'x2', playerId: top.id, name: top.name, club: 'Test', betrag: 10000, season: game.season, bis: game.matchday - 1 }];
            Math.random = () => 0.99;
            tickYouthOffers();
            Math.random = zufall;
            out.abgelaufen = game.youthOffers.length === 0;
            // Jünger als 16: keine Angebote
            youthTalents.forEach(p => { p.age = 15; });
            Math.random = () => 0.01;
            tickYouthOffers();
            Math.random = zufall;
            out.zuJung = game.youthOffers.length === 0;
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Talentverkauf ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.angebote && r.post && r.box, 'KI-Vereine bieten für Talente ab 16 (höchstens 2 offen, 4 Spieltage gültig), mit Postfach und Box');
        assert(r.profiHinweis, 'Die Profivertrags-Entscheidung ordnet ein schwaches Potenzial gegen den Kader-Median ein (Verleihen oder Verkaufen)');
        assert(r.medianHinweis && r.unterMedian && r.ueberMedian, 'Talentangebote nennen den Kader-Median und ordnen ein bekanntes Potenzial darüber oder darunter ein');
        assert(r.verkauft, `Verkaufen: volle Ablöse, 85 % ins Transferbudget, Talent verlässt die Akademie (${JSON.stringify(r.verkaufWerte)})`);
        assert(r.beteiligung && r.ablose, 'Mit Beteiligung: 20 % weniger sofort, dafür 20 % vom Weiterverkauf; Ablöse vom heutigen Wert, gedeckelt bei 30 % des Potenzial-Werts');
        assert(r.abgelehnt && r.abgelaufen && r.zuJung, 'Ablehnen hebt ein Top-Talent um 1, abgelaufene Angebote verschwinden, unter 16 keine Angebote');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

async function testTransferStrategy(browser) {
    console.log('\n[25.18] Transferstrategie mit dem Vorstand: Budget, Saisonziel, Abrechnung am Saisonende');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            const out = {};
            const exp = getSeasonExpectation();
            const card = () => document.getElementById('dash-transfer-strategy-box').innerHTML;
            const liga = getLeagueTransferBudget(game.leagueLevel);
            game.matchday = 1;
            showScreen('screen-dashboard'); renderTransferStrategyCard();
            out.karte = card().includes('Transferstrategie') && card().includes('Sofort-Erfolg');
            // Sofort-Erfolg: +40 % Budget, Ziel 2 Plätze höher; verfehlt -8, erreicht +5
            exp.expectedRank = 8; game.transferBudget = 1000000; game.boardSat = 50;
            chooseTransferStrategy('sofort');
            out.sofort = exp.expectedRank === 6 && game.transferBudget === 1000000 + Math.round(liga * 0.4 / 1000) * 1000;
            chooseTransferStrategy('sparen');
            out.einmal = getTransferStrategy().choice === 'sofort';
            resolveTransferStrategy(9);
            out.sofortVerfehlt = game.boardSat === 42 && getTransferStrategy().result === 'verfehlt';
            getTransferStrategy().result = null; game.boardSat = 50;
            resolveTransferStrategy(5);
            out.sofortErreicht = game.boardSat === 55;
            // Jugend: -30 %, Ziel leichter, Sichtung halb so teuer; zwei Eigengewächse mit 10+ Spielen
            game.transferStrategy = null; exp.expectedRank = 8; game.transferBudget = liga;
            const kostenVorher = getYouthScoutCost();
            chooseTransferStrategy('jugend');
            out.jugend = exp.expectedRank === 9 && game.transferBudget === liga - Math.round(liga * 0.3 / 1000) * 1000
                && getYouthScoutCost() === Math.round(kostenVorher / 2);
            game.boardSat = 50;
            resolveTransferStrategy(9);
            out.jugendVerfehlt = game.boardSat === 44;
            squad.slice(0, STRATEGY_YOUTH_PLAYERS).forEach(p => { p.academyGraduate = true; p.statsSeason = { spiele: 12, tore: 0, vorlagen: 0, notenSumme: 0, elf: 0 }; });
            getTransferStrategy().result = null; game.boardSat = 50; const fans = game.fans;
            resolveTransferStrategy(9);
            out.jugendErreicht = game.boardSat === 56 && game.fans === Math.min(100, fans + 3);
            // Sparen: Saison ohne Verlust +5, sonst -6; Budget nie unter 0
            game.transferStrategy = null; game.transferBudget = 1000;
            chooseTransferStrategy('sparen');
            out.sparenBudget = game.transferBudget === 0;
            game.boardSat = 50; game.ffpSeasonNet = -5000;
            resolveTransferStrategy(5);
            out.sparenVerfehlt = game.boardSat === 44;
            // Ohne Wahl bis Spieltag 3: ausgewogen, ohne Abrechnung
            game.transferStrategy = null; game.matchday = 4; game.boardSat = 50;
            tickTransferStrategy();
            resolveTransferStrategy(18);
            renderTransferStrategyCard();
            out.auto = getTransferStrategy().choice === 'ausgewogen' && game.boardSat === 50 && card() === '';
            return out;
        } catch (e) { return { crash: e.message + ' ' + e.stack }; }
    });
    assert(!r.crash, `Transferstrategie ohne Absturz (${r.crash || 'ok'})`);
    if (!r.crash) {
        assert(r.karte, 'Die Karte erscheint zu Saisonbeginn auf dem Dashboard');
        assert(r.sofort && r.einmal, 'Sofort-Erfolg: +40 % Liga-Transferbudget, Ziel 2 Plätze höher - nur eine Wahl pro Saison');
        assert(r.sofortVerfehlt && r.sofortErreicht, 'Sofort-Erfolg am Saisonende: verfehlt -8, erreicht +5');
        assert(r.jugend, 'Jugend fördern: -30 % Budget, Ziel 1 Platz leichter, Sichtung zum halben Preis');
        assert(r.jugendVerfehlt && r.jugendErreicht, 'Jugend fördern: 3 Eigengewächse mit 10+ Ligaspielen bringen +6 und Fans, sonst -6');
        assert(r.sparenBudget && r.sparenVerfehlt, 'Sparen: Budget fällt nicht unter 0, Saison mit Verlust kostet 6');
        assert(r.auto, 'Ohne Wahl bis Spieltag 3 bleibt es ausgewogen - ohne Abrechnung, Karte verschwindet');
    }
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 2).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// [7] TRANSFERMARKT
// ---------------------------------------------------------------------------
async function testTransferMarket(browser) {
    console.log('\n[7] Transfermarkt');
    const { page } = await freshPage(browser);

    const r = await page.evaluate(() => {
        let results = {};
        game.money = 10000000;
        game.transferBudget = 10000000;

        // Eingehende Leihe mit Kaufoption
        refreshTransferMarket();
        results.loanablePlayersGenerated = loanablePlayers.length === 3;
        let loanPlayer = loanablePlayers[0];
        // Gehaltsbudget gilt auch für Leihen (25.17)
        game.wageBudget = 1;
        signLoanPlayer(0);
        results.leiheBrauchtGehaltsbudget = !squad.some(p => p.id === loanPlayer.id);
        game.wageBudget = 1e9;
        const tbVor = game.transferBudget;
        signLoanPlayer(0);
        results.leiheZiehtTransferbudget = game.transferBudget === tbVor - loanPlayer.loanFee;
        results.loanPlayerInSquad = squad.some(p => p.id === loanPlayer.id);
        let loan = incomingLoans.find(l => l.playerId === loanPlayer.id);
        exerciseLoanBuyOption(loanPlayer.id);
        let playerAfter = squad.find(p => p.id === loanPlayer.id);
        results.buyOptionMakesPermanent = !!loan && !!playerAfter && !incomingLoans.some(l => l.playerId === loanPlayer.id);

        // Ausstiegsklausel
        let minClause = Math.round(squad[0].marketValue * 1.1);
        setReleaseClause(squad[0].id, minClause - 1000);
        results.releaseClauseMinimumEnforced = squad[0].releaseClause === null;
        setReleaseClause(squad[0].id, minClause + 5000);
        results.releaseClauseSetCorrectly = squad[0].releaseClause === minClause + 5000;

        // Weiterverkaufsbeteiligung
        incomingOffers.push({ id: 'test1', playerId: squad[1].id, playerName: squad[1].name, clubName: 'Test FC', currentBid: 100000, statusText: 'test' });
        let squadSizeBefore = squad.length;
        acceptTransferOfferWithClause('test1');
        results.sellOnClauseTracked = game.sellOnClauses.length === 1;
        results.sellOnClausePlayerSold = squad.length === squadSizeBefore - 1;

        return results;
    });

    assert(r.loanablePlayersGenerated, 'Leihmarkt generiert 3 verfügbare Spieler');
    assert(r.loanPlayerInSquad, 'Eingehende Leihe fügt Spieler korrekt zum Kader hinzu');
    assert(r.leiheBrauchtGehaltsbudget && r.leiheZiehtTransferbudget, 'Leihen laufen über Gehalts- und Transferbudget');
    assert(r.buyOptionMakesPermanent, 'Kaufoption macht Leihspieler dauerhaft');
    assert(r.releaseClauseMinimumEnforced, 'Ausstiegsklausel erzwingt Mindestbetrag (110% Marktwert)');
    assert(r.releaseClauseSetCorrectly, 'Gültige Ausstiegsklausel wird korrekt gesetzt');
    assert(r.sellOnClauseTracked, 'Weiterverkaufsbeteiligung wird korrekt getrackt');
    assert(r.sellOnClausePlayerSold, 'Verkauf mit Weiterverkaufsbeteiligung entfernt Spieler aus dem Kader');
    await page.close();
}

async function testTransferMarketAndClubDossier(browser) {
    console.log('\n[12] Transfermarkt-Anbindung & Vereinsakte');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        try {
            let pyramidNames = () => new Set(leaguesData.flat().map(t => t.name));

            squad.forEach(p => { p.strength = 70; }); // sonst gibt es realistisch keine Angebote
            for (let i = 0; i < 6; i++) triggerNewAITransferOffer();
            let names = pyramidNames();
            let offersFromPyramid = incomingOffers.length > 0 && incomingOffers.every(o => names.has(o.clubName));

            let jobOfferFromPyramid = true;
            for (let i = 0; i < 5; i++) {
                let clubName = pickRandomOpposingClubName(true);
                if (!pyramidNames().has(clubName)) jobOfferFromPyramid = false;
            }

            for (let i = 0; i < 3; i++) { simulateFullSeason(); concludeSeasonAndAdvance(); }
            let sampleOpp = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
            showHeadToHeadStats(sampleOpp.name);
            let dossierHtml = document.getElementById('head-to-head-box').innerHTML;

            return {
                crash: false, offersFromPyramid, jobOfferFromPyramid,
                strengthHistoryTracked: (sampleOpp.strengthHistory || []).length > 0,
                dossierShowsFormkurve: dossierHtml.includes('Formkurve'),
                dossierShowsClubName: dossierHtml.includes(sampleOpp.name)
            };
        } catch (e) {
            return { crash: true, error: e.message };
        }
    });

    assert(r.crash === false, `Transfermarkt-/Vereinsakte-Test ohne Absturz (${r.crash ? r.error : 'ok'})`);
    if (!r.crash) {
        assert(r.offersFromPyramid, 'Transferangebote für eigene Spieler stammen aus der echten Liga-Pyramide');
        assert(r.jobOfferFromPyramid, 'Abwerbeversuche um den Manager nennen einen echten Verein der Pyramide');
        assert(r.strengthHistoryTracked, 'KI-Vereine sammeln über Saisons eine Stärke-Historie (team.strengthHistory)');
        assert(r.dossierShowsFormkurve, 'Vereinsakte zeigt die Formkurve eines Gegners an');
        assert(r.dossierShowsClubName, 'Vereinsakte zeigt den korrekten Vereinsnamen an');
    }
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei Transfermarkt-/Vereinsakte-Test');
    await page.close();
}

async function testTransferMarketFairness(browser) {
    console.log('\n[27] Transfermarkt: Angebote in jeder Liga, sichtbare Rückmeldungen');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        let out = {};

        // 1. Auch ein Sechstligist bekommt Angebote fuer seine Leistungstraeger. Die alte
        //    feste Untergrenze (Staerke 48) lag komplett ueber einem Amateurkader (26-44),
        //    dort ging deshalb NIE ein Angebot ein.
        let schnitt = squad.reduce((s, p) => s + p.strength, 0) / squad.length;
        out.schwelleRelativ = getTransferInterestThreshold() <= Math.round(schnitt) + 2
            && getTransferInterestThreshold() >= Math.round(schnitt) - 1;
        out.kaderUnter48 = squad.every(p => p.strength < 48);

        incomingOffers = [];
        let gesehen = new Set();
        for (let i = 0; i < 34; i++) {
            checkIncomingTransferOffers();
            incomingOffers.forEach(o => gesehen.add(o.id));
        }
        out.angeboteKommen = gesehen.size >= 5;

        // 2. Die Angebotshoehe liegt in einem plausiblen Band um den Marktwert.
        out.angeboteRealistisch = incomingOffers.every(o => o.currentBid >= o.marketValue * 0.5
            && o.currentBid <= o.marketValue * 2.0);

        // 3. Der Markt rotiert waehrend der Saison, bleibt aber gleich gross.
        let vorher = marketPlayers.map(p => p.name).join('|');
        let groesse = marketPlayers.length;
        // 20 % je Tick: bei 25 Ticks blieb der Markt in 0,4 % der Läufe gleich (0,8^25), bei 100 praktisch nie
        for (let i = 0; i < 100; i++) tickTransferMarketRotation();
        out.marktRotiert = marketPlayers.map(p => p.name).join('|') !== vorher;
        out.marktGroesseStabil = marketPlayers.length === groesse;

        // 4. Keine nativen Dialoge mehr im Transferpfad - in manchen Android-WebViews
        //    werden die unterdrueckt, der Klick bliebe dann kommentarlos wirkungslos.
        out.keineNativenDialoge = [buyPlayer, sellPlayer, signFreeAgent, signLoanPlayer,
            acceptTransferOffer, exerciseLoanBuyOption]
            .every(f => !/(^|[^.\w])alert\s*\(/.test(f.toString()));

        // 5. Ein gescheiterter Kauf erklaert sich jetzt sichtbar.
        game.money = 0;
        game.transferBudget = 99999999;
        game.wageBudget = 99999999;
        let kaderVorher = squad.length;
        let toast = document.getElementById('app-toast');
        toast.className = 'app-toast';
        toast.innerText = '';
        buyPlayer(0);
        out.kaufScheitertSichtbar = squad.length === kaderVorher
            && toast.classList.contains('show')
            && toast.innerText.length > 10;
        return out;
    });

    assert(r.kaderUnter48, 'Ein Sechstliga-Kader liegt komplett unter der alten Interessensschwelle');
    assert(r.schwelleRelativ, 'Die Interessensschwelle richtet sich nach dem eigenen Kader statt nach einer festen Zahl');
    assert(r.angeboteKommen, 'Auch in der untersten Liga gehen Transferangebote ein');
    assert(r.angeboteRealistisch, 'Die Angebotshöhe liegt in einem plausiblen Band um den Marktwert');
    assert(r.marktRotiert, 'Der Transfermarkt rotiert während der Saison');
    assert(r.marktGroesseStabil, 'Die Größe der Marktliste bleibt dabei gleich');
    assert(r.keineNativenDialoge, 'Der Transferpfad nutzt keine nativen Dialoge mehr');
    assert(r.kaufScheitertSichtbar, 'Ein gescheiterter Kauf erklärt sich sichtbar statt kommentarlos');
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler im Transfermarkt');
    await page.close();
}

async function testBonusClauses(browser) {
    console.log('\n[37] Erfolgsbasierte Vertragsboni: Torbonus, Einsatzbonus, Aufstiegsbonus');
    const { page, consoleErrors } = await freshPage(browser);
    const nativeDialoge = [];
    page.on('dialog', async d => { nativeDialoge.push(d.type() + ': ' + d.message().slice(0, 80)); await d.dismiss(); });

    const r = await page.evaluate(() => {
        let out = {};
        let p = squad[0];

        // 1. Ein zu niedriger Bonusbetrag wird abgelehnt - der Spieler verlangt ein
        //    Mindestmaß, das sich am Marktwert orientiert (analog zur Ausstiegsklausel).
        setBonusClause(p.id, 'goals', 5, 1);
        out.zuNiedrigAbgelehnt = p.bonusClauses.goals === null;

        // 2. Ein ausreichender Betrag wird akzeptiert, für alle drei Bonustypen.
        let minGoals = getBonusClauseMinAmount(p, 'goals');
        let minApp = getBonusClauseMinAmount(p, 'appearances');
        let minProm = getBonusClauseMinAmount(p, 'promotion');
        setBonusClause(p.id, 'goals', 3, minGoals + 5000);
        setBonusClause(p.id, 'appearances', 10, minApp + 3000);
        setBonusClause(p.id, 'promotion', null, minProm + 5000);
        out.alleDreiVereinbart = !!p.bonusClauses.goals && !!p.bonusClauses.appearances && !!p.bonusClauses.promotion;

        // 3. Torbonus wird ausgezahlt, sobald die Saisontore die Schwelle erreichen - über den
        //    normalen Kontoauszug (nicht als anonymer Spieltags-Nachtrag), und zählt zur
        //    Financial-Fairplay-Bilanz (reguläres operatives Geschäft, keine Ausnahme).
        game.money = 5000000;
        game.ffpSeasonNet = 0;
        let geldVorTor = game.money;
        p.goalsSeason = 3;
        checkMatchdayBonusClauses(p);
        out.torbonusAusgezahlt = p.bonusPaidThisSeason.goals === true;
        let deltaTor = game.money - geldVorTor;
        out.torbonusGeldSank = deltaTor < 0 && Math.abs(-deltaTor - p.bonusClauses.goals.amount) <= (p.agent ? p.bonusClauses.goals.amount : 0);
        out.torbonusImKontoauszug = game.kontoauszug[game.kontoauszug.length - 1].label === '⚽ Torbonus';
        out.torbonusInFfpBilanz = Math.round(game.ffpSeasonNet) === Math.round(deltaTor);

        // 4. Kein zweites Mal in derselben Saison, auch wenn die Prüfung erneut läuft.
        let geldVorZweitesMal = game.money;
        checkMatchdayBonusClauses(p);
        out.keineDoppelteAuszahlung = game.money === geldVorZweitesMal;

        // 5. Einsatzbonus funktioniert unabhängig vom Torbonus über denselben Mechanismus.
        p.appearancesSeason = 10;
        let geldVorEinsatz = game.money;
        checkMatchdayBonusClauses(p);
        out.einsatzbonusAusgezahlt = p.bonusPaidThisSeason.appearances === true && game.money < geldVorEinsatz;

        // 6. Eine entfernte Klausel wird nicht mehr ausgezahlt.
        removeBonusClause(p.id, 'goals');
        out.klauselEntfernt = p.bonusClauses.goals === null;

        return out;
    });

    // 7. Aufstiegsbonus: wird bei einem tatsächlichen Aufstieg ausgezahlt, bleibt für die
    //    Verträge-Ansicht der neuen Saison sichtbar UND funktioniert bei einem erneuten
    //    Aufstieg in einer späteren Saison ein weiteres Mal (kein "Einmal pro Karriere"-Bug).
    const aufstieg = await page.evaluate(() => {
        let p = squad[0];
        function forcePromotion() {
            let team = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
            team.points = 999;
            stadium.total = 30000;
            stadium.flutlicht = true;
            game.money = 999999999;
        }
        forcePromotion();
        let levelVor1 = game.leagueLevel;
        concludeSeasonAndAdvance();
        let ergebnis1 = { aufgestiegen: game.leagueLevel < levelVor1, bonusSichtbar: p.bonusPaidThisSeason.promotion === true };

        forcePromotion();
        let levelVor2 = game.leagueLevel;
        concludeSeasonAndAdvance();
        let ergebnis2 = { aufgestiegen: game.leagueLevel < levelVor2, bonusErneutAusgezahlt: p.bonusPaidThisSeason.promotion === true };

        return { ergebnis1, ergebnis2 };
    });

    // 8. Speichern und Laden erhält Klauseln, Saisonzähler und Auszahlungsstatus.
    const laden = await page.evaluate(() => {
        let p = squad[0];
        setBonusClause(p.id, 'goals', 8, getBonusClauseMinAmount(p, 'goals') + 4000);
        p.appearancesSeason = 12;
        let vorher = { clause: JSON.stringify(p.bonusClauses), appSeason: p.appearancesSeason };
        saveGameToSlot(4);
        p.bonusClauses.goals = null;
        p.appearancesSeason = 0;
        loadGameFromSlot(4, true);
        let pNachLaden = squad.find(x => x.id === p.id);
        return { stimmtUeberein: JSON.stringify(pNachLaden.bonusClauses) === vorher.clause && pNachLaden.appearancesSeason === vorher.appSeason };
    });

    // 9. Echte DOM-Bedienung statt nur direkter Funktionsaufrufe: die Eingabefelder und
    //    Buttons in der Verträge-Ansicht müssen tatsächlich funktionieren - inklusive der
    //    Ausstiegsklausel, die früher über ein natives prompt() lief (siehe "Keine nativen
    //    Dialoge mehr" - dieser Rest war bei der damaligen Umstellung übersehen worden).
    await page.evaluate(() => {
        closeTutorial();
        // Die vorangegangenen Aufstiegssimulationen (concludeSeasonAndAdvance) legen ein
        // Saisonrückblick-Overlay sowie ggf. Meldungen über die Seite - beides würde echte
        // Klicks blockieren (siehe "element intercepts pointer events").
        let overlay = document.getElementById('season-review-overlay');
        if (overlay) overlay.classList.remove('show');
        let box = document.getElementById('app-notice');
        while (box && box.style.display === 'flex') dismissNotice();
        showScreen('screen-contracts');
    });
    const spielerId = await page.evaluate(() => squad[1].id);
    // Klauseln und Boni sind in der Karte eingeklappt: wie ein Spieler zuerst aufklappen
    await page.click(`#contracts-list details.ui-fold:has(#bonus-goals-thresh-${spielerId}) > summary`);
    await page.fill(`#bonus-goals-thresh-${spielerId}`, '4');
    await page.fill(`#bonus-goals-amount-${spielerId}`, '30000');
    await page.click(`button[onclick="confirmBonusClause('${spielerId}', 'goals')"]`);
    await page.fill(`#release-clause-input-${spielerId}`, '500000000');
    await page.click(`button[onclick="confirmSetReleaseClause('${spielerId}')"]`);
    await page.waitForFunction((pid) => squad.find(x => x.id === pid).releaseClause === 500000000, spielerId, { timeout: 5000 }).catch(() => null);
    const uiErgebnis = await page.evaluate((pid) => {
        let p = squad.find(x => x.id === pid);
        return { bonusPerKlickGesetzt: !!p.bonusClauses.goals && p.bonusClauses.goals.threshold === 4, klauselPerKlickGesetzt: p.releaseClause === 500000000 };
    }, spielerId);

    assert(r.zuNiedrigAbgelehnt, 'Ein zu niedriger Bonusbetrag wird vom Spieler abgelehnt');
    assert(r.alleDreiVereinbart, 'Torbonus, Einsatzbonus und Aufstiegsbonus lassen sich alle drei vereinbaren');
    assert(r.torbonusAusgezahlt, 'Der Torbonus wird bei Erreichen der Schwelle ausgezahlt');
    assert(r.torbonusGeldSank, 'Die Auszahlung entspricht dem vereinbarten Betrag (ggf. zzgl. Beraterprovision)');
    assert(r.torbonusImKontoauszug, 'Die Auszahlung erscheint klar beschriftet im Kontoauszug');
    assert(r.torbonusInFfpBilanz, 'Die Auszahlung zählt zur Financial-Fairplay-Bilanz (kein Ausnahme-Schlupfloch)');
    assert(r.keineDoppelteAuszahlung, 'Derselbe Bonus wird nicht zweimal in derselben Saison ausgezahlt');
    assert(r.einsatzbonusAusgezahlt, 'Der Einsatzbonus wird unabhängig vom Torbonus ausgezahlt');
    assert(r.klauselEntfernt, 'Eine entfernte Klausel wird nicht mehr ausgezahlt');

    assert(aufstieg.ergebnis1.aufgestiegen && aufstieg.ergebnis1.bonusSichtbar, 'Der Aufstiegsbonus wird bei einem tatsächlichen Aufstieg ausgezahlt und bleibt sichtbar');
    assert(aufstieg.ergebnis2.aufgestiegen && aufstieg.ergebnis2.bonusErneutAusgezahlt, 'Ein erneuter Aufstieg in einer späteren Saison zahlt den Bonus ein weiteres Mal aus');

    assert(laden.stimmtUeberein, 'Klauseln, Saisonzähler und Auszahlungsstatus überleben Speichern und Laden');
    assert(uiErgebnis.bonusPerKlickGesetzt, 'Eine Bonusklausel lässt sich über echte Eingabefelder und einen Klick setzen');
    assert(uiErgebnis.klauselPerKlickGesetzt, 'Auch die Ausstiegsklausel läuft jetzt über ein Eingabefeld statt über ein natives prompt()');
    assert(nativeDialoge.length === 0, `Die Bonusklausel-Verwaltung nutzt keine nativen Dialoge (${nativeDialoge.join(' | ') || 'keiner'})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei den Vertragsboni');
    await page.close();
}

async function testContractTalks(browser) {
    console.log('\n[P18b] Vertragsgespräche: Gehaltsforderung, Laufzeit, Gegenangebot, Einsatzgarantie');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        const out = {};
        game.money = 5000000; game.wageBudget = 10000000;
        squad.forEach(p => { p.morale = 60; });
        const elf = pickBestLineupIds();
        const star = [...squad].sort((a, b) => b.strength - a.strength)[0];
        const bank = squad.filter(p => !elf.includes(p.id)).sort((a, b) => a.strength - b.strength)[0];
        const dStar = getContractDemand(star), dBank = getContractDemand(bank);
        out.starMehr = dStar.star && dStar.gehalt / calculatePlayerWage(star.marketValue, star.strength) > dBank.gehalt / calculatePlayerWage(bank.marketValue, bank.strength);
        // Star: 2 Jahre unterschreiben
        const vertrag0 = star.contracts, geld0 = game.money;
        showScreen('screen-contracts');
        extendContract(star.id);
        out.gespraechSichtbar = document.getElementById('contracts-list').innerHTML.includes('Vertragsgespräch');
        setContractTalkYears(2);
        acceptContractTalk();
        out.unterschrieben = star.contracts === vertrag0 + 2 && star.wage === dStar.gehalt && game.money <= geld0 - dStar.handgeldProJahr * 2;
        // Bankspieler mit Einsatzgarantie: günstiger, Bruch kostet Moral
        extendContract(bank.id);
        toggleContractTalkGuarantee();
        acceptContractTalk();
        out.garantieGuenstiger = bank.wage < dBank.gehalt && !!bank.playtimePromise;
        game.season = bank.playtimePromise.season; bank.appearancesSeason = 2; bank.morale = 60;
        checkPlaytimePromises();
        out.garantieGebrochen = bank.morale === 40 && !bank.playtimePromise;
        // Zwei abgelehnte Gegenangebote beenden die Gespräche für die Saison
        // Verhandlungsstarker Charakter: nimmt Gegenangebote bei hohem Zufallswert nicht an
        const dritter = squad.find(p => p.id !== star.id && p.id !== bank.id && !['Bescheiden', 'Ruhig'].includes(p.character)) || squad.find(p => p.id !== star.id && p.id !== bank.id);
        const rnd = Math.random; Math.random = () => 0.99;
        extendContract(dritter.id); counterContractTalk(); counterContractTalk();
        Math.random = rnd;
        out.gesperrt = dritter.talksBlockedSeason === game.season && contractTalk === null;
        extendContract(dritter.id);
        out.bleibtGesperrt = contractTalk === null;
        // Gehaltsbudget wird geprüft
        const vierter = squad.find(p => ![star.id, bank.id, dritter.id].includes(p.id));
        const lohn0 = vierter.wage;
        game.wageBudget = 1;
        extendContract(vierter.id); acceptContractTalk();
        out.budgetGeprueft = vierter.wage === lohn0;
        return out;
    });
    assert(r.starMehr, 'Leistungsträger fordern relativ mehr Gehalt als Ersatzspieler');
    assert(r.gespraechSichtbar && r.unterschrieben, 'Vertragsgespräch: Laufzeit wählbar, neues Gehalt und Handgeld je Jahr');
    assert(r.garantieGuenstiger && r.garantieGebrochen, 'Einsatzgarantie macht günstiger, Bruch kostet Moral');
    assert(r.gesperrt && r.bleibtGesperrt, 'Zwei abgelehnte Gegenangebote beenden die Gespräche für die Saison');
    assert(r.budgetGeprueft, 'Gehaltsbudget wird bei der Unterschrift geprüft');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testVorvertragsFrist(browser) {
    console.log('\n[25.25] Vorverträge: Frist der eigenen Spieler steht in der Vorvertrags-Box');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        try {
            closeTutorial();
            game.matchday = 20;
            const p = squad[0];
            p.preContractOffer = { club: 'Testklub Vorvertrag', deadline: 27 };
            renderPreContractBox();
            const t = document.getElementById('precontract-box').innerText;
            return { name: p.name, t };
        } catch (e) { return { crash: e.message }; }
    });
    assert(!r.crash && r.t.includes(r.name) && r.t.includes('Spieltag 27') && r.t.includes('Testklub Vorvertrag'), `Die Vorvertrags-Box nennt Spieler, Verein und Frist (${r.crash || 'Frist fehlt'})`);
    assert(consoleErrors.length === 0, 'Keine JS-Konsolenfehler bei der Vorvertrags-Box');
    await page.close();
}

module.exports = {
    testTransferPoker,
    testMedicalCheck,
    testPreContracts,
    testBuyback,
    testRumors,
    testSwapDeals,
    testProLoans,
    testKiAngebotObergrenze,
    testRunde40Funktionen,
    testYouthSales,
    testTransferStrategy,
    testTransferMarket,
    testTransferMarketAndClubDossier,
    testTransferMarketFairness,
    testBonusClauses,
    testContractTalks,
    testVorvertragsFrist,
};
