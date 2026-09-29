// Match-Prognose & Wettquoten
// Quoten, Gewinn-Wahrscheinlichkeiten, AI-Vorhersagen

let matchPredictionState = {
    currentMatchOdds: null,
    previousPredictions: [], // Historische Vorhersagen vs. Ergebnisse
    predictionAccuracy: 0, // Prozentuale Trefferquote
    seasonPredictions: [] // Array von { matchday, prediction, actualResult, correct }
};

function initializeMatchPrediction() {
    if (!game.matchPrediction) game.matchPrediction = {};
    if (!game.matchPrediction.predictions) game.matchPrediction.predictions = [];
    if (!game.matchPrediction.accuracy) game.matchPrediction.accuracy = 0;
}

function generateCurrentMatchOdds() {
    let nextMatch = getNextOpponent();
    if (!nextMatch || !nextMatch.opponent) return null;

    let odds = calculateMatchOdds(squad, nextMatch.opponent);
    let prediction = predictMatchOutcome(odds);

    return {
        opponent: nextMatch.name,
        matchday: nextMatch.matchday,
        isHome: nextMatch.isHome,
        odds: odds,
        prediction: prediction,
        timestamp: new Date().getTime()
    };
}

function evaluatePastPredictions() {
    initializeMatchPrediction();

    if (!game.matchResults || game.matchResults.length === 0) return;

    let predictions = game.matchPrediction.predictions || [];
    let correct = 0;
    let total = 0;

    predictions.forEach(pred => {
        let actualMatch = game.matchResults.find(m => m.matchday === pred.matchday);
        if (actualMatch) {
            total++;
            let actualResult = actualMatch.result || (actualMatch.homeScore > actualMatch.awayScore ? 'WIN' :
                              actualMatch.homeScore < actualMatch.awayScore ? 'LOSS' : 'DRAW');

            if (pred.prediction === actualResult) {
                correct++;
                pred.correct = true;
            } else {
                pred.correct = false;
            }
        }
    });

    game.matchPrediction.accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
}

function recordCurrentPrediction() {
    initializeMatchPrediction();

    let odds = generateCurrentMatchOdds();
    if (!odds) return;

    game.matchPrediction.predictions.push({
        matchday: odds.matchday,
        opponent: odds.opponent,
        prediction: odds.prediction,
        odds: odds.odds,
        recorded: new Date().getTime()
    });

    if (game.matchPrediction.predictions.length > 100) {
        game.matchPrediction.predictions.shift();
    }
}

function getPredictionStatistics() {
    initializeMatchPrediction();

    evaluatePastPredictions();

    let predictions = game.matchPrediction.predictions || [];
    let winPredictions = predictions.filter(p => p.prediction === 'WIN').length;
    let drawPredictions = predictions.filter(p => p.prediction === 'DRAW').length;
    let lossPredictions = predictions.filter(p => p.prediction === 'LOSS').length;

    return {
        totalPredictions: predictions.length,
        accuracy: game.matchPrediction.accuracy || 0,
        winPredictions: winPredictions,
        drawPredictions: drawPredictions,
        lossPredictions: lossPredictions,
        recentPredictions: predictions.slice(-10)
    };
}

function getOddsComparison(currentOdds) {
    if (!currentOdds) return null;

    // Vergleich mit durchschnittlichen Quoten der letzten 5 Spiele
    let recentOdds = game.opponentAnalysis.oddsHistory.slice(-5) || [];

    if (recentOdds.length === 0) {
        return {
            avgWinOdds: currentOdds.odds.winOdds,
            avgDrawOdds: currentOdds.odds.drawOdds,
            avgLossOdds: currentOdds.odds.lossOdds,
            trend: 'NEUTRAL'
        };
    }

    let avgWinOdds = recentOdds.reduce((sum, o) => sum + (o.odds.winOdds || 0), 0) / recentOdds.length;
    let avgDrawOdds = recentOdds.reduce((sum, o) => sum + (o.odds.drawOdds || 0), 0) / recentOdds.length;
    let avgLossOdds = recentOdds.reduce((sum, o) => sum + (o.odds.lossOdds || 0), 0) / recentOdds.length;

    let trend = 'NEUTRAL';
    if (currentOdds.odds.winOdds < avgWinOdds) {
        trend = 'IMPROVING'; // Bessere Gewinnchancen als sonst
    } else if (currentOdds.odds.winOdds > avgWinOdds) {
        trend = 'DECLINING'; // Schlechtere Gewinnchancen
    }

    return {
        avgWinOdds: Math.round(avgWinOdds * 100) / 100,
        avgDrawOdds: Math.round(avgDrawOdds * 100) / 100,
        avgLossOdds: Math.round(avgLossOdds * 100) / 100,
        trend: trend
    };
}

