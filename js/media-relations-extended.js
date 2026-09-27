// ==========================================
// MEDIENBEZIEHUNGEN ERWEITERTE FUNKTIONEN
// ==========================================
/* eslint-disable no-undef */

function getMediaReputation() {
    if (!game.mediaReputation) game.mediaReputation = 50;
    return Math.max(0, Math.min(100, game.mediaReputation));
}

function updateMediaReputation(delta) {
    if (!game.mediaReputation) game.mediaReputation = 50;
    game.mediaReputation = Math.max(0, Math.min(100, game.mediaReputation + delta));
}

function generateMediaHeadline() {
    const reputationLevel = getMediaReputation();
    const recentResults = game.recentResults || [];
    const wins = recentResults.filter(r => r === 'W').length;
    const losses = recentResults.filter(r => r === 'L').length;
    const draws = recentResults.filter(r => r === 'D').length;

    const headlines = {
        positive: [
            `${game.clubName} erobert Tabellenspitze!`,
            `Trainer ${game.managerName}: "Wir sind bereit für Großes!"`,
            `${game.clubName} begeistert Fans mit spektakulärem Sieg`,
            `Wunderkind-Entdeckung: Neuer Superstar bei ${game.clubName}?`,
            `${game.clubName}: Von der Krise zur Meisterschaft`
        ],
        neutral: [
            `${game.clubName} hält Kurs`,
            `Solider Sieg für ${game.clubName}`,
            `${game.clubName}-Trainer analysiert Saisonverlauf`,
            `Trainerwechsel bei ${game.clubName} geplant?`,
            `Stabiler Auftritt von ${game.clubName}`
        ],
        negative: [
            `Krise bei ${game.clubName} - Trainer unter Druck`,
            `${game.clubName} verliert wichtiges Derby-Spiel`,
            `Spieleraufstand bei ${game.clubName}?`,
            `${game.clubName} rutscht in Abstiegszone`,
            `Kritik wächst: ${game.clubName} enttäuscht`
        ]
    };

    let category = 'neutral';
    if (reputationLevel >= 75 || wins >= 3) category = 'positive';
    if (reputationLevel <= 25 || losses >= 3) category = 'negative';

    const categoryHeadlines = headlines[category];
    return categoryHeadlines[Math.floor(Math.random() * categoryHeadlines.length)];
}

function scheduleMediaConference() {
    if (!game.mediaConferences) game.mediaConferences = [];

    const cost = 5000;
    if (game.money < cost) {
        return { success: false, message: 'Nicht genug Geld' };
    }

    game.money -= cost;

    const conference = {
        id: 'mc_' + Math.random().toString(36).substr(2, 9),
        scheduledMatchday: game.matchday + 1,
        topic: ['Saisonzielestragie', 'Spielentwicklung', 'Vereinspläne'][Math.floor(Math.random() * 3)],
        completed: false,
        reputationDelta: 0
    };

    game.mediaConferences.push(conference);
    return { success: true, message: `✓ Pressekonferenz geplant! (${formatVal(cost)})` };
}

function conductMediaConference(conferenceId, approach) {
    const conf = (game.mediaConferences || []).find(c => c.id === conferenceId);
    if (!conf) return { success: false, message: 'Konferenz nicht gefunden' };

    const approaches = {
        aggressive: { reputation: 20, risk: 30, bonus: 0 },
        professional: { reputation: 10, risk: 5, bonus: 5 },
        reserved: { reputation: 5, risk: 0, bonus: -10 }
    };

    const app = approaches[approach] || approaches.professional;
    const actual = Math.round(app.reputation + (Math.random() * app.risk - app.risk / 2));

    updateMediaReputation(actual);
    conf.completed = true;
    conf.approach = approach;
    conf.reputationDelta = actual;

    if (!game.mediaConferenceHistory) game.mediaConferenceHistory = [];
    game.mediaConferenceHistory.push({
        matchday: game.matchday,
        approach: approach,
        delta: actual
    });

    updateUI();
    return {
        success: true,
        message: actual > 0
            ? `✓ Erfolgreiche Pressekonferenz! +${actual} Reputation`
            : `⚠️ Pressekonferenz durchgeführt (${actual} Reputation)`
    };
}

function generateMediaInterview() {
    const squad = window.squad || [];
    if (squad.length === 0) return null;

    const player = squad[Math.floor(Math.random() * squad.length)];

    return {
        playerId: player.id,
        playerName: player.name,
        topics: [
            `"${player.name} über seine Entwicklung: 'Ich möchte ein Vorbild für andere sein'"`,
            `Exklusiv: ${player.name} spricht über seinen Traum von der Nationalelf`,
            `${player.name} über die Rivalen: "Wir haben Angst vor niemandem"`,
            `Interview: ${player.name} verrät Geheimnis seines Erfolgs`
        ][Math.floor(Math.random() * 4)]
    };
}

function publishPlayerInterview(playerId) {
    const player = squad?.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Spieler nicht gefunden' };

    const cost = 8000;
    if (game.money < cost) {
        return { success: false, message: 'Nicht genug Geld' };
    }

    game.money -= cost;

    const moraleDelta = Math.random() * 20 + 5;
    player.morale = Math.min(100, player.morale + moraleDelta);

    updateMediaReputation(8);

    if (!game.playerInterviews) game.playerInterviews = [];
    game.playerInterviews.push({
        playerId: playerId,
        playerName: player.name,
        matchday: game.matchday,
        moraleBump: moraleDelta
    });

    updateUI();
    return {
        success: true,
        message: `✓ Interview mit ${player.name} veröffentlicht! +${moraleDelta.toFixed(0)} Moral`
    };
}

