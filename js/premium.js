
    // ==========================================
    // PREMIUM-SHOP (SIMULIERT)
    // ==========================================
    // WICHTIGER HINWEIS: Diese Einzeldatei-HTML-App hat keine Anbindung an einen echten
    // Zahlungsanbieter (Stripe, Google Play Billing, App Store usw.) - eine solche Anbindung
    // würde ein echtes Backend erfordern, das es hier nicht gibt. Der "Echtgeld-Kauf" ist
    // deshalb bewusst als SIMULATION gekennzeichnet: ein Klick gewährt die Premium-Punkte
    // direkt, ohne dass tatsächlich Geld abgebucht wird. Für eine echte Veröffentlichung
    // müsste hier eine echte Payment-API angebunden werden.

    const PREMIUM_POINT_PACKAGES = [
        { id: 'pp_small', points: 100, priceLabel: '0,99 €' },
        { id: 'pp_medium', points: 550, priceLabel: '4,99 €', bonus: '+10% Bonus' },
        { id: 'pp_large', points: 1200, priceLabel: '9,99 €', bonus: '+20% Bonus' },
        { id: 'pp_mega', points: 3200, priceLabel: '19,99 €', bonus: '+30% Bonus' }
    ];

    const PREMIUM_BOOSTERS = [
        { id: 'heal_all', name: '🩹 Sofortheilung', cost: 100, desc: 'Heilt alle Verletzungen und beendet alle Sperren des gesamten Kaders sofort.' },
        { id: 'morale_boost', name: '😄 Moral-Boost', cost: 80, desc: 'Setzt die Moral des gesamten Kaders sofort auf 100%.' },
        { id: 'fitness_boost', name: '💪 Fitness-Boost', cost: 80, desc: 'Setzt die Fitness des gesamten Kaders sofort auf 100%.' },
        { id: 'xp_doubler', name: '⭐ XP-Doppler (5 Spieltage)', cost: 150, desc: 'Verdoppelt die Manager-XP-Erträge für die nächsten 5 Spieltage.' },
        { id: 'construction_rush', name: '🏗️ Bau-Beschleuniger', cost: 200, desc: 'Schließt sofort EIN laufendes Bauprojekt ab (Stadion/Campus/Immobilien) - Restzahlung wird trotzdem fällig.' },
        { id: 'skill_training_rush', name: '💪 Fähigkeitstraining-Express', cost: 150, desc: 'Schließt sofort EIN laufendes Fähigkeitstraining ab - der garantierte Attributs-Boost wird sofort angewendet.' },
        { id: 'scouting_rush', name: '🌍 Scouting-Express', cost: 120, desc: 'Schließt alle aktuell laufenden Scouting-Missionen sofort ab.' },
        { id: 'transfer_injection', name: '💰 Transfer-Spritze', cost: 300, desc: 'Sofortiger Bonus aufs Transferbudget, passend zu deiner aktuellen Liga-Stärke.' },
        { id: 'injury_shield', name: '🛡️ Verletzungsschutz (3 SpT)', cost: 180, desc: 'Für die nächsten 3 Spieltage kann sich kein Spieler verletzen.' },
        { id: 'contract_renew_free', name: '📋 Kostenlose Vertragsverlängerung', cost: 150, desc: 'Verlängert den Vertrag deines Spielers mit der kürzesten Restlaufzeit um 1 Jahr - komplett gratis, keine Verhandlung.' },
        { id: 'ticket_boost', name: '🎟️ Doppelte Ticketeinnahmen', cost: 150, desc: 'Verdoppelt die Ticketeinnahmen beim nächsten Heimspiel.' },
        { id: 'youth_reveal_all', name: '🔍 Alle Jugendtalente aufdecken', cost: 100, desc: 'Deckt das Potenzial aller aktuellen Jugendspieler sofort und kostenlos auf.' },
        { id: 'scout_guarantee', name: '🌟 Garantierter Top-Fund', cost: 250, desc: 'Der nächste abgeschlossene Scouting-Fund ist garantiert ein Spieler mit hoher Stärke.' },
        { id: 'chemistry_boost', name: '🤝 Perfekte Chemie', cost: 120, desc: 'Setzt die Eingespieltheit aller aktuellen Startelf-Paarungen sofort auf Maximum.' },
        { id: 'fan_love', name: '❤️ Fan-Liebesschub', cost: 90, desc: 'Erhöht die Fan-Zufriedenheit sofort um 20 Punkte.' },
        { id: 'board_charm', name: '🏛️ Vorstands-Charme', cost: 90, desc: 'Erhöht die Vorstands-Zufriedenheit sofort um 20 Punkte.' },
        { id: 'sponsor_boost', name: '📈 Sponsoren-Boost (5 SpT)', cost: 200, desc: 'Erhöht die laufenden Sponsoren-Einnahmen für 5 Spieltage um 50%.' },
        { id: 'media_charm', name: '🎤 Medien-Charmeoffensive', cost: 90, desc: 'Erhöht dein Manager-Medienimage sofort um 25 Punkte.' },
        { id: 'merch_double', name: '👕 Doppelte Fanartikel-Verkäufe', cost: 130, desc: 'Verdoppelt den Fanartikel-Absatz im Stadion beim nächsten Heimspiel.' },
        { id: 'stress_relief', name: '🧘 Stress-Abbau', cost: 70, desc: 'Senkt deinen persönlichen Manager-Stress sofort um 40 Punkte.' },
        { id: 'weather_guarantee', name: '☀️ Wettergarantie', cost: 60, desc: 'Garantiert sonniges Wetter beim nächsten Spiel - keine negativen Wettereffekte.' },
        { id: 'gk_top_form', name: '🧤 Torwart-Bestform', cost: 90, desc: 'Setzt deinen Stamm-Torwart sofort auf Top-Fitness und Top-Tagesform.' },
        { id: 'extra_training', name: '🏋️ Bonus-Trainingseinheit', cost: 60, desc: 'Gewährt sofort eine zusätzliche Trainingseinheit, unabhängig vom Tageslimit.' },
        { id: 'lucky_charm', name: '🍀 Glücksbringer', cost: 110, desc: 'Senkt Verletzungs- und Kartenrisiko im nächsten Spiel spürbar.' },
        { id: 'security_calm', name: '🕊️ Sicherheitslage beruhigen', cost: 100, desc: 'Senkt das Ausschreitungsrisiko beim nächsten Heimspiel stark ab.' },
        { id: 'second_team_refresh', name: '🔄 Zweite Mannschaft auffrischen', cost: 90, desc: 'Setzt die gesamte Zweite Mannschaft auf 100% Fitness und Moral, heilt alle Verletzungen/Sperren.' },
        { id: 'instant_xp', name: '⚡ Sofort-XP-Bonus', cost: 100, desc: 'Gewährt deinem Manager sofort 300 Erfahrungspunkte.' },
        { id: 'loyalty_boost', name: '💛 Loyalitäts-Bonus', cost: 90, desc: 'Erhöht die Moral des gesamten Kaders sofort um 15 Punkte - stärkt die Bindung an den Verein.' }
    ];

    // "Kauf" von Premium-Punkten - SIMULIERT, siehe Hinweis oben. Gewährt die Punkte direkt.
    function purchasePremiumPackage(packageId) {
        let pkg = PREMIUM_POINT_PACKAGES.find(p => p.id === packageId);
        if (!pkg) return;
        playSound('goal');
        game.premiumPoints = (game.premiumPoints || 0) + pkg.points;
        showToast(`💎 [SIMULIERT] ${pkg.points} Premium-Punkte gutgeschrieben (kein echtes Zahlungssystem integriert)`, 'success');
        renderPremiumShopView();
        updateUI();
    }

    function buyPremiumBooster(boosterId) {
        let b = PREMIUM_BOOSTERS.find(x => x.id === boosterId);
        if (!b) return;
        if ((game.premiumPoints || 0) < b.cost) { showToast('Nicht genug Premium-Punkte!', 'error'); return; }
        game.premiumPoints -= b.cost;
        applyPremiumBoosterEffect(boosterId);
        playSound('goal');
        renderPremiumShopView();
        updateUI();
    }

    // Admin-Zugriff (NEU, wie gewünscht): kostenloser Premium-Punkte-Bonus ohne jede
    // Bezahlung - passend zum bestehenden Admin/Cheats-Bereich.
    function adminGrantPremiumPoints() {
        playSound('goal');
        game.premiumPoints = (game.premiumPoints || 0) + 5000;
        showToast('👑 Admin: +5.000 Premium-Punkte kostenlos gutgeschrieben!', 'success');
        renderPremiumShopView();
        updateUI();
    }

    function applyPremiumBoosterEffect(boosterId) {
        switch (boosterId) {
            case 'heal_all':
                squad.forEach(p => { p.injured = 0; p.suspended = 0; });
                showToast('🩹 Gesamter Kader geheilt und entsperrt!', 'success');
                break;
            case 'morale_boost':
                squad.forEach(p => { p.morale = 100; });
                showToast('😄 Kader-Moral auf 100% gesetzt!', 'success');
                break;
            case 'fitness_boost':
                squad.forEach(p => { p.fitness = 100; });
                showToast('💪 Kader-Fitness auf 100% gesetzt!', 'success');
                break;
            case 'xp_doubler':
                game.xpDoublerMatchdaysLeft = (game.xpDoublerMatchdaysLeft || 0) + 5;
                showToast('⭐ XP-Doppler für 5 Spieltage aktiv!', 'success');
                break;
            case 'construction_rush': {
                let queue = game.stadiumConstructionQueue || [];
                if (queue.length === 0) { showToast('Keine laufende Baustelle vorhanden!', 'error'); game.premiumPoints += 200; return; }
                queue[0].daysLeft = 1;
                if (typeof tickStadiumConstruction === 'function') tickStadiumConstruction();
                showToast('🏗️ Bauprojekt sofort abgeschlossen!', 'success');
                break;
            }
            case 'skill_training_rush': {
                let skillQueue = game.skillTrainingQueue || [];
                if (skillQueue.length === 0) { showToast('Kein laufendes Fähigkeitstraining vorhanden!', 'error'); game.premiumPoints += 150; return; }
                skillQueue[0].matchdaysLeft = 1;
                if (typeof tickSkillTraining === 'function') tickSkillTraining();
                showToast('💪 Fähigkeitstraining sofort abgeschlossen!', 'success');
                break;
            }
            case 'scouting_rush': {
                let missions = scoutingNetwork?.activeMissions || [];
                if (missions.length === 0) { showToast('Keine laufende Scouting-Mission vorhanden!', 'error'); game.premiumPoints += 120; return; }
                missions.forEach(m => m.matchdaysLeft = 1);
                if (typeof tickScoutingMissions === 'function') tickScoutingMissions();
                showToast('🌍 Alle Scouting-Missionen sofort abgeschlossen!', 'success');
                break;
            }
            case 'transfer_injection': {
                let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
                let bonus = Math.round(300000 * scale);
                game.transferBudget += bonus;
                showToast(`💰 +${formatVal(bonus)} Transferbudget!`, 'success');
                break;
            }
            case 'injury_shield':
                game.injuryShieldMatchdaysLeft = (game.injuryShieldMatchdaysLeft || 0) + 3;
                showToast('🛡️ Verletzungsschutz für 3 Spieltage aktiv!', 'success');
                break;
            case 'contract_renew_free': {
                let candidate = [...squad].sort((a, b) => a.contracts - b.contracts)[0];
                if (!candidate) { showToast('Kein Spieler im Kader!', 'error'); game.premiumPoints += 150; return; }
                candidate.contracts++;
                showToast(`📋 Vertrag von ${candidate.name} kostenlos um 1 Jahr verlängert!`, 'success');
                break;
            }
            case 'ticket_boost':
                game.ticketIncomeBoostNextMatch = true;
                showToast('🎟️ Ticketeinnahmen beim nächsten Heimspiel verdoppelt!', 'success');
                break;
            case 'youth_reveal_all':
                if (typeof youthTalents !== 'undefined') youthTalents.forEach(p => { p.potentialRevealed = true; });
                showToast('🔍 Alle Jugendtalente-Potenziale aufgedeckt!', 'success');
                break;
            case 'scout_guarantee':
                game.nextScoutGuaranteed = true;
                showToast('🌟 Der nächste Scouting-Fund ist garantiert hochkarätig!', 'success');
                break;
            case 'chemistry_boost': {
                if (!game.pairChemistry) game.pairChemistry = {};
                let starting = lineup;
                for (let i = 0; i < starting.length; i++) {
                    for (let j = i + 1; j < starting.length; j++) {
                        let key = [starting[i], starting[j]].sort().join('_');
                        game.pairChemistry[key] = 30;
                    }
                }
                showToast('🤝 Eingespieltheit der Startelf auf Maximum gesetzt!', 'success');
                break;
            }
            case 'fan_love':
                game.fans = Math.min(100, game.fans + 20);
                showToast('❤️ Fan-Zufriedenheit +20!', 'success');
                break;
            case 'board_charm':
                game.boardSat = Math.min(100, game.boardSat + 20);
                showToast('🏛️ Vorstands-Zufriedenheit +20!', 'success');
                break;
            case 'sponsor_boost':
                game.sponsorBoostMatchdaysLeft = (game.sponsorBoostMatchdaysLeft || 0) + 5;
                showToast('📈 Sponsoren-Einnahmen für 5 Spieltage um 50% erhöht!', 'success');
                break;
            case 'media_charm':
                game.managerMediaImage = Math.min(100, (game.managerMediaImage ?? 50) + 25);
                showToast('🎤 Manager-Medienimage +25!', 'success');
                break;
            case 'merch_double':
                game.merchDoubleNextMatch = true;
                showToast('👕 Fanartikel-Absatz beim nächsten Heimspiel verdoppelt!', 'success');
                break;
            case 'stress_relief':
                if (typeof privateLife !== 'undefined') privateLife.stress = Math.max(0, privateLife.stress - 40);
                showToast('🧘 Manager-Stress -40!', 'success');
                break;
            case 'weather_guarantee':
                game.weatherGuaranteeNextMatch = true;
                showToast('☀️ Sonniges Wetter beim nächsten Spiel garantiert!', 'success');
                break;
            case 'gk_top_form': {
                let gk = squad.find(p => p.pos === 'TW');
                if (!gk) { showToast('Kein Torwart im Kader!', 'error'); game.premiumPoints += 90; return; }
                gk.fitness = 100; gk.dailyForm = 90;
                showToast(`🧤 ${gk.name} in Bestform!`, 'success');
                break;
            }
            case 'extra_training':
                if (typeof game.trainingPlaysToday === 'number') game.trainingPlaysToday = Math.max(0, game.trainingPlaysToday - 1);
                showToast('🏋️ Bonus-Trainingseinheit gewährt!', 'success');
                break;
            case 'lucky_charm':
                game.luckyCharmNextMatch = true;
                showToast('🍀 Glücksbringer für das nächste Spiel aktiv!', 'success');
                break;
            case 'security_calm':
                game.securityCalmNextMatch = true;
                showToast('🕊️ Sicherheitslage beim nächsten Heimspiel beruhigt!', 'success');
                break;
            case 'second_team_refresh':
                if (typeof secondTeamSquad !== 'undefined') secondTeamSquad.forEach(p => { p.fitness = 100; p.morale = 100; p.injured = 0; p.suspended = 0; });
                showToast('🔄 Zweite Mannschaft komplett aufgefrischt!', 'success');
                break;
            case 'instant_xp':
                if (typeof addManagerXP === 'function') addManagerXP(300);
                showToast('⚡ +300 Manager-XP!', 'success');
                break;
            case 'loyalty_boost':
                squad.forEach(p => { p.morale = Math.min(100, p.morale + 15); });
                showToast('💛 Kader-Moral +15 durch gestärkte Vereinsbindung!', 'success');
                break;
        }
    }

    // XP-Doppler-Verbrauch: wird jeden Spieltag aufgerufen (siehe addManagerXP-Aufrufstellen
    // bzw. periodischer Hook), zählt die verbleibenden Spieltage herunter.
    function tickXpDoublerDuration() {
        if (game.xpDoublerMatchdaysLeft > 0) game.xpDoublerMatchdaysLeft--;
    }

    function renderPremiumShopView() {
        let pointsDisp = document.getElementById('premium-points-display');
        if (pointsDisp) pointsDisp.innerText = (game.premiumPoints || 0).toLocaleString('de-DE');

        let packagesBox = document.getElementById('premium-packages-box');
        if (packagesBox) {
            packagesBox.innerHTML = PREMIUM_POINT_PACKAGES.map(pkg => `
                <div class="panel" style="text-align:center;">
                    <div style="font-size:16px; font-weight:900; color:var(--accent);">💎 ${pkg.points.toLocaleString('de-DE')}</div>
                    ${pkg.bonus ? `<div style="font-size:8px; color:var(--primary);">${pkg.bonus}</div>` : ''}
                    <button onclick="purchasePremiumPackage('${pkg.id}')" class="btn-gold" style="margin-top:4px;">${pkg.priceLabel}</button>
                </div>
            `).join('');
        }

        let boostersBox = document.getElementById('premium-boosters-box');
        if (boostersBox) {
            boostersBox.innerHTML = PREMIUM_BOOSTERS.map(b => `
                <div class="panel">
                    <div class="panel-header"><span>${b.name}</span><strong style="color:var(--accent);">💎 ${b.cost}</strong></div>
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">${b.desc}</div>
                    <button onclick="buyPremiumBooster('${b.id}')" class="btn-action" ${(game.premiumPoints || 0) < b.cost ? 'disabled' : ''}>Einlösen</button>
                </div>
            `).join('');
        }
    }

