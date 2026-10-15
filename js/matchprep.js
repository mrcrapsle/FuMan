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

function ensureGegnerNotizen() {
    if (!game.gegnerNotizen || typeof game.gegnerNotizen !== 'object' || Array.isArray(game.gegnerNotizen)) game.gegnerNotizen = {};
}

function getGegnerNotiz(name) {
    ensureGegnerNotizen();
    return game.gegnerNotizen[name] || null;
}

function saveGegnerNotiz(name) {
    ensureGegnerNotizen();
    const feld = document.getElementById('gegner-notiz-text');
    const text = feld ? feld.value.trim().slice(0, GEGNER_NOTIZ_MAX) : '';
    if (!name) return;
    if (!text) {
        if (game.gegnerNotizen[name]) { delete game.gegnerNotizen[name]; showToast(`📓 Notiz zu ${name} gelöscht.`, 'info'); }
        else showToast('Schreibe zuerst etwas in das Notizfeld.', 'error');
    } else {
        game.gegnerNotizen[name] = { text, season: game.season, matchday: game.matchday };
        showToast(`📓 Notiz zu ${name} gespeichert.`, 'success');
    }
    if (typeof renderPrematchCheck === 'function') renderPrematchCheck();
    renderGegnerNotizbuch();
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

function renderGegnerNotizSection(oppName) {
    if (!oppName) return '';
    const n = getGegnerNotiz(oppName);
    return `<div class="box" style="font-size:var(--fs-small); margin:0 0 6px;">📊 ${mpEsc(getGegnerBilanzText(oppName))}</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:4px;">${n ? `Gespeichert in Saison ${n.season}, Spieltag ${n.matchday}.` : 'Noch keine Notiz zu diesem Gegner.'} Die Notiz bleibt über Saisons erhalten.</div>
        <textarea id="gegner-notiz-text" class="input-inline" maxlength="${GEGNER_NOTIZ_MAX}" rows="3" placeholder="z. B. Schwache Abwehr über links, Konter nach Ecken" style="width:100%;" aria-label="Notiz zu ${mpEsc(oppName)}">${mpEsc(n ? n.text : '')}</textarea>
        <button onclick="saveGegnerNotiz(this.dataset.club)" data-club="${mpEsc(oppName)}" class="btn-secondary" style="margin-top:4px;">📓 Notiz speichern</button>`;
}

// Alle Notizen im Reiter Analyse
function renderGegnerNotizbuch() {
    const box = document.getElementById('opp-notes-box');
    if (!box) return;
    ensureGegnerNotizen();
    const namen = Object.keys(game.gegnerNotizen).sort((a, b) => a.localeCompare(b));
    box.innerHTML = `<div class="panel-header" style="color:var(--purple);">📓 Notizbuch: Gegner</div>`
        + (namen.length ? namen.map(n => `<div class="box" style="font-size:var(--fs-small); margin:4px 0;"><div style="display:flex; justify-content:space-between; gap:8px; align-items:center;"><strong>${mpEsc(n)}</strong><button onclick="deleteGegnerNotiz(this.dataset.club)" data-club="${mpEsc(n)}" class="btn-secondary" style="width:auto; color:var(--danger);" title="Notiz zu ${mpEsc(n)} löschen">🗑️</button></div>${mpEsc(game.gegnerNotizen[n].text)}<div style="color:var(--text-muted); font-size:var(--fs-caption);">Saison ${game.gegnerNotizen[n].season}, Spieltag ${game.gegnerNotizen[n].matchday}</div></div>`).join('')
            : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Noch keine Notizen. Vor dem Anpfiff gibt es im Spieltag-Check ein Notizfeld zum Gegner.</div>');
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
    return vorschlaege;
}

function applyRotationSwap(rausId, reinId) {
    const i = lineup.indexOf(rausId);
    const rein = squad.find(p => p.id === reinId);
    if (i === -1 || !mpIstEinsatzbereit(rein)) { showToast('Dieser Tausch geht nicht mehr - die Elf hat sich geändert.', 'error'); renderPrematchCheck(); return; }
    lineup[i] = reinId;
    showToast(`🔄 ${rein.name} ersetzt den müden Mitspieler.`, 'success');
    renderPrematchCheck();
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
    const chips = [
        probleme.length ? uiChip(`⚠️ ${probleme.length} Hinweis${probleme.length === 1 ? '' : 'e'}`, probleme.some(x => x.ton === 'schlecht') ? 'schlecht' : 'warn') : uiChip('✓ Elf in Ordnung', 'gut'),
        uiChip(`🩹 ${fehlt.length} fehlen${stammFehlt ? ` (${stammFehlt} Stammspieler)` : ''}`, stammFehlt ? 'warn' : ''),
        muede.length ? uiChip(`😮‍💨 ${muede.length} erschöpft`, muede.some(p => p.fitness < 50) ? 'schlecht' : 'warn') : '',
        rotation.length ? uiChip(`🔄 ${rotation.length} Rotationsidee${rotation.length === 1 ? '' : 'n'}`, 'warn') : '',
        notiz ? uiChip('📓 Notiz vorhanden') : ''
    ];
    const problemListe = probleme.length ? probleme.map(x => `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">${x.ton === 'schlecht' ? '🔴' : '🟡'} ${mpEsc(x.text)}</div>`).join('')
        : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Torwart und Formation passen.</div>';
    const fehltListe = fehlt.length ? fehlt.map(x => `<div class="box" style="font-size:var(--fs-small); margin:4px 0; display:flex; justify-content:space-between; gap:8px;"><span>${mpEsc(x.p.name)} (${x.p.pos}, Str ${x.p.strength})${x.stamm ? ' ⭐' : ''}</span><span style="color:var(--text-muted);">${x.grund}, noch ${x.tage} ${x.grund === 'verletzt' ? 'Spieltag' + (x.tage === 1 ? '' : 'e') : 'Spiel' + (x.tage === 1 ? '' : 'e')}</span></div>`).join('')
        : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Der komplette Kader ist einsatzbereit.</div>';
    const muedeZeile = muede.length ? `<div class="box" style="font-size:var(--fs-small); margin:4px 0; border-left-color:var(--danger);">😮‍💨 <strong>${muede.length} Stammspieler erschöpft:</strong> ${muede.map(p => `${mpEsc(p.name)} (${p.fitness} %)`).join(', ')}. Fitness zählt voll in die Teamstärke.${ohneErsatz.length ? ` Für ${ohneErsatz.map(mpEsc).join(', ')} gibt es auf der Bank keinen gleichwertigen Ersatz.` : ''}
            <button onclick="rotateTiredPlayers()" class="btn-action" style="margin-top:6px;">🔄 Ausgeruhte Elf aufstellen</button></div>` : '';
    const rotListe = muedeZeile + (rotation.length ? rotation.map(r => `<div class="box" style="font-size:var(--fs-small); margin:4px 0;">${mpEsc(r.raus.name)} (${r.raus.pos}, ${r.raus.fitness} % fit) ↔ ${mpEsc(r.rein.name)} (${r.rein.fitness} % fit)
            <span style="color:var(--text-muted);">· effektive Stärke ${r.delta >= 0 ? '+' : ''}${r.delta}</span>
            <button onclick="applyRotationSwap('${r.raus.id}', '${r.rein.id}')" class="btn-secondary" style="margin-top:4px;">🔄 Tauschen</button></div>`).join('')
        : (muede.length ? '' : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Keine Rotation nötig: alle Stammspieler sind ausgeruht oder ohne frischen Ersatz.</div>'));
    box.innerHTML = `<div class="panel" style="margin-bottom:8px;">
        <div class="panel-header">🧾 Spieltag-Check</div>
        <div class="ui-card-meta" style="margin-bottom:6px;">${chips.join('')}</div>
        <details class="ui-fold"${probleme.length ? ' open' : ''}><summary>Aufstellungs-Check</summary>${problemListe}</details>
        <details class="ui-fold"${fehlt.length ? ' open' : ''}><summary>Wer fehlt?</summary>${fehltListe}</details>
        <details class="ui-fold"${rotation.length || muede.length ? ' open' : ''}><summary>Rotations-Assistent</summary>${rotListe}
            <button onclick="showScreen('screen-squad')" class="btn-secondary" style="margin-top:4px;">⚽ Aufstellung im Detail ändern</button></details>
        <details class="ui-fold"><summary>Aufstellung aus Vorlage</summary>${renderPresetQuickPick()}</details>
        ${oppName ? `<details class="ui-fold"${notiz ? ' open' : ''}><summary>📓 Notizbuch: ${mpEsc(oppName)}</summary>${renderGegnerNotizSection(oppName)}</details>` : ''}
    </div>`;
}
