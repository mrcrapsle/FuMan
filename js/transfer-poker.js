/* eslint-disable no-undef */
// Transferpoker: Spieler vom Transfermarkt werden einem echten KI-Verein abgekauft. Der
// Verein nennt eine Forderung (p.askingPrice) und hat eine verdeckte Schmerzgrenze
// (p.sellerMinimum); verhandelt wird in Runden mit begrenzter Geduld. Bei begehrten Spielern
// bietet ein Rivale mit - wer zu lange pokert, verliert den Spieler. Ist die Ablöse klar,
// folgt das Gehaltsgespräch mit dem Spieler bzw. seinem Berater. buyPlayer() bleibt der
// Sofortkauf zur aktuellen Forderung; beide Wege enden in finalizePlayerPurchase().

let transferPoker = null;
const POKER_TOUGHNESS = { Ehrgeizig: 1.35, Selbstbewusst: 1.2, Emotional: 1.1, Hitzköpfig: 1.15, Ruhig: 0.9, Bescheiden: 0.75 };

// Verkaufender Verein, Forderung und Schmerzgrenze - einmal je Marktspieler festgelegt.
function ensureTransferTerms(p) {
    if (p.askingPrice) return p;
    const pool = [game.leagueLevel, Math.max(0, game.leagueLevel - 1)].flatMap(l => (leaguesData[l] || []).filter(t => typeof isAiClub === 'function' ? isAiClub(t) : t.name !== game.clubName));
    const verein = pool.sort((a, b) => Math.abs(a.strength - p.strength) - Math.abs(b.strength - p.strength))[Math.floor(Math.random() * Math.min(6, pool.length))];
    p.sellerClub = verein ? verein.name : 'ein Ligakonkurrent';
    const vertrag = Math.max(1, Math.min(4, p.contracts || 2));
    // Lange Verträge machen den Spieler teuer und den Verkäufer zäh.
    p.sellerMinimum = Math.round(p.marketValue * (0.82 + vertrag * 0.05) / 1000) * 1000;
    p.askingPrice = Math.max(p.sellerMinimum + 1000, Math.round(p.marketValue * (1.0 + vertrag * 0.04 + Math.random() * 0.12) / 1000) * 1000);
    return p;
}

function getTransferAsking(p) {
    return ensureTransferTerms(p).askingPrice;
}

// Tauschgeschäft (25.20): nach der Einigung auf die Ablöse einen eigenen Spieler in Zahlung geben -
// in der Bundesliga begrenzt meist die Kasse die Käufe, nicht das Budget. Der Verkäufer nimmt Spieler
// bis 30 Jahre, die höchstens SWAP_MAX_GAP Punkte schwächer sind, zu SWAP_VALUE_SHARE des Marktwerts.
const SWAP_VALUE_SHARE = 0.85;
const SWAP_MAX_GAP = 10;
const SWAP_MIN_SQUAD = 17;
// Der Verkäufer nimmt nur, wen er brauchen kann (25.22): höchstens SWAP_CLUB_GAP Punkte unter seiner
// Vereinsstärke. Vorher reichte "10 Punkte unter dem Marktspieler" - der Langzeit-Bot tauschte in
// der 5. Liga bis zu 12 Ergänzungsspieler pro Saison los.
const SWAP_CLUB_GAP = 4;
function getSwapClubMinimum(p) {
    const verein = leaguesData.flat().find(t => t && t.name === p.sellerClub);
    return Math.max(p.strength - SWAP_MAX_GAP, (verein ? verein.strength : p.strength) - SWAP_CLUB_GAP);
}
function isSwapCandidate(tp, p) {
    // Verletzte nimmt kein Verkäufer in Zahlung (25.21).
    return !!tp && (tp.age || 25) <= 30 && tp.strength >= getSwapClubMinimum(p) && !(tp.injured > 0)
        && !(incomingLoans || []).some(l => l.playerId === tp.id) && squad.length > SWAP_MIN_SQUAD;
}
function getSwapValue(tp, p, ablose) {
    if (!isSwapCandidate(tp, p)) return 0;
    return Math.min(ablose, Math.round((tp.marketValue || 0) * SWAP_VALUE_SHARE / 1000) * 1000);
}
function setPokerSwap(id) {
    if (!transferPoker) return;
    transferPoker.swapId = id || null;
    renderTransferPokerBox();
}

