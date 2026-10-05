/* eslint-disable no-undef */
// Rückkaufoption beim Verkauf (Phase 22.7): ein Angebot für einen Spieler bis 25 Jahre kann
// mit Rückkaufoption angenommen werden. Der Käufer zahlt dafür 10 % weniger sofort; im
// Gegenzug darf der Verein den Spieler bis zum Ende der übernächsten Saison zu einem festen
// Preis (140 % des Angebots) zurückholen - nur in einem Transferfenster.
// Der Spieler entwickelt sich beim neuen Verein weiter (tickBuybackOptions() zum
// Saisonwechsel: junge Spieler legen zu, ab 27 baut er ab). Lohnt sich also bei Talenten, die
// man gerade nicht braucht oder nicht bezahlen kann - ein Fehlgriff kostet die 10 %.
// Offene Optionen: game.buybackOptions [{ player, club, price, untilSeason, saleStrength, season }].

const BUYBACK_MAX_AGE = 25;
const BUYBACK_DISCOUNT = 0.9;
const BUYBACK_PRICE_FACTOR = 1.4;
const BUYBACK_SEASONS = 2;

// Konditionen für ein Angebot (null: für diesen Spieler keine Rückkaufoption).
function getBuybackTerms(p, offer) {
    if (!p || !offer || (p.age || 30) > BUYBACK_MAX_AGE) return null;
    return {
        sofort: Math.round(offer.currentBid * BUYBACK_DISCOUNT),
        preis: Math.round(offer.currentBid * BUYBACK_PRICE_FACTOR / 1000) * 1000
    };
}

function acceptTransferOfferWithBuyback(offerId) {
    const offer = incomingOffers.find(o => o.id === offerId);
    const p = offer && squad.find(x => x.id === offer.playerId);
    const t = getBuybackTerms(p, offer);
    if (!t) { showToast('Eine Rückkaufoption gibt es nur für Spieler bis 25 Jahre.', 'error'); return; }
    const v = completeOfferSale(offerId, t.sofort);
    if (!v) return;
    if (!game.buybackOptions) game.buybackOptions = [];
    game.buybackOptions.push({ player: v.player, club: offer.clubName, price: t.preis, untilSeason: game.season + BUYBACK_SEASONS, saleStrength: v.player.strength, season: game.season });
    showToast(`↩️ ${v.player.name} wechselt für ${formatVal(v.erloes)} zu ${offer.clubName} - Rückkauf bis Saison ${game.season + BUYBACK_SEASONS} für ${formatVal(t.preis)} möglich.`, 'success', 6000);
    updateUI();
    renderTransferView();
}

// Saisonwechsel (concludeSeasonAndAdvance): Entwicklung beim neuen Verein, abgelaufene Optionen.
function tickBuybackOptions() {
    if (!game.buybackOptions || !game.buybackOptions.length) return;
    game.buybackOptions = game.buybackOptions.filter(o => {
        const p = o.player;
        // Läuft VOR game.season++: am Ende der Saison untilSeason verfällt die Option.
        if (game.season >= o.untilSeason) {
            addInboxMessage('transfer', `↩️ Rückkaufoption verfallen: ${p.name}`, `Die Option, ${p.name} von ${o.club} zurückzuholen, ist abgelaufen.`, 'screen-transfer');
            return false;
        }
        p.age = (p.age || 22) + 1;
        const r = Math.random();
        const delta = p.age <= 21 ? 2 + Math.floor(r * 5) : p.age <= 24 ? 1 + Math.floor(r * 4) : p.age <= 26 ? Math.floor(r * 3) - 1 : -1 - Math.floor(r * 3);
        p.strength = Math.max(20, Math.min(99, p.strength + delta));
        p.marketValue = calculatePlayerMarketValue(p.strength);
        addInboxMessage('transfer', `↩️ ${p.name} bei ${o.club}`, `${p.name} (${p.age} J.) steht jetzt bei Stärke ${p.strength} (beim Verkauf ${o.saleStrength}). Rückkauf für ${formatVal(o.price)} bis Saison ${o.untilSeason} - nur im Transferfenster.`, 'screen-transfer');
        return true;
    });
}

