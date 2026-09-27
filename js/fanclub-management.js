/* eslint-disable no-undef */

function initializeFanclubs() {
  if (!game.fanclubs) {
    game.fanclubs = [];
  }
  if (!game.fanSatisfaction) {
    game.fanSatisfaction = 50;
  }
  if (!game.ultraGroups) {
    game.ultraGroups = [];
  }
}

function createFanclub(name, ultraGroupName, ultras, type) {
  const fanclub = {
    id: game.fanclubs.length,
    name: name,
    ultraGroupName: ultraGroupName,
    ultras: ultras,
    type: type,
    satisfaction: 50,
    funding: 0,
    influence: 0.5,
    createdSeason: game.season,
    matchAttendance: [],
    revenueFans: 0,
  };
  game.fanclubs.push(fanclub);
  return fanclub;
}

function addUltraGroup(name, intensity) {
  const ultraGroup = {
    id: game.ultraGroups.length,
    name: name,
    intensity: Math.min(100, Math.max(0, intensity)),
    loyalty: 60,
    violence: 0,
    bannerCount: 1,
    createdSeason: game.season,
  };
  game.ultraGroups.push(ultraGroup);
  return ultraGroup;
}

function updateFanSatisfaction(delta) {
  game.fanSatisfaction = Math.min(100, Math.max(0, game.fanSatisfaction + delta));
}

function getFanSatisfactionBonus() {
  if (game.fanSatisfaction < 30) {
    return -0.15;
  } else if (game.fanSatisfaction < 50) {
    return -0.05;
  } else if (game.fanSatisfaction < 70) {
    return 0.05;
  } else {
    return 0.15;
  }
}

function getUltraInfluence() {
  let totalInfluence = 0;
  if (game.ultraGroups) {
    game.ultraGroups.forEach((group) => {
      totalInfluence += (group.intensity / 100) * group.loyalty / 100;
    });
  }
  return Math.min(1.5, totalInfluence * 0.5);
}

function processFanRevenue() {
  let revenue = 0;
  if (game.fanclubs) {
    game.fanclubs.forEach((club) => {
      const satisfactionBonus = 1 + (club.satisfaction - 50) / 100 * 0.2;
      const clubRevenue = Math.floor((club.ultras * 2 + club.funding * 0.1) * satisfactionBonus);
      revenue += clubRevenue;
      club.revenueFans += clubRevenue;
    });
  }
  return revenue;
}

function checkFanProtest() {
  if (game.fanSatisfaction < 25 && Math.random() < 0.2) {
    const protest = {
      type: 'protest',
      message: 'Protestaktion: Fans demonstrieren gegen Spielweise!',
      impact: 'Negative Medienberichterstattung',
    };
    if (game.inbox) {
      addInboxMessage('⚠️ ' + protest.message, protest.impact);
    }
    return true;
  }
  return false;
}

function checkUltraConflict() {
  if (game.ultraGroups && game.ultraGroups.length > 1) {
    const group1 = game.ultraGroups[Math.floor(Math.random() * game.ultraGroups.length)];
    const group2 = game.ultraGroups[Math.floor(Math.random() * game.ultraGroups.length)];
    if (group1.id !== group2.id && Math.random() < 0.15) {
      const conflict = group1.violence + group2.violence > 100;
      if (conflict && Math.random() < 0.3) {
        if (game.inbox) {
          addInboxMessage('⚠️ Ultra-Konflikt', 'Gewalt zwischen Ultra-Gruppen! Stadionverbot für beide Gruppen.');
        }
        group1.violence = Math.min(100, group1.violence + 10);
        group2.violence = Math.min(100, group2.violence + 10);
        group1.loyalty = Math.max(0, group1.loyalty - 5);
        group2.loyalty = Math.max(0, group2.loyalty - 5);
      }
    }
  }
}

function upgradeFanclubFunding(fanclubId, amount) {
  if (game.fanclubs && game.fanclubs[fanclubId]) {
    const fanclub = game.fanclubs[fanclubId];
    fanclub.funding = Math.min(1000, fanclub.funding + amount);
    fanclub.satisfaction = Math.min(100, fanclub.satisfaction + 3);
  }
}

function renderFanclubManagementPanel() {
  const panel = document.getElementById('fanclub-management-panel');
  if (!panel) return;

  if (!game.fanclubs || game.fanclubs.length === 0) {
    createFanclub('Ultras München', 'Red Army', 500, 'ultras');
    createFanclub('Fanclub Süd', 'Core Fans', 300, 'traditional');
  }

  if (!game.ultraGroups || game.ultraGroups.length === 0) {
    addUltraGroup('Red Army', 75);
    addUltraGroup('South Side', 65);
  }

  let html = '<div class="panel-content">';
  html += `<h3>Fanclub Management - Fangesamtzufriedenheit: ${Math.round(game.fanSatisfaction)}%</h3>`;

  html += '<div class="fanclub-stats">';
  html += `<div class="stat-box">Satisfaction Bonus: ${(getFanSatisfactionBonus() * 100).toFixed(0)}%</div>`;
  html += `<div class="stat-box">Ultra Einfluss: ${(getUltraInfluence() * 100).toFixed(0)}%</div>`;
  html += '</div>';

  html += '<h4>Fanclubs:</h4>';
  if (game.fanclubs) {
    game.fanclubs.forEach((club) => {
      const satisfactionColor = club.satisfaction > 60 ? '#4CAF50' : club.satisfaction > 40 ? '#FFC107' : '#FF5252';
      html += `<div class="fanclub-item" style="border-left: 4px solid ${satisfactionColor}">`;
      html += `<strong>${club.name}</strong> (${club.type})`;
      html += `<div class="club-info">Ultras: ${club.ultras} | Satisfaction: ${Math.round(club.satisfaction)}%</div>`;
      html += `<div class="club-info">Funding: €${club.funding} | Revenue: €${club.revenueFans}</div>`;
      html += `<button onclick="upgradeFanclubFunding(${club.id}, 50)">Invest €50</button>`;
      html += '</div>';
    });
  }

  html += '<h4>Ultra-Gruppen:</h4>';
  if (game.ultraGroups) {
    game.ultraGroups.forEach((group) => {
      const loyaltyColor = group.loyalty > 70 ? '#4CAF50' : group.loyalty > 50 ? '#FFC107' : '#FF5252';
      html += `<div class="ultra-group-item" style="border-left: 4px solid ${loyaltyColor}">`;
      html += `<strong>${group.name}</strong>`;
      html += `<div class="group-info">Intensity: ${Math.round(group.intensity)}% | Loyalty: ${Math.round(group.loyalty)}% | Violence: ${Math.round(group.violence)}%</div>`;
      html += `<div class="group-info">Banner: ${group.bannerCount} | Gegründet: Saison ${group.createdSeason}</div>`;
      html += '</div>';
    });
  }

  html += '</div>';
  panel.innerHTML = html;
}
