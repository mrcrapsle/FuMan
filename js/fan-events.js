/* eslint-disable no-undef */

// Fan-Events & Fanclubs
// Fanveranstaltungen, Stimmung, Engagement-Events

let fanEventsState = {
    upcomingEvents: [],
    eventHistory: [],
    fanEngagement: 0,
    fanMorale: 100,
    eventCosts: 0
};

const FAN_EVENTS = {
    openTraining: {
        name: 'Offenes Training',
        engagementBoost: 0.15,
        moraleCost: 500,
        cost: 2000,
        icon: '🏋️'
    },
    fanSigningEvent: {
        name: 'Autogrammstunde',
        engagementBoost: 0.20,
        moraleCost: 1000,
        cost: 3000,
        icon: '✍️'
    },
    communityEvent: {
        name: 'Fanclub-Treffen',
        engagementBoost: 0.25,
        moraleCost: 1500,
        cost: 4000,
        icon: '👥'
    },
    stadiumTour: {
        name: 'Stadion-Tour',
        engagementBoost: 0.18,
        moraleCost: 800,
        cost: 2500,
        icon: '🏟️'
    },
    charityMatch: {
        name: 'Wohltätigkeitsspiel',
        engagementBoost: 0.30,
        moraleCost: 2000,
        cost: 5000,
        icon: '❤️'
    }
};

function initializeFanEvents() {
    if (!game.fanEvents) {
        game.fanEvents = {
            upcomingEvents: [],
            eventHistory: [],
            fanEngagement: 0,
            fanMorale: 100
        };
    }
}

function createFanEvent(eventType) {
    initializeFanEvents();

    if (game.money < 2000) {
        showToast('💰 Nicht genug Geld für Fan-Events!', 'error', 2000);
        return false;
    }

    const eventConfig = FAN_EVENTS[eventType];
    if (!eventConfig) return false;

    if (game.money < eventConfig.cost) {
        showToast('💰 Unzureichende Mittel!', 'error', 2000);
        return false;
    }

    game.money -= eventConfig.cost;

    const event = {
        id: game.fanEvents.eventHistory.length,
        type: eventType,
        name: eventConfig.name,
        icon: eventConfig.icon,
        engagementBoost: eventConfig.engagementBoost,
        startMatchday: game.matchday,
        daysRemaining: 3,
        status: 'active',
        cost: eventConfig.cost
    };

    game.fanEvents.upcomingEvents.push(event);
    showToast(`${eventConfig.icon} ${eventConfig.name} geplant! (+3 Tage)`, 'success', 3000);
    return true;
}

function completeFanEvent(eventId) {
    initializeFanEvents();

    const eventIndex = game.fanEvents.upcomingEvents.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return false;

    const event = game.fanEvents.upcomingEvents[eventIndex];
    const eventConfig = FAN_EVENTS[event.type];

    // Engagement erhöhen
    game.fanEngagement = (game.fanEngagement || 0) + eventConfig.engagementBoost;
    game.fanEngagement = Math.min(1.0, game.fanEngagement);

    // Fan Morale erhöhen
    if (squad && squad.length > 0) {
        squad.forEach(player => {
            if (player.morale) {
                player.morale = Math.min(100, player.morale + 5);
            }
        });
    }

    // Event abgeschlossen
    event.status = 'completed';
    event.completedMatchday = game.matchday;

    game.fanEvents.eventHistory.push({
        ...event,
        completedMatchday: game.matchday,
        timestamp: new Date().getTime()
    });

    game.fanEvents.upcomingEvents.splice(eventIndex, 1);

    showToast(`✅ ${event.name} erfolgreich durchgeführt!`, 'success', 4000);
    return true;
}

function tickFanEvents() {
    initializeFanEvents();

    // Events countdown
    game.fanEvents.upcomingEvents.forEach((event, idx) => {
        event.daysRemaining--;
        if (event.daysRemaining <= 0) {
            completeFanEvent(event.id);
        }
    });

    // Zufällige Fan-Events während der Saison
    if (Math.random() < 0.05 && game.fanEvents.upcomingEvents.length < 2) {
        const eventTypes = Object.keys(FAN_EVENTS);
        const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

        if (game.money >= FAN_EVENTS[randomType].cost) {
            // Gelegentlich automatisch ein Event erstellen
            // (optional - nur wenn Geld vorhanden)
        }
    }

    // Engagement natürlich minimal sinken lassen (außer bei Erfolgen)
    if (game.fanEngagement > 0) {
        game.fanEngagement = Math.max(0, game.fanEngagement - 0.02);
    }
}

function getFanEventBonus() {
    initializeFanEvents();
    return game.fanEngagement || 0;
}

function renderFanEventsPanel() {
    const container = document.getElementById('fan-events-box');
    if (!container) return;

    initializeFanEvents();

    let html = '<div class="panel-content">';
    html += '<h3>🎉 FAN-EVENTS & ENGAGEMENT</h3>';

    // Engagement anzeigen
    const engagement = game.fanEngagement || 0;
    const engagementPercent = Math.round(engagement * 100);
    html += `<div style="background:#1a1a1a; padding:6px; border-radius:3px; margin-bottom:10px;">`;
    html += `<p style="font-size:9px; margin:0;"><strong>Fan-Engagement:</strong> ${engagementPercent}%</p>`;
    html += '<div style="background:#000; border-radius:2px; height:6px; margin:3px 0;">';
    html += `<div style="background:var(--primary); height:100%; width:${engagementPercent}%;"></div>`;
    html += '</div>';
    html += `</div>`;

    // Aktive Events
    if (game.fanEvents.upcomingEvents.length > 0) {
        html += '<h4>⏳ Laufende Events</h4>';
        game.fanEvents.upcomingEvents.slice(0, 3).forEach(event => {
            html += `<div style="background:#1a1a1a; padding:6px; border-radius:3px; margin-bottom:4px;">`;
            html += `<p style="font-size:9px; margin:0;"><strong>${event.icon} ${event.name}</strong></p>`;
            html += `<p style="font-size:8px; margin:2px 0 0 0; color:var(--text-muted);">Tag ${3 - event.daysRemaining}/3</p>`;
            html += `</div>`;
        });
    }

    // Event-Optionen
    html += '<h4>+ Neue Events</h4>';
    const eventTypes = Object.keys(FAN_EVENTS);
    eventTypes.slice(0, 3).forEach(type => {
        const config = FAN_EVENTS[type];
        html += `<button onclick="createFanEvent('${type}')" class="btn-secondary" style="width:auto; font-size:7px; padding:2px 6px; margin:2px; display:inline-block;">`;
        html += `${config.icon} ${config.name} (€${config.cost.toLocaleString()})`;
        html += `</button>`;
    });

    html += '</div>';
    container.innerHTML = html;
}
