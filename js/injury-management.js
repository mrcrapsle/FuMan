// Spieler-Verletzungs-Management & Physiotherapie
// Verletzungen, Genesungsprozess, Comeback-Management, Medizinisches Personal

let injuryManagementState = {
    injuredPlayers: [], // Array von { playerId, playerName, injuryType, severity, recoveryDaysNeeded, daysRecovered, status, medicalTreatment }
    injuryHistory: [], // Historische Verletzungen für Statistiken
    medicalStaff: { physiotherapist: 2, doctorLevel: 2 }, // 1-5 Qualität
    injuryRecords: {} // { playerId: { totalInjuries, severeDays, comebackRisks } }
};

const INJURY_TYPES = {
    MUSCLE_STRAIN: { label: 'Muskelfaserriss', minDays: 7, maxDays: 14, severity: 'LIGHT' },
    SPRAIN: { label: 'Verstauchung', minDays: 10, maxDays: 21, severity: 'MEDIUM' },
    FRACTURE: { label: 'Fraktur', minDays: 21, maxDays: 42, severity: 'HEAVY' },
    LIGAMENT_TEAR: { label: 'Bänderriss', minDays: 28, maxDays: 56, severity: 'SEVERE' },
    CONCUSSION: { label: 'Gehirnerschütterung', minDays: 7, maxDays: 14, severity: 'MEDIUM' },
    BRUISE: { label: 'Bluterguss', minDays: 3, maxDays: 7, severity: 'LIGHT' }
};

const INJURY_PROBABILITY = {
    LOW: 0.05,      // 5% - schnelle Spieler, junge Spieler
    NORMAL: 0.10,   // 10% - Durchschnitt
    HIGH: 0.15,     // 15% - ältere/überbelastete Spieler
    CRITICAL: 0.20  // 20% - sehr alte oder bereits verletzte Spieler
};

function initializeInjuryManagement() {
    if (!game.injuryManagement) game.injuryManagement = {};
    if (!game.injuryManagement.injuredPlayers) game.injuryManagement.injuredPlayers = [];
    if (!game.injuryManagement.injuryHistory) game.injuryManagement.injuryHistory = [];
    if (!game.injuryManagement.medicalStaff) game.injuryManagement.medicalStaff = { physiotherapist: 2, doctorLevel: 2 };
    if (!game.injuryManagement.injuryRecords) game.injuryManagement.injuryRecords = {};
}

function getInjuryRisk(player) {
    if (!player) return INJURY_PROBABILITY.NORMAL;

    let age = player.age || 25;
    let pace = player.pace || 70;

    // Ältere Spieler = höheres Risiko
    if (age > 32) return INJURY_PROBABILITY.CRITICAL;
    if (age > 29) return INJURY_PROBABILITY.HIGH;
    if (age > 26) return INJURY_PROBABILITY.NORMAL;

    // Schnelle Spieler = geringeres Risiko
    if (pace > 85) return INJURY_PROBABILITY.LOW;

    // Bereits verletzte Spieler = höheres Risiko
    let currentInjury = game.injuryManagement.injuredPlayers.find(inj => inj.playerId === player.id);
    if (currentInjury) return INJURY_PROBABILITY.HIGH;

    return INJURY_PROBABILITY.NORMAL;
}

function getRandomInjury() {
    let types = Object.keys(INJURY_TYPES);
    return types[Math.floor(Math.random() * types.length)];
}

function injurePlayer(playerId, injuryType = null) {
    let player = squad.find(p => p.id === playerId);
    if (!player) return false;

    // Kein doppelte Verletzung
    if (game.injuryManagement.injuredPlayers.find(inj => inj.playerId === playerId)) return false;

    let type = injuryType || getRandomInjury();
    let injuryDef = INJURY_TYPES[type];
    if (!injuryDef) return false;

    let recoveryDays = Math.round(
        injuryDef.minDays + Math.random() * (injuryDef.maxDays - injuryDef.minDays)
    );

    let medicalQuality = (game.injuryManagement.medicalStaff.doctorLevel || 2) / 5;
    recoveryDays = Math.round(recoveryDays * (1 - medicalQuality * 0.3)); // bis zu 30% schneller mit besserem Personal

    let injury = {
        playerId: playerId,
        playerName: player.name,
        playerPos: player.pos,
        injuryType: type,
        injuryLabel: injuryDef.label,
        severity: injuryDef.severity,
        recoveryDaysNeeded: Math.max(3, recoveryDays),
        daysRecovered: 0,
        status: 'INJURED', // INJURED, RECOVERING, AVAILABLE
        medicalTreatment: 'STANDARD', // STANDARD, INTENSIVE, MAXIMAL
        startMatchday: game.matchday,
        timestamp: new Date().getTime()
    };

    game.injuryManagement.injuredPlayers.push(injury);

    // Statistiken aktualisieren
    if (!game.injuryManagement.injuryRecords[playerId]) {
        game.injuryManagement.injuryRecords[playerId] = {
            totalInjuries: 0,
            severeDays: 0,
            comebackRisks: 0
        };
    }
    game.injuryManagement.injuryRecords[playerId].totalInjuries++;
    game.injuryManagement.injuryRecords[playerId].severeDays += recoveryDays;

    showToast(`🚑 ${player.name} ist verletzt! (${injuryDef.label}, ${recoveryDays} Tage Genesungszeit)`, 'warning', 5000);
    return true;
}

