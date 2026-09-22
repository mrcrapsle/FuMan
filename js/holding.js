
    function renderHoldingView() {
        document.getElementById('holding-balance-val').innerText = formatVal(holdingCompany.money);
        let bList = document.getElementById('b2b-contracts-list');
        bList.innerHTML = '';

        holdingCompany.b2bContracts.forEach(c => {
            let row = document.createElement('div');
            row.className = 'panel';
            let mat = rawMaterials[c.reqMat];
            row.innerHTML = `
                <div class="panel-header"><span>${c.club}: ${c.amount}x ${c.item}</span><strong style="color:var(--primary);">Honorar: +${formatVal(c.payout)}</strong></div>
                <div style="font-size:10px; margin-bottom:4px;">Materialbedarf: ${c.reqQty} kg ${mat.name} (Lager: ${mat.stock} kg)</div>
                <button onclick="completeB2BContract('${c.id}')" class="btn-industry" ${c.done?'disabled':''}>${c.done ? 'Auftrag ausgeliefert ✓' : 'Lohnfertigung produzieren & liefern'}</button>
            `;
            bList.appendChild(row);
        });
    }

    function transferHoldingToClub(amount) {
        if (holdingCompany.money < amount) { showToast(`Holding-Konto reicht nicht: ${formatVal(holdingCompany.money)} von ${formatVal(amount)}.`, 'error', 4500); return; }
        playSound('goal');
        holdingCompany.money -= amount;
        game.money += amount;
        renderHoldingView();
        updateUI();
    }

    function transferHoldingToPrivate(amount) {
        if (holdingCompany.money < amount) { showToast(`Holding-Konto reicht nicht: ${formatVal(holdingCompany.money)} von ${formatVal(amount)}.`, 'error', 4500); return; }
        playSound('goal');
        holdingCompany.money -= amount;
        privateLife.money += amount;
        renderHoldingView();
        updateUI();
    }

    function transferClubToHolding(amount) {
        if (game.money < amount) { showToast(`Vereinskonto reicht nicht: ${formatVal(game.money)} von ${formatVal(amount)}.`, 'error', 4500); return; }
        playSound('click');
        game.money -= amount;
        holdingCompany.money += amount;
        renderHoldingView();
        updateUI();
    }

    function completeB2BContract(contractId) {
        let c = holdingCompany.b2bContracts.find(x => x.id === contractId);
        if (!c || c.done) return;
        let mat = rawMaterials[c.reqMat];

        if (mat.stock < c.reqQty) {
            showToast(`Zu wenig Rohstoff: ${mat.stock} kg ${mat.name} am Lager, ${c.reqQty} kg nötig.`, 'error', 4500);
            return;
        }

        playSound('goal');
        mat.stock -= c.reqQty;
        c.done = true;
        let payout = managerRPG.perks.tycoon ? Math.round(c.payout * 1.25) : c.payout;
        holdingCompany.money += payout;
        addManagerXP(150);
        renderHoldingView();
        updateUI();
    }

