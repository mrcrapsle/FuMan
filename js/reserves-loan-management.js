// Reserves & Loan Management System
// Manages reserve squad, player loans, and development of young players

let reservesLoanState = {
    reserveSquad: [],
    loanedOutPlayers: [],
    incomingLoans: [],
    loanOffers: []
};

const LOAN_DURATIONS = [
    { months: 6, minSalaryShare: 20, maxSalaryShare: 40 },
    { months: 12, minSalaryShare: 30, maxSalaryShare: 60 },
    { months: 18, minSalaryShare: 40, maxSalaryShare: 70 }
];

const INCOMING_LOAN_CLUBS = [
    { name: 'Bayern München', division: 1, maxAge: 30 },
    { name: 'BVB Dortmund', division: 1, maxAge: 28 },
    { name: 'RB Leipzig', division: 1, maxAge: 29 },
    { name: 'Bayer Leverkusen', division: 1, maxAge: 27 },
    { name: '1. FC Köln', division: 1, maxAge: 25 },
    { name: 'Eintracht Frankfurt', division: 1, maxAge: 26 },
    { name: 'Union Berlin', division: 1, maxAge: 24 }
];

function initializeReservesLoan() {
    if (!game.reserves) game.reserves = {};
    if (!game.reserves.reserveSquad) game.reserves.reserveSquad = [];
    if (!game.reserves.loanedOut) game.reserves.loanedOut = [];
    if (!game.reserves.incomingLoans) game.reserves.incomingLoans = [];
    if (!game.reserves.friendlyMatches) game.reserves.friendlyMatches = [];
}

function promoteToReserveSquad(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player || !game.reserves) return false;

    const reserve = {
        id: player.id,
        name: player.name,
        position: player.position,
        strength: player.strength,
        age: player.age,
        morale: player.morale,
        promotedMatchday: game.matchday || 1,
        developmentFocus: null,
        matchesPlayed: 0,
        goals: 0
    };

    game.reserves.reserveSquad.push(reserve);
    return true;
}

function demoteToReserveSquad(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return false;

    return promoteToReserveSquad(playerId);
}

function loanOutPlayer(playerId, loanDuration, salarySharePercentage) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    const loan = {
        id: `loan_${playerId}_${Date.now()}`,
        playerId: playerId,
        playerName: player.name,
        playerPosition: player.position,
        loanedClub: INCOMING_LOAN_CLUBS[Math.floor(Math.random() * INCOMING_LOAN_CLUBS.length)].name,
        startMatchday: game.matchday || 1,
        endMatchday: (game.matchday || 1) + (loanDuration * 8.5), // Approximate matchdays per half-season
        monthlySalaryCost: Math.floor(player.wage * (salarySharePercentage / 100)),
        developmentBonus: Math.random() * 0.3, // 0-30% potential increase
        buyoutClause: null,
        status: 'active'
    };

    if (!game.reserves.loanedOut) game.reserves.loanedOut = [];
    game.reserves.loanedOut.push(loan);

    // Remove from main squad
    const index = squad.findIndex(p => p.id === playerId);
    if (index > -1) {
        squad.splice(index, 1);
    }

    return loan;
}

function acceptIncomingLoan(club, position, strength) {
    const loanPlayer = {
        id: `incoming_loan_${Date.now()}`,
        name: generateLoanPlayerName(),
        club: club,
        position: position,
        strength: strength,
        age: 20 + Math.floor(Math.random() * 8),
        startMatchday: game.matchday || 1,
        endMatchday: (game.matchday || 1) + (12 * 8.5), // 12-month loan
        status: 'active',
        matchesPlayed: 0,
        goals: 0
    };

    if (!game.reserves.incomingLoans) game.reserves.incomingLoans = [];
    game.reserves.incomingLoans.push(loanPlayer);

    return loanPlayer;
}

