/* eslint-disable no-undef */
// Liga-Statistiken (Reiter "Statistik" auf dem Liga-Bildschirm): Torjägerliste der ganzen
// Liga (eigene Spieler mit ihren Ligatoren, KI-Vereine mit Star und Sturmspitze - siehe
// creditAiLeagueGoals() in ai-clubs.js), Formtabelle der letzten fünf Spiele, Heim- und
// Auswärtstabelle sowie der Tabellenverlauf aller Vereine. Daten je Verein: t.homeRec /
// t.awayRec ([S, U, N, Tore, Gegentore]) und t.rankHist (Platz je Spieltag), zurückgesetzt
// in advanceLeaguesToNewSeason().

let leagueStatsSplit = 'heim';

// Aus updateLeagueTable(): Heim-/Auswärtsbilanz beider Vereine.
function recordLeagueHomeAway(h, a, f) {
    const add = (rec, tore, gegen) => { rec[tore > gegen ? 0 : (tore === gegen ? 1 : 2)]++; rec[3] += tore; rec[4] += gegen; };
    if (!Array.isArray(h.homeRec)) h.homeRec = [0, 0, 0, 0, 0];
    if (!Array.isArray(a.awayRec)) a.awayRec = [0, 0, 0, 0, 0];
    add(h.homeRec, f.homeGoals, f.awayGoals);
    add(a.awayRec, f.awayGoals, f.homeGoals);
}

// Aus processPostMatchRoutine(), wenn alle Spiele des Spieltags gespielt sind.
function recordLeagueRankHistory() {
    const idx = game.matchday - 1;
    if (idx < 0 || idx >= 34) return;
    (leaguesData || []).forEach((liga, l) => sortedTable(l).forEach((t, i) => {
        if (!Array.isArray(t.rankHist)) t.rankHist = [];
        t.rankHist[idx] = i + 1;
    }));
}

function resetLeagueTeamStats(t) {
    t.homeRec = [0, 0, 0, 0, 0];
    t.awayRec = [0, 0, 0, 0, 0];
    t.rankHist = [];
    if (t.star) t.star.goals = 0;
    if (t.striker) t.striker.goals = 0;
}

// Torjägerliste einer Liga: eigene Spieler (p.goalsSeason zählt nur Ligatore, Pokaltore
// werden in cup-live.js herausgerechnet) und die benannten Torschützen der KI-Vereine.
function getLeagueScorers(level) {
    const liste = [];
    (leaguesData[level] || []).forEach(t => {
        if (t.name === game.clubName) {
            squad.forEach(p => { if ((p.goalsSeason || 0) > 0) liste.push({ name: p.name, pos: p.pos, club: t.name, goals: p.goalsSeason, own: true }); });
        } else if (isAiClub(t)) {
            [t.star, t.striker].forEach(s => { if (s && (s.goals || 0) > 0) liste.push({ name: s.name, pos: s.pos, club: t.name, goals: s.goals }); });
        }
    });
    return liste.sort((a, b) => b.goals - a.goals || (b.own ? 1 : 0) - (a.own ? 1 : 0));
}

function setLeagueStatsSplit(art) {
    leagueStatsSplit = art;
    renderLeagueStats();
}

function leagueTeamCell(t) {
    const eigen = t.name === game.clubName;
    const rivale = t.name === game.permanentRivalName;
    return `<td style="text-align:left; ${eigen ? 'color:var(--primary); font-weight:bold;' : ''}">${t.name}${rivale ? ' ⚔️' : ''}</td>`;
}

function renderLeagueScorersBox(level) {
    const box = document.getElementById('top-scorers-box');
    if (!box) return;
    const liste = getLeagueScorers(level).slice(0, 10);
    if (!liste.length) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine Tore in dieser Saison.</div>'; return; }
    box.innerHTML = `<table style="width:100%; font-size:10px;"><tr style="color:var(--text-muted);"><th>#</th><th style="text-align:left;">Spieler</th><th style="text-align:left;">Verein</th><th>Tore</th></tr>
        ${liste.map((s, i) => `<tr style="${s.own ? 'color:var(--primary); font-weight:700;' : ''}"><td>${i === 0 ? '👑' : i + 1}</td>
            <td style="text-align:left;">${s.name} <span style="color:var(--text-muted);">${s.pos}</span></td><td style="text-align:left;">${s.club}</td>
            <td><strong style="color:var(--accent);">${s.goals}</strong></td></tr>`).join('')}</table>`;
}

function renderLeagueFormTable(level) {
    const box = document.getElementById('league-form-table-box');
    if (!box) return;
    const punkte = t => (t.recentForm || []).reduce((s, r) => s + (r === 'W' ? 3 : (r === 'D' ? 1 : 0)), 0);
    const teams = sortedTable(level);
    if (!teams.some(t => (t.recentForm || []).length)) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Die Formtabelle füllt sich ab dem ersten Spieltag.</div>'; return; }
    const farbe = { W: 'var(--primary)', D: 'var(--accent)', L: 'var(--danger)' };
    const zeilen = teams.map((t, i) => ({ t, platz: i + 1, pkt: punkte(t) })).sort((a, b) => b.pkt - a.pkt || a.platz - b.platz);
    box.innerHTML = `<table style="width:100%; font-size:10px;"><tr style="color:var(--text-muted);"><th>#</th><th style="text-align:left;">Team</th><th>Letzte 5</th><th>Pkt</th><th>Tab.</th></tr>
        ${zeilen.map((z, i) => `<tr><td>${i + 1}</td>${leagueTeamCell(z.t)}
            <td style="white-space:nowrap;">${(z.t.recentForm || []).map(r => `<span style="color:${farbe[r]};">●</span>`).join(' ')}</td>
            <td><strong>${z.pkt}</strong></td><td style="color:var(--text-muted);">${z.platz}.</td></tr>`).join('')}</table>`;
}

