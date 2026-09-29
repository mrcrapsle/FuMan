// Schiedsrichter: jedes Ligaspiel hat einen namentlichen Unparteiischen. Seine Strenge
// (cardMult) wirkt auf die Kartenschwellen im Liveticker und auf die Sperren nach dem Spiel.
// Die Ansetzung ist pro Saison/Spieltag/Liga fest, damit sie vorab im Dashboard steht.

const REFEREES = [
    // minLeague/maxLeague: leagueLevel-Bereich (0 = 1. Liga), in dem er pfeift
    { id: 'hartung', name: 'Tobias Hartung', style: 'Kleinlich', cardMult: 1.4, minLeague: 0, maxLeague: 2 },
    { id: 'brenner', name: 'Felix Brenner', style: 'Souverän', cardMult: 0.9, minLeague: 0, maxLeague: 1 },
    { id: 'aydin', name: 'Deniz Aydın', style: 'Großzügig', cardMult: 0.7, minLeague: 0, maxLeague: 2 },
    { id: 'wendt', name: 'Marco Wendt', style: 'Konsequent', cardMult: 1.2, minLeague: 0, maxLeague: 3 },
    { id: 'lorenz', name: 'Sabine Lorenz', style: 'Souverän', cardMult: 1.0, minLeague: 0, maxLeague: 3 },
    { id: 'petrovic', name: 'Luka Petrović', style: 'Lässt laufen', cardMult: 0.75, minLeague: 1, maxLeague: 4 },
    { id: 'krause', name: 'Jens Krause', style: 'Kleinlich', cardMult: 1.35, minLeague: 2, maxLeague: 5 },
    { id: 'haas', name: 'Nina Haas', style: 'Konsequent', cardMult: 1.15, minLeague: 2, maxLeague: 5 },
    { id: 'schubert', name: 'Uwe Schubert', style: 'Großzügig', cardMult: 0.8, minLeague: 3, maxLeague: 5 },
    { id: 'demir', name: 'Kerem Demir', style: 'Souverän', cardMult: 1.0, minLeague: 3, maxLeague: 5 },
    { id: 'vogt', name: 'Heiko Vogt', style: 'Hektisch', cardMult: 1.3, minLeague: 4, maxLeague: 5 },
    { id: 'ernst', name: 'Paula Ernst', style: 'Lässt laufen', cardMult: 0.85, minLeague: 4, maxLeague: 5 }
];

function getRefereeFor(season, matchday, leagueLevel) {
    const pool = REFEREES.filter(r => leagueLevel >= r.minLeague && leagueLevel <= r.maxLeague);
    // Deterministische Streuung statt Math.random(): gleiche Ansetzung bei jedem Aufruf.
    const seed = (season * 131 + matchday * 17 + leagueLevel * 7 + (game.clubName || '').length) >>> 0;
    return pool[seed % pool.length];
}

function getCurrentReferee() {
    return getRefereeFor(game.season, game.matchday, game.leagueLevel);
}

function getRefereeCardMult() {
    return getCurrentReferee().cardMult;
}

function getRefereeRecord(refId) {
    if (!game.refereeHistory) game.refereeHistory = {};
    if (!game.refereeHistory[refId]) game.refereeHistory[refId] = { spiele: 0, siege: 0, remis: 0, niederlagen: 0, platzverweise: 0 };
    return game.refereeHistory[refId];
}

// Nach jedem eigenen Ligaspiel (Live und Schnellsimulation).
function recordRefereeMatch(matchResult, platzverweise) {
    if (!matchResult) return;
    const rec = getRefereeRecord(getCurrentReferee().id);
    rec.spiele++;
    if (matchResult === 'win') rec.siege++;
    else if (matchResult === 'draw') rec.remis++;
    else rec.niederlagen++;
    rec.platzverweise += platzverweise || 0;
}

function renderRefereePreview() {
    const box = document.getElementById('dash-referee-box');
    if (!box) return;
    if (game.matchday > 34) { box.innerHTML = ''; return; }
    const ref = getCurrentReferee();
    const rec = (game.refereeHistory || {})[ref.id] || { spiele: 0 };
    const strenge = ref.cardMult >= 1.25 ? '🟥 zückt schnell Karten' : ref.cardMult <= 0.8 ? '🟩 lässt viel laufen' : '🟨 durchschnittlich streng';
    const bilanz = rec.spiele ? `Bisherige Bilanz: ${rec.siege}S ${rec.remis}U ${rec.niederlagen}N` : 'Noch kein gemeinsames Spiel';
    box.innerHTML = `<div style="font-size:9px; color:var(--text-muted); margin:6px 0; padding:6px; background:rgba(255,255,255,0.03); border-radius:4px;">
        🧑‍⚖️ Schiedsrichter: <strong style="color:var(--text);">${ref.name}</strong> (${ref.style}) · ${strenge}<br>${bilanz}
        ${game.tackleHardness === 'hart' && ref.cardMult >= 1.2 ? '<br><span style="color:var(--accent);">⚠️ Harte Zweikampfführung gegen diesen Schiedsrichter ist riskant.</span>' : ''}
    </div>`;
}
