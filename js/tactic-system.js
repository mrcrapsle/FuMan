/* eslint-disable no-undef */

const TACTICS_CONFIG = {
  formations: {
    '3-5-2': {
      name: '3-5-2: Defensiv stabil',
      defense: 0.9,
      midfield: 1.0,
      offense: 0.8,
      width: 0.9,
      distribution: 'kurz',
      pressing: 'normal',
      positionMap: { def: 3, mid: 5, att: 2 },
      counterChance: 0.15,
      creativeBonus: -0.1,
      defensiveStyle: 'compact',
      offensiveStyle: 'controlled'
    },
    '3-4-3': {
      name: '3-4-3: Ausgewogen',
      defense: 0.85,
      midfield: 1.05,
      offense: 0.95,
      width: 1.0,
      distribution: 'kurz',
      pressing: 'normal',
      positionMap: { def: 3, mid: 4, att: 3 },
      counterChance: 0.20,
      creativeBonus: 0.05,
      defensiveStyle: 'balanced',
      offensiveStyle: 'dynamic'
    },
    '4-2-4': {
      name: '4-2-4: Offensiv',
      defense: 0.75,
      midfield: 0.9,
      offense: 1.2,
      width: 1.1,
      distribution: 'lang',
      pressing: 'aggressiv',
      positionMap: { def: 4, mid: 2, att: 4 },
      counterChance: 0.25,
      creativeBonus: 0.2,
      defensiveStyle: 'pressing',
      offensiveStyle: 'aggressive'
    },
    '4-3-3': {
      name: '4-3-3: Klassisch',
      defense: 0.95,
      midfield: 1.0,
      offense: 1.0,
      width: 1.0,
      distribution: 'kurz',
      pressing: 'normal',
      positionMap: { def: 4, mid: 3, att: 3 },
      counterChance: 0.18,
      creativeBonus: 0.08,
      defensiveStyle: 'compact',
      offensiveStyle: 'dynamic'
    },
    '4-4-2': {
      name: '4-4-2: Tradition',
      defense: 1.0,
      midfield: 0.95,
      offense: 0.95,
      width: 0.85,
      distribution: 'lang',
      pressing: 'normal',
      positionMap: { def: 4, mid: 4, att: 2 },
      counterChance: 0.22,
      creativeBonus: -0.05,
      defensiveStyle: 'solid',
      offensiveStyle: 'direct'
    },
    '5-3-2': {
      name: '5-3-2: Ultra-Defensiv',
      defense: 1.15,
      midfield: 0.8,
      offense: 0.7,
      width: 0.7,
      distribution: 'lang',
      pressing: 'vorsichtig',
      positionMap: { def: 5, mid: 3, att: 2 },
      counterChance: 0.30,
      creativeBonus: -0.25,
      defensiveStyle: 'deep',
      offensiveStyle: 'counter'
    }
  },
  pressing: {
    vorsichtig: { name: 'Vorsichtig', ballLoss: 0.05, pressing: 0.3, energy: 0.7 },
    normal: { name: 'Normal', ballLoss: 0.12, pressing: 0.6, energy: 1.0 },
    aggressiv: { name: 'Aggressiv', ballLoss: 0.22, pressing: 1.0, energy: 1.3 }
  },
  possession: {
    ballHoldingShort: { name: 'Kurze Pässe', accuracy: 1.1, pace: 0.8, riskFactor: 0.2 },
    ballHoldingMid: { name: 'Gemischtes Spiel', accuracy: 1.0, pace: 1.0, riskFactor: 0.4 },
    ballHoldingLong: { name: 'Lange Bälle', accuracy: 0.85, pace: 1.3, riskFactor: 0.7 }
  },
  roles: {
    CB: { name: 'Innenverteidiger', attrs: ['defense', 'strength', 'heading'] },
    FB: { name: 'Außenverteidiger', attrs: ['defense', 'pace', 'stamina'] },
    LB: { name: 'Linkes Außenverteidiger', attrs: ['defense', 'pace', 'crossing'] },
    RB: { name: 'Rechtes Außenverteidiger', attrs: ['defense', 'pace', 'crossing'] },
    CM: { name: 'Zentrales Mittelfeld', attrs: ['passing', 'defense', 'stamina'] },
    CAM: { name: 'Offensives Mittelfeld', attrs: ['passing', 'creativity', 'shooting'] },
    CDM: { name: 'Defensives Mittelfeld', attrs: ['defense', 'passing', 'stamina'] },
    LM: { name: 'Linkes Mittelfeld', attrs: ['pace', 'dribbling', 'passing'] },
    RM: { name: 'Rechtes Mittelfeld', attrs: ['pace', 'dribbling', 'passing'] },
    ST: { name: 'Stürmer', attrs: ['shooting', 'pace', 'strength'] },
    CF: { name: 'Mittelstürmer', attrs: ['shooting', 'strength', 'heading'] },
    LW: { name: 'Linker Flügel', attrs: ['pace', 'dribbling', 'shooting'] },
    RW: { name: 'Rechter Flügel', attrs: ['pace', 'dribbling', 'shooting'] }
  }
};

