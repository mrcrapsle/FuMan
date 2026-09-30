/* eslint-disable no-undef */
// KI-Vereine: jeder KI-Klub hat einen namentlich bekannten Star (team.star). In beiden
// Wechselperioden kaufen Spitzenklubs die Stars schwächerer Vereine - aus der eigenen Liga
// oder eine Liga tiefer. Die Stärke wandert mit dem Spieler (Käufer +, Verkäufer -, in der
// Summe gleich), damit die Ligen nicht wegdriften. Alle Wechsel landen im Transfer-Ticker
// (game.aiTransferNews) und als Sammelmeldung im Postfach. Stars altern jede Saison und
// beenden mit 34 ihre Karriere - der Verein bekommt einen neuen Leistungsträger.

const AI_TRANSFER_MATCHDAYS = [2, 19]; // Sommer- und Winterfenster
const AI_STAR_POSITIONS = ['ST', 'ST', 'MIT', 'MIT', 'ABW', 'TW'];

function isAiClub(t) {
    return t && t.name !== game.clubName && !(game.secondTeam && game.secondTeam.isActive && t.name === game.secondTeam.name);
}

function makeAiStar(t, jung = false) {
    return {
        name: getRandomName(),
        pos: AI_STAR_POSITIONS[Math.floor(Math.random() * AI_STAR_POSITIONS.length)],
        strength: Math.min(95, Math.round(t.strength + (jung ? 2 : 5) + Math.random() * 5)),
        age: jung ? 19 + Math.floor(Math.random() * 3) : 22 + Math.floor(Math.random() * 9)
    };
}

function ensureAiStars() {
    (leaguesData || []).forEach(liga => (liga || []).forEach(t => {
        if (isAiClub(t) && !t.star) t.star = makeAiStar(t);
    }));
}

function addAiTransferNews(eintrag) {
    if (!game.aiTransferNews) game.aiTransferNews = [];
    game.aiTransferNews.unshift({ season: game.season, matchday: game.matchday, ...eintrag });
    if (game.aiTransferNews.length > 30) game.aiTransferNews.length = 30;
}

// Ein Wechsel: Käufer bekommt den Star, Verkäufer ein Nachwuchstalent.
function executeAiStarTransfer(kaeufer, verkaeufer, kaeuferLiga, verkaeuferLiga) {
    const star = verkaeufer.star;
    const delta = Math.max(1, Math.min(2, Math.round((star.strength - kaeufer.strength) / 6)));
    kaeufer.strength = Math.min(96, kaeufer.strength + delta);
    kaeufer.baseStrength = Math.min(96, (kaeufer.baseStrength || kaeufer.strength) + delta);
    verkaeufer.strength = Math.max(20, verkaeufer.strength - delta);
    verkaeufer.baseStrength = Math.max(20, (verkaeufer.baseStrength || verkaeufer.strength) - delta);
    const abloese = Math.round(calculatePlayerMarketValue(star.strength) * (1.1 + Math.random() * 0.4) / 10000) * 10000;
    // Star des Käufers wird er nur, wenn er besser ist als der bisherige Leistungsträger
    if (!kaeufer.star || star.strength > kaeufer.star.strength) kaeufer.star = { ...star };
    verkaeufer.star = makeAiStar(verkaeufer, true);
    addAiTransferNews({ player: star.name, pos: star.pos, strength: star.strength, from: verkaeufer.name, to: kaeufer.name,
        fee: abloese, fromLeague: verkaeuferLiga, toLeague: kaeuferLiga });
    return `${star.name} (${star.pos}, ${star.strength}) wechselt von ${verkaeufer.name} zu ${kaeufer.name} - Ablöse ${formatVal(abloese)}`;
}

