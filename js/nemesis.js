/* eslint-disable no-undef */
// Erzfeind-Trainer (Phase 21.2): eine KI-PERSON (game.nemesis), nicht ein Verein. Zu Beginn
// trainiert er den Erzrivalen (game.rivalManagerName); wird er im Trainerkarussell entlassen
// oder spielt sein Klub in einer anderen Liga, übernimmt er zum Saisonwechsel oft einen
// Verein in DEINER Liga - er sucht das Duell. Sein Verein = das Team, dessen team.coach.name
// er ist (findNemesisTeam()).
// - Bilanz/Begegnungen aus recordRivalryResult() (alle drei Spieltagswege, nur Ligaspiele).
// - Revanche: nach einer Niederlage gegen ihn spielt die Mannschaft das nächste Duell mit
//   +1,5 Stärke; der Revanche-Sieg bringt Fans +2, Medien +2.
// - Persönlichkeit (RIVAL_MANAGER_PERSONALITIES) wirkt echt: Taktik-Fuchs kontert einen
//   ausrechenbaren Stil immer, Eiskalter Analytiker +1 solange er die Bilanz anführt,
//   Publikumsliebling +1 zu Hause, Aufsteiger-Talent +0,5 je gemeinsamer Saison (max. 2),
//   Provokateur: Siege gegen dich kosten deine Moral 3, Alte Schule: nach dem Duell Fitness -4.
// - Abwerben: einmal pro Saison bietet sein Verein 125 % Marktwert für einen unzufriedenen
//   Stammspieler; Ablehnen kostet den Spieler weitere Moral, Verkaufen an ihn ärgert die Fans.

const NEMESIS_REVENGE_BONUS = 1.5;

function ensureNemesis() {
    if (game.nemesis && game.nemesis.name) return game.nemesis;
    const rivalTeam = (leaguesData || []).flat().find(t => t && t.name === game.permanentRivalName);
    const coach = rivalTeam && typeof getTeamCoach === 'function' ? getTeamCoach(rivalTeam) : null;
    game.nemesis = {
        name: coach ? coach.name : (game.rivalManagerName || getRandomName()),
        trait: game.rivalManagerTrait || 'Provokateur',
        since: game.season, record: { w: 0, d: 0, l: 0 }, meetings: [], revenge: false,
        lastPoachSeason: 0, unemployedSince: null
    };
    return game.nemesis;
}

function findNemesisTeam() {
    const n = ensureNemesis();
    for (let l = 0; l < (leaguesData || []).length; l++) {
        const t = (leaguesData[l] || []).find(x => x && x.coach && x.coach.name === n.name && x.name !== game.clubName);
        if (t) return { team: t, level: l };
    }
    return null;
}

function isNemesisTeam(team) {
    if (!team || !game.nemesis) return false;
    return !!(team.coach && team.coach.name === game.nemesis.name);
}

function getNemesisSeasons() {
    const n = ensureNemesis();
    return Math.max(1, game.season - n.since + 1);
}

// Stärke-Änderung für UNS im Ligaspiel gegen seinen Verein (negativ = er ist im Vorteil).
function getNemesisModifier(oppTeam, isHome) {
    if (!isNemesisTeam(oppTeam)) return 0;
    const n = game.nemesis;
    let m = n.revenge ? NEMESIS_REVENGE_BONUS : 0;
    if (n.trait === 'Eiskalter Analytiker' && n.record.l > n.record.w) m -= 1;
    if (n.trait === 'Publikumsliebling' && !isHome) m -= 1;
    if (n.trait === 'Aufsteiger-Talent') m -= Math.min(2, 0.5 * getNemesisSeasons());
    return m;
}

// Livespiel (setupMatch): Modifikator auf die eingefrorene Basisstärke.
function applyNemesisLiveModifier(oppTeam, isHome) {
    if (!currentMatch || currentMatch.isCup) return;
    const m = getNemesisModifier(oppTeam, isHome);
    if (!m) return;
    currentMatch.ourBaseStr += m;
    if (currentMatch.isHome) currentMatch.homeStr += m; else currentMatch.awayStr += m;
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += `<div style="color:var(--purple);">🎩 Duell mit ${game.nemesis.name}: ${m > 0 ? '+' : ''}${String(m).replace('.', ',')} Stärke${game.nemesis.revenge ? ' (Revanche!)' : ''}.</div>`;
}

