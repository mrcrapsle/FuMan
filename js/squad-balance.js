/* eslint-disable no-undef */
// Phase 23.13: Squad-Balance-Analyse
// Analysiere Kader-Zusammensetzung und zeige Schwachstellen auf

function analyzeSquadBalance() {
    let analysis = {
        byPosition: {},
        strengthByPosition: {},
        balanceScore: 0,
        recommendations: [],
        issues: []
    };

    let positions = ['TW', 'ABW', 'MIT', 'ST'];

    positions.forEach(pos => {
        let playersByPos = squad.filter(p => p.pos === pos);
        let strengthSum = playersByPos.reduce((sum, p) => sum + (p.strength || 50), 0);
        let avgStrength = playersByPos.length > 0 ? strengthSum / playersByPos.length : 0;

        analysis.byPosition[pos] = playersByPos.length;
        analysis.strengthByPosition[pos] = Math.round(avgStrength);
    });

    // Berechne Balance-Score (0-100)
    let positionCounts = Object.values(analysis.byPosition);
    let variance = calculateVariance(positionCounts);
    analysis.balanceScore = Math.max(0, 100 - variance * 10);

    // Analysiere Schwachstellen
    let minPlayersNeeded = { 'TW': 1, 'ABW': 6, 'MIT': 4, 'ST': 2 };

    positions.forEach(pos => {
        let count = analysis.byPosition[pos];
        let minNeeded = minPlayersNeeded[pos];
        let avgStr = analysis.strengthByPosition[pos];

        if (count < minNeeded) {
            analysis.issues.push({
                type: 'undersized',
                position: pos,
                current: count,
                needed: minNeeded,
                severity: minNeeded - count
            });
            analysis.recommendations.push({
                priority: 'high',
                text: `⚠️ Zu wenige ${pos} (${count}, sollte ≥${minNeeded}). Rekrutiere ${minNeeded - count} mehr!`
            });
        }

        if (avgStr < 60 && count > 0) {
            analysis.issues.push({
                type: 'weak',
                position: pos,
                avgStrength: avgStr,
                severity: 70 - avgStr
            });
            analysis.recommendations.push({
                priority: 'medium',
                text: `📉 ${pos}-Spieler sind schwach (Ø ${Math.round(avgStr)}). Verbessere diese Position!`
            });
        }
    });

    // Überprüfe Stärke-Ungleichgewicht
    let strengths = Object.values(analysis.strengthByPosition).filter(s => s > 0);
    if (strengths.length > 0) {
        let maxStr = Math.max(...strengths);
        let minStr = Math.min(...strengths);
        if (maxStr - minStr > 15) {
            analysis.recommendations.push({
                priority: 'medium',
                text: `⚖️ Große Stärke-Unterschiede zwischen Positionen (Diff: ${maxStr - minStr}). Baue schwache Positionen aus!`
            });
        }
    }

    return analysis;
}

function calculateVariance(values) {
    if (values.length === 0) return 0;
    let avg = values.reduce((a, b) => a + b, 0) / values.length;
    let variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
}

function getSquadDepthScore() {
    let analysis = analyzeSquadBalance();

    // Tiefe = durchschnittliche Spieleranzahl pro Position
    let totalPlayers = Object.values(analysis.byPosition).reduce((a, b) => a + b, 0);
    let avgPerPosition = totalPlayers / Object.keys(analysis.byPosition).length;

    return Math.round(avgPerPosition);
}

function getRecruitmentTargets() {
    let analysis = analyzeSquadBalance();
    let targets = [];

    analysis.recommendations
        .filter(r => r.priority === 'high')
        .forEach(rec => {
            // Extrahiere Position aus Empfehlung (grob)
            let match = rec.text.match(/zu wenige ([A-Z]+)/i);
            if (match) {
                targets.push({
                    position: match[1].toUpperCase(),
                    priority: 'hoch',
                    reason: rec.text
                });
            }
        });

    return targets;
}

function renderSquadBalancePanel() {
    let box = document.getElementById('squad-balance-box');
    if (!box) return;

    let analysis = analyzeSquadBalance();
    let squadDepth = getSquadDepthScore();

    let html = `
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:6px; font-size:11px;">📊 Kader-Balance Score: <span style="color:var(--accent); font-size:12px;">${Math.round(analysis.balanceScore)}/100</span></div>
            <div style="background:rgba(0,0,0,0.3); height:8px; border-radius:4px; margin-bottom:4px; overflow:hidden;">
                <div style="background:linear-gradient(90deg, ${analysis.balanceScore < 50 ? 'var(--danger)' : 'var(--accent)'}, var(--primary)); width:${analysis.balanceScore}%; height:100%;"></div>
            </div>
            <div style="font-size:9px; color:var(--text-muted);">
                Squad-Tiefe: ${squadDepth} Spieler/Position (ideal: 4-5)
            </div>
        </div>

        <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">⚙️ Positionen-Übersicht:</div>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:4px;">
                ${Object.keys(analysis.byPosition).map(pos => {
                    let count = analysis.byPosition[pos];
                    let str = analysis.strengthByPosition[pos];
                    let color = str >= 65 ? 'var(--accent)' : (str >= 55 ? 'var(--warning)' : 'var(--danger)');
                    return `
                        <div style="background:rgba(0,0,0,0.2); padding:4px; border-radius:3px; font-size:9px;">
                            <div style="font-weight:bold;">${pos}</div>
                            <div style="color:var(--text-muted);">${count} Spieler</div>
                            <div style="color:${color}; font-weight:bold;">Ø ${str} Stärke</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        ${analysis.recommendations.length > 0 ? `
            <div style="background:rgba(255,152,0,0.1); padding:6px; border-radius:4px; border-left:3px solid var(--warning);">
                <div style="font-weight:bold; font-size:10px; margin-bottom:4px;">💡 Empfehlungen:</div>
                ${analysis.recommendations.slice(0, 4).map(rec => `
                    <div style="font-size:8px; margin-bottom:3px; padding:3px; background:rgba(0,0,0,0.2); border-radius:2px;">
                        ${rec.text}
                    </div>
                `).join('')}
            </div>
        ` : `
            <div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; border-left:3px solid var(--accent); font-size:9px;">
                ✅ Kader ist ausgewogen! Gute Balance in allen Positionen.
            </div>
        `}

        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Analysiere deinen Kader regelmäßig auf Schwachstellen und plane Rekrutierungen.
        </div>
    `;

    box.innerHTML = html;
}
