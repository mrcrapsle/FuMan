// Frauenmannschaft: eigenes Team mit Kader, eigener Liga (12 Teams, 22 Spieltage parallel zu
// den Herren-Spieltagen), Auf-/Abstieg zwischen drei Ligen und Kosten/Einnahmen als
// Spieltagsposten im Buchungsjournal.

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

function createWomenPlayer(level, pos) {
    const lg = WOMEN_LEAGUES[level];
    return {
        id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: `${WOMEN_FIRST_NAMES[womenRand(0, WOMEN_FIRST_NAMES.length - 1)]} ${WOMEN_LAST_NAMES[womenRand(0, WOMEN_LAST_NAMES.length - 1)]}`,
        pos,
        age: womenRand(17, 32),
        strength: womenRand(lg.minStr - 2, Math.round((lg.minStr + lg.maxStr) / 2)),
        goals: 0
    };
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

function playWomenRound() {
    const w = game.womenTeam;
    const round = w.fixtures[w.round];
    if (!round) return;
    const own = womenOwnStrength();
    w.lastResults = [];
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
    });
    w.round++;
}

function getWomenTableSorted() {
    return [...game.womenTeam.table].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

// Jeder Herren-Spieltag: eine Frauen-Runde (solange die Saison läuft) plus Kosten/Einnahmen.
function tickWomenTeam() {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
    if (w.round < WOMEN_MATCHDAYS) playWomenRound();

    const lg = WOMEN_LEAGUES[w.leagueLevel];
    const wages = Math.round(lg.wage * w.squad.length * WOMEN_FOERDERUNG[w.foerderung].wageMult / 4); // pro Spieltag
    const rank = getWomenTableSorted().findIndex(t => t.own) + 1;
    const income = Math.round(lg.income * (1.3 - rank / WOMEN_TEAMS_PER_LEAGUE * 0.6) * (0.6 + (game.fans || 50) / 125));
    const imJournal = typeof hatSpieltagsabrechnung === 'function' && hatSpieltagsabrechnung();
    setzeBuchungskontext(imJournal ? SPIELTAG_KONTEXT : '👩 Frauenmannschaft');
    game.money += income - wages;
    loescheBuchungskontext();
    if (imJournal) {
        bucheInSpieltagsjournal('👩 Frauenmannschaft: Gehälter', wages, 'ausgaben');
        bucheInSpieltagsjournal('👩 Frauenmannschaft: Einnahmen', income, 'einnahmen');
    }
}

// Saisonabschluss: Auf-/Abstieg, Entwicklung der Spielerinnen, neue Liga.
function concludeWomenSeason() {
    const w = game.womenTeam;
    if (!w || !w.founded) return;
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
        p.strength = Math.max(20, Math.min(90, p.strength + womenRand(-1, 2) + growth + alterseffekt));
        p.goals = 0;
    });
    // Karriereende mit 34, Nachrückerinnen auf dem Niveau der (neuen) Liga
    w.squad = w.squad.map(p => p.age >= 34 ? createWomenPlayer(w.leagueLevel, p.pos) : p);
    const verlauf = w.leagueLevel < alteLiga ? `⬆️ Aufstieg in die ${WOMEN_LEAGUES[w.leagueLevel].name}!`
        : w.leagueLevel > alteLiga ? `⬇️ Abstieg in die ${WOMEN_LEAGUES[w.leagueLevel].name}.` : `Klassenerhalt in der ${WOMEN_LEAGUES[w.leagueLevel].name}.`;
    addInboxMessage('vertrag', `👩 Frauenmannschaft: Platz ${rank}`, `${titel ? '🏆 Deutsche Meisterschaft! ' : ''}${verlauf}`, 'screen-women');
    buildWomenLeague(w.leagueLevel);
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
    const tabelle = getWomenTableSorted();
    const rank = tabelle.findIndex(t => t.own) + 1;
    const fd = WOMEN_FOERDERUNG[w.foerderung], next = WOMEN_FOERDERUNG[w.foerderung + 1];
    let html = `<div class="panel"><div class="panel-header">👩 ${w.name.toUpperCase()}</div>
        <div style="font-size:10px; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <div>Liga: <strong>${WOMEN_LEAGUES[w.leagueLevel].name}</strong></div>
            <div>Platz: <strong>${rank}.</strong> · Spieltag ${Math.min(w.round, WOMEN_MATCHDAYS)}/${WOMEN_MATCHDAYS}</div>
            <div>Teamstärke: <strong>${Math.round(womenOwnStrength())}</strong></div>
            <div>Förderung: <strong>${fd.name}</strong></div>
        </div>
        ${w.lastResults.length ? `<div style="font-size:9px; color:var(--text-muted); margin-top:4px;">Letztes Spiel: ${w.lastResults.join(' · ')}</div>` : ''}
        ${w.round >= WOMEN_MATCHDAYS ? '<div style="font-size:9px; color:var(--accent); margin-top:4px;">Saison beendet - Auf-/Abstieg zum Saisonwechsel.</div>' : ''}
        ${next ? `<button onclick="upgradeWomenFoerderung()" class="btn-secondary" style="width:100%; font-size:9px; padding:5px; margin-top:6px;">⬆️ ${next.name} (${formatVal(next.cost)}, Entwicklung +${next.growth}/Saison, Gehälter ×${next.wageMult})</button>` : ''}
        </div>`;

    html += `<div class="panel"><div class="panel-header">📊 TABELLE</div><table style="width:100%; font-size:9px; border-collapse:collapse;">
        <tr style="color:var(--text-muted);"><td>#</td><td>Verein</td><td>Sp</td><td>Tore</td><td style="text-align:right;">Pkt</td></tr>`;
    tabelle.forEach((t, i) => {
        const zone = i === 0 && w.leagueLevel > 0 ? 'var(--primary)' : i >= WOMEN_TEAMS_PER_LEAGUE - 2 && w.leagueLevel < WOMEN_LEAGUES.length - 1 ? 'var(--danger)' : 'inherit';
        html += `<tr style="${t.own ? 'font-weight:bold; color:var(--accent);' : ''}"><td style="color:${zone};">${i + 1}</td><td>${t.name}</td><td>${t.played}</td><td>${t.gf}:${t.ga}</td><td style="text-align:right;">${t.points}</td></tr>`;
    });
    html += '</table></div>';

    const kader = [...w.squad].sort((a, b) => b.strength - a.strength);
    html += `<div class="panel"><div class="panel-header">👟 KADER (${kader.length})</div><div style="font-size:9px; display:grid; grid-template-columns:1fr 1fr; gap:2px 8px;">`;
    html += kader.map(p => `<div>${p.pos} ${p.name} (${p.age}) · <strong>${p.strength}</strong>${p.goals ? ` · ⚽${p.goals}` : ''}</div>`).join('');
    html += '</div></div>';

    if (w.history.length) {
        html += '<div class="panel"><div class="panel-header">📜 SAISONHISTORIE</div><div style="font-size:9px;">'
            + w.history.map(h => `<div>Saison ${h.season}: Platz ${h.rank} in der ${h.liga}</div>`).join('') + '</div></div>';
    }
    box.innerHTML = html;
}
