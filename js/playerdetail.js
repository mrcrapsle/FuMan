    // ==========================================
    // SPIELER-DETAIL-POPUP: wiederverwendbares Modal für Kader, Transfermarkt, Scouting &
    // zweite Mannschaft - im Stil der Referenz-App (Foto, Kerndaten-Grid, 18er-Fähigkeiten-
    // Raster, Schließen/Mit-Spieler-Sprechen).
    // ==========================================
    let currentDetailPlayerId = null;
    let currentDetailPlayerPool = 'squad'; // 'squad' | 'secondTeam' | 'market' | 'scout'

    function findPlayerInPool(id, pool) {
        if (pool === 'squad') return squad.find(p => p.id === id);
        if (pool === 'secondTeam') return secondTeamSquad.find(p => p.id === id);
        if (pool === 'market') return marketPlayers.find(p => p.id === id) || freeAgentPlayers.find(p => p.id === id) || (typeof secondTeamMarketPlayers !== 'undefined' ? secondTeamMarketPlayers.find(p => p.id === id) : null);
        if (pool === 'scout') return (typeof globalScoutResults !== 'undefined' ? globalScoutResults.find(p => p.id === id) : null);
        if (pool === 'youth') return (typeof youthTalents !== 'undefined' ? youthTalents.find(p => p.id === id) : null);
        return squad.find(p => p.id === id);
    }

    function openPlayerDetail(id, pool = 'squad') {
        let p = findPlayerInPool(id, pool);
        if (!p) return;
        currentDetailPlayerId = id;
        currentDetailPlayerPool = pool;
        playSound('click');

        let stats = getDisplayStats(p);
        let statOrder = ['OFF', 'ABS', 'DEF', 'INT', 'PRE', 'TEM', 'PAS', 'ZKH', 'ZKE', 'FLA', 'KOP', 'SPR', 'DRI', 'WEI', 'ELF', 'FRS', 'FIT', 'GRU'];
        let posEmoji = { TW: '🧤', ABW: '🛡️', MIT: '⚙️', ST: '⚽' }[p.pos] || '👤';

        document.getElementById('pd-name').innerText = p.name;
        document.getElementById('pd-avatar').innerText = posEmoji;
        document.getElementById('pd-fields').innerHTML = `
            <span class="label">Position:</span><span class="val">${p.pos}${p.secondaryPositions && p.secondaryPositions.length ? ' (' + p.secondaryPositions.join(', ') + ')' : ''}</span>
            <span class="label">Nation:</span><span class="val">${p.nation || 'Deutschland'}</span>
            <span class="label">Alter:</span><span class="val">${p.age || '-'}</span>
            <span class="label">Geburtsdatum:</span><span class="val">${p.birthDate || '-'}</span>
            <span class="label">Rating:</span><span class="val">${p.strength}</span>
            <span class="label">Talent:</span><span class="val">${p.strength}</span>
            <span class="label">Moral:</span><span class="val">${p.morale ?? '-'}</span>
            <span class="label">Fitness:</span><span class="val">${p.fitness ?? '-'}</span>
            <span class="label">Größe:</span><span class="val">${p.height ? p.height + ' cm' : '-'}</span>
            <span class="label">Persönlichkeit:</span><span class="val">${p.personality || '-'}</span>
            <span class="label">Charakter:</span><span class="val">${p.character || '-'}</span>
            <span class="label">Berater:</span><span class="val">${p.agent ? `🕴️ ${p.agent.name} (${Math.round(p.agent.feePct * 100)}%)` : 'Kein Berater'}</span>
            <span class="label">Verletzungsanfälligkeit:</span><span class="val" style="color:${(p.timesInjured||0) >= 3 ? 'var(--danger)' : ((p.timesInjured||0) >= 1 ? 'var(--accent)' : 'var(--primary)')};">${(p.timesInjured||0) === 0 ? 'Robust' : `${p.timesInjured}× verletzt`}</span>
            <span class="label">Kabinen-Freund:</span><span class="val">${p.friendPlayerId ? (squad.find(x => x.id === p.friendPlayerId)?.name || '-') : 'Keiner'}</span>
            <span class="label">Elfmeter-Quote:</span><span class="val">${(p.penaltiesTaken || 0) > 0 ? `${p.penaltiesScored}/${p.penaltiesTaken} (${Math.round((p.penaltiesScored/p.penaltiesTaken)*100)}%)` : 'Noch keine Schüsse'}</span>
            <span class="label">Publikumsliebling:</span><span class="val">${p.isCrowdFavorite ? '❤️ Ja (aktuelle Saison)' : 'Nein'}</span>
            <span class="label">Marktwert:</span><span class="val">${formatVal(p.marketValue || 0)}</span>
        `;
        document.getElementById('pd-stats').innerHTML = statOrder.map(k => `<div class="modal-stat-chip"><span class="k">${k}</span><span class="v">${stats[k]}</span></div>`).join('');
        document.getElementById('pd-talk-btn').style.display = (pool === 'squad' || pool === 'secondTeam') ? 'block' : 'none';

        // Spielerwert-Entwicklungskurve (NEU): eine kleine SVG-Sparkline zeigt, wie sich die
        // Stärke des Spielers über die Saisons entwickelt hat - bisher gab es nur den
        // aktuellen Momentanwert ohne jede historische Einordnung.
        let historyBox = document.getElementById('pd-strength-history');
        if (historyBox) {
            let hist = p.strengthHistory && p.strengthHistory.length > 1 ? p.strengthHistory : null;
            if (!hist) {
                historyBox.innerHTML = '';
            } else {
                let w = 260, h = 50, pad = 4;
                let minS = Math.min(...hist.map(h => h.strength)) - 2;
                let maxS = Math.max(...hist.map(h => h.strength)) + 2;
                let range = Math.max(1, maxS - minS);
                let points = hist.map((entry, i) => {
                    let x = pad + (i / (hist.length - 1)) * (w - pad * 2);
                    let y = h - pad - ((entry.strength - minS) / range) * (h - pad * 2);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');
                let trendUp = hist[hist.length - 1].strength >= hist[0].strength;
                let color = trendUp ? 'var(--primary)' : 'var(--danger)';
                historyBox.innerHTML = `
                    <div style="font-size:9px; color:var(--text-muted); margin-bottom:2px; text-align:left;">📈 Werteentwicklung (${hist[0].season}-${hist[hist.length-1].season})</div>
                    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px;">
                        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
                        ${hist.map((entry, i) => {
                            let x = pad + (i / (hist.length - 1)) * (w - pad * 2);
                            let y = h - pad - ((entry.strength - minS) / range) * (h - pad * 2);
                            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"/>`;
                        }).join('')}
                    </svg>
                `;
            }
        }

        // Tiefere Scouting-Berichte (NEU): Text-Dossier statt nur Zahlen, nur bei Spielern
        // aus dem Scouting-Pool relevant.
        let reportBox = document.getElementById('pd-scouting-report');
        if (reportBox) {
            if (pool === 'scout') {
                let report = generateScoutingReport(p);
                reportBox.style.display = 'block';
                reportBox.innerHTML = `<div class="box" style="font-size:10px; text-align:left;">
                    <strong style="color:var(--primary);">Stärken:</strong> ${report.strengths.join(', ')}<br>
                    <strong style="color:var(--danger);">Schwächen:</strong> ${report.weaknesses.join(', ')}
                </div>`;
            } else {
                reportBox.style.display = 'none';
                reportBox.innerHTML = '';
            }
        }
        // Berater-Beziehungspflege (NEU)
        let agentBtn = document.getElementById('pd-agent-relationship-btn');
        if (agentBtn) {
            if (p.agent) {
                let rel = (game.agentRelationships && game.agentRelationships[p.agent.name]) || 0;
                agentBtn.style.display = 'block';
                agentBtn.innerText = `🤝 Beziehung zu ${p.agent.name} pflegen (Stufe ${rel})`;
                agentBtn.setAttribute('onclick', `improveAgentRelationship('${p.agent.name}')`);
            } else {
                agentBtn.style.display = 'none';
            }
        }
        document.getElementById('player-detail-overlay').classList.add('show');
    }

    function closePlayerDetail() {
        document.getElementById('player-detail-overlay').classList.remove('show');
        currentDetailPlayerId = null;
    }

    function talkToPlayerFromDetail() {
        let p = findPlayerInPool(currentDetailPlayerId, currentDetailPlayerPool);
        if (!p) return;
        let lines = [
            `"${p.name}" nickt entschlossen: "Ich gebe für dieses Team alles, Trainer!"`,
            `${p.name} wirkt zufrieden mit der aktuellen Rolle im Team.`,
            `${p.name} wünscht sich mehr Einsatzzeit, bleibt aber professionell.`,
            `${p.name} bedankt sich für das Vertrauen des Trainerteams.`
        ];
        showToast(lines[Math.floor(Math.random() * lines.length)], 'success');
        p.morale = Math.min(100, (p.morale || 80) + 2);
        closePlayerDetail();
        updateUI();
    }
