// ==========================================
// VERHANDLUNGS-SYSTEM FÜR SPIELERVERTRÄGE
// ==========================================

function calcNegotiationSuccess(player, offerType = 'renewal') {
    if (!player || !game) return 0;

    const negotiatorPerk = managerRPG && managerRPG.perks && managerRPG.perks.negotiator ? 20 : 0;
    const playerMood = player.morale || 50;
    const marketValue = player.marketValue || 50000;
    const currentWage = player.wage || 5000;
    const wageRatio = currentWage / (marketValue / 1000);

    // Basis: Spielermoral + Verhandler-Bonus
    let successChance = 50 + negotiatorPerk + (playerMood - 50) * 0.5;

    // Angebots-Typ modifier
    if (offerType === 'renewal') {
        successChance += wageRatio < 1.5 ? 10 : -5;
    } else if (offerType === 'salary_increase') {
        successChance -= 15; // Schwieriger
    } else if (offerType === 'contract_extension') {
        successChance += 5;
    }

    return Math.max(5, Math.min(95, successChance));
}

function generateNegotiationOffer(playerId, offerType = 'renewal') {
    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    const currentWage = player.wage || 5000;
    const marketValue = player.marketValue || 50000;
    const age = player.age || 25;
    const strength = player.strength || 50;
    const successChance = calcNegotiationSuccess(player, offerType);

    let offer = {
        playerId: playerId,
        playerName: player.name,
        offerType: offerType,
        currentWage: currentWage,
        marketValue: marketValue,
        proposedWage: currentWage,
        proposedDuration: player.contracts || 3,
        successChance: successChance,
        bonusGoals: [],
        alternatives: []
    };

    // Angebots-Optionen basierend auf Typ
    if (offerType === 'renewal') {
        offer.proposedDuration = Math.min(5, (player.contracts || 3) + 1);
        offer.proposedWage = Math.round(currentWage * 1.05);
        offer.alternatives = [
            { type: 'higher_wage', wage: Math.round(currentWage * 1.15), duration: player.contracts, desc: '+15% Gehalt, gleiche Laufzeit' },
            { type: 'extended_contract', wage: currentWage, duration: 5, desc: 'Gleiches Gehalt, 5 Jahre' },
            { type: 'premium_offer', wage: Math.round(currentWage * 1.25), duration: 5, desc: '+25% Gehalt, 5 Jahre (Premium)' }
        ];
    } else if (offerType === 'salary_increase') {
        offer.proposedWage = Math.round(currentWage * 1.08);
        offer.alternatives = [
            { type: 'bonus_goals', wage: currentWage, duration: player.contracts, desc: 'Bonusziele statt Gehaltserhöhung', bonus: 'Tor-Bonuse' },
            { type: 'modest_increase', wage: Math.round(currentWage * 1.05), duration: player.contracts, desc: 'Bescheidene +5% Erhöhung' }
        ];
    } else if (offerType === 'contract_extension') {
        offer.proposedDuration = Math.min(6, (player.contracts || 3) + 2);
        offer.proposedWage = Math.round(currentWage * 1.02);
        offer.alternatives = [
            { type: 'early_extension', wage: currentWage, duration: 3, desc: 'Verlängerung um 3 Jahre (früh)' },
            { type: 'long_extension', wage: Math.round(currentWage * 1.03), duration: 5, desc: 'Verlängerung um 5 Jahre (mit kleinem Bonus)' }
        ];
    }

    // Bonusziele
    if (strength >= 75) {
        offer.bonusGoals = [
            { type: 'goals', target: 10, bonus: 5000, desc: '10+ Tore = 5.000€' },
            { type: 'assists', target: 8, bonus: 3000, desc: '8+ Assists = 3.000€' }
        ];
    }

    return offer;
}