// Aus tickTransferWindows() nach jedem Spieltag: an den Fenster-Spieltagen 1-2 Wechsel je Liga.
function tickAiTransfers() {
    if (!AI_TRANSFER_MATCHDAYS.includes(game.matchday)) return;
    ensureAiStars();
    const meldungen = [];
    leaguesData.forEach((liga, l) => {
        const tabelle = [...liga].filter(isAiClub).sort((a, b) => b.points - a.points || b.strength - a.strength);
        if (tabelle.length < 8) return;
        const deals = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < deals; i++) {
            const kaeufer = tabelle[Math.floor(Math.random() * 5)];
            // Mal ein Star aus der eigenen Liga (untere Tabellenhälfte), mal der beste aus der Liga darunter
            let verkaeufer = null, verkaeuferLiga = l;
            if (l < leaguesData.length - 1 && Math.random() < 0.35) {
                const unten = [...leaguesData[l + 1]].filter(isAiClub).sort((a, b) => (b.star?.strength || 0) - (a.star?.strength || 0));
                verkaeufer = unten[0]; verkaeuferLiga = l + 1;
            } else {
                const kandidaten = tabelle.slice(Math.floor(tabelle.length / 2)).filter(t => t !== kaeufer);
                verkaeufer = kandidaten[Math.floor(Math.random() * kandidaten.length)];
            }
            if (!kaeufer || !verkaeufer || kaeufer === verkaeufer || !verkaeufer.star) continue;
            // Nur echte Verstärkungen: mindestens so gut wie die Mannschaft des Käufers
            if (verkaeufer.star.strength < kaeufer.strength) continue;
            meldungen.push({ l, text: executeAiStarTransfer(kaeufer, verkaeufer, l, verkaeuferLiga) });
        }
    });
    if (!meldungen.length) return;
    // Eigene Liga zuerst - die Konkurrenz interessiert am meisten
    meldungen.sort((a, b) => (a.l === game.leagueLevel ? -1 : 0) - (b.l === game.leagueLevel ? -1 : 0));
    const fenster = game.matchday < 10 ? 'Sommer' : 'Winter';
    addInboxMessage('transfer', `📰 Transfer-Ticker (${fenster})`,
        meldungen.map(m => `• ${leagueNames[m.l]}: ${m.text}`).join('\n'), 'screen-transfer');
}

// Saisonende (vor advanceLeaguesToNewSeason): Stars altern, Karriereenden mit 34.
function ageAiStars() {
    ensureAiStars();
    leaguesData.forEach(liga => liga.forEach(t => {
        if (!isAiClub(t) || !t.star) return;
        t.star.age++;
        if (t.star.age >= 34) {
            addAiTransferNews({ player: t.star.name, pos: t.star.pos, strength: t.star.strength, from: t.name, to: null, fee: 0, retired: true });
            t.star = makeAiStar(t);
        }
    }));
}

function getAiStarLine(team) {
    if (!team || !team.star) return '';
    return `<br>⭐ Star: <strong>${team.star.name}</strong> (${team.star.pos}, Stärke ${team.star.strength}, ${team.star.age} J.)`;
}

function renderAiTransferNews() {
    const box = document.getElementById('ai-transfer-news-box');
    if (!box) return;
    const news = (game.aiTransferNews || []).slice(0, 10);
    if (!news.length) { box.innerHTML = '<div style="font-size:10px; color:var(--text-muted);">Noch keine Wechsel zwischen anderen Vereinen. Die Fenster öffnen am 2. und 19. Spieltag.</div>'; return; }
    box.innerHTML = news.map(n => {
        const eigeneLiga = n.toLeague === game.leagueLevel || n.fromLeague === game.leagueLevel;
        const text = n.retired
            ? `👋 ${n.player} (${n.pos}) beendet bei ${n.from} seine Karriere`
            : `🔁 <strong>${n.player}</strong> (${n.pos}, ${n.strength}): ${n.from} → <strong>${n.to}</strong> · ${formatVal(n.fee)}`;
        return `<div class="box" style="font-size:10px; ${eigeneLiga ? 'border-left-color:var(--accent);' : ''}">S${n.season}/SpT ${n.matchday}: ${text}</div>`;
    }).join('');
}
