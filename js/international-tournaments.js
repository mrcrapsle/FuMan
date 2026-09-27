/* eslint-disable no-undef */

const INTERNATIONAL_TOURNAMENTS = {
  worldCup: {
    id: 'wc',
    name: 'Weltmeisterschaft',
    frequency: 48,
    prestige: 100,
    prizePool: 5000000,
    playersPerNation: 23,
    groupStageTeams: 32,
    rounds: ['groups', 'roundOf16', 'quarterfinals', 'semifinals', 'final']
  },
  euro: {
    id: 'euro',
    name: 'Europameisterschaft',
    frequency: 24,
    prestige: 80,
    prizePool: 2500000,
    playersPerNation: 23,
    groupStageTeams: 24,
    rounds: ['groups', 'roundOf16', 'quarterfinals', 'semifinals', 'final']
  },
  copaAmerica: {
    id: 'ca',
    name: 'Copa America',
    frequency: 24,
    prestige: 70,
    prizePool: 1500000,
    playersPerNation: 23,
    groupStageTeams: 12,
    rounds: ['groups', 'semifinals', 'final']
  },
  africanCup: {
    id: 'ac',
    name: 'Afrikanischer Pokal der Nationen',
    frequency: 24,
    prestige: 60,
    prizePool: 1000000,
    playersPerNation: 23,
    groupStageTeams: 16,
    rounds: ['groups', 'quarterfinals', 'semifinals', 'final']
  },
  asianCup: {
    id: 'ac',
    name: 'AFC Asienmeisterschaft',
    frequency: 24,
    prestige: 55,
    prizePool: 800000,
    playersPerNation: 23,
    groupStageTeams: 16,
    rounds: ['groups', 'quarterfinals', 'semifinals', 'final']
  }
};

function initializeInternationalTournaments() {
  if (!game.internationalTournaments) {
    game.internationalTournaments = [];
  }
  if (!game.playerInternationalCaps) {
    game.playerInternationalCaps = {};
  }
  if (!game.internationalTournamentHistory) {
    game.internationalTournamentHistory = [];
  }
  if (!game.nextWorldCup) {
    game.nextWorldCup = 2026;
  }
}

function getPlayerNationality(player) {
  return player.nationality || 'Deutschland';
}

function isPlayerEligibleForTournament(player, tournamentType) {
  if (!player.active) return false;
  if (player.age > 35) return false;
  if (!player.strength || player.strength < 40) return false;

  if (tournamentType === 'wc') {
    return player.strength >= 50;
  } else if (tournamentType === 'euro') {
    return player.strength >= 45;
  } else {
    return player.strength >= 40;
  }
}

function selectTournamentSquad(tournamentType) {
  const tournament = Object.values(INTERNATIONAL_TOURNAMENTS).find(t => t.id === tournamentType);
  if (!tournament || !squad) return [];

  const eligible = squad.filter(p => isPlayerEligibleForTournament(p, tournamentType));
  const sorted = eligible.sort((a, b) => b.strength - a.strength);
  return sorted.slice(0, tournament.playersPerNation);
}

function getTournamentImpactOnPlayer(player, tournamentPerformance) {
  let strengthBonus = 0;
  let moraleBonus = 0;
  let marketValueMultiplier = 1.0;

  if (tournamentPerformance === 'winner') {
    strengthBonus = 3;
    moraleBonus = 20;
    marketValueMultiplier = 1.3;
  } else if (tournamentPerformance === 'finalist') {
    strengthBonus = 2;
    moraleBonus = 15;
    marketValueMultiplier = 1.2;
  } else if (tournamentPerformance === 'semifinalist') {
    strengthBonus = 1;
    moraleBonus = 10;
    marketValueMultiplier = 1.1;
  } else if (tournamentPerformance === 'quarterfinalist') {
    strengthBonus = 0;
    moraleBonus = 5;
    marketValueMultiplier = 1.05;
  } else if (tournamentPerformance === 'groupExit') {
    strengthBonus = -1;
    moraleBonus = -8;
    marketValueMultiplier = 0.95;
  }

  return {
    strengthBonus: strengthBonus,
    moraleBonus: moraleBonus,
    marketValueMultiplier: marketValueMultiplier
  };
}

