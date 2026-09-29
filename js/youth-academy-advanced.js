
    // ==========================================
    // ADVANCED YOUTH ACADEMY - TALENTFÖRDERUNG & ENTWICKLUNGSPROGRAMME
    // ==========================================
    // Spezialisierte Trainings-Programme für verschiedene Positionen, Scouting-Missionen
    // und systematische Talentförderung zur Integration in die erste Mannschaft.

    let advancedYouthAcademyState = {
        trainingPrograms: {}, // { programId: { name, position, level, trainingFocus, successRate, cost } }
        activePrograms: [], // [ { playerName, programId, progress, startedMatchday } ]
        talentReports: [], // [ { playerName, potential, scout, timestamp, rating } ]
        academyRanking: [], // [ { season, rank, tournamentWins, playersPromoted } ]
        partnerClubs: [], // [ { clubName, relation, exchanges, lastInteraction } ]
        youthTournaments: [] // [ { name, season, winners, participants, timestamp } ]
    };

    const TRAINING_PROGRAMS = {
        strikerMastery: {
            id: 'strikerMastery',
            name: '⚽ Stürmer-Spezialisierung',
            position: 'ST',
            level: 'advanced',
            focus: 'Torschuss, Positionsspiel, Kopfballspiel',
            cost: 5000,
            duration: 12,
            successRate: 0.70,
            skillBonus: { strength: 2, shooting: 4, dribbling: 1 }
        },
        midfielderControl: {
            id: 'midfielderControl',
            name: '🎯 Mittelfeld-Kontrolle',
            position: 'MIT',
            level: 'advanced',
            focus: 'Passspiel, Spielübersicht, Ballkontrolle',
            cost: 4500,
            duration: 12,
            successRate: 0.72,
            skillBonus: { strength: 1, passing: 4, pace: 1 }
        },
        defenderAcademics: {
            id: 'defenderAcademics',
            name: '🛡️ Abwehr-Akademie',
            position: 'ABW',
            level: 'advanced',
            focus: 'Zweikampf, Positionierung, Luftspiel',
            cost: 4000,
            duration: 12,
            successRate: 0.68,
            skillBonus: { strength: 3, defense: 4, pace: 1 }
        },
        goalkeeperMastery: {
            id: 'goalkeeperMastery',
            name: '🥅 Torwart-Elite',
            position: 'TW',
            level: 'advanced',
            focus: 'Reflex-Training, Flugausbildung, Befehlsgewalt',
            cost: 3500,
            duration: 12,
            successRate: 0.75,
            skillBonus: { strength: 2, defense: 3, pace: 1 }
        },
        physicalDevelopment: {
            id: 'physicalDevelopment',
            name: '💪 Athletik-Ausbildung',
            position: 'any',
            level: 'intermediate',
            focus: 'Kraft, Ausdauer, Schnelligkeit',
            cost: 3000,
            duration: 10,
            successRate: 0.80,
            skillBonus: { strength: 3, pace: 2, physique: 2 }
        }
    };

    function startTrainingProgram(playerName, programId) {
        if (!playerName || !programId) return false;

        let program = TRAINING_PROGRAMS[programId];
        if (!program) return false;

        // Kosten überprüfen
        if (game.money < program.cost) {
            showToast(`💰 Nicht genug Budget für ${program.name} (benötigt ${formatVal(program.cost)})`, 'warning');
            return false;
        }

        // Spieler überprüfen
        let player = squad.find(p => p.name === playerName);
        if (!player) return false;

        // Bereits aktives Programm?
        let existingProgram = advancedYouthAcademyState.activePrograms.find(ap => ap.playerName === playerName);
        if (existingProgram) {
            showToast(`📚 ${playerName} absolviert bereits ein Trainings-Programm`, 'info');
            return false;
        }

        // Programm starten
        game.money -= program.cost;
        advancedYouthAcademyState.activePrograms.push({
            playerName: playerName,
            programId: programId,
            progress: 0,
            startedMatchday: game.matchday,
            duration: program.duration
        });

        showToast(`📚 ${playerName} startet ${program.name}!`, 'success', 4000);
        return true;
    }

    function tickYouthAcademyPrograms() {
        if (game.matchday % 4 !== 0) return; // Monatlich

        let toRemove = [];

        advancedYouthAcademyState.activePrograms.forEach((activeProgram, idx) => {
            let program = TRAINING_PROGRAMS[activeProgram.programId];
            if (!program) return;

            activeProgram.progress += 1;
            let player = squad.find(p => p.name === activeProgram.playerName);
            if (!player) return;

            // Programm abgeschlossen?
            if (activeProgram.progress >= program.duration) {
                let success = Math.random() < program.successRate;

                if (success) {
                    // Fähigkeiten erhöhen
                    Object.entries(program.skillBonus).forEach(([skill, bonus]) => {
                        if (skill === 'strength' && player.strength) player.strength = Math.min(100, player.strength + bonus);
                        if (skill === 'shooting' && player.shooting) player.shooting = Math.min(100, player.shooting + bonus);
                        if (skill === 'passing' && player.passing) player.passing = Math.min(100, player.passing + bonus);
                        if (skill === 'defense' && player.defense) player.defense = Math.min(100, player.defense + bonus);
                        if (skill === 'pace' && player.pace) player.pace = Math.min(100, player.pace + bonus);
                        if (skill === 'dribbling' && player.dribbling) player.dribbling = Math.min(100, player.dribbling + bonus);
                        if (skill === 'physique' && player.physique) player.physique = Math.min(100, player.physique + bonus);
                    });

                    showToast(`✅ ${player.name} beendet ${program.name} erfolgreich! Fähigkeiten gesteigert!`, 'success', 5000);
                } else {
                    showToast(`⚠️ ${player.name} konnte ${program.name} nicht erfolgreich abschließen.`, 'warning', 5000);
                }

                toRemove.push(idx);
            }
        });

        // Abgeschlossene Programme entfernen
        toRemove.reverse().forEach(idx => advancedYouthAcademyState.activePrograms.splice(idx, 1));
    }

    function addScoutingReport(playerName, potential, scoutName, rating) {
        if (!advancedYouthAcademyState.talentReports) advancedYouthAcademyState.talentReports = [];

        let report = {
            playerName: playerName,
            potential: potential,
            scout: scoutName,
            timestamp: new Date().toLocaleDateString('de-DE'),
            rating: rating, // 'Supertalent', 'Großes Potential', 'Solider Spieler'
            season: game.season
        };

        advancedYouthAcademyState.talentReports.push(report);

        if (advancedYouthAcademyState.talentReports.length > 20) {
            advancedYouthAcademyState.talentReports.shift();
        }
    }

    function recordYouthAcademySuccess(seasonData) {
        if (!advancedYouthAcademyState.academyRanking) advancedYouthAcademyState.academyRanking = [];

        let entry = {
            season: game.season,
            rank: seasonData.rank || '-',
            tournamentWins: seasonData.tournamentWins || 0,
            playersPromoted: seasonData.playersPromoted || 0,
            timestamp: new Date().toLocaleDateString('de-DE')
        };

        advancedYouthAcademyState.academyRanking.push(entry);

        if (advancedYouthAcademyState.academyRanking.length > 10) {
            advancedYouthAcademyState.academyRanking.shift();
        }
    }

    function promoteYouthPlayer(playerName) {
        let player = squad.find(p => p.name === playerName && (p.age || 16) <= 22);
        if (!player) return false;

        // Spieler in erste Mannschaft fördern
        player.promoted = true;
        player.promotedSeason = game.season;

        showToast(`⭐ ${playerName} wird in die erste Mannschaft befördert!`, 'success', 5000);

        return true;
    }

    function renderYouthAcademyAdvanced() {
        let container = document.getElementById('youth-academy-advanced-box');
        if (!container) return;

        let html = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">📚 AKTIVE PROGRAMME</div>
                    <div style="font-size:10px;">
        `;

        if ((advancedYouthAcademyState.activePrograms || []).length === 0) {
            html += '<div style="color:#aaa;">Keine aktiven Programme</div>';
        } else {
            (advancedYouthAcademyState.activePrograms || []).forEach(ap => {
                let program = TRAINING_PROGRAMS[ap.programId];
                let progress = Math.round((ap.progress / ap.duration) * 100);
                html += `
                    <div style="padding:4px 0; margin-bottom:4px;">
                        <div style="font-weight:700; color:var(--accent);">${ap.playerName}</div>
                        <div style="font-size:9px; color:#aaa;">${program.name}</div>
                        <div style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:2px; overflow:hidden;">
                            <div style="height:100%; width:${progress}%; background:var(--primary);"></div>
                        </div>
                        <div style="font-size:8px; color:#aaa; margin-top:2px;">${progress}%</div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">⭐ TALENT-BERICHTE</div>
                    <div style="font-size:10px;">
        `;

        if ((advancedYouthAcademyState.talentReports || []).length === 0) {
            html += '<div style="color:#aaa;">Noch keine Berichte</div>';
        } else {
            (advancedYouthAcademyState.talentReports || []).slice(0, 3).forEach(report => {
                let ratingColor = report.rating === 'Supertalent' ? 'var(--gold)' : (report.rating === 'Großes Potential' ? 'var(--primary)' : 'var(--accent)');
                html += `
                    <div style="padding:4px 0; margin-bottom:4px;">
                        <div style="font-weight:700; color:${ratingColor};">${report.playerName}</div>
                        <div style="font-size:8px; color:#aaa;">${report.rating}</div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:700; color:var(--accent); margin-bottom:6px;">📚 VERFÜGBARE TRAININGS-PROGRAMME</div>
                <div style="display:grid; gap:4px; font-size:9px;">
        `;

        Object.entries(TRAINING_PROGRAMS).forEach(([key, program]) => {
            html += `
                <button onclick="startTrainingProgram(prompt('Spieler-Name:'), '${key}')" class="btn-action" style="text-align:left; font-size:8px; padding:6px;">
                    <div style="font-weight:700;">${program.name}</div>
                    <div style="font-size:7px; color:#aaa;">Position: ${program.position} · Kosten: ${formatVal(program.cost)}</div>
                </button>
            `;
        });

        html += `
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <strong style="display:block; color:var(--accent); margin-bottom:6px;">💡 Youth Academy:</strong>
                <div style="color:#aaa; line-height:1.5;">
                    • <strong>Trainings-Programme:</strong> Spezialisierte Ausbildung für verschiedene Positionen<br>
                    • <strong>Dauer:</strong> 10-12 Monate (1-1,2 Saisons)<br>
                    • <strong>Erfolgsrate:</strong> 68-80% je nach Programm<br>
                    • <strong>Talentförderung:</strong> Junge Spieler systematisch entwickeln<br>
                    • <strong>Beförderung:</strong> Die besten Talente in die erste Mannschaft
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
