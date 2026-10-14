// Medizinische Abteilung: Verletzungen entstehen ausschließlich im Nachspiel-Wurf in
// processPostMatchRoutine() (js/match.js). Hier liegen die Faktoren, die dort zusätzlich
// wirken (Trainingsintensität, Alter), das Verletzungs-Helferlein für Ereignisse und das
// eine Panel mit Verletzten und Risiko. Löst drei ältere Parallel-Systeme ab, die eigene
// Verletztenlisten führten und teils Spielerstärke dauerhaft abzogen.

const TRAINING_INTENSITY_INJURY_FACTOR = { hart: 1.25, intensiv: 1.15, normal: 1.0, leicht: 0.88, locker: 0.8, erholung: 0.75 };

function getTrainingIntensityInjuryFactor() {
    return TRAINING_INTENSITY_INJURY_FACTOR[game.trainingIntensity] ?? 1.0;
}

function getAgeInjuryFactor(p) {
    const age = p.age || 25;
    if (age >= 35) return 1.4;
    if (age >= 32) return 1.2;
    if (age <= 21) return 0.85;
    return 1.0;
}

// Relativer Risikoindex je Spieler für die Anzeige (1.0 = Durchschnitt) - dieselben
// individuellen Faktoren wie im echten Verletzungswurf.
function getPlayerInjuryRiskIndex(p) {
    let r = getTrainingIntensityInjuryFactor() * getAgeInjuryFactor(p);
    r *= 1 + Math.min(2.5, (p.timesInjured || 0) * 0.18);
    if ((p.timesInjured || 0) >= 2) r *= 0.72;
    if (game.injuryPreventionProgram) r *= 0.82;
    if (typeof getChronicInjuryFactor === 'function') r *= getChronicInjuryFactor(p);
    if (p.fitness !== undefined && p.fitness < 60) r *= 1.15;
    return r;
}

// Verletzung durch ein Ereignis (z.B. Krise) - gleiche Regeln wie im Spiel: Ausfallzeit,
// Verletzungshistorie, Physio/Reha verkürzen. Keine dauerhaften Stärkeverluste.
function injurePlayerByEvent(p, grund) {
    if (!p || (p.injured || 0) > 0) return false;
    const baseDuration = Math.floor(Math.random() * 4) + 1;
    const reduction = Math.max(0.25, 1 - (campusBuildings.reha.lvl * 0.08) - (staffMembers.physio.hired ? 1 - getPhysioEffekt().ausfall : 0));
    p.injured = Math.max(1, Math.round(baseDuration * reduction));
    p.timesInjured = (p.timesInjured || 0) + 1;
    logPlayerInjury(p, p.injured, grund || 'Ereignis');
    addInboxMessage('verletzung', `${p.name} verletzt`, `${grund ? grund + ': ' : ''}Fällt für ${p.injured} Spiel(e) aus.`, 'screen-squad');
    return true;
}

// Verletzungs-Verlauf je Spieler (Phase 26.6): die letzten acht Ausfälle mit Saison, Spieltag, Dauer und Anlass.
// Reine Anzeige-Buchführung; die Ausfälle selbst entstehen weiter nur im Spiel nach dem Spiel und in injurePlayerByEvent().
function logPlayerInjury(p, tage, anlass) {
    if (!p) return;
    if (!Array.isArray(p.injuryLog)) p.injuryLog = [];
    p.injuryLog.push({ season: game.season, matchday: game.matchday, tage: tage || 1, anlass: anlass || 'Spiel' });
    if (p.injuryLog.length > 8) p.injuryLog.shift();
}

function renderInjuryHistory(p, pool) {
    const box = document.getElementById('pd-injuries');
    if (!box) return;
    if (pool !== 'squad' && pool !== 'secondTeam') { box.innerHTML = ''; return; }
    const log = Array.isArray(p.injuryLog) ? p.injuryLog : [];
    const gesamt = p.timesInjured || 0;
    if (!gesamt && !log.length) {
        box.innerHTML = `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin:8px 0; text-align:center;">🩹 Verletzungs-Verlauf: noch nie verletzt.</div>`;
        return;
    }
    const tageSumme = log.reduce((s, e) => s + (e.tage || 0), 0);
    const aelter = Math.max(0, gesamt - log.length);
    const zeilen = [...log].reverse().map(e => `<div style="display:flex; justify-content:space-between; gap:8px;"><span>Saison ${e.season}, Spieltag ${e.matchday}</span><span style="color:var(--text-muted);">${e.tage} Spiel${e.tage === 1 ? '' : 'e'} · ${mpEsc(e.anlass)}</span></div>`).join('');
    box.innerHTML = `<details class="ui-fold" style="margin:8px 0; text-align:left;"><summary>🩹 Verletzungs-Verlauf (${gesamt} Verletzung${gesamt === 1 ? '' : 'en'})</summary>
        <div style="font-size:var(--fs-small); margin-top:4px;">${zeilen || '<span style="color:var(--text-muted);">Keine Einzelheiten gespeichert.</span>'}
        ${aelter ? `<div style="color:var(--text-muted); margin-top:4px;">… dazu ${aelter} ältere, nicht einzeln gespeichert.</div>` : ''}
        ${log.length ? `<div style="margin-top:4px;">Zusammen ${tageSumme} verpasste Spiele in den letzten ${log.length} Ausfällen.</div>` : ''}</div></details>`;
}

