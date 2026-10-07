/* eslint-disable no-undef */
// Winterpausen-Gespräch mit dem Vorstand (Phase 22.9): nach der Hinrunde (Spieltag 18-20,
// Karte #dash-winter-talk-box) zieht der Vorstand Zwischenbilanz - Tabellenplatz gegen die
// Erwartung (game.seasonExpectation.expectedRank) und Kassenentwicklung. Einmal pro Saison
// wählst du EINEN Weg (game.winterTalk):
//   hoch     Ziel um 2 Plätze höher: Vorstand +5 und sofort Winterbudget; am Saisonende
//            erreicht: Vorstand +5, verfehlt: Vorstand -10
//   runter   Ziel um 2 Plätze tiefer: Vorstand -4 sofort, dafür misst der Verein (auch die
//            Mitgliederversammlung) die Saison am niedrigeren Ziel
//   budget   Winterbudget beantragen: Chance aus Zwischenbilanz und Vorstandslaune;
//            abgelehnt: Vorstand -3
//   kurs     Kurs bestätigen: Vorstand +2
// Wer bis nach Spieltag 20 nicht kommt, verpasst das Gespräch: Vorstand -2.

const WINTER_TALK_FIRST_MD = 18;
const WINTER_TALK_LAST_MD = 20;

// Je Liga (Bundesliga ... 6. Liga) - etwa ein Viertel des Start-Transferbudgets eines Aufsteigers.
const WINTER_BUDGET_BY_LEVEL = [2000000, 800000, 300000, 120000, 50000, 25000];

function getWinterBudgetAmount() {
    return WINTER_BUDGET_BY_LEVEL[game.leagueLevel] ?? WINTER_BUDGET_BY_LEVEL[WINTER_BUDGET_BY_LEVEL.length - 1];
}

function getWinterTalk() {
    return game.winterTalk && game.winterTalk.season === game.season ? game.winterTalk : null;
}

function getWinterReview() {
    const exp = typeof getSeasonExpectation === 'function' ? getSeasonExpectation() : (game.seasonExpectation || {});
    const rank = typeof getOwnLeagueRank === 'function' ? getOwnLeagueRank() : null;
    const geld = exp.startMoney !== undefined ? Math.round(game.money - exp.startMoney) : 0;
    return { rank, expected: exp.expectedRank || null, teams: exp.teams || (leaguesData[game.leagueLevel] || []).length, geld };
}

function getWinterBudgetChance() {
    const r = getWinterReview();
    const diff = r.rank && r.expected ? r.expected - r.rank : 0;
    return Math.max(0.1, Math.min(0.9, 0.3 + diff * 0.08 + (game.boardSat - 50) / 200));
}

function isWinterTalkOpen() {
    return game.matchday >= WINTER_TALK_FIRST_MD && game.matchday <= WINTER_TALK_LAST_MD && !getWinterTalk();
}

function chooseWinterTalk(art) {
    if (!isWinterTalkOpen()) { showToast(getWinterTalk() ? 'Das Wintergespräch hat schon stattgefunden.' : `Das Wintergespräch gibt es an den Spieltagen ${WINTER_TALK_FIRST_MD}-${WINTER_TALK_LAST_MD}.`, 'error'); return; }
    const r = getWinterReview();
    const exp = typeof getSeasonExpectation === 'function' ? getSeasonExpectation() : game.seasonExpectation;
    const talk = { season: game.season, choice: art, oldGoal: r.expected, goal: r.expected, rankAtTalk: r.rank, result: null };
    let text;
    if (art === 'hoch') {
        if (!r.expected || r.expected <= 1) { showToast('Höher als Platz 1 geht es nicht.', 'error'); return; }
        talk.goal = Math.max(1, r.expected - 2);
        exp.expectedRank = talk.goal;
        const betrag = getWinterBudgetAmount();
        game.transferBudget += betrag;
        game.boardSat = Math.min(100, game.boardSat + 5);
        talk.budget = betrag;
        text = `Neues Ziel Platz ${talk.goal}. Der Vorstand ist begeistert (+5) und gibt ${formatVal(betrag)} Winterbudget frei - verfehlst du es, kostet das 10 Punkte.`;
    } else if (art === 'runter') {
        if (!r.expected || r.expected >= r.teams) { showToast('Tiefer lässt sich das Ziel nicht setzen.', 'error'); return; }
        talk.goal = Math.min(r.teams, r.expected + 2);
        exp.expectedRank = talk.goal;
        game.boardSat = Math.max(10, game.boardSat - 4);
        text = `Neues Ziel Platz ${talk.goal}. Der Vorstand ist enttäuscht (-4), misst die Saison aber daran.`;
    } else if (art === 'budget') {
        if (Math.random() < getWinterBudgetChance()) {
            const betrag = getWinterBudgetAmount();
            game.transferBudget += betrag;
            talk.budget = betrag;
            text = `Der Vorstand bewilligt ${formatVal(betrag)} Winterbudget.`;
        } else {
            game.boardSat = Math.max(10, game.boardSat - 3);
            talk.budget = 0;
            text = 'Abgelehnt - erst die Leistung, dann das Geld (Vorstand -3).';
        }
    } else if (art === 'kurs') {
        game.boardSat = Math.min(100, game.boardSat + 2);
        text = 'Ihr bleibt beim Kurs - der Vorstand schätzt die Ruhe (+2).';
    } else return;
    game.winterTalk = talk;
    playSound('click');
    showToast(`🏛️ ${text}`, art === 'budget' && !talk.budget ? 'error' : 'success', 5500);
    updateUI();
    renderWinterTalkCard();
}

