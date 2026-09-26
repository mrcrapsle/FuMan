// ==========================================
// ERWEITERTE SCOUTING-ANALYSE & TALENTERKENNUNG
// ==========================================

function calcPlayerPotential(player) {
    if (!player) return 0;
    const currentRating = player.rating || player.strength || 50;
    const age = player.age || 25;
    const potential = player.potential || currentRating;

    // Potenzialberechnung basierend auf Alter und Trainingsfokus
    const ageBonus = age < 20 ? (20 - age) * 1.5 : (age > 28 ? Math.max(0, (28 - age) * 0.8) : 0);
    const trainingBoost = (game.trainingIntensity === 'intensiv' ? 3 : game.trainingIntensity === 'normal' ? 1.5 : 0.5);

    return Math.min(99, Math.round(potential + ageBonus * trainingBoost * 0.1));
}

function calcTalentScore(player) {
    if (!player) return 0;
    const rating = player.rating || player.strength || 50;
    const potential = calcPlayerPotential(player);
    const age = player.age || 25;

    // Talent-Score: wie viel Entwicklungspotenzial hat der Spieler?
    const developmentPotential = potential - rating;
    const ageOptimum = age >= 18 && age <= 26 ? 100 : (age < 18 ? 70 : 50);
    const talentScore = (developmentPotential * 0.6) + (rating * 0.3) + (ageOptimum * 0.1);

    return Math.round(Math.max(0, Math.min(100, talentScore)));
}

function generateScoutReport(player) {
    if (!player) return null;

    const rating = player.rating || player.strength || 50;
    const potential = calcPlayerPotential(player);
    const talentScore = calcTalentScore(player);
    const age = player.age || 25;
    const position = player.pos || player.position || 'MIT';

    // Stärken analysieren
    let strengths = [];
    if (player.strength >= 75) strengths.push('Hervorragende physische Grundlagen');
    if (player.pace >= 75) strengths.push('Hohe Geschwindigkeit');
    if (player.shooting >= 75) strengths.push('Trefferquote');
    if (player.passing >= 75) strengths.push('Passspiel');
    if (player.defense >= 75) strengths.push('Defensive Sicherheit');
    if (strengths.length === 0) strengths = ['Solide Grundkompetenz'];

    // Schwächen analysieren
    let weaknesses = [];
    if (player.strength < 45) weaknesses.push('Physisch noch zu schwach');
    if (player.pace < 45) weaknesses.push('Geschwindigkeit entwicklungsbedürftig');
    if (player.shooting < 45) weaknesses.push('Torchancenauswertung verbesserungsfähig');
    if (player.passing < 45) weaknesses.push('Passspiel noch ungenau');
    if (player.defense < 45) weaknesses.push('Defensive Grundlagen fehlen');
    if (weaknesses.length === 0) weaknesses = ['Gut ausgewogen'];

    // Empfehlungen
    let recommendation = 'NEUTRAL';
    if (talentScore >= 75) recommendation = 'MUST-BUY';
    else if (talentScore >= 60) recommendation = 'SEHR EMPFOHLEN';
    else if (talentScore >= 45) recommendation = 'EMPFOHLEN';
    else if (talentScore >= 30) recommendation = 'OPTIONAL';
    else recommendation = 'NICHT EMPFOHLEN';

    return {
        playerName: player.name,
        position: position,
        age: age,
        currentRating: rating,
        potential: potential,
        developmentPotential: potential - rating,
        talentScore: talentScore,
        strengths: strengths,
        weaknesses: weaknesses,
        recommendation: recommendation,
        estimatedValue: Math.round(calcSquadPlayerValue(player) * (1 + (talentScore / 100) * 0.3)),
        generatedAt: game.matchday
    };
}

function detectTalents(minTalentScore = 60) {
    if (!squad) return [];

    return squad
        .filter(p => p && !p.isAcademy)
        .map(p => ({
            player: p,
            talentScore: calcTalentScore(p),
            potential: calcPlayerPotential(p)
        }))
        .filter(t => t.talentScore >= minTalentScore)
        .sort((a, b) => b.talentScore - a.talentScore);
}

