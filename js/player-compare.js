// ============================================================================
// SPIELER-VERGLEICH (Phase 26.6): zwei Spieler nebeneinander, aus dem Spielerdetail geöffnet.
// Der zweite Spieler kommt aus dem eigenen Kader (Standard: bester andere Spieler derselben Position),
// der erste darf auch vom Transfermarkt, aus dem Scouting oder der Jugend stammen. Reine Anzeige:
// liest echte Spielerdaten und ändert nichts.
// ============================================================================

let compareState = { aId: null, aPool: 'squad', bId: null };

// Zeilen des Vergleichs: wert(p) liefert eine Zahl oder null; besser = 'hoch' | 'tief' | null (kein Sieger)
const VERGLEICH_ZEILEN = [
    { label: 'Stärke', wert: p => p.strength, besser: 'hoch' },
    { label: 'Alter', wert: p => p.age || null, besser: null },
    { label: 'Fitness', wert: p => p.fitness ?? null, besser: 'hoch', suffix: ' %' },
    { label: 'Moral', wert: p => p.morale ?? null, besser: 'hoch' },
    { label: 'Tempo', wert: p => p.pace ?? null, besser: 'hoch' },
    { label: 'Schuss', wert: p => p.shooting ?? null, besser: 'hoch' },
    { label: 'Pass', wert: p => p.passing ?? null, besser: 'hoch' },
    { label: 'Abwehr', wert: p => p.defense ?? null, besser: 'hoch' },
    { label: 'Marktwert', wert: p => p.marketValue || 0, besser: null, format: v => formatVal(v) },
    { label: 'Gehalt je Spieltag', wert: p => (typeof p.wage === 'number' ? p.wage : null), besser: 'tief', format: v => formatVal(v) },
    { label: 'Vertrag (Jahre)', wert: p => (typeof p.contracts === 'number' ? p.contracts : null), besser: null },
    { label: 'Tore (Saison)', wert: p => p.goalsSeason ?? null, besser: 'hoch' },
    { label: 'Vorlagen (Saison)', wert: p => (p.statsSeason ? p.statsSeason.vorlagen : null), besser: 'hoch' },
    { label: 'Ø Note (Saison)', wert: p => (p.statsSeason && p.statsSeason.spiele ? p.statsSeason.notenSumme / p.statsSeason.spiele : null), besser: 'tief', format: v => (typeof formatGrade === 'function' ? formatGrade(v) : v.toFixed(1)) },
    { label: 'Verletzungen', wert: p => p.timesInjured ?? 0, besser: 'tief' }
];

function pcFindA() {
    return typeof findPlayerInPool === 'function' ? findPlayerInPool(compareState.aId, compareState.aPool) : null;
}
function pcFindB() { return squad.find(p => String(p.id) === String(compareState.bId)) || null; }

function pcKandidaten(a) {
    return squad.filter(p => !a || String(p.id) !== String(a.id))
        .sort((x, y) => ((y.pos === (a && a.pos)) - (x.pos === (a && a.pos))) || (y.strength - x.strength));
}

function openPlayerCompare() {
    const aId = typeof currentDetailPlayerId !== 'undefined' ? currentDetailPlayerId : null;
    const aPool = typeof currentDetailPlayerPool !== 'undefined' ? currentDetailPlayerPool : 'squad';
    const a = aId !== null && typeof findPlayerInPool === 'function' ? findPlayerInPool(aId, aPool) : null;
    if (!a) { showToast('Öffne zuerst die Karte eines Spielers, den du vergleichen willst.', 'error'); return; }
    const kand = pcKandidaten(a);
    if (!kand.length) { showToast('Es gibt keinen Kaderspieler zum Vergleichen.', 'error'); return; }
    compareState = { aId, aPool, bId: kand[0].id };
    renderPlayerCompare();
    const ov = document.getElementById('compare-overlay');
    if (ov) ov.classList.add('show');
}