// Gemeinsamer Abschluss für Sofortkauf und Verhandlung: alle Budgetprüfungen an einer Stelle.
function finalizePlayerPurchase(p, ablose, gehalt, tauschId) {
    if (isTransferEmbargoActive()) { showToast(`🚫 Transfersperre aktiv${game.ffpTransferEmbargo ? ' (Financial Fairplay)' : ' - erst die Zahlungsfähigkeit wiederherstellen (siehe Finanzen)'}.`, 'error', 5000); return false; }
    const idx = marketPlayers.indexOf(p);
    if (idx === -1) { showToast(`${p.name} ist nicht mehr auf dem Markt.`, 'error'); return false; }
    const tausch = tauschId ? squad.find(x => x.id === tauschId) : null;
    if (tauschId && !isSwapCandidate(tausch, p)) { showToast('Dieser Spieler kommt für den Tausch nicht (mehr) in Frage.', 'error', 4500); return false; }
    const anrechnung = tausch ? getSwapValue(tausch, p, ablose) : 0;
    const bar = ablose - anrechnung;
    // Der Tauschspieler zählt wie ein Verkauf (completeOfferSale): sein Berater kassiert Provision
    // auf die Anrechnung, ins Transferbudget fließen nur 85 % davon (25.21 - vorher volle Anrechnung
    // ohne Provision, ein Tausch war fürs Budget besser als jeder Verkauf).
    const agentFee = getAgentFee(p, ablose) + (tausch ? getAgentFee(tausch, anrechnung) : 0);
    const budgetBedarf = bar + Math.round(anrechnung * 0.15);
    const gesamt = bar + agentFee;
    if (game.money < gesamt) { showToast(`Vereinskonto reicht nicht: ${formatVal(gesamt)} nötig${agentFee > 0 ? ` (inkl. ${formatVal(agentFee)} Beraterprovision)` : ''}, ${formatVal(game.money)} vorhanden.`, 'error', 5000); return false; }
    if (game.transferBudget < budgetBedarf) { showToast(`Transferbudget reicht nicht: ${formatVal(budgetBedarf)} nötig, ${formatVal(game.transferBudget)} verfügbar. Verhandle mit dem Vorstand oder verkaufe erst einen Spieler.`, 'error', 5500); return false; }
    const lohnsumme = squad.reduce((s, pl) => s + pl.wage, 0) - (tausch ? tausch.wage : 0) + (game.secondTeam.isActive ? secondTeamSquad.reduce((s, pl) => s + pl.wage, 0) : 0);
    if (lohnsumme + gehalt > game.wageBudget) { showToast(`Gehaltsbudget reicht nicht: ${formatVal(lohnsumme + gehalt)} nach der Verpflichtung, erlaubt sind ${formatVal(game.wageBudget)}.`, 'error', 5000); return false; }
    playSound('click');
    bucheMitLabel('🛒 Spielerkauf', -gesamt);
    game.transferBudget -= budgetBedarf;
    if (tausch) {
        if (typeof checkFriendshipDeparture === 'function') checkFriendshipDeparture(tausch);
        if (typeof recordNotablePastPlayer === 'function') recordNotablePastPlayer(tausch);
        if (typeof checkCrowdFavoriteDeparture === 'function') checkCrowdFavoriteDeparture(tausch);
        squad = squad.filter(x => x.id !== tausch.id);
        lineup = lineup.filter(x => x !== tausch.id);
        addInboxMessage('transfer', `🔄 Tausch: ${tausch.name} geht zu ${p.sellerClub}`, `${tausch.name} wird mit ${formatVal(anrechnung)} auf die Ablöse für ${p.name} angerechnet - bar gezahlt: ${formatVal(bar)}.`, 'screen-transfer');
    }
    p.wage = gehalt;
    if (typeof stampPlayerJoin === 'function') stampPlayerJoin(p, 'kauf', p.sellerClub, ablose);
    squad.push(p);
    marketPlayers.splice(idx, 1);
    if (transferPoker && transferPoker.playerId === p.id) transferPoker = null;
    showToast(`✅ ${p.name} kommt von ${p.sellerClub || 'seinem Verein'} für ${formatVal(ablose)}${tausch ? ` (davon ${formatVal(anrechnung)} durch ${tausch.name})` : ''}${agentFee > 0 ? ` (+ ${formatVal(agentFee)} Beraterprovision)` : ''}.`, 'success', 4500);
    // Medizincheck (js/medical-check.js): ein verdeckter Befund wird jetzt Wirklichkeit.
    if (typeof applyMedicalOnArrival === 'function') applyMedicalOnArrival(p);
    renderTransferView();
    updateUI();
    return true;
}

