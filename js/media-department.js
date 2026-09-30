// Medienabteilung: aktive Pressearbeit auf dem einen echten Medienimage
// (game.managerMediaImage), das auch Pressekonferenzen, Sponsoren-Erstangebote, TV-Partner
// und Büro-Ereignisse nutzen. Löst drei Module ab, die je ein eigenes, wirkungsloses Image
// führten. Eine Aktion pro Monat; Medienereignisse entstehen aus dem echten Saisonverlauf.

const MEDIA_ACTION_COOLDOWN = 4; // Spieltage
const MEDIA_EVENT_TIMEOUT = 4;
const MEDIA_LEAGUE_COST_FACTOR = [1.0, 0.7, 0.45, 0.3, 0.2, 0.12];

function initMediaDepartment() {
    if (!game.mediaDept) game.mediaDept = { lastActionMatchday: null, lastActionSeason: null, goodwill: 0, event: null, log: [] };
    // Alte Parallel-Systeme (eigene Images ohne Wirkung) aus Spielständen entfernen
    ['mediaManagement', 'mediaRelations', 'mediaReputation', 'mediaRelationships', 'mediaConferences', 'mediaConferenceHistory',
        'playerInterviews', 'journalistInteractions'].forEach(k => { delete game[k]; });
    return game.mediaDept;
}

function changeMediaImage(delta) {
    game.managerMediaImage = Math.max(0, Math.min(100, (game.managerMediaImage ?? 50) + delta));
}

function mediaCost(base) {
    const f = MEDIA_LEAGUE_COST_FACTOR[game.leagueLevel] ?? MEDIA_LEAGUE_COST_FACTOR[MEDIA_LEAGUE_COST_FACTOR.length - 1];
    return Math.round(base * f / 500) * 500;
}

function mediaLog(text) {
    const md = initMediaDepartment();
    md.log.unshift({ season: game.season, matchday: game.matchday, text });
    md.log = md.log.slice(0, 5);
}

function getMediaActionBlockReason() {
    const md = initMediaDepartment();
    if (md.lastActionSeason === game.season && md.lastActionMatchday !== null && game.matchday - md.lastActionMatchday < MEDIA_ACTION_COOLDOWN) {
        return `Nächste Medienaktion ab Spieltag ${md.lastActionMatchday + MEDIA_ACTION_COOLDOWN}.`;
    }
    return null;
}

function interviewCandidates() {
    return [...squad].sort((a, b) => (b.appearances || 0) - (a.appearances || 0)).slice(0, 5);
}

const MEDIA_ACTIONS = {
    kampagne: {
        label: '📱 Social-Media-Kampagne', cost: () => mediaCost(20000),
        run: () => {
            const erfolg = Math.random() < 0.55 + (game.managerMediaImage ?? 50) / 500;
            if (erfolg) { changeMediaImage(4); game.fans = Math.min(100, game.fans + 2); return 'Kampagne ging viral: Image +4, Fans +2'; }
            changeMediaImage(-2); return 'Kampagne verpuffte, Spott im Netz: Image -2';
        }
    },
    interview: {
        label: '🎤 Spieler-Interview', cost: () => 0,
        run: playerId => {
            const p = squad.find(x => String(x.id) === String(playerId)) || interviewCandidates()[0];
            if (!p) return 'Kein Spieler verfügbar';
            if ((p.morale || 50) < 40) { changeMediaImage(-3); p.morale = Math.max(10, p.morale - 3); return `${p.name} kritisiert im Interview den Verein: Image -3`; }
            changeMediaImage(2); p.morale = Math.min(100, (p.morale || 50) + 6); return `${p.name} glänzt im Interview: Image +2, seine Moral +6`;
        }
    },
    hintergrund: {
        label: '☕ Hintergrundgespräch', cost: () => mediaCost(5000),
        run: () => { const md = initMediaDepartment(); md.goodwill = Math.min(3, md.goodwill + 1); changeMediaImage(1); return `Gute Kontakte zur Presse: Image +1, Wohlwollen ${md.goodwill}/3 (mildert Kritik)`; }
    }
};

function runMediaAction(key, playerId) {
    const action = MEDIA_ACTIONS[key];
    if (!action) return;
    const blocked = getMediaActionBlockReason();
    if (blocked) { showToast(blocked, 'error'); return; }
    const cost = action.cost();
    if (cost > game.money) { showToast(`Nicht genug Geld (${formatVal(cost)}).`, 'error'); return; }
    if (cost > 0) { setzeBuchungskontext('📰 Medienabteilung'); game.money -= cost; loescheBuchungskontext(); }
    const md = initMediaDepartment();
    md.lastActionMatchday = game.matchday;
    md.lastActionSeason = game.season;
    const text = action.run(playerId);
    mediaLog(text);
    showToast(`📰 ${text}`, 'success');
    renderMediaDepartmentPanel();
}

