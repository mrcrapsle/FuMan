/* eslint-disable no-undef */
// Gegner-Taktik reagiert: Spielstile treten als Schere-Stein-Papier gegeneinander an -
// Pressing schlägt Ballbesitz, Ballbesitz knackt tiefe Konter-Blöcke, Konter bestrafen hohes
// Pressing (±2 Stärke im Ligaspiel). KI-Trainer lesen deine letzten Ligaspiele
// (game.recentTacticStyles): wer berechenbar ist (3 von 5 Spielen derselbe Ansatz), gegen den
// stellen sie sich mit einer gewissen Wahrscheinlichkeit gezielt ein. Der Plan steht vor dem
// Anpfiff fest (game.oppTacticPlan); der Chef-Analyst verrät ihn im Vorbericht. Im Livespiel
// zählt die aktuell gewählte Taktik - ein Umstellen während des Spiels kann kontern.

const OWN_STYLE_ARCHETYPE = { pressing: 'P', offensiv: 'P', umschaltspiel: 'P', ballbesitz: 'B', konter: 'K', defensiv: 'K', kickrush: 'N', ausgeglichen: 'N' };
const AI_STYLE_ARCHETYPE = { offensiv: 'P', defensiv: 'K', konter: 'K', ausgeglichen: 'B' };
const ARCHETYPE_BEATS = { P: 'B', B: 'K', K: 'P' };
const ARCHETYPE_LABELS = { P: 'Pressing', B: 'Ballbesitz', K: 'Konter', N: 'neutral' };
const TACTIC_MATCHUP_BONUS = 2;

function getCounterArchetype(arch) {
    return Object.keys(ARCHETYPE_BEATS).find(k => ARCHETYPE_BEATS[k] === arch) || null;
}

// Effekt eines eigenen Spielstils gegen den geplanten Ansatz des Gegners.
function getTacticMatchupBonus(oppArch, style = game.tacticStyle) {
    const unser = OWN_STYLE_ARCHETYPE[style] || 'N';
    if (!oppArch || unser === 'N' || oppArch === 'N') return 0;
    if (ARCHETYPE_BEATS[unser] === oppArch) return TACTIC_MATCHUP_BONUS;
    if (ARCHETYPE_BEATS[oppArch] === unser) return -TACTIC_MATCHUP_BONUS;
    return 0;
}

// Wie berechenbar bist du? Der Ansatz aus mindestens 3 der letzten 5 Ligaspiele.
function getPredictableArchetype() {
    const letzte = (game.recentTacticStyles || []).slice(-5).map(s => OWN_STYLE_ARCHETYPE[s] || 'N').filter(a => a !== 'N');
    const zaehl = {};
    letzte.forEach(a => { zaehl[a] = (zaehl[a] || 0) + 1; });
    const top = Object.entries(zaehl).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 3 ? top[0] : null;
}

// Plan des Gegners für das eigene Ligaspiel dieses Spieltags - einmal festgelegt.
function getOppTacticPlan(oppTeam) {
    if (!oppTeam) return null;
    const p = game.oppTacticPlan;
    if (p && p.season === game.season && p.matchday === game.matchday && p.opp === oppTeam.name) return p;
    const basis = AI_STYLE_ARCHETYPE[oppTeam.playstyle] || 'N';
    let arch = basis, reacted = false;
    const lesbar = getPredictableArchetype();
    if (lesbar) {
        // Gute Teams (obere Tabellenhälfte) haben die besseren Analysten.
        const tabelle = typeof sortedTable === 'function' ? sortedTable(game.leagueLevel) : [];
        const platz = tabelle.indexOf(oppTeam);
        const chance = 0.35 + (platz >= 0 && platz < tabelle.length / 2 ? 0.25 : 0);
        const konter = getCounterArchetype(lesbar);
        if (konter && konter !== basis && Math.random() < chance) { arch = konter; reacted = true; }
    }
    game.oppTacticPlan = { season: game.season, matchday: game.matchday, opp: oppTeam.name, arch, base: basis, reacted, readAs: lesbar };
    return game.oppTacticPlan;
}

// Eigene Stärke in einem Ligaspiel inklusive Taktik-Duell (Simulation, Vorhersage).
function getOwnLeagueMatchStrength(isHome, oppTeam) {
    const plan = getOppTacticPlan(oppTeam);
    return calcTeamStrength(isHome) + getTacticMatchupBonus(plan ? plan.arch : null);
}

// Aus processPostMatchRoutine() nach jedem eigenen Ligaspiel.
function recordOwnTacticStyle() {
    if (!game.recentTacticStyles) game.recentTacticStyles = [];
    game.recentTacticStyles.push(game.tacticStyle || 'ausgeglichen');
    if (game.recentTacticStyles.length > 6) game.recentTacticStyles.shift();
}

function describeMatchup(oppArch) {
    const b = getTacticMatchupBonus(oppArch);
    const unser = ARCHETYPE_LABELS[OWN_STYLE_ARCHETYPE[game.tacticStyle] || 'N'];
    if (b > 0) return `<span style="color:var(--primary);">Dein ${unser} passt: +${b} Stärke</span>`;
    if (b < 0) return `<span style="color:var(--danger);">Dein ${unser} läuft ins offene Messer: ${b} Stärke</span>`;
    return `<span style="color:var(--text-muted);">Dein Ansatz (${unser}) ist hier neutral</span>`;
}

// Vorbericht: ohne Chef-Analyst nur die öffentliche Grundausrichtung.
function renderOppTacticBox(oppTeam) {
    const box = document.getElementById('prematch-tactic-box');
    if (!box) return;
    const plan = getOppTacticPlan(oppTeam);
    if (!plan) { box.innerHTML = ''; return; }
    const lesbar = getPredictableArchetype();
    const warnung = lesbar ? `<div style="color:var(--accent);">⚠️ Du bist berechenbar: zuletzt meist ${ARCHETYPE_LABELS[lesbar]}. Gute Gegner stellen sich darauf ein.</div>` : '';
    const regel = '<div style="color:var(--text-muted); font-size:8px; margin-top:3px;">Pressing schlägt Ballbesitz · Ballbesitz schlägt Konter · Konter schlägt Pressing (±2 Stärke)</div>';
    if (!staffMembers.analyst.hired && !(typeof underworld !== 'undefined' && underworld.spyIntelActive)) {
        box.innerHTML = `<div class="box" style="font-size:10px;">🧠 <strong>Taktik-Duell:</strong> Laut Presse spielt ${plan.opp} meist <strong>${ARCHETYPE_LABELS[plan.base]}</strong> - ob sich der Trainer auf dich einstellt, weiß nur ein Chef-Analyst.${warnung}${regel}</div>`;
        return;
    }
    box.innerHTML = `<div class="box" style="font-size:10px;">🧠 <strong>Taktik-Duell (Analyst):</strong> ${plan.opp} plant <strong>${ARCHETYPE_LABELS[plan.arch]}</strong>${plan.reacted ? ` - <span style="color:var(--danger);">der Trainer reagiert auf dein ${ARCHETYPE_LABELS[plan.readAs]}!</span>` : ''}<br>${describeMatchup(plan.arch)}${warnung}${regel}</div>`;
}
