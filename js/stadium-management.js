/* eslint-disable no-undef */

const STADIUM_PROJECTS = {
  seatingExpansion: {
    name: 'Tribünenausbau',
    cost: 500000,
    capacityIncrease: 5000,
    timeToComplete: 12,
    attendanceBonus: 0.1
  },
  medicalFacilities: {
    name: 'Medizinische Infrastruktur',
    cost: 300000,
    capacityIncrease: 0,
    timeToComplete: 8,
    recoveryBonus: 0.15
  },
  trainingFacilities: {
    name: 'Trainingsanlage',
    cost: 400000,
    capacityIncrease: 0,
    timeToComplete: 10,
    trainingBonus: 0.12
  },
  cateringServices: {
    name: 'Catering & Gastronomie',
    cost: 200000,
    capacityIncrease: 0,
    timeToComplete: 6,
    fanSatisfaction: 0.1
  },
  vipLounge: {
    name: 'VIP-Loge',
    cost: 250000,
    capacityIncrease: 500,
    timeToComplete: 8,
    revenueMultiplier: 1.2
  },
  lightingSystem: {
    name: 'Beleuchtungssystem',
    cost: 150000,
    capacityIncrease: 0,
    timeToComplete: 4,
    qualityBonus: 0.08
  }
};

const stadiumState = {
  capacity: 25000,
  condition: 100,
  upgrades: [],
  projectsUnderway: [],
  maintenanceCost: 5000
};

function initializeStadium() {
  if (!game.stadium) {
    game.stadium = {
      capacity: 25000,
      condition: 100,
      upgrades: [],
      projectsUnderway: [],
      totalInvestment: 0,
      lastExpanded: 0
    };
  }
}

function getStadiumCapacity() {
  if (!game.stadium) return 25000;
  return game.stadium.capacity;
}

function getStadiumCondition() {
  if (!game.stadium) return 100;
  return Math.max(0, Math.min(100, game.stadium.condition));
}

function startStadiumUpgrade(upgradeType) {
  if (!game.stadium) initializeStadium();
  
  const config = STADIUM_PROJECTS[upgradeType];
  if (!config) return false;
  
  if (game.money < config.cost) {
    if (game.inbox) {
      addInboxMessage('❌ Nicht genügend Mittel', `Upgrade kostet €${config.cost.toLocaleString()}`);
    }
    return false;
  }
  
  game.money -= config.cost;
  
  const project = {
    id: (game.stadium.projectsUnderway || []).length,
    type: upgradeType,
    name: config.name,
    startMatchday: game.matchday,
    completionMatchday: game.matchday + config.timeToComplete,
    cost: config.cost,
    progress: 0,
    status: 'active'
  };
  
  if (!game.stadium.projectsUnderway) game.stadium.projectsUnderway = [];
  game.stadium.projectsUnderway.push(project);
  
  if (game.inbox) {
    addInboxMessage(`🏗️ Baubeginn: ${config.name}`, `Fertigstellung in ${config.timeToComplete} Spieltagen`);
  }
  
  return true;
}

function tickStadiumProjects() {
  if (!game.stadium || !game.stadium.projectsUnderway) return;
  
  game.stadium.projectsUnderway = game.stadium.projectsUnderway.filter((project) => {
    const progress = ((game.matchday - project.startMatchday) / (project.completionMatchday - project.startMatchday)) * 100;
    project.progress = Math.min(100, progress);
    
    if (game.matchday >= project.completionMatchday) {
      completeStadiumUpgrade(project);
      return false;
    }
    
    return true;
  });
}

function completeStadiumUpgrade(project) {
  const config = STADIUM_PROJECTS[project.type];
  if (!config) return;
  
  if (config.capacityIncrease > 0) {
    game.stadium.capacity += config.capacityIncrease;
    game.stadium.lastExpanded = game.matchday;
  }
  
  if (!game.stadium.upgrades) game.stadium.upgrades = [];
  game.stadium.upgrades.push({
    type: project.type,
    name: config.name,
    completedMatchday: game.matchday,
    season: game.season,
    benefits: config
  });
  
  if (game.inbox) {
    addInboxMessage(`✅ Ausbau abgeschlossen`, config.name);
  }
}

function tickStadiumMaintenance() {
  if (!game.stadium) return 0;
  
  const maintenanceCost = Math.round(5000 * (1 - getStadiumCondition() / 100));
  
  if (game.money >= maintenanceCost) {
    game.money -= maintenanceCost;
    game.stadium.condition = Math.min(100, game.stadium.condition + 2);
  } else {
    game.stadium.condition = Math.max(0, game.stadium.condition - 1);
  }
  
  return maintenanceCost;
}

