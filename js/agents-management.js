
    // ==========================================
    // SPIELER-VERMITTLER / AGENTEN-MANAGEMENT
    // ==========================================
    // Agenten vertreten Spieler und verhandeln automatisch über Verträge,
    // Transfers und Lohnerhöhungen. Sie haben eigene Gewinnspannen und
    // können bei kritischen Spielern unbequeme Forderungen stellen.
    /* eslint-disable no-undef */

    const AGENT_TYPES = {
        'powerbroker': { commission: 0.15, negotiationToughness: 1.3, influence: 'high' },
        'traditional': { commission: 0.10, negotiationToughness: 1.0, influence: 'medium' },
        'boutique': { commission: 0.08, negotiationToughness: 0.8, influence: 'low' }
    };

    function createAgent(name, type = 'traditional') {
        return {
            id: 'agent_' + Math.random().toString(36).substr(2, 9),
            name: name,
            type: type,
            commission: AGENT_TYPES[type].commission,
            negotiationToughness: AGENT_TYPES[type].negotiationToughness,
            influence: AGENT_TYPES[type].influence,
            clientsCount: 0,
            yearsActive: Math.floor(Math.random() * 15) + 1,
            reputation: 50 + Math.random() * 50,
            totalCommissionEarned: 0,
            negotiationSuccessRate: 0.6 + Math.random() * 0.25
        };
    }

    function initializeAgentPool() {
        if (!game.agentPool) {
            game.agentPool = [];
            // Erzeuge ein Netzwerk von Standard-Agenten
            const agentNames = [
                'Klaas Weibull', 'Bruno Sperisen', 'Bernd Schuster',
                'Rolf Müller', 'Jorge Mendes', 'Jonathan Barnett',
                'Mino Raiola', 'Federico Pastorello', 'Giuliano Bertolucci'
            ];
            agentNames.forEach((name, i) => {
                let type = i % 3 === 0 ? 'powerbroker' : i % 3 === 1 ? 'traditional' : 'boutique';
                game.agentPool.push(createAgent(name, type));
            });
        }
    }

    function assignAgentToPlayer(playerId, agentId) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return { success: false, message: 'Spieler nicht gefunden' };
        let agent = game.agentPool.find(x => x.id === agentId);
        if (!agent) return { success: false, message: 'Agent nicht gefunden' };
        if (p.agent) {
            return { success: false, message: `${p.name} hat bereits einen Agent: ${p.agent.name}` };
        }
        p.agent = { id: agent.id, name: agent.name, commission: agent.commission };
        agent.clientsCount++;
        showToast(`✅ ${p.name} signiert mit Agent ${agent.name}`, 'success');
        return { success: true, message: `Agent zugewiesen` };
    }

    function fireAgent(playerId) {
        let p = squad.find(x => x.id === playerId);
        if (!p || !p.agent) return { success: false, message: 'Spieler/Agent nicht gefunden' };
        let agentName = p.agent.name;
        let agent = game.agentPool.find(x => x.id === p.agent.id);
        if (agent) agent.clientsCount--;
        p.agent = null;
        showToast(`📋 ${p.name} hat sich von Agent ${agentName} getrennt`, 'success');
        return { success: true };
    }

    // Agenten verhandeln proaktiv für ihre Top-Klienten - vor allem bei
    // etablierten, ehrgeizigen Spielern, die mehr Wertschätzung fordern.
    function checkAgentNegotiations() {
        squad.filter(p => p.agent && p.strength >= 60).forEach(p => {
            let agent = game.agentPool.find(x => x.id === p.agent.id);
            if (!agent || Math.random() > 0.05) return; // 5% Chance pro Matchday

            let baseBonus = Math.round(p.salary * 0.15);
            let agentDemand = Math.round(baseBonus * agent.negotiationToughness);
            let successChance = agent.negotiationSuccessRate * (p.morale / 100);

            if (Math.random() < successChance && game.money >= agentDemand) {
                game.money -= agentDemand;
                p.salary += baseBonus;
                let commissionPaid = Math.round(agentDemand * p.agent.commission);
                agent.totalCommissionEarned += commissionPaid;
                showToast(
                    `💬 Agent ${agent.name} verhandelte Lohnerhöhung für ${p.name}: +${formatVal(baseBonus)} (Agent verdient ${formatVal(commissionPaid)})`,
                    'info'
                );
                addInboxMessage('agent', `Lohnverhandlung erfolgreich`,
                    `Agent ${agent.name} hat für ${p.name} eine Lohnerhöhung um ${formatVal(baseBonus)} durchgesetzt.`, 'screen-squad');
            } else if (game.money < agentDemand) {
                addInboxMessage('agent', `⚠️ Agent fordert Lohnerhöhung`,
                    `Agent ${agent.name} möchte für ${p.name} ${formatVal(agentDemand)} mehr Gehalt, aber das Geld reicht nicht.`, 'screen-squad');
            }
        });
    }

    // Agenten können auch bei wichtigen Spielerverpflichtungen Druck machen,
    // besonders wenn deren Klient der beste Spieler im neuen Club sein soll.
    function getAgentInfluenceOnTransfer(playerId, agentId) {
        let p = squad.find(x => x.id === playerId);
        let agent = game.agentPool.find(x => x.id === agentId);
        if (!p || !agent) return 0;

        let influence = 0;
        if (agent.influence === 'high') influence += 0.25;
        else if (agent.influence === 'medium') influence += 0.10;
        else influence += 0.03;

        // Mächtige Agenten können noch mehr Druck ausüben, wenn ihr Klient ein Star ist
        if (p.strength >= 70 && agent.type === 'powerbroker') influence += 0.15;
        return influence;
    }

    function renderAgentsPanel() {
        const box = document.getElementById('agents-panel');
        if (!box) return;

        initializeAgentPool();
        const agentsWithClients = game.agentPool.filter(a => a.clientsCount > 0);

        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">👔 AGENTEN-NETZWERK</div>`;

        if (agentsWithClients.length === 0) {
            html += '<div style="font-size:9px; color:var(--text-muted); margin-bottom:8px;">Keine Agenten beschäftigt</div>';
        } else {
            agentsWithClients.forEach(agent => {
                let clients = squad.filter(p => p.agent && p.agent.id === agent.id);
                html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:6px; font-size:9px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <strong>${agent.name}</strong>
                        <span style="color:var(--accent);">${agent.type}</span>
                    </div>
                    <div style="font-size:8px; color:var(--text-muted); margin-bottom:3px;">
                        📊 Klienten: ${agent.clientsCount} · Provision: ${(agent.commission * 100).toFixed(0)}% · Erfolgsquote: ${(agent.negotiationSuccessRate * 100).toFixed(0)}%
                    </div>
                    <div style="font-size:8px; color:var(--gold);">💰 Verdient: ${formatVal(agent.totalCommissionEarned)}</div>
                    <div style="margin-top:3px;">
                        ${clients.map(c => `<div style="font-size:8px; color:var(--blue);">• ${c.name} (${c.pos})</div>`).join('')}
                    </div>
                </div>`;
            });
        }

        html += '<div style="font-size:10px; font-weight:bold; margin-top:8px; margin-bottom:4px;">🔍 Verfügbare Agenten</div>';
        const availableAgents = game.agentPool.filter(a => a.clientsCount === 0).slice(0, 5);
        availableAgents.forEach(agent => {
            html += `<div style="background:rgba(62,224,138,0.1); padding:4px; border-radius:3px; margin-bottom:3px; font-size:8px; display:flex; justify-content:space-between; align-items:center;">
                <span>${agent.name} (${agent.type})</span>
                <button onclick="assignAgentToRandomPlayer('${agent.id}')" class="btn-secondary" style="font-size:7px; padding:2px 4px;">Hinzufügen</button>
            </div>`;
        });

        box.innerHTML = html;
    }

    function assignAgentToRandomPlayer(agentId) {
        let agentlessPlayers = squad.filter(p => !p.agent && p.strength >= 40);
        if (agentlessPlayers.length === 0) {
            showToast('Keine verfügbaren Spieler ohne Agent!', 'error');
            return;
        }
        let p = agentlessPlayers[Math.floor(Math.random() * agentlessPlayers.length)];
        assignAgentToPlayer(p.id, agentId);
        renderAgentsPanel();
    }

