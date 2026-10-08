/* eslint-disable no-undef */
    // ---------- LIVE-STATISTIK ----------
    // Ballbesitz, Schüsse, Schüsse aufs Tor und Karten je Team - Index 0 = Heim, 1 = Gast.
    function newLiveMatchStats() {
        return { possSum: 0, possSteps: 0, shots: [0, 0], onTarget: [0, 0], yellow: [0, 0], red: [0, 0] };
    }
    function liveStatsSide(isHomeSide) { return isHomeSide ? 0 : 1; }
    function recordLiveShot(isHomeSide, onTarget) {
        let st = currentMatch && currentMatch.stats;
        if (!st) return;
        let i = liveStatsSide(isHomeSide);
        st.shots[i]++;
        if (onTarget) st.onTarget[i]++;
    }
    function getLivePossession() {
        let st = currentMatch && currentMatch.stats;
        if (!st || !st.possSteps) return [50, 50];
        let heim = Math.round(st.possSum / st.possSteps);
        return [heim, 100 - heim];
    }
    function renderLiveMatchStats() {
        let box = document.getElementById('live-match-stats');
        if (!box || !currentMatch || !currentMatch.stats) return;
        let st = currentMatch.stats;
        let [bh, ba] = getLivePossession();
        let ourStr = Math.round(currentMatch.ourBaseStr + getTacticStyleBonus(game.tacticStyle) + getTackleHardnessBonus(game.tackleHardness) + (currentMatch.halftimeTalkBonus || 0));
        let oppStr = Math.round(currentMatch.isHome ? currentMatch.awayStr : currentMatch.homeStr);
        let zeile = (label, h, a) => `<div style="display:grid; grid-template-columns: 1fr auto 1fr; gap:6px; align-items:center;"><span style="text-align:right; font-weight:800;">${h}</span><span style="color:var(--text-muted); font-size:9px;">${label}</span><span style="font-weight:800;">${a}</span></div>`;
        box.innerHTML = `<div class="box" style="font-size:10px; margin:4px 0;">
            <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; margin-bottom:4px;"><div style="flex:${bh}; background:${currentMatch.isHome ? 'var(--primary)' : 'var(--danger)'};"></div><div style="flex:${ba}; background:${currentMatch.isHome ? 'var(--danger)' : 'var(--primary)'};"></div></div>
            ${zeile('Ballbesitz', bh + '%', ba + '%')}
            ${zeile('Schüsse (aufs Tor)', `${st.shots[0]} (${st.onTarget[0]})`, `${st.shots[1]} (${st.onTarget[1]})`)}
            ${zeile('Karten', `🟨${st.yellow[0]} 🟥${st.red[0]}`, `🟨${st.yellow[1]} 🟥${st.red[1]}`)}
            <div style="text-align:center; color:var(--text-muted); font-size:9px; margin-top:2px;">Aktuelle Stärke: wir ${ourStr} · Gegner ${oppStr}</div>
        </div>`;
    }
    function liveStatsSummaryLine() {
        let st = currentMatch.stats;
        let [bh, ba] = getLivePossession();
        return `📊 Statistik: Ballbesitz ${bh}:${ba} % · Schüsse ${st.shots[0]}:${st.shots[1]} (aufs Tor ${st.onTarget[0]}:${st.onTarget[1]}) · Gelb ${st.yellow[0]}:${st.yellow[1]} · Rot ${st.red[0]}:${st.red[1]}`;
    }

    // Zweite Stimme im Ticker: gelegentliche taktische Einordnung unabhängig vom eigentlichen
    // Spielgeschehen, für mehr Atmosphäre im Live-Modus (klassisches "Co-Kommentator"-Element).
    const CO_COMMENTATOR_LINES = [
        "🎙️ Co-Kommentator: „Die Fünferkette steht heute sehr kompakt.“",
        "🎙️ Co-Kommentator: „Auffällig, wie oft über die linke Seite kombiniert wird.“",
        "🎙️ Co-Kommentator: „Das Pressing beider Teams lässt jetzt spürbar nach.“",
        "🎙️ Co-Kommentator: „Der Trainer hat taktisch klug umgestellt.“",
        "🎙️ Co-Kommentator: „Die Zweikampfquote ist heute bemerkenswert hoch.“",
        "🎙️ Co-Kommentator: „Beide Torhüter wirken heute sehr aufmerksam.“"
    ];
    // Kontextabhängige Kommentar-Varianz: zusätzliche Zeilen je nach Spielstand und
    // Spielminute, damit der Ticker nicht immer dieselben generischen Sätze wiederholt.
    const CO_COMMENTATOR_LINES_LEADING = [
        "🎙️ Co-Kommentator: „Die Führung gibt spürbar Sicherheit in den eigenen Reihen.“",
        "🎙️ Co-Kommentator: „Jetzt geht es darum, den Vorsprung clever zu verwalten.“"
    ];
    const CO_COMMENTATOR_LINES_TRAILING = [
        "🎙️ Co-Kommentator: „Man merkt die Nervosität im Rückstand deutlich.“",
        "🎙️ Co-Kommentator: „Jetzt muss mehr Risiko ins Spiel - sonst wird es eng.“"
    ];
    const CO_COMMENTATOR_LINES_LATE = [
        "🎙️ Co-Kommentator: „Die Schlussphase - hier wird oft noch alles entschieden.“",
        "🎙️ Co-Kommentator: „Die Kräfte schwinden sichtbar in den letzten Minuten.“"
    ];
    function pickContextualCommentaryLine() {
        let ourGoals = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
        let oppGoals = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
        let pool = [...CO_COMMENTATOR_LINES];
        if (currentMatch.minute >= 75) pool.push(...CO_COMMENTATOR_LINES_LATE, ...CO_COMMENTATOR_LINES_LATE);
        if (ourGoals > oppGoals) pool.push(...CO_COMMENTATOR_LINES_LEADING, ...CO_COMMENTATOR_LINES_LEADING);
        else if (ourGoals < oppGoals) pool.push(...CO_COMMENTATOR_LINES_TRAILING, ...CO_COMMENTATOR_LINES_TRAILING);
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function pickWeightedScorer(players) {
        // Stürmer treffen am häufigsten, dann Mittelfeld, selten Abwehr, sehr selten der Torwart.
        // Ein "Eisenfuß" ist für seine überraschenden Distanzschüsse/Standards bekannt und
        // erhöht seine eigene Trefferwahrscheinlichkeit deutlich, unabhängig von der Position.
        let weights = { ST: 5, MIT: 3, ABW: 1, TW: 0.15 };
        let pool = [];
        players.forEach(p => {
            let base = weights[p.pos] || 1;
            if (p.trait === 'Eisenfuß') base += 3;
            let w = Math.round(base * 10);
            for (let i = 0; i < w; i++) pool.push(p);
        });
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function simulateMatchStep() {
        if (!currentMatch || currentMatch.minute >= 90) return; // nach dem Abpfiff keine Szenen mehr
        if (currentMatch.awaitingHalftimeTalk) return; // wartet auf die Halbzeit-Ansprache-Auswahl
        // Wartet auf die Entscheidung beim Standard (js/set-pieces.js) - "Nächste Szene" zeigt sie erneut an.
        if (currentMatch.awaitingSetPiece) { if (typeof showSetPiecePanel === 'function') showSetPiecePanel(); return; }
        let prevMinute = currentMatch.minute;
        currentMatch.minute += Math.floor(Math.random() * 14) + 8;
        if (currentMatch.minute >= 90) { currentMatch.minute = 90; }
        document.getElementById('live-minute').innerText = currentMatch.minute + ". Minute";

        // Halbzeit-Marker, sobald die 45. Minute überschritten wird
        if (!currentMatch.halftimeShown && prevMinute < 45 && currentMatch.minute >= 45) {
            document.getElementById('ticker-log').innerHTML += `<div style="color:var(--blue); font-weight:bold;">⏸️ HALBZEITPAUSE (${currentMatch.homeGoals}:${currentMatch.awayGoals})</div>`;
            currentMatch.halftimeShown = true;
            currentMatch.awaitingHalftimeTalk = true;
            currentMatch.carrySpan = currentMatch.minute - prevMinute; // Minuten zählen im nächsten Zug
            showHalftimeTalkModal();
            return; // dieser Schritt endet hier - Tor/Karten-Auswertung erst nach der Ansprache
        }

        let onPitch = squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id));
        // Live-Taktikbonus wird JEDEN Schritt neu aus dem AKTUELLEN game.tacticStyle/
        // game.tackleHardness berechnet (nicht aus dem eingefrorenen Anpfiff-Wert) - so
        // wirkt sich eine Taktikänderung während des Spiels sofort auf den Rest der Partie aus.
        let liveTacticDelta = getTacticStyleBonus(game.tacticStyle) + getTackleHardnessBonus(game.tackleHardness) + (currentMatch.halftimeTalkBonus || 0);
        let ourLiveStr = currentMatch.ourBaseStr + liveTacticDelta
            + (typeof getTacticMatchupBonus === 'function' ? getTacticMatchupBonus(currentMatch.oppTacticArch) : 0);
        let effHomeStr = (currentMatch.isHome ? ourLiveStr : currentMatch.homeStr) - currentMatch.homeStrPenalty;
        let effAwayStr = (currentMatch.isHome ? currentMatch.awayStr : ourLiveStr) - currentMatch.awayStrPenalty;
        let diff = effHomeStr - effAwayStr;
        // Formations-Verteidigungswert: eine defensiv robuste Formation verschiebt die
        // Wahrscheinlichkeit im Ballbesitz-Duell zu unseren Gunsten, unabhängig davon, ob wir
        // Heim- oder Auswärtsteam sind (siehe FORMATION_RATINGS in squad.js).
        let ourDefShift = getFormationDefBonus() * 0.6;
        // Torwarttrainer: wirkte bisher nur im seltenen Elfmeterschießen, nie im
        // regulären 90-minütigen Spielverlauf - ein guter Torwart-Coach verbessert
        // Reflexe/Stellungsspiel des Keepers auch im Alltagsgeschäft.
        if (staffMembers.twTrainer.hired) ourDefShift += 0.4 * getStaffLevelMultiplier('twTrainer');
        diff += currentMatch.isHome ? ourDefShift : -ourDefShift;
        // Tore (25.12): dieselben erwarteten Tore wie simulateGoals() (getExpectedGoals() in
        // js/utils.js, inkl. Spielstile), anteilig für die Minuten dieses Spielzugs ausgewürfelt.
        // Vorher hatte das Livespiel eine eigene, steilere Rechnung (Heimanteil 0,5 + 2 % je
        // Stärkepunkt, dazu Tor-Instinkt/Flügelflitzer/Elfmeter-Killer, die schon in
        // calcTeamStrength() stecken): eine gleiche Paarung gewann live ~25 Prozentpunkte öfter.
        let xg = getExpectedGoals(effHomeStr + (currentMatch.isHome ? ourDefShift : 0), effAwayStr + (currentMatch.isHome ? 0 : ourDefShift), currentMatch.homeTeamObj, currentMatch.awayTeamObj);
        let ourXg = currentMatch.isHome ? xg.myXg : xg.oppXg;
        let oppXg = currentMatch.isHome ? xg.oppXg : xg.myXg;
        // Live-Extras in erwarteten Toren je 90 Minuten (nur das Livespiel kennt sie).
        // Brechstange = viel Risiko (fast so viele Gegentore wie eigene Tore): lohnt bei Rückstand,
        // schadet bei Führung. Pressing = kleiner Vorteil. Beide kosten Kraft (kraftMinuten) -
        // vorher waren sie gratis und brachten auch beim 0:0 Punkte (25.13).
        if (activeLiveShout === 'brechstange') { ourXg += 0.9; oppXg += 0.7; }
        if (activeLiveShout === 'bus') { ourXg *= 0.6; oppXg *= 0.7; }
        if (activeLiveShout === 'pressing') { ourXg += 0.3; oppXg += 0.2; }
        if (underworld.activeSabotages.refBribe) { ourXg += 0.5; oppXg = Math.max(0.1, oppXg - 0.2); }
        // Standards-Spezialist und Ecken: Freistöße/Elfmeter laufen über js/set-pieces.js.
        if (staffMembers.setPieceCoach.hired) ourXg += 0.1 * getStaffLevelMultiplier('setPieceCoach');
        let cornerTaker = onPitch.find(p => p.id === game.cornerTakerId);
        if (cornerTaker && cornerTaker.passing >= 75) ourXg += 0.04;
        if (typeof getDrillMastery === 'function') ourXg += 0.05 * getDrillMastery('ecke'); // einstudierte Ecken
        // Anteil dieses Spielzugs an 90 Minuten; der Zug mit der Halbzeitpause wertet seine
        // Minuten erst nach der Ansprache aus (carrySpan).
        let spanMin = currentMatch.minute - prevMinute + (currentMatch.carrySpan || 0);
        currentMatch.carrySpan = 0;
        let anteil = spanMin / 90 * currentWeather.goalMult;
        // Heimanteil nur noch für Ballanimation und Chancen-Zeilen.
        let homeXg = currentMatch.isHome ? ourXg : oppXg, awayXg = currentMatch.isHome ? oppXg : ourXg;
        let userFavoredProb = homeXg / (homeXg + awayXg);

        let hasFkGod = onPitch.some(p => p.trait === 'Freistoß-Gott');
        let hasTackleMonster = onPitch.some(p => p.trait === 'Zweikampfmonster');

        let eventHandled = false;

        // Standards (Elfmeter, Freistoß): unterbrechen den Spielzug und warten auf die Entscheidung.
        if (currentMatch.minute < 88 && typeof rollLiveSetPiece === 'function' && rollLiveSetPiece(currentMatch.isHome ? diff : -diff)) {
            currentMatch.carrySpan = spanMin; // die Minuten des Spielzugs laufen im nächsten weiter
            document.getElementById('live-score').innerText = currentMatch.homeGoals + " : " + currentMatch.awayGoals;
            renderLiveMatchStats();
            return;
        }

        // Brechstange und Pressing kosten Kraft: die Minuten werden nach dem Spiel als
        // zusätzlicher Fitnessverlust der Startelf abgerechnet (processPostMatchRoutine). Erst
        // hier zählen, sonst liefen die Minuten eines Standard-Zugs (carrySpan) doppelt ein.
        if (activeLiveShout === 'brechstange' || activeLiveShout === 'pressing') currentMatch.kraftMinuten = (currentMatch.kraftMinuten || 0) + spanMin;
        let ourName = currentMatch.isHome ? currentMatch.homeName : currentMatch.awayName;
        let oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
        // Torereignisse dieses Zugs (Poisson wie in der Simulation), in zufälliger Reihenfolge.
        let torEreignisse = [];
        for (let i = poissonRandom(ourXg * anteil); i > 0; i--) torEreignisse.push(true);
        for (let i = poissonRandom(oppXg * anteil); i > 0; i--) torEreignisse.push(false);
        torEreignisse.sort(() => Math.random() - 0.5);
        torEreignisse.forEach(wirTreffen => {
            eventHandled = true;
            let art = GOAL_STYLES[Math.floor(Math.random() * GOAL_STYLES.length)];
            // Videobeweis (js/set-pieces.js): ein Teil der Tore wird wegen Abseits zurückgenommen.
            let annulliert = typeof varOverturnsGoal === 'function' && varOverturnsGoal(wirTreffen);
            if (annulliert) {
                recordLiveShot(wirTreffen === currentMatch.isHome, true);
                if (wirTreffen && typeof noteRefereeControversy === 'function') noteRefereeControversy('var');
            } else if (wirTreffen) {
                if (currentMatch.isHome) currentMatch.homeGoals++; else currentMatch.awayGoals++;
                recordLiveShot(currentMatch.isHome, true);
                playSound('goal');
                let { scorer, assist } = creditOwnGoal(onPitch);
                if (hasFkGod && Math.random() < 0.3) art = 'mit einem traumhaften direkten Freistoß';
                let scorerText = scorer ? `${scorer.name} trifft ${art}${assist ? ` (Vorlage: ${assist.name})` : ''}` : `Tor ${art}`;
                document.getElementById('ticker-log').innerHTML += `<div style="color:var(--primary); font-weight:bold;">⚽ ${currentMatch.minute}. Min: TOR! ${scorerText} für ${ourName}!</div>`;
            } else {
                if (currentMatch.isHome) currentMatch.awayGoals++; else currentMatch.homeGoals++;
                recordLiveShot(!currentMatch.isHome, true);
                playSound('goal');
                document.getElementById('ticker-log').innerHTML += `<div style="color:var(--danger);">⚽ ${currentMatch.minute}. Min: Gegentor - ${oppName} trifft ${art}.</div>`;
            }
        });

        // Karten-Ereignis (unabhängig vom Tor-Ereignis dieser Runde)
        if (!eventHandled || Math.random() < 0.5) {
            let ourCardRoll = Math.random();
            // Ein "Zweikampfmonster" gewinnt seine Duelle sauber und senkt so das eigene Kartenrisiko.
            let ourCardThreshold = hasTackleMonster ? 0.045 : 0.06;
            // Kapitän auf dem Feld: beruhigt die Mannschaft und senkt das Kartenrisiko
            // leicht - eine der klassischsten Führungsspieler-Aufgaben im echten Fußball.
            if (onPitch.some(p => p.id === game.captainId)) ourCardThreshold *= 0.9;
            // Glücksbringer (Premium-Booster, NEU): dämpft auch das Kartenrisiko.
            if (game.luckyCharmNextMatch) ourCardThreshold *= 0.5;
            ourCardThreshold *= currentWeather.cardMult;
            if (game.tackleHardness === 'hart') ourCardThreshold *= 1.5;
            if (game.tackleHardness === 'vorsichtig') ourCardThreshold *= 0.6;
            let refCardMult = currentMatch.referee ? currentMatch.referee.cardMult : 1;
            ourCardThreshold *= refCardMult;
            // Nervenkrieg-Effekt: bei einer bereits etablierten Elfmeterschießen-Rivalität
            // (siehe checkShootoutRivalryIntensity() in europe.js/cup.js) steht das ganze
            // Spiel unter besonderer psychischer Anspannung - hitzköpfige Spieler geraten
            // dabei eher in Zweikämpfe außer Kontrolle, ruhige Charaktere bleiben unberührt.
            let isNervenkriegMatch = isDerbyOpponent(currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName) && (rivalryRecord.shootoutsVsRival || 0) >= 2;
            if (ourCardRoll < ourCardThreshold && onPitch.length > 0) {
                eventHandled = true;
                let culprit;
                if (isNervenkriegMatch) {
                    let weighted = [];
                    onPitch.forEach(p => { let weight = p.character === 'Hitzköpfig' ? 3 : 1; for (let i = 0; i < weight; i++) weighted.push(p); });
                    culprit = weighted[Math.floor(Math.random() * weighted.length)];
                } else {
                    culprit = onPitch[Math.floor(Math.random() * onPitch.length)];
                }
                let isSecondYellow = (currentMatch.yellowCards[culprit.id] || 0) >= 1;
                let isStraightRed = Math.random() < 0.08;
                if (isSecondYellow || isStraightRed) {
                    currentMatch.sentOff.push(culprit.id);
                    currentMatch.stats.red[liveStatsSide(currentMatch.isHome)]++;
                    culprit.suspended = 2; // wird nach Spielende einmal herunter gezählt -> 1 Spiel Sperre
                    if (typeof noteRefereeControversy === 'function') noteRefereeControversy('rot', { playerId: culprit.id, name: culprit.name });
                    if (currentMatch.isHome) currentMatch.homeStrPenalty += 6; else currentMatch.awayStrPenalty += 6;
                    let label = isSecondYellow ? "🟨🟥 Gelb-Rote Karte" : "🟥 Platzverweis";
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--danger); font-weight:bold;">${label} für ${culprit.name}! Wir spielen in Unterzahl weiter.</div>`;
                } else {
                    currentMatch.yellowCards[culprit.id] = (currentMatch.yellowCards[culprit.id] || 0) + 1;
                    currentMatch.stats.yellow[liveStatsSide(currentMatch.isHome)]++;
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--accent);">🟨 ${currentMatch.minute}. Min: Gelbe Karte für ${culprit.name}.</div>`;
                }
            } else if (ourCardRoll < 0.11 * refCardMult) {
                // Gegnerische Karte - kein individueller Spieler, aber wirkt sich leicht auf Spielverlauf aus
                eventHandled = true;
                let isRed = Math.random() < 0.1;
                currentMatch.stats[isRed ? 'red' : 'yellow'][liveStatsSide(!currentMatch.isHome)]++;
                if (isRed) {
                    if (currentMatch.isHome) currentMatch.awayStrPenalty += 6; else currentMatch.homeStrPenalty += 6;
                    let oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--blue);">🟥 ${currentMatch.minute}. Min: Platzverweis bei ${oppName}! Der Gegner muss in Unterzahl weiterspielen.</div>`;
                } else {
                    let oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
                    document.getElementById('ticker-log').innerHTML += `<div style="color:#94a3b8;">🟨 ${currentMatch.minute}. Min: Gelbe Karte bei ${oppName}.</div>`;
                }
            }
        }

        // Wenn weder Tor noch Karte: neutrale/chancenreiche Ticker-Zeile für Atmosphäre
        if (!eventHandled) {
            // diff ist aus Heimsicht - für "unsere"/"gegnerische" Chancen in unsere Sicht drehen.
            let ourDiff = currentMatch.isHome ? diff : -diff;
            let pool = ourDiff > 8 ? OUR_CHANCE_EVENTS : (ourDiff < -8 ? OPP_CHANCE_EVENTS : NEUTRAL_FLAVOR_EVENTS);
            let line = pool[Math.floor(Math.random() * pool.length)];
            if (pool === OUR_CHANCE_EVENTS) recordLiveShot(currentMatch.isHome, Math.random() < 0.45);
            if (pool === OPP_CHANCE_EVENTS) recordLiveShot(!currentMatch.isHome, Math.random() < 0.45);
            document.getElementById('ticker-log').innerHTML += `<div style="color:#64748b; font-size:10px;">${currentMatch.minute}. Min: ${line}</div>`;
        }

        document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
        document.getElementById('live-score').innerText = currentMatch.homeGoals + " : " + currentMatch.awayGoals;
        // Ballbesitz folgt dem Kräfteverhältnis (Heimsicht), Bus parken gibt ihn bewusst ab.
        let heimBesitz = 50 + diff * 1.1 + (Math.random() * 10 - 5);
        if (activeLiveShout === 'bus') heimBesitz += currentMatch.isHome ? -8 : 8;
        if (activeLiveShout === 'pressing') heimBesitz += currentMatch.isHome ? 4 : -4;
        currentMatch.stats.possSum += Math.max(25, Math.min(75, heimBesitz));
        currentMatch.stats.possSteps++;
        // Abschlüsse, die nicht im Ticker landen (geblockt, drüber, vorbei)
        if (Math.random() < 0.3 + Math.max(0, diff) * 0.01) recordLiveShot(true, Math.random() < 0.3);
        if (Math.random() < 0.3 + Math.max(0, -diff) * 0.01) recordLiveShot(false, Math.random() < 0.3);
        renderLiveMatchStats();
        applyTacticAutomation();

        // Co-Kommentator: unabhängig vom Spielgeschehen, ca. jeder 5. Spielzug
        if (Math.random() < 0.2) {
            let line = pickContextualCommentaryLine();
            document.getElementById('ticker-log').innerHTML += `<div style="color:var(--teal); font-size:9px; font-style:italic;">${line}</div>`;
            document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
        }

        // Spielfeld-Animation: der Ball bewegt sich sichtbar über das Feld, damit man auch
        // optisch mitverfolgen kann, wo gerade gespielt wird - Richtung/Position hängt vom
        // Spielgeschehen dieses Spielzugs ab (Angriff Richtung Tor bei einer Chance/einem Tor,
        // sonst eher Mittelfeld-Gerangel).
        animateLiveBall(eventHandled ? (Math.random() < userFavoredProb ? 'home' : 'away') : (diff > 8 ? 'home' : (diff < -8 ? 'away' : 'midfield')));

        if (currentMatch.minute >= 90) { endMatchSimulation(); }
        // Co-Trainer im Livespiel (js/co-trainer-live.js): Hinweis aus dem echten Spielstand.
        if (typeof tickCoTrainerLive === 'function') tickCoTrainerLive();
    }

    // ---------- SPIELFELD-BALL-ANIMATION ----------
    // Bewegt einen kleinen Ball-Indikator über das Live-Spielfeld (per CSS-Transition), damit
    // jeder Spielzug auch optisch als "hier passiert gerade etwas" wahrnehmbar ist, statt nur
    // als Text im Ticker zu erscheinen.
    function animateLiveBall(direction) {
        let ball = document.getElementById('live-ball-indicator');
        if (!ball) return;
        let top, left;
        if (direction === 'home') { top = 12 + Math.random() * 15; left = 30 + Math.random() * 40; }
        else if (direction === 'away') { top = 73 + Math.random() * 15; left = 30 + Math.random() * 40; }
        else { top = 40 + Math.random() * 20; left = 20 + Math.random() * 60; }
        ball.style.top = top + '%';
        ball.style.left = left + '%';
    }

    // ---------- AUTOMATISCH LAUFENDER LIVE-TICKER ----------
    // Bisher musste jeder Spielzug einzeln per "Nächste Szene"-Klick ausgelöst werden - jetzt
    // läuft der Ticker direkt nach Anpfiff von selbst weiter (wie ein echter Live-Ticker),
    // pausiert automatisch während der Halbzeit-Ansprache und lässt sich bei Bedarf anhalten.
    let liveTickerTimer = null;
    let liveTickerPaused = false;
    function startLiveTickerAutoplay() {
        stopLiveTickerAutoplay();
        liveTickerPaused = false;
        updateLiveTickerPauseButton();
        liveTickerTimer = setInterval(() => {
            if (!currentMatch || liveTickerPaused || currentMatch.awaitingHalftimeTalk || currentMatch.awaitingSetPiece || currentMatch.minute >= 90) return;
            simulateMatchStep();
        }, 1800);
    }
    function stopLiveTickerAutoplay() {
        if (liveTickerTimer) { clearInterval(liveTickerTimer); liveTickerTimer = null; }
    }
    function toggleLiveTickerAutoplay() {
        liveTickerPaused = !liveTickerPaused;
        updateLiveTickerPauseButton();
    }
    function updateLiveTickerPauseButton() {
        let btn = document.getElementById('btn-toggle-autoplay');
        if (btn) btn.innerText = liveTickerPaused ? '▶ Ticker fortsetzen' : '⏸ Ticker pausieren';
    }

    function simulateRestOfMatch() {
        while (currentMatch.minute < 90) {
            // Beim schnellen Durchspielen wird "Ruhig bleiben" automatisch (neutral) gewählt,
            // damit kein Modal den Ablauf unterbricht.
            if (currentMatch.awaitingHalftimeTalk) chooseHalftimeTalk('ruhig', true);
            if (currentMatch.awaitingSetPiece && typeof resolveSetPiece === 'function') resolveSetPiece(null, true);
            simulateMatchStep();
            if (currentMatch.minute >= 90) break;
        }
    }

    // ---------- HALBZEIT-ANSPRACHE ----------
    // Nutzt jetzt erstmals den "Charakter"-Wert der Spieler wirklich (bisher nur Zier-Feld im
    // Spieler-Detail-Popup): hitzköpfige/emotionale Spieler reagieren stärker auf Kritik
    // (in beide Richtungen), ruhige/selbstbewusste Spieler bleiben stabiler.
    function showHalftimeTalkModal() {
        let ourGoals = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
        let oppGoals = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
        let scoreline = ourGoals > oppGoals ? 'Ihr führt' : (ourGoals < oppGoals ? 'Ihr liegt zurück' : 'Unentschieden');
        document.getElementById('halftime-score-summary').innerText = `${scoreline} (${currentMatch.homeGoals}:${currentMatch.awayGoals}) - was sagst du der Mannschaft in der Kabine?`;
        renderHalftimeSubSuggestion();
        document.getElementById('halftime-talk-overlay').classList.add('show');
    }
    // KI-Vorschlag für Einwechslungen zur Halbzeit: identifiziert den müdesten
    // Feldspieler auf dem Platz und den stärksten passenden Ersatz auf der Bank, statt dass
    // eine Einwechslung immer nur den zuletzt eingewechselten Spieler naiv austauscht.
    function getHalftimeSubSuggestion() {
        let onPitch = squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id) && p.pos !== 'TW');
        if (onPitch.length === 0 || substitutionsLeft <= 0) return null;
        let tiredest = [...onPitch].sort((a, b) => a.fitness - b.fitness)[0];
        if (tiredest.fitness > 75) return null; // noch kein dringender Handlungsbedarf
        let bench = squad.filter(p => !lineup.includes(p.id) && (p.injured || 0) === 0 && (p.suspended || 0) === 0);
        let replacement = bench.filter(p => p.pos === tiredest.pos).sort((a, b) => b.strength - a.strength)[0] || bench.sort((a, b) => b.strength - a.strength)[0];
        if (!replacement) return null;
        return { out: tiredest, in: replacement };
    }
    function renderHalftimeSubSuggestion() {
        let box = document.getElementById('halftime-sub-suggestion-box');
        if (!box) return;
        let sugg = getHalftimeSubSuggestion();
        box.innerHTML = sugg
            ? `<div class="box" style="font-size:10px; border-left-color:var(--teal);">🧑‍🏫 Co-Trainer-Tipp: ${sugg.out.name} ist erschöpft (${sugg.out.fitness}% Fitness) - ${sugg.in.name} bereitsteht.</div>
               <button onclick="applyHalftimeSubSuggestion()" class="btn-secondary" style="margin-top:4px;">🔄 Vorschlag übernehmen</button>`
            : '';
    }
    function applyHalftimeSubSuggestion() {
        let sugg = getHalftimeSubSuggestion();
        if (!sugg || substitutionsLeft <= 0) return;
        lineup = lineup.map(id => id === sugg.out.id ? sugg.in.id : id);
        substitutionsLeft--;
        currentMatch.ourBaseStr += (liveEffectiveStrength(sugg.in) - liveEffectiveStrength(sugg.out)) / 11;
        document.getElementById('ticker-log').innerHTML += `<div style="color:var(--teal); font-size:10px;">🔄 Halbzeit-Wechsel: ${sugg.in.name} für ${sugg.out.name} (Co-Trainer-Empfehlung).</div>`;
        document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
        renderLiveSubs();
        render3DPitch('live-pitch');
        renderHalftimeSubSuggestion();
    }
    function closeHalftimeTalkModal() {
        document.getElementById('halftime-talk-overlay').classList.remove('show');
    }
    function chooseHalftimeTalk(type, silent = false) {
        let onPitch = squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id));
        let emotionalShare = onPitch.length > 0 ? onPitch.filter(p => p.character === 'Emotional' || p.character === 'Hitzköpfig').length / onPitch.length : 0;
        let ourGoals = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
        let oppGoals = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
        let losing = ourGoals < oppGoals;

        let bonus = 0;
        let label = '';
        if (type === 'anfeuern') { bonus = 1.5 + emotionalShare * 1.5; label = '🔥 Anfeuern'; }
        else if (type === 'ruhig') { bonus = 1; label = '🧊 Ruhig bleiben'; }
        else if (type === 'taktik') { bonus = 1.5; label = '📋 Taktische Anpassung betont'; }
        else if (type === 'kritisieren') {
            // Risikoreich: bei Rückstand ein Weckruf (verstärkt durch emotionale Spieler),
            // bei Führung/Unentschieden wirkt Kritik unnötig demotivierend.
            bonus = losing ? (2.5 + emotionalShare * 2) : (-1.5 - emotionalShare * 1.5);
            label = '😠 Kritisieren';
        }
        currentMatch.halftimeTalkBonus = bonus;
        currentMatch.awaitingHalftimeTalk = false;
        closeHalftimeTalkModal();
        if (!silent) {
            let effectColor = bonus >= 0 ? 'var(--primary)' : 'var(--danger)';
            document.getElementById('ticker-log').innerHTML += `<div style="color:${effectColor}; font-weight:bold;">🎤 Halbzeit-Ansprache: ${label} (${bonus >= 0 ? '+' : ''}${bonus.toFixed(1)} Teamstärke 2. Hälfte)</div>`;
            document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
        }
    }

    function endMatchSimulation() {
        playSound('whistle');
        if (typeof resolvePregameTalk === 'function') resolvePregameTalk();
        stopLiveTickerAutoplay();
        if (currentMatch.stats) {
            let log = document.getElementById('ticker-log');
            if (log) log.innerHTML += `<div style="color:var(--accent); font-weight:bold;">🏁 Abpfiff! ${currentMatch.homeName} ${currentMatch.homeGoals}:${currentMatch.awayGoals} ${currentMatch.awayName}</div><div style="font-size:10px; color:#94a3b8;">${liveStatsSummaryLine()}</div>`;
            renderLiveMatchStats();
        }
        document.getElementById('btn-next-step').style.display = 'none';
        document.getElementById('btn-finish-match').style.display = 'inline-block';
        // Schiedsrichter-Kritik (js/referee-critique.js): nur nach strittigen Szenen ohne Sieg.
        if (typeof offerRefereeCritique === 'function') offerRefereeCritique();
        if (currentMatch.cupTie) { finishCupLiveMatch(); return; }
        if (currentMatch.ref) {
            currentMatch.ref.homeGoals = currentMatch.homeGoals;
            currentMatch.ref.awayGoals = currentMatch.awayGoals;
            currentMatch.ref.played = true;
            updateLeagueTable(game.leagueLevel, currentMatch.ref);
        }

        syncSecondTeamIntoLeagueTable();
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let mFixs = fixturesData[l] ? fixturesData[l][game.matchday - 1] : [];
            mFixs?.forEach(f => {
                if (!f.played) {
                    let homeTeam = leaguesData[l][f.home];
                    let awayTeam = leaguesData[l][f.away];
                    // Heimvorteil auch zwischen KI-Teams (25.12), sonst blieb die Heim-/Auswärtstabelle symmetrisch.
                    let hStr = (homeTeam?.strength || 60) + AI_HOME_ADVANTAGE;
                    let aStr = awayTeam?.strength || 60;
                    let goals = simulateGoals(hStr, aStr, homeTeam, awayTeam);
                    f.homeGoals = goals.myGoals;
                    f.awayGoals = goals.oppGoals;
                    f.played = true;
                    updateLeagueTable(l, f);
                }
            });
        }

        let won = (currentMatch.isHome && currentMatch.homeGoals > currentMatch.awayGoals) || (!currentMatch.isHome && currentMatch.awayGoals > currentMatch.homeGoals);
        let drawn = currentMatch.homeGoals === currentMatch.awayGoals;
        if (won) addManagerXP(150);

        let opponentName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
        let isHomeDerby = currentMatch.isHome && isDerbyOpponent(opponentName);
        let ourGoalsThisMatch = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
        let oppGoalsThisMatch = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
        recordRivalryResult(opponentName, ourGoalsThisMatch, oppGoalsThisMatch);
        // Formation-Statistiken erfassen (js/formation-stats.js)
        if (typeof recordFormationResult === 'function' && game.formation) {
            recordFormationResult(game.formation, ourGoalsThisMatch, oppGoalsThisMatch, opponentName);
        }

        applyMatchdayFinances(currentMatch.isHome, won, oppGoalsThisMatch === 0, isHomeDerby, opponentName, `${ourGoalsThisMatch}:${oppGoalsThisMatch}`);
        processPostMatchRoutine(won ? 'win' : (drawn ? 'draw' : 'loss'), isHomeDerby, true, ourGoalsThisMatch - oppGoalsThisMatch, currentMatch.isHome, { total: currentMatch.homeGoals + currentMatch.awayGoals, bothScored: currentMatch.homeGoals > 0 && currentMatch.awayGoals > 0 });
        let bester = game.lastMatchBestPlayer;
        let log = document.getElementById('ticker-log');
        if (log && bester && bester.matchday === game.matchday - 1) {
            log.innerHTML += `<div style="color:var(--gold); font-weight:bold;">🏅 Spieler des Spiels: ${bester.name} (Note ${formatGrade(bester.note)})</div>`;
            log.scrollTop = log.scrollHeight;
        }
    }

    function applyMatchdayFinances(isHomeMatch = true, won = false, cleanSheet = false, isDerbyMatch = false, opponentNameForRecord = null, scoreTextForRecord = null) {
        let moneyAtStart = game.money; // für automatische Rücklagenbildung (Finanzen & Kapitalmarkt)
        // Kontoauszug: die vielen Einzelbuchungen dieses Spieltags werden NICHT einzeln
        // im Kontoauszug geführt - sie stehen vollständig aufgeschlüsselt im
        // Buchungsjournal (siehe game.financeLedger weiter unten).
        setzeBuchungskontext(SPIELTAG_KONTEXT);
        // Rasenpflege: das Geläuf nutzt sich durch jedes Heimspiel leicht ab, siehe
        // tickPitchCondition()/maintainPitch() in stadium.js.
        if (isHomeMatch && typeof tickPitchCondition === 'function') tickPitchCondition();
        let ghostGameActive = isHomeMatch && game.forcedGhostGame;
        // Lokalderby-Atmosphäre: bei Heimspielen gegen den permanenten Rivalen ist das
        // Stadion deutlich stärker ausgelastet als sonst (gedeckelt bei "ausverkauft").
        let derbyBoostActive = isHomeMatch && isDerbyMatch && !ghostGameActive;
        // Pokal-/Europapokalspiele: ziehen erfahrungsgemäß mehr Zuschauer an als
        // gewöhnliche Ligaspiele - besondere Atmosphäre, seltenere Gelegenheit.
        let isCupOrEuropeMatch = isHomeMatch && !ghostGameActive && typeof currentMatch !== 'undefined' && currentMatch && (currentMatch.isCup || currentMatch.isEurope);
        let cupBoostActive = isCupOrEuropeMatch && !derbyBoostActive;
        let attFactor = getAttendanceFactor();
        // War die Auslastung schon VOR der Deckelung bei "ausverkauft" (Faktor >= 1.0), ist
        // das Stadion wirklich bis an seine (liga-abhängige) Kapazitätsgrenze gefüllt. Bei
        // niedriger Fan-Zufriedenheit früh in der Karriere greift der Derby-Bonus zwar auch,
        // reicht aber oft nicht annähernd an die Kapazität heran - die Meldung muss das
        // unterscheiden, sonst behauptet sie fälschlich "bis auf den letzten Platz gefüllt",
        // obwohl bei zwei verschiedenen Spielen ganz unterschiedliche absolute Zuschauerzahlen
        // (z.B. unter 1.000 vs. über 2.000) beide als "ausverkauft" gemeldet würden.
        let genuinelySoldOut = derbyBoostActive && (attFactor * 2.2) >= 1.0;
        if (derbyBoostActive) attFactor = Math.min(1.0, attFactor * 2.2);
        else if (cupBoostActive) attFactor = Math.min(1.0, attFactor * 1.4);
        // Bugfix: die Zuschauerzahl war bisher komplett deterministisch (nur Fanstimmung,
        // Komfort, Wetter, Ticketpreis) - bei unveränderten Bedingungen kam über mehrere
        // Spieltage hinweg exakt dieselbe Zahl heraus, was unrealistisch auffiel. Echte
        // Zuschauerzahlen schwanken auch bei ansonsten gleichen Bedingungen spürbar (Wochentag,
        // private Termine, Tagesform der Fans) - jetzt mit einer moderaten Zufallsstreuung von
        // ±8%, die NICHT in die "ausverkauft"-Erkennung einfließt (die bleibt strukturell).
        let attendanceNoise = genuinelySoldOut ? 1.0 : (0.92 + Math.random() * 0.16);
        // Konsistenz-Fix: bei einem LIVE gespielten Match wurde die Zuschauerzahl bereits
        // beim Anpfiff gewürfelt und in currentMatch.finalAttendance gespeichert - diese
        // exakt gleiche Zahl hier wiederverwenden, statt einen zweiten, abweichenden
        // Zufallswert zu erzeugen. Nur bei Batch-Simulation (kein Live-Kontext) wird hier
        // frisch gewürfelt.
        let att;
        if (isHomeMatch && !ghostGameActive) {
            if (typeof currentMatch !== 'undefined' && currentMatch && currentMatch.finalAttendance !== undefined && currentMatch.finalAttendanceMatchday === game.matchday) {
                att = currentMatch.finalAttendance;
            } else {
                att = calculateMatchAttendance(derbyBoostActive ? 2.2 : (cupBoostActive ? 1.4 : 1), attendanceNoise);
            }
        } else {
            att = 0;
        }
        // Zuschauerzahl des letzten Heimspiels - bisher nirgendwo dauerhaft sichtbar, nur in
        // Sonderfällen (Rekord/Meilenstein) erwähnt. Jetzt fest im Finanzen- und Live-Match-
        // Screen angezeigt.
        if (isHomeMatch && !ghostGameActive) game.lastHomeAttendance = att;
        // Zuschauerhistorie: jedes Heimspiel wird dauerhaft mit Zuschauerzahl protokolliert,
        // damit man auch im Nachhinein sehen kann, wie voll das Stadion an welchem Spieltag
        // war - nicht nur beim allerletzten Spiel.
        if (isHomeMatch && !ghostGameActive) {
            if (!game.attendanceHistory) game.attendanceHistory = [];
            game.attendanceHistory.push({ season: game.season, matchday: game.matchday, opponent: opponentNameForRecord || '-', attendance: att, capacity: stadium.total || 16000 });
            if (game.attendanceHistory.length > 200) game.attendanceHistory.shift();
            // (Zuschauerrekord wird bereits an anderer Stelle über game.recordAttendance
            // gepflegt, siehe applyMatchdayFinances weiter unten - keine doppelte Erfassung.)
        }
        // Vereinsrekorde: größter Sieg, höchste Niederlage, torreichstes Spiel und
        // ungeschlagen-Serie - bisher gab es außer der punktuellen Rivalen-Bilanz kein
        // dauerhaftes Rekordarchiv für den gesamten Verein.
        if (scoreTextForRecord && typeof scoreTextForRecord === 'string' && scoreTextForRecord.includes(':')) {
            let [ourGoals, oppGoals] = scoreTextForRecord.split(':').map(n => parseInt(n));
            if (!isNaN(ourGoals) && !isNaN(oppGoals)) {
                let margin = ourGoals - oppGoals;
                let recordEntry = { opponent: opponentNameForRecord, score: scoreTextForRecord, season: game.season, matchday: game.matchday };
                if (margin > 0) {
                    if (!game.clubRecords.biggestWin || margin > (game.clubRecords.biggestWin.ourGoals - game.clubRecords.biggestWin.oppGoals)) {
                        game.clubRecords.biggestWin = { ...recordEntry, ourGoals, oppGoals };
                    }
                    game.clubRecords.currentUnbeatenStreak = (game.clubRecords.currentUnbeatenStreak || 0) + 1;
                } else if (margin < 0) {
                    if (!game.clubRecords.biggestLoss || margin < (game.clubRecords.biggestLoss.ourGoals - game.clubRecords.biggestLoss.oppGoals)) {
                        game.clubRecords.biggestLoss = { ...recordEntry, ourGoals, oppGoals };
                    }
                    game.clubRecords.currentUnbeatenStreak = 0;
                } else {
                    game.clubRecords.currentUnbeatenStreak = (game.clubRecords.currentUnbeatenStreak || 0) + 1;
                }
                game.clubRecords.longestUnbeatenStreak = Math.max(game.clubRecords.longestUnbeatenStreak || 0, game.clubRecords.currentUnbeatenStreak);
                let totalGoals = ourGoals + oppGoals;
                if (!game.clubRecords.mostGoalsInMatch || totalGoals > game.clubRecords.mostGoalsInMatch.total) {
                    game.clubRecords.mostGoalsInMatch = { ...recordEntry, total: totalGoals };
                }
            }
        }
        // Bugfix: die VIP-Logen galten bei JEDEM Heimspiel als voll besetzt, auch wenn nur
        // 600 Zuschauer im Stadion waren - ein Kreisklassenspiel verdiente so ein Viertel
        // seiner Ticketeinnahmen mit 50 verkauften Logenplaetzen. Jetzt sind sie wie in der
        // GuV-Prognose (finances.js) an die tatsaechliche Zuschauerzahl gekoppelt.
        // Dauerkarten: der Anteil der Zuschauer, der bereits über die Dauerkarte bezahlt
        // hat (siehe renewSeasonTickets() in stadium.js), wird bei der SPIELTAGS-Einnahme
        // ausgeklammert - sonst würde er doppelt kassiert. Er zählt aber weiterhin voll zur
        // Zuschauerzahl (Fanartikel, Rekorde, Auslastung), da diese Fans wirklich im Stadion
        // stehen/sitzen.
        let dauerkartenAnwesend = (typeof getSeasonTicketAttendanceFloor === 'function') ? Math.min(att, getSeasonTicketAttendanceFloor()) : 0;
        let zahlendeAtt = Math.max(0, att - dauerkartenAnwesend);
        let vipSold = Math.min(stadium.vipTotal || 50, Math.round(zahlendeAtt * (stadium.vipShare ?? 0.05)));
        let ticketIncome = (isHomeMatch && !ghostGameActive) ? Math.round(zahlendeAtt * (stadium.stehShare ?? 0.5) * game.ticketPrices.steh + zahlendeAtt * (stadium.sitzShare ?? 0.45) * game.ticketPrices.sitz + vipSold * game.ticketPrices.vip) : 0;
        // Doppelte Ticketeinnahmen (Premium-Booster, NEU).
        if (isHomeMatch && game.ticketIncomeBoostNextMatch) { ticketIncome *= 2; game.ticketIncomeBoostNextMatch = false; }
        // Medienrechte: eigener Medienpartner zahlt bei jedem Heimspiel, mit Bonus bei
        // Derbys/Pokalspielen (attraktivere Übertragungen).
        // Stadion-Erweiterungen: feste Zusatzeinnahmen der "income"-Kategorie
        // (VIP-Lounges, Public-Viewing, Ladestationen) sowie ein leichter Medienimage-Schub
        // durch Lichtshow/Pressezentrum bei jedem Heimspiel.
        if (isHomeMatch && typeof getStadiumMatchdayIncome === 'function') {
            game.money += getStadiumMatchdayIncome();
            game.managerMediaImage = Math.min(100, (game.managerMediaImage ?? 50) + getStadiumMediaImageMatchdayBonus());
        }
        if (isHomeMatch && typeof tickMediaRightsPayment === 'function') {
            tickMediaRightsPayment(isDerbyMatch, !!(typeof currentMatch !== 'undefined' && currentMatch && currentMatch.isCup));
        }
        // Betriebskosten (echte Abbuchung): dieselbe Formel wurde bisher nur im
        // Finanz-Ausblick ANGEZEIGT, aber nie tatsächlich abgebucht - ein "Phantom-Posten".
        // Jetzt wird der Pro-Spieltag-Anteil (Monatsschätzung / 4) jeden Spieltag wirklich
        // fällig, egal ob Heim- oder Auswärtsspiel (laufende Kosten fallen immer an).
        // Betriebskosten inkl. Rabatt für stillgelegte Ränge, siehe js/stadium.js.
        let baseStadiumMaintenance = getStadiumBaseMaintenance();
        // Bugfix: "Modernes Einlass-System" bewarb "Senkt Betriebskosten", trug aber durch
        // seine eigene Ausbaustufe (650 €/Stufe wie jedes andere Gebäude) sogar selbst zu den
        // Betriebskosten bei - bei niedrigen Gesamtkosten überstieg dieser Eigenbeitrag sogar
        // den zunächst angesetzten Rabatt (eigener Rechenfehler beim ersten Versuch entdeckt).
        // Jetzt zählt die eigene Ausbaustufe gar nicht erst zu den Betriebskosten dazu, PLUS
        // eine echte Senkung der übrigen Betriebskosten - garantiert immer eine Nettoersparnis.
        let campusMaintenanceSum = Object.keys(campusBuildings).reduce((s, k) => s + (k === 'turnstiles' ? 0 : campusBuildings[k].lvl * 650), 0);
        let maintenanceCost = Math.round(baseStadiumMaintenance + campusMaintenanceSum);
        if (campusBuildings.turnstiles?.lvl > 0) maintenanceCost = Math.round(maintenanceCost * (1 - campusBuildings.turnstiles.lvl * 0.02));
        game.money -= maintenanceCost;
        // Modernes Einlass-System (Campus): verhindert Schwarzmarkt-/Fälschungsverluste bei
        // den Ticketeinnahmen (war bisher nur Text ohne tatsächliche Wirkung).
        if (isHomeMatch && !ghostGameActive) ticketIncome = Math.round(ticketIncome * (1 + (campusBuildings.turnstiles?.lvl || 0) * 0.02));
        // Mitgliedsbeiträge (Fan-Zentrale): laufende Einnahme pro Heimspiel, unabhängig vom
        // Ticketpreis - Vereinsmitglieder zahlen ihren Beitrag unabhängig davon, ob sie kommen.
        let membershipIncome = (isHomeMatch && typeof collectMembershipFees === 'function') ? collectMembershipFees() : 0;
        if (membershipIncome > 0) game.money += membershipIncome;
        // Bisher unverkabelte Campus-Gebäude: Fan-Kneipe, Parkhaus, VIP-Tagungshotel und
        // Foodtrucks kosteten echtes Geld zum Ausbauen, hatten aber trotz gegenteiliger
        // Beschreibung KEINE tatsächliche Auswirkung. Jetzt zahlen sie pro Heimspiel wie
        // beschrieben tatsächlich ein.
        let campusFacilityIncome = 0;
        if (isHomeMatch && !ghostGameActive) {
            campusFacilityIncome += (campusBuildings.fankneipe?.lvl || 0) * 1800;
            campusFacilityIncome += (campusBuildings.parkhaus?.lvl || 0) * 1500;
            campusFacilityIncome += (campusBuildings.hotel?.lvl || 0) * 5000;
            campusFacilityIncome += (campusBuildings.foodtrucks?.lvl || 0) * 2400;
            if (campusFacilityIncome > 0) game.money += campusFacilityIncome;
            // Fan-Kneipe steigert außerdem die Ultra-Zufriedenheit, wie beschrieben.
            if (campusBuildings.fankneipe?.lvl > 0 && typeof fanGroups !== 'undefined') {
                let ultras = fanGroups.find(g => g.id === 'ultras');
                if (ultras) ultras.mood = Math.min(100, ultras.mood + campusBuildings.fankneipe.lvl * 0.3);
            }
        }
        let merchIncome = simulateMerchSales(isHomeMatch && !ghostGameActive, won, att);
        let wages = squad.reduce((s, p) => s + p.wage, 0);
        // Bugfix: Gehälter der Zweiten Mannschaft wurden bisher nie abgebucht, obwohl die
        // Spieler reale Gehaltswerte über dieselbe createPlayer()-Fabrik erhalten - "kostenlose
        // Arbeitskraft" trotz echtem Kader mit echten Marktwerten.
        if (game.secondTeam.isActive) wages += secondTeamSquad.reduce((s, p) => s + p.wage, 0);
        // Auswärtsfahrten kosten Geld - skaliert mit der Ligastufe als Distanz-Näherung
        // (höhere Ligen = bundesweite/größere Auswärtsfahrten statt reiner Lokalderbys).
        // Bus statt Flugzeug spart ~45% der Kosten, kostet dafür mehr Kondition (siehe
        // processPostMatchRoutine() für den Ermüdungs-Teil).
        let baseTravelCost = (!isHomeMatch) ? Math.round((800 + (NUM_LEAGUES - game.leagueLevel) * 300)) : 0;
        let travelCost = (game.travelMode === 'bus') ? Math.round(baseTravelCost * 0.55) : baseTravelCost;
        // Sponsoren-Themenbonus: manche Sponsoren zahlen zusätzlich eine an ein bestimmtes
        // Ereignis geknüpfte Sonderprämie (siehe rollThemedBonus() in sponsors.js).
        let themedBonus = 0;
        if (game.sponsor.themedBonusType === 'cleanSheet' && cleanSheet) themedBonus = game.sponsor.themedBonusAmount;
        if (game.sponsor.themedBonusType === 'attendance' && isHomeMatch && !ghostGameActive) themedBonus = Math.round(att * game.sponsor.themedBonusAmount);
        // Sponsoren-Zufriedenheit: bei niedriger Loyalität zahlt der Hauptsponsor
        // spürbar weniger (nur der Hauptsponsor-Teil, nicht Banden/Ausrüster/Namensrechte).
        let loyaltyMult = typeof getSponsorLoyaltyPaymentMultiplier === 'function' ? getSponsorLoyaltyPaymentMultiplier() : 1;
        let mainSponsorInc = Math.round((game.sponsor.base + (won ? game.sponsor.winBonus : 0) + themedBonus) * loyaltyMult);
        // Sponsoren-Boost (Premium-Booster, NEU): +50% für begrenzte Zeit.
        if (game.sponsorBoostMatchdaysLeft > 0) mainSponsorInc = Math.round(mainSponsorInc * 1.5);
        // Stadion-Erweiterungen: Solaranlage/Business-Center erhöhen die laufenden
        // Sponsoreneinnahmen dauerhaft.
        if (typeof getStadiumSponsorBonus === 'function') mainSponsorInc = Math.round(mainSponsorInc * (1 + getStadiumSponsorBonus()));
        let sponsorInc = mainSponsorInc + (isHomeMatch ? getBandenIncome() + game.kitSupplier.income + (stadium.namingRightsIncome || 0) : 0) + (game.sleeveSponsor?.income || 0);
        // Sponsoren-Ranking: trackt über die gesamte Karriere hinweg, welcher Sponsor (nach
        // Name) am meisten eingebracht hat - sichtbar als kleines Leaderboard im Finanzen-Screen.
        if (!game.sponsorEarningsHistory) game.sponsorEarningsHistory = {};
        if (!game.sponsorEarningsByCategory) game.sponsorEarningsByCategory = {};
        function trackSponsorEarning(name, amount, category) {
            if (!name || name.startsWith('Kein') || amount <= 0) return;
            game.sponsorEarningsHistory[name] = (game.sponsorEarningsHistory[name] || 0) + amount;
            let cat = category || 'Sonstige';
            game.sponsorEarningsByCategory[cat] = (game.sponsorEarningsByCategory[cat] || 0) + amount;
        }
        trackSponsorEarning(game.sponsor.name, mainSponsorInc, game.sponsor.category);
        if (isHomeMatch) {
            trackSponsorEarning(game.kitSupplier.name, game.kitSupplier.income, game.kitSupplier.category);
            trackSponsorEarning(stadium.namingRightsSponsor, stadium.namingRightsIncome || 0, 'Namensrechte');
            bandenSponsors.filter(b => b.active).forEach(b => trackSponsorEarning(b.name, b.income, b.category));
        }
        trackSponsorEarning(game.sleeveSponsor?.name, game.sleeveSponsor?.income || 0, game.sleeveSponsor?.category);
        // Steuern & Abgaben (siehe finances.js): echte Abgabe auf die Spieltagseinnahmen.
        // Der Steuerberater senkt den Satz, kostet dafür aber ein laufendes Honorar - beides
        // wird hier verbucht und für die Anzeige in der GuV festgehalten.
        // TV-Gelder als Spieltagsrate (siehe getTvMoneyInstallment() in media-rights.js):
        // frueher nur eine Einmalzahlung zum Saisonende, wodurch gerade die oberen Ligen die
        // gesamte Saison ueber tief im Minus standen.
        let tvInstallment = (typeof getTvMoneyInstallment === 'function') ? getTvMoneyInstallment() : 0;
        game.tvMoneyPaidThisSeason = (game.tvMoneyPaidThisSeason || 0) + tvInstallment;

        let grossIncome = ticketIncome + merchIncome + sponsorInc + tvInstallment;
        let taxAmount = Math.round(Math.max(0, grossIncome) * getTaxRate());
        let advisorFee = financeCentralState.taxAdvisorHired ? getTaxAdvisorFee() : 0;
        game.lastMatchdayTax = taxAmount;
        game.lastMatchdayAdvisorFee = advisorFee;
        game.seasonTaxPaid = (game.seasonTaxPaid || 0) + taxAmount + advisorFee;

        // Bugfix: Personalgehälter wurden nie abgebucht. Die GuV-Prognose (finances.js) und
        // der Personal-Screen wiesen sie als laufende Kosten aus, tatsächlich arbeitete das
        // gesamte Personal kostenlos - dadurch ließen sich die angezeigten Zahlen prinzipiell
        // nicht mit dem Kontostand in Einklang bringen.
        let staffWages = (typeof getTotalStaffWages === 'function') ? getTotalStaffWages() : 0;
        let secondTeamStaffWages = (typeof getSecondTeamStaffWages === 'function') ? getSecondTeamStaffWages() : 0;

        let operatingCost = typeof getOperatingCostPerMatchday === 'function' ? getOperatingCostPerMatchday() : 0;
        let net = grossIncome - taxAmount - advisorFee - wages - staffWages - secondTeamStaffWages - travelCost - operatingCost;
        game.money += net;

        // Buchungsjournal: hält für JEDEN Spieltag fest, woraus sich Einnahmen und Ausgaben
        // tatsächlich zusammensetzen. Vorher gab es nur eine grobe Monatsprognose mit
        // Sammelposten, aus der sich nicht ablesen ließ, woher ein Betrag stammt.
        let einnahmen = [
            { label: '🎟️ Ticketverkauf', amount: ticketIncome },
            { label: '👕 Fanartikel', amount: merchIncome },
            { label: '📺 TV-Gelder (Liga)', amount: tvInstallment },
            { label: '🤝 Hauptsponsor', amount: mainSponsorInc },
            { label: '📢 Bandenwerbung', amount: isHomeMatch ? getBandenIncome() : 0 },
            { label: '🧥 Ausrüster', amount: isHomeMatch ? game.kitSupplier.income : 0 },
            { label: '🏟️ Namensrechte', amount: isHomeMatch ? (stadium.namingRightsIncome || 0) : 0 },
            { label: '👔 Ärmelsponsor', amount: game.sleeveSponsor?.income || 0 },
            { label: '🎫 Mitgliedsbeiträge', amount: membershipIncome },
            { label: '🏘️ Campus-Anlagen', amount: campusFacilityIncome }
        ].filter(e => e.amount > 0);
        let ausgaben = [
            { label: '⚽ Spielergehälter', amount: wages },
            { label: '💼 Personalgehälter', amount: staffWages },
            { label: '🅱️ Reserve-Trainerstab', amount: secondTeamStaffWages },
            { label: '🔧 Stadion- & Campus-Unterhalt', amount: maintenanceCost },
            { label: '🏢 Spielbetrieb & Verwaltung', amount: operatingCost },
            { label: '🚌 Auswärtsfahrt', amount: travelCost },
            { label: '🧾 Steuern & Abgaben', amount: taxAmount },
            { label: '📊 Steuerberater-Honorar', amount: advisorFee }
        ].filter(e => e.amount > 0);

        if (!game.financeLedger) game.financeLedger = [];
        let ledgerSummeEin = einnahmen.reduce((s, e) => s + e.amount, 0);
        let ledgerSummeAus = ausgaben.reduce((s, e) => s + e.amount, 0);
        game.financeLedger.push({
            season: game.season, matchday: game.matchday,
            heimspiel: !!isHomeMatch, zuschauer: att,
            einnahmen, ausgaben,
            summeEin: ledgerSummeEin,
            summeAus: ledgerSummeAus
        });
        if (game.financeLedger.length > 80) game.financeLedger.shift();
        // Ausgaben-Warnlimit (Finanzen): meldet sich beim Überschreiten, nicht jeden Spieltag neu.
        let warnLimit = financeCentralState.expenseWarningLimit || 0;
        let vorher = game.financeLedger[game.financeLedger.length - 2];
        if (warnLimit > 0 && ledgerSummeAus > warnLimit && !(vorher && vorher.summeAus > warnLimit)) {
            let groesste = [...ausgaben].sort((a, b) => b.amount - a.amount).slice(0, 3).map(e => `${e.label}: ${formatVal(e.amount)}`).join(', ');
            addInboxMessage('finanzen', '⚠️ Ausgaben über dem Warnlimit', `Die Ausgaben dieses Spieltags (${formatVal(ledgerSummeAus)}) liegen über deinem Warnlimit von ${formatVal(warnLimit)}. Größte Posten: ${groesste}.`, 'screen-finances');
        }
        // Financial Fairplay (js/ffp.js): die komplette Spieltagsabrechnung zaehlt zum
        // laufenden Saison-Ergebnis - anders als der Kontoauszug (siehe protokolliereBuchung
        // in finances.js) gibt es hier keine Ausnahmen, das Spieltagsgeschaeft ist immer
        // regulaeres Kerngeschaeft.
        if (typeof addToFfpSeasonNet === 'function') addToFfpSeasonNet(ledgerSummeEin - ledgerSummeAus);
        if (ghostGameActive) game.forcedGhostGame = false; // Geisterspiel-Auflage ist damit erfüllt
        if (derbyBoostActive) {
            if (genuinelySoldOut) {
                addInboxMessage('vertrag', '🔥 Ausverkauftes Lokalderby!', `Das Stadion war beim Derby gegen ${opponentNameForRecord || 'den Derbygegner'} bis auf den letzten Platz gefüllt (${att.toLocaleString('de-DE')} Zuschauer) - ${formatVal(ticketIncome)} Ticketeinnahmen!`, 'screen-finances');
            } else {
                addInboxMessage('vertrag', '🔥 Rekordkulisse beim Lokalderby!', `Das Derby gegen ${opponentNameForRecord || 'den Derbygegner'} lockte deutlich mehr Zuschauer als sonst an (${att.toLocaleString('de-DE')} Zuschauer) - ${formatVal(ticketIncome)} Ticketeinnahmen! Bei wachsender Fan-Zufriedenheit wird das Stadion künftig noch voller.`, 'screen-finances');
            }
        } else if (cupBoostActive) {
            addInboxMessage('vertrag', '🏆 Besondere Pokal-Atmosphäre!', `Das Pokal-/Europapokalspiel lockte mehr Zuschauer als ein gewöhnliches Ligaspiel an (${att.toLocaleString('de-DE')} Zuschauer) - ${formatVal(ticketIncome)} Ticketeinnahmen!`, 'screen-finances');
        }

        // Zuschauerrekord: höchste je in der Vereinsgeschichte erzielte Zuschauerzahl - als
        // dedizierte Statistik (NICHT als Trophäen-Eintrag, sonst würde die Trophäenliste
        // durch die vielen kleinen Zwischenrekorde zu Saisonbeginn zugespammt).
        if (isHomeMatch && !ghostGameActive && att > game.recordAttendance) {
            let isSignificantJump = game.recordAttendance === 0 || att >= game.recordAttendance * 1.1;
            game.recordAttendance = att;
            game.recordAttendanceSeason = game.season;
            if (isSignificantJump) {
                showToast(`📊 Neuer Zuschauerrekord: ${att.toLocaleString('de-DE')}!`, 'success');
                let context = opponentNameForRecord ? ` gegen ${opponentNameForRecord}${scoreTextForRecord ? ` (${scoreTextForRecord})` : ''}` : '';
                addInboxMessage('vertrag', '📊 Neuer Zuschauerrekord!', `${att.toLocaleString('de-DE')} Zuschauer beim Heimspiel${context} - der bisher höchste Wert in der Vereinsgeschichte!`, 'screen-history');
                pendingMilestoneInterviewType = 'attendanceRecord';
            }
            checkAttendanceMilestones(att);
        }
        // Automatische Rücklagenbildung (Finanzen & Kapitalmarkt): zweigt einen Teil des
        // Netto-Überschusses DIESES Spieltags ab, falls aktiviert.
        setzeBuchungskontext('🏦 Automatische Rücklage');
        if (typeof tickAutoReserve === 'function') tickAutoReserve(game.money - moneyAtStart);
        loescheBuchungskontext();
        if (typeof checkForScandale === 'function') checkForScandale();
        if (typeof analyzeMatchTactics === 'function') {
            let [ownGoals, oppGoals] = String(scoreTextForRecord || '').split(':').map(n => parseInt(n, 10));
            let hasScore = Number.isFinite(ownGoals) && Number.isFinite(oppGoals);
            analyzeMatchTactics({ won: won, draw: hasScore && ownGoals === oppGoals, score: hasScore ? ownGoals : 0, conceded: hasScore ? oppGoals : 0 });
        }
    }

    // Bestimmte runde Zuschauerzahlen sind erzählerisch bedeutsam genug für eine einmalige
    // Belohnung statt nur einer trockenen Statistik-Notiz - jeder Meilenstein wird nur einmal
    // je Karriere ausgezahlt (game.attendanceMilestonesReached merkt sich das).
    const ATTENDANCE_MILESTONES = [
        { threshold: 10000, bonus: 25000, fanFloor: 3, label: 'Erstmals über 10.000 Zuschauer!' },
        { threshold: 25000, bonus: 60000, fanFloor: 5, label: 'Erstmals über 25.000 Zuschauer!' },
        { threshold: 50000, bonus: 150000, fanFloor: 8, label: 'Erstmals über 50.000 Zuschauer!' }
    ];
    function checkAttendanceMilestones(att) {
        if (!game.attendanceMilestonesReached) game.attendanceMilestonesReached = [];
        ATTENDANCE_MILESTONES.forEach(m => {
            if (att >= m.threshold && !game.attendanceMilestonesReached.includes(m.threshold)) {
                game.attendanceMilestonesReached.push(m.threshold);
                game.money += m.bonus;
                boostFanBaseFloor(m.fanFloor, m.label);
                addInboxMessage('vertrag', `🎉 ${m.label}`, `Ein historischer Meilenstein für den Verein! Einmalbonus: ${formatVal(m.bonus)}.`, 'screen-history');
                showToast(`🎉 ${m.label} +${formatVal(m.bonus)}!`, 'success');
                // Live-Stadionansage: falls gerade eine Live-Partie läuft, wird der Moment
                // direkt im Ticker gefeiert statt nur im Nachhinein im Postfach zu stehen.
                let tickerLog = document.getElementById('ticker-log');
                if (tickerLog && document.getElementById('screen-matchday')?.style.display === 'block') {
                    tickerLog.innerHTML += `<div style="text-align:center; color:var(--gold); font-weight:900; font-size:11px; margin:6px 0;">📢 STADIONANSAGE: „${m.label}“ - ${att.toLocaleString('de-DE')} Zuschauer im Stadion!</div>`;
                    tickerLog.scrollTop = tickerLog.scrollHeight;
                }
            }
        });
    }

    // Ausschreitungen bei Heim-Derbys: Risiko sinkt deutlich mit mehr Ordnerdienst-Personal.
    function checkHooliganIncident() {
        // Eigene Sicherheitskräfte: feste Ordner zählen zur effektiven Ordnerzahl dazu,
        // die Ausbildungsstufe macht jeden einzelnen Ordner zusätzlich wirksamer.
        let effectiveStewards = (game.stewards || 0) + (typeof securityWorkforce !== 'undefined' ? securityWorkforce.permanentStewards : 0);
        let skillMult = typeof securityWorkforce !== 'undefined' ? (1 + (securityWorkforce.skillLevel - 1) * 0.12) : 1;
        let baseChance = 0.12 * (1 - Math.min(0.92, (effectiveStewards / 100) * 0.8 * skillMult));
        if (staffMembers.fanLiaison.hired) baseChance *= 0.7; // Fanbeauftragter deeskaliert im Vorfeld
        // Sicherheitslage beruhigen (Premium-Booster, NEU): stark reduziertes Risiko.
        if (game.securityCalmNextMatch) baseChance *= 0.15;
        // Stadion-Sicherheitstechnik: dauerhafte Risikosenkung durch gekaufte Anlagen.
        if (typeof getStadiumSecurityBonus === 'function') baseChance *= (1 - getStadiumSecurityBonus());
        // Derby-Woche: Choreo (Pyro) erhöht, Sicherheitskonzept/Respekt senken das Risiko.
        if (typeof getDerbyRiskFactor === 'function') baseChance *= getDerbyRiskFactor();
        if (Math.random() >= baseChance) return;

        game.riotCount = (game.riotCount || 0) + 1;
        let fine = Math.min(game.money, 8000 + game.riotCount * 4000);
        // Sicherheitschef: verhandelt mit dem Verband nach - senkt die Höhe der Strafe
        // spürbar (war bisher nur Text ohne tatsächliche Wirkung).
        if (staffMembers.secChief.hired) fine = Math.round(fine * 0.5);
        game.money = Math.max(0, game.money - fine);
        game.fans = Math.max(game.fanBaseFloor, game.fans - 12);
        game.boardSat = Math.max(10, game.boardSat - 8);
        game.forcedGhostGame = true;
        showNotice('🔥 Ausschreitungen im Derby', `Rivalisierende Fangruppen liefern sich Straßenschlachten rund ums Stadion.\n\nStrafe: ${formatVal(fine)}. Der Verband verhängt ein Geisterspiel für die nächste Heimpartie.` + (game.riotCount >= 3 ? '\n\n⚠️ Wiederholte Vorfälle: der Verband beobachtet euren Klub inzwischen sehr genau.' : ''), { typ: 'warn' });
    }

    function processPostMatchRoutine(matchResult = null, isHomeDerby = false, isLiveContext = false, matchMargin = 0, isHomeMatchParam = true, totalGoalsForBets = null) {
        // Löst die Insider-Wette und die Spionage-Info fürs vergangene Spiel auf/zurück,
        // unabhängig davon ob live gespielt oder automatisch simuliert wurde - beide sind
        // ans jeweils NÄCHSTE (jetzt vergangene) Spiel gebunden, nicht an den Live-Kontext.
        if (matchResult !== null) resolveUnderworldInsiderBet(matchResult === 'win');
        if (typeof resolvePressPromise === 'function') resolvePressPromise(matchResult);
        // Noten für alle eingesetzten Spieler (js/player-stats.js) - live wie simuliert.
        if (matchResult !== null && totalGoalsForBets && typeof gradeOwnMatch === 'function') {
            let unsere = (totalGoalsForBets.total + matchMargin) / 2;
            gradeOwnMatch(unsere, totalGoalsForBets.total - unsere);
        }
        underworld.spyIntelActive = false;
        // Zuschauerzahl-Konsistenz-Fix: finalAttendance nach dem Spiel zurücksetzen,
        // damit sie nicht versehentlich ins nächste Spiel durchsickert.
        if (typeof currentMatch !== 'undefined' && currentMatch) currentMatch.finalAttendance = undefined;
        // Premium-Booster-Flags: erst NACH dem kompletten Spiel zurücksetzen, da sie
        // während des gesamten Spielverlaufs (viele Ticks) wirken sollen, nicht nur beim ersten.
        if (matchResult !== null) {
            game.luckyCharmNextMatch = false;
            game.securityCalmNextMatch = false;
            if (typeof recordOwnTacticStyle === 'function') recordOwnTacticStyle();
        }
        game.videoAnalysisBoostActive = false; // Video-Analyse-Bonus gilt nur fürs eine Spiel
        // Finanzen & Kapitalmarkt: Festgeld, Rücklagen, Kontoverlauf und Bonität jeden
        // verarbeiteten Spieltag aktualisieren.
        if (typeof tickFixedDeposit === 'function') {
            tickFixedDeposit();
            tickMoneyHistory();
            tickCreditRating();
        }
        // Jugendspieler-Hospitanz (Training & Förderung): erhöhte Entwicklungschance durch
        // Mittrainieren mit den Profis, jeden verarbeiteten Spieltag ausgewertet.
        if (game.youthHospitants && game.youthHospitants.length > 0) {
            game.youthHospitants.forEach(id => {
                let p = youthTalents.find(y => y.id === id);
                if (p) {
                    // Potenzial-Multiplikator & Ausbildungsschwerpunkt (Jugendakademie): stärkere
                    // Talente und passender Fokus entwickeln sich schneller in der Hospitanz.
                    let potMult = typeof getYouthPotentialMultiplier === 'function' ? getYouthPotentialMultiplier(p) : 1;
                    // Jugend-Mentor: ein erfahrener Profi als persönlicher Mentor
                    // beschleunigt die Entwicklung während der Hospitanz zusätzlich spürbar.
                    if (p.mentorId && squad.some(s => s.id === p.mentorId)) potMult *= 1.35;
                    if (Math.random() < 0.12 * potMult) {
                        let statMap = { torschuss: 'shooting', passspiel: 'passing', zweikampf: 'defense', tempo: 'pace' };
                        let stat = statMap[p.youthFocus];
                        if (stat) p[stat] = Math.min(99, (p[stat] || 55) + 1);
                        p.strength = Math.min(99, p.strength + 1);
                    }
                }
            });
        }
        // Co-Trainer-Historie: trackt, ob die AKTUELLE taktische Ausrichtung vom Co-Trainer
        // vorgeschlagen oder selbst gewählt wurde, und ob das jeweilige Spiel gewonnen wurde.
        if (matchResult !== null) {
            if (!game.coTrainerHistory) game.coTrainerHistory = { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 };
            if (game.lastTacticWasCoTrainerSuggestion) {
                game.coTrainerHistory.followedMatches++;
                if (matchResult === 'win') game.coTrainerHistory.followedWins++;
            } else {
                game.coTrainerHistory.ownMatches++;
                if (matchResult === 'win') game.coTrainerHistory.ownWins++;
            }
            // Das Vertrauen gleicht sich langsam an die TATSÄCHLICHE Erfolgsquote der
            // übernommenen Vorschläge an, statt nur durch Annehmen/Ignorieren zu schwanken -
            // ab einer aussagekräftigen Stichprobe (5+ Spiele) zieht die reale Bilanz mit.
            if (game.coTrainerHistory.followedMatches >= 5) {
                let actualWinRate = Math.round((game.coTrainerHistory.followedWins / game.coTrainerHistory.followedMatches) * 100);
                game.coTrainerTrust = Math.round((game.coTrainerTrust ?? 66) * 0.9 + actualWinRate * 0.1);
                game.coTrainerTrust = Math.max(10, Math.min(100, game.coTrainerTrust));
            }
        }

        let fitLoss = managerRPG.perks.fitnessGuru ? 6 : 9;
        // Athletik- & Konditionstrainer: -30% Fitnessverlust nach Spielen (war bisher nur
        // Text ohne tatsächliche Wirkung). Ernährungsberater (neu) stapelt zusätzlich obendrauf.
        if (staffMembers.fitCoach.hired) fitLoss = Math.round(fitLoss * 0.7);
        if (staffMembers.nutritionist.hired) fitLoss = Math.round(fitLoss * (0.92 - 0.04 * getStaffLevelMultiplier('nutritionist')));
        // Trainingsintensität-Regler (Training & Förderung): Hart beansprucht mehr, Locker schont.
        if (typeof getTrainingIntensityFitnessMultiplier === 'function') fitLoss = Math.round(fitLoss * getTrainingIntensityFitnessMultiplier());
        // Team-Trainingsschwerpunkt wirkt sich spürbar, aber begrenzt aus
        if (game.teamTraining === 'erholung') fitLoss = Math.max(3, fitLoss - 2);
        // Spielstil: Tempo & Pressing bestimmen den läuferischen Aufwand aller 8 Stile
        // einheitlich (siehe getTacticStyleFitnessMultiplier()), statt nur zweier Sonderfälle.
        fitLoss = Math.round(fitLoss * getTacticStyleFitnessMultiplier(game.tacticStyle));
        // Live-Zurufe Brechstange/Pressing: volle 90 Minuten kosten LIVE_SHOUT_FITNESS_COST extra (25.13).
        if (isLiveContext && currentMatch && currentMatch.kraftMinuten) {
            fitLoss += Math.round(LIVE_SHOUT_FITNESS_COST * Math.min(90, currentMatch.kraftMinuten) / 90);
            currentMatch.kraftMinuten = 0;
        }
        // Gegenpressing (Team-Anweisung, NEU): zusätzlicher Kraftaufwand oben drauf.
        if (typeof getTeamInstructionFitnessMultiplier === 'function') fitLoss = Math.round(fitLoss * getTeamInstructionFitnessMultiplier());
        // Wetter: Hitze laugt spürbar mehr aus, Regen/Schnee erhöhen v.a. das Verletzungsrisiko
        // (rutschiger Untergrund). Wird IMMER gewürfelt (siehe rollWeather()), unabhängig
        // davon, ob live gespielt oder automatisch simuliert wurde.
        fitLoss = Math.round(fitLoss * currentWeather.fitLossMult);
        // Reisemüdigkeit: bei Auswärtsspielen in den obersten beiden Ligen (weite,
        // bundesweite Fahrten statt kurzer Regionalfahrten) zusätzliche Ermüdung.
        // Bus statt Flugzeug verdoppelt normalerweise diesen Ermüdungs-Malus - ein
        // gesponserter Bus (busSponsorActive) gleicht das zur Hälfte wieder aus.
        // Bandensponsor-Variante mildert etwas weniger stark ab als ein waschechtes
        // Hauptsponsor-Sponsoring (bescheidenere Ausstattung).
        let busPenaltyMult = game.busSponsorActive ? (game.busSponsorViaBanden ? 1.75 : 1.5) : 2;
        if (!isHomeMatchParam && game.leagueLevel <= 1) fitLoss += (game.travelMode === 'bus') ? Math.round(3 * busPenaltyMult) : 3;
        let benchRecovery = game.teamTraining === 'kondition' ? 31 : 26;
        let individualBoostChance = game.teamTraining === 'technik' ? 0.20 : 0.15;
        // Trainingsintensität, Ausrüstungsstufe und Doppeltraining-Tag (Training & Förderung)
        // erhöhen bzw. verringern die Chance auf einen individuellen Trainingserfolg.
        if (typeof getTrainingIntensityBoostMultiplier === 'function') individualBoostChance *= getTrainingIntensityBoostMultiplier();
        individualBoostChance *= (1 + (game.equipmentLevel || 0) * 0.05);
        if (game.doubleTrainingBoostActive) { individualBoostChance *= 1.6; game.doubleTrainingBoostActive = false; }
        let injuryChance = game.teamTraining === 'erholung' ? 0.024 : 0.03;
        // Premium-Booster: Verletzungsschutz setzt das Risiko komplett auf 0,
        // Glücksbringer dämpft es stark.
        if (game.injuryShieldMatchdaysLeft > 0) injuryChance = 0;
        else if (game.luckyCharmNextMatch) injuryChance *= 0.4;
        // Verletzungspräventions-Programm (Training & Förderung): dauerhafte Grundrisiko-Senkung.
        if (game.injuryPreventionProgram) injuryChance *= 0.82;
        // Stadion-Erweiterungen: Medizinzentrum/Rasenpflege senken das Trainings-
        // Verletzungsrisiko - wirkt am heimischen Gelände, unabhängig vom letzten Spielort.
        if (typeof getStadiumInjuryReduction === 'function') injuryChance *= (1 - getStadiumInjuryReduction());
        // Rasenzustand: unabhängig von den festen Stadion-Erweiterungen oben - ein
        // gepflegtes Geläuf senkt das Risiko zusätzlich leicht, ein vernachlässigtes erhöht es.
        // Bei stadium.pitchCondition === 85 (Ausgangswert) ist der Faktor exakt neutral (1.0).
        if (typeof stadium !== 'undefined' && stadium.pitchCondition !== undefined) {
            injuryChance *= Math.max(0.9, Math.min(1.2, 1 + (85 - stadium.pitchCondition) / 85 * 0.25));
        }
        injuryChance *= currentWeather.injuryMult;
        if (game.tackleHardness === 'hart') injuryChance *= 1.3;
        if (game.tackleHardness === 'vorsichtig') injuryChance *= 0.75;
        if (game.trainingCampBuff && game.trainingCampBuff.matchesLeft > 0) injuryChance *= (1 - game.trainingCampBuff.injuryReduction);
        // Wochenplan-Risiko: ein überladener Trainingsplan ohne Erholungstage erhöht das
        // Verletzungsrisiko spürbar, ein ausgewogener Plan mit genug freien Tagen senkt es.
        if (typeof computeWeeklyTrainingStats === 'function') {
            let weeklyStats = computeWeeklyTrainingStats();
            injuryChance *= (1 + (weeklyStats.risk - 10) * 0.012);
        }
        if (typeof getTrainingIntensityInjuryFactor === 'function') injuryChance *= getTrainingIntensityInjuryFactor();

        let playedThisMatch = squad.filter(p => lineup.includes(p.id));

        // Moral reagiert auf das Ergebnis: Siege motivieren, Niederlagen drücken die Stimmung.
        let moraleShift = matchResult === 'win' ? 4 : (matchResult === 'loss' ? -6 : (matchResult === 'draw' ? -1 : 0));
        // Führungsspieler-Rat (Kabinen-Dynamik, NEU): ein starker Rat fängt schlechte
        // Stimmung nach Niederlagen etwas ab, ein schwacher verstärkt sie.
        if (matchResult === 'loss' && typeof getCouncilMoraleStabilizer === 'function') {
            moraleShift += getCouncilMoraleStabilizer();
        }
        // Der Manager selbst steht unter Druck: Niederlagen erhöhen den Stress, Siege entspannen etwas.
        let stressShift = matchResult === 'win' ? -1 : (matchResult === 'loss' ? 3 : (matchResult === 'draw' ? 1 : 0));
        // Eiserne Nerven (Krisenmanager-Perk, NEU): der Manager selbst bleibt auch unter
        // Druck spürbar gelassener.
        if (managerRPG.perks.ironNerves && stressShift > 0) stressShift = Math.round(stressShift * 0.5);
        if (game.teamTraining === 'matchprep') stressShift = Math.max(-1, stressShift - 1); // bessere Vorbereitung dämpft den Druck
        if (stressShift !== 0) privateLife.stress = Math.max(0, Math.min(100, (privateLife.stress || 0) + stressShift));

        // Job-Sicherheit: Ergebnisse wirken sich jetzt direkt auf die Vorstands-Stimmung aus,
        // statt (wie vorher) komplett wirkungslos zu bleiben. Anhaltend schlechte Stimmung
        // kann am Saisonende zur Entlassung führen (siehe checkSeasonEndSacking()).
        if (matchResult) {
            // Erwartungsabhängig (Langzeittest Phase 19.6): früher fest Sieg +2 / Remis -1 /
            // Niederlage -3 - ein Mittelfeldteam verlor so ~20 Punkte pro Saison und landete
            // zwangsläufig bei der Entlassung. Jetzt zählt, gegen wen: Pflichtsiege bringen wenig,
            // Punkte gegen stärkere Gegner viel.
            let erwartung = typeof getOwnMatchExpectation === 'function' ? getOwnMatchExpectation() : 'offen';
            let boardShift = {
                favorit: { win: 1, draw: -1, loss: -3 },
                offen: { win: 2, draw: 0, loss: -2 },
                aussenseiter: { win: 3, draw: 1, loss: -1 }
            }[erwartung][matchResult] ?? 0;
            // Ruhiger Pol (Krisenmanager-Perk, NEU): dämpft den Vertrauensverlust beim
            // Vorstand nach Niederlagen - der Manager bleibt auch in schwierigen Phasen
            // glaubwürdig.
            if (matchResult === 'loss' && managerRPG.perks.calmPresence) boardShift = Math.round(boardShift * 0.5);
            game.boardSat = Math.max(10, Math.min(100, game.boardSat + boardShift));
            checkJobSecurity();
            generatePressHeadline(matchResult, isHomeDerby);
            recordHomeAwayResult(isHomeMatchParam, matchResult);
            if (typeof consumeFanSupport === 'function') consumeFanSupport(isHomeMatchParam);
            checkBettingScandalSuspicion(matchResult, matchMargin);
            if (isLiveContext) checkPostMatchInterview(matchResult);
            checkJobOfferApproach({ live: isLiveContext });
            checkContractUltimatum();
        }
        checkFanRadioFeedback();
        checkAchievements();
        tickContractUltimatum();
        tickLoanedPlayers();
        checkLoanClubRelationshipMaintenance();
        tickPairChemistry();
        // Personal: Verträge, Zufriedenheit, Abwerbeversuche und Notfall-Ausfälle jeden
        // verarbeiteten Spieltag prüfen (unabhängig von Live/Batch-Kontext).
        if (typeof tickStaffContracts === 'function') {
            tickStaffContracts();
            tickStaffMorale();
            checkStaffPoachingAttempt();
            checkStaffEmergencyAbsence();
            tickStaffEmergencyLeave();
        }
        // Jugendakademie: Abwerbeversuche und Nationalmannschaftsberufungen jeden
        // verarbeiteten Spieltag prüfen.
        if (typeof checkYouthPoachingAttempt === 'function') {
            checkYouthPoachingAttempt();
            checkYouthNationalCallup();
        }
        if (typeof tickYouthProDecisions === 'function') tickYouthProDecisions();
        // Holding & Industrie: echte Marktpreis-Schwankungen und Konkurrenzfirmen-Aktivität
        // jeden verarbeiteten Spieltag.
        if (typeof tickRawMaterialPrices === 'function') {
            tickRawMaterialPrices();
            tickCompetitorFirms();
            tickAcquisitionOfferExpiry();
        }
        // Produktionsketten-Countdown jeden Spieltag herunterzählen.
        if (typeof tickProductionQueue === 'function') tickProductionQueue();
        // Merchandising: limitierte Edition und saisonale Kollektion jeden Spieltag prüfen.
        if (typeof tickLimitedEditionSales === 'function') {
            tickLimitedEditionSales();
            tickSeasonalCollectionExpiry();
        }
        // Scouting-Netzwerk 2.0: Countdown-Missionen und Beobachtungsliste jeden
        // Spieltag weiterentwickeln.
        if (typeof tickScoutingMissions === 'function') {
            tickScoutingMissions();
            tickWatchlist();
        }
        // Stadion-Baustellen jeden Spieltag weiterführen.
        if (typeof tickStadiumConstruction === 'function') tickStadiumConstruction();
        // Spieler des Monats jeden Spieltag prüfen (wird nur alle 4 SpT tatsächlich vergeben).
        if (typeof checkPlayerOfTheMonth === 'function') checkPlayerOfTheMonth();
        // Tagesform: schwankt jeden Spieltag neu, leicht durch Moral/Fitness beeinflusst
        // (wer in Form und ausgeruht ist, hat bessere Chancen auf einen guten Tag).
        squad.forEach(p => {
            let bias = ((p.morale || 50) - 50) * 0.15 + ((p.fitness || 100) - 80) * 0.1;
            p.dailyForm = Math.max(5, Math.min(95, Math.round(50 + bias + (Math.random() * 40 - 20))));
        });
        // Sponsoren-Zufriedenheit und Aktivierungs-Events jeden Spieltag.
        if (typeof tickSponsorLoyalty === 'function') {
            tickSponsorLoyalty(matchResult);
            checkSponsorActivationEvent();
            remindMissingMainSponsor();
        }
        // Block-spezifische Fan-Kultur jeden Spieltag weiterentwickeln.
        if (typeof tickBlockCultures === 'function') tickBlockCultures();
        // Fan-Zentrale: Cooldown herunterzählen, Traditionsverein-Status und kritischen
        // Fan-Brief prüfen - jeden verarbeiteten Spieltag, unabhängig von Live/Batch-Kontext.
        if (typeof fanCentralState !== 'undefined') {
            if (fanCentralState.scarfContestCooldown > 0) fanCentralState.scarfContestCooldown--;
            if (typeof checkTraditionClubStatus === 'function') checkTraditionClubStatus();
            if (typeof checkCriticalFanLetter === 'function') checkCriticalFanLetter();
        }
        // DFB-Lizenz: Frühwarnung an Spieltag 30 und laufende Nachfrist (js/season-end.js).
        if (typeof checkDfbLicenseDeadlines === 'function') checkDfbLicenseDeadlines();

        // Kabinen-Freundschaften (js/locker-room.js).
        if (typeof tickLockerFriendships === 'function') tickLockerFriendships();
        if (typeof tickSetPieceDrills === 'function') tickSetPieceDrills();
        if (typeof tickPreContracts === 'function') tickPreContracts();
        if (typeof tickRumors === 'function') tickRumors();

        squad.forEach(p => {
            // Stammspieler erholen sich unter der Woche teilweise (ein Viertel der Bank-Erholung):
            // Ermüdung baut sich über mehrere Spiele auf und Rotation bleibt wichtig, aber eine
            // unveränderte Startelf bricht nicht mehr nach vier Spielen auf zwei Drittel ein.
            if (lineup.includes(p.id)) p.fitness = Math.max(10, Math.min(100, p.fitness - fitLoss + Math.round(benchRecovery / 4)));
            else p.fitness = Math.min(100, p.fitness + benchRecovery);

            if (moraleShift !== 0) p.morale = Math.max(10, Math.min(100, (p.morale || 80) + moraleShift));
            if (managerRPG.perks.motivator) p.morale = Math.max(75, p.morale);

            // Individuelles Training verbessert jetzt gezielt die passende Fähigkeit,
            // statt immer nur pauschal die Gesamtstärke zu erhöhen.
            if (p.individualFocus && p.individualFocus !== 'allgemein' && Math.random() < individualBoostChance) {
                let statMap = { torschuss: 'shooting', passspiel: 'passing', zweikampf: 'defense', tempo: 'pace', torwart: 'defense' };
                let stat = statMap[p.individualFocus];
                if (stat) p[stat] = Math.min(99, (p[stat] || 60) + 1);
                p.strength = Math.min(99, p.strength + 1);
                // Ehrgeizige Spieler geben im Training noch eine Schippe drauf - kleine
                // Zusatzchance auf einen weiteren Trainingserfolg (war bisher komplett
                // unverkabelt, obwohl der Charakterzug längst existierte).
                if (p.character === 'Ehrgeizig' && Math.random() < 0.25) {
                    if (stat) p[stat] = Math.min(99, (p[stat] || 60) + 1);
                }
                // Trainingsplan-Synergie für junge Spieler: passt der Wochenplan-Schwerpunkt
                // zum individuellen Fokus des Spielers, entwickeln sich junge Talente (≤21
                // Jahre) noch etwas schneller - der Trainingsalltag zieht in dieselbe Richtung.
                if ((p.age || 30) <= 21 && typeof computeWeeklyTrainingStats === 'function') {
                    let weeklyDominant = computeWeeklyTrainingStats().dominant;
                    let focusMatchesWeekly = (weeklyDominant === 'technik' && (p.individualFocus === 'torschuss' || p.individualFocus === 'passspiel')) ||
                        (weeklyDominant === 'taktik' && (p.individualFocus === 'zweikampf' || p.individualFocus === 'torwart')) ||
                        (weeklyDominant === 'kondition' && p.individualFocus === 'tempo');
                    if (focusMatchesWeekly && Math.random() < 0.3) {
                        if (stat) p[stat] = Math.min(99, (p[stat] || 60) + 1);
                        p.strength = Math.min(99, p.strength + 1);
                    }
                }
            }
            // Elfmeter-Spezialisten-Training: statt einer regulären Fähigkeit wird hier über
            // die Saison gezielt ein verdeckter Erfolgsquoten-Bonus für Elfmeterschießen
            // trainiert (siehe shootPenalty() in europe.js), der zusätzlich zur echten
            // Trefferhistorie in die Schuss-Wahrscheinlichkeit einfließt.
            if (p.individualFocus === 'elfmeter' && Math.random() < individualBoostChance) {
                p.penaltyTrainingBonus = Math.min(0.15, (p.penaltyTrainingBonus || 0) + 0.01);
            }

            // Verletzungs-/Sperren-Countdown herunterzählen
            if ((p.injured || 0) > 0) p.injured--;
            if ((p.suspended || 0) > 0) p.suspended--;
        });

        // Neue Verletzungen/Sperren nur unter Spielern, die diesen Spieltag tatsächlich aufgelaufen sind.
        // Wer schon oft verletzt war, gilt als "verletzungsanfällig" und hat ein höheres
        // individuelles Risiko - ein sich selbst verstärkender Teufelskreis wie im echten Fußball.
        let refereeCardMultThisMatch = (matchResult && typeof getRefereeCardMult === 'function') ? getRefereeCardMult() : 1;
        let sperrenDurchSchiri = 0;
        playedThisMatch.forEach(p => {
            p.appearances = (p.appearances || 0) + 1;
            p.appearancesSeason = (p.appearancesSeason || 0) + 1;
            // Erfolgsbasierte Vertragsboni (js/bonusclauses.js): Tor- und Einsatzbonus prüfen -
            // goalsSeason ist zu diesem Zeitpunkt bereits für dieses Spiel aktualisiert.
            if (typeof checkMatchdayBonusClauses === 'function') checkMatchdayBonusClauses(p);
            // Bus statt Flugzeug ist unbequemer - kleiner Moraldämpfer bei Auswärtsfahrten
            // (gesponserter Bus mit besserer Ausstattung mildert das etwas ab).
            if (!isHomeMatchParam && game.travelMode === 'bus') p.morale = Math.max(10, p.morale - (game.busSponsorActive ? (game.busSponsorViaBanden ? 1.5 : 1) : 2));
            if ([50, 100, 150, 200, 250, 300].includes(p.appearances)) {
                p.morale = Math.min(100, p.morale + 8);
                game.fans = Math.min(100, game.fans + 2);
                addInboxMessage('vertrag', `🎉 Vereinsjubiläum: ${p.appearances}. Pflichtspiel!`, `${p.name} feiert sein ${p.appearances}. Pflichtspiel für den Verein - kleine Zeremonie vor dem Spiel, Moral- und Stimmungsschub für die ganze Mannschaft!`, 'screen-squad');
            }
            let individualInjuryChance = injuryChance * (1 + Math.min(2.5, (p.timesInjured || 0) * 0.18));
            // Wetterfest (neue Spieler-Eigenschaft): macht bei schlechtem Wetter einen Teil
            // des erhöhten Verletzungsrisikos wieder wett - unbeeindruckt von Regen/Schnee/Sturm.
            if (p.trait === 'Wetterfest' && currentWeather.injuryMult > 1) {
                individualInjuryChance = injuryChance * 1.0 * (1 + Math.min(2.5, (p.timesInjured || 0) * 0.18)) / currentWeather.injuryMult;
            }
            // Individuelle Schonung: verletzungsanfällige Spieler (2+ frühere Verletzungen)
            // werden vom Physio-Stab automatisch von den intensivsten Wochenplan-Einheiten
            // ausgenommen - das mildert den zusätzlichen Risikoaufschlag eines intensiven
            // Wochenplans gezielt für SIE persönlich ab, statt sie wie alle anderen voll
            // mitzubelasten.
            if ((p.timesInjured || 0) >= 2) individualInjuryChance *= 0.72;
            if (typeof getAgeInjuryFactor === 'function') individualInjuryChance *= getAgeInjuryFactor(p);
            if (typeof getChronicInjuryFactor === 'function') individualInjuryChance *= getChronicInjuryFactor(p);
            if (Math.random() < individualInjuryChance) {
                let baseDuration = Math.floor(Math.random() * 4) + 1; // 1-4 Spiele Ausfallzeit
                let reduction = 1 - (campusBuildings.reha.lvl * 0.08) - (staffMembers.physio.hired ? 0.5 : 0);
                reduction = Math.max(0.25, reduction); // Reha/Physio können Ausfallzeit nie unter 25% drücken
                p.injured = Math.max(1, Math.round(baseDuration * reduction));
                p.timesInjured = (p.timesInjured || 0) + 1;
                let fragileTag = p.timesInjured >= 3 ? ' ⚠️ Wird zunehmend verletzungsanfällig!' : '';
                addInboxMessage('verletzung', `${p.name} verletzt`, `Fällt für ${p.injured} Spiel(e) aus. (${p.timesInjured}. Verletzung in dieser Karriere)${fragileTag}`, 'screen-squad');
            } else if (Math.random() < 0.015 * refereeCardMultThisMatch) {
                p.suspended = 1; // Platzverweis/Gelb-Sperre: 1 Spiel Sperre
                sperrenDurchSchiri++;
                addInboxMessage('verletzung', `${p.name} gesperrt`, `Fällt für das nächste Spiel gesperrt aus.`, 'screen-squad');
            }
        });

        if (typeof recordRefereeMatch === 'function') {
            let liveRot = (isLiveContext && typeof currentMatch !== 'undefined' && currentMatch) ? currentMatch.sentOff.length : 0;
            recordRefereeMatch(matchResult, liveRot + sperrenDurchSchiri);
        }

        let cupRoundIdx = cupTournament.matchdays.indexOf(game.matchday);
        if (cupRoundIdx !== -1) simulateCupRound(cupRoundIdx, isLiveContext);

        // Landespokal: eigene Spieltage, damit er sich nicht mit dem DFB-Pokal beisst.
        if (typeof simulateLandesPokalRound === 'function') {
            let landesIdx = landesPokal.matchdays.indexOf(game.matchday);
            if (landesIdx !== -1) simulateLandesPokalRound(landesIdx, isLiveContext);
        }

        if (europeTournament.matchdays.includes(game.matchday)) {
            simulateEuropeMatchday(game.matchday, isLiveContext);
        }
        if (typeof resolveSupercup === 'function') resolveSupercup();
        // Ein live gespieltes Pokalergebnis gilt nur für diesen Spieltag.
        game.liveCupResult = null;

        // Länderspielpausen (js/national-team.js): feste Pausen, nachvollziehbare Nominierung.
        if (typeof tickInternationalBreak === 'function') tickInternationalBreak();

        if (underworld.pressure > 25) {
            let raidRoll = Math.random();
            if (raidRoll < (underworld.pressure - 20) * 0.008) {
                underworld.offenseCount = (underworld.offenseCount || 0) + 1;
                let fine = Math.min(game.money, Math.round(underworld.pressure * 1200));
                game.money = Math.max(0, game.money - fine);
                // Pressesprecher: dämpft den Image-Schaden bei Skandalen und schlechten
                // Ergebnissen spürbar ab (professionelles Krisenmanagement).
                let boardHit = staffMembers.pressOfficer.hired ? Math.round(15 * (0.85 - 0.1 * getStaffLevelMultiplier('pressOfficer'))) : 15;
                let fanHit = staffMembers.pressOfficer.hired ? Math.round(10 * (0.85 - 0.1 * getStaffLevelMultiplier('pressOfficer'))) : 10;
                game.boardSat = Math.max(10, game.boardSat - boardHit);
                game.fans = Math.max(game.fanBaseFloor, game.fans - fanHit);
                underworld.pressure = Math.max(0, underworld.pressure - 30);
                let raidMsg = `🚨 DFB-RAZZIA! Die Staatsanwaltschaft durchsucht die Geschäftsstelle.\nStrafe: -${formatVal(fine)} & drastischer Image-Verlust!`;
                // Wiederholungstäter werden vom Verband hart bestraft: echter Punktabzug
                if (underworld.offenseCount >= 2) {
                    let myTeam = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
                    let deduction = Math.min(myTeam.points, 3 * (underworld.offenseCount - 1));
                    myTeam.points -= deduction;
                    raidMsg += `\n⚖️ Als Wiederholungstäter (${underworld.offenseCount}. Vergehen) verhängt der Verband zusätzlich einen Punktabzug von ${deduction} Punkten!`;
                }
                showNotice('🚨 DFB-Razzia', raidMsg, { typ: 'warn' });
            }
        }

        // Ausschreitungen: nur relevant, wenn wir gerade ein Heim-Derby ausgetragen haben
        if (isHomeDerby) checkHooliganIncident();
        // Ordner-Kosten (echte Abbuchung): bisher wurde nur im Finanz-Ausblick ein
        // Betrag angezeigt, aber nie wirklich abgebucht - ein weiterer "Phantom-Posten".
        if (typeof tickStewardCosts === 'function') tickStewardCosts(isHomeMatchParam);
        if (typeof runSecChiefAutomation === 'function') runSecChiefAutomation();
        // Immobilien-Portfolio: laufende Mieteinnahmen unabhängig von Heim-/Auswärtsspiel.
        if (typeof tickRealEstateIncome === 'function') tickRealEstateIncome();
        if (typeof tickWomenTeam === 'function') tickWomenTeam();
        // Monatliche Ticks (alle 4 Spieltage ≈ 1 Monat): runMonthlyClubTicks().
        if (game.matchday % 4 === 0) runMonthlyClubTicks();
        if (typeof tickXpDoublerDuration === 'function') tickXpDoublerDuration();
        if (typeof checkReleaseClauseTriggers === 'function') checkReleaseClauseTriggers();
        if (typeof tickIncomingLoans === 'function') tickIncomingLoans();
        // Jugendliga: alle 4 Spieltage ein automatisches Jugendliga-Spiel.
        if (game.matchday % 4 === 0 && typeof tickYouthLeague === 'function') tickYouthLeague();
        if (typeof checkSellOnClausePayouts === 'function') checkSellOnClausePayouts();
        if (typeof tickSkillTraining === 'function') tickSkillTraining();
        // Trainingsstab-Automatik (Premium) und Spieltagsroutine der zweiten Mannschaft -
        // haengen bewusst hier, damit sie auch beim Durchsimulieren ganzer Saisons greifen.
        if (typeof runTrainingAutopilotTick === 'function') runTrainingAutopilotTick();
        if (typeof tickSecondTeamRoutine === 'function') tickSecondTeamRoutine();
        if (typeof rollOfficeEvent === 'function') rollOfficeEvent();
        // Weitere Premium-Booster-Countdowns.
        if (game.injuryShieldMatchdaysLeft > 0) game.injuryShieldMatchdaysLeft--;
        if (game.sponsorBoostMatchdaysLeft > 0) game.sponsorBoostMatchdaysLeft--;

        // Kreditraten, Insolvenzrisiko und Wettabrechnung laufen jeden Spieltag automatisch
        processLoanInstallments();
        checkInsolvencyRisk();
        resolveBetIfPending(matchResult, totalGoalsForBets);
        processPrivateLifeMatchday();

        // Dopingtest: nur relevant, wenn im letzten Spiel gedopt wurde
        if (underworld.activeSabotages.doping && Math.random() < 0.25) {
            let candidates = squad.filter(p => lineup.includes(p.id) && (p.suspended || 0) === 0);
            if (candidates.length > 0) {
                let culprit = candidates[Math.floor(Math.random() * candidates.length)];
                culprit.suspended = 2; // Dekrement für diese Runde ist bereits gelaufen -> exakt 2 Spiele Sperre
                let fine = Math.min(game.money, 40000);
                game.money = Math.max(0, game.money - fine);
                game.fans = Math.max(game.fanBaseFloor, game.fans - 15);
                underworld.pressure = Math.min(100, underworld.pressure + 30);
                showNotice('☠️ Positiver Dopingtest', `${culprit.name} wurde positiv getestet und für zwei Spiele gesperrt.\n\nSkandal-Strafe: ${formatVal(fine)}. Die Fans sind entsetzt.`, { typ: 'warn' });
            }
        }

        underworld.activeSabotages = { pyroHotel: false, stealBanner: false, weedKiller: false, refBribe: false, bribeOpponent: false, doping: false };

        updateCommodityMarket();
        updateStockMarket();
        // Kapitalmarkt-Zusatzfunktionen: Limit-Orders, Sparplan, Optionsscheine, Insider-Tipp
        // und Portfolio-Meilensteine jeden Spieltag prüfen.
        if (typeof checkLimitOrders === 'function') {
            checkLimitOrders();
            tickSavingsPlan();
            resolveLeveragedOptions();
            checkInsiderTip();
            checkPortfolioMilestones();
        }
        checkIncomingTransferOffers();
        if (typeof tickTransferMarketRotation === 'function') tickTransferMarketRotation();
        tickContractDurations();
        checkIncomingSponsorOffers();
        checkIncomingKitOffers();
        checkIncomingBandenOffers();
        checkIncomingSleeveOffers();
        runFanshopManagerTasks();
        // Erweiterte Personal-Automatisierung: Chef-Scout, Sportdirektor,
        // Marketing-Direktor, Standards-Spezialist.
        if (typeof runScoutAutomation === 'function') {
            runScoutAutomation();
            runSportDirAutomation();
            runMarketingDirAutomation();
            runSetPieceCoachAutomation();
        }
        runCoTrainerAutoAssignment();
        runFitCoachAutoAssignment();
        applyFanLiaisonPassiveEffect();
        runFanLiaisonAutoPricing();

        if (typeof tickTransferWindows === 'function') tickTransferWindows();
        if (typeof tickSeasonEvents === 'function') tickSeasonEvents();
        if (typeof tickCoachBounce === 'function') tickCoachBounce();

        // Trainingslager-Bonus zählt jeden verarbeiteten Spieltag herunter (gilt in allen
        // drei Spieltag-Pfaden, da processPostMatchRoutine() von allen dreien aufgerufen wird).
        if (game.trainingCampBuff && game.trainingCampBuff.matchesLeft > 0) {
            game.trainingCampBuff.matchesLeft--;
            if (game.trainingCampBuff.matchesLeft === 0) {
                addInboxMessage('vertrag', '📉 Trainingslager-Effekt ausgelaufen', `Der Bonus aus dem ${game.trainingCampBuff.campName} ist ausgelaufen.`, 'screen-calendar');
                // Wochenplan nach Ablauf des Lagers auf den vorherigen, normalen Plan zurücksetzen.
                if (game.preCampWeeklyPlan) {
                    game.weeklyTrainingPlan = { ...game.preCampWeeklyPlan };
                    game.preCampWeeklyPlan = null;
                    if (typeof computeWeeklyTrainingStats === 'function') game.teamTraining = computeWeeklyTrainingStats().mappedTeamTraining;
                }
            }
        }

        if (typeof recordLeagueRankHistory === 'function') recordLeagueRankHistory();
        game.matchday++;
        game.viewingMatchday = Math.min(34, game.matchday);
        // Wintergespräch (js/winter-talk.js): nach Spieltag 20 ohne Gespräch -> verpasst.
        if (typeof tickWinterTalk === 'function') tickWinterTalk();
        if (typeof tickTransferStrategy === 'function') tickTransferStrategy();
        if (typeof maybeAutoSave === 'function') maybeAutoSave();
        updateUI();
    }

    // Alle 4 Spieltage (≈ 1 Monat) aus processPostMatchRoutine(): monatliche Ticks der
    // Feature-Systeme und die Aktiendividende. Neue Monats-Ticks gehören HIERHER.
    function runMonthlyClubTicks() {
        setzeBuchungskontext('📅 Monatliche Vereinsposten');
        if (typeof migrateLegacyCoSponsors === 'function') migrateLegacyCoSponsors();
        if (typeof tickBoardRoom === 'function') tickBoardRoom();
        if (typeof tickYouthDevelopment === 'function') tickYouthDevelopment();
        if (typeof tickYouthBreakthroughs === 'function') tickYouthBreakthroughs();
        if (typeof tickYouthOffers === 'function') tickYouthOffers();
        if (typeof tickMediaDepartment === 'function') tickMediaDepartment();
        if (typeof cleanupRemovedModuleState === 'function') cleanupRemovedModuleState();
        if (typeof tickSeasonObjectives === 'function') tickSeasonObjectives();
        if (typeof tickTeamCouncil === 'function') tickTeamCouncil();
        if (typeof tickLockerRoom === 'function') tickLockerRoom();
        if (typeof tickCoachCarousel === 'function') tickCoachCarousel();
        if (typeof tickMemberAssembly === 'function') tickMemberAssembly();
        if (typeof recordFinancialMonth === 'function') recordFinancialMonth();
        // Aktiendividende: dividendRate ist ein Jahressatz, ausgezahlt wird monatlich 1/8,5
        // davon; breit gestreute Portfolios bekommen einen kleinen Aufschlag.
        setzeBuchungskontext('📈 Dividenden');
        let diversificationBonus = typeof getDiversificationBonus === 'function' ? getDiversificationBonus() : 0;
        game.money += Math.round(STOCK_KEYS.reduce((sum, key) => {
            let st = stockMarket[key];
            return st ? sum + (st.owned * st.price * (st.dividendRate + diversificationBonus) / 8.5) : sum;
        }, 0));
        loescheBuchungskontext();
    }

    function applyFormWalk(team) {
        // Rückwärtskompatibilität: alte Speicherstände kennen baseStrength noch nicht
        if (typeof team.baseStrength !== 'number') team.baseStrength = team.strength;
        if (!Array.isArray(team.recentForm)) team.recentForm = [];
        let delta = Math.floor(Math.random() * 5) - 2; // -2 bis +2 pro Spieltag
        let min = team.baseStrength - 8, max = team.baseStrength + 8;
        team.strength = Math.max(min, Math.min(max, team.strength + delta));
    }

    function pushRecentForm(team, result) {
        if (!Array.isArray(team.recentForm)) team.recentForm = [];
        team.recentForm.push(result);
        if (team.recentForm.length > 5) team.recentForm.shift();
    }

    function updateLeagueTable(lvl, f) {
        let teams = leaguesData[lvl];
        let h = teams[f.home], a = teams[f.away];
        if (!h || !a) return;
        h.played++; a.played++;
        h.goalsFor += f.homeGoals; h.goalsAgainst += f.awayGoals;
        a.goalsFor += f.awayGoals; a.goalsAgainst += f.homeGoals;
        if (f.homeGoals > f.awayGoals) { h.won++; h.points += 3; a.lost++; pushRecentForm(h, 'W'); pushRecentForm(a, 'L'); }
        else if (f.homeGoals < f.awayGoals) { a.won++; a.points += 3; h.lost++; pushRecentForm(h, 'L'); pushRecentForm(a, 'W'); }
        else { h.drawn++; h.points += 1; a.drawn++; a.points += 1; pushRecentForm(h, 'D'); pushRecentForm(a, 'D'); }
        if (typeof recordLeagueHomeAway === 'function') recordLeagueHomeAway(h, a, f);
        if (typeof creditAiLeagueGoals === 'function') { creditAiLeagueGoals(h, f.homeGoals); creditAiLeagueGoals(a, f.awayGoals); }

        // Kopf-an-Kopf-Statistik: historische Bilanz gegen JEDEN Ligagegner - nur relevant,
        // wenn der eigene Verein an dem Spiel beteiligt war.
        if (h.name === game.clubName || a.name === game.clubName) {
            let oppName = h.name === game.clubName ? a.name : h.name;
            let ourGoals = h.name === game.clubName ? f.homeGoals : f.awayGoals;
            let oppGoals = h.name === game.clubName ? f.awayGoals : f.homeGoals;
            if (!game.headToHeadRecords[oppName]) game.headToHeadRecords[oppName] = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, lastResults: [] };
            let rec = game.headToHeadRecords[oppName];
            rec.goalsFor += ourGoals; rec.goalsAgainst += oppGoals;
            if (ourGoals > oppGoals) rec.wins++; else if (ourGoals < oppGoals) rec.losses++; else rec.draws++;
            rec.lastResults.unshift(`${ourGoals}:${oppGoals}`);
            if (rec.lastResults.length > 5) rec.lastResults.pop();
        }

        // Formkurve: Teamstärke schwankt leicht (begrenzt) um ihren Basiswert -
        // Gegner haben so gute und schlechte Phasen, statt eine fixe Zahl zu sein.
        applyFormWalk(h);
        applyFormWalk(a);
    }

    // ---------- JOB-SICHERHEIT ----------
