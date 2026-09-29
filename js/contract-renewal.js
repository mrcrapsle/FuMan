// Spieler-Vertragsverlängerungs-System
// Automatische Kündigungen, Verhandlungen, Loyalität und Vertragsboni

let contractRenewalState = {
    pendingRenewals: [],
    activeNegotiations: {},
    renewalHistory: [],
    bonusesAwarded: 0
};

const RENEWAL_STAGES = {
    PENDING: 'pending',
    NEGOTIATING: 'negotiating',
    AGREED: 'agreed',
    REJECTED: 'rejected'
};

const NEGOTIATION_FACTORS = {
    PLAYER_AGE: { young: 1.3, prime: 1.0, veteran: 0.7 },
    CLUB_PERFORMANCE: { excellent: 1.2, good: 1.0, poor: 0.8 },
    PLAYER_PERFORMANCE: { outstanding: 1.25, good: 1.0, poor: 0.75 },
    LOYALTY_YEARS: { base: 1.0, perYear: 0.05 }
};

function initializeContractRenewal() {
    if (!game.contractRenewal) game.contractRenewal = {};
    if (!game.contractRenewal.pendingRenewals) game.contractRenewal.pendingRenewals = [];
    if (!game.contractRenewal.activeNegotiations) game.contractRenewal.activeNegotiations = {};
    if (!game.contractRenewal.renewalHistory) game.contractRenewal.renewalHistory = [];
    if (!game.contractRenewal.bonusesAwarded) game.contractRenewal.bonusesAwarded = 0;
}

function getPlayerLoyaltyYears(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return 0;
    return player.loyaltyYears || 0;
}

function calculateRenewalOffer(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    const age = player.age || 25;
    const ageCategory = age < 23 ? 'young' : age <= 30 ? 'prime' : 'veteran';
    const teamPerf = game.leaguePosition <= 3 ? 'excellent' : game.leaguePosition <= 6 ? 'good' : 'poor';
    const playerPerf = player.strength >= 85 ? 'outstanding' : player.strength >= 70 ? 'good' : 'poor';
    const loyaltyYears = getPlayerLoyaltyYears(playerId);

    let ageFactor = NEGOTIATION_FACTORS.PLAYER_AGE[ageCategory];
    let perfFactor = NEGOTIATION_FACTORS.CLUB_PERFORMANCE[teamPerf];
    let playerPerfFactor = NEGOTIATION_FACTORS.PLAYER_PERFORMANCE[playerPerf];
    let loyaltyFactor = NEGOTIATION_FACTORS.LOYALTY_YEARS.base + (loyaltyYears * NEGOTIATION_FACTORS.LOYALTY_YEARS.perYear);

    let multiplier = ageFactor * perfFactor * playerPerfFactor * loyaltyFactor;

    let baseSalary = player.wage || 5000;
    let offeredWage = Math.round(baseSalary * multiplier);
    let offerDuration = age < 23 ? 5 : age <= 30 ? 4 : 2;
    let bonusOnAgreement = Math.round(offeredWage * offerDuration * 0.5);

    let successChance = Math.min(95, Math.max(20, 50 + (multiplier - 1) * 30 + loyaltyYears * 5));

    return {
        playerId: playerId,
        playerName: player.name,
        currentWage: baseSalary,
        offeredWage: offeredWage,
        wageDifference: offeredWage - baseSalary,
        offerDuration: offerDuration,
        bonusOnAgreement: bonusOnAgreement,
        successChance: successChance,
        loyaltyYears: loyaltyYears,
        stage: RENEWAL_STAGES.PENDING,
        createdMatchday: game.matchday
    };
}

function startNegotiation(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return false;

    const offer = calculateRenewalOffer(playerId);
    if (!offer) return false;

    game.contractRenewal.activeNegotiations[playerId] = {
        ...offer,
        stage: RENEWAL_STAGES.NEGOTIATING,
        negotiationMatchday: game.matchday,
        playerAcceptanceProbability: offer.successChance / 100
    };

    showToast(`💼 Verhandlungen mit ${player.name} gestartet (${Math.round(offer.successChance)}% Erfolgswahrscheinlichkeit)`, 'info', 5000);
    return true;
}

