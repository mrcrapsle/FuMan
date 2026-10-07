// Frauenmannschaft: eigenes Team mit Kader, eigener Liga (12 Teams, 22 Spieltage parallel zu
// den Herren-Spieltagen), Auf-/Abstieg zwischen drei Ligen. Einnahmen: Verbandsanteil, Zuschauer
// an Heimspieltagen (Kapazität je Liga, Ticketpreis) und ein Sponsor aus drei Angeboten.
// Spielerinnen entwickeln sich bis zu ihrem Potenzial (bis 27), der Spielerinnenmarkt bietet
// jede Saison neue Kandidatinnen gegen Ablöse. Gehälter und Einnahmen laufen als Spieltagsposten
// im Buchungsjournal.

const WOMEN_LEAGUES = [
    { name: 'Frauen-Bundesliga', minStr: 58, maxStr: 76, wage: 1800, income: 9000 },
    { name: '2. Frauen-Bundesliga', minStr: 44, maxStr: 58, wage: 700, income: 3200 },
    { name: 'Frauen-Regionalliga', minStr: 30, maxStr: 44, wage: 220, income: 900 }
];
const WOMEN_TEAMS_PER_LEAGUE = 12;
const WOMEN_MATCHDAYS = (WOMEN_TEAMS_PER_LEAGUE - 1) * 2;
const WOMEN_FOUNDING_COST = 60000;
const WOMEN_FOERDERUNG = [
    { name: 'Grundbetrieb', cost: 0, growth: 0, wageMult: 1.0 },
    { name: 'Leistungszentrum', cost: 40000, growth: 1, wageMult: 1.2 },
    { name: 'Profi-Strukturen', cost: 150000, growth: 2, wageMult: 1.5 },
    { name: 'Spitzenförderung', cost: 400000, growth: 3, wageMult: 1.9 }
];
const WOMEN_STADIUM_CAP = [2500, 900, 350];
const WOMEN_TICKET_PRICE = 8;
const WOMEN_MAX_SQUAD = 22;
const WOMEN_MARKET_SIZE = 4;
const WOMEN_MARKET_POSITIONS = ['TW', 'ABW', 'MF', 'ST'];
const WOMEN_SPONSOR_NAMES = ['Stadtwerke', 'Autohaus', 'Sportmarke', 'Versicherung', 'Bäckerei-Kette', 'Energieversorger', 'Drogeriemarkt', 'Regionalbank'];
const WOMEN_SPONSOR_SHARES = [0.25, 0.45, 0.7];
const WOMEN_FIRST_NAMES = ['Lena', 'Anna', 'Marie', 'Sophie', 'Laura', 'Julia', 'Lea', 'Hannah', 'Mia', 'Emma', 'Sarah', 'Nina',
    'Lisa', 'Jana', 'Carla', 'Paula', 'Merle', 'Klara', 'Ida', 'Frieda', 'Selin', 'Aylin', 'Svenja', 'Tabea', 'Greta', 'Noemi'];
const WOMEN_LAST_NAMES = ['Brandt', 'Keller', 'Vogel', 'Jansen', 'Kraus', 'Lehmann', 'Arnold', 'Busch', 'Ziegler', 'Winkler',
    'Seidel', 'Kaya', 'Roth', 'Franke', 'Pohl', 'Engel', 'Horn', 'Sauer', 'Graf', 'Kuhn', 'Marx', 'Böhm', 'Stein', 'Yilmaz'];
const WOMEN_CLUB_TOWNS = ['Grünwald', 'Birkenfeld', 'Seestadt', 'Lindenau', 'Talheim', 'Rotenburgh', 'Hohenwart', 'Mühlbach',
    'Kirchhain', 'Neuried', 'Sonnfeld', 'Waldeck', 'Eichstätt-Nord', 'Burgdorfh', 'Altmark', 'Wiesental', 'Sandhofen',
    'Rheinau', 'Bergheide', 'Ostfeld', 'Weißenbach', 'Hafenstadt', 'Ulmenhof', 'Steinach', 'Brückenau', 'Moorfeld', 'Tannheim',
    'Feldkirchen-Süd', 'Auenwald', 'Lerchenberg', 'Kronach-Ost', 'Silberau', 'Heidesee'];
const WOMEN_CLUB_PREFIX = ['SV', 'FC', 'TSV', 'SC', 'VfL', '1. FFC', 'SG', 'FFC'];

