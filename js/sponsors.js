
    // ==========================================
    // SPONSOREN: HAUPTSPONSOR, AUSRÜSTER, ÄRMEL & BANDEN - ALLE MIT ECHTEN VERHANDLUNGEN,
    // VARIABLEN LAUFZEITEN, ABLAUF & ERFOLGSABHÄNGIGEN BONI (POKAL/AUFSTIEG)
    // ==========================================
    const SPONSOR_NAME_PREFIXES = ["Nord", "Rhein", "Metro", "City", "Regio", "Vital", "Elektro", "Bau", "Agrar", "Media"];
    const SPONSOR_NAME_SUFFIXES = ["Energie", "Bank", "Bau AG", "Logistik", "Versicherung", "Technik", "Finanz", "Handel", "Werke", "Digital"];
    const KIT_BRAND_PREFIXES = ["Sprint", "Rapid", "Ares", "Condor", "Falke", "Titan", "Vertex", "Delta", "Puma-", "Kicker"];
    const KIT_BRAND_SUFFIXES = ["Sport", "Athletic", "Wear", "Team", "Pro", "Gear", "Performance"];
    const SLEEVE_BRAND_PREFIXES = ["Quantum", "Nova", "Blitz", "Fusion", "Apex", "Orbit", "Vector", "Prisma"];
    const SLEEVE_BRAND_SUFFIXES = ["Systems", "Mobility", "Insurance", "Cloud", "Payments", "Telekom", "Solutions"];
    const MAX_PENDING_SPONSOR_OFFERS = 2;
    const MAX_PENDING_KIT_OFFERS = 2;
    const MAX_PENDING_BANDEN_OFFERS = 2;
    const MAX_PENDING_SLEEVE_OFFERS = 2;
    const MAX_NEGOTIATIONS = 2;

    // Drei Laufzeit-Modelle, wie bei echten Sponsorenverträgen: kurz = teurer pro Spieltag
    // aber schnell wieder verhandelbar, lang = güntiger pro Spieltag aber dafür mit fetter
    // Antrittsprämie und langer Bindung.
    const CONTRACT_DURATION_TIERS = [
        { key: 'kurz', label: 'Kurzzeit-Deal', sp: 17, payMult: 1.18, signOnMult: 0 },
        { key: 'standard', label: 'Standardvertrag', sp: 34, payMult: 1.0, signOnMult: 0.3 },
        { key: 'lang', label: 'Langfrist-Partnerschaft', sp: 51, payMult: 0.85, signOnMult: 0.9 }
    ];

    function rollDurationTier() {
        return CONTRACT_DURATION_TIERS[Math.floor(Math.random() * CONTRACT_DURATION_TIERS.length)];
    }

    // ---------- BRANCHEN-EXKLUSIVITÄT ----------
    const SPONSOR_CATEGORIES = ['Getränke', 'Automobil', 'Elektronik', 'Versicherung', 'Baumarkt', 'Mode', 'Finanzen'];
    function rollSponsorCategory() {
        return SPONSOR_CATEGORIES[Math.floor(Math.random() * SPONSOR_CATEGORIES.length)];
    }
    // Prüft, ob bereits ein aktiver Sponsor (Haupt/Ausrüster/Ärmel/Banden) dieselbe Branche
    // belegt - echte Sponsoren dulden i.d.R. keine direkte Konkurrenz im selben Marktsegment
    // am selben Trikot/Stadion. Gibt bei Konflikt die Branche zurück (kein Hard-Block, um das
    // Verhandeln nicht zu frustrierend zu machen - stattdessen Rabatt, siehe Angebots-Annahme).
    function getExclusivityConflict(category, excludeSlot = null) {
        if (!category) return null;
        let activeCategories = [];
        if (excludeSlot !== 'sponsor' && game.sponsor.base > 500) activeCategories.push(game.sponsor.category);
        if (excludeSlot !== 'kit' && game.kitSupplier.income > 0) activeCategories.push(game.kitSupplier.category);
        if (excludeSlot !== 'sleeve' && (game.sleeveSponsor?.income || 0) > 0) activeCategories.push(game.sleeveSponsor.category);
        if (excludeSlot !== 'banden') bandenSponsors.forEach(b => activeCategories.push(b.category));
        return activeCategories.includes(category) ? category : null;
    }

    function generateSponsorName() {
        let name;
        do {
            name = SPONSOR_NAME_PREFIXES[Math.floor(Math.random() * SPONSOR_NAME_PREFIXES.length)] +
                   SPONSOR_NAME_SUFFIXES[Math.floor(Math.random() * SPONSOR_NAME_SUFFIXES.length)];
        } while (name === game.sponsor.name);
        return name;
    }

    function generateKitBrandName() {
        let name;
        do {
            name = KIT_BRAND_PREFIXES[Math.floor(Math.random() * KIT_BRAND_PREFIXES.length)] +
                   KIT_BRAND_SUFFIXES[Math.floor(Math.random() * KIT_BRAND_SUFFIXES.length)];
        } while (name === game.kitSupplier.name);
        return name;
    }

    function generateSleeveBrandName() {
        let name;
        do {
            name = SLEEVE_BRAND_PREFIXES[Math.floor(Math.random() * SLEEVE_BRAND_PREFIXES.length)] +
                   SLEEVE_BRAND_SUFFIXES[Math.floor(Math.random() * SLEEVE_BRAND_SUFFIXES.length)];
        } while (name === game.sleeveSponsor.name);
        return name;
    }

    function leagueScaleFactor() {
        return (4 - game.leagueLevel) * 0.25 + 1;
    }

    // Generischer Verhandlungs-Kern, von allen vier Vertragstypen gleichermaßen genutzt.
    function negotiateOffer(offer, fields) {
        offer.negotiationsUsed = (offer.negotiationsUsed || 0) + 1;
        let chance = 0.35 + (game.boardSat / 100) * 0.3;
        let success = Math.random() < chance;
        fields.forEach(f => {
            offer[f] = success
                ? Math.round(offer[f] * 1.12 / 100) * 100
                : Math.max(500, Math.round(offer[f] * 0.95 / 100) * 100);
        });
        return success;
    }

    // Themen-Bonus: manche Sponsoren zahlen zusätzlich zur Grundvergütung eine thematisch
    // passende Sonderprämie (z.B. eine Versicherung honoriert Zu-Null-Spiele, ein
    // Getränkehersteller zahlt pro Zuschauer). Nicht jedes Angebot hat einen.
    const THEMED_BONUS_POOL = [
        { type: null, weight: 40, label: '' },
        { type: 'cleanSheet', weight: 30, label: 'Bonus pro Zu-Null-Spiel' },
        { type: 'attendance', weight: 30, label: 'Bonus pro Zuschauer' }
    ];
    function rollThemedBonus(lf) {
        let totalWeight = THEMED_BONUS_POOL.reduce((s, t) => s + t.weight, 0);
        let roll = Math.random() * totalWeight;
        for (let t of THEMED_BONUS_POOL) {
            if (roll < t.weight) {
                if (!t.type) return { type: null, amount: 0, label: '' };
                let amount = t.type === 'cleanSheet' ? Math.round((400 + Math.random() * 800) * lf / 50) * 50 : +(0.15 + Math.random() * 0.3).toFixed(2);
                return { type: t.type, amount, label: t.label };
            }
            roll -= t.weight;
        }
        return { type: null, amount: 0, label: '' };
    }

    // ---------- HAUPTSPONSOR ----------
    function checkIncomingSponsorOffers(force = false) {
        if (sponsorOffers.length >= MAX_PENDING_SPONSOR_OFFERS) return;
        if (!force && Math.random() > 0.12) return;
        let lf = leagueScaleFactor();
        let tier = rollDurationTier();
        let base = Math.round((2000 + Math.random() * 2500) * lf * tier.payMult / 100) * 100;
        // Manager-Medienimage (NEU): ein beliebter, medienwirksamer Manager macht den Verein
        // für Sponsoren attraktiver - kleiner, aber echter Aufschlag auf das Grundangebot.
        let imageMult = 1 + Math.max(0, ((game.managerMediaImage || 50) - 50) / 250);
        base = Math.round(base * imageMult);
        let winBonus = Math.round((800 + Math.random() * 1500) * lf * tier.payMult / 100) * 100;
        let cupBonus = Math.round((1200 + Math.random() * 2500) * lf / 100) * 100;
        let promotionBonus = Math.round((12000 + Math.random() * 18000) * lf / 500) * 500;
        let signOn = tier.signOnMult > 0 ? Math.round(base * 8 * tier.signOnMult / 100) * 100 : 0;
        let themed = rollThemedBonus(lf);
        let category = rollSponsorCategory();
        sponsorOffers.push({
            id: Date.now() + Math.floor(Math.random() * 1000), name: generateSponsorName(),
            base, winBonus, cupBonus, promotionBonus, signOn, category,
            themedBonusType: themed.type, themedBonusAmount: themed.amount, themedBonusLabel: themed.label,
            tierKey: tier.key, tierLabel: tier.label, sp: tier.sp, negotiationsUsed: 0
        });
    }

    function acceptSponsorOffer(offerId) {
        let offer = sponsorOffers.find(o => o.id === offerId);
        if (!offer) return;
        playSound('whistle');
        let conflict = getExclusivityConflict(offer.category, 'sponsor');
        let discountFactor = conflict ? 0.7 : 1.0;
        if (offer.signOn > 0) game.money += Math.round(offer.signOn * discountFactor);
        game.sponsor = {
            name: offer.name, base: Math.round(offer.base * discountFactor), winBonus: Math.round(offer.winBonus * discountFactor),
            cupBonus: offer.cupBonus, promotionBonus: offer.promotionBonus,
            duration: offer.sp, tier: offer.tierKey, category: offer.category,
            themedBonusType: offer.themedBonusType || null, themedBonusAmount: offer.themedBonusAmount || 0,
            loyalty: 65, lastActivationMatchday: null
        };
        sponsorOffers = [];
        let conflictNote = conflict ? ` ⚠️ Branchenkonflikt mit bestehendem ${conflict}-Sponsor - Vergütung um 30% reduziert!` : '';
        showToast(`🤝 Neuer Hauptsponsor: ${offer.name} (${offer.tierLabel}, ${offer.sp} Spieltage)${offer.signOn > 0 ? ` inkl. ${formatVal(Math.round(offer.signOn * discountFactor))} Handgeld` : ''}!${conflictNote}`, conflict ? 'error' : 'success');
        renderSponsorsView(); updateUI();
    }

    function negotiateSponsorOffer(offerId) {
        let offer = sponsorOffers.find(o => o.id === offerId);
        if (!offer) return;
        if (offer.negotiationsUsed >= MAX_NEGOTIATIONS) { showToast('Keine weiteren Nachverhandlungen möglich!', 'error'); return; }
        playSound('click');
        let success = negotiateOffer(offer, ['base', 'winBonus']);
        showToast(success ? '📈 Nachverhandlung erfolgreich! Das Angebot wurde verbessert.' : '📉 Der Sponsor lässt sich nicht drängen und reduziert leicht das Angebot.', success ? 'success' : 'error');
        renderSponsorsView();
    }

    function rejectSponsorOffer(offerId) {
        playSound('click');
        sponsorOffers = sponsorOffers.filter(o => o.id !== offerId);
        renderSponsorsView();
    }

    // ---------- TRIKOT-AUSRÜSTER ----------
    function checkIncomingKitOffers(force = false) {
        if (kitSupplierOffers.length >= MAX_PENDING_KIT_OFFERS) return;
        if (!force && Math.random() > 0.12) return;
        let lf = leagueScaleFactor();
        let tier = rollDurationTier();
        let signOn = Math.round((15000 + Math.random() * 35000) * lf * (0.6 + tier.signOnMult) / 500) * 500;
        let income = Math.round((1000 + Math.random() * 2000) * lf * tier.payMult / 100) * 100;
        let category = rollSponsorCategory();
        kitSupplierOffers.push({
            id: Date.now() + Math.floor(Math.random() * 1000), name: generateKitBrandName(),
            signOn, income, category, tierKey: tier.key, tierLabel: tier.label, sp: tier.sp, negotiationsUsed: 0
        });
    }

    function acceptKitOffer(offerId) {
        let offer = kitSupplierOffers.find(o => o.id === offerId);
        if (!offer) return;
        playSound('whistle');
        let conflict = getExclusivityConflict(offer.category, 'kit');
        let discountFactor = conflict ? 0.7 : 1.0;
        game.money += Math.round(offer.signOn * discountFactor);
        game.kitSupplier = { name: offer.name, income: Math.round(offer.income * discountFactor), duration: offer.sp, category: offer.category };
        kitSupplierOffers = [];
        let conflictNote = conflict ? ` ⚠️ Branchenkonflikt mit bestehendem ${conflict}-Sponsor - Vergütung um 30% reduziert!` : '';
        showToast(`👕 Neuer Trikot-Ausrüster: ${offer.name} (${offer.tierLabel}, ${offer.sp} Spieltage)!${conflictNote}`, conflict ? 'error' : 'success');
        renderSponsorsView(); updateUI();
    }

    function negotiateKitOffer(offerId) {
        let offer = kitSupplierOffers.find(o => o.id === offerId);
        if (!offer) return;
        if (offer.negotiationsUsed >= MAX_NEGOTIATIONS) { showToast('Keine weiteren Nachverhandlungen möglich!', 'error'); return; }
        playSound('click');
        let success = negotiateOffer(offer, ['signOn', 'income']);
        showToast(success ? '📈 Nachverhandlung erfolgreich!' : '📉 Der Ausrüster reduziert leicht das Angebot.', success ? 'success' : 'error');
        renderSponsorsView();
    }

    function rejectKitOffer(offerId) {
        playSound('click');
        kitSupplierOffers = kitSupplierOffers.filter(o => o.id !== offerId);
        renderSponsorsView();
    }

    // ---------- ÄRMELSPONSOR ----------
    // Vierter Vertragstyp: zahlt (anders als Ausrüster/Banden) bei JEDEM Spiel, nicht nur daheim.
    function checkIncomingSleeveOffers(force = false) {
        if (sleeveSponsorOffers.length >= MAX_PENDING_SLEEVE_OFFERS) return;
        if (!force && Math.random() > 0.10) return;
        let lf = leagueScaleFactor();
        let tier = rollDurationTier();
        let signOn = Math.round((8000 + Math.random() * 20000) * lf * (0.5 + tier.signOnMult) / 500) * 500;
        let income = Math.round((600 + Math.random() * 1400) * lf * tier.payMult / 50) * 50;
        let category = rollSponsorCategory();
        sleeveSponsorOffers.push({
            id: Date.now() + Math.floor(Math.random() * 1000), name: generateSleeveBrandName(),
            signOn, income, category, tierKey: tier.key, tierLabel: tier.label, sp: tier.sp, negotiationsUsed: 0
        });
    }

    function acceptSleeveOffer(offerId) {
        let offer = sleeveSponsorOffers.find(o => o.id === offerId);
        if (!offer) return;
        playSound('whistle');
        let conflict = getExclusivityConflict(offer.category, 'sleeve');
        let discountFactor = conflict ? 0.7 : 1.0;
        if (offer.signOn > 0) game.money += Math.round(offer.signOn * discountFactor);
        game.sleeveSponsor = { name: offer.name, income: Math.round(offer.income * discountFactor), duration: offer.sp, category: offer.category };
        sleeveSponsorOffers = [];
        let conflictNote = conflict ? ` ⚠️ Branchenkonflikt mit bestehendem ${conflict}-Sponsor - Vergütung um 30% reduziert!` : '';
        showToast(`🎽 Neuer Ärmelsponsor: ${offer.name} (${offer.tierLabel}, ${offer.sp} Spieltage)!${conflictNote}`, conflict ? 'error' : 'success');
        renderSponsorsView(); updateUI();
    }

    function negotiateSleeveOffer(offerId) {
        let offer = sleeveSponsorOffers.find(o => o.id === offerId);
        if (!offer) return;
        if (offer.negotiationsUsed >= MAX_NEGOTIATIONS) { showToast('Keine weiteren Nachverhandlungen möglich!', 'error'); return; }
        playSound('click');
        let success = negotiateOffer(offer, ['signOn', 'income']);
        showToast(success ? '📈 Nachverhandlung erfolgreich!' : '📉 Der Partner reduziert leicht das Angebot.', success ? 'success' : 'error');
        renderSponsorsView();
    }

    function rejectSleeveOffer(offerId) {
        playSound('click');
        sleeveSponsorOffers = sleeveSponsorOffers.filter(o => o.id !== offerId);
        renderSponsorsView();
    }

    // ---------- BANDENWERBUNG (STADIONWEIT) ----------
    // Werbeflächen hängen jetzt an den echten Stadionbereichen statt an acht anonymen
    // Plätzen: jeder Block des Stadions (siehe stadium.blocks) hat eigene Bandenplätze,
    // deren Anzahl mit seiner Kapazität wächst. Wer das Stadion ausbaut, schafft damit
    // automatisch neue Werbeflächen - der Ausbau zahlt sich doppelt aus.
    //
    // "visibility" bildet ab, wie präsent eine Bande in TV-Bildern und auf Pressefotos ist:
    // Haupttribüne und Gegengerade liegen im Hauptkamera-Schwenk, die Presse-Tribüne im
    // Rücken der Interviewpositionen, VIP-Logen erreichen ein zahlungskräftiges Publikum.
    const BANDEN_AREA_META = {
        west:      { visibility: 1.35, note: 'Hauptkamera' },
        gegen:     { visibility: 1.30, note: 'Kameraschwenk' },
        presse:    { visibility: 1.45, note: 'Pressefotos' },
        vipLogen:  { visibility: 1.60, note: 'Zahlungskräftiges Publikum' },
        kurve:     { visibility: 1.15, note: 'Stimmungsbilder' },
        haupt:     { visibility: 1.10, note: '' },
        hauptNord: { visibility: 0.95, note: '' },
        suedOber:  { visibility: 0.95, note: '' },
        familie:   { visibility: 0.85, note: '' },
        gaeste:    { visibility: 0.80, note: 'Gästeblock' }
    };

    function getBandenAreaKeys() {
        return Object.keys(stadium.blocks || {}).filter(k => BANDEN_AREA_META[k]);
    }
    function getBandenAreaName(key) {
        return stadium.blocks?.[key]?.name || key;
    }
    // Anzahl der Bandenplätze eines Bereichs - wächst mit der Kapazität, also mit jedem Ausbau.
    function getBandenSlotsForArea(key) {
        let cap = stadium.blocks?.[key]?.cap || 0;
        return Math.max(1, Math.min(6, Math.round(cap / 1200)));
    }
    function getBandenSponsorsInArea(key) {
        return bandenSponsors.filter(b => b.area === key);
    }
    function getTotalBandenSlots() {
        return getBandenAreaKeys().reduce((s, k) => s + getBandenSlotsForArea(k), 0);
    }
    function getFreeBandenAreas() {
        return getBandenAreaKeys().filter(k => getBandenSponsorsInArea(k).length < getBandenSlotsForArea(k));
    }

    // Vergütung einer einzelnen Bande: Ligastufe x Sichtbarkeit x Größe des Bereichs.
    function rollBandenIncomeForArea(key, type, payMult) {
        let cap = stadium.blocks?.[key]?.cap || 0;
        let meta = BANDEN_AREA_META[key] || { visibility: 1 };
        let sizeFactor = 0.5 + Math.min(1.5, cap / 3000);
        let typeBase = type === 'LED-Bande' ? (900 + Math.random() * 1000) : (350 + Math.random() * 600);
        return Math.round(typeBase * leagueScaleFactor() * meta.visibility * sizeFactor * payMult / 50) * 50;
    }

    // Altbestand aus Spielständen vor der stadionweiten Umstellung: Banden ohne Bereich
    // werden auf freie Plätze verteilt, damit sie nicht als "heimatlos" durchfallen.
    function migrateLegacyBandenSponsors() {
        bandenSponsors.forEach(b => {
            if (b.area && BANDEN_AREA_META[b.area]) return;
            let free = getFreeBandenAreas();
            b.area = free.length > 0 ? free[0] : getBandenAreaKeys()[0];
        });
    }

    function checkIncomingBandenOffers(force = false) {
        if (bandenOffers.length >= MAX_PENDING_BANDEN_OFFERS) return;
        let freeAreas = getFreeBandenAreas();
        if (freeAreas.length === 0) return;
        if (!force && Math.random() > 0.12) return;
        let area = freeAreas[Math.floor(Math.random() * freeAreas.length)];
        let tier = rollDurationTier();
        let types = ["Statisch", "LED-Bande"];
        let type = types[Math.floor(Math.random() * types.length)];
        let category = rollSponsorCategory();
        bandenOffers.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: generateSponsorName() + " " + ["GmbH", "& Co. KG", "Handel", "Service"][Math.floor(Math.random() * 4)],
            type, income: rollBandenIncomeForArea(area, type, tier.payMult), category,
            area, areaName: getBandenAreaName(area),
            tierKey: tier.key, tierLabel: tier.label, sp: tier.sp, negotiationsUsed: 0
        });
    }

    function acceptBandenOffer(offerId) {
        let offer = bandenOffers.find(o => o.id === offerId);
        if (!offer) return;
        // Der Bereich kann zwischenzeitlich belegt worden sein (mehrere offene Angebote).
        if (getBandenSponsorsInArea(offer.area).length >= getBandenSlotsForArea(offer.area)) {
            showToast(`Im Bereich "${getBandenAreaName(offer.area)}" ist kein Bandenplatz mehr frei!`, 'error'); return;
        }
        playSound('whistle');
        let conflict = getExclusivityConflict(offer.category, 'banden');
        let discountFactor = conflict ? 0.7 : 1.0;
        bandenSponsors.push({
            id: Date.now(), name: offer.name, type: offer.type,
            income: Math.round(offer.income * discountFactor), active: true,
            duration: offer.sp, category: offer.category, area: offer.area
        });
        bandenOffers = bandenOffers.filter(o => o.id !== offerId);
        let conflictNote = conflict ? ` ⚠️ Branchenkonflikt mit bestehendem ${conflict}-Sponsor - Vergütung um 30% reduziert!` : '';
        showToast(`📢 Bandenwerbung an der ${getBandenAreaName(offer.area)} akquiriert (${offer.tierLabel}, ${offer.sp} Spieltage)!${conflictNote}`, conflict ? 'error' : 'success');
        renderSponsorsView(); updateUI();
    }

    function negotiateBandenOffer(offerId) {
        let offer = bandenOffers.find(o => o.id === offerId);
        if (!offer) return;
        if (offer.negotiationsUsed >= MAX_NEGOTIATIONS) { showToast('Keine weiteren Nachverhandlungen möglich!', 'error'); return; }
        playSound('click');
        let success = negotiateOffer(offer, ['income']);
        showToast(success ? '📈 Nachverhandlung erfolgreich!' : '📉 Der Werbepartner reduziert leicht das Angebot.', success ? 'success' : 'error');
        renderSponsorsView();
    }

    function rejectBandenOffer(offerId) {
        playSound('click');
        bandenOffers = bandenOffers.filter(o => o.id !== offerId);
        renderSponsorsView();
    }

    function toggleBande(id) {
        let b = bandenSponsors.find(x => x.id === id);
        if (b) { b.active = !b.active; renderSponsorsView(); updateUI(); }
    }

    function getBandenIncome() {
        let base = bandenSponsors.filter(b => b.active).reduce((sum, b) => sum + b.income, 0);
        base = staffMembers.marketingDir.hired ? Math.round(base * 1.2) : base;
        // Digitale Anzeigen (Videowalls) erhöhen die Sichtbarkeit der Werbepartner zusätzlich -
        // Bandenwerbung UND Videowalls zusammen sind für Sponsoren besonders attraktiv.
        return stadium.videowalls ? Math.round(base * 1.15) : base;
    }

    // ---------- VERTRAGSABLAUF ----------
    // Zählt die Restlaufzeit aller vier Vertragstypen pro Spieltag herunter. Läuft ein
    // Vertrag aus, fällt er auf einen schwachen Basiszustand zurück - danach können
    // durch checkIncoming*Offers() ganz normal wieder neue Angebote eintreffen.
    // ---------- SAISONSTART: SPONSOREN MÜSSEN NEU VERHANDELT WERDEN ----------
    // Zu jedem neuen Saisonbeginn laufen ALLE vier Sponsoren-Verträge automatisch aus und
    // es werden garantiert frische Angebote für jeden Vertragstyp bereitgestellt - so wird
    // die Sponsorensuche zu einem festen Bestandteil der Saisonvorbereitung statt einer
    // beliebig lang laufenden Hintergrund-Einnahme.
    function forceSponsorRenewalAtSeasonStart(isFreshGame = false) {
        let hadSponsor = !isFreshGame && game.sponsor.base > 500;
        let hadKit = !isFreshGame && game.kitSupplier.income > 0;
        let hadSleeve = !isFreshGame && (game.sleeveSponsor?.income || 0) > 0;
        let hadBanden = !isFreshGame && bandenSponsors.length > 0;

        game.sponsor = { name: 'Kein Hauptsponsor', base: 500, winBonus: 200, cupBonus: 0, promotionBonus: 0, duration: 999, tier: 'kurz', themedBonusType: null, themedBonusAmount: 0, category: null };
        game.kitSupplier = { name: 'Keiner', income: 0, duration: 0 };
        game.sleeveSponsor = { name: 'Keiner', income: 0, duration: 0 };
        game.busSponsorActive = false; // hängt am Hauptsponsor-Vertrag, läuft mit diesem aus
        game.busSponsorPermanentlyRejected = false; game.busSponsorViaBanden = false; // neuer Sponsor, neue Chance
        bandenSponsors = [];

        sponsorOffers = [];
        kitSupplierOffers = [];
        sleeveSponsorOffers = [];
        bandenOffers = [];

        // Garantierte Angebote (nicht die übliche Zufallschance) - für jeden Vertragstyp
        // mindestens eines, damit direkt zu Saisonbeginn wirklich etwas zu verhandeln da ist.
        for (let i = 0; i < 2; i++) {
            let lf = leagueScaleFactor();
            let tier = rollDurationTier();
            let base = Math.round((2000 + Math.random() * 2500) * lf * tier.payMult / 100) * 100;
            let winBonus = Math.round((800 + Math.random() * 1500) * lf * tier.payMult / 100) * 100;
            let cupBonus = Math.round((1200 + Math.random() * 2500) * lf / 100) * 100;
            let promotionBonus = Math.round((12000 + Math.random() * 18000) * lf / 500) * 500;
            let signOn = tier.signOnMult > 0 ? Math.round(base * 8 * tier.signOnMult / 100) * 100 : 0;
            sponsorOffers.push({ id: Date.now() + i, name: generateSponsorName(), base, winBonus, cupBonus, promotionBonus, signOn, tierKey: tier.key, tierLabel: tier.label, sp: tier.sp, negotiationsUsed: 0 });
        }
        checkIncomingKitOffers(true); checkIncomingKitOffers(true);
        checkIncomingSleeveOffers(true);
        checkIncomingBandenOffers(true); checkIncomingBandenOffers(true);

        if (hadSponsor || hadKit || hadSleeve || hadBanden) {
            addInboxMessage('vertrag', '📋 Sponsoren-Neuverhandlung fällig!', 'Zu Saisonbeginn sind alle Sponsorenverträge ausgelaufen. Neue Angebote liegen bereit - verhandle sie im Finanzen-Bereich.', 'screen-sponsors');
            showToast('📋 Neue Saison: Alle Sponsorenverträge müssen neu verhandelt werden!', 'error');
        } else {
            addInboxMessage('vertrag', '📋 Sponsoren-Angebote eingetroffen', isFreshGame
                ? 'Dein neuer Klub hat noch keine Sponsoren - erste Angebote liegen bereit. Verhandle sie im Finanzen-Bereich, bevor die Saison beginnt!'
                : 'Erste Sponsoren-Angebote für die neue Saison liegen bereit - verhandle sie im Finanzen-Bereich.', 'screen-sponsors');
            if (isFreshGame) showToast('📋 Erste Sponsoren-Angebote sind eingetroffen - verhandle sie im Finanzen-Bereich!', 'success');
        }
    }

    // ---------- BUS-SPONSORING ----------
    // Bei aktivem Hauptsponsor kann der Mannschaftsbus gegen eine einmalige Zahlung
    // gebrandet werden - jetzt als echte Verhandlung (Stepper-Modal, gleiches Prinzip wie
    // die Transfer-Verhandlung) statt eines starren Fixpreises, mit einer vom Liga-Erfolg
    // abhängigen Gegenleistung des Sponsors.
    let busSponsorNegoAmount = 0;
    let busSponsorNegoStep = 1000;

    // Günstigere Bus-Sponsoring-Alternative über einen aktiven Bandensponsor, falls der
    // Hauptsponsor das Thema dauerhaft abgelehnt hat - fixer, moderater Preis statt
    // Verhandlung (ein kleiner Bandenpartner pokert nicht groß), mit etwas schwächerem
    // Effekt (siehe busPenaltyMult in match.js: Bandensponsor mildert weniger stark ab).
    function openBusSponsoringAlternative(banden) {
        let fee = Math.round(6000 * leagueScaleFactor() / 500) * 500;
        if (game.money < fee) {
            // Letzte Eskalationsstufe: wenn selbst der günstigere Bandensponsor nicht drin
            // ist, bleibt nur noch der Spott der eigenen Fans - eine echte Sackgasse statt
            // eines beliebig oft wiederholbaren Versuchs.
            showToast(`Nicht genug Geld! Benötigt: ${formatVal(fee)}`, 'error');
            addInboxMessage('vertrag', '😏 Fans spotten über den Bus', `„Nicht mal für einen simplen Bus-Sponsor reicht das Geld?“ - manche Fans machen sich im Netz über die klammen Vereinsfinanzen lustig.`, 'screen-finances');
            return;
        }
        playSound('goal');
        game.money -= fee;
        game.busSponsorActive = true;
        game.busSponsorViaBanden = true;
        addInboxMessage('vertrag', '🚌 Bandensponsor übernimmt Bus-Sponsoring!', `Da ${game.sponsor.name} abgelehnt hat, brandet stattdessen ${banden.name} für ${formatVal(fee)} den Mannschaftsbus - etwas bescheidener, aber immerhin eine spürbare Verbesserung.`, 'screen-finances');
        showToast(`🚌 ${banden.name} sponsert jetzt den Bus!`, 'success');
        renderSponsorsView();
        updateUI();
    }

    function openBusSponsoringNegotiation() {
        if (game.sponsor.base <= 500) { showToast('Dafür brauchst du erst einen aktiven Hauptsponsor!', 'error'); return; }
        if (game.busSponsorActive) { showToast('Der Bus ist bereits gesponsert!', 'error'); return; }
        if (game.busSponsorPermanentlyRejected) {
            // Alternative nach dauerhafter Ablehnung: statt komplett gesperrt zu bleiben,
            // kann stattdessen ein kleinerer, aktiver Bandensponsor einspringen - günstiger,
            // aber auch mit geringerem Effekt als ein waschechtes Hauptsponsor-Sponsoring.
            let activeBanden = bandenSponsors.find(b => b.active);
            if (activeBanden) {
                openBusSponsoringAlternative(activeBanden);
                return;
            }
            showToast(`${game.sponsor.name} will für diesen Vertrag nichts mehr vom Bus-Sponsoring wissen. Aktiviere einen Bandensponsor als günstigere Alternative!`, 'error');
            return;
        }
        let suggestedFee = Math.round(15000 * leagueScaleFactor() / 500) * 500;
        busSponsorNegoAmount = suggestedFee;
        busSponsorNegoStep = Math.max(500, Math.round(suggestedFee * 0.05 / 500) * 500);
        renderBusSponsorNegotiation();
        document.getElementById('bus-sponsor-nego-overlay').classList.add('show');
    }
    function busSponsorNegoAdjustStep(mult) {
        busSponsorNegoStep = Math.max(500, Math.round(busSponsorNegoStep * mult / 500) * 500);
        renderBusSponsorNegotiation();
    }
    function busSponsorNegoAdjustAmount(dir) {
        busSponsorNegoAmount = Math.max(0, busSponsorNegoAmount + dir * busSponsorNegoStep);
        renderBusSponsorNegotiation();
    }
    function renderBusSponsorNegotiation() {
        document.getElementById('bus-nego-sponsor-name').innerText = game.sponsor.name;
        document.getElementById('bus-nego-step-value').innerText = formatVal(busSponsorNegoStep);
        document.getElementById('bus-nego-amount-value').innerText = formatVal(busSponsorNegoAmount);
    }
    function confirmBusSponsorNegotiation() {
        if (game.money < busSponsorNegoAmount) { showToast('Nicht genug Geld für dieses Angebot!', 'error'); return; }
        // Erfolgschance sinkt, je niedriger man gegenüber dem "fairen" Vorschlag pokert -
        // symmetrisch zur bestehenden Transfer-Verhandlungslogik.
        let suggestedFee = Math.round(15000 * leagueScaleFactor() / 500) * 500;
        let ratio = busSponsorNegoAmount / suggestedFee;
        let successChance = Math.max(0.15, Math.min(0.95, 0.5 + (ratio - 1) * 1.2 + (game.boardSat / 100) * 0.2));
        playSound('click');
        if (Math.random() < successChance) {
            game.money -= busSponsorNegoAmount;
            game.busSponsorActive = true;
            document.getElementById('bus-sponsor-nego-overlay').classList.remove('show');
            addInboxMessage('vertrag', '🚌 Bus-Sponsoring erfolgreich verhandelt!', `${game.sponsor.name} brandet für ${formatVal(busSponsorNegoAmount)} ab sofort den Mannschaftsbus - mildert den Bus-Nachteil bei Auswärtsfahrten spürbar ab.`, 'screen-finances');
            showToast('🚌 Bus-Sponsoring erfolgreich verhandelt!', 'success');
            renderSponsorsView();
            updateUI();
        } else if (ratio < 0.6) {
            // Ein deutlich zu niedriges Angebot verärgert den Sponsor dauerhaft - anders als
            // bei einem normalen Fehlschlag ("nochmal versuchen") ist das Thema für die
            // Laufzeit dieses Sponsoren-Vertrags endgültig vom Tisch. Eine echte Fehl-
            // entscheidung statt eines risikofreien Wiederholungsversuchs.
            game.busSponsorPermanentlyRejected = true;
            document.getElementById('bus-sponsor-nego-overlay').classList.remove('show');
            addInboxMessage('vertrag', '🚌 Bus-Sponsoring endgültig abgelehnt!', `${game.sponsor.name} fühlt sich vom viel zu niedrigen Angebot brüskiert und will für die Laufzeit dieses Vertrags nichts mehr vom Bus-Sponsoring wissen.`, 'screen-finances');
            showToast(`❌ ${game.sponsor.name} lehnt dauerhaft ab - das Angebot war deutlich zu niedrig!`, 'error');
            renderSponsorsView();
        } else {
            showToast(`📉 ${game.sponsor.name} lehnt dieses Angebot ab - versuch es mit einem höheren Betrag.`, 'error');
        }
    }

    function tickContractDurations() {
        if (typeof game.sponsor.duration !== 'number') game.sponsor.duration = 34;
        game.sponsor.duration--;
        if (game.sponsor.duration <= 0) {
            game.sponsor = { name: 'Kein Hauptsponsor', base: 500, winBonus: 200, cupBonus: 0, promotionBonus: 0, duration: 999, tier: 'kurz', themedBonusType: null, themedBonusAmount: 0, category: null };
            showToast('📉 Der Hauptsponsoren-Vertrag ist ausgelaufen! Verhandle bald einen neuen.', 'error');
            addInboxMessage('vertrag', 'Hauptsponsor-Vertrag ausgelaufen', 'Verhandle bald einen neuen Hauptsponsor-Vertrag.', 'screen-sponsors');
            // Bus-Sponsoring hing am Hauptsponsor-Vertrag - läuft mit diesem automatisch aus.
            if (game.busSponsorActive) {
                game.busSponsorActive = false;
                addInboxMessage('vertrag', '🚌 Bus-Sponsoring ausgelaufen', 'Mit dem Ende des Hauptsponsoren-Vertrags ist auch die Bus-Brandmarkung ausgelaufen - bei einem neuen Sponsor lässt sich das erneut verhandeln.', 'screen-finances');
            }
            game.busSponsorPermanentlyRejected = false; game.busSponsorViaBanden = false; // neuer Sponsor, neue Chance
        }

        if (game.kitSupplier.income > 0) {
            if (typeof game.kitSupplier.duration !== 'number') game.kitSupplier.duration = 34;
            game.kitSupplier.duration--;
            if (game.kitSupplier.duration <= 0) {
                game.kitSupplier = { name: 'Keiner', income: 0, duration: 0 };
                showToast('📉 Der Ausrüstervertrag ist ausgelaufen!', 'error');
            }
        }

        if (game.sleeveSponsor && game.sleeveSponsor.income > 0) {
            if (typeof game.sleeveSponsor.duration !== 'number') game.sleeveSponsor.duration = 34;
            game.sleeveSponsor.duration--;
            if (game.sleeveSponsor.duration <= 0) {
                game.sleeveSponsor = { name: 'Keiner', income: 0, duration: 0 };
                showToast('📉 Der Ärmelsponsoren-Vertrag ist ausgelaufen!', 'error');
            }
        }

        bandenSponsors.forEach(b => {
            if (typeof b.duration !== 'number') b.duration = 34;
            b.duration--;
        });
        let expired = bandenSponsors.filter(b => b.duration <= 0);
        if (expired.length > 0) {
            bandenSponsors = bandenSponsors.filter(b => b.duration > 0);
            showToast(`📉 ${expired.length} Bandenwerbe-Vertrag(e) ausgelaufen - Plätze wieder frei!`, 'error');
        }
    }

    // ---------- RENDER ----------
    // ==========================================
    // SPONSOREN: SPONSOREN-ZUFRIEDENHEIT & AKTIVIERUNGS-EVENTS (NEU)
    // ==========================================

    // 1. Sponsoren-Zufriedenheit/Treue: sinkt bei schlechten Ergebnissen, steigt bei guten -
    // fällt sie zu tief, drohen reduzierte Zahlungen oder eine vorzeitige Kündigung.
    function tickSponsorLoyalty(matchResult) {
        if (!game.sponsor || game.sponsor.name === 'Kein Hauptsponsor') return;
        if (typeof game.sponsor.loyalty !== 'number') game.sponsor.loyalty = 65;
        if (matchResult === 'win') game.sponsor.loyalty = Math.min(100, game.sponsor.loyalty + 2);
        else if (matchResult === 'loss') game.sponsor.loyalty = Math.max(0, game.sponsor.loyalty - 3);
        if (game.sponsor.loyalty <= 15 && Math.random() < 0.1) {
            let sponsorName = game.sponsor.name;
            addInboxMessage('vertrag', `📉 ${sponsorName} droht mit Ausstieg!`, `Die sportliche Talfahrt verärgert ${sponsorName} zunehmend - ohne Besserung oder eine Aktivierungs-Geste droht eine vorzeitige Vertragsauflösung.`, 'screen-sponsors');
        }
        if (game.sponsor.loyalty <= 5 && Math.random() < 0.05) {
            addInboxMessage('vertrag', `❌ ${game.sponsor.name} steigt aus!`, `Die Geduld von ${game.sponsor.name} ist am Ende - der Sponsorenvertrag wird fristlos aufgelöst.`, 'screen-sponsors');
            game.sponsor = { name: 'Kein Hauptsponsor', base: 500, winBonus: 200, cupBonus: 0, promotionBonus: 0, duration: 999, tier: 'kurz', themedBonusType: null, themedBonusAmount: 0, category: null, loyalty: 65 };
        }
    }
    function getSponsorLoyaltyPaymentMultiplier() {
        if (!game.sponsor || typeof game.sponsor.loyalty !== 'number') return 1;
        if (game.sponsor.loyalty <= 20) return 0.7;
        if (game.sponsor.loyalty <= 40) return 0.9;
        return 1;
    }

    // 2. Exklusive Aktivierungs-Events: der Sponsor lädt gelegentlich zu einem besonderen
    // Werbe-Termin ein - Teilnahme bringt Geld & Loyalität, kostet aber etwas Spielerzeit/Fitness.
    function checkSponsorActivationEvent() {
        if (!game.sponsor || game.sponsor.name === 'Kein Hauptsponsor') return;
        if (game.sponsor.lastActivationMatchday && game.matchday - game.sponsor.lastActivationMatchday < 6) return;
        if (Math.random() > 0.06) return;
        game.pendingSponsorActivation = { sponsorName: game.sponsor.name, reward: Math.round(game.sponsor.base * 1.5) };
        addInboxMessage('vertrag', `📸 Aktivierungs-Event von ${game.sponsor.name}!`, `${game.sponsor.name} lädt zu einem exklusiven Werbedreh ein - nimm teil (Sponsoren-Screen), um Geld und Loyalität zu gewinnen!`, 'screen-sponsors');
    }
    function resolveSponsorActivationEvent(accept) {
        let ev = game.pendingSponsorActivation;
        if (!ev) return;
        if (accept) {
            game.money += ev.reward;
            game.sponsor.loyalty = Math.min(100, (game.sponsor.loyalty || 65) + 10);
            squad.forEach(p => { p.fitness = Math.max(50, p.fitness - 3); });
            showToast(`📸 Aktivierungs-Event mit ${ev.sponsorName} absolviert: +${formatVal(ev.reward)}!`, 'success');
        } else {
            game.sponsor.loyalty = Math.max(0, (game.sponsor.loyalty || 65) - 5);
            showToast('Aktivierungs-Event abgelehnt - der Sponsor ist etwas enttäuscht.', 'error');
        }
        game.sponsor.lastActivationMatchday = game.matchday;
        game.pendingSponsorActivation = null;
        renderSponsorsView();
        updateUI();
    }

    function categoryBadgeHtml(category, slot) {
        if (!category) return '';
        let conflict = getExclusivityConflict(category, slot);
        return conflict
            ? ` · <span style="color:var(--danger);">🏷️ ${category} ⚠️ Konflikt!</span>`
            : ` · <span style="color:#94a3b8;">🏷️ ${category}</span>`;
    }

    function renderOfferCard(o, kind, extraLine) {
        let acceptFn = { sponsor: 'acceptSponsorOffer', kit: 'acceptKitOffer', banden: 'acceptBandenOffer', sleeve: 'acceptSleeveOffer' }[kind];
        let negoFn = { sponsor: 'negotiateSponsorOffer', kit: 'negotiateKitOffer', banden: 'negotiateBandenOffer', sleeve: 'negotiateSleeveOffer' }[kind];
        let rejectFn = { sponsor: 'rejectSponsorOffer', kit: 'rejectKitOffer', banden: 'rejectBandenOffer', sleeve: 'rejectSleeveOffer' }[kind];
        return `
            <div class="box box-offer" style="margin-bottom:6px;">
                <strong style="color:var(--accent);">${o.name}</strong> <span class="badge-trait">${o.tierLabel} · ${o.sp} SpT</span><br>
                <span style="font-size:10px;">${extraLine}</span>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:6px;">
                    <button onclick="${acceptFn}(${o.id})" class="btn-action" style="font-size:9px;">Annehmen</button>
                    <button onclick="${negoFn}(${o.id})" class="btn-secondary" style="font-size:9px;" ${o.negotiationsUsed >= MAX_NEGOTIATIONS ? 'disabled' : ''}>Nachverhandeln (${MAX_NEGOTIATIONS - o.negotiationsUsed})</button>
                    <button onclick="${rejectFn}(${o.id})" class="btn-secondary" style="font-size:9px; color:var(--danger);">Ablehnen</button>
                </div>
            </div>`;
    }

    function renderSponsorsView() {
        document.getElementById('spons-curr-name').innerText = game.sponsor.name;
        document.getElementById('spons-curr-base').innerText = formatVal(game.sponsor.base);
        document.getElementById('spons-curr-win').innerText = formatVal(game.sponsor.winBonus);
        // Sponsoren-Zufriedenheit (NEU)
        let loyaltyBox = document.getElementById('sponsor-loyalty-box');
        if (loyaltyBox) {
            if (game.sponsor.name === 'Kein Hauptsponsor') { loyaltyBox.innerHTML = ''; }
            else {
                let loy = Math.round(game.sponsor.loyalty ?? 65);
                let color = loy >= 60 ? 'var(--primary)' : (loy >= 30 ? 'var(--accent)' : 'var(--danger)');
                loyaltyBox.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:10px;">Sponsoren-Zufriedenheit</span><strong style="color:${color};">${loy}/100</strong></div>
                    <div style="background:rgba(228,197,140,0.1); border-radius:4px; height:8px; overflow:hidden;"><div style="width:${loy}%; height:100%; background:${color};"></div></div>`;
            }
        }
        let activationBox = document.getElementById('sponsor-activation-box');
        if (activationBox) {
            let ev = game.pendingSponsorActivation;
            activationBox.style.display = ev ? 'block' : 'none';
            if (ev) {
                activationBox.innerHTML = `<div class="panel-header" style="color:var(--accent);">📸 AKTIVIERUNGS-EVENT: ${ev.sponsorName}</div>
                    <div class="box" style="font-size:10px;">Exklusiver Werbedreh - Teilnahme bringt ${formatVal(ev.reward)} und mehr Loyalität, kostet aber etwas Fitness.</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button onclick="resolveSponsorActivationEvent(true)" class="btn-action">✅ Teilnehmen</button>
                        <button onclick="resolveSponsorActivationEvent(false)" class="btn-secondary">❌ Ablehnen</button>
                    </div>`;
            }
        }
        let sponsExtra = document.getElementById('spons-curr-extra');
        if (sponsExtra) {
            let themedText = game.sponsor.themedBonusType === 'cleanSheet' ? ` · 🧤 ${formatVal(game.sponsor.themedBonusAmount)} pro Zu-Null-Spiel` : (game.sponsor.themedBonusType === 'attendance' ? ` · 🎟️ ${game.sponsor.themedBonusAmount}€ pro Zuschauer` : '');
            sponsExtra.innerText = `Pokalsieg-Bonus: ${formatVal(game.sponsor.cupBonus || 0)} · Aufstiegsbonus: ${formatVal(game.sponsor.promotionBonus || 0)} · Restlaufzeit: ${game.sponsor.duration || 0} Spieltage${themedText}`;
        }

        document.getElementById('kit-supplier-name').innerText = game.kitSupplier.name;
        document.getElementById('kit-supplier-income').innerText = formatVal(game.kitSupplier.income);
        let kitExtra = document.getElementById('kit-supplier-extra');
        if (kitExtra) kitExtra.innerText = game.kitSupplier.income > 0 ? `Restlaufzeit: ${game.kitSupplier.duration || 0} Spieltage` : '';

        let sleeveNameEl = document.getElementById('sleeve-supplier-name');
        if (sleeveNameEl) sleeveNameEl.innerText = game.sleeveSponsor?.name || 'Keiner';
        let sleeveIncomeEl = document.getElementById('sleeve-supplier-income');
        if (sleeveIncomeEl) sleeveIncomeEl.innerText = formatVal(game.sleeveSponsor?.income || 0);
        let sleeveExtra = document.getElementById('sleeve-supplier-extra');
        if (sleeveExtra) sleeveExtra.innerText = (game.sleeveSponsor?.income || 0) > 0 ? `Restlaufzeit: ${game.sleeveSponsor.duration || 0} Spieltage · zahlt bei jedem Spiel (Heim & Auswärts)` : 'Kein Ärmelsponsor - zahlt bei jedem Spiel, Heim & Auswärts.';

        let offersList = document.getElementById('sponsors-offers-list');
        offersList.innerHTML = sponsorOffers.length === 0
            ? '<div class="box" style="font-size:10px; color:#64748b;">Aktuell keine neuen Hauptsponsor-Angebote. Schau nach ein paar Spieltagen wieder vorbei.</div>'
            : sponsorOffers.map(o => renderOfferCard(o, 'sponsor', `Sockel: ${formatVal(o.base)}/SpT · Siegprämie: ${formatVal(o.winBonus)} · Pokalsieg: ${formatVal(o.cupBonus)} · Aufstieg: ${formatVal(o.promotionBonus)}${o.signOn > 0 ? ` · Handgeld: ${formatVal(o.signOn)}` : ''}${o.themedBonusType === 'cleanSheet' ? ` · 🧤 ${formatVal(o.themedBonusAmount)} pro Zu-Null-Spiel` : ''}${o.themedBonusType === 'attendance' ? ` · 🎟️ ${o.themedBonusAmount}€ pro Zuschauer` : ''}${categoryBadgeHtml(o.category, 'sponsor')}`)).join('');

        let kitOffersList = document.getElementById('kit-offers-list');
        kitOffersList.innerHTML = kitSupplierOffers.length === 0
            ? '<div class="box" style="font-size:10px; color:#64748b;">Aktuell keine neuen Ausrüster-Angebote. Schau nach ein paar Spieltagen wieder vorbei.</div>'
            : kitSupplierOffers.map(o => renderOfferCard(o, 'kit', `Handgeld: ${formatVal(o.signOn)} · Laufend: ${formatVal(o.income)}/SpT${categoryBadgeHtml(o.category, 'kit')}`)).join('');

        let sleeveOffersList = document.getElementById('sleeve-offers-list');
        if (sleeveOffersList) {
            sleeveOffersList.innerHTML = sleeveSponsorOffers.length === 0
                ? '<div class="box" style="font-size:10px; color:#64748b;">Aktuell keine neuen Ärmelsponsor-Angebote.</div>'
                : sleeveSponsorOffers.map(o => renderOfferCard(o, 'sleeve', `Handgeld: ${formatVal(o.signOn)} · Laufend: ${formatVal(o.income)}/Spiel (Heim & Auswärts)${categoryBadgeHtml(o.category, 'sleeve')}`)).join('');
        }

        let bandenOffersList = document.getElementById('banden-offers-list');
        bandenOffersList.innerHTML = bandenOffers.length === 0
            ? '<div class="box" style="font-size:10px; color:#64748b;">Aktuell keine neuen Bandenwerbe-Angebote.</div>'
            : bandenOffers.map(o => renderOfferCard(o, 'banden', `${o.areaName || 'Stadion'} · ${o.type} · ${formatVal(o.income)}/Heimspiel${categoryBadgeHtml(o.category, 'banden')}`)).join('');

        // Bandenplätze nach Stadionbereich gegliedert: zeigt pro Block die belegten und
        // freien Werbeflächen, damit erkennbar ist, wo noch Potenzial liegt.
        migrateLegacyBandenSponsors();
        let bList = document.getElementById('banden-slots-list');
        bList.innerHTML = getBandenAreaKeys()
            .sort((a, b) => (BANDEN_AREA_META[b].visibility - BANDEN_AREA_META[a].visibility))
            .map(key => {
                let slots = getBandenSlotsForArea(key);
                let occupants = getBandenSponsorsInArea(key);
                let meta = BANDEN_AREA_META[key];
                let areaIncome = occupants.filter(o => o.active).reduce((s, o) => s + o.income, 0);
                let rows = occupants.map(b =>
                    `<div class="player-row" style="font-size:9px;"><span>${b.name} (${b.type}) — ${formatVal(b.income)}/Heimspiel · noch ${b.duration ?? '?'} SpT</span>`
                    + `<button onclick="toggleBande(${b.id})" class="btn-secondary" style="width:auto; font-size:8px;">${b.active ? 'Aktiv ✓' : 'Inaktiv'}</button></div>`).join('');
                let freeCount = slots - occupants.length;
                let freeNote = freeCount > 0
                    ? `<div style="font-size:9px; color:var(--text-muted); padding:2px 0;">${freeCount} freie${freeCount === 1 ? 'r' : ''} Bandenplatz${freeCount === 1 ? '' : 'e'}</div>`
                    : '';
                return `<div class="box" style="margin-bottom:5px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; font-weight:800;">
                            <span>${getBandenAreaName(key)} <span style="color:var(--text-muted); font-weight:400;">${meta.note ? '· ' + meta.note : ''}</span></span>
                            <span style="color:${occupants.length === slots ? 'var(--primary)' : 'var(--accent)'};">${occupants.length}/${slots}</span>
                        </div>
                        ${areaIncome > 0 ? `<div style="font-size:9px; color:var(--teal);">${formatVal(areaIncome)}/Heimspiel</div>` : ''}
                        ${rows}${freeNote}
                    </div>`;
            }).join('');

        let slotsNote = document.getElementById('banden-slots-note');
        if (slotsNote) {
            let total = getTotalBandenSlots();
            slotsNote.innerText = bandenSponsors.length >= total
                ? `Alle ${total} Bandenplätze im Stadion sind vergeben - weitere entstehen durch Stadionausbau.`
                : `${bandenSponsors.length}/${total} Bandenplätze belegt. Jeder Stadionausbau schafft zusätzliche Werbeflächen.`;
        }

        // Bandensponsor-Portfolio-Übersicht: kompakte Gesamtschau statt nur der Einzelliste.
        let portfolioBox = document.getElementById('banden-portfolio-summary');
        if (portfolioBox) {
            let activeCount = bandenSponsors.filter(b => b.active).length;
            let totalIncomePerHome = bandenSponsors.filter(b => b.active).reduce((s, b) => s + b.income, 0);
            let areasUsed = new Set(bandenSponsors.filter(b => b.active).map(b => b.area)).size;
            portfolioBox.innerHTML = activeCount === 0
                ? '<div class="box" style="font-size:10px; color:#94a3b8;">Noch keine aktiven Bandensponsoren.</div>'
                : `<div class="box" style="font-size:10px;"><strong style="color:var(--teal);">📢 ${activeCount} aktive Banden in ${areasUsed} Stadionbereichen</strong> · Gesamt: ${formatVal(totalIncomePerHome)}/Heimspiel</div>`;
        }
    }

