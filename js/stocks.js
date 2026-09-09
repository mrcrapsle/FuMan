    // ==========================================
    // AKTIENMARKT: ECHTE KURSBEWEGUNG, EVENTS & 3D-CHART
    // ==========================================
    const STOCK_MAX_HISTORY = 20;

    const STOCK_KEYS = ['techCorp', 'realEstate', 'greenEnergy', 'cryptoFund', 'staatsanleihe', 'biotech'];

    function updateStockMarket() {
        // Marktweites Boom/Crash-Event (selten, betrifft alle Aktien gemeinsam)
        let marketEvent = null;
        if (Math.random() < 0.06) {
            let isBoom = Math.random() < 0.5;
            marketEvent = isBoom
                ? { text: "📈 Kursrallye an der Börse: Alle Aktien legen kräftig zu!", mult: 1.12 }
                : { text: "📉 Böser Kurseinbruch erschüttert die Märkte: Alle Aktien geben nach!", mult: 0.88 };
        }

        STOCK_KEYS.forEach(key => {
            let s = stockMarket[key];
            if (!s) return;
            let randomWalk = 1 + (Math.random() * 2 - 1) * s.volatility;
            let newPrice = s.price * randomWalk * (marketEvent ? marketEvent.mult : 1);
            s.price = Math.max(2, +newPrice.toFixed(2));
            if (!Array.isArray(s.history)) s.history = [s.price];
            s.history.push(s.price);
            if (s.history.length > STOCK_MAX_HISTORY) s.history.shift();
        });

        stockMarket.activeMarketEvent = marketEvent ? marketEvent.text : null;
    }

    function renderStocksView() {
        let list = document.getElementById('stocks-market-list');
        list.innerHTML = '';

        if (stockMarket.activeMarketEvent) {
            list.innerHTML += `<div class="box" style="border-color:var(--accent); margin-bottom:6px; font-size:10px;">${stockMarket.activeMarketEvent}</div>`;
        }

        let totalVal = 0;
        STOCK_KEYS.forEach(key => {
            let s = stockMarket[key];
            if (!s) return;
            totalVal += s.owned * s.price;
            let history = s.history || [s.price];
            let minH = Math.min(...history), maxH = Math.max(...history, minH + 1);
            let trendUp = history.length > 1 && history[history.length - 1] >= history[0];

            let bars = history.map(h => {
                let heightPct = Math.max(6, Math.round(((h - minH) / (maxH - minH)) * 100));
                return `<div class="stock-bar-3d" style="height:${heightPct}%;"></div>`;
            }).join('');

            let card = document.createElement('div');
            card.className = 'player-row';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'stretch';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div><strong>${s.name}</strong><br><span style="color:#aaa; font-size:10px;">Kurs: ${formatVal(s.price)} | Dividende: ${(s.dividendRate*100).toFixed(1)}%</span></div>
                    <div style="text-align:right;">
                        <span style="color:${trendUp ? 'var(--primary)' : 'var(--danger)'}; font-weight:900;">${trendUp ? '▲' : '▼'}</span><br>
                        Besitz: <strong style="color:var(--blue);">${s.owned}</strong>
                    </div>
                </div>
                <div class="stock-chart-3d-wrapper">
                    <div class="stock-chart-3d">${bars}</div>
                </div>
                <div style="font-size:9px; color:#64748b; margin-top:4px;">Kaufen für einen festen Geldbetrag (skaliert automatisch mit dem Kurs, egal wie teuer/günstig die Aktie ist):</div>
                <div style="display:flex; gap:3px; margin-top:4px; flex-wrap:wrap;">
                    <button onclick="buyStockByAmount('${key}', 1000)" class="btn-action" style="font-size:9px; width:auto;">+1.000 €</button>
                    <button onclick="buyStockByAmount('${key}', 10000)" class="btn-action" style="font-size:9px; width:auto;">+10.000 €</button>
                    <button onclick="buyStockByAmount('${key}', 50000)" class="btn-action" style="font-size:9px; width:auto;">+50.000 €</button>
                    <button onclick="buyMaxStockShares('${key}')" class="btn-action" style="font-size:9px; width:auto; background:var(--purple);">MAX</button>
                    <button onclick="sellStockSharesPct('${key}', 0.25)" class="btn-secondary" style="font-size:9px; width:auto;">-25%</button>
                    <button onclick="sellStockSharesPct('${key}', 0.5)" class="btn-secondary" style="font-size:9px; width:auto;">-50%</button>
                    <button onclick="sellStockShares('${key}', ${s.owned})" class="btn-secondary" style="font-size:9px; width:auto; color:var(--danger);">Alles</button>
                </div>
            `;
            list.appendChild(card);
        });
        document.getElementById('stocks-total-val').innerText = formatVal(totalVal);

        // Neue Kapitalmarkt-Funktionen: Dropdowns befüllen & Status anzeigen
        let optionSelect = document.getElementById('option-stock-select');
        if (optionSelect) optionSelect.innerHTML = STOCK_KEYS.map(k => `<option value="${k}">${stockMarket[k].name}</option>`).join('');
        let savingsSelect = document.getElementById('savings-plan-select');
        if (savingsSelect) savingsSelect.innerHTML = STOCK_KEYS.map(k => `<option value="${k}">${stockMarket[k].name}</option>`).join('');
        let ordersBox = document.getElementById('limit-orders-list');
        if (ordersBox) {
            let orders = financeCentralState.limitOrders || [];
            ordersBox.innerHTML = orders.length === 0 ? '<div style="font-size:9px; color:var(--text-muted);">Keine offenen Orders.</div>' :
                orders.map(o => `<div class="player-row" style="font-size:9px;"><span>${o.type === 'buy' ? 'Kauf' : 'Verkauf'} ${o.amount}x ${stockMarket[o.key]?.name} @ ${formatVal(o.targetPrice)}</span><button onclick="cancelLimitOrder(${o.id})" class="btn-secondary" style="width:auto; font-size:8px;">✕</button></div>`).join('');
        }
        let savingsStatus = document.getElementById('savings-plan-status');
        if (savingsStatus) {
            let plan = financeCentralState.savingsPlan;
            savingsStatus.innerText = plan ? `📅 Aktiv: ${formatVal(plan.amountPerMatchday)}/SpT in ${stockMarket[plan.key]?.name}` : 'Kein Sparplan aktiv.';
        }
        let diversBox = document.getElementById('diversification-bonus-box');
        if (diversBox) {
            let bonus = getDiversificationBonus();
            let heldCount = STOCK_KEYS.filter(k => stockMarket[k] && stockMarket[k].owned > 0).length;
            diversBox.innerText = bonus > 0 ? `🎯 Diversifikationsbonus aktiv: +${(bonus*100).toFixed(1)}% Dividende (${heldCount} Aktien gehalten)` : `🎯 Noch kein Diversifikationsbonus (${heldCount}/4 verschiedene Aktien gehalten)`;
        }
    }

    function buyStockShares(key, amount) {
        let s = stockMarket[key];
        if (!s || amount <= 0) return;
        let cost = s.price * amount;
        if (game.money < cost) { showToast('Nicht genug Geld!', 'error'); return; }
        playSound('click');
        game.money -= cost;
        s.owned += amount;
        renderStocksView();
        updateUI();
    }

    // Kauf über einen festen Geldbetrag statt fester Stückzahl - so bleibt "+10.000 €" bei
    // einer 30€-Aktie genauso sinnvoll nutzbar wie bei einer 200€-Aktie (skaliert mit dem
    // Kurs), statt dass teure Aktien durch feste Stückzahl-Buttons kaum kaufbar sind.
    function buyStockByAmount(key, eurAmount) {
        let s = stockMarket[key];
        if (!s || eurAmount <= 0) return;
        let affordableAmount = Math.min(eurAmount, game.money);
        let shares = Math.floor(affordableAmount / s.price);
        if (shares <= 0) { showToast('Nicht genug Geld für auch nur eine Aktie!', 'error'); return; }
        buyStockShares(key, shares);
    }

    function sellStockSharesPct(key, pct) {
        let s = stockMarket[key];
        if (!s || s.owned <= 0) return;
        let amount = Math.max(1, Math.floor(s.owned * pct));
        sellStockShares(key, amount);
    }

    function buyMaxStockShares(key) {
        let s = stockMarket[key];
        if (!s) return;
        let maxAffordable = Math.floor(game.money / s.price);
        if (maxAffordable <= 0) { showToast('Nicht genug Geld für auch nur eine Aktie!', 'error'); return; }
        buyStockShares(key, maxAffordable);
    }

    function sellStockShares(key, amount) {
        let s = stockMarket[key];
        if (!s || amount <= 0 || s.owned < amount) return;
        playSound('click');
        game.money += s.price * amount;
        s.owned -= amount;
        renderStocksView();
        updateUI();
    }

    // ==========================================
    // KAPITALMARKT: 6 WEITERE NEUE FUNKTIONEN (10-15)
    // ==========================================

    // 10. Hebelprodukt/Optionsschein: Wette auf steigenden ODER fallenden Kurs mit
    // verdoppeltem Ausschlag - deutlich riskanter als der normale Aktienkauf.
    function buyLeveragedOption(key, direction, stake) {
        let s = stockMarket[key];
        if (!s || !stake || stake <= 0 || game.money < stake) { showToast('Ungültiger Einsatz oder nicht genug Geld!', 'error'); return; }
        playSound('click');
        game.money -= stake;
        let entryPrice = s.price;
        setTimeout(() => {}, 0); // Platzhalter, Auflösung erfolgt in resolveLeveragedOptions()
        if (!game.leveragedOptions) game.leveragedOptions = [];
        game.leveragedOptions.push({ key, direction, stake, entryPrice, matchdaysLeft: 3 });
        showToast(`📜 Optionsschein auf ${direction === 'up' ? 'steigenden' : 'fallenden'} Kurs von ${s.name} gekauft (${formatVal(stake)} Einsatz).`, 'success');
        renderStocksView();
        updateUI();
    }
    function resolveLeveragedOptions() {
        if (!game.leveragedOptions || game.leveragedOptions.length === 0) return;
        let stillActive = [];
        game.leveragedOptions.forEach(opt => {
            opt.matchdaysLeft--;
            if (opt.matchdaysLeft > 0) { stillActive.push(opt); return; }
            let s = stockMarket[opt.key];
            let priceChangePct = s ? (s.price - opt.entryPrice) / opt.entryPrice : 0;
            let correct = (opt.direction === 'up' && priceChangePct > 0) || (opt.direction === 'down' && priceChangePct < 0);
            if (correct) {
                let payout = Math.round(opt.stake * (1 + Math.min(3, Math.abs(priceChangePct) * 4)));
                game.money += payout;
                addInboxMessage('finanzen', '📜 Optionsschein-Gewinn!', `Der Optionsschein auf ${s ? s.name : opt.key} ging auf - Auszahlung: ${formatVal(payout)}!`, 'screen-stocks');
            } else {
                addInboxMessage('finanzen', '📜 Optionsschein verfallen', `Der Optionsschein auf ${s ? s.name : opt.key} lag daneben - der Einsatz von ${formatVal(opt.stake)} ist verloren.`, 'screen-stocks');
            }
        });
        game.leveragedOptions = stillActive;
    }

    // 11. Portfolio-Diversifikationsbonus: wer in 4+ verschiedene Aktien gleichzeitig
    // investiert ist, bekommt einen kleinen Dividenden-Bonus obendrauf.
    function getDiversificationBonus() {
        let heldCount = STOCK_KEYS.filter(k => stockMarket[k] && stockMarket[k].owned > 0).length;
        return heldCount >= 5 ? 0.015 : (heldCount >= 4 ? 0.008 : 0);
    }

    // 12. Limit-Orders: automatischer Kauf/Verkauf, sobald ein Zielkurs erreicht wird.
    function createLimitOrder(key, type, targetPrice, amount) {
        if (!targetPrice || targetPrice <= 0 || !amount || amount <= 0) { showToast('Ungültige Order-Parameter!', 'error'); return; }
        financeCentralState.limitOrders.push({ id: Date.now(), key, type, targetPrice, amount });
        showToast(`📋 Limit-Order angelegt: ${type === 'buy' ? 'Kauf' : 'Verkauf'} von ${amount} ${stockMarket[key]?.name || key} bei ${formatVal(targetPrice)}.`, 'success');
        renderStocksView();
    }
    function cancelLimitOrder(id) {
        financeCentralState.limitOrders = financeCentralState.limitOrders.filter(o => o.id !== id);
        renderStocksView();
    }
    function checkLimitOrders() {
        if (!financeCentralState.limitOrders || financeCentralState.limitOrders.length === 0) return;
        let remaining = [];
        financeCentralState.limitOrders.forEach(order => {
            let s = stockMarket[order.key];
            if (!s) return;
            let triggered = (order.type === 'buy' && s.price <= order.targetPrice) || (order.type === 'sell' && s.price >= order.targetPrice);
            if (triggered) {
                if (order.type === 'buy') {
                    let cost = s.price * order.amount;
                    if (game.money >= cost) { game.money -= cost; s.owned += order.amount; addInboxMessage('finanzen', '📋 Limit-Order ausgeführt!', `Kauf-Order für ${order.amount} ${s.name} bei ${formatVal(s.price)} ausgeführt.`, 'screen-stocks'); }
                    else remaining.push(order);
                } else {
                    let sellAmount = Math.min(order.amount, s.owned);
                    if (sellAmount > 0) { game.money += s.price * sellAmount; s.owned -= sellAmount; addInboxMessage('finanzen', '📋 Limit-Order ausgeführt!', `Verkauf-Order für ${sellAmount} ${s.name} bei ${formatVal(s.price)} ausgeführt.`, 'screen-stocks'); }
                }
            } else remaining.push(order);
        });
        financeCentralState.limitOrders = remaining;
    }

    // 13. Insider-Tipp: Chef-Analyst (falls engagiert) gibt gelegentlich einen Hinweis,
    // welche Aktie sich als Nächstes wahrscheinlich stark bewegt.
    function checkInsiderTip() {
        if (!staffMembers.analyst.hired) return;
        if (Math.random() > 0.04) return;
        let key = STOCK_KEYS[Math.floor(Math.random() * STOCK_KEYS.length)];
        let s = stockMarket[key];
        let direction = Math.random() < 0.5 ? 'steigen' : 'fallen';
        addInboxMessage('finanzen', '🕵️ Insider-Tipp vom Chef-Analysten', `Gerüchte besagen, "${s.name}" könnte demnächst deutlich ${direction}. Keine Garantie, aber vielleicht einen Blick wert!`, 'screen-stocks');
    }

    // 14. Aktien-Sparplan: automatischer, wiederkehrender Kauf einer festen Summe einer
    // gewählten Aktie an jedem Heimspieltag.
    function setSavingsPlan(key, amountPerMatchday) {
        if (!amountPerMatchday || amountPerMatchday <= 0) { financeCentralState.savingsPlan = null; showToast('Aktien-Sparplan deaktiviert.', 'success'); renderStocksView(); return; }
        financeCentralState.savingsPlan = { key, amountPerMatchday };
        showToast(`📅 Aktien-Sparplan eingerichtet: ${formatVal(amountPerMatchday)}/Spieltag in ${stockMarket[key]?.name || key}.`, 'success');
        renderStocksView();
    }
    function tickSavingsPlan() {
        let plan = financeCentralState.savingsPlan;
        if (!plan) return;
        let s = stockMarket[plan.key];
        if (!s || game.money < plan.amountPerMatchday) return;
        let shares = Math.floor(plan.amountPerMatchday / s.price);
        if (shares > 0) { game.money -= shares * s.price; s.owned += shares; }
    }

    // 15. Kapitalmarkt-Meilensteine: einmalige Belohnung bei Erreichen bestimmter
    // Gesamtportfolio-Werte.
    const PORTFOLIO_MILESTONES = [50000, 150000, 500000, 1000000];
    function checkPortfolioMilestones() {
        let totalVal = STOCK_KEYS.reduce((sum, k) => sum + (stockMarket[k] ? stockMarket[k].owned * stockMarket[k].price : 0), 0);
        PORTFOLIO_MILESTONES.forEach(milestone => {
            if (totalVal >= milestone && !financeCentralState.milestonesReached.includes(milestone)) {
                financeCentralState.milestonesReached.push(milestone);
                let bonus = Math.round(milestone * 0.02);
                game.money += bonus;
                addInboxMessage('finanzen', '📈 Kapitalmarkt-Meilenstein erreicht!', `Dein Aktienportfolio hat erstmals einen Wert von ${formatVal(milestone)} überschritten - ${formatVal(bonus)} Bonus als Belohnung für kluges Wirtschaften!`, 'screen-stocks');
            }
        });
    }
