/* eslint-disable no-undef */
// Co-Trainer im Livespiel (Phase 21.3): nach jeder Szene prüft der Co-Trainer (staffMembers.
// coTrainer) den ECHTEN Spielstand und meldet sich mit genau einem Hinweis samt Ein-Tipp-
// Aktion in #live-cotrainer-box (jede Hinweisart höchstens einmal pro Spiel, Abstand >= 15 Min.).
// Was er erkennt, hängt von seiner Ausbaustufe ab (getStaffLevelMultiplier):
//   Stufe 1: müde Spieler (ab 55.), Rückstand spät (Brechstange), knappe Führung spät (Bus)
//   Stufe 2: + Gelb-Rot-Gefahr, + Taktik-Duell verloren (ab 20. Min., mit Chef-Analyst sofort)
//   Stufe 3: + Taktik-Duell gewinnbar (neutraler Stil, Konterstil bringt +2)
// Seine Laune (getStaffEffectivenessMultiplier) bestimmt, wie zuverlässig er sich meldet.
// Folgen/Ignorieren zählt in game.coTrainerHistory (liveFollowed/liveIgnored); Folgen hebt
// das Vertrauen (game.coTrainerTrust) um 1. Jede Aktion nutzt die normalen Livespiel-Wege
// (makeLiveSubstitution, liveSetTackleHardness, liveSetTacticStyle, setLiveShout) - also
// mit allen echten Kosten (Wechselkontingent, Stärke, Gegentorrisiko).

const COTRAINER_HINT_GAP = 15;
const COTRAINER_STYLE_FOR_ARCH = { P: 'pressing', B: 'ballbesitz', K: 'konter' };
let coTrainerActiveHint = null;

function getCoTrainerLiveLevel() {
    if (!staffMembers.coTrainer || !staffMembers.coTrainer.hired) return 0;
    return Math.max(1, Math.min(3, typeof getStaffLevelMultiplier === 'function' ? getStaffLevelMultiplier('coTrainer') : 1));
}

function resetCoTrainerLive() {
    coTrainerActiveHint = null;
    const box = document.getElementById('live-cotrainer-box');
    if (box) box.innerHTML = '';
}

function coTrainerScore() {
    const unsere = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
    const deren = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
    return { unsere, deren };
}

function coTrainerOnPitch() {
    return squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id));
}

// Bester Bankspieler für einen Wechsel (gleiche Position bevorzugt, einsatzfähig).
function coTrainerBestBench(aus) {
    const bank = squad.filter(p => !lineup.includes(p.id) && (p.injured || 0) === 0 && (p.suspended || 0) === 0 && p.pos !== 'TW');
    const gleich = bank.filter(p => p.pos === aus.pos);
    const pool = gleich.length ? gleich : bank;
    return pool.sort((a, b) => liveEffectiveStrength(b) - liveEffectiveStrength(a))[0] || null;
}

