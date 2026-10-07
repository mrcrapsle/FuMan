/* eslint-disable no-undef */
// Phase 23.19: Historische Gegner-Statistiken
// Gewinn-/Verlust-Bilanz und Spielverlauf-Muster gegen jeden Gegner erfassen

function ensureOpponentHistoryStats() {
    if (!game.opponentHistoryStats) {
        game.opponentHistoryStats = {};
    }
}

function recordOpponentMatch(oppName, result, goalsFor, goalsAgainst) {
    ensureOpponentHistoryStats();
    let key = oppName;

    if (!game.opponentHistoryStats[key]) {
        game.opponentHistoryStats[key] = {
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            lastResult: null,
            lastMatchday: 0,
            streak: 0,
            streakType: null
        };
    }

    let stats = game.opponentHistoryStats[key];
    stats.matches += 1;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    stats.lastResult = result;
    stats.lastMatchday = game.matchday;

    // Update Bilanz
    if (result === 'win') {
        stats.wins += 1;
        stats.streak = stats.streakType === 'win' ? stats.streak + 1 : 1;
        stats.streakType = 'win';
    } else if (result === 'draw') {
        stats.draws += 1;
        stats.streak = 1;
        stats.streakType = 'draw';
    } else if (result === 'loss') {
        stats.losses += 1;
        stats.streak = stats.streakType === 'loss' ? stats.streak + 1 : 1;
        stats.streakType = 'loss';
    }
}

function getOpponentHistoryBonus(oppName) {
    ensureOpponentHistoryStats();
    let stats = game.opponentHistoryStats[oppName];
    if (!stats || stats.matches === 0) return 0;

    // Gewinn-Bonus basierend auf Bilanz
    let winRate = stats.wins / stats.matches;
    if (winRate >= 0.7) return 2; // 2% Bonus gegen bekannte Gegner mit guter Bilanz
    if (winRate >= 0.5) return 1;
    if (winRate < 0.3) return -1; // Malus gegen häufige Gegner
    return 0;
}

function getOpponentPattern(oppName) {
    ensureOpponentHistoryStats();
    let stats = game.opponentHistoryStats[oppName];
    if (!stats || stats.matches < 3) return 'Unbekannt';

    let winRate = stats.wins / stats.matches;
    let avgGoalsFor = stats.goalsFor / stats.matches;
    let avgGoalsAgainst = stats.goalsAgainst / stats.matches;

    if (avgGoalsAgainst > avgGoalsFor + 1) return 'Defensiv schwach';
    if (avgGoalsFor < avgGoalsAgainst - 1) return 'Offensiv schwach';
    if (stats.draws / stats.matches > 0.4) return 'Defensiv stabil';
    if (winRate > 0.6) return 'Oft besiegt';
    return 'Ausgeglichen';
}

function renderOpponentHistoryPanel() {
    ensureOpponentHistoryStats();
    let box = document.getElementById('opponent-history-box');
    if (!box) return;

    let stats = game.opponentHistoryStats;
    let opponents = Object.keys(stats)
        .map(name => ({
            name: name,
            data: stats[name],
            bonus: getOpponentHistoryBonus(name),
            pattern: getOpponentPattern(name)
        }))
        .sort((a, b) => b.data.matches - a.data.matches)
        .slice(0, 8);

    if (opponents.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Noch keine Spielhistorie gegen Gegner.</div>';
        return;
    }

    let html = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Historische Gegner-Bilanz (häufigste Gegner):</div>';

    opponents.forEach(opp => {
        let winRate = opp.data.matches > 0 ? Math.round((opp.data.wins / opp.data.matches) * 100) : 0;
        let bonusColor = opp.bonus > 0 ? 'var(--accent)' : (opp.bonus < 0 ? 'var(--danger)' : 'var(--text-muted)');
        let bonusText = opp.bonus > 0 ? '+' + opp.bonus + '%' : opp.bonus + '%';

        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <div style="font-weight:bold; font-size:10px;">${opp.name}</div>
                    <div style="font-size:9px; color:${bonusColor};">${bonusText}</div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:3px; margin-bottom:3px; font-size:8px;">
                    <div style="background:rgba(0,0,0,0.2); padding:3px; border-radius:2px; text-align:center;">
                        <div style="color:var(--text-muted);">Spiele</div>
                        <div style="font-weight:bold;">${opp.data.matches}</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:3px; border-radius:2px; text-align:center;">
                        <div style="color:var(--text-muted);">Bilanz</div>
                        <div style="font-weight:bold;">${opp.data.wins}-${opp.data.draws}-${opp.data.losses}</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:3px; border-radius:2px; text-align:center;">
                        <div style="color:var(--text-muted);">Gewinn%</div>
                        <div style="font-weight:bold; color:var(--accent);">${winRate}%</div>
                    </div>
                </div>
                <div style="font-size:8px; color:var(--text-muted);">
                    Muster: <strong>${opp.pattern}</strong> · ${opp.data.goalsFor}:${opp.data.goalsAgainst} Tore
                </div>
            </div>
        `;
    });

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Gute Bilanzen gegen bekannte Gegner geben dir einen Vorteil in Rematch-Spielen.
        </div>
    `;

    box.innerHTML = html;
}
