// Gegner-Analyse & Match-Vorbereitung
// Scout-Berichte, Gegner-Statistiken, Formkurven, Wettquoten

let opponentAnalysisState = {
    lastOpponentData: null,
    scoutReports: [], // Array von { opponent, matchday, formation, avgStrength, recentResults, topScorers }
    formHistories: {}, // { clubName: [{ matchday, result, opponent, gf, ga }] }
    oddsHistory: [] // Array von { matchday, opponent, ourWinOdds, drawOdds, lossOdds, prediction }
};

function initializeOpponentAnalysis() {
    if (!game.opponentAnalysis) game.opponentAnalysis = {};
    if (!game.opponentAnalysis.scoutReports) game.opponentAnalysis.scoutReports = [];
    if (!game.opponentAnalysis.formHistories) game.opponentAnalysis.formHistories = {};
    if (!game.opponentAnalysis.oddsHistory) game.opponentAnalysis.oddsHistory = [];
}

function getNextOpponent() {
    if (!leaguesData || !leaguesData[game.leagueLevel]) return null;

    let currentLeague = leaguesData[game.leagueLevel];
    let fixtures = currentLeague.fixtures || [];

    let nextMatch = fixtures.find(f =>
        (f.homeTeam === game.clubId || f.awayTeam === game.clubId) &&
        f.matchday >= game.matchday
    );

    if (!nextMatch) return null;

    let isHome = nextMatch.homeTeam === game.clubId;
    let opponentId = isHome ? nextMatch.awayTeam : nextMatch.homeTeam;
    let opponent = currentLeague.find(t => t.id === opponentId);

    return {
        id: opponentId,
        name: opponent ? opponent.name : 'Unbekannt',
        isHome: isHome,
        matchday: nextMatch.matchday,
        opponent: opponent
    };
}

function calculateOpponentFormation(opponentTeam) {
    if (!opponentTeam) return null;

    let formation = '4-3-3'; // Standard
    let avgStrength = opponentTeam.avgStrength || 70;

    // Formation basierend auf Liga-Level und Stärke
    if (avgStrength > 85) {
        formation = '4-2-3-1'; // Defensiv für starke Teams
    } else if (avgStrength < 60) {
        formation = '3-5-2'; // Offensiv für schwache Teams
    }

    return {
        formation: formation,
        avgStrength: avgStrength,
        wins: opponentTeam.wins || 0,
        draws: opponentTeam.draws || 0,
        losses: opponentTeam.losses || 0,
        goalsFor: opponentTeam.gf || 0,
        goalsAgainst: opponentTeam.ga || 0
    };
}

function getOpponentRecentResults(opponentName, limit = 5) {
    let results = [];

    if (game.matchResults && Array.isArray(game.matchResults)) {
        let opponentMatches = game.matchResults.filter(m =>
            (m.opponent === opponentName || m.homeTeam === opponentName || m.awayTeam === opponentName) &&
            m.matchday <= game.matchday
        ).slice(-limit);

        results = opponentMatches.map(m => ({
            matchday: m.matchday,
            season: m.season,
            result: m.result || (m.homeScore > m.awayScore ? 'W' : m.homeScore < m.awayScore ? 'L' : 'D'),
            score: `${m.homeScore || 0}-${m.awayScore || 0}`,
            opponent: m.opponent || 'Unbekannt'
        }));
    }

    return results.length > 0 ? results : null;
}

function getOpponentTopScorers(opponent, limit = 3) {
    if (!opponent || !opponent.players) return [];

    let scorers = opponent.players
        .filter(p => p.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, limit)
        .map(p => ({
            name: p.name,
            goals: p.goals,
            assists: p.assists || 0,
            strength: p.strength || 70
        }));

    return scorers;
}

function recordScoutReport(opponentTeam) {
    initializeOpponentAnalysis();

    let nextMatch = getNextOpponent();
    if (!nextMatch) return;

    let formation = calculateOpponentFormation(opponentTeam);
    let recentResults = getOpponentRecentResults(nextMatch.name);
    let topScorers = getOpponentTopScorers(opponentTeam);

    let report = {
        opponent: nextMatch.name,
        opponentId: nextMatch.id,
        matchday: game.matchday,
        season: game.season,
        isHome: nextMatch.isHome,
        formation: formation,
        recentResults: recentResults,
        topScorers: topScorers,
        timestamp: new Date().getTime()
    };

    game.opponentAnalysis.scoutReports.push(report);
    if (game.opponentAnalysis.scoutReports.length > 20) {
        game.opponentAnalysis.scoutReports.shift();
    }

    opponentAnalysisState.lastOpponentData = report;
    return report;
}

