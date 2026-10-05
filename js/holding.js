
    // Betriebswert der Holding: Grundwert plus 80 % der in Fabriken gesteckten Summe (Kauf
    // cost, Ausbau auf Stufe k je cost*k). Vorher ein fester Wert von 125.000 €, den kein
    // Fabrikkauf änderte - Übernahmeangebote lagen weit unter der Investition.
    function getHoldingValuation() {
        const investiert = Object.values(factories).filter(f => f.owned).reduce((s, f) => s + f.cost * (f.lvl * (f.lvl + 1) / 2), 0);
        return Math.round(50000 + investiert * 0.8);
    }

    function renderHoldingView() {
        let wertEl = document.getElementById('holding-enterprise-val');
        if (wertEl) wertEl.innerText = formatVal(getHoldingValuation());
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
        if (!holdingCompany.b2bContracts.some(c => !c.done)) {
            bList.insertAdjacentHTML('beforeend', `<div class="box" style="font-size:10px; color:var(--text-muted);">Keine offenen Aufträge. Neue kommen zum Saisonstart - je eigener Fabrik einer für ihr Produkt (Honorar etwa dreifache Materialkosten).</div>`);
        }
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

    // Neue Lohnfertigungs-Aufträge zum Saisonstart (Phase 21.5): vorher gab es nur die drei
    // Startaufträge für die ganze Karriere. Jetzt je eigener Fabrik ein Auftrag für ihr
    // Produkt; Honorar = dreifache Materialkosten, je Ausbaustufe +10 %.
    const B2B_FACTORY_MATERIAL = { textile: 'cotton', knitting: 'wool', leatherShop: 'leather', plastics: 'plastic' };
    function refreshB2BContracts() {
        holdingCompany.b2bContracts = (holdingCompany.b2bContracts || []).filter(c => !c.done);
        Object.keys(factories).forEach(k => {
            const f = factories[k], matKey = B2B_FACTORY_MATERIAL[k], mat = rawMaterials[matKey];
            if (!f.owned || !mat || holdingCompany.b2bContracts.some(c => c.factory === k)) return;
            const qty = 400 + f.lvl * 200;
            holdingCompany.b2bContracts.push({
                id: 'b2b' + Math.random().toString(36).substr(2, 7), factory: k,
                club: INTERNATIONAL_CLUB_NAMES[Math.floor(Math.random() * INTERNATIONAL_CLUB_NAMES.length)],
                item: f.product, amount: qty * 2, reqMat: matKey, reqQty: qty,
                payout: Math.round(qty * mat.basePrice * 3 * (1 + 0.1 * f.lvl) / 1000) * 1000, done: false
            });
        });
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

