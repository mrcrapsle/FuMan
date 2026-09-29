// Turnier-Klammer-System
// DFB-Pokal, Landespokal und Champions Cup Visualization

let tournamentBracketsState = {
    activeBrackets: {},
    bracketHistory: [],
    matchupPreviews: {}
};

const BRACKET_CONFIG = {
    DFB_POKAL: {
        id: 'dfb_pokal',
        name: 'DFB-Pokal',
        rounds: ['1. Runde', '2. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'],
        color: 'var(--primary)'
    },
    LANDES_POKAL: {
        id: 'landes_pokal',
        name: 'Landespokal',
        rounds: ['1. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'],
        color: 'var(--accent)'
    },
    CHAMPIONS_CUP: {
        id: 'champions_cup',
        name: 'Champions Cup',
        rounds: ['Gruppenphase', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'],
        color: 'var(--gold)'
    }
};

function initializeTournamentBrackets() {
    if (!game.tournamentBrackets) game.tournamentBrackets = {};
    if (!game.tournamentBrackets.activeBrackets) game.tournamentBrackets.activeBrackets = {};
    if (!game.tournamentBrackets.bracketHistory) game.tournamentBrackets.bracketHistory = [];
    if (!game.tournamentBrackets.matchupPreviews) game.tournamentBrackets.matchupPreviews = {};
}

function getBracketProgress(tournamentId) {
    if (tournamentId === 'dfb_pokal') {
        const cupTournament = window.cupTournament || { currentRound: 0, eliminated: false };
        return {
            name: 'DFB-Pokal',
            currentRound: cupTournament.currentRound,
            eliminated: cupTournament.eliminated,
            roundName: cupTournament.roundNames ? cupTournament.roundNames[cupTournament.currentRound] : 'N/A',
            progress: ((cupTournament.currentRound || 0) / 5) * 100
        };
    } else if (tournamentId === 'champions_cup') {
        return {
            name: 'Champions Cup',
            currentRound: game.inEurope ? 1 : 0,
            eliminated: !game.inEurope,
            roundName: game.inEurope ? 'Gruppenphase' : 'Nicht qualifiziert',
            progress: game.inEurope ? 20 : 0
        };
    }

    return {
        name: 'Unbekannter Turnier',
        currentRound: 0,
        eliminated: true,
        roundName: 'N/A',
        progress: 0
    };
}

function generateBracketMatches(tournamentId) {
    const matches = [];

    if (tournamentId === 'dfb_pokal') {
        const cupTournament = window.cupTournament || { matches: [] };
        const recentMatches = (cupTournament.matches || []).slice(-4);

        recentMatches.forEach(match => {
            matches.push({
                home: match.home || 'Team A',
                away: match.away || 'Team B',
                homeGoals: match.homeGoals !== undefined ? match.homeGoals : '?',
                awayGoals: match.awayGoals !== undefined ? match.awayGoals : '?',
                status: match.played ? 'completed' : 'pending',
                isOurMatch: (match.home === game.clubName || match.away === game.clubName)
            });
        });
    } else if (tournamentId === 'champions_cup') {
        const groupMatches = (game.europeGroupMatches || []).slice(-4);
        groupMatches.forEach(match => {
            matches.push({
                home: match.homeTeam || 'Team A',
                away: match.awayTeam || 'Team B',
                homeGoals: match.homeGoals !== undefined ? match.homeGoals : '?',
                awayGoals: match.awayGoals !== undefined ? match.awayGoals : '?',
                status: match.played ? 'completed' : 'pending',
                isOurMatch: (match.homeTeam === game.clubName || match.awayTeam === game.clubName)
            });
        });
    }

    return matches;
}

function getNextTournamentOpponent(tournamentId) {
    if (tournamentId === 'dfb_pokal') {
        const cupTournament = window.cupTournament || {};
        const nextMatches = (cupTournament.matches || []).filter(m => !m.played);
        if (nextMatches.length > 0) {
            const nextMatch = nextMatches[0];
            if (nextMatch.home === game.clubName) {
                return { opponent: nextMatch.away, isHome: true };
            } else if (nextMatch.away === game.clubName) {
                return { opponent: nextMatch.home, isHome: false };
            }
        }
    }

    return { opponent: 'TBD', isHome: null };
}

function generateBracketVisualization(tournamentId) {
    const progress = getBracketProgress(tournamentId);
    const matches = generateBracketMatches(tournamentId);
    const nextOpp = getNextTournamentOpponent(tournamentId);
    const config = Object.values(BRACKET_CONFIG).find(b => b.id === tournamentId);

    if (!config) return '';

    let html = '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:8px;">';
    html += `<p style="font-size:10px; margin:0 0 4px 0; color:${config.color};"><strong>${config.name}</strong></p>`;

    html += '<div style="width:100%; height:10px; background:#333; border-radius:3px; overflow:hidden; margin-bottom:4px;">';
    html += `<div style="width:${progress.progress}%; height:100%; background:${config.color};"></div>`;
    html += '</div>';

    html += `<p style="font-size:8px; color:var(--text-muted); margin:0 0 4px 0;">`;
    if (progress.eliminated) {
        html += `<span style="color:var(--danger);">❌ Ausgeschieden</span>`;
    } else {
        html += `<span style="color:${config.color};">${progress.roundName}</span>`;
    }
    html += `</p>`;

    if (!progress.eliminated && nextOpp.opponent !== 'TBD') {
        const homeIcon = nextOpp.isHome ? '🏠' : '✈️';
        html += `<p style="font-size:9px; margin:0 0 4px 0;"><strong>Nächster Gegner:</strong> ${homeIcon} ${nextOpp.opponent}</p>`;
    }

    if (matches.length > 0) {
        html += '<div style="font-size:8px; margin-top:4px;">';
        matches.slice(0, 3).forEach(match => {
            const statusIcon = match.status === 'completed' ? '✓' : '○';
            const statusColor = match.status === 'completed' ? 'var(--primary)' : 'var(--text-muted)';
            const highlight = match.isOurMatch ? 'background:#2a3a2a; ' : '';
            html += `<div style="${highlight}font-size:8px; padding:3px; margin-bottom:2px;">`;
            html += `<span style="color:${statusColor};">${statusIcon}</span> ${match.home} ${match.homeGoals}:${match.awayGoals} ${match.away}`;
            html += `</div>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function tickTournamentBrackets() {
    initializeTournamentBrackets();

    const activeTournaments = ['dfb_pokal', 'champions_cup'];

    activeTournaments.forEach(tournamentId => {
        const progress = getBracketProgress(tournamentId);
        game.tournamentBrackets.activeBrackets[tournamentId] = progress;
    });
}

function getTournamentBracketsSummary() {
    if (!game.tournamentBrackets) return { tournaments: 0, active: 0, eliminated: 0 };

    const dfbPokal = getBracketProgress('dfb_pokal');
    const championsCup = getBracketProgress('champions_cup');

    return {
        tournaments: 2,
        active: (dfbPokal.eliminated ? 0 : 1) + (championsCup.eliminated ? 0 : 1),
        eliminated: (dfbPokal.eliminated ? 1 : 0) + (championsCup.eliminated ? 1 : 0)
    };
}

function renderTournamentBracketsPanel() {
    const container = document.getElementById('tournament-brackets-box');
    if (!container) return;

    initializeTournamentBrackets();

    let html = '<div class="panel-content">';
    html += '<h3>🏆 TURNIER-KLAMMERN</h3>';

    const summary = getTournamentBracketsSummary();
    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Aktive Turniere:</strong> `;
    html += `Gesamt: <span style="color:var(--text-muted);">${summary.tournaments}</span> | `;
    html += `Aktiv: <span style="color:var(--primary);">${summary.active}</span> | `;
    html += `Ausgeschieden: <span style="color:var(--danger);">${summary.eliminated}</span></p>`;
    html += '</div>';

    const dfbViz = generateBracketVisualization('dfb_pokal');
    if (dfbViz) html += dfbViz;

    const champViz = generateBracketVisualization('champions_cup');
    if (champViz) html += champViz;

    html += '</div>';
    container.innerHTML = html;
}