function processTournamentSquadReturn(squadList, tournamentType, performanceLevel) {
  if (!squadList || squadList.length === 0) return;

  squadList.forEach((playerId) => {
    const player = squad.find(p => p.id === playerId);
    if (!player) return;

    const impact = getTournamentImpactOnPlayer(player, performanceLevel);
    player.strength = Math.min(100, Math.max(0, player.strength + impact.strengthBonus));
    player.morale = Math.min(100, Math.max(0, player.morale + impact.moraleBonus));

    if (player.marketValue) {
      player.marketValue = Math.round(player.marketValue * impact.marketValueMultiplier);
    }

    if (!game.playerInternationalCaps) {
      game.playerInternationalCaps = {};
    }
    if (!game.playerInternationalCaps[playerId]) {
      game.playerInternationalCaps[playerId] = 0;
    }
    game.playerInternationalCaps[playerId]++;

    if (game.inbox) {
      addInboxMessage(`⭐ ${player.name} kehrt von Turnier zurück`,
        `Stärke ${impact.strengthBonus > 0 ? '+' : ''}${impact.strengthBonus}, Moral ${impact.moraleBonus > 0 ? '+' : ''}${impact.moraleBonus}`);
    }
  });
}

function getTournamentParticipation() {
  if (!squad) return { total: 0, champions: 0, participation: 0 };

  let total = 0;
  let champions = 0;
  let participation = 0;

  squad.forEach((player) => {
    const caps = (game.playerInternationalCaps && game.playerInternationalCaps[player.id]) || 0;
    if (caps > 0) {
      participation++;
      total += caps;
      if (caps > 5) champions++;
    }
  });

  return { total: total, champions: champions, participation: participation };
}

function getTournamentLeagueBonus() {
  const participation = getTournamentParticipation();
  if (participation.participation === 0) return 0;
  return Math.min(0.25, participation.participation * 0.03);
}

function generateTournamentEvent(tournamentName, isKnockout) {
  const outcomes = isKnockout ?
    ['Bittere Niederlage in Verlängerung', 'Dramatischer Elfmeterschießen-Sieg', 'Klarer Sieg verdienter Gegner', 'Dominante Leistung'] :
    ['Unglückliche Niederlage', 'Langweiliges Remis', 'Verdiente Niederlage', 'Überraschender Sieg'];

  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

function recordTournamentMatch(tournamentName, opponent, result, squadPlayers) {
  if (!game.internationalTournamentHistory) {
    game.internationalTournamentHistory = [];
  }

  game.internationalTournamentHistory.push({
    tournament: tournamentName,
    opponent: opponent,
    result: result,
    season: game.season,
    matchday: game.matchday,
    squadSize: squadPlayers ? squadPlayers.length : 0
  });
}

function renderInternationalTournamentsPanel() {
  const panel = document.getElementById('international-tournaments-panel');
  if (!panel) return;

  if (!game.internationalTournaments) {
    initializeInternationalTournaments();
  }

  const participation = getTournamentParticipation();
  const leagueBonus = getTournamentLeagueBonus();

  let html = '<div class="panel-content">';
  html += `<h3>Internationale Turniere</h3>`;

  html += '<div class="tournament-stats">';
  html += `<div class="stat-box">Spieler im Einsatz: ${participation.participation}/${squad ? squad.length : 0}</div>`;
  html += `<div class="stat-box">Internationale Einsätze: ${participation.total}</div>`;
  html += `<div class="stat-box">Erfahrene Spieler: ${participation.champions}</div>`;
  html += `<div class="stat-box">Ligabonus: ${(leagueBonus * 100).toFixed(1)}%</div>`;
  html += '</div>';

  html += '<h4>Verfügbare Turniere:</h4>';
  Object.values(INTERNATIONAL_TOURNAMENTS).forEach((tournament) => {
    const squad_eligible = selectTournamentSquad(tournament.id);
    html += `<div class="tournament-item">`;
    html += `<strong>${tournament.name}</strong>`;
    html += `<div class="tournament-info">Prestige: ${tournament.prestige} | Preisgeld: €${tournament.prizePool.toLocaleString()}</div>`;
    html += `<div class="tournament-info">Teilnehmende Spieler: ${squad_eligible.length}/${tournament.playersPerNation} | Häufigkeit: alle ${tournament.frequency} Spieltage</div>`;
    html += `<div class="tournament-info">Gruppen: ${tournament.groupStageTeams} Teams | Runden: ${tournament.rounds.join(' → ')}</div>`;
    html += '</div>';
  });

  html += '<h4>Turnier-Historie:</h4>';
  if (game.internationalTournamentHistory && game.internationalTournamentHistory.length > 0) {
    game.internationalTournamentHistory.slice(-5).reverse().forEach((match) => {
      html += `<div class="tournament-history-item">`;
      html += `<strong>${match.tournament}</strong> vs ${match.opponent}`;
      html += `<div class="history-info">${match.result} | Saison ${match.season}</div>`;
      html += `</div>`;
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Noch keine Turnier-Einsätze</div>';
  }

  html += '</div>';
  panel.innerHTML = html;
}
