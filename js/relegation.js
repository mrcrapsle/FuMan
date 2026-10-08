// Relegation: Der Drittletzte (Platz 16) spielt nach dem 34. Spieltag in Hin- und Rückspiel
// gegen den Dritten der Liga darunter, der eigene Dritte entsprechend gegen den 16. der
// Liga darüber. Betrifft nur den eigenen Verein - die KI-Vereine steigen weiter symmetrisch
// 2 rauf/2 runter (siehe advanceLeaguesToNewSeason). Gespielt wird mit einem Kurz-Ticker auf
// dem Dashboard; wer direkt "Saison abschließen" wählt, bekommt die Spiele automatisch
// simuliert (resolveRelegationForSeasonEnd).

function sortedTable(level) {
    return [...(leaguesData[level] || [])].sort(compareTableRows);
}

// Reine Abfrage (ohne Zustand zu ändern): steht der Verein nach Saisonende auf einem Relegationsplatz?
function getRelegationSituation() {
    if (game.matchday <= 34) return null;
    const table = sortedTable(game.leagueLevel);
    const rank = table.findIndex(t => t.name === game.clubName) + 1;
    const reserve = game.secondTeam && game.secondTeam.name;
    let type = null, oppLevel = null, oppRank = null;
    if (rank === 16 && game.leagueLevel < NUM_LEAGUES - 1) { type = 'abstieg'; oppLevel = game.leagueLevel + 1; oppRank = 3; }
    else if (rank === 3 && game.leagueLevel > 0) { type = 'aufstieg'; oppLevel = game.leagueLevel - 1; oppRank = 16; }
    if (!type) return null;
    // Eine zweite Mannschaft darf nicht in die Liga des eigenen Profiteams - dann rückt der Nächste nach.
    const kandidaten = sortedTable(oppLevel).filter(t => t.name !== game.clubName && t.name !== reserve);
    const opp = type === 'abstieg' ? kandidaten[oppRank - 1] : kandidaten[kandidaten.length - 3];
    if (!opp) return null;
    return { type, rank, oppName: opp.name, oppStrength: opp.strength, oppLevel, oppTeam: opp };
}

function getRelegationState() {
    const r = game.relegation;
    return r && r.season === game.season ? r : null;
}

// Minuten und Torschützen für den Kurz-Ticker.
function buildRelegationTicker(ourGoals, oppGoals, oppName) {
    const schuetzen = squad.filter(p => lineup.includes(p.id) && !(p.injured > 0));
    const gewichtet = schuetzen.flatMap(p => p.pos === 'ST' ? [p, p, p] : p.pos === 'MIT' ? [p, p] : p.pos === 'ABW' ? [p] : []);
    const events = [];
    for (let i = 0; i < ourGoals; i++) {
        const p = gewichtet[Math.floor(Math.random() * gewichtet.length)] || squad[0];
        if (p) p.goalsCareer = (p.goalsCareer || 0) + 1;
        events.push({ min: 1 + Math.floor(Math.random() * 90), own: true, name: p ? p.name : game.clubName });
    }
    for (let i = 0; i < oppGoals; i++) events.push({ min: 1 + Math.floor(Math.random() * 90), own: false, name: getRandomName() + ` (${oppName})` });
    return events.sort((a, b) => a.min - b.min);
}

