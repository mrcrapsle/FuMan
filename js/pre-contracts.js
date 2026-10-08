/* eslint-disable no-undef */
// Vorverträge (Phase 22.6): ablösefreie Wechsel zur neuen Saison - in beide Richtungen.
//
// Zugänge: ab dem Winterfenster (Spieltag 18) gibt es Spieler, deren Vertrag bei ihrem Verein
// zum Saisonende ausläuft (game.preContractPool, 4 je Saison). Ein Vorvertrag kostet keine
// Ablöse, aber: Handgeld sofort (12 oder 24 Spieltagsgehälter), 20 % mehr Gehalt als beim
// Kauf, der Spieler kommt erst zur neuen Saison - und er kann ablehnen (ein Versuch je
// Spieler; doppeltes Handgeld überzeugt eher). Wer zu lange wartet, verliert Kandidaten an
// andere Vereine (8 % pro Spieltag). Höchstens 3 offene Vorverträge (game.preContracts).
//
// Abgänge: eigene Spieler im letzten Vertragsjahr bekommen ab Spieltag 18 Vorvertrags-
// Angebote anderer Vereine (p.preContractOffer, Frist 3 Spieltage). Wer nicht rechtzeitig
// verlängert - während der Frist fordert er 15 % mehr Gehalt -, unterschreibt woanders
// (p.preContractSigned): keine Verlängerung mehr möglich, am Saisonende ist er weg.

const PRECONTRACT_START_MD = 18;
const PRECONTRACT_MAX_PENDING = 3;
const PRECONTRACT_WAGE_MARKUP = 1.2;
const PRECONTRACT_HANDGELD = { normal: 12, doppelt: 24 };
const PRECONTRACT_RIVAL_CHANCE = 0.08;
const PRECONTRACT_OFFER_CHANCE = 0.06;
const PRECONTRACT_OFFER_DEADLINE = 3;

function getPreContractClubs() {
    return (leaguesData[game.leagueLevel] || []).concat(leaguesData[Math.max(0, game.leagueLevel - 1)] || [])
        .filter(t => typeof isAiClub === 'function' ? isAiClub(t) : t.name !== game.clubName);
}

function ensurePreContractPool() {
    if (game.matchday < PRECONTRACT_START_MD) return null;
    if (!game.preContractPool || game.preContractPool.season !== game.season) {
        const minStr = 50 + (3 - game.leagueLevel) * 9;
        const vereine = getPreContractClubs();
        const spieler = [];
        for (let i = 0; i < 4; i++) {
            const pos = i === 0 && Math.random() < 0.3 ? 'TW' : ['ABW', 'MIT', 'ST'][Math.floor(Math.random() * 3)];
            const p = createPlayer(pos, minStr, minStr + 13, null, [22, 31]);
            const verein = vereine[Math.floor(Math.random() * vereine.length)];
            p.sellerClub = verein ? verein.name : 'ein Ligakonkurrent';
            p.contracts = 0;
            spieler.push(p);
        }
        game.preContractPool = { season: game.season, players: spieler };
    }
    return game.preContractPool;
}

function getPreContractTerms(p, stufe) {
    const gehalt = Math.round(p.wage * PRECONTRACT_WAGE_MARKUP / 10) * 10;
    return { gehalt, handgeld: gehalt * PRECONTRACT_HANDGELD[stufe] };
}

// Wie attraktiv ist der Verein für ihn? Stärkere Spieler wollen in eine stärkere Elf.
function getPreContractChance(p, stufe) {
    const ids = pickBestLineupIds();
    const elf = squad.filter(x => ids.includes(x.id));
    const schnitt = elf.length ? elf.reduce((a, x) => a + x.strength, 0) / elf.length : p.strength;
    const rang = typeof getOwnLeagueRank === 'function' ? getOwnLeagueRank() : 0;
    let chance = 0.6 + (schnitt - p.strength) * 0.04 + (rang > 0 && rang <= 3 ? 0.1 : 0) + (stufe === 'doppelt' ? 0.25 : 0);
    return Math.max(0.1, Math.min(0.95, chance));
}

// Gehaltssumme der NEUEN Saison: wer ausläuft, geht; offene Vorverträge kommen dazu.
function getNextSeasonWageTotal(extra) {
    const bleiben = squad.filter(x => x.contracts > 1).reduce((s, x) => s + x.wage, 0);
    const kommen = (game.preContracts || []).reduce((s, v) => s + v.player.wage, 0);
    return bleiben + kommen + (extra || 0);
}

