/* eslint-disable no-undef */
// Pokalfinale als Großereignis (DFB-Pokal und Landespokal): drei Spieltage vor dem Endspiel
// beginnt die Finalwoche (Dashboard-Karte #dash-cup-final-box) mit drei Entscheidungen -
// Ticketkontingent (Fans = Stimmung, Sponsoren = Geld), Fan-Sonderzüge und Kurztrainingslager.
// Jede wirkt im Finale als Stärkebonus (getCupFinalBonus), live (applyCupFinalPreparation in
// markCupLiveMatch) wie simuliert (cup.js/landescup.js). Nach dem Endspiel: Eintrag in
// game.cupFinals (Historie > Titel) und nach einem Sieg die Titelfeier (Autokorso oder Kabine).

const CUP_FINAL_COSTS = {
    dfb: { tickets: 8000, preisFans: 30, preisSponsor: 75, zug: 120000, camp: 150000, korso: 80000 },
    landes: { tickets: 2500, preisFans: 12, preisSponsor: 30, zug: 25000, camp: 30000, korso: 15000 }
};

function getCupFinalName(comp) {
    return comp === 'dfb' ? 'DFB-Pokal-Finale' : `${typeof landesPokal !== 'undefined' ? landesPokal.region : 'Landes'}pokal-Finale`;
}

// Die eigene, noch nicht gespielte Endspiel-Paarung (oder null).
function getUpcomingOwnFinal() {
    const us = game.clubName;
    const offen = r => (r && !r.completed) ? r.pairings.find(p => !p.played && (p.home === us || p.away === us)) : null;
    const dfbRunde = cupTournament.roundsHistory[cupTournament.matchdays.length - 1];
    const dfb = game.inCup ? offen(dfbRunde) : null;
    if (dfb) return { comp: 'dfb', matchday: cupTournament.matchdays[cupTournament.matchdays.length - 1], opponent: dfb.home === us ? dfb.away : dfb.home, prize: dfbRunde.prize };
    if (typeof landesPokal !== 'undefined' && landesPokal.active) {
        const letzte = landesPokal.matchdays.length - 1;
        const lp = offen(landesPokal.roundsHistory[letzte]);
        if (lp) return { comp: 'landes', matchday: landesPokal.matchdays[letzte], opponent: lp.home === us ? lp.away : lp.home, prize: landesPokal.roundsHistory[letzte].prize };
    }
    return null;
}

function getCupFinalState(finale) {
    const f = finale || getUpcomingOwnFinal();
    if (!f) return null;
    const cf = game.cupFinal;
    if (cf && cf.season === game.season && cf.comp === f.comp && !cf.played) return cf;
    game.cupFinal = { season: game.season, comp: f.comp, opponent: f.opponent, matchday: f.matchday, tickets: null, zug: false, camp: false, played: false, celebration: null };
    return game.cupFinal;
}

function getCupFinalBonus(comp) {
    const cf = game.cupFinal;
    if (!cf || cf.season !== game.season || cf.comp !== comp || cf.played || game.matchday !== cf.matchday) return 0;
    return (cf.tickets === 'fans' ? 1 : 0) + (cf.zug ? 1.5 : 0) + (cf.camp ? 1 : 0);
}

function cupFinalSpend(betrag, label) {
    if (game.money < betrag) { showToast(`Nicht genug Geld: ${formatVal(betrag)} nötig.`, 'error'); return false; }
    setzeBuchungskontext(label);
    game.money -= betrag;
    loescheBuchungskontext();
    return true;
}

function chooseCupFinalTickets(art) {
    const cf = getCupFinalState();
    if (!cf) return;
    if (cf.tickets) { showToast('Das Ticketkontingent ist schon verteilt.', 'error'); return; }
    const k = CUP_FINAL_COSTS[cf.comp];
    const erloes = k.tickets * (art === 'fans' ? k.preisFans : k.preisSponsor);
    setzeBuchungskontext('🏟️ Finaltickets');
    game.money += erloes;
    loescheBuchungskontext();
    if (art === 'fans') game.fans = Math.min(100, game.fans + 4);
    else game.fans = Math.max(0, game.fans - 2);
    cf.tickets = art;
    showToast(art === 'fans' ? `🎟️ Günstige Tickets für die Fans: ${formatVal(erloes)}, Fans +4, im Finale +1 Stärke.` : `🎟️ Kontingent an Sponsoren: ${formatVal(erloes)}, die Kurve murrt (Fans -2).`, 'success', 5000);
    updateUI();
    renderCupFinalCard();
}

