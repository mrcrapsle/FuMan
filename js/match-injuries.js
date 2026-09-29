// Match-Verletzungen
// Verletzungen während Spielen, Ausfallzeiten, Einsatz-Beschränkungen

let matchInjuriesState = {
    matchInjuryEvents: [], // Verletzungen die in diesem Match passiert sind
    playerUnavailable: [] // Spieler die aufgrund Verletzung nicht spielen können
};

function initializeMatchInjuries() {
    if (!game.matchInjuries) game.matchInjuries = {};
    if (!game.matchInjuries.matchInjuryEvents) game.matchInjuries.matchInjuryEvents = [];
    if (!game.matchInjuries.playerUnavailable) game.matchInjuries.playerUnavailable = [];
}

function checkMatchInjuries(playersInMatch) {
    initializeMatchInjuries();

    if (!playersInMatch || !Array.isArray(playersInMatch)) return;

    game.matchInjuries.matchInjuryEvents = [];

    playersInMatch.forEach(playerId => {
        let player = squad.find(p => p.id === playerId);
        if (!player) return;

        // Nur wenn Player nicht bereits verletzt
        let alreadyInjured = game.injuryManagement.injuredPlayers.find(inj => inj.playerId === playerId);
        if (alreadyInjured) return;

        let injuryRisk = getInjuryRisk(player);

        // Kleine Chance für Verletzung (5-20% basierend auf Risiko)
        if (Math.random() < injuryRisk * 0.5) { // 50% der Risiko-Wahrscheinlichkeit tritt während Match auf
            let injured = injureSquadPlayer(playerId);
            if (injured) {
                game.matchInjuries.matchInjuryEvents.push({
                    playerId: playerId,
                    playerName: player.name,
                    matchday: game.matchday,
                    timestamp: new Date().getTime()
                });
            }
        }
    });
}

function getPlayersUnavailableForNextMatch() {
    initializeMatchInjuries();
    initializeInjuryManagement();

    let unavailable = [];

    game.injuryManagement.injuredPlayers.forEach(injury => {
        if (injury.status === 'INJURED') {
            unavailable.push({
                playerId: injury.playerId,
                playerName: injury.playerName,
                returnMatchday: Math.ceil(injury.daysRecovered + injury.recoveryDaysNeeded),
                reason: `Verletzt: ${injury.injuryLabel}`
            });
        }
    });

    return unavailable;
}

function getPlayerFormAfterInjury(player) {
    if (!player) return 1.0;

    let injuryRecord = game.injuryManagement.injuryRecords[player.id];
    if (!injuryRecord || injuryRecord.totalInjuries === 0) return 1.0;

    // Jede Verletzung reduziert die Form um 5%
    let formPenalty = 1.0 - (injuryRecord.totalInjuries * 0.05);

    // Comeback-Risiken verschärfen die Form
    formPenalty -= (injuryRecord.comebackRisks * 0.03);

    return Math.max(0.70, formPenalty); // Minimum 70% Form
}

function adjustSquadAvailability() {
    initializeInjuryManagement();

    // Spieler mit Verletzungen können nicht automatisch in die Starting XI
    squad.forEach(player => {
        let injury = game.injuryManagement.injuredPlayers.find(inj => inj.playerId === player.id);
        if (injury) {
            // Form reduzieren, wenn verletzt
            if (injury.status === 'INJURED') {
                player.form = Math.max(0.5, (player.form || 1.0) - 0.3); // -30% Form
            } else if (injury.status === 'RECOVERING') {
                player.form = Math.max(0.7, (player.form || 1.0) - 0.2); // -20% Form
            }

            // Gesamtstärke-Malus
            let strengthPenalty = injury.status === 'INJURED' ? 0.4 : 0.2; // 40% oder 20% Malus
            player.strength = player.strength * (1 - strengthPenalty);
        } else {
            // Normale Stärke für nicht verletzte Spieler
            player.strength = player.strength || 70;
        }
    });
}

function renderMatchInjuriesNotification() {
    if (!game.matchInjuries || game.matchInjuries.matchInjuryEvents.length === 0) return;

    let injuryCount = game.matchInjuries.matchInjuryEvents.length;
    let injuryList = game.matchInjuries.matchInjuryEvents.map(e => e.playerName).join(', ');

    let message = `🚑 ${injuryCount} Spieler verletzt: ${injuryList}`;
    showToast(message, 'warning', 6000);
}

function tickMatchInjuries() {
    initializeMatchInjuries();

    // Vor jedem Match: verfügbare Spieler prüfen
    adjustSquadAvailability();
}
