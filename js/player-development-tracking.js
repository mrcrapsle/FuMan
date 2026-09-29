// Player Development Tracking System
// Tracks career progression, potential decay, and specialization

let playerDevelopmentState = {
    playerDevelopment: {},
    developmentHistory: [],
    careerMilestones: []
};

const SPECIALIZATIONS = [
    { name: 'Torschuss', attribute: 'shooting', maxBonus: 15 },
    { name: 'Passspiel', attribute: 'passing', maxBonus: 15 },
    { name: 'Dribbeln', attribute: 'dribbling', maxBonus: 15 },
    { name: 'Verteidigung', attribute: 'defense', maxBonus: 15 },
    { name: 'Kopfballspiel', attribute: 'heading', maxBonus: 15 },
    { name: 'Athletik', attribute: 'athleticism', maxBonus: 10 }
];

const CAREER_STAGES = {
    PROSPECT: { name: 'Hoffnung', ageRange: [16, 20], potentialGrowth: 0.3 },
    YOUNGSTER: { name: 'Aufstrebender', ageRange: [21, 25], potentialGrowth: 0.15 },
    PRIME: { name: 'Spieler im besten Alter', ageRange: [26, 32], potentialGrowth: 0 },
    VETERAN: { name: 'Veteran', ageRange: [33, 38], potentialGrowth: -0.1 },
    DECLINING: { name: 'Auslaufend', ageRange: [39, 50], potentialGrowth: -0.3 }
};

function initializePlayerDevelopment() {
    if (!game.playerDevelopment) game.playerDevelopment = {};

    squad.forEach(player => {
        if (!game.playerDevelopment[player.id]) {
            game.playerDevelopment[player.id] = {
                playerId: player.id,
                playerName: player.name,
                position: player.position,
                joinedMatchday: player.joinedMatchday || 1,
                joinedAge: player.age || 25,
                startingStrength: player.strength,
                currentStrength: player.strength,
                potential: calculateInitialPotential(player),
                careerStage: getCareerStage(player.age || 25),
                specialization: null,
                matchesPlayed: 0,
                goals: 0,
                appearances: 0,
                minutesPlayed: 0,
                development: [],
                milestones: []
            };
        }
    });
}

function calculateInitialPotential(player) {
    const baseAge = 25;
    const ageOffset = (player.age || 25) - baseAge;
    const agePotential = Math.max(50, 100 - Math.abs(ageOffset) * 3);

    // Potential starts at player's current strength + room to grow
    return player.strength + (agePotential / 10);
}

function getCareerStage(age) {
    for (const [key, stage] of Object.entries(CAREER_STAGES)) {
        if (age >= stage.ageRange[0] && age <= stage.ageRange[1]) {
            return key;
        }
    }
    return 'PROSPECT';
}

function setPlayerSpecialization(playerId, specializationName) {
    const dev = game.playerDevelopment[playerId];
    if (!dev) return false;

    const spec = SPECIALIZATIONS.find(s => s.name === specializationName);
    if (!spec) return false;

    dev.specialization = spec.name;

    // Add specialization bonus to current strength
    const player = squad.find(p => p.id === playerId);
    if (player) {
        player[spec.attribute] = Math.min(100, (player[spec.attribute] || 60) + 5);
    }

    return true;
}

function trackPlayerPerformance(playerId, goals, minutes) {
    const dev = game.playerDevelopment[playerId];
    if (!dev) return;

    const player = squad.find(p => p.id === playerId);
    if (!player) return;

    dev.matchesPlayed++;
    dev.goals += goals;
    dev.minutesPlayed += minutes;
    dev.appearances++;

    // Development bonus based on playing time
    let developmentGain = 0;
    if (minutes >= 45) {
        developmentGain = 0.5; // Full match
    } else if (minutes >= 15) {
        developmentGain = 0.2; // Decent time
    } else if (minutes > 0) {
        developmentGain = 0.05; // Brief appearance
    }

    // Young players develop faster
    const careerStage = CAREER_STAGES[dev.careerStage];
    if (careerStage) {
        developmentGain *= (1 + careerStage.potentialGrowth);
    }

    // Specialization bonus
    if (dev.specialization) {
        developmentGain *= 1.15;
    }

    dev.development.push({
        matchday: game.matchday || 1,
        goals: goals,
        minutes: minutes,
        developmentGain: developmentGain
    });
}

function tickPlayerAging() {
    const currentMatchday = game.matchday || 1;
    const matchdaysPerSeason = 34;

    squad.forEach(player => {
        const dev = game.playerDevelopment[player.id];
        if (!dev) return;

        const seasonsPassed = (currentMatchday - dev.joinedMatchday) / matchdaysPerSeason;
        const agingFactor = 0.5; // 0.5 years per season

        // Age player gradually
        player.age = dev.joinedAge + (seasonsPassed * agingFactor);

        // Update career stage
        dev.careerStage = getCareerStage(player.age);

        // Apply potential decay for older players
        if (player.age > 27) {
            const decayRate = 0.02 * (player.age - 27);
            player.strength = Math.max(30, player.strength - decayRate);
        }

        // Young players without playing time lose potential
        if (player.age < 23 && dev.matchesPlayed < 5) {
            const inactivityPenalty = 0.1;
            dev.potential = Math.max(50, dev.potential - inactivityPenalty);
        }

        dev.currentStrength = player.strength;
    });
}