function initializeTacticsSystem() {
  if (!game.tacticsHistory) {
    game.tacticsHistory = [];
  }
  if (!game.playerRoles) {
    game.playerRoles = {};
  }
  if (!game.formationHistory) {
    game.formationHistory = [];
  }
  if (!game.tacticAnalysis) {
    game.tacticAnalysis = { matchesAnalyzed: 0, effectiveness: 0.5 };
  }
}

function assignPlayerTacticRole(playerId, formation, roleInFormation) {
  if (!game.playerRoles) game.playerRoles = {};
  if (!game.playerRoles[formation]) {
    game.playerRoles[formation] = {};
  }
  game.playerRoles[formation][playerId] = roleInFormation;
}

function getPlayerTacticRoleInFormation(playerId, formation) {
  if (!game.playerRoles || !game.playerRoles[formation]) return null;
  return game.playerRoles[formation][playerId] || null;
}

function getFitnessPenaltyForRole(player, role) {
  const fitness = player.fitness || 100;
  if (fitness > 90) return 0;
  if (fitness > 75) return -0.05;
  if (fitness > 60) return -0.15;
  return -0.3;
}

function getPlayerFormationFit(player, formation, roleInFormation) {
  const config = TACTICS_CONFIG.formations[formation];
  if (!config) return 0.5;

  let fit = 0.5;
  const playerPos = player.pos;

  if (roleInFormation === 'CB' && ['AB'].includes(playerPos)) fit += 0.3;
  else if (roleInFormation === 'FB' && ['AB', 'AH'].includes(playerPos)) fit += 0.25;
  else if (roleInFormation === 'LB' && playerPos === 'AH') fit += 0.3;
  else if (roleInFormation === 'RB' && playerPos === 'AH') fit += 0.3;
  else if (roleInFormation === 'CDM' && ['MF', 'DM'].includes(playerPos)) fit += 0.3;
  else if (roleInFormation === 'CM' && ['MF', 'ZM'].includes(playerPos)) fit += 0.25;
  else if (roleInFormation === 'CAM' && ['MF', 'OM'].includes(playerPos)) fit += 0.3;
  else if (roleInFormation === 'LM' && playerPos === 'MF') fit += 0.25;
  else if (roleInFormation === 'RM' && playerPos === 'MF') fit += 0.25;
  else if (roleInFormation === 'ST' && ['ST', 'MS'].includes(playerPos)) fit += 0.35;
  else if (roleInFormation === 'CF' && ['ST', 'MS'].includes(playerPos)) fit += 0.3;
  else if (roleInFormation === 'LW' && playerPos === 'ST') fit += 0.2;
  else if (roleInFormation === 'RW' && playerPos === 'ST') fit += 0.2;

  fit = Math.min(1.0, Math.max(0.3, fit));
  fit += getFitnessPenaltyForRole(player, roleInFormation);
  return fit;
}

function getFormationBonus(formation, tacticStyle) {
  const config = TACTICS_CONFIG.formations[formation];
  if (!config) return { attack: 0, defense: 0, creativity: 0 };

  let bonuses = {
    attack: (config.offense - 1.0) * 0.5,
    defense: (config.defense - 1.0) * 0.5,
    creativity: config.creativeBonus * 0.4
  };

  if (tacticStyle === 'aggressive' && config.offensiveStyle === 'aggressive') {
    bonuses.attack += 0.1;
  } else if (tacticStyle === 'defensive' && config.defensiveStyle === 'deep') {
    bonuses.defense += 0.1;
  }

  return bonuses;
}

