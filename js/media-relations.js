
    // ==========================================
    // MEDIENBEZIEHUNGEN & PRESSEKONFERENZEN
    // ==========================================
    // Manager müssen mit der Presse umgehen: Pressekonferenzen
    // beeinflussen Reputation, Fan-Engagement und Sponsoring-Chancen.

    let mediaRelationsState = {
        reputation: 50, // 0-100: Dein Media-Image
        pressAttitude: 50, // 0-100: Wie mag die Presse dich?
        lastConference: -99, // Spieltag der letzten Pressekonferenz
        controversies: [] // [ { matchday, description, severity } ]
    };

    const PRESS_CONFERENCE_RESPONSES = {
        confident: {
            name: '💪 Selbstbewusst',
            reputation: 8,
            pressAttitude: -5,
            description: 'Aggressiv, fordernd, kampflustig - entweder Zuspruch oder Kritik',
            riskLevel: 'hoch'
        },
        diplomatic: {
            name: '🤝 Diplomatisch',
            reputation: 4,
            pressAttitude: 8,
            description: 'Ausweichend aber professionell - sichere Wahl ohne großen Effekt',
            riskLevel: 'niedrig'
        },
        honest: {
            name: '❤️ Ehrlich',
            reputation: 6,
            pressAttitude: 6,
            description: 'Authentisch und zugänglich - Fans und Presse mögen das',
            riskLevel: 'mittel'
        },
        deflecting: {
            name: '🚫 Ablenkend',
            reputation: -4,
            pressAttitude: -8,
            description: 'Fragen ignorieren, zu anderen Themen springen - wird als arrogant wahrgenommen',
            riskLevel: 'sehr_hoch'
        }
    };

    function canGivePressConference() {
        return (game.matchday - mediaRelationsState.lastConference) >= 2; // Minimum 2 Spieltage zwischen Konferenzen
    }

    function openPressConferenceDialog() {
        if (!canGivePressConference()) {
            showToast('📻 Du hast erst kürzlich eine Pressekonferenz gegeben. Warte noch...', 'info');
            return;
        }

        let modal = document.createElement('div');
        modal.className = 'generic-modal-overlay show';
        modal.innerHTML = `
            <div class="generic-modal" style="max-width:500px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <span style="font-size:32px;">📻</span>
                    <div>
                        <strong style="font-size:14px;">PRESSEKONFERENZ</strong>
                        <div style="font-size:9px; color:#aaa;">Spieltag ${game.matchday} - Wie reagierst du auf die jüngsten Entwicklungen?</div>
                    </div>
                </div>

                <div class="box" style="margin-bottom:12px; font-size:10px;">
                    <strong>Aktuelle Situation:</strong><br>
                    • Deine Reputation: ${mediaRelationsState.reputation}/100<br>
                    • Presse-Haltung: ${mediaRelationsState.pressAttitude}/100<br>
                    • Fan-Engagement: ${fanEngagementState.engagement}/100
                </div>

                <div style="display:grid; gap:8px; margin-bottom:12px;">
        `;

        Object.entries(PRESS_CONFERENCE_RESPONSES).forEach(([key, resp]) => {
            let risk = resp.riskLevel === 'niedrig' ? '🟢' : (resp.riskLevel === 'mittel' ? '🟡' : '🔴');
            modal.innerHTML += `
                <button onclick="givePressConferenceResponse('${key}')" class="btn-action" style="text-align:left; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:700; font-size:11px;">${resp.name}</div>
                        <div style="font-size:9px; color:#aaa; margin-top:2px;">${resp.description}</div>
                        <div style="font-size:8px; margin-top:4px;">
                            <span style="color:${resp.reputation > 0 ? 'var(--primary)' : 'var(--danger)'};">Rep ${resp.reputation > 0 ? '+' : ''}${resp.reputation}</span> ·
                            <span style="color:${resp.pressAttitude > 0 ? 'var(--primary)' : 'var(--danger)'};">Presse ${resp.pressAttitude > 0 ? '+' : ''}${resp.pressAttitude}</span>
                        </div>
                    </div>
                    <span>${risk}</span>
                </button>
            `;
        });

        modal.innerHTML += `
                </div>
                <button onclick="this.closest('.generic-modal-overlay').remove()" class="btn-secondary" style="width:100%;">Abbrechen</button>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
        });
    }

    function givePressConferenceResponse(responseType) {
        let response = PRESS_CONFERENCE_RESPONSES[responseType];
        if (!response) return;

        mediaRelationsState.lastConference = game.matchday;
        mediaRelationsState.reputation = Math.max(0, Math.min(100, mediaRelationsState.reputation + response.reputation));
        mediaRelationsState.pressAttitude = Math.max(0, Math.min(100, mediaRelationsState.pressAttitude + response.pressAttitude));

        // Effekte auf Fan-Engagement
        if (response.reputation > 0 || response.pressAttitude > 0) {
            fanEngagementState.engagement = Math.min(100, fanEngagementState.engagement + 5);
        }

        // Zufälliger Presse-Kommentar
        let comments = {
            confident: [
                '💪 Manager zeigt Selbstvertrauen - Fans lieben es!',
                '🎤 "Wir sind besser als alle anderen!" - Riskante Aussagen!',
                '⚽ Manager gibt klare Ansagen - respektvoll oder arrogant?'
            ],
            diplomatic: [
                '🤐 Klassische politische Antworten - aber sicher',
                '🎭 Manager bleibt professionell und unauffällig',
                '💤 Nichts Besonderes, aber auch nichts Negatives'
            ],
            honest: [
                '❤️ Manager spricht aus dem Herzen - Authentizität kommt an!',
                '🤗 Ehrlichkeit stärkt Vertrauen zu den Fans',
                '💬 Offener Dialog mit Presse - gut angenommen'
            ],
            deflecting: [
                '😠 Manager ignoriert kritische Fragen - Schlagzeile morgen!',
                '🚫 Defensive Antworten - Presse fühlt sich nicht ernst genommen',
                '📰 "Keine Kommentare" - nur noch mehr Spekulationen!'
            ]
        };

        let randomComment = comments[responseType][Math.floor(Math.random() * comments[responseType].length)];

        showToast(`📻 ${response.name}\n\n${randomComment}\n\nReputation: ${response.reputation > 0 ? '+' : ''}${response.reputation} · Presse: ${response.pressAttitude > 0 ? '+' : ''}${response.pressAttitude}`, 'info', 6000);

        document.querySelectorAll('.generic-modal-overlay').forEach(m => m.remove());
        renderMediaRelationsPanel();
    }

    function renderMediaRelationsPanel() {
        let container = document.getElementById('media-relations-box');
        if (!container) return;

        let reputationColor = mediaRelationsState.reputation >= 70 ? 'var(--primary)' :
                              (mediaRelationsState.reputation >= 50 ? 'var(--accent)' : 'var(--danger)');
        let pressColor = mediaRelationsState.pressAttitude >= 60 ? 'var(--primary)' :
                         (mediaRelationsState.pressAttitude >= 40 ? 'var(--accent)' : 'var(--danger)');

        let canConference = canGivePressConference();
        let nextConference = mediaRelationsState.lastConference + 2;
        let waitMessage = !canConference ? ` (verfügbar ab Spieltag ${nextConference})` : '';

        let html = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">📻 Deine Reputation</div>
                    <div style="font-size:16px; font-weight:700; color:${reputationColor};">${mediaRelationsState.reputation}</div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-top:4px;">
                        <div style="height:100%; width:${mediaRelationsState.reputation}%; background:${reputationColor}; border-radius:2px;"></div>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:6px; padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:9px; color:#aaa; margin-bottom:4px;">🗞️ Presse-Haltung</div>
                    <div style="font-size:16px; font-weight:700; color:${pressColor};">${mediaRelationsState.pressAttitude}</div>
                    <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-top:4px;">
                        <div style="height:100%; width:${mediaRelationsState.pressAttitude}%; background:${pressColor}; border-radius:2px;"></div>
                    </div>
                </div>
            </div>

            <button onclick="openPressConferenceDialog()" class="${canConference ? 'btn-action' : 'btn-secondary'}" style="width:100%; margin-bottom:12px; opacity:${canConference ? '1' : '0.6'};">
                📻 Pressekonferenz geben${waitMessage}
            </button>

            <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:8px; border:1px solid rgba(255,255,255,0.1); font-size:9px;">
                <div style="color:#aaa; line-height:1.5;">
                    <strong style="display:block; color:var(--accent); margin-bottom:6px;">💡 Medien-Management Tipps:</strong>
                    • <strong>Hohe Reputation:</strong> Sponsoring +20%, Fans +10% zufriedener<br>
                    • <strong>Positive Presse:</strong> Bessere Transfer-Verhandlungen, höhere TV-Einnahmen<br>
                    • <strong>Kontroversen vermeiden:</strong> Zu viele Negativ-Schlagzeilen = Fan-Unmut<br>
                    • <strong>Pressekonferenzen:</strong> Max. 1x alle 2 Spieltage, sonst wirkt es aufdringlich
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
