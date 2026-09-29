// Training Schedule System
// Allows manager to customize weekly training plan with focus areas and recovery days

let trainingScheduleState = {
    weeklyPlan: [],
    trainingHistory: [],
    playerFitness: {}
};

const TRAINING_TYPES = {
    RECOVERY: { name: 'Erholungstag', fitnessModifier: 0.1, injuryReduction: 0.15, cost: 5000 },
    STANDARD: { name: 'Standardtraining', fitnessModifier: 0.3, injuryReduction: 0.05, cost: 8000 },
    INTENSIVE: { name: 'Intensives Training', fitnessModifier: 0.5, injuryReduction: -0.1, cost: 12000 },
    TACTICAL: { name: 'Taktisches Training', fitnessModifier: 0.25, injuryReduction: 0.08, cost: 10000 },
    SET_PIECES: { name: 'Standardsituationen', fitnessModifier: 0.2, injuryReduction: 0.05, cost: 9000 },
    RECOVERY_FOCUS: { name: 'Regenerationsfokus', fitnessModifier: 0.05, injuryReduction: 0.25, cost: 7000 }
};

const FOCUS_AREAS = [
    'Ballkontrolle',
    'Defensive',
    'Set-Pieces',
    'Pressing',
    'Transition',
    'Flankenspiel'
];

function initializeTrainingSchedule() {
    if (!game.trainingSchedule) game.trainingSchedule = {};
    if (!game.trainingSchedule.weeklyPlans) game.trainingSchedule.weeklyPlans = [];
    if (!game.trainingSchedule.currentWeek) game.trainingSchedule.currentWeek = 1;
    if (!game.trainingSchedule.playerFitness) game.trainingSchedule.playerFitness = {};

    // Initialize player fitness levels
    squad.forEach(player => {
        if (!game.trainingSchedule.playerFitness[player.id]) {
            game.trainingSchedule.playerFitness[player.id] = {
                playerId: player.id,
                playerName: player.name,
                fitnessLevel: 80 + Math.random() * 20, // 80-100
                fatigueLevel: 20 + Math.random() * 10, // 20-30
                recoveryDaysNeeded: 0
            };
        }
    });
}

function createWeeklyTrainingPlan(matchday) {
    const plan = {
        id: `plan_${matchday}_${Date.now()}`,
        startMatchday: matchday,
        days: []
    };

    // Default: 6-day training week with 1 recovery day
    for (let i = 0; i < 6; i++) {
        plan.days.push({
            dayNumber: i + 1,
            trainingType: i === 5 ? 'RECOVERY' : 'STANDARD',
            focusArea: FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)],
            playerGrouping: 'full', // full, starters, reserves, injured
            cost: TRAINING_TYPES.STANDARD.cost
        });
    }

    return plan;
}

function customizeTrainingDay(matchday, dayNumber, trainingType, focusArea) {
    let plan = game.trainingSchedule.weeklyPlans.find(p => p.startMatchday === matchday);

    if (!plan) {
        plan = createWeeklyTrainingPlan(matchday);
        game.trainingSchedule.weeklyPlans.push(plan);
    }

    if (dayNumber >= 1 && dayNumber <= 6) {
        plan.days[dayNumber - 1].trainingType = trainingType;
        plan.days[dayNumber - 1].focusArea = focusArea;
        plan.days[dayNumber - 1].cost = TRAINING_TYPES[trainingType].cost;
    }

    return plan;
}

function applyTrainingEffects(matchday) {
    const plan = game.trainingSchedule.weeklyPlans.find(p => p.startMatchday === matchday);
    if (!plan) return;

    let totalTrainingCost = 0;

    squad.forEach(player => {
        const fitness = game.trainingSchedule.playerFitness[player.id];
        if (!fitness) return;

        let fitnessGain = 0;
        let injuryRiskReduction = 0;

        // Apply training effects from all 6 training days
        plan.days.forEach(day => {
            const trainingConfig = TRAINING_TYPES[day.trainingType];
            if (trainingConfig) {
                fitnessGain += trainingConfig.fitnessModifier;
                injuryRiskReduction += trainingConfig.injuryReduction;
            }
        });

        // Apply focused training benefit
        if (fitness.specialFocus) {
            fitnessGain *= 1.1; // 10% bonus if training matches player's specialization
        }

        // Update player fitness
        fitness.fitnessLevel = Math.min(100, fitness.fitnessLevel + fitnessGain);
        fitness.fatigueLevel = Math.max(0, fitness.fatigueLevel - (fitnessGain * 0.5));

        // Injury risk reduction
        if (Math.random() < injuryRiskReduction) {
            // Training helps prevent injury
            fitness.recoveryDaysNeeded = Math.max(0, fitness.recoveryDaysNeeded - 1);
        }

        // Apply fitness to player strength (temporary boost)
        const fitnessBoost = (fitness.fitnessLevel - 80) * 0.02; // Up to +0.4 strength at 100% fitness
        player.currentFitnessBoost = fitnessBoost;
    });

    // Deduct training costs
    plan.days.forEach(day => {
        totalTrainingCost += day.cost;
    });

    if (game.money >= totalTrainingCost) {
        game.money -= totalTrainingCost;
        recordFinancialEvent('Trainingskosten', -totalTrainingCost, 'Training');
    }
}