function comparePlayerAttributes(playerId1, playerId2) {
    const player1 = squad.find(p => p.id === playerId1);
    const player2 = squad.find(p => p.id === playerId2);

    if (!player1 || !player2) return null;

    const attrs = ['strength', 'pace', 'shooting', 'passing', 'defense', 'fitness'];
    const comparison = {
        player1: { name: player1.name, id: playerId1, attributes: {} },
        player2: { name: player2.name, id: playerId2, attributes: {} },
        winner: {}
    };

    attrs.forEach(attr => {
        const val1 = player1[attr] || 0;
        const val2 = player2[attr] || 0;
        comparison.player1.attributes[attr] = val1;
        comparison.player2.attributes[attr] = val2;

        if (val1 > val2) comparison.winner[attr] = playerId1;
        else if (val2 > val1) comparison.winner[attr] = playerId2;
        else comparison.winner[attr] = 'draw';
    });

    return comparison;
}

function getPlayerDevelopmentTrend(playerId, matchdaysBack = 5) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    // Vereinfachte Implementierung - in echtem System würde man historische Daten tracken
    const trend = {
        playerName: player.name,
        currentStrength: player.strength,
        trend: 'stable',
        trajectory: 'normal'
    };

    // Basis-Logik für Trend
    if (player.mood >= 70) trend.trend = 'improving';
    else if (player.mood < 40) trend.trend = 'declining';

    if (player.age < 22 && player.potential > player.strength) trend.trajectory = 'rising';
    else if (player.age > 30) trend.trajectory = 'declining';

    return trend;
}

function generateScoutingDatabase() {
    if (!game.scoutingDatabase) {
        game.scoutingDatabase = {
            discoveredPlayers: [],
            lastAnalysisMatchday: 0,
            talentWatchlist: []
        };
    }
    return game.scoutingDatabase;
}

function addToTalentWatchlist(playerId) {
    const db = generateScoutingDatabase();
    if (!db.talentWatchlist.includes(playerId)) {
        db.talentWatchlist.push(playerId);
    }
}

function removeFromTalentWatchlist(playerId) {
    const db = generateScoutingDatabase();
    db.talentWatchlist = db.talentWatchlist.filter(id => id !== playerId);
}

function renderPlayerProfile(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return '';

    const potential = calcPlayerPotential(player);
    const talentScore = calcTalentScore(player);
    const report = generateScoutReport(player);
    const trend = getPlayerDevelopmentTrend(playerId);

    let html = `
        <div class="panel" style="margin-bottom:12px;">
            <div class="panel-header">📊 SPIELER-PROFIL: ${player.name}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
                <div>
                    <div style="font-size:10px; color:var(--text-muted);">Alter / Position</div>
                    <div style="font-size:12px; font-weight:bold;">${player.age} Jahre · ${player.pos || 'MIT'}</div>
                </div>
                <div>
                    <div style="font-size:10px; color:var(--text-muted);">Talent-Score</div>
                    <div style="font-size:12px; font-weight:bold; color:${talentScore >= 75 ? 'var(--primary)' : 'var(--accent)'};">${talentScore}/100</div>
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">Potenzial-Entwicklung</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="flex:1;">
                        <div style="background:var(--border); height:8px; border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${(player.strength / 99) * 100}%; background:var(--accent);"></div>
                        </div>
                        <div style="font-size:8px; color:var(--text-muted); margin-top:2px;">Aktuell: ${player.strength}</div>
                    </div>
                    <div style="font-size:12px; color:var(--primary);">→</div>
                    <div style="flex:1;">
                        <div style="background:var(--border); height:8px; border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${(potential / 99) * 100}%; background:var(--primary);"></div>
                        </div>
                        <div style="font-size:8px; color:var(--text-muted); margin-top:2px;">Potenzial: ${potential}</div>
                    </div>
                </div>
            </div>

            <div style="background:rgba(100,100,100,0.1); padding:8px; border-radius:4px; margin-bottom:12px;">
                <div style="font-size:10px; font-weight:bold; margin-bottom:4px; color:var(--text-muted);">Stärken:</div>
                <div style="font-size:9px; color:var(--primary);">${report.strengths.join(' · ')}</div>
                <div style="font-size:10px; font-weight:bold; margin-top:8px; margin-bottom:4px; color:var(--text-muted);">Schwächen:</div>
                <div style="font-size:9px; color:var(--danger);">${report.weaknesses.join(' · ')}</div>
            </div>

            <div style="display:flex; gap:4px; padding:8px; background:${
                report.recommendation === 'MUST-BUY' ? 'rgba(76,175,80,0.1)' :
                report.recommendation === 'SEHR EMPFOHLEN' ? 'rgba(33,150,243,0.1)' :
                report.recommendation === 'EMPFOHLEN' ? 'rgba(255,193,7,0.1)' :
                report.recommendation === 'OPTIONAL' ? 'rgba(156,39,176,0.1)' :
                'rgba(244,67,54,0.1)'
            }; border-radius:4px;">
                <div style="font-size:10px; font-weight:bold; color:${
                    report.recommendation === 'MUST-BUY' ? 'var(--primary)' :
                    report.recommendation === 'NICHT EMPFOHLEN' ? 'var(--danger)' :
                    'var(--accent)'
                };">${report.recommendation}</div>
                <div style="font-size:9px; color:var(--text-muted); flex:1;">Geschätzter Wert: ${formatVal(report.estimatedValue)}</div>
            </div>
        </div>
    `;

    return html;
}

