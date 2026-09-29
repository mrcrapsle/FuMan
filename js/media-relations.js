// Medienbeziehungen & Pressekonferenz-System
// Manager-Medienimage, Statements, öffentliche Meinung

let mediaRelationsState = {
    mediaImage: 50,
    pressStatements: [],
    publicOpinion: 50,
    conferenceHistory: [],
    imageModifiers: []
};

const STATEMENT_TYPES = {
    CONFIDENT: {
        label: 'Selbstbewusst',
        imageImpact: 8,
        moralImpact: 5,
        fanImpact: 4,
        risk: 'Übermut bei Niederlage'
    },
    HUMBLE: {
        label: 'Bescheiden',
        imageImpact: 4,
        moralImpact: 2,
        fanImpact: 2,
        risk: 'Wirkt schwach'
    },
    MOTIVATED: {
        label: 'Motivierend',
        imageImpact: 6,
        moralImpact: 8,
        fanImpact: 6,
        risk: 'Kann über-promisieren'
    },
    DEFENSIVE: {
        label: 'Defensiv',
        imageImpact: -3,
        moralImpact: -2,
        fanImpact: -4,
        risk: 'Wirkt ängstlich'
    },
    EMOTIONAL: {
        label: 'Emotional',
        imageImpact: 5,
        moralImpact: 6,
        fanImpact: 5,
        risk: 'Kann missverstanden werden'
    }
};

const IMAGE_IMPACTS = {
    VICTORY: 3,
    DRAW: 1,
    DEFEAT: -4,
    UNDEFEATED_RUN: 5,
    PROMOTION: 8,
    DEMOTION: -8,
    TROPHY_WIN: 10,
    SCANDAL: -6
};

function initializeMediaRelations() {
    if (!game.mediaRelations) game.mediaRelations = {};
    if (typeof game.mediaRelations.mediaImage !== 'number') {
        game.mediaRelations.mediaImage = 50;
    }
    if (!game.mediaRelations.pressStatements) game.mediaRelations.pressStatements = [];
    if (typeof game.mediaRelations.publicOpinion !== 'number') {
        game.mediaRelations.publicOpinion = 50;
    }
    if (!game.mediaRelations.conferenceHistory) game.mediaRelations.conferenceHistory = [];
    if (!game.mediaRelations.imageModifiers) game.mediaRelations.imageModifiers = [];
}

function getMediaImageLevel() {
    const image = game.mediaRelations.mediaImage || 50;
    if (image >= 80) return { label: 'Legendär', color: 'var(--primary)', modifier: 1.2 };
    if (image >= 65) return { label: 'Sehr gut', color: 'var(--primary)', modifier: 1.1 };
    if (image >= 50) return { label: 'Neutral', color: 'var(--text-muted)', modifier: 1.0 };
    if (image >= 35) return { label: 'Kritisch', color: 'var(--accent)', modifier: 0.95 };
    return { label: 'Verhasst', color: 'var(--danger)', modifier: 0.85 };
}

function giveStatement(statementType) {
    if (!STATEMENT_TYPES[statementType]) return false;

    const statement = STATEMENT_TYPES[statementType];
    const today = game.matchday || 1;

    game.mediaRelations.mediaImage = Math.max(0, Math.min(100, 
        game.mediaRelations.mediaImage + statement.imageImpact
    ));

    game.mediaRelations.publicOpinion = Math.max(0, Math.min(100,
        game.mediaRelations.publicOpinion + statement.fanImpact
    ));

    if (statement.moralImpact !== 0) {
        Object.values(game.squadHarmony?.playerMorale || {}).forEach(player => {
            player.morale = Math.max(0, Math.min(100, 
                player.morale + statement.moralImpact
            ));
        });
    }

    game.mediaRelations.pressStatements.push({
        type: statementType,
        label: statement.label,
        matchday: today,
        season: game.season,
        imageChange: statement.imageImpact,
        timestamp: new Date().getTime()
    });

    if (game.mediaRelations.pressStatements.length > 10) {
        game.mediaRelations.pressStatements.shift();
    }

    const riskOccurs = Math.random() < 0.15;
    let message = `📰 Pressestatement gegeben: "${statement.label}"`;
    if (riskOccurs) {
        message += ` (Risiko: ${statement.risk})`;
    }

    showToast(message, 'info', 5000);
    return true;
}

