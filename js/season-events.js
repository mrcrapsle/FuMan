/* eslint-disable no-undef */
// Saison-Ereignisse (Phase 15): Saisoneröffnung vor dem 1. Spieltag, Hallenturnier in der
// Winterpause, Abschiedsspiel für verdiente Spieler und Supercup (Meister gegen
// Pokalsieger, live über js/cup-live.js). Alles erscheint in #dash-season-events-box.
// Beträge skalieren mit leagueScaleFactor() und bleiben klein gegen die Ligaeinnahmen.

const HALLENTURNIER_EINLADUNG = 15; // nach diesem Spieltag kommt die Einladung
const HALLENTURNIER_SPIELTAG = 17;  // gespielt in der Winterpause nach dem 17. Spieltag
const SUPERCUP_PRAEMIE = 1000000;

function seasonEventScale() {
    return typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
}

function bucheSaisonereignis(label, betrag) {
    const aeussererKontext = buchungsKontext;
    setzeBuchungskontext(label);
    game.money += betrag;
    setzeBuchungskontext(aeussererKontext);
}

// ---------- SAISONERÖFFNUNG ----------
const SEASON_OPENING_OPTIONS = {
    fanfest: { label: '🎪 Fanfest', kosten: 20000, text: 'Kostet Geld, bringt Fans und Stimmung.' },
    sponsorentag: { label: '🤝 Sponsorentag', kosten: -30000, text: 'Sponsoren zahlen, der Vorstand freut sich - die Fans finden es langweilig.' },
    training: { label: '⚽ Öffentliches Training', kosten: 0, text: 'Kostenlos: etwas Fannähe und Moral.' }
};

function isSeasonOpeningOpen() {
    return game.matchday === 1 && !(game.seasonOpening && game.seasonOpening.season === game.season);
}

function chooseSeasonOpening(key) {
    const opt = SEASON_OPENING_OPTIONS[key];
    if (!opt || !isSeasonOpeningOpen()) return;
    const betrag = Math.round(opt.kosten * seasonEventScale() / 500) * 500;
    if (betrag > 0 && game.money < betrag) { showToast(`Nicht genug Geld (${formatVal(betrag)})!`, 'error'); return; }
    if (betrag !== 0) bucheSaisonereignis('🎉 Saisoneröffnung', -betrag);
    if (key === 'fanfest') {
        game.fans = Math.min(100, game.fans + 4);
        squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 2); });
    } else if (key === 'sponsorentag') {
        game.boardSat = Math.min(100, game.boardSat + 3);
        game.fans = Math.max(game.fanBaseFloor || 0, game.fans - 2);
    } else {
        game.fans = Math.min(100, game.fans + 2);
        squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 3); });
    }
    game.seasonOpening = { season: game.season, choice: key };
    showToast(`${opt.label}: Saison eröffnet!${betrag ? ` (${betrag > 0 ? '-' : '+'}${formatVal(Math.abs(betrag))})` : ''}`, 'success');
    updateUI();
}

// ---------- HALLENTURNIER ----------
function inviteHallenturnier() {
    const gegner = (leaguesData[game.leagueLevel] || []).map(t => t.name).filter(n => n !== game.clubName)
        .sort(() => Math.random() - 0.5).slice(0, 3);
    if (gegner.length < 3) return;
    game.hallenturnier = { season: game.season, status: 'eingeladen', gegner };
    addInboxMessage('vertrag', '🏟️ Einladung zum Hallenturnier', `In der Winterpause (nach dem ${HALLENTURNIER_SPIELTAG}. Spieltag) steigt das Hallenmasters mit ${gegner.join(', ')}. Zu- oder Absage auf dem Dashboard.`, 'screen-dashboard');
}

function respondHallenturnier(zusage) {
    const h = game.hallenturnier;
    if (!h || h.season !== game.season || h.status !== 'eingeladen') return;
    h.status = zusage ? 'zugesagt' : 'abgesagt';
    showToast(zusage ? '🏟️ Zusage fürs Hallenturnier geschickt.' : 'Hallenturnier abgesagt.', zusage ? 'success' : 'info');
    updateUI();
}

// In der Halle schrumpfen Stärkeunterschiede (kleines Feld, kurze Spielzeit).
function hallenStaerke(s) { return 50 + (s - 50) * 0.6; }

