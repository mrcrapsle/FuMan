/* eslint-disable no-undef */

const YOUTH_PROGRAMS = {
  development: {
    name: 'Talententwicklung',
    cost: 50000,
    duration: 12,
    strengthGain: 5,
    moralGain: 8
  },
  specialization: {
    name: 'Spezialisierung',
    cost: 75000,
    duration: 16,
    strengthGain: 8,
    moralGain: 5
  },
  conditioning: {
    name: 'Athletiktraining',
    cost: 40000,
    duration: 10,
    strengthGain: 6,
    moralGain: 3
  },
  tacticalEducation: {
    name: 'Taktische Schulung',
    cost: 60000,
    duration: 14,
    strengthGain: 4,
    moralGain: 10
  }
};

const youthAcademyState = {
  youngPlayers: [],
  programs: [],
  totalPromotion: 0,
  totalSales: 0
};

function initializeYouthAcademy() {
  if (!game.youthAcademy) {
    game.youthAcademy = {
      youngPlayers: [],
      programs: [],
      totalPromotion: 0,
      totalSales: 0,
      academyLevel: 1
    };
  }
}

function createYoungPlayer() {
  const firstNames = ['Lucas', 'Felix', 'Noah', 'Liam', 'Emma', 'Sophie', 'Anna', 'Nina'];
  const lastNames = ['Müller', 'Schmidt', 'Weber', 'Meyer', 'Wagner', 'Hoffmann', 'Koch', 'Becker'];
  
  const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  const position = ['ST', 'CM', 'LB', 'CB', 'GK'][Math.floor(Math.random() * 5)];
  const age = 16 + Math.floor(Math.random() * 4);
  
  const youngPlayer = {
    id: `youth_${(game.youthAcademy && game.youthAcademy.youngPlayers.length) || 0}`,
    name: name,
    position: position,
    age: age,
    strength: 30 + Math.random() * 20,
    potential: 70 + Math.random() * 25,
    morale: 60 + Math.random() * 30,
    joinedSeason: game.season,
    programsCompleted: [],
    readyForPromotion: false
  };
  
  if (!game.youthAcademy.youngPlayers) game.youthAcademy.youngPlayers = [];
  game.youthAcademy.youngPlayers.push(youngPlayer);
  
  if (game.inbox) {
    addInboxMessage(`🌟 Neuer Nachwuchsspieler`, `${youngPlayer.name} (${youngPlayer.age} Jahre)`);
  }
  
  return youngPlayer;
}

function enrollPlayerInProgram(playerId, programType) {
  if (!game.youthAcademy) return false;
  
  const player = game.youthAcademy.youngPlayers.find(p => p.id === playerId);
  const program = YOUTH_PROGRAMS[programType];
  
  if (!player || !program) return false;
  if (game.money < program.cost) return false;
  
  game.money -= program.cost;
  
  const enrollment = {
    playerId: playerId,
    playerName: player.name,
    programType: programType,
    programName: program.name,
    startMatchday: game.matchday,
    completionMatchday: game.matchday + program.duration,
    strengthGain: program.strengthGain,
    moralGain: program.moralGain,
    progress: 0,
    status: 'active'
  };
  
  if (!game.youthAcademy.programs) game.youthAcademy.programs = [];
  game.youthAcademy.programs.push(enrollment);
  
  if (game.inbox) {
    addInboxMessage(`📚 Training begonnen`, `${player.name}: ${program.name}`);
  }
  
  return true;
}

function tickYouthPrograms() {
  if (!game.youthAcademy || !game.youthAcademy.programs) return;
  
  game.youthAcademy.programs = game.youthAcademy.programs.filter((enrollment) => {
    if (game.matchday >= enrollment.completionMatchday) {
      completeYouthProgram(enrollment);
      return false;
    }
    
    const progress = ((game.matchday - enrollment.startMatchday) / (enrollment.completionMatchday - enrollment.startMatchday)) * 100;
    enrollment.progress = Math.min(100, progress);
    
    return true;
  });
}

function completeYouthProgram(enrollment) {
  const player = game.youthAcademy.youngPlayers.find(p => p.id === enrollment.playerId);
  if (!player) return;
  
  player.strength = Math.min(player.potential, player.strength + enrollment.strengthGain);
  player.morale = Math.min(100, player.morale + enrollment.moralGain);
  player.programsCompleted.push(enrollment.programType);
  
  if (player.strength >= player.potential - 5) {
    player.readyForPromotion = true;
  }
  
  if (game.inbox) {
    addInboxMessage(`✅ Training abgeschlossen`, `${player.name}: Stärke ${player.strength.toFixed(0)}`);
  }
}

