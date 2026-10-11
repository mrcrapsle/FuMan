/* eslint-disable no-undef */
// Talente verkaufen (Phase 25.18): KI-Vereine bieten für Akademie-Talente (youthTalents) mit
// echten Ablösen - bisher konnte ein Talent nur hochgezogen, verliehen, entlassen oder von einem
// Rivalen abgeworben werden (checkYouthPoachingAttempt). Jeden Monat (runMonthlyClubTicks)
// prüft tickYouthOffers() die Talente ab 16: Chance je Potenzial-Stufe (YOUTH_OFFER_CHANCE),
// höchstens YOUTH_OFFER_MAX offene Angebote in game.youthOffers, jedes gilt 4 Spieltage.
// Ablöse = Marktwert der heutigen Stärke × (1 + Potenzial-Luft / 20) × 0,8-1,2, höchstens 30 % des
// Marktwerts am Potenzial (die Scouts der anderen kennen es). Der erste Entwurf (Marktwert auf halbem
// Weg zum Potenzial) brachte dem Bundesliga-Bot bis zu 43 Mio. € pro Saison - für 500.000-€-Sichtungen.
//   annehmen          volle Ablöse, 85 % davon ins Transferbudget (wie bei Profi-Verkäufen)
//   mit Beteiligung   20 % weniger jetzt, dafür 20 % vom späteren Weiterverkauf
//                     (game.sellOnClauses mit resaleValue = Marktwert auf halbem Weg zum Potenzial)
//   ablehnen          das Talent bleibt; ein Top-Talent (Stufe 3) freut sich (Entwicklung +1)

const YOUTH_OFFER_CHANCE = { 1: 0.015, 2: 0.05, 3: 0.12 };
const YOUTH_OFFER_MAX = 2;
const YOUTH_OFFER_DAYS = 4;
const YOUTH_SELLON_PERCENT = 20;

function getYouthOfferAmount(p) {
    const luft = Math.max(0, (p.potential || p.strength) - p.strength);
    const wert = calculatePlayerMarketValue(p.strength) * (1 + luft / 20) * (0.8 + Math.random() * 0.4);
    const deckel = calculatePlayerMarketValue(p.potential || p.strength) * 0.3;
    return Math.max(5000, Math.round(Math.min(wert, deckel) / 1000) * 1000);
}

function pickYouthOfferClub() {
    const lvl = Math.max(0, game.leagueLevel - (Math.random() < 0.5 ? 1 : 0));
    const teams = (leaguesData[lvl] || []).filter(t => t.name !== game.clubName && t.name !== (game.secondTeam && game.secondTeam.name));
    if (!teams.length) return 'ein Ligakonkurrent';
    const stark = [...teams].sort((a, b) => b.strength - a.strength).slice(0, Math.max(3, Math.ceil(teams.length / 2)));
    return stark[Math.floor(Math.random() * stark.length)].name;
}

function getOpenYouthOffers() {
    if (!Array.isArray(game.youthOffers)) game.youthOffers = [];
    return game.youthOffers;
}

function tickYouthOffers() {
    const offen = getOpenYouthOffers();
    // Abgelaufene oder verwaiste Angebote (Talent weg, neue Saison) entfernen.
    game.youthOffers = offen.filter(o => o.season === game.season && o.bis >= game.matchday && youthTalents.some(p => p.id === o.playerId));
    if (game.youthOffers.length >= YOUTH_OFFER_MAX) return;
    const kandidaten = youthTalents.filter(p => (p.age || 15) >= 16 && !game.youthOffers.some(o => o.playerId === p.id));
    for (const p of kandidaten) {
        if (game.youthOffers.length >= YOUTH_OFFER_MAX) break;
        if (typeof ensureYouthPotential === 'function') ensureYouthPotential(p);
        if (Math.random() >= (YOUTH_OFFER_CHANCE[p.potentialTier] || 0.015)) continue;
        const o = { id: `yo-${p.id}-${game.season}-${game.matchday}`, playerId: p.id, name: p.name, club: pickYouthOfferClub(),
            betrag: getYouthOfferAmount(p), season: game.season, bis: game.matchday + YOUTH_OFFER_DAYS };
        game.youthOffers.push(o);
        addInboxMessage('vertrag', `🌱 Angebot für Talent ${p.name}`, `${o.club} bietet ${formatVal(o.betrag)} für ${p.name} (${p.age} J., Stärke ${p.strength}). Das Angebot gilt bis Spieltag ${o.bis} - Jugendakademie, Reiter Talente.`, 'screen-youth');
    }
}

function removeYouthTalentById(id) {
    youthTalents = youthTalents.filter(p => p.id !== id);
    game.youthHospitants = (game.youthHospitants || []).filter(x => x !== id);
    game.youthOffers = getOpenYouthOffers().filter(o => o.playerId !== id);
}

