// ==========================================
// JUGENDAKADEMIE ERWEITERTE FUNKTIONEN
// ==========================================
/* eslint-disable no-undef */

function getYouthTalentRanking() {
    if (!youthTalents || youthTalents.length === 0) return [];

    return youthTalents
        .map(p => ({
            ...p,
            talentScore: calculateYouthTalentScore(p),
            developmentTrend: getYouthDevelopmentTrend(p)
        }))
        .sort((a, b) => b.talentScore - a.talentScore);
}

function calculateYouthTalentScore(player) {
    if (!player) return 0;

    const basePotential = player.potential || player.strength;
    const currentLevel = player.strength || 40;
    const developmentRoom = Math.max(0, basePotential - currentLevel);
    const ageBonus = Math.max(0, (22 - (player.age || 18)) * 5);
    const traitBonus = player.trait && player.trait !== 'Kein' ? 10 : 0;
    const mentorBonus = player.mentorId ? 8 : 0;

    return Math.round(developmentRoom + ageBonus + traitBonus + mentorBonus);
}

function getYouthDevelopmentTrend(player) {
    if (!player || !youthDevelopmentHistory) return 'stable';

    const history = (youthDevelopmentHistory[player.id] || []).slice(-5);
    if (history.length < 2) return 'new';

    const firstStrength = history[0];
    const lastStrength = history[history.length - 1];
    const diff = lastStrength - firstStrength;

    if (diff > 10) return 'excellent';
    if (diff > 5) return 'good';
    if (diff > 0) return 'improving';
    if (diff === 0) return 'stable';
    return 'declining';
}

function trackYouthDevelopment() {
    if (!youthDevelopmentHistory) youthDevelopmentHistory = {};

    youthTalents.forEach(p => {
        if (!youthDevelopmentHistory[p.id]) youthDevelopmentHistory[p.id] = [];
        youthDevelopmentHistory[p.id].push(p.strength || 40);
        if (youthDevelopmentHistory[p.id].length > 50) {
            youthDevelopmentHistory[p.id].shift();
        }
    });
}

function getYouthAcademyCoach() {
    if (!game.youthCoachId) return null;
    return squad.find(s => s.id === game.youthCoachId) || null;
}

function assignYouthCoach(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Spieler nicht gefunden' };

    const cost = 15000;
    if (game.money < cost) return { success: false, message: 'Nicht genug Geld' };

    game.money -= cost;
    game.youthCoachId = playerId;

    if (!game.youthCoachHistory) game.youthCoachHistory = [];
    game.youthCoachHistory.push({
        coachId: playerId,
        coachName: player.name,
        assignedMatchday: game.matchday,
        season: game.season
    });

    updateUI();
    return { success: true, message: `✓ ${player.name} zum Jugendtrainer ernannt!` };
}

function removeYouthCoach() {
    game.youthCoachId = null;
    updateUI();
}

function getYouthCoachBonus() {
    const coach = getYouthAcademyCoach();
    if (!coach) return 1.0;

    const baseBonus = 1.15;
    const experienceBonus = (game.youthCoachHistory?.length || 0) * 0.02;
    const coachingBonus = Math.min(0.25, coach.coaching || 0) / 100;

    return Math.min(1.5, baseBonus + experienceBonus + coachingBonus);
}

function simulateYouthDevelopment() {
    trackYouthDevelopment();

    const coachBonus = getYouthCoachBonus();

    youthTalents.forEach(p => {
        const ageDecay = Math.max(0.5, 1.0 - Math.max(0, p.age - 20) * 0.05);
        const focusBonus = p.youthFocus && p.youthFocus !== 'allgemein' ? 1.2 : 1.0;
        const mentorBonus = p.mentorId && squad.some(s => s.id === p.mentorId) ? 1.35 : 1.0;
        const potentialGap = Math.max(0, (p.potential || 75) - p.strength);

        let strengthIncrease = Math.random() * 3 * coachBonus * focusBonus * mentorBonus * ageDecay;
        if (potentialGap < 5) strengthIncrease *= 0.3;
        if (potentialGap < 2) strengthIncrease *= 0.1;

        p.strength = Math.min(p.potential || 99, Math.round(p.strength + strengthIncrease));

        p.morale = Math.max(30, Math.min(100, p.morale + (Math.random() * 10 - 5)));
    });
}

function scheduleYouthTournament() {
    if (!game.youthTournaments) game.youthTournaments = [];

    const tournament = {
        id: 'yt_' + Math.random().toString(36).substr(2, 9),
        name: `Jugend-Turnier MD${game.matchday}`,
        startMatchday: game.matchday + 2,
        status: 'scheduled',
        results: [],
        prize: {
            money: 25000,
            reputation: 5
        }
    };

    game.youthTournaments.push(tournament);
    return { success: true, message: `✓ Turnier ${tournament.name} angesetzt!` };
}

