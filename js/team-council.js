// Mannschaftsrat: Kapitän + zwei Führungsspieler. Einmal im Monat bringt der Rat höchstens
// ein Anliegen ein, das aus dem echten Kaderzustand entsteht (Moral, Einsatzzeiten,
// Trainingshärte, Siegesserie). Deine Entscheidung wirkt auf Moral und Kasse.

const COUNCIL_CONCERN_TIMEOUT = 4; // Spieltage, bis ein unbeantwortetes Anliegen verfällt
const COUNCIL_LEAGUE_COST_FACTOR = [1.0, 0.7, 0.45, 0.3, 0.2, 0.12];

function initTeamCouncil() {
    if (!game.teamCouncil) game.teamCouncil = { memberIds: [], concern: null, history: [] };
    const tc = game.teamCouncil;
    tc.memberIds = tc.memberIds.filter(id => squad.some(p => p.id === id));
    if (tc.memberIds.length < 3) electTeamCouncil(true);
    return tc;
}

// Kapitän plus die beiden Spieler mit der größten Führungsqualität (getLeadershipScore in
// js/locker-room.js: Leader-Eigenschaft, Alter, Erfahrung, Moral). Der einzige Rat im Spiel -
// der frühere zweite "Führungsspieler-Rat" (campus-staff.js) ist darin aufgegangen.
function electTeamCouncil(silent) {
    const tc = game.teamCouncil || (game.teamCouncil = { memberIds: [], concern: null, history: [] });
    const captain = squad.find(p => p.id === game.captainId);
    const score = p => typeof getLeadershipScore === 'function' ? getLeadershipScore(p) : (p.appearances || 0);
    const rest = squad.filter(p => !captain || p.id !== captain.id)
        .sort((a, b) => score(b) - score(a))
        .slice(0, captain ? 2 : 3);
    tc.memberIds = [...(captain ? [captain.id] : []), ...rest.map(p => p.id)];
    if (!silent) { showToast('🤝 Der Mannschaftsrat wurde neu gewählt.', 'success'); renderTeamCouncilPanel(); }
}

function getCouncilMembers() {
    return initTeamCouncil().memberIds.map(id => squad.find(p => p.id === id)).filter(Boolean);
}

// Ein gut gelaunter Rat fängt Niederlagen auf, ein frustrierter verstärkt sie (Moral nach
// Niederlagen in processPostMatchRoutine, kleiner Anteil auch in calcTeamStrength).
function getCouncilMoraleStabilizer() {
    const members = getCouncilMembers();
    if (members.length === 0) return 0;
    const schnitt = members.reduce((s, p) => s + (p.morale || 50), 0) / members.length;
    return schnitt >= 70 ? 3 : (schnitt <= 35 ? -2 : 0);
}

function councilCost(base) {
    const f = COUNCIL_LEAGUE_COST_FACTOR[game.leagueLevel] ?? COUNCIL_LEAGUE_COST_FACTOR[COUNCIL_LEAGUE_COST_FACTOR.length - 1];
    return Math.round(base * f / 500) * 500;
}

function adjustMorale(players, delta) {
    players.forEach(p => { p.morale = Math.max(10, Math.min(100, (p.morale || 50) + delta)); });
}

// Findet das dringendste Anliegen aus dem aktuellen Zustand - oder keines.
function findCouncilConcern() {
    if (squad.length === 0) return null;
    const avgMorale = squad.reduce((s, p) => s + (p.morale || 50), 0) / squad.length;
    if (avgMorale < 45) {
        return { type: 'stimmung', title: 'Die Stimmung in der Kabine ist im Keller',
            text: `Die durchschnittliche Moral liegt bei ${Math.round(avgMorale)}. Der Rat schlägt einen gemeinsamen Mannschaftsabend vor.`,
            cost: councilCost(40000) };
    }
    // Kabine (js/locker-room.js): rumorende Clique oder die Kapitänsfrage.
    const kabine = typeof findLockerRoomConcern === 'function' ? findLockerRoomConcern() : null;
    if (kabine) return kabine;

    const medianStrength = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)];
    const vergessen = game.matchday >= 8 && squad
        .filter(p => (p.appearancesSeason || 0) === 0 && p.strength >= medianStrength && !(p.injured > 0))
        .sort((a, b) => b.strength - a.strength)[0];
    if (vergessen) {
        return { type: 'einsatzzeit', playerId: vergessen.id, title: `${vergessen.name} fühlt sich übergangen`,
            text: `${vergessen.name} (Stärke ${vergessen.strength}) hat diese Saison noch kein Spiel gemacht. Der Rat bittet um ein klärendes Gespräch.` };
    }

    if (game.trainingIntensity === 'hart' || game.trainingIntensity === 'intensiv') {
        return { type: 'training', title: 'Die Trainingsbelastung ist zu hoch',
            text: 'Die Führungsspieler melden müde Beine und wachsenden Unmut über das harte Training.' };
    }

    const letzte = (typeof getOwnSeasonMatches === 'function' ? getOwnSeasonMatches() : []).slice(-3);
    if (letzte.length === 3 && letzte.every(m => m.own > m.opp)) {
        return { type: 'praemie', title: 'Die Mannschaft möchte eine Prämie für die Siegesserie',
            text: 'Drei Siege in Folge - der Rat bittet um eine Sonderprämie für die Mannschaft.',
            cost: councilCost(60000) };
    }
    return null;
}