function offerPreContract(id, stufe) {
    const pool = ensurePreContractPool();
    const p = pool && pool.players.find(x => x.id === id);
    if (!p || !PRECONTRACT_HANDGELD[stufe]) { showToast('Dieser Spieler ist nicht mehr zu haben.', 'error'); return; }
    if (p.preRefused) { showToast(`${p.name} hat schon abgesagt.`, 'error'); return; }
    if ((game.preContracts || []).length >= PRECONTRACT_MAX_PENDING) { showToast(`Höchstens ${PRECONTRACT_MAX_PENDING} Vorverträge auf einmal - der Kader für die neue Saison braucht auch Platz.`, 'error', 4500); return; }
    if (typeof isTransferEmbargoActive === 'function' && isTransferEmbargoActive()) { showToast('🚫 Transfersperre aktiv - auch keine Vorverträge.', 'error'); return; }
    const t = getPreContractTerms(p, stufe);
    if (game.money < t.handgeld) { showToast(`Handgeld nicht gedeckt: ${formatVal(t.handgeld)} nötig.`, 'error'); return; }
    if (getNextSeasonWageTotal(t.gehalt) > game.wageBudget) { showToast(`Gehaltsbudget der neuen Saison reicht nicht (${formatVal(getNextSeasonWageTotal(t.gehalt))} > ${formatVal(game.wageBudget)}).`, 'error', 5000); return; }
    playSound('click');
    if (Math.random() < getPreContractChance(p, stufe)) {
        setzeBuchungskontext('📝 Handgeld Vorvertrag');
        game.money -= t.handgeld;
        loescheBuchungskontext();
        p.wage = t.gehalt;
        pool.players = pool.players.filter(x => x.id !== id);
        if (!game.preContracts) game.preContracts = [];
        game.preContracts.push({ player: p, club: game.clubName, season: game.season, from: p.sellerClub });
        showToast(`📝 ${p.name} unterschreibt einen Vorvertrag: ablösefrei ab der neuen Saison (${formatVal(t.handgeld)} Handgeld).`, 'success', 5000);
    } else {
        p.preRefused = true;
        showToast(`${p.name} lehnt ab - er sieht seine Zukunft woanders.`, 'error', 4500);
    }
    renderPreContractBox();
    updateUI();
}

// Jeden Spieltag (processPostMatchRoutine): Konkurrenz um die Kandidaten, Angebote für eigene Spieler.
function tickPreContracts() {
    if (game.matchday < PRECONTRACT_START_MD) return;
    const pool = ensurePreContractPool();
    if (pool && game.matchday > PRECONTRACT_START_MD) {
        pool.players = pool.players.filter(p => {
            if (Math.random() >= PRECONTRACT_RIVAL_CHANCE) return true;
            const vereine = getPreContractClubs().filter(t => t.name !== p.sellerClub);
            const neu = vereine[Math.floor(Math.random() * vereine.length)];
            addInboxMessage('transfer', `📝 Vorvertrag woanders: ${p.name}`, `${p.name} (${p.pos}, Stärke ${p.strength}) wechselt zur neuen Saison ablösefrei von ${p.sellerClub} zu ${neu ? neu.name : 'einem Konkurrenten'}.`, 'screen-transfer');
            return false;
        });
    }
    const median = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)] || 0;
    squad.forEach(p => {
        if (p.preContractOffer && p.contracts > 1) {
            addInboxMessage('vertrag', `✅ ${p.name} bleibt`, `Mit der Verlängerung ist das Vorvertrags-Angebot von ${p.preContractOffer.club} vom Tisch.`, 'screen-contracts');
            delete p.preContractOffer;
            return;
        }
        if (p.preContractOffer && game.matchday >= p.preContractOffer.deadline) {
            p.preContractSigned = p.preContractOffer.club;
            delete p.preContractOffer;
            addInboxMessage('vertrag', `✍️ ${p.name} unterschreibt bei ${p.preContractSigned}`, `Die Frist ist verstrichen: ${p.name} hat einen Vorvertrag bei ${p.preContractSigned} unterschrieben und verlässt den Verein am Saisonende ablösefrei. Ein Verkauf im Winter bringt noch Geld.`, 'screen-contracts');
            return;
        }
        if (p.contracts === 1 && !p.preContractOffer && !p.preContractSigned && p.strength >= median && game.matchday <= 30 && Math.random() < PRECONTRACT_OFFER_CHANCE) {
            const vereine = getPreContractClubs().filter(t => t.strength >= p.strength - 5);
            const verein = vereine[Math.floor(Math.random() * vereine.length)];
            if (!verein) return;
            p.preContractOffer = { club: verein.name, deadline: game.matchday + PRECONTRACT_OFFER_DEADLINE };
            addInboxMessage('vertrag', `⚠️ Vorvertrags-Angebot für ${p.name}`, `${verein.name} bietet ${p.name} einen Vorvertrag für die neue Saison an. Verlängere bis Spieltag ${p.preContractOffer.deadline} (er fordert jetzt 15 % mehr Gehalt), sonst unterschreibt er dort.`, 'screen-contracts');
            showToast(`⚠️ ${verein.name} lockt ${p.name} mit einem Vorvertrag - verlängern bis Spieltag ${p.preContractOffer.deadline}!`, 'error', 5000);
        }
    });
}

