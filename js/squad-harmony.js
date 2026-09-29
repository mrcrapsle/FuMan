// Squad Morale & Harmony System
// Team cohesion, cliques, and morale impact on performance

let squadHarmonyState = {
    playerMorale: {},
    teamCohesion: 50,
    cliques: [],
    harmonyHistory: [],
    moraleBoosters: []
};

const MORALE_FACTORS = {
    WIN: 5,
    DRAW: 1,
    LOSS: -5,
    GOAL_SCORED: 2,
    CLEAN_SHEET: 3,
    BENCHED: -2,
    INJURED: -4,
    FIRST_TEAM_MINUTES: 1,
    GOAL_BONUS: 3
};

const HARMONY_IMPACTS = {
    EXCELLENT: { label: 'Ausgezeichnet', modifier: 1.15, color: 'var(--primary)' },
    GOOD: { label: 'Gut', modifier: 1.05, color: 'var(--primary)' },
    NORMAL: { label: 'Normal', modifier: 1.0, color: 'var(--text-muted)' },
    POOR: { label: 'Schlecht', modifier: 0.9, color: 'var(--accent)' },
    TOXIC: { label: 'Vergiftet', modifier: 0.75, color: 'var(--danger)' }
};

function initializeSquadHarmony() {
    if (!game.squadHarmony) game.squadHarmony = {};

    if (!game.squadHarmony.playerMorale) {
        game.squadHarmony.playerMorale = {};
        squad.forEach(player => {
            game.squadHarmony.playerMorale[player.id] = {
                playerId: player.id,
                playerName: player.name,
                morale: 50 + Math.random() * 30,
                loyaltyYears: 0,
                clique: null,
                recentMoraleEvents: []
            };
        });
    }

    if (typeof game.squadHarmony.teamCohesion !== 'number') {
        game.squadHarmony.teamCohesion = 50;
    }
    if (!game.squadHarmony.cliques) game.squadHarmony.cliques = [];
    if (!game.squadHarmony.harmonyHistory) game.squadHarmony.harmonyHistory = [];
}

function updatePlayerMorale(playerId, event, value) {
    const playerRecord = game.squadHarmony.playerMorale[playerId];
    if (!playerRecord) return;

    const change = MORALE_FACTORS[event] || value || 0;
    playerRecord.morale = Math.max(0, Math.min(100, playerRecord.morale + change));

    playerRecord.recentMoraleEvents.push({
        matchday: game.matchday || 1,
        event: event,
        change: change
    });

    // Keep only last 5 events
    if (playerRecord.recentMoraleEvents.length > 5) {
        playerRecord.recentMoraleEvents.shift();
    }
}

function getTeamHarmonyLevel() {
    if (!game.squadHarmony.playerMorale) return HARMONY_IMPACTS.NORMAL;

    const avgMorale = Object.values(game.squadHarmony.playerMorale)
        .reduce((sum, p) => sum + p.morale, 0) / Math.max(1, Object.keys(game.squadHarmony.playerMorale).length);

    if (avgMorale >= 80) return HARMONY_IMPACTS.EXCELLENT;
    if (avgMorale >= 65) return HARMONY_IMPACTS.GOOD;
    if (avgMorale >= 40) return HARMONY_IMPACTS.NORMAL;
    if (avgMorale >= 25) return HARMONY_IMPACTS.POOR;
    return HARMONY_IMPACTS.TOXIC;
}

function updateTeamCohesion() {
    if (!game.squadHarmony.playerMorale) return;

    const avgMorale = Object.values(game.squadHarmony.playerMorale)
        .reduce((sum, p) => sum + p.morale, 0) / Math.max(1, Object.keys(game.squadHarmony.playerMorale).length);

    // Cohesion affected by average morale
    game.squadHarmony.teamCohesion = Math.max(0, Math.min(100, avgMorale * 0.8 + 20));

    // Penalize if there are conflicts
    const conflictPlayers = Object.values(game.squadHarmony.playerMorale)
        .filter(p => p.morale < 30).length;

    game.squadHarmony.teamCohesion -= conflictPlayers * 3;
}

