/* eslint-disable no-undef */
// Phase 23.9: Spieler-Positions-Trainer
// Trainiere Spieler in Alternativ-Positionen für mehr Flexibilität
// Ermöglicht schnellere Anpassung an neue Formationen

function ensurePositionTrainer() {
    if (!game.positionTrainer) {
        game.positionTrainer = {
            alternatePositions: {},
            trainingLog: []
        };
    }

    // Initialisiere jeden Spieler mit Position-Flexibilität
    squad.forEach(p => {
        if (!p.positionFlexibility) {
            p.positionFlexibility = {
                secondaryPositions: [],
                trainingProgress: {}
            };
        }
    });
}

// Definiert mögliche Alternative Positionen pro Haupt-Position
let POSITION_ALTERNATIVES = {
    'TW': [],  // Torwärter haben keine Alternativen
    'ABW': ['MIT'],  // Abwehr kann ins Mittelfeld
    'MIT': ['ABW', 'ST'],  // Mittelfeld kann zur Abwehr oder zum Sturm
    'ST': ['MIT']  // Sturm kann ins Mittelfeld
};

// Berechnet Schwierigkeit, eine neue Position zu trainieren
function getPositionTrainingDifficulty(fromPos, toPos) {
    if (fromPos === 'TW') return 999; // Torwärter können nicht umschulen
    if (fromPos === toPos) return 0;

    // Unterschied zwischen Positionen (Abwehr ↔ Mittelfeld: leicht, Sturm ↔ Abwehr: schwer)
    let posOrder = ['TW', 'ABW', 'MIT', 'ST'];
    let fromIdx = posOrder.indexOf(fromPos);
    let toIdx = posOrder.indexOf(toPos);
    let distance = Math.abs(fromIdx - toIdx);

    // Distance 1 = 15 Trainings-Sessions, Distance 2 = 25, Distance 3 = 35
    return 15 + (distance - 1) * 10;
}

// Startet Training für eine Alternative Position
function trainAlternatePosition(playerId, targetPos) {
    ensurePositionTrainer();
    let p = squad.find(pl => pl.id === playerId);
    if (!p) return false;

    // Überprüfe ob möglich
    if (!POSITION_ALTERNATIVES[p.pos]?.includes(targetPos)) {
        showToast(`❌ ${targetPos} ist keine mögliche Position für einen ${p.pos}`, 'error');
        return false;
    }

    // Überprüfe ob bereits trainiert
    if (p.positionFlexibility.secondaryPositions.includes(targetPos)) {
        showToast(`ℹ️ ${p.name} kann bereits ${targetPos} spielen!`, 'info');
        return false;
    }

    // Fitness-Kosten
    if (p.fitness < 20) {
        showToast('⚠️ Spieler zu müde für Positions-Training', 'warning');
        return false;
    }

    p.fitness = Math.max(0, p.fitness - 15);

    // Initialisiere Trainings-Fortschritt
    if (!p.positionFlexibility.trainingProgress[targetPos]) {
        p.positionFlexibility.trainingProgress[targetPos] = 0;
    }

    let difficulty = getPositionTrainingDifficulty(p.pos, targetPos);
    let progressPerSession = 100 / difficulty; // Prozentsätze pro Session

    p.positionFlexibility.trainingProgress[targetPos] += progressPerSession;

    // Wenn Trainings-Meter voll, Position freigeschaltet
    if (p.positionFlexibility.trainingProgress[targetPos] >= 100) {
        p.positionFlexibility.secondaryPositions.push(targetPos);
        p.positionFlexibility.trainingProgress[targetPos] = 100;

        playSound('success');
        showToast(`🎯 ${p.name} kann jetzt als ${targetPos} spielen!`, 'success');

        game.positionTrainer.trainingLog.push({
            matchday: game.matchday,
            season: game.season,
            player: p.name,
            position: targetPos,
            status: 'completed'
        });

        return true;
    } else {
        showToast(`✓ ${p.name} trainiert ${targetPos} (${Math.round(p.positionFlexibility.trainingProgress[targetPos])}%)`, 'success');

        game.positionTrainer.trainingLog.push({
            matchday: game.matchday,
            season: game.season,
            player: p.name,
            position: targetPos,
            status: 'in_progress',
            progress: Math.round(p.positionFlexibility.trainingProgress[targetPos])
        });

        return false;
    }
}