// Mögliche Hinweise in Prioritätsreihenfolge - nur, was der Spielstand wirklich hergibt.
function findCoTrainerHint() {
    const level = getCoTrainerLiveLevel();
    if (!level || !currentMatch || currentMatch.minute >= 90) return null;
    const used = currentMatch.coHintsUsed || [];
    const min = currentMatch.minute;
    const { unsere, deren } = coTrainerScore();
    const elf = coTrainerOnPitch();
    const frei = id => !used.includes(id);

    if (level >= 2 && frei('karte') && min >= 30 && game.tackleHardness !== 'vorsichtig') {
        const verwarnt = elf.find(p => (currentMatch.yellowCards[p.id] || 0) >= 1);
        if (verwarnt) {
            const ersatz = substitutionsLeft > 0 ? coTrainerBestBench(verwarnt) : null;
            return { id: 'karte', text: `${verwarnt.name} ist verwarnt - noch ein Foul und wir sind zu zehnt. Härte runter${ersatz ? ` oder ${ersatz.name} bringen` : ''}?`,
                actions: [{ label: '🕊️ Härte: vorsichtig', run: () => liveSetTackleHardness('vorsichtig') }]
                    .concat(ersatz ? [{ label: `🔄 ${ersatz.name} für ${verwarnt.name}`, run: () => coTrainerSubstitute(verwarnt.id, ersatz.id) }] : []) };
        }
    }
    const oppArch = currentMatch.oppTacticArch;
    const kennt = level >= 2 && (min >= 20 || (staffMembers.analyst && staffMembers.analyst.hired));
    if (kennt && oppArch && typeof getTacticMatchupBonus === 'function') {
        const jetzt = getTacticMatchupBonus(oppArch);
        const zielArch = getCounterArchetype(oppArch);
        const stil = zielArch ? COTRAINER_STYLE_FOR_ARCH[zielArch] : null;
        if (stil && frei('taktik') && jetzt < 0) {
            return { id: 'taktik', text: `Der Gegner spielt ${ARCHETYPE_LABELS[oppArch]} - unser Stil läuft ins offene Messer (-2). Mit ${stil} drehen wir das (+2).`,
                actions: [{ label: `🧠 Auf ${stil} umstellen`, run: () => liveSetTacticStyle(stil) }] };
        }
        if (stil && level >= 3 && frei('taktik') && jetzt === 0) {
            return { id: 'taktik', text: `Ich habe den Gegner durchschaut: ${ARCHETYPE_LABELS[oppArch]}. Mit ${stil} wären wir einen Schritt voraus (+2).`,
                actions: [{ label: `🧠 Auf ${stil} umstellen`, run: () => liveSetTacticStyle(stil) }] };
        }
    }
    if (frei('muede') && min >= 55 && substitutionsLeft > 0) {
        const kandidat = elf.filter(p => p.pos !== 'TW' && (p.fitness ?? 100) < 80).sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100))[0];
        const ersatz = kandidat ? coTrainerBestBench(kandidat) : null;
        if (kandidat && ersatz && liveEffectiveStrength(ersatz) >= liveEffectiveStrength(kandidat) * 0.95) {
            return { id: 'muede', text: `${kandidat.name} baut ab (${kandidat.fitness}% Fitness). ${ersatz.name} bringt frische Beine.`,
                actions: [{ label: `🔄 ${ersatz.name} für ${kandidat.name}`, run: () => coTrainerSubstitute(kandidat.id, ersatz.id) }] };
        }
    }
    if (frei('rueckstand') && min >= 70 && unsere < deren && activeLiveShout !== 'brechstange') {
        return { id: 'rueckstand', text: `${deren - unsere === 1 ? 'Ein Tor' : 'Zwei Tore'} fehlen noch - alles nach vorn? Hinten wird es dann offen.`,
            actions: [{ label: '💥 Brechstange', run: () => setLiveShout('brechstange') }] };
    }
    if (frei('fuehrung') && min >= 78 && unsere - deren === 1 && activeLiveShout !== 'bus') {
        return { id: 'fuehrung', text: 'Nur ein Tor Vorsprung - sollen wir das jetzt über die Zeit bringen?',
            actions: [{ label: '🛡️ Bus parken', run: () => setLiveShout('bus') }] };
    }
    return null;
}

// Nach jeder Szene (simulateMatchStep).
function tickCoTrainerLive() {
    if (!currentMatch) return;
    if (currentMatch.minute >= 90) { resetCoTrainerLive(); coTrainerActiveHint = null; return; }
    if (coTrainerActiveHint) return; // ein offener Hinweis wartet noch
    if (currentMatch.lastCoHintMinute !== undefined && currentMatch.minute - currentMatch.lastCoHintMinute < COTRAINER_HINT_GAP) return;
    const zuverlaessig = typeof getStaffEffectivenessMultiplier === 'function' ? getStaffEffectivenessMultiplier('coTrainer') : 1;
    if (Math.random() > zuverlaessig) return;
    const hint = findCoTrainerHint();
    if (!hint) return;
    currentMatch.coHintsUsed = (currentMatch.coHintsUsed || []).concat(hint.id);
    currentMatch.lastCoHintMinute = currentMatch.minute;
    coTrainerActiveHint = hint;
    const log = document.getElementById('ticker-log');
    if (log) { log.innerHTML += `<div style="color:var(--teal);">🧑‍🏫 ${currentMatch.minute}. Min, Co-Trainer: ${hint.text}</div>`; log.scrollTop = log.scrollHeight; }
    renderCoTrainerLiveBox();
}

