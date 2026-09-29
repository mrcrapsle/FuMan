// Contract Management System
// Handles player contracts, negotiations, renewals, and agent demands

let contractManagementState = {
    contracts: [],
    negotiations: [],
    contractHistory: []
};

const CONTRACT_STAGES = {
    NEGOTIATING: 'negotiating',
    ACTIVE: 'active',
    EXPIRING: 'expiring',
    EXPIRED: 'expired'
};

const NEGOTIATION_OUTCOMES = {
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    PENDING: 'pending'
};

function initializeContractManagement() {
    if (!game.contracts) game.contracts = [];
    if (!game.contractNegotiations) game.contractNegotiations = [];

    // Initialize contracts for all squad members
    squad.forEach(player => {
        if (!game.contracts.find(c => c.playerId === player.id)) {
            createPlayerContract(player);
        }
    });
}

function createPlayerContract(player) {
    const contractLength = Math.floor(Math.random() * 3) + 2; // 2-4 years
    const startMatchday = game.matchday || 1;
    const matchdaysPerSeason = 34;
    const endMatchday = startMatchday + (contractLength * matchdaysPerSeason);

    const baseSalary = calculateBaseSalary(player);

    const contract = {
        id: `contract_${player.id}_${Date.now()}`,
        playerId: player.id,
        playerName: player.name,
        playerPosition: player.position,
        playerStrength: player.strength,
        startMatchday: startMatchday,
        endMatchday: endMatchday,
        baseSalary: baseSalary,
        bonusPerGoal: Math.floor(baseSalary * 0.01),
        bonusPerCleanSheet: Math.floor(baseSalary * 0.005),
        agentFeePercentage: 5 + Math.random() * 5, // 5-10%
        status: CONTRACT_STAGES.ACTIVE,
        renewalOffered: false,
        negotiationStarted: false
    };

    game.contracts.push(contract);
    return contract;
}

function calculateBaseSalary(player) {
    const strengthFactor = player.strength / 100;
    const baseSalaryPerStrength = 500; // €500 per strength point
    let salary = player.strength * baseSalaryPerStrength;

    // Position modifier
    const positionModifier = {
        'ST': 1.2,
        'CM': 1.0,
        'LB': 0.9,
        'RB': 0.9,
        'CB': 0.95,
        'GK': 0.85
    };

    salary *= (positionModifier[player.position] || 1.0);

    return Math.floor(salary);
}

function tickContractExpirations() {
    const currentMatchday = game.matchday || 1;
    const matchdaysPerSeason = 34;

    game.contracts.forEach(contract => {
        const matchdaysRemaining = contract.endMatchday - currentMatchday;

        if (matchdaysRemaining <= 0) {
            contract.status = CONTRACT_STAGES.EXPIRED;
            // Player contract expired - remove from squad after season end
        } else if (matchdaysRemaining <= matchdaysPerSeason) {
            contract.status = CONTRACT_STAGES.EXPIRING;

            // Auto-offer renewal if not already offered
            if (!contract.renewalOffered) {
                offerContractRenewal(contract);
            }
        } else {
            contract.status = CONTRACT_STAGES.ACTIVE;
        }
    });
}

function offerContractRenewal(contract) {
    contract.renewalOffered = true;

    const renewalOffer = {
        id: `renewal_${contract.playerId}_${Date.now()}`,
        contractId: contract.id,
        playerId: contract.playerId,
        playerName: contract.playerName,
        originalSalary: contract.baseSalary,
        proposedSalary: Math.floor(contract.baseSalary * (1 + Math.random() * 0.15)), // +0-15%
        proposedDuration: 2 + Math.floor(Math.random() * 2), // 2-3 years
        agentDemand: Math.floor(contract.baseSalary * (0.1 + Math.random() * 0.2)), // 10-30% raise demand
        status: NEGOTIATION_OUTCOMES.PENDING,
        createdMatchday: game.matchday || 1
    };

    game.contractNegotiations.push(renewalOffer);
    return renewalOffer;
}

function negotiateContractRenewal(negotiationId, strategy) {
    const negotiation = game.contractNegotiations.find(n => n.id === negotiationId);
    if (!negotiation) return null;

    let successChance = 0.5;
    let finalSalary = negotiation.proposedSalary;

    if (strategy === 'generous') {
        // High success, but expensive
        successChance = 0.85;
        finalSalary = negotiation.originalSalary + negotiation.agentDemand;
    } else if (strategy === 'balanced') {
        // Medium success
        successChance = 0.60;
        finalSalary = negotiation.proposedSalary;
    } else if (strategy === 'firm') {
        // Lower success, cheaper
        successChance = 0.35;
        finalSalary = negotiation.originalSalary;
    }

    const negotiationSuccess = Math.random() < successChance;

    if (negotiationSuccess) {
        // Create new contract
        const contract = game.contracts.find(c => c.id === negotiation.contractId);
        if (contract) {
            const renewalLength = negotiation.proposedDuration;
            const currentMatchday = game.matchday || 1;
            const matchdaysPerSeason = 34;

            contract.endMatchday = currentMatchday + (renewalLength * matchdaysPerSeason);
            contract.baseSalary = finalSalary;
            contract.renewalOffered = false;
            contract.status = CONTRACT_STAGES.ACTIVE;
        }

        negotiation.status = NEGOTIATION_OUTCOMES.ACCEPTED;
        return { success: true, salary: finalSalary };
    } else {
        negotiation.status = NEGOTIATION_OUTCOMES.REJECTED;
        return { success: false };
    }
}

