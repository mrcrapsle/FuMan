/* eslint-disable no-undef */
// Transferstrategie mit dem Vorstand (Phase 25.18): zu Saisonbeginn (Spieltag 1-3, Karte
// #dash-transfer-strategy-box) legst du einmal pro Saison eine Linie fest (game.transferStrategy).
// Sie verschiebt das Transferbudget und das Saisonziel (game.seasonExpectation.expectedRank,
// daran messen auch Mitgliederversammlung und Vorstand) - am Saisonende rechnet der Vorstand ab
// (resolveTransferStrategy(myRank) vor prepareMemberAssembly()):
//   jugend      -30 % Transferbudget, Ziel 1 Platz leichter, Sichtung halb so teuer;
//               mind. 3 Eigengewächse mit 10+ Ligaspielen: Vorstand +6, Fans +3, sonst -6
//   sofort      +40 % Transferbudget, Ziel 2 Plätze höher; erreicht +5, verfehlt -8
//   sparen      -50 % Transferbudget, Ziel 2 Plätze leichter; Saison ohne Verlust +5, sonst -6
//   ausgewogen  keine Änderung (auch, wer bis Spieltag 3 nichts wählt)
// Prozente beziehen sich auf das Liga-Transferbudget (getLeagueTransferBudget), nicht auf
// Überschüsse aus der Kasse.

const TRANSFER_STRATEGY_LAST_MD = 3;
const TRANSFER_STRATEGIES = {
    jugend: { label: '🌱 Jugend fördern', budget: -0.3, goalShift: 1 },
    sofort: { label: '🚀 Sofort-Erfolg', budget: 0.4, goalShift: -2 },
    sparen: { label: '💰 Sparen', budget: -0.5, goalShift: 2 },
    ausgewogen: { label: '⚖️ Ausgewogen', budget: 0, goalShift: 0 }
};
const STRATEGY_YOUTH_PLAYERS = 3; // 25.19: mit 2 erreichte der Bundesliga-Bot das Ziel in 12 von 18 Saisons
const STRATEGY_YOUTH_GAMES = 10;

function getTransferStrategy() {
    return game.transferStrategy && game.transferStrategy.season === game.season ? game.transferStrategy : null;
}

function isTransferStrategyActive(choice) {
    const s = getTransferStrategy();
    return !!s && s.choice === choice;
}

function isTransferStrategyOpen() {
    return game.matchday <= TRANSFER_STRATEGY_LAST_MD && !getTransferStrategy();
}

function getStrategyBudgetDelta(choice) {
    return Math.round(getLeagueTransferBudget(game.leagueLevel) * TRANSFER_STRATEGIES[choice].budget / 1000) * 1000;
}

function countStrategyYouthPlayers() {
    return squad.filter(p => p.academyGraduate && ((p.statsSeason && p.statsSeason.spiele) || 0) >= STRATEGY_YOUTH_GAMES).length;
}

function chooseTransferStrategy(choice) {
    const cfg = TRANSFER_STRATEGIES[choice];
    if (!cfg) return;
    if (!isTransferStrategyOpen()) { showToast(getTransferStrategy() ? 'Die Transferstrategie für diese Saison steht schon.' : `Die Transferstrategie wird bis Spieltag ${TRANSFER_STRATEGY_LAST_MD} festgelegt.`, 'error'); return; }
    const exp = typeof getSeasonExpectation === 'function' ? getSeasonExpectation() : game.seasonExpectation;
    const teams = (leaguesData[game.leagueLevel] || []).length || 18;
    const alt = exp && exp.expectedRank ? exp.expectedRank : null;
    const ziel = alt ? Math.max(1, Math.min(teams, alt + cfg.goalShift)) : null;
    if (choice === 'sofort' && alt === 1) { showToast('Platz 1 ist schon das Ziel - Sofort-Erfolg geht nicht höher.', 'error'); return; }
    const delta = getStrategyBudgetDelta(choice);
    const vorher = game.transferBudget;
    game.transferBudget = Math.max(0, game.transferBudget + delta);
    if (ziel && exp) exp.expectedRank = ziel;
    game.transferStrategy = { season: game.season, choice, oldGoal: alt, goal: ziel, budgetDelta: game.transferBudget - vorher, result: null };
    playSound('click');
    const budgetText = delta ? ` Transferbudget ${delta > 0 ? '+' : ''}${formatVal(game.transferBudget - vorher)}.` : '';
    const zielText = ziel && ziel !== alt ? ` Saisonziel jetzt Platz ${ziel}.` : '';
    showToast(`🏛️ ${cfg.label}:${budgetText}${zielText}`, 'success', 5000);
    renderTransferStrategyCard();
    updateUI();
}

// Jeden Spieltag (nach game.matchday++): wer nichts gewählt hat, bleibt ausgewogen.
function tickTransferStrategy() {
    if (game.matchday > TRANSFER_STRATEGY_LAST_MD && game.matchday <= 34 && !getTransferStrategy()) {
        game.transferStrategy = { season: game.season, choice: 'ausgewogen', goal: null, budgetDelta: 0, result: null, auto: true };
    }
}

