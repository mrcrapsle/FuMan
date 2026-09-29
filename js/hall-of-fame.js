
    // ==========================================
    // HALL OF FAME - KARRIEREHÖHEPUNKTE & LEGENDÄRE SPIELER
    // ==========================================
    // Verfolgt die Leistungen des Vereins, rekordhalter, beste Spieler und denkwürdige Momente.

    let hallOfFameState = {
        topScorers: [], // [ { playerName, goals, season, timestamp } ]
        topAssists: [], // [ { playerName, assists, season, timestamp } ]
        bestSeasons: [], // [ { season, points, wins, goals, trophies, timestamp } ]
        legendaryPlayers: [], // [ { playerName, appearances, goals, assists, awards, timestamp } ]
        trophyHistory: [], // [ { trophy, season, timestamp } ]
        recordMatches: [], // [ { description, score, opponent, timestamp } ]
        careerMilestones: [] // [ { milestone, value, timestamp, matchday } ]
    };

    const HALL_OF_FAME_CONFIG = {
        topScorersLimit: 10,
        topAssistsLimit: 10,
        bestSeasonsLimit: 5,
        legendaryPlayersLimit: 5,
        trophyHistoryLimit: 20,
        recordMatchesLimit: 10,
        milestonesLimit: 50
    };

    function recordPlayerMilestone(playerName, goalsThisSeason, appearsThisSeason) {
        if (!hallOfFameState.careerMilestones) hallOfFameState.careerMilestones = [];

        // 50 Tore in einer Saison
        if (goalsThisSeason === 50) {
            hallOfFameState.careerMilestones.push({
                milestone: `🎯 50-Tore-Meilenstein`,
                value: `${playerName} schoss 50 Tore in dieser Saison!`,
                timestamp: new Date().toLocaleDateString('de-DE'),
                matchday: game.matchday
            });
            showToast(`🌟 Hall of Fame: ${playerName} erreicht 50-Tore-Meilenstein!`, 'success', 5000);
        }

        // 100 Ligaspiele
        if (appearsThisSeason === 100) {
            hallOfFameState.careerMilestones.push({
                milestone: `🏆 100-Spiele-Jubiläum`,
                value: `${playerName} spielte 100 Ligaspiele für den Verein!`,
                timestamp: new Date().toLocaleDateString('de-DE'),
                matchday: game.matchday
            });
        }

        if (hallOfFameState.careerMilestones.length > HALL_OF_FAME_CONFIG.milestonesLimit) {
            hallOfFameState.careerMilestones.shift();
        }
    }

    function recordTopScorer() {
        if (!squad || squad.length === 0) return;

        let topScorer = squad.reduce((best, p) => {
            let pGoals = p.goalsSeason || 0;
            let bestGoals = best.goalsSeason || 0;
            return pGoals > bestGoals ? p : best;
        }, squad[0]);

        if ((topScorer.goalsSeason || 0) > 0) {
            let entry = {
                playerName: topScorer.name,
                goals: topScorer.goalsSeason || 0,
                season: game.season,
                timestamp: new Date().toLocaleDateString('de-DE')
            };

            hallOfFameState.topScorers.push(entry);
            hallOfFameState.topScorers.sort((a, b) => b.goals - a.goals);

            if (hallOfFameState.topScorers.length > HALL_OF_FAME_CONFIG.topScorersLimit) {
                hallOfFameState.topScorers.pop();
            }

            recordPlayerMilestone(topScorer.name, topScorer.goalsSeason || 0, topScorer.appearances || 0);
        }
    }

    function recordTopAssists() {
        if (!squad || squad.length === 0) return;

        let topAssister = squad.reduce((best, p) => {
            let pAssists = p.assistsSeason || 0;
            let bestAssists = best.assistsSeason || 0;
            return pAssists > bestAssists ? p : best;
        }, squad[0]);

        if ((topAssister.assistsSeason || 0) > 0) {
            let entry = {
                playerName: topAssister.name,
                assists: topAssister.assistsSeason || 0,
                season: game.season,
                timestamp: new Date().toLocaleDateString('de-DE')
            };

            hallOfFameState.topAssists.push(entry);
            hallOfFameState.topAssists.sort((a, b) => b.assists - a.assists);

            if (hallOfFameState.topAssists.length > HALL_OF_FAME_CONFIG.topAssistsLimit) {
                hallOfFameState.topAssists.pop();
            }
        }
    }

    function recordSeasonStats() {
        if (!hallOfFameState.bestSeasons) hallOfFameState.bestSeasons = [];

        let leagueTable = leaguesData[game.leagueLevel];
        let ourTeam = leagueTable.find(t => t.id === game.clubId);
        let position = leagueTable.indexOf(ourTeam) + 1;
        let isChampion = position === 1;

        let entry = {
            season: game.season,
            points: ourTeam.points || 0,
            wins: game.wins || 0,
            goals: (squad || []).reduce((sum, p) => sum + (p.goalsSeason || 0), 0),
            trophies: (game.trophiesWon || []).length,
            position: position,
            timestamp: new Date().toLocaleDateString('de-DE')
        };

        hallOfFameState.bestSeasons.push(entry);
        hallOfFameState.bestSeasons.sort((a, b) => b.points - a.points);

        if (hallOfFameState.bestSeasons.length > HALL_OF_FAME_CONFIG.bestSeasonsLimit) {
            hallOfFameState.bestSeasons.pop();
        }

        if (isChampion) {
            showToast(`🏆 Hall of Fame: Meisterschaft gewonnen!`, 'success', 5000);
        }
    }

    function recordTrophy(trophyName) {
        if (!hallOfFameState.trophyHistory) hallOfFameState.trophyHistory = [];

        let entry = {
            trophy: trophyName,
            season: game.season,
            timestamp: new Date().toLocaleDateString('de-DE'),
            matchday: game.matchday
        };

        hallOfFameState.trophyHistory.push(entry);

        if (hallOfFameState.trophyHistory.length > HALL_OF_FAME_CONFIG.trophyHistoryLimit) {
            hallOfFameState.trophyHistory.shift();
        }

        showToast(`🏆 Trophäe in Hall of Fame aufgenommen: ${trophyName}`, 'success', 5000);
    }

    function recordRecordMatch(score, opponent, description) {
        if (!hallOfFameState.recordMatches) hallOfFameState.recordMatches = [];

        let entry = {
            description: description,
            score: score,
            opponent: opponent,
            season: game.season,
            timestamp: new Date().toLocaleDateString('de-DE'),
            matchday: game.matchday
        };

        hallOfFameState.recordMatches.push(entry);
        hallOfFameState.recordMatches.sort((a, b) => b.matchday - a.matchday);

        if (hallOfFameState.recordMatches.length > HALL_OF_FAME_CONFIG.recordMatchesLimit) {
            hallOfFameState.recordMatches.pop();
        }
    }

    function updateLegendaryPlayers() {
        if (!hallOfFameState.legendaryPlayers) hallOfFameState.legendaryPlayers = [];

        // Spieler mit >100 Spielen und >30 Toren werden legendär
        let candidates = (squad || []).filter(p => {
            let apps = p.appearances || 0;
            let goals = p.goalsSeason || 0;
            return apps >= 100 && goals >= 30;
        });

        candidates.forEach(player => {
            let existing = hallOfFameState.legendaryPlayers.find(l => l.playerName === player.name);
            if (!existing) {
                hallOfFameState.legendaryPlayers.push({
                    playerName: player.name,
                    position: player.position,
                    appearances: player.appearances || 0,
                    goals: player.goalsSeason || 0,
                    assists: player.assistsSeason || 0,
                    awards: 0,
                    timestamp: new Date().toLocaleDateString('de-DE')
                });

                if (hallOfFameState.legendaryPlayers.length > HALL_OF_FAME_CONFIG.legendaryPlayersLimit) {
                    hallOfFameState.legendaryPlayers = hallOfFameState.legendaryPlayers
                        .sort((a, b) => b.appearances - a.appearances)
                        .slice(0, HALL_OF_FAME_CONFIG.legendaryPlayersLimit);
                }

                showToast(`⭐ Hall of Fame: ${player.name} wird legendär!`, 'success', 5000);
            }
        });
    }

    function renderHallOfFamePanel() {
        let container = document.getElementById('hall-of-fame-box');
        if (!container) return;

        updateLegendaryPlayers();
        recordTopScorer();
        recordTopAssists();

        let html = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">⚽ Top-Torschützen</div>
                    <div style="font-size:10px;">
        `;

        if ((hallOfFameState.topScorers || []).length === 0) {
            html += '<div style="color:#aaa;">Noch keine Einträge</div>';
        } else {
            (hallOfFameState.topScorers || []).slice(0, 3).forEach((entry, idx) => {
                html += `<div style="padding:2px 0; color:var(--accent);">🥇 ${entry.playerName}: <strong>${entry.goals}</strong> Tore (S${entry.season})</div>`;
            });
        }

        html += `
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">🎯 Top-Vorlagengeber</div>
                    <div style="font-size:10px;">
        `;

        if ((hallOfFameState.topAssists || []).length === 0) {
            html += '<div style="color:#aaa;">Noch keine Einträge</div>';
        } else {
            (hallOfFameState.topAssists || []).slice(0, 3).forEach((entry, idx) => {
                html += `<div style="padding:2px 0; color:var(--accent);">🎯 ${entry.playerName}: <strong>${entry.assists}</strong> Assists (S${entry.season})</div>`;
            });
        }

        html += `
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">⭐ LEGENDÄRE SPIELER (100+ Spiele, 30+ Tore)</div>
                <div style="display:grid; gap:4px; font-size:9px;">
        `;

        if ((hallOfFameState.legendaryPlayers || []).length === 0) {
            html += '<div style="color:#aaa;">Noch keine legendären Spieler</div>';
        } else {
            (hallOfFameState.legendaryPlayers || []).forEach(player => {
                html += `
                    <div style="background:rgba(255,215,0,0.1); padding:4px; border-radius:3px; border-left:2px solid var(--gold);">
                        <div style="font-weight:700; color:#FFD700;">${player.playerName}</div>
                        <div style="color:#aaa; font-size:8px;">⚽ ${player.appearances} Spiele · ⚽ ${player.goals} Tore · 🎯 ${player.assists} Assists</div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">🏆 BESTE SAISONEN</div>
                <div style="display:grid; gap:4px; font-size:9px;">
        `;

        if ((hallOfFameState.bestSeasons || []).length === 0) {
            html += '<div style="color:#aaa;">Noch keine Einträge</div>';
        } else {
            (hallOfFameState.bestSeasons || []).forEach(season => {
                let medailleEmoji = season.position === 1 ? '🥇' : (season.position === 2 ? '🥈' : '🥉');
                html += `
                    <div style="display:flex; justify-content:space-between; padding:4px; background:rgba(255,255,255,0.02); border-radius:3px;">
                        <span>${medailleEmoji} Saison ${season.season}</span>
                        <span style="color:var(--accent);"><strong>${season.points}</strong> Punkte · Platz ${season.position}</span>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <div style="color:#aaa; line-height:1.5;">
                    <strong style="display:block; color:var(--accent); margin-bottom:6px;">💡 Hall of Fame:</strong>
                    • <strong>Legendäre Spieler:</strong> 100+ Spiele + 30+ Tore = unsterblich<br>
                    • <strong>Record-Matches:</strong> Besondere Siege und Meilensteine<br>
                    • <strong>Beste Saisonen:</strong> Deine erfolgreichsten Spielzeiten<br>
                    • <strong>Trophäen:</strong> Alle gewonnenen Titel im Überblick
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
