// ==========================================
// STADION-MANAGEMENT ERWEITERTE FUNKTIONEN
// ==========================================
/* eslint-disable no-undef */

function getStadiumRevenuePotential() {
    const baseCapacity = Object.values(stadium.blocks || {})
        .reduce((sum, b) => sum + (b.cap || 0), 0);

    const ticketRevenue = baseCapacity * 30;
    const foodRevenue = Math.round(baseCapacity * 0.4 * 15);
    const merchRevenue = Math.round(baseCapacity * 0.25 * 20);
    const vipRevenue = Math.round((stadium.blocks?.vipLogen?.cap || 0) * 100);
    const namingRights = stadium.namingRights ? 50000 : 0;

    const total = ticketRevenue + foodRevenue + merchRevenue + vipRevenue + namingRights;

    return {
        baseCapacity,
        ticketRevenue,
        foodRevenue,
        merchRevenue,
        vipRevenue,
        namingRights,
        total
    };
}

function optimizeStadiumBlock(blockName, strategy) {
    const block = stadium.blocks?.[blockName];
    if (!block) return { success: false, message: 'Block nicht gefunden' };

    const strategyCosts = {
        'revenue': { investment: 150000, foodBonus: 2, merchBonus: 2 },
        'comfort': { investment: 100000, toiletBonus: 1, foodBonus: 1 },
        'vip': { investment: 200000, vipBonus: 1, merchBonus: 1 },
        'capacity': { investment: 250000, capIncrease: 1500 }
    };

    const strat = strategyCosts[strategy];
    if (!strat) return { success: false, message: 'Strategie unbekannt' };

    if (game.money < strat.investment) {
        return { success: false, message: 'Nicht genug Geld' };
    }

    game.money -= strat.investment;

    if (strat.foodBonus) block.foodLvl = Math.min(5, (block.foodLvl || 0) + strat.foodBonus);
    if (strat.merchBonus) block.merchLvl = Math.min(5, (block.merchLvl || 0) + strat.merchBonus);
    if (strat.toiletBonus) block.toiletLvl = Math.min(5, (block.toiletLvl || 0) + strat.toiletBonus);
    if (strat.capIncrease) block.cap = (block.cap || 10000) + strat.capIncrease;

    if (!game.stadiumOptimizationHistory) game.stadiumOptimizationHistory = [];
    game.stadiumOptimizationHistory.push({
        blockName: blockName,
        strategy: strategy,
        matchday: game.matchday,
        investment: strat.investment
    });

    updateUI();
    return {
        success: true,
        message: `✓ Block "${blockName}" optimiert (${strategy})`
    };
}

function sellNamingRightsToCompany(companyName) {
    if (stadium.namingRights) {
        return { success: false, message: 'Stadion hat bereits Namensrechte' };
    }

    const revenue = 500000;
    game.money += revenue;
    stadium.namingRights = {
        company: companyName,
        revenue: revenue,
        startedMatchday: game.matchday,
        durationMatchdays: 100
    };

    if (!game.namingRightsHistory) game.namingRightsHistory = [];
    game.namingRightsHistory.push({
        company: companyName,
        revenue: revenue,
        matchday: game.matchday
    });

    updateUI();
    return {
        success: true,
        message: `✓ Namensrechte an ${companyName} verkauft! +${formatVal(revenue)}`
    };
}

function calculateAttendanceChance(expectedAttendance, matchImportance) {
    const baseAttendance = Math.round(expectedAttendance || 5000);
    const stadiumFactor = getStadiumRevenuePotential().baseCapacity / 50000;
    const boardSat = (game.boardSat || 70) / 100;
    const fanBase = (game.fans || 50) / 100;
    const importanceFactor = matchImportance || 1.0;

    const adjusted = Math.round(baseAttendance * stadiumFactor * boardSat * fanBase * importanceFactor);
    const realistic = Math.min(getStadiumRevenuePotential().baseCapacity, Math.max(1000, adjusted));

    return {
        base: baseAttendance,
        adjusted: realistic,
        factors: {
            stadium: stadiumFactor,
            boardSatisfaction: boardSat,
            fanBase: fanBase,
            importance: importanceFactor
        }
    };
}

