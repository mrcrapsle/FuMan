// Stadion-Werkzeuge (Phase 26.21): Fans ohne Karte, Rendite je Ausbau, Bau-Chronik und
// Topspiel-Zuschlag. Alles liest die echten Heimspiel-Daten aus game.attendanceHistory
// (Nachfrage und Fans ohne Karte schreibt applyMatchdayFinances() in js/match-live.js).

const TOPSPIEL_STUFEN = [0, 10, 20, 30];
const BAU_CHRONIK_MAX = 60;

function getHeimspieleJeSaison() {
    const teams = (leaguesData[game.leagueLevel] || []).length || 18;
    return Math.max(1, teams - 1);
}

function stadionZahl(n) { return Math.round(n || 0).toLocaleString('de-DE'); }

function stadionSaisons(j) {
    if (j === null || !isFinite(j)) return '–';
    if (j < 1) return 'unter 1 Saison';
    const r = Math.round(j * 10) / 10;
    return `${r.toLocaleString('de-DE')} ${r === 1 ? 'Saison' : 'Saisons'}`;
}

// ---------- Fans ohne Karte ----------
function getFansOhneKarte() {
    const alle = Array.isArray(game.attendanceHistory) ? game.attendanceHistory : [];
    const letzte = alle.length ? alle[alle.length - 1] : null;
    const saison = alle.filter(e => e && e.season === game.season && e.nachfrage !== undefined);
    let serie = 0;
    for (let i = alle.length - 1; i >= 0; i--) {
        const e = alle[i];
        if (e && e.capacity > 0 && e.attendance >= e.capacity) serie++;
        else break;
    }
    return {
        erfasst: !!(letzte && letzte.nachfrage !== undefined),
        letztes: letzte ? (letzte.ohneKarte || 0) : 0,
        gegner: letzte ? letzte.opponent : '',
        saison: saison.reduce((s, e) => s + (e.ohneKarte || 0), 0),
        saisonSpiele: saison.length,
        ausverkauft: saison.filter(e => e.capacity > 0 && e.attendance >= e.capacity).length,
        serie
    };
}

function renderFansOhneKarte() {
    const f = getFansOhneKarte();
    if (!f.erfasst) {
        return `<div class="box" style="margin-top:4px;"><div class="ui-overline">Fans ohne Karte</div>
            <div style="font-size:var(--fs-caption); color:var(--text-muted);">Wird ab dem nächsten Heimspiel erfasst: wie viele Fans wegen eines vollen Stadions draußen bleiben.</div></div>`;
    }
    return `<div class="box" id="stadium-fans-ohne-karte" style="margin-top:4px;">
        <div class="ui-overline">Fans ohne Karte</div>
        <div style="font-size:var(--fs-title); font-weight:900; color:${f.letztes > 0 ? 'var(--danger)' : 'var(--text-main)'};">${stadionZahl(f.letztes)}</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:2px;">
            Letztes Heimspiel${f.gegner ? ` gegen ${mpEsc(f.gegner)}` : ''}. Diese Saison: ${stadionZahl(f.saison)} in ${f.saisonSpiele} ${f.saisonSpiele === 1 ? 'Heimspiel' : 'Heimspielen'}, ${f.ausverkauft}× ausverkauft.
            ${f.serie > 1 ? `Ausverkauft in Folge: ${f.serie} Heimspiele.` : ''}
            ${f.saison > 0 ? 'Mehr Plätze würden sich hier füllen, siehe Rendite beim Ausbau.' : 'Bisher hat jeder Interessent eine Karte bekommen.'}
        </div>
    </div>`;
}

// ---------- Rendite je Ausbau ----------
// Grundlage sind die Heimspiele dieser Saison (ab drei Spielen), sonst die letzten einer Saison.
function getNachfrageBasis() {
    const liste = (Array.isArray(game.attendanceHistory) ? game.attendanceHistory : []).filter(e => e && e.nachfrage !== undefined);
    const saison = liste.filter(e => e.season === game.season);
    return saison.length >= 3 ? saison : liste.slice(-getHeimspieleJeSaison());
}

