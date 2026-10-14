// Testsuiten: aufraeumphasen
// (aus tests/run-tests.js herausgelöst; Inhalt und Reihenfolge der Suiten unverändert)
const path = require('path');
const fs = require('fs');
const { assert, freshPage, GAME_PATH, TESTS_DIR } = require('../lib');

async function testPhase11(browser) {
    console.log('\n[P11] Schiedsrichter, Mannschaftsrat, Mitgliederversammlung, Frauenmannschaft');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        game.money = 5000000;

        // Schiedsrichter: feste Ansetzung, Pools je Liga, Vorschau, Bilanz nach dem Spiel
        out.refFest = getCurrentReferee().id === getCurrentReferee().id;
        out.refJedeLiga = [0, 1, 2, 3, 4, 5].every(l => REFEREES.some(ref => l >= ref.minLeague && l <= ref.maxLeague));
        showScreen('screen-dashboard'); updateUI();
        out.refVorschau = document.getElementById('dash-referee-box').innerText.includes(getCurrentReferee().name);
        const ref = getCurrentReferee();
        simulateMatchdays(1);
        out.refBilanz = (game.refereeHistory[ref.id] || {}).spiele === 1
            && Object.values(game.refereeHistory).every(h => h.spiele > 0);

        // Mannschaftsrat: drei Mitglieder inkl. Kapitän, Anliegen aus echtem Zustand, Wirkung
        const rat = getCouncilMembers();
        out.ratBesetzt = rat.length === 3 && (!game.captainId || rat.some(p => p.id === game.captainId));
        squad.forEach(p => p.morale = 30);
        tickTeamCouncil();
        out.ratAnliegen = game.teamCouncil.concern && game.teamCouncil.concern.type === 'stimmung';
        const moralVorher = squad.reduce((s, p) => s + p.morale, 0);
        answerCouncilConcern(0);
        out.ratWirkung = squad.reduce((s, p) => s + p.morale, 0) > moralVorher && !game.teamCouncil.concern;
        squad.forEach(p => p.morale = 70);
        game.trainingIntensity = 'hart';
        tickTeamCouncil();
        game.matchday += COUNCIL_CONCERN_TIMEOUT;
        tickTeamCouncil();
        out.ratVerfall = game.teamCouncil.history[0].result.includes('verfallen');
        game.trainingIntensity = 'normal';

        // Frauenmannschaft gründen (spielt die Saison parallel mit)
        foundWomenTeam();
        game.womenTeam.squad.forEach(p => p.strength = 60);

        // Saison zu Ende spielen
        while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(1); }
        const tab = getWomenTableSorted();
        out.frauenSaison = game.womenTeam.round === WOMEN_MATCHDAYS && tab.every(t => t.played === WOMEN_MATCHDAYS)
            && tab.reduce((s, t) => s + t.gf, 0) === tab.reduce((s, t) => s + t.ga, 0);
        out.frauenJournal = game.financeLedger.some(e => (e.ausgaben || []).some(x => x.label.includes('Frauenmannschaft')));
        const frauenLiga = game.womenTeam.leagueLevel;

        // Saisonwechsel: Versammlung einberufen, Frauen-Aufstieg
        concludeSeasonAndAdvance();
        out.frauenAufstieg = game.womenTeam.leagueLevel === frauenLiga - 1 && game.womenTeam.round === 0;
        const a = game.memberAssembly;
        out.versammlungOffen = !!a && a.status === 'offen' && a.report.season === game.season - 1
            && typeof a.report.financeResult === 'number' && a.report.expectedRank >= 1;
        showScreen('screen-dashboard'); updateUI();
        out.versammlungSichtbar = document.getElementById('member-assembly-box').style.display === 'block';
        const satVorher = game.boardSat;
        setAssemblyChoice('fee', 'erhoehen');
        const geldVorher = game.money;
        holdMemberAssembly();
        out.versammlungWirkung = a.status === 'abgehalten' && game.money > geldVorher
            && game.boardSat === Math.max(10, Math.min(100, satVorher + a.boardDelta)) && a.boardDelta >= -10;

        showScreen('screen-women');
        out.frauenScreen = document.getElementById('women-team-box').innerText.includes('Tabelle');
        out.selbsttest = runStructuralSelfTest(true);
        return out;
    });

    assert(r.refFest, 'Schiedsrichter-Ansetzung ist pro Spieltag fest');
    assert(r.refJedeLiga, 'Für jede Liga gibt es Schiedsrichter');
    assert(r.refVorschau, 'Das Dashboard nennt den Schiedsrichter des nächsten Spiels');
    assert(r.refBilanz, 'Nach dem Spiel steht es in der Schiedsrichter-Bilanz (keine leeren Einträge)');
    assert(r.ratBesetzt, 'Der Mannschaftsrat hat drei Mitglieder inklusive Kapitän');
    assert(r.ratAnliegen, 'Bei schlechter Stimmung bringt der Rat genau dieses Anliegen ein');
    assert(r.ratWirkung, 'Die Antwort auf das Anliegen hebt die Moral und schließt es');
    assert(r.ratVerfall, 'Unbeantwortete Anliegen verfallen');
    assert(r.frauenSaison, 'Frauen-Saison: alle Teams 22 Spiele, Tore ausgeglichen');
    assert(r.frauenJournal, 'Gehälter der Frauenmannschaft stehen im Buchungsjournal');
    assert(r.frauenAufstieg, 'Die überlegene Frauenmannschaft steigt auf, neue Saison beginnt');
    assert(r.versammlungOffen, 'Nach dem Saisonwechsel ist die Mitgliederversammlung mit Saisonbericht offen');
    assert(r.versammlungSichtbar, 'Die offene Versammlung erscheint im Dashboard');
    assert(r.versammlungWirkung, 'Die Abstimmung wirkt auf Vorstand und Kasse');
    assert(r.frauenScreen, 'Der Frauenmannschafts-Screen zeigt die Tabelle');
    assert(Array.isArray(r.selbsttest) && r.selbsttest.length === 0, `Struktur-Selbsttest mit neuem Screen ohne Probleme (${JSON.stringify(r.selbsttest)})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 11 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

// ---------------------------------------------------------------------------
// PHASE 12: zusammengelegte Systeme (Medizin, Medien, Jugend, Sponsoring)
// ---------------------------------------------------------------------------
async function testPhase12(browser) {
    console.log('\n[P12] Zusammengelegte Systeme: Medizin, Medien, Jugend, Sponsoring');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        // Alte Parallel-Systeme sind weg
        out.alteModuleWeg = ['checkInjuries', 'randomizeMatchInjuries', 'tickInjuryManagement', 'tickMatchInjuries',
            'tickMediaRelations', 'tickRandomMediaEvent', 'tickYouthRecruitment', 'tickYouthAcademyPrograms',
            'processSponsorPayments', 'applySponsorBenefits', 'tickSponsoringIncome', 'simulateYouthDevelopment']
            .filter(n => typeof window[n] === 'function');

        // Alter Spielstand mit Daten der abgelösten Systeme
        game.youthAcademy = { youngPlayers: [{ id: 'youth_0', name: 'Test Talent', position: 'CM', age: 17, strength: 41 }] };
        game.mediaRelations = { mediaImage: 80 };
        game.playerInjuries = [{ playerId: 1 }];
        squad[0].pos = 'GK';

        // Medizin: eine Saison ohne Verletzungsflut
        let maxVerletzt = 0;
        const vorher = squad.reduce((s, p) => s + (p.timesInjured || 0), 0);
        while (game.matchday <= 34) {
            game.sackPending = false;
            simulateMatchdays(1);
            maxVerletzt = Math.max(maxVerletzt, squad.filter(p => p.injured > 0).length);
        }
        out.verletzungenSaison = squad.reduce((s, p) => s + (p.timesInjured || 0), 0) - vorher;
        out.maxVerletzt = maxVerletzt;
        const opfer = squad.find(p => !(p.injured > 0));
        const staerke = opfer.strength;
        injurePlayerByEvent(opfer, 'Test');
        out.ereignisOhneStaerkeverlust = opfer.injured > 0 && opfer.strength === staerke;
        showScreen('screen-training');
        out.medizinPanel = (document.getElementById('medical-department-box') || {}).innerText || '';
        out.altInjuryWeg = game.playerInjuries === undefined;

        // Medien: Aktion wirkt auf das echte Image, Sperrfrist, alte Felder weg
        game.money = 5000000;
        game.managerMediaImage = 50;
        showScreen('screen-manager-tree');
        out.altMedienWeg = game.mediaRelations === undefined;
        const kandidat = interviewCandidates()[0];
        kandidat.morale = 80;
        runMediaAction('interview', String(kandidat.id));
        out.interviewWirkt = game.managerMediaImage === 52;
        const img = game.managerMediaImage;
        runMediaAction('kampagne');
        out.medienSperre = game.managerMediaImage === img;

        // Jugend: Migration, Anzeigen entwickelt nicht
        showScreen('screen-youth');
        out.jugendMigriert = youthTalents.some(t => t.name === 'Test Talent' && t.pos === 'MIT') && game.youthAcademy === undefined;
        out.gkKorrigiert = squad[0].pos === 'TW';
        const st = youthTalents.map(t => t.strength).join(',');
        for (let i = 0; i < 5; i++) { showScreen('screen-dashboard'); showScreen('screen-youth'); }
        out.anzeigenOhneWachstum = youthTalents.map(t => t.strength).join(',') === st;
        out.akademieOhneRealnamen = !game.academyLeague.academies.some(a => /Bayern München|Dortmund|Köln|Hamburger SV|Stuttgart/.test(a.name));

        // Sponsoring: Restwert einmalig
        game.sponsors = [{ name: 'Alt', value: 100000, totalPaid: 40000, active: true }];
        game.sponsorNegotiations = [];
        const geld = game.money;
        showScreen('screen-sponsors');
        const nachErstem = game.money;
        showScreen('screen-dashboard'); showScreen('screen-sponsors');
        out.sponsorRestwert = nachErstem - geld === 60000 && game.money === nachErstem && game.sponsors === undefined;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Abgelöste Parallel-Systeme sind entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.verletzungenSaison < 30 && r.maxVerletzt <= 6, `Keine Verletzungsflut (${r.verletzungenSaison} Verletzungen, max. ${r.maxVerletzt} gleichzeitig)`);
    assert(r.ereignisOhneStaerkeverlust, 'Verletzung durch Ereignisse kostet keine Spielerstärke');
    assert(r.medizinPanel.includes('Verletzt') && r.medizinPanel.includes('Risiko'), 'Medizin-Panel zeigt Verletzte und Risiko');
    assert(r.altInjuryWeg, 'Alte Verletzungs-Buchführung wird aus Spielständen entfernt');
    assert(r.altMedienWeg, 'Alte Medien-Felder werden aus Spielständen entfernt');
    assert(r.interviewWirkt, 'Spieler-Interview wirkt auf das echte Medienimage');
    assert(r.medienSperre, 'Medienaktionen haben eine Sperrfrist');
    assert(r.jugendMigriert, 'Talente der alten Zusatz-Akademie wandern in die Jugendabteilung (mit gültiger Position)');
    assert(r.gkKorrigiert, 'Profis mit alter englischer Position werden korrigiert');
    assert(r.anzeigenOhneWachstum, 'Öffnen des Jugend-Screens lässt Talente nicht wachsen');
    assert(r.akademieOhneRealnamen, 'Akademie-Rangliste nutzt Vereine aus dem Spiel');
    assert(r.sponsorRestwert, 'Alte Co-Sponsoren-Verträge werden einmalig mit dem Restwert ausgezahlt');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 12 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13(browser) {
    console.log('\n[P13] Aufgeräumt: Gegner, Vorstand, Verträge, Scouting, Spielerentwicklung');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        out.alteModuleWeg = ['tickContractExpirations', 'tickContractRenewal', 'renderNegotiationPanel', 'renderContractManagementPanel',
            'tickScoutingUpdates', 'renderTalentDetectionPanel', 'renderScoutingIntelligencePanel', 'tickPlayerAging',
            'recordSeasonalPerformance', 'renderArchetypesPanel', 'checkAgentNegotiations', 'renderAgentsPanel',
            'tickBoardRelations', 'checkBoardConflict', 'renderOppositionAnalysisPanel']
            .filter(n => typeof window[n] === 'function');

        // Alter Spielstand mit Daten der abgelösten Module
        game.contracts = [{ playerId: 1 }]; game.contractRenewal = {}; game.negotiationHistory = []; game.agentPool = [];
        game.scoutingDatabase = {}; game.scoutingIntelligence = {}; game.playerDevelopment = {};
        game.boardMembers = []; game.boardConflicts = [];
        squad[0].contractEnd = 30; squad[1].age = 24.5; squad[1].strength = 51.3;

        // Spielprognose: echte Paarung, Wahrscheinlichkeiten ergeben 100%
        staffMembers.analyst.hired = true;
        const prog = predictNextMatch();
        out.prognose = !!prog && Math.abs(prog.sieg + prog.remis + prog.niederlage - 1) < 1e-9 && !!prog.opp.name;

        simulateMatchdays(4);
        out.altWeg = ['contracts', 'contractRenewal', 'negotiationHistory', 'agentPool', 'scoutingDatabase', 'scoutingIntelligence',
            'playerDevelopment', 'boardMembers', 'boardConflicts'].filter(k => game[k] !== undefined);
        out.ganzzahlig = Number.isInteger(squad[1].age) && Number.isInteger(squad[1].strength) && squad[0].contractEnd === undefined;

        // Vorstand: vier Mitglieder mit Begründung
        showScreen('screen-manager-tree');
        out.vorstand = (document.getElementById('board-room-box') || {}).innerText || '';

        // Alterung am Saisonende: jeder genau ein Jahr älter, Typ fest, Rentner verlassen Kader und Aufstellung
        const vorher = squad.map(p => ({ id: p.id, age: p.age }));
        const typ = getPlayerArchetype(squad[2]).name;
        const rentner = squad[3];
        rentner.age = 35;
        if (!lineup.includes(rentner.id)) lineup[0] = rentner.id;
        agePlayersAtSeasonEnd();
        out.alterung = vorher.filter(v => v.id !== rentner.id).every(v => { const p = squad.find(x => x.id === v.id); return p && p.age === v.age + 1; });
        out.typFest = getPlayerArchetype(squad[2]).name === typ;
        out.rentnerWeg = !squad.some(p => p.id === rentner.id) && !lineup.includes(rentner.id);
        const jung = squad.find(p => p.id !== rentner.id);
        jung.age = 19; jung.archetype = 'wonderkid';
        const alt = squad.find(p => p !== jung);
        alt.age = 33; alt.archetype = 'steady-eddy';
        out.richtung = getDevelopmentRange(jung)[0] > 0 && getDevelopmentRange(alt)[1] < 0;

        showScreen('screen-squad-planning');
        out.entwicklungPanel = (document.getElementById('player-development-box') || {}).innerText || '';
        openPlayerDetail(squad[0].id);
        out.karriere = (document.getElementById('pd-career-progression') || {}).innerText || '';
        showScreen('screen-contracts');
        out.vertragsZeilen = document.querySelectorAll('#contracts-list .panel').length === squad.length;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Abgelöste Parallel-Systeme sind entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Daten abgelöster Module werden aus Spielständen entfernt (${r.altWeg.join(', ')})`);
    assert(r.ganzzahlig, 'Kommazahlen der alten Alterung werden bereinigt');
    assert(r.prognose, 'Spielprognose nutzt die echte nächste Paarung, Wahrscheinlichkeiten ergeben 100%');
    assert(['Präsident', 'Finanzvorstand', 'Sportvorstand', 'Nachwuchsleiter'].every(t => r.vorstand.includes(t)), 'Vorstands-Panel zeigt vier Mitglieder');
    assert(r.alterung, 'Am Saisonende altert jeder Spieler um genau ein Jahr');
    assert(r.typFest, 'Entwicklungstyp eines Spielers bleibt fest');
    assert(r.rentnerWeg, 'Spieler mit 36 beenden die Karriere und verlassen auch die Aufstellung');
    assert(r.richtung, 'Junge Spieler legen zu, Spieler nach dem Höhepunkt bauen ab');
    assert(r.entwicklungPanel.includes('Saisonende'), 'Entwicklungs-Panel in der Kaderplanung');
    assert(r.karriere.includes('Pflichtspiele'), 'Karriere-Block im Spielerdetail aus gespeicherten Daten');
    assert(r.vertragsZeilen, 'Vertragsübersicht zeigt jeden Kaderspieler');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13Teil2(browser) {
    console.log('\n[P13b] Aufgeräumt: Fans, Training, Stadion');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        out.alteModuleWeg = ['tickFanEngagement', 'processFanRevenue', 'renderFanclubManagementPanel', 'tickFanEvents',
            'applyTrainingEffects', 'tickTrainingSpecialization', 'tickSetPieceTraining', 'startStadiumUpgrade', 'tickStadiumMaintenance']
            .filter(n => typeof window[n] === 'function');
        game.fanclubs = [{ ultras: 500 }]; game.fanSatisfaction = 50; game.ultraGroups = []; game.fanEvents = {};
        game.trainingSchedule = {}; game.trainingSpecialization = {}; game.setPieceTraining = {}; game.stadium = { capacity: 25000 };
        const kontoVorher = (game.kontoauszug || []).length;
        simulateMatchdays(4);
        out.altWeg = ['fanclubs', 'fanSatisfaction', 'ultraGroups', 'fanEvents', 'trainingSchedule', 'trainingSpecialization', 'setPieceTraining', 'stadium']
            .filter(k => game[k] !== undefined);
        out.keineFanclubEinnahmen = !(game.kontoauszug || []).slice(kontoVorher).some(k => /Fanclub-Einnahmen/.test(k.label || ''))
            && !(game.financeLedger || []).some(e => JSON.stringify(e).includes('Fanclub-Einnahmen'));
        ['screen-squad', 'screen-training', 'screen-stadium', 'screen-fans', 'screen-finances'].forEach(s => { try { showScreen(s); } catch (e) { out.fehler = s + ': ' + e.message; } });
        out.geldGanzzahlig = Number.isInteger(game.money);
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Abgelöste Fan-/Trainings-/Stadionmodule sind entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Ihre Daten werden aus Spielständen entfernt (${r.altWeg.join(', ')})`);
    assert(r.keineFanclubEinnahmen, 'Keine Fanclub-Einnahmen aus dem Nichts mehr');
    assert(!r.fehler, `Betroffene Bildschirme öffnen ohne Fehler (${r.fehler || ''})`);
    assert(r.geldGanzzahlig, 'Kontostand bleibt ganzzahlig');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 Teil 2 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13Teil3(browser) {
    console.log('\n[P13c] Kader-Bildschirm in Reitern, Startkader im Gehaltsbudget');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        out.alteModuleWeg = ['renderInternationalTournamentsPanel', 'renderTransferMarketAnalysisPanel', 'renderPostMatchAnalysisPanel', 'tickTransferMarketAnalysis']
            .filter(n => typeof window[n] === 'function');
        showScreen('screen-squad');
        const tabs = ['aufstellung', 'taktik', 'analyse', 'team'];
        out.reiter = tabs.map(t => {
            setSquadTab(t);
            const sichtbar = tabs.filter(x => document.getElementById('squad-tab-' + x).style.display !== 'none');
            const el = document.getElementById('squad-tab-' + t);
            return { t, nurEiner: sichtbar.length === 1 && sichtbar[0] === t, panels: el.querySelectorAll(':scope > .panel').length, aktiv: document.getElementById('btn-tab-squad-' + t).className === 'btn-action' };
        });
        setSquadTab('analyse');
        const radar = document.querySelector('#squad-radar-container svg');
        out.radarSichtbar = !!radar && radar.getBoundingClientRect().width > 0;
        // Kaderliste und Taktiktafel liegen im Start-Reiter
        setSquadTab('aufstellung');
        out.aufstellungKomplett = !!document.querySelector('#squad-tab-aufstellung #bench-list') && !!document.querySelector('#squad-tab-aufstellung #soccer-pitch');
        // Startkader einer höheren Liga passt ins Gehaltsbudget der Liga
        out.gehaelterImBudget = [0, 1, 2, 3, 4].every(lvl => {
            for (let i = 0; i < 8; i++) {
                const summe = generateSquadForLevel(lvl).reduce((s, p) => s + p.wage, 0);
                if (summe > getLeagueWageBudget(lvl)) return false;
            }
            return true;
        });
        // ... und das Budget passt zur Liga (25.14: in der 6. Liga lag es beim 150-Fachen der Gehälter)
        out.budgetLigaGerecht = [0, 1, 2, 3, 4].map(lvl => {
            const summen = [...Array(8)].map(() => generateSquadForLevel(lvl).reduce((s, p) => s + p.wage, 0)).sort((a, b) => a - b);
            return getLeagueWageBudget(lvl) / summen[4];
        });
        // Marktwert steigt mit der Stärke (25.16: Stärke 58 kostete ~740.000 €, Stärke 59 nur 150.000 €)
        const mwSchnitt = st => { let s = 0; for (let i = 0; i < 40; i++) s += calculatePlayerMarketValue(st); return s / 40; };
        const mwKurve = []; for (let st = 30; st <= 99; st++) mwKurve.push(mwSchnitt(st));
        out.marktwertMonoton = mwKurve.every((v, i) => i === 0 || v >= mwKurve[i - 1] * 0.95);
        // Transferbudget je Liga reicht für 1-4 typische Marktspieler der Liga (25.15: unten lag es beim 250-Fachen)
        const altLiga = game.leagueLevel;
        out.transferLigaGerecht = [0, 1, 2, 3, 4, 5].map(lvl => {
            game.leagueLevel = lvl;
            // Median über sechs frische Märkte (60 Preise): ein einzelner Markt mit 10 Spielern streut zu stark
            const preise = [];
            for (let m = 0; m < 6; m++) { refreshTransferMarket(); marketPlayers.forEach(x => preise.push(ensureTransferTerms(x).askingPrice)); }
            preise.sort((a, b) => a - b);
            return getLeagueTransferBudget(lvl) / preise[Math.floor(preise.length / 2)];
        });
        game.leagueLevel = altLiga; refreshTransferMarket();
        const altKader = squad; initDefaultSquad();
        out.budgetLigaGerecht.push(getLeagueWageBudget(5) / squad.reduce((s, p) => s + p.wage, 0));
        squad = altKader;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Scheinmodule vom Kader-Bildschirm entfernt (${r.alteModuleWeg.join(', ')})`);
    r.reiter.forEach(x => assert(x.nurEiner && x.aktiv && x.panels >= 3, `Kader-Reiter „${x.t}“ zeigt nur seine Panels (${x.panels}) und ist markiert`));
    assert(r.radarSichtbar, 'Kader-Radar wird im Analyse-Reiter mit echter Breite gezeichnet');
    assert(r.aufstellungKomplett, 'Kaderliste und Taktiktafel liegen im Start-Reiter');
    assert(r.gehaelterImBudget, 'Startkader höherer Ligen überziehen das Gehaltsbudget ihrer Liga nicht');
    assert(r.marktwertMonoton, 'Marktwert steigt mit der Stärke (keine Sprünge nach unten an den Segmentgrenzen)');
    assert(r.transferLigaGerecht.every(f => f >= 0.4 && f <= 5), `Transferbudget je Liga reicht für etwa 0,5-5 typische Marktspieler (${r.transferLigaGerecht.map(f => f.toFixed(1)).join(' / ')})`);
    assert(r.budgetLigaGerecht.every(f => f >= 1 && f <= 2.5), `Gehaltsbudget je Liga liegt beim 1- bis 2,5-Fachen der Startgehälter (${r.budgetLigaGerecht.map(f => f.toFixed(2)).join(' / ')})`);
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 Teil 3 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase13Teil4(browser) {
    console.log('\n[P13d] Relegation, Deadline-Day, Liga-Auszeichnungen, Trainerkarussell');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        closeTutorial();
        const setRank = (rank) => {
            const t = leaguesData[game.leagueLevel];
            const us = t.find(x => x.name === game.clubName);
            t.filter(x => x !== us).forEach((x, i) => { x.points = 100 - (i < rank - 1 ? i : i + 1) * 3; x.goalsFor = 50; x.goalsAgainst = 40; });
            us.points = 100 - (rank - 1) * 3; us.goalsFor = 50; us.goalsAgainst = 40;
        };

        // Deadline-Day: Sommerfenster bis Spieltag 3, danach Last-Minute-Ticker
        showScreen('screen-transfer');
        out.sommerBanner = document.getElementById('winter-window-banner').innerText.includes('Sommer');
        simulateMatchdays(3);
        out.sommerDeadline = game.lastDeadlineDay === `${game.season}-sommer` && inboxMessages.some(m => /DEADLINE-DAY \(Sommer\)/.test(m.title));
        const ddAngebote = incomingOffers.filter(o => /Deadline-Day/.test(o.statusText));
        out.angeboteKurzfristig = ddAngebote.every(o => o.expiresIn <= 1);
        out.schnaeppchen = marketPlayers.filter(p => p.deadlineBargain).length;
        game.matchday = 17; tickTransferWindows();
        out.winterOffen = game.winterWindowActive && game.winterWindowCloseMatchday === 20;
        game.matchday = 20; tickTransferWindows();
        out.winterZu = !game.winterWindowActive && game.lastDeadlineDay === `${game.season}-winter`;

        // Trainerkarussell: Tabellenletzter mit Niederlagenserie verliert seinen Trainer
        game.matchday = 12;
        const opfer = leaguesData[game.leagueLevel].find(t => t.name !== game.clubName);
        leaguesData[game.leagueLevel].forEach(t => { t.points = 30; t.recentForm = ['W', 'W', 'D', 'W', 'W']; });
        opfer.points = 0; opfer.recentForm = ['L', 'L', 'L', 'L', 'L'];
        const alterTrainer = getTeamCoach(opfer).name, alterStil = opfer.playstyle, basis = opfer.baseStrength;
        const zufall = Math.random; Math.random = () => 0.01;
        try { tickCoachCarousel(); } finally { Math.random = zufall; }
        out.trainerGewechselt = opfer.coach.name !== alterTrainer && opfer.playstyle !== alterStil && opfer.baseStrength === basis + 3;
        out.nurEinWechselProSaison = (() => { const n = opfer.coach.name; Math.random = () => 0.01; try { tickCoachCarousel(); } finally { Math.random = zufall; } return opfer.coach.name === n; })();
        game.matchday = 16; tickCoachBounce();
        out.trainereffektEndet = opfer.baseStrength === basis && !opfer.coachBounce;
        out.trainerInAnalyse = getCoachInfoHtml(opfer).includes(opfer.coach.name);

        // Liga-Auszeichnungen: eigener Torjäger schlägt die Konkurrenz
        const star = squad.find(p => p.pos === 'ST');
        star.goalsSeason = 60; star.appearancesSeason = 34;
        const mw = star.marketValue;
        const aw = awardLeagueHonours(1);
        out.torjaeger = aw.awards.some(a => a.own && /Torjäger/.test(a.award) && a.winner === star.name) && star.marketValue > mw;
        out.elfKomplett = aw.elf.length === 11;
        out.trainerDesJahres = aw.awards.some(a => /Trainer des Jahres/.test(a.award));
        showScreen('screen-history');
        out.awardsBox = document.getElementById('league-awards-box').innerText.includes(star.name);

        // Relegation: Platz 16 spielt gegen den Dritten der Liga darunter
        game.leagueLevel = 3; initLeagues(); game.matchday = 35; setRank(16);
        const sit = getRelegationSituation();
        out.relegationGegner = !!sit && sit.type === 'abstieg' && sit.oppLevel === 4;
        showScreen('screen-dashboard');
        out.abschlussVersteckt = document.getElementById('dash-season-end-actions').style.display === 'none';
        playRelegationLeg(); playRelegationLeg();
        const rel = getRelegationState();
        out.zweiSpiele = rel.legs.length === 2 && ['stayed', 'relegated'].includes(rel.result) && rel.legs.some(l => l.isHome && l.income > 0);
        out.abschlussSichtbar = document.getElementById('dash-season-end-actions').style.display === 'block';
        const lv = game.leagueLevel;
        concludeSeasonAndAdvance();
        out.ligaPasst = game.leagueLevel === (rel.result === 'relegated' ? lv + 1 : lv);
        // Platz 3: Saisonabschluss spielt die Aufstiegs-Relegation automatisch
        game.matchday = 35; setRank(3);
        concludeSeasonAndAdvance();
        out.autoRelegation = game.relegation.type === 'aufstieg' && game.relegation.legs.length === 2 && !!game.relegation.result;
        return out;
    });

    assert(r.sommerBanner, 'Sommer-Transferfenster wird zu Saisonbeginn angezeigt');
    assert(r.sommerDeadline, 'Nach Spieltag 3 ist Deadline-Day mit Ticker im Postfach');
    assert(r.angeboteKurzfristig && r.schnaeppchen > 0, `Deadline-Day: Last-Minute-Angebote gelten nur kurz, Schnäppchen auf dem Markt (${r.schnaeppchen})`);
    assert(r.winterOffen && r.winterZu, 'Winterfenster läuft Spieltag 18-20 und endet mit Deadline-Day');
    assert(r.trainerGewechselt, 'Trainerkarussell: Krisenklub entlässt Trainer, neuer Stil und Trainereffekt');
    assert(r.nurEinWechselProSaison, 'Ein Verein wechselt höchstens einmal pro Saison den Trainer');
    assert(r.trainereffektEndet, 'Trainereffekt endet nach 4 Spieltagen ohne bleibende Verzerrung');
    assert(r.trainerInAnalyse, 'Gegnerischer Trainer steht in der Spielanalyse');
    assert(r.torjaeger, 'Eigener Torjäger gewinnt die Torjägerkanone und gewinnt an Marktwert');
    assert(r.elfKomplett && r.trainerDesJahres, 'Elf der Saison hat 11 Spieler, Trainer des Jahres wird gekürt');
    assert(r.awardsBox, 'Auszeichnungen erscheinen im Trophäen-Bildschirm');
    assert(r.relegationGegner && r.abschlussVersteckt, 'Platz 16: Relegation gegen den Dritten der Liga darunter, Saisonabschluss erst danach');
    assert(r.zweiSpiele && r.abschlussSichtbar, 'Relegation: Hin- und Rückspiel mit Heimspieleinnahmen, danach Saisonabschluss möglich');
    assert(r.ligaPasst, 'Ergebnis der Relegation entscheidet über den Abstieg');
    assert(r.autoRelegation, 'Saisonabschluss spielt offene Relegationsspiele automatisch');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 13 Teil 4 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil1(browser) {
    console.log('\n[P14a] Statistik aus echten Daten, Schein-Module entfernt');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        closeTutorial();
        out.alteModuleWeg = ['recordLeagueProgress', 'renderLeagueProgressCharts', 'renderTournamentBracketsPanel', 'tickTournamentBrackets',
            'buyFromTransferMarket', 'calcSquadPlayerValue', 'renderTransferMarketBox', 'tickLoanedPlayerDevelopment', 'renderReservesLoanPanel', 'recordSeasonStats']
            .filter(n => typeof window[n] === 'function');
        game.transferMarketPlayers = [{ id: 'x' }]; game.reserves = {}; game.tournamentBrackets = {}; game.transferBudgetUsed = 5;
        simulateMatchdays(4);
        out.altWeg = ['transferMarketPlayers', 'reserves', 'tournamentBrackets', 'transferBudgetUsed'].filter(k => game[k] !== undefined);

        // Eine Saison: Manager-Bilanz entspricht der echten Tabellenzeile
        for (let i = 0; i < 6; i++) { game.sackPending = false; simulateMatchdays(5); }
        const rank = getOwnLeagueRank();
        const zeile = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        const erwartet = { won: zeile.won, drawn: zeile.drawn, lost: zeile.lost, points: zeile.points, league: leagueNames[game.leagueLevel] };
        const star = squad[0];
        star.goalsCareer = 999;
        game.playerRetirement = { retiredPlayers: [], legendPlayers: [], fareewellGamesScheduled: [],
            retirementHistory: [{ playerName: 'Test Legende', goals: 120, appearances: 400, legendTier: 'ICON', retirementSeason: 1 }] };
        concludeSeasonAndAdvance();
        const e = (game.managerCareer || [])[0];
        out.karriere = !!e && e.rank === rank && e.won === erwartet.won && e.drawn === erwartet.drawn && e.lost === erwartet.lost && e.points === erwartet.points && e.league === erwartet.league;
        showScreen('screen-history');
        const ms = document.getElementById('manager-analytics-box').innerText;
        out.managerPanel = ms.includes(`${erwartet.won}-${erwartet.drawn}-${erwartet.lost}`) && ms.includes(`Platz ${rank}`);
        const hof = document.getElementById('hall-of-fame-box').innerText;
        out.hallOfFame = hof.includes(star.name) && hof.includes('999 Tore') && hof.includes('Test Legende') && hof.includes('Vereins-Ikone') && hof.includes(`Platz ${rank}`);
        const toasts = document.querySelectorAll('.app-toast').length;
        for (let i = 0; i < 3; i++) { showScreen('screen-dashboard'); showScreen('screen-history'); }
        out.keineToastsBeimOeffnen = document.querySelectorAll('.app-toast').length <= toasts;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Schein-Module entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Ihre Spielstanddaten werden entfernt (${r.altWeg.join(', ')})`);
    assert(r.karriere, 'Manager-Statistik speichert Platz und Bilanz der echten Tabellenzeile');
    assert(r.managerPanel, 'Manager-Statistik zeigt die Bilanz an');
    assert(r.hallOfFame, 'Hall of Fame zeigt ewige Torjäger, Legenden und beste Saisons aus echten Daten');
    assert(r.keineToastsBeimOeffnen, 'Öffnen des Trophäen-Bildschirms löst keine Meldungen aus');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 1 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil2(browser) {
    console.log('\n[P14b] Kabine: ein Panel, Schein-Systeme entfernt, Skandale korrigiert');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());

    const r = await page.evaluate(() => {
        const out = {};
        closeTutorial();
        out.alteModuleWeg = ['tickSquadHarmony', 'organizeMoraleEvent', 'tickCrisisEvents', 'resolveCrisis', 'recordCard', 'tickDisciplinaryBans',
            'processDerbyMatch', 'renderRivalriesPanel', 'renderSquadHarmonyPanel'].filter(n => typeof window[n] === 'function');
        game.squadHarmony = {}; game.crises = {}; game.disciplinarySystem = {}; game.localRivals = [];
        simulateMatchdays(4);
        out.altWeg = ['squadHarmony', 'crises', 'disciplinarySystem', 'localRivals'].filter(k => game[k] !== undefined);

        showScreen('screen-squad'); setSquadTab('team');
        const tab = document.getElementById('squad-tab-team');
        const kabine = [...tab.querySelectorAll(':scope > .panel')].find(p => p.innerText.includes('Kabine'));
        out.kabine = !!kabine && !!kabine.querySelector('#squad-cliques-box') && !!kabine.querySelector('#locker-hierarchy-box') && !!kabine.querySelector('#team-chemistry-box');
        out.kabineInhalt = kabine ? kabine.innerText.includes('Rangordnung') : false;
        out.teamPanels = tab.querySelectorAll(':scope > .panel').length;

        // Skandal: schadet dem Medienimage (vorher Vorzeichenfehler) und ist nicht mehr an Spieltag 30 gebunden
        game.scandals = [];
        squad.forEach(p => { p.morale = 20; });
        game.matchday = 11;
        game.managerMediaImage = 60;
        const zufall = Math.random; Math.random = () => 0.01;
        try { checkForScandale(); } finally { Math.random = zufall; }
        out.skandal = game.scandals.length === 1;
        out.imageSinkt = game.managerMediaImage < 60;
        Math.random = () => 0.01;
        try { checkForScandale(); } finally { Math.random = zufall; }
        out.nurEiner = game.scandals.length === 1;
        return out;
    });

    assert(r.alteModuleWeg.length === 0, `Schein-Systeme der Kabine entfernt (${r.alteModuleWeg.join(', ')})`);
    assert(r.altWeg.length === 0, `Ihre Spielstanddaten werden entfernt (${r.altWeg.join(', ')})`);
    assert(r.kabine && r.kabineInhalt, 'Team-Chemie, Grüppchen und Rangordnung in einem Kabinen-Panel');
    assert(r.teamPanels === 3, `Mannschaft-Reiter hat 3 statt 7 Panels (${r.teamPanels})`);
    assert(r.skandal && r.imageSinkt, 'Skandal an einem normalen Spieltag möglich und schadet dem Medienimage');
    assert(r.nurEiner, 'Höchstens ein Skandal gleichzeitig');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 2 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

async function testPhase14Teil3(browser) {
    console.log('\n[P14c] Historie und Finanzen in Reitern');
    const { page, consoleErrors } = await freshPage(browser);
    page.on('dialog', d => d.accept());
    const r = await page.evaluate(() => {
        closeTutorial();
        simulateMatchdays(4);
        const out = {};
        for (const [scr, prefix, tabs] of [['screen-history', 'hist', ['titel', 'legenden', 'chronik', 'rivalen']], ['screen-finances', 'fin', ['uebersicht', 'journal', 'budget', 'bank']]]) {
            showScreen(scr);
            out[prefix] = tabs.map(t => {
                setSubTab(prefix, t);
                const sichtbar = tabs.filter(x => document.getElementById(`subtab-${prefix}-${x}`).style.display !== 'none');
                const el = document.getElementById(`subtab-${prefix}-${t}`);
                return { t, ok: sichtbar.length === 1 && sichtbar[0] === t && el.querySelectorAll(':scope > .panel').length >= 2
                    && document.getElementById(`btn-subtab-${prefix}-${t}`).className === 'btn-action' };
            });
            const direkt = [...document.getElementById(scr).children].filter(c => c.classList.contains('panel'));
            out[prefix + 'Direkt'] = direkt.length;
        }
        showScreen('screen-finances'); setSubTab('fin', 'journal');
        out.journalDa = !!document.querySelector('#subtab-fin-journal #ledger-tab-letzter');
        return out;
    });
    [...r.hist, ...r.fin].forEach(x => assert(x.ok, `Reiter „${x.t}“ zeigt nur seine Panels und ist markiert`));
    assert(r.histDirekt === 0 && r.finDirekt === 0, `Keine Panels mehr außerhalb der Reiter (Historie ${r.histDirekt}, Finanzen ${r.finDirekt})`);
    assert(r.journalDa, 'Buchungsjournal liegt im Journal-Reiter');
    assert(consoleErrors.length === 0, `Keine JS-Konsolenfehler in Phase 14 Teil 3 (${consoleErrors.slice(0, 3).join(' | ')})`);
    await page.close();
}

module.exports = {
    testPhase11,
    testPhase12,
    testPhase13,
    testPhase13Teil2,
    testPhase13Teil3,
    testPhase13Teil4,
    testPhase14Teil1,
    testPhase14Teil2,
    testPhase14Teil3,
};
