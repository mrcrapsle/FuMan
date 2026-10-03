/* eslint-disable no-undef */
// Saisonvorschau & Experten-Check: vor jeder Saison tippen die Experten die komplette Tabelle
// (game.seasonPreview), dein eigener Platz ist dieselbe Erwartung, die auch Vorstand und
// Mitgliederversammlung verwenden (game.seasonExpectation.expectedRank). Am Saisonende vergleicht
// buildSeasonExpertCheck() Tipp und Wirklichkeit (game.seasonReviews): Überraschung, Flop,
// Trefferquote der Experten und der Spieler der Saison. Wer die Experten deutlich widerlegt,
// gewinnt Medienimage und Fans; wer weit hinter dem Tipp landet, verliert Ansehen.

const PREVIEW_EXPERT_NOISE = 3; // Experten liegen daneben: ±3 Stärke Rauschen pro KI-Verein

// Einziger "Spieler der Saison" (Gala, Chronik, Experten-Check): beste Kicker-Ø-Note mit
// mindestens 10 Ligaspielen, bei Gleichstand mehr Tore. Ohne Noten zählt der beste Torschütze.
function pickPlayerOfSeason() {
    const mitNoten = squad.filter(p => p.statsSeason && p.statsSeason.spiele >= 10)
        .map(p => ({ p, schnitt: p.statsSeason.notenSumme / p.statsSeason.spiele }))
        .sort((a, b) => a.schnitt - b.schnitt || (b.p.goalsSeason || 0) - (a.p.goalsSeason || 0));
    if (mitNoten.length) {
        const b = mitNoten[0];
        return { p: b.p, grade: Math.round(b.schnitt * 100) / 100, goals: b.p.goalsSeason || 0, games: b.p.statsSeason.spiele };
    }
    const top = [...squad].sort((a, b) => (b.goalsSeason || 0) - (a.goalsSeason || 0) || b.strength - a.strength)[0];
    return top ? { p: top, grade: null, goals: top.goalsSeason || 0, games: top.appearancesSeason || 0 } : null;
}

function getPreviewVerdict(rank, teams) {
    if (rank <= 2) return 'Topfavorit auf den Aufstieg';
    if (rank <= 3) return 'heißer Kandidat für die Relegation nach oben';
    if (rank <= Math.ceil(teams / 3)) return 'Platz im oberen Drittel';
    if (rank >= teams - 2) return 'Abstiegskandidat Nummer eins';
    if (rank >= teams - 4) return 'Zittern im Tabellenkeller';
    return 'graues Mittelfeld';
}

// Saisonstart (concludeSeasonAndAdvance nach recordSeasonExpectationRank) und neues Spiel.
function createSeasonPreview() {
    const teams = leaguesData[game.leagueLevel] || [];
    if (!teams.length) return null;
    const exp = typeof getSeasonExpectation === 'function' ? getSeasonExpectation() : null;
    const andere = teams.filter(t => t.name !== game.clubName)
        .map(t => ({ t, wert: t.strength + (Math.random() * 2 - 1) * PREVIEW_EXPERT_NOISE }))
        .sort((a, b) => b.wert - a.wert).map(x => x.t);
    const own = Math.min(Math.max(1, (exp && exp.expectedRank) || andere.length + 1), andere.length + 1);
    const order = andere.map(t => t.name);
    order.splice(own - 1, 0, game.clubName);
    // Geheimtipp: der stärkste Verein, den die Experten in der unteren Hälfte sehen.
    const untere = andere.filter(t => order.indexOf(t.name) >= Math.floor(order.length / 2));
    const geheimtipp = untere.sort((a, b) => b.strength - a.strength)[0];
    game.seasonPreview = {
        season: game.season, level: game.leagueLevel, order, own,
        darkHorse: geheimtipp ? geheimtipp.name : null,
        verdict: getPreviewVerdict(own, order.length)
    };
    return game.seasonPreview;
}

