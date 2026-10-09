
    // ==========================================
    // MEDIENRECHTE & TV-VERTRAG
    // ==========================================
    // Im echten Fußball sind TV-/Medienrechte oft die GRÖSSTE Einnahmequelle eines Vereins -
    // bisher fehlte das im Spiel komplett. Zwei Säulen:
    // 1. Liga-Kollektivvertrag: automatische TV-Ausschüttung zum Saisonende, gestaffelt nach
    //    Ligastärke UND Tabellenplatz (wie die echte Bundesliga-TV-Geld-Verteilung).
    // 2. Eigener Medienpartner: ein separat verhandelbarer Vertrag (wie bei Sponsoren) für
    //    zusätzliches Geld pro Heimspiel, mit einem Bonus für besonders attraktive Spiele
    //    (Derbys/Pokal), die Sender höher vergüten.

    // Kollektive TV-Gelder je Ligastufe und Saison. Die oberen beiden Ligen lagen deutlich
    // zu niedrig: ein Erstliga-Kader kostet rund 88 Mio. EUR Gehalt pro Saison, dem standen
    // 45 Mio. EUR TV-Geld plus wenige Millionen aus Tickets, Sponsoren und Fanartikel
    // gegenueber - die Startoption "1. Liga" war damit rechnerisch unspielbar.
    const LEAGUE_BASE_TV_MONEY = [64000000, 8000000, 1000000, 620000, 150000, 100000];
    const MATCHDAYS_PER_SEASON = 34;

    const MEDIA_PARTNER_TIERS = [
        { key: 'regional', label: 'Regional-TV', baseMult: 1.0, duration: 34, prestige: 1, maxLeagueLevel: 5 },
        { key: 'streaming', label: 'Streaming-Plattform', baseMult: 1.6, duration: 26, prestige: 2, maxLeagueLevel: 4 },
        { key: 'national', label: 'Nationaler Sender', baseMult: 2.4, duration: 20, prestige: 3, maxLeagueLevel: 2 },
        { key: 'international', label: 'Internationaler Pay-TV-Sender', baseMult: 3.6, duration: 14, prestige: 5, maxLeagueLevel: 0 }
    ];
    const MEDIA_PARTNER_NAMES = {
        regional: ['Regio-TV Mitteldeutschland', 'Lokal-Sport-Kanal', 'Heimat-TV'],
        streaming: ['StreamKick+', 'SportFlix', 'GoalStream Live'],
        national: ['Deutscher Sportkanal', 'National-Sport-TV', 'BundesSport 1'],
        international: ['Global Sports Network', 'EuroPay-TV Premium', 'WorldGoal International']
    };

    // 1. Liga-Kollektivvertrag: automatische Ausschüttung zum Saisonende.
    function calculateCollectiveTvMoney(leagueLevel, finalRank) {
        // Basiswert sinkt mit jeder tieferen Liga deutlich (wie real: Bundesliga-TV-Geld ist
        // um ein Vielfaches höher als Regionalliga-TV-Geld), Tabellenplatz gibt zusätzlich
        // einen Anteil (bessere Platzierung = größerer Anteil am Verteilungs-Topf).
        let base = LEAGUE_BASE_TV_MONEY[leagueLevel] ?? 100000;
        let rankFactor = Math.max(0.4, 1.5 - (finalRank - 1) * 0.055); // Platz 1: 1.5x, Platz 18: ~0.6x
        return Math.round(base * rankFactor);
    }

    // Die TV-Gelder waren bisher eine reine Einmalzahlung zum Saisonende. In den oberen
    // Ligen sind sie aber die mit Abstand groesste Einnahmequelle - ein Erstligist stand
    // dadurch eine ganze Saison lang zweistellig im Minus und wurde erst am letzten
    // Spieltag schlagartig wieder solvent. Echte Vereine bekommen ihr TV-Geld in Raten,
    // und genau so laeuft es jetzt: jeden Spieltag ein Vierunddreissigstel. Zum Saisonende
    // folgt nur noch die Differenz zum Endstand (Restausschuettung), der Tabellenplatz
    // bleibt also voll relevant.
    // Die Rate ist bewusst platzierungsNEUTRAL (Grundbetrag der Liga geteilt durch die
    // Spieltage). Zu Saisonbeginn steht die Tabelle noch auf null, ein zufaelliger erster
    // Platz wuerde sonst die ganze Saison ueber 50 % mehr Geld bringen. Der Tabellenplatz
    // entscheidet stattdessen vollstaendig ueber die Restausschuettung am Saisonende.
    // Langzeittest Bundesliga (21.6): ab Spieltag 6 richtet sich die Rate nach dem aktuellen
    // Tabellenplatz (nach unten). Die neutrale Rate entsprach etwa Platz 10 - wer am Ende darunter stand,
    // bekam bis zu 28 Mio. € zu viel (Platz 18: Anspruch 36 statt gezahlter 64 Mio.), und
    // die Restausschüttung forderte nie etwas zurück. Die ersten Spieltage bleiben neutral.
    const TV_RATE_RANK_FROM_MATCHDAY = 6;
    function getTvMoneyInstallment() {
        let base = LEAGUE_BASE_TV_MONEY[game.leagueLevel] ?? 100000;
        let rank = game.matchday >= TV_RATE_RANK_FROM_MATCHDAY && typeof getOwnLeagueRank === 'function' ? getOwnLeagueRank() : null;
        // Gedeckelt auf die neutrale Rate: schwache Plätze bekommen weniger, das Plus guter
        // Plätze kommt erst mit der Restausschüttung (früheres Geld im Saisonverlauf hätte
        // z.B. den passiven Pleiteklub-Szenario-Bot in 6 von 10 Läufen gerettet statt 1).
        let neutral = Math.round(base / MATCHDAYS_PER_SEASON);
        if (rank) return Math.min(neutral, Math.round(calculateCollectiveTvMoney(game.leagueLevel, rank) / MATCHDAYS_PER_SEASON));
        return neutral;
    }

    // Fallschirmgeld (25.19): wie die DFL zahlt die Liga einem Absteiger einmalig 25 % ihres
    // TV-Grundbetrags (Bundesliga → 16 Mio. €, 2. Liga → 2 Mio. €), damit er den teuren Kader
    // geordnet verkleinern kann statt Zwangsverkäufe der besten Spieler zu erleben.
    const RELEGATION_PARACHUTE_SHARE = 0.25;
    function getRelegationParachute(fromLevel) {
        return Math.round((LEAGUE_BASE_TV_MONEY[fromLevel] || 0) * RELEGATION_PARACHUTE_SHARE / 1000) * 1000;
    }
    // Aus concludeSeasonAndAdvance() direkt nach dem Abstieg (game.leagueLevel ist schon die neue Liga).
    function payRelegationParachute() {
        const betrag = getRelegationParachute(game.leagueLevel - 1);
        if (betrag <= 0) return 0;
        bucheMitLabel('🪂 Fallschirmgeld (TV)', betrag);
        addInboxMessage('finanzen', '🪂 Fallschirmgeld', `Die ${leagueNames[game.leagueLevel - 1]} zahlt dem Absteiger einmalig ${formatVal(betrag)} aus dem TV-Topf - Zeit, den Kader an die neue Liga anzupassen.`, 'screen-finances');
        return betrag;
    }

    // TV-Vorschuss für Aufsteiger (25.22): wie beim Fallschirmgeld 25 % des TV-Grundbetrags - hier der
    // NEUEN Liga, sofort beim Aufstieg (Bundesliga 16 Mio. €, 2. Liga 2 Mio. €). Er wird über die Saison
    // mit den Spieltagsraten verrechnet (getTvAdvanceDeduction), am Ende bleibt die Summe gleich - nur
    // ist das Geld im Sommerfenster da. Vorher kam ein Bundesliga-Aufsteiger mit ~15 Mio. € Kasse an,
    // Bundesliga-Spieler kosten 20-40 Mio. €: der Bot hatte 33 Mio. Transferbudget, konnte es aber
    // nicht ausgeben, die Elf lag 10-14 Punkte unter dem Ligaschnitt und stieg wieder ab.
    const TV_PROMOTION_ADVANCE_SHARE = 0.25;
    function payPromotionTvAdvance(season) {
        const betrag = Math.round((LEAGUE_BASE_TV_MONEY[game.leagueLevel] || 0) * TV_PROMOTION_ADVANCE_SHARE / 1000) * 1000;
        if (betrag <= 0) return 0;
        game.tvAdvance = { season, amount: betrag, remaining: betrag };
        bucheMitLabel('📺 TV-Vorschuss (Aufsteiger)', betrag);
        addInboxMessage('finanzen', '📺 TV-Vorschuss für den Aufsteiger', `Die ${leagueNames[game.leagueLevel]} zahlt ${formatVal(betrag)} TV-Geld vorab - für Verstärkungen im Sommerfenster. Der Vorschuss wird über die Saison mit den Spieltagsraten verrechnet.`, 'screen-finances');
        return betrag;
    }
    // Aus applyMatchdayFinances(): Anteil des Vorschusses, der von der heutigen TV-Rate abgeht.
    function getTvAdvanceDeduction() {
        const v = game.tvAdvance;
        if (!v || v.season !== game.season || !(v.remaining > 0)) return 0;
        const abzug = Math.min(v.remaining, Math.round(v.amount / MATCHDAYS_PER_SEASON));
        v.remaining -= abzug;
        return abzug;
    }
    // Saisonende: was vom Vorschuss noch offen ist (z. B. Aufstieg über die Nachfrist), wird verrechnet.
    function settleTvAdvanceAtSeasonEnd() {
        const v = game.tvAdvance;
        if (!v || v.season !== game.season) return 0;
        const rest = v.remaining || 0;
        if (rest > 0) bucheMitLabel('📺 TV-Vorschuss verrechnet', -rest);
        game.tvAdvance = null;
        return rest;
    }

    // Prognose für die Finanzübersicht (25.19): was die Abrechnung am Saisonende bei
    // gleichbleibendem Tabellenplatz bringt - bisher kam die Restausschüttung (bis 28 Mio. €)
    // oder die Rückforderung (bis 10 Mio. €) ohne Vorwarnung.
    function getTvSeasonOutlook() {
        const rank = typeof getOwnLeagueRank === 'function' ? getOwnLeagueRank() : null;
        if (!rank) return null;
        const anspruch = calculateCollectiveTvMoney(game.leagueLevel, rank);
        const offeneRaten = Math.max(0, MATCHDAYS_PER_SEASON - game.matchday + 1);
        const rate = Math.min(Math.round((LEAGUE_BASE_TV_MONEY[game.leagueLevel] ?? 100000) / MATCHDAYS_PER_SEASON), Math.round(anspruch / MATCHDAYS_PER_SEASON));
        const vorschussOffen = game.tvAdvance && game.tvAdvance.season === game.season ? (game.tvAdvance.remaining || 0) : 0;
        const rest = anspruch - (game.tvMoneyPaidThisSeason || 0) - offeneRaten * rate - vorschussOffen;
        return { rank, anspruch, rest: Math.round(rest / 1000) * 1000 };
    }

    // 2. Eigener Medienpartner: Angebote generieren, analog zum Sponsoren-System.
    function generateMediaRightsOffers() {
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        // Verknüpfung mit dem Manager-Medienimage: ein Manager mit gutem Ruf in der
        // Presse (z.B. durch geschickte Interview-Antworten) bekommt spürbar bessere
        // Angebote von Medienpartnern - ein niedriges Image drückt die Konditionen.
        let imageMult = 0.75 + ((game.managerMediaImage ?? 50) / 100) * 0.5; // 0.75x bis 1.25x
        // Liga-Voraussetzung: ein Kreisligist bekommt realistischerweise kein Angebot
        // vom internationalen Pay-TV - höherwertige Medienpartner setzen eine entsprechend
        // starke Liga voraus (nutzt das zuvor ungenutzte tierKey-Konzept sinnvoll).
        let eligibleTiers = MEDIA_PARTNER_TIERS.filter(t => game.leagueLevel <= t.maxLeagueLevel);
        mediaRights.dealOffers = eligibleTiers.map(tier => {
            let name = MEDIA_PARTNER_NAMES[tier.key][Math.floor(Math.random() * MEDIA_PARTNER_NAMES[tier.key].length)];
            let base = Math.round(3000 * tier.baseMult * scale * imageMult * 4);
            let signOn = Math.round(base * 3);
            return { id: 'media_' + tier.key + '_' + Date.now(), name, tierKey: tier.key, label: tier.label, base, signOn, duration: tier.duration, prestige: tier.prestige };
        });
    }
    function acceptMediaRightsOffer(offerId) {
        let offer = mediaRights.dealOffers.find(o => o.id === offerId);
        if (!offer) return;
        if (mediaRights.currentDeal) { showToast('Es läuft bereits ein Medienvertrag - erst kündigen oder auslaufen lassen!', 'error'); return; }
        playSound('whistle');
        game.money += offer.signOn;
        mediaRights.currentDeal = { name: offer.name, tierKey: offer.tierKey, label: offer.label, base: offer.base, remainingMatchdays: offer.duration, prestige: offer.prestige };
        mediaRights.dealOffers = [];
        addInboxMessage('vertrag', `📺 Medienvertrag mit ${offer.name}!`, `Ab sofort überträgt ${offer.name} (${offer.label}) eure Heimspiele - Handgeld ${formatVal(offer.signOn)}, laufend +${formatVal(offer.base)}/Heimspiel für ${offer.duration} Spieltage.`, 'screen-finances');
        // Prestige-Wirkung (Bugfix): ein hochkarätiger Medienpartner (Prestige 3+)
        // sorgt einmalig für spürbar mehr überregionale Bekanntheit - dauerhaft höheres
        // Grundinteresse der Fans, statt wie zuvor ein unbenutztes Datenfeld zu sein.
        if (offer.prestige >= 3 && typeof boostFanBaseFloor === 'function') {
            boostFanBaseFloor(offer.prestige, `Die überregionale Medienpräsenz durch den neuen Vertrag mit ${offer.name}`);
        }
        showToast(`📺 Medienvertrag mit ${offer.name} unterschrieben!`, 'success');
        renderMediaRightsView();
        updateUI();
    }
    function cancelMediaRightsDeal() {
        if (!mediaRights.currentDeal) return;
        playSound('click');
        mediaRights.currentDeal = null;
        showToast('📺 Medienvertrag gekündigt.', 'success');
        renderMediaRightsView();
    }

    // Wird bei jedem Heimspiel aufgerufen (aus applyMatchdayFinances): zahlt den laufenden
    // Medienvertrag aus, inklusive Bonus für besonders attraktive Spiele (Derby/Pokal), die
    // Sender bekanntlich höher vergüten.
    function tickMediaRightsPayment(isDerbyMatch, isCupMatch) {
        if (!mediaRights.currentDeal) return 0;
        let payout = mediaRights.currentDeal.base;
        let bigMatchBonus = 0;
        if (isDerbyMatch || isCupMatch) {
            bigMatchBonus = Math.round(payout * (isDerbyMatch ? 0.8 : 0.5));
            payout += bigMatchBonus;
        }
        game.money += payout;
        mediaRights.seasonTvIncomeTotal = (mediaRights.seasonTvIncomeTotal || 0) + payout;
        // Bugfix: das "prestige"-Feld der Medienpartner-Tiers wurde beim Bau des Systems
        // versehentlich nie tatsächlich verkabelt - ein internationaler Pay-TV-Sender
        // brachte bisher genauso viel mediale Reichweite wie ein Regionalsender. Jetzt
        // erhöht ein höherwertiger Medienpartner spürbar das Manager-Medienimage (breitere
        // öffentliche Wahrnehmung) und leicht den Fan-Zulauf pro Heimspiel.
        if (mediaRights.currentDeal.prestige) {
            game.managerMediaImage = Math.min(100, (game.managerMediaImage ?? 50) + mediaRights.currentDeal.prestige * 0.15);
        }
        mediaRights.currentDeal.remainingMatchdays--;
        if (mediaRights.currentDeal.remainingMatchdays <= 0) {
            addInboxMessage('vertrag', `📺 Medienvertrag mit ${mediaRights.currentDeal.name} ausgelaufen`, `Der Vertrag ist ausgelaufen - verhandle im Finanzen-Bereich einen neuen Medienvertrag.`, 'screen-finances');
            mediaRights.currentDeal = null;
            generateMediaRightsOffers();
        }
        return { payout, bigMatchBonus };
    }

    function renderMediaRightsView() {
        let box = document.getElementById('media-rights-box');
        if (!box) return;
        if (!mediaRights.dealOffers || (mediaRights.dealOffers.length === 0 && !mediaRights.currentDeal)) generateMediaRightsOffers();
        if (mediaRights.currentDeal) {
            let d = mediaRights.currentDeal;
            box.innerHTML = `
                <div class="box" style="font-size:10px;">
                    <strong style="color:var(--accent);">📺 ${d.name}</strong> (${d.label})<br>
                    Laufend: <strong>+${formatVal(d.base)}</strong>/Heimspiel · Restlaufzeit: <strong>${d.remainingMatchdays} SpT</strong><br>
                    <span style="color:var(--text-muted); font-size:9px;">Bonus bei Derby (+80%) & Pokalspielen (+50%)</span>
                </div>
                <button onclick="cancelMediaRightsDeal()" class="btn-secondary" style="margin-top:4px;">Vertrag kündigen</button>
            `;
        } else {
            box.innerHTML = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Kein aktiver Medienvertrag - wähle einen Partner:</div>' +
                mediaRights.dealOffers.map(o => `
                    <div class="box" style="font-size:10px; margin-bottom:4px;">
                        <strong>${o.name}</strong> (${o.label})<br>
                        Handgeld: ${formatVal(o.signOn)} · Laufend: +${formatVal(o.base)}/Heimspiel · ${o.duration} SpT
                        <button onclick="acceptMediaRightsOffer('${o.id}')" class="btn-action" style="margin-top:4px;">Unterschreiben</button>
                    </div>
                `).join('');
        }
        let tvHistBox = document.getElementById('tv-income-history-box');
        if (tvHistBox) {
            tvHistBox.innerHTML = `
                <div class="box" style="font-size:10px;">Medienpartner-Einnahmen diese Saison: <strong style="color:var(--gold);">${formatVal(mediaRights.seasonTvIncomeTotal || 0)}</strong></div>
                <div class="box" style="font-size:10px;">Letzte Liga-TV-Ausschüttung: <strong style="color:var(--gold);">${formatVal(game.lastLeagueTvPayout || 0)}</strong></div>
            `;
        }
    }

