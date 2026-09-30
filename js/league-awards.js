// Liga-Auszeichnungen am Saisonende: Torjägerkanone, Elf der Saison, Trainer des Jahres und
// Talent des Jahres. Eigene Spieler treten mit ihren echten Saisonwerten an. Die Torjägerkanone
// kommt aus der Torjägerliste der Liga (getLeagueScorers()); die übrigen KI-Kandidaten werden
// aus echten Ligadaten abgeleitet (Tabellenplatz, Vereinsstärke), nur die Namen sind generiert.

const ELF_DER_SAISON = { TW: 1, ABW: 4, MIT: 4, ST: 2 };

function awardLeagueHonours(myRank) {
    const level = game.leagueLevel;
    const table = [...(leaguesData[level] || [])].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
    const reserve = game.secondTeam && game.secondTeam.name;
    const ki = table.filter(t => t.name !== game.clubName && t.name !== reserve);
    if (!table.length || !squad.length) return null;
    const ergebnis = { season: game.season, league: leagueNames[level], awards: [] };
    const eigeneGewinne = [];
    const ehre = (p, moral, wert) => {
        p.morale = Math.min(100, (p.morale || 50) + moral);
        p.marketValue = Math.round(p.marketValue * wert / 1000) * 1000;
    };

    // Torjägerkanone: bester KI-Torschütze aus der echten Torjägerliste (league-stats.js).
    const kiTorjaeger = typeof getLeagueScorers === 'function' ? getLeagueScorers(level).find(s => !s.own) : null;
    const eigenerTorjaeger = [...squad].sort((a, b) => (b.goalsSeason || 0) - (a.goalsSeason || 0))[0];
    if (eigenerTorjaeger && (eigenerTorjaeger.goalsSeason || 0) > 0 && (!kiTorjaeger || eigenerTorjaeger.goalsSeason >= kiTorjaeger.goals)) {
        ergebnis.awards.push({ award: '👟 Torjägerkanone', winner: eigenerTorjaeger.name, club: game.clubName, value: `${eigenerTorjaeger.goalsSeason} Tore`, own: true });
        ehre(eigenerTorjaeger, 15, 1.15);
        eigeneGewinne.push(`👟 Torjägerkanone: ${eigenerTorjaeger.name} (${eigenerTorjaeger.goalsSeason} Tore)`);
    } else if (kiTorjaeger) {
        ergebnis.awards.push({ award: '👟 Torjägerkanone', winner: kiTorjaeger.name, club: kiTorjaeger.club, value: `${kiTorjaeger.goals} Tore` });
    }

    // Elf der Saison: eigene Stammspieler, die das Niveau der Spitzenteams erreichen.
    const spitze = ki.slice(0, 4);
    const niveau = spitze.length ? spitze.reduce((s, t) => s + (t.baseStrength || t.strength), 0) / spitze.length : 60;
    const elf = [];
    Object.entries(ELF_DER_SAISON).forEach(([pos, plaetze]) => {
        const eigene = squad.filter(p => p.pos === pos && (p.appearancesSeason || 0) >= 15)
            .map(p => ({ p, wert: p.strength + (p.goalsSeason || 0) * 0.3 + (myRank <= 3 ? 2 : 0) }))
            .filter(x => x.wert >= niveau + 2)
            .sort((a, b) => b.wert - a.wert).slice(0, plaetze);
        eigene.forEach(x => { elf.push({ pos, name: x.p.name, club: game.clubName, own: true }); ehre(x.p, 8, 1.08); });
        for (let i = eigene.length; i < plaetze; i++) {
            const club = spitze.length ? spitze[Math.floor(Math.random() * spitze.length)].name : '-';
            elf.push({ pos, name: getRandomName(), club });
        }
    });
    const eigeneInElf = elf.filter(e => e.own);
    ergebnis.elf = elf;
    if (eigeneInElf.length) eigeneGewinne.push(`⭐ Elf der Saison: ${eigeneInElf.map(e => e.name).join(', ')}`);

    // Trainer des Jahres: Meister oder deutlich über den Erwartungen.
    const erwartet = game.seasonExpectation && game.seasonExpectation.expectedRank;
    const leistung = (myRank === 1 ? 6 : 0) + (erwartet ? (erwartet - myRank) : 0);
    if (leistung >= 6) {
        ergebnis.awards.push({ award: '🎩 Trainer des Jahres', winner: 'Du', club: game.clubName, value: `Platz ${myRank}${erwartet ? ` (erwartet: ${erwartet})` : ''}`, own: true });
        if (typeof addManagerXP === 'function') addManagerXP(500);
        game.managerMediaImage = Math.min(100, (game.managerMediaImage || 50) + 5);
        game.boardSat = Math.min(100, game.boardSat + 5);
        eigeneGewinne.push('🎩 Du bist Trainer des Jahres!');
    } else {
        const meister = ki[0];
        const coach = meister ? (typeof getTeamCoach === 'function' ? getTeamCoach(meister).name : getRandomName()) : '-';
        ergebnis.awards.push({ award: '🎩 Trainer des Jahres', winner: coach, club: meister ? meister.name : '-', value: meister ? `Platz ${table.indexOf(meister) + 1}` : '' });
    }

    // Talent des Jahres: bester U21-Spieler mit Einsatzzeit.
    const ligaBasis = 82 - level * 10;
    const talent = squad.filter(p => (p.age || 30) <= 21 && (p.appearancesSeason || 0) >= 10).sort((a, b) => b.strength - a.strength)[0];
    const kiTalentStaerke = ligaBasis - 6 + Math.floor(Math.random() * 6);
    if (talent && talent.strength >= kiTalentStaerke) {
        ergebnis.awards.push({ award: '🌱 Talent des Jahres', winner: talent.name, club: game.clubName, value: `${talent.age} Jahre, Stärke ${talent.strength}`, own: true });
        ehre(talent, 10, 1.1);
        eigeneGewinne.push(`🌱 Talent des Jahres: ${talent.name}`);
    } else {
        const club = ki.length ? ki[Math.floor(Math.random() * Math.min(8, ki.length))].name : '-';
        ergebnis.awards.push({ award: '🌱 Talent des Jahres', winner: getRandomName(), club, value: `${19 + Math.floor(Math.random() * 3)} Jahre` });
    }

    if (!game.leagueAwards) game.leagueAwards = [];
    game.leagueAwards.push(ergebnis);
    if (game.leagueAwards.length > 20) game.leagueAwards.shift();

    const liste = ergebnis.awards.map(a => `${a.award}: ${a.winner} (${a.club}) - ${a.value}`).join('\n');
    addInboxMessage('vertrag', `🏅 Liga-Auszeichnungen ${ergebnis.league}, Saison ${game.season}`,
        `${liste}\n\n⭐ Elf der Saison: ${elf.map(e => `${e.name} (${e.club === game.clubName ? 'dein Verein' : e.club})`).join(', ')}`, 'screen-history');
    if (eigeneGewinne.length) showNotice('🏅 Liga-Auszeichnungen', `Dein Verein räumt ab:\n\n${eigeneGewinne.join('\n')}`);
    return ergebnis;
}

function renderLeagueAwardsBox() {
    const box = document.getElementById('league-awards-box');
    if (!box) return;
    const liste = (game.leagueAwards || []).slice().reverse();
    if (!liste.length) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Die ersten Auszeichnungen werden am Saisonende vergeben.</div>'; return; }
    box.innerHTML = liste.slice(0, 5).map(e => `<div class="box" style="font-size:9px; margin-bottom:4px;">
        <strong>Saison ${e.season} · ${e.league}</strong>
        ${e.awards.map(a => `<div style="${a.own ? 'color:var(--gold); font-weight:700;' : ''}">${a.award}: ${a.winner} (${a.club}) - ${a.value}</div>`).join('')}
        <div style="color:var(--text-muted);">⭐ Elf: ${e.elf.filter(x => x.own).length} eigene Spieler${e.elf.some(x => x.own) ? ` (${e.elf.filter(x => x.own).map(x => x.name).join(', ')})` : ''}</div>
    </div>`).join('');
}
