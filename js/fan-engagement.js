
    // ==========================================
    // FAN-ENGAGEMENT-SYSTEM
    // ==========================================
    // Fans sind das Herzstück: Ticketverkäufe, Merchandise, Atmosphäre,
    // Sponsoring-Attraktivität. Ihr Management entscheidet über den Erfolg.

    let fanEngagementState = {
        satisfaction: 75, // 0-100: Wie zufrieden sind die Fans?
        engagement: 60, // 0-100: Wie engagiert sind sie?
        loyalty: 70, // 0-100: Wie loyal sind sie?
        events: [], // Veranstaltungen diesen Monat
        lastEventTick: 0 // Letzter Tick, an dem Events verarbeitet wurden
    };

    const FAN_ACTIVITIES = {
        matchdayActivation: {
            name: '🎉 Spieltag-Aktivierungen',
            cost: 5000,
            satisfaction: 8,
            engagement: 12,
            loyalty: 3,
            description: 'Choreographien, Pyrotechnik, Live-Events im Stadion'
        },
        socialMedia: {
            name: '📱 Social-Media-Kampagne',
            cost: 3000,
            satisfaction: 5,
            engagement: 15,
            loyalty: 2,
            description: 'Regelmäßige Posts, Fan-Interaktion, Behind-the-Scenes'
        },
        communityEvent: {
            name: '👥 Gemeinschafts-Event',
            cost: 8000,
            satisfaction: 15,
            engagement: 10,
            loyalty: 12,
            description: 'Fanfest, Unterschriften-Sessions, Meet & Greet'
        },
        merchandisePromotion: {
            name: '🎁 Merchandise-Aktion',
            cost: 4000,
            satisfaction: 6,
            engagement: 8,
            loyalty: 6,
            description: 'Limited Editions, Rabatte, exklusive Items'
        },
        youthProgram: {
            name: '⚽ Jugend-Akademie-Show',
            cost: 2500,
            satisfaction: 10,
            engagement: 6,
            loyalty: 8,
            description: 'Nachwuchstalente präsentieren, Familientag'
        }
    };

    function tickFanEngagement() {
        if (game.matchday % 4 !== 0) return; // Monatlich

        // Basisfaktoren beeinflussen Zufriedenheit
        let seasonProgress = game.matchday / 34;
        let leagueTable = leaguesData[game.leagueLevel];
        let ourTeam = leagueTable.find(t => t.id === game.clubId);
        let position = leagueTable.indexOf(ourTeam) + 1;
        let positionBonus = (leagueTable.length - position) / leagueTable.length * 30; // 0-30 je nach Position

        // Spielergebnisse beeinflussen Fans stark
        let recentWins = Math.min(5, Math.floor((game.wins || 0) / 3));
        let resultBonus = recentWins * 5;

        // Stadion-Atmosphäre
        let atmosphereBonus = game.fans * 0.3; // 0-30 je nach Fans

        // Decay über Zeit
        fanEngagementState.satisfaction = Math.max(20, Math.min(100,
            fanEngagementState.satisfaction + positionBonus - 5 + resultBonus + (Math.random() - 0.5) * 10
        ));

        fanEngagementState.engagement = Math.max(10, Math.min(100,
            fanEngagementState.engagement + atmosphereBonus - 3 + (Math.random() - 0.5) * 8
        ));

        fanEngagementState.loyalty = Math.max(15, Math.min(100,
            fanEngagementState.loyalty - 2 + (recentWins * 3) + (Math.random() - 0.5) * 5
        ));

        // Auswirkungen auf Ticketverkäufe
        let satisfactionMultiplier = 1 + (fanEngagementState.satisfaction - 50) * 0.01; // ±50% bei Extremen
        game.ticketSalesMultiplier = satisfactionMultiplier;

        // Auswirkungen auf Sponsoring-Attraktivität
        let sponsorAttractiveness = (fanEngagementState.engagement + fanEngagementState.loyalty) / 200 * 50; // +25% Bonus möglich
        game.sponsorAttractiveness = sponsorAttractiveness;
    }

    function executeFanActivity(activityKey) {
        let activity = FAN_ACTIVITIES[activityKey];
        if (!activity) return;

        if (game.money < activity.cost) {
            showToast(`💰 Nicht genug Geld! Benötigt: ${formatVal(activity.cost)}`, 'error');
            return;
        }

        game.money -= activity.cost;
        fanEngagementState.satisfaction = Math.min(100, fanEngagementState.satisfaction + activity.satisfaction);
        fanEngagementState.engagement = Math.min(100, fanEngagementState.engagement + activity.engagement);
        fanEngagementState.loyalty = Math.min(100, fanEngagementState.loyalty + activity.loyalty);

        let effects = [];
        if (activity.satisfaction > 0) effects.push(`Zufriedenheit +${activity.satisfaction}`);
        if (activity.engagement > 0) effects.push(`Engagement +${activity.engagement}`);
        if (activity.loyalty > 0) effects.push(`Loyalität +${activity.loyalty}`);

        showToast(`✅ ${activity.name} durchgeführt!\n${effects.join(' · ')}`, 'success');
        renderFanEngagementPanel();
        updateUI();
    }

    function renderFanEngagementPanel() {
        let container = document.getElementById('fan-engagement-box');
        if (!container) return;

        let leagueTable = leaguesData[game.leagueLevel];
        let ourTeam = leagueTable.find(t => t.id === game.clubId);
        let position = leagueTable.indexOf(ourTeam) + 1;

        // Farb-Bewertung für jeden Wert
        let getSatColor = (val) => val >= 70 ? 'var(--primary)' : (val >= 50 ? 'var(--accent)' : 'var(--danger)');
        let getSatLabel = (val) => val >= 70 ? '😊 Zufrieden' : (val >= 50 ? '😐 Neutral' : '😠 Unzufrieden');

        let html = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">😊 Zufriedenheit</div>
                    <div style="font-size:16px; font-weight:700; color:${getSatColor(fanEngagementState.satisfaction)};">${fanEngagementState.satisfaction}%</div>
                    <div style="font-size:8px; color:#666; margin-top:2px;">${getSatLabel(fanEngagementState.satisfaction)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">🔥 Engagement</div>
                    <div style="font-size:16px; font-weight:700; color:${getSatColor(fanEngagementState.engagement)};">${fanEngagementState.engagement}%</div>
                    <div style="font-size:8px; color:#666; margin-top:2px;">Aktivität & Beteiligung</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">💚 Loyalität</div>
                    <div style="font-size:16px; font-weight:700; color:${getSatColor(fanEngagementState.loyalty)};">${fanEngagementState.loyalty}%</div>
                    <div style="font-size:8px; color:#666; margin-top:2px;">Langzeit-Bindung</div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <div style="color:var(--accent); font-weight:700; margin-bottom:4px;">📊 Auswirkungen</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                    <span>Ticketverkauf-Multiplikator:</span>
                    <strong style="color:var(--gold);">×${(game.ticketSalesMultiplier || 1).toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>Sponsor-Attraktivität:</span>
                    <strong style="color:var(--primary);">+${(game.sponsorAttractiveness || 0).toFixed(0)}%</strong>
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="font-size:9px; color:var(--accent); font-weight:700; margin-bottom:6px;">🎯 FAN-AKTIVIERUNGEN</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
        `;

        Object.entries(FAN_ACTIVITIES).forEach(([key, activity]) => {
            let canAfford = game.money >= activity.cost;
            let btnColor = canAfford ? 'btn-action' : 'btn-secondary';
            let opacityStyle = canAfford ? '' : 'opacity:0.5;';

            html += `
                <button onclick="executeFanActivity('${key}')" class="${btnColor}" style="font-size:8px; padding:6px; text-align:left; ${opacityStyle} ${!canAfford ? 'cursor:not-allowed;' : ''}">
                    <div style="font-weight:700; margin-bottom:2px;">${activity.name}</div>
                    <div style="font-size:7px; color:#aaa; margin-bottom:2px;">💰 ${formatVal(activity.cost)}</div>
                    <div style="font-size:7px;">+${activity.satisfaction}Zu +${activity.engagement}En +${activity.loyalty}Lo</div>
                </button>
            `;
        });

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <div style="color:#aaa; line-height:1.4;">
                    <strong style="display:block; margin-bottom:4px;">💡 Tipps für höhere Fan-Zufriedenheit:</strong>
                    • Spielergebnisse: Siege sind das beste Fan-Mittel (${position <= 3 ? '✓ Ihr Team läuft gut!' : '⚠ Bessere Ergebnisse nötig'})<br>
                    • Regelmäßige Aktivierungen: Konstante Engagement-Events halten Fans aktiv<br>
                    • Merchandise: Hochwertige Fanartikel stärken Loyalität<br>
                    • Community: Face-to-Face Events sind am wirksamsten
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderFanEngagementStats() {
        let container = document.getElementById('fin-fan-impact-box');
        if (!container) return;

        let ticketBonus = ((game.ticketSalesMultiplier || 1) - 1) * 100;
        let sponsorBonus = (game.sponsorAttractiveness || 0);

        container.innerHTML = `
            <div style="font-size:9px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; padding:6px; background:rgba(255,255,255,0.05); border-radius:4px;">
                    <span>Fan-Zufriedenheits-Effekt auf Ticketverkäufe:</span>
                    <strong style="color:${ticketBonus > 0 ? 'var(--primary)' : 'var(--danger)'};">${ticketBonus > 0 ? '+' : ''}${ticketBonus.toFixed(0)}%</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px; background:rgba(255,255,255,0.05); border-radius:4px;">
                    <span>Sponsor-Attraktivität durch Engagement:</span>
                    <strong style="color:var(--accent);">+${sponsorBonus.toFixed(0)}%</strong>
                </div>
            </div>
        `;
    }
