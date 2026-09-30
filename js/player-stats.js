/* eslint-disable no-undef */
// Spielerstatistik & Noten: Tore UND Vorlagen in Live- und simulierten Spielen, eine
// Kicker-Note (1,0 bis 6,0) für jeden eingesetzten Spieler nach jedem eigenen Ligaspiel,
// "Spieler des Spiels" und Nominierungen für die Elf des Spieltags (Note 1,5 oder besser).
// Saisonwerte stehen in p.statsSeason, Karriere-Vorlagen in p.assists (zählt auch für den
// Legenden-Status, siehe checkForLegendStatus()).

let matchEvents = { tore: {}, vorlagen: {} };

function resetMatchEvents() { matchEvents = { tore: {}, vorlagen: {} }; }

function pickAssistant(players) {
    const gewichte = { MIT: 4, ST: 2, ABW: 1.5, TW: 0.1 };
    const summe = players.reduce((a, p) => a + (gewichte[p.pos] || 1), 0);
    let wurf = Math.random() * summe;
    for (const p of players) { wurf -= gewichte[p.pos] || 1; if (wurf <= 0) return p; }
    return players[players.length - 1] || null;
}

// Eigenes Tor: Torschütze nach Position gewichtet, in drei von vier Fällen mit Vorlage.
function creditOwnGoal(players) {
    const scorer = pickWeightedScorer(players);
    if (!scorer) return { scorer: null, assist: null };
    scorer.goalsSeason = (scorer.goalsSeason || 0) + 1;
    scorer.goalsCareer = (scorer.goalsCareer || 0) + 1;
    matchEvents.tore[scorer.id] = (matchEvents.tore[scorer.id] || 0) + 1;
    let assist = null;
    const mitspieler = players.filter(p => p.id !== scorer.id);
    if (mitspieler.length && Math.random() < 0.75) {
        assist = pickAssistant(mitspieler);
        if (assist) {
            assist.assists = (assist.assists || 0) + 1;
            matchEvents.vorlagen[assist.id] = (matchEvents.vorlagen[assist.id] || 0) + 1;
        }
    }
    return { scorer, assist };
}

function formatGrade(n) { return n.toFixed(1).replace('.', ','); }

// Note für einen Spieler: Ergebnis, Tagesform, eigene Tore/Vorlagen, Zu-Null für die
// Defensive, etwas Zufall. Auf halbe Noten gerundet wie im Kicker.
function computePlayerGrade(p, ourGoals, oppGoals) {
    let note = 3.5 - Math.max(-0.75, Math.min(0.75, (ourGoals - oppGoals) * 0.3));
    note -= ((p.dailyForm ?? 50) - 50) / 100;
    note -= (matchEvents.tore[p.id] || 0) * 0.75;
    note -= (matchEvents.vorlagen[p.id] || 0) * 0.4;
    if (p.pos === 'TW' || p.pos === 'ABW') {
        if (oppGoals === 0) note -= 0.5;
        else if (oppGoals >= 3) note += 0.4;
    }
    note += Math.random() - 0.5;
    return Math.max(1, Math.min(6, Math.round(note * 2) / 2));
}

// Aus processPostMatchRoutine() nach jedem eigenen Ligaspiel (live und simuliert).
function gradeOwnMatch(ourGoals, oppGoals) {
    const starter = squad.filter(p => lineup.includes(p.id));
    if (!starter.length) { resetMatchEvents(); return null; }
    let bester = null;
    starter.forEach(p => {
        const note = computePlayerGrade(p, ourGoals, oppGoals);
        const st = p.statsSeason || (p.statsSeason = { spiele: 0, tore: 0, vorlagen: 0, notenSumme: 0, elf: 0 });
        st.spiele++;
        st.tore += matchEvents.tore[p.id] || 0;
        st.vorlagen += matchEvents.vorlagen[p.id] || 0;
        st.notenSumme += note;
        if (note <= 1.5) st.elf++;
        p.lastGrade = note;
        if (!bester || note < bester.note) bester = { p, note };
    });
    const elf = starter.filter(p => p.lastGrade <= 1.5);
    if (elf.length) {
        elf.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 3); });
        addInboxMessage('vertrag', `⭐ Elf des Spieltags: ${elf.map(p => p.name).join(', ')}`,
            `Die Fachpresse nominiert ${elf.map(p => `${p.name} (Note ${formatGrade(p.lastGrade)})`).join(', ')} für die Elf des ${game.matchday}. Spieltags - Moralschub!`, 'screen-squad');
    }
    game.lastMatchBestPlayer = bester ? { name: bester.p.name, note: bester.note, matchday: game.matchday, season: game.season } : null;
    resetMatchEvents();
    return bester;
}

// Saisonende: Saisonwerte in die Spieler-Historie, dann zurücksetzen.
function resetPlayerSeasonStats(p) {
    if (p.statsSeason && p.strengthHistory && p.strengthHistory.length) {
        const letzter = p.strengthHistory[p.strengthHistory.length - 1];
        letzter.assists = p.statsSeason.vorlagen;
        letzter.grade = p.statsSeason.spiele ? +(p.statsSeason.notenSumme / p.statsSeason.spiele).toFixed(2) : null;
    }
    p.statsSeason = null;
}

function renderPlayerSeasonStats() {
    const box = document.getElementById('player-season-stats-box');
    if (!box) return;
    const rows = squad.filter(p => p.statsSeason && p.statsSeason.spiele > 0)
        .map(p => ({ p, st: p.statsSeason, schnitt: p.statsSeason.notenSumme / p.statsSeason.spiele }))
        .sort((a, b) => a.schnitt - b.schnitt);
    const best = game.lastMatchBestPlayer && game.lastMatchBestPlayer.season === game.season
        ? `<div style="font-size:10px; margin-bottom:6px;">🏅 Spieler des letzten Spiels: <strong>${game.lastMatchBestPlayer.name}</strong> (Note ${formatGrade(game.lastMatchBestPlayer.note)}, ${game.lastMatchBestPlayer.matchday}. Spieltag)</div>` : '';
    if (!rows.length) { box.innerHTML = best + '<div style="font-size:10px; color:var(--text-muted);">Noch keine Ligaspiele in dieser Saison.</div>'; return; }
    const farbe = n => n <= 2.5 ? 'var(--primary)' : (n <= 3.5 ? 'var(--gold, #FFC107)' : 'var(--danger)');
    box.innerHTML = best + `<table style="width:100%; font-size:10px; border-collapse:collapse;">
        <tr style="color:var(--text-muted); text-align:left;"><th>Spieler</th><th>Sp.</th><th>Tore</th><th>Vorl.</th><th>Ø-Note</th><th>Elf</th></tr>
        ${rows.map(({ p, st, schnitt }) => `<tr><td>${p.name} <span style="color:var(--text-muted);">${p.pos}</span></td><td>${st.spiele}</td><td>${st.tore}</td><td>${st.vorlagen}</td>
            <td style="color:${farbe(schnitt)}; font-weight:800;">${formatGrade(Math.round(schnitt * 100) / 100)}</td><td>${st.elf ? '⭐' + st.elf : ''}</td></tr>`).join('')}
    </table>`;
}
