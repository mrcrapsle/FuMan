/* eslint-disable no-undef */
// Phase 23.7: Gegner-Formations-Analyse
// Analysiert die Formation des nächsten Gegners und empfiehlt eine Gegen-Formation
// Zeigt historische Bilanzen und Matchup-Effektivität

function ensureOpponentFormationAnalysis() {
    if (!game.opponentFormationAnalysis) {
        game.opponentFormationAnalysis = {
            lastAnalyzedMatchday: null,
            lastAnalyzedOpponent: null,
            recommendation: null,
            opponentEstimatedFormation: null
        };
    }
}

// Rock-Paper-Scissors Formation-Matchup: welche Formation schlägt welche?
let FORMATION_MATCHUP = {
    '4-4-2': { beats: ['3-5-2', '5-4-1'], beats_strong: ['4-1-4-1'] },
    '4-3-3': { beats: ['5-3-2', '4-4-2'], beats_strong: ['3-4-3'] },
    '3-5-2': { beats: ['4-2-3-1', '4-3-3'], beats_strong: ['5-4-1'] },
    '5-3-2': { beats: ['3-4-3', '4-3-3'], beats_strong: ['4-4-2'] },
    '4-2-3-1': { beats: ['5-3-2', '4-4-2'], beats_strong: ['4-1-4-1'] },
    '4-1-4-1': { beats: ['3-5-2', '5-4-1'], beats_strong: ['4-3-3'] },
    '3-4-3': { beats: ['4-2-3-1', '5-3-2'], beats_strong: ['4-4-2'] },
    '5-4-1': { beats: ['4-3-3', '4-2-3-1'], beats_strong: ['3-4-3'] }
};

// Schätzt die Formation eines AI-Gegners basierend auf seiner Spielweise
function estimateOpponentFormation(opponentName) {
    let team = leaguesData[game.leagueLevel]?.find(t => t.name === opponentName);
    if (!team) return '4-3-3'; // Default-Formation

    // Stärkere Teams spielen offensiver
    if (team.strength > 80) {
        return Math.random() < 0.6 ? '4-3-3' : '3-4-3';
    } else if (team.strength > 70) {
        return Math.random() < 0.5 ? '4-3-3' : '4-4-2';
    } else {
        return Math.random() < 0.4 ? '5-3-2' : '4-4-2';
    }
}

// Berechnet Matchup-Bonus: wie gut unsere Formation gegen deren Formation passt
function getFormationMatchupBonus(ourFormation, oppFormation) {
    let matchup = FORMATION_MATCHUP[ourFormation];
    if (!matchup) return 0;

    // +2.5 wenn wir schlagen, -1.5 wenn sie schlagen
    if (matchup.beats?.includes(oppFormation)) return 2.5;
    if (matchup.beats_strong?.includes(oppFormation)) return 1.5;

    // Gegenseite checken
    let oppMatchup = FORMATION_MATCHUP[oppFormation];
    if (oppMatchup?.beats?.includes(ourFormation)) return -1.5;
    if (oppMatchup?.beats_strong?.includes(ourFormation)) return -0.5;

    return 0;
}