// Jeden Spieltag (processPostMatchRoutine, nach game.matchday++): verpasstes Gespräch.
function tickWinterTalk() {
    if (game.matchday > WINTER_TALK_LAST_MD && game.matchday <= 34 && !getWinterTalk()) {
        game.winterTalk = { season: game.season, choice: 'verpasst', result: null };
        game.boardSat = Math.max(10, game.boardSat - 2);
        addInboxMessage('vertrag', '🏛️ Wintergespräch verpasst', 'Der Vorstand hat in der Winterpause vergeblich auf dich gewartet (-2).', 'screen-dashboard');
    }
}

// Saisonende (concludeSeasonAndAdvance, vor prepareMemberAssembly): Versprechen einlösen.
function resolveWinterTalk(finalRank) {
    const t = getWinterTalk();
    if (!t || t.choice !== 'hoch' || t.result) return;
    if (finalRank <= t.goal) {
        t.result = 'erreicht';
        game.boardSat = Math.min(100, game.boardSat + 5);
        addInboxMessage('vertrag', '🏛️ Winterversprechen gehalten', `Platz ${finalRank} - das im Winter erhöhte Ziel (Platz ${t.goal}) ist erreicht. Vorstand +5.`, 'screen-dashboard');
    } else {
        t.result = 'verfehlt';
        game.boardSat = Math.max(10, game.boardSat - 10);
        addInboxMessage('vertrag', '🏛️ Winterversprechen gebrochen', `Platz ${finalRank} statt des im Winter versprochenen Platzes ${t.goal}. Vorstand -10.`, 'screen-dashboard');
    }
}

function renderWinterTalkCard() {
    const box = document.getElementById('dash-winter-talk-box');
    if (!box) return;
    const t = getWinterTalk();
    if (t && t.choice !== 'verpasst' && game.matchday <= WINTER_TALK_LAST_MD + 2) {
        const was = { hoch: `Ziel erhöht auf Platz ${t.goal}`, runter: `Ziel gesenkt auf Platz ${t.goal}`, budget: t.budget ? `Winterbudget ${formatVal(t.budget)} bewilligt` : 'Winterbudget abgelehnt', kurs: 'Kurs bestätigt' }[t.choice];
        box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--gold);">🏛️ Wintergespräch: ${was}.</div>`;
        return;
    }
    if (!isWinterTalkOpen()) { box.innerHTML = ''; return; }
    const r = getWinterReview();
    const diff = r.rank && r.expected ? r.expected - r.rank : 0;
    const urteil = diff >= 2 ? 'über den Erwartungen' : diff <= -2 ? 'unter den Erwartungen' : 'im Soll';
    const chance = Math.round(getWinterBudgetChance() * 100);
    const betrag = getWinterBudgetAmount();
    const hochGeht = !!r.expected && r.expected > 1;
    const runterGeht = !!r.expected && r.expected < r.teams;
    box.innerHTML = `<div class="panel" style="border:1px solid var(--gold);"><div class="panel-header" style="color:var(--gold);">🏛️ WINTERPAUSE: GESPRÄCH MIT DEM VORSTAND</div>
        <div class="box" style="font-size:10px;">Zwischenbilanz: Platz <strong>${r.rank || '-'}</strong>, erwartet Platz ${r.expected || '-'} - ${urteil}. Kasse seit Saisonbeginn ${r.geld >= 0 ? '+' : ''}${formatVal(r.geld)}. Nur bis Spieltag ${WINTER_TALK_LAST_MD}, ein Weg pro Saison.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <button onclick="chooseWinterTalk('hoch')" class="${hochGeht ? 'btn-action' : 'btn-secondary'}" style="font-size:10px;">${hochGeht ? `🎯 Ziel hoch (Platz ${Math.max(1, r.expected - 2)}): +5, ${formatVal(betrag)} sofort - verfehlt -10` : '🎯 Platz 1 ist schon das Ziel - höher geht es nicht'}</button>
            <button onclick="chooseWinterTalk('runter')" class="btn-secondary" style="font-size:10px;">${runterGeht ? `🛡️ Ziel runter (Platz ${Math.min(r.teams, r.expected + 2)}): -4, die Saison zählt am leichteren Ziel` : '🛡️ Tiefer geht das Ziel nicht'}</button>
            <button onclick="chooseWinterTalk('budget')" class="btn-secondary" style="font-size:10px;">💶 Winterbudget ${formatVal(betrag)} beantragen (${chance} %, sonst -3)</button>
            <button onclick="chooseWinterTalk('kurs')" class="btn-secondary" style="font-size:10px;">🤝 Kurs bestätigen: Vorstand +2</button>
        </div></div>`;
}
