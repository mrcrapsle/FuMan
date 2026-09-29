
    // ==========================================
    // BOARD-MANAGEMENT & VORSTANDSPOLITIK
    // ==========================================
    // Der Vorstand entscheidet über Budget, Langzeitpläne und deine Zukunft.
    // Strategische Beziehungen zu Vorstandsmitgliedern sind Gold wert.

    let boardState = {
        satisfaction: 60, // 0-100: Wie zufrieden ist der Vorstand?
        investmentLust: 50, // 0-100: Wollen sie investieren?
        jobSecurity: 75, // 0-100: Wie sicher ist dein Job?
        members: {
            president: { name: 'Präsident', relation: 60, influence: 40 },
            vicePresident: { name: 'Vizepräsident', relation: 55, influence: 30 },
            financialBoss: { name: 'Finanzvorstand', relation: 50, influence: 35 },
            sportsDirector: { name: 'Sportdirektor', relation: 65, influence: 25 }
        },
        meetingScheduled: false,
        lastMeetingMatchday: -99
    };

    const BOARD_ACTIONS = {
        negotiatePresidents: {
            name: '🤝 Mit Präsident verhandeln',
            cost: 0,
            difficulty: 'hoch',
            successRate: 0.6,
            effects: {
                satisfaction: 12,
                investmentLust: 15,
                relationChange: 20
            },
            outcomes: {
                success: '✓ Präsident ist beeindruckt - erhöht Vertrauen in deine Strategie!',
                failure: '✗ Präsident sieht dich als eigennützig an - Vertrauen sinkt.'
            }
        },
        investorPitch: {
            name: '💼 Investor-Präsentation',
            cost: 0,
            difficulty: 'mittel',
            successRate: 0.75,
            effects: {
                satisfaction: 8,
                investmentLust: 20,
                relationChange: 10
            },
            outcomes: {
                success: '✓ Board sieht Potenzial - Budget kann erhöht werden!',
                failure: '✗ Zu ambitiös? Board ist skeptisch.'
            }
        },
        performanceReport: {
            name: '📊 Leistungsbericht',
            cost: 0,
            difficulty: 'niedrig',
            successRate: 0.85,
            effects: {
                satisfaction: 5,
                investmentLust: 3,
                relationChange: 5
            },
            outcomes: {
                success: '✓ Transparenz wird geschätzt - kleinerer Vertrauensbonus!',
                failure: '✗ Bericht wirkt schlecht - Vorstand ist enttäuscht.'
            }
        }
    };

    function getJobSecurityModifier() {
        let leagueTable = leaguesData[game.leagueLevel];
        let our = leagueTable.find(t => t.id === game.clubId);
        let position = leagueTable.indexOf(our) + 1;
        let positionModifier = (leagueTable.length - position) / leagueTable.length * 40; // 0-40 basierend auf Position

        let winRate = game.matchesPlayed > 0 ? (game.wins / game.matchesPlayed * 100) : 50;
        let performanceModifier = Math.max(-20, Math.min(20, (winRate - 45) * 0.6));

        return boardState.satisfaction * 0.5 + positionModifier + performanceModifier;
    }

    function tickBoardRelations() {
        if (game.matchday % 4 !== 0) return; // Monatlich

        let securityModifier = getJobSecurityModifier();
        boardState.jobSecurity = Math.max(10, Math.min(100, boardState.jobSecurity + (securityModifier - 50) * 0.1));

        // Natürlicher Decay der Zufriedenheit
        boardState.satisfaction = Math.max(20, boardState.satisfaction - 2);
        boardState.investmentLust = Math.max(15, boardState.investmentLust - 1);

        // Gelüftungen durch gute Ergebnisse
        if (game.wins > 0) {
            boardState.satisfaction += 3;
            boardState.jobSecurity += 2;
        }

        // Finanzielle Gesundheit beeinflußt Investmentlust
        let cashFlow = (game.money / 1000000) * 10; // Vereinfacht
        boardState.investmentLust = Math.min(100, boardState.investmentLust + Math.max(-5, Math.min(5, cashFlow)));
    }

    function executeBoardAction(actionKey) {
        let action = BOARD_ACTIONS[actionKey];
        if (!action) return;

        let success = Math.random() < action.successRate;
        let message = success ? action.outcomes.success : action.outcomes.failure;

        if (success) {
            boardState.satisfaction = Math.min(100, boardState.satisfaction + action.effects.satisfaction);
            boardState.investmentLust = Math.min(100, boardState.investmentLust + action.effects.investmentLust);

            // Beziehungen zu Mitgliedern verbessern
            Object.keys(boardState.members).forEach(key => {
                boardState.members[key].relation = Math.min(100, boardState.members[key].relation + action.effects.relationChange);
            });
        } else {
            boardState.satisfaction = Math.max(0, boardState.satisfaction - 5);
            Object.keys(boardState.members).forEach(key => {
                boardState.members[key].relation = Math.max(0, boardState.members[key].relation - 5);
            });
        }

        showToast(`${actionKey === 'performanceReport' ? '📊' : '💼'} ${action.name}\n\n${message}`,
                 success ? 'success' : 'warning', 5000);
        renderBoardManagementPanel();
    }

    function renderBoardManagementPanel() {
        let container = document.getElementById('board-management-box');
        if (!container) return;

        let satisfactionColor = boardState.satisfaction >= 70 ? 'var(--primary)' :
                                (boardState.satisfaction >= 50 ? 'var(--accent)' : 'var(--danger)');
        let investColor = boardState.investmentLust >= 70 ? 'var(--primary)' :
                          (boardState.investmentLust >= 50 ? 'var(--accent)' : 'var(--danger)');
        let jobSecureColor = boardState.jobSecurity >= 70 ? 'var(--primary)' :
                             (boardState.jobSecurity >= 50 ? 'var(--accent)' : 'var(--danger)');

        let leagueTable = leaguesData[game.leagueLevel];
        let our = leagueTable.find(t => t.id === game.clubId);
        let position = leagueTable.indexOf(our) + 1;

        let html = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">😊 Zufriedenheit</div>
                    <div style="font-size:16px; font-weight:700; color:${satisfactionColor};">${boardState.satisfaction}</div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-top:4px;">
                        <div style="height:100%; width:${boardState.satisfaction}%; background:${satisfactionColor}; border-radius:2px;"></div>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">💰 Investlust</div>
                    <div style="font-size:16px; font-weight:700; color:${investColor};">${boardState.investmentLust}</div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-top:4px;">
                        <div style="height:100%; width:${boardState.investmentLust}%; background:${investColor}; border-radius:2px;"></div>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">🔒 Job-Sicherheit</div>
                    <div style="font-size:16px; font-weight:700; color:${jobSecureColor};">${Math.round(boardState.jobSecurity)}</div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-top:4px;">
                        <div style="height:100%; width:${boardState.jobSecurity}%; background:${jobSecureColor}; border-radius:2px;"></div>
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">👥 VORSTANDSMITGLIEDER</div>
                <div style="display:grid; gap:4px;">
        `;

        Object.entries(boardState.members).forEach(([key, member]) => {
            let relationColor = member.relation >= 70 ? 'var(--primary)' :
                               (member.relation >= 50 ? 'var(--accent)' : 'var(--danger)');
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px; background:rgba(255,255,255,0.02); border-radius:3px;">
                    <span><strong>${member.name}</strong></span>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <div style="font-size:8px;">Rel: <strong style="color:${relationColor};">${member.relation}</strong></div>
                        <div style="width:30px; height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${member.relation}%; background:${relationColor}; border-radius:2px;"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="font-size:9px; color:var(--accent); font-weight:700; margin-bottom:6px;">🎯 VORSTANDSVERHANDLUNGEN</div>
                <div style="display:grid; gap:4px;">
        `;

        Object.entries(BOARD_ACTIONS).forEach(([key, action]) => {
            let difficulty = action.difficulty === 'niedrig' ? '🟢' :
                           (action.difficulty === 'mittel' ? '🟡' : '🔴');
            html += `
                <button onclick="executeBoardAction('${key}')" class="btn-action" style="font-size:8px; padding:6px; text-align:left;">
                    <div style="font-weight:700;">${action.name} ${difficulty}</div>
                    <div style="font-size:7px; color:#aaa;">Erfolgsrate: ${(action.successRate * 100).toFixed(0)}%</div>
                </button>
            `;
        });

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <strong style="display:block; color:var(--accent); margin-bottom:6px;">💡 Board-Management Tipps:</strong>
                <div style="color:#aaa; line-height:1.5;">
                    • <strong>Gute Ergebnisse:</strong> Best way to keep board happy (+3 Zufriedenheit/Monat)<br>
                    • <strong>Job-Sicherheit:</strong> Abhängig von Liga-Position und Leistung<br>
                    • <strong>Investitionen:</strong> Hohe Investlust + gute Relation = mehr Budget<br>
                    • <strong>Vorsicht:</strong> Zu viele gescheiterte Verhandlungen = schlechtere Chancen
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