// Für Spielstände ohne Vorschau: nur vor dem ersten Spieltag nachträglich anlegen.
function getCurrentSeasonPreview() {
    const pv = game.seasonPreview;
    if (pv && pv.season === game.season && pv.level === game.leagueLevel) return pv;
    if (game.matchday <= 1) return createSeasonPreview();
    return null;
}

// Saisonende, VOR Auf-/Abstieg (Tabelle der abgelaufenen Saison).
function buildSeasonExpertCheck(myRank) {
    const pv = game.seasonPreview;
    const tabelle = [...(leaguesData[game.leagueLevel] || [])].sort(compareTableRows).map(t => t.name);
    const spieler = typeof pickPlayerOfSeason === 'function' ? pickPlayerOfSeason() : null;
    const bericht = { season: game.season, league: leagueNames[game.leagueLevel], actualOwn: myRank, teams: tabelle.length,
        player: spieler ? { name: spieler.p.name, grade: spieler.grade, goals: spieler.goals } : null };
    if (pv && pv.season === game.season && pv.level === game.leagueLevel) {
        const vergleich = pv.order.filter(n => n !== game.clubName && tabelle.includes(n))
            .map(n => ({ name: n, pred: pv.order.indexOf(n) + 1, act: tabelle.indexOf(n) + 1 }))
            .map(x => ({ ...x, delta: x.pred - x.act }));
        const sortiert = [...vergleich].sort((a, b) => b.delta - a.delta);
        bericht.predOwn = pv.own;
        bericht.surprise = sortiert[0] && sortiert[0].delta > 0 ? sortiert[0] : null;
        bericht.flop = sortiert[sortiert.length - 1] && sortiert[sortiert.length - 1].delta < 0 ? sortiert[sortiert.length - 1] : null;
        bericht.champPred = pv.order[0];
        bericht.champActual = tabelle[0];
        const top3 = tabelle.slice(0, 3), unten3 = tabelle.slice(-3);
        bericht.top3Hits = pv.order.slice(0, 3).filter(n => top3.includes(n)).length;
        bericht.bottom3Hits = pv.order.slice(-3).filter(n => unten3.includes(n)).length;
        bericht.darkHorse = pv.darkHorse ? { name: pv.darkHorse, act: tabelle.indexOf(pv.darkHorse) + 1 } : null;
        // Folgen: die eigene Abweichung vom Expertentipp.
        const eigen = pv.own - myRank;
        bericht.ownDelta = eigen;
        if (eigen >= 3) {
            if (typeof changeMediaImage === 'function') changeMediaImage(3); else game.managerMediaImage = Math.min(100, (game.managerMediaImage ?? 50) + 3);
            game.fans = Math.min(100, game.fans + 2);
            bericht.effect = 'Experten widerlegt: Medienimage +3, Fans +2';
        } else if (eigen <= -4) {
            if (typeof changeMediaImage === 'function') changeMediaImage(-3); else game.managerMediaImage = Math.max(0, (game.managerMediaImage ?? 50) - 3);
            bericht.effect = 'Weit unter dem Expertentipp: Medienimage -3';
        }
    }
    if (!game.seasonReviews) game.seasonReviews = [];
    game.seasonReviews.unshift(bericht);
    if (game.seasonReviews.length > 10) game.seasonReviews.length = 10;
    return bericht;
}

