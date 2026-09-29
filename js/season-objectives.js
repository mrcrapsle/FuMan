// Season Goals & Objectives System
// Dynamic season-specific objectives with rewards and progress tracking

let seasonObjectivesState = {
    activeObjectives: [],
    completedObjectives: [],
    objectiveRewards: 0,
    seasonProgress: {}
};

const OBJECTIVE_TYPES = {
    PROMOTION: {
        name: 'Aufstieg',
        category: 'Liga',
        difficulty: 'HARD',
        baseReward: 500000,
        description: 'Steige in die nächst höhere Liga auf'
    },
    CHAMPIONSHIP: {
        name: 'Meisterschaft',
        category: 'Liga',
        difficulty: 'HARD',
        baseReward: 750000,
        description: 'Gewinne die Meisterschaft'
    },
    CUP_WIN: {
        name: 'Pokalsieg',
        category: 'Wettbewerb',
        difficulty: 'MEDIUM',
        baseReward: 250000,
        description: 'Gewinne den DFB-Pokal oder Landespokal'
    },
    EUROPEAN_QUALIFICATION: {
        name: 'Europa-Teilnahme',
        category: 'Wettbewerb',
        difficulty: 'HARD',
        baseReward: 400000,
        description: 'Qualifiziere dich für einen europäischen Wettbewerb'
    },
    FINANCIAL_TARGET: {
        name: 'Finanzielle Stabilität',
        category: 'Wirtschaft',
        difficulty: 'EASY',
        baseReward: 200000,
        description: 'Verfüge über 1.000.000 € Vereinskonto'
    },
    UNDEFEATED_RUN: {
        name: 'Siegesserie',
        category: 'Leistung',
        difficulty: 'MEDIUM',
        baseReward: 300000,
        description: 'Bleibe 5 Spiele lang ungeschlagen'
    },
    YOUTH_PROMOTION: {
        name: 'Nachwuchserfolg',
        category: 'Entwicklung',
        difficulty: 'MEDIUM',
        baseReward: 350000,
        description: 'Spieler unter 21 Jahren spielen 100+ Minuten'
    },
    TICKET_REVENUE: {
        name: 'Zuschauer-Erlebnis',
        category: 'Wirtschaft',
        difficulty: 'EASY',
        baseReward: 150000,
        description: 'Erreiche durchschnittlich 80% Stadionauslastung'
    },
    TOP_SCORER: {
        name: 'Torschützen-König',
        category: 'Leistung',
        difficulty: 'MEDIUM',
        baseReward: 200000,
        description: 'Ein Spieler erzielt 10+ Tore in der Saison'
    },
    CLEAN_SHEETS: {
        name: 'Defensive Stabilität',
        category: 'Leistung',
        difficulty: 'MEDIUM',
        baseReward: 200000,
        description: 'Erreiche 10+ Zu-Null-Siege in der Saison'
    }
};

const DIFFICULTY_MULTIPLIERS = {
    EASY: 1.0,
    MEDIUM: 1.5,
    HARD: 2.5
};

function initializeSeasonObjectives() {
    if (!game.seasonObjectives) game.seasonObjectives = {};
    if (!game.seasonObjectives.activeObjectives) {
        game.seasonObjectives.activeObjectives = [];
        generateSeasonObjectives();
    }
    if (!game.seasonObjectives.completedObjectives) game.seasonObjectives.completedObjectives = [];
    if (!game.seasonObjectives.objectiveRewards) game.seasonObjectives.objectiveRewards = 0;
}

function generateSeasonObjectives() {
    const objectives = [];
    const availableTypes = Object.keys(OBJECTIVE_TYPES);

    // Generate 3-5 random objectives per season based on league
    const objectiveCount = 3 + Math.floor(Math.random() * 2);
    const selected = [];

    for (let i = 0; i < objectiveCount; i++) {
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        if (!selected.includes(type)) {
            selected.push(type);
            const config = OBJECTIVE_TYPES[type];
            const reward = Math.floor(
                config.baseReward * DIFFICULTY_MULTIPLIERS[config.difficulty] *
                (1 + (game.leagueLevel * 0.2)) // Higher leagues have higher rewards
            );

            objectives.push({
                id: `obj_${type}_${game.season}`,
                type: type,
                name: config.name,
                category: config.category,
                difficulty: config.difficulty,
                description: config.description,
                progress: 0,
                target: 100,
                reward: reward,
                startSeason: game.season,
                completed: false,
                progress_label: ''
            });
        }
    }

    game.seasonObjectives.activeObjectives = objectives;
}

