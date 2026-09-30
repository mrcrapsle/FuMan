
    // ==========================================
    // MANAGER-STATISTIK
    // ==========================================
    // Karrierebilanz des Managers über alle Saisons und Vereine, gespeichert in
    // game.managerCareer. Die alte Version hielt ihre Daten nur im Arbeitsspeicher, zählte Siege
    // aus einem nie gesetzten Feld und fand über game.clubId (gibt es nicht) immer den ersten
    // Verein der Tabelle statt den eigenen.

    // Saisonende, vor Auf-/Abstieg (siehe concludeSeasonAndAdvance).
    function recordSeasonalManagerStats(rank, record, level) {
        if (!record) return;
        if (!game.managerCareer) game.managerCareer = [];
        if (game.managerCareer.some(e => e.season === game.season && e.club === game.clubName)) return;
        game.managerCareer.push({
            season: game.season, club: game.clubName, level, league: leagueNames[level], rank,
            won: record.won || 0, drawn: record.drawn || 0, lost: record.lost || 0,
            goalsFor: record.goalsFor || 0, goalsAgainst: record.goalsAgainst || 0, points: record.points || 0
        });
        if (game.managerCareer.length > 40) game.managerCareer.shift();
    }

    function getManagerCareerTotals() {
        const liste = game.managerCareer || [];
        const t = { seasons: liste.length, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, promotions: 0, relegations: 0, titles: 0, best: null };
        liste.forEach((e, i) => {
            t.won += e.won; t.drawn += e.drawn; t.lost += e.lost; t.goalsFor += e.goalsFor; t.goalsAgainst += e.goalsAgainst;
            if (e.rank === 1) t.titles++;
            const next = liste[i + 1];
            if (next && next.club === e.club) {
                if (next.level < e.level) t.promotions++;
                else if (next.level > e.level) t.relegations++;
            }
            if (!t.best || e.level < t.best.level || (e.level === t.best.level && e.rank < t.best.rank)) t.best = e;
        });
        t.matches = t.won + t.drawn + t.lost;
        return t;
    }

    function renderManagerAnalyticsPanel() {
        const box = document.getElementById('manager-analytics-box');
        if (!box) return;
        const liste = game.managerCareer || [];
        if (!liste.length) {
            box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Die Bilanz wird nach der ersten abgeschlossenen Saison geführt.</div>';
            return;
        }
        const t = getManagerCareerTotals();
        const quote = t.matches ? Math.round(t.won / t.matches * 100) : 0;
        const kachel = (label, wert, sub) => `<div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:6px; text-align:center;">
            <div style="font-size:8px; color:var(--text-muted);">${label}</div><div style="font-size:15px; font-weight:800;">${wert}</div><div style="font-size:8px; color:var(--text-muted);">${sub}</div></div>`;
        box.innerHTML = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px; margin-bottom:8px;">
                ${kachel('Bilanz', `${t.won}-${t.drawn}-${t.lost}`, `${t.matches} Ligaspiele · ${quote}% Siege`)}
                ${kachel('Tore', `${t.goalsFor}:${t.goalsAgainst}`, `${t.seasons} Saison(s)`)}
                ${kachel('Meisterschaften', t.titles, `${t.promotions} Aufstieg(e) · ${t.relegations} Abstieg(e)`)}
                ${kachel('Bestes Ergebnis', `Platz ${t.best.rank}`, t.best.league)}
            </div>
            <div style="font-size:9px;">${liste.slice(-6).reverse().map(e => `<div style="display:flex; justify-content:space-between; gap:6px; padding:2px 0; border-top:1px solid rgba(255,255,255,0.06);">
                <span>Saison ${e.season} · ${e.club}</span><span style="white-space:nowrap;">${e.league.replace(/ \(.*\)/, '')} · Platz <strong>${e.rank}</strong> · ${e.won}-${e.drawn}-${e.lost} · ${e.points} P.</span></div>`).join('')}</div>`;
    }