function openTransferPoker(idx) {
    const p = marketPlayers[idx];
    if (!p) return;
    if (isTransferEmbargoActive()) { showToast(`🚫 Transfersperre aktiv${game.ffpTransferEmbargo ? ' (Financial Fairplay)' : ' - erst die Zahlungsfähigkeit wiederherstellen (siehe Finanzen)'}.`, 'error', 5000); return; }
    ensureTransferTerms(p);
    if (p.pokerBroken) { showToast(`${p.sellerClub} verhandelt nicht mehr - nur noch der Sofortkauf zur Forderung ist möglich.`, 'error', 4500); return; }
    if (!transferPoker || transferPoker.playerId !== p.id) {
        const begehrt = p.strength >= Math.max(...marketPlayers.map(m => m.strength)) - 3;
        transferPoker = {
            playerId: p.id, rounds: 0, patience: 3 + Math.floor(Math.random() * 3),
            offer: Math.round(p.askingPrice * 0.85 / 1000) * 1000,
            rivalChance: begehrt ? 0.45 : 0.15, rival: null, agreedFee: null, wageDemand: null, wageTalked: false,
            log: [`${p.sellerClub} verlangt ${formatVal(p.askingPrice)} für ${p.name} (Marktwert ${formatVal(p.marketValue)}).`]
        };
    }
    renderTransferPokerBox();
    const box = document.getElementById('transfer-poker-box');
    if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
}

function closeTransferPoker() {
    transferPoker = null;
    renderTransferPokerBox();
}

function getPokerPlayer() {
    return transferPoker ? marketPlayers.find(m => m.id === transferPoker.playerId) || null : null;
}

function adjustPokerOffer(prozent) {
    const p = getPokerPlayer();
    if (!p || transferPoker.agreedFee) return;
    const schritt = Math.max(1000, Math.round(p.marketValue * Math.abs(prozent) / 100 / 1000) * 1000);
    transferPoker.offer = Math.max(1000, transferPoker.offer + Math.sign(prozent) * schritt);
    renderTransferPokerBox();
}

function agreeTransferFee(p, betrag) {
    const t = transferPoker;
    t.agreedFee = betrag;
    const zaehigkeit = POKER_TOUGHNESS[p.character] || 1;
    t.wageDemand = Math.round(p.wage * (1 + (zaehigkeit - 1) * 0.6 + Math.random() * 0.12 + (p.agent ? 0.05 : 0)) / 10) * 10;
    t.log.push(`🤝 Ablöse vereinbart: ${formatVal(betrag)}. ${p.agent ? `Berater ${p.agent.name}` : p.name} fordert ${formatVal(t.wageDemand)} Gehalt pro Spieltag.`);
}

// Rivale: steigt ein, treibt die Schmerzgrenze hoch und schnappt sich den Spieler, wenn man
// zu lange unter seinem Gebot bleibt.
function tickPokerRival(p) {
    const t = transferPoker;
    if (!t.rival && t.rounds >= 1 && Math.random() < t.rivalChance) {
        const vereine = (leaguesData[game.leagueLevel] || []).filter(v => v.name !== p.sellerClub && (typeof isAiClub === 'function' ? isAiClub(v) : v.name !== game.clubName));
        const rivale = vereine.sort((a, b) => b.strength - a.strength)[Math.floor(Math.random() * Math.min(5, vereine.length))];
        const gebot = Math.round(p.sellerMinimum * (1.05 + Math.random() * 0.12) / 1000) * 1000;
        t.rival = { club: rivale ? rivale.name : 'Ein Konkurrent', bid: gebot };
        p.sellerMinimum = gebot + 1000;
        p.askingPrice = Math.max(p.askingPrice, p.sellerMinimum);
        t.log.push(`⚔️ ${t.rival.club} bietet ${formatVal(gebot)} - der Preis zieht an!`);
        return false;
    }
    if (t.rival && t.offer < t.rival.bid && Math.random() < 0.35) {
        const idx = marketPlayers.indexOf(p);
        if (idx !== -1) marketPlayers.splice(idx, 1);
        addInboxMessage('transfer', `⚔️ ${p.name} geht zu ${t.rival.club}`, `Während der Verhandlungen hat ${t.rival.club} ${formatVal(t.rival.bid)} an ${p.sellerClub} gezahlt - ${p.name} ist weg.`, 'screen-transfer');
        if (typeof addAiTransferNews === 'function') addAiTransferNews({ player: p.name, pos: p.pos, strength: p.strength, from: p.sellerClub, to: t.rival.club, fee: t.rival.bid, fromLeague: game.leagueLevel, toLeague: game.leagueLevel });
        showToast(`⚔️ Zu lange gepokert: ${p.name} wechselt zu ${t.rival.club}!`, 'error', 5000);
        transferPoker = null;
        renderTransferView();
        return true;
    }
    return false;
}