function acceptOffer(playerId) {
    const negotiation = game.contractRenewal.activeNegotiations[playerId];
    if (!negotiation) return false;

    const player = squad.find(p => p.id === playerId);
    if (!player) return false;

    const oldWage = player.wage;
    player.wage = negotiation.offeredWage;
    player.contractEnd = game.matchday + (negotiation.offerDuration * 8);
    player.loyaltyYears = (player.loyaltyYears || 0) + 1;

    const wageDifference = negotiation.offeredWage - oldWage;
    game.money -= negotiation.bonusOnAgreement;
    game.contractRenewal.bonusesAwarded += negotiation.bonusOnAgreement;

    recordFinancialEvent('Vertragsverlängerungsbonus', -negotiation.bonusOnAgreement, 'Contract Renewal');

    game.contractRenewal.renewalHistory.push({
        season: game.season,
        matchday: game.matchday,
        playerName: player.name,
        newWage: negotiation.offeredWage,
        duration: negotiation.offerDuration,
        bonus: negotiation.bonusOnAgreement,
        status: 'accepted'
    });

    delete game.contractRenewal.activeNegotiations[playerId];
    game.contractRenewal.pendingRenewals = game.contractRenewal.pendingRenewals.filter(r => r.playerId !== playerId);

    showToast(`✅ ${player.name} hat neuen Vertrag akzeptiert! (€${negotiation.offeredWage.toLocaleString()}/SpT)`, 'success', 6000);
    return true;
}

function rejectOffer(playerId) {
    const negotiation = game.contractRenewal.activeNegotiations[playerId];
    if (!negotiation) return false;

    const player = squad.find(p => p.id === playerId);
    if (!player) return false;

    game.contractRenewal.renewalHistory.push({
        season: game.season,
        matchday: game.matchday,
        playerName: player.name,
        status: 'rejected'
    });

    delete game.contractRenewal.activeNegotiations[playerId];
    game.contractRenewal.pendingRenewals = game.contractRenewal.pendingRenewals.filter(r => r.playerId !== playerId);

    showToast(`❌ ${player.name} hat Vertragsangebot abgelehnt. Transfer wahrscheinlich.`, 'warning', 6000);
    return true;
}

function tickContractRenewal() {
    initializeContractRenewal();

    const expiringContracts = squad.filter(p => {
        const contractEnd = p.contractEnd || 30;
        const matchdaysLeft = contractEnd - (game.matchday || 1);
        return matchdaysLeft > 0 && matchdaysLeft <= 8 && !game.contractRenewal.activeNegotiations[p.id];
    });

    expiringContracts.forEach(player => {
        const pendingAlready = game.contractRenewal.pendingRenewals.find(r => r.playerId === player.id);
        if (!pendingAlready) {
            const offer = calculateRenewalOffer(player.id);
            if (offer) {
                game.contractRenewal.pendingRenewals.push(offer);
            }
        }
    });

    Object.entries(game.contractRenewal.activeNegotiations).forEach(([playerId, negotiation]) => {
        const daysInNegotiation = (game.matchday || 1) - negotiation.negotiationMatchday;

        if (daysInNegotiation >= 4) {
            const random = Math.random();
            if (random < negotiation.playerAcceptanceProbability) {
                acceptOffer(playerId);
            } else {
                rejectOffer(playerId);
            }
        }
    });
}

function getContractRenewalSummary() {
    if (!game.contractRenewal) return { pending: 0, negotiating: 0, bonusesAwarded: 0 };

    return {
        pending: game.contractRenewal.pendingRenewals.length,
        negotiating: Object.keys(game.contractRenewal.activeNegotiations).length,
        bonusesAwarded: game.contractRenewal.bonusesAwarded,
        renewalsThisSeason: game.contractRenewal.renewalHistory.filter(r => r.season === game.season).length
    };
}

