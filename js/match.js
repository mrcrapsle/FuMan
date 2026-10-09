
    // currentMatch/substitutionsLeft: waren bisher nirgends deklariert (nur per Zuweisung
    // ohne let/var/const entstandene implizite globale Variablen) - ESLint (siehe
    // package.json "lint") meldete das korrekt als no-undef. Funktional identisch (beides
    // landet im globalen Scope), aber ein Tippfehler bei einer Zuweisung würde jetzt sofort
    // auffallen statt lautlos eine neue, nie gelesene Variable zu erzeugen.
    // Wetter (WEATHER_TYPES/currentWeather/rollWeather) wurde nach js/weather.js
    // ausgelagert - reine Datei-Organisation, keine Verhaltensänderung.
    let currentMatch = null;
    let substitutionsLeft = 0;

    // Zusätzlicher Fitnessverlust der Startelf für 90 Minuten Brechstange/Pressing (anteilig).
    const LIVE_SHOUT_FITNESS_COST = 8;
    function setLiveShout(shout) {
        playSound('click');
        activeLiveShout = shout;
        ['standard', 'brechstange', 'bus', 'pressing'].forEach(s => {
            let el = document.getElementById('shout-' + s);
            if (el) el.className = (s === shout) ? 'btn-action' : 'btn-secondary';
        });
        document.getElementById('ticker-log').innerHTML += `<div style="color:var(--gold);">📣 Trainer-Anweisung: <strong>${shout.toUpperCase()}</strong> ausgegeben!</div>`;
    }

    // Wendet aktive Unterwelt-Sabotagen konsistent auf die gegnerische Stärke an -
    // wichtig: muss überall verwendet werden, wo Gegnerstärke berechnet wird
    // (Liga-Simulation, Admin-Schnellvorlauf, Live-Match), sonst wirken Sabotagen
    // nur im interaktiven Modus statt in jedem Simulationsmodus.
    // Heimvorteil auch für den Gegner (Phase 25.11): die eigene Elf bekam daheim +3 über
    // calcTeamStrength(), KI-Teams spielten auch zuhause mit ihrem nackten Stärkewert - eine
    // ligaübliche Elf spielte dadurch wie +9 und wurde fast jede zweite Saison Meister.
    const AI_HOME_ADVANTAGE = 3;
    const TRAIT_BONUS_CAP = 3;
    function getOpponentMatchStrength(oppStr, oppIsHome) {
        return applySabotageToOpponentStrength(oppStr) + (oppIsHome ? AI_HOME_ADVANTAGE : 0);
    }
    function applySabotageToOpponentStrength(oppStr) {
        if (underworld.activeSabotages.pyroHotel) oppStr = Math.max(30, oppStr - 5);
        if (underworld.activeSabotages.weedKiller) oppStr = Math.max(30, oppStr - 4);
        if (underworld.activeSabotages.bribeOpponent) oppStr = Math.max(30, oppStr - 7);
        return oppStr;
    }

    // Zentrale, einmal definierte Bonuswerte für Spielstil & Zweikampfhärte - werden sowohl
    // in calcTeamStrength() (Saison-/Vorschau-Werte) als auch LIVE während des Spiels
    // (simulateMatchStep()) verwendet, damit Taktikänderungen mitten im Match sofort wirken.
    // Spielstile 2.0: 8 statt 3 Optionen, jeweils mit Tempo/Pressing-Werten, aus denen
    // sich Teamstärke-Bonus UND Fitnessverlust ableiten (siehe getTacticStyleBonus() und
    // getTacticStyleFitnessMultiplier() unten) - vorher nur 3 feste Sonderfälle.
    // Formations-Bewertungen (FORMATION_RATINGS) sind bereits in squad.js definiert.
    const TACTIC_STYLE_CONFIG = {
        ballbesitz: { label: 'Ballbesitz', tempo: 42, press: 58, desc: 'Ruhig und sauber von hinten heraus. Sicherer Ballbesitz, aber gegen hohes Pressing ein gefährliches Spiel mit dem Feuer.' },
        konter: { label: 'Konterfußball', tempo: 64, press: 26, desc: 'Tief stehen und auf den Umschaltmoment lauern - schnell und effizient nach Ballgewinn.' },
        pressing: { label: 'Pressing', tempo: 68, press: 88, desc: 'Volles Risiko: hohes Anlaufen erzwingt Fehler, kostet aber massiv Kraft.' },
        kickrush: { label: 'Kick and Rush', tempo: 78, press: 60, desc: 'Kurzer Prozess: schnell nach vorne, wenig Schnickschnack.' },
        ausgeglichen: { label: 'Ausgeglichen', tempo: 50, press: 50, desc: 'Ausgewogener Ansatz ohne besondere Vor-/Nachteile.' },
        defensiv: { label: 'Defensiv', tempo: 36, press: 20, desc: 'Kompakt und kräfteschonend, dafür wenig offensive Durchschlagskraft.' },
        offensiv: { label: 'Offensiv', tempo: 68, press: 72, desc: 'Mehr Durchschlagskraft, aber die Mannschaft ermüdet spürbar schneller.' },
        umschaltspiel: { label: 'Umschaltspiel', tempo: 72, press: 62, desc: 'Blitzschnelles Umschalten in beide Richtungen - anstrengend, aber effektiv.' }
    };

    function getTacticStyleBonus(style) {
        let cfg = TACTIC_STYLE_CONFIG[style] || TACTIC_STYLE_CONFIG.ausgeglichen;
        // Höheres Tempo & Pressing bedeuten mehr Durchschlagskraft, aber auf Kosten der
        // Fitness (siehe fitLoss-Anwendung weiter unten) - eine reine Zahlen-Ableitung aus
        // Tempo/Press statt einer festen Handvoll Spezialfälle wie zuvor.
        return Math.round(((cfg.tempo - 50) + (cfg.press - 50)) / 25);
    }
    function getTacticStyleFitnessMultiplier(style) {
        let cfg = TACTIC_STYLE_CONFIG[style] || TACTIC_STYLE_CONFIG.ausgeglichen;
        return 1 + ((cfg.tempo - 50) + (cfg.press - 50)) / 400; // z.B. Pressing (68/88): 1+ (18+38)/400 = 1.14
    }
    // Formations-Bonus: Off-Wert erhöht die Angriffsdurchschlagskraft, Def-Wert
    // stabilisiert (siehe Verwendung in match.js für den defensiven Gegenpart).
    function getFormationOffBonus() {
        let r = FORMATION_RATINGS[game.formation] || { off: 60 };
        return (r.off - 60) * 0.04;
    }
    function getFormationDefBonus() {
        let r = FORMATION_RATINGS[game.formation] || { def: 60 };
        return (r.def - 60) * 0.04;
    }
    function getTackleHardnessBonus(level) { return level === 'hart' ? 1.5 : (level === 'vorsichtig' ? -1 : 0); }

    // ---------- EINGESPIELTHEIT ZWISCHEN SPIELERPAAREN ----------
    // Trackt, wie oft je zwei Spieler GEMEINSAM in der Startelf standen - je länger zwei
    // Spieler zusammenspielen, desto eingespielter (bis zu einem Deckel), was einen kleinen
    // Team-Stärke-Bonus gibt. Wird jeden Spieltag für die aktuelle Aufstellung aktualisiert.
    function tickPairChemistry() {
        if (!game.pairChemistry) game.pairChemistry = {};
        let onPitch = lineup.filter(id => squad.some(p => p.id === id));
        for (let i = 0; i < onPitch.length; i++) {
            for (let j = i + 1; j < onPitch.length; j++) {
                let key = [onPitch[i], onPitch[j]].sort().join('_');
                game.pairChemistry[key] = Math.min(30, (game.pairChemistry[key] || 0) + 1);
            }
        }
    }
    // Durchschnittliche Eingespieltheit der aktuellen Startelf in Prozent (0-100), sowie ein
    // kleiner Team-Stärke-Bonus (0 bis +3) daraus abgeleitet.
    function getLineupChemistryStats() {
        let onPitch = lineup.filter(id => squad.some(p => p.id === id));
        if (onPitch.length < 2) return { percent: 0, bonus: 0, pairs: [] };
        let pairs = [];
        let total = 0, count = 0;
        for (let i = 0; i < onPitch.length; i++) {
            for (let j = i + 1; j < onPitch.length; j++) {
                let key = [onPitch[i], onPitch[j]].sort().join('_');
                let val = (game.pairChemistry && game.pairChemistry[key]) || 0;
                total += val; count++;
                pairs.push({ a: onPitch[i], b: onPitch[j], value: val });
            }
        }
        let percent = count > 0 ? Math.round((total / count / 30) * 100) : 0;
        let bonus = Math.round((percent / 100) * 3);
        return { percent, bonus, pairs };
    }

    function calcTeamStrength(isHomeMatch = false) {
        if (lineup.length < 11) autoLineup();
        let starting = squad.filter(p => lineup.includes(p.id));
        if (starting.length === 0) return 50;

        let sum = starting.reduce((acc, p) => acc + p.strength * (p.fitness / 100) * (0.9 + (p.dailyForm ?? 50) / 500), 0);
        let bonus = licenseConfig[privateLife.license].boost + (staffMembers.coTrainer.hired ? 2 * getStaffLevelMultiplier('coTrainer') * getStaffEffectivenessMultiplier('coTrainer') : 0) + (isHomeMatch ? 3 : 0);
        // Head-Greenkeeper: perfekt gepflegter Rasen gibt bei Heimspielen einen spürbaren
        // Vorteil (war bisher nur Text ohne tatsächliche Wirkung), skaliert mit Ausbaustufe.
        if (isHomeMatch && staffMembers.greenkeeper.hired) bonus += 2 * getStaffLevelMultiplier('greenkeeper');
        // Trainingsgelände mit Flutlicht (Campus): permanenter Stärkebonus für die gesamte
        // Mannschaft, unabhängig vom Spielort (war bisher nur Text ohne tatsächliche Wirkung).
        bonus += (campusBuildings.trainingground?.lvl || 0) * 1;
        // Personal-Synergie "Perfekte Vorbereitung": Co-Trainer + Chef-Analyst zusammen.
        if (typeof getActiveStaffSynergies === 'function' && getActiveStaffSynergies().some(s => s.bonusKey === 'strength')) bonus += 1;
        // Video-Analyse-Trainingseinheit (Training & Förderung): einmaliger Vorbereitungsbonus.
        if (game.videoAnalysisBoostActive) bonus += 2;

        // Auswärtsfans: die Größe des mitreisenden Fanblocks (abhängig von Fan-Zufriedenheit)
        // gibt bei Auswärtsspielen einen kleinen Rückhalt - eine gut gefüllte Kurve motiviert
        // auch fernab der Heimat.
        if (!isHomeMatch) {
            bonus += (game.fans / 100) * 1.5;
            // Fanbus-Programm (Fan-Zentrale) verstärkt diesen Auswärts-Rückhalt zusätzlich.
            if (typeof fanCentralState !== 'undefined' && fanCentralState.fanBusProgramActive) bonus += 1.5;
        }

        // Eingespieltheit: Spielerpaare, die schon oft zusammen aufgelaufen sind, geben einen
        // kleinen, aber spürbaren Team-Stärke-Bonus (bis zu +3 bei maximaler Eingespieltheit).
        bonus += getLineupChemistryStats().bonus;
        // Kabinen-Dynamik: Cliquenbildung und Führungsspieler-Rat wirken sich auf die
        // Team-Stärke aus.
        if (typeof getCliqueChemistryModifier === 'function') bonus += getCliqueChemistryModifier();
        if (typeof getCouncilMoraleStabilizer === 'function') bonus += getCouncilMoraleStabilizer() * 0.3;

        if (underworld.activeSabotages.stealBanner && isHomeMatch) bonus += 3;
        if (managerRPG.perks.tactician) bonus += 3;

        // Spieler-Traits wirken sich auf die Teamstärke aus - unabhängig vom Simulationsmodus
        // (also auch bei "Saison durchsimulieren", nicht nur im Live-Spiel).
        // Zusammen höchstens +3 (Phase 25.11): eine Startelf mit 6-9 Trait-Spielern sammelte
        // +5 bis +7, KI-Teams haben nichts Vergleichbares.
        let traitBonus = 0;
        if (starting.some(p => p.trait === 'Leader')) traitBonus += 2;
        if (starting.some(p => p.trait === 'Tor-Instinkt')) traitBonus += 1.5;
        if (starting.some(p => p.trait === 'Freistoß-Gott')) traitBonus += 1;
        if (starting.some(p => p.trait === 'Elfmeter-Killer' && p.pos === 'TW')) traitBonus += 1.5;
        if (starting.some(p => p.trait === 'Eisenfuß')) traitBonus += 1;
        if (starting.some(p => p.trait === 'Flügelflitzer')) traitBonus += 1;
        if (starting.some(p => p.trait === 'Zweikampfmonster')) traitBonus += 1.5;
        // Wetterfest: gibt bei schlechtem Wetter (Regen/Schnee/Sturm/Hitze) einen kleinen
        // Extra-Bonus, unbeeindruckt von den Bedingungen zu bleiben.
        if (currentWeather.goalMult < 1 && starting.some(p => p.trait === 'Wetterfest')) traitBonus += 1.5;
        bonus += Math.min(TRAIT_BONUS_CAP, traitBonus);
        // Block-spezifische Fan-Kultur: tief verwurzelte Block-Kulturen geben bei
        // Heimspielen einen kleinen zusätzlichen Atmosphäre-Bonus.
        if (isHomeMatch && typeof getBlockCultureHomeBonus === 'function') bonus += getBlockCultureHomeBonus();
        // Stadion-Erweiterungen: Beschallungsanlage verstärkt den Heimvorteil.
        if (isHomeMatch && typeof getStadiumHomeAdvantageBonus === 'function') bonus += getStadiumHomeAdvantageBonus();
        // Fan-Aktionen (Choreo heim, Sonderzug auswärts), siehe runFanAction() in fans.js.
        if (typeof getFanSupportBonus === 'function') bonus += getFanSupportBonus(isHomeMatch);
        // Kapitän: war bisher rein kosmetisch (nur ein Ⓒ-Icon) - steht der ernannte
        // Kapitän tatsächlich auf dem Feld, gibt seine Führungsqualität einen kleinen, aber
        // echten Team-Stärke-Bonus. Ein erfahrener Kapitän (30+) wirkt sich stärker aus.
        let captainOnPitch = starting.find(p => p.id === game.captainId);
        if (captainOnPitch) bonus += (captainOnPitch.age || 25) >= 30 ? 2 : 1.2;

        // Moral wirkt sich leicht auf die Tagesform aus - eine hochmotivierte Mannschaft
        // spielt über ihrem Stärkewert, eine demotivierte darunter.
        let avgMorale = starting.reduce((acc, p) => acc + (p.morale || 80), 0) / starting.length;
        bonus += (avgMorale - 80) * 0.06;

        // Ein überlasteter Manager trifft schlechtere Entscheidungen am Spieltag.
        bonus -= (privateLife.stress || 0) * 0.03;

        // Team-Trainingsschwerpunkt: Taktik bringt sicher +2. Match-Prep wirkt nur gegen den
        // vorbereiteten Gegnerstil (js/match-prep.js, in getOwnLeagueMatchStrength/setupMatch).
        if (game.teamTraining === 'taktik') bonus += 2;

        // Spielstil: Offensiv riskiert mehr für mehr Durchschlagskraft, Defensiv ist solider.
        bonus += getTacticStyleBonus(game.tacticStyle);
        // Formations-Bonus: Off-Wert der gewählten Formation erhöht die Angriffs-
        // durchschlagskraft, siehe FORMATION_RATINGS in squad.js.
        bonus += getFormationOffBonus();
        // Team-Anweisungen: Gegenpressing/Tief stehen/Hohe Außenverteidiger wirken sich
        // zusätzlich zu Formation und Spielstil aus, unabhängig kombinierbar.
        if (typeof getTeamInstructionBonus === 'function') bonus += getTeamInstructionBonus();

        // Zweikampfhärte: robusteres Auftreten bringt etwas Durchschlagskraft, riskiert
        // aber mehr Karten/Verletzungen (siehe checkMatchEvent()/processPostMatchRoutine()).
        bonus += getTackleHardnessBonus(game.tackleHardness);

        // Trainingslager-Team-Chemie-Bonus (zeitlich begrenzt, siehe bookTrainingCamp())
        if (game.trainingCampBuff && game.trainingCampBuff.matchesLeft > 0) bonus += game.trainingCampBuff.strengthBonus;

        // Doping: erheblicher, aber riskanter Kurzzeit-Boost (siehe Dopingtest nach dem Spiel)
        if (underworld.activeSabotages.doping) bonus += 8;

        // Spielerrollen: eine zur Stärke des Spielers passende Rolle bringt einen kleinen Bonus,
        // eine unpassend gewählte Rolle bringt nichts - echte taktische Feinabstimmung.
        starting.forEach(p => {
            if (!p.role) return;
            let roleDef = (PLAYER_ROLES[p.pos] || []).find(r => r.id === p.role);
            if (roleDef && (p[roleDef.statKey] || 0) >= p.strength) bonus += 0.8;
        });

        return Math.max(1, Math.round((sum / Math.max(11, starting.length)) + bonus));
    }

    let pendingMatchInfo = null;

    function getOpponentPlaystyle(name) {
        // Bugfix: zeigte bisher nur einen aus dem Vereinsnamen gehashten Zufallstext ohne
        // jeden Bezug zum tatsächlichen Spielverhalten - jetzt der echte, simulationswirksame
        // Spielstil (siehe AI_PLAYSTYLES/getTeamPlaystyle() in leagues.js).
        let team = (leaguesData[game.leagueLevel] || []).find(t => t.name === name);
        return team ? getTeamPlaystyle(team).label : 'Unbekannt';
    }

    function renderPreMatchAnalysis(oppObj, oppName) {
        let box = document.getElementById('prematch-analysis-box');
        if (!box) return;
        if (!staffMembers.analyst.hired && !underworld.spyIntelActive) {
            box.innerHTML = `<div class="box" style="font-size:10px; color:#64748b;">📋 Ohne Chef-Analyst bleibt die gegnerische Spielweise unbekannt. (Personal-Abteilung → Chef-Analyst einstellen)</div>`;
            return;
        }
        let form = (oppObj && oppObj.recentForm) ? oppObj.recentForm.slice(-5) : [];
        let formStr = form.length > 0 ? form.map(r => r === 'W' ? '🟢' : (r === 'D' ? '🟡' : '🔴')).join(' ') : 'Keine Daten';
        let baseStr = oppObj ? oppObj.strength : 60;
        // Gefährlichster Spieler = der echte Star des Gegners (team.star, js/ai-clubs.js) bzw.
        // seine Sturmspitze - vorher bei jedem Öffnen ein neu ausgewürfelter Name samt Position.
        // Der Analyst schätzt die Stärke auf 5 Punkte genau, der Spion kennt sie exakt.
        let star = oppObj && (oppObj.star || oppObj.striker);
        let dangerLine = 'Gefährlichster Spieler: <strong>unbekannt</strong>';
        if (star) {
            let staerke = star.strength || Math.min(99, baseStr + 3);
            let wert = underworld.spyIntelActive ? `Stärke ${staerke}` : `Stärke ca. ${Math.round(staerke / 5) * 5}`;
            dangerLine = `Gefährlichster Spieler: <strong>${star.name}</strong> (${star.pos || 'ST'}, ${wert}${star.goals ? `, ${star.goals} Saisontore` : ''})`;
        }

        // Videoanalyse bei Derby und Pokal: Grundausrichtung des Gegners und der Stil, der sie
        // im Taktik-Duell schlägt (js/opponent-tactics.js) - vorher zwei Zufallssätze ohne
        // Bezug zum Spiel, und mit Europapokal-Teilnahme galt jedes Ligaspiel als Topspiel.
        let isImportantMatch = isDerbyOpponent(oppName) || !!(pendingMatchInfo && pendingMatchInfo.cupTie);
        let spyNote = underworld.spyIntelActive ? `<div style="margin-top:6px; font-size:10px; color:#f97316;">🕵️ <strong>Insider-Info aktiv:</strong> Diese Analyse stammt von einem bezahlten Informanten im gegnerischen Verein und ist garantiert zuverlässig.</div>` : '';
        let videoAnalysisHtml = '';
        if (isImportantMatch && oppObj && typeof AI_STYLE_ARCHETYPE !== 'undefined') {
            let basis = AI_STYLE_ARCHETYPE[getTeamPlaystyle(oppObj).id] || 'N';
            let konter = getCounterArchetype(basis);
            videoAnalysisHtml = `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.15); font-size:10px;">
                🎥 <strong style="color:var(--teal);">Videoanalyse (Topspiel-Sonderbericht):</strong><br>
                Grundausrichtung: <strong>${ARCHETYPE_LABELS[basis]}</strong><br>
                Schwachstelle: <strong>${konter ? `verwundbar gegen ${ARCHETYPE_LABELS[konter]}` : 'kein klares Muster - schwer auszurechnen'}</strong>
            </div>`;
        }

        box.innerHTML = `
            <div class="box box-underworld" style="border-left-color:var(--violet);">
                <strong style="color:var(--violet);">📋 SPIELANALYSE: ${oppName}</strong><br>
                <span style="font-size:10px;">
                    Spielweise: <strong>${getOpponentPlaystyle(oppName)}</strong><br>
                    Team-Stärke: <strong>${baseStr}</strong> · Form (letzte 5): ${formStr}<br>
                    ${dangerLine}
                    ${typeof getCoachInfoHtml === 'function' && oppObj ? '<br>' + getCoachInfoHtml(oppObj) : ''}
                </span>
                ${videoAnalysisHtml}
                ${typeof getPredictionHtml === 'function' ? getPredictionHtml(oppName) : ''}
                ${spyNote}
            </div>`;
    }

    // Vorbericht: müde Stammspieler (Fitness unter 70 %) kosten spürbar Stärke - Hinweis
    // mit einem Knopf, der die beste ausgeruhte Elf aufstellt.
    function renderFatigueWarning() {
        let box = document.getElementById('prematch-fatigue-box');
        if (!box) return;
        let muede = squad.filter(p => lineup.includes(p.id) && p.fitness < 70);
        if (!muede.length) { box.innerHTML = ''; return; }
        box.innerHTML = `<div class="box" style="font-size:11px; border-left-color:var(--danger); margin-bottom:8px;">
            😮‍💨 <strong>${muede.length} Stammspieler erschöpft:</strong> ${muede.map(p => `${p.name} (${p.fitness}%)`).join(', ')}.
            Fitness zählt voll in die Teamstärke.
            <button onclick="rotateTiredPlayers()" class="btn-action" style="margin-top:6px;">🔄 Ausgeruhte Elf aufstellen</button></div>`;
    }
    function rotateTiredPlayers() {
        let vorher = calcTeamStrength(false);
        lineup = pickBestLineupIds();
        renderFatigueWarning();
        showToast(`🔄 Ausgeruhte Elf aufgestellt (Stärke ${Math.round(vorher)} → ${Math.round(calcTeamStrength(false))}).`, 'success');
    }

    function startMatchdayFlow() {
        if (game.matchday > 34) return;
        if (game.sackPending) { showToast('Du bist entlassen - bestätige die Meldung, um bei einem neuen Klub anzufangen.', 'error', 5000); return; }
        // Pokal-Spieltag: die eigene Pokalpartie wird vor dem Ligaspiel live gespielt (js/cup-live.js).
        let cupTie = typeof findOwnCupTieToday === 'function' ? findOwnCupTieToday() : null;
        if (cupTie) { startCupLiveFlow(cupTie); return; }
        let fixtures = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][game.matchday - 1] : null;
        let ourFixture = fixtures ? fixtures.find(f => leaguesData[game.leagueLevel][f.home]?.name === game.clubName || leaguesData[game.leagueLevel][f.away]?.name === game.clubName) : null;
        if (!ourFixture) { processPostMatchRoutine(); return; }

        let isHome = leaguesData[game.leagueLevel][ourFixture.home].name === game.clubName;
        let oppName = isHome ? leaguesData[game.leagueLevel][ourFixture.away].name : leaguesData[game.leagueLevel][ourFixture.home].name;
        let oppObj = leaguesData[game.leagueLevel].find(t => t.name === oppName);
        let oppStr = getOpponentMatchStrength(oppObj ? oppObj.strength : 60, !isHome);
        pendingMatchInfo = { ourFixture, isHome, oppName, oppStr };

        renderPreMatchAnalysis(oppObj, oppName);
        if (typeof renderOppTacticBox === 'function') renderOppTacticBox(oppObj);
        if (typeof renderPregameTalkBox === 'function') renderPregameTalkBox();
        renderFatigueWarning();

        renderPressConference({ oppName, oppStr, isHome, cup: false });
        showScreen('screen-prematch-press');
    }

    function skipPressAndPlay() {
        playSound('click');
        if (!pendingMatchInfo) { processPostMatchRoutine(); return; }
        let { isHome, oppName, oppStr, ourFixture, cupTie } = pendingMatchInfo;
        activeLiveShout = 'standard';
        setupMatch(isHome ? game.clubName : oppName, isHome ? oppName : game.clubName, oppStr, isHome, !!cupTie, ourFixture);
        if (cupTie) markCupLiveMatch(cupTie);
        if (typeof applyPressConferenceToMatch === 'function') applyPressConferenceToMatch();
    }

    // "Nur Ergebnisse": schneller als manuelles "Nächste Szene"-Klicken, aber ausführlicher
    // als "Saison durchsimulieren" - simuliert dieses eine Spiel komplett per Live-Engine
    // durch (inkl. Torschützen/Karten im Ticker) und springt danach direkt zum fertigen
    // Spielbericht, ohne dass man sich durch jede einzelne Szene klicken muss.
    function resolveMatchInstantly() {
        playSound('click');
        if (!pendingMatchInfo) { processPostMatchRoutine(); return; }
        let { isHome, oppName, oppStr, ourFixture, cupTie } = pendingMatchInfo;
        activeLiveShout = 'standard';
        setupMatch(isHome ? game.clubName : oppName, isHome ? oppName : game.clubName, oppStr, isHome, !!cupTie, ourFixture);
        if (cupTie) markCupLiveMatch(cupTie);
        stopLiveTickerAutoplay(); // Schnellsimulation läuft synchron - kein paralleler Auto-Timer nötig
        simulateRestOfMatch();
    }

    function setupMatch(homeName, awayName, oppStrength, isHome, isCup, refObj) {
        if (typeof ensureCaptainPresent === 'function') ensureCaptainPresent();
        playSound('whistle');
        substitutionsLeft = 5;
        if (typeof resetMatchEvents === 'function') resetMatchEvents();
        rollWeather();
        let ourStrength = calcTeamStrength(isHome);
        // Taktik-/Härte-Bonus aus der "eingefrorenen" Basisstärke herauslösen, damit spätere
        // Live-Änderungen (setTacticStyle()/setTackleHardness() während des Spiels) den Rest
        // der Partie tatsächlich neu bewerten können, statt nur beim Anpfiff zu zählen.
        let kickoffTacticDelta = getTacticStyleBonus(game.tacticStyle) + getTackleHardnessBonus(game.tackleHardness);
        let ourBaseStr = ourStrength - kickoffTacticDelta;
        // Gegner-Identität: Spielstil des Live-Gegners nachschlagen, damit er sich auch
        // im direkten Duell gegen uns bemerkbar macht (siehe simulateMatchStep()).
        let oppName = isHome ? awayName : homeName;
        let oppTeamObj = leaguesData.flat().find(t => t && t.name === oppName) || null;
        let ownTeamObj = leaguesData.flat().find(t => t && t.name === game.clubName) || null;
        currentMatch = {
            homeName, awayName,
            homeStr: isHome ? ourStrength : oppStrength,
            awayStr: isHome ? oppStrength : ourStrength,
            ourBaseStr, isHome,
            // Spielstile beider Teams für die erwarteten Tore (getExpectedGoals(), wie in der Simulation).
            homeTeamObj: isHome ? ownTeamObj : oppTeamObj, awayTeamObj: isHome ? oppTeamObj : ownTeamObj,
            // Taktik-Duell (js/opponent-tactics.js): nur im Ligaspiel, Plan steht vor dem Anpfiff fest.
            oppTacticArch: (!isCup && refObj && typeof getOppTacticPlan === 'function') ? (getOppTacticPlan(oppTeamObj) || {}).arch || null : null,
            homeGoals: 0, awayGoals: 0, minute: 0,
            isCup, ref: refObj,
            homeStrPenalty: 0, awayStrPenalty: 0,
            yellowCards: {}, sentOff: [], halftimeShown: false,
            stats: newLiveMatchStats()
        };
        showScreen('screen-matchday');
        document.getElementById('match-title').innerText = homeName + " vs " + awayName;
        document.getElementById('live-home-name').innerText = homeName;
        document.getElementById('live-away-name').innerText = awayName;
        document.getElementById('live-score').innerText = "0 : 0";
        document.getElementById('live-minute').innerText = "1. Minute";
        let weatherEl = document.getElementById('live-weather-badge');
        if (weatherEl) weatherEl.innerText = `${currentWeather.icon} ${currentWeather.name}`;
        let attEl = document.getElementById('live-attendance-badge');
        if (attEl) {
            if (isHome) {
                let opponentNameForDerby = isHome ? awayName : homeName;
                let isDerbyKickoff = isDerbyOpponent(opponentNameForDerby);
                let attFactor = getAttendanceFactor();
                if (isDerbyKickoff && !game.forcedGhostGame) attFactor = Math.min(1.0, attFactor * 2.2);
                else if (!game.forcedGhostGame && currentMatch && (currentMatch.isCup || currentMatch.isEurope)) attFactor = Math.min(1.0, attFactor * 1.4);
                // Bugfix (Konsistenz): dieselbe Zufallsstreuung wie in applyMatchdayFinances()
                // anwenden und das Ergebnis merken, damit die beim Anpfiff angezeigte Zahl
                // exakt der später tatsächlich abgerechneten Zuschauerzahl entspricht, statt
                // zwei unabhängig gewürfelte Werte zu haben.
                let isSoldOutKickoff = isDerbyKickoff && (attFactor * 2.2 >= 1.0);
                let kickoffNoise = isSoldOutKickoff ? 1.0 : (0.92 + Math.random() * 0.16);
                // Gemeinsame Rechnung mit der Spieltagsabrechnung (siehe
                // calculateMatchAttendance in stadium.js) - inklusive der absoluten
                // Ligaobergrenze, die verhindert, dass ein ueberdimensioniertes Stadion
                // in einer unteren Liga voellig unrealistische Zuschauerzahlen erzeugt.
                let liveBoost = isDerbyKickoff && !game.forcedGhostGame ? 2.2
                    : ((!game.forcedGhostGame && currentMatch && (currentMatch.isCup || currentMatch.isEurope)) ? 1.4 : 1);
                let liveAtt = game.forcedGhostGame ? 0 : calculateMatchAttendance(liveBoost, kickoffNoise);
                currentMatch.finalAttendance = liveAtt;
                currentMatch.finalAttendanceMatchday = game.matchday;
                attEl.innerText = game.forcedGhostGame ? '👻 Geisterspiel' : `👥 ${liveAtt.toLocaleString('de-DE')} Zuschauer`;
            } else {
                attEl.innerText = '✈️ Auswärtsspiel';
            }
        }
        
        currentMatch.referee = (typeof getCurrentReferee === 'function') ? getCurrentReferee() : null;
        let introNotes = currentMatch.referee ? `Anpfiff durch ${currentMatch.referee.name} (${currentMatch.referee.style})!` : "Anpfiff der Partie!";
        if (underworld.activeSabotages.pyroHotel) introNotes += " [🧨 Gegner wirkt müde]";
        if (underworld.activeSabotages.refBribe) introNotes += " [⌚ Schiedsrichter pfeift wohlwollend]";
        document.getElementById('ticker-log').innerHTML = `<div>${introNotes}</div>`;
        // Derby-Woche (js/derby-week.js): nach dem Ticker-Start, sonst wäre die Zeile gleich wieder weg.
        if (typeof resetCoTrainerLive === 'function') resetCoTrainerLive();
        if (!isCup && typeof applyDerbyPreparation === 'function') applyDerbyPreparation(oppName);
        if (typeof applyPregameTalk === 'function') applyPregameTalk();
        if (!isCup && typeof applyMatchPrepLive === 'function') applyMatchPrepLive(oppTeamObj);
        if (!isCup && typeof applyPromotionEuphoriaLive === 'function') applyPromotionEuphoriaLive();
        if (typeof applyRefereeGrudge === 'function') applyRefereeGrudge();
        if (typeof renderRefereeCritiqueBox === 'function') renderRefereeCritiqueBox();

        document.getElementById('btn-next-step').style.display = 'inline-block';
        document.getElementById('btn-finish-match').style.display = 'none';
        document.getElementById('btn-finish-match').innerText = '✔ Spielbericht schließen';
        renderLiveSubs();
        renderLiveTacticsPanel();
        renderLiveMatchStats();
        render3DPitch('live-pitch');
        startLiveTickerAutoplay();
    }

    function renderLiveSubs() {
        let container = document.getElementById('live-subs-list');
        document.getElementById('subs-left-count').innerText = substitutionsLeft;
        container.innerHTML = '';
        let bench = squad.filter(p => !lineup.includes(p.id) && (p.injured || 0) === 0 && (p.suspended || 0) === 0);
        // Wer geht raus? Vorauswahl: der müdeste Feldspieler, bei gleicher Fitness der schwächste;
        // der Torwart steht am Ende der Liste.
        let sentOff = (currentMatch && currentMatch.sentOff) || [];
        let onPitch = squad.filter(p => lineup.includes(p.id) && !sentOff.includes(p.id))
            .sort((a, b) => ((a.pos === 'TW') - (b.pos === 'TW')) || (a.fitness - b.fitness) || (liveEffectiveStrength(a) - liveEffectiveStrength(b)));
        let sel = document.createElement('select');
        sel.id = 'live-sub-out';
        sel.className = 'input-inline';
        sel.style.width = '100%';
        onPitch.forEach(p => {
            let opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = `Raus: ${p.name} (${p.pos}, Stärke ${p.strength}, ${p.fitness}% fit)`;
            sel.appendChild(opt);
        });
        container.appendChild(sel);
        bench.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'btn-secondary';
            btn.style.fontSize = '10px'; btn.style.padding = '4px 6px'; btn.style.width = 'auto';
            btn.innerText = `+ ${p.name} (${p.pos}, ${p.strength})`;
            btn.onclick = () => makeLiveSubstitution(p.id);
            container.appendChild(btn);
        });
    }
    function liveEffectiveStrength(p) {
        return p.strength * (p.fitness / 100) * (0.9 + (p.dailyForm ?? 50) / 500);
    }
    // Einwechslung: der gewählte Spieler geht, die Teamstärke ändert sich um die Differenz
    // (wie in calcTeamStrength() durch 11 geteilt); ab der 55. Minute bringen frische Beine
    // einen kleinen Zusatzschub.
    function makeLiveSubstitution(inId) {
        if (!currentMatch || substitutionsLeft <= 0 || currentMatch.minute >= 90) return;
        let sel = document.getElementById('live-sub-out');
        let outId = lineup.find(id => String(id) === (sel ? sel.value : ''));
        let aus = squad.find(p => p.id === outId), rein = squad.find(p => p.id === inId);
        if (!aus || !rein || lineup.includes(inId) || currentMatch.sentOff.includes(outId)) return;
        lineup = lineup.map(id => id === outId ? inId : id);
        substitutionsLeft--;
        let delta = (liveEffectiveStrength(rein) - liveEffectiveStrength(aus)) / 11 + (currentMatch.minute >= 55 ? 0.4 : 0);
        currentMatch.ourBaseStr += delta;
        let log = document.getElementById('ticker-log');
        if (log) {
            log.innerHTML += `<div style="color:var(--teal); font-size:10px;">🔄 ${currentMatch.minute}. Min: ${rein.name} kommt für ${aus.name} (Stärke ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}).</div>`;
            log.scrollTop = log.scrollHeight;
        }
        renderLiveSubs();
        renderLiveMatchStats();
        render3DPitch('live-pitch');
    }

    // Live-Taktikpanel: erlaubt Formation, Spielstil & Zweikampfhärte auch WÄHREND des
    // laufenden Spiels zu ändern (nicht nur vorher) - inklusive sofortiger Auswirkung auf
    // die Teamstärke ab dem nächsten Simulationsschritt (siehe simulateMatchStep()).
    function liveSetTacticStyle(style) {
        setTacticStyle(style);
        renderLiveTacticsPanel();
        document.getElementById('ticker-log').innerHTML += `<div style="color:var(--violet); font-size:10px;">🧠 Spielstil live umgestellt: ${style}.</div>`;
        document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
    }
    function liveSetTackleHardness(level) {
        setTackleHardness(level);
        renderLiveTacticsPanel();
        document.getElementById('ticker-log').innerHTML += `<div style="color:var(--violet); font-size:10px;">🥊 Zweikampfhärte live umgestellt: ${level}.</div>`;
        document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
    }
    function liveSetFormation(form) {
        // Bewusst NICHT setFormation() aufrufen: das würde autoLineup() triggern und damit
        // mitten im Spiel bereits gemachte Wechsel/Platzverweise ignorieren und die Elf neu
        // zusammenwürfeln. Live darf sich nur die taktische FORM ändern, nicht die Kaderauswahl.
        playSound('click');
        game.formation = form;
        renderLiveTacticsPanel();
        render3DPitch('live-pitch');
        document.getElementById('ticker-log').innerHTML += `<div style="color:var(--violet); font-size:10px;">📋 Formation live auf ${form} umgestellt.</div>`;
        document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
    }

    function renderLiveTacticsPanel() {
        let sel = document.getElementById('live-formation-select');
        if (sel) sel.value = game.formation;
        ['offensiv', 'ausgeglichen', 'defensiv'].forEach(s => {
            let btn = document.getElementById('live-ts-' + s);
            if (btn) btn.className = (s === game.tacticStyle) ? 'btn-action' : 'btn-secondary';
        });
        ['vorsichtig', 'normal', 'hart'].forEach(l => {
            let btn = document.getElementById('live-th-' + l);
            if (btn) btn.className = (l === game.tackleHardness) ? 'btn-action' : 'btn-secondary';
        });
    }

    // Taktik-Automatik (Einstellung in der Taktiktafel siehe js/squad.js): reagiert
    // automatisch auf den Spielstand, ohne dass das Live-Panel oben manuell bedient werden
    // muss. Feuert je Regel höchstens EINMAL pro Spiel (currentMatch.tacticAutomationFired),
    // damit nicht bei jedem weiteren Schritt derselbe Stil erneut gesetzt und der Ticker
    // zugespammt wird. Nutzt bewusst liveSetTacticStyle() statt die Umstellung zu duplizieren.
    function applyTacticAutomation() {
        if (!currentMatch || !game.tacticAutomation) return;
        if (!currentMatch.tacticAutomationFired) currentMatch.tacticAutomationFired = {};
        let ourGoals = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
        let oppGoals = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
        let log = document.getElementById('ticker-log');

        if (game.tacticAutomation.offensivBeiRueckstand && currentMatch.minute >= 46 && ourGoals < oppGoals
            && game.tacticStyle !== 'offensiv' && !currentMatch.tacticAutomationFired.offensiv) {
            currentMatch.tacticAutomationFired.offensiv = true;
            if (log) log.innerHTML += `<div style="color:var(--gold); font-size:10px;">🤖 Taktik-Automatik: Rückstand erkannt.</div>`;
            liveSetTacticStyle('offensiv');
        }
        if (game.tacticAutomation.defensivBeiFuehrung && currentMatch.minute >= 75 && ourGoals > oppGoals
            && game.tacticStyle !== 'defensiv' && !currentMatch.tacticAutomationFired.defensiv) {
            currentMatch.tacticAutomationFired.defensiv = true;
            if (log) log.innerHTML += `<div style="color:var(--gold); font-size:10px;">🤖 Taktik-Automatik: Führung kurz vor Schluss wird verteidigt.</div>`;
            liveSetTacticStyle('defensiv');
        }
    }

    // Ticker-Text-Pools für ein lebendigeres Spielerlebnis
    const NEUTRAL_FLAVOR_EVENTS = [
        "Beide Mannschaften tasten sich ab.",
        "Ecke wird ungefährlich geklärt.",
        "Zweikampf im Mittelfeld, Ball geht ins Toraus.",
        "Der Schiedsrichter lässt eine Rudelbildung schlichten.",
        "Kurze Trinkpause bei drückender Hitze.",
        "Der Trainer gestikuliert wild an der Seitenlinie.",
        "Viel Ballbesitz im Mittelfeld, aber keine zwingende Aktion.",
        "Ein Freistoß aus dem Halbfeld segelt ins Toraus.",
        "Die Fans peitschen ihre Mannschaft nach vorne.",
        "Abseits! Der Linienrichter hebt die Fahne.",
        "Ein Spieler bleibt kurz liegen, geht dann aber weiter.",
        "Hektische Szene an der Mittellinie, der Schiedsrichter beruhigt."
    ];
    const OUR_CHANCE_EVENTS = [
        "Gute Kombination, aber der letzte Pass sitzt nicht.",
        "Distanzschuss geht knapp über die Latte!",
        "Der gegnerische Torwart klärt in höchster Not zur Ecke.",
        "Kopfball nach Ecke – knapp vorbei!",
        "Der Pfosten rettet für den Gegner!",
        "Flanke von rechts, der Kopfball streicht knapp am Tor vorbei.",
        "Schneller Konter - im letzten Moment noch abgelaufen.",
        "Freistoß aus 18 Metern, der Torwart lenkt ihn über die Latte!",
        "Doppelpass im Strafraum, aber der Abschluss ist zu harmlos.",
        "Ein Schuss wird im letzten Moment noch geblockt."
    ];
    const OPP_CHANCE_EVENTS = [
        "Gefährlicher Konter, aber unsere Abwehr klärt in letzter Sekunde.",
        "Fernschuss des Gegners geht knapp drüber.",
        "Unser Torwart pariert stark!",
        "Der Gegner vergibt eine Großchance freistehend!",
        "Gefährliche Flanke in unseren Strafraum - geklärt!",
        "Der Gegner trifft nur das Außennetz.",
        "Unsere Abwehr steht nach einem Ballverlust weit offen - Glück gehabt!",
        "Ein Kopfball des Gegners landet auf der Latte!"
    ];
    // Wie fällt ein Tor? Etwas Abwechslung statt immer nur "trifft".
    const GOAL_STYLES = [
        'per Kopfball nach einer Ecke', 'mit einem Flachschuss ins lange Eck', 'nach einem blitzschnellen Konter',
        'mit einem Distanzschuss aus 20 Metern', 'als Abstauber nach einer Torwartparade', 'nach einem feinen Doppelpass',
        'mit einem sehenswerten Volley', 'per Elfmeter', 'mit einem direkten Freistoß', 'nach einer Flanke von außen'
    ];

