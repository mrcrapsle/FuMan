
    // ==========================================
    // FINANZEN: GuV, ECHTE BUDGETS, KREDITSTAFFELUNG, INSOLVENZRISIKO
    // ==========================================
    const LOAN_TIERS = [
        { key: 'kurz', name: 'Kurzfristig', duration: 10, rate: 0.15 },
        { key: 'mittel', name: 'Mittelfristig', duration: 20, rate: 0.10 },
        { key: 'lang', name: 'Langfristig', duration: 34, rate: 0.06 }
    ];
    const MAX_ACTIVE_LOANS = 3;

    // Rein dekorativer "Börsen-News"-Ticker im Stil der Referenz-App (DAX/Dollar/Gold) -
    // nutzt fiktive, aber plausibel schwankende Werte, gekoppelt an den echten Aktienmarkt-
    // Kurs von techCorp, damit er nicht komplett beliebig wirkt.
    // Sponsoren-Ranking: kleines Leaderboard der Karriere-Gesamteinnahmen je Sponsor,
    // umschaltbar zwischen Einzelsponsor- und Branchen-Ansicht.
    let sponsorLeaderboardMode = 'sponsor';
    function setSponsorLeaderboardMode(mode) {
        sponsorLeaderboardMode = mode;
        renderSponsorLeaderboard();
    }
    function renderSponsorLeaderboard() {
        let box = document.getElementById('sponsor-leaderboard-box');
        if (!box) return;
        let toggleBox = document.getElementById('sponsor-leaderboard-toggle');
        if (toggleBox) {
            toggleBox.innerHTML = `
                <button onclick="setSponsorLeaderboardMode('sponsor')" class="${sponsorLeaderboardMode === 'sponsor' ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:4px 8px;">Nach Sponsor</button>
                <button onclick="setSponsorLeaderboardMode('category')" class="${sponsorLeaderboardMode === 'category' ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:4px 8px;">Nach Branche</button>
            `;
        }
        let source = sponsorLeaderboardMode === 'category' ? (game.sponsorEarningsByCategory || {}) : (game.sponsorEarningsHistory || {});
        let entries = Object.entries(source).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (entries.length === 0) {
            box.innerHTML = '<div class="box" style="font-size:10px; color:#94a3b8;">Noch keine Sponsoreneinnahmen erfasst.</div>';
            return;
        }
        box.innerHTML = entries.map(([name, total], idx) => `<div class="box" style="display:flex; justify-content:space-between; font-size:10px;"><span>#${idx + 1} ${name}</span><strong style="color:var(--accent);">${formatVal(Math.round(total))}</strong></div>`).join('');
    }

    function renderStockTicker() {
        let el = document.getElementById('fin-stock-ticker');
        if (!el) return;
        let dax = 16000 + Math.round((stockMarket.techCorp?.price || 100) * 8.4);
        let dollar = (1.02 + ((stockMarket.techCorp?.price || 100) % 30) / 100).toFixed(2);
        let gold = 420 + Math.round((stockMarket.greenEnergy?.price || 45) * 0.7);
        let daxUp = Math.random() > 0.5;
        let dollarUp = Math.random() > 0.5;
        let goldUp = Math.random() > 0.5;
        el.innerHTML = `
            <span>📈 DAX <span class="${daxUp ? 'tick-up' : 'tick-down'}">${dax} ${daxUp ? '▲' : '▼'}</span></span>
            <span>💵 DOLLAR <span class="${dollarUp ? 'tick-up' : 'tick-down'}">${dollar} ${dollarUp ? '▲' : '▼'}</span></span>
            <span>🥇 GOLD <span class="${goldUp ? 'tick-up' : 'tick-down'}">${gold} ${goldUp ? '▲' : '▼'}</span></span>
        `;
    }

    function renderFinancesView() {
        renderTicketPriceSliders();
        if (typeof renderMediaRightsView === 'function') renderMediaRightsView();
        renderStockTicker();
        renderSponsorLeaderboard();
        renderFinanceForecast();
        renderMoneyHistoryChart();
        renderFinanceLedger();
        let totalWages = (squad.reduce((s, p) => s + p.wage, 0) + (game.secondTeam.isActive ? secondTeamSquad.reduce((s, p) => s + p.wage, 0) : 0)) * 4;
        let totalStaffWages = Object.values(staffMembers).filter(s => s.hired).reduce((s, st) => s + st.wage, 0) * 4;
        // Dieselbe Rechnung wie in applyMatchdayFinances(), inkl. stillgelegter Ränge.
        let baseStadiumMaintenanceForecast = getStadiumBaseMaintenance();
        let campusMaintenanceSumForecast = Object.keys(campusBuildings).reduce((s, k) => s + (k === 'turnstiles' ? 0 : campusBuildings[k].lvl * 650), 0);
        let maintenance = Math.round((baseStadiumMaintenanceForecast + campusMaintenanceSumForecast) * 4);
        if (campusBuildings.turnstiles?.lvl > 0) maintenance = Math.round(maintenance * (1 - campusBuildings.turnstiles.lvl * 0.02));
        let loanInterest = Math.round(game.loanDebt * 0.04);
        let loanInstallments = activeLoans.reduce((s, l) => s + l.installment, 0) * 4;

        let estAttendance = Math.round((stadium.total || 16000) * getAttendanceFactor());
        let estTickets = Math.round((estAttendance * 0.5 * game.ticketPrices.steh + estAttendance * 0.45 * game.ticketPrices.sitz + Math.min(stadium.vipTotal || 50, estAttendance * 0.05) * game.ticketPrices.vip) * 2);
        let estMerch = Object.values(merchandise).reduce((sum, m) => sum + (m.lastSales?.revenue || 3500), 0) * 2;
        let estSponsors = Math.round((game.sponsor.base + getBandenIncome() + game.kitSupplier.income + (game.sleeveSponsor?.income || 0)) * 4);
        let dividends = Math.round(STOCK_KEYS.reduce((sum, key) => {
            let s = stockMarket[key];
            return s ? sum + (s.owned * s.price * s.dividendRate) : sum;
        }, 0));

        // Steuern & Abgaben: fallen auf die Spieltagseinnahmen an (Tickets/Fanartikel/
        // Sponsoren - NICHT auf Dividenden, die außerhalb der Spieltagsbilanz gutgeschrieben
        // werden, siehe applyMatchdayFinances). Dazu ggf. das Steuerberater-Honorar.
        let estTax = Math.round((estTickets + estMerch + estSponsors) * getTaxRate());
        let estAdvisorFee = financeCentralState.taxAdvisorHired ? getTaxAdvisorFee() * 4 : 0;

        let totalIn = estTickets + estMerch + estSponsors + dividends;
        let totalOut = totalWages + totalStaffWages + maintenance + loanInterest + loanInstallments + estTax + estAdvisorFee;
        let net = totalIn - totalOut;

        document.getElementById('fin-in-tickets').innerText = formatVal(estTickets);
        let lastAttEl = document.getElementById('fin-last-attendance');
        if (lastAttEl) lastAttEl.innerText = game.lastHomeAttendance > 0 ? `${game.lastHomeAttendance.toLocaleString('de-DE')} (Kapazität: ${(stadium.total || 16000).toLocaleString('de-DE')})` : 'Noch kein Heimspiel gespielt';
        document.getElementById('fin-in-merch').innerText = formatVal(estMerch);
        document.getElementById('fin-in-sponsors').innerText = formatVal(estSponsors);
        document.getElementById('fin-in-dividends').innerText = formatVal(dividends);

        document.getElementById('fin-out-wages').innerText = formatVal(totalWages + totalStaffWages);
        document.getElementById('fin-out-maintenance').innerText = formatVal(maintenance);
        // Hochrechnung: Ordnerdienst nur bei Heimspielen (~2 pro Monat).
        document.getElementById('fin-out-stewards').innerText = formatVal(getStewardMatchdayCost() * 2);
        document.getElementById('fin-out-interest').innerText = formatVal(loanInterest + loanInstallments);
        let taxEl = document.getElementById('fin-out-tax');
        if (taxEl) taxEl.innerText = formatVal(estTax + estAdvisorFee);
        let taxLabelEl = document.getElementById('fin-out-tax-label');
        if (taxLabelEl) {
            taxLabelEl.innerText = `Steuern & Abgaben (${Math.round(getTaxRate() * 100)}%)`
                + (financeCentralState.taxAdvisorHired ? ' inkl. Berater-Honorar:' : ':');
        }
        // Geschätzte Auswärtsfahrtkosten: ~17 Auswärtsspiele/Saison, hochgerechnet auf einen
        // Monat (4 Spieltage) - skaliert wie applyMatchdayFinances() mit Ligastufe & Reisemodus.
        let estTravelCost = Math.round((800 + (NUM_LEAGUES - game.leagueLevel) * 300) * (game.travelMode === 'bus' ? 0.55 : 1)) * 2;
        let travelEl = document.getElementById('fin-out-travel');
        if (travelEl) travelEl.innerText = formatVal(estTravelCost);
        ['flugzeug', 'bus'].forEach(m => {
            let btn = document.getElementById('travel-mode-' + m);
            if (btn) btn.className = (game.travelMode === m) ? 'btn-action' : 'btn-secondary';
        });
        let busSponsorBtn = document.getElementById('btn-bus-sponsoring');
        if (busSponsorBtn) {
            if (game.busSponsorActive) { busSponsorBtn.innerText = '🚌 Bus bereits gesponsert ✓'; busSponsorBtn.className = 'btn-action'; }
            else { busSponsorBtn.innerText = '🚌 Bus-Sponsoring verhandeln'; busSponsorBtn.className = 'btn-secondary'; }
        }

        let netEl = document.getElementById('fin-net-total');
        netEl.innerText = (net >= 0 ? '+' : '') + formatVal(net);
        netEl.style.color = net >= 0 ? 'var(--primary)' : 'var(--danger)';

        // Budget-Balken
        let currentWages = squad.reduce((s, p) => s + p.wage, 0) + (game.secondTeam.isActive ? secondTeamSquad.reduce((s, p) => s + p.wage, 0) : 0);
        let transferPct = Math.min(100, Math.round((game.transferBudget / Math.max(1, game.transferBudget)) * 100));
        document.getElementById('budget-transfer-bar-label').innerText = `Transferbudget: ${formatVal(game.transferBudget)}`;
        document.getElementById('budget-wage-bar-label').innerText = `Gehaltsbudget: ${formatVal(currentWages)} / ${formatVal(game.wageBudget)} pro Spieltag`;
        let wagePct = Math.min(100, Math.round((currentWages / Math.max(1, game.wageBudget)) * 100));
        let wageBar = document.getElementById('budget-wage-bar-fill');
        if (wageBar) {
            wageBar.style.width = wagePct + '%';
            wageBar.style.background = wagePct >= 95 ? 'var(--danger)' : (wagePct >= 75 ? 'var(--accent)' : 'var(--primary)');
        }

        // Insolvenz-Status
        let insolvencyBox = document.getElementById('insolvency-status-box');
        if (insolvencyBox) {
            if (game.negativeStreak > 0) {
                insolvencyBox.style.display = 'block';
                insolvencyBox.innerHTML = `⚠️ Konto seit <strong>${game.negativeStreak}</strong> Spieltagen im Minus.` +
                    (game.transferEmbargo ? ' <strong style="color:var(--danger);">TRANSFERSPERRE AKTIV!</strong>' : '') +
                    `<br><span style="font-size:9px;">Bei 6 Spieltagen in Folge droht eine Transfersperre, bei Vielfachen von 10 ein Zwangsverkauf, bei Vielfachen von 15 Punktabzug.</span>`;
            } else {
                insolvencyBox.style.display = 'none';
            }
        }

        // Kredite
        let loansList = document.getElementById('active-loans-list');
        if (loansList) {
            loansList.innerHTML = activeLoans.length === 0
                ? '<div style="font-size:10px; color:#64748b;">Keine laufenden Kredite.</div>'
                : activeLoans.map(l => `<div class="player-row"><span>${l.tierName}: noch ${formatVal(l.installment)}/SpT für ${l.matchdaysLeft} Spieltage</span></div>`).join('');
        }
        let legacyDebtEl = document.getElementById('legacy-loan-debt');
        if (legacyDebtEl) legacyDebtEl.innerText = formatVal(game.loanDebt);

        // Neue Finanz-Funktionen: Anzeige-Updates
        let fdBox = document.getElementById('fixed-deposit-box');
        if (fdBox) {
            let fd = financeCentralState.fixedDeposit;
            fdBox.innerHTML = fd
                ? `<div class="box" style="font-size:10px;">🏦 Festgeld: ${formatVal(fd.principal)} → ${formatVal(fd.payout)} in ${fd.matchdaysLeft} SpT</div>`
                : '<div style="font-size:9px; color:var(--text-muted);">Keine aktive Festgeldanlage.</div>';
        }
        let taxBtn = document.getElementById('btn-tax-advisor');
        if (taxBtn) {
            taxBtn.innerText = financeCentralState.taxAdvisorHired
                ? '📊 Steuerberater AKTIV (Mandat beenden)'
                : `📊 Steuerberater engagieren [${formatVal(TAX_ADVISOR_SIGNING_FEE)}]`;
        }
        // Erklärt direkt am Knopf, was das Mandat konkret bringt und kostet - vorher war
        // nirgends ersichtlich, dass der Berater überhaupt eine Wirkung hat.
        let taxNote = document.getElementById('tax-advisor-note');
        if (taxNote) {
            let lastTax = (game.lastMatchdayTax || 0) + (game.lastMatchdayAdvisorFee || 0);
            taxNote.innerHTML = `Auf alle Spieltagseinnahmen (Tickets, Fanartikel, Sponsoren) wird eine Abgabe fällig.<br>`
                + `Ohne Berater <strong>${Math.round(TAX_RATE_BASE * 100)}%</strong>, mit Berater <strong style="color:var(--primary);">${Math.round(TAX_RATE_WITH_ADVISOR * 100)}%</strong> `
                + `bei ${formatVal(getTaxAdvisorFee())} Honorar/Spieltag - er trägt sich ab rund <strong>${formatVal(getTaxAdvisorBreakEven())}</strong> Einnahmen pro Spieltag.<br>`
                + `Außerdem mildert er Finanzkrisen ab: Zwangsverkäufe bringen 75% statt 60% vom Marktwert, Punktabzüge fallen um einen Punkt geringer aus.<br>`
                + `<span style="color:var(--text-muted);">Letzter Spieltag: ${formatVal(lastTax)} abgeführt · diese Saison insgesamt ${formatVal(game.seasonTaxPaid || 0)}.</span>`;
        }
        let reserveBox = document.getElementById('reserve-fund-box');
        if (reserveBox) reserveBox.innerHTML = `🐷 Rücklagenfonds: <strong style="color:var(--accent);">${formatVal(financeCentralState.reserveFund)}</strong> ${financeCentralState.autoReserveActive ? `(auto. ${financeCentralState.autoReservePercent}% aktiv)` : ''}`;
        let ratingBox = document.getElementById('credit-rating-box');
        if (ratingBox) {
            let r = financeCentralState.creditRating;
            let ratingLabel = r >= 85 ? 'AAA (Top-Konditionen)' : (r >= 60 ? 'A (Normal)' : (r >= 35 ? 'BB (Aufschlag)' : 'C (Hoher Aufschlag)'));
            ratingBox.innerHTML = `💳 Kreditwürdigkeit: <strong style="color:${r >= 60 ? 'var(--primary)' : 'var(--danger)'};">${Math.round(r)}/100 (${ratingLabel})</strong>`;
        }
        let investorBtn = document.getElementById('btn-strategic-investor');
        if (investorBtn) investorBtn.innerText = financeCentralState.strategicInvestorTaken ? '💼 Strategischer Investor bereits an Bord' : '💼 Strategischen Investor aufnehmen [+400.000 €]';
        let loansListExt = document.getElementById('active-loans-list');
        if (loansListExt && activeLoans.length > 0) {
            loansListExt.innerHTML = activeLoans.map(l => `<div class="player-row"><span>${l.tierName}: noch ${formatVal(l.installment)}/SpT für ${l.matchdaysLeft} Spieltage</span><button onclick="specialRepayLoan(${l.id})" class="btn-secondary" style="width:auto; font-size:8px;">Sondertilgung</button></div>`).join('');
        }
    }

    function negotiateBoardBudget(type, amount) {
        playSound('click');
        let chance = (game.boardSat / 100) * 0.85;
        if (Math.random() < chance) {
            if (type === 'transfer') game.transferBudget += amount;
            if (type === 'wage') game.wageBudget += amount;
            game.boardSat = Math.max(10, game.boardSat - 5);
            showToast(`🎉 Verhandlung erfolgreich - ${formatVal(amount)} bewilligt.`, 'success', 5000);
        } else {
            game.boardSat = Math.max(10, game.boardSat - 10);
            showToast('❌ Abgelehnt - der Vorstand hält die Forderung für überzogen.', 'error', 5000);
        }
        updateUI();
        renderFinancesView();
    }

    // ==========================================
    // TICKETPREISE MIT SCHIEBEREGLERN & LIVE-VORSCHAU (NEU)
    // ==========================================
    // Ersetzt die einfachen Zahlenfelder durch Schieberegler mit sofortiger Vorschau
    // (erwartete Zuschauer, Auslastung, Tageskasse, Saison-Hochrechnung) - Preise werden
    // erst mit "Preise übernehmen" tatsächlich wirksam, vorher ist alles nur eine Vorschau.
    let ticketPricePreview = null; // null = noch keine Änderung, zeigt aktuelle Werte

    function getTicketSliderRange(category) {
        let market = getMarketTicketPrice(category);
        return { min: Math.max(1, Math.round(market * 0.35)), max: Math.round(market * 4) };
    }

    function updateTicketPriceSlider(category, value) {
        if (!ticketPricePreview) ticketPricePreview = { ...game.ticketPrices };
        ticketPricePreview[category] = parseInt(value);
        renderTicketPriceSliders();
    }

    function resetTicketPriceSliders() {
        ticketPricePreview = null;
        renderTicketPriceSliders();
    }

    function applyTicketRecommendation() {
        ticketPricePreview = {
            steh: getMarketTicketPrice('steh'),
            sitz: getMarketTicketPrice('sitz'),
            vip: getMarketTicketPrice('vip')
        };
        renderTicketPriceSliders();
    }

    function commitTicketPrices() {
        let preview = ticketPricePreview || game.ticketPrices;
        game.ticketPrices.steh = preview.steh;
        game.ticketPrices.sitz = preview.sitz;
        game.ticketPrices.vip = preview.vip;
        ticketPricePreview = null;
        showToast('🎟️ Neue Ticketpreise übernommen!', 'success');
        renderTicketPriceSliders();
        updateUI();
    }

    // Berechnet die Live-Vorschau-Kennzahlen für einen gegebenen Satz Ticketpreise, ohne
    // den echten Spielzustand zu verändern (reine Projektion).
    function computeTicketPreviewStats(prices) {
        let realPrices = { ...game.ticketPrices };
        game.ticketPrices = prices; // temporär für die Berechnung
        let attFactor = getAttendanceFactor();
        game.ticketPrices = realPrices; // sofort zurücksetzen
        let capacity = stadium.total || 16000;
        let totalAtt = Math.round(capacity * attFactor);
        let stehAtt = Math.round(totalAtt * 0.5);
        let sitzAtt = Math.round(totalAtt * 0.45);
        let vipAtt = Math.min(stadium.vipTotal || 50, Math.round(totalAtt * 0.05));
        let matchRevenue = Math.round(stehAtt * prices.steh + sitzAtt * prices.sitz + vipAtt * prices.vip);
        let homeMatchesPerSeason = 17;
        return {
            totalAtt, stehAtt, sitzAtt, vipAtt,
            utilization: capacity > 0 ? (totalAtt / capacity * 100) : 0,
            matchRevenue,
            seasonProjection: matchRevenue * homeMatchesPerSeason
        };
    }

    function renderTicketPriceSliders() {
        let box = document.getElementById('ticket-price-sliders-box');
        if (!box) return;
        let prices = ticketPricePreview || game.ticketPrices;
        let stats = computeTicketPreviewStats(prices);
        let currentStats = computeTicketPreviewStats(game.ticketPrices);
        let changePercent = currentStats.matchRevenue > 0 ? ((stats.matchRevenue - currentStats.matchRevenue) / currentStats.matchRevenue * 100) : 0;
        let feedbackText = Math.abs(changePercent) < 3 ? 'Moderate Anpassung. Niemand wird deshalb ein Transparent malen.'
            : (changePercent >= 15 ? '⚠️ Deutliche Preiserhöhung - die Fanszene wird das nicht kommentarlos hinnehmen.'
            : (changePercent <= -15 ? '📉 Deutliche Preissenkung - kurzfristig weniger Erlös, aber volle Ränge und gute Stimmung.' : 'Spürbare, aber vertretbare Anpassung.'));

        let sliderRow = (label, category, unit = '€') => {
            let range = getTicketSliderRange(category);
            let val = prices[category];
            return `
                <div style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;">
                        <strong>${label}</strong>
                        <strong style="color:var(--accent); font-size:13px;">${val} ${unit}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:8px; color:var(--text-muted);">${range.min}€</span>
                        <input type="range" min="${range.min}" max="${range.max}" value="${val}" oninput="updateTicketPriceSlider('${category}', this.value)" style="flex:1;">
                        <span style="font-size:8px; color:var(--text-muted);">${range.max}€</span>
                    </div>
                </div>`;
        };

        box.innerHTML = `
            <div style="font-size:9px; color:var(--text-muted); margin-bottom:10px;">Marktüblich: Steh ${getMarketTicketPrice('steh')}€ · Sitz ${getMarketTicketPrice('sitz')}€ · VIP ${getMarketTicketPrice('vip')}€</div>
            ${sliderRow('Stehplatz', 'steh')}
            ${sliderRow('Sitzplatz', 'sitz')}
            ${sliderRow('VIP-Loge', 'vip')}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin:12px 0;">
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">ERWARTETE ZUSCHAUER</div><div style="font-size:16px; font-weight:900;">${stats.totalAtt.toLocaleString('de-DE')}</div><div style="font-size:8px; color:var(--text-muted);">Steh ${stats.stehAtt.toLocaleString('de-DE')} · Sitz ${stats.sitzAtt.toLocaleString('de-DE')} · VIP ${stats.vipAtt}</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">AUSLASTUNG</div><div style="font-size:16px; font-weight:900; color:${stats.utilization>=70?'var(--primary)':'var(--accent)'};">${stats.utilization.toFixed(1)}%</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">TAGESKASSE JE HEIMSPIEL</div><div style="font-size:16px; font-weight:900; color:var(--gold);">${formatVal(stats.matchRevenue)}</div><div style="font-size:8px; color:${changePercent>=0?'var(--primary)':'var(--danger)'};">${changePercent>=0?'+':''}${changePercent.toFixed(1)}% ggü. jetzt</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">HOCHRECHNUNG SAISON</div><div style="font-size:16px; font-weight:900; color:var(--gold);">${formatVal(stats.seasonProjection)}</div><div style="font-size:8px; color:var(--text-muted);">17 Heimspiele, geschätzt</div></div>
            </div>
            <div style="font-size:10px; margin-bottom:10px;">${feedbackText}</div>
            <button onclick="commitTicketPrices()" class="btn-action" style="margin-bottom:6px;">✅ Preise übernehmen</button>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                <button onclick="applyTicketRecommendation()" class="btn-gold">💡 Empfehlung übernehmen</button>
                <button onclick="resetTicketPriceSliders()" class="btn-secondary">↺ Zurücksetzen</button>
            </div>
        `;
    }

    // Alt-Sofortkredit (bleibt aus Kompatibilitätsgründen bestehen: flacher Aufschlag, freie Rückzahlung)
    function takeLoan(amt) { playSound('click'); game.money += amt; game.loanDebt += Math.round(amt * 1.12); updateUI(); renderFinancesView(); }
    function payLoan(amt) { if (game.loanDebt <= 0 || game.money < amt) return; playSound('click'); game.money -= amt; game.loanDebt -= amt; updateUI(); renderFinancesView(); }

    // Neues Kreditsystem: gestaffelte Laufzeiten mit echter Ratenzahlung statt freier Rückzahlung
    function takeLoanTier(tierKey, amount) {
        if (activeLoans.length >= MAX_ACTIVE_LOANS) { showToast(`Maximal ${MAX_ACTIVE_LOANS} laufende Kredite gleichzeitig!`, 'error'); return; }
        let tier = LOAN_TIERS.find(t => t.key === tierKey);
        if (!tier || !amount || amount <= 0) { showToast('Bitte einen gültigen Betrag eingeben!', 'error'); return; }
        playSound('click');
        // Kreditwürdigkeits-Rating (Finanzen & Kapitalmarkt): gute Bonität senkt den Zinssatz,
        // schlechte erhöht ihn.
        let effectiveRate = Math.max(0.02, tier.rate + (typeof getCreditRatingInterestModifier === 'function' ? getCreditRatingInterestModifier() : 0));
        let totalToRepay = Math.round(amount * (1 + effectiveRate));
        let installment = Math.ceil(totalToRepay / tier.duration);
        game.money += amount;
        activeLoans.push({ id: Date.now(), tierName: tier.name, principal: amount, installment, matchdaysLeft: tier.duration, totalToRepay });
        renderFinancesView(); updateUI();
        showToast(`🏦 Kredit über ${formatVal(amount)} aufgenommen (${tier.name}: ${formatVal(installment)}/Spieltag für ${tier.duration} Spieltage)`, 'success');
    }

    function processLoanInstallments() {
        if (activeLoans.length === 0) return;
        activeLoans.forEach(loan => {
            game.money -= loan.installment;
            loan.matchdaysLeft--;
        });
        let completed = activeLoans.filter(l => l.matchdaysLeft <= 0);
        completed.forEach(l => showToast(`✅ Kredit "${l.tierName}" ist vollständig zurückgezahlt!`, 'success'));
        activeLoans = activeLoans.filter(l => l.matchdaysLeft > 0);
    }

    // Insolvenzrisiko: anhaltend negatives Konto hat echte, eskalierende Konsequenzen.
    function checkInsolvencyRisk() {
        if (game.money < 0) {
            game.negativeStreak = (game.negativeStreak || 0) + 1;
        } else {
            game.negativeStreak = 0;
            game.transferEmbargo = false;
            return;
        }
        let streak = game.negativeStreak;

        if (streak === 3) {
            showNotice('⚠️ Finanzwarnung', 'Der Vorstand beobachtet die andauernden roten Zahlen mit wachsender Sorge.', { typ: 'warn' });
            addInboxMessage('finanzen', 'Finanzwarnung', 'Der Vorstand beobachtet die andauernden roten Zahlen mit wachsender Sorge.', 'screen-finances');
        }
        if (streak === 6 && !game.transferEmbargo) {
            game.transferEmbargo = true;
            showNotice('🚫 Transfersperre', 'Wegen anhaltender Zahlungsprobleme verhängt der Vorstand eine Transfersperre, bis das Konto wieder im Plus ist.', { typ: 'warn' });
            addInboxMessage('finanzen', 'Transfersperre verhängt', 'Wegen anhaltender Zahlungsprobleme verhängt der Vorstand eine Transfersperre, bis das Konto wieder im Plus ist.', 'screen-finances');
        }
        if (streak > 0 && streak % 10 === 0 && squad.length > 11) {
            let candidate = [...squad].sort((a, b) => calculatePlayerMarketValue(b.strength) - calculatePlayerMarketValue(a.strength))[0];
            if (candidate) {
                let idx = squad.findIndex(p => p.id === candidate.id);
                // Steuerberater (Finanzen & Kapitalmarkt): mildert den Zwangsverkaufs-Abschlag ab.
                let sellFactor = financeCentralState.taxAdvisorHired ? 0.75 : 0.6;
                // Krisenfest (Krisenmanager-Perk, NEU): mildert Zwangsverkäufe zusätzlich ab.
                if (managerRPG.perks.crisisProof) sellFactor = Math.min(0.85, sellFactor + 0.1);
                let value = Math.round(calculatePlayerMarketValue(candidate.strength) * sellFactor);
                squad.splice(idx, 1);
                lineup = lineup.filter(id => id !== candidate.id);
                game.money += value;
                showNotice('💸 Zwangsverkauf', `Um die Zahlungsfähigkeit zu sichern, verkauft der Vorstand notgedrungen ${candidate.name} für ${formatVal(value)} - deutlich unter Marktwert.`, { typ: 'warn' });
                addInboxMessage('finanzen', 'Zwangsverkauf!', `Der Vorstand hat ${candidate.name} notgedrungen für ${formatVal(value)} verkauft (unter Marktwert).`, 'screen-finances');
            }
        }
        if (streak > 0 && streak % 15 === 0) {
            let myTeam = getOurLeagueTeam();
            if (myTeam) {
                // Steuerberater mildert auch den Punktabzug leicht ab.
                let deduction = financeCentralState.taxAdvisorHired ? 2 : 3;
                // Krisenfest (Krisenmanager-Perk, NEU): mildert auch den Punktabzug ab.
                if (managerRPG.perks.crisisProof) deduction = Math.max(1, deduction - 1);
                myTeam.points = Math.max(0, myTeam.points - deduction);
                showNotice('⚖️ Punktabzug', `Wegen anhaltender Zahlungsunfähigkeit verhängt der Verband einen Abzug von ${deduction} Punkten.`, { typ: 'warn' });
            }
        }
    }

    // ==========================================
    // FINANZEN & KAPITALMARKT: 15 NEUE FUNKTIONEN
    // ==========================================

    // 1. Finanzprognose: einfache Hochrechnung des Kontostands für die nächsten 4 Spieltage
    // auf Basis der aktuellen GuV-Nettobilanz.
    function renderFinanceForecast() {
        let box = document.getElementById('finance-forecast-box');
        if (!box) return;
        let netEl = document.getElementById('fin-net-total');
        let netPerMonth = netEl ? parseInt(netEl.innerText.replace(/[^\d-]/g, '')) || 0 : 0;
        let netPerMatchday = Math.round(netPerMonth / 4);
        let projections = [1, 2, 3, 4].map(n => Math.round(game.money + netPerMatchday * n));
        box.innerHTML = `<div class="box" style="font-size:9px;">📈 Prognose (bei gleichbleibender Bilanz): ${projections.map((v, i) => `SpT+${i+1}: <strong style="color:${v >= 0 ? 'var(--primary)' : 'var(--danger)'};">${formatVal(v)}</strong>`).join(' · ')}</div>`;
    }

    // 2. Festgeldanlage: Geld für eine feste Laufzeit anlegen, garantierte Rendite am Ende,
    // aber während der Laufzeit nicht verfügbar - Alternative zum riskanteren Aktienmarkt.
    function openFixedDeposit(amount, matchdays) {
        if (financeCentralState.fixedDeposit) { showToast('Es läuft bereits eine Festgeldanlage!', 'error'); return; }
        if (!amount || amount <= 0 || game.money < amount) { showToast('Ungültiger Betrag oder nicht genug Geld!', 'error'); return; }
        playSound('click');
        game.money -= amount;
        let rate = matchdays >= 20 ? 0.12 : (matchdays >= 10 ? 0.07 : 0.03);
        financeCentralState.fixedDeposit = { principal: amount, matchdaysLeft: matchdays, totalMatchdays: matchdays, payout: Math.round(amount * (1 + rate)) };
        showToast(`🏦 Festgeldanlage über ${formatVal(amount)} für ${matchdays} Spieltage eröffnet (Auszahlung: ${formatVal(financeCentralState.fixedDeposit.payout)}).`, 'success');
        renderFinancesView();
        updateUI();
    }
    function tickFixedDeposit() {
        let fd = financeCentralState.fixedDeposit;
        if (!fd) return;
        fd.matchdaysLeft--;
        if (fd.matchdaysLeft <= 0) {
            game.money += fd.payout;
            addInboxMessage('finanzen', '🏦 Festgeldanlage ausgezahlt!', `Die Festgeldanlage über ${formatVal(fd.principal)} wurde ausgezahlt: ${formatVal(fd.payout)}.`, 'screen-finances');
            financeCentralState.fixedDeposit = null;
        }
    }

    // 3. Ausgaben-Warnlimit: warnt aktiv, wenn die Gesamtausgaben pro Spieltag eine
    // selbst gesetzte Grenze überschreiten.
    function setExpenseWarningLimit(limit) {
        financeCentralState.expenseWarningLimit = limit;
        showToast(`⚠️ Ausgaben-Warnlimit auf ${formatVal(limit)}/SpT gesetzt.`, 'success');
        renderFinancesView();
    }

    // 4. Steuerberater
    // ------------------------------------------------------------------
    // Auf jede Spieltagseinnahme (Tickets + Fanartikel + Sponsoren) wird eine Abgabe
    // fällig - der Steuerberater senkt deren Satz und mildert zusätzlich die
    // Insolvenz-Eskalationen ab (siehe checkInsolvencyRisk()).
    //
    // Er kostet dafür ein laufendes Honorar pro Spieltag, das mit der Ligastufe steigt.
    // Dadurch ist es eine echte Entscheidung statt eines Selbstläufers: in den unteren
    // Ligen sind die Einnahmen so klein, dass die Ersparnis das Honorar kaum deckt,
    // weiter oben rechnet er sich deutlich.
    const TAX_RATE_BASE = 0.12;
    const TAX_RATE_WITH_ADVISOR = 0.07;
    const TAX_ADVISOR_SIGNING_FEE = 15000;

    function getTaxRate() {
        return financeCentralState.taxAdvisorHired ? TAX_RATE_WITH_ADVISOR : TAX_RATE_BASE;
    }
    function getTaxAdvisorFee() {
        return 250 + 250 * (NUM_LEAGUES - game.leagueLevel);
    }
    // Ab welcher Spieltagseinnahme trägt sich das Mandat selbst? (Ersparnis = Honorar)
    function getTaxAdvisorBreakEven() {
        return Math.round(getTaxAdvisorFee() / (TAX_RATE_BASE - TAX_RATE_WITH_ADVISOR));
    }

    function toggleTaxAdvisor() {
        if (!financeCentralState.taxAdvisorHired && game.money < TAX_ADVISOR_SIGNING_FEE) {
            showToast(`${formatVal(TAX_ADVISOR_SIGNING_FEE)} Honorar benötigt!`, 'error'); return;
        }
        if (!financeCentralState.taxAdvisorHired) game.money -= TAX_ADVISOR_SIGNING_FEE;
        financeCentralState.taxAdvisorHired = !financeCentralState.taxAdvisorHired;
        playSound('click');
        showToast(financeCentralState.taxAdvisorHired
            ? `📊 Steuerberater engagiert - Abgabensatz sinkt von ${Math.round(TAX_RATE_BASE * 100)}% auf ${Math.round(TAX_RATE_WITH_ADVISOR * 100)}%, Honorar ${formatVal(getTaxAdvisorFee())}/Spieltag.`
            : '📊 Steuerberater-Mandat beendet - es gilt wieder der volle Abgabensatz.', 'success');
        renderFinancesView();
        updateUI();
    }

    // 5. Automatische Rücklagenbildung: zweigt jeden Spieltag einen wählbaren Prozentsatz
    // des positiven Nettoergebnisses in einen separaten Rücklagenfonds ab.
    function toggleAutoReserve(percent) {
        financeCentralState.autoReserveActive = !financeCentralState.autoReserveActive;
        financeCentralState.autoReservePercent = percent || 10;
        playSound('click');
        showToast(financeCentralState.autoReserveActive ? `🐷 Automatische Rücklagenbildung aktiviert (${financeCentralState.autoReservePercent}% des Überschusses).` : '🐷 Automatische Rücklagenbildung deaktiviert.', 'success');
        renderFinancesView();
    }
    function withdrawReserveFund() {
        if (financeCentralState.reserveFund <= 0) { showToast('Rücklagenfonds ist leer!', 'error'); return; }
        playSound('goal');
        game.money += financeCentralState.reserveFund;
        showToast(`🐷 ${formatVal(financeCentralState.reserveFund)} aus dem Rücklagenfonds entnommen!`, 'success');
        financeCentralState.reserveFund = 0;
        renderFinancesView();
        updateUI();
    }
    function tickAutoReserve(netResult) {
        if (!financeCentralState.autoReserveActive || netResult <= 0) return;
        let cut = Math.round(netResult * (financeCentralState.autoReservePercent / 100));
        if (cut > 0 && game.money >= cut) {
            game.money -= cut;
            financeCentralState.reserveFund += cut;
        }
    }

    // 6. Kontostand-Verlauf-Diagramm: Balkenverlauf der letzten Spieltage.
    function tickMoneyHistory() {
        if (!financeCentralState.moneyHistory) financeCentralState.moneyHistory = [];
        financeCentralState.moneyHistory.push({ matchday: game.matchday, season: game.season, money: game.money });
        if (financeCentralState.moneyHistory.length > 20) financeCentralState.moneyHistory.shift();
    }
    function renderMoneyHistoryChart() {
        let box = document.getElementById('money-history-chart-box');
        if (!box) return;
        let hist = financeCentralState.moneyHistory || [];
        if (hist.length < 2) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch nicht genug Daten.</div>'; return; }
        let values = hist.map(h => h.money);
        let minV = Math.min(...values, 0), maxV = Math.max(...values, 1);
        box.innerHTML = `<div style="display:flex; align-items:flex-end; gap:2px; height:50px; background:rgba(0,0,0,0.2); border-radius:6px; padding:5px;">
            ${hist.map(h => {
                let pct = Math.max(4, Math.round(((h.money - minV) / Math.max(1, maxV - minV)) * 100));
                return `<div style="flex:1; height:${pct}%; background:linear-gradient(to top, var(--violet), var(--accent)); border-radius:2px 2px 0 0;" title="SpT ${h.matchday}: ${formatVal(h.money)}"></div>`;
            }).join('')}
        </div>`;
    }

    // 7. Kreditwürdigkeits-Rating: verbessert sich bei solider Wirtschaft, verschlechtert
    // sich bei roten Zahlen - beeinflusst den Zinssatz neuer Kredite.
    function tickCreditRating() {
        if (game.money >= 0 && game.negativeStreak === 0) financeCentralState.creditRating = Math.min(100, financeCentralState.creditRating + 0.3);
        else financeCentralState.creditRating = Math.max(10, financeCentralState.creditRating - 1.5);
    }
    function getCreditRatingInterestModifier() {
        if (financeCentralState.creditRating >= 85) return -0.03;
        if (financeCentralState.creditRating >= 60) return 0;
        if (financeCentralState.creditRating >= 35) return 0.03;
        return 0.07;
    }

    // 8. Kredit-Sondertilgung: vorzeitige Komplett-Rückzahlung eines Kredits mit Rabatt auf
    // die verbleibenden Zinsen.
    function specialRepayLoan(loanId) {
        let loan = activeLoans.find(l => l.id === loanId);
        if (!loan) return;
        let remainingTotal = loan.installment * loan.matchdaysLeft;
        let discountedPayoff = Math.round(remainingTotal * 0.85);
        if (game.money < discountedPayoff) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(discountedPayoff)}`, 'error'); return; }
        playSound('goal');
        game.money -= discountedPayoff;
        activeLoans = activeLoans.filter(l => l.id !== loanId);
        showToast(`✅ Kredit "${loan.tierName}" vorzeitig getilgt für ${formatVal(discountedPayoff)} (15% Rabatt)!`, 'success');
        renderFinancesView();
        updateUI();
    }

    // 9. Strategischer Investor: einmalige, große Kapitalspritze gegen dauerhaft reduzierte
    // Vorstands-Verhandlungsmacht (der Investor redet nun mit).
    function acceptStrategicInvestor() {
        if (financeCentralState.strategicInvestorTaken) { showToast('Bereits einen strategischen Investor an Bord!', 'error'); return; }
        playSound('goal');
        let injection = 400000;
        game.money += injection;
        financeCentralState.strategicInvestorTaken = true;
        game.boardSat = Math.max(10, game.boardSat - 10);
        addInboxMessage('finanzen', '💼 Strategischer Investor eingestiegen!', `Ein externer Investor schießt ${formatVal(injection)} zu - im Gegenzug hat der Vorstand künftig weniger Verhandlungsspielraum bei Budgetgesprächen.`, 'screen-finances');
        showToast(`💼 Strategischer Investor: +${formatVal(injection)}!`, 'success');
        renderFinancesView();
        updateUI();
    }


    // ==========================================
    // BUCHUNGSJOURNAL: aufgeschlüsselte Ein- und Ausgaben je Spieltag
    // ==========================================
    // Die GuV oben ist eine Hochrechnung mit Sammelposten ("Sponsoren, TV & Banden") und
    // beantwortet deshalb nicht, woher ein konkreter Betrag stammt. applyMatchdayFinances()
    // schreibt daher bei jeder Spieltagsabrechnung einen echten Buchungssatz nach
    // game.financeLedger - hier wird er sichtbar gemacht, wahlweise als Einzelspieltag
    // oder als Saisonsumme je Posten.
    let ledgerView = 'letzter';
    function setLedgerView(view) {
        ledgerView = view;
        renderFinanceLedger();
    }

    function ledgerRow(label, amount, maxAmount, color) {
        let pct = maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0;
        return `
            <div style="margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; gap:4px; font-size:11px;">
                    <span style="min-width:0;">${label}</span><span style="color:${color}; font-weight:bold; white-space:nowrap;">${formatVal(amount)}</span>
                </div>
                <div style="background:#1e293b; border-radius:4px; height:4px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:${color};"></div>
                </div>
            </div>`;
    }

    function renderFinanceLedger() {
        let box = document.getElementById('finance-ledger-box');
        if (!box) return;
        ['letzter', 'saison', 'konto'].forEach(v => {
            let btn = document.getElementById('ledger-tab-' + v);
            if (btn) btn.className = (ledgerView === v) ? 'btn-action' : 'btn-secondary';
        });

        if (ledgerView === 'konto') { renderKontoauszug(box); return; }

        let ledger = game.financeLedger || [];
        if (ledger.length === 0) {
            box.innerHTML = `<div class="box" style="font-size:11px; color:#94a3b8;">Noch keine Spieltagsabrechnung vorhanden. Nach dem ersten Spieltag steht hier jede Buchung einzeln aufgeschlüsselt.</div>`;
            return;
        }

        let einnahmen, ausgaben, kopf;
        if (ledgerView === 'saison') {
            let saisonEintraege = ledger.filter(e => e.season === game.season);
            if (saisonEintraege.length === 0) saisonEintraege = ledger.slice(-1);
            let sumEin = {}, sumAus = {};
            saisonEintraege.forEach(e => {
                (e.einnahmen || []).forEach(p => sumEin[p.label] = (sumEin[p.label] || 0) + p.amount);
                (e.ausgaben || []).forEach(p => sumAus[p.label] = (sumAus[p.label] || 0) + p.amount);
            });
            einnahmen = Object.keys(sumEin).map(l => ({ label: l, amount: sumEin[l] })).sort((a, b) => b.amount - a.amount);
            ausgaben = Object.keys(sumAus).map(l => ({ label: l, amount: sumAus[l] })).sort((a, b) => b.amount - a.amount);
            kopf = `Saison ${game.season} · ${saisonEintraege.length} abgerechnete Spieltage`;
        } else {
            let e = ledger[ledger.length - 1];
            einnahmen = (e.einnahmen || []).slice().sort((a, b) => b.amount - a.amount);
            ausgaben = (e.ausgaben || []).slice().sort((a, b) => b.amount - a.amount);
            kopf = `Saison ${e.season} · Spieltag ${e.matchday} · ${e.heimspiel ? `🏟️ Heimspiel (${(e.zuschauer || 0).toLocaleString('de-DE')} Zuschauer)` : '🚌 Auswärtsspiel'}`;
        }

        let sumEinGes = einnahmen.reduce((s, p) => s + p.amount, 0);
        let sumAusGes = ausgaben.reduce((s, p) => s + p.amount, 0);
        let saldo = sumEinGes - sumAusGes;
        let maxEin = Math.max(1, ...einnahmen.map(p => p.amount));
        let maxAus = Math.max(1, ...ausgaben.map(p => p.amount));

        let anteil = (amount, ges) => ges > 0 ? ` <span style="color:#64748b; font-size:9px;">(${Math.round((amount / ges) * 100)}%)</span>` : '';

        let verlauf = '';
        if (ledgerView === 'letzter' && ledger.length > 1) {
            verlauf = `<div class="box" style="margin-top:6px;">
                <strong style="font-size:11px;">📈 LETZTE SPIELTAGE</strong>
                ${ledger.slice(-6).reverse().map(e => {
                    let s = (e.summeEin || 0) - (e.summeAus || 0);
                    return `<div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>${e.heimspiel ? '🏟️' : '🚌'} ST ${e.matchday} (S${e.season})</span>
                        <span style="color:#94a3b8;">+${formatVal(e.summeEin || 0)} / -${formatVal(e.summeAus || 0)}</span>
                        <span style="color:${s >= 0 ? 'var(--primary)' : 'var(--danger)'}; font-weight:bold;">${s >= 0 ? '+' : ''}${formatVal(s)}</span>
                    </div>`;
                }).join('')}
            </div>`;
        }

        box.innerHTML = `
            <div style="font-size:10px; color:#94a3b8; margin-bottom:6px;">${kopf}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div class="box">
                    <strong style="color:var(--primary); font-size:11px;">EINNAHMEN ${formatVal(sumEinGes)}</strong>
                    <div style="margin-top:5px;">
                        ${einnahmen.length ? einnahmen.map(p => ledgerRow(p.label + anteil(p.amount, sumEinGes), p.amount, maxEin, 'var(--primary)')).join('') : '<span style="font-size:10px; color:#64748b;">Keine Einnahmen verbucht.</span>'}
                    </div>
                </div>
                <div class="box">
                    <strong style="color:var(--danger); font-size:11px;">AUSGABEN ${formatVal(sumAusGes)}</strong>
                    <div style="margin-top:5px;">
                        ${ausgaben.length ? ausgaben.map(p => ledgerRow(p.label + anteil(p.amount, sumAusGes), p.amount, maxAus, 'var(--danger)')).join('') : '<span style="font-size:10px; color:#64748b;">Keine Ausgaben verbucht.</span>'}
                    </div>
                </div>
            </div>
            <div style="text-align:right; font-size:12px; margin-top:6px;">
                ${ledgerView === 'saison' ? 'Saison-Saldo' : 'Saldo des Spieltags'}:
                <strong style="color:${saldo >= 0 ? 'var(--primary)' : 'var(--danger)'};">${saldo >= 0 ? '+' : ''}${formatVal(saldo)}</strong>
            </div>
            ${verlauf}`;
    }

    // ==========================================
    // KONTOAUSZUG: automatische Erfassung ALLER Kontobewegungen
    // ==========================================
    // Geld wird an über 150 Stellen im Spiel direkt über game.money verrechnet (Transfers,
    // Bauaufträge, Personal, Wetten, Fabriken ...). Statt jede dieser Stellen einzeln zu
    // protokollieren - was zwangsläufig lückenhaft bliebe - wird game.money hier in eine
    // Accessor-Property umgewandelt. Jede Änderung läuft damit durch einen einzigen
    // Kontrollpunkt und landet automatisch im Kontoauszug.
    let kontoauszugAktiv = false;
    let kontoauszugPausiert = false;
    let buchungsKontext = null;
    const SPIELTAG_KONTEXT = '__spieltag__';
    const MAX_KONTOAUSZUG = 150;

    const SCREEN_BUCHUNGS_LABELS = {
        'screen-transfer': '🔁 Transfermarkt',
        'screen-scouting-global': '🔍 Scouting',
        'screen-stadium': '🏟️ Stadionausbau',
        'screen-campus': '🏘️ Vereinsgelände',
        'screen-staff': '💼 Personal',
        'screen-youth': '🎓 Jugendarbeit',
        'screen-training': '🏋️ Training',
        'screen-fans': '📣 Fanarbeit',
        'screen-finances': '💰 Finanzen & Kredite',
        'screen-stocks': '📈 Börse',
        'screen-industry': '🏭 Fabriken',
        'screen-holding': '🏢 Holding',
        'screen-raw-materials': '📦 Rohstoffe',
        'screen-merch': '👕 Fanshop',
        'screen-betting': '🎲 Wetten',
        'screen-sponsors': '🤝 Sponsoren',
        'screen-contracts': '📝 Vertragsverhandlungen',
        'screen-calendar': '📅 Terminplanung',
        'screen-squad': '👥 Kader',
        'screen-second-team': '🅱️ Zweite Mannschaft',
        'screen-private': '🏠 Privatleben',
        'screen-underworld': '🌃 Zwielichtige Geschäfte',
        'screen-real-estate': '🏢 Immobilien',
        'screen-europe': '🌍 Europapokal',
        'screen-cup': '🏆 Pokalwettbewerb',
        'screen-premium': '💎 Premium',
        'screen-admin': '🛠️ Admin',
        'screen-inbox': '📬 Postfach',
        'screen-matchday': '⚽ Spieltag',
        'screen-dashboard': '🏠 Vereinsbüro',
        'screen-office': '🏠 Vereinsbüro',
        'screen-league': '🏆 Liga',
        'screen-history': '📚 Vereinsgeschichte',
        'screen-manager-tree': '🧑‍💼 Managerkarriere'
    };

    function buchungsLabelErmitteln() {
        if (buchungsKontext) return buchungsKontext;
        let screen = (typeof aktiverScreen === 'string') ? aktiverScreen : '';
        return SCREEN_BUCHUNGS_LABELS[screen] || '💶 Sonstige Buchung';
    }

    function protokolliereBuchung(delta, saldo) {
        if (buchungsKontext === SPIELTAG_KONTEXT) return; // steht bereits im Buchungsjournal
        if (!game.kontoauszug) game.kontoauszug = [];
        let label = buchungsLabelErmitteln();
        let letzte = game.kontoauszug[game.kontoauszug.length - 1];
        // Aufeinanderfolgende Buchungen derselben Aktion (z.B. Ablöse + Handgeld) werden zu
        // einer Zeile zusammengefasst, damit der Auszug lesbar bleibt.
        if (letzte && letzte.label === label && letzte.matchday === game.matchday
            && letzte.season === game.season && Math.sign(letzte.amount) === Math.sign(delta)) {
            letzte.amount += delta;
            letzte.saldo = saldo;
            return;
        }
        game.kontoauszug.push({ season: game.season, matchday: game.matchday, label, amount: delta, saldo });
        if (game.kontoauszug.length > MAX_KONTOAUSZUG) game.kontoauszug.shift();
    }

    function installKontoauszug() {
        if (kontoauszugAktiv) return;
        let kontostand = game.money;
        Object.defineProperty(game, 'money', {
            enumerable: true,
            configurable: true,
            get() { return kontostand; },
            set(neu) {
                let delta = neu - kontostand;
                kontostand = neu;
                if (!kontoauszugPausiert && Math.abs(delta) >= 1) protokolliereBuchung(delta, neu);
            }
        });
        kontoauszugAktiv = true;
    }
    // Während des Ladens eines Spielstands (Object.assign auf game) darf nicht protokolliert
    // werden - sonst erschiene der geladene Kontostand als riesige Phantom-Buchung.
    function kontoauszugPausieren() { kontoauszugPausiert = true; }
    function kontoauszugFortsetzen() { kontoauszugPausiert = false; }
    function setzeBuchungskontext(label) { buchungsKontext = label; }

    // Nachtragsbuchung ins Journal des laufenden Spieltags: einige Spieltagskosten fallen
    // erst NACH applyMatchdayFinances() an (z.B. der Ordnerdienst in processPostMatchRoutine).
    // Sie gehören trotzdem in die Spieltagsabrechnung und nicht in den Kontoauszug.
    // Gibt es fuer den laufenden Spieltag ueberhaupt eine Abrechnung? Nur dann hat auch ein
    // Spiel stattgefunden: an spielfreien Spieltagen steigt startMatchdayFlow() frueh aus
    // und ruft processPostMatchRoutine() ohne vorheriges applyMatchdayFinances() auf.
    function hatSpieltagsabrechnung() {
        let ledger = game.financeLedger || [];
        let eintrag = ledger[ledger.length - 1];
        return !!eintrag && eintrag.matchday === game.matchday && eintrag.season === game.season;
    }

    function bucheInSpieltagsjournal(label, amount, typ = 'ausgaben') {
        if (!(amount > 0) || !hatSpieltagsabrechnung()) return;
        let ledger = game.financeLedger || [];
        let eintrag = ledger[ledger.length - 1];
        let liste = eintrag[typ] || (eintrag[typ] = []);
        let posten = liste.find(p => p.label === label);
        if (posten) posten.amount += amount; else liste.push({ label, amount });
        eintrag[typ === 'einnahmen' ? 'summeEin' : 'summeAus'] = liste.reduce((s, p) => s + p.amount, 0);
    }
    function loescheBuchungskontext() { buchungsKontext = null; }


    // Kontoauszug-Ansicht: chronologische Liste aller Kontobewegungen ausserhalb der
    // Spieltagsabrechnung, plus eine Zusammenfassung je Bereich.
    function renderKontoauszug(box) {
        let auszug = game.kontoauszug || [];
        if (auszug.length === 0) {
            box.innerHTML = `<div class="box" style="font-size:11px; color:#94a3b8;">Noch keine Buchungen ausserhalb der Spieltagsabrechnung. Sobald Sie kaufen, bauen, Personal einstellen oder Kredite aufnehmen, steht hier jede Bewegung mit Bereich und Kontostand.</div>`;
            return;
        }
        let proBereich = {};
        auszug.forEach(b => {
            if (!proBereich[b.label]) proBereich[b.label] = { ein: 0, aus: 0 };
            if (b.amount >= 0) proBereich[b.label].ein += b.amount;
            else proBereich[b.label].aus += -b.amount;
        });
        let bereiche = Object.keys(proBereich)
            .map(l => ({ label: l, ...proBereich[l], netto: proBereich[l].ein - proBereich[l].aus }))
            .sort((a, b) => (b.ein + b.aus) - (a.ein + a.aus));

        box.innerHTML = `
            <div style="font-size:10px; color:#94a3b8; margin-bottom:6px;">Alle Kontobewegungen ausserhalb der Spieltagsabrechnung (letzte ${MAX_KONTOAUSZUG} Buchungen). Die Spieltagsposten finden Sie in den beiden anderen Reitern.</div>
            <div class="box" style="margin-bottom:6px;">
                <strong style="font-size:11px;">📊 NACH BEREICH</strong>
                ${bereiche.map(b => `
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:3px;">
                        <span>${b.label}</span>
                        <span><span style="color:var(--primary);">+${formatVal(b.ein)}</span> / <span style="color:var(--danger);">-${formatVal(b.aus)}</span>
                        <strong style="color:${b.netto >= 0 ? 'var(--primary)' : 'var(--danger)'};">${b.netto >= 0 ? '+' : ''}${formatVal(b.netto)}</strong></span>
                    </div>`).join('')}
            </div>
            <div class="box">
                <strong style="font-size:11px;">🧾 EINZELBUCHUNGEN (neueste zuerst)</strong>
                ${auszug.slice().reverse().map(b => `
                    <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:10px; margin-top:3px; border-bottom:1px solid #1e293b; padding-bottom:2px;">
                        <span style="color:#94a3b8;">S${b.season}/ST${b.matchday}</span>
                        <span style="flex:1; margin:0 6px;">${b.label}</span>
                        <span style="color:${b.amount >= 0 ? 'var(--primary)' : 'var(--danger)'}; font-weight:bold;">${b.amount >= 0 ? '+' : '-'}${formatVal(Math.abs(b.amount))}</span>
                        <span style="color:#64748b; margin-left:6px; min-width:58px; text-align:right;">${formatVal(b.saldo)}</span>
                    </div>`).join('')}
            </div>`;
    }

    installKontoauszug();
