// ==========================================
// VEREINSWECHSEL & KLUB-MANAGEMENT
// ==========================================
/* eslint-disable no-undef */

function getAvailableClubbsForSwitch() {
    if (!leaguesData || leaguesData.length === 0) return [];

    const available = [];
    const currentClubId = getOurLeagueTeam()?.id;

    for (let level = 0; level < leaguesData.length; level++) {
        const league = leaguesData[level];
        if (!league || !Array.isArray(league)) continue;

        league.forEach(team => {
            if (team.name !== game.clubName && team.isAI) {
                available.push({
                    id: team.id,
                    name: team.name,
                    league: level,
                    leagueName: ['1. Liga', '2. Liga', '3. Liga', '4. Liga', '5. Liga', '6. Liga'][level] || `Liga ${level + 1}`,
                    position: league.indexOf(team) + 1,
                    strength: team.strength || 50,
                    wealth: team.wealth || 100000,
                    fans: team.fans || 50
                });
            }
        });
    }

    return available.sort((a, b) => a.league - b.league);
}

function calcSwitchCapital(targetLeague) {
    const baseCapital = 150000;
    const leagueMultipliers = [2.5, 2.0, 1.5, 1.2, 1.0, 0.8];
    const multiplier = leagueMultipliers[targetLeague] || 1.0;

    return Math.round(baseCapital * multiplier);
}

function switchToNewClub(clubId) {
    if (!clubId) return { success: false, message: 'Verein nicht gefunden' };

    const availableClubs = getAvailableClubbsForSwitch();
    const targetClub = availableClubs.find(c => c.id === clubId);

    if (!targetClub) {
        return { success: false, message: 'Dieser Verein ist nicht verfügbar' };
    }

    // Speichere alten Verein als KI-Verein
    const oldLeague = game.leagueLevel;
    const oldClubName = game.clubName;

    // Finde den alten Verein in der Liga und markiere ihn als KI
    const ourOldTeam = getOurLeagueTeam();
    if (ourOldTeam) {
        ourOldTeam.isAI = true;
        ourOldTeam.isFormerPlayerClub = true;
        ourOldTeam.strength = calcTeamStrength();
        ourOldTeam.wealth = game.money;
    }

    // Wechsle zu neuem Verein
    game.clubName = targetClub.name;
    game.leagueLevel = targetClub.league;
    game.season = 1;
    game.matchday = 1;
    game.money = calcSwitchCapital(targetClub.league);
    game.wageBudget = Math.round(game.money * 0.15);
    game.transferBudget = Math.round(game.money * 0.2);
    game.fans = Math.max(50, targetClub.fans || 50);
    game.boardSat = 80;

    // Generiere neuen Kader für die neue Liga
    squad = generateSquadForLeague(targetClub.league);
    lineup = squad.slice(0, 11).map(p => p.id);

    // Update Liga-Tabelle
    const newLeague = leaguesData[targetClub.league];
    if (newLeague) {
        const oldPosition = newLeague.indexOf(targetClub);
        if (oldPosition >= 0) {
            newLeague.splice(oldPosition, 1);
        }
        newLeague.push({
            id: generateUniqueTeamId(),
            name: game.clubName,
            strength: calcTeamStrength(),
            wealth: game.money,
            fans: game.fans,
            isAI: false,
            points: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0
        });
    }

    // Speichere in Progression-History
    if (!game.clubSwitchHistory) game.clubSwitchHistory = [];
    game.clubSwitchHistory.push({
        fromClub: oldClubName,
        fromLeague: oldLeague,
        toClub: targetClub.name,
        toLeague: targetClub.league,
        matchday: game.matchday,
        season: game.season,
        finalLeague: oldLeague
    });

    // Reset spezifische Systeme für neuen Verein
    game.seasonPointsHistory = [];
    game.trophies = [];
    game.permanentRivalName = null;
    game.recordAttendance = 0;
    game.secondTeam.isActive = false;

    return {
        success: true,
        message: `✓ Zu ${targetClub.name} (${targetClub.leagueName}) gewechselt!`,
        newCapital: game.money,
        newLeague: targetClub.leagueName,
        newSquadSize: squad.length
    };
}

