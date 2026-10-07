/* eslint-disable no-undef */
// Phase 23.18: Taktische Flexibilität
// Wie schnell & effektiv wechselt dein Team die Spielweise?

function ensureTacticalFlexibility() {
    if (!game.tacticalFlexibility) {
        game.tacticalFlexibility = {
            lastFormation: game.formation,
            lastStyle: game.tacticStyle,
            switchCount: 0,
            successfulAdaptations: 0,
            flexibility: 50
        };
    }
}

function getTacticalFlexibilityBonus() {
    ensureTacticalFlexibility();
    // 0-100 Flexibilität = 0-2% Stärkebonus
    return (game.tacticalFlexibility.flexibility / 100) * 2;
}

function recordTacticalSwitch(newFormation, newStyle) {
    ensureTacticalFlexibility();
    let flex = game.tacticalFlexibility;

    let formationChanged = newFormation !== flex.lastFormation;
    let styleChanged = newStyle !== flex.lastStyle;

    if (formationChanged || styleChanged) {
        flex.switchCount += 1;
        flex.lastFormation = newFormation;
        flex.lastStyle = newStyle;

        // Je öfter gewechselt wird, desto höher die Flexibilität
        flex.flexibility = Math.min(100, flex.flexibility + 2);
    }
}

function recordAdaptationSuccess(wasSuccessful) {
    ensureTacticalFlexibility();
    if (wasSuccessful) {
        let flex = game.tacticalFlexibility;
        flex.successfulAdaptations += 1;
        flex.flexibility = Math.min(100, flex.flexibility + 1.5);
        showToast('✓ Erfolgreiche taktische Anpassung!', 'success');
    }
}

function tickTacticalFlexibilityMonthly() {
    ensureTacticalFlexibility();

    let flex = game.tacticalFlexibility;
    // Passive Entwicklung: Teams lernen neue taktische Systeme
    if (flex.flexibility < 100) {
        flex.flexibility = Math.min(100, flex.flexibility + 1);
    }

    // Erfolgsquote beeinflussen Adaptation Speed
    if (flex.switchCount > 0) {
        let successRate = flex.successfulAdaptations / Math.max(1, flex.switchCount);
        if (successRate > 0.7) {
            flex.flexibility = Math.min(100, flex.flexibility + 2);
        }
    }
}

function renderTacticalFlexibilityPanel() {
    ensureTacticalFlexibility();
    let box = document.getElementById('tactical-flexibility-box');
    if (!box) return;

    let flex = game.tacticalFlexibility;
    let bonus = getTacticalFlexibilityBonus();
    let successRate = flex.switchCount > 0 ? Math.round((flex.successfulAdaptations / flex.switchCount) * 100) : 0;

    let rating = flex.flexibility >= 80 ? 'Hervorragend' :
                 flex.flexibility >= 60 ? 'Gut' :
                 flex.flexibility >= 40 ? 'Durchschnittlich' : 'Anfänger';

    let html = `
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:6px;">🔄 Taktische Flexibilität: <span style="color:var(--accent);">${Math.round(flex.flexibility)}/100</span></div>
            <div style="background:rgba(0,0,0,0.3); height:8px; border-radius:4px; margin-bottom:4px; overflow:hidden;">
                <div style="background:linear-gradient(90deg, var(--danger), var(--warning), var(--accent)); width:${flex.flexibility}%; height:100%;"></div>
            </div>
            <div style="font-size:9px; color:var(--text-muted);">Rating: <strong>${rating}</strong> · Stärkebonus: <strong style="color:var(--accent);">+${bonus.toFixed(1)}%</strong></div>
        </div>

        <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">⚙️ Wechsel-Statistiken:</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; font-size:9px;">
                <div style="background:rgba(0,0,0,0.2); padding:4px; border-radius:3px;">
                    <div style="color:var(--text-muted);">Taktik-Wechsel</div>
                    <div style="font-weight:bold; color:var(--accent);">${flex.switchCount}</div>
                </div>
                <div style="background:rgba(0,0,0,0.2); padding:4px; border-radius:3px;">
                    <div style="color:var(--text-muted);">Erfolgsquote</div>
                    <div style="font-weight:bold; color:var(--accent);">${successRate}%</div>
                </div>
            </div>
        </div>

        <div style="font-size:8px; color:var(--text-muted); padding:6px; background:rgba(76,175,80,0.1); border-radius:4px; border-left:3px solid var(--accent);">
            💡 Höhere Flexibilität ermöglicht schnellere Anpassungen an gegnerische Taktiken. Erfolgreiche Wechsel erhöhen die Flexibilität!
        </div>
    `;

    box.innerHTML = html;
}