const COUNCIL_OPTIONS = {
    stimmung: [
        { label: c => `Mannschaftsabend (${formatVal(c.cost)})`, cost: c => c.cost, apply: () => adjustMorale(squad, 6), result: 'Mannschaftsabend organisiert, Moral +6' },
        { label: () => 'Ablehnen', apply: () => adjustMorale(getCouncilMembers(), -5), result: 'Abgelehnt, der Rat ist verstimmt' }
    ],
    einsatzzeit: [
        { label: () => 'Gespräch führen', apply: c => { const p = squad.find(x => x.id === c.playerId); if (p) adjustMorale([p], 10); }, result: 'Gespräch geführt, Spieler beruhigt' },
        { label: () => 'Kein Kommentar', apply: c => { const p = squad.find(x => x.id === c.playerId); if (p) adjustMorale([p], -10); adjustMorale(getCouncilMembers(), -2); }, result: 'Abgewiesen, der Spieler ist enttäuscht' }
    ],
    training: [
        { label: () => 'Training auf normal senken', apply: () => { if (typeof setTrainingIntensity === 'function') setTrainingIntensity('normal'); else game.trainingIntensity = 'normal'; adjustMorale(squad, 4); }, result: 'Training entschärft, Moral +4' },
        { label: () => 'Härte beibehalten', apply: () => adjustMorale(squad, -4), result: 'Härte beibehalten, Moral -4' }
    ],
    clique: [
        { label: c => `${(squad.find(p => p.id === c.leaderId) || {}).name || 'Wortführer'} anhören`, apply: c => { const cl = getCliqueByKey(c.cliqueKey); if (cl) adjustMorale(cl.members, 8); adjustMorale(getCouncilMembers().filter(p => !cl || !cl.members.includes(p)), -2); }, result: 'Gruppe angehört: ihre Stimmung steigt (+8), der Rat sieht eine Bevorzugung (-2)' },
        { label: () => 'Klare Ansage an die Gruppe', apply: c => { const cl = getCliqueByKey(c.cliqueKey); if (!cl) return; adjustMorale(cl.members, -3); adjustMorale(squad.filter(p => !cl.members.includes(p)), 2); const l = squad.find(p => p.id === c.leaderId); if (l) adjustMorale([l], -6); }, result: 'Klare Linie: die Gruppe murrt (-3, Wortführer -6), der Rest der Kabine zieht mit (+2)' }
    ],
    kapitaen: [
        { label: () => 'Kapitän stärken', apply: c => { const k = squad.find(p => p.id === c.captainId); if (k) adjustMorale([k], 10); adjustMorale(getCouncilMembers().filter(p => p.id !== c.captainId), -2); }, result: 'Kapitän gestärkt (+10), der Rat ist skeptisch (-2)' },
        { label: c => `Binde an ${(squad.find(p => p.id === c.successorId) || {}).name || 'den Vorschlag'}`, apply: c => { if (typeof handleCaptainChange === 'function') handleCaptainChange(c.successorId, true); }, result: 'Kapitänswechsel mit Rückendeckung des Rats' }
    ],
    praemie: [
        { label: c => `Prämie zahlen (${formatVal(c.cost)})`, cost: c => c.cost, apply: () => adjustMorale(squad, 5), result: 'Prämie gezahlt, Moral +5' },
        { label: () => 'Ablehnen', apply: () => adjustMorale(squad, -3), result: 'Prämie abgelehnt, Moral -3' }
    ]
};

