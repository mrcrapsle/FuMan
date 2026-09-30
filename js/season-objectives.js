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
        description: 'Spieler unter 21 Jahren kommen auf 5+ Ligaeinsätze'
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
        description: 'Erreiche 10+ Zu-Null-Siege in der Liga'
    }
};

// Ein Ziel soll etwa 5-15% eines Saisonbudgets der Liga wert sein (6. Liga: ~12-20k bei 150k Startkapital).
const OBJECTIVE_LEAGUE_FACTOR = [1.0, 0.55, 0.3, 0.15, 0.08, 0.04];

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
    // Keine Ziele anbieten, die schon beim Anlegen erfüllt oder unerreichbar sind.
    const availableTypes = Object.keys(OBJECTIVE_TYPES).filter(type =>
        !(type === 'PROMOTION' && game.leagueLevel === 0) &&
        !(type === 'FINANCIAL_TARGET' && game.money >= 1000000) &&
        !(type === 'EUROPEAN_QUALIFICATION' && game.leagueLevel !== 0 && !game.inCup) &&
        // Zuschauer sind je Liga gedeckelt (LEAGUE_ATTENDANCE_CEILING) - 80% erst ab 2. Liga möglich.
        !(type === 'TICKET_REVENUE' && (LEAGUE_ATTENDANCE_CEILING[game.leagueLevel] ?? 0) < 0.6));

    // Generate 3-5 random objectives per season based on league
    const objectiveCount = 3 + Math.floor(Math.random() * 2);
    const selected = [];

    for (let i = 0; i < objectiveCount; i++) {
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        if (!selected.includes(type)) {
            selected.push(type);
            const config = OBJECTIVE_TYPES[type];
            // leagueLevel 0 = 1. Liga: höhere Ligen zahlen mehr (bisher war es umgekehrt, die
            // 6. Liga bekam das Doppelte - bei 150.000 € Startkapital ein Vielfaches davon).
            const leagueFactor = OBJECTIVE_LEAGUE_FACTOR[game.leagueLevel] ?? OBJECTIVE_LEAGUE_FACTOR[OBJECTIVE_LEAGUE_FACTOR.length - 1];
            const reward = Math.floor(config.baseReward * DIFFICULTY_MULTIPLIERS[config.difficulty] * leagueFactor);

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
                startLeagueLevel: game.leagueLevel,
                completed: false,
                progress_label: ''
            });
        }
    }

    game.seasonObjectives.activeObjectives = objectives;
}

// Gleiche Sortierung wie Tabellenanzeige und Saisonabschluss (Punkte, dann Tordifferenz).
function getOwnLeagueRank() {
    const teams = [...(leaguesData[game.leagueLevel] || [])]
        .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
    const rank = teams.findIndex(t => t.name === game.clubName) + 1;
    return rank > 0 ? rank : null;
}

// Gespielte Ligaspiele des eigenen Vereins in dieser Saison, chronologisch.
function getOwnSeasonMatches() {
    const teams = leaguesData[game.leagueLevel] || [];
    const me = teams.findIndex(t => t.name === game.clubName);
    const rounds = (typeof fixturesData !== 'undefined' && fixturesData[game.leagueLevel]) || [];
    if (me < 0) return [];
    const result = [];
    rounds.forEach((round, idx) => (round || []).forEach(f => {
        if (!f.played || (f.home !== me && f.away !== me)) return;
        const isHome = f.home === me;
        result.push({
            matchday: idx + 1,
            opponent: (teams[isHome ? f.away : f.home] || {}).name || '?',
            own: isHome ? f.homeGoals : f.awayGoals,
            opp: isHome ? f.awayGoals : f.homeGoals
        });
    }));
    return result;
}

function wonTrophyThisSeason(fragment) {
    return (game.trophies || []).some(t => t.includes(fragment) && t.includes(`(Saison ${game.season})`));
}

