    // ==========================================
    // MEDIENRECHTE & TV-VERTRAG (NEU)
    // ==========================================
    // Im echten Fußball sind TV-/Medienrechte oft die GRÖSSTE Einnahmequelle eines Vereins -
    // bisher fehlte das im Spiel komplett. Zwei Säulen:
    // 1. Liga-Kollektivvertrag: automatische TV-Ausschüttung zum Saisonende, gestaffelt nach
    //    Ligastärke UND Tabellenplatz (wie die echte Bundesliga-TV-Geld-Verteilung).
    // 2. Eigener Medienpartner: ein separat verhandelbarer Vertrag (wie bei Sponsoren) für
    //    zusätzliches Geld pro Heimspiel, mit einem Bonus für besonders attraktive Spiele
    //    (Derbys/Pokal), die Sender höher vergüten.

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
        const LEAGUE_BASE_TV_MONEY = [45000000, 12000000, 4000000, 1200000, 350000, 100000];
        let base = LEAGUE_BASE_TV_MONEY[leagueLevel] ?? 100000;
        let rankFactor = Math.max(0.4, 1.5 - (finalRank - 1) * 0.055); // Platz 1: 1.5x, Platz 18: ~0.6x
        return Math.round(base * rankFactor);
    }

    // 2. Eigener Medienpartner: Angebote generieren, analog zum Sponsoren-System.
    function generateMediaRightsOffers() {
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        // Verknüpfung mit dem Manager-Medienimage (NEU): ein Manager mit gutem Ruf in der
        // Presse (z.B. durch geschickte Interview-Antworten) bekommt spürbar bessere
        // Angebote von Medienpartnern - ein niedriges Image drückt die Konditionen.
        let imageMult = 0.75 + ((game.managerMediaImage ?? 50) / 100) * 0.5; // 0.75x bis 1.25x
        // Liga-Voraussetzung (NEU): ein Kreisligist bekommt realistischerweise kein Angebot
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
        // Prestige-Wirkung (NEU, Bugfix): ein hochkarätiger Medienpartner (Prestige 3+)
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