function getTicketErloesJeZuschauer() {
    return (stadium.stehShare ?? 0.5) * game.ticketPrices.steh + (stadium.sitzShare ?? 0.45) * game.ticketPrices.sitz;
}

// Zusätzliche Plätze füllen sich nur mit Fans, die bisher keine Karte bekamen. Gerechnet wird
// der Ticketerlös gegen den Unterhalt der neuen Plätze (wie getStadiumBaseMaintenance()).
function getPlatzRendite(plaetze, kosten) {
    const basis = getNachfrageBasis();
    if (!basis.length || plaetze <= 0) return { basis: basis.length, zusatz: 0, mehr: 0, unterhalt: 0, netto: 0, jahre: null };
    const zusatz = basis.reduce((s, e) => s + Math.min(plaetze, e.ohneKarte || 0), 0) / basis.length;
    const heim = getHeimspieleJeSaison();
    const mehr = Math.round(zusatz * getTicketErloesJeZuschauer() * heim);
    const genutzt = Math.min(plaetze, zusatz * 1.15);
    let unterhalt = (genutzt + (plaetze - genutzt) * MOTHBALLED_MAINTENANCE_RATE) * STADIUM_MAINTENANCE_PER_SEAT * heim * 2;
    if (stadium.upgrades && stadium.upgrades.solaranlage) unterhalt *= 0.8;
    unterhalt = Math.round(unterhalt);
    const netto = mehr - unterhalt;
    return { basis: basis.length, zusatz: Math.round(zusatz), mehr, unterhalt, netto, jahre: netto > 0 ? kosten / netto : null };
}

function renderPlatzRendite(plaetze, kosten) {
    const r = getPlatzRendite(plaetze, kosten);
    let text;
    if (!r.basis) text = '📊 Rendite: noch keine erfassten Heimspiele.';
    else if (r.zusatz <= 0) text = `📉 Keine Fans ohne Karte in den letzten ${r.basis} Heimspielen: mehr Plätze bringen derzeit keine Mehreinnahmen.`;
    else if (r.netto <= 0) text = `📉 Rund +${stadionZahl(r.zusatz)} Zuschauer je Heimspiel, aber der Unterhalt (${formatVal(r.unterhalt)}) frisst den Ticketerlös (${formatVal(r.mehr)}) je Saison.`;
    else text = `📈 Rund +${stadionZahl(r.zusatz)} Zuschauer je Heimspiel, +${formatVal(r.netto)} je Saison nach Unterhalt. Amortisiert in ${stadionSaisons(r.jahre)}.`;
    return `<div class="stadium-rendite" style="font-size:var(--fs-caption); color:var(--text-muted); margin:2px 0 4px;">${text}</div>`;
}

function getUpgradeRendite(key) {
    const u = typeof STADIUM_UPGRADES !== 'undefined' ? STADIUM_UPGRADES[key] : null;
    if (!u || u.category !== 'income') return null;
    const jeSpiel = Math.round(u.incomeBase * getStadiumCostScale());
    const jeSaison = jeSpiel * getHeimspieleJeSaison();
    const kosten = getStadiumUpgradeCost(key);
    return { jeSpiel, jeSaison, jahre: jeSaison > 0 ? kosten / jeSaison : null };
}

function renderUpgradeRendite(key) {
    const r = getUpgradeRendite(key);
    if (!r) return '';
    return `<div class="stadium-rendite" style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:4px;">📈 +${formatVal(r.jeSpiel)} je Heimspiel, ${formatVal(r.jeSaison)} je Saison. Amortisiert in ${stadionSaisons(r.jahre)}.</div>`;
}