function generateSquadForLeague(leagueLevel) {
    const strength = [85, 75, 65, 55, 45, 35][leagueLevel] || 50;
    const squadSize = 18;
    const positions = ['TW', 'AB', 'AB', 'MF', 'MF', 'ST'];

    const newSquad = [];
    for (let i = 0; i < squadSize; i++) {
        const position = positions[i % positions.length];
        const variance = Math.random() * 10 - 5;

        newSquad.push({
            id: 'p_' + Math.random().toString(36).substr(2, 9),
            name: getRandomName ? getRandomName() : 'Spieler ' + (i + 1),
            position: position,
            pos: position,
            age: 20 + Math.floor(Math.random() * 15),
            strength: Math.max(30, Math.min(99, Math.round(strength + variance))),
            rating: Math.max(30, Math.min(99, Math.round(strength + variance))),
            pace: Math.max(30, Math.min(99, Math.round(50 + Math.random() * 30))),
            shooting: Math.max(30, Math.min(99, Math.round(50 + Math.random() * 30))),
            passing: Math.max(30, Math.min(99, Math.round(50 + Math.random() * 30))),
            defense: Math.max(30, Math.min(99, Math.round(50 + Math.random() * 30))),
            KOP: Math.max(30, Math.min(99, Math.round(50 + Math.random() * 30))),
            fitness: 100,
            morale: 70 + Math.floor(Math.random() * 20),
            mood: 70 + Math.floor(Math.random() * 20),
            contracts: 3,
            wage: Math.round(3000 + Math.random() * 4000),
            value: Math.round(30000 + Math.random() * 150000),
            marketValue: Math.round(30000 + Math.random() * 150000),
            potential: Math.max(30, Math.min(99, Math.round(strength + variance + (25 - Math.random() * 10)))),
            injured: 0,
            suspended: 0,
            injury: null,
            isAcademy: false,
            isLoanedIn: false
        });
    }

    return newSquad;
}

function generateUniqueTeamId() {
    return 'team_' + Math.random().toString(36).substr(2, 9);
}

function renderClubSwitchPanel() {
    const box = document.getElementById('club-switch-panel');
    if (!box) return;

    const available = getAvailableClubbsForSwitch();

    let html = '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:10px; font-weight:bold; margin-bottom:8px; color:var(--text-muted);">📋 Vereinswechsel verfügbar</div>';

    if (available.length === 0) {
        html += '<div style="color:var(--text-muted); font-size:9px;">Keine Vereine verfügbar</div>';
    } else {
        html += `<div style="font-size:9px; margin-bottom:12px; color:var(--accent);">Insgesamt ${available.length} Vereine verfügbar</div>`;

        // Gruppiere nach Liga
        const byLeague = {};
        available.forEach(club => {
            if (!byLeague[club.league]) byLeague[club.league] = [];
            byLeague[club.league].push(club);
        });

        Object.keys(byLeague).sort().forEach(league => {
            const leagueName = ['1. Liga', '2. Liga', '3. Liga', '4. Liga', '5. Liga', '6. Liga'][league] || `Liga ${parseInt(league) + 1}`;
            html += `<div style="margin-bottom:12px;">
                <div style="font-size:9px; font-weight:bold; color:var(--primary); margin-bottom:6px;">${leagueName} (${byLeague[league].length} Teams)</div>`;

            byLeague[league].slice(0, 5).forEach(club => {
                const capital = calcSwitchCapital(club.league);
                html += `
                    <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:9px; font-weight:bold;">${club.name}</div>
                            <div style="font-size:8px; color:var(--text-muted);">Position: ${club.position}. · Stärke: ${club.strength} · Fans: ${club.fans}</div>
                            <div style="font-size:8px; color:var(--accent); margin-top:2px;">Startkapital: ${formatVal(capital)}</div>
                        </div>
                        <button onclick="showClubSwitchConfirm('${club.id}', '${club.name}')" class="btn-primary" style="padding:4px 8px; font-size:8px;">Wechseln</button>
                    </div>
                `;
            });

            html += '</div>';
        });
    }

    html += '</div>';
    box.innerHTML = html;
}

function showClubSwitchConfirm(clubId, clubName) {
    const confirmed = confirm(`Möchtest du wirklich zu ${clubName} wechseln? Dein aktueller Verein wird zur KI und der Kader wird neu generiert.`);
    if (!confirmed) return;

    const result = switchToNewClub(clubId);
    alert(result.message);

    if (result.success) {
        game.viewingMatchday = game.matchday;
        renderSquadView();
        renderDashboard();
        updateUI();
    }
}

function renderClubProgression() {
    if (!game.clubSwitchHistory || game.clubSwitchHistory.length === 0) {
        return '<div style="color:var(--text-muted); font-size:9px;">Noch kein Vereinswechsel durchgeführt</div>';
    }

    let html = '<div style="font-size:10px; font-weight:bold; margin-bottom:8px;">🏆 Karriere-Stationen:</div>';
    game.clubSwitchHistory.forEach((entry, idx) => {
        html += `
            <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; font-size:9px;">
                <div><strong>${idx + 1}. ${entry.fromClub}</strong></div>
                <div style="color:var(--text-muted); font-size:8px;">Liga: ${['1. Liga', '2. Liga', '3. Liga', '4. Liga', '5. Liga', '6. Liga'][entry.fromLeague] || `Liga ${entry.fromLeague + 1}`}</div>
                <div style="color:var(--accent); font-size:8px; margin-top:2px;">→ Wechsel zu ${entry.toClub}</div>
            </div>
        `;
    });

    // Aktueller Verein
    html += `
        <div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; margin-top:8px; border-left:3px solid var(--primary);">
            <div style="font-size:9px;"><strong>✓ Aktuell: ${game.clubName}</strong></div>
            <div style="color:var(--text-muted); font-size:8px;">Saison ${game.season}</div>
        </div>
    `;

    return html;
}
