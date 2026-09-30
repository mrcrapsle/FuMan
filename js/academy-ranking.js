
    // ==========================================
    // AKADEMIE-RANGLISTE
    // ==========================================
    // Wettbewerb mit anderen Academies in der Liga - wer entwickelt
    // die besten Spieler? Rankings, Boni für Platzierungen.
    /* eslint-disable no-undef */

    // Konkurrenz-Akademien sind die Erstligisten aus dem Spiel selbst (keine realen Vereine).
    function academyRivalNames() {
        return (leaguesData[0] || []).filter(t => t.name !== game.clubName)
            .sort((x, y) => y.strength - x.strength).slice(0, 5).map(t => t.name + ' U23');
    }
    function initializeAcademyLeague() {
        const namen = academyRivalNames();
        if (!game.academyLeague) {
            game.academyLeague = {
                myRank: 6,
                myPoints: 0,
                season: game.season,
                academies: [850, 820, 750, 700, 680].map((points, i) => ({ name: namen[i] || `Akademie ${i + 1}`, points, graduates: 12 - i, avgStrength: 72 - i }))
            };
        }
        // Ältere Spielstände enthielten reale Vereinsnamen - durch Spielvereine ersetzen.
        const bekannt = new Set((leaguesData || []).flat().map(t => t.name + ' U23'));
        game.academyLeague.academies.forEach((a, i) => { if (!bekannt.has(a.name) && namen[i]) a.name = namen[i]; });
    }
    function updateAcademyPoints(reason = 'match', pointsGained = 0) {
        initializeAcademyLeague();

        // Punkte für verschiedene Akademie-Events
        switch(reason) {
            case 'youth-tournament-win':
                pointsGained = 100;
                break;
            case 'youth-graduation':
                pointsGained = 50;
                break;
            case 'player-debut':
                pointsGained = 25;
                break;
            case 'talent-development':
                pointsGained = Math.floor(Math.random() * 20) + 10;
                break;
        }

        game.academyLeague.myPoints += pointsGained;

        // Ranking neu berechnen
        recalculateAcademyRanking();
    }

    function recalculateAcademyRanking() {
        initializeAcademyLeague();

        // Andere Academies erhalten auch Punkte (simuliert)
        game.academyLeague.academies.forEach(academy => {
            academy.points += Math.floor(Math.random() * 30);
        });

        let allAcademies = [
            { name: game.clubName + ' U23', points: game.academyLeague.myPoints },
            ...game.academyLeague.academies
        ];

        allAcademies.sort((a, b) => b.points - a.points);
        game.academyLeague.myRank = allAcademies.findIndex(a => a.name === game.clubName + ' U23') + 1;
    }

    function getAcademyRankingBonus() {
        initializeAcademyLeague();

        // Bonus pro Position: Top 3 erhalten Boni
        if (game.academyLeague.myRank === 1) return { money: 50000, reputation: 10 };
        if (game.academyLeague.myRank === 2) return { money: 30000, reputation: 6 };
        if (game.academyLeague.myRank === 3) return { money: 15000, reputation: 3 };
        return { money: 0, reputation: 0 };
    }

    function renderAcademyRankingPanel() {
        const box = document.getElementById('academy-ranking-panel');
        if (!box) return;

        initializeAcademyLeague();
        const myRank = game.academyLeague.myRank;
        const myPoints = game.academyLeague.myPoints;

        let rankColor = myRank === 1 ? 'var(--primary)' : myRank <= 3 ? 'var(--accent)' : 'var(--text-muted)';
        let rankEmoji = myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '⭐';

        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">🎓 AKADEMIE-RANGLISTE</div>`;

        html += `<div style="background:rgba(62,224,138,0.1); padding:8px; border-radius:4px; margin-bottom:8px; border-left:4px solid ${rankColor}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div>
                    <div style="font-size:9px; font-weight:bold;">${rankEmoji} Deine Akademie</div>
                    <div style="font-size:8px; color:var(--text-muted);">Platz ${myRank} · ${myPoints} Punkte</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px; color:${rankColor}; font-weight:bold;">PLATZ ${myRank}</div>
                </div>
            </div>
        </div>`;

        // Top 5 Academies
        let allAcademies = [
            { name: game.clubName + ' U23', points: myPoints },
            ...game.academyLeague.academies.slice(0, 4)
        ];
        allAcademies.sort((a, b) => b.points - a.points);

        html += `<div style="font-size:9px; font-weight:bold; margin-bottom:4px;">🏆 TOP ACADEMIES</div>`;
        allAcademies.forEach((academy, idx) => {
            let isOwnAcademy = academy.name === game.clubName + ' U23';
            let color = isOwnAcademy ? 'var(--primary)' : 'var(--text-muted)';
            let emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;

            html += `<div style="background:rgba(100,100,100,0.1); padding:4px; border-radius:3px; margin-bottom:3px; font-size:8px; display:flex; justify-content:space-between; align-items:center; ${isOwnAcademy ? 'border-left:2px solid var(--primary);' : ''}">
                <div style="display:flex; align-items:center; gap:4px;">
                    <span style="color:${color}; font-weight:bold; min-width:18px;">${emoji}</span>
                    <span style="color:${color};">${academy.name}</span>
                </div>
                <span style="color:var(--accent); font-weight:bold;">${academy.points} Pkt</span>
            </div>`;
        });

        // Bonusinfo
        const bonus = getAcademyRankingBonus();
        if (bonus.money > 0 || bonus.reputation > 0) {
            html += `<div style="background:rgba(255,194,60,0.1); padding:6px; border-radius:4px; margin-top:8px; font-size:9px; border-left:3px solid var(--accent)">
                <strong>🎁 Saisonende-Bonus (Top 3):</strong><br>
                ${bonus.money > 0 ? `+ ${formatVal(bonus.money)}` : ''} ${bonus.reputation > 0 ? `+ ${bonus.reputation} Reputation` : ''}
            </div>`;
        }

        box.innerHTML = html;
    }

