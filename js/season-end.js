
    // ==========================================
    // SAISONABSCHLUSS: GALA, AUF-/ABSTIEG, BUDGETS, RÜCKBLICK-ZUSAMMENFASSUNG (aus match.js
    // ausgelagert - reine Datei-Organisation, keine Verhaltensänderung)
    // ==========================================
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
        let myRank = teams.findIndex(t => t.name === game.clubName) + 1;
        let myTeamRecord = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);

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
        game.seasonPointsHistory = []; // Saisonverlauf-Graph (NEU, siehe updateLeagueTable()/leagues.js)
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
