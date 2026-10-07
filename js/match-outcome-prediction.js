/* eslint-disable no-undef */
// Phase 23.20: Match-Outcome-Prognose
// Vorhersage-Engine für Spielergebnisse basierend auf aktuellen Daten

function ensureMatchPrediction() {
    if (!game.matchPredictions) {
        game.matchPredictions = [];
    }
}

function predictMatchOutcome(oppTeam, myFormation, myTacticStyle) {
    if (!oppTeam) return null;

    let prediction = {
        opponent: oppTeam.name,
        predictedWinChance: 0,
        predictedGoalsFor: 0,
        predictedGoalsAgainst: 0,
        factors: []
    };

    // Basis: Team-Stärke Vergleich
    let myStrength = calculateOwnTeamStrength(myFormation, myTacticStyle) || 70;
    let oppStrength = oppTeam.strength || 75;
    let strengthDiff = myStrength - oppStrength;

    // Größere Unterschiede = größere Wahrscheinlichkeits-Unterschiede
    if (strengthDiff > 10) {
        prediction.predictedWinChance = 70;
        prediction.factors.push('Stärkerer Kader');
    } else if (strengthDiff > 5) {
        prediction.predictedWinChance = 60;
        prediction.factors.push('Leicht stärker');
    } else if (strengthDiff > -5) {
        prediction.predictedWinChance = 50;
        prediction.factors.push('Ausgeglichenes Spiel');
    } else if (strengthDiff > -10) {
        prediction.predictedWinChance = 40;
        prediction.factors.push('Leicht schwächer');
    } else {
        prediction.predictedWinChance = 30;
        prediction.factors.push('Deutlich schwächer');
    }

    // Formation-Taktik Matchup
    let formationBonus = predictFormationMatchupBonus(myFormation);
    if (formationBonus > 0) {
        prediction.predictedWinChance += 5;
        prediction.factors.push('Vorteil durch Formation');
    }

    // Taktik-Duel Effekt
    let tacticBonus = predictTacticMatchupBonus(myTacticStyle);
    if (tacticBonus > 0) {
        prediction.predictedWinChance += 3;
        prediction.factors.push('Vorteil durch Spielstil');
    }

    // Home/Away Faktor
    if (game.lineupHome === 'home') {
        prediction.predictedWinChance += 7;
        prediction.factors.push('Heimvorteil (+7%)');
    } else if (game.lineupHome === 'away') {
        prediction.predictedWinChance -= 5;
        prediction.factors.push('Auswärts (-5%)');
    }

    // Historische Bilanz
    let historyBonus = typeof getOpponentHistoryBonus === 'function'
        ? getOpponentHistoryBonus(oppTeam.name)
        : 0;
    if (historyBonus > 0) {
        prediction.predictedWinChance += Math.min(5, historyBonus * 2);
        prediction.factors.push('Gute historische Bilanz');
    } else if (historyBonus < 0) {
        prediction.predictedWinChance += historyBonus;
        prediction.factors.push('Schwache historische Bilanz');
    }

    // Form (letzte 5 Spiele)
    let recentForm = calculateRecentForm();
    prediction.predictedWinChance += recentForm;

    // Grenzen setzen
    prediction.predictedWinChance = Math.max(5, Math.min(95, prediction.predictedWinChance));

    // Tor-Prognose basierend auf Stärke und Chance
    prediction.predictedGoalsFor = Math.round((1.5 + (myStrength / 100) * 1.5) * (prediction.predictedWinChance / 100));
    prediction.predictedGoalsAgainst = Math.round((1.2 + (oppStrength / 100) * 1.2) * ((100 - prediction.predictedWinChance) / 100));

    return prediction;
}

function calculateOwnTeamStrength(formation, tacticStyle) {
    // Vereinfachte Berechnung aus aktuellen Daten
    if (!squad || squad.length === 0) return 70;
    let avgStrength = squad.reduce((sum, p) => sum + (p.strength || 50), 0) / squad.length;
    return Math.round(avgStrength);
}

function predictFormationMatchupBonus(formation) {
    // Basis-Bonus für Formation (vereinfacht für Prognose)
    if (formation === '5-3-2' || formation === '5-4-1') return 1; // Defensive Formationen
    if (formation === '4-3-3' || formation === '3-5-2') return 1; // Balanced
    return 0;
}