function hallenSpiel(heim, gast) {
    const staerke = n => hallenStaerke(n === game.clubName ? calcTeamStrength(false) : getOpponentStrength(n));
    const sh = staerke(heim), sg = staerke(gast);
    const g = simulateGoals(sh, sg);
    let sieger = g.myGoals > g.oppGoals ? heim : (g.oppGoals > g.myGoals ? gast : null);
    let nachNeunmeter = false;
    if (!sieger) { sieger = simulatePenaltyShootout(heim, gast, sh, sg).winner; nachNeunmeter = true; }
    return { heim, gast, tore: `${g.myGoals}:${g.oppGoals}${nachNeunmeter ? ' n.N.' : ''}`, sieger };
}

function playHallenturnier() {
    const h = game.hallenturnier;
    if (!h || h.season !== game.season || h.status === 'gespielt') return;
    if (h.status !== 'zugesagt') { h.status = 'abgesagt'; return; }
    const skala = seasonEventScale();
    const teams = [game.clubName, ...h.gegner].sort(() => Math.random() - 0.5);
    const hf1 = hallenSpiel(teams[0], teams[1]), hf2 = hallenSpiel(teams[2], teams[3]);
    const finale = hallenSpiel(hf1.sieger, hf2.sieger);
    h.spiele = [hf1, hf2, finale];
    h.status = 'gespielt';
    h.sieger = finale.sieger;
    const imFinale = finale.heim === game.clubName || finale.gast === game.clubName;
    const gewonnen = finale.sieger === game.clubName;
    const praemie = Math.round((15000 + (imFinale ? 25000 : 0) + (gewonnen ? 50000 : 0)) * skala / 500) * 500;
    h.praemie = praemie;
    bucheSaisonereignis('🏟️ Hallenturnier', praemie);
    // Kunstrasen und Bande: ein kleines Verletzungsrisiko für die Stammspieler.
    squad.filter(p => lineup.includes(p.id)).forEach(p => {
        p.fitness = Math.max(40, (p.fitness || 100) - 4);
        if (Math.random() < 0.04 && typeof injurePlayerByEvent === 'function') injurePlayerByEvent(p, 'Hallenturnier');
    });
    if (gewonnen) {
        game.fans = Math.min(100, game.fans + 2);
        game.trophies.push(`Hallenmasters-Sieger (Saison ${game.season})`);
    }
    const bericht = h.spiele.map((s, i) => `${i < 2 ? 'Halbfinale' : 'Finale'}: ${s.heim} - ${s.gast} ${s.tore}`).join('\n');
    addInboxMessage('vertrag', gewonnen ? '🏆 Hallenmasters gewonnen!' : '🏟️ Hallenturnier gespielt', `${bericht}\n\nPrämie: ${formatVal(praemie)}.`, 'screen-dashboard');
    showNotice(gewonnen ? '🏆 Hallenmasters gewonnen!' : '🏟️ Hallenturnier', `${bericht}\n\nPrämie: ${formatVal(praemie)}.`);
}

// ---------- ABSCHIEDSSPIEL ----------
// Aus schedulePlayerRetirement(): Legenden und Spieler mit 150+ Einsätzen bekommen eins.
function registerFarewellMatch(record) {
    if (!record || !(record.legendTier || (record.appearances || 0) >= 150)) return;
    if (!game.farewellMatches) game.farewellMatches = [];
    game.farewellMatches.push({ name: record.playerName, tier: record.legendTier || null, season: record.retirementSeason, done: false });
    if (game.farewellMatches.length > 20) game.farewellMatches.shift();
}

// Offen: bis zum Ende der Saison nach dem Karriereende.
function getOpenFarewellMatches() {
    return (game.farewellMatches || []).filter(f => !f.done && game.season <= f.season + 1);
}