function submitPokerOffer() {
    const p = getPokerPlayer();
    const t = transferPoker;
    if (!p || t.agreedFee) return;
    const angebot = t.offer;
    t.rounds++;
    t.log.push(`Dein Angebot: ${formatVal(angebot)}`);
    if (angebot >= p.askingPrice) {
        agreeTransferFee(p, angebot);
    } else if (angebot >= p.sellerMinimum && Math.random() < 0.4 + 0.6 * (angebot - p.sellerMinimum) / Math.max(1, p.askingPrice - p.sellerMinimum)) {
        t.log.push(`${p.sellerClub}: „Einverstanden.“`);
        agreeTransferFee(p, angebot);
    } else {
        const frech = angebot < p.sellerMinimum * 0.75;
        t.patience -= frech ? 2 : 1;
        if (t.patience <= 0) {
            p.pokerBroken = true;
            p.askingPrice = Math.round(p.askingPrice * 1.1 / 1000) * 1000;
            t.log.push(`🚪 ${p.sellerClub} bricht die Gespräche ab. Nur noch Sofortkauf für ${formatVal(p.askingPrice)}.`);
            showToast(`${p.sellerClub} bricht die Verhandlung ab - der Preis steigt auf ${formatVal(p.askingPrice)}.`, 'error', 5000);
            transferPoker = null;
            renderTransferView();
            return;
        }
        // Gegenangebot: der Verkäufer kommt ein Stück entgegen, nie unter die Schmerzgrenze.
        p.askingPrice = Math.max(p.sellerMinimum, Math.round((p.askingPrice - (p.askingPrice - angebot) * (frech ? 0.05 : 0.35)) / 1000) * 1000);
        t.log.push(frech ? `😠 ${p.sellerClub}: „Das ist eine Frechheit.“ Forderung bleibt bei ${formatVal(p.askingPrice)}.` : `${p.sellerClub} kontert: ${formatVal(p.askingPrice)}.`);
        if (tickPokerRival(p)) return;
    }
    renderTransferPokerBox();
}

function acceptPokerAsking() {
    const p = getPokerPlayer();
    if (!p || transferPoker.agreedFee) return;
    transferPoker.rounds++;
    agreeTransferFee(p, p.askingPrice);
    renderTransferPokerBox();
}

// Gehaltsgespräch: einmal nachverhandeln - zähe Charaktere lassen sich selten drücken und
// fordern bei einem Fehlschlag mehr.
function haggleWage() {
    const p = getPokerPlayer();
    const t = transferPoker;
    if (!p || !t.agreedFee || t.wageTalked) return;
    t.wageTalked = true;
    const zaehigkeit = POKER_TOUGHNESS[p.character] || 1;
    if (Math.random() < Math.max(0.15, 0.75 - (zaehigkeit - 0.75) * 0.9)) {
        t.wageDemand = Math.round(t.wageDemand * 0.9 / 10) * 10;
        t.log.push(`💬 ${p.name} akzeptiert ${formatVal(t.wageDemand)} pro Spieltag.`);
    } else {
        t.wageDemand = Math.round(t.wageDemand * 1.05 / 10) * 10;
        t.log.push(`😤 ${p.agent ? p.agent.name : p.name} fühlt sich unterschätzt: jetzt ${formatVal(t.wageDemand)} pro Spieltag.`);
    }
    renderTransferPokerBox();
}

function signPokerDeal() {
    const p = getPokerPlayer();
    const t = transferPoker;
    if (!p || !t.agreedFee) return;
    finalizePlayerPurchase(p, t.agreedFee, t.wageDemand, t.swapId || null);
}

