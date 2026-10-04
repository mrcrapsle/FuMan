/* eslint-disable no-undef */
// Pokal als Livespiel: An Pokal-Spieltagen spielt der Nutzer die eigene Partie im DFB-Pokal,
// Landespokal, Champions Cup oder Supercup (js/season-events.js) vor dem Ligaspiel in der Live-Engine (setupMatch), die
// Relegation auf Wunsch ebenso. Das Endergebnis landet in game.liveCupResult und wird von
// simulateCupRound(), simulateLandesPokalRound(), simulateEuropeMatchday() bzw.
// playRelegationLeg() statt eines gewürfelten Ergebnisses übernommen - Prämien, nächste
// Runde und Auslosung laufen unverändert dort.

// Eigene Champions-Cup-Partie an diesem Spieltag, mit derselben Paarungslogik wie
// simulateEuropeMatchday() (Gruppen, Halbfinale Hin-/Rückspiel, Finale).
function getOwnEuropeFixture(md) {
    if (!game.inEurope) return null;
    const et = europeTournament, us = game.clubName;
    const gruppen = [et.groupA, et.groupB].filter(g => Array.isArray(g) && g.length >= 4);
    const alle = gruppen.flat();
    const staerke = name => (alle.find(t => t.name === name) || {}).str || 84;
    const gi = [3, 7, 11, 15, 19, 23].indexOf(md);
    if (gi !== -1) {
        for (const [t1, t2, t3, t4] of gruppen) {
            const paare = gi % 3 === 0 ? [[t1, t2], [t3, t4]] : (gi % 3 === 1 ? [[t1, t3], [t2, t4]] : [[t1, t4], [t2, t3]]);
            const eigen = paare.find(([h, a]) => h.name === us || a.name === us);
            if (eigen) return { home: eigen[0].name, away: eigen[1].name, runde: 'Gruppenphase', oppStr: staerke(eigen[0].name === us ? eigen[1].name : eigen[0].name) };
        }
        return null;
    }
    if (md === 27 && gruppen.length === 2) {
        const sortiert = g => [...g].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
        const [a, b] = gruppen.map(sortiert);
        const eigen = [[a[0], b[1]], [b[0], a[1]]].find(([h, x]) => h.name === us || x.name === us);
        if (eigen) return { home: eigen[0].name, away: eigen[1].name, runde: 'Halbfinale, Hinspiel', oppStr: staerke(eigen[0].name === us ? eigen[1].name : eigen[0].name) };
        return null;
    }
    const semis = et.semiFinals || [];
    if (md === 29) {
        const tie = semis.find(t => !t.winner && (t.teamA === us || t.teamB === us));
        if (tie) return { home: tie.teamB, away: tie.teamA, runde: `Halbfinale, Rückspiel (Hinspiel ${tie.leg1Home}:${tie.leg1Away})`, oppStr: staerke(tie.teamA === us ? tie.teamB : tie.teamA) };
        return null;
    }
    if (md === 31 && semis.length === 2 && semis[0].winner && semis[1].winner && !et.finalMatch) {
        const [f1, f2] = [semis[0].winner, semis[1].winner];
        if (f1 === us || f2 === us) return { home: f1, away: f2, runde: 'Finale', oppStr: staerke(f1 === us ? f2 : f1) };
    }
    return null;
}