// Taktik-Fuchs: kontert einen ausrechenbaren Stil immer (getOppTacticPlan()).
function nemesisAlwaysCounters(oppTeam) {
    return isNemesisTeam(oppTeam) && game.nemesis.trait === 'Taktik-Fuchs';
}

const NEMESIS_QUOTES = {
    vorher: {
        Provokateur: n => `"Gegen die habe ich noch nie schlecht ausgesehen. ${n.record.l > 0 ? 'Und das bleibt so.' : 'Wird Zeit, dass sich das ändert.'}"`,
        'Taktik-Fuchs': () => '"Ich weiß genau, wie die spielen. Ehrlich gesagt: jedes Mal gleich."',
        'Eiskalter Analytiker': () => '"Wir haben uns die Daten angesehen. Es gibt keine Überraschungen mehr."',
        Publikumsliebling: () => '"Unsere Fans werden den Unterschied machen. Gegen diesen Trainer sowieso."',
        'Alte Schule': () => '"Das wird kein Ballett. Wer nicht dagegenhält, verliert."',
        'Aufsteiger-Talent': () => '"Ich habe von ihm gelernt. Jetzt zeige ich ihm, was daraus geworden ist."'
    },
    sieg: ['"Das war eine Lehrstunde."', '"Wie erwartet."', '"Er sollte über seine Taktik nachdenken."'],
    niederlage: ['"Glück gehabt. Nächstes Mal sieht das anders aus."', '"Der Schiedsrichter hat das Spiel entschieden."', '"Wir sehen uns wieder."'],
    remis: ['"Mehr war für die heute nicht drin."', '"Ein Punkt, mehr haben sie nicht verdient."']
};

