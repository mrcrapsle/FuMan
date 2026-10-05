
    // Wandelt einen rohen Trophäen-Eintrag in Icon + Kategorie um, für eine chronologische
    // "Ehrengalerie" statt einer schlichten Liste (bringt auch den Legenden-Status sichtbar
    // zur Geltung statt ihn zwischen normalen Pokal-Einträgen untergehen zu lassen).
    function classifyTrophyEntry(t) {
        if (t.includes('Vereinslegende')) return { icon: '👑', color: 'var(--gold)', category: 'Legenden-Status' };
        if (t.includes('Champions Cup')) return { icon: '🌟', color: '#82b1ff', category: 'Europapokal' };
        if (t.includes('DFB-Pokal')) return { icon: '🏆', color: 'var(--accent)', category: 'Pokal' };
        if (t.includes('Supercup')) return { icon: '🏆', color: 'var(--gold)', category: 'Supercup' };
        if (t.includes('Hallenmasters')) return { icon: '🏟️', color: '#cbd5e1', category: 'Hallenturnier' };
        if (t.includes('Ungeschlagene Saison')) return { icon: '💯', color: 'var(--primary)', category: 'Perfekte Saison' };
        return { icon: '🏅', color: '#cbd5e1', category: 'Erfolg' };
    }

    // Derbygegner (Phase 24.2): wer aus derselben Stadt oder per Traditionsduell ein Derby ist,
    // dazu die Bilanz gegen jeden einzelnen (rivalryRecord.matches, alle Derbys).
    function renderRivalryHistoryBook() {
        let box = document.getElementById('rivalry-history-book');
        if (!box) return;
        let gegner = typeof getOwnDerbyRivals === 'function' ? getOwnDerbyRivals() : [];
        let spiele = rivalryRecord.matches || [];
        let bilanz = name => {
            let m = spiele.filter(x => x.opp === name);
            return m.length ? `${m.filter(x => x.ourGoals > x.oppGoals).length}S ${m.filter(x => x.ourGoals === x.oppGoals).length}U ${m.filter(x => x.ourGoals < x.oppGoals).length}N` : 'noch kein Derby';
        };
        let kopf = `<div class="box" style="font-size:10px;">🏙️ Heimat: <strong>${typeof getClubCity === 'function' ? getClubCity(game.clubName) : '-'}</strong> · Derby-Bilanz gesamt: ${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N</div>`;
        box.innerHTML = kopf + (gegner.length
            ? gegner.slice(0, 12).map(g => `<div class="box" style="display:flex; justify-content:space-between; gap:6px; font-size:10px;"><span>${g.name} <span style="color:var(--text-muted);">(${g.label}, ${leagueNames[g.level]})</span></span><strong>${bilanz(g.name)}</strong></div>`).join('')
            : '<div class="box" style="font-size:10px; color:#94a3b8;">Kein anderer Verein aus deiner Stadt und kein Traditionsrivale in der Pyramide.</div>');
    }

    // Generationsübergreifende Legenden-Vergleiche: gruppiert alle ehemaligen Spieler
    // aus notablePastPlayers in 5-Saison-"Generationen" und zeigt die stärkste pro Ära.
    function renderLegendGenerationComparison() {
        let box = document.getElementById('legend-generations-box');
        if (!box) return;
        let players = game.notablePastPlayers || [];
        if (players.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine ehemaligen Spieler in der Vereinshistorie.</div>'; return; }
        let generations = {};
        players.forEach(p => {
            let genKey = Math.floor((p.season - 1) / 5); // 5-Saison-Generationen
            let genLabel = `Saison ${genKey * 5 + 1}-${genKey * 5 + 5}`;
            if (!generations[genLabel] || generations[genLabel].strength < p.strength) generations[genLabel] = p;
        });
        box.innerHTML = Object.entries(generations).map(([label, p]) => `<div class="box" style="display:flex; justify-content:space-between; font-size:10px;"><span>${label}</span><strong>${p.name} (${p.strength})</strong></div>`).join('');
    }

    // Vereinsrekorde: dauerhaftes Rekordarchiv für den gesamten Verein.
    function renderClubRecordsBox() {
        let box = document.getElementById('club-records-box');
        if (!box) return;
        let r = game.clubRecords || {};
        let topScorerCareer = [...squad].sort((a, b) => (b.goalsCareer || 0) - (a.goalsCareer || 0))[0];
        let fmt = (rec) => rec ? `${rec.ourGoals}:${rec.oppGoals} vs. ${rec.opponent} (S${rec.season}/${rec.matchday})` : 'Noch nicht aufgestellt';
        box.innerHTML = `
            <div class="box" style="font-size:10px;">🏆 <strong>Höchster Sieg:</strong> ${fmt(r.biggestWin)}</div>
            <div class="box" style="font-size:10px;">💔 <strong>Höchste Niederlage:</strong> ${fmt(r.biggestLoss)}</div>
            <div class="box" style="font-size:10px;">⚽ <strong>Torreichstes Spiel:</strong> ${r.mostGoalsInMatch ? `${r.mostGoalsInMatch.total} Tore (${r.mostGoalsInMatch.score} vs. ${r.mostGoalsInMatch.opponent})` : 'Noch nicht aufgestellt'}</div>
            <div class="box" style="font-size:10px;">🎟️ <strong>Zuschauerrekord:</strong> ${(game.recordAttendance || 0).toLocaleString('de-DE')}${game.recordAttendanceSeason ? ` (Saison ${game.recordAttendanceSeason})` : ''}</div>
            <div class="box" style="font-size:10px;">🔥 <strong>Längste Serie ohne Niederlage:</strong> ${r.longestUnbeatenStreak || 0} Spiele</div>
            <div class="box" style="font-size:10px;">👑 <strong>Bester Torschütze (Karriere):</strong> ${topScorerCareer && topScorerCareer.goalsCareer > 0 ? `${topScorerCareer.name} (${topScorerCareer.goalsCareer} Tore)` : 'Noch nicht aufgestellt'}</div>
        `;
    }

    // Liga-Chronik: macht die seit der persistenten Liga-Pyramide (siehe
    // advanceLeaguesToNewSeason() in leagues.js) mitlaufende team.strengthHistory sichtbar -
    // zeigt die größten Stärke-Gewinner/-Verlierer der letzten Saison über alle 108 Vereine,
    // statt dass diese Entwicklung nur unsichtbar im Hintergrund abläuft.
    function renderLeagueChronikBox() {
        let box = document.getElementById('league-chronik-box');
        if (!box) return;
        let deltas = leaguesData.flat()
            .filter(t => t.name !== game.clubName && t.strengthHistory && t.strengthHistory.length > 0)
            .map(t => {
                let prev = t.strengthHistory[t.strengthHistory.length - 1].strength;
                return { name: t.name, prev, curr: t.strength, delta: t.strength - prev };
            });
        if (deltas.length === 0) {
            box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Die Chronik füllt sich, sobald die erste Saison in der Liga-Pyramide abgeschlossen ist.</div>';
            return;
        }
        let risers = [...deltas].filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
        let fallers = [...deltas].filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);
        let row = d => `<div class="box" style="display:flex; justify-content:space-between; font-size:10px;"><span>${d.name}</span><strong style="color:${d.delta > 0 ? 'var(--primary)' : 'var(--danger)'};">${d.prev} → ${d.curr} (${d.delta > 0 ? '+' : ''}${d.delta})</strong></div>`;
        box.innerHTML = `
            <div style="font-size:9px; font-weight:800; color:var(--primary); margin:6px 0 3px;">📈 GRÖSSTE AUFSTEIGER (STÄRKE)</div>
            ${risers.length === 0 ? '<div style="font-size:9px; color:var(--text-muted);">Keine nennenswerten Aufsteiger diese Saison.</div>' : risers.map(row).join('')}
            <div style="font-size:9px; font-weight:800; color:var(--danger); margin:6px 0 3px;">📉 GRÖSSTE ABSTEIGER (STÄRKE)</div>
            ${fallers.length === 0 ? '<div style="font-size:9px; color:var(--text-muted);">Keine nennenswerten Absteiger diese Saison.</div>' : fallers.map(row).join('')}
        `;
    }

    function renderHistoryView() {
        renderClubRecordsBox();
        if (typeof renderAchievementsBox === 'function') renderAchievementsBox();
        renderLeagueChronikBox();
        if (typeof renderPlayerOfMonthBox === 'function') renderPlayerOfMonthBox();
        if (typeof renderPlayerOfSeasonBox === 'function') renderPlayerOfSeasonBox();
        if (typeof renderLeagueAwardsBox === 'function') renderLeagueAwardsBox();
        if (typeof renderHallOfFamePanel === 'function') renderHallOfFamePanel();
        if (typeof renderManagerAnalyticsPanel === 'function') renderManagerAnalyticsPanel();
        if (typeof renderSeasonForecastHistory === 'function') renderSeasonForecastHistory();
        if (typeof renderCupFinalHistory === 'function') renderCupFinalHistory();
        if (typeof renderDerbyHistory === 'function') renderDerbyHistory();
        let list = document.getElementById('trophies-list');
        list.innerHTML = '';
        renderRivalryHistoryBook();
        renderLegendGenerationComparison();
        if (game.trophies.length === 0) { list.innerHTML = '<div class="box">Noch keine Pokale im Trophäenschrank.</div>'; }
        else {
            // Chronologisch (Reihenfolge des Erwerbs = Reihenfolge im Array) statt alphabetisch.
            game.trophies.forEach((t, idx) => {
                let meta = classifyTrophyEntry(t);
                list.innerHTML += `
                    <div class="box" style="border-left-color:${meta.color}; display:flex; align-items:center; gap:10px;">
                        <span style="font-size:20px;">${meta.icon}</span>
                        <span style="flex:1;">
                            <span style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">${meta.category} · #${idx + 1}</span><br>
                            <strong style="color:${meta.color};">${t}</strong>
                        </span>
                    </div>`;
            });
        }
        if (game.legendStatus) {
            list.innerHTML = `<div class="box box-admin" style="text-align:center; margin-bottom:10px;"><strong style="color:var(--gold); font-size:13px;">👑 VEREINSLEGENDE 👑</strong><br><span style="font-size:10px;">${game.loyaltyDeclineCount || 0}× Abwerbeversuchen widerstanden</span></div>` + list.innerHTML;
        }
        // Zuschauerrekord als dedizierte Statistik-Zeile statt Trophäen-Eintrag.
        if (game.recordAttendance > 0) {
            list.innerHTML += `<div class="box" style="border-left-color:var(--blue); margin-top:10px;"><span style="font-size:9px; color:#94a3b8; text-transform:uppercase;">Statistik</span><br><strong style="color:var(--blue);">📊 Zuschauerrekord: ${game.recordAttendance.toLocaleString('de-DE')} (Saison ${game.recordAttendanceSeason})</strong></div>`;
        }
    }

