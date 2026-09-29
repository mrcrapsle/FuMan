/* eslint-disable no-undef */

const INJURY_TYPES = {
  minorMuscle: {
    name: 'Muskelzerrung',
    recoveryDays: [7, 14],
    severity: 0.3
  },
  muscleStrain: {
    name: 'Muskelfaserriss',
    recoveryDays: [14, 28],
    severity: 0.6
  },
  ligamentTear: {
    name: 'Bandverletzung',
    recoveryDays: [21, 42],
    severity: 0.8
  },
  fracture: {
    name: 'Knochenbruch',
    recoveryDays: [28, 56],
    severity: 1.0
  },
  concussion: {
    name: 'Gehirnerschütterung',
    recoveryDays: [7, 21],
    severity: 0.7
  }
};

const medicalState = {
  injuries: [],
  medical_staff: {
    qualityLevel: 1,
    budget: 0
  },
  treatmentPlans: []
};

function initializeMedicalSystem() {
  if (!game.playerInjuries) {
    game.playerInjuries = [];
  }
  if (!game.medicalStaff) {
    game.medicalStaff = {
      qualityLevel: 1,
      experiencePoints: 0,
      totalTreated: 0
    };
  }
  if (!game.injuryHistory) {
    game.injuryHistory = [];
  }
}

function injurePlayer(player, injuryType) {
  if (!game.playerInjuries) game.playerInjuries = [];

  const injuryConfig = INJURY_TYPES[injuryType] || INJURY_TYPES.minorMuscle;
  const recoveryTime = Math.floor(Math.random() * (injuryConfig.recoveryDays[1] - injuryConfig.recoveryDays[0])) + injuryConfig.recoveryDays[0];

  const injury = {
    playerId: player.id,
    playerName: player.name,
    injuryType: injuryType,
    injuryName: injuryConfig.name,
    recoveryDaysRemaining: recoveryTime,
    totalRecoveryDays: recoveryTime,
    severityFactor: injuryConfig.severity,
    dateOfInjury: game.matchday,
    season: game.season,
    status: 'active'
  };

  game.playerInjuries.push(injury);

  player.strength = Math.max(0, player.strength - (injuryConfig.severity * 30));
  player.morale = Math.max(0, player.morale - 10);

  if (game.inbox) {
    addInboxMessage(`🏥 Verletzung: ${player.name}`, injuryConfig.name);
  }

  return injury;
}

function randomizeMatchInjuries() {
  if (!squad || Math.random() > 0.1) return;

  const injuryChance = 0.05;
  squad.forEach((player) => {
    if (player.active && Math.random() < injuryChance && !isPlayerInjured(player.id)) {
      const types = Object.keys(INJURY_TYPES);
      const randomType = types[Math.floor(Math.random() * types.length)];
      injurePlayer(player, randomType);
    }
  });
}

function isPlayerInjured(playerId) {
  if (!game.playerInjuries) return false;
  return game.playerInjuries.some(inj => inj.playerId === playerId && inj.status === 'active');
}

function getPlayerInjury(playerId) {
  if (!game.playerInjuries) return null;
  return game.playerInjuries.find(inj => inj.playerId === playerId && inj.status === 'active');
}

function tickMedicalRecovery() {
  if (!game.playerInjuries) return;

  game.playerInjuries.forEach((injury) => {
    if (injury.status !== 'active') return;

    let recoveryRate = 1;
    if (game.medicalStaff && game.medicalStaff.qualityLevel >= 2) recoveryRate *= 1.15;
    if (game.medicalStaff && game.medicalStaff.qualityLevel >= 3) recoveryRate *= 1.25;

    injury.recoveryDaysRemaining = Math.max(0, injury.recoveryDaysRemaining - recoveryRate);

    if (injury.recoveryDaysRemaining <= 0) {
      injury.status = 'recovered';
      const player = squad && squad.find(p => p.id === injury.playerId);
      if (player) {
        player.strength = Math.min(100, player.strength + 10);
        player.morale = Math.min(100, player.morale + 5);

        if (game.inbox) {
          addInboxMessage(`✅ Genesung abgeschlossen`, `${player.name} ist wieder bereit`);
        }
      }

      if (game.medicalStaff) {
        game.medicalStaff.experiencePoints = (game.medicalStaff.experiencePoints || 0) + 10;
        game.medicalStaff.totalTreated = (game.medicalStaff.totalTreated || 0) + 1;
      }
    }
  });
}