// Bilanz pro Livespiel (25.25): Spiele mit mindestens einem befolgten Hinweis gegen Spiele ohne
// (dort hat der Co-Trainer nichts umgesetzt). Nur für Livespiele aus processPostMatchRoutine().
function recordLiveCoTrainerMatch(matchResult, match) {
    if (!match || matchResult === null || matchResult === undefined) return;
    const hist = coTrainerHistory();
    const gewonnen = matchResult === 'win';
    if ((match.coTrainerFollowed || 0) > 0) {
        hist.liveMatchesFollowed = (hist.liveMatchesFollowed || 0) + 1;
        if (gewonnen) hist.liveFollowedWins = (hist.liveFollowedWins || 0) + 1;
    } else {
        hist.liveMatchesOwn = (hist.liveMatchesOwn || 0) + 1;
        if (gewonnen) hist.liveOwnWins = (hist.liveOwnWins || 0) + 1;
    }
}

// Zeile für den Co-Trainer-Bereich; leer, solange noch kein Livespiel gewertet ist.
function coTrainerLiveBilanzText(h) {
    const gefolgt = h.liveMatchesFollowed || 0, eigen = h.liveMatchesOwn || 0;
    if (!gefolgt && !eigen) return '';
    if (typeof currentLang !== 'undefined' && currentLang === 'en') {
        return `<br>Live match record: with followed hints ${h.liveFollowedWins || 0}/${gefolgt} wins, without a followed hint ${h.liveOwnWins || 0}/${eigen} wins`;
    }
    return `<br>Livespiel-Bilanz: mit befolgten Hinweisen ${h.liveFollowedWins || 0}/${gefolgt} Siege, ohne befolgten Hinweis ${h.liveOwnWins || 0}/${eigen} Siege`;
}

function renderCoTrainerLiveBox() {
    const box = document.getElementById('live-cotrainer-box');
    if (!box) return;
    const h = coTrainerActiveHint;
    if (!h) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--teal); margin:4px 0;">🧑‍🏫 <strong>Co-Trainer:</strong> ${h.text}
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
            ${h.actions.map((a, i) => `<button onclick="followCoTrainerHint(${i})" class="btn-action" style="width:auto; font-size:10px;">${a.label}</button>`).join('')}
            <button onclick="ignoreCoTrainerHint()" class="btn-secondary" style="width:auto; font-size:10px;">Nein danke</button>
        </div></div>`;
}

function coTrainerHistory() {
    if (!game.coTrainerHistory) game.coTrainerHistory = { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 };
    return game.coTrainerHistory;
}

function followCoTrainerHint(i) {
    const h = coTrainerActiveHint;
    if (!h || !currentMatch || currentMatch.minute >= 90) { showToast('Dieser Hinweis ist nicht mehr aktuell.', 'error'); coTrainerActiveHint = null; renderCoTrainerLiveBox(); return; }
    const aktion = h.actions[i];
    if (!aktion) return;
    aktion.run();
    const hist = coTrainerHistory();
    hist.liveFollowed = (hist.liveFollowed || 0) + 1;
    if (currentMatch) currentMatch.coTrainerFollowed = (currentMatch.coTrainerFollowed || 0) + 1;
    game.coTrainerTrust = Math.min(100, (game.coTrainerTrust ?? 66) + 1);
    coTrainerActiveHint = null;
    renderCoTrainerLiveBox();
}

function ignoreCoTrainerHint() {
    if (!coTrainerActiveHint) return;
    const hist = coTrainerHistory();
    hist.liveIgnored = (hist.liveIgnored || 0) + 1;
    coTrainerActiveHint = null;
    renderCoTrainerLiveBox();
}

// Wechsel über den normalen Livespiel-Weg (Auswahlfeld "Raus" setzen, dann einwechseln).
function coTrainerSubstitute(outId, inId) {
    if (substitutionsLeft <= 0) { showToast('Kein Wechsel mehr übrig.', 'error'); return; }
    const sel = document.getElementById('live-sub-out');
    if (!sel) { showToast('Wechsel gerade nicht möglich.', 'error'); return; }
    sel.value = String(outId);
    makeLiveSubstitution(inId);
}