function describeExpertCheck(r) {
    if (!r) return '';
    const zeilen = [];
    if (r.predOwn) {
        const d = r.predOwn - r.actualOwn;
        zeilen.push(`Dein Verein: getippt Platz ${r.predOwn}, geworden Platz ${r.actualOwn} ${d > 0 ? `<span style="color:var(--primary);">(+${d})</span>` : d < 0 ? `<span style="color:var(--danger);">(${d})</span>` : '(genau getroffen)'}`);
        if (r.surprise) zeilen.push(`😲 Überraschung: ${r.surprise.name} (getippt ${r.surprise.pred}., geworden ${r.surprise.act}.)`);
        if (r.flop) zeilen.push(`📉 Flop: ${r.flop.name} (getippt ${r.flop.pred}., geworden ${r.flop.act}.)`);
        zeilen.push(`🎯 Meistertipp ${r.champPred === r.champActual ? 'richtig' : `falsch (${r.champPred} statt ${r.champActual})`} · oben ${r.top3Hits}/3, unten ${r.bottom3Hits}/3 getroffen`);
        if (r.darkHorse) zeilen.push(`🐎 Geheimtipp ${r.darkHorse.name}: Platz ${r.darkHorse.act}`);
        if (r.effect) zeilen.push(`<strong>${r.effect}</strong>`);
    } else {
        zeilen.push(`Platz ${r.actualOwn} (für diese Saison lag keine Expertenprognose vor)`);
    }
    if (r.player) zeilen.push(`🏅 Spieler der Saison: <strong>${r.player.name}</strong>${r.player.grade ? ` (Ø-Note ${formatGrade(r.player.grade)})` : ''}, ${r.player.goals} Tore`);
    return zeilen.map(z => `<div>${z}</div>`).join('');
}

let seasonPreviewExpanded = false;
function toggleSeasonPreviewTable() {
    seasonPreviewExpanded = !seasonPreviewExpanded;
    renderSeasonPreviewCard();
}

// Dashboard: in den ersten 8 Spieltagen die Vorschau, mit aufklappbarer Expertentabelle.
function renderSeasonPreviewCard() {
    const box = document.getElementById('dash-season-preview-box');
    if (!box) return;
    if (game.matchday > 8) { box.innerHTML = ''; return; }
    const pv = getCurrentSeasonPreview();
    if (!pv) { box.innerHTML = ''; return; }
    const n = pv.order.length;
    const tabelle = seasonPreviewExpanded ? `<div style="margin-top:4px; columns:2; column-gap:10px;">${pv.order.map((name, i) =>
        `<div style="${name === game.clubName ? 'color:var(--primary); font-weight:800;' : ''}">${i + 1}. ${name}</div>`).join('')}</div>` : '';
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--blue);">📰 <strong>Saisonvorschau ${pv.season}:</strong> Die Experten sehen dich auf <strong>Platz ${pv.own} von ${n}</strong> - ${pv.verdict}.
        <div style="color:var(--text-muted); margin-top:2px;">Favoriten: ${pv.order.slice(0, 3).filter(x => x !== game.clubName).join(', ')} · Abstiegskandidaten: ${pv.order.slice(-3).filter(x => x !== game.clubName).join(', ')}${pv.darkHorse ? ` · Geheimtipp: ${pv.darkHorse}` : ''}</div>
        <div style="color:var(--text-muted); margin-top:2px;">Schlägst du den Tipp um 3 Plätze, gibt es Medienimage und Fans - 4 Plätze darunter kosten Ansehen.</div>
        ${tabelle}
        <button onclick="toggleSeasonPreviewTable()" class="btn-secondary" style="width:auto; font-size:9px; margin-top:4px;">${seasonPreviewExpanded ? 'Tabelle zuklappen' : '📋 Ganze Expertentabelle'}</button></div>`;
}

// Historie > Chronik: Prognose gegen Wirklichkeit über die letzten Saisons.
function renderSeasonForecastHistory() {
    const box = document.getElementById('season-forecast-history-box');
    if (!box) return;
    const liste = game.seasonReviews || [];
    if (!liste.length) { box.innerHTML = '<div style="font-size:10px; color:var(--text-muted);">Noch keine Saison abgeschlossen.</div>'; return; }
    box.innerHTML = liste.map(r => `<div class="box" style="font-size:10px;"><strong>Saison ${r.season} · ${r.league}</strong>${describeExpertCheck(r)}</div>`).join('');
}