function renderPokerSwapSelect(p, t) {
    const kandidaten = squad.filter(x => isSwapCandidate(x, p)).sort((a, b) => b.marketValue - a.marketValue);
    if (!kandidaten.length) return `<div style="font-size:8px; color:var(--text-muted); margin-bottom:4px;">🔄 Tausch: ${p.sellerClub} nimmt nur gesunde Spieler bis 30 Jahre ab Stärke ${getSwapClubMinimum(p)} - schwächere helfen ihm nicht (und mindestens ${SWAP_MIN_SQUAD + 1} im Kader).</div>`;
    const tausch = t.swapId ? squad.find(x => x.id === t.swapId) : null;
    const wert = tausch ? getSwapValue(tausch, p, t.agreedFee) : 0;
    return `<div style="font-size:9px; margin-bottom:4px;">🔄 Spieler in Zahlung geben: <select onchange="setPokerSwap(this.value)" style="font-size:9px;">
        <option value="">Kein Tausch</option>
        ${kandidaten.map(x => `<option value="${x.id}" ${t.swapId === x.id ? 'selected' : ''}>${x.name} (${x.pos}, ${x.strength}) - ${formatVal(getSwapValue(x, p, t.agreedFee))}</option>`).join('')}
    </select>${tausch ? ` → bar nur noch <strong>${formatVal(t.agreedFee - wert)}</strong>, Transferbudget ${formatVal(t.agreedFee - wert + Math.round(wert * 0.15))} (der Tausch zählt wie ein Verkauf: 85 % fürs Budget, Provision für seinen Berater)` : ''}</div>`;
}

function renderTransferPokerBox() {
    const box = document.getElementById('transfer-poker-box');
    if (!box) return;
    const p = getPokerPlayer();
    if (!p) { box.innerHTML = ''; if (transferPoker) transferPoker = null; return; }
    const t = transferPoker;
    const agentFee = t.agreedFee ? getAgentFee(p, t.agreedFee) : 0;
    const geduld = '🟢'.repeat(Math.max(0, t.patience)) + '⚪'.repeat(Math.max(0, 5 - t.patience));
    box.innerHTML = `<div class="panel" style="border:1px solid var(--accent); margin-bottom:8px;">
        <div class="panel-header" style="color:var(--accent);">🃏 TRANSFERPOKER: ${p.name} (${p.pos}, ${p.strength})</div>
        <div style="font-size:9px; margin-bottom:6px;">Verkäufer: <strong>${p.sellerClub}</strong> · Forderung <strong>${formatVal(p.askingPrice)}</strong> · Marktwert ${formatVal(p.marketValue)} · Vertrag ${p.contracts || 2} J. · Geduld ${geduld}${t.rival ? ` · ⚔️ ${t.rival.club} bietet ${formatVal(t.rival.bid)}` : ''}</div>
        <div style="font-size:9px; max-height:110px; overflow-y:auto; background:rgba(0,0,0,0.15); border-radius:4px; padding:4px; margin-bottom:6px;">${t.log.slice(-6).map(z => `<div>${z}</div>`).join('')}</div>
        ${t.agreedFee ? `
            <div class="box" style="font-size:10px;">Ablöse ${formatVal(t.agreedFee)}${agentFee ? ` + Provision ${formatVal(agentFee)}` : ''} · Gehalt <strong>${formatVal(t.wageDemand)}</strong>/SpT (bisher ${formatVal(p.wage)})</div>
            ${renderPokerSwapSelect(p, t)}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                <button onclick="signPokerDeal()" class="btn-action">✍️ Unterschreiben</button>
                <button onclick="haggleWage()" class="btn-secondary" ${t.wageTalked ? 'disabled' : ''}>💬 Gehalt drücken (-10 %)</button>
                ${typeof getMedicalCheckFee === 'function' ? `<button onclick="runMedicalCheck()" class="btn-secondary" style="grid-column: span 2;" ${p.medical && p.medical.checked ? 'disabled' : ''}>${p.medical && p.medical.checked ? getMedicalTag(p) : `🩺 Medizincheck (${formatVal(getMedicalCheckFee(t.agreedFee))}) - ohne ihn unterschreibst du blind`}</button>` : ''}
                <button onclick="closeTransferPoker()" class="btn-secondary" style="grid-column: span 2;">Abbrechen</button>
            </div>` : `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:6px;">
                <button onclick="adjustPokerOffer(-5)" class="btn-secondary" style="width:auto;">−5 %</button>
                <strong style="font-size:13px;">${formatVal(t.offer)}</strong>
                <button onclick="adjustPokerOffer(5)" class="btn-secondary" style="width:auto;">+5 %</button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                <button onclick="submitPokerOffer()" class="btn-action">📨 Angebot abgeben</button>
                <button onclick="acceptPokerAsking()" class="btn-secondary">Forderung annehmen</button>
                <button onclick="closeTransferPoker()" class="btn-secondary" style="grid-column: span 2;">Abbrechen</button>
            </div>`}
        <div style="font-size:8px; color:var(--text-muted); margin-top:4px;">Unter der Schmerzgrenze sagt der Verein nie zu; sehr niedrige Angebote kosten doppelt Geduld. Bei begehrten Spielern kann ein Rivale mitbieten und den Spieler wegschnappen.</div>
    </div>`;
}
