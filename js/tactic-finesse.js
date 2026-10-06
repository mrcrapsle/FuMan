/* eslint-disable no-undef */
// Phase 23.4: Taktische Feineinstellungen - Granulare taktische Anpassungen
// jenseits der Hauptformation und des Spielstils. Erlaubt präzisere Kontrolle
// über Spielweise (Ballbesitz, Direktspiel, Pressing, Defensive Line, Spielbreite).

function ensureTacticFinesseState() {
    if (!game.tacticFinesse) {
        game.tacticFinesse = {
            buildup: 'balanced',      // 'possession', 'balanced', 'direct'
            pressing: 'normal',        // 'aggressive', 'normal', 'passive'
            width: 'balanced',         // 'narrow', 'balanced', 'wide'
            defenseLine: 'balanced'    // 'aggressive', 'balanced', 'deep'
        };
    }
}

const TACTIC_FINESSE_CONFIG = {
    buildup: {
        possession: { label: 'Ballbesitz', desc: 'Geduldiges Spiel von hinten, sichere Ballzirkulation. +0.5 Ballbesitz, -1 Angriffstempo' },
        balanced: { label: 'Ausgeglichen', desc: 'Normale Balance zwischen Ballbesitz und Tempo.' },
        direct: { label: 'Direktspiel', desc: 'Schnell nach vorne, lange Bälle. +1.5 Angriffstempo, -0.5 Ballbesitz' }
    },
    pressing: {
        aggressive: { label: 'Aggressiv', desc: 'Frühes Anlaufen, Ballgewinne in der gegnerischen Hälfte. Kraftraubend.' },
        normal: { label: 'Normal', desc: 'Standard-Pressing, ausgewogen.' },
        passive: { label: 'Passiv', desc: 'Tiefes Pressing, Energie sparen. Gegner können entspannter aufbauen.' }
    },
    width: {
        narrow: { label: 'Zentral', desc: 'Fokus auf Mittelfeld und zentrale Angriffe. Engere Abwehr.' },
        balanced: { label: 'Ausgewogen', desc: 'Spielzüge über beide Flügel und die Mitte.' },
        wide: { label: 'Flügelspiel', desc: 'Breites Spiel über die Außenseiten. Viele Flanken und Überläufer.' }
    },
    defenseLine: {
        aggressive: { label: 'Hohes Abseits', desc: 'Linie weit oben, Offside-Falle. Riskant, aber effektiv gegen lange Bälle.' },
        balanced: { label: 'Mittel', desc: 'Standard-Defensive-Line im Spielfeldmittel.' },
        deep: { label: 'Tiefe Linie', desc: 'Defensive line kurz vor dem eigenen Tor. Sicher, aber viel Platz für Gegner.' }
    }
};

function getTacticFinesseBonusMultiplier() {
    ensureTacticFinesseState();
    let mult = 1.0;

    // Buildup-Auswirkung auf Ballbesitz und Tempo
    if (game.tacticFinesse.buildup === 'possession') mult += 0.03;  // +3% zu possessionärem Spiel
    else if (game.tacticFinesse.buildup === 'direct') mult -= 0.02;  // -2% Ballbesitz, aber schneller

    // Pressing-Auswirkung auf Defensiv-Stärke und Ermüdung
    if (game.tacticFinesse.pressing === 'aggressive') mult += 0.04;  // +4% def
    else if (game.tacticFinesse.pressing === 'passive') mult -= 0.03; // -3% def, aber weniger Ermüdung

    // Spielbreite - Balance zwischen Flanken und zentralem Spiel
    if (game.tacticFinesse.width === 'wide') mult += 0.02;           // +2% für variety
    else if (game.tacticFinesse.width === 'narrow') mult += 0.02;   // +2% zentrales Spiel, kompakter

    // Defensive Line - Risiko/Sicherheit
    if (game.tacticFinesse.defenseLine === 'aggressive') mult += 0.03; // +3% aber Offside-risiko
    else if (game.tacticFinesse.defenseLine === 'deep') mult -= 0.02; // -2%, dafür stabiler

    return mult;
}

