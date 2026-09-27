
    // ==========================================
    // RIVALITÄTEN ZWISCHEN CLUBS
    // ==========================================
    // Lokale und nationale Rivalitäten sorgen für emotionale Derbys mit
    // höheren Zuschauereinnahmen, intensiveren Spielen und extra Boni.
    /* eslint-disable no-undef */

    function getLocalRivals() {
        // Je nach Liga: verschiedene geografische/kulturelle Rivalen pro Club
        // (simplifiziert: immer 2-3 Rivalen pro Team in der gleichen Liga)
        if (!game.localRivals) game.localRivals = [];
        return game.localRivals;
    }

    function addLocalRival(rivalName, importance = 'medium') {
        if (!game.localRivals) game.localRivals = [];
        let existing = game.localRivals.find(r => r.name === rivalName);
        if (existing) return { success: false, message: `${rivalName} ist bereits ein Rivale` };

        game.localRivals.push({
            name: rivalName,
            importance: importance, // 'low', 'medium', 'high'
            headToHead: { wins: 0, draws: 0, losses: 0 },
            lastMeetMatchday: 0,
            nextMeetMatchday: 0,
            rivalryPower: 1.0 // wächst mit Konfrontationen
        });
        showToast(`🔥 Neue Rivalität: ${rivalName}!`, 'info');
        return { success: true };
    }

    function removeLocalRival(rivalName) {
        if (!game.localRivals) return { success: false };
        game.localRivals = game.localRivals.filter(r => r.name !== rivalName);
        showToast(`Rivalität zu ${rivalName} beendet`, 'info');
        return { success: true };
    }

    function getRivalryBonus(opponentName) {
        let rival = (game.localRivals || []).find(r => r.name === opponentName);
        if (!rival) return 0;

        // Je größer die Rivalität (mehr Meetings, höhere Einsätze), desto größer der Bonus
        let bonus = 0;
        if (rival.importance === 'high') bonus += 0.15;
        else if (rival.importance === 'medium') bonus += 0.10;
        else bonus += 0.05;

        // Die Rivalitätsstärke steigt mit erfolgreich bestandenen Derbys
        bonus *= rival.rivalryPower;
        return bonus;
    }

    function getDerbyAttendanceMultiplier(opponentName) {
        let rival = (game.localRivals || []).find(r => r.name === opponentName);
        if (!rival) return 1.0;

        // Derby = höhere Zuschauer
        let mult = 1.0;
        if (rival.importance === 'high') mult = 2.0 + (rival.rivalryPower - 1) * 0.5;
        else if (rival.importance === 'medium') mult = 1.6 + (rival.rivalryPower - 1) * 0.3;
        else mult = 1.3;

        return Math.min(mult, 3.0); // gedeckelt bei 3x
    }

    function processDerbyMatch(opponentName, won, goals, conceded) {
        let rival = (game.localRivals || []).find(r => r.name === opponentName);
        if (!rival) return;

        // Kopf-an-Kopf-Bilanz aktualisieren
        if (won) rival.headToHead.wins++;
        else if (goals === conceded) rival.headToHead.draws++;
        else rival.headToHead.losses++;

        // Derby-Macht: steigt mit intensiven Spielen (viele Tore, knapp, etc.)
        let intensity = Math.abs(goals - conceded) <= 1 ? 0.15 : 0.08;
        intensity += (goals + conceded > 4 ? 0.10 : 0);
        rival.rivalryPower += intensity;
        rival.rivalryPower = Math.min(rival.rivalryPower, 2.0);

        rival.lastMeetMatchday = game.matchday;
        addInboxMessage('rivalry', `🔥 Derby gegen ${opponentName}!`,
            `Bilanz gegen ${opponentName}: ${rival.headToHead.wins}W/${rival.headToHead.draws}D/${rival.headToHead.losses}L · Rivalitätsstärke: ${rival.rivalryPower.toFixed(2)}x`,
            'screen-squad');
    }

    function getRivalryTable() {
        if (!game.localRivals) return [];
        return [...game.localRivals].sort((a, b) => {
            let aPower = a.rivalryPower * (a.importance === 'high' ? 3 : a.importance === 'medium' ? 2 : 1);
            let bPower = b.rivalryPower * (b.importance === 'high' ? 3 : b.importance === 'medium' ? 2 : 1);
            return bPower - aPower;
        });
    }

    function renderRivalriesPanel() {
        const box = document.getElementById('rivalries-panel');
        if (!box) return;

        const rivals = getRivalryTable();
        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">🔥 RIVALITÄTEN</div>`;

        if (rivals.length === 0) {
            html += '<div style="font-size:9px; color:var(--text-muted); margin-bottom:8px;">Noch keine Rivalitäten etabliert</div>';
        } else {
            rivals.forEach(r => {
                let recordColor = r.headToHead.wins > r.headToHead.losses ? 'var(--primary)' :
                                  r.headToHead.losses > r.headToHead.wins ? 'var(--danger)' : 'var(--accent)';
                let powerBar = `<div style="width:100%; background:rgba(0,0,0,0.3); height:4px; border-radius:2px; overflow:hidden; margin-top:2px;">
                    <div style="width:${(r.rivalryPower - 1) * 100}%; height:100%; background:var(--danger); transition:width 0.3s;"></div>
                </div>`;

                html += `<div style="background:rgba(255,84,104,0.1); padding:6px; border-radius:4px; margin-bottom:6px; font-size:9px; border-left:3px solid ${recordColor}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <strong>${r.name}</strong>
                        <span style="color:var(--accent); font-size:8px;">${r.importance.toUpperCase()}</span>
                    </div>
                    <div style="font-size:8px; color:${recordColor}; font-weight:bold;">
                        Bilanz: ${r.headToHead.wins}W - ${r.headToHead.draws}D - ${r.headToHead.losses}L
                    </div>
                    <div style="font-size:8px; color:var(--text-muted);">Rivalitätsstärke: ${r.rivalryPower.toFixed(2)}x</div>
                    ${powerBar}
                </div>`;
            });
        }

        box.innerHTML = html;
    }

