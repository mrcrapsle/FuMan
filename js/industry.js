    function renderIndustryView() {
        document.getElementById('ind-holding-money').innerText = formatVal(holdingCompany.money);
        renderProductionQueueBox();
        let grid = document.getElementById('factories-grid');
        grid.innerHTML = '';

        for (let k in factories) {
            let f = factories[k];
            let card = document.createElement('div');
            card.className = 'panel';
            card.innerHTML = `
                <div class="panel-header" style="color:var(--industry);">
                    <span>${f.name}</span>
                    <span>${f.owned ? `<strong style="color:var(--primary);">Stufe ${f.lvl}</strong>` : '<span style="color:#aaa;">Nicht im Besitz</span>'}</span>
                </div>
                <div style="font-size:10px; color:#aaa; margin-bottom:4px;">${f.desc}${f.owned ? ` · Produktionsdauer: ${getProductionDuration(k)} SpT` : ''}</div>
                ${f.owned ? 
                    `<button onclick="upgradeFactory('${k}')" class="btn-industry" ${f.lvl>=f.max?'disabled':''}>${f.lvl>=f.max?'Maximalstufe ✓':`Fabrik ausbauen (Stufe ${f.lvl+1}) [${formatVal(f.cost*(f.lvl+1))}]`}</button>
                     <button onclick="mergeFactoryWithCompetitor('${k}')" class="btn-secondary" style="margin-top:4px;">🤝 Mit Konkurrent fusionieren [${formatVal(f.cost*1.5)}]</button>` : 
                    `<button onclick="buyFactory('${k}')" class="btn-action">🏭 Fabrik kaufen [${formatVal(f.cost)}]</button>`
                }
            `;
            grid.appendChild(card);
        }

        let recList = document.getElementById('production-recipes-list');
        recList.innerHTML = '';
        for (let mKey in merchandise) {
            let m = merchandise[mKey];
            let f = factories[m.factory];
            let mat = rawMaterials[m.reqMat];
            let duration = f.owned ? getProductionDuration(m.factory) : null;

            let row = document.createElement('div');
            row.className = 'panel';
            row.innerHTML = `
                <div class="panel-header"><span>${m.name}</span><span style="color:var(--primary);">${m.stock} Stk. am Lager</span></div>
                <div style="font-size:10px; margin-bottom:4px;">
                    Bedarf: <strong>${m.reqQty} kg ${mat.name}</strong> pro Stück (Börsenwert: ~${(mat.currentPrice * m.reqQty).toFixed(2)} €)<br>
                    Produktionsstatus: ${f.owned ? `<strong style="color:var(--primary);">Fabrik einsatzbereit ✓ (Dauer: ${duration} SpT)</strong>` : '<span style="color:var(--danger);">Fabrik fehlt!</span>'}
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                    <button onclick="startProduction('${mKey}', 250)" class="btn-industry" ${!f.owned?'disabled':''}>250 Stk. in Auftrag geben (${250*m.reqQty} kg)</button>
                    <button onclick="startProduction('${mKey}', 1000)" class="btn-industry" ${!f.owned?'disabled':''}>1.000 Stk. in Auftrag geben (${1000*m.reqQty} kg)</button>
                </div>
            `;
            recList.appendChild(row);
        }
    }

    function buyFactory(key) {
        let f = factories[key];
        if (holdingCompany.money < f.cost) { alert("Nicht genug Geld auf dem Holding-Konto!"); return; }
        playSound('goal');
        holdingCompany.money -= f.cost;
        f.owned = true;
        renderIndustryView();
        updateUI();
    }

    function upgradeFactory(key) {
        let f = factories[key];
        let cost = f.cost * (f.lvl + 1);
        if (holdingCompany.money < cost || f.lvl >= f.max) return;
        playSound('goal');
        holdingCompany.money -= cost;
        f.lvl++;
        renderIndustryView();
        updateUI();
    }

    // Produktionsketten-Logik mit echtem Countdown (NEU): Rohstoffe werden sofort verbraucht,
    // die fertige Ware erscheint aber erst nach einer Produktionsdauer, die von der
    // Fabrik-Ausbaustufe abhängt (höhere Stufe = schnellere Produktion). Bisher wurde die
    // Ware sofort und ohne jede Verzögerung "hergestellt", was den Sinn einer Fabrik
    // eigentlich unterlief.
    function getProductionDuration(factoryKey) {
        let f = factories[factoryKey];
        return Math.max(1, 4 - Math.floor((f.lvl - 1) * 0.7)); // Stufe 1: 4 SpT, Stufe 5: 1 SpT
    }
    function startProduction(merchKey, amount) {
        let m = merchandise[merchKey];
        let f = factories[m.factory];
        let mat = rawMaterials[m.reqMat];
        let reqTotal = m.reqQty * amount;

        if (!f.owned) { alert("Du benötigst erst die passende Fabrik für diesen Artikel!"); return; }
        if (mat.stock < reqTotal) { alert(`Nicht genügend Rohstoffe am Lager! Du benötigst ${reqTotal} kg ${mat.name}.`); return; }

        playSound('click');
        mat.stock -= reqTotal;
        let duration = getProductionDuration(m.factory);
        productionQueue.push({ merchKey, amount, matchdaysLeft: duration, totalMatchdays: duration, materialUsed: reqTotal, materialName: mat.name });
        renderIndustryView();
        updateUI();
        alert(`⚙️ Produktion gestartet!\n${amount}x ${m.name} - fertig in ${duration} Spieltagen.\n-${reqTotal} kg ${mat.name} sofort verbraucht.`);
    }
    // Wird jeden Spieltag aufgerufen: zählt alle laufenden Produktionsaufträge herunter und
    // schließt fertige Chargen ab.
    function tickProductionQueue() {
        if (!productionQueue || productionQueue.length === 0) return;
        let stillRunning = [];
        productionQueue.forEach(order => {
            order.matchdaysLeft--;
            if (order.matchdaysLeft <= 0) {
                let m = merchandise[order.merchKey];
                if (m) {
                    m.stock += order.amount;
                    addInboxMessage('vertrag', `⚙️ Produktion abgeschlossen!`, `${order.amount}x ${m.name} sind fertig produziert und liegen jetzt im Fanshop-Lager bereit.`, 'screen-industry');
                }
            } else {
                stillRunning.push(order);
            }
        });
        productionQueue = stillRunning;
    }
    function renderProductionQueueBox() {
        let box = document.getElementById('production-queue-box');
        if (!box) return;
        if (!productionQueue || productionQueue.length === 0) {
            box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Keine laufenden Produktionsaufträge.</div>';
            return;
        }
        // Deutlich sichtbarere grafische Countdown-Anzeige (NEU): große Tage-Zahl links,
        // einzelne Tages-Segmente statt nur ein dünner Balken - auf einen Blick erkennbar,
        // wie viele Spieltage noch verbleiben, statt nur Fließtext lesen zu müssen.
        box.innerHTML = productionQueue.map(order => {
            let m = merchandise[order.merchKey];
            let segments = Array.from({ length: order.totalMatchdays }, (_, i) => i < (order.totalMatchdays - order.matchdaysLeft));
            return `<div class="box" style="display:flex; align-items:center; gap:10px; padding:8px;">
                <div style="min-width:44px; text-align:center;">
                    <div style="font-size:22px; font-weight:900; color:var(--industry); line-height:1;">${order.matchdaysLeft}</div>
                    <div style="font-size:8px; color:var(--text-muted); text-transform:uppercase;">SpT übrig</div>
                </div>
                <div style="flex:1;">
                    <div style="font-size:10px; margin-bottom:4px;">⚙️ ${order.amount}x ${m ? m.name : order.merchKey}</div>
                    <div style="display:flex; gap:3px;">
                        ${segments.map(done => `<div style="flex:1; height:14px; border-radius:3px; background:${done ? 'var(--industry)' : 'rgba(228,197,140,0.15)'}; border:1px solid ${done ? 'var(--industry)' : 'rgba(228,197,140,0.3)'};"></div>`).join('')}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function renderRawMaterialsView() {
        document.getElementById('raw-wh-level').innerText = `${rawMaterials.warehouseLevel} / 5 (${rawMaterials.totalStock.toLocaleString()} / ${rawMaterials.capacity.toLocaleString()} kg)`;
        let newsEl = document.getElementById('raw-market-news');
        if (newsEl) newsEl.innerHTML = `📢 <strong>Börsen-Ticker:</strong> ${rawMaterials.activeMarketEvent}`;

        let grid = document.getElementById('raw-materials-grid');
        grid.innerHTML = '';

        for (let k in rawMaterials) {
            if (k === 'warehouseLevel' || k === 'capacity' || k === 'totalStock' || k === 'activeMarketEvent' || k === 'competitorFirms' || k === 'acquisitionOffers') continue;
            let r = rawMaterials[k];
            let deltaClass = r.delta > 0 ? 'var(--danger)' : (r.delta < 0 ? 'var(--primary)' : 'var(--text-muted)');
            let deltaIcon = r.delta > 0 ? '🔺 +' : (r.delta < 0 ? '🔻 ' : '➖ ');

            let card = document.createElement('div');
            card.className = 'panel';
            card.innerHTML = `
                <div class="panel-header">
                    <span>${r.name}</span>
                    <strong style="color:var(--primary);">${r.stock.toLocaleString()} ${r.unit}</strong>
                </div>
                <div style="font-size:11px; margin-bottom:4px;">
                    Aktueller Börsenkurs: <strong>${r.currentPrice.toFixed(2)} € / kg</strong> 
                    <span style="color:${deltaClass}; font-size:9px; font-weight:bold;">(${deltaIcon}${r.delta.toFixed(2)} €)</span>
                </div>
                <div style="font-size:9px; color:#aaa; margin-bottom:6px;">Basispreis: ${r.basePrice.toFixed(2)} € | Spanne: ${r.minPrice.toFixed(2)} - ${r.maxPrice.toFixed(2)} €</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                    <button onclick="buyRawMaterial('${k}', 500)" class="btn-secondary">+500 kg [${formatVal(Math.round(r.currentPrice * 500))}]</button>
                    <button onclick="buyRawMaterial('${k}', 2000)" class="btn-secondary">+2.000 kg [${formatVal(Math.round(r.currentPrice * 2000))}]</button>
                </div>
            `;
            grid.appendChild(card);
        }

        // Konkurrenzfirmen & Übernahmeangebote (NEU)
        let competitorBox = document.getElementById('competitor-firms-box');
        if (competitorBox) {
            competitorBox.innerHTML = rawMaterials.competitorFirms.map(f => `<div class="box" style="font-size:10px;"><strong>${f.name}</strong> · Marktmacht: ${f.strength}${f.lastAction ? ` · <span style="color:var(--text-muted);">${f.lastAction}</span>` : ''}</div>`).join('');
        }
        let acqBox = document.getElementById('acquisition-offer-box');
        if (acqBox) {
            let offer = rawMaterials.acquisitionOffers[0];
            acqBox.style.display = offer ? 'block' : 'none';
            if (offer) {
                acqBox.innerHTML = `<div class="panel-header" style="color:var(--accent);">💼 ÜBERNAHMEANGEBOT</div>
                    <div class="box" style="font-size:10px;">${offer.firm} bietet <strong>${formatVal(offer.offer)}</strong> für die komplette Holding (noch ${offer.expiresMatchday - game.matchday} Spieltage gültig).</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button onclick="resolveAcquisitionOffer(true)" class="btn-action">✅ Annehmen</button>
                        <button onclick="resolveAcquisitionOffer(false)" class="btn-secondary">❌ Ablehnen</button>
                    </div>`;
            }
        }
    }

    function buyRawMaterial(matKey, amount) {
        let r = rawMaterials[matKey];
        let cost = Math.round(r.currentPrice * amount);

        if (rawMaterials.totalStock + amount > rawMaterials.capacity) {
            alert(`Lagerkapazität erschöpft! Baue dein Zentrallager weiter aus.`);
            return;
        }
        if (holdingCompany.money < cost) {
            alert("Nicht genug Geld auf dem Holding-Konto!");
            return;
        }

        playSound('click');
        holdingCompany.money -= cost;
        r.stock += amount;
        renderRawMaterialsView();
        updateUI();
    }

    function upgradeWarehouse() {
        if (rawMaterials.warehouseLevel >= 5) { alert("Zentrallager ist bereits voll ausgebaut!"); return; }
        if (holdingCompany.money < 30000) { alert("Nicht genug Holding-Kapital (30.000 € benötigt)!"); return; }

        playSound('goal');
        holdingCompany.money -= 30000;
        rawMaterials.warehouseLevel++;
        renderRawMaterialsView();
        updateUI();
        alert(`📦 Zentrallager erweitert! Maximale Lagerkapazität: ${rawMaterials.capacity.toLocaleString()} kg.`);
    }

    // ==========================================
    // HOLDING & INDUSTRIE: NEUE FUNKTIONEN
    // ==========================================

    // 1. Echte Marktpreis-Schwankungen: bisher war "delta" nur eine einmalige Zahl beim
    // Spielstart, der Preis änderte sich NIE tatsächlich, obwohl die Anzeige eine laufende
    // Schwankung suggerierte. Jetzt bewegt sich jeder Rohstoffpreis jeden Spieltag echt.
    const MARKET_EVENTS = [
        "Stabile Weltmärkte - keine besonderen Vorkommnisse.",
        "📈 Rohstoffknappheit durch Lieferengpässe treibt die Preise!",
        "📉 Überangebot am Weltmarkt drückt die Preise.",
        "🌍 Handelsabkommen sorgt für günstigere Importe.",
        "⚡ Energiepreiskrise verteuert die Produktion weltweit.",
        "🚢 Störungen in globalen Lieferketten sorgen für Nervosität."
    ];
    function tickRawMaterialPrices() {
        let eventRoll = Math.random();
        if (eventRoll < 0.15) rawMaterials.activeMarketEvent = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
        let eventBias = rawMaterials.activeMarketEvent.includes('📈') ? 1 : (rawMaterials.activeMarketEvent.includes('📉') ? -1 : 0);
        ['cotton', 'wool', 'leather', 'plastic'].forEach(key => {
            let m = rawMaterials[key];
            let swing = (Math.random() - 0.5) * (m.basePrice * 0.08) + eventBias * (m.basePrice * 0.03);
            let newPrice = Math.max(m.minPrice, Math.min(m.maxPrice, m.currentPrice + swing));
            m.delta = +(newPrice - m.currentPrice).toFixed(2);
            m.currentPrice = +newPrice.toFixed(2);
        });
    }

    // 2. Konkurrenzfirmen: eigenständige Marktteilnehmer, die gelegentlich handeln und
    // gelegentlich sogar ein Übernahmeangebot für die eigene Holding unterbreiten können.
    function tickCompetitorFirms() {
        rawMaterials.competitorFirms.forEach(firm => {
            firm.strength = Math.max(30, Math.min(95, firm.strength + Math.floor(Math.random() * 7 - 3)));
            if (Math.random() < 0.08) {
                let actions = ['expandiert aggressiv', 'kämpft mit Lieferproblemen', 'senkt die Preise stark', 'meldet Rekordgewinne'];
                firm.lastAction = actions[Math.floor(Math.random() * actions.length)];
            }
        });
        let dominant = rawMaterials.competitorFirms.find(f => f.strength >= 85);
        if (dominant && rawMaterials.acquisitionOffers.length === 0 && Math.random() < 0.05) {
            let offer = Math.round(holdingCompany.valuation * (1.1 + Math.random() * 0.3));
            rawMaterials.acquisitionOffers.push({ firm: dominant.name, offer, expiresMatchday: game.matchday + 5 });
            addInboxMessage('finanzen', `💼 Übernahmeangebot von ${dominant.name}!`, `${dominant.name} bietet ${formatVal(offer)} für deine komplette Holding-Gesellschaft. Angebot gültig für 5 Spieltage (Industrie-Screen).`, 'screen-industry');
        }
    }
    function resolveAcquisitionOffer(accept) {
        let offer = rawMaterials.acquisitionOffers[0];
        if (!offer) return;
        if (accept) {
            game.money += offer.offer;
            for (let k in factories) { factories[k].owned = false; factories[k].lvl = 1; }
            holdingCompany.valuation = 50000;
            addInboxMessage('finanzen', '💼 Holding verkauft!', `Die Holding-Gesellschaft wurde für ${formatVal(offer.offer)} an ${offer.firm} verkauft. Ein neuer Anfang in der Industrie ist jederzeit möglich.`, 'screen-industry');
            showToast(`💼 Holding für ${formatVal(offer.offer)} verkauft!`, 'success');
        } else {
            showToast('Übernahmeangebot abgelehnt.', 'success');
        }
        rawMaterials.acquisitionOffers.shift();
        renderIndustryView();
        updateUI();
    }
    function tickAcquisitionOfferExpiry() {
        rawMaterials.acquisitionOffers = rawMaterials.acquisitionOffers.filter(o => o.expiresMatchday >= game.matchday);
    }

    // 3. Fusion: eigene Fabrik mit einem schwachen Konkurrenten fusionieren - kostet Geld,
    // gibt aber einen dauerhaften Produktionsbonus (repräsentiert übernommenes Know-how).
    function mergeFactoryWithCompetitor(factoryKey) {
        let f = factories[factoryKey];
        if (!f.owned) { showToast('Diese Fabrik gehört dir noch nicht!', 'error'); return; }
        let weakFirm = rawMaterials.competitorFirms.find(c => c.strength < 50);
        if (!weakFirm) { showToast('Aktuell kein fusionswilliger schwacher Konkurrent am Markt!', 'error'); return; }
        let cost = f.cost * 1.5;
        // Bugfix: nutzte fälschlich das Vereinskonto statt des Holding-Kontos wie alle
        // anderen Fabrik-Funktionen (buyFactory/upgradeFactory/upgradeWarehouse) - das
        // sorgte für verwirrende "kann nicht bauen"-Situationen trotz vollem Vereinskonto.
        if (holdingCompany.money < cost) { showToast(`Nicht genug Holding-Kapital! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        holdingCompany.money -= cost;
        f.lvl = Math.min(f.max, f.lvl + 1);
        holdingCompany.valuation += Math.round(cost * 0.6);
        rawMaterials.competitorFirms = rawMaterials.competitorFirms.filter(c => c !== weakFirm);
        addInboxMessage('finanzen', `🤝 Fusion mit ${weakFirm.name}!`, `Die ${f.name} übernimmt ${weakFirm.name} - direkt eine Ausbaustufe gewonnen und der Holding-Wert steigt.`, 'screen-industry');
        showToast(`🤝 Fusion mit ${weakFirm.name} abgeschlossen!`, 'success');
        renderIndustryView();
        updateUI();
    }
