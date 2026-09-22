
    // ==========================================
    // IMMOBILIEN-PORTFOLIO (NEU)
    // ==========================================
    // Der Verein investiert in Immobilien rund ums Stadion, um sich eine zweite,
    // fußballunabhängige Einnahmequelle aufzubauen - je Objekt eine einmalige
    // Kaufsumme, danach laufende Mieteinnahmen pro Heimspiel, ausbaubar in bis zu
    // 3 Stufen (mehr Fläche/mehr Mieter), mit der Möglichkeit, ein Objekt bei Bedarf
    // wieder zu verkaufen (zu einem Abschlag, wie im echten Immobilienmarkt üblich).

    let realEstatePortfolio = {
        parkplatz: { name: "Parkplatz-Gelände", owned: false, lvl: 0, max: 3, baseCost: 700000, baseIncome: 3200, desc: "Vermietete Parkflächen rund ums Stadion - Einnahmen aus Parkgebühren an Spiel- und Nicht-Spieltagen." },
        buerokomplex: { name: "Bürokomplex 'Vereins-Tower'", owned: false, lvl: 0, max: 3, baseCost: 2200000, baseIncome: 9500, desc: "Vermietete Büroflächen an lokale Unternehmen - stabile, planbare Mieteinnahmen." },
        wohnanlage: { name: "Wohnanlage am Stadion", owned: false, lvl: 0, max: 3, baseCost: 3500000, baseIncome: 13000, desc: "Mietwohnungen in Stadionnähe - beliebt bei Fans, die nah am Verein wohnen wollen." },
        einkaufszentrum: { name: "Einkaufszentrum 'Fan-Meile'", owned: false, lvl: 0, max: 3, baseCost: 5000000, baseIncome: 21000, desc: "Ladenflächen für Einzelhandel und Gastronomie - höhere Miete, aber auch höheres Risiko bei schlechter Konjunktur." },
        hotelbeteiligung: { name: "Hotel-Beteiligung", owned: false, lvl: 0, max: 3, baseCost: 6500000, baseIncome: 26000, desc: "Anteile an einem Hotel für Gästefans und Geschäftsreisende - Einnahmen steigen zusätzlich mit der Attraktivität des Vereins." },
        gewerbepark: { name: "Gewerbepark", owned: false, lvl: 0, max: 3, baseCost: 4200000, baseIncome: 17500, desc: "Gemischt genutzter Gewerbepark mit mehreren kleinen Mietern - breit gestreutes, robustes Einkommen." }
    };

    function getRealEstateCost(key) {
        let p = realEstatePortfolio[key];
        let scale = typeof getStadiumCostScale === 'function' ? getStadiumCostScale() : 1;
        return Math.max(200000, Math.round(p.baseCost * (p.lvl + 1) * scale));
    }
    function getRealEstateIncome(key) {
        let p = realEstatePortfolio[key];
        if (!p.owned) return 0;
        let scale = typeof getStadiumCostScale === 'function' ? getStadiumCostScale() : 1;
        let income = Math.round(p.baseIncome * p.lvl * scale);
        // Hotel-Beteiligung profitiert zusätzlich von der Attraktivität des Vereins
        // (Manager-Medienimage und Fan-Zufriedenheit ziehen mehr Gästefans/Besucher an).
        if (key === 'hotelbeteiligung') income = Math.round(income * (1 + ((game.managerMediaImage ?? 50) / 200)));
        return income;
    }

    function buyOrUpgradeRealEstate(key) {
        let p = realEstatePortfolio[key];
        if (p.lvl >= p.max) { showToast('Objekt bereits voll ausgebaut!', 'error'); return; }
        let cost = getRealEstateCost(key);
        // Größere, echte Bauprojekte laufen über dieselbe Baustellen-Logik wie
        // Stadion/Campus - Anzahlung + echte Bauzeit statt Sofort-Kauf.
        if (typeof queueStadiumConstruction === 'function') {
            let label = `${p.owned ? 'Ausbau' : 'Kauf'}: ${p.name} (Stufe ${p.lvl + 1})`;
            queueStadiumConstruction('realEstate', { key }, cost, getConstructionDays(cost), label);
            return;
        }
        if (game.money < cost) return;
        game.money -= cost;
        p.owned = true;
        p.lvl++;
        renderRealEstateView();
        updateUI();
    }

    function sellRealEstate(key, btn) {
        let p = realEstatePortfolio[key];
        if (!p.owned) return;
        // Verkauf zu 55% des ursprünglichen Investitionswerts (Marktabschlag), wie bei
        // echten Immobilienverkäufen unter Zeitdruck üblich.
        let refund = Math.round(getRealEstateCost(key) === 0 ? 0 : (p.baseCost * p.lvl * getStadiumCostScale() * 0.55));
        // Das letzte verbliebene window.confirm() im Spiel - in manchen Android-WebViews
        // unterdrueckt, der Verkauf waere dort entweder ungefragt durchgelaufen oder gar
        // nicht. Jetzt dieselbe Zwei-Klick-Bestaetigung wie bei allen anderen folgenreichen
        // Aktionen.
        if (!requireConfirm(btn, `Wirklich für ${formatVal(refund)} verkaufen?`)) return;
        game.money += refund;
        p.owned = false;
        p.lvl = 0;
        showToast(`🏢 ${p.name} verkauft (+${formatVal(refund)})`, 'success');
        renderRealEstateView();
        updateUI();
    }

    // Wird jeden Spieltag aufgerufen: zahlt die Mieteinnahmen aller Immobilien im
    // Portfolio aus (unabhängig von Heim-/Auswärtsspiel - Mieteinnahmen sind kein
    // Spieltagsgeschäft, sondern laufen kontinuierlich).
    function tickRealEstateIncome() {
        let total = 0;
        Object.keys(realEstatePortfolio).forEach(key => { total += getRealEstateIncome(key); });
        if (total > 0) game.money += total;
        return total;
    }

    function renderRealEstateView() {
        let box = document.getElementById('real-estate-list');
        if (!box) return;
        let totalIncome = 0;
        box.innerHTML = Object.keys(realEstatePortfolio).map(key => {
            let p = realEstatePortfolio[key];
            let cost = getRealEstateCost(key);
            let income = getRealEstateIncome(key);
            totalIncome += income;
            let queued = (game.stadiumConstructionQueue || []).find(q => q.type === 'realEstate' && q.params.key === key);
            let buttonHtml = p.lvl >= p.max
                ? '<button class="btn-action" disabled>Voll ausgebaut ✓</button>'
                : queued
                    ? `<button class="btn-secondary" disabled>🏗️ Im Bau... (noch ${queued.daysLeft} SpT)</button>`
                    : `<button onclick="buyOrUpgradeRealEstate('${key}')" class="btn-action">${p.owned ? `Ausbauen auf Stufe ${p.lvl+1}` : 'Kaufen'} [${formatVal(cost)}] · Bauzeit ${getConstructionDays(cost)} SpT</button>`;
            return `
                <div class="panel">
                    <div class="panel-header"><span>${p.name}</span><span style="color:var(--accent);">Stufe ${p.lvl}/${p.max}</span></div>
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">${p.desc}</div>
                    ${p.owned ? `<div class="box" style="font-size:10px; margin-bottom:4px;">💰 Laufende Mieteinnahmen: <strong style="color:var(--gold);">+${formatVal(income)}</strong> pro Spieltag</div>` : ''}
                    ${buttonHtml}
                    ${p.owned ? `<button onclick="sellRealEstate('${key}', this)" class="btn-secondary" style="margin-top:4px; font-size:9px;">Verkaufen (55% Rückerstattung)</button>` : ''}
                </div>
            `;
        }).join('');
        let summaryBox = document.getElementById('real-estate-summary');
        if (summaryBox) {
            let ownedCount = Object.values(realEstatePortfolio).filter(p => p.owned).length;
            summaryBox.innerHTML = `<div class="box" style="font-size:10px;">🏢 <strong>${ownedCount}</strong> Objekte im Portfolio · Gesamteinnahmen: <strong style="color:var(--gold);">+${formatVal(totalIncome)}</strong> pro Spieltag</div>`;
        }
    }

