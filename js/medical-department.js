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

// Phase 23.2: Langzeitverletzungen mit Comeback-Fahrplan
const LONG_TERM_INJURY_THRESHOLD = 12; // 3+ Monate

// Verletzung durch ein Ereignis (z.B. Krise) - gleiche Regeln wie im Spiel: Ausfallzeit,
// Verletzungshistorie, Physio/Reha verkürzen. Keine dauerhaften Stärkeverluste.
function injurePlayerByEvent(p, grund) {
    if (!p || (p.injured || 0) > 0) return false;
    const baseDuration = Math.floor(Math.random() * 4) + 1;
    const reduction = Math.max(0.25, 1 - (campusBuildings.reha.lvl * 0.08) - (staffMembers.physio.hired ? 0.5 : 0));
    p.injured = Math.max(1, Math.round(baseDuration * reduction));
    p.timesInjured = (p.timesInjured || 0) + 1;

    // Phase 23.2: Langzeitverletzungen tracken
    if (p.injured >= LONG_TERM_INJURY_THRESHOLD) {
        p.longTermInjury = { start: game.season, startMatchday: game.matchday, duration: p.injured, comebackProgress: 0 };
        addInboxMessage('verletzung', `${p.name} LANGZEITVERLETZUNG`, `⚠️ ${grund ? grund + ': ' : ''}Schwere Verletzung! Fällt für mindestens ${p.injured} Spiele aus. Comeback-Training wird nach Heilung empfohlen.`, 'screen-squad');
    } else {
        addInboxMessage('verletzung', `${p.name} verletzt`, `${grund ? grund + ': ' : ''}Fällt für ${p.injured} Spiel(e) aus.`, 'screen-squad');
    }
    return true;
}

// Phase 23.2: Comeback-Training für genesene Spieler aus Langzeitverletzungen
function startComebackTraining(p) {
    if (!p.longTermInjury || p.injured > 0) return false;
    p.comebackTraining = { startMatchday: game.matchday, progress: 0, intensity: 'leicht' };
    addInboxMessage('medizin', `${p.name} beginnt Comeback-Training`, `Rückkehrprotokolll eingeleitet - 3 Spieltage leichtes Training vor Rückentritt.`, 'screen-squad');
    return true;
}

// Phase 23.2: Comeback-Training jeden Spieltag ticken
function tickComebackTraining() {
    squad.forEach(p => {
        if (p.comebackTraining && !p.injured) {
            p.comebackTraining.progress++;
            if (p.comebackTraining.progress >= 3) {
                delete p.comebackTraining;
                delete p.longTermInjury;
            }
        }
    });
}

// Alte Spielstände: Buchführung der abgelösten Parallel-Systeme entfernen (hatte keine
// Wirkung auf die echten Verletzungen, bläht aber den Spielstand auf).
function cleanupLegacyInjuryState() {
    ['playerInjuries', 'injuryManagement', 'matchInjuries', 'medicalStaff', 'injuryHistory'].forEach(k => { delete game[k]; });
}

function renderMedicalDepartmentPanel() {
    const box = document.getElementById('medical-department-box');
    if (!box) return;
    cleanupLegacyInjuryState();
    const verletzt = squad.filter(p => (p.injured || 0) > 0).sort((a, b) => b.injured - a.injured);
    const langzeitverletzt = squad.filter(p => p.longTermInjury && (p.injured || 0) > 0).sort((a, b) => b.injured - a.injured);
    const comeback = squad.filter(p => p.comebackTraining).sort((a, b) => b.comebackTraining.progress - a.comebackTraining.progress);
    const risiko = squad.filter(p => !(p.injured > 0) && !p.comebackTraining).map(p => ({ p, r: getPlayerInjuryRiskIndex(p) }))
        .sort((a, b) => b.r - a.r).slice(0, 5);
    const farbe = r => r >= 1.5 ? 'var(--danger)' : r >= 1.15 ? 'var(--accent)' : 'var(--primary)';

    let html = `<div style="font-size:9px; display:grid; grid-template-columns:1fr 1fr; gap:3px; margin-bottom:6px;">
        <div>Physiotherapeut: <strong>${staffMembers.physio.hired ? 'eingestellt' : 'fehlt'}</strong></div>
        <div>Reha-Zentrum: <strong>Stufe ${campusBuildings.reha.lvl}</strong></div>
        <div>Präventionsprogramm: <strong>${game.injuryPreventionProgram ? 'aktiv' : 'aus'}</strong></div>
        <div>Trainingsintensität: <strong style="color:${farbe(getTrainingIntensityInjuryFactor())};">${game.trainingIntensity || 'normal'}</strong></div>
    </div>`;

    html += `<div style="font-size:9px; font-weight:bold; margin-bottom:3px;">🩼 Verletzt (${verletzt.length})</div>`;
    html += verletzt.length
        ? verletzt.map(p => `<div style="font-size:9px; display:flex; justify-content:space-between;"><span>${p.pos} ${p.name}</span><span style="color:var(--danger);">noch ${p.injured} Spiel(e) · ${p.timesInjured || 1}. Verletzung</span></div>`).join('')
        : '<div style="font-size:9px; color:var(--text-muted);">Keine Verletzten.</div>';

    if (langzeitverletzt.length > 0) {
        html += '<div style="font-size:9px; font-weight:bold; margin:6px 0 3px;">⚠️ LANGZEITVERLETZUNGEN</div>';
        html += langzeitverletzt.map(p => `<div style="font-size:9px; display:flex; justify-content:space-between;"><span>${p.name}</span><span style="color:var(--danger);">noch ${p.injured} Spiele</span></div>`).join('');
    }

    if (comeback.length > 0) {
        html += '<div style="font-size:9px; font-weight:bold; margin:6px 0 3px;">🏃 COMEBACK-TRAINING</div>';
        html += comeback.map(p => `<div style="font-size:9px; display:flex; justify-content:space-between;"><span>${p.name}</span><span style="color:var(--primary);">${p.comebackTraining.progress}/3</span></div>`).join('');
    }

    html += '<div style="font-size:9px; font-weight:bold; margin:6px 0 3px;">⚠️ Höchstes Verletzungsrisiko</div>';
    html += risiko.map(({ p, r }) => `<div style="font-size:9px; display:flex; justify-content:space-between;"><span>${p.pos} ${p.name} (${p.age || '?'})</span>
        <span style="color:${farbe(r)};">${r >= 1.5 ? 'hoch' : r >= 1.15 ? 'erhöht' : 'normal'} (×${r.toFixed(2)})</span></div>`).join('');
    html += '<div style="font-size:8px; color:var(--text-muted); margin-top:4px;">Risiko steigt mit Trainingshärte, Alter, früheren Verletzungen und niedriger Fitness. Physio und Reha verkürzen die Ausfallzeit.</div>';
    box.innerHTML = html;
}
