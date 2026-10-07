/* eslint-disable no-undef */
// Phase 23.14: Trainings-Spezialisierung
// Konzentriere Training auf einzelne Fähigkeiten für schnellere Entwicklung

function ensureTrainingSpecialization() {
    if (!game.trainingSpecialization) {
        game.trainingSpecialization = {};
    }
    if (!game.trainingFocus) {
        game.trainingFocus = {};
    }
}

function getTrainingSpecializationBonus(playerId, stat) {
    ensureTrainingSpecialization();
    let focus = game.trainingFocus[playerId];
    if (!focus || focus.stat !== stat) return 0;

    // Je länger fokussiert, desto höher der Bonus (max 25%)
    return Math.min(25, focus.weeks * 3);
}

function setPlayerTrainingFocus(playerId, stat) {
    ensureTrainingSpecialization();
    let p = squad.find(pl => pl.id === playerId);
    if (!p || !stat) return false;

    game.trainingFocus[playerId] = {
        stat: stat,
        weeks: 0,
        specialization: 0
    };

    showToast(`✓ ${p.name} konzentriert sich auf ${stat}`, 'success');
    return true;
}

function clearPlayerTrainingFocus(playerId) {
    ensureTrainingSpecialization();
    delete game.trainingFocus[playerId];
}

function tickTrainingSpecializationMonthly() {
    // Nur aktiv wenn tatsächlich Spezialisierungen vorhanden sind
    if (!game.trainingFocus || Object.keys(game.trainingFocus).length === 0) return;

    ensureTrainingSpecialization();

    Object.keys(game.trainingFocus).forEach(playerId => {
        let focus = game.trainingFocus[playerId];
        if (!focus) return;

        focus.weeks += 1;
        focus.specialization = Math.min(100, focus.specialization + 15);

        // Regelmäßig informieren über Fortschritt
        if (focus.specialization === 50 || focus.specialization === 100) {
            let p = squad.find(pl => pl.id === playerId);
            if (p) {
                let msg = focus.specialization === 50
                    ? `🎯 ${p.name} macht gute Fortschritte beim ${focus.stat}-Training!`
                    : `🏆 ${p.name} hat ${focus.stat}-Spezialisierung abgeschlossen!`;
                showToast(msg, 'info');
            }
        }
    });
}

function renderTrainingSpecializationPanel() {
    ensureTrainingSpecialization();
    let box = document.getElementById('training-specialization-box');
    if (!box) return;

    let starterIds = game.lineup?.starters || [];
    let starters = starterIds.map(id => squad.find(p => p.id === id)).filter(Boolean).slice(0, 11);

    if (starters.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Wähle zuerst eine Aufstellung.</div>';
        return;
    }

    let TRAINING_STATS = ['passing', 'tackling', 'dribbling', 'strength', 'stamina'];
    let html = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Spezialisiere Spieler auf einzelne Fähigkeiten:</div>';

    starters.forEach(p => {
        let focus = game.trainingFocus[p.id];
        let focusLabel = focus ? focus.stat : 'Keine';

        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-weight:bold; font-size:10px;">${p.name}</div>
                    <div style="font-size:9px; color:var(--accent);">${focusLabel}</div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:2px;">
                    ${TRAINING_STATS.map(stat => {
                        let isActive = focus?.stat === stat;
                        let bonus = getTrainingSpecializationBonus(p.id, stat);
                        return `
                            <button onclick="setPlayerTrainingFocus('${p.id}', '${stat}')" class="${isActive ? 'btn-action' : 'btn-secondary'}" style="font-size:8px; padding:3px;">
                                ${stat.substring(0, 3).toUpperCase()}${bonus > 0 ? '<br>+' + bonus + '%' : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
                ${focus ? `
                    <div style="font-size:8px; color:var(--text-muted); margin-top:3px;">
                        Woche: ${focus.weeks} · Spezialisierung: ${Math.round(focus.specialization)}%
                    </div>
                    <div style="margin-top:3px;">
                        <button onclick="clearPlayerTrainingFocus('${p.id}')" class="btn-secondary" style="font-size:8px; padding:2px;">Beenden</button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Spezialisierte Spieler erhalten bis zu +25% Bonus auf ihre fokussierte Fähigkeit.
        </div>
    `;

    box.innerHTML = html;
}