function womenRand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function womenOwnStrength() {
    const w = game.womenTeam;
    const top = w.squad.map(p => p.strength).sort((a, b) => b - a).slice(0, 11);
    return top.reduce((s, x) => s + x, 0) / Math.max(1, top.length);
}

function womenPotential(p) {
    return p.potential ?? p.strength + 3;
}

function womenMarketFee(p) {
    return Math.round(p.strength * p.strength * 5);
}

function ensureWomenExtras(w) {
    if (w.market === undefined) refreshWomenMarket();
    if (w.sponsorOffers === undefined) generateWomenSponsorOffers();
    if (w.sponsor === undefined) w.sponsor = null;
    if (w.lastAttendance === undefined) w.lastAttendance = 0;
    if (w.letztesHeim === undefined) w.letztesHeim = null;
    if (!w.zuschauer) w.zuschauer = { summe: 0, spiele: 0 };
}

function createWomenPlayer(level, pos, staerke) {
    const lg = WOMEN_LEAGUES[level];
    const age = womenRand(17, 32);
    const strength = staerke ?? womenRand(lg.minStr - 2, Math.round((lg.minStr + lg.maxStr) / 2));
    return {
        id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: `${WOMEN_FIRST_NAMES[womenRand(0, WOMEN_FIRST_NAMES.length - 1)]} ${WOMEN_LAST_NAMES[womenRand(0, WOMEN_LAST_NAMES.length - 1)]}`,
        pos,
        age,
        strength,
        potential: strength + (age <= 24 ? womenRand(4, 14) : womenRand(0, 3)),
        goals: 0
    };
}

function refreshWomenMarket() {
    const w = game.womenTeam;
    const lg = WOMEN_LEAGUES[w.leagueLevel];
    w.market = Array.from({ length: WOMEN_MARKET_SIZE }, () => createWomenPlayer(
        w.leagueLevel,
        WOMEN_MARKET_POSITIONS[womenRand(0, WOMEN_MARKET_POSITIONS.length - 1)],
        womenRand(lg.minStr + 2, lg.maxStr)
    ));
}

function signWomenPlayer(id) {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
    const idx = w.market.findIndex(p => p.id === id);
    if (idx < 0) return;
    const p = w.market[idx];
    const fee = womenMarketFee(p);
    if (w.squad.length >= WOMEN_MAX_SQUAD) { showToast(`Der Kader ist voll (${WOMEN_MAX_SQUAD} Spielerinnen).`, 'error'); return; }
    if (game.money < fee) { showToast(`Für ${p.name} fehlen ${formatVal(fee - game.money)} Ablöse.`, 'error'); return; }
    setzeBuchungskontext('👩 Frauenmannschaft');
    game.money -= fee;
    loescheBuchungskontext();
    w.market.splice(idx, 1);
    w.squad.push(p);
    showToast(`✅ ${p.name} verpflichtet (${formatVal(fee)} Ablöse)`, 'success');
    renderWomenTeamView();
}

function generateWomenSponsorOffers() {
    const w = game.womenTeam;
    const lg = WOMEN_LEAGUES[w.leagueLevel];
    const namen = [...WOMEN_SPONSOR_NAMES];
    w.sponsorOffers = WOMEN_SPONSOR_SHARES.map(anteil => ({
        name: namen.splice(womenRand(0, namen.length - 1), 1)[0],
        perMatchday: Math.round(lg.income * anteil)
    }));
}

function signWomenSponsor(i) {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
    if (w.sponsor && w.sponsor.season === game.season) { showToast('Für diese Saison gibt es schon einen Sponsor.', 'error'); return; }
    const angebot = w.sponsorOffers[i];
    if (!angebot) return;
    w.sponsor = { name: angebot.name, perMatchday: angebot.perMatchday, season: game.season };
    w.sponsorOffers = [];
    showToast(`🤝 ${angebot.name} ist neuer Sponsor der Frauenmannschaft`, 'success');
    renderWomenTeamView();
}