function bookCupFinalTrains() {
    const cf = getCupFinalState();
    if (!cf) return;
    if (cf.zug) { showToast('Die Sonderzüge sind schon gebucht.', 'error'); return; }
    if (!cupFinalSpend(CUP_FINAL_COSTS[cf.comp].zug, '🚆 Fan-Sonderzüge')) return;
    cf.zug = true;
    game.fans = Math.min(100, game.fans + 2);
    showToast('🚆 Sonderzüge gebucht: Fans +2, im Finale +1,5 Stärke.', 'success');
    updateUI();
    renderCupFinalCard();
}

function bookCupFinalCamp() {
    const cf = getCupFinalState();
    if (!cf) return;
    if (cf.camp) { showToast('Das Trainingslager ist schon gebucht.', 'error'); return; }
    if (!cupFinalSpend(CUP_FINAL_COSTS[cf.comp].camp, '⛺ Final-Trainingslager')) return;
    cf.camp = true;
    showToast('⛺ Kurztrainingslager gebucht: im Finale +1 Stärke.', 'success');
    updateUI();
    renderCupFinalCard();
}

// Live: nach setupMatch()/markCupLiveMatch() - die Vorbereitung fließt in die Basisstärke.
function applyCupFinalPreparation(tie) {
    if (!currentMatch || !tie) return;
    const bonus = getCupFinalBonus(tie.comp);
    if (bonus <= 0) return;
    currentMatch.ourBaseStr += bonus;
    if (currentMatch.isHome) currentMatch.homeStr += bonus; else currentMatch.awayStr += bonus;
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += `<div style="color:var(--gold);">🏟️ Finalstimmung: Die Vorbereitung bringt +${String(bonus).replace('.', ',')} Stärke.</div>`;
}

// Aus finalizeCupRound()/finalizeLandesPokalRound(): Endspiel festhalten.
function recordCupFinal(comp, pairing, weWon) {
    const us = game.clubName;
    const cf = game.cupFinal && game.cupFinal.season === game.season && game.cupFinal.comp === comp ? game.cupFinal : null;
    const eintrag = {
        season: game.season, comp, name: getCupFinalName(comp),
        opponent: pairing.home === us ? pairing.away : pairing.home,
        score: pairing.home === us ? `${pairing.homeGoals}:${pairing.awayGoals}` : `${pairing.awayGoals}:${pairing.homeGoals}`,
        penalties: !!pairing.penaltyWinner, won: weWon,
        prep: cf ? [cf.tickets === 'fans' ? 'Fan-Tickets' : (cf.tickets === 'sponsoren' ? 'Sponsoren-Tickets' : null), cf.zug ? 'Sonderzüge' : null, cf.camp ? 'Trainingslager' : null].filter(Boolean) : []
    };
    if (!game.cupFinals) game.cupFinals = [];
    game.cupFinals.unshift(eintrag);
    if (weWon && typeof addSquadHonour === 'function') addSquadHonour(`🏆 ${eintrag.name}-Sieger`);
    if (game.cupFinals.length > 20) game.cupFinals.length = 20;
    if (cf) {
        cf.played = true;
        cf.celebration = weWon ? 'offen' : null;
        cf.decideBy = game.matchday + 3;
    }
    return eintrag;
}

function chooseCupCelebration(art) {
    const cf = game.cupFinal;
    if (!cf || cf.celebration !== 'offen') { showToast('Gerade steht keine Titelfeier an.', 'error'); return; }
    if (art === 'korso') {
        if (!cupFinalSpend(CUP_FINAL_COSTS[cf.comp].korso, '🎉 Titelfeier')) return;
        game.fans = Math.min(100, game.fans + 6);
        if (typeof changeMediaImage === 'function') changeMediaImage(3);
        if (typeof boostFanBaseFloor === 'function') boostFanBaseFloor(2, 'Der Autokorso nach dem Pokalsieg');
        showToast('🎉 Autokorso und Rathausbalkon: Fans +6, Medienimage +3.', 'success', 5000);
    } else {
        squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 8); });
        showToast('🍾 Feier in der Kabine: die Mannschaft schweißt das zusammen, Moral +8.', 'success', 5000);
    }
    cf.celebration = art;
    updateUI();
    renderCupFinalCard();
}

