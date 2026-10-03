
    function renderCampusView() {
        renderStadiumConstructionBox('campus-construction-box', 'campusBuilding');
        let container = document.getElementById('campus-buildings-list');
        container.innerHTML = '';
        for (let key in campusBuildings) {
            let b = campusBuildings[key];
            let cost = getCampusUpgradeCost(key);
            let queued = (game.stadiumConstructionQueue || []).find(p => p.type === 'campusBuilding' && p.params.key === key);
            let row = document.createElement('div');
            row.className = 'panel';
            let buttonHtml = b.lvl >= b.max
                ? '<button class="btn-action" disabled>Voll ausgebaut ✓</button>'
                : queued
                    ? `<button class="btn-secondary" disabled>🏗️ Im Bau... (noch ${queued.daysLeft} SpT)</button>`
                    : `<button onclick="upgradeCampusBuilding('${key}')" class="btn-action">Ausbauen auf Stufe ${b.lvl+1} [${formatVal(cost)}] · Bauzeit ${getConstructionDays(cost)} SpT</button>`;
            row.innerHTML = `
                <div class="panel-header"><span>${b.name}</span><span style="color:var(--accent);">Stufe ${b.lvl}/${b.max}</span></div>
                <div style="font-size:9px; color:#aaa; margin-bottom:4px;">${b.desc}</div>
                ${buttonHtml}
            `;
            container.appendChild(row);
        }
    }

    function getCampusUpgradeCost(key) {
        let b = campusBuildings[key];
        // Liga-Skalierung (NEU): dieselbe steile Kurve wie bei Stadion-Ausbauten - realistische
        // Millionenbeträge im Spitzenfußball, erschwinglich in unteren Ligen. Trotzdem nie
        // unter 250.000 € (Mindestwert für auch nur das kleinste reale Bauprojekt in
        // Deutschland, siehe Baukosten-Recherche: selbst ein kleiner Umbau/Neubau kostet
        // real mindestens einen mittleren sechsstelligen Betrag).
        let scale = typeof getStadiumCostScale === 'function' ? getStadiumCostScale() : 1;
        return Math.max(250000, Math.round(b.baseCost * (b.lvl + 1) * scale));
    }
    function upgradeCampusBuilding(key) {
        let b = campusBuildings[key];
        let cost = getCampusUpgradeCost(key);
        if (b.lvl >= b.max) { showToast('Maximalstufe bereits erreicht!', 'error'); return; }
        // Echter Bau-Timer (NEU): Campus-Gebäude wurden bisher sofort fertig, ganz ohne
        // Bauzeit - unrealistisch für ein Bauprojekt in Millionenhöhe. Jetzt läuft es über
        // dieselbe Baustellen-Logik wie die Stadion-Ausbauten (30% Anzahlung, echte Bauzeit,
        // Rest bei Fertigstellung).
        if (typeof queueStadiumConstruction === 'function') {
            queueStadiumConstruction('campusBuilding', { key }, cost, getConstructionDays(cost), `${b.name} (Stufe ${b.lvl + 1})`);
            return;
        }
        // Rückfall (nur falls das Baustellen-System nicht geladen ist): alter Sofort-Effekt.
        if (game.money < cost) return;
        playSound('click');
        game.money -= cost;
        b.lvl++;
        renderCampusView();
        updateUI();
    }

    const STAFF_TASK_CONFIG = {
        fanshopManager: { tasks: () => FANSHOP_TASKS, setter: 'setFanshopManagerTask' },
        coTrainer: { tasks: () => CO_TRAINER_TASKS, setter: 'setCoTrainerTask' },
        fitCoach: { tasks: () => FIT_COACH_TASKS, setter: 'setFitCoachTask' },
        fanLiaison: { tasks: () => FAN_LIAISON_TASKS, setter: 'setFanLiaisonTask' },
        scout: { tasks: () => SCOUT_AUTOMATION_TASKS, setter: 'setScoutAutomationTask' },
        sportDir: { tasks: () => SPORT_DIR_TASKS, setter: 'setSportDirTask' },
        marketingDir: { tasks: () => MARKETING_DIR_TASKS, setter: 'setMarketingDirTask' },
        setPieceCoach: { tasks: () => SET_PIECE_TASKS, setter: 'setSetPieceCoachTask' },
        secChief: { tasks: () => SEC_CHIEF_TASKS, setter: 'setSecChiefTask' }
    };

    // ==========================================
    // ERWEITERTE PERSONAL-AUTOMATISIERUNG (NEU): 4 weitere Rollen mit wählbaren
    // Automatik-Aufgaben, analog zum bestehenden Muster bei Co-Trainer/Konditionstrainer/
    // Fanbeauftragtem/Fanshop-Manager.
    // ==========================================

    // 1. Chef-Scout: entsendet automatisch freie, eingestellte Regional-Scouts.
    const SCOUT_AUTOMATION_TASKS = [
        { id: 'aus', name: 'Manuell', desc: 'Du entsendest deine Scouts selbst.' },
        { id: 'auto_dispatch', name: 'Automatische Entsendung', desc: 'Sobald ein eingestellter Scout frei ist, wird er automatisch mit Standard-Fokus auf Reisen geschickt (wenn genug Geld vorhanden ist).' }
    ];
    function setScoutAutomationTask(taskId) {
        if (!SCOUT_AUTOMATION_TASKS.some(t => t.id === taskId)) return;
        staffMembers.scout.task = taskId;
        renderStaffView();
    }
    function runScoutAutomation() {
        if (!staffMembers.scout.hired || staffMembers.scout.task !== 'auto_dispatch') return;
        scoutingNetwork.scouts.forEach(s => {
            if (!s.hired) return;
            let busy = scoutingNetwork.activeMissions.some(m => m.scoutId === s.id);
            if (busy) return;
            let cfg = SCOUT_REGION_CONFIG[s.region];
            if (game.money >= cfg.baseCost * 1.5) startScoutingMission(s.region); // kleiner Sicherheitspuffer
        });
    }

    // 2. Sportdirektor: verlängert automatisch auslaufende Verträge wichtiger Spieler.
    const SPORT_DIR_TASKS = [
        { id: 'aus', name: 'Manuell', desc: 'Du kümmerst dich selbst um Vertragsverlängerungen.' },
        { id: 'auto_renew', name: 'Automatische Verlängerung', desc: 'Verlängert automatisch Verträge von Stammspielern (Stärke 60+), deren Vertrag am Saisonende ausläuft, sofern das Gehaltsbudget es zulässt.' }
    ];
    function setSportDirTask(taskId) {
        if (!SPORT_DIR_TASKS.some(t => t.id === taskId)) return;
        staffMembers.sportDir.task = taskId;
        renderStaffView();
    }
    function runSportDirAutomation() {
        if (!staffMembers.sportDir.hired || staffMembers.sportDir.task !== 'auto_renew') return;
        squad.forEach(p => {
            if (p.contracts > 1 || p.strength < 60) return;
            // Gleiche Gehaltsforderung wie im manuellen Gespräch (js/contracts.js)
            let d = getContractDemand(p);
            if (contractWageTotalWith(p, d.gehalt) > game.wageBudget * 0.95) return; // Budget-Sicherheitspuffer
            let agentFee = getAgentFee(p, d.handgeldProJahr);
            if (game.money < d.handgeldProJahr + agentFee) return;
            game.money -= (d.handgeldProJahr + agentFee);
            p.wage = d.gehalt;
            p.contracts++;
            addInboxMessage('vertrag', `📋 Automatische Vertragsverlängerung: ${p.name}`, `Der Sportdirektor hat den auslaufenden Vertrag von ${p.name} um ein Jahr verlängert - neues Gehalt ${formatVal(d.gehalt)} pro Spieltag.`, 'screen-squad');
        });
    }

    // 3. Marketing-Direktor: nimmt automatisch gute Sponsoren-Angebote an.
    const MARKETING_DIR_TASKS = [
        { id: 'aus', name: 'Manuell', desc: 'Du entscheidest selbst über Sponsoren-Angebote.' },
        { id: 'auto_accept', name: 'Gute Angebote automatisch annehmen', desc: 'Nimmt eingehende Sponsoren-Angebote automatisch an, wenn sie mindestens 10% über dem aktuellen Sponsor-Sockelbetrag liegen.' }
    ];
    function setMarketingDirTask(taskId) {
        if (!MARKETING_DIR_TASKS.some(t => t.id === taskId)) return;
        staffMembers.marketingDir.task = taskId;
        renderStaffView();
    }
    function runMarketingDirAutomation() {
        if (!staffMembers.marketingDir.hired || staffMembers.marketingDir.task !== 'auto_accept') return;
        if (typeof sponsorOffers === 'undefined' || sponsorOffers.length === 0) return;
        let best = [...sponsorOffers].sort((a, b) => b.base - a.base)[0];
        if (best && best.base >= (game.sponsor.base || 0) * 1.1) {
            acceptSponsorOffer(best.id);
            addInboxMessage('vertrag', `📈 Automatischer Sponsorenwechsel: ${best.name}`, `Der Marketing-Direktor hat eigenständig einen deutlich lukrativeren Sponsorenvertrag mit ${best.name} unterschrieben.`, 'screen-sponsors');
        }
    }

    // 4. Standards-Spezialist: weist automatisch die besten Spieler den Standard-Rollen zu.
    const SET_PIECE_TASKS = [
        { id: 'aus', name: 'Manuell', desc: 'Du wählst die Standard-Schützen selbst.' },
        { id: 'auto_assign', name: 'Beste Schützen automatisch wählen', desc: 'Weist Elfmeter, Freistoß und Ecke automatisch den statistisch am besten geeigneten Spielern im aktuellen Kader zu.' }
    ];
    function setSetPieceCoachTask(taskId) {
        if (!SET_PIECE_TASKS.some(t => t.id === taskId)) return;
        staffMembers.setPieceCoach.task = taskId;
        if (taskId === 'auto_assign') runSetPieceCoachAutomation();
        renderStaffView();
    }
    function runSetPieceCoachAutomation() {
        if (!staffMembers.setPieceCoach.hired || staffMembers.setPieceCoach.task !== 'auto_assign' || squad.length === 0) return;
        let bestShooter = [...squad].sort((a, b) => (b.shooting || 0) - (a.shooting || 0))[0];
        let bestPasser = [...squad].sort((a, b) => (b.passing || 0) - (a.passing || 0))[0];
        if (bestShooter) game.penaltyTakerId = bestShooter.id;
        if (bestPasser) { game.freeKickTakerId = bestPasser.id; game.cornerTakerId = bestPasser.id; }
    }

    function renderStaffView() {
        let container = document.getElementById('staff-list-container');
        container.innerHTML = '';

        // Übergeordnete Anzeigen: Budget-Obergrenze, Synergien, Bewerbungspool, Abwerbeversuch
        let summaryBox = document.getElementById('staff-summary-box');
        if (summaryBox) {
            let totalWages = getTotalStaffWages();
            let overBudget = staffCentralState.wageBudgetCap > 0 && totalWages > staffCentralState.wageBudgetCap;
            let synergies = getActiveStaffSynergies();
            summaryBox.innerHTML = `
                <div class="box" style="${overBudget ? 'border-left-color:var(--danger);' : ''}">
                    💼 Gesamtgehälter: <strong style="color:${overBudget ? 'var(--danger)' : 'var(--accent)'};">${formatVal(totalWages)}/SpT</strong>
                    ${staffCentralState.wageBudgetCap > 0 ? ` (Obergrenze: ${formatVal(staffCentralState.wageBudgetCap)})` : ''}
                    ${overBudget ? '<br><span style="color:var(--danger); font-size:9px;">⚠️ Budget überschritten!</span>' : ''}
                </div>
                <div style="display:flex; gap:4px; margin:4px 0;">
                    <button onclick="setStaffWageBudgetCap(5000)" class="btn-secondary" style="font-size:9px;">Cap 5.000 €</button>
                    <button onclick="setStaffWageBudgetCap(10000)" class="btn-secondary" style="font-size:9px;">Cap 10.000 €</button>
                    <button onclick="setStaffWageBudgetCap(0)" class="btn-secondary" style="font-size:9px;">Kein Cap</button>
                </div>
                <button onclick="holdAnnualStaffMeeting()" class="btn-secondary" style="margin-bottom:4px;">🤝 Jährliches Personal-Meeting</button>
                ${synergies.length > 0 ? synergies.map(s => `<div class="box" style="border-left-color:var(--primary); font-size:10px;">⚡ Synergie "${s.label}": ${s.desc}</div>`).join('') : ''}
            `;
        }
        let poachBox = document.getElementById('staff-poach-box');
        if (poachBox) {
            let p = staffCentralState.pendingPoach;
            poachBox.style.display = p ? 'block' : 'none';
            if (p) {
                let s = staffMembers[p.key];
                poachBox.innerHTML = `<div class="panel-header" style="color:var(--danger);">🎯 ABWERBEVERSUCH: ${s.name}</div>
                    <div class="box" style="font-size:10px;">Bindungsprämie zahlen (${formatVal(p.retentionCost)}) oder ziehen lassen?</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button onclick="resolveStaffPoaching(true)" class="btn-action">💰 Halten</button>
                        <button onclick="resolveStaffPoaching(false)" class="btn-secondary">👋 Ziehen lassen</button>
                    </div>`;
            }
        }
        let poolBox = document.getElementById('staff-candidate-pool-box');
        if (poolBox) {
            let pool = staffCentralState.candidatePool;
            poolBox.style.display = pool ? 'block' : 'none';
            if (pool) {
                let s = staffMembers[pool.key];
                poolBox.innerHTML = `<div class="panel-header">📋 BEWERBUNGSPOOL: ${s.name}</div>` +
                    pool.candidates.map((c, idx) => `<div class="box" style="display:flex; justify-content:space-between; align-items:center; font-size:10px;">
                        <span>${c.label} (${c.qualityLabel})</span>
                        <button onclick="hireFromCandidatePool(${idx})" class="btn-secondary" style="width:auto; font-size:9px;">${formatVal(Math.round(s.cost * c.costMult))}</button>
                    </div>`).join('') +
                    `<button onclick="staffCentralState.candidatePool=null; renderStaffView();" class="btn-secondary" style="margin-top:4px;">Abbrechen</button>`;
            }
        }

        for (let key in staffMembers) {
            let s = staffMembers[key];
            let meta = ensureStaffMeta(key);
            let row = document.createElement('div');
            row.className = 'player-row';
            row.style.flexDirection = 'column';
            row.style.alignItems = 'stretch';
            let taskSelector = '';
            let taskCfg = STAFF_TASK_CONFIG[key];
            if (taskCfg && s.hired) {
                let tasks = taskCfg.tasks();
                let options = tasks.map(t => `<option value="${t.id}" ${s.task === t.id ? 'selected' : ''}>${t.name}</option>`).join('');
                let currentTask = tasks.find(t => t.id === (s.task || tasks[0].id));
                taskSelector = `
                    <div style="margin-top:6px; font-size:9px;">
                        Aktuelle Aufgabe: <select class="input-inline" style="width:190px;" onchange="${taskCfg.setter}(this.value)">${options}</select><br>
                        <span style="color:#aaa;">${currentTask ? currentTask.desc : ''}</span>
                    </div>`;
            }
            let hiredExtras = '';
            if (s.hired) {
                let moraleColor = meta.morale >= 70 ? 'var(--primary)' : (meta.morale >= 40 ? 'var(--accent)' : 'var(--danger)');
                let onLeave = meta.onLeave > 0;
                hiredExtras = `
                    <div style="display:flex; justify-content:space-between; font-size:9px; margin-top:6px; color:var(--text-muted);">
                        <span>⭐ Stufe ${meta.level}/3</span>
                        <span>📄 Vertrag: ${meta.contractMatchdays} SpT</span>
                        <span style="color:${moraleColor};">😊 Moral: ${Math.round(meta.morale)}%</span>
                        <span>🕐 ${getStaffTenureSeasons(key)} Saison(en) dabei</span>
                    </div>
                    ${onLeave ? `<div class="box" style="border-left-color:var(--danger); font-size:9px; margin-top:4px;">🤒 Fällt noch ${meta.onLeave} SpT aus.${meta.interimActive ? ' (Interims-Ersatz aktiv)' : ` <button onclick="hireEmergencyInterim('${key}')" class="btn-secondary" style="width:auto; font-size:8px;">Interim buchen [${formatVal(s.wage*3)}]</button>`}</div>` : ''}
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:3px; margin-top:4px;">
                        ${(() => {
                            let trainingQueued = (game.stadiumConstructionQueue || []).find(q => q.type === 'staffTraining' && q.params.key === key);
                            if (meta.level >= 3) return `<button class="btn-secondary" disabled style="font-size:8px;">⭐ Max. Stufe ✓</button>`;
                            if (trainingQueued) return `<button class="btn-secondary" disabled style="font-size:8px;">🎓 In Weiterbildung (noch ${trainingQueued.daysLeft} SpT)</button>`;
                            return `<button onclick="upgradeStaffMember('${key}')" class="btn-secondary" style="font-size:8px;">⭐ Weiterbilden [${formatVal(Math.round(s.cost*STAFF_UPGRADE_COST_FACTOR*meta.level))}]</button>`;
                        })()}
                        <button onclick="renewStaffContract('${key}')" class="btn-secondary" style="font-size:8px;">📄 Verlängern [${formatVal(Math.round(s.cost*0.4))}]</button>
                        <button onclick="giveStaffRaise('${key}')" class="btn-secondary" style="font-size:8px;">💰 Gehaltserhöhung [${formatVal(s.wage*5)}]</button>
                    </div>
                `;
            }
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div><strong>${s.name}</strong> (${s.hired ? '<span style="color:var(--primary);">Aktiv</span>' : 'Frei'})<br><span style="color:#aaa;">${s.desc}</span></div>
                    <button onclick="${s.hired ? `toggleStaffMember('${key}', this)` : `openCandidatePool('${key}')`}" class="${s.hired ? 'btn-danger' : 'btn-action'}" style="width:auto;">${s.hired ? 'Entlassen' : 'Einstellen'}</button>
                </div>
                ${taskSelector}
                ${hiredExtras}
            `;
            container.appendChild(row);
        }
    }

    // Kabinen-Dynamik (Cliquen, Rangordnung, Kapitänsfrage) liegt seit Phase 20.2 in
    // js/locker-room.js; den früheren zweiten "Führungsspieler-Rat" ersetzt der Mannschaftsrat.

    function toggleStaffMember(key, btn) {
        // Nur das Entlassen ist folgenreich - beim Einstellen wird nicht nachgefragt.
        if (staffMembers[key] && staffMembers[key].hired && !requireConfirm(btn, 'Wirklich entlassen?')) return;
        let s = staffMembers[key];
        playSound('click');
        if (s.hired) {
            // 4. Abfindung bei Kündigung: Entlassung kostet jetzt eine Abfindung (ein Monatsgehalt
            // je Ausbaustufe), statt komplett kostenlos zu sein.
            let meta = ensureStaffMeta(key);
            let severance = s.wage * meta.level;
            if (severance > 0 && game.money >= severance) {
                game.money -= severance;
                showToast(`💸 Abfindung für ${s.name}: ${formatVal(severance)}`, 'error');
            }
            s.hired = false;
            staffMeta[key] = { level: 1, contractMatchdays: 34, morale: 80, hiredSeason: null, contributionScore: 0 };
        } else if (staffHireBreaksCap(s)) {
            showToast(`💼 ${s.name} würde die Personalbudget-Obergrenze von ${formatVal(staffCentralState.wageBudgetCap)}/SpT sprengen. Obergrenze anheben oder aufheben.`, 'error', 4500);
        } else if (game.money >= s.cost) {
            game.money -= s.cost;
            s.hired = true;
            let meta = ensureStaffMeta(key);
            meta.contractMatchdays = 34;
            meta.morale = 80;
            meta.hiredSeason = game.season;
            meta.level = 1;
        } else {
            showToast(`Nicht genug Geld! Benötigt: ${formatVal(s.cost)}`, 'error');
        }
        renderStaffView();
        updateUI();
    }

    // ==========================================
    // PERSONAL: 15 NEUE FUNKTIONEN
    // ==========================================

    // 1. Personal-Ausbaustufen: jeder Mitarbeiter lässt sich bis Stufe 3 weiterbilden,
    // wobei die jeweilige Wirkung mit der Stufe skaliert (siehe getStaffLevelMultiplier()).
    const STAFF_UPGRADE_COST_FACTOR = 0.6;
    function getStaffLevelMultiplier(key) {
        let meta = staffMeta[key];
        return meta ? meta.level : 1;
    }
    function upgradeStaffMember(key) {
        let s = staffMembers[key];
        if (!s.hired) return;
        let meta = ensureStaffMeta(key);
        if (meta.level >= 3) { showToast('Maximale Ausbaustufe bereits erreicht!', 'error'); return; }
        let cost = Math.round(s.cost * STAFF_UPGRADE_COST_FACTOR * meta.level);
        // Bugfix: Weiterbildungen wurden bisher sofort abgeschlossen, ganz ohne Zeitaufwand -
        // unrealistisch für eine echte Fortbildung/Schulung. Läuft jetzt über dieselbe
        // Baustellen-Logik wie Stadion/Campus/Immobilien, aber mit einer kürzeren, zu einer
        // Schulung passenden Dauer statt einer mehrwöchigen Bauzeit.
        if (typeof queueStadiumConstruction === 'function') {
            let days = Math.max(3, Math.min(8, Math.round(cost / 8000)));
            queueStadiumConstruction('staffTraining', { key }, cost, days, `Weiterbildung: ${s.name} (Stufe ${meta.level + 1})`);
            return;
        }
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        meta.level++;
        showToast(`⭐ ${s.name} auf Stufe ${meta.level} weitergebildet!`, 'success');
        renderStaffView();
        updateUI();
    }

    // 2. Personalverträge mit Laufzeit: zählt pro Spieltag herunter (Hook in match.js),
    // erinnert rechtzeitig per Postfach an eine anstehende Vertragsverlängerung.
    function renewStaffContract(key) {
        let s = staffMembers[key];
        if (!s.hired) return;
        let meta = ensureStaffMeta(key);
        let cost = Math.round(s.cost * 0.4);
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        meta.contractMatchdays = 34;
        meta.morale = Math.min(100, meta.morale + 10);
        showToast(`📄 Vertrag von ${s.name} verlängert!`, 'success');
        renderStaffView();
        updateUI();
    }
    function tickStaffContracts() {
        for (let key in staffMembers) {
            let s = staffMembers[key];
            if (!s.hired) continue;
            let meta = ensureStaffMeta(key);
            meta.contractMatchdays--;
            if (meta.contractMatchdays === 5) {
                addInboxMessage('vertrag', `📄 Vertrag von ${s.name} läuft bald aus!`, `Der Vertrag von ${s.name} endet in 5 Spieltagen - jetzt im Personal-Screen verlängern, sonst verlässt er/sie den Verein automatisch.`, 'screen-staff');
            }
            if (meta.contractMatchdays <= 0) {
                s.hired = false;
                addInboxMessage('vertrag', `📄 ${s.name} hat den Verein verlassen!`, `Der Vertrag von ${s.name} ist ausgelaufen und wurde nicht rechtzeitig verlängert.`, 'screen-staff');
            }
        }
    }

    // 3. Abwerbeversuche von Konkurrenzvereinen: zufälliges Ereignis, Retention-Zahlung hält
    // den Mitarbeiter, sonst verlässt er den Verein sofort.
    function checkStaffPoachingAttempt() {
        let hiredKeys = Object.keys(staffMembers).filter(k => staffMembers[k].hired);
        if (hiredKeys.length === 0 || staffCentralState.pendingPoach) return;
        if (Math.random() > 0.02) return;
        let key = hiredKeys[Math.floor(Math.random() * hiredKeys.length)];
        let s = staffMembers[key];
        let retentionCost = s.wage * 15;
        staffCentralState.pendingPoach = { key, retentionCost };
        addInboxMessage('vertrag', `🎯 Abwerbeversuch: ${s.name}!`, `Ein Konkurrenzverein bietet ${s.name} deutlich mehr Geld. Zahle ${formatVal(retentionCost)} Bindungsprämie, um ihn/sie zu halten (Personal-Screen), sonst wechselt er/sie den Verein!`, 'screen-staff');
    }
    function resolveStaffPoaching(pay) {
        let pending = staffCentralState.pendingPoach;
        if (!pending) return;
        let s = staffMembers[pending.key];
        if (pay) {
            if (game.money < pending.retentionCost) { showToast('Nicht genug Geld für die Bindungsprämie!', 'error'); return; }
            game.money -= pending.retentionCost;
            ensureStaffMeta(pending.key).morale = 100;
            showToast(`✅ ${s.name} bleibt im Verein!`, 'success');
        } else {
            s.hired = false;
            showToast(`😢 ${s.name} hat den Verein verlassen.`, 'error');
        }
        staffCentralState.pendingPoach = null;
        renderStaffView();
        updateUI();
    }

    // 5. Personal-Zufriedenheit: niedrige Moral reduziert die Wirksamkeit (siehe
    // getStaffEffectivenessMultiplier(), von anderen Systemen genutzt).
    function getStaffEffectivenessMultiplier(key) {
        let meta = staffMeta[key];
        if (!meta) return 1;
        if (meta.morale >= 70) return 1;
        if (meta.morale >= 40) return 0.85;
        return 0.65;
    }
    // 6. Gehaltserhöhung gewähren: manuelle Moral-Auffrischung.
    function giveStaffRaise(key) {
        let s = staffMembers[key];
        if (!s.hired) return;
        let meta = ensureStaffMeta(key);
        let raiseCost = s.wage * 5;
        if (game.money < raiseCost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(raiseCost)}`, 'error'); return; }
        playSound('click');
        game.money -= raiseCost;
        s.wage = Math.round(s.wage * 1.1);
        meta.morale = Math.min(100, meta.morale + 20);
        showToast(`💰 Gehaltserhöhung für ${s.name} - Zufriedenheit deutlich gestiegen!`, 'success');
        renderStaffView();
        updateUI();
    }
    // Moral sinkt langsam von selbst, wenn man sich nie kümmert - Hook pro Spieltag.
    function tickStaffMorale() {
        for (let key in staffMembers) {
            if (!staffMembers[key].hired) continue;
            let meta = ensureStaffMeta(key);
            meta.morale = Math.max(20, meta.morale - 0.3);
        }
    }

    // 10. Personal-Synergien: bestimmte Mitarbeiter-Kombinationen geben einen Bonus,
    // dargestellt als Info-Box und in getSynergyBonus() für andere Systeme nutzbar.
    const STAFF_SYNERGIES = [
        { pair: ['fitCoach', 'physio'], label: 'Reha-Tandem', desc: '-10% zusätzliches Verletzungsrisiko', bonusKey: 'injuryReduction', bonusVal: 0.1 },
        { pair: ['coTrainer', 'analyst'], label: 'Perfekte Vorbereitung', desc: '+1 zusätzliche Team-Stärke', bonusKey: 'strength', bonusVal: 1 },
        { pair: ['scout', 'sportDir'], label: 'Verhandlungsprofis', desc: 'Weitere 5% Rabatt bei Transfers', bonusKey: 'transferDiscount', bonusVal: 0.05 }
    ];
    function getActiveStaffSynergies() {
        return STAFF_SYNERGIES.filter(syn => syn.pair.every(k => staffMembers[k].hired));
    }

    // 11. Bewerbungspool bei Neueinstellung: statt eines Fixpreises gibt es 3 Kandidaten
    // mit unterschiedlicher Qualität/Kosten zur Auswahl.
    function openCandidatePool(key) {
        let s = staffMembers[key];
        if (s.hired) { showToast('Diese Position ist bereits besetzt!', 'error'); return; }
        let candidates = [
            { label: 'Günstige Nachwuchskraft', costMult: 0.7, moraleStart: 60, qualityLabel: 'einfach' },
            { label: 'Solider Standardkandidat', costMult: 1.0, moraleStart: 80, qualityLabel: 'Standard' },
            { label: 'Renommierte Fachkraft', costMult: 1.6, moraleStart: 95, qualityLabel: 'Elite' }
        ];
        staffCentralState.candidatePool = { key, candidates };
        renderStaffView();
    }
    function hireFromCandidatePool(idx) {
        let pool = staffCentralState.candidatePool;
        if (!pool) return;
        let key = pool.key;
        let cand = pool.candidates[idx];
        let s = staffMembers[key];
        let cost = Math.round(s.cost * cand.costMult);
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        if (staffHireBreaksCap(s)) { showToast(`💼 ${s.name} würde die Personalbudget-Obergrenze von ${formatVal(staffCentralState.wageBudgetCap)}/SpT sprengen.`, 'error', 4500); return; }
        playSound('goal');
        game.money -= cost;
        s.hired = true;
        let meta = ensureStaffMeta(key);
        meta.contractMatchdays = 34;
        meta.morale = cand.moraleStart;
        meta.hiredSeason = game.season;
        meta.level = cand.costMult >= 1.6 ? 2 : 1;
        staffCentralState.candidatePool = null;
        showToast(`✅ ${cand.label} als ${s.name} eingestellt!`, 'success');
        renderStaffView();
        updateUI();
    }

    // 12. Jährliches Personal-Meeting: Saisonstart-Event, kleiner Moral-Schub für Team & Personal.
    function holdAnnualStaffMeeting() {
        if (staffCentralState.lastMeetingSeason === game.season) { showToast('Das Meeting für diese Saison wurde bereits abgehalten!', 'error'); return; }
        playSound('click');
        staffCentralState.lastMeetingSeason = game.season;
        for (let key in staffMembers) { if (staffMembers[key].hired) ensureStaffMeta(key).morale = Math.min(100, ensureStaffMeta(key).morale + 8); }
        squad.forEach(p => { p.morale = Math.min(100, p.morale + 2); });
        showToast('🤝 Jährliches Personal-Meeting abgehalten - spürbarer Motivationsschub!', 'success');
        renderStaffView();
        updateUI();
    }

    // 13. Personalbudget-Obergrenze: Neueinstellungen über dem Limit werden abgelehnt
    // (früher nur eine rote Anzeige ohne jede Wirkung).
    function staffHireBreaksCap(s) {
        let cap = staffCentralState.wageBudgetCap || 0;
        return cap > 0 && !s.hired && getTotalStaffWages() + s.wage > cap;
    }
    function setStaffWageBudgetCap(cap) {
        staffCentralState.wageBudgetCap = cap;
        renderStaffView();
        showToast(cap > 0 ? `💼 Personalbudget-Obergrenze: ${formatVal(cap)}/SpT - Einstellungen darüber werden abgelehnt.` : '💼 Keine Personalbudget-Obergrenze mehr.', 'success');
    }
    function getTotalStaffWages() {
        return Object.values(staffMembers).filter(s => s.hired).reduce((sum, s) => sum + s.wage, 0);
    }

    // 14. Personal-Erfolgsbilanz: Amtszeit + kumulierter Beitrag (grober Näherungswert aus
    // Ausbaustufe * Betriebszugehörigkeit), rein informativ im UI dargestellt.
    function getStaffTenureSeasons(key) {
        let meta = staffMeta[key];
        if (!meta || meta.hiredSeason === null) return 0;
        return Math.max(0, game.season - meta.hiredSeason);
    }

    // 15. Notfall-Interims-Personal: zufälliges "Krankheits"-Ereignis, Interims-Ersatz mit
    // reduzierter Wirkung gegen Aufpreis buchbar.
    function checkStaffEmergencyAbsence() {
        let hiredKeys = Object.keys(staffMembers).filter(k => staffMembers[k].hired && !staffMeta[k]?.onLeave);
        if (hiredKeys.length === 0) return;
        if (Math.random() > 0.01) return;
        let key = hiredKeys[Math.floor(Math.random() * hiredKeys.length)];
        let meta = ensureStaffMeta(key);
        meta.onLeave = 3;
        addInboxMessage('vertrag', `🤒 ${staffMembers[key].name} fällt kurzfristig aus!`, `${staffMembers[key].name} ist für 3 Spieltage nicht verfügbar. Interims-Ersatz gegen Aufpreis im Personal-Screen buchbar (reduzierte Wirkung).`, 'screen-staff');
    }
    function hireEmergencyInterim(key) {
        let meta = staffMeta[key];
        if (!meta || !meta.onLeave) return;
        let cost = staffMembers[key].wage * 3;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        meta.interimActive = true;
        showToast(`✅ Interims-Ersatz für ${staffMembers[key].name} gebucht.`, 'success');
        renderStaffView();
        updateUI();
    }
    function tickStaffEmergencyLeave() {
        for (let key in staffMeta) {
            let meta = staffMeta[key];
            if (meta.onLeave > 0) {
                meta.onLeave--;
                if (meta.onLeave === 0) meta.interimActive = false;
            }
        }
    }