function buildWomenLeague(level, keepNames) {
    const w = game.womenTeam;
    const lg = WOMEN_LEAGUES[level];
    const used = new Set(keepNames || []);
    const teams = [{ name: w.name, own: true }];
    while (teams.length < WOMEN_TEAMS_PER_LEAGUE) {
        const name = `${WOMEN_CLUB_PREFIX[womenRand(0, WOMEN_CLUB_PREFIX.length - 1)]} ${WOMEN_CLUB_TOWNS[womenRand(0, WOMEN_CLUB_TOWNS.length - 1)]}`;
        if (used.has(name) || teams.some(t => t.name === name)) continue;
        teams.push({ name, strength: womenRand(lg.minStr, lg.maxStr) });
    }
    w.table = teams.map(t => ({ ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }));
    // Doppelrunde nach dem Kreisverfahren
    const idx = teams.map((_, i) => i);
    const rounds = [];
    for (let r = 0; r < WOMEN_TEAMS_PER_LEAGUE - 1; r++) {
        const pairs = [];
        for (let i = 0; i < WOMEN_TEAMS_PER_LEAGUE / 2; i++) {
            let h = idx[i], a = idx[WOMEN_TEAMS_PER_LEAGUE - 1 - i];
            if (r % 2 === 1) [h, a] = [a, h];
            pairs.push([h, a]);
        }
        rounds.push(pairs);
        idx.splice(1, 0, idx.pop());
    }
    w.fixtures = [...rounds, ...rounds.map(r => r.map(([h, a]) => [a, h]))];
    w.round = 0;
    w.lastResults = [];
    w.zuschauer = { summe: 0, spiele: 0 };
    w.lastAttendance = 0;
}

function foundWomenTeam() {
    if (game.womenTeam && game.womenTeam.founded) return;
    if (game.money < WOMEN_FOUNDING_COST) { showToast(`Für die Gründung fehlen ${formatVal(WOMEN_FOUNDING_COST - game.money)}.`, 'error'); return; }
    setzeBuchungskontext('👩 Frauenmannschaft');
    game.money -= WOMEN_FOUNDING_COST;
    loescheBuchungskontext();
    const level = WOMEN_LEAGUES.length - 1;
    game.womenTeam = { founded: true, name: `${game.clubName} Frauen`, leagueLevel: level, foerderung: 0, squad: [], history: [] };
    const positions = ['TW', 'TW', 'ABW', 'ABW', 'ABW', 'ABW', 'ABW', 'ABW', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'ST', 'ST', 'ST', 'ST'];
    game.womenTeam.squad = positions.map(pos => createWomenPlayer(level, pos));
    buildWomenLeague(level);
    refreshWomenMarket();
    generateWomenSponsorOffers();
    addInboxMessage('vertrag', '👩 Frauenmannschaft gegründet!', `${game.womenTeam.name} startet in der ${WOMEN_LEAGUES[level].name}. Die Spiele laufen parallel zu den Herren-Spieltagen.`, 'screen-women');
    showToast('👩 Frauenmannschaft gegründet!', 'success');
    renderWomenTeamView();
}

function upgradeWomenFoerderung() {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
    const next = WOMEN_FOERDERUNG[w.foerderung + 1];
    if (!next) return;
    if (game.money < next.cost) { showToast(`Nicht genug Geld (${formatVal(next.cost)}).`, 'error'); return; }
    setzeBuchungskontext('👩 Frauenmannschaft');
    game.money -= next.cost;
    loescheBuchungskontext();
    w.foerderung++;
    showToast(`👩 Förderung ausgebaut: ${next.name}`, 'success');
    renderWomenTeamView();
}

function womenGoals(att, def) {
    // Poisson-ähnlich: Erwartungswert aus der Stärkedifferenz
    const lambda = Math.max(0.2, 1.35 + (att - def) * 0.06);
    let goals = 0, p = Math.exp(-lambda), s = p, u = Math.random();
    while (u > s && goals < 9) { goals++; p *= lambda / goals; s += p; }
    return goals;
}

// Zuschauer an einem Heimspieltag: Kapazität der Liga, gefüllt nach Fans, eigener Stärke und Förderung.
function womenAttendance() {
    const w = game.womenTeam;
    const lg = WOMEN_LEAGUES[w.leagueLevel];
    const relativ = Math.max(0, Math.min(1, (womenOwnStrength() - lg.minStr) / (lg.maxStr - lg.minStr)));
    const quote = Math.min(0.95, 0.3 + (game.fans || 50) / 250 + relativ * 0.2 + w.foerderung * 0.04);
    return Math.round(WOMEN_STADIUM_CAP[w.leagueLevel] * quote * (0.9 + Math.random() * 0.2));
}

