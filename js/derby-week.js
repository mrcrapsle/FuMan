/* eslint-disable no-undef */
// Derby-Woche (Phase 21.1): ab 3 Spieltagen vor dem Ligaspiel gegen den Erzrivalen
// erscheint die Karte #dash-derby-box. Vorbereitungen (je einmal pro Derby, game.derbyWeek):
// - Stimmung: Heim-Choreo bzw. Sonderzug auswärts - +1,5 Stärke, die Choreo erhöht aber
//   das Ausschreitungsrisiko (Pyro), der Sonderzug bindet die Fans (+2 nach dem Spiel).
// - Sicherheitskonzept (nur Heim): Ausschreitungsrisiko x0,35.
// - Derby-Prämie: Moral +5 sofort, gezahlt nur bei Sieg (2 Spieltagsgehälter der Startelf),
//   bei Niederlage drückt der Druck zusätzlich auf die Moral.
// - Presse: Kampfansage (+1 Stärke, bei Sieg Medien/Fans hoch, bei Niederlage runter) oder
//   Respekt (Risiko x0,7, keine Fallhöhe).
// Bonus nur am Derby-Spieltag: Simulation/Scout über getOwnLeagueMatchStrength(), Livespiel
// über applyDerbyPreparation() in setupMatch(). Abschluss in resolveDerbyWeek() (aus
// recordRivalryResult, alle drei Spieltagswege), Chronik in game.derbyHistory.

const DERBY_WEEK_LEAD = 3;
// Kosten nach Liga (0 = Bundesliga ... 5 = Landesliga)
const DERBY_COSTS = [
    { stimmung: 120000, sicherheit: 90000 },
    { stimmung: 60000, sicherheit: 45000 },
    { stimmung: 25000, sicherheit: 18000 },
    { stimmung: 12000, sicherheit: 9000 },
    { stimmung: 6000, sicherheit: 4500 },
    { stimmung: 3000, sicherheit: 2500 }
];

function isDerbyOpponent(name) {
    if (!name) return false;
    return name === game.permanentRivalName || name === (typeof getOurRivalName === 'function' ? getOurRivalName() : null);
}

function getDerbyCosts() { return DERBY_COSTS[game.leagueLevel] || DERBY_COSTS[DERBY_COSTS.length - 1]; }

// Nächstes eigenes Ligaspiel gegen den Rivalen in den kommenden DERBY_WEEK_LEAD Spieltagen.
function getUpcomingDerby() {
    const liga = leaguesData[game.leagueLevel] || [];
    const plan = fixturesData[game.leagueLevel] || [];
    for (let md = game.matchday; md <= Math.min(34, game.matchday + DERBY_WEEK_LEAD); md++) {
        const tag = plan[md - 1] || [];
        for (const f of tag) {
            const h = liga[f.home], a = liga[f.away];
            if (!h || !a || f.played) continue;
            if (h.name === game.clubName && isDerbyOpponent(a.name)) return { matchday: md, home: true, opp: a.name, inDays: md - game.matchday };
            if (a.name === game.clubName && isDerbyOpponent(h.name)) return { matchday: md, home: false, opp: h.name, inDays: md - game.matchday };
        }
    }
    return null;
}

function getDerbyWeekState() {
    const d = getUpcomingDerby();
    if (!d) return null;
    const w = game.derbyWeek;
    if (w && w.season === game.season && w.matchday === d.matchday && w.opp === d.opp) return w;
    game.derbyWeek = { season: game.season, matchday: d.matchday, opp: d.opp, home: d.home, stimmung: false, sicherheit: false, praemie: false, presse: null, resolved: false };
    return game.derbyWeek;
}

// Aktive Vorbereitung NUR am Derby-Spieltag gegen genau diesen Gegner.
function getActiveDerbyWeek(oppName) {
    const w = game.derbyWeek;
    if (!w || w.resolved || w.season !== game.season || w.matchday !== game.matchday) return null;
    if (oppName && w.opp !== oppName) return null;
    return w;
}