function analyzeMatchTactics(match) {
  if (!match || !game.tacticAnalysis) return;

  game.tacticAnalysis.matchesAnalyzed++;
  let effectiveness = 0.5;

  if (match.won) effectiveness = 0.75;
  else if (match.draw) effectiveness = 0.55;
  else effectiveness = 0.35;

  const prevEffectiveness = game.tacticAnalysis.effectiveness || 0.5;
  game.tacticAnalysis.effectiveness = prevEffectiveness * 0.7 + effectiveness * 0.3;
}

function getTacticSuggestion() {
  if (!game.tacticAnalysis || game.tacticAnalysis.matchesAnalyzed < 3) {
    return 'Zu wenig Daten für Taktik-Analyse (min. 3 Spiele)';
  }

  const effectiveness = game.tacticAnalysis.effectiveness || 0.5;

  if (effectiveness > 0.65) {
    return 'Aktuelle Taktik funktioniert gut - beibehalten';
  } else if (effectiveness < 0.45) {
    return 'Taktik nicht effektiv - Wechsel erwägen';
  } else {
    return 'Taktik funktioniert mittelmäßig - kleine Anpassungen möglich';
  }
}

function getFormationCompletenessFit(formation) {
  if (!squad || squad.length === 0) return 0;
  if (!game.playerRoles || !game.playerRoles[formation]) return 0.4;

  const roles = game.playerRoles[formation];
  const config = TACTICS_CONFIG.formations[formation];
  if (!config) return 0.4;

  let totalFit = 0;
  let count = 0;

  squad.forEach((player) => {
    if (!player.active) return;
    const role = roles[player.id];
    if (role) {
      const fit = getPlayerFormationFit(player, formation, role);
      totalFit += fit;
      count++;
    }
  });

  if (count === 0) return 0.4;
  return Math.min(1.0, Math.max(0.3, totalFit / count));
}

function getTacticStyleInfluence() {
  if (!game.tacticAnalysis) return 1.0;
  const effectiveness = game.tacticAnalysis.effectiveness || 0.5;
  return 0.85 + (effectiveness - 0.5) * 0.3;
}

function renderTacticSystemPanel() {
  const panel = document.getElementById('tactic-system-panel');
  if (!panel) return;

  if (!game.tacticAnalysis) {
    initializeTacticsSystem();
  }

  let html = '<div class="panel-content">';
  html += `<h3>Taktik-System</h3>`;

  html += '<div class="tactic-stats">';
  html += `<div class="stat-box">Taktik-Effektivität: ${(game.tacticAnalysis.effectiveness * 100).toFixed(0)}%</div>`;
  html += `<div class="stat-box">Spiele analysiert: ${game.tacticAnalysis.matchesAnalyzed}</div>`;
  html += `<div class="stat-box">Taktik-Einfluss: ${(getTacticStyleInfluence() * 100).toFixed(0)}%</div>`;
  html += '</div>';

  html += `<div style="font-size:11px; color:#FFC107; margin:6px 0; padding:6px; background:rgba(255,193,7,0.1); border-radius:4px;">💡 ${getTacticSuggestion()}</div>`;

  html += '<h4>Formation Übersicht:</h4>';
  Object.entries(TACTICS_CONFIG.formations).forEach(([key, config]) => {
    const completeness = getFormationCompletenessFit(key);
    const completenessColor = completeness > 0.7 ? '#4CAF50' : completeness > 0.5 ? '#FFC107' : '#FF5252';
    html += `<div class="tactic-formation-item" style="border-left: 4px solid ${completenessColor}">`;
    html += `<strong>${config.name}</strong>`;
    html += `<div class="formation-info">Bestückung: ${(completeness * 100).toFixed(0)}% | Counter: ${(config.counterChance * 100).toFixed(0)}%</div>`;
    html += `<div class="formation-info">Def: ${config.defense.toFixed(2)} | Mid: ${config.midfield.toFixed(2)} | Off: ${config.offense.toFixed(2)}</div>`;
    html += '</div>';
  });

  html += '<h4>Spielstil-Auswirkungen:</h4>';
  ['aggressive', 'balanced', 'defensive', 'possession'].forEach((style) => {
    const bonus = getFormationBonus(game.formation || '4-4-2', style);
    html += `<div class="tactic-style-item">`;
    html += `<strong>${style}</strong>: Angriff ${(bonus.attack > 0 ? '+' : '')}${(bonus.attack * 100).toFixed(0)}% | Abwehr ${(bonus.defense > 0 ? '+' : '')}${(bonus.defense * 100).toFixed(0)}%`;
    html += `</div>`;
  });

  html += '</div>';
  panel.innerHTML = html;
}
