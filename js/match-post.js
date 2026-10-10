/* eslint-disable no-undef */
    // ---------- JOB-SICHERHEIT ----------
    // Anhaltend schlechte Vorstands-Stimmung führt jetzt zu echten Konsequenzen: erst eine
    // Warnung, dann im Extremfall die Entlassung. Der Manager behält dabei seine Karriere
    // (Level/XP/Perks) und den Trophäenschrank, fängt aber bei einem neuen (kleineren)
    // Verein wieder ganz unten an - alles andere (Kader, Finanzen, Personal, Stadion,
    // Sponsoren...) wird über denselben bewährten Reload-Mechanismus wie "Neues Spiel
    // starten" komplett zurückgesetzt, damit garantiert nichts vom alten Verein hängen bleibt.
    const BOARD_SAT_WARNING_THRESHOLD = 25;
    const BOARD_SAT_SACK_STREAK = 6;
    const BOARD_RESTART_TRUST = 60;

    function checkJobSecurity() {
        // Schonfrist in der allerersten Saison: ein frischer, bewusst schwacher Startkader in
        // der untersten Liga soll nicht schon in der Aufbauphase zur Entlassung führen können -
        // realistisch bekommt ein neuer Manager bei einem Wiederaufbau-Projekt Zeit. Das
        // vermeidet nebenbei auch unvorhersehbare Seiten-Reloads mitten in Testläufen, die
        // simulateFullSeason() mit dem schwachen Standard-Startkader nutzen.
        if (game.season <= 1) { game.lowBoardSatStreak = 0; return; }
        game.boardSatVerlauf = [...(game.boardSatVerlauf || []), Math.round(game.boardSat)].slice(-7);

        if (game.boardSat <= BOARD_SAT_WARNING_THRESHOLD) {
            game.lowBoardSatStreak = (game.lowBoardSatStreak || 0) + 1;
        } else {
            game.lowBoardSatStreak = 0;
            game.sackWarningIssued = false;
        }

        // Frühwarnung (25.23): der Vorstand meldet sich schon, wenn das Vertrauen erstmals unter 50 fällt -
        // der Langzeit-Bot sank von 99 über 76 und 36 auf 13, die erste Meldung kam erst bei 25.
        // 25.26: auch wenn das Vertrauen unter 60 dreimal in Folge fällt - so kommt die Warnung vor dem Tiefpunkt.
        const letzte3 = (game.boardSatVerlauf || []).slice(-3);
        const fallend = letzte3.length === 3 && letzte3[0] > letzte3[1] && letzte3[1] > letzte3[2];
        if ((game.boardSat < 50 || (game.boardSat < 60 && fallend)) && game.boardEarlyWarnSeason !== game.season) {
            game.boardEarlyWarnSeason = game.season;
            if (typeof writeAutoSaveNow === 'function') writeAutoSaveNow();
            addInboxMessage('vertrag', '📉 Der Vorstand wird unruhig', `Die Zufriedenheit des Vorstands ist auf ${Math.round(game.boardSat)} gefallen. Noch ist es kein Problem, aber die nächsten Ergebnisse entscheiden. Der Vorstandsraum zeigt, wer warum unzufrieden ist.`, 'screen-dashboard');
        }

        if (game.lowBoardSatStreak === 3 && !game.sackWarningIssued) {
            game.sackWarningIssued = true;
            const erwartetRang = game.seasonExpectation && game.seasonExpectation.expectedRank;
            addInboxMessage('vertrag', '⚠️ Job-Warnung vom Vorstand!', `Der Vorstand ist mit dem sportlichen Verlauf sehr unzufrieden: Vertrauen ${Math.round(game.boardSat)} von 100, ${game.lowBoardSatStreak} Pflichtspiele in Folge unter der Warnschwelle${erwartetRang ? `, Erwartung für diese Saison: Platz ${erwartetRang}` : ''}. Bessere die Ergebnisse - Siege im Liga-Spiel heben das Vertrauen, am Saisonende zählt der Stand - sonst droht die Entlassung!`, 'screen-dashboard');
            showToast('⚠️ Der Vorstand erwägt deine Entlassung, wenn sich die Ergebnisse nicht bessern!', 'error');
        }

        // Fan-Protest bei Dauerkrise: anhaltend schlechte Ergebnisse lösen organisierte
        // Proteste aus (Banner, Sprechchöre) - zusätzlicher Druck auf Vorstand & Mannschaft.
        if (game.lowBoardSatStreak === 5 && !game.fanProtestActive) {
            game.fanProtestActive = true;
            game.boardSat = Math.max(10, game.boardSat - 5);
            squad.forEach(p => { p.morale = Math.max(10, p.morale - 4); });
            addInboxMessage('vertrag', '📢 Fan-Proteste vor dem Stadion!', 'Enttäuschte Fans organisieren Proteste mit Bannern und Sprechchören gegen die sportliche Krise - der Druck auf Mannschaft und Vorstand steigt zusätzlich.', 'screen-dashboard');
            showToast('📢 Organisierte Fan-Proteste erhöhen den Druck auf den Verein!', 'error');
        }
        if (game.lowBoardSatStreak === 0 && game.fanProtestActive) {
            game.fanProtestActive = false;
            addInboxMessage('vertrag', '✅ Fan-Proteste beendet', 'Nach besseren Ergebnissen sind die Proteste rund um den Verein wieder abgeklungen.', 'screen-dashboard');
        }

    }

    // Entlassung nur am Saisonende (concludeSeasonAndAdvance): mitten in der Saison kann der
    // Vorstand nach einer schwachen Serie wieder umschwenken. Entscheidend ist der Stand am
    // Saisonende - Zufriedenheit unter der Warnschwelle, die letzten Pflichtspiele darunter und
    // KEIN Vertrauensaufbau: liegt die Zufriedenheit über dem Wert von vor sechs Pflichtspielen,
    // bleibt der Manager. Legenden-Bonus bleibt: der Vorstand verzeiht einer Vereinslegende mehr.
    function checkSeasonEndSacking(myRank) {
        if (game.season <= 1 || game.boardGraceSeason === game.season) return;
        let sackThreshold = BOARD_SAT_SACK_STREAK + (game.legendStatus ? 3 : 0);
        let verlauf = game.boardSatVerlauf || [];
        let erholt = verlauf.length >= 7 && game.boardSat > verlauf[0];
        game.boardSatVerlauf = [];
        // Saisonziel erreicht (Platz 1-2 oder die Erwartung): keine Entlassung - der 25.12-Langzeittest
        // entließ einen Manager als Meister der 3. Liga, weil das Vertrauen nach zwei Abstiegen bei 13 lag.
        let erwartet = game.seasonExpectation && game.seasonExpectation.expectedRank;
        let zielErreicht = myRank > 0 && (myRank <= 2 || (erwartet && myRank <= erwartet));
        if (game.boardSat <= BOARD_SAT_WARNING_THRESHOLD && game.lowBoardSatStreak >= sackThreshold && !erholt && !zielErreicht) {
            getSacked(myRank);
        }
    }

    // Neustart nach einem Abstieg (concludeSeasonAndAdvance, nach der Entlassungsprüfung): der
    // Vorstand hält am Manager fest und gibt einmal einen Vertrauensvorschuss. Nach einem
    // zweiten Abstieg in Folge nicht - sonst wäre eine Fahrstuhlmannschaft unkündbar.
    function grantRelegationRestart() {
        if (game.sackPending || game.boardRestartSeason === game.season - 1) return false;
        game.boardRestartSeason = game.season;
        game.boardSat = Math.max(game.boardSat, BOARD_RESTART_TRUST);
        game.lowBoardSatStreak = 0;
        game.sackWarningIssued = false;
        addInboxMessage('vertrag', '🤝 Neustart nach dem Abstieg', `Der Vorstand hält an dir fest und setzt neue Ziele für die ${leagueNames[game.leagueLevel]}. Vertrauensvorschuss: Zufriedenheit mindestens ${BOARD_RESTART_TRUST}. Ein zweiter Abstieg in Folge wird nicht noch einmal so verziehen.`, 'screen-dashboard');
        return true;
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
    // Bleibt bewusst beim Verhandlungshebel-Modell statt den Spieler direkt zum anderen
    // Klub wechseln zu lassen: game.clubName kann sich zwar inzwischen ändern (siehe
    // renameClub() in career.js), aber die konkreten AI-Vereine in leaguesData haben keine
    // eigenen, echten Kader - "übernehmen" hieße nur, einen anderen Namen/eine andere
    // Liga-Position zu erben, ohne echten Kaderwechsel. Stattdessen nutzt du das Interesse
    // anderer Klubs als Verhandlungshebel beim EIGENEN Vorstand: Geld & Ansehen (annehmen)
    // oder Vereinstreue-Bonus (ablehnen) - beides sind echte, unterschiedliche Belohnungen
    // für eine sportlich erfolgreiche Zwischenbilanz.
    let pendingJobApproach = null;
    // Wer wirbt? Ein stärkerer Verein aus der eigenen oder der nächsthöheren Liga.
    function pickJobOfferClub() {
        let excluded = [game.clubName, game.secondTeam && game.secondTeam.name];
        let eigene = (leaguesData[game.leagueLevel] || []).find(t => t.name === game.clubName);
        let ourStr = eigene ? eigene.strength : 50;
        let pool = [game.leagueLevel - 1, game.leagueLevel].filter(l => l >= 0)
            .flatMap(l => (leaguesData[l] || []).filter(t => !excluded.includes(t.name) && (l < game.leagueLevel || t.strength > ourStr + 2)).map(t => ({ name: t.name, level: l, strength: t.strength })));
        if (!pool.length) return null;
        pool.sort((a, b) => b.strength - a.strength);
        return pool[Math.floor(Math.random() * Math.min(6, pool.length))];
    }
    // Interesse anderer Vereine hängt am Erfolg: Tabellenplatz, Medienimage, Manager-Level.
    // Nach einer Saison unter den ersten drei kommt sehr wahrscheinlich ein Angebot.
    function checkJobOfferApproach(opts = {}) {
        // Offene Angebote verfallen nach 6 Spieltagen
        if (pendingJobApproach && (game.season > pendingJobApproach.season || game.matchday - pendingJobApproach.matchday >= 6)) pendingJobApproach = null;
        if (pendingJobApproach || game.sackPending) return;
        let chance;
        if (opts.saisonende) chance = opts.rank <= 3 ? 0.6 : 0.05;
        else {
            if (game.matchday % 6 !== 0) return;
            let rank = typeof getOwnLeagueRank === 'function' ? getOwnLeagueRank() : 9;
            chance = 0.02 + Math.max(0, 4 - rank) * 0.03 + Math.max(0, (game.managerMediaImage ?? 50) - 50) / 1000 + managerRPG.level * 0.005;
        }
        if (Math.random() > chance) return;
        let club = pickJobOfferClub();
        if (!club) return;
        pendingJobApproach = { clubName: club.name, level: club.level, strength: club.strength, season: game.season, matchday: game.matchday };
        let text = `${club.name} (${leagueNames[club.level]}, Stärke ${club.strength})`;
        document.getElementById('joboffer-club-name').innerText = text;
        // Nach einem Livespiel als Fenster; beim Simulieren nicht mittendrin aufpoppen,
        // sondern als Postfach-Nachricht und Karte auf dem Dashboard.
        if (opts.live) document.getElementById('joboffer-overlay').classList.add('show');
        else addInboxMessage('vertrag', `💼 Jobangebot: ${club.name}`, `${text} will dich als Trainer. Entscheide auf dem Dashboard - das Angebot gilt 6 Spieltage.`, 'screen-dashboard');
    }
    function renderJobOfferCard() {
        let box = document.getElementById('dash-joboffer-box');
        if (!box) return;
        let o = pendingJobApproach;
        if (!o || game.season > o.season || game.matchday - o.matchday >= 6) { box.innerHTML = ''; return; }
        box.innerHTML = `<div class="box" style="font-size:11px; border-left-color:var(--gold); margin-bottom:6px;">
            💼 <strong>Jobangebot:</strong> ${o.clubName} (${leagueNames[o.level]}, Stärke ${o.strength}) will dich als Trainer.
            <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px;">
                <button onclick="acceptJobOfferMove(this)" class="btn-action">🔄 Wechseln (Karriere bleibt, Kader neu)</button>
                <button onclick="acceptJobOfferLeverage()" class="btn-secondary">💰 Als Druckmittel für mehr Budget</button>
                <button onclick="declineJobOfferLoyalty()" class="btn-secondary">❤️ Vereinstreue zeigen</button>
            </div></div>`;
    }
    // Echter Wechsel: Karriere (Level, Trophäen, Konto) bleibt, Kader wird neu (switchToClub).
    function acceptJobOfferMove(btn) {
        if (!pendingJobApproach) return;
        if (!requireConfirm(btn, 'Wirklich wechseln? Neuer Kader!')) return;
        let von = game.clubName, ziel = pendingJobApproach.clubName, liga = pendingJobApproach.level;
        document.getElementById('joboffer-overlay').classList.remove('show');
        pendingJobApproach = null;
        if (!switchToClub(ziel)) { showToast('Der Wechsel ist geplatzt.', 'error'); return; }
        if (!game.careerStations) game.careerStations = [];
        game.careerStations.push({ season: game.season, matchday: game.matchday, from: von, to: ziel, level: liga });
        addInboxMessage('vertrag', `🔄 Neuer Verein: ${ziel}`, `Du wechselst von ${von} zu ${ziel} (${leagueNames[liga]}). Karriere-Level, Trophäen und Vereinskonto nimmst du mit, der Kader ist neu.`, 'screen-dashboard');
        showToast(`🔄 Willkommen bei ${ziel}!`, 'success', 4500);
        showScreen('screen-dashboard');
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

    function getSacked(myRank) {
        // Mehrfachausloesung verhindern: processPostMatchRoutine() laeuft pro simuliertem
        // Spieltag, und die Bedingung (lowBoardSatStreak) bleibt ja erfuellt.
        if (game.sackPending) return;
        game.sackPending = true;
        playSound('whistle');
        // Karriere (Level/XP/Perks) & Trophäenschrank überleben die Entlassung - alles
        // andere (Kader, Finanzen, Personal, Stadion, Sponsoren, zweite Mannschaft...) wird
        // frisch aufgesetzt, weil der Manager jetzt bei einem NEUEN Verein anfängt.
        safeSessionSet('anstoss_fm13_sacked_managerRPG', JSON.stringify(managerRPG));
        safeSessionSet('anstoss_fm13_sacked_trophies', JSON.stringify(game.trophies || []));
        safeSessionSet('anstoss_fm13_sacked_times', String((game.timesSacked || 0) + 1));
        safeSessionSet('anstoss_fm13_force_new_game', '1');
        // Der Neustart haengt bewusst an der Bestaetigung: vorher lief er direkt nach dem
        // alert() - war das unterdrueckt, verschwand der Verein ohne ein Wort der Erklaerung.
        // Grund für den Spieler (25.34): Vertrauen, Serie und die Erwartung des Vorstands am Saisonende
        const erwartetRang = game.seasonExpectation && game.seasonExpectation.expectedRank;
        const grund = `Grund: Vertrauen ${Math.round(game.boardSat)} von 100, ${game.lowBoardSatStreak || 0} Pflichtspiele in Folge unter der Warnschwelle` +
            (erwartetRang ? `, Erwartung Platz ${erwartetRang}` : '') + (myRank > 0 ? `, erreicht: Platz ${myRank}` : '') + '.';
        showNotice('🚪 Entlassen!',
            `Der Vorstand hat genug gesehen und trennt sich mit sofortiger Wirkung von dir.\n\n${grund}\n\nDeine Karriere-Erfahrung und deine Trophäen nimmst du mit - bei deinem neuen Klub beginnst du aber wieder ganz von unten.`,
            { typ: 'warn', sofort: true, knopf: 'Neuen Klub suchen', danach: () => location.reload() });
    }

    // Erwartung für das gerade gespielte eigene Ligaspiel: Gegnerstärke gegen den Schnitt der
    // eigenen Startelf (±4 gilt als offenes Spiel).
    function getOwnMatchExpectation() {
        let fixs = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][game.matchday - 1] : null;
        let teams = leaguesData[game.leagueLevel] || [];
        let f = fixs ? fixs.find(x => teams[x.home]?.name === game.clubName || teams[x.away]?.name === game.clubName) : null;
        if (!f) return 'offen';
        let gegner = teams[teams[f.home].name === game.clubName ? f.away : f.home];
        let elf = squad.filter(p => lineup.includes(p.id));
        if (!gegner || !elf.length) return 'offen';
        let diff = gegner.strength - elf.reduce((a, p) => a + p.strength, 0) / elf.length;
        return diff < -4 ? 'favorit' : (diff > 4 ? 'aussenseiter' : 'offen');
    }

    // ---------- PRESSESTIMMEN ----------
    // Kurze Schlagzeile nach jedem Spiel, abhängig vom Ergebnis (inkl. Derby-Sonderfall) -
    // läuft in ALLEN drei Spieltag-Pfaden mit, da sie an processPostMatchRoutine() hängt.
    const PRESS_HEADLINES = {
        win: ["„Big point!“ - der Gegner war chancenlos gegen unsere Mannschaft.", "Souveräner Auftritt: Die Presse lobt die taktische Disziplin.", "„Genau so weitermachen!“, jubelt die Lokalpresse."],
        draw: ["Remis mit Licht und Schatten - die Presse ist gespalten.", "„Ein Punkt geht in Ordnung“, kommentiert die Fachpresse zurückhaltend.", "Ausgeglichene Partie, ausgeglichenes Presseecho."],
        loss: ["Kritische Stimmen werden lauter nach der Niederlage.", "„Da geht mehr“ - die Presse fordert Antworten vom Trainerteam.", "Enttäuschung überwiegt in den Schlagzeilen nach dem Spiel."]
    };
    function generatePressHeadline(matchResult, isHomeDerby) {
        let pool = PRESS_HEADLINES[matchResult] || PRESS_HEADLINES.draw;
        let text = pool[Math.floor(Math.random() * pool.length)];
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
        game.boardSat = Math.max(10, Math.min(100, game.boardSat + a.board));
        document.getElementById('interview-overlay').classList.remove('show');
        showToast(`🎙️ Interview: Fans ${a.fans >= 0 ? '+' : ''}${a.fans}, Vorstand ${a.board >= 0 ? '+' : ''}${a.board}`, 'success');
        // Interview-Historie: kleines Archiv der eigenen Medien-Auftritte über die Karriere,
        // um den eigenen "Medien-Charakter" im Rückblick nachvollziehen zu können.
        if (!game.interviewHistory) game.interviewHistory = [];
        game.interviewHistory.push({ season: game.season, matchday: game.matchday, question: pendingInterview.q, answer: a.label, fans: a.fans, board: a.board });
        if (game.interviewHistory.length > 30) game.interviewHistory.shift();
        // Manager-Medienimage: fanfreundliche Antworten schieben das Image Richtung
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

    function finishMatch() {
        // Nach dem live gespielten Pokalspiel geht es direkt zum Ligaspiel desselben Spieltags.
        if (typeof currentMatch !== 'undefined' && currentMatch && currentMatch.cupTie && !currentMatch.cupWeiter) {
            currentMatch.cupWeiter = true;
            startMatchdayFlow();
            return;
        }
        showScreen('screen-dashboard');
    }

    // Torschützen-Zuordnung für automatisch simulierte eigene Spiele: bisher wurden
    // beim "Saison durchsimulieren"/Admin-Vorspulen nur nackte Tordifferenzen berechnet,
    // OHNE die Tore einem Spieler zuzuordnen - individuelle Torstatistiken blieben für den
    // häufigsten Spielmodus (automatische Simulation) komplett leer.
    // Spieler des Monats: alle 4 Spieltage (in Ermangelung eines echten Kalenders die
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
        if (typeof addPlayerHonour === 'function') addPlayerHonour(winner.p, '📅 Spieler des Monats');
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
        box.innerHTML = hist.map(h => `<div class="box" style="font-size:10px; display:flex; justify-content:space-between;"><span>🏆 ${h.playerName} (Saison ${h.season})</span><span>${h.grade ? `Ø ${formatGrade(h.grade)} · ` : ''}${h.goals} Tore</span></div>`).join('');
    }

    function attributeGoalsToScorers(goalCount) {
        if (goalCount <= 0) return;
        let starting = squad.filter(p => lineup.includes(p.id));
        if (starting.length === 0) return;
        for (let i = 0; i < goalCount; i++) creditOwnGoal(starting);
    }

    function simulateFullSeason() { simulateMatchdays(35); }

    // Simuliert bis zu "anzahl" Spieltage am Stück. Die ganze Saison ist damit nur noch der
    // Sonderfall "so viele, wie überhaupt übrig sind" - es gibt keine zweite Schleife, die
    // beim Ändern der Spieltagslogik vergessen werden könnte.
    function simulateMatchdays(anzahl) {
        if (game.matchday > 34) { showToast('Die Saison ist bereits beendet.', 'error'); return; }
        let simuliert = 0;
        // Nach einer Entlassung wird nicht weitergespielt. Frueher stoppte das alert() in
        // getSacked() die Schleife und der direkt folgende Reload beendete alles - mit dem
        // nicht blockierenden Meldungsfenster lief die Simulation dagegen munter weiter,
        // fuer einen Verein, den man gar nicht mehr betreut.
        while (game.matchday <= 34 && simuliert < anzahl && !game.sackPending) {
            simuliert++;
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
                        let hStr = (hTeam.name === game.clubName) ? (typeof getOwnLeagueMatchStrength === 'function' ? getOwnLeagueMatchStrength(true, aTeam) : calcTeamStrength(true)) : (aTeam.name === game.clubName ? getOpponentMatchStrength(hTeam.strength, true) : hTeam.strength + AI_HOME_ADVANTAGE);
                        let aStr = (aTeam.name === game.clubName) ? (typeof getOwnLeagueMatchStrength === 'function' ? getOwnLeagueMatchStrength(false, hTeam) : calcTeamStrength(false)) : (hTeam.name === game.clubName ? getOpponentMatchStrength(aTeam.strength, false) : aTeam.strength);

                        let goals = simulateGoals(hStr, aStr, hTeam, aTeam);
                        f.homeGoals = goals.myGoals;
                        f.awayGoals = goals.oppGoals;
                        f.played = true;
                        updateLeagueTable(l, f);

                        // Zweite Mannschaft: dieselbe Torschützen-Lücke wie beim
                        // ersten Team behoben - bisher wurden ihre Ligaspiele nur als reine
                        // Zahlen simuliert, ohne die Tore realen Spielern im Kader
                        // zuzuordnen.
                        if (game.secondTeam.isActive && typeof attributeGoalsToSecondTeamScorers === 'function') {
                            if (hTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.homeGoals);
                            else if (aTeam.name === game.secondTeam.name) attributeGoalsToSecondTeamScorers(f.awayGoals);
                        }

                        if (hTeam.name === game.clubName) {
                            isHome = true;
                            playedOurMatch = true;
                            won = f.homeGoals > f.awayGoals;
                            drawn = f.homeGoals === f.awayGoals;
                            isHomeDerby = isDerbyOpponent(aTeam.name);
                            opponentNameThisMatch = aTeam.name;
                            ourGoalsThisMatch = f.homeGoals; oppGoalsThisMatch = f.awayGoals;
                        } else if (aTeam.name === game.clubName) {
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
            applyMatchdayFinances(isHome, won, playedOurMatch && oppGoalsThisMatch === 0, isHomeDerby, opponentNameThisMatch, opponentNameThisMatch ? `${ourGoalsThisMatch}:${oppGoalsThisMatch}` : null);
            processPostMatchRoutine(playedOurMatch ? (won ? 'win' : (drawn ? 'draw' : 'loss')) : null, isHomeDerby, false, ourGoalsThisMatch - oppGoalsThisMatch, isHome, playedOurMatch ? { total: ourGoalsThisMatch + oppGoalsThisMatch, bothScored: ourGoalsThisMatch > 0 && oppGoalsThisMatch > 0 } : null);
        }
        updateUI();
        showScreen('screen-dashboard');
        showToast(`⚡ ${simuliert} Spieltag${simuliert === 1 ? '' : 'e'} simuliert - jetzt Spieltag ${Math.min(34, game.matchday)}/34.`, 'success', 3500);
    }