function renderLeagueHomeAwayTable(level) {
    const box = document.getElementById('league-homeaway-box');
    if (!box) return;
    const feld = leagueStatsSplit === 'heim' ? 'homeRec' : 'awayRec';
    const rec = t => Array.isArray(t[feld]) ? t[feld] : [0, 0, 0, 0, 0];
    const zeilen = (leaguesData[level] || []).map(t => ({ t, r: rec(t), pkt: rec(t)[0] * 3 + rec(t)[1] }))
        .sort((a, b) => b.pkt - a.pkt || (b.r[3] - b.r[4]) - (a.r[3] - a.r[4]) || b.r[3] - a.r[3]);
    const knopf = (art, text) => `<button onclick="setLeagueStatsSplit('${art}')" class="${leagueStatsSplit === art ? 'btn-action' : 'btn-secondary'}" style="width:auto; padding:4px 12px;">${text}</button>`;
    box.innerHTML = `<div style="display:flex; gap:4px; margin-bottom:6px;">${knopf('heim', '🏠 Heim')}${knopf('auswaerts', '🚌 Auswärts')}</div>
        <table style="width:100%; font-size:10px;"><tr style="color:var(--text-muted);"><th>#</th><th style="text-align:left;">Team</th><th>Sp</th><th>S-U-N</th><th>Tore</th><th>Pkt</th></tr>
        ${zeilen.map((z, i) => `<tr><td>${i + 1}</td>${leagueTeamCell(z.t)}<td>${z.r[0] + z.r[1] + z.r[2]}</td><td>${z.r[0]}-${z.r[1]}-${z.r[2]}</td>
            <td>${z.r[3]}:${z.r[4]}</td><td><strong>${z.pkt}</strong></td></tr>`).join('')}</table>`;
}

// Tabellenverlauf: Platz je Spieltag für alle Vereine; hervorgehoben sind der eigene Verein
// (bzw. der Tabellenführer in fremden Ligen) und der Erzrivale.
function renderLeagueRankChart(level) {
    const box = document.getElementById('league-rank-chart-box');
    if (!box) return;
    const teams = sortedTable(level);
    const n = teams.length;
    const spieltage = Math.max(0, ...teams.map(t => (t.rankHist || []).length));
    if (spieltage < 2 || n < 2) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Der Tabellenverlauf füllt sich mit jedem gespielten Spieltag.</div>'; return; }
    const w = 300, h = 130, pad = 6;
    const x = i => pad + i * (w - pad * 2) / (spieltage - 1);
    const y = platz => pad + (platz - 1) * (h - pad * 2) / (n - 1);
    const linie = t => (t.rankHist || []).map((p, i) => p ? `${x(i).toFixed(1)},${y(p).toFixed(1)}` : null).filter(Boolean).join(' ');
    const eigen = teams.find(t => t.name === game.clubName);
    const fokus = eigen || teams[0];
    const rivale = teams.find(t => t.name === game.permanentRivalName && t !== fokus);
    const hinten = teams.filter(t => t !== fokus && t !== rivale).map(t => `<polyline points="${linie(t)}" fill="none" stroke="rgba(150,150,150,0.35)" stroke-width="1" />`).join('');
    const vorn = (rivale ? `<polyline points="${linie(rivale)}" fill="none" stroke="var(--danger)" stroke-width="1.5" />` : '')
        + `<polyline points="${linie(fokus)}" fill="none" stroke="var(--primary)" stroke-width="2.5" />`;
    const hist = (fokus.rankHist || []).filter(Boolean);
    const bester = hist.length ? Math.min(...hist) : '-', schlechtester = hist.length ? Math.max(...hist) : '-';
    box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:130px; display:block;" preserveAspectRatio="none">
            <line x1="0" x2="${w}" y1="${((y(2) + y(3)) / 2).toFixed(1)}" y2="${((y(2) + y(3)) / 2).toFixed(1)}" stroke="var(--primary)" stroke-dasharray="3 3" stroke-width="0.6" />
            <line x1="0" x2="${w}" y1="${((y(n - 2) + y(n - 1)) / 2).toFixed(1)}" y2="${((y(n - 2) + y(n - 1)) / 2).toFixed(1)}" stroke="var(--danger)" stroke-dasharray="3 3" stroke-width="0.6" />
            ${hinten}${vorn}
        </svg>
        <div style="font-size:9px; color:var(--text-muted); text-align:center;">
            <span style="color:var(--primary);">━</span> ${fokus.name}: aktuell Platz ${teams.indexOf(fokus) + 1}, ${fokus.points} Punkte (bester ${bester}., schlechtester ${schlechtester}.)
            ${rivale ? `· <span style="color:var(--danger);">━</span> ${rivale.name}` : ''} · gestrichelt: Aufstiegs- und Abstiegsplätze
        </div>`;
}

function renderLeagueStats() {
    const level = typeof getLeagueViewLevel === 'function' ? getLeagueViewLevel() : game.leagueLevel;
    renderLeagueScorersBox(level);
    renderLeagueFormTable(level);
    renderLeagueHomeAwayTable(level);
    renderLeagueRankChart(level);
}