// Eigene, noch nicht gespielte Pokalpartie an diesem Spieltag (oder null).
function findOwnCupTieToday() {
    const md = game.matchday, us = game.clubName;
    const r0 = game.liveCupResult;
    if (r0 && r0.season === game.season && r0.matchday === md) return null; // heute schon live gespielt
    const supercup = typeof getOwnSupercupTie === 'function' ? getOwnSupercupTie() : null;
    if (supercup) return supercup;
    const offen = r => (r && !r.completed) ? r.pairings.find(p => !p.played && (p.home === us || p.away === us)) : null;
    const gegner = p => p.home === us ? p.away : p.home;

    const ci = cupTournament.matchdays.indexOf(md);
    const cupRunde = ci !== -1 ? cupTournament.roundsHistory[ci] : null;
    const cupPaar = offen(cupRunde);
    if (cupPaar) return { comp: 'dfb', titel: `🏆 DFB-Pokal · ${cupRunde.name}`, home: cupPaar.home, away: cupPaar.away, oppStr: getOpponentStrength(gegner(cupPaar)), elfmeter: true };

    if (typeof landesPokal !== 'undefined' && landesPokal.active) {
        const li = landesPokal.matchdays.indexOf(md);
        const lpRunde = li !== -1 ? landesPokal.roundsHistory[li] : null;
        const lpPaar = offen(lpRunde);
        if (lpPaar) return { comp: 'landes', titel: `🏅 Landespokal · ${lpRunde.name}`, home: lpPaar.home, away: lpPaar.away, oppStr: getOpponentStrength(gegner(lpPaar)), elfmeter: true };
    }

    if (europeTournament.matchdays.includes(md)) {
        const e = getOwnEuropeFixture(md);
        if (e) return { comp: 'europe', titel: `🌍 Champions Cup · ${e.runde}`, home: e.home, away: e.away, oppStr: e.oppStr, elfmeter: false };
    }
    return null;
}

// Wird von den Wettbewerben aufgerufen: liefert das live gespielte Ergebnis genau dieser
// Partie (und verbraucht es) oder null - dann wird wie bisher simuliert.
function takeLiveCupResult(comp, home, away) {
    const r = game.liveCupResult;
    if (!r || r.comp !== comp || r.season !== game.season || r.matchday !== game.matchday || r.home !== home || r.away !== away) return null;
    game.liveCupResult = null;
    return r;
}

// Vorbericht für die Pokalpartie: gleicher Bildschirm wie vor dem Ligaspiel.
function startCupLiveFlow(tie) {
    const us = game.clubName;
    const isHome = tie.home === us;
    const oppName = isHome ? tie.away : tie.home;
    pendingMatchInfo = { ourFixture: null, isHome, oppName, oppStr: tie.oppStr, cupTie: tie };
    const oppObj = leaguesData.flat().find(t => t.name === oppName) || null;
    renderPreMatchAnalysis(oppObj, oppName);
    if (typeof renderOppTacticBox === 'function') renderOppTacticBox(null);
    // Erzfeind-Kasten leeren (sonst stünde dort noch das letzte Ligaspiel), Ansprache anbieten.
    if (typeof renderNemesisPrematch === 'function') renderNemesisPrematch(null);
    if (typeof renderPregameTalkBox === 'function') renderPregameTalkBox();
    if (typeof renderFatigueWarning === 'function') renderFatigueWarning();
    const box = document.getElementById('prematch-analysis-box');
    const danach = tie.comp === 'relegation' ? '' : '<br><span style="color:var(--text-muted);">Das Ligaspiel folgt direkt im Anschluss.</span>';
    const finalBonus = typeof getCupFinalBonus === 'function' ? getCupFinalBonus(tie.comp) : 0;
    const finalZeile = finalBonus > 0 ? `<br>🏟️ Finalvorbereitung: +${String(finalBonus).replace('.', ',')} Stärke` : '';
    if (box) box.innerHTML = `<div class="box" style="font-size:11px; border-left-color:var(--gold);"><strong>${tie.titel}</strong><br>${tie.home} - ${tie.away} (Gegner-Stärke ${Math.round(tie.oppStr)})${finalZeile}${danach}</div>` + box.innerHTML;
    renderPressConference({ oppName, oppStr: tie.oppStr, isHome, cup: true });
    showScreen('screen-prematch-press');
}

// Direkt nach setupMatch(): Pokalspiel markieren und Aufstellung/Saisontore sichern.
// Einwechslungen und Pokaltore gelten nur für dieses Spiel (die Ligatorjägerliste und die
// Startelf fürs anschließende Ligaspiel bleiben unberührt; Karrieretore zählen).
function markCupLiveMatch(tie) {
    currentMatch.cupTie = tie;
    currentMatch.isEurope = tie.comp === 'europe';
    currentMatch.cupLineup = [...lineup];
    currentMatch.cupGoalsSeason = Object.fromEntries(squad.map(p => [p.id, p.goalsSeason || 0]));
    const titel = document.getElementById('match-title');
    if (titel) titel.innerText = `${tie.titel}: ${tie.home} vs ${tie.away}`;
    // Pokalfinale (js/cup-final.js): die Vorbereitung der Finalwoche wirkt im Endspiel.
    if (typeof applyCupFinalPreparation === 'function') applyCupFinalPreparation(tie);
}

