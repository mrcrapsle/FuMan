
    // ==========================================
    // SPIELER-SKANDALE
    // ==========================================
    // Spieler können in negative Schlagzeilen geraten: Verletzungs-Vortäuschung,
    // schlechte Disziplin, Doping-Vorwürfe - mit echten Konsequenzen für die Karriere.
    /* eslint-disable no-undef */

    const SCANDAL_TYPES = {
        'indiscipline': {
            name: 'Disziplinlosigkeit',
            icon: '😤',
            impact: 'morale',
            affectedTeam: true,
            duration: 4,
            consequences: { moraleMinus: 15, mediaReputation: -20 }
        },
        'overparty': {
            name: 'Zu wilde Nachtleben',
            icon: '🍺',
            impact: 'fitness',
            affectedTeam: false,
            duration: 3,
            consequences: { fitnessLoss: 20, moraleMinus: 10 }
        },
        'doping': {
            name: 'Doping-Verdacht',
            icon: '⚖️',
            impact: 'reputation',
            affectedTeam: true,
            duration: 8,
            consequences: { mediaReputation: -50, suspension: 3 }
        },
        'faking-injury': {
            name: 'Verletzungs-Vortäuschung',
            icon: '🤥',
            impact: 'morale',
            affectedTeam: true,
            duration: 5,
            consequences: { moraleMinus: 20, mediaReputation: -30 }
        },
        'violence': {
            name: 'Gewalt außerhalb des Platzes',
            icon: '⚔️',
            impact: 'reputation',
            affectedTeam: true,
            duration: 6,
            consequences: { mediaReputation: -40, suspension: 2 }
        }
    };

    function generatePlayerScandale() {
        if (!squad || squad.length === 0) return null;

        // Nur Spieler mit niedriger Moral oder schlechter Disziplin sind anfällig
        let candidates = squad.filter(p => p.morale < 40 || (p.discipline || 50) < 40);
        if (candidates.length === 0) return null;

        let player = candidates[Math.floor(Math.random() * candidates.length)];
        let scandalType = Object.keys(SCANDAL_TYPES)[Math.floor(Math.random() * Object.keys(SCANDAL_TYPES).length)];
        let scandal = SCANDAL_TYPES[scandalType];

        return {
            playerId: player.id,
            playerName: player.name,
            type: scandalType,
            icon: scandal.icon,
            name: scandal.name,
            matchday: game.matchday,
            duration: scandal.duration,
            daysLeft: scandal.duration,
            affectedTeam: scandal.affectedTeam,
            consequences: scandal.consequences,
            resolved: false
        };
    }

    function checkForScandale() {
        if (!game.scandals) game.scandals = [];

        // Alle 30 Spieltage ca. 30% Chance für einen Skandal
        if (game.matchday % 30 === 0 && Math.random() < 0.3) {
            let scandal = generatePlayerScandale();
            if (scandal) {
                game.scandals.push(scandal);
                let player = squad.find(p => p.id === scandal.playerId);

                // Morale-Hit für ganzes Team bei negativen Skandalen
                if (scandal.affectedTeam) {
                    squad.forEach(p => {
                        p.morale -= 5;
                        p.morale = Math.max(0, p.morale);
                    });
                }

                // Medien-Reputation sinkt
                if (typeof changeMediaImage === 'function') {
                    changeMediaImage(-Math.round(scandal.consequences.mediaReputation / 2));
                }

                addInboxMessage('scandal', `${scandal.icon} Skandal: ${player?.name}`,
                    `${player?.name} ist in einen Skandal verstrickt: "${scandal.name}". Dauer: ca. ${scandal.duration} Spieltage.`, 'screen-squad');
                showToast(`⚠️ ${scandal.icon} SKANDAL: ${scandal.name}!`, 'error');
            }
        }

        // Abgelaufene Skandale aufräumen
        game.scandals = game.scandals.map(s => {
            s.daysLeft--;
            return s;
        }).filter(s => s.daysLeft > 0);
    }

    function resolveScandale(scandalIndex, accept = false) {
        if (!game.scandals || !game.scandals[scandalIndex]) return;

        let scandal = game.scandals[scandalIndex];
        let player = squad.find(p => p.id === scandal.playerId);

        if (accept) {
            // Spieler muss Konsequenzen tragen
            if (scandal.consequences.moraleMinus) {
                player.morale -= scandal.consequences.moraleMinus;
                player.morale = Math.max(0, player.morale);
            }
            if (scandal.consequences.suspension) {
                player.suspended = (player.suspended || 0) + scandal.consequences.suspension;
            }
            if (scandal.consequences.fitnessLoss) {
                player.fitness -= scandal.consequences.fitnessLoss;
                player.fitness = Math.max(10, player.fitness);
            }
            showToast(`✅ ${scandal.icon} Skandal gelöst - ${player.name} trägt Konsequenzen`, 'info');
        } else {
            // Spieler verleugnet alles - Skandal wird schlimmer, aber Spieler bleibt leistungsfähig
            if (typeof changeMediaImage === 'function') {
                changeMediaImage(-15);
            }
            showToast(`💢 ${scandal.icon} ${player.name} leugnet alles - noch schlechtere Publicity!`, 'error');
        }

        scandal.resolved = true;
    }

    function renderScandalsPanel() {
        const box = document.getElementById('scandals-panel');
        if (!box) return;

        const scandals = (game.scandals || []).filter(s => !s.resolved);

        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">⚠️ SPIELER-SKANDALE</div>`;

        if (scandals.length === 0) {
            html += '<div style="font-size:9px; color:var(--text-muted); margin-bottom:8px;">Keine aktuellen Skandale</div>';
        } else {
            scandals.forEach((scandal, idx) => {
                let player = squad.find(p => p.id === scandal.playerId);
                html += `<div style="background:rgba(255,84,104,0.15); padding:6px; border-radius:4px; margin-bottom:6px; border-left:3px solid var(--danger);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <strong>${scandal.icon} ${scandal.name}</strong>
                        <span style="font-size:8px; color:var(--text-muted);">${scandal.daysLeft} SpT</span>
                    </div>
                    <div style="font-size:8px; color:var(--text-muted); margin-bottom:4px;">
                        Spieler: <strong>${player?.name || 'Unbekannt'}</strong>
                    </div>
                    <div style="display:flex; gap:3px;">
                        <button onclick="resolveScandale(${idx}, true)" class="btn-secondary" style="font-size:8px; padding:3px 6px; flex:1;">Konsequenzen</button>
                        <button onclick="resolveScandale(${idx}, false)" class="btn-secondary" style="font-size:8px; padding:3px 6px; flex:1;">Dementieren</button>
                    </div>
                </div>`;
            });
        }

        box.innerHTML = html;
    }