// Saisonende (concludeSeasonAndAdvance, vor prepareMemberAssembly und dem Zurücksetzen der
// Saisonstatistik / der FFP-Saisonbilanz).
function resolveTransferStrategy(finalRank) {
    const s = getTransferStrategy();
    if (!s || s.result || s.choice === 'ausgewogen') return;
    let ok, text;
    if (s.choice === 'jugend') {
        const n = countStrategyYouthPlayers();
        ok = n >= STRATEGY_YOUTH_PLAYERS;
        text = `${n} Eigengewächs(e) mit ${STRATEGY_YOUTH_GAMES}+ Ligaspielen (Ziel ${STRATEGY_YOUTH_PLAYERS}).`;
        game.boardSat = ok ? Math.min(100, game.boardSat + 6) : Math.max(10, game.boardSat - 6);
        if (ok) game.fans = Math.min(100, game.fans + 3);
        text += ok ? ' Vorstand +6, Fans +3.' : ' Vorstand -6.';
    } else if (s.choice === 'sofort') {
        ok = !s.goal || finalRank <= s.goal;
        text = `Platz ${finalRank}, versprochen war Platz ${s.goal}.`;
        game.boardSat = ok ? Math.min(100, game.boardSat + 5) : Math.max(10, game.boardSat - 8);
        text += ok ? ' Vorstand +5.' : ' Vorstand -8.';
    } else if (s.choice === 'sparen') {
        const net = Math.round(game.ffpSeasonNet || 0);
        ok = net >= 0;
        text = `Saisonbilanz ${net >= 0 ? '+' : ''}${formatVal(net)}.`;
        game.boardSat = ok ? Math.min(100, game.boardSat + 5) : Math.max(10, game.boardSat - 6);
        text += ok ? ' Vorstand +5.' : ' Vorstand -6.';
    } else return;
    s.result = ok ? 'erreicht' : 'verfehlt';
    addInboxMessage('vertrag', `🏛️ Transferstrategie ${ok ? 'erfüllt' : 'verfehlt'}: ${TRANSFER_STRATEGIES[s.choice].label}`, text, 'screen-dashboard');
}

function renderTransferStrategyCard() {
    const box = document.getElementById('dash-transfer-strategy-box');
    if (!box) return;
    const s = getTransferStrategy();
    if (s && !s.auto) {
        const cfg = TRANSFER_STRATEGIES[s.choice];
        let stand = '';
        if (s.choice === 'jugend') stand = ` Stand: ${countStrategyYouthPlayers()} von ${STRATEGY_YOUTH_PLAYERS} Eigengewächsen mit ${STRATEGY_YOUTH_GAMES}+ Ligaspielen.`;
        else if (s.choice === 'sofort' && s.goal) stand = ` Ziel: Platz ${s.goal}.`;
        else if (s.choice === 'sparen') stand = ` Ziel: Saison ohne Verlust (bisher ${(game.ffpSeasonNet || 0) >= 0 ? '+' : ''}${formatVal(Math.round(game.ffpSeasonNet || 0))}).`;
        box.innerHTML = game.matchday <= 34 ? `<div class="box" style="font-size:10px; border-left-color:var(--gold);">🏛️ Transferstrategie: ${cfg.label}.${stand}</div>` : '';
        return;
    }
    if (!isTransferStrategyOpen()) { box.innerHTML = ''; return; }
    const exp = typeof getSeasonExpectation === 'function' ? getSeasonExpectation() : game.seasonExpectation;
    const ziel = exp && exp.expectedRank;
    const teams = (leaguesData[game.leagueLevel] || []).length || 18;
    const z = shift => ziel ? `Platz ${Math.max(1, Math.min(teams, ziel + shift))}` : 'Ziel unverändert';
    const b = choice => formatVal(Math.abs(getStrategyBudgetDelta(choice)));
    box.innerHTML = `<div class="panel" style="border:1px solid var(--gold);"><div class="panel-header" style="color:var(--gold);">🏛️ TRANSFERSTRATEGIE MIT DEM VORSTAND</div>
        <div class="box" style="font-size:10px;">Bis Spieltag ${TRANSFER_STRATEGY_LAST_MD}, eine Linie pro Saison. Saisonziel bisher: ${ziel ? 'Platz ' + ziel : '-'}. Abrechnung am Saisonende.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <button onclick="chooseTransferStrategy('jugend')" class="btn-secondary" style="font-size:10px;">🌱 Jugend fördern: -${b('jugend')} Budget, ${z(1)}, Sichtung halber Preis - ${STRATEGY_YOUTH_PLAYERS} Eigengewächse mit ${STRATEGY_YOUTH_GAMES}+ Spielen: +6, sonst -6</button>
            <button onclick="chooseTransferStrategy('sofort')" class="btn-action" style="font-size:10px;">🚀 Sofort-Erfolg: +${b('sofort')} Budget, ${z(-2)} - erreicht +5, verfehlt -8</button>
            <button onclick="chooseTransferStrategy('sparen')" class="btn-secondary" style="font-size:10px;">💰 Sparen: -${b('sparen')} Budget, ${z(2)} - Saison ohne Verlust +5, sonst -6</button>
            <button onclick="chooseTransferStrategy('ausgewogen')" class="btn-secondary" style="font-size:10px;">⚖️ Ausgewogen: alles bleibt wie geplant</button>
        </div></div>`;
}