function holdPressConference() {
    const matchday = game.matchday || 1;
    const image = game.mediaRelations.mediaImage || 50;

    let topics = [];
    if (game.leaguePosition && game.leaguePosition <= 3) {
        topics.push('🏆 Titelaussichten');
    }
    if (game.leaguePosition && game.leaguePosition >= Object.keys(leaguesData[game.leagueLevel] || {}).length - 2) {
        topics.push('⚠️ Abstiegskampf');
    }
    if (Object.values(game.squadHarmony?.playerMorale || {}).some(p => p.morale < 30)) {
        topics.push('💔 Spieler-Konflikte');
    }
    if (game.money < 50000) {
        topics.push('💰 Finanzielle Probleme');
    }

    const conference = {
        matchday: matchday,
        season: game.season,
        topics: topics.length > 0 ? topics : ['⚽ Allgemeine Einschätzung'],
        mediaImageBefore: image,
        timestamp: new Date().getTime()
    };

    game.mediaRelations.conferenceHistory.push(conference);

    let publicReaction = (Math.random() - 0.5) * 20;
    game.mediaRelations.publicOpinion = Math.max(0, Math.min(100,
        game.mediaRelations.publicOpinion + publicReaction
    ));

    showToast(`📺 Pressekonferenz abgehalten! Öffentliche Meinung: ${Math.round(publicReaction) > 0 ? '+' : ''}${Math.round(publicReaction)}`, 'info', 5000);
    return true;
}

function recordMatchdayMediaEvent(result) {
    if (!game.mediaRelations) return;

    let impact = 0;
    if (result === 'W') {
        impact = IMAGE_IMPACTS.VICTORY;
    } else if (result === 'D') {
        impact = IMAGE_IMPACTS.DRAW;
    } else if (result === 'L') {
        impact = IMAGE_IMPACTS.DEFEAT;
    }

    if (impact !== 0) {
        game.mediaRelations.mediaImage = Math.max(0, Math.min(100,
            game.mediaRelations.mediaImage + impact
        ));
        
        game.mediaRelations.publicOpinion = Math.max(0, Math.min(100,
            game.mediaRelations.publicOpinion + (impact * 0.7)
        ));
    }
}

function tickMediaRelations() {
    initializeMediaRelations();

    const recentResults = (game.recentResults || []).slice(-5);
    const undefeated = recentResults.length > 0 && recentResults.every(r => r.result !== 'L');

    if (undefeated && recentResults.length >= 5) {
        game.mediaRelations.mediaImage = Math.min(100,
            game.mediaRelations.mediaImage + IMAGE_IMPACTS.UNDEFEATED_RUN
        );
    }

    const imageLevel = getMediaImageLevel();
    if (game.mediaRelations.publicOpinion > 70) {
        game.mediaRelations.mediaImage = Math.min(100,
            game.mediaRelations.mediaImage + 1
        );
    } else if (game.mediaRelations.publicOpinion < 30) {
        game.mediaRelations.mediaImage = Math.max(0,
            game.mediaRelations.mediaImage - 1
        );
    }

    if (game.boardSat && game.boardSat > 80) {
        game.mediaRelations.mediaImage = Math.min(100,
            game.mediaRelations.mediaImage + 0.5
        );
    }

    const oldStatements = game.mediaRelations.pressStatements.filter(s => {
        const age = (game.matchday || 1) - s.matchday;
        return age > 8;
    });
    if (oldStatements.length > 0) {
        game.mediaRelations.pressStatements = game.mediaRelations.pressStatements.filter(s => {
            const age = (game.matchday || 1) - s.matchday;
            return age <= 8;
        });
    }
}

