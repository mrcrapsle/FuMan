/* eslint-disable no-undef */
// Phase 23.5: Formation-Optimierung - automatische Auswahl der besten Formation
// und optimale Spieler-Platzierung basierend auf Kaderzusammensetzung

function ensureFormationOptimizerState() {
    if (!game.formationOptimizer) {
        game.formationOptimizer = {
            lastOptimization: null,
            autoOptimizeEnabled: false,
            scoringHistory: []
        };
    }
}

// Bewertet eine Formation basierend auf:
// - Spieler pro Position (passt der Kader zur Formation?)
// - Durchschnittliche Stärke pro Linie
// - Spielfitness (verletzt/gesperrt)
function scoreFormationForSquad(formation) {
    ensureFormationOptimizerState();

    let formations = {
        '4-4-2': { def: 4, mid: 4, att: 2 },
        '4-3-3': { def: 4, mid: 3, att: 3 },
        '3-5-2': { def: 3, mid: 5, att: 2 },
        '5-3-2': { def: 5, mid: 3, att: 2 },
        '4-2-3-1': { def: 4, mid: 5, att: 1 },
        '4-1-4-1': { def: 4, mid: 5, att: 1 },
        '3-4-3': { def: 3, mid: 4, att: 3 },
        '5-4-1': { def: 5, mid: 4, att: 1 }
    };

    let config = formations[formation];
    if (!config) return 0;

    // Spieler-Verfügbarkeit pro Position
    let availableByPos = {
        TW: squad.filter(p => p.pos === 'TW' && !p.injured && !p.suspended).length,
        ABW: squad.filter(p => p.pos === 'ABW' && !p.injured && !p.suspended).length,
        MIT: squad.filter(p => p.pos === 'MIT' && !p.injured && !p.suspended).length,
        ST: squad.filter(p => p.pos === 'ST' && !p.injured && !p.suspended).length
    };

    // Bench-Spieler pro Position (um Flexibilität zu haben)
    let benchByPos = {
        TW: squad.filter(p => p.pos === 'TW' && !p.injured && !p.suspended).length - 1,
        ABW: squad.filter(p => p.pos === 'ABW' && !p.injured && !p.suspended).length - config.def,
        MIT: squad.filter(p => p.pos === 'MIT' && !p.injured && !p.suspended).length - config.mid,
        ST: squad.filter(p => p.pos === 'ST' && !p.injured && !p.suspended).length - config.att
    };

    // Bewertungskriterien
    let score = 0;

    // 1. Können wir die Formation überhaupt spielen? (+20 Punkte pro Position)
    score += (availableByPos.TW > 0 ? 20 : -10);
    score += (availableByPos.ABW >= config.def ? 20 : -10);
    score += (availableByPos.MIT >= config.mid ? 20 : -10);
    score += (availableByPos.ST >= config.att ? 20 : -10);

    // 2. Wie viele Reserve-Spieler haben wir? (+5 Punkte je Ersatz)
    score += Math.min(benchByPos.ABW, 2) * 5;
    score += Math.min(benchByPos.MIT, 2) * 5;
    score += Math.min(benchByPos.ST, 1) * 5;

    // 3. Durchschnittliche Stärke der Formation
    let defPlayers = squad.filter(p => p.pos === 'ABW' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength).slice(0, config.def);
    let midPlayers = squad.filter(p => p.pos === 'MIT' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength).slice(0, config.mid);
    let attPlayers = squad.filter(p => p.pos === 'ST' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength).slice(0, config.att);

    let avgDefStr = defPlayers.length > 0 ? defPlayers.reduce((s, p) => s + p.strength, 0) / defPlayers.length : 0;
    let avgMidStr = midPlayers.length > 0 ? midPlayers.reduce((s, p) => s + p.strength, 0) / midPlayers.length : 0;
    let avgAttStr = attPlayers.length > 0 ? attPlayers.reduce((s, p) => s + p.strength, 0) / attPlayers.length : 0;

    score += avgDefStr * 0.5;
    score += avgMidStr * 0.6;
    score += avgAttStr * 0.7;

    return Math.max(0, score);
}

// Findet die beste Formation für den aktuellen Kader
function suggestOptimalFormation() {
    let formations = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-2-3-1', '4-1-4-1', '3-4-3', '5-4-1'];
    let scores = {};

    formations.forEach(f => {
        scores[f] = scoreFormationForSquad(f);
    });

    let best = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];

    return {
        formation: best,
        score: scores[best],
        allScores: scores
    };
}