function setMedicalTreatment(playerId, treatmentLevel) {
    let injury = game.injuryManagement.injuredPlayers.find(inj => inj.playerId === playerId);
    if (!injury) return false;

    injury.medicalTreatment = treatmentLevel; // STANDARD, INTENSIVE, MAXIMAL

    let costMultiplier = treatmentLevel === 'INTENSIVE' ? 500 : treatmentLevel === 'MAXIMAL' ? 1000 : 0;
    if (costMultiplier > 0) {
        game.money -= costMultiplier;
    }

    return true;
}

function updatePlayerInjuryStatus() {
    initializeInjuryManagement();

    game.injuryManagement.injuredPlayers.forEach(injury => {
        if (injury.status === 'INJURED') {
            // Genesungs-Fortschritt
            let recoveryRate = 1;
            if (injury.medicalTreatment === 'INTENSIVE') recoveryRate = 1.5;
            if (injury.medicalTreatment === 'MAXIMAL') recoveryRate = 2.0;

            // Physiotherapeut-Qualität hilft
            let physioBonus = 1 + ((game.injuryManagement.medicalStaff.physiotherapist || 2) / 5) * 0.3;
            recoveryRate *= physioBonus;

            injury.daysRecovered += recoveryRate;

            // Rückkehr-Fenster
            if (injury.daysRecovered >= injury.recoveryDaysNeeded) {
                injury.status = 'RECOVERING';
                injury.daysRecovered = 0;
                let player = squad.find(p => p.id === injury.playerId);
                if (player) {
                    showToast(`✅ ${player.name} kann langsam ins Training zurückkehren!`, 'success', 4000);
                }
            }
        } else if (injury.status === 'RECOVERING') {
            // Vorsichtiges Training
            injury.daysRecovered++;

            // Comeback nach 2 Spieltagen
            if (injury.daysRecovered >= 2) {
                // Rückfall-Risiko
                let riskChance = 0.15; // 15% Risiko
                if (injury.severity === 'SEVERE') riskChance = 0.30;
                if (injury.severity === 'HEAVY') riskChance = 0.20;

                if (Math.random() < riskChance) {
                    injury.status = 'INJURED';
                    injury.daysRecovered = 0;
                    injury.recoveryDaysNeeded = Math.round(injury.recoveryDaysNeeded * 0.8);
                    game.injuryManagement.injuryRecords[injury.playerId].comebackRisks++;
                    let player = squad.find(p => p.id === injury.playerId);
                    if (player) {
                        showToast(`⚠️ ${player.name} erlitt einen Rückfall!`, 'warning', 4000);
                    }
                } else {
                    // Erfolgreiches Comeback
                    game.injuryManagement.injuryHistory.push(injury);
                    game.injuryManagement.injuredPlayers = game.injuryManagement.injuredPlayers.filter(inj => inj.playerId !== injury.playerId);
                    let player = squad.find(p => p.id === injury.playerId);
                    if (player) {
                        showToast(`⭐ ${player.name} ist zurück im Team!`, 'success', 4000);
                    }
                }
            }
        }
    });
}

function getInjuredPlayersForMatch() {
    initializeInjuryManagement();
    return game.injuryManagement.injuredPlayers.filter(inj => inj.status === 'INJURED');
}

function getRecoveringPlayers() {
    initializeInjuryManagement();
    return game.injuryManagement.injuredPlayers.filter(inj => inj.status === 'RECOVERING');
}