function answerCouncilConcern(optionIndex) {
    const tc = initTeamCouncil();
    const c = tc.concern;
    if (!c) return;
    const option = (COUNCIL_OPTIONS[c.type] || [])[optionIndex];
    if (!option) return;
    const cost = option.cost ? option.cost(c) : 0;
    if (cost > game.money) { showToast(`Nicht genug Geld (${formatVal(cost)}).`, 'error'); return; }
    if (cost > 0) {
        setzeBuchungskontext('🤝 Mannschaftsrat');
        game.money -= cost;
        loescheBuchungskontext();
    }
    option.apply(c);
    tc.history.unshift({ season: game.season, matchday: game.matchday, title: c.title, result: option.result });
    tc.history = tc.history.slice(0, 6);
    tc.concern = null;
    showToast(`🤝 ${option.result}`, 'success');
    updateUI();
    renderTeamCouncilPanel();
}

// Monatlich: Anliegen verfallen lassen oder neues einbringen; der Rat prägt die Kabine.
function tickTeamCouncil() {
    const tc = initTeamCouncil();
    if (tc.concern) {
        const alter = (game.matchday - tc.concern.matchday) + (game.season > tc.concern.season ? 34 : 0);
        if (alter < COUNCIL_CONCERN_TIMEOUT) return;
        adjustMorale(getCouncilMembers(), -3);
        tc.history.unshift({ season: game.season, matchday: game.matchday, title: tc.concern.title, result: 'Unbeantwortet verfallen, der Rat ist verstimmt' });
        tc.history = tc.history.slice(0, 6);
        tc.concern = null;
    }
    const members = getCouncilMembers();
    const ratMoral = members.reduce((s, p) => s + (p.morale || 50), 0) / Math.max(1, members.length);
    if (ratMoral >= 70) adjustMorale(squad.filter(p => !members.includes(p)), 1);
    else if (ratMoral < 35) adjustMorale(squad.filter(p => !members.includes(p)), -1);

    const concern = findCouncilConcern();
    if (concern) {
        tc.concern = { ...concern, season: game.season, matchday: game.matchday };
        addInboxMessage('vertrag', `🤝 Mannschaftsrat: ${concern.title}`, `${concern.text} Antworte im Kader-Bereich beim Mannschaftsrat.`, 'screen-squad');
    }
}

function renderTeamCouncilPanel() {
    const box = document.getElementById('team-council-box');
    if (!box) return;
    const tc = initTeamCouncil();
    const members = getCouncilMembers();
    let html = '<div style="font-size:9px;">';
    html += members.map(p => `<div style="display:flex; justify-content:space-between; padding:2px 0;">
        <span>${p.id === game.captainId ? 'Ⓒ ' : ''}${p.name} (${p.age || '?'})</span>
        <span style="color:${(p.morale || 50) >= 60 ? 'var(--primary)' : (p.morale || 50) < 40 ? 'var(--danger)' : 'var(--accent)'};">Moral ${Math.round(p.morale || 50)}</span></div>`).join('');
    html += '<button onclick="electTeamCouncil()" class="btn-secondary" style="width:100%; font-size:8px; padding:3px; margin:4px 0;">Rat neu wählen</button>';

    if (tc.concern) {
        const opts = COUNCIL_OPTIONS[tc.concern.type] || [];
        html += `<div style="background:rgba(212,169,74,0.12); border-left:3px solid var(--gold); padding:6px; border-radius:4px; margin-top:4px;">
            <div style="font-weight:bold;">${tc.concern.title}</div>
            <div style="color:var(--text-muted); margin:3px 0;">${tc.concern.text}</div>
            ${opts.map((o, i) => `<button onclick="answerCouncilConcern(${i})" class="${i === 0 ? 'btn-action' : 'btn-secondary'}" style="font-size:8px; padding:3px 6px; margin:2px 4px 0 0;">${o.label(tc.concern)}</button>`).join('')}
        </div>`;
    } else {
        html += '<div style="color:var(--text-muted); margin-top:4px;">Keine offenen Anliegen. Der Rat meldet sich einmal im Monat.</div>';
    }
    if (tc.history.length) {
        html += '<div style="margin-top:6px; font-weight:bold;">Letzte Entscheidungen</div>';
        html += tc.history.slice(0, 3).map(h => `<div style="color:var(--text-muted); font-size:8px;">S${h.season}/ST${h.matchday}: ${h.title} - ${h.result}</div>`).join('');
    }
    box.innerHTML = html + '</div>';
}
