    // ==========================================
    // MANAGER RPG & TALENTBAUM ENGINE
    // ==========================================
    function addManagerXP(amt) {
        managerRPG.xp += amt;
        while (managerRPG.xp >= managerRPG.maxXp) {
            managerRPG.xp -= managerRPG.maxXp;
            managerRPG.level++;
            managerRPG.points++;
            managerRPG.maxXp = Math.round(managerRPG.maxXp * 1.35);
            playSound('goal');
            alert(`🎉 LEVEL-UP! Du hast Manager-Level ${managerRPG.level} erreicht (+1 Skill-Punkt erhalten)!`);
        }
        updateUI();
    }

    function getManagerMediaPersonalityLabel() {
        let img = game.managerMediaImage || 50;
        if (img >= 85) return { label: '🌟 Volksheld', color: 'var(--gold)' };
        if (img >= 65) return { label: '😊 Publikumsliebling', color: 'var(--primary)' };
        if (img >= 40) return { label: '⚖️ Ausgeglichener Diplomat', color: 'var(--accent)' };
        if (img >= 20) return { label: '🏢 Verwaltungsprofi', color: 'var(--teal)' };
        return { label: '😐 Blasser Funktionär', color: 'var(--text-muted)' };
    }
    function renderManagerMediaImage() {
        let box = document.getElementById('manager-media-image-box');
        if (!box) return;
        let img = Math.round(game.managerMediaImage || 50);
        let personality = getManagerMediaPersonalityLabel();
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:10px;">Öffentliches Medienimage</span>
                <strong style="color:${personality.color};">${img}/100 · ${personality.label}</strong>
            </div>
            <div style="background:rgba(228,197,140,0.1); border-radius:4px; height:8px; overflow:hidden; margin-bottom:6px;">
                <div style="width:${img}%; height:100%; background:${personality.color};"></div>
            </div>
            <div style="font-size:9px; color:var(--text-muted);">Beeinflusst durch Interview-Antworten - ein positives Image lockt bessere Sponsoren-Erstangebote an.</div>
            <div id="media-image-trend-chart" style="margin-top:6px;"></div>
        `;
        renderMediaImageTrendChart();
    }
    function renderMediaImageTrendChart() {
        let box = document.getElementById('media-image-trend-chart');
        if (!box) return;
        let hist = game.mediaImageHistory || [];
        if (hist.length < 2) { box.innerHTML = ''; return; }
        box.innerHTML = `<div style="display:flex; align-items:flex-end; gap:2px; height:30px; background:rgba(0,0,0,0.2); border-radius:4px; padding:3px;">
            ${hist.slice(-10).map(h => `<div style="flex:1; height:${Math.max(4, h.value)}%; background:linear-gradient(to top, var(--teal), var(--gold)); border-radius:1px;" title="Saison ${h.season}: ${h.value}"></div>`).join('')}
        </div>`;
    }
    function tickMediaImageSeasonHistory() {
        if (!game.mediaImageHistory) game.mediaImageHistory = [];
        game.mediaImageHistory.push({ season: game.season, value: Math.round(game.managerMediaImage || 50) });
        if (game.mediaImageHistory.length > 15) game.mediaImageHistory.shift();
    }

    function renderManagerRPGView() {
        renderManagerMediaImage();
        let pts = document.getElementById('rpg-available-points');
        if (pts) pts.innerText = managerRPG.points;
        let lvl = document.getElementById('rpg-current-lvl');
        if (lvl) lvl.innerText = managerRPG.level;
        let xpDisp = document.getElementById('rpg-xp-disp');
        if (xpDisp) xpDisp.innerText = `${managerRPG.xp} / ${managerRPG.maxXp}`;

        const perkData = [
            { id: "negotiator", name: "💼 Verhandlungsfuchs", desc: "Senkt alle Spielergehälter um 20% & erhöht Erlöse bei Verkäufen um +15%.", branch: "aufbau" },
            { id: "tactician", name: "📋 Taktik-Genie", desc: "+3 Stärkebonus in allen Spielen gegen stärkere Gegner.", branch: "aufbau" },
            { id: "fitnessGuru", name: "🏃 Fitness-Guru", desc: "Reduziert den Fitnessverlust nach intensiven Partien um 40%.", branch: "aufbau" },
            { id: "tycoon", name: "🏭 Industrie-Tycoon", desc: "+25% höhere Margen im Fanshop & bei B2B-Aufträgen.", branch: "aufbau" },
            { id: "motivator", name: "🔥 Meister-Motivator", desc: "Kader-Moral fällt selbst nach Niederlagen niemals unter 75%.", branch: "aufbau" },
            { id: "playerCare", name: "🤝 Spielerberater-Kontakt", desc: "Halbiert die Wahrscheinlichkeit für Vertrags-Ultimaten unzufriedener Stars - frühzeitige, informelle Gespräche verhindern die Eskalation.", branch: "aufbau" },
            { id: "crisisProof", name: "🛡️ Krisenfest", desc: "Mildert Zwangsverkäufe und Punktabzüge bei Zahlungsunfähigkeit spürbar ab.", branch: "krise" },
            { id: "calmPresence", name: "🧘 Ruhiger Pol", desc: "Halbiert den Vertrauensverlust beim Vorstand nach Niederlagen.", branch: "krise" },
            { id: "secondChance", name: "🕊️ Nochmal-Chance", desc: "Einmal pro Saison ein aktives Vertrags-Ultimatum kostenlos besänftigen.", branch: "krise" },
            { id: "ironNerves", name: "💎 Eiserne Nerven", desc: "Halbiert den Stress-Aufbau des Managers nach schlechten Ergebnissen.", branch: "krise" }
        ];

        let grid = document.getElementById('manager-perks-grid');
        grid.innerHTML = '';
        if ((game.unlockedSynergies || []).length > 0) {
            let synBox = document.createElement('div');
            synBox.className = 'panel';
            synBox.style.borderColor = 'var(--gold)';
            synBox.innerHTML = `<div class="panel-header" style="color:var(--gold);">✨ AKTIVE PERK-SYNERGIEN</div>` +
                game.unlockedSynergies.map(id => {
                    let syn = PERK_SYNERGIES.find(s => s.id === id);
                    return syn ? `<div style="font-size:10px; margin-bottom:4px;"><strong>${syn.label}:</strong> ${syn.desc}</div>` : '';
                }).join('');
            grid.appendChild(synBox);
        }
        // Zwei Talentbaum-Zweige (NEU): "Aufbau-Spezialist" (Wirtschaft & Kader-Aufbau) und
        // "Krisenmanager" (Stabilität & Schadensbegrenzung) - unabhängig kombinierbar, keine
        // exklusive Wahl, aber klar erkennbar als zwei unterschiedliche Spielstile.
        let aufbauHeader = document.createElement('div');
        aufbauHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--primary); margin:8px 0 4px 4px;';
        aufbauHeader.innerText = '🏗️ ZWEIG: AUFBAU-SPEZIALIST';
        grid.appendChild(aufbauHeader);
        perkData.filter(p => p.branch === 'aufbau').forEach(p => {
            let active = managerRPG.perks[p.id];
            let card = document.createElement('div');
            card.className = 'panel';
            card.style.borderColor = active ? 'var(--primary)' : 'var(--border)';
            card.innerHTML = `
                <div class="panel-header"><span>${p.name}</span><strong style="color:${active?'var(--primary)':'#aaa'};">${active?'Aktiviert ✓':'Gesperrt'}</strong></div>
                <div style="font-size:10px; color:#aaa; margin-bottom:6px;">${p.desc}</div>
                <button onclick="unlockManagerPerk('${p.id}')" class="${active?'btn-secondary':'btn-action'}" ${active||managerRPG.points<1?'disabled':''}>
                    ${active ? 'Bereits freigeschaltet' : 'Freischalten (1 Skill-Punkt)'}
                </button>
            `;
            grid.appendChild(card);
        });
        let kriseHeader = document.createElement('div');
        kriseHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--danger); margin:12px 0 4px 4px;';
        kriseHeader.innerText = '🛡️ ZWEIG: KRISENMANAGER';
        grid.appendChild(kriseHeader);
        perkData.filter(p => p.branch === 'krise').forEach(p => {
            let active = managerRPG.perks[p.id];
            let card = document.createElement('div');
            card.className = 'panel';
            card.style.borderColor = active ? 'var(--danger)' : 'var(--border)';
            card.innerHTML = `
                <div class="panel-header"><span>${p.name}</span><strong style="color:${active?'var(--danger)':'#aaa'};">${active?'Aktiviert ✓':'Gesperrt'}</strong></div>
                <div style="font-size:10px; color:#aaa; margin-bottom:6px;">${p.desc}</div>
                <button onclick="unlockManagerPerk('${p.id}')" class="${active?'btn-secondary':'btn-action'}" ${active||managerRPG.points<1?'disabled':''}>
                    ${active ? 'Bereits freigeschaltet' : 'Freischalten (1 Skill-Punkt)'}
                </button>
            `;
            grid.appendChild(card);
        });
    }

    function unlockManagerPerk(perkId) {
        if (managerRPG.points < 1 || managerRPG.perks[perkId]) return;
        playSound('goal');
        managerRPG.points--;
        managerRPG.perks[perkId] = true;
        checkPerkSynergyBonus();
        checkLegendSynergyBonus();
        renderManagerRPGView();
        updateUI();
    }

    // Perk-Reset gegen Gebühr: falls man sich beim Talentbaum "verplant" hat, können alle
    // Perks zurückgesetzt werden, um die Skill-Punkte neu zu vergeben - Synergien und
    // bereits ausgezahlte Boni bleiben dabei erhalten (keine Rückforderung bereits
    // erhaltener Belohnungen), nur die Perks selbst und die dafür ausgegebenen Punkte
    // werden zurückerstattet.
    function resetManagerPerks() {
        let unlockedCount = Object.values(managerRPG.perks).filter(v => v).length;
        if (unlockedCount === 0) { showToast('Es sind noch keine Perks freigeschaltet.', 'error'); return; }
        let fee = Math.max(5000, unlockedCount * 15000);
        if (game.money < fee) { showToast(`Nicht genug Geld! Reset-Gebühr: ${formatVal(fee)}`, 'error'); return; }
        let btn = document.getElementById('btn-perk-reset');
        if (btn && btn.dataset.confirming !== 'true') {
            btn.dataset.confirming = 'true';
            btn.innerText = `⚠️ Wirklich alle Perks zurücksetzen? [${formatVal(fee)}] Nochmal tippen zum Bestätigen`;
            setTimeout(() => { if (btn) { btn.dataset.confirming = 'false'; btn.innerText = `🔄 Alle Perks zurücksetzen [${formatVal(fee)}]`; } }, 4000);
            return;
        }
        if (btn) { btn.dataset.confirming = 'false'; }
        game.money -= fee;
        for (let id in managerRPG.perks) {
            if (managerRPG.perks[id]) { managerRPG.perks[id] = false; managerRPG.points++; }
        }
        addInboxMessage('vertrag', '🔄 Talentbaum zurückgesetzt', `Alle Perks wurden für ${formatVal(fee)} zurückgesetzt - ${unlockedCount} Skill-Punkt(e) stehen wieder zur neuen Verteilung bereit.`, 'screen-manager-tree');
        showToast(`🔄 Perks zurückgesetzt (${formatVal(fee)}) - ${unlockedCount} Skill-Punkt(e) verfügbar!`, 'success');
        renderManagerRPGView();
        updateUI();
    }

    // Perk-Kombinationsboni: bestimmte Kombinationen ergänzen sich thematisch und schalten
    // einen kleinen Synergie-Bonus frei - eine Belohnung für gezielte Talentbaum-Planung
    // statt wahlloser Perk-Sammlung.
    const PERK_SYNERGIES = [
        { combo: ['negotiator', 'playerCare'], id: 'synergy_people', label: 'Menschenkenner', desc: 'Verhandlungsfuchs + Spielerberater-Kontakt: +5% Vorstands-Zufriedenheit dauerhaft.', apply: () => { game.boardSat = Math.min(100, game.boardSat + 5); } },
        { combo: ['tactician', 'motivator'], id: 'synergy_leader', label: 'Führungspersönlichkeit', desc: 'Taktik-Genie + Meister-Motivator: +3 Fan-Fundament dauerhaft.', apply: () => { boostFanBaseFloor(3, 'Die Perk-Synergie "Führungspersönlichkeit"'); } },
        { combo: ['fitnessGuru', 'tycoon'], id: 'synergy_efficiency', label: 'Effizienz-Experte', desc: 'Fitness-Guru + Industrie-Tycoon: einmalig 20.000 € Bonus für optimierte Betriebsabläufe.', apply: () => { game.money += 20000; } }
    ];
    function checkPerkSynergyBonus() {
        if (!game.unlockedSynergies) game.unlockedSynergies = [];
        PERK_SYNERGIES.forEach(syn => {
            if (game.unlockedSynergies.includes(syn.id)) return;
            if (syn.combo.every(perkId => managerRPG.perks[perkId])) {
                game.unlockedSynergies.push(syn.id);
                syn.apply();
                addInboxMessage('vertrag', `✨ Perk-Synergie freigeschaltet: ${syn.label}!`, syn.desc, 'screen-manager-tree');
                showToast(`✨ Synergie-Bonus: ${syn.label}!`, 'success');
            }
        });
    }
    // Seltene Spätspiel-Synergie: verbindet den erspielten Legenden-Status (10× Abwerbe-
    // versuche abgelehnt) mit allen 5 regulären Perks - eine Krönung für eine besonders
    // lange, loyale und ausgereifte Karriere. Wird separat geprüft, da Legenden-Status
    // KEIN Perk ist, sondern ein Fortschrittsflag (siehe declineJobOfferLoyalty()).
    function checkLegendSynergyBonus() {
        if (!game.unlockedSynergies) game.unlockedSynergies = [];
        if (game.unlockedSynergies.includes('synergy_legend')) return;
        if (!game.legendStatus) return;
        let allPerksUnlocked = ['negotiator', 'tactician', 'fitnessGuru', 'tycoon', 'motivator', 'playerCare'].every(id => managerRPG.perks[id]);
        if (!allPerksUnlocked) return;
        game.unlockedSynergies.push('synergy_legend');
        game.money += 100000;
        boostFanBaseFloor(10, 'Die Synergie "Vollendete Vereinslegende"');
        addInboxMessage('vertrag', '👑✨ Perk-Synergie freigeschaltet: Vollendete Vereinslegende!', 'Legenden-Status + alle 6 Perks freigeschaltet: 100.000 € Ehrenbonus und dauerhaft +10 Fan-Fundament für eine außergewöhnliche Karriere.', 'screen-manager-tree');
        showToast('👑✨ Seltene Synergie: Vollendete Vereinslegende!', 'success');
        playLegendSynergyCeremony();
    }

    // Kleine eigene Zeremonie für dieses seltenste aller Ereignisse, statt nur einer
    // Postfach-Nachricht - ähnlich der Saisonabschluss-Gala, aber als einmaliges
    // Karriere-Highlight statt eines jährlichen Rituals.
    function playLegendSynergyCeremony() {
        let veterans = (game.notablePastPlayers || []).slice(-3).map(v => v.name);
        let veteranText = veterans.length > 0 ? ` Weggefährten wie ${veterans.join(', ')} werden in Interviews erwähnt.` : '';
        addInboxMessage('vertrag', '🎉 Zeremonie: Der Verein feiert deine Karriere!', `Eine improvisierte Feier vor der Geschäftsstelle würdigt deine außergewöhnliche Laufbahn als Manager - Vorstand, Mannschaft und Fans applaudieren gemeinsam.${veteranText}`, 'screen-manager-tree');
    }

