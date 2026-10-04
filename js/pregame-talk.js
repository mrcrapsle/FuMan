/* eslint-disable no-undef */
// Kabinenansprache vor dem Anpfiff (Phase 22.1): im Spielvorbericht (#prematch-talk-box) wählt
// der Manager eine Ansprache. Wirkung hängt von der LAGE (Favorit / offen / Außenseiter, aus
// eigener Startelf gegen pendingMatchInfo.oppStr) und den CHARAKTEREN der Startelf ab
// (p.character, siehe characterPool in entities.js):
//   fokus  "Keine Überheblichkeit"   - stark als Favorit, ruhige/bescheidene Spieler hören zu
//   mut    "Nichts zu verlieren"      - stark als Außenseiter, als Favorit kontraproduktiv
//   druck  "Heute zählt nur der Sieg" - Ehrgeizige/Selbstbewusste wachsen, Emotionale/Hitzköpfe
//          verkrampfen; nach dem Spiel Sieg Moral +3, Niederlage Moral -4
// Dieselbe Rede dreimal in Folge nutzt sich ab (halber Effekt). Wirkt im Livespiel und bei
// "Nur Ergebnis" (beides über setupMatch -> applyPregameTalk), Liga und Pokal; einmal pro Spiel.

const PREGAME_TALKS = {
    fokus: { label: '🎯 Keine Überheblichkeit', short: 'Konzentration' },
    mut: { label: '🦁 Ihr habt nichts zu verlieren', short: 'Mut' },
    druck: { label: '🔥 Heute zählt nur der Sieg', short: 'Druck' }
};

function getPregameSituation() {
    const elf = squad.filter(p => lineup.includes(p.id));
    const opp = pendingMatchInfo && typeof pendingMatchInfo.oppStr === 'number' ? pendingMatchInfo.oppStr : null;
    if (!elf.length || opp === null) return 'offen';
    const diff = opp - elf.reduce((a, p) => a + p.strength, 0) / elf.length;
    return diff < -4 ? 'favorit' : (diff > 4 ? 'aussenseiter' : 'offen');
}

function getCharacterShares() {
    const elf = squad.filter(p => lineup.includes(p.id));
    const anteil = arten => elf.length ? elf.filter(p => arten.includes(p.character)).length / elf.length : 0;
    return {
        ruhig: anteil(['Ruhig', 'Bescheiden']),
        feurig: anteil(['Emotional', 'Ehrgeizig']),
        stark: anteil(['Ehrgeizig', 'Selbstbewusst']),
        nervoes: anteil(['Emotional', 'Hitzköpfig']),
        count: kind => elf.filter(p => p.character === kind).length
    };
}

function isPregameTalkWornOut(type) {
    const h = game.pregameTalkHistory || [];
    return h.length >= 2 && h.slice(-2).every(t => t === type);
}

function computePregameTalkBonus(type, situation = getPregameSituation()) {
    const c = getCharacterShares();
    let b = 0;
    if (type === 'fokus') b = { favorit: 1.5, offen: 0.75, aussenseiter: 0 }[situation] + c.ruhig;
    else if (type === 'mut') b = { favorit: -1, offen: 0.75, aussenseiter: 2 }[situation] + c.feurig;
    else if (type === 'druck') b = 0.5 + 2.5 * c.stark - 2.5 * c.nervoes;
    if (isPregameTalkWornOut(type)) b /= 2;
    return Math.round(b * 10) / 10;
}

function getPendingPregameTalk() {
    const t = game.pregameTalk;
    return t && t.season === game.season && t.matchday === game.matchday && !t.used ? t : null;
}

function choosePregameTalk(type) {
    if (!PREGAME_TALKS[type]) return;
    if (!pendingMatchInfo) { showToast('Gerade steht kein Spiel an.', 'error'); return; }
    if (getPendingPregameTalk()) { showToast('Die Ansprache ist schon gehalten - die Mannschaft ist auf dem Weg zum Platz.', 'error'); return; }
    const situation = getPregameSituation();
    game.pregameTalk = { season: game.season, matchday: game.matchday, type, situation, bonus: computePregameTalkBonus(type, situation), used: false };
    playSound('click');
    renderPregameTalkBox();
}

