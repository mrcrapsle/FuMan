
// ==========================================
// SPIELZUSTAND & DATENMODELLE
// ==========================================
    // Versionskennung mit Datum (NEU, auf Wunsch): wird bei jeder Code-Änderung
    // aktualisiert, damit immer klar erkennbar ist, welcher Stand gerade läuft.
    const GAME_VERSION = { number: '1.9', date: '14.09.2026' };
    // ==========================================
    // SPIELZUSTAND & ERWEITERTE DATENMODELLE
    // ==========================================
    let game = {
        clubName: "1.FC Moritz Leipzig",
        season: 1,
        money: 150000,
        transferBudget: 100000,
        wageBudget: 15000,
        fans: 75,
        matchday: 1,
        viewingMatchday: 1,
        boardSat: 80,
        sackWarningIssued: false,
        lowBoardSatStreak: 0,
        leagueLevel: 5,
        formation: '4-4-2',
        tacticStyle: 'ausgeglichen',
        tackleHardness: 'normal',
        teamTraining: 'ausgeglichen',
        weeklyTrainingPlan: { mo: 'ausgeglichen', di: 'ausgeglichen', mi: 'ausgeglichen', do: 'ausgeglichen', fr: 'ausgeglichen', sa: 'erholung', so: 'frei' },
        preCampWeeklyPlan: null,
        customWeeklyPlanTemplates: [],
        trainingIntensity: 'normal',
        injuryPreventionProgram: false,
        equipmentLevel: 0,
        trainingHistory: [],
        lastVideoAnalysisMatchday: null,
        lastDoubleTrainingMatchday: null,
        lastTechContestMatchday: null,
        lastAthleticTestSeason: null,
        lastBondingEventMatchday: null,
        youthHospitants: [],
        youthCapacityBonus: 0,
        youthNationalCallups: 0,
        pendingYouthPoach: null,
        mentalTrainingLevel: 0,
        videoAnalysisBoostActive: false,
        doubleTrainingBoostActive: false,
        dfbGracePeriod: null,
        seasonReviewArchive: [],
        pairChemistry: {},
        coTrainerTrust: 66,
        coTrainerHistory: { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 },
        lastTacticWasCoTrainerSuggestion: false,
        trainingPlaysToday: 0,
        lastTrainingMatchday: 1,
        bestPenaltyScore: 0,
        bestCrossingScore: 0,
        bestGoalkeeperScore: 0,
        loanDebt: 0,
        forcedGhostGame: false,
        riotCount: 0,
        negativeStreak: 0,
        transferEmbargo: false,
        lastInsolvencyPenaltyAt: 0,
        ticketPrices: { steh: 12, sitz: 24, vip: 80 },
        stewards: 100,
        youthAcademyLvl: 1,
        sponsor: { name: 'Stadtwerke & Regionalbank', base: 3000, winBonus: 1500, duration: 34, tier: 'standard', cupBonus: 2000, promotionBonus: 20000, themedBonusType: null, themedBonusAmount: 0, category: 'Finanzen' },
        kitSupplier: { name: 'Keiner', income: 0, duration: 0 },
        sleeveSponsor: { name: 'Keiner', income: 0, duration: 0 },
        // Zweite Mannschaft: eigenständiger, parallel hochspielbarer Klub, der ganz unten
        // in der niedrigsten Liga startet (siehe secondteam.js). isActive statt "active",
        // um Namenskollisionen mit anderen Modulen zu vermeiden.
        secondTeam: { isActive: false, name: '1.FC Moritz Leipzig II', leagueLevel: 5, formation: '4-4-2', tacticStyle: 'ausgeglichen', trainingFocus: 'ausgeglichen' },
        permanentRivalName: null,
        rivalHistoryArchive: [],
        winterWindowActive: false,
        winterWindowDeadline: 0,
        winterWindowUsedThisSeason: false,
        travelMode: 'flugzeug', // 'flugzeug' (schnell, teurer, weniger Ermüdung) | 'bus' (günstig, mehr Ermüdung)
        busSponsorActive: false,
        busSponsorPermanentlyRejected: false,
        busSponsorViaBanden: false,
        jubileePatternUnlocked: false,
        // Die ersten 3 Spieltage einer neuen Karriere gelten testweise als Hochrisiko-
        // Derbys (Ausschreitungsrisiko möglich), unabhängig vom tatsächlichen Gegner.
        forceDerbyMatchdays: [1, 2, 3],
        selfTestHistory: [],
        unlockedSynergies: [],
        interviewHistory: [],
        managerMediaImage: 50,
        mediaImageHistory: [],
        notablePastPlayers: [],
        clubRecords: {
            biggestWin: null, biggestLoss: null, mostGoalsInMatch: null,
            currentUnbeatenStreak: 0, longestUnbeatenStreak: 0
            // Zuschauerrekord bewusst NICHT hier (Duplikat vermieden) - siehe game.recordAttendance,
            // das bereits Meilenstein-Interviews und "signifikanter Sprung"-Logik mitbringt.
        },
        playerOfMonthHistory: [],
        potmGoalSnapshot: {},
        headToHeadRecords: {},
        seasonPointsHistory: [],
        achievements: [],
        agentRelationships: {},
        pendingSponsorActivation: null,
        teamInstructions: { gegenpressing: false, tiefStehen: false, hoheAV: false },
        pendingNamingCeremony: null,
        stadiumConstructionQueue: [],
        sponsorEarningsHistory: {},
        sponsorEarningsByCategory: {},
        lastHomeAttendance: 0,
        // Steuern & Abgaben (siehe applyMatchdayFinances/finances.js): letzter Spieltag
        // getrennt ausgewiesen, dazu die laufende Saisonsumme für die GuV-Anzeige.
        lastAutoSaveMatchday: 0,
        // Buchungsjournal je Spieltag (siehe applyMatchdayFinances) - Grundlage der
        // Aufschlüsselung im Finanz-Screen.
        financeLedger: [],
        kontoauszug: [],
        // Trainingsstab-Automatik (Premium): laeuft eine begrenzte Zahl von Spieltagen und
        // startet selbststaendig Foerderprogramme.
        trainingAutopilotMatchdays: 0,
        trainingAutopilotLog: [],
        // Entwicklungsbericht der Reserve: Staerke-Momentaufnahme zum Saisonstart.
        secondTeamStrengthSnapshot: null,
        tvMoneyPaidThisSeason: 0,
        // Buero-Ereignisse: wer gerade im Besucherstuhl wartet, plus die Entscheidungshistorie.
        // Entlassung ausgesprochen, Bestaetigung steht noch aus - solange ruht das Spiel.
        sackPending: false,
        officeEvent: null,
        officeEventHistory: [],
        pitchDamaged: false,
        lastMatchdayTax: 0,
        lastMatchdayAdvisorFee: 0,
        seasonTaxPaid: 0,
        attendanceHistory: [],
        fanProtestActive: false,
        clubCrestAwayColor: '#3fb6ff',
        activeUltimatumPlayerId: null,
        ultimatumDeadlineMatchday: null,
        ultimatumReminderSent: false,
        ultimatumPressLeakOccurred: false,
        secondChanceUsedSeason: null,
        ultimatumHistory: { renewed: 0, sold: 0, ignored: 0, agentMediated: 0, agentPreEmpted: 0 },
        lastShooterOrder: [],
        // Dauerhaftes Fan-Fundament: steigt permanent nach Aufstiegen/Titeln (siehe
        // boostFanBaseFloor() in match.js) und ersetzt die bisher feste Untergrenze von 10 -
        // Erfolge sorgen so langfristig für eine höhere Stammfan-Basis statt nur einem
        // vorübergehenden Stimmungs-Boost.
        recordAttendance: 0,
        skillTrainingQueue: [],
        sellOnClauses: [],
        premiumPoints: 0,
        xpDoublerMatchdaysLeft: 0,
        injuryShieldMatchdaysLeft: 0,
        ticketIncomeBoostNextMatch: false,
        nextScoutGuaranteed: false,
        sponsorBoostMatchdaysLeft: 0,
        merchDoubleNextMatch: false,
        weatherGuaranteeNextMatch: false,
        luckyCharmNextMatch: false,
        securityCalmNextMatch: false,
        recordAttendanceSeason: 0,
        fanBaseFloor: 10,
        clubCrestColor: '#f5b942',
        clubCrestSymbol: 'FCM',
        clubCrestPattern: 'keins',
        loyaltyDeclineCount: 0,
        legendStatus: false,
        // Auswärts-/Heimbilanz getrennt getrackt (siehe recordHomeAwayResult() in match.js)
        homeRecord: { wins: 0, draws: 0, losses: 0 },
        awayRecord: { wins: 0, draws: 0, losses: 0 },
        // Trainingslager-Effekt: zeitlich begrenzter Bonus statt nur einmaligem Sofort-Effekt
        trainingCampBuff: { active: false, matchesLeft: 0, injuryReduction: 0, strengthBonus: 0, campName: '' },
        boardTargets: { minPlace: 6, cupTarget: "2. Runde", minCash: 30000 },
        inCup: true,
        // Startplatz im DFB-Pokal, erspielt ueber den Landespokal der Vorsaison.
        dfbPokalViaLandespokal: false,
        inEurope: false,
        captainId: null,
        penaltyTakerId: null,
        freeKickTakerId: null,
        cornerTakerId: null,
        trophies: []
    };

    let managerRPG = {
        level: 1,
        xp: 0,
        maxXp: 1000,
        points: 0,
        perks: {
            negotiator: false,
            tactician: false,
            fitnessGuru: false,
            tycoon: false,
            motivator: false,
            playerCare: false,
            crisisProof: false,
            calmPresence: false,
            secondChance: false,
            ironNerves: false
        }
    };

    let activeLiveShout = 'standard';
    let globalScoutResults = [];
    let scoutingNetwork = {
        scouts: [
            { id: 'scout_sa', name: 'Carlos Medeiros', region: 'suedamerika', level: 1, skill: 35, hired: true },
            { id: 'scout_af', name: 'Amara Diallo', region: 'afrika', level: 0, skill: 0, hired: false },
            { id: 'scout_we', name: 'James Whitfield', region: 'westeuropa', level: 0, skill: 0, hired: false },
            { id: 'scout_oe', name: 'Nikolai Petrov', region: 'osteuropa', level: 0, skill: 0, hired: false }
        ],
        activeMissions: [],
        watchlist: [],
        talentDatabase: []
    };
    let incomingOffers = [];
    let sponsorOffers = [];
    let mediaRights = { currentDeal: null, dealOffers: [] };
    let kitSupplierOffers = [];
    let bandenOffers = [];
    let sleeveSponsorOffers = [];
    let activeLoans = [];
    let activeBet = null;
    let betHistory = [];

    let holdingCompany = {
        money: 50000,
        valuation: 125000,
        b2bContracts: [
            { id: 'b2b1', club: "Real Madrid", item: "Trikots", amount: 1000, reqMat: 'cotton', reqQty: 1000, payout: 65000, done: false },
            { id: 'b2b2', club: "FC Bayern", item: "Fan-Schals", amount: 2000, reqMat: 'wool', reqQty: 1200, payout: 38000, done: false },
            { id: 'b2b3', club: "FC Liverpool", item: "Spielbälle", amount: 800, reqMat: 'leather', reqQty: 960, payout: 48000, done: false }
        ]
    };

    let rawMaterials = {
        cotton: { name: "Baumwolle & Synthetik", stock: 600, basePrice: 4.0, currentPrice: 4.10, minPrice: 2.20, maxPrice: 7.50, unit: "kg", delta: 0.10 },
        wool: { name: "Wolle & Garn", stock: 400, basePrice: 3.0, currentPrice: 2.90, minPrice: 1.80, maxPrice: 5.50, unit: "kg", delta: -0.10 },
        leather: { name: "Leder & Kautschuk", stock: 250, basePrice: 6.0, currentPrice: 6.30, minPrice: 3.50, maxPrice: 10.50, unit: "kg", delta: 0.30 },
        plastic: { name: "Kunststoff & Pigmente", stock: 500, basePrice: 2.0, currentPrice: 1.95, minPrice: 1.10, maxPrice: 4.20, unit: "kg", delta: -0.05 },
        warehouseLevel: 1,
        activeMarketEvent: "Stabile Weltmärkte zu Saisonbeginn.",
        competitorFirms: [
            { name: "TexPro Industries", strength: 60, lastAction: null },
            { name: "Nordwoll Handels-KG", strength: 55, lastAction: null },
            { name: "LederWerk Süd", strength: 65, lastAction: null }
        ],
        acquisitionOffers: [],
        get capacity() { return (this.warehouseLevel || 1) * 2000; },
        get totalStock() { return (this.cotton?.stock||0) + (this.wool?.stock||0) + (this.leather?.stock||0) + (this.plastic?.stock||0); }
    };

    // Eine eigene Fabrik ist eine echte Industrie-Investition, keine Nebenausgabe: die alten
    // 40.000-75.000 € entsprachen dem Preis eines mittelmäßigen Spielers. Die Beträge sind
    // jetzt so gesetzt, dass der Einstieg über das Holding-Konto finanziert werden muss
    // (B2B-Aufträge, Überweisung vom Verein) statt nebenbei aus der Portokasse zu fallen.
    let factories = {
        textile: { name: "Textilfabrik 'Stoff & Naht'", owned: false, lvl: 1, max: 5, cost: 600000, product: "Trikots", desc: "Produziert Trikots für Baumwoll-Rohstoffkosten" },
        knitting: { name: "Strickerei 'Maschenwerk'", owned: false, lvl: 1, max: 5, cost: 320000, product: "Schals", desc: "Fertigt Schals für Wolle-Rohstoffkosten" },
        leatherShop: { name: "Leder- & Ballmanufaktur", owned: false, lvl: 1, max: 5, cost: 420000, product: "Bälle", desc: "Näht Spielbälle für Leder-Rohstoffkosten" },
        plastics: { name: "Spritzguss- & Zubehörwerk", owned: false, lvl: 1, max: 5, cost: 250000, product: "Caps & Wimpel", desc: "Presst Caps & Wimpel für Kunststoff-Rohstoffkosten" }
    };
    let productionQueue = [];

    let merchandise = {
        jerseys: { name: "Heimtrikot 2026/27", stock: 250, cost: 14, price: 65, optimalPrice: 65, popularity: 1.0, reqMat: 'cotton', reqQty: 1.0, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        scarves: { name: "Fan-Schal 'Tradition'", stock: 500, cost: 4, price: 18, optimalPrice: 18, popularity: 1.2, reqMat: 'wool', reqQty: 0.6, factory: 'knitting', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        caps: { name: "Snapback Cap", stock: 300, cost: 5, price: 22, optimalPrice: 22, popularity: 0.8, reqMat: 'plastic', reqQty: 0.5, factory: 'plastics', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        balls: { name: "Offizieller Spielball", stock: 150, cost: 9, price: 35, optimalPrice: 35, popularity: 0.45, reqMat: 'leather', reqQty: 1.2, factory: 'leatherShop', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        awayJersey: { name: "Auswärtstrikot 2026/27", stock: 180, cost: 14, price: 65, optimalPrice: 65, popularity: 0.55, reqMat: 'cotton', reqQty: 1.0, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        keeperJersey: { name: "Torwarttrikot", stock: 90, cost: 15, price: 69, optimalPrice: 69, popularity: 0.2, reqMat: 'cotton', reqQty: 1.0, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        trainingTop: { name: "Trainingsshirt", stock: 220, cost: 8, price: 34, optimalPrice: 34, popularity: 0.6, reqMat: 'cotton', reqQty: 0.7, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        hoodie: { name: "Kapuzenpulli mit Wappen", stock: 200, cost: 16, price: 55, optimalPrice: 55, popularity: 0.7, reqMat: 'cotton', reqQty: 1.3, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        babyBody: { name: "Baby-Body 'Nachwuchs'", stock: 120, cost: 5, price: 22, optimalPrice: 22, popularity: 0.35, reqMat: 'cotton', reqQty: 0.4, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        bathrobe: { name: "Bademantel", stock: 60, cost: 22, price: 79, optimalPrice: 79, popularity: 0.15, reqMat: 'cotton', reqQty: 1.8, factory: 'textile', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        socks: { name: "Stutzen-Set", stock: 300, cost: 3, price: 14, optimalPrice: 14, popularity: 0.75, reqMat: 'wool', reqQty: 0.4, factory: 'knitting', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        beanie: { name: "Wintermütze", stock: 240, cost: 5, price: 19, optimalPrice: 19, popularity: 0.8, reqMat: 'wool', reqQty: 0.5, factory: 'knitting', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        gloves: { name: "Fan-Handschuhe", stock: 200, cost: 4, price: 16, optimalPrice: 16, popularity: 0.6, reqMat: 'wool', reqQty: 0.4, factory: 'knitting', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        blanket: { name: "Stadion-Decke", stock: 140, cost: 11, price: 39, optimalPrice: 39, popularity: 0.4, reqMat: 'wool', reqQty: 1.4, factory: 'knitting', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        scarfAway: { name: "Auswärts-Schal", stock: 260, cost: 4, price: 18, optimalPrice: 18, popularity: 0.7, reqMat: 'wool', reqQty: 0.6, factory: 'knitting', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        wallet: { name: "Leder-Geldbörse", stock: 120, cost: 8, price: 29, optimalPrice: 29, popularity: 0.35, reqMat: 'leather', reqQty: 0.5, factory: 'leatherShop', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        keychain: { name: "Schlüsselanhänger", stock: 500, cost: 1, price: 8, optimalPrice: 8, popularity: 1.1, reqMat: 'leather', reqQty: 0.1, factory: 'leatherShop', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        miniBall: { name: "Mini-Ball für Kinder", stock: 200, cost: 4, price: 15, optimalPrice: 15, popularity: 0.65, reqMat: 'leather', reqQty: 0.4, factory: 'leatherShop', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        sportsBag: { name: "Sporttasche", stock: 110, cost: 18, price: 59, optimalPrice: 59, popularity: 0.3, reqMat: 'leather', reqQty: 1.5, factory: 'leatherShop', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        pennant: { name: "Wimpel 'Heimspiel'", stock: 400, cost: 2, price: 9, optimalPrice: 9, popularity: 0.9, reqMat: 'plastic', reqQty: 0.2, factory: 'plastics', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        mug: { name: "Vereins-Tasse", stock: 320, cost: 3, price: 13, optimalPrice: 13, popularity: 0.85, reqMat: 'plastic', reqQty: 0.4, factory: 'plastics', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        bottle: { name: "Trinkflasche", stock: 280, cost: 4, price: 16, optimalPrice: 16, popularity: 0.7, reqMat: 'plastic', reqQty: 0.5, factory: 'plastics', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        umbrella: { name: "Regenschirm", stock: 160, cost: 7, price: 25, optimalPrice: 25, popularity: 0.45, reqMat: 'plastic', reqQty: 0.8, factory: 'plastics', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } },
        phoneCase: { name: "Handyhülle mit Wappen", stock: 240, cost: 4, price: 18, optimalPrice: 18, popularity: 0.6, reqMat: 'plastic', reqQty: 0.3, factory: 'plastics', lastSales: { stadium: 0, city: 0, online: 0, total: 0, revenue: 0, missed: 0 } }
    };
    let merchExtras = {
        // Verkaufsverlauf je Spieltag - damit nachvollziehbar bleibt, was sich wann und in
        // welcher Menge verkauft hat (siehe simulateMerchSales/renderMerchSalesHistory).
        salesHistory: [],
        limitedEdition: null,
        seasonalCollection: { active: false, boostPercent: 0, expiresMatchday: null },
        jerseySalesByPlayer: {}
    };

    let stockMarket = {
        techCorp: { name: "Global TechCorp AG", price: 120, dividendRate: 0.04, owned: 0, volatility: 0.06, history: [120] },
        realEstate: { name: "Bundesliga Real Estate Fonds", price: 85, dividendRate: 0.06, owned: 0, volatility: 0.03, history: [85] },
        greenEnergy: { name: "Green Energy Windpark", price: 45, dividendRate: 0.05, owned: 0, volatility: 0.05, history: [45] },
        cryptoFund: { name: "Sports Crypto & Web3 ETF", price: 210, dividendRate: 0.02, owned: 0, volatility: 0.14, history: [210] },
        staatsanleihe: { name: "Sichere Staatsanleihe DE", price: 100, dividendRate: 0.02, owned: 0, volatility: 0.01, history: [100] },
        biotech: { name: "BioTech Longshot Fonds", price: 30, dividendRate: 0.00, owned: 0, volatility: 0.22, history: [30] }
    };
    let financeCentralState = {
        moneyHistory: [],
        fixedDeposit: null,
        expenseWarningLimit: 0,
        autoReserveActive: false,
        autoReservePercent: 10,
        reserveFund: 0,
        creditRating: 70,
        taxAdvisorHired: false,
        strategicInvestorTaken: false,
        limitOrders: [],
        savingsPlan: null,
        milestonesReached: []
    };

    let underworld = {
        pressure: 0,
        offenseCount: 0,
        activeSabotages: { pyroHotel: false, stealBanner: false, weedKiller: false, refBribe: false, bribeOpponent: false, doping: false },
        spyIntelActive: false,
        insiderBetActive: false
    };

    let stadium = {
        upgrades: {},
        name: null,
        namingRightsSponsor: null,
        namingRightsIncome: 0,
        totalInvested: 0,
        lastLeagueTvPayout: 0,
        seasonTvIncomeTotal: 0,
        blocks: {
            haupt: { name: "Nord-Unterrang", cap: 2000, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 500, cost: 8000000, expansions: 0 },
            hauptNord: { name: "Nord-Oberrang", cap: 1500, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 500, cost: 7000000, expansions: 0 },
            kurve: { name: "Südtribüne (Ultras)", cap: 3000, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 1000, cost: 6500000, expansions: 0 },
            suedOber: { name: "Süd-Oberrang", cap: 1500, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 500, cost: 7000000, expansions: 0 },
            gegen: { name: "Ost-Gegengerade", cap: 3000, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 1000, cost: 10500000, expansions: 0 },
            west: { name: "West-Haupttribüne", cap: 2000, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 500, cost: 9000000, expansions: 0 },
            vipLogen: { name: "VIP-Logen", cap: 50, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 25, cost: 4500000, expansions: 0 },
            gaeste: { name: "Gäste-Block", cap: 1500, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 500, cost: 4000000, expansions: 0 },
            familie: { name: "Familienblock", cap: 800, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 300, cost: 3500000, expansions: 0 },
            presse: { name: "Presse-Tribüne", cap: 200, foodLvl: 0, merchLvl: 0, toiletLvl: 0, addSeats: 100, cost: 3000000, expansions: 0 }
        },
        flutlicht: false, rasenheizung: false, videowalls: false, dach: false,
        get total() { return Object.values(this.blocks || {}).reduce((s, b) => s + (b.cap || 0), 0); },
        get vipTotal() { return this.blocks?.vipLogen?.cap || 50; }
    };

    let campusBuildings = {
        fankneipe: { name: "Fan-Kneipe 'Zur Nachspielzeit'", lvl: 0, max: 5, baseCost: 600000, desc: "+1.800 € Umsatz pro Heimspiel & steigert Ultra-Zufriedenheit" },
        megastore: { name: "Fanshop Megastore", lvl: 0, max: 5, baseCost: 2800000, desc: "+35 Basis-Kunden pro Woche für alle Fanartikel pro Stufe" },
        parkhaus: { name: "Parkhaus & Shuttle-Bahnhof", lvl: 0, max: 5, baseCost: 2500000, desc: "+1.500 € Parkgebühren & verbessert Stadionauslastung" },
        reha: { name: "Reha-Klinik & Physio-Zentrum", lvl: 0, max: 5, baseCost: 4500000, desc: "Verringert Verletzungszeiten und beschleunigt Regeneration" },
        internat: { name: "Jugendinternat & Schule", lvl: 0, max: 5, baseCost: 5500000, desc: "Erhöht Stärke und Potenzial neuer Nachwuchsspieler" },
        museum: { name: "Vereinsmuseum & Traditions-Pavillon", lvl: 0, max: 5, baseCost: 1800000, desc: "+2% Vorstands- und Fanvertrauen dauerhaft pro Stufe" },
        trainingground: { name: "Trainingsgelände mit Flutlicht", lvl: 0, max: 5, baseCost: 3200000, desc: "+1 permanenter Stärkebonus für die gesamte Mannschaft" },
        hotel: { name: "VIP-Tagungshotel", lvl: 0, max: 5, baseCost: 9000000, desc: "+5.000 € feste Einnahmen pro Heimspiel" },
        foodtrucks: { name: "Catering-Meile & Foodtruck-Garten", lvl: 0, max: 5, baseCost: 550000, desc: "+2.400 € Catering-Erlöse pro Heimspiel" },
        turnstiles: { name: "Modernes Einlass-System", lvl: 0, max: 5, baseCost: 900000, desc: "Senkt Betriebskosten & verhindert Schwarzmarkt-Verluste" },
        securityAcademy: { name: "Sicherheitsakademie", lvl: 0, max: 5, baseCost: 850000, desc: "Bildet eigene Ordner & Sicherheitskräfte aus - schaltet höhere Schulungsstufen und mehr Festanstellungs-Plätze frei" }
    };
    let securityWorkforce = {
        permanentStewards: 0,
        skillLevel: 1,
        lastTrainingMatchday: null
    };

    let staffMembers = {
        coTrainer: { name: "Co-Trainer", hired: false, wage: 800, cost: 6000, desc: "+2 Team-Stärke im Spiel & kann individuelles Spielertraining automatisch verteilen", task: "aus" },
        twTrainer: { name: "Torwarttrainer", hired: false, wage: 550, cost: 4500, desc: "+10% bessere Torwart-Paraden" },
        fitCoach: { name: "Athletik- & Konditionstrainer", hired: false, wage: 600, cost: 5000, desc: "-30% Fitnessverlust nach Spielen & kann Team-Trainingsschwerpunkt automatisch wählen", task: "aus" },
        physio: { name: "Chef-Physiotherapeut", hired: false, wage: 700, cost: 5500, desc: "Halbiert die Ausfallzeit von Verletzten" },
        scout: { name: "Chef-Scout", hired: false, wage: 750, cost: 6500, desc: "15% Rabatt auf alle Transfers" },
        sportDir: { name: "Sportdirektor", hired: false, wage: 1100, cost: 9000, desc: "-20% Handgeld bei Vertragsverlängerungen" },
        fanLiaison: { name: "Fanbeauftragter", hired: false, wage: 450, cost: 3500, desc: "+Fan-Zufriedenheit, weniger Ausschreitungsrisiko & kann Ticketpreise automatisch verwalten", task: "aus" },
        marketingDir: { name: "Marketing-Direktor", hired: false, wage: 900, cost: 7500, desc: "+60% Online-Merch-Absatz & +20% Sponsoring" },
        greenkeeper: { name: "Head-Greenkeeper", hired: false, wage: 400, cost: 3000, desc: "Perfekter Rasen (+2 Heimstärke)" },
        secChief: { name: "Sicherheitschef", hired: false, wage: 500, cost: 4000, desc: "Verhindert teure DFB-Verbandsstrafen" },
        fanshopManager: { name: "Fanshop-Manager", hired: false, wage: 650, cost: 5000, desc: "Übernimmt automatisch eine wählbare Aufgabe im Fanshop", task: "restock" },
        analyst: { name: "Chef-Analyst", hired: false, wage: 700, cost: 6000, desc: "Enthüllt vor jedem Spiel die gegnerische Spielweise, Form & den gefährlichsten Gegenspieler" },
        nutritionist: { name: "Ernährungsberater", hired: false, wage: 550, cost: 4500, desc: "Zusätzlicher Fitness-Erholungsbonus nach Spielen (stapelt mit Konditionstrainer)" },
        pressOfficer: { name: "Pressesprecher", hired: false, wage: 600, cost: 5000, desc: "Dämpft negative Medienwirkung bei schlechten Ergebnissen & Skandalen" },
        setPieceCoach: { name: "Standards-Spezialist", hired: false, wage: 650, cost: 5500, desc: "Verbessert Elfmeter-, Freistoß- und Eckballqualität der Mannschaft" }
    };
    // Eigener, deutlich kleinerer Trainerstab NUR für die zweite Mannschaft. Bisher lief die
    // Reserve komplett ohne Betreuung: kein Trainer, keine Physio, keine Nachwuchsarbeit -
    // der Kader veränderte sich zwischen zwei Saisons überhaupt nicht. Gehälter und
    // Ablösen liegen bewusst weit unter denen des Profistabs (Amateurbereich).
    let secondTeamStaff = {
        chefTrainer: { name: 'Reserve-Cheftrainer', hired: false, wage: 320, cost: 2800, icon: '🎯', desc: '+2 Teamstärke der zweiten Mannschaft in der Liga-Simulation.' },
        coTrainer: { name: 'Reserve-Co-Trainer', hired: false, wage: 220, cost: 2000, icon: '📋', desc: 'Stellt die Reserve vor jedem Spieltag automatisch bestmöglich auf.' },
        physio: { name: 'Reserve-Physiotherapeut', hired: false, wage: 240, cost: 2200, icon: '🩹', desc: 'Die Reserve erholt sich nach jedem Spieltag deutlich besser (Fitness).' },
        talentScout: { name: 'Amateur-Talentspäher', hired: false, wage: 280, cost: 2500, icon: '🔍', desc: 'Deutlich stärkeres Angebot auf dem Amateur-Transfermarkt.' },
        nachwuchsKoordinator: { name: 'Nachwuchs-Koordinator', hired: false, wage: 300, cost: 2600, icon: '🌱', desc: 'Reserve-Spieler bis 23 Jahre entwickeln sich im Saisonverlauf weiter.' }
    };

    // Für die neuen Personal-Funktionen: Ausbaustufen, Verträge, Zufriedenheit je Mitarbeiter.
    let staffMeta = {};
    function ensureStaffMeta(key) {
        if (!staffMeta[key]) staffMeta[key] = { level: 1, contractMatchdays: 34, morale: 80, hiredSeason: null, contributionScore: 0 };
        return staffMeta[key];
    }
    let staffCentralState = {
        wageBudgetCap: 0,
        candidatePool: null,
        pendingPoach: null,
        lastMeetingSeason: null
    };

    let fanGroups = [
        { id: "ultras", name: "Ultras 'Szene Nord'", mood: 80, desc: "Sorgen für Hexenkessel (+Heimstärke), fordern günstige Stehplätze." },
        { id: "tradition", name: "Traditions-Fanclub 'Alte Garde'", mood: 75, desc: "Treue Dauerkartenkunden, legen Wert auf Identität und Museum." },
        { id: "families", name: "Familien & Gelegenheitszuschauer", mood: 70, desc: "Wichtig für Fanshop, Catering & Parkhaus." },
        { id: "vips", name: "VIPs & Logengäste", mood: 85, desc: "Finanzstarke Elite für Logen & Trikotsponsoring." }
    ];
    let fanCentralState = {
        memberships: 0,
        membershipFee: 8,
        fanProjectFunded: false,
        fanBusProgramActive: false,
        traditionClubStatus: false,
        seasonMoodTarget: null,
        youthSponsorships: [],
        scarfContestCooldown: 0,
        lastSurveyResult: null,
        pendingCriticalLetter: false,
        feed: []
    };

    let privateLife = {
        money: 15000, wage: 1200, license: 0, prestige: 10, stress: 15, items: [],
        assets: [], hobby: 'none', relationship: 'single', lastActivity: {},
        socialMediaActive: false, assistantHired: false, autobiographyWritten: false
    };

    const LIFESTYLE_ASSETS = [
        { id: 'apartment', name: 'Stadtwohnung', cost: 20000, prestige: 3, stressRelief: 5, category: 'Wohnen', desc: 'Ruhiger Rückzugsort mitten in der Stadt.' },
        { id: 'house', name: 'Einfamilienhaus im Grünen', cost: 60000, prestige: 5, stressRelief: 10, category: 'Wohnen', desc: 'Mehr Platz, mehr Ruhe vom Trubel.' },
        { id: 'villa', name: 'Villa mit Seeblick', cost: 250000, prestige: 12, stressRelief: 18, category: 'Wohnen', desc: 'Der Traum vieler Fans - und jetzt deiner.' },
        { id: 'car_sport', name: 'Sportwagen', cost: 80000, prestige: 8, stressRelief: 3, category: 'Fahrzeug', desc: 'Alle drehen sich um, wenn du vorfährst.' },
        { id: 'car_classic', name: 'Oldtimer-Sammlung', cost: 120000, prestige: 10, stressRelief: 6, category: 'Fahrzeug', desc: 'Ein Faible für automobile Geschichte.' },
        { id: 'yacht', name: 'Yacht "Confidence"', cost: 400000, prestige: 20, stressRelief: 15, category: 'Luxus', desc: 'Das ultimative Statussymbol am Hafen.' },
        { id: 'art', name: 'Kunstsammlung', cost: 90000, prestige: 9, stressRelief: 4, category: 'Luxus', desc: 'Investition mit nachweislich gutem Geschmack.' },
        { id: 'watch', name: 'Luxusuhren-Kollektion', cost: 45000, prestige: 6, stressRelief: 2, category: 'Luxus', desc: 'Ein Statement am Handgelenk bei jeder PK.' }
    ];

    const PRESTIGE_INCOME_ACTIVITIES = [
        { id: 'interview', name: 'Exklusiv-Interview geben', minPrestige: 5, income: 2000, stressCost: 5, cooldown: 3, desc: 'Ein Magazin zahlt gut für deine Geschichte.' },
        { id: 'sponsoring', name: 'Persönlichen Werbedeal abschließen', minPrestige: 15, income: 8000, stressCost: 8, cooldown: 6, desc: 'Eine Marke will dein Gesicht für ihre Kampagne.' },
        { id: 'speech', name: 'Vortragsreise antreten', minPrestige: 25, income: 15000, stressCost: 12, cooldown: 10, desc: 'Unternehmen zahlen gut für deine Erfolgsgeschichte.' },
        { id: 'book', name: 'Biografie veröffentlichen', minPrestige: 40, income: 35000, stressCost: 15, cooldown: 20, desc: 'Dein Leben als Bestseller im Buchhandel.' }
    ];

    const HOBBIES = [
        { id: 'none', name: 'Kein Hobby', stressDecay: 0, wageCost: 0, desc: 'Noch nichts nebenbei - vielleicht Zeit für ein Hobby?' },
        { id: 'reading', name: 'Vielleser', stressDecay: 1, wageCost: 0, desc: 'Kostenlos entspannend, kleiner aber stetiger Effekt.' },
        { id: 'fishing', name: 'Angeln am Wochenende', stressDecay: 3, wageCost: 100, desc: 'Ruhe am Wasser, spürbar entspannend.' },
        { id: 'golf_membership', name: 'Golf-Mitgliedschaft', stressDecay: 2, wageCost: 200, desc: 'Dauerhafter Club-Zugang statt Einzelrunden.' },
        { id: 'fitness', name: 'Eigenes Fitnessstudio', stressDecay: 4, wageCost: 300, desc: 'Der stärkste passive Stressabbau, aber nicht billig.' }
    ];

    const RELATIONSHIP_STATUSES = [
        { id: 'single', name: 'Single', stressDecayBonus: 0, wageCost: 0, desc: 'Volle Konzentration auf den Job.' },
        { id: 'partner', name: 'In einer Partnerschaft', stressDecayBonus: 2, wageCost: 150, desc: 'Jemand zum Reden nach schweren Niederlagen.' },
        { id: 'family', name: 'Familie mit Kindern', stressDecayBonus: 4, wageCost: 400, desc: 'Fordert Zeit und Geld, aber der beste Ausgleich zum Druck.' }
    ];

    const licenseConfig = [
        { name: "C-Lizenz", cost: 0, boost: 0 },
        { name: "B-Lizenz", cost: 8000, boost: 1 },
        { name: "A-Lizenz", cost: 25000, boost: 2 },
        { name: "UEFA Pro Lizenz", cost: 75000, boost: 4 }
    ];

    let bandenSponsors = [
        { id: 1, name: "Bäckerei Schmidt", type: "Statisch", income: 450, active: true, duration: 34 },
        { id: 2, name: "Brauerei Nordquell", type: "Statisch", income: 800, active: true, duration: 34 },
        { id: 3, name: "Autohaus Müller", type: "LED-Bande", income: 1200, active: true, duration: 34 },
        { id: 4, name: "TechSport Global", type: "LED-Bande", income: 1800, active: false, duration: 34 }
    ];


    let squad = [];
    let lineup = [];
    let secondTeamSquad = [];
    let secondTeamLineup = [];
    let youthLeagueTable = [];
    let youthLeagueMatchday = 0;
    let secondTeamMarketPlayers = [];
    let loanedPlayers = [];
    let loanClubRelationships = {};
    let loanClubLastInteractionSeason = {};
    let rivalryRecord = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, biggestWin: null, matches: [], shootoutsVsRival: 0 };
    let crestHistory = [];
    const NUM_LEAGUES = 6;
    let leagueNames = ["1. Bundesliga", "2. Liga", "3. Liga", "4. Liga (Regionalliga)", "5. Liga (Oberliga)", "6. Liga (Landesliga)"];
    let leaguesData = [];
    let fixturesData = [];
    let marketPlayers = [];
    let freeAgentPlayers = [];
    let loanablePlayers = [];
    let incomingLoans = []; // { playerId, parentClub, matchdaysLeft, buyOptionFee }
    let youthTalents = [];

    let cupTournament = {
        currentRound: 0,
        roundNames: ["1. Runde (32 Teams)", "Achtelfinale (16 Teams)", "Viertelfinale", "Halbfinale", "DFB-Pokal Finale"],
        matchdays: [4, 12, 20, 28, 34],
        prizes: [215000, 430000, 860000, 1720000, 4300000],
        roundsHistory: []
    };

    // Landespokal des eigenen Verbands - der einzige Weg in den DFB-Pokal fuer Vereine
    // unterhalb der 3. Liga (siehe js/landescup.js). Bewusst auf eigene Spieltage gelegt,
    // die sich nicht mit dem DFB-Pokal (4, 12, 20, 28, 34) ueberschneiden.
    let landesPokal = {
        region: 'Sachsen',
        active: false,
        won: false,
        currentRound: 0,
        roundNames: ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Landespokal-Finale'],
        matchdays: [6, 14, 22, 30],
        roundsHistory: [],
        drawCeremonyShown: false
    };

    let europeTournament = { startFeePaid: false,
        active: false,
        matchdays: [3, 7, 11, 15, 19, 23, 27, 29, 31],
        groupA: [],
        groupB: [],
        groupAFixtures: [],
        groupBFixtures: [],
        semiFinals: [],
        finalMatch: null
    };

