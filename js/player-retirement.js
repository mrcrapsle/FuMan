// Spieler-Pensionierung & Legenden-System
// Automatische Karriereenden ab 36 am Saisonende; die Legenden zeigt die Hall of Fame (js/hall-of-fame.js).

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
    delete game.playerRetirement.fareewellGamesScheduled; // Abschiedsspiele wurden nie ausgetragen
}

function checkForLegendStatus(player) {
    if (!player) return null;

    const strength = player.strength || 0;
    const games = player.appearances || 0;
    const goals = player.goalsCareer || 0;
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
        goals: player.goalsCareer || 0,
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
    addInboxMessage('vertrag', `👋 Karriereende: ${player.name}`, `${player.name} beendet mit ${player.age} Jahren seine Laufbahn (${retirementRecord.appearances} Pflichtspiele, ${retirementRecord.goals} Tore für den Verein)${legendTier ? ` - als ${LEGEND_TIERS[legendTier].label}` : ''}.`, 'screen-squad');

    squad = squad.filter(p => p.id !== playerId);
    if (typeof lineup !== 'undefined') lineup = lineup.filter(id => id !== playerId);
    return true;
}

function isPlayerEligibleForRetirement(player) {
    if (!player) return false;
    const age = player.age || 25;
    return age >= RETIREMENT_CRITERIA.AUTOMATIC_AGE;
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
}
