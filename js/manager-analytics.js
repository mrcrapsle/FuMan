
    // ==========================================
    // MANAGER ANALYTICS - MANAGERLEISTUNGS-ANALYSE
    // ==========================================
    // Umfassende Verfolgung von Managerleistung, Erfolgsquoten,
    // Taktischen Entscheidungen und langfristigen Karriere-Trends.

    let managerAnalyticsState = {
        seasonRecords: [], // [ { season, wins, draws, losses, goals, conceded, points, position, trophies } ]
        managerRatings: [], // [ { season, avgRating, wins, losses, tactical, financial, youth, relations } ]
        decisionLog: [], // [ { type, decision, result, season, matchday } ]
        marketingImpact: [], // [ { season, sponsorValue, ticketRevenue, fanBase } ]
        tacticalAnalysis: {}, // { tactic: { winRate, avgGoals, avgConceded } }
        managerStats: {
            totalMatches: 0,
            totalWins: 0,
            totalDraws: 0,
            totalLosses: 0,
            totalGoals: 0,
            totalConceded: 0,
            trophiesWon: 0,
            bestPlacement: 999,
            promotions: 0,
            relegations: 0,
            budgetManaged: 0
        }
    };

    function recordManagerDecision(decisionType, decision, result) {
        if (!managerAnalyticsState.decisionLog) managerAnalyticsState.decisionLog = [];

        let entry = {
            type: decisionType, // 'formation', 'transfer', 'tactic', 'signing', 'selling', 'youth'
            decision: decision,
            result: result, // 'success', 'neutral', 'failure'
            season: game.season,
            matchday: game.matchday,
            timestamp: new Date().toLocaleDateString('de-DE')
        };

        managerAnalyticsState.decisionLog.push(entry);

        // Keep last 100 decisions
        if (managerAnalyticsState.decisionLog.length > 100) {
            managerAnalyticsState.decisionLog.shift();
        }
    }

    function recordSeasonalManagerStats() {
        if (!managerAnalyticsState.seasonRecords) managerAnalyticsState.seasonRecords = [];

        let leagueTable = leaguesData[game.leagueLevel];
        let ourTeam = leagueTable.find(t => t.id === game.clubId);
        let position = leagueTable.indexOf(ourTeam) + 1;

        let seasonRecord = {
            season: game.season,
            wins: game.wins || 0,
            draws: game.draws || 0,
            losses: game.losses || 0,
            goals: (squad || []).reduce((sum, p) => sum + (p.goalsSeason || 0), 0),
            conceded: game.goalsAgainst || 0,
            points: ourTeam.points || 0,
            position: position,
            trophies: (game.trophies || []).filter(t => t.includes(`Saison ${game.season}`)).length,
            budget: game.money || 0,
            avgAttendance: Math.round((game.attendance || 0) / Math.max(1, game.matchesPlayed || 1))
        };

        managerAnalyticsState.seasonRecords.push(seasonRecord);

        // Update overall stats
        let stats = managerAnalyticsState.managerStats;
        stats.totalMatches += (seasonRecord.wins + seasonRecord.draws + seasonRecord.losses);
        stats.totalWins += seasonRecord.wins;
        stats.totalDraws += seasonRecord.draws;
        stats.totalLosses += seasonRecord.losses;
        stats.totalGoals += seasonRecord.goals;
        stats.totalConceded += seasonRecord.conceded;
        stats.trophiesWon += seasonRecord.trophies;
        stats.bestPlacement = Math.min(stats.bestPlacement, position);

        // Keep last 20 seasons
        if (managerAnalyticsState.seasonRecords.length > 20) {
            managerAnalyticsState.seasonRecords.shift();
        }
    }

    function calculateManagerRating(season) {
        let record = managerAnalyticsState.seasonRecords.find(r => r.season === season);
        if (!record) return 0;

        let totalMatches = record.wins + record.draws + record.losses;
        let winRate = totalMatches > 0 ? (record.wins / totalMatches) : 0;
        let pointsPerGame = totalMatches > 0 ? (record.points / totalMatches) : 0;
        let goalDiff = record.goals - record.conceded;

        let tactical = Math.min(100, Math.round((winRate * 100) * 0.6));
        let defensive = Math.min(100, Math.round((1 - (record.conceded / Math.max(1, record.goals))) * 80));
        let financial = Math.min(100, 60); // Placeholder
        let relations = Math.min(100, 60 + record.trophies * 10); // Trophy boost

        let avgRating = Math.round((tactical + defensive + financial + relations) / 4);

        return {
            season: season,
            avgRating: avgRating,
            wins: record.wins,
            losses: record.losses,
            tactical: tactical,
            defensive: defensive,
            financial: financial,
            relations: relations,
            position: record.position,
            trophies: record.trophies
        };
    }

    function renderManagerAnalyticsPanel() {
        let container = document.getElementById('manager-analytics-box');
        if (!container) return;

        let stats = managerAnalyticsState.managerStats;
        let latestSeason = managerAnalyticsState.seasonRecords.length > 0
            ? managerAnalyticsState.seasonRecords[managerAnalyticsState.seasonRecords.length - 1]
            : null;
        let rating = latestSeason ? calculateManagerRating(latestSeason.season) : null;

        let html = `
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:6px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:2px;">⚽ Gesamt-Siege</div>
                    <div style="font-size:16px; font-weight:700; color:var(--primary);">${stats.totalWins}</div>
                    <div style="font-size:8px; color:#aaa;">von ${stats.totalMatches} Spielen</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:6px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:2px;">🏆 Trophäen</div>
                    <div style="font-size:16px; font-weight:700; color:var(--gold);">${stats.trophiesWon}</div>
                    <div style="font-size:8px; color:#aaa;">Karriere insgesamt</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:6px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:2px;">📊 Quote</div>
                    <div style="font-size:16px; font-weight:700; color:var(--primary);">${stats.totalMatches > 0 ? Math.round((stats.totalWins / stats.totalMatches) * 100) : 0}%</div>
                    <div style="font-size:8px; color:#aaa;">Siegesquote</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:6px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:2px;">🥇 Beste Platzierung</div>
                    <div style="font-size:16px; font-weight:700; color:var(--gold);">Platz ${stats.bestPlacement}</div>
                    <div style="font-size:8px; color:#aaa;">in der Liga</div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">🎯 AKTUELLE SAISON-BEWERTUNG</div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; font-size:9px;">
        `;

        if (rating) {
            let ratingColor = rating.avgRating >= 70 ? 'var(--primary)' : (rating.avgRating >= 50 ? 'var(--accent)' : 'var(--danger)');
            html += `
                <div style="background:rgba(255,255,255,0.05); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:#aaa; font-size:8px;">Gesamt</div>
                    <div style="font-weight:700; color:${ratingColor}; font-size:14px;">${rating.avgRating}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:#aaa; font-size:8px;">Taktik</div>
                    <div style="font-weight:700; color:var(--primary); font-size:14px;">${rating.tactical}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:#aaa; font-size:8px;">Abwehr</div>
                    <div style="font-weight:700; color:var(--primary); font-size:14px;">${rating.defensive}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:#aaa; font-size:8px;">Beziehungen</div>
                    <div style="font-weight:700; color:var(--primary); font-size:14px;">${rating.relations}</div>
                </div>
            `;
        }

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">📈 SAISONVERLAUF (letzte 5)</div>
                <div style="display:grid; gap:3px; font-size:9px;">
        `;

        let recentSeasons = managerAnalyticsState.seasonRecords.slice(-5).reverse();
        if (recentSeasons.length === 0) {
            html += '<div style="color:#aaa;">Noch keine Saison abgeschlossen</div>';
        } else {
            recentSeasons.forEach(season => {
                let positionEmoji = season.position === 1 ? '🥇' : (season.position <= 3 ? '🥈' : '📊');
                html += `
                    <div style="display:flex; justify-content:space-between; padding:3px; background:rgba(255,255,255,0.02); border-radius:2px;">
                        <span>${positionEmoji} Saison ${season.season}</span>
                        <span style="color:var(--accent);"><strong>${season.wins}W-${season.draws}D-${season.losses}L</strong> · Platz ${season.position} · 🏆 ${season.trophies}</span>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <strong style="display:block; color:var(--accent); margin-bottom:6px;">💡 Manager Analytics:</strong>
                <div style="color:#aaa; line-height:1.5;">
                    • <strong>Gesamt-Statistik:</strong> Alle Spiele, Siege und Trophäen tracken<br>
                    • <strong>Bewertung:</strong> Taktik, Abwehr, Finanzen und Beziehungen<br>
                    • <strong>Saisonverlauf:</strong> Die letzten 20 Saisons in Übersicht<br>
                    • <strong>Entscheidungslog:</strong> Alle wichtigen Managemententscheidungen
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
