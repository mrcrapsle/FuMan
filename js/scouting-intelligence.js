// Advanced Scouting Intelligence System
// Detailed player analysis, injury history, market trends, and comparative scouting

let scoutingIntelligenceState = {
    scoutedPlayers: {},
    scoutingReports: [],
    marketTrends: {},
    injuryDatabase: []
};

const SCOUTING_ATTRIBUTES = [
    { key: 'shooting', label: 'Torschuss' },
    { key: 'passing', label: 'Passspiel' },
    { key: 'dribbling', label: 'Dribbeln' },
    { key: 'defense', label: 'Verteidigung' },
    { key: 'heading', label: 'Kopfballspiel' },
    { key: 'athleticism', label: 'Athletik' }
];

const INJURY_RISK_FACTORS = {
    HIGH: { label: 'Sehr hoch', color: 'var(--danger)', probability: 0.15 },
    MEDIUM: { label: 'Mittel', color: 'var(--accent)', probability: 0.08 },
    LOW: { label: 'Niedrig', color: 'var(--primary)', probability: 0.03 }
};

function initializeScoutingIntelligence() {
    if (!game.scoutingIntelligence) game.scoutingIntelligence = {};
    if (!game.scoutingIntelligence.scoutedPlayers) game.scoutingIntelligence.scoutedPlayers = {};
    if (!game.scoutingIntelligence.reports) game.scoutingIntelligence.reports = [];
}

function getScoutingReport(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    if (!game.scoutingIntelligence.scoutedPlayers[playerId]) {
        game.scoutingIntelligence.scoutedPlayers[playerId] = {
            playerId: playerId,
            playerName: player.name,
            position: player.position,
            firstScouted: game.matchday || 1,
            lastUpdated: game.matchday || 1,
            attributeScores: {},
            injuryHistory: [],
            marketValue: 50000,
            potentialRating: player.strength + 10,
            ageAssessment: assessPlayerAge(player),
            riskLevel: assessInjuryRisk(player),
            overallRating: 0
        };

        SCOUTING_ATTRIBUTES.forEach(attr => {
            game.scoutingIntelligence.scoutedPlayers[playerId].attributeScores[attr.key] =
                player[attr.key] || 60;
        });
    }

    const report = game.scoutingIntelligence.scoutedPlayers[playerId];
    report.lastUpdated = game.matchday || 1;

    // Update market value
    report.marketValue = calculateScoutedPlayerValue(player, report);

    // Calculate overall rating
    const avgAttributes = Object.values(report.attributeScores).reduce((a, b) => a + b, 0) /
                         SCOUTING_ATTRIBUTES.length;
    report.overallRating = Math.round((avgAttributes + report.potentialRating) / 2);

    return report;
}

function assessPlayerAge(player) {
    const age = player.age || 25;
    if (age < 20) return { label: 'Sehr jung - Hohes Entwicklungspotenzial', value: -10, color: 'green' };
    if (age < 25) return { label: 'Jung - Gutes Entwicklungspotenzial', value: 0, color: 'var(--primary)' };
    if (age <= 30) return { label: 'Prime Years - Stabilität', value: 5, color: 'var(--primary)' };
    if (age < 34) return { label: 'Erfahren - Beginn Abbauprozess', value: -5, color: 'var(--accent)' };
    return { label: 'Veteran - Schneller Wertverfall', value: -15, color: 'var(--danger)' };
}

function assessInjuryRisk(player) {
    const missedMatches = (player.injuryDays || 0) / 7;

    if (missedMatches > 20) return INJURY_RISK_FACTORS.HIGH;
    if (missedMatches > 10) return INJURY_RISK_FACTORS.MEDIUM;
    return INJURY_RISK_FACTORS.LOW;
}

function calculateScoutedPlayerValue(player, report) {
    let value = player.strength * 50000;

    // Experience bonus
    const matches = player.appearances || 0;
    value += matches * 300;

    // Age adjustment
    const age = player.age || 25;
    if (age < 23) value *= 1.3;
    else if (age > 32) value *= 0.6;

    // Injury penalty
    if (report.riskLevel === INJURY_RISK_FACTORS.HIGH) value *= 0.7;

    // Position multiplier
    const posMultipliers = { TW: 0.8, ABW: 1.0, MIT: 1.1, ST: 1.2 };
    value *= posMultipliers[player.position] || 1.0;

    return Math.floor(value);
}

function recordInjury(playerId, injurySeverity) {
    const report = getScoutingReport(playerId);
    if (!report) return;

    report.injuryHistory.push({
        matchday: game.matchday || 1,
        severity: injurySeverity,
        recoveryDays: injurySeverity === 'SEVERE' ? 21 : injurySeverity === 'MODERATE' ? 14 : 7
    });

    // Update risk level
    const recentInjuries = report.injuryHistory.filter(i =>
        (game.matchday || 1) - i.matchday < 34
    ).length;

    if (recentInjuries >= 3) report.riskLevel = INJURY_RISK_FACTORS.HIGH;
    else if (recentInjuries >= 1) report.riskLevel = INJURY_RISK_FACTORS.MEDIUM;
}

