// Opposition Analysis System
// Analyzes upcoming opponents, identifies weaknesses, and provides tactical recommendations

let oppositionAnalysisState = {
    analyzedOpponents: [],
    upcomingMatches: [],
    matchHistory: []
};

const OPPONENT_FORMATIONS = [
    { name: '4-4-2', defense: 85, midfield: 80, attack: 75 },
    { name: '4-3-3', defense: 80, midfield: 85, attack: 80 },
    { name: '3-5-2', defense: 70, midfield: 90, attack: 85 },
    { name: '5-3-2', defense: 95, midfield: 75, attack: 70 },
    { name: '4-2-3-1', defense: 88, midfield: 82, attack: 78 },
    { name: '2-3-5', defense: 60, midfield: 85, attack: 95 }
];

const WEAKNESSES = [
    'Schwache Defensive',
    'Langsame Außenbahn',
    'Fehlerhafte Luftspiele',
    'Schwaches Pressing',
    'Instabile Torwartleistung',
    'Fehlende Spielkontrolle',
    'Hohe Verletzungsrate'
];

function initializeOppositionAnalysis() {
    if (!game.oppositionAnalysis) game.oppositionAnalysis = [];
    if (!game.upcomingOpponents) game.upcomingOpponents = [];

    // Initialize with random opponents for schedule
    generateOpponentSchedule();
}

function generateOpponentSchedule() {
    const opponents = [
        { name: 'FC Dortmund', strength: 82 },
        { name: 'Bayern München', strength: 95 },
        { name: 'RB Leipzig', strength: 88 },
        { name: 'Bayer Leverkusen', strength: 85 },
        { name: 'Schalke 04', strength: 72 },
        { name: 'Borussia Mönchengladbach', strength: 80 },
        { name: 'VfL Wolfsburg', strength: 78 },
        { name: 'TSG Hoffenheim', strength: 75 },
        { name: 'FC Köln', strength: 68 },
        { name: 'Union Berlin', strength: 71 },
        { name: 'SC Freiburg', strength: 73 },
        { name: 'Eintracht Frankfurt', strength: 79 },
        { name: 'VfB Stuttgart', strength: 77 },
        { name: 'Hamburger SV', strength: 70 },
        { name: 'Werder Bremen', strength: 74 },
        { name: 'Mainz 05', strength: 69 }
    ];

    game.upcomingOpponents = [];
    for (let i = 0; i < 10; i++) {
        const opponent = opponents[Math.floor(Math.random() * opponents.length)];
        game.upcomingOpponents.push({
            name: opponent.name,
            matchday: (game.matchday || 1) + (i * 3) + 1,
            strength: opponent.strength,
            analyzed: false
        });
    }
}

function analyzeOpponent(opponentName) {
    let analysis = game.oppositionAnalysis.find(o => o.name === opponentName);

    if (!analysis) {
        analysis = createOpponentAnalysis(opponentName);
        game.oppositionAnalysis.push(analysis);
    }

    return analysis;
}

