// ============================================================================
// Darstellung (Phase 25.51/25.54): Farb-Theme, Textgröße und Bewegung, pro Gerät gespeichert.
// Die Themes sind reine Token-Sätze in css/styles.css (html[data-theme=…]),
// die Textgröße setzt --fs-scale (html[data-text-size=…]), die Bewegung steuert
// html[data-motion=…]. "Automatisch" folgt der Handy-Einstellung (hell/dunkel, hoher
// Kontrast, weniger Bewegung). Bildschirm:
// screen-design, Menü "System & Hilfe". Kein Spielzustand - nichts davon
// landet im Spielstand.
// ============================================================================

const DESIGN_THEME_KEY = 'anstoss_fm13_theme';
const DESIGN_TEXT_KEY = 'anstoss_fm13_textgroesse';
const DESIGN_MOTION_KEY = 'anstoss_fm13_bewegung';

// farben: Vorschau-Streifen (Fläche, Karte, Akzent, Gut, Schlecht, Text)
const DESIGN_THEMES = [
    { id: 'auto', name: 'Automatisch', desc: 'Folgt deinem Handy: hell oder dunkel, bei Bedarf hoher Kontrast.', farben: ['#070b14', '#f1f4f9', '#ffc23c', '#0e7a44', '#c21f3a', '#eaf2ff'] },
    { id: 'flutlicht', name: 'Flutlicht-Nacht', desc: 'Standard: Mitternachtsblau, Rasengrün und Flutlicht-Gold.', farben: ['#070b14', '#111827', '#ffc23c', '#3ee08a', '#ff5468', '#eaf2ff'] },
    { id: 'klassik', name: 'Anstoß-Klassik', desc: 'Holz, Leder und Messing wie im Managerbüro der 90er.', farben: ['#110c07', '#241a11', '#e8b84e', '#8fd16a', '#ff6f5e', '#f5ead6'] },
    { id: 'rasen', name: 'Rasengrün', desc: 'Tiefes Stadiongrün mit Kreideweiß und Trikotgelb.', farben: ['#04130b', '#0a2215', '#ffd84d', '#6ef0a6', '#ff6b7a', '#effcf4'] },
    { id: 'tageslicht', name: 'Tageslicht', desc: 'Hell mit dunkler Schrift - für Sonne, Büro und helle Räume.', farben: ['#f1f4f9', '#ffffff', '#985a00', '#0e7a44', '#c21f3a', '#152033'] },
    { id: 'kontrast', name: 'Hoher Kontrast', desc: 'Schwarz, Weiß, Signalgelb. Für helle Umgebungen und schwache Augen.', farben: ['#000000', '#0a0a0a', '#ffe600', '#4dff9a', '#ff7a7a', '#ffffff'] },
    { id: 'farbsicher', name: 'Farbsicher', desc: 'Gut und Schlecht als Blau und Orange - auch bei Rot-Grün-Schwäche klar.', farben: ['#070b14', '#111827', '#f0e442', '#56b4e9', '#e69f00', '#eaf2ff'] }
];

// Bewegung: "system" übernimmt die Handy-Einstellung "Bewegung reduzieren"
const DESIGN_MOTION_MODES = [
    { id: 'system', name: 'Wie Handy' },
    { id: 'reduziert', name: 'Reduziert' },
    { id: 'normal', name: 'Normal' }
];

const DESIGN_TEXT_SIZES = [
    { id: 'normal', name: 'Normal', beispiel: 'Aa' },
    { id: 'gross', name: 'Groß', beispiel: 'Aa' },
    { id: 'sehr-gross', name: 'Sehr groß', beispiel: 'Aa' }
];

function getDesignTheme() {
    const t = typeof safeLocalGet === 'function' ? safeLocalGet(DESIGN_THEME_KEY) : null;
    return DESIGN_THEMES.some(x => x.id === t) ? t : 'flutlicht';
}

function getBewegung() {
    const m = typeof safeLocalGet === 'function' ? safeLocalGet(DESIGN_MOTION_KEY) : null;
    return DESIGN_MOTION_MODES.some(x => x.id === m) ? m : 'system';
}

// Die Medienabfragen werden einmal angelegt und festgehalten: sowohl zum Auflösen als auch zum
// Beobachten. Kurzlebige matchMedia()-Objekte verlieren sonst ihre Wechsel-Meldung (im Test beobachtet).
let designMedien = null;
function getDesignMedien() {
    if (!designMedien && typeof window.matchMedia === 'function') {
        designMedien = { hell: window.matchMedia('(prefers-color-scheme: light)'), kontrast: window.matchMedia('(prefers-contrast: more)') };
    }
    return designMedien;
}

// "Automatisch" wird zu einem echten Theme aufgelöst: hoher Kontrast hat Vorrang, sonst hell/dunkel
function loeseThemeAuf(id) {
    if (id !== 'auto') return id;
    const m = getDesignMedien();
    if (!m) return 'flutlicht';
    if (m.kontrast.matches) return 'kontrast';
    return m.hell.matches ? 'tageslicht' : 'flutlicht';
}

function getTextGroesse() {
    const g = typeof safeLocalGet === 'function' ? safeLocalGet(DESIGN_TEXT_KEY) : null;
    return DESIGN_TEXT_SIZES.some(x => x.id === g) ? g : 'normal';
}

