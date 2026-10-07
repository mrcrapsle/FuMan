/* eslint-disable no-undef */
// Phase 23.16: Gegner-Schwachstellen-Analyse
// Erkenne schwache Positionen und empfehle Angriff-Strategien

function ensureOpponentWeaknessAnalysis() {
    if (!game.opponentWeaknesses) {
        game.opponentWeaknesses = {};
    }
}

function analyzeOpponentWeaknesses(oppTeam) {
    if (!oppTeam) return null;

    let analysis = {
        team: oppTeam.name || 'Unbekannt',
        weakPositions: [],
        recommendations: [],
        overallStrength: oppTeam.strength || 75
    };

    // Schwachen Positionen basierend auf Team-Typ
    if (oppTeam.strength < 55) {
        analysis.weakPositions.push({
            position: 'ABW',
            severity: 'Hoch',
            recommendation: 'Direkte Angriffe über die Flügel'
        });
        analysis.weakPositions.push({
            position: 'MIT',
            severity: 'Mittel',
            recommendation: 'Schnelle Konter durch die Mitte'
        });
    } else if (oppTeam.strength < 70) {
        analysis.weakPositions.push({
            position: 'TW',
            severity: 'Mittel',
            recommendation: 'Viele Schüsse - Torwart ist unsicher'
        });
        analysis.weakPositions.push({
            position: 'ST',
            severity: 'Mittel',
            recommendation: 'Hohes Pressing gegen schwache Stürmer'
        });
    } else if (oppTeam.strength < 85) {
        analysis.weakPositions.push({
            position: 'ABW',
            severity: 'Niedrig',
            recommendation: 'Flanken auf schnelle Stürmer'
        });
        analysis.weakPositions.push({
            position: 'MIT',
            severity: 'Niedrig',
            recommendation: 'Kreatives Mittelfeld-Spiel'
        });
    } else {
        analysis.weakPositions.push({
            position: 'Keine klaren',
            severity: 'Sehr niedrig',
            recommendation: 'Defensiv organisiert - Konter nutzen'
        });
    }

    // Grundlegende Empfehlungen
    if (oppTeam.strength > 80) {
        analysis.recommendations.push('Defensive Stabilität hat Priorität');
        analysis.recommendations.push('Nutze schnelle Konter-Chancen');
    } else if (oppTeam.strength > 65) {
        analysis.recommendations.push('Ausgewogenes Spiel - nicht zu aggressiv');
        analysis.recommendations.push('Kontrolle durch Ballbesitz');
    } else {
        analysis.recommendations.push('Aggressive Spielweise empfohlen');
        analysis.recommendations.push('Frühes Pressing ausüben');
    }

    return analysis;
}

function getOpponentWeaknessAttackBonus(oppTeam) {
    if (!oppTeam) return 0;

    // Bonus basierend auf wie sehr der Gegner schwach ist
    if (oppTeam.strength < 55) {
        return 2.5; // 2,5% Stärkebonus gegen sehr schwache Teams
    } else if (oppTeam.strength < 70) {
        return 1.5;
    } else if (oppTeam.strength < 80) {
        return 0.5;
    }
    return 0;
}

function recordOpponentWeaknessAnalysis(oppName, exploited) {
    ensureOpponentWeaknessAnalysis();

    if (!game.opponentWeaknesses[oppName]) {
        game.opponentWeaknesses[oppName] = {
            times_analyzed: 0,
            exploitations: 0
        };
    }

    game.opponentWeaknesses[oppName].times_analyzed += 1;
    if (exploited) {
        game.opponentWeaknesses[oppName].exploitations += 1;
    }
}

function renderOpponentWeaknessAnalysisPanel() {
    ensureOpponentWeaknessAnalysis();
    let box = document.getElementById('opponent-weakness-box');
    if (!box) return;

    let match = getUpcomingMatch();
    if (!match) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Kein bevorstehender Match.</div>';
        return;
    }

    let oppTeam = getTeamByName(match.away === game.clubName ? match.home : match.away);
    let analysis = analyzeOpponentWeaknesses(oppTeam);
    let attackBonus = getOpponentWeaknessAttackBonus(oppTeam);

    if (!analysis) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Keine Gegner-Daten verfügbar.</div>';
        return;
    }

    let html = `
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:4px;">Gegner: ${analysis.team}</div>
            <div style="font-size:9px;">
                <div>Team-Stärke: <strong>${analysis.overallStrength}/100</strong></div>
                <div style="background:rgba(0,0,0,0.3); height:6px; border-radius:3px; overflow:hidden; margin:4px 0;">
                    <div style="background:linear-gradient(90deg, var(--danger), var(--warning), var(--accent)); width:${analysis.overallStrength}%; height:100%;"></div>
                </div>
            </div>
        </div>

        <div style="background:rgba(255,152,0,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--warning);">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">⚠️ Schwache Positionen:</div>
            ${analysis.weakPositions.map(pos => `
                <div style="font-size:8px; margin-bottom:3px; padding:3px; background:rgba(0,0,0,0.2); border-radius:2px;">
                    <div style="font-weight:bold;">${pos.position} (${pos.severity})</div>
                    <div style="color:var(--text-muted);">${pos.recommendation}</div>
                </div>
            `).join('')}
        </div>

        <div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--accent);">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">💡 Strategie-Empfehlungen:</div>
            ${analysis.recommendations.map(rec => `
                <div style="font-size:8px; margin-bottom:2px; padding:2px;">✓ ${rec}</div>
            `).join('')}
        </div>

        ${attackBonus > 0 ? `
            <div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; font-size:9px;">
                <div style="color:var(--accent); font-weight:bold;">📊 Matchup-Bonus: +${attackBonus.toFixed(1)}% Stärke</div>
                <div style="color:var(--text-muted); font-size:8px;">Schwache Gegner bieten taktische Vorteile.</div>
            </div>
        ` : ''}

        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Nutze schwache Positionen des Gegners strategisch aus.
        </div>
    `;

    box.innerHTML = html;
}
