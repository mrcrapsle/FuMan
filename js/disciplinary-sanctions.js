// Disciplinary & Sanctions System
// Yellow/red card tracking, match bans, financial penalties, appeals

let disciplinarySanctionsState = {
    playerCards: {},
    activeBans: [],
    disciplinaryHistory: [],
    finesCollected: 0,
    appealsInProgress: []
};

const CARD_THRESHOLDS = {
    BAN_YELLOW: 5,  // 5 yellow cards = 1 match ban
    BAN_RED: 1      // 1 red card = 2 match ban
};

const FINE_AMOUNTS = {
    YELLOW_CARD: 2500,
    RED_CARD: 10000,
    UNSPORTING_CONDUCT: 5000,
    VIOLENT_CONDUCT: 25000
};

const OFFENSE_TYPES = {
    YELLOW: { name: 'Verwarnung', card: 'YELLOW', fine: FINE_AMOUNTS.YELLOW_CARD },
    RED: { name: 'Platzverweis', card: 'RED', fine: FINE_AMOUNTS.RED_CARD },
    UNSPORTING: { name: 'Unsportliches Verhalten', card: 'YELLOW', fine: FINE_AMOUNTS.UNSPORTING_CONDUCT },
    VIOLENT: { name: 'Brutales Spiel', card: 'RED', fine: FINE_AMOUNTS.VIOLENT_CONDUCT }
};

function initializeDisciplinarySanctions() {
    if (!game.disciplinarySystem) game.disciplinarySystem = {};
    if (!game.disciplinarySystem.playerCards) {
        game.disciplinarySystem.playerCards = {};
        squad.forEach(player => {
            game.disciplinarySystem.playerCards[player.id] = {
                playerId: player.id,
                playerName: player.name,
                yellowCards: 0,
                redCards: 0,
                totalFines: 0,
                bans: [],
                history: []
            };
        });
    }
    if (!game.disciplinarySystem.activeBans) game.disciplinarySystem.activeBans = [];
    if (!game.disciplinarySystem.history) game.disciplinarySystem.history = [];
}

function recordCard(playerId, offenseType) {
    initializeDisciplinarySanctions();

    const playerRecord = game.disciplinarySystem.playerCards[playerId];
    if (!playerRecord) return false;

    const offense = OFFENSE_TYPES[offenseType];
    if (!offense) return false;

    const card = {
        matchday: game.matchday || 1,
        type: offenseType,
        offense: offense.name,
        cardType: offense.card,
        fine: offense.fine
    };

    playerRecord.history.push(card);

    if (offense.card === 'YELLOW') {
        playerRecord.yellowCards++;
        playerRecord.totalFines += offense.fine;
        game.money -= offense.fine;
        recordFinancialEvent('Geldstrafe - Verwarnung', -offense.fine, 'Disciplinary');
    } else if (offense.card === 'RED') {
        playerRecord.redCards++;
        playerRecord.totalFines += offense.fine;
        game.money -= offense.fine;
        recordFinancialEvent('Geldstrafe - Platzverweis', -offense.fine, 'Disciplinary');

        // Red card = immediate 2-match ban
        const ban = {
            playerId: playerId,
            playerName: playerRecord.playerName,
            startMatchday: game.matchday || 1,
            duration: 2,
            reason: `Platzverweis (${offenseType})`,
            canAppeal: true,
            appealed: false
        };
        game.disciplinarySystem.activeBans.push(ban);
    }

    // Check for automatic ban from accumulated yellow cards
    if (playerRecord.yellowCards % CARD_THRESHOLDS.BAN_YELLOW === 0 && playerRecord.yellowCards > 0) {
        const ban = {
            playerId: playerId,
            playerName: playerRecord.playerName,
            startMatchday: game.matchday || 1,
            duration: 1,
            reason: `Automatische Sperre (${playerRecord.yellowCards} Verwarnungen)`,
            canAppeal: true,
            appealed: false
        };
        game.disciplinarySystem.activeBans.push(ban);
    }

    game.disciplinarySystem.history.push(card);
    showToast(`⚽ ${playerRecord.playerName}: ${offense.name}`, 'warning', 5000);

    return true;
}

function isPlayerBanned(playerId) {
    const activeBan = game.disciplinarySystem.activeBans.find(b =>
        b.playerId === playerId && !b.served
    );
    return activeBan || false;
}

function getPlayerBanStatus(playerId) {
    const playerRecord = game.disciplinarySystem.playerCards[playerId];
    if (!playerRecord) return null;

    const activeBan = game.disciplinarySystem.activeBans.find(b =>
        b.playerId === playerId && !b.served
    );

    return {
        playerName: playerRecord.playerName,
        yellowCards: playerRecord.yellowCards,
        redCards: playerRecord.redCards,
        totalFines: playerRecord.totalFines,
        currentBan: activeBan ? {
            duration: activeBan.duration,
            reason: activeBan.reason,
            matchdaysRemaining: activeBan.duration - ((game.matchday || 1) - activeBan.startMatchday),
            canAppeal: activeBan.canAppeal && !activeBan.appealed
        } : null
    };
}

