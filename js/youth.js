    function renderYouthView() {
        document.getElementById('youth-lvl-disp').innerText = game.youthAcademyLvl;
        let list = document.getElementById('youth-talents-list');
        list.innerHTML = '';
        let capacity = getYouthAcademyCapacity();
        let capBox = document.getElementById('youth-capacity-box');
        if (capBox) capBox.innerText = `Kapazität: ${youthTalents.length} / ${capacity}`;

        youthTalents.forEach((p, idx) => {
            let row = document.createElement('div');
            row.className = 'player-row';
            row.style.flexDirection = 'column';
            row.style.alignItems = 'stretch';
            let potentialHtml = p.potentialRevealed
                ? `<span class="badge" style="background:${POTENTIAL_TIER_COLORS[p.potentialTier]};">${POTENTIAL_TIER_LABELS[p.potentialTier]}</span>`
                : `<button onclick="revealYouthPotential('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">🔍 Potenzial prüfen [3.000 €]</button>`;
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${p.name} (${p.pos}|Str: ${p.strength}) ${p.trait && p.trait!=='Kein'?`<span class="badge badge-trait">${p.trait}</span>`:''}</span>
                    <button onclick="promoteYouth(${idx})" class="btn-action" style="width:auto;">In Profikader</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:9px;">
                    <span>${potentialHtml}</span>
                    <span>Fokus: <select class="input-inline" style="font-size:8px; padding:2px;" onchange="setYouthTrainingFocus('${p.id}', this.value)">
                        <option value="allgemein" ${p.youthFocus==='allgemein'?'selected':''}>Allgemein</option>
                        <option value="torschuss" ${p.youthFocus==='torschuss'?'selected':''}>Torschuss</option>
                        <option value="passspiel" ${p.youthFocus==='passspiel'?'selected':''}>Passspiel</option>
                        <option value="zweikampf" ${p.youthFocus==='zweikampf'?'selected':''}>Zweikampf</option>
                        <option value="tempo" ${p.youthFocus==='tempo'?'selected':''}>Tempo</option>
                    </select></span>
                    <button onclick="releaseYouthTalent('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px; color:var(--danger);">Freilassen</button>
                </div>
            `;
            list.appendChild(row);
        });

        let poachBox = document.getElementById('youth-poach-box');
        if (poachBox) {
            let pend = game.pendingYouthPoach;
            poachBox.style.display = pend ? 'block' : 'none';
            if (pend) {
                poachBox.innerHTML = `<div class="panel-header" style="color:var(--danger);">🎯 ABWERBEVERSUCH: ${pend.name}</div>
                    <div class="box" style="font-size:10px;">Ein Rivale will ${pend.name} abwerben! Ablösesumme zahlen (${formatVal(pend.retentionCost)}) oder ziehen lassen?</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button onclick="resolveYouthPoaching(true)" class="btn-action">💰 Halten</button>
                        <button onclick="resolveYouthPoaching(false)" class="btn-secondary">👋 Ziehen lassen</button>
                    </div>`;
            }
        }
        renderYouthLeaderboard();
    }

    // ==========================================
    // JUGENDAKADEMIE: NEUE FUNKTIONEN
    // ==========================================
    const POTENTIAL_TIER_LABELS = { 1: '⭐ Mittelmaß', 2: '⭐⭐ Vielversprechend', 3: '⭐⭐⭐ Ausnahmetalent' };
    const POTENTIAL_TIER_COLORS = { 1: 'rgba(228,197,140,0.2)', 2: 'rgba(76,175,122,0.3)', 3: 'rgba(212,169,74,0.4)' };

    // 1. Jugendkader-Kapazität: skaliert mit Akademie-Stufe, zusätzlich ausbaubar.
    function getYouthAcademyCapacity() {
        return 3 + game.youthAcademyLvl * 2 + (game.youthCapacityBonus || 0);
    }
    function expandYouthCapacity() {
        let cost = 25000 * ((game.youthCapacityBonus || 0) + 1);
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        game.youthCapacityBonus = (game.youthCapacityBonus || 0) + 1;
        showToast(`🏠 Jugendkader-Kapazität erweitert auf ${getYouthAcademyCapacity()} Plätze!`, 'success');
        renderYouthView();
        updateUI();
    }

    // 2. Potenzial-Anzeige: verstecktes Entwicklungspotenzial, gegen Bezahlung aufdeckbar,
    // beeinflusst wie stark ein Talent von Hospitanz/Training profitiert.
    function assignYouthPotentialTier(p) {
        let roll = Math.random();
        p.potentialTier = roll < 0.6 ? 1 : (roll < 0.9 ? 2 : 3);
        p.potentialRevealed = false;
    }
    function revealYouthPotential(playerId) {
        let p = youthTalents.find(y => y.id === playerId);
        if (!p || p.potentialRevealed) return;
        let cost = 3000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('click');
        game.money -= cost;
        p.potentialRevealed = true;
        showToast(`🔍 Potenzial von ${p.name}: ${POTENTIAL_TIER_LABELS[p.potentialTier]}`, 'success');
        renderYouthView();
        updateUI();
    }
    function getYouthPotentialMultiplier(p) {
        if (!p) return 1;
        return { 1: 0.8, 2: 1.2, 3: 1.8 }[p.potentialTier] || 1;
    }

    // 3. Jugend-Ausbildungsschwerpunkt: individueller Trainingsfokus wie bei Profis, wirkt
    // sich in der Hospitanz-Entwicklung aus (siehe Hook in match.js).
    function setYouthTrainingFocus(playerId, focus) {
        let p = youthTalents.find(y => y.id === playerId);
        if (p) { p.youthFocus = focus; renderYouthView(); }
    }

    // 4. Abwerbeversuche von Rivalen: Zufallsereignis, Ablöse zahlen oder verlieren.
    function checkYouthPoachingAttempt() {
        if (youthTalents.length === 0 || game.pendingYouthPoach) return;
        if (Math.random() > 0.015) return;
        let p = youthTalents[Math.floor(Math.random() * youthTalents.length)];
        let retentionCost = Math.round(calculatePlayerMarketValue(p.strength) * 0.4) + 5000;
        game.pendingYouthPoach = { playerId: p.id, name: p.name, retentionCost };
        addInboxMessage('vertrag', `🎯 Abwerbeversuch: ${p.name}!`, `Ein Rivale will Nachwuchstalent ${p.name} abwerben. Zahle ${formatVal(retentionCost)}, um ihn zu halten (Jugendakademie-Screen), sonst wechselt er den Verein!`, 'screen-youth');
    }
    function resolveYouthPoaching(pay) {
        let pend = game.pendingYouthPoach;
        if (!pend) return;
        if (pay) {
            if (game.money < pend.retentionCost) { showToast('Nicht genug Geld!', 'error'); return; }
            game.money -= pend.retentionCost;
            showToast(`✅ ${pend.name} bleibt in der Akademie!`, 'success');
        } else {
            youthTalents = youthTalents.filter(p => p.id !== pend.playerId);
            showToast(`😢 ${pend.name} hat die Akademie verlassen.`, 'error');
        }
        game.pendingYouthPoach = null;
        renderYouthView();
        updateUI();
    }

    // 5. Jugend-Nationalmannschaft-Berufung: seltenes Prestige-Ereignis für starke Talente.
    function checkYouthNationalCallup() {
        let eligible = youthTalents.filter(p => p.strength >= 62);
        if (eligible.length === 0 || Math.random() > 0.01) return;
        let p = eligible[Math.floor(Math.random() * eligible.length)];
        game.youthNationalCallups = (game.youthNationalCallups || 0) + 1;
        p.strength = Math.min(99, p.strength + 1);
        game.fans = Math.min(100, game.fans + 2);
        addInboxMessage('vertrag', `🌍 U-Nationalmannschaft: ${p.name} berufen!`, `${p.name} wird erstmals in eine deutsche Jugend-Nationalmannschaft berufen - eine große Ehre für die Akademie und einen echten Entwicklungsschub!`, 'screen-youth');
    }

    // 6. Jugendturnier: einmaliges Event, kleine Chance auf Bonus-Entwicklung für alle Talente.
    function holdYouthTournament() {
        if (youthTalents.length === 0) { showToast('Keine Jugendspieler vorhanden!', 'error'); return; }
        let cost = 4000;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        let improved = [];
        youthTalents.forEach(p => {
            if (Math.random() < 0.2 * getYouthPotentialMultiplier(p)) { p.strength = Math.min(99, p.strength + 1); improved.push(p.name); }
        });
        showToast(improved.length > 0 ? `🏆 Jugendturnier: ${improved.join(', ')} zeigten starke Leistungen!` : '🏆 Jugendturnier durchgeführt - keine besonderen Ausreißer.', 'success');
        renderYouthView();
        updateUI();
    }

    // 7. Jugend-Bestenliste: sortiert nach Stärke, zeigt Potenzial wo bekannt.
    function renderYouthLeaderboard() {
        let box = document.getElementById('youth-leaderboard-box');
        if (!box) return;
        let sorted = [...youthTalents].sort((a, b) => b.strength - a.strength);
        box.innerHTML = sorted.length === 0
            ? '<div style="font-size:9px; color:var(--text-muted);">Keine Talente in der Akademie.</div>'
            : sorted.map((p, i) => `<div class="box" style="display:flex; justify-content:space-between; font-size:9px;"><span>#${i+1} ${p.name} (${p.pos})</span><span>Str: ${p.strength} ${p.potentialRevealed ? POTENTIAL_TIER_LABELS[p.potentialTier] : ''}</span></div>`).join('');
    }

    // 8. Jugendtalent freilassen: bisher gab es nur "Befördern", kein Ausmustern.
    function releaseYouthTalent(playerId) {
        let p = youthTalents.find(y => y.id === playerId);
        if (!p) return;
        youthTalents = youthTalents.filter(y => y.id !== playerId);
        game.youthHospitants = (game.youthHospitants || []).filter(id => id !== playerId);
        showToast(`👋 ${p.name} wurde aus der Jugendakademie entlassen.`, 'success');
        renderYouthView();
    }

    function upgradeYouthAcademy() {
        let cost = game.youthAcademyLvl * 35000;
        if (game.money < cost) return;
        playSound('click');
        game.money -= cost;
        game.youthAcademyLvl++;
        renderYouthView();
        updateUI();
    }

    function scoutYouthTalent() {
        if (youthTalents.length >= getYouthAcademyCapacity()) { showToast('Jugendkader-Kapazität erreicht! Erst ausbauen oder Plätze freimachen.', 'error'); return; }
        if (game.money < 8000) return;
        playSound('click');
        game.money -= 8000;
        let p = createPlayer(["TW", "ABW", "MIT", "ST"][Math.floor(Math.random()*4)], 46 + game.youthAcademyLvl * 3, 58 + game.youthAcademyLvl * 3, null, [15, 18]);
        assignYouthPotentialTier(p);
        p.youthFocus = 'allgemein';
        youthTalents.push(p);
        renderYouthView();
        updateUI();
    }

    function promoteYouth(idx) {
        playSound('click');
        let p = youthTalents[idx];
        squad.push(p);
        youthTalents.splice(idx, 1);
        // Jugendakademie-Abschlussfeier: statt nur einer trockenen Nachricht ein kleines
        // Zeremoniell mit Moralschub fürs ganze Team - ein Aufstieg aus der eigenen Jugend
        // ist immer ein Grund zum Feiern für die Kabine.
        squad.forEach(pl => { pl.morale = Math.min(100, pl.morale + 2); });
        game.fans = Math.min(100, game.fans + 2);
        addInboxMessage('vertrag', `🎓 Jugendakademie-Abschlussfeier: ${p.name}!`, `${p.name} (${p.pos}, Stärke ${p.strength}) wird feierlich in den Profikader aufgenommen - die ganze Mannschaft feiert mit und ist spürbar motiviert!`, 'screen-squad');
        showToast(`🎓 ${p.name} feierlich in den Profikader befördert!`, 'success');
        renderYouthView();
        updateUI();
    }
