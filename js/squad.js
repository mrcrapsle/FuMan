
// ==========================================
// KADER-INITIALISIERUNG
// ==========================================
    function initDefaultSquad() {
        // Basisstärke an die neue unterste Liga (6. Liga/Landesliga, ~32-37) angepasst,
        // damit der Amateurklub am Anfang wirklich um jeden Punkt kämpfen muss.
        squad = [
            createPlayer("TW", 36, 41, "Elfmeter-Killer"), createPlayer("TW", 30, 34),
            createPlayer("ABW", 37, 42, "Eisenfuß"), createPlayer("ABW", 36, 41), createPlayer("ABW", 34, 39), createPlayer("ABW", 32, 37), createPlayer("ABW", 30, 35), createPlayer("ABW", 29, 34),
            createPlayer("MIT", 37, 43, "Leader"), createPlayer("MIT", 36, 41, "Freistoß-Gott"), createPlayer("MIT", 34, 39), createPlayer("MIT", 32, 37), createPlayer("MIT", 30, 35), createPlayer("MIT", 29, 34),
            createPlayer("ST", 38, 44, "Tor-Instinkt"), createPlayer("ST", 36, 41), createPlayer("ST", 32, 37), createPlayer("ST", 30, 35)
        ];
        game.captainId = squad[8].id;
        game.penaltyTakerId = squad[14].id;
        game.freeKickTakerId = squad[9].id;
        game.cornerTakerId = squad[9].id;
        autoLineup();
    }

    // Wie initDefaultSquad(), aber auf ein BELIEBIGES Liganiveau skaliert statt fest auf die
    // unterste Liga - wird für switchToClub() (career.js) gebraucht: KI-Vereine in
    // leaguesData haben keinen echten Kader zum "Erben" (nur Name+Stärke+Tabellenstand), ein
    // Vereinswechsel in eine höhere Liga bekommt hier stattdessen einen frischen, zum
    // Niveau passenden Kader nach demselben Muster (82 - Liganiveau*10) wie die KI-Stärke.
    function generateSquadForLevel(level) {
        let base = Math.max(25, 82 - level * 10);
        let mk = (pos, delta, trait) => createPlayer(pos, Math.max(20, base - 6 + delta), base + 8 + delta, trait || null);
        return [
            mk("TW", 6, "Elfmeter-Killer"), mk("TW", 0),
            mk("ABW", 6, "Eisenfuß"), mk("ABW", 5), mk("ABW", 3), mk("ABW", 1), mk("ABW", -1), mk("ABW", -2),
            mk("MIT", 7, "Leader"), mk("MIT", 5, "Freistoß-Gott"), mk("MIT", 3), mk("MIT", 1), mk("MIT", -1), mk("MIT", -2),
            mk("ST", 8, "Tor-Instinkt"), mk("ST", 5), mk("ST", 1), mk("ST", -1)
        ];
    }

    const PLAYER_ROLES = {
        TW: [
            { id: 'abwehrtorwart', name: 'Abwehr-Torwart', statKey: 'defense' },
            { id: 'spielaufbau', name: 'Spielaufbau-Torwart', statKey: 'passing' }
        ],
        ABW: [
            { id: 'manndecker', name: 'Manndecker', statKey: 'defense' },
            { id: 'ballspielend', name: 'Ballspielender Verteidiger', statKey: 'passing' },
            { id: 'ueberlaeufer', name: 'Überlaufender Verteidiger', statKey: 'pace' }
        ],
        MIT: [
            { id: 'boxtobox', name: 'Box-to-Box', statKey: 'physique' },
            { id: 'regisseur', name: 'Regisseur', statKey: 'passing' },
            { id: 'wassertraeger', name: 'Wasserträger', statKey: 'defense' },
            { id: 'antreiber', name: 'Antreiber', statKey: 'pace' }
        ],
        ST: [
            { id: 'vollstrecker', name: 'Vollstrecker', statKey: 'shooting' },
            { id: 'falscheneun', name: 'Falsche Neun', statKey: 'passing' },
            { id: 'wandspieler', name: 'Wandspieler', statKey: 'physique' },
            { id: 'tempodribbler', name: 'Tempodribbler', statKey: 'pace' }
        ]
    };

    function getRolesForPosition(pos) {
        return PLAYER_ROLES[pos] || [];
    }

    function setPlayerRole(playerId, roleId) {
        let p = squad.find(x => x.id === playerId);
        if (p) { p.role = roleId || null; renderSquadView(); }
    }

    function calcRoleFitSummary() {
        let fit = 0, total = 0;
        lineup.forEach(pid => {
            let p = squad.find(x => x.id === pid);
            if (!p || !p.role) return;
            total++;
            let roleDef = getRolesForPosition(p.pos).find(r => r.id === p.role);
            if (roleDef && (p[roleDef.statKey] || 0) >= p.strength) fit++;
        });
        return { fit, total };
    }

    // ---------- CO-TRAINER-KADERBERATUNG ----------
    // Bisher war der Co-Trainer nur fürs automatische Training zuständig (siehe
    // campus-staff.js) - jetzt gibt er zusätzlich echte Aufstellungs-Empfehlungen, wenn ein
    // Bankspieler auf derselben Position (nach Stärke × Fitness) stärker ist als der aktuelle
    // Stammspieler.
    function getCoTrainerAdvice() {
        if (!staffMembers.coTrainer.hired) return [];
        let effStr = p => p.strength * (p.fitness / 100);
        let suggestions = [];
        let usedBenchIds = new Set(); // verhindert, dass derselbe Bankspieler mehrfach vorgeschlagen wird
        lineup.forEach(starterId => {
            let starter = squad.find(p => p.id === starterId);
            if (!starter) return;
            let betterBench = squad.filter(p =>
                p.pos === starter.pos && !lineup.includes(p.id) && !usedBenchIds.has(p.id) &&
                (p.injured || 0) === 0 && (p.suspended || 0) === 0 && (p.nationalDuty || 0) === 0 &&
                effStr(p) > effStr(starter) + 3
            );
            if (betterBench.length > 0) {
                let best = betterBench.sort((a, b) => effStr(b) - effStr(a))[0];
                usedBenchIds.add(best.id);
                suggestions.push({ outId: starter.id, outName: starter.name, inId: best.id, inName: best.name, diff: Math.round(effStr(best) - effStr(starter)) });
            }
        });
        return suggestions;
    }

    function applyCoTrainerAdvice() {
        let suggestions = getCoTrainerAdvice();
        suggestions.forEach(s => {
            let idx = lineup.indexOf(s.outId);
            if (idx !== -1) lineup[idx] = s.inId;
        });
        playSound('click');
        renderSquadView();
        render3DPitch();
        showToast(`✅ ${suggestions.length} Empfehlung(en) des Co-Trainers übernommen!`, 'success');
    }

    function renderCoTrainerAdvice() {
        let box = document.getElementById('co-trainer-advice-box');
        if (!box) return;
        let suggestions = getCoTrainerAdvice();
        let hasSwaps = staffMembers.coTrainer.hired && suggestions.length > 0;
        let tacticalHtml = staffMembers.coTrainer.hired ? renderCoTrainerTacticalSuggestionHtml() : '';
        if (!hasSwaps && !tacticalHtml) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        // Co-Trainer-Historie: Erfolgsquote bei übernommenen Vorschlägen vs. eigenen
        // Entscheidungen, damit sich objektiv beurteilen lässt, ob sich das Vertrauen lohnt.
        let h = game.coTrainerHistory || { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 };
        let followedRate = h.followedMatches > 0 ? Math.round((h.followedWins / h.followedMatches) * 100) : null;
        let ownRate = h.ownMatches > 0 ? Math.round((h.ownWins / h.ownMatches) * 100) : null;
        let historyHtml = (h.followedMatches > 0 || h.ownMatches > 0) ? `
            <div class="box" style="font-size:10px; margin-top:6px;">
                <strong>📊 Co-Trainer-Historie:</strong><br>
                Vorschlag übernommen: ${h.followedWins}/${h.followedMatches} Siege${followedRate !== null ? ` (${followedRate}%)` : ''}<br>
                Eigene Entscheidung: ${h.ownWins}/${h.ownMatches} Siege${ownRate !== null ? ` (${ownRate}%)` : ''}
            </div>` : '';
        box.innerHTML = `
            ${hasSwaps ? `<div class="panel-header">🧑‍🏫 CO-TRAINER-EMPFEHLUNG</div>
            ${suggestions.map(s => `<div class="box" style="font-size:10px;">🔁 <strong>${s.inName}</strong> statt <strong>${s.outName}</strong> (${s.diff > 0 ? '+' : ''}${s.diff} eff. Stärke)</div>`).join('')}
            <button onclick="applyCoTrainerAdvice()" class="btn-primary" style="margin-top:6px; margin-bottom:10px;">✅ Alle Empfehlungen übernehmen</button>` : ''}
            ${tacticalHtml}
            ${historyHtml}
        `;
    }

    // ---------- ERWEITERTE CO-TRAINER-BERATUNG: FORMATIONS-/STIL-VORSCHLAG ----------
    // Analysiert die Kaderstärke nach Linien (Abwehr/Mittelfeld/Sturm) und Tempo, um eine
    // konkrete Formations- und Spielstil-Empfehlung mit Begründung abzugeben - inklusive
    // Vertrauens-Wert, der bei Annahme steigt und bei wiederholtem Ignorieren sinkt.
    function getCoTrainerTacticalSuggestion() {
        let avgByPos = pos => {
            let players = squad.filter(p => p.pos === pos);
            return players.length > 0 ? players.reduce((s, p) => s + p.strength, 0) / players.length : 55;
        };
        let avgDef = avgByPos('ABW'), avgAtt = avgByPos('ST');
        let avgPace = squad.length > 0 ? squad.reduce((s, p) => s + (p.pace || 60), 0) / squad.length : 60;

        // Selbstkritischer Co-Trainer: sinkt sein Vertrauen stark ab (wiederholt schlechte
        // eigene Bilanz), rät er statt gewagter Empfehlungen lieber zu einer vorsichtigen,
        // konservativen Standardlösung - er traut sich selbst nicht mehr viel zu.
        let trust = game.coTrainerTrust ?? 66;
        if (trust < 30) {
            return { formation: '4-4-2', style: 'ausgeglichen', reasoning: [
                'Nach den zuletzt enttäuschenden Ergebnissen will ich nichts riskieren.',
                'Formationsempfehlung: 4-4-2, ausgeglichen. Lieber solide als spektakulär, bis wieder mehr Sicherheit da ist.'
            ], selfCritical: true };
        }

        // Gegner-Bezug: kennt der Co-Trainer (via Chef-Analyst) die Stärke des nächsten
        // Gegners, fließt das mit ein - gegen einen deutlich stärkeren Gegner rät er zu einer
        // vorsichtigeren, kompakteren Ausrichtung statt der reinen Kaderanalyse zu folgen.
        let opponentNote = null;
        if (staffMembers.analyst.hired && typeof pendingMatchInfo !== 'undefined' && pendingMatchInfo && pendingMatchInfo.oppStr) {
            let ownAvgStrength = squad.length > 0 ? squad.reduce((s, p) => s + p.strength, 0) / squad.length : 55;
            let strDiff = pendingMatchInfo.oppStr - ownAvgStrength;
            if (strDiff > 10) {
                return { formation: '5-3-2', style: 'konter', reasoning: [
                    `Formationsempfehlung: 5-3-2. ${pendingMatchInfo.oppName || 'Der Gegner'} ist deutlich stärker einzuschätzen.`,
                    'Gegen ein derart favorisiertes Team lohnt sich eine kompakte, konterorientierte Ausrichtung.'
                ], opponentAware: true };
            } else if (strDiff < -10) {
                return { formation: '4-2-3-1', style: 'offensiv', reasoning: [
                    `Formationsempfehlung: 4-2-3-1. ${pendingMatchInfo.oppName || 'Der Gegner'} steht spürbar schwächer da.`,
                    'Gegen einen unterlegenen Gegner sollten wir das Spiel dominieren und früh die Entscheidung suchen.'
                ], opponentAware: true };
            }
        }

        if (avgDef > avgAtt + 8) {
            return { formation: '5-3-2', style: 'konter', reasoning: [
                'Formationsempfehlung: 5-3-2. Bombensichere Abwehr passt am besten zu diesem Kader.',
                'Unsere Stärke ist der Umschaltmoment - kompakt verteidigen, dann schnell nach vorn.'
            ]};
        } else if (avgAtt > avgDef + 8) {
            return { formation: '4-2-3-1', style: 'offensiv', reasoning: [
                'Formationsempfehlung: 4-2-3-1. Der Angriff ist klar die größte Stärke des Kaders.',
                'Mehr Personal nach vorn - ein Kader dieser Struktur entscheidet Spiele über Tore.'
            ]};
        } else if (avgPace > 75) {
            return { formation: '4-3-3', style: 'pressing', reasoning: [
                'Formationsempfehlung: 4-3-3. Das hohe Tempo im Kader spricht für frühes Pressing.',
                'Schnelligkeit lohnt sich besonders bei hohem Ballgewinn in gegnerischer Hälfte.'
            ]};
        }
        return { formation: '4-4-2', style: 'ausgeglichen', reasoning: [
            'Formationsempfehlung: 4-4-2. Ein ausgewogener Kader verträgt eine klassische Grundordnung.',
            'Ausgeglichener Ansatz ohne besondere Vor- oder Nachteile.'
        ]};
    }
    function renderCoTrainerTacticalSuggestionHtml() {
        let sugg = getCoTrainerTacticalSuggestion();
        let trust = game.coTrainerTrust ?? 66;
        let trustColor = trust >= 60 ? 'var(--primary)' : (trust >= 35 ? 'var(--accent)' : 'var(--danger)');
        return `
            <div class="panel-header">📋 TAKTIK-VORSCHLAG DES CO-TRAINERS${sugg.opponentAware ? ' <span style="font-size:9px; color:var(--teal);">🎥 gegnerbezogen</span>' : ''}${sugg.selfCritical ? ' <span style="font-size:9px; color:var(--danger);">😟 verunsichert</span>' : ''}</div>
            <div style="font-size:10px; margin-bottom:6px;">Vertrauen in seinen Rat</div>
            <div style="background:rgba(228,197,140,0.1); border-radius:4px; height:8px; margin-bottom:8px; overflow:hidden;">
                <div style="width:${trust}%; height:100%; background:${trustColor};"></div>
            </div>
            <div class="box" style="font-size:10px;">
                <strong>${sugg.formation}</strong> · <strong>${sugg.style}</strong><br>
                ${sugg.reasoning.map(r => `› ${r}`).join('<br>')}
            </div>
            <button onclick="applyCoTrainerTacticalSuggestion()" class="btn-action" style="margin-top:6px;">✅ Vorschlag übernehmen</button>
            <button onclick="rerollCoTrainerTacticalSuggestion()" class="btn-secondary">🔄 Nochmal fragen</button>
        `;
    }
    function applyCoTrainerTacticalSuggestion() {
        let sugg = getCoTrainerTacticalSuggestion();
        game.formation = sugg.formation;
        game.tacticStyle = sugg.style;
        autoLineup();
        game.coTrainerTrust = Math.min(100, (game.coTrainerTrust ?? 66) + 4);
        game.lastTacticWasCoTrainerSuggestion = true;
        renderSquadView();
        updateUI();
        showToast(`✅ Taktik-Vorschlag übernommen: ${sugg.formation} · ${sugg.style}`, 'success');
    }
    function rerollCoTrainerTacticalSuggestion() {
        // Wiederholtes Nachfragen ohne die Empfehlung zu übernehmen kostet etwas Vertrauen -
        // der Co-Trainer fühlt sich sonst ignoriert.
        game.coTrainerTrust = Math.max(10, (game.coTrainerTrust ?? 66) - 3);
        renderCoTrainerAdvice();
    }

    const ALL_FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-2-3-1', '4-1-4-1', '3-4-3', '5-4-1'];

    // Formations-Bewertungen (NEU): jede Formation hat eine Verteidigungs- und eine
    // Offensiv-Kennzahl, die echt in die Teamstärke einfließen (siehe getFormationBonus()
    // in match.js) - bisher hatte die Formation außer der reinen Spieler-Positionierung
    // keinerlei taktische Auswirkung.
    const FORMATION_RATINGS = {
        '4-4-2': { def: 60, off: 58 },
        '4-3-3': { def: 55, off: 72 },
        '3-5-2': { def: 62, off: 64 },
        '5-3-2': { def: 82, off: 46 },
        '4-2-3-1': { def: 64, off: 64 },
        '4-1-4-1': { def: 70, off: 52 },
        '3-4-3': { def: 48, off: 78 },
        '5-4-1': { def: 88, off: 34 }
    };

    // Vereinfachte 3x3-Punkt-Icons je Formation fürs Grid-Modal (rein dekorativ, zeigt die
    // grobe Linien-Verteilung: Reihe1=Abwehr, Reihe2=Mittelfeld, Reihe3=Sturm).
    const FORMATION_MINI_ICONS = {
        '4-4-2': [1,1,1,1, 1,1,1,1, 0,1,1,0],
        '4-3-3': [1,1,1,1, 0,1,1,1,0, 1,0,1],
        '3-5-2': [0,1,1,1,0, 1,1,1,1,1, 0,1,1,0],
        '5-3-2': [1,1,1,1,1, 0,1,1,1,0, 0,1,1,0],
        '4-2-3-1': [1,1,1,1, 0,1,1,0, 1,1,1, 0,1,0],
        '4-1-4-1': [1,1,1,1, 0,0,1,0,0, 1,1,1,1, 0,1,0],
        '3-4-3': [0,1,1,1,0, 1,1,1,1, 1,0,1],
        '5-4-1': [1,1,1,1,1, 1,1,1,1, 0,0,1,0,0]
    };

    function openFormationModal() {
        playSound('click');
        document.getElementById('formation-modal-overlay').classList.add('show');
        renderFormationModalList(game.formation);
    }
    function closeFormationModal() {
        document.getElementById('formation-modal-overlay').classList.remove('show');
    }
    let formationModalSelection = null;
    function renderFormationModalList(selected) {
        formationModalSelection = selected;
        let list = document.getElementById('formation-modal-list');
        list.innerHTML = ALL_FORMATIONS.map(f => {
            let dots = (FORMATION_MINI_ICONS[f] || []).slice(0, 9);
            while (dots.length < 9) dots.push(0);
            let dotHtml = dots.slice(0, 9).map(d => `<div style="background:${d ? 'var(--teal)' : 'rgba(255,255,255,0.12)'};"></div>`).join('');
            return `<div class="formation-grid-item ${f === selected ? 'active' : ''}" onclick="renderFormationModalList('${f}')">
                <div class="formation-mini-dots">${dotHtml}</div>
                <span>${f}</span>
            </div>`;
        }).join('');
        let coords = getFormationCoords(selected);
        let preview = document.getElementById('formation-preview-pitch');
        preview.innerHTML = coords.map(c => `<div class="formation-preview-dot" style="top:${c.top}%; left:${c.left}%;"></div>`).join('');
        document.getElementById('formation-modal-title').innerText = selected;
    }
    function confirmFormationModal() {
        if (formationModalSelection) setFormation(formationModalSelection);
        closeFormationModal();
    }

    // Taktikbrett-Statistikleiste (NEU): Gesamtstärke, Chemie, Ø Fitness und Ø Tagesform der
    // aktuellen Startelf auf einen Blick, wie im Referenz-Layout gewünscht.
    function renderTacticsBoardStatBar() {
        let box = document.getElementById('tactics-board-stat-bar');
        if (!box) return;
        let starting = squad.filter(p => lineup.includes(p.id));
        if (starting.length === 0) { box.innerHTML = ''; return; }
        let avgFitness = Math.round(starting.reduce((s, p) => s + p.fitness, 0) / starting.length);
        let avgForm = Math.round(starting.reduce((s, p) => s + (p.dailyForm ?? 50), 0) / starting.length);
        let chem = typeof getLineupChemistryStats === 'function' ? getLineupChemistryStats().percent : 0;
        let str = calcTeamStrength(true);
        box.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:4px; text-align:center;">
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">GESAMTSTÄRKE</div><div style="font-size:18px; font-weight:900; color:var(--accent);">${str}</div><div style="font-size:8px; color:var(--text-muted);">${starting.length} / 11 besetzt</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">CHEMIE</div><div style="font-size:18px; font-weight:900; color:var(--teal);">${chem}%</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">Ø FITNESS</div><div style="font-size:18px; font-weight:900; color:${avgFitness>=70?'var(--primary)':'var(--danger)'};">${avgFitness}%</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">Ø FORM</div><div style="font-size:18px; font-weight:900; color:${avgForm>=55?'var(--primary)':(avgForm>=40?'var(--accent)':'var(--danger)')};">${avgForm}</div><div style="font-size:8px; color:var(--text-muted);">Tagesform 0-100</div></div>
            </div>`;
    }

    // Team-Anweisungen (NEU): unabhängig voneinander an-/abschaltbare Zusatzbefehle, jeweils
    // mit einem echten Vor- und Nachteil - anders als die Spielstil-Karten (die sich
    // gegenseitig ausschließen) lassen sich diese frei miteinander kombinieren.
    function toggleTeamInstruction(key) {
        playSound('click');
        game.teamInstructions[key] = !game.teamInstructions[key];
        renderTeamInstructions();
    }
    function getTeamInstructionBonus() {
        let t = game.teamInstructions;
        let bonus = 0;
        if (t.gegenpressing) bonus += 1.5; // erobert den Ball höher zurück, kostet aber Kraft (siehe Fitness-Hook)
        if (t.tiefStehen) bonus += 1; // kompakter, weniger anfällig
        if (t.hoheAV) bonus += 1; // mehr Breite im Angriff, aber konteranfällig (siehe Def-Malus)
        if (t.hoheAV) bonus -= 0.5; // Kontergefahr durch weit aufgerückte Außenverteidiger
        return bonus;
    }
    function getTeamInstructionFitnessMultiplier() {
        return game.teamInstructions.gegenpressing ? 1.15 : 1;
    }
    function renderTeamInstructions() {
        let box = document.getElementById('team-instructions-box');
        if (!box) return;
        let items = [
            { key: 'gegenpressing', label: 'Gegenpressing', desc: 'Nach Ballverlust sofort wieder drauf. Erobert den Ball in gefährlicher Zone zurück - kostet aber richtig Körner.' },
            { key: 'tiefStehen', label: 'Tief stehen', desc: 'Die Kette bleibt am eigenen Sechzehner. Hinter der Abwehr gibt es keinen Raum mehr - vor ihr dafür jede Menge.' },
            { key: 'hoheAV', label: 'Hohe Außenverteidiger', desc: 'Die Außenverteidiger schieben auf Höhe des Mittelfelds. Mehr Breite im Angriff, weite Wege zurück.' }
        ];
        box.innerHTML = items.map(it => `
            <div class="box" style="cursor:pointer;" onclick="toggleTeamInstruction('${it.key}')">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:18px; height:18px; border:2px solid ${game.teamInstructions[it.key] ? 'var(--primary)' : '#666'}; border-radius:3px; background:${game.teamInstructions[it.key] ? 'var(--primary)' : 'transparent'}; display:flex; align-items:center; justify-content:center; font-size:11px; color:#000; flex-shrink:0;">${game.teamInstructions[it.key] ? '✓' : ''}</div>
                    <strong style="font-size:11px;">${it.label}</strong>
                </div>
                <div style="font-size:9px; color:#aaa; margin-top:3px; margin-left:26px;">${it.desc}</div>
            </div>`).join('');
    }

    function setFormation(form) {
        playSound('click');
        game.formation = form;
        game.lastTacticWasCoTrainerSuggestion = false;
        document.getElementById('squad-form-name').innerText = form;
        autoLineup();
        renderSquadView();
        render3DPitch();
    }

    // Formations-Karten-Grid (NEU): zeigt Def/Off-Werte direkt auf der Karte, statt reiner
    // Formations-Bezeichnungen auf kleinen Buttons.
    function renderFormationCards() {
        let grid = document.getElementById('formation-cards-grid');
        if (!grid) return;
        grid.innerHTML = ALL_FORMATIONS.map(f => {
            let r = FORMATION_RATINGS[f];
            let active = f === game.formation;
            return `<div onclick="setFormation('${f}')" class="panel" style="cursor:pointer; margin:0; padding:8px; ${active ? 'border-color:var(--accent); border-width:2px;' : ''}">
                <div style="font-weight:800; font-size:12px; ${active ? 'color:var(--accent);' : ''}">${f}</div>
                <div style="font-size:9px; color:#aaa; margin-top:2px;">Def ${r.def} · Off ${r.off}</div>
            </div>`;
        }).join('');
    }

    // Spielstil-Karten-Grid (NEU): 8 Optionen mit Tempo/Pressing-Werten statt 3 Buttons.
    function renderTacticStyleCards() {
        let grid = document.getElementById('tactic-style-cards-grid');
        if (!grid) return;
        grid.innerHTML = Object.entries(TACTIC_STYLE_CONFIG).map(([key, cfg]) => {
            let active = key === game.tacticStyle;
            return `<div onclick="setTacticStyle('${key}')" class="panel" style="cursor:pointer; margin:0; padding:8px; ${active ? 'border-color:var(--accent); border-width:2px;' : ''}">
                <div style="font-weight:800; font-size:11px; ${active ? 'color:var(--accent);' : ''}">${cfg.label}</div>
                <div style="font-size:9px; color:#aaa; margin-top:2px;">Tempo ${cfg.tempo} · Press ${cfg.press}</div>
            </div>`;
        }).join('');
    }

    function setTacticStyle(style) {
        playSound('click');
        game.tacticStyle = style;
        game.lastTacticWasCoTrainerSuggestion = false;
        renderTacticStyleCards();
        let cfg = TACTIC_STYLE_CONFIG[style];
        let descEl = document.getElementById('tactic-style-desc');
        if (descEl) descEl.innerText = cfg ? cfg.desc : '';
    }

    // Zweikampfhärte: zweite taktische Dimension neben dem Spielstil - beeinflusst
    // Teamstärke, Karten- und Verletzungsrisiko (siehe match.js).
    function setTackleHardness(level) {
        playSound('click');
        game.tackleHardness = level;
        ['vorsichtig', 'normal', 'hart'].forEach(l => {
            let btn = document.getElementById('th-' + l);
            if (btn) btn.className = (l === level) ? 'btn-action' : 'btn-secondary';
        });
        let desc = {
            vorsichtig: 'Fairer Zweikampfstil: spürbar weniger Karten & Verletzungen, aber etwas weniger Zweikampfstärke.',
            normal: 'Ausgewogenes Einsteigen ohne besondere Vor-/Nachteile.',
            hart: 'Robustes, forsches Einsteigen bringt etwas Teamstärke, riskiert aber mehr Gelbe/Rote Karten und Verletzungen.'
        }[level];
        let descEl = document.getElementById('tackle-hardness-desc');
        if (descEl) descEl.innerText = desc;
    }

    let squadFilterPos = 'alle';
    let squadSortMode = 'staerke'; // NEU: Sortierfunktion für die Kaderliste
    function setSquadFilter(pos) {
        playSound('click');
        squadFilterPos = pos;
        ['alle', 'TW', 'ABW', 'MIT', 'ST'].forEach(p => {
            let btn = document.getElementById('sf-' + p);
            if (btn) btn.className = (p === pos) ? 'btn-action' : 'btn-secondary';
        });
        renderSquadView();
    }

    let autoLineupInProgress = false;
    function autoLineup() {
        if (autoLineupInProgress) return; // Rückfall-Schutz gegen Rekursion (siehe calcTeamStrength -> autoLineup -> renderSquadView -> ... Zyklus)
        autoLineupInProgress = true;
        let available = squad.filter(p => (p.suspended || 0) === 0 && (p.injured || 0) === 0 && (p.nationalDuty || 0) === 0);
        let effStr = p => p.strength * (p.fitness / 100);
        let tws = available.filter(p => p.pos === 'TW').sort((a, b) => effStr(b) - effStr(a));
        let abws = available.filter(p => p.pos === 'ABW').sort((a, b) => effStr(b) - effStr(a));
        let mits = available.filter(p => p.pos === 'MIT').sort((a, b) => effStr(b) - effStr(a));
        let sts = available.filter(p => p.pos === 'ST').sort((a, b) => effStr(b) - effStr(a));

        let config = {
            '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2],
            '4-2-3-1': [4, 5, 1], '4-1-4-1': [4, 5, 1], '3-4-3': [3, 4, 3], '5-4-1': [5, 4, 1]
        }[game.formation] || [4, 4, 2];
        let chosen = [];
        if (tws.length > 0) chosen.push(tws[0].id);
        abws.slice(0, config[0]).forEach(p => chosen.push(p.id));
        mits.slice(0, config[1]).forEach(p => chosen.push(p.id));
        sts.slice(0, config[2]).forEach(p => chosen.push(p.id));

        let remaining = available.filter(p => !chosen.includes(p.id)).sort((a, b) => effStr(b) - effStr(a));
        while (chosen.length < 11 && remaining.length > 0) chosen.push(remaining.shift().id);
        lineup = chosen;
        renderSquadView();
        render3DPitch();
        autoLineupInProgress = false;
    }

    // Tap-to-Swap: mobile-taugliche Alternative zu klassischem Drag & Drop (das auf
    // Touchscreens ohne Zusatzbibliotheken ohnehin unzuverlässig ist). Ersten Spieler
    // antippen (Pitch-Pin ODER Kaderzeile), zweiten antippen -> exakter Positionstausch.
    let selectedSwapId = null;

    function selectForSwap(id) {
        playSound('click');
        let player = squad.find(p => p.id === id);
        if (!player || (player.injured || 0) > 0 || (player.suspended || 0) > 0 || (player.nationalDuty || 0) > 0) { showToast('Spieler nicht einsatzbereit!', 'error'); return; }

        if (!selectedSwapId) {
            selectedSwapId = id;
            renderSquadView(); render3DPitch();
            showToast(`🔁 ${player.name} ausgewählt - jetzt einen zweiten Spieler antippen zum Tauschen (oder nochmal für Abbrechen)`, 'success');
            return;
        }
        if (selectedSwapId === id) {
            selectedSwapId = null;
            renderSquadView(); render3DPitch();
            return;
        }

        let otherId = selectedSwapId;
        let otherPlayer = squad.find(p => p.id === otherId);
        let idxA = lineup.indexOf(otherId);
        let idxB = lineup.indexOf(id);

        if (idxA !== -1 && idxB !== -1) {
            // Beide bereits in der Startelf -> tauschen exakt ihre Positionen auf dem Feld
            lineup[idxA] = id; lineup[idxB] = otherId;
        } else if (idxA !== -1 && idxB === -1) {
            // otherPlayer steht in der Startelf, id ist Bankspieler -> ersetzt ihn auf genau dieser Position
            lineup[idxA] = id;
        } else if (idxA === -1 && idxB !== -1) {
            lineup[idxB] = otherId;
        } else {
            showToast('Mindestens einer der beiden muss in der Startelf stehen!', 'error');
            selectedSwapId = null; renderSquadView(); render3DPitch();
            return;
        }
        selectedSwapId = null;
        showToast(`✅ ${otherPlayer.name} ↔ ${player.name} getauscht!`, 'success');
        renderSquadView();
        render3DPitch();
    }

    function toggleLineupPlayer(id) {
        playSound('click');
        let player = squad.find(p => p.id === id);
        if (!player || (player.injured || 0) > 0 || (player.suspended || 0) > 0 || (player.nationalDuty || 0) > 0) { alert("Spieler nicht einsatzbereit!"); return; }
        if (lineup.includes(id)) {
            if (lineup.length <= 11) { alert("Mindestens 11 Spieler benötigt!"); return; }
            lineup = lineup.filter(pid => pid !== id);
        } else {
            if (lineup.length >= 11) { alert("Startelf bereits voll!"); return; }
            lineup.push(id);
        }
        renderSquadView();
        render3DPitch();
    }

    // ---------- VERLETZUNGSKRISE-NOTFALLMODUS ----------
    // Fallen zu viele Spieler gleichzeitig aus, erscheint ein Warnhinweis mit konkreten
    // Handlungsvorschlägen statt den Spieler die dünne Personaldecke selbst erahnen zu lassen.
    // Persistenter Hinweis-Banner für ein offenes Vertrags-Ultimatum (siehe
    // checkContractUltimatum() in match.js) - macht die laufende Frist jederzeit sichtbar
    // und bietet einen Weg, die Entscheidung ohne Zwang zum sofortigen Reagieren zu treffen.
    function renderUltimatumBanner() {
        let box = document.getElementById('ultimatum-banner-box');
        if (!box) return;
        if (!game.activeUltimatumPlayerId) { box.style.display = 'none'; return; }
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        let remaining = Math.max(0, game.ultimatumDeadlineMatchday - game.matchday);
        box.innerHTML = `
            <div class="box" style="border-left-color:var(--danger); background:rgba(255,77,109,0.08); display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px;"><strong style="color:var(--danger);">⚠️ Ultimatum von ${p.name}</strong><br>Noch ${remaining} Spieltag(e) bis zur Frist.</span>
                <button onclick="openUltimatumModal()" class="btn-secondary" style="width:auto; font-size:9px;">Jetzt entscheiden</button>
            </div>`;
    }

    // Team-Chemie-Anzeige: durchschnittliche Eingespieltheit der aktuellen Startelf, inklusive
    // der besten und schwächsten Spielerpaarungen als konkrete Beispiele.
    function renderTeamChemistryPanel() {
        let box = document.getElementById('team-chemistry-box');
        if (!box) return;
        let stats = getLineupChemistryStats();
        if (stats.pairs.length === 0) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        let sorted = [...stats.pairs].sort((a, b) => b.value - a.value);
        let best = sorted.slice(0, 2).filter(p => p.value > 0);
        let color = stats.percent >= 60 ? 'var(--primary)' : (stats.percent >= 30 ? 'var(--accent)' : 'var(--text-muted)');
        let bestNames = best.map(p => {
            let pa = squad.find(x => x.id === p.a), pb = squad.find(x => x.id === p.b);
            return pa && pb ? `${pa.name.split(' ').pop()} – ${pb.name.split(' ').pop()} (${p.value})` : null;
        }).filter(Boolean);
        // Liga-Vergleich: andere Vereine führen keine echte Chemie-Historie, daher als
        // plausible Referenz der ligaweite Fortschritt über die Saison (Mannschaften spielen
        // sich im Schnitt bis Saisonende auf rund 65% ein) - zur groben Einordnung.
        let leagueAvgChemistry = Math.min(65, Math.round((game.matchday / 34) * 65));
        let vsLeagueText = stats.percent >= leagueAvgChemistry
            ? `<span style="color:var(--primary);">▲ ${stats.percent - leagueAvgChemistry} über Liga-Ø</span>`
            : `<span style="color:var(--danger);">▼ ${leagueAvgChemistry - stats.percent} unter Liga-Ø</span>`;
        box.innerHTML = `
            <div class="panel-header">🤝 TEAM-CHEMIE</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:10px;">Eingespieltheit der Startelf</span>
                <strong style="color:${color};">${stats.percent}% ${stats.bonus > 0 ? `(+${stats.bonus} Stärke)` : ''}</strong>
            </div>
            <div style="position:relative; background:rgba(228,197,140,0.1); border-radius:4px; height:8px; margin-bottom:4px; overflow:visible;">
                <div style="width:${stats.percent}%; height:100%; background:${color}; border-radius:4px;"></div>
                <div style="position:absolute; left:${leagueAvgChemistry}%; top:-2px; bottom:-2px; border-left:1px dashed var(--accent);" title="Liga-Durchschnitt: ${leagueAvgChemistry}%"></div>
            </div>
            <div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Liga-Ø: ${leagueAvgChemistry}% · ${vsLeagueText}</div>
            ${bestNames.length > 0 ? `<div style="font-size:9px; color:var(--text-muted);">Eingespielteste Paarungen: ${bestNames.join(' · ')}</div>` : '<div style="font-size:9px; color:var(--text-muted);">Noch keine eingespielten Paarungen - Zeit gemeinsam auf dem Platz zahlt sich langfristig aus.</div>'}
        `;
    }

    function renderInjuryCrisisWarning() {
        let box = document.getElementById('injury-crisis-warning');
        if (!box) return;
        let unavailable = squad.filter(p => (p.injured || 0) > 0 || (p.suspended || 0) > 0 || (p.nationalDuty || 0) > 0).length;
        let available = squad.length - unavailable;
        if (available >= 14 || squad.length === 0) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        let suggestions = [];
        if (youthTalents.length > 0) suggestions.push('🎓 Jugendspieler aus der Akademie hochziehen (Kader & Aufstellung → Jugendakademie)');
        if (secondTeamSquad.length > 0) suggestions.push('🥈 Spieler aus der zweiten Mannschaft hochziehen');
        suggestions.push('🛒 Freien Markt nach kurzfristig verfügbaren Spielern durchsuchen (Kaderplanung & Transfers)');
        box.innerHTML = `
            <div class="box" style="border-left-color:var(--danger); background:rgba(255,77,109,0.08);">
                <strong style="color:var(--danger);">🚨 VERLETZUNGSKRISE!</strong><br>
                <span style="font-size:10px;">Nur noch ${available} einsatzbereite Spieler im Kader - dringender Handlungsbedarf:</span>
                <ul style="font-size:10px; margin:6px 0 0 16px; padding:0;">${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>`;
    }

    function setSquadSort(mode) {
        squadSortMode = mode;
        ['staerke', 'alter', 'marktwert', 'moral', 'name'].forEach(m => {
            let btn = document.getElementById('ss-' + m);
            if (btn) btn.className = m === mode ? 'btn-action' : 'btn-secondary';
        });
        renderSquadView();
    }

    // KADER-ÜBERBLICK (NEU): Gesamtkennzahlen auf einen Blick - Kaderwert, Durchschnittsalter,
    // Durchschnittsmoral, Gehaltssumme, Größe - macht den Kader-Screen zu einem echten
    // Management-Dashboard statt einer reinen Spielerliste.
    function renderSquadOverviewBox() {
        let box = document.getElementById('squad-overview-box');
        if (!box) return;
        if (squad.length === 0) { box.innerHTML = '<div class="box">Kein Kader vorhanden.</div>'; return; }
        let totalValue = squad.reduce((s, p) => s + (p.marketValue || 0), 0);
        let avgAge = (squad.reduce((s, p) => s + p.age, 0) / squad.length).toFixed(1);
        let avgMorale = Math.round(squad.reduce((s, p) => s + p.morale, 0) / squad.length);
        let totalWage = squad.reduce((s, p) => s + (p.wage || 0), 0);
        let avgStrength = Math.round(squad.reduce((s, p) => s + p.strength, 0) / squad.length);
        let injuredCount = squad.filter(p => (p.injured || 0) > 0).length;
        let suspendedCount = squad.filter(p => (p.suspended || 0) > 0).length;
        box.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:4px;">
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">KADERWERT</div><div style="font-size:13px; font-weight:900; color:var(--gold);">${formatVal(totalValue)}</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">Ø ALTER</div><div style="font-size:13px; font-weight:900;">${avgAge} J.</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">Ø STÄRKE</div><div style="font-size:13px; font-weight:900; color:var(--accent);">${avgStrength}</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">Ø MORAL</div><div style="font-size:13px; font-weight:900; color:${avgMorale>=70?'var(--primary)':(avgMorale>=40?'var(--accent)':'var(--danger)')};">${avgMorale}%</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">GEHÄLTER/SPT</div><div style="font-size:13px; font-weight:900; color:var(--industry);">${formatVal(totalWage)}</div></div>
                <div class="box"><div style="font-size:8px; color:var(--text-muted);">KADERGRÖSSE</div><div style="font-size:13px; font-weight:900;">${squad.length} Spieler</div></div>
            </div>
            ${(injuredCount > 0 || suspendedCount > 0) ? `<div class="box" style="margin-top:4px; font-size:9px; color:var(--danger);">⚠️ ${injuredCount} verletzt, ${suspendedCount} gesperrt - nicht einsatzbereit</div>` : ''}
        `;
    }

    // KADERTIEFE NACH POSITION (NEU): zeigt auf einen Blick, wo der Kader dünn besetzt ist -
    // pro Positionsgruppe Anzahl + durchschnittliche Stärke, farblich nach Tiefe markiert.
    function renderSquadDepthChart() {
        let box = document.getElementById('squad-depth-chart-box');
        if (!box) return;
        const POS_LABELS = { TW: '🧤 Torwart', ABW: '🛡️ Abwehr', MIT: '⚙️ Mittelfeld', ST: '⚡ Sturm' };
        const MIN_HEALTHY = { TW: 2, ABW: 5, MIT: 5, ST: 3 };
        box.innerHTML = Object.keys(POS_LABELS).map(pos => {
            let players = squad.filter(p => p.pos === pos);
            let fitCount = players.filter(p => (p.injured||0)===0 && (p.suspended||0)===0).length;
            let avgStr = players.length > 0 ? Math.round(players.reduce((s,p)=>s+p.strength,0)/players.length) : 0;
            let depthColor = players.length >= MIN_HEALTHY[pos] ? 'var(--primary)' : (players.length >= MIN_HEALTHY[pos]-1 ? 'var(--accent)' : 'var(--danger)');
            let depthPct = Math.min(100, Math.round((players.length / (MIN_HEALTHY[pos]+1)) * 100));
            return `
                <div style="margin-bottom:6px;">
                    <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px;">
                        <span>${POS_LABELS[pos]}</span>
                        <strong style="color:${depthColor};">${players.length} Spieler (${fitCount} fit) · Ø ${avgStr}</strong>
                    </div>
                    <div style="background:rgba(255,255,255,0.06); border-radius:999px; height:6px; overflow:hidden;">
                        <div style="width:${depthPct}%; height:100%; background:${depthColor}; border-radius:999px;"></div>
                    </div>
                </div>`;
        }).join('');
    }

    // KADER-BESTENLISTE (NEU): Top-Torschütze, meiste Einsätze, jüngstes/ältestes Talent,
    // wertvollster Spieler - ein schneller Statistik-Überblick ohne extra Screen wechseln zu müssen.
    function renderSquadLeaderboardBox() {
        let box = document.getElementById('squad-leaderboard-box');
        if (!box) return;
        if (squad.length === 0) { box.innerHTML = ''; return; }
        let topScorer = [...squad].sort((a,b) => (b.goalsSeason||0) - (a.goalsSeason||0))[0];
        let mostAppearances = [...squad].sort((a,b) => (b.appearances||0) - (a.appearances||0))[0];
        let mostValuable = [...squad].sort((a,b) => (b.marketValue||0) - (a.marketValue||0))[0];
        let youngest = [...squad].sort((a,b) => a.age - b.age)[0];
        box.innerHTML = `
            <div class="box" style="font-size:9px; display:flex; justify-content:space-between;"><span>⚽ Top-Torschütze</span><strong>${topScorer.name} (${topScorer.goalsSeason||0})</strong></div>
            <div class="box" style="font-size:9px; display:flex; justify-content:space-between;"><span>🎽 Meiste Einsätze</span><strong>${mostAppearances.name} (${mostAppearances.appearances||0})</strong></div>
            <div class="box" style="font-size:9px; display:flex; justify-content:space-between;"><span>💰 Wertvollster Spieler</span><strong>${mostValuable.name} (${formatVal(mostValuable.marketValue||0)})</strong></div>
            <div class="box" style="font-size:9px; display:flex; justify-content:space-between;"><span>🌱 Jüngstes Talent</span><strong>${youngest.name} (${youngest.age} J.)</strong></div>
        `;
    }

    function renderSquadView() {
        renderSquadOverviewBox();
        renderSquadDepthChart();
        renderSquadLeaderboardBox();
        renderFormationCards();
        renderTacticStyleCards();
        renderTacticsBoardStatBar();
        renderTeamInstructions();
        populateRoleSelects();
        renderCoTrainerAdvice();
        renderInjuryCrisisWarning();
        renderUltimatumBanner();
        renderCrowdFavoritePreview();
        renderTeamChemistryPanel();
        if (typeof renderCliqueBox === 'function') renderCliqueBox();
        if (typeof renderLeadershipCouncilBox === 'function') renderLeadershipCouncilBox();
        let container = document.getElementById('bench-list');
        if (!container) return;
        container.innerHTML = '';
        let filtered = squadFilterPos === 'alle' ? squad : squad.filter(p => p.pos === squadFilterPos);
        // Sortierfunktion (NEU): nicht mehr nur nach Position filterbar, sondern auch echt sortierbar.
        filtered = [...filtered].sort((a, b) => {
            if (squadSortMode === 'staerke') return b.strength - a.strength;
            if (squadSortMode === 'alter') return a.age - b.age;
            if (squadSortMode === 'marktwert') return (b.marketValue||0) - (a.marketValue||0);
            if (squadSortMode === 'moral') return b.morale - a.morale;
            if (squadSortMode === 'name') return a.name.localeCompare(b.name);
            return 0;
        });
        filtered.forEach(p => {
            let isStarting = lineup.includes(p.id);
            let row = document.createElement('div');
            row.className = 'panel player-card';
            row.style.cssText = `margin-bottom:6px; padding:8px; border-left: 3px solid ${isStarting ? 'var(--primary)' : 'var(--border)'};`;
            let badgeClass = 'badge-' + (p.pos || 'mit').toLowerCase();
            let status = (p.injured || 0) > 0 ? `<span style="color:var(--danger);">Verletzt (${p.injured} Sp.)</span>` : ((p.suspended || 0) > 0 ? `<span style="color:var(--accent);">Gesperrt (${p.suspended} Sp.)</span>` : ((p.nationalDuty || 0) > 0 ? `<span style="color:var(--teal);">🌍 Nationalelf</span>` : `Fit: ${p.fitness}%`));
            let moraleColor = p.morale >= 70 ? 'var(--primary)' : (p.morale >= 40 ? 'var(--accent)' : 'var(--danger)');
            let moraleLine = ((p.injured || 0) === 0 && (p.suspended || 0) === 0 && (p.nationalDuty || 0) === 0) ? ` · <span style="color:${moraleColor};">Moral: ${p.morale}%</span>` : '';
            let roleBadge = p.id === game.captainId ? ' Ⓒ' : (p.id === game.penaltyTakerId ? ' ⚽' : (p.id === game.freeKickTakerId ? ' 🎯' : (p.id === game.cornerTakerId ? ' 🚩' : '')));
            if (p.individualFocus === 'elfmeter') roleBadge += ' <span title="Elfmeter-Spezialist" style="font-size:9px;">🥅</span>';
            if (p.isCrowdFavorite) roleBadge += ' <span title="Publikumsliebling der Saison" style="font-size:9px;">❤️</span>';
            if ((p.timesInjured || 0) >= 2) roleBadge += ' <span title="Wird vom Physio-Stab individuell geschont (verletzungsanfällig)" style="font-size:9px;">🛡️</span>';
            let traitBadge = (p.trait && p.trait !== 'Kein') ? `<span class="badge badge-trait">${p.trait}</span>` : '';
            let posRoles = getRolesForPosition(p.pos);
            let roleOptions = '<option value="">Keine Rolle</option>' + posRoles.map(r => `<option value="${r.id}" ${p.role === r.id ? 'selected' : ''}>${r.name}</option>`).join('');
            let roleFits = p.role && posRoles.find(r => r.id === p.role && (p[r.statKey] || 0) >= p.strength);

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="badge ${badgeClass}">${p.pos}</span>
                        <strong style="font-size:12px;">${p.name}${roleBadge}</strong>
                        ${traitBadge}
                    </div>
                    <button onclick="toggleLineupPlayer('${p.id}')" style="width:auto; padding:4px 10px; font-size:9px; border-radius:6px; border:none; background:${isStarting ? 'var(--danger)' : 'var(--primary)'}; color:${isStarting ? '#fff' : '#000'}; font-weight:700;">
                        ${isStarting ? 'Bank' : 'Startelf'}
                    </button>
                </div>
                <div style="font-size:8px; color:var(--text-muted); margin-bottom:4px; display:flex; justify-content:space-between;">
                    <span>${p.age} Jahre · ${p.contracts} J. Vertrag</span>
                    <span>${formatVal(p.marketValue||0)} · ⚽ ${p.goalsSeason||0} Saisontore · 🎽 ${p.appearances||0} Einsätze</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:2px; font-size:8px; color:#aaa; text-align:center; margin-bottom:6px; background:rgba(228,197,140,0.05); border-radius:4px; padding:4px 0;">
                    <div>STR<br><strong style="color:var(--accent); font-size:11px;">${p.strength}</strong></div>
                    <div>PAC<br><strong>${p.pace}</strong></div>
                    <div>SHO<br><strong>${p.shooting}</strong></div>
                    <div>PAS<br><strong>${p.passing}</strong></div>
                    <div>DEF<br><strong>${p.defense}</strong></div>
                    <div>KOP<br><strong>${p.KOP ?? '-'}</strong></div>
                    <div>FIT<br><strong>${p.fitness}</strong></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <span style="font-size:9px;">${status}${moraleLine}</span>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <button onclick="openPlayerDetail('${p.id}','squad')" class="btn-secondary" style="width:auto; padding:3px 7px; font-size:9px;" title="Details">ℹ️</button>
                        <button onclick="selectForSwap('${p.id}')" class="btn-secondary" style="width:auto; padding:3px 7px; font-size:9px; ${p.id === selectedSwapId ? 'background:var(--violet); color:#fff; border-color:var(--violet);' : ''}" title="Position tauschen">🔁</button>
                    </div>
                </div>
                <div style="margin-top:6px;">
                    <span style="font-size:9px; color:var(--text-muted);">Rolle:</span>
                    <select class="input-inline" style="width:100%; font-size:9px; margin-top:2px; ${roleFits ? 'color:var(--primary);' : ''}" onchange="setPlayerRole('${p.id}', this.value)">${roleOptions}</select>
                </div>
            `;
            container.appendChild(row);
        });

        let fitSummary = calcRoleFitSummary();
        let fitEl = document.getElementById('role-fit-summary');
        if (fitEl) {
            fitEl.innerText = fitSummary.total > 0
                ? `Taktik-Feinschliff: ${fitSummary.fit}/${fitSummary.total} zugewiesene Rollen passen zu den Stärken des Spielers (+${(fitSummary.fit * 0.8).toFixed(1)} Teamstärke)`
                : 'Noch keine Spielerrollen zugewiesen - probier es aus! Eine passende Rolle (grün markiert) bringt einen kleinen Teamstärke-Bonus.';
        }
    }

    function render3DPitch(pitchElId = 'soccer-pitch') {
        let pitch = document.getElementById(pitchElId);
        if (!pitch) return;
        // Stadion-Größenstufe (NEU): nur beim Live-Spielfeld anwenden, das vom Stadion-
        // Rahmen umgeben ist - die Taktiktafel hat keinen solchen Rahmen.
        if (pitchElId === 'live-pitch' && typeof applyStadiumVisualTierClass === 'function') applyStadiumVisualTierClass('.live-stadium-frame');
        pitch.querySelectorAll('.player-pin-3d').forEach(el => el.remove());
        let coords = getFormationCoords(game.formation);
        // Die im Wappen-Editor gewählte Vereinsfarbe fließt jetzt auch ins Trikot der
        // Taktiktafel-Pins ein, statt eines fest codierten Lila-Tons - stimmigeres Gesamtbild.
        // Beim Live-Match-Feld wird bei Auswärtsspielen automatisch die separate
        // Auswärtstrikot-Farbe verwendet.
        let isAwayContext = pitchElId === 'live-pitch' && typeof currentMatch !== 'undefined' && currentMatch && currentMatch.isHome === false;
        let crestColor = isAwayContext ? (game.clubCrestAwayColor || '#3fb6ff') : (game.clubCrestColor || '#8b5cf6');
        let pinBg = `linear-gradient(160deg, ${hexToRgba(crestColor, 0.92)}, ${hexToRgba(crestColor, 0.55)})`;

        lineup.forEach((pid, idx) => {
            if (idx >= coords.length) return;
            let p = squad.find(pl => pl.id === pid);
            if (!p) return;
            let pin = document.createElement('div');
            pin.className = 'player-pin-3d';
            pin.style.top = coords[idx].top + '%';
            pin.style.left = coords[idx].left + '%';
            pin.style.background = pinBg;
            // Eingespieltheit: Spieler mit überdurchschnittlich hoher Chemie zu ihren
            // Mitspielern bekommen einen dezenten goldenen Rand als visuellen Hinweis.
            let chemWithOthers = lineup.filter(oid => oid !== pid).map(oid => {
                let key = [pid, oid].sort().join('_');
                return (game.pairChemistry && game.pairChemistry[key]) || 0;
            });
            let avgChem = chemWithOthers.length > 0 ? chemWithOthers.reduce((a, b) => a + b, 0) / chemWithOthers.length : 0;
            if (avgChem >= 15) pin.style.border = '2px solid var(--accent)';
            let traitIcon = (p.trait && p.trait !== 'Kein') ? ' ⭐' : '';
            let roleIcon = p.id === game.captainId ? ' Ⓒ' : '';
            let favoriteIcon = p.isCrowdFavorite ? ' ❤️' : '';
            pin.innerHTML = `${p.name.split(' ').pop()} (${p.strength})${traitIcon}${roleIcon}${favoriteIcon}`;
            pin.title = (p.trait && p.trait !== 'Kein' ? p.trait : '') + (p.isCrowdFavorite ? ' · Publikumsliebling der Saison' : '');
            // Auf dem Kader-/Taktikschirm ist Antippen = Tauschmodus; auf dem Live-Spielschirm
            // rein informativ (kein Kaderwechsel während der laufenden Partie über die Pins).
            if (pitchElId === 'soccer-pitch') pin.onclick = () => selectForSwap(p.id);
            if (pid === selectedSwapId && pitchElId === 'soccer-pitch') pin.style.outline = '2px solid var(--teal)';
            pitch.appendChild(pin);
        });
    }

    function getFormationCoords(form) {
        if (form === '4-4-2') return [{top:88,left:50},{top:70,left:18},{top:70,left:39},{top:70,left:61},{top:70,left:82},{top:45,left:18},{top:45,left:39},{top:45,left:61},{top:45,left:82},{top:18,left:35},{top:18,left:65}];
        if (form === '4-3-3') return [{top:88,left:50},{top:72,left:18},{top:72,left:39},{top:72,left:61},{top:72,left:82},{top:48,left:30},{top:48,left:50},{top:48,left:70},{top:20,left:20},{top:16,left:50},{top:20,left:80}];
        if (form === '3-5-2') return [{top:88,left:50},{top:72,left:25},{top:72,left:50},{top:72,left:75},{top:45,left:15},{top:48,left:35},{top:45,left:50},{top:48,left:65},{top:45,left:85},{top:20,left:38},{top:20,left:62}];
        if (form === '5-3-2') return [{top:88,left:50},{top:72,left:12},{top:72,left:31},{top:72,left:50},{top:72,left:69},{top:72,left:88},{top:46,left:30},{top:46,left:50},{top:46,left:70},{top:20,left:38},{top:20,left:62}];
        // 4-2-3-1: Viererkette, Doppel-6, Zehnerreihe, einzelne Spitze
        if (form === '4-2-3-1') return [{top:90,left:50},{top:74,left:18},{top:74,left:39},{top:74,left:61},{top:74,left:82},{top:54,left:38},{top:54,left:62},{top:32,left:20},{top:30,left:50},{top:32,left:80},{top:14,left:50}];
        // 4-1-4-1: Viererkette, Sechser davor, breites Mittelfeldband, einzelne Spitze
        if (form === '4-1-4-1') return [{top:90,left:50},{top:74,left:18},{top:74,left:39},{top:74,left:61},{top:74,left:82},{top:56,left:50},{top:36,left:14},{top:38,left:38},{top:38,left:62},{top:36,left:86},{top:14,left:50}];
        // 3-4-3: Dreierkette, breites Mittelfeld, Dreier-Sturm
        if (form === '3-4-3') return [{top:90,left:50},{top:74,left:25},{top:74,left:50},{top:74,left:75},{top:50,left:12},{top:52,left:38},{top:52,left:62},{top:50,left:88},{top:18,left:22},{top:14,left:50},{top:18,left:78}];
        // 5-4-1: Fünferkette (sehr defensiv), viererreihe, einzelne Spitze
        if (form === '5-4-1') return [{top:90,left:50},{top:74,left:10},{top:74,left:30},{top:74,left:50},{top:74,left:70},{top:74,left:90},{top:44,left:15},{top:44,left:38},{top:44,left:62},{top:44,left:85},{top:14,left:50}];
        return [{top:88,left:50},{top:72,left:12},{top:72,left:31},{top:72,left:50},{top:72,left:69},{top:72,left:88},{top:46,left:30},{top:46,left:50},{top:46,left:70},{top:20,left:38},{top:20,left:62}];
    }

    function populateRoleSelects() {
        ['sel-captain', 'sel-penalty', 'sel-freekick', 'sel-corner'].forEach(id => {
            let sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '';
            squad.forEach(p => {
                let opt = document.createElement('option');
                opt.value = p.id;
                opt.innerText = `${p.name} (${p.pos}|${p.strength})${p.trait && p.trait!=='Kein'?` [${p.trait}]`:''}`;
                if (id === 'sel-captain' && p.id === game.captainId) opt.selected = true;
                if (id === 'sel-penalty' && p.id === game.penaltyTakerId) opt.selected = true;
                if (id === 'sel-freekick' && p.id === game.freeKickTakerId) opt.selected = true;
                if (id === 'sel-corner' && p.id === game.cornerTakerId) opt.selected = true;
                sel.appendChild(opt);
            });
        });
    }

    function assignRoles() {
        let cap = document.getElementById('sel-captain');
        let pen = document.getElementById('sel-penalty');
        let fk = document.getElementById('sel-freekick');
        let ck = document.getElementById('sel-corner');
        if (cap) game.captainId = cap.value;
        if (pen) game.penaltyTakerId = pen.value;
        if (fk) game.freeKickTakerId = fk.value;
        if (ck) game.cornerTakerId = ck.value;
    }

