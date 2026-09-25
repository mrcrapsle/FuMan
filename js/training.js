
    // ---------- WOCHENPLAN MIT TAGES-ZUWEISUNG ----------
    const WEEKLY_TRAINING_UNITS = {
        ausgeglichen: { label: 'Ausgeglichen', icon: '⚖️', load: 1 },
        kondition: { label: 'Kondition', icon: '🏃', load: 3 },
        technik: { label: 'Technik', icon: '⚽', load: 2 },
        taktik: { label: 'Taktik', icon: '📋', load: 2 },
        matchprep: { label: 'Match-Prep', icon: '🎯', load: 2 },
        erholung: { label: 'Erholung', icon: '🧘', load: -2 },
        frei: { label: 'Frei', icon: '🌴', load: -3 }
    };
    const WEEKDAY_LABELS = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };

    // Berechnet die Wochen-Kennzahlen (Belastung, Risiko, Einheiten) aus dem Tagesplan -
    // rein aus der Verteilung der 7 Tage, ohne dass echte Kalendertage im Spiel existieren
    // (ein "Spieltag-Zyklus" entspricht hier einer Trainingswoche).
    function computeWeeklyTrainingStats() {
        let plan = game.weeklyTrainingPlan;
        let totalLoad = 0, freeCount = 0, sessionCount = 0;
        let categoryCounts = {};
        Object.values(plan).forEach(day => {
            let unit = WEEKLY_TRAINING_UNITS[day] || WEEKLY_TRAINING_UNITS.ausgeglichen;
            totalLoad += unit.load;
            if (day === 'frei') freeCount++;
            else sessionCount++;
            categoryCounts[day] = (categoryCounts[day] || 0) + 1;
        });
        let risk = Math.max(2, Math.min(28, totalLoad * 2 - freeCount * 4));
        // Dominante Kategorie (häufigster NICHT-freier Tag) bestimmt automatisch den
        // bisherigen game.teamTraining-Wert, damit alle bestehenden Effekte (Fitnessverlust,
        // Skill-Trainings-Chance etc.) unverändert weiterfunktionieren - der Wochenplan ist
        // eine reichhaltigere Oberfläche für dieselbe zugrundeliegende Mechanik.
        let dominant = 'ausgeglichen';
        let bestCount = 0;
        Object.entries(categoryCounts).forEach(([cat, count]) => {
            if (cat !== 'frei' && count > bestCount) { bestCount = count; dominant = cat; }
        });
        // Alle Kategorien außer "frei" existieren 1:1 im bisherigen System (kondition, taktik,
        // technik, matchprep, erholung, ausgeglichen) - "frei" selbst hat kein Pendant und
        // verhält sich wie "erholung" für die bestehenden Effekt-Hooks.
        let mappedTeamTraining = dominant;
        return { totalLoad, freeCount, sessionCount, risk, dominant, mappedTeamTraining, categoryCounts };
    }

    function setWeeklyTrainingDay(day, type) {
        game.weeklyTrainingPlan[day] = type;
        let stats = computeWeeklyTrainingStats();
        game.teamTraining = stats.mappedTeamTraining;
        renderTrainingView();
        updateUI();
    }
    // Schnellauswahl für den ganzen Wochenplan auf einmal (Standardpläne).
    function applyWeeklyTrainingPreset(preset) {
        const PRESETS = {
            ausgeglichen: { mo: 'ausgeglichen', di: 'technik', mi: 'ausgeglichen', do: 'taktik', fr: 'ausgeglichen', sa: 'erholung', so: 'frei' },
            kondition: { mo: 'kondition', di: 'kondition', mi: 'erholung', do: 'kondition', fr: 'ausgeglichen', sa: 'erholung', so: 'frei' },
            technik: { mo: 'technik', di: 'standards', mi: 'technik', do: 'ausgeglichen', fr: 'technik', sa: 'erholung', so: 'frei' },
            taktik: { mo: 'taktik', di: 'ausgeglichen', mi: 'taktik', do: 'standards', fr: 'taktik', sa: 'erholung', so: 'frei' },
            regeneration: { mo: 'erholung', di: 'erholung', mi: 'ausgeglichen', do: 'erholung', fr: 'ausgeglichen', sa: 'frei', so: 'frei' }
        };
        game.weeklyTrainingPlan = { ...(PRESETS[preset] || PRESETS.ausgeglichen) };
        let stats = computeWeeklyTrainingStats();
        game.teamTraining = stats.mappedTeamTraining;
        renderTrainingView();
        updateUI();
        showToast(`📅 Standardplan "${preset}" übernommen!`, 'success');
    }
    function renderWeeklyTrainingPlan() {
        let box = document.getElementById('weekly-training-grid');
        if (!box) return;
        let stats = computeWeeklyTrainingStats();
        box.innerHTML = Object.keys(WEEKDAY_LABELS).map(day => {
            let current = game.weeklyTrainingPlan[day] || 'ausgeglichen';
            return `<div style="text-align:center;">
                <div style="font-size:9px; color:var(--text-muted); margin-bottom:2px;">${WEEKDAY_LABELS[day]}</div>
                <select class="input-inline" style="width:100%; font-size:9px; padding:4px 2px;" onchange="setWeeklyTrainingDay('${day}', this.value)">
                    ${Object.entries(WEEKLY_TRAINING_UNITS).map(([key, u]) => `<option value="${key}" ${current === key ? 'selected' : ''}>${u.icon} ${u.label}</option>`).join('')}
                </select>
            </div>`;
        }).join('');
        let statsBox = document.getElementById('weekly-training-stats');
        if (statsBox) {
            let riskColor = stats.risk > 18 ? 'var(--danger)' : (stats.risk > 10 ? 'var(--accent)' : 'var(--primary)');
            statsBox.innerHTML = `
                <span>📊 Einheiten: <strong>${stats.sessionCount}</strong></span>
                <span>🩹 Verletzungsrisiko: <strong style="color:${riskColor};">${stats.risk}%</strong></span>
                <span>🎯 Schwerpunkt: <strong>${WEEKLY_TRAINING_UNITS[stats.dominant]?.label || 'Ausgeglichen'}</strong></span>
            `;
        }
        renderCustomWeeklyPlanTemplates();
    }

    // ---------- WOCHENPLAN-VORLAGEN SPEICHERN ----------
    // Eigene, selbst zusammengestellte Wochenpläne lassen sich unter einem frei wählbaren
    // Namen sichern und später jederzeit mit einem Klick wieder übernehmen - zusätzlich zu
    // den fünf mitgelieferten Standardplänen.
    function saveCustomWeeklyPlanTemplate() {
        let nameInput = document.getElementById('custom-plan-name-input');
        // Sicherheit: der Name landet ungeprüft in innerHTML (renderCustomWeeklyPlanTemplates())
        // - dieselbe Absicherung wie bei renameClub() (career.js).
        let name = (nameInput?.value || '').replace(/[<>&"]/g, '').trim();
        if (!name) { showToast('Bitte einen Namen für die Vorlage eingeben!', 'error'); return; }
        if (!game.customWeeklyPlanTemplates) game.customWeeklyPlanTemplates = [];
        if (game.customWeeklyPlanTemplates.length >= 8) { showToast('Maximal 8 eigene Vorlagen möglich - erst eine löschen.', 'error'); return; }
        game.customWeeklyPlanTemplates.push({ name, plan: { ...game.weeklyTrainingPlan } });
        if (nameInput) nameInput.value = '';
        renderCustomWeeklyPlanTemplates();
        showToast(`💾 Wochenplan-Vorlage "${name}" gespeichert!`, 'success');
    }
    function applyCustomWeeklyPlanTemplate(idx) {
        let tmpl = game.customWeeklyPlanTemplates?.[idx];
        if (!tmpl) return;
        game.weeklyTrainingPlan = { ...tmpl.plan };
        game.teamTraining = computeWeeklyTrainingStats().mappedTeamTraining;
        renderTrainingView();
        updateUI();
        showToast(`📅 Vorlage "${tmpl.name}" übernommen!`, 'success');
    }
    function deleteCustomWeeklyPlanTemplate(idx) {
        if (!game.customWeeklyPlanTemplates) return;
        game.customWeeklyPlanTemplates.splice(idx, 1);
        renderCustomWeeklyPlanTemplates();
    }
    function renderCustomWeeklyPlanTemplates() {
        let box = document.getElementById('custom-weekly-templates-list');
        if (!box) return;
        let templates = game.customWeeklyPlanTemplates || [];
        box.innerHTML = templates.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Noch keine eigenen Vorlagen gespeichert.</div>'
            : templates.map((t, idx) => `<div class="player-row" style="font-size:10px;">
                <span>${t.name}</span>
                <div>
                    <button onclick="applyCustomWeeklyPlanTemplate(${idx})" class="btn-secondary" style="width:auto; font-size:9px; padding:3px 8px;">Übernehmen</button>
                    <button onclick="deleteCustomWeeklyPlanTemplate(${idx})" class="btn-secondary" style="width:auto; font-size:9px; padding:3px 8px; color:var(--danger);">✕</button>
                </div>
            </div>`).join('');
    }

    // Reiter-Navigation (NEU): teilt den bisher sehr langen Trainings-Screen in 4 Reiter auf,
    // um das ständige Scrollen zu vermeiden.
    function setTrainingTab(tab) {
        playSound('click');
        ['plan', 'minigames', 'individual', 'special'].forEach(t => {
            let el = document.getElementById('training-tab-' + t);
            if (el) el.style.display = (t === tab) ? 'block' : 'none';
            let btn = document.getElementById('btn-tab-tra-' + t);
            if (btn) btn.className = (t === tab) ? 'btn-action' : 'btn-secondary';
        });
    }

    // ==========================================
    // FÄHIGKEITEN GEZIELT ANTRAINIEREN (NEU)
    // ==========================================
    // Ein zugewiesener Trainer (Personal) bildet einen Spieler über mehrere Spieltage gezielt
    // in einer Fähigkeit fort - kostet echtes Geld UND Zeit, garantiert dafür eine echte,
    // spürbare Verbesserung statt einer reinen Zufallschance wie beim allgemeinen Training.
    const SKILL_TRAINING_STATS = { pace: 'Tempo', shooting: 'Schuss', passing: 'Pass', defense: 'Abwehr' };
    const SKILL_TRAINING_COACHES = {
        coTrainer: { name: 'Co-Trainer', boost: 3, days: 16 },
        twTrainer: { name: 'Torwarttrainer (nur Torhüter)', boost: 5, days: 14, restrictToGK: true },
        setPieceCoach: { name: 'Standards-Spezialist (Schuss/Pass)', boost: 4, days: 14, restrictToStats: ['shooting', 'passing'] }
    };
    function populateSkillTrainingSelects() {
        let playerSel = document.getElementById('skill-training-player-select');
        let statSel = document.getElementById('skill-training-stat-select');
        let coachSel = document.getElementById('skill-training-coach-select');
        if (!playerSel || !statSel || !coachSel) return;
        playerSel.innerHTML = squad.map(p => `<option value="${p.id}">${p.name} (${p.pos})</option>`).join('');
        statSel.innerHTML = Object.keys(SKILL_TRAINING_STATS).map(k => `<option value="${k}">${SKILL_TRAINING_STATS[k]}</option>`).join('');
        let availableCoaches = Object.keys(SKILL_TRAINING_COACHES).filter(k => staffMembers[k] && staffMembers[k].hired);
        coachSel.innerHTML = availableCoaches.length > 0
            ? availableCoaches.map(k => `<option value="${k}">${SKILL_TRAINING_COACHES[k].name}</option>`).join('')
            : '<option value="">Kein geeigneter Trainer eingestellt!</option>';
    }
    function getSkillTrainingCost(coachKey) {
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let base = { coTrainer: 8000, twTrainer: 10000, setPieceCoach: 9000 }[coachKey] || 8000;
        return Math.round(base * scale);
    }
    function startSkillTraining() {
        let playerId = document.getElementById('skill-training-player-select').value;
        let stat = document.getElementById('skill-training-stat-select').value;
        let coachKey = document.getElementById('skill-training-coach-select').value;
        let p = squad.find(x => x.id === playerId);
        let coach = SKILL_TRAINING_COACHES[coachKey];
        if (!p || !coach) { showToast('Bitte Spieler und Trainer auswählen!', 'error'); return; }
        if (!staffMembers[coachKey] || !staffMembers[coachKey].hired) { showToast('Dieser Trainer ist nicht eingestellt!', 'error'); return; }
        if (coach.restrictToGK && p.pos !== 'TW') { showToast('Dieser Trainer bildet nur Torhüter fort!', 'error'); return; }
        if (coach.restrictToStats && !coach.restrictToStats.includes(stat)) { showToast(`Dieser Trainer kann nur ${coach.restrictToStats.map(s => SKILL_TRAINING_STATS[s]).join('/')} trainieren!`, 'error'); return; }
        if ((game.skillTrainingQueue || []).some(s => s.playerId === playerId)) { showToast(`${p.name} wird bereits fortgebildet!`, 'error'); return; }
        let cost = getSkillTrainingCost(coachKey);
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        if (!game.skillTrainingQueue) game.skillTrainingQueue = [];
        game.skillTrainingQueue.push({ playerId, playerName: p.name, stat, statLabel: SKILL_TRAINING_STATS[stat], coachKey, coachName: coach.name, boost: coach.boost, matchdaysLeft: coach.days, totalDays: coach.days });
        addInboxMessage('vertrag', `💪 Fähigkeitstraining gestartet: ${p.name}`, `${coach.name} bildet ${p.name} in "${SKILL_TRAINING_STATS[stat]}" fort - in ${coach.days} Spieltagen +${coach.boost} garantiert.`, 'screen-training');
        showToast(`💪 Fähigkeitstraining für ${p.name} gestartet!`, 'success');
        renderTrainingView();
        updateUI();
    }
    // Wird jeden Spieltag ausgewertet: zaehlt herunter, wendet den garantierten Fähigkeits-
    // Boost bei Abschluss an.
    function tickSkillTraining() {
        if (!Array.isArray(game.skillTrainingQueue)) return;
        game.skillTrainingQueue.forEach(s => { s.matchdaysLeft--; });
        let done = game.skillTrainingQueue.filter(s => s.matchdaysLeft <= 0);
        done.forEach(s => {
            let p = squad.find(x => x.id === s.playerId);
            if (p) {
                p[s.stat] = Math.min(99, (p[s.stat] || 0) + s.boost);
                addInboxMessage('vertrag', `💪 Fähigkeitstraining abgeschlossen: ${p.name}`, `${s.statLabel} von ${p.name} um ${s.boost} Punkte gesteigert (${s.coachName})!`, 'screen-squad');
                showToast(`💪 ${p.name}: ${s.statLabel} +${s.boost}!`, 'success');
            }
        });
        game.skillTrainingQueue = game.skillTrainingQueue.filter(s => s.matchdaysLeft > 0);
    }
    function renderSkillTrainingActiveList() {
        let box = document.getElementById('skill-training-active-list');
        if (!box) return;
        populateSkillTrainingSelects();
        let queue = game.skillTrainingQueue || [];
        if (queue.length === 0) { box.innerHTML = ''; return; }
        box.innerHTML = queue.map(s => `
            <div class="box" style="font-size:9px; display:flex; justify-content:space-between;">
                <span>${s.playerName}: ${s.statLabel} (+${s.boost}) mit ${s.coachName}</span>
                <strong>noch ${s.matchdaysLeft} SpT</strong>
            </div>`).join('');
    }

    function renderTrainingView() {
        renderWeeklyTrainingPlan();
        renderTrainingExtras();
        renderSkillTrainingActiveList();
        renderTrainingAutopilotBox();
        document.getElementById('cur-team-training').innerText = game.teamTraining.toUpperCase();

        // Minispiel-Bereich: Spielerauswahl, verbleibende Einheiten, Bestleistungen
        let playerSelect = document.getElementById('minigame-player-select');
        if (playerSelect) {
            let prevValue = playerSelect.value;
            playerSelect.innerHTML = '';
            squad.forEach(p => {
                let opt = document.createElement('option');
                opt.value = p.id;
                opt.innerText = `${p.name} (${p.pos} | Schuss:${p.shooting||60} Pass:${p.passing||60})`;
                playerSelect.appendChild(opt);
            });
            if (prevValue && squad.some(p => p.id === prevValue)) playerSelect.value = prevValue;
        }
        let sessionsLeftEl = document.getElementById('training-sessions-left');
        if (sessionsLeftEl) sessionsLeftEl.innerText = trainingSessionsLeft();
        // Minispiel-Kosten (NEU) dynamisch an den Buttons anzeigen.
        let mgCost = typeof getMinigameCost === 'function' ? getMinigameCost() : 2000;
        let btnPenalty = document.getElementById('btn-minigame-penalty');
        if (btnPenalty) btnPenalty.innerText = `⚽ Elfmeterschießen [${formatVal(mgCost)}]`;
        let btnCrossing = document.getElementById('btn-minigame-crossing');
        if (btnCrossing) btnCrossing.innerText = `🎯 Flankentraining [${formatVal(mgCost)}]`;
        let btnGoalkeeper = document.getElementById('btn-minigame-goalkeeper');
        if (btnGoalkeeper) btnGoalkeeper.innerText = `🧤 Elfmeter halten (nur Torhüter) [${formatVal(mgCost)}]`;
        let bestPenaltyEl = document.getElementById('best-penalty-score');
        if (bestPenaltyEl) bestPenaltyEl.innerText = (game.bestPenaltyScore || 0) + '/5';
        let bestCrossingEl = document.getElementById('best-crossing-score');
        if (bestCrossingEl) bestCrossingEl.innerText = (game.bestCrossingScore || 0) + '/15';
        let bestGoalkeeperEl = document.getElementById('best-goalkeeper-score');
        if (bestGoalkeeperEl) bestGoalkeeperEl.innerText = (game.bestGoalkeeperScore || 0) + '/5';

        let list = document.getElementById('individual-training-list');
        list.innerHTML = '';
        squad.forEach(p => {
            let row = document.createElement('div');
            row.className = 'player-row';
            row.innerHTML = `
                <span style="display:flex; align-items:center; gap:6px;">${typeof renderPlayerAvatarTag === 'function' ? renderPlayerAvatarTag(p, 26) : ''}<strong class="badge badge-${(p.pos||'mit').toLowerCase()}">${p.pos}</strong> ${p.name} (Str: ${p.strength})</span>
                <div>
                    Fokus:
                    <select class="input-inline" style="width:100px;" onchange="setIndividualFocus('${p.id}', this.value)">
                        <option value="allgemein" ${p.individualFocus==='allgemein'?'selected':''}>Allgemein</option>
                        <option value="torschuss" ${p.individualFocus==='torschuss'?'selected':''}>Torschuss</option>
                        <option value="passspiel" ${p.individualFocus==='passspiel'?'selected':''}>Passspiel</option>
                        <option value="zweikampf" ${p.individualFocus==='zweikampf'?'selected':''}>Zweikampf</option>
                        <option value="tempo" ${p.individualFocus==='tempo'?'selected':''}>Tempo/Athletik</option>
                        <option value="torwart" ${p.individualFocus==='torwart'?'selected':''}>🧤 Torwart-Spezialist</option>
                        <option value="elfmeter" ${p.individualFocus==='elfmeter'?'selected':''}>🥅 Elfmeter-Spezialist</option>
                    </select>
                </div>
            `;
            list.appendChild(row);
        });
    }

    function setTeamTraining(focus) {
        playSound('click');
        game.teamTraining = focus;
        ['kondition', 'taktik', 'technik', 'matchprep', 'erholung'].forEach(f => {
            let btn = document.getElementById('tr-' + f);
            if (btn) btn.className = (f === focus) ? 'btn-action' : 'btn-secondary';
        });
        document.getElementById('cur-team-training').innerText = focus.toUpperCase();
    }

    function setIndividualFocus(playerId, focus) {
        let p = squad.find(x => x.id === playerId);
        if (p) p.individualFocus = focus;
    }

    // ==========================================
    // PERSONAL-AUTOMATIK: Co-Trainer & Konditionstrainer können Trainingsaufgaben
    // eigenständig verteilen, statt dass der Manager jeden Spieler einzeln einstellt.
    // ==========================================
    const CO_TRAINER_TASKS = [
        { id: 'aus', name: 'Manuell (Manager entscheidet)', desc: 'Keine Automatik - du weist jedem Spieler selbst einen Fokus zu.' },
        { id: 'schwaechen', name: 'Schwächen ausgleichen', desc: 'Jeder Spieler trainiert gezielt seinen schwächsten Wert.' },
        { id: 'staerken', name: 'Stärken ausbauen', desc: 'Jeder Spieler spezialisiert sich auf seinen stärksten Wert.' },
        { id: 'rotation', name: 'Rotierendes Training', desc: 'Der Fokus wechselt reihum, damit alle Bereiche abgedeckt werden.' }
    ];

    const FIT_COACH_TASKS = [
        { id: 'aus', name: 'Manuell (Manager entscheidet)', desc: 'Keine Automatik - du wählst den Wochenschwerpunkt selbst.' },
        { id: 'auto-fitness', name: 'Fitness im Blick behalten', desc: 'Schaltet bei niedriger Kader-Fitness automatisch auf Erholung, sonst auf Kondition.' },
        { id: 'auto-matchprep', name: 'Auf Spieltag fokussieren', desc: 'Schaltet vor wichtigen Spielen (Derby) automatisch auf Match-Prep, sonst auf Taktik.' }
    ];

    function setCoTrainerTask(taskId) {
        if (!CO_TRAINER_TASKS.some(t => t.id === taskId)) return;
        staffMembers.coTrainer.task = taskId;
        renderStaffView();
    }

    function setFitCoachTask(taskId) {
        if (!FIT_COACH_TASKS.some(t => t.id === taskId)) return;
        staffMembers.fitCoach.task = taskId;
        renderStaffView();
    }

    // Ordnet einem Spieler den Fokus zu, der zu seinem staerksten/schwaechsten Trainings-Wert passt.
    function pickFocusForPlayer(p, mode) {
        let statMap = { torschuss: 'shooting', passspiel: 'passing', zweikampf: 'defense', tempo: 'pace' };
        let entries = Object.entries(statMap).map(([focus, stat]) => ({ focus, value: p[stat] || 0 }));
        entries.sort((a, b) => mode === 'staerken' ? b.value - a.value : a.value - b.value);
        return entries[0].focus;
    }

    function runCoTrainerAutoAssignment() {
        if (!staffMembers.coTrainer.hired) return;
        let task = staffMembers.coTrainer.task || 'aus';
        if (task === 'aus') return;

        let focusCycle = ['torschuss', 'passspiel', 'zweikampf', 'tempo'];
        squad.forEach((p, idx) => {
            if (task === 'schwaechen' || task === 'staerken') {
                p.individualFocus = pickFocusForPlayer(p, task);
            } else if (task === 'rotation') {
                p.individualFocus = focusCycle[(game.matchday + idx) % focusCycle.length];
            }
        });
    }

    function runFitCoachAutoAssignment() {
        if (!staffMembers.fitCoach.hired) return;
        let task = staffMembers.fitCoach.task || 'aus';
        if (task === 'aus') return;

        if (task === 'auto-fitness') {
            let avgFitness = squad.reduce((s, p) => s + p.fitness, 0) / Math.max(1, squad.length);
            game.teamTraining = avgFitness < 70 ? 'erholung' : 'kondition';
        } else if (task === 'auto-matchprep') {
            let ourTeam = getOurLeagueTeam ? getOurLeagueTeam() : null;
            let upcomingIsDerby = false;
            if (ourTeam && ourTeam.rivalName) {
                let md = game.matchday;
                let fixs = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][md - 1] : null;
                if (fixs) {
                    let ourFixture = fixs.find(f => {
                        let h = leaguesData[game.leagueLevel][f.home].name, a = leaguesData[game.leagueLevel][f.away].name;
                        return h === game.clubName || a === game.clubName;
                    });
                    if (ourFixture) {
                        let h = leaguesData[game.leagueLevel][ourFixture.home].name, a = leaguesData[game.leagueLevel][ourFixture.away].name;
                        upcomingIsDerby = (h === ourTeam.rivalName || a === ourTeam.rivalName);
                    }
                }
            }
            game.teamTraining = upcomingIsDerby ? 'matchprep' : 'taktik';
        }
    }

    // ==========================================
    // TRAINING & FÖRDERUNG: 15 NEUE FUNKTIONEN
    // ==========================================

    function pushTrainingHistoryEntry(text) {
        if (!game.trainingHistory) game.trainingHistory = [];
        game.trainingHistory.unshift({ season: game.season, matchday: game.matchday, text });
        if (game.trainingHistory.length > 20) game.trainingHistory.pop();
    }

    // 1. Trainingsintensität-Regler: Locker/Normal/Hart - Kompromiss zwischen Fitnessverlust
    // und Trainingserfolgs-Chance, wirkt direkt im bestehenden fitLoss/individualBoostChance-Hook.
    function setTrainingIntensity(level) {
        game.trainingIntensity = level;
        playSound('click');
        renderTrainingExtras();
        updateUI();
        showToast(`🔥 Trainingsintensität auf "${level}" gesetzt.`, 'success');
    }
    function getTrainingIntensityFitnessMultiplier() {
        return game.trainingIntensity === 'hart' ? 1.25 : (game.trainingIntensity === 'locker' ? 0.75 : 1);
    }
    function getTrainingIntensityBoostMultiplier() {
        return game.trainingIntensity === 'hart' ? 1.3 : (game.trainingIntensity === 'locker' ? 0.7 : 1);
    }

    // 2. Video-Analyse-Trainingseinheit: einmalige Vorbereitung aufs nächste Spiel, kleiner
    // Team-Stärke-Bonus im kommenden Match (siehe game.videoAnalysisBoostActive in match.js).
    function runVideoAnalysisSession() {
        if (game.lastVideoAnalysisMatchday === game.matchday) { showToast('Für dieses Spiel bereits durchgeführt!', 'error'); return; }
        let cost = 2500;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        game.lastVideoAnalysisMatchday = game.matchday;
        game.videoAnalysisBoostActive = true;
        pushTrainingHistoryEntry('🎥 Video-Analyse-Einheit durchgeführt - taktischer Vorteil fürs nächste Spiel.');
        showToast('🎥 Video-Analyse-Einheit durchgeführt!', 'success');
        renderTrainingExtras();
        updateUI();
    }

    // 4. Trainingslager-Schnellzugriff: Direktlink zum bestehenden Kalender-Feature.
    function goToTrainingCampBooking() {
        showScreen('screen-calendar');
        showToast('📅 Im Kalender kannst du ein Trainingslager buchen.', 'success');
    }

    // 5. Mentaltraining: eigene Einheit, reduziert dauerhaft den Drucksituations-Malus bei
    // Elfmetern für die gesamte Mannschaft (siehe pressurePenalty-Hook in europe.js).
    function runMentalTrainingSession() {
        let cost = 3500;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        game.mentalTrainingLevel = Math.min(3, (game.mentalTrainingLevel || 0) + 1);
        pushTrainingHistoryEntry(`🧠 Mentaltraining-Einheit absolviert (Stufe ${game.mentalTrainingLevel}/3) - weniger Nervosität in Drucksituationen.`);
        showToast(`🧠 Mentaltraining Stufe ${game.mentalTrainingLevel}/3 erreicht!`, 'success');
        renderTrainingExtras();
        updateUI();
    }

    // 6. Verletzungspräventions-Programm: laufende Kosten, senkt dauerhaft (nicht nur über
    // den Wochenplan) das Grund-Verletzungsrisiko.
    function toggleInjuryPreventionProgram() {
        if (!game.injuryPreventionProgram && game.money < 5000) { showToast('5.000 € Einrichtungskosten benötigt!', 'error'); return; }
        if (!game.injuryPreventionProgram) game.money -= 5000;
        game.injuryPreventionProgram = !game.injuryPreventionProgram;
        playSound('click');
        pushTrainingHistoryEntry(game.injuryPreventionProgram ? '🩹 Verletzungspräventions-Programm eingerichtet - dauerhaft geringeres Grundrisiko.' : '🩹 Verletzungspräventions-Programm eingestellt.');
        renderTrainingExtras();
        updateUI();
    }

    // 7. Doppeltraining-Tag: einmalige Hochrisiko/Hochertrags-Einheit - deutlich höhere
    // individuelle Trainings-Boost-Chance heute, aber auch höheres Verletzungsrisiko.
    function runDoubleTrainingDay() {
        if (game.lastDoubleTrainingMatchday === game.matchday) { showToast('Heute schon durchgeführt!', 'error'); return; }
        playSound('whistle');
        game.lastDoubleTrainingMatchday = game.matchday;
        game.doubleTrainingBoostActive = true;
        squad.forEach(p => { p.fitness = Math.max(30, p.fitness - 8); });
        pushTrainingHistoryEntry('💪 Doppeltraining-Tag durchgeführt - höhere Belastung, aber auch höhere Trainingschancen fürs nächste Spiel.');
        showToast('💪 Doppeltraining durchgeführt - Fitness gesunken, Trainingschance steigt!', 'success');
        renderTrainingExtras();
        updateUI();
    }

    // 8. Athletik-Test: deckt die tatsächlichen Detail-Attribute eines Spielers zuverlässiger
    // auf und gibt eine kleine Chance auf einen sofortigen Fitness-Grundwert-Kick.
    function runAthleticTest(playerId) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return;
        playSound('click');
        p.athleticTested = true;
        if (Math.random() < 0.25) { p.pace = Math.min(99, (p.pace || 60) + 1); }
        pushTrainingHistoryEntry(`🏃‍♂️ Athletik-Test mit ${p.name} durchgeführt.`);
        showToast(`🏃‍♂️ Athletik-Test mit ${p.name} abgeschlossen!`, 'success');
        renderTrainingView();
    }

    // 9. Internes Techniktraining-Turnier: Wettbewerb unter den Spielern, Sieger bekommt
    // Skill- und Moralschub.
    function runTechniqueContest() {
        if (game.lastTechContestMatchday === game.matchday) { showToast('Heute schon durchgeführt!', 'error'); return; }
        if (squad.length === 0) return;
        playSound('goal');
        game.lastTechContestMatchday = game.matchday;
        let winner = squad.reduce((best, p) => (p.shooting || 0) + Math.random() * 20 > (best.shooting || 0) + Math.random() * 20 ? p : best, squad[0]);
        winner.shooting = Math.min(99, (winner.shooting || 60) + 1);
        winner.morale = Math.min(100, winner.morale + 8);
        pushTrainingHistoryEntry(`🏆 Techniktraining-Turnier gewonnen von ${winner.name} - Schuss & Moral gesteigert!`);
        showToast(`🏆 ${winner.name} gewinnt das interne Techniktraining-Turnier!`, 'success');
        renderTrainingView();
        updateUI();
    }

    // 10. Trainingsausrüstung kaufen: einmalige Investition, dauerhafter kleiner
    // Trainingsqualitäts-Bonus (skaliert individualBoostChance leicht).
    function buyTrainingEquipment() {
        if (game.equipmentLevel >= 3) { showToast('Maximalstufe bereits erreicht!', 'error'); return; }
        let cost = 8000 * (game.equipmentLevel + 1);
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        game.equipmentLevel++;
        pushTrainingHistoryEntry(`🎒 Neue Trainingsausrüstung angeschafft (Stufe ${game.equipmentLevel}/3).`);
        showToast(`🎒 Trainingsausrüstung auf Stufe ${game.equipmentLevel}/3!`, 'success');
        renderTrainingExtras();
        updateUI();
    }

    // 11. Belastungssteuerung nach Spielrhythmus: erkennt Englische Wochen (Pokal + Liga eng
    // getaktet) und schlägt automatisch einen schonenderen Wochenplan vor.
    function checkFixtureCongestionWarning() {
        let cupRoundIdx = cupTournament.matchdays ? cupTournament.matchdays.indexOf(game.matchday + 1) : -1;
        let isCongested = cupRoundIdx !== -1 || (europeTournament.matchdays || []).includes(game.matchday + 1);
        return isCongested;
    }
    function applyCongestionRecommendation() {
        applyWeeklyTrainingPreset('regeneration');
        showToast('📅 Schonender Wochenplan wegen englischer Woche übernommen!', 'success');
    }

    // 12. Jugendspieler-Hospitanz im Profitraining: temporär im Profikader mittrainieren,
    // erhöhte Entwicklungschance für die Dauer der Hospitanz.
    function addYouthHospitant(playerId) {
        if (game.youthHospitants.length >= 3) { showToast('Maximal 3 Hospitanten gleichzeitig möglich!', 'error'); return; }
        if (game.youthHospitants.includes(playerId)) { showToast('Bereits Hospitant!', 'error'); return; }
        let p = youthTalents.find(y => y.id === playerId);
        if (!p) return;
        playSound('click');
        game.youthHospitants.push(playerId);
        pushTrainingHistoryEntry(`⬆️ ${p.name} (Jugend) hospitiert jetzt im Profitraining.`);
        showToast(`⬆️ ${p.name} trainiert jetzt mit den Profis mit!`, 'success');
        renderTrainingExtras();
    }
    function removeYouthHospitant(playerId) {
        game.youthHospitants = game.youthHospitants.filter(id => id !== playerId);
        renderTrainingExtras();
    }

    // 13. Trainingsfortschritts-Historie: siehe pushTrainingHistoryEntry() oben, wird hier gerendert.
    function renderTrainingHistoryLog() {
        let box = document.getElementById('training-history-box');
        if (!box) return;
        let hist = game.trainingHistory || [];
        box.innerHTML = hist.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Noch keine Trainingsereignisse.</div>'
            : hist.slice(0, 8).map(e => `<div class="box" style="font-size:9px;"><span style="color:var(--text-muted);">S${e.season}/${e.matchday}:</span> ${e.text}</div>`).join('');
    }

    // 14. Elfmeterkiller-Förderprogramm: dediziertes Training mit Chance, einem Torhüter die
    // seltene "Elfmeter-Killer"-Eigenschaft anzutrainieren.
    function runPenaltyKillerProgram(playerId) {
        let p = squad.find(x => x.id === playerId);
        if (!p || p.pos !== 'TW') { showToast('Nur für Torhüter verfügbar!', 'error'); return; }
        if (p.trait === 'Elfmeter-Killer') { showToast('Hat die Eigenschaft bereits!', 'error'); return; }
        // Bugfix: die seltene Eigenschaft ließ sich bisher schon beim allerersten Versuch
        // erlernen - unrealistisch für eine Fähigkeit, die sich ein Torhüter eigentlich über
        // viele Pflichtspiele hinweg erarbeitet. Jetzt erst ab 80 Einsätzen zugänglich.
        const PENALTY_KILLER_MIN_APPEARANCES = 80;
        if ((p.appearances || 0) < PENALTY_KILLER_MIN_APPEARANCES) {
            showToast(`Braucht erst mehr Erfahrung: ${p.appearances || 0} / ${PENALTY_KILLER_MIN_APPEARANCES} Pflichtspielen!`, 'error');
            return;
        }
        let cost = 12000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        let chance = 0.08 + (p.defense - 60) * 0.002;
        if (Math.random() < Math.max(0.03, chance)) {
            p.trait = 'Elfmeter-Killer';
            pushTrainingHistoryEntry(`🥅 ${p.name} hat sich die seltene Eigenschaft "Elfmeter-Killer" antrainiert!`);
            showToast(`🥅 ${p.name} ist jetzt Elfmeter-Killer!`, 'success');
        } else {
            pushTrainingHistoryEntry(`🥅 Elfmeterkiller-Förderprogramm mit ${p.name} - noch kein Durchbruch.`);
            showToast('Noch kein Durchbruch - weiter versuchen!', 'error');
        }
        renderTrainingView();
        updateUI();
    }

    // 15. Team-Bonding-Event: stärkt die Eingespieltheit ALLER aktuellen Startelf-Paare auf
    // einen Schlag (nutzt das bestehende pairChemistry-System).
    function runTeamBondingEvent() {
        if (game.lastBondingEventMatchday && game.matchday - game.lastBondingEventMatchday < 5) {
            showToast(`Erst wieder ab Spieltag ${game.lastBondingEventMatchday + 5} möglich!`, 'error'); return;
        }
        let cost = 6000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        game.lastBondingEventMatchday = game.matchday;
        if (typeof tickPairChemistry === 'function') { tickPairChemistry(); tickPairChemistry(); } // doppelter Schub
        pushTrainingHistoryEntry('🍖 Team-Grillabend veranstaltet - die Mannschaft rückt spürbar näher zusammen.');
        showToast('🍖 Team-Bonding-Event durchgeführt - Eingespieltheit gestiegen!', 'success');
        renderTrainingView();
        updateUI();
    }

    // Sammel-Render-Funktion für alle neuen Zusatz-Boxen im Trainings-Screen.
    function renderTrainingExtras() {
        let intensityBox = document.getElementById('training-intensity-buttons');
        if (intensityBox) {
            ['locker', 'normal', 'hart'].forEach(lvl => {
                let btn = document.getElementById('intensity-btn-' + lvl);
                if (btn) { btn.classList.toggle('btn-action', game.trainingIntensity === lvl); btn.classList.toggle('btn-secondary', game.trainingIntensity !== lvl); }
            });
        }
        let videoBtn = document.getElementById('btn-video-analysis');
        if (videoBtn) videoBtn.innerText = game.lastVideoAnalysisMatchday === game.matchday ? '🎥 Video-Analyse bereits durchgeführt ✓' : '🎥 Video-Analyse-Einheit [2.500 €]';
        let mentalBox = document.getElementById('mental-training-status');
        if (mentalBox) mentalBox.innerText = `🧠 Mentaltraining: Stufe ${game.mentalTrainingLevel || 0}/3`;
        let injuryBtn = document.getElementById('btn-injury-prevention');
        if (injuryBtn) injuryBtn.innerText = game.injuryPreventionProgram ? '🩹 Verletzungsprävention AKTIV (einstellen)' : '🩹 Verletzungspräventions-Programm [5.000 €]';
        let doubleBtn = document.getElementById('btn-double-training');
        if (doubleBtn) doubleBtn.innerText = game.lastDoubleTrainingMatchday === game.matchday ? '💪 Doppeltraining bereits heute durchgeführt ✓' : '💪 Doppeltraining-Tag durchführen';
        let equipBtn = document.getElementById('btn-buy-equipment');
        if (equipBtn) equipBtn.innerText = game.equipmentLevel >= 3 ? '🎒 Trainingsausrüstung: Maximalstufe' : `🎒 Trainingsausrüstung ausbauen (Stufe ${game.equipmentLevel}/3) [${formatVal(8000 * (game.equipmentLevel + 1))}]`;
        let congestionBox = document.getElementById('congestion-warning-box');
        if (congestionBox) {
            let congested = checkFixtureCongestionWarning();
            congestionBox.style.display = congested ? 'block' : 'none';
            if (congested) congestionBox.innerHTML = `<div class="box" style="border-left-color:var(--danger); font-size:10px;">⚠️ Englische Woche voraus! <button onclick="applyCongestionRecommendation()" class="btn-secondary" style="width:auto; font-size:9px;">Schonplan übernehmen</button></div>`;
        }
        let hospitantBox = document.getElementById('youth-hospitant-list');
        if (hospitantBox) {
            let available = youthTalents.filter(p => !game.youthHospitants.includes(p.id));
            let current = game.youthHospitants.map(id => youthTalents.find(p => p.id === id)).filter(Boolean);
            hospitantBox.innerHTML = `
                ${current.map(p => `<div class="player-row" style="font-size:9px;"><span>⬆️ ${p.name} (hospitiert)</span><button onclick="removeYouthHospitant('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">Zurück</button></div>`).join('')}
                ${available.slice(0, 4).map(p => `<div class="player-row" style="font-size:9px;"><span>${p.name}</span><button onclick="addYouthHospitant('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">⬆️ Hospitieren</button></div>`).join('')}
                ${(current.length === 0 && available.length === 0) ? '<div style="font-size:9px; color:var(--text-muted);">Keine Jugendspieler in der Akademie.</div>' : ''}
            `;
        }
        renderTrainingHistoryLog();

        let killerSelect = document.getElementById('penalty-killer-select');
        if (killerSelect) {
            let keepers = squad.filter(p => p.pos === 'TW' && p.trait !== 'Elfmeter-Killer');
            const PENALTY_KILLER_MIN_APPEARANCES = 80;
            killerSelect.innerHTML = '<option value="">Torhüter wählen...</option>' + keepers.map(p => `<option value="${p.id}">${p.name} (${p.appearances || 0}/${PENALTY_KILLER_MIN_APPEARANCES} Einsätze${(p.appearances||0) >= PENALTY_KILLER_MIN_APPEARANCES ? ' ✓' : ''})</option>`).join('');
        }
        let athleticSelect = document.getElementById('athletic-test-select');
        if (athleticSelect) {
            athleticSelect.innerHTML = squad.map(p => `<option value="${p.id}">${p.name} (${p.pos})${p.athleticTested ? ' ✓' : ''}</option>`).join('');
        }
    }


    // ==========================================
    // TRAININGSSTAB-AUTOMATIK (PREMIUM)
    // ==========================================
    // Das Fähigkeitstraining verlangte bisher bei JEDEM Durchgang drei manuelle
    // Auswahlschritte (Spieler, Attribut, Trainer) - über eine Saison hinweg dutzendfach
    // dieselbe Klickstrecke. Wer will, überlässt das jetzt dem Trainerstab. Weil das echte
    // Spielzeit spart, kostet es Premium-Punkte und ist bewusst teuer: die Dauer-Automatik
    // liegt deutlich über dem teuersten regulären Booster (300 Punkte).
    const TRAINING_AUTOPILOT_COST = 500;
    const TRAINING_AUTOPILOT_DURATION = 10;
    const TRAINING_AUTOPICK_COST = 60;
    const MAX_PARALLEL_SKILL_TRAININGS = 3;

    // Sucht die sinnvollste Kombination aus Spieler, Attribut und Trainer: der schwächste
    // Wert eines noch untrainierten Spielers, bevorzugt bei jungen Spielern mit Luft nach
    // oben, und dazu der Trainer, der diese Kombination überhaupt abdecken darf.
    function findBestSkillTrainingCombo() {
        let verfuegbar = Object.keys(SKILL_TRAINING_COACHES).filter(k => staffMembers[k] && staffMembers[k].hired);
        if (verfuegbar.length === 0) return null;
        let imTraining = (game.skillTrainingQueue || []).map(s => s.playerId);
        let kandidaten = squad.filter(p => !imTraining.includes(p.id));
        if (kandidaten.length === 0) return null;

        let beste = null;
        kandidaten.forEach(p => {
            Object.keys(SKILL_TRAINING_STATS).forEach(stat => {
                verfuegbar.forEach(coachKey => {
                    let coach = SKILL_TRAINING_COACHES[coachKey];
                    if (coach.restrictToGK && p.pos !== 'TW') return;
                    if (!coach.restrictToGK && p.pos === 'TW' && coachKey !== 'coTrainer') return;
                    if (coach.restrictToStats && !coach.restrictToStats.includes(stat)) return;
                    // Je schwächer das Attribut und je jünger der Spieler, desto höher der
                    // Nutzen. Der garantierte Boost des Trainers zählt direkt mit.
                    let schwaeche = 100 - (p[stat] || 50);
                    let jugendbonus = Math.max(0, 28 - (p.age || 28)) * 2;
                    let score = schwaeche + jugendbonus + coach.boost * 3;
                    if (!beste || score > beste.score) {
                        beste = { score, playerId: p.id, playerName: p.name, stat, coachKey, coachName: coach.name, boost: coach.boost };
                    }
                });
            });
        });
        return beste;
    }

    // Einmalige Auswahlhilfe: füllt die drei Auswahlfelder optimal aus, gestartet wird
    // danach ganz normal von Hand (und aus dem Vereinskonto bezahlt).
    function autoPickSkillTraining() {
        if ((game.premiumPoints || 0) < TRAINING_AUTOPICK_COST) {
            showToast(`💎 Dafür brauchst du ${TRAINING_AUTOPICK_COST} Premium-Punkte (du hast ${game.premiumPoints || 0}).`, 'error', 4500);
            return;
        }
        let combo = findBestSkillTrainingCombo();
        if (!combo) { showToast('Kein geeigneter Trainer eingestellt oder alle Spieler bereits in Förderung.', 'error', 4500); return; }
        game.premiumPoints -= TRAINING_AUTOPICK_COST;
        playSound('click');
        populateSkillTrainingSelects();
        document.getElementById('skill-training-player-select').value = combo.playerId;
        document.getElementById('skill-training-stat-select').value = combo.stat;
        document.getElementById('skill-training-coach-select').value = combo.coachKey;
        showToast(`🤖 Vorschlag des Trainerstabs: ${combo.playerName} - ${SKILL_TRAINING_STATS[combo.stat]} bei ${combo.coachName}.`, 'success', 5000);
        renderTrainingAutopilotBox();
        updateUI();
    }

    function activateTrainingAutopilot() {
        if ((game.premiumPoints || 0) < TRAINING_AUTOPILOT_COST) {
            showToast(`💎 Die Automatik kostet ${TRAINING_AUTOPILOT_COST} Premium-Punkte (du hast ${game.premiumPoints || 0}).`, 'error', 4500);
            return;
        }
        if (Object.keys(SKILL_TRAINING_COACHES).every(k => !staffMembers[k] || !staffMembers[k].hired)) {
            showToast('Ohne passenden Trainer im Stab hat die Automatik niemanden, der fördern könnte.', 'error', 5000);
            return;
        }
        game.premiumPoints -= TRAINING_AUTOPILOT_COST;
        game.trainingAutopilotMatchdays = (game.trainingAutopilotMatchdays || 0) + TRAINING_AUTOPILOT_DURATION;
        playSound('goal');
        addInboxMessage('vertrag', '🤖 Trainingsstab-Automatik aktiviert',
            `Dein Trainerstab übernimmt für ${TRAINING_AUTOPILOT_DURATION} Spieltage die Förderplanung: Er wählt selbstständig Spieler, Attribut und Trainer und startet die Programme, solange das Vereinskonto sie trägt.`, 'screen-training');
        showToast(`🤖 Trainingsstab-Automatik für ${TRAINING_AUTOPILOT_DURATION} Spieltage aktiv!`, 'success', 5000);
        renderTrainingView();
        updateUI();
    }

    // Läuft jeden Spieltag mit (hängt an processPostMatchRoutine, damit sie auch beim
    // Durchsimulieren ganzer Saisons greift).
    function runTrainingAutopilotTick() {
        if (!(game.trainingAutopilotMatchdays > 0)) return;
        game.trainingAutopilotMatchdays--;
        if ((game.skillTrainingQueue || []).length >= MAX_PARALLEL_SKILL_TRAININGS) return;
        let combo = findBestSkillTrainingCombo();
        if (!combo) return;
        let kosten = getSkillTrainingCost(combo.coachKey);
        // Die Automatik wirtschaftet vorsichtig: sie stürzt den Verein nie ins Minus.
        if (game.money - kosten < 0) {
            pushTrainingAutopilotLog(`⚠️ Förderung von ${combo.playerName} ausgesetzt - ${formatVal(kosten)} nicht gedeckt.`);
            return;
        }
        game.money -= kosten;
        if (!game.skillTrainingQueue) game.skillTrainingQueue = [];
        let coach = SKILL_TRAINING_COACHES[combo.coachKey];
        game.skillTrainingQueue.push({
            playerId: combo.playerId, playerName: combo.playerName, stat: combo.stat,
            statLabel: SKILL_TRAINING_STATS[combo.stat], coachKey: combo.coachKey,
            coachName: combo.coachName, boost: coach.boost, matchdaysLeft: coach.days, totalDays: coach.days
        });
        pushTrainingAutopilotLog(`🤖 ${combo.playerName}: ${SKILL_TRAINING_STATS[combo.stat]} bei ${combo.coachName} (${formatVal(kosten)}).`);
        if (game.trainingAutopilotMatchdays === 0) {
            addInboxMessage('vertrag', '🤖 Trainingsstab-Automatik ausgelaufen', 'Die Förderplanung liegt wieder bei dir. Laufende Programme werden selbstverständlich zu Ende geführt.', 'screen-training');
        }
    }

    function pushTrainingAutopilotLog(text) {
        if (!Array.isArray(game.trainingAutopilotLog)) game.trainingAutopilotLog = [];
        game.trainingAutopilotLog.push({ season: game.season, matchday: game.matchday, text });
        if (game.trainingAutopilotLog.length > 20) game.trainingAutopilotLog.shift();
    }

    function renderTrainingAutopilotBox() {
        let box = document.getElementById('training-autopilot-box');
        if (!box) return;
        let rest = game.trainingAutopilotMatchdays || 0;
        let log = (game.trainingAutopilotLog || []).slice(-5).reverse();
        box.innerHTML = `
            <div class="box" style="font-size:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>🤖 Trainingsstab-Automatik</strong>
                    <span style="color:${rest > 0 ? 'var(--primary)' : 'var(--text-muted)'};">${rest > 0 ? `noch ${rest} Spieltage aktiv` : 'inaktiv'}</span>
                </div>
                <div style="color:#94a3b8; margin:3px 0 6px 0;">
                    Der Trainerstab wählt selbst Spieler, Attribut und Trainer und startet die Förderung -
                    auch während du ganze Saisons durchsimulierst. Die Trainingsgebühr zahlt weiterhin der Verein,
                    und die Automatik bucht nie ins Minus.
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                    <button onclick="autoPickSkillTraining()" class="btn-secondary" style="font-size:9px;">🎯 Einmal vorschlagen [${TRAINING_AUTOPICK_COST} 💎]</button>
                    <button onclick="activateTrainingAutopilot()" class="btn-action" style="font-size:9px;">🤖 ${TRAINING_AUTOPILOT_DURATION} Spieltage übernehmen [${TRAINING_AUTOPILOT_COST} 💎]</button>
                </div>
                <div style="font-size:9px; color:var(--text-muted); margin-top:4px;">Dein Guthaben: <strong style="color:var(--gold);">${game.premiumPoints || 0} 💎</strong></div>
                ${log.length > 0 ? `<div style="margin-top:6px; border-top:1px solid #1e293b; padding-top:4px;">
                    ${log.map(l => `<div style="font-size:9px; color:#94a3b8;">ST ${l.matchday}: ${l.text}</div>`).join('')}
                </div>` : ''}
            </div>`;
    }