function terminateContract(playerId, buyoutPercentage = 50) {
    const contract = game.contracts.find(c => c.playerId === playerId);
    if (!contract) return null;

    const currentMatchday = game.matchday || 1;
    const matchdaysRemaining = Math.max(0, contract.endMatchday - currentMatchday);
    const remainingValue = contract.baseSalary * matchdaysRemaining;
    const buyoutCost = Math.floor(remainingValue * (buyoutPercentage / 100));

    if (game.money >= buyoutCost) {
        game.money -= buyoutCost;
        contract.status = CONTRACT_STAGES.EXPIRED;

        // Remove player from squad
        const playerIndex = squad.findIndex(p => p.id === playerId);
        if (playerIndex > -1) {
            const removed = squad[playerIndex];
            squad.splice(playerIndex, 1);
            recordFinancialEvent(`Vertrag beendet: ${removed.name}`, -buyoutCost, 'Contract Termination');
        }

        return { success: true, cost: buyoutCost };
    }

    return { success: false, cost: buyoutCost, reason: 'insufficient_funds' };
}

function tickContractWages() {
    let totalWages = 0;

    game.contracts.forEach(contract => {
        if (contract.status === CONTRACT_STAGES.ACTIVE) {
            totalWages += contract.baseSalary;
        }
    });

    return totalWages;
}

function getContractSummary(playerId) {
    const contract = game.contracts.find(c => c.playerId === playerId);
    if (!contract) return null;

    const currentMatchday = game.matchday || 1;
    const matchdaysRemaining = Math.max(0, contract.endMatchday - currentMatchday);
    const seasonsRemaining = (matchdaysRemaining / 34).toFixed(1);

    return {
        playerName: contract.playerName,
        salary: contract.baseSalary,
        endMatchday: contract.endMatchday,
        seasonsRemaining: seasonsRemaining,
        status: contract.status,
        agentFee: Math.floor(contract.baseSalary * (contract.agentFeePercentage / 100))
    };
}

function renderContractManagementPanel() {
    const container = document.getElementById('contract-management-box');
    if (!container) return;

    initializeContractManagement();

    const currentMatchday = game.matchday || 1;
    const matchdaysPerSeason = 34;

    let html = '<div class="panel-content">';
    html += '<h3>Vertragsmanagement</h3>';

    // Active Contracts Section
    html += '<div class="contract-section">';
    html += '<h4>Aktive Verträge (' + game.contracts.filter(c => c.status === CONTRACT_STAGES.ACTIVE).length + ')</h4>';
    html += '<table class="contracts-table">';
    html += '<tr><th>Spieler</th><th>Pos.</th><th>Gehalt</th><th>Läuft bis</th><th>Status</th></tr>';

    game.contracts.filter(c => c.status === CONTRACT_STAGES.ACTIVE).forEach(contract => {
        const seasonsRemaining = ((contract.endMatchday - currentMatchday) / matchdaysPerSeason).toFixed(1);
        html += `<tr>
                    <td>${contract.playerName}</td>
                    <td>${contract.playerPosition}</td>
                    <td>€${contract.baseSalary.toLocaleString()}</td>
                    <td>${seasonsRemaining}S</td>
                    <td><span class="status-active">Aktiv</span></td>
                </tr>`;
    });

    html += '</table>';
    html += '</div>';

    // Expiring Contracts Section
    if (game.contracts.filter(c => c.status === CONTRACT_STAGES.EXPIRING).length > 0) {
        html += '<div class="contract-section expiring">';
        html += '<h4>Auslaufende Verträge</h4>';
        html += '<table class="contracts-table">';
        html += '<tr><th>Spieler</th><th>Gehalt</th><th>Läuft aus</th><th>Action</th></tr>';

        game.contracts.filter(c => c.status === CONTRACT_STAGES.EXPIRING).forEach(contract => {
            const negotiation = game.contractNegotiations.find(n => n.contractId === contract.id);
            html += `<tr>
                        <td>${contract.playerName}</td>
                        <td>€${contract.baseSalary.toLocaleString()}</td>
                        <td>MD ${contract.endMatchday}</td>
                        <td>`;

            if (negotiation && negotiation.status === NEGOTIATION_OUTCOMES.PENDING) {
                html += `<button onclick="negotiateContractRenewal('${negotiation.id}', 'generous')">⬆️ Großzügig</button>
                        <button onclick="negotiateContractRenewal('${negotiation.id}', 'balanced')">→ Ausgewogen</button>
                        <button onclick="negotiateContractRenewal('${negotiation.id}', 'firm')">⬇️ Hart</button>`;
            } else {
                html += '<span>Verhandelt</span>';
            }

            html += `</td></tr>`;
        });

        html += '</table>';
        html += '</div>';
    }

    // Contract Stats
    const activeContracts = game.contracts.filter(c => c.status === CONTRACT_STAGES.ACTIVE);
    const totalMonthlyWages = activeContracts.reduce((sum, c) => sum + c.baseSalary, 0);

    html += '<div class="contract-stats">';
    html += `<p><strong>Gesamtgehalt pro Monat:</strong> €${totalMonthlyWages.toLocaleString()}</p>`;
    html += `<p><strong>Spieler unter Vertrag:</strong> ${activeContracts.length}</p>`;
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}