function getMediaCoverageBonus() {
    const reputation = getMediaReputation();
    if (reputation >= 80) return 1.15;
    if (reputation >= 60) return 1.08;
    if (reputation >= 40) return 1.0;
    if (reputation >= 20) return 0.95;
    return 0.85;
}

function manageMediaRelationship(journalistName, action) {
    if (!game.mediaRelationships) game.mediaRelationships = {};

    const rel = game.mediaRelationships[journalistName] || { favor: 50, lastAction: 0 };

    const actions = {
        'provide_exclusive': { favor: 15, reputation: 10, cost: 0 },
        'invite_vip': { favor: 20, reputation: 5, cost: 12000 },
        'ignore': { favor: -10, reputation: 0, cost: 0 },
        'criticize': { favor: -25, reputation: -15, cost: 0 }
    };

    const act = actions[action];
    if (!act) return { success: false, message: 'Aktion unbekannt' };

    if (game.money < act.cost) {
        return { success: false, message: 'Nicht genug Geld' };
    }

    game.money -= act.cost;
    rel.favor = Math.max(0, Math.min(100, rel.favor + act.favor));
    rel.lastAction = game.matchday;
    updateMediaReputation(act.reputation);

    game.mediaRelationships[journalistName] = rel;

    if (!game.journalistInteractions) game.journalistInteractions = [];
    game.journalistInteractions.push({
        journalist: journalistName,
        action: action,
        favor: rel.favor,
        matchday: game.matchday
    });

    updateUI();
    return {
        success: true,
        message: `✓ Beziehung zu ${journalistName}: ${rel.favor}/100`
    };
}

function renderMediaRelationsPanel() {
    const box = document.getElementById('media-relations-panel');
    if (!box) return;

    const reputation = getMediaReputation();
    const coverage = getMediaCoverageBonus();
    const headline = generateMediaHeadline();

    let html = '<div style="margin-bottom:12px;">';

    html += `<div style="background:rgba(255,194,60,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--accent);">
        <div style="font-size:9px; font-weight:bold; margin-bottom:4px; color:var(--accent);">📰 MEDIENREPUTATION: ${reputation}/100</div>
        <div style="width:100%; background:rgba(0,0,0,0.3); height:6px; border-radius:3px; overflow:hidden; margin-bottom:4px;">
            <div style="width:${reputation}%; height:100%; background:var(--accent); transition:width 0.3s;"></div>
        </div>
        <div style="font-size:8px; color:var(--text-muted);">Coverage-Multiplikator: ×${coverage.toFixed(2)}</div>
    </div>`;

    html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:8px; font-size:9px;">
        <div style="font-weight:bold; margin-bottom:4px;">📰 ${headline}</div>
    </div>`;

    html += '<button onclick="scheduleMediaConference()" class="btn-primary" style="width:100%; font-size:9px; padding:6px; margin-bottom:8px;">🎤 Pressekonferenz ansetzen (5.000 €)</button>';

    const interviews = (game.mediaConferences || []).filter(c => !c.completed && c.scheduledMatchday === game.matchday);
    if (interviews.length > 0) {
        html += '<div style="margin-bottom:8px; font-size:9px; font-weight:bold;">📋 Heute durchführen:</div>';
        interviews.forEach(conf => {
            html += `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:2px; margin-bottom:2px;">
                <button onclick="conductMediaConference('${conf.id}', 'aggressive')" class="btn-danger" style="font-size:8px; padding:3px;">Aggressiv</button>
                <button onclick="conductMediaConference('${conf.id}', 'professional')" class="btn-primary" style="font-size:8px; padding:3px;">Professional</button>
                <button onclick="conductMediaConference('${conf.id}', 'reserved')" class="btn-secondary" style="font-size:8px; padding:3px;">Vorsichtig</button>
            </div>`;
        });
    }

    html += '<div style="margin-top:8px; font-size:9px; font-weight:bold;">🎬 Spieler-Interviews:</div>';
    const interview = generateMediaInterview();
    if (interview) {
        html += `<div style="background:rgba(100,100,100,0.1); padding:4px; border-radius:4px; margin-bottom:4px; font-size:8px;">
            <div style="margin-bottom:2px;">${interview.topics}</div>
            <button onclick="publishPlayerInterview('${interview.playerId}')" class="btn-action" style="width:100%; font-size:8px; padding:2px;">Veröffentlichen (8.000 €)</button>
        </div>`;
    }

    html += '</div>';
    box.innerHTML = html;
}

function renderMediaJournalistPanel() {
    const box = document.getElementById('media-journalists-panel');
    if (!box) return;

    const journalists = ['Sky Sports', 'Kickest', 'Sport1', 'Eurosport'];
    const relationships = game.mediaRelationships || {};

    let html = '<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">👥 JOURNALIST-NETZWERK</div>';

    journalists.forEach(jname => {
        const rel = relationships[jname] || { favor: 50 };
        const relColor = rel.favor >= 75 ? 'var(--primary)' : rel.favor >= 50 ? 'var(--accent)' : 'var(--danger)';

        html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:6px;">
            <div style="font-size:9px; font-weight:bold; margin-bottom:4px;">${jname}</div>
            <div style="width:100%; background:rgba(0,0,0,0.3); height:4px; border-radius:2px; overflow:hidden; margin-bottom:4px;">
                <div style="width:${rel.favor}%; height:100%; background:${relColor}; transition:width 0.3s;"></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2px; font-size:8px;">
                <button onclick="manageMediaRelationship('${jname}', 'provide_exclusive')" class="btn-secondary" style="padding:2px;">Exclusive</button>
                <button onclick="manageMediaRelationship('${jname}', 'invite_vip')" class="btn-primary" style="padding:2px;">VIP laden</button>
            </div>
        </div>`;
    });

    box.innerHTML = html;
}