function holdFarewellMatch(name) {
    const f = getOpenFarewellMatches().find(x => x.name === name);
    if (!f) return;
    const boost = f.tier === 'ICON' ? 2.2 : (f.tier ? 1.8 : 1.4);
    const zuschauer = typeof calculateMatchAttendance === 'function' ? calculateMatchAttendance(boost, 1) : 0;
    const preis = (stadium.stehShare ?? 0.5) * game.ticketPrices.steh + (stadium.sitzShare ?? 0.45) * game.ticketPrices.sitz;
    const einnahmen = Math.round(zuschauer * preis);
    // Organisation: höchstens 30 % der Einnahmen, damit es sich auch im kleinen Stadion lohnt.
    const kosten = Math.round(Math.min(10000 * seasonEventScale(), einnahmen * 0.3) / 500) * 500;
    bucheSaisonereignis('👋 Abschiedsspiel', einnahmen - kosten);
    game.fans = Math.min(100, game.fans + (f.tier === 'ICON' ? 5 : 3));
    squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 3); });
    f.done = true;
    f.zuschauer = zuschauer;
    f.einnahmen = einnahmen - kosten;
    addInboxMessage('vertrag', `👋 Abschiedsspiel für ${f.name}`, `${zuschauer.toLocaleString('de-DE')} Zuschauer verabschieden ${f.name}. Einnahmen nach Kosten: ${formatVal(einnahmen - kosten)}.`, 'screen-dashboard');
    showToast(`👋 Abschiedsspiel für ${f.name}: ${zuschauer.toLocaleString('de-DE')} Zuschauer`, 'success');
    updateUI();
}

// ---------- SUPERCUP ----------
// Vor advanceLeaguesToNewSeason() (alte Tabelle und alter Pokal sind noch da, game.season
// ist schon die neue Saison): Meister der 1. Liga gegen den DFB-Pokalsieger; holt einer
// das Double, spielt der Vizemeister. Nur wenn der eigene Verein beteiligt ist.
function prepareSupercup() {
    game.supercup = null;
    const tabelle = [...(leaguesData[0] || [])].sort(compareTableRows);
    const finale = (cupTournament.roundsHistory || []).find(r => r.roundIndex === 4 && r.completed);
    const p = finale && finale.pairings[0];
    if (!tabelle.length || !p) return;
    const pokalsieger = p.homeGoals > p.awayGoals ? p.home : (p.awayGoals > p.homeGoals ? p.away : p.penaltyWinner);
    const meister = tabelle[0].name;
    const gegner = pokalsieger && pokalsieger !== meister ? pokalsieger : (tabelle[1] && tabelle[1].name);
    if (!gegner || (meister !== game.clubName && gegner !== game.clubName)) return;
    game.supercup = { season: game.season, home: meister, away: gegner, played: false };
    addInboxMessage('vertrag', '🏆 Supercup am 1. Spieltag', `${meister} empfängt ${gegner} zum Supercup. Es geht um den ersten Titel der Saison und ${formatVal(SUPERCUP_PRAEMIE)} Prämie.`, 'screen-dashboard');
}

function getOwnSupercupTie() {
    const s = game.supercup;
    if (!s || s.played || s.season !== game.season || game.matchday !== 1) return null;
    const gegner = s.home === game.clubName ? s.away : s.home;
    return { comp: 'supercup', titel: '🏆 Supercup', home: s.home, away: s.away, oppStr: getOpponentStrength(gegner), elfmeter: true };
}

// Aus processPostMatchRoutine() am 1. Spieltag: live gespieltes Ergebnis übernehmen oder simulieren.
function resolveSupercup() {
    const tie = getOwnSupercupTie();
    if (!tie) return;
    const s = game.supercup;
    const live = typeof takeLiveCupResult === 'function' ? takeLiveCupResult('supercup', s.home, s.away) : null;
    const heim = s.home === game.clubName;
    const sh = heim ? calcTeamStrength(true) : getOpponentStrength(s.home);
    const sg = heim ? getOpponentStrength(s.away) : calcTeamStrength(false);
    const g = live ? { myGoals: live.homeGoals, oppGoals: live.awayGoals } : simulateGoals(sh, sg);
    let sieger = g.myGoals > g.oppGoals ? s.home : (g.oppGoals > g.myGoals ? s.away : null);
    if (!sieger) {
        sieger = (live && live.penaltyWinner) || simulatePenaltyShootout(s.home, s.away, sh, sg,
            heim ? autoSelectShooters() : null, heim ? null : autoSelectShooters()).winner;
        s.penalties = true;
    }
    s.played = true;
    s.score = `${g.myGoals}:${g.oppGoals}`;
    s.winner = sieger;
    if (sieger === game.clubName) {
        bucheSaisonereignis('🏆 Supercup', SUPERCUP_PRAEMIE);
        game.trophies.push(`Supercup-Sieger (Saison ${game.season})`);
        showNotice('🏆 Supercup gewonnen!', `${s.home} - ${s.away} ${s.score}${s.penalties ? ' n.E.' : ''}.\n\nDer erste Titel der Saison und ${formatVal(SUPERCUP_PRAEMIE)} Prämie.`);
    } else {
        showNotice('Supercup verloren', `${s.home} - ${s.away} ${s.score}${s.penalties ? ' n.E.' : ''}.`, { typ: 'warn' });
    }
}

