    // ==========================================
    // Zugang zum Admin-Menü (Phase 26.20): Die öffentliche Fassung enthält dieses Modul nicht (build.py lässt
    // js/admin.js, js/admin-tools.js und die NUR-ENTWICKLER-Blöcke in index.html weg). Auf der geheimen
    // Entwickler-Seite setzt der Deploy über DEV_PIN den SHA-256-Wert von "anstoss-fm13:" + PIN ein; dann fragt
    // showScreen('screen-admin') einmal je Gerät nach der PIN. Ohne Wert (lokal, Tests) ist das Menü frei.
    // ==========================================
    let adminPinHash = '';
    const ADMIN_FREI_KEY = 'anstoss_fm13_admin_frei';
    const ADMIN_PIN_PREFIX = 'anstoss-fm13:';

    // SHA-256 als Hex-Text (synchron, auch auf file:// ohne crypto.subtle)
    function adminSha256(text) {
        const k = [], h = [];
        let n = 2, c = 0;
        const frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
        while (c < 64) {
            let prim = true;
            for (let d = 2; d * d <= n; d++) if (n % d === 0) { prim = false; break; }
            if (prim) { if (c < 8) h[c] = frac(Math.pow(n, 1 / 2)); k[c++] = frac(Math.pow(n, 1 / 3)); }
            n++;
        }
        const bytes = Array.from(new TextEncoder().encode(text));
        const bitLen = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 0xff);
        const rotr = (x, r) => (x >>> r) | (x << (32 - r));
        for (let off = 0; off < bytes.length; off += 64) {
            const w = [];
            for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            let [a, b, cc, d, e, f, g, hh] = h;
            for (let i = 0; i < 64; i++) {
                const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
                const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
                hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
            }
            [a, b, cc, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) | 0; });
        }
        return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
    }

    function adminZugangFrei() {
        return !adminPinHash || safeLocalGet(ADMIN_FREI_KEY) === adminPinHash;
    }

    function openAdminPin() {
        const ov = document.getElementById('admin-pin-overlay');
        if (!ov) return;
        const feld = document.getElementById('admin-pin-input');
        if (feld) feld.value = '';
        ov.classList.add('show');
        if (feld) feld.focus();
    }

    function closeAdminPin() {
        const ov = document.getElementById('admin-pin-overlay');
        if (ov) ov.classList.remove('show');
    }

    function adminPinPruefen() {
        const feld = document.getElementById('admin-pin-input');
        const eingabe = feld ? feld.value : '';
        if (!eingabe) { showToast('Bitte die PIN eingeben.', 'error'); return false; }
        if (adminSha256(ADMIN_PIN_PREFIX + eingabe) !== adminPinHash) {
            if (feld) feld.value = '';
            showToast('🔒 Falsche PIN.', 'error');
            return false;
        }
        safeLocalSet(ADMIN_FREI_KEY, adminPinHash);
        closeAdminPin();
        showToast('🔓 Admin-Menü auf diesem Gerät freigeschaltet.', 'success');
        showScreen('screen-admin');
        return true;
    }

    function adminSperren() {
        if (!adminPinHash) { showToast('Auf dieser Fassung ist keine PIN gesetzt - das Admin-Menü ist immer frei.', 'error', 4000); return; }
        safeLocalRemove(ADMIN_FREI_KEY);
        showToast('🔒 Admin-Menü auf diesem Gerät gesperrt.', 'success');
        showScreen('screen-dashboard');
    }

    // Kostenloser Premium-Punkte-Bonus (lag früher in js/premium.js, gehört aber zu den Cheats)
    function adminGrantPremiumPoints() {
        playSound('goal');
        game.premiumPoints = (game.premiumPoints || 0) + 5000;
        showToast('👑 Admin: +5.000 Premium-Punkte kostenlos gutgeschrieben!', 'success');
        renderPremiumShopView();
        updateUI();
    }


    // Selbsttest-Ergebnis-Archiv: zeigt die letzten Läufe mit Zeitstempel im Admin-Bereich.
    function renderSelfTestArchive() {
        let box = document.getElementById('self-test-archive-box');
        if (!box) return;
        let history = game.selfTestHistory || [];
        if (history.length === 0) {
            box.innerHTML = '<div class="box" style="font-size:var(--fs-small); color:var(--text-muted);">Noch kein Selbsttest gelaufen.</div>';
            return;
        }
        box.innerHTML = history.map(h => {
            let color = h.problemsCount === 0 ? 'var(--primary)' : 'var(--danger)';
            let statusText = h.problemsCount === 0 ? '✅ Alles OK' : `⚠️ ${h.problemsCount} Problem(e)`;
            return `<div class="box" style="font-size:var(--fs-small); border-left-color:${color};">${h.timestamp}: <strong style="color:${color};">${statusText}</strong></div>`;
        }).join('');
    }

    // Selbsttest-Export: kopiert den kompletten Verlauf als JSON in die Zwischenablage,
    // damit man bei einem Problem einfach den Text statt eines Screenshots schicken kann.
    function exportSelfTestArchive() {
        let data = JSON.stringify(game.selfTestHistory || [], null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(data).then(() => {
                showToast('📋 Selbsttest-Verlauf in die Zwischenablage kopiert!', 'success');
            }).catch(() => {
                showSelfTestExportFallback(data);
            });
        } else {
            showSelfTestExportFallback(data);
        }
    }
    // Zusätzlich als echte JSON-Datei herunterladbar, falls Copy&Paste auf dem Gerät
    // unpraktisch ist (z.B. um die Datei direkt per Messenger/E-Mail weiterzuschicken).
    function downloadSelfTestArchiveFile() {
        let data = JSON.stringify(game.selfTestHistory || [], null, 2);
        try {
            let blob = new Blob([data], { type: 'application/json' });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = `anstoss-fm13-selbsttest-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('💾 Selbsttest-Datei heruntergeladen!', 'success');
        } catch (e) {
            showSelfTestExportFallback(data);
        }
    }
    // Fallback für Umgebungen ohne Zwischenablage-Zugriff (z.B. eingeschränkte WebViews):
    // zeigt den Text direkt in einem auswählbaren Textfeld an.
    function showSelfTestExportFallback(data) {
        let box = document.getElementById('self-test-export-fallback');
        if (box) {
            box.style.display = 'block';
            box.querySelector('textarea').value = data;
        } else {
            showToast('Zwischenablage nicht verfügbar. Selbsttest-Daten:\n\n' + data.slice(0, 500), 'success', 4000);
        }
    }

    function renderAdminView() {
        let versionTag = document.getElementById('admin-version-tag');
        if (versionTag) versionTag.innerText = `Version ${GAME_VERSION.number} · Stand: ${GAME_VERSION.date}`;
        let leagueEl = document.getElementById('adm-ins-league');
        if (leagueEl) leagueEl.innerText = leagueNames[game.leagueLevel];
        renderSelfTestArchive();

        let avgStr = Math.round(squad.reduce((s, p) => s + p.strength, 0) / Math.max(1, squad.length));
        let strEl = document.getElementById('adm-ins-str');
        if (strEl) strEl.innerText = avgStr;

        let sqEl = document.getElementById('adm-ins-squad-size');
        if (sqEl) sqEl.innerText = squad.length + " Spieler";

        let prEl = document.getElementById('adm-ins-pressure');
        if (prEl) prEl.innerText = underworld.pressure + '%';

        let debtEl = document.getElementById('adm-ins-debt');
        if (debtEl) debtEl.innerText = formatVal(game.loanDebt);

        let rawEl = document.getElementById('adm-ins-raw');
        if (rawEl) rawEl.innerText = (rawMaterials.totalStock || 0).toLocaleString() + " kg";
        if (typeof renderAdminTools === 'function') renderAdminTools();

    }

    function adminAddClubMoney(amt) { playSound('goal'); game.money += amt; updateUI(); renderAdminView(); showToast(`💵 +${formatVal(amt)} Vereinskonto gutgeschrieben!`, 'success', 4000); }

    function adminResetDebt() {
        playSound('goal');
        game.loanDebt = 0;
        // "Alle" Kreditschulden erlassen hieß bisher nur den alten Sofortkredit, nicht die
        // neueren gestaffelten Kredite (Finanzen & Kapitalmarkt) - jetzt wirklich vollständig.
        activeLoans = [];
        updateUI();
        renderAdminView();
        showToast("🚫 Alle Kreditschulden erlassen!", 'success', 4000);
    }

    function adminSetTransferBudget(amt) { playSound('goal'); game.transferBudget = amt; updateUI(); renderAdminView(); showToast(`💼 Transferbudget auf ${formatVal(amt)} gesetzt!`, 'success', 4000); }

    function adminMaxOutAllBuildings() {
        playSound('goal');
        for (let k in campusBuildings) campusBuildings[k].lvl = 5;
        for (let b in stadium.blocks) { 
            stadium.blocks[b].cap = 12500; 
            stadium.blocks[b].foodLvl = 3; 
            stadium.blocks[b].merchLvl = 3; 
            stadium.blocks[b].toiletLvl = 3; 
            stadium.blocks[b].expansions = 5;
        }
        stadium.blocks.vipLogen.cap = 500;
        stadium.flutlicht = true; stadium.rasenheizung = true; stadium.videowalls = true; stadium.dach = true;
        updateUI();
        renderAdminView();
        showToast("🏟️ Mega-Arena & Campus komplett auf Maximalstufe ausgebaut (100.000 Plätze)!", 'success', 4000);
    }

    function adminMaxMerchHolding() {
        playSound('goal');
        for (let k in factories) { factories[k].owned = true; factories[k].lvl = 5; }
        holdingCompany.money += 50000000;
        updateUI();
        renderAdminView();
        showToast("🏭 Merch-Holding Max: Alle Fabriken Stufe 5 & +50 Mio. € Holding-Kapital!", 'success', 4000);
    }

    function adminMaxWarehouseStocks() {
        playSound('goal');
        rawMaterials.warehouseLevel = 5;
        rawMaterials.cotton.stock = 10000;
        rawMaterials.wool.stock = 10000;
        rawMaterials.leather.stock = 10000;
        rawMaterials.plastic.stock = 10000;
        updateUI();
        renderAdminView();
        showToast("📦 Zentrallager Stufe 5 freigeschaltet und je 10.000 kg Rohstoffe aufgefüllt!", 'success', 4000);
    }

    function adminHealAndBoostSquad() { 
        playSound('whistle'); 
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 100; p.morale = 100; }); 
        updateUI(); 
        renderAdminView();
        showToast("✨ Gesamter Kader vollständig fit, geheilt und bei 100% Moral!", 'success', 4000);
    }

    function adminUpgradeEntireSquad(boost) {
        playSound('goal');
        squad.forEach(p => { 
            p.strength = Math.min(99, p.strength + boost); 
            p.marketValue = calculatePlayerMarketValue(p.strength);
        });
        updateUI();
        renderAdminView();
        showToast(`⚡ Alle Spieler im Kader um +${boost} Stärkepunkte aufgewertet!`, 'success', 4000);
    }

    // Setzt WIRKLICH jeden gameplay-relevanten Wert jedes Spielers auf das absolute
    // Maximum, nicht nur die Gesamtstärke - inklusive aller Kernfähigkeiten, Fitness, Moral,
    // Elfmeter-Training und Heilung. Die 18 Detail-Attribute im Spieler-Popup werden
    // deterministisch aus Stärke + Position berechnet (siehe getDisplayStats()) und ziehen
    // dadurch automatisch mit, sobald die Kernwerte maximiert sind.
    function adminMaxOutEntireSquad() {
        playSound('goal');
        squad.forEach(p => {
            p.strength = 99;
            p.pace = 99;
            p.shooting = 99;
            p.passing = 99;
            p.defense = 99;
            p.fitness = 100;
            p.morale = 100;
            p.injured = 0;
            p.suspended = 0;
            p.penaltyTrainingBonus = 0.15;
            p.marketValue = calculatePlayerMarketValue(p.strength);
        });
        updateUI();
        renderAdminView();
        showToast('🌟 GESAMTES TEAM AUF MAXIMALWERT!\nAlle Spieler haben jetzt 99 in jeder Kernfähigkeit, 100% Fitness & Moral, keine Verletzungen/Sperren.', 'success', 4000);
    }

    // Kaderstärke in 5er-Schritten erhöhen: sanftere Alternative zum kompletten
    // Maximieren - hebt alle Kernwerte jedes Spielers gleichmäßig um 5 Punkte an (bis zum
    // Maximum von 99), statt alles sofort auf den Höchstwert zu springen. Praktisch für
    // schrittweises Testen der Spielbalance bei unterschiedlichen Stärkeniveaus.
    function adminBoostSquadStrengthBy5() {
        playSound('goal');
        squad.forEach(p => {
            p.strength = Math.min(99, p.strength + 5);
            p.pace = Math.min(99, (p.pace || p.strength) + 5);
            p.shooting = Math.min(99, (p.shooting || p.strength) + 5);
            p.passing = Math.min(99, (p.passing || p.strength) + 5);
            p.defense = Math.min(99, (p.defense || p.strength) + 5);
            p.physique = Math.min(99, (p.physique || p.strength) + 5);
            p.marketValue = calculatePlayerMarketValue(p.strength);
        });
        updateUI();
        renderAdminView();
        showToast('📈 Kaderstärke um 5 Schritte erhöht!\nAlle Kernwerte jedes Spielers wurden um 5 Punkte angehoben (Obergrenze 99).', 'success', 4000);
    }

    // Maximiert auch den Jugendkader und die zweite Mannschaft, für den Fall, dass man das
    // komplette Vereinsgefüge testen möchte statt nur den ersten Kader.
    function adminMaxOutYouthAndSecondTeam() {
        playSound('goal');
        youthTalents.forEach(p => { p.strength = 99; p.pace = 99; p.shooting = 99; p.passing = 99; p.defense = 99; });
        secondTeamSquad.forEach(p => { p.strength = 99; p.pace = 99; p.shooting = 99; p.passing = 99; p.defense = 99; p.fitness = 100; p.morale = 100; });
        updateUI();
        showToast('🌟 Jugendkader & zweite Mannschaft ebenfalls auf Maximalwert gesetzt!', 'success', 4000);
    }

    // Schaltet sofort alle noch gesperrten kosmetischen Extras frei (Jubiläums-Wappenmuster),
    // ohne die dafür eigentlich nötigen 10 Spielzeiten abwarten zu müssen.
    function adminUnlockAllCosmetics() {
        playSound('goal');
        game.jubileePatternUnlocked = true;
        renderCrestEditor();
        showToast('🎖️ Alle kosmetischen Extras (Jubiläums-Wappenmuster) sofort freigeschaltet!', 'success', 4000);
    }

    function adminExtendAllContracts(years) {
        playSound('click');
        squad.forEach(p => { p.contracts += years; });
        updateUI();
        renderAdminView();
        showToast(`📝 Verträge aller Spieler um +${years} Jahre verlängert!`, 'success', 4000);
    }

    function adminSpawnWonderkid() {
        playSound('goal');
        let wonderkid = createPlayer("ST", 95, 95, "Tor-Instinkt");
        wonderkid.name = "⭐ " + getRandomName() + " (Wunderkind)";
        wonderkid.wage = 5000;
        wonderkid.contracts = 5;
        squad.unshift(wonderkid);
        lineup.unshift(wonderkid.id);
        if (lineup.length > 11) lineup.pop();
        updateUI();
        renderAdminView();
        showToast(`🌟 95er Ausnahmetalent ${wonderkid.name} [Tor-Instinkt] dem Kader hinzugefügt!`, 'success', 4000);
    }

    function adminUnlockUEFAPro() { 
        playSound('goal');
        privateLife.license = 3; 
        updateUI(); 
        renderAdminView();
        showToast("🎓 UEFA Pro Lizenz sofort aktiviert (+4 Stärkebonus im Spiel)!", 'success', 4000);
    }

    function adminUnlockAllManagerPerks() {
        playSound('goal');
        for (let k in managerRPG.perks) managerRPG.perks[k] = true;
        managerRPG.level = 10;
        if (typeof checkPerkSynergyBonus === 'function') checkPerkSynergyBonus();
        updateUI();
        renderAdminView();
        showToast("🌳 Alle Manager-RPG-Perks freigeschaltet!", 'success', 4000);
    }

    function adminMaxBoardAndFans() {
        playSound('goal');
        game.boardSat = 100;
        game.fans = 100;
        updateUI();
        renderAdminView();
        showToast("❤️ 100% Fan- und Vorstandszufriedenheit gesetzt!", 'success', 4000);
    }

    function adminBoostPrivateLife() {
        playSound('goal');
        privateLife.money += 5000000;
        privateLife.stress = 0;
        privateLife.wage = 50000;
        updateUI();
        renderAdminView();
        showToast("🎩 +5.000.000 € auf Manager-Privatkonto überwiesen & Stress auf 0%!", 'success', 4000);
    }

    function adminHireAllStaffFree() {
        playSound('goal');
        let count = 0;
        for (let k in staffMembers) { staffMembers[k].hired = true; count++; }
        updateUI();
        renderAdminView();
        showToast(`👔 Alle ${count} Stab- und Expertenstellen besetzt!`, 'success', 4000);
    }

    function adminTeleportLeague(targetLevel) {
        playSound('whistle');
        game.leagueLevel = targetLevel;
        initLeagues();
        refreshTransferMarket();
        autoLineup();
        updateUI();
        renderAdminView();
        showToast(`🚀 Teleportation erfolgreich!\nDu spielst nun in der ${leagueNames[targetLevel]}.`, 'success', 4000);
    }

    // ==========================================
    // ADMIN & CHEATS: NEUE FUNKTIONEN
    // ==========================================

    // 1. Zeitraffer-Simulation mit Zwischenständen: simuliert in 5er-Etappen und protokolliert
    // nach jeder Etappe einen Schnappschuss (Tabellenplatz, Punkte, Kontostand) statt nur das
    // Endergebnis zu zeigen - hilfreich, um die Entwicklung über die Saison nachzuvollziehen.
    function adminAdvanceMatchdaysWithCheckpoints(totalMatchdays) {
        let checkpoints = [];
        let chunkSize = 5;
        let remaining = totalMatchdays;
        while (remaining > 0 && game.matchday <= 34) {
            let step = Math.min(chunkSize, remaining);
            adminAdvanceMatchdays(step);
            remaining -= step;
            let teams = leaguesData[game.leagueLevel];
            let myTeam = teams ? teams.find(t => t.name === game.clubName) : null;
            let rank = teams && myTeam ? [...teams].sort(compareTableRows).findIndex(t => t.name === game.clubName) + 1 : '-';
            checkpoints.push({ matchday: game.matchday, rank, points: myTeam ? myTeam.points : 0, money: game.money });
            if (game.matchday > 34) break;
        }
        game.adminCheckpointHistory = checkpoints;
        renderAdminCheckpointHistory();
        showToast(`⏩ Zeitraffer-Simulation abgeschlossen! ${checkpoints.length} Etappen protokolliert (siehe Tabelle im Admin-Screen).`, 'success', 4000);
    }
    function renderAdminCheckpointHistory() {
        let box = document.getElementById('admin-checkpoint-history-box');
        if (!box) return;
        let hist = game.adminCheckpointHistory || [];
        box.innerHTML = hist.length === 0
            ? '<div style="font-size:var(--fs-caption); color:var(--text-muted);">Noch keine Zeitraffer-Simulation durchgeführt.</div>'
            : hist.map(c => `<div class="box" style="display:flex; justify-content:space-between; font-size:var(--fs-caption);"><span>Spieltag ${c.matchday}</span><span>Platz ${c.rank} · ${c.points} Pkt · ${formatVal(c.money)}</span></div>`).join('');
    }

    // 2. Szenario-Presets: bereitet den Spielzustand gezielt für einen bestimmten Testfall vor,
    // statt den Zustand mühsam manuell über mehrere Einzel-Cheats herzustellen.
    function applyAdminScenarioPreset(scenario) {
        playSound('goal');
        if (scenario === 'insolvenz') {
            game.money = -5000;
            game.negativeStreak = 8;
            game.loanDebt = 80000;
            showToast('🧪 Szenario "Insolvenz-Test" aktiviert: negativer Kontostand, hohe Schulden, 8 Spieltage im Minus.', 'success', 4000);
        } else if (scenario === 'meisterrennen') {
            game.matchday = 30;
            let teams = leaguesData[game.leagueLevel];
            if (teams) {
                let myTeam = teams.find(t => t.name === game.clubName);
                if (myTeam) myTeam.points = 62;
                let sorted = [...teams].sort(compareTableRows);
                if (sorted[0] && sorted[0].name !== game.clubName) sorted[0].points = 63;
            }
            showToast('🧪 Szenario "Meisterschafts-Endspurt" aktiviert: Spieltag 30, knapper Rückstand auf Platz 1.', 'success', 4000);
        } else if (scenario === 'abstiegskampf') {
            game.matchday = 30;
            let teams = leaguesData[game.leagueLevel];
            if (teams) {
                let myTeam = teams.find(t => t.name === game.clubName);
                if (myTeam) myTeam.points = 28;
            }
            game.fans = 25;
            showToast('🧪 Szenario "Abstiegskampf" aktiviert: Spieltag 30, wenige Punkte, angespannte Fan-Stimmung.', 'success', 4000);
        }
        updateUI();
        renderAdminView();
    }

    function adminAdvanceMatchdays(count) {
        playSound('whistle');
        for (let i = 0; i < count; i++) {
            if (game.matchday > 34) break;
            let md = game.matchday;
            let isHome = true, won = false, drawn = false, playedOurMatch = false, isHomeDerby = false;
            let opponentNameThisMatch = null, ourGoalsThisMatch = 0, oppGoalsThisMatch = 0;
            rollWeather();
            syncSecondTeamIntoLeagueTable();
            for (let l = 0; l < NUM_LEAGUES; l++) {
                let fixs = fixturesData[l] ? fixturesData[l][md - 1] : [];
                fixs?.forEach(f => {
                    if (!f.played) {
                        let hTeam = leaguesData[l][f.home], aTeam = leaguesData[l][f.away];
                        let hStr = (hTeam.name === game.clubName) ? (typeof getOwnLeagueMatchStrength === 'function' ? getOwnLeagueMatchStrength(true, aTeam) : calcTeamStrength(true)) : (aTeam.name === game.clubName ? getOpponentMatchStrength(hTeam.strength, true) : hTeam.strength + AI_HOME_ADVANTAGE);
                        let aStr = (aTeam.name === game.clubName) ? (typeof getOwnLeagueMatchStrength === 'function' ? getOwnLeagueMatchStrength(false, hTeam) : calcTeamStrength(false)) : (hTeam.name === game.clubName ? getOpponentMatchStrength(aTeam.strength, false) : aTeam.strength);
                        let goals = simulateGoals(hStr, aStr, hTeam, aTeam);
                        f.homeGoals = goals.myGoals;
                        f.awayGoals = goals.oppGoals;
                        f.played = true;
                        updateLeagueTable(l, f);
                        if (game.secondTeam.isActive && typeof attributeGoalsToSecondTeamScorers === 'function') {
                            if (hTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.homeGoals);
                            else if (aTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.awayGoals);
                        }
                        if (hTeam.name === game.clubName) {
                            isHome = true; playedOurMatch = true;
                            won = f.homeGoals > f.awayGoals; drawn = f.homeGoals === f.awayGoals;
                            isHomeDerby = isDerbyOpponent(aTeam.name);
                            opponentNameThisMatch = aTeam.name; ourGoalsThisMatch = f.homeGoals; oppGoalsThisMatch = f.awayGoals;
                        } else if (aTeam.name === game.clubName) {
                            isHome = false; playedOurMatch = true;
                            won = f.awayGoals > f.homeGoals; drawn = f.homeGoals === f.awayGoals;
                            opponentNameThisMatch = hTeam.name; ourGoalsThisMatch = f.awayGoals; oppGoalsThisMatch = f.homeGoals;
                        }
                    }
                });
            }
            if (opponentNameThisMatch) recordRivalryResult(opponentNameThisMatch, ourGoalsThisMatch, oppGoalsThisMatch);
            if (playedOurMatch && typeof attributeGoalsToScorers === 'function') attributeGoalsToScorers(ourGoalsThisMatch);
            applyMatchdayFinances(isHome, won, playedOurMatch && oppGoalsThisMatch === 0, isHomeDerby, opponentNameThisMatch, opponentNameThisMatch ? `${ourGoalsThisMatch}:${oppGoalsThisMatch}` : null);
            processPostMatchRoutine(playedOurMatch ? (won ? 'win' : (drawn ? 'draw' : 'loss')) : null, isHomeDerby, false, ourGoalsThisMatch - oppGoalsThisMatch, isHome, playedOurMatch ? { total: ourGoalsThisMatch + oppGoalsThisMatch, bothScored: ourGoalsThisMatch > 0 && oppGoalsThisMatch > 0 } : null, opponentNameThisMatch);
        }
        updateUI();
        renderAdminView();
        showToast(`⏩ ${count} Spieltage vorgespult! Aktueller Spieltag: ${Math.min(34, game.matchday)}`, 'success', 4000);
    }

    function adminWinCupDirectly() {
        playSound('goal');
        game.trophies.push(`DFB-Pokalsieger (Saison ${game.season})`);
        boostFanBaseFloor(10, 'Der DFB-Pokalsieg');
        game.money += 4300000;
        updateUI();
        renderAdminView();
        showToast("🏆 DFB-Pokalsieg gutgeschrieben (+4.300.000 € Prämie & Trophäe)!", 'success', 4000);
    }

    function adminWinEuropeDirectly() {
        playSound('goal');
        game.trophies.push(`Champions Cup Sieger (Saison ${game.season})`);
        boostFanBaseFloor(15, 'Der Champions Cup Sieg');
        game.money += 25000000;
        updateUI();
        renderAdminView();
        showToast("🌟 Champions Cup Sieg gutgeschrieben (+25.000.000 € Prämie & Trophäe)!", 'success', 4000);
    }

    function adminExportSaveJson() {
        try {
            // Nutzt jetzt dieselbe zentrale buildSaveState()-Funktion wie das normale
            // Speichern, statt einer separat gepflegten, unvollständigen Kopie - der fehlten
            // u.a. zweite Mannschaft, Rivalitäts-Historie, Wappen-Verlauf, Leihspieler und
            // alle neueren Fan-/Personal-/Finanz-Zustände komplett.
            let state = buildSaveState();
            let json = JSON.stringify(state);
            let area = document.getElementById('adm-save-json');
            if (area) {
                area.value = json;
                area.select();
            }
            navigator.clipboard.writeText(json).catch(() => {});
            showToast("📤 Savegame-JSON in Textfeld kopiert & in die Zwischenablage gelegt!", 'success', 4000);
        } catch(e) { showToast("Exportfehler: " + e.message, 'success', 4000); }
    }

    function adminImportSaveJson() {
        try {
            let area = document.getElementById('adm-save-json');
            if (!area || !area.value.trim()) { showToast("Bitte erst ein Savegame-JSON in das Textfeld einfügen!", 'success', 4000); return; }
            // Derselbe geprüfte Ladeweg wie Slots und Dateiimport (save-safety.js): kaputtes
            // JSON lässt das laufende Spiel unangetastet, das alte Spiel wird gesichert.
            if (!loadSaveSafely(area.value.trim(), { label: 'Admin-JSON' })) return;
            updateUI();
            renderAdminView();
            showToast("📥 Spielstand aus JSON erfolgreich importiert und angewendet!", 'success', 4000);
        } catch(e) { showToast("Importfehler: Ungültiges JSON-Format!\n" + e.message, 'success', 4000); }
    }

    // adminHardResetGame() wurde nach save.js verschoben, da sie dort direkten Zugriff auf
    // SAVE_SLOT_PREFIX/SAVE_SLOT_COUNT hat (vorher wurde hier fälschlich nur der längst
    // abgelöste Legacy-Key gelöscht, wodurch der eigentlich aktive Speicherslot 1
    // unangetastet blieb und "Reset" wirkungslos schien).