function closePlayerCompare() {
    const ov = document.getElementById('compare-overlay');
    if (ov) ov.classList.remove('show');
}

function setCompareB(id) {
    compareState.bId = id;
    renderPlayerCompare();
}

function renderPlayerCompare() {
    const box = document.getElementById('compare-content');
    if (!box) return;
    const a = pcFindA(), b = pcFindB();
    if (!a || !b) { box.innerHTML = '<div class="box">Einer der Spieler ist nicht mehr verfügbar.</div>'; return; }
    let nA = 0, nB = 0, gleich = 0;
    const zeilen = VERGLEICH_ZEILEN.map(z => {
        const va = z.wert(a), vb = z.wert(b);
        if (va === null && vb === null) return '';
        const fmt = v => v === null ? '–' : (z.format ? z.format(v) : (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v) + (z.suffix || ''));
        let siegerA = false, siegerB = false;
        if (z.besser && va !== null && vb !== null && Math.abs(va - vb) > 1e-9) {
            const aVorn = z.besser === 'hoch' ? va > vb : va < vb;
            siegerA = aVorn; siegerB = !aVorn;
            if (aVorn) nA++; else nB++;
        } else if (z.besser && va !== null && vb !== null) gleich++;
        return `<tr><th scope="row" style="text-align:left; font-weight:400; color:var(--text-muted); padding:3px 4px;">${z.label}</th><td style="text-align:right; padding:3px 4px;${siegerA ? ' font-weight:800; color:var(--accent);' : ''}">${fmt(va)}${siegerA ? ' ✓' : ''}</td><td style="text-align:right; padding:3px 4px;${siegerB ? ' font-weight:800; color:var(--accent);' : ''}">${fmt(vb)}${siegerB ? ' ✓' : ''}</td></tr>`;
    }).join('');
    const optionen = pcKandidaten(a).map(p => `<option value="${mpEsc(p.id)}"${String(p.id) === String(b.id) ? ' selected' : ''}>${mpEsc(p.name)} (${p.pos}, ${p.strength})</option>`).join('');
    const urteil = nA === nB ? 'Ausgeglichen' : (nA > nB ? `${a.name} liegt vorn` : `${b.name} liegt vorn`);
    box.innerHTML = `<div class="panel-header">⚖️ Spieler-Vergleich</div>
        <label class="ui-field" style="margin-bottom:8px;"><span class="ui-field-label">Vergleichen mit (eigener Kader)</span>
            <select id="compare-b" onchange="setCompareB(this.value)" style="width:100%;">${optionen}</select></label>
        <div class="ui-card-meta" style="margin-bottom:6px;">${uiChip(`${mpEsc(a.name)}: ${nA} vorn`, nA > nB ? 'gut' : '')}${uiChip(`${mpEsc(b.name)}: ${nB} vorn`, nB > nA ? 'gut' : '')}${gleich ? uiChip(`${gleich} gleich`) : ''}${uiChip(urteil, nA === nB ? 'warn' : 'gut')}</div>
        <table style="width:100%; border-collapse:collapse; font-size:var(--fs-small);">
            <thead><tr><th></th><th style="text-align:right; padding:3px 4px;">${mpEsc(a.name)}<div style="font-weight:400; color:var(--text-muted); font-size:var(--fs-caption);">${a.pos}${compareState.aPool !== 'squad' ? ' · extern' : ''}</div></th><th style="text-align:right; padding:3px 4px;">${mpEsc(b.name)}<div style="font-weight:400; color:var(--text-muted); font-size:var(--fs-caption);">${b.pos} · eigener Kader</div></th></tr></thead>
            <tbody>${zeilen}</tbody></table>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:6px;">✓ = besserer Wert. Alter, Marktwert und Vertragslaufzeit haben keinen Sieger. Werte ohne Angabe (z. B. Gehalt externer Spieler) zählen nicht.</div>`;
}
