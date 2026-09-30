
    // ==========================================
    // HALL OF FAME
    // ==========================================
    // Ewige Bestenlisten des Vereins aus gespeicherten Daten: aktueller Kader (goalsCareer,
    // appearances), Spieler, die ihre Karriere beendet haben (game.playerRetirement), und die
    // Saisonbilanzen (game.managerCareer). Die alte Version hielt alles nur im Arbeitsspeicher,
    // fand den eigenen Verein nie und meldete beim bloßen Öffnen "legendäre" Spieler.

    function getHallOfFameEntries() {
        const aktiv = squad.map(p => ({ name: p.name, goals: p.goalsCareer || 0, apps: p.appearances || 0, aktiv: true }));
        const ehemalig = ((game.playerRetirement && game.playerRetirement.retirementHistory) || [])
            .map(r => ({ name: r.playerName, goals: r.goals || 0, apps: r.appearances || 0, aktiv: false, tier: r.legendTier, season: r.retirementSeason }));
        const alle = [...aktiv, ...ehemalig.filter(r => !aktiv.some(a => a.name === r.name))];
        return {
            torjaeger: alle.filter(e => e.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5),
            rekordspieler: alle.filter(e => e.apps > 0).sort((a, b) => b.apps - a.apps).slice(0, 5),
            legenden: ehemalig.filter(e => e.tier).slice(-5).reverse(),
            saisons: (game.managerCareer || []).filter(e => e.club === game.clubName)
                .sort((a, b) => a.level - b.level || a.rank - b.rank || b.points - a.points).slice(0, 5)
        };
    }

    function renderHallOfFamePanel() {
        const box = document.getElementById('hall-of-fame-box');
        if (!box) return;
        const h = getHallOfFameEntries();
        const zeile = (links, rechts, gold) => `<div style="display:flex; justify-content:space-between; gap:6px; padding:2px 0; border-top:1px solid rgba(255,255,255,0.06);${gold ? ' color:var(--gold);' : ''}"><span>${links}</span><strong style="white-space:nowrap;">${rechts}</strong></div>`;
        const block = (titel, inhalt, leer) => `<div style="margin-bottom:8px;"><div style="font-weight:700; color:var(--accent); margin-bottom:2px;">${titel}</div>${inhalt || `<div style="color:var(--text-muted);">${leer}</div>`}</div>`;
        const tier = { ICON: 'Vereins-Ikone', LEGEND: 'Legende', CLUB_HERO: 'Vereinsheld' };
        box.innerHTML = `<div style="font-size:9px;">
            ${block('⚽ Ewige Torjäger', h.torjaeger.map(e => zeile(`${e.name}${e.aktiv ? '' : ' (ehemalig)'}`, `${e.goals} Tore`)).join(''), 'Noch keine Tore.')}
            ${block('🏟️ Rekordspieler', h.rekordspieler.map(e => zeile(`${e.name}${e.aktiv ? '' : ' (ehemalig)'}`, `${e.apps} Spiele`)).join(''), 'Noch keine Einsätze.')}
            ${block('⭐ Vereinslegenden', h.legenden.map(e => zeile(`${e.name} (Karriereende Saison ${e.season})`, tier[e.tier] || e.tier, true)).join(''), 'Legende wird, wer mit Stärke 85+ und 100+ Spielen seine Karriere beendet.')}
            ${block('🏆 Beste Saisons', h.saisons.map(e => zeile(`Saison ${e.season} · ${e.league}`, `Platz ${e.rank} · ${e.points} P.`)).join(''), 'Wird nach der ersten Saison gefüllt.')}
        </div>`;
    }
