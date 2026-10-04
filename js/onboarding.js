/* eslint-disable no-undef */
// Einstieg & Hilfe: "Erste Schritte"-Checkliste auf dem Dashboard für die erste Saison
// (hakt sich beim Spielen selbst ab) und kurze, ausblendbare Tipps oben auf den
// wichtigsten Bildschirmen. Zustand in game.onboarding.

const ONBOARDING_STEPS = [
    { key: 'kader', label: 'Kader und Aufstellung ansehen', screen: 'screen-squad' },
    { key: 'training', label: 'Trainingsschwerpunkt festlegen', screen: 'screen-training' },
    { key: 'finanzen', label: 'Finanzen und Sponsoren prüfen', screen: 'screen-finances' },
    { key: 'transfer', label: 'Transfermarkt durchsehen', screen: 'screen-transfer' },
    { key: 'spiel', label: 'Erstes Ligaspiel bestreiten', screen: 'screen-dashboard' },
    { key: 'speichern', label: 'Spielstand speichern (💾 unten rechts)', screen: null }
];

const SCREEN_HINTS = {
    'screen-squad': 'Die Startelf zählt: Stärke × Fitness × Tagesform. „Trainer stellt Top-Elf auf“ wählt automatisch die fitteste starke Elf. Formation und Spielstil ändern Angriff, Abwehr und Kraftverbrauch.',
    'screen-transfer': 'Angebote für deine Spieler findest du unter „Angebote“. Neue Spieler gibt es im Transfermarkt (10 pro Fenster) - die Ablöse lässt sich mit 🃏 Verhandeln drücken, Sofortkauf zahlt die Forderung -, ablösefrei bei den Vereinslosen oder auf Leihbasis. Achte auf das Gehaltsbudget.',
    'screen-finances': 'Jede Einnahme und Ausgabe steht im Buchungsjournal. Im Minus gilt eine Transfersperre; anhaltende Verluste bestraft das Financial Fairplay bis hin zum Punktabzug. Sponsoren-Angebote kannst du nachverhandeln.',
    'screen-training': 'Der Wochenschwerpunkt wirkt nach jedem Spieltag: Kondition hilft der Fitness, Taktik sicher der Teamstärke, Match-Prep noch mehr - wenn du den Stil des nächsten Gegners richtig tippst, Erholung senkt das Verletzungsrisiko.',
    'screen-stadium': 'Stadionausbau wird voll bezahlt, wenn er beginnt, und ist nach einigen Spieltagen fertig. Für den Aufstieg brauchst du Lizenzauflagen (z. B. Flutlicht für die 3. Liga) - die Übersicht steht hier.',
    'screen-inbox': 'Im Postfach landen alle Ereignisse. Der Link in jeder Nachricht führt direkt zum passenden Bildschirm.',
    'screen-league': 'Platz 1-2 steigt direkt auf, Platz 3 spielt Relegation. Die letzten zwei steigen ab, Platz 16 muss in die Relegation.'
};

function ensureOnboarding() {
    if (!game.onboarding) game.onboarding = { done: {}, hidden: !(game.season === 1 && game.matchday <= 3), hints: {} };
    if (!game.onboarding.hints) game.onboarding.hints = {};
    return game.onboarding;
}

function markOnboardingStep(key) {
    const ob = ensureOnboarding();
    if (ob.done[key] || ob.finished) return;
    ob.done[key] = true;
    if (ONBOARDING_STEPS.every(s => ob.done[s.key])) {
        ob.finished = true;
        if (typeof addManagerXP === 'function') addManagerXP(200);
        showToast('🎓 Erste Schritte geschafft! +200 Manager-XP', 'success', 4500);
        addInboxMessage('vertrag', '🎓 Einstieg geschafft', 'Du kennst jetzt die wichtigsten Bereiche. Tipp: Das volle Menü (☰ oben links) enthält Stadion, Jugend, Scouting, Personal und mehr.', 'screen-dashboard');
    }
}

// Aus showScreen(): Besuch abhaken und den Tipp des Bildschirms einblenden.
function onScreenShown(screenId) {
    if (typeof selbsttestLaeuft !== 'undefined' && selbsttestLaeuft) return;
    const ob = ensureOnboarding();
    ONBOARDING_STEPS.forEach(s => { if (s.screen === screenId && s.key !== 'spiel') markOnboardingStep(s.key); });
    if (screenId === 'screen-sponsors') markOnboardingStep('finanzen');
    if (game.matchday > 1 || game.season > 1) markOnboardingStep('spiel');
    const screen = document.getElementById(screenId);
    if (!screen) return;
    let hint = screen.querySelector(':scope > .screen-hint');
    const text = SCREEN_HINTS[screenId];
    if (!text || ob.hints[screenId] || ob.hints.alle) { if (hint) hint.remove(); return; }
    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'box screen-hint';
        hint.style.cssText = 'font-size:11px; border-left-color:var(--teal); margin-bottom:8px;';
        screen.insertBefore(hint, screen.firstChild);
    }
    hint.innerHTML = `💡 ${text}
        <div style="display:flex; gap:6px; margin-top:6px;">
            <button onclick="hideScreenHint('${screenId}')" class="btn-secondary" style="width:auto;">Verstanden</button>
            <button onclick="hideScreenHint('alle')" class="btn-secondary" style="width:auto;">Alle Tipps aus</button>
            ${typeof hasLexiconEntriesFor === 'function' && hasLexiconEntriesFor(screenId) ? `<button onclick="openLexiconForScreen('${screenId}')" class="btn-secondary" style="width:auto;">📖 Lexikon</button>` : ''}
        </div>`;
}

function hideScreenHint(key) {
    const ob = ensureOnboarding();
    ob.hints[key] = true;
    document.querySelectorAll('.screen-hint').forEach(h => { if (key === 'alle' || h.parentElement.id === key) h.remove(); });
}

function hideOnboardingChecklist() {
    ensureOnboarding().hidden = true;
    renderOnboardingBox();
}

function renderOnboardingBox() {
    const box = document.getElementById('dash-onboarding-box');
    if (!box) return;
    const ob = ensureOnboarding();
    if (game.matchday > 1 || game.season > 1) ob.done.spiel = true;
    if (ob.hidden || ob.finished) { box.innerHTML = ''; return; }
    const erledigt = ONBOARDING_STEPS.filter(s => ob.done[s.key]).length;
    box.innerHTML = `<div class="box" style="font-size:11px; border-left-color:var(--teal); margin-bottom:6px;">
        🎓 <strong>Erste Schritte</strong> (${erledigt}/${ONBOARDING_STEPS.length})
        ${ONBOARDING_STEPS.map(s => `<div style="margin-top:4px;">${ob.done[s.key] ? '✅' : '⬜'} ${s.screen && !ob.done[s.key] && s.screen !== 'screen-dashboard'
            ? `<a href="#" onclick="showScreen('${s.screen}'); return false;" style="color:var(--teal);">${s.label}</a>` : s.label}</div>`).join('')}
        <button onclick="hideOnboardingChecklist()" class="btn-secondary" style="margin-top:6px; width:auto;">Ausblenden</button>
    </div>`;
}