function playWomenRound() {
    const w = game.womenTeam;
    const round = w.fixtures[w.round];
    if (!round) return;
    const own = womenOwnStrength();
    w.lastResults = [];
    w.lastAttendance = 0;
    round.forEach(([h, a]) => {
        const th = w.table[h], ta = w.table[a];
        const sh = (th.own ? own : th.strength) + 2; // Heimvorteil
        const sa = ta.own ? own : ta.strength;
        const gh = womenGoals(sh, sa), ga = womenGoals(sa, sh);
        [[th, gh, ga], [ta, ga, gh]].forEach(([t, f, g]) => {
            t.played++; t.gf += f; t.ga += g;
            if (f > g) { t.won++; t.points += 3; } else if (f === g) { t.drawn++; t.points++; } else t.lost++;
        });
        if (th.own || ta.own) {
            const eigene = th.own ? gh : ga;
            const torschuetzinnen = w.squad.filter(p => p.pos !== 'TW');
            for (let i = 0; i < eigene; i++) torschuetzinnen[womenRand(0, torschuetzinnen.length - 1)].goals++;
            w.lastResults.push(`${th.name} ${gh}:${ga} ${ta.name}`);
        }
        if (th.own) {
            const att = womenAttendance();
            w.lastAttendance = att;
            w.letztesHeim = att;
            w.zuschauer.summe += att;
            w.zuschauer.spiele++;
        }
    });
    w.round++;
}

