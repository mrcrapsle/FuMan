    // ==========================================
    // FINANCIAL FAIRPLAY
    // ==========================================
    // Echte UEFA/DFB-Regel: nicht der aktuelle Kontostand entscheidet, sondern ob ein Verein
    // über mehrere Saisons hinweg strukturell mehr ausgibt, als er einnimmt. Bewusst getrennt
    // von der kurzfristigen Zahlungsunfähigkeit (checkInsolvencyRisk() in js/finances.js,
    // reagiert auf einen NEGATIVEN Kontostand) - ein Verein kann gegen Financial Fairplay
    // verstoßen, auch wenn das Konto gerade im Plus steht, wenn er strukturell draufzahlt;
    // umgekehrt löscht eine kurzfristig wiederhergestellte Zahlungsfähigkeit einen laufenden
    // FFP-Verstoß NICHT - beide Systeme haben deshalb bewusst getrennte Sperren-Flags.
    //
    // Wie im echten Regelwerk sind Investitionen in Infrastruktur (Stadion, Vereinsgelände,
    // Jugendarbeit) sowie reine Finanzierungsvorgänge (Kredite, Festgeld - Bilanzverschiebung,
    // kein echter Gewinn/Verlust) von der Berechnung AUSGENOMMEN. Die Regel soll Vereine
    // nicht davon abhalten, in ihre Zukunft zu investieren, sondern nur laufendes
    // Überleben auf Pump verhindern.
    const FFP_EXEMPTE_LABELS = ['🏟️ Stadionausbau', '🏘️ Vereinsgelände', '🎓 Jugendarbeit', '💰 Finanzen & Kredite'];
    const FFP_MONITORING_SEASONS = 3;

    function isFfpExemptLabel(label) {
        return FFP_EXEMPTE_LABELS.includes(label);
    }

    // Laufender Saison-Akkumulator: wird bei JEDER Geldbewegung live nachgeführt (siehe
    // Aufrufe in protokolliereBuchung() und applyMatchdayFinances()), damit am Saisonende
    // keine Historie durchsucht werden muss, die durch die Kappung von Buchungsjournal/
    // Kontoauszug (80 bzw. 150 Einträge) längst unvollständig sein könnte.
    function addToFfpSeasonNet(amount) {
        game.ffpSeasonNet = (game.ffpSeasonNet || 0) + amount;
    }

    // Erlaubter Verlust pro überwachter Saison, skaliert mit der Ligastufe (TV-Geld als
    // Umsatz-Näherung) - ein Bundesligist darf absolut mehr verlieren als ein Kreisligist,
    // genau wie im echten Regelwerk, das nach Vereinsgröße differenziert.
    function getFfpAllowedLossPerSeason() {
        let basis = (typeof LEAGUE_BASE_TV_MONEY !== 'undefined' ? LEAGUE_BASE_TV_MONEY[game.leagueLevel] : null) ?? 100000;
        return Math.round(basis * 0.20);
    }

    // Einzige Stelle, die auf eine Transfersperre prüfen sollte: fasst die kurzfristige
    // Insolvenz-Sperre (game.transferEmbargo) und die FFP-Sperre (game.ffpTransferEmbargo)
    // zusammen, ohne dass eine der beiden Ursachen die jeweils andere Sperre versehentlich
    // mit aufhebt (checkInsolvencyRisk() löscht z.B. NUR game.transferEmbargo, sobald das
    // Konto wieder im Plus ist - eine FFP-Sperre bliebe davon unberührt, wie es sein muss).
    function isTransferEmbargoActive() {
        return !!game.transferEmbargo || !!game.ffpTransferEmbargo;
    }

    // Wird am Saisonende VOR game.season++ aufgerufen (siehe concludeSeasonAndAdvance() in
    // js/season-end.js) - wertet die gerade beendete Saison aus. Ein etwaiger Punktabzug wird
    // nur VORGEMERKT (game.pendingFfpPointDeduction), weil die aktuelle Tabelle in diesem
    // Moment gleich verworfen wird (advanceLeaguesToNewSeason() baut sie mit Punktstand 0 neu
    // auf) - erst danach lässt sich sinnvoll etwas abziehen.
    function evaluateFinancialFairplay() {
        let netDiese = Math.round(game.ffpSeasonNet || 0);
        if (!Array.isArray(game.ffpHistory)) game.ffpHistory = [];
        game.ffpHistory.push(netDiese);
        if (game.ffpHistory.length > FFP_MONITORING_SEASONS) game.ffpHistory.shift();
        game.ffpSeasonNet = 0;

        let kumulativ = game.ffpHistory.reduce((s, n) => s + n, 0);
        let erlaubt = getFfpAllowedLossPerSeason() * game.ffpHistory.length;
        let verstoss = kumulativ < -erlaubt;

        game.ffpLastResult = { season: game.season, net: netDiese, kumulativ, erlaubt, ueberwachteSaisons: game.ffpHistory.length, verstoss };
        game.pendingFfpPointDeduction = 0;

        if (!verstoss) {
            // Ein sauberes Jahr baut Vertrauen wieder auf - Sanktionen lockern sich
            // schrittweise, statt für immer maximal zu bleiben.
            if ((game.ffpStrikes || 0) > 0) game.ffpStrikes--;
            if (game.ffpStrikes === 0) game.ffpTransferEmbargo = false;
            return;
        }

        game.ffpStrikes = (game.ffpStrikes || 0) + 1;
        let ueberschreitung = Math.round(-kumulativ - erlaubt);

        if (game.ffpStrikes === 1) {
            addInboxMessage('finanzen', '⚠️ Financial-Fairplay-Verwarnung',
                `Der Verband hat die Bilanzen der letzten ${game.ffpHistory.length} Saison(en) geprüft: ${formatVal(ueberschreitung)} zu viel Verlust über den erlaubten Rahmen hinaus. Es bleibt bei einer Verwarnung - bei anhaltendem Verstoß drohen eine Transfersperre und ein Punktabzug.`, 'screen-finances');
            showNotice('⚠️ Financial-Fairplay-Verwarnung',
                `Der Verband hat die Vereinsbilanzen geprüft und ${formatVal(ueberschreitung)} zu viel Verlust über den erlaubten Rahmen festgestellt.\n\nEs bleibt vorerst bei einer Verwarnung - bei anhaltendem Verstoß drohen eine Transfersperre und ein Punktabzug.`, { typ: 'warn' });
        } else if (game.ffpStrikes === 2) {
            game.ffpTransferEmbargo = true;
            addInboxMessage('finanzen', '🚫 Financial-Fairplay: Transfersperre',
                'Wiederholter Verstoß gegen die Ausgabenregeln - der Verband verhängt eine Transfersperre, bis die Bilanzen wieder im erlaubten Rahmen liegen.', 'screen-finances');
            showNotice('🚫 Financial-Fairplay-Sanktion',
                'Der Verein hat erneut über seine Verhältnisse gelebt. Der Verband verhängt eine Transfersperre, bis die Bilanzen wieder stimmen.', { typ: 'warn' });
        } else {
            game.ffpTransferEmbargo = true;
            game.pendingFfpPointDeduction = Math.min(9, (game.ffpStrikes - 2) * 3);
            addInboxMessage('finanzen', '⚖️ Financial-Fairplay: Punktabzug',
                `Anhaltender Verstoß gegen die Ausgabenregeln - der Verband verhängt zusätzlich zur bestehenden Transfersperre einen Punktabzug von ${game.pendingFfpPointDeduction} Punkten für die neue Saison.`, 'screen-finances');
            showNotice('⚖️ Financial-Fairplay-Punktabzug',
                `Anhaltender Verstoß: Der Verband zieht dem Verein ${game.pendingFfpPointDeduction} Punkte für die neue Saison ab, zusätzlich zur bestehenden Transfersperre.`, { typ: 'warn' });
        }
    }

    // Wird DIREKT NACH advanceLeaguesToNewSeason() aufgerufen, wenn die neue Saisontabelle
    // (Punktstand 0) bereits steht - genau der richtige Moment für einen Punktabzug, der
    // sofort in der Tabelle sichtbar ist, statt später unmotiviert "aus dem Nichts" zu kommen.
    function applyPendingFfpPointDeduction() {
        if (!(game.pendingFfpPointDeduction > 0)) return;
        let team = (typeof getOurLeagueTeam === 'function') ? getOurLeagueTeam() : null;
        // BEWUSST ohne Untergrenze bei 0: Der Abzug wird direkt nach advanceLeaguesToNewSeason()
        // angewendet, wenn die neue Tabelle noch bei Punktstand 0 steht - ein Clamp auf 0 würde
        // die Sanktion dort vollständig wirkungslos machen (0 - 3, gedeckelt auf 0, bliebe 0).
        // Reale Punktabzüge (z.B. bei Insolvenz) starten ebenfalls im Minus, bis genug Punkte
        // nachgeholt wurden - exakt das soll hier auch passieren.
        if (team) team.points -= game.pendingFfpPointDeduction;
        game.pendingFfpPointDeduction = 0;
    }

    function renderFfpStatusBox() {
        let box = document.getElementById('ffp-status-box');
        if (!box) return;
        let r = game.ffpLastResult;
        let strikes = game.ffpStrikes || 0;
        box.innerHTML = `
            <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">
                Überwacht die Bilanzen der letzten ${FFP_MONITORING_SEASONS} Saisons (ohne Investitionen in Stadion, Vereinsgelände, Jugendarbeit und Kredite/Festgeld - die zählen nicht als Verlust). Geprüft wird am Saisonende.
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px;">
                <span>Status:</span>
                <strong style="color:${strikes === 0 ? 'var(--primary)' : 'var(--danger)'};">${strikes === 0 ? 'Regelkonform ✓' : `${strikes}. Verstoß`}</strong>
            </div>
            ${game.ffpTransferEmbargo ? '<div style="font-size:10px; color:var(--danger); margin-top:2px;">🚫 Transfersperre wegen Financial Fairplay aktiv</div>' : ''}
            ${r ? `<div style="font-size:10px; color:var(--text-muted); margin-top:4px;">
                Letzte Prüfung (nach Saison ${r.season}): ${formatVal(r.kumulativ)} über ${r.ueberwachteSaisons} Saison(en), erlaubt wären mindestens ${formatVal(-r.erlaubt)}.
            </div>` : '<div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Noch keine Prüfung erfolgt - die erste Bilanzkontrolle findet am Ende dieser Saison statt.</div>'}`;
    }