const MEDIA_EVENT_OPTIONS = {
    kritik: [
        { label: 'Fehler eingestehen', run: () => { changeMediaImage(2); return 'Offener Umgang mit der Krise: Image +2'; } },
        { label: 'Mannschaft in Schutz nehmen', run: () => { changeMediaImage(-2); squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 3); }); return 'Rückendeckung für die Spieler: Image -2, Moral +3'; } },
        { label: 'Schweigen', run: () => { changeMediaImage(-4); return 'Schweigen wird als Schwäche gedeutet: Image -4'; } }
    ]
};

// Monatlich: Ereignis aus dem Saisonverlauf, offene Kritik verfällt.
function tickMediaDepartment() {
    const md = initMediaDepartment();
    if (md.event) {
        const alter = (game.matchday - md.event.matchday) + (game.season > md.event.season ? 34 : 0);
        if (alter < MEDIA_EVENT_TIMEOUT) return;
        const text = MEDIA_EVENT_OPTIONS.kritik[2].run();
        mediaLog(`Unbeantwortet: ${text}`);
        md.event = null;
    }
    const letzte = (typeof getOwnSeasonMatches === 'function' ? getOwnSeasonMatches() : []).slice(-3);
    if (letzte.length < 3) return;
    if (letzte.every(m => m.own < m.opp)) {
        if (md.goodwill > 0) { md.goodwill--; mediaLog('Drei Niederlagen - dank guter Kontakte fällt die Kritik mild aus.'); return; }
        md.event = { type: 'kritik', title: 'Die Presse fordert Konsequenzen', text: 'Nach drei Niederlagen in Folge erwarten die Medien eine Stellungnahme.', season: game.season, matchday: game.matchday };
        addInboxMessage('vertrag', '📰 Medien: Die Presse fordert Konsequenzen', 'Nach drei Niederlagen in Folge erwarten die Medien eine Stellungnahme. Antworte in der Managerkarriere bei der Medienabteilung.', 'screen-manager-tree');
    } else if (letzte.every(m => m.own > m.opp)) {
        changeMediaImage(2);
        mediaLog('Drei Siege in Folge: Lobeshymnen in der Presse, Image +2');
    }
}

function answerMediaEvent(index) {
    const md = initMediaDepartment();
    if (!md.event) return;
    const option = (MEDIA_EVENT_OPTIONS[md.event.type] || [])[index];
    if (!option) return;
    const text = option.run();
    mediaLog(text);
    md.event = null;
    showToast(`📰 ${text}`, 'success');
    renderMediaDepartmentPanel();
}

function renderMediaDepartmentPanel() {
    const box = document.getElementById('media-department-box');
    if (!box) return;
    const md = initMediaDepartment();
    const blocked = getMediaActionBlockReason();
    let html = '<div style="font-size:9px;">';
    if (md.event) {
        html += `<div style="background:rgba(255,84,104,0.1); border-left:3px solid var(--danger); padding:6px; border-radius:4px; margin-bottom:6px;">
            <div style="font-weight:bold;">${md.event.title}</div><div style="color:var(--text-muted); margin:3px 0;">${md.event.text}</div>
            ${MEDIA_EVENT_OPTIONS[md.event.type].map((o, i) => `<button onclick="answerMediaEvent(${i})" class="${i === 0 ? 'btn-action' : 'btn-secondary'}" style="font-size:8px; padding:3px 6px; margin:2px 4px 0 0;">${o.label}</button>`).join('')}
        </div>`;
    }
    if (blocked) html += `<div style="color:var(--text-muted); margin-bottom:4px;">${blocked}</div>`;
    const dis = blocked ? 'disabled' : '';
    const kosten = key => { const c = MEDIA_ACTIONS[key].cost(); return c ? ` (${formatVal(c)})` : ''; };
    html += `<button onclick="runMediaAction('kampagne')" class="btn-secondary" ${dis} style="width:100%; font-size:9px; padding:4px; margin-bottom:3px;">${MEDIA_ACTIONS.kampagne.label}${kosten('kampagne')}</button>`;
    html += `<div style="display:flex; gap:4px; margin-bottom:3px;"><select id="media-interview-player" class="input-inline" style="flex:1; font-size:9px;">
        ${interviewCandidates().map(p => `<option value="${p.id}">${p.name} (Moral ${Math.round(p.morale || 50)})</option>`).join('')}</select>
        <button onclick="runMediaAction('interview', document.getElementById('media-interview-player').value)" class="btn-secondary" ${dis} style="font-size:9px; padding:4px;">${MEDIA_ACTIONS.interview.label}</button></div>`;
    html += `<button onclick="runMediaAction('hintergrund')" class="btn-secondary" ${dis} style="width:100%; font-size:9px; padding:4px;">${MEDIA_ACTIONS.hintergrund.label}${kosten('hintergrund')}</button>`;
    html += '<div style="font-size:8px; color:var(--text-muted); margin-top:4px;">Schlechte Laune im Interview schadet. Wohlwollen der Presse mildert die nächste Kritikwelle.</div>';
    if (md.log.length) html += '<div style="margin-top:6px; font-weight:bold;">Zuletzt</div>' + md.log.slice(0, 3).map(l => `<div style="color:var(--text-muted); font-size:8px;">S${l.season}/ST${l.matchday}: ${l.text}</div>`).join('');
    box.innerHTML = html + '</div>';
}