// Findet beste Formation gegen einen spezifischen Gegner
function getBestFormationVsOpponent(opponentFormation) {
    let formations = Object.keys(FORMATION_MATCHUP);
    let scored = formations.map(f => ({
        formation: f,
        matchupBonus: getFormationMatchupBonus(f, opponentFormation),
        winRate: game.formationStats?.byFormation?.[f]?.winRate || 50
    }));

    // Kombiniert Matchup-Effektivität mit historischer Win-Rate
    scored.forEach(s => {
        s.score = (s.matchupBonus * 3) + (s.winRate / 20);
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0];
}

// Zeigt, wie es uns gegen diese Formation bisher ergangen ist
function getHistoricalStatsVsFormation(oppFormation) {
    let formations = Object.keys(game.formationStats?.byFormation || {});
    let results = {};

    formations.forEach(ourForm => {
        let matchups = 0;
        let wins = 0;
        let draws = 0;
        let losses = 0;

        // Zähle alle Spiele, wo die Gegner diese Formation wahrscheinlich hatten
        (game.formationStats?.seasonTrend || []).forEach(t => {
            if (t.formation === ourForm) {
                matchups++;
                if (t.result === 'W') wins++;
                if (t.result === 'D') draws++;
                if (t.result === 'L') losses++;
            }
        });

        if (matchups > 0) {
            results[ourForm] = {
                matchups,
                wins,
                draws,
                losses,
                winRate: Math.round((wins / matchups) * 100)
            };
        }
    });

    return results;
}

// Analysiert den nächsten Gegner
function analyzeUpcomingOpponent() {
    ensureOpponentFormationAnalysis();

    let nextFixture = null;
    let fixtureList = fixturesData[game.leagueLevel]?.[game.matchday - 1] || [];

    for (let f of fixtureList) {
        if ((f.home === leaguesData[game.leagueLevel].findIndex(t => t.name === game.clubName) ||
             f.away === leaguesData[game.leagueLevel].findIndex(t => t.name === game.clubName)) &&
            !f.played) {
            nextFixture = f;
            break;
        }
    }

    if (!nextFixture) return null;

    let isHome = nextFixture.home === leaguesData[game.leagueLevel].findIndex(t => t.name === game.clubName);
    let oppIndex = isHome ? nextFixture.away : nextFixture.home;
    let oppTeam = leaguesData[game.leagueLevel][oppIndex];
    let opponentName = oppTeam?.name || 'Unbekannt';

    // Schätze Gegner-Formation
    let estimatedOppFormation = estimateOpponentFormation(opponentName);

    // Finde beste Formation gegen diese
    let recommendation = getBestFormationVsOpponent(estimatedOppFormation);

    // Speichere Analyse
    game.opponentFormationAnalysis.lastAnalyzedMatchday = game.matchday;
    game.opponentFormationAnalysis.lastAnalyzedOpponent = opponentName;
    game.opponentFormationAnalysis.opponentEstimatedFormation = estimatedOppFormation;
    game.opponentFormationAnalysis.recommendation = recommendation;

    return {
        opponent: opponentName,
        oppStrength: oppTeam?.strength || 70,
        estimatedFormation: estimatedOppFormation,
        recommendedFormation: recommendation.formation,
        recommendedScore: recommendation.score,
        matchupBonus: recommendation.matchupBonus,
        historicalWinRate: recommendation.winRate
    };
}

// Rendert das Gegner-Analyse-Panel
function renderOpponentFormationPanel() {
    ensureOpponentFormationAnalysis();
    let box = document.getElementById('opponent-formation-box');
    if (!box) return;

    let analysis = game.opponentFormationAnalysis;

    // Nur anzeigen wenn aktuell analysiert
    if (analysis.lastAnalyzedMatchday !== game.matchday) {
        analyzeUpcomingOpponent();
    }

    if (!analysis.recommendation || !analysis.opponentEstimatedFormation) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Keine Gegner im aktuellen Spieltag</div>';
        return;
    }

    let rec = analysis.recommendation;
    let bonusColor = rec.matchupBonus > 0 ? 'var(--green)' : rec.matchupBonus < 0 ? 'var(--orange)' : 'var(--text-muted)';
    let bonusIcon = rec.matchupBonus > 1 ? '🔥' : rec.matchupBonus > 0 ? '✓' : rec.matchupBonus < -1 ? '⚠️' : '→';

    let html = `
        <div style="font-size:10px; color:var(--text-muted); margin-bottom:8px;">
            <strong>Gegner:</strong> ${analysis.lastAnalyzedOpponent} (Stärke: ${analysis.oppStrength})
        </div>
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-size:9px; margin-bottom:4px;">
                <span style="color:var(--text-muted);">🎲 Geschätzte Formation:</span>
                <span style="font-weight:bold; color:var(--primary);">${analysis.opponentEstimatedFormation}</span>
            </div>
            <div style="font-size:9px;">
                <span style="color:var(--text-muted);">🎯 Empfehlung:</span>
                <span style="font-weight:bold; color:var(--accent);">${rec.formation}</span>
                <span style="color:${bonusColor}; font-weight:bold; margin-left:4px;">${bonusIcon} ${rec.matchupBonus > 0 ? '+' : ''}${rec.matchupBonus.toFixed(1)}</span>
            </div>
        </div>
        <div style="font-size:9px; grid-template-columns: 1fr 1fr; gap:8px; display:grid;">
            <div style="background:rgba(100,150,200,0.05); padding:6px; border-radius:4px;">
                <div style="color:var(--text-muted); margin-bottom:2px;">📊 Ø Win-Rate</div>
                <div style="font-weight:bold; color:var(--primary);">${rec.winRate}%</div>
            </div>
            <div style="background:rgba(100,150,200,0.05); padding:6px; border-radius:4px;">
                <div style="color:var(--text-muted); margin-bottom:2px;">⚔️ Matchup</div>
                <div style="font-weight:bold; color:${bonusColor};">${bonusIcon} ${bonusColor === 'var(--green)' ? 'Vorteil' : bonusColor === 'var(--orange)' ? 'Nachteil' : 'Neutral'}</div>
            </div>
        </div>
        <button onclick="applyFormationRecommendation('${rec.formation}')" class="btn-action" style="width:100%; margin-top:8px; font-size:10px;">
            ✓ ${rec.formation} aktivieren
        </button>
    `;

    box.innerHTML = html;
}

// Wendet die Formations-Empfehlung an
function applyFormationRecommendation(formation) {
    game.formation = formation;
    let optLineup = autoOptimizeLineup(formation);
    if (optLineup && optLineup.length > 0) {
        lineup = optLineup;
    }
    playSound('click');
    renderSquadView();
    render3DPitch();
    showToast(`✓ Formation: ${formation} (basierend auf Gegner-Analyse)`, 'success');
}
