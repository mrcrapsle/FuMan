// ============================================================================
// MANAGER-WERKZEUGE (Phase 26.4): Liquiditäts-Vorschau, Konto-Alarm, Spieler-Etiketten,
// Manager-Assistent im Dashboard und die Lizenz-Laufbahn. Alles liest echte Spieldaten;
// geschrieben werden nur die eigenen Einstellungen (Alarm-Grenze, Etiketten) - und die
// Lizenz-Laufbahn beschränkt, wann die nächste Trainerlizenz gekauft werden darf.
// ============================================================================

// ---------- Liquiditäts-Vorschau ----------

// Aus der Spieltagsabrechnung (game.financeLedger): Ø Einnahmen minus Ausgaben der letzten Spieltage.
// Einmalige Käufe, Bauten und Gehälter außerhalb der Abrechnung sind darin NICHT enthalten.
function getLiquidityForecast() {
    const alle = game.financeLedger || [];
    const dieseSaison = alle.filter(e => e.season === game.season);
    const basis = (dieseSaison.length >= 3 ? dieseSaison : alle).slice(-6);
    const netto = e => (e.summeEin || 0) - (e.summeAus || 0);
    const mw = a => a.length ? a.reduce((s, e) => s + netto(e), 0) / a.length : null;
    const avg = mw(basis);
    const rest = Math.max(0, 34 - (game.matchday - 1));
    const punkte = [5, 10].map(k => ({ k, spt: Math.min(k, rest), wert: avg === null ? null : Math.round(game.money + avg * Math.min(k, rest)) }));
    let minusIn = null;
    if (avg !== null && avg < 0 && game.money >= 0) minusIn = Math.floor(game.money / -avg) + 1;
    return { kasse: game.money, avg: avg === null ? null : Math.round(avg), avgHeim: (() => { const m = mw(basis.filter(e => e.heimspiel)); return m === null ? null : Math.round(m); })(),
        avgAusw: (() => { const m = mw(basis.filter(e => !e.heimspiel)); return m === null ? null : Math.round(m); })(), n: basis.length, rest, punkte, minusIn };
}

function renderLiquidityBox() {
    const box = document.getElementById('fin-liquidity-box');
    if (!box) return;
    const f = getLiquidityForecast();
    const alarm = financeCentralState.kontoAlarm || 0;
    let inhalt;
    if (f.avg === null) {
        inhalt = '<div class="box" style="font-size:var(--fs-small); color:var(--text-muted);">Noch keine Spieltagsabrechnung: die Vorschau erscheint nach dem ersten Spiel.</div>';
    } else {
        const farbe = w => (w === null ? '' : (w < 0 ? 'schlecht' : (alarm > 0 && w < alarm ? 'warn' : 'gut')));
        inhalt = `<div class="ui-card-meta" style="margin-bottom:6px;">
                ${uiChip(`💶 Kasse ${formatVal(f.kasse)}`, f.kasse < 0 ? 'schlecht' : '')}
                ${uiChip(`Ø ${f.avg >= 0 ? '+' : ''}${formatVal(f.avg)} je Spieltag`, f.avg >= 0 ? 'gut' : 'schlecht')}
                ${f.avgHeim !== null ? uiChip(`Heim Ø ${formatVal(f.avgHeim)}`) : ''}${f.avgAusw !== null ? uiChip(`Auswärts Ø ${formatVal(f.avgAusw)}`) : ''}
            </div>
            ${f.punkte.map(p => `<div class="box" style="font-size:var(--fs-small); margin:4px 0; display:flex; justify-content:space-between; gap:8px;"><span>In ${p.spt} Spieltag${p.spt === 1 ? '' : 'en'}</span><strong>${p.wert === null ? '–' : uiChip(formatVal(p.wert), farbe(p.wert))}</strong></div>`).join('')}
            ${f.minusIn ? `<div class="box" style="font-size:var(--fs-small); border-left-color:var(--danger);">⚠️ Bei diesem Schnitt rutscht das Konto in etwa ${f.minusIn} Spieltagen ins Minus.</div>` : ''}
            <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:4px;">Grundlage: die letzten ${f.n} Spieltagsabrechnungen. Einmalige Käufe, Bauten und Handgelder sind nicht eingerechnet.</div>`;
    }
    box.innerHTML = `<div class="panel-header">🔮 Liquiditäts-Vorschau</div>${inhalt}
        <div style="margin-top:8px; border-top:1px solid var(--border); padding-top:8px;">
            <label class="ui-field"><span class="ui-field-label">Konto-Alarm: Meldung, wenn die Kasse unter diese Grenze fällt${alarm > 0 ? ` (aktiv bei ${formatVal(alarm)})` : ' (aus)'}</span>
                <input id="konto-alarm-input" type="number" min="0" step="1000" class="input-inline" style="width:100%;" placeholder="Grenze in €, z. B. 50000"></label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px;">
                <button onclick="setKontoAlarm()" class="btn-action">🔔 Alarm setzen</button>
                <button onclick="clearKontoAlarm()" class="btn-secondary"${alarm > 0 ? '' : ' disabled'}>🔕 Alarm aus</button>
            </div>
        </div>`;
}

// ---------- Konto-Alarm ----------

function setKontoAlarm() {
    const feld = document.getElementById('konto-alarm-input');
    const wert = feld ? Math.round(Number(feld.value)) : 0;
    if (!(wert > 0)) { showToast('Gib eine Grenze über 0 € ein, zum Beispiel 50.000.', 'error', 3500); return; }
    financeCentralState.kontoAlarm = wert;
    financeCentralState.kontoAlarmGemeldet = game.money < wert;
    financeCentralState.kontoAlarmVorwarnung = false;
    showToast(`🔔 Konto-Alarm bei unter ${formatVal(wert)} eingestellt.`, 'success');
    renderLiquidityBox();
}
function clearKontoAlarm() {
    financeCentralState.kontoAlarm = 0;
    financeCentralState.kontoAlarmGemeldet = false;
    financeCentralState.kontoAlarmVorwarnung = false;
    showToast('🔕 Konto-Alarm ausgeschaltet.', 'success');
    renderLiquidityBox();
}

// Nach jeder Spieltagsabrechnung: Meldung beim Unterschreiten (einmal), Vorwarnung 3 Spieltage vorher (einmal)
function checkKontoAlarm() {
    const grenze = financeCentralState.kontoAlarm || 0;
    if (!(grenze > 0)) return;
    if (game.money < grenze) {
        if (!financeCentralState.kontoAlarmGemeldet) {
            financeCentralState.kontoAlarmGemeldet = true;
            addInboxMessage('finanzen', '🔔 Konto-Alarm: Kasse unter deiner Grenze', `Die Kasse liegt bei ${formatVal(game.money)} und damit unter deiner Alarmgrenze von ${formatVal(grenze)}. Im Minus gilt eine Transfersperre, anhaltende Verluste bestraft das Financial Fairplay.`, 'screen-finances');
            showToast(`🔔 Konto-Alarm: Kasse unter ${formatVal(grenze)}!`, 'error', 5000);
        }
        return;
    }
    financeCentralState.kontoAlarmGemeldet = false;
    const f = getLiquidityForecast();
    const knapp = f.avg !== null && f.avg < 0 && game.money + f.avg * 3 < grenze;
    if (knapp && !financeCentralState.kontoAlarmVorwarnung) {
        financeCentralState.kontoAlarmVorwarnung = true;
        addInboxMessage('finanzen', '🔔 Konto-Vorwarnung: Grenze in Sicht', `Bei einem Schnitt von ${formatVal(f.avg)} je Spieltag fällt die Kasse (${formatVal(game.money)}) in etwa drei Spieltagen unter deine Grenze von ${formatVal(grenze)}.`, 'screen-finances');
    } else if (!knapp) financeCentralState.kontoAlarmVorwarnung = false;
}

// ---------- Spieler-Etiketten ----------

const SPIELER_ETIKETTEN = [
    { id: 'verkauf', label: '💰 Verkaufskandidat' },
    { id: 'aufbau', label: '🌱 Aufbauspieler' },
    { id: 'stamm', label: '⭐ Stammkraft' },
    { id: 'beobachten', label: '👀 Beobachten' },
    { id: 'vertrag', label: '📄 Vertrag klären' },
    { id: 'schonen', label: '🛌 Schonen' }
];
let squadTagFilter = '';

// Etiketten mit Wirkung (Phase 26.10): drei der sechs Etiketten greifen nach jedem Spiel in Moral und Verletzungsrisiko ein.
// Die anderen (Verkaufskandidat, Beobachten, Vertrag klären) sind reine Planungshilfen. Die Werte sind bewusst klein:
//   Stammkraft    spielt: +1 Moral (bis 90); sitzt auf der Bank: -2 Moral, aber nie unter 45 durch dieses Etikett
//   Aufbauspieler spielt: +1 Moral (bis 90); sitzt auf der Bank: keine Unzufriedenheit (er ist geduldig)
//   Schonen       spielt trotzdem: Verletzungsrisiko x1,3 (der Physio hatte gewarnt); auf der Bank passiert nichts,
//                 denn dort gibt es kein Verletzungsrisiko. Bewusst keine Mehrermüdung: sie verschiebt das Fitness-
//                 Gleichgewicht von Dauerspielern dauerhaft nach unten (Messung: -9 Punkte je Saison schon bei 1 Punkt)
const ETIKETT_WIRKUNG = {
    stamm: { spielt: { moral: 1 }, bank: { moral: -2, untergrenze: 45 } },
    aufbau: { spielt: { moral: 1 }, bank: {} },
    schonen: { spielt: { verletzung: 1.3 }, bank: {} }
};

// Summe der Wirkungen aller Etiketten eines Spielers für dieses Spiel (spielt = stand in der Startelf)
function getTagMatchEffects(p, spielt) {
    const e = { moral: 0, untergrenze: 0, verletzung: 1, ermuedung: 0 };
    getPlayerTags(p).forEach(t => {
        const w = ETIKETT_WIRKUNG[t] && ETIKETT_WIRKUNG[t][spielt ? 'spielt' : 'bank'];
        if (!w) return;
        if (w.moral) e.moral += w.moral;
        if (w.untergrenze) e.untergrenze = Math.max(e.untergrenze, w.untergrenze);
        if (w.verletzung) e.verletzung *= w.verletzung;
        if (w.ermuedung) e.ermuedung += w.ermuedung;
    });
    return e;
}

// Wendet Moral und Mehrermüdung an (aufgerufen nach jedem eigenen Spiel aus processPostMatchRoutine)
function applyTagMatchEffects(p, spielt) {
    if (!spielt && ((p.injured || 0) > 0 || (p.suspended || 0) > 0)) return; // Verletzte und Gesperrte sind nicht „unzufrieden auf der Bank“
    const e = getTagMatchEffects(p, spielt);
    if (e.moral > 0) { const aktuell = p.morale || 80; p.morale = aktuell >= 90 ? aktuell : Math.min(90, aktuell + e.moral); } // nur bis 90: kein dauerhafter Stärkebonus über die Moral
    else if (e.moral < 0) {
        const aktuell = p.morale || 80;
        p.morale = aktuell > e.untergrenze ? Math.max(e.untergrenze, aktuell + e.moral) : aktuell;
    }
    if (e.ermuedung > 0 && spielt) p.fitness = Math.max(10, p.fitness - e.ermuedung);
}

// Texte für das Spielerdetail: was ein aktives Etikett bewirkt
function getTagEffectTexts(p) {
    const t = getPlayerTags(p);
    const z = [];
    if (t.includes('stamm')) z.push('Stammkraft: +1 Moral bei Einsatz (bis 90), −2 Moral auf der Bank (nicht unter 45).');
    if (t.includes('aufbau')) z.push('Aufbauspieler: +1 Moral bei Einsatz (bis 90), bleibt auf der Bank gelassen.');
    if (t.includes('schonen')) z.push('Schonen: spielt er trotzdem, steigt sein Verletzungsrisiko um 30 %.');
    return z;
}

function getPlayerTags(p) { return Array.isArray(p.tags) ? p.tags.filter(t => SPIELER_ETIKETTEN.some(e => e.id === t)) : []; }

function getPlayerTagChips(p) {
    return getPlayerTags(p).map(t => uiChip(SPIELER_ETIKETTEN.find(e => e.id === t).label, t === 'schonen' ? 'warn' : ''));
}

function toggleSquadTag(playerId, tagId) {
    const p = squad.find(x => x.id === playerId);
    if (!p || !SPIELER_ETIKETTEN.some(e => e.id === tagId)) return;
    const tags = getPlayerTags(p);
    p.tags = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId];
    renderPlayerTags(p);
    renderSquadTagFilter();
}

function renderPlayerTags(p) {
    const box = document.getElementById('pd-tags');
    if (!box) return;
    if (!squad.includes(p)) { box.innerHTML = ''; return; }
    const tags = getPlayerTags(p);
    const wirkung = getTagEffectTexts(p);
    box.innerHTML = `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:10px 0 4px; text-align:left;">Eigene Etiketten</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${SPIELER_ETIKETTEN.map(e => `<button onclick="toggleSquadTag('${p.id}', '${e.id}')" class="${tags.includes(e.id) ? 'btn-action' : 'btn-secondary'}" style="width:auto;" aria-pressed="${tags.includes(e.id)}">${e.label}</button>`).join('')}</div>
        ${wirkung.length ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px; text-align:left;">${wirkung.map(mpEsc).join('<br>')}</div>` : ''}`;
}

function setSquadTagFilter(tagId) {
    squadTagFilter = squadTagFilter === tagId ? '' : tagId;
    renderSquadView();
}

function renderSquadTagFilter() {
    const box = document.getElementById('squad-tag-filter');
    if (!box) return;
    const zaehler = {};
    squad.forEach(p => getPlayerTags(p).forEach(t => { zaehler[t] = (zaehler[t] || 0) + 1; }));
    const vorhanden = SPIELER_ETIKETTEN.filter(e => zaehler[e.id]);
    if (squadTagFilter && !zaehler[squadTagFilter]) squadTagFilter = '';
    box.innerHTML = vorhanden.length ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:3px;">Nach Etikett filtern:</div><div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">${vorhanden.map(e => `<button onclick="setSquadTagFilter('${e.id}')" class="${squadTagFilter === e.id ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:var(--fs-caption);" aria-pressed="${squadTagFilter === e.id}">${e.label} (${zaehler[e.id]})</button>`).join('')}</div>` : '';
}

// ---------- Etiketten-Bilanz (Phase 26.13) ----------
// Wie schneidet die Mannschaft ab, wenn ein Spieler mit einem Etikett in der Startelf steht, und wie ohne?
// Gezählt werden Ligaspiele der laufenden Saison (game.etikettBilanz = { etikett: { mit: {...}, ohne: {...} } });
// am Saisonende wandert sie nach game.etikettBilanzVorjahr. Nur Auswertung, nichts davon verändert das Spiel.

const TAG_BILANZ_MIN = 5; // ab so vielen Spielen je Seite sagt der Vergleich etwas

function ensureTagBilanz() {
    if (!game.etikettBilanz || typeof game.etikettBilanz !== 'object' || Array.isArray(game.etikettBilanz)) game.etikettBilanz = {};
}

// Etiketten, die mindestens ein Spieler der Startelf trägt, und Etiketten, die im Kader überhaupt vergeben sind
function getStartelfTagInfo() {
    const ids = typeof lineup !== 'undefined' && Array.isArray(lineup) ? lineup : [];
    const startelf = new Set(), vergeben = new Set();
    squad.forEach(p => getPlayerTags(p).forEach(t => { vergeben.add(t); if (ids.includes(p.id)) startelf.add(t); }));
    return { startelf: [...startelf], vergeben: [...vergeben] };
}

// Vor dem Ligaspiel (neben markPresetInUse): Startelf-Etiketten festhalten
function markTagsInUse() {
    game.etikettImEinsatz = Object.assign({ matchday: game.matchday }, getStartelfTagInfo());
}

// Nach dem Ligaspiel (aus recordOwnLeagueResult): ohne Merkzettel gilt die aktuelle Startelf
function recordTagResult(ourGoals, oppGoals) {
    let info = game.etikettImEinsatz;
    game.etikettImEinsatz = null;
    if (!info || info.matchday !== game.matchday) info = getStartelfTagInfo();
    ensureTagBilanz();
    const leer = () => ({ spiele: 0, s: 0, u: 0, n: 0, tore: 0, gegentore: 0 });
    info.vergeben.forEach(t => {
        const e = game.etikettBilanz[t] || (game.etikettBilanz[t] = { mit: leer(), ohne: leer() });
        const z = info.startelf.includes(t) ? e.mit : e.ohne;
        z.spiele++; z.tore += ourGoals; z.gegentore += oppGoals;
        if (ourGoals > oppGoals) z.s++; else if (ourGoals < oppGoals) z.n++; else z.u++;
    });
}

function tagPunkteProSpiel(z) { return z && z.spiele ? (3 * z.s + z.u) / z.spiele : 0; }

// Saisonende: laufende Bilanz ins Vorjahr schieben
function archiveTagBilanz() {
    ensureTagBilanz();
    if (!Object.keys(game.etikettBilanz).length) { return; }
    game.etikettBilanzVorjahr = { season: game.season, daten: JSON.parse(JSON.stringify(game.etikettBilanz)) };
    game.etikettBilanz = {};
}

function renderTagBilanzBox() {
    const box = document.getElementById('tag-bilanz-box');
    if (!box) return;
    ensureTagBilanz();
    const fmt = v => v.toFixed(2).replace('.', ',');
    const seite = (name, z) => `${name}: ${z.spiele} Sp., ${z.s}S ${z.u}U ${z.n}N, ${fmt(tagPunkteProSpiel(z))} Pkt/Spiel`;
    const block = (titel, daten) => {
        const zeilen = SPIELER_ETIKETTEN.filter(e => daten[e.id] && (daten[e.id].mit.spiele + daten[e.id].ohne.spiele) > 0).map(e => {
            const d = daten[e.id];
            const genug = d.mit.spiele >= TAG_BILANZ_MIN && d.ohne.spiele >= TAG_BILANZ_MIN;
            const diff = tagPunkteProSpiel(d.mit) - tagPunkteProSpiel(d.ohne);
            const urteil = !genug ? `<span style="color:var(--text-muted);">noch zu wenige Spiele (je Seite mindestens ${TAG_BILANZ_MIN})</span>`
                : `<strong>${diff >= 0.3 ? '👍 mit besser' : diff <= -0.3 ? '👎 ohne besser' : '≈ kein klarer Unterschied'} (${diff >= 0 ? '+' : ''}${fmt(diff)})</strong>`;
            return `<div class="box" style="font-size:var(--fs-small); margin:3px 0;"><strong>${e.label}</strong><br>${seite('In der Startelf', d.mit)}<br>${seite('Nicht in der Startelf', d.ohne)}<br>${urteil}</div>`;
        });
        return zeilen.length ? `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:8px 0 2px;">${titel}</div>${zeilen.join('')}` : '';
    };
    const aktuell = block(`Saison ${game.season} (laufend)`, game.etikettBilanz);
    const v = game.etikettBilanzVorjahr;
    const alt = v && v.daten ? block(`Saison ${v.season}`, v.daten) : '';
    box.innerHTML = '<div class="panel-header" style="color:var(--purple);">🏷️ Bilanz der Etiketten</div>'
        + (aktuell || alt ? aktuell + alt + '<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">Verglichen werden Ligaspiele mit und ohne Spieler dieses Etiketts in der Startelf. Das ist keine Ursache: Stammkräfte spielen oft gegen die leichteren Gegner nicht, kleine Stichproben schwanken stark.</div>'
            : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch keine Daten. Vergib im Spielerdetail Etiketten und spiele Ligaspiele.</div>');
}

// ---------- Manager-Assistent ----------

// Bis zu drei empfohlene nächste Schritte, aus echten Daten und nach Dringlichkeit geordnet
// Schritte zurückstellen: „Später“ blendet einen Schritt 3 Spieltage aus (game.assistentZurueck = { id: { season, bis } }).
// Aufstellungsfehler und Minus-Kasse sind nicht zurückstellbar.
const ASSISTENT_NICHT_ZURUECK = ['aufstellung', 'kasse-minus'];
const ASSISTENT_ZURUECK_SPIELTAGE = 3;

function ensureAssistentState() {
    if (!game.assistentZurueck || typeof game.assistentZurueck !== 'object' || Array.isArray(game.assistentZurueck)) game.assistentZurueck = {};
}

function istZurueckgestellt(id) {
    ensureAssistentState();
    const z = game.assistentZurueck[id];
    return !!z && z.season === game.season && game.matchday < z.bis && !ASSISTENT_NICHT_ZURUECK.includes(id);
}

function snoozeManagerTodo(id) {
    ensureAssistentState();
    if (ASSISTENT_NICHT_ZURUECK.includes(id)) { showToast('Dieser Schritt ist dringend und lässt sich nicht zurückstellen.', 'error'); return; }
    game.assistentZurueck[id] = { season: game.season, bis: game.matchday + ASSISTENT_ZURUECK_SPIELTAGE };
    showToast(`⏸️ Zurückgestellt bis Spieltag ${game.matchday + ASSISTENT_ZURUECK_SPIELTAGE}.`, 'info');
    renderManagerAssistant();
}

function resetManagerSnooze() {
    ensureAssistentState();
    game.assistentZurueck = {};
    renderManagerAssistant();
}

function getManagerTodos(alle) {
    const t = [];
    const probleme = typeof getLineupProblems === 'function' ? getLineupProblems().filter(x => x.ton === 'schlecht') : [];
    if (probleme.length) t.push({ id: 'aufstellung', prio: 95, icon: '🔴', text: `Aufstellung prüfen: ${probleme[0].text}`, label: 'Zur Aufstellung', aktion: "showScreen('screen-squad')" });
    if (game.money < 0) t.push({ id: 'kasse-minus', prio: 92, icon: '🔴', text: `Die Kasse ist im Minus (${formatVal(game.money)}): Transfersperre und Financial Fairplay drohen.`, label: 'Zu den Finanzen', aktion: "showScreen('screen-finances')" });
    const ausl = squad.filter(p => p.contracts <= 0);
    if (ausl.length) t.push({ id: 'vertraege-aus', prio: 85, icon: '🟠', text: `${ausl.length} Vertrag${ausl.length === 1 ? ' läuft' : 'e laufen'} zum Saisonende aus (${ausl.slice(0, 2).map(p => p.name).join(', ')}${ausl.length > 2 ? ' …' : ''}).`, label: 'Verlängerungs-Assistent', aktion: "showScreen('screen-contracts'); openRenewalAssistant()" });
    if (incomingOffers.length) t.push({ id: 'angebote', prio: 88, icon: '🟠', text: `${incomingOffers.length} Angebot${incomingOffers.length === 1 ? '' : 'e'} für deine Spieler warten auf eine Antwort.`, label: 'Zu den Angeboten', aktion: "showScreen('screen-transfer'); setTransferTab('offers')" });
    const jugend = typeof youthTalents !== 'undefined' ? youthTalents.filter(p => p.proDecisionLeft) : [];
    if (jugend.length) t.push({ id: 'jugend', prio: 72, icon: '🟠', text: `${jugend.length} Jugendspieler warten auf eine Profivertrag-Entscheidung.`, label: 'Zur Jugend', aktion: "showScreen('screen-youth')" });
    const muede = squad.filter(p => lineup.includes(p.id) && (p.injured || 0) === 0 && p.fitness < 70);
    if (muede.length) t.push({ id: 'muede', prio: 65, icon: '🟡', text: `${muede.length} Stammspieler sind erschöpft (${muede.slice(0, 2).map(p => `${p.name} ${p.fitness} %`).join(', ')}).`, label: 'Zur Aufstellung', aktion: "showScreen('screen-squad')" });
    const bald = squad.filter(p => p.contracts === 1);
    if (bald.length && !ausl.length) t.push({ id: 'vertraege-bald', prio: 55, icon: '🟡', text: `${bald.length} Vertrag${bald.length === 1 ? ' hat' : 'e haben'} nur noch ein Jahr Laufzeit.`, label: 'Verlängerungs-Assistent', aktion: "showScreen('screen-contracts'); openRenewalAssistant()" });
    const stammAus = squad.filter(p => (p.injured || 0) > 0 && [...squad].sort((a, b) => b.strength - a.strength).slice(0, 11).includes(p));
    if (stammAus.length) t.push({ id: 'verletzt', prio: 50, icon: '🟡', text: `${stammAus.length} Stammspieler verletzt: ${stammAus.slice(0, 2).map(p => p.name).join(', ')}.`, label: 'Zum Kader', aktion: "showScreen('screen-squad')" });
    // Etikett „Beobachten“: nur wer gerade etwas Auffälliges zeigt, wird gemeldet (verletzt, Form fällt/steigt, Vertrag endet)
    const beobachtet = squad.map(p => {
        if (!getPlayerTags(p).includes('beobachten')) return null;
        const trend = typeof getFormTrend === 'function' ? getFormTrend(p.formNoten) : null;
        const grund = (p.injured || 0) > 0 ? `verletzt (${p.injured} SpT)` : (trend === 'fallend' ? 'Form fällt' : (trend === 'steigend' ? 'Form steigt' : (p.contracts <= 1 ? 'Vertrag endet bald' : '')));
        return grund ? `${p.name} (${grund})` : null;
    }).filter(Boolean);
    if (beobachtet.length) t.push({ id: 'beobachtet', prio: 45, icon: '👀', text: `Beobachtet: ${beobachtet.slice(0, 2).join(', ')}${beobachtet.length > 2 ? ' …' : ''}.`, label: 'Zum Kader', aktion: "showScreen('screen-squad'); if (squadTagFilter !== 'beobachten') setSquadTagFilter('beobachten')" });
    // Fristen: Transferfenster, Hauptsponsor, Kreditraten (nur Anzeige aus den vorhandenen Ständen der Module)
    if (typeof isTransferWindowOpen === 'function' && isTransferWindowOpen()) {
        const letzter = game.winterWindowActive ? game.winterWindowCloseMatchday : (typeof SUMMER_WINDOW_LAST_MATCHDAY !== 'undefined' ? SUMMER_WINDOW_LAST_MATCHDAY : null);
        const rest = typeof letzter === 'number' ? letzter - game.matchday + 1 : null;
        if (rest !== null && rest >= 1 && rest <= 2) t.push({ id: 'fenster', prio: 62, icon: '⏳', text: `Das ${game.winterWindowActive ? 'Winter-' : 'Sommer-'}Transferfenster schließt in ${rest === 1 ? 'diesem Spieltag' : 'zwei Spieltagen'}.`, label: 'Zum Transfermarkt', aktion: "showScreen('screen-transfer')" });
    }
    const sp = game.sponsor;
    if (sp && sp.name && sp.name !== 'Kein Hauptsponsor' && typeof sp.duration === 'number' && sp.duration > 0 && sp.duration < 900) {
        const angebot = typeof getSponsorRenewal === 'function' ? getSponsorRenewal() : null;
        if (angebot) t.push({ id: 'sponsor-angebot', prio: 75, icon: '🟠', text: `${sp.name} bietet eine Vertragsverlängerung an (Vertrag noch ${sp.duration} Spieltage).`, label: 'Zu den Sponsoren', aktion: "showScreen('screen-sponsors')" });
        else if (sp.duration <= 6) t.push({ id: 'sponsor-ende', prio: 68, icon: '🟡', text: `Der Hauptsponsor ${sp.name} läuft in ${sp.duration} Spieltag${sp.duration === 1 ? '' : 'en'} aus.`, label: 'Zu den Sponsoren', aktion: "showScreen('screen-sponsors')" });
    }
    const raten = typeof activeLoans !== 'undefined' ? activeLoans.reduce((s, l) => s + (l.installment || 0), 0) : 0;
    if (raten > 0 && game.money >= 0 && game.money < raten * 3) t.push({ id: 'kredit', prio: 78, icon: '🟠', text: `Die Kasse (${formatVal(game.money)}) deckt nur ${Math.floor(game.money / raten)} von 3 anstehenden Kreditraten (${formatVal(raten)} je Spieltag).`, label: 'Zu den Finanzen', aktion: "showScreen('screen-finances')" });
    const ungelesen = typeof inboxMessages !== 'undefined' ? inboxMessages.filter(m => !m.read).length : 0;
    if (ungelesen >= 8) t.push({ id: 'postfach', prio: 20, icon: '📬', text: `${ungelesen} ungelesene Nachrichten im Postfach.`, label: 'Zum Postfach', aktion: "showScreen('screen-inbox')" });
    const offen = t.filter(x => !istZurueckgestellt(x.id));
    offen.sort((a, b) => b.prio - a.prio);
    return alle ? offen : offen.slice(0, 3);
}

// Rückkehr-Termine der Ausgefallenen (aus p.injured und p.suspended), Stammspieler (die elf Stärksten) mit Stern
function getReturnInfo() {
    const top = [...squad].sort((a, b) => b.strength - a.strength).slice(0, 11).map(p => p.id);
    const liste = squad.filter(p => (p.injured || 0) > 0 || (p.suspended || 0) > 0).map(p => {
        const verletzt = (p.injured || 0) > 0;
        const n = verletzt ? p.injured : p.suspended;
        return { p, grund: verletzt ? 'verletzt' : 'gesperrt', n, stamm: top.includes(p.id) };
    }).sort((a, b) => (b.stamm - a.stamm) || (a.n - b.n) || (b.p.strength - a.p.strength));
    return liste;
}

function getReturnLineHtml() {
    const liste = getReturnInfo();
    if (!liste.length) return '';
    const teil = x => `${x.stamm ? '⭐ ' : ''}${mpEsc(x.p.name)} ${x.n === 1 ? 'in 1 Spiel' : `in ${x.n} Spielen`}${x.grund === 'gesperrt' ? ' (gesperrt)' : ''}`;
    const sichtbar = liste.slice(0, 3).map(teil).join(', ');
    return `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">🩹 Zurück: ${sichtbar}${liste.length > 3 ? ` und ${liste.length - 3} weitere` : ''}</div>`;
}

// updateUI() ruft den Assistenten bei jedem Aufruf; das DOM wird nur neu geschrieben, wenn sich der Inhalt ändert
let managerAssistantLetzterInhalt = '';

function renderManagerAssistant() {
    const box = document.getElementById('manager-assistant-box');
    if (!box) return;
    const dash = document.getElementById('screen-dashboard');
    if (!dash || dash.style.display === 'none') return;
    if (typeof squad === 'undefined' || !squad.length) { box.innerHTML = ''; managerAssistantLetzterInhalt = ''; return; }
    const todos = getManagerTodos();
    ensureAssistentState();
    const zurueck = Object.keys(game.assistentZurueck).filter(istZurueckgestellt).length;
    const html = `<div class="panel-header">🧭 Manager-Assistent</div>` + (todos.length
        ? todos.map(x => `<div class="box" style="margin:4px 0; font-size:var(--fs-small); display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:6px 8px;"><span style="flex:1 1 11em; min-width:0;">${x.icon} ${mpEsc(x.text)}</span><span style="display:flex; gap:4px; flex:0 0 auto;"><button onclick="${x.aktion}" class="btn-secondary" style="width:auto; flex:0 0 auto;">${x.label}</button>${ASSISTENT_NICHT_ZURUECK.includes(x.id) ? '' : `<button onclick="snoozeManagerTodo('${x.id}')" class="btn-secondary" style="width:auto; flex:0 0 auto;" title="Diesen Schritt ${ASSISTENT_ZURUECK_SPIELTAGE} Spieltage ausblenden">⏸️ Später</button>`}</span></div>`).join('')
        : `<div class="box" style="font-size:var(--fs-small);">✅ Alles im grünen Bereich: Aufstellung steht, keine Verträge drängen, die Kasse passt. Zeit für den nächsten Spieltag.</div>`)
        + (zurueck ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">⏸️ ${zurueck} Schritt${zurueck === 1 ? '' : 'e'} zurückgestellt <button onclick="resetManagerSnooze()" class="btn-secondary" style="width:auto; margin:0 0 0 6px;">Alle wieder zeigen</button></div>` : '')
        + getReturnLineHtml();
    if (html === managerAssistantLetzterInhalt && box.firstChild) return;
    managerAssistantLetzterInhalt = html;
    box.innerHTML = html;
}

// ---------- Lizenz-Laufbahn (erweitert die Trainerlizenz aus js/private-life.js) ----------

// Voraussetzungen je Lizenzstufe (Index in licenseConfig): abgeschlossene Saisons, Manager-Level, Trophäen
const LIZENZ_VORAUSSETZUNGEN = [
    null,
    { saisons: 1, level: 1, trophaeen: 0 },
    { saisons: 3, level: 3, trophaeen: 0 },
    { saisons: 6, level: 6, trophaeen: 1 }
];

function getLicenseProgress(stufe) {
    const v = LIZENZ_VORAUSSETZUNGEN[stufe];
    if (!v) return [];
    const saisons = Math.max(0, game.season - 1);
    return [
        { text: `${v.saisons} abgeschlossene Saison${v.saisons === 1 ? '' : 'en'}`, ist: saisons, soll: v.saisons },
        v.level > 1 ? { text: `Manager-Level ${v.level}`, ist: managerRPG.level, soll: v.level } : null,
        v.trophaeen > 0 ? { text: `${v.trophaeen} Trophäe${v.trophaeen === 1 ? '' : 'n'}`, ist: (game.trophies || []).length, soll: v.trophaeen } : null
    ].filter(Boolean);
}

// Was für die Lizenz noch fehlt, als Texte (leer = alle Voraussetzungen erfüllt)
function getLicenseMissing(stufe) {
    return getLicenseProgress(stufe).filter(x => x.ist < x.soll).map(x => `${x.text} (jetzt ${x.ist})`);
}

function renderLicenseCareer() {
    const zeilen = licenseConfig.map((l, i) => {
        const aktiv = i === privateLife.license, erreicht = i < privateLife.license;
        const fehlt = i > privateLife.license ? getLicenseMissing(i) : [];
        const chips = i === 0 ? [] : getLicenseProgress(i).map(x => uiChip(`${x.ist >= x.soll || erreicht ? '✓' : '○'} ${x.text}`, (x.ist >= x.soll || erreicht) ? 'gut' : ''));
        return `<div class="box" style="margin:4px 0; font-size:var(--fs-small);${aktiv ? ' border-left-color:var(--accent);' : ''}">
            <strong>${erreicht ? '✓ ' : (aktiv ? '▶ ' : '')}${l.name}</strong> <span style="color:var(--text-muted);">· +${l.boost} Teamstärke${l.cost ? ` · ${formatVal(l.cost)}` : ''}</span>
            ${chips.length ? `<div class="ui-card-meta" style="margin-top:4px;">${chips.join('')}</div>` : ''}
            ${i > privateLife.license && !fehlt.length ? '<div style="color:var(--primary); margin-top:3px;">Voraussetzungen erfüllt</div>' : ''}</div>`;
    }).join('');
    return `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:8px 0 2px;">Lizenz-Laufbahn</div>${zeilen}`;
}
