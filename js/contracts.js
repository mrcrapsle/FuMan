
    // ==========================================
    // SAISONPLANUNG-ÜBERSICHT
    // ==========================================
    // Zeigt auf einen Blick, wer wirklich für die kommende Saison zur Verfügung steht: welche
    // Verträge bald auslaufen, wer zurück zum Leihverein muss, und wo eine Entscheidung ansteht.
    function renderSeasonPlanningBox() {
        let box = document.getElementById('season-planning-box');
        if (!box) return;
        let urgent = squad.filter(p => p.contracts <= 1).sort((a, b) => a.contracts - b.contracts);
        let soon = squad.filter(p => p.contracts === 2);
        let safe = squad.filter(p => p.contracts >= 3);
        let returningLoans = (typeof incomingLoans !== 'undefined' ? incomingLoans : []).map(l => {
            let p = squad.find(x => x.id === l.playerId);
            return p ? { name: p.name, matchdaysLeft: l.matchdaysLeft, buyOptionFee: l.buyOptionFee } : null;
        }).filter(Boolean);

        box.innerHTML = `
            <div class="box" style="font-size:10px; margin-bottom:6px;">
                📋 <strong>${urgent.length}</strong> Verträge laufen bald aus · <strong>${returningLoans.length}</strong> Leihspieler kehren ggf. zurück · <strong>${safe.length}</strong> Verträge langfristig gesichert
            </div>
            ${urgent.length > 0 ? `
                <div style="font-size:9px; font-weight:800; color:var(--danger); margin:6px 0 3px;">🔴 DRINGEND - VERTRAG LÄUFT AUS (0-1 JAHR)</div>
                ${urgent.map(p => `<div class="box" style="font-size:9px; border-left-color:var(--danger); display:flex; justify-content:space-between;"><span>${p.name} (${p.pos}, Str ${p.strength})</span><span>${p.contracts === 0 ? 'Läuft diese Saison aus!' : '1 Jahr Rest'}</span></div>`).join('')}
            ` : ''}
            ${soon.length > 0 ? `
                <div style="font-size:9px; font-weight:800; color:var(--accent); margin:6px 0 3px;">🟡 BALD PLANEN (2 JAHRE REST)</div>
                ${soon.map(p => `<div class="box" style="font-size:9px; border-left-color:var(--accent); display:flex; justify-content:space-between;"><span>${p.name} (${p.pos})</span><span>2 Jahre Rest</span></div>`).join('')}
            ` : ''}
            ${returningLoans.length > 0 ? `
                <div style="font-size:9px; font-weight:800; color:var(--blue); margin:6px 0 3px;">📋 LEIHSPIELER - RÜCKKEHR ODER KAUFOPTION</div>
                ${returningLoans.map(l => `<div class="box" style="font-size:9px; border-left-color:var(--blue); display:flex; justify-content:space-between;"><span>${l.name}</span><span>noch ${l.matchdaysLeft} SpT · Kaufoption ${formatVal(l.buyOptionFee)}</span></div>`).join('')}
            ` : ''}
        `;
    }

    function renderContractsView() {
        renderSeasonPlanningBox();
        let list = document.getElementById('contracts-list');
        list.innerHTML = '';
        squad.forEach(p => {
            let imGespraech = contractTalk && contractTalk.playerId === p.id;
            let gesperrt = p.talksBlockedSeason === game.season || !!p.preContractSigned;
            let row = document.createElement('div');
            row.className = 'panel';
            row.style.cssText = 'margin-bottom:4px; padding:6px;';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="display:flex; align-items:center; gap:6px;">${typeof renderPlayerAvatarTag === 'function' ? renderPlayerAvatarTag(p, 28) : ''}${p.name} (${p.contracts} J. Rest · ${formatVal(p.wage)}/SpT)${p.agent ? ` <span class="badge badge-trait" title="${p.agent.name}">🕴️ Berater</span>` : ''}${p.playtimePromise ? ' <span class="badge">🤝 Einsatzgarantie</span>' : ''}${p.preContractOffer ? ` <span class="badge" style="background:var(--danger);">⚠️ ${p.preContractOffer.club} lockt - Frist SpT ${p.preContractOffer.deadline}</span>` : ''}${p.preContractSigned ? ` <span class="badge" style="background:var(--danger);">✍️ Vorvertrag bei ${p.preContractSigned}</span>` : ''}</span>
                    ${imGespraech ? '' : `<button onclick="extendContract('${p.id}')" class="btn-secondary" style="width:auto;" ${gesperrt ? 'disabled' : ''}>${p.preContractSigned ? 'Geht am Saisonende' : (gesperrt ? 'Gespräche ruhen' : '📝 Verhandeln')}</button>`}
                </div>
                ${imGespraech ? renderContractTalkBox(p) : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:9px; flex-wrap:wrap; gap:3px;">
                    ${p.releaseClause
                        ? `<span>📜 Ausstiegsklausel: <strong style="color:var(--accent);">${formatVal(p.releaseClause)}</strong></span><button onclick="removeReleaseClause('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">Entfernen</button>`
                        : `<span style="color:var(--text-muted);">Keine Ausstiegsklausel</span>
                           <input type="number" id="release-clause-input-${p.id}" placeholder="mind. ${formatVal(Math.round(p.marketValue * 1.1))}" class="input-inline" style="width:110px; font-size:8px;">
                           <button onclick="confirmSetReleaseClause('${p.id}')" class="btn-secondary" style="width:auto; font-size:8px;">📜 Klausel festlegen</button>`
                    }
                </div>
                ${(typeof renderBonusClausesBlock === 'function') ? renderBonusClausesBlock(p) : ''}
            `;
            list.appendChild(row);
        });

    }

    // Alte Spielstände: Daten von drei abgelösten Vertragsmodulen, die eigene Scheinverträge
    // (Laufzeit in Spieltagen, erfundene Gehälter) neben p.contracts führten, und vom nie
    // befüllten zweiten Berater-Pool (Berater sind p.agent, siehe getAgentFee).
    function cleanupLegacyContractState() {
        ['contracts', 'contractNegotiations', 'contractRenewal', 'negotiationHistory', 'agentPool'].forEach(k => { delete game[k]; });
        squad.forEach(p => { delete p.contractEnd; delete p.loyaltyYears; });
    }

    // ==========================================
    // VERTRAGSGESPRÄCHE MIT GEHALT
    // ==========================================
    // Jeder Spieler fordert bei der Verlängerung ein Gehalt nach Marktwert und Rolle:
    // Stammspieler und Stars mehr, Bankspieler und Ältere weniger, unzufriedene einen
    // Aufschlag. Laufzeit 1-3 Jahre (Handgeld je Jahr), Gegenangebot -10 % mit einer vom
    // Charakter abhängigen Annahmechance, nach zwei Absagen ruhen die Gespräche bis zur
    // nächsten Saison. Bankspieler unterschreiben gegen eine Einsatzgarantie günstiger.
    let contractTalk = null; // { playerId, years, offerFactor, garantie, rounds }

    function getContractDemand(p) {
        let marktGehalt = calculatePlayerWage(p.marketValue, p.strength);
        let elf = pickBestLineupIds();
        let stammspieler = elf.includes(p.id);
        let top3 = [...squad].sort((a, b) => b.strength - a.strength).slice(0, 3).some(x => x.id === p.id);
        let faktor = top3 ? 1.25 : (stammspieler ? 1.1 : 0.95);
        if (p.age >= 31) faktor -= 0.1;
        if ((p.morale || 50) < 40) faktor += 0.1;
        else if ((p.morale || 50) >= 80) faktor -= 0.05;
        // Wer spielt, nimmt keine Kürzung hin; Ersatzspieler und Ältere schon.
        let untergrenze = (stammspieler && p.age < 31) ? p.wage : p.wage * 0.85;
        let gehalt = Math.round(Math.max(untergrenze, marktGehalt * faktor) / 10) * 10;
        // Vorvertrags-Angebot eines anderen Vereins (js/pre-contracts.js): er weiß, was er wert ist.
        if (p.preContractOffer) gehalt = Math.round(gehalt * 1.15 / 10) * 10;
        let handgeldProJahr = Math.max(1500, Math.round(p.marketValue * 0.05));
        if (staffMembers.sportDir.hired) handgeldProJahr = Math.round(handgeldProJahr * 0.8);
        return { gehalt, handgeldProJahr, stammspieler, star: top3 };
    }

    function contractWageTotalWith(p, neuesGehalt) {
        return squad.reduce((s, pl) => s + (pl.id === p.id ? neuesGehalt : pl.wage), 0)
            + (game.secondTeam && game.secondTeam.isActive ? secondTeamSquad.reduce((s, pl) => s + pl.wage, 0) : 0);
    }

    // Knopf "Verhandeln": öffnet das Gespräch mit diesem Spieler.
    function extendContract(id) {
        let p = squad.find(x => x.id === id);
        if (!p) return;
        if (p.talksBlockedSeason === game.season) { showToast(`${p.name} will diese Saison nicht mehr verhandeln.`, 'error'); return; }
        if (p.preContractSigned) { showToast(`${p.name} hat schon einen Vorvertrag bei ${p.preContractSigned} unterschrieben - er geht am Saisonende.`, 'error', 4500); return; }
        contractTalk = { playerId: id, years: p.age >= 30 ? 1 : 2, offerFactor: 1, garantie: false, rounds: 0 };
        renderContractsView();
    }
    function setContractTalkYears(y) { if (contractTalk) { contractTalk.years = y; renderContractsView(); } }
    function toggleContractTalkGuarantee() { if (contractTalk) { contractTalk.garantie = !contractTalk.garantie; renderContractsView(); } }
    function cancelContractTalk() { contractTalk = null; renderContractsView(); }

    function getContractTalkOffer(p) {
        let d = getContractDemand(p);
        let gehalt = Math.round(d.gehalt * contractTalk.offerFactor * (contractTalk.garantie && !d.stammspieler ? 0.85 : 1) / 10) * 10;
        let handgeld = d.handgeldProJahr * contractTalk.years;
        let berater = getAgentFee(p, handgeld);
        return { ...d, angebot: gehalt, handgeld, berater };
    }

    // Gegenangebot: 10 % unter der aktuellen Forderung. Zähe Charaktere lehnen öfter ab.
    function counterContractTalk() {
        let p = contractTalk && squad.find(x => x.id === contractTalk.playerId);
        if (!p) return;
        let zaehigkeit = (typeof CHARACTER_TOUGHNESS !== 'undefined' && CHARACTER_TOUGHNESS[p.character]) || 1.0;
        let chance = Math.min(0.9, Math.max(0.1, 0.7 - (zaehigkeit - 1) * 1.2 - (1 - contractTalk.offerFactor) * 2));
        if (Math.random() < chance) {
            contractTalk.offerFactor = Math.round((contractTalk.offerFactor - 0.1) * 100) / 100;
            showToast(`🤝 ${p.name} geht auf dein Gegenangebot ein.`, 'success');
        } else {
            contractTalk.rounds++;
            p.morale = Math.max(10, (p.morale || 50) - 4);
            if (contractTalk.rounds >= 2) {
                p.talksBlockedSeason = game.season;
                contractTalk = null;
                showToast(`😤 ${p.name} bricht die Gespräche ab - erst nächste Saison wieder.`, 'error', 4500);
                addInboxMessage('vertrag', `😤 Vertragsgespräche geplatzt: ${p.name}`, `${p.name} fühlt sich unterbewertet und will diese Saison nicht mehr über einen neuen Vertrag reden.`, 'screen-contracts');
            } else {
                showToast(`💬 ${p.name} lehnt ab und besteht auf seiner Forderung.`, 'error');
            }
        }
        renderContractsView();
    }

    function acceptContractTalk() {
        let p = contractTalk && squad.find(x => x.id === contractTalk.playerId);
        if (!p) return;
        let o = getContractTalkOffer(p);
        let kosten = o.handgeld + o.berater;
        if (game.money < kosten) { showToast(`Handgeld nicht gedeckt: ${formatVal(kosten)} nötig.`, 'error'); return; }
        if (contractWageTotalWith(p, o.angebot) > game.wageBudget) { showToast(`Gehaltsbudget reicht nicht (${formatVal(game.wageBudget)} pro Spieltag).`, 'error', 4500); return; }
        playSound('click');
        game.money -= kosten;
        p.wage = o.angebot;
        p.contracts += contractTalk.years;
        if (contractTalk.garantie && !o.stammspieler) p.playtimePromise = { season: game.season + 1, minApps: 15 };
        p.morale = Math.min(100, (p.morale || 50) + 5);
        showToast(`✅ ${p.name} verlängert um ${contractTalk.years} J. - ${formatVal(o.angebot)} pro Spieltag`, 'success');
        contractTalk = null;
        renderContractsView();
        updateUI();
    }

    // Saisonende: gebrochene Einsatzgarantien kosten Moral.
    function checkPlaytimePromises() {
        squad.forEach(p => {
            let pr = p.playtimePromise;
            if (!pr || pr.season !== game.season) return;
            if ((p.appearancesSeason || 0) < pr.minApps) {
                p.morale = Math.max(10, (p.morale || 50) - 20);
                addInboxMessage('vertrag', `😠 Einsatzgarantie gebrochen: ${p.name}`, `${p.name} kam nur auf ${p.appearancesSeason || 0} statt der zugesagten ${pr.minApps} Einsätze und ist schwer enttäuscht.`, 'screen-squad');
            }
            delete p.playtimePromise;
        });
    }

    function renderContractTalkBox(p) {
        let o = getContractTalkOffer(p);
        let jahr = y => `<button onclick="setContractTalkYears(${y})" class="${contractTalk.years === y ? 'btn-action' : 'btn-secondary'}" style="width:auto; padding:4px 10px;">${y} J.</button>`;
        return `<div class="box" style="font-size:10px; margin-top:6px; border-left-color:var(--gold);">
            <strong>📝 Vertragsgespräch</strong>${o.star ? ' · ⭐ Leistungsträger' : (o.stammspieler ? ' · Stammspieler' : ' · Ergänzungsspieler')}<br>
            Gehalt: ${formatVal(p.wage)} → <strong>${formatVal(o.angebot)}</strong> pro Spieltag${contractTalk.offerFactor < 1 ? ` (Gegenangebot ${Math.round((1 - contractTalk.offerFactor) * 100)} % unter Forderung)` : ''}<br>
            Handgeld: ${formatVal(o.handgeld)}${o.berater > 0 ? ` + ${formatVal(o.berater)} Berater` : ''}
            <div style="display:flex; gap:4px; margin:6px 0; align-items:center;">Laufzeit: ${jahr(1)}${jahr(2)}${jahr(3)}</div>
            ${o.stammspieler ? '' : `<label style="display:block; margin-bottom:6px;"><input type="checkbox" ${contractTalk.garantie ? 'checked' : ''} onchange="toggleContractTalkGuarantee()"> Einsatzgarantie (15 Spiele nächste Saison, Gehalt -15 %)</label>`}
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button onclick="acceptContractTalk()" class="btn-action" style="width:auto;">✔ Unterschreiben</button>
                <button onclick="counterContractTalk()" class="btn-secondary" style="width:auto;">↘ Gegenangebot -10 %</button>
                <button onclick="cancelContractTalk()" class="btn-secondary" style="width:auto;">Abbrechen</button>
            </div>
        </div>`;
    }

    // ==========================================
    // AUSSTIEGSKLAUSEL
    // ==========================================
    // Eine feste Ablösesumme, ab der jeder interessierte Verein den Spieler sofort und ohne
    // Verhandlung abwerben kann - wie im echten Fußball üblich. Eine niedrige Klausel macht
    // den Spieler zufriedener (Sicherheit für seine Karriere), erhöht aber das Risiko eines
    // plötzlichen Abgangs zu einem für dich möglicherweise ungünstigen Preis.
    function confirmSetReleaseClause(playerId) {
        let input = document.getElementById(`release-clause-input-${playerId}`);
        let amount = parseInt(input ? input.value : '');
        if (isNaN(amount)) { showToast('Ungültiger Betrag!', 'error'); return; }
        setReleaseClause(playerId, amount);
    }
    function setReleaseClause(playerId, amount) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return;
        let minClause = Math.round(p.marketValue * 1.1);
        if (amount < minClause) { showToast(`Mindestbetrag: ${formatVal(minClause)} (110% des Marktwerts)!`, 'error'); return; }
        p.releaseClause = amount;
        // Eine niedrigere Klausel (näher am Marktwert) macht den Spieler zufriedener, eine
        // hohe (deutlich über Marktwert) wirkt sich neutral aus - realistisches Trade-off.
        let clauseRatio = amount / p.marketValue;
        if (clauseRatio <= 1.3) p.morale = Math.min(100, p.morale + 6);
        showToast(`📜 Ausstiegsklausel für ${p.name} auf ${formatVal(amount)} festgelegt.`, 'success');
        renderContractsView();
    }
    function removeReleaseClause(playerId) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return;
        p.releaseClause = null;
        showToast(`📜 Ausstiegsklausel für ${p.name} entfernt.`, 'success');
        renderContractsView();
    }
    // Wird jeden Spieltag geprüft: löst ein rivalisierender Verein die Klausel aus, verlässt
    // der Spieler sofort den Kader - sofortige, ungebremste Zahlung ohne Verhandlungsspielraum.
    function checkReleaseClauseTriggers() {
        squad.filter(p => p.releaseClause && p.releaseClause > 0).forEach(p => {
            // Höhere Stärke = attraktiver für Rivalen, aber auch höhere Klausel = seltener ausgelöst.
            let baseChance = 0.008 * (p.strength / 60);
            let clauseRatio = p.releaseClause / p.marketValue;
            let chance = baseChance / Math.max(1, clauseRatio - 0.8);
            if (Math.random() < chance) {
                let buyerClub = (typeof INTERNATIONAL_CLUB_NAMES !== 'undefined' && INTERNATIONAL_CLUB_NAMES.length > 0)
                    ? INTERNATIONAL_CLUB_NAMES[Math.floor(Math.random() * INTERNATIONAL_CLUB_NAMES.length)]
                    : 'Ein Rivale';
                let payout = p.releaseClause;
                game.money += payout;
                if (typeof checkCrowdFavoriteDeparture === 'function') checkCrowdFavoriteDeparture(p);
                squad = squad.filter(x => x.id !== p.id);
                addInboxMessage('vertrag', `📜 Ausstiegsklausel ausgelöst: ${p.name}!`, `${buyerClub} hat die Ausstiegsklausel von ${p.name} gezogen und sofort ${formatVal(payout)} überwiesen - der Spieler verlässt den Verein augenblicklich.`, 'screen-squad');
                showToast(`📜 ${p.name} wurde per Ausstiegsklausel abgeworben! (+${formatVal(payout)})`, 'error');
            }
        });
    }

