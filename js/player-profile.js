/* eslint-disable no-undef */
// Spieler-Karriereprofil (Phase 22.10): im Spieler-Popup statt der kurzen Karrierezeile ein
// echtes Profil - wie und woher er kam (p.joined: Saison, Weg, abgebender Verein, Ablöse),
// Saison für Saison Spiele/Tore/Vorlagen/Note/Elf des Spieltags (p.strengthHistory plus die
// laufende Saison aus p.statsSeason), Länderspiele und Titel (p.honours: Meister, Aufstieg,
// Pokalsieg, Spieler des Monats/der Saison).
// Vereinslegende (isClubLegend: ab 150 Pflichtspielen oder 6 Saisons im Verein): geht er -
// Verkauf oder Vertragsende -, sind die Fans getroffen (-8, Vorstand -2).

const LEGEND_APPS = 150;
const LEGEND_SEASONS = 6;
const JOIN_LABELS = {
    kauf: 'gekauft', ablösefrei: 'ablösefrei als Vereinsloser', vorvertrag: 'per Vorvertrag (ablösefrei)',
    rückkauf: 'zurückgekauft', jugend: 'aus der eigenen Jugend', leihe: 'nach Leihe fest verpflichtet', reserve: 'aus der Zweiten Mannschaft'
};

// Zugang festhalten (Kauf, Vereinslose, Vorvertrag, Rückkauf, Jugend, Leihe, Reserve).
function stampPlayerJoin(p, via, from, fee, neu) {
    if (!p || (p.joined && !neu)) return;
    p.joined = { season: game.season, via, from: from || null, fee: fee || 0 };
}

function addPlayerHonour(p, text) {
    if (!p) return;
    if (!p.honours) p.honours = [];
    p.honours.push({ season: game.season, text });
    if (p.honours.length > 20) p.honours.shift();
}

function addSquadHonour(text) {
    squad.forEach(p => addPlayerHonour(p, text));
}

function getSeasonsAtClub(p) {
    if (p.joined && p.joined.season) return Math.max(0, game.season - p.joined.season);
    return (p.strengthHistory || []).length;
}

function isClubLegend(p) {
    return !!p && ((p.appearances || 0) >= LEGEND_APPS || getSeasonsAtClub(p) >= LEGEND_SEASONS);
}

// Aus checkCrowdFavoriteDeparture() - jeder Abgang (Verkauf, Vertragsende) läuft dort durch.
function checkLegendDeparture(p) {
    if (!isClubLegend(p)) return;
    game.fans = Math.max(game.fanBaseFloor || 10, game.fans - 8);
    game.boardSat = Math.max(10, game.boardSat - 2);
    addInboxMessage('vertrag', `🏛️ Eine Vereinslegende geht: ${p.name}`, `${p.appearances || 0} Pflichtspiele, ${getSeasonsAtClub(p)} Saisons - die Fans verabschieden ${p.name} mit Wehmut (Fans -8, Vorstand -2).`, 'screen-squad');
}

// Saisonende (vor dem Ligawechsel): Meistertitel und Spieler der Saison.
function recordSeasonHonours(myRank) {
    const liga = typeof leagueNames !== 'undefined' ? leagueNames[game.leagueLevel] : 'Liga';
    if (myRank === 1) addSquadHonour(`🏆 Meister ${liga}`);
    const pos = typeof pickPlayerOfSeason === 'function' ? pickPlayerOfSeason() : null;
    if (pos && pos.p) addPlayerHonour(pos.p, '⭐ Spieler der Saison');
}

function describeJoin(p) {
    const j = p.joined;
    if (!j) return p.academyGraduate ? 'aus der eigenen Jugend' : 'seit dem Start deiner Karriere im Verein';
    const woher = j.from ? ` von ${j.from}` : '';
    const ablose = j.via === 'kauf' || j.via === 'rückkauf' || j.via === 'leihe' ? ` für ${formatVal(j.fee || 0)}` : '';
    return `seit Saison ${j.season} · ${JOIN_LABELS[j.via] || j.via}${woher}${ablose}`;
}

