// Crisis Management System
// Handles unexpected events, scandals, and crisis situations

let crisisManagementState = {
    activeCrises: [],
    crisisHistory: [],
    crisisResolution: {}
};

const CRISIS_TYPES = {
    PLAYER_SCANDAL: {
        name: 'Spieler-Skandal',
        probability: 0.08,
        moraleMalus: -15,
        reputationDamage: -10,
        resolution: ['Suspendierung', 'Geldstrafe', 'Verwarnung'],
        cost: { min: 5000, max: 25000 }
    },
    FINANCIAL_CRISIS: {
        name: 'Finanzielle Schwierigkeiten',
        probability: 0.05,
        moneyDamage: { min: 50000, max: 150000 },
        reputationDamage: -5,
        resolution: ['Sponsoring-Suche', 'Spielerverkauf', 'Investoren-Deal'],
        cost: { min: 0, max: 20000 }
    },
    STADIUM_DAMAGE: {
        name: 'Stadionbeschädigung',
        probability: 0.03,
        capacityLoss: { min: 2000, max: 5000 },
        reputationDamage: -8,
        resolution: ['Reparatur', 'Umzug', 'Versicherung'],
        cost: { min: 30000, max: 80000 }
    },
    FAN_VIOLENCE: {
        name: 'Fan-Gewalt',
        probability: 0.06,
        reputationDamage: -12,
        banGames: { min: 1, max: 3 },
        resolution: ['Sicherheit erhöhen', 'Fan-Engagement', 'Bestrafung'],
        cost: { min: 10000, max: 30000 }
    },
    MANAGER_CONFLICT: {
        name: 'Trainer-Konflikt',
        probability: 0.04,
        moraleMalus: -20,
        reputationDamage: -8,
        resolution: ['Verhandlung', 'Freistellung', 'Mediation'],
        cost: { min: 0, max: 15000 }
    },
    INJURY_CRISIS: {
        name: 'Verletzungs-Krise',
        probability: 0.07,
        injuredPlayers: { min: 2, max: 4 },
        reputationDamage: -3,
        resolution: ['Ärztliche Versorgung', 'Leihspieler', 'Notprodukt'],
        cost: { min: 20000, max: 50000 }
    },
    MEDIA_OUTRAGE: {
        name: 'Medien-Skandal',
        probability: 0.09,
        reputationDamage: -15,
        resolution: ['Statement abgeben', 'Taten sprechen lassen', 'Ignorieren'],
        cost: { min: 0, max: 10000 }
    },
    TRANSFER_DRAMA: {
        name: 'Transfer-Drama',
        probability: 0.06,
        playerMoraleMalus: -10,
        reputationDamage: -5,
        resolution: ['Spieler halten', 'Verkaufen', 'Verhandlung'],
        cost: { min: 0, max: 5000 }
    }
};

function initializeCrisisManagement() {
    if (!game.crises) game.crises = {};
    if (!game.crises.activeCrises) game.crises.activeCrises = [];
    if (!game.crises.crisisHistory) game.crises.crisisHistory = [];
    if (!game.crises.reputationScore) game.crises.reputationScore = 50;
}

function generateRandomCrisis() {
    const crisisTypes = Object.keys(CRISIS_TYPES);
    const selectedType = crisisTypes[Math.floor(Math.random() * crisisTypes.length)];
    const crisisConfig = CRISIS_TYPES[selectedType];

    if (Math.random() > crisisConfig.probability) {
        return null; // Crisis doesn't happen this matchday
    }

    const crisis = {
        id: `crisis_${selectedType}_${Date.now()}`,
        type: selectedType,
        name: crisisConfig.name,
        startMatchday: game.matchday || 1,
        status: 'active',
        severity: Math.floor(Math.random() * 3) + 1, // 1-3
        description: generateCrisisDescription(selectedType),
        affectedPlayer: selectedType === 'PLAYER_SCANDAL' || selectedType === 'TRANSFER_DRAMA'
            ? squad[Math.floor(Math.random() * squad.length)].id
            : null,
        reputationDamage: crisisConfig.reputationDamage,
        availableResolutions: crisisConfig.resolution
    };

    applyCrisisEffects(crisis);

    if (!game.crises.activeCrises) game.crises.activeCrises = [];
    game.crises.activeCrises.push(crisis);

    return crisis;
}

function generateCrisisDescription(type) {
    const descriptions = {
        PLAYER_SCANDAL: [
            'Spieler in Skandal verwickelt',
            'Doping-Vorwürfe gegen Spieler',
            'Spieler in Nachtklub-Vorfall',
            'Aggressive Verhalten in der Öffentlichkeit'
        ],
        FINANCIAL_CRISIS: [
            'Finanzielle Schwierigkeiten entstanden',
            'Großer Sponsor zieht sich zurück',
            'Bankrott-Gerüchte im Umlauf',
            'Zahlungsausfälle drohen'
        ],
        STADIUM_DAMAGE: [
            'Dach des Stadions beschädigt',
            'Tribüne einsturzgefährdet',
            'Brand im Stadion',
            'Wasserschaden im Stadion'
        ],
        FAN_VIOLENCE: [
            'Fan-Ausschreitungen nach Spiel',
            'Derby-Gewalt zwischen Anhängern',
            'Vandalismus im Stadion',
            'Schlägerei auf der Straße'
        ],
        MANAGER_CONFLICT: [
            'Spannungen mit Trainer',
            'Trainer will kündigen',
            'Konflikt mit Management',
            'Trainer-Spieler Dissonanz'
        ],
        INJURY_CRISIS: [
            'Plötzliche Verletzungswelle',
            'Mehrere Spieler verletzt',
            'Epidemie von Verletzungen',
            'Virus befällt Mannschaft'
        ],
        MEDIA_OUTRAGE: [
            'Negative Berichterstattung',
            'Kritik in Medien',
            'Presse fordert Veränderungen',
            'Online-Shitstorm'
        ],
        TRANSFER_DRAMA: [
            'Star-Spieler will weg',
            'Transfer-Gerüchte',
            'Spieler fordert Verkauf',
            'Agent verursacht Drama'
        ]
    };

    const descs = descriptions[type] || ['Unbekannte Krise'];
    return descs[Math.floor(Math.random() * descs.length)];
}

function applyCrisisEffects(crisis) {
    const config = CRISIS_TYPES[crisis.type];

    // Reputation damage
    if (game.crises.reputationScore !== undefined) {
        game.crises.reputationScore = Math.max(0, game.crises.reputationScore + config.reputationDamage);
    }

    // Morale damage
    if (config.moraleMalus) {
        squad.forEach(p => {
            p.morale = Math.max(0, p.morale + config.moraleMalus * 0.5);
        });
    }

    // Financial damage
    if (config.moneyDamage) {
        const damage = config.moneyDamage.min + Math.random() * (config.moneyDamage.max - config.moneyDamage.min);
        game.money -= damage;
        recordFinancialEvent('Krise-Kosten', -damage, 'Crisis');
    }

    // Stadium capacity damage
    if (config.capacityLoss) {
        if (game.stadium) {
            const loss = config.capacityLoss.min + Math.random() * (config.capacityLoss.max - config.capacityLoss.min);
            game.stadium.capacity = Math.max(5000, game.stadium.capacity - loss);
        }
    }

    // Player injuries (for injury crisis)
    if (crisis.type === 'INJURY_CRISIS' && config.injuredPlayers) {
        const numInuries = config.injuredPlayers.min + Math.floor(Math.random() * (config.injuredPlayers.max - config.injuredPlayers.min + 1));
        for (let i = 0; i < numInuries && i < squad.length; i++) {
            const player = squad[Math.floor(Math.random() * squad.length)];
            if (typeof injurePlayerByEvent === 'function') injurePlayerByEvent(player, 'Verletzungskrise');
        }
    }

    // Show notification
    showToast(`⚠️ KRISE: ${crisis.name} - ${crisis.description}`, 'error', 8000);
}

function resolveCrisis(crisisId, resolutionStrategy) {
    const crisis = game.crises.activeCrises.find(c => c.id === crisisId);
    if (!crisis) return false;

    const config = CRISIS_TYPES[crisis.type];
    const cost = config.cost.min + Math.random() * (config.cost.max - config.cost.min);

    // Success chance based on strategy and reputation
    const baseSuccessChance = 0.6;
    const reputationBonus = (game.crises.reputationScore || 50) / 100;
    const successChance = baseSuccessChance + reputationBonus * 0.2;

    const resolved = Math.random() < successChance;

    if (resolved) {
        crisis.status = 'resolved';
        game.crises.reputationScore = Math.min(100, (game.crises.reputationScore || 50) + 5);
        showToast(`✅ Krise gelöst: ${crisis.name}`, 'success', 5000);
    } else {
        crisis.status = 'escalated';
        game.crises.reputationScore = Math.max(0, (game.crises.reputationScore || 50) - 10);
        showToast(`❌ Krise eskaliert: ${crisis.name}`, 'error', 5000);
    }

    if (game.money >= cost) {
        game.money -= cost;
        recordFinancialEvent('Krisen-Lösung', -cost, 'Crisis Resolution');
    }

    return resolved;
}

