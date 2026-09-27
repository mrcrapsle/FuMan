
    // ==========================================
    // VERLETZUNGSRISIKO-MANAGEMENT
    // ==========================================
    // Hohe Trainingsintensität erhöht das Verletzungsrisiko. Spieler mit
    // wenig Erholung oder vielen Einsätzen werden anfälliger. Das zwingt
    // zum strategischen Trainings-Management statt Vollgas jede Woche.
    /* eslint-disable no-undef */

    function getPlayerInjuryRisk(player) {
        if (!player) return 0;

        let baseRisk = 0.05; // 5% Basis-Risiko pro Spieltag

        // Trainingsintensität erhöht das Risiko massiv
        if (game.trainingIntensity === 'hart') baseRisk *= 2.0;
        else if (game.trainingIntensity === 'normal') baseRisk *= 1.3;
        else if (game.trainingIntensity === 'leicht') baseRisk *= 0.7;
        else if (game.trainingIntensity === 'erholung') baseRisk *= 0.3;

        // Spielerlast: zu viele Einsätze die letzte Zeit = höheres Risiko
        let recentAppearances = (player.appearances || 0) % 10; // moderne "Lügen" von Spielen die Woche
        let overloadFactor = recentAppearances / 5; // 5 Spiele in 2 Wochen = 2x Risiko
        baseRisk *= (1 + overloadFactor);

        // Fitness senkt das Risiko
        let fitnessBonus = Math.max(0.5, player.fitness / 100);
        baseRisk /= fitnessBonus;

        // Alter: ältere Spieler verletzungsanfälliger
        if (player.age >= 35) baseRisk *= 1.5;
        else if (player.age >= 32) baseRisk *= 1.2;
        else if (player.age <= 21) baseRisk *= 0.8; // Junge Spieler robuster

        // Bestimmte Positionen gefährdeter (Stürmer, Außen mit hohem Tempo)
        if (player.pos === 'ST' || player.pos === 'LM' || player.pos === 'RM') baseRisk *= 1.15;

        // Wiederkehrende Verletzungen: ein verletzungsanfälliger Spieler hat 2x Risiko
        if ((player.timesInjured || 0) >= 2) baseRisk *= 2.0;

        // Präventionsprogramm senkt das Risiko um 40%
        if (game.injuryPreventionProgram) baseRisk *= 0.6;

        // Equipment-Level kann Prävention unterstützen
        baseRisk *= Math.max(0.8, 1 - game.equipmentLevel * 0.05);

        return Math.min(baseRisk, 0.30); // gedeckelt bei 30%
    }

    function checkInjuries() {
        if (!squad) return;

        squad.forEach(p => {
            if ((p.injured || 0) > 0 || (p.suspended || 0) > 0) return; // bereits out

            let risk = getPlayerInjuryRisk(p);
            if (Math.random() < risk) {
                let durationWeeks = Math.floor(Math.random() * 4) + 1; // 1-4 Wochen
                let duration = durationWeeks * 2; // 2 Spieltage pro Woche

                p.injured = duration;
                p.timesInjured = (p.timesInjured || 0) + 1;

                let severity = durationWeeks >= 3 ? 'schwer' : durationWeeks === 2 ? 'mittelschwer' : 'leicht';
                addInboxMessage('injury', `⚠️ ${p.name} verletzt!`,
                    `${p.name} erlitt eine ${severity}e Verletzung und fällt etwa ${durationWeeks} Woche(n) aus.`, 'screen-squad');
                showToast(`⚠️ ${p.name} verletzt (${durationWeeks} Wochen)!`, 'error');
            }
        });
    }

    function getTrainingIntensityRisk() {
        if (game.trainingIntensity === 'hart') return 'SEHR HOCH';
        if (game.trainingIntensity === 'normal') return 'NORMAL';
        if (game.trainingIntensity === 'leicht') return 'NIEDRIG';
        if (game.trainingIntensity === 'erholung') return 'MINIMAL';
        return 'UNBEKANNT';
    }

    function getInjuryRiskSummary() {
        let summary = {
            totalPlayers: squad.length,
            injuredCount: squad.filter(p => p.injured > 0).length,
            highRiskCount: squad.filter(p => getPlayerInjuryRisk(p) > 0.15).length,
            mediumRiskCount: squad.filter(p => {
                let risk = getPlayerInjuryRisk(p);
                return risk > 0.08 && risk <= 0.15;
            }).length
        };
        summary.averageRisk = squad.reduce((sum, p) => sum + getPlayerInjuryRisk(p), 0) / squad.length;
        return summary;
    }

    function renderInjuryRiskPanel() {
        const box = document.getElementById('injury-risk-panel');
        if (!box) return;

        const summary = getInjuryRiskSummary();
        const riskColor = summary.averageRisk > 0.15 ? 'var(--danger)' : summary.averageRisk > 0.08 ? 'var(--accent)' : 'var(--primary)';

        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">⚠️ VERLETZUNGSRISIKO-KONTROLLE</div>`;

        html += `<div style="background:rgba(255,84,104,0.1); padding:6px; border-radius:4px; margin-bottom:8px; border-left:3px solid ${riskColor}">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:9px; margin-bottom:6px;">
                <div>📊 Durchschn. Risiko: <strong style="color:${riskColor};">${(summary.averageRisk * 100).toFixed(1)}%</strong></div>
                <div>⚠️ TRAINING: <strong>${getTrainingIntensityRisk()}</strong></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px; font-size:8px;">
                <div>Verletzt: <strong>${summary.injuredCount}</strong></div>
                <div style="color:var(--danger);">🔴 Hohes Risiko: <strong>${summary.highRiskCount}</strong></div>
                <div style="color:var(--accent);">🟡 Mittleres Risiko: <strong>${summary.mediumRiskCount}</strong></div>
            </div>
        </div>`;

        // Top 5 gefährdete Spieler anzeigen
        let riskySorted = [...squad].sort((a, b) => getPlayerInjuryRisk(b) - getPlayerInjuryRisk(a)).slice(0, 5);
        html += `<div style="font-size:9px; font-weight:bold; margin-bottom:4px;">🏥 GEFÄHRDETSTE SPIELER</div>`;
        riskySorted.forEach(p => {
            let risk = getPlayerInjuryRisk(p);
            let riskLevel = risk > 0.20 ? '🔴 KRITISCH' : risk > 0.15 ? '🟠 HOCH' : '🟡 MITTEL';
            html += `<div style="background:rgba(100,100,100,0.1); padding:4px; border-radius:3px; margin-bottom:2px; font-size:8px; display:flex; justify-content:space-between;">
                <span>${p.name} (${p.pos}, ${p.age}J.)</span>
                <span>${riskLevel} ${(risk * 100).toFixed(0)}%</span>
            </div>`;
        });

        box.innerHTML = html;
    }

