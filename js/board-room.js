// Vorstand: vier Mitglieder, die je einen echten Bereich beurteilen und damit erklären, woher
// die Vorstandszufriedenheit (game.boardSat, an ihr hängt die Entlassung) kommt. Ihre Stimmung
// wird aus dem aktuellen Spielstand berechnet, nicht gespeichert. Löst zwei Module ab, deren
// Vorstand nie angelegt wurde bzw. einen eigenen, wirkungslosen Zähler führte.

const BOARD_ROLES = [
    { key: 'praesident', title: 'Präsident', icon: '🎩' },
    { key: 'finanzen', title: 'Finanzvorstand', icon: '💶' },
    { key: 'sport', title: 'Sportvorstand', icon: '⚽' },
    { key: 'nachwuchs', title: 'Nachwuchsleiter', icon: '🎓' }
];
const BOARD_FIRST = ['Klaus', 'Petra', 'Bernd', 'Anke', 'Helmut', 'Sabine', 'Wolfgang', 'Ute', 'Dieter', 'Monika'];
const BOARD_LAST = ['Brenner', 'Hofmann', 'Kessler', 'Lang', 'Seifert', 'Albrecht', 'Vogt', 'Krämer', 'Busch', 'Wendel'];

function getBoardRoom() {
    if (!game.boardRoom) {
        const seed = (game.clubName || '').length;
        game.boardRoom = { names: BOARD_ROLES.map((_, i) => `${BOARD_FIRST[(seed + i * 3) % BOARD_FIRST.length]} ${BOARD_LAST[(seed * 2 + i * 5) % BOARD_LAST.length]}`), warned: {} };
    }
    // Alte Spielstände: Felder der abgelösten Vorstandsmodule
    ['boardMembers', 'boardDecisions', 'boardMemberSatisfaction', 'boardConflicts'].forEach(k => { delete game[k]; });
    return game.boardRoom;
}

function clampMood(x) { return Math.max(0, Math.min(100, Math.round(x))); }

// Stimmung + Begründung je Mitglied aus echten Daten.
function getBoardMemberViews() {
    const exp = game.seasonExpectation || {};
    const rank = typeof getOwnLeagueRank === 'function' ? getOwnLeagueRank() : null;
    const views = {};
    views.praesident = { mood: game.boardSat, reason: game.boardSat >= 60 ? 'Zufrieden mit der Gesamtentwicklung.' : game.boardSat >= 35 ? 'Erwartet eine Steigerung.' : 'Stellt deine Arbeit offen infrage.' };

    const delta = exp.startMoney !== undefined ? game.money - exp.startMoney : 0;
    const schulden = game.loanDebt || 0;
    views.finanzen = {
        mood: clampMood(55 + Math.max(-30, Math.min(30, delta / Math.max(20000, Math.abs(exp.startMoney || 100000)) * 60)) - Math.min(25, schulden / 20000)),
        reason: `${delta >= 0 ? 'Plus' : 'Minus'} von ${formatVal(Math.abs(Math.round(delta)))} seit Saisonbeginn${schulden > 0 ? `, Kredite ${formatVal(schulden)}` : ''}.`
    };

    if (rank && exp.expectedRank && game.matchday > 3) {
        const diff = exp.expectedRank - rank;
        views.sport = { mood: clampMood(55 + diff * 6), reason: `Platz ${rank}, erwartet war Platz ${exp.expectedRank}.` };
    } else {
        views.sport = { mood: 55, reason: 'Wartet die ersten Spieltage ab.' };
    }

    const talente = (typeof youthTalents !== 'undefined' ? youthTalents : []).length;
    const akademieRang = game.academyLeague ? game.academyLeague.myRank : null;
    views.nachwuchs = {
        mood: clampMood(35 + talente * 5 + (akademieRang ? (6 - akademieRang) * 5 : 0)),
        reason: `${talente} Talent(e) in der Jugend${akademieRang ? `, Akademie-Rang ${akademieRang}` : ''}.`
    };
    return views;
}

const BOARD_ADVICE = {
    finanzen: 'fordert einen Sparkurs - Gehälter und laufende Kosten prüfen.',
    sport: 'verlangt bessere Ergebnisse - Aufstellung und Training überdenken.',
    nachwuchs: 'wünscht mehr Talente in der Jugendabteilung.',
    praesident: 'erwägt Konsequenzen, wenn sich nichts ändert.'
};

// Monatlich: ein Mitglied, das stark unzufrieden ist, meldet sich (einmal pro Saison und Rolle).
function tickBoardRoom() {
    const room = getBoardRoom();
    const views = getBoardMemberViews();
    BOARD_ROLES.forEach((role, i) => {
        const key = `${game.season}-${role.key}`;
        if (views[role.key].mood < 30 && !room.warned[key]) {
            room.warned[key] = true;
            addInboxMessage('vertrag', `${role.icon} ${role.title} ${room.names[i]} ist unzufrieden`,
                `${views[role.key].reason} ${room.names[i]} ${BOARD_ADVICE[role.key]}`, 'screen-manager-tree');
        }
    });
    Object.keys(room.warned).forEach(k => { if (!k.startsWith(game.season + '-')) delete room.warned[k]; });
}

function renderBoardRoomPanel() {
    const box = document.getElementById('board-room-box');
    if (!box) return;
    const room = getBoardRoom();
    const views = getBoardMemberViews();
    const farbe = m => m >= 60 ? 'var(--primary)' : m >= 35 ? 'var(--accent)' : 'var(--danger)';
    box.innerHTML = `<div style="font-size:9px;">
        <div style="margin-bottom:6px;">Vorstandszufriedenheit: <strong style="color:${farbe(game.boardSat)};">${Math.round(game.boardSat)}%</strong>
            <span style="color:var(--text-muted);">- bleibt sie lange unter 25%, droht ab der 2. Saison die Entlassung.</span></div>
        ${BOARD_ROLES.map((role, i) => {
            const v = views[role.key];
            return `<div style="display:flex; justify-content:space-between; gap:6px; padding:3px 0; border-top:1px solid rgba(255,255,255,0.06);">
                <span>${role.icon} <strong>${role.title}</strong> ${room.names[i]}<br><span style="color:var(--text-muted);">${v.reason}</span></span>
                <strong style="color:${farbe(v.mood)}; white-space:nowrap;">${v.mood}%</strong></div>`;
        }).join('')}
    </div>`;
}