function getWomenTableSorted() {
    return [...game.womenTeam.table].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

// Einnahmen und Gehälter eines Spieltags ohne Buchung - Ticket nur bei gespieltem Heimspiel.
function womenMatchdayFinances(gespielt) {
    const w = game.womenTeam;
    const lg = WOMEN_LEAGUES[w.leagueLevel];
    const wages = Math.round(lg.wage * w.squad.length * WOMEN_FOERDERUNG[w.foerderung].wageMult / 4);
    const rank = getWomenTableSorted().findIndex(t => t.own) + 1;
    const verband = Math.round(lg.income * (1.3 - rank / WOMEN_TEAMS_PER_LEAGUE * 0.6) * (0.6 + (game.fans || 50) / 125));
    const tickets = gespielt ? w.lastAttendance * WOMEN_TICKET_PRICE : 0;
    const sponsor = gespielt && w.sponsor && w.sponsor.season === game.season ? w.sponsor.perMatchday : 0;
    return { wages, verband, tickets, sponsor };
}

// Jeder Herren-Spieltag: eine Frauen-Runde (solange die Saison läuft) plus Kosten/Einnahmen.
function tickWomenTeam() {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
    ensureWomenExtras(w);
    const gespielt = w.round < WOMEN_MATCHDAYS;
    if (gespielt) playWomenRound();
    const f = womenMatchdayFinances(gespielt);
    const imJournal = typeof hatSpieltagsabrechnung === 'function' && hatSpieltagsabrechnung();
    setzeBuchungskontext(imJournal ? SPIELTAG_KONTEXT : '👩 Frauenmannschaft');
    game.money += f.verband + f.tickets + f.sponsor - f.wages;
    loescheBuchungskontext();
    if (imJournal) {
        bucheInSpieltagsjournal('👩 Frauenmannschaft: Gehälter', f.wages, 'ausgaben');
        bucheInSpieltagsjournal('👩 Frauenmannschaft: Einnahmen', f.verband, 'einnahmen');
        if (f.tickets) bucheInSpieltagsjournal('👩 Frauenmannschaft: Zuschauer', f.tickets, 'einnahmen');
        if (f.sponsor) bucheInSpieltagsjournal('👩 Frauenmannschaft: Sponsor', f.sponsor, 'einnahmen');
    }
}

// Saisonabschluss: Auf-/Abstieg, Entwicklung der Spielerinnen, neue Liga, neuer Markt und Sponsorangebote.
function concludeWomenSeason() {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
    ensureWomenExtras(w);
    while (w.round < WOMEN_MATCHDAYS) playWomenRound();
    const rank = getWomenTableSorted().findIndex(t => t.own) + 1;
    const alteLiga = w.leagueLevel;
    if (rank === 1 && w.leagueLevel > 0) w.leagueLevel--;
    else if (rank >= WOMEN_TEAMS_PER_LEAGUE - 1 && w.leagueLevel < WOMEN_LEAGUES.length - 1) w.leagueLevel++;
    const titel = rank === 1 && alteLiga === 0;
    w.history.unshift({ season: game.season, liga: WOMEN_LEAGUES[alteLiga].name, rank });
    w.history = w.history.slice(0, 10);
    if (titel) {
        game.trophies.push(`Deutsche Meisterin Frauen (Saison ${game.season})`);
        game.fans = Math.min(100, game.fans + 3);
    }
    const growth = WOMEN_FOERDERUNG[w.foerderung].growth;
    w.squad.forEach(p => {
        p.age++;
        const alterseffekt = p.age <= 23 ? 2 : p.age >= 31 ? -2 : 0;
        let neu = p.strength + womenRand(-1, 2) + growth + alterseffekt;
        if (p.age <= 27 && neu > womenPotential(p)) neu = Math.max(p.strength, womenPotential(p));
        p.strength = Math.max(20, Math.min(90, neu));
        p.goals = 0;
    });
    // Karriereende mit 34, Nachrückerinnen auf dem Niveau der (neuen) Liga
    w.squad = w.squad.map(p => p.age >= 34 ? createWomenPlayer(w.leagueLevel, p.pos) : p);
    const verlauf = w.leagueLevel < alteLiga ? `⬆️ Aufstieg in die ${WOMEN_LEAGUES[w.leagueLevel].name}!`
        : w.leagueLevel > alteLiga ? `⬇️ Abstieg in die ${WOMEN_LEAGUES[w.leagueLevel].name}.` : `Klassenerhalt in der ${WOMEN_LEAGUES[w.leagueLevel].name}.`;
    addInboxMessage('vertrag', `👩 Frauenmannschaft: Platz ${rank}`, `${titel ? '🏆 Deutsche Meisterschaft! ' : ''}${verlauf}`, 'screen-women');
    buildWomenLeague(w.leagueLevel);
    w.sponsor = null;
    refreshWomenMarket();
    generateWomenSponsorOffers();
}

function renderWomenTeamView() {
    const box = document.getElementById('women-team-box');
    if (!box) return;
    const w = game.womenTeam;
    if (!w || !w.founded) {
        box.innerHTML = `<div class="panel"><div class="panel-header">👩 FRAUENMANNSCHAFT GRÜNDEN</div><div class="box" style="font-size:10px;">
            Gründe eine eigene Frauenmannschaft. Sie startet in der ${WOMEN_LEAGUES[WOMEN_LEAGUES.length - 1].name} und kann bis in die
            ${WOMEN_LEAGUES[0].name} aufsteigen. Ihre Spiele laufen parallel zu den Herren-Spieltagen, Gehälter und Einnahmen
            erscheinen im Buchungsjournal.</div>
            <button onclick="foundWomenTeam()" class="btn-gold" style="width:100%; padding:8px;">👩 Frauenmannschaft gründen (${formatVal(WOMEN_FOUNDING_COST)})</button></div>`;
        return;
    }
    ensureWomenExtras(w);
    const tabelle = getWomenTableSorted();
    const rank = tabelle.findIndex(t => t.own) + 1;
    const fd = WOMEN_FOERDERUNG[w.foerderung], next = WOMEN_FOERDERUNG[w.foerderung + 1];
    const zuschauerSchnitt = w.zuschauer.spiele ? Math.round(w.zuschauer.summe / w.zuschauer.spiele).toLocaleString('de-DE') : '–';
    const sponsorAktiv = w.sponsor && w.sponsor.season === game.season;
    let html = `<div class="panel"><div class="panel-header">👩 ${w.name.toUpperCase()}</div>
        <div style="font-size:10px; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <div>Liga: <strong>${WOMEN_LEAGUES[w.leagueLevel].name}</strong></div>
            <div>Platz: <strong>${rank}.</strong> · Spieltag ${Math.min(w.round, WOMEN_MATCHDAYS)}/${WOMEN_MATCHDAYS}</div>
            <div>Teamstärke: <strong>${Math.round(womenOwnStrength())}</strong></div>
            <div>Förderung: <strong>${fd.name}</strong></div>
            <div>Ø Zuschauer: <strong>${zuschauerSchnitt}</strong>${w.letztesHeim !== null ? ` · zuletzt ${w.letztesHeim.toLocaleString('de-DE')}` : ''}</div>
            <div>Sponsor: <strong>${sponsorAktiv ? `${w.sponsor.name} (${formatVal(w.sponsor.perMatchday)}/Spt)` : 'keiner'}</strong></div>
        </div>
        ${w.lastResults.length ? `<div style="font-size:9px; color:var(--text-muted); margin-top:4px;">Letztes Spiel: ${w.lastResults.join(' · ')}</div>` : ''}
        ${w.round >= WOMEN_MATCHDAYS ? '<div style="font-size:9px; color:var(--accent); margin-top:4px;">Saison beendet - Auf-/Abstieg zum Saisonwechsel.</div>' : ''}
        ${next ? `<button onclick="upgradeWomenFoerderung()" class="btn-secondary" style="width:100%; font-size:9px; padding:5px; margin-top:6px;">⬆️ ${next.name} (${formatVal(next.cost)}, Entwicklung +${next.growth}/Saison, Gehälter ×${next.wageMult})</button>` : ''}
        </div>`;

    html += `<div class="panel"><div class="panel-header">🤝 SPONSOR</div><div style="font-size:9px;">`;
    if (sponsorAktiv) {
        html += `<div class="box">${w.sponsor.name} zahlt ${formatVal(w.sponsor.perMatchday)} pro Spieltag bis zum Saisonende.</div>`;
    } else if (w.sponsorOffers.length) {
        html += w.sponsorOffers.map((o, i) => `<div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin:3px 0;">
            <span>${o.name} · ${formatVal(o.perMatchday)} pro Spieltag</span>
            <button onclick="signWomenSponsor(${i})" class="btn-secondary" style="font-size:9px; padding:3px 6px;">Unterschreiben</button></div>`).join('');
    } else {
        html += '<div style="color:var(--text-muted);">Keine Angebote. Nach Saisonende gibt es neue.</div>';
    }
    html += '</div></div>';

    html += `<div class="panel"><div class="panel-header">📊 TABELLE</div><table style="width:100%; font-size:9px; border-collapse:collapse;">
        <tr style="color:var(--text-muted);"><td>#</td><td>Verein</td><td>Sp</td><td>Tore</td><td style="text-align:right;">Pkt</td></tr>`;
    tabelle.forEach((t, i) => {
        const zone = i === 0 && w.leagueLevel > 0 ? 'var(--primary)' : i >= WOMEN_TEAMS_PER_LEAGUE - 2 && w.leagueLevel < WOMEN_LEAGUES.length - 1 ? 'var(--danger)' : 'inherit';
        html += `<tr style="${t.own ? 'font-weight:bold; color:var(--accent);' : ''}"><td style="color:${zone};">${i + 1}</td><td>${t.name}</td><td>${t.played}</td><td>${t.gf}:${t.ga}</td><td style="text-align:right;">${t.points}</td></tr>`;
    });
    html += '</table></div>';

    html += `<div class="panel"><div class="panel-header">🔁 SPIELERINNENMARKT</div><div style="font-size:9px;">`;
    html += w.market.map(p => `<div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin:3px 0;">
        <span>${p.pos} ${p.name} (${p.age}) · <strong>${p.strength}</strong>${p.age <= 27 ? ` · Pot. ${womenPotential(p)}` : ''}</span>
        <button onclick="signWomenPlayer('${p.id}')" class="btn-secondary" style="font-size:9px; padding:3px 6px; white-space:nowrap;">${formatVal(womenMarketFee(p))}</button></div>`).join('')
        || '<div style="color:var(--text-muted);">Keine Kandidatinnen mehr. Neue gibt es zum Saisonwechsel.</div>';
    html += `<div style="color:var(--text-muted); margin-top:4px;">Kader ${w.squad.length}/${WOMEN_MAX_SQUAD} · Ablöse wird sofort fällig</div></div></div>`;

    const kader = [...w.squad].sort((a, b) => b.strength - a.strength);
    html += `<div class="panel"><div class="panel-header">👟 KADER (${kader.length})</div><div style="font-size:9px; display:grid; grid-template-columns:1fr 1fr; gap:2px 8px;">`;
    html += kader.map(p => `<div>${p.pos} ${p.name} (${p.age}) · <strong>${p.strength}</strong>${p.age <= 27 ? ` · Pot. ${womenPotential(p)}` : ''}${p.goals ? ` · ⚽${p.goals}` : ''}</div>`).join('');
    html += '</div></div>';

    if (w.history.length) {
        html += '<div class="panel"><div class="panel-header">📜 SAISONHISTORIE</div><div style="font-size:9px;">'
            + w.history.map(h => `<div>Saison ${h.season}: Platz ${h.rank} in der ${h.liga}</div>`).join('') + '</div></div>';
    }
    box.innerHTML = html;
}