function runYouthTournament(tournamentId) {
    const tournament = (game.youthTournaments || []).find(t => t.id === tournamentId);
    if (!tournament) return { success: false, message: 'Turnier nicht gefunden' };

    const avgYouthStrength = youthTalents.length > 0
        ? Math.round(youthTalents.reduce((sum, p) => sum + p.strength, 0) / youthTalents.length)
        : 50;

    const opponentStrength = 45 + Math.floor(Math.random() * 20);
    const successChance = Math.min(95, Math.max(5, 50 + (avgYouthStrength - opponentStrength)));
    const won = Math.random() * 100 < successChance;

    tournament.status = 'completed';
    tournament.results.push({
        matchday: game.matchday,
        won: won,
        opponentStrength: opponentStrength,
        ourStrength: avgYouthStrength
    });

    if (won) {
        game.money += tournament.prize.money;
        if (!game.youthTourneyWins) game.youthTourneyWins = 0;
        game.youthTourneyWins++;

        youthTalents.forEach(p => {
            p.morale = Math.min(100, p.morale + 10);
            p.strength = Math.min(p.potential || 99, p.strength + 1);
        });
    }

    updateUI();
    return {
        success: true,
        won: won,
        message: won
            ? `🏆 Jugend-Team gewonnen! +${tournament.prize.money} € Prämie`
            : `😞 Jugend-Team verloren. Weiter gehts!`
    };
}

function renderYouthAcademyPanel() {
    const box = document.getElementById('youth-academy-extended-panel');
    if (!box) return;

    const ranking = getYouthTalentRanking();
    const coach = getYouthAcademyCoach();
    const coachBonus = getYouthCoachBonus();

    let html = '<div style="margin-bottom:12px;">';

    if (coach) {
        html += `<div style="background:rgba(62,224,138,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--primary);">
            <div style="font-size:9px; font-weight:bold; color:var(--primary);">👨‍🏫 Jugendtrainer: ${coach.name}</div>
            <div style="font-size:8px; color:var(--text-muted);">Entwicklungsbonus: +${Math.round((coachBonus - 1) * 100)}%</div>
            <button onclick="removeYouthCoach()" class="btn-secondary" style="font-size:8px; padding:2px 4px; margin-top:4px;">Entfernen</button>
        </div>`;
    } else {
        const coachCandidates = squad.filter(s => s.age >= 28 && s.strength >= 60 && !s.isInjured);
        if (coachCandidates.length > 0) {
            html += '<div style="margin-bottom:8px;"><div style="font-size:9px; font-weight:bold; margin-bottom:4px;">👨‍🏫 Jugendtrainer auswählen:</div>';
            html += '<select class="input-inline" style="font-size:8px; width:100%; padding:4px; margin-bottom:4px;" onchange="this.value && assignYouthCoach(this.value)">';
            html += '<option value="">-- Kein Trainer --</option>';
            coachCandidates.forEach(p => {
                html += `<option value="${p.id}">${p.name} (${p.age}J., Str${p.strength})</option>`;
            });
            html += '</select></div>';
        }
    }

    html += '<div style="font-size:10px; font-weight:bold; margin-bottom:6px; color:var(--accent);">🌟 Top-Talente:</div>';
    ranking.slice(0, 5).forEach((p, idx) => {
        const trendIcon = {
            'excellent': '📈',
            'good': '↗️',
            'improving': '🔼',
            'stable': '➡️',
            'declining': '↘️',
            'new': '✨'
        }[p.developmentTrend];

        html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; font-size:9px;">
            <div><strong>${idx + 1}. ${p.name}</strong> (${p.pos} | Str: ${p.strength})</div>
            <div style="color:var(--text-muted); font-size:8px;">Potenzial: ${p.potential || 75} | Score: ${p.talentScore}</div>
            <div style="color:var(--accent); font-size:8px;">${trendIcon} ${p.developmentTrend}</div>
        </div>`;
    });

    html += '<div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(100,100,100,0.2);">';
    html += '<button onclick="scheduleYouthTournament()" class="btn-primary" style="width:100%; font-size:9px; padding:6px;">🏆 Jugend-Turnier ansetzen</button>';
    html += '</div></div>';

    box.innerHTML = html;
}

function renderYouthDevelopmentChart() {
    const box = document.getElementById('youth-development-chart-panel');
    if (!box) return;

    const ranking = getYouthTalentRanking();
    if (ranking.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:9px;">Noch keine Talente in der Akademie</div>';
        return;
    }

    let html = '<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">📊 Entwicklung Top 3:</div>';

    ranking.slice(0, 3).forEach(p => {
        const history = (youthDevelopmentHistory[p.id] || []).slice(-10);
        if (history.length === 0) {
            html += `<div style="font-size:8px; color:var(--text-muted); margin-bottom:4px;">${p.name}: Keine Daten</div>`;
            return;
        }

        const minStr = Math.min(...history);
        const maxStr = Math.max(...history);
        const range = Math.max(1, maxStr - minStr + 5);
        const barHeight = 30;

        html += `<div style="margin-bottom:8px;">
            <div style="font-size:9px; font-weight:bold; margin-bottom:2px;">${p.name} (${minStr}-${maxStr})</div>
            <div style="display:flex; align-items:flex-end; gap:2px; height:${barHeight}px; background:rgba(100,100,100,0.05); padding:4px; border-radius:4px;">`;

        history.forEach(str => {
            const height = ((str - minStr + 2.5) / range) * (barHeight - 8);
            html += `<div style="flex:1; background:var(--primary); height:${height}px; border-radius:2px;" title="${str}"></div>`;
        });

        html += '</div></div>';
    });

    box.innerHTML = html;
}
