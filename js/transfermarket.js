
// ==========================================
// TRANSFERMARKT & KI-ANGEBOTE
// ==========================================
    function refreshTransferMarket() {
        marketPlayers = [];
        freeAgentPlayers = [];
        loanablePlayers = [];
        let discount = 1.0 - (staffMembers.scout.hired ? 0.15 : 0);
        // Personal-Synergie "Verhandlungsprofis": Chef-Scout + Sportdirektor zusammen geben
        // weitere 5% Rabatt bei Transfers.
        if (typeof getActiveStaffSynergies === 'function' && getActiveStaffSynergies().some(s => s.bonusKey === 'transferDiscount')) discount -= 0.05;
        let minStr = 50 + (3 - game.leagueLevel) * 9;
        let maxStr = minStr + 9;

        for (let i = 0; i < 6; i++) {
            let p = createPlayer(["TW", "ABW", "MIT", "ST"][Math.floor(Math.random() * 4)], minStr, maxStr);
            p.marketValue = Math.round(p.marketValue * discount);
            marketPlayers.push(p);
        }
        for (let i = 0; i < 4; i++) {
            let p = createPlayer(["TW", "ABW", "MIT", "ST"][Math.floor(Math.random() * 4)], Math.max(40, minStr - 4), maxStr - 2);
            p.marketValue = 0;
            p.signOnFee = Math.round(p.wage * 6);
            freeAgentPlayers.push(p);
        }
        // Leihspieler (NEU): eingehende Leihen von anderen Vereinen - deutlich günstiger als
        // ein Kauf, mit optionaler Kaufoption für eine dauerhafte Verpflichtung später.
        for (let i = 0; i < 3; i++) {
            let p = createPlayer(["TW", "ABW", "MIT", "ST"][Math.floor(Math.random() * 4)], minStr - 2, maxStr + 4);
            p.loanParentClub = INTERNATIONAL_CLUB_NAMES[Math.floor(Math.random() * INTERNATIONAL_CLUB_NAMES.length)];
            p.loanFee = Math.max(1000, Math.round(p.marketValue * 0.12));
            p.loanBuyOptionFee = Math.round(p.marketValue * 0.85);
            p.loanDurationMatchdays = 34;
            loanablePlayers.push(p);
        }
    }

    // ==========================================
    // EINGEHENDE LEIHSPIELER (NEU)
    // ==========================================
    function signLoanPlayer(idx) {
        let p = loanablePlayers[idx];
        if (!p) return;
        if (game.money < p.loanFee) { alert(`Nicht genug Geld für die Leihgebühr! Benötigt: ${formatVal(p.loanFee)}`); return; }
        if (squad.length >= 22) { showToast('Kader bereits voll (22 Spieler)!', 'error'); return; }
        playSound('whistle');
        game.money -= p.loanFee;
        p.isLoanedIn = true;
        p.contracts = 1;
        squad.push(p);
        incomingLoans.push({ playerId: p.id, parentClub: p.loanParentClub, matchdaysLeft: p.loanDurationMatchdays, buyOptionFee: p.loanBuyOptionFee });
        loanablePlayers.splice(idx, 1);
        addInboxMessage('vertrag', `📋 ${p.name} ausgeliehen!`, `${p.name} kommt für diese Saison von ${p.loanParentClub} auf Leihbasis - Kaufoption: ${formatVal(p.loanBuyOptionFee)}.`, 'screen-squad');
        showToast(`📋 ${p.name} von ${p.loanParentClub} ausgeliehen!`, 'success');
        renderTransferView();
        updateUI();
    }
    function exerciseLoanBuyOption(playerId) {
        let loan = incomingLoans.find(l => l.playerId === playerId);
        let p = squad.find(x => x.id === playerId);
        if (!loan || !p) return;
        if (game.money < loan.buyOptionFee) { alert(`Nicht genug Geld für die Kaufoption! Benötigt: ${formatVal(loan.buyOptionFee)}`); return; }
        if (game.transferBudget < loan.buyOptionFee) { alert("Transferbudget reicht nicht aus!"); return; }
        playSound('goal');
        game.money -= loan.buyOptionFee;
        game.transferBudget -= loan.buyOptionFee;
        p.isLoanedIn = false;
        p.contracts = 3;
        incomingLoans = incomingLoans.filter(l => l.playerId !== playerId);
        addInboxMessage('vertrag', `✅ Kaufoption gezogen: ${p.name}!`, `${p.name} wechselt dauerhaft von ${loan.parentClub} zum Verein!`, 'screen-squad');
        showToast(`✅ ${p.name} dauerhaft verpflichtet!`, 'success');
        renderContractsView();
        updateUI();
    }
    // Wird jeden Spieltag geprüft: läuft die Leihe ab, kehrt der Spieler zum Mutterverein
    // zurück, sofern die Kaufoption nicht vorher gezogen wurde.
    function tickIncomingLoans() {
        incomingLoans.forEach(loan => { loan.matchdaysLeft--; });
        let expired = incomingLoans.filter(l => l.matchdaysLeft <= 0);
        expired.forEach(loan => {
            let p = squad.find(x => x.id === loan.playerId);
            if (p) {
                squad = squad.filter(x => x.id !== loan.playerId);
                addInboxMessage('vertrag', `📋 Leihe beendet: ${p.name}`, `${p.name} kehrt wie vereinbart zu ${loan.parentClub} zurück.`, 'screen-squad');
                showToast(`📋 ${p.name} kehrt zu ${loan.parentClub} zurück.`, 'error');
            }
        });
        incomingLoans = incomingLoans.filter(l => l.matchdaysLeft > 0);
    }

    function checkIncomingTransferOffers() {
        incomingOffers.forEach(o => { o.expiresIn--; });
        incomingOffers = incomingOffers.filter(o => o.expiresIn > 0);

        if (squad.length <= 12 || incomingOffers.length >= 3) return;

        // Während des Winterpause-Sondertransferfensters treffen deutlich mehr Angebote ein.
        let chance = game.winterWindowActive ? 0.65 : 0.35;
        if (Math.random() < chance) {
            triggerNewAITransferOffer();
        }
    }

    // ---------- WINTERPAUSE-SONDERTRANSFERFENSTER ----------
    // Öffnet sich automatisch zum Saisonhalbzeit-Spieltag (17) und läuft 3 ECHTE Tage lang
    // (Realzeit, nicht Spieltage) - während dieser Zeit ist die Chance auf neue Angebote
    // spürbar erhöht (siehe checkIncomingTransferOffers() oben). Läuft die Zeit ab, schließt
    // sich das Fenster automatisch wieder (siehe checkWinterWindowExpiry(), die bei jedem
    // Rendern des Transfermarkt-Screens sowie per Intervall geprüft wird).
    const WINTER_WINDOW_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

    function openWinterWindow() {
        game.winterWindowActive = true;
        game.winterWindowUsedThisSeason = true;
        game.winterWindowDeadline = Date.now() + WINTER_WINDOW_DURATION_MS;
        addInboxMessage('transfer', '❄️ Winterpause-Sondertransferfenster geöffnet!', 'Für die nächsten 3 Tage (Echtzeit) treffen deutlich mehr Transferangebote ein - nutze die Chance!', 'screen-transfer');
        showToast('❄️ Winterpause-Transferfenster geöffnet! 3 Tage lang erhöhte Transferaktivität.', 'success');
    }

    function checkWinterWindowExpiry() {
        if (game.winterWindowActive && Date.now() > game.winterWindowDeadline) {
            game.winterWindowActive = false;
            triggerDeadlineDayRush();
            addInboxMessage('transfer', '❄️ Winterpause-Transferfenster geschlossen', 'Die verstärkte Transferaktivität ist wieder auf Normalniveau zurückgegangen.', 'screen-transfer');
        }
    }

    // ---------- DEADLINE DAY ----------
    // Kurz vor Schließung des Fensters trudelt noch einmal eine Welle an Last-Minute-
    // Angeboten ein - klassischer "Deadline Day"-Wahnsinn, bevor wieder Ruhe einkehrt.
    function triggerDeadlineDayRush() {
        let before = incomingOffers.length;
        for (let i = 0; i < 4; i++) triggerNewAITransferOffer();
        let added = incomingOffers.length - before;
        if (added > 0) {
            addInboxMessage('transfer', '🚨 DEADLINE DAY! Letzte Angebote treffen ein!', `In letzter Minute sind noch ${added} neue Transferanfrage(n) für deine Spieler eingegangen - jetzt schnell entscheiden, bevor das Fenster endgültig schließt!`, 'screen-transfer');
            showToast(`🚨 Deadline Day! ${added} Last-Minute-Angebot(e) eingetroffen!`, 'success');
        }
    }

    function renderWinterWindowBanner() {
        let el = document.getElementById('winter-window-banner');
        if (!el) return;
        checkWinterWindowExpiry();
        if (!game.winterWindowActive) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        let remainingMs = Math.max(0, game.winterWindowDeadline - Date.now());
        let h = Math.floor(remainingMs / 3600000);
        let m = Math.floor((remainingMs % 3600000) / 60000);
        let s = Math.floor((remainingMs % 60000) / 1000);
        el.innerHTML = `❄️ <strong>Winterpause-Sondertransferfenster aktiv!</strong> Noch ${h}h ${m}m ${s}s - erhöhte Transferaktivität.`;
    }
    setInterval(() => { if (typeof game !== 'undefined' && game.winterWindowActive) renderWinterWindowBanner(); }, 1000);

    function triggerNewAITransferOffer() {
        let validTargets = squad.filter(p => p.strength >= 48 && !incomingOffers.some(o => o.playerId === p.id));
        if (validTargets.length === 0) return;

        let targetPlayer = validTargets[Math.floor(Math.random() * validTargets.length)];
        // Bietender Klub kommt jetzt aus der echten, persistenten Liga-Pyramide statt aus
        // einem frisch ausgewürfelten, nie wieder auftauchenden Fantasienamen - bevorzugt
        // Vereine auf oder über dem eigenen Liganiveau, da eher etablierte Klubs um
        // Spitzenspieler eines Amateur-/Unterligisten werben.
        let buyerClub = pickRandomOpposingClubName(true);
        let initialMultiplier = (managerRPG.perks.negotiator ? 1.05 : 0.85) + Math.random() * 0.35;
        let offerSum = Math.max(10000, Math.round((targetPlayer.marketValue * initialMultiplier) / 5000) * 5000);

        let newOffer = {
            id: 'bid_' + Math.random().toString(36).substr(2, 7),
            playerId: targetPlayer.id,
            playerName: targetPlayer.name,
            playerPos: targetPlayer.pos,
            playerStr: targetPlayer.strength,
            marketValue: targetPlayer.marketValue,
            clubName: buyerClub,
            currentBid: offerSum,
            originalBid: offerSum,
            round: 1,
            expiresIn: 3,
            statusText: "Neues schriftliches Angebot eingegangen."
        };

        incomingOffers.unshift(newOffer);
        playSound('whistle');
        addInboxMessage('transfer', `Angebot für ${targetPlayer.name}`, `${buyerClub} bietet ${formatVal(offerSum)} für ${targetPlayer.name}.`, 'screen-transfer');
    }

    // Wird beim Verkauf/Abgang eines Spielers aufgerufen: löst die Kabinen-Freundschaft und
    // gibt dem verbliebenen Freund einen spürbaren, aber vorübergehenden Moraldämpfer.
    function checkFriendshipDeparture(departingPlayer) {
        if (!departingPlayer || !departingPlayer.friendPlayerId) return;
        let friend = squad.find(p => p.id === departingPlayer.friendPlayerId);
        if (friend) {
            friend.morale = Math.max(10, friend.morale - 12);
            friend.friendPlayerId = null;
            addInboxMessage('vertrag', '💔 Kabinen-Freundschaft zerbrochen', `${friend.name} ist sichtlich mitgenommen vom Abgang seines besten Freundes ${departingPlayer.name} - die Moral leidet kurzzeitig.`, 'screen-squad');
        }
    }

    // Merkt sich besonders starke Spieler, die den Verein verlassen haben - für die
    // Jubiläums-Sonderspiele (siehe playJubileeSpecialMatch() in crest.js), damit dort
    // echte ehemalige Vereinsgrößen statt anonymer Platzhalter auftauchen.
    function recordNotablePastPlayer(player) {
        if (!player || player.strength < 70) return;
        if (!game.notablePastPlayers) game.notablePastPlayers = [];
        game.notablePastPlayers.push({ name: player.name, strength: player.strength, season: game.season });
        if (game.notablePastPlayers.length > 30) game.notablePastPlayers.shift();
    }

    // Publikumsliebling-Abwerbeschutz: der Verkauf des amtierenden Publikumslieblings kommt
    // bei den Fans besonders schlecht an - deutlich stärkerer Fan-Rückgang als bei einem
    // gewöhnlichen Transfer, als spürbare Konsequenz statt eines rein kosmetischen Titels.
    function checkCrowdFavoriteDeparture(departingPlayer) {
        if (!departingPlayer || !departingPlayer.isCrowdFavorite) return;
        game.fans = Math.max(game.fanBaseFloor || 10, game.fans - 15);
        game.boardSat = Math.max(1, game.boardSat - 5);
        addInboxMessage('vertrag', `💔 Fans empört über Verkauf von ${departingPlayer.name}!`, `Der Verkauf des amtierenden Publikumslieblings sorgt für deutlichen Unmut in der Fankurve - die Stimmung ist spürbar getrübt.`, 'screen-dashboard');
        showToast(`💔 Fans sind empört über den Verkauf von ${departingPlayer.name}!`, 'error');
    }

    function acceptTransferOffer(offerId) {
        let oIdx = incomingOffers.findIndex(o => o.id === offerId);
        if (oIdx === -1) return;
        let offer = incomingOffers[oIdx];

        if (squad.length <= 11) {
            alert("❌ Transfer unzulässig: Dein Kader muss mindestens 11 Spieler umfassen!");
            return;
        }

        let pIdx = squad.findIndex(p => p.id === offer.playerId);
        if (pIdx === -1) {
            alert("Spieler befindet sich nicht mehr im Kader!");
            incomingOffers.splice(oIdx, 1);
            renderTransferView();
            return;
        }
        if (!checkHighChemistryBeforeSale(squad[pIdx])) return;

        playSound('goal');
        // Verhandlungsfuchs-Perk: +15% Erlöse bei Verkäufen gilt auch für angenommene
        // Transferangebote, nicht nur den direkten Sofortverkauf.
        if (managerRPG.perks.negotiator) offer.currentBid = Math.round(offer.currentBid * 1.15);
        let agentFee = getAgentFee(squad[pIdx], offer.currentBid);
        game.money += offer.currentBid - agentFee;
        game.transferBudget += Math.round(offer.currentBid * 0.85);

        checkFriendshipDeparture(squad[pIdx]);
        recordNotablePastPlayer(squad[pIdx]);
        checkCrowdFavoriteDeparture(squad[pIdx]);
        squad.splice(pIdx, 1);
        lineup = lineup.filter(id => id !== offer.playerId);
        incomingOffers.splice(oIdx, 1);

        addManagerXP(120);
        alert(`🤝 TRANSFER PERFEKT!\n${offer.playerName} wechselt für ${formatVal(offer.currentBid)} zu ${offer.clubName}.${agentFee > 0 ? `\n(Abzüglich ${formatVal(agentFee)} Beraterprovision)` : ''}`);
        updateUI();
        renderTransferView();
    }

    // ==========================================
    // WEITERVERKAUFSBETEILIGUNG (NEU)
    // ==========================================
    // Beim Verkauf eines Spielers kann statt der vollen Sofortsumme eine
    // Weiterverkaufsbeteiligung ausgehandelt werden: der Verein zahlt etwas weniger sofort,
    // dafür bekommst du einen Anteil, falls der kaufende Verein den Spieler später mit
    // Gewinn weiterverkauft - eine reale, bekannte Fußball-Transfermechanik.
    function acceptTransferOfferWithClause(offerId) {
        let oIdx = incomingOffers.findIndex(o => o.id === offerId);
        if (oIdx === -1) return;
        let offer = incomingOffers[oIdx];
        if (squad.length <= 11) { alert("❌ Transfer unzulässig: Dein Kader muss mindestens 11 Spieler umfassen!"); return; }
        let pIdx = squad.findIndex(p => p.id === offer.playerId);
        if (pIdx === -1) { alert("Spieler befindet sich nicht mehr im Kader!"); incomingOffers.splice(oIdx, 1); renderTransferView(); return; }
        if (!checkHighChemistryBeforeSale(squad[pIdx])) return;
        playSound('goal');
        let clausePercent = 15;
        // Der kaufende Verein zahlt für die Weiterverkaufsbeteiligung 6% weniger sofort.
        let reducedBid = Math.round(offer.currentBid * 0.94);
        if (managerRPG.perks.negotiator) reducedBid = Math.round(reducedBid * 1.15);
        let agentFee = getAgentFee(squad[pIdx], reducedBid);
        game.money += reducedBid - agentFee;
        game.transferBudget += Math.round(reducedBid * 0.85);
        if (!Array.isArray(game.sellOnClauses)) game.sellOnClauses = [];
        game.sellOnClauses.push({ playerName: squad[pIdx].name, buyingClub: offer.clubName, percent: clausePercent, originalSaleValue: reducedBid });
        checkFriendshipDeparture(squad[pIdx]);
        recordNotablePastPlayer(squad[pIdx]);
        checkCrowdFavoriteDeparture(squad[pIdx]);
        squad.splice(pIdx, 1);
        lineup = lineup.filter(id => id !== offer.playerId);
        incomingOffers.splice(oIdx, 1);
        addManagerXP(120);
        alert(`🤝 TRANSFER MIT WEITERVERKAUFSBETEILIGUNG!\n${offer.playerName} wechselt für ${formatVal(reducedBid)} zu ${offer.clubName} - dazu ${clausePercent}% von jedem künftigen Weiterverkauf.`);
        updateUI();
        renderTransferView();
    }
    // Wird jeden Spieltag geprüft: löst gelegentlich einen simulierten Weiterverkauf eines
    // ehemaligen Spielers durch den kaufenden Verein aus und zahlt die vereinbarte Beteiligung aus.
    function checkSellOnClausePayouts() {
        if (!Array.isArray(game.sellOnClauses) || game.sellOnClauses.length === 0) return;
        // Bugfix (im eigenen Entwurf sofort entdeckt): forEach + splice() während der
        // Iteration überspringt Elemente, wenn mehrere Klauseln gleichzeitig auslösen -
        // stattdessen rückwärts iterieren, damit das Entfernen die noch ausstehenden
        // Indizes nicht verschiebt.
        for (let i = game.sellOnClauses.length - 1; i >= 0; i--) {
            let clause = game.sellOnClauses[i];
            if (Math.random() < 0.015) {
                let resaleValue = Math.round(clause.originalSaleValue * (1.3 + Math.random() * 1.2));
                let payout = Math.round(resaleValue * (clause.percent / 100));
                game.money += payout;
                addInboxMessage('vertrag', `💰 Weiterverkaufsbeteiligung ausgezahlt!`, `${clause.buyingClub} hat ${clause.playerName} für ${formatVal(resaleValue)} weiterverkauft - deine ${clause.percent}%-Beteiligung: ${formatVal(payout)}!`, 'screen-finances');
                showToast(`💰 +${formatVal(payout)} Weiterverkaufsbeteiligung für ${clause.playerName}!`, 'success');
                game.sellOnClauses.splice(i, 1);
            }
        }
    }

    function rejectTransferOffer(offerId) {
        playSound('click');
        let oIdx = incomingOffers.findIndex(o => o.id === offerId);
        if (oIdx !== -1) {
            let o = incomingOffers[oIdx];
            let p = squad.find(x => x.id === o.playerId);
            if (p && o.currentBid > p.marketValue * 1.2) {
                p.morale = Math.max(20, p.morale - 8);
            }
            incomingOffers.splice(oIdx, 1);
        }
        renderTransferView();
        updateUI();
    }

    function counterTransferOffer(offerId, multiplier, demandLabel) {
        let o = incomingOffers.find(x => x.id === offerId);
        if (!o) return;
        let demandedSum = Math.round((o.currentBid * multiplier) / 5000) * 5000;
        applyTransferCounterDemand(offerId, demandedSum);
    }

    // Kernlogik der Nachverhandlung - nimmt jetzt einen FREI GEWÄHLTEN Betrag entgegen
    // (aus dem Schrittweite-Stepper-Modal) statt nur fester Prozent-Buttons.
    function applyTransferCounterDemand(offerId, demandedSum) {
        playSound('click');
        let o = incomingOffers.find(x => x.id === offerId);
        if (!o) return;

        let p = squad.find(x => x.id === o.playerId);
        let marketRatio = demandedSum / (p ? p.marketValue : demandedSum);

        o.round++;
        o.history = o.history || [];
        o.history.push({ round: o.round, demanded: demandedSum });

        let acceptThreshold = marketRatio <= 1.15 ? 0.70 : (marketRatio <= 1.40 ? 0.40 : 0.15);
        let walkAwayThreshold = marketRatio > 1.50 ? 0.45 : (marketRatio > 1.25 ? 0.25 : 0.10);
        let roll = Math.random();

        if (roll < acceptThreshold) {
            o.currentBid = demandedSum;
            o.statusText = `✅ ${o.clubName} akzeptiert deine Forderung von ${formatVal(demandedSum)}! Vollzug bereit.`;
            playSound('goal');
        } else if (roll < (acceptThreshold + walkAwayThreshold)) {
            let oIdx = incomingOffers.findIndex(x => x.id === offerId);
            incomingOffers.splice(oIdx, 1);
            showToast(`❌ ${o.clubName} hält ${formatVal(demandedSum)} für unverschämt und zieht sich zurück.`, 'error');
            closeNegotiationStepper();
            renderTransferView();
            updateUI();
            return;
        } else {
            let compromise = Math.round((o.currentBid + demandedSum) / 2 / 5000) * 5000;
            o.currentBid = compromise;
            o.statusText = `💬 ${o.clubName} bessert auf: Letztes Angebot ${formatVal(compromise)} (${o.round}. Runde).`;
        }

        renderTransferView();
        updateUI();
        if (document.getElementById('negotiation-stepper-overlay')?.classList.contains('show')) renderNegotiationStepper(offerId);
    }

    // ---------- VERHANDLUNGS-STEPPER-MODAL ----------
    let negoStepSize = 10000;
    let negoCurrentOfferId = null;
    let negoAmount = 0;
    let negoResellPct = 0;

    function openNegotiationStepper(offerId) {
        negoCurrentOfferId = offerId;
        let o = incomingOffers.find(x => x.id === offerId);
        if (!o) return;
        negoAmount = o.currentBid;
        negoStepSize = Math.max(5000, Math.round(o.currentBid * 0.02 / 1000) * 1000);
        negoResellPct = o.resellPct || 0;
        document.getElementById('negotiation-stepper-overlay').classList.add('show');
        renderNegotiationStepper(offerId);
    }
    function closeNegotiationStepper() {
        document.getElementById('negotiation-stepper-overlay').classList.remove('show');
        negoCurrentOfferId = null;
    }
    function negoAdjustStep(mult) {
        negoStepSize = Math.max(1000, Math.round(negoStepSize * mult / 1000) * 1000);
        renderNegotiationStepper(negoCurrentOfferId);
    }
    function negoAdjustAmount(dir) {
        negoAmount = Math.max(0, negoAmount + dir * negoStepSize);
        renderNegotiationStepper(negoCurrentOfferId);
    }
    function negoAdjustResell(dir) {
        negoResellPct = Math.max(0, Math.min(30, negoResellPct + dir * 5));
        renderNegotiationStepper(negoCurrentOfferId);
    }
    function negoSendOffer() {
        let o = incomingOffers.find(x => x.id === negoCurrentOfferId);
        if (!o) return;
        o.resellPct = negoResellPct;
        applyTransferCounterDemand(negoCurrentOfferId, negoAmount);
    }
    function renderNegotiationStepper(offerId) {
        let o = incomingOffers.find(x => x.id === offerId);
        if (!o) { closeNegotiationStepper(); return; }
        let p = squad.find(x => x.id === o.playerId);
        document.getElementById('nego-player-name').innerText = o.playerName;
        document.getElementById('nego-club-name').innerText = `Verkaufsverhandlung mit ${o.clubName}`;
        document.getElementById('nego-step-value').innerText = formatVal(negoStepSize);
        document.getElementById('nego-amount-value').innerText = formatVal(negoAmount);
        document.getElementById('nego-resell-value').innerText = negoResellPct + '%';
        let histList = document.getElementById('nego-history-list');
        histList.innerHTML = (o.history || []).slice().reverse().map(h => `<div style="font-size:10px; color:#94a3b8;">Runde ${h.round}: ${formatVal(h.demanded)} gefordert</div>`).join('') || '<div style="font-size:10px; color:#64748b;">Noch keine Nachverhandlung.</div>';
        document.getElementById('player-detail-link-nego').onclick = () => { closeNegotiationStepper(); if (p) openPlayerDetail(p.id, 'squad'); };
    }

    function renderTransferView() {
        renderLoanMarketView();
        renderWinterWindowBanner();
        let offList = document.getElementById('incoming-offers-list');
        offList.innerHTML = '';
        if (incomingOffers.length === 0) {
            offList.innerHTML = `<div class="box" style="text-align:center; color:#888;">Derzeit liegen keine offiziellen Transferanfragen für deine Spieler vor.</div>`;
        } else {
            incomingOffers.forEach(o => {
                let p = squad.find(x => x.id === o.playerId);
                let badgeClass = 'badge-' + (o.playerPos || 'mit').toLowerCase();
                let diff = o.currentBid - o.marketValue;
                let diffColor = diff >= 0 ? 'var(--primary)' : 'var(--danger)';
                let diffText = (diff >= 0 ? '+' : '') + formatVal(diff);

                let card = document.createElement('div');
                card.className = 'panel box-offer';
                card.innerHTML = `
                    <div class="panel-header" style="color:var(--blue);">
                        <span>💼 Angebot von <strong>${o.clubName}</strong></span>
                        <span style="font-size:9px; color:#aaa;">Gültig: ${o.expiresIn} SpT</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <div>
                            <span class="badge ${badgeClass}">${o.playerPos}</span>
                            <button onclick="openPlayerDetail('${o.playerId}','squad')" class="btn-secondary" style="width:auto; padding:2px 6px; font-size:9px;" title="Details">ℹ️</button>
                            <strong>${o.playerName}</strong> (Stärke: ${o.playerStr})
                            <div style="font-size:9px; color:#aaa;">Marktwert: ${formatVal(o.marketValue)}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px; font-weight:900; color:var(--accent);">${formatVal(o.currentBid)}</div>
                            <div style="font-size:9px; color:${diffColor}; font-weight:bold;">${diffText} vs MW</div>
                        </div>
                    </div>
                    <div style="font-size:10px; color:#cbd5e1; margin-bottom:8px;">${o.statusText}</div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom:4px;">
                        <button onclick="acceptTransferOffer('${o.id}')" class="btn-primary" style="font-size:10px;">✔ Annehmen (${formatVal(o.currentBid)})</button>
                        <button onclick="rejectTransferOffer('${o.id}')" class="btn-danger" style="font-size:10px;">✖ Ablehnen</button>
                    </div>
                    <button onclick="acceptTransferOfferWithClause('${o.id}')" class="btn-gold" style="font-size:9px; margin-bottom:4px;">📜 Mit 15% Weiterverkaufsbeteiligung (${formatVal(Math.round(o.currentBid*0.94))} sofort)</button>
                    <button onclick="openNegotiationStepper('${o.id}')" class="btn-secondary" style="font-size:10px; margin-top:4px;">🔧 Nachverhandeln (Schrittweite-Angebot)</button>
                `;
                offList.appendChild(card);
            });
        }

        let mList = document.getElementById('market-list');
        mList.innerHTML = '';
        marketPlayers.forEach((p, idx) => {
            let row = document.createElement('div');
            row.className = 'panel player-card';
            row.style.cssText = 'margin-bottom:6px; padding:8px;';
            let badgeClass = 'badge-' + (p.pos || 'mit').toLowerCase();
            let traitBadge = (p.trait && p.trait !== 'Kein') ? `<span class="badge badge-trait">${p.trait}</span>` : '';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="badge ${badgeClass}">${p.pos}</span>
                        <strong style="font-size:12px;">${p.name}</strong>
                        ${traitBadge}
                    </div>
                    <button onclick="openPlayerDetail('${p.id}','market')" class="btn-secondary" style="width:auto; padding:3px 7px; font-size:9px;" title="Details">ℹ️</button>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap:2px; font-size:9px; color:#aaa; text-align:center; margin-bottom:6px; background:rgba(228,197,140,0.05); border-radius:4px; padding:4px 0;">
                    <div>STR<br><strong style="color:var(--accent); font-size:11px;">${p.strength}</strong></div>
                    <div>PAC<br><strong>${p.pace}</strong></div>
                    <div>SHO<br><strong>${p.shooting}</strong></div>
                    <div>PAS<br><strong>${p.passing}</strong></div>
                    <div>DEF<br><strong>${p.defense}</strong></div>
                </div>
                <button onclick="buyPlayer(${idx})" class="btn-action">Kaufen [${formatVal(p.marketValue)}]</button>
            `;
            mList.appendChild(row);
        });

        let fList = document.getElementById('free-agents-list');
        fList.innerHTML = '';
        freeAgentPlayers.forEach((p, idx) => {
            let row = document.createElement('div');
            row.className = 'panel player-card';
            row.style.cssText = 'margin-bottom:6px; padding:8px;';
            let isNegotiating = pendingFreeAgentNegotiation && pendingFreeAgentNegotiation.playerId === p.id;
            let feeDisplay = isNegotiating ? pendingFreeAgentNegotiation.counterFee : p.signOnFee;
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span><strong class="badge badge-${(p.pos||'mit').toLowerCase()}">${p.pos}</strong> ${p.name} (Str: ${p.strength}) <span style="font-size:8px; color:var(--text-muted);">${p.character || ''}</span></span>
                    <button onclick="signFreeAgent(${idx})" class="btn-blue" style="width:auto;">Verpflichten [Handgeld: ${formatVal(feeDisplay)}]</button>
                </div>
                ${isNegotiating ? `<div class="box" style="font-size:9px; margin-top:4px; border-left-color:var(--danger);">💬 Gegenangebot: ${p.name} verlangt ${formatVal(pendingFreeAgentNegotiation.counterFee)} statt ursprünglich ${formatVal(p.signOnFee)}. <button onclick="rejectFreeAgentCounter()" class="btn-secondary" style="width:auto; font-size:8px; margin-left:4px;">Ablehnen</button></div>` : ''}
            `;
            fList.appendChild(row);
        });

        let sList = document.getElementById('sell-list');
        sList.innerHTML = '';
        squad.forEach((p) => {
            let row = document.createElement('div');
            row.className = 'player-row';
            row.innerHTML = `<span>${p.name} (${p.pos}|Str:${p.strength})</span><button onclick="sellPlayer('${p.id}')" class="btn-danger" style="width:auto;">Blitzverkauf [${formatVal(Math.round(p.marketValue*0.80))}]</button>`;
            sList.appendChild(row);
        });

        updateUI();
    }

    function setTransferTab(tab) {
        playSound('click');
        ['offers', 'market', 'free', 'loan', 'sell'].forEach(t => {
            let el = document.getElementById('transfer-tab-' + t);
            if (el) el.style.display = (t === tab) ? 'block' : 'none';
            let btn = document.getElementById('btn-tab-tr-' + t);
            if (btn) btn.className = (t === tab) ? 'btn-action' : 'btn-secondary';
        });
    }

    function renderLoanMarketView() {
        let box = document.getElementById('loan-market-list');
        if (!box) return;
        if (loanablePlayers.length === 0) { box.innerHTML = '<div class="box">Aktuell keine Leihspieler verfügbar.</div>'; return; }
        box.innerHTML = loanablePlayers.map((p, idx) => `
            <div class="panel">
                <div class="panel-header"><span>${p.name} (${p.pos}, Str ${p.strength})</span><span style="color:var(--text-muted); font-size:9px;">von ${p.loanParentClub}</span></div>
                <div style="font-size:9px; color:#aaa; margin-bottom:4px;">Leihgebühr: <strong style="color:var(--accent);">${formatVal(p.loanFee)}</strong> · Kaufoption später: <strong>${formatVal(p.loanBuyOptionFee)}</strong> · Dauer: Saisonende</div>
                <button onclick="signLoanPlayer(${idx})" class="btn-action">Ausleihen</button>
            </div>
        `).join('');
        let activeBox = document.getElementById('active-loans-in-list');
        if (activeBox) {
            if (incomingLoans.length === 0) { activeBox.innerHTML = '<div class="box" style="font-size:9px; color:var(--text-muted);">Aktuell keine eigenen Leihspieler im Kader.</div>'; }
            else {
                activeBox.innerHTML = incomingLoans.map(loan => {
                    let p = squad.find(x => x.id === loan.playerId);
                    if (!p) return '';
                    return `<div class="panel">
                        <div class="panel-header" style="font-size:10px;"><span>${p.name}</span><span style="color:var(--text-muted); font-size:8px;">von ${loan.parentClub}</span></div>
                        <div style="font-size:9px; margin-bottom:4px;">Restlaufzeit: ${loan.matchdaysLeft} SpT · Kaufoption: ${formatVal(loan.buyOptionFee)}</div>
                        <button onclick="exerciseLoanBuyOption('${p.id}')" class="btn-gold">Kaufoption ziehen</button>
                    </div>`;
                }).join('');
            }
        }
    }

    // Bieterwettstreit (NEU): bei begehrten Spielern (Stärke 65+) steigt gelegentlich ein
    // Rivale mit ins Rennen ein - der Preis steigt, ein zweiter Klick bestätigt den Aufpreis.
    let pendingBiddingWarId = null;
    function buyPlayer(idx) {
        let p = marketPlayers[idx];
        if (game.transferEmbargo) { alert("🚫 Transfersperre aktiv! Erst die Zahlungsfähigkeit wiederherstellen (siehe Finanzen)."); return; }
        if (pendingBiddingWarId !== p.id && p.strength >= 65 && Math.random() < 0.15) {
            pendingBiddingWarId = p.id;
            let premium = Math.round(p.marketValue * 0.25);
            p.marketValue += premium;
            showToast(`⚔️ Bieterwettstreit! Ein Rivale bietet auch mit - neuer Preis: ${formatVal(p.marketValue)}. Nochmal klicken, um ihn dir zu sichern!`, 'error');
            renderTransferView();
            return;
        }
        pendingBiddingWarId = null;
        let agentFee = getAgentFee(p, p.marketValue);
        let totalCost = p.marketValue + agentFee;
        if (game.money < totalCost) { alert(`Nicht genug Geld auf dem Vereinskonto!${agentFee > 0 ? ` (inkl. ${formatVal(agentFee)} Beraterprovision)` : ''}`); return; }
        if (game.transferBudget < p.marketValue) { alert("Transferbudget reicht nicht aus! Verhandle mit dem Vorstand oder verkaufe erst einen Spieler."); return; }
        let totalWages = squad.reduce((s, pl) => s + pl.wage, 0) + (game.secondTeam.isActive ? secondTeamSquad.reduce((s, pl) => s + pl.wage, 0) : 0);
        if (totalWages + p.wage > game.wageBudget) { alert("Gehaltsbudget reicht nicht aus für diesen Spieler!"); return; }
        playSound('click');
        game.money -= totalCost;
        game.transferBudget -= p.marketValue;
        squad.push(p);
        marketPlayers.splice(idx, 1);
        if (agentFee > 0) showToast(`✅ ${p.name} verpflichtet (inkl. ${formatVal(agentFee)} Beraterprovision an ${p.agent.name}).`, 'success');
        renderTransferView();
        updateUI();
    }

    // Vertragsverhandlung mit Gegenangeboten (NEU): statt nur "Ja/Nein" kann der Spieler
    // ein Gegenangebot stellen, das von seinem Charakter abhängt - manche Spieler sind
    // zäher in Verhandlungen als andere.
    let pendingFreeAgentNegotiation = null;
    const CHARACTER_TOUGHNESS = { Ehrgeizig: 1.35, Selbstbewusst: 1.2, Emotional: 1.1, Hitzköpfig: 1.15, Ruhig: 0.9, Bescheiden: 0.75 };
    function signFreeAgent(idx) {
        let p = freeAgentPlayers[idx];
        if (game.transferEmbargo) { alert("🚫 Transfersperre aktiv! Erst die Zahlungsfähigkeit wiederherstellen (siehe Finanzen)."); return; }
        let toughness = CHARACTER_TOUGHNESS[p.character] || 1.0;
        // Zähe Verhandler (ehrgeizig/selbstbewusst) fordern mit einer gewissen Wahrscheinlichkeit
        // ein höheres Handgeld nach, statt das erste Angebot einfach zu akzeptieren.
        if (!pendingFreeAgentNegotiation || pendingFreeAgentNegotiation.playerId !== p.id) {
            let counterChance = Math.min(0.75, 0.25 * toughness);
            if (Math.random() < counterChance) {
                let counterFee = Math.round(p.signOnFee * (1.15 + (toughness - 1) * 0.3));
                pendingFreeAgentNegotiation = { playerId: p.id, counterFee };
                showToast(`💬 ${p.name} verlangt ein Gegenangebot: ${formatVal(counterFee)} statt ${formatVal(p.signOnFee)} Handgeld! Nochmal klicken zum Akzeptieren.`, 'error');
                renderTransferView();
                return;
            }
        }
        let finalFee = (pendingFreeAgentNegotiation && pendingFreeAgentNegotiation.playerId === p.id) ? pendingFreeAgentNegotiation.counterFee : p.signOnFee;
        if (game.money < finalFee) { alert("Nicht genug Geld für das Handgeld!"); return; }
        let totalWages = squad.reduce((s, pl) => s + pl.wage, 0) + (game.secondTeam.isActive ? secondTeamSquad.reduce((s, pl) => s + pl.wage, 0) : 0);
        if (totalWages + p.wage > game.wageBudget) { alert("Gehaltsbudget reicht nicht aus für diesen Spieler!"); return; }
        playSound('click');
        game.money -= finalFee;
        squad.push(p);
        freeAgentPlayers.splice(idx, 1);
        pendingFreeAgentNegotiation = null;
        renderTransferView();
        updateUI();
    }
    // Gegenangebot ablehnen: bricht die Verhandlung ab, der Spieler bleibt vorerst frei.
    function rejectFreeAgentCounter() {
        pendingFreeAgentNegotiation = null;
        showToast('Verhandlung abgebrochen.', 'success');
        renderTransferView();
    }

    // Eingespieltheit als Warnhinweis: bevor ein Spieler mit sehr hoher Chemie zu mehreren
    // Mitspielern verkauft wird, einmalig warnen und einen zweiten Klick zur Bestätigung
    // verlangen (dialogfreie Zwei-Klick-Bestätigung, passend zum Rest des Spiels).
    let pendingChemistrySaleWarningId = null;
    function checkHighChemistryBeforeSale(p) {
        if (!lineup.includes(p.id)) return true; // nicht in der Startelf -> keine Relevanz
        if (pendingChemistrySaleWarningId === p.id) { pendingChemistrySaleWarningId = null; return true; } // bereits bestätigt
        let highChemPartners = lineup.filter(oid => oid !== p.id).map(oid => {
            let key = [p.id, oid].sort().join('_');
            return { oid, val: (game.pairChemistry && game.pairChemistry[key]) || 0 };
        }).filter(x => x.val >= 15);
        if (highChemPartners.length < 2) return true; // keine besondere Eingespieltheit betroffen
        pendingChemistrySaleWarningId = p.id;
        let names = highChemPartners.map(x => squad.find(s => s.id === x.oid)?.name).filter(Boolean).join(', ');
        showToast(`⚠️ ${p.name} ist stark eingespielt mit ${names}! Nochmal klicken, um den Verkauf trotzdem durchzuführen.`, 'error');
        setTimeout(() => { if (pendingChemistrySaleWarningId === p.id) pendingChemistrySaleWarningId = null; }, 6000);
        return false;
    }

    function sellPlayer(id) {
        if (squad.length <= 11) { alert("Kader darf nicht weniger als 11 Spieler umfassen!"); return; }
        let pCheck = squad.find(x => x.id === id);
        if (pCheck && !checkHighChemistryBeforeSale(pCheck)) return;
        playSound('click');
        let idx = squad.findIndex(p => p.id === id);
        if (idx !== -1) {
            let p = squad[idx];
            let sum = Math.round(p.marketValue * 0.80);
            // Verhandlungsfuchs-Perk: +15% Erlöse bei Verkäufen (war bisher nur beim
            // Verhandlungs-Multiplikator wirksam, nicht beim direkten Sofortverkauf).
            if (managerRPG.perks.negotiator) sum = Math.round(sum * 1.15);
            let agentFee = getAgentFee(p, sum);
            game.money += sum - agentFee;
            game.transferBudget += Math.round(sum * 0.8);
            checkFriendshipDeparture(p);
            recordNotablePastPlayer(p);
            checkCrowdFavoriteDeparture(p);
            squad.splice(idx, 1);
            lineup = lineup.filter(pid => pid !== id);
            incomingOffers = incomingOffers.filter(o => o.playerId !== id);
            if (agentFee > 0) showToast(`💰 Verkauft (abzüglich ${formatVal(agentFee)} Beraterprovision an ${p.agent.name}).`, 'success');
            renderTransferView();
            updateUI();
        }
    }

