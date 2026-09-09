    // ==========================================
    // WELTWEITES SCOUTING-NETZWERK 2.0 (komplett neu aufgebaut)
    // ==========================================
    // Kernideen der Neufassung:
    // 1. Scout-Netzwerk: bis zu 4 Regional-Scouts, jeweils eigenes Skill-Level, das die
    //    Missionsdauer, die Fundqualität und die Verlässlichkeit der Berichte bestimmt.
    // 2. Countdown-Missionen statt Sofort-Ergebnis: eine Scouting-Reise dauert echte
    //    Spieltage, mit sichtbarem Fortschritt (analog zum Produktions-Countdown).
    // 3. Unschärfe/Vertrauens-Mechanik: frisch entdeckte Spieler zeigen ihre Werte nur als
    //    ungefähre Spanne, abhängig vom Scout-Skill. Wer weiter beobachtet (Beobachtungsliste),
    //    bekommt mit der Zeit immer genauere Werte - "Fog of War" fürs Scouting.
    // 4. Talent-Datenbank: ein dauerhaftes Archiv ALLER je entdeckten Spieler, nicht nur der
    //    aktuell verfügbaren - zum Nachschlagen und Vergleichen.

    const SCOUT_REGION_CONFIG = {
        suedamerika: { label: '🌴 Südamerika', pos: 'ST', minStr: 60, maxStr: 84, trait: 'Tor-Instinkt', baseCost: 18000, hireCost: 45000 },
        afrika: { label: '🦁 Afrika', pos: 'MIT', minStr: 58, maxStr: 82, trait: 'Flügelflitzer', baseCost: 14000, hireCost: 35000 },
        westeuropa: { label: '🏰 Westeuropa & UK', pos: 'MIT', minStr: 62, maxStr: 86, trait: 'Freistoß-Gott', baseCost: 25000, hireCost: 60000 },
        osteuropa: { label: '🛡️ Osteuropa & Balkan', pos: 'ABW', minStr: 60, maxStr: 84, trait: 'Eisenfuß', baseCost: 12000, hireCost: 30000 }
    };
    const SCOUT_NAME_POOL = ['Carlos Medeiros', 'Amara Diallo', 'James Whitfield', 'Nikolai Petrov', 'Sofia Alves', 'Kwame Osei', 'Hans Brenner', 'Dmitri Volkov', 'Luiz Herrera', 'Fatou Sow'];

    function getScoutByRegion(region) {
        return scoutingNetwork.scouts.find(s => s.region === region);
    }

    // 1. Scout-Netzwerk: Scouts einstellen und ausbilden.
    function hireRegionalScout(scoutId) {
        let s = scoutingNetwork.scouts.find(x => x.id === scoutId);
        if (!s || s.hired) return;
        let cfg = SCOUT_REGION_CONFIG[s.region];
        if (game.money < cfg.hireCost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cfg.hireCost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cfg.hireCost;
        s.hired = true;
        s.level = 1;
        s.skill = 35;
        s.name = SCOUT_NAME_POOL[Math.floor(Math.random() * SCOUT_NAME_POOL.length)];
        addInboxMessage('scouting', `🔭 Neuer Regional-Scout: ${s.name}!`, `${s.name} übernimmt ab sofort das Scouting-Gebiet "${cfg.label}".`, 'screen-scouting-global');
        showToast(`🔭 ${s.name} für ${cfg.label} eingestellt!`, 'success');
        renderGlobalScoutingView();
        updateUI();
    }
    function upgradeRegionalScout(scoutId) {
        let s = scoutingNetwork.scouts.find(x => x.id === scoutId);
        if (!s || !s.hired || s.level >= 5) return;
        let cost = 20000 * s.level;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('goal');
        game.money -= cost;
        s.level++;
        s.skill = Math.min(95, s.skill + 15);
        showToast(`📈 ${s.name} auf Stufe ${s.level} ausgebildet (Skill: ${s.skill})!`, 'success');
        renderGlobalScoutingView();
        updateUI();
    }

    // 2. Countdown-Missionen: Dauer & Qualität hängen vom Scout-Skill ab - höherer Skill
    // heißt kürzere Reisen UND bessere Mindestqualität der Funde.
    function getMissionDuration(scout) {
        return Math.max(1, 4 - Math.floor(scout.skill / 30)); // Skill 0-29: 4 SpT, 90+: 1 SpT
    }
    function startScoutingMission(region, customFilter = null) {
        let scout = getScoutByRegion(region);
        if (!scout || !scout.hired) { showToast('Für diese Region ist noch kein Scout eingestellt!', 'error'); return; }
        if (scoutingNetwork.activeMissions.some(m => m.scoutId === scout.id)) { showToast(`${scout.name} ist bereits auf Reisen!`, 'error'); return; }
        let cfg = SCOUT_REGION_CONFIG[region];
        let cost = customFilter ? Math.round((2000 + Math.pow(Math.max(0, customFilter.minStr - 40), 2) * 15) / 500) * 500 : cfg.baseCost;
        if (game.money < cost) { showToast(`Nicht genügend Vereinskapital! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        playSound('whistle');
        game.money -= cost;
        let duration = getMissionDuration(scout);
        scoutingNetwork.activeMissions.push({ scoutId: scout.id, region, matchdaysLeft: duration, totalMatchdays: duration, customFilter });
        showToast(`✈️ ${scout.name} bricht nach ${cfg.label} auf - Rückkehr in ${duration} Spieltag(en).`, 'success');
        renderGlobalScoutingView();
        updateUI();
    }
    // Wird jeden Spieltag aufgerufen: zählt Missionen herunter, würfelt bei Abschluss einen
    // Fund inklusive Unschärfe/Vertrauenswert basierend auf dem Scout-Skill.
    function tickScoutingMissions() {
        if (!scoutingNetwork.activeMissions || scoutingNetwork.activeMissions.length === 0) return;
        let stillActive = [];
        scoutingNetwork.activeMissions.forEach(mission => {
            mission.matchdaysLeft--;
            if (mission.matchdaysLeft > 0) { stillActive.push(mission); return; }
            let scout = scoutingNetwork.scouts.find(s => s.id === mission.scoutId);
            let cfg = SCOUT_REGION_CONFIG[mission.region];
            let f = mission.customFilter;
            let minStr = f ? f.minStr : Math.round(cfg.minStr + scout.skill * 0.15);
            let maxStr = f ? f.maxStr : Math.round(cfg.maxStr + scout.skill * 0.1);
            let pos = f ? (f.pos === 'any' ? ["TW", "ABW", "MIT", "ST"][Math.floor(Math.random() * 4)] : f.pos) : cfg.pos;
            let ageRange = f ? [f.minAge, f.maxAge] : null;
            let star = createPlayer(pos, minStr, maxStr, f ? null : cfg.trait, ageRange);
            // Vertrauens-Level (NEU): bestimmt, wie unscharf die Werte zunächst angezeigt werden.
            star.scoutConfidence = Math.min(95, Math.max(15, scout.skill + Math.floor(Math.random() * 20 - 10)));
            star.scoutedByRegion = mission.region;
            star.scoutedMatchday = game.matchday;
            star.scoutedSeason = game.season;
            globalScoutResults.unshift(star);
            scoutingNetwork.talentDatabase.unshift({ id: star.id, name: star.name, pos: star.pos, strength: star.strength, trait: star.trait, region: mission.region, season: game.season, matchday: game.matchday, signed: false });
            if (scoutingNetwork.talentDatabase.length > 60) scoutingNetwork.talentDatabase.pop();
            addInboxMessage('scouting', `✈️ ${scout.name} ist zurück!`, `${scout.name} hat ${star.name} (${star.pos}) aus "${cfg.label}" mitgebracht - Vertrauens-Level: ${star.scoutConfidence}%.`, 'screen-scouting-global');
        });
        scoutingNetwork.activeMissions = stillActive;
    }

    // 3. Unschärfe-Mechanik: zeigt Werte als Spanne, wird mit steigendem Vertrauen präziser.
    // Nutzt dieselbe seedbasierte Zufallslogik wie getDisplayStats(), damit die Anzeige
    // zwischen Render-Aufrufen stabil bleibt (kein Flackern bei jedem Neuzeichnen).
    function getFogRange(player, statValue, salt) {
        let confidence = player.scoutConfidence ?? 100;
        if (confidence >= 95) return { display: statValue, isFoggy: false };
        let fogSpan = Math.round((100 - confidence) * 0.12);
        let r = seededRand(player.id, salt);
        let shownValue = Math.round(statValue + (r - 0.5) * fogSpan);
        return { display: shownValue, isFoggy: true, range: [Math.max(30, shownValue - fogSpan), Math.min(99, shownValue + fogSpan)] };
    }
    // Genauer beobachten: kostet eine kleine Gebühr, erhöht sofort das Vertrauens-Level.
    function investigateScoutedPlayer(playerId) {
        let p = globalScoutResults.find(x => x.id === playerId);
        if (!p) return;
        let cost = 1500;
        if (game.money < cost) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(cost)}`, 'error'); return; }
        if ((p.scoutConfidence ?? 100) >= 95) { showToast('Bereits vollständig ausgewertet!', 'error'); return; }
        playSound('click');
        game.money -= cost;
        p.scoutConfidence = Math.min(98, (p.scoutConfidence || 50) + 20);
        showToast(`🔍 Genauere Auswertung zu ${p.name}: Vertrauens-Level jetzt ${p.scoutConfidence}%.`, 'success');
        renderGlobalScoutingView();
        updateUI();
    }

    // Beobachtungsliste: passive, kostenlose Vertrauenssteigerung über mehrere Spieltage.
    function addToWatchlist(playerId) {
        if (scoutingNetwork.watchlist.includes(playerId)) return;
        if (scoutingNetwork.watchlist.length >= 8) { showToast('Beobachtungsliste ist voll (max. 8 Spieler)!', 'error'); return; }
        scoutingNetwork.watchlist.push(playerId);
        showToast('👁️ Zur Beobachtungsliste hinzugefügt.', 'success');
        renderGlobalScoutingView();
    }
    function removeFromWatchlist(playerId) {
        scoutingNetwork.watchlist = scoutingNetwork.watchlist.filter(id => id !== playerId);
        renderGlobalScoutingView();
    }
    function tickWatchlist() {
        if (!scoutingNetwork.watchlist || scoutingNetwork.watchlist.length === 0) return;
        scoutingNetwork.watchlist.forEach(id => {
            let p = globalScoutResults.find(x => x.id === id);
            if (p && (p.scoutConfidence ?? 100) < 95) p.scoutConfidence = Math.min(98, (p.scoutConfidence || 50) + 4);
        });
    }

    // Tiefere Scouting-Berichte: Text-Dossier mit Stärken/Schwächen statt nur nackter Zahlen.
    function generateScoutingReport(p) {
        let strengths = [], weaknesses = [];
        if (p.pace >= 78) strengths.push('außergewöhnliches Tempo');
        if (p.shooting >= 78) strengths.push('kaltschnäuziger Abschluss');
        if (p.passing >= 78) strengths.push('exzellente Spielübersicht');
        if (p.defense >= 78) strengths.push('robuste Zweikampfführung');
        if (p.physique >= 78) strengths.push('beeindruckende Physis');
        if (p.age <= 21) strengths.push('großes Entwicklungspotenzial');
        if (p.trait && p.trait !== 'Kein') strengths.push(`besondere Veranlagung: ${p.trait}`);
        if (p.pace <= 55) weaknesses.push('limitiertes Tempo');
        if (p.shooting <= 55) weaknesses.push('ausbaufähige Abschlussstärke');
        if (p.passing <= 55) weaknesses.push('einfaches Passspiel');
        if (p.defense <= 55) weaknesses.push('anfällig im Zweikampf');
        if (p.age >= 32) weaknesses.push('fortgeschrittenes Alter');
        if (strengths.length === 0) strengths.push('solide Grundausbildung ohne Ausreißer');
        if (weaknesses.length === 0) weaknesses.push('keine offensichtliche Schwäche erkennbar');
        return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 2) };
    }

    // ---------- EIGENER SCOUTING-FOKUS-FILTER (bestehendes Modal, jetzt an Missionen gekoppelt) ----------
    let scoutFilter = { minStr: 50, maxStr: 80, minAge: 16, maxAge: 30 };
    let scoutFilterRegion = 'suedamerika';
    function openScoutFilterModal(region) {
        playSound('click');
        scoutFilterRegion = region;
        document.getElementById('scout-filter-overlay').classList.add('show');
        renderScoutFilterModal();
    }
    function closeScoutFilterModal() {
        document.getElementById('scout-filter-overlay').classList.remove('show');
    }
    function scoutFilterAdjust(field, delta) {
        scoutFilter[field] = Math.max(1, scoutFilter[field] + delta);
        if (field === 'minStr' && scoutFilter.minStr > scoutFilter.maxStr) scoutFilter.maxStr = scoutFilter.minStr;
        if (field === 'maxStr' && scoutFilter.maxStr < scoutFilter.minStr) scoutFilter.minStr = scoutFilter.maxStr;
        if (field === 'minAge' && scoutFilter.minAge > scoutFilter.maxAge) scoutFilter.maxAge = scoutFilter.minAge;
        if (field === 'maxAge' && scoutFilter.maxAge < scoutFilter.minAge) scoutFilter.minAge = scoutFilter.maxAge;
        renderScoutFilterModal();
    }
    function renderScoutFilterModal() {
        document.getElementById('sf-minStr-value').innerText = scoutFilter.minStr;
        document.getElementById('sf-maxStr-value').innerText = scoutFilter.maxStr;
        document.getElementById('sf-minAge-value').innerText = scoutFilter.minAge;
        document.getElementById('sf-maxAge-value').innerText = scoutFilter.maxAge;
    }
    function scoutFilterSendMission() {
        let pos = document.getElementById('sf-position').value;
        closeScoutFilterModal();
        startScoutingMission(scoutFilterRegion, { pos, minStr: scoutFilter.minStr, maxStr: scoutFilter.maxStr, minAge: scoutFilter.minAge, maxAge: scoutFilter.maxAge });
    }

    // ---------- HAUPT-RENDERING ----------
    function renderGlobalScoutingView() {
        // Scout-Netzwerk-Karten
        let netGrid = document.getElementById('scouting-regions-grid');
        if (netGrid) {
            netGrid.innerHTML = scoutingNetwork.scouts.map(s => {
                let cfg = SCOUT_REGION_CONFIG[s.region];
                let mission = scoutingNetwork.activeMissions.find(m => m.scoutId === s.id);
                let body;
                if (!s.hired) {
                    body = `<div style="font-size:9px; color:#aaa; margin-bottom:6px;">Noch kein Scout für diese Region.</div>
                            <button onclick="hireRegionalScout('${s.id}')" class="btn-action">Scout einstellen [${formatVal(cfg.hireCost)}]</button>`;
                } else if (mission) {
                    let segments = Array.from({ length: mission.totalMatchdays }, (_, i) => i < (mission.totalMatchdays - mission.matchdaysLeft));
                    body = `<div style="font-size:9px; color:#aaa; margin-bottom:4px;">${s.name} · Skill ${s.skill} (Stufe ${s.level})</div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="font-size:18px; font-weight:900; color:var(--accent);">${mission.matchdaysLeft}</div>
                                <div style="flex:1; display:flex; gap:2px;">${segments.map(done => `<div style="flex:1; height:10px; border-radius:2px; background:${done ? 'var(--accent)' : 'rgba(228,197,140,0.15)'};"></div>`).join('')}</div>
                            </div>
                            <div style="font-size:8px; color:#aaa; margin-top:3px;">✈️ Unterwegs - kehrt in ${mission.matchdaysLeft} SpT zurück</div>`;
                } else {
                    body = `<div style="font-size:9px; color:#aaa; margin-bottom:6px;">${s.name} · Skill ${s.skill} (Stufe ${s.level}) · Dauer: ${getMissionDuration(s)} SpT</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                                <button onclick="startScoutingMission('${s.region}')" class="btn-action" style="font-size:10px;">Entsenden [${formatVal(cfg.baseCost)}]</button>
                                <button onclick="openScoutFilterModal('${s.region}')" class="btn-secondary" style="font-size:10px;">🎛️ Fokus</button>
                            </div>
                            ${s.level < 5 ? `<button onclick="upgradeRegionalScout('${s.id}')" class="btn-secondary" style="margin-top:4px; font-size:9px;">📈 Ausbilden (Stufe ${s.level+1}) [${formatVal(20000*s.level)}]</button>` : '<div style="font-size:8px; color:var(--primary); margin-top:4px;">Maximalstufe erreicht ✓</div>'}`;
                }
                return `<div class="panel"><div class="panel-header" style="font-size:11px;">${cfg.label}</div>${body}</div>`;
            }).join('');
        }

        // Gefundene Kandidaten mit Unschärfe-Anzeige
        let list = document.getElementById('global-scouting-results');
        if (list) {
            list.innerHTML = '';
            if (globalScoutResults.length === 0) {
                list.innerHTML = '<div class="box">Noch keine Scouting-Missionen abgeschlossen. Entsende oben deine Scouts!</div>';
            } else {
                globalScoutResults.forEach((p, idx) => {
                    let discount = 1.0 - (staffMembers.scout.hired ? 0.15 : 0);
                    if (typeof getActiveStaffSynergies === 'function' && getActiveStaffSynergies().some(s => s.bonusKey === 'transferDiscount')) discount -= 0.05;
                    let displayPrice = Math.round(p.marketValue * discount);
                    let confidence = p.scoutConfidence ?? 100;
                    let paceF = getFogRange(p, p.pace, 'pace'), shootF = getFogRange(p, p.shooting, 'shoot'), passF = getFogRange(p, p.passing, 'pass'), physF = getFogRange(p, p.physique, 'phys');
                    let isWatched = scoutingNetwork.watchlist.includes(p.id);
                    let confColor = confidence >= 80 ? 'var(--primary)' : (confidence >= 50 ? 'var(--accent)' : 'var(--danger)');
                    let row = document.createElement('div');
                    row.className = 'panel';
                    row.innerHTML = `
                        <div class="panel-header"><span>⭐ ${p.name} (${p.pos})</span><strong style="color:var(--accent);">Stärke: ~${p.strength}</strong></div>
                        <div style="font-size:9px; margin-bottom:4px;">
                            <span style="color:${confColor};">🔎 Vertrauens-Level: ${confidence}%${confidence < 95 ? ' (Werte unscharf)' : ' (bestätigt)'}</span>
                        </div>
                        <div style="font-size:10px; margin-bottom:4px;">
                            Spezial-Perk: <span class="badge badge-trait">${p.trait}</span> | Tempo: <strong>${paceF.isFoggy ? paceF.range[0]+'-'+paceF.range[1] : paceF.display}</strong> | Schuss: <strong>${shootF.isFoggy ? shootF.range[0]+'-'+shootF.range[1] : shootF.display}</strong> | Pass: <strong>${passF.isFoggy ? passF.range[0]+'-'+passF.range[1] : passF.display}</strong> | Physis: <strong>${physF.isFoggy ? physF.range[0]+'-'+physF.range[1] : physF.display}</strong>
                        </div>
                        <button onclick="openPlayerDetail('${p.id}','scout')" class="btn-secondary" style="margin-bottom:4px;">ℹ️ Details ansehen</button>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:4px;">
                            ${confidence < 95 ? `<button onclick="investigateScoutedPlayer('${p.id}')" class="btn-secondary" style="font-size:9px;">🔍 Genauer beobachten [1.500 €]</button>` : '<div></div>'}
                            <button onclick="${isWatched ? `removeFromWatchlist('${p.id}')` : `addToWatchlist('${p.id}')`}" class="btn-secondary" style="font-size:9px;">${isWatched ? '👁️ Von Liste entfernen' : '👁️ Beobachten (passiv)'}</button>
                        </div>
                        <button onclick="signGlobalScoutPlayer(${idx})" class="btn-primary">Verpflichten [Ablöse: ~${formatVal(displayPrice)}${discount < 1 ? ' (Scout-Rabatt!)' : ''}]</button>
                    `;
                    list.appendChild(row);
                });
            }
        }
        renderTalentDatabase();
    }

    // 4. Talent-Datenbank: dauerhaftes Archiv aller je entdeckten Spieler.
    function renderTalentDatabase() {
        let box = document.getElementById('talent-database-box');
        if (!box) return;
        let db = scoutingNetwork.talentDatabase || [];
        if (db.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine Einträge in der Talent-Datenbank.</div>'; return; }
        let sorted = [...db].sort((a, b) => b.strength - a.strength).slice(0, 15);
        box.innerHTML = sorted.map(e => {
            let stillAvailable = globalScoutResults.some(p => p.id === e.id);
            let statusLabel = squad.some(p => p.id === e.id) ? '<span style="color:var(--primary);">Im Kader</span>' : (stillAvailable ? '<span style="color:var(--accent);">Verfügbar</span>' : '<span style="color:var(--text-muted);">Vergangen</span>');
            return `<div class="box" style="display:flex; justify-content:space-between; font-size:9px;"><span>${e.name} (${e.pos}, S${e.season}/${e.matchday})</span><span>Stärke ${e.strength} · ${statusLabel}</span></div>`;
        }).join('');
    }

    function signGlobalScoutPlayer(idx) {
        let p = globalScoutResults[idx];
        if (game.transferEmbargo) { alert("🚫 Transfersperre aktiv! Erst die Zahlungsfähigkeit wiederherstellen (siehe Finanzen)."); return; }
        let discount = 1.0 - (staffMembers.scout.hired ? 0.15 : 0);
        if (typeof getActiveStaffSynergies === 'function' && getActiveStaffSynergies().some(s => s.bonusKey === 'transferDiscount')) discount -= 0.05;
        let price = Math.round(p.marketValue * discount);
        if (game.money < price) { alert("Nicht genug Geld auf dem Vereinskonto!"); return; }
        playSound('goal');
        game.money -= price;
        squad.push(p);
        globalScoutResults.splice(idx, 1);
        scoutingNetwork.watchlist = scoutingNetwork.watchlist.filter(id => id !== p.id);
        let dbEntry = scoutingNetwork.talentDatabase.find(e => e.id === p.id);
        if (dbEntry) dbEntry.signed = true;
        renderGlobalScoutingView();
        updateUI();
    }