function updateObjectiveProgress() {
    if (!game.seasonObjectives.activeObjectives) return;

    game.seasonObjectives.activeObjectives.forEach(obj => {
        if (obj.completed) return;

        let progress = 0;
        let target = 100;

        switch (obj.type) {
            case 'PROMOTION':
                target = 1; // Check if promoted
                progress = (game.leagueLevel < 4) ? 100 : 0;
                obj.progress_label = progress === 100 ? 'Aufgestiegen ✓' : `Liga ${game.leagueLevel} / 3+`;
                break;

            case 'CHAMPIONSHIP':
                // Check if won league this season
                target = 1;
                progress = (game.leaguePosition === 1 && game.season > obj.startSeason) ? 100 : 0;
                obj.progress_label = progress === 100 ? 'Meister ✓' : `Position: ${game.leaguePosition || '?'}`;
                break;

            case 'CUP_WIN':
                target = 1;
                progress = (game.cupWinThisSeason) ? 100 : 0;
                obj.progress_label = progress === 100 ? 'Pokalsieg ✓' : 'In den Wettbewerben';
                break;

            case 'EUROPEAN_QUALIFICATION':
                target = 1;
                progress = (game.leaguePosition <= 3 || game.europeanQualified) ? 100 : 0;
                obj.progress_label = progress === 100 ? 'Qualifiziert ✓' : `Position: ${game.leaguePosition || '?'}`;
                break;

            case 'FINANCIAL_TARGET':
                target = 1000000;
                progress = Math.min(100, Math.floor((game.money / target) * 100));
                obj.progress_label = `€${(game.money / 1000000).toFixed(2)}M / €1M`;
                break;

            case 'UNDEFEATED_RUN':
                target = 5;
                const recentResults = (game.recentResults || []).slice(-5);
                progress = Math.floor((recentResults.filter(r => r.result !== 'L').length / 5) * 100);
                obj.progress_label = `${recentResults.filter(r => r.result !== 'L').length} / 5 ungeschlagen`;
                break;

            case 'YOUTH_PROMOTION':
                target = 100;
                const youthMinutes = squad.filter(p => (p.age || 25) < 21)
                    .reduce((sum, p) => sum + (p.minutesPlayed || 0), 0);
                progress = Math.min(100, Math.floor((youthMinutes / 100) * 100));
                obj.progress_label = `${youthMinutes} Minuten / 100 min`;
                break;

            case 'TICKET_REVENUE':
                target = 100;
                const avgAttendance = (game.matchAttendances || []).reduce((a, b) => a + b, 0) /
                                     Math.max(1, game.matchAttendances?.length || 1);
                const capacity = game.stadium?.capacity || 10000;
                progress = Math.min(100, Math.floor(((avgAttendance / capacity) * 100) / 80 * 100));
                obj.progress_label = `${Math.floor((avgAttendance / capacity) * 100)}% / 80%`;
                break;

            case 'TOP_SCORER':
                target = 10;
                const topScorerGoals = Math.max(...squad.map(p => p.goals || 0));
                progress = Math.min(100, Math.floor((topScorerGoals / 10) * 100));
                obj.progress_label = `${topScorerGoals} Tore / 10 Tore`;
                break;

            case 'CLEAN_SHEETS':
                target = 10;
                const cleanSheets = (game.matchResults || []).filter(m => m.goalsAgainst === 0).length;
                progress = Math.min(100, Math.floor((cleanSheets / 10) * 100));
                obj.progress_label = `${cleanSheets} Zu-Null / 10 Siege`;
                break;
        }

        obj.progress = progress;
        obj.target = target;

        if (progress >= 100 && !obj.completed) {
            completeObjective(obj.id);
        }
    });
}