function calculateMatchOdds(ourTeam, opponentTeam) {
    if (!ourTeam || !opponentTeam) {
        return { winOdds: 1.8, drawOdds: 3.5, lossOdds: 4.2 };
    }

    let ourStrength = ourTeam.avgStrength || 70;
    let oppStrength = opponentTeam.avgStrength || 70;
    let strengthDiff = ourStrength - oppStrength;

    // Basis-Wahrscheinlichkeit basierend auf Stärke-Differenz
    let winChance = 50 + (strengthDiff * 0.8); // -80 bis +80
    let lossChance = 50 - (strengthDiff * 0.8);
    let drawChance = 25;

    // Home-Vorteil anwenden (+5%)
    let nextMatch = getNextOpponent();
    if (nextMatch && nextMatch.isHome) {
        winChance += 5;
        lossChance -= 5;
    }

    // Normalisieren (summe = 100)
    let total = winChance + drawChance + lossChance;
    winChance = Math.max(5, Math.min(75, (winChance / total) * 100));
    lossChance = Math.max(5, Math.min(75, (lossChance / total) * 100));
    drawChance = 100 - winChance - lossChance;

    // Wettquoten berechnen (inverse Wahrscheinlichkeit)
    let winOdds = Math.round((100 / Math.max(5, winChance)) * 100) / 100;
    let drawOdds = Math.round((100 / Math.max(5, drawChance)) * 100) / 100;
    let lossOdds = Math.round((100 / Math.max(5, lossChance)) * 100) / 100;

    return {
        winChance: Math.round(winChance),
        drawChance: Math.round(drawChance),
        lossChance: Math.round(lossChance),
        winOdds: Math.max(1.01, winOdds),
        drawOdds: Math.max(1.01, drawOdds),
        lossOdds: Math.max(1.01, lossOdds)
    };
}

function predictMatchOutcome(odds) {
    let rand = Math.random() * 100;
    if (rand < odds.winChance) return 'WIN';
    if (rand < odds.winChance + odds.drawChance) return 'DRAW';
    return 'LOSS';
}

function recordMatchPrediction(opponentTeam) {
    initializeOpponentAnalysis();

    let nextMatch = getNextOpponent();
    if (!nextMatch) return;

    let odds = calculateMatchOdds(squad, opponentTeam);
    let prediction = predictMatchOutcome(odds);

    let entry = {
        matchday: game.matchday,
        opponent: nextMatch.name,
        opponentId: nextMatch.id,
        odds: odds,
        prediction: prediction,
        timestamp: new Date().getTime()
    };

    game.opponentAnalysis.oddsHistory.push(entry);
    if (game.opponentAnalysis.oddsHistory.length > 50) {
        game.opponentAnalysis.oddsHistory.shift();
    }
}

function getTacticalRecommendations(opponentFormation) {
    if (!opponentFormation) return [];

    let recommendations = [];
    let oppFormation = opponentFormation.formation || '4-3-3';

    // Formation-basierte Empfehlungen
    if (oppFormation === '4-3-3') {
        recommendations.push({
            title: '5-3-2 Counter',
            benefit: '+8% Gewinnchance',
            explanation: 'Blockiert die Flügel, Extra-Abwehrspieler gegen breite Spielweise'
        });
    } else if (oppFormation === '4-2-3-1') {
        recommendations.push({
            title: '3-5-2 Überfall',
            benefit: '+6% Gewinnchance',
            explanation: 'Überzahl im Mittelfeld, Druck auf Gegenspieler'
        });
    } else if (oppFormation === '3-5-2') {
        recommendations.push({
            title: '4-3-3 Klassiker',
            benefit: '+7% Gewinnchance',
            explanation: 'Stabile Vier, Seitenspieler überlasten die Flügel'
        });
    }

    // Stärke-basierte Empfehlungen
    if (opponentFormation.avgStrength > 85) {
        recommendations.push({
            title: '🛡️ Defensiv spielen',
            benefit: '+4% Unentschieden',
            explanation: 'Kompaktes Mittelfeld, schnelle Konter'
        });
    } else if (opponentFormation.avgStrength < 65) {
        recommendations.push({
            title: '⚽ Offensiv drücken',
            benefit: '+5% Gewinnchance',
            explanation: 'Hohes Pressing, frühe Ballgewinne'
        });
    }

    return recommendations;
}