function upgradeMedicalStaff(type) {
    let cost = 50000; // € pro Level-Up
    if (game.money < cost) {
        showToast('💰 Nicht genug Geld für Medical-Upgrade!', 'error', 3000);
        return false;
    }

    if (type === 'physiotherapist') {
        game.injuryManagement.medicalStaff.physiotherapist = Math.min(5, (game.injuryManagement.medicalStaff.physiotherapist || 2) + 1);
    } else if (type === 'doctor') {
        game.injuryManagement.medicalStaff.doctorLevel = Math.min(5, (game.injuryManagement.medicalStaff.doctorLevel || 2) + 1);
    }

    game.money -= cost;
    showToast(`🏥 Medizinisches Personal ausgebaut!`, 'success', 3000);
    return true;
}

function renderInjuryManagementPanel() {
    const container = document.getElementById('injury-management-box');
    if (!container) return;

    initializeInjuryManagement();

    let html = '<div class="panel-content">';
    html += '<h3>🏥 VERLETZUNGS-MANAGEMENT</h3>';

    let injuredCount = game.injuryManagement.injuredPlayers.filter(inj => inj.status === 'INJURED').length;
    let recoveringCount = game.injuryManagement.injuredPlayers.filter(inj => inj.status === 'RECOVERING').length;

    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:9px; margin:0;">Verletzt: <span style="color:var(--danger);">${injuredCount}</span> | Genesung: <span style="color:var(--warning);">${recoveringCount}</span></p>`;
    html += '</div>';

    // Medical Staff
    html += '<div style="margin-bottom:10px;">';
    html += '<h4>🏥 MEDIZINISCHES PERSONAL</h4>';
    html += '<div style="background:#1a2a1a; padding:6px; border-radius:3px; margin-bottom:4px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Physiotherapeut:</strong> Stufe ${game.injuryManagement.medicalStaff.physiotherapist || 2}/5</p>`;
    html += `<button onclick="upgradeMedicalStaff('physiotherapist')" class="btn-secondary" style="width:auto; font-size:8px; padding:2px 6px; margin-top:3px;">+50.000€ Upgrade</button>`;
    html += '</div>';

    html += '<div style="background:#1a1a2a; padding:6px; border-radius:3px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Arzt-Qualität:</strong> Stufe ${game.injuryManagement.medicalStaff.doctorLevel || 2}/5</p>`;
    html += `<button onclick="upgradeMedicalStaff('doctor')" class="btn-secondary" style="width:auto; font-size:8px; padding:2px 6px; margin-top:3px;">+50.000€ Upgrade</button>`;
    html += '</div>';
    html += '</div>';

    // Aktuelle Verletzungen
    if (game.injuryManagement.injuredPlayers.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>🚑 VERLETZTE SPIELER</h4>';

        game.injuryManagement.injuredPlayers.forEach(injury => {
            let progressPercent = Math.round((injury.daysRecovered / injury.recoveryDaysNeeded) * 100);
            let statusColor = injury.status === 'INJURED' ? 'var(--danger)' : 'var(--warning)';

            html += `<div style="background:#1a1a1a; padding:6px; border-radius:3px; margin-bottom:4px; border-left:3px solid ${statusColor};">`;
            html += `<p style="font-size:9px; margin:0;"><strong>${injury.playerName}</strong> (${injury.playerPos})</p>`;
            html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">${injury.injuryLabel} | ${injury.status}</p>`;

            html += '<div style="background:#000; border-radius:2px; height:6px; margin:3px 0; overflow:hidden;">';
            html += `<div style="background:${statusColor}; height:100%; width:${progressPercent}%;">&nbsp;</div>`;
            html += '</div>';

            html += `<p style="font-size:8px; margin:2px 0 0 0;">Tag ${Math.round(injury.daysRecovered)}/${injury.recoveryDaysNeeded}</p>`;

            if (injury.status === 'INJURED') {
                html += '<div style="display:flex; gap:2px; margin-top:3px;">';
                html += `<button onclick="setMedicalTreatment('${injury.playerId}', 'INTENSIVE')" class="btn-secondary" style="width:auto; font-size:7px; padding:1px 4px;">Intensiv (+500€)</button>`;
                html += `<button onclick="setMedicalTreatment('${injury.playerId}', 'MAXIMAL')" class="btn-primary" style="width:auto; font-size:7px; padding:1px 4px;">Maximum (+1000€)</button>`;
                html += '</div>';
            }

            html += `</div>`;
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

function tickInjuryManagement() {
    initializeInjuryManagement();

    // Genesungs-Fortschritt täglich aktualisieren
    if (game.matchday % 1 === 0) { // Jeden Match-Tag
        updatePlayerInjuryStatus();
    }
}
