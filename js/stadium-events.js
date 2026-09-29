// Stadion-Events: Veranstaltungen im eigenen Stadion abseits der Ligaspiele.
// Organisationskosten sofort, Durchführung frühestens 2 Spieltage später, höchstens
// ein Event zur Zeit und mindestens 4 Spieltage Abstand - sonst wäre es eine Gelddruckmaschine.

const STADIUM_EVENT_TYPES = [
    { key: 'stadiontag', name: 'Stadiontag', icon: '🏟️', visitors: 5000, revenue: 75000 },
    { key: 'fanfest', name: 'Fanfest', icon: '🎉', visitors: 8000, revenue: 120000 },
    { key: 'sponsorenabend', name: 'Sponsoren-Abend', icon: '🥂', visitors: 2000, revenue: 80000 },
    { key: 'nachwuchsfestival', name: 'Nachwuchs-Festival', icon: '⚽', visitors: 6000, revenue: 45000 }
];
const STADIUM_EVENT_LEAGUE_FACTOR = [1.0, 0.7, 0.45, 0.3, 0.2, 0.12];
const STADIUM_EVENT_COST_SHARE = 0.4;
const STADIUM_EVENT_LEAD_TIME = 2;
const STADIUM_EVENT_COOLDOWN = 4;

function getStadiumEventLeagueFactor() {
    return STADIUM_EVENT_LEAGUE_FACTOR[game.leagueLevel] ?? STADIUM_EVENT_LEAGUE_FACTOR[STADIUM_EVENT_LEAGUE_FACTOR.length - 1];
}

function getStadiumEventExpectedRevenue(type) {
    return Math.round(type.revenue * getStadiumEventLeagueFactor());
}

function getPendingStadiumEvent() {
    return (stadium.events || []).find(e => !e.completed) || null;
}

function getStadiumEventBlockReason() {
    if (getPendingStadiumEvent()) return 'Es ist bereits ein Event geplant.';
    const last = (stadium.events || []).filter(e => e.completed && e.season === game.season)
        .reduce((max, e) => Math.max(max, e.completedMatchday || 0), 0);
    if (last && game.matchday - last < STADIUM_EVENT_COOLDOWN) {
        return `Nächstes Event ab Spieltag ${last + STADIUM_EVENT_COOLDOWN} möglich.`;
    }
    return null;
}

function scheduleStadiumEvent(key) {
    const type = STADIUM_EVENT_TYPES.find(t => t.key === key);
    if (!type) return;
    const blocked = getStadiumEventBlockReason();
    if (blocked) { showToast(blocked, 'error'); return; }
    const cost = Math.round(getStadiumEventExpectedRevenue(type) * STADIUM_EVENT_COST_SHARE);
    if (game.money < cost) { showToast(`Nicht genug Geld für die Organisation (${formatVal(cost)}).`, 'error'); return; }

    setzeBuchungskontext('📅 Stadion-Events');
    game.money -= cost;
    loescheBuchungskontext();

    if (!stadium.events) stadium.events = [];
    stadium.events.push({
        id: 'se_' + game.season + '_' + game.matchday + '_' + type.key,
        key: type.key,
        name: type.name,
        cost,
        season: game.season,
        scheduledMatchday: game.matchday + STADIUM_EVENT_LEAD_TIME,
        completed: false
    });
    if (stadium.events.length > 30) stadium.events.shift();
    showToast(`${type.icon} ${type.name} geplant für Spieltag ${game.matchday + STADIUM_EVENT_LEAD_TIME} (Kosten ${formatVal(cost)}).`, 'success');
    renderStadiumEventsPanel();
}

function runStadiumEvent(eventId) {
    const event = (stadium.events || []).find(e => e.id === eventId && !e.completed);
    if (!event) return;
    if (game.matchday < event.scheduledMatchday && event.season === game.season) {
        showToast(`${event.name} findet erst ab Spieltag ${event.scheduledMatchday} statt.`, 'error');
        return;
    }
    const type = STADIUM_EVENT_TYPES.find(t => t.key === event.key) || STADIUM_EVENT_TYPES[0];
    const turnout = 0.7 + Math.random() * 0.6;
    const visitors = Math.min(stadium.total || 16000, Math.round(type.visitors * getStadiumEventLeagueFactor() * turnout));
    const revenue = Math.round(getStadiumEventExpectedRevenue(type) * turnout);

    setzeBuchungskontext('📅 Stadion-Events');
    game.money += revenue;
    loescheBuchungskontext();

    Object.assign(event, { completed: true, completedMatchday: game.matchday, visitors, revenue });
    addInboxMessage('vertrag', `${type.icon} ${event.name}: ${visitors.toLocaleString('de-DE')} Besucher`,
        `Einnahmen ${formatVal(revenue)} bei Organisationskosten von ${formatVal(event.cost)} - Ergebnis ${formatVal(revenue - event.cost)}.`, 'screen-stadium');
    updateUI();
    renderStadiumEventsPanel();
}

function renderStadiumEventsPanel() {
    const box = document.getElementById('stadium-events-panel');
    if (!box) return;

    const pending = getPendingStadiumEvent();
    let html = '';

    if (pending) {
        const ready = game.matchday >= pending.scheduledMatchday || pending.season !== game.season;
        html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:8px; font-size:9px;">
            <div><strong>${pending.name}</strong> · geplant für Spieltag ${pending.scheduledMatchday}</div>
            <div style="color:var(--text-muted); font-size:8px;">Organisationskosten bezahlt: ${formatVal(pending.cost)}</div>
            ${ready
                ? `<button onclick="runStadiumEvent('${pending.id}')" class="btn-primary" style="font-size:9px; padding:4px 6px; margin-top:4px;">Event durchführen</button>`
                : '<div style="font-size:8px; color:var(--accent); margin-top:4px;">Vorbereitung läuft …</div>'}
        </div>`;
    } else {
        const blocked = getStadiumEventBlockReason();
        if (blocked) html += `<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">${blocked}</div>`;
        STADIUM_EVENT_TYPES.forEach(t => {
            const expected = getStadiumEventExpectedRevenue(t);
            const cost = Math.round(expected * STADIUM_EVENT_COST_SHARE);
            html += `<button onclick="scheduleStadiumEvent('${t.key}')" class="btn-secondary" ${blocked ? 'disabled' : ''}
                style="width:100%; font-size:9px; padding:5px; margin-bottom:3px; text-align:left;">
                ${t.icon} ${t.name} · Kosten ${formatVal(cost)} · erwartet ~${formatVal(expected)}</button>`;
        });
    }

    const done = (stadium.events || []).filter(e => e.completed).slice(-3).reverse();
    if (done.length) {
        html += '<div style="font-size:9px; font-weight:bold; margin:8px 0 4px;">Letzte Events</div>';
        done.forEach(e => {
            html += `<div style="font-size:8px; color:var(--text-muted);">S${e.season}/ST${e.completedMatchday}: ${e.name} - ${(e.visitors || 0).toLocaleString('de-DE')} Besucher, ${formatVal((e.revenue || 0) - (e.cost || 0))}</div>`;
        });
    }
    box.innerHTML = html;
}
