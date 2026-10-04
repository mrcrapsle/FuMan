/* eslint-disable no-undef */
// Gegnervorbereitung (Phase 22.2): der Trainingsschwerpunkt "Match-Prep" war eine Scheinwahl
// (pauschal +1, "Taktik" brachte +2). Jetzt bereitet sich die Mannschaft gezielt auf den
// Spielstil des NÄCHSTEN Ligagegners vor (game.matchPrep = { arch, season, matchday }):
//   richtig getippt (Plan des Gegners, getOppTacticPlan) -> +2,5 Stärke
//   falsch oder nichts gewählt                            -> 0 (und die +2 von Taktik fehlen)
// Ohne Chef-Analyst ist nur der öffentliche Grundstil bekannt - reagiert der Gegner auf dich,
// liegt die Vorbereitung daneben. Nur Ligaspiele (der Pokal hat keinen Taktik-Plan).
// Wirkt in getOwnLeagueMatchStrength() (Simulation, Prognose) und im Livespiel über
// applyMatchPrepLive() in setupMatch().

const MATCH_PREP_BONUS = 2.5;

function getNextLeagueOpponentTeam() {
    const liga = leaguesData[game.leagueLevel] || [];
    const tag = (fixturesData[game.leagueLevel] || [])[game.matchday - 1] || [];
    const f = tag.find(x => liga[x.home]?.name === game.clubName || liga[x.away]?.name === game.clubName);
    if (!f) return null;
    return liga[liga[f.home].name === game.clubName ? f.away : f.home] || null;
}

function getActiveMatchPrep() {
    const m = game.matchPrep;
    return game.teamTraining === 'matchprep' && m && m.season === game.season && m.matchday === game.matchday ? m : null;
}

function getMatchPrepBonus(oppTeam) {
    if (game.teamTraining !== 'matchprep' || !oppTeam || typeof getOppTacticPlan !== 'function') return 0;
    const m = getActiveMatchPrep();
    if (!m) return 0;
    const plan = getOppTacticPlan(oppTeam);
    return plan && plan.arch === m.arch ? MATCH_PREP_BONUS : 0;
}

function setMatchPrepTarget(arch) {
    if (!['P', 'B', 'K'].includes(arch)) return;
    const opp = getNextLeagueOpponentTeam();
    if (!opp) { showToast('Am nächsten Spieltag hast du kein Ligaspiel - Match-Prep greift nur in der Liga.', 'error'); return; }
    game.matchPrep = { arch, season: game.season, matchday: game.matchday, opp: opp.name };
    if (game.teamTraining !== 'matchprep') {
        game.teamTraining = 'matchprep';
        if (typeof setTeamTraining === 'function') setTeamTraining('matchprep');
    }
    showToast(`🎯 Vorbereitung auf ${ARCHETYPE_LABELS[arch]} von ${opp.name}: liegst du richtig, +2,5 Stärke.`, 'success', 3500);
    renderMatchPrepBox();
}

// Personal-Automatik "Auf Spieltag fokussieren": stellt sich auf den öffentlichen Grundstil ein.
function autoSetMatchPrepTarget() {
    const opp = getNextLeagueOpponentTeam();
    if (!opp) return;
    const arch = AI_STYLE_ARCHETYPE[opp.playstyle] || 'B';
    game.matchPrep = { arch, season: game.season, matchday: game.matchday, opp: opp.name };
}

// Livespiel (setupMatch, nur Liga).
function applyMatchPrepLive(oppTeam) {
    if (!currentMatch || currentMatch.isCup || game.teamTraining !== 'matchprep') return;
    const m = getActiveMatchPrep();
    const bonus = getMatchPrepBonus(oppTeam);
    if (bonus) {
        currentMatch.ourBaseStr += bonus;
        if (currentMatch.isHome) currentMatch.homeStr += bonus; else currentMatch.awayStr += bonus;
    }
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += bonus
        ? `<div style="color:var(--primary);">🎯 Match-Prep passt: der Gegner spielt wie erwartet ${ARCHETYPE_LABELS[m.arch]} (+2,5 Stärke).</div>`
        : `<div style="color:var(--danger);">🎯 Match-Prep ${m ? 'daneben: der Gegner spielt anders als erwartet' : 'ohne Ziel: kein Gegner analysiert'} (kein Bonus).</div>`;
}

function renderMatchPrepBox() {
    const box = document.getElementById('matchprep-target-box');
    if (!box) return;
    const opp = getNextLeagueOpponentTeam();
    if (!opp) { box.innerHTML = '<div class="box" style="font-size:10px;">🎯 Match-Prep: am nächsten Spieltag kein Ligaspiel - dafür lohnt sich ein anderer Schwerpunkt.</div>'; return; }
    const basis = AI_STYLE_ARCHETYPE[opp.playstyle] || 'B';
    const analyst = staffMembers.analyst && staffMembers.analyst.hired;
    const plan = analyst && typeof getOppTacticPlan === 'function' ? getOppTacticPlan(opp) : null;
    const m = getActiveMatchPrep() || (game.matchPrep && game.matchPrep.season === game.season && game.matchPrep.matchday === game.matchday ? game.matchPrep : null);
    const info = plan ? `Chef-Analyst: ${opp.name} plant <strong>${ARCHETYPE_LABELS[plan.arch]}</strong>.` : `Laut Presse spielt ${opp.name} meist <strong>${ARCHETYPE_LABELS[basis]}</strong> - ob der Trainer auf dich reagiert, weiß nur ein Chef-Analyst.`;
    const knopf = arch => `<button onclick="setMatchPrepTarget('${arch}')" class="${m && m.arch === arch ? 'btn-action' : 'btn-secondary'}" style="font-size:10px;">${m && m.arch === arch ? '✔ ' : ''}${ARCHETYPE_LABELS[arch]}</button>`;
    const aktiv = game.teamTraining === 'matchprep';
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--accent);">🎯 <strong>Gegnervorbereitung</strong> (Schwerpunkt Match-Prep${aktiv ? '' : ' - derzeit nicht aktiv'}): nächster Ligagegner ${opp.name}. ${info}
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; margin-top:4px;">${knopf('P')}${knopf('B')}${knopf('K')}</div>
        <div style="color:var(--text-muted); margin-top:3px;">Richtig getippt: +2,5 Stärke · daneben oder ohne Ziel: 0 (Taktik-Schwerpunkt bringt sicher +2). Nur Ligaspiele.</div></div>`;
}
