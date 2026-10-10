
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
    // Welcher Stand zuletzt geschrieben wurde ('auto' oder 'slot1'..): beim Start wird genau
    // dieser geladen - früher immer Slot 1, wodurch der neuere Autosave verloren schien.
    const LAST_SAVE_KEY = 'anstoss_fm13_last_save';
    let autosaveWarnungGezeigt = false;
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

    // Spielpläne kompakt speichern: [heim, gast, heimtore, gasttore] statt Objekten mit
    // langen Feldnamen (-1 = noch nicht gespielt) - macht rund die Hälfte des Spielstands aus.
    function packFixtures(fx) {
        return { packed: 1, ligen: (fx || []).map(liga => (liga || []).map(tag => (tag || []).map(f =>
            [f.home, f.away, f.played ? f.homeGoals : -1, f.played ? f.awayGoals : -1]))) };
    }
    function unpackFixtures(fx) {
        if (!fx || !fx.packed) return fx; // alter Spielstand: bereits Objekte
        return fx.ligen.map(liga => liga.map(tag => tag.map(([home, away, hg, ag]) =>
            ({ home, away, homeGoals: hg >= 0 ? hg : null, awayGoals: ag >= 0 ? ag : null, played: hg >= 0 }))));
    }

    function buildSaveState() {
        return { game, managerRPG, incomingOffers, holdingCompany, rawMaterials, factories, merchandise, merchExtras, productionQueue, globalScoutResults, scoutingNetwork, securityWorkforce, mediaRights, realEstatePortfolio, stockMarket, financeCentralState, underworld, stadium, campusBuildings, staffMembers, staffMeta, staffCentralState, secondTeamStaff, fanGroups, fanCentralState, privateLife, bandenSponsors, activeBet, betHistory, squad, lineup, secondTeamSquad, secondTeamLineup, youthTalents, activeLoans, loanClubRelationships, loanClubLastInteractionSeason, leaguesData, fixturesData: packFixtures(fixturesData), cupTournament, landesPokal, europeTournament, inboxMessages, inboxArchive, rivalryRecord, crestHistory, loanedPlayers, loanablePlayers, incomingLoans, youthLeagueTable, youthLeagueMatchday };
    }

    // Kontoauszug pausieren: das Object.assign im Rumpf setzt game.money auf den
    // gespeicherten Wert - ohne Pause erschiene das als gigantische Buchung. Das
    // Fortsetzen steht in einem finally: bricht das Laden mittendrin ab (z.B. beim
    // Import einer beschaedigten Datei), bliebe die Protokollierung sonst dauerhaft
    // abgeschaltet und alle spaeteren Buchungen fehlten stillschweigend im Auszug.
    function applyLoadedState(p) {
        if (typeof kontoauszugPausieren === 'function') kontoauszugPausieren();
        try {
            applyLoadedStateInner(p);
        } finally {
            if (typeof kontoauszugFortsetzen === 'function') kontoauszugFortsetzen();
        }
    }

    function applyLoadedStateInner(p) {
        if (p.game) Object.assign(game, p.game);
        // Migrations-Fix: game.secondTeam.name wird als verschachteltes Objekt beim
        // Object.assign oben komplett aus dem alten Spielstand übernommen - falls dort noch
        // "Lok Leipzig II" gespeichert war, hier konsistent korrigieren.
        if (game.secondTeam && game.secondTeam.name && game.secondTeam.name.includes('Lok Leipzig')) {
            game.secondTeam.name = game.secondTeam.name.replace('Lok Leipzig', '1.FC Moritz Leipzig');
        }
        if (p.landesPokal) Object.assign(landesPokal, p.landesPokal);
        if (p.secondTeamStaff) Object.assign(secondTeamStaff, p.secondTeamStaff);
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
        if (p.fixturesData) fixturesData = unpackFixtures(p.fixturesData);
        if (p.cupTournament) cupTournament = p.cupTournament;
        if (p.europeTournament) europeTournament = p.europeTournament;
        // Migrations-Fix: Speicherstände von vor der Vereinsumbenennung hatten den
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
        // Felder entfernter Module sofort loswerden, nicht erst beim nächsten Monatswechsel.
        if (typeof cleanupRemovedModuleState === 'function') cleanupRemovedModuleState();
        // Heimatstadt (js/club-geo.js): alte Spielstände bekommen sie, Ligennamen/Landespokal passend.
        // Object.assign löscht nichts: ein alter Stand ohne homeCity darf die Heimat des
        // zuvor laufenden Spiels nicht erben.
        if (p.game && !p.game.homeCity) delete game.homeCity;
        if (typeof ensureHomeCity === 'function') { ensureHomeCity(); applyHomeRegion(); }
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
        if (typeof markOnboardingStep === 'function') markOnboardingStep('speichern');
        try {
            let state = buildSaveState();
            state.meta = buildSaveMeta();
            // writeSaveVerified (save-safety.js) erkennt blockierten und vollen Speicher und
            // liest den Stand zurück; der alte Slot-Inhalt wandert vorher in die Sicherheitskopie.
            backupSlotBeforeOverwrite(SAVE_SLOT_PREFIX + slotNum, `Slot ${slotNum}`);
            let erg = writeSaveVerified(SAVE_SLOT_PREFIX + slotNum, JSON.stringify(state));
            if (!erg.ok) {
                showToast(describeSaveFailure(erg), 'error', 8000);
                renderSaveSlotsUI();
                return;
            }
            safeLocalSet(LAST_SAVE_KEY, 'slot' + slotNum);
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
                // Geprüft und mit Sicherheitskopie des laufenden Spiels (save-safety.js).
                if (!loadSaveSafely(raw, { label: `Slot ${slotNum}`, backup: !silent, silent })) { renderSaveSlotsUI(); return false; }
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

    // ---------- SPIELSTAND ALS DATEI EXPORTIEREN/IMPORTIEREN ----------
    // Ergänzt die 3 lokalen Slots (localStorage) um eine echte, portable Datei - wichtig
    // seit klar ist, dass localStorage in manchen Android-Ansichten komplett blockiert
    // sein kann (siehe safeLocalSet-Absicherung oben) UND weil localStorage grundsätzlich
    // beim Browser-Cache-Leeren oder App-Neuinstallation verloren gehen kann. Nutzt dasselbe
    // Blob+<a download>-Muster wie downloadSelfTestArchiveFile() (admin.js).
    function exportSaveToFile() {
        try {
            let state = buildSaveState();
            state.meta = buildSaveMeta();
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
            game.lastExportSeason = game.season;
            renderSaveSlotsUI();
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
                if (loadSaveSafely(reader.result, { label: 'Importdatei' })) {
                    updateUI();
                    showScreen('screen-dashboard');
                    playSound('whistle');
                    showToast('📥 Spielstand aus Datei importiert!', 'success');
                    renderSaveSlotsUI();
                }
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
            state.meta = buildSaveMeta();
            let erg = writeSaveVerified(AUTOSAVE_KEY, JSON.stringify(state));
            if (erg.ok) {
                game.lastAutoSaveMatchday = game.matchday;
                safeLocalSet(LAST_SAVE_KEY, 'auto');
                showToast(`💾 Automatisch gespeichert (Spieltag ${Math.min(34, game.matchday)}).`, 'success', 2200);
                renderSaveSlotsUI();
            } else if (!autosaveWarnungGezeigt) {
                // Nicht mehr stumm scheitern: einmal pro Sitzung deutlich warnen.
                autosaveWarnungGezeigt = true;
                game.lastAutoSaveMatchday = game.matchday;
                showToast('⚠️ Automatisches Speichern nicht möglich. ' + describeSaveFailure(erg), 'error', 9000);
            }
        } catch (e) { console.error('Autosave fehlgeschlagen:', e); }
    }

    function loadAutoSave() {
        try {
            let raw = safeLocalGet(AUTOSAVE_KEY);
            if (!raw) { showToast('Es gibt noch keinen automatischen Spielstand.', 'error'); return false; }
            if (!loadSaveSafely(raw, { label: 'Autosave' })) return false;
            updateUI();
            showScreen('screen-dashboard');
            playSound('whistle');
            showToast('📂 Automatischer Spielstand geladen!', 'success');
            renderSaveSlotsUI();
            return true;
        } catch (e) { showToast('Automatischer Spielstand ist beschädigt: ' + e.message, 'error'); return false; }
    }

    // Spielstart: den zuletzt geschriebenen Stand laden (Autosave oder Slot), sonst Slot 1.
    // Ist er beschädigt, lädt loadNewestIntactSave() (save-safety.js) den nächstneueren heilen Stand.
    function loadMostRecentGame() {
        let zuletzt = safeLocalGet(LAST_SAVE_KEY);
        // Ohne Merker (sehr alte Stände, Testumgebung) wie früher nur Slot 1 versuchen.
        if (!zuletzt) return loadGame(true);
        migrateLegacySave();
        return loadNewestIntactSave(zuletzt);
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
                <div style="font-size:9px; color:#64748b;">Gespeichert: ${m.savedAt || '-'} · wird alle ${AUTOSAVE_INTERVAL} Spieltage erneuert · beim Start wird automatisch der neueste Stand geladen</div>
                <button onclick="loadAutoSave()" class="btn-secondary" style="font-size:9px; margin-top:4px;">Automatischen Stand laden</button>`;
        } catch (e) {
            box.innerHTML = '<div style="font-size:10px; color:var(--danger);">Automatischer Spielstand ist beschädigt.</div>';
        }
    }

    // Dashboard: letzter Autosave in einer Zeile (25.25), ohne Umweg über das Speichermenü.
    function renderDashAutosaveLine() {
        const box = document.getElementById('dash-autosave-line');
        if (!box) return;
        const raw = safeLocalGet(AUTOSAVE_KEY);
        let m = null;
        try { m = raw ? (JSON.parse(raw).meta || null) : null; } catch (e) { m = null; }
        const en = typeof currentLang !== 'undefined' && currentLang === 'en';
        box.innerHTML = m
            ? (en
                ? `🔄 Autosave: season ${m.season} · matchday ${m.matchday}/34${m.savedAt ? ` · saved ${m.savedAt}` : ''} <span style="color:var(--text-muted);">(renewed every ${AUTOSAVE_INTERVAL} matchdays)</span>`
                : `🔄 Autosave: Saison ${m.season} · Spieltag ${m.matchday}/34${m.savedAt ? ` · gespeichert ${m.savedAt}` : ''} <span style="color:var(--text-muted);">(alle ${AUTOSAVE_INTERVAL} Spieltage erneuert)</span>`)
            : (en
                ? `🔄 Autosave: none yet - it is created every ${AUTOSAVE_INTERVAL} matchdays.`
                : `🔄 Autosave: noch keiner - er wird alle ${AUTOSAVE_INTERVAL} Spieltage angelegt.`);
    }

    function renderSaveSlotsUI() {
        renderAutoSaveBox();
        if (typeof renderSaveSafetyBox === 'function') renderSaveSafetyBox();
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
                    <div style="font-size:9px; color:#64748b;">Gespeichert: ${meta.savedAt}${meta.version ? ` · Version ${meta.version}` : ''}</div>
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
    // Startbedingungen konfigurierbar: bisher fest 6. Liga/150.000 € - jetzt wählbar,
    // BEVOR der eigentliche Reset erfolgt. Übergibt die Wahl über sessionStorage-Marker
    // (analog zum FORCE_NEW_GAME_FLAG selbst) über den Reload hinweg, da nach dem Reload
    // ein komplett frisches game-Objekt entsteht (siehe window.onload in index.html).
    const NEW_GAME_LEVEL_OPTIONS = [
        { level: 5, label: '6. Liga (Standard)' },
        { level: 3, label: '4. Liga (Fortgeschritten)' },
        { level: 0, label: '1. Liga (Profi-Herausforderung)' }
    ];
    const NEW_GAME_MONEY_OPTIONS = [
        { amount: 150000, label: 'Standard' },
        { amount: 500000, label: 'Großzügig' }
    ];
    // Startkapital und Stadiongroesse muessen zur gewaehlten Startliga passen. Vorher galt
    // fuer JEDE Startliga derselbe Betrag und dasselbe 15.550-Plaetze-Stadion: ein
    // Erstliga-Start bekam 150.000 EUR Startkapital bei 2,5 Mio. EUR Gehaltskosten PRO
    // SPIELTAG und ein Stadion, das jede Woche ausverkauft war und trotzdem nur einen
    // Bruchteil der Gehaelter einspielte. Beides skaliert jetzt mit der Liga.
    // Bundesliga 80 statt 40 (25.9): seit Spielbetrieb & Verwaltung (20 Mio. €/Saison) trägt erst
    // die TV-Restausschüttung am Saisonende das Jahr - mit 6 Mio. € fiel ein Mittelfeldklub
    // unterjährig auf ~2 Mio. €.
    const NEW_GAME_LEAGUE_MONEY_SCALE = [80, 10, 3, 1.6, 1.1, 1];
    const NEW_GAME_LEAGUE_STADIUM_SCALE = [3.0, 2.0, 1.4, 1.0, 1.0, 1.0];

    function getNewGameStartMoney(level, amount) {
        return Math.round(amount * (NEW_GAME_LEAGUE_MONEY_SCALE[level] ?? 1));
    }

    // Skaliert die Kapazitaet JEDES Blocks - stadium.total ist ein Getter ueber die Bloecke
    // (siehe restoreGetters()), darf also nicht direkt gesetzt werden.
    function scaleStadiumForLeague(level) {
        let faktor = NEW_GAME_LEAGUE_STADIUM_SCALE[level] ?? 1;
        if (faktor === 1) return;
        Object.values(stadium.blocks || {}).forEach(b => {
            if (b && typeof b.cap === 'number') b.cap = Math.round(b.cap * faktor / 50) * 50;
        });
    }
    // Wer in einer höheren Liga startet, hat deren Lizenz schon: Flutlicht und Internat-Stufe
    // wie gefordert. Sonst kam ein abgestiegener Bundesliga-Startverein ohne Internat nicht
    // wieder hoch (Platz 2, Lizenz verweigert - Langzeittest 21.6).
    function grantStartLeagueLicence(level) {
        let req = DFB_LICENSING_REQUIREMENTS[level];
        if (!req) return;
        if (req.floodlight) stadium.flutlicht = true;
        if (campusBuildings.internat) campusBuildings.internat.lvl = Math.max(campusBuildings.internat.lvl || 0, req.minYouthLvl || 0);
    }
    let selectedNewGameLevel = 5;
    let selectedNewGameCity = 'Leipzig';
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
        if (typeof renderNewGameScenarioOptions === 'function') renderNewGameScenarioOptions();
        let cityBox = document.getElementById('new-game-city-box');
        if (cityBox && typeof getHomeCityOptions === 'function') {
            let info = HOME_CITIES[selectedNewGameCity];
            cityBox.innerHTML = `<select id="new-game-city" onchange="selectedNewGameCity=this.value; renderNewGameSetupOptions();" class="input-inline" style="width:100%; font-size:11px; padding:6px;">
                ${getHomeCityOptions().map(o => `<option value="${o.city}" ${o.city === selectedNewGameCity ? 'selected' : ''}>${o.city} (${o.state})</option>`).join('')}
            </select><div style="font-size:9px; color:var(--text-muted); margin-top:3px;">Region ${HOME_REGIONS[info.region].label}: ${HOME_REGIONS[info.region].regionalliga} · ${OBERLIGEN[info.ol].name} · ${LIGA6[info.l6].name} · ${info.verband}pokal</div>`;
        }
        let levelBox = document.getElementById('new-game-level-btns');
        if (levelBox) {
            levelBox.innerHTML = NEW_GAME_LEVEL_OPTIONS.map(o =>
                `<button onclick="selectedNewGameLevel=${o.level}; renderNewGameSetupOptions();" class="${o.level === selectedNewGameLevel ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:5px 2px;">${o.label}</button>`
            ).join('');
        }
        let moneyBox = document.getElementById('new-game-money-btns');
        if (moneyBox) {
            moneyBox.innerHTML = NEW_GAME_MONEY_OPTIONS.map(o =>
                `<button onclick="selectedNewGameMoney=${o.amount}; renderNewGameSetupOptions();" class="${o.amount === selectedNewGameMoney ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:5px 2px;">${o.label}<br><span style="font-size:8px; opacity:0.85;">${formatVal(getNewGameStartMoney(selectedNewGameLevel, o.amount))}</span></button>`
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
        // Das bisherige Spiel bleibt als Sicherheitskopie erhalten (save-safety.js).
        backupCurrentGame('vor dem neuen Spiel');
        safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
        // Karriere-Szenario (js/scenarios.js): bestimmt die Startliga selbst.
        let szenario = (typeof selectedNewGameScenario !== 'undefined' && selectedNewGameScenario && CAREER_SCENARIOS[selectedNewGameScenario]) ? selectedNewGameScenario : null;
        safeSessionSet('anstoss_fm13_newgame_leaguelevel', String(szenario ? CAREER_SCENARIOS[szenario].level : selectedNewGameLevel));
        safeSessionSet('anstoss_fm13_newgame_money', String(szenario ? 150000 : selectedNewGameMoney));
        if (szenario) safeSessionSet('anstoss_fm13_newgame_scenario', szenario);
        safeSessionSet('anstoss_fm13_newgame_city', selectedNewGameCity);
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
        safeLocalRemove(AUTOSAVE_KEY);
        safeLocalRemove(SAVE_BACKUP_KEY);
        safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
        location.reload();
    }