// Alte Spielstände: Buchführung der abgelösten Parallel-Systeme entfernen (hatte keine
// Wirkung auf die echten Verletzungen, bläht aber den Spielstand auf).
function cleanupLegacyInjuryState() {
    ['playerInjuries', 'injuryManagement', 'matchInjuries', 'medicalStaff', 'injuryHistory'].forEach(k => { delete game[k]; });
}

// Rangliste der Ausfälle aus dem Verletzungs-Verlauf (p.injuryLog): wer hat die meisten Spiele verpasst, und was kostet
// die laufende Saison insgesamt. Antippen öffnet das Spielerdetail mit dem vollständigen Verlauf.
function getInjuryRanking() {
    return squad.map(p => {
        const log = Array.isArray(p.injuryLog) ? p.injuryLog : [];
        return { p, ausfaelle: log.length, tage: log.reduce((sum, e) => sum + (e.tage || 0), 0), dieseSaison: log.filter(e => e.season === game.season).reduce((sum, e) => sum + (e.tage || 0), 0) };
    }).filter(x => x.ausfaelle > 0).sort((a, b) => (b.tage - a.tage) || (b.ausfaelle - a.ausfaelle));
}

function renderInjuryRanking() {
    const rang = getInjuryRanking();
    const saison = rang.reduce((sum, x) => sum + x.dieseSaison, 0);
    const kopf = `<details class="ui-fold" style="margin-top:6px;"><summary>🩹 Ausfall-Rangliste (${rang.length} Spieler mit Verlauf)</summary>`;
    if (!rang.length) return kopf + '<div style="font-size:var(--fs-caption); color:var(--text-muted);">Noch keine Ausfälle im Verlauf erfasst.</div></details>';
    return kopf + `<div style="font-size:var(--fs-caption); margin:4px 0;">Diese Saison verpasst: <strong>${saison}</strong> Spiele (alle Spieler zusammen).</div>`
        + rang.slice(0, 6).map(x => `<button onclick="openPlayerDetail('${x.p.id}','squad')" class="btn-secondary" style="display:flex; justify-content:space-between; gap:8px; width:100%; text-align:left; margin:2px 0;" title="Verlauf von ${mpEsc(x.p.name)} öffnen"><span>${x.p.pos} ${mpEsc(x.p.name)}</span><span>${x.ausfaelle} Ausfall${x.ausfaelle === 1 ? '' : 'e'} · ${x.tage} Spiele</span></button>`).join('')
        + '</details>';
}

function renderMedicalDepartmentPanel() {
    const box = document.getElementById('medical-department-box');
    if (!box) return;
    cleanupLegacyInjuryState();
    const verletzt = squad.filter(p => (p.injured || 0) > 0).sort((a, b) => b.injured - a.injured);
    const risiko = squad.filter(p => !(p.injured > 0)).map(p => ({ p, r: getPlayerInjuryRiskIndex(p) }))
        .sort((a, b) => b.r - a.r).slice(0, 5);
    const farbe = r => r >= 1.5 ? 'var(--danger)' : r >= 1.15 ? 'var(--accent)' : 'var(--primary)';

    let html = `<div style="font-size:var(--fs-caption); display:grid; grid-template-columns:1fr 1fr; gap:3px; margin-bottom:6px;">
        <div>Physiotherapeut: <strong>${staffMembers.physio.hired ? 'eingestellt' : 'fehlt'}</strong></div>
        <div>Reha-Zentrum: <strong>Stufe ${campusBuildings.reha.lvl}</strong></div>
        <div>Präventionsprogramm: <strong>${game.injuryPreventionProgram ? 'aktiv' : 'aus'}</strong></div>
        <div>Trainingsintensität: <strong style="color:${farbe(getTrainingIntensityInjuryFactor())};">${game.trainingIntensity || 'normal'}</strong></div>
    </div>`;

    html += `<div style="font-size:var(--fs-caption); font-weight:bold; margin-bottom:3px;">🩼 Verletzt (${verletzt.length})</div>`;
    html += verletzt.length
        ? verletzt.map(p => `<div style="font-size:var(--fs-caption); display:flex; justify-content:space-between;"><span>${p.pos} ${p.name}</span><span style="color:var(--danger);">noch ${p.injured} Spiel(e) · ${p.timesInjured || 1}. Verletzung</span></div>`).join('')
        : '<div style="font-size:var(--fs-caption); color:var(--text-muted);">Keine Verletzten.</div>';

    html += '<div style="font-size:var(--fs-caption); font-weight:bold; margin:6px 0 3px;">⚠️ Höchstes Verletzungsrisiko</div>';
    html += risiko.map(({ p, r }) => `<div style="font-size:var(--fs-caption); display:flex; justify-content:space-between;"><span>${p.pos} ${p.name} (${p.age || '?'})</span>
        <span style="color:${farbe(r)};">${r >= 1.5 ? 'hoch' : r >= 1.15 ? 'erhöht' : 'normal'} (×${r.toFixed(2)})</span></div>`).join('');
    html += renderInjuryRanking();
    html += '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin-top:4px;">Risiko steigt mit Trainingshärte, Alter, früheren Verletzungen und niedriger Fitness. Physio und Reha verkürzen die Ausfallzeit.</div>';
    box.innerHTML = html;
}
