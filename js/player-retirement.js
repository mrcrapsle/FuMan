// Spieler-Pensionierung & Legenden-System
// Automatische Pensionierungen, Hall of Fame, Abschiedsspiele

let playerRetirementState = {
    retiredPlayers: [],
    legendPlayers: [],
    retirementHistory: [],
    fareewellGamesScheduled: []
};

const RETIREMENT_CRITERIA = {
    AUTOMATIC_AGE: 36,
    LEGEND_THRESHOLD: 85,
    LEGEND_GAMES: 100,
    LEGEND_GOALS: 30,
    LEGEND_ASSISTS: 20
};

const LEGEND_TIERS = {
    ICON: { label: 'Vereins-Ikone', color: 'var(--gold)', multiplier: 1.5 },
    LEGEND: { label: 'Legende', color: 'var(--primary)', multiplier: 1.3 },
    CLUB_HERO: { label: 'Vereinsheld', color: 'var(--accent)', multiplier: 1.1 }
};

function initializePlayerRetirement() {
    if (!game.playerRetirement) game.playerRetirement = {};
    if (!game.playerRetirement.retiredPlayers) game.playerRetirement.retiredPlayers = [];
    if (!game.playerRetirement.legendPlayers) game.playerRetirement.legendPlayers = [];
    if (!game.playerRetirement.retirementHistory) game.playerRetirement.retirementHistory = [];
    if (!game.playerRetirement.fareewellGamesScheduled) game.playerRetirement.fareewellGamesScheduled = [];
}

function checkForLegendStatus(player) {
    if (!player) return null;

    const strength = player.strength || 0;
    const games = player.appearances || 0;
    const goals = player.goals || 0;
    const assists = player.assists || 0;

    let tier = null;

    if (strength >= RETIREMENT_CRITERIA.LEGEND_THRESHOLD && games >= RETIREMENT_CRITERIA.LEGEND_GAMES) {
        if (goals >= RETIREMENT_CRITERIA.LEGEND_GOALS && strength >= 88) {
            tier = 'ICON';
        } else if (goals >= 15 || assists >= 10) {
            tier = 'LEGEND';
        } else {
            tier = 'CLUB_HERO';
        }
    }

    return tier;
}

function schedulePlayerRetirement(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return false;

    const legendTier = checkForLegendStatus(player);
    const retirementRecord = {
        playerId: playerId,
        playerName: player.name,
        age: player.age || 0,
        strength: player.strength || 0,
        position: player.pos,
        appearances: player.appearances || 0,
        goals: player.goals || 0,
        assists: player.assists || 0,
        legendTier: legendTier,
        retirementMatchday: game.matchday,
        retirementSeason: game.season,
        timestamp: new Date().getTime()
    };

    game.playerRetirement.retiredPlayers.push(retirementRecord);
    game.playerRetirement.retirementHistory.push(retirementRecord);

    if (legendTier) {
        game.playerRetirement.legendPlayers.push({
            ...retirementRecord,
            tier: legendTier,
            tierLabel: LEGEND_TIERS[legendTier].label,
            tierColor: LEGEND_TIERS[legendTier].color
        });

        const tierLabel = LEGEND_TIERS[legendTier].label;
        showToast(`🌟 ${player.name} wurde ${tierLabel}! (${Math.floor(player.strength)} Stärke)`, 'success', 6000);
    } else {
        showToast(`👋 ${player.name} tritt aus dem Profifußball zurück.`, 'info', 5000);
    }

    squad = squad.filter(p => p.id !== playerId);
    return true;
}

function isPlayerEligibleForRetirement(player) {
    if (!player) return false;
    const age = player.age || 25;
    return age >= RETIREMENT_CRITERIA.AUTOMATIC_AGE;
}

function scheduleRetirementCeremonial(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return false;

    const ceremonyMatchday = (game.matchday || 1) + 2;

    game.playerRetirement.fareewellGamesScheduled.push({
        playerId: playerId,
        playerName: player.name,
        scheduledMatchday: ceremonyMatchday,
        season: game.season
    });

    showToast(`🎉 Abschiedsspiel für ${player.name} in 2 Spieltagen geplant!`, 'info', 5000);
    return true;
}