function renderContractRenewalPanel() {
    const container = document.getElementById('contract-renewal-box');
    if (!container) return;

    initializeContractRenewal();

    let html = '<div class="panel-content">';
    html += '<h3>💼 VERTRAGSVERLÄNGERUNGEN</h3>';

    const summary = getContractRenewalSummary();
    html += '<div style="background:#1a1a1a; padding:8px; border-radius:4px; margin-bottom:10px;">';
    html += `<p style="font-size:9px; margin:0;"><strong>Status:</strong> `;
    html += `Ausstehend: <span style="color:var(--accent);">${summary.pending}</span> | `;
    html += `In Verhandlung: <span style="color:var(--primary);">${summary.negotiating}</span></p>`;
    html += `<p style="font-size:9px; margin:4px 0 0 0;">Bonusausgaben diese Saison: <span style="color:var(--danger);">€${(summary.bonusesAwarded / 1000).toFixed(0)}k</span></p>`;
    html += '</div>';

    if (game.contractRenewal.activeNegotiations && Object.keys(game.contractRenewal.activeNegotiations).length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>⚖️ Laufende Verhandlungen</h4>';

        Object.entries(game.contractRenewal.activeNegotiations).forEach(([playerId, negotiation]) => {
            const daysLeft = 4 - ((game.matchday || 1) - negotiation.negotiationMatchday);
            const successColor = negotiation.successChance >= 75 ? 'var(--primary)' :
                               negotiation.successChance >= 50 ? 'var(--accent)' : 'var(--danger)';

            html += `<div style="background:#222; padding:8px; margin-bottom:6px; border-radius:4px;">`;
            html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">`;
            html += `<strong style="font-size:10px;">${negotiation.playerName}</strong>`;
            html += `<span style="font-size:8px; color:${successColor};">${negotiation.successChance}% Erfolg</span>`;
            html += `</div>`;
            html += `<p style="font-size:9px; color:var(--text-muted); margin:0 0 4px 0;">Angebot: €${negotiation.offeredWage.toLocaleString()}/SpT (${negotiation.offerDuration}J)</p>`;
            html += `<p style="font-size:9px; margin:0 0 4px 0;">Bonus: <span style="color:var(--danger);">€${(negotiation.bonusOnAgreement / 1000).toFixed(0)}k</span></p>`;
            html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">`;
            html += `<button onclick="acceptOffer('${playerId}')" class="btn-primary" style="font-size:8px; padding:4px;">✅ Annehmen</button>`;
            html += `<button onclick="rejectOffer('${playerId}')" class="btn-secondary" style="font-size:8px; padding:4px;">❌ Ablehnen</button>`;
            html += `</div>`;
            html += `</div>`;
        });

        html += '</div>';
    }

    if (game.contractRenewal.pendingRenewals && game.contractRenewal.pendingRenewals.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        html += '<h4>📋 Ausstehende Verlängerungen</h4>';

        game.contractRenewal.pendingRenewals.slice(0, 5).forEach(renewal => {
            const wageChange = renewal.offeredWage - renewal.currentWage;
            const wageChangeColor = wageChange >= 0 ? 'var(--accent)' : 'var(--primary)';

            html += `<div style="background:#1a2a1a; padding:6px; margin-bottom:4px; border-radius:3px; border-left:3px solid var(--primary);">`;
            html += `<p style="font-size:9px; margin:0 0 2px 0;"><strong>${renewal.playerName}</strong></p>`;
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">Aktuell: €${renewal.currentWage.toLocaleString()} → Angebot: €${renewal.offeredWage.toLocaleString()}</p>`;
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">Loyalität: ${renewal.loyaltyYears}J | Erfolgsquote: ${Math.round(renewal.successChance)}%</p>`;
            html += `<button onclick="startNegotiation('${renewal.playerId}')" class="btn-secondary" style="font-size:8px; padding:3px 6px; margin-top:3px; width:100%;">Verhandlungen starten</button>`;
            html += `</div>`;
        });

        if (game.contractRenewal.pendingRenewals.length > 5) {
            html += `<p style="font-size:8px; color:var(--text-muted); margin:0;">... und ${game.contractRenewal.pendingRenewals.length - 5} weitere</p>`;
        }

        html += '</div>';
    }

    if (game.contractRenewal.renewalHistory && game.contractRenewal.renewalHistory.filter(r => r.season === game.season).length > 0) {
        html += '<div style="margin-top:10px;">';
        html += '<h4>✅ Diese Saison verlängert</h4>';

        const thisSeason = game.contractRenewal.renewalHistory.filter(r => r.season === game.season);
        thisSeason.slice(0, 4).forEach(renewal => {
            if (renewal.status === 'accepted') {
                html += `<div style="font-size:8px; color:var(--primary); margin-bottom:2px;">`;
                html += `• ${renewal.playerName} (€${renewal.newWage.toLocaleString()}, ${renewal.duration}J)`;
                html += `</div>`;
            }
        });

        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}