function getDerbyBonus(oppName) {
    const w = getActiveDerbyWeek(oppName);
    if (!w) return 0;
    return (w.stimmung ? 1.5 : 0) + (w.presse === 'kampf' ? 1 : 0);
}

// Faktor für checkHooliganIncident() (Heim-Derby). Läuft NACH resolveDerbyWeek() im selben
// Spieltag, daher ohne die resolved-Sperre.
function getDerbyRiskFactor() {
    const w = game.derbyWeek;
    if (!w || !w.home || w.season !== game.season || w.matchday !== game.matchday) return 1;
    let f = 1;
    if (w.stimmung) f *= 1.3;   // Pyro in der Choreo
    if (w.sicherheit) f *= 0.35;
    if (w.presse === 'respekt') f *= 0.7;
    return f;
}

function derbySpend(betrag, label) {
    if (game.money < betrag) { showToast(`Nicht genug Geld: ${formatVal(betrag)} nötig.`, 'error'); return false; }
    setzeBuchungskontext(label);
    game.money -= betrag;
    loescheBuchungskontext();
    return true;
}

function getDerbyPremiumAmount() {
    const elf = squad.filter(p => (lineup || []).includes(p.id));
    return Math.round(elf.reduce((a, p) => a + (p.wage || 0), 0) * 2 / 100) * 100;
}

function chooseDerbyMood() {
    const w = getDerbyWeekState();
    if (!w) { showToast('Gerade steht kein Derby an.', 'error'); return; }
    if (w.stimmung) { showToast(w.home ? 'Die Choreo ist schon bestellt.' : 'Der Sonderzug ist schon gebucht.', 'error'); return; }
    if (!derbySpend(getDerbyCosts().stimmung, w.home ? '🔥 Derby-Choreo' : '🚂 Derby-Sonderzug')) return;
    w.stimmung = true;
    showToast(w.home ? '🔥 Choreo bestellt: +1,5 Stärke im Derby - aber Pyro erhöht das Ausschreitungsrisiko.' : '🚂 Sonderzug gebucht: +1,5 Stärke, die Fans danken es dir.', 'success', 4000);
    updateUI(); renderDerbyWeekCard();
}

function chooseDerbySecurity() {
    const w = getDerbyWeekState();
    if (!w) { showToast('Gerade steht kein Derby an.', 'error'); return; }
    if (!w.home) { showToast('Auswärts sorgt der Gastgeber für die Sicherheit.', 'error'); return; }
    if (w.sicherheit) { showToast('Das Sicherheitskonzept steht schon.', 'error'); return; }
    if (!derbySpend(getDerbyCosts().sicherheit, '🛡️ Derby-Sicherheitskonzept')) return;
    w.sicherheit = true;
    showToast('🛡️ Sicherheitskonzept steht: Ausschreitungsrisiko deutlich gesenkt.', 'success', 3500);
    updateUI(); renderDerbyWeekCard();
}

function chooseDerbyPremium() {
    const w = getDerbyWeekState();
    if (!w) { showToast('Gerade steht kein Derby an.', 'error'); return; }
    if (w.praemie) { showToast('Die Prämie ist schon ausgelobt.', 'error'); return; }
    w.praemie = getDerbyPremiumAmount();
    squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 5); });
    showToast(`💰 Derby-Prämie ausgelobt (${formatVal(w.praemie)} nur bei Sieg): Moral +5 - verlieren wäre jetzt doppelt bitter.`, 'success', 4500);
    updateUI(); renderDerbyWeekCard();
}