function compareScoutedPlayers(playerId1, playerId2) {
    const report1 = getScoutingReport(playerId1);
    const report2 = getScoutingReport(playerId2);

    if (!report1 || !report2) return null;

    const comparison = {
        player1: report1.playerName,
        player2: report2.playerName,
        attributes: {},
        overallAdvantage: report1.overallRating - report2.overallRating,
        valueComparison: report1.marketValue - report2.marketValue,
        riskComparison: {
            player1: report1.riskLevel.label,
            player2: report2.riskLevel.label
        }
    };

    SCOUTING_ATTRIBUTES.forEach(attr => {
        comparison.attributes[attr.label] = {
            player1: report1.attributeScores[attr.key],
            player2: report2.attributeScores[attr.key],
            difference: report1.attributeScores[attr.key] - report2.attributeScores[attr.key]
        };
    });

    return comparison;
}

function tickScoutingUpdates() {
    // Update scouting on visited players periodically
    Object.keys(game.scoutingIntelligence.scoutedPlayers || {}).forEach(playerId => {
        const report = game.scoutingIntelligence.scoutedPlayers[playerId];
        const player = squad.find(p => p.id === playerId);

        if (!player) return;

        // Attributes improve based on play time
        if (player.appearances > (report.lastAppearances || 0)) {
            SCOUTING_ATTRIBUTES.forEach(attr => {
                if (report.attributeScores[attr.key] < player[attr.key]) {
                    report.attributeScores[attr.key] = Math.min(
                        player[attr.key],
                        report.attributeScores[attr.key] + 0.5
                    );
                }
            });
        }

        report.lastAppearances = player.appearances;
    });
}

function renderScoutingIntelligencePanel() {
    const container = document.getElementById('scouting-intelligence-box');
    if (!container) return;

    initializeScoutingIntelligence();

    let html = '<div class="panel-content">';
    html += '<h3>Scouting-Intelligenz</h3>';

    // Scouted Players Overview
    html += '<div class="scouted-players-overview" style="margin-bottom:10px;">';
    html += '<h4>📊 Analysierte Spieler</h4>';
    html += '<table class="scouting-table" style="width:100%; font-size:9px;">';
    html += '<tr><th>Spieler</th><th>Position</th><th>Rating</th><th>Marktwert</th><th>Verletzungsrisiko</th><th>Alter-Bewertung</th></tr>';

    const scoutedCount = Object.keys(game.scoutingIntelligence.scoutedPlayers || {}).length;
    Object.values(game.scoutingIntelligence.scoutedPlayers || {}).slice(0, 11).forEach(report => {
        const player = squad.find(p => p.id === report.playerId);
        if (!player) return;

        const ageAssess = assessPlayerAge(player);
        html += `<tr>
                    <td>${report.playerName}</td>
                    <td>${report.position}</td>
                    <td><strong>${report.overallRating}</strong>/100</td>
                    <td>€${(report.marketValue / 1000).toFixed(0)}k</td>
                    <td><span style="color:${report.riskLevel.color};">${report.riskLevel.label}</span></td>
                    <td style="color:${ageAssess.color};">${ageAssess.label}</td>
                </tr>`;
    });

    html += '</table>';
    html += `<p style="font-size:8px; color:var(--text-muted); margin-top:5px;">Total: ${scoutedCount} Spieler analysiert</p>`;
    html += '</div>';

    // Injury Risk Assessment
    html += '<div class="injury-assessment" style="margin-top:10px;">';
    html += '<h4>⚕️ Verletzungsrisiko-Bewertung</h4>';

    const highRiskPlayers = Object.values(game.scoutingIntelligence.scoutedPlayers || {})
        .filter(r => r.riskLevel === INJURY_RISK_FACTORS.HIGH);

    if (highRiskPlayers.length > 0) {
        html += '<div style="background:#1a1a1a; padding:6px; border-radius:4px; border-left:3px solid var(--danger);">';
        html += `<p style="font-size:9px; color:var(--danger); margin:0;"><strong>⚠️ ${highRiskPlayers.length} Spieler mit hohem Risiko:</strong></p>`;
        html += '<ul style="font-size:8px; margin:4px 0; color:var(--text-muted);">';
        highRiskPlayers.slice(0, 5).forEach(r => {
            const history = r.injuryHistory.length;
            html += `<li>${r.playerName} (${history} Verletzungen in Datenbank)</li>`;
        });
        html += '</ul></div>';
    } else {
        html += '<p style="font-size:9px; color:var(--primary);">✓ Kein kritisches Verletzungsrisiko erkannt</p>';
    }
    html += '</div>';

    // Market Trends
    html += '<div class="market-trends" style="margin-top:10px;">';
    html += '<h4>💰 Marktwert-Trends</h4>';

    const topValuePlayers = Object.values(game.scoutingIntelligence.scoutedPlayers || {})
        .sort((a, b) => b.marketValue - a.marketValue)
        .slice(0, 5);

    if (topValuePlayers.length > 0) {
        html += '<div style="display:grid; grid-template-columns: repeat(1, 1fr); gap:4px;">';
        topValuePlayers.forEach(r => {
            const player = squad.find(p => p.id === r.playerId);
            if (!player) return;
            html += `<div style="background:#222; padding:4px; border-radius:3px; font-size:8px;">
                        <strong>${r.playerName}</strong> (${player.age || 25}J.)
                        <span style="float:right; color:var(--accent);">€${(r.marketValue / 1000).toFixed(0)}k</span>
                    </div>`;
        });
        html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}