function createOpponentAnalysis(opponentName) {
    const strength = 50 + Math.random() * 50; // 50-100
    const formation = OPPONENT_FORMATIONS[Math.floor(Math.random() * OPPONENT_FORMATIONS.length)];

    // Generate key players
    const keyPlayers = [];
    for (let i = 0; i < 3; i++) {
        keyPlayers.push({
            name: generatePlayerName(),
            position: ['ST', 'CM', 'LB', 'CB', 'GK'][Math.floor(Math.random() * 5)],
            strength: 70 + Math.random() * 30,
            gamesInSeason: 15 + Math.floor(Math.random() * 15),
            goalsInSeason: Math.floor(Math.random() * 20)
        });
    }

    // Select weaknesses
    const selectedWeaknesses = [];
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        const weakness = WEAKNESSES[Math.floor(Math.random() * WEAKNESSES.length)];
        if (!selectedWeaknesses.includes(weakness)) {
            selectedWeaknesses.push(weakness);
        }
    }

    // Generate recommended formations
    const recommendedFormations = [];
    if (selectedWeaknesses.includes('Schwache Defensive')) {
        recommendedFormations.push('3-5-2');
    }
    if (selectedWeaknesses.includes('Langsame Außenbahn')) {
        recommendedFormations.push('4-3-3');
    }
    if (selectedWeaknesses.includes('Fehlerhafte Luftspiele')) {
        recommendedFormations.push('4-4-2');
    }
    if (recommendedFormations.length === 0) {
        recommendedFormations.push('4-3-3');
    }

    const analysis = {
        id: `opponent_${opponentName}_${Date.now()}`,
        name: opponentName,
        overallStrength: Math.floor(strength),
        lastAnalyzedMatchday: game.matchday || 1,
        formation: formation,
        keyPlayers: keyPlayers,
        weaknesses: selectedWeaknesses,
        strengths: [
            'Hohe Ballbesitzquote',
            'Schnelle Umschaltspiele',
            'Erfahrene Spieler'
        ],
        recommendedFormations: recommendedFormations,
        recentForm: generateRecentForm(),
        headToHeadRecord: {
            wins: Math.floor(Math.random() * 5),
            draws: Math.floor(Math.random() * 3),
            losses: Math.floor(Math.random() * 5)
        }
    };

    return analysis;
}

function generateRecentForm() {
    const results = ['W', 'D', 'L'];
    const form = [];
    for (let i = 0; i < 5; i++) {
        form.push(results[Math.floor(Math.random() * results.length)]);
    }
    return form;
}

function generatePlayerName() {
    const firstNames = ['Max', 'Thomas', 'Jürgen', 'Julian', 'Robert', 'Marco', 'Christian'];
    const lastNames = ['Mueller', 'Schmidt', 'Wagner', 'Becker', 'Hoffmann', 'Keller', 'Richter'];

    return firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' +
           lastNames[Math.floor(Math.random() * lastNames.length)];
}

function getRecommendedTactics(opponentAnalysis) {
    const tactics = [];

    if (opponentAnalysis.overallStrength > 85) {
        tactics.push({
            recommendation: 'Defensives Pressing',
            reason: 'Gegner ist stark - Ballverluste erzwingen'
        });
    }

    if (opponentAnalysis.weaknesses.includes('Schwache Defensive')) {
        tactics.push({
            recommendation: 'Offensive Formation',
            reason: 'Defensive Schwächen ausnutzen'
        });
    }

    if (opponentAnalysis.weaknesses.includes('Langsame Außenbahn')) {
        tactics.push({
            recommendation: 'Flügelspiel',
            reason: 'Außenbahn ist verwundbar'
        });
    }

    if (opponentAnalysis.weaknesses.includes('Schwaches Pressing')) {
        tactics.push({
            recommendation: 'Possession-Spiel',
            reason: 'Ballkontrolle dominieren'
        });
    }

    if (tactics.length === 0) {
        tactics.push({
            recommendation: 'Ausgewogene Taktik',
            reason: 'Keine offensichtlichen Schwächen'
        });
    }

    return tactics;
}

function tickOppositionAnalysisUpdate() {
    // Update analysis if not done this month
    const currentMatchday = game.matchday || 1;

    game.upcomingOpponents.forEach(opponent => {
        // Analyze if match is within next 6 matchdays
        if (!opponent.analyzed && opponent.matchday > currentMatchday && opponent.matchday <= currentMatchday + 6) {
            analyzeOpponent(opponent.name);
            opponent.analyzed = true;
        }

        // Reset analysis for future matches
        if (opponent.matchday <= currentMatchday) {
            opponent.analyzed = false;
        }
    });
}

function getNextOpponentAnalysis() {
    const currentMatchday = game.matchday || 1;
    const nextMatch = game.upcomingOpponents.find(o => o.matchday > currentMatchday);

    if (!nextMatch) return null;

    return analyzeOpponent(nextMatch.name);
}

