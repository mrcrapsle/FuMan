/* eslint-disable no-undef */
// Phase 23.6: Formations-Statistiken & Historie
// Verfolgt Performance jeder Formation über die Saison
// Erfasst Win-Rates, Tore, Gegentore und Gegner-spezifische Bilanzen

function ensureFormationStats() {
    if (!game.formationStats) {
        game.formationStats = {
            byFormation: {},
            byOpponent: {},
            seasonTrend: [],
            lastRecorded: null
        };
    }
}

// Initialisiert eine Formation in den Statistiken
function ensureFormationRecord(formation) {
    ensureFormationStats();
    if (!game.formationStats.byFormation[formation]) {
        game.formationStats.byFormation[formation] = {
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            avgGoals: 0,
            avgConceded: 0,
            winRate: 0,
            firstUsed: game.matchday,
            lastUsed: null
        };
    }
}

// Erfasst Ergebnis nach jedem Spiel
function recordFormationResult(formation, homeGoals, awayGoals, opponentName) {
    ensureFormationStats();
    ensureFormationRecord(formation);

    let record = game.formationStats.byFormation[formation];
    let ownGoals = homeGoals; // Annahme: wir sind immer Home
    let oppGoals = awayGoals;
    let result = 'D';

    if (ownGoals > oppGoals) {
        result = 'W';
        record.wins++;
    } else if (ownGoals < oppGoals) {
        result = 'L';
        record.losses++;
    } else {
        result = 'D';
        record.draws++;
    }

    record.matches++;
    record.goalsFor += ownGoals;
    record.goalsAgainst += oppGoals;
    record.lastUsed = game.matchday;

    // Durchschnitte berechnen
    record.avgGoals = (record.goalsFor / record.matches).toFixed(2);
    record.avgConceded = (record.goalsAgainst / record.matches).toFixed(2);
    record.winRate = Math.round((record.wins / record.matches) * 100);

    // Gegner-spezifische Statistik
    if (!game.formationStats.byOpponent[opponentName]) {
        game.formationStats.byOpponent[opponentName] = {};
    }
    if (!game.formationStats.byOpponent[opponentName][formation]) {
        game.formationStats.byOpponent[opponentName][formation] = {
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            winRate: 0
        };
    }

    let oppRecord = game.formationStats.byOpponent[opponentName][formation];
    oppRecord.matches++;
    oppRecord.goalsFor += ownGoals;
    oppRecord.goalsAgainst += oppGoals;

    if (result === 'W') {
        oppRecord.wins++;
    } else if (result === 'D') {
        oppRecord.draws++;
    } else {
        oppRecord.losses++;
    }

    oppRecord.winRate = Math.round((oppRecord.wins / oppRecord.matches) * 100);

    // Saison-Trend
    game.formationStats.seasonTrend.push({
        matchday: game.matchday,
        formation: formation,
        opponent: opponentName,
        result: result,
        goals: ownGoals,
        conceded: oppGoals
    });

    game.formationStats.lastRecorded = game.matchday;
}

// Gibt die beste Formation nach Win-Rate zurück
function getBestFormationByWinRate() {
    ensureFormationStats();
    let records = Object.entries(game.formationStats.byFormation)
        .filter(([_, r]) => r.matches > 0)
        .sort((a, b) => b[1].winRate - a[1].winRate);

    return records.length > 0 ? records[0][0] : null;
}

// Gibt Statistiken gegen einen bestimmten Gegner
function getFormationStatsVsOpponent(formation, opponentName) {
    ensureFormationStats();
    if (!game.formationStats.byOpponent[opponentName]) return null;
    return game.formationStats.byOpponent[opponentName][formation] || null;
}

// Berechnet Trend: besser oder schlechter werdend
function getFormationTrend(formation, matchdayWindow = 5) {
    ensureFormationStats();
    let recent = game.formationStats.seasonTrend
        .filter(t => t.formation === formation && t.matchday >= game.matchday - matchdayWindow)
        .slice(-matchdayWindow);

    if (recent.length < 2) return null;

    let oldWinRate = 0;
    let newWinRate = 0;

    // Erste Hälfte vs. zweite Hälfte
    let firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    let secondHalf = recent.slice(Math.floor(recent.length / 2));

    oldWinRate = firstHalf.filter(t => t.result === 'W').length / firstHalf.length;
    newWinRate = secondHalf.filter(t => t.result === 'W').length / secondHalf.length;

    return newWinRate - oldWinRate;
}

// Rendert das Statistik-Panel
function renderFormationStatsPanel() {
    ensureFormationStats();
    let box = document.getElementById('formation-stats-box');
    if (!box) return;

    let records = Object.entries(game.formationStats.byFormation)
        .filter(([_, r]) => r.matches > 0)
        .sort((a, b) => b[1].winRate - a[1].winRate);

    if (records.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Noch keine Statistiken – spiele Ligaspiele!</div>';
        return;
    }

    let html = '<div style="font-size:9px; max-height:300px; overflow-y:auto;">';

    records.forEach(([formation, stats], idx) => {
        let trend = getFormationTrend(formation);
        let trendIcon = trend === null ? '→' : trend > 0 ? '📈' : '📉';
        let trendColor = trend === null ? 'var(--text-muted)' : trend > 0 ? 'var(--green)' : 'var(--orange)';

        let badge = idx === 0 ? '🏆 ' : '';
        html += `
            <div style="margin:6px 0; padding:6px; background:rgba(100,150,200,0.1); border-radius:4px; border-left:3px solid ${idx === 0 ? 'var(--green)' : 'var(--text-muted)'};">
                <div style="font-weight:bold; margin-bottom:2px;">${badge}${formation}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; font-size:8px; color:var(--text-muted);">
                    <span>⚽ Spiele: <strong>${stats.matches}</strong></span>
                    <span>🎯 Quote: <strong style="color:var(--primary);">${stats.winRate}%</strong></span>
                    <span>📊 Ø Tore: <strong>${stats.avgGoals}</strong></span>
                    <span>🛡️ Ø Gegentore: <strong>${stats.avgConceded}</strong></span>
                </div>
                <div style="margin-top:3px; font-size:8px;">
                    <span style="color:var(--green);">✓ ${stats.wins}</span>
                    <span style="margin-left:6px; color:var(--gold);">= ${stats.draws}</span>
                    <span style="margin-left:6px; color:var(--orange);">✗ ${stats.losses}</span>
                    <span style="float:right; color:${trendColor};">${trendIcon}</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    box.innerHTML = html;
}
