/* eslint-disable no-undef */
// Phase 23.17: Liga-Tendenzen-Analyse
// Erkenne Trends in der Liga: erfolgreiche Formationen, Spielstile, wertvolle Spieler-Typen

function ensureLeagueTrendsAnalysis() {
    if (!game.leagueTrends) {
        game.leagueTrends = {
            formations: {},
            playstyles: {},
            playerTypes: {},
            trends: []
        };
    }
}

function analyzeLeagueTrends() {
    ensureLeagueTrendsAnalysis();

    let league = leaguesData[game.leagueLevel];
    if (!league || !league.table) return null;

    let trends = {
        dominantFormation: '',
        dominantPlaystyle: '',
        valuablePlayerTypes: [],
        successMetrics: []
    };

    // Analysiere Top 5 Teams
    let topTeams = league.table.slice(0, 5);
    let formationCount = {};
    let strengthSum = 0;

    topTeams.forEach(team => {
        strengthSum += team.strength || 75;

        // Formation wird aus Team-Struktur abgeleitet
        let formation = '4-3-3'; // default
        if (team.strength > 85) formation = '4-2-3-1';
        else if (team.strength > 75) formation = '4-3-3';
        else formation = '5-3-2';

        formationCount[formation] = (formationCount[formation] || 0) + 1;
    });

    // Dominanteste Formation
    let maxCount = 0;
    Object.keys(formationCount).forEach(form => {
        if (formationCount[form] > maxCount) {
            maxCount = formationCount[form];
            trends.dominantFormation = form;
        }
    });

    // Durchschnittliche Stärke Top Teams
    let avgTopStrength = strengthSum / topTeams.length;

    // Spielstil Analyse basierend auf Liga-Eigenschaften
    if (game.leagueLevel === 1) {
        trends.dominantPlaystyle = 'Ballbesitz & Kontrolle';
        trends.successMetrics.push('Hohe Passquote (>80%)');
        trends.successMetrics.push('Taktische Flexibilität');
    } else if (game.leagueLevel === 2) {
        trends.dominantPlaystyle = 'Ausgewogenes Spiel';
        trends.successMetrics.push('Robuste Defensive');
        trends.successMetrics.push('Effiziente Konter');
    } else {
        trends.dominantPlaystyle = 'Pressives Spiel';
        trends.successMetrics.push('Hohes Pressing');
        trends.successMetrics.push('Schnelle Umschaltungen');
    }

    // Wertvolle Spieler-Typen basierend auf Liga
    if (avgTopStrength > 75) {
        trends.valuablePlayerTypes.push({
            type: 'Erfahrene Anführer',
            reason: 'Stabilität und Mentorschaft',
            bonus: '+2% Moral'
        });
        trends.valuablePlayerTypes.push({
            type: 'Technisch versierte Mittelfeld',
            reason: 'Ballkontrolle in harten Spielen',
            bonus: '+1.5% Ballbesitz'
        });
    } else {
        trends.valuablePlayerTypes.push({
            type: 'Physisch starke Spieler',
            reason: 'Wichtig für direktes Spiel',
            bonus: '+3% Zweikämpfe'
        });
        trends.valuablePlayerTypes.push({
            type: 'Schnelle Außenspieler',
            reason: 'Flügelspiel dominiert',
            bonus: '+2% Tempo'
        });
    }

    game.leagueTrends = {
        formations: formationCount,
        dominantFormation: trends.dominantFormation,
        dominantPlaystyle: trends.dominantPlaystyle,
        valuablePlayerTypes: trends.valuablePlayerTypes,
        successMetrics: trends.successMetrics,
        avgTopStrength: Math.round(avgTopStrength),
        lastUpdated: game.matchday
    };

    return trends;
}

function getLeagueTrendAlignment(myFormation, myPlaystyle) {
    ensureLeagueTrendsAnalysis();

    let alignment = 0;

    if (game.leagueTrends.dominantFormation === myFormation) {
        alignment += 2; // 2% Bonus für Formation
    }

    if (game.leagueTrends.dominantPlaystyle.includes(myPlaystyle)) {
        alignment += 1.5; // 1,5% Bonus für Spielstil
    }

    return alignment;
}

function renderLeagueTrendsAnalysisPanel() {
    ensureLeagueTrendsAnalysis();
    let box = document.getElementById('league-trends-box');
    if (!box) return;

    let trends = analyzeLeagueTrends();
    if (!trends) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Keine Liga-Daten verfügbar.</div>';
        return;
    }

    let html = `
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:6px;">📊 Liga-Tendenzen Spieltag ${game.matchday}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:9px;">
                <div style="background:rgba(0,0,0,0.2); padding:6px; border-radius:3px;">
                    <div style="color:var(--text-muted); font-size:8px;">Dominant Formation</div>
                    <div style="font-weight:bold; color:var(--accent);">${game.leagueTrends.dominantFormation}</div>
                </div>
                <div style="background:rgba(0,0,0,0.2); padding:6px; border-radius:3px;">
                    <div style="color:var(--text-muted); font-size:8px;">Top-Teams Ø Stärke</div>
                    <div style="font-weight:bold; color:var(--accent);">${game.leagueTrends.avgTopStrength}/100</div>
                </div>
            </div>
        </div>

        <div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--accent);">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">🎯 Dominanter Spielstil:</div>
            <div style="font-size:9px; color:var(--accent); margin-bottom:4px;">${game.leagueTrends.dominantPlaystyle}</div>
            <div style="font-size:8px;">
                ${game.leagueTrends.successMetrics.map(m => `<div>✓ ${m}</div>`).join('')}
            </div>
        </div>

        <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">⭐ Wertvolle Spieler-Typen:</div>
            ${game.leagueTrends.valuablePlayerTypes.map(pt => `
                <div style="font-size:8px; margin-bottom:3px; padding:3px; background:rgba(0,0,0,0.2); border-radius:2px;">
                    <div style="font-weight:bold;">${pt.type}</div>
                    <div style="color:var(--text-muted);">→ ${pt.reason}</div>
                    <div style="color:var(--accent);">${pt.bonus}</div>
                </div>
            `).join('')}
        </div>

        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Passe deine Strategie an die Liga-Tendenzen an für bessere Ergebnisse.
        </div>
    `;

    box.innerHTML = html;
}