function exerciseBuyback(playerId) {
    const o = (game.buybackOptions || []).find(x => x.player.id === playerId);
    if (!o) { showToast('Diese Rückkaufoption gibt es nicht mehr.', 'error'); return; }
    if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) { showToast('Zurückholen geht nur im Transferfenster (Spieltag 1-3 oder Winterfenster).', 'error', 4500); return; }
    if (typeof isTransferEmbargoActive === 'function' && isTransferEmbargoActive()) { showToast('🚫 Transfersperre aktiv.', 'error'); return; }
    if (game.money < o.price) { showToast(`Vereinskonto reicht nicht: ${formatVal(o.price)} nötig.`, 'error'); return; }
    if (game.transferBudget < o.price) { showToast(`Transferbudget reicht nicht: ${formatVal(o.price)} nötig, ${formatVal(game.transferBudget)} verfügbar.`, 'error', 4500); return; }
    const p = o.player;
    const gehalt = Math.max(p.wage || 0, calculatePlayerWage(p.marketValue, p.strength));
    const lohnsumme = squad.reduce((s, x) => s + x.wage, 0);
    if (lohnsumme + gehalt > game.wageBudget) { showToast(`Gehaltsbudget reicht nicht: ${formatVal(lohnsumme + gehalt)} nach der Rückkehr, erlaubt ${formatVal(game.wageBudget)}.`, 'error', 5000); return; }
    playSound('goal');
    setzeBuchungskontext('↩️ Rückkauf');
    game.money -= o.price;
    loescheBuchungskontext();
    game.transferBudget -= o.price;
    p.wage = gehalt;
    p.contracts = 3;
    p.fitness = 100;
    p.morale = 80;
    p.injured = 0;
    p.suspended = 0;
    if (squad.some(x => x.id === p.id)) p.id = Math.random().toString(36).substr(2, 9);
    squad.push(p);
    game.buybackOptions = game.buybackOptions.filter(x => x !== o);
    game.fans = Math.min(100, game.fans + 2);
    showToast(`↩️ ${p.name} kehrt für ${formatVal(o.price)} von ${o.club} zurück (Stärke ${p.strength}, Fans +2).`, 'success', 5000);
    renderBuybackBox();
    updateUI();
}

function renderBuybackBox() {
    const box = document.getElementById('buyback-box');
    if (!box) return;
    const liste = game.buybackOptions || [];
    if (!liste.length) { box.innerHTML = ''; return; }
    const fenster = typeof isTransferWindowOpen === 'function' ? isTransferWindowOpen() : true;
    box.innerHTML = `<div class="panel"><div class="panel-header">↩️ RÜCKKAUFOPTIONEN</div>
        ${fenster ? '' : '<div class="box" style="font-size:9px;">Zurückholen geht nur im Transferfenster (Spieltag 1-3 oder Winterfenster).</div>'}
        ${liste.map(o => {
            const diff = o.player.strength - o.saleStrength;
            return `<div class="box" style="font-size:10px;">
                <div><strong>${o.player.name}</strong> (${o.player.pos}, ${o.player.age} J.) bei ${o.club} · Stärke <strong>${o.player.strength}</strong> <span style="color:${diff > 0 ? 'var(--primary)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)'};">(${diff >= 0 ? '+' : ''}${diff} seit dem Verkauf)</span></div>
                <div style="color:var(--text-muted);">Marktwert ${formatVal(o.player.marketValue)} · Option bis Saison ${o.untilSeason}</div>
                <button onclick="exerciseBuyback('${o.player.id}')" class="${fenster ? 'btn-action' : 'btn-secondary'}" style="font-size:10px; margin-top:4px;">↩️ Zurückholen für ${formatVal(o.price)}</button>
            </div>`;
        }).join('')}</div>`;
}
