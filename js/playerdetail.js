
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
        if (pool === 'precontract') return (game.preContractPool && game.preContractPool.players || []).find(p => p.id === id) || null;
        if (pool === 'youth') return (typeof youthTalents !== 'undefined' ? youthTalents.find(p => p.id === id) : null);
        return squad.find(p => p.id === id);
    }

    // Legenden behalten ihre Nummer: nach dem Karriereende bleibt sie für neue Spieler gesperrt (25.41).
    // Gibt eine Map Nummer → Legendenname zurück.
    function gesperrteRueckennummern() {
        const map = new Map();
        ((game.playerRetirement && game.playerRetirement.legendPlayers) || [])
            .forEach(l => { if (l.nummer) map.set(l.nummer, l.playerName || l.name || 'eine Legende'); });
        return map;
    }

    // Kleinste Rückennummer, die im Kader und bei den Legenden noch frei ist (25.40). Null, wenn alle 1-99 belegt sind.
    function naechsteFreieRueckennummer(p) {
        const belegt = new Set(squad.filter(s => s !== p && s.nummer).map(s => s.nummer));
        const gesperrt = gesperrteRueckennummern();
        for (let n = 1; n <= 99; n++) if (!belegt.has(n) && !gesperrt.has(n)) return n;
        return null;
    }

    // Rückennummer setzen. Eine Nummer, die ein anderer Spieler im Kader trägt oder die einer Legende gehört,
    // wird abgelehnt - mit Meldung.
    function speichereRueckennummer(id, wert) {
        const p = squad.find(x => String(x.id) === String(id));
        if (!p) return false;
        const n = parseInt(wert, 10);
        const andere = squad.find(s => s !== p && s.nummer === n);
        const legende = gesperrteRueckennummern().get(n);
        if (andere || legende) {
            showToast(andere ? `🎽 Nummer ${n} trägt schon ${andere.name}.` : `🎽 Nummer ${n} gehört der Legende ${legende}.`, 'error', 3000);
            const auswahl = document.getElementById('pd-nummer');
            if (auswahl) auswahl.value = p.nummer;
            return false;
        }
        p.nummer = n;
        showToast(`🎽 Rückennummer ${n} gesetzt`, 'success', 1500);
        return true;
    }

    // Notiz zu einem Spieler für die laufende Saison (25.40). Eine leere Notiz wird entfernt.
    function speichereSpielerNotiz(id, text) {
        const p = squad.find(x => String(x.id) === String(id));
        if (!p) return;
        if (!p.notizen) p.notizen = {};
        const sauber = String(text || '').trim().slice(0, 300);
        if (sauber) p.notizen[game.season] = sauber;
        else delete p.notizen[game.season];
        showToast('📝 Notiz gespeichert', 'success', 1200);
    }

    function openPlayerDetail(id, pool = 'squad') {
        let p = findPlayerInPool(id, pool);
        if (!p) return;
        currentDetailPlayerId = id;
        currentDetailPlayerPool = pool;
        playSound('click');

        let stats = getDisplayStats(p);
        let statOrder = ['OFF', 'ABS', 'DEF', 'INT', 'PRE', 'TEM', 'PAS', 'ZKH', 'ZKE', 'FLA', 'KOP', 'SPR', 'DRI', 'WEI', 'ELF', 'FRS', 'FIT', 'GRU'];
        document.getElementById('pd-name').innerText = p.name;
        // Spielerporträt (siehe js/avatars.js): ersetzt das bisherige reine Positions-
        // Emoji durch ein pro Spieler eindeutiges, deterministisch generiertes Porträt.
        let avatarBox = document.getElementById('pd-avatar');
        if (avatarBox) avatarBox.innerHTML = (typeof getPlayerAvatarSVG === 'function') ? getPlayerAvatarSVG(p, 76) : (({ TW: '🧤', ABW: '🛡️', MIT: '⚙️', ST: '⚽' }[p.pos] || '👤'));
        // Kopf nach dem Kartenmuster: das Wichtigste als Chips und Werteleiste, darunter die vollständige Liste
        let summaryBox = document.getElementById('pd-summary');
        if (summaryBox) {
            const verletzt = (p.timesInjured || 0) >= 3 || p.chronicIssue ? 'schlecht' : ((p.timesInjured || 0) >= 1 ? 'warn' : 'gut');
            summaryBox.innerHTML = `
                <div class="ui-card-meta" style="justify-content:center; margin:8px 0;">${[
                    uiChip(`<span class="badge badge-${(p.pos || 'mit').toLowerCase()}">${p.pos}</span>`),
                    p.age ? uiChip(`${p.age} J.`) : '',
                    uiChip(p.nation || 'Deutschland'),
                    p.character ? uiChip(p.character) : '',
                    p.agent ? uiChip('🕴️ Berater') : '',
                    (pool === 'squad' && typeof getWageRating === 'function') ? (w => uiChip(w.text, w.ton))(getWageRating(p)) : '',
                    pool === 'squad' || pool === 'secondTeam' ? uiChip(`📄 ${p.contracts ?? '-'} J. Vertrag`, (p.contracts ?? 9) <= 1 ? 'schlecht' : ((p.contracts ?? 9) === 2 ? 'warn' : '')) : '',
                    (pool === 'squad' || pool === 'secondTeam') ? uiChip(verletzt === 'gut' ? 'Robust' : 'Verletzungsanfällig', verletzt) : ''
                ].join('')}</div>
                ${renderUiStatRow(typeof fw === 'function' ? [[fw('Stärke'), p.strength], [fw('Moral'), p.morale ?? '-'], [fw('Fitness'), p.fitness ?? '-'], [fw('Marktwert'), formatVal(p.marketValue || 0)]] : [['Stärke', p.strength], ['Moral', p.morale ?? '-'], ['Fitness', p.fitness ?? '-'], ['Marktwert', formatVal(p.marketValue || 0)]])}
                <div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:12px 0 4px; text-align:left;">Alle Angaben</div>`;
        }
        document.getElementById('pd-fields').innerHTML = `
            <span class="label">Position:</span><span class="val">${p.pos}${p.secondaryPositions && p.secondaryPositions.length ? ' (' + p.secondaryPositions.join(', ') + ')' : ''}</span>
            <span class="label">Nation:</span><span class="val">${p.nation || 'Deutschland'}</span>
            <span class="label">Alter:</span><span class="val">${p.age || '-'}</span>
            <span class="label">Geburtsdatum:</span><span class="val">${p.birthDate || '-'}</span>
            <span class="label">Rating:</span><span class="val">${p.strength}</span>
            ${typeof p.potential === 'number' && typeof getYouthPotentialText === 'function' ? `<span class="label">Potenzial:</span><span class="val">${getYouthPotentialText(p)}</span>` : ''}
            ${p.potentialRevealed && typeof p.potential === 'number' && typeof getKaderMedian === 'function' && getKaderMedian() !== null ? `<span class="label">Kader-Median:</span><span class="val">${getKaderMedian()} (Potenzial ${p.potential < getKaderMedian() ? 'darunter' : 'erreicht oder darüber'})</span>` : ''}
            ${(pool === 'squad' || pool === 'secondTeam') && typeof getTrainingGainsLabel === 'function' ? `<span class="label">Trainingsplus:</span><span class="val">${getTrainingGainsLabel(p)}</span>` : ''}
            <span class="label">${typeof fw === 'function' ? fw('Moral') : 'Moral'}:</span><span class="val">${p.morale ?? '-'}</span>
            <span class="label">${typeof fw === 'function' ? fw('Fitness') : 'Fitness'}:</span><span class="val">${p.fitness ?? '-'}</span>
            <span class="label">Größe:</span><span class="val">${p.height ? p.height + ' cm' : '-'}</span>
            <span class="label">Persönlichkeit:</span><span class="val">${p.personality || '-'}</span>
            <span class="label">Charakter:</span><span class="val">${p.character || '-'}</span>
            <span class="label">Berater:</span><span class="val">${p.agent ? `🕴️ ${p.agent.name} (${Math.round(p.agent.feePct * 100)}%)` : 'Kein Berater'}</span>
            <span class="label">Verletzungsanfälligkeit:</span>${marketPlayers.includes(p) && typeof getMedicalTag === 'function'
                ? `<span class="val">${p.medical && p.medical.checked ? describeMedical(p.medical) : '❓ unbekannt - Medizincheck im Transferpoker'}</span>`
                : `<span class="val" style="color:${(p.timesInjured||0) >= 3 || p.chronicIssue ? 'var(--danger)' : ((p.timesInjured||0) >= 1 ? 'var(--accent)' : 'var(--primary)')};">${(p.timesInjured||0) === 0 ? 'Robust' : `${p.timesInjured}× verletzt`}${p.chronicIssue ? ' · 🩹 chronisch (×1,5 Risiko)' : ''}</span>`}
            <span class="label">Kabinen-Freund:</span><span class="val">${p.friendPlayerId ? (squad.find(x => x.id === p.friendPlayerId)?.name || '-') : 'Keiner'}</span>
            <span class="label">Elfmeter-Quote:</span><span class="val">${(p.penaltiesTaken || 0) > 0 ? `${p.penaltiesScored}/${p.penaltiesTaken} (${Math.round((p.penaltiesScored/p.penaltiesTaken)*100)}%)` : 'Noch keine Schüsse'}</span>
            <span class="label">Publikumsliebling:</span><span class="val">${p.isCrowdFavorite ? '❤️ Ja (aktuelle Saison)' : 'Nein'}</span>
            <span class="label">${typeof fw === 'function' ? fw('Marktwert') : 'Marktwert'}:</span><span class="val">${formatVal(p.marketValue || 0)}</span>
        `;
        // Eigene Notiz zu diesem Spieler für die laufende Saison (25.40), nur für den eigenen Kader.
        if (pool === 'squad') {
            const notizText = ((p.notizen || {})[game.season] || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            // Rückennummer (25.40): ohne Nummer bekommt der Spieler die kleinste freie zugewiesen.
            if (!p.nummer) p.nummer = naechsteFreieRueckennummer(p);
            const belegt = new Set(squad.filter(s => s !== p && s.nummer).map(s => s.nummer));
            const gesperrt = gesperrteRueckennummern();
            const nummernOptionen = Array.from({ length: 99 }, (_, i) => i + 1)
                .map(n => {
                    const sperre = gesperrt.has(n) ? ' (Legende)' : (belegt.has(n) ? ' (belegt)' : '');
                    return `<option value="${n}" ${n === p.nummer ? 'selected' : ''} ${sperre ? 'disabled' : ''}>${n}${sperre}</option>`;
                }).join('');
            document.getElementById('pd-fields').insertAdjacentHTML('beforeend', `<div style="grid-column:1 / -1; margin-top:6px;">
                <span class="label">🎽 Rückennummer:</span>
                <select id="pd-nummer" style="font-size:var(--fs-body); margin-top:3px;" onchange="speichereRueckennummer('${p.id}', this.value)">${nummernOptionen}</select>
            </div>
            <div style="grid-column:1 / -1; margin-top:6px;">
                <span class="label">📝 Notiz (Saison ${game.season}):</span>
                <textarea id="pd-notiz" maxlength="300" rows="2" style="width:100%; box-sizing:border-box; font-size:var(--fs-body); margin-top:3px;" onchange="speichereSpielerNotiz('${p.id}', this.value)">${notizText}</textarea>
            </div>`);
        }
        document.getElementById('pd-stats').innerHTML = statOrder.map(k => `<div class="modal-stat-chip"><span class="k">${k}</span><span class="v">${stats[k]}</span></div>`).join('');
        document.getElementById('pd-talk-btn').style.display = (pool === 'squad' || pool === 'secondTeam') ? 'block' : 'none';

        // Spielerwert-Entwicklungskurve: eine kleine SVG-Sparkline zeigt, wie sich die
        // Stärke des Spielers über die Saisons entwickelt hat - bisher gab es nur den
        // aktuellen Momentanwert ohne jede historische Einordnung.
        if (typeof renderPlayerForm === 'function') renderPlayerForm(p);
        if (typeof renderPlayerTags === 'function') renderPlayerTags(p);
        if (typeof renderMarketValueCurve === 'function') renderMarketValueCurve(p);
        if (typeof renderDevelopmentForecast === 'function') renderDevelopmentForecast(p);
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
                    <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:2px; text-align:left;">📈 Werteentwicklung (${hist[0].season}-${hist[hist.length-1].season})</div>
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

        // Career Progression Panel: Karriere-Statistik und Meilensteine
        let careerBox = document.getElementById('pd-career-progression');
        if (careerBox) {
            if (typeof renderPlayerProfile === 'function') {
                let careerHtml = renderPlayerProfile(p);
                if (careerHtml) {
                    careerBox.style.display = 'block';
                    careerBox.innerHTML = careerHtml;
                } else {
                    careerBox.style.display = 'none';
                }
            }
        }

        // Tiefere Scouting-Berichte: Text-Dossier statt nur Zahlen, nur bei Spielern
        // aus dem Scouting-Pool relevant.
        let reportBox = document.getElementById('pd-scouting-report');
        if (reportBox) {
            if (pool === 'scout') {
                let report = generateScoutingReport(p);
                reportBox.style.display = 'block';
                reportBox.innerHTML = `<div class="box" style="font-size:var(--fs-small); text-align:left;">
                    <strong style="color:var(--primary);">Stärken:</strong> ${report.strengths.join(', ')}<br>
                    <strong style="color:var(--danger);">Schwächen:</strong> ${report.weaknesses.join(', ')}
                </div>`;
            } else {
                reportBox.style.display = 'none';
                reportBox.innerHTML = '';
            }
        }
        // Berater-Beziehungspflege
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

