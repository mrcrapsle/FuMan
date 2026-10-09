
    function renderCalendarView() {
        const months = ["August", "September", "Oktober", "November", "Dezember", "Januar", "Februar", "März", "April", "Mai"];
        let monthIdx = Math.min(9, Math.floor((game.matchday - 1) / 3.5));
        document.getElementById('cal-month-name').innerText = months[monthIdx];
        const campNamen = { algarve: '🏖️ Trainingslager Algarve', alps: '🏔️ Höhentrainingslager Alpen', dubai: '🌴 Luxus-Camp Dubai' };
        Object.keys(campNamen).forEach(k => {
            const b = document.getElementById('btn-camp-' + k);
            if (b) b.innerText = game.trainingCampSeason === game.season ? `${campNamen[k]} (diese Saison gebucht)` : `${campNamen[k]} [${formatVal(getTrainingCampCost(k))}]`;
        });

        let list = document.getElementById('cal-schedule-list');
        list.innerHTML = '';
        const en = typeof currentLang !== 'undefined' && currentLang === 'en';
        const L = (de, eng) => en ? eng : de;
        for (let i = 1; i <= 34; i++) {
            let item = document.createElement('div');
            item.className = 'player-row';
            let isCurrent = (i === game.matchday);
            // Pokal und Europa sind KEINE eigenen Tage (25.23): an diesen Spieltagen wird zuerst die Pokalpartie
            // gespielt, danach das Ligaspiel desselben Spieltags (startMatchdayFlow -> "Weiter zum Ligaspiel").
            // 25.24: der DFB-Pokal erscheint nur für Vereine, die noch dabei sind (ab der 3. Liga, nicht
            // ausgeschieden); kommende Pokal- und Europa-Partien nennen den Gegner, sobald er ausgelost ist.
            const dfb = cupTournament.matchdays.includes(i) && (typeof istImDfbPokal !== 'function' || istImDfbPokal());
            const lande = typeof landesPokal !== 'undefined' && landesPokal.active && landesPokal.matchdays.includes(i);
            const euro = europeTournament.matchdays.includes(i);
            const kommend = i >= game.matchday;
            const tie = kommend && typeof getUpcomingOwnTie === 'function' ? getUpcomingOwnTie(i) : null;
            let teile = [];
            if (dfb) teile.push(L('🏆 DFB-Pokal', '🏆 DFB Cup') + (tie && tie.comp === 'dfb' ? ' ' + L('gegen', 'vs') + ' ' + tie.gegner : ''));
            if (lande) teile.push(L('🏅 Landespokal', '🏅 State cup') + (tie && tie.comp === 'landes' ? ' ' + L('gegen', 'vs') + ' ' + tie.gegner : ''));
            if (euro) {
                let europa = L('🌟 Champions Cup', '🌟 Champions Cup');
                if (tie && tie.comp === 'europe') europa += ' ' + L('gegen', 'vs') + ' ' + tie.gegner;
                const gruppe = typeof getOwnEuropeGroupStanding === 'function' && kommend ? getOwnEuropeGroupStanding() : null;
                if (gruppe) europa += ` (${L('Gruppe', 'group')} ${gruppe.name}: ${L('Platz', 'place')} ${gruppe.platz}, ${gruppe.pts} ${L('Pkt.', 'pts')})`;
                teile.push(europa);
            }
            teile.push(L('⚽ Ligaspiel', '⚽ League match'));
            let eventText = teile.join(' + ');
            let hasCup = dfb || lande;
            let eventColor = hasCup ? 'var(--accent)' : (euro ? '#82b1ff' : '#aaa');

            item.innerHTML = `
                <span><strong>${L('Spieltag', 'Matchday')} ${i}</strong> ${isCurrent ? `<span style="color:var(--primary); font-weight:900;">(${L('HEUTE', 'TODAY')})</span>` : ''}</span>
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
        showToast(`⚽ Testspiel absolviert - ${formatVal(income)} Einnahmen, Fitness und Moral leicht gestiegen.`, 'success', 5000);
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
        showNotice('✈️ Auslandsreise beendet', `Testspiel gegen ${opponent} absolviert.\n\nEinnahmen ${formatVal(income)}, das Fan-Prestige ist gestiegen - die weite Reise hat allerdings Kondition gekostet.`);
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
        // Wirtschaftliche Konsistenz: die alten Fixbeträge (25.000-45.000 € je Station)
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
        showNotice('✈️ Vorsaison-Tour abgeschlossen', `${stops} Stationen bereist.\n\nGesamteinnahmen ${formatVal(totalIncome)}. Mannschaftsmoral und Fan-Vorfreude sind spürbar gestiegen.`);
    }

    // 2. Testspiel gegen den Stadtrivalen (nächster Derbygegner aus js/club-geo.js) - emotional
    // aufgeladener als ein normales Testspiel: Sieg hebt Fans und Moral, Niederlage kostet Fans.
    function scheduleDerbyFriendly() {
        const rivale = typeof getOwnDerbyRivals === 'function' ? getOwnDerbyRivals()[0] : null;
        if (!rivale) { showToast('In deiner Stadt gibt es keinen anderen Verein - kein Derby-Testspiel möglich.', 'error'); return; }
        playSound('whistle');
        let ourStr = calcTeamStrength(true);
        let won = Math.random() < (0.5 + (ourStr - rivale.strength) * 0.01);
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let income = Math.round((20000 + Math.floor(Math.random() * 15000)) * scale * 8);
        game.money += income;
        squad.forEach(p => { p.fitness = Math.max(60, Math.min(100, p.fitness + 2)); });
        if (won) {
            game.fans = Math.min(100, game.fans + 6);
            squad.forEach(p => { p.morale = Math.min(100, p.morale + 5); });
            addInboxMessage('vertrag', `🔥 Derby-Testspiel gewonnen gegen ${rivale.name}!`, `${rivale.label}: ${game.clubName} setzt sich im Vorbereitungs-Duell durch - ein Zeichen vor dem Saisonstart!`, 'screen-calendar');
            showNotice('🔥 Derby-Testspiel gewonnen!', `Sieg gegen ${rivale.name}.\n\nEinnahmen ${formatVal(income)}, dazu ein spürbarer Moralschub vor dem Saisonstart.`);
        } else {
            game.fans = Math.max(1, game.fans - 2);
            addInboxMessage('vertrag', `😤 Derby-Testspiel verloren gegen ${rivale.name}`, `${rivale.label}: das Vorbereitungs-Duell geht verloren - Ansporn für die kommende Saison.`, 'screen-calendar');
            showNotice('😤 Derby-Testspiel verloren', `Das Testspiel gegen ${rivale.name} ging verloren.\n\nImmerhin ${formatVal(income)} Einnahmen - und Ansporn für die neue Saison.`, { typ: 'warn' });
        }
        updateUI();
    }

    // Trainingslager (25.20): vorher beliebig oft buchbar, jedes Mal dauerhaft +1 (Alpen) bzw. +2 (Dubai)
    // Stärke für den ganzen Kader zu festen 25.000/75.000 € - zehnmal Dubai = +20 für alle. Jetzt einmal
    // pro Saison, Kosten nach Liga, die Stärke wirkt nur über den zeitlich begrenzten Lager-Bonus.
    const TRAINING_CAMP_COSTS = { algarve: 40000, alps: 25000, dubai: 75000 };
    function getTrainingCampCost(camp) {
        return Math.round(TRAINING_CAMP_COSTS[camp] * (typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1) / 1000) * 1000;
    }
    function bookTrainingCamp(camp) {
        if (!TRAINING_CAMP_COSTS[camp]) return;
        if (game.trainingCampSeason === game.season) { showToast('Ein Trainingslager pro Saison - das nächste gibt es erst in der neuen Saison.', 'error', 4500); return; }
        const kosten = getTrainingCampCost(camp);
        if (game.money < kosten) { showToast(`Vereinskonto reicht nicht: ${formatVal(kosten)} nötig, ${formatVal(game.money)} vorhanden.`, 'error', 4500); return; }
        playSound('goal');
        game.money -= kosten;
        game.trainingCampSeason = game.season;
        if (camp === 'alps') squad.forEach(p => { p.fitness = 100; });
        if (camp === 'algarve') squad.forEach(p => { p.fitness = 100; p.morale = 100; });
        if (camp === 'dubai') squad.forEach(p => { p.fitness = 100; p.morale = 100; });
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
        showNotice(`✈️ ${cfg.label} beendet`, `Alle Spieler sind topfit und gestärkt zurück.\n\nBonus für die nächsten ${cfg.matches} Spieltage: ${Math.round(cfg.injuryReduction*100)}% weniger Verletzungsrisiko${cfg.strengthBonus>0 ? `, dazu +${cfg.strengthBonus} Teamstärke` : ''}.${sponsorText}`);
    }