// ---------- Bau-Chronik ----------
// Aus tickStadiumConstruction(): jedes fertige Bauprojekt außer Weiterbildungen.
function merkeBauChronik(proj) {
    if (!proj || proj.type === 'staffTraining') return;
    if (!Array.isArray(game.bauChronik)) game.bauChronik = [];
    game.bauChronik.push({ season: game.season, matchday: game.matchday, label: proj.label || 'Bauprojekt', cost: proj.totalCost || 0, type: proj.type });
    if (game.bauChronik.length > BAU_CHRONIK_MAX) game.bauChronik.shift();
}

function renderBauChronik() {
    const box = document.getElementById('stadium-chronik-box');
    if (!box) return;
    const liste = Array.isArray(game.bauChronik) ? game.bauChronik : [];
    if (!liste.length) {
        box.innerHTML = '<div style="font-size:var(--fs-caption); color:var(--text-muted);">Noch kein Bauprojekt abgeschlossen. Fertige Ausbauten erscheinen hier mit Saison, Spieltag und Kosten.</div>';
        return;
    }
    const summe = liste.reduce((s, e) => s + (e.cost || 0), 0);
    const saisons = new Set(liste.map(e => e.season)).size;
    box.innerHTML = `
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">
            ${uiChip(`${liste.length} ${liste.length === 1 ? 'Projekt' : 'Projekte'}`)}
            ${uiChip(`${formatVal(summe)} verbaut`)}
            ${uiChip(`${saisons} ${saisons === 1 ? 'Saison' : 'Saisons'}`)}
        </div>
        ${liste.slice().reverse().map(e => `
            <div class="box" style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:3px; font-size:var(--fs-caption);">
                <span><span style="color:var(--text-muted);">S${e.season} · SpT ${e.matchday}</span> ${mpEsc(e.label)}</span>
                <strong style="color:var(--gold); white-space:nowrap;">${formatVal(e.cost || 0)}</strong>
            </div>`).join('')}`;
}

// ---------- Topspiel-Zuschlag ----------
// Derby oder Gegner auf Platz 1 bis 3 (ab dem 4. Spieltag, vorher sagt die Tabelle nichts).
function getTopspielGrund(gegner) {
    if (!gegner || gegner === game.clubName) return '';
    if (typeof isDerbyOpponent === 'function' && isDerbyOpponent(gegner)) return 'Derby';
    if (game.matchday > 3 && typeof sortedTable === 'function') {
        const platz = sortedTable(game.leagueLevel).findIndex(t => t.name === gegner) + 1;
        if (platz >= 1 && platz <= 3) return `Platz ${platz}`;
    }
    return '';
}

function getTopspielStufe() {
    return TOPSPIEL_STUFEN.includes(game.topspielZuschlag) ? game.topspielZuschlag : 0;
}

function getTopspielPreisMult(gegner) {
    const pct = getTopspielStufe();
    if (!pct || !getTopspielGrund(gegner)) return 1;
    return 1 + pct / 100;
}

function setTopspielZuschlag(pct) {
    if (!TOPSPIEL_STUFEN.includes(pct)) { showToast('Diese Stufe gibt es nicht.', 'error'); return; }
    game.topspielZuschlag = pct;
    showToast(pct ? `🔥 Topspiel-Zuschlag: +${pct} % bei Derbys und Heimspielen gegen die Top 3.` : 'Topspiel-Zuschlag ausgeschaltet: überall normale Preise.', 'success');
    renderTopspielBox();
}

function getNaechstesTopspiel() {
    const liga = leaguesData[game.leagueLevel] || [];
    const plan = (typeof fixturesData !== 'undefined' && fixturesData[game.leagueLevel]) || [];
    for (let md = Math.max(1, game.matchday); md <= plan.length; md++) {
        const f = (plan[md - 1] || []).find(x => liga[x.home] && liga[x.home].name === game.clubName);
        if (!f || f.played || !liga[f.away]) continue;
        const grund = getTopspielGrund(liga[f.away].name);
        if (grund) return { md, gegner: liga[f.away].name, grund };
    }
    return null;
}

