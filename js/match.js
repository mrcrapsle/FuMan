
    // ---------- WETTER ----------
    // Wird zu Beginn JEDES Spieltags gewürfelt - unabhängig davon, ob live gespielt,
    // die Saison durchsimuliert oder per Admin vorgespult wird (siehe rollWeather()-Aufrufe
    // in setupMatch(), simulateFullSeason() und adminAdvanceMatchdays()), damit die Effekte
    // auf Ausdauer/Verletzungen in processPostMatchRoutine() unabhängig vom gewählten Modus
    // konsistent greifen.
    const WEATHER_TYPES = [
        { name: 'Sonnig', icon: '☀️', weight: 35, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0 },
        { name: 'Bewölkt', icon: '☁️', weight: 30, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0 },
        { name: 'Regen', icon: '🌧️', weight: 18, fitLossMult: 1.05, injuryMult: 1.15, cardMult: 1.15, goalMult: 0.95, attendanceMult: 0.93 },
        { name: 'Schnee', icon: '❄️', weight: 7, fitLossMult: 1.1, injuryMult: 1.2, cardMult: 1.2, goalMult: 0.85, attendanceMult: 0.88 },
        { name: 'Hitze', icon: '🥵', weight: 10, fitLossMult: 1.25, injuryMult: 1.05, cardMult: 1.0, goalMult: 1.0, attendanceMult: 0.96 },
        { name: 'Sturm', icon: '🌪️', weight: 3, fitLossMult: 1.3, injuryMult: 1.35, cardMult: 1.1, goalMult: 0.8, attendanceMult: 0.7, isStorm: true }
    ];
    currentWeather = WEATHER_TYPES[0];

    function rollWeather() {
        // Wettergarantie (Premium-Booster, NEU): erzwingt sonniges Wetter (erster, neutraler
        // Eintrag in WEATHER_TYPES) statt der normalen Zufallsauswahl.
        if (game.weatherGuaranteeNextMatch) {
            currentWeather = WEATHER_TYPES[0];
            game.weatherGuaranteeNextMatch = false;
            return currentWeather;
        }
        let totalWeight = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0);
        let roll = Math.random() * totalWeight;
        for (let w of WEATHER_TYPES) {
            if (roll < w.weight) {
                currentWeather = w;
                // Rasenheizung (NEU, Bugfix): hatte bisher außer einem kleinen Stadionwert-
                // Bonus KEINERLEI Spielwirkung - dabei ist die Neutralisierung von
                // Schnee/Frost-Nachteilen genau ihr realer Zweck. Bei installierter
                // Rasenheizung bleibt der Platz bei Schnee bespielbar wie bei normalem Wetter.
                if (w.name === 'Schnee' && typeof stadium !== 'undefined' && stadium.rasenheizung) {
                    currentWeather = { ...w, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0, neutralizedBySnow: true };
                    addInboxMessage('vertrag', '❄️ Schnee, aber der Rasen bleibt bespielbar!', 'Dank der Rasenheizung sind die Auswirkungen des Schneefalls komplett neutralisiert - der Platz ist in bestem Zustand.', 'screen-calendar');
                }
                // Stadiondach (NEU, Bugfix): hatte bisher außer einem visuellen Overlay und
                // etwas Stadionwert KEINERLEI Spielwirkung - ein überdachtes Stadion sollte
                // aber logischerweise gegen Regen und Sturm unempfindlich sein.
                if ((w.name === 'Regen' || w.isStorm) && typeof stadium !== 'undefined' && stadium.dach) {
                    currentWeather = { ...w, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0, neutralizedByRoof: true };
                    addInboxMessage('vertrag', `${w.icon} ${w.name}, aber das Dach hält dicht!`, `Dank der Komplett-Überdachung bleibt das Stadion von den Auswirkungen des ${w.name.toLowerCase()}s komplett verschont.`, 'screen-calendar');
                }
                // Klimaanlage (NEU, Stadion-Erweiterung): neutralisiert Hitze-Wetter komplett.
                if (w.name === 'Hitze' && typeof stadium !== 'undefined' && stadium.upgrades?.klimaanlage) {
                    currentWeather = { ...w, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0, neutralizedByAC: true };
                    addInboxMessage('vertrag', `${w.icon} Hitze, aber die Klimaanlage hält kühl!`, 'Dank der Klimaanlage sind alle negativen Auswirkungen der Hitzewelle neutralisiert.', 'screen-calendar');
                }
                // Sturm-Warnung (NEU): dramatische Vorwarnung statt einer echten
                // Spielverlegung (die den Spielplan strukturell gefährden würde) - viele
                // Fans bleiben aus Sorge vor einer Absage zu Hause (siehe attendanceMult).
                if (w.isStorm) addInboxMessage('vertrag', '🌪️ Sturmwarnung vor dem nächsten Spiel!', 'Der Deutsche Wetterdienst warnt vor Sturmböen - das Spiel findet trotzdem statt, aber viele Fans dürften der Warnung folgen und zu Hause bleiben.', 'screen-calendar');
                return currentWeather;
            }
            roll -= w.weight;
        }
        currentWeather = WEATHER_TYPES[0];
        return currentWeather;
    }

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
    function applySabotageToOpponentStrength(oppStr) {
        if (underworld.activeSabotages.pyroHotel) oppStr = Math.max(30, oppStr - 5);
        if (underworld.activeSabotages.weedKiller) oppStr = Math.max(30, oppStr - 4);
        if (underworld.activeSabotages.bribeOpponent) oppStr = Math.max(30, oppStr - 7);
        return oppStr;
    }

    // Zentrale, einmal definierte Bonuswerte für Spielstil & Zweikampfhärte - werden sowohl
    // in calcTeamStrength() (Saison-/Vorschau-Werte) als auch LIVE während des Spiels
    // (simulateMatchStep()) verwendet, damit Taktikänderungen mitten im Match sofort wirken.
    // Spielstile 2.0 (NEU): 8 statt 3 Optionen, jeweils mit Tempo/Pressing-Werten, aus denen
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
    // Formations-Bonus (NEU): Off-Wert erhöht die Angriffsdurchschlagskraft, Def-Wert
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
        // Kabinen-Dynamik (NEU): Cliquenbildung und Führungsspieler-Rat wirken sich auf die
        // Team-Stärke aus.
        if (typeof getCliqueChemistryModifier === 'function') bonus += getCliqueChemistryModifier();
        if (typeof getLeadershipCouncilMoraleStabilizer === 'function') bonus += getLeadershipCouncilMoraleStabilizer() * 0.3;

        if (underworld.activeSabotages.stealBanner && isHomeMatch) bonus += 3;
        if (managerRPG.perks.tactician) bonus += 3;

        // Spieler-Traits wirken sich auf die Teamstärke aus - unabhängig vom Simulationsmodus
        // (also auch bei "Saison durchsimulieren", nicht nur im Live-Spiel).
        if (starting.some(p => p.trait === 'Leader')) bonus += 2;
        if (starting.some(p => p.trait === 'Tor-Instinkt')) bonus += 1.5;
        if (starting.some(p => p.trait === 'Freistoß-Gott')) bonus += 1;
        if (starting.some(p => p.trait === 'Elfmeter-Killer' && p.pos === 'TW')) bonus += 1.5;
        if (starting.some(p => p.trait === 'Eisenfuß')) bonus += 1;
        if (starting.some(p => p.trait === 'Flügelflitzer')) bonus += 1;
        if (starting.some(p => p.trait === 'Zweikampfmonster')) bonus += 1.5;
        // Wetterfest: gibt bei schlechtem Wetter (Regen/Schnee/Sturm/Hitze) einen kleinen
        // Extra-Bonus, unbeeindruckt von den Bedingungen zu bleiben.
        if (currentWeather.goalMult < 1 && starting.some(p => p.trait === 'Wetterfest')) bonus += 1.5;
        // Block-spezifische Fan-Kultur (NEU): tief verwurzelte Block-Kulturen geben bei
        // Heimspielen einen kleinen zusätzlichen Atmosphäre-Bonus.
        if (isHomeMatch && typeof getBlockCultureHomeBonus === 'function') bonus += getBlockCultureHomeBonus();
        // Stadion-Erweiterungen (NEU): Beschallungsanlage verstärkt den Heimvorteil.
        if (isHomeMatch && typeof getStadiumHomeAdvantageBonus === 'function') bonus += getStadiumHomeAdvantageBonus();
        // Kapitän (NEU): war bisher rein kosmetisch (nur ein Ⓒ-Icon) - steht der ernannte
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

        // Team-Trainingsschwerpunkt: Taktik und Match-Prep bringen einen kleinen, begrenzten Bonus.
        if (game.teamTraining === 'taktik') bonus += 2;
        if (game.teamTraining === 'matchprep') bonus += 1;

        // Spielstil: Offensiv riskiert mehr für mehr Durchschlagskraft, Defensiv ist solider.
        bonus += getTacticStyleBonus(game.tacticStyle);
        // Formations-Bonus (NEU): Off-Wert der gewählten Formation erhöht die Angriffs-
        // durchschlagskraft, siehe FORMATION_RATINGS in squad.js.
        bonus += getFormationOffBonus();
        // Team-Anweisungen (NEU): Gegenpressing/Tief stehen/Hohe Außenverteidiger wirken sich
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

    // Deterministischer "Fingerabdruck" pro Gegnername, damit derselbe Verein in der
    // Analyse immer denselben taktischen Grundcharakter zeigt (statt bei jedem Aufruf
    // zufällig zu wechseln).
    function hashTeamName(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return h;
    }
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
        let formStr = form.length > 0 ? form.map(r => r === 'S' ? '🟢' : (r === 'U' ? '🟡' : '🔴')).join(' ') : 'Keine Daten';
        let dangerPos = ['ST', 'MIT', 'ABW'][Math.floor(Math.random() * 3)];
        let dangerName = getRandomName();
        let baseStr = oppObj ? oppObj.strength : 60;
        // Bugfix: "garantiert zuverlässige" Spionage-Infos änderten bisher nichts an der
        // eigentlichen Berechnung - der Zufalls-Schwankungsbereich blieb identisch, obwohl
        // der Text explizit Präzision versprach. Jetzt fällt die Zufallsstreuung bei aktiver
        // Spionage komplett weg, der Wert ist dann wirklich exakt statt nur behauptet exakt.
        let dangerRating = underworld.spyIntelActive
            ? Math.max(35, Math.min(99, Math.round(baseStr + 5)))
            : Math.max(35, Math.min(99, Math.round(baseStr + (Math.random() * 12 - 2))));

        // Videoanalyse: bei besonders wichtigen Spielen (Derby, Pokal, Europapokal) liefert
        // der Chef-Analyst einen ausführlicheren Bericht mit Formations-Tendenz und einem
        // konkreten Schwachstellen-Hinweis statt nur der Basis-Kennzahlen.
        let isImportantMatch = oppName === game.permanentRivalName || (game.forceDerbyMatchdays || []).includes(game.matchday) || currentMatch?.isCup || game.inEurope;
        let spyNote = underworld.spyIntelActive ? `<div style="margin-top:6px; font-size:10px; color:#f97316;">🕵️ <strong>Insider-Info aktiv:</strong> Diese Analyse stammt von einem bezahlten Informanten im gegnerischen Verein und ist garantiert zuverlässig.</div>` : '';
        let videoAnalysisHtml = '';
        if (isImportantMatch) {
            const FORMATION_TENDENCIES = ['4-4-2 mit hohem Pressing', '4-3-3 mit breitem Flügelspiel', '3-5-2 mit kompakter Abwehrkette', '4-2-3-1 mit schnellen Kontern'];
            const WEAKNESSES = ['anfällig bei hohen Bällen in den Strafraum', 'schwach in Umschaltmomenten nach Ballverlust', 'verwundbar bei schnellen Außenverteidiger-Vorstößen', 'nervös bei frühem Gegentor'];
            let tendency = FORMATION_TENDENCIES[Math.floor(Math.random() * FORMATION_TENDENCIES.length)];
            let weakness = WEAKNESSES[Math.floor(Math.random() * WEAKNESSES.length)];
            videoAnalysisHtml = `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.15); font-size:10px;">
                🎥 <strong style="color:var(--teal);">Videoanalyse (Topspiel-Sonderbericht):</strong><br>
                Formations-Tendenz: <strong>${tendency}</strong><br>
                Schwachstelle: <strong>${weakness}</strong>
            </div>`;
        }

        box.innerHTML = `
            <div class="box box-underworld" style="border-left-color:var(--violet);">
                <strong style="color:var(--violet);">📋 SPIELANALYSE: ${oppName}</strong><br>
                <span style="font-size:10px;">
                    Spielweise: <strong>${getOpponentPlaystyle(oppName)}</strong><br>
                    Team-Stärke: <strong>${baseStr}</strong> · Form (letzte 5): ${formStr}<br>
                    Gefährlichster Spieler: <strong>${dangerName}</strong> (${dangerPos}, Stärke ${dangerRating})
                </span>
                ${videoAnalysisHtml}
                ${spyNote}
            </div>`;
    }

    function startMatchdayFlow() {
        if (game.matchday > 34) return;
        let fixtures = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][game.matchday - 1] : null;
        let ourFixture = fixtures ? fixtures.find(f => leaguesData[game.leagueLevel][f.home]?.name === "1.FC Moritz Leipzig" || leaguesData[game.leagueLevel][f.away]?.name === "1.FC Moritz Leipzig") : null;
        if (!ourFixture) { processPostMatchRoutine(); return; }

        let isHome = leaguesData[game.leagueLevel][ourFixture.home].name === "1.FC Moritz Leipzig";
        let oppName = isHome ? leaguesData[game.leagueLevel][ourFixture.away].name : leaguesData[game.leagueLevel][ourFixture.home].name;
        let oppObj = leaguesData[game.leagueLevel].find(t => t.name === oppName);
        let oppStr = applySabotageToOpponentStrength(oppObj ? oppObj.strength : 60);
        pendingMatchInfo = { ourFixture, isHome, oppName, oppStr };

        renderPreMatchAnalysis(oppObj, oppName);

        let q = { q: "Wie lautet die Marschroute für das Spiel?", a: ["Volle Offensive auf Sieg!", "Kompakt stehen und kontern.", "Kräfte schonen & rotieren."] };
        document.getElementById('press-question-container').innerHTML = `<strong>Journalist fragt:</strong> "${q.q}"`;
        let aBox = document.getElementById('press-answers-container');
        aBox.innerHTML = '';
        q.a.forEach(ans => {
            let btn = document.createElement('button');
            btn.className = 'btn-action';
            btn.style.margin = '3px 0';
            btn.innerText = ans;
            btn.onclick = () => { skipPressAndPlay(); };
            aBox.appendChild(btn);
        });
        showScreen('screen-prematch-press');
    }

    function skipPressAndPlay() {
        playSound('click');
        if (!pendingMatchInfo) { processPostMatchRoutine(); return; }
        let { isHome, oppName, oppStr, ourFixture } = pendingMatchInfo;
        activeLiveShout = 'standard';
        setupMatch(isHome ? "1.FC Moritz Leipzig" : oppName, isHome ? oppName : "1.FC Moritz Leipzig", oppStr, isHome, false, ourFixture);
    }

    // "Nur Ergebnisse": schneller als manuelles "Nächste Szene"-Klicken, aber ausführlicher
    // als "Saison durchsimulieren" - simuliert dieses eine Spiel komplett per Live-Engine
    // durch (inkl. Torschützen/Karten im Ticker) und springt danach direkt zum fertigen
    // Spielbericht, ohne dass man sich durch jede einzelne Szene klicken muss.
    function resolveMatchInstantly() {
        playSound('click');
        if (!pendingMatchInfo) { processPostMatchRoutine(); return; }
        let { isHome, oppName, oppStr, ourFixture } = pendingMatchInfo;
        activeLiveShout = 'standard';
        setupMatch(isHome ? "1.FC Moritz Leipzig" : oppName, isHome ? oppName : "1.FC Moritz Leipzig", oppStr, isHome, false, ourFixture);
        stopLiveTickerAutoplay(); // Schnellsimulation läuft synchron - kein paralleler Auto-Timer nötig
        simulateRestOfMatch();
    }

    function setupMatch(homeName, awayName, oppStrength, isHome, isCup, refObj) {
        playSound('whistle');
        substitutionsLeft = 5;
        rollWeather();
        let ourStrength = calcTeamStrength(isHome);
        // Taktik-/Härte-Bonus aus der "eingefrorenen" Basisstärke herauslösen, damit spätere
        // Live-Änderungen (setTacticStyle()/setTackleHardness() während des Spiels) den Rest
        // der Partie tatsächlich neu bewerten können, statt nur beim Anpfiff zu zählen.
        let kickoffTacticDelta = getTacticStyleBonus(game.tacticStyle) + getTackleHardnessBonus(game.tackleHardness);
        let ourBaseStr = ourStrength - kickoffTacticDelta;
        // Gegner-Identität (NEU): Spielstil des Live-Gegners nachschlagen, damit er sich auch
        // im direkten Duell gegen uns bemerkbar macht (siehe simulateMatchStep()).
        let oppName = isHome ? awayName : homeName;
        let oppTeamObj = (leaguesData[game.leagueLevel] || []).find(t => t.name === oppName) || null;
        currentMatch = {
            homeName, awayName,
            homeStr: isHome ? ourStrength : oppStrength,
            awayStr: isHome ? oppStrength : ourStrength,
            ourBaseStr, isHome, oppPlaystyle: oppTeamObj ? oppTeamObj.playstyle : null,
            homeGoals: 0, awayGoals: 0, minute: 0,
            isCup, ref: refObj,
            homeStrPenalty: 0, awayStrPenalty: 0,
            yellowCards: {}, sentOff: [], halftimeShown: false
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
                let isDerbyKickoff = opponentNameForDerby === game.permanentRivalName || (game.forceDerbyMatchdays || []).includes(game.matchday);
                let attFactor = getAttendanceFactor();
                if (isDerbyKickoff && !game.forcedGhostGame) attFactor = Math.min(1.0, attFactor * 2.2);
                else if (!game.forcedGhostGame && currentMatch && (currentMatch.isCup || currentMatch.isEurope)) attFactor = Math.min(1.0, attFactor * 1.4);
                // Bugfix (Konsistenz): dieselbe Zufallsstreuung wie in applyMatchdayFinances()
                // anwenden und das Ergebnis merken, damit die beim Anpfiff angezeigte Zahl
                // exakt der später tatsächlich abgerechneten Zuschauerzahl entspricht, statt
                // zwei unabhängig gewürfelte Werte zu haben.
                let isSoldOutKickoff = isDerbyKickoff && (attFactor * 2.2 >= 1.0);
                let kickoffNoise = isSoldOutKickoff ? 1.0 : (0.92 + Math.random() * 0.16);
                let liveAtt = game.forcedGhostGame ? 0 : Math.min(stadium.total || 16000, Math.round((stadium.total || 16000) * attFactor * kickoffNoise));
                currentMatch.finalAttendance = liveAtt;
                currentMatch.finalAttendanceMatchday = game.matchday;
                attEl.innerText = game.forcedGhostGame ? '👻 Geisterspiel' : `👥 ${liveAtt.toLocaleString('de-DE')} Zuschauer`;
            } else {
                attEl.innerText = '✈️ Auswärtsspiel';
            }
        }
        
        let introNotes = "Anpfiff der Partie!";
        if (underworld.activeSabotages.pyroHotel) introNotes += " [🧨 Gegner wirkt müde]";
        if (underworld.activeSabotages.refBribe) introNotes += " [⌚ Schiedsrichter pfeift wohlwollend]";
        document.getElementById('ticker-log').innerHTML = `<div>${introNotes}</div>`;

        document.getElementById('btn-next-step').style.display = 'inline-block';
        document.getElementById('btn-finish-match').style.display = 'none';
        renderLiveSubs();
        renderLiveTacticsPanel();
        render3DPitch('live-pitch');
        startLiveTickerAutoplay();
    }

    function renderLiveSubs() {
        let container = document.getElementById('live-subs-list');
        document.getElementById('subs-left-count').innerText = substitutionsLeft;
        container.innerHTML = '';
        let bench = squad.filter(p => !lineup.includes(p.id) && (p.injured || 0) === 0 && (p.suspended || 0) === 0 && (p.nationalDuty || 0) === 0);
        bench.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'btn-secondary';
            btn.style.fontSize = '8px'; btn.style.padding = '2px 4px';
            btn.innerText = `+ ${p.name} (${p.pos})`;
            btn.onclick = () => {
                if (substitutionsLeft <= 0) return;
                let out = lineup[lineup.length - 1];
                lineup = lineup.map(id => id === out ? p.id : id);
                substitutionsLeft--;
                renderLiveSubs();
                render3DPitch('live-pitch');
            };
            container.appendChild(btn);
        });
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

    // Ticker-Text-Pools für ein lebendigeres Spielerlebnis
    const NEUTRAL_FLAVOR_EVENTS = [
        "Beide Mannschaften tasten sich ab.",
        "Ecke wird ungefährlich geklärt.",
        "Zweikampf im Mittelfeld, Ball geht ins Toraus.",
        "Der Schiedsrichter lässt eine Rudelbildung schlichten.",
        "Kurze Trinkpause bei drückender Hitze.",
        "Der Trainer gestikuliert wild an der Seitenlinie."
    ];
    const OUR_CHANCE_EVENTS = [
        "Gute Kombination, aber der letzte Pass sitzt nicht.",
        "Distanzschuss geht knapp über die Latte!",
        "Der gegnerische Torwart klärt in höchster Not zur Ecke.",
        "Kopfball nach Ecke – knapp vorbei!",
        "Der Pfosten rettet für den Gegner!"
    ];
    const OPP_CHANCE_EVENTS = [
        "Gefährlicher Konter, aber unsere Abwehr klärt in letzter Sekunde.",
        "Fernschuss des Gegners geht knapp drüber.",
        "Unser Torwart pariert stark!",
        "Der Gegner vergibt eine Großchance freistehend!"
    ];

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
    // Kontextabhängige Kommentar-Varianz (NEU): zusätzliche Zeilen je nach Spielstand und
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
        if (currentMatch.awaitingHalftimeTalk) return; // wartet auf die Halbzeit-Ansprache-Auswahl
        let prevMinute = currentMatch.minute;
        currentMatch.minute += Math.floor(Math.random() * 14) + 8;
        if (currentMatch.minute >= 90) { currentMatch.minute = 90; }
        document.getElementById('live-minute').innerText = currentMatch.minute + ". Minute";

        // Halbzeit-Marker, sobald die 45. Minute überschritten wird
        if (!currentMatch.halftimeShown && prevMinute < 45 && currentMatch.minute >= 45) {
            document.getElementById('ticker-log').innerHTML += `<div style="color:var(--blue); font-weight:bold;">⏸️ HALBZEITPAUSE (${currentMatch.homeGoals}:${currentMatch.awayGoals})</div>`;
            currentMatch.halftimeShown = true;
            currentMatch.awaitingHalftimeTalk = true;
            showHalftimeTalkModal();
            return; // dieser Schritt endet hier - Tor/Karten-Auswertung erst nach der Ansprache
        }

        let onPitch = squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id));
        // Live-Taktikbonus wird JEDEN Schritt neu aus dem AKTUELLEN game.tacticStyle/
        // game.tackleHardness berechnet (nicht aus dem eingefrorenen Anpfiff-Wert) - so
        // wirkt sich eine Taktikänderung während des Spiels sofort auf den Rest der Partie aus.
        let liveTacticDelta = getTacticStyleBonus(game.tacticStyle) + getTackleHardnessBonus(game.tackleHardness) + (currentMatch.halftimeTalkBonus || 0);
        let ourLiveStr = currentMatch.ourBaseStr + liveTacticDelta;
        let effHomeStr = (currentMatch.isHome ? ourLiveStr : currentMatch.homeStr) - currentMatch.homeStrPenalty;
        let effAwayStr = (currentMatch.isHome ? currentMatch.awayStr : ourLiveStr) - currentMatch.awayStrPenalty;
        let diff = effHomeStr - effAwayStr;
        // Formations-Verteidigungswert (NEU): eine defensiv robuste Formation verschiebt die
        // Wahrscheinlichkeit im Ballbesitz-Duell zu unseren Gunsten, unabhängig davon, ob wir
        // Heim- oder Auswärtsteam sind (siehe FORMATION_RATINGS in squad.js).
        let ourDefShift = getFormationDefBonus() * 0.6;
        // Torwarttrainer (NEU): wirkte bisher nur im seltenen Elfmeterschießen, nie im
        // regulären 90-minütigen Spielverlauf - ein guter Torwart-Coach verbessert
        // Reflexe/Stellungsspiel des Keepers auch im Alltagsgeschäft.
        if (staffMembers.twTrainer.hired) ourDefShift += 0.4 * getStaffLevelMultiplier('twTrainer');
        diff += currentMatch.isHome ? ourDefShift : -ourDefShift;
        let goalChance = 0.35 * currentWeather.goalMult;
        // Bugfix: bei großem Stärkegefälle entstehen in der Realität nicht nur bessere
        // Chancenverwertung, sondern schlicht auch MEHR Torchancen pro Spielabschnitt - bisher
        // blieb die Chance auf ein Torereignis überhaupt IMMER bei ~35%, unabhängig von der
        // Dominanz. Das führte dazu, dass selbst krasse Übermacht (Stärke 99 vs. Kreisligist)
        // viel zu oft 0:0 endete, weil einfach zu wenige Torereignisse pro Partie ausgelöst
        // wurden - unabhängig davon, wer sie dann verwertet hätte.
        goalChance += Math.min(0.25, Math.abs(diff) * 0.003);
        // Gegner-Identität (NEU): ein offensiv eingestellter Gegner erhöht die Chance auf ein
        // Torereignis zusätzlich, ein defensiver senkt sie.
        if (currentMatch.oppPlaystyle) {
            let style = getTeamPlaystyle({ playstyle: currentMatch.oppPlaystyle });
            goalChance = Math.max(0.1, goalChance * (1 + style.goalBonus * 0.4));
        }
        let userFavoredProb = Math.max(0.02, Math.min(0.98, 0.5 + diff * 0.02));

        if (activeLiveShout === 'brechstange') { goalChance += 0.15; userFavoredProb += (currentMatch.isHome ? 0.08 : -0.08); }
        if (activeLiveShout === 'bus') { goalChance -= 0.12; userFavoredProb += (currentMatch.isHome ? -0.05 : 0.05); }
        if (activeLiveShout === 'pressing') { goalChance += 0.10; }

        if (underworld.activeSabotages.refBribe) { goalChance += 0.08; userFavoredProb += (currentMatch.isHome ? 0.12 : -0.12); }

        let hasGoalInstinct = onPitch.some(p => p.trait === 'Tor-Instinkt');
        let hasFkGod = onPitch.some(p => p.trait === 'Freistoß-Gott');
        // Standards-Spezialist: erhöht generell die Chance auf Tore aus Standardsituationen
        // (Freistöße/Ecken), unabhängig von individuellen Spieler-Eigenschaften.
        if (staffMembers.setPieceCoach.hired) goalChance += 0.015 * getStaffLevelMultiplier('setPieceCoach');
        // Standard-Schützen (NEU): war bisher rein kosmetisch (nur ein Icon neben dem Namen) -
        // jetzt geben ein passsicherer Freistoß-/Eckenschütze und ein torgefährlicher
        // Elfmeterschütze im Kader einen kleinen echten Zusatzbonus, wenn sie auf dem Platz
        // stehen. Das macht die neue Standards-Spezialist-Automatisierung auch tatsächlich
        // sinnvoll, statt nur die Anzeige zu ändern.
        let fkTaker = onPitch.find(p => p.id === game.freeKickTakerId);
        let cornerTaker = onPitch.find(p => p.id === game.cornerTakerId);
        if (fkTaker && fkTaker.passing >= 75) goalChance += 0.008;
        // Elfmeterschütze (NEU): war bisher nur im Elfmeterschießen wirksam, nie im
        // regulären Spielverlauf (der keine expliziten Elfmeter-Ereignisse simuliert) - ein
        // zuverlässiger, auf dem Feld stehender Schütze erhöht die generelle Torgefahr etwas,
        // stellvertretend für die zusätzliche Ruhe/Präzision, die er in den 16er bringt.
        let penaltyTaker = onPitch.find(p => p.id === game.penaltyTakerId);
        if (penaltyTaker && penaltyTaker.shooting >= 75) goalChance += 0.006;
        if (cornerTaker && cornerTaker.passing >= 75) goalChance += 0.006;
        let hasPkKiller = onPitch.some(p => p.trait === 'Elfmeter-Killer' && p.pos === 'TW');
        let hasWingSpeedster = onPitch.some(p => p.trait === 'Flügelflitzer');
        let hasTackleMonster = onPitch.some(p => p.trait === 'Zweikampfmonster');
        if (hasGoalInstinct) userFavoredProb += 0.06;
        if (hasWingSpeedster) goalChance += 0.05;

        let eventHandled = false;

        if (Math.random() < goalChance) {
            eventHandled = true;
            if (Math.random() < userFavoredProb) {
                currentMatch.homeGoals++;
                playSound('goal');
                let scorer = pickWeightedScorer(onPitch);
                if (scorer) { scorer.goalsSeason = (scorer.goalsSeason || 0) + 1; scorer.goalsCareer = (scorer.goalsCareer || 0) + 1; }
                let extra = (hasFkGod && Math.random() < 0.3) ? " (Traumhafter direkter Freistoß!)" : "";
                let scorerText = scorer ? `${scorer.name} trifft` : "Tor";
                document.getElementById('ticker-log').innerHTML += `<div style="color:var(--primary);">⚽ ${currentMatch.minute}. Min: ${scorerText} für ${currentMatch.homeName}!${extra}</div>`;
            } else {
                if (hasPkKiller && Math.random() < 0.35 && !currentMatch.isHome) {
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--blue);">🧤 ${currentMatch.minute}. Min: GLANZPARADE! Unser Elfmeter-Killer hält überragend!</div>`;
                } else {
                    currentMatch.awayGoals++;
                    playSound('goal');
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--danger);">⚽ ${currentMatch.minute}. Min: Tor für ${currentMatch.awayName}!</div>`;
                }
            }
        }

        // Karten-Ereignis (unabhängig vom Tor-Ereignis dieser Runde)
        if (!eventHandled || Math.random() < 0.5) {
            let ourCardRoll = Math.random();
            // Ein "Zweikampfmonster" gewinnt seine Duelle sauber und senkt so das eigene Kartenrisiko.
            let ourCardThreshold = hasTackleMonster ? 0.045 : 0.06;
            // Kapitän auf dem Feld (NEU): beruhigt die Mannschaft und senkt das Kartenrisiko
            // leicht - eine der klassischsten Führungsspieler-Aufgaben im echten Fußball.
            if (onPitch.some(p => p.id === game.captainId)) ourCardThreshold *= 0.9;
            // Glücksbringer (Premium-Booster, NEU): dämpft auch das Kartenrisiko.
            if (game.luckyCharmNextMatch) ourCardThreshold *= 0.5;
            ourCardThreshold *= currentWeather.cardMult;
            if (game.tackleHardness === 'hart') ourCardThreshold *= 1.5;
            if (game.tackleHardness === 'vorsichtig') ourCardThreshold *= 0.6;
            // Nervenkrieg-Effekt: bei einer bereits etablierten Elfmeterschießen-Rivalität
            // (siehe checkShootoutRivalryIntensity() in europe.js/cup.js) steht das ganze
            // Spiel unter besonderer psychischer Anspannung - hitzköpfige Spieler geraten
            // dabei eher in Zweikämpfe außer Kontrolle, ruhige Charaktere bleiben unberührt.
            let isNervenkriegMatch = (currentMatch.homeName === game.permanentRivalName || currentMatch.awayName === game.permanentRivalName) && (rivalryRecord.shootoutsVsRival || 0) >= 2;
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
                    culprit.suspended = 2; // wird nach Spielende einmal herunter gezählt -> 1 Spiel Sperre
                    if (currentMatch.isHome) currentMatch.homeStrPenalty += 6; else currentMatch.awayStrPenalty += 6;
                    let label = isSecondYellow ? "🟨🟥 Gelb-Rote Karte" : "🟥 Platzverweis";
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--danger); font-weight:bold;">${label} für ${culprit.name}! Wir spielen in Unterzahl weiter.</div>`;
                } else {
                    currentMatch.yellowCards[culprit.id] = (currentMatch.yellowCards[culprit.id] || 0) + 1;
                    document.getElementById('ticker-log').innerHTML += `<div style="color:var(--accent);">🟨 ${currentMatch.minute}. Min: Gelbe Karte für ${culprit.name}.</div>`;
                }
            } else if (ourCardRoll < 0.11) {
                // Gegnerische Karte - kein individueller Spieler, aber wirkt sich leicht auf Spielverlauf aus
                eventHandled = true;
                let isRed = Math.random() < 0.1;
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
            let pool = diff > 8 ? OUR_CHANCE_EVENTS : (diff < -8 ? OPP_CHANCE_EVENTS : NEUTRAL_FLAVOR_EVENTS);
            let line = pool[Math.floor(Math.random() * pool.length)];
            document.getElementById('ticker-log').innerHTML += `<div style="color:#64748b; font-size:10px;">${currentMatch.minute}. Min: ${line}</div>`;
        }

        document.getElementById('ticker-log').scrollTop = document.getElementById('ticker-log').scrollHeight;
        document.getElementById('live-score').innerText = currentMatch.homeGoals + " : " + currentMatch.awayGoals;

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
            if (!currentMatch || liveTickerPaused || currentMatch.awaitingHalftimeTalk || currentMatch.minute >= 90) return;
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
    // KI-Vorschlag für Einwechslungen zur Halbzeit (NEU): identifiziert den müdesten
    // Feldspieler auf dem Platz und den stärksten passenden Ersatz auf der Bank, statt dass
    // eine Einwechslung immer nur den zuletzt eingewechselten Spieler naiv austauscht.
    function getHalftimeSubSuggestion() {
        let onPitch = squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id) && p.pos !== 'TW');
        if (onPitch.length === 0 || substitutionsLeft <= 0) return null;
        let tiredest = [...onPitch].sort((a, b) => a.fitness - b.fitness)[0];
        if (tiredest.fitness > 75) return null; // noch kein dringender Handlungsbedarf
        let bench = squad.filter(p => !lineup.includes(p.id) && (p.injured || 0) === 0 && (p.suspended || 0) === 0 && (p.nationalDuty || 0) === 0);
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
        stopLiveTickerAutoplay();
        document.getElementById('btn-next-step').style.display = 'none';
        document.getElementById('btn-finish-match').style.display = 'inline-block';
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
                    let hStr = homeTeam?.strength || 60;
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
        let isHomeDerby = (currentMatch.isHome && opponentName === getOurRivalName()) || (game.forceDerbyMatchdays || []).includes(game.matchday);
        let ourGoalsThisMatch = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
        let oppGoalsThisMatch = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
        recordRivalryResult(opponentName, ourGoalsThisMatch, oppGoalsThisMatch);

        applyMatchdayFinances(currentMatch.isHome, won, oppGoalsThisMatch === 0, isHomeDerby, opponentName, `${ourGoalsThisMatch}:${oppGoalsThisMatch}`);
        processPostMatchRoutine(won ? 'win' : (drawn ? 'draw' : 'loss'), isHomeDerby, true, ourGoalsThisMatch - oppGoalsThisMatch, currentMatch.isHome, { total: currentMatch.homeGoals + currentMatch.awayGoals, bothScored: currentMatch.homeGoals > 0 && currentMatch.awayGoals > 0 });
    }

    function applyMatchdayFinances(isHomeMatch = true, won = false, cleanSheet = false, isDerbyMatch = false, opponentNameForRecord = null, scoreTextForRecord = null) {
        let moneyAtStart = game.money; // für automatische Rücklagenbildung (Finanzen & Kapitalmarkt)
        let ghostGameActive = isHomeMatch && game.forcedGhostGame;
        // Lokalderby-Atmosphäre: bei Heimspielen gegen den permanenten Rivalen ist das
        // Stadion deutlich stärker ausgelastet als sonst (gedeckelt bei "ausverkauft").
        let derbyBoostActive = isHomeMatch && isDerbyMatch && !ghostGameActive;
        // Pokal-/Europapokalspiele (NEU): ziehen erfahrungsgemäß mehr Zuschauer an als
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
                att = Math.min(stadium.total || 16000, Math.round((stadium.total || 16000) * attFactor * attendanceNoise));
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
        // Vereinsrekorde (NEU): größter Sieg, höchste Niederlage, torreichstes Spiel und
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
        let ticketIncome = (isHomeMatch && !ghostGameActive) ? Math.round(att * 0.5 * game.ticketPrices.steh + att * 0.45 * game.ticketPrices.sitz + (stadium.vipTotal || 50) * game.ticketPrices.vip) : 0;
        // Doppelte Ticketeinnahmen (Premium-Booster, NEU).
        if (isHomeMatch && game.ticketIncomeBoostNextMatch) { ticketIncome *= 2; game.ticketIncomeBoostNextMatch = false; }
        // Medienrechte (NEU): eigener Medienpartner zahlt bei jedem Heimspiel, mit Bonus bei
        // Derbys/Pokalspielen (attraktivere Übertragungen).
        // Stadion-Erweiterungen (NEU): feste Zusatzeinnahmen der "income"-Kategorie
        // (VIP-Lounges, Public-Viewing, Ladestationen) sowie ein leichter Medienimage-Schub
        // durch Lichtshow/Pressezentrum bei jedem Heimspiel.
        if (isHomeMatch && typeof getStadiumMatchdayIncome === 'function') {
            game.money += getStadiumMatchdayIncome();
            game.managerMediaImage = Math.min(100, (game.managerMediaImage ?? 50) + getStadiumMediaImageMatchdayBonus());
        }
        if (isHomeMatch && typeof tickMediaRightsPayment === 'function') {
            tickMediaRightsPayment(isDerbyMatch, !!(typeof currentMatch !== 'undefined' && currentMatch && currentMatch.isCup));
        }
        // Betriebskosten (NEU, echte Abbuchung): dieselbe Formel wurde bisher nur im
        // Finanz-Ausblick ANGEZEIGT, aber nie tatsächlich abgebucht - ein "Phantom-Posten".
        // Jetzt wird der Pro-Spieltag-Anteil (Monatsschätzung / 4) jeden Spieltag wirklich
        // fällig, egal ob Heim- oder Auswärtsspiel (laufende Kosten fallen immer an).
        let baseStadiumMaintenance = (stadium.total || 16000) * 0.45;
        // Solaranlage (NEU): senkt die Stromkosten-Komponente der Betriebskosten spürbar,
        // statt nur eine reine Sponsoren-Einnahmen-Erhöhung zu sein - echte Stromersparnis.
        if (stadium.upgrades?.solaranlage) baseStadiumMaintenance *= 0.8;
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
        let merchIncome = simulateMerchSales(isHomeMatch && !ghostGameActive, won);
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
        // Sponsoren-Zufriedenheit (NEU): bei niedriger Loyalität zahlt der Hauptsponsor
        // spürbar weniger (nur der Hauptsponsor-Teil, nicht Banden/Ausrüster/Namensrechte).
        let loyaltyMult = typeof getSponsorLoyaltyPaymentMultiplier === 'function' ? getSponsorLoyaltyPaymentMultiplier() : 1;
        let mainSponsorInc = Math.round((game.sponsor.base + (won ? game.sponsor.winBonus : 0) + themedBonus) * loyaltyMult);
        // Sponsoren-Boost (Premium-Booster, NEU): +50% für begrenzte Zeit.
        if (game.sponsorBoostMatchdaysLeft > 0) mainSponsorInc = Math.round(mainSponsorInc * 1.5);
        // Stadion-Erweiterungen (NEU): Solaranlage/Business-Center erhöhen die laufenden
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
        let net = ticketIncome + merchIncome + sponsorInc - wages - travelCost;
        game.money += net;
        if (ghostGameActive) game.forcedGhostGame = false; // Geisterspiel-Auflage ist damit erfüllt
        if (derbyBoostActive) {
            if (genuinelySoldOut) {
                addInboxMessage('vertrag', '🔥 Ausverkauftes Lokalderby!', `Das Stadion war beim Derby gegen ${game.permanentRivalName} bis auf den letzten Platz gefüllt (${att.toLocaleString('de-DE')} Zuschauer) - ${formatVal(ticketIncome)} Ticketeinnahmen!`, 'screen-finances');
            } else {
                addInboxMessage('vertrag', '🔥 Rekordkulisse beim Lokalderby!', `Das Derby gegen ${game.permanentRivalName} lockte deutlich mehr Zuschauer als sonst an (${att.toLocaleString('de-DE')} Zuschauer) - ${formatVal(ticketIncome)} Ticketeinnahmen! Bei wachsender Fan-Zufriedenheit wird das Stadion künftig noch voller.`, 'screen-finances');
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
        if (typeof tickAutoReserve === 'function') tickAutoReserve(game.money - moneyAtStart);
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
        // Eigene Sicherheitskräfte (NEU): feste Ordner zählen zur effektiven Ordnerzahl dazu,
        // die Ausbildungsstufe macht jeden einzelnen Ordner zusätzlich wirksamer.
        let effectiveStewards = (game.stewards || 0) + (typeof securityWorkforce !== 'undefined' ? securityWorkforce.permanentStewards : 0);
        let skillMult = typeof securityWorkforce !== 'undefined' ? (1 + (securityWorkforce.skillLevel - 1) * 0.12) : 1;
        let baseChance = 0.12 * (1 - Math.min(0.92, (effectiveStewards / 100) * 0.8 * skillMult));
        if (staffMembers.fanLiaison.hired) baseChance *= 0.7; // Fanbeauftragter deeskaliert im Vorfeld
        // Sicherheitslage beruhigen (Premium-Booster, NEU): stark reduziertes Risiko.
        if (game.securityCalmNextMatch) baseChance *= 0.15;
        // Stadion-Sicherheitstechnik (NEU): dauerhafte Risikosenkung durch gekaufte Anlagen.
        if (typeof getStadiumSecurityBonus === 'function') baseChance *= (1 - getStadiumSecurityBonus());
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
        alert(`🔥 AUSSCHREITUNGEN IM DERBY!\nRivalisierende Fangruppen liefern sich Straßenschlachten rund ums Stadion.\nStrafe: -${formatVal(fine)}. Der Verband verhängt ein Geisterspiel für die nächste Heimpartie!` + (game.riotCount >= 3 ? "\n⚠️ Wiederholte Vorfälle: der Verband beobachtet euren Klub inzwischen sehr genau." : ""));
    }

    function processPostMatchRoutine(matchResult = null, isHomeDerby = false, isLiveContext = false, matchMargin = 0, isHomeMatchParam = true, totalGoalsForBets = null) {
        // Löst die Insider-Wette und die Spionage-Info fürs vergangene Spiel auf/zurück,
        // unabhängig davon ob live gespielt oder automatisch simuliert wurde - beide sind
        // ans jeweils NÄCHSTE (jetzt vergangene) Spiel gebunden, nicht an den Live-Kontext.
        if (matchResult !== null) resolveUnderworldInsiderBet(matchResult === 'win');
        underworld.spyIntelActive = false;
        // Zuschauerzahl-Konsistenz-Fix (NEU): finalAttendance nach dem Spiel zurücksetzen,
        // damit sie nicht versehentlich ins nächste Spiel durchsickert.
        if (typeof currentMatch !== 'undefined' && currentMatch) currentMatch.finalAttendance = undefined;
        // Premium-Booster-Flags (NEU): erst NACH dem kompletten Spiel zurücksetzen, da sie
        // während des gesamten Spielverlaufs (viele Ticks) wirken sollen, nicht nur beim ersten.
        if (matchResult !== null) {
            game.luckyCharmNextMatch = false;
            game.securityCalmNextMatch = false;
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
                    // Jugend-Mentor (NEU): ein erfahrener Profi als persönlicher Mentor
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
        // Premium-Booster (NEU): Verletzungsschutz setzt das Risiko komplett auf 0,
        // Glücksbringer dämpft es stark.
        if (game.injuryShieldMatchdaysLeft > 0) injuryChance = 0;
        else if (game.luckyCharmNextMatch) injuryChance *= 0.4;
        // Verletzungspräventions-Programm (Training & Förderung): dauerhafte Grundrisiko-Senkung.
        if (game.injuryPreventionProgram) injuryChance *= 0.82;
        // Stadion-Erweiterungen (NEU): Medizinzentrum/Rasenpflege senken das Trainings-
        // Verletzungsrisiko - wirkt am heimischen Gelände, unabhängig vom letzten Spielort.
        if (typeof getStadiumInjuryReduction === 'function') injuryChance *= (1 - getStadiumInjuryReduction());
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

        let playedThisMatch = squad.filter(p => lineup.includes(p.id));

        // Moral reagiert auf das Ergebnis: Siege motivieren, Niederlagen drücken die Stimmung.
        let moraleShift = matchResult === 'win' ? 4 : (matchResult === 'loss' ? -6 : (matchResult === 'draw' ? -1 : 0));
        // Führungsspieler-Rat (Kabinen-Dynamik, NEU): ein starker Rat fängt schlechte
        // Stimmung nach Niederlagen etwas ab, ein schwacher verstärkt sie.
        if (matchResult === 'loss' && typeof getLeadershipCouncilMoraleStabilizer === 'function') {
            moraleShift += getLeadershipCouncilMoraleStabilizer();
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
        // kann zur Entlassung führen (siehe checkJobSecurity() weiter unten).
        if (matchResult) {
            let boardShift = matchResult === 'win' ? 2 : (matchResult === 'loss' ? -3 : -1);
            // Ruhiger Pol (Krisenmanager-Perk, NEU): dämpft den Vertrauensverlust beim
            // Vorstand nach Niederlagen - der Manager bleibt auch in schwierigen Phasen
            // glaubwürdig.
            if (matchResult === 'loss' && managerRPG.perks.calmPresence) boardShift = Math.round(boardShift * 0.5);
            game.boardSat = Math.max(1, Math.min(100, game.boardSat + boardShift));
            checkJobSecurity();
            generatePressHeadline(matchResult, isHomeDerby);
            recordHomeAwayResult(isHomeMatchParam, matchResult);
            checkBettingScandalSuspicion(matchResult, matchMargin);
            if (isLiveContext) checkPostMatchInterview(matchResult);
            if (isLiveContext) checkJobOfferApproach();
            checkContractUltimatum();
        }
        checkFanRadioFeedback();
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
        // Holding & Industrie: echte Marktpreis-Schwankungen und Konkurrenzfirmen-Aktivität
        // jeden verarbeiteten Spieltag.
        if (typeof tickRawMaterialPrices === 'function') {
            tickRawMaterialPrices();
            tickCompetitorFirms();
            tickAcquisitionOfferExpiry();
        }
        // Produktionsketten-Countdown (NEU) jeden Spieltag herunterzählen.
        if (typeof tickProductionQueue === 'function') tickProductionQueue();
        // Merchandising: limitierte Edition und saisonale Kollektion jeden Spieltag prüfen.
        if (typeof tickLimitedEditionSales === 'function') {
            tickLimitedEditionSales();
            tickSeasonalCollectionExpiry();
        }
        // Scouting-Netzwerk 2.0 (NEU): Countdown-Missionen und Beobachtungsliste jeden
        // Spieltag weiterentwickeln.
        if (typeof tickScoutingMissions === 'function') {
            tickScoutingMissions();
            tickWatchlist();
        }
        // Stadion-Baustellen (NEU) jeden Spieltag weiterführen.
        if (typeof tickStadiumConstruction === 'function') tickStadiumConstruction();
        // Spieler des Monats (NEU) jeden Spieltag prüfen (wird nur alle 4 SpT tatsächlich vergeben).
        if (typeof checkPlayerOfTheMonth === 'function') checkPlayerOfTheMonth();
        // Tagesform (NEU): schwankt jeden Spieltag neu, leicht durch Moral/Fitness beeinflusst
        // (wer in Form und ausgeruht ist, hat bessere Chancen auf einen guten Tag).
        squad.forEach(p => {
            let bias = ((p.morale || 50) - 50) * 0.15 + ((p.fitness || 100) - 80) * 0.1;
            p.dailyForm = Math.max(5, Math.min(95, Math.round(50 + bias + (Math.random() * 40 - 20))));
        });
        // Sponsoren-Zufriedenheit und Aktivierungs-Events (NEU) jeden Spieltag.
        if (typeof tickSponsorLoyalty === 'function') {
            tickSponsorLoyalty(matchResult);
            checkSponsorActivationEvent();
        }
        // Block-spezifische Fan-Kultur (NEU) jeden Spieltag weiterentwickeln.
        if (typeof tickBlockCultures === 'function') tickBlockCultures();
        // Fan-Zentrale: Cooldown herunterzählen, Traditionsverein-Status und kritischen
        // Fan-Brief prüfen - jeden verarbeiteten Spieltag, unabhängig von Live/Batch-Kontext.
        if (typeof fanCentralState !== 'undefined') {
            if (fanCentralState.scarfContestCooldown > 0) fanCentralState.scarfContestCooldown--;
            if (typeof checkTraditionClubStatus === 'function') checkTraditionClubStatus();
            if (typeof checkCriticalFanLetter === 'function') checkCriticalFanLetter();
        }
        // DFB-Nachfrist-Frühwarnung: einmalig in den letzten Spieltagen der Saison aktiv per
        // Postfach warnen, falls man aufstiegsberechtigt wäre, aber die Lizenz noch fehlt -
        // damit man es nicht verpasst, wenn man den Stadion-Screen nicht besucht.
        if (game.matchday === 30 && !game.dfbGracePeriod) {
            let status = checkDfbLicensingStatus();
            if (status.targetLevel !== null && status.missing.length > 0) {
                let teams = leaguesData[game.leagueLevel];
                let sorted = teams ? [...teams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)) : [];
                let myRank = sorted.findIndex(t => t.name === "1.FC Moritz Leipzig") + 1;
                if (myRank > 0 && myRank <= 2) {
                    addInboxMessage('vertrag', '🚨 DFB-Lizenz-Frühwarnung!', `Du liegst aktuell in Aufstiegsposition, aber die Lizenz für die ${leagueNames[status.targetLevel]} fehlt noch:\n\n${status.missing.map(m => '• ' + m).join('\n')}\n\nNur noch wenige Spieltage bis Saisonende - jetzt nachbessern!`, 'screen-stadium');
                    showToast('🚨 DFB-Lizenz-Frühwarnung: Auflagen für den möglichen Aufstieg noch nicht erfüllt!', 'error');
                }
            }
        }
        // DFB-Nachfrist prüfen: wird jeden Spieltag der neuen Saison ausgewertet, solange
        // eine offene Nachfrist läuft (siehe DFB-Lizenzierung in concludeSeasonAndAdvance()).
        if (game.dfbGracePeriod) {
            let status = checkDfbLicensingStatus();
            if (status.missing.length === 0) {
                // Mängel rechtzeitig behoben: nachträglicher Aufstieg mitten in der laufenden Saison!
                game.leagueLevel = game.dfbGracePeriod.targetLevel;
                game.dfbGracePeriod = null;
                addInboxMessage('vertrag', '🎉 Nachträglicher Aufstieg!', `Die DFB-Auflagen wurden rechtzeitig innerhalb der Nachfrist erfüllt - der Aufstieg in die ${leagueNames[game.leagueLevel]} wird nachträglich vollzogen!`, 'screen-stadium');
                showToast(`🎉 Nachträglicher Aufstieg in die ${leagueNames[game.leagueLevel]}!`, 'success');
            } else {
                game.dfbGracePeriod.deadlineMatchday--;
                if (game.dfbGracePeriod.deadlineMatchday <= 0) {
                    let targetLevel = game.dfbGracePeriod.targetLevel;
                    game.dfbGracePeriod = null;
                    addInboxMessage('vertrag', '📋 DFB-Nachfrist verstrichen', `Die Nachfrist zur Erfüllung der DFB-Auflagen für die ${leagueNames[targetLevel]} ist ohne Erfolg verstrichen - der Aufstieg verfällt endgültig für diese Saison.`, 'screen-stadium');
                    showToast('📋 DFB-Nachfrist verstrichen - Aufstieg endgültig verfallen.', 'error');
                }
            }
        }

        // ---------- KABINEN-CLIQUEN ----------
        // Spieler, die lange genug gemeinsam im Kader sind, werden gelegentlich "beste
        // Freunde" - wird einer von beiden verkauft, leidet kurzzeitig die Moral des anderen
        // (siehe checkFriendshipDeparture() in transfermarket.js).
        squad.forEach(p => { p.squadTenureMatchdays = (p.squadTenureMatchdays || 0) + 1; });
        let unpaired = squad.filter(p => !p.friendPlayerId && (p.squadTenureMatchdays || 0) >= 20);
        if (unpaired.length >= 2 && Math.random() < 0.05) {
            let a = unpaired[Math.floor(Math.random() * unpaired.length)];
            let candidates = unpaired.filter(p => p.id !== a.id);
            let b = candidates[Math.floor(Math.random() * candidates.length)];
            a.friendPlayerId = b.id; b.friendPlayerId = a.id;
            addInboxMessage('vertrag', '🤝 Kabinen-Freundschaft entstanden', `${a.name} und ${b.name} sind in der Kabine beste Freunde geworden.`, 'screen-squad');
        }

        squad.forEach(p => {
            if (lineup.includes(p.id)) p.fitness = Math.max(10, p.fitness - fitLoss);
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
            if ((p.nationalDuty || 0) > 0) {
                p.nationalDuty--;
                if (p.nationalDuty === 0) {
                    // Rückkehr von der Länderspielreise: spürbare Ermüdung, kleines Verletzungsrisiko
                    p.fitness = Math.max(10, p.fitness - 15);
                    if (Math.random() < 0.12) {
                        p.injured = 1 + Math.floor(Math.random() * 2);
                        addInboxMessage('verletzung', `${p.name} verletzt von der Nationalmannschaft zurück`, `Kommt mit einer kleinen Blessur zurück und fällt ${p.injured} Spiel(e) aus.`, 'screen-squad');
                    }
                }
            }
        });

        // Neue Verletzungen/Sperren nur unter Spielern, die diesen Spieltag tatsächlich aufgelaufen sind.
        // Wer schon oft verletzt war, gilt als "verletzungsanfällig" und hat ein höheres
        // individuelles Risiko - ein sich selbst verstärkender Teufelskreis wie im echten Fußball.
        playedThisMatch.forEach(p => {
            p.appearances = (p.appearances || 0) + 1;
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
            if (Math.random() < individualInjuryChance) {
                let baseDuration = Math.floor(Math.random() * 4) + 1; // 1-4 Spiele Ausfallzeit
                let reduction = 1 - (campusBuildings.reha.lvl * 0.08) - (staffMembers.physio.hired ? 0.5 : 0);
                reduction = Math.max(0.25, reduction); // Reha/Physio können Ausfallzeit nie unter 25% drücken
                p.injured = Math.max(1, Math.round(baseDuration * reduction));
                p.timesInjured = (p.timesInjured || 0) + 1;
                let fragileTag = p.timesInjured >= 3 ? ' ⚠️ Wird zunehmend verletzungsanfällig!' : '';
                addInboxMessage('verletzung', `${p.name} verletzt`, `Fällt für ${p.injured} Spiel(e) aus. (${p.timesInjured}. Verletzung in dieser Karriere)${fragileTag}`, 'screen-squad');
            } else if (Math.random() < 0.015) {
                p.suspended = 1; // Platzverweis/Gelb-Sperre: 1 Spiel Sperre
                addInboxMessage('verletzung', `${p.name} gesperrt`, `Fällt für das nächste Spiel gesperrt aus.`, 'screen-squad');
            }
        });

        let cupRoundIdx = cupTournament.matchdays.indexOf(game.matchday);
        if (cupRoundIdx !== -1) simulateCupRound(cupRoundIdx, isLiveContext);

        if (europeTournament.matchdays.includes(game.matchday)) {
            simulateEuropeMatchday(game.matchday, isLiveContext);
        }

        checkNationalTeamCallups(isLiveContext);

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
                    let myTeam = leaguesData[game.leagueLevel].find(t => t.name === "1.FC Moritz Leipzig");
                    let deduction = Math.min(myTeam.points, 3 * (underworld.offenseCount - 1));
                    myTeam.points -= deduction;
                    raidMsg += `\n⚖️ Als Wiederholungstäter (${underworld.offenseCount}. Vergehen) verhängt der Verband zusätzlich einen Punktabzug von ${deduction} Punkten!`;
                }
                alert(raidMsg);
            }
        }

        // Ausschreitungen: nur relevant, wenn wir gerade ein Heim-Derby ausgetragen haben
        if (isHomeDerby) checkHooliganIncident();
        // Ordner-Kosten (NEU, echte Abbuchung): bisher wurde nur im Finanz-Ausblick ein
        // Betrag angezeigt, aber nie wirklich abgebucht - ein weiterer "Phantom-Posten".
        if (typeof tickStewardCosts === 'function') tickStewardCosts();
        if (typeof runSecChiefAutomation === 'function') runSecChiefAutomation();
        // Immobilien-Portfolio (NEU): laufende Mieteinnahmen unabhängig von Heim-/Auswärtsspiel.
        if (typeof tickRealEstateIncome === 'function') tickRealEstateIncome();
        if (typeof tickXpDoublerDuration === 'function') tickXpDoublerDuration();
        if (typeof checkReleaseClauseTriggers === 'function') checkReleaseClauseTriggers();
        if (typeof tickIncomingLoans === 'function') tickIncomingLoans();
        // Jugendliga (NEU): alle 4 Spieltage ein automatisches Jugendliga-Spiel.
        if (game.matchday % 4 === 0 && typeof tickYouthLeague === 'function') tickYouthLeague();
        if (typeof checkSellOnClausePayouts === 'function') checkSellOnClausePayouts();
        if (typeof tickSkillTraining === 'function') tickSkillTraining();
        // Weitere Premium-Booster-Countdowns (NEU).
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
                alert(`☠️ POSITIVER DOPINGTEST!\n${culprit.name} wurde positiv getestet und für 2 Spiele gesperrt.\nSkandal-Strafe: -${formatVal(fine)}, Fans sind entsetzt!`);
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
        tickContractDurations();
        checkIncomingSponsorOffers();
        checkIncomingKitOffers();
        checkIncomingBandenOffers();
        checkIncomingSleeveOffers();
        runFanshopManagerTasks();
        // Erweiterte Personal-Automatisierung (NEU): Chef-Scout, Sportdirektor,
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

        if (game.matchday % 4 === 0) {
            // Portfolio-Diversifikationsbonus (Kapitalmarkt): wer breit gestreut investiert,
            // bekommt einen kleinen Dividenden-Aufschlag auf ALLE gehaltenen Aktien.
            let diversificationBonus = typeof getDiversificationBonus === 'function' ? getDiversificationBonus() : 0;
            let dividends = Math.round(STOCK_KEYS.reduce((sum, key) => {
                let s = stockMarket[key];
                return s ? sum + (s.owned * s.price * (s.dividendRate + diversificationBonus)) : sum;
            }, 0));
            game.money += dividends;
        }

        if (game.matchday === 17 && !game.winterWindowUsedThisSeason) {
            openWinterWindow();
        }

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

        game.matchday++;
        game.viewingMatchday = Math.min(34, game.matchday);
        updateUI();
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

        // Kopf-an-Kopf-Statistik (NEU): historische Bilanz gegen JEDEN Ligagegner, nicht nur
        // den einen festen Erzfeind - nur relevant, wenn 1.FC Moritz Leipzig an dem Spiel beteiligt war.
        if (h.name === "1.FC Moritz Leipzig" || a.name === "1.FC Moritz Leipzig") {
            let oppName = h.name === "1.FC Moritz Leipzig" ? a.name : h.name;
            let ourGoals = h.name === "1.FC Moritz Leipzig" ? f.homeGoals : f.awayGoals;
            let oppGoals = h.name === "1.FC Moritz Leipzig" ? f.awayGoals : f.homeGoals;
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
    // Anhaltend schlechte Vorstands-Stimmung führt jetzt zu echten Konsequenzen: erst eine
    // Warnung, dann im Extremfall die Entlassung. Der Manager behält dabei seine Karriere
    // (Level/XP/Perks) und den Trophäenschrank, fängt aber bei einem neuen (kleineren)
    // Verein wieder ganz unten an - alles andere (Kader, Finanzen, Personal, Stadion,
    // Sponsoren...) wird über denselben bewährten Reload-Mechanismus wie "Neues Spiel
    // starten" komplett zurückgesetzt, damit garantiert nichts vom alten Verein hängen bleibt.
    const BOARD_SAT_WARNING_THRESHOLD = 25;
    const BOARD_SAT_SACK_STREAK = 6;

    function checkJobSecurity() {
        // Schonfrist in der allerersten Saison: ein frischer, bewusst schwacher Startkader in
        // der untersten Liga soll nicht schon in der Aufbauphase zur Entlassung führen können -
        // realistisch bekommt ein neuer Manager bei einem Wiederaufbau-Projekt Zeit. Das
        // vermeidet nebenbei auch unvorhersehbare Seiten-Reloads mitten in Testläufen, die
        // simulateFullSeason() mit dem schwachen Standard-Startkader nutzen.
        if (game.season <= 1) { game.lowBoardSatStreak = 0; return; }

        if (game.boardSat <= BOARD_SAT_WARNING_THRESHOLD) {
            game.lowBoardSatStreak = (game.lowBoardSatStreak || 0) + 1;
        } else {
            game.lowBoardSatStreak = 0;
            game.sackWarningIssued = false;
        }

        if (game.lowBoardSatStreak === 3 && !game.sackWarningIssued) {
            game.sackWarningIssued = true;
            addInboxMessage('vertrag', '⚠️ Job-Warnung vom Vorstand!', 'Der Vorstand ist mit dem sportlichen Verlauf sehr unzufrieden. Bessere die Ergebnisse, sonst droht die Entlassung!', 'screen-dashboard');
            showToast('⚠️ Der Vorstand erwägt deine Entlassung, wenn sich die Ergebnisse nicht bessern!', 'error');
        }

        // Fan-Protest bei Dauerkrise: anhaltend schlechte Ergebnisse lösen organisierte
        // Proteste aus (Banner, Sprechchöre) - zusätzlicher Druck auf Vorstand & Mannschaft.
        if (game.lowBoardSatStreak === 5 && !game.fanProtestActive) {
            game.fanProtestActive = true;
            game.boardSat = Math.max(1, game.boardSat - 5);
            squad.forEach(p => { p.morale = Math.max(10, p.morale - 4); });
            addInboxMessage('vertrag', '📢 Fan-Proteste vor dem Stadion!', 'Enttäuschte Fans organisieren Proteste mit Bannern und Sprechchören gegen die sportliche Krise - der Druck auf Mannschaft und Vorstand steigt zusätzlich.', 'screen-dashboard');
            showToast('📢 Organisierte Fan-Proteste erhöhen den Druck auf den Verein!', 'error');
        }
        if (game.lowBoardSatStreak === 0 && game.fanProtestActive) {
            game.fanProtestActive = false;
            addInboxMessage('vertrag', '✅ Fan-Proteste beendet', 'Nach besseren Ergebnissen sind die Proteste rund um den Verein wieder abgeklungen.', 'screen-dashboard');
        }

        // Legenden-Status-Vorteil: der Vorstand verzeiht einer echten Vereinslegende deutlich
        // mehr, bevor es zur Entlassung kommt (höhere Toleranzschwelle statt Immunität).
        let sackThreshold = BOARD_SAT_SACK_STREAK + (game.legendStatus ? 3 : 0);
        if (game.lowBoardSatStreak >= sackThreshold) {
            getSacked();
        }
    }

    // Dauerhaftes Fan-Fundament nach Erfolgen: Aufstiege/Titel erhöhen die Untergrenze, unter
    // die die Fan-Zufriedenheit selbst nach schlechten Ergebnissen nie wieder fällt - ein
    // Verein mit Erfolgsgeschichte hat eine stabilere, dauerhaft größere Anhängerschaft.
    function boostFanBaseFloor(amount, reason) {
        let before = game.fanBaseFloor;
        game.fanBaseFloor = Math.min(60, game.fanBaseFloor + amount);
        if (game.fanBaseFloor > before) {
            addInboxMessage('vertrag', '📈 Dauerhaft mehr Fans!', `${reason} sorgt für ein dauerhaft höheres Grundinteresse - die Fan-Zufriedenheit fällt jetzt nie mehr unter ${game.fanBaseFloor}%.`, 'screen-dashboard');
        }
    }

    // ---------- AUSWÄRTS-/HEIMBILANZ ----------
    function recordHomeAwayResult(isHomeMatch, matchResult) {
        let rec = isHomeMatch ? game.homeRecord : game.awayRecord;
        if (matchResult === 'win') rec.wins++;
        else if (matchResult === 'draw') rec.draws++;
        else if (matchResult === 'loss') rec.losses++;
    }

    // Ermittelt einen Spitznamen aus dem Vergleich von Heim- und Auswärts-Punkteschnitt -
    // rein informativ, für den Karriere-Rückblick.
    function getAwayFormTitle() {
        let h = game.homeRecord, a = game.awayRecord;
        let hPlayed = h.wins + h.draws + h.losses, aPlayed = a.wins + a.draws + a.losses;
        if (hPlayed < 3 || aPlayed < 3) return 'Noch keine Tendenz erkennbar';
        let hPPG = (h.wins * 3 + h.draws) / hPlayed;
        let aPPG = (a.wins * 3 + a.draws) / aPlayed;
        let diff = aPPG - hPPG;
        if (diff >= 0.5) return '🚀 Auswärtsfestung';
        if (diff <= -0.5) return '😱 Auswärtsfluch';
        return '⚖️ Ausgeglichen Heim/Auswärts';
    }

    // ---------- WETT-SKANDAL-RISIKO ----------
    // Baut auf dem bestehenden Razzia-System (siehe underworld.pressure oben) auf: ein
    // besonders deutlicher Sieg als klarer Außenseiter WÄHREND einer laufenden Bestechungs-
    // Aktion erregt zusätzliche mediale Aufmerksamkeit und treibt den Ermittlungsdruck hoch.
    function checkBettingScandalSuspicion(matchResult, matchMargin) {
        if (matchResult !== 'win' || matchMargin < 3) return;
        if (!underworld.activeSabotages.refBribe && !underworld.activeSabotages.bribeOpponent) return;
        underworld.pressure = Math.min(100, underworld.pressure + 15);
        addInboxMessage('vertrag', '📰 Mediale Aufmerksamkeit', `Der deutliche Sieg (Differenz: ${matchMargin} Tore) sorgt für kritische Nachfragen in der Presse - der Ermittlungsdruck steigt.`, 'screen-underworld');
    }

    // ---------- FAN-RADIO ----------
    // Alle paar Spieltage ein kurzes Fan-Stimmungsbild, das auf konkrete Vereinsentscheidungen
    // reagiert (Ticketpreise, Kadergröße) statt nur auf Ergebnisse.
    function checkFanRadioFeedback() {
        if (game.matchday % 4 !== 0) return;
        let comments = [];
        if (game.fans >= 70) comments.push("„Die Stimmung im Verein ist top, weiter so!“", "„Endlich mal ein Verein, der sich um die Fans kümmert.“");
        if (game.fans <= 30) comments.push("„Die Vereinsführung hat den Kontakt zur Fanszene verloren.“");
        // Bugfix: fester Schwellenwert (15 €) passte nicht mehr zur liga-skalierten
        // Ticketpreis-Formel (siehe getMarketTicketPrice()) - selbst faire Marktpreise in
        // höheren Ligen hätten fälschlich Empörung ausgelöst. Jetzt relativ zum tatsächlichen
        // Marktpreis der jeweiligen Liga bewertet.
        let fairStehPrice = typeof getMarketTicketPrice === 'function' ? getMarketTicketPrice('steh') : 15;
        if (game.ticketPrices.steh > fairStehPrice * 1.6) comments.push("„Die Stehplatzpreise sind mittlerweile eine Frechheit!“");
        if (squad.length >= 20) comments.push("„Ein aufgeblähter Kader - wer soll da noch durchblicken?“");
        if (squad.length <= 14) comments.push("„Dünn besetzter Kader - hoffentlich bleiben wir von Verletzungen verschont.“");
        if (comments.length === 0) comments.push("„Ruhige Woche beim Verein, nichts Aufregendes zu berichten.“", "„Die Fans warten gespannt auf die nächsten Spiele.“");
        let text = comments[Math.floor(Math.random() * comments.length)];
        addInboxMessage('vertrag', '🎙️ Fan-Radio-Kommentar', text, 'screen-dashboard');
    }

    // ---------- TRAINER-REPUTATION: ABWERBEVERSUCHE ANDERER KLUBS ----------
    // Bewusst OHNE echten Vereinswechsel umgesetzt (der Klubname "1.FC Moritz Leipzig" ist an ~50
    // Stellen im Code verankert - eine Umbenennung wäre riskant für dieses Update). Stattdessen
    // nutzt du das Interesse anderer Klubs als Verhandlungshebel beim EIGENEN Vorstand: Geld &
    // Ansehen (annehmen) oder Vereinstreue-Bonus (ablehnen) - beides sind echte, unterschiedliche
    // Belohnungen für eine sportlich erfolgreiche Zwischenbilanz.
    let pendingJobApproach = null;
    function checkJobOfferApproach() {
        if (game.matchday % 6 !== 0) return;
        if (Math.random() > (0.05 + managerRPG.level * 0.01)) return;
        pendingJobApproach = { clubName: generateTeamName() };
        document.getElementById('joboffer-club-name').innerText = pendingJobApproach.clubName;
        document.getElementById('joboffer-overlay').classList.add('show');
    }
    function acceptJobOfferLeverage() {
        if (!pendingJobApproach) return;
        let bonus = Math.round((80000 + managerRPG.level * 15000) / 1000) * 1000;
        game.transferBudget += bonus;
        game.boardSat = Math.min(100, game.boardSat + 8);
        addInboxMessage('vertrag', '💼 Verhandlungserfolg dank Fremdinteresse!', `Mit dem Interesse von ${pendingJobApproach.clubName} im Rücken hat der Vorstand das Transferbudget um ${formatVal(bonus)} aufgestockt, um dich zu halten.`, 'screen-transfer');
        showToast(`💼 +${formatVal(bonus)} Transferbudget durch Verhandlungsgeschick!`, 'success');
        document.getElementById('joboffer-overlay').classList.remove('show');
        pendingJobApproach = null;
        updateUI();
    }
    function declineJobOfferLoyalty() {
        if (!pendingJobApproach) return;
        game.loyaltyDeclineCount = (game.loyaltyDeclineCount || 0) + 1;
        boostFanBaseFloor(4, 'Deine Vereinstreue trotz Abwerbeversuchen');
        game.boardSat = Math.min(100, game.boardSat + 5);
        let bodyText = `Du hast dem Werben von ${pendingJobApproach.clubName} widerstanden - die Fans und der Vorstand honorieren deine Loyalität. (${game.loyaltyDeclineCount}. Ablehnung)`;

        // Wiederholte Vereinstreue wird kumulativ belohnt statt nur mit dem Einzeleffekt
        // oben - ab gewissen Meilensteinen entsteht dauerhafter "Legenden-Status".
        const LOYALTY_MILESTONES = { 3: 6, 5: 10, 10: 20 };
        if (LOYALTY_MILESTONES[game.loyaltyDeclineCount]) {
            let extraFloor = LOYALTY_MILESTONES[game.loyaltyDeclineCount];
            boostFanBaseFloor(extraFloor, `Vereinstreue-Meilenstein (${game.loyaltyDeclineCount}. Ablehnung)`);
            game.boardSat = Math.min(100, game.boardSat + 10);
            if (game.loyaltyDeclineCount >= 10 && !game.legendStatus) {
                game.legendStatus = true;
                game.trophies.push(`Vereinslegende (${game.season}. Saison Treue)`);
                bodyText += `\n👑 LEGENDEN-STATUS erreicht! Du bist jetzt eine echte Vereinslegende.`;
                pendingMilestoneInterviewType = 'legendStatus';
                if (typeof checkLegendSynergyBonus === 'function') checkLegendSynergyBonus();
            }
        }

        addInboxMessage('vertrag', '❤️ Vereinstreue honoriert', bodyText, 'screen-dashboard');
        document.getElementById('joboffer-overlay').classList.remove('show');
        pendingJobApproach = null;
        updateUI();
    }

    // ---------- VERTRAGS-ULTIMATUM UNZUFRIEDENER STARS ----------
    // Ein sehr starker, aber unzufriedener Spieler stellt ein Ultimatum: neuer Vertrag oder
    // Verkauf. Statt einer sofortigen Entscheidung im blockierenden Modal gibt es jetzt eine
    // Frist von 3 Spieltagen mit Erinnerungen - mehr taktischer Spielraum, aber echte
    // Konsequenzen, wenn man es einfach aussitzt.
    function checkContractUltimatum() {
        if (game.activeUltimatumPlayerId) return;
        let candidates = squad.filter(p => p.strength >= 75 && p.morale < 35 && p.contracts <= 2);
        if (candidates.length === 0) return;
        // "Spielerberater-Kontakt"-Perk halbiert die Eskalationswahrscheinlichkeit insgesamt.
        let triggerChance = managerRPG.perks.playerCare ? 0.075 : 0.15;
        if (Math.random() > triggerChance) return;
        let p = candidates[Math.floor(Math.random() * candidates.length)];
        // Ein Berater vermittelt oft frühzeitig und verhindert die offene Eskalation - bei
        // Spielern mit Berater greift eine zusätzliche Chance, dass es gar nicht erst zum
        // öffentlichen Ultimatum kommt (stattdessen eine stille, provisionspflichtige Lösung).
        if (p.agent && Math.random() < 0.5) {
            let commission = Math.max(1500, Math.round(p.marketValue * 0.03));
            if (game.money >= commission) {
                game.money -= commission;
                p.morale = Math.min(100, p.morale + 20);
                game.ultimatumHistory.agentPreEmpted = (game.ultimatumHistory.agentPreEmpted || 0) + 1;
                addInboxMessage('vertrag', `🕴️ Berater vermittelt: ${p.name} beruhigt`, `${p.agent.name} hat frühzeitig vermittelt, bevor es zur offenen Eskalation kam - für ${formatVal(commission)} Provision ist ${p.name} vorerst wieder zufrieden.`, 'screen-squad');
                showToast(`🕴️ Berater von ${p.name} hat vermittelt (${formatVal(commission)})!`, 'success');
                return;
            }
        }
        // Wiederholungstäter: wer schon einmal ein Ultimatum gestellt hat, eskaliert beim
        // nächsten Mal schneller und härter - kürzere Frist, weniger Geduld.
        let repeatCount = p.ultimatumCount || 0;
        let deadlineSpan = Math.max(1, 3 - repeatCount);
        game.activeUltimatumPlayerId = p.id;
        game.ultimatumDeadlineMatchday = game.matchday + deadlineSpan;
        game.ultimatumReminderSent = false;
        game.ultimatumExtensionUsed = false;
        game.ultimatumPressLeakOccurred = false;
        let repeatNote = repeatCount > 0 ? ` Da dies bereits das ${repeatCount + 1}. Mal ist, bleibt diesmal weniger Zeit (${deadlineSpan} statt 3 Spieltage)!` : '';
        addInboxMessage('vertrag', `⚠️ Ultimatum von ${p.name}!`, `${p.name} fordert einen neuen Vertrag oder Verkauf - du hast bis Spieltag ${game.ultimatumDeadlineMatchday} Zeit, dich zu entscheiden.${repeatNote}`, 'screen-squad');
        showToast(`⚠️ ${p.name} stellt ein Ultimatum! Frist: Spieltag ${game.ultimatumDeadlineMatchday}`, 'error');
    }

    // Vorschuss-Zahlung zur einmaligen Fristverlängerung (+2 Spieltage) - hilfreich, wenn
    // man gerade knapp bei Kasse ist und noch etwas Zeit braucht, um das Geld für einen
    // neuen Vertrag zusammenzubekommen.
    function extendUltimatumDeadline() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p || game.ultimatumExtensionUsed) return;
        let advanceFee = Math.max(1000, Math.round(p.wage * 2));
        if (game.money < advanceFee) { showToast(`Nicht genug Geld für den Vorschuss! Benötigt: ${formatVal(advanceFee)}`, 'error'); return; }
        game.money -= advanceFee;
        game.ultimatumDeadlineMatchday += 2;
        game.ultimatumExtensionUsed = true;
        game.ultimatumReminderSent = false;
        addInboxMessage('vertrag', `⏳ Frist verlängert (Vorschuss an ${p.name})`, `${formatVal(advanceFee)} Vorschuss gezahlt - die Frist läuft jetzt bis Spieltag ${game.ultimatumDeadlineMatchday}.`, 'screen-squad');
        showToast(`⏳ Frist um 2 Spieltage verlängert (${formatVal(advanceFee)})!`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        updateUI();
    }

    // Wird jeden Spieltag aufgerufen (siehe processPostMatchRoutine): erinnert einmalig kurz
    // vor Ablauf und bestraft konsequent, wenn die Frist ungenutzt verstreicht.
    function tickContractUltimatum() {
        if (!game.activeUltimatumPlayerId) return;
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) { game.activeUltimatumPlayerId = null; return; } // Spieler ist anderweitig weg (z.B. verkauft)

        let remaining = game.ultimatumDeadlineMatchday - game.matchday;
        // Öffentliche Spieler-Forderung an die Presse (NEU): geht die Frist zäh voran, kann
        // der Spieler von sich aus an die Presse gehen - erhöht den Druck auf den Vorstand,
        // bringt dem Spieler aber gleichzeitig Sympathie bei den eigenen Fans ein, die sein
        // offenes Wort oft nachvollziehen können.
        if (!game.ultimatumPressLeakOccurred && remaining <= 2 && remaining >= 1 && Math.random() < 0.2) {
            game.ultimatumPressLeakOccurred = true;
            game.boardSat = Math.max(1, game.boardSat - 4);
            game.fans = Math.min(100, game.fans + 3);
            addInboxMessage('vertrag', `📰 ${p.name} geht an die Presse!`, `${p.name} hat sein Ultimatum öffentlich gemacht - die Presse berichtet ausführlich. Der Vorstand ist verärgert über die Eskalation, viele Fans zeigen aber Verständnis für die Offenheit.`, 'screen-squad');
            showToast(`📰 ${p.name} hat das Ultimatum öffentlich gemacht!`, 'error');
        }
        if (remaining === 1 && !game.ultimatumReminderSent) {
            game.ultimatumReminderSent = true;
            addInboxMessage('vertrag', `⏰ Ultimatum läuft bald ab!`, `Nur noch 1 Spieltag, um auf das Ultimatum von ${p.name} zu reagieren!`, 'screen-squad');
            showToast(`⏰ Ultimatum von ${p.name} läuft nächsten Spieltag ab!`, 'error');
        }
        if (game.matchday >= game.ultimatumDeadlineMatchday) {
            // Frist verstrichen ohne Reaktion: deutliche, dauerhafte Konsequenz statt eines
            // risikofreien Ignorierens. Zählt in der Karrierestatistik genauso als
            // "ignoriert" wie das explizite Klicken auf den Ignorieren-Button - bisher wurde
            // das passive Verstreichenlassen dort gar nicht mitgezählt.
            game.ultimatumHistory.ignored = (game.ultimatumHistory.ignored || 0) + 1;
            p.morale = Math.max(5, p.morale - 25);
            game.boardSat = Math.max(1, game.boardSat - 5);
            addInboxMessage('vertrag', `😡 Ultimatum verstrichen: ${p.name} tief verärgert!`, `Die Frist ist ungenutzt verstrichen - ${p.name} ist nun offen unzufrieden, die Stimmung im Kader leidet.`, 'screen-squad');
            showToast(`😡 Ultimatum-Frist von ${p.name} verstrichen - Moral eingebrochen!`, 'error');
            game.activeUltimatumPlayerId = null;
            game.ultimatumDeadlineMatchday = null;
        }
    }

    // Nochmal-Chance (Krisenmanager-Perk, NEU): einmal pro Saison lässt sich ein aktives
    // Ultimatum kostenlos und ohne Konsequenzen besänftigen - der Manager nutzt seine
    // Erfahrung, um in letzter Minute doch noch eine gütliche Einigung zu finden.
    function resolveUltimatumSecondChance() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p || !managerRPG.perks.secondChance || game.secondChanceUsedSeason === game.season) return;
        p.morale = Math.min(100, p.morale + 25);
        game.secondChanceUsedSeason = game.season;
        game.activeUltimatumPlayerId = null;
        document.getElementById('ultimatum-overlay').classList.remove('show');
        showToast(`🕊️ Nochmal-Chance genutzt: Das Ultimatum von ${p.name} ist besänftigt - kostenlos!`, 'success');
        renderSquadView();
        updateUI();
    }

    function resolveUltimatumRenew() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) return;
        // Wiederholungstäter fordern beim erneuten Ultimatum auch höhere Ablösen für die
        // Vertragsverlängerung - die Geduld nutzt sich spürbar ab.
        // Eskalationskappung: die Ablöseforderung steigt mit jedem Wiederholungsfall, aber
        // nicht endlos - ab dem 2,5-fachen ist Schluss, damit ein Vielfach-Wiederholungstäter
        // nicht zu einem unbezahlbaren Betrag führt.
        let repeatMult = Math.min(2.5, 1 + (p.ultimatumCount || 0) * 0.4);
        let fee = Math.max(3000, Math.round(p.marketValue * 0.15 * repeatMult));
        if (game.money < fee) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(fee)}`, 'error'); return; }
        game.money -= fee;
        p.contracts += 2;
        p.morale = Math.min(100, p.morale + 30);
        p.ultimatumCount = (p.ultimatumCount || 0) + 1;
        game.ultimatumHistory.renewed = (game.ultimatumHistory.renewed || 0) + 1;
        addInboxMessage('vertrag', `✅ Ultimatum gelöst: ${p.name} bleibt!`, `Der neue Vertrag (${formatVal(fee)}) besänftigt ${p.name} spürbar - Moral deutlich verbessert.`, 'screen-squad');
        showToast(`✅ ${p.name} hat einen neuen Vertrag unterschrieben!`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }
    function resolveUltimatumSell() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) return;
        let sum = Math.round(p.marketValue * 0.75);
        game.money += sum;
        if (typeof checkFriendshipDeparture === 'function') checkFriendshipDeparture(p);
        squad = squad.filter(x => x.id !== p.id);
        lineup = lineup.filter(id => id !== p.id);
        game.ultimatumHistory.sold = (game.ultimatumHistory.sold || 0) + 1;
        addInboxMessage('vertrag', `💰 Ultimatum gelöst: ${p.name} verkauft`, `Um weiteren Unmut zu vermeiden, wurde ${p.name} für ${formatVal(sum)} abgegeben (unter Marktwert wegen der angespannten Situation).`, 'screen-squad');
        showToast(`💰 ${p.name} für ${formatVal(sum)} verkauft.`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }
    function resolveUltimatumIgnore() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (p) {
            p.morale = Math.max(5, p.morale - 15);
            game.ultimatumHistory.ignored = (game.ultimatumHistory.ignored || 0) + 1;
            addInboxMessage('vertrag', `😠 Ultimatum ignoriert: ${p.name} verärgert`, `${p.name} ist sichtlich verärgert über die fehlende Reaktion - die Moral sinkt weiter.`, 'screen-squad');
        }
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }
    // Öffnet das Entscheidungs-Modal bei Bedarf jederzeit während der Frist (statt
    // erzwungen sofort) - aufrufbar über den Hinweis-Banner im Kader-Screen.
    function resolveUltimatumViaAgent() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p || !p.agent) return;
        let commission = Math.max(2000, Math.round(p.marketValue * 0.06));
        if (game.money < commission) { showToast(`Nicht genug Geld! Beraterprovision: ${formatVal(commission)}`, 'error'); return; }
        game.money -= commission;
        p.morale = Math.min(100, p.morale + 22);
        game.ultimatumHistory.renewed = (game.ultimatumHistory.renewed || 0) + 1;
        game.ultimatumHistory.agentMediated = (game.ultimatumHistory.agentMediated || 0) + 1;
        addInboxMessage('vertrag', `🕴️ Ultimatum über Berater gelöst: ${p.name}`, `${p.agent.name} hat für ${formatVal(commission)} Provision vermittelt - ${p.name} ist wieder zufrieden, ganz ohne neuen Vertrag.`, 'screen-squad');
        showToast(`🕴️ Ultimatum über Berater gelöst (${formatVal(commission)})!`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }

    function openUltimatumModal() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) return;
        document.getElementById('ultimatum-player-name').innerText = p.name;
        document.getElementById('ultimatum-player-info').innerText = `Stärke ${p.strength} · Moral ${p.morale}% · Restvertrag: ${p.contracts} Jahr(e) · Frist: Spieltag ${game.ultimatumDeadlineMatchday}${(p.ultimatumCount || 0) > 0 ? ` · ⚠️ ${p.ultimatumCount}. Ultimatum` : ''}`;
        let agentBtn = document.getElementById('btn-ultimatum-agent');
        if (agentBtn) {
            if (p.agent) {
                agentBtn.style.display = 'block';
                let commission = Math.max(2000, Math.round(p.marketValue * 0.06));
                agentBtn.innerText = `🕴️ Über Berater ${p.agent.name} lösen [${formatVal(commission)}]`;
            } else {
                agentBtn.style.display = 'none';
            }
        }
        let extendBtn = document.getElementById('btn-ultimatum-extend');
        let secondChanceBtn = document.getElementById('btn-ultimatum-secondchance');
        if (secondChanceBtn) {
            let available = managerRPG.perks.secondChance && game.secondChanceUsedSeason !== game.season;
            secondChanceBtn.style.display = available ? 'block' : 'none';
        }
        if (extendBtn) {
            if (game.ultimatumExtensionUsed) {
                extendBtn.disabled = true;
                extendBtn.innerText = '⏳ Fristverlängerung bereits genutzt';
            } else {
                extendBtn.disabled = false;
                let advanceFee = Math.max(1000, Math.round(p.wage * 2));
                extendBtn.innerText = `⏳ Vorschuss zahlen, Frist +2 Spieltage [${formatVal(advanceFee)}]`;
            }
        }
        document.getElementById('ultimatum-overlay').classList.add('show');
    }

    function getSacked() {
        playSound('whistle');
        // Karriere (Level/XP/Perks) & Trophäenschrank überleben die Entlassung - alles
        // andere (Kader, Finanzen, Personal, Stadion, Sponsoren, zweite Mannschaft...) wird
        // frisch aufgesetzt, weil der Manager jetzt bei einem NEUEN Verein anfängt.
        safeSessionSet('anstoss_fm13_sacked_managerRPG', JSON.stringify(managerRPG));
        safeSessionSet('anstoss_fm13_sacked_trophies', JSON.stringify(game.trophies || []));
        safeSessionSet('anstoss_fm13_sacked_times', String((game.timesSacked || 0) + 1));
        safeSessionSet('anstoss_fm13_force_new_game', '1');
        alert(`🚪 ENTLASSEN!\nDer Vorstand hat genug gesehen und trennt sich mit sofortiger Wirkung von dir. Deine Karriere-Erfahrung und Trophäen nimmst du mit - bei deinem neuen Klub beginnst du aber wieder ganz von unten.`);
        location.reload();
    }

    // ---------- NATIONALMANNSCHAFTSBERUFUNGEN ----------
    // Alle ~5 Spieltage (simuliert eine Länderspielpause) hat jeder ausreichend starke,
    // verfügbare Spieler eine kleine Chance auf eine Berufung. Bringt Prestige (Fans/XP),
    // kostet aber eine Ausfall-Woche plus Rückkehr-Risiko (Ermüdung/leichte Blessur, siehe
    // Countdown weiter oben in processPostMatchRoutine).
    function checkNationalTeamCallups(isLiveContext = false) {
        if (game.matchday % 5 !== 0) return;
        if (squad.some(p => (p.nationalDuty || 0) > 0)) return; // schon jemand unterwegs
        let eligible = squad.filter(p => p.strength >= 70 && (p.injured || 0) === 0 && (p.suspended || 0) === 0);
        eligible.forEach(p => {
            if (Math.random() < 0.06) {
                p.nationalDuty = 1;
                game.fans = Math.min(100, game.fans + 3);
                if (isLiveContext) addManagerXP(30);
                addInboxMessage('vertrag', '🌍 Nationalmannschaft-Berufung!', `${p.name} wird für die Nationalmannschaft (${p.nation || 'Deutschland'}) nominiert - großes Prestige für den Verein! Fällt das nächste Spiel aus.`, 'screen-squad');
                showToast(`🌍 ${p.name} wurde in die Nationalmannschaft berufen!`, 'success');
            }
        });
    }

    // ---------- PRESSESTIMMEN ----------
    // Kurze Schlagzeile nach jedem Spiel, abhängig vom Ergebnis (inkl. Derby-Sonderfall) -
    // läuft in ALLEN drei Spieltag-Pfaden mit, da sie an processPostMatchRoutine() hängt.
    const PRESS_HEADLINES = {
        win: ["„Big point!“ - {opp} chancenlos gegen unsere Mannschaft.", "Souveräner Auftritt: Die Presse lobt die taktische Disziplin.", "„Genau so weitermachen!“, jubelt die Lokalpresse."],
        draw: ["Remis mit Licht und Schatten - die Presse ist gespalten.", "„Ein Punkt geht in Ordnung“, kommentiert die Fachpresse zurückhaltend.", "Ausgeglichene Partie, ausgeglichenes Presseecho."],
        loss: ["Kritische Stimmen werden lauter nach der Niederlage.", "„Da geht mehr“ - die Presse fordert Antworten vom Trainerteam.", "Enttäuschung überwiegt in den Schlagzeilen nach dem Spiel gegen {opp}."]
    };
    function generatePressHeadline(matchResult, isHomeDerby) {
        let pool = PRESS_HEADLINES[matchResult] || PRESS_HEADLINES.draw;
        let text = pool[Math.floor(Math.random() * pool.length)].replace('{opp}', game.permanentRivalName || 'dem Gegner');
        if (isHomeDerby) text = (matchResult === 'win' ? '🔥 DERBYSIEG! ' : (matchResult === 'loss' ? '😔 Derby-Pleite! ' : '⚖️ Derby-Remis! ')) + text;
        addInboxMessage('vertrag', '📰 Pressestimme', text, 'screen-dashboard');
    }

    // ---------- MANAGER-INTERVIEW-MINISPIEL ----------
    // Nur bei LIVE gespielten Partien (nicht bei Saison-Durchsimulation/Admin-Vorspulen, um
    // die Massensimulation nicht mit blockierenden Dialogen zu unterbrechen) - mit einer
    // gewissen Wahrscheinlichkeit gibt's nach dem Spiel ein kurzes Interview mit 3 Antwort-
    // Optionen, die Fan-/Vorstandsstimmung leicht beeinflussen.
    const INTERVIEW_QUESTIONS = {
        win: { q: "Ein verdienter Sieg heute?", answers: [
            { label: "Ja, tolle Teamleistung!", fans: 3, board: 1 },
            { label: "Wir bleiben bescheiden.", fans: 1, board: 2 },
            { label: "Nur ein Schritt von vielen.", fans: 0, board: 3 }
        ]},
        draw: { q: "Wie bewerten Sie das Remis?", answers: [
            { label: "Ein gerechtes Ergebnis.", fans: 1, board: 1 },
            { label: "Da war heute mehr drin.", fans: 2, board: -1 },
            { label: "Ein wichtiger Punkt für uns.", fans: 0, board: 2 }
        ]},
        loss: { q: "Was lief heute schief?", answers: [
            { label: "Wir übernehmen die Verantwortung.", fans: 2, board: 1 },
            { label: "Der Gegner war einfach besser.", fans: -1, board: -1 },
            { label: "Die Schiedsrichterleistung war fragwürdig.", fans: 3, board: -3 }
        ]}
    };
    // Maßgeschneiderte Interviews zu besonderen Ereignissen - haben Vorrang vor den
    // generischen Nachspiel-Fragen, wenn kürzlich ein Meilenstein erreicht wurde.
    const MILESTONE_INTERVIEW_QUESTIONS = {
        attendanceRecord: { q: "Ein Zuschauerrekord heute - was bedeutet Ihnen das?", answers: [
            { label: "Das zeigt, wie sehr die Fans hinter uns stehen!", fans: 5, board: 1 },
            { label: "Solche Momente sind der Lohn harter Arbeit.", fans: 3, board: 3 },
            { label: "Jetzt müssen wir auf dem Platz liefern.", fans: 1, board: 4 }
        ]},
        legendStatus: { q: "Sie gelten inzwischen als Vereinslegende - wie fühlt sich das an?", answers: [
            { label: "Eine große Ehre, aber der Verein steht über allem.", fans: 4, board: 3 },
            { label: "Ich denke lieber an die Zukunft als an Titel.", fans: 2, board: 4 },
            { label: "Das habe ich mir hart erarbeitet.", fans: 1, board: 2 }
        ]},
        jubilee: { q: "Eine Jubiläumssaison - Zeit für einen Rückblick?", answers: [
            { label: "Eine emotionale Reise mit diesem Verein.", fans: 5, board: 2 },
            { label: "Ich schaue lieber nach vorne.", fans: 1, board: 3 },
            { label: "Ohne die Fans wäre das nicht möglich gewesen.", fans: 4, board: 1 }
        ]}
    };
    let pendingInterview = null;
    let pendingMilestoneInterviewType = null;
    function checkPostMatchInterview(matchResult) {
        // Meilenstein-Interviews haben Vorrang und werden garantiert gestellt (kein
        // Zufalls-Gate wie bei den generischen Nachspiel-Fragen).
        if (pendingMilestoneInterviewType && MILESTONE_INTERVIEW_QUESTIONS[pendingMilestoneInterviewType]) {
            pendingInterview = MILESTONE_INTERVIEW_QUESTIONS[pendingMilestoneInterviewType];
            pendingMilestoneInterviewType = null;
            document.getElementById('interview-question-text').innerText = pendingInterview.q;
            let btnBox = document.getElementById('interview-answers-box');
            btnBox.innerHTML = pendingInterview.answers.map((a, idx) => `<button onclick="answerInterview(${idx})" class="btn-primary" style="margin-bottom:6px;">${a.label}</button>`).join('');
            document.getElementById('interview-overlay').classList.add('show');
            return;
        }
        if (Math.random() > 0.3) return;
        pendingInterview = INTERVIEW_QUESTIONS[matchResult] || INTERVIEW_QUESTIONS.draw;
        document.getElementById('interview-question-text').innerText = pendingInterview.q;
        let btnBox = document.getElementById('interview-answers-box');
        btnBox.innerHTML = pendingInterview.answers.map((a, idx) => `<button onclick="answerInterview(${idx})" class="btn-primary" style="margin-bottom:6px;">${a.label}</button>`).join('');
        document.getElementById('interview-overlay').classList.add('show');
    }
    function answerInterview(idx) {
        if (!pendingInterview) return;
        let a = pendingInterview.answers[idx];
        game.fans = Math.max(1, Math.min(100, game.fans + a.fans));
        game.boardSat = Math.max(1, Math.min(100, game.boardSat + a.board));
        document.getElementById('interview-overlay').classList.remove('show');
        showToast(`🎙️ Interview: Fans ${a.fans >= 0 ? '+' : ''}${a.fans}, Vorstand ${a.board >= 0 ? '+' : ''}${a.board}`, 'success');
        // Interview-Historie: kleines Archiv der eigenen Medien-Auftritte über die Karriere,
        // um den eigenen "Medien-Charakter" im Rückblick nachvollziehen zu können.
        if (!game.interviewHistory) game.interviewHistory = [];
        game.interviewHistory.push({ season: game.season, matchday: game.matchday, question: pendingInterview.q, answer: a.label, fans: a.fans, board: a.board });
        if (game.interviewHistory.length > 30) game.interviewHistory.shift();
        // Manager-Medienimage (NEU): fanfreundliche Antworten schieben das Image Richtung
        // "Volksheld", vorstandstreue Antworten Richtung "Verwaltungsprofi" - unabhängig von
        // Fan-/Vorstands-Zufriedenheit selbst, ein eigener Ruf-Wert des Managers als Person.
        let imageShift = (a.fans - a.board) * 0.8;
        game.managerMediaImage = Math.max(0, Math.min(100, game.managerMediaImage + imageShift));
        pendingInterview = null;
        updateUI();
    }

    // ---------- REISEMODUS ----------
    function setTravelMode(mode) {
        playSound('click');
        game.travelMode = mode;
        ['flugzeug', 'bus'].forEach(m => {
            let btn = document.getElementById('travel-mode-' + m);
            if (btn) btn.className = (m === mode) ? 'btn-action' : 'btn-secondary';
        });
        showToast(mode === 'bus' ? '🚌 Reisemodus: Bus (günstiger, mehr Ermüdung)' : '✈️ Reisemodus: Flugzeug (teurer, weniger Ermüdung)', 'success');
    }

    function finishMatch() { showScreen('screen-dashboard'); }

    // Torschützen-Zuordnung für automatisch simulierte eigene Spiele (NEU): bisher wurden
    // beim "Saison durchsimulieren"/Admin-Vorspulen nur nackte Tordifferenzen berechnet,
    // OHNE die Tore einem Spieler zuzuordnen - individuelle Torstatistiken blieben für den
    // häufigsten Spielmodus (automatische Simulation) komplett leer.
    // Spieler des Monats (NEU): alle 4 Spieltage (in Ermangelung eines echten Kalenders die
    // nächstliegende Saison-Unterteilung) wird der Spieler mit der besten jüngsten Bilanz
    // ausgezeichnet - Tore in diesem Zeitraum zählen am stärksten, Form/Fitness als
    // Tiebreaker. Echte Belohnung: spürbarer Moralschub plus dauerhafter Eintrag im Archiv.
    function checkPlayerOfTheMonth() {
        if (game.matchday % 4 !== 0 || squad.length === 0) return;
        let candidates = squad.map(p => {
            let goalsInPeriod = (p.goalsSeason || 0) - (game.potmGoalSnapshot[p.id] || 0);
            let score = goalsInPeriod * 10 + (p.dailyForm || 50) * 0.3 + (p.fitness || 100) * 0.1;
            return { p, goalsInPeriod, score };
        }).sort((a, b) => b.score - a.score);
        let winner = candidates[0];
        squad.forEach(p => { game.potmGoalSnapshot[p.id] = p.goalsSeason || 0; });
        // Bugfix: Form/Fitness allein ergaben bereits einen positiven Score (z.B. 50*0.3+100*0.1=25),
        // wodurch auch ganz ohne Tore in der Periode jemand ausgezeichnet wurde. Jetzt ist
        // mindestens ein Tor in der Bewertungsperiode zwingend Voraussetzung.
        if (!winner || winner.goalsInPeriod <= 0) return;
        winner.p.morale = Math.min(100, (winner.p.morale || 80) + 8);
        game.playerOfMonthHistory.unshift({ season: game.season, matchday: game.matchday, playerId: winner.p.id, playerName: winner.p.name, goals: winner.goalsInPeriod });
        if (game.playerOfMonthHistory.length > 30) game.playerOfMonthHistory.pop();
        addInboxMessage('vertrag', `🌟 Spieler des Monats: ${winner.p.name}!`, `${winner.p.name} wird für die starke Leistung der letzten Spieltage (${winner.goalsInPeriod} Tore) zum Spieler des Monats gekürt - spürbarer Moralschub!`, 'screen-squad');
        showToast(`🌟 ${winner.p.name} ist Spieler des Monats!`, 'success');
    }
    function renderPlayerOfMonthBox() {
        let box = document.getElementById('player-of-month-box');
        if (!box) return;
        let hist = game.playerOfMonthHistory || [];
        if (hist.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine Auszeichnung vergeben.</div>'; return; }
        box.innerHTML = hist.slice(0, 6).map(h => `<div class="box" style="font-size:10px; display:flex; justify-content:space-between;"><span>🌟 ${h.playerName} (S${h.season}/${h.matchday})</span><span>${h.goals} Tore</span></div>`).join('');
    }
    function renderPlayerOfSeasonBox() {
        let box = document.getElementById('player-of-season-box');
        if (!box) return;
        let hist = game.playerOfSeasonHistory || [];
        if (hist.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine Saison abgeschlossen.</div>'; return; }
        box.innerHTML = hist.map(h => `<div class="box" style="font-size:10px; display:flex; justify-content:space-between;"><span>🏆 ${h.playerName} (Saison ${h.season})</span><span>${h.goals} Tore</span></div>`).join('');
    }

    function attributeGoalsToScorers(goalCount) {
        if (goalCount <= 0) return;
        let starting = squad.filter(p => lineup.includes(p.id));
        if (starting.length === 0) return;
        for (let i = 0; i < goalCount; i++) {
            let scorer = pickWeightedScorer(starting);
            if (scorer) { scorer.goalsSeason = (scorer.goalsSeason || 0) + 1; scorer.goalsCareer = (scorer.goalsCareer || 0) + 1; }
        }
    }

    function simulateFullSeason() {
        if (game.matchday > 34) return;
        while (game.matchday <= 34) {
            let md = game.matchday;
            let isHome = true;
            let won = false;
            let drawn = false;
            let playedOurMatch = false;
            let isHomeDerby = false;
            let opponentNameThisMatch = null;
            let ourGoalsThisMatch = 0;
            let oppGoalsThisMatch = 0;

            rollWeather();
            autoLineup();
            syncSecondTeamIntoLeagueTable();

            for (let l = 0; l < NUM_LEAGUES; l++) {
                let fixs = fixturesData[l] ? fixturesData[l][md - 1] : [];
                fixs?.forEach(f => {
                    if (!f.played) {
                        let hTeam = leaguesData[l][f.home];
                        let aTeam = leaguesData[l][f.away];
                        let hStr = (hTeam.name === "1.FC Moritz Leipzig") ? calcTeamStrength(true) : (aTeam.name === "1.FC Moritz Leipzig" ? applySabotageToOpponentStrength(hTeam.strength) : hTeam.strength);
                        let aStr = (aTeam.name === "1.FC Moritz Leipzig") ? calcTeamStrength(false) : (hTeam.name === "1.FC Moritz Leipzig" ? applySabotageToOpponentStrength(aTeam.strength) : aTeam.strength);

                        let goals = simulateGoals(hStr, aStr, hTeam, aTeam);
                        f.homeGoals = goals.myGoals;
                        f.awayGoals = goals.oppGoals;
                        f.played = true;
                        updateLeagueTable(l, f);

                        // Zweite Mannschaft (NEU): dieselbe Torschützen-Lücke wie beim
                        // ersten Team behoben - bisher wurden ihre Ligaspiele nur als reine
                        // Zahlen simuliert, ohne die Tore realen Spielern im Kader
                        // zuzuordnen.
                        if (game.secondTeam.isActive && typeof attributeGoalsToSecondTeamScorers === 'function') {
                            if (hTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.homeGoals);
                            else if (aTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.awayGoals);
                        }

                        if (hTeam.name === "1.FC Moritz Leipzig") {
                            isHome = true;
                            playedOurMatch = true;
                            won = f.homeGoals > f.awayGoals;
                            drawn = f.homeGoals === f.awayGoals;
                            isHomeDerby = aTeam.name === hTeam.rivalName;
                            opponentNameThisMatch = aTeam.name;
                            ourGoalsThisMatch = f.homeGoals; oppGoalsThisMatch = f.awayGoals;
                        } else if (aTeam.name === "1.FC Moritz Leipzig") {
                            isHome = false;
                            playedOurMatch = true;
                            won = f.awayGoals > f.homeGoals;
                            drawn = f.homeGoals === f.awayGoals;
                            opponentNameThisMatch = hTeam.name;
                            ourGoalsThisMatch = f.awayGoals; oppGoalsThisMatch = f.homeGoals;
                        }
                    }
                });
            }

            if (opponentNameThisMatch) recordRivalryResult(opponentNameThisMatch, ourGoalsThisMatch, oppGoalsThisMatch);
            if (playedOurMatch) attributeGoalsToScorers(ourGoalsThisMatch);
            if (playedOurMatch && (game.forceDerbyMatchdays || []).includes(md)) isHomeDerby = true;
            applyMatchdayFinances(isHome, won, playedOurMatch && oppGoalsThisMatch === 0, isHomeDerby, opponentNameThisMatch, opponentNameThisMatch ? `${ourGoalsThisMatch}:${oppGoalsThisMatch}` : null);
            processPostMatchRoutine(playedOurMatch ? (won ? 'win' : (drawn ? 'draw' : 'loss')) : null, isHomeDerby, false, ourGoalsThisMatch - oppGoalsThisMatch, isHome, playedOurMatch ? { total: ourGoalsThisMatch + oppGoalsThisMatch, bothScored: ourGoalsThisMatch > 0 && oppGoalsThisMatch > 0 } : null);
        }
        updateUI();
        showScreen('screen-dashboard');
    }

    // ---------- SAISONABSCHLUSS-GALA ----------
    // Kleine Award-Zeremonie am Saisonende statt einfach kommentarlos in die nächste Saison
    // zu starten: Spieler der Saison, Tor der Saison, Aufsteiger des Jahres.
    // Publikumsliebling-Wechsel-Vorwarnung: in den letzten Spieltagen der Saison zeigt eine
    // kleine Vorschau, wer aktuell nach den Abstimmungs-Kriterien vorne liegt - baut
    // Vorfreude auf die Gala auf, ohne das exakte (noch zufallsbehaftete) Endergebnis
    // vorwegzunehmen.
    function renderCrowdFavoritePreview() {
        let box = document.getElementById('crowd-favorite-preview-box');
        if (!box) return;
        if (game.matchday < 30 || squad.length === 0) { box.style.display = 'none'; return; }
        let weighted = squad.map(p => ({
            p, weight: 1 + Math.round((p.morale || 50) / 20) + ((p.character === 'Selbstbewusst' || p.character === 'Emotional') ? 2 : 0)
        })).sort((a, b) => b.weight - a.weight);
        let leader = weighted[0]?.p;
        if (!leader) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--gold);">🗳️ <strong style="color:var(--gold);">${leader.name}</strong> liegt aktuell vorne im Rennen um den Publikumsliebling der Saison - die Fan-Abstimmung entscheidet final bei der Saisonabschluss-Gala!</div>`;
    }

    function holdSeasonEndGala() {
        if (squad.length === 0) return;
        let playerOfSeason = [...squad].sort((a, b) => (b.strength * (b.appearances || 1)) - (a.strength * (a.appearances || 1)))[0];
        let riser = [...squad].filter(p => (p.age || 30) <= 21).sort((a, b) => b.strength - a.strength)[0];
        const GOAL_OF_SEASON_FLAVOR = [
            'ein satter Distanzschuss aus 25 Metern ins Torwinkel',
            'ein sehenswerter Fallrückzieher nach Flanke',
            'ein Solo über das halbe Feld mit anschließendem Lupfer',
            'ein präziser Freistoß direkt in den Winkel'
        ];
        let goalFlavor = GOAL_OF_SEASON_FLAVOR[Math.floor(Math.random() * GOAL_OF_SEASON_FLAVOR.length)];
        let goalScorer = playerOfSeason;

        // Gala-Publikumspreis: eine simulierte Fan-Abstimmung kürt einen eigenen
        // "Publikumsliebling", unabhängig vom "Spieler der Saison" - gewichtet nach Moral
        // und Charakter (Publikumslieblinge sind meist "Selbstbewusst" oder "Emotional",
        // nicht zwangsläufig die spielstärksten).
        let voteCandidates = squad.filter(p => p.id !== playerOfSeason.id);
        if (voteCandidates.length === 0) voteCandidates = [...squad];
        let weighted = [];
        voteCandidates.forEach(p => {
            let weight = 1 + Math.round((p.morale || 50) / 20) + ((p.character === 'Selbstbewusst' || p.character === 'Emotional') ? 2 : 0);
            for (let i = 0; i < weight; i++) weighted.push(p);
        });
        let publikumsliebling = weighted[Math.floor(Math.random() * weighted.length)] || playerOfSeason;
        publikumsliebling.morale = Math.min(100, publikumsliebling.morale + 12);
        // Sonderedition: der Publikumsliebling trägt bis zur nächsten Gala ein besonderes
        // Ehrenabzeichen (sichtbar im Kader & auf der Taktiktafel), vorherige Träger verlieren
        // den Status automatisch.
        squad.forEach(pl => { pl.isCrowdFavorite = false; });
        publikumsliebling.isCrowdFavorite = true;
        // Mehrjähriger Verlauf für die Museums-Ehrengalerie (siehe crestHistory-Vorbild).
        if (!game.crowdFavoriteHistory) game.crowdFavoriteHistory = [];
        game.crowdFavoriteHistory.push({ name: publikumsliebling.name, season: game.season });
        if (game.crowdFavoriteHistory.length > 20) game.crowdFavoriteHistory.shift();

        playerOfSeason.morale = Math.min(100, playerOfSeason.morale + 15);
        game.fans = Math.min(100, game.fans + 5);
        if (riser && riser.id !== playerOfSeason.id) riser.morale = Math.min(100, riser.morale + 10);

        let body = `🏅 Spieler der Saison: <strong>${playerOfSeason.name}</strong> (Stärke ${playerOfSeason.strength})\n` +
            `⚽ Tor der Saison: <strong>${goalScorer.name}</strong> mit ${goalFlavor}\n` +
            `❤️ Publikumsliebling der Saison: <strong>${publikumsliebling.name}</strong> (Fan-Abstimmung)\n` +
            (riser ? `🌟 Aufsteiger des Jahres: <strong>${riser.name}</strong> (${riser.age || '-'} Jahre, Stärke ${riser.strength})` : '');
        addInboxMessage('vertrag', `🎊 Saisonabschluss-Gala ${game.season}`, body, 'screen-squad');
        showToast(`🎊 Saisonabschluss-Gala: ${playerOfSeason.name} ist Spieler der Saison!`, 'success');
    }

    function concludeSeasonAndAdvance() {
        // Kopie statt In-Place-Sortierung, aus Konsistenz mit renderLeagueView() -
        // auch wenn die Saison hier bereits vorbei ist, bleibt so die Originaldatenstruktur
        // unangetastet, falls andere Screens (z.B. Historie) noch darauf zugreifen.
        // Bugfix: die ANGEZEIGTE Tabelle sortiert bei Punktgleichstand nach Tordifferenz
        // (siehe renderLeagueView() in leagues.js), aber diese Aufstiegs-Berechnung sortierte
        // bisher NUR nach Punkten - bei einem Punktgleichstand am Saisonende konnte der
        // tatsächlich berechnete Rang dadurch von dem in der Tabelle angezeigten Rang
        // abweichen (Einfüge-Reihenfolge statt Tordifferenz entschied). Jetzt identische
        // Sortierlogik wie in der Tabellenanzeige.
        let teams = [...leaguesData[game.leagueLevel]].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
        let myRank = teams.findIndex(t => t.name === "1.FC Moritz Leipzig") + 1;
        let myTeamRecord = leaguesData[game.leagueLevel].find(t => t.name === "1.FC Moritz Leipzig");

        // Medienrechte (NEU): Liga-Kollektiv-TV-Ausschüttung zum Saisonende, gestaffelt nach
        // Ligastärke UND Tabellenplatz.
        if (typeof calculateCollectiveTvMoney === 'function') {
            let tvPayout = calculateCollectiveTvMoney(game.leagueLevel, myRank);
            game.money += tvPayout;
            game.lastLeagueTvPayout = tvPayout;
            addInboxMessage('vertrag', `📺 Liga-TV-Ausschüttung: ${formatVal(tvPayout)}!`, `Für Platz ${myRank} in der Liga erhält der Verein ${formatVal(tvPayout)} aus dem kollektiven TV-Vertrag der Liga.`, 'screen-finances');
            mediaRights.seasonTvIncomeTotal = 0;
        }

        // Perfekte Saison: keine einzige Ligaspiel-Niederlage über die komplette Spielzeit.
        if (myTeamRecord && myTeamRecord.played >= 30 && myTeamRecord.lost === 0) {
            let bonus = 500000;
            game.money += bonus;
            game.trophies.push(`Ungeschlagene Saison (Saison ${game.season})`);
            boostFanBaseFloor(12, 'Die historische ungeschlagene Saison');
            addManagerXP(600);
            alert(`🌟 PERFEKTE SAISON!\nKeine einzige Niederlage in ${myTeamRecord.played} Ligaspielen! Diese historische Leistung wird mit ${formatVal(bonus)}, einer Sonder-Trophäe und dauerhaft mehr Fan-Fundament gewürdigt.`);
        }

        holdSeasonEndGala();
        checkRivalChangeEvent();
        if (typeof tickMediaImageSeasonHistory === 'function') tickMediaImageSeasonHistory();

        if (game.leagueLevel === 0 && myRank <= 4) {
            game.inEurope = true;
            alert("🌟 CHAMPIONS CUP QUALIFIKATION!\nDu hast Platz " + myRank + " erreicht und spielst nächste Saison in der europäischen Königsklasse!");
        }

        if (myRank <= 2 && game.leagueLevel > 0) {
            // ---------- DFB-LIZENZIERUNG ----------
            // Bisher war Aufstieg rein eine Frage des Tabellenplatzes - real verlangt der DFB
            // vor dem Aufstieg aber eine Lizenzierung (Stadionstandard, Flutlicht, finanzielle
            // Mindestreserve, Jugendarbeit). Ein Tabellenplatz allein reicht ab jetzt nicht mehr.
            let targetLevel = game.leagueLevel - 1;
            let req = DFB_LICENSING_REQUIREMENTS[targetLevel];
            let failedReasons = [];
            if (req.minCapacity > 0 && stadium.total < req.minCapacity) failedReasons.push(`Stadionkapazität zu gering (${stadium.total.toLocaleString('de-DE')} von benötigten ${req.minCapacity.toLocaleString('de-DE')})`);
            if (req.floodlight && !stadium.flutlicht) failedReasons.push('Kein Flutlicht installiert');
            if (req.minMoney > 0 && game.money < req.minMoney) failedReasons.push(`Finanzielle Mindestreserve nicht erfüllt (${formatVal(game.money)} von benötigten ${formatVal(req.minMoney)})`);
            if (req.minYouthLvl > 0 && (campusBuildings.internat?.lvl || 0) < req.minYouthLvl) failedReasons.push(`Jugendinternat zu niedrig ausgebaut (Stufe ${campusBuildings.internat?.lvl || 0} von benötigter Stufe ${req.minYouthLvl})`);

            if (failedReasons.length > 0) {
                game.licenseRejectionCount = (game.licenseRejectionCount || 0) + 1;
                // Nachfrist statt sofortiger endgültiger Verweigerung: bei knapp verfehlten
                // Auflagen bekommt man 3 Spieltage der neuen Saison Zeit, die Mängel noch zu
                // beheben - erst wenn auch die Nachfrist verstreicht, verfällt der Aufstieg
                // endgültig für diese Saison.
                game.dfbGracePeriod = { targetLevel, deadlineMatchday: 3, originalLeagueLevel: game.leagueLevel };
                addInboxMessage('vertrag', '📋 DFB-Lizenz vorläufig verweigert - Nachfrist eingeräumt!', `Sportlich hättest du den Aufstieg in die ${leagueNames[targetLevel]} geschafft, aber der DFB verweigert vorerst die Lizenz:\n\n${failedReasons.map(r => '• ' + r).join('\n')}\n\nDu hast 3 Spieltage Zeit, die Mängel zu beheben - schaffst du das, wird der Aufstieg nachträglich noch vollzogen!`, 'screen-stadium');
                alert(`📋 DFB-LIZENZ VORLÄUFIG VERWEIGERT!\nSportlich wäre der Aufstieg in die ${leagueNames[targetLevel]} geschafft - der DFB räumt dir aber erst eine Nachfrist von 3 Spieltagen ein, um die fehlenden Auflagen zu erfüllen:\n\n${failedReasons.map(r => '• ' + r).join('\n')}`);
            } else {
                game.leagueLevel--;
                game.money += 1500000;
                let sponsorPromoBonus = game.sponsor.promotionBonus || 0;
                if (sponsorPromoBonus > 0) game.money += sponsorPromoBonus;
                addManagerXP(1000);
                boostFanBaseFloor(6, `Der Aufstieg in die ${leagueNames[game.leagueLevel]}`);
                alert(`🎉 AUFSTIEG! Glückwunsch zur Beförderung in die ${leagueNames[game.leagueLevel]}! (+1.500.000 € Aufstiegsprämie${sponsorPromoBonus > 0 ? ` + ${formatVal(sponsorPromoBonus)} Sponsoren-Aufstiegsbonus` : ''})`);
            }
        } else if (myRank >= 16 && game.leagueLevel < NUM_LEAGUES - 1) {
            game.leagueLevel++;
            alert("❌ ABSTIEG! Du konntest die Klasse leider nicht halten.");
        }

        // Der Vorstand legt zu Saisonbeginn neue Budgets fest - abhängig von Ligastärke
        // und Abschneiden der Vorsaison, statt eines für immer fixen Startwerts.
        // Wirtschaftliche Konsistenz (NEU): die alte Formel (Basis 60.000/10.000) ergab in
        // der höchsten Liga nur ~35.000-45.000 € Gehaltsbudget PRO SPIELTAG für den GESAMTEN
        // Kader - ein einzelner Weltklassespieler kann laut calculatePlayerWage() aber bis zu
        // 900.000 €/Spieltag kosten. Nach der realistischen Stadion-Preisreform (teils 40+
        // Mio. € Bauprojekte) musste auch dieser Teil der Wirtschaft entsprechend mitziehen.
        let leagueFactor = (NUM_LEAGUES - game.leagueLevel) / NUM_LEAGUES;
        let placementFactor = myRank <= 4 ? 1.3 : (myRank <= 10 ? 1.0 : 0.8);
        game.transferBudget = Math.round(2500000 * (1 + leagueFactor * 2.5) * placementFactor);
        game.wageBudget = Math.round(450000 * (1 + leagueFactor * 2.5) * placementFactor);
        // Manager-Eigengehalt (NEU): blieb bisher für immer beim Startwert (1.200 €/SpT),
        // selbst nach mehreren Aufstiegen in die Bundesliga mit Millionenbudgets - ein
        // erfolgreicher Bundesliga-Trainer verdient real deutlich mehr als ein Kreisliga-
        // Einsteiger. Skaliert jetzt mit derselben Liga-/Erfolgsformel wie die Vereinsbudgets.
        let newManagerWage = Math.round(1200 * (1 + leagueFactor * 2.5) * placementFactor);
        if (newManagerWage > privateLife.wage) privateLife.wage = newManagerWage;

        // Spieler der Saison (NEU): letzte Auswertung der Torsaison, bevor goalsSeason
        // zurückgesetzt wird - ergänzt "Spieler des Monats" um eine Saison-Gesamtwürdigung.
        let seasonTopScorer = [...squad].sort((a, b) => (b.goalsSeason || 0) - (a.goalsSeason || 0))[0];
        if (seasonTopScorer && (seasonTopScorer.goalsSeason || 0) > 0) {
            if (!game.playerOfSeasonHistory) game.playerOfSeasonHistory = [];
            game.playerOfSeasonHistory.unshift({ season: game.season, playerId: seasonTopScorer.id, playerName: seasonTopScorer.name, goals: seasonTopScorer.goalsSeason });
            if (game.playerOfSeasonHistory.length > 15) game.playerOfSeasonHistory.pop();
            seasonTopScorer.morale = Math.min(100, (seasonTopScorer.morale || 80) + 12);
            addInboxMessage('vertrag', `🏆 Spieler der Saison: ${seasonTopScorer.name}!`, `Mit ${seasonTopScorer.goalsSeason} Saisontoren wird ${seasonTopScorer.name} zum Spieler der Saison gekürt - ein deutlicher Moralschub für die neue Spielzeit!`, 'screen-history');
        }

        squad.forEach(p => {
            p.contracts--;
            p.fitness = 100;
            // Spielerwert-Entwicklungs-Historie (NEU): ein Schnappschuss pro Saison, damit im
            // Spieler-Detail eine echte Entwicklungskurve statt nur des aktuellen Werts
            // angezeigt werden kann.
            if (!p.strengthHistory) p.strengthHistory = [];
            p.strengthHistory.push({ season: game.season, strength: p.strength });
            if (p.strengthHistory.length > 15) p.strengthHistory.shift();
            p.goalsSeason = 0;
        });
        // Bugfix: Spieler mit ausgelaufenem Vertrag verschwanden bisher komplett
        // stillschweigend aus dem Kader - keine Benachrichtigung, keine Rücksicht auf einen
        // eventuellen Publikumsliebling-Status. Jetzt wird jeder Bosman-Abgang sauber
        // gemeldet, bevor der Spieler den Kader verlässt.
        let expiredPlayers = squad.filter(p => p.contracts <= 0);
        expiredPlayers.forEach(p => {
            addInboxMessage('vertrag', `📋 Vertrag ausgelaufen: ${p.name}`, `Der Vertrag von ${p.name} ist ausgelaufen - er verlässt den Verein ablösefrei (Bosman-Regel).`, 'screen-squad');
            if (typeof checkCrowdFavoriteDeparture === 'function') checkCrowdFavoriteDeparture(p);
        });
        // Vorwarnung (NEU): wer nur noch 1 Jahr Restlaufzeit hat, wird jetzt aktiv gemeldet,
        // statt dass der Manager es zufällig in der Vertragsliste entdecken muss.
        squad.filter(p => p.contracts === 1 && p.strength >= 50).forEach(p => {
            addInboxMessage('vertrag', `⏳ Vertrag läuft aus: ${p.name}`, `${p.name} hat nur noch 1 Jahr Vertrag - jetzt verlängern, sonst verlässt er den Verein am Saisonende ablösefrei!`, 'screen-contracts');
        });
        squad = squad.filter(p => p.contracts > 0);
        if (squad.length < 11) {
            // Notbesetzung: Positionsverteilung wie im Standardkader (2 TW/6 ABW/6 MIT/4 ST),
            // damit garantiert ein spielbares Team entsteht (nicht rein zufällige Positionen).
            let emergencyPlan = [];
            for (let i = 0; i < 2; i++) emergencyPlan.push('TW');
            for (let i = 0; i < 6; i++) emergencyPlan.push('ABW');
            for (let i = 0; i < 6; i++) emergencyPlan.push('MIT');
            for (let i = 0; i < 4; i++) emergencyPlan.push('ST');
            let existingByPos = { TW: 0, ABW: 0, MIT: 0, ST: 0 };
            squad.forEach(p => { if (existingByPos[p.pos] !== undefined) existingByPos[p.pos]++; });
            let toFill = [];
            emergencyPlan.forEach(pos => { if (existingByPos[pos] > 0) existingByPos[pos]--; else toFill.push(pos); });
            let emergencyBase = Math.max(25, 82 - game.leagueLevel * 10 - 14);
            toFill.forEach(pos => squad.push(createPlayer(pos, emergencyBase, emergencyBase + 8)));
            alert("⚠️ VERTRAGSKRISE!\nZu viele Spieler haben deinen Verein aufgrund auslaufender Verträge verlassen. Der Notfall-Kader wurde automatisch mit neuen Spielern aufgefüllt. Achte künftig auf die Vertragslaufzeiten deines Kaders!");
        }

        incomingOffers = [];
        game.season++;
        checkJubileeCrestUnlock();
        // Leihverein-Beziehungen schwächen sich ab, wenn 2+ Saisons kein neues Geschäft mit
        // demselben Klub stattfand - Kontakte pflegen sich nicht von selbst.
        for (let club in loanClubRelationships) {
            let lastSeason = loanClubLastInteractionSeason[club] || 0;
            if (game.season - lastSeason >= 2 && loanClubRelationships[club] > 0) {
                loanClubRelationships[club] = Math.max(0, loanClubRelationships[club] - 1);
                loanClubLastInteractionSeason[club] = game.season - 1; // verhindert sofortigen erneuten Abbau nächste Saison
            }
        }
        // Nervenkrieg-Abkühlung: ohne ein weiteres Elfmeterschießen gegen den Rivalen legt
        // sich die Anspannung über die Zeit langsam wieder, statt für immer maximal zu bleiben.
        if ((rivalryRecord.shootoutsVsRival || 0) > 0) {
            game.seasonsSinceLastRivalShootout = (game.seasonsSinceLastRivalShootout || 0) + 1;
            if (game.seasonsSinceLastRivalShootout >= 3) {
                rivalryRecord.shootoutsVsRival = Math.max(0, rivalryRecord.shootoutsVsRival - 1);
                game.seasonsSinceLastRivalShootout = 0;
                if (rivalryRecord.shootoutsVsRival < 2) {
                    addInboxMessage('vertrag', '😌 Nervenkrieg klingt ab', `Ohne ein weiteres Elfmeterschießen gegen ${game.permanentRivalName || 'den Rivalen'} lässt die besondere Anspannung bei diesem Duell langsam nach.`, 'screen-history');
                }
            }
        }
        game.matchday = 1;
        game.viewingMatchday = 1;
        game.winterWindowUsedThisSeason = false;
        game.winterWindowActive = false;
        processSecondTeamSeasonEnd();
        forceSponsorRenewalAtSeasonStart();
        if (typeof checkSeasonMoodTargetResult === 'function') checkSeasonMoodTargetResult();
        advanceLeaguesToNewSeason();
        refreshTransferMarket();
        autoLineup();
        updateUI();
        showScreen('screen-dashboard');
        showSeasonReviewSummary(myRank, myTeamRecord);
    }

    // ---------- SAISON-RÜCKBLICK-ZUSAMMENFASSUNG ----------
    // Ein zusammenfassender Bildschirm mit den wichtigsten Kennzahlen der beendeten Saison,
    // statt dass sich alles nur über einzelne, verstreute Postfach-Nachrichten erschließt.
    function showSeasonReviewSummary(myRank, myTeamRecord) {
        let seasonAttendances = (game.attendanceHistory || []).filter(e => e.season === game.season - 1);
        let avgAttendance = seasonAttendances.length > 0 ? Math.round(seasonAttendances.reduce((s, e) => s + e.attendance, 0) / seasonAttendances.length) : 0;
        let weeklyStats = typeof computeWeeklyTrainingStats === 'function' ? computeWeeklyTrainingStats() : { risk: 0 };
        let chemStats = typeof getLineupChemistryStats === 'function' ? getLineupChemistryStats() : { percent: 0 };
        let dfbStatus = typeof checkDfbLicensingStatus === 'function' ? checkDfbLicensingStatus() : { targetLevel: null, missing: [] };
        let dfbText = dfbStatus.targetLevel === null ? 'Höchste Liga bereits erreicht' : (dfbStatus.missing.length === 0 ? `✅ Bereit für die ${leagueNames[dfbStatus.targetLevel]}` : `📋 ${dfbStatus.missing.length} Auflage(n) offen für die ${leagueNames[dfbStatus.targetLevel]}`);

        // Karriere-Archiv: jede Saison-Zusammenfassung wird dauerhaft gespeichert, damit man
        // frühere Saisons im direkten Vergleich nebeneinander sehen kann.
        let entry = { season: game.season - 1, rank: myRank, points: myTeamRecord?.points || 0, avgAttendance, chemistry: chemStats.percent, trophyCount: (game.trophies || []).length };
        if (!game.seasonReviewArchive) game.seasonReviewArchive = [];
        game.seasonReviewArchive.push(entry);
        if (game.seasonReviewArchive.length > 30) game.seasonReviewArchive.shift();

        let prevSeason = game.seasonReviewArchive.length >= 2 ? game.seasonReviewArchive[game.seasonReviewArchive.length - 2] : null;
        let compareArrow = (curr, prev, higherIsBetter = true) => {
            if (prev === null) return '';
            let diff = curr - prev;
            if (diff === 0) return ' <span style="color:var(--text-muted);">(=)</span>';
            let good = higherIsBetter ? diff > 0 : diff < 0;
            return ` <span style="color:${good ? 'var(--primary)' : 'var(--danger)'};">(${diff > 0 ? '+' : ''}${diff} ${good ? '▲' : '▼'})</span>`;
        };

        document.getElementById('season-review-content').innerHTML = `
            <div style="text-align:center; margin-bottom:10px;">
                <div style="font-size:15px; font-weight:900; color:var(--accent);">📆 SAISON-RÜCKBLICK</div>
                <div style="font-size:11px; color:var(--text-muted);">Tabellenplatz ${myRank} · ${myTeamRecord?.points || 0} Punkte${prevSeason ? compareArrow(myTeamRecord?.points || 0, prevSeason.points) : ''}</div>
            </div>
            <div class="modal-field-grid">
                <span class="label">Zuschauerschnitt:</span><span class="val">${avgAttendance.toLocaleString('de-DE')}${prevSeason ? compareArrow(avgAttendance, prevSeason.avgAttendance) : ''}</span>
                <span class="label">Zuschauerrekord:</span><span class="val">${(game.recordAttendance || 0).toLocaleString('de-DE')}</span>
                <span class="label">Trainingsbelastung:</span><span class="val">${weeklyStats.risk}% Verletzungsrisiko</span>
                <span class="label">Team-Chemie:</span><span class="val">${chemStats.percent}%${prevSeason ? compareArrow(chemStats.percent, prevSeason.chemistry) : ''}</span>
                <span class="label">DFB-Lizenzstatus:</span><span class="val">${dfbText}</span>
                <span class="label">Trophäen gesamt:</span><span class="val">${(game.trophies || []).length}</span>
            </div>
            ${game.seasonReviewArchive.length > 1 ? `
            <div style="font-size:10px; font-weight:800; color:var(--text-muted); margin:10px 0 4px 0;">Frühere Saisons im Vergleich</div>
            <div style="max-height:100px; overflow-y:auto;">
                ${game.seasonReviewArchive.slice(-6).reverse().map(e => `<div class="player-row" style="font-size:9px;"><span>Saison ${e.season}</span><span>Platz ${e.rank} · ${e.points} Pkt · ${e.avgAttendance.toLocaleString('de-DE')} Zuschauer</span></div>`).join('')}
            </div>
            <div style="font-size:10px; font-weight:800; color:var(--text-muted); margin:10px 0 4px 0;">Zuschauerschnitt-Verlauf</div>
            ${renderSeasonArchiveChart()}` : ''}
        `;
        document.getElementById('season-review-overlay').classList.add('show');
    }

    // Karriere-Archiv als Diagramm: Verlauf des Zuschauerschnitts über die gespeicherten
    // Saisons als kleiner Balkenverlauf, analog zum Zuschauer-Chart im Fans-Screen.
    function renderSeasonArchiveChart() {
        let history = (game.seasonReviewArchive || []).slice(-8);
        if (history.length < 2) return '';
        let maxVal = Math.max(...history.map(e => e.avgAttendance), 1);
        return `<div style="display:flex; align-items:flex-end; gap:3px; height:50px; background:rgba(0,0,0,0.2); border-radius:6px; padding:5px;">
            ${history.map(e => {
                let heightPct = Math.max(4, Math.round((e.avgAttendance / maxVal) * 100));
                return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;" title="Saison ${e.season}: ${e.avgAttendance.toLocaleString('de-DE')}">
                    <div style="width:100%; height:${heightPct}%; background:linear-gradient(to top, var(--violet), var(--accent)); border-radius:2px 2px 0 0; min-height:3px;"></div>
                </div>`;
            }).join('')}
        </div>`;
    }

