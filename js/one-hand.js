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

// Jeder neu gezeigte Bildschirm kommt in die Liste „Zuletzt geöffnet“ (auch beim Zurückgehen), die Anzeige folgt gleich danach
function aktualisiereZuletzt(neu) {
    merkeZuletzt(neu);
    renderZuletzt();
}

// ---------- Zuletzt geöffnet (Phase 26.16) ----------
// Die letzten fünf besuchten Bildschirme stehen oben im Menü zum direkten Antippen. Eine Einstellung dieses Geräts
// (localStorage), kein Spielstand. Nur Bildschirme mit Menüeintrag erscheinen; der aktuelle fehlt in der Liste.
const ZULETZT_KEY = 'anstoss_fm13_zuletzt';
const ZULETZT_MAX = 5;

function getZuletzt() {
    try {
        const l = JSON.parse(safeLocalGet(ZULETZT_KEY) || '[]');
        return Array.isArray(l) ? l.filter(x => typeof x === 'string').slice(0, ZULETZT_MAX + 3) : [];
    } catch (e) { return []; }
}

function merkeZuletzt(screenId) {
    if (!screenId || ONE_HAND_NO_HISTORY.includes(screenId)) return;
    const l = [screenId, ...getZuletzt().filter(x => x !== screenId)].slice(0, ZULETZT_MAX + 3);
    safeLocalSet(ZULETZT_KEY, JSON.stringify(l));
}

// Beschriftung aus dem Menüeintrag des Bildschirms (so stimmt auch die Sprache)
function getZuletztLabel(screenId) {
    const knopf = [...document.querySelectorAll('#app-sidebar .nav-btn')].find(b => (b.getAttribute('onclick') || '').includes(`showScreen('${screenId}')`));
    if (!knopf) return '';
    const t = knopf.querySelector('[data-i18n]');
    return (t || knopf).textContent.replace(/\s+/g, ' ').trim();
}

function renderZuletzt() {
    const box = document.getElementById('recent-screens-box');
    if (!box) return;
    const eintraege = getZuletzt().filter(id => id !== aktiverScreen).map(id => ({ id, label: getZuletztLabel(id) })).filter(e => e.label).slice(0, ZULETZT_MAX);
    const html = eintraege.length ? `<div class="nav-category">Zuletzt geöffnet</div>` + eintraege.map(e => `<button class="nav-btn" data-s="${e.id}" onclick="showScreen(this.dataset.s)">${e.label}</button>`).join('') : '';
    if (box.innerHTML !== html) box.innerHTML = html;
}

// ---------- Spielersuche (Phase 26.17) ----------
// Sucht ab zwei Buchstaben in allen Bereichen mit Spielerdetail; Groß-/Kleinschreibung und Akzente zählen nicht.
const SPIELER_SUCHE_MAX = 8;
function sucheNormal(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function sucheSpieler(text) {
    const q = sucheNormal(text).trim();
    if (q.length < 2) return [];
    const bereiche = [
        ['squad', 'Kader', typeof squad !== 'undefined' ? squad : []],
        ['secondTeam', 'Zweite Mannschaft', typeof secondTeamSquad !== 'undefined' ? secondTeamSquad : []],
        ['youth', 'Jugend', typeof youthTalents !== 'undefined' ? youthTalents : []],
        ['market', 'Transfermarkt', typeof marketPlayers !== 'undefined' ? marketPlayers : []],
        ['market', 'Vereinslos', typeof freeAgentPlayers !== 'undefined' ? freeAgentPlayers : []],
        ['scout', 'Scouting', typeof globalScoutResults !== 'undefined' ? globalScoutResults : []]
    ];
    const treffer = [];
    bereiche.forEach(([pool, label, liste]) => liste.forEach(p => { if (p && p.name && sucheNormal(p.name).includes(q)) treffer.push({ p, pool, label }); }));
    return treffer;
}

function renderSpielerSuche(text) {
    const box = document.getElementById('player-search-results');
    if (!box) return;
    const q = String(text || '').trim();
    if (q.length < 2) { box.innerHTML = ''; return; }
    const treffer = sucheSpieler(q);
    box.innerHTML = treffer.length
        ? treffer.slice(0, SPIELER_SUCHE_MAX).map(t => `<button onclick="oeffneSuchtreffer(this.dataset.id, this.dataset.pool)" data-id="${t.p.id}" data-pool="${t.pool}" class="btn-secondary">${mpEsc(t.p.name)} <span style="color:var(--text-muted);">· ${t.p.pos || ''} · Str ${t.p.strength} · ${t.label}</span></button>`).join('')
            + (treffer.length > SPIELER_SUCHE_MAX ? `<div style="font-size:var(--fs-caption); color:var(--text-muted);">und ${treffer.length - SPIELER_SUCHE_MAX} weitere – genauer suchen</div>` : '')
        : '<div style="font-size:var(--fs-caption); color:var(--text-muted);">Kein Spieler gefunden.</div>';
}

function oeffneSuchtreffer(id, pool) {
    if (typeof closeMenuDrawer === 'function') closeMenuDrawer();
    openPlayerDetail(id, pool);
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

// Kopfzeile auf dem Handy: die Kennzahlen-Chips scrollen seitlich. Ein weicher Rand zeigt,
// wo es weitergeht (rechts: noch mehr, links: schon gescrollt) - sonst wirkte der letzte Chip abgeschnitten.
function aktualisiereKopfHinweis() {
    const el = document.querySelector('.header-kpis');
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('kpi-mehr-rechts', max > 2 && el.scrollLeft < max - 2);
    el.classList.toggle('kpi-mehr-links', el.scrollLeft > 2);
}

function initOneHand() {
    const kpis = document.querySelector('.header-kpis');
    if (kpis) {
        kpis.addEventListener('scroll', aktualisiereKopfHinweis, { passive: true });
        window.addEventListener('resize', aktualisiereKopfHinweis);
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(aktualisiereKopfHinweis).observe(kpis);
        // Kennzahlen ändern ihren Text (länger/kürzer) ohne dass sich die Größe des Kastens ändert
        if (typeof MutationObserver !== 'undefined') new MutationObserver(() => requestAnimationFrame(aktualisiereKopfHinweis)).observe(kpis, { childList: true, subtree: true, characterData: true });
        aktualisiereKopfHinweis();
    }
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