function upgradeMedicalStaff(amount) {
  if (!game.medicalStaff) game.medicalStaff = {};

  const costPerLevel = 50000;
  const totalCost = costPerLevel * amount;

  if (game.money < totalCost) return false;

  game.money -= totalCost;
  game.medicalStaff.qualityLevel = (game.medicalStaff.qualityLevel || 1) + amount;

  if (game.inbox) {
    addInboxMessage(`⚕️ Medizinische Infrastruktur`, `Team erweitert auf Level ${game.medicalStaff.qualityLevel}`);
  }

  return true;
}

function getInjuredPlayerCount() {
  if (!game.playerInjuries) return 0;
  return game.playerInjuries.filter(inj => inj.status === 'active').length;
}

function getAvailablePlayersCount() {
  if (!squad) return 0;
  return squad.filter(p => p.active && !isPlayerInjured(p.id)).length;
}

function renderMedicalManagementPanel() {
  const panel = document.getElementById('medical-management-panel');
  if (!panel) return;

  initializeMedicalSystem();

  const injuredCount = getInjuredPlayerCount();
  const availableCount = getAvailablePlayersCount();
  const medicalLevel = (game.medicalStaff && game.medicalStaff.qualityLevel) || 1;
  const recoveryBonus = medicalLevel >= 2 ? 15 : medicalLevel >= 3 ? 25 : 0;

  let html = '<div class="panel-content">';
  html += `<h3>Medizinische Abteilung</h3>`;

  html += '<div class="medical-stats">';
  html += `<div class="stat-box">Verfügbare Spieler: ${availableCount}/${squad ? squad.filter(p => p.active).length : 0}</div>`;
  html += `<div class="stat-box">Verletzte Spieler: ${injuredCount}</div>`;
  html += `<div class="stat-box">Medical Team Level: ${medicalLevel}</div>`;
  html += `<div class="stat-box">Genesungs-Bonus: +${recoveryBonus}%</div>`;
  html += '</div>';

  html += '<h4>Verletzte Spieler:</h4>';
  if (game.playerInjuries && game.playerInjuries.filter(i => i.status === 'active').length > 0) {
    game.playerInjuries.filter(i => i.status === 'active').forEach((injury) => {
      const progress = ((injury.totalRecoveryDays - injury.recoveryDaysRemaining) / injury.totalRecoveryDays * 100).toFixed(0);
      html += `<div class="injury-item">`;
      html += `<strong>${injury.playerName}</strong> - ${injury.injuryName}`;
      html += `<div class="injury-info">Genesung: ${Math.ceil(injury.recoveryDaysRemaining)} Tage verbleibend</div>`;
      html += `<div style="background:#f0f0f0; height:8px; border-radius:4px; margin:4px 0; overflow:hidden;">`;
      html += `<div style="background:#4CAF50; height:100%; width:${progress}%"></div>`;
      html += `</div>`;
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Keine aktuellen Verletzungen</div>';
  }

  html += '<h4>Medizinische Infrastruktur:</h4>';
  html += '<div class="medical-upgrade">';
  html += `<div>Level ${medicalLevel} | Erfahrung: ${(game.medicalStaff && game.medicalStaff.experiencePoints) || 0} Punkte</div>`;
  html += `<button onclick="upgradeMedicalStaff(1)" style="background:#2196F3; color:white; border:none; padding:6px 12px; margin-top:4px; border-radius:3px;">Upgrade (+€50.000)</button>`;
  html += '</div>';

  html += '</div>';
  panel.innerHTML = html;
}
