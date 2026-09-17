
    // ==========================================
    // WETTBÜRO: FIKTIVER BUCHMACHER MIT ECHTEN QUOTEN
    // ==========================================
    const BETTING_PROVIDER_NAME = "QuotenFuchs";
    const BET_MARGIN = 1.12; // Buchmacher-Marge, macht Wetten im Erwartungswert bewusst negativ
    const MAX_BET_STAKE_FRACTION = 0.15; // max. 15% des aktuellen Kontostands
    const MIN_BET_STAKE = 10;

    // Reine, testbare Quotenberechnung aus Stärkedifferenz + Heimvorteil.
    function calcOddsFromStrength(ourStr, oppStr, isHome) {
        let diff = (ourStr - oppStr) + (isHome ? 5 : -5);
        let pWin = 1 / (1 + Math.exp(-diff / 12));
        let pDraw = Math.max(0.14, Math.min(0.30, 0.24 - Math.abs(diff) * 0.003));
        let pLoss = Math.max(0.03, 1 - pWin - pDraw);
        let total = pWin + pDraw + pLoss;
        pWin /= total; pDraw /= total; pLoss /= total;
        return {
            oddsWin: +(1 / pWin / BET_MARGIN).toFixed(2),
            oddsDraw: +(1 / pDraw / BET_MARGIN).toFixed(2),
            oddsLoss: +(1 / pLoss / BET_MARGIN).toFixed(2)
        };
    }

    function calcNextMatchOdds() {
        let md = game.matchday;
        let fixs = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][md - 1] : null;
        if (!fixs) return null;
        let ourFixture = fixs.find(f => {
            let h = leaguesData[game.leagueLevel][f.home].name, a = leaguesData[game.leagueLevel][f.away].name;
            return (h === game.clubName || a === game.clubName);
        });
        if (!ourFixture || ourFixture.played) return null;

        let isHome = leaguesData[game.leagueLevel][ourFixture.home].name === game.clubName;
        let ourStr = calcTeamStrength(isHome);
        let oppName = isHome ? leaguesData[game.leagueLevel][ourFixture.away].name : leaguesData[game.leagueLevel][ourFixture.home].name;
        let oppObj = leaguesData[game.leagueLevel].find(t => t.name === oppName);
        let oppStr = applySabotageToOpponentStrength(oppObj ? oppObj.strength : 60);

        let odds = calcOddsFromStrength(ourStr, oppStr, isHome);
        odds.oppName = oppName;
        odds.isHome = isHome;
        // Sonderwetten-Quoten: Über/Unter 2.5 Tore & Beide Teams treffen - grob aus der
        // Gesamt-Offensivstärke beider Teams hergeleitet (rein heuristisch, aber reagiert
        // sinnvoll auf starke Angriffsteams vs. große Stärkeunterschiede).
        let combinedStrength = (ourStr + oppStr) / 2;
        let pOver = Math.max(0.25, Math.min(0.75, 0.5 + (combinedStrength - 60) * 0.004));
        odds.oddsOver = +(1 / pOver / BET_MARGIN).toFixed(2);
        odds.oddsUnder = +(1 / (1 - pOver) / BET_MARGIN).toFixed(2);
        let pBtts = Math.max(0.25, Math.min(0.7, 0.48 - Math.abs(ourStr - oppStr) * 0.004));
        odds.oddsBttsYes = +(1 / pBtts / BET_MARGIN).toFixed(2);
        odds.oddsBttsNo = +(1 / (1 - pBtts) / BET_MARGIN).toFixed(2);
        return odds;
    }

    function placeBet(outcome, stake) {
        if (activeBet) { showToast('Es läuft bereits eine Wette für den nächsten Spieltag!', 'error'); return; }
        let odds = calcNextMatchOdds();
        if (!odds) { showToast('Kein anstehendes Ligaspiel zum Wetten gefunden!', 'error'); return; }
        let maxStake = Math.max(MIN_BET_STAKE, Math.round(game.money * MAX_BET_STAKE_FRACTION));
        stake = Math.min(stake, maxStake, game.money);
        if (!stake || stake < MIN_BET_STAKE) { showToast(`Mindesteinsatz ${MIN_BET_STAKE} €, Höchsteinsatz ${formatVal(maxStake)} (15% des Kontostands)!`, 'error'); return; }
        playSound('click');
        game.money -= stake;
        let oddsForOutcome = outcome === 'win' ? odds.oddsWin : (outcome === 'draw' ? odds.oddsDraw : odds.oddsLoss);
        activeBet = { type: 'outcome', outcome, stake, odds: oddsForOutcome, matchday: game.matchday };
        renderBettingView(); updateUI();
        let outcomeLabel = outcome === 'win' ? 'Sieg' : (outcome === 'draw' ? 'Unentschieden' : 'Niederlage');
        showToast(`💰 Wette bei ${BETTING_PROVIDER_NAME} platziert: ${formatVal(stake)} auf ${outcomeLabel} @ ${oddsForOutcome}`, 'success');
    }

    // NEU: Sonderwetten (Über/Unter 2.5 Tore, Beide Teams treffen).
    function placeSpecialBet(specialType, stake) {
        if (activeBet) { showToast('Es läuft bereits eine Wette für den nächsten Spieltag!', 'error'); return; }
        let odds = calcNextMatchOdds();
        if (!odds) { showToast('Kein anstehendes Ligaspiel zum Wetten gefunden!', 'error'); return; }
        let maxStake = Math.max(MIN_BET_STAKE, Math.round(game.money * MAX_BET_STAKE_FRACTION));
        stake = Math.min(stake, maxStake, game.money);
        if (!stake || stake < MIN_BET_STAKE) { showToast(`Mindesteinsatz ${MIN_BET_STAKE} €, Höchsteinsatz ${formatVal(maxStake)}!`, 'error'); return; }
        let oddsMap = { over: odds.oddsOver, under: odds.oddsUnder, bttsYes: odds.oddsBttsYes, bttsNo: odds.oddsBttsNo };
        let labelMap = { over: 'Über 2.5 Tore', under: 'Unter 2.5 Tore', bttsYes: 'Beide Teams treffen', bttsNo: 'Nicht beide Teams treffen' };
        playSound('click');
        game.money -= stake;
        activeBet = { type: 'special', outcome: specialType, stake, odds: oddsMap[specialType], matchday: game.matchday };
        renderBettingView(); updateUI();
        showToast(`💰 Sonderwette platziert: ${formatVal(stake)} auf "${labelMap[specialType]}" @ ${oddsMap[specialType]}`, 'success');
    }

    // NEU: Kombiwette - verbindet Spielausgang UND eine Sonderwette in einer Wette, die
    // Gesamtquote ist das Produkt beider Einzelquoten (klassisches Kombiwetten-Prinzip),
    // mit einem kleinen Kombi-Aufschlag der Marge als zusätzliches Buchmacher-Risiko.
    function placeComboBet(outcome, specialType, stake) {
        if (activeBet) { showToast('Es läuft bereits eine Wette für den nächsten Spieltag!', 'error'); return; }
        let odds = calcNextMatchOdds();
        if (!odds) { showToast('Kein anstehendes Ligaspiel zum Wetten gefunden!', 'error'); return; }
        let maxStake = Math.max(MIN_BET_STAKE, Math.round(game.money * MAX_BET_STAKE_FRACTION));
        stake = Math.min(stake, maxStake, game.money);
        if (!stake || stake < MIN_BET_STAKE) { showToast(`Mindesteinsatz ${MIN_BET_STAKE} €, Höchsteinsatz ${formatVal(maxStake)}!`, 'error'); return; }
        let oddsForOutcome = outcome === 'win' ? odds.oddsWin : (outcome === 'draw' ? odds.oddsDraw : odds.oddsLoss);
        let oddsMap = { over: odds.oddsOver, under: odds.oddsUnder, bttsYes: odds.oddsBttsYes, bttsNo: odds.oddsBttsNo };
        let comboOdds = +(oddsForOutcome * oddsMap[specialType] * 0.95).toFixed(2); // kleiner Kombi-Abschlag
        playSound('click');
        game.money -= stake;
        activeBet = { type: 'combo', outcome, specialType, stake, odds: comboOdds, matchday: game.matchday };
        renderBettingView(); updateUI();
        showToast(`💰 Kombiwette platziert: ${formatVal(stake)} @ Gesamtquote ${comboOdds}`, 'success');
    }

    function cancelBet() {
        if (!activeBet) return;
        playSound('click');
        game.money += activeBet.stake; // Stornierung vor Anpfiff ohne Verlust möglich
        activeBet = null;
        renderBettingView(); updateUI();
    }

    // Wird nach jedem gespielten Spieltag aufgerufen; matchResult ist 'win'/'draw'/'loss'/null aus
    // unserer Sicht, goalInfo (NEU) ist { total, bothScored } für Sonder-/Kombiwetten.
    function resolveBetIfPending(matchResult, goalInfo = null) {
        if (!activeBet || !matchResult) return;
        let won = false;
        if (activeBet.type === 'outcome') {
            won = activeBet.outcome === matchResult;
        } else if (activeBet.type === 'special' && goalInfo) {
            won = checkSpecialBetWin(activeBet.outcome, goalInfo);
        } else if (activeBet.type === 'combo' && goalInfo) {
            won = (activeBet.outcome === matchResult) && checkSpecialBetWin(activeBet.specialType, goalInfo);
        }
        let payout = won ? Math.round(activeBet.stake * activeBet.odds) : 0;
        if (won) game.money += payout;
        // Wett-Historie (NEU): Ergebnis dauerhaft protokollieren.
        if (!betHistory) betHistory = [];
        betHistory.unshift({ season: game.season, matchday: activeBet.matchday, type: activeBet.type, stake: activeBet.stake, odds: activeBet.odds, won, payout });
        if (betHistory.length > 20) betHistory.pop();
        if (won) {
            alert(`🎉 WETTE GEWONNEN!\n${BETTING_PROVIDER_NAME} zahlt ${formatVal(payout)} aus (Einsatz ${formatVal(activeBet.stake)} @ ${activeBet.odds}).`);
        } else {
            alert(`😢 Wette verloren.\n${BETTING_PROVIDER_NAME} behält den Einsatz von ${formatVal(activeBet.stake)}.`);
        }
        activeBet = null;
        renderBettingView();
    }
    function checkSpecialBetWin(specialType, goalInfo) {
        if (specialType === 'over') return goalInfo.total > 2.5;
        if (specialType === 'under') return goalInfo.total < 2.5;
        if (specialType === 'bttsYes') return goalInfo.bothScored;
        if (specialType === 'bttsNo') return !goalInfo.bothScored;
        return false;
    }

    function renderBettingView() {
        let box = document.getElementById('betting-odds-box');
        if (!box) return;
        if (activeBet) {
            let label = activeBet.type === 'outcome'
                ? (activeBet.outcome === 'win' ? 'Sieg' : (activeBet.outcome === 'draw' ? 'Unentschieden' : 'Niederlage'))
                : activeBet.type === 'special'
                    ? { over: 'Über 2.5 Tore', under: 'Unter 2.5 Tore', bttsYes: 'Beide Teams treffen', bttsNo: 'Nicht beide treffen' }[activeBet.outcome]
                    : `Kombi: ${activeBet.outcome === 'win' ? 'Sieg' : (activeBet.outcome === 'draw' ? 'Remis' : 'Niederlage')} + Sonderwette`;
            box.innerHTML = `
                <div class="box" style="font-size:11px;">
                    Aktive Wette: <strong>${formatVal(activeBet.stake)}</strong> auf <strong>${label}</strong> @ ${activeBet.odds}<br>
                    Mögliche Auszahlung: <strong style="color:var(--primary);">${formatVal(Math.round(activeBet.stake * activeBet.odds))}</strong>
                </div>
                <button onclick="cancelBet()" class="btn-secondary" style="margin-top:6px;">Wette stornieren (Einsatz zurück)</button>
            `;
            renderBetHistory();
            return;
        }
        let odds = calcNextMatchOdds();
        if (!odds) {
            box.innerHTML = '<div class="box" style="font-size:10px; color:#64748b;">Kein anstehendes Ligaspiel zum Wetten gefunden.</div>';
            renderBetHistory();
            return;
        }
        let homeLabel = odds.isHome ? game.clubName : odds.oppName;
        let awayLabel = odds.isHome ? odds.oppName : game.clubName;
        box.innerHTML = `
            <div class="box" style="font-size:11px; margin-bottom:6px;">
                Nächstes Spiel: <strong>${homeLabel}</strong> vs <strong>${awayLabel}</strong><br>
                <span style="font-size:9px; color:#64748b;">Quoten von ${BETTING_PROVIDER_NAME} · Höchsteinsatz: ${formatVal(Math.max(MIN_BET_STAKE, Math.round(game.money * MAX_BET_STAKE_FRACTION)))}</span>
            </div>
            <input type="number" id="bet-stake-input" placeholder="Einsatz in €" class="input-inline" style="width:100%; margin-bottom:6px;">
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin-bottom:3px;">SPIELAUSGANG</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:8px;">
                <button onclick="placeBet('win', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-action" style="font-size:10px;">Sieg @ ${odds.oddsWin}</button>
                <button onclick="placeBet('draw', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Remis @ ${odds.oddsDraw}</button>
                <button onclick="placeBet('loss', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Niederlage @ ${odds.oddsLoss}</button>
            </div>
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin-bottom:3px;">SONDERWETTEN</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:4px;">
                <button onclick="placeSpecialBet('over', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Über 2.5 @ ${odds.oddsOver}</button>
                <button onclick="placeSpecialBet('under', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Unter 2.5 @ ${odds.oddsUnder}</button>
                <button onclick="placeSpecialBet('bttsYes', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Beide treffen @ ${odds.oddsBttsYes}</button>
                <button onclick="placeSpecialBet('bttsNo', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Nicht beide @ ${odds.oddsBttsNo}</button>
            </div>
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin-bottom:3px;">KOMBIWETTE (Sieg + Über 2.5)</div>
            <button onclick="placeComboBet('win', 'over', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-gold">Kombi Sieg + Über 2.5 @ ${+(odds.oddsWin * odds.oddsOver * 0.95).toFixed(2)}</button>
        `;
        renderBetHistory();
    }

    function renderBetHistory() {
        let box = document.getElementById('bet-history-box');
        if (!box) return;
        let hist = betHistory || [];
        box.innerHTML = hist.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Noch keine abgeschlossenen Wetten.</div>'
            : hist.slice(0, 8).map(b => `<div class="box" style="font-size:9px; display:flex; justify-content:space-between; ${b.won ? 'border-left-color:var(--primary);' : 'border-left-color:var(--danger);'}"><span>S${b.season}/${b.matchday}: ${formatVal(b.stake)} @ ${b.odds}</span><span style="color:${b.won ? 'var(--primary)' : 'var(--danger)'};">${b.won ? '+' + formatVal(b.payout) : 'Verloren'}</span></div>`).join('');
    }