function updateObjectiveProgress(allowCompletion = true, finalRank = null) {
    if (!game.seasonObjectives.activeObjectives) return;
    const matches = getOwnSeasonMatches();
    const rank = finalRank || getOwnLeagueRank();

    game.seasonObjectives.activeObjectives.forEach(obj => {
        if (obj.completed) return;

        let done = false;
        let progress = 0;

        switch (obj.type) {
            case 'PROMOTION':
                // Der Ligawechsel passiert erst im Saisonabschluss - dort wird erneut geprüft.
                done = game.leagueLevel < (obj.startLeagueLevel ?? game.leagueLevel);
                obj.progress_label = done ? 'Aufgestiegen ✓' : `Platz ${rank || '?'} (Aufstieg: Platz 1-2)`;
                break;

            case 'CHAMPIONSHIP':
                // Erst mit dem Endstand entschieden, nicht schon als Tabellenführer im Herbst.
                done = finalRank === 1;
                obj.progress_label = done ? 'Meister ✓' : `Platz ${rank || '?'}`;
                break;

            case 'CUP_WIN':
                done = wonTrophyThisSeason('pokalsieger');
                obj.progress_label = done ? 'Pokalsieg ✓' : 'Im Wettbewerb';
                break;

            case 'EUROPEAN_QUALIFICATION':
                // Wie im Saisonabschluss: Platz 1-4 der 1. Liga oder DFB-Pokalsieg.
                done = (finalRank !== null && (obj.startLeagueLevel ?? game.leagueLevel) === 0 && finalRank <= 4)
                    || wonTrophyThisSeason('DFB-Pokalsieger');
                obj.progress_label = done ? 'Qualifiziert ✓' : `Platz ${rank || '?'} (nötig: 1-4)`;
                break;

            case 'FINANCIAL_TARGET':
                progress = Math.min(100, Math.floor((game.money / 1000000) * 100));
                done = progress >= 100;
                obj.progress_label = `€${(game.money / 1000000).toFixed(2)}M / €1M`;
                break;

            case 'UNDEFEATED_RUN': {
                const last5 = matches.slice(-5);
                const unbeaten = last5.filter(m => m.own >= m.opp).length;
                done = last5.length === 5 && unbeaten === 5;
                progress = unbeaten * 20;
                obj.progress_label = `${unbeaten} / 5 ungeschlagen`;
                break;
            }

            case 'YOUTH_PROMOTION': {
                const youthApps = squad.filter(p => (p.age || 25) < 21)
                    .reduce((sum, p) => sum + (p.appearancesSeason || 0), 0);
                progress = Math.min(100, youthApps * 20);
                done = youthApps >= 5;
                obj.progress_label = `${youthApps} / 5 U21-Einsätze`;
                break;
            }

            case 'TICKET_REVENUE': {
                const home = (game.attendanceHistory || []).filter(a => a.season === game.season && a.capacity > 0);
                const avg = home.length ? home.reduce((s, a) => s + a.attendance / a.capacity, 0) / home.length : 0;
                progress = Math.min(100, Math.floor(avg / 0.8 * 100));
                done = home.length >= 3 && avg >= 0.8;
                obj.progress_label = `${Math.round(avg * 100)}% / 80% Auslastung`;
                break;
            }

            case 'TOP_SCORER': {
                const best = Math.max(0, ...squad.map(p => p.goalsSeason || 0));
                progress = Math.min(100, best * 10);
                done = best >= 10;
                obj.progress_label = `${best} / 10 Tore`;
                break;
            }

            case 'CLEAN_SHEETS': {
                const zuNullSiege = matches.filter(m => m.opp === 0 && m.own > 0).length;
                progress = Math.min(100, zuNullSiege * 10);
                done = zuNullSiege >= 10;
                obj.progress_label = `${zuNullSiege} / 10 Zu-Null-Siege`;
                break;
            }
        }

        obj.progress = done ? 100 : progress;
        obj.target = 100;

        if (allowCompletion && done) {
            completeObjective(obj.id);
        }
    });
}

// Saisonabschluss, VOR dem Zurücksetzen der Saisonstatistiken: alles mit Endstand werten.
function evaluateSeasonEndObjectives(finalRank) {
    initializeSeasonObjectives();
    updateObjectiveProgress(true, finalRank);
}

// Nach dem Ligawechsel und game.season++: Aufstieg werten, dann neue Saisonziele vergeben.
function startNewSeasonObjectives() {
    initializeSeasonObjectives();
    updateObjectiveProgress(true);
    game.seasonObjectives.activeObjectives = [];
    generateSeasonObjectives();
}

function completeObjective(objectiveId) {
    const obj = game.seasonObjectives.activeObjectives.find(o => o.id === objectiveId);
    if (!obj) return;

    obj.completed = true;
    game.seasonObjectives.activeObjectives = game.seasonObjectives.activeObjectives.filter(o => o.id !== objectiveId);
    game.seasonObjectives.completedObjectives.push(obj);

    const aeussererKontext = buchungsKontext; // läuft ggf. im Monatsblock mit eigenem Label
    setzeBuchungskontext('🎯 Saisonziel-Prämie');
    game.money += obj.reward;
    setzeBuchungskontext(aeussererKontext);
    game.seasonObjectives.objectiveRewards += obj.reward;

    showToast(`🎯 Ziel erreicht: ${obj.name}! +€${(obj.reward / 1000).toFixed(0)}k`, 'success', 6000);
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
    // Nicht darauf verlassen, dass das Panel schon einmal gezeichnet wurde - früher legte
    // erst der Struktur-Selbsttest beim Start (alle Bildschirme) die Ziele an.
    initializeSeasonObjectives();
    updateObjectiveProgress();
}

function renderSeasonObjectivesPanel() {
    const container = document.getElementById('season-objectives-box');
    if (!container) return;

    initializeSeasonObjectives();
    // Nur Anzeige: Prämien zahlt ausschließlich der monatliche Tick aus.
    updateObjectiveProgress(false);

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
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">${obj.progress_label || obj.progress + '%'}</p>`;
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
