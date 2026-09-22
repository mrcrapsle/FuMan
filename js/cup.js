
// ==========================================
// DFB-POKAL SYSTEM
// ==========================================
    function initDynamicCup() {
        game.inCup = true;
        cupTournament.currentRound = 0;
        cupTournament.roundsHistory = [];

        let cupTeams = [game.clubName];
        while (cupTeams.length < 32) {
            let t = generateTeamName();
            if (!cupTeams.includes(t)) cupTeams.push(t);
        }

        cupTeams.sort(() => Math.random() - 0.5);
        let pairings = [];
        for (let i = 0; i < cupTeams.length; i += 2) {
            pairings.push({
                home: cupTeams[i], away: cupTeams[i+1], homeGoals: null, awayGoals: null, penaltyWinner: null, played: false
            });
        }

        cupTournament.roundsHistory.push({
            roundIndex: 0, name: cupTournament.roundNames[0], matchday: cupTournament.matchdays[0], prize: cupTournament.prizes[0], pairings: pairings, completed: false
        });
        cupTournament.drawCeremonyShown = false;
    }

    // ---------- AUSLOSUNGS-ZEREMONIE ----------
    // Rein visuelles Reveal-Modal für unser eigenes Pokal-Los, statt das Ergebnis einfach
    // kommentarlos in der Tabelle erscheinen zu lassen - mehr Drama & Vorfreude.
    let cupDrawRevealTimer = null;
    function showCupDrawCeremony() {
        let r = cupTournament.roundsHistory[cupTournament.currentRound];
        if (!r) return;
        let ourPairing = r.pairings.find(p => p.home === game.clubName || p.away === game.clubName);
        if (!ourPairing) return;
        let opponent = ourPairing.home === game.clubName ? ourPairing.away : ourPairing.home;
        let isHome = ourPairing.home === game.clubName;

        document.getElementById('cup-draw-round-name').innerText = r.name;
        document.getElementById('cup-draw-reveal-text').innerText = '🎟️ Die Kugeln rollen...';
        document.getElementById('cup-draw-opponent-name').style.display = 'none';
        document.getElementById('cup-draw-overlay').classList.add('show');

        clearTimeout(cupDrawRevealTimer);
        cupDrawRevealTimer = setTimeout(() => {
            document.getElementById('cup-draw-reveal-text').innerText = `Es zieht... ${isHome ? '(Heimrecht)' : '(Auswärts)'}`;
            let oppEl = document.getElementById('cup-draw-opponent-name');
            oppEl.innerText = opponent;
            oppEl.style.display = 'block';
            playSound('whistle');
        }, 1400);

        cupTournament.drawCeremonyShown = true;
    }
    function closeCupDrawCeremony() {
        clearTimeout(cupDrawRevealTimer);
        document.getElementById('cup-draw-overlay').classList.remove('show');
    }

    // ==========================================
    // POKALSCHRECK-TRACKING & EIGENE POKAL-STATISTIK (NEU)
    // ==========================================
    function recordCupResultStats(weWon, ourStr, oppStr, oppName, roundName) {
        if (!game.cupHistory) game.cupHistory = { titlesWon: 0, schrecksErlitten: [], schrecksVerursacht: [], bestRunEver: null, matchesPlayed: 0, wins: 0 };
        game.cupHistory.matchesPlayed++;
        if (weWon) game.cupHistory.wins++;
        if (typeof ourStr !== 'number' || typeof oppStr !== 'number') return;
        let diff = ourStr - oppStr;
        // Pokalschreck: mindestens 12 Stärkepunkte Unterschied, aber der Schwächere gewinnt.
        if (!weWon && diff >= 12) {
            game.cupHistory.schrecksErlitten.unshift({ season: game.season, opponent: oppName, round: roundName, diff: Math.round(diff) });
            if (game.cupHistory.schrecksErlitten.length > 10) game.cupHistory.schrecksErlitten.pop();
            addInboxMessage('vertrag', '😱 Pokalschreck erlitten!', `Trotz deutlicher Überlegenheit gegen ${oppName} scheidest du in der ${roundName} aus - ein echter Pokalschreck!`, 'screen-cup');
        }
        if (weWon && diff <= -12) {
            game.cupHistory.schrecksVerursacht.unshift({ season: game.season, opponent: oppName, round: roundName, diff: Math.round(-diff) });
            if (game.cupHistory.schrecksVerursacht.length > 10) game.cupHistory.schrecksVerursacht.pop();
            addInboxMessage('vertrag', '🎉 Sensation gelungen!', `Gegen den favorisierten ${oppName} setzt sich ${game.clubName} in der ${roundName} durch - ein echter Pokalschreck für die Gegenseite!`, 'screen-cup');
        }
    }
    function renderCupOwnStats() {
        let box = document.getElementById('cup-own-stats-box');
        if (!box) return;
        let h = game.cupHistory || { titlesWon: 0, schrecksErlitten: [], schrecksVerursacht: [], matchesPlayed: 0, wins: 0 };
        let winRate = h.matchesPlayed > 0 ? Math.round((h.wins / h.matchesPlayed) * 100) : 0;
        box.innerHTML = `
            <div class="box" style="font-size:10px;">🏆 Pokaltitel: <strong>${(game.trophies || []).filter(t => t.includes('Pokalsieger')).length}</strong> · Bilanz: ${h.wins}/${h.matchesPlayed} Siege (${winRate}%)</div>
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin:6px 0 3px;">😱 ERLITTENE POKALSCHRECKS</div>
            ${h.schrecksErlitten.length === 0 ? '<div style="font-size:9px; color:var(--text-muted);">Noch keiner - gut so!</div>' : h.schrecksErlitten.slice(0, 3).map(s => `<div class="box" style="font-size:9px;">Saison ${s.season}, ${s.round}: Aus gegen ${s.opponent} (-${s.diff} Stärke unterlegen)</div>`).join('')}
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin:6px 0 3px;">🎉 VERURSACHTE SENSATIONEN</div>
            ${h.schrecksVerursacht.length === 0 ? '<div style="font-size:9px; color:var(--text-muted);">Noch keine Überraschung geschafft.</div>' : h.schrecksVerursacht.slice(0, 3).map(s => `<div class="box" style="font-size:9px;">Saison ${s.season}, ${s.round}: Sieg gegen favorisierten ${s.opponent} (+${s.diff} Stärke unterlegen)</div>`).join('')}
        `;
    }

    function simulateCupRound(roundIdx, isLiveContext = false) {
        let r = cupTournament.roundsHistory[roundIdx];
        if (!r || r.completed) return;

        let winners = new Array(r.pairings.length).fill(null);
        let awaitingShooters = false;

        r.pairings.forEach((p, idx) => {
            if (p.played) {
                winners[idx] = (p.homeGoals > p.awayGoals) ? p.home : (p.awayGoals > p.homeGoals ? p.away : p.penaltyWinner);
                return;
            }
            let isOurMatch = (p.home === game.clubName || p.away === game.clubName);
            let isHome = p.home === game.clubName;
            let homeStr = isOurMatch ? (isHome ? calcTeamStrength(true) : getOpponentStrength(p.home)) : (60 + Math.floor(Math.random() * 24));
            let awayStr = isOurMatch ? (!isHome ? calcTeamStrength(false) : getOpponentStrength(p.away)) : (60 + Math.floor(Math.random() * 24));

            let diff = homeStr - awayStr;
            let goals = simulateGoals(homeStr, awayStr);
            let hg = goals.myGoals;
            let ag = goals.oppGoals;

            p.homeGoals = hg;
            p.awayGoals = ag;
            p.played = true;
            // Pokalschreck-Tracking (NEU): Stärkewerte zum Zeitpunkt des Spiels sichern, um
            // in finalizeCupRound() erkennen zu können, ob es sich um eine echte Überraschung
            // handelte (deutlicher Stärkeunterschied, aber der Schwächere gewinnt).
            if (isOurMatch) { p.ourStr = isHome ? homeStr : awayStr; p.oppStr = isHome ? awayStr : homeStr; }

            if (hg === ag) {
                // Bei unserer eigenen Partie im Live-Kontext bestimmt der Nutzer jetzt die
                // Schützen-Reihenfolge selbst (gleiches System wie im Europapokal-Halbfinale,
                // siehe openShooterOrderSelection() in europe.js) - Massensimulation wählt
                // automatisch die 5 schusstärksten Spieler, damit nichts blockiert.
                if (isOurMatch && isLiveContext) {
                    awaitingShooters = true;
                    openShooterOrderSelection(null, (names) => {
                        let namesHome = isHome ? names : null;
                        let namesAway = !isHome ? names : null;
                        let shootout = simulatePenaltyShootout(p.home, p.away, homeStr, awayStr, namesHome, namesAway);
                        p.penaltyWinner = shootout.winner;
                        showPenaltyShootoutTicker(shootout, p.home, p.away);
                        winners[idx] = shootout.winner;
                        finalizeCupRound(roundIdx, winners, r, isLiveContext);
                    });
                } else {
                    let namesHome = isOurMatch && isHome ? autoSelectShooters() : null;
                    let namesAway = isOurMatch && !isHome ? autoSelectShooters() : null;
                    let shootout = simulatePenaltyShootout(p.home, p.away, homeStr, awayStr, namesHome, namesAway);
                    p.penaltyWinner = shootout.winner;
                    winners[idx] = shootout.winner;
                }
            } else {
                winners[idx] = hg > ag ? p.home : p.away;
            }
        });

        if (!awaitingShooters) finalizeCupRound(roundIdx, winners, r, isLiveContext);
    }

    function finalizeCupRound(roundIdx, winners, r, isLiveContext = false) {
        r.pairings.forEach((p, idx) => {
            let winTeam = winners[idx];
            if (p.penaltyWinner) checkShootoutRivalryIntensity(p.home, p.away);
            if (p.home === game.clubName || p.away === game.clubName) {
                let weWon = (winTeam === game.clubName);
                let oppName = p.home === game.clubName ? p.away : p.home;
                // Pokalschreck-Tracking & eigene Pokal-Statistik (NEU)
                if (typeof recordCupResultStats === 'function') recordCupResultStats(weWon, p.ourStr, p.oppStr, oppName, r.name);
                if (weWon) {
                    let sponsorCupBonus = game.sponsor.cupBonus || 0;
                    game.money += r.prize + sponsorCupBonus;
                    // Manager-XP für Erfolge gibt's ab jetzt nur beim tatsächlichen Live-
                    // Spielen des Spieltags, nicht bei reiner Simulation - wer den Spieltag
                    // durchklickt statt zu spielen, verzichtet auf den Fortschritt im
                    // Manager-Talentbaum.
                    if (isLiveContext) addManagerXP(350);
                    playSound('goal');
                    showNotice('🏆 Pokalsieg!', `Die ${r.name} ist gewonnen.\n\nPrämie ${formatVal(r.prize)}${sponsorCupBonus > 0 ? ` plus ${formatVal(sponsorCupBonus)} Sponsoren-Bonus` : ''}, dazu 350 Manager-Erfahrungspunkte.`);
                    if (roundIdx === 4) {
                        game.trophies.push(`DFB-Pokalsieger (Saison ${game.season})`);
                        boostFanBaseFloor(10, 'Der DFB-Pokalsieg');
                        game.inEurope = true;
                        showNotice('🎉 Historischer Triumph!', `${game.clubName} ist DFB-Pokalsieger und für den Champions Cup qualifiziert.`);
                    }
                } else {
                    game.inCup = false;
                    showNotice('❌ Pokal-Aus', `Bittere Niederlage in der ${r.name} gegen ${p.home === game.clubName ? p.away : p.home}.`, { typ: 'warn' });
                }
            }
        });

        r.completed = true;

        if (roundIdx < 4 && winners.length >= 2) {
            cupTournament.currentRound++;
            let nextRIdx = roundIdx + 1;
            winners.sort(() => Math.random() - 0.5);
            let nextPairings = [];
            for (let i = 0; i < winners.length; i += 2) {
                if (winners[i+1]) {
                    nextPairings.push({
                        home: winners[i], away: winners[i+1], homeGoals: null, awayGoals: null, penaltyWinner: null, played: false
                    });
                }
            }
            cupTournament.roundsHistory.push({
                roundIndex: nextRIdx,
                name: cupTournament.roundNames[nextRIdx],
                matchday: cupTournament.matchdays[nextRIdx],
                prize: cupTournament.prizes[nextRIdx],
                pairings: nextPairings,
                completed: false
            });
            cupTournament.drawCeremonyShown = false;
        }
    }

    function renderCupView() {
        renderCupOwnStats();
        let badge = document.getElementById('cup-status-badge');
        if (badge) {
            badge.innerText = game.inCup ? "Im Wettbewerb ✓" : "Ausgeschieden ❌";
            badge.style.color = game.inCup ? "var(--primary)" : "var(--danger)";
        }
        let container = document.getElementById('cup-tree-container');
        if (!container) return;
        container.innerHTML = '';
        cupTournament.roundsHistory.forEach((r) => {
            let box = document.createElement('div');
            box.className = 'panel';
            let ourMatch = r.pairings.find(p => p.home === game.clubName || p.away === game.clubName);
            let pairingsHtml = r.pairings.map(p => {
                let isOur = (p.home === game.clubName || p.away === game.clubName);
                let penStr = p.penaltyWinner ? ` (i.E. ${p.penaltyWinner})` : '';
                let res = p.played ? `<strong>${p.homeGoals} : ${p.awayGoals}</strong>${penStr}` : 'vs';
                return `<div class="player-row" style="${isOur ? 'border-color:var(--accent); background:rgba(255,193,7,0.1);' : ''}">
                    <span style="${p.home===game.clubName?'color:var(--primary); font-weight:bold;':''}">${p.home}</span>
                    <span>${res}</span>
                    <span style="${p.away===game.clubName?'color:var(--primary); font-weight:bold;':''}">${p.away}</span>
                </div>`;
            }).join('');

            box.innerHTML = `
                <div class="panel-header">
                    <span>${r.name} (Termin: Spieltag ${r.matchday})</span>
                    <span style="color:var(--primary); font-size:10px;">Prämie: +${formatVal(r.prize)}</span>
                </div>
                ${ourMatch ? `<div style="font-weight:bold; margin-bottom:4px; color:var(--accent);">Dein Spiel: ${ourMatch.home} vs ${ourMatch.away} ${ourMatch.played ? `[${ourMatch.homeGoals}:${ourMatch.awayGoals}${ourMatch.penaltyWinner ? ' (i.E.)' : ''}]` : ''}</div>` : '<div style="color:var(--danger); font-size:10px; margin-bottom:4px;">Nicht mehr vertreten</div>'}
                <div style="max-height:160px; overflow-y:auto;">${pairingsHtml}</div>
            `;
            container.appendChild(box);
        });
    }