function predictTacticMatchupBonus(tacticStyle) {
    // Basis-Bonus für Spielstil (vereinfacht für Prognose)
    if (tacticStyle === 'ausgeglichen') return 0;
    if (tacticStyle === 'ballbesitz') return 1;
    if (tacticStyle === 'konter') return 1.5;
    return 0;
}

function calculateRecentForm() {
    // Letzte 5 Spiele analysieren
    if (!game.results || game.results.length < 2) return 0;

    let recentResults = game.results.slice(-5);
    let wins = recentResults.filter(r => r.result === 'win').length;
    let losses = recentResults.filter(r => r.result === 'loss').length;

    let formBonus = (wins * 3) - (losses * 2);
    return Math.max(-10, Math.min(10, formBonus));
}

function renderMatchPredictionPanel() {
    ensureMatchPrediction();
    let box = document.getElementById('match-prediction-box');
    if (!box) return;

    let match = getUpcomingMatch();
    if (!match) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Kein bevorstehender Match für Vorhersage.</div>';
        return;
    }

    let oppTeam = getTeamByName(match.away === game.clubName ? match.home : match.away);
    let prediction = predictMatchOutcome(oppTeam, game.formation, game.tacticStyle);

    if (!prediction) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Vorhersage nicht verfügbar.</div>';
        return;
    }

    // Gewinn-Wahrscheinlichkeit interpretieren
    let prognose = '';
    let prognoseColor = 'var(--text-muted)';
    if (prediction.predictedWinChance >= 70) {
        prognose = '🟢 Großer Favorit';
        prognoseColor = 'var(--accent)';
    } else if (prediction.predictedWinChance >= 60) {
        prognose = '🟢 Favorit';
        prognoseColor = 'var(--accent)';
    } else if (prediction.predictedWinChance >= 45) {
        prognose = '🟡 Ausgeglichen';
        prognoseColor = 'var(--warning)';
    } else if (prediction.predictedWinChance >= 30) {
        prognose = '🔴 Außenseiter';
        prognoseColor = 'var(--danger)';
    } else {
        prognose = '🔴 Großer Außenseiter';
        prognoseColor = 'var(--danger)';
    }

    let html = `
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:4px;">🎯 Gewinn-Wahrscheinlichkeit</div>
            <div style="font-size:14px; font-weight:bold; color:${prognoseColor}; margin-bottom:4px;">${prediction.predictedWinChance}% - ${prognose}</div>
            <div style="background:rgba(0,0,0,0.3); height:8px; border-radius:4px; overflow:hidden;">
                <div style="background:linear-gradient(90deg, var(--danger), var(--warning), var(--accent)); width:${prediction.predictedWinChance}%; height:100%;"></div>
            </div>
        </div>

        <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">⚽ Tor-Prognose:</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px; font-size:9px;">
                <div style="background:rgba(0,0,0,0.2); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:var(--text-muted);">Unsere Tore</div>
                    <div style="font-weight:bold; color:var(--accent); font-size:12px;">${prediction.predictedGoalsFor}</div>
                </div>
                <div style="background:rgba(0,0,0,0.2); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:var(--text-muted);">Gegner-Tore</div>
                    <div style="font-weight:bold; color:var(--danger); font-size:12px;">${prediction.predictedGoalsAgainst}</div>
                </div>
                <div style="background:rgba(0,0,0,0.2); padding:4px; border-radius:3px; text-align:center;">
                    <div style="color:var(--text-muted);">Prognose</div>
                    <div style="font-weight:bold; font-size:11px;">${prediction.predictedGoalsFor > prediction.predictedGoalsAgainst ? 'Sieg' : (prediction.predictedGoalsFor === prediction.predictedGoalsAgainst ? 'Unentschieden' : 'Niederlage')}</div>
                </div>
            </div>
        </div>

        <div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--accent);">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">📊 Einflussfaktoren:</div>
            <div style="font-size:8px; line-height:1.5;">
                ${prediction.factors.map(f => `<div>✓ ${f}</div>`).join('')}
            </div>
        </div>

        <div style="font-size:8px; color:var(--text-muted); padding:6px; background:rgba(100,150,200,0.1); border-radius:4px;">
            💡 Diese Prognose basiert auf Kader-Stärke, Formation, Spielstil und Form. Sie ist eine Orientierungshilfe, keine Garantie!
        </div>
    `;

    box.innerHTML = html;
}