function getMediaRelationsSummary() {
    if (!game.mediaRelations) return { image: 50, publicOpinion: 50, statements: 0 };

    const imageLevel = getMediaImageLevel();
    return {
        image: Math.round(game.mediaRelations.mediaImage || 50),
        publicOpinion: Math.round(game.mediaRelations.publicOpinion || 50),
        imageLevel: imageLevel,
        statements: game.mediaRelations.pressStatements?.length || 0,
        conferences: game.mediaRelations.conferenceHistory?.filter(c => c.season === game.season)?.length || 0
    };
}

function renderMediaRelationsBoxPanel() {
    const container = document.getElementById('media-relations-box');
    if (!container) return;

    initializeMediaRelations();

    let html = '<div class="panel-content">';
    html += '<h3>📺 MEDIENBEZIEHUNGEN</h3>';

    const summary = getMediaRelationsSummary();

    html += '<div style="margin-bottom:10px;">';
    html += '<p style="font-size:10px; margin:0 0 4px 0;"><strong>Trainer-Image:</strong> <span style="color:' + summary.imageLevel.color + ';">' + summary.imageLevel.label + '</span></p>';
    html += '<div style="width:100%; height:12px; background:#333; border-radius:4px; overflow:hidden; margin-bottom:4px;">';
    html += '<div style="width:' + summary.image + '%; height:100%; background:' + summary.imageLevel.color + '; transition:width 0.3s;"></div>';
    html += '</div>';
    html += '<p style="font-size:8px; color:var(--text-muted); margin:0;">Score: ' + summary.image + '/100</p>';
    html += '</div>';

    html += '<div style="margin-bottom:10px;">';
    html += '<p style="font-size:10px; margin:0 0 4px 0;"><strong>Öffentliche Meinung:</strong></p>';
    const opinionColor = summary.publicOpinion >= 60 ? 'var(--primary)' : summary.publicOpinion >= 40 ? 'var(--text-muted)' : 'var(--danger)';
    html += '<div style="width:100%; height:12px; background:#333; border-radius:4px; overflow:hidden;">';
    html += '<div style="width:' + summary.publicOpinion + '%; height:100%; background:' + opinionColor + '; transition:width 0.3s;"></div>';
    html += '</div>';
    html += '</div>';

    html += '<div style="margin-bottom:10px;">';
    html += '<h4>🎤 Pressestatements</h4>';
    html += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">';

    Object.entries(STATEMENT_TYPES).forEach(([key, statement]) => {
        const bgColor = statement.imageImpact > 5 ? '#1a3a1a' : statement.imageImpact > 0 ? '#1a2a3a' : '#3a1a1a';
        const icon = statement.imageImpact > 5 ? '✅' : statement.imageImpact > 0 ? '➡️' : '❌';
        html += '<button onclick="giveStatement(\'' + key + '\')" class="btn-secondary" style="font-size:9px; padding:6px; background:' + bgColor + ';">' + icon + ' ' + statement.label + '</button>';
    });

    html += '</div>';
    html += '</div>';

    html += '<div style="margin-bottom:10px;">';
    html += '<h4>📺 Pressekonferenz</h4>';
    html += '<button onclick="holdPressConference()" class="btn-action" style="width:100%; font-size:10px;">🎙️ Pressekonferenz halten</button>';
    html += '<p style="font-size:8px; color:var(--text-muted); margin:4px 0 0 0;">Diese Saison: ' + summary.conferences + ' Konferenzen</p>';
    html += '</div>';

    if (game.mediaRelations.pressStatements && game.mediaRelations.pressStatements.length > 0) {
        html += '<div style="margin-top:10px;">';
        html += '<h4>📰 Letzte Statements</h4>';

        game.mediaRelations.pressStatements.slice(-3).forEach(stmt => {
            const imgSign = stmt.imageChange > 0 ? '+' : '';
            const imgColor = stmt.imageChange > 0 ? 'var(--primary)' : 'var(--danger)';
            html += '<div style="font-size:8px; margin-bottom:3px; padding:4px; background:#222; border-radius:3px;">';
            html += '<span style="color:var(--text-muted);">ST ' + stmt.matchday + ':</span> ';
            html += '<strong>' + stmt.label + '</strong> ';
            html += '<span style="color:' + imgColor + ';">(' + imgSign + stmt.imageChange + ')</span>';
            html += '</div>';
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
