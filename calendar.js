
    function renderCalendarView() {
        const months = ["August", "September", "Oktober", "November", "Dezember", "Januar", "Februar", "März", "April", "Mai"];
        let monthIdx = Math.min(9, Math.floor((game.matchday - 1) / 3.5));
        document.getElementById('cal-month-name').innerText = months[monthIdx];

        let list = document.getElementById('cal-schedule-list');
        list.innerHTML = '';
        for (let i = 1; i <= 34; i++) {
            let item = document.createElement('div');
            item.className = 'player-row';
            let isCurrent = (i === game.matchday);
            let isCup = cupTournament.matchdays.includes(i);
            let isEuro = europeTournament.matchdays.includes(i);

            let eventText = isCup ? '🏆 DFB-Pokal Termin' : (isEuro ? '🌟 Champions Cup Spieltag' : '⚽ Ligaspiel');
            let eventColor = isCup ? 'var(--accent)' : (isEuro ? '#82b1ff' : '#aaa');

            item.innerHTML = `
                <span><strong>Spieltag ${i}</strong> ${isCurrent ? '<span style="color:var(--primary); font-weight:900;">(HEUTE)</span>' : ''}</span>
                <span style="color:${eventColor}; font-weight:bold;">${eventText}</span>
            `;
            if (isCurrent) item.style.borderColor = "var(--primary)";
            list.appendChild(item);
        }
    }

    function scheduleFriendlyMatch() {
        playSound('whistle');
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let income = Math.round((35000 + Math.floor(Math.random() * 25000)) * scale * 8);
        game.money += income;
        squad.forEach(p => { p.fitness = Math.min(100, p.fitness + 5); p.morale = Math.min(100, p.morale + 3); });
        addManagerXP(50);
        updateUI();
        alert(`⚽ Testspiel absolviert! Einnahmen: +${formatVal(income)}`);
    }

    // Auslandsreise für ein prestigeträchtiges Testspiel gegen einen internationalen
    // Top-Klub: deutlich höhere Einnahmen & Fan-/Prestige-Bonus als das normale Testspiel,
    // dafür etwas Reise-Ermüdung statt vollständiger Erholung.
    function scheduleForeignFriendly() {
        playSound('whistle');
        let opponent = INTERNATIONAL_CLUB_NAMES[Math.floor(Math.random() * INTERNATIONAL_CLUB_NAMES.length)];
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let income = Math.round((90000 + Math.floor(Math.random() * 60000)) * scale * 8);
        game.money += income;
        squad.forEach(p => { p.fitness = Math.max(40, Math.min(100, p.fitness + 1)); p.morale = Math.min(100, p.morale + 6); });
        game.fans = Math.min(100, game.fans + 4);
        addManagerXP(80);
        updateUI();
        addInboxMessage('vertrag', `✈️ Auslandsreise: Testspiel gegen ${opponent}`, `Prestigeträchtiges Testspiel absolviert! Einnahmen: ${formatVal(income)}, spürbarer Prestigegewinn bei den Fans - aber die weite Reise fordert etwas Kondition.`, 'screen-calendar');
        alert(`✈️ Auslandsreise beendet!\nTestspiel gegen ${opponent} absolviert.\nEinnahmen: +${formatVal(income)}\nFan-Prestige gestiegen, aber leichte Reise-Ermüdung.`);
    }

    // ==========================================
    // KALENDER: NEUE FUNKTIONEN
    // ==========================================

    // 1. Vorsaison-Tour: mehrere Stationen in einer Reise gebündelt, mit kumulierter
    // Zusammenfassung statt einzelner Testspiel-Klicks.
    function scheduleFullPreseasonTour() {
        if (game.matchday > 1) { showToast('Die Vorsaison-Tour ist nur vor Saisonbeginn möglich!', 'error'); return; }
        playSound('whistle');
        let stops = 3;
        let totalIncome = 0;
        let stopNames = [];
        // Wirtschaftliche Konsistenz (NEU): die alten Fixbeträge (25.000-45.000 € je Station)
        // waren nach der Wirtschaftsreform (Gehaltsbudgets jetzt im Millionenbereich, siehe
        // wageBudget-Neuberechnung) zur Bedeutungslosigkeit geschrumpft - jetzt skaliert mit
        // derselben Liga-Stärke wie Sponsoren-Einnahmen.
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        for (let i = 0; i < stops; i++) {
            let opponent = INTERNATIONAL_CLUB_NAMES[Math.floor(Math.random() * INTERNATIONAL_CLUB_NAMES.length)];
            let stopIncome = Math.round((25000 + Math.floor(Math.random() * 20000)) * scale * 8);
            totalIncome += stopIncome;
            stopNames.push(`${opponent} (${formatVal(stopIncome)})`);
        }
        game.money += totalIncome;
        squad.forEach(p => { p.fitness = Math.max(55, Math.min(100, p.fitness + 3)); p.morale = Math.min(100, p.morale + 8); });
        game.fans = Math.min(100, game.fans + 3);
        addManagerXP(120);
        addInboxMessage('vertrag', '✈️ Vorsaison-Tour abgeschlossen!', `Drei Stationen bereist: ${stopNames.join(', ')}. Gesamteinnahmen: ${formatVal(totalIncome)}, spürbarer Team-Zusammenhalt und Fan-Vorfreude!`, 'screen-calendar');
        updateUI();
        alert(`✈️ VORSAISON-TOUR ABGESCHLOSSEN!\n${stops} Stationen bereist.\nGesamteinnahmen: +${formatVal(totalIncome)}\nTeam-Moral & Fan-Vorfreude spürbar gestiegen!`);
    }

    // 2. Revanche-Freundschaftsspiel gegen den aktuellen Erzfeind: eigene, emotional
    // aufgeladene Variante des Testspiels mit Auswirkung auf die Rivalitäts-Bilanz.
    function scheduleRivalRevengeFriendly() {
        if (!game.permanentRivalName) { showToast('Aktuell kein Erzfeind bekannt!', 'error'); return; }
        playSound('whistle');
        let ourStr = calcTeamStrength(true);
        let rivalTeam = leaguesData[game.leagueLevel]?.find(t => t.name === game.permanentRivalName);
        let rivalStr = rivalTeam ? rivalTeam.strength : 60;
        let won = Math.random() < (0.5 + (ourStr - rivalStr) * 0.01);
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let income = Math.round((20000 + Math.floor(Math.random() * 15000)) * scale * 8);
        game.money += income;
        squad.forEach(p => { p.fitness = Math.max(60, Math.min(100, p.fitness + 2)); });
        if (won) {
            game.fans = Math.min(100, game.fans + 6);
            squad.forEach(p => { p.morale = Math.min(100, p.morale + 5); });
            addInboxMessage('vertrag', `🔥 Revanche geglückt gegen ${game.permanentRivalName}!`, `Im Vorbereitungs-Duell gegen den Erzfeind ${game.permanentRivalName} setzt sich 1.FC Moritz Leipzig durch - ein psychologisch wichtiges Zeichen vor dem Saisonstart!`, 'screen-calendar');
            alert(`🔥 REVANCHE GEGLÜCKT!\nSieg im Testspiel gegen Erzfeind ${game.permanentRivalName}!\nEinnahmen: +${formatVal(income)}\nSpürbarer Moralschub vor dem Saisonstart!`);
        } else {
            game.fans = Math.max(1, game.fans - 2);
            addInboxMessage('vertrag', `😤 Niederlage gegen ${game.permanentRivalName}`, `Das Vorbereitungs-Duell gegen den Erzfeind ${game.permanentRivalName} geht verloren - Ansporn für die kommende Saison.`, 'screen-calendar');
            alert(`😤 Niederlage im Testspiel gegen Erzfeind ${game.permanentRivalName}.\nEinnahmen: +${formatVal(income)}\nDas soll Ansporn für die neue Saison sein!`);
        }
        updateUI();
    }

    function bookTrainingCamp(camp) {
        let costs = { algarve: 40000, alps: 25000, dubai: 75000 };
        if (game.money < costs[camp]) { alert("Nicht genug Geld auf dem Vereinskonto!"); return; }
        playSound('goal');
        game.money -= costs[camp];
        if (camp === 'alps') squad.forEach(p => { p.fitness = 100; p.strength = Math.min(99, p.strength + 1); });
        if (camp === 'algarve') squad.forEach(p => { p.fitness = 100; p.morale = 100; });
        if (camp === 'dubai') squad.forEach(p => { p.fitness = 100; p.morale = 100; p.strength = Math.min(99, p.strength + 2); });
        addManagerXP(100);

        // Vertiefter Effekt: zusätzlich zum Sofort-Boost gibt's jetzt einen 5 Spieltage
        // anhaltenden Team-Chemie-Bonus (Teamstärke + reduziertes Verletzungsrisiko), der
        // über calcTeamStrength() bzw. processPostMatchRoutine() automatisch in ALLEN drei
        // Spieltag-Pfaden greift (Live, Saison durchsimulieren, Admin vorspulen).
        let campConfig = {
            algarve: { matches: 5, injuryReduction: 0.30, strengthBonus: 0, label: 'Algarve-Trainingslager', sponsorVisit: 0 },
            alps: { matches: 5, injuryReduction: 0.15, strengthBonus: 1, label: 'Alpen-Trainingslager', sponsorVisit: 0 },
            dubai: { matches: 6, injuryReduction: 0.40, strengthBonus: 1, label: 'Dubai-Trainingslager', sponsorVisit: 8000 }
        };
        let cfg = campConfig[camp];
        game.trainingCampBuff = { active: true, matchesLeft: cfg.matches, injuryReduction: cfg.injuryReduction, strengthBonus: cfg.strengthBonus, campName: cfg.label };
        // Trainingslager-Integration in den Wochenplan: für die Dauer des Lagers wird
        // automatisch ein intensiverer Sonderwochenplan vorgeschlagen (mehr Kondition/Technik,
        // kaum Ruhetage) statt dass Wochenplan und Trainingslager unabhängig voneinander laufen.
        // Der bisherige Plan wird gesichert, um ihn nach Ablauf automatisch wiederherzustellen.
        if (typeof applyWeeklyTrainingPreset === 'function') {
            game.preCampWeeklyPlan = { ...game.weeklyTrainingPlan };
            game.weeklyTrainingPlan = { mo: 'kondition', di: 'technik', mi: 'kondition', do: 'taktik', fr: 'technik', sa: 'kondition', so: 'erholung' };
            game.teamTraining = computeWeeklyTrainingStats().mappedTeamTraining;
        }

        let sponsorText = '';
        if (cfg.sponsorVisit > 0 && game.sponsor.base > 500) {
            game.money += cfg.sponsorVisit;
            sponsorText = ` ${game.sponsor.name} nutzt die Gelegenheit für einen PR-Auftritt vor Ort (+${formatVal(cfg.sponsorVisit)}).`;
        }

        updateUI();
        addInboxMessage('vertrag', `✈️ ${cfg.label} beendet!`, `Team ist topfit & gestärkt. Für die nächsten ${cfg.matches} Spieltage: -${Math.round(cfg.injuryReduction*100)}% Verletzungsrisiko${cfg.strengthBonus>0 ? `, +${cfg.strengthBonus} Teamstärke` : ''}.${sponsorText}`, 'screen-calendar');
        alert(`✈️ ${cfg.label} beendet! Alle Spieler topfit & gestärkt.\n\nBonus für die nächsten ${cfg.matches} Spieltage: -${Math.round(cfg.injuryReduction*100)}% Verletzungsrisiko${cfg.strengthBonus>0 ? `, +${cfg.strengthBonus} Teamstärke` : ''}.${sponsorText}`);
    }