function generateLoanPlayerName() {
    const firstNames = ['Stefan', 'Daniel', 'Michael', 'Andreas', 'Klaus', 'Frank', 'Peter'];
    const lastNames = ['Mueller', 'Schmidt', 'Wagner', 'Bauer', 'Fischer', 'Weber', 'Meyer'];

    return firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' +
           lastNames[Math.floor(Math.random() * lastNames.length)];
}

function recallLoanedPlayer(loanId) {
    const loan = game.reserves.loanedOut.find(l => l.id === loanId);
    if (!loan) return false;

    const player = squad.find(p => p.id === loan.playerId);
    if (!player) {
        // Recreate player if not in squad
        squad.push({
            id: loan.playerId,
            name: loan.playerName,
            pos: loan.playerPosition,
            strength: Math.min(100, loan.developmentBonus * 20 + 60),
            age: 25,
            morale: 70,
            wage: Math.floor(50000 + Math.random() * 50000)
        });
    }

    loan.status = 'recalled';
    return true;
}

function tickLoanedPlayerDevelopment() {
    if (!game.reserves.loanedOut) return;

    const currentMatchday = game.matchday || 1;

    game.reserves.loanedOut.forEach(loan => {
        if (loan.status === 'active' && currentMatchday >= loan.endMatchday) {
            // Loan ended
            loan.status = 'ended';

            // Player returns stronger due to development bonus
            const player = squad.find(p => p.id === loan.playerId);
            if (player && loan.developmentBonus > 0) {
                player.strength = Math.min(100, player.strength + loan.developmentBonus * 5);
            }
        }

        // Deduct salary costs during loan
        if (loan.status === 'active') {
            game.money -= loan.monthlySalaryCost;
        }
    });
}

function tickIncomingLoanManagement() {
    if (!game.reserves.incomingLoans) return;

    const currentMatchday = game.matchday || 1;

    game.reserves.incomingLoans.forEach(loan => {
        if (loan.status === 'active' && currentMatchday >= loan.endMatchday) {
            loan.status = 'ended';
        }
    });

    // Potential loan offers (5% chance per month)
    if (Math.random() < 0.05 && game.reserves.reserveSquad && game.reserves.reserveSquad.length > 0) {
        const candidate = game.reserves.reserveSquad[Math.floor(Math.random() * game.reserves.reserveSquad.length)];
        const loanOffer = {
            id: `offer_${candidate.id}_${Date.now()}`,
            playerId: candidate.id,
            playerName: candidate.name,
            club: INCOMING_LOAN_CLUBS[Math.floor(Math.random() * INCOMING_LOAN_CLUBS.length)].name,
            duration: LOAN_DURATIONS[Math.floor(Math.random() * LOAN_DURATIONS.length)],
            createdMatchday: game.matchday || 1
        };

        if (!game.reserves.loanOffers) game.reserves.loanOffers = [];
        game.reserves.loanOffers.push(loanOffer);
    }
}

function playReserveFriendly(opponent) {
    const reserveStrength = game.reserves.reserveSquad && game.reserves.reserveSquad.length > 0
        ? game.reserves.reserveSquad.reduce((sum, p) => sum + p.strength, 0) / game.reserves.reserveSquad.length
        : 40;

    const opponentStrength = 50 + Math.random() * 20;

    const ourGoals = Math.floor(reserveStrength / 20 + Math.random() * 2);
    const theirGoals = Math.floor(opponentStrength / 20 + Math.random() * 2);

    const result = ourGoals > theirGoals ? 'win' : ourGoals === theirGoals ? 'draw' : 'loss';

    const match = {
        opponent: opponent,
        matchday: game.matchday || 1,
        result: result,
        ourGoals: ourGoals,
        theirGoals: theirGoals,
        attendance: 2000 + Math.random() * 3000
    };

    if (!game.reserves.friendlyMatches) game.reserves.friendlyMatches = [];
    game.reserves.friendlyMatches.push(match);

    // Update reserve player stats
    if (game.reserves.reserveSquad) {
        game.reserves.reserveSquad.forEach(p => {
            p.matchesPlayed++;
            if (Math.random() < (p.strength / 100)) {
                p.goals += Math.floor(Math.random() * 2);
            }
        });
    }

    return match;
}

