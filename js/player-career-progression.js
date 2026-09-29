
    // ==========================================
    // PLAYER CAREER PROGRESSION - SPIELER-KARRIERE-VERFOLGUNG
    // ==========================================
    // Detaillierte Verfolgung von Karriere-Meilensteinen, Leistungsspitzen
    // und Entwicklungstrends einzelner Spieler.

    let playerCareerProgressionState = {
        playerProfiles: {}, // { playerId: { name, position, careerStart, careerPeak, achievements: [] } }
        performanceArchive: {}, // { playerId: [ { season, matches, goals, assists, rating } ] }
        careerMilestones: {}, // { playerId: [ { milestone, season, matchday, value } ] }
        transferHistory: {}, // { playerId: [ { season, fromClub, toClub, fee } ] }
        injuryRecords: {} // { playerId: [ { season, injury, daysOut, comeback } ] }
    };

    const MILESTONE_THRESHOLDS = {
        firstMatch: 1,
        centuryMatches: 100,
        fiftyGoals: 50,
        hundredGoals: 100,
        manOfTheMatch: 5,
        captaincy: null,
        playerOfMonth: 1,
        playerOfSeason: 1,
        internationals: 10
    };

    function initializePlayerProfile(player) {
        if (!playerCareerProgressionState.playerProfiles[player.id]) {
            playerCareerProgressionState.playerProfiles[player.id] = {
                name: player.name,
                position: player.position,
                careerStart: game.season,
                careerPeak: null,
                peakStrength: player.strength || 0,
                achievements: [],
                totalMatches: 0,
                totalGoals: 0,
                totalAssists: 0
            };
        }

        if (!playerCareerProgressionState.performanceArchive[player.id]) {
            playerCareerProgressionState.performanceArchive[player.id] = [];
        }

        if (!playerCareerProgressionState.careerMilestones[player.id]) {
            playerCareerProgressionState.careerMilestones[player.id] = [];
        }
    }

    function recordSeasonalPerformance(player) {
        if (!player) return;

        initializePlayerProfile(player);

        let seasonPerformance = {
            season: game.season,
            matches: player.appearances || 0,
            goals: player.goalsSeason || 0,
            assists: player.assistsSeason || 0,
            strength: player.strength || 0,
            rating: calculatePlayerRating(player)
        };

        playerCareerProgressionState.performanceArchive[player.id].push(seasonPerformance);

        // Update career totals
        let profile = playerCareerProgressionState.playerProfiles[player.id];
        profile.totalMatches = (profile.totalMatches || 0) + (player.appearances || 0);
        profile.totalGoals = (profile.totalGoals || 0) + (player.goalsSeason || 0);
        profile.totalAssists = (profile.totalAssists || 0) + (player.assistsSeason || 0);

        // Karrierehöhepunkt
        if ((player.strength || 0) > (profile.peakStrength || 0)) {
            profile.peakStrength = player.strength;
            profile.careerPeak = game.season;
        }
    }

    function calculatePlayerRating(player) {
        // Einfache Bewertung basierend auf Fähigkeiten und Leistung
        if (!player) return 0;

        let baseRating = (player.strength || 50) / 100;
        let performanceBonus = 0;

        if (player.goalsSeason) performanceBonus += Math.min(0.2, (player.goalsSeason / 30) * 0.2);
        if (player.assistsSeason) performanceBonus += Math.min(0.1, (player.assistsSeason / 15) * 0.1);
        if (player.dailyForm) performanceBonus += ((player.dailyForm - 50) / 100) * 0.1;

        return Math.min(100, Math.round((baseRating + performanceBonus) * 100));
    }

    function recordCareerProgressionMilestone(playerId, milestone, value) {
        if (!playerCareerProgressionState.careerMilestones[playerId]) {
            playerCareerProgressionState.careerMilestones[playerId] = [];
        }

        let entry = {
            milestone: milestone,
            season: game.season,
            matchday: game.matchday,
            value: value,
            timestamp: new Date().toLocaleDateString('de-DE')
        };

        playerCareerProgressionState.careerMilestones[playerId].push(entry);

        // Limit to 50 recent milestones
        if (playerCareerProgressionState.careerMilestones[playerId].length > 50) {
            playerCareerProgressionState.careerMilestones[playerId].shift();
        }
    }

    function checkPlayerMilestones(player) {
        if (!player) return;

        initializePlayerProfile(player);
        let profile = playerCareerProgressionState.playerProfiles[player.id];

        // 100 Spiele
        if ((player.appearances || 0) === 100 && !profile.achievements.includes('100Matches')) {
            profile.achievements.push('100Matches');
            recordCareerProgressionMilestone(player.id, '🏆 100 Ligaspiele', player.appearances);
            showToast(`⭐ ${player.name} erreicht 100 Ligaspiele!`, 'success', 5000);
        }

        // 50 Tore
        if ((player.goalsSeason || 0) >= 50 && !profile.achievements.includes('50Goals')) {
            profile.achievements.push('50Goals');
            recordCareerProgressionMilestone(player.id, '⚽ 50 Tore in einer Saison', player.goalsSeason);
            showToast(`⭐ ${player.name} schoss 50 Tore in dieser Saison!`, 'success', 5000);
        }

        // 100 Tore Karriere
        if ((profile.totalGoals || 0) >= 100 && !profile.achievements.includes('100GoalsCareer')) {
            profile.achievements.push('100GoalsCareer');
            recordCareerProgressionMilestone(player.id, '⚽ 100 Karriere-Tore', profile.totalGoals);
            showToast(`⭐ ${player.name} erreicht 100 Karriere-Tore!`, 'success', 5000);
        }

        // Spieler des Monats
        if (game.potmHistory && game.potmHistory.includes(player.id)) {
            let potmCount = game.potmHistory.filter(id => id === player.id).length;
            if (potmCount === 1 && !profile.achievements.includes('PlayerOfMonth1')) {
                profile.achievements.push('PlayerOfMonth1');
                recordCareerProgressionMilestone(player.id, '🌟 Spieler des Monats', 1);
            }
        }
    }

    function renderPlayerCareerPanel(playerId) {
        if (!playerId) return '';

        let player = squad.find(p => p.id === playerId);
        if (!player) return '';

        initializePlayerProfile(player);
        checkPlayerMilestones(player);

        let profile = playerCareerProgressionState.playerProfiles[playerId];
        let performance = playerCareerProgressionState.performanceArchive[playerId] || [];
        let milestones = playerCareerProgressionState.careerMilestones[playerId] || [];

        let html = `
            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">📊 KARRIERE-STATISTIK</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; font-size:9px;">
                    <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:3px;">
                        <div style="color:#aaa; margin-bottom:2px;">Karriere-Start</div>
                        <div style="font-weight:700; color:var(--primary);">Saison ${profile.careerStart}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:3px;">
                        <div style="color:#aaa; margin-bottom:2px;">Karrierehöhepunkt</div>
                        <div style="font-weight:700; color:var(--gold);">${profile.careerPeak ? `Saison ${profile.careerPeak} (Str ${profile.peakStrength})` : 'Noch nicht erreicht'}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:3px;">
                        <div style="color:#aaa; margin-bottom:2px;">Alter</div>
                        <div style="font-weight:700; color:var(--primary);">${player.age || '-'} Jahre</div>
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">📈 KARRIERE-GESAMTWERTE</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; font-size:9px;">
                    <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:3px;">
                        <div style="color:#aaa; margin-bottom:2px;">Ligaspiele</div>
                        <div style="font-weight:700; color:var(--primary); font-size:14px;">${profile.totalMatches || 0}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:3px;">
                        <div style="color:#aaa; margin-bottom:2px;">Tore</div>
                        <div style="font-weight:700; color:var(--gold); font-size:14px;">${profile.totalGoals || 0}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); padding:6px; border-radius:3px;">
                        <div style="color:#aaa; margin-bottom:2px;">Assists</div>
                        <div style="font-weight:700; color:var(--primary); font-size:14px;">${profile.totalAssists || 0}</div>
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">⭐ LEISTUNGS-MEILENSTEINE</div>
                <div style="display:grid; gap:4px; font-size:9px;">
        `;

        if (milestones.length === 0) {
            html += '<div style="color:#aaa;">Noch keine Meilensteine erreicht</div>';
        } else {
            milestones.slice(-5).reverse().forEach(m => {
                html += `
                    <div style="padding:4px; background:rgba(255,255,255,0.02); border-radius:3px; border-left:2px solid var(--gold);">
                        <div style="font-weight:700; color:var(--gold);">${m.milestone}</div>
                        <div style="font-size:8px; color:#aaa;">Saison ${m.season}, Spieltag ${m.matchday}</div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">📋 SAISONALE LEISTUNG</div>
                <div style="display:grid; gap:3px; font-size:8px;">
        `;

        if (performance.length === 0) {
            html += '<div style="color:#aaa;">Noch keine Saisonalwerte aufgezeichnet</div>';
        } else {
            performance.slice(-5).reverse().forEach(perf => {
                html += `
                    <div style="display:flex; justify-content:space-between; padding:2px; background:rgba(255,255,255,0.02); border-radius:2px;">
                        <span style="font-weight:700;">Saison ${perf.season}:</span>
                        <span style="color:var(--accent);">${perf.matches} Spiele · ⚽ ${perf.goals} · 🎯 ${perf.assists}</span>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