function acceptNegotiationOffer(playerId, offerType = 'renewal', alternativeIndex = -1) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Spieler nicht gefunden' };

    const offer = generateNegotiationOffer(playerId, offerType);
    if (!offer) return { success: false, message: 'Angebot konnte nicht generiert werden' };

    const successChance = offer.successChance;
    const random = Math.random() * 100;
    const negotiationSucceeded = random < successChance;

    if (!negotiationSucceeded) {
        return {
            success: false,
            message: `${player.name} hat das Angebot abgelehnt! (${successChance.toFixed(0)}% Erfolgschance)`,
            playerName: player.name
        };
    }

    // Bestimme tatsächliches Angebot
    let finalWage = offer.proposedWage;
    let finalDuration = offer.proposedDuration;
    let bonusGoals = offer.bonusGoals;

    if (alternativeIndex >= 0 && alternativeIndex < offer.alternatives.length) {
        const alt = offer.alternatives[alternativeIndex];
        finalWage = alt.wage;
        finalDuration = alt.duration;
        if (alt.bonus) {
            bonusGoals = [{ type: 'special', desc: alt.bonus, bonus: 0 }];
        }
    }

    // Wende das Angebot an
    const wageDifference = finalWage - player.wage;
    player.wage = finalWage;
    player.contracts = finalDuration;
    player.morale = Math.min(100, (player.morale || 50) + 10);

    // Speichere Verhandlungshistorie
    if (!game.negotiationHistory) game.negotiationHistory = [];
    game.negotiationHistory.push({
        playerId: playerId,
        playerName: player.name,
        offerType: offerType,
        wage: finalWage,
        duration: finalDuration,
        wageDifference: wageDifference,
        bonusGoals: bonusGoals,
        matchday: game.matchday,
        success: true
    });

    // Finanz-Auswirkung tracken
    game.money -= (wageDifference * finalDuration * 10); // Vereinfachte Kostenberechnung

    return {
        success: true,
        message: `✓ ${player.name} hat dem Vertrag zugestimmt!`,
        playerName: player.name,
        newWage: finalWage,
        newDuration: finalDuration,
        costImpact: wageDifference * finalDuration * 10
    };
}

function rejectNegotiationOffer(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return { success: false };

    // Spieler wird verärgert
    player.morale = Math.max(0, (player.morale || 50) - 15);

    if (!game.negotiationHistory) game.negotiationHistory = [];
    game.negotiationHistory.push({
        playerId: playerId,
        playerName: player.name,
        matchday: game.matchday,
        success: false,
        reason: 'Manager hat Verhandlung abgebrochen'
    });

    return {
        success: true,
        message: `${player.name} ist verärgert! (-15 Moral)`,
        playerName: player.name
    };
}

function getPlayerContractStatus(playerId) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return null;

    const contractsLeft = player.contracts || 3;
    const wage = player.wage || 5000;
    const marketValue = player.marketValue || 50000;
    const age = player.age || 25;

    let status = 'normal';
    let urgency = 'green';

    if (contractsLeft <= 0) {
        status = 'expired';
        urgency = 'red';
    } else if (contractsLeft <= 1) {
        status = 'expiring_soon';
        urgency = 'orange';
    } else if (contractsLeft <= 2) {
        status = 'medium_term';
        urgency = 'yellow';
    }

    // Prüfe ob Spieler unterbewertet ist
    const wageAdequacy = (wage * 1000) / marketValue; // Sollte ca. 0.1-0.2 sein
    let recommendation = 'normal';
    if (wageAdequacy < 0.05) {
        recommendation = 'underpaid'; // Spieler könnte gehen
    } else if (wageAdequacy > 0.3) {
        recommendation = 'overpaid'; // Zu teuer
    }

    return {
        playerName: player.name,
        contractsLeft: contractsLeft,
        currentWage: wage,
        marketValue: marketValue,
        status: status,
        urgency: urgency,
        recommendation: recommendation,
        suggestedAction: contractsLeft <= 1 ? 'Sofortige Verhandlung empfohlen' : 'Regelmäßig überwachen'
    };
}

function renderNegotiationPanel() {
    const box = document.getElementById('negotiations-panel');
    if (!box) return;

    if (!squad || squad.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:9px;">Kein Kader verfügbar</div>';
        return;
    }

    // Finde Spieler mit auslaufenden Verträgen oder Verhandlungsbedarf
    const expiring = squad.filter(p => (p.contracts || 3) <= 2).sort((a, b) => (a.contracts || 3) - (b.contracts || 3));
    const underpaid = squad.filter(p => {
        const mv = p.marketValue || 50000;
        const w = p.wage || 5000;
        return (w * 1000) / mv < 0.05;
    });

    let html = '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:10px; font-weight:bold; margin-bottom:8px; color:var(--text-muted);">📋 Verhandlungs-Überblick</div>';

    if (expiring.length > 0) {
        html += '<div style="background:rgba(255,193,7,0.1); padding:8px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--accent);">';
        html += `<div style="font-size:9px; font-weight:bold; color:var(--accent);">⚠️ ${expiring.length} Verträge laufen aus:</div>`;
        expiring.slice(0, 3).forEach(p => {
            html += `<div style="font-size:8px; margin-top:4px;">• ${p.name}: ${p.contracts || 3} Jahre (${p.wage || 5000}€/SpT)</div>`;
        });
        html += '</div>';
    }

    if (underpaid.length > 0) {
        html += '<div style="background:rgba(76,175,80,0.1); padding:8px; border-radius:4px; margin-bottom:8px; border-left:3px solid var(--primary);">';
        html += `<div style="font-size:9px; font-weight:bold; color:var(--primary);">💰 ${underpaid.length} unterbezahlte Spieler:</div>`;
        underpaid.slice(0, 3).forEach(p => {
            html += `<div style="font-size:8px; margin-top:4px;">• ${p.name}: Marktwert ${formatVal(p.marketValue || 50000)}</div>`;
        });
        html += '</div>';
    }

    html += '</div>';

    html += '<div style="font-size:10px; font-weight:bold; margin-bottom:8px; color:var(--text-muted);">🤝 Schnelle Verhandlung:</div>';

    const playersNeedingNegotiation = squad.filter(p => (p.contracts || 3) <= 2).slice(0, 5);
    if (playersNeedingNegotiation.length === 0) {
        html += '<div style="color:var(--text-muted); font-size:9px;">Keine dringenden Verhandlungen erforderlich</div>';
    } else {
        playersNeedingNegotiation.forEach(p => {
            const status = getPlayerContractStatus(p.id);
            html += `
                <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:9px; font-weight:bold;">${p.name}</div>
                        <div style="font-size:8px; color:var(--text-muted);">Vertrag: ${status.contractsLeft}J · Gehalt: ${formatVal(status.currentWage)}/SpT</div>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button onclick="showNegotiationModal('${p.id}', 'renewal')" class="btn-primary" style="padding:3px 7px; font-size:8px;">Erneuern</button>
                        <button onclick="showNegotiationModal('${p.id}', 'salary_increase')" class="btn-secondary" style="padding:3px 7px; font-size:8px;">Erhöhung</button>
                    </div>
                </div>
            `;
        });
    }

    box.innerHTML = html;
}