function completeObjective(objectiveId) {
    const obj = game.seasonObjectives.activeObjectives.find(o => o.id === objectiveId);
    if (!obj) return;

    obj.completed = true;
    game.seasonObjectives.activeObjectives = game.seasonObjectives.activeObjectives.filter(o => o.id !== objectiveId);
    game.seasonObjectives.completedObjectives.push(obj);

    game.money += obj.reward;
    game.seasonObjectives.objectiveRewards += obj.reward;

    showToast(`🎯 Ziel erreicht: ${obj.name}! +€${(obj.reward / 1000).toFixed(0)}k`, 'success', 6000);
    recordFinancialEvent('Zielbonus', obj.reward, 'Season Objective');
}

function getSeasonObjectivesSummary() {
    if (!game.seasonObjectives.activeObjectives) return { completed: 0, active: 0, rewards: 0 };

    return {
        active: game.seasonObjectives.activeObjectives.length,
        completed: game.seasonObjectives.completedObjectives.filter(o => o.startSeason === game.season).length,
        rewards: game.seasonObjectives.objectiveRewards,
        objectives: game.seasonObjectives.activeObjectives.map(o => ({
            name: o.name,
            difficulty: o.difficulty,
            progress: o.progress,
            reward: o.reward
        }))
    };
}

function tickSeasonObjectives() {
    updateObjectiveProgress();
}

function renderSeasonObjectivesPanel() {
    const container = document.getElementById('season-objectives-box');
    if (!container) return;

    initializeSeasonObjectives();
    updateObjectiveProgress();

    let html = '<div class="panel-content">';
    html += '<h3>🎯 Saison-Ziele</h3>';

    // Summary
    const summary = getSeasonObjectivesSummary();
    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Saison ${game.season}</strong> | `;
    html += `Ziele erreicht: <span style="color:var(--primary);">${summary.completed}</span> | `;
    html += `Aktiv: <span style="color:var(--accent);">${summary.active}</span></p>`;
    if (summary.rewards > 0) {
        html += `<p style="font-size:9px; margin:4px 0 0 0; color:var(--primary);">📈 Bonuse diese Saison: €${(summary.rewards / 1000).toFixed(0)}k</p>`;
    }
    html += '</div>';

    // Active Objectives
    if (game.seasonObjectives.activeObjectives.length > 0) {
        html += '<div class="objectives-list" style="margin-bottom:10px;">';
        html += '<h4>📋 Aktive Ziele</h4>';

        game.seasonObjectives.activeObjectives.forEach(obj => {
            const diffColor = obj.difficulty === 'HARD' ? 'var(--danger)' :
                            obj.difficulty === 'MEDIUM' ? 'var(--accent)' : 'var(--primary)';

            html += `<div style="background:#222; padding:8px; margin-bottom:6px; border-radius:4px;">`;
            html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">`;
            html += `<strong style="font-size:10px;">${obj.name}</strong>`;
            html += `<span style="font-size:8px; color:${diffColor};">${obj.difficulty}</span>`;
            html += `</div>`;
            html += `<p style="font-size:9px; color:var(--text-muted); margin:0 0 4px 0;">${obj.description}</p>`;
            html += `<div style="width:100%; height:8px; background:#333; border-radius:2px; overflow:hidden; margin-bottom:4px;">`;
            html += `<div style="width:${obj.progress}%; height:100%; background:${diffColor};"></div>`;
            html += `</div>`;
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">${obj.progress_label || obj.progress}%</p>`;
            html += `<p style="font-size:9px; margin:4px 0 0 0; color:var(--primary);">💰 €${(obj.reward / 1000).toFixed(0)}k</p>`;
            html += `</div>`;
        });

        html += '</div>';
    } else {
        html += '<p style="font-size:9px; color:var(--primary);">✓ Alle Ziele dieser Saison erreicht!</p>';
    }

    // Completed This Season
    const seasonCompleted = game.seasonObjectives.completedObjectives.filter(o => o.startSeason === game.season);
    if (seasonCompleted.length > 0) {
        html += '<div class="completed-objectives" style="margin-top:10px;">';
        html += `<h4>✅ Abgeschlossen (${seasonCompleted.length})</h4>`;
        html += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:4px;">';

        seasonCompleted.forEach(obj => {
            html += `<div style="background:#1a3a1a; padding:6px; border-radius:3px; border-left:3px solid var(--primary); font-size:8px;">`;
            html += `<strong>${obj.name}</strong><br/>`;
            html += `€${(obj.reward / 1000).toFixed(0)}k`;
            html += `</div>`;
        });

        html += '</div>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
