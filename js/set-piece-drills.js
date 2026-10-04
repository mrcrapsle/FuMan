/* eslint-disable no-undef */
// Standards einstudieren (Phase 22.3): "Standards" ist eine echte Einheit im Wochenplan
// (vorher schrieben die Vorlagen Technik/Taktik einen Tag "standards", den es nicht gab).
// Jeder Standards-Tag bringt der gewählten Variante (game.setPieceDrills.focus) pro Spieltag
// Übung; alle anderen Varianten verblassen langsam. Die Beherrschung (0-100) wirkt im
// Livespiel (js/set-pieces.js) und bei Ecken (simulateMatchStep):
//   direkt   +6 Prozentpunkte Torchance beim direkten Freistoß
//   flanke   +5 Punkte und halbes Konterrisiko
//   kurz     +6 Punkte (aus 4 % werden bis zu 10 %)
//   elfmeter +6 Punkte Trefferquote
//   ecke     +0,8 Punkte Torchance je Spielzug mit Ecke
// Preis: jeder Standards-Tag fehlt Taktik, Technik oder Kondition.

const SET_PIECE_DRILLS = {
    direkt: { label: 'Direkter Freistoß', icon: '🎯', wirkung: '+6 % Torchance' },
    flanke: { label: 'Freistoßflanke', icon: '🔝', wirkung: '+5 % Torchance, halbes Konterrisiko' },
    kurz: { label: 'Kurz ausgeführt', icon: '↪️', wirkung: '+6 % Torchance' },
    elfmeter: { label: 'Elfmeter', icon: '❗', wirkung: '+6 % Trefferquote' },
    ecke: { label: 'Ecken', icon: '🚩', wirkung: 'mehr Gefahr bei jeder Ecke' }
};
const DRILL_GAIN_PER_DAY = 10;
const DRILL_DECAY = 2;

function ensureSetPieceDrills() {
    if (!game.setPieceDrills || !game.setPieceDrills.mastery) {
        game.setPieceDrills = { focus: 'direkt', mastery: { direkt: 0, flanke: 0, kurz: 0, elfmeter: 0, ecke: 0 } };
    }
    return game.setPieceDrills;
}

function getDrillMastery(key) {
    const d = ensureSetPieceDrills();
    return Math.max(0, Math.min(100, d.mastery[key] || 0)) / 100;
}

function countStandardsDays() {
    return Object.values(game.weeklyTrainingPlan || {}).filter(t => t === 'standards').length;
}

function getDrillGainPerMatchday() {
    const tage = countStandardsDays();
    if (!tage) return 0;
    const coach = staffMembers.setPieceCoach && staffMembers.setPieceCoach.hired ? 1.5 : 1;
    return Math.round(tage * DRILL_GAIN_PER_DAY * coach);
}

// Nach jedem Spieltag (processPostMatchRoutine).
function tickSetPieceDrills() {
    const d = ensureSetPieceDrills();
    const plus = getDrillGainPerMatchday();
    Object.keys(SET_PIECE_DRILLS).forEach(k => {
        if (k === d.focus && plus > 0) d.mastery[k] = Math.min(100, (d.mastery[k] || 0) + plus);
        else d.mastery[k] = Math.max(0, (d.mastery[k] || 0) - DRILL_DECAY);
    });
}

function setSetPieceDrillFocus(key) {
    if (!SET_PIECE_DRILLS[key]) return;
    ensureSetPieceDrills().focus = key;
    playSound('click');
    if (!countStandardsDays()) showToast(`${SET_PIECE_DRILLS[key].label} ist das Ziel - aber ohne Standards-Tag im Wochenplan wird nichts geübt.`, 'error', 4500);
    renderSetPieceDrillBox();
}

function drillTag(key) {
    const m = Math.round(getDrillMastery(key) * 100);
    return m >= 10 ? ` · einstudiert ${m} %` : '';
}

function renderSetPieceDrillBox() {
    const box = document.getElementById('setpiece-drill-box');
    if (!box) return;
    const d = ensureSetPieceDrills();
    const tage = countStandardsDays();
    const plus = getDrillGainPerMatchday();
    const zeilen = Object.entries(SET_PIECE_DRILLS).map(([k, v]) => {
        const m = Math.round(getDrillMastery(k) * 100);
        const aktiv = d.focus === k;
        return `<button onclick="setSetPieceDrillFocus('${k}')" class="${aktiv ? 'btn-action' : 'btn-secondary'}" style="text-align:left; font-size:10px; margin-bottom:3px;">
            ${aktiv ? '✔ ' : ''}${v.icon} ${v.label} · <strong>${m} %</strong> <span style="font-size:9px; opacity:0.8;">(${v.wirkung} bei 100 %)</span>
            <div style="height:4px; background:rgba(255,255,255,0.08); border-radius:2px; margin-top:2px;"><div style="height:4px; width:${m}%; background:var(--accent); border-radius:2px;"></div></div></button>`;
    }).join('');
    box.innerHTML = `<div class="box" style="font-size:10px;">🚩 <strong>Standards einstudieren:</strong> ${tage
        ? `${tage} Standards-Tag${tage > 1 ? 'e' : ''} im Wochenplan - die gewählte Variante gewinnt ${plus} Punkte pro Spieltag.`
        : '<span style="color:var(--accent);">Kein Standards-Tag im Wochenplan - setze oben einen Tag auf „🚩 Standards“.</span>'}
        <div style="color:var(--text-muted); margin-top:2px;">Nicht geübte Varianten verlieren ${DRILL_DECAY} Punkte pro Spieltag. Jeder Standards-Tag fehlt Taktik, Technik oder Kondition.</div></div>${zeilen}`;
}
