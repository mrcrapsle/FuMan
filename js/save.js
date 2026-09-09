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
        return { game, managerRPG, incomingOffers, holdingCompany, rawMaterials, factories, merchandise, merchExtras, productionQueue, globalScoutResults, scoutingNetwork, securityWorkforce, mediaRights, realEstatePortfolio, stockMarket, financeCentralState, underworld, stadium, campusBuildings, staffMembers, staffMeta, staffCentralState, fanGroups, fanCentralState, privateLife, bandenSponsors, activeBet, betHistory, squad, lineup, secondTeamSquad, secondTeamLineup, leaguesData, fixturesData, cupTournament, europeTournament, inboxMessages, inboxArchive, rivalryRecord, crestHistory, loanedPlayers };
    }

    function applyLoadedState(p) {
        if (p.game) Object.assign(game, p.game);
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
        if (p.secondTeamLineup) secondTeamLineup = p.secondTeamLineup;
        if (p.inboxMessages) inboxMessages = p.inboxMessages;
        if (p.inboxArchive) inboxArchive = p.inboxArchive;
        if (p.rivalryRecord) rivalryRecord = p.rivalryRecord;
        if (p.crestHistory) crestHistory = p.crestHistory;
        if (p.loanedPlayers) loanedPlayers = p.loanedPlayers;
        if (p.leaguesData) leaguesData = p.leaguesData;
        if (p.fixturesData) fixturesData = p.fixturesData;
        if (p.cupTournament) cupTournament = p.cupTournament;
        if (p.europeTournament) europeTournament = p.europeTournament;
        restoreGetters();
    }

    function getSlotMeta(slotNum) {
        try {
            let raw = localStorage.getItem(SAVE_SLOT_PREFIX + slotNum);
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
                clubName: "Lok Leipzig",
                league: leagueNames[game.leagueLevel],
                season: game.season,
                matchday: Math.min(34, game.matchday),
                money: game.money
            };
            localStorage.setItem(SAVE_SLOT_PREFIX + slotNum, JSON.stringify(state));
            playSound('whistle');
            showToast(`💾 In Slot ${slotNum} gespeichert!`, 'success');
            renderSaveSlotsUI();
        } catch(e) {
            showToast('Speicherfehler: ' + e.message, 'error');
        }
    }

    function loadGameFromSlot(slotNum, silent = false) {
        try {
            let raw = localStorage.getItem(SAVE_SLOT_PREFIX + slotNum);
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
        localStorage.removeItem(SAVE_SLOT_PREFIX + slotNum);
        showToast(`🗑️ Slot ${slotNum} gelöscht.`, 'success');
        renderSaveSlotsUI();
    }

    function renderSaveSlotsUI() {
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
            let legacy = localStorage.getItem(LEGACY_SAVE_KEY);
            let slot1 = localStorage.getItem(SAVE_SLOT_PREFIX + '1');
            if (legacy && !slot1) {
                let p = JSON.parse(legacy);
                p.meta = {
                    savedAt: 'Migriert von altem Speicherstand',
                    clubName: "Lok Leipzig",
                    league: (p.game && typeof leagueNames !== 'undefined') ? leagueNames[p.game.leagueLevel] : '',
                    season: p.game ? p.game.season : 1,
                    matchday: p.game ? Math.min(34, p.game.matchday) : 1,
                    money: p.game ? p.game.money : 0
                };
                localStorage.setItem(SAVE_SLOT_PREFIX + '1', JSON.stringify(p));
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
    let newGameConfirmTimer = null;
    function startNewGame() {
        let btn = document.getElementById('btn-new-game');
        if (btn && btn.dataset.confirming !== 'true') {
            btn.dataset.confirming = 'true';
            btn.innerText = '⚠️ Wirklich? Fortschritt weg! Nochmal tippen zum Bestätigen';
            newGameConfirmTimer = setTimeout(() => resetNewGameButton(), 4000);
            return;
        }
        clearTimeout(newGameConfirmTimer);
        safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
        location.reload();
    }
    function resetNewGameButton() {
        let btn = document.getElementById('btn-new-game');
        if (btn) {
            btn.dataset.confirming = 'false';
            btn.innerText = '🆕 Neues Spiel starten (frischer Klub)';
        }
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
        for (let i = 1; i <= SAVE_SLOT_COUNT; i++) localStorage.removeItem(SAVE_SLOT_PREFIX + i);
        localStorage.removeItem(LEGACY_SAVE_KEY);
        safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
        location.reload();
    }