function showNegotiationModal(playerId, offerType) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return;

    const offer = generateNegotiationOffer(playerId, offerType);
    if (!offer) {
        alert('Angebot konnte nicht generiert werden');
        return;
    }

    let modal = `
        <div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--bg-panel); border:2px solid var(--primary); border-radius:8px; padding:16px; max-width:500px; z-index:10000; box-shadow:0 0 20px rgba(0,0,0,0.5);">
            <div style="font-size:12px; font-weight:bold; margin-bottom:12px; color:var(--primary);">🤝 Verhandlung mit ${player.name}</div>
            <div style="font-size:9px; color:var(--text-muted); margin-bottom:12px;">
                <div>Aktuelles Gehalt: ${formatVal(offer.currentWage)}/SpT</div>
                <div>Marktwert: ${formatVal(offer.marketValue)}</div>
                <div>Vertrag: ${offer.proposedDuration} Jahre</div>
                <div style="margin-top:8px; color:var(--accent);">Erfolgschance: ${Math.round(offer.successChance)}%</div>
            </div>

            <div style="background:rgba(100,100,100,0.1); padding:8px; border-radius:4px; margin-bottom:12px;">
                <div style="font-size:9px; font-weight:bold; margin-bottom:6px;">Standard-Angebot:</div>
                <div style="font-size:9px;">Gehalt: ${formatVal(offer.proposedWage)}/SpT (+${Math.round(((offer.proposedWage / offer.currentWage - 1) * 100))}%)</div>
                <button onclick="acceptOffer('${playerId}', '${offerType}', -1)" class="btn-primary" style="width:100%; margin-top:8px; padding:6px; font-size:9px;">✓ Angebot machen</button>
            </div>

            ${offer.alternatives.length > 0 ? `
                <div style="background:rgba(76,175,80,0.1); padding:8px; border-radius:4px; margin-bottom:12px;">
                    <div style="font-size:9px; font-weight:bold; margin-bottom:6px;">Alternativen:</div>
                    ${offer.alternatives.map((alt, idx) => `
                        <div style="margin-bottom:6px;">
                            <div style="font-size:8px; color:var(--text-muted);">${alt.desc}</div>
                            <button onclick="acceptOffer('${playerId}', '${offerType}', ${idx})" class="btn-secondary" style="width:100%; padding:4px; font-size:8px; margin-top:2px;">Angebot ${idx + 1}</button>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <button onclick="closeNegotiationModal()" class="btn-secondary" style="width:100%; padding:6px; font-size:9px;">Abbrechen</button>
        </div>
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;" onclick="closeNegotiationModal()"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
}

function acceptOffer(playerId, offerType, alternativeIndex) {
    const result = acceptNegotiationOffer(playerId, offerType, alternativeIndex);
    closeNegotiationModal();
    alert(result.message);
    if (result.success) {
        renderSquadView();
        renderNegotiationPanel();
        updateUI();
    }
}

function closeNegotiationModal() {
    const modal = document.querySelector('[style*="position:fixed"][style*="z-index:10000"]');
    if (modal) modal.remove();
    const overlay = document.querySelector('[style*="position:fixed"][style*="z-index:9999"]');
    if (overlay) overlay.remove();
}
