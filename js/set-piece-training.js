// Set-Piece-Training
// Eck-Training, Elfmeter, Freistoß, Einwürfe

let setPieceTrainingState = {
    trainingPrograms: {
        corners: { level: 1, successRate: 0.45, trainingDays: 0, cost: 5000 },
        penalties: { level: 1, successRate: 0.65, trainingDays: 0, cost: 5000 },
        freeKicks: { level: 1, successRate: 0.35, trainingDays: 0, cost: 5000 },
        throwIns: { level: 1, successRate: 0.50, trainingDays: 0, cost: 5000 }
    },
    trainingHistory: [],
    matchBonus: { corners: 0, penalties: 0, freeKicks: 0, throwIns: 0 }
};

function initializeSetPieceTraining() {
    if (!game.setPieceTraining) game.setPieceTraining = {};
    if (!game.setPieceTraining.programs) game.setPieceTraining.programs = {
        corners: { level: 1, successRate: 0.45 },
        penalties: { level: 1, successRate: 0.65 },
        freeKicks: { level: 1, successRate: 0.35 },
        throwIns: { level: 1, successRate: 0.50 }
    };
    if (!game.setPieceTraining.history) game.setPieceTraining.history = [];
}

function startSetPieceTraining(type) {
    if (game.money < 5000) {
        showToast('💰 Nicht genug Geld für Set-Piece-Training!', 'error', 3000);
        return false;
    }

    game.money -= 5000;

    if (!game.setPieceTraining.programs[type]) return false;

    let program = game.setPieceTraining.programs[type];
    program.trainingDays = program.trainingDays || 0;
    program.trainingDays += 5; // 5 Tage Training

    showToast(`⚽ ${type.toUpperCase()}-Training gestartet! (+5 Tage)`, 'success', 3000);
    return true;
}

function completeSetPieceTraining(type) {
    initializeSetPieceTraining();

    let program = game.setPieceTraining.programs[type];
    if (!program || program.trainingDays <= 0) return false;

    program.level = Math.min(5, program.level + 1);

    // Success Rate basierend auf Level
    let baseRates = {
        corners: 0.35,
        penalties: 0.60,
        freeKicks: 0.25,
        throwIns: 0.45
    };

    program.successRate = Math.min(0.95, baseRates[type] + (program.level * 0.10));
    program.trainingDays = 0;

    game.setPieceTraining.history.push({
        type: type,
        newLevel: program.level,
        matchday: game.matchday,
        timestamp: new Date().getTime()
    });

    showToast(`⭐ ${type}: Level ${program.level}! Erfolgsrate: ${Math.round(program.successRate * 100)}%`, 'success', 4000);
    return true;
}

function getSetPieceBonus(type) {
    initializeSetPieceTraining();
    let program = game.setPieceTraining.programs[type];
    if (!program) return 0;

    // Bonus basierend auf Level: +5% pro Level
    return program.level * 0.05;
}

function tickSetPieceTraining() {
    initializeSetPieceTraining();

    // Jeden Trainingstag reduzieren
    Object.keys(game.setPieceTraining.programs).forEach(type => {
        let program = game.setPieceTraining.programs[type];
        if (program.trainingDays && program.trainingDays > 0) {
            program.trainingDays--;

            // Training abgeschlossen
            if (program.trainingDays === 0) {
                completeSetPieceTraining(type);
            }
        }
    });
}

function renderSetPieceTrainingPanel() {
    const container = document.getElementById('set-piece-training-box');
    if (!container) return;

    initializeSetPieceTraining();

    let html = '<div class="panel-content">';
    html += '<h3>⚽ SET-PIECE-TRAINING</h3>';

    let types = ['corners', 'penalties', 'freeKicks', 'throwIns'];
    let labels = ['Ecken', 'Elfmeter', 'Freistöße', 'Einwürfe'];

    types.forEach((type, idx) => {
        let program = game.setPieceTraining.programs[type];
        let label = labels[idx];
        let progress = Math.round((program.trainingDays / 5) * 100);

        html += `<div style="background:#1a1a1a; padding:6px; border-radius:3px; margin-bottom:6px;">`;
        html += `<div style="display:flex; justify-content:space-between; align-items:center;">`;
        html += `<span style="font-size:9px;"><strong>${label}</strong> | Level ${program.level}/5</span>`;
        html += `<span style="font-size:8px; color:var(--text-muted);">${Math.round(program.successRate * 100)}%</span>`;
        html += `</div>`;

        html += '<div style="background:#000; border-radius:2px; height:6px; margin:3px 0;">';
        html += `<div style="background:var(--primary); height:100%; width:${progress}%;"></div>`;
        html += '</div>';

        if (program.trainingDays === 0) {
            html += `<button onclick="startSetPieceTraining('${type}')" class="btn-secondary" style="width:auto; font-size:7px; padding:2px 6px;">Training starten (+5000€)</button>`;
        } else {
            html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Tag ${5 - program.trainingDays}/5</p>`;
        }

        html += `</div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}
