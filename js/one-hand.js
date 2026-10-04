/* eslint-disable no-undef */
// Bedienung mit einer Hand (Phase 20.8): alles Wichtige im Daumenbereich unten.
// - "▶ Weiter"-Knopf (#one-hand-fab) startet von jedem Bildschirm den nächsten Spieltag,
//   rechts, links (Linkshänder) oder aus - Einstellung pro Gerät (ONE_HAND_FAB_KEY).
// - Zurück-Taste (Android/Browser): schließt Meldung, Fenster, Menü oder geht einen
//   Bildschirm zurück; erst ein zweites Zurück auf dem Startbildschirm verlässt das Spiel.
// - Fenster mit ✕ schließen auch per Tipp daneben (auf dem Handy fahren sie von unten ein).
// - Auf dem Handy wandern Sprache und Ton aus dem Kopf ins Menü (#one-hand-settings).
// Die Livespiel-Steuerung bleibt per CSS über der unteren Leiste stehen.

const ONE_HAND_FAB_KEY = 'anstoss_fm13_ui_fab';
const ONE_HAND_FAB_MODES = ['rechts', 'links', 'aus'];
const ONE_HAND_STACK_MAX = 20;
const ONE_HAND_NO_HISTORY = ['screen-matchday', 'screen-prematch-press'];
let oneHandScreenStack = [];
let oneHandGoingBack = false;
let oneHandHistoryReady = false;
let oneHandExitArmed = false;

function getOneHandFabMode() {
    const m = safeLocalGet(ONE_HAND_FAB_KEY);
    return ONE_HAND_FAB_MODES.includes(m) ? m : 'rechts';
}

function cycleOneHandFabMode() {
    const naechster = ONE_HAND_FAB_MODES[(ONE_HAND_FAB_MODES.indexOf(getOneHandFabMode()) + 1) % ONE_HAND_FAB_MODES.length];
    safeLocalSet(ONE_HAND_FAB_KEY, naechster);
    applyOneHandFabMode();
    renderOneHandSettings();
    showToast(naechster === 'aus' ? '▶ Weiter-Knopf ausgeblendet' : `▶ Weiter-Knopf jetzt ${naechster} unten`, 'success', 2200);
}

function applyOneHandFabMode() {
    const modus = getOneHandFabMode();
    document.body.classList.toggle('fab-left', modus === 'links');
    document.body.classList.toggle('fab-off', modus === 'aus');
    updateOneHandFab();
}

// Sichtbarkeit und Beschriftung des Weiter-Knopfs (nach jedem Bildschirmwechsel).
function updateOneHandFab() {
    const fab = document.getElementById('one-hand-fab');
    if (!fab) return;
    const verbergen = ONE_HAND_NO_HISTORY.includes(aktiverScreen) || game.matchday > 34 || game.sackPending;
    fab.classList.toggle('fab-hidden', verbergen);
    fab.innerHTML = `▶ <span>Spieltag ${Math.min(34, game.matchday)}</span>`;
}

function oneHandContinue() {
    if (game.sackPending) { showToast('Du bist entlassen - bestätige die Meldung, um bei einem neuen Klub anzufangen.', 'error', 4000); return; }
    if (game.matchday > 34) { showToast('Die Saison ist zu Ende - der Saisonabschluss läuft über das Dashboard.', 'error', 3500); return; }
    startMatchdayFlow();
}

// Aufgerufen am Anfang von showScreen(): merkt sich, woher man kam.
function recordScreenVisit(vorher, neu) {
    if (oneHandGoingBack || !vorher || vorher === neu) return;
    if (ONE_HAND_NO_HISTORY.includes(vorher)) return;
    oneHandScreenStack.push(vorher);
    if (oneHandScreenStack.length > ONE_HAND_STACK_MAX) oneHandScreenStack.shift();
}

function findOpenOverlay() {
    const offen = [...document.querySelectorAll('.generic-modal-overlay.show, .tutorial-overlay.show')];
    return offen.length ? offen.sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0) - (parseInt(getComputedStyle(a).zIndex) || 0))[0] : null;
}

function findOverlayCloseButton(overlay) {
    return overlay.querySelector('.generic-modal-close')
        || [...overlay.querySelectorAll('button')].find(b => /close|schliess/i.test(b.getAttribute('onclick') || ''));
}

