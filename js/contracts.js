
    // ==========================================
    // SAISONPLANUNG-ÜBERSICHT (NEU)
    // ==========================================
    // Zeigt auf einen Blick, wer wirklich für die kommende Saison zur Verfügung steht: welche
    // Verträge bald auslaufen, wer zurück zum Leihverein muss, und wo eine Entscheidung ansteht.
    function renderSeasonPlanningBox() {
        let box = document.getElementById('season-planning-box');
        if (!box) return;
        let urgent = squad.filter(p => p.contracts <= 1).sort((a, b) => a.contracts - b.contracts);
        let soon = squad.filter(p => p.contracts === 2);
        let safe = squad.filter(p => p.contracts >= 3);
        let returningLoans = (typeof incomingLoans !== 'undefined' ? incomingLoans : []).map(l => {
            let p = squad.find(x => x.id === l.playerId);
            return p ? { name: p.name, matchdaysLeft: l.matchdaysLeft, buyOptionFee: l.buyOptionFee } : null;
        }).filter(Boolean);

        box.innerHTML = `
            <div class="box" style="font-size:10px; margin-bottom:6px;">
                📋 <strong>${urgent.length}</strong> Verträge laufen bald aus · <strong>${returningLoans.length}</strong> Leihspieler kehren ggf. zurück · <strong>${safe.length}</strong> Verträge langfristig gesichert
            </div>
            ${urgent.length > 0 ? `
                <div style="font-size:9px; font-weight:800; color:var(--danger); margin:6px 0 3px;">🔴 DRINGEND - VERTRAG LÄUFT AUS (0-1 JAHR)</div>
                ${urgent.map(p => `<div class="box" style="font-size:9px; border-left-color:var(--danger); display:flex; justify-content:space-between;"><span>${p.name} (${p.pos}, Str ${p.strength})</span><span>${p.contracts === 0 ? 'Läuft diese Saison aus!' : '1 Jahr Rest'}</span></div>`).join('')}
            ` : ''}
            ${soon.length > 0 ? `
                <div style="font-size:9px; font-weight:800; color:var(--accent); margin:6px 0 3px;">🟡 BALD PLANEN (2 JAHRE REST)</div>
                ${soon.map(p => `<div class="box" style="font-size:9px; border-left-color:var(--accent); display:flex; justify-content:space-between;"><span>${p.name} (${p.pos})</span><span>2 Jahre Rest</span></div>`).join('')}
            ` : ''}
            ${returningLoans.length > 0 ? `
                <div style="font-size:9px; font-weight:800; color:var(--blue); margin:6px 0 3px;">📋 LEIHSPIELER - RÜCKKEHR ODER KAUFOPTION</div>
                ${returningLoans.map(l => `<div class="box" style="font-size:9px; border-left-color:var(--blue); display:flex; justify-content:space-between;"><span>${l.name}</span><span>noch ${l.matchdaysLeft} SpT · Kaufoption ${formatVal(l.buyOptionFee)}</span></div>`).join('')}
            ` : ''}
        `;
    }

    function renderContractsView() {
        renderSeasonPlanningBox();
        let list = document.getElementById('contracts-list');
        list.innerHTML = '';
        squad.forEach(p => {
            let baseFee = Math.max(1500, Math.round(p.marketValue * 0.05));
            if (staffMembers.sportDir.hired) baseFee = Math.round(baseFee * 0.8);
            let agentFee = getAgentFee(p, baseFee);
            let isNegotiating = pendingContractNegotiation && pendingContractNegotiation.playerId === p.id;
            let feeDisplay = isNegotiating ? pendingContractNegotiation.counterFee : (baseFee + agentFee);
            let row = document.createElement('div');
            row.className = 'panel';
            row.style.cssText = 'margin-bottom:4px; padding:6px;';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="display:flex; align-items:center; gap:6px;">${typeof renderPlayerAvatarTag === 'function' ? renderPlayerAvatarTag(p, 28) : ''}${p.name} (${p.contracts} J. Rest)${p.agent ? ` <span class="badge badge-trait" title="${p.agent.name}">🕴️ Berater</span>` : ''}</span>
                    <button onclick="extendContract('${p.id}')" class="btn-secondary" style="width:auto;">+1 J. [${formatVal(feeDisplay)}]</button>
                </div>
                ${isNegotiating ? `<div class="box" style="font-size:9px; margin-top:4px; border-left-color:var(--danger);">💬 ${p.name} verlangt mehr! <button onclick="rejectContractCounter()" class="btn-secondary" style="width:auto; font-size:8px; margin-left:4px;">Ablehnen</button></div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:9px; flex-wrap:wrap; gap:3px;">
                    ${p.releaseClause
                        ? `<span>📜 Ausstiegsklausel: <strong style="color:var(--accent);">${formatVal(p.releaseClause)}</strong></span><button onclick="removeReleaseClause('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">Entfernen</button>`
                        : `<span style="color:var(--text-muted);">Keine Ausstiegsklausel</span>
                           <input type="number" id="release-clause-input-${p.id}" placeholder="mind. ${formatVal(Math.round(p.marketValue * 1.1))}" class="input-inline" style="width:110px; font-size:8px;">
                           <button onclick="confirmSetReleaseClause('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">📜 Klausel festlegen</button>`
                    }
                </div>
                ${(typeof renderBonusClausesBlock === 'function') ? renderBonusClausesBlock(p) : ''}
            `;
            list.appendChild(row);
        });
    }

    // Verhandlungs-Zähigkeit auch bei bestehenden Verträgen (NEU): analog zur Logik bei
    // Neuverpflichtungen (siehe CHARACTER_TOUGHNESS in transfermarket.js) - ein etablierter,
    // ehrgeiziger Stammspieler lässt sich bei einer Vertragsverlängerung nicht einfach mit
    // dem ersten Angebot abspeisen, sondern fordert manchmal gezielt nach.
    let pendingContractNegotiation = null;
    function extendContract(id) {
        let p = squad.find(x => x.id === id);
        if (!p) return;
        let baseFee = Math.max(1500, Math.round(p.marketValue * 0.05));
        if (staffMembers.sportDir.hired) baseFee = Math.round(baseFee * 0.8);
        let toughness = (typeof CHARACTER_TOUGHNESS !== 'undefined' && CHARACTER_TOUGHNESS[p.character]) || 1.0;
        if (!pendingContractNegotiation || pendingContractNegotiation.playerId !== id) {
            // Nur etablierte Spieler (Stärke 55+) sind selbstbewusst genug, um nachzuverhandeln -
            // ein junger Ergänzungsspieler ist froh über jedes Angebot.
            let counterChance = p.strength >= 55 ? Math.min(0.6, 0.2 * toughness) : 0;
            if (Math.random() < counterChance) {
                let counterFee = Math.round(baseFee * (1.2 + (toughness - 1) * 0.3));
                pendingContractNegotiation = { playerId: id, counterFee };
                showToast(`💬 ${p.name} verlangt für die Verlängerung ${formatVal(counterFee)} statt ${formatVal(baseFee)}! Nochmal klicken zum Akzeptieren.`, 'error');
                renderContractsView();
                return;
            }
        }
        let finalBaseFee = (pendingContractNegotiation && pendingContractNegotiation.playerId === id) ? pendingContractNegotiation.counterFee : baseFee;
        let agentFee = getAgentFee(p, finalBaseFee);
        let totalFee = finalBaseFee + agentFee;
        if (game.money < totalFee) return;
        playSound('click');
        game.money -= totalFee;
        p.contracts++;
        pendingContractNegotiation = null;
        if (agentFee > 0) showToast(`✅ Vertrag verlängert (inkl. ${formatVal(agentFee)} Beraterprovision an ${p.agent.name}).`, 'success');
        else showToast(`✅ Vertrag mit ${p.name} verlängert!`, 'success');
        renderContractsView();
        updateUI();
    }
    function rejectContractCounter() {
        pendingContractNegotiation = null;
        showToast('Verhandlung abgebrochen.', 'success');
        renderContractsView();
    }

    // ==========================================
    // AUSSTIEGSKLAUSEL (NEU)
    // ==========================================
    // Eine feste Ablösesumme, ab der jeder interessierte Verein den Spieler sofort und ohne
    // Verhandlung abwerben kann - wie im echten Fußball üblich. Eine niedrige Klausel macht
    // den Spieler zufriedener (Sicherheit für seine Karriere), erhöht aber das Risiko eines
    // plötzlichen Abgangs zu einem für dich möglicherweise ungünstigen Preis.
    function confirmSetReleaseClause(playerId) {
        let input = document.getElementById(`release-clause-input-${playerId}`);
        let amount = parseInt(input ? input.value : '');
        if (isNaN(amount)) { showToast('Ungültiger Betrag!', 'error'); return; }
        setReleaseClause(playerId, amount);
    }
    function setReleaseClause(playerId, amount) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return;
        let minClause = Math.round(p.marketValue * 1.1);
        if (amount < minClause) { showToast(`Mindestbetrag: ${formatVal(minClause)} (110% des Marktwerts)!`, 'error'); return; }
        p.releaseClause = amount;
        // Eine niedrigere Klausel (näher am Marktwert) macht den Spieler zufriedener, eine
        // hohe (deutlich über Marktwert) wirkt sich neutral aus - realistisches Trade-off.
        let clauseRatio = amount / p.marketValue;
        if (clauseRatio <= 1.3) p.morale = Math.min(100, p.morale + 6);
        showToast(`📜 Ausstiegsklausel für ${p.name} auf ${formatVal(amount)} festgelegt.`, 'success');
        renderContractsView();
    }
    function removeReleaseClause(playerId) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return;
        p.releaseClause = null;
        showToast(`📜 Ausstiegsklausel für ${p.name} entfernt.`, 'success');
        renderContractsView();
    }
    // Wird jeden Spieltag geprüft: löst ein rivalisierender Verein die Klausel aus, verlässt
    // der Spieler sofort den Kader - sofortige, ungebremste Zahlung ohne Verhandlungsspielraum.
    function checkReleaseClauseTriggers() {
        squad.filter(p => p.releaseClause && p.releaseClause > 0).forEach(p => {
            // Höhere Stärke = attraktiver für Rivalen, aber auch höhere Klausel = seltener ausgelöst.
            let baseChance = 0.008 * (p.strength / 60);
            let clauseRatio = p.releaseClause / p.marketValue;
            let chance = baseChance / Math.max(1, clauseRatio - 0.8);
            if (Math.random() < chance) {
                let buyerClub = (typeof INTERNATIONAL_CLUB_NAMES !== 'undefined' && INTERNATIONAL_CLUB_NAMES.length > 0)
                    ? INTERNATIONAL_CLUB_NAMES[Math.floor(Math.random() * INTERNATIONAL_CLUB_NAMES.length)]
                    : 'Ein Rivale';
                let payout = p.releaseClause;
                game.money += payout;
                if (typeof checkCrowdFavoriteDeparture === 'function') checkCrowdFavoriteDeparture(p);
                squad = squad.filter(x => x.id !== p.id);
                addInboxMessage('vertrag', `📜 Ausstiegsklausel ausgelöst: ${p.name}!`, `${buyerClub} hat die Ausstiegsklausel von ${p.name} gezogen und sofort ${formatVal(payout)} überwiesen - der Spieler verlässt den Verein augenblicklich.`, 'screen-squad');
                showToast(`📜 ${p.name} wurde per Ausstiegsklausel abgeworben! (+${formatVal(payout)})`, 'error');
            }
        });
    }

