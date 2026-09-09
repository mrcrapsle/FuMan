    // ---------- STADIONNAME & NAMENSRECHTE ----------
    // Stadion-Kostenskalierung (NEU): deutlich steiler als der generische Liga-Faktor, damit
    // ein Kreisligist sich keine Bundesliga-Arena leisten muss, ein Spitzenklub aber echte
    // zweistellige Millionenbeträge zahlt (wie in der Realität) - Index = leagueLevel
    // (0 = höchste Liga).
    const STADIUM_COST_SCALE = [1.0, 0.55, 0.28, 0.14, 0.07, 0.035];
    function getStadiumCostScale() {
        return STADIUM_COST_SCALE[game.leagueLevel] ?? 0.035;
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
                let sorted = [...teams].sort((a, b) => b.points - a.points);
                let myRank = sorted.findIndex(t => t.name === "Lok Leipzig") + 1;
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
        `;
        renderAttendanceChart('stadium-attendance-chart-box');
    }

    // Spezial-Installationen: deutlich realistischere Basiskosten (NEU), skaliert mit der
    // Liga-Stärke - eine Komplett-Überdachung kostet im Spitzenfußball echte zweistellige
    // Millionenbeträge, nicht ein paar hunderttausend Euro.
    const SPECIAL_INSTALL_BASE_COSTS = { flutlicht: 3500000, rasenheizung: 2200000, videowalls: 4000000, dach: 28000000 };
    const SPECIAL_INSTALL_LABELS = { flutlicht: '💡 Flutlicht-Masten', rasenheizung: '🔥 Rasenheizung', videowalls: '📺 Digitale Anzeigen / HD-Videowalls', dach: '🏗️ Komplett-Überdachung' };
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
        renderStadiumConstructionBox();
        renderStadiumKeyFigures();
        renderSpecialInstallsGrid();
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
                <button onclick="upgradeBlockInfra('${blockKey}', 'foodLvl', ${foodCost})" class="btn-secondary" style="font-size:9px;" ${b.foodLvl>=3?'disabled':''}>🌭 Fressbude [${b.foodLvl}/3]<br>${b.foodLvl>=3?'Max. ✓':formatVal(foodCost)}<br><span style="font-size:7px; color:var(--text-muted);">+Komfort → mehr Zuschauer</span></button>
                <button onclick="upgradeBlockInfra('${blockKey}', 'merchLvl', ${merchCost})" class="btn-secondary" style="font-size:9px;" ${b.merchLvl>=3?'disabled':''}>👕 Merch-Stand [${b.merchLvl}/3]<br>${b.merchLvl>=3?'Max. ✓':formatVal(merchCost)}<br><span style="font-size:7px; color:var(--text-muted);">+5% Fanartikel-Absatz</span></button>
                <button onclick="upgradeBlockInfra('${blockKey}', 'toiletLvl', ${toiletCost})" class="btn-secondary" style="font-size:9px;" ${b.toiletLvl>=3?'disabled':''}>🚻 Toiletten [${b.toiletLvl}/3]<br>${b.toiletLvl>=3?'Max. ✓':formatVal(toiletCost)}<br><span style="font-size:7px; color:var(--text-muted);">+Komfort → mehr Zuschauer</span></button>
            </div>
            <button onclick="expandBlock('${blockKey}', ${b.addSeats}, ${nextCost})" class="btn-action" style="margin-top:2px;" ${b.expansions >= maxExpansions ? 'disabled' : ''}>
                ${b.expansions >= maxExpansions ? `Maximaler Ausbau erreicht (${maxExpansions}/${maxExpansions}) ✓` : `+${b.addSeats.toLocaleString()} Plätze ausbauen (${b.expansions}/${maxExpansions}) [${formatVal(nextCost)}]`}
            </button>
        `;
    }

    function upgradeBlockInfra(blockKey, infraKey, cost) {
        let b = stadium.blocks[blockKey];
        if (b[infraKey] >= 3) { alert("Maximalstufe erreicht!"); return; }
        let labels = { foodLvl: 'Gastronomie', merchLvl: 'Fanshop', toiletLvl: 'Sanitär' };
        queueStadiumConstruction('blockInfra', { blockKey, infraKey }, cost, getConstructionDays(cost), `${b.name}: ${labels[infraKey]}-Ausbau`);
        selectStadiumBlock(blockKey);
    }

    function expandBlock(blockKey, seats, cost) {
        let b = stadium.blocks[blockKey];
        if (b.expansions >= 5) { alert("Dieser Block hat die maximale Ausbaustufe erreicht!"); return; }
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
        let downPayment = Math.round(totalCost * 0.3);
        if (game.money < downPayment) { showToast(`Nicht genug Geld für die Anzahlung! Benötigt: ${formatVal(downPayment)}`, 'error'); return; }
        playSound('click');
        game.money -= downPayment;
        if (type !== 'campusBuilding' && type !== 'realEstate') stadium.totalInvested = (stadium.totalInvested || 0) + downPayment;
        game.stadiumConstructionQueue.push({ type, params, totalCost, downPayment, remainingPayment: totalCost - downPayment, daysLeft: buildDays, totalDays: buildDays, label });
        addInboxMessage('vertrag', `🏗️ Bauprojekt gestartet: ${label}`, `Anzahlung von ${formatVal(downPayment)} geleistet. Fertigstellung in ${buildDays} Spieltagen, Restzahlung dann ${formatVal(totalCost - downPayment)}.`, 'screen-stadium');
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
            }
            game.boardSat = Math.min(100, game.boardSat + 2);
            addInboxMessage('vertrag', `🏗️ Bauprojekt fertiggestellt: ${proj.label}!`, `Die Bauarbeiten sind abgeschlossen, Restzahlung von ${formatVal(proj.remainingPayment)} beglichen. Der Effekt ist ab sofort wirksam.`, 'screen-stadium');
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
                    <div style="font-size:7px; color:var(--text-muted); text-transform:uppercase;">SpT übrig</div>
                </div>
                <div style="flex:1;">
                    <div style="font-size:10px; margin-bottom:4px;">🏗️ ${proj.label}</div>
                    <div style="display:flex; gap:2px;">${segments.map(done => `<div style="flex:1; height:10px; border-radius:2px; background:${done ? 'var(--accent)' : 'rgba(228,197,140,0.15)'};"></div>`).join('')}</div>
                    <div style="font-size:8px; color:var(--text-muted); margin-top:3px;">Restzahlung bei Fertigstellung: ${formatVal(proj.remainingPayment)}</div>
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
        // Parkhaus & Shuttle-Bahnhof (Campus): erleichtert die Anreise und verbessert dadurch
        // die Stadionauslastung spürbar (war bisher nur Text ohne tatsächliche Wirkung).
        if (campusBuildings.parkhaus?.lvl > 0) avgComfortBonus += campusBuildings.parkhaus.lvl * 0.015;
        // Wetterabhängige Zuschauerzahlen (NEU): bei schlechtem Wetter bleiben spürbar mehr
        // Fans zu Hause - besonders bei Sturm.
        if (typeof currentWeather !== 'undefined' && currentWeather.attendanceMult) avgComfortBonus *= currentWeather.attendanceMult;
        // rawFactor bleibt die reine Fan-Stimmungs-/Komfort-Kennzahl (0.3-1.2, "1.0" = Standard
        // bei 100% Fans ohne Komfort-Bonus). Die Liga-Obergrenze skaliert diese Kennzahl dann
        // auf einen realistischen Auslastungsanteil der Stadionkapazität herunter.
        let rawFactor = Math.max(0.3, Math.min(1.2, (game.fans / 100) * avgComfortBonus * getTicketPriceElasticityFactor()));
        let ceiling = LEAGUE_ATTENDANCE_CEILING[game.leagueLevel] ?? LEAGUE_ATTENDANCE_CEILING[LEAGUE_ATTENDANCE_CEILING.length - 1];
        return ceiling * (rawFactor / 0.75);
    }