// Optimiert die Aufstellung für eine gegebene Formation
function autoOptimizeLineup(formation) {
    let formations = {
        '4-4-2': { def: 4, mid: 4, att: 2 },
        '4-3-3': { def: 4, mid: 3, att: 3 },
        '3-5-2': { def: 3, mid: 5, att: 2 },
        '5-3-2': { def: 5, mid: 3, att: 2 },
        '4-2-3-1': { def: 4, mid: 5, att: 1 },
        '4-1-4-1': { def: 4, mid: 5, att: 1 },
        '3-4-3': { def: 3, mid: 4, att: 3 },
        '5-4-1': { def: 5, mid: 4, att: 1 }
    };

    let config = formations[formation];
    if (!config) return;

    // Verfügbare Spieler sortiert nach Stärke
    let tw = squad.filter(p => p.pos === 'TW' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength);
    let abw = squad.filter(p => p.pos === 'ABW' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength);
    let mit = squad.filter(p => p.pos === 'MIT' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength);
    let st = squad.filter(p => p.pos === 'ST' && !p.injured && !p.suspended).sort((a, b) => b.strength - a.strength);

    // Neue Aufstellung zusammenstellen
    let newLineup = [];

    // Torwart (bester)
    if (tw.length > 0) newLineup.push(tw[0].id);

    // Abwehr
    for (let i = 0; i < config.def && i < abw.length; i++) {
        newLineup.push(abw[i].id);
    }

    // Mittelfeld
    for (let i = 0; i < config.mid && i < mit.length; i++) {
        newLineup.push(mit[i].id);
    }

    // Angriff
    for (let i = 0; i < config.att && i < st.length; i++) {
        newLineup.push(st[i].id);
    }

    // Auf 11 Spieler auffüllen (Reserve)
    let usedIds = new Set(newLineup);
    let remaining = squad.filter(p => !usedIds.has(p.id) && !p.injured && !p.suspended);
    remaining.sort((a, b) => b.strength - a.strength);

    for (let i = 0; i < 11 - newLineup.length && i < remaining.length; i++) {
        newLineup.push(remaining[i].id);
    }

    return newLineup;
}

// Anwendet die optimale Formation und Aufstellung
function applyFormationOptimization() {
    ensureFormationOptimizerState();

    let suggestion = suggestOptimalFormation();
    let optimalFormation = suggestion.formation;

    // Formation setzen
    game.formation = optimalFormation;

    // Aufstellung optimieren
    let optimizedLineup = autoOptimizeLineup(optimalFormation);
    if (optimizedLineup && optimizedLineup.length > 0) {
        lineup = optimizedLineup;
    }

    // Timestamp speichern
    game.formationOptimizer.lastOptimization = {
        timestamp: game.matchday,
        season: game.season,
        formation: optimalFormation,
        score: suggestion.score
    };

    playSound('click');
    renderSquadView();
    render3DPitch();
    showToast(`✅ Formation optimiert: ${optimalFormation} (Bewertung: ${Math.round(suggestion.score)})`, 'success');
}

// UI-Element rendern
function renderFormationOptimizer() {
    let box = document.getElementById('formation-optimizer-box');
    if (!box) return;

    ensureFormationOptimizerState();

    let suggestion = suggestOptimalFormation();
    let current = game.formation;
    let isBetter = suggestion.formation !== current;

    let allScoresHtml = Object.entries(suggestion.allScores)
        .sort((a, b) => b[1] - a[1])
        .map(([f, s], i) => {
            let isOptimal = f === suggestion.formation;
            let isCurrent = f === current;
            let bar = Math.round(s / 3);
            return `<div style="font-size:9px; margin:4px 0; ${isCurrent ? 'color:var(--accent); font-weight:bold;' : ''} ${isOptimal ? 'color:var(--primary); font-weight:bold;' : ''}">
                ${isOptimal ? '🎯 ' : ''}${f} ${isCurrent ? '✓ aktuell' : ''} <span style="color:var(--text-muted);">│</span> <span style="background:rgba(200,150,100,0.2); display:inline-block; width:${bar}px; height:8px; vertical-align:middle;"></span> ${Math.round(s)}
            </div>`;
        })
        .join('');

    box.innerHTML = `
        <div class="panel-header">🎲 FORMATIONS-OPTIMIERER</div>
        <div style="font-size:10px; margin-bottom:6px;">
            <strong>Empfehlung:</strong> <strong style="color:var(--primary);">${suggestion.formation}</strong>
            ${isBetter ? ' <span style="color:var(--accent);">← besser als aktuell</span>' : ''}
        </div>
        ${allScoresHtml}
        <button onclick="applyFormationOptimization()" class="btn-action" style="width:100%; margin-top:8px; font-size:10px;">
            🎲 ${suggestion.formation} aktivieren
        </button>
    `;
}
