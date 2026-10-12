// ============================================================================
// ZUGÄNGLICHKEIT (Phase 25.54): jedes Bedienelement bekommt einen Namen.
// Knöpfe, die nur ein Symbol zeigen (✕, −, ☆, 🦊 …), Farbpunkte, Auswahlfelder und
// Schieberegler ohne Beschriftung wären für Screenreader (TalkBack, VoiceOver) stumm.
// Statt jede Stelle einzeln zu ergänzen, setzt dieses Modul fehlende aria-label nach
// dem Rendern: einmal für die ganze Seite und danach für jeden neu eingefügten Teil.
// Vorhandene aria-label und title bleiben unangetastet. Kein Spielzustand.
// ============================================================================

const A11Y_SYMBOLE = {
    '✕': 'Schließen', '✖': 'Schließen', '×': 'Schließen', '−': 'Verringern', '-': 'Verringern', '+': 'Erhöhen', '＋': 'Erhöhen',
    '☰': 'Menü öffnen', '★': 'Als wichtig markiert', '☆': 'Als wichtig markieren', '🗄️': 'Archivieren', '↺': 'Wiederherstellen',
    'ℹ️': 'Details', '🔁': 'Tauschen', '▶': 'Starten', '⏩': 'Vorspulen', '❮': 'Zurück', '❯': 'Weiter', '←': 'Zurück', '→': 'Weiter',
    '↖': 'Ecke oben links', '⬆': 'Mitte oben', '↗': 'Ecke oben rechts', '↙': 'Ecke unten links', '⬇': 'Mitte unten', '↘': 'Ecke unten rechts',
    '⬅': 'Links', '➡': 'Rechts', '⬆️': 'Mitte oben', '⬇️': 'Mitte unten', '⬅️': 'Links', '➡️': 'Rechts', '↩️': 'Rückgängig'
};
const A11Y_TIERE = { '🦊': 'Fuchs', '🦅': 'Adler', '🦁': 'Löwe', '🐻': 'Bär', '🐺': 'Wolf', '🐴': 'Pferd', '🐗': 'Wildschwein', '🐂': 'Stier', '🐉': 'Drache', '🦈': 'Hai', '🐯': 'Tiger', '🦌': 'Hirsch' };
const A11Y_SYMBOLE_WAPPEN = { '⚽': 'Fußball', '⚡': 'Blitz', '★': 'Stern', '🔥': 'Flamme', '🦅': 'Adler', '🦁': 'Löwe', '🐺': 'Wolf', '👑': 'Krone', '🛡️': 'Schild' };
const A11Y_FARBEN = [
    ['weiß', 255, 255, 255], ['schwarz', 0, 0, 0], ['rot', 255, 77, 109], ['orange', 255, 138, 92], ['gelb', 245, 185, 66], ['gold', 255, 194, 60],
    ['silber', 192, 192, 192], ['violett', 139, 92, 246], ['blau', 63, 182, 255], ['türkis', 34, 224, 168], ['grün', 62, 224, 138], ['grau', 128, 128, 128]
];

function a11yFarbname(farbe) {
    const m = String(farbe || '').trim();
    let rgb = null;
    const hex = m.match(/^#([0-9a-f]{6})$/i);
    if (hex) rgb = [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
    else { const f = m.match(/\d+/g); if (f && f.length >= 3) rgb = f.slice(0, 3).map(Number); }
    if (!rgb) return 'Farbe';
    let best = A11Y_FARBEN[0], d0 = Infinity;
    for (const c of A11Y_FARBEN) { const d = (c[1] - rgb[0]) ** 2 + (c[2] - rgb[1]) ** 2 + (c[3] - rgb[2]) ** 2; if (d < d0) { d0 = d; best = c; } }
    return best[0];
}

// Nächster beschreibender Text im Umfeld (Zeile, Beschriftung davor, Kasten), ohne die Knöpfe selbst
function a11yUmfeldText(el) {
    const roh = a11yUmfeldTextRoh(el);
    // Zahlen und Einheiten am Ende gehören zum Wert, nicht zum Namen ("Verkaufspreis 22 €" -> "Verkaufspreis")
    const sauber = roh.replace(/\s*[\d.,]+\s*(€|%|Stk\.?)?\s*$/, '').trim();
    return /^[\d.,\s€%]*$/.test(sauber) ? '' : sauber;
}
function a11yUmfeldTextRoh(el) {
    for (let e = el, tiefe = 0; e && e !== document.body && tiefe < 4; e = e.parentElement, tiefe++) {
        const lab = e.querySelector && e.querySelector(':scope > label, :scope > .ui-field-label, :scope > .stepper-row > span:first-child, :scope > strong, :scope > .ui-overline');
        if (lab && lab !== el && !lab.contains(el)) { const t = lab.textContent.replace(/\s+/g, ' ').trim(); if (t) return t.slice(0, 40); }
        // Text-Geschwister direkt davor
        for (let s = e.previousElementSibling, n = 0; s && n < 2; s = s.previousElementSibling, n++) {
            if (/^(BUTTON|SELECT|INPUT)$/.test(s.tagName)) continue;
            const t = s.textContent.replace(/\s+/g, ' ').trim();
            if (t && t.length <= 60 && !/^[\d.,\s€%]+$/.test(t)) return t;
        }
        const eigen = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
        if (eigen) return eigen.replace(/[:：]\s*$/, '').slice(0, 40);
    }
    return '';
}

function a11yName(el) {
    const onclick = el.getAttribute('onclick') || '';
    const text = (el.textContent || '').trim();
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        let m = onclick.match(/setCrestAnimal\('([^']*)'\)/); if (m) return 'Wappentier ' + (A11Y_TIERE[m[1]] || m[1]);
        if (/setCrestAnimal\(null\)/.test(onclick)) return 'Kein Wappentier';
        m = onclick.match(/setCrestSymbol\('([^']*)'\)/); if (m) return 'Wappensymbol ' + (A11Y_SYMBOLE_WAPPEN[m[1]] || A11Y_TIERE[m[1]] || m[1]);
        m = onclick.match(/setCrestColor\('([^']*)'\)/); if (m) return 'Heimfarbe ' + a11yFarbname(m[1]);
        m = onclick.match(/setAwayColor\('([^']*)'\)/); if (m) return 'Auswärtsfarbe ' + a11yFarbname(m[1]);
        const sym = A11Y_SYMBOLE[text];
        if (sym) {
            // Zähler-Knöpfe: Zeilenbezug anhängen ("Schrittweite verringern")
            if (/^(Verringern|Erhöhen)$/.test(sym)) { const u = a11yUmfeldText(el); return u ? `${u} ${sym.toLowerCase()}` : sym; }
            return sym;
        }
        if (!text.replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '')) {
            const farbe = el.style && el.style.background ? el.style.background : '';
            if (farbe && el.offsetWidth <= 48) return 'Farbe ' + a11yFarbname(farbe);
            const u = a11yUmfeldText(el);
            return u ? `Aktion bei ${u}` : '';
        }
        return '';
    }
    // Auswahlfelder und Eingaben
    const u = a11yUmfeldText(el);
    if (u) return u;
    if (el.id) return el.id.replace(/^(sel|priv|st|sf)-?/, '').replace(/[-_]+/g, ' ').trim();
    return el.getAttribute('placeholder') || '';
}

