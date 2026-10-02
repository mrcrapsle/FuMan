/* eslint-disable no-undef */
// Länderspiele & Turniere: feste Länderspielpausen nach den Spieltagen 6, 13, 24 und 30.
// Nominiert wird nachvollziehbar - wer die Stärke-Schwelle seines Landes erreicht (gute
// Saisonnoten senken sie), fährt zur Nationalmannschaft. Kein Ligaspiel fällt aus, aber
// die Reise kostet Kraft und birgt ein Verletzungsrisiko; dafür steigen Moral, Marktwert
// und das Ansehen des Vereins. In jedem zweiten Sommer (nach geraden Saisons) folgt ein
// Turnier - abwechselnd WM und EM - mit Ergebnissen für jede Nation mit eigenen Spielern.
// Für jede Abstellung erhält der Verein eine Prämie (payReleaseFee()).
// Spielerwerte: p.caps, p.intlGoals, p.intlTitles; Turnierhistorie in game.intlTournaments.

const INTL_BREAK_MATCHDAYS = [6, 13, 24, 30];
const NATIONS = {
    Deutschland: { threshold: 73, strength: 86, flag: '🇩🇪' },
    Frankreich: { threshold: 75, strength: 88, flag: '🇫🇷' },
    Niederlande: { threshold: 72, strength: 83, flag: '🇳🇱' },
    Schweiz: { threshold: 66, strength: 77, flag: '🇨🇭' },
    Österreich: { threshold: 65, strength: 76, flag: '🇦🇹' },
    Polen: { threshold: 64, strength: 76, flag: '🇵🇱' }
};
const INTL_OPPONENTS = ['Spanien', 'Italien', 'England', 'Portugal', 'Belgien', 'Kroatien', 'Dänemark', 'Schweden', 'Tschechien', 'Ungarn', 'Schottland', 'Norwegen'];
const TOURNAMENT_STAGES = ['Vorrunde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale', 'Titel'];
// Abstellungsprämien an den Verein (Kontoauszug "🌍 Abstellungsprämien"): pauschal je
// Spieler und Länderspielpause, bei Turnieren je Spieler und Turniertag wie beim
// Club-Benefits-Programm von FIFA/UEFA (Vorrunde 14 Tage, jede K.-o.-Runde 5 Tage mehr).
const INTL_BREAK_FEE = 15000;
const TOURNAMENT_DAY_FEE = { Weltmeisterschaft: 10000, Europameisterschaft: 12000 };

function payReleaseFee(betrag) {
    if (!(betrag > 0)) return 0;
    if (typeof setzeBuchungskontext === 'function') setzeBuchungskontext('🌍 Abstellungsprämien');
    game.money += betrag;
    if (typeof loescheBuchungskontext === 'function') loescheBuchungskontext();
    return betrag;
}

function getNation(p) {
    return NATIONS[p.nation] ? p.nation : 'Deutschland';
}

// Schwelle für eine Nominierung: gute Saisonnoten (Ø 2,5 oder besser) senken sie um 2.
function getNominationThreshold(p) {
    let schwelle = NATIONS[getNation(p)].threshold;
    const st = p.statsSeason;
    if (st && st.spiele >= 5 && st.notenSumme / st.spiele <= 2.5) schwelle -= 2;
    return schwelle;
}

function isNominated(p) {
    return (p.injured || 0) === 0 && p.strength >= getNominationThreshold(p);
}

function getNextIntlBreak() {
    return INTL_BREAK_MATCHDAYS.find(md => md >= game.matchday) || null;
}

