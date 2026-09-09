    // Zuschauerranking: die Top-Heimspiele nach Zuschauerzahl über die gesamte Karriere,
    // damit sichtbar wird, welche Spiele die volleren Ränge gebracht haben.
    // Zuschauerentwicklung als Diagramm: einfacher Balkenverlauf der letzten Heimspiele,
    // damit der Trend auf einen Blick sichtbar wird statt nur die reine Bestenliste.
    function renderAttendanceChart(targetBoxId = 'attendance-chart-box') {
        let box = document.getElementById(targetBoxId);
        if (!box) return;
        let history = (game.attendanceHistory || []).slice(-10);
        if (history.length === 0) { box.innerHTML = '<div class="box" style="font-size:10px; color:var(--text-muted);">Noch keine Heimspiel-Daten.</div>'; return; }
        // Liga-Vergleich: durchschnittlich zu erwartende Zuschauerzahl bei "normaler" (75%)
        // Fan-Zufriedenheit in der aktuellen Liga, als Referenzlinie im Diagramm.
        let leagueAvgAttendance = Math.round((stadium.total || 16000) * (LEAGUE_ATTENDANCE_CEILING[game.leagueLevel] ?? LEAGUE_ATTENDANCE_CEILING[LEAGUE_ATTENDANCE_CEILING.length - 1]));
        let maxAtt = Math.max(...history.map(e => e.attendance), leagueAvgAttendance, 1);
        let refLinePct = Math.round((leagueAvgAttendance / maxAtt) * 100);
        box.innerHTML = `<div style="position:relative; height:70px; background:rgba(0,0,0,0.2); border-radius:6px; padding:6px;">
            <div style="position:absolute; left:6px; right:6px; bottom:${6 + refLinePct * 0.58}px; border-top:1px dashed var(--accent); z-index:2;" title="Liga-Durchschnitt: ${leagueAvgAttendance.toLocaleString('de-DE')}"></div>
            <div style="display:flex; align-items:flex-end; gap:3px; height:100%;">
                ${history.map(e => {
                    let heightPct = Math.max(4, Math.round((e.attendance / maxAtt) * 100));
                    return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;" title="Spieltag ${e.matchday}: ${e.attendance.toLocaleString('de-DE')} Zuschauer">
                        <div style="width:100%; height:${heightPct}%; background:linear-gradient(to top, var(--teal), var(--primary)); border-radius:2px 2px 0 0; min-height:3px;"></div>
                    </div>`;
                }).join('')}
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:8px; color:var(--text-muted); margin-top:2px;">
            <span>Spieltag ${history[0].matchday}</span>
            <span style="color:var(--accent);">- - - Liga-Ø: ${leagueAvgAttendance.toLocaleString('de-DE')}</span>
            <span>Spieltag ${history[history.length - 1].matchday}</span>
        </div>`;
    }

    function renderAttendanceRanking() {
        let box = document.getElementById('attendance-ranking-box');
        if (!box) return;
        let history = (game.attendanceHistory || []).slice().sort((a, b) => b.attendance - a.attendance).slice(0, 8);
        if (history.length === 0) {
            box.innerHTML = '<div class="box" style="font-size:10px; color:var(--text-muted);">Noch keine Heimspiele ausgetragen.</div>';
            return;
        }
        box.innerHTML = history.map((e, idx) => {
            let pct = Math.round((e.attendance / e.capacity) * 100);
            return `<div class="box" style="display:flex; justify-content:space-between; font-size:10px;">
                <span>#${idx + 1} Saison ${e.season}, Spieltag ${e.matchday} vs. ${e.opponent}</span>
                <strong style="color:var(--accent);">${e.attendance.toLocaleString('de-DE')} (${pct}%)</strong>
            </div>`;
        }).join('');
    }

    function renderFansView() {
        renderSecurityWorkforceBox();
        renderAttendanceChart();
        renderAttendanceRanking();
        renderFanFeed();
        let moodEl = document.getElementById('fan-mood-val');
        if (moodEl) moodEl.innerText = game.fans + '%';
        let countEl = document.getElementById('stewards-count-disp');
        if (countEl) countEl.innerText = game.stewards;
        let safetyEl = document.getElementById('stewards-safety-disp');
        if (safetyEl) safetyEl.innerText = Math.min(99, Math.round(game.stewards / 3.5)) + '%';

        let list = document.getElementById('fan-groups-list');
        list.innerHTML = '';
        fanGroups.forEach(g => {
            let action = FAN_GROUP_ACTIONS[g.id];
            let row = document.createElement('div');
            row.className = 'box';
            row.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${g.name}</strong><span style="color:var(--primary);">${g.mood}%</span></div>
                <div style="color:#94a3b8; font-size:10px; margin-bottom:4px;">${g.desc}</div>
                ${action ? `<button onclick="runFanGroupAction('${g.id}')" class="btn-secondary" style="font-size:9px;" title="${action.desc}">${action.label}${action.cost > 0 ? ` [${formatVal(action.cost)}]` : ''}</button>` : ''}`;
            list.appendChild(row);
        });

        // Neue Fan-Zentrale-Funktionen: Mitgliedschaften, Fanprojekt & Fanbus-Status
        let memberBox = document.getElementById('fan-membership-box');
        if (memberBox) memberBox.innerHTML = `<span>👥 Vereinsmitglieder: <strong style="color:var(--accent);">${(fanCentralState.memberships || 0).toLocaleString('de-DE')}</strong></span><span style="font-size:9px; color:var(--text-muted);"> (~${formatVal(collectMembershipFees())}/Heimspiel)</span>`;
        let projectBtn = document.getElementById('btn-fan-project');
        if (projectBtn) projectBtn.innerText = fanCentralState.fanProjectFunded ? '🤝 Fanprojekt AKTIV (auflösen)' : '🤝 Fanprojekt einrichten [4.000 €]';
        let busBtn = document.getElementById('btn-fan-bus');
        if (busBtn) busBtn.innerText = fanCentralState.fanBusProgramActive ? '🚌 Fanbus-Programm AKTIV (einstellen)' : '🚌 Fanbus-Programm einrichten [6.000 €]';
        let scarfBtn = document.getElementById('btn-scarf-contest');
        if (scarfBtn) scarfBtn.innerText = fanCentralState.scarfContestCooldown > 0 ? `🧣 Wettbewerb (noch ${fanCentralState.scarfContestCooldown} SpT gesperrt)` : '🧣 Schal-Design-Wettbewerb [3.000 €]';
        let surveyBox = document.getElementById('fan-survey-result');
        if (surveyBox) surveyBox.innerText = fanCentralState.lastSurveyResult ? `Letzte Umfrage: "${fanCentralState.lastSurveyResult.topic}" ${fanCentralState.lastSurveyResult.satisfied ? '(zufrieden ✓)' : '(Nachholbedarf)'}` : 'Noch keine Umfrage durchgeführt.';
        let traditionBox = document.getElementById('tradition-status-box');
        if (traditionBox) traditionBox.innerText = fanCentralState.traditionClubStatus ? '🏛️ Traditionsverein-Status: ERREICHT' : '🏛️ Traditionsverein-Status: noch nicht erreicht (90%+ Alte-Garde-Stimmung ab Saison 3)';

        // Kritischer Fan-Brief: Antwort-Buttons nur einblenden, wenn eine Anfrage offen ist.
        let letterBox = document.getElementById('critical-fan-letter-box');
        if (letterBox) {
            letterBox.style.display = fanCentralState.pendingCriticalLetter ? 'block' : 'none';
        }

        // Jugend-Patenschaften
        let sponsorBox = document.getElementById('youth-sponsorship-list');
        if (sponsorBox) {
            let unsponsored = youthTalents.filter(p => !fanCentralState.youthSponsorships.some(s => s.playerId === p.id));
            sponsorBox.innerHTML = unsponsored.length === 0
                ? '<div style="font-size:9px; color:var(--text-muted);">Alle Jugendspieler haben bereits eine Patenschaft, oder die Akademie ist leer.</div>'
                : unsponsored.slice(0, 5).map(p => `<div class="player-row" style="font-size:9px;"><span>${p.name} (${p.pos})</span><button onclick="sponsorYouthPlayerByFans('${p.id}')" class="btn-secondary" style="width:auto; font-size:9px;">🌟 Patenschaft</button></div>`).join('');
        }
    }

    function setStewards(count) { 
        playSound('click'); 
        game.stewards = count; 
        renderFansView();
        updateUI(); 
    }

    // ==========================================
    // EIGENE AUSBILDUNG VON ORDNERN & SICHERHEITSKRÄFTEN (NEU)
    // ==========================================
    // Bisher gab es nur "Ordner mieten" (game.stewards, pro Spieltag neu gebucht, nie
    // wirklich abgerechnet - siehe Fix unten) ohne jede Qualitäts-Ebene. Jetzt kann der
    // Verein über die neue Sicherheitsakademie (Campus-Gebäude) eine EIGENE, dauerhafte
    // Ordner-Truppe aufbauen und über Schulungen die Qualität statt nur die Menge steigern.

    // 1. Ordner fest anstellen: einmalige Anstellungskosten, danach laufen sie NICHT mehr
    // über die pro-Spieltag-Miete, sondern erhalten stattdessen ein festes, meist
    // günstigeres Gehalt (siehe Kosten-Fix weiter unten).
    function hirePermanentStewards(count) {
        let academyLvl = campusBuildings.securityAcademy?.lvl || 0;
        let maxPermanent = academyLvl * 15;
        if (securityWorkforce.permanentStewards + count > maxPermanent) {
            showToast(`Sicherheitsakademie zu klein! Maximal ${maxPermanent} feste Ordner bei aktueller Ausbaustufe.`, 'error');
            return;
        }
        let costPerSteward = 8000;
        let totalCost = costPerSteward * count;
        if (game.money < totalCost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(totalCost)}`, 'error'); return; }
        playSound('goal');
        game.money -= totalCost;
        securityWorkforce.permanentStewards += count;
        addInboxMessage('vertrag', `🛡️ ${count} Ordner fest angestellt!`, `Der Verein beschäftigt jetzt ${securityWorkforce.permanentStewards} fest angestellte Ordner - günstiger im Unterhalt als Miet-Personal und immer verfügbar.`, 'screen-fans');
        showToast(`🛡️ ${count} Ordner fest angestellt!`, 'success');
        renderFansView();
        updateUI();
    }

    // 2. Schulungen: verbessert die Qualität (Skill-Level 1-5) statt nur die Menge -
    // erfahrene, gut ausgebildete Ordner verhindern Vorfälle deutlich wirksamer.
    function trainStewardSkill() {
        let academyLvl = campusBuildings.securityAcademy?.lvl || 0;
        if (academyLvl === 0) { showToast('Dafür wird zuerst eine Sicherheitsakademie benötigt (Campus)!', 'error'); return; }
        let maxSkill = Math.min(5, academyLvl + 1);
        if (securityWorkforce.skillLevel >= maxSkill) { showToast(`Maximale Schulungsstufe für die aktuelle Akademie-Ausbaustufe erreicht (${maxSkill})!`, 'error'); return; }
        if (securityWorkforce.lastTrainingMatchday === game.matchday) { showToast('Heute schon eine Schulung durchgeführt!', 'error'); return; }
        let cost = 15000 * securityWorkforce.skillLevel;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        securityWorkforce.skillLevel++;
        securityWorkforce.lastTrainingMatchday = game.matchday;
        addInboxMessage('vertrag', `🎓 Ordner-Schulung abgeschlossen!`, `Die Sicherheitskräfte wurden erfolgreich weitergebildet - Qualifikationsstufe jetzt ${securityWorkforce.skillLevel}/5.`, 'screen-fans');
        showToast(`🎓 Schulung abgeschlossen: Stufe ${securityWorkforce.skillLevel}/5!`, 'success');
        renderFansView();
        updateUI();
    }

    // Wird jeden Spieltag aufgerufen: berechnet und bucht die tatsächlichen Ordner-Kosten ab
    // (Bugfix: bisher wurde nur im Finanz-Ausblick ein Betrag ANGEZEIGT, aber nie wirklich
    // abgebucht) - feste Ordner kosten dabei spürbar weniger als angemietetes Personal.
    function getStewardMatchdayCost() {
        let rentedCost = (game.stewards || 0) * 120 * 2;
        let permanentCost = securityWorkforce.permanentStewards * 90; // güntiger als Miete
        return rentedCost + permanentCost;
    }
    function tickStewardCosts() {
        game.money -= getStewardMatchdayCost();
    }

    // Automatisierung für den Sicherheitschef (NEU): führt Schulungen automatisch durch,
    // sobald möglich - passend zum bestehenden Muster bei anderen Personal-Rollen.
    const SEC_CHIEF_TASKS = [
        { id: 'aus', name: 'Manuell', desc: 'Du entscheidest selbst über Ordner-Schulungen und Festanstellungen.' },
        { id: 'auto_train', name: 'Automatische Schulungen', desc: 'Führt automatisch eine Schulung durch, sobald eine verfügbar und bezahlbar ist.' }
    ];
    function setSecChiefTask(taskId) {
        if (!SEC_CHIEF_TASKS.some(t => t.id === taskId)) return;
        staffMembers.secChief.task = taskId;
        renderStaffView();
    }
    function runSecChiefAutomation() {
        if (!staffMembers.secChief.hired || staffMembers.secChief.task !== 'auto_train') return;
        let academyLvl = campusBuildings.securityAcademy?.lvl || 0;
        let maxSkill = Math.min(5, academyLvl + 1);
        if (academyLvl === 0 || securityWorkforce.skillLevel >= maxSkill) return;
        if (securityWorkforce.lastTrainingMatchday === game.matchday) return;
        let cost = 15000 * securityWorkforce.skillLevel;
        if (game.money < cost * 1.5) return; // Sicherheitspuffer
        trainStewardSkill();
    }

    function renderSecurityWorkforceBox() {
        let box = document.getElementById('security-workforce-box');
        if (!box) return;
        let academyLvl = campusBuildings.securityAcademy?.lvl || 0;
        let maxPermanent = academyLvl * 15;
        let maxSkill = Math.min(5, academyLvl + 1);
        box.innerHTML = `
            <div class="box" style="font-size:10px; margin-bottom:6px;">
                🛡️ Fest angestellte Ordner: <strong>${securityWorkforce.permanentStewards} / ${maxPermanent}</strong><br>
                🎓 Ausbildungsstufe: <strong>${securityWorkforce.skillLevel} / ${maxSkill}</strong>${academyLvl === 0 ? ' <span style="color:var(--danger);">(Sicherheitsakademie fehlt!)</span>' : ''}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                <button onclick="hirePermanentStewards(5)" class="btn-secondary" style="font-size:9px;" ${academyLvl===0?'disabled':''}>+5 Ordner fest anstellen [40.000 €]</button>
                <button onclick="trainStewardSkill()" class="btn-secondary" style="font-size:9px;" ${academyLvl===0?'disabled':''}>🎓 Schulung [${formatVal(15000*securityWorkforce.skillLevel)}]</button>
            </div>
        `;
    }

    function runFanAction(act, cost) {
        if (game.money < cost) return;
        playSound('click');
        game.money -= cost;
        game.fans = Math.min(100, game.fans + 5);
        renderFansView();
        updateUI();
    }

    // ==========================================
    // FANBEAUFTRAGTER: PASSIVER EFFEKT + WÄHLBARE TICKETPREIS-AUTOMATIK
    // ==========================================
    const FAN_LIAISON_TASKS = [
        { id: 'aus', name: 'Manuell (Manager entscheidet)', desc: 'Keine Automatik - du legst die Ticketpreise selbst fest.' },
        { id: 'guenstig', name: 'Zufriedenheit priorisieren', desc: 'Niedrige Preise, dafür spürbarer Zufriedenheits-Bonus für die Fans.' },
        { id: 'ausgewogen', name: 'Ausgewogene Preispolitik', desc: 'Moderate Preise mit kleinem Zufriedenheits-Bonus.' },
        { id: 'premium', name: 'Einnahmen maximieren', desc: 'Hohe Preise für maximale Ticketeinnahmen, ohne Rücksicht auf Stimmung.' }
    ];

    function setFanLiaisonTask(taskId) {
        if (!FAN_LIAISON_TASKS.some(t => t.id === taskId)) return;
        staffMembers.fanLiaison.task = taskId;
        renderStaffView();
    }

    // Passiver Grundeffekt: leichter Zufriedenheitsschub jeden Spieltag, sobald eingestellt.
    // War zuvor komplett wirkungslos ("+5% Fan-Zufriedenheit" stand nur im Text).
    function applyFanLiaisonPassiveEffect() {
        if (!staffMembers.fanLiaison.hired) return;
        game.fans = Math.min(100, game.fans + 1);
    }

    function runFanLiaisonAutoPricing() {
        if (!staffMembers.fanLiaison.hired) return;
        let task = staffMembers.fanLiaison.task || 'aus';
        if (task === 'aus') return;

        if (task === 'guenstig') {
            game.ticketPrices.steh = 8; game.ticketPrices.sitz = 18; game.ticketPrices.vip = 60;
            game.fans = Math.min(100, game.fans + 2);
        } else if (task === 'ausgewogen') {
            game.ticketPrices.steh = 12; game.ticketPrices.sitz = 24; game.ticketPrices.vip = 80;
            game.fans = Math.min(100, game.fans + 1);
        } else if (task === 'premium') {
            game.ticketPrices.steh = 18; game.ticketPrices.sitz = 34; game.ticketPrices.vip = 120;
        }
    }

    // ==========================================
    // FAN-ZENTRALE: 15 NEUE FUNKTIONEN
    // ==========================================

    // Hilfsfunktion für den Fan-Feed (Punkt 15) - protokolliert wichtige Fan-Ereignisse
    // chronologisch, damit die Fan-Zentrale sich wie ein lebendiges Zentrum anfühlt.
    function pushFanFeedEntry(text) {
        if (!fanCentralState.feed) fanCentralState.feed = [];
        fanCentralState.feed.unshift({ season: game.season, matchday: game.matchday, text });
        if (fanCentralState.feed.length > 25) fanCentralState.feed.pop();
    }

    // 1. Individuelle Fan-Gruppen-Aktionen: jede der vier Gruppen bekommt eine eigene,
    // spezifisch zu ihr passende Aktion statt nur eine statische Stimmungsanzeige zu sein.
    const FAN_GROUP_ACTIONS = {
        ultras: { label: '🔥 Pyro-Verbot lockern', cost: 0, desc: 'Riskant: Ultras-Stimmung steigt deutlich, aber Ausschreitungsrisiko wächst.' },
        tradition: { label: '🏛️ Museums-Tag ausrichten', cost: 6000, desc: 'Freier Eintritt fürs Vereinsmuseum an einem Tag - Traditionsfans lieben es.' },
        families: { label: '🎈 Familientag veranstalten', cost: 9000, desc: 'Kinderschminken, Hüpfburg & Ermäßigungen - Familien-Stimmung steigt spürbar.' },
        vips: { label: '🥂 Business-Lunch ausrichten', cost: 15000, desc: 'Exklusives Networking-Event für Logengäste, stärkt VIP-Bindung & Sponsoring-Klima.' }
    };
    function runFanGroupAction(groupId) {
        let action = FAN_GROUP_ACTIONS[groupId];
        let group = fanGroups.find(g => g.id === groupId);
        if (!action || !group) return;
        if (game.money < action.cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(action.cost)}`, 'error'); return; }
        playSound('click');
        game.money -= action.cost;
        group.mood = Math.min(100, group.mood + 12);
        if (groupId === 'ultras') {
            underworld.pressure = Math.min(100, underworld.pressure + 10);
            pushFanFeedEntry('🔥 Ultras "Szene Nord" feiern die Lockerung der Pyro-Regeln - Stimmung schießt nach oben!');
        } else if (groupId === 'vips') {
            game.boardSat = Math.min(100, game.boardSat + 3);
            pushFanFeedEntry('🥂 VIP-Gäste zeigen sich vom Business-Lunch begeistert - gute Stimmung im Vorstand.');
        } else {
            pushFanFeedEntry(`${groupId === 'tradition' ? '🏛️' : '🎈'} ${group.name} zeigt sich nach der Aktion sichtbar zufriedener.`);
        }
        game.fans = Math.min(100, game.fans + 1);
        renderFansView();
        updateUI();
        showToast(`✅ Aktion für "${group.name}" durchgeführt!`, 'success');
    }

    // 2. Vereinsmitgliedschaften: laufende Einnahmen pro Mitglied, wächst passiv mit hoher
    // Fan-Zufriedenheit, kann zusätzlich aktiv beworben werden.
    function runMembershipCampaign() {
        let cost = 8000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        let newMembers = 50 + Math.round((game.fans / 100) * 150);
        fanCentralState.memberships += newMembers;
        pushFanFeedEntry(`📋 Mitgliedschafts-Kampagne erfolgreich: +${newMembers} neue Vereinsmitglieder!`);
        showToast(`📋 +${newMembers} neue Mitglieder gewonnen!`, 'success');
        renderFansView();
        updateUI();
    }
    // Wird pro Heimspieltag aufgerufen (siehe Hook in match.js) - zahlt die laufende
    // Mitgliedsbeitrags-Einnahme aus.
    function collectMembershipFees() {
        if (fanCentralState.memberships <= 0) return 0;
        return Math.round(fanCentralState.memberships * fanCentralState.membershipFee / 34); // auf Spieltage verteilt
    }

    // 3. Autogrammstunde: Fan-Bindung + kleine Chance auf Spieler-Moralschub, kostet etwas Fitness.
    function holdAutographSession() {
        let cost = 5000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        game.fans = Math.min(100, game.fans + 4);
        squad.forEach(p => { p.fitness = Math.max(60, p.fitness - 2); if (Math.random() < 0.3) p.morale = Math.min(100, p.morale + 3); });
        pushFanFeedEntry('✍️ Autogrammstunde mit der Mannschaft war ein voller Erfolg - lange Schlangen vor dem Stadion!');
        showToast('✍️ Autogrammstunde durchgeführt!', 'success');
        renderFansView();
        updateUI();
    }

    // 4. Stadion-Führungen: laufende kleine Einnahme + Fan-Goodwill, ab Museumsstufe 2 verfügbar.
    function offerStadiumTours() {
        if ((campusBuildings.museum?.lvl || 0) < 2) { showToast('Benötigt mindestens Museumsstufe 2!', 'error'); return; }
        playSound('click');
        let income = 3000 + (campusBuildings.museum.lvl * 500);
        game.money += income;
        game.fans = Math.min(100, game.fans + 2);
        pushFanFeedEntry(`🚶 Stadion-Führungen waren gut besucht - ${formatVal(income)} Einnahmen für den Verein.`);
        showToast(`🚶 Stadion-Führung durchgeführt! +${formatVal(income)}`, 'success');
        renderFansView();
        updateUI();
    }

    // 5. Fan-Umfrage: liefert eine Einschätzung, was den Fans gerade wichtig ist, plus
    // kleinen Stimmungsbonus fürs Gefühl, gehört zu werden.
    function runFanSurvey() {
        playSound('click');
        const TOPICS = [
            { key: 'preise', text: 'Günstigere Ticketpreise', check: () => game.ticketPrices.steh <= 10 },
            { key: 'kader', text: 'Mehr Investition in den Kader', check: () => squad.reduce((s,p)=>s+p.strength,0)/Math.max(1,squad.length) >= 65 },
            { key: 'stadion', text: 'Mehr Stadion-Komfort', check: () => (stadium.blocks.haupt.foodLvl + stadium.blocks.haupt.toiletLvl) >= 3 },
            { key: 'erfolg', text: 'Sportlicher Erfolg', check: () => game.boardSat >= 60 }
        ];
        let topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
        let satisfied = topic.check();
        fanCentralState.lastSurveyResult = { topic: topic.text, satisfied };
        game.fans = Math.min(100, game.fans + (satisfied ? 3 : 1));
        pushFanFeedEntry(`📊 Fan-Umfrage: "${topic.text}" ist den Fans besonders wichtig - ${satisfied ? 'ihr liegt hier schon gut!' : 'hier gibt es noch Luft nach oben.'}`);
        renderFansView();
        updateUI();
        showToast('📊 Fan-Umfrage ausgewertet!', 'success');
    }

    // 6. Fanprojekt/Sozialarbeit: laufende Kosten, senkt dafür passiv das Ausschreitungsrisiko.
    function toggleFanProject() {
        if (!fanCentralState.fanProjectFunded && game.money < 4000) { showToast('4.000 € Anschubfinanzierung benötigt!', 'error'); return; }
        if (!fanCentralState.fanProjectFunded) game.money -= 4000;
        fanCentralState.fanProjectFunded = !fanCentralState.fanProjectFunded;
        playSound('click');
        pushFanFeedEntry(fanCentralState.fanProjectFunded ? '🤝 Das Fanprojekt (Sozialarbeit) wurde eingerichtet - dämpft langfristig Konflikte in der Kurve.' : '🤝 Das Fanprojekt wurde eingestellt.');
        renderFansView();
        updateUI();
    }

    // 7. Schal-Design-Wettbewerb: einmaliges Community-Event, Merchandise- und Stimmungsschub.
    function runScarfDesignContest() {
        if (fanCentralState.scarfContestCooldown > 0) { showToast(`Noch ${fanCentralState.scarfContestCooldown} Spieltage bis zum nächsten Wettbewerb!`, 'error'); return; }
        let cost = 3000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        let merchBoost = 4000 + Math.round(Math.random() * 3000);
        game.money += merchBoost;
        game.fans = Math.min(100, game.fans + 5);
        fanCentralState.scarfContestCooldown = 10;
        pushFanFeedEntry(`🧣 Schal-Design-Wettbewerb ein voller Erfolg - der Siegerentwurf verkauft sich blendend (+${formatVal(merchBoost)})!`);
        showToast('🧣 Schal-Design-Wettbewerb durchgeführt!', 'success');
        renderFansView();
        updateUI();
    }

    // 8. Fan-Patenschaften für Jugendspieler: Fans "adoptieren" ein Talent, das dadurch
    // spürbar motivierter trainiert.
    function sponsorYouthPlayerByFans(playerId) {
        if (fanCentralState.youthSponsorships.some(s => s.playerId === playerId)) { showToast('Dieser Spieler hat bereits eine Fan-Patenschaft!', 'error'); return; }
        let p = youthTalents.find(y => y.id === playerId);
        if (!p) return;
        playSound('goal');
        fanCentralState.youthSponsorships.push({ playerId, since: game.season });
        p.strength = Math.min(99, p.strength + 1);
        game.fans = Math.min(100, game.fans + 1);
        pushFanFeedEntry(`🌟 Die Fans übernehmen eine Patenschaft für Nachwuchstalent ${p.name} - zusätzliche Motivation im Training!`);
        showToast(`🌟 Fan-Patenschaft für ${p.name} eingerichtet!`, 'success');
        renderFansView();
        updateUI();
    }

    // 9. Traditionsverein-Status: Prestige-Meilenstein bei dauerhaft hoher Stimmung der
    // "Alte Garde"-Traditionsfans, gibt einen permanenten Fan-Fundament-Bonus.
    function checkTraditionClubStatus() {
        if (fanCentralState.traditionClubStatus) return;
        let traditionGroup = fanGroups.find(g => g.id === 'tradition');
        if (traditionGroup && traditionGroup.mood >= 90 && game.season >= 3) {
            fanCentralState.traditionClubStatus = true;
            boostFanBaseFloor(5, 'Der neue Traditionsverein-Status');
            addInboxMessage('vertrag', '🏛️ Traditionsverein-Status erreicht!', 'Die "Alte Garde" bescheinigt dem Verein offiziell echten Traditionsverein-Charakter - dauerhaft +5 Fan-Fundament!', 'screen-fans');
            showToast('🏛️ Traditionsverein-Status erreicht!', 'success');
        }
    }

    // 10. Fanbus-Programm: laufende Kosten, dafür spürbarer Auswärts-Unterstützungs-Bonus
    // (verstärkt den bestehenden Auswärtsfans-Effekt in calcTeamStrength()).
    function toggleFanBusProgram() {
        if (!fanCentralState.fanBusProgramActive && game.money < 6000) { showToast('6.000 € Startkosten benötigt!', 'error'); return; }
        if (!fanCentralState.fanBusProgramActive) game.money -= 6000;
        fanCentralState.fanBusProgramActive = !fanCentralState.fanBusProgramActive;
        playSound('click');
        pushFanFeedEntry(fanCentralState.fanBusProgramActive ? '🚌 Das Fanbus-Programm für Auswärtsfahrten startet - mehr mitreisende Unterstützung erwartet!' : '🚌 Das Fanbus-Programm wurde eingestellt.');
        renderFansView();
        updateUI();
    }

    // 11. Kritischer Fan-Brief: Zufallsereignis, Manager muss reagieren.
    function checkCriticalFanLetter() {
        if (game.fans > 40) return; // nur bei echter Unzufriedenheit
        if (fanCentralState.pendingCriticalLetter) return; // schon eine offene Anfrage
        if (Math.random() > 0.08) return;
        fanCentralState.pendingCriticalLetter = true;
        addInboxMessage('vertrag', '✉️ Kritischer Fan-Brief!', 'Ein offener Brief besorgter Fans fordert mehr Kommunikation und sportliche Perspektive - eine Reaktion wird erwartet (Fan-Zentrale besuchen).', 'screen-fans');
        pushFanFeedEntry('✉️ Ein kritischer offener Brief unzufriedener Fans sorgt für Gesprächsstoff.');
    }
    function respondToCriticalFanLetter(stance) {
        if (stance === 'zuhören') { game.fans = Math.min(100, game.fans + 6); pushFanFeedEntry('🗣️ Der Verein reagiert einfühlsam auf den Fan-Brief - spürbare Beruhigung.'); }
        else { game.boardSat = Math.min(100, game.boardSat + 3); game.fans = Math.max(1, game.fans - 3); pushFanFeedEntry('🛡️ Der Verein weist die Kritik zurück - der Vorstand ist zufrieden, die Fans weniger.'); }
        fanCentralState.pendingCriticalLetter = false;
        renderFansView();
        updateUI();
        showToast('Antwort auf den Fan-Brief gesendet.', 'success');
    }

    // 12. Fan-Zufriedenheits-Saisonziel: freiwillige Selbstverpflichtung mit Bonus bei Erfolg.
    function setSeasonMoodTarget(target) {
        fanCentralState.seasonMoodTarget = { value: target, season: game.season };
        pushFanFeedEntry(`🎯 Saisonziel gesetzt: mindestens ${target}% Fan-Zufriedenheit bis Saisonende.`);
        renderFansView();
        showToast(`🎯 Saisonziel: ${target}% Fan-Zufriedenheit gesetzt!`, 'success');
    }
    function checkSeasonMoodTargetResult() {
        let t = fanCentralState.seasonMoodTarget;
        if (!t || t.season !== game.season - 1) return;
        if (game.fans >= t.value) {
            let bonus = 25000;
            game.money += bonus;
            boostFanBaseFloor(2, 'Das erreichte Fan-Zufriedenheits-Saisonziel');
            addInboxMessage('vertrag', '🎯 Saisonziel erreicht!', `Das selbst gesteckte Fan-Zufriedenheits-Ziel von ${t.value}% wurde erreicht - ${formatVal(bonus)} Belohnung!`, 'screen-fans');
        }
        fanCentralState.seasonMoodTarget = null;
    }

    // 13. Meet & Greet mit Jugendtalenten: eigene, günstigere Variante der Autogrammstunde
    // speziell für den Nachwuchs - stärkt die Bindung zur eigenen Jugendakademie.
    function holdYouthMeetAndGreet() {
        let cost = 2000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        if (youthTalents.length === 0) { showToast('Aktuell keine Jugendspieler in der Akademie!', 'error'); return; }
        playSound('click');
        game.money -= cost;
        youthTalents.forEach(p => { if (Math.random() < 0.25) p.strength = Math.min(99, p.strength + 1); });
        game.fans = Math.min(100, game.fans + 2);
        pushFanFeedEntry('🤝 Meet & Greet mit den Nachwuchstalenten - die Fans lernen die Stars von morgen kennen!');
        showToast('🤝 Jugend-Meet & Greet durchgeführt!', 'success');
        renderFansView();
        updateUI();
    }

    // 14. Fanclub-Netzwerk ausbauen: erhöht langfristig die Fan-Fundament-Obergrenze leicht.
    function expandFanClubNetwork() {
        let cost = 20000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        boostFanBaseFloor(2, 'Das ausgebaute Fanclub-Netzwerk');
        pushFanFeedEntry('🌍 Ein neuer Satelliten-Fanclub in einer Nachbarstadt wurde gegründet - das Fanclub-Netzwerk wächst!');
        showToast('🌍 Fanclub-Netzwerk erweitert!', 'success');
        renderFansView();
        updateUI();
    }

    // 15. Fan-Feed-Anzeige: siehe pushFanFeedEntry() oben, wird hier gerendert.
    function renderFanFeed() {
        let box = document.getElementById('fan-feed-box');
        if (!box) return;
        let feed = fanCentralState.feed || [];
        box.innerHTML = feed.length === 0
            ? '<div class="box" style="font-size:10px; color:var(--text-muted);">Noch keine Fan-Ereignisse.</div>'
            : feed.slice(0, 10).map(e => `<div class="box" style="font-size:10px;"><span style="color:var(--text-muted);">S${e.season}/${e.matchday}:</span> ${e.text}</div>`).join('');
    }