// Ein Schritt "Zurück". true = erledigt, false = nichts mehr offen (Startbildschirm).
function handleOneHandBack() {
    const meldung = document.getElementById('app-notice');
    if (meldung && meldung.style.display !== 'none' && noticeQueue.length) {
        if (typeof noticeQueue[0].danach === 'function') showToast('Bitte die Meldung mit dem Knopf bestätigen.', 'error', 2500);
        else dismissNotice();
        return true;
    }
    const fenster = findOpenOverlay();
    if (fenster) {
        const zu = findOverlayCloseButton(fenster);
        if (zu) zu.click();
        else showToast('Hier ist erst eine Entscheidung nötig.', 'error', 2500);
        return true;
    }
    const besuch = document.getElementById('office-event-panel');
    if (besuch && besuch.style.display === 'flex') { closeOfficeEventPanel(); return true; }
    const menue = document.getElementById('app-sidebar');
    if (menue && menue.classList.contains('menu-open')) { closeMenuDrawer(); return true; }
    if (ONE_HAND_NO_HISTORY.includes(aktiverScreen)) {
        showToast('Das Spiel läuft - zum Beenden „⚡ Spiel abpfeifen“ bzw. das Ergebnis abwarten.', 'error', 3000);
        return true;
    }
    while (oneHandScreenStack.length) {
        const ziel = oneHandScreenStack.pop();
        if (ziel === aktiverScreen) continue;
        oneHandGoingBack = true;
        try { showScreen(ziel); } finally { oneHandGoingBack = false; }
        return true;
    }
    return false;
}

function pushOneHandGuard() {
    try { history.pushState({ fm: 'guard' }, ''); oneHandHistoryReady = true; } catch (e) { oneHandHistoryReady = false; }
}

function onOneHandPopState() {
    if (!oneHandHistoryReady) return;
    if (handleOneHandBack()) { oneHandExitArmed = false; pushOneHandGuard(); return; }
    if (oneHandExitArmed) return; // zweites Zurück: der Browser verlässt das Spiel
    oneHandExitArmed = true;
    showToast('Zum Verlassen noch einmal Zurück drücken (vorher speichern?).', 'error', 3000);
    // Bleibt es bei einem Druck, schützt der Wächter danach wieder.
    setTimeout(() => { if (oneHandExitArmed) { oneHandExitArmed = false; pushOneHandGuard(); } }, 3000);
}

// Tipp neben ein Fenster (auf die abgedunkelte Fläche) schließt es - nur Fenster mit ✕.
function onOneHandBackdropClick(e) {
    const ziel = e.target;
    if (!ziel.classList || !ziel.classList.contains('generic-modal-overlay')) return;
    const zu = ziel.querySelector('.generic-modal-close');
    if (zu) zu.click();
}

// Handy: Sprache und Ton ins Menü (Kopf wird eine Zeile kürzer), Desktop: zurück in den Kopf.
function placeHeaderTogglesForWidth(handy) {
    const ziel = handy ? document.getElementById('one-hand-settings-toggles') : document.querySelector('.header-kpis');
    if (!ziel) return;
    ['btn-lang-toggle', 'btn-sound-toggle'].forEach(id => {
        const b = document.getElementById(id);
        if (b && b.parentElement !== ziel) ziel.appendChild(b);
    });
}

function renderOneHandSettings() {
    const box = document.getElementById('one-hand-settings-fab');
    if (!box) return;
    const modus = getOneHandFabMode();
    box.innerHTML = `<button class="nav-btn" onclick="cycleOneHandFabMode()">✋ Weiter-Knopf: ${modus === 'aus' ? 'aus' : modus}</button>`;
}

function initOneHand() {
    oneHandScreenStack = []; // Bildschirmwechsel während des Starts zählen nicht
    document.addEventListener('click', onOneHandBackdropClick);
    const mq = window.matchMedia ? window.matchMedia('(max-width: 650px)') : null;
    if (mq) {
        placeHeaderTogglesForWidth(mq.matches);
        const wechsel = e => placeHeaderTogglesForWidth(e.matches);
        if (mq.addEventListener) mq.addEventListener('change', wechsel); else if (mq.addListener) mq.addListener(wechsel);
    }
    const leiste = document.querySelector('.bottom-nav-bar');
    if (leiste) document.documentElement.style.setProperty('--bottom-nav-h', (leiste.offsetHeight || 58) + 'px');
    renderOneHandSettings();
    applyOneHandFabMode();
    try { history.replaceState({ fm: 'root' }, ''); } catch (e) { /* ohne History kein Zurück-Abfangen */ }
    pushOneHandGuard();
    window.addEventListener('popstate', onOneHandPopState);
}