function a11yHatName(el) {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.getAttribute('title') || '').trim()) return true;
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') return !!(el.textContent || '').replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '');
    if (el.id && document.querySelector(`label[for="${el.id}"]`)) return true;
    return !!el.closest('label') || !!el.getAttribute('placeholder');
}

// Reiterleisten (Hub-Reiter und Unterreiter "btn-tab-…"): Leiste = tablist, Knopf = tab, aktiver Reiter
// = aria-selected (folgt der Knopfklasse btn-action), Pfeiltasten/Pos1/Ende wechseln den Reiter.
const A11Y_TAB_SEL = 'button[id^="hubtab-btn-"], button[id^="btn-tab-"]';
function a11yTabsSynchron(leiste) {
    leiste.querySelectorAll(A11Y_TAB_SEL).forEach(b => b.setAttribute('aria-selected', String(b.classList.contains('btn-action'))));
}
function verbesserTabs(root) {
    const knoepfe = [...root.querySelectorAll(A11Y_TAB_SEL)];
    if (root.matches && root.matches(A11Y_TAB_SEL)) knoepfe.push(root);
    const leisten = new Set(knoepfe.map(b => b.parentElement).filter(Boolean));
    leisten.forEach(leiste => {
        if (leiste.__a11yTabs) { a11yTabsSynchron(leiste); return; }
        leiste.__a11yTabs = true;
        if (!leiste.getAttribute('role')) leiste.setAttribute('role', 'tablist');
        if (!leiste.getAttribute('aria-label')) leiste.setAttribute('aria-label', 'Bereiche');
        leiste.querySelectorAll(A11Y_TAB_SEL).forEach(b => b.setAttribute('role', 'tab'));
        a11yTabsSynchron(leiste);
        if (typeof MutationObserver !== 'undefined') new MutationObserver(() => a11yTabsSynchron(leiste)).observe(leiste, { attributes: true, subtree: true, attributeFilter: ['class'] });
        leiste.addEventListener('keydown', e => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
            const tabs = [...leiste.querySelectorAll(A11Y_TAB_SEL)].filter(b => !b.disabled && b.offsetParent !== null);
            const i = tabs.indexOf(document.activeElement);
            if (i < 0) return;
            e.preventDefault();
            const ziel = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            ziel.click();
            const neu = document.getElementById(ziel.id);
            if (neu) neu.focus({ preventScroll: true });
        });
    });
}

function verbessereZugaenglichkeit(wurzel) {
    const root = wurzel || document;
    if (!root.querySelectorAll) return 0;
    let n = 0;
    const kandidaten = [...root.querySelectorAll('button, [role="button"], select, input:not([type="hidden"]), textarea')];
    if (root.matches && root.matches('button, [role="button"], select, input, textarea')) kandidaten.push(root);
    for (const el of kandidaten) {
        if (a11yHatName(el)) continue;
        const name = a11yName(el);
        if (name) { el.setAttribute('aria-label', name); n++; }
    }
    verbesserTabs(root);
    return n;
}

let a11yBeobachter = null;
function initZugaenglichkeit() {
    verbessereZugaenglichkeit(document);
    if (typeof MutationObserver === 'undefined' || a11yBeobachter) return;
    let wartend = new Set(), geplant = false;
    a11yBeobachter = new MutationObserver(records => {
        records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) wartend.add(n); }));
        if (geplant || !wartend.size) return;
        geplant = true;
        // gebündelt, damit schnelle Aktualisierungen (Live-Ticker) nichts bremsen
        setTimeout(() => {
            const arbeit = [...wartend]; wartend = new Set(); geplant = false;
            arbeit.forEach(n => { if (document.contains(n)) verbessereZugaenglichkeit(n); });
        }, 120);
    });
    a11yBeobachter.observe(document.body, { childList: true, subtree: true });
}