function calculateCareerValue(playerId) {
    const dev = game.playerDevelopment[playerId];
    if (!dev) return 0;

    const player = squad.find(p => p.id === playerId);
    if (!player) return 0;

    let value = player.strength * 50000; // Base value

    // Experience bonus
    value += dev.matchesPlayed * 500;
    value += dev.goals * 1000;

    // Youth potential bonus
    if (player.age < 25) {
        const potentialMultiplier = 1 + ((dev.potential - player.strength) / 50) * 0.5;
        value *= potentialMultiplier;
    }

    // Specialization bonus
    if (dev.specialization) {
        value *= 1.2;
    }

    // Aging penalty
    if (player.age > 30) {
        const agePenalty = 1 - ((player.age - 30) * 0.05);
        value *= Math.max(0.1, agePenalty);
    }

    return Math.floor(value);
}

function getPlayerDevelopmentSummary(playerId) {
    const dev = game.playerDevelopment[playerId];
    if (!dev) return null;

    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    const careerStage = CAREER_STAGES[dev.careerStage];
    const strengthGain = dev.currentStrength - dev.startingStrength;
    const averagePerformance = dev.goals / Math.max(1, dev.matchesPlayed);

    return {
        playerName: dev.playerName,
        position: dev.position,
        age: Math.floor(player.age),
        careerStage: careerStage.name,
        currentStrength: dev.currentStrength,
        potentialStrength: dev.potential,
        strengthGain: strengthGain,
        specialization: dev.specialization || 'Keine',
        matchesPlayed: dev.matchesPlayed,
        goals: dev.goals,
        averageGoalsPerMatch: averagePerformance.toFixed(2),
        marketValue: calculateCareerValue(playerId)
    };
}

function recordCareerMilestone(playerId, milestone) {
    const dev = game.playerDevelopment[playerId];
    if (!dev) return;

    dev.milestones.push({
        matchday: game.matchday || 1,
        milestone: milestone,
        value: null
    });
}

function renderPlayerDevelopmentPanel() {
    const container = document.getElementById('player-development-box');
    if (!container) return;

    initializePlayerDevelopment();

    let html = '<div class="panel-content">';
    html += '<h3>Spieler-Entwicklung & Karriere</h3>';

    // Development Comparison
    html += '<div class="development-overview">';
    html += '<h4>📊 Entwicklungs-Übersicht</h4>';
    html += '<table class="development-table" style="width:100%; font-size:9px;">';
    html += '<tr><th>Spieler</th><th>Alter</th><th>Stadium</th><th>Stärke</th><th>Entwicklung</th><th>Spiele</th><th>Marktwert</th></tr>';

    squad.slice(0, 11).forEach(player => {
        const dev = game.playerDevelopment[player.id];
        if (!dev) return;

        const summary = getPlayerDevelopmentSummary(player.id);
        const strengthChangeColor = summary.strengthGain > 0 ? 'green' : summary.strengthGain < 0 ? 'red' : 'white';
        const developmentBar = (summary.currentStrength / summary.potentialStrength * 100).toFixed(0);

        html += `<tr>
                    <td>${summary.playerName}</td>
                    <td>${summary.age}</td>
                    <td>${summary.careerStage}</td>
                    <td>${summary.currentStrength}/${summary.potentialStrength}</td>
                    <td><div style="width:60px; height:8px; background:#333; border-radius:2px; overflow:hidden;">
                        <div style="width:${developmentBar}%; height:100%; background:${strengthChangeColor};"></div>
                    </div></td>
                    <td>${summary.matchesPlayed}</td>
                    <td>€${(summary.marketValue / 1000).toFixed(0)}k</td>
                </tr>`;
    });

    html += '</table>';
    html += '</div>';

    // Specializations
    html += '<div class="specializations" style="margin-top:10px;">';
    html += '<h4>🎯 Spezialisierungen</h4>';
    html += '<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px;">';

    SPECIALIZATIONS.forEach(spec => {
        const players = squad.filter(p => {
            const dev = game.playerDevelopment[p.id];
            return dev && dev.specialization === spec.name;
        });

        html += `<div style="background:#222; padding:6px; border-radius:4px; border-left:3px solid var(--accent);">`;
        html += `<p style="margin:0; font-weight:bold; font-size:10px;">${spec.name}</p>`;
        html += `<p style="margin:2px 0; font-size:9px; color:#aaa;">${players.length} Spieler</p>`;
        html += `</div>`;
    });

    html += '</div>';
    html += '</div>';

    // Career Stages Distribution
    html += '<div class="career-stages" style="margin-top:10px;">';
    html += '<h4>📈 Alter-Verteilung</h4>';

    const stages = {};
    squad.forEach(player => {
        const dev = game.playerDevelopment[player.id];
        if (!dev) return;

        const stage = dev.careerStage;
        stages[stage] = (stages[stage] || 0) + 1;
    });

    Object.entries(stages).forEach(([stage, count]) => {
        const stageInfo = CAREER_STAGES[stage];
        html += `<p style="font-size:9px;"><strong>${stageInfo.name}:</strong> ${count} Spieler</p>`;
    });

    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}
