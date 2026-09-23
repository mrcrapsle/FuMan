
    // ==========================================
    // ERFOLGSBASIERTE VERTRAGSBONI (NEU)
    // ==========================================
    // Zusätzlich zum Grundgehalt lassen sich mit jedem Spieler individuelle Erfolgsklauseln
    // vereinbaren, die erst bei tatsächlichem Erreichen einer sportlichen Marke ausgezahlt
    // werden - wie im echten Fußball übliche Bonusregelungen:
    // - Torbonus: ab X Saisontoren
    // - Einsatzbonus: ab X Saisoneinsätzen
    // - Aufstiegsbonus: bei tatsächlichem Aufstieg des Vereins (egal welche Liga)
    // Jeder Bonus wird pro Saison höchstens EINMAL ausgezahlt (siehe p.bonusPaidThisSeason),
    // der Zähler wird beim Saisonwechsel zusammen mit goalsSeason zurückgesetzt.

    const BONUS_CLAUSE_LABELS = { goals: '⚽ Torbonus', appearances: '🎽 Einsatzbonus', promotion: '📈 Aufstiegsbonus' };

    // Verhandlungsspielraum statt frei wählbarer Beträge: ein Spieler mit realem Marktwert
    // akzeptiert keine symbolische Bonuszahlung - die Mindestbeträge orientieren sich am
    // Marktwert, ähnlich der Mindestklausel bei Ausstiegsklauseln (siehe contracts.js).
    const BONUS_CLAUSE_MIN_AMOUNTS = {
        goals: p => Math.max(500, Math.round(p.marketValue * 0.012)),
        appearances: p => Math.max(300, Math.round(p.marketValue * 0.007)),
        promotion: p => Math.max(1000, Math.round(p.marketValue * 0.02))
    };
    function getBonusClauseMinAmount(p, type) {
        let fn = BONUS_CLAUSE_MIN_AMOUNTS[type];
        return fn ? fn(p) : 0;
    }

    function ensureBonusClauseFields(p) {
        if (!p.bonusClauses) p.bonusClauses = { goals: null, appearances: null, promotion: null };
        if (!p.bonusPaidThisSeason) p.bonusPaidThisSeason = { goals: false, appearances: false, promotion: false };
    }

    function setBonusClause(playerId, type, threshold, amount) {
        let p = squad.find(x => x.id === playerId);
        if (!p || !BONUS_CLAUSE_LABELS[type]) return;
        ensureBonusClauseFields(p);
        if (type !== 'promotion' && !(threshold > 0)) { showToast('Bitte eine gültige Schwelle angeben!', 'error'); return; }
        if (!(amount > 0)) { showToast('Bitte einen gültigen Bonusbetrag angeben!', 'error'); return; }
        let minAmount = getBonusClauseMinAmount(p, type);
        if (amount < minAmount) { showToast(`${p.name} verlangt für diese Klausel mindestens ${formatVal(minAmount)}!`, 'error'); return; }
        p.bonusClauses[type] = (type === 'promotion') ? { amount: Math.round(amount) } : { threshold: Math.round(threshold), amount: Math.round(amount) };
        p.bonusPaidThisSeason[type] = false; // eine neu vereinbarte/geänderte Klausel ist noch nicht eingelöst
        // Vertrauen in die eigene Leistung wirkt sich leicht positiv auf die Stimmung aus.
        p.morale = Math.min(100, (p.morale || 80) + 3);
        showToast(`✅ ${BONUS_CLAUSE_LABELS[type]} für ${p.name} vereinbart.`, 'success');
        if (typeof renderContractsView === 'function') renderContractsView();
    }

    function confirmBonusClause(playerId, type) {
        let threshEl = document.getElementById(`bonus-${type}-thresh-${playerId}`);
        let amountEl = document.getElementById(`bonus-${type}-amount-${playerId}`);
        let threshold = threshEl ? parseInt(threshEl.value) : null;
        let amount = amountEl ? parseInt(amountEl.value) : null;
        setBonusClause(playerId, type, threshold, amount);
    }

    function removeBonusClause(playerId, type) {
        let p = squad.find(x => x.id === playerId);
        if (!p || !p.bonusClauses) return;
        p.bonusClauses[type] = null;
        showToast(`${BONUS_CLAUSE_LABELS[type]} für ${p.name} entfernt.`, 'success');
        if (typeof renderContractsView === 'function') renderContractsView();
    }

    // Zentrale Auszahlungsstelle: bucht über den normalen Kontoauszug (nicht als anonymer
    // Spieltags-Nachtrag), damit die Zahlung im Finanzmenü klar dem jeweiligen Bonustyp
    // zugeordnet ist - und fließt darüber automatisch auch in die Financial-Fairplay-Bilanz
    // ein (siehe protokolliereBuchung() in finances.js), da echte Bonuszahlungen reguläres
    // operatives Geschäft sind, keine Ausnahme.
    function payOutBonusClause(p, type) {
        ensureBonusClauseFields(p);
        let clause = p.bonusClauses[type];
        if (!clause || p.bonusPaidThisSeason[type]) return;
        p.bonusPaidThisSeason[type] = true;
        let agentFee = (typeof getAgentFee === 'function') ? getAgentFee(p, clause.amount) : 0;
        let total = clause.amount + agentFee;
        setzeBuchungskontext(BONUS_CLAUSE_LABELS[type]);
        game.money -= total;
        loescheBuchungskontext();
        addInboxMessage('vertrag', `${BONUS_CLAUSE_LABELS[type]} ausgezahlt: ${p.name}!`,
            `${p.name} hat die vereinbarte Bonusklausel erreicht - ${formatVal(clause.amount)} werden ausgezahlt${agentFee > 0 ? ` (zzgl. ${formatVal(agentFee)} Beraterprovision an ${p.agent.name})` : ''}.`,
            'screen-contracts');
        showToast(`${BONUS_CLAUSE_LABELS[type]}: ${formatVal(total)} an ${p.name}!`, 'success');
    }

    // Wird pro aufgelaufenem Spieler NACH jedem Spieltag geprüft (siehe processPostMatchRoutine
    // in match.js) - goalsSeason und appearancesSeason sind an dieser Stelle bereits für das
    // gerade absolvierte Spiel aktualisiert.
    function checkMatchdayBonusClauses(p) {
        if (!p.bonusClauses) return;
        if (p.bonusClauses.goals && !((p.bonusPaidThisSeason || {}).goals) && (p.goalsSeason || 0) >= p.bonusClauses.goals.threshold) {
            payOutBonusClause(p, 'goals');
        }
        if (p.bonusClauses.appearances && !((p.bonusPaidThisSeason || {}).appearances) && (p.appearancesSeason || 0) >= p.bonusClauses.appearances.threshold) {
            payOutBonusClause(p, 'appearances');
        }
    }

    // Wird bei jedem tatsächlich VOLLZOGENEN Aufstieg aufgerufen - sowohl beim sofortigen
    // Aufstieg am Saisonende als auch beim nachträglichen Aufstieg nach erfüllter
    // DFB-Nachfrist (siehe concludeSeasonAndAdvance() in season-end.js und die
    // dfbGracePeriod-Auflösung in match.js). Ein verweigerter/verfallener Aufstieg löst
    // bewusst NICHTS aus.
    function triggerPromotionBonusClauses() {
        squad.forEach(p => {
            if (p.bonusClauses && p.bonusClauses.promotion) payOutBonusClause(p, 'promotion');
        });
    }

    // ---------- UI (eingebunden aus renderContractsView() in contracts.js) ----------
    function renderBonusClauseRow(p, type) {
        ensureBonusClauseFields(p);
        let clause = p.bonusClauses[type];
        let label = BONUS_CLAUSE_LABELS[type];
        let paid = p.bonusPaidThisSeason[type];
        if (clause) {
            let progress = type === 'goals' ? ` (${p.goalsSeason || 0}/${clause.threshold})`
                : type === 'appearances' ? ` (${p.appearancesSeason || 0}/${clause.threshold})` : '';
            return `<div class="box" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;${paid ? ' border-left-color:var(--primary);' : ''}">
                <span>${label}${type !== 'promotion' ? ` ab ${clause.threshold}${progress}` : ''}: <strong style="color:var(--accent);">${formatVal(clause.amount)}</strong>${paid ? ' <span style="color:var(--primary);">✓ ausgezahlt</span>' : ''}</span>
                <button onclick="removeBonusClause('${p.id}', '${type}')" class="btn-secondary" style="width:auto; font-size:8px;">Entfernen</button>
            </div>`;
        }
        let minAmount = getBonusClauseMinAmount(p, type);
        return `<div class="box" style="display:flex; align-items:center; gap:3px; margin-bottom:2px; flex-wrap:wrap;">
            <span style="flex:1;">${label} <span style="color:var(--text-muted);">(mind. ${formatVal(minAmount)})</span></span>
            ${type !== 'promotion' ? `<input type="number" id="bonus-${type}-thresh-${p.id}" placeholder="${type === 'goals' ? 'Tore' : 'Einsätze'}" class="input-inline" style="width:58px; font-size:8px;">` : ''}
            <input type="number" id="bonus-${type}-amount-${p.id}" placeholder="Betrag €" class="input-inline" style="width:74px; font-size:8px;">
            <button onclick="confirmBonusClause('${p.id}', '${type}')" class="btn-secondary" style="width:auto; font-size:8px;">Festlegen</button>
        </div>`;
    }
    function renderBonusClausesBlock(p) {
        return `<div style="font-size:9px; margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">
            <div style="font-weight:800; color:var(--text-muted); margin-bottom:2px;">🎯 ERFOLGSBASIERTE BONI</div>
            ${renderBonusClauseRow(p, 'goals')}
            ${renderBonusClauseRow(p, 'appearances')}
            ${renderBonusClauseRow(p, 'promotion')}
        </div>`;
    }