// ---------- TICK & DASHBOARD ----------
// Jeden Spieltag aus processPostMatchRoutine() (vor game.matchday++).
function tickSeasonEvents() {
    if (game.matchday === HALLENTURNIER_EINLADUNG) inviteHallenturnier();
    if (game.matchday === HALLENTURNIER_SPIELTAG) playHallenturnier();
}

function renderSeasonEventsBox() {
    const box = document.getElementById('dash-season-events-box');
    if (!box) return;
    const teile = [];
    if (isSeasonOpeningOpen()) {
        const skala = seasonEventScale();
        teile.push(`🎉 <strong>Saisoneröffnung</strong> - wie startet ihr in die Saison?
            <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">${Object.entries(SEASON_OPENING_OPTIONS).map(([k, o]) => {
                const betrag = Math.round(o.kosten * skala / 500) * 500;
                const geld = betrag > 0 ? ` (-${formatVal(betrag)})` : (betrag < 0 ? ` (+${formatVal(-betrag)})` : '');
                return `<button onclick="chooseSeasonOpening('${k}')" class="btn-secondary" style="font-size:10px; text-align:left;">${o.label}${geld}<br><span style="font-size:9px; color:var(--text-muted);">${o.text}</span></button>`;
            }).join('')}</div>`);
    }
    const sc = getOwnSupercupTie();
    if (sc) teile.push(`🏆 <strong>Supercup</strong>: ${sc.home} - ${sc.away} vor dem 1. Spieltag (Prämie ${formatVal(SUPERCUP_PRAEMIE)}).`);
    const h = game.hallenturnier;
    if (h && h.season === game.season) {
        if (h.status === 'eingeladen') {
            teile.push(`🏟️ <strong>Hallenmasters</strong> nach dem ${HALLENTURNIER_SPIELTAG}. Spieltag gegen ${h.gegner.join(', ')}. Prämie ab ${formatVal(Math.round(15000 * seasonEventScale() / 500) * 500)}, kleines Verletzungsrisiko.
                <div style="display:flex; gap:6px; margin-top:4px;"><button onclick="respondHallenturnier(true)" class="btn-action">✔ Zusagen</button><button onclick="respondHallenturnier(false)" class="btn-secondary">✖ Absagen</button></div>`);
        } else if (h.status === 'zugesagt') {
            teile.push(`🏟️ Hallenmasters nach dem ${HALLENTURNIER_SPIELTAG}. Spieltag: zugesagt.`);
        } else if (h.status === 'gespielt' && game.matchday <= HALLENTURNIER_SPIELTAG + 2) {
            teile.push(`🏟️ Hallenmasters: Sieger ${h.sieger}${h.sieger === game.clubName ? ' 🏆' : ''} · Prämie ${formatVal(h.praemie || 0)}`);
        }
    }
    getOpenFarewellMatches().forEach(f => {
        teile.push(`👋 <strong>Abschiedsspiel</strong> für ${f.name}${f.tier ? ' (Vereinslegende)' : ''} - volles Haus, Einnahmen fürs Stadion.
            <div style="margin-top:4px;"><button onclick="holdFarewellMatch('${f.name.replace(/'/g, "\\'")}')" class="btn-action">👋 Abschiedsspiel ausrichten</button></div>`);
    });
    box.innerHTML = teile.map(t => `<div class="box" style="font-size:10px; border-left-color:var(--gold); margin-bottom:6px;">${t}</div>`).join('');
}
