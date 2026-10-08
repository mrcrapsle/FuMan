// Spielprognose des Chef-Analysten für das nächste Ligaspiel: simuliert die Partie mehrfach
// mit derselben Tor-Formel wie die Spieltagssimulation (simulateGoals) - aus den echten
// Paarungen (fixturesData), Stärken und Spielstilen. Erscheint in der Spielanalyse vor dem
// Anpfiff (renderPreMatchAnalysis) und als Zeile im Dashboard. Löst drei Module ab, die
// einen erfundenen Spielplan nutzten bzw. nie einen Gegner fanden.

const SCOUT_SIMULATIONS = 400;

function getNextLeagueMatch() {
    if (game.matchday > 34) return null;
    const teams = leaguesData[game.leagueLevel] || [];
    const round = (fixturesData[game.leagueLevel] || [])[game.matchday - 1] || [];
    const f = round.find(x => teams[x.home]?.name === game.clubName || teams[x.away]?.name === game.clubName);
    if (!f) return null;
    const isHome = teams[f.home].name === game.clubName;
    return { isHome, opp: teams[isHome ? f.away : f.home], ownTeam: teams[isHome ? f.home : f.away] };
}

// Wahrscheinlichkeiten aus wiederholter Simulation mit der Spieltags-Formel.
function predictNextMatch() {
    const m = getNextLeagueMatch();
    if (!m) return null;
    const ownStr = typeof getOwnLeagueMatchStrength === 'function' ? getOwnLeagueMatchStrength(m.isHome, m.opp) : calcTeamStrength(m.isHome);
    const oppStr = typeof getOpponentMatchStrength === 'function' ? getOpponentMatchStrength(m.opp.strength, !m.isHome) : m.opp.strength;
    const hStr = m.isHome ? ownStr : oppStr, aStr = m.isHome ? oppStr : ownStr;
    const hTeam = m.isHome ? m.ownTeam : m.opp, aTeam = m.isHome ? m.opp : m.ownTeam;
    let sieg = 0, remis = 0, tore = 0, gegentore = 0;
    for (let i = 0; i < SCOUT_SIMULATIONS; i++) {
        const g = simulateGoals(hStr, aStr, hTeam, aTeam);
        const own = m.isHome ? g.myGoals : g.oppGoals, opp = m.isHome ? g.oppGoals : g.myGoals;
        if (own > opp) sieg++; else if (own === opp) remis++;
        tore += own; gegentore += opp;
    }
    return {
        ...m, ownStr, oppStr,
        sieg: sieg / SCOUT_SIMULATIONS, remis: remis / SCOUT_SIMULATIONS, niederlage: 1 - (sieg + remis) / SCOUT_SIMULATIONS,
        xTore: tore / SCOUT_SIMULATIONS, xGegentore: gegentore / SCOUT_SIMULATIONS
    };
}

function hasMatchAnalyst() {
    return !!(staffMembers.analyst && staffMembers.analyst.hired) || !!(underworld && underworld.spyIntelActive);
}

// oppName: Gegner der angezeigten Spielanalyse - bei Pokalspielen passt die Liga-Prognose nicht.
function getPredictionHtml(oppName) {
    const p = predictNextMatch();
    if (!p || (oppName && p.opp.name !== oppName)) return '';
    const pct = x => Math.round(x * 100) + '%';
    return `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.15); font-size:10px;">
        🔮 <strong style="color:var(--teal);">Prognose des Analysten</strong> (${SCOUT_SIMULATIONS} simulierte Spiele)
        <div style="display:flex; height:14px; border-radius:3px; overflow:hidden; font-size:8px; font-weight:bold; color:#fff; text-align:center; line-height:14px; margin:4px 0;">
            <div style="width:${pct(p.sieg)}; background:var(--primary);">${p.sieg >= 0.12 ? pct(p.sieg) : ''}</div>
            <div style="width:${pct(p.remis)}; background:#8a8f98;">${p.remis >= 0.12 ? pct(p.remis) : ''}</div>
            <div style="width:${pct(p.niederlage)}; background:var(--danger);">${p.niederlage >= 0.12 ? pct(p.niederlage) : ''}</div>
        </div>
        Sieg ${pct(p.sieg)} · Remis ${pct(p.remis)} · Niederlage ${pct(p.niederlage)} · erwartet ${p.xTore.toFixed(1)}:${p.xGegentore.toFixed(1)}
        ${p.opp && game.headToHeadRecords && game.headToHeadRecords[p.opp.name] ? `<br>Bisherige Bilanz: ${game.headToHeadRecords[p.opp.name].wins}S ${game.headToHeadRecords[p.opp.name].draws}U ${game.headToHeadRecords[p.opp.name].losses}N` : ''}
    </div>`;
}

// Kompakte Zeile fürs Dashboard (unter "Nächste Begegnung").
function renderMatchScoutLine() {
    const box = document.getElementById('dash-prediction-box');
    if (!box) return;
    const p = hasMatchAnalyst() ? predictNextMatch() : null;
    if (!p) { box.innerHTML = hasMatchAnalyst() ? '' : '<div style="font-size:9px; color:var(--text-muted); margin-bottom:4px;">🔮 Spielprognosen liefert ein Chef-Analyst (Personal).</div>'; return; }
    box.innerHTML = `<div style="font-size:9px; color:var(--text-muted); margin-bottom:4px;">🔮 Prognose: <span style="color:var(--primary);">Sieg ${Math.round(p.sieg * 100)}%</span> · Remis ${Math.round(p.remis * 100)}% · <span style="color:var(--danger);">Niederlage ${Math.round(p.niederlage * 100)}%</span></div>`;
}

// Alte Spielstände: Daten der abgelösten Analyse-Module entfernen.
function cleanupLegacyScoutState() {
    ['upcomingOpponents', 'oppositionAnalysis', 'opponentAnalysis', 'matchPredictions', 'matchPrediction'].forEach(k => { delete game[k]; });
}
