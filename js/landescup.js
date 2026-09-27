    // ==========================================
    // LANDESPOKALE (VERBANDSPOKALE)
    // ==========================================
    // Im echten deutschen Fußball qualifiziert man sich aus den unteren Ligen NICHT direkt
    // für den DFB-Pokal. Ab der 3. Liga aufwärts ist man automatisch dabei; darunter führt
    // der Weg ausschließlich über den Landespokal des eigenen Verbands. Genau dieser Schritt
    // fehlte bisher: Ein Sechstligist startete einfach im DFB-Pokal gegen Bundesligisten.
    //
    // Der Landespokal ist damit der eigentliche Wettbewerb der unteren Ligen - überschaubare
    // Gegner aus der Region, machbare Prämien, und als Hauptpreis der Einzug in den
    // DFB-Pokal der Folgesaison.
    const LANDESVERBAENDE = [
        'Sachsen', 'Sachsen-Anhalt', 'Thüringen', 'Brandenburg', 'Berlin',
        'Mecklenburg-Vorpommern', 'Bayern', 'Westfalen', 'Niederrhein', 'Hessen'
    ];
    // Ab dieser Ligastufe (0 = 1. Bundesliga) ist man ohne Landespokal im DFB-Pokal dabei.
    const DFB_POKAL_DIREKT_AB_LIGA = 2;

    function isQualifiedForDfbPokal() {
        if (game.leagueLevel <= DFB_POKAL_DIREKT_AB_LIGA) return true;
        return !!game.dfbPokalViaLandespokal;
    }

    function playsLandespokal() {
        return game.leagueLevel > DFB_POKAL_DIREKT_AB_LIGA;
    }

    // Gegner kommen aus der eigenen und den benachbarten Spielklassen - im Landespokal
    // treffen Vereine mehrerer Ligen aufeinander, aber eben nur aus derselben Region.
    function buildLandesPokalTeams(anzahl) {
        let teams = [game.clubName];
        let ligen = [game.leagueLevel, game.leagueLevel - 1, game.leagueLevel + 1]
            .filter(l => l >= DFB_POKAL_DIREKT_AB_LIGA + 1 && l < NUM_LEAGUES);
        let kandidaten = [];
        ligen.forEach(l => (leaguesData[l] || []).forEach(t => {
            if (t.name !== game.clubName && !kandidaten.includes(t.name)) kandidaten.push(t.name);
        }));
        kandidaten.sort(() => Math.random() - 0.5);
        for (let name of kandidaten) {
            if (teams.length >= anzahl) break;
            teams.push(name);
        }
        // Notfalls mit frischen Namen auffüllen (sehr kleine Pyramide).
        while (teams.length < anzahl) {
            let t = generateTeamName();
            if (!teams.includes(t)) teams.push(t);
        }
        return teams;
    }

    function initLandesPokal() {
        landesPokal.roundsHistory = [];
        landesPokal.currentRound = 0;
        landesPokal.drawCeremonyShown = false;
        landesPokal.active = playsLandespokal();
        landesPokal.won = false;
        if (!landesPokal.active) return;

        let teams = buildLandesPokalTeams(16);
        teams.sort(() => Math.random() - 0.5);
        let pairings = [];
        for (let i = 0; i < teams.length; i += 2) {
            pairings.push({ home: teams[i], away: teams[i + 1], homeGoals: null, awayGoals: null, penaltyWinner: null, played: false });
        }
        landesPokal.roundsHistory.push({
            roundIndex: 0, name: landesPokal.roundNames[0], matchday: landesPokal.matchdays[0],
            prize: getLandesPokalPrize(0), pairings, completed: false
        });
    }

    // Prämien liegen bewusst weit unter denen des DFB-Pokals - ein Verbandspokal finanziert
    // keine Saison, er öffnet eine Tür. Sie skalieren mit der Ligastufe.
    function getLandesPokalPrize(roundIdx) {
        let basis = [4000, 8000, 16000, 35000][roundIdx] || 4000;
        let skala = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        return Math.round(basis * skala / 500) * 500;
    }

    function simulateLandesPokalRound(roundIdx, isLiveContext = false) {
        if (!landesPokal.active) return;
        let r = landesPokal.roundsHistory[roundIdx];
        if (!r || r.completed) return;

        let winners = new Array(r.pairings.length).fill(null);
        r.pairings.forEach((p, idx) => {
            if (p.played) {
                winners[idx] = (p.homeGoals > p.awayGoals) ? p.home : (p.awayGoals > p.homeGoals ? p.away : p.penaltyWinner);
                return;
            }
            let isOurMatch = (p.home === game.clubName || p.away === game.clubName);
            let isHome = p.home === game.clubName;
            let homeStr = isOurMatch ? (isHome ? calcTeamStrength(true) : getOpponentStrength(p.home)) : getOpponentStrength(p.home);
            let awayStr = isOurMatch ? (!isHome ? calcTeamStrength(false) : getOpponentStrength(p.away)) : getOpponentStrength(p.away);
            let goals = simulateGoals(homeStr, awayStr);
            p.homeGoals = goals.myGoals;
            p.awayGoals = goals.oppGoals;
            p.played = true;
            if (p.homeGoals === p.awayGoals) {
                // Im Verbandspokal wird ohne Schützen-Auswahl entschieden - der grosse
                // Elfmeter-Krimi bleibt dem DFB-Pokal und dem Europapokal vorbehalten.
                let shootout = simulatePenaltyShootout(p.home, p.away, homeStr, awayStr,
                    isOurMatch && isHome ? autoSelectShooters() : null,
                    isOurMatch && !isHome ? autoSelectShooters() : null);
                p.penaltyWinner = shootout.winner;
                winners[idx] = shootout.winner;
            } else {
                winners[idx] = p.homeGoals > p.awayGoals ? p.home : p.away;
            }
        });
        finalizeLandesPokalRound(roundIdx, winners, r, isLiveContext);
    }

    function finalizeLandesPokalRound(roundIdx, winners, r, isLiveContext = false) {
        let letzteRunde = roundIdx >= landesPokal.roundNames.length - 1;
        r.pairings.forEach((p, idx) => {
            if (p.home !== game.clubName && p.away !== game.clubName) return;
            let weWon = winners[idx] === game.clubName;
            let oppName = p.home === game.clubName ? p.away : p.home;
            if (weWon) {
                setzeBuchungskontext('🏆 Landespokal');
                game.money += r.prize;
                loescheBuchungskontext();
                playSound('goal');
                if (isLiveContext) addManagerXP(80);
                if (letzteRunde) {
                    landesPokal.won = true;
                    // DAS ist der eigentliche Gewinn: der Startplatz im DFB-Pokal der
                    // kommenden Saison.
                    game.dfbPokalViaLandespokal = true;
                    game.trophies.push(`${landesPokal.region}pokalsieger (Saison ${game.season})`);
                    boostFanBaseFloor(5, `Der Sieg im ${landesPokal.region}pokal`);
                    showNotice(`🏆 ${landesPokal.region}pokal gewonnen!`,
                        `${game.clubName} gewinnt den ${landesPokal.region}pokal mit einem Sieg über ${oppName}.\n\nPrämie ${formatVal(r.prize)} - und damit verbunden der Startplatz im DFB-Pokal der kommenden Saison.`);
                } else {
                    showNotice(`🏆 Weiter im ${landesPokal.region}pokal`,
                        `${r.name} gegen ${oppName} gewonnen. Prämie ${formatVal(r.prize)}.`);
                }
            } else {
                landesPokal.active = false;
                showNotice(`❌ Aus im ${landesPokal.region}pokal`,
                    `Niederlage in der ${r.name} gegen ${oppName}. Der Weg in den DFB-Pokal ist für diese Saison zu.`, { typ: 'warn' });
            }
        });

        r.completed = true;
        if (letzteRunde || winners.length < 2) return;

        landesPokal.currentRound++;
        let nextIdx = roundIdx + 1;
        let weiter = winners.filter(w => w);
        weiter.sort(() => Math.random() - 0.5);
        let nextPairings = [];
        for (let i = 0; i < weiter.length; i += 2) {
            if (weiter[i + 1]) nextPairings.push({ home: weiter[i], away: weiter[i + 1], homeGoals: null, awayGoals: null, penaltyWinner: null, played: false });
        }
        landesPokal.roundsHistory.push({
            roundIndex: nextIdx, name: landesPokal.roundNames[nextIdx], matchday: landesPokal.matchdays[nextIdx],
            prize: getLandesPokalPrize(nextIdx), pairings: nextPairings, completed: false
        });
    }

    function renderLandesPokalView() {
        let box = document.getElementById('landescup-container');
        if (!box) return;
        let kopf = document.getElementById('landescup-header');
        if (kopf) kopf.innerText = `🏅 ${landesPokal.region.toUpperCase()}POKAL`;

        if (!playsLandespokal()) {
            box.innerHTML = `<div class="box" style="font-size:11px; color:var(--text-muted);">
                Ab der ${leagueNames[DFB_POKAL_DIREKT_AB_LIGA]} ist der Verein direkt für den DFB-Pokal gesetzt - ein Landespokal wird dann nicht mehr gespielt.
            </div>`;
            return;
        }
        let runden = landesPokal.roundsHistory || [];
        let status = landesPokal.won ? 'Gewonnen ✓' : (landesPokal.active ? 'Im Wettbewerb' : 'Ausgeschieden ❌');
        box.innerHTML = `
            <div class="box" style="font-size:10px; margin-bottom:6px;">
                Der Weg in den DFB-Pokal führt für Vereine unterhalb der ${leagueNames[DFB_POKAL_DIREKT_AB_LIGA]}
                ausschliesslich über den Landespokal. Gespielt wird an den Spieltagen
                <strong>${landesPokal.matchdays.join(', ')}</strong> gegen Vereine aus der eigenen Region.
                <div style="margin-top:4px;">Status: <strong style="color:${landesPokal.won ? 'var(--gold)' : (landesPokal.active ? 'var(--primary)' : 'var(--danger)')};">${status}</strong>
                ${game.dfbPokalViaLandespokal ? ' · <strong style="color:var(--gold);">DFB-Pokal-Startplatz gesichert</strong>' : ''}</div>
            </div>
            ${runden.length === 0 ? '<div class="box" style="font-size:10px;">Die Auslosung steht noch aus.</div>' : runden.map(r => `
                <div class="box" style="margin-bottom:4px;">
                    <div style="font-size:10px; font-weight:900; color:var(--accent);">${r.name} · Spieltag ${r.matchday} · ${formatVal(r.prize)}</div>
                    ${r.pairings.filter(p => p.home === game.clubName || p.away === game.clubName || !r.completed).slice(0, 8).map(p => {
                        let uns = p.home === game.clubName || p.away === game.clubName;
                        let erg = p.played ? `<strong>${p.homeGoals}:${p.awayGoals}</strong>${p.penaltyWinner ? ' i.E.' : ''}` : 'vs';
                        return `<div style="display:flex; justify-content:space-between; font-size:9px; margin-top:2px; ${uns ? 'color:var(--primary); font-weight:bold;' : ''}">
                            <span>${p.home}</span><span>${erg}</span><span>${p.away}</span>
                        </div>`;
                    }).join('')}
                </div>`).join('')}`;
    }
