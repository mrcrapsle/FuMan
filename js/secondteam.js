    // ==========================================
    // ZWEITE MANNSCHAFT: eigenständiger Klub, der parallel zur ersten Mannschaft ganz
    // unten in der niedrigsten Liga startet und sich unabhängig hocharbeiten kann.
    // Nutzt bewusst dieselbe Liga-/Auto-Simulations-Engine wie alle KI-Vereine (siehe
    // endMatchSimulation()/simulateFullSeason()/adminAdvanceMatchdays() in match.js, die
    // ausnahmslos ALLE Ligen jeden Spieltag anhand von leaguesData[l][x].strength
    // durchsimulieren) - die zweite Mannschaft wird dafür einfach als ganz normaler
    // "KI-Verein" in die Tabelle eingehängt, dessen Stärke aber aus dem echten,
    // vom Nutzer verwalteten secondTeamSquad berechnet wird.
    // ==========================================
    const SECOND_TEAM_FOUND_COST = 350000;
    const SECOND_TEAM_MIN_MANAGER_LEVEL = 3;

    function calcSecondTeamStrength() {
        if (secondTeamSquad.length === 0) return 30;
        let sum = secondTeamSquad.reduce((acc, p) => acc + p.strength * (p.fitness / 100), 0);
        let avg = sum / secondTeamSquad.length;
        // Spielstil der zweiten Mannschaft: war bisher rein kosmetisch (nur Button-Optik),
        // ohne jede Auswirkung auf die tatsächliche Stärke, die in die Liga-Simulation
        // einfließt. Eine klare taktische Ausrichtung (statt "ausgeglichen") gibt jetzt
        // einen kleinen echten Bonus.
        if (game.secondTeam.tacticStyle === 'offensiv' || game.secondTeam.tacticStyle === 'defensiv') avg += 1;
        // NEU: Eigene Trainingssteuerung für die zweite Mannschaft, unabhängig vom
        // Profikader-Training - Kondition boostet Fitness-Erhalt, Technik die reine Stärke.
        if (game.secondTeam.trainingFocus === 'technik') avg += 1;
        return Math.round(avg);
    }

    // ==========================================
    // ZWEITE MANNSCHAFT: NEUE FUNKTIONEN
    // ==========================================

    // 1. Eigene Trainingssteuerung: unabhängig vom Profikader wählbar.
    function setSecondTeamTrainingFocus(focus) {
        game.secondTeam.trainingFocus = focus;
        playSound('click');
        renderSecondTeamView();
        showToast(`🏋️ Trainingsschwerpunkt der zweiten Mannschaft: ${focus}`, 'success');
    }

    // 2. Perspektivspieler-Tracking: markiert Spieler, die reif für den Sprung in die erste
    // Mannschaft sind (hohe Stärke + jung), damit man sie nicht übersieht.
    function getPromotionReadyPlayers() {
        let ownAvg = squad.length > 0 ? squad.reduce((s, p) => s + p.strength, 0) / squad.length : 55;
        return secondTeamSquad.filter(p => p.strength >= ownAvg - 3 && (p.age || 30) <= 23);
    }
    function renderPerspectivePlayersBox() {
        let box = document.getElementById('second-team-perspective-box');
        if (!box) return;
        let ready = getPromotionReadyPlayers();
        box.innerHTML = ready.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Aktuell kein Perspektivspieler in Reichweite des Profi-Niveaus.</div>'
            : ready.map(p => `<div class="player-row" style="font-size:9px;"><span>⬆️ ${p.name} (${p.pos}, Stärke ${p.strength}, ${p.age} J.)</span><span style="color:var(--primary);">Bereit!</span></div>`).join('');
    }

    // 3. Rivalität in der eigenen Liga: wie beim Profikader, aber für die Reserve - trackt
    // den am häufigsten gespielten Gegner als "kleinen Angstgegner".
    function getSecondTeamRivalStats() {
        let opponentCounts = {};
        (fixturesData[game.secondTeam.leagueLevel] || []).flat().forEach(f => {
            if (!f.played) return;
            let h = leaguesData[game.secondTeam.leagueLevel]?.[f.home]?.name;
            let a = leaguesData[game.secondTeam.leagueLevel]?.[f.away]?.name;
            if (h === game.secondTeam.name) opponentCounts[a] = (opponentCounts[a] || 0) + 1;
            if (a === game.secondTeam.name) opponentCounts[h] = (opponentCounts[h] || 0) + 1;
        });
        let sorted = Object.entries(opponentCounts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
    }

    // Trägt Name & aktuelle Stärke der zweiten Mannschaft in die Liga-Tabelle ihres
    // aktuellen Levels ein. Wird nach Kader-/Taktikänderungen sowie vor jedem Spieltag
    // aufgerufen, damit Zu-/Verkäufe und Entwicklung sich auf die Auto-Simulation auswirken.
    function syncSecondTeamIntoLeagueTable() {
        if (!game.secondTeam.isActive) return;
        let table = leaguesData[game.secondTeam.leagueLevel];
        if (!table) return;
        let entry = table.find(t => t.name === game.secondTeam.name);
        if (entry) entry.strength = calcSecondTeamStrength();
    }

    // Torschützen-Zuordnung für die zweite Mannschaft (NEU): analog zu
    // attributeGoalsToScorers() beim ersten Team, damit auch Perspektivspieler in der
    // Reserve eine echte, sichtbare Torstatistik aufbauen (relevant für Beförderungs-
    // Entscheidungen ins erste Team).
    function attributeGoalsToSecondTeamScorers(goalCount) {
        if (goalCount <= 0) return;
        let starting = secondTeamSquad.filter(p => secondTeamLineup.includes(p.id));
        if (starting.length === 0) return;
        for (let i = 0; i < goalCount; i++) {
            let scorer = pickWeightedScorer(starting);
            if (scorer) { scorer.goalsSeason = (scorer.goalsSeason || 0) + 1; scorer.goalsCareer = (scorer.goalsCareer || 0) + 1; }
        }
    }

    // Wird von initLeagues() (leagues.js) nach dem kompletten Tabellen-Neuaufbau jeder
    // Saison aufgerufen: ersetzt dort den schwächsten KI-Verein auf dem aktuellen Level
    // der zweiten Mannschaft durch deren echte Identität - so bleibt der Spielplan
    // strukturell intakt (gleicher Slot-Index), ohne dass generateFixtures() erneut
    // laufen muss.
    function insertSecondTeamIntoLeagues() {
        if (!game.secondTeam.isActive) return;
        let table = leaguesData[game.secondTeam.leagueLevel];
        if (!table) return;
        let weakestIdx = table.reduce((minIdx, t, idx, arr) => t.strength < arr[minIdx].strength ? idx : minIdx, 0);
        let slot = table[weakestIdx];
        slot.name = game.secondTeam.name;
        slot.strength = calcSecondTeamStrength();
        slot.baseStrength = slot.strength;
    }

    function autoLineupSecondTeam() {
        let available = secondTeamSquad.filter(p => (p.suspended || 0) === 0 && (p.injured || 0) === 0);
        let effStr = p => p.strength * (p.fitness / 100);
        let tws = available.filter(p => p.pos === 'TW').sort((a, b) => effStr(b) - effStr(a));
        let abws = available.filter(p => p.pos === 'ABW').sort((a, b) => effStr(b) - effStr(a));
        let mits = available.filter(p => p.pos === 'MIT').sort((a, b) => effStr(b) - effStr(a));
        let sts = available.filter(p => p.pos === 'ST').sort((a, b) => effStr(b) - effStr(a));
        let config = { '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2] }[game.secondTeam.formation] || [4, 4, 2];
        let chosen = [];
        if (tws.length > 0) chosen.push(tws[0].id);
        abws.slice(0, config[0]).forEach(p => chosen.push(p.id));
        mits.slice(0, config[1]).forEach(p => chosen.push(p.id));
        sts.slice(0, config[2]).forEach(p => chosen.push(p.id));
        let remaining = available.filter(p => !chosen.includes(p.id)).sort((a, b) => effStr(b) - effStr(a));
        while (chosen.length < 11 && remaining.length > 0) chosen.push(remaining.shift().id);
        secondTeamLineup = chosen;
    }

    function foundSecondTeam() {
        if (game.secondTeam.isActive) return;
        if (managerRPG.level < SECOND_TEAM_MIN_MANAGER_LEVEL) { showToast(`Dafür brauchst du mindestens Manager-Level ${SECOND_TEAM_MIN_MANAGER_LEVEL}!`, 'error'); return; }
        if (game.money < SECOND_TEAM_FOUND_COST) { showToast('Nicht genug Vereinskapital!', 'error'); return; }
        playSound('whistle');
        game.money -= SECOND_TEAM_FOUND_COST;
        game.secondTeam.isActive = true;
        game.secondTeam.leagueLevel = NUM_LEAGUES - 1;
        // Gleiche Positionsverteilung wie der Erstliga-Kader beim Spielstart, aber auf
        // Amateur-Niveau der untersten Liga.
        secondTeamSquad = [
            createPlayer("TW", 32, 37), createPlayer("TW", 28, 33),
            createPlayer("ABW", 33, 38), createPlayer("ABW", 32, 37), createPlayer("ABW", 30, 35), createPlayer("ABW", 28, 33), createPlayer("ABW", 27, 32), createPlayer("ABW", 26, 31),
            createPlayer("MIT", 33, 39), createPlayer("MIT", 32, 37), createPlayer("MIT", 30, 35), createPlayer("MIT", 28, 33), createPlayer("MIT", 27, 32), createPlayer("MIT", 26, 31),
            createPlayer("ST", 34, 40), createPlayer("ST", 32, 37), createPlayer("ST", 29, 34), createPlayer("ST", 27, 32)
        ];
        autoLineupSecondTeam();
        insertSecondTeamIntoLeagues();
        refreshSecondTeamMarket();
        renderSecondTeamView();
        updateUI();
        addInboxMessage('vertrag', 'Zweite Mannschaft gegründet!', `${game.secondTeam.name} startet ab sofort in der ${leagueNames[game.secondTeam.leagueLevel]}.`, 'screen-second-team');
        showToast(`🥈 ${game.secondTeam.name} gegründet! Start in der ${leagueNames[game.secondTeam.leagueLevel]}.`, 'success');
    }

    function setSecondTeamFormation(form) {
        playSound('click');
        game.secondTeam.formation = form;
        ['4-4-2', '4-3-3', '3-5-2', '5-3-2'].forEach(f => {
            let el = document.getElementById('st-f-' + f);
            if (el) el.className = (f === form) ? 'btn-action' : 'btn-secondary';
        });
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        renderSecondTeamView();
    }

    function setSecondTeamTacticStyle(style) {
        playSound('click');
        game.secondTeam.tacticStyle = style;
        ['offensiv', 'ausgeglichen', 'defensiv'].forEach(s => {
            let btn = document.getElementById('st-ts-' + s);
            if (btn) btn.className = (s === style) ? 'btn-action' : 'btn-secondary';
        });
        renderSecondTeamView();
    }

    // Bewusst schlanker als der volle Transfermarkt der ersten Mannschaft: die zweite
    // Mannschaft dient als eigenständiges "zweites Spielstandbein", kein komplett
    // dupliziertes Transfersystem. Ein einfacher, bezahlbarer Amateur-Neuzugang reicht,
    // um den Kader über die Zeit auszubauen.
    function signSecondTeamTalent() {
        if (secondTeamSquad.length >= 22) { showToast('Kader bereits voll (22 Spieler)!', 'error'); return; }
        let pos = ['TW', 'ABW', 'MIT', 'ST'][Math.floor(Math.random() * 4)];
        let baseStr = Math.max(25, calcSecondTeamStrength() - 4);
        let candidate = createPlayer(pos, baseStr, baseStr + 10);
        let cost = Math.round(candidate.marketValue * 0.7 / 500) * 500;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        game.money -= cost;
        secondTeamSquad.push(candidate);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        renderSecondTeamView();
        updateUI();
        showToast(`✅ ${candidate.name} (${candidate.pos}, Stärke ${candidate.strength}) für ${formatVal(cost)} verpflichtet!`, 'success');
    }

    function releaseSecondTeamPlayer(id) {
        if (secondTeamSquad.length <= 11) { showToast('Mindestens 11 Spieler benötigt!', 'error'); return; }
        secondTeamSquad = secondTeamSquad.filter(p => p.id !== id);
        secondTeamLineup = secondTeamLineup.filter(pid => pid !== id);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        renderSecondTeamView();
        showToast('Spieler aus der zweiten Mannschaft entlassen.', 'success');
    }

    // ---------- LEIHGESCHÄFTE ----------
    // Talente aus der zweiten Mannschaft können für einen befristeten Zeitraum an einen
    // anderen Klub verliehen werden, um dort Spielpraxis zu sammeln - bei Rückkehr gibt es
    // einen kleinen Entwicklungsbonus als Belohnung für die Spielzeit auswärts.
    function loanOutPlayer(id) {
        if (secondTeamSquad.length <= 11) { showToast('Mindestens 11 Spieler in der zweiten Mannschaft benötigt!', 'error'); return; }
        let idx = secondTeamSquad.findIndex(p => p.id === id);
        if (idx === -1) return;
        let p = secondTeamSquad[idx];
        let loanClub = generateTeamName();
        let duration = 10 + Math.floor(Math.random() * 11); // 10-20 Spieltage
        let income = Math.round((500 + p.strength * 20) / 100) * 100;
        secondTeamSquad.splice(idx, 1);
        secondTeamLineup = secondTeamLineup.filter(pid => pid !== id);
        loanedPlayers.push({ player: p, loanClub, duration, originalStrength: p.strength });
        loanClubLastInteractionSeason[loanClub] = game.season;
        game.money += income;
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        addInboxMessage('vertrag', `📤 ${p.name} an ${loanClub} verliehen`, `Leihgeschäft über ${duration} Spieltage abgeschlossen. Einmalzahlung: ${formatVal(income)}. Bei Rückkehr winkt ein Entwicklungsbonus für die gesammelte Spielpraxis.`, 'screen-second-team');
        showToast(`📤 ${p.name} für ${duration} Spieltage an ${loanClub} verliehen!`, 'success');
        renderSecondTeamView();
        updateUI();
    }

    // Leih-Rückrufklausel: bei Bedarf (z.B. eigener Verletzungskrise) einen verliehenen
    // Spieler vorzeitig zurückholen - als kurze Verhandlung mit dem Leihverein statt eines
    // Festpreises, analog zur Bus-Sponsoring-Verhandlung.
    let loanRecallNegoIndex = null;
    let loanRecallNegoAmount = 0;
    let loanRecallNegoStep = 0;

    function openLoanRecallNegotiation(index) {
        let loan = loanedPlayers[index];
        if (!loan) return;
        loanRecallNegoIndex = index;
        let suggestedFee = Math.max(1500, Math.round(loan.player.marketValue * 0.1 * (loan.duration / 15)));
        loanRecallNegoAmount = suggestedFee;
        loanRecallNegoStep = Math.max(250, Math.round(suggestedFee * 0.1 / 250) * 250);
        renderLoanRecallNegotiation();
        document.getElementById('loan-recall-nego-overlay').classList.add('show');
    }
    function loanRecallNegoAdjustStep(mult) {
        loanRecallNegoStep = Math.max(250, Math.round(loanRecallNegoStep * mult / 250) * 250);
        renderLoanRecallNegotiation();
    }
    function loanRecallNegoAdjustAmount(dir) {
        loanRecallNegoAmount = Math.max(0, loanRecallNegoAmount + dir * loanRecallNegoStep);
        renderLoanRecallNegotiation();
    }
    function renderLoanRecallNegotiation() {
        let loan = loanedPlayers[loanRecallNegoIndex];
        if (!loan) return;
        let relLevel = loanClubRelationships[loan.loanClub] || 0;
        let relText = relLevel > 0 ? ` · 🤝 Beziehung: ${relLevel}× erfolgreich (bessere Konditionen!)` : '';
        document.getElementById('loan-recall-nego-club').innerText = `Verhandlung mit ${loan.loanClub} über ${loan.player.name}${relText}`;
        document.getElementById('loan-recall-nego-step-value').innerText = formatVal(loanRecallNegoStep);
        document.getElementById('loan-recall-nego-amount-value').innerText = formatVal(loanRecallNegoAmount);
    }
    function confirmLoanRecallNegotiation() {
        let loan = loanedPlayers[loanRecallNegoIndex];
        if (!loan) return;
        if (game.money < loanRecallNegoAmount) { showToast('Nicht genug Geld für dieses Angebot!', 'error'); return; }
        let suggestedFee = Math.max(1500, Math.round(loan.player.marketValue * 0.1 * (loan.duration / 15)));
        let ratio = loanRecallNegoAmount / suggestedFee;
        // Leihverein-Beziehungshistorie: Klubs, mit denen man schon mehrfach erfolgreich
        // Leihgeschäfte abgewickelt hat, sind kooperativer und einigen sich leichter.
        let relationshipBonus = Math.min(0.25, (loanClubRelationships[loan.loanClub] || 0) * 0.08);
        let successChance = Math.max(0.15, Math.min(0.95, 0.5 + (ratio - 1) * 1.2 + relationshipBonus));
        playSound('click');
        if (Math.random() < successChance) {
            game.money -= loanRecallNegoAmount;
            let p = loan.player;
            secondTeamSquad.push(p);
            loanedPlayers.splice(loanRecallNegoIndex, 1);
            loanClubRelationships[loan.loanClub] = (loanClubRelationships[loan.loanClub] || 0) + 1;
            loanClubLastInteractionSeason[loan.loanClub] = game.season;
            autoLineupSecondTeam();
            syncSecondTeamIntoLeagueTable();
            document.getElementById('loan-recall-nego-overlay').classList.remove('show');
            let relationshipNote = relationshipBonus > 0 ? ` (gute Beziehung zu ${loan.loanClub} hat geholfen!)` : '';
            addInboxMessage('vertrag', `📥 ${p.name} vorzeitig zurückgerufen!`, `Für ${formatVal(loanRecallNegoAmount)} hat ${loan.loanClub} der vorzeitigen Rückholung zugestimmt - sofort wieder einsatzbereit.${relationshipNote}`, 'screen-second-team');
            showToast(`📥 ${p.name} für ${formatVal(loanRecallNegoAmount)} zurückgerufen!${relationshipNote}`, 'success');
            renderSecondTeamView();
            updateUI();
        } else {
            showToast(`📉 ${loan.loanClub} lehnt dieses Angebot ab - versuch es mit einem höheren Betrag.`, 'error');
        }
    }

    function recallLoanedPlayer(index) {
        let loan = loanedPlayers[index];
        if (!loan) return;
        let fee = Math.max(1500, Math.round(loan.player.marketValue * 0.1 * (loan.duration / 15)));
        if (game.money < fee) { showToast(`Nicht genug Geld! Rückruf-Ablöse: ${formatVal(fee)}`, 'error'); return; }
        game.money -= fee;
        let p = loan.player;
        secondTeamSquad.push(p);
        loanedPlayers.splice(index, 1);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        addInboxMessage('vertrag', `📥 ${p.name} vorzeitig zurückgerufen!`, `Für ${formatVal(fee)} Ablöse hat ${loan.loanClub} der vorzeitigen Rückholung von ${p.name} zugestimmt - sofort wieder einsatzbereit für die zweite Mannschaft.`, 'screen-second-team');
        showToast(`📥 ${p.name} für ${formatVal(fee)} vorzeitig zurückgerufen!`, 'success');
        renderSecondTeamView();
        updateUI();
    }

    // Zählt die Leihdauer jeden Spieltag herunter (wird von processPostMatchRoutine() aus
    // allen drei Spieltag-Pfaden aufgerufen) und holt Spieler bei Ablauf automatisch zurück.
    // Beziehungspflege ohne aktives Leihgeschäft: gelegentlich schlägt ein Leihverein, mit
    // dem bereits eine Beziehung besteht, ein freundschaftliches Testspiel vor - eine kleine
    // Geste, die den Kontakt auch ohne neues Geschäft warmhält.
    function checkLoanClubRelationshipMaintenance() {
        let clubsWithRelationship = Object.keys(loanClubRelationships || {}).filter(c => loanClubRelationships[c] > 0);
        if (clubsWithRelationship.length === 0) return;
        if (Math.random() > 0.05) return;
        let club = clubsWithRelationship[Math.floor(Math.random() * clubsWithRelationship.length)];
        loanClubLastInteractionSeason[club] = game.season;
        game.money += 5000;
        addInboxMessage('vertrag', `🤝 Freundschaftliche Geste von ${club}`, `${club} lädt zu einem informellen Testspiel-Austausch ein und pflegt damit die gute Beziehung - kleine Einnahme von ${formatVal(5000)}, Kontakt bleibt frisch.`, 'screen-second-team');
    }

    function tickLoanedPlayers() {
        for (let i = loanedPlayers.length - 1; i >= 0; i--) {
            let loan = loanedPlayers[i];
            loan.duration--;
            if (loan.duration <= 0) {
                let p = loan.player;
                let devBonus = 1 + Math.floor(Math.random() * 3); // +1 bis +3 durch die Leihe
                p.strength = Math.min(99, p.strength + devBonus);
                secondTeamSquad.push(p);
                loanedPlayers.splice(i, 1);
                autoLineupSecondTeam();
                syncSecondTeamIntoLeagueTable();
                addInboxMessage('vertrag', `📥 ${p.name} von der Leihe zurück!`, `Nach der Leihe bei ${loan.loanClub} kehrt ${p.name} zurück und hat sich sichtbar weiterentwickelt (+${devBonus} Stärke durch die gesammelte Spielpraxis)!`, 'screen-second-team');
                showToast(`📥 ${p.name} von der Leihe zurück (+${devBonus} Stärke)!`, 'success');
            }
        }
    }

    // ---------- SPIELERWECHSEL ZWISCHEN 1. & 2. MANNSCHAFT ----------
    // Bewusst OHNE Ablöse/Verhandlung - beides sind "eigene" Vereine desselben Managers,
    // ein interner Kaderwechsel ist daher kostenlos (wie ein Vereinsinterner Leihtransfer).
    function promoteToFirstTeam(id) {
        if (!game.secondTeam.isActive) return;
        let idx = secondTeamSquad.findIndex(p => p.id === id);
        if (idx === -1) return;
        if (secondTeamSquad.length <= 11) { showToast('Die zweite Mannschaft braucht mindestens 11 Spieler!', 'error'); return; }
        let p = secondTeamSquad[idx];
        secondTeamSquad.splice(idx, 1);
        secondTeamLineup = secondTeamLineup.filter(pid => pid !== id);
        squad.push(p);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        renderSecondTeamView();
        if (typeof renderSquadView === 'function') renderSquadView();
        updateUI();
        showToast(`⬆️ ${p.name} in die erste Mannschaft hochgezogen!`, 'success');
        addInboxMessage('transfer', 'Spieler hochgezogen', `${p.name} wechselt von ${game.secondTeam.name} in den Profikader.`, 'screen-squad');
    }

    function demoteToSecondTeam(id) {
        if (!game.secondTeam.isActive) { showToast('Gründe zuerst eine zweite Mannschaft!', 'error'); return; }
        let idx = squad.findIndex(p => p.id === id);
        if (idx === -1) return;
        if (squad.length <= 11) { showToast('Die erste Mannschaft braucht mindestens 11 Spieler!', 'error'); return; }
        if (id === game.captainId || id === game.penaltyTakerId || id === game.freeKickTakerId) {
            showToast('Kapitän/Elfmeter-/Freistoßschütze kann nicht verschoben werden - zuerst neu zuweisen!', 'error');
            return;
        }
        let p = squad[idx];
        squad.splice(idx, 1);
        lineup = lineup.filter(pid => pid !== id);
        checkFriendshipDeparture(p);
        secondTeamSquad.push(p);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        if (typeof renderSquadView === 'function') renderSquadView();
        if (typeof render3DPitch === 'function') render3DPitch();
        renderSecondTeamView();
        updateUI();
        showToast(`⬇️ ${p.name} in die zweite Mannschaft verschoben!`, 'success');
    }

    // ---------- EIGENER AMATEUR-TRANSFERMARKT ----------
    // Bewusst schwächer/günstiger skaliert als der Erstliga-Markt (refreshTransferMarket()
    // in transfermarket.js) und über game.money statt des Transferbudgets der ersten
    // Mannschaft finanziert - beide Kader konkurrieren so nicht um dasselbe Budget.
    function refreshSecondTeamMarket() {
        secondTeamMarketPlayers = [];
        let minStr = 28 + (NUM_LEAGUES - 1 - game.secondTeam.leagueLevel) * 6;
        let maxStr = minStr + 10;
        for (let i = 0; i < 5; i++) {
            let p = createPlayer(["TW", "ABW", "MIT", "ST"][Math.floor(Math.random() * 4)], minStr, maxStr);
            p.marketValue = Math.round(p.marketValue * 0.55);
            secondTeamMarketPlayers.push(p);
        }
    }

    function buySecondTeamMarketPlayer(idx) {
        let p = secondTeamMarketPlayers[idx];
        if (!p) return;
        if (secondTeamSquad.length >= 22) { showToast('Kader bereits voll (22 Spieler)!', 'error'); return; }
        if (game.money < p.marketValue) { showToast('Nicht genug Geld auf dem Vereinskonto!', 'error'); return; }
        playSound('click');
        game.money -= p.marketValue;
        secondTeamSquad.push(p);
        secondTeamMarketPlayers.splice(idx, 1);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        renderSecondTeamView();
        updateUI();
        showToast(`✅ ${p.name} (${p.pos}, Stärke ${p.strength}) für ${formatVal(p.marketValue)} verpflichtet!`, 'success');
    }

    function sellSecondTeamPlayer(id) {
        if (secondTeamSquad.length <= 11) { showToast('Mindestens 11 Spieler benötigt!', 'error'); return; }
        let idx = secondTeamSquad.findIndex(p => p.id === id);
        if (idx === -1) return;
        playSound('click');
        let sum = Math.round(secondTeamSquad[idx].marketValue * 0.7);
        game.money += sum;
        secondTeamSquad.splice(idx, 1);
        secondTeamLineup = secondTeamLineup.filter(pid => pid !== id);
        autoLineupSecondTeam();
        syncSecondTeamIntoLeagueTable();
        renderSecondTeamView();
        updateUI();
        showToast(`💰 ${formatVal(sum)} durch Verkauf erhalten.`, 'success');
    }

    // Leihverein-Ranking: zeigt alle Leihvereine mit Beziehungsstufe, damit sichtbar wird,
    // wo sich zukünftige Leihgeschäfte durch bessere Konditionen besonders lohnen.
    function renderLoanClubRanking() {
        let box = document.getElementById('loan-club-ranking-box');
        if (!box) return;
        let entries = Object.entries(loanClubRelationships || {}).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            box.innerHTML = '<div class="box" style="font-size:10px; color:#94a3b8;">Noch keine Leihverein-Beziehungen aufgebaut.</div>';
            return;
        }
        box.innerHTML = entries.map(([club, level]) => `<div class="box" style="display:flex; justify-content:space-between; font-size:10px;"><span>🤝 ${club}</span><strong style="color:var(--teal);">${level}× erfolgreich${level > 0 ? ` (+${Math.min(25, level*8)}% Verhandlungsbonus)` : ''}</strong></div>`).join('');
    }

    function renderSecondTeamView() {
        let foundedBox = document.getElementById('st-not-founded-box');
        let activeBox = document.getElementById('st-active-box');
        if (!foundedBox || !activeBox) return;

        if (!game.secondTeam.isActive) {
            foundedBox.style.display = 'block';
            activeBox.style.display = 'none';
            document.getElementById('st-found-cost').innerText = formatVal(SECOND_TEAM_FOUND_COST);
            document.getElementById('st-found-req').innerText = SECOND_TEAM_MIN_MANAGER_LEVEL;
            return;
        }
        foundedBox.style.display = 'none';
        activeBox.style.display = 'block';
        renderPerspectivePlayersBox();
        let rivalBox = document.getElementById('second-team-rival-box');
        if (rivalBox) {
            let rival = getSecondTeamRivalStats();
            rivalBox.innerText = rival ? `⚔️ Kleiner Angstgegner: ${rival.name} (${rival.count} Duelle bisher)` : 'Noch keine Rivalität in der eigenen Liga erkennbar.';
        }
        let focusButtons = document.getElementById('second-team-training-focus');
        if (focusButtons) {
            ['ausgeglichen', 'kondition', 'technik'].forEach(f => {
                let btn = document.getElementById('st-focus-' + f);
                if (btn) { btn.classList.toggle('btn-action', game.secondTeam.trainingFocus === f); btn.classList.toggle('btn-secondary', game.secondTeam.trainingFocus !== f); }
            });
        }

        document.getElementById('st-name').innerText = game.secondTeam.name;
        document.getElementById('st-league-name').innerText = leagueNames[game.secondTeam.leagueLevel];
        document.getElementById('st-strength').innerText = calcSecondTeamStrength();

        let table = leaguesData[game.secondTeam.leagueLevel] || [];
        let sorted = [...table].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
        let rank = sorted.findIndex(t => t.name === game.secondTeam.name) + 1;
        let ourEntry = sorted.find(t => t.name === game.secondTeam.name);
        document.getElementById('st-rank').innerText = ourEntry ? `Platz ${rank} von ${sorted.length} · ${ourEntry.points} Punkte (${ourEntry.played} Spiele)` : '-';

        let tbody = document.getElementById('st-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            sorted.forEach((t, idx) => {
                let isUs = t.name === game.secondTeam.name;
                let tr = document.createElement('tr');
                tr.innerHTML = `<td>${idx + 1}</td><td style="text-align:left; ${isUs ? 'color:var(--teal); font-weight:bold;' : ''}">${t.name}</td><td>${t.played}</td><td><strong>${t.points}</strong></td>`;
                tbody.appendChild(tr);
            });
        }

        ['4-4-2', '4-3-3', '3-5-2', '5-3-2'].forEach(f => {
            let el = document.getElementById('st-f-' + f);
            if (el) el.className = (f === game.secondTeam.formation) ? 'btn-action' : 'btn-secondary';
        });
        ['offensiv', 'ausgeglichen', 'defensiv'].forEach(s => {
            let el = document.getElementById('st-ts-' + s);
            if (el) el.className = (s === game.secondTeam.tacticStyle) ? 'btn-action' : 'btn-secondary';
        });

        let list = document.getElementById('st-squad-list');
        if (list) {
            list.innerHTML = '';
            secondTeamSquad.forEach(p => {
                let isStarting = secondTeamLineup.includes(p.id);
                let row = document.createElement('div');
                row.className = 'player-row';
                let badgeClass = 'badge-' + (p.pos || 'mit').toLowerCase();
                row.innerHTML = `
                    <span class="badge ${badgeClass}">${p.pos}</span>
                    <button onclick="openPlayerDetail('${p.id}','secondTeam')" class="btn-secondary" style="width:auto; padding:2px 6px; font-size:9px;" title="Details">ℹ️</button>
                    <span style="flex:1; text-align:left; padding-left:6px;">
                        <strong>${p.name}</strong><br>
                        <span style="font-size:9px; color:#aaa;">Str: <strong>${p.strength}</strong> | Fit: ${p.fitness}% | Marktwert: ${formatVal(p.marketValue)}</span>
                    </span>
                    <span style="font-size:9px; color:${isStarting ? 'var(--teal)' : '#64748b'};">${isStarting ? 'Startelf' : 'Bank'}</span>
                    <button onclick="promoteToFirstTeam('${p.id}')" class="btn-secondary" style="width:auto; padding:3px 6px; font-size:9px; color:var(--primary);" title="In die 1. Mannschaft hochziehen">⬆️</button>
                    <button onclick="loanOutPlayer('${p.id}')" class="btn-secondary" style="width:auto; padding:3px 6px; font-size:9px; color:var(--teal);" title="An anderen Klub verleihen">📤</button>
                    <button onclick="sellSecondTeamPlayer('${p.id}')" class="btn-secondary" style="width:auto; padding:3px 6px; font-size:9px;" title="Verkaufen">💰</button>
                    <button onclick="releaseSecondTeamPlayer('${p.id}')" class="btn-secondary" style="width:auto; padding:3px 6px; font-size:9px; color:var(--danger);" title="Ablösefrei entlassen">✕</button>
                `;
                list.appendChild(row);
            });
        }

        let loanedBox = document.getElementById('loaned-players-list');
        if (loanedBox) {
            loanedBox.innerHTML = loanedPlayers.length === 0
                ? '<div class="box" style="font-size:10px; color:#94a3b8;">Aktuell keine Spieler verliehen.</div>'
                : loanedPlayers.map((l, idx) => {
                    let fee = Math.max(1500, Math.round(l.player.marketValue * 0.1 * (l.duration / 15)));
                    return `<div class="box" style="font-size:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span>📤 ${l.player.name} bei ${l.loanClub} - noch ${l.duration} Spieltage</span>
                        <button onclick="openLoanRecallNegotiation(${idx})" class="btn-secondary" style="width:auto; font-size:9px;" title="Rückholung verhandeln">🔙 Verhandeln</button>
                    </div>`;
                }).join('');
        }
        renderLoanClubRanking();

        let marketList = document.getElementById('st-market-list');
        if (marketList) {
            marketList.innerHTML = secondTeamMarketPlayers.length === 0
                ? '<div class="box" style="font-size:10px; color:#64748b;">Kein Markt verfügbar - erst nächste Saison aktualisiert sich das Angebot.</div>'
                : secondTeamMarketPlayers.map((p, idx) => `
                    <div class="market-row">
                        <span><span class="badge badge-${(p.pos||'mit').toLowerCase()}">${p.pos}</span> ${p.name} (Str: ${p.strength})</span>
                        <span>${formatVal(p.marketValue)}</span>
                        <button onclick="buySecondTeamMarketPlayer(${idx})" class="btn-action" style="width:auto; font-size:9px;">Kaufen</button>
                    </div>`).join('');
        }

        let firstTeamList = document.getElementById('st-firstteam-transfer-list');
        if (firstTeamList) {
            firstTeamList.innerHTML = squad.map(p => `
                <div class="player-row">
                    <span class="badge badge-${(p.pos||'mit').toLowerCase()}">${p.pos}</span>
                    <span style="flex:1; text-align:left; padding-left:6px;"><strong>${p.name}</strong> <span style="font-size:9px; color:#aaa;">(Str: ${p.strength})</span></span>
                    <button onclick="demoteToSecondTeam('${p.id}')" class="btn-secondary" style="width:auto; padding:3px 6px; font-size:9px; color:var(--teal);" title="In die 2. Mannschaft verschieben">⬇️</button>
                </div>`).join('');
        }
    }

    // Wird am Saisonende (vor initLeagues()-Neuaufbau in concludeSeasonAndAdvance()) für
    // Auf-/Abstieg der zweiten Mannschaft aufgerufen, ganz analog zur Logik der ersten
    // Mannschaft, plus Alterung/Vertragsablauf ihres eigenen Kaders.
    function processSecondTeamSeasonEnd() {
        if (!game.secondTeam.isActive) return;
        let table = leaguesData[game.secondTeam.leagueLevel];
        if (!table) return;
        let sorted = [...table].sort((a, b) => b.points - a.points);
        let rank = sorted.findIndex(t => t.name === game.secondTeam.name) + 1;

        if (rank <= 2 && game.secondTeam.leagueLevel > 0) {
            game.secondTeam.leagueLevel--;
            addInboxMessage('vertrag', `${game.secondTeam.name}: AUFSTIEG!`, `Platz ${rank} - Aufstieg in die ${leagueNames[game.secondTeam.leagueLevel]}!`, 'screen-second-team');
        } else if (rank >= 16 && game.secondTeam.leagueLevel < NUM_LEAGUES - 1) {
            game.secondTeam.leagueLevel++;
            addInboxMessage('vertrag', `${game.secondTeam.name}: Abstieg`, `Platz ${rank} - Abstieg in die ${leagueNames[game.secondTeam.leagueLevel]}.`, 'screen-second-team');
        }

        secondTeamSquad.forEach(p => { p.contracts--; p.fitness = 100; });
        // Bugfix (analog zur ersten Mannschaft): Spieler mit ausgelaufenem Vertrag
        // verschwanden bisher auch hier komplett stillschweigend, ohne jede Meldung.
        let expiredSecondTeam = secondTeamSquad.filter(p => p.contracts <= 0);
        if (expiredSecondTeam.length > 0) {
            addInboxMessage('vertrag', `📋 ${expiredSecondTeam.length} Vertrag(e) bei der Zweiten Mannschaft ausgelaufen`, `${expiredSecondTeam.map(p => p.name).join(', ')} ${expiredSecondTeam.length === 1 ? 'verlässt' : 'verlassen'} die Reserve ablösefrei (Bosman-Regel).`, 'screen-second-team');
        }
        secondTeamSquad = secondTeamSquad.filter(p => p.contracts > 0);
        while (secondTeamSquad.length < 14) {
            let pos = ['TW', 'ABW', 'MIT', 'ST'][Math.floor(Math.random() * 4)];
            secondTeamSquad.push(createPlayer(pos, 26, 36));
        }
        autoLineupSecondTeam();
        refreshSecondTeamMarket();
    }