function renderReservesLoanPanel() {
    const container = document.getElementById('reserves-loan-box');
    if (!container) return;

    initializeReservesLoan();

    let html = '<div class="panel-content">';
    html += '<h3>Reservemannschaft & Leihspieler</h3>';

    // Reserve Squad Section
    if (game.reserves.reserveSquad && game.reserves.reserveSquad.length > 0) {
        html += '<div class="reserves-section">';
        html += '<h4>Reservemannschaft (' + game.reserves.reserveSquad.length + ')</h4>';
        html += '<table class="reserves-table" style="width:100%; font-size:9px;">';
        html += '<tr><th>Spieler</th><th>Pos.</th><th>Stärke</th><th>Spiele</th><th>Tore</th></tr>';

        game.reserves.reserveSquad.slice(0, 8).forEach(player => {
            html += `<tr>
                        <td>${player.name}</td>
                        <td>${player.position}</td>
                        <td>${Math.floor(player.strength)}</td>
                        <td>${player.matchesPlayed}</td>
                        <td>${player.goals}</td>
                    </tr>`;
        });

        html += '</table>';
        html += '</div>';
    }

    // Loaned Out Players Section
    if (game.reserves.loanedOut && game.reserves.loanedOut.length > 0) {
        html += '<div class="loaned-section" style="margin-top:10px;">';
        html += '<h4>Verliehene Spieler (' + game.reserves.loanedOut.filter(l => l.status === 'active').length + ')</h4>';
        html += '<table class="loaned-table" style="width:100%; font-size:9px;">';
        html += '<tr><th>Spieler</th><th>Verein</th><th>Rückgabe</th><th>Kosten</th><th>Status</th></tr>';

        game.reserves.loanedOut.filter(l => l.status === 'active').forEach(loan => {
            const matchdaysRemaining = Math.max(0, loan.endMatchday - (game.matchday || 1));
            const seasonsRemaining = (matchdaysRemaining / 34).toFixed(1);
            html += `<tr>
                        <td>${loan.playerName}</td>
                        <td>${loan.loanedClub}</td>
                        <td>${seasonsRemaining}S</td>
                        <td>€${loan.monthlySalaryCost.toLocaleString()}/M</td>
                        <td>Aktiv</td>
                    </tr>`;
        });

        html += '</table>';
        html += '</div>';
    }

    // Incoming Loans Section
    if (game.reserves.incomingLoans && game.reserves.incomingLoans.length > 0) {
        html += '<div class="incoming-section" style="margin-top:10px;">';
        html += '<h4>Leihspieler (' + game.reserves.incomingLoans.filter(l => l.status === 'active').length + ')</h4>';
        html += '<table class="incoming-table" style="width:100%; font-size:9px;">';
        html += '<tr><th>Spieler</th><th>Verein</th><th>Pos.</th><th>Stärke</th><th>Spiele</th></tr>';

        game.reserves.incomingLoans.filter(l => l.status === 'active').forEach(loan => {
            html += `<tr>
                        <td>${loan.name}</td>
                        <td>${loan.club}</td>
                        <td>${loan.position}</td>
                        <td>${Math.floor(loan.strength)}</td>
                        <td>${loan.matchesPlayed}</td>
                    </tr>`;
        });

        html += '</table>';
        html += '</div>';
    }

    // Loan Offers Section
    if (game.reserves.loanOffers && game.reserves.loanOffers.length > 0) {
        html += '<div class="offers-section" style="margin-top:10px;">';
        html += '<h4>Leih-Anfragen (' + game.reserves.loanOffers.length + ')</h4>';
        html += '<ul style="font-size:9px;">';

        game.reserves.loanOffers.slice(0, 5).forEach(offer => {
            html += `<li>${offer.playerName} → ${offer.club} (${offer.duration.months} Monate)</li>`;
        });

        html += '</ul>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