// Aus processPostMatchRoutine() nach jedem Spieltag: an den Pausen-Spieltagen reisen die
// Nominierten zu zwei Länderspielen.
function tickInternationalBreak() {
    if (!INTL_BREAK_MATCHDAYS.includes(game.matchday)) return null;
    const kader = squad.filter(isNominated);
    if (!kader.length) return null;
    const zeilen = [];
    kader.forEach(p => {
        const gegner = INTL_OPPONENTS[Math.floor(Math.random() * INTL_OPPONENTS.length)];
        const einsaetze = Math.random() < 0.7 ? 2 : 1;
        let tore = 0;
        for (let i = 0; i < einsaetze; i++) if (Math.random() < ({ ST: 0.3, MIT: 0.12, ABW: 0.04, TW: 0 }[p.pos] || 0.1)) tore++;
        p.caps = (p.caps || 0) + einsaetze;
        p.intlGoals = (p.intlGoals || 0) + tore;
        p.morale = Math.min(100, (p.morale || 50) + 5);
        p.fitness = Math.max(10, (p.fitness || 100) - 12);
        p.marketValue = Math.round((p.marketValue || 0) * 1.02 / 1000) * 1000;
        let verletzt = '';
        if (Math.random() < 0.08) {
            p.injured = 1 + Math.floor(Math.random() * 2);
            verletzt = ` - kommt verletzt zurück (${p.injured} Sp.)`;
        }
        zeilen.push(`${NATIONS[getNation(p)].flag} ${p.name}: ${einsaetze} Spiel${einsaetze > 1 ? 'e' : ''} (u. a. gegen ${gegner})${tore ? `, ${tore} Tor${tore > 1 ? 'e' : ''}` : ''}${verletzt}`);
    });
    game.fans = Math.min(100, game.fans + Math.min(3, kader.length));
    if (typeof addManagerXP === 'function') addManagerXP(20 * kader.length);
    const praemie = payReleaseFee(INTL_BREAK_FEE * kader.length);
    addInboxMessage('vertrag', `🌍 Länderspielpause: ${kader.length} Nationalspieler unterwegs`,
        `${zeilen.join('\n')}\n\nAbstellungsprämie für den Verein: ${formatVal(praemie)} (${formatVal(INTL_BREAK_FEE)} je Spieler).\nAlle sind zum nächsten Spiel zurück, aber müde (Fitness -12). Moral und Marktwert steigen, die Fans sind stolz.`, 'screen-squad');
    return kader;
}

function getTournamentName(season) {
    return season % 4 === 0 ? 'Weltmeisterschaft' : 'Europameisterschaft';
}

// Saisonwechsel (nach dem Fitness-Reset): nach jeder geraden Saison ein Turnier für alle
// Nationen mit nominierten eigenen Spielern.
function playSummerTournament() {
    const saison = game.season - 1;
    if (saison < 1 || saison % 2 !== 0) return null;
    const teilnehmer = squad.filter(isNominated);
    if (!teilnehmer.length) return null;
    const name = getTournamentName(saison);
    const proNation = {};
    teilnehmer.forEach(p => { (proNation[getNation(p)] = proNation[getNation(p)] || []).push(p); });
    const ergebnis = { season: saison, name, nations: [] };
    const meldungen = [];
    Object.entries(proNation).forEach(([nation, spieler]) => {
        const s = NATIONS[nation].strength;
        let stufe = 0;
        if (Math.random() < Math.max(0.3, Math.min(0.95, (s - 66) / 22))) {
            stufe = 1;
            while (stufe < 5 && Math.random() < Math.max(0.2, Math.min(0.7, 0.4 + (s - 80) * 0.03))) stufe++;
        }
        const spiele = 3 + Math.min(stufe, 4);
        const runde = TOURNAMENT_STAGES[stufe];
        const tage = 14 + 5 * Math.min(stufe, 4);
        const eintrag = { nation, stage: runde, days: tage, players: [], fee: TOURNAMENT_DAY_FEE[name] * tage * spieler.length };
        spieler.forEach(p => {
            const anteil = Math.min(1, 0.55 + (p.strength - getNominationThreshold(p)) * 0.06);
            const einsaetze = Math.max(1, Math.round(spiele * anteil));
            let tore = 0;
            for (let i = 0; i < einsaetze; i++) if (Math.random() < ({ ST: 0.32, MIT: 0.13, ABW: 0.04, TW: 0 }[p.pos] || 0.1)) tore++;
            p.caps = (p.caps || 0) + einsaetze;
            p.intlGoals = (p.intlGoals || 0) + tore;
            if (stufe === 5) p.intlTitles = (p.intlTitles || 0) + 1;
            // Ein gutes Turnier treibt den Marktwert, dafür beginnt die Vorbereitung später.
            const schub = 1 + 0.03 * stufe + 0.02 * tore;
            p.marketValue = Math.round((p.marketValue || 0) * schub / 1000) * 1000;
            p.morale = Math.min(100, (p.morale || 50) + (stufe === 5 ? 15 : stufe >= 3 ? 6 : 0));
            p.fitness = Math.max(40, (p.fitness || 100) - 15);
            if (Math.random() < 0.1) p.injured = Math.max(p.injured || 0, 1 + Math.floor(Math.random() * 3));
            eintrag.players.push({ name: p.name, apps: einsaetze, goals: tore });
        });
        ergebnis.nations.push(eintrag);
        ergebnis.fee = (ergebnis.fee || 0) + eintrag.fee;
        meldungen.push(`${NATIONS[nation].flag} ${nation}: ${stufe === 5 ? '🏆 TITEL!' : (stufe === 4 ? 'Finale verloren' : (stufe === 0 ? 'Aus in der Vorrunde' : `Aus im ${runde}`))} - ${eintrag.players.map(x => `${x.name} (${x.apps} Sp.${x.goals ? `, ${x.goals} T.` : ''})`).join(', ')}`);
    });
    payReleaseFee(ergebnis.fee);
    if (!game.intlTournaments) game.intlTournaments = [];
    game.intlTournaments.unshift(ergebnis);
    if (game.intlTournaments.length > 8) game.intlTournaments.length = 8;
    const titel = ergebnis.nations.some(n => n.stage === 'Titel');
    if (titel) { game.fans = Math.min(100, game.fans + 4); if (typeof addManagerXP === 'function') addManagerXP(300); }
    addInboxMessage('vertrag', `🌍 ${name} ${saison}: ${teilnehmer.length} Spieler dabei${titel ? ' - mit Titel!' : ''}`,
        `${meldungen.join('\n')}\n\nAbstellungsprämie für den Verein: ${formatVal(ergebnis.fee)} (${formatVal(TOURNAMENT_DAY_FEE[name])} je Spieler und Turniertag).\nDie Turnierfahrer steigen später ins Training ein (Fitness -15), der Marktwert steigt mit jedem Turniererfolg.`, 'screen-squad');
    return ergebnis;
}

