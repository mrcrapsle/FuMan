
// ==========================================
// CHAMPIONS CUP (EUROPAPOKAL)
// ==========================================
    function initEuropeCup() {
        // Nutzt jetzt den bereits an anderer Stelle definierten, dezent verfremdeten
        // INTERNATIONAL_CLUB_NAMES-Pool statt (wie zuvor fälschlich) exakter echter
        // Vereinsnamen ("Real Madrid", "FC Bayern" etc.) - Konsistenz mit dem Rest des Spiels.
        const topEurope = INTERNATIONAL_CLUB_NAMES.filter(n => n !== 'Liverpol FC').slice(0, 7);
        let participants = game.inEurope ? [game.clubName, ...topEurope] : ["Liverpol FC", ...topEurope];
        participants.sort(() => Math.random() - 0.5);

        // Staerke des Teilnehmerfelds: Frueher bekam JEDER Teilnehmer fest 84-89. Das wurde
        // offenbar nie gegen die tatsaechlich erreichbare Teamstaerke geprueft - ein
        // Erstliga-Meister kommt im Spiel effektiv auf rund 72, und ein Rueckstand von
        // 12 bis 17 Punkten ist ueber sechs Gruppenspiele aussichtslos. Nachgemessen ueber
        // 20 simulierte Saisons: 18-mal Gruppenletzter, 2-mal Dritter, NIE die K.o.-Runde.
        // Halbfinale (8 Mio.), Finale und Titel (25 Mio.) waren damit toter Inhalt.
        //
        // Jetzt ist das Feld gestaffelt wie ein echter Wettbewerb - zwei Schwergewichte,
        // dann abfallend - und an das eigene Niveau gekoppelt. Der Titel ist erreichbar,
        // aber man muss dafuer die Favoriten schlagen.
        // Bezugsgroesse ist bewusst der reine Kaderschnitt und NICHT calcTeamStrength():
        // Letzteres schwankt stark mit Fitness, Moral und Form. Die Auslosung findet zum
        // Saisonstart statt, wo der Kader frisch und topfit ist - dort meldet
        // calcTeamStrength() rund 97, waehrend derselbe Kader ab Spieltag 20 nur noch auf
        // etwa 74 kommt. Das Teilnehmerfeld wurde also am Bestwert ausgerichtet und spielte
        // die ganze Saison gegen einen Verein, der diesen Wert nie wieder erreichte.
        // Der Abschlag von 6 Punkten bildet genau diesen Formverlust ueber die Saison ab.
        const FELD_STAFFELUNG = [9, 6, 4, 2, 0, -2, -4, -6];
        let kaderSchnitt = squad.length ? squad.reduce((sum, p) => sum + p.strength, 0) / squad.length : 70;
        let feldMitte = Math.max(45, Math.min(84, Math.round(kaderSchnitt) - 6));
        let baueTeam = (name, idx) => ({
            name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0,
            // Der eigene Verein spielt mit seiner ECHTEN Staerke (siehe
            // simulateEuropeMatchday) - der Wert hier ist fuer ihn nur ein Platzhalter.
            str: Math.max(45, Math.min(95, feldMitte + FELD_STAFFELUNG[idx] + Math.floor(Math.random() * 3) - 1))
        });
        europeTournament.groupA = participants.slice(0, 4).map((name, i) => baueTeam(name, i * 2));
        europeTournament.groupB = participants.slice(4, 8).map((name, i) => baueTeam(name, i * 2 + 1));
        europeTournament.semiFinals = [];
        europeTournament.finalMatch = null;
        europeTournament.drawCeremonyShown = false;
        europeTournament.startFeePaid = false;
    }

    // ---------- AUSLOSUNGS-ZEREMONIE (EUROPAPOKAL) ----------
    // Gleiches Reveal-Prinzip wie beim DFB-Pokal (siehe showCupDrawCeremony() in cup.js),
    // aber als Gruppen-Auslosung: zeigt alle drei Gruppengegner nacheinander.
    let europeDrawRevealTimer = null;
    function showEuropeDrawCeremony() {
        let ourGroup = europeTournament.groupA.some(t => t.name === game.clubName) ? europeTournament.groupA : europeTournament.groupB;
        let groupLabel = europeTournament.groupA.some(t => t.name === game.clubName) ? "Gruppe A" : "Gruppe B";
        let opponents = ourGroup.filter(t => t.name !== game.clubName).map(t => t.name);
        if (opponents.length === 0) { showToast('Keine Auslosung verfügbar - erst für den Champions Cup qualifizieren!', 'error'); return; }

        document.getElementById('europe-draw-round-name').innerText = `Champions Cup - ${groupLabel}`;
        document.getElementById('europe-draw-reveal-text').innerText = '🎟️ Die Kugeln rollen...';
        document.getElementById('europe-draw-opponents-list').innerHTML = '';
        document.getElementById('europe-draw-overlay').classList.add('show');

        clearTimeout(europeDrawRevealTimer);
        let revealed = 0;
        function revealNext() {
            if (revealed >= opponents.length) {
                document.getElementById('europe-draw-reveal-text').innerText = 'Eure Gruppengegner stehen fest!';
                playSound('whistle');
                return;
            }
            document.getElementById('europe-draw-opponents-list').innerHTML += `<div style="font-size:16px; font-weight:900; color:#fff; margin:6px 0;">⚽ ${opponents[revealed]}</div>`;
            revealed++;
            europeDrawRevealTimer = setTimeout(revealNext, 1000);
        }
        europeDrawRevealTimer = setTimeout(revealNext, 1000);
        europeTournament.drawCeremonyShown = true;
    }
    function closeEuropeDrawCeremony() {
        clearTimeout(europeDrawRevealTimer);
        document.getElementById('europe-draw-overlay').classList.remove('show');
    }

    // K.-o.-Auslosung: zeigt unsere Halbfinal-Paarung, sobald sie feststeht (nach Spieltag
    // 27) - gleiches Reveal-Prinzip wie die Gruppenauslosung.
    function showEuropeKnockoutDraw() {
        if (europeTournament.semiFinals.length === 0) { showToast('Noch keine K.-o.-Paarung bekannt - erst die Gruppenphase abschließen!', 'error'); return; }
        let ourTie = europeTournament.semiFinals.find(s => s.teamA === game.clubName || s.teamB === game.clubName);
        if (!ourTie) { showToast(`${game.clubName} ist nicht im Halbfinale vertreten.`, 'error'); return; }
        let opponent = ourTie.teamA === game.clubName ? ourTie.teamB : ourTie.teamA;

        document.getElementById('europe-draw-round-name').innerText = 'Champions Cup - Halbfinale';
        document.getElementById('europe-draw-reveal-text').innerText = '🎟️ Die Kugeln rollen...';
        document.getElementById('europe-draw-opponents-list').innerHTML = '<div style="font-size:9px; color:#94a3b8; margin-top:8px;">Hin- und Rückspiel, Gesamtergebnis entscheidet. Bei Gleichstand nach 180 Minuten: Elfmeterschießen.</div>';
        document.getElementById('europe-draw-overlay').classList.add('show');

        clearTimeout(europeDrawRevealTimer);
        europeDrawRevealTimer = setTimeout(() => {
            document.getElementById('europe-draw-reveal-text').innerText = 'Euer Halbfinal-Gegner steht fest!';
            document.getElementById('europe-draw-opponents-list').innerHTML = `<div style="font-size:18px; font-weight:900; color:#fff; margin:6px 0;">⚽ ${opponent}</div><div style="font-size:9px; color:#94a3b8; margin-top:8px;">Hin- und Rückspiel, Gesamtergebnis entscheidet. Bei Gleichstand nach 180 Minuten: Elfmeterschießen.</div>`;
            playSound('whistle');
        }, 1400);
    }

    // ---------- ELFMETERSCHIESSEN-TICKER ----------
    // Statt eines stillen Zufallsentscheids bei K.o.-Gleichstand gibt's jetzt eine echte,
    // schussweise aufgebaute Sequenz mit dramatischem Live-Reveal (5 reguläre Runden, danach
    // "sudden death" bei Bedarf).
    function simulatePenaltyShootout(teamAName, teamBName, strA, strB, namesA = null, namesB = null) {
        let log = [];
        let scoreA = 0, scoreB = 0;
        let successProbA = Math.max(0.55, Math.min(0.88, 0.72 + (strA - strB) * 0.005));
        let successProbB = Math.max(0.55, Math.min(0.88, 0.72 + (strB - strA) * 0.005));
        // Torwarttrainer: bessere Paradenquote unseres Torhüters senkt die Trefferquote des
        // GEGNERS im Elfmeterschießen (war bisher nur Text ohne tatsächliche Wirkung).
        if (staffMembers.twTrainer.hired) {
            if (teamAName === game.clubName) successProbB = Math.max(0.4, successProbB - 0.07);
            else if (teamBName === game.clubName) successProbA = Math.max(0.4, successProbA - 0.07);
        }

        // Elfmeter-Erfolgsquote als Spielerstatistik: bei benannten, echten Spielern unserer
        // Mannschaft (nicht generische KI-Team-Platzhalter) wird jeder Schuss auf
        // p.penaltiesTaken/penaltiesScored gebucht (sichtbar im Spieler-Detail-Popup) UND die
        // individuelle Schuss-Wahrscheinlichkeit berücksichtigt Schuss-Wert, "Elfmeter-
        // Killer"-Eigenschaft sowie das eigens trainierte penaltyTrainingBonus. Ein Schütze,
        // der im Rückstand liegt und treffen MUSS, um gleichzuziehen, steht unter echtem
        // Druck und trifft im Schnitt etwas seltener (realistischer Nervositäts-Effekt).
        function shootPenalty(shooterName, teamBaseProb, isPressureSituation) {
            let player = squad.find(pl => pl.name === shooterName);
            // Persönlichkeit beeinflusst, wie stark der Drucksituations-Malus greift:
            // Selbstbewusste Spieler lassen sich kaum beirren, bescheidene/ruhige Charaktere
            // spüren den Druck einer entscheidenden Ausgleichs-Situation stärker.
            let pressurePenalty = 0.06;
            if (player) {
                if (player.character === 'Selbstbewusst') pressurePenalty *= 0.4;
                else if (player.character === 'Bescheiden' || player.character === 'Ruhig') pressurePenalty *= 1.3;
            }
            // Mentaltraining (Training & Förderung): senkt den Drucksituations-Malus für die
            // gesamte Mannschaft dauerhaft, Stufe für Stufe.
            pressurePenalty *= (1 - 0.15 * (game.mentalTrainingLevel || 0));
            let baseProb = isPressureSituation ? Math.max(0.4, teamBaseProb - pressurePenalty) : teamBaseProb;
            if (!player) return { scored: Math.random() < baseProb, displayName: shooterName };
            let prob = Math.max(0.4, Math.min(0.95, baseProb + (player.shooting - 60) * 0.003 + (player.trait === 'Elfmeter-Killer' ? 0.08 : 0) + (player.penaltyTrainingBonus || 0) + (staffMembers.setPieceCoach.hired ? 0.02 * getStaffLevelMultiplier('setPieceCoach') : 0)));
            let scored = Math.random() < prob;
            player.penaltiesTaken = (player.penaltiesTaken || 0) + 1;
            if (scored) player.penaltiesScored = (player.penaltiesScored || 0) + 1;
            return { scored, displayName: player.name };
        }

        for (let round = 1; round <= 5; round++) {
            let shooterNameA = namesA ? namesA[(round - 1) % namesA.length] : teamAName;
            let resultA = shootPenalty(shooterNameA, successProbA, scoreA < scoreB);
            if (resultA.scored) scoreA++;
            log.push({ team: resultA.displayName, round, scored: resultA.scored });

            let shooterNameB = namesB ? namesB[(round - 1) % namesB.length] : teamBName;
            let resultB = shootPenalty(shooterNameB, successProbB, scoreB < scoreA);
            if (resultB.scored) scoreB++;
            log.push({ team: resultB.displayName, round, scored: resultB.scored });
        }
        let suddenRound = 6;
        while (scoreA === scoreB && suddenRound < 20) {
            let shooterNameA = namesA ? namesA[(suddenRound - 1) % namesA.length] : teamAName;
            let resultA = shootPenalty(shooterNameA, successProbA, false);
            if (resultA.scored) scoreA++;
            log.push({ team: resultA.displayName, round: 'V', scored: resultA.scored, suddenDeath: true });

            let shooterNameB = namesB ? namesB[(suddenRound - 1) % namesB.length] : teamBName;
            // Sudden Death: wer nach As Schuss zurückliegt, steht unter Nervosität, um im
            // Rennen zu bleiben.
            let resultB = shootPenalty(shooterNameB, successProbB, scoreB < scoreA);
            if (resultB.scored) scoreB++;
            log.push({ team: resultB.displayName, round: 'V', scored: resultB.scored, suddenDeath: true });
            suddenRound++;
        }
        return { log, scoreA, scoreB, winner: scoreA > scoreB ? teamAName : teamBName };
    }

    let shootoutRevealTimer = null;
    function showPenaltyShootoutTicker(shootout, teamAName, teamBName) {
        document.getElementById('shootout-title').innerText = `🥅 ELFMETERSCHIESSEN: ${teamAName} vs ${teamBName}`;
        document.getElementById('shootout-log').innerHTML = '';
        document.getElementById('shootout-result').innerText = '';
        document.getElementById('shootout-overlay').classList.add('show');

        clearTimeout(shootoutRevealTimer);
        let idx = 0;
        let suddenDeathAnnounced = false;
        function revealNext() {
            if (idx >= shootout.log.length) {
                document.getElementById('shootout-result').innerText = `🏆 ${shootout.winner} gewinnt das Elfmeterschießen ${shootout.scoreA}:${shootout.scoreB}!`;
                playSound('goal');
                return;
            }
            let entry = shootout.log[idx];
            // Dramatischer Zwischenmoment beim Übergang in die Verlängerung ("Sudden Death").
            if (entry.round === 'V' && !suddenDeathAnnounced) {
                suddenDeathAnnounced = true;
                let logEl = document.getElementById('shootout-log');
                logEl.innerHTML += `<div style="color:var(--gold); font-size:13px; font-weight:900; text-align:center; margin:6px 0; text-shadow:0 0 8px currentColor;">⚡ ES GEHT IN DIE VERLÄNGERUNG - JEDER SCHUSS KANN ENTSCHEIDEN! ⚡</div>`;
                logEl.scrollTop = logEl.scrollHeight;
                playSound('whistle');
                shootoutRevealTimer = setTimeout(revealNext, 900);
                return;
            }
            let icon = entry.scored ? '⚽' : '❌';
            let color = entry.scored ? 'var(--primary)' : 'var(--danger)';
            let logEl = document.getElementById('shootout-log');
            let roundLabel = entry.round === 'V' ? '🔥 TODESSCHUSS' : `Runde ${entry.round}`;
            let extraStyle = entry.round === 'V' ? 'font-weight:900; text-shadow:0 0 6px currentColor;' : '';
            logEl.innerHTML += `<div style="color:${color}; font-size:11px; ${extraStyle}">${icon} ${roundLabel}: ${entry.team} ${entry.scored ? 'verwandelt!' : 'verschießt!'}</div>`;
            logEl.scrollTop = logEl.scrollHeight;
            playSound(entry.scored ? 'goal' : 'click');
            idx++;
            shootoutRevealTimer = setTimeout(revealNext, 600);
        }
        revealNext();
    }
    function closeShootoutTicker() {
        clearTimeout(shootoutRevealTimer);
        document.getElementById('shootout-overlay').classList.remove('show');
    }

    // ---------- ELFMETERSCHÜTZEN-AUSWAHL ----------
    // Nur bei LIVE gespielten Partien mit Beteiligung von 1.FC Moritz Leipzig (nicht bei Saison-
    // Durchsimulation/Admin-Vorspulen, um die Massensimulation nicht zu blockieren): der
    // Nutzer bestimmt die eigene Schützen-Reihenfolge selbst, statt dass automatisch die
    // besten 5 Schützen nach Schuss-Wert gewählt werden.
    let pendingShootoutContext = null;
    let selectedShooters = [];

    function autoSelectShooters() {
        let available = squad.filter(p => lineup.includes(p.id) && (p.suspended || 0) === 0);
        return available.sort((a, b) => b.shooting - a.shooting).slice(0, 5).map(p => p.name);
    }

    // Generisch nutzbar von jedem K.o.-Wettbewerb (Europapokal-Halbfinale UND DFB-Pokal) -
    // der aufrufende Code übergibt einen Callback, der nach Bestätigung mit der gewählten
    // Schützen-Reihenfolge (5 Namen) aufgerufen wird.
    function openShooterOrderSelection(unusedLegacyParam, onConfirm) {
        pendingShootoutContext = { onConfirm };
        selectedShooters = [];
        renderShooterSelectionModal();
        document.getElementById('shooter-select-overlay').classList.add('show');
    }
    function toggleShooterSelection(playerId) {
        let idx = selectedShooters.indexOf(playerId);
        if (idx !== -1) selectedShooters.splice(idx, 1);
        else if (selectedShooters.length < 5) selectedShooters.push(playerId);
        renderShooterSelectionModal();
    }
    function renderShooterSelectionModal() {
        let available = squad.filter(p => lineup.includes(p.id) && (p.suspended || 0) === 0);
        // Elfmeter-Spezialisten (siehe individualFocus 'elfmeter' in training.js) und Spieler
        // mit hoher bisheriger Quote werden zur einfacheren Auswahl nach oben sortiert.
        available = [...available].sort((a, b) => {
            let scoreA = (a.individualFocus === 'elfmeter' ? 1000 : 0) + (a.penaltiesTaken > 0 ? (a.penaltiesScored / a.penaltiesTaken) * 100 : a.shooting);
            let scoreB = (b.individualFocus === 'elfmeter' ? 1000 : 0) + (b.penaltiesTaken > 0 ? (b.penaltiesScored / b.penaltiesTaken) * 100 : b.shooting);
            return scoreB - scoreA;
        });
        let list = document.getElementById('shooter-select-list');
        list.innerHTML = available.map(p => {
            let orderIdx = selectedShooters.indexOf(p.id);
            let quoteText = (p.penaltiesTaken || 0) > 0 ? ` · Quote: ${Math.round((p.penaltiesScored / p.penaltiesTaken) * 100)}% (${p.penaltiesScored}/${p.penaltiesTaken})` : ' · Quote: -';
            let specialistTag = p.individualFocus === 'elfmeter' ? ' 🥅' : '';
            return `<div class="player-row" onclick="toggleShooterSelection('${p.id}')" style="cursor:pointer; ${orderIdx !== -1 ? 'border-color:var(--primary); background:rgba(34,224,168,0.1);' : ''}">
                <span>${orderIdx !== -1 ? `#${orderIdx + 1} ` : ''}${p.name}${specialistTag} <span style="color:#94a3b8; font-size:9px;">(Schuss: ${p.shooting}${quoteText})</span></span>
            </div>`;
        }).join('');
        document.getElementById('shooter-select-count').innerText = `${selectedShooters.length}/5 gewählt`;
        let confirmBtn = document.getElementById('shooter-select-confirm');
        if (confirmBtn) confirmBtn.disabled = selectedShooters.length !== 5;

        // Vorschlag der zuletzt genutzten Reihenfolge, falls alle 5 Spieler noch verfügbar sind.
        let lastBtn = document.getElementById('shooter-select-last-order');
        if (lastBtn) {
            let lastValid = game.lastShooterOrder && game.lastShooterOrder.length === 5 &&
                game.lastShooterOrder.every(id => available.some(p => p.id === id));
            lastBtn.style.display = lastValid ? 'block' : 'none';
        }
    }
    function useLastShooterOrder() {
        if (!game.lastShooterOrder || game.lastShooterOrder.length !== 5) return;
        selectedShooters = [...game.lastShooterOrder];
        renderShooterSelectionModal();
        showToast('🔁 Letzte Schützen-Reihenfolge übernommen!', 'success');
    }
    function confirmShooterOrder() {
        if (selectedShooters.length !== 5 || !pendingShootoutContext) return;
        let names = selectedShooters.map(id => squad.find(p => p.id === id).name);
        game.lastShooterOrder = [...selectedShooters];
        document.getElementById('shooter-select-overlay').classList.remove('show');
        let { onConfirm } = pendingShootoutContext;
        pendingShootoutContext = null;
        onConfirm(names);
    }

    function resolveShootoutForTie(tie, strA, strB, ourNamesA, ourNamesB) {
        let shootout = simulatePenaltyShootout(tie.teamA, tie.teamB, strA, strB, ourNamesA, ourNamesB);
        tie.winner = shootout.winner;
        tie.shootoutLog = shootout.log;
        tie.shootoutScore = `${shootout.scoreA}:${shootout.scoreB}`;
        if ([tie.teamA, tie.teamB].includes(game.clubName)) showPenaltyShootoutTicker(shootout, tie.teamA, tie.teamB);
        finalizeTieResult(tie);
    }

    // ---------- "NERVENKRIEG"-ERKENNUNG ----------
    // Trifft man im K.o.-Elfmeterschießen wiederholt auf den eigenen permanenten Rivalen,
    // ist das erzählerisch bemerkenswert genug für eine eigene Notiz in der Rivalen-Bilanz.
    function checkShootoutRivalryIntensity(teamA, teamB) {
        if (!game.permanentRivalName) return;
        let opponent = teamA === game.clubName ? teamB : (teamB === game.clubName ? teamA : null);
        if (opponent !== game.permanentRivalName) return;
        rivalryRecord.shootoutsVsRival = (rivalryRecord.shootoutsVsRival || 0) + 1;
        game.seasonsSinceLastRivalShootout = 0;
        if (rivalryRecord.shootoutsVsRival >= 2) {
            addInboxMessage('vertrag', '😰 Nervenkrieg mit dem Rivalen!', `Bereits das ${rivalryRecord.shootoutsVsRival}. Elfmeterschießen gegen ${game.permanentRivalName} - diese Rivalität kennt keine ruhigen Nerven!`, 'screen-history');
        }
    }

    function finalizeTieResult(tie) {
        if (tie.penalties) checkShootoutRivalryIntensity(tie.teamA, tie.teamB);
        if (tie.teamA === game.clubName || tie.teamB === game.clubName) {
            let aggA = tie.leg1Home + tie.leg2Away;
            let aggB = tie.leg1Away + tie.leg2Home;
            let weWon = tie.winner === game.clubName;
            let aggText = `Gesamt: ${aggA}:${aggB}${tie.penalties ? ` (n.E. ${tie.shootoutScore})` : ''}`;
            addInboxMessage('vertrag', weWon ? '🎉 Finaleinzug!' : '❌ Halbfinal-Aus', `${tie.teamA} vs. ${tie.teamB} - ${aggText}`, 'screen-europe');
            if (!weWon) showNotice('❌ Halbfinale verloren', `${tie.teamA} gegen ${tie.teamB} - ${aggText}`, { typ: 'warn' });
        }
    }

    function simulateEuropeMatchday(mday, isLiveContext = false) {
        if (!game.inEurope) return;
        let groupMatchIdx = [3, 7, 11, 15, 19, 23].indexOf(mday);

        // UEFA-Startpraemie: im echten Wettbewerb die groesste Einzelzahlung und allein fuer
        // die Teilnahme faellig. Hier gab es bisher ausschliesslich Siegpraemien - wer sich
        // qualifizierte und in der Gruppe nichts holte, ging voellig leer aus.
        if (groupMatchIdx === 0 && !europeTournament.startFeePaid) {
            europeTournament.startFeePaid = true;
            let startpraemie = Math.round(4000000 * (typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1) / 2 / 10000) * 10000;
            setzeBuchungskontext('🌍 Europapokal');
            game.money += startpraemie;
            loescheBuchungskontext();
            addInboxMessage('finanzen', '🌍 UEFA-Startprämie ausgezahlt',
                `Allein für die Teilnahme am Champions Cup überweist die UEFA ${formatVal(startpraemie)}. Siegprämien kommen pro gewonnenem Gruppenspiel obendrauf.`, 'screen-finances');
            showNotice('🌍 Champions Cup', `Die Gruppenphase beginnt.\n\nUEFA-Startprämie für die Teilnahme: ${formatVal(startpraemie)}.`);
        }

        if (groupMatchIdx !== -1) {
            [europeTournament.groupA, europeTournament.groupB].forEach(grp => {
                let t1 = grp[0], t2 = grp[1], t3 = grp[2], t4 = grp[3];
                let pairings = (groupMatchIdx % 3 === 0) ? [[t1, t2], [t3, t4]] : ((groupMatchIdx % 3 === 1) ? [[t1, t3], [t2, t4]] : [[t1, t4], [t2, t3]]);

                pairings.forEach(([h, a]) => {
                    let hStr = h.name === game.clubName ? calcTeamStrength(true) : h.str;
                    let aStr = a.name === game.clubName ? calcTeamStrength(false) : a.str;
                    let goals = simulateGoals(hStr, aStr);
                    let hg = goals.myGoals;
                    let ag = goals.oppGoals;

                    h.played++; a.played++;
                    h.gf += hg; h.ga += ag;
                    a.gf += ag; a.ga += hg;

                    if (hg > ag) { h.won++; h.pts += 3; a.lost++; }
                    else if (hg < ag) { a.won++; a.pts += 3; h.lost++; }
                    else { h.drawn++; h.pts += 1; a.drawn++; a.pts += 1; }

                    if (h.name === game.clubName || a.name === game.clubName) {
                        let weWon = (h.name === game.clubName && hg > ag) || (a.name === game.clubName && ag > hg);
                        if (weWon) {
                            game.money += 1500000;
                            if (isLiveContext) addManagerXP(300);
                            showNotice('🌟 Sieg im Champions Cup', `${h.name} ${hg}:${ag} ${a.name}.\n\n1.500.000 € UEFA-Prämie kassiert.`);
                        }
                    }
                });
            });
        }

        if (mday === 27) {
            europeTournament.groupA.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
            europeTournament.groupB.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

            let a1 = europeTournament.groupA[0], a2 = europeTournament.groupA[1];
            let b1 = europeTournament.groupB[0], b2 = europeTournament.groupB[1];

            // Halbfinale jetzt als echtes Hin-/Rückspiel (Spieltag 27 = Hinspiel, Spieltag 29
            // = Rückspiel mit vertauschtem Heimrecht) statt eines einzelnen Spiels - realistischer
            // fürs Europapokal-Format. Nur das Hinspiel-Tor wird hier simuliert; der Sieger
            // steht erst nach dem Rückspiel (siehe mday===29) fest.
            function simulateLeg(home, away) {
                let hStr = home.name === game.clubName ? calcTeamStrength(true) : home.str;
                let aStr = away.name === game.clubName ? calcTeamStrength(false) : away.str;
                let goals = simulateGoals(hStr, aStr);
                return { homeGoals: goals.myGoals, awayGoals: goals.oppGoals };
            }

            let tie1Leg1 = simulateLeg(a1, b2);
            let tie2Leg1 = simulateLeg(b1, a2);

            europeTournament.semiFinals = [
                { teamA: a1.name, teamB: b2.name, leg1Home: tie1Leg1.homeGoals, leg1Away: tie1Leg1.awayGoals, leg2Home: null, leg2Away: null, winner: null, penalties: false },
                { teamA: b1.name, teamB: a2.name, leg1Home: tie2Leg1.homeGoals, leg1Away: tie2Leg1.awayGoals, leg2Home: null, leg2Away: null, winner: null, penalties: false }
            ];

            let userInSemis = [a1.name, a2.name, b1.name, b2.name].includes(game.clubName);
            if (userInSemis) {
                game.money += 8000000;
                if (isLiveContext) addManagerXP(1000);
                addInboxMessage('vertrag', '🌟 Champions Cup Halbfinal-Hinspiel!', `Das Hinspiel ist gespielt - das Rückspiel entscheidet in ${europeTournament.matchdays[7] - mday} Spieltagen über den Finaleinzug. +8.000.000 € UEFA-Erfolgsprämie für den Halbfinaleinzug bereits erhalten!`, 'screen-europe');
                showNotice('🌟 Halbfinale erreicht!', 'Das Hinspiel ist absolviert, das Rückspiel entscheidet.\n\n8.000.000 € UEFA-Erfolgsprämie erhalten.');
            }
        }

        // Rückspiel: Heimrecht ist getauscht (teamB ist jetzt zuhause), Gesamtergebnis
        // entscheidet - bei Gleichstand entscheidet ein Elfmeterschießen MIT eigenem
        // dramaturgischen Live-Ticker (siehe simulatePenaltyShootout()/showPenaltyShootoutTicker()).
        if (mday === 29 && europeTournament.semiFinals.length > 0) {
            europeTournament.semiFinals.forEach(tie => {
                let allTeams = [...europeTournament.groupA, ...europeTournament.groupB];
                let strA = tie.teamA === game.clubName ? calcTeamStrength(false) : (allTeams.find(t => t.name === tie.teamA)?.str || 84);
                let strB = tie.teamB === game.clubName ? calcTeamStrength(true) : (allTeams.find(t => t.name === tie.teamB)?.str || 84);
                // Rückspiel-Heimvorteil: das entscheidende Spiel zuhause bringt einen kleinen
                // Motivationsschub, ähnlich der Lokalderby-Atmosphäre (siehe applyMatchdayFinances()).
                if (tie.teamB === game.clubName) {
                    strB += 2;
                    // Zuschauerrekord: das wichtigste Spiel der Saison ist automatisch
                    // ausverkauft, unabhängig von der sonstigen Stadionauslastung (ähnlich
                    // der Lokalderby-Regel, aber als einmaliger Bonus statt Faktor).
                    let soldOutAttendance = stadium.total || 16000;
                    let soldOutIncome = Math.round(soldOutAttendance * 0.5 * game.ticketPrices.steh + soldOutAttendance * 0.45 * game.ticketPrices.sitz + (stadium.vipTotal || 50) * game.ticketPrices.vip);
                    game.money += soldOutIncome;
                    addInboxMessage('vertrag', '🎟️ Zuschauerrekord im Halbfinal-Rückspiel!', `Das Stadion ist beim wichtigsten Spiel der Saison restlos ausverkauft (${soldOutAttendance.toLocaleString('de-DE')} Zuschauer) - ${formatVal(soldOutIncome)} Ticketeinnahmen!`, 'screen-finances');
                }
                // Rückspiel: teamB ist jetzt Heimteam
                let goals = simulateGoals(strB, strA);
                tie.leg2Home = goals.myGoals; // Tore von teamB (jetzt Heim)
                tie.leg2Away = goals.oppGoals; // Tore von teamA (jetzt Auswärts)

                let aggA = tie.leg1Home + tie.leg2Away;
                let aggB = tie.leg1Away + tie.leg2Home;

                if (aggA === aggB) {
                    tie.penalties = true;
                    let weAreInvolved = tie.teamA === game.clubName || tie.teamB === game.clubName;
                    if (weAreInvolved && isLiveContext) {
                        // Wartet auf die Schützen-Auswahl des Nutzers - Auflösung erfolgt im
                        // Callback -> resolveShootoutForTie() -> finalizeTieResult().
                        openShooterOrderSelection(null, (names) => {
                            let ourNamesA = tie.teamA === game.clubName ? names : null;
                            let ourNamesB = tie.teamB === game.clubName ? names : null;
                            resolveShootoutForTie(tie, strA, strB, ourNamesA, ourNamesB);
                        });
                        return;
                    }
                    let ourNamesA = tie.teamA === game.clubName ? autoSelectShooters() : null;
                    let ourNamesB = tie.teamB === game.clubName ? autoSelectShooters() : null;
                    resolveShootoutForTie(tie, strA, strB, ourNamesA, ourNamesB);
                } else {
                    tie.winner = aggA > aggB ? tie.teamA : tie.teamB;
                    finalizeTieResult(tie);
                }
            });
            europeTournament.semiFinals.forEach(tie => { tie.home = tie.teamA; tie.away = tie.teamB; });
        }

        if (mday === 31 && europeTournament.semiFinals.length > 0) {
            let final1 = europeTournament.semiFinals[0].winner;
            let final2 = europeTournament.semiFinals[1].winner;

            // Das Finale wird jetzt ebenfalls ECHT simuliert (vorher gewann "1.FC Moritz Leipzig"
            // automatisch IMMER, sobald man das Finale erreicht hatte - ein zweiter,
            // gravierender Bug, der den Titel praktisch geschenkt hat).
            let allTeams = [...europeTournament.groupA, ...europeTournament.groupB];
            let getFinalistStrength = name => name === game.clubName ? calcTeamStrength(true) : (allTeams.find(t => t.name === name)?.str || 84);
            let str1 = getFinalistStrength(final1);
            let str2 = getFinalistStrength(final2);
            let goals = simulateGoals(str1, str2);
            let hg = goals.myGoals, ag = goals.oppGoals;
            let winner = hg === ag ? (Math.random() < (0.5 + (str1 - str2) * 0.02) ? final1 : final2) : (hg > ag ? final1 : final2);
            let weWin = winner === game.clubName;

            europeTournament.finalMatch = { home: final1, away: final2, score: `${hg} : ${ag}`, winner };

            if (weWin) {
                game.money += 25000000;
                game.trophies.push(`Champions Cup Sieger (Saison ${game.season})`);
                boostFanBaseFloor(15, 'Der Champions Cup Sieg');
                if (isLiveContext) addManagerXP(3000);
                playSound('goal');
                showNotice('👑 Europas Krönung!', `${game.clubName} gewinnt den Champions Cup.\n\n25.000.000 € Siegprämie.`);
            } else if (final1 === game.clubName || final2 === game.clubName) {
                if (isLiveContext) addManagerXP(500);
                showNotice('❌ Finale verloren', `Knapp am Titel vorbeigeschrammt: ${final1} ${hg}:${ag} ${final2}.\n\nDennoch eine herausragende Saison.`, { typ: 'warn' });
            }
        }
    }

    function renderEuropeView() {
        let tag = document.getElementById('europe-status-tag');
        if (tag) tag.innerText = game.inEurope ? "Status: Aktiv im Wettbewerb" : "Status: Nicht qualifiziert (Platz 1-4 oder Pokalsieg benötigt)";

        let populateGroup = (tbodyId, grp) => {
            let tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            tbody.innerHTML = '';
            let sorted = [...grp].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
            sorted.forEach(t => {
                let isUs = t.name === game.clubName;
                tbody.innerHTML += `<tr><td style="text-align:left; ${isUs?'color:var(--primary); font-weight:bold;':''}">${t.name}</td><td>${t.played}</td><td>${t.gf}:${t.ga}</td><td><strong>${t.pts}</strong></td></tr>`;
            });
        };

        populateGroup('europe-group-a-body', europeTournament.groupA);
        populateGroup('europe-group-b-body', europeTournament.groupB);

        let koTree = document.getElementById('europe-ko-tree');
        if (koTree) {
            if (europeTournament.semiFinals.length === 0) {
                koTree.innerHTML = '<div class="box">Die K.O.-Runde beginnt nach Spieltag 23 für die Gruppen-Ersten und -Zweiten.</div>';
            } else {
                // Zeigt Hin-/Rückspiel-Ergebnis (Gesamtscore + ggf. Elfmeterschießen) statt
                // eines einzelnen Ergebnisses, passend zum neuen Zweibeiner-Format.
                let semiHtml = europeTournament.semiFinals.map(s => {
                    let aggA = (s.leg1Home ?? 0) + (s.leg2Away ?? 0);
                    let aggB = (s.leg1Away ?? 0) + (s.leg2Home ?? 0);
                    let legInfo = s.leg2Home === null
                        ? `Hinspiel: ${s.leg1Home}:${s.leg1Away} · Rückspiel steht aus`
                        : `Hin: ${s.leg1Home}:${s.leg1Away} · Rück: ${s.leg2Away}:${s.leg2Home} · Gesamt: ${aggA}:${aggB}${s.penalties ? ` (n.E. ${s.shootoutScore})` : ''}`;
                    return `<div class="player-row" style="flex-direction:column; align-items:flex-start;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <span>${s.teamA} vs ${s.teamB}</span>
                            <span style="color:var(--primary);">${s.winner ? `Sieger: ${s.winner}` : 'Läuft...'}</span>
                        </div>
                        <span style="font-size:9px; color:#94a3b8;">${legInfo}</span>
                    </div>`;
                }).join('');
                let finalHtml = europeTournament.finalMatch ? `<div class="box" style="border-color:var(--gold); color:var(--gold);">👑 FINALE: ${europeTournament.finalMatch.home} vs ${europeTournament.finalMatch.away} [${europeTournament.finalMatch.score}] => Sieger: <strong>${europeTournament.finalMatch.winner}</strong></div>` : '';
                koTree.innerHTML = semiHtml + finalHtml;
            }
        }
    }