function acceptYouthOffer(offerId, mitBeteiligung) {
    const o = getOpenYouthOffers().find(x => x.id === offerId);
    const p = o && youthTalents.find(x => x.id === o.playerId);
    if (!o || !p) { showToast('Dieses Angebot gilt nicht mehr.', 'error'); return; }
    const jetzt = mitBeteiligung ? Math.round(o.betrag * (1 - YOUTH_SELLON_PERCENT / 100) / 1000) * 1000 : o.betrag;
    playSound('goal');
    if (typeof bucheMitLabel === 'function') bucheMitLabel('🌱 Talentverkauf', jetzt); else game.money += jetzt;
    game.transferBudget += Math.round(jetzt * 0.85);
    if (mitBeteiligung) {
        if (!Array.isArray(game.sellOnClauses)) game.sellOnClauses = [];
        game.sellOnClauses.push({ playerName: p.name, buyingClub: o.club, percent: YOUTH_SELLON_PERCENT, originalSaleValue: jetzt,
            resaleValue: calculatePlayerMarketValue(Math.round((p.strength + (p.potential || p.strength)) / 2)) });
    }
    removeYouthTalentById(p.id);
    if (typeof addYouthMoment === 'function') addYouthMoment('💶', `${p.name} wechselt für ${formatVal(jetzt)} zu ${o.club}${mitBeteiligung ? ` (+${YOUTH_SELLON_PERCENT} % Weiterverkauf)` : ''}`);
    showToast(`💶 ${p.name} wechselt für ${formatVal(jetzt)} zu ${o.club}${mitBeteiligung ? ` - dazu ${YOUTH_SELLON_PERCENT} % vom Weiterverkauf` : ''}.`, 'success', 5500);
    if (typeof renderYouthView === 'function') renderYouthView();
    updateUI();
}

function rejectYouthOffer(offerId) {
    const o = getOpenYouthOffers().find(x => x.id === offerId);
    if (!o) return;
    const p = youthTalents.find(x => x.id === o.playerId);
    game.youthOffers = getOpenYouthOffers().filter(x => x.id !== offerId);
    // Ein Top-Talent fühlt sich bestätigt, wenn der Verein auf ihn setzt.
    if (p && p.potentialTier === 3 && p.strength < (p.potential || 99)) p.strength++;
    showToast(p ? `${p.name} bleibt in der Akademie${p.potentialTier === 3 ? ' - und gibt im Training noch mehr Gas (+1)' : ''}.` : 'Angebot abgelehnt.', 'success');
    if (typeof renderYouthView === 'function') renderYouthView();
}

// Entscheidungshilfe (25.33): Potenzial gegen den Kader-Median. Im Bundesliga-Langzeittest kostete der
// Verkauf von Talenten unter dem Median die erste Elf nichts messbar (Elf -1,1 gegenüber -1,4 zum
// Ligaschnitt, auch mit Median + 5), brachte aber 16 bis 45 Mio. € je 10 Saisons.
// Kader-Median der Stärke (25.36): ein Wert für Jugend, Angebote, Profivertrag und Spielerkarte
function getKaderMedian() {
    const staerken = squad.map(s => s.strength || 0).sort((a, b) => a - b);
    return staerken.length ? staerken[Math.floor(staerken.length / 2)] : null;
}

function getYouthOfferSquadHint(p, modus) {
    const median = getKaderMedian();
    if (median === null) return '';
    if (!p.potentialRevealed) return `Kader-Median ${median}, Potenzial unbekannt - der Potenzial-Check zeigt, ob er den Kader erreicht.`;
    const pot = typeof getYouthPotentialText === 'function' ? getYouthPotentialText(p) : p.potential;
    // modus 'profi' (Profivertrag-Entscheidung, 25.35): derselbe Vergleich, andere Folge
    if (modus === 'profi') {
        return p.potential < median
            ? `Potenzial ${pot} liegt unter dem Kader-Median ${median}: er wird voraussichtlich kein Stammspieler - Verleihen oder Verkaufen ist oft besser als ein 3-Jahres-Vertrag.`
            : `Potenzial ${pot} erreicht den Kader-Median ${median}: er kann ein Stammspieler werden.`;
    }
    return p.potential < median
        ? `Potenzial ${pot} liegt unter dem Kader-Median ${median}: ein Verkauf kostet die Elf voraussichtlich nichts.`
        : `Potenzial ${pot} erreicht den Kader-Median ${median}: er kann ein Stammspieler werden.`;
}

function renderYouthOffersBox() {
    const box = document.getElementById('youth-offers-box');
    if (!box) return;
    const offen = getOpenYouthOffers().filter(o => o.season === game.season && o.bis >= game.matchday && youthTalents.some(p => p.id === o.playerId));
    if (!offen.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="panel" style="border:1px solid var(--gold);"><div class="panel-header" style="color:var(--gold);">💶 ANGEBOTE FÜR TALENTE</div>` + offen.map(o => {
        const p = youthTalents.find(x => x.id === o.playerId);
        const mit = Math.round(o.betrag * (1 - YOUTH_SELLON_PERCENT / 100) / 1000) * 1000;
        return `<div class="box" style="font-size:10px;">${o.club} bietet <strong>${formatVal(o.betrag)}</strong> für ${p.name} (${p.pos}, ${p.age} J., Stärke ${p.strength}) - gilt bis Spieltag ${o.bis}.
            <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${getYouthOfferSquadHint(p)}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:4px;">
                <button onclick="acceptYouthOffer('${o.id}', false)" class="btn-action" style="font-size:9px;">✅ Verkaufen</button>
                <button onclick="acceptYouthOffer('${o.id}', true)" class="btn-secondary" style="font-size:9px;">📈 ${formatVal(mit)} + ${YOUTH_SELLON_PERCENT} % Weiterverkauf</button>
                <button onclick="rejectYouthOffer('${o.id}')" class="btn-secondary" style="font-size:9px;">❌ Behalten</button>
            </div></div>`;
    }).join('') + '</div>';
}