function renderTacticFinessPanel() {
    const box = document.getElementById('tactic-finesse-box');
    if (!box) return;
    ensureTacticFinesseState();

    let html = '<div style="font-size:10px;">';
    html += '<div style="font-weight:bold; margin-bottom:4px;">🎯 Taktische Feineinstellungen</div>';

    // Aufbau
    html += '<div style="margin:4px 0;"><strong>Spielaufbau:</strong> ';
    Object.entries(TACTIC_FINESSE_CONFIG.buildup).forEach(([key, cfg]) => {
        let btnClass = game.tacticFinesse.buildup === key ? 'btn-action' : 'btn-secondary';
        html += `<button onclick="setTacticFinesse('buildup', '${key}')" class="${btnClass}" style="font-size:9px; padding:2px 6px; margin-right:3px;">${cfg.label}</button>`;
    });
    html += `<div style="font-size:8px; color:var(--text-muted); margin-top:2px;">${TACTIC_FINESSE_CONFIG.buildup[game.tacticFinesse.buildup].desc}</div></div>`;

    // Pressing
    html += '<div style="margin:4px 0;"><strong>Pressing:</strong> ';
    Object.entries(TACTIC_FINESSE_CONFIG.pressing).forEach(([key, cfg]) => {
        let btnClass = game.tacticFinesse.pressing === key ? 'btn-action' : 'btn-secondary';
        html += `<button onclick="setTacticFinesse('pressing', '${key}')" class="${btnClass}" style="font-size:9px; padding:2px 6px; margin-right:3px;">${cfg.label}</button>`;
    });
    html += `<div style="font-size:8px; color:var(--text-muted); margin-top:2px;">${TACTIC_FINESSE_CONFIG.pressing[game.tacticFinesse.pressing].desc}</div></div>`;

    // Spielbreite
    html += '<div style="margin:4px 0;"><strong>Spielbreite:</strong> ';
    Object.entries(TACTIC_FINESSE_CONFIG.width).forEach(([key, cfg]) => {
        let btnClass = game.tacticFinesse.width === key ? 'btn-action' : 'btn-secondary';
        html += `<button onclick="setTacticFinesse('width', '${key}')" class="${btnClass}" style="font-size:9px; padding:2px 6px; margin-right:3px;">${cfg.label}</button>`;
    });
    html += `<div style="font-size:8px; color:var(--text-muted); margin-top:2px;">${TACTIC_FINESSE_CONFIG.width[game.tacticFinesse.width].desc}</div></div>`;

    // Defensive Linie
    html += '<div style="margin:4px 0;"><strong>Defensive Linie:</strong> ';
    Object.entries(TACTIC_FINESSE_CONFIG.defenseLine).forEach(([key, cfg]) => {
        let btnClass = game.tacticFinesse.defenseLine === key ? 'btn-action' : 'btn-secondary';
        html += `<button onclick="setTacticFinesse('defenseLine', '${key}')" class="${btnClass}" style="font-size:9px; padding:2px 6px; margin-right:3px;">${cfg.label}</button>`;
    });
    html += `<div style="font-size:8px; color:var(--text-muted); margin-top:2px;">${TACTIC_FINESSE_CONFIG.defenseLine[game.tacticFinesse.defenseLine].desc}</div></div>`;

    html += '</div>';
    box.innerHTML = html;
}

function setTacticFinesse(category, value) {
    ensureTacticFinesseState();
    if (game.tacticFinesse[category] === value) return;
    game.tacticFinesse[category] = value;
    renderTacticFinessPanel();

    // Wenn live, auch Tickermeldung anzeigen
    if (currentMatch) {
        let categoryLabel = {
            buildup: 'Spielaufbau',
            pressing: 'Pressing',
            width: 'Spielbreite',
            defenseLine: 'Defensive Linie'
        }[category];
        let log = document.getElementById('ticker-log');
        if (log) {
            log.innerHTML += `<div style="color:var(--violet); font-size:10px;">📋 ${categoryLabel} auf ${TACTIC_FINESSE_CONFIG[category][value].label} umgestellt.</div>`;
            log.scrollTop = log.scrollHeight;
        }
    }
}

function applyTacticFinesseBonus(baseStrength) {
    ensureTacticFinesseState();
    return baseStrength * getTacticFinesseBonusMultiplier();
}
