// ==========================================
// SPIELER- & TEAM-GENERIERUNG
// ==========================================
    const traitsPool = ["Tor-Instinkt", "Freistoß-Gott", "Elfmeter-Killer", "Leader", "Eisenfuß", "Flügelflitzer", "Zweikampfmonster", "Wetterfest", "Kein"];
    const nationPool = ["Deutschland", "Deutschland", "Deutschland", "Deutschland", "Deutschland", "Österreich", "Schweiz", "Polen", "Niederlande", "Frankreich"];
    const personalityPool = {
        TW: ["Rückhalt", "Abräumer", "Nervenstark", "Kommandant"],
        ABW: ["Abräumer", "Kopfballungeheuer", "Fels in der Brandung", "Ballspielend"],
        MIT: ["Regisseur", "Wasserträger", "Antreiber", "Ballverteiler"],
        ST: ["Vollstrecker", "Wandspieler", "Tempodribbler", "Big-Game-Player"]
    };
    const characterPool = ["Ruhig", "Emotional", "Ehrgeizig", "Selbstbewusst", "Bescheiden", "Hitzköpfig"];
    const agentNamePool = ["Klaus Berger", "Sandra Voigt", "Marco Lindner", "Julia Sommer", "Thomas Krause", "Nina Falk", "Rüdiger Stahl", "Petra Wolff"];
    // Internationale Top-Klubs für Auslands-Testspiele in der Vorbereitung (siehe
    // scheduleForeignFriendly() in calendar.js) - ebenfalls dezent verfremdet.
    const INTERNATIONAL_CLUB_NAMES = ["Real Madriz", "FC Barcalona", "Manchester Unitad", "Juwentus Turin", "Paris St. Germaine", "Liverpol FC", "AC Millan", "Ajax Amsterdaam", "Inter Milano", "Chelsea FC London", "Atlético Madriz", "FC Porto Portugal"];

    const cityPool = ["München", "Dortmund", "Berlin", "Leipzig", "Hamburg", "Frankfurt", "Stuttgart", "Bremen", "Köln", "Düsseldorf", "Hannover", "Nürnberg", "Kaiserslautern", "Dresden", "Bielefeld", "Bochum", "Augsburg", "Mainz", "Freiburg", "Rostock", "Magdeburg", "Karlsruhe", "Münster", "Essen", "Wiesbaden", "Osnabrück", "Saarbrücken", "Ulm", "Regensburg", "Braunschweig", "Fürth", "Elversberg", "Aachen", "Erfurt", "Halle", "Paderborn", "Kiel", "Sandhausen", "Ingolstadt", "Jena", "Zwickau", "Cottbus", "Chemnitz", "Offenbach", "Würzburg", "Mannheim", "Duisburg", "Oberhausen", "Krefeld", "Lübeck"];
    const prefixPool = ["FC", "SV", "SpVgg", "SC", "VfB", "VfL", "SG", "TSV", "1. FC", "Borussia", "Fortuna", "Dynamo", "Rot-Weiß", "Blau-Weiß", "Eintracht", "Viktoria"];
    let usedClubNames = new Set();

    // Bekannte deutsche Vereine, MINIMAL verfremdet (meist nur ein Umlaut entfernt oder ein
    // einzelner Buchstabe/eine Zahl leicht geändert, z.B. "Bayern München" -> "Bayern
    // Munchen") - so bleibt sofort erkennbar, welcher echte Verein gemeint ist, ohne exakt
    // die Original-Schreibweise zu verwenden. Wird von generateTeamName() mit ~35% Chance
    // gezogen, damit sich die Liga-Welt "geerdet" und wiedererkennbar anfühlt.
    const RECOGNIZABLE_CLUB_NAMES = [
        "Bayern Munchen", "Borussia Dortmunt", "Schalke 05", "Werder Breman",
        "Hamburger SP", "Eintracht Frankfurth", "RB Leibzig", "Bayer Leverkussen",
        "VfL Wolfburg", "Borussia Monchengladbach", "1. FC Koln", "VfB Stuttgardt",
        "TSG Hoffennheim", "SC Freyburg", "Union Berlien", "Mainz 06",
        "FC Augsburgh", "Hertha BSK", "1. FC Nurnberg", "Hannover 97",
        "Fortuna Dusseldorf", "FC St. Paulli", "Karlsruher SK", "Dynamo Dressden",
        "Energie Cotbus", "Arminia Bilefeld", "MSV Duisborg", "1. FC Heidenheimm",
        "Holstein Kiehl", "SV Darmstadt 99", "SC Padernborn", "Greuther Furth"
    ];

    function generateTeamName() {
        if (Math.random() < 0.35) {
            let candidates = RECOGNIZABLE_CLUB_NAMES.filter(n => !usedClubNames.has(n) && n !== "Lok Leipzig");
            if (candidates.length > 0) {
                let name = candidates[Math.floor(Math.random() * candidates.length)];
                usedClubNames.add(name);
                return name;
            }
        }
        for (let i = 0; i < 150; i++) {
            let pref = prefixPool[Math.floor(Math.random() * prefixPool.length)];
            let city = cityPool[Math.floor(Math.random() * cityPool.length)];
            let name = `${pref} ${city}`;
            if (!usedClubNames.has(name) && name !== "Lok Leipzig") {
                usedClubNames.add(name);
                return name;
            }
        }
        return `FC Sportfreunde ${Math.floor(Math.random() * 900 + 100)}`;
    }

    const firstNames = ["Max", "Lukas", "Leon", "Felix", "Jonas", "Elias", "Noah", "Julian", "Tim", "Moritz", "Jan", "Tom", "David", "Paul", "Alexander", "Daniel", "Tobias", "Florian", "Marco", "Kevin", "Nico", "Sven"];
    const lastNames = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Hartmann", "Lange"];

    function getRandomName() { return firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)]; }

    function calculatePlayerMarketValue(str) {
        let val = 0;
        if (str <= 58) val = 15000 + Math.pow(Math.max(0, str - 44), 2.8) * 450;
        else if (str <= 68) val = 150000 + Math.pow(str - 58, 3.2) * 550;
        else if (str <= 77) val = 900000 + Math.pow(str - 68, 3.8) * 1200;
        else if (str <= 85) val = 7500000 + Math.pow(str - 77, 4.2) * 4500;
        // Oberstes Segment (86-99, absolute Weltklasse): flacherer Exponent als vorher, sonst
        // explodiert die Kurve bei Stärke 99 auf mehrere MILLIARDEN Euro statt auf einen
        // realistischen Superstar-Wert (~30-200 Mio. €). Zusätzlich eine harte Obergrenze als
        // Sicherheitsnetz, falls hier nochmal jemand an der Formel dreht.
        else val = 32000000 + Math.pow(str - 85, 2.3) * 400000;
        val = Math.min(val, 250000000);
        return Math.max(10000, Math.round((val * (0.92 + Math.random() * 0.16)) / 5000) * 5000);
    }

    function calculatePlayerWage(marketValue, str) {
        let perMatchday = (str <= 58) ? 300 + (marketValue * 0.008) : (str <= 68 ? 1200 + (marketValue * 0.006) : (str <= 77 ? 5000 + (marketValue * 0.0045) : 25000 + (marketValue * 0.0035)));
        if (managerRPG.perks.negotiator) perMatchday *= 0.8;
        return Math.max(250, Math.round(perMatchday / 50) * 50);
    }

    function createPlayer(pos, minStr, maxStr, forceTrait = null, ageRange = null) {
        let str = Math.floor(Math.random() * (maxStr - minStr + 1)) + minStr;
        let mv = calculatePlayerMarketValue(str);
        let trait = forceTrait || (Math.random() < 0.35 ? traitsPool[Math.floor(Math.random() * (traitsPool.length - 1))] : "Kein");

        let age = ageRange ? (ageRange[0] + Math.floor(Math.random() * (ageRange[1] - ageRange[0] + 1))) : (18 + Math.floor(Math.random() * 17));
        let refYear = 2026 + (typeof game !== 'undefined' ? (game.season - 1) : 0);
        let birthYear = refYear - age;
        let birthDay = 1 + Math.floor(Math.random() * 28);
        let birthMonth = 1 + Math.floor(Math.random() * 12);
        let birthDate = `${String(birthDay).padStart(2, '0')}.${String(birthMonth).padStart(2, '0')}.${birthYear}`;

        let secondaryPositions = [];
        if (Math.random() < 0.25) {
            let siblings = { TW: [], ABW: ['MIT'], MIT: ['ABW', 'ST'], ST: ['MIT'] }[pos] || [];
            if (siblings.length > 0) secondaryPositions = [siblings[Math.floor(Math.random() * siblings.length)]];
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            name: getRandomName(),
            pos: pos,
            strength: str,
            goalsSeason: 0,
            goalsCareer: 0,
            strengthHistory: [{ season: (typeof game !== 'undefined' ? game.season : 1), strength: str }],
            trait: trait,
            age, birthDate,
            nation: nationPool[Math.floor(Math.random() * nationPool.length)],
            height: 170 + Math.floor(Math.random() * 29),
            personality: (personalityPool[pos] || personalityPool.MIT)[Math.floor(Math.random() * 4)],
            character: characterPool[Math.floor(Math.random() * characterPool.length)],
            secondaryPositions,
            // Etablierte Spieler (Stärke 62+) haben mit steigender Wahrscheinlichkeit einen
            // Berater, der bei jedem Geldtransfer (Kauf/Verkauf/Vertragsverlängerung) eine
            // zusätzliche Provision verlangt - siehe getAgentFee() in transfermarket.js/
            // contracts.js. Rein kosmetisch generierte Spieler (Jugend, Scouting) sind davon
            // NICHT ausgenommen, da auch unbekannte Talente heute oft schon vertreten sind.
            agent: (str >= 62 && Math.random() < 0.3 + Math.max(0, str - 62) * 0.01)
                ? { name: agentNamePool[Math.floor(Math.random() * agentNamePool.length)], feePct: 0.03 + Math.random() * 0.05 }
                : null,
            pace: Math.min(99, Math.max(40, str + Math.floor(Math.random() * 9 - 4))),
            shooting: Math.min(99, Math.max(40, (pos === 'ST' ? str + 4 : str - 6) + Math.floor(Math.random() * 6))),
            passing: Math.min(99, Math.max(40, (pos === 'MIT' ? str + 4 : str - 3) + Math.floor(Math.random() * 6))),
            defense: Math.min(99, Math.max(40, (pos === 'ABW' ? str + 5 : str - 8) + Math.floor(Math.random() * 6))),
            physique: Math.min(99, Math.max(40, str + Math.floor(Math.random() * 8 - 4))),
            wage: calculatePlayerWage(mv, str),
            role: null,
            fitness: 100,
            morale: 80,
            dailyForm: 50 + Math.floor(Math.random() * 20 - 10),
            contracts: 2 + Math.floor(Math.random() * 3), // 2-4 Jahre, gestreut statt synchron
            injured: 0,
            suspended: 0,
            nationalDuty: 0,
            timesInjured: 0,
            appearances: 0,
            friendPlayerId: null,
            squadTenureMatchdays: 0,
            ultimatumCount: 0,
            isCrowdFavorite: false,
            penaltiesTaken: 0,
            penaltiesScored: 0,
            penaltyTrainingBonus: 0,
            goals: 0,
            individualFocus: 'allgemein',
            trainProgress: 0,
            marketValue: mv
        };
    }

    // Erzeugt aus den 5 simulationsrelevanten Kernwerten (die das Matchengine tatsächlich
    // nutzt) ein erweitertes, rein kosmetisches 18er-Fähigkeiten-Raster fürs Spieler-Detail-
    // Popup - im Stil des Referenzspiels (OFF/ABS/DEF/INT/PRE/TEM/PAS/ZKH/ZKE/FLA/KOP/SPR/
    // DRI/WEI/ELF/FRS/FIT/GRU). Deterministisch pro Spieler (Seed aus der ID), damit sich
    // die Werte beim erneuten Öffnen des Popups nicht ändern.
    function seededRand(seedStr, salt) {
        let h = 0;
        let s = seedStr + salt;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return (h % 1000) / 1000;
    }
    function clamp99(v) { return Math.max(1, Math.min(99, Math.round(v))); }
    // Zentrale Stelle für die Beraterprovision - wird konsequent bei JEDEM Geldtransfer
    // rund um einen Spieler mit Berater angewendet (Kauf, Verkauf, Vertragsverlängerung),
    // damit sich die Provision nicht nur an einer einzelnen Stelle bemerkbar macht.
    function getAgentFee(p, baseAmount) {
        if (!p || !p.agent) return 0;
        // Berater-Beziehungspflege (NEU): eine gepflegte Beziehung zum Berater senkt seine
        // Provision spürbar - Berater erinnern sich, mit wem sie gut Geschäfte machen.
        let relationship = (typeof game !== 'undefined' && game.agentRelationships) ? (game.agentRelationships[p.agent.name] || 0) : 0;
        let effectiveFeePct = Math.max(0.01, p.agent.feePct - relationship * 0.001);
        return Math.round(baseAmount * effectiveFeePct);
    }
    // Geschenk/Freundschaftsgeste an einen Berater, um die Beziehung dauerhaft zu verbessern.
    function improveAgentRelationship(agentName) {
        if (!game.agentRelationships) game.agentRelationships = {};
        let cost = 3000 + (game.agentRelationships[agentName] || 0) * 500;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        game.agentRelationships[agentName] = Math.min(30, (game.agentRelationships[agentName] || 0) + 5);
        showToast(`🤝 Beziehung zu ${agentName} verbessert (Stufe ${game.agentRelationships[agentName]})!`, 'success');
        updateUI();
    }

    function getDisplayStats(p) {
        let r = salt => seededRand(p.id, salt);
        let posBonus = { OFF: p.pos === 'ST' ? 6 : 0, DEF: p.pos === 'ABW' ? 6 : 0, KOP: (p.pos === 'ABW' || p.pos === 'ST') ? 5 : 0 };
        return {
            OFF: clamp99(p.shooting + (posBonus.OFF || 0) + r('off') * 6 - 3),
            ABS: clamp99(p.defense * 0.9 + r('abs') * 8 - 4),
            DEF: clamp99(p.defense + (posBonus.DEF || 0)),
            INT: clamp99((p.passing + p.defense) / 2 + r('int') * 6 - 3),
            PRE: clamp99(p.passing + r('pre') * 6 - 3),
            TEM: clamp99(p.pace),
            PAS: clamp99(p.passing),
            ZKH: clamp99(p.physique + r('zkh') * 8 - 4),
            ZKE: clamp99(p.physique * 0.95 + r('zke') * 8 - 4),
            FLA: clamp99(p.passing * 0.85 + r('fla') * 10 - 5),
            KOP: clamp99(p.physique + (posBonus.KOP || 0) + r('kop') * 6 - 3),
            SPR: clamp99(p.physique + r('spr') * 8 - 4),
            DRI: clamp99((p.pace + p.shooting) / 2 + r('dri') * 6 - 3),
            WEI: clamp99(p.shooting * 0.9 + r('wei') * 10 - 5 + (p.trait === 'Eisenfuß' ? 12 : 0)),
            ELF: clamp99(p.shooting * 0.85 + r('elf') * 10 - 5 + (p.trait === 'Elfmeter-Killer' ? 15 : 0)),
            FRS: clamp99(p.passing * 0.8 + r('frs') * 10 - 5 + (p.trait === 'Freistoß-Gott' ? 15 : 0)),
            FIT: clamp99(p.fitness),
            GRU: clamp99(p.physique + r('gru') * 10 - 5)
        };
    }