function nemesisQuote(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

// Aus recordRivalryResult(): jede Ligapartie gegen seinen Verein.
function recordNemesisResult(opponentName, ourGoals, oppGoals) {
    const nt = findNemesisTeam();
    if (!nt || nt.team.name !== opponentName) return null;
    const n = game.nemesis;
    const res = ourGoals > oppGoals ? 'S' : (ourGoals < oppGoals ? 'N' : 'U');
    const folgen = [];
    const warRevanche = n.revenge;
    if (res === 'S') n.record.w++; else if (res === 'N') n.record.l++; else n.record.d++;
    if (warRevanche && res === 'S') {
        game.fans = Math.min(100, game.fans + 2);
        if (typeof changeMediaImage === 'function') changeMediaImage(2); else game.managerMediaImage = Math.min(100, (game.managerMediaImage ?? 50) + 2);
        folgen.push('Revanche geglückt: Fans +2, Medien +2');
    }
    if (res === 'N' && n.trait === 'Provokateur') {
        squad.forEach(p => { p.morale = Math.max(0, (p.morale || 50) - 3); });
        folgen.push('Seine Sprüche nach dem Spiel: Moral -3');
    }
    if (n.trait === 'Alte Schule') {
        squad.filter(p => (lineup || []).includes(p.id)).forEach(p => { p.fitness = Math.max(0, (p.fitness ?? 100) - 4); });
        folgen.push('Harte Gangart: Fitness der Startelf -4');
    }
    n.revenge = res === 'N';
    if (n.revenge) folgen.push('Nächstes Duell: Revanche (+1,5 Stärke)');
    n.meetings.unshift({ season: game.season, matchday: game.matchday, club: opponentName, score: `${ourGoals}:${oppGoals}`, res });
    if (n.meetings.length > 12) n.meetings.length = 12;
    const spruch = nemesisQuote(res === 'S' ? NEMESIS_QUOTES.niederlage : (res === 'N' ? NEMESIS_QUOTES.sieg : NEMESIS_QUOTES.remis));
    addInboxMessage('vertrag', `🎩 ${n.name} nach dem ${ourGoals}:${oppGoals}`,
        `${n.name} (${opponentName}): ${spruch}\n\nBilanz gegen ihn: ${n.record.w}S ${n.record.d}U ${n.record.l}N${folgen.length ? '\n' + folgen.join(' · ') : ''}`, 'screen-history');
    return { res, folgen };
}

// Monatlich: Abwerbeversuch bei einem unzufriedenen Stammspieler (einmal pro Saison).
function tickNemesisPoaching() {
    const n = ensureNemesis();
    if (n.lastPoachSeason === game.season || game.matchday < 5 || game.matchday > 28) return;
    const nt = findNemesisTeam();
    if (!nt || nt.level !== game.leagueLevel) return;
    if (Math.random() > 0.35) return;
    const stamm = [...squad].sort((a, b) => b.strength - a.strength).slice(0, 14);
    const ziel = stamm.filter(p => (p.morale ?? 60) < 55 && !incomingOffers.some(o => o.playerId === p.id))
        .sort((a, b) => b.strength - a.strength)[0];
    if (!ziel || typeof triggerNewAITransferOffer !== 'function') return;
    n.lastPoachSeason = game.season;
    triggerNewAITransferOffer(ziel, { club: nt.team.name, multiplier: 1.25, nemesis: true });
    addInboxMessage('transfer', `🎩 ${n.name} will ${ziel.name}`,
        `${n.name} (${nt.team.name}) bietet 125 % des Marktwerts für ${ziel.name} - er weiß, dass der Spieler unzufrieden ist. Verkaufst du an ihn, sind die Fans sauer (-3). Lehnst du ab, verliert ${ziel.name} weiter an Moral.`, 'screen-transfer');
}

// Hooks aus transfermarket.js
function onNemesisOfferRejected(offer) {
    const p = squad.find(x => x.id === offer.playerId);
    if (p) p.morale = Math.max(0, (p.morale || 50) - 4);
    showToast(`🎩 ${offer.playerName} bleibt - aber ${game.nemesis ? game.nemesis.name : 'der Erzfeind'} hat ihm den Kopf verdreht (Moral -4).`, 'error', 4000);
}

function onNemesisOfferAccepted(offer) {
    game.fans = Math.max(game.fanBaseFloor || 0, game.fans - 3);
    addInboxMessage('vertrag', `😠 Fans wütend: ${offer.playerName} geht zum Erzfeind`,
        `Dass ${offer.playerName} ausgerechnet zu ${offer.clubName} wechselt, nehmen dir die Fans übel (Fans -3).`, 'screen-dashboard');
}

// Trainerkarussell (tickCoachCarousel): wird er entlassen, ist er vorerst arbeitslos.
function onCoachSacked(team, altName) {
    const n = game.nemesis;
    if (!n || n.name !== altName) return;
    n.unemployedSince = game.season;
    addInboxMessage('vertrag', `🎩 ${n.name} bei ${team.name} entlassen`,
        `Dein Erzfeind ${n.name} muss bei ${team.name} gehen. Ganz verschwinden wird er nicht - Trainer wie er tauchen wieder auf, meist dort, wo sie dir begegnen.`, 'screen-history');
}

// Saisonwechsel (nach dem Ligenwechsel): er sucht das Duell in deiner Liga.
function tickNemesisSeason() {
    const n = ensureNemesis();
    const nt = findNemesisTeam();
    if (nt && nt.level === game.leagueLevel) return;
    const chance = nt ? 0.5 : 0.85;
    if (Math.random() > chance) return;
    const reserve = game.secondTeam && game.secondTeam.name;
    const kandidaten = (leaguesData[game.leagueLevel] || []).filter(t => t.name !== game.clubName && t.name !== reserve && !(t.coach && t.coach.name === n.name));
    if (!kandidaten.length) return;
    // Er will gewinnen: bevorzugt einen Verein aus der oberen Hälfte der Stärke.
    const sortiert = [...kandidaten].sort((a, b) => b.strength - a.strength);
    const neu = sortiert[Math.floor(Math.random() * Math.ceil(sortiert.length / 2))];
    if (nt && nt.team.coach) nt.team.coach = { name: getRandomName(), since: game.season, sackedThisSeason: false };
    const alterTrainer = neu.coach ? neu.coach.name : null;
    neu.coach = { name: n.name, since: game.season, sackedThisSeason: false };
    n.unemployedSince = null;
    addInboxMessage('vertrag', `🎩 ${n.name} übernimmt ${neu.name}`,
        `${nt ? `${n.name} verlässt ${nt.team.name}` : `Nach seiner Pause kehrt ${n.name} zurück`} und übernimmt ${neu.name}${alterTrainer ? ` (Nachfolger von ${alterTrainer})` : ''}. In der Presse: "Ich wollte in diese Liga. Es gibt da noch eine Rechnung zu begleichen."`, 'screen-history');
}

// Spielvorbericht (startMatchdayFlow): Spruch, Bilanz, Revanche.
function renderNemesisPrematch(oppTeam) {
    const box = document.getElementById('prematch-nemesis-box');
    if (!box) return;
    if (!isNemesisTeam(oppTeam)) { box.innerHTML = ''; return; }
    const n = game.nemesis;
    const vorher = NEMESIS_QUOTES.vorher[n.trait] || NEMESIS_QUOTES.vorher.Provokateur;
    const mod = getNemesisModifier(oppTeam, !!(pendingMatchInfo && pendingMatchInfo.isHome));
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--purple);">🎩 <strong>Duell mit dem Erzfeind:</strong> ${n.name} (${n.trait}) · Bilanz ${n.record.w}S ${n.record.d}U ${n.record.l}N
        <div style="margin-top:2px;"><em>${vorher(n)}</em></div>
        <div style="color:var(--text-muted); margin-top:2px;">${describeNemesisTrait(n)}${n.revenge ? ' · <span style="color:var(--primary);">Revanche: deine Elf brennt (+1,5 Stärke)</span>' : ''}${mod ? ` · Stärke-Effekt heute: ${mod > 0 ? '+' : ''}${String(mod).replace('.', ',')}` : ''}</div></div>`;
}

function describeNemesisTrait(n) {
    switch (n.trait) {
        case 'Taktik-Fuchs': return 'Kontert einen ausrechenbaren Spielstil immer';
        case 'Eiskalter Analytiker': return 'Solange er die Bilanz anführt: -1 Stärke für dich';
        case 'Publikumsliebling': return 'Bei ihm zu Hause: -1 Stärke für dich';
        case 'Aufsteiger-Talent': return `Wird jedes Jahr besser: -${String(Math.min(2, 0.5 * getNemesisSeasons())).replace('.', ',')} Stärke`;
        case 'Alte Schule': return 'Harte Gangart: Fitness der Startelf -4 nach dem Duell';
        default: return 'Gewinnt er, kosten seine Sprüche Moral (-3)';
    }
}

// Historie > Rivalen
function renderNemesisBox() {
    const box = document.getElementById('nemesis-box');
    if (!box) return;
    const n = ensureNemesis();
    const nt = findNemesisTeam();
    const wo = nt ? `${nt.team.name} (${leagueNames[nt.level]})` : 'derzeit ohne Verein';
    const begegnungen = n.meetings.length
        ? n.meetings.map(m => `<div style="padding:1px 0;">S${m.season} Spt ${m.matchday}: <strong style="color:${m.res === 'S' ? 'var(--primary)' : (m.res === 'N' ? 'var(--danger)' : 'var(--text-muted)')};">${m.score}</strong> gegen ${m.club}</div>`).join('')
        : '<div style="color:var(--text-muted);">Noch kein Duell gegen ihn.</div>';
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--purple);">🎩 <strong>${n.name}</strong> · ${n.trait} · ${wo}
        <div>Bilanz: ${n.record.w}S ${n.record.d}U ${n.record.l}N · seit Saison ${n.since}${n.revenge ? ' · <span style="color:var(--primary);">Revanche offen</span>' : ''}</div>
        <div style="color:var(--text-muted);">${describeNemesisTrait(n)}</div>
        <div style="margin-top:4px;">${begegnungen}</div></div>`;
}
