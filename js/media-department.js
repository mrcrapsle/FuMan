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

// ---------- PRESSEKONFERENZ VOR DEM SPIEL ----------
// Die Frage richtet sich nach der Lage (Derby, Krise, Favorit, Außenseiter, Pokal, sonst
// Marschroute); jede Antwort wirkt: Moral, Stärke in genau diesem Spiel, Taktik, Medien-
// image oder Vorstand. Große Worte werden nach dem Spiel abgerechnet (game.pressPromise).
function pressMoral(delta) { squad.forEach(p => { p.morale = Math.max(10, Math.min(100, (p.morale || 50) + delta)); }); }
function pressBoard(delta) { game.boardSat = Math.max(0, Math.min(100, game.boardSat + delta)); }
function pressMatchBonus(delta) { game.pressMatchBonus = { season: game.season, matchday: game.matchday, bonus: delta }; }
function pressPromise(typ) { game.pressPromise = { season: game.season, matchday: game.matchday, typ }; }

function getOwnRecentLosses() {
    const letzte = (typeof getOwnSeasonMatches === 'function' ? getOwnSeasonMatches() : []).slice(-2);
    return letzte.length === 2 && letzte.every(m => m.own < m.opp);
}

const PRESS_SITUATIONS = [
    { key: 'pokal', when: c => c.cup, frage: c => `Pokalspiel gegen ${c.oppName} - welchen Stellenwert hat der Wettbewerb?`, antworten: [
        { text: 'Wir wollen unbedingt weiterkommen!', hint: 'Stärke +1, Moral +2', run: () => { pressMatchBonus(1); pressMoral(2); return 'Kampfansage im Pokal'; } },
        { text: 'Die Liga hat Vorrang.', hint: 'Elf wird geschont (ausgeruhte Spieler), Vorstand +1', run: () => { if (typeof rotateTiredPlayers === 'function') lineup = pickBestLineupIds(); pressBoard(1); return 'Pokal mit Blick auf die Liga'; } },
        { text: 'Wir schauen von Runde zu Runde.', hint: 'Medienimage +1', run: () => { changeMediaImage(1); return 'Diplomatische Antwort'; } }
    ] },
    { key: 'derby', when: c => c.oppName === game.permanentRivalName || (typeof getOurRivalName === 'function' && c.oppName === getOurRivalName()),
      frage: c => `Derby gegen ${c.oppName}! Was erwarten Sie?`, antworten: [
        { text: 'Wir fegen sie vom Platz!', hint: 'Moral +3, Stärke +1 - riskant: bei Niederlage Image, Fans und Vorstand runter', run: () => { pressMoral(3); pressMatchBonus(1); pressPromise('sieg'); return 'Kampfansage vor dem Derby'; } },
        { text: 'Ein Spiel wie jedes andere.', hint: 'Vorstand +1', run: () => { pressBoard(1); return 'Gelassenheit vor dem Derby'; } },
        { text: 'Großer Respekt vor dem Gegner.', hint: 'Medienimage +2', run: () => { changeMediaImage(2); return 'Respekt vor dem Rivalen'; } }
    ] },
    { key: 'krise', when: () => getOwnRecentLosses(), frage: () => 'Zwei Niederlagen in Folge - steht Ihr Job zur Debatte?', antworten: [
        { text: 'Ich habe volles Vertrauen in die Mannschaft.', hint: 'Moral +4, bei weiterer Niederlage Vorstand -3', run: () => { pressMoral(4); pressPromise('vertrauen'); return 'Rückendeckung für das Team'; } },
        { text: 'Die Spieler müssen mehr liefern.', hint: 'Stärke +1,5 in diesem Spiel, Moral -4', run: () => { pressMatchBonus(1.5); pressMoral(-4); return 'Öffentliche Kritik an den Spielern'; } },
        { text: 'Wir analysieren das in Ruhe.', hint: 'Medienimage +1, Vorstand +1', run: () => { changeMediaImage(1); pressBoard(1); return 'Sachliche Analyse'; } }
    ] },
    { key: 'favorit', when: c => c.ourStr >= c.oppStr + 6, frage: c => `Sie sind klarer Favorit gegen ${c.oppName}. Ein Pflichtsieg?`, antworten: [
        { text: 'Alles andere als drei Punkte wäre eine Enttäuschung.', hint: 'Moral +2 - bei Punktverlust Image und Vorstand runter', run: () => { pressMoral(2); pressPromise('sieg'); return 'Pflichtsieg angekündigt'; } },
        { text: 'Es gibt keine leichten Gegner.', hint: 'Stärke +0,5 (keine Überheblichkeit)', run: () => { pressMatchBonus(0.5); return 'Warnung vor Überheblichkeit'; } },
        { text: 'Ich rotiere, um Kräfte zu sparen.', hint: 'Ausgeruhte Elf wird aufgestellt', run: () => { lineup = pickBestLineupIds(); return 'Rotation angekündigt'; } }
    ] },
    { key: 'underdog', when: c => c.oppStr >= c.ourStr + 6, frage: c => `${c.oppName} ist klarer Favorit. Rechnen Sie sich etwas aus?`, antworten: [
        { text: 'Wir haben nichts zu verlieren!', hint: 'Stärke +1, Moral +2', run: () => { pressMatchBonus(1); pressMoral(2); return 'Mutige Außenseiter-Rolle'; } },
        { text: 'Wir stehen tief und lauern auf Konter.', hint: 'Spielstil wird auf Konterfußball gestellt', run: () => { game.tacticStyle = 'konter'; return 'Konter-Taktik angekündigt'; } },
        { text: 'Ein Punkt wäre ein Erfolg.', hint: 'Medienimage +1, Vorstand +1', run: () => { changeMediaImage(1); pressBoard(1); return 'Bescheidene Ziele'; } }
    ] },
    { key: 'standard', when: () => true, frage: () => 'Wie lautet die Marschroute für das Spiel?', antworten: [
        { text: 'Volle Offensive auf Sieg!', hint: 'Spielstil Offensiv, Moral +1', run: () => { game.tacticStyle = 'offensiv'; pressMoral(1); return 'Offensive angekündigt'; } },
        { text: 'Kompakt stehen und kontern.', hint: 'Spielstil Konterfußball', run: () => { game.tacticStyle = 'konter'; return 'Konterfußball angekündigt'; } },
        { text: 'Kräfte schonen & rotieren.', hint: 'Ausgeruhte Elf wird aufgestellt', run: () => { lineup = pickBestLineupIds(); return 'Rotation angekündigt'; } }
    ] }
];