function tickCrisisEvents() {
    // 5% Chance to generate new crisis every matchday
    if (Math.random() < 0.05) {
        generateRandomCrisis();
    }

    // Remove resolved crises after 3 matchdays
    if (game.crises.activeCrises) {
        game.crises.activeCrises = game.crises.activeCrises.filter(c => {
            if (c.status === 'resolved' && ((game.matchday || 1) - c.startMatchday) > 3) {
                if (!game.crises.crisisHistory) game.crises.crisisHistory = [];
                game.crises.crisisHistory.push(c);
                return false;
            }
            return true;
        });
    }
}

function getCrisisStatus() {
    if (!game.crises.activeCrises) return [];

    return game.crises.activeCrises.map(crisis => ({
        ...crisis,
        daysSinceStart: (game.matchday || 1) - crisis.startMatchday,
        severity: crisis.severity
    }));
}

function renderCrisisManagementPanel() {
    const container = document.getElementById('crisis-management-box');
    if (!container) return;

    initializeCrisisManagement();

    let html = '<div class="panel-content">';
    html += '<h3>Krisen-Management</h3>';

    // Reputation Score
    const reputation = game.crises.reputationScore || 50;
    const reputationColor = reputation > 70 ? 'green' : reputation > 40 ? 'yellow' : 'red';
    html += '<div style="margin-bottom:10px;">';
    html += `<p><strong>Ruf-Index:</strong> <span style="color:${reputationColor};">${reputation}/100</span></p>`;
    html += `<div style="width:100%; height:12px; background:#333; border-radius:4px; overflow:hidden;">`;
    html += `<div style="width:${reputation}%; height:100%; background:${reputationColor};"></div>`;
    html += `</div></div>`;

    // Active Crises
    if (game.crises.activeCrises && game.crises.activeCrises.length > 0) {
        html += '<div class="active-crises">';
        html += '<h4>⚠️ Aktive Krisen (' + game.crises.activeCrises.filter(c => c.status === 'active').length + ')</h4>';

        game.crises.activeCrises.filter(c => c.status === 'active').forEach(crisis => {
            const severity = crisis.severity === 3 ? '🔴' : crisis.severity === 2 ? '🟠' : '🟡';
            html += `<div style="background:#222; padding:8px; margin-bottom:6px; border-left:3px solid ${crisis.severity === 3 ? '#ff4d4d' : '#ff8c42'};border-radius:4px;">`;
            html += `<p><strong>${severity} ${crisis.name}</strong></p>`;
            html += `<p style="font-size:9px; color:#aaa;">${crisis.description}</p>`;
            html += `<div style="display:flex; gap:6px; flex-wrap:wrap;">`;

            crisis.availableResolutions.forEach(resolution => {
                html += `<button onclick="resolveCrisis('${crisis.id}', '${resolution}')" class="btn-secondary" style="font-size:8px; padding:4px 8px;">
                            ${resolution} [${crisis.severity * 2}k€]
                        </button>`;
            });

            html += `</div></div>`;
        });

        html += '</div>';
    } else {
        html += '<p style="color:#888;">Keine aktiven Krisen</p>';
    }

    // Crisis History
    if (game.crises.crisisHistory && game.crises.crisisHistory.length > 0) {
        html += '<div class="crisis-history" style="margin-top:10px;">';
        html += '<h4>📋 Krisen-Verlauf (' + game.crises.crisisHistory.length + ')</h4>';
        html += '<ul style="font-size:9px; max-height:120px; overflow-y:auto;">';

        game.crises.crisisHistory.slice(-5).reverse().forEach(crisis => {
            const statusEmoji = crisis.status === 'resolved' ? '✅' : '❌';
            html += `<li>${statusEmoji} ${crisis.name} (MD ${crisis.startMatchday})</li>`;
        });

        html += '</ul>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
