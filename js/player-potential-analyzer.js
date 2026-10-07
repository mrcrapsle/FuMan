/* eslint-disable no-undef */
// Phase 23.15: Spieler-Potenzial-Analyzer
// Analysiere Entwicklungspotenzial basierend auf Alter, Stärke und Progression

function ensurePlayerPotential() {
    if (!game.playerPotential) {
        game.playerPotential = {};
    }
}

function analyzePlayerPotential(p) {
    let maxAge = 35;
    let peakAge = 28;
    let peakStrength = 90;

    let age = p.age || 25;
    let strength = p.strength || 50;
    let careerHistory = p.strengthHistory || [];

    // Berechne Entwicklungstrend
    let trend = 0;
    if (careerHistory.length >= 2) {
        let lastStrength = careerHistory[careerHistory.length - 1];
        let prevStrength = careerHistory[careerHistory.length - 2];
        trend = (lastStrength - prevStrength) / 5;
    }

    // Potenzial basierend auf Alter und aktuellem Niveau
    let potentialStrength;
    if (age <= peakAge) {
        let ageProgress = age / peakAge;
        potentialStrength = strength + (peakStrength - strength) * (1 - ageProgress) * 0.8;
    } else {
        let decline = Math.pow((age - peakAge) / (maxAge - peakAge), 1.5);
        potentialStrength = Math.max(30, strength - (strength - 40) * decline);
    }

    // Entwicklungs-Rating
    let developmentRating = 'Stabil';
    if (trend > 2) developmentRating = 'Aufsteiger';
    else if (trend > 0.5) developmentRating = 'Wachstum';
    else if (trend < -2) developmentRating = 'Abnehmend';
    else if (trend < -0.5) developmentRating = 'Rückgang';

    // Karriere-Fenster Analyse
    let careerfenster = 'Auslaufend';
    if (age <= 23) careerfenster = 'Entwicklung';
    else if (age <= 28) careerfenster = 'Prime Jahre';
    else if (age <= 32) careerfenster = 'Erfahrung';
    else careerfenster = 'Rückzug';

    return {
        currentStrength: strength,
        potentialStrength: Math.round(potentialStrength),
        trend: trend.toFixed(1),
        developmentRating: developmentRating,
        careerfenster: careerfenster,
        yearsLeft: Math.max(0, maxAge - age),
        developmentPotential: Math.max(0, Math.round(potentialStrength - strength))
    };
}

function getPlayerPotentialCategory(p) {
    let analysis = analyzePlayerPotential(p);

    if (analysis.currentStrength >= 80) {
        return analysis.developmentPotential > 5 ? 'Weltklasse-Potenzial' : 'Elite-Spieler';
    } else if (analysis.currentStrength >= 70) {
        return analysis.developmentPotential > 8 ? 'Großes Potenzial' : 'Etabliert';
    } else if (analysis.currentStrength >= 55) {
        return analysis.developmentPotential > 10 ? 'Hohes Potenzial' : 'Solid';
    } else {
        return analysis.developmentPotential > 5 ? 'Entwicklungsfähig' : 'Begrenztes Potenzial';
    }
}

function renderPlayerPotentialAnalyzerPanel() {
    ensurePlayerPotential();
    let box = document.getElementById('player-potential-box');
    if (!box) return;

    let potentialPlayers = squad
        .map(p => ({
            player: p,
            analysis: analyzePlayerPotential(p),
            category: getPlayerPotentialCategory(p)
        }))
        .sort((a, b) => b.analysis.developmentPotential - a.analysis.developmentPotential);

    let html = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Entwicklungspotenzial-Analyse:</div>';

    potentialPlayers.slice(0, 8).forEach(item => {
        let p = item.player;
        let a = item.analysis;
        let trendColor = a.trend > 0 ? 'var(--accent)' : (a.trend < 0 ? 'var(--danger)' : 'var(--text-muted)');
        let potColor = a.developmentPotential > 8 ? 'var(--accent)' : (a.developmentPotential > 0 ? 'var(--warning)' : 'var(--text-muted)');

        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <div style="font-weight:bold; font-size:10px;">${p.name}</div>
                    <div style="font-size:9px; color:var(--accent);">${a.careerfenster}</div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom:3px;">
                    <div style="font-size:8px;">
                        <div>Aktuell: <strong>${a.currentStrength}</strong></div>
                        <div>Potenzial: <strong style="color:${potColor};">${a.potentialStrength}</strong></div>
                    </div>
                    <div style="font-size:8px;">
                        <div style="color:${trendColor};">Trend: ${a.trend > 0 ? '+' : ''}${a.trend}</div>
                        <div>${a.developmentRating}</div>
                    </div>
                </div>
                <div style="background:rgba(0,0,0,0.2); height:6px; border-radius:3px; overflow:hidden; margin-bottom:3px;">
                    <div style="background:linear-gradient(90deg, var(--danger), var(--warning), var(--accent)); width:${(a.currentStrength / a.potentialStrength * 100)}%; height:100%; transition:width 0.3s;"></div>
                </div>
                <div style="font-size:8px; color:var(--text-muted);">
                    ${item.category} · ${a.yearsLeft} Jahre Karriere
                </div>
            </div>
        `;
    });

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Junge Spieler mit hohem Potenzial sind wertvolle Investitionen für die Zukunft.
        </div>
    `;

    box.innerHTML = html;
}
