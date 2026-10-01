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

// Auswahl im Jugend-Bildschirm: Ergebnis anzeigen (früher wurde es verworfen - ohne Geld
// passierte schlicht nichts, und auch ein Erfolg blieb unsichtbar).
function chooseYouthCoach(playerId) {
    const r = assignYouthCoach(playerId);
    showToast(r.success ? `${r.message} (Kosten: ${formatVal(15000)})` : `${r.message} - benötigt: ${formatVal(15000)}`, r.success ? 'success' : 'error');
    if (typeof renderYouthView === 'function') renderYouthView();
}

function removeYouthCoach() {
    game.youthCoachId = null;
    if (typeof renderYouthView === 'function') renderYouthView();
    updateUI();
}

function getYouthCoachBonus() {
    const coach = getYouthAcademyCoach();
    if (!coach) return 1.0;

    const baseBonus = 1.15;
    const experienceBonus = (game.youthCoachHistory?.length || 0) * 0.02;
    return Math.min(1.5, baseBonus + experienceBonus);
}

// Monatlich (nicht beim Öffnen des Screens - sonst wuchsen Talente mit jedem Aufruf):
// Entwicklung der Jugend mit Jugendtrainer-, Fokus- und Mentor-Bonus.
function tickYouthDevelopment() {
    migrateLegacyYouthAcademy();
    trackYouthDevelopment();

    const coachBonus = getYouthCoachBonus();

    youthTalents.forEach(p => {
        if (typeof ensureYouthPotential === 'function') ensureYouthPotential(p);
        const ageDecay = Math.max(0.5, 1.0 - Math.max(0, p.age - 20) * 0.05);
        const focusBonus = p.youthFocus && p.youthFocus !== 'allgemein' ? 1.2 : 1.0;
        const mentorBonus = p.mentorId && squad.some(s => s.id === p.mentorId) ? 1.35 : 1.0;
        const potentialGap = Math.max(0, (p.potential || 75) - p.strength);

        let strengthIncrease = Math.random() * 1.5 * coachBonus * focusBonus * mentorBonus * ageDecay;
        if (potentialGap < 5) strengthIncrease *= 0.3;
        if (potentialGap < 2) strengthIncrease *= 0.1;

        p.strength = Math.min(p.potential || 99, Math.round(p.strength + strengthIncrease));
        p.morale = Math.max(30, Math.min(100, p.morale + (Math.random() * 10 - 5)));
    });
    if (youthTalents.length && typeof updateAcademyPoints === 'function') updateAcademyPoints('talent-development');
}

// Alte Spielstände: die frühere Zweit-Akademie (game.youthAcademy) führte einen eigenen
// Spielerpool mit englischen Positionen und doppelten IDs. Talente wandern in die echte
// Jugendabteilung, bereits beförderte Profis bekommen gültige Positionen.
const LEGACY_POS = { GK: 'TW', CB: 'ABW', LB: 'ABW', RB: 'ABW', CM: 'MIT', CDM: 'MIT', CAM: 'MIT' };
function migrateLegacyYouthAcademy() {
    squad.forEach(p => { if (LEGACY_POS[p.pos]) p.pos = LEGACY_POS[p.pos]; });
    const alt = game.youthAcademy;
    if (!alt) return;
    const pool = [...(alt.youngPlayers || []), ...(alt.players || [])];
    pool.forEach(yp => {
        const pos = LEGACY_POS[yp.position] || (['TW', 'ABW', 'MIT', 'ST'].includes(yp.position) ? yp.position : 'MIT');
        const staerke = Math.round(yp.strength || 40);
        const neu = createPlayer(pos, staerke, staerke, null, [yp.age || 17, yp.age || 17]);
        if (yp.name) neu.name = yp.name;
        if (typeof assignYouthPotentialTier === 'function') assignYouthPotentialTier(neu);
        if (typeof ensureYouthPotential === 'function') ensureYouthPotential(neu);
        neu.youthFocus = 'allgemein';
        youthTalents.push(neu);
    });
    delete game.youthAcademy;
    if (pool.length) addInboxMessage('vertrag', '🎓 Nachwuchs zusammengeführt', `${pool.length} Talente aus der früheren Zusatz-Akademie gehören jetzt zur Jugendabteilung.`, 'screen-youth');
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
        const coachCandidates = squad.filter(s => s.age >= 28 && s.strength >= 60 && !(s.injured > 0));
        if (coachCandidates.length > 0) {
            html += '<div style="margin-bottom:8px;"><div style="font-size:9px; font-weight:bold; margin-bottom:4px;">👨‍🏫 Jugendtrainer auswählen:</div>';
            html += '<select class="input-inline" style="font-size:8px; width:100%; padding:4px; margin-bottom:4px;" onchange="this.value && chooseYouthCoach(this.value)">';
            html += '<option value="">-- Kein Trainer --</option>';
            coachCandidates.forEach(p => {
                html += `<option value="${p.id}">${p.name} (${p.age}J., Str${p.strength})</option>`;
            });
            html += '</select></div>';
        }
    }

    html += '<div style="font-size:10px; font-weight:bold; margin-bottom:6px; color:var(--accent);">🌟 Top-Talente:</div>';
    ranking.slice(0, 5).forEach((p, idx) => {
        const trend = {
            'excellent': '📈 stark verbessert',
            'good': '↗️ gute Entwicklung',
            'improving': '🔼 verbessert sich',
            'stable': '➡️ stagniert',
            'declining': '↘️ baut ab',
            'new': '✨ neu in der Akademie'
        }[p.developmentTrend];

        html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; font-size:9px;">
            <div><strong>${idx + 1}. ${p.name}</strong> (${p.pos} | Str: ${p.strength})</div>
            <div style="color:var(--text-muted); font-size:8px;">Potenzial: ${typeof getYouthPotentialText === 'function' ? getYouthPotentialText(p) : '?'} | Talentwert: ${p.talentScore}</div>
            <div style="color:var(--accent); font-size:8px;">${trend}</div>
        </div>`;
    });

    html += '</div>';

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