// Setzt die Attribute am <html>; Standardwerte entfernen das Attribut wieder.
function applyDesignSettings() {
    const html = document.documentElement;
    const gewaehlt = getDesignTheme();
    const theme = loeseThemeAuf(gewaehlt);
    const groesse = getTextGroesse();
    const bewegung = getBewegung();
    if (theme === 'flutlicht') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', theme);
    if (groesse === 'normal') html.removeAttribute('data-text-size'); else html.setAttribute('data-text-size', groesse);
    if (bewegung === 'system') html.removeAttribute('data-motion'); else html.setAttribute('data-motion', bewegung);
    beobachteSystemTheme(gewaehlt === 'auto');
    // Browserleiste auf dem Handy passend zur Fläche färben
    const meta = document.querySelector('meta[name="theme-color"]');
    const t = DESIGN_THEMES.find(x => x.id === theme);
    if (meta && t) meta.setAttribute('content', t.farben[0]);
}

// Bei "Automatisch" mitwandern, wenn das Handy zwischen hell und dunkel wechselt (z. B. abends)
let designSystemAbos = false;
function beobachteSystemTheme(aktiv) {
    const m = getDesignMedien();
    if (!m || designSystemAbos === aktiv) return;
    designSystemAbos = aktiv;
    const fn = () => { if (getDesignTheme() === 'auto') applyDesignSettings(); };
    [m.hell, m.kontrast].forEach(mq => {
        if (aktiv && mq.addEventListener) mq.addEventListener('change', fn);
        else if (!aktiv && mq.removeEventListener && mq.__designFn) mq.removeEventListener('change', mq.__designFn);
        mq.__designFn = aktiv ? fn : null;
    });
}

function setzeDesignTheme(id) {
    const t = DESIGN_THEMES.find(x => x.id === id);
    if (!t) { showToast('Unbekanntes Farbschema.', 'error'); return; }
    if (typeof safeLocalSet === 'function') safeLocalSet(DESIGN_THEME_KEY, id);
    applyDesignSettings();
    renderDesignSettings();
    showToast(`🎨 Farbschema: ${t.name}`, 'success', 1800);
}

function setzeBewegung(id) {
    const m = DESIGN_MOTION_MODES.find(x => x.id === id);
    if (!m) { showToast('Unbekannte Bewegungs-Einstellung.', 'error'); return; }
    if (typeof safeLocalSet === 'function') safeLocalSet(DESIGN_MOTION_KEY, id);
    applyDesignSettings();
    renderDesignSettings();
    showToast(`🎞️ Bewegung: ${m.name}`, 'success', 1800);
}

function setzeTextGroesse(id) {
    const g = DESIGN_TEXT_SIZES.find(x => x.id === id);
    if (!g) { showToast('Unbekannte Textgröße.', 'error'); return; }
    if (typeof safeLocalSet === 'function') safeLocalSet(DESIGN_TEXT_KEY, id);
    applyDesignSettings();
    renderDesignSettings();
    showToast(`🔠 Textgröße: ${g.name}`, 'success', 1800);
}

function renderDesignSettings() {
    const box = document.getElementById('design-settings-box');
    if (!box) return;
    const aktiv = getDesignTheme();
    const groesse = getTextGroesse();
    const bewegung = getBewegung();
    const themes = DESIGN_THEMES.map(t => `
        <button class="design-theme-card${t.id === aktiv ? ' active' : ''}" onclick="setzeDesignTheme('${t.id}')" aria-pressed="${t.id === aktiv}">
            <span class="design-swatches" aria-hidden="true">${t.farben.map(f => `<span style="background:${f};"></span>`).join('')}</span>
            <span class="design-theme-name">${t.id === aktiv ? '✓ ' : ''}${t.name}</span>
            <span class="design-theme-desc">${t.desc}</span>
        </button>`).join('');
    const groessen = DESIGN_TEXT_SIZES.map((g, i) => `
        <button class="design-size-btn${g.id === groesse ? ' active' : ''}" onclick="setzeTextGroesse('${g.id}')" aria-pressed="${g.id === groesse}">
            <span style="font-size:${15 + i * 3}px; font-weight:900;">${g.beispiel}</span>
            <span>${g.name}</span>
        </button>`).join('');
    const bewegungen = DESIGN_MOTION_MODES.map(m => `
        <button class="design-size-btn${m.id === bewegung ? ' active' : ''}" onclick="setzeBewegung('${m.id}')" aria-pressed="${m.id === bewegung}">
            <span>${m.name}</span>
        </button>`).join('');
    // Vorschau mit echten Daten: der stärkste Spieler des eigenen Kaders
    const star = (typeof squad !== 'undefined' && squad.length) ? [...squad].sort((a, b) => b.strength - a.strength)[0] : null;
    const vorschau = star ? `
        <div class="ui-field-label" style="margin:12px 0 6px;">Vorschau</div>
        <div class="panel player-card" style="margin:0; padding:12px;">
            ${renderUiCard({
                thumb: `${typeof renderPlayerAvatarTag === 'function' ? renderPlayerAvatarTag(star, 48) : ''}<span class="badge badge-${(star.pos || 'mit').toLowerCase()}">${star.pos}</span>`,
                title: star.name,
                sub: `${star.age ? star.age + ' J. · ' : ''}${game.clubName}`,
                meta: [uiChip(`💶 ${formatVal(star.marketValue || 0)}`), uiChip('Fit', 'gut'), uiChip('Vertrag läuft aus', 'warn')],
                kpi: { wert: star.strength, label: 'Stärke' }
            })}
        </div>` : '';
    box.innerHTML = `
        <div class="ui-field-label" style="margin-bottom:6px;">Farbschema</div>
        <div class="design-theme-grid">${themes}</div>
        <div class="ui-field-label" style="margin:14px 0 6px;">Textgröße</div>
        <div class="design-size-row">${groessen}</div>
        <div class="ui-field-label" style="margin:14px 0 6px;">Bewegung (Animationen)</div>
        <div class="design-size-row">${bewegungen}</div>
        ${vorschau}
        <div class="design-hinweis">Gilt nur für dieses Gerät und bleibt beim Laden anderer Spielstände erhalten.</div>`;
}