function recordMatchOutcome(opponentName, result, goalsFor, goalsAgainst) {
    const record = {
        opponent: opponentName,
        matchday: game.matchday || 1,
        result: result, // 'win', 'draw', 'loss'
        goalsFor: goalsFor,
        goalsAgainst: goalsAgainst
    };

    game.oppositionAnalysis.forEach(opp => {
        if (opp.name === opponentName) {
            opp.lastAnalyzedMatchday = game.matchday || 1;
            if (result === 'win') {
                opp.headToHeadRecord.wins++;
            } else if (result === 'draw') {
                opp.headToHeadRecord.draws++;
            } else {
                opp.headToHeadRecord.losses++;
            }
        }
    });
}

function renderOppositionAnalysisPanel() {
    const container = document.getElementById('opposition-analysis-box');
    if (!container) return;

    initializeOppositionAnalysis();
    tickOppositionAnalysisUpdate();

    let html = '<div class="panel-content">';
    html += '<h3>Gegneranalyse</h3>';

    const nextAnalysis = getNextOpponentAnalysis();

    if (nextAnalysis) {
        html += '<div class="opponent-card">';
        html += `<h4>${nextAnalysis.name}</h4>`;

        // Overall Strength
        html += '<div class="analysis-row">';
        html += `<span><strong>Gesamtstärke:</strong> ${nextAnalysis.overallStrength}/100</span>`;
        const strengthBar = Math.floor(nextAnalysis.overallStrength / 10);
        html += `<div class="strength-bar" style="width: ${strengthBar * 10}%"></div>`;
        html += '</div>';

        // Formation
        html += `<p><strong>Formation:</strong> ${nextAnalysis.formation.name}</p>`;

        // Recent Form
        html += '<p><strong>Aktuelle Form:</strong> ';
        nextAnalysis.recentForm.forEach(result => {
            const color = result === 'W' ? 'green' : result === 'D' ? 'yellow' : 'red';
            html += `<span class="form-${color}">${result}</span>`;
        });
        html += '</p>';

        // Key Players
        html += '<p><strong>Schlüsselspieler:</strong></p>';
        html += '<ul>';
        nextAnalysis.keyPlayers.forEach(player => {
            html += `<li>${player.name} (${player.position}) - Str: ${Math.floor(player.strength)} (${player.goalsInSeason} Tore)</li>`;
        });
        html += '</ul>';

        // Weaknesses
        html += '<p><strong>Schwächen:</strong></p>';
        html += '<ul>';
        nextAnalysis.weaknesses.forEach(weakness => {
            html += `<li>🎯 ${weakness}</li>`;
        });
        html += '</ul>';

        // Tactical Recommendations
        const tactics = getRecommendedTactics(nextAnalysis);
        html += '<p><strong>Empfohlene Taktiken:</strong></p>';
        html += '<ul>';
        tactics.forEach(tactic => {
            html += `<li><strong>${tactic.recommendation}:</strong> ${tactic.reason}</li>`;
        });
        html += '</ul>';

        // Head to Head
        const h2h = nextAnalysis.headToHeadRecord;
        const h2hTotal = h2h.wins + h2h.draws + h2h.losses;
        html += `<p><strong>Kopf-an-Kopf:</strong> ${h2h.wins}S, ${h2h.draws}U, ${h2h.losses}N (${h2hTotal} Spiele)</p>`;

        html += '</div>';
    } else {
        html += '<p>Keine kommenden Gegner analysiert.</p>';
    }

    // Upcoming Matches
    html += '<div class="upcoming-matches">';
    html += '<h4>Kommende Gegner</h4>';
    html += '<table class="matches-table">';
    html += '<tr><th>Matchday</th><th>Gegner</th><th>Stärke</th><th>Status</th></tr>';

    game.upcomingOpponents.slice(0, 5).forEach(opponent => {
        const analyzed = game.oppositionAnalysis.find(o => o.name === opponent.name);
        const status = analyzed ? '✓ Analysiert' : '○ Nicht analysiert';
        html += `<tr>
                    <td>MD ${opponent.matchday}</td>
                    <td>${opponent.name}</td>
                    <td>${opponent.strength}/100</td>
                    <td>${status}</td>
                </tr>`;
    });

    html += '</table>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}
