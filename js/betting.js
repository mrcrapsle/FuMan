
    // ==========================================
    // WETTBÜRO: FIKTIVER BUCHMACHER MIT ECHTEN QUOTEN
    // ==========================================
    const BETTING_PROVIDER_NAME = "QuotenFuchs";
    const BET_MARGIN = 1.12; // Buchmacher-Marge, macht Wetten im Erwartungswert bewusst negativ
    const MAX_BET_STAKE_FRACTION = 0.15; // max. 15% des aktuellen Kontostands
    const MIN_BET_STAKE = 10;

    const BET_SIMULATIONS = 400;
    const quote = pr => +(1 / Math.max(0.02, pr) / BET_MARGIN).toFixed(2);

    // Wahrscheinlichkeiten aus derselben Tor-Formel wie die Spieltagssimulation (simulateGoals).
    // Früher kamen sie aus einer eigenen Logistik-Formel, die die eigene Mannschaft deutlich
    // überschätzte - eine Wette auf die eigene Niederlage brachte im Schnitt +58 %.
    function simulateBetProbabilities(ownStr, oppStr, isHome, ownTeam, oppTeam) {
        let sieg = 0, remis = 0, ueber = 0, beide = 0, siegUndUeber = 0;
        for (let i = 0; i < BET_SIMULATIONS; i++) {
            const g = isHome ? simulateGoals(ownStr, oppStr, ownTeam, oppTeam) : simulateGoals(oppStr, ownStr, oppTeam, ownTeam);
            const own = isHome ? g.myGoals : g.oppGoals, opp = isHome ? g.oppGoals : g.myGoals;
            if (own > opp) sieg++; else if (own === opp) remis++;
            if (own + opp > 2) ueber++;
            if (own > 0 && opp > 0) beide++;
            if (own > opp && own + opp > 2) siegUndUeber++;
        }
        const n = BET_SIMULATIONS;
        return { win: sieg / n, draw: remis / n, loss: 1 - (sieg + remis) / n, over: ueber / n, btts: beide / n, winOver: siegUndUeber / n };
    }

    // Die eigene Stärke zählt mit der besten verfügbaren Elf - sonst ließe sich mit einer
    // schwachen Aufstellung eine hohe Siegquote holen und danach die Top-Elf aufstellen.
    function bettingOwnStrength(isHome) {
        const aktuell = calcTeamStrength(isHome);
        if (typeof pickBestLineupIds !== 'function') return aktuell;
        const gespeichert = lineup;
        lineup = pickBestLineupIds();
        const beste = calcTeamStrength(isHome);
        lineup = gespeichert;
        return Math.max(aktuell, beste);
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
        let ownTeam = leaguesData[game.leagueLevel].find(t => t.name === game.clubName) || null;
        let oppName = isHome ? leaguesData[game.leagueLevel][ourFixture.away].name : leaguesData[game.leagueLevel][ourFixture.home].name;
        let oppObj = leaguesData[game.leagueLevel].find(t => t.name === oppName);
        let oppStr = getOpponentMatchStrength(oppObj ? oppObj.strength : 60, !isHome);
        let pr = simulateBetProbabilities(bettingOwnStrength(isHome), oppStr, isHome, ownTeam, oppObj || null);
        return {
            oppName, isHome, probabilities: pr,
            oddsWin: quote(pr.win), oddsDraw: quote(pr.draw),
            oddsOver: quote(pr.over), oddsUnder: quote(1 - pr.over),
            oddsBttsYes: quote(pr.btts), oddsBttsNo: quote(1 - pr.btts),
            // Sieg und viele Tore hängen zusammen - die Kombi-Quote kommt deshalb aus der
            // gemeinsamen Wahrscheinlichkeit statt aus dem Produkt der Einzelquoten.
            oddsWinOver: quote(pr.winOver)
        };
    }

    function placeBet(outcome, stake) {
        if (outcome !== 'win' && outcome !== 'draw') { showToast('🚫 Wettverbot: Auf eine Niederlage der eigenen Mannschaft darf ein Verein nicht wetten.', 'error', 5000); return; }
        if (activeBet) { showToast('Es läuft bereits eine Wette für den nächsten Spieltag!', 'error'); return; }
        let odds = calcNextMatchOdds();
        if (!odds) { showToast('Kein anstehendes Ligaspiel zum Wetten gefunden!', 'error'); return; }
        let maxStake = Math.max(MIN_BET_STAKE, Math.round(game.money * MAX_BET_STAKE_FRACTION));
        stake = Math.min(stake, maxStake, game.money);
        if (!stake || stake < MIN_BET_STAKE) { showToast(`Mindesteinsatz ${MIN_BET_STAKE} €, Höchsteinsatz ${formatVal(maxStake)} (15% des Kontostands)!`, 'error'); return; }
        playSound('click');
        game.money -= stake;
        let oddsForOutcome = outcome === 'win' ? odds.oddsWin : odds.oddsDraw;
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
        if (outcome !== 'win' || specialType !== 'over') { showToast('Kombiwette nur als Sieg + Über 2.5 möglich.', 'error'); return; }
        if (activeBet) { showToast('Es läuft bereits eine Wette für den nächsten Spieltag!', 'error'); return; }
        let odds = calcNextMatchOdds();
        if (!odds) { showToast('Kein anstehendes Ligaspiel zum Wetten gefunden!', 'error'); return; }
        let maxStake = Math.max(MIN_BET_STAKE, Math.round(game.money * MAX_BET_STAKE_FRACTION));
        stake = Math.min(stake, maxStake, game.money);
        if (!stake || stake < MIN_BET_STAKE) { showToast(`Mindesteinsatz ${MIN_BET_STAKE} €, Höchsteinsatz ${formatVal(maxStake)}!`, 'error'); return; }
        let comboOdds = odds.oddsWinOver;
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
    // unserer Sicht, goalInfo ist { total, bothScored } für Sonder-/Kombiwetten.
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
        // Wett-Historie: Ergebnis dauerhaft protokollieren.
        if (!betHistory) betHistory = [];
        betHistory.unshift({ season: game.season, matchday: activeBet.matchday, type: activeBet.type, stake: activeBet.stake, odds: activeBet.odds, won, payout });
        if (betHistory.length > 20) betHistory.pop();
        if (won) {
            showNotice('🎉 Wette gewonnen', `${BETTING_PROVIDER_NAME} zahlt ${formatVal(payout)} aus.\n\nEinsatz ${formatVal(activeBet.stake)} bei einer Quote von ${activeBet.odds}.`);
        } else {
            showNotice('😢 Wette verloren', `${BETTING_PROVIDER_NAME} behält den Einsatz von ${formatVal(activeBet.stake)}.`, { typ: 'warn' });
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:4px;">
                <button onclick="placeBet('win', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-action" style="font-size:10px;">Sieg @ ${odds.oddsWin}</button>
                <button onclick="placeBet('draw', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Remis @ ${odds.oddsDraw}</button>
            </div>
            <div style="font-size:8px; color:var(--text-muted); margin-bottom:8px;">🚫 Auf eine Niederlage der eigenen Mannschaft zu wetten ist verboten. Quoten gelten für deine beste verfügbare Elf.</div>
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin-bottom:3px;">SONDERWETTEN</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:4px;">
                <button onclick="placeSpecialBet('over', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Über 2.5 @ ${odds.oddsOver}</button>
                <button onclick="placeSpecialBet('under', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Unter 2.5 @ ${odds.oddsUnder}</button>
                <button onclick="placeSpecialBet('bttsYes', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Beide treffen @ ${odds.oddsBttsYes}</button>
                <button onclick="placeSpecialBet('bttsNo', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-secondary" style="font-size:10px;">Nicht beide @ ${odds.oddsBttsNo}</button>
            </div>
            <div style="font-size:9px; font-weight:800; color:var(--text-muted); margin-bottom:3px;">KOMBIWETTE (Sieg + Über 2.5)</div>
            <button onclick="placeComboBet('win', 'over', parseInt(document.getElementById('bet-stake-input').value)||0)" class="btn-gold">Kombi Sieg + Über 2.5 @ ${odds.oddsWinOver}</button>
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

