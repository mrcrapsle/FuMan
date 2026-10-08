/* eslint-disable no-undef */
// Aufstiegsschub (Phase 25.18): KI-Aufsteiger rücken beim Saisonwechsel in evolveAiTeamStrength()
// (js/leagues.js) um rund 4 Punkte an die neue Liga heran - ein simuliertes Transferfenster.
// Der eigene Verein kam bisher nur mit seinem alten Kader hoch, rund 7 Punkte unter dem Schnitt
// der neuen Liga (Ligen liegen ~10 Punkte auseinander), und stieg oft sofort wieder ab (Bot:
// 2. Liga mit 8 und 18 Punkten). Jetzt nach jedem Aufstieg (applyPromotionRewards):
//   Aufstiegsbudget  +50 % des Liga-Transferbudgets der neuen Liga (getPromotionTransferBonus)
//   Euphorie         +3 Stärke in Ligaspielen bis Spieltag 10, +1,5 bis Spieltag 17
//                    (getPromotionEuphoriaBonus: Simulation über getOwnLeagueMatchStrength(),
//                    live über applyPromotionEuphoriaLive() in setupMatch())
// game.promotionBoost = { level, season } markiert die erste Saison in der neuen Liga.

const PROMOTION_BUDGET_SHARE = 0.5;
const PROMOTION_EUPHORIA = [{ bis: 10, bonus: 3 }, { bis: 17, bonus: 1.5 }];

function getPromotionTransferBonus(level = game.leagueLevel) {
    return Math.round(getLeagueTransferBudget(level) * PROMOTION_BUDGET_SHARE / 1000) * 1000;
}

// Aus applyPromotionRewards(): am Saisonende (Spieltag > 34) gilt der Schub für die nächste
// Saison, beim nachträglichen Aufstieg in der DFB-Nachfrist für die laufende.
function markPromotionBoost() {
    const season = game.matchday > 34 ? game.season + 1 : game.season;
    game.promotionBoost = { level: game.leagueLevel, season };
    // Nachfrist: die Budgets der Saison stehen schon - das Aufstiegsbudget kommt direkt dazu.
    if (game.matchday <= 34) game.transferBudget += getPromotionTransferBonus();
}

function isPromotionBoostSeason() {
    const b = game.promotionBoost;
    return !!b && b.season === game.season && b.level === game.leagueLevel;
}

function getPromotionEuphoriaBonus() {
    if (!isPromotionBoostSeason()) return 0;
    const stufe = PROMOTION_EUPHORIA.find(s => game.matchday <= s.bis);
    return stufe ? stufe.bonus : 0;
}

function applyPromotionEuphoriaLive() {
    if (!currentMatch || currentMatch.isCup) return;
    const bonus = getPromotionEuphoriaBonus();
    if (!bonus) return;
    currentMatch.ourBaseStr += bonus;
    if (currentMatch.isHome) currentMatch.homeStr += bonus; else currentMatch.awayStr += bonus;
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += `<div style="color:var(--primary);">🎉 Aufstiegseuphorie: die Mannschaft spielt befreit auf (+${bonus.toLocaleString('de-DE')} Stärke).</div>`;
}

function describePromotionBoost() {
    return `Aufstiegsbudget +${formatVal(getPromotionTransferBonus())} und Aufstiegseuphorie (+${PROMOTION_EUPHORIA[0].bonus} Stärke bis Spieltag ${PROMOTION_EUPHORIA[0].bis}, +${PROMOTION_EUPHORIA[1].bonus.toLocaleString('de-DE')} bis Spieltag ${PROMOTION_EUPHORIA[1].bis}).`;
}