function appealBan(banId, defendReason) {
    const ban = game.disciplinarySystem.activeBans.find(b => b.id === banId);
    if (!ban) return false;

    ban.appealed = true;

    // Appeal success based on reason quality - simplified to 40% base success
    const successChance = 0.4;
    const success = Math.random() < successChance;

    const appeal = {
        matchday: game.matchday || 1,
        banId: banId,
        playerId: ban.playerId,
        playerName: ban.playerName,
        defendReason: defendReason,
        result: success ? 'ACCEPTED' : 'REJECTED',
        durationReduced: success ? Math.floor(ban.duration / 2) : 0
    };

    if (success) {
        ban.duration = appeal.durationReduced;
        showToast(`✅ Berufung erfolgreich: Sperre reduziert auf ${appeal.durationReduced} Spieltag(e)`, 'success', 5000);
    } else {
        showToast(`❌ Berufung abgelehnt`, 'error', 5000);
    }

    if (!game.disciplinarySystem.appeals) game.disciplinarySystem.appeals = [];
    game.disciplinarySystem.appeals.push(appeal);

    return success;
}

function tickDisciplinaryBans() {
    if (!game.disciplinarySystem.activeBans) return;

    game.disciplinarySystem.activeBans = game.disciplinarySystem.activeBans.filter(ban => {
        const matchdaysElapsed = (game.matchday || 1) - ban.startMatchday;

        if (matchdaysElapsed >= ban.duration) {
            ban.served = true;
            recordFinancialEvent('Sperrfrist abgelaufen', 0, 'Disciplinary');
            return false;
        }
        return true;
    });
}

function getPlayerDisciplinaryRecord(playerId) {
    const record = game.disciplinarySystem.playerCards[playerId];
    if (!record) return null;

    return {
        playerName: record.playerName,
        yellowCards: record.yellowCards,
        redCards: record.redCards,
        totalFines: record.totalFines,
        recentOffenses: record.history.slice(-5),
        disciplinaryScore: (record.yellowCards * 1) + (record.redCards * 3)
    };
}

function renderDisciplinarySanctionsPanel() {
    const container = document.getElementById('disciplinary-sanctions-box');
    if (!container) return;

    initializeDisciplinarySanctions();

    let html = '<div class="panel-content">';
    html += '<h3>Disziplinar & Strafen</h3>';

    // Active Bans
    const activeBans = (game.disciplinarySystem.activeBans || []).filter(b => !b.served);
    if (activeBans.length > 0) {
        html += '<div class="active-bans" style="margin-bottom:10px;">';
        html += `<h4>🚫 Aktive Sperren (${activeBans.length})</h4>`;

        activeBans.forEach(ban => {
            const matchdaysElapsed = (game.matchday || 1) - ban.startMatchday;
            const remaining = Math.max(0, ban.duration - matchdaysElapsed);

            html += `<div style="background:#222; padding:8px; margin-bottom:6px; border-left:3px solid var(--danger); border-radius:4px;">`;
            html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">`;
            html += `<strong style="font-size:10px;">${ban.playerName}</strong>`;
            html += `<span style="font-size:9px; color:var(--danger);">noch ${remaining} Spieltag(e)</span>`;
            html += `</div>`;
            html += `<p style="font-size:9px; color:var(--text-muted); margin:0;">${ban.reason}</p>`;

            if (ban.canAppeal && !ban.appealed) {
                html += `<button onclick="appealBan('${ban.id}', 'Unfaire Entscheidung')" class="btn-secondary" style="font-size:8px; padding:4px 8px; margin-top:4px;">Berufung einlegen</button>`;
            }
            html += `</div>`;
        });

        html += '</div>';
    } else {
        html += '<p style="font-size:9px; color:var(--primary);">✓ Keine aktiven Sperren</p>';
    }

    // Disciplinary Record
    html += '<div class="disciplinary-records" style="margin-top:10px;">';
    html += '<h4>📋 Verwarnungsstatistik</h4>';
    html += '<table class="disciplinary-table" style="width:100%; font-size:9px;">';
    html += '<tr><th>Spieler</th><th>Gelb</th><th>Rot</th><th>Strafen</th><th>Punkte</th></tr>';

    Object.values(game.disciplinarySystem.playerCards || {})
        .filter(r => r.yellowCards > 0 || r.redCards > 0)
        .sort((a, b) => (b.yellowCards + b.redCards * 3) - (a.yellowCards + a.redCards * 3))
        .slice(0, 8)
        .forEach(record => {
            const disciplinaryScore = (record.yellowCards * 1) + (record.redCards * 3);
            html += `<tr>
                        <td>${record.playerName}</td>
                        <td style="text-align:center;">${record.yellowCards}</td>
                        <td style="text-align:center; color:var(--danger);">${record.redCards}</td>
                        <td>€${(record.totalFines / 1000).toFixed(0)}k</td>
                        <td><strong>${disciplinaryScore}</strong></td>
                    </tr>`;
        });

    html += '</table>';
    html += '</div>';

    // Financial Summary
    const totalFines = Object.values(game.disciplinarySystem.playerCards || {})
        .reduce((sum, r) => sum + r.totalFines, 0);

    html += '<div class="disciplinary-summary" style="margin-top:10px; background:#1a1a1a; padding:8px; border-radius:4px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Gesamte Strafgelder (Saison):</strong> €${(totalFines / 1000).toFixed(0)}k</p>`;
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}