function renderMatchPredictionPanel() {
    const container = document.getElementById('match-prediction-box');
    if (!container) return;

    initializeMatchPrediction();

    let currentOdds = generateCurrentMatchOdds();
    if (!currentOdds) {
        container.innerHTML = '<div class="panel-content"><p style="color:var(--text-muted); font-size:9px;">Keine anstehenden Spiele.</p></div>';
        return;
    }

    let comparison = getOddsComparison(currentOdds);
    let stats = getPredictionStatistics();

    let html = '<div class="panel-content">';
    html += '<h3>🎲 WETTQUOTEN & PROGNOSE</h3>';

    // Wett-Quoten Display
    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:10px; margin:0 0 6px 0;"><strong>Spieltag ${currentOdds.matchday}</strong></p>`;

    // Wahrscheinlichkeiten
    html += '<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px; margin-bottom:6px;">';
    html += `<div style="background:#1a2a1a; padding:4px; border-radius:2px; text-align:center;">`;
    html += `<p style="font-size:8px; margin:0; color:var(--success);">SIEG</p>`;
    html += `<p style="font-size:11px; margin:2px 0 0 0; font-weight:bold; color:var(--primary);">${currentOdds.odds.winChance}%</p>`;
    html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Quote: ${currentOdds.odds.winOdds.toFixed(2)}</p>`;
    html += `</div>`;

    html += `<div style="background:#1a1a2a; padding:4px; border-radius:2px; text-align:center;">`;
    html += `<p style="font-size:8px; margin:0; color:var(--accent);">UNENTSCH.</p>`;
    html += `<p style="font-size:11px; margin:2px 0 0 0; font-weight:bold; color:var(--primary);">${currentOdds.odds.drawChance}%</p>`;
    html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Quote: ${currentOdds.odds.drawOdds.toFixed(2)}</p>`;
    html += `</div>`;

    html += `<div style="background:#2a1a1a; padding:4px; border-radius:2px; text-align:center;">`;
    html += `<p style="font-size:8px; margin:0; color:var(--danger);">NIEDERLAGE</p>`;
    html += `<p style="font-size:11px; margin:2px 0 0 0; font-weight:bold; color:var(--primary);">${currentOdds.odds.lossChance}%</p>`;
    html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Quote: ${currentOdds.odds.lossOdds.toFixed(2)}</p>`;
    html += `</div>`;
    html += '</div>';

    // Prognose
    let predictionIcon = currentOdds.prediction === 'WIN' ? '🟢' : currentOdds.prediction === 'DRAW' ? '🟡' : '🔴';
    let predictionText = currentOdds.prediction === 'WIN' ? 'SIEG' : currentOdds.prediction === 'DRAW' ? 'UNENTSCHIEDEN' : 'NIEDERLAGE';
    html += `<p style="font-size:9px; margin:0; text-align:center;"><strong>${predictionIcon} KI-VORHERSAGE: ${predictionText}</strong></p>`;

    html += '</div>';

    // Trend vs. Durchschnitt
    if (comparison) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>📊 TREND (vs. letzte 5 Spiele)</h4>';

        let trendColor = comparison.trend === 'IMPROVING' ? 'var(--success)' :
                        comparison.trend === 'DECLINING' ? 'var(--danger)' : 'var(--text-muted)';
        let trendText = comparison.trend === 'IMPROVING' ? '📈 Bessere Chancen als üblich' :
                       comparison.trend === 'DECLINING' ? '📉 Schlechtere Chancen als üblich' : '➡️ Durchschnittlich';

        html += `<p style="font-size:9px; margin:0; color:${trendColor};"><strong>${trendText}</strong></p>`;
        html += `<p style="font-size:8px; margin:4px 0 0 0; color:var(--text-muted);">`;
        html += `Ø Quote Sieg: ${comparison.avgWinOdds.toFixed(2)} | Unent.: ${comparison.avgDrawOdds.toFixed(2)} | Nieder.: ${comparison.avgLossOdds.toFixed(2)}`;
        html += `</p>`;
        html += '</div>';
    }

    // Genauigkeitsstatistiken
    html += '<div style="margin-bottom:10px;">';
    html += '<h4>🎯 VORHERSAGE-GENAUIGKEIT</h4>';
    html += `<div style="background:#1a2a1a; padding:6px; border-radius:3px; margin-bottom:4px;">`;
    html += `<p style="font-size:9px; margin:0;"><strong>Trefferquote: ${stats.accuracy}%</strong></p>`;
    html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Insgesamt ${stats.totalPredictions} Prognosen</p>`;
    html += `</div>`;

    if (stats.recentPredictions.length > 0) {
        html += '<div style="font-size:8px;">';
        html += '<strong>Letzte Prognosen:</strong><br>';
        stats.recentPredictions.slice(-3).reverse().forEach(pred => {
            let predIcon = pred.prediction === 'WIN' ? '🟢' : pred.prediction === 'DRAW' ? '🟡' : '🔴';
            let correctIcon = pred.correct ? '✅' : pred.correct === false ? '❌' : '⏳';
            html += `${correctIcon} ST${pred.matchday}: ${predIcon} ${pred.prediction} vs ${pred.opponent}<br>`;
        });
        html += '</div>';
    }

    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}

function tickMatchPrediction() {
    initializeMatchPrediction();

    // Nur wenn Match ansteht
    let nextMatch = getNextOpponent();
    if (!nextMatch) return;

    // Prognose aufzeichnen (einmal pro Matchday)
    let existingPrediction = game.matchPrediction.predictions.find(p =>
        p.matchday === nextMatch.matchday
    );

    if (!existingPrediction) {
        recordCurrentPrediction();
    }

    // Vergangene Vorhersagen vs. tatsächliche Ergebnisse vergleichen
    evaluatePastPredictions();
}