function promoteYouthPlayer(playerId) {
  if (!game.youthAcademy) return false;
  
  const youthPlayer = game.youthAcademy.youngPlayers.find(p => p.id === playerId);
  if (!youthPlayer || !squad) return false;
  
  const newPlayer = {
    id: squad.length,
    name: youthPlayer.name,
    position: youthPlayer.position,
    age: youthPlayer.age,
    strength: Math.max(30, youthPlayer.strength),
    morale: youthPlayer.morale,
    speed: 60 + Math.random() * 20,
    stamina: 60 + Math.random() * 20,
    technique: 50 + Math.random() * 30,
    tactical: 40 + Math.random() * 30,
    physical: 55 + Math.random() * 25,
    marketValue: Math.round((youthPlayer.strength / 100) * 500000),
    salary: 5000,
    contract: 48,
    active: true,
    yearsOnTeam: 0,
    youthPromotion: true,
    nationality: 'Deutschland',
    gamesPlayed: 0
  };
  
  squad.push(newPlayer);
  game.youthAcademy.youngPlayers = game.youthAcademy.youngPlayers.filter(p => p.id !== playerId);
  game.youthAcademy.totalPromotion++;
  
  if (game.inbox) {
    addInboxMessage(`🎉 Beförderung in erste Mannschaft`, newPlayer.name);
  }
  
  return true;
}

function sellYouthPlayer(playerId, fee) {
  if (!game.youthAcademy) return false;
  
  const player = game.youthAcademy.youngPlayers.find(p => p.id === playerId);
  if (!player) return false;
  
  game.money += fee;
  game.youthAcademy.youngPlayers = game.youthAcademy.youngPlayers.filter(p => p.id !== playerId);
  game.youthAcademy.totalSales++;
  
  if (game.inbox) {
    addInboxMessage(`💰 Spieler verkauft`, `${player.name}: €${fee.toLocaleString()}`);
  }
  
  return true;
}

function tickYouthRecruitment() {
  if (!game.youthAcademy) return;
  
  const academyLevel = game.youthAcademy.academyLevel || 1;
  const recruitmentChance = 0.15 * academyLevel;
  
  if (Math.random() < recruitmentChance) {
    createYoungPlayer();
  }
}

function renderYouthAcademyPanel() {
  const panel = document.getElementById('youth-academy-panel');
  if (!panel) return;
  
  initializeYouthAcademy();
  
  const youngPlayers = game.youthAcademy.youngPlayers || [];
  const programs = (game.youthAcademy.programs || []).filter(p => p.status === 'active');
  
  let html = '<div class="panel-content">';
  html += `<h3>Nachwuchs-Akademie (Level ${game.youthAcademy.academyLevel})</h3>`;
  
  html += '<div class="academy-stats">';
  html += `<div class="stat-box">Nachwuchsspieler: ${youngPlayers.length}</div>`;
  html += `<div class="stat-box">Aktive Programme: ${programs.length}</div>`;
  html += `<div class="stat-box">Beförderungen: ${game.youthAcademy.totalPromotion}</div>`;
  html += `<div class="stat-box">Verkaufte Spieler: ${game.youthAcademy.totalSales}</div>`;
  html += '</div>';
  
  html += '<h4>Nachwuchsspieler:</h4>';
  if (youngPlayers.length > 0) {
    youngPlayers.forEach((player) => {
      const readyIcon = player.readyForPromotion ? '🌟' : '';
      html += `<div class="youth-player-item">`;
      html += `<strong>${player.name}</strong> ${readyIcon} (${player.age} Jahre, ${player.position})`;
      html += `<div class="player-info">Stärke: ${player.strength.toFixed(0)}/Potenzial: ${player.potential.toFixed(0)}</div>`;
      html += `<div class="player-info">Moral: ${player.morale.toFixed(0)}%</div>`;
      if (player.readyForPromotion) {
        html += `<button onclick="promoteYouthPlayer('${player.id}')" style="background:#4CAF50; color:white; border:none; padding:4px 8px; margin-right:4px; border-radius:3px; font-size:10px;">Befördern</button>`;
      } else {
        html += `<select onchange="enrollPlayerInProgram('${player.id}', this.value)" style="font-size:10px; padding:2px;">`;
        html += `<option value="">-- Programm wählen --</option>`;
        Object.entries(YOUTH_PROGRAMS).forEach(([key, prog]) => {
          html += `<option value="${key}">${prog.name} (€${prog.cost.toLocaleString()})</option>`;
        });
        html += `</select>`;
      }
      html += `<button onclick="sellYouthPlayer('${player.id}', 100000)" style="background:#FF9800; color:white; border:none; padding:4px 8px; margin-left:4px; border-radius:3px; font-size:10px;">Verkaufen (€100k)</button>`;
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Keine Nachwuchsspieler</div>';
  }
  
  if (programs.length > 0) {
    html += '<h4>Aktive Programme:</h4>';
    programs.forEach((prog) => {
      html += `<div class="program-item">`;
      html += `<strong>${prog.playerName}</strong> - ${prog.programName}`;
      html += `<div style="background:#f0f0f0; height:8px; border-radius:4px; margin:4px 0; overflow:hidden;">`;
      html += `<div style="background:#FFC107; height:100%; width:${prog.progress}%"></div>`;
      html += `</div>`;
      html += '</div>';
    });
  }
  
  html += '</div>';
  panel.innerHTML = html;
}