function tickTrainingFatigue() {
    // Every matchday, increase fatigue if not recovering
    squad.forEach(player => {
        const fitness = game.trainingSchedule.playerFitness[player.id];
        if (!fitness) return;

        // Match play increases fatigue
        fitness.fatigueLevel = Math.min(100, fitness.fatigueLevel + 15);

        // High fatigue reduces fitness
        if (fitness.fatigueLevel > 80) {
            fitness.fitnessLevel = Math.max(40, fitness.fitnessLevel - 2);
        }
    });
}

function getPlayerFitnessStatus(playerId) {
    const fitness = game.trainingSchedule.playerFitness[playerId];
    if (!fitness) return null;

    let status = 'Topform';
    if (fitness.fitnessLevel < 60) status = 'Schwach';
    else if (fitness.fitnessLevel < 75) status = 'Beeinträchtigt';
    else if (fitness.fitnessLevel < 90) status = 'Normal';
    else if (fitness.fatigueLevel > 70) status = 'Ermüdet';

    return {
        ...fitness,
        status: status,
        fitnessPercentage: Math.floor(fitness.fitnessLevel),
        fatiguePercentage: Math.floor(fitness.fatigueLevel)
    };
}

function rotateSquad(matchday) {
    // Intelligente Rotation: Spieler mit hoher Fatigue bekommen Ruhe
    const fatigued = squad.filter(p => {
        const fitness = game.trainingSchedule.playerFitness[p.id];
        return fitness && fitness.fatigueLevel > 75;
    });

    return fatigued.map(p => ({
        playerId: p.id,
        playerName: p.name,
        reason: 'Hohe Fatigue',
        recommendedRestDays: Math.ceil(fatigued.find(f => f.id === p.id).fatigueLevel / 25)
    }));
}

function renderTrainingSchedulePanel() {
    const container = document.getElementById('training-schedule-box');
    if (!container) return;

    initializeTrainingSchedule();

    const currentMatchday = game.matchday || 1;
    const plan = game.trainingSchedule.weeklyPlans.find(p => p.startMatchday === currentMatchday) ||
                 createWeeklyTrainingPlan(currentMatchday);

    let html = '<div class="panel-content">';
    html += '<h3>Trainingsplanung</h3>';

    // Weekly Plan
    html += '<div class="training-week">';
    html += '<h4>Trainingsplan (Woche MD ' + currentMatchday + ')</h4>';
    html += '<table class="training-table" style="width:100%; font-size:9px;">';
    html += '<tr><th>Tag</th><th>Trainingsart</th><th>Fokus</th><th>Kosten</th></tr>';

    plan.days.forEach((day, idx) => {
        const config = TRAINING_TYPES[day.trainingType];
        html += `<tr>
                    <td>Tag ${day.dayNumber}</td>
                    <td>${config.name}</td>
                    <td>${day.focusArea}</td>
                    <td>€${day.cost.toLocaleString()}</td>
                </tr>`;
    });
    html += '</table>';

    const totalCost = plan.days.reduce((sum, d) => sum + d.cost, 0);
    html += `<p style="font-size:9px; margin-top:6px;"><strong>Wochenkosten:</strong> €${totalCost.toLocaleString()}</p>`;
    html += '</div>';

    // Fitness Status
    html += '<div class="fitness-status" style="margin-top:10px;">';
    html += '<h4>Spieler-Fitnessstatus</h4>';
    html += '<div style="max-height:200px; overflow-y:auto;">';

    squad.slice(0, 11).forEach(player => {
        const status = getPlayerFitnessStatus(player.id);
        if (status) {
            const fitnessColor = status.fitnessLevel > 90 ? 'green' :
                                status.fitnessLevel > 75 ? 'yellow' : 'red';
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px; border-bottom:1px solid var(--border);">
                        <span>${player.name}</span>
                        <span style="display:flex; gap:8px; font-size:8px;">
                            <span style="color:${fitnessColor};">Fitness: ${status.fitnessPercentage}%</span>
                            <span style="color:orange;">Fatigue: ${status.fatiguePercentage}%</span>
                        </span>
                    </div>`;
        }
    });

    html += '</div>';
    html += '</div>';

    // Training Type Legend
    html += '<div class="training-legend" style="margin-top:10px; font-size:8px;">';
    html += '<h4>Trainingsarten</h4>';
    Object.entries(TRAINING_TYPES).forEach(([key, config]) => {
        html += `<p><strong>${config.name}:</strong> Fitness +${Math.floor(config.fitnessModifier * 100)}%, Verletzungsschutz ${Math.floor(config.injuryReduction * 100)}%</p>`;
    });
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}