function renderNationalTeamPanel() {
    const box = document.getElementById('national-team-box');
    if (!box) return;
    const naechste = getNextIntlBreak();
    const saisonGerade = game.season % 2 === 0;
    const kandidaten = [...squad].map(p => ({ p, schwelle: getNominationThreshold(p) }))
        .filter(x => x.p.strength >= x.schwelle - 4 || (x.p.caps || 0) > 0)
        .sort((a, b) => (b.p.strength - b.schwelle) - (a.p.strength - a.schwelle));
    const zeilen = kandidaten.length ? kandidaten.slice(0, 12).map(({ p, schwelle }) => {
        const drin = isNominated(p);
        return `<div style="display:flex; justify-content:space-between; gap:6px; padding:2px 0; border-top:1px solid rgba(255,255,255,0.06);">
            <span>${NATIONS[getNation(p)].flag} ${p.name} <span style="color:var(--text-muted);">${p.pos}</span></span>
            <span>${drin ? '<span style="color:var(--primary);">✅ nominiert</span>' : `<span style="color:var(--text-muted);">Stärke ${p.strength}/${schwelle}</span>`}
            · ${p.caps || 0} Sp., ${p.intlGoals || 0} T.${p.intlTitles ? ` · 🏆${p.intlTitles}` : ''}</span>
        </div>`;
    }).join('') : '<div style="color:var(--text-muted);">Noch niemand in Reichweite einer Nominierung (Deutschland ab Stärke 73, kleinere Nationen ab 64).</div>';
    const historie = (game.intlTournaments || []).slice(0, 3).map(t => `<div class="box" style="font-size:9px;"><strong>${t.name} ${t.season}</strong>: ${t.nations.map(n => `${NATIONS[n.nation] ? NATIONS[n.nation].flag : ''} ${n.nation} - ${n.stage === 'Titel' ? '🏆 Titel' : n.stage}`).join(' · ')}${t.fee ? ` · Prämie ${formatVal(t.fee)}` : ''}</div>`).join('');
    box.innerHTML = `<div style="font-size:9px;">
        <div style="color:var(--text-muted); margin-bottom:4px;">Länderspielpausen nach den Spieltagen ${INTL_BREAK_MATCHDAYS.join(', ')}${naechste ? ` (nächste: nach Spieltag ${naechste})` : ''}. Nominiert wird, wer die Schwelle seines Landes erreicht; ein Notenschnitt von 2,5 oder besser senkt sie um 2. Reise: Fitness -12, Verletzungsrisiko - dafür Moral, Marktwert, Fans und ${formatVal(INTL_BREAK_FEE)} Abstellungsprämie je Spieler. Turniere: ${formatVal(TOURNAMENT_DAY_FEE.Weltmeisterschaft)} (WM) bzw. ${formatVal(TOURNAMENT_DAY_FEE.Europameisterschaft)} (EM) je Spieler und Turniertag.
        ${saisonGerade ? `<br>🏆 Nach dieser Saison: <strong>${getTournamentName(game.season)}</strong>.` : '<br>Nach der nächsten Saison steht wieder ein Turnier an.'}</div>
        ${zeilen}
        ${historie ? `<div style="margin-top:6px;">${historie}</div>` : ''}
    </div>`;
}