function playRelegationLeg(silent = false) {
    const sit = getRelegationSituation();
    if (!sit) return null;
    let r = getRelegationState();
    if (!r) {
        r = game.relegation = { season: game.season, type: sit.type, oppName: sit.oppName, oppLevel: sit.oppLevel, legs: [], result: null };
    }
    if (r.result) return r;
    // Der Verein aus der unteren Liga hat im Hinspiel Heimrecht.
    const legIdx = r.legs.length;
    const isHome = (r.type === 'aufstieg') === (legIdx === 0);
    const ownStr = calcTeamStrength(isHome);
    const oppStr = typeof getOpponentMatchStrength === 'function' ? getOpponentMatchStrength(sit.oppStrength, !isHome) : sit.oppStrength;
    const ownTeam = (leaguesData[game.leagueLevel] || []).find(t => t.name === game.clubName) || null;
    // Live gespielt (js/cup-live.js)? Dann zählt das Ergebnis aus der Live-Engine.
    const live = typeof takeLiveCupResult === 'function'
        ? takeLiveCupResult('relegation', isHome ? game.clubName : sit.oppName, isHome ? sit.oppName : game.clubName) : null;
    const g = live ? { myGoals: live.homeGoals, oppGoals: live.awayGoals }
        : (isHome ? simulateGoals(ownStr, oppStr, ownTeam, sit.oppTeam) : simulateGoals(oppStr, ownStr, sit.oppTeam, ownTeam));
    const ourGoals = isHome ? g.myGoals : g.oppGoals, oppGoals = isHome ? g.oppGoals : g.myGoals;
    const leg = { isHome, ourGoals, oppGoals, live: !!live, ticker: live ? [] : buildRelegationTicker(ourGoals, oppGoals, sit.oppName), income: 0 };

    if (isHome) {
        // Ausverkauftes Endspiel-Gefühl: wie ein Pokalspiel (1,4-fache Nachfrage).
        const att = typeof calculateMatchAttendance === 'function' ? calculateMatchAttendance(1.4, 1) : 0;
        const preis = (stadium.stehShare ?? 0.5) * game.ticketPrices.steh + (stadium.sitzShare ?? 0.45) * game.ticketPrices.sitz;
        leg.attendance = att;
        leg.income = Math.round(att * preis);
        if (leg.income > 0) {
            const aeussererKontext = buchungsKontext;
            setzeBuchungskontext('⚔️ Relegation: Heimspiel');
            game.money += leg.income;
            setzeBuchungskontext(aeussererKontext);
        }
    }
    r.legs.push(leg);

    if (r.legs.length === 2) {
        const own = r.legs[0].ourGoals + r.legs[1].ourGoals, opp = r.legs[0].oppGoals + r.legs[1].oppGoals;
        let gewonnen = own > opp;
        if (own === opp) {
            // Elfmeterschießen: leichter Vorteil für die stärkere Mannschaft.
            r.penalties = true;
            gewonnen = Math.random() < 0.5 + Math.max(-0.15, Math.min(0.15, (ownStr - oppStr) / 100));
        }
        r.aggregate = `${own}:${opp}`;
        r.result = gewonnen ? (r.type === 'aufstieg' ? 'promoted' : 'stayed') : (r.type === 'aufstieg' ? 'stayed' : 'relegated');
        squad.forEach(p => { p.morale = Math.max(5, Math.min(100, (p.morale || 50) + (gewonnen ? 10 : -10))); });
        game.fans = Math.max(0, Math.min(100, game.fans + (gewonnen ? 4 : -4)));
        const titel = r.type === 'aufstieg'
            ? (gewonnen ? '🎉 Aufstieg über die Relegation!' : '😞 Relegation verloren - kein Aufstieg')
            : (gewonnen ? '💪 Klassenerhalt in der Relegation!' : '💔 Abstieg nach Relegation');
        addInboxMessage('vertrag', titel, `Relegation gegen ${r.oppName}: ${r.legs.map((l, i) => `${i === 0 ? 'Hinspiel' : 'Rückspiel'} ${l.ourGoals}:${l.oppGoals} (${l.isHome ? 'H' : 'A'})`).join(', ')} - Gesamt ${r.aggregate}${r.penalties ? ', Entscheidung im Elfmeterschießen' : ''}.`, 'screen-dashboard');
    }
    if (!silent) {
        const kopf = `${r.legs.length === 1 ? 'Hinspiel' : 'Rückspiel'}: ${leg.isHome ? game.clubName : r.oppName} - ${leg.isHome ? r.oppName : game.clubName}`;
        const stand = leg.isHome ? `${leg.ourGoals}:${leg.oppGoals}` : `${leg.oppGoals}:${leg.ourGoals}`;
        const ticker = leg.ticker.length ? leg.ticker.map(e => `${e.min}' ⚽ ${e.name}`).join('\n') : 'Keine Tore.';
        const ende = r.result ? `\n\nGesamt ${r.aggregate}${r.penalties ? ' - Elfmeterschießen!' : ''}\n${({ promoted: '🎉 AUFSTIEG!', stayed: r.type === 'abstieg' ? '💪 Klasse gehalten!' : 'Kein Aufstieg.', relegated: '💔 Abstieg.' })[r.result]}` : '';
        showNotice(`⚔️ Relegation - ${kopf}`, `Endstand ${stand}${leg.attendance ? ` · ${leg.attendance.toLocaleString('de-DE')} Zuschauer · ${formatVal(leg.income)} Ticketeinnahmen` : ''}\n\n${ticker}${ende}`, { typ: r.result === 'relegated' || (r.result === 'stayed' && r.type === 'aufstieg') ? 'warn' : undefined });
        updateUI();
        renderRelegationBox();
    }
    return r;
}

// Saisonabschluss: noch offene Relegationsspiele werden simuliert. Ergebnis: 'promoted' |
// 'stayed' | 'relegated' oder null, wenn der Verein keinen Relegationsplatz hat.
function resolveRelegationForSeasonEnd() {
    if (!getRelegationSituation()) return null;
    let r = getRelegationState();
    while (!r || !r.result) {
        r = playRelegationLeg(true);
        if (!r) return null;
    }
    return r.result;
}

function renderRelegationBox() {
    const box = document.getElementById('dash-relegation-box');
    if (!box) return;
    const sit = getRelegationSituation();
    const r = getRelegationState();
    const endBtn = document.getElementById('dash-season-end-actions');
    if (!sit) { box.innerHTML = ''; return; }
    const offen = !r || !r.result;
    if (endBtn && game.matchday > 34) endBtn.style.display = offen ? 'none' : 'block';
    const ziel = sit.type === 'aufstieg' ? `Aufstieg in die ${leagueNames[sit.oppLevel]}` : `Klassenerhalt gegen den Dritten der ${leagueNames[sit.oppLevel]}`;
    const gespielt = (r ? r.legs : []).map((l, i) => `<div>${i === 0 ? 'Hinspiel' : 'Rückspiel'} (${l.isHome ? 'Heim' : 'Auswärts'}): <strong>${l.ourGoals}:${l.oppGoals}</strong></div>`).join('');
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--accent); margin-bottom:6px;">
        ⚔️ <strong>RELEGATION</strong> - Platz ${sit.rank}: ${ziel}<br>Gegner: <strong>${sit.oppName}</strong> (Stärke ${sit.oppStrength})
        ${gespielt}
        ${r && r.result ? `<div style="margin-top:4px; font-weight:800;">Gesamt ${r.aggregate}${r.penalties ? ' n.E.' : ''}: ${({ promoted: '🎉 Aufstieg geschafft!', stayed: sit.type === 'abstieg' ? '💪 Klasse gehalten!' : 'Kein Aufstieg.', relegated: '💔 Abstieg.' })[r.result]}</div>`
            : `<div style="display:flex; gap:6px; margin-top:6px;"><button onclick="startRelegationLive()" class="btn-action">🎮 ${r && r.legs.length === 1 ? 'Rückspiel' : 'Hinspiel'} live</button><button onclick="playRelegationLeg()" class="btn-secondary">⚡ Nur Ergebnis</button></div>`}
    </div>`;
}