function renderCupFinalCard() {
    const box = document.getElementById('dash-cup-final-box');
    if (!box) return;
    const cf0 = game.cupFinal;
    if (cf0 && cf0.celebration === 'offen') {
        if (cf0.season !== game.season || game.matchday > (cf0.decideBy || 0)) { cf0.celebration = 'verpasst'; box.innerHTML = ''; return; }
        const k = CUP_FINAL_COSTS[cf0.comp];
        box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--gold);">🏆 <strong>${getCupFinalName(cf0.comp)} gewonnen!</strong> Wie wird gefeiert?
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:4px;">
                <button onclick="chooseCupCelebration('korso')" class="btn-action" style="font-size:9px;">🚗 Autokorso (${formatVal(k.korso)})<br><span style="font-size:8px;">Fans +6, Medienimage +3</span></button>
                <button onclick="chooseCupCelebration('kabine')" class="btn-secondary" style="font-size:9px;">🍾 Kabinenfeier<br><span style="font-size:8px;">kostenlos, Moral +8</span></button>
            </div></div>`;
        return;
    }
    const f = getUpcomingOwnFinal();
    if (!f || f.matchday - game.matchday > 3 || f.matchday < game.matchday) { box.innerHTML = ''; return; }
    const cf = getCupFinalState(f);
    const k = CUP_FINAL_COSTS[f.comp];
    const bonus = (cf.tickets === 'fans' ? 1 : 0) + (cf.zug ? 1.5 : 0) + (cf.camp ? 1 : 0);
    const zeile = (erledigt, text, knoepfe) => `<div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:4px;"><span>${erledigt ? '✅' : '⬜'} ${text}</span>${erledigt ? '' : `<span style="display:flex; gap:4px;">${knoepfe}</span>`}</div>`;
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--gold);">🏟️ <strong>Finalwoche: ${getCupFinalName(f.comp)}</strong> gegen ${f.opponent} (Spieltag ${f.matchday}) · Prämie ${formatVal(f.prize)}
        ${zeile(!!cf.tickets, `Ticketkontingent (${k.tickets.toLocaleString('de-DE')} Karten)${cf.tickets ? `: ${cf.tickets === 'fans' ? 'an die Fans' : 'an Sponsoren'}` : ''}`,
            `<button onclick="chooseCupFinalTickets('fans')" class="btn-secondary" style="width:auto; font-size:9px;">Fans (${formatVal(k.tickets * k.preisFans)}, +1 Stärke)</button><button onclick="chooseCupFinalTickets('sponsoren')" class="btn-secondary" style="width:auto; font-size:9px;">Sponsoren (${formatVal(k.tickets * k.preisSponsor)})</button>`)}
        ${zeile(cf.zug, 'Fan-Sonderzüge (+1,5 Stärke)', `<button onclick="bookCupFinalTrains()" class="btn-secondary" style="width:auto; font-size:9px;">${formatVal(k.zug)}</button>`)}
        ${zeile(cf.camp, 'Kurztrainingslager (+1 Stärke)', `<button onclick="bookCupFinalCamp()" class="btn-secondary" style="width:auto; font-size:9px;">${formatVal(k.camp)}</button>`)}
        <div style="color:var(--text-muted); margin-top:4px;">Vorbereitung bisher: +${String(bonus).replace('.', ',')} Stärke im Endspiel.</div></div>`;
}

function renderCupFinalHistory() {
    const box = document.getElementById('cup-finals-history-box');
    if (!box) return;
    const liste = game.cupFinals || [];
    box.innerHTML = liste.length ? liste.map(e => `<div class="box" style="font-size:10px; border-left-color:${e.won ? 'var(--gold)' : 'var(--text-muted)'};">${e.won ? '🏆' : '🥈'} <strong>${e.name} ${e.season}</strong>: ${e.score}${e.penalties ? ' (n. E.)' : ''} gegen ${e.opponent}${e.prep.length ? `<br><span style="color:var(--text-muted);">Vorbereitung: ${e.prep.join(', ')}</span>` : ''}</div>`).join('')
        : '<div style="font-size:10px; color:var(--text-muted);">Noch kein Pokalfinale erreicht.</div>';
}