function getStadiumComfortRating() {
    const blocks = stadium.blocks || {};
    const blockArray = Object.values(blocks);

    if (blockArray.length === 0) return 50;

    const avgToilets = blockArray.reduce((sum, b) => sum + (b.toiletLvl || 0), 0) / blockArray.length;
    const avgFood = blockArray.reduce((sum, b) => sum + (b.foodLvl || 0), 0) / blockArray.length;
    const avgMerch = blockArray.reduce((sum, b) => sum + (b.merchLvl || 0), 0) / blockArray.length;

    const lighting = stadium.flutlicht ? 10 : 0;
    const heating = stadium.rasenheizung ? 5 : 0;
    const roof = stadium.dach ? 10 : 0;
    const videoWalls = stadium.videowalls ? 8 : 0;

    const infrastructure = Math.round((avgToilets + avgFood + avgMerch) * 10);
    const amenities = lighting + heating + roof + videoWalls;

    return Math.min(100, infrastructure + amenities);
}

function getFanComfortEffect() {
    const rating = getStadiumComfortRating();
    if (rating >= 80) return 1.15;
    if (rating >= 60) return 1.08;
    if (rating >= 40) return 1.0;
    if (rating >= 20) return 0.95;
    return 0.85;
}

function scheduleStadiumEvent() {
    if (!stadium.events) stadium.events = [];

    const eventTypes = [
        { name: 'Stadiontag', attendance: 5000, revenue: 75000 },
        { name: 'Fanfest', attendance: 8000, revenue: 120000 },
        { name: 'Sponsoring-Event', attendance: 2000, revenue: 80000 },
        { name: 'Nachwuchs-Festival', attendance: 6000, revenue: 45000 }
    ];

    const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    event.scheduledMatchday = game.matchday + 2;
    event.id = 'se_' + Math.random().toString(36).substr(2, 9);

    stadium.events.push(event);
    return { success: true, message: `✓ ${event.name} angesetzt!` };
}

function runStadiumEvent(eventId) {
    const event = (stadium.events || []).find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Event nicht gefunden' };

    const attendance = Math.round(event.attendance * (0.7 + Math.random() * 0.6));
    const actualRevenue = Math.round(event.revenue * (attendance / event.attendance));

    game.money += actualRevenue;
    event.completed = true;
    event.actualAttendance = attendance;
    event.actualRevenue = actualRevenue;

    updateUI();
    return {
        success: true,
        message: `✓ ${event.name}: ${attendance} Besucher, +${formatVal(actualRevenue)}`
    };
}

