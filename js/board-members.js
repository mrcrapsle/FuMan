/* eslint-disable no-undef */

const BOARD_MEMBER_TYPES = {
  president: {
    name: 'Präsident',
    influence: 1.0,
    priorities: ['finances', 'reputation', 'success'],
    salary: 50000,
    votingPower: 2
  },
  vicePresident: {
    name: 'Vizepräsident',
    influence: 0.8,
    priorities: ['success', 'development', 'finances'],
    salary: 30000,
    votingPower: 1.5
  },
  financeDirector: {
    name: 'Finanzvorstand',
    influence: 0.7,
    priorities: ['finances', 'stability', 'reputation'],
    salary: 40000,
    votingPower: 1.5
  },
  sportDirector: {
    name: 'Sportvorstand',
    influence: 0.85,
    priorities: ['success', 'development', 'reputation'],
    salary: 35000,
    votingPower: 1.5
  },
  academyDirector: {
    name: 'Akademieleiter',
    influence: 0.5,
    priorities: ['development', 'reputation', 'finances'],
    salary: 25000,
    votingPower: 0.75
  },
  fanRepresentative: {
    name: 'Fanvertreter',
    influence: 0.6,
    priorities: ['success', 'reputation', 'development'],
    salary: 10000,
    votingPower: 0.75
  },
  member: {
    name: 'Mitglied',
    influence: 0.4,
    priorities: ['finances', 'reputation', 'success'],
    salary: 0,
    votingPower: 0.5
  }
};

function initializeBoardMembers() {
  if (!game.boardMembers) {
    game.boardMembers = [];
    createDefaultBoard();
  }
  if (!game.boardDecisions) {
    game.boardDecisions = [];
  }
  if (!game.boardMemberSatisfaction) {
    game.boardMemberSatisfaction = {};
  }
  if (!game.boardConflicts) {
    game.boardConflicts = [];
  }
}

function createDefaultBoard() {
  const firstNames = ['Klaus', 'Bernd', 'Helmut', 'Petra', 'Michael', 'Stefan', 'Wolfgang', 'Anke'];
  const lastNames = ['Schmidt', 'Meyer', 'Müller', 'Wagner', 'Schneider', 'Fischer', 'Weber', 'Hoffmann'];

  const positions = ['president', 'sportDirector', 'financeDirector', 'member', 'member'];

  positions.forEach((type, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index + 2) % lastNames.length];
    createBoardMember(
      `${firstName} ${lastName}`,
      type,
      50
    );
  });
}

function createBoardMember(name, type, satisfaction) {
  const config = BOARD_MEMBER_TYPES[type];
  if (!config) return null;

  const member = {
    id: game.boardMembers.length,
    name: name,
    type: type,
    satisfaction: Math.min(100, Math.max(0, satisfaction)),
    influence: config.influence,
    yearsOnBoard: 0,
    votingPower: config.votingPower,
    salary: config.salary,
    relationshipWithManager: 50,
    priorities: [...config.priorities]
  };

  game.boardMembers.push(member);
  game.boardMemberSatisfaction[member.id] = satisfaction;
  return member;
}

function updateBoardMemberSatisfaction(memberId, delta) {
  if (!game.boardMembers || !game.boardMembers[memberId]) return;

  const member = game.boardMembers[memberId];
  member.satisfaction = Math.min(100, Math.max(0, member.satisfaction + delta));
  game.boardMemberSatisfaction[memberId] = member.satisfaction;
}

function getAverageBoardSatisfaction() {
  if (!game.boardMembers || game.boardMembers.length === 0) return 50;

  let total = 0;
  game.boardMembers.forEach((member) => {
    total += member.satisfaction;
  });

  return total / game.boardMembers.length;
}

function getBoardInfluenceOnDecision() {
  const avgSatisfaction = getAverageBoardSatisfaction();
  let influence = 1.0;

  if (avgSatisfaction > 75) {
    influence = 1.15;
  } else if (avgSatisfaction > 60) {
    influence = 1.05;
  } else if (avgSatisfaction < 40) {
    influence = 0.9;
  } else if (avgSatisfaction < 25) {
    influence = 0.75;
  }

  return influence;
}

function checkBoardConflict() {
  if (!game.boardMembers || game.boardMembers.length < 2) return false;

  let conflictChance = 0;
  let conflictMembers = [];

  game.boardMembers.forEach((member) => {
    if (member.satisfaction < 35) {
      conflictChance += 0.1;
      conflictMembers.push(member);
    }
  });

  if (Math.random() < conflictChance && conflictMembers.length > 0) {
    const member = conflictMembers[Math.floor(Math.random() * conflictMembers.length)];
    const conflictTypes = [
      'Einspruch gegen aktuelle Taktik',
      'Forderung nach mehr Investitionen',
      'Kritik an Trainerkompetenz',
      'Konflikt über Spielerverkauf'
    ];

    const conflict = {
      type: conflictTypes[Math.floor(Math.random() * conflictTypes.length)],
      member: member.name,
      memberId: member.id,
      season: game.season,
      resolved: false
    };

    if (!game.boardConflicts) game.boardConflicts = [];
    game.boardConflicts.push(conflict);

    if (game.inbox) {
      addInboxMessage(`⚠️ Vorstandskonflikt: ${member.name}`, conflict.type);
    }

    updateBoardMemberSatisfaction(member.id, -15);
    return true;
  }

  return false;
}

