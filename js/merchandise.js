    // ==========================================
    // 3-KANAL FANSHOP VERTRIEB
    // ==========================================
    function calculateElasticity(userPrice, optimalPrice) {
        let ratio = userPrice / optimalPrice;
        if (ratio <= 0.6) return { factor: 1.8, label: "Schleuderpreis (Riesige Nachfrage, kaum Marge)", color: "var(--blue)" };
        if (ratio <= 0.85) return { factor: 1.35, label: "Sehr günstig (Hohe Nachfrage)", color: "var(--primary)" };
        if (ratio <= 1.15) return { factor: 1.0, label: "Optimaler Marktpreis (Perfekte Balance)", color: "var(--accent)" };
        if (ratio <= 1.45) return { factor: 0.55, label: "Teuer (Gedämpfter Absatz)", color: "var(--industry)" };
        return { factor: Math.max(0.08, Math.pow(1 / ratio, 2.5)), label: "Überteuert (Massiver Absatzeinbruch!)", color: "var(--danger)" };
    }

    function simulateMerchSales(isHomeMatch, won) {
        let totalSalesRevenue = 0;
        let att = isHomeMatch ? Math.round((stadium.total || 16000) * getAttendanceFactor()) : 0;
        let topStrength = Math.max(...squad.map(p => p.strength), 55);

        for (let key in merchandise) {
            let m = merchandise[key];
            let elast = calculateElasticity(m.price, m.optimalPrice);

            let stadiumDemand = 0;
            if (isHomeMatch) {
                let baseStadium = (att * 0.018) * (won ? 1.4 : 0.85);
                let merchBooths = Object.values(stadium.blocks || {}).reduce((sum, b) => sum + (b.merchLvl || 0), 0);
                baseStadium *= (1 + (merchBooths * 0.05));
                stadiumDemand = Math.round(baseStadium * elast.factor);
            }

            let megastoreLvl = campusBuildings.megastore.lvl;
            let baseCity = (25 + (megastoreLvl * 35)) * (game.fans / 100) * (4 - game.leagueLevel * 0.5);
            let cityDemand = Math.round(baseCity * elast.factor);

            let marketingBonus = staffMembers.marketingDir.hired ? 1.6 : 1.0;
            let starBonus = Math.max(0, (topStrength - 50) * 0.9);
            let baseOnline = (18 + starBonus) * marketingBonus * (game.boardSat / 100);
            let onlineDemand = Math.round(baseOnline * elast.factor);

            let totalDemand = stadiumDemand + cityDemand + onlineDemand;
            if (managerRPG.perks.tycoon) totalDemand = Math.round(totalDemand * 1.25);
            // Saisonale Kollektion (NEU): zeitlich begrenzter Verkaufsschub auf ALLE Artikel.
            if (merchExtras.seasonalCollection.active) totalDemand = Math.round(totalDemand * (1 + merchExtras.seasonalCollection.boostPercent / 100));

            let actualSold = Math.min(m.stock, totalDemand);

            let shareFactor = totalDemand > 0 ? (actualSold / totalDemand) : 0;
            let soldStadium = Math.round(stadiumDemand * shareFactor);
            let soldCity = Math.round(cityDemand * shareFactor);
            let soldOnline = actualSold - soldStadium - soldCity;
            if (soldOnline < 0) soldOnline = 0;

            m.stock -= actualSold;
            let rev = actualSold * m.price;
            totalSalesRevenue += rev;

            m.lastSales = {
                stadium: soldStadium,
                city: soldCity,
                online: soldOnline,
                total: actualSold,
                revenue: rev,
                missed: Math.max(0, totalDemand - actualSold)
            };

            // Spieler-spezifische Trikot-Verkaufszahlen (NEU): ein Teil der Trikot-Verkäufe
            // wird dem aktuell beliebtesten Spieler (Publikumsliebling, sonst Torjäger)
            // zugeschrieben - zeigt, wessen Name/Nummer sich gerade am besten verkauft.
            if (key === 'jerseys' && actualSold > 0) {
                let favoritePlayer = squad.find(p => p.isCrowdFavorite) || [...squad].sort((a, b) => (b.shooting || 0) - (a.shooting || 0))[0];
                if (favoritePlayer) {
                    let attributedSales = Math.round(actualSold * 0.35); // 35% tragen erkennbar seinen Namen
                    if (!merchExtras.jerseySalesByPlayer[favoritePlayer.id]) merchExtras.jerseySalesByPlayer[favoritePlayer.id] = { name: favoritePlayer.name, total: 0 };
                    merchExtras.jerseySalesByPlayer[favoritePlayer.id].name = favoritePlayer.name; // Namensänderungen nachziehen
                    merchExtras.jerseySalesByPlayer[favoritePlayer.id].total += attributedSales;
                }
            }
        }
        return totalSalesRevenue;
    }

    // ==========================================
    // MERCHANDISING: NEUE FUNKTIONEN
    // ==========================================

    // 1. Limitierte Edition: einmaliger Sonderartikel mit hoher Marge und festem, kleinem
    // Bestand - ausverkauft ist ausverkauft, kein Nachproduzieren möglich.
    function launchLimitedEdition(name, stock, price) {
        if (merchExtras.limitedEdition && merchExtras.limitedEdition.stock > 0) { showToast('Es läuft noch eine limitierte Edition!', 'error'); return; }
        merchExtras.limitedEdition = { name, stock, initialStock: stock, price, sold: 0, revenue: 0 };
        showToast(`✨ Limitierte Edition "${name}" gestartet: ${stock} Stück @ ${formatVal(price)}!`, 'success');
        renderMerchView();
    }
    function tickLimitedEditionSales() {
        let le = merchExtras.limitedEdition;
        if (!le || le.stock <= 0) return;
        let demand = Math.round((5 + game.fans / 8) * (game.boardSat / 100));
        let sold = Math.min(le.stock, demand);
        le.stock -= sold;
        le.sold += sold;
        let rev = sold * le.price;
        le.revenue += rev;
        game.money += rev;
        if (le.stock <= 0 && sold > 0) {
            addInboxMessage('vertrag', `✨ Limitierte Edition ausverkauft!`, `"${le.name}" ist komplett ausverkauft - insgesamt ${formatVal(le.revenue)} Erlös aus ${le.initialStock} Stück!`, 'screen-merch');
        }
    }

    // 2. Saisonale Kollektion: zeitlich begrenzter Verkaufsschub auf das reguläre Sortiment,
    // typischerweise zu Saisonbeginn gestartet.
    function launchSeasonalCollection(boostPercent, durationMatchdays) {
        merchExtras.seasonalCollection = { active: true, boostPercent, expiresMatchday: game.matchday + durationMatchdays };
        showToast(`🎽 Saisonale Kollektion gestartet: +${boostPercent}% Verkaufsschub für ${durationMatchdays} Spieltage!`, 'success');
        renderMerchView();
    }
    function tickSeasonalCollectionExpiry() {
        let sc = merchExtras.seasonalCollection;
        if (sc.active && game.matchday >= sc.expiresMatchday) {
            sc.active = false;
            addInboxMessage('vertrag', '🎽 Saisonale Kollektion beendet', 'Der Verkaufsschub der saisonalen Kollektion ist ausgelaufen.', 'screen-merch');
        }
    }

    // 3. Spieler-Trikot-Bestenliste: siehe jerseySalesByPlayer oben, wird hier angezeigt.
    function renderJerseySalesLeaderboard() {
        let box = document.getElementById('jersey-sales-leaderboard-box');
        if (!box) return;
        let entries = Object.values(merchExtras.jerseySalesByPlayer || {}).sort((a, b) => b.total - a.total).slice(0, 5);
        box.innerHTML = entries.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Noch keine spielerspezifischen Trikot-Verkaufsdaten.</div>'
            : entries.map((e, i) => `<div class="box" style="display:flex; justify-content:space-between; font-size:9px;"><span>#${i+1} ${e.name}</span><strong>${e.total.toLocaleString('de-DE')} Trikots</strong></div>`).join('');
    }

    function renderMerchView() {
        renderJerseySalesLeaderboard();
        let leBox = document.getElementById('limited-edition-box');
        if (leBox) {
            let le = merchExtras.limitedEdition;
            leBox.innerHTML = (le && le.stock > 0)
                ? `<div class="box" style="font-size:10px;">✨ <strong>${le.name}</strong>: noch ${le.stock}/${le.initialStock} Stück @ ${formatVal(le.price)} · bisheriger Erlös: ${formatVal(le.revenue)}</div>`
                : `<button onclick="launchLimitedEdition('Jubiläums-Sondertrikot', 200, 95)" class="btn-gold">✨ Limitierte Edition starten (200 Stk. @ 95 €)</button>`;
        }
        let scBox = document.getElementById('seasonal-collection-box');
        if (scBox) {
            let sc = merchExtras.seasonalCollection;
            scBox.innerHTML = sc.active
                ? `<div class="box" style="font-size:10px;">🎽 Saisonale Kollektion aktiv: +${sc.boostPercent}% Verkäufe, noch ${sc.expiresMatchday - game.matchday} Spieltage</div>`
                : `<button onclick="launchSeasonalCollection(25, 6)" class="btn-secondary">🎽 Saisonale Kollektion starten (+25%, 6 Spieltage)</button>`;
        }
        let grid = document.getElementById('merch-items-grid');
        grid.innerHTML = '';
        for (let key in merchandise) {
            let m = merchandise[key];
            let elast = calculateElasticity(m.price, m.optimalPrice);
            let s = m.lastSales || { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 };

            let card = document.createElement('div');
            card.className = 'panel';
            let sliderMin = Math.max(1, Math.round(m.optimalPrice * 0.4));
            let sliderMax = Math.round(m.optimalPrice * 2.5);
            card.innerHTML = `
                <div class="panel-header">
                    <span>${m.name}</span>
                    <strong style="color:var(--primary);">${m.stock} Stk. am Lager</strong>
                </div>
                <div style="margin:6px 0;">
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;">
                        <span>Verkaufspreis</span>
                        <strong id="merch-price-val-${key}" style="color:var(--accent); font-size:13px;">${m.price} €</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:8px; color:var(--text-muted);">${sliderMin}€</span>
                        <input type="range" min="${sliderMin}" max="${sliderMax}" value="${m.price}" oninput="document.getElementById('merch-price-val-${key}').innerText = this.value + ' €'; setMerchPrice('${key}', this.value)" style="flex:1;">
                        <span style="font-size:8px; color:var(--text-muted);">${sliderMax}€</span>
                    </div>
                </div>
                <div style="font-size:10px; margin-bottom:6px;">Marktlage: <strong id="merch-elasticity-label-${key}" style="color:${elast.color};">${elast.label}</strong></div>
                
                <div class="box" style="font-size:10px; background:rgba(0,0,0,0.4); padding:6px;">
                    <strong style="color:var(--accent);">Absatz letzter Spieltag: ${s.total} Stk. (+${formatVal(s.revenue)})</strong><br>
                    🏟️ Stadion: <strong>${s.stadium}</strong> | 🏬 City: <strong>${s.city}</strong> | 🌐 Online: <strong>${s.online}</strong>
                    ${s.missed > 0 ? `<div style="color:var(--danger); font-weight:bold; margin-top:2px;">⚠️ ${s.missed} Kunden gingen wegen Lagermangel leer aus!</div>` : ''}
                </div>

                <button onclick="orderMerchBatch('${key}', 250)" class="btn-secondary" style="margin-top:4px;">+250 Zukaufen (Großhandel) [${formatVal(m.cost * 250)}]</button>
            `;
            grid.appendChild(card);
        }
    }

    function setMerchPrice(key, price) {
        if (merchandise[key]) {
            merchandise[key].price = Math.max(1, parseInt(price) || 10);
            // Bugfix/UX: kein voller Neuaufbau der Liste bei jedem Zwischenwert während des
            // Ziehens am Schieberegler (das würde den Slider "abreißen" lassen) - stattdessen
            // nur die betroffene Marktlage-Anzeige leichtgewichtig aktualisieren.
            let elastEl = document.getElementById('merch-elasticity-label-' + key);
            if (elastEl) {
                let elast = calculateElasticity(merchandise[key].price, merchandise[key].optimalPrice);
                elastEl.innerText = elast.label;
                elastEl.style.color = elast.color;
            } else {
                renderMerchView();
            }
        }
    }

    function orderMerchBatch(key, amount) {
        let m = merchandise[key];
        let totalCost = m.cost * amount;
        if (game.money < totalCost) { alert("Nicht genug Geld auf dem Vereinskonto!"); return; }
        playSound('click');
        game.money -= totalCost;
        m.stock += amount;
        renderMerchView();
        updateUI();
        alert(`📦 ${amount}x ${m.name} über Großhandel nachbestellt!`);
    }

    // ==========================================
    // FANSHOP-MANAGER: WÄHLBARE AUFGABE, LÄUFT AUTOMATISCH JEDEN SPIELTAG
    // ==========================================
    const FANSHOP_TASKS = [
        { id: 'restock', name: 'Lagerauffüllung', desc: 'Bestellt automatisch nach, sobald ein Artikel unter 120 Stück fällt.' },
        { id: 'pricing', name: 'Preisoptimierung', desc: 'Nähert die Preise jeden Spieltag schrittweise dem Marktoptimum an.' },
        { id: 'promo', name: 'Rabattaktionen', desc: 'Senkt automatisch den Preis stark überlagerter Artikel (>400 Stk.), um sie abzuverkaufen.' }
    ];

    function setFanshopManagerTask(taskId) {
        if (!FANSHOP_TASKS.some(t => t.id === taskId)) return;
        staffMembers.fanshopManager.task = taskId;
        renderStaffView();
    }

    function runFanshopManagerTasks() {
        if (!staffMembers.fanshopManager.hired) return;
        let task = staffMembers.fanshopManager.task || 'restock';

        if (task === 'restock') {
            for (let key in merchandise) {
                let m = merchandise[key];
                if (m.stock < 120) {
                    let orderAmount = 300 - m.stock;
                    let cost = Math.round(m.cost * orderAmount);
                    if (game.money >= cost) {
                        game.money -= cost;
                        m.stock += orderAmount;
                    }
                }
            }
        } else if (task === 'pricing') {
            for (let key in merchandise) {
                let m = merchandise[key];
                if (m.price < m.optimalPrice) m.price = Math.min(m.optimalPrice, m.price + 1);
                else if (m.price > m.optimalPrice) m.price = Math.max(m.optimalPrice, m.price - 1);
            }
        } else if (task === 'promo') {
            for (let key in merchandise) {
                let m = merchandise[key];
                if (m.stock > 400) {
                    m.price = Math.max(Math.ceil(m.cost * 1.1), Math.round(m.price * 0.85));
                }
            }
        }
    }

