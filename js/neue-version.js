// Hinweis auf eine neue Version: GitHub Pages lässt Browser die Seite bis zu 10 Minuten aus dem Zwischenspeicher
// zeigen, nach einem Update lief dann noch die alte Fassung (gemeldet mit 3.148 statt 3.149). Beim Start und beim
// Zurückkehren zur Seite (höchstens alle 30 Minuten) holt das Spiel die kleine Datei version.json ohne Zwischenspeicher
// (der Deploy-Schritt in .github/workflows/build-test.yml schreibt sie) und bietet bei einer neueren Version das
// Neuladen an. Vor dem Neuladen wird automatisch gespeichert. Nur über http(s); offline oder als Datei passiert nichts.

const NEUE_VERSION_ABSTAND = 30 * 60 * 1000;
let neueVersionZuletzt = 0;
let neueVersionGemeldet = null;

// Version aus der Antwort von version.json, nur wenn sie neuer ist als das laufende Spiel
function neuereVersionAus(daten) {
    const v = daten && typeof daten.version === 'string' && /^\d+(\.\d+)*$/.test(daten.version) ? daten.version : null;
    return v && typeof compareGameVersions === 'function' && compareGameVersions(v, GAME_VERSION.number) > 0 ? v : null;
}

async function pruefeNeueVersion(sofort) {
    // Nur auf der eigenen Seite: abgeschottete Vorschauen (Herkunft "null") dürfen version.json nicht lesen
    if (!/^https?:$/.test(location.protocol) || location.origin === 'null' || typeof fetch !== 'function') return null;
    if (!sofort && Date.now() - neueVersionZuletzt < NEUE_VERSION_ABSTAND) return null;
    neueVersionZuletzt = Date.now();
    try {
        const antwort = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!antwort.ok) return null;
        const v = neuereVersionAus(await antwort.json());
        if (v) zeigeNeueVersion(v);
        return v;
    } catch (e) { return null; }   // offline oder keine version.json: einfach weiterspielen
}

function zeigeNeueVersion(version) {
    if (neueVersionGemeldet === version) return;
    neueVersionGemeldet = version;
    const ov = document.getElementById('neue-version-overlay');
    const text = document.getElementById('neue-version-text');
    if (!ov || !text) return;
    text.textContent = `Version ${version} ist erschienen, du spielst noch ${GAME_VERSION.number}. Beim Neuladen wird dein Spiel vorher automatisch gespeichert.`;
    ov.classList.add('show');
    if (typeof mpFokusHalten === 'function') mpFokusHalten('neue-version-overlay', '.btn-action');
}

function schliesseNeueVersion() {
    const ov = document.getElementById('neue-version-overlay');
    if (ov) ov.classList.remove('show');
}

function ladeNeueVersion() {
    if (typeof writeAutoSaveNow === 'function' && Array.isArray(squad) && squad.length) writeAutoSaveNow();
    // Eigene Adresse je Version: der Zwischenspeicher hat sie noch nicht
    location.replace(location.pathname + '?v=' + encodeURIComponent(neueVersionGemeldet || Date.now()));
}

window.addEventListener('load', () => setTimeout(() => pruefeNeueVersion(true), 4000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) pruefeNeueVersion(false); });