let pressSituation = null;

function renderPressConference(ctx) {
    const c = { ...ctx, ourStr: typeof calcTeamStrength === 'function' ? calcTeamStrength(ctx.isHome) : 50 };
    pressSituation = PRESS_SITUATIONS.find(s => s.when(c));
    game.pressMatchBonus = null;
    const q = document.getElementById('press-question-container');
    if (q) q.innerHTML = `<strong>Journalist fragt:</strong> "${pressSituation.frage(c)}"`;
    const box = document.getElementById('press-answers-container');
    if (!box) return;
    box.innerHTML = pressSituation.antworten.map((a, i) => `<button onclick="answerPressConference(${i})" class="btn-action" style="margin:3px 0; text-align:left;">${a.text}<br><span style="font-size:9px; font-weight:600; opacity:0.8;">${a.hint}</span></button>`).join('');
}

function answerPressConference(index) {
    const a = pressSituation && pressSituation.antworten[index];
    if (!a) { skipPressAndPlay(); return; }
    const text = a.run();
    mediaLog(`Pressekonferenz: ${text}`);
    showToast(`🎙️ ${text}`, 'success');
    skipPressAndPlay();
}

// Direkt nach setupMatch(): Stärkebonus aus der Pressekonferenz für genau dieses Spiel.
function applyPressConferenceToMatch() {
    const b = game.pressMatchBonus;
    if (!b || b.season !== game.season || b.matchday !== game.matchday || !currentMatch) return;
    currentMatch.ourBaseStr += b.bonus;
    game.pressMatchBonus = null;
}

// Aus processPostMatchRoutine(): große Worte werden abgerechnet.
function resolvePressPromise(matchResult) {
    const pp = game.pressPromise;
    if (!pp || pp.season !== game.season || pp.matchday !== game.matchday || matchResult === null) return;
    game.pressPromise = null;
    if (pp.typ === 'sieg') {
        if (matchResult === 'win') { changeMediaImage(2); game.fans = Math.min(100, game.fans + 1); mediaLog('Versprochen und gehalten - die Presse feiert dich.'); }
        else { changeMediaImage(-3); game.fans = Math.max(game.fanBaseFloor || 0, game.fans - 2); pressBoard(-2); mediaLog('Große Worte, kein Sieg - die Presse zerreißt dich.'); addInboxMessage('vertrag', '📰 Große Worte, kein Sieg', 'Du hattest vor dem Spiel einen Sieg angekündigt. Medien, Fans und Vorstand nehmen dir das übel.', 'screen-dashboard'); }
    } else if (pp.typ === 'vertrauen' && matchResult === 'loss') {
        pressBoard(-3);
        mediaLog('Wieder verloren trotz Rückendeckung - der Vorstand wird unruhig.');
    }
}
