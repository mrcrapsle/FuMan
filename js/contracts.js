    function renderContractsView() {
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
                    <span>${p.name} (${p.contracts} J. Rest)${p.agent ? ` <span class="badge badge-trait" title="${p.agent.name}">🕴️ Berater</span>` : ''}</span>
                    <button onclick="extendContract('${p.id}')" class="btn-secondary" style="width:auto;">+1 J. [${formatVal(feeDisplay)}]</button>
                </div>
                ${isNegotiating ? `<div class="box" style="font-size:9px; margin-top:4px; border-left-color:var(--danger);">💬 ${p.name} verlangt mehr! <button onclick="rejectContractCounter()" class="btn-secondary" style="width:auto; font-size:8px; margin-left:4px;">Ablehnen</button></div>` : ''}
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
