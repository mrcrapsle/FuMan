    // ==========================================
    // KARRIERE-RÜCKBLICK & RUHESTAND
    // ==========================================
    function renderCareerSummary() {
        let box = document.getElementById('career-summary-box');
        if (!box) return;
        let bestWin = rivalryRecord.biggestWin;
        box.innerHTML = `
            <div class="modal-field-grid" style="grid-template-columns: 1fr 1fr;">
                <span class="label">Manager-Level:</span><span class="val">${managerRPG.level} (${managerRPG.xp} XP)</span>
                <span class="label">Saison:</span><span class="val">${game.season}</span>
                <span class="label">Aktuelle Liga:</span><span class="val">${leagueNames[game.leagueLevel]}</span>
                <span class="label">Trophäen gesamt:</span><span class="val">${(game.trophies || []).length}</span>
                <span class="label">Schon entlassen:</span><span class="val">${game.timesSacked || 0}×</span>
                <span class="label">Rivalen-Bilanz:</span><span class="val">${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N</span>
                <span class="label">Höchster Derbysieg:</span><span class="val">${bestWin ? `${bestWin.ourGoals}:${bestWin.oppGoals} (Saison ${bestWin.season})` : '-'}</span>
                <span class="label">Zweite Mannschaft:</span><span class="val">${game.secondTeam.isActive ? 'Aktiv' : 'Nicht gegründet'}</span>
                <span class="label">Heimbilanz:</span><span class="val">${game.homeRecord.wins}S ${game.homeRecord.draws}U ${game.homeRecord.losses}N</span>
                <span class="label">Auswärtsbilanz:</span><span class="val">${game.awayRecord.wins}S ${game.awayRecord.draws}U ${game.awayRecord.losses}N</span>
                <span class="label">Auswärts-Spitzname:</span><span class="val">${getAwayFormTitle()}</span>
                <span class="label">Ultimaten (Vertrag/Verkauf/Ignoriert):</span><span class="val">${game.ultimatumHistory?.renewed || 0} / ${game.ultimatumHistory?.sold || 0} / ${game.ultimatumHistory?.ignored || 0}</span>
                <span class="label">Berater-Vermittlungen (vorab/im Modal):</span><span class="val">${game.ultimatumHistory?.agentPreEmpted || 0} / ${game.ultimatumHistory?.agentMediated || 0}</span>
            </div>
            ${(game.trophies || []).length > 0 ? `<div style="margin-top:8px; font-size:11px; color:var(--gold);">🏆 ${(game.trophies || []).join(' · ')}</div>` : ''}
        `;
        // Trainer-Interview-Historie: letzte Medien-Auftritte, um den eigenen "Medien-
        // Charakter" über die Karriere nachvollziehen zu können.
        let interviewBox = document.getElementById('interview-history-box');
        if (interviewBox) {
            let recent = (game.interviewHistory || []).slice(-5).reverse();
            interviewBox.innerHTML = recent.length === 0
                ? '<div class="box" style="font-size:10px; color:#94a3b8;">Noch keine Interviews gegeben.</div>'
                : recent.map(h => `<div class="box" style="font-size:10px;"><span style="color:#94a3b8;">S${h.season}/${h.matchday}:</span> „${h.question}“ → <strong>${h.answer}</strong> <span style="color:${h.fans >= 0 ? 'var(--primary)' : 'var(--danger)'};">(Fans ${h.fans >= 0 ? '+' : ''}${h.fans})</span></div>`).join('');
        }
    }

    // Bewusst OHNE window.confirm() (kann in Dateimanager-WebViews unterdrückt werden, siehe
    // startNewGame()) - stattdessen dialogfreie Zwei-Klick-Bestätigung direkt am Button.
    // Anders als getSacked() wird HIER die Karriere NICHT übernommen - der Ruhestand ist ein
    // bewusster, vollständiger Neuanfang.
    function retireCareer() {
        let btn = document.getElementById('btn-retire');
        if (btn && btn.dataset.confirming !== 'true') {
            btn.dataset.confirming = 'true';
            btn.innerText = '⚠️ Wirklich? Komplette Karriere endet! Nochmal tippen zum Bestätigen';
            setTimeout(() => { if (btn) { btn.dataset.confirming = 'false'; btn.innerText = '🚪 In den Ruhestand gehen (neue Karriere beginnen)'; } }, 4000);
            return;
        }
        btn.dataset.confirming = 'false';
        btn.innerText = '🚪 In den Ruhestand gehen (neue Karriere beginnen)';
        showCareerCertificate();
    }

    // Karriere-Urkunde: fasst Trophäen-Zeitstrahl, Wappen-Historie und Kennzahlen der
    // beendeten Karriere in einer Übersicht zusammen, bevor der Ruhestand endgültig
    // vollzogen wird - als Erinnerung, da nach dem Neustart alles zurückgesetzt wird.
    function showCareerCertificate() {
        let trophyLines = (game.trophies || []).length > 0
            ? game.trophies.map((t, i) => `<div style="font-size:10px; margin:2px 0;">#${i + 1} · ${t}</div>`).join('')
            : '<div style="font-size:10px; color:#94a3b8;">Keine Trophäen errungen.</div>';

        let crestThumbs = crestHistory.slice(-8).map(c => {
            let patternMeta = CREST_PATTERN_PRESETS.find(p => p.key === c.pattern);
            return `<div style="width:32px; height:32px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:900; color:#1a1200; border:1px solid rgba(255,255,255,0.5); margin:2px; background:radial-gradient(circle at 35% 30%, ${hexToRgba(c.color, 0.65)} 0%, ${c.color} 55%, ${hexToRgba(c.color, 0.75)} 100%);">${c.symbol}</div>`;
        }).join('');

        document.getElementById('career-certificate-content').innerHTML = `
            <div style="text-align:center; margin-bottom:12px;">
                <div style="font-size:16px; font-weight:900; color:var(--gold);">🏆 KARRIERE-URKUNDE 🏆</div>
                <div style="font-size:11px; color:#94a3b8;">${game.season} Saison(en) als Manager von Lok Leipzig</div>
            </div>
            <div class="modal-field-grid">
                <span class="label">Höchstes Manager-Level:</span><span class="val">${managerRPG.level} (${managerRPG.xp} XP)</span>
                <span class="label">Höchste erreichte Liga:</span><span class="val">${leagueNames[game.leagueLevel]}</span>
                <span class="label">Trophäen gesamt:</span><span class="val">${(game.trophies || []).length}</span>
                <span class="label">Rivalen-Bilanz:</span><span class="val">${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N</span>
                <span class="label">Schon entlassen:</span><span class="val">${game.timesSacked || 0}×</span>
                <span class="label">Legenden-Status:</span><span class="val">${game.legendStatus ? '👑 Ja' : 'Nein'}</span>
                <span class="label">Zuschauerrekord:</span><span class="val">${game.recordAttendance > 0 ? `${game.recordAttendance.toLocaleString('de-DE')} (Saison ${game.recordAttendanceSeason})` : '-'}</span>
                <span class="label">Ultimaten gelöst (V/Vk/I):</span><span class="val">${game.ultimatumHistory?.renewed || 0} / ${game.ultimatumHistory?.sold || 0} / ${game.ultimatumHistory?.ignored || 0}</span>
            </div>
            <div style="font-size:11px; font-weight:800; color:var(--accent); margin-top:10px;">Trophäen-Zeitstrahl</div>
            ${trophyLines}
            <div style="font-size:11px; font-weight:800; color:var(--accent); margin-top:10px;">Wappen-Historie</div>
            <div>${crestThumbs || '<div style="font-size:10px; color:#94a3b8;">Keine früheren Wappen-Designs.</div>'}</div>
            <div style="font-size:9px; color:#64748b; margin-top:10px; text-align:center;">📸 Lade dir die Urkunde als Bild herunter oder mach einen Screenshot - nach Bestätigung ist die Karriere unwiderruflich beendet!</div>
        `;
        document.getElementById('career-certificate-overlay').classList.add('show');
    }
    function closeCareerCertificate() {
        document.getElementById('career-certificate-overlay').classList.remove('show');
    }

    // Rendert die Karriere-Urkunde als PNG-Bild via Canvas und löst einen Download aus -
    // funktioniert komplett offline im Browser, ohne Server-Roundtrip.
    function exportCareerCertificateAsImage() {
        let canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1100;
        let ctx = canvas.getContext('2d');

        // Hintergrund
        let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGradient.addColorStop(0, '#1a2138');
        bgGradient.addColorStop(1, '#0a0e1c');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#f5b942';
        ctx.lineWidth = 6;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f5b942';
        ctx.font = 'bold 42px Arial';
        ctx.fillText('🏆 KARRIERE-URKUNDE 🏆', canvas.width / 2, 100);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px Arial';
        ctx.fillText(`${game.season} Saison(en) als Manager von Lok Leipzig`, canvas.width / 2, 140);

        let y = 210;
        const line = (label, value, color = '#ffffff') => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#94a3b8';
            ctx.font = '18px Arial';
            ctx.fillText(label, 60, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = color;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(value, canvas.width - 60, y);
            y += 36;
        };
        line('Höchstes Manager-Level:', `${managerRPG.level} (${managerRPG.xp} XP)`, '#22e0a8');
        line('Höchste erreichte Liga:', leagueNames[game.leagueLevel], '#22e0a8');
        line('Trophäen gesamt:', String((game.trophies || []).length), '#22e0a8');
        line('Rivalen-Bilanz:', `${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N`, '#22e0a8');
        line('Zuschauerrekord:', game.recordAttendance > 0 ? game.recordAttendance.toLocaleString('de-DE') : '-', '#3fb6ff');
        line('Legenden-Status:', game.legendStatus ? '👑 Ja' : 'Nein', '#f5b942');
        line('Ultimaten (V/Vk/I):', `${game.ultimatumHistory?.renewed || 0} / ${game.ultimatumHistory?.sold || 0} / ${game.ultimatumHistory?.ignored || 0}`, '#ff8a5c');

        y += 20;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f5b942';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('Trophäen-Zeitstrahl', 60, y);
        y += 34;
        ctx.font = '16px Arial';
        ctx.fillStyle = '#ffffff';
        let trophies = game.trophies || [];
        if (trophies.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Keine Trophäen errungen.', 60, y);
            y += 28;
        } else {
            trophies.slice(0, 12).forEach((t, i) => {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`#${i + 1} · ${t}`, 60, y);
                y += 28;
            });
        }

        // Wappen-Vorschau unten
        y += 20;
        let crestColor = game.clubCrestColor || '#f5b942';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, y + 60, 55, 0, Math.PI * 2);
        ctx.fillStyle = crestColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1200';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(game.clubCrestSymbol || 'LL', canvas.width / 2, y + 72);

        // Wappen-Historie als kleine Zeitleiste unter dem aktuellen Wappen.
        if (crestHistory.length > 0) {
            y += 140;
            ctx.textAlign = 'left';
            ctx.fillStyle = '#f5b942';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Wappen-Historie', 60, y);
            y += 30;
            let thumbs = crestHistory.slice(-8);
            let spacing = Math.min(80, (canvas.width - 120) / thumbs.length);
            let startX = canvas.width / 2 - (thumbs.length * spacing) / 2 + spacing / 2;
            thumbs.forEach((c, i) => {
                let cx = startX + i * spacing;
                ctx.beginPath();
                ctx.arc(cx, y + 22, 22, 0, Math.PI * 2);
                ctx.fillStyle = c.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.textAlign = 'center';
                ctx.fillStyle = '#1a1200';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(c.symbol, cx, y + 27);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '9px Arial';
                ctx.fillText(`S${c.season}`, cx, y + 52);
            });
            y += 60;
        }

        ctx.fillStyle = '#64748b';
        ctx.font = '12px Arial';
        ctx.fillText('Erstellt mit Anstoß Mobile Pro - FM13', canvas.width / 2, canvas.height - 30);

        let link = document.createElement('a');
        link.download = `Karriere-Urkunde-${game.clubCrestSymbol || 'LokLeipzig'}-Saison${game.season}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('📸 Karriere-Urkunde als Bild heruntergeladen!', 'success');
    }

    function confirmFinalRetirement() {
        safeSessionSet('anstoss_fm13_force_new_game', '1');
        location.reload();
    }