function chooseDerbyPress(art) {
    const w = getDerbyWeekState();
    if (!w) { showToast('Gerade steht kein Derby an.', 'error'); return; }
    if (w.presse) { showToast('Deine Worte zum Derby sind schon gefallen.', 'error'); return; }
    if (art !== 'kampf' && art !== 'respekt') return;
    w.presse = art;
    showToast(art === 'kampf' ? '🎙️ Kampfansage: +1 Stärke - bei einer Niederlage wird es ungemütlich.' : '🎙️ Respekt vor dem Rivalen: die Lage bleibt ruhiger.', 'success', 3500);
    renderDerbyWeekCard();
}

// Livespiel (setupMatch): Bonus auf die eingefrorene Basisstärke.
function applyDerbyPreparation(oppName) {
    if (!currentMatch || currentMatch.isCup) return;
    const bonus = getDerbyBonus(oppName);
    if (bonus <= 0) return;
    currentMatch.ourBaseStr += bonus;
    if (currentMatch.isHome) currentMatch.homeStr += bonus; else currentMatch.awayStr += bonus;
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += `<div style="color:var(--danger);">🔥 Derbystimmung: Die Vorbereitung bringt +${String(bonus).replace('.', ',')} Stärke.</div>`;
}

// Aus recordRivalryResult(): Folgen des Derbys, mit oder ohne Vorbereitung.
function resolveDerbyWeek(opponentName, ourGoals, oppGoals) {
    const w = getActiveDerbyWeek(opponentName);
    const sieg = ourGoals > oppGoals, niederlage = ourGoals < oppGoals;
    const folgen = [];
    const fansPlus = n => { game.fans = Math.min(100, game.fans + n); };
    const fansMinus = n => { game.fans = Math.max(game.fanBaseFloor || 0, game.fans - n); };
    const medien = n => { if (typeof changeMediaImage === 'function') changeMediaImage(n); else game.managerMediaImage = Math.max(0, Math.min(100, (game.managerMediaImage ?? 50) + n)); };
    // Grundstimmung: ein Derby zählt für die Fans doppelt.
    if (sieg) { fansPlus(2); folgen.push('Fans +2'); }
    if (niederlage) { fansMinus(2); folgen.push('Fans -2'); }
    if (w) {
        if (w.stimmung && !w.home) { fansPlus(2); folgen.push('Sonderzug: Fans +2'); }
        if (w.praemie) {
            if (sieg) {
                setzeBuchungskontext('💰 Derby-Prämie');
                game.money -= w.praemie;
                loescheBuchungskontext();
                folgen.push(`Prämie ${formatVal(w.praemie)} gezahlt`);
            } else if (niederlage) {
                squad.forEach(p => { p.morale = Math.max(0, (p.morale || 50) - 4); });
                folgen.push('Prämie verfehlt: Moral -4');
            }
        }
        if (w.presse === 'kampf') {
            if (sieg) { medien(3); fansPlus(2); folgen.push('Kampfansage eingelöst: Medien +3, Fans +2'); }
            if (niederlage) { medien(-4); fansMinus(3); game.boardSat = Math.max(0, game.boardSat - 2); folgen.push('Kampfansage verpufft: Medien -4, Fans -3, Vorstand -2'); }
        }
        w.resolved = true;
    }
    const prep = w ? [w.stimmung ? (w.home ? 'Choreo' : 'Sonderzug') : null, w.sicherheit ? 'Sicherheit' : null, w.praemie ? 'Prämie' : null,
        w.presse === 'kampf' ? 'Kampfansage' : (w.presse === 'respekt' ? 'Respekt' : null)].filter(Boolean) : [];
    if (!game.derbyHistory) game.derbyHistory = [];
    game.derbyHistory.unshift({ season: game.season, matchday: game.matchday, opp: opponentName, home: w ? w.home : null,
        score: `${ourGoals}:${oppGoals}`, result: sieg ? 'S' : (niederlage ? 'N' : 'U'), prep, effects: folgen });
    if (game.derbyHistory.length > 20) game.derbyHistory.length = 20;
    return folgen;
}

