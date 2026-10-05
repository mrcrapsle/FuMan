/* eslint-disable no-undef */
// Gerüchteküche (Phase 22.8): nach Spieltagen tauchen Transfergerüchte auf (game.rumors,
// höchstens 3 offene). Jede Quelle hat eine echte, verdeckte Trefferquote - wie oft sie recht
// hatte, zählt game.rumorStats mit (so lernt man, wem man trauen kann).
//   abwerbung   "Verein X will deinen Spieler Y" - stimmt es, kommt nach 1-3 Spieltagen ein
//               echtes Angebot von X. Reaktion:
//               dementieren  wahres Gerücht: X zieht zu 50 % zurück; Ehrgeizige/Selbstbewusste
//                            Moral -5, alle anderen +3 (fühlen sich wertgeschätzt)
//               anheizen     wahres Gerücht: Angebot 15 % höher; Spieler Moral -3 (fühlt sich
//                            weggeschoben); Ente: zusätzlich Medienimage -2
//               schweigen    nichts
//   markt       "Marktspieler Z wechselt bald zu X" - stimmt es, ist Z nach 2 Spieltagen weg
//               (kaufen oder verlieren - aber Enten gibt es auch).

const RUMOR_SOURCES = {
    boulevard: { label: '📰 Boulevardblatt', truth: 0.3 },
    blog: { label: '💻 Insider-Blog', truth: 0.5 },
    fach: { label: '📘 Fachmagazin', truth: 0.75 }
};
const RUMOR_MAX_OPEN = 3;
const RUMOR_CHANCE = 0.3;

function rumorStatsFor(src) {
    if (!game.rumorStats) game.rumorStats = {};
    if (!game.rumorStats[src]) game.rumorStats[src] = { hit: 0, miss: 0 };
    return game.rumorStats[src];
}

function pickRumorSource() {
    const r = Math.random();
    return r < 0.45 ? 'boulevard' : r < 0.8 ? 'blog' : 'fach';
}

function createRumor() {
    const src = pickRumorSource();
    const wahr = Math.random() < RUMOR_SOURCES[src].truth;
    const offen = (game.rumors || []).filter(x => !x.outcome);
    const schwelle = typeof getTransferInterestThreshold === 'function' ? getTransferInterestThreshold() : 0;
    const kandidaten = squad.filter(p => p.strength >= schwelle && !incomingOffers.some(o => o.playerId === p.id) && !offen.some(x => x.playerId === p.id));
    const markt = (marketPlayers || []).filter(p => !offen.some(x => x.playerId === p.id));
    const club = typeof pickRandomOpposingClubName === 'function' ? pickRandomOpposingClubName(true) : 'Ein Konkurrent';
    const base = { id: 'rum_' + Math.random().toString(36).substr(2, 7), source: src, truth: wahr, club, created: game.matchday, season: game.season, reaction: null, outcome: null };
    if (kandidaten.length && (Math.random() < 0.6 || !markt.length)) {
        const p = kandidaten[Math.floor(Math.random() * kandidaten.length)];
        return Object.assign(base, { type: 'abwerbung', playerId: p.id, playerName: p.name, resolveAt: game.matchday + 1 + Math.floor(Math.random() * 3) });
    }
    if (!markt.length) return null;
    const p = markt[Math.floor(Math.random() * markt.length)];
    return Object.assign(base, { type: 'markt', playerId: p.id, playerName: p.name, resolveAt: game.matchday + 2 });
}

// Jeden Spieltag (processPostMatchRoutine): fällige Gerüchte auflösen, neue streuen.
function tickRumors() {
    if (!game.rumors) game.rumors = [];
    game.rumors.forEach(r => { if (!r.outcome && (r.season !== game.season || game.matchday >= r.resolveAt)) resolveRumor(r); });
    if (game.rumors.filter(r => !r.outcome).length < RUMOR_MAX_OPEN && game.matchday < 34 && Math.random() < RUMOR_CHANCE) {
        const r = createRumor();
        if (r) {
            game.rumors.unshift(r);
            const text = r.type === 'abwerbung' ? `${r.club} soll an ${r.playerName} interessiert sein.` : `${r.playerName} (Transfermarkt) soll kurz vor einem Wechsel zu ${r.club} stehen.`;
            addInboxMessage('transfer', `🗞️ Gerücht: ${r.playerName}`, `${RUMOR_SOURCES[r.source].label} berichtet: ${text}`, 'screen-transfer');
        }
    }
    game.rumors = game.rumors.filter(r => !r.outcome || game.rumors.indexOf(r) < 8);
}