function renderTalentWatchlist() {
    const db = generateScoutingDatabase();
    const watchedPlayers = squad.filter(p => db.talentWatchlist.includes(p.id));

    if (watchedPlayers.length === 0) {
        return '<div style="color:var(--text-muted); font-size:9px;">Keine Spieler auf der Beobachtungsliste</div>';
    }

    let html = '<div style="font-size:10px; font-weight:bold; margin-bottom:8px;">📋 Talent-Beobachtungsliste:</div>';
    watchedPlayers.forEach(p => {
        const talent = calcTalentScore(p);
        const trend = getPlayerDevelopmentTrend(p.id);
        html += `
            <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:9px; font-weight:bold;">${p.name} (${p.pos}, ${p.age}J)</div>
                    <div style="font-size:8px; color:var(--text-muted);">Talent: ${talent}/100 · Trend: ${trend.trend}</div>
                </div>
                <button onclick="removeFromTalentWatchlist('${p.id}'); updateUI();" class="btn-secondary" style="padding:3px 7px; font-size:8px;">✕ Entfernen</button>
            </div>
        `;
    });

    return html;
}

function renderTalentDetectionPanel() {
    const box = document.getElementById('talent-detection-box');
    if (!box) return;

    const talents = detectTalents(50);
    const topTalents = talents.slice(0, 10);

    let html = `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <div style="font-size:10px; font-weight:bold; color:var(--text-muted);">Talente gefunden: ${talents.length}</div>
                <button onclick="(function() { let t = detectTalents(60); alert('Top-Talente: ' + t.length + ' Spieler mit Talent-Score ≥60'); })()" class="btn-primary" style="padding:3px 7px; font-size:8px;">🎯 Top-Talente</button>
            </div>
        </div>
    `;

    if (topTalents.length === 0) {
        html += '<div style="color:var(--text-muted); font-size:9px;">Keine Talente im Kader erkannt</div>';
    } else {
        html += '<div style="font-size:10px; font-weight:bold; margin-bottom:8px;">🌟 Top 10 Talente im Kader:</div>';
        topTalents.forEach((t, idx) => {
            const p = t.player;
            const potential = t.potential;
            const devPot = potential - p.strength;
            html += `
                <div style="background:rgba(76,175,80,0.1); padding:8px; border-radius:4px; margin-bottom:6px; border-left:3px solid var(--primary);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <div>
                            <div style="font-size:9px; font-weight:bold;">${idx + 1}. ${p.name} (${p.pos}, ${p.age}J)</div>
                            <div style="font-size:8px; color:var(--text-muted);">Talent-Score: ${t.talentScore}/100 · Entwicklungspotenzial: +${devPot}</div>
                        </div>
                        <button onclick="addToTalentWatchlist('${p.id}'); updateUI();" class="btn-secondary" style="padding:3px 7px; font-size:8px;">👁️ Beobachten</button>
                    </div>
                    <div style="display:flex; gap:8px; font-size:8px;">
                        <div>Aktuell: ${p.strength}</div>
                        <div style="color:var(--primary);">→ Potenzial: ${potential}</div>
                    </div>
                </div>
            `;
        });
    }

    html += renderTalentWatchlist();

    box.innerHTML = html;
}