function renderStadiumManagementPanel() {
    const box = document.getElementById('stadium-management-panel');
    if (!box) return;

    const revenue = getStadiumRevenuePotential();
    const comfort = getStadiumComfortRating();
    const comfortEffect = getFanComfortEffect();

    let html = '<div style="margin-bottom:12px;">';

    html += `<div style="background:rgba(76,175,80,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--primary);">
        <div style="font-size:9px; font-weight:bold; margin-bottom:4px;">🏆 STADION-POTENZIAL</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; font-size:8px;">
            <div>📊 Kapazität: <strong>${revenue.baseCapacity.toLocaleString()}</strong></div>
            <div>💰 Ticketrevenue: <strong>${formatVal(revenue.ticketRevenue)}</strong></div>
            <div>🍔 Food/Drinks: <strong>${formatVal(revenue.foodRevenue)}</strong></div>
            <div>🎁 Merchandise: <strong>${formatVal(revenue.merchRevenue)}</strong></div>
            <div>💎 VIP-Zones: <strong>${formatVal(revenue.vipRevenue)}</strong></div>
            <div>📍 Namensrechte: <strong>${revenue.namingRights > 0 ? formatVal(revenue.namingRights) : 'Keine'}</strong></div>
        </div>
        <div style="font-size:9px; font-weight:bold; margin-top:4px; color:var(--accent);">💵 Gesamtrevenue/Spiel: ${formatVal(revenue.total)}</div>
    </div>`;

    html += `<div style="background:rgba(100,150,255,0.1); padding:6px; border-radius:4px; margin-bottom:8px;">
        <div style="font-size:9px; font-weight:bold; margin-bottom:4px;">⭐ KOMFORT-RATING: ${comfort}/100</div>
        <div style="font-size:8px; color:var(--text-muted); margin-bottom:4px;">Fan-Zufriedenheitsmultiplikator: ×${comfortEffect.toFixed(2)}</div>
        <div style="width:100%; background:rgba(0,0,0,0.3); height:6px; border-radius:3px; overflow:hidden;">
            <div style="width:${comfort}%; height:100%; background:var(--primary); transition:width 0.3s;"></div>
        </div>
    </div>`;

    if (stadium.namingRights) {
        html += `<div style="background:rgba(212,169,74,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--gold);">
            <div style="font-size:9px; font-weight:bold;">📍 ${stadium.namingRights.company}-Stadion</div>
            <div style="font-size:8px; color:var(--text-muted);">Laufzeit: ${stadium.namingRights.durationMatchdays - (game.matchday - stadium.namingRights.startedMatchday)} SpT</div>
        </div>`;
    } else {
        html += '<button onclick="sellNamingRightsToCompany(\'Premium-Bank\')" class="btn-gold" style="width:100%; font-size:9px; padding:6px; margin-bottom:8px;">📍 Namensrechte verkaufen (+500.000 €)</button>';
    }

    html += '<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">🔧 Block-Optimierung:</div>';
    const strategies = ['revenue', 'comfort', 'vip', 'capacity'];
    strategies.forEach(strat => {
        const costs = { revenue: 150000, comfort: 100000, vip: 200000, capacity: 250000 };
        html += `<button onclick="optimizeStadiumBlock('haupttribune', '${strat}')" class="btn-secondary" style="width:100%; font-size:8px; padding:4px; margin-bottom:2px;">
            ${strat === 'revenue' ? '💰' : strat === 'comfort' ? '⭐' : strat === 'vip' ? '💎' : '📈'} ${strat} [${formatVal(costs[strat])}]
        </button>`;
    });

    html += '</div>';
    box.innerHTML = html;
}

function renderStadiumEventsPanel() {
    const box = document.getElementById('stadium-events-panel');
    if (!box) return;

    const events = stadium.events || [];
    const pendingEvents = events.filter(e => !e.completed);

    let html = '<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">📅 STADIUM-EVENTS</div>';

    if (pendingEvents.length === 0) {
        html += '<div style="font-size:9px; color:var(--text-muted); margin-bottom:8px;">Keine anstehenden Events</div>';
        html += '<button onclick="scheduleStadiumEvent()" class="btn-action" style="width:100%; font-size:9px; padding:6px;">+ Neues Event ansetzen</button>';
    } else {
        html += `<div style="font-size:9px; color:var(--accent); margin-bottom:6px;">${pendingEvents.length} Events ausstehend</div>`;
        pendingEvents.slice(0, 3).forEach(e => {
            html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; font-size:9px;">
                <div><strong>${e.name}</strong></div>
                <div style="color:var(--text-muted); font-size:8px;">MD ${e.scheduledMatchday} · ${e.attendance} Besucher · ${formatVal(e.revenue)}</div>
                <button onclick="runStadiumEvent('${e.id}')" class="btn-primary" style="font-size:8px; padding:2px 4px; margin-top:2px;">Durchführen</button>
            </div>`;
        });
        if (pendingEvents.length > 3) {
            html += `<div style="font-size:8px; color:var(--text-muted);">+${pendingEvents.length - 3} weitere Events</div>`;
        }
    }

    box.innerHTML = html;
}