// Dieselbe Erlösformel wie in applyMatchdayFinances(), ohne Zufall und Sonderbuchungen.
function schaetzeTicketErloes(zuschauer, preisMult) {
    const dauerkarten = typeof getSeasonTicketAttendanceFloor === 'function' ? Math.min(zuschauer, getSeasonTicketAttendanceFloor()) : 0;
    const zahlende = Math.max(0, zuschauer - dauerkarten);
    const vip = Math.min(stadium.vipTotal || 50, Math.round(zahlende * (stadium.vipShare ?? 0.05)));
    return Math.round((zahlende * getTicketErloesJeZuschauer() + vip * game.ticketPrices.vip) * preisMult);
}

function renderTopspielBox() {
    const box = document.getElementById('stadium-topspiel-box');
    if (!box) return;
    const stufe = getTopspielStufe();
    const knoepfe = TOPSPIEL_STUFEN.map(p => `<button onclick="setTopspielZuschlag(${p})" class="${p === stufe ? 'btn-action' : 'btn-secondary'}" aria-pressed="${p === stufe}" style="font-size:var(--fs-caption);">${p ? `+${p} %` : 'Aus'}</button>`).join('');
    const naechstes = getNaechstesTopspiel();
    let vorschau = '<div style="font-size:var(--fs-caption); color:var(--text-muted);">Nach heutigem Tabellenstand steht kein Topspiel mehr im Heimplan dieser Saison.</div>';
    if (naechstes) {
        const boost = naechstes.grund === 'Derby' ? 2.2 : 1;
        const mult = stufe ? 1 + stufe / 100 : 1;
        const ohne = calculateMatchAttendanceDetails(boost, 1, 1);
        const mit = calculateMatchAttendanceDetails(boost, 1, mult);
        vorschau = `<div class="box" style="font-size:var(--fs-caption);">
            <div><strong>Nächstes Topspiel:</strong> SpT ${naechstes.md} gegen ${mpEsc(naechstes.gegner)} (${naechstes.grund})</div>
            <div style="color:var(--text-muted); margin-top:2px;">Normalpreis: ~${stadionZahl(ohne.zuschauer)} Zuschauer, ~${formatVal(schaetzeTicketErloes(ohne.zuschauer, 1))} Ticketerlös${ohne.ohneKarte > 0 ? `, ${stadionZahl(ohne.ohneKarte)} ohne Karte` : ''}.</div>
            ${stufe ? `<div style="color:var(--text-muted);">Mit +${stufe} %: ~${stadionZahl(mit.zuschauer)} Zuschauer, ~${formatVal(schaetzeTicketErloes(mit.zuschauer, mult))} Ticketerlös.</div>` : ''}
        </div>`;
    }
    const saison = (Array.isArray(game.attendanceHistory) ? game.attendanceHistory : []).filter(e => e && e.season === game.season && e.zuschlag);
    const mehr = saison.reduce((s, e) => s + (e.zuschlagErloes || 0), 0);
    box.innerHTML = `
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Bei Derbys und Heimspielen gegen die Top 3 der Tabelle (ab dem 4. Spieltag) steigen alle Ticketpreise um den Aufschlag. Zu teure Karten schrecken Zuschauer ab, wie bei den normalen Preisen. Am meisten bringt der Zuschlag, wenn das Stadion ohnehin ausverkauft ist.</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 5em), 1fr)); gap:4px; margin-bottom:6px;">${knoepfe}</div>
        ${vorschau}
        ${saison.length ? `<div style="font-size:var(--fs-caption); margin-top:4px;">Diese Saison: ${saison.length} ${saison.length === 1 ? 'Topspiel' : 'Topspiele'} mit Zuschlag, Aufschlag auf verkaufte Karten ${formatVal(mehr)}.</div>` : ''}`;
}
