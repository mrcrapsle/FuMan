    // Selbsttest-Ergebnis-Archiv: zeigt die letzten Läufe mit Zeitstempel im Admin-Bereich.
    function renderSelfTestArchive() {
        let box = document.getElementById('self-test-archive-box');
        if (!box) return;
        let history = game.selfTestHistory || [];
        if (history.length === 0) {
            box.innerHTML = '<div class="box" style="font-size:10px; color:#94a3b8;">Noch kein Selbsttest gelaufen.</div>';
            return;
        }
        box.innerHTML = history.map(h => {
            let color = h.problemsCount === 0 ? 'var(--primary)' : 'var(--danger)';
            let statusText = h.problemsCount === 0 ? '✅ Alles OK' : `⚠️ ${h.problemsCount} Problem(e)`;
            return `<div class="box" style="font-size:10px; border-left-color:${color};">${h.timestamp}: <strong style="color:${color};">${statusText}</strong></div>`;
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
            alert('Zwischenablage nicht verfügbar. Selbsttest-Daten:\n\n' + data.slice(0, 500));
        }
    }

    function renderAdminView() {
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
    }

    function adminAddClubMoney(amt) { playSound('goal'); game.money += amt; updateUI(); renderAdminView(); alert(`💵 +${formatVal(amt)} Vereinskonto gutgeschrieben!`); }

    function adminResetDebt() {
        playSound('goal');
        game.loanDebt = 0;
        // "Alle" Kreditschulden erlassen hieß bisher nur den alten Sofortkredit, nicht die
        // neueren gestaffelten Kredite (Finanzen & Kapitalmarkt) - jetzt wirklich vollständig.
        activeLoans = [];
        updateUI();
        renderAdminView();
        alert("🚫 Alle Kreditschulden erlassen!");
    }

    function adminSetTransferBudget(amt) { playSound('goal'); game.transferBudget = amt; updateUI(); renderAdminView(); alert(`💼 Transferbudget auf ${formatVal(amt)} gesetzt!`); }

    function adminTriggerTransferOffer() { triggerNewAITransferOffer(); updateUI(); renderTransferView(); alert("📩 KI-Transferangebot erfolgreich erzwungen!"); }

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
        alert("🏟️ Mega-Arena & Campus komplett auf Maximalstufe ausgebaut (100.000 Plätze)!");
    }

    function adminMaxMerchHolding() {
        playSound('goal');
        for (let k in factories) { factories[k].owned = true; factories[k].lvl = 5; }
        holdingCompany.money += 50000000;
        updateUI();
        renderAdminView();
        alert("🏭 Merch-Holding Max: Alle Fabriken Stufe 5 & +50 Mio. € Holding-Kapital!");
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
        alert("📦 Zentrallager Stufe 5 freigeschaltet und je 10.000 kg Rohstoffe aufgefüllt!");
    }

    function adminHealAndBoostSquad() { 
        playSound('whistle'); 
        squad.forEach(p => { p.injured = 0; p.suspended = 0; p.fitness = 100; p.morale = 100; }); 
        updateUI(); 
        renderAdminView();
        alert("✨ Gesamter Kader vollständig fit, geheilt und bei 100% Moral!");
    }

    function adminUpgradeEntireSquad(boost) {
        playSound('goal');
        squad.forEach(p => { 
            p.strength = Math.min(99, p.strength + boost); 
            p.marketValue = calculatePlayerMarketValue(p.strength);
        });
        updateUI();
        renderAdminView();
        alert(`⚡ Alle Spieler im Kader um +${boost} Stärkepunkte aufgewertet!`);
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
        alert('🌟 GESAMTES TEAM AUF MAXIMALWERT!\nAlle Spieler haben jetzt 99 in jeder Kernfähigkeit, 100% Fitness & Moral, keine Verletzungen/Sperren.');
    }

    // Kaderstärke in 5er-Schritten erhöhen (NEU): sanftere Alternative zum kompletten
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
        alert('📈 Kaderstärke um 5 Schritte erhöht!\nAlle Kernwerte jedes Spielers wurden um 5 Punkte angehoben (Obergrenze 99).');
    }

    // Maximiert auch den Jugendkader und die zweite Mannschaft, für den Fall, dass man das
    // komplette Vereinsgefüge testen möchte statt nur den ersten Kader.
    function adminMaxOutYouthAndSecondTeam() {
        playSound('goal');
        youthTalents.forEach(p => { p.strength = 99; p.pace = 99; p.shooting = 99; p.passing = 99; p.defense = 99; });
        secondTeamSquad.forEach(p => { p.strength = 99; p.pace = 99; p.shooting = 99; p.passing = 99; p.defense = 99; p.fitness = 100; p.morale = 100; });
        updateUI();
        alert('🌟 Jugendkader & zweite Mannschaft ebenfalls auf Maximalwert gesetzt!');
    }

    // Schaltet sofort alle noch gesperrten kosmetischen Extras frei (Jubiläums-Wappenmuster),
    // ohne die dafür eigentlich nötigen 10 Spielzeiten abwarten zu müssen.
    function adminUnlockAllCosmetics() {
        playSound('goal');
        game.jubileePatternUnlocked = true;
        renderCrestEditor();
        alert('🎖️ Alle kosmetischen Extras (Jubiläums-Wappenmuster) sofort freigeschaltet!');
    }

    function adminExtendAllContracts(years) {
        playSound('click');
        squad.forEach(p => { p.contracts += years; });
        updateUI();
        renderAdminView();
        alert(`📝 Verträge aller Spieler um +${years} Jahre verlängert!`);
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
        alert(`🌟 95er Ausnahmetalent ${wonderkid.name} [Tor-Instinkt] dem Kader hinzugefügt!`);
    }

    function adminUnlockUEFAPro() { 
        playSound('goal');
        privateLife.license = 3; 
        updateUI(); 
        renderAdminView();
        alert("🎓 UEFA Pro Lizenz sofort aktiviert (+4 Stärkebonus im Spiel)!");
    }

    function adminUnlockAllManagerPerks() {
        playSound('goal');
        for (let k in managerRPG.perks) managerRPG.perks[k] = true;
        managerRPG.level = 10;
        if (typeof checkPerkSynergyBonus === 'function') checkPerkSynergyBonus();
        updateUI();
        renderAdminView();
        alert("🌳 Alle Manager-RPG-Perks freigeschaltet!");
    }

    function adminMaxBoardAndFans() {
        playSound('goal');
        game.boardSat = 100;
        game.fans = 100;
        updateUI();
        renderAdminView();
        alert("❤️ 100% Fan- und Vorstandszufriedenheit gesetzt!");
    }

    function adminBoostPrivateLife() {
        playSound('goal');
        privateLife.money += 5000000;
        privateLife.stress = 0;
        privateLife.wage = 50000;
        updateUI();
        renderAdminView();
        alert("🎩 +5.000.000 € auf Manager-Privatkonto überwiesen & Stress auf 0%!");
    }

    function adminHireAllStaffFree() {
        playSound('goal');
        let count = 0;
        for (let k in staffMembers) { staffMembers[k].hired = true; count++; }
        updateUI();
        renderAdminView();
        alert(`👔 Alle ${count} Stab- und Expertenstellen besetzt!`);
    }

    function adminTeleportLeague(targetLevel) {
        playSound('whistle');
        game.leagueLevel = targetLevel;
        initLeagues();
        refreshTransferMarket();
        autoLineup();
        updateUI();
        renderAdminView();
        alert(`🚀 Teleportation erfolgreich!\nDu spielst nun in der ${leagueNames[targetLevel]}.`);
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
            let myTeam = teams ? teams.find(t => t.name === "Lok Leipzig") : null;
            let rank = teams && myTeam ? [...teams].sort((a, b) => b.points - a.points).findIndex(t => t.name === "Lok Leipzig") + 1 : '-';
            checkpoints.push({ matchday: game.matchday, rank, points: myTeam ? myTeam.points : 0, money: game.money });
            if (game.matchday > 34) break;
        }
        game.adminCheckpointHistory = checkpoints;
        renderAdminCheckpointHistory();
        alert(`⏩ Zeitraffer-Simulation abgeschlossen! ${checkpoints.length} Etappen protokolliert (siehe Tabelle im Admin-Screen).`);
    }
    function renderAdminCheckpointHistory() {
        let box = document.getElementById('admin-checkpoint-history-box');
        if (!box) return;
        let hist = game.adminCheckpointHistory || [];
        box.innerHTML = hist.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Noch keine Zeitraffer-Simulation durchgeführt.</div>'
            : hist.map(c => `<div class="box" style="display:flex; justify-content:space-between; font-size:9px;"><span>Spieltag ${c.matchday}</span><span>Platz ${c.rank} · ${c.points} Pkt · ${formatVal(c.money)}</span></div>`).join('');
    }

    // 2. Szenario-Presets: bereitet den Spielzustand gezielt für einen bestimmten Testfall vor,
    // statt den Zustand mühsam manuell über mehrere Einzel-Cheats herzustellen.
    function applyAdminScenarioPreset(scenario) {
        playSound('goal');
        if (scenario === 'insolvenz') {
            game.money = -5000;
            game.negativeStreak = 8;
            game.loanDebt = 80000;
            alert('🧪 Szenario "Insolvenz-Test" aktiviert: negativer Kontostand, hohe Schulden, 8 Spieltage im Minus.');
        } else if (scenario === 'meisterrennen') {
            game.matchday = 30;
            let teams = leaguesData[game.leagueLevel];
            if (teams) {
                let myTeam = teams.find(t => t.name === "Lok Leipzig");
                if (myTeam) myTeam.points = 62;
                let sorted = [...teams].sort((a, b) => b.points - a.points);
                if (sorted[0] && sorted[0].name !== "Lok Leipzig") sorted[0].points = 63;
            }
            alert('🧪 Szenario "Meisterschafts-Endspurt" aktiviert: Spieltag 30, knapper Rückstand auf Platz 1.');
        } else if (scenario === 'abstiegskampf') {
            game.matchday = 30;
            let teams = leaguesData[game.leagueLevel];
            if (teams) {
                let myTeam = teams.find(t => t.name === "Lok Leipzig");
                if (myTeam) myTeam.points = 28;
            }
            game.fans = 25;
            alert('🧪 Szenario "Abstiegskampf" aktiviert: Spieltag 30, wenige Punkte, angespannte Fan-Stimmung.');
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
                        let hStr = (hTeam.name === "Lok Leipzig") ? calcTeamStrength(true) : (aTeam.name === "Lok Leipzig" ? applySabotageToOpponentStrength(hTeam.strength) : hTeam.strength);
                        let aStr = (aTeam.name === "Lok Leipzig") ? calcTeamStrength(false) : (hTeam.name === "Lok Leipzig" ? applySabotageToOpponentStrength(aTeam.strength) : aTeam.strength);
                        let goals = simulateGoals(hStr, aStr, hTeam, aTeam);
                        f.homeGoals = goals.myGoals;
                        f.awayGoals = goals.oppGoals;
                        f.played = true;
                        updateLeagueTable(l, f);
                        if (game.secondTeam.isActive && typeof attributeGoalsToSecondTeamScorers === 'function') {
                            if (hTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.homeGoals);
                            else if (aTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.awayGoals);
                        }
                        if (hTeam.name === "Lok Leipzig") {
                            isHome = true; playedOurMatch = true;
                            won = f.homeGoals > f.awayGoals; drawn = f.homeGoals === f.awayGoals;
                            isHomeDerby = aTeam.name === hTeam.rivalName;
                            opponentNameThisMatch = aTeam.name; ourGoalsThisMatch = f.homeGoals; oppGoalsThisMatch = f.awayGoals;
                        } else if (aTeam.name === "Lok Leipzig") {
                            isHome = false; playedOurMatch = true;
                            won = f.awayGoals > f.homeGoals; drawn = f.homeGoals === f.awayGoals;
                            opponentNameThisMatch = hTeam.name; ourGoalsThisMatch = f.awayGoals; oppGoalsThisMatch = f.homeGoals;
                        }
                    }
                });
            }
            if (opponentNameThisMatch) recordRivalryResult(opponentNameThisMatch, ourGoalsThisMatch, oppGoalsThisMatch);
            if (playedOurMatch && typeof attributeGoalsToScorers === 'function') attributeGoalsToScorers(ourGoalsThisMatch);
            if (playedOurMatch && (game.forceDerbyMatchdays || []).includes(md)) isHomeDerby = true;
            applyMatchdayFinances(isHome, won, playedOurMatch && oppGoalsThisMatch === 0, isHomeDerby, opponentNameThisMatch, opponentNameThisMatch ? `${ourGoalsThisMatch}:${oppGoalsThisMatch}` : null);
            processPostMatchRoutine(playedOurMatch ? (won ? 'win' : (drawn ? 'draw' : 'loss')) : null, isHomeDerby, false, ourGoalsThisMatch - oppGoalsThisMatch, isHome, playedOurMatch ? { total: ourGoalsThisMatch + oppGoalsThisMatch, bothScored: ourGoalsThisMatch > 0 && oppGoalsThisMatch > 0 } : null);
        }
        updateUI();
        renderAdminView();
        alert(`⏩ ${count} Spieltage vorgespult! Aktueller Spieltag: ${Math.min(34, game.matchday)}`);
    }

    function adminWinCupDirectly() {
        playSound('goal');
        game.trophies.push(`DFB-Pokalsieger (Saison ${game.season})`);
        boostFanBaseFloor(10, 'Der DFB-Pokalsieg');
        game.money += 4300000;
        updateUI();
        renderAdminView();
        alert("🏆 DFB-Pokalsieg gutgeschrieben (+4.300.000 € Prämie & Trophäe)!");
    }

    function adminWinEuropeDirectly() {
        playSound('goal');
        game.trophies.push(`Champions Cup Sieger (Saison ${game.season})`);
        boostFanBaseFloor(15, 'Der Champions Cup Sieg');
        game.money += 25000000;
        updateUI();
        renderAdminView();
        alert("🌟 Champions Cup Sieg gutgeschrieben (+25.000.000 € Prämie & Trophäe)!");
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
            alert("📤 Savegame-JSON in Textfeld kopiert & in die Zwischenablage gelegt!");
        } catch(e) { alert("Exportfehler: " + e.message); }
    }

    function adminImportSaveJson() {
        try {
            let area = document.getElementById('adm-save-json');
            if (!area || !area.value.trim()) { alert("Bitte erst ein Savegame-JSON in das Textfeld einfügen!"); return; }
            let p = JSON.parse(area.value.trim());

            // Nutzt jetzt dieselbe zentrale Lade-Funktion wie save.js, statt einer separat
            // gepflegten Kopie - die war leider veraltet (fehlende Stadion-Top-Level-Felder
            // wie Flutlicht/Dach/Videowalls sowie die neueren Fan-/Personal-/Finanz-States)
            // und hätte beim manuellen JSON-Import Fortschritt stillschweigend verworfen.
            applyLoadedState(p);
            updateUI();
            renderAdminView();
            alert("📥 Spielstand aus JSON erfolgreich importiert und angewendet!");
        } catch(e) { alert("Importfehler: Ungültiges JSON-Format!\n" + e.message); }
    }

    // adminHardResetGame() wurde nach save.js verschoben, da sie dort direkten Zugriff auf
    // SAVE_SLOT_PREFIX/SAVE_SLOT_COUNT hat (vorher wurde hier fälschlich nur der längst
    // abgelöste Legacy-Key gelöscht, wodurch der eigentlich aktive Speicherslot 1
    // unangetastet blieb und "Reset" wirkungslos schien).
