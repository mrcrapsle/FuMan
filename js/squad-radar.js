
    // ==========================================
    // SQUAD-STRENGTH-RADAR
    // ==========================================
    // Visuelle Darstellung der Kader-Stärke über
    // ein Radar-Chart mit allen relevanten Attributen

    function calculateSquadStats() {
        if (squad.length === 0) return null;

        // Durchschnitte berechnen
        let avgStrength = Math.round(squad.reduce((s, p) => s + p.strength, 0) / squad.length);
        let avgPace = Math.round(squad.reduce((s, p) => s + (p.pace || 50), 0) / squad.length);
        let avgShooting = Math.round(squad.reduce((s, p) => s + (p.shooting || 50), 0) / squad.length);
        let avgPassing = Math.round(squad.reduce((s, p) => s + (p.passing || 50), 0) / squad.length);
        let avgDefense = Math.round(squad.reduce((s, p) => s + (p.defense || 50), 0) / squad.length);
        let avgPhysique = Math.round(squad.reduce((s, p) => s + (p.physique || 50), 0) / squad.length);

        // Verletzungsquote
        let injuredCount = squad.filter(p => (p.injured || 0) > 0).length;
        let healthPercent = Math.round(100 * (1 - injuredCount / squad.length));

        // Moral durchschnitt
        let avgMorale = Math.round(squad.reduce((s, p) => s + p.morale, 0) / squad.length);

        // Fitness durchschnitt
        let avgFitness = Math.round(squad.reduce((s, p) => s + p.fitness, 0) / squad.length);

        return {
            strength: avgStrength,
            pace: avgPace,
            shooting: avgShooting,
            passing: avgPassing,
            defense: avgDefense,
            physique: avgPhysique,
            health: healthPercent,
            morale: avgMorale,
            fitness: avgFitness
        };
    }

    function renderSquadRadar() {
        let container = document.getElementById('squad-radar-container');
        if (!container || squad.length === 0) {
            if (container) container.innerHTML = '<div style="font-size:9px; color:#94a3b8;">Kader erforderlich</div>';
            return;
        }

        let stats = calculateSquadStats();
        if (!stats) return;

        // SVG Radar Chart mit 6 Attributen
        // offsetWidth ist 0, solange der Screen versteckt ist -> sonst entstünde ein -20x-20-SVG.
        let size = container.offsetWidth > 40 ? Math.min(container.offsetWidth - 20, 200) : 200;
        let center = size / 2;
        let maxValue = 100;
        let levels = 5;
        let levelHeight = (size / 2) / levels;
        let attributes = [
            { label: 'Stärke', value: stats.strength },
            { label: 'Tempo', value: stats.pace },
            { label: 'Schuss', value: stats.shooting },
            { label: 'Pass', value: stats.passing },
            { label: 'Abwehr', value: stats.defense },
            { label: 'Kraft', value: stats.physique }
        ];

        let angleSlice = (Math.PI * 2) / attributes.length;

        // Grid-Linien erzeugen
        let gridLines = '';
        for (let i = 0; i <= levels; i++) {
            let radius = (size / 2) * (i / levels);
            let points = attributes.map((attr, idx) => {
                let angle = angleSlice * idx - Math.PI / 2;
                let x = center + radius * Math.cos(angle);
                let y = center + radius * Math.sin(angle);
                return `${x},${y}`;
            }).join(' ');
            gridLines += `<polygon points="${points}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
        }

        // Achsen-Linien
        let axes = attributes.map((attr, idx) => {
            let angle = angleSlice * idx - Math.PI / 2;
            let x2 = center + (size / 2) * Math.cos(angle);
            let y2 = center + (size / 2) * Math.sin(angle);
            return `<line x1="${center}" y1="${center}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>`;
        }).join('');

        // Daten-Polygon
        let dataPoints = attributes.map((attr, idx) => {
            let angle = angleSlice * idx - Math.PI / 2;
            let radius = (size / 2) * (attr.value / maxValue);
            let x = center + radius * Math.cos(angle);
            let y = center + radius * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');

        // Labels
        let labels = attributes.map((attr, idx) => {
            let angle = angleSlice * idx - Math.PI / 2;
            let labelRadius = (size / 2) * 1.15;
            let x = center + labelRadius * Math.cos(angle);
            let y = center + labelRadius * Math.sin(angle);
            return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#aaa" font-size="10" font-weight="600">${attr.label}</text>`;
        }).join('');

        // Wert-Labels auf den Datenpunkten
        let valueLabels = attributes.map((attr, idx) => {
            let angle = angleSlice * idx - Math.PI / 2;
            let valueRadius = (size / 2) * (attr.value / maxValue) * 0.7;
            let x = center + valueRadius * Math.cos(angle);
            let y = center + valueRadius * Math.sin(angle);
            return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="var(--primary)" font-size="9" font-weight="700">${attr.value}</text>`;
        }).join('');

        let svg = `
            <svg width="${size}" height="${size}" style="display:block; margin:0 auto;">
                <defs>
                    <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:var(--primary);stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:var(--violet);stop-opacity:0.1" />
                    </linearGradient>
                </defs>
                ${gridLines}
                ${axes}
                <polygon points="${dataPoints}" fill="url(#radarGradient)" stroke="var(--primary)" stroke-width="2" opacity="0.8"/>
                ${attributes.map((attr, idx) => {
                    let angle = angleSlice * idx - Math.PI / 2;
                    let radius = (size / 2) * (attr.value / maxValue);
                    let x = center + radius * Math.cos(angle);
                    let y = center + radius * Math.sin(angle);
                    return `<circle cx="${x}" cy="${y}" r="3" fill="var(--primary)" stroke="var(--text)" stroke-width="1"/>`;
                }).join('')}
                ${labels}
                ${valueLabels}
            </svg>
        `;

        container.innerHTML = svg;
    }

    function renderSquadStrengthMetrics() {
        let container = document.getElementById('squad-strength-metrics');
        if (!container || squad.length === 0) return;

        let stats = calculateSquadStats();
        if (!stats) return;

        let metrics = [
            { label: '💪 Durchschnittliche Stärke', value: stats.strength, max: 99, color: 'var(--primary)' },
            { label: '❤️ Fitness-Level', value: stats.fitness, max: 100, color: 'var(--accent)' },
            { label: '😊 Moral', value: stats.morale, max: 100, color: 'var(--gold)' },
            { label: '🏥 Gesundheit', value: stats.health, max: 100, color: 'var(--primary)' }
        ];

        let html = '<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">';
        metrics.forEach(m => {
            let pct = (m.value / m.max * 100).toFixed(0);
            html += `
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">${m.label}</div>
                    <div style="font-size:16px; font-weight:700; color:${m.color}; margin-bottom:4px;">${m.value}</div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:${m.color}; border-radius:2px;"></div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    function renderSquadComparison() {
        let container = document.getElementById('squad-comparison-box');
        if (!container || squad.length === 0) return;

        let stats = calculateSquadStats();
        if (!stats) return;

        // Vergleich mit Liga-Durchschnitt
        let currentLeague = leaguesData[game.leagueLevel];
        if (!currentLeague) return;

        let otherTeams = currentLeague.filter(t => t.id !== game.clubId && t.stats);
        if (otherTeams.length === 0) {
            container.innerHTML = '<div style="font-size:9px; color:#94a3b8;">Vergleichsdaten nicht verfügbar</div>';
            return;
        }

        let leagueAvgStrength = Math.round(otherTeams.reduce((s, t) => s + (t.strength || 50), 0) / otherTeams.length);
        let leagueAvgDef = Math.round(otherTeams.reduce((s, t) => s + (t.avgDefense || 50), 0) / otherTeams.length);
        let leagueAvgPass = Math.round(otherTeams.reduce((s, t) => s + (t.avgPassing || 50), 0) / otherTeams.length);

        let html = `
            <div style="font-size:9px; color:#94a3b8; margin-bottom:6px;">Vergleich zum Liga-Durchschnitt</div>
            <div style="display:grid; gap:6px;">
        `;

        let comparisons = [
            { label: 'Stärke', our: stats.strength, league: leagueAvgStrength },
            { label: 'Abwehr', our: stats.defense, league: leagueAvgDef },
            { label: 'Spielaufbau', our: stats.passing, league: leagueAvgPass }
        ];

        comparisons.forEach(c => {
            let diff = c.our - c.league;
            let diffColor = diff > 0 ? 'var(--primary)' : (diff < 0 ? 'var(--danger)' : '#aaa');
            let barWidth = 100;
            let ourWidth = (c.our / Math.max(c.league, c.our) * 100);
            let leagueWidth = (c.league / Math.max(c.league, c.our) * 100);

            html += `
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px;">
                        <span>${c.label}</span>
                        <span style="color:${diffColor}; font-weight:700;">${diff > 0 ? '+' : ''}${diff}</span>
                    </div>
                    <div style="display:flex; gap:2px; height:8px;">
                        <div style="flex:${ourWidth}; background:var(--primary); border-radius:2px; opacity:0.8;" title="Dein Team: ${c.our}"></div>
                        <div style="flex:${Math.max(1, leagueWidth - ourWidth)}; background:#666; border-radius:2px;" title="Liga-Ø: ${c.league}"></div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }
