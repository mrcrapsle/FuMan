// ============================================================================
// SPIELVORBEREITUNG (Phase 26.1): Aufstellungs- und Taktikvorlagen sowie der Spieltag-Check
// vor dem Anpfiff (Aufstellungs-Check, "Wer fehlt?", Rotations-Assistent).
// Alles hier liest nur echte Spieldaten (squad, lineup, game) und ändert die Mannschaft nur
// auf ausdrücklichen Tipp des Spielers. Kein Eingriff in Teamstärke oder Spielregeln.
// ============================================================================

const MP_SLOTS = 5;
// Spieler je Reihe (Abwehr, Mittelfeld, Sturm) je Formation - dieselbe Aufteilung wie pickBestLineupIds()
const MP_FORMATION_LINES = {
    '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2],
    '4-2-3-1': [4, 5, 1], '4-1-4-1': [4, 5, 1], '3-4-3': [3, 4, 3], '5-4-1': [5, 4, 1]
};

function mpEsc(text) {
    return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Alte Spielstände kennen die Vorlagen nicht: Felder bei Bedarf anlegen
function ensureMatchPrepState() {
    if (!Array.isArray(game.lineupPresets)) game.lineupPresets = [];
    if (!Array.isArray(game.tacticPresets)) game.tacticPresets = [];
    while (game.lineupPresets.length < MP_SLOTS) game.lineupPresets.push(null);
    while (game.tacticPresets.length < MP_SLOTS) game.tacticPresets.push(null);
}

// Zeichnet ein offenes Fenster seinen Inhalt neu, verschwindet das fokussierte Element (innerHTML ersetzt es) und der Fokus
// fällt auf die Seite zurück. Dann wandert er auf das gewünschte Element oder den Schließen-Knopf des Fensters.
function mpFokusHalten(overlayId, selektor) {
    const ov = document.getElementById(overlayId);
    if (!ov || !ov.classList.contains('show') || ov.contains(document.activeElement)) return;
    const ziel = (selektor && ov.querySelector(selektor)) || ov.querySelector('.generic-modal-close');
    if (ziel && ziel.focus) ziel.focus({ preventScroll: true });
}

function mpIstEinsatzbereit(p) {
    return !!p && (p.injured || 0) === 0 && (p.suspended || 0) === 0;
}

function mpLiveAktiv() {
    const s = document.getElementById('screen-matchday');
    return typeof currentMatch !== 'undefined' && !!currentMatch && !!s && s.style.display === 'block';
}

// ---------- Gegner-Notizbuch (Phase 26.6) ----------

const GEGNER_NOTIZ_MAX = 300;

// Schlagwörter zu Gegner-Notizen (Phase 26.14): feste Liste, wählbar im Notizfeld, filterbar im Notizbuch
const NOTIZ_SCHLAGWOERTER = [
    { id: 'konter', label: '⚡ Konter' }, { id: 'standards', label: '🎯 Standards' }, { id: 'pressing', label: '🔥 Pressing' },
    { id: 'abwehr-links', label: '🛡️ Abwehr links' }, { id: 'abwehr-rechts', label: '🛡️ Abwehr rechts' },
    { id: 'fluegel', label: '🏃 Flügel' }, { id: 'langer-ball', label: '📏 Langer Ball' }, { id: 'heimstark', label: '🏟️ Heimstark' }
];
let notizFilter = { text: '', tag: '' };

function getNotizTags(n) {
    return n && Array.isArray(n.tags) ? n.tags.filter(t => NOTIZ_SCHLAGWOERTER.some(x => x.id === t)) : [];
}

function notizTagChips(n) {
    return getNotizTags(n).map(t => uiChip(NOTIZ_SCHLAGWOERTER.find(x => x.id === t).label)).join('');
}

function toggleNotizTag(btn) {
    const an = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(an));
    btn.className = (an ? 'btn-action' : 'btn-secondary') + ' notiz-tag';
}

function ensureGegnerNotizen() {
    if (!game.gegnerNotizen || typeof game.gegnerNotizen !== 'object' || Array.isArray(game.gegnerNotizen)) game.gegnerNotizen = {};
}

function getGegnerNotiz(name) {
    ensureGegnerNotizen();
    return game.gegnerNotizen[name] || null;
}

function saveGegnerNotiz(name, feldId) {
    ensureGegnerNotizen();
    const feld = document.getElementById(feldId || 'gegner-notiz-text');
    const text = feld ? feld.value.trim().slice(0, GEGNER_NOTIZ_MAX) : '';
    if (!name) return;
    const gewaehlt = [...document.querySelectorAll(`.notiz-tag[data-feld="${feldId || 'gegner-notiz-text'}"][aria-pressed="true"]`)].map(b => b.dataset.tag);
    if (!text) {
        if (game.gegnerNotizen[name]) { delete game.gegnerNotizen[name]; showToast(`📓 Notiz zu ${name} gelöscht.`, 'info'); }
        else showToast('Schreibe zuerst etwas in das Notizfeld.', 'error');
    } else {
        game.gegnerNotizen[name] = { text, season: game.season, matchday: game.matchday };
        if (gewaehlt.length) game.gegnerNotizen[name].tags = gewaehlt;
        showToast(`📓 Notiz zu ${name} gespeichert.`, 'success');
    }
    if (typeof renderPrematchCheck === 'function') renderPrematchCheck();
    renderGegnerNotizbuch();
    if (feldId === 'gegner-notiz-nach') closeNachspielNotiz();
}

function deleteGegnerNotiz(name) {
    ensureGegnerNotizen();
    if (!game.gegnerNotizen[name]) return;
    delete game.gegnerNotizen[name];
    renderGegnerNotizbuch();
}

// Bilanz aus den vorhandenen Kopf-an-Kopf-Daten (game.headToHeadRecords, gepflegt in updateLeagueTable)
function getGegnerBilanzText(oppName) {
    const rec = game.headToHeadRecords && game.headToHeadRecords[oppName];
    if (!rec || (rec.wins + rec.draws + rec.losses) === 0) return 'Noch keine Ligaduelle gegen diesen Verein.';
    return `Bilanz: ${rec.wins}S ${rec.draws}U ${rec.losses}N · Tore ${rec.goalsFor}:${rec.goalsAgainst}${rec.lastResults && rec.lastResults.length ? ` · zuletzt ${rec.lastResults.slice(0, 3).join(', ')}` : ''}`;
}

// Halbzeit-Ansicht im Livespiel: die Notiz und die Bilanz zum Gegner (nur Anzeige, geändert wird im Spieltag-Check)
function renderHalftimeNotiz() {
    const box = document.getElementById('halftime-notiz-box');
    if (!box) return;
    const m = typeof currentMatch !== 'undefined' ? currentMatch : null;
    const opp = m ? (m.isHome ? m.awayName : m.homeName) : '';
    const n = opp ? getGegnerNotiz(opp) : null;
    const bilanz = opp ? getGegnerBilanzText(opp) : '';
    if (!opp || (!n && /^Noch keine/.test(bilanz))) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="box" style="font-size:var(--fs-small); text-align:left; overflow-wrap:anywhere;"><strong>📓 ${mpEsc(opp)}</strong><br>📊 ${mpEsc(bilanz)}${n ? `<br>📝 ${mpEsc(n.text)}${getNotizTags(n).length ? `<div class="ui-card-meta" style="margin-top:4px;">${notizTagChips(n)}</div>` : ''}` : ''}</div>`;
}

// Vorschläge für die Notiz aus den öffentlichen Daten zum Gegner (Spielstil, Tabelle, Tore, letzte Duelle); nur Text zum Antippen
function getNotizVorschlaege(oppName) {
    const v = [];
    const team = (leaguesData[game.leagueLevel] || []).find(t => t.name === oppName);
    if (team) {
        const stil = typeof getTeamPlaystyle === 'function' ? getTeamPlaystyle(team) : null;
        if (stil) v.push(`Spielstil: ${stil.label}.`);
        const tab = typeof sortedTable === 'function' ? sortedTable(game.leagueLevel) : [];
        const platz = tab.findIndex(t => t.name === oppName) + 1;
        if (platz) v.push(`Platz ${platz} von ${tab.length}, Stärke ${Math.round(team.strength)}.`);
        if (team.played >= 3) v.push(`Ø ${(team.goalsFor / team.played).toFixed(1).replace('.', ',')} Tore, ${(team.goalsAgainst / team.played).toFixed(1).replace('.', ',')} Gegentore.`);
    }
    const rec = game.headToHeadRecords && game.headToHeadRecords[oppName];
    if (rec && rec.lastResults && rec.lastResults.length) v.push(`Zuletzt ${rec.lastResults.slice(0, 3).join(', ')}.`);
    return v;
}

function addNotizVorschlag(feldId, text) {
    const feld = document.getElementById(feldId);
    if (!feld) return;
    if (feld.value.includes(text)) { showToast('Das steht schon in der Notiz.', 'info'); return; }
    const neu = (feld.value.trim() ? feld.value.trim() + ' ' : '') + text;
    if (neu.length > GEGNER_NOTIZ_MAX) { showToast(`Die Notiz ist voll (höchstens ${GEGNER_NOTIZ_MAX} Zeichen).`, 'error'); return; }
    feld.value = neu;
    feld.focus();
}

function renderGegnerNotizSection(oppName, feldId, vorgabe) {
    if (!oppName) return '';
    feldId = feldId || 'gegner-notiz-text';
    const n = getGegnerNotiz(oppName);
    return `<div class="box" style="font-size:var(--fs-small); margin:0 0 6px;">📊 ${mpEsc(getGegnerBilanzText(oppName))}</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:4px;">${n ? `Gespeichert in Saison ${n.season}, Spieltag ${n.matchday}.` : 'Noch keine Notiz zu diesem Gegner.'} Die Notiz bleibt über Saisons erhalten.</div>
        <textarea id="${feldId}" class="input-inline" maxlength="${GEGNER_NOTIZ_MAX}" rows="3" placeholder="z. B. Schwache Abwehr über links, Konter nach Ecken" style="width:100%; box-sizing:border-box; font-family:inherit; font-weight:normal; text-align:left;" aria-label="Notiz zu ${mpEsc(oppName)}">${mpEsc(vorgabe != null ? vorgabe : (n ? n.text : ''))}</textarea>
        ${(() => { const vs = getNotizVorschlaege(oppName); return vs.length ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">Vorschläge zum Einfügen:</div><div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:2px;">${vs.map(t => `<button type="button" onclick="addNotizVorschlag(this.dataset.feld, this.dataset.text)" data-feld="${feldId}" data-text="${mpEsc(t)}" class="btn-secondary" style="width:auto; font-size:var(--fs-caption); text-align:left;">➕ ${mpEsc(t)}</button>`).join('')}</div>` : ''; })()}
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${NOTIZ_SCHLAGWOERTER.map(x => { const an = getNotizTags(n).includes(x.id); return `<button type="button" onclick="toggleNotizTag(this)" data-tag="${x.id}" data-feld="${feldId}" class="${an ? 'btn-action' : 'btn-secondary'} notiz-tag" style="width:auto; font-size:var(--fs-caption);" aria-pressed="${an}">${x.label}</button>`; }).join('')}</div>
        <button onclick="saveGegnerNotiz(this.dataset.club, this.dataset.feld)" data-club="${mpEsc(oppName)}" data-feld="${feldId}" class="btn-secondary" style="margin-top:4px;">📓 Notiz speichern</button>`;
}

// Nach dem Abpfiff: Notiz zum Gegner mit einem Entwurf aus dem Ergebnis (Saison, Spieltag, Ergebnis); nur auf Tipp gespeichert
function getNachspielNotizEntwurf(m) {
    const eigene = m.isHome ? m.homeGoals : m.awayGoals, fremde = m.isHome ? m.awayGoals : m.homeGoals;
    const wort = eigene > fremde ? 'Sieg' : eigene < fremde ? 'Niederlage' : 'Remis';
    const alt = (getGegnerNotiz(m.isHome ? m.awayName : m.homeName) || {}).text || '';
    const neu = `${m.isCup ? 'Pokal' : 'Sp. ' + game.matchday}: ${wort} ${eigene}:${fremde} (${m.isHome ? 'heim' : 'auswärts'}). `;
    return (alt ? alt + ' ' : '') + neu;
}

function updateNachspielNotizKnopf() {
    const knopf = document.getElementById('btn-gegner-notiz');
    const m = typeof currentMatch !== 'undefined' ? currentMatch : null;
    if (!knopf || !m) return;
    const verloren = (m.isHome ? m.homeGoals < m.awayGoals : m.awayGoals < m.homeGoals);
    knopf.textContent = verloren ? '📓 Niederlage notieren' : '📓 Notiz zum Gegner';
    knopf.className = verloren ? 'btn-action' : 'btn-secondary';
    knopf.style.display = 'inline-block';
}

function openNachspielNotiz() {
    const m = typeof currentMatch !== 'undefined' ? currentMatch : null;
    const body = document.getElementById('opp-note-body'), ov = document.getElementById('opp-note-overlay');
    if (!m || !body || !ov) { showToast('Es gibt gerade kein Spiel, zu dem du eine Notiz schreiben kannst.', 'error'); return; }
    const opp = m.isHome ? m.awayName : m.homeName;
    // Entwurf von hinten kürzen, falls Notiz plus Ergebnis zu lang sind
    const entwurf = getNachspielNotizEntwurf(m).slice(-GEGNER_NOTIZ_MAX);
    body.innerHTML = `<div class="panel-header" style="color:var(--purple);">📓 ${mpEsc(opp)}</div>` + renderGegnerNotizSection(opp, 'gegner-notiz-nach', entwurf);
    ov.classList.add('show');
    const feld = body.querySelector('textarea');
    if (feld) feld.id = 'gegner-notiz-nach';
    if (feld) { feld.focus(); feld.setSelectionRange(feld.value.length, feld.value.length); }
}

function closeNachspielNotiz() {
    const ov = document.getElementById('opp-note-overlay');
    if (ov) ov.classList.remove('show');
}

// Alle Notizen im Reiter Analyse, mit Suche (Verein, Text, Schlagwort) und Filter nach Schlagwort
function renderGegnerNotizbuch() {
    const box = document.getElementById('opp-notes-box');
    if (!box) return;
    ensureGegnerNotizen();
    const alle = Object.keys(game.gegnerNotizen);
    const genutzt = NOTIZ_SCHLAGWOERTER.filter(x => alle.some(n => getNotizTags(game.gegnerNotizen[n]).includes(x.id)));
    if (notizFilter.tag && !genutzt.some(x => x.id === notizFilter.tag)) notizFilter.tag = '';
    box.innerHTML = `<div class="panel-header" style="color:var(--purple);">📓 Notizbuch: Gegner</div>`
        + (alle.length > 1 || notizFilter.text || notizFilter.tag ? `<input id="opp-notes-suche" type="search" class="input-inline" value="${mpEsc(notizFilter.text)}" placeholder="Notizen suchen" aria-label="Notizen durchsuchen" oninput="setNotizSuche(this.value)" style="width:100%; box-sizing:border-box; margin-bottom:4px; text-align:left; font-weight:normal;">`
            + (genutzt.length ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;">${genutzt.map(x => `<button onclick="setNotizFilterTag('${x.id}')" data-filter="${x.id}" class="${notizFilter.tag === x.id ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:var(--fs-caption);" aria-pressed="${notizFilter.tag === x.id}">${x.label}</button>`).join('')}</div>` : '') : '')
        + '<div id="opp-notes-liste"></div>';
    renderGegnerNotizListe();
}

function renderGegnerNotizListe() {
    const liste = document.getElementById('opp-notes-liste');
    if (!liste) return;
    ensureGegnerNotizen();
    const alle = Object.keys(game.gegnerNotizen).sort((a, b) => a.localeCompare(b));
    const q = notizFilter.text.trim().toLowerCase();
    const namen = alle.filter(n => {
        const e = game.gegnerNotizen[n];
        if (notizFilter.tag && !getNotizTags(e).includes(notizFilter.tag)) return false;
        return !q || n.toLowerCase().includes(q) || String(e.text).toLowerCase().includes(q) || getNotizTags(e).some(t => NOTIZ_SCHLAGWOERTER.find(x => x.id === t).label.toLowerCase().includes(q));
    });
    liste.innerHTML = namen.length ? namen.map(n => `<div class="box" style="font-size:var(--fs-small); margin:4px 0; overflow-wrap:anywhere;"><div style="display:flex; justify-content:space-between; gap:8px; align-items:center;"><strong>${mpEsc(n)}</strong><button onclick="deleteGegnerNotiz(this.dataset.club)" data-club="${mpEsc(n)}" class="btn-secondary" style="width:auto; color:var(--danger);" title="Notiz zu ${mpEsc(n)} löschen">🗑️</button></div>${mpEsc(game.gegnerNotizen[n].text)}${getNotizTags(game.gegnerNotizen[n]).length ? `<div class="ui-card-meta" style="margin-top:4px;">${notizTagChips(game.gegnerNotizen[n])}</div>` : ''}<div style="color:var(--text-muted); font-size:var(--fs-caption);">Saison ${game.gegnerNotizen[n].season}, Spieltag ${game.gegnerNotizen[n].matchday}</div></div>`).join('')
        : (alle.length ? '<div style="font-size:var(--fs-small); color:var(--text-muted);">Keine Notiz passt zur Suche.</div>'
            : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch keine Notizen. Vor dem Anpfiff gibt es im Spieltag-Check ein Notizfeld zum Gegner.</div>');
}

// Während des Tippens wird nur die Liste neu geschrieben, das Suchfeld behält den Fokus
function setNotizSuche(text) {
    notizFilter.text = String(text || '').slice(0, 60);
    renderGegnerNotizListe();
}

function setNotizFilterTag(tag) {
    notizFilter.tag = notizFilter.tag === tag ? '' : tag;
    renderGegnerNotizbuch();
    const knopf = document.querySelector(`#opp-notes-box [data-filter="${tag}"]`);
    if (knopf) knopf.focus();
}

// ---------- Aufstellungsvorlagen ----------

function saveLineupPreset(slot) {
    ensureMatchPrepState();
    if (lineup.length !== 11) { showToast('Die Startelf braucht genau 11 Spieler, bevor du sie speichern kannst.', 'error', 3500); return; }
    const eingabe = document.getElementById('lineup-preset-name');
    const name = (eingabe && eingabe.value.trim()) || `Vorlage ${slot + 1}`;
    game.lineupPresets[slot] = { name: name.slice(0, 24), ids: [...lineup], formation: game.formation };
    ensureVorlageBilanz(); delete game.vorlageBilanz[slot]; // neue Vorlage, neue Bilanz
    if (eingabe) eingabe.value = '';
    showToast(`💾 Aufstellung „${name.slice(0, 24)}“ in Slot ${slot + 1} gespeichert.`, 'success');
    renderLineupPresets();
}

function deleteLineupPreset(slot) {
    ensureMatchPrepState();
    if (!game.lineupPresets[slot]) return;
    game.lineupPresets[slot] = null;
    ensureVorlageBilanz(); delete game.vorlageBilanz[slot];
    renderLineupPresets();
}

// Lädt eine Vorlage. Ausgefallene Spieler (verletzt, gesperrt, verkauft) werden auf demselben Platz
// durch den besten freien Spieler derselben Position ersetzt, ohne Ersatz durch den besten Verfügbaren.
// Ersetzt Ausfälle einer Vorlage (siehe oben); liefert { ids, ersetzt } oder null, wenn nicht genug Spieler bereitstehen
function resolveLineupPreset(v) {
    const neu = [];
    let ersetzt = 0;
    v.ids.forEach(id => {
        const p = squad.find(x => x.id === id);
        neu.push(p && mpIstEinsatzbereit(p) ? id : null);
    });
    neu.forEach((id, i) => {
        if (id) return;
        const altId = v.ids[i];
        const alt = squad.find(x => x.id === altId);
        const pos = alt ? alt.pos : null;
        const frei = squad.filter(p => mpIstEinsatzbereit(p) && !neu.includes(p.id));
        const eff = p => p.strength * (p.fitness / 100);
        const passend = (pos ? frei.filter(p => p.pos === pos) : []).sort((a, b) => eff(b) - eff(a));
        const rest = frei.sort((a, b) => eff(b) - eff(a));
        const wahl = passend[0] || rest[0];
        if (wahl) { neu[i] = wahl.id; ersetzt++; }
    });
    if (neu.some(id => !id) || neu.length !== 11) return null;
    return { ids: neu, ersetzt };
}

function loadLineupPreset(slot) {
    ensureMatchPrepState();
    const v = game.lineupPresets[slot];
    if (!v) { showToast('Dieser Slot ist leer - speichere zuerst eine Aufstellung.', 'error'); return; }
    const r = resolveLineupPreset(v);
    if (!r) { showToast('Zu wenig einsatzbereite Spieler für diese Aufstellung.', 'error', 3500); return; }
    game.formation = v.formation || game.formation;
    const formName = document.getElementById('squad-form-name');
    if (formName) formName.innerText = game.formation;
    lineup = r.ids;
    renderSquadView();
    if (typeof render3DPitch === 'function') render3DPitch();
    showToast(r.ersetzt ? `📂 „${v.name}“ geladen, ${r.ersetzt} Ausfall${r.ersetzt === 1 ? '' : 'e'} ersetzt.` : `📂 „${v.name}“ geladen.`, 'success');
}

// ---------- Bilanz je Vorlage (Nachbetrachtung) ----------
// Vor jedem Ligaspiel merkt sich markPresetInUse(), ob die Startelf (samt Formation) einer gespeicherten Vorlage
// entspricht und wie die Stärke zum Gegner stand. Nach dem Ergebnis trägt recordPresetResult() Sieg, Remis oder
// Niederlage und Tore ein. Simulierte Spieltage ohne Anstoß-Ablauf zählen nicht (kein Merker).

function ensureVorlageBilanz() {
    if (!game.vorlageBilanz || typeof game.vorlageBilanz !== 'object' || Array.isArray(game.vorlageBilanz)) game.vorlageBilanz = {};
}

function findePassendeVorlage() {
    ensureMatchPrepState();
    const elf = [...lineup].sort().join('|');
    for (let i = 0; i < game.lineupPresets.length; i++) {
        const v = game.lineupPresets[i];
        if (!v || v.formation !== game.formation) continue;
        if ([...v.ids].sort().join('|') === elf) return i;
        const r = resolveLineupPreset(v);
        if (r && [...r.ids].sort().join('|') === elf) return i;
    }
    return -1;
}

function markPresetInUse() {
    const info = typeof pendingMatchInfo !== 'undefined' ? pendingMatchInfo : null;
    game.vorlageImEinsatz = null;
    if (!info || lineup.length !== 11) return;
    const slot = findePassendeVorlage();
    if (slot === -1) return;
    const diff = typeof info.oppStr === 'number' ? calcTeamStrength(!!info.isHome) - info.oppStr : 0;
    game.vorlageImEinsatz = { slot, name: game.lineupPresets[slot].name, matchday: game.matchday, diff: Math.round(diff * 10) / 10 };
}

function recordPresetResult(ourGoals, oppGoals) {
    const m = game.vorlageImEinsatz;
    game.vorlageImEinsatz = null;
    if (!m || m.matchday !== game.matchday) return;
    ensureVorlageBilanz();
    const b = game.vorlageBilanz[m.slot] || (game.vorlageBilanz[m.slot] = { name: m.name, spiele: 0, s: 0, u: 0, n: 0, tore: 0, gegentore: 0, diffSumme: 0 });
    b.name = m.name;
    b.spiele++; b.tore += ourGoals; b.gegentore += oppGoals; b.diffSumme += m.diff;
    if (ourGoals > oppGoals) b.s++; else if (ourGoals < oppGoals) b.n++; else b.u++;
}

// Punkte je Spiel einer Bilanz-Zeile (Sieg 3, Remis 1)
function presetPunkteProSpiel(b) { return b && b.spiele ? (3 * b.s + b.u) / b.spiele : 0; }

// Beste Vorlage einer Saison: höchste Punkte je Spiel bei mindestens drei Einsätzen
function findeBesteVorlage(eintraege) {
    const kand = Object.values(eintraege || {}).filter(b => b.spiele >= 3);
    kand.sort((a, b) => (presetPunkteProSpiel(b) - presetPunkteProSpiel(a)) || (b.spiele - a.spiele));
    return kand[0] || null;
}

// Saisonende: die Bilanz der Saison ins Archiv (die letzten fünf Saisons), danach beginnt sie von vorn
function archiveVorlageBilanz() {
    ensureVorlageBilanz();
    if (!Array.isArray(game.vorlageBilanzArchiv)) game.vorlageBilanzArchiv = [];
    const eintraege = game.vorlageBilanz;
    if (!Object.values(eintraege).some(b => b.spiele > 0)) return;
    game.vorlageBilanzArchiv.push({ season: game.season, eintraege: JSON.parse(JSON.stringify(eintraege)) });
    while (game.vorlageBilanzArchiv.length > 5) game.vorlageBilanzArchiv.shift();
    const beste = findeBesteVorlage(eintraege);
    if (beste && typeof addInboxMessage === 'function') {
        addInboxMessage('info', `📈 Vorlagen-Bilanz Saison ${game.season}`, `Beste Aufstellungsvorlage: „${beste.name}“ mit ${beste.s}S ${beste.u}U ${beste.n}N (${presetPunkteProSpiel(beste).toFixed(2).replace('.', ',')} Punkte je Spiel).`, 'screen-squad');
    }
    game.vorlageBilanz = {};
}

function renderPresetBilanzBox() {
    const box = document.getElementById('preset-bilanz-box');
    if (!box) return;
    ensureVorlageBilanz();
    const archiv = Array.isArray(game.vorlageBilanzArchiv) ? game.vorlageBilanzArchiv : [];
    const zeile = b => `${mpEsc(b.name)}: ${b.s}S ${b.u}U ${b.n}N · Tore ${b.tore}:${b.gegentore} · ${presetPunkteProSpiel(b).toFixed(2).replace('.', ',')} Pkt/Spiel`;
    const block = (titel, eintraege) => {
        const liste = Object.values(eintraege).filter(b => b.spiele > 0).sort((a, b) => presetPunkteProSpiel(b) - presetPunkteProSpiel(a));
        if (!liste.length) return '';
        const beste = findeBesteVorlage(eintraege);
        return `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:8px 0 2px;">${titel}</div>`
            + liste.map(b => `<div class="box" style="font-size:var(--fs-small); margin:3px 0;">${beste && beste.name === b.name ? '🏅 ' : ''}${zeile(b)}</div>`).join('');
    };
    const aktuell = block(`Saison ${game.season} (laufend)`, game.vorlageBilanz);
    const alt = [...archiv].reverse().map(a => block(`Saison ${a.season}`, a.eintraege)).join('');
    box.innerHTML = `<div class="panel-header" style="color:var(--purple);">📈 Bilanz der Aufstellungsvorlagen</div>`
        + (aktuell || alt ? aktuell + alt + '<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">🏅 = beste Vorlage der Saison (Punkte je Spiel, mindestens drei Einsätze). Gezählt werden Ligaspiele, bei denen die Startelf einer gespeicherten Vorlage entsprach.</div>'
            : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch keine Daten. Speichere im Reiter Aufstellung eine Vorlage und starte damit Ligaspiele.</div>');
}

function getPresetBilanzText(slot) {
    ensureVorlageBilanz();
    const b = game.vorlageBilanz[slot];
    if (!b || !b.spiele) return '';
    const v = game.lineupPresets[slot];
    if (v && v.name !== b.name) return ''; // Slot wurde seither neu belegt: die alte Bilanz gehört zu einer anderen Vorlage
    return `diese Saison ${b.s}S ${b.u}U ${b.n}N · Tore ${b.tore}:${b.gegentore} · Ø ${b.diffSumme / b.spiele >= 0 ? '+' : ''}${(b.diffSumme / b.spiele).toFixed(1)} gegen den Gegner`;
}

// Teamstärke einer Elf mit Formation, ohne die Aufstellung zu verändern (Elf und Formation werden kurz getauscht)
function getLineupStrengthPreview(ids, formation, istHeim) {
    const altElf = lineup, altForm = game.formation;
    try {
        lineup = ids;
        if (formation) game.formation = formation;
        return calcTeamStrength(istHeim);
    } finally {
        lineup = altElf;
        game.formation = altForm;
    }
}

// Spieltag-Check: Vorlage mit einem Tipp aufstellen, davor die Stärke gegen den Gegner sehen
function applyPresetPrematch(slot) {
    loadLineupPreset(slot);
    renderPrematchCheck();
}

function renderPresetQuickPick() {
    ensureMatchPrepState();
    const info = typeof pendingMatchInfo !== 'undefined' ? pendingMatchInfo : null;
    const istHeim = info ? !!info.isHome : true;
    const gegner = info && typeof info.oppStr === 'number' ? info.oppStr : null;
    const chipGegen = st => gegner === null ? '' : (d => uiChip(`${d >= 0 ? '+' : ''}${d.toFixed(1)} gegen den Gegner`, d >= 3 ? 'gut' : (d <= -3 ? 'schlecht' : 'warn')))(st - gegner);
    const aktuell = lineup.length === 11 ? getLineupStrengthPreview(lineup, game.formation, istHeim) : null;
    const kopf = aktuell === null ? '' : `<div class="box" style="font-size:var(--fs-small); margin:4px 0;"><strong>Aktuelle Elf</strong> (${game.formation}): Stärke ${aktuell.toFixed(1)}${gegner !== null ? ` · Gegner ${gegner.toFixed(1)}` : ''}<div class="ui-card-meta" style="margin-top:4px;">${chipGegen(aktuell)}</div></div>`;
    const zeilen = game.lineupPresets.map((v, i) => {
        if (!v) return '';
        const r = resolveLineupPreset(v);
        if (!r) return `<div class="box" style="font-size:var(--fs-small); margin:4px 0;"><strong>${mpEsc(v.name)}</strong> · zu wenig einsatzbereite Spieler</div>`;
        const st = getLineupStrengthPreview(r.ids, v.formation, istHeim);
        const delta = aktuell === null ? null : st - aktuell;
        const gleich = r.ids.length === lineup.length && r.ids.every((id, k) => id === lineup[k]) && v.formation === game.formation;
        return `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">
            <strong>${mpEsc(v.name)}</strong> (${v.formation}): Stärke ${st.toFixed(1)}${delta === null ? '' : ` <span style="color:var(--text-muted);">(${delta >= 0 ? '+' : ''}${delta.toFixed(1)} zur aktuellen Elf)</span>`}
            <div class="ui-card-meta" style="margin-top:4px;">${getPresetBilanzText(i) ? uiChip(`📈 ${getPresetBilanzText(i)}`) : ''}${chipGegen(st)}${r.ersetzt ? uiChip(`🔁 ${r.ersetzt} Ausfall${r.ersetzt === 1 ? '' : 'e'} ersetzt`, 'warn') : uiChip('✓ komplett', 'gut')}${gleich ? uiChip('aktuell aufgestellt', 'gut') : ''}</div>
            <button onclick="applyPresetPrematch(${i})" class="btn-action" style="margin-top:4px;"${gleich ? ' disabled' : ''}>📂 Aufstellen</button></div>`;
    }).join('');
    return kopf + (zeilen || '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch keine Aufstellungsvorlage gespeichert (Kader → Aufstellung).</div>');
}

function renderLineupPresets() {
    const box = document.getElementById('lineup-presets-box');
    if (!box) return;
    ensureMatchPrepState();
    const zeilen = game.lineupPresets.map((v, i) => {
        const ausfall = v ? v.ids.filter(id => !mpIstEinsatzbereit(squad.find(p => p.id === id))).length : 0;
        return `<div class="panel player-card" style="margin:0 0 6px; padding:8px 10px;">${renderUiCard({
            title: v ? mpEsc(v.name) : `Slot ${i + 1} (leer)`,
            sub: v ? `${v.formation} · ${v.ids.length} Spieler` : 'Noch keine Aufstellung gespeichert',
            meta: [v && ausfall ? uiChip(`⚠️ ${ausfall} Ausfall${ausfall === 1 ? '' : 'e'}`, 'warn') : '', v && !ausfall ? uiChip('✓ komplett', 'gut') : '', v && getPresetBilanzText(i) ? uiChip(`📈 ${getPresetBilanzText(i)}`) : ''],
            actions: `<button onclick="saveLineupPreset(${i})" class="btn-secondary">💾 Speichern</button>`
                + (v ? `<button onclick="loadLineupPreset(${i})" class="btn-action">📂 Laden</button><button onclick="deleteLineupPreset(${i})" class="btn-secondary" style="color:var(--danger);" title="Vorlage ${i + 1} löschen">✕ Löschen</button>` : '')
        })}</div>`;
    }).join('');
    box.innerHTML = `<div class="panel-header">📋 Aufstellungsvorlagen</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Speichert die aktuelle Startelf samt Formation, zum Beispiel für Heim, Auswärts oder Pokal. Ausgefallene Spieler ersetzt der Trainer beim Laden.</div>
        <label class="ui-field" style="margin-bottom:8px;"><span class="ui-field-label">Name für neue Vorlage</span>
            <input id="lineup-preset-name" class="input-inline" maxlength="24" placeholder="z. B. Heimspiel Offensive" style="width:100%;"></label>
        ${zeilen}`;
}

// ---------- Taktikvorlagen ----------

function saveTacticPreset(slot) {
    ensureMatchPrepState();
    const eingabe = document.getElementById('tactic-preset-name');
    const name = (eingabe && eingabe.value.trim()) || `Taktik ${slot + 1}`;
    game.tacticPresets[slot] = { name: name.slice(0, 24), formation: game.formation, style: game.tacticStyle, hardness: game.tackleHardness };
    if (eingabe) eingabe.value = '';
    showToast(`💾 Taktik „${name.slice(0, 24)}“ in Slot ${slot + 1} gespeichert.`, 'success');
    renderTacticPresets();
}

function deleteTacticPreset(slot) {
    ensureMatchPrepState();
    if (!game.tacticPresets[slot]) return;
    game.tacticPresets[slot] = null;
    renderTacticPresets();
}

// Live ändert sich nur die Form (liveSet*), nie die Kaderauswahl; im Menü gelten die normalen Setter
function applyTacticPreset(slot) {
    ensureMatchPrepState();
    const v = game.tacticPresets[slot];
    if (!v) { showToast('Dieser Slot ist leer - speichere zuerst eine Taktik.', 'error'); return; }
    if (mpLiveAktiv()) {
        if (typeof liveSetFormation === 'function' && v.formation !== game.formation) liveSetFormation(v.formation);
        if (typeof liveSetTacticStyle === 'function' && v.style !== game.tacticStyle) liveSetTacticStyle(v.style);
        if (typeof liveSetTackleHardness === 'function' && v.hardness !== game.tackleHardness) liveSetTackleHardness(v.hardness);
    } else {
        if (v.formation !== game.formation) setFormation(v.formation);
        setTacticStyle(v.style);
        setTackleHardness(v.hardness);
    }
    showToast(`📂 Taktik „${v.name}“ übernommen.`, 'success');
    renderTacticPresets();
}

function mpTaktikText(v) {
    const cfg = typeof TACTIC_STYLE_CONFIG !== 'undefined' ? TACTIC_STYLE_CONFIG[v.style] : null;
    return `${v.formation} · ${cfg ? cfg.label : v.style} · ${v.hardness}`;
}

function renderTacticPresets() {
    ensureMatchPrepState();
    const box = document.getElementById('tactic-presets-box');
    if (box) {
        const zeilen = game.tacticPresets.map((v, i) => `<div class="panel player-card" style="margin:0 0 6px; padding:8px 10px;">${renderUiCard({
            title: v ? mpEsc(v.name) : `Slot ${i + 1} (leer)`,
            sub: v ? mpTaktikText(v) : 'Noch keine Taktik gespeichert',
            meta: [v && v.formation === game.formation && v.style === game.tacticStyle && v.hardness === game.tackleHardness ? uiChip('● aktiv', 'gut') : ''],
            actions: `<button onclick="saveTacticPreset(${i})" class="btn-secondary">💾 Aktuelle speichern</button>`
                + (v ? `<button onclick="applyTacticPreset(${i})" class="btn-action">📂 Übernehmen</button><button onclick="deleteTacticPreset(${i})" class="btn-secondary" style="color:var(--danger);" title="Taktik ${i + 1} löschen">✕ Löschen</button>` : '')
        })}</div>`).join('');
        box.innerHTML = `<div class="panel-header">📋 Taktikvorlagen</div>
            <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Formation, Spielstil und Zweikampfhärte als Paket. Im Livespiel lassen sich die Vorlagen mit einem Tipp übernehmen.</div>
            <label class="ui-field" style="margin-bottom:8px;"><span class="ui-field-label">Name für neue Taktik</span>
                <input id="tactic-preset-name" class="input-inline" maxlength="24" placeholder="z. B. Führung verwalten" style="width:100%;"></label>
            ${zeilen}`;
    }
    renderLiveTacticPresets();
}

// Kleine Schnellwahl im Live-Panel: nur gespeicherte Vorlagen
function renderLiveTacticPresets() {
    const box = document.getElementById('live-tactic-presets');
    if (!box) return;
    ensureMatchPrepState();
    const knoepfe = game.tacticPresets.map((v, i) => v
        ? `<button onclick="applyTacticPreset(${i})" class="btn-secondary" style="font-size:var(--fs-micro); padding:4px 6px;" title="${mpEsc(mpTaktikText(v))}">${mpEsc(v.name)}</button>` : '').join('');
    box.innerHTML = knoepfe ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin:4px 0 2px;">Taktikvorlagen:</div><div style="display:flex; flex-wrap:wrap; gap:4px;">${knoepfe}</div>` : '';
}

function renderMatchPrepPanels() {
    renderLineupPresets();
    renderTacticPresets();
    renderGegnerNotizbuch();
    renderPresetBilanzBox();
    if (typeof renderTagBilanzBox === 'function') renderTagBilanzBox();
    renderGegnerBilanzBox();
}

// ---------- Spieltag-Check vor dem Anpfiff ----------

// Probleme der aktuellen Startelf: nur Dinge, die der Spieler wirklich ändern kann
function getLineupProblems() {
    const probleme = [];
    const elf = lineup.map(id => squad.find(p => p.id === id)).filter(Boolean);
    if (elf.length !== 11) probleme.push({ ton: 'schlecht', text: `Nur ${elf.length} Spieler in der Startelf (nötig: 11).` });
    elf.filter(p => !mpIstEinsatzbereit(p)).forEach(p => probleme.push({ ton: 'schlecht', text: `${p.name} ist ${(p.injured || 0) > 0 ? 'verletzt' : 'gesperrt'} und steht trotzdem in der Elf.` }));
    if (!elf.some(p => p.pos === 'TW')) probleme.push({ ton: 'schlecht', text: 'Kein Torwart in der Startelf.' });
    const linien = MP_FORMATION_LINES[game.formation];
    if (linien) {
        const ist = { ABW: elf.filter(p => p.pos === 'ABW').length, MIT: elf.filter(p => p.pos === 'MIT').length, ST: elf.filter(p => p.pos === 'ST').length };
        [['ABW', linien[0], 'Verteidiger'], ['MIT', linien[1], 'Mittelfeldspieler'], ['ST', linien[2], 'Stürmer']].forEach(([pos, soll, name]) => {
            if (ist[pos] !== soll) probleme.push({ ton: 'warn', text: `${game.formation} sieht ${soll} ${name} vor, in der Elf stehen ${ist[pos]}.` });
        });
    }
    elf.filter(p => Array.isArray(p.tags) && p.tags.includes('schonen')).forEach(p => probleme.push({ ton: 'warn', text: `${p.name} ist als „Schonen“ etikettiert und steht in der Startelf.` }));
    return probleme;
}

// Wer fehlt, mit Rückkehr: Verletzte (Spieltage) und Gesperrte (Spiele)
function getAbsentPlayers() {
    const top = [...squad].sort((a, b) => b.strength - a.strength).slice(0, 11).map(p => p.id);
    const liste = [];
    squad.forEach(p => {
        if ((p.injured || 0) > 0) liste.push({ p, grund: 'verletzt', tage: p.injured, stamm: top.includes(p.id) });
        else if ((p.suspended || 0) > 0) liste.push({ p, grund: 'gesperrt', tage: p.suspended, stamm: top.includes(p.id) });
    });
    return liste.sort((a, b) => (b.stamm - a.stamm) || (b.p.strength - a.p.strength));
}

// Tauschvorschläge für müde Stammspieler: gleiche Position, deutlich frischer, nicht effektiv schwächer
function getRotationSuggestions() {
    const eff = p => p.strength * (p.fitness / 100);
    const bank = squad.filter(p => !lineup.includes(p.id) && mpIstEinsatzbereit(p));
    const belegt = new Set();
    const vorschlaege = [];
    lineup.map(id => squad.find(p => p.id === id)).filter(p => p && mpIstEinsatzbereit(p) && p.fitness < 80)
        .sort((a, b) => a.fitness - b.fitness).forEach(starter => {
            const kandidat = bank.filter(b => !belegt.has(b.id) && b.pos === starter.pos && b.fitness >= starter.fitness + 15 && eff(b) >= eff(starter) - 1)
                .sort((a, b) => eff(b) - eff(a))[0];
            if (kandidat) { belegt.add(kandidat.id); vorschlaege.push({ raus: starter, rein: kandidat, delta: Math.round((eff(kandidat) - eff(starter)) * 10) / 10 }); }
            else if (starter.fitness < 60) vorschlaege.push({ raus: starter, rein: null, delta: 0 });
        });
    // Belastungsampel (Phase 26.16): auch wer rot ist oder bei Gelb im Dauereinsatz steht, bekommt eine Pause vorgeschlagen,
    // selbst wenn die Fitness allein noch keine Rotation auslöst (lockerere Grenzen, der Ersatz darf nicht selbst rot sein)
    const mitTausch = new Set(vorschlaege.filter(v => v.rein).map(v => v.raus.id));
    lineup.map(id => squad.find(p => p.id === id)).filter(p => p && mpIstEinsatzbereit(p) && !mitTausch.has(p.id)).forEach(starter => {
        const a = typeof getBelastungsAmpel === 'function' ? getBelastungsAmpel(starter) : null;
        if (!a || !(a.stufe === 'rot' || (a.stufe === 'gelb' && a.gruende.some(g => g.startsWith('5 von 5'))))) return;
        const kandidat = bank.filter(b => !belegt.has(b.id) && b.pos === starter.pos && b.fitness >= 70 && getBelastungsAmpel(b).stufe !== 'rot' && eff(b) >= eff(starter) - 3)
            .sort((x, y) => eff(y) - eff(x))[0];
        if (!kandidat) return;
        const alt = vorschlaege.findIndex(v => v.raus.id === starter.id);
        if (alt !== -1) vorschlaege.splice(alt, 1);
        belegt.add(kandidat.id);
        vorschlaege.push({ raus: starter, rein: kandidat, delta: Math.round((eff(kandidat) - eff(starter)) * 10) / 10, grund: 'belastung', gruende: a.gruende });
    });
    return vorschlaege;
}

// Verletzungsanfällige in der Startelf (ab drei Verletzungen wie im Spielerdetail, oder Etikett „Schonen“), mit dem
// stärksten einsatzbereiten Ersatz auf derselben Position. Nur ein Hinweis; getauscht wird auf Tipp.
const MP_FRAGIL_AB = 3;

function getFragileStarters() {
    const bank = squad.filter(p => !lineup.includes(p.id) && mpIstEinsatzbereit(p) && p.fitness >= 60);
    const belegt = new Set();
    return lineup.map(id => squad.find(p => p.id === id)).filter(p => p && mpIstEinsatzbereit(p)
        && ((p.timesInjured || 0) >= MP_FRAGIL_AB || (typeof getPlayerTags === 'function' && getPlayerTags(p).includes('schonen'))))
        .map(p => {
            const rein = bank.filter(b => !belegt.has(b.id) && b.pos === p.pos).sort((a, b) => b.strength - a.strength)[0] || null;
            if (rein) belegt.add(rein.id);
            const gesamt = (Array.isArray(p.injuryLog) ? p.injuryLog : []).reduce((sum, e) => sum + (e.tage || 0), 0);
            return { p, rein, delta: rein ? rein.strength - p.strength : 0, verpasst: gesamt, schonen: typeof getPlayerTags === 'function' && getPlayerTags(p).includes('schonen') };
        });
}

function applyRotationSwap(rausId, reinId) {
    const i = lineup.indexOf(rausId);
    const rein = squad.find(p => p.id === reinId);
    const raus = squad.find(p => p.id === rausId);
    if (i === -1 || !mpIstEinsatzbereit(rein)) { showToast('Dieser Tausch geht nicht mehr - die Elf hat sich geändert.', 'error'); renderPrematchCheck(); return; }
    lineup[i] = reinId;
    showToast(`🔄 ${rein.name} ersetzt ${raus ? raus.name : 'den Mitspieler'}.`, 'success');
    renderPrematchCheck();
}

// ---------- Spieltag-Hilfen (Phase 26.17) ----------

// Tabellen-Vorschau: wo stündest du nach Sieg, Remis oder Niederlage, wenn alle anderen Spiele so stehen blieben?
// Sieg/Niederlage werden als 1:0 bzw. 0:1 gerechnet (Tordifferenz ±1), Remis als 0:0.
function getTabellenVorschau(oppName) {
    const liga = leaguesData[game.leagueLevel] || [];
    if (!liga.some(t => t.name === game.clubName)) return null;
    const ergebnis = (eigene, gegner) => {
        const tab = liga.map(t => ({ ...t }));
        const ich = tab.find(t => t.name === game.clubName), opp = tab.find(t => t.name === oppName);
        const pkt = eigene > gegner ? 3 : eigene === gegner ? 1 : 0;
        ich.points += pkt; ich.goalsFor += eigene; ich.goalsAgainst += gegner; ich.played = (ich.played || 0) + 1;
        if (opp) { opp.points += eigene < gegner ? 3 : eigene === gegner ? 1 : 0; opp.goalsFor += gegner; opp.goalsAgainst += eigene; opp.played = (opp.played || 0) + 1; }
        return tab.sort(compareTableRows).findIndex(t => t.name === game.clubName) + 1;
    };
    const jetzt = [...liga].sort(compareTableRows).findIndex(t => t.name === game.clubName) + 1;
    return { jetzt, sieg: ergebnis(1, 0), remis: ergebnis(0, 0), niederlage: ergebnis(0, 1) };
}

// Lieblings- und Angstgegner aus der Kopf-an-Kopf-Bilanz (game.headToHeadRecords), ab zwei Duellen
const GEGNER_BILANZ_MIN = 2;
function getGegnerBilanzListen() {
    const recs = game.headToHeadRecords || {};
    const alle = Object.keys(recs).map(name => {
        const r = recs[name], n = (r.wins || 0) + (r.draws || 0) + (r.losses || 0);
        return { name, n, s: r.wins || 0, u: r.draws || 0, nl: r.losses || 0, pps: n ? (3 * (r.wins || 0) + (r.draws || 0)) / n : 0 };
    }).filter(x => x.n >= GEGNER_BILANZ_MIN);
    return {
        liebling: alle.filter(x => x.pps >= 2).sort((a, b) => b.pps - a.pps || b.n - a.n).slice(0, 3),
        angst: alle.filter(x => x.pps <= 0.75).sort((a, b) => a.pps - b.pps || b.n - a.n).slice(0, 3)
    };
}

function getGegnerTyp(oppName) {
    const l = getGegnerBilanzListen();
    const e = l.liebling.find(x => x.name === oppName) || l.angst.find(x => x.name === oppName);
    if (!e) return null;
    return { ...e, typ: l.liebling.includes(e) ? 'liebling' : 'angst' };
}

function renderGegnerBilanzBox() {
    const box = document.getElementById('gegner-bilanz-box');
    if (!box) return;
    const l = getGegnerBilanzListen();
    const zeile = x => `<div style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-small); margin:2px 0;"><span style="overflow-wrap:anywhere;">${mpEsc(x.name)}</span><span style="color:var(--text-muted); flex:0 0 auto;">${x.s}S ${x.u}U ${x.nl}N · ${x.pps.toFixed(2).replace('.', ',')}</span></div>`;
    box.innerHTML = '<div class="panel-header" style="color:var(--purple);">😊 Lieblings- und 😬 Angstgegner</div>'
        + (l.liebling.length || l.angst.length
            ? `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:4px 0 2px;">Lieblingsgegner</div>${l.liebling.map(zeile).join('') || '<div style="font-size:var(--fs-caption); color:var(--text-muted);">noch keiner</div>'}
               <div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:8px 0 2px;">Angstgegner</div>${l.angst.map(zeile).join('') || '<div style="font-size:var(--fs-caption); color:var(--text-muted);">noch keiner</div>'}
               <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">Punkte je Spiel in Ligaduellen, ab zwei Duellen. Lieblingsgegner ab 2,0, Angstgegner bis 0,75.</div>`
            : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch zu wenige Duelle. Ab zwei Ligaspielen gegen denselben Verein erscheint er hier.</div>');
}

// Spielstil-Empfehlung: nach der vorhandenen Regel des Taktik-Duells (js/opponent-tactics.js). Ohne Chef-Analyst zählt der
// öffentlich bekannte Grundstil des Gegners, mit Analyst dessen Plan für dieses Spiel.
const STIL_FUER_ARCHETYP = { P: 'pressing', B: 'ballbesitz', K: 'konter' };
function getStilEmpfehlung(oppName) {
    const team = (leaguesData[game.leagueLevel] || []).find(t => t.name === oppName);
    if (!team || typeof getOppTacticPlan !== 'function' || typeof getCounterArchetype !== 'function') return null;
    const plan = getOppTacticPlan(team);
    if (!plan) return null;
    const analyst = (typeof staffMembers !== 'undefined' && staffMembers.analyst && staffMembers.analyst.hired) || (typeof underworld !== 'undefined' && underworld.spyIntelActive);
    const gegner = analyst ? plan.arch : plan.base;
    if (!gegner || gegner === 'N') return null;
    const konter = getCounterArchetype(gegner);
    const stil = konter ? STIL_FUER_ARCHETYP[konter] : null;
    if (!stil) return null;
    const passt = OWN_STYLE_ARCHETYPE[game.tacticStyle] === konter;
    return { gegner, quelle: analyst ? 'laut Analyst' : 'laut Presse', stil, passt };
}

function applyStilEmpfehlung(stil) {
    if (!Object.values(STIL_FUER_ARCHETYP).includes(stil)) { showToast('Unbekannter Spielstil.', 'error'); return; }
    setTacticStyle(stil);
    showToast(`🧠 Spielstil: ${TACTIC_STYLE_CONFIG[stil].label}.`, 'success');
    renderPrematchCheck();
}

// Rekord-Hinweise: Serien, die in diesem Spiel einen Vereinsrekord erreichen oder enden würden
function getRekordHinweise(isHome) {
    if (typeof ensureSerienState === 'function') ensureSerienState(); else return [];
    const akt = game.serien.aktuell || {}, rek = game.serien.rekord || {};
    const n = id => akt[id] || 0, r = id => (rek[id] && rek[id].n) || 0;
    const h = [];
    if (n('sieg') >= 2 && n('sieg') + 1 > r('sieg')) h.push({ ton: 'gut', text: `Mit einem Sieg: neuer Vereinsrekord, ${n('sieg') + 1} Siege in Folge.` });
    if (n('unbesiegt') >= 3 && n('unbesiegt') + 1 > r('unbesiegt')) h.push({ ton: 'gut', text: `Ohne Niederlage: neuer Vereinsrekord, ${n('unbesiegt') + 1} Spiele ungeschlagen.` });
    else if (n('unbesiegt') >= 5) h.push({ ton: 'warn', text: `Bei einer Niederlage endet die Serie von ${n('unbesiegt')} ungeschlagenen Spielen.` });
    if (isHome && n('heimSieg') >= 2 && n('heimSieg') + 1 > r('heimSieg')) h.push({ ton: 'gut', text: `Mit einem Heimsieg: Vereinsrekord, ${n('heimSieg') + 1} Heimsiege in Folge.` });
    if (n('zuNull') >= 2 && n('zuNull') + 1 > r('zuNull')) h.push({ ton: 'gut', text: `Ohne Gegentor: Vereinsrekord, ${n('zuNull') + 1} Spiele zu null.` });
    if (n('ohneSieg') >= 3) h.push({ ton: 'warn', text: `Seit ${n('ohneSieg')} Spielen ohne Sieg${n('ohneSieg') + 1 > r('ohneSieg') ? ' – ohne Sieg heute wäre das ein Negativrekord' : ''}.` });
    if (n('niederlage') >= 2 && n('niederlage') + 1 > r('niederlage')) h.push({ ton: 'schlecht', text: `Bei einer Niederlage: Negativrekord, ${n('niederlage') + 1} Niederlagen in Folge.` });
    return h;
}

// Empfohlene Vorbereitung: Matchplan, sonst Rotationstausche, dazu die Stil-Empfehlung, falls kein Matchplan eine Taktik setzt.
// Zeigt erst, was sich ändern würde; übernommen wird nur auf Tipp.
function getEmpfohleneVorbereitung(oppName) {
    const schritte = [];
    const plan = oppName && typeof getMatchplan === 'function' ? getMatchplan(oppName) : null;
    const planGueltig = plan && (plan.aufstellung !== null || plan.taktik !== null);
    if (planGueltig) schritte.push({ art: 'matchplan', text: `Matchplan anwenden (${plan.aufstellung !== null ? 'Aufstellung „' + game.lineupPresets[plan.aufstellung].name + '“' : 'ohne Aufstellung'}, ${plan.taktik !== null ? 'Taktik „' + game.tacticPresets[plan.taktik].name + '“' : 'ohne Taktik'})` });
    else getRotationSuggestions().filter(r => r.rein).forEach(r => schritte.push({ art: 'tausch', raus: r.raus.id, rein: r.rein.id, text: `${r.raus.name} ↔ ${r.rein.name}` }));
    const stil = oppName ? getStilEmpfehlung(oppName) : null;
    if (stil && !stil.passt && !(planGueltig && plan.taktik !== null)) schritte.push({ art: 'stil', stil: stil.stil, text: `Spielstil ${TACTIC_STYLE_CONFIG[stil.stil].label}` });
    return schritte;
}

function applyEmpfohleneVorbereitung() {
    const oppName = typeof pendingMatchInfo !== 'undefined' && pendingMatchInfo ? pendingMatchInfo.oppName : '';
    const schritte = getEmpfohleneVorbereitung(oppName);
    if (!schritte.length) { showToast('Es gibt gerade nichts zu übernehmen.', 'info'); return; }
    const alt = showToast;
    showToast = () => {}; // Einzelmeldungen der Teilschritte bündeln
    try {
        schritte.forEach(st => {
            if (st.art === 'matchplan') applyMatchplan(oppName);
            else if (st.art === 'tausch' && lineup.includes(st.raus) && !lineup.includes(st.rein)) applyRotationSwap(st.raus, st.rein);
            else if (st.art === 'stil') setTacticStyle(st.stil);
        });
    } finally { showToast = alt; }
    showToast(`✅ Übernommen: ${schritte.map(st => st.text).join(' · ')}`, 'success', 4500);
    renderPrematchCheck();
}

// ---------- Matchplan je Gegner (Phase 26.15) ----------
// Zu einem Gegner merkt sich das Spiel eine Aufstellungs- und/oder Taktikvorlage (nur die Platznummern):
// game.matchplaene = { verein: { aufstellung: Slot | null, taktik: Slot | null } }. Im Spieltag-Check wendet ein Tipp beides an.

function ensureMatchplaene() {
    if (!game.matchplaene || typeof game.matchplaene !== 'object' || Array.isArray(game.matchplaene)) game.matchplaene = {};
}

function getMatchplan(opp) {
    ensureMatchplaene();
    ensureMatchPrepState();
    const m = game.matchplaene[opp];
    if (!m) return null;
    const a = Number.isInteger(m.aufstellung) && game.lineupPresets[m.aufstellung] ? m.aufstellung : null;
    const t = Number.isInteger(m.taktik) && game.tacticPresets[m.taktik] ? m.taktik : null;
    return { aufstellung: a, taktik: t, verwaist: (m.aufstellung != null && a === null) || (m.taktik != null && t === null) };
}

function saveMatchplan(opp) {
    ensureMatchplaene();
    const wert = id => { const el = document.getElementById(id); return el && el.value !== '' ? parseInt(el.value, 10) : null; };
    const aufstellung = wert('matchplan-aufstellung'), taktik = wert('matchplan-taktik');
    if (aufstellung === null && taktik === null) {
        if (game.matchplaene[opp]) { delete game.matchplaene[opp]; showToast(`📋 Matchplan gegen ${opp} gelöscht.`, 'info'); }
        else showToast('Wähle zuerst eine Aufstellungs- oder Taktikvorlage für den Matchplan.', 'error');
    } else {
        game.matchplaene[opp] = { aufstellung, taktik };
        showToast(`📋 Matchplan gegen ${opp} gespeichert.`, 'success');
    }
    renderPrematchCheck();
}

function applyMatchplan(opp) {
    const plan = getMatchplan(opp);
    if (!plan || (plan.aufstellung === null && plan.taktik === null)) { showToast('Für diesen Gegner gibt es keinen gültigen Matchplan.', 'error'); return; }
    // Erst die Taktik, dann die Aufstellung: Die Formation der Aufstellungsvorlage gehört zu genau diesen elf Spielern und gilt
    // deshalb, falls die Taktikvorlage eine andere Formation gespeichert hat (Spielstil und Härte der Taktik bleiben).
    if (plan.taktik !== null) applyTacticPreset(plan.taktik);
    if (plan.aufstellung !== null) loadLineupPreset(plan.aufstellung);
    showToast(`📋 Matchplan gegen ${opp} angewendet.`, 'success');
    renderPrematchCheck();
}

function renderMatchplanSection(opp) {
    ensureMatchPrepState();
    const plan = getMatchplan(opp);
    const raw = (game.matchplaene || {})[opp] || {};
    const optionen = (liste, aktiv) => '<option value="">– keine –</option>' + liste.map((v, i) => v ? `<option value="${i}"${aktiv === i ? ' selected' : ''}>${mpEsc(v.name)}</option>` : '').join('');
    const hatVorlagen = game.lineupPresets.some(Boolean) || game.tacticPresets.some(Boolean);
    const stil = 'width:100%; box-sizing:border-box; text-align:left; font-weight:normal; font-family:inherit;';
    const zeile = !plan ? '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch kein Matchplan gegen diesen Gegner.</div>'
        : `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">Aufstellung: <strong>${plan.aufstellung !== null ? mpEsc(game.lineupPresets[plan.aufstellung].name) : '–'}</strong> · Taktik: <strong>${plan.taktik !== null ? mpEsc(game.tacticPresets[plan.taktik].name) : '–'}</strong>${plan.verwaist ? '<br><span style="color:var(--danger);">Eine verknüpfte Vorlage gibt es nicht mehr.</span>' : ''}
            <button onclick="applyMatchplan(this.dataset.club)" data-club="${mpEsc(opp)}" class="btn-action" style="margin-top:4px;"${plan.aufstellung === null && plan.taktik === null ? ' disabled' : ''}>📋 Matchplan anwenden</button></div>`;
    const formVerschieden = plan && plan.aufstellung !== null && plan.taktik !== null && game.lineupPresets[plan.aufstellung].formation !== game.tacticPresets[plan.taktik].formation;
    const formHinweis = formVerschieden ? `<div style="font-size:var(--fs-caption); color:var(--text-muted);">Die beiden Vorlagen haben verschiedene Formationen: es gilt die der Aufstellung (${mpEsc(game.lineupPresets[plan.aufstellung].formation)}), von der Taktik kommen Spielstil und Härte.</div>` : '';
    return zeile + formHinweis + (hatVorlagen ? `<label class="ui-field" style="margin-top:6px;"><span class="ui-field-label">Aufstellungsvorlage</span><select id="matchplan-aufstellung" class="input-inline" style="${stil}">${optionen(game.lineupPresets, raw.aufstellung)}</select></label>
        <label class="ui-field" style="margin-top:6px;"><span class="ui-field-label">Taktikvorlage</span><select id="matchplan-taktik" class="input-inline" style="${stil}">${optionen(game.tacticPresets, raw.taktik)}</select></label>
        <button onclick="saveMatchplan(this.dataset.club)" data-club="${mpEsc(opp)}" class="btn-secondary" style="margin-top:6px;">💾 Matchplan speichern</button>`
        : '<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:4px;">Speichere zuerst Aufstellungs- oder Taktikvorlagen (Kader → Aufstellung), dann lassen sie sich hier einem Gegner zuordnen.</div>');
}

function renderPrematchCheck() {
    const box = document.getElementById('prematch-check-box');
    if (!box) return;
    const probleme = getLineupProblems();
    const fehlt = getAbsentPlayers();
    const alleRotation = getRotationSuggestions();
    const rotation = alleRotation.filter(r => r.rein);
    const ohneErsatz = alleRotation.filter(r => !r.rein).map(r => r.raus.name);
    const stammFehlt = fehlt.filter(x => x.stamm).length;
    const muede = squad.filter(p => lineup.includes(p.id) && mpIstEinsatzbereit(p) && p.fitness < 70);
    const oppName = typeof pendingMatchInfo !== 'undefined' && pendingMatchInfo ? pendingMatchInfo.oppName : '';
    const notiz = oppName ? getGegnerNotiz(oppName) : null;
    const fragil = getFragileStarters();
    const istHeim = typeof pendingMatchInfo !== 'undefined' && pendingMatchInfo ? !!pendingMatchInfo.isHome : true;
    const vorschau = oppName ? getTabellenVorschau(oppName) : null;
    const gegnerTyp = oppName ? getGegnerTyp(oppName) : null;
    const stilTipp = oppName ? getStilEmpfehlung(oppName) : null;
    const rekorde = getRekordHinweise(istHeim);
    const empfohlen = oppName ? getEmpfohleneVorbereitung(oppName) : [];
    const chips = [
        probleme.length ? uiChip(`⚠️ ${probleme.length} Hinweis${probleme.length === 1 ? '' : 'e'}`, probleme.some(x => x.ton === 'schlecht') ? 'schlecht' : 'warn') : uiChip('✓ Elf in Ordnung', 'gut'),
        uiChip(`🩹 ${fehlt.length} fehlen${stammFehlt ? ` (${stammFehlt} Stammspieler)` : ''}`, stammFehlt ? 'warn' : ''),
        muede.length ? uiChip(`😮‍💨 ${muede.length} erschöpft`, muede.some(p => p.fitness < 50) ? 'schlecht' : 'warn') : '',
        rotation.length ? uiChip(`🔄 ${rotation.length} Rotationsidee${rotation.length === 1 ? '' : 'n'}`, 'warn') : '',
        fragil.length ? uiChip(`🩹 ${fragil.length} verletzungsanfällig`, 'warn') : '',
        notiz ? uiChip('📓 Notiz vorhanden') : '',
        oppName && getMatchplan(oppName) ? uiChip('📋 Matchplan vorhanden', 'gut') : '',
        gegnerTyp ? uiChip(gegnerTyp.typ === 'liebling' ? `😊 Lieblingsgegner (${gegnerTyp.s}S ${gegnerTyp.u}U ${gegnerTyp.nl}N)` : `😬 Angstgegner (${gegnerTyp.s}S ${gegnerTyp.u}U ${gegnerTyp.nl}N)`, gegnerTyp.typ === 'liebling' ? 'gut' : 'warn') : '',
        notiz ? notizTagChips(notiz) : ''
    ];
    const problemListe = probleme.length ? probleme.map(x => `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">${x.ton === 'schlecht' ? '🔴' : '🟡'} ${mpEsc(x.text)}</div>`).join('')
        : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Torwart und Formation passen.</div>';
    const fehltListe = fehlt.length ? fehlt.map(x => `<div class="box" style="font-size:var(--fs-small); margin:4px 0; display:flex; justify-content:space-between; gap:8px;"><span>${mpEsc(x.p.name)} (${x.p.pos}, Str ${x.p.strength})${x.stamm ? ' ⭐' : ''}</span><span style="color:var(--text-muted);">${x.grund}, noch ${x.tage} ${x.grund === 'verletzt' ? 'Spieltag' + (x.tage === 1 ? '' : 'e') : 'Spiel' + (x.tage === 1 ? '' : 'e')}</span></div>`).join('')
        : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Der komplette Kader ist einsatzbereit.</div>';
    const muedeZeile = muede.length ? `<div class="box" style="font-size:var(--fs-small); margin:4px 0; border-left-color:var(--danger);">😮‍💨 <strong>${muede.length} Stammspieler erschöpft:</strong> ${muede.map(p => `${mpEsc(p.name)} (${p.fitness} %)`).join(', ')}. Fitness zählt voll in die Teamstärke.${ohneErsatz.length ? ` Für ${ohneErsatz.map(mpEsc).join(', ')} gibt es auf der Bank keinen gleichwertigen Ersatz.` : ''}
            <button onclick="rotateTiredPlayers()" class="btn-action" style="margin-top:6px;">🔄 Ausgeruhte Elf aufstellen</button></div>` : '';
    const rotListe = muedeZeile + (rotation.length ? rotation.map(r => `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">${mpEsc(r.raus.name)} (${r.raus.pos}, ${r.raus.fitness} % fit) ↔ ${mpEsc(r.rein.name)} (${r.rein.fitness} % fit)
            <span style="color:var(--text-muted);">· effektive Stärke ${r.delta >= 0 ? '+' : ''}${r.delta}</span>${r.grund === 'belastung' ? `<br><span style="color:var(--text-muted);">🚦 Belastung: ${mpEsc(r.gruende.join(', '))}</span>` : ''}
            <button onclick="applyRotationSwap('${r.raus.id}', '${r.rein.id}')" class="btn-secondary" style="margin-top:4px;">🔄 Tauschen</button></div>`).join('')
        : (muede.length ? '' : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Keine Rotation nötig: alle Stammspieler sind ausgeruht oder ohne frischen Ersatz.</div>'));
    const fragilZeile = fragil.length ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin:2px 0 4px;">Wer oft ausfällt oder das Etikett „Schonen“ trägt, hat im Spiel ein höheres Verletzungsrisiko. Ob du ihn heute aufstellst, entscheidest du.</div>` + fragil.map(f => `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">${mpEsc(f.p.name)} (${f.p.pos}, Str ${f.p.strength}): ${f.schonen ? '🛌 Schonen' : ''}${f.schonen && (f.p.timesInjured || 0) >= MP_FRAGIL_AB ? ', ' : ''}${(f.p.timesInjured || 0) >= MP_FRAGIL_AB ? `${f.p.timesInjured} Verletzungen${f.verpasst ? `, zuletzt ${f.verpasst} Spiele verpasst` : ''}` : ''}
            ${f.rein ? `<div style="margin-top:4px;">Ersatz: ${mpEsc(f.rein.name)} (Str ${f.rein.strength}, ${f.rein.fitness} % fit) <span style="color:var(--text-muted);">· ${f.delta >= 0 ? '+' : ''}${f.delta} Stärke</span></div>
            <button onclick="applyRotationSwap('${f.p.id}', '${f.rein.id}')" class="btn-secondary" style="margin-top:4px;">🔄 Schonen und ${mpEsc(f.rein.name)} bringen</button>` : '<div style="color:var(--text-muted); margin-top:4px;">Kein einsatzbereiter Ersatz auf dieser Position.</div>'}</div>`).join('')
        : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Niemand in der Startelf fällt auffällig oft aus.</div>';
    box.innerHTML = `<div class="panel" style="margin-bottom:8px;">
        <div class="panel-header">🧾 Spieltag-Check</div>
        <div class="ui-card-meta" style="margin-bottom:6px;">${chips.join('')}</div>
        ${vorschau ? `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">📊 Nach diesem Spiel (andere Ergebnisse wie jetzt, Platz ${vorschau.jetzt}): <strong>Sieg Platz ${vorschau.sieg}</strong> · Remis Platz ${vorschau.remis} · Niederlage Platz ${vorschau.niederlage}</div>` : ''}
        ${rekorde.map(x => `<div class="box" style="font-size:var(--fs-small); margin:4px 0; border-left-color:${x.ton === 'gut' ? 'var(--primary)' : x.ton === 'schlecht' ? 'var(--danger)' : 'var(--accent)'};">🏅 ${x.text}</div>`).join('')}
        ${stilTipp ? `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">🧠 ${mpEsc(oppName)} spielt ${stilTipp.quelle} meist ${ARCHETYPE_LABELS[stilTipp.gegner]}. ${stilTipp.passt ? `Dein Spielstil passt (+${TACTIC_MATCHUP_BONUS} im Taktik-Duell).` : `Dagegen hilft ${TACTIC_STYLE_CONFIG[stilTipp.stil].label} (+${TACTIC_MATCHUP_BONUS} im Taktik-Duell, andere Wirkungen des Stils bleiben).
            <button onclick="applyStilEmpfehlung('${stilTipp.stil}')" class="btn-secondary" style="margin-top:4px;">🧠 ${TACTIC_STYLE_CONFIG[stilTipp.stil].label} übernehmen</button>`}</div>` : ''}
        ${empfohlen.length ? `<div class="box" style="font-size:var(--fs-small); margin:4px 0; border-left-color:var(--primary);"><strong>✅ Empfohlene Vorbereitung</strong><ul style="margin:4px 0 4px 18px; padding:0;">${empfohlen.map(st => `<li style="overflow-wrap:anywhere;">${mpEsc(st.text)}</li>`).join('')}</ul>
            <button onclick="applyEmpfohleneVorbereitung()" class="btn-action">Alles übernehmen (${empfohlen.length})</button></div>` : ''}
        <details class="ui-fold"${probleme.length ? ' open' : ''}><summary>Aufstellungs-Check</summary>${problemListe}</details>
        <details class="ui-fold"${fehlt.length ? ' open' : ''}><summary>Wer fehlt?</summary>${fehltListe}</details>
        <details class="ui-fold"${rotation.length || muede.length ? ' open' : ''}><summary>Rotations-Assistent</summary>${rotListe}
            <button onclick="showScreen('screen-squad')" class="btn-secondary" style="margin-top:4px;">⚽ Aufstellung im Detail ändern</button></details>
        <details class="ui-fold"${fragil.length ? ' open' : ''}><summary>Verletzungsanfällige in der Startelf</summary>${fragilZeile}</details>
        ${oppName ? `<details class="ui-fold"${getMatchplan(oppName) ? ' open' : ''}><summary>📋 Matchplan: ${mpEsc(oppName)}</summary>${renderMatchplanSection(oppName)}</details>` : ''}
        <details class="ui-fold"><summary>Aufstellung aus Vorlage</summary>${renderPresetQuickPick()}</details>
        ${oppName ? `<details class="ui-fold"${notiz ? ' open' : ''}><summary>📓 Notizbuch: ${mpEsc(oppName)}</summary>${renderGegnerNotizSection(oppName)}</details>` : ''}
    </div>`;
}
