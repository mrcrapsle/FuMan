// Post-Match-Analyse
// Spieler-Bewertungen, taktische Fehler, Verbesserungsvorschläge

let postMatchAnalysisState = {
    lastMatchAnalysis: null,
    playerRatings: [],
    tacticalInsights: [],
    analysisHistory: []
};

function initializePostMatchAnalysis() {
    if (!game.postMatchAnalysis) game.postMatchAnalysis = {};
    if (!game.postMatchAnalysis.analyses) game.postMatchAnalysis.analyses = [];
    if (!game.postMatchAnalysis.playerRatings) game.postMatchAnalysis.playerRatings = [];
}

function analyzeLastMatch() {
    initializePostMatchAnalysis();

    const played = typeof getOwnSeasonMatches === 'function' ? getOwnSeasonMatches() : [];
    if (played.length === 0) return null;
    const m = played[played.length - 1];
    let lastMatch = {
        matchday: m.matchday,
        opponent: m.opponent,
        result: m.own > m.opp ? 'WIN' : (m.own === m.opp ? 'DRAW' : 'LOSS'),
        ownGoals: m.own,
        oppGoals: m.opp
    };

    // Spieler-Bewertungen basierend auf Match-Ergebnis
    let playerRatings = squad.map(player => {
        let rating = 70; // Basis-Rating

        // Team-Ergebnis beeinflussen
        if (lastMatch.result === 'WIN') {
            rating += 15;
        } else if (lastMatch.result === 'DRAW') {
            rating += 5;
        } else {
            rating -= 10;
        }

        // Spieler-Stärke beeinflussen
        rating += (player.strength - 70) * 0.1;

        // Form-Faktor
        rating += ((player.form || 1.0) - 1.0) * 20;

        // Nach dem Spiel verletzt ausgefallen: Leistung litt darunter
        if ((player.injured || 0) > 0) rating *= 0.85;

        return {
            playerId: player.id,
            playerName: player.name,
            position: player.pos,
            rating: Math.round(Math.max(30, Math.min(95, rating))),
            performance: rating > 75 ? 'AUSGEZEICHNET' : rating > 60 ? 'GUT' : rating > 50 ? 'OK' : 'SCHWACH'
        };
    });

    // Taktische Analyse
    let tacticalInsights = [];

    if (lastMatch.result === 'LOSS') {
        if (lastMatch.ownGoals < lastMatch.oppGoals - 1) {
            tacticalInsights.push({
                type: 'DEFENSIVE',
                title: '🛡️ Abwehr zu offen',
                suggestion: 'Versuch 5-3-2 oder erhöhe Tackle-Intensität'
            });
        }
        tacticalInsights.push({
            type: 'ATTACKING',
            title: '⚽ Zu wenig Tore',
            suggestion: 'Erhöhe Offensiv-Druck oder wechsle Formation zu 4-2-3-1'
        });
    }

    if (lastMatch.result === 'WIN') {
        tacticalInsights.push({
            type: 'STRATEGY_SUCCESS',
            title: '✅ Taktik funktioniert',
            suggestion: 'Behalte aktuelle Formation und Spielweise'
        });
    }

    let analysis = {
        matchday: lastMatch.matchday,
        opponent: lastMatch.opponent,
        result: lastMatch.result,
        score: `${lastMatch.ownGoals}:${lastMatch.oppGoals}`,
        playerRatings: playerRatings,
        tacticalInsights: tacticalInsights,
        timestamp: new Date().getTime()
    };

    // Pro Spiel nur ein Verlaufseintrag, auch wenn das Panel mehrfach gerendert wird.
    const history = game.postMatchAnalysis.analyses;
    const prev = history[history.length - 1];
    if (prev && prev.matchday === analysis.matchday) history[history.length - 1] = analysis;
    else history.push(analysis);
    if (history.length > 15) history.shift();

    postMatchAnalysisState.lastMatchAnalysis = analysis;
    return analysis;
}

function getBestPerformers() {
    initializePostMatchAnalysis();

    if (!postMatchAnalysisState.lastMatchAnalysis) return [];

    return postMatchAnalysisState.lastMatchAnalysis.playerRatings
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3);
}

function getWorstPerformers() {
    initializePostMatchAnalysis();

    if (!postMatchAnalysisState.lastMatchAnalysis) return [];

    return postMatchAnalysisState.lastMatchAnalysis.playerRatings
        .sort((a, b) => a.rating - b.rating)
        .slice(0, 3);
}

function tickPostMatchAnalysis() {
    initializePostMatchAnalysis();

    // Nach jedem Match: Analyse durchführen (einmal pro Match-Tag)
    analyzeLastMatch();
}

function renderPostMatchAnalysisPanel() {
    const container = document.getElementById('post-match-analysis-box');
    if (!container) return;

    initializePostMatchAnalysis();
    analyzeLastMatch();

    let analysis = postMatchAnalysisState.lastMatchAnalysis;
    if (!analysis) {
        container.innerHTML = '<div class="panel-content"><p style="color:var(--text-muted); font-size:9px;">Noch kein Match gespielt.</p></div>';
        return;
    }

    let html = '<div class="panel-content">';
    html += '<h3>📊 POST-MATCH-ANALYSE</h3>';

    html += `<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">`;
    html += `<p style="font-size:9px; margin:0;"><strong>ST${analysis.matchday}:</strong> ${({ WIN: 'Sieg', DRAW: 'Remis', LOSS: 'Niederlage' })[analysis.result]} gegen ${analysis.opponent} (${analysis.score})</p>`;
    html += `</div>`;

    // Beste Spieler
    let best = getBestPerformers();
    if (best.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>⭐ BESTE SPIELER</h4>';
        best.forEach(p => {
            html += `<div style="font-size:8px; padding:3px; background:#1a2a1a; border-radius:2px; margin-bottom:2px;">`;
            html += `${p.playerName} (${p.position}): <strong style="color:var(--success);">${p.rating}</strong>/100`;
            html += `</div>`;
        });
        html += '</div>';
    }

    // Schwächste Spieler
    let worst = getWorstPerformers();
    if (worst.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>⚠️ VERBESSERUNGSBEDARF</h4>';
        worst.forEach(p => {
            html += `<div style="font-size:8px; padding:3px; background:#2a1a1a; border-radius:2px; margin-bottom:2px;">`;
            html += `${p.playerName} (${p.position}): <strong style="color:var(--danger);">${p.rating}</strong>/100`;
            html += `</div>`;
        });
        html += '</div>';
    }

    // Taktische Hinweise
    if (analysis.tacticalInsights.length > 0) {
        html += '<div>';
        html += '<h4>💡 TAKTISCHE HINWEISE</h4>';
        analysis.tacticalInsights.forEach(insight => {
            html += `<div style="background:#1a1a2a; padding:6px; border-radius:3px; margin-bottom:4px;">`;
            html += `<p style="font-size:9px; margin:0;"><strong>${insight.title}</strong></p>`;
            html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">${insight.suggestion}</p>`;
            html += `</div>`;
        });
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