function processBoardDecision(decisionType, outcome) {
  if (!game.boardMembers) return 1.0;

  let supportScore = 0;
  let totalInfluence = 0;

  game.boardMembers.forEach((member) => {
    const typeConfig = BOARD_MEMBER_TYPES[member.type];
    const matchesPreference = typeConfig.priorities.includes(decisionType);
    const supportMultiplier = matchesPreference ? 1.2 : 0.8;

    const memberSupport = (member.satisfaction / 100) * supportMultiplier;
    supportScore += memberSupport * member.votingPower;
    totalInfluence += member.votingPower;
  });

  const finalSupport = totalInfluence > 0 ? supportScore / totalInfluence : 0.5;

  if (outcome === 'success') {
    game.boardMembers.forEach((member) => {
      updateBoardMemberSatisfaction(member.id, 3);
    });
  } else if (outcome === 'failure') {
    game.boardMembers.forEach((member) => {
      const typeConfig = BOARD_MEMBER_TYPES[member.type];
      const penalty = typeConfig.priorities.includes(decisionType) ? 8 : 3;
      updateBoardMemberSatisfaction(member.id, -penalty);
    });
  }

  return finalSupport;
}

function getBoardVotingResult(proposalType) {
  if (!game.boardMembers || game.boardMembers.length === 0) return true;

  let yesVotes = 0;
  let totalVotes = 0;

  game.boardMembers.forEach((member) => {
    const typeConfig = BOARD_MEMBER_TYPES[member.type];
    const supportProbability = member.satisfaction / 100 + (typeConfig.priorities.includes(proposalType) ? 0.2 : 0);

    if (Math.random() < Math.min(1.0, supportProbability)) {
      yesVotes += member.votingPower;
    }

    totalVotes += member.votingPower;
  });

  return yesVotes / totalVotes > 0.5;
}

function getBoardExpenses() {
  if (!game.boardMembers) return 0;

  let totalExpenses = 0;
  game.boardMembers.forEach((member) => {
    const typeConfig = BOARD_MEMBER_TYPES[member.type];
    totalExpenses += typeConfig.salary;
  });

  return totalExpenses;
}

function recordBoardDecision(type, description, outcome) {
  if (!game.boardDecisions) game.boardDecisions = [];

  game.boardDecisions.push({
    type: type,
    description: description,
    outcome: outcome,
    season: game.season,
    matchday: game.matchday,
    timestamp: new Date().toISOString()
  });
}

function renderBoardMembersPanel() {
  const panel = document.getElementById('board-members-panel');
  if (!panel) return;

  if (!game.boardMembers) {
    initializeBoardMembers();
  }

  const avgSatisfaction = getAverageBoardSatisfaction();
  const boardInfluence = getBoardInfluenceOnDecision();
  const boardExpenses = getBoardExpenses();

  let html = '<div class="panel-content">';
  html += `<h3>Vorstandsmitglieder</h3>`;

  html += '<div class="board-stats">';
  html += `<div class="stat-box">Durchschn. Zufriedenheit: ${Math.round(avgSatisfaction)}%</div>`;
  html += `<div class="stat-box">Vorstandseinfluss: ${(boardInfluence * 100).toFixed(0)}%</div>`;
  html += `<div class="stat-box">Gehälter pro Spieltag: €${Math.round(boardExpenses / 34)}</div>`;
  html += `<div class="stat-box">Mitglieder: ${game.boardMembers.length}</div>`;
  html += '</div>';

  if (avgSatisfaction < 40) {
    html += `<div style="font-size:11px; color:#FF5252; margin:6px 0; padding:6px; background:rgba(255,82,82,0.1); border-radius:4px;">⚠️ Vorstand ist unzufrieden! Entscheidungen könnten blockiert werden!</div>`;
  }

  html += '<h4>Vorstandsmitglieder:</h4>';
  game.boardMembers.forEach((member) => {
    const typeConfig = BOARD_MEMBER_TYPES[member.type];
    const satisfactionColor = member.satisfaction > 60 ? '#4CAF50' : member.satisfaction > 40 ? '#FFC107' : '#FF5252';

    html += `<div class="board-member-item" style="border-left: 4px solid ${satisfactionColor}">`;
    html += `<strong>${member.name}</strong> (${typeConfig.name})`;
    html += `<div class="member-info">Zufriedenheit: ${Math.round(member.satisfaction)}% | Einfluss: ${(member.influence * 100).toFixed(0)}%</div>`;
    html += `<div class="member-info">Stimmrecht: ${member.votingPower} | Prioritäten: ${member.priorities.join(', ')}</div>`;
    html += '</div>';
  });

  html += '<h4>Konflikte:</h4>';
  if (game.boardConflicts && game.boardConflicts.length > 0) {
    game.boardConflicts.filter(c => !c.resolved).slice(-3).forEach((conflict) => {
      html += `<div class="conflict-item">`;
      html += `<strong>${conflict.member}</strong>: ${conflict.type}`;
      html += `</div>`;
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Keine aktuellen Konflikte</div>';
  }

  html += '</div>';
  panel.innerHTML = html;
}
