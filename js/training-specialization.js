// Trainings-Spezialisierung
// Position-spezifische Trainings, Skill-Entwicklung

let trainingSpecializationState = {
    trainingPlans: {},
    skillDevelopment: [],
    specialistBonus: {}
};

const POSITION_SKILLS = {
    TOR: ['Reflexe', 'Flugparade', 'Herrschbereich'],
    AB: ['Kopfballspiel', 'Stellungsspiel', 'Zweikampf'],
    MF: ['Übersicht', 'Ballsicherung', 'Ausdauer'],
    ST: ['Torinstinkt', 'Ballkontrolle', 'Bewegungsläufe']
};

function initializeTrainingSpecialization() {
    if (!game.trainingSpecialization) game.trainingSpecialization = {};
    if (!game.trainingSpecialization.plans) game.trainingSpecialization.plans = {};
    if (!game.trainingSpecialization.skills) game.trainingSpecialization.skills = [];
}

function getPositionShorthand(pos) {
    if (!pos) return 'MF';
    if (pos === 'Torwart') return 'TOR';
    if (pos.startsWith('AB') || pos.startsWith('AB')) return 'AB';
    if (pos.startsWith('ST')) return 'ST';
    return 'MF';
}

function startPositionTraining(playerId, positionType) {
    let player = squad.find(p => p.id === playerId);
    if (!player || game.money < 3000) {
        showToast('💰 Nicht genug Geld!', 'error', 2000);
        return false;
    }

    game.money -= 3000;

    let posShort = getPositionShorthand(player.pos);
    let skills = POSITION_SKILLS[posShort] || ['Allgemein'];
    let randomSkill = skills[Math.floor(Math.random() * skills.length)];

    if (!game.trainingSpecialization.plans[playerId]) {
        game.trainingSpecialization.plans[playerId] = [];
    }

    game.trainingSpecialization.plans[playerId].push({
        skill: randomSkill,
        progress: 0,
        daysRemaining: 7,
        startMatchday: game.matchday
    });

    showToast(`📚 ${player.name} trainiert: ${randomSkill} (+7 Tage)`, 'success', 3000);
    return true;
}

function completeSkillTraining(playerId, skillIndex) {
    initializeTrainingSpecialization();

    let plans = game.trainingSpecialization.plans[playerId];
    if (!plans || !plans[skillIndex]) return false;

    let skill = plans[skillIndex];
    let player = squad.find(p => p.id === playerId);
    if (!player) return false;

    // Attribut erhöhen basierend auf Skill
    if (skill.skill === 'Reflexe' || skill.skill === 'Flugparade') {
        player.defense = Math.min(99, (player.defense || 60) + 3);
    } else if (skill.skill === 'Kopfballspiel' || skill.skill === 'Stellungsspiel') {
        player.defense = Math.min(99, (player.defense || 60) + 2);
    } else if (skill.skill === 'Torinstinkt') {
        player.shooting = Math.min(99, (player.shooting || 60) + 3);
    } else if (skill.skill === 'Übersicht' || skill.skill === 'Ballsicherung') {
        player.passing = Math.min(99, (player.passing || 60) + 3);
    }

    game.trainingSpecialization.skills.push({
        playerId: playerId,
        playerName: player.name,
        skill: skill.skill,
        completedMatchday: game.matchday,
        timestamp: new Date().getTime()
    });

    plans.splice(skillIndex, 1);

    showToast(`⭐ ${player.name} hat ${skill.skill} gelernt!`, 'success', 4000);
    return true;
}

function tickTrainingSpecialization() {
    initializeTrainingSpecialization();

    // Skill-Training Fortschritt
    Object.keys(game.trainingSpecialization.plans).forEach(playerId => {
        let plans = game.trainingSpecialization.plans[playerId];
        plans.forEach((plan, idx) => {
            plan.daysRemaining--;
            if (plan.daysRemaining <= 0) {
                completeSkillTraining(playerId, idx);
            }
        });
    });
}

function renderTrainingSpecializationPanel() {
    const container = document.getElementById('training-specialization-box');
    if (!container) return;

    initializeTrainingSpecialization();

    let html = '<div class="panel-content">';
    html += '<h3>📚 TRAININGS-SPEZIALISIERUNG</h3>';

    let activeTrainings = 0;
    squad.slice(0, 5).forEach(player => {
        let plans = game.trainingSpecialization.plans[player.id];
        if (plans && plans.length > 0) {
            activeTrainings += plans.length;
            plans.forEach(plan => {
                html += `<div style="background:#1a1a1a; padding:6px; border-radius:3px; margin-bottom:4px;">`;
                html += `<p style="font-size:9px; margin:0;"><strong>${player.name}:</strong> ${plan.skill}</p>`;
                html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Tag ${7 - plan.daysRemaining}/7</p>`;
                html += `</div>`;
            });
        }
    });

    if (activeTrainings === 0) {
        html += '<p style="font-size:9px; color:var(--text-muted); margin:0;">Keine aktiven Trainings.</p>';
        html += '<button onclick="startPositionTraining(squad[0].id, \'auto\')" class="btn-secondary" style="width:auto; font-size:8px; padding:3px 8px; margin-top:6px;">Training starten (+3000€)</button>';
    }

    html += '</div>';
    container.innerHTML = html;
}