function tickPlayerRetirement() {
    initializePlayerRetirement();

    const eligiblePlayers = squad.filter(p => isPlayerEligibleForRetirement(p));

    eligiblePlayers.forEach(player => {
        const alreadyProcessed = game.playerRetirement.retiredPlayers.find(r => r.playerId === player.id);
        if (!alreadyProcessed) {
            schedulePlayerRetirement(player.id);
        }
    });

    const completedCeremonies = game.playerRetirement.fareewellGamesScheduled.filter(c =>
        c.scheduledMatchday <= (game.matchday || 1)
    );

    game.playerRetirement.fareewellGamesScheduled = game.playerRetirement.fareewellGamesScheduled.filter(c =>
        c.scheduledMatchday > (game.matchday || 1)
    );
}

function getRetirementSummary() {
    if (!game.playerRetirement) return { retired: 0, legends: 0, ceremonies: 0 };

    return {
        retired: game.playerRetirement.retiredPlayers.length,
        legends: game.playerRetirement.legendPlayers.length,
        ceremonies: game.playerRetirement.fareewellGamesScheduled.length,
        retiredThisSeason: game.playerRetirement.retirementHistory.filter(r => r.retirementSeason === game.season).length
    };
}

function renderPlayerRetirementPanel() {
    const container = document.getElementById('player-retirement-box');
    if (!container) return;

    initializePlayerRetirement();

    let html = '<div class="panel-content">';
    html += '<h3>👋 SPIELER-PENSIONIERUNG & LEGENDEN</h3>';

    const summary = getRetirementSummary();
    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Karriere-Status:</strong> `;
    html += `Pensioniert: <span style="color:var(--text-muted);">${summary.retired}</span> | `;
    html += `Legenden: <span style="color:var(--gold);">${summary.legends}</span></p>`;
    html += `<p style="font-size:9px; margin:4px 0 0 0;">Diese Saison: ${summary.retiredThisSeason} Pensionierungen</p>`;
    html += '</div>';

    if (game.playerRetirement.legendPlayers && game.playerRetirement.legendPlayers.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>⭐ LEGENDEN DES VEREINS</h4>';

        game.playerRetirement.legendPlayers.slice(0, 8).forEach(legend => {
            html += `<div style="background:#1a2a1a; padding:6px; margin-bottom:4px; border-radius:3px; border-left:3px solid ${legend.tierColor};">`;
            html += `<p style="font-size:9px; margin:0 0 2px 0;"><strong>${legend.playerName}</strong> <span style="color:${legend.tierColor}; font-size:8px;">${legend.tierLabel}</span></p>`;
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">ST ${legend.age} | ${legend.goals} Tore | ${legend.appearances} Spiele</p>`;
            html += `</div>`;
        });

        if (game.playerRetirement.legendPlayers.length > 8) {
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">... und ${game.playerRetirement.legendPlayers.length - 8} weitere Legenden</p>`;
        }

        html += '</div>';
    }

    if (game.playerRetirement.fareewellGamesScheduled && game.playerRetirement.fareewellGamesScheduled.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>🎉 ABSCHIEDSSPIELE GEPLANT</h4>';

        game.playerRetirement.fareewellGamesScheduled.forEach(ceremony => {
            const daysLeft = ceremony.scheduledMatchday - (game.matchday || 1);
            html += `<div style="background:#2a1a1a; padding:6px; margin-bottom:4px; border-radius:3px; border-left:3px solid var(--accent);">`;
            html += `<p style="font-size:9px; margin:0;"><strong>${ceremony.playerName}</strong></p>`;
            html += `<p style="font-size:8px; color:var(--accent); margin:0;">in ${daysLeft} Spieltagen (ST ${ceremony.scheduledMatchday})</p>`;
            html += `</div>`;
        });

        html += '</div>';
    }

    const eligibleForRetirement = squad.filter(p => isPlayerEligibleForRetirement(p));
    if (eligibleForRetirement.length > 0) {
        html += '<div style="margin-top:10px;">';
        html += '<h4>⚠️ NÄCHSTE PENSIONIERUNGEN</h4>';

        eligibleForRetirement.slice(0, 4).forEach(player => {
            const legendTier = checkForLegendStatus(player);
            const tierText = legendTier ? ` (${LEGEND_TIERS[legendTier].label})` : '';
            html += `<div style="font-size:8px; padding:4px; background:#2a2a2a; border-radius:2px; margin-bottom:2px;">`;
            html += `${player.name}, ${player.age} Jahre${tierText}`;
            html += `</div>`;
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
