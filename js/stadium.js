
    // ---------- STADIONNAME & NAMENSRECHTE ----------
    // Stadion-Kostenskalierung (NEU): deutlich steiler als der generische Liga-Faktor, damit
    // ein Kreisligist sich keine Bundesliga-Arena leisten muss, ein Spitzenklub aber echte
    // zweistellige Millionenbeträge zahlt (wie in der Realität) - Index = leagueLevel
    // (0 = höchste Liga).
    const STADIUM_COST_SCALE = [1.0, 0.55, 0.28, 0.14, 0.07, 0.035];
    // Stadion-Größenstufe (NEU): das 3D-Design verändert sich jetzt sichtbar mit der
    // tatsächlichen Kapazität, statt bei jeder Stadiongröße gleich auszusehen -
    // von der kompakten Amateurarena bis zum Mega-Stadion mit Dach-Silhouette.
    function getStadiumVisualTier() {
        let cap = stadium.total || 16000;
        if (cap < 15000) return 'small';
        if (cap < 35000) return 'medium';
        if (cap < 60000) return 'large';
        return 'mega';
    }
    // Generiert die komplette innere Stadion-Struktur abhängig von der Größenstufe (NEU,
    // überarbeitet): nicht mehr nur ein CSS-Klassenwechsel auf starrer Struktur, sondern
    // echte strukturelle Unterschiede - Anzahl Flutlichter, Tribünenbreite, zweiter Rang,
    // Dach - damit der Ausbau auch bei mittleren Kapazitäten sichtbar etwas verändert.
    const STADIUM_TIER_CONFIG = {
        small: { floodlights: 2, standSize: 'thin', secondTier: false, roof: false, crowdDensity: 'low' },
        medium: { floodlights: 4, standSize: 'normal', secondTier: false, roof: false, crowdDensity: 'medium' },
        large: { floodlights: 6, standSize: 'wide', secondTier: true, roof: false, crowdDensity: 'high' },
        mega: { floodlights: 8, standSize: 'wide', secondTier: true, roof: true, crowdDensity: 'full' }
    };
    function generateStadiumBowlHTML(tier) {
        let cfg = STADIUM_TIER_CONFIG[tier] || STADIUM_TIER_CONFIG.medium;
        let floodlightPositions = {
            2: [['bottom:2%;left:6%'], ['bottom:2%;right:6%']],
            4: [['top:2%;left:6%'], ['top:2%;right:6%'], ['bottom:2%;left:6%'], ['bottom:2%;right:6%']],
            6: [['top:2%;left:6%'], ['top:2%;right:6%'], ['top:38%;left:1%'], ['top:38%;right:1%'], ['bottom:2%;left:6%'], ['bottom:2%;right:6%']],
            8: [['top:2%;left:6%'], ['top:2%;right:6%'], ['top:30%;left:0%'], ['top:30%;right:0%'], ['bottom:30%;left:0%'], ['bottom:30%;right:0%'], ['bottom:2%;left:6%'], ['bottom:2%;right:6%']]
        };
        let lights = (floodlightPositions[cfg.floodlights] || floodlightPositions[4])
            .map(pos => `<div class="dashboard-hero-floodlight tier-fl-${tier}" style="${pos[0]}"></div>`).join('');
        let standClass = `dashboard-hero-stand stand-${cfg.standSize}`;
        let secondTierMarkup = cfg.secondTier ? '<div class="stand-second-tier-band"></div>' : '';
        let roofMarkup = cfg.roof ? '<div class="stand-roof-canopy"></div>' : '';
        let crowdMarkup = `<div class="stand-crowd-texture crowd-${cfg.crowdDensity}"></div>`;
        let bowl = `
            <div class="dashboard-hero-bowl tier-${tier}">
                ${roofMarkup}
                <div class="${standClass}" style="grid-column:2/4; grid-row:1;">${secondTierMarkup}${crowdMarkup}</div>
                <div class="${standClass}" style="grid-column:1; grid-row:1/4;">${secondTierMarkup}${crowdMarkup}</div>
                <div class="${standClass}" style="grid-column:4; grid-row:1/4;">${secondTierMarkup}${crowdMarkup}</div>
                <div class="${standClass}" style="grid-column:2/4; grid-row:3;">${secondTierMarkup}${crowdMarkup}</div>
                <div class="dashboard-hero-pitch"></div>
            </div>`;
        return lights + bowl;
    }
    function applyStadiumVisualTier(wrapperSelector) {
        let el = document.querySelector(wrapperSelector);
        if (!el) return;
        let tier = getStadiumVisualTier();
        // Komplett neu generieren statt nur eine CSS-Klasse zu wechseln - dadurch ändern sich
        // Flutlicht-Anzahl, Tribünenbreite, zweiter Rang und Dach wirklich strukturell.
        el.innerHTML = generateStadiumBowlHTML(tier);
    }
    // Einfacher Klassenwechsel (bestehendes Verhalten) für Strukturen, die NICHT komplett neu
    // generiert werden - Live-Spiel-Rahmen und das funktionale Block-Raster im Stadion-Screen.
    function applyStadiumVisualTierClass(selector) {
        let el = document.querySelector(selector);
        if (!el) return;
        let tier = getStadiumVisualTier();
        el.classList.remove('tier-small', 'tier-medium', 'tier-large', 'tier-mega');
        el.classList.add('tier-' + tier);
    }
    function getStadiumCostScale() {
        return STADIUM_COST_SCALE[game.leagueLevel] ?? 0.035;
    }
    // ==========================================
    // BETRIEBSKOSTEN & STILLGELEGTE RÄNGE
    // ==========================================
    // Bisher kostete JEDER Platz 0,45 € pro Spieltag, unabhängig davon, ob dort jemand
    // sitzt. Ein Sechstligist, der ein geerbtes 15.550-Plätze-Stadion mit 600 Zuschauern
    // bespielt, zahlte damit 6.998 € pro Spieltag für Ränge, die nie jemand betritt - mehr
    // als zwei Drittel seiner Gesamteinnahmen - und konnte rechnerisch nie aus den roten
    // Zahlen kommen (nachgerechnet im neuen Buchungsjournal).
    // Jetzt gilt, was auch echte Vereine tun: nicht benötigte Ränge werden gesperrt und
    // kosten nur noch Substanzerhalt und Grundsicherung. Der Rabatt verschwindet von
    // allein, sobald der Verein wächst und das Stadion füllt - er verbilligt also den
    // Aufbau, nicht den Profibetrieb.
    const STADIUM_MAINTENANCE_PER_SEAT = 0.45;
    const MOTHBALLED_MAINTENANCE_RATE = 0.30;
    const MIN_ACTIVE_CAPACITY_SHARE = 0.20;

    function getUsedStadiumCapacity() {
        let total = stadium.total || 16000;
        let letzte = (game.attendanceHistory || []).slice(-5).map(h => h.attendance).filter(a => a > 0);
        let schnitt = letzte.length
            ? Math.round(letzte.reduce((s, a) => s + a, 0) / letzte.length)
            : Math.round(total * getAttendanceFactor());
        // 15% Reserve über dem Schnitt, damit ein gut besuchtes Spiel nicht an gesperrten
        // Rängen scheitert. Ein Fünftel des Stadions bleibt immer in Betrieb (Rasen,
        // Flutlicht, Haupttribüne, Sicherheitstechnik).
        return Math.min(total, Math.max(Math.round(total * MIN_ACTIVE_CAPACITY_SHARE), Math.round(schnitt * 1.15)));
    }

    function getMothballedCapacity() {
        return Math.max(0, (stadium.total || 16000) - getUsedStadiumCapacity());
    }

    function getStadiumBaseMaintenance() {
        let genutzt = getUsedStadiumCapacity();
        let kosten = genutzt * STADIUM_MAINTENANCE_PER_SEAT
            + getMothballedCapacity() * STADIUM_MAINTENANCE_PER_SEAT * MOTHBALLED_MAINTENANCE_RATE;
        // Solaranlage (NEU): senkt die Stromkosten-Komponente der Betriebskosten spürbar,
        // statt nur eine reine Sponsoren-Einnahmen-Erhöhung zu sein - echte Stromersparnis.
        if (stadium.upgrades?.solaranlage) kosten *= 0.8;
        return kosten;
    }

    // Ein Sponsor kann das Stadion umbenennen: einmalige große Ablöse plus laufende
    // Einnahmen pro Heimspiel (siehe applyMatchdayFinances() in match.js für die Auszahlung).
    const NAMING_RIGHTS_SPONSORS = ["Energie Nord AG", "MediaPark Digital", "Volksbank Arena-Partner", "TechFlow Systems", "Landmarkt-Gruppe"];
    function sellNamingRights() {
        if (stadium.namingRightsSponsor) { showToast('Namensrechte sind bereits vergeben - erst auflösen, um neu zu verkaufen.', 'error'); return; }
        playSound('goal');
        let sponsor = NAMING_RIGHTS_SPONSORS[Math.floor(Math.random() * NAMING_RIGHTS_SPONSORS.length)];
        let lumpSum = Math.round((150000 + Math.random() * 200000) * leagueScaleFactor() / 1000) * 1000;
        let perMatch = Math.round((800 + Math.random() * 1200) * leagueScaleFactor() / 50) * 50;
        stadium.name = `${sponsor}-Arena`;
        stadium.namingRightsSponsor = sponsor;
        stadium.namingRightsIncome = perMatch;
        game.money += lumpSum;
        addInboxMessage('vertrag', '🏟️ Namensrechte verkauft!', `Das Stadion heißt ab sofort "${stadium.name}". Einmalzahlung: ${formatVal(lumpSum)}, laufend +${formatVal(perMatch)}/Heimspiel.`, 'screen-stadium');
        // Namensgebungs-Zeremonie (NEU): eigenes Ereignis mit einer echten Entscheidung, statt
        // dass die Umbenennung einfach kommentarlos passiert.
        game.pendingNamingCeremony = { sponsor, stadiumName: stadium.name };
        renderStadiumView();
        updateUI();
    }
    function resolveNamingCeremony(style) {
        let ev = game.pendingNamingCeremony;
        if (!ev) return;
        if (style === 'traditional') {
            // Zeremonie mit Tradition & Respekt vor der Vereinsgeschichte verbunden.
            game.fans = Math.min(100, game.fans + 4);
            boostFanBaseFloor(1, 'Die würdevolle Namensgebungs-Zeremonie');
            showToast('🎪 Zeremonie mit Tradition verbunden - die Fans honorieren den Respekt vor der Vereinsgeschichte!', 'success');
        } else {
            // Volle kommerzielle Show - Vorstand freut sich, Traditionsfans weniger.
            game.boardSat = Math.min(100, game.boardSat + 5);
            let tradition = fanGroups.find(g => g.id === 'tradition');
            if (tradition) tradition.mood = Math.max(1, tradition.mood - 8);
            showToast('🎪 Große kommerzielle Enthüllungs-Show - der Vorstand ist begeistert, die Alte Garde weniger.', 'success');
        }
        game.pendingNamingCeremony = null;
        renderStadiumView();
        updateUI();
    }
    function cancelNamingRights() {
        stadium.name = null;
        stadium.namingRightsSponsor = null;
        stadium.namingRightsIncome = 0;
        renderStadiumView();
        showToast('Namensrechte aufgelöst - das Stadion trägt wieder seinen ursprünglichen Namen.', 'success');
    }

    // Publikumslieblings-Ehrenwand: ab 3 verschiedenen Publikumslieblingen über die
    // Karriere hinweg erscheint eine kleine kosmetische Ehrenwand im Stadion - rein
    // atmosphärisch, ohne Spielauswirkung.
    function renderCrowdFavoriteMonument() {
        let box = document.getElementById('crowd-favorite-monument-box');
        if (!box) return;
        let uniqueNames = [...new Set((game.crowdFavoriteHistory || []).map(f => f.name))];
        if (uniqueNames.length < 3) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = `<div class="box" style="border-left-color:#ff6b9d; text-align:center;">
            <strong style="color:#ff6b9d;">❤️ EHRENWAND DER PUBLIKUMSLIEBLINGE</strong><br>
            <span style="font-size:10px;">${uniqueNames.slice(-8).join(' · ')}</span>
        </div>`;
    }

    // ---------- DFB-LIZENZIERUNGS-AUFLAGEN ----------
    // Index 0 = 1. Bundesliga (Auflagen, um DORT anzukommen/zu bleiben) ... Index 5 = 6. Liga
    // (unterste Liga, praktisch keine Auflagen). Wird sowohl beim Aufstiegs-Check als auch
    // zur Anzeige im Stadion-Screen verwendet, damit man VORAB weiß, was für den nächsten
    // Aufstieg noch fehlt, statt erst nach der Meisterschaft eine böse Überraschung zu erleben.
    const DFB_LICENSING_REQUIREMENTS = [
        { minCapacity: 20000, floodlight: true, minMoney: 500000, minYouthLvl: 2 }, // 1. Bundesliga
        { minCapacity: 12000, floodlight: true, minMoney: 250000, minYouthLvl: 1 }, // 2. Bundesliga
        { minCapacity: 6000, floodlight: true, minMoney: 100000, minYouthLvl: 0 },  // 3. Liga
        { minCapacity: 3000, floodlight: false, minMoney: 30000, minYouthLvl: 0 },  // Regionalliga
        { minCapacity: 1000, floodlight: false, minMoney: 0, minYouthLvl: 0 },      // Oberliga
        { minCapacity: 0, floodlight: false, minMoney: 0, minYouthLvl: 0 }          // Landesliga
    ];
    // Prüft die Auflagen für die NÄCHSTHÖHERE Liga (relevant, sobald man aufstiegsberechtigt
    // wäre) und gibt eine Liste der noch offenen Punkte zurück (leer = alles erfüllt).
    function checkDfbLicensingStatus() {
        if (game.leagueLevel === 0) return { targetLevel: null, missing: [], totalCount: 0, metCount: 0 };
        let targetLevel = game.leagueLevel - 1;
        let req = DFB_LICENSING_REQUIREMENTS[targetLevel];
        let missing = [];
        let checks = [
            { active: req.minCapacity > 0, met: stadium.total >= req.minCapacity, text: `Stadionkapazität: ${stadium.total.toLocaleString('de-DE')} / ${req.minCapacity.toLocaleString('de-DE')}` },
            { active: req.floodlight, met: !!stadium.flutlicht, text: 'Flutlichtanlage fehlt' },
            { active: req.minMoney > 0, met: game.money >= req.minMoney, text: `Finanzreserve: ${formatVal(game.money)} / ${formatVal(req.minMoney)}` },
            { active: req.minYouthLvl > 0, met: (campusBuildings.internat?.lvl || 0) >= req.minYouthLvl, text: `Jugendinternat: Stufe ${campusBuildings.internat?.lvl || 0} / ${req.minYouthLvl}` }
        ].filter(c => c.active);
        checks.forEach(c => { if (!c.met) missing.push(c.text); });
        return { targetLevel, missing, totalCount: checks.length, metCount: checks.filter(c => c.met).length };
    }
    // Kompakte Anzeige im Stadion-Screen, damit die Auflagen jederzeit einsehbar sind.
    // ==========================================
    // BLOCK-SPEZIFISCHE FAN-KULTUR (NEU)
    // ==========================================
    // Jeder Stadion-Block hat eine natürliche kulturelle Zugehörigkeit zu einer der vier
    // Fan-Gruppen. Ist diese Fan-Gruppe gut gelaunt, stärkt sich die Block-Kultur über die
    // Zeit - eine tief verwurzelte Kultur gibt einen kleinen Heimstärke-Bonus zurück.
    const BLOCK_CULTURE_MAP = { kurve: 'ultras', hauptNord: 'tradition', haupt: 'tradition', familie: 'families', vipLogen: 'vips' };
    function tickBlockCultures() {
        for (let blockKey in BLOCK_CULTURE_MAP) {
            let block = stadium.blocks[blockKey];
            if (!block) continue;
            let groupId = BLOCK_CULTURE_MAP[blockKey];
            let group = fanGroups.find(g => g.id === groupId);
            if (!group) continue;
            if (typeof block.cultureStrength !== 'number') block.cultureStrength = 30;
            if (group.mood >= 70) block.cultureStrength = Math.min(100, block.cultureStrength + 0.5);
            else if (group.mood <= 40) block.cultureStrength = Math.max(0, block.cultureStrength - 0.3);
        }
    }
    function getBlockCultureHomeBonus() {
        let strongCultureBlocks = Object.keys(BLOCK_CULTURE_MAP).filter(k => (stadium.blocks[k]?.cultureStrength || 0) >= 75);
        return Math.min(2, strongCultureBlocks.length * 0.6);
    }
    function renderBlockCultureBox() {
        let box = document.getElementById('block-culture-box');
        if (!box) return;
        let labels = { ultras: '🔥 Ultras-Kurve', tradition: '🏛️ Traditions-Tribüne', families: '🎈 Familien-Bereich', vips: '🥂 VIP-Kultur' };
        box.innerHTML = Object.entries(BLOCK_CULTURE_MAP).map(([blockKey, groupId]) => {
            let block = stadium.blocks[blockKey];
            let strength = Math.round(block?.cultureStrength || 30);
            let color = strength >= 75 ? 'var(--primary)' : (strength >= 40 ? 'var(--accent)' : 'var(--text-muted)');
            return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:10px;"><span>${labels[groupId]} (${block?.name || blockKey})</span><strong style="color:${color};">${strength}%</strong></div>`;
        }).join('') + `<div style="font-size:9px; color:var(--text-muted); margin-top:4px;">Heimstärke-Bonus durch tief verwurzelte Kulturen: +${getBlockCultureHomeBonus().toFixed(1)}</div>`;
    }

    function renderDfbLicensingStatus() {
        let box = document.getElementById('dfb-licensing-status-box');
        if (!box) return;
        if (game.dfbGracePeriod) {
            box.style.display = 'block';
            let status = checkDfbLicensingStatus();
            let progressPct = status.totalCount > 0 ? Math.round((status.metCount / status.totalCount) * 100) : 100;
            box.innerHTML = `<div class="box" style="border-left-color:var(--danger);"><strong style="color:var(--danger);">⏳ DFB-Nachfrist läuft: noch ${game.dfbGracePeriod.deadlineMatchday} Spieltag(e)!</strong>
                <div style="background:rgba(228,197,140,0.1); border-radius:4px; height:6px; margin:6px 0; overflow:hidden;"><div style="width:${progressPct}%; height:100%; background:var(--accent);"></div></div>
                <span style="font-size:10px;">${status.metCount} von ${status.totalCount} Auflagen erfüllt · Noch offen: ${status.missing.join(' · ') || 'Alles erfüllt - Aufstieg steht bevor!'}</span></div>`;
            return;
        }
        let { targetLevel, missing, totalCount, metCount } = checkDfbLicensingStatus();
        if (targetLevel === null) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        let progressPct = totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 100;
        if (missing.length === 0) {
            box.innerHTML = `<div class="box" style="border-left-color:var(--primary);"><strong style="color:var(--primary);">✅ DFB-Lizenz für die ${leagueNames[targetLevel]} erfüllt!</strong><br><span style="font-size:10px;">Bei sportlichem Aufstieg steht der Beförderung nichts im Wege.</span></div>`;
        } else {
            let teams = leaguesData[game.leagueLevel];
            let inPromotionZone = false;
            if (teams) {
                let sorted = [...teams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
                let myRank = sorted.findIndex(t => t.name === game.clubName) + 1;
                inPromotionZone = myRank > 0 && myRank <= 2;
            }
            let urgencyNote = (game.matchday >= 30 && inPromotionZone)
                ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(217,89,79,0.3); color:var(--danger); font-weight:800; font-size:10px;">🚨 Du liegst aktuell in Aufstiegsposition, aber die Lizenz fehlt noch - nur noch ${34 - game.matchday} Spieltag(e) bis Saisonende!</div>`
                : '';
            box.innerHTML = `<div class="box" style="border-left-color:var(--danger);"><strong style="color:var(--danger);">📋 DFB-Auflagen für die ${leagueNames[targetLevel]}: ${metCount} von ${totalCount} erfüllt</strong>
                <div style="background:rgba(228,197,140,0.1); border-radius:4px; height:6px; margin:6px 0; overflow:hidden;"><div style="width:${progressPct}%; height:100%; background:${progressPct >= 75 ? 'var(--accent)' : 'var(--danger)'};"></div></div>
                <span style="font-size:10px;">${missing.map(m => '• ' + m).join('<br>')}</span>${urgencyNote}</div>`;
        }
    }

    // Zeigt Flutlichtmasten in den vier Ecken und einen Dach-Rahmen an, sobald die
    // jeweilige Spezial-Installation gekauft wurde - macht den Stadionausbau auch optisch
    // sichtbar, statt nur als Haken in einer Liste.
    function renderStadiumSpecialVisuals() {
        let lightsBox = document.getElementById('stadium-floodlights-container');
        if (lightsBox) {
            lightsBox.innerHTML = stadium.flutlicht
                ? `<div class="stadium-floodlight-icon" style="top:-2px; left:-2px;">💡</div>
                   <div class="stadium-floodlight-icon" style="top:-2px; right:-2px;">💡</div>
                   <div class="stadium-floodlight-icon" style="bottom:-2px; left:-2px;">💡</div>
                   <div class="stadium-floodlight-icon" style="bottom:-2px; right:-2px;">💡</div>`
                : '';
        }
        let roofBox = document.getElementById('stadium-roof-overlay-el');
        if (roofBox) roofBox.className = stadium.dach ? 'stadium-roof-overlay' : '';
    }

    // Kennzahlen-Box (NEU): Kapazität, letzte Zuschauerzahl, Auslastung, Stadionwert und
    // Bauwert auf einen Blick, plus Zuschauerentwicklungs-Diagramm - wie im Referenz-Layout.
    function getStadiumMarketValue() {
        // Der "Stadionwert" ist keine reine Bausumme, sondern eine grobe Marktbewertung:
        // Grundstück/Lage-Faktor (skaliert mit Kapazität) plus das eigentlich Investierte,
        // multipliziert mit einem Prestige-Aufschlag für Spezialanlagen.
        let baseLandValue = (stadium.total || 16000) * 2500;
        let investedValue = (stadium.totalInvested || 0) * 1.4;
        let prestigeMult = 1 + (stadium.flutlicht ? 0.05 : 0) + (stadium.dach ? 0.12 : 0) + (stadium.videowalls ? 0.03 : 0) + (stadium.rasenheizung ? 0.02 : 0);
        return Math.round((baseLandValue + investedValue) * prestigeMult);
    }
    function renderStadiumKeyFigures() {
        let box = document.getElementById('stadium-key-figures-box');
        if (!box) return;
        // Bugfix: der Stadionname änderte sich nach einem Namensrechte-Verkauf zwar intern,
        // wurde aber außerhalb der kleinen Bestätigungsbox nirgends mehr angezeigt - trotz
        // echter Bezahlung fühlte sich die Umbenennung dadurch fast wirkungslos an.
        let nameHeader = document.getElementById('stadium-name-header');
        if (nameHeader) nameHeader.innerText = stadium.name || 'Vereinsstadion (keine Namensrechte vergeben)';
        let lastAttendance = (game.attendanceHistory || []).length > 0 ? game.attendanceHistory[game.attendanceHistory.length - 1].attendance : 0;
        let capacity = stadium.total || 16000;
        let utilization = capacity > 0 ? Math.round((lastAttendance / capacity) * 100) : 0;
        box.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">KAPAZITÄT</div><div style="font-size:15px; font-weight:900;">${capacity.toLocaleString('de-DE')}</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">LETZTE ZUSCHAUERZAHL</div><div style="font-size:15px; font-weight:900;">${lastAttendance.toLocaleString('de-DE')}</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">AUSLASTUNG</div><div style="font-size:15px; font-weight:900; color:${utilization>=70?'var(--primary)':(utilization>=40?'var(--accent)':'var(--danger)')};">${utilization}%</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">STADIONWERT</div><div style="font-size:15px; font-weight:900; color:var(--gold);">${(getStadiumMarketValue()/1000000).toFixed(2)} Mio €</div></div>
            </div>
            <div class="box" style="margin-top:4px;"><div style="font-size:8px; color:var(--text-muted);">BAUWERT (INVESTIERTE SUMME)</div><div style="font-size:15px; font-weight:900; color:var(--industry);">${((stadium.totalInvested||0)/1000000).toFixed(2)} Mio €</div></div>
            <div class="box" style="margin-top:4px;">
                <div style="font-size:8px; color:var(--text-muted);">BETRIEBSKOSTEN PRO SPIELTAG</div>
                <div style="font-size:15px; font-weight:900; color:var(--danger);">${formatVal(Math.round(getStadiumBaseMaintenance()))}</div>
                <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">
                    ${getMothballedCapacity() > 0
                        ? `${getUsedStadiumCapacity().toLocaleString('de-DE')} Plätze in Betrieb, ${getMothballedCapacity().toLocaleString('de-DE')} stillgelegt (nur ${Math.round(MOTHBALLED_MAINTENANCE_RATE * 100)}% Unterhalt). Wächst der Zuschauerschnitt, werden gesperrte Ränge automatisch wieder geöffnet - und teurer.`
                        : 'Das gesamte Stadion ist in Betrieb.'}
                </div>
            </div>
        `;
        renderAttendanceChart('stadium-attendance-chart-box');
        renderStadiumImmersiveHero();
    }

    // Immersive Stadion-Hero (NEU): große 3D-Ansicht mit schwebenden Kennzahlen-Karten und
    // einer berechneten "Stadion-Zustand"-Einschätzung, angelehnt an moderne Management-
    // Spiele-Referenzen - nutzt echte Spieldaten statt Platzhaltertexten.
    function getStadiumConditionRating() {
        let totalPossibleUpgrades = Object.keys(STADIUM_UPGRADES).length;
        let ownedCount = stadium.upgrades ? Object.keys(stadium.upgrades).filter(k => stadium.upgrades[k]).length : 0;
        let specialCount = ['flutlicht', 'rasenheizung', 'videowalls', 'dach'].filter(k => stadium[k]).length;
        let totalRatio = (ownedCount + specialCount) / (totalPossibleUpgrades + 4);
        if (totalRatio >= 0.6) return { label: 'Hervorragend', color: 'var(--primary)' };
        if (totalRatio >= 0.3) return { label: 'Gut', color: 'var(--accent)' };
        if (totalRatio >= 0.1) return { label: 'Ausbaufähig', color: 'var(--industry)' };
        return { label: 'Sanierungsbedürftig', color: 'var(--danger)' };
    }
    function findNextStadiumSuggestion() {
        // Günstigste noch nicht gebaute Erweiterung vorschlagen, sonst nächster Block-Ausbau.
        if (stadium.upgrades) {
            let candidates = Object.keys(STADIUM_UPGRADES).filter(k => !stadium.upgrades[k]).map(k => ({ key: k, cost: getStadiumUpgradeCost(k), name: STADIUM_UPGRADES[k].name }));
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.cost - b.cost);
                return { label: candidates[0].name, cost: candidates[0].cost, action: `buyStadiumUpgrade('${candidates[0].key}')` };
            }
        }
        return null;
    }
    function renderStadiumImmersiveHero() {
        let metricsBox = document.getElementById('stadium-hero-metrics-row');
        if (!metricsBox) return;
        let lastAttendance = (game.attendanceHistory || []).length > 0 ? game.attendanceHistory[game.attendanceHistory.length - 1].attendance : 0;
        let capacity = stadium.total || 16000;
        let utilization = capacity > 0 ? Math.round((lastAttendance / capacity) * 100) : 0;
        let lastTicketIncome = (game.attendanceHistory || []).length > 0
            ? Math.round(lastAttendance * 0.5 * game.ticketPrices.steh + lastAttendance * 0.45 * game.ticketPrices.sitz + (stadium.vipTotal || 50) * game.ticketPrices.vip)
            : 0;
        metricsBox.innerHTML = `
            <div class="stadium-hero-metric-chip"><div class="shm-label">Kapazität</div><div class="shm-value">${capacity.toLocaleString('de-DE')}</div></div>
            <div class="stadium-hero-metric-chip"><div class="shm-label">Auslastung</div><div class="shm-value" style="color:${utilization>=70?'var(--primary)':'var(--accent)'};">${utilization}%</div></div>
            <div class="stadium-hero-metric-chip"><div class="shm-label">Einnahmen (Spieltag)</div><div class="shm-value" style="color:var(--gold); font-size:12px;">${formatVal(lastTicketIncome)}</div></div>
        `;
        let condBox = document.getElementById('stadium-condition-card');
        if (condBox) {
            let cond = getStadiumConditionRating();
            let suggestion = findNextStadiumSuggestion();
            condBox.innerHTML = `
                <div style="font-size:9px; color:var(--text-muted);">STADION-ZUSTAND</div>
                <div style="font-size:14px; font-weight:900; color:${cond.color}; margin-bottom:6px;">${cond.label}</div>
                ${suggestion ? `
                    <div style="font-size:9px; color:var(--text-muted);">NÄCHSTE AUSBAUSTUFE</div>
                    <div style="font-size:11px; margin-bottom:6px;">${suggestion.label} (${formatVal(suggestion.cost)})</div>
                    <button onclick="${suggestion.action}" class="btn-action">Ausbau Planen</button>
                ` : '<div style="font-size:10px; color:var(--primary);">Alle Erweiterungen bereits gebaut! ✓</div>'}
            `;
        }
        let nameOverlay = document.getElementById('stadium-hero-name-overlay');
        if (nameOverlay) nameOverlay.innerText = stadium.name || 'Vereinsstadion';
        if (typeof applyStadiumVisualTier === 'function') applyStadiumVisualTier('#stadium-hero-bowl-wrapper');
    }

    // Spezial-Installationen: deutlich realistischere Basiskosten (NEU), skaliert mit der
    // Liga-Stärke - eine Komplett-Überdachung kostet im Spitzenfußball echte zweistellige
    // Millionenbeträge, nicht ein paar hunderttausend Euro.
    const SPECIAL_INSTALL_BASE_COSTS = { flutlicht: 3500000, rasenheizung: 2200000, videowalls: 4000000, dach: 28000000 };
    const SPECIAL_INSTALL_LABELS = { flutlicht: '💡 Flutlicht-Masten', rasenheizung: '🔥 Rasenheizung', videowalls: '📺 Digitale Anzeigen / HD-Videowalls', dach: '🏗️ Komplett-Überdachung' };

    // ==========================================
    // 20 NEUE STADION-ERWEITERUNGEN (NEU)
    // ==========================================
    // Jede Erweiterung gehört zu einer von mehreren Wirkungs-Kategorien, die direkt in
    // bestehende Formeln einfließen (Komfort/Zuschauerzahl, Sicherheit, Verletzungsrisiko,
    // Medienimage, Sponsoreneinnahmen, Heimvorteil, oder eine feste Einnahme pro Heimspiel) -
    // dadurch hat jede einzelne, frei kaufbare Anlage eine echte, spürbare Auswirkung statt
    // nur eine Zahl im Stadionwert zu sein.
    const STADIUM_UPGRADES = {
        sicherheitstechnik: { name: '📹 Kameras & Zutrittskontrolle', cost: 1800000, category: 'security', desc: 'Senkt das Ausschreitungsrisiko dauerhaft um 15%.' },
        evakuierung: { name: '🚨 Notfall-Evakuierungssystem', cost: 2200000, category: 'security', desc: 'Senkt das Ausschreitungsrisiko dauerhaft um 15% und verbessert die Sicherheitsbilanz.' },
        medizinzentrum: { name: '🏥 Medizinisches Behandlungszentrum', cost: 3200000, category: 'injury', desc: 'Senkt das Verletzungsrisiko bei Heimspielen um 12%.' },
        rasenpflege_hightech: { name: '🌱 High-Tech-Rasenpflegesystem', cost: 2600000, category: 'injury', desc: 'Senkt das Verletzungsrisiko bei Heimspielen um 12%.' },
        klimaanlage: { name: '❄️ Klimaanlage & Belüftung', cost: 3800000, category: 'weather', desc: 'Neutralisiert die negativen Effekte von Hitze-Wetter komplett.' },
        vip_lounges: { name: '🥂 VIP-Business-Lounges', cost: 4500000, category: 'income', incomeBase: 8000, desc: 'Feste Zusatzeinnahmen pro Heimspiel.' },
        public_viewing: { name: '📽️ Public-Viewing-Zone', cost: 1500000, category: 'income', incomeBase: 3500, desc: 'Feste Zusatzeinnahmen pro Heimspiel.' },
        ladestationen: { name: '🔌 E-Auto-Ladestationen', cost: 900000, category: 'income', incomeBase: 1800, desc: 'Feste Zusatzeinnahmen pro Heimspiel.' },
        flagship_store: { name: '🛍️ Merchandising-Flagship-Store', cost: 3600000, category: 'merch', desc: 'Erhöht den Fanartikel-Absatz im Stadion dauerhaft um 15%.' },
        stadion_app: { name: '📱 Digitale Stadion-App', cost: 1600000, category: 'merch', desc: 'Erhöht den Fanartikel-Absatz im Stadion dauerhaft um 10%.' },
        wlan: { name: '📶 Öffentliches WLAN', cost: 1100000, category: 'comfort', desc: 'Erhöht den Zuschauerkomfort dauerhaft.' },
        komfort_wc: { name: '🚿 Modernisierte Sanitäranlagen', cost: 1400000, category: 'comfort', desc: 'Erhöht den Zuschauerkomfort dauerhaft.' },
        bahnanbindung: { name: '🚉 Verbesserte ÖPNV-Anbindung', cost: 5200000, category: 'comfort', desc: 'Erhöht den Zuschauerkomfort spürbar dauerhaft.' },
        familienbereich: { name: '🎠 Familien-Erlebnisbereich', cost: 1900000, category: 'fans', desc: 'Erhöht die Fan-Zufriedenheit dauerhaft.' },
        stadion_museum: { name: '🏛️ Stadion-internes Museum', cost: 2100000, category: 'fans', desc: 'Erhöht die Fan-Zufriedenheit dauerhaft.' },
        lichtshow: { name: '✨ Lichtshow-System', cost: 2400000, category: 'media', desc: 'Erhöht dein Manager-Medienimage bei jedem Heimspiel leicht.' },
        pressezentrum: { name: '🎙️ Modernes Pressezentrum', cost: 2000000, category: 'media', desc: 'Erhöht dein Manager-Medienimage bei jedem Heimspiel leicht.' },
        beschallung: { name: '🔊 Profi-Beschallungsanlage', cost: 1700000, category: 'homeadvantage', desc: 'Verstärkt den Heimvorteil (Teamstärke bei Heimspielen).' },
        solaranlage: { name: '☀️ Solaranlage aufs Dach', cost: 3300000, category: 'sponsor', desc: 'Erhöht die laufenden Sponsoreneinnahmen dauerhaft um 8% UND senkt die Stromkosten-Komponente der Betriebskosten um 20%.' },
        business_center: { name: '🏢 Business-Center für Firmenkunden', cost: 4800000, category: 'sponsor', desc: 'Erhöht die laufenden Sponsoreneinnahmen dauerhaft um 8%.' }
    };

    function getStadiumUpgradeCost(key) {
        let scale = getStadiumCostScale();
        return Math.round(STADIUM_UPGRADES[key].cost * scale);
    }
    function buyStadiumUpgrade(key) {
        if (!stadium.upgrades) stadium.upgrades = {};
        if (stadium.upgrades[key]) return;
        let cost = getStadiumUpgradeCost(key);
        let u = STADIUM_UPGRADES[key];
        queueStadiumConstruction('stadiumUpgrade', { key }, cost, getConstructionDays(cost), u.name);
    }
    // Kategorie-Summen: wie viele der gekauften Erweiterungen zu einer Kategorie gehören -
    // mehrere Erweiterungen derselben Kategorie addieren sich (mit sinnvoller Obergrenze).
    function countOwnedUpgradesInCategory(category) {
        if (!stadium.upgrades) return 0;
        return Object.keys(STADIUM_UPGRADES).filter(k => stadium.upgrades[k] && STADIUM_UPGRADES[k].category === category).length;
    }
    function getStadiumSecurityBonus() { return Math.min(0.4, countOwnedUpgradesInCategory('security') * 0.15); }
    function getStadiumInjuryReduction() { return Math.min(0.3, countOwnedUpgradesInCategory('injury') * 0.12); }
    function getStadiumComfortBonus() { return Math.min(0.15, countOwnedUpgradesInCategory('comfort') * 0.03); }
    function getStadiumMerchBonus() {
        if (!stadium.upgrades) return 0;
        let bonus = 0;
        if (stadium.upgrades.flagship_store) bonus += 0.15;
        if (stadium.upgrades.stadion_app) bonus += 0.10;
        return bonus;
    }
    function getStadiumFanBonusOnce(key) {
        // Wird beim Bau-Abschluss einmalig als Fan-Sockel-Erhöhung angewendet (siehe
        // tickStadiumConstruction), nicht laufend neu berechnet.
        return 3;
    }
    function getStadiumHomeAdvantageBonus() { return countOwnedUpgradesInCategory('homeadvantage') * 1.2; }
    function getStadiumSponsorBonus() { return Math.min(0.24, countOwnedUpgradesInCategory('sponsor') * 0.08); }
    function getStadiumMediaImageMatchdayBonus() { return countOwnedUpgradesInCategory('media') * 0.4; }
    function getStadiumMatchdayIncome() {
        if (!stadium.upgrades) return 0;
        let scale = getStadiumCostScale();
        return Object.keys(STADIUM_UPGRADES).filter(k => stadium.upgrades[k] && STADIUM_UPGRADES[k].category === 'income')
            .reduce((sum, k) => sum + Math.round(STADIUM_UPGRADES[k].incomeBase * scale), 0);
    }

    // Zusammenfassungs-Übersicht (NEU): fasst alle Kategorie-Boni der 20 Stadion-Erweiterungen
    // an einer Stelle zusammen, mit Fortschrittsbalken relativ zum jeweils maximal
    // erreichbaren Wert (nicht der willkürlichen Sicherheits-Obergrenze im Code, sondern dem
    // tatsächlich mit den vorhandenen Anlagen erreichbaren Maximum) - damit auf einen Blick
    // sichtbar ist, wie viel Prozent von 100% bereits erreicht sind.
    function renderStadiumUpgradesSummary() {
        let box = document.getElementById('stadium-upgrades-summary');
        if (!box) return;
        let bar = (label, current, max, unit = '%', extra = '') => {
            let pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
            let displayCurrent = unit === '%' ? Math.round(current * 100) : Math.round(current);
            let displayMax = unit === '%' ? Math.round(max * 100) : Math.round(max);
            return `
                <div style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px;">
                        <span>${label}</span>
                        <strong style="color:var(--accent);">${displayCurrent}${unit === '%' ? '%' : ''} / ${displayMax}${unit === '%' ? '%' : ''} maximal${extra}</strong>
                    </div>
                    <div style="background:rgba(255,255,255,0.06); border-radius:999px; height:7px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--primary), var(--accent)); border-radius:999px;"></div>
                    </div>
                </div>`;
        };
        let scale = getStadiumCostScale();
        box.innerHTML = `
            ${bar('🛡️ Sicherheit (Ausschreitungsrisiko-Senkung)', getStadiumSecurityBonus(), 0.30)}
            ${bar('🏥 Verletzungsrisiko-Senkung (Heimspiele)', getStadiumInjuryReduction(), 0.24)}
            ${bar('📶 Zuschauerkomfort-Bonus', getStadiumComfortBonus(), 0.09)}
            ${bar('🛍️ Fanartikel-Absatz-Bonus', getStadiumMerchBonus(), 0.25)}
            ${bar('📈 Sponsoreneinnahmen-Bonus', getStadiumSponsorBonus(), 0.24)}
            ${bar('⚡ Heimvorteil (Teamstärke-Punkte)', getStadiumHomeAdvantageBonus(), 1.2, 'pt')}
            ${bar('🎤 Medienimage pro Heimspiel', getStadiumMediaImageMatchdayBonus(), 0.8, 'pt')}
            <div class="box" style="font-size:10px; margin-top:4px;">💰 Feste Zusatzeinnahmen pro Heimspiel: <strong style="color:var(--gold);">${formatVal(getStadiumMatchdayIncome())}</strong> (max. ${formatVal(Math.round((8000+3500+1800)*scale))})</div>
            <div class="box" style="font-size:10px;">☀️/❄️ Wetterschutz: <strong>${stadium.upgrades?.klimaanlage ? 'Hitze neutralisiert ✓' : 'Klimaanlage fehlt noch'}</strong></div>
        `;
    }

    function renderStadiumUpgradesGrid() {
        let grid = document.getElementById('stadium-upgrades-grid');
        if (!grid) return;
        if (!stadium.upgrades) stadium.upgrades = {};
        grid.innerHTML = Object.keys(STADIUM_UPGRADES).map(key => {
            let u = STADIUM_UPGRADES[key];
            let cost = getStadiumUpgradeCost(key);
            let owned = stadium.upgrades[key];
            let queued = (game.stadiumConstructionQueue || []).find(p => p.type === 'stadiumUpgrade' && p.params.key === key);
            let buttonHtml = owned
                ? '<button class="btn-action" disabled>Vorhanden ✓</button>'
                : queued
                    ? `<button class="btn-secondary" disabled>🏗️ Im Bau... (noch ${queued.daysLeft} SpT)</button>`
                    : `<button onclick="buyStadiumUpgrade('${key}')" class="btn-secondary">Bauen [${formatVal(cost)}] · ${getConstructionDays(cost)} SpT</button>`;
            return `<div class="panel">
                <div class="panel-header" style="font-size:10px;">${u.name}</div>
                <div style="font-size:9px; color:#aaa; margin-bottom:4px;">${u.desc}</div>
                ${buttonHtml}
            </div>`;
        }).join('');
    }

    function renderSpecialInstallsGrid() {
        let grid = document.getElementById('special-installs-grid');
        if (!grid) return;
        let scale = getStadiumCostScale();
        grid.innerHTML = Object.keys(SPECIAL_INSTALL_BASE_COSTS).map(key => {
            let cost = Math.round(SPECIAL_INSTALL_BASE_COSTS[key] * scale);
            let owned = stadium[key];
            let queued = (game.stadiumConstructionQueue || []).some(p => p.type === 'specialInstall' && p.params.key === key);
            let label = owned ? `${SPECIAL_INSTALL_LABELS[key]} ✓ vorhanden` : (queued ? `${SPECIAL_INSTALL_LABELS[key]} (im Bau...)` : `${SPECIAL_INSTALL_LABELS[key]} [${formatVal(cost)}]`);
            return `<button onclick="upgradeSpecialInstall('${key}', ${cost})" class="btn-secondary" ${owned || queued ? 'disabled' : ''}>${label}</button>`;
        }).join('');
    }

    function renderStadiumView() {
        applyStadiumVisualTierClass('.stadium-bowl');
        renderStadiumConstructionBox();
        renderStadiumKeyFigures();
        renderSpecialInstallsGrid();
        renderStadiumUpgradesSummary();
        renderStadiumUpgradesGrid();
        renderCrowdFavoriteMonument();
        renderDfbLicensingStatus();
        renderStadiumSpecialVisuals();
        renderBlockCultureBox();
        let ceremonyBox = document.getElementById('naming-ceremony-box');
        if (ceremonyBox) {
            let ev = game.pendingNamingCeremony;
            ceremonyBox.style.display = ev ? 'block' : 'none';
            if (ev) {
                ceremonyBox.innerHTML = `<div class="panel-header" style="color:var(--accent);">🎪 NAMENSGEBUNGS-ZEREMONIE</div>
                    <div class="box" style="font-size:10px;">Wie soll die Enthüllung von "${ev.stadiumName}" gestaltet werden?</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button onclick="resolveNamingCeremony('traditional')" class="btn-secondary">🏛️ Mit Tradition verbinden</button>
                        <button onclick="resolveNamingCeremony('commercial')" class="btn-action">🎉 Große Show</button>
                    </div>`;
            }
        }
        // Zuschauerrekord-Countdown: Motivationsanreiz, wie viele Zuschauer bis zum nächsten
        // Meilenstein noch fehlen (siehe ATTENDANCE_MILESTONES in match.js).
        let countdownBox = document.getElementById('attendance-milestone-countdown');
        if (countdownBox) {
            let milestones = [10000, 25000, 50000];
            let reached = game.attendanceMilestonesReached || [];
            let next = milestones.find(m => !reached.includes(m));
            if (next) {
                let remaining = Math.max(0, next - (game.recordAttendance || 0));
                countdownBox.innerHTML = `<div class="box" style="font-size:10px;">📊 Noch <strong style="color:var(--accent);">${remaining.toLocaleString('de-DE')}</strong> Zuschauer bis zum nächsten Meilenstein (${next.toLocaleString('de-DE')})!</div>`;
            } else {
                countdownBox.innerHTML = `<div class="box" style="font-size:10px; color:var(--gold);">🏆 Alle Zuschauer-Meilensteine erreicht! Aktueller Rekord: ${(game.recordAttendance || 0).toLocaleString('de-DE')}</div>`;
            }
        }
        let nameBox = document.getElementById('stadium-naming-box');
        if (nameBox) {
            nameBox.innerHTML = stadium.namingRightsSponsor
                ? `<div class="box">Aktueller Name: <strong style="color:var(--accent);">${stadium.name}</strong> (Sponsor: ${stadium.namingRightsSponsor})<br>Laufende Einnahmen: +${formatVal(stadium.namingRightsIncome)}/Heimspiel</div><button onclick="cancelNamingRights()" class="btn-secondary" style="margin-top:4px;">Namensrechte auflösen</button>`
                : `<div class="box" style="font-size:10px; color:#94a3b8;">Kein Namensgeber - verkaufe die Namensrechte für eine große Einmalzahlung plus laufende Einnahmen.</div><button onclick="sellNamingRights()" class="btn-primary" style="margin-top:4px;">🏟️ Namensrechte verkaufen</button>`;
        }
        for (let key in stadium.blocks) {
            let el = document.getElementById('cap-' + key);
            if (el) el.innerText = stadium.blocks[key].cap.toLocaleString();
            // Infrastruktur direkt in der Stadiongrafik sichtbar machen: pro Ausbaustufe
            // (0-3) ein zusätzliches Icon, statt es nur im Text-Popup zu verstecken.
            let infraEl = document.getElementById('infra-' + key);
            if (infraEl) {
                let b = stadium.blocks[key];
                let icons = '';
                if (b.foodLvl > 0) icons += '🌭'.repeat(b.foodLvl);
                if (b.merchLvl > 0) icons += '👕'.repeat(b.merchLvl);
                if (b.toiletLvl > 0) icons += '🚻'.repeat(b.toiletLvl);
                infraEl.innerHTML = icons ? `<span>${icons}</span>` : '';
            }
        }
        ['flutlicht', 'rasenheizung', 'videowalls', 'dach'].forEach(k => {
            let btn = document.getElementById('btn-spec-' + k);
            if (btn && stadium[k]) {
                btn.innerText = btn.innerText.split('[')[0] + " [Installiert ✓]";
                btn.disabled = true;
            }
        });
    }

    function selectStadiumBlock(blockKey) {
        playSound('click');
        let b = stadium.blocks[blockKey];
        let comfort = Math.round(((b.foodLvl + b.merchLvl + b.toiletLvl) / 9) * 100);
        let maxExpansions = 5;
        let nextCost = Math.round(b.cost * (b.expansions + 1) * getStadiumCostScale());
        // Bugfix: Fressbude/Merch-Stand/Toiletten zeigten bisher feste, längst veraltete
        // Preise (15.000/12.000/10.000 €) ohne jede Liga-Skalierung, UND es fehlte jede
        // Erklärung, was der Ausbau überhaupt bringt - nur ein abstrakter "Wohlfühlfaktor %".
        let scale = getStadiumCostScale();
        let foodCost = Math.max(50000, Math.round(15000 * scale * 20));
        let merchCost = Math.max(40000, Math.round(12000 * scale * 20));
        let toiletCost = Math.max(35000, Math.round(10000 * scale * 20));
        let box = document.getElementById('stadium-action-box');
        box.innerHTML = `
            <div style="font-size:12px; font-weight:bold; color:var(--accent);">${b.name} (${b.cap.toLocaleString()} Plätze)</div>
            <div>Wohlfühlfaktor: <strong style="color:var(--primary);">${comfort}%</strong> <span style="font-size:8px; color:var(--text-muted);">(wirkt sich stadionweit leicht auf die Zuschauerzahl aus)</span></div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:3px; margin:4px 0;">
                <button onclick="upgradeBlockInfra('${blockKey}', 'foodLvl', ${foodCost})" class="btn-secondary" style="font-size:9px;" ${b.foodLvl>=3?'disabled':''}>🌭 Fressbude [${b.foodLvl}/3]<br>${b.foodLvl>=3?'Max. ✓':formatVal(foodCost)}<br><span style="font-size:8px; color:var(--text-muted);">+Komfort → mehr Zuschauer</span></button>
                <button onclick="upgradeBlockInfra('${blockKey}', 'merchLvl', ${merchCost})" class="btn-secondary" style="font-size:9px;" ${b.merchLvl>=3?'disabled':''}>👕 Merch-Stand [${b.merchLvl}/3]<br>${b.merchLvl>=3?'Max. ✓':formatVal(merchCost)}<br><span style="font-size:8px; color:var(--text-muted);">+5% Fanartikel-Absatz</span></button>
                <button onclick="upgradeBlockInfra('${blockKey}', 'toiletLvl', ${toiletCost})" class="btn-secondary" style="font-size:9px;" ${b.toiletLvl>=3?'disabled':''}>🚻 Toiletten [${b.toiletLvl}/3]<br>${b.toiletLvl>=3?'Max. ✓':formatVal(toiletCost)}<br><span style="font-size:8px; color:var(--text-muted);">+Komfort → mehr Zuschauer</span></button>
            </div>
            <button onclick="expandBlock('${blockKey}', ${b.addSeats}, ${nextCost})" class="btn-action" style="margin-top:2px;" ${b.expansions >= maxExpansions ? 'disabled' : ''}>
                ${b.expansions >= maxExpansions ? `Maximaler Ausbau erreicht (${maxExpansions}/${maxExpansions}) ✓` : `+${b.addSeats.toLocaleString()} Plätze ausbauen (${b.expansions}/${maxExpansions}) [${formatVal(nextCost)}]`}
            </button>
        `;
    }

    function upgradeBlockInfra(blockKey, infraKey, cost) {
        let b = stadium.blocks[blockKey];
        if (b[infraKey] >= 3) { showToast('Maximalstufe erreicht - hier ist kein weiterer Ausbau möglich.', 'error', 4000); return; }
        let labels = { foodLvl: 'Gastronomie', merchLvl: 'Fanshop', toiletLvl: 'Sanitär' };
        queueStadiumConstruction('blockInfra', { blockKey, infraKey }, cost, getConstructionDays(cost), `${b.name}: ${labels[infraKey]}-Ausbau`);
        selectStadiumBlock(blockKey);
    }

    function expandBlock(blockKey, seats, cost) {
        let b = stadium.blocks[blockKey];
        if (b.expansions >= 5) { showToast('Dieser Block hat die maximale Ausbaustufe erreicht.', 'error', 4000); return; }
        queueStadiumConstruction('blockExpand', { blockKey, seats }, cost, getConstructionDays(cost), `Rangerweiterung ${blockKey} (+${seats} Plätze)`);
    }

    function upgradeSpecialInstall(key, cost) {
        if (stadium[key]) return;
        let labels = { flutlicht: 'Flutlichtanlage', rasenheizung: 'Rasenheizung', videowalls: 'Digitale Anzeigen', dach: 'Stadiondach' };
        queueStadiumConstruction('specialInstall', { key }, cost, getConstructionDays(cost), labels[key] || key);
    }

    // ==========================================
    // STADION-BAUSTELLEN-SYSTEM (NEU): Anzahlung + Restzahlung + echte Bauzeit
    // ==========================================
    // Bisher wurde JEDER Stadion-Ausbau (Ränge, Infrastruktur, Flutlicht/Dach/etc.) sofort
    // und vollständig bezahlt UND sofort wirksam - realitätsfern für ein Bauprojekt dieser
    // Größenordnung. Jetzt: 30% Anzahlung sofort fällig, Rest bei Fertigstellung, echte
    // Bauzeit in Spieltagen (je teurer, desto länger), mit sichtbarem Baufortschritt.
    // Realistische Bauzeit (NEU): reale deutsche Bauprojekte dieser Größenordnung dauern
    // Monate bis Jahre, nicht ein paar Tage. Ein kleines Vorhaben (~250.000 €, z.B. eine
    // Fan-Kneipen-Renovierung) braucht real ca. 2-3 Monate inkl. Genehmigungen, ein
    // Millionenprojekt eher 1-2 Jahre, ein zweistelliger Millionenbetrag (große Tribüne,
    // Komplett-Überdachung) mehrere Jahre - genau wie beim echten Stadionbau. Bewusst kein
    // niedriger Deckel mehr, dafür ein sinnvoller Mindestwert für die kleinsten Vorhaben.
    function getConstructionDays(cost) {
        return Math.max(10, Math.round(cost / 400000));
    }
    function queueStadiumConstruction(type, params, totalCost, buildDays, label) {
        // Verhindert doppelte Baustellen für dieselbe Anlage, solange eine noch läuft.
        let alreadyQueued = (game.stadiumConstructionQueue || []).some(p => p.type === type && JSON.stringify(p.params) === JSON.stringify(params));
        if (alreadyQueued) { showToast('Für diese Anlage läuft bereits eine Baustelle!', 'error'); return; }
        // Voll bezahlt wird beim Auftrag, nicht erst bei Fertigstellung: die frühere
        // 30%-Anzahlung mit Restzahlung am Bauende führte dazu, dass man Projekte in
        // Auftrag geben konnte, die man sich gar nicht leisten kann - die Restzahlung
        // riss das Konto dann bei Fertigstellung ins Minus.
        if (game.money < totalCost) {
            showToast(`Baukosten nicht gedeckt: ${formatVal(game.money)} auf dem Konto, ${formatVal(totalCost)} nötig (es fehlen ${formatVal(totalCost - game.money)}).`, 'error', 5000);
            return;
        }
        playSound('click');
        game.money -= totalCost;
        if (type !== 'campusBuilding' && type !== 'realEstate' && type !== 'staffTraining') stadium.totalInvested = (stadium.totalInvested || 0) + totalCost;
        game.stadiumConstructionQueue.push({ type, params, totalCost, downPayment: totalCost, remainingPayment: 0, daysLeft: buildDays, totalDays: buildDays, label });
        addInboxMessage('vertrag', `🏗️ Bauprojekt gestartet: ${label}`, `${formatVal(totalCost)} wurden vollständig bezahlt. Fertigstellung in ${buildDays} Spieltagen - danach keine weiteren Kosten.`, 'screen-stadium');
        showToast(`🏗️ Baustelle eröffnet: ${label} (fertig in ${buildDays} SpT)`, 'success');
        // Bugfix: aktualisierte bisher immer nur den Stadion-Screen, auch wenn die Baustelle
        // vom CAMPUS-Screen aus eröffnet wurde - dort blieb die neue Baustelle unsichtbar,
        // bis man den Screen verlassen und neu geöffnet hat.
        if (type === 'campusBuilding' && typeof renderCampusView === 'function') renderCampusView();
        else renderStadiumView();
        updateUI();
    }
    // Wird jeden Spieltag aufgerufen: zählt alle Baustellen herunter und wendet den Effekt
    // bei Fertigstellung an (inkl. Restzahlung - kann bei Zahlungsproblemen ins Minus gehen,
    // genau wie andere Ausgaben auch, statt das Projekt einfach verschwinden zu lassen).
    function tickStadiumConstruction() {
        if (!game.stadiumConstructionQueue || game.stadiumConstructionQueue.length === 0) return;
        let stillActive = [];
        game.stadiumConstructionQueue.forEach(proj => {
            proj.daysLeft--;
            if (proj.daysLeft > 0) { stillActive.push(proj); return; }
            game.money -= proj.remainingPayment;
            if (proj.type === 'blockExpand') {
                stadium.totalInvested = (stadium.totalInvested || 0) + proj.remainingPayment;
                let b = stadium.blocks[proj.params.blockKey];
                if (b) { b.cap += proj.params.seats; b.expansions++; }
            } else if (proj.type === 'blockInfra') {
                stadium.totalInvested = (stadium.totalInvested || 0) + proj.remainingPayment;
                let b = stadium.blocks[proj.params.blockKey];
                if (b) b[proj.params.infraKey] = Math.min(3, b[proj.params.infraKey] + 1);
            } else if (proj.type === 'specialInstall') {
                stadium.totalInvested = (stadium.totalInvested || 0) + proj.remainingPayment;
                stadium[proj.params.key] = true;
            } else if (proj.type === 'campusBuilding') {
                // Campus-Gebäude (NEU): eigener Baustellen-Typ, fließt bewusst NICHT in
                // stadium.totalInvested ein (das ist eine separate Investitionsart).
                let b = campusBuildings[proj.params.key];
                if (b) {
                    b.lvl++;
                    // Vereinsmuseum: "+2% Vorstands- und Fanvertrauen dauerhaft pro Stufe" -
                    // jetzt korrekt erst bei tatsächlicher Fertigstellung wirksam.
                    if (proj.params.key === 'museum' && typeof boostFanBaseFloor === 'function') {
                        boostFanBaseFloor(2, 'Der Ausbau des Vereinsmuseums');
                    }
                }
            } else if (proj.type === 'realEstate' && typeof realEstatePortfolio !== 'undefined') {
                // Immobilien-Portfolio (NEU): eigener Baustellen-Typ, ebenfalls getrennt von
                // stadium.totalInvested (separates Investitionsvehikel).
                let re = realEstatePortfolio[proj.params.key];
                if (re) { re.owned = true; re.lvl++; }
            } else if (proj.type === 'staffTraining' && typeof ensureStaffMeta === 'function') {
                // Personal-Weiterbildung (NEU): eigener, kürzerer Baustellen-Typ für
                // Schulungen statt Bauprojekte - ebenfalls getrennt von stadium.totalInvested.
                let meta = ensureStaffMeta(proj.params.key);
                meta.level++;
                if (typeof staffMembers !== 'undefined' && staffMembers[proj.params.key]) {
                    addInboxMessage('vertrag', `⭐ Weiterbildung abgeschlossen: ${staffMembers[proj.params.key].name}`, `Jetzt auf Ausbaustufe ${meta.level}.`, 'screen-staff');
                }
            } else if (proj.type === 'stadiumUpgrade' && typeof STADIUM_UPGRADES !== 'undefined') {
                // 20 neue Stadion-Erweiterungen (NEU): schalten sich beim Bau-Abschluss frei.
                if (!stadium.upgrades) stadium.upgrades = {};
                stadium.upgrades[proj.params.key] = true;
                let u = STADIUM_UPGRADES[proj.params.key];
                if (u.category === 'fans' && typeof boostFanBaseFloor === 'function') {
                    boostFanBaseFloor(getStadiumFanBonusOnce(proj.params.key), `Der Bau von "${u.name}"`);
                }
                addInboxMessage('vertrag', `🏗️ Stadion-Erweiterung fertig: ${u.name}!`, u.desc, 'screen-stadium');
            } else if (proj.type === 'youthAcademyLvl') {
                // Jugendakademie-Ausbau (NEU): jetzt mit echter Bauzeit statt Sofort-Ausbau.
                game.youthAcademyLvl++;
                addInboxMessage('vertrag', '🎓 Jugendakademie ausgebaut!', `Die Nachwuchsakademie ist jetzt auf Stufe ${game.youthAcademyLvl} - bessere Talente und höheres Potenzial bei künftigen Sichtungen.`, 'screen-youth');
            } else if (proj.type === 'youthCapacity') {
                // Jugendkader-Kapazität (NEU): jetzt mit echter Bauzeit statt Sofort-Ausbau.
                game.youthCapacityBonus = (game.youthCapacityBonus || 0) + 1;
                addInboxMessage('vertrag', '🏠 Jugendkader-Kapazität erweitert!', `Platz für jetzt ${getYouthAcademyCapacity()} Nachwuchsspieler in der Akademie.`, 'screen-youth');
            }
            game.boardSat = Math.min(100, game.boardSat + 2);
            addInboxMessage('vertrag', `🏗️ Bauprojekt fertiggestellt: ${proj.label}!`,
                (proj.remainingPayment > 0
                    ? `Die Bauarbeiten sind abgeschlossen, die offene Restzahlung von ${formatVal(proj.remainingPayment)} wurde beglichen.`
                    : `Die Bauarbeiten sind abgeschlossen - bezahlt wurde bereits bei Auftragserteilung (${formatVal(proj.totalCost)}).`)
                + ' Der Effekt ist ab sofort wirksam.', 'screen-stadium');
        });
        game.stadiumConstructionQueue = stillActive;
    }
    // Parametrisiert (NEU): kann sowohl alle Baustellen zeigen (Stadion-Screen) als auch nur
    // eine bestimmte Projektart filtern (z.B. nur Campus-Gebäude auf dem Campus-Screen),
    // damit dort nicht irrelevante Stadion-Baustellen mit auftauchen.
    function renderStadiumConstructionBox(targetBoxId = 'stadium-construction-box', filterType = null) {
        let box = document.getElementById(targetBoxId);
        if (!box) return;
        let queue = (game.stadiumConstructionQueue || []).filter(p => !filterType || p.type === filterType);
        if (queue.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Keine laufenden Bauprojekte.</div>'; return; }
        box.innerHTML = queue.map(proj => {
            let segments = Array.from({ length: proj.totalDays }, (_, i) => i < (proj.totalDays - proj.daysLeft));
            return `<div class="box" style="display:flex; align-items:center; gap:10px; padding:8px;">
                <div style="min-width:40px; text-align:center;">
                    <div style="font-size:20px; font-weight:900; color:var(--accent); line-height:1;">${proj.daysLeft}</div>
                    <div style="font-size:8px; color:var(--text-muted); text-transform:uppercase;">SpT übrig</div>
                </div>
                <div style="flex:1;">
                    <div style="font-size:10px; margin-bottom:4px;">🏗️ ${proj.label}</div>
                    <div style="display:flex; gap:2px;">${segments.map(done => `<div style="flex:1; height:10px; border-radius:2px; background:${done ? 'var(--accent)' : 'rgba(228,197,140,0.15)'};"></div>`).join('')}</div>
                    <div style="font-size:8px; color:var(--text-muted); margin-top:3px;">${proj.remainingPayment > 0 ? `Restzahlung bei Fertigstellung: ${formatVal(proj.remainingPayment)}` : `Vollständig bezahlt: ${formatVal(proj.totalCost)}`}</div>
                </div>
            </div>`;
        }).join('');
    }


    // Liga-abhängige Zuschauer-OBERGRENZE (Anteil der Stadionkapazität, der bei
    // durchschnittlicher Fan-Stimmung realistisch ausgelastet wird): Ein Landesliga-Klub
    // füllt sein Stadion nicht annähernd wie ein Bundesligist, selbst bei guter Stimmung.
    // Vorher fehlte diese Deckelung komplett, wodurch ein einziges Heimspiel in der
    // untersten Liga ~169.000 € Ticketeinnahmen produzieren konnte (Bundesliga-Zuschauer-
    // zahlen bei Amateur-Ticketpreisen).
    const LEAGUE_ATTENDANCE_CEILING = [0.90, 0.60, 0.32, 0.14, 0.06, 0.025];

    // ABSOLUTE Obergrenze je Liga. Die Zuschauerzahl war bisher ausschliesslich ein ANTEIL
    // der Stadionkapazitaet - wer also baute, bekam mehr Zuschauer, egal in welcher Liga.
    // In der Oberliga fuehrte ein auf 113.000 Plaetze ausgebautes Stadion so zu ueber 10.000
    // Zuschauern im Ligaalltag und fast 23.000 im Derby (vom Nutzer im Spiel gemeldet).
    //
    // Das Interesse an einem Verein haengt aber an seiner Liga und seinem Anhang, nicht an
    // der Zahl der gebauten Sitze. Real kommen in die Oberliga einige hundert bis wenige
    // tausend Menschen - auch wenn zufaellig ein grosses Stadion herumsteht. Die Werte
    // orientieren sich an den tatsaechlichen Zuschauerschnitten der deutschen Ligen.
    const LEAGUE_MAX_ATTENDANCE = [75000, 45000, 18000, 7000, 2800, 1000];

    function getLeagueAttendanceCap(boostMult = 1) {
        let basis = LEAGUE_MAX_ATTENDANCE[game.leagueLevel] ?? LEAGUE_MAX_ATTENDANCE[LEAGUE_MAX_ATTENDANCE.length - 1];
        // Der Anhang waechst mit der Fan-Zufriedenheit: ein geliebter Verein zieht in
        // derselben Liga deutlich mehr Menschen an als ein ungeliebter.
        let anhang = 0.35 + (Math.max(0, Math.min(100, game.fans)) / 100) * 0.65;
        // Ein Derby oder Pokalabend steigert das Interesse, aber nicht im selben Masse wie
        // die Auslastung eines ohnehin gut besuchten Stadions: Der Anhang eines Vereins
        // verdoppelt sich nicht ueber Nacht. Der Bonus wirkt hier deshalb gedaempft, sonst
        // waere die absolute Grenze bei genau den Spielen wirkungslos, fuer die sie gedacht
        // ist.
        let gedaempfterBoost = 1 + (boostMult - 1) * 0.6;
        return Math.round(basis * anhang * gedaempfterBoost);
    }

    // Einzige Stelle, an der die Zuschauerzahl eines Heimspiels entsteht. Vorher stand die
    // Rechnung doppelt im Code (Anpfiff im Live-Spiel und Spieltagsabrechnung) und musste
    // von Hand synchron gehalten werden.
    function calculateMatchAttendance(boostMult = 1, noise = 1) {
        let kapazitaet = stadium.total || 16000;
        let ausKapazitaet = Math.round(kapazitaet * Math.min(1.0, getAttendanceFactor() * boostMult) * noise);
        return Math.max(0, Math.min(kapazitaet, ausKapazitaet, getLeagueAttendanceCap(boostMult)));
    }

    // Preis-Nachfrage-Zusammenhang für Tickets (NEU): bisher hatte der Ticketpreis KEINERLEI
    // Einfluss auf die Zuschauerzahl - nur auf den Erlös pro Ticket. Jetzt wirkt sich ein zu
    // hoher Preis auch spürbar auf die Auslastung aus, ein günstiger Preis lockt mehr Fans.
    // Nutzt dieselbe Elastizitäts-Logik wie die Fanartikel-Preise (siehe calculateElasticity()).
    function getMarketTicketPrice(category) {
        let leagueMult = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let base = { steh: 12, sitz: 24, vip: 80 }[category] || 12;
        return Math.round(base * leagueMult);
    }
    function getTicketPriceElasticityFactor() {
        let stehEl = calculateElasticity(game.ticketPrices.steh, getMarketTicketPrice('steh'));
        let sitzEl = calculateElasticity(game.ticketPrices.sitz, getMarketTicketPrice('sitz'));
        let vipEl = calculateElasticity(game.ticketPrices.vip, getMarketTicketPrice('vip'));
        // Gedämpft (0.4-Gewichtung), damit ein Ausreißer die Zuschauerzahl nicht komplett
        // verzerrt - der Ticketpreis ist nur einer von mehreren Einflussfaktoren.
        let weighted = stehEl.factor * 0.5 + sitzEl.factor * 0.45 + vipEl.factor * 0.05;
        return 1 + (weighted - 1) * 0.4;
    }

    function getAttendanceFactor() {
        let totalComfort = 0;
        Object.values(stadium.blocks || {}).forEach(b => { totalComfort += (b.foodLvl + b.merchLvl + b.toiletLvl) / 9; });
        let avgComfortBonus = 0.9 + (totalComfort / 8) * 0.2;
        // Digitale Anzeigen (Videowalls): sorgen für Stimmung und Unterhaltung im Stadion und
        // geben einen kleinen zusätzlichen Komfort-Bonus, unabhängig von den Block-Ausbauten.
        if (stadium.videowalls) avgComfortBonus += 0.05;
        // Stadion-Erweiterungen (NEU): WLAN/Sanitär/ÖPNV-Anbindung erhöhen den Komfort weiter.
        if (typeof getStadiumComfortBonus === 'function') avgComfortBonus += getStadiumComfortBonus();
        // Parkhaus & Shuttle-Bahnhof (Campus): erleichtert die Anreise und verbessert dadurch
        // die Stadionauslastung spürbar (war bisher nur Text ohne tatsächliche Wirkung).
        if (campusBuildings.parkhaus?.lvl > 0) avgComfortBonus += campusBuildings.parkhaus.lvl * 0.015;
        // Wetterabhängige Zuschauerzahlen (NEU): bei schlechtem Wetter bleiben spürbar mehr
        // Fans zu Hause - besonders bei Sturm.
        if (typeof currentWeather !== 'undefined' && currentWeather.attendanceMult) avgComfortBonus *= currentWeather.attendanceMult;
        // Aktuelle Form (NEU): eine laufende Siegesserie zieht spürbar mehr Zuschauer an,
        // eine Pleitenserie schreckt Fans ab - genau wie im echten Fußball üblich.
        let ourTeamObj = leaguesData[game.leagueLevel]?.find(t => t.name === game.clubName);
        if (ourTeamObj && Array.isArray(ourTeamObj.recentForm) && ourTeamObj.recentForm.length > 0) {
            let formScore = ourTeamObj.recentForm.reduce((s, r) => s + (r === 'W' ? 1 : (r === 'L' ? -1 : 0)), 0);
            avgComfortBonus += formScore * 0.02; // bis zu ±10% bei 5/5 Siegen bzw. Niederlagen
        }
        // Publikumsliebling (NEU): steht der amtierende Publikumsliebling in der aktuellen
        // Startelf, kommen zusätzliche Fans gezielt, um ihn spielen zu sehen.
        if (typeof lineup !== 'undefined' && Array.isArray(lineup) && squad.some(p => p.isCrowdFavorite && lineup.includes(p.id))) {
            avgComfortBonus += 0.04;
        }
        // rawFactor bleibt die reine Fan-Stimmungs-/Komfort-Kennzahl (0.3-1.2, "1.0" = Standard
        // bei 100% Fans ohne Komfort-Bonus). Die Liga-Obergrenze skaliert diese Kennzahl dann
        // auf einen realistischen Auslastungsanteil der Stadionkapazität herunter.
        let rawFactor = Math.max(0.3, Math.min(1.2, (game.fans / 100) * avgComfortBonus * getTicketPriceElasticityFactor()));
        let ceiling = LEAGUE_ATTENDANCE_CEILING[game.leagueLevel] ?? LEAGUE_ATTENDANCE_CEILING[LEAGUE_ATTENDANCE_CEILING.length - 1];
        return ceiling * (rawFactor / 0.75);
    }

