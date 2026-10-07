/* eslint-disable no-undef */
// Phase 23.11: Formationen-Spezialisierung
// Trainiere das Team auf die aktuelle Formation für bessere Leistung

function ensureFormationSpecialization() {
    if (!game.formationSpecialization) {
        game.formationSpecialization = {};
    }

    ['4-4-2', '4-3-3', '5-3-2', '3-4-3', '4-5-1', '5-4-1'].forEach(form => {
        if (!game.formationSpecialization[form]) {
            game.formationSpecialization[form] = {
                specialization: 0,
                lastTrained: 0,
                trainingDays: 0
            };
        }
    });
}

function getFormationSpecializationBonus(formation) {
    ensureFormationSpecialization();
    let spec = game.formationSpecialization[formation];
    if (!spec) return 0;

    // 0-100 Spezialisierung = 0-3% Stärkebonus
    return (spec.specialization / 100) * 3;
}

function tickFormationSpecializationMonthly() {
    ensureFormationSpecialization();

    // Wenn die aktuelle Formation trainiert wird, erhöhe ihre Spezialisierung
    let currentSpec = game.formationSpecialization[game.formation];
    if (currentSpec) {
        let trainingIntensity = 1;

        // Je nachdem, wie oft diese Formation in den letzten 4 Spieltagen gespielt wurde
        if (game.tacticRecords && Array.isArray(game.tacticRecords)) {
            let recentMatches = game.tacticRecords.filter(t => t.matchday >= game.matchday - 4 && t.formation === game.formation);
            trainingIntensity = Math.min(2, 0.5 + (recentMatches.length * 0.2));
        }

        currentSpec.specialization = Math.min(100, currentSpec.specialization + 2.5 * trainingIntensity);
        currentSpec.lastTrained = game.matchday;
        currentSpec.trainingDays += 1;

        if (currentSpec.specialization >= 50 && currentSpec.specialization <= 52.5) {
            showToast(`🎯 Formation ${game.formation} erreicht 50% Spezialisierung!`, 'info');
        }
        if (currentSpec.specialization >= 100) {
            showToast(`🏆 Formation ${game.formation} vollständig spezialisiert!`, 'success');
        }
    }

    // Andere Formationen verlieren etwas Spezialisierung (Abklingeffekt)
    Object.keys(game.formationSpecialization).forEach(form => {
        if (form !== game.formation) {
            let spec = game.formationSpecialization[form];
            if (spec.specialization > 0) {
                spec.specialization = Math.max(0, spec.specialization - 0.5);
            }
        }
    });
}

function renderFormationSpecializationPanel() {
    ensureFormationSpecialization();
    let box = document.getElementById('formation-specialization-box');
    if (!box) return;

    let formations = Object.keys(game.formationSpecialization)
        .map(form => ({
            formation: form,
            data: game.formationSpecialization[form],
            bonus: getFormationSpecializationBonus(form),
            isActive: form === game.formation
        }))
        .sort((a, b) => b.data.specialization - a.data.specialization);

    let html = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Spezialisierung auf deine aktuelle Formation: <strong>' + game.formation + '</strong></div>';

    formations.forEach(f => {
        let percent = Math.round(f.data.specialization);
        let barWidth = (f.data.specialization / 100) * 100;
        let bonusText = f.bonus > 0 ? `<span style="color:var(--accent);">+${f.bonus.toFixed(1)}% Stärke</span>` : '';

        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px; border:${f.isActive ? '2px solid var(--accent)' : 'none'}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <div style="font-weight:bold; font-size:10px;">${f.formation}</div>
                    <div style="font-size:9px;">${percent}% ${bonusText}</div>
                </div>
                <div style="background:rgba(0,0,0,0.3); height:6px; border-radius:3px; overflow:hidden;">
                    <div style="background:linear-gradient(90deg, var(--accent), var(--primary)); width:${barWidth}%; height:100%; transition:width 0.3s;"></div>
                </div>
                <div style="font-size:8px; color:var(--text-muted); margin-top:2px;">
                    ${f.data.trainingDays > 0 ? `${f.data.trainingDays} Trainingstage · Zuletzt: Spieltag ${f.data.lastTrained}` : 'Noch nicht trainiert'}
                </div>
            </div>
        `;
    });

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Trainiere deine Formation regelmäßig, um +0,03% Stärke pro Spezialisierungs-Punkt zu erhalten.
        </div>
    `;

    box.innerHTML = html;
}
