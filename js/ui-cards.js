// ============================================================================
// KARTEN-MUSTER (Phase 25.51)
// Eine Karte hat feste Ebenen, damit das Wichtigste zuerst ins Auge fällt -
// wie eine Videokarte: Bild links, Titel, Untertitel, Meta-Chips und rechts
// eine große Kennzahl. Darunter optional ein Inhaltsbereich und die Knöpfe.
//   Ebene 1  .ui-card-kpi    große Kennzahl (Stärke, Preis, Punkte)
//   Ebene 2  .ui-card-title  Name oder Überschrift
//   Ebene 3  .ui-card-sub    Untertitel (Position, Verein, Rolle)
//   Ebene 4  .ui-card-meta   Chips mit Zusatzangaben
// Alle Texte kommen aus dem Spielzustand; die Funktion rendert nur.
// ============================================================================

function uiChip(text, ton = '') {
    if (text === null || text === undefined || text === '') return '';
    return `<span class="ui-chip${ton ? ' ui-chip-' + ton : ''}">${text}</span>`;
}

function renderUiCard(opts = {}) {
    const meta = (opts.meta || []).filter(Boolean).join('');
    const kpi = opts.kpi ? `
        <div class="ui-card-kpi"${opts.kpi.farbe ? ` style="color:${opts.kpi.farbe};"` : ''}>
            <span class="ui-card-kpi-wert${String(opts.kpi.wert).length > 5 ? ' ui-card-kpi-lang' : ''}">${opts.kpi.wert}</span>
            ${opts.kpi.label ? `<span class="ui-card-kpi-label">${opts.kpi.label}</span>` : ''}
        </div>` : '';
    const aside = opts.aside || '';
    return `
        <div class="ui-card-head">
            ${opts.thumb ? `<div class="ui-card-thumb">${opts.thumb}</div>` : ''}
            <div class="ui-card-text">
                <div class="ui-card-title">${opts.title || ''}</div>
                ${opts.sub ? `<div class="ui-card-sub">${opts.sub}</div>` : ''}
            </div>
            ${kpi}${aside}
            ${meta ? `<div class="ui-card-meta">${meta}</div>` : ''}
        </div>
        ${opts.body ? `<div class="ui-card-body">${opts.body}</div>` : ''}
        ${opts.actions ? `<div class="ui-card-actions">${opts.actions}</div>` : ''}`;
}

// Kleine Werteleiste unter dem Kopf (z. B. Tempo, Schuss, Pass, Abwehr)
function renderUiStatRow(werte) {
    return `<div class="ui-stat-row">${werte.map(([label, wert]) => `<div><span>${label}</span><strong>${wert}</strong></div>`).join('')}</div>`;
}
