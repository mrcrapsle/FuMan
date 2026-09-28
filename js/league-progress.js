
    // ==========================================
    // LIGA-PROGRESS-SYSTEM
    // ==========================================
    // Visuelle Darstellung des Ligaverlaufs:
    // Ligatabelle, Punkte-Trend, Platzierungshistorie

    let leagueProgressHistory = {
        matchdayData: [], // Array von { matchday, position, points, goalDiff, gf, ga }
        seasonData: [] // Array von Saisons mit finalen Platzierungen
    };

    function recordLeagueProgress() {
        if (game.matchday % 4 !== 0) return; // Nur monatlich

        // Find current position and stats from live table
        let currentLeague = leaguesData[game.leagueLevel];
        if (!currentLeague || !currentLeague.table) return;

        let ourId = game.clubId;
        let our = currentLeague.table.find(t => t.id === ourId);
        if (!our) return;

        leagueProgressHistory.matchdayData.push({
            matchday: game.matchday,
            season: game.season,
            position: currentLeague.table.indexOf(our) + 1,
            points: our.points || 0,
            goalDiff: (our.gf || 0) - (our.ga || 0),
            gf: our.gf || 0,
            ga: our.ga || 0,
            played: our.played || 0,
            wins: our.wins || 0,
            draws: our.draws || 0,
            losses: our.losses || 0
        });

        // Keep only last season + current season data
        if (leagueProgressHistory.matchdayData.length > 40) {
            leagueProgressHistory.matchdayData.shift();
        }
    }

    function renderLeagueProgressCharts() {
        renderLeaguePositionTrend();
        renderLeaguePointsTrend();
        renderCurrentStandings();
    }

    function renderLeaguePositionTrend() {
        let container = document.getElementById('league-position-chart');
        if (!container || leagueProgressHistory.matchdayData.length < 2) {
            if (container) container.innerHTML = '<div style="font-size:9px; color:#94a3b8;">Noch nicht genug Daten verfügbar</div>';
            return;
        }

        let data = leagueProgressHistory.matchdayData.slice(-12);
        let maxPos = Math.max(...data.map(d => d.position)) + 1;
        let chartHeight = 120;
        let barWidth = Math.max(20, Math.floor((container.offsetWidth - 40) / data.length));

        let html = `
            <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">Ligaplatzierung (letzte 12 Monate)</div>
            <div style="display:flex; align-items:flex-end; justify-content:space-around; height:${chartHeight}px; background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; gap:3px; border:1px solid rgba(255,255,255,0.1);">
        `;

        data.forEach((d, i) => {
            // Position: 1 at top, more at bottom
            let posHeight = (1 - (d.position / maxPos)) * (chartHeight - 16);
            let color = d.position <= 3 ? 'var(--primary)' : (d.position <= 6 ? 'var(--accent)' : (d.position <= leaguesData[game.leagueLevel].table.length - 4 ? '#aaa' : 'var(--danger)'));

            html += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1; min-width:${barWidth}px;">
                    <div style="display:flex; align-items:flex-end; height:${chartHeight - 16}px; width:100%; justify-content:center;">
                        <div style="width:${Math.max(2, barWidth/2)}px; height:${posHeight}px; background:${color}; border-radius:2px 2px 0 0; opacity:0.8;" title="Platz ${d.position}"></div>
                    </div>
                    <span style="font-size:8px; color:#666; white-space:nowrap;">M${d.matchday}</span>
                </div>
            `;
        });

        html += `
            </div>
            <div style="display:flex; justify-content:space-between; font-size:8px; color:#94a3b8; margin-top:4px;">
                <span>Aufstiegszone</span>
                <span>Abstiegszone</span>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderLeaguePointsTrend() {
        let container = document.getElementById('league-points-chart');
        if (!container || leagueProgressHistory.matchdayData.length < 2) {
            if (container) container.innerHTML = '';
            return;
        }

        let data = leagueProgressHistory.matchdayData.slice(-12);
        let maxPoints = Math.max(...data.map(d => d.points)) || 90;
        let chartHeight = 80;
        let barWidth = Math.max(20, Math.floor((container.offsetWidth - 40) / data.length));

        let html = `
            <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">Punkte-Trend (letzte 12 Monate)</div>
            <div style="display:flex; align-items:flex-end; justify-content:space-around; height:${chartHeight}px; background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; gap:2px; border:1px solid rgba(255,255,255,0.1);">
        `;

        data.forEach((d, i) => {
            let pointsHeight = (d.points / maxPoints) * (chartHeight - 16);
            let trend = i > 0 && data[i-1] ? (d.points - data[i-1].points) : 0;
            let trendColor = trend > 0 ? 'var(--primary)' : (trend < 0 ? 'var(--danger)' : '#aaa');

            html += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1; min-width:${barWidth}px;">
                    <div style="display:flex; align-items:flex-end; height:${chartHeight - 16}px; width:100%; justify-content:center;">
                        <div style="width:${Math.max(2, barWidth/2)}px; height:${pointsHeight}px; background:var(--gold); border-radius:2px 2px 0 0; opacity:0.8;" title="${d.points} Punkte"></div>
                    </div>
                    <span style="font-size:7px; color:${trendColor}; font-weight:700;">${trend > 0 ? '+' : ''}${trend}</span>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    }

    function renderCurrentStandings() {
        let container = document.getElementById('league-standings-box');
        if (!container) return;

        let currentLeague = leaguesData[game.leagueLevel];
        if (!currentLeague || !currentLeague.table) {
            container.innerHTML = '<div style="font-size:9px; color:#94a3b8;">Ligadaten nicht verfügbar</div>';
            return;
        }

        let ourId = game.clubId;
        let our = currentLeague.table.find(t => t.id === ourId);
        let ourPos = currentLeague.table.indexOf(our) + 1;

        // Show +/- 2 positions around us
        let startPos = Math.max(0, ourPos - 3);
        let endPos = Math.min(currentLeague.table.length, ourPos + 3);
        let relevantTeams = currentLeague.table.slice(startPos, endPos);

        let html = `
            <div style="font-size:9px; color:#94a3b8; margin-bottom:6px;">
                Du: <strong style="color:var(--primary);">${ourPos}. Platz</strong> ·
                ${our.points} Punkte · ${our.wins}S ${our.draws}U ${our.losses}N
            </div>
            <div style="background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden;">
        `;

        relevantTeams.forEach((t, i) => {
            let pos = startPos + i + 1;
            let isOur = t.id === ourId;
            let posColor = pos <= 3 ? 'var(--primary)' : (pos > currentLeague.table.length - 4 ? 'var(--danger)' : '#aaa');
            let bgColor = isOur ? 'rgba(139,92,246,0.2)' : 'transparent';
            let formIndicators = '';

            if (t.recent) {
                formIndicators = t.recent.split('').slice(-5).map(r =>
                    `<span style="display:inline-block; width:6px; height:6px; border-radius:2px; background:${r === 'W' ? 'var(--primary)' : (r === 'D' ? '#aaa' : 'var(--danger)')}; margin:0 1px;"></span>`
                ).join('');
            }

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); background:${bgColor}; ${isOur ? 'border-left:3px solid var(--primary);' : ''}">
                    <div style="display:flex; align-items:center; gap:6px; flex:1;">
                        <strong style="color:${posColor}; width:20px; text-align:right;">${pos}.</strong>
                        <span style="font-size:9px; flex:1;">${t.name}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <div style="text-align:center; font-size:8px;">
                            <div style="color:var(--gold); font-weight:700;">${t.points}</div>
                            <div style="color:#666; font-size:7px;">${t.played}Sp</div>
                        </div>
                        <div style="font-size:8px; color:#aaa;">${t.wins}-${t.draws}-${t.losses}</div>
                        <div style="display:flex; gap:1px;">${formIndicators}</div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    }