// Abpfiff eines Pokalspiels (aus endMatchSimulation()): Ergebnis ablegen, bei Remis im
// K.-o.-Spiel sofort Elfmeterschießen mit eigener Schützenwahl.
function finishCupLiveMatch() {
    const m = currentMatch, tie = m.cupTie;
    lineup = m.cupLineup.filter(id => squad.some(p => p.id === id));
    if (typeof resetMatchEvents === 'function') resetMatchEvents(); // Pokaltore fließen nicht in die Liganoten
    squad.forEach(p => { if (p.id in m.cupGoalsSeason) p.goalsSeason = m.cupGoalsSeason[p.id]; });
    const ergebnis = { comp: tie.comp, season: game.season, matchday: game.matchday, home: tie.home, away: tie.away, homeGoals: m.homeGoals, awayGoals: m.awayGoals };
    game.liveCupResult = ergebnis;
    const isHome = tie.home === game.clubName;
    const unsere = isHome ? m.homeGoals : m.awayGoals, deren = isHome ? m.awayGoals : m.homeGoals;
    if (unsere > deren && typeof addManagerXP === 'function') addManagerXP(100);
    const btn = document.getElementById('btn-finish-match');
    const log = document.getElementById('ticker-log');

    if (tie.comp === 'relegation') {
        // Relegation: das Spiel wird sofort als Hin-/Rückspiel verbucht.
        m.cupWeiter = true;
        const r = playRelegationLeg(true);
        if (r && r.result) {
            const text = ({ promoted: '🎉 AUFSTIEG!', stayed: r.type === 'abstieg' ? '💪 Klasse gehalten!' : 'Kein Aufstieg.', relegated: '💔 Abstieg.' })[r.result];
            if (log) log.innerHTML += `<div style="font-weight:bold; color:var(--gold);">Gesamt ${r.aggregate}${r.penalties ? ' nach Elfmeterschießen' : ''}: ${text}</div>`;
        }
        if (typeof renderRelegationBox === 'function') renderRelegationBox();
        updateUI();
        return;
    }

    if (btn) btn.innerText = '▶ Weiter zum Ligaspiel';
    if (m.homeGoals === m.awayGoals && tie.elfmeter) {
        if (log) log.innerHTML += '<div style="font-weight:bold; color:var(--gold);">Unentschieden nach 90 Minuten - Elfmeterschießen! Wähle deine Schützen.</div>';
        openShooterOrderSelection(null, names => {
            const shootout = simulatePenaltyShootout(tie.home, tie.away, m.homeStr, m.awayStr, isHome ? names : null, isHome ? null : names);
            ergebnis.penaltyWinner = shootout.winner;
            showPenaltyShootoutTicker(shootout, tie.home, tie.away);
        });
    }
}

// Relegation live: Knopf in der Relegations-Box auf dem Dashboard.
function startRelegationLive() {
    const sit = typeof getRelegationSituation === 'function' ? getRelegationSituation() : null;
    if (!sit) return;
    const r = getRelegationState();
    if (r && r.result) return;
    const legIdx = r ? r.legs.length : 0;
    const isHome = (sit.type === 'aufstieg') === (legIdx === 0);
    const oppStr = typeof applySabotageToOpponentStrength === 'function' ? applySabotageToOpponentStrength(sit.oppStrength) : sit.oppStrength;
    startCupLiveFlow({
        comp: 'relegation', titel: `⚔️ Relegation · ${legIdx === 0 ? 'Hinspiel' : 'Rückspiel'}`,
        home: isHome ? game.clubName : sit.oppName, away: isHome ? sit.oppName : game.clubName, oppStr, elfmeter: false
    });
}