function renderOpponentAnalysisPanel() {
    const container = document.getElementById('opponent-analysis-box');
    if (!container) return;

    initializeOpponentAnalysis();

    let nextMatch = getNextOpponent();
    if (!nextMatch) {
        container.innerHTML = '<div class="panel-content"><p style="color:var(--text-muted); font-size:9px;">Keine anstehenden Spiele.</p></div>';
        return;
    }

    let html = '<div class="panel-content">';
    html += '<h3>📊 GEGNER-ANALYSE</h3>';

    // Gegner-Übersicht
    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:10px; margin:0;"><strong>${nextMatch.name}</strong> (Spieltag ${nextMatch.matchday})</p>`;
    html += `<p style="font-size:9px; margin:4px 0 0 0; color:var(--text-muted);">${nextMatch.isHome ? '🏠 Heimspiel' : '✈️ Auswärtsspiel'}</p>`;
    html += '</div>';

    // Letzte Scout-Report anzeigen
    let report = opponentAnalysisState.lastOpponentData;
    if (report) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>📋 FORMATION & STÄRKE</h4>';
        html += `<div style="background:#1a2a1a; padding:6px; border-radius:3px; margin-bottom:4px;">`;
        html += `<p style="font-size:9px; margin:0;"><strong>${report.formation.formation}</strong> | Ø Stärke: ${report.formation.avgStrength}</p>`;
        html += `<p style="font-size:8px; color:var(--text-muted); margin:2px 0 0 0;">S/U/N: ${report.formation.wins}/${report.formation.draws}/${report.formation.losses} | Tore: ${report.formation.goalsFor}:${report.formation.goalsAgainst}</p>`;
        html += `</div>`;
        html += '</div>';

        // Top-Torschützen
        if (report.topScorers && report.topScorers.length > 0) {
            html += '<div style="margin-bottom:10px;">';
            html += '<h4>⚽ TOP-TORSCHÜTZEN</h4>';
            report.topScorers.forEach(scorer => {
                html += `<div style="font-size:8px; padding:3px; background:#2a1a1a; border-radius:2px; margin-bottom:2px;">`;
                html += `${scorer.name}: <strong style="color:var(--primary);">${scorer.goals} Tore</strong> (ST ${scorer.strength})`;
                html += `</div>`;
            });
            html += '</div>';
        }

        // Letzte Ergebnisse
        if (report.recentResults && report.recentResults.length > 0) {
            html += '<div style="margin-bottom:10px;">';
            html += '<h4>📈 LETZTE 5 SPIELE</h4>';
            report.recentResults.forEach(result => {
                let resultColor = result.result === 'W' ? 'var(--success)' : result.result === 'L' ? 'var(--danger)' : 'var(--text-muted)';
                html += `<div style="font-size:8px; padding:2px; margin-bottom:1px;">`;
                html += `<span style="color:${resultColor}; font-weight:bold;">${result.result}</span> ${result.score} vs ${result.opponent} (ST ${result.matchday})`;
                html += `</div>`;
            });
            html += '</div>';
        }
    }

    // Wett-Quoten anzeigen (von match-prediction.js)
    if (typeof renderMatchPredictionPanel === 'function') {
        // Die Prognose wird separat in einem eigenen Panel angezeigt
    }

    html += '</div>';
    container.innerHTML = html;
}

function tickOpponentAnalysis() {
    initializeOpponentAnalysis();

    let nextMatch = getNextOpponent();
    if (!nextMatch || !nextMatch.opponent) return;

    // Scout-Report aktualisieren (nur einmal pro anstehenden Match)
    let existingReport = game.opponentAnalysis.scoutReports.find(r =>
        r.opponent === nextMatch.name && r.matchday === nextMatch.matchday
    );

    if (!existingReport) {
        recordScoutReport(nextMatch.opponent);
        recordMatchPrediction(nextMatch.opponent);
    }
}