function repairStadium(percentage) {
  if (!game.stadium) return false;
  
  const repairCost = Math.round(200000 * (percentage / 100));
  if (game.money < repairCost) return false;
  
  game.money -= repairCost;
  game.stadium.condition = Math.min(100, game.stadium.condition + percentage);
  
  if (game.inbox) {
    addInboxMessage(`🔧 Reparatur`, `Stadionzustand: ${Math.round(game.stadium.condition)}%`);
  }
  
  return true;
}

function getManagementAttendanceFactor() {
  if (!game.stadium) return 1.0;

  let factor = 1.0;
  const capacity = getStadiumCapacity();
  const condition = getStadiumCondition();

  factor *= (0.5 + (condition / 100) * 0.5);

  if (game.stadium.upgrades && game.stadium.upgrades.length > 0) {
    const attendanceUpgrades = game.stadium.upgrades.filter(u => u.benefits.attendanceBonus);
    factor *= (1 + attendanceUpgrades.length * 0.05);
  }

  return factor;
}

function getStadiumRevenueBenefit() {
  if (!game.stadium || !game.stadium.upgrades) return 1.0;
  
  let multiplier = 1.0;
  game.stadium.upgrades.forEach((upgrade) => {
    if (upgrade.benefits.revenueMultiplier) {
      multiplier *= upgrade.benefits.revenueMultiplier;
    }
  });
  
  return multiplier;
}

function renderStadiumManagementPanel() {
  const panel = document.getElementById('stadium-management-panel');
  if (!panel) return;
  
  initializeStadium();
  
  const capacity = getStadiumCapacity();
  const condition = getStadiumCondition();
  const conditionColor = condition > 70 ? '#4CAF50' : condition > 40 ? '#FFC107' : '#FF5252';
  const ongoingProjects = (game.stadium.projectsUnderway || []).filter(p => p.status === 'active').length;
  
  let html = '<div class="panel-content">';
  html += `<h3>Stadion-Management</h3>`;
  
  html += '<div class="stadium-stats">';
  html += `<div class="stat-box">Kapazität: ${capacity.toLocaleString()} Plätze</div>`;
  html += `<div class="stat-box" style="border-left:4px solid ${conditionColor}">Zustand: ${Math.round(condition)}%</div>`;
  html += `<div class="stat-box">Laufende Projekte: ${ongoingProjects}</div>`;
  html += `<div class="stat-box">Einnahmen-Multiplikator: ${getStadiumRevenueBenefit().toFixed(2)}x</div>`;
  html += '</div>';
  
  html += '<h4>Verfügbare Upgrades:</h4>';
  Object.entries(STADIUM_PROJECTS).forEach(([key, config]) => {
    const isUpgraded = game.stadium.upgrades && game.stadium.upgrades.some(u => u.type === key);
    const hasProject = game.stadium.projectsUnderway && game.stadium.projectsUnderway.some(p => p.type === key && p.status === 'active');
    
    html += `<div class="upgrade-item" style="opacity:${isUpgraded ? 0.6 : 1}">`;
    html += `<strong>${config.name}</strong>`;
    html += `<div class="upgrade-info">Kosten: €${config.cost.toLocaleString()} | Dauer: ${config.timeToComplete} Spieltage</div>`;
    if (config.capacityIncrease > 0) {
      html += `<div class="upgrade-info">Kapazität: +${config.capacityIncrease} Plätze</div>`;
    }
    if (isUpgraded) {
      html += `<div style="color:#4CAF50; font-size:10px;">✅ Installiert</div>`;
    } else if (hasProject) {
      html += `<div style="color:#FFC107; font-size:10px;">🔨 In Arbeit</div>`;
    } else {
      html += `<button onclick="startStadiumUpgrade('${key}')" style="background:#2196F3; color:white; border:none; padding:4px 8px; border-radius:3px; font-size:10px;">Starten</button>`;
    }
    html += '</div>';
  });
  
  if (game.stadium.projectsUnderway && game.stadium.projectsUnderway.length > 0) {
    html += '<h4>Laufende Arbeiten:</h4>';
    game.stadium.projectsUnderway.forEach((project) => {
      html += `<div class="project-item">`;
      html += `<strong>${project.name}</strong>`;
      html += `<div style="background:#f0f0f0; height:8px; border-radius:4px; margin:4px 0; overflow:hidden;">`;
      html += `<div style="background:#2196F3; height:100%; width:${project.progress}%"></div>`;
      html += `</div>`;
      html += '</div>';
    });
  }
  
  html += '</div>';
  panel.innerHTML = html;
}