function detectCliques() {
    if (!game.squadHarmony.playerMorale || squad.length < 3) return;

    // Simple clique detection: players with similar morale form cliques
    const moraleGroups = {};

    Object.entries(game.squadHarmony.playerMorale).forEach(([playerId, record]) => {
        const moraleRange = Math.floor(record.morale / 10) * 10;
        if (!moraleGroups[moraleRange]) moraleGroups[moraleRange] = [];
        moraleGroups[moraleRange].push(playerId);
    });

    // Cliques need 2+ players
    game.squadHarmony.cliques = Object.entries(moraleGroups)
        .filter(([_, players]) => players.length >= 2)
        .map(([moraleBand, players]) => ({
            id: `clique_${moraleBand}`,
            moraleRange: moraleBand,
            members: players,
            size: players.length,
            label: moraleBand >= 70 ? 'Positive Gruppe' : 'Kritische Gruppe'
        }));
}

function tickSquadHarmony() {
    initializeSquadHarmony();

    // Natural morale drift (players missing playing time get sad)
    Object.entries(game.squadHarmony.playerMorale).forEach(([playerId, record]) => {
        const player = squad.find(p => p.id === playerId);
        if (!player) return;

        // Small natural decay without playing time
        if ((player.minutesPlayed || 0) === 0 && (game.matchday || 1) % 2 === 0) {
            record.morale = Math.max(0, record.morale - 1);
        }
    });

    // Update team cohesion based on player morale
    updateTeamCohesion();

    // Detect cliques every few matchdays
    if ((game.matchday || 1) % 4 === 0) {
        detectCliques();
    }
}

function getMoraleBoost() {
    const harmony = getTeamHarmonyLevel();
    return harmony.modifier;
}

function applyMoraleToPerformance(baseStrength) {
    const harmonyBoost = getMoraleBoost();
    return baseStrength * harmonyBoost;
}

function organizeMoraleEvent(eventType) {
    // Events to boost morale: team building, bonus payments, rest day, etc.
    if (eventType === 'TEAM_BUILDING') {
        Object.values(game.squadHarmony.playerMorale).forEach(p => {
            p.morale = Math.min(100, p.morale + 8);
        });
        game.money -= 50000;
        recordFinancialEvent('Team-Building-Event', -50000, 'Morale');
        showToast('🎯 Team-Building-Event durchgeführt! Moral +8', 'success', 5000);
    } else if (eventType === 'BONUS_PAYMENT') {
        Object.values(game.squadHarmony.playerMorale).forEach(p => {
            p.morale = Math.min(100, p.morale + 10);
        });
        game.money -= 100000;
        recordFinancialEvent('Bonuszahlung für Mannschaft', -100000, 'Morale');
        showToast('💰 Bonuszahlungen verteilt! Moral +10', 'success', 5000);
    } else if (eventType === 'REST_DAY') {
        Object.values(game.squadHarmony.playerMorale).forEach(p => {
            p.morale = Math.min(100, p.morale + 5);
        });
        showToast('😌 Trainingsfreier Tag gewährt! Moral +5', 'success', 5000);
    }
}

function getPlayerMoraleStatus(playerId) {
    const record = game.squadHarmony.playerMorale[playerId];
    if (!record) return null;

    let status;
    if (record.morale >= 80) status = 'Sehr hoch';
    else if (record.morale >= 60) status = 'Hoch';
    else if (record.morale >= 40) status = 'Normal';
    else if (record.morale >= 20) status = 'Niedrig';
    else status = 'Sehr niedrig';

    return {
        playerName: record.playerName,
        morale: Math.floor(record.morale),
        status: status,
        recentEvents: record.recentMoraleEvents.slice(-3)
    };
}

