
    function restoreGetters() {
        if (!rawMaterials.hasOwnProperty('capacity')) {
            Object.defineProperty(rawMaterials, 'capacity', {
                get: function() { return (this.warehouseLevel || 1) * 2000; },
                configurable: true
            });
        }
        if (!rawMaterials.hasOwnProperty('totalStock')) {
            Object.defineProperty(rawMaterials, 'totalStock', {
                get: function() { return (this.cotton?.stock||0) + (this.wool?.stock||0) + (this.leather?.stock||0) + (this.plastic?.stock||0); },
                configurable: true
            });
        }
        if (!stadium.hasOwnProperty('total')) {
            Object.defineProperty(stadium, 'total', {
                get: function() { return Object.values(this.blocks || {}).reduce((s, b) => s + (b.cap || 0), 0); },
                configurable: true
            });
        }
        if (!stadium.hasOwnProperty('vipTotal')) {
            Object.defineProperty(stadium, 'vipTotal', {
                get: function() { return this.blocks?.vipLogen?.cap || 50; },
                configurable: true
            });
        }
        // Rückwärtskompatibilität: alte Spielstände kennen "expansions" noch nicht
        Object.values(stadium.blocks || {}).forEach(b => {
            if (typeof b.expansions !== 'number') b.expansions = 0;
        });
    }

    const SAVE_SLOT_PREFIX = 'anstoss_fm13_save_slot_';
    // Automatischer Speicherstand in einem EIGENEN Slot: würde die Automatik in Slot 1
    // schreiben, überschriebe sie ungefragt den von Hand angelegten Spielstand.
    const AUTOSAVE_KEY = 'anstoss_fm13_autosave';
    const AUTOSAVE_INTERVAL = 5;
    const LEGACY_SAVE_KEY = 'anstoss_fm13_save_v1';
    const SAVE_SLOT_COUNT = 3;
    const FORCE_NEW_GAME_FLAG = 'anstoss_fm13_force_new_game';

    // Sicherer sessionStorage-Setter: manche Android-Dateimanager-WebViews blockieren
    // Storage-Zugriffe bei file://-URLs komplett. Schlägt das Setzen fehl, wird zur
    // Not sofort neu geladen (initDefaultSquad() beim Boot greift dann ohnehin als
    // Fallback), statt dass der Klick auf "Neues Spiel"/Entlassung/Ruhestand lautlos wirkungslos bleibt.
    function safeSessionSet(key, value) {
        try { sessionStorage.setItem(key, value); return true; } catch (e) { console.error('Session-Storage nicht verfügbar:', e); return false; }
    }

    function buildSaveState() {
        return { game, managerRPG, incomingOffers, holdingCompany, rawMaterials, factories, merchandise, merchExtras, productionQueue, globalScoutResults, scoutingNetwork, securityWorkforce, mediaRights, realEstatePortfolio, stockMarket, financeCentralState, underworld, stadium, campusBuildings, staffMembers, staffMeta, staffCentralState, fanGroups, fanCentralState, privateLife, bandenSponsors, activeBet, betHistory, squad, lineup, secondTeamSquad, secondTeamLineup, youthTalents, activeLoans, loanClubRelationships, loanClubLastInteractionSeason, leaguesData, fixturesData, cupTournament, europeTournament, inboxMessages, inboxArchive, rivalryRecord, crestHistory, loanedPlayers, loanablePlayers, incomingLoans, youthLeagueTable, youthLeagueMatchday };
    }

    function applyLoadedState(p) {
        if (p.game) Object.assign(game, p.game);
        // Migrations-Fix (NEU): game.secondTeam.name wird als verschachteltes Objekt beim
        // Object.assign oben komplett aus dem alten Spielstand übernommen - falls dort noch
        // "Lok Leipzig II" gespeichert war, hier konsistent korrigieren.
        if (game.secondTeam && game.secondTeam.name && game.secondTeam.name.includes('Lok Leipzig')) {
            game.secondTeam.name = game.secondTeam.name.replace('Lok Leipzig', '1.FC Moritz Leipzig');
        }
        if (p.managerRPG) Object.assign(managerRPG, p.managerRPG);
        if (p.incomingOffers) incomingOffers = p.incomingOffers;
        if (p.holdingCompany) Object.assign(holdingCompany, p.holdingCompany);
        if (p.rawMaterials) { delete p.rawMaterials.capacity; delete p.rawMaterials.totalStock; Object.assign(rawMaterials, p.rawMaterials); }
        if (p.factories) Object.assign(factories, p.factories);
        if (p.merchandise) Object.assign(merchandise, p.merchandise);
        if (p.stockMarket) Object.assign(stockMarket, p.stockMarket);
        if (p.underworld) Object.assign(underworld, p.underworld);
        if (p.stadium) {
            // KRITISCHER FIX: bisher wurden beim Laden nur die Stadion-BLÖCKE
            // wiederhergestellt - Flutlicht, Rasenheizung, Videowalls, Dach und
            // Namensrechte (bis zu 50.000 € Investition je Item) gingen komplett
            // verloren! total/vipTotal sind Getter und dürfen nicht mit den beim
            // Speichern "eingefrorenen" Zahlenwerten überschrieben werden (sonst
            // brechen sie), daher gezielt entfernen vor dem Merge - analog zum
            // bestehenden rawMaterials-Muster weiter oben.
            delete p.stadium.total;
            delete p.stadium.vipTotal;
            if (p.stadium.blocks) {
                // WICHTIGER MIGRATIONS-FIX: "cost" und "addSeats" sind Spielbalance-Konstanten,
                // keine Spielstand-Fortschritte - ein alter Spielstand mit den (mittlerweile
                // stark erhöhten) alten Niedrigpreisen würde sonst die neuen, realistischen
                // Preise dauerhaft mit den längst veralteten Werten überschreiben. Aktuelle
                // Code-Werte VOR dem Merge sichern und danach zurückschreiben, da
                // Object.assign() auf Block-Ebene die komplette Unterstruktur ersetzt statt
                // einzelne Eigenschaften zu mischen.
                let currentDefaults = {};
                for (let key in stadium.blocks) currentDefaults[key] = { cost: stadium.blocks[key].cost, addSeats: stadium.blocks[key].addSeats };
                Object.assign(stadium.blocks, p.stadium.blocks);
                for (let key in currentDefaults) {
                    if (stadium.blocks[key]) { stadium.blocks[key].cost = currentDefaults[key].cost; stadium.blocks[key].addSeats = currentDefaults[key].addSeats; }
                }
                delete p.stadium.blocks;
            }
            Object.assign(stadium, p.stadium);
        }
        if (p.campusBuildings) {
            // Derselbe Migrations-Fix wie bei den Stadion-Blöcken: "baseCost" ist eine
            // Spielbalance-Konstante, kein Fortschritt - nur "lvl" (die tatsächliche
            // Ausbaustufe) aus dem Spielstand übernehmen, alles andere beim Code-Stand lassen.
            for (let key in p.campusBuildings) {
                if (campusBuildings[key]) campusBuildings[key].lvl = p.campusBuildings[key].lvl || 0;
            }
        }
        if (p.staffMembers) Object.assign(staffMembers, p.staffMembers);
        if (p.fanGroups) fanGroups = p.fanGroups;
        if (p.fanCentralState) Object.assign(fanCentralState, p.fanCentralState);
        if (p.staffMeta) Object.assign(staffMeta, p.staffMeta);
        if (p.staffCentralState) Object.assign(staffCentralState, p.staffCentralState);
        if (p.financeCentralState) Object.assign(financeCentralState, p.financeCentralState);
        if (p.merchExtras) Object.assign(merchExtras, p.merchExtras);
        if (p.productionQueue) productionQueue = p.productionQueue;
        if (p.globalScoutResults) globalScoutResults = p.globalScoutResults;
        if (p.scoutingNetwork) Object.assign(scoutingNetwork, p.scoutingNetwork);
        if (p.securityWorkforce) Object.assign(securityWorkforce, p.securityWorkforce);
        if (p.mediaRights) Object.assign(mediaRights, p.mediaRights);
        if (p.realEstatePortfolio) {
            // Migrations-Fix (wie bei Stadion-Blöcken/Campus-Gebäuden): nur den echten
            // Fortschritt (owned/lvl) übernehmen, baseCost/baseIncome/etc. bleiben die
            // aktuellen Code-Konstanten statt möglicherweise veralteter Speicherwerte.
            for (let key in p.realEstatePortfolio) {
                if (realEstatePortfolio[key]) {
                    realEstatePortfolio[key].owned = p.realEstatePortfolio[key].owned || false;
                    realEstatePortfolio[key].lvl = p.realEstatePortfolio[key].lvl || 0;
                }
            }
        }
        if (p.activeBet !== undefined) activeBet = p.activeBet;
        if (p.betHistory) betHistory = p.betHistory;
        if (p.privateLife) Object.assign(privateLife, p.privateLife);
        if (p.bandenSponsors) bandenSponsors = p.bandenSponsors;
        if (p.squad) squad = p.squad;
        if (p.lineup) lineup = p.lineup;
        if (p.secondTeamSquad) secondTeamSquad = p.secondTeamSquad;
        // KRITISCHER BUGFIX: youthTalents fehlte komplett in Speichern/Laden - die gesamte
        // Jugendakademie (gescoutete Talente, Mentoren, Potenzial-Stufen, individueller
        // Trainingsfokus) wäre bei jedem Speichern/Laden vollständig verloren gegangen.
        if (p.youthTalents) youthTalents = p.youthTalents;
        // WEITERE KRITISCHE BUGFIXES (systematischer Abgleich aller State-Variablen): auch
        // laufende Bankkredite (samt Ratenzahlungsplan!) und die Leihclub-Beziehungshistorie
        // fehlten komplett in Speichern/Laden.
        if (p.activeLoans) activeLoans = p.activeLoans;
        if (p.loanClubRelationships) loanClubRelationships = p.loanClubRelationships;
        if (p.loanClubLastInteractionSeason) loanClubLastInteractionSeason = p.loanClubLastInteractionSeason;
        if (p.secondTeamLineup) secondTeamLineup = p.secondTeamLineup;
        if (p.inboxMessages) inboxMessages = p.inboxMessages;
        if (p.inboxArchive) inboxArchive = p.inboxArchive;
        if (p.rivalryRecord) rivalryRecord = p.rivalryRecord;
        if (p.crestHistory) crestHistory = p.crestHistory;
        if (p.loanedPlayers) loanedPlayers = p.loanedPlayers;
        if (p.loanablePlayers) loanablePlayers = p.loanablePlayers;
        if (p.youthLeagueTable) youthLeagueTable = p.youthLeagueTable;
        if (typeof p.youthLeagueMatchday === 'number') youthLeagueMatchday = p.youthLeagueMatchday;
        if (p.incomingLoans) incomingLoans = p.incomingLoans;
        if (p.leaguesData) leaguesData = p.leaguesData;
        if (p.fixturesData) fixturesData = p.fixturesData;
        if (p.cupTournament) cupTournament = p.cupTournament;
        if (p.europeTournament) europeTournament = p.europeTournament;
        // Migrations-Fix (NEU): Speicherstände von vor der Vereinsumbenennung hatten den
        // Namen "Lok Leipzig" noch fest in Liga-Tabellen, Spielplänen und Pokal-Paarungen
        // gespeichert - der Code sucht seitdem aber überall nach "1.FC Moritz Leipzig".
        // Dadurch fand keine der Rang-/Aufstiegs-Berechnungen das eigene Team mehr, und in
        // der Tabelle erschien weiterhin der alte, "verwaiste" Name. Ersetzt pauschal in
        // allen team-bezogenen Datenstrukturen, egal an welcher Feldposition der Name steht.
        if (p.leaguesData || p.fixturesData || p.cupTournament || p.europeTournament) {
            let renameOldClubName = (obj) => JSON.parse(JSON.stringify(obj).split('"Lok Leipzig"').join('"1.FC Moritz Leipzig"'));
            if (p.leaguesData) leaguesData = renameOldClubName(leaguesData);
            if (p.fixturesData) fixturesData = renameOldClubName(fixturesData);
            if (p.cupTournament) cupTournament = renameOldClubName(cupTournament);
            if (p.europeTournament) europeTournament = renameOldClubName(europeTournament);
        }
        restoreGetters();
    }

    function getSlotMeta(slotNum) {
        try {
            let raw = safeLocalGet(SAVE_SLOT_PREFIX + slotNum);
            if (!raw) return null;
            let p = JSON.parse(raw);
            return p.meta || null;
        } catch(e) { return null; }
    }

    function saveGameToSlot(slotNum) {
        try {
            let state = buildSaveState();
            state.meta = {
                savedAt: new Date().toLocaleString('de-DE'),
                clubName: game.clubName,
                league: leagueNames[game.leagueLevel],
                season: game.season,
                matchday: Math.min(34, game.matchday),
                money: game.money
            };
            // safeLocalSet statt direktem localStorage.setItem: manche Android-WebViews
            // (Dateivorschau statt echtem Browser) blockieren localStorage bei file://
            // komplett und werfen schon beim Property-Zugriff ("Access is denied for
            // this document") - das braucht eine verständliche, konkret hilfreiche
            // Meldung statt des rohen Browser-Fehlertexts.
            if (!safeLocalSet(SAVE_SLOT_PREFIX + slotNum, JSON.stringify(state))) {
                showToast('💾 Speichern nicht möglich: Dieser Browser/diese Ansicht blockiert lokalen Speicher für diese Datei. Öffne die Datei in einem normalen Browser (z.B. "Öffnen mit..." → Chrome), nicht in der Dateivorschau.', 'error', 8000);
                return;
            }
            playSound('whistle');
            showToast(`💾 In Slot ${slotNum} gespeichert!`, 'success');
            renderSaveSlotsUI();
        } catch(e) {
            showToast('Speicherfehler: ' + e.message, 'error');
        }
    }

    function loadGameFromSlot(slotNum, silent = false) {
        try {
            let raw = safeLocalGet(SAVE_SLOT_PREFIX + slotNum);
            if (raw) {
                let p = JSON.parse(raw);
                applyLoadedState(p);
                updateUI();
                showScreen('screen-dashboard');
                if (!silent) { playSound('whistle'); showToast(`📂 Slot ${slotNum} geladen!`, 'success'); }
                renderSaveSlotsUI();
                return true;
            }
        } catch(e) { console.error(e); }
        if (!silent) showToast(`Slot ${slotNum} ist leer!`, 'error');
        return false;
    }

    // ---------- SPIELSTAND ALS DATEI EXPORTIEREN/IMPORTIEREN (NEU) ----------
    // Ergänzt die 3 lokalen Slots (localStorage) um eine echte, portable Datei - wichtig
    // seit klar ist, dass localStorage in manchen Android-Ansichten komplett blockiert
    // sein kann (siehe safeLocalSet-Absicherung oben) UND weil localStorage grundsätzlich
    // beim Browser-Cache-Leeren oder App-Neuinstallation verloren gehen kann. Nutzt dasselbe
    // Blob+<a download>-Muster wie downloadSelfTestArchiveFile() (admin.js).
    function exportSaveToFile() {
        try {
            let state = buildSaveState();
            state.meta = {
                savedAt: new Date().toLocaleString('de-DE'),
                clubName: game.clubName,
                league: leagueNames[game.leagueLevel],
                season: game.season,
                matchday: Math.min(34, game.matchday),
                money: game.money
            };
            let data = JSON.stringify(state);
            let blob = new Blob([data], { type: 'application/json' });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            let safeClubName = game.clubName.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '').trim() || 'Verein';
            a.download = `anstoss-fm13-${safeClubName}-S${game.season}-SpT${Math.min(34, game.matchday)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('📤 Spielstand als Datei exportiert!', 'success');
        } catch(e) {
            showToast('Export-Fehler: ' + e.message, 'error');
        }
    }
    function importSaveFromFile(inputEl) {
        let file = inputEl.files && inputEl.files[0];
        if (!file) return;
        let reader = new FileReader();
        reader.onload = function() {
            try {
                let p = JSON.parse(reader.result);
                applyLoadedState(p);
                updateUI();
                showScreen('screen-dashboard');
                playSound('whistle');
                showToast('📥 Spielstand aus Datei importiert!', 'success');
            } catch(e) {
                showToast('Import-Fehler: Datei ist kein gültiger Anstoß-Spielstand (' + e.message + ')', 'error');
            }
            inputEl.value = ''; // dieselbe Datei muss erneut auswählbar sein
        };
        reader.onerror = function() {
            showToast('Import-Fehler: Datei konnte nicht gelesen werden.', 'error');
            inputEl.value = '';
        };
        reader.readAsText(file);
    }

    let deleteConfirmTimers = {};
    function deleteSaveSlot(slotNum) {
        let btn = document.getElementById('btn-delete-slot-' + slotNum);
        if (btn && btn.dataset.confirming !== 'true') {
            btn.dataset.confirming = 'true';
            btn.innerText = 'Wirklich?';
            btn.style.color = '#fff';
            btn.style.background = 'var(--danger)';
            deleteConfirmTimers[slotNum] = setTimeout(() => {
                if (btn && btn.isConnected) {
                    btn.dataset.confirming = 'false';
                    btn.innerText = 'Löschen';
                    btn.style.color = '';
                    btn.style.background = '';
                }
            }, 3000);
            return;
        }
        clearTimeout(deleteConfirmTimers[slotNum]);
        safeLocalRemove(SAVE_SLOT_PREFIX + slotNum);
        showToast(`🗑️ Slot ${slotNum} gelöscht.`, 'success');
        renderSaveSlotsUI();
    }

    // Wird nach jedem Spieltag aufgerufen und sichert alle AUTOSAVE_INTERVAL Spieltage.
    function maybeAutoSave() {
        let letzter = game.lastAutoSaveMatchday || 0;
        if (game.matchday - letzter < AUTOSAVE_INTERVAL && game.matchday >= letzter) return;
        try {
            let state = buildSaveState();
            state.meta = {
                savedAt: new Date().toLocaleString('de-DE'),
                clubName: game.clubName,
                league: leagueNames[game.leagueLevel],
                season: game.season,
                matchday: Math.min(34, game.matchday),
                money: game.money
            };
            if (safeLocalSet(AUTOSAVE_KEY, JSON.stringify(state))) {
                game.lastAutoSaveMatchday = game.matchday;
                showToast(`💾 Automatisch gespeichert (Spieltag ${Math.min(34, game.matchday)}).`, 'success', 2200);
                renderSaveSlotsUI();
            }
        } catch (e) { console.error('Autosave fehlgeschlagen:', e); }
    }

    function loadAutoSave() {
        try {
            let raw = safeLocalGet(AUTOSAVE_KEY);
            if (!raw) { showToast('Es gibt noch keinen automatischen Spielstand.', 'error'); return false; }
            applyLoadedState(JSON.parse(raw));
            updateUI();
            showScreen('screen-dashboard');
            playSound('whistle');
            showToast('📂 Automatischer Spielstand geladen!', 'success');
            renderSaveSlotsUI();
            return true;
        } catch (e) { showToast('Automatischer Spielstand ist beschädigt: ' + e.message, 'error'); return false; }
    }

    // Schnellspeichern aus der unteren Menüleiste - legt immer in Slot 1 ab.
    function quickSave() { saveGameToSlot(1); }

    function renderAutoSaveBox() {
        let box = document.getElementById('save-slot-auto');
        if (!box) return;
        let raw = safeLocalGet(AUTOSAVE_KEY);
        if (!raw) {
            box.innerHTML = `<div style="font-size:10px; color:#64748b;">🔄 Automatisches Speichern: alle ${AUTOSAVE_INTERVAL} Spieltage - bisher noch keiner angelegt.</div>`;
            return;
        }
        try {
            let m = JSON.parse(raw).meta || {};
            box.innerHTML = `
                <div style="font-weight:bold; color:var(--teal);">🔄 Automatisch: ${m.clubName || '-'}</div>
                <div style="font-size:10px; color:#94a3b8;">${m.league || '-'} · Saison ${m.season} · Spieltag ${m.matchday}/34 · ${formatVal(m.money || 0)}</div>
                <div style="font-size:9px; color:#64748b;">Gespeichert: ${m.savedAt || '-'} · wird alle ${AUTOSAVE_INTERVAL} Spieltage erneuert</div>
                <button onclick="loadAutoSave()" class="btn-secondary" style="font-size:9px; margin-top:4px;">Automatischen Stand laden</button>`;
        } catch (e) {
            box.innerHTML = '<div style="font-size:10px; color:var(--danger);">Automatischer Spielstand ist beschädigt.</div>';
        }
    }

    function renderSaveSlotsUI() {
        renderAutoSaveBox();
        let versionTag = document.getElementById('game-version-tag');
        if (versionTag) versionTag.innerText = `Version ${GAME_VERSION.number} · Stand: ${GAME_VERSION.date}`;
        for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
            let meta = getSlotMeta(i);
            let box = document.getElementById('save-slot-' + i);
            if (!box) continue;
            if (meta) {
                box.innerHTML = `
                    <div style="font-weight:bold; color:var(--accent);">Slot ${i}: ${meta.clubName}</div>
                    <div style="font-size:10px; color:#94a3b8;">${meta.league} · Saison ${meta.season} · Spieltag ${meta.matchday}/34 · ${formatVal(meta.money)}</div>
                    <div style="font-size:9px; color:#64748b;">Gespeichert: ${meta.savedAt}</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:4px;">
                        <button onclick="saveGameToSlot(${i})" class="btn-blue" style="font-size:9px;">Speichern</button>
                        <button onclick="loadGameFromSlot(${i}, false)" class="btn-secondary" style="font-size:9px;">Laden</button>
                        <button onclick="deleteSaveSlot(${i})" id="btn-delete-slot-${i}" data-confirming="false" class="btn-secondary" style="font-size:9px; color:var(--danger);">Löschen</button>
                    </div>
                `;
            } else {
                box.innerHTML = `
                    <div style="color:#64748b;">Slot ${i}: Leer</div>
                    <button onclick="saveGameToSlot(${i})" class="btn-blue" style="margin-top:4px;">💾 Hier speichern</button>
                `;
            }
        }
    }

    // Rückwärtskompatibilität: alten Einzel-Speicherstand automatisch nach Slot 1 migrieren
    function migrateLegacySave() {
        try {
            let legacy = safeLocalGet(LEGACY_SAVE_KEY);
            let slot1 = safeLocalGet(SAVE_SLOT_PREFIX + '1');
            if (legacy && !slot1) {
                let p = JSON.parse(legacy);
                p.meta = {
                    savedAt: 'Migriert von altem Speicherstand',
                    clubName: "1.FC Moritz Leipzig",
                    league: (p.game && typeof leagueNames !== 'undefined') ? leagueNames[p.game.leagueLevel] : '',
                    season: p.game ? p.game.season : 1,
                    matchday: p.game ? Math.min(34, p.game.matchday) : 1,
                    money: p.game ? p.game.money : 0
                };
                safeLocalSet(SAVE_SLOT_PREFIX + '1', JSON.stringify(p));
            }
        } catch(e) { console.error('Migration fehlgeschlagen', e); }
    }

    // Alte Funktionsnamen bleiben als Kompatibilitäts-Wrapper erhalten (u.a. für den
    // window.onload-Bootstrap, der weiterhin loadGame(true) aufruft)
    function saveGame() { saveGameToSlot(1); }
    function loadGame(silent = false) { migrateLegacySave(); return loadGameFromSlot(1, silent); }

    // "Neues Spiel starten": lässt bestehende Speicherstände in den Slots unangetastet
    // (der Nutzer kann sie jederzeit über "Laden" wieder aufrufen), setzt aber die
    // AKTUELL LAUFENDE Sitzung auf einen frischen Klub zurück - über einen einmaligen
    // Reload-Marker, damit exakt derselbe Frisch-Start-Codepfad läuft wie bei einer
    // brandneuen Installation ohne jeden Speicherstand.
    // "Neues Spiel starten": lässt bestehende Speicherstände in den Slots unangetastet
    // (der Nutzer kann sie jederzeit über "Laden" wieder aufrufen), setzt aber die
    // AKTUELL LAUFENDE Sitzung auf einen frischen Klub zurück - über einen einmaligen
    // Reload-Marker, damit exakt derselbe Frisch-Start-Codepfad läuft wie bei einer
    // brandneuen Installation ohne jeden Speicherstand.
    //
    // WICHTIG: Nutzt bewusst KEIN window.confirm()! In manchen Dateimanager-Vorschauen
    // (eingebettete WebViews auf Android) werden native Dialoge (alert/confirm)
    // unterdrückt oder liefern sofort "false" zurück, ohne dass der Nutzer sie je sieht -
    // der Button würde dann scheinbar wirkungslos bleiben. Stattdessen ein dialogfreier
    // Zwei-Klick-Bestätigungsmechanismus direkt am Button selbst (gleiches Muster wie
    // bereits bei deleteSaveSlot() bewährt).
    // Startbedingungen konfigurierbar (NEU): bisher fest 6. Liga/150.000 € - jetzt wählbar,
    // BEVOR der eigentliche Reset erfolgt. Übergibt die Wahl über sessionStorage-Marker
    // (analog zum FORCE_NEW_GAME_FLAG selbst) über den Reload hinweg, da nach dem Reload
    // ein komplett frisches game-Objekt entsteht (siehe window.onload in index.html).
    const NEW_GAME_LEVEL_OPTIONS = [
        { level: 5, label: '6. Liga (Standard)' },
        { level: 3, label: '4. Liga (Fortgeschritten)' },
        { level: 0, label: '1. Liga (Profi-Herausforderung)' }
    ];
    const NEW_GAME_MONEY_OPTIONS = [
        { amount: 150000, label: 'Standard (150.000 €)' },
        { amount: 500000, label: 'Großzügig (500.000 €)' }
    ];
    let selectedNewGameLevel = 5;
    let selectedNewGameMoney = 150000;
    let newGameConfirmTimer = null;
    function startNewGame() {
        let box = document.getElementById('new-game-setup-box');
        if (!box) return;
        let show = box.style.display === 'none';
        box.style.display = show ? 'block' : 'none';
        if (show) renderNewGameSetupOptions();
    }
    function renderNewGameSetupOptions() {
        let levelBox = document.getElementById('new-game-level-btns');
        if (levelBox) {
            levelBox.innerHTML = NEW_GAME_LEVEL_OPTIONS.map(o =>
                `<button onclick="selectedNewGameLevel=${o.level}; renderNewGameSetupOptions();" class="${o.level === selectedNewGameLevel ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:5px 2px;">${o.label}</button>`
            ).join('');
        }
        let moneyBox = document.getElementById('new-game-money-btns');
        if (moneyBox) {
            moneyBox.innerHTML = NEW_GAME_MONEY_OPTIONS.map(o =>
                `<button onclick="selectedNewGameMoney=${o.amount}; renderNewGameSetupOptions();" class="${o.amount === selectedNewGameMoney ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:5px 2px;">${o.label}</button>`
            ).join('');
        }
    }
    function confirmNewGameWithSettings(btn) {
        if (btn && btn.dataset.confirming !== 'true') {
            btn.dataset.confirming = 'true';
            btn.innerText = '⚠️ Wirklich? Fortschritt weg! Nochmal tippen zum Bestätigen';
            newGameConfirmTimer = setTimeout(() => {
                if (btn.isConnected) { btn.dataset.confirming = 'false'; btn.innerText = '✅ Neues Spiel mit diesen Einstellungen starten'; }
            }, 4000);
            return;
        }
        clearTimeout(newGameConfirmTimer);
        safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
        safeSessionSet('anstoss_fm13_newgame_leaguelevel', String(selectedNewGameLevel));
        safeSessionSet('anstoss_fm13_newgame_money', String(selectedNewGameMoney));
        location.reload();
    }

    // Kompletter Werksreset: löscht ALLE drei Speicherslots + den alten Einzel-Speicherstand
    // unwiderruflich (vorher wurde hier fälschlich nur der längst abgelöste Legacy-Key
    // gelöscht, wodurch der eigentlich aktive Slot 1 unangetastet blieb und "Reset"
    // wirkungslos schien). Ebenfalls ohne window.confirm(), aus demselben Grund wie oben.
    let hardResetConfirmTimer = null;
    function adminHardResetGame() {
        let btn = document.getElementById('btn-admin-hard-reset');
        if (btn && btn.dataset.confirming !== 'true') {
            btn.dataset.confirming = 'true';
            btn.innerText = '⚠️ WIRKLICH ALLES LÖSCHEN? Nochmal tippen!';
            hardResetConfirmTimer = setTimeout(() => {
                if (btn && btn.isConnected) { btn.dataset.confirming = 'false'; btn.innerText = '💣 Komplett-Reset'; }
            }, 4000);
            return;
        }
        clearTimeout(hardResetConfirmTimer);
        for (let i = 1; i <= SAVE_SLOT_COUNT; i++) safeLocalRemove(SAVE_SLOT_PREFIX + i);
        safeLocalRemove(LEGACY_SAVE_KEY);
        safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
        location.reload();
    }