function getProfileSeasons(p) {
    const zeilen = (p.strengthHistory || []).filter(h => h.apps !== undefined).map(h => ({
        season: h.season, apps: h.apps, goals: h.goals, assists: h.assists ?? null, grade: h.grade ?? null, elf: h.elf ?? null, strength: h.strength
    }));
    const st = p.statsSeason;
    zeilen.push({ season: game.season, apps: p.appearancesSeason || 0, goals: p.goalsSeason || 0, assists: st ? st.vorlagen : 0,
        grade: st && st.spiele ? +(st.notenSumme / st.spiele).toFixed(2) : null, elf: st ? st.elf : 0, strength: p.strength, laufend: true });
    return zeilen;
}

function renderPlayerProfile(p) {
    if (!p || !squad.includes(p)) return '';
    const arch = typeof getPlayerArchetype === 'function' ? getPlayerArchetype(p) : null;
    const saisons = getProfileSeasons(p);
    const vorlagen = saisons.reduce((s, z) => s + (z.assists || 0), 0);
    const elf = saisons.reduce((s, z) => s + (z.elf || 0), 0);
    const noten = saisons.filter(z => z.grade);
    const besteNote = noten.length ? Math.min(...noten.map(z => z.grade)) : null;
    const legende = isClubLegend(p);
    const fmt = n => n === null || n === undefined ? '-' : String(n).replace('.', ',');
    const tabelle = saisons.slice(-6).reverse().map(z => `<tr${z.laufend ? ' style="color:var(--accent);"' : ''}><td>${z.season}${z.laufend ? '*' : ''}</td><td>${z.apps}</td><td>${z.goals}</td><td>${fmt(z.assists)}</td><td>${z.grade ? fmt(z.grade.toFixed(2)) : '-'}</td><td>${fmt(z.elf)}</td><td>${z.strength}</td></tr>`).join('');
    const titel = (p.honours || []).slice().reverse();
    const intl = (p.caps || 0) > 0 ? `🌍 ${p.caps} Länderspiele, ${p.intlGoals || 0} Tore${(p.intlTitles || []).length ? ` · ${p.intlTitles.length} Turniertitel` : ''}<br>` : '';
    return `<div class="box" style="font-size:9px; text-align:left;">
        <div style="font-weight:700; color:var(--accent); margin-bottom:4px;">📊 KARRIEREPROFIL${legende ? ' · <span style="color:var(--gold);">🏛️ VEREINSLEGENDE</span>' : ''}</div>
        🏟️ Im Verein ${describeJoin(p)}${legende ? '' : ` · Legende ab ${LEGEND_APPS} Pflichtspielen oder ${LEGEND_SEASONS} Saisons`}<br>
        ${arch ? `${arch.icon} ${arch.name} - Höhepunkt mit etwa ${arch.peakAge} Jahren${typeof formatDevelopmentRange === 'function' ? ` · nächster Sommer: ${formatDevelopmentRange(p)}` : ''}<br>` : ''}
        ⚽ ${p.appearances || 0} Pflichtspiele · ${p.goalsCareer || 0} Tore · ${vorlagen} Vorlagen · ${elf}× Elf des Spieltags${besteNote ? ` · beste Saisonnote ${fmt(besteNote.toFixed(2))}` : ''}<br>
        ${intl}
        <table style="width:100%; font-size:9px; margin-top:4px; border-collapse:collapse; text-align:center;">
            <tr style="color:var(--text-muted);"><th>Saison</th><th>Sp</th><th>T</th><th>V</th><th>Note</th><th>Elf</th><th>Stärke</th></tr>${tabelle}
        </table>
        ${titel.length ? `<div style="margin-top:4px;">${titel.map(h => `${h.text} (Saison ${h.season})`).join(' · ')}</div>` : '<div style="margin-top:4px; color:var(--text-muted);">Noch keine Titel und Auszeichnungen.</div>'}
    </div>`;
}
