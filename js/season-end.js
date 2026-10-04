
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
        // Spieler der Saison nach echten Saisonnoten (pickPlayerOfSeason in js/season-preview.js) -
        // früher Stärke × Karriere-Einsätze, also fast immer der dienstälteste Stammspieler.
        let wahl = typeof pickPlayerOfSeason === 'function' ? pickPlayerOfSeason() : null;
        let playerOfSeason = wahl ? wahl.p : [...squad].sort((a, b) => b.strength - a.strength)[0];
        let riser = [...squad].filter(p => (p.age || 30) <= 21).sort((a, b) => b.strength - a.strength)[0];
        const GOAL_OF_SEASON_FLAVOR = [
            'ein satter Distanzschuss aus 25 Metern ins Torwinkel',
            'ein sehenswerter Fallrückzieher nach Flanke',
            'ein Solo über das halbe Feld mit anschließendem Lupfer',
            'ein präziser Freistoß direkt in den Winkel'
        ];
        let goalFlavor = GOAL_OF_SEASON_FLAVOR[Math.floor(Math.random() * GOAL_OF_SEASON_FLAVOR.length)];
        // Tor der Saison: ein echter Torschütze dieser Saison (je mehr Tore, desto wahrscheinlicher).
        let schuetzen = [];
        squad.forEach(p => { for (let i = 0; i < Math.min(30, p.goalsSeason || 0); i++) schuetzen.push(p); });
        let goalScorer = schuetzen.length ? schuetzen[Math.floor(Math.random() * schuetzen.length)] : null;

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

        let body = `🏅 Spieler der Saison: <strong>${playerOfSeason.name}</strong> (${wahl && wahl.grade ? `Ø-Note ${formatGrade(wahl.grade)}, ` : ''}${playerOfSeason.goalsSeason || 0} Tore)\n` +
            (goalScorer ? `⚽ Tor der Saison: <strong>${goalScorer.name}</strong> mit ${goalFlavor}\n` : '') +
            `❤️ Publikumsliebling der Saison: <strong>${publikumsliebling.name}</strong> (Fan-Abstimmung)\n` +
            (riser ? `🌟 Aufsteiger des Jahres: <strong>${riser.name}</strong> (${riser.age || '-'} Jahre, Stärke ${riser.strength})` : '');
        addInboxMessage('vertrag', `🎊 Saisonabschluss-Gala ${game.season}`, body, 'screen-squad');
        showToast(`🎊 Saisonabschluss-Gala: ${playerOfSeason.name} ist Spieler der Saison!`, 'success');
    }

    // Aufstiegsprämie, Sponsoren-Bonus, XP, Fan-Fundament und Vertragsboni - für den regulären
    // Aufstieg am Saisonende UND den nachträglichen nach erfüllter DFB-Nachfrist (der bekam
    // bisher nichts davon). Gibt den Sponsoren-Bonus zurück (für die Meldung).
    // Aufstiegsprämie nach der NEUEN Liga: pauschal 1,5 Mio. waren für einen Ober- oder
    // Regionalligisten mehr als eine ganze Saison Umsatz (Szenario-Langzeittest 20.6:
    // Traditionsverein von 0,4 auf 3,5 Mio. € in einer Regionalliga-Saison).
    const PROMOTION_PRIZE_BY_LEVEL = [5000000, 2500000, 1000000, 400000, 150000, 0];
    function getPromotionPrize(level) { return PROMOTION_PRIZE_BY_LEVEL[level] ?? 0; }

    function applyPromotionRewards() {
        game.money += getPromotionPrize(game.leagueLevel);
        let sponsorPromoBonus = game.sponsor.promotionBonus || 0;
        if (sponsorPromoBonus > 0) game.money += sponsorPromoBonus;
        addManagerXP(1000);
        boostFanBaseFloor(6, `Der Aufstieg in die ${leagueNames[game.leagueLevel]}`);
        if (typeof triggerPromotionBonusClauses === 'function') triggerPromotionBonusClauses();
        return sponsorPromoBonus;
    }

    // Jeden Spieltag (processPostMatchRoutine): Lizenz-Frühwarnung an Spieltag 30 und die
    // laufende DFB-Nachfrist nach einem vorläufig verweigerten Aufstieg.
    function checkDfbLicenseDeadlines() {
        if (game.matchday === 30 && !game.dfbGracePeriod) {
            let status = checkDfbLicensingStatus();
            if (status.targetLevel !== null && status.missing.length > 0) {
                let sorted = leaguesData[game.leagueLevel] ? [...leaguesData[game.leagueLevel]].sort(compareTableRows) : [];
                let myRank = sorted.findIndex(t => t.name === game.clubName) + 1;
                if (myRank > 0 && myRank <= 2) {
                    addInboxMessage('vertrag', '🚨 DFB-Lizenz-Frühwarnung!', `Du liegst aktuell in Aufstiegsposition, aber die Lizenz für die ${leagueNames[status.targetLevel]} fehlt noch:\n\n${status.missing.map(m => '• ' + m).join('\n')}\n\nNur noch wenige Spieltage bis Saisonende - jetzt nachbessern!`, 'screen-stadium');
                    showToast('🚨 DFB-Lizenz-Frühwarnung: Auflagen für den möglichen Aufstieg noch nicht erfüllt!', 'error');
                }
            }
        }
        if (!game.dfbGracePeriod) return;
        let status = checkDfbLicensingStatus();
        if (status.missing.length === 0) {
            // Mängel rechtzeitig behoben: nachträglicher Aufstieg. Früher wurde nur leagueLevel
            // umgestellt - der Verein spielte weiter in der alten Liga und fehlte in der neuen
            // Tabelle. Jetzt tauscht insertOurTeamIntoLeagues() ihn wie beim Saisonwechsel ein.
            game.leagueLevel = game.dfbGracePeriod.targetLevel;
            game.dfbGracePeriod = null;
            if (typeof insertOurTeamIntoLeagues === 'function') insertOurTeamIntoLeagues();
            let sponsorPromoBonus = applyPromotionRewards();
            addInboxMessage('vertrag', '🎉 Nachträglicher Aufstieg!', `Die DFB-Auflagen wurden rechtzeitig innerhalb der Nachfrist erfüllt - der Aufstieg in die ${leagueNames[game.leagueLevel]} wird nachträglich vollzogen! Aufstiegsprämie ${formatVal(getPromotionPrize(game.leagueLevel))}${sponsorPromoBonus > 0 ? ` plus ${formatVal(sponsorPromoBonus)} Sponsoren-Bonus` : ''}.`, 'screen-stadium');
            showToast(`🎉 Nachträglicher Aufstieg in die ${leagueNames[game.leagueLevel]}!`, 'success');
            return;
        }
        game.dfbGracePeriod.deadlineMatchday--;
        if (game.dfbGracePeriod.deadlineMatchday <= 0) {
            let targetLevel = game.dfbGracePeriod.targetLevel;
            game.dfbGracePeriod = null;
            addInboxMessage('vertrag', '📋 DFB-Nachfrist verstrichen', `Die Nachfrist zur Erfüllung der DFB-Auflagen für die ${leagueNames[targetLevel]} ist ohne Erfolg verstrichen - der Aufstieg verfällt endgültig für diese Saison.`, 'screen-stadium');
            showToast('📋 DFB-Nachfrist verstrichen - Aufstieg endgültig verfallen.', 'error');
        }
    }

    function concludeSeasonAndAdvance() {
        // Erfolgsbasierte Vertragsboni (js/bonusclauses.js): das Aufstiegsbonus-Flag wird
        // bewusst HIER, ganz am Anfang, zurückgesetzt - nicht in der allgemeinen
        // Saisonstatistik-Reset-Schleife weiter unten. Der Aufstieg dieser (gerade endenden)
        // Saison wird erst WEITER UNTEN in dieser Funktion geprüft und ausgezahlt - ein Reset
        // an dieser Stelle würde die gerade erfolgte Zahlung im selben Funktionsaufruf sofort
        // wieder unsichtbar machen und, schlimmer, einen erneuten Aufstieg in einer SPÄTEREN
        // Saison faelschlich blockieren, weil das Flag von der letzten Zahlung an noch "true"
        // stünde.
        squad.forEach(p => { if (p.bonusPaidThisSeason) p.bonusPaidThisSeason.promotion = false; });

        // Kopie statt In-Place-Sortierung, aus Konsistenz mit renderLeagueView() -
        // auch wenn die Saison hier bereits vorbei ist, bleibt so die Originaldatenstruktur
        // unangetastet, falls andere Screens (z.B. Historie) noch darauf zugreifen.
        // Bugfix: die ANGEZEIGTE Tabelle sortiert bei Punktgleichstand nach Tordifferenz
        // (siehe renderLeagueView() in leagues.js), aber diese Aufstiegs-Berechnung sortierte
        // bisher NUR nach Punkten - bei einem Punktgleichstand am Saisonende konnte der
        // tatsächlich berechnete Rang dadurch von dem in der Tabelle angezeigten Rang
        // abweichen (Einfüge-Reihenfolge statt Tordifferenz entschied). Jetzt identische
        // Sortierlogik wie in der Tabellenanzeige.
        let teams = [...leaguesData[game.leagueLevel]].sort(compareTableRows);
        let myRank = teams.findIndex(t => t.name === game.clubName) + 1;
        let myTeamRecord = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        // Schnappschuss für den Rückblick: advanceLeaguesToNewSeason() setzt das Tabellenobjekt
        // zurück, der Rückblick zeigte deshalb immer "0 Punkte" (und das Archiv speicherte 0).
        let myTeamSnapshot = myTeamRecord ? { ...myTeamRecord } : null;
        // Manager-Statistik: Bilanz der gerade beendeten Saison, bevor Auf-/Abstieg die Liga ändert.
        if (typeof recordSeasonalManagerStats === 'function') recordSeasonalManagerStats(myRank, myTeamRecord, game.leagueLevel);
        if (typeof checkPlaytimePromises === 'function') checkPlaytimePromises();
        if (typeof evaluateSeasonEndObjectives === 'function') evaluateSeasonEndObjectives(myRank);
        if (typeof recordScenarioSeasonRank === 'function') recordScenarioSeasonRank(myRank);
        if (typeof prepareMemberAssembly === 'function') prepareMemberAssembly(myRank);
        // Experten-Check (js/season-preview.js): Prognose gegen Abschlusstabelle, vor dem Ligawechsel.
        if (typeof buildSeasonExpertCheck === 'function') buildSeasonExpertCheck(myRank);
        if (typeof concludeWomenSeason === 'function') concludeWomenSeason();

        // Medienrechte: Liga-Kollektiv-TV-Ausschüttung zum Saisonende, gestaffelt nach
        // Ligastärke UND Tabellenplatz.
        if (typeof calculateCollectiveTvMoney === 'function') {
            // Der Grossteil des TV-Geldes wurde bereits in Spieltagsraten ausgezahlt (siehe
            // applyMatchdayFinances). Hier folgt nur noch die Differenz zum Anspruch, der
            // sich aus dem ENDSTAND ergibt - wer sich zum Schluss hin verbessert hat,
            // bekommt nachgezahlt, wer abgerutscht ist, entsprechend weniger.
            let tvAnspruch = calculateCollectiveTvMoney(game.leagueLevel, myRank);
            let bereitsGezahlt = game.tvMoneyPaidThisSeason || 0;
            let restausschuettung = Math.max(0, tvAnspruch - bereitsGezahlt);
            game.money += restausschuettung;
            game.lastLeagueTvPayout = tvAnspruch;
            game.tvMoneyPaidThisSeason = 0;
            addInboxMessage('vertrag', `📺 Liga-TV-Abrechnung: ${formatVal(tvAnspruch)} für Platz ${myRank}`,
                `Der Verein hat für Platz ${myRank} Anspruch auf ${formatVal(tvAnspruch)} aus dem kollektiven TV-Vertrag. Davon wurden ${formatVal(bereitsGezahlt)} bereits in Spieltagsraten ausgezahlt - die Restausschüttung beträgt ${formatVal(restausschuettung)}.`, 'screen-finances');
            mediaRights.seasonTvIncomeTotal = 0;
        }

        // Perfekte Saison: keine einzige Ligaspiel-Niederlage über die komplette Spielzeit.
        if (myTeamRecord && myTeamRecord.played >= 30 && myTeamRecord.lost === 0) {
            let bonus = 500000;
            game.money += bonus;
            game.trophies.push(`Ungeschlagene Saison (Saison ${game.season})`);
            boostFanBaseFloor(12, 'Die historische ungeschlagene Saison');
            addManagerXP(600);
            showNotice('🌟 Perfekte Saison!', `Keine einzige Niederlage in ${myTeamRecord.played} Ligaspielen. Diese historische Leistung wird mit ${formatVal(bonus)}, einer Sonder-Trophäe und dauerhaft mehr Fan-Fundament gewürdigt.`);
        }

        holdSeasonEndGala();
        if (typeof awardLeagueHonours === 'function') awardLeagueHonours(myRank);
        checkRivalChangeEvent();
        if (typeof tickMediaImageSeasonHistory === 'function') tickMediaImageSeasonHistory();

        if (game.leagueLevel === 0 && myRank <= 4) {
            game.inEurope = true;
            showNotice('🌟 Champions-Cup-Qualifikation!', `Platz ${myRank} erreicht - nächste Saison spielt der Verein in der europäischen Königsklasse.`);
        }

        // Relegation (Platz 3 und 16): noch nicht gespielte Partien werden jetzt simuliert.
        let relegation = typeof resolveRelegationForSeasonEnd === 'function' ? resolveRelegationForSeasonEnd() : null;

        if ((myRank <= 2 || relegation === 'promoted') && game.leagueLevel > 0) {
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
                // Nachfrist statt sofortiger endgültiger Verweigerung: bei knapp verfehlten
                // Auflagen bekommt man 3 Spieltage der neuen Saison Zeit, die Mängel noch zu
                // beheben - erst wenn auch die Nachfrist verstreicht, verfällt der Aufstieg
                // endgültig für diese Saison.
                game.dfbGracePeriod = { targetLevel, deadlineMatchday: 3, originalLeagueLevel: game.leagueLevel };
                addInboxMessage('vertrag', '📋 DFB-Lizenz vorläufig verweigert - Nachfrist eingeräumt!', `Sportlich hättest du den Aufstieg in die ${leagueNames[targetLevel]} geschafft, aber der DFB verweigert vorerst die Lizenz:\n\n${failedReasons.map(r => '• ' + r).join('\n')}\n\nDu hast 3 Spieltage Zeit, die Mängel zu beheben - schaffst du das, wird der Aufstieg nachträglich noch vollzogen!`, 'screen-stadium');
                showNotice('📋 DFB-Lizenz vorläufig verweigert', `Sportlich wäre der Aufstieg in die ${leagueNames[targetLevel]} geschafft - der DFB räumt aber erst eine Nachfrist von drei Spieltagen ein, um die fehlenden Auflagen zu erfüllen:\n\n${failedReasons.map(r => '• ' + r).join('\n')}`, { typ: 'warn' });
            } else {
                game.leagueLevel--;
                let sponsorPromoBonus = applyPromotionRewards();
                showNotice('🎉 Aufstieg geschafft!', `Glückwunsch zur Beförderung in die ${leagueNames[game.leagueLevel]}.\n\nAufstiegsprämie ${formatVal(getPromotionPrize(game.leagueLevel))}${sponsorPromoBonus > 0 ? ` plus ${formatVal(sponsorPromoBonus)} Sponsoren-Aufstiegsbonus` : ''}.`);
            }
        } else if ((myRank >= 17 || (myRank === 16 && relegation !== 'stayed')) && game.leagueLevel < NUM_LEAGUES - 1) {
            game.leagueLevel++;
            showNotice('❌ Abstieg', 'Die Klasse konnte nicht gehalten werden. Nächste Saison geht es eine Liga tiefer weiter.', { typ: 'warn' });
        }

        // Der Vorstand legt zu Saisonbeginn neue Budgets fest - abhängig von Ligastärke
        // und Abschneiden der Vorsaison, statt eines für immer fixen Startwerts.
        // Wirtschaftliche Konsistenz: die alte Formel (Basis 60.000/10.000) ergab in
        // der höchsten Liga nur ~35.000-45.000 € Gehaltsbudget PRO SPIELTAG für den GESAMTEN
        // Kader - ein einzelner Weltklassespieler kann laut calculatePlayerWage() aber bis zu
        // 900.000 €/Spieltag kosten. Nach der realistischen Stadion-Preisreform (teils 40+
        // Mio. € Bauprojekte) musste auch dieser Teil der Wirtschaft entsprechend mitziehen.
        let leagueFactor = (NUM_LEAGUES - game.leagueLevel) / NUM_LEAGUES;
        let placementFactor = myRank <= 4 ? 1.3 : (myRank <= 10 ? 1.0 : 0.8);
        game.transferBudget = Math.round(2500000 * (1 + leagueFactor * 2.5) * placementFactor);
        game.wageBudget = Math.round(450000 * (1 + leagueFactor * 2.5) * placementFactor);
        // Manager-Eigengehalt: blieb bisher für immer beim Startwert (1.200 €/SpT),
        // selbst nach mehreren Aufstiegen in die Bundesliga mit Millionenbudgets - ein
        // erfolgreicher Bundesliga-Trainer verdient real deutlich mehr als ein Kreisliga-
        // Einsteiger. Skaliert jetzt mit derselben Liga-/Erfolgsformel wie die Vereinsbudgets.
        let newManagerWage = Math.round(1200 * (1 + leagueFactor * 2.5) * placementFactor);
        if (newManagerWage > privateLife.wage) privateLife.wage = newManagerWage;

        // Spieler der Saison für die Chronik: derselbe wie bei der Gala (Ehrung und Moral gab es dort).
        let saisonSpieler = typeof pickPlayerOfSeason === 'function' ? pickPlayerOfSeason() : null;
        if (saisonSpieler) {
            if (!game.playerOfSeasonHistory) game.playerOfSeasonHistory = [];
            game.playerOfSeasonHistory.unshift({ season: game.season, playerId: saisonSpieler.p.id, playerName: saisonSpieler.p.name, goals: saisonSpieler.goals, grade: saisonSpieler.grade });
            if (game.playerOfSeasonHistory.length > 15) game.playerOfSeasonHistory.pop();
        }

        squad.forEach(p => {
            p.contracts--;
            p.fitness = 100;
            // Spielerwert-Entwicklungs-Historie: ein Schnappschuss pro Saison, damit im
            // Spieler-Detail eine echte Entwicklungskurve statt nur des aktuellen Werts
            // angezeigt werden kann.
            if (!p.strengthHistory) p.strengthHistory = [];
            p.strengthHistory.push({ season: game.season, strength: p.strength, apps: p.appearancesSeason || 0, goals: p.goalsSeason || 0 });
            if (p.strengthHistory.length > 15) p.strengthHistory.shift();
            if (typeof resetPlayerSeasonStats === 'function') resetPlayerSeasonStats(p);
            p.goalsSeason = 0;
            p.appearancesSeason = 0;
            // Erfolgsbasierte Vertragsboni (js/bonusclauses.js): eine bereits eingelöste
            // Tor-/Einsatzklausel darf in der neuen Saison erneut ausgezahlt werden, sobald
            // die Marke wieder erreicht wird - die Klausel selbst (Schwelle/Betrag) bleibt
            // bestehen, bis sie aktiv entfernt oder neu verhandelt wird. Das Aufstiegsbonus-
            // Flag wird bewusst NICHT hier zurückgesetzt (siehe Kommentar am Anfang dieser
            // Funktion), sondern beim naechsten Saisonende - bis dahin bleibt es sichtbar.
            if (p.bonusPaidThisSeason) { p.bonusPaidThisSeason.goals = false; p.bonusPaidThisSeason.appearances = false; }
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
        // Vorwarnung: wer nur noch 1 Jahr Restlaufzeit hat, wird jetzt aktiv gemeldet,
        // statt dass der Manager es zufällig in der Vertragsliste entdecken muss.
        squad.filter(p => p.contracts === 1 && p.strength >= 50).forEach(p => {
            addInboxMessage('vertrag', `⏳ Vertrag läuft aus: ${p.name}`, `${p.name} hat nur noch 1 Jahr Vertrag - jetzt verlängern, sonst verlässt er den Verein am Saisonende ablösefrei!`, 'screen-contracts');
        });
        squad = squad.filter(p => p.contracts > 0);
        if (typeof agePlayersAtSeasonEnd === 'function') agePlayersAtSeasonEnd();
        // Ab 14 Spielern (Startelf + 3 Wechsel) statt erst unter 11: auslaufende Verträge ließen
        // den Kader im Langzeittest regelmäßig auf 12 schrumpfen.
        if (squad.length < 14) {
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
            showNotice('⚠️ Vertragskrise', 'Zu viele Spieler haben den Verein wegen auslaufender Verträge verlassen. Der Kader wurde notdürftig mit neuen Spielern aufgefüllt.\n\nAchte künftig auf die Vertragslaufzeiten.', { typ: 'warn' });
        }

        incomingOffers = [];
        if (typeof evaluateFinancialFairplay === 'function') evaluateFinancialFairplay();
        game.season++;
        if (typeof startNewSeasonObjectives === 'function') startNewSeasonObjectives();
        if (typeof openMemberAssembly === 'function') openMemberAssembly();
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
        game.seasonTaxPaid = 0;
        game.viewingMatchday = 1;
        game.winterWindowUsedThisSeason = false;
        game.winterWindowActive = false;
        processSecondTeamSeasonEnd();
        forceSponsorRenewalAtSeasonStart();
        if (typeof renewSeasonTickets === 'function') renewSeasonTickets();
        if (typeof checkSeasonMoodTargetResult === 'function') checkSeasonMoodTargetResult();
        if (typeof evaluateScenarioAtSeasonEnd === 'function') evaluateScenarioAtSeasonEnd();
        if (typeof remindSaveExport === 'function') remindSaveExport();
        // WM/EM im Sommer nach jeder geraden Saison (js/national-team.js), nach dem Fitness-Reset.
        if (typeof playSummerTournament === 'function') playSummerTournament();
        if (typeof tickCoachBounce === 'function') tickCoachBounce(true);
        // Supercup der neuen Saison: braucht noch die alte Tabelle und den alten Pokal.
        if (typeof prepareSupercup === 'function') prepareSupercup();
        if (typeof ageAiStars === 'function') ageAiStars();
        advanceLeaguesToNewSeason();
        if (typeof recordSeasonExpectationRank === 'function') recordSeasonExpectationRank();
        if (typeof createSeasonPreview === 'function') createSeasonPreview();
        if (typeof applyPendingFfpPointDeduction === 'function') applyPendingFfpPointDeduction();
        refreshTransferMarket();
        autoLineup();
        updateUI();
        showScreen('screen-dashboard');
        showSeasonReviewSummary(myRank, myTeamSnapshot);
        if (typeof checkJobOfferApproach === 'function') checkJobOfferApproach({ saisonende: true, rank: myRank });
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
        let expertCheck = (game.seasonReviews || []).find(r => r.season === game.season - 1 && typeof describeExpertCheck === 'function') || null;
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
            ${expertCheck ? `<div style="font-size:10px; font-weight:800; color:var(--text-muted); margin:10px 0 4px 0;">🔮 Experten-Check</div><div style="font-size:10px;">${describeExpertCheck(expertCheck)}</div>` : ''}
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
