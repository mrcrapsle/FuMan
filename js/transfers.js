// ==========================================
// SPIELERKAUF & VERKAUF - TRANSFERBUDGET
// ==========================================

function calcSquadPlayerValue(player) {
    if (!player) return 0;
    const rating = player.rating || 50;
    const age = player.age || 25;
    const ageAdj = 1.0 - ((age - 24) * 0.03);
    const baseVal = Math.pow(rating, 2.5) * 100;
    return Math.max(1000, Math.round(baseVal * ageAdj));
}

function generateTransferMarketPool() {
    if (!game) return;
    if (!game.transferMarketPlayers) game.transferMarketPlayers = [];
    game.transferMarketPlayers = [];
    const regions = ['Deutschland', 'Westeuropa', 'Südeuropa', 'Osteuropa', 'Südamerika', 'Afrika'];
    const positions = ['TW', 'AB', 'AB', 'MF', 'MF', 'ST'];
    const count = 15 + Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
        const baseRating = game.leagueLevel <= 2 ? 70 + Math.random() * 20 : 50 + Math.random() * 25;
        const player = {
            id: 'tmkt_' + Math.random().toString(36).substr(2, 9),
            name: getRandomName ? getRandomName() : 'Spieler ' + Math.floor(Math.random() * 10000),
            position: positions[Math.floor(Math.random() * positions.length)],
            rating: Math.round(baseRating),
            age: 18 + Math.floor(Math.random() * 15),
            region: regions[Math.floor(Math.random() * regions.length)],
            marketValue: 0
        };
        player.marketValue = calcSquadPlayerValue(player);
        game.transferMarketPlayers.push(player);
    }
}

function refreshTransferPoolIfNeeded() {
    if (game.matchday - game.transferLastRefreshMatchday >= 5 || game.transferMarketPlayers.length === 0) {
        generateTransferMarketPool();
        game.transferLastRefreshMatchday = game.matchday;
    }
}

function buyFromTransferMarket(marketPlayerId) {
    if (!game || !game.transferMarketPlayers) return { success: false, error: 'Markt nicht verfügbar.' };
    if (!marketPlayerId) return { success: false, error: 'Kein Spieler ausgewählt.' };

    const marketPlayer = game.transferMarketPlayers.find(p => p && p.id === marketPlayerId);
    if (!marketPlayer) return { success: false, error: 'Spieler nicht verfügbar.' };

    if (game.transferBudget - game.transferBudgetUsed < marketPlayer.marketValue) {
        return { success: false, error: 'Budget unzureichend.' };
    }

    const newPlayer = {
        id: 'p_' + Math.random().toString(36).substr(2, 9),
        name: marketPlayer.name,
        position: marketPlayer.position,
        rating: marketPlayer.rating,
        age: marketPlayer.age,
        potential: marketPlayer.rating + Math.floor(Math.random() * 8),
        mood: 70 + Math.floor(Math.random() * 20),
        fitness: 100,
        form: 0.8 + Math.random() * 0.4,
        injury: null,
        contract: 34,
        value: marketPlayer.marketValue,
        wage: Math.round(marketPlayer.marketValue / 2000),
        boughtForValue: marketPlayer.marketValue,
        boughtAtMatchday: game.matchday,
        transferHistory: [{
            type: 'bought',
            from: marketPlayer.region,
            fee: marketPlayer.marketValue,
            matchday: game.matchday
        }]
    };

    if (typeof squad !== 'undefined' && Array.isArray(squad)) {
        squad.push(newPlayer);
    }
    game.transferBudgetUsed += marketPlayer.marketValue;

    if (!Array.isArray(game.transferHistory)) game.transferHistory = [];
    game.transferHistory.push({
        type: 'buy',
        playerName: newPlayer.name,
        fee: marketPlayer.marketValue,
        matchday: game.matchday,
        fromRegion: marketPlayer.region
    });

    game.transferMarketPlayers = game.transferMarketPlayers.filter(p => p.id !== marketPlayerId);

    return { success: true, playerName: newPlayer.name, fee: marketPlayer.marketValue };
}

function sellToTransferMarket(playerId) {
    if (!playerId) return { success: false, error: 'Spieler nicht ausgewählt.' };

    const playerIdx = squad.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return { success: false, error: 'Im Kader nicht gefunden.' };

    const player = squad[playerIdx];
    const sellVal = Math.round(calcSquadPlayerValue(player) * 0.55);

    game.transferBudgetUsed = Math.max(0, game.transferBudgetUsed - (player.boughtForValue || 0));

    game.transferHistory.push({
        type: 'sell',
        playerName: player.name,
        fee: sellVal,
        matchday: game.matchday
    });

    squad.splice(playerIdx, 1);
    lineup = lineup.filter(p => p.id !== playerId);

    return { success: true, playerName: player.name, fee: sellVal };
}

function getTransferBudgetInfo() {
    const available = game.transferBudget - game.transferBudgetUsed;
    const usedPc = game.transferBudgetUsed / game.transferBudget * 100;
    return {
        total: game.transferBudget,
        used: game.transferBudgetUsed,
        available: available,
        usedPercent: Math.round(usedPc)
    };
}