// setupMatch(), nach dem Ticker-Start.
function applyPregameTalk() {
    const t = getPendingPregameTalk();
    if (!t || !currentMatch) return;
    t.used = true;
    currentMatch.pregameTalk = t.type;
    if (!game.pregameTalkHistory) game.pregameTalkHistory = [];
    game.pregameTalkHistory.push(t.type);
    if (game.pregameTalkHistory.length > 5) game.pregameTalkHistory.shift();
    currentMatch.ourBaseStr += t.bonus;
    if (currentMatch.isHome) currentMatch.homeStr += t.bonus; else currentMatch.awayStr += t.bonus;
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += `<div style="color:${t.bonus >= 0 ? 'var(--primary)' : 'var(--danger)'};">🗣️ Kabinenansprache „${PREGAME_TALKS[t.type].short}“: ${t.bonus >= 0 ? '+' : ''}${String(t.bonus).replace('.', ',')} Stärke.</div>`;
}

// endMatchSimulation(): Folgen der Druck-Rede.
function resolvePregameTalk() {
    if (!currentMatch || currentMatch.pregameTalk !== 'druck' || currentMatch.pregameTalkResolved) return;
    currentMatch.pregameTalkResolved = true;
    const wir = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
    const die = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
    const log = document.getElementById('ticker-log');
    if (wir > die) {
        squad.forEach(p => { p.morale = Math.min(100, (p.morale || 50) + 3); });
        if (log) log.innerHTML += '<div style="color:var(--primary);">🔥 Der Druck hat sich ausgezahlt: Moral +3.</div>';
    } else if (wir < die) {
        squad.forEach(p => { p.morale = Math.max(0, (p.morale || 50) - 4); });
        if (log) log.innerHTML += '<div style="color:var(--danger);">🔥 Der Druck hat erdrückt: Moral -4.</div>';
    }
}

function renderPregameTalkBox() {
    const box = document.getElementById('prematch-talk-box');
    if (!box) return;
    if (!pendingMatchInfo) { box.innerHTML = ''; return; }
    const situation = getPregameSituation();
    const c = getCharacterShares();
    const lage = { favorit: 'Ihr seid Favorit', offen: 'Das Spiel ist offen', aussenseiter: 'Ihr seid Außenseiter' }[situation];
    const t = getPendingPregameTalk();
    const knopf = type => {
        const gewaehlt = t && t.type === type;
        const alt = isPregameTalkWornOut(type) ? ' <span style="font-size:8px; opacity:0.8;">(kennen sie schon)</span>' : '';
        return `<button onclick="choosePregameTalk('${type}')" class="${gewaehlt ? 'btn-action' : 'btn-secondary'}" style="font-size:10px; margin-bottom:4px;">${gewaehlt ? '✔ ' : ''}${PREGAME_TALKS[type].label}${alt}</button>`;
    };
    box.innerHTML = `<div class="panel"><div class="panel-header">🗣️ KABINENANSPRACHE VOR DEM ANPFIFF</div>
        <div class="box" style="font-size:10px;">${lage}. In der Startelf: ${c.count('Ruhig') + c.count('Bescheiden')} ruhige/bescheidene, ${c.count('Ehrgeizig') + c.count('Selbstbewusst')} ehrgeizige/selbstbewusste, ${c.count('Emotional') + c.count('Hitzköpfig')} emotionale/hitzköpfige Spieler.
            <div style="color:var(--text-muted); margin-top:2px;">Konzentration wirkt als Favorit, Mut als Außenseiter, Druck spaltet: Ehrgeizige wachsen, Hitzköpfe verkrampfen - und nach einer Niederlage kostet er Moral.</div></div>
        ${knopf('fokus')}${knopf('mut')}${knopf('druck')}
        ${t ? `<div style="font-size:10px; color:${t.bonus >= 0 ? 'var(--primary)' : 'var(--danger)'}; margin-top:2px;">Wirkung heute: ${t.bonus >= 0 ? '+' : ''}${String(t.bonus).replace('.', ',')} Stärke</div>` : '<div style="font-size:10px; color:var(--text-muted);">Ohne Ansprache geht die Mannschaft ohne Extra-Impuls aufs Feld.</div>'}
    </div>`;
}
