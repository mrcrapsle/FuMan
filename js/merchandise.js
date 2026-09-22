
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

    // Wie viel ein Besucher am Spieltag im Schnitt für Fanartikel ausgibt. Orientiert an
    // realen Erhebungen zum Fanartikelverkauf im Stadion (rund 3 € pro Zuschauer; Merchandising
    // macht in der Bundesliga etwa 5% des Gesamterlöses aus). Vorher war der Absatz von der
    // Zuschauerzahl praktisch entkoppelt: Stadt- und Online-Nachfrage liefen über feste
    // Pauschalen je Artikel, sodass ein Verein mit 950 Besuchern dieselben Stückzahlen
    // verkaufte wie ein ausverkauftes Stadion.
    const MERCH_SPEND_PER_VISITOR = 3.0;

    // Reichweite außerhalb des Stadions: der Schnitt der letzten Heimspiele ist das
    // ehrlichste Maß für die tatsächliche Größe der Anhängerschaft. Die Stadionkapazität
    // allein taugt nicht, weil sie im Spiel von Beginn an fünfstellig ist.
    function getAverageHomeAttendance() {
        let hist = (game.attendanceHistory || []).slice(-8).map(h => h.attendance).filter(a => a > 0);
        if (hist.length === 0) return Math.max(200, Math.round((stadium.total || 1000) * getAttendanceFactor()));
        return Math.round(hist.reduce((s, a) => s + a, 0) / hist.length);
    }

    // Sammelt alle Faktoren, die auf den Fanartikel-Absatz wirken - einmal an einer Stelle,
    // damit sie im Fanshop auch ausgewiesen werden können statt unsichtbar zu bleiben.
    function getMerchModifiers(won) {
        let mods = [];
        let merchBooths = Object.values(stadium.blocks || {}).reduce((sum, b) => sum + (b.merchLvl || 0), 0);
        if (merchBooths > 0) mods.push({ label: `Merch-Stände (${merchBooths} Stufen)`, mult: 1 + merchBooths * 0.05, channel: 'stadium' });
        if (typeof getStadiumMerchBonus === 'function' && getStadiumMerchBonus() > 0) {
            mods.push({ label: 'Stadion-Ausbauten (Flagship-Store/App)', mult: 1 + getStadiumMerchBonus(), channel: 'stadium' });
        }
        if (game.merchDoubleNextMatch) mods.push({ label: '⚡ Premium-Booster: doppelter Absatz', mult: 2, channel: 'stadium' });
        if (campusBuildings.megastore.lvl > 0) mods.push({ label: `Fanshop Megastore (Stufe ${campusBuildings.megastore.lvl})`, mult: 1 + campusBuildings.megastore.lvl * 0.45, channel: 'city' });
        if (staffMembers.marketingDir.hired) mods.push({ label: 'Marketing-Direktor', mult: 1.6, channel: 'online' });
        if (managerRPG.perks.tycoon) mods.push({ label: 'Perk "Tycoon"', mult: 1.25, channel: 'alle' });
        if (merchExtras.seasonalCollection.active) mods.push({ label: `Saisonale Kollektion (+${merchExtras.seasonalCollection.boostPercent}%)`, mult: 1 + merchExtras.seasonalCollection.boostPercent / 100, channel: 'alle' });
        if (won !== undefined && won !== null) mods.push({ label: won ? 'Sieg-Euphorie' : 'Ergebnis gedämpft', mult: won ? 1.35 : 0.85, channel: 'stadium' });
        return mods;
    }

    // Verteilt einen Umsatz-Etat auf die Artikel: begehrtere und passend bepreiste Artikel
    // bekommen einen größeren Anteil, die Stückzahl ergibt sich dann aus dem Preis. Dadurch
    // verkauft sich ein 18-€-Schal automatisch häufiger als ein 65-€-Trikot.
    function distributeMerchBudget(budget, weights) {
        let totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
        let units = {};
        for (let key in weights) {
            if (totalWeight <= 0) { units[key] = 0; continue; }
            let share = (weights[key] / totalWeight) * budget;
            units[key] = Math.max(0, Math.round(share / Math.max(1, merchandise[key].price)));
        }
        return units;
    }

    function simulateMerchSales(isHomeMatch, won, actualAttendance = null) {
        let totalSalesRevenue = 0;
        // Es zählt die TATSÄCHLICHE Zuschauerzahl des Spiels (inkl. Derby-/Pokalzuschlag und
        // Streuung), nicht mehr eine zweite, davon abweichende Schätzung.
        let att = isHomeMatch
            ? (actualAttendance !== null ? actualAttendance : Math.round((stadium.total || 1000) * getAttendanceFactor()))
            : 0;
        let avgAtt = getAverageHomeAttendance();
        let topStrength = Math.max(...squad.map(p => p.strength), 55);
        let jitter = () => 0.85 + Math.random() * 0.3;   // Spieltag ist nie exakt wie der letzte

        // ---- 1. Wie viel Geld fließt an diesem Spieltag überhaupt in Fanartikel? ----
        let stadiumBudget = 0;
        if (isHomeMatch && att > 0) {
            stadiumBudget = att * MERCH_SPEND_PER_VISITOR * (won ? 1.35 : 0.85) * jitter();
            let merchBooths = Object.values(stadium.blocks || {}).reduce((sum, b) => sum + (b.merchLvl || 0), 0);
            stadiumBudget *= (1 + merchBooths * 0.05);
            if (typeof getStadiumMerchBonus === 'function') stadiumBudget *= (1 + getStadiumMerchBonus());
            if (game.merchDoubleNextMatch) stadiumBudget *= 2;
        }
        // Stadtgeschäft und Onlineshop hängen an der Reichweite des Vereins statt an
        // festen Pauschalen - ein Sechstligist verkauft dort entsprechend wenig.
        let cityBudget = avgAtt * 0.8 * (1 + campusBuildings.megastore.lvl * 0.45)
            * (0.4 + (game.fans / 100) * 0.9) * jitter();
        let marketingBonus = staffMembers.marketingDir.hired ? 1.6 : 1.0;
        let starFactor = 1 + Math.max(0, topStrength - 55) * 0.012;
        let onlineBudget = avgAtt * 0.6 * marketingBonus * starFactor
            * (0.4 + (game.boardSat / 100) * 0.6) * jitter();

        // Trikot-Ausrüster: ein prestigeträchtiger Ausrüster macht die Trikots begehrter.
        let kitScale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let kitPrestigeBonus = Math.min(0.2, Math.max(0, ((game.kitSupplier?.income || 0) / (3000 * kitScale)) * 0.1));

        if (managerRPG.perks.tycoon) { stadiumBudget *= 1.25; cityBudget *= 1.25; onlineBudget *= 1.25; }
        if (merchExtras.seasonalCollection.active) {
            let f = 1 + merchExtras.seasonalCollection.boostPercent / 100;
            stadiumBudget *= f; cityBudget *= f; onlineBudget *= f;
        }

        // ---- 2. Etat auf die Artikel verteilen ----
        let weights = {};
        for (let key in merchandise) {
            let m = merchandise[key];
            let elast = calculateElasticity(m.price, m.optimalPrice);
            let w = (m.popularity || 1) * elast.factor;
            if (key === 'jerseys') w *= (1 + kitPrestigeBonus);
            weights[key] = Math.max(0, w);
        }
        let stadiumUnits = distributeMerchBudget(stadiumBudget, weights);
        let cityUnits = distributeMerchBudget(cityBudget, weights);
        let onlineUnits = distributeMerchBudget(onlineBudget, weights);

        // ---- 3. Am Lagerbestand ausliefern ----
        let matchdayLog = { matchday: game.matchday, season: game.season, items: {}, revenue: 0, attendance: att };
        for (let key in merchandise) {
            let m = merchandise[key];
            let wunschStadion = stadiumUnits[key] || 0;
            let wunschStadt = cityUnits[key] || 0;
            let wunschOnline = onlineUnits[key] || 0;
            let totalDemand = wunschStadion + wunschStadt + wunschOnline;

            let actualSold = Math.min(m.stock, totalDemand);
            let shareFactor = totalDemand > 0 ? (actualSold / totalDemand) : 0;
            let soldStadium = Math.round(wunschStadion * shareFactor);
            let soldCity = Math.round(wunschStadt * shareFactor);
            let soldOnline = Math.max(0, actualSold - soldStadium - soldCity);

            m.stock -= actualSold;
            let rev = actualSold * m.price;
            totalSalesRevenue += rev;

            m.lastSales = {
                stadium: soldStadium, city: soldCity, online: soldOnline,
                total: actualSold, revenue: rev,
                missed: Math.max(0, totalDemand - actualSold)
            };
            if (actualSold > 0 || m.lastSales.missed > 0) {
                matchdayLog.items[key] = { name: m.name, sold: actualSold, revenue: rev, missed: m.lastSales.missed };
            }
            matchdayLog.revenue += rev;

            // Spieler-spezifische Trikot-Verkaufszahlen: ein Teil der Trikot-Verkäufe wird
            // dem beliebtesten Spieler zugeschrieben.
            if (key === 'jerseys' && actualSold > 0) {
                let favoritePlayer = squad.find(p => p.isCrowdFavorite) || [...squad].sort((a, b) => (b.shooting || 0) - (a.shooting || 0))[0];
                if (favoritePlayer) {
                    let attributedSales = Math.round(actualSold * 0.35);
                    if (!merchExtras.jerseySalesByPlayer[favoritePlayer.id]) merchExtras.jerseySalesByPlayer[favoritePlayer.id] = { name: favoritePlayer.name, total: 0 };
                    merchExtras.jerseySalesByPlayer[favoritePlayer.id].name = favoritePlayer.name;
                    merchExtras.jerseySalesByPlayer[favoritePlayer.id].total += attributedSales;
                }
            }
        }

        // ---- 4. Verlauf mitschreiben, damit nachvollziehbar bleibt, was sich verkauft hat ----
        if (!merchExtras.salesHistory) merchExtras.salesHistory = [];
        merchExtras.salesHistory.push(matchdayLog);
        if (merchExtras.salesHistory.length > 80) merchExtras.salesHistory.shift();

        game.merchDoubleNextMatch = false;
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

    // Macht sichtbar, welche Boni gerade tatsächlich auf den Absatz wirken - vorher steckten
    // Premium-Booster, Mitarbeiter- und Gebäudeboni unsichtbar in der Rechnung.
    function renderMerchModifiers() {
        let box = document.getElementById('merch-modifiers-box');
        if (!box) return;
        let mods = getMerchModifiers(null);
        let avgAtt = getAverageHomeAttendance();
        let kopf = `<div class="box" style="font-size:9px;">Grundlage: <strong>${avgAtt.toLocaleString('de-DE')}</strong> Zuschauer im Schnitt der letzten Heimspiele · `
            + `rund <strong>${MERCH_SPEND_PER_VISITOR.toFixed(2).replace('.', ',')} €</strong> Fanartikel-Umsatz pro Stadionbesucher.</div>`;
        if (mods.length === 0) {
            box.innerHTML = kopf + '<div style="font-size:9px; color:var(--text-muted);">Aktuell wirken keine zusätzlichen Boni auf den Absatz.</div>';
            return;
        }
        box.innerHTML = kopf + mods.map(m => {
            let pct = Math.round((m.mult - 1) * 100);
            let farbe = pct >= 0 ? 'var(--primary)' : 'var(--danger)';
            return `<div class="player-row" style="font-size:9px;"><span>${m.label} <span style="color:var(--text-muted);">(${m.channel})</span></span>`
                + `<strong style="color:${farbe};">${pct >= 0 ? '+' : ''}${pct}%</strong></div>`;
        }).join('');
    }

    // Verkaufsverlauf: beantwortet "was habe ich wann wovon verkauft" - bisher war immer nur
    // der allerletzte Spieltag je Artikel sichtbar.
    function renderMerchSalesHistory() {
        let box = document.getElementById('merch-sales-history');
        if (!box) return;
        let hist = (merchExtras.salesHistory || []).slice(-10).reverse();
        if (hist.length === 0) {
            box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine Verkäufe erfasst - nach dem ersten Spieltag erscheint hier der Verlauf.</div>';
            return;
        }
        // Saisonsumme je Artikel über den gesamten mitgeschriebenen Verlauf.
        let summe = {};
        (merchExtras.salesHistory || []).forEach(e => {
            for (let k in e.items) {
                if (!summe[k]) summe[k] = { name: e.items[k].name, sold: 0, revenue: 0 };
                summe[k].sold += e.items[k].sold;
                summe[k].revenue += e.items[k].revenue;
            }
        });
        let summeHtml = Object.values(summe).sort((a, b) => b.revenue - a.revenue).map(v =>
            `<div class="player-row" style="font-size:9px;"><span>${v.name}</span><span><strong>${v.sold.toLocaleString('de-DE')}</strong> Stk. · <strong style="color:var(--accent);">${formatVal(v.revenue)}</strong></span></div>`
        ).join('');

        let verlaufHtml = hist.map(e => {
            let artikel = Object.values(e.items).sort((a, b) => b.sold - a.sold)
                .map(i => `${i.name.split(' ')[0]}: ${i.sold}`).join(' · ') || 'nichts verkauft';
            let verpasst = Object.values(e.items).reduce((s, i) => s + i.missed, 0);
            return `<div class="box" style="font-size:9px; margin-bottom:3px;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>S${e.season} · Spieltag ${e.matchday}${e.attendance > 0 ? ` · ${e.attendance.toLocaleString('de-DE')} Zuschauer` : ' · auswärts'}</strong>
                            <strong style="color:var(--accent);">${formatVal(e.revenue)}</strong>
                        </div>
                        <div style="color:var(--text-muted);">${artikel}${verpasst > 0 ? ` · <span style="color:var(--danger);">${verpasst} mangels Bestand verpasst</span>` : ''}</div>
                    </div>`;
        }).join('');

        box.innerHTML = `<div style="font-size:9px; font-weight:800; margin:4px 0;">Bisher verkauft (gesamter Verlauf)</div>${summeHtml}`
            + `<div style="font-size:9px; font-weight:800; margin:6px 0 4px;">Letzte Spieltage</div>${verlaufHtml}`;
    }

    function renderMerchView() {
        renderJerseySalesLeaderboard();
        renderMerchModifiers();
        renderMerchSalesHistory();
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
        if (game.money < totalCost) { showToast(`Vereinskonto reicht nicht: ${formatVal(totalCost)} nötig, ${formatVal(game.money)} vorhanden.`, 'error', 4500); return; }
        playSound('click');
        game.money -= totalCost;
        m.stock += amount;
        renderMerchView();
        updateUI();
        showToast(`📦 ${amount}x ${m.name} über den Großhandel nachbestellt.`, 'success', 4000);
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


