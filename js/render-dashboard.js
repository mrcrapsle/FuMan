    function renderDashboardView() {
        document.getElementById('dash-mday').innerText = Math.min(34, game.matchday);
        document.getElementById('dash-league-name').innerText = leagueNames[game.leagueLevel];
        document.getElementById('dash-transfer-budget').innerText = formatVal(game.transferBudget);
        document.getElementById('dash-wage-budget').innerText = formatVal(game.wageBudget) + " / SpT";
        document.getElementById('dash-holding-cap').innerText = formatVal(holdingCompany.money);

        let alertBox = document.getElementById('dash-offers-alert');
        if (alertBox) {
            if (incomingOffers.length > 0) {
                alertBox.style.display = 'block';
                document.getElementById('dash-offers-alert-count').innerText = incomingOffers.length;
            } else {
                alertBox.style.display = 'none';
            }
        }

        let activeFactCount = Object.values(factories).filter(f => f.owned).length;
        document.getElementById('dash-active-factories').innerText = `${activeFactCount} / 4`;
        document.getElementById('dash-raw-total').innerText = (rawMaterials.totalStock || 0).toLocaleString() + " kg";

        let fixtures = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][Math.min(33, game.matchday - 1)] : null;
        let oppName = "Spielfrei";
        let oppStr = 55;
        if (fixtures) {
            let ourMatch = fixtures.find(f => leaguesData[game.leagueLevel][f.home]?.name === "Lok Leipzig" || leaguesData[game.leagueLevel][f.away]?.name === "Lok Leipzig");
            if (ourMatch) {
                let isHome = leaguesData[game.leagueLevel][ourMatch.home].name === "Lok Leipzig";
                oppName = isHome ? leaguesData[game.leagueLevel][ourMatch.away].name : leaguesData[game.leagueLevel][ourMatch.home].name;
                let oppTeam = leaguesData[game.leagueLevel].find(t => t.name === oppName);
                if (oppTeam) oppStr = oppTeam.strength;
            }
        }
        document.getElementById('dash-opp-name').innerText = oppName;
        document.getElementById('dash-opp-str').innerText = oppStr;
        document.getElementById('dash-our-str').innerText = calcTeamStrength(true);

        document.getElementById('dash-europe-status').innerText = game.inEurope ? "🏆 Champions Cup Gruppenphase" : "Nicht qualifiziert";
        let activePerks = Object.values(managerRPG.perks).filter(Boolean).length;
        let totalPerksCount = Object.keys(managerRPG.perks).length;
        document.getElementById('dash-perks-count').innerText = `${activePerks} / ${totalPerksCount} Aktiv`;

        let totalWages = squad.reduce((s, p) => s + p.wage, 0) * 4;
        let totalStaffWages = Object.values(staffMembers).filter(s => s.hired).reduce((s, st) => s + st.wage, 0) * 4;
        let maintenance = Math.round(((stadium.total || 16000) * 0.45 + Object.values(campusBuildings).reduce((s, b) => s + b.lvl * 650, 0)) * 4);
        let loanInterest = Math.round(game.loanDebt * 0.04);
        let estAttendance = Math.round((stadium.total || 16000) * getAttendanceFactor());
        let estTickets = Math.round((estAttendance * 0.5 * game.ticketPrices.steh + estAttendance * 0.45 * game.ticketPrices.sitz + Math.min(stadium.vipTotal || 50, estAttendance * 0.05) * game.ticketPrices.vip) * 2);
        let estMerch = Object.values(merchandise).reduce((sum, m) => sum + (m.lastSales?.revenue || 3500), 0) * 2;
        let estSponsors = Math.round((game.sponsor.base + getBandenIncome() + game.kitSupplier.income) * 4);
        let monthlyNet = (estTickets + estMerch + estSponsors) - (totalWages + totalStaffWages + maintenance + loanInterest);

        let monthlyNetEl = document.getElementById('dash-monthly-net');
        if (monthlyNetEl) {
            monthlyNetEl.innerText = (monthlyNet >= 0 ? '+' : '') + formatVal(monthlyNet);
            monthlyNetEl.style.color = monthlyNet >= 0 ? 'var(--primary)' : 'var(--danger)';
        }

        let isSeasonOver = game.matchday > 34;
        document.getElementById('dash-match-actions').style.display = isSeasonOver ? 'none' : 'grid';
        document.getElementById('dash-season-end-actions').style.display = isSeasonOver ? 'block' : 'none';

        renderSaveSlotsUI();
        renderNextGoalsList();
        renderWeeklyRecap();
    }

    // ==========================================
    // DASHBOARD: NEUE FUNKTIONEN
    // ==========================================

    // 1. "Nächste Ziele"-Liste: konkrete, erreichbare Kurzfrist-Ziele statt nur abstrakter
    // Übersichtszahlen - motiviert mit klaren nächsten Schritten.
    function renderNextGoalsList() {
        let box = document.getElementById('dash-next-goals-box');
        if (!box) return;
        let goals = [];
        let teams = leaguesData[game.leagueLevel];
        let us = teams ? teams.find(t => t.name === "Lok Leipzig") : null;
        if (us && teams) {
            let sorted = [...teams].sort((a, b) => b.points - a.points);
            let ourRank = sorted.findIndex(t => t.name === "Lok Leipzig") + 1;
            if (ourRank > 1) {
                let above = sorted[ourRank - 2];
                let gap = above.points - us.points;
                if (gap > 0) goals.push(`⚽ Noch ${gap} Punkt(e) bis auf Platz ${ourRank - 1} (${above.name})`);
            }
            if (ourRank <= 4 && game.leagueLevel === 0) goals.push(`🏆 Champions-Cup-Platz halten (aktuell Platz ${ourRank})`);
            if (ourRank >= teams.length - 2) goals.push(`⚠️ Abstiegsplatz droht - dringend Punkte sammeln!`);
        }
        if (game.money < 0) goals.push(`💰 Kontostand ausgleichen (aktuell ${formatVal(game.money)})`);
        if ((financeCentralState?.creditRating || 70) < 40) goals.push(`💳 Kreditwürdigkeit verbessern (aktuell ${Math.round(financeCentralState.creditRating)}/100)`);
        if (game.boardSat < 40) goals.push(`🏢 Vorstands-Zufriedenheit stabilisieren (aktuell ${game.boardSat}%)`);
        if (cupTournament.currentRound < cupTournament.roundNames.length && !cupTournament.eliminated) {
            goals.push(`🏆 DFB-Pokal: nächste Runde erreichen (${cupTournament.roundNames[cupTournament.currentRound]})`);
        }
        if (goals.length === 0) goals.push('✅ Aktuell keine dringenden Ziele - alles im grünen Bereich!');
        box.innerHTML = goals.slice(0, 4).map(g => `<div class="box" style="font-size:10px;">${g}</div>`).join('');
    }

    // 2. Wochenrückblick: kompakte Zusammenfassung der letzten paar Spieltage statt das
    // Postfach komplett durchsuchen zu müssen.
    function renderWeeklyRecap() {
        let box = document.getElementById('dash-weekly-recap-box');
        if (!box) return;
        let recentMessages = inboxMessages.filter(m => m.matchday >= game.matchday - 3 && m.season === game.season).slice(0, 4);
        box.innerHTML = recentMessages.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Keine besonderen Ereignisse in den letzten Spieltagen.</div>'
            : recentMessages.map(m => `<div style="font-size:9px; margin-bottom:3px;">• ${m.title}</div>`).join('');
    }