function resolveRumor(r) {
    const stats = rumorStatsFor(r.source);
    if (!r.truth) {
        r.outcome = 'ente';
        stats.miss++;
        if (r.type === 'abwerbung' && r.reaction === 'anheizen' && typeof changeMediaImage === 'function') changeMediaImage(-2);
        return;
    }
    stats.hit++;
    if (r.type === 'markt') {
        const idx = marketPlayers.findIndex(p => p.id === r.playerId);
        if (idx === -1) { r.outcome = 'erledigt'; return; }
        const p = marketPlayers[idx];
        marketPlayers.splice(idx, 1);
        if (typeof transferPoker !== 'undefined' && transferPoker && transferPoker.playerId === p.id) transferPoker = null;
        if (typeof addAiTransferNews === 'function') addAiTransferNews({ player: p.name, pos: p.pos, strength: p.strength, from: p.sellerClub || 'Transfermarkt', to: r.club, fee: p.askingPrice || p.marketValue, fromLeague: game.leagueLevel, toLeague: game.leagueLevel });
        addInboxMessage('transfer', `🗞️ Gerücht bestätigt: ${p.name} ist weg`, `${p.name} wechselt zu ${r.club} - ${RUMOR_SOURCES[r.source].label} lag richtig.`, 'screen-transfer');
        r.outcome = 'wahr';
        return;
    }
    const p = squad.find(x => x.id === r.playerId);
    if (!p) { r.outcome = 'erledigt'; return; }
    if (r.reaction === 'dementieren' && r.backedOff) {
        r.outcome = 'zurueckgezogen';
        addInboxMessage('transfer', `🗞️ ${r.club} zieht zurück`, `Nach deinem Dementi verzichtet ${r.club} auf ein Angebot für ${p.name}.`, 'screen-transfer');
        return;
    }
    const mult = ((managerRPG && managerRPG.perks && managerRPG.perks.negotiator ? 1.05 : 0.85) + Math.random() * 0.35) * (r.reaction === 'anheizen' ? 1.15 : 1);
    if (typeof triggerNewAITransferOffer === 'function') triggerNewAITransferOffer(p, { club: r.club, multiplier: mult });
    r.outcome = 'wahr';
}

function reactToRumor(id, art) {
    const r = (game.rumors || []).find(x => x.id === id);
    if (!r || r.outcome || r.type !== 'abwerbung') { showToast('Zu diesem Gerücht gibt es nichts mehr zu sagen.', 'error'); return; }
    if (r.reaction) { showToast('Du hast dich dazu schon geäußert.', 'error'); return; }
    const p = squad.find(x => x.id === r.playerId);
    if (!p) { showToast('Der Spieler ist nicht mehr im Kader.', 'error'); return; }
    r.reaction = art;
    let text;
    if (art === 'dementieren') {
        const wechselwillig = ['Ehrgeizig', 'Selbstbewusst'].includes(p.character);
        p.morale = Math.max(0, Math.min(100, (p.morale || 50) + (wechselwillig ? -5 : 3)));
        r.backedOff = r.truth && Math.random() < 0.5;
        text = `„${p.name} ist unverkäuflich.“ ${wechselwillig ? `${p.name} hätte gern mit ${r.club} gesprochen (Moral -5).` : `${p.name} fühlt sich wertgeschätzt (Moral +3).`}`;
    } else if (art === 'anheizen') {
        p.morale = Math.max(0, (p.morale || 50) - 3);
        text = `„Für das richtige Angebot reden wir.“ Ein Angebot fiele höher aus - ${p.name} fühlt sich aber weggeschoben (Moral -3).`;
    } else {
        text = 'Kein Kommentar.';
    }
    playSound('click');
    showToast(`🗞️ ${text}`, art === 'schweigen' ? 'success' : 'info', 4500);
    renderRumorBox();
}

function renderRumorBox() {
    const box = document.getElementById('rumor-box');
    if (!box) return;
    const liste = game.rumors || [];
    if (!liste.length) { box.innerHTML = ''; return; }
    const quote = src => { const s = rumorStatsFor(src); const n = s.hit + s.miss; return n ? ` · lag ${s.hit} von ${n} Mal richtig` : ''; };
    const ausgang = { ente: '🦆 Ente', wahr: '✅ bestätigt', zurueckgezogen: '↩️ Interesse zurückgezogen', erledigt: '– erledigt' };
    box.innerHTML = `<div class="panel"><div class="panel-header">🗞️ GERÜCHTEKÜCHE</div>
        ${liste.map(r => {
            const text = r.type === 'abwerbung' ? `${r.club} will <strong>${r.playerName}</strong>` : `<strong>${r.playerName}</strong> (Markt) vor Wechsel zu ${r.club}`;
            const knoepfe = r.type === 'abwerbung' && !r.outcome && !r.reaction ? `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; margin-top:4px;">
                <button onclick="reactToRumor('${r.id}','dementieren')" class="btn-secondary" style="font-size:9px;">🙅 Dementieren</button>
                <button onclick="reactToRumor('${r.id}','anheizen')" class="btn-secondary" style="font-size:9px;">🔥 Anheizen</button>
                <button onclick="reactToRumor('${r.id}','schweigen')" class="btn-secondary" style="font-size:9px;">🤐 Schweigen</button></div>` : '';
            const status = r.outcome ? ausgang[r.outcome] : (r.reaction ? `Deine Reaktion: ${r.reaction}` : 'offen');
            return `<div class="box" style="font-size:10px;">${text}
                <div style="color:var(--text-muted);">${RUMOR_SOURCES[r.source].label}${quote(r.source)} · ${status}</div>${knoepfe}</div>`;
        }).join('')}
        <div style="font-size:8px; color:var(--text-muted);">Dementieren: ein interessierter Verein zieht oft zurück, Ehrgeizige ärgert das. Anheizen: ein echtes Angebot fällt 15 % höher aus, bei einer Ente leidet dein Ruf.</div></div>`;
}