// Berechnet Flexibilität eines Spielers
function getPlayerFlexibility(playerId) {
    let p = squad.find(pl => pl.id === playerId);
    if (!p || !p.positionFlexibility) return 0;

    // Flexibilität = Anzahl trainierter Alternativen
    return p.positionFlexibility.secondaryPositions.length;
}

// Gibt alle möglichen Positionen für einen Spieler zurück
function getAvailablePositions(playerId) {
    let p = squad.find(pl => pl.id === playerId);
    if (!p) return [p.pos];

    let positions = [p.pos];
    if (p.positionFlexibility?.secondaryPositions) {
        positions.push(...p.positionFlexibility.secondaryPositions);
    }
    return [...new Set(positions)];
}

// Monatliche Entwicklung: Spieler trainieren automatisch Flexibilität
function tickPositionTrainerMonthlyDevelopment() {
    ensurePositionTrainer();

    squad.forEach(p => {
        if (!p.positionFlexibility || !p.positionFlexibility.trainingProgress) return;

        // Spieler, die viel spielen, entwickeln leichter Flexibilität
        let appearances = p.appearances || 0;
        let developmentChance = 0;

        if (appearances > 30) developmentChance = 0.15; // 15% je Monat
        if (appearances > 20) developmentChance = 0.08; // 8% für weniger erfahren
        if (appearances > 10) developmentChance = 0.03; // 3% für Bankspieler

        // Automatische Entwicklung für in-progress Trainings
        Object.keys(p.positionFlexibility.trainingProgress).forEach(pos => {
            let progress = p.positionFlexibility.trainingProgress[pos];
            if (progress > 0 && progress < 100 && Math.random() < developmentChance) {
                p.positionFlexibility.trainingProgress[pos] = Math.min(100, progress + 5);
            }
        });
    });
}

// Rendert das Positions-Trainer Panel
function renderPositionTrainerPanel() {
    ensurePositionTrainer();
    let box = document.getElementById('position-trainer-box');
    if (!box) return;

    let flexiblePlayers = squad
        .filter(p => POSITION_ALTERNATIVES[p.pos]?.length > 0)
        .sort((a, b) => getPlayerFlexibility(b.id) - getPlayerFlexibility(a.id))
        .slice(0, 12);

    if (flexiblePlayers.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Keine Spieler für Positions-Training verfügbar.</div>';
        return;
    }

    let html = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Trainiere Spieler in neuen Positionen für mehr Flexibilität:</div>';

    flexiblePlayers.forEach(p => {
        let flexibility = getPlayerFlexibility(p.id);
        let currentPositions = getAvailablePositions(p.id).join('/');
        let alternatives = POSITION_ALTERNATIVES[p.pos] || [];
        let trainablePos = alternatives.filter(pos => !p.positionFlexibility?.secondaryPositions?.includes(pos));
        let inProgress = Object.keys(p.positionFlexibility?.trainingProgress || {})
            .filter(pos => p.positionFlexibility.trainingProgress[pos] > 0 && p.positionFlexibility.trainingProgress[pos] < 100);

        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px; font-size:8px;">
                <div style="font-weight:bold; margin-bottom:2px;">${p.name} (${p.pos})</div>
                <div style="color:var(--text-muted); margin-bottom:2px;">Positionen: <strong>${currentPositions}</strong> | Flexibilität: <strong>⭐ ${flexibility}</strong></div>
                ${inProgress.length > 0 ? `<div style="color:var(--accent); margin-bottom:2px;">📚 Training: ${inProgress.map(pos => {
                    let prog = Math.round(p.positionFlexibility.trainingProgress[pos]);
                    return `${pos} (${prog}%)`;
                }).join(', ')}</div>` : ''}
                <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:2px;">
                    ${trainablePos.map(pos => {
                        let difficulty = getPositionTrainingDifficulty(p.pos, pos);
                        let sessions = Math.ceil(difficulty);
                        return `<button onclick="trainAlternatePosition('${p.id}', '${pos}')" class="btn-secondary" style="font-size:8px; padding:3px;">→ ${pos} (${sessions}x)</button>`;
                    }).join('')}
                </div>
            </div>
        `;
    });

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Trainiere Spieler in neuen Positionen, um mehr Formation-Flexibilität zu haben. Erfahrene Spieler lernen schneller.
        </div>
    `;

    box.innerHTML = html;
}