// Frühwarnung für die Kaderplanung (25.19): wer ein Vorvertrags-Angebot hat (mit Frist), wer schon
// woanders unterschrieben hat, und welche Leistungsträger mit auslaufendem Vertrag ab Spieltag
// PRECONTRACT_START_MD Angebote bekommen können (je Spieltag PRECONTRACT_OFFER_CHANCE).
function getPreContractRiskInfo() {
    const median = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)] || 0;
    return {
        angebote: squad.filter(p => p.preContractOffer).map(p => ({ p, club: p.preContractOffer.club, bis: p.preContractOffer.deadline })),
        unterschrieben: squad.filter(p => p.preContractSigned).map(p => ({ p, club: p.preContractSigned })),
        gefaehrdet: squad.filter(p => p.contracts === 1 && !p.preContractOffer && !p.preContractSigned && p.strength >= median)
    };
}

// Saisonwechsel (concludeSeasonAndAdvance), nach Vertragsende und Alterung.
function joinPreContractPlayers() {
    const liste = game.preContracts || [];
    game.preContracts = [];
    liste.forEach(v => {
        const p = v.player;
        if (v.club !== game.clubName) {
            addInboxMessage('transfer', `📝 Vorvertrag verfällt: ${p.name}`, `${p.name} hatte bei ${v.club} unterschrieben - nach deinem Vereinswechsel bleibt er dort.`, 'screen-transfer');
            return;
        }
        p.age = (p.age || 25) + 1;
        p.contracts = 3;
        p.fitness = 100;
        delete p.sellerClub; delete p.preRefused;
        if (typeof stampPlayerJoin === 'function') stampPlayerJoin(p, 'vorvertrag', v.from);
        if (squad.some(x => x.id === p.id)) p.id = Math.random().toString(36).substr(2, 9);
        squad.push(p);
        addInboxMessage('transfer', `👋 Neuzugang: ${p.name}`, `${p.name} (${p.pos}, Stärke ${p.strength}) kommt wie per Vorvertrag vereinbart ablösefrei von ${v.from}.`, 'screen-squad');
    });
}

function renderPreContractBox() {
    const box = document.getElementById('precontract-box');
    if (!box) return;
    const offen = game.preContracts || [];
    const kopf = `<div class="panel-header">📝 VORVERTRÄGE - ABLÖSEFREI ZUR NEUEN SAISON</div>`;
    const unterschrieben = offen.length ? `<div class="box" style="font-size:10px; border-left-color:var(--primary);">✍️ Unterschrieben: ${offen.map(v => `<strong>${v.player.name}</strong> (${v.player.pos}, ${v.player.strength}, von ${v.from})`).join(', ')} - kommen zur neuen Saison.</div>` : '';
    if (game.matchday < PRECONTRACT_START_MD) {
        box.innerHTML = `<div class="panel">${kopf}<div class="box" style="font-size:10px;">Ab dem Winterfenster (Spieltag ${PRECONTRACT_START_MD}) kannst du Spieler verpflichten, deren Vertrag zum Saisonende ausläuft - ohne Ablöse.</div>${unterschrieben}</div>`;
        return;
    }
    const pool = ensurePreContractPool();
    const zeilen = pool.players.map(p => {
        const n = getPreContractTerms(p, 'normal'), d = getPreContractTerms(p, 'doppelt');
        const cn = Math.round(getPreContractChance(p, 'normal') * 100), cd = Math.round(getPreContractChance(p, 'doppelt') * 100);
        return `<div class="box" style="font-size:10px;">
            <div style="display:flex; justify-content:space-between; gap:4px;"><span><strong>${p.name}</strong> (${p.pos}, Stärke ${p.strength}, ${p.age} J.) · ${p.sellerClub}</span>
            <button onclick="openPlayerDetail('${p.id}','precontract')" class="btn-secondary" style="width:auto; padding:3px 7px; font-size:9px;">ℹ️</button></div>
            <div style="color:var(--text-muted);">Gehalt ab neuer Saison ${formatVal(n.gehalt)}/SpT</div>
            ${p.preRefused ? '<div style="color:var(--danger);">Hat abgesagt.</div>' : `<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:4px;">
                <button onclick="offerPreContract('${p.id}','normal')" class="btn-secondary" style="font-size:10px;">Handgeld ${formatVal(n.handgeld)} · ${cn} % Zusage</button>
                <button onclick="offerPreContract('${p.id}','doppelt')" class="btn-action" style="font-size:10px;">Doppelt ${formatVal(d.handgeld)} · ${cd} % Zusage</button></div>`}
        </div>`;
    }).join('');
    box.innerHTML = `<div class="panel">${kopf}
        <div class="box" style="font-size:9px; color:var(--text-muted);">Keine Ablöse - aber Handgeld sofort, 20 % mehr Gehalt, Ankunft erst zur neuen Saison, ein Versuch je Spieler. Andere Vereine schnappen sich Kandidaten, je länger du wartest. Höchstens ${PRECONTRACT_MAX_PENDING} offene Vorverträge.</div>
        ${unterschrieben}${zeilen || '<div class="box" style="font-size:10px;">Alle Kandidaten dieser Saison sind vergeben.</div>'}</div>`;
}