function renderDerbyWeekCard() {
    const box = document.getElementById('dash-derby-box');
    if (!box) return;
    const d = getUpcomingDerby();
    if (!d) { box.innerHTML = ''; return; }
    const w = getDerbyWeekState();
    const k = getDerbyCosts();
    const bilanz = typeof rivalryRecord !== 'undefined' ? `${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N` : '-';
    const wann = d.inDays === 0 ? 'heute' : `in ${d.inDays} Spieltag${d.inDays > 1 ? 'en' : ''}`;
    const knopf = (fn, text, fertig) => `<button onclick="${fn}" class="${fertig ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:5px 3px;">${fertig ? '✔ ' : ''}${text}</button>`;
    const stimmungText = d.home ? `🔥 Choreo (${formatVal(k.stimmung)})` : `🚂 Sonderzug (${formatVal(k.stimmung)})`;
    const praemie = w.praemie ? `💰 Prämie ${formatVal(w.praemie)}` : `💰 Siegprämie (~${formatVal(getDerbyPremiumAmount())})`;
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--danger);">🔥 <strong>Derby-Woche:</strong> ${wann} ${d.home ? 'zu Hause' : 'auswärts'} gegen <strong>${d.opp}</strong> · Bilanz ${bilanz}
        <div style="color:var(--text-muted); margin-top:2px;">Ein Derby zählt für die Fans doppelt (Sieg +2, Niederlage -2). Die Vorbereitung wirkt nur am Derby-Spieltag.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:4px;">
            ${knopf('chooseDerbyMood()', stimmungText, w.stimmung)}
            ${d.home ? knopf('chooseDerbySecurity()', `🛡️ Sicherheit (${formatVal(k.sicherheit)})`, w.sicherheit) : '<div style="font-size:9px; color:var(--text-muted); align-self:center;">🛡️ Sicherheit: Sache des Gastgebers</div>'}
            ${knopf('chooseDerbyPremium()', praemie, !!w.praemie)}
            ${w.presse ? knopf(`chooseDerbyPress('${w.presse}')`, w.presse === 'kampf' ? '🎙️ Kampfansage' : '🎙️ Respekt', true) : `<div style="display:grid; grid-template-columns:1fr 1fr; gap:3px;">${knopf("chooseDerbyPress('kampf')", '🎙️ Kampf', false)}${knopf("chooseDerbyPress('respekt')", '🎙️ Respekt', false)}</div>`}
        </div>
        <div style="color:var(--text-muted); margin-top:3px; font-size:9px;">Choreo/Sonderzug +1,5 Stärke (Choreo: Pyro-Risiko) · Sicherheit: Ausschreitungsrisiko x0,35 · Prämie: Moral +5, nur bei Sieg fällig, Niederlage Moral -4 · Kampfansage +1 Stärke mit Fallhöhe, Respekt beruhigt.</div></div>`;
}

// Historie > Rivalen: die letzten Derbys mit Vorbereitung und Folgen.
function renderDerbyHistory() {
    const box = document.getElementById('derby-history-box');
    if (!box) return;
    const liste = game.derbyHistory || [];
    if (!liste.length) { box.innerHTML = '<div style="font-size:10px; color:var(--text-muted);">Noch kein Derby gespielt.</div>'; return; }
    const farbe = { S: 'var(--primary)', U: 'var(--text-muted)', N: 'var(--danger)' };
    box.innerHTML = liste.map(e => `<div class="box" style="font-size:10px;"><strong style="color:${farbe[e.result]};">${e.score}</strong> gegen ${e.opp} · Saison ${e.season}, Spieltag ${e.matchday}${e.home === null ? '' : (e.home ? ' (Heim)' : ' (Auswärts)')}
        <div style="color:var(--text-muted);">${e.prep.length ? 'Vorbereitung: ' + e.prep.join(', ') : 'ohne Vorbereitung'}${e.effects.length ? ' · ' + e.effects.join(', ') : ''}</div></div>`).join('');
}
