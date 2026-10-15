/* eslint-disable no-undef */
// Wischen zwischen Reitern (Phase 26.15): Ein Wisch nach links oder rechts wechselt auf dem Handy zum nächsten oder
// vorigen Reiter - in der Reiterleiste der Hubs (.hub-tab-bar) und im Kader (btn-tab-squad-…). Am ersten und letzten
// Reiter passiert nichts (kein Umlauf). Ausgenommen sind Eingabefelder, offene Fenster, Meldungen, das Spielfeld, Diagramme
// und alle Flächen, die selbst seitlich scrollen. Einstellung pro Gerät (anstoss_fm13_wischen, Menü Darstellung),
// Standard: an. Kein Spielzustand.

const SWIPE_KEY = 'anstoss_fm13_wischen';
const SWIPE_MIN_DX = 70, SWIPE_MAX_DY = 45, SWIPE_MAX_MS = 700, SWIPE_EDGE = 24;
const SWIPE_GESPERRT = 'input, textarea, select, [contenteditable="true"], .generic-modal-overlay.show, #app-notice, .soccer-pitch, canvas, svg, .bottom-nav-bar';
let swipeStart = null;

function getWischen() {
    const v = typeof designLesen === 'function' ? designLesen(SWIPE_KEY) : null;
    return v === 'aus' ? 'aus' : 'an';
}

function setzeWischen(id) {
    if (id !== 'an' && id !== 'aus') { showToast('Unbekannte Wisch-Einstellung.', 'error'); return; }
    designSchreiben(SWIPE_KEY, id);
    if (typeof renderDesignSettings === 'function') renderDesignSettings();
    showToast(id === 'an' ? '👆 Wischen zwischen Reitern: an' : '👆 Wischen zwischen Reitern: aus', 'success', 1800);
}

// Darf an diesem Ziel gewischt werden? Nein bei Eingaben, Fenstern, Spielfeld und seitlich scrollenden Flächen
function swipeZielGesperrt(el) {
    if (!el || !el.closest) return true;
    if (el.closest(SWIPE_GESPERRT)) return true;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
}

// Die Reiter, zwischen denen gewischt wird: zuerst die Kader-Reiter, sonst die erste sichtbare Hub-Leiste
function getSwipeReiter() {
    const sichtbar = b => b.offsetParent !== null && !b.disabled;
    let knoepfe = [...document.querySelectorAll('[id^="btn-tab-squad-"]')].filter(sichtbar);
    if (knoepfe.length < 2) {
        const leiste = [...document.querySelectorAll('.hub-tab-bar')].find(b => b.offsetParent !== null);
        knoepfe = leiste ? [...leiste.querySelectorAll('button')].filter(sichtbar) : [];
    }
    const i = knoepfe.findIndex(b => b.classList.contains('btn-action'));
    return knoepfe.length >= 2 && i !== -1 ? { knoepfe, i } : null;
}

// richtung +1: nächster Reiter, -1: voriger; liefert true, wenn gewechselt wurde
function swipeWechseln(richtung) {
    const r = getSwipeReiter();
    const ziel = r ? r.knoepfe[r.i + richtung] : null;
    if (!ziel) return false;
    ziel.click();
    return true;
}

// Ist es ein Wisch? Waagerecht, deutlich länger als hoch, schnell genug, nicht vom Bildschirmrand
function erkenneWisch(start, ende, breite) {
    if (!start || !ende) return 0;
    const dx = ende.x - start.x, dy = ende.y - start.y, dt = ende.t - start.t;
    if (start.x < SWIPE_EDGE || (breite && start.x > breite - SWIPE_EDGE)) return 0;
    if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dy) > SWIPE_MAX_DY || Math.abs(dx) < Math.abs(dy) * 2 || dt > SWIPE_MAX_MS) return 0;
    return dx < 0 ? 1 : -1;
}

document.addEventListener('touchstart', ev => {
    swipeStart = null;
    if (ev.touches.length !== 1 || getWischen() !== 'an') return;
    if (swipeZielGesperrt(ev.target)) return;
    const t = ev.touches[0];
    swipeStart = { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });

document.addEventListener('touchend', ev => {
    const start = swipeStart;
    swipeStart = null;
    if (!start || !ev.changedTouches.length) return;
    const t = ev.changedTouches[0];
    const richtung = erkenneWisch(start, { x: t.clientX, y: t.clientY, t: Date.now() }, window.innerWidth);
    if (richtung) swipeWechseln(richtung);
}, { passive: true });

document.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
