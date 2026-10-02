
    // ==========================================
    // FINANZ-DASHBOARD-CHARTS
    // ==========================================
    // Visuelle Darstellung von Einnahmen/Ausgaben-Trends,
    // Budgetentwicklung und Umsatzquellen

    let financialHistory = {
        monthlyData: [], // Array von { month, income, expenses, balance }
        revenueBreakdown: { tickets: 0, merch: 0, sponsoring: 0, dividends: 0, other: 0 }
    };

    function recordFinancialMonth() {
        // Calculate monthly income from various sources
        let income = 0;
        let expenses = 0;

        // Estimate based on current game state
        let estAttendance = Math.round((stadium.total || 16000) * getAttendanceFactor?.() || 0.4);
        let estTickets = Math.round((estAttendance * 0.5 * game.ticketPrices.steh + estAttendance * 0.45 * game.ticketPrices.sitz + Math.min(stadium.vipTotal || 50, estAttendance * 0.05) * game.ticketPrices.vip) * 2);
        let estMerch = Object.values(merchandise || {}).reduce((sum, m) => sum + (m?.lastSales?.revenue || 3500), 0) * 2 || 0;
        let estSponsors = (game.sponsor?.base || 0) + (getBandenIncome?.() || 0) + (game.kitSupplier?.income || 0) + (game.sleeveSponsor?.income || 0);
        estSponsors = Math.round(estSponsors * 4);
        let dividends = Math.round((STOCK_KEYS?.reduce((sum, key) => {
            let s = stockMarket?.[key];
            return s ? sum + (s.owned * s.price * s.dividendRate) : sum;
        }, 0) || 0));

        income = estTickets + estMerch + estSponsors + dividends;

        // Estimate expenses
        let totalWages = (squad.reduce((s, p) => s + p.wage, 0) + (game.secondTeam?.isActive ? secondTeamSquad?.reduce((s, p) => s + p.wage, 0) || 0 : 0)) * 4;
        let totalStaffWages = (staffMembers ? Object.values(staffMembers).filter(s => s.hired).reduce((s, st) => s + st.wage, 0) : 0) * 4;
        let baseStadiumMaintenanceForecast = getStadiumBaseMaintenance?.() || 5000;
        let campusMaintenanceSumForecast = Object.keys(campusBuildings || {}).reduce((s, k) => s + (k === 'turnstiles' ? 0 : (campusBuildings[k]?.lvl || 0) * 650), 0);
        let maintenance = Math.round((baseStadiumMaintenanceForecast + campusMaintenanceSumForecast) * 4);
        if (campusBuildings?.turnstiles?.lvl > 0) maintenance = Math.round(maintenance * (1 - campusBuildings.turnstiles.lvl * 0.02));
        let loanInterest = Math.round(game.loanDebt * 0.04);
        let loanInstallments = (activeLoans || []).reduce((s, l) => s + l.installment, 0) * 4;
        let estTravelCost = Math.round((800 + (NUM_LEAGUES - game.leagueLevel) * 300) * (game.travelMode === 'bus' ? 0.55 : 1)) * 2;
        let estTax = Math.round((estTickets + estMerch + estSponsors) * (getTaxRate?.() || 0.07));
        let estAdvisorFee = (financeCentralState?.taxAdvisorHired ? getTaxAdvisorFee?.() * 4 : 0) || 0;

        expenses = totalWages + totalStaffWages + maintenance + loanInterest + loanInstallments + estTravelCost + estTax + estAdvisorFee;

        let balance = income - expenses;
        let month = game.season * 12 + (game.month || 1);

        financialHistory.monthlyData.push({
            month: month,
            seasonMonth: game.month || 1,
            season: game.season,
            income: income,
            expenses: expenses,
            balance: balance,
            money: game.money
        });

        // Keep only last 24 months for performance
        if (financialHistory.monthlyData.length > 24) {
            financialHistory.monthlyData.shift();
        }
    }

    function renderFinancialCharts() {
        renderMonthlyTrendChart();
        renderRevenueBreakdownChart();
        renderCashflowBar();
    }

    function renderMonthlyTrendChart() {
        let container = document.getElementById('fin-trend-chart');
        if (!container || financialHistory.monthlyData.length < 2) return;

        let data = financialHistory.monthlyData.slice(-12); // Last 12 months
        let maxVal = Math.max(...data.map(d => d.income), ...data.map(d => d.expenses)) || 100000;
        let chartHeight = 120;
        let breite = container.offsetWidth || 320; // 0, solange der Screen versteckt ist
        let barWidth = Math.max(20, Math.floor((breite - 40) / data.length));

        let html = `
            <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">Gewinn- & Verlusttrend (letzte 12 Monate)</div>
            <div style="display:flex; align-items:flex-end; justify-content:space-around; height:${chartHeight}px; background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; gap:3px; border:1px solid rgba(255,255,255,0.1);">
        `;

        data.forEach((d, i) => {
            let incomeHeight = (d.income / maxVal) * (chartHeight - 16);
            let expenseHeight = (d.expenses / maxVal) * (chartHeight - 16);

            html += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1; min-width:${barWidth}px;">
                    <div style="display:flex; align-items:flex-end; height:${chartHeight - 16}px; gap:1px; width:100%; justify-content:center;">
                        <div style="width:${Math.max(2, barWidth/3)}px; height:${incomeHeight}px; background:var(--primary); border-radius:2px 2px 0 0; opacity:0.7;" title="+${formatVal(d.income)}"></div>
                        <div style="width:${Math.max(2, barWidth/3)}px; height:${expenseHeight}px; background:var(--danger); border-radius:2px 2px 0 0; opacity:0.7;" title="-${formatVal(d.expenses)}"></div>
                    </div>
                    <span style="font-size:8px; color:#666; white-space:nowrap;">M${d.seasonMonth}</span>
                </div>
            `;
        });

        html += `
            </div>
            <div style="display:flex; justify-content:space-between; font-size:8px; color:#94a3b8; margin-top:4px;">
                <span><span style="display:inline-block; width:8px; height:8px; background:var(--primary); border-radius:2px; margin-right:2px;"></span>Einnahmen</span>
                <span><span style="display:inline-block; width:8px; height:8px; background:var(--danger); border-radius:2px; margin-right:2px;"></span>Ausgaben</span>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderRevenueBreakdownChart() {
        let container = document.getElementById('fin-revenue-breakdown');
        if (!container) return;

        // Calculate current month income
        let estAttendance = Math.round((stadium.total || 16000) * (getAttendanceFactor?.() || 0.4));
        let tickets = Math.round((estAttendance * 0.5 * game.ticketPrices.steh + estAttendance * 0.45 * game.ticketPrices.sitz + Math.min(stadium.vipTotal || 50, estAttendance * 0.05) * game.ticketPrices.vip) * 2);
        let merch = Object.values(merchandise || {}).reduce((sum, m) => sum + (m?.lastSales?.revenue || 3500), 0) * 2 || 0;
        let sponsoring = (game.sponsor?.base || 0) + (getBandenIncome?.() || 0) + (game.kitSupplier?.income || 0) + (game.sleeveSponsor?.income || 0);
        sponsoring = Math.round(sponsoring * 4);
        let dividends = Math.round((STOCK_KEYS?.reduce((sum, key) => {
            let s = stockMarket?.[key];
            return s ? sum + (s.owned * s.price * s.dividendRate) : sum;
        }, 0) || 0));

        let total = tickets + merch + sponsoring + dividends;
        if (total === 0) {
            container.innerHTML = '<div style="font-size:9px; color:#94a3b8;">Noch keine Einnahmen diesen Monat</div>';
            return;
        }

        let breakdown = [
            { label: '🎫 Ticketverkäufe', amount: Math.max(0, tickets), color: 'var(--primary)' },
            { label: '🏪 Merchandising', amount: Math.max(0, merch), color: 'var(--accent)' },
            { label: '🤝 Sponsoring', amount: Math.max(0, sponsoring), color: 'var(--gold)' },
            { label: '📈 Dividenden', amount: Math.max(0, dividends), color: 'var(--teal)' }
        ].filter(b => b.amount > 0);

        let html = '<div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">Einnahmen-Quellen</div>';
        breakdown.forEach(b => {
            let pct = (b.amount / total * 100).toFixed(0);
            html += `
                <div style="margin-bottom:6px;">
                    <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px;">
                        <span>${b.label}</span>
                        <strong style="color:${b.color};">${pct}% (${formatVal(b.amount)})</strong>
                    </div>
                    <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:${b.color}; border-radius:3px;"></div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function renderCashflowBar() {
        let container = document.getElementById('fin-cashflow-bar');
        if (!container) return;

        // Calculate current month cashflow
        let estAttendance = Math.round((stadium.total || 16000) * (getAttendanceFactor?.() || 0.4));
        let estTickets = Math.round((estAttendance * 0.5 * game.ticketPrices.steh + estAttendance * 0.45 * game.ticketPrices.sitz + Math.min(stadium.vipTotal || 50, estAttendance * 0.05) * game.ticketPrices.vip) * 2);
        let estMerch = Object.values(merchandise || {}).reduce((sum, m) => sum + (m?.lastSales?.revenue || 3500), 0) * 2 || 0;
        let estSponsors = (game.sponsor?.base || 0) + (getBandenIncome?.() || 0) + (game.kitSupplier?.income || 0) + (game.sleeveSponsor?.income || 0);
        estSponsors = Math.round(estSponsors * 4);
        let dividends = Math.round((STOCK_KEYS?.reduce((sum, key) => {
            let s = stockMarket?.[key];
            return s ? sum + (s.owned * s.price * s.dividendRate) : sum;
        }, 0) || 0));
        let income = estTickets + estMerch + estSponsors + dividends;

        let totalWages = (squad.reduce((s, p) => s + p.wage, 0) + (game.secondTeam?.isActive ? secondTeamSquad?.reduce((s, p) => s + p.wage, 0) || 0 : 0)) * 4;
        let totalStaffWages = (staffMembers ? Object.values(staffMembers).filter(s => s.hired).reduce((s, st) => s + st.wage, 0) : 0) * 4;
        let baseStadiumMaintenanceForecast = getStadiumBaseMaintenance?.() || 5000;
        let campusMaintenanceSumForecast = Object.keys(campusBuildings || {}).reduce((s, k) => s + (k === 'turnstiles' ? 0 : (campusBuildings[k]?.lvl || 0) * 650), 0);
        let maintenance = Math.round((baseStadiumMaintenanceForecast + campusMaintenanceSumForecast) * 4);
        if (campusBuildings?.turnstiles?.lvl > 0) maintenance = Math.round(maintenance * (1 - campusBuildings.turnstiles.lvl * 0.02));
        let loanInterest = Math.round(game.loanDebt * 0.04);
        let loanInstallments = (activeLoans || []).reduce((s, l) => s + l.installment, 0) * 4;
        let estTravelCost = Math.round((800 + (NUM_LEAGUES - game.leagueLevel) * 300) * (game.travelMode === 'bus' ? 0.55 : 1)) * 2;
        let estTax = Math.round((estTickets + estMerch + estSponsors) * (getTaxRate?.() || 0.07));
        let estAdvisorFee = (financeCentralState?.taxAdvisorHired ? getTaxAdvisorFee?.() * 4 : 0) || 0;
        let expenses = totalWages + totalStaffWages + maintenance + loanInterest + loanInstallments + estTravelCost + estTax + estAdvisorFee;

        let balance = income - expenses;

        let isProfit = balance >= 0;
        let statusColor = isProfit ? 'var(--primary)' : 'var(--danger)';
        let total = income + expenses;

        container.innerHTML = `
            <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">Monatlicher Cashflow</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:6px;">
                <div>
                    <div style="font-size:9px; margin-bottom:2px;">
                        <strong style="color:var(--primary);">+ Einnahmen</strong>
                    </div>
                    <div style="font-size:11px; color:var(--primary); font-weight:700;">${formatVal(income)}</div>
                </div>
                <div>
                    <div style="font-size:9px; margin-bottom:2px;">
                        <strong style="color:var(--danger);">- Ausgaben</strong>
                    </div>
                    <div style="font-size:11px; color:var(--danger); font-weight:700;">-${formatVal(expenses)}</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; margin-bottom:4px;">
                <div style="display:flex; height:20px; border-radius:4px; overflow:hidden; gap:1px;">
                    <div style="flex:${income}; background:var(--primary); position:relative;">
                        <span style="position:absolute; left:50%; transform:translateX(-50%); top:50%; transform:translate(-50%, -50%); font-size:10px; color:#000; white-space:nowrap; font-weight:700;">${total > 0 ? (income/total*100).toFixed(0) : '0'}%</span>
                    </div>
                    <div style="flex:${expenses}; background:var(--danger); position:relative;">
                        <span style="position:absolute; left:50%; transform:translateX(-50%); top:50%; transform:translate(-50%, -50%); font-size:10px; color:#fff; white-space:nowrap; font-weight:700;">${total > 0 ? (expenses/total*100).toFixed(0) : '0'}%</span>
                    </div>
                </div>
            </div>
            <div style="text-align:center; font-size:10px; padding:6px; background:${isProfit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; border-radius:4px; color:${statusColor}; border:1px solid ${statusColor};">
                <div style="font-size:9px; color:#aaa;">Monatlicher Gewinn/Verlust</div>
                <div style="font-size:14px; font-weight:700;">${isProfit ? '+' : '-'}${formatVal(Math.abs(balance))}</div>
            </div>
        `;
    }