function renderSquadHarmonyPanel() {
    const container = document.getElementById('squad-harmony-box');
    if (!container) return;

    initializeSquadHarmony();
    updateTeamCohesion();
    detectCliques();

    let html = '<div class="panel-content">';
    html += '<h3>❤️ Mannschafts-Harmonie</h3>';

    // Team Cohesion Bar
    const harmony = getTeamHarmonyLevel();
    html += '<div style="margin-bottom:10px;">';
    html += `<p style="font-size:10px; margin:0 0 4px 0;"><strong>Team-Zusammenhalt:</strong> <span style="color:${harmony.color};">${harmony.label}</span></p>`;
    html += `<div style="width:100%; height:12px; background:#333; border-radius:4px; overflow:hidden;">`;
    html += `<div style="width:${game.squadHarmony.teamCohesion}%; height:100%; background:${harmony.color};"></div>`;
    html += `</div>`;
    html += `<p style="font-size:8px; color:var(--text-muted); margin:2px 0 0 0;">Performance-Bonus: ${(harmony.modifier * 100).toFixed(0)}%</p>`;
    html += '</div>';

    // Morale Events
    html += '<div style="margin-bottom:10px;">';
    html += '<h4>🎯 Maßnahmen</h4>';
    html += '<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:4px;">';
    html += `<button onclick="organizeMoraleEvent('TEAM_BUILDING')" class="btn-secondary" style="font-size:9px; padding:6px;">🏃 Team-Building [€50k]</button>`;
    html += `<button onclick="organizeMoraleEvent('BONUS_PAYMENT')" class="btn-secondary" style="font-size:9px; padding:6px;">💵 Bonuszahlung [€100k]</button>`;
    html += `<button onclick="organizeMoraleEvent('REST_DAY')" class="btn-secondary" style="font-size:9px; padding:6px;">😌 Trainingsfreier Tag</button>`;
    html += '</div>';
    html += '</div>';

    // Player Morale Overview
    html += '<div style="margin-bottom:10px;">';
    html += '<h4>📊 Spieler-Moral (Top 11)</h4>';
    html += '<table class="morale-table" style="width:100%; font-size:9px;">';
    html += '<tr><th>Spieler</th><th>Moral</th><th>Status</th></tr>';

    const topPlayers = squad.slice(0, 11);
    topPlayers.forEach(player => {
        const record = game.squadHarmony.playerMorale[player.id];
        if (!record) return;

        const status = getPlayerMoraleStatus(player.id);
        const moraleColor = record.morale >= 70 ? 'var(--primary)' :
                           record.morale >= 50 ? 'var(--accent)' : 'var(--danger)';

        html += `<tr>
                    <td>${record.playerName}</td>
                    <td><div style="width:40px; height:8px; background:#333; border-radius:2px; overflow:hidden; display:inline-block;">
                        <div style="width:${record.morale}%; height:100%; background:${moraleColor};"></div>
                    </div></td>
                    <td style="color:${moraleColor};">${Math.floor(record.morale)}</td>
                </tr>`;
    });

    html += '</table>';
    html += '</div>';

    // Cliques
    if (game.squadHarmony.cliques.length > 0) {
        html += '<div class="cliques" style="margin-top:10px;">';
        html += `<h4>👥 Gruppen (${game.squadHarmony.cliques.length})</h4>`;

        game.squadHarmony.cliques.forEach(clique => {
            const members = clique.members.map(id => {
                const p = squad.find(x => x.id === id);
                return p ? p.name : '?';
            }).join(', ');

            const bgColor = clique.label === 'Positive Gruppe' ? '#1a3a1a' : '#3a1a1a';
            html += `<div style="background:${bgColor}; padding:6px; border-radius:3px; margin-bottom:4px; border-left:3px solid ${clique.label === 'Positive Gruppe' ? 'var(--primary)' : 'var(--danger)'};">`;
            html += `<p style="font-size:9px; margin:0;"><strong>${clique.label}</strong> (${clique.size} Spieler)</p>`;
            html += `<p style="font-size:8px; color:var(--text-muted); margin:2px 0 0 0;">${members}</p>`;
            html += `</div>`;
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
