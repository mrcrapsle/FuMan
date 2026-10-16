// ============================================================================
// VERTRAGS- UND TRANSFER-WERKZEUGE (Phase 26.2): Gehalts-Ampel, Verlängerungs-Assistent,
// Marktwert-Kurve, Transferbilanz je Saison und Entwicklungsprognose.
// Alles liest echte Spieldaten. Geändert wird nur beim ausdrücklichen "Verlängern" im
// Assistenten - und das läuft über dieselbe Logik wie das normale Vertragsgespräch.
// ============================================================================

// ---------- Gehalts-Ampel ----------

// Gehalt gegenüber dem Marktgehalt, das calculatePlayerWage() für Stärke und Marktwert errechnet
function getWageRating(p) {
    const markt = calculatePlayerWage(p.marketValue || 0, p.strength);
    const verhaeltnis = markt > 0 ? (p.wage || 0) / markt : 1;
    const prozent = Math.round((verhaeltnis - 1) * 100);
    let ton, text;
    if (verhaeltnis < 0.85) { ton = 'gut'; text = `💶 Günstig (${prozent} %)`; }
    else if (verhaeltnis <= 1.15) { ton = ''; text = '💶 Marktüblich'; }
    else if (verhaeltnis <= 1.4) { ton = 'warn'; text = `💶 Teuer (+${prozent} %)`; }
    else { ton = 'schlecht'; text = `💶 Überbezahlt (+${prozent} %)`; }
    return { markt, verhaeltnis, prozent, ton, text };
}

// ---------- Verlängerungs-Assistent ----------

// Kandidaten: auslaufende Verträge (bis 1 Jahr Rest), danach Stärkste zuerst
function getRenewalCandidates(maxRest = 1) {
    // Spieler mit dem eigenen Etikett „Vertrag klären“ (js/manager-tools.js) stehen ganz oben
    const geklaert = p => (typeof getPlayerTags === 'function' && getPlayerTags(p).includes('vertrag')) ? 0 : 1;
    return squad.filter(p => p.contracts <= maxRest).sort((a, b) => (geklaert(a) - geklaert(b)) || (a.contracts - b.contracts) || (b.strength - a.strength));
}

// Warum eine Verlängerung gerade nicht geht (leer = möglich)
function getRenewalBlocker(p) {
    if (p.preContractSigned) return `Vorvertrag bei ${p.preContractSigned} unterschrieben`;
    if (p.talksBlockedSeason === game.season) return 'will diese Saison nicht mehr verhandeln';
    return '';
}

function getRenewalProposal(p) {
    const d = getContractDemand(p);
    const jahre = p.age >= 30 ? 1 : 2;
    const handgeld = d.handgeldProJahr * jahre;
    const berater = getAgentFee(p, handgeld);
    const alt = p.wage || 0;
    return { ...d, jahre, handgeld, berater, kosten: handgeld + berater, alt, aufschlag: d.gehalt - alt, markt: getWageRating({ ...p, wage: d.gehalt }) };
}

function openRenewalAssistant() {
    const ov = document.getElementById('renewal-assistant-overlay');
    if (!ov) return;
    renderRenewalAssistant();
    ov.classList.add('show');
}
function closeRenewalAssistant() {
    const ov = document.getElementById('renewal-assistant-overlay');
    if (ov) ov.classList.remove('show');
}

// Verlängert zum Angebot ohne Verhandlung: gleiche Prüfung und Buchung wie acceptContractTalk()
function renewWithProposal(id) {
    const p = squad.find(x => x.id === id);
    if (!p) return;
    const grund = getRenewalBlocker(p);
    if (grund) { showToast(`${p.name}: ${grund}.`, 'error', 3500); return; }
    const vorher = p.contracts;
    const merk = typeof contractTalk !== 'undefined' ? contractTalk : null;
    contractTalk = { playerId: id, years: p.age >= 30 ? 1 : 2, offerFactor: 1, garantie: false, rounds: 0 };
    acceptContractTalk();
    // acceptContractTalk meldet Fehler (Kasse, Gehaltsbudget) per Meldung und lässt dann contractTalk stehen
    if (p.contracts === vorher) contractTalk = merk;
    renderRenewalAssistant();
}

function renderRenewalAssistant() {
    const box = document.getElementById('renewal-assistant-content');
    if (!box) return;
    const liste = getRenewalCandidates(1);
    const kopf = `<div class="panel-header">🤝 Verlängerungs-Assistent</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:8px;">Alle Verträge mit höchstens einem Jahr Rest. Der Vorschlag entspricht der ersten Forderung des Spielers ohne Verhandeln. Wer weniger zahlen will, nutzt das normale Vertragsgespräch.</div>
        <div class="ui-card-meta" style="margin-bottom:8px;">${uiChip(`💶 Kasse ${formatVal(game.money)}`)}${uiChip(`📊 ${fw('Gehaltsbudget')} ${formatVal(game.wageBudget)}/SpT`)}</div>`;
    if (!liste.length) { box.innerHTML = kopf + '<div class="box">Aktuell läuft kein Vertrag bald aus.</div>'; if (typeof mpFokusHalten === 'function') mpFokusHalten('renewal-assistant-overlay'); return; }
    box.innerHTML = kopf + liste.map(p => {
        const v = getRenewalProposal(p);
        const grund = getRenewalBlocker(p);
        const kasseOk = game.money >= v.kosten;
        const budgetOk = contractWageTotalWith(p, v.gehalt) <= game.wageBudget;
        const hinweis = grund || (!kasseOk ? 'Kasse reicht für das Handgeld nicht' : (!budgetOk ? 'Gehaltsbudget reicht nicht' : ''));
        return `<div class="panel player-card" style="margin:0 0 8px; padding:10px;">${renderUiCard({
            thumb: `${typeof renderPlayerAvatarTag === 'function' ? renderPlayerAvatarTag(p, 40) : ''}<span class="badge badge-${(p.pos || 'mit').toLowerCase()}">${p.pos}</span>`,
            title: p.name,
            sub: `${p.age ? p.age + ' J. · ' : ''}${p.contracts === 0 ? 'Vertrag läuft aus' : p.contracts + ' J. Rest'}`,
            meta: [
                typeof getPlayerTags === 'function' && getPlayerTags(p).includes('vertrag') ? uiChip('📄 Vertrag klären', 'warn') : '',
                v.star ? uiChip('⭐ Topspieler', 'warn') : (v.stammspieler ? uiChip('Stammspieler') : uiChip('Ersatz')),
                uiChip(`Gehalt ${formatVal(v.alt)} → ${formatVal(v.gehalt)}/SpT`, v.aufschlag > 0 ? 'warn' : 'gut'),
                uiChip(`${v.jahre} J. Laufzeit`),
                uiChip(`Handgeld + Berater ${formatVal(v.kosten)}`),
                uiChip(v.markt.text.replace('💶 ', ''), v.markt.ton)
            ],
            kpi: { wert: p.strength, label: 'Stärke' },
            body: hinweis ? `<div style="font-size:var(--fs-small); color:var(--danger);">⛔ ${mpEsc(hinweis)}</div>` : '',
            actions: `<button onclick="renewWithProposal('${p.id}')" class="btn-action"${hinweis ? ' disabled' : ''}>✍️ Zum Angebot verlängern</button>`
                + `<button onclick="closeRenewalAssistant(); showScreen('screen-contracts'); extendContract('${p.id}')" class="btn-secondary">💬 Verhandeln</button>`
        })}</div>`;
    }).join('');
    if (typeof mpFokusHalten === 'function') mpFokusHalten('renewal-assistant-overlay', '.btn-action:not([disabled])');
}

// ---------- Vertragsplan (Phase 26.16) ----------
// Wann laufen welche Verträge aus, und wie viel Gehalt wird dadurch frei? Am Saisonende zählt `contracts` um eins herunter und
// wer dann bei 0 steht, geht: Restlaufzeit 1 (oder weniger) = Ende dieser Saison, 2 = Ende der nächsten, 3 = Ende der übernächsten.
// Reine Anzeige aus Kader, Gehältern und Gehaltsbudget (Gehälter und Budget gelten je Spieltag).

function getVertragsplan() {
    const lohn = squad.reduce((s, p) => s + (p.wage || 0), 0);
    let frei = 0;
    return [0, 1, 2].map(k => {
        const spieler = squad.filter(p => k === 0 ? p.contracts <= 1 : p.contracts === k + 1).sort((a, b) => b.strength - a.strength);
        const gehalt = spieler.reduce((s, p) => s + (p.wage || 0), 0);
        frei += gehalt;
        return { saison: game.season + k, spieler, gehalt, lohnDanach: lohn - frei, spielraum: game.wageBudget - (lohn - frei) };
    });
}

function renderVertragsplan() {
    const box = document.getElementById('contract-plan-box');
    if (!box) return;
    if (!squad.length) { box.innerHTML = ''; return; }
    const plan = getVertragsplan();
    const lohn = squad.reduce((s, p) => s + (p.wage || 0), 0);
    box.innerHTML = `<div style="font-size:var(--fs-small); margin-bottom:6px;">Gehälter heute: <strong>${formatVal(lohn)}</strong> von ${formatVal(game.wageBudget)} Gehaltsbudget je Spieltag (${formatVal(game.wageBudget - lohn)} Spielraum).</div>`
        + plan.map((z, k) => `<div class="box" style="margin:4px 0; font-size:var(--fs-small);"><strong>${k === 0 ? 'Saisonende ' + z.saison + ' (diese Saison)' : 'Saisonende ' + z.saison}</strong>: ${z.spieler.length ? `${z.spieler.length === 1 ? '1 Vertrag läuft' : z.spieler.length + ' Verträge laufen'} aus (${z.spieler.slice(0, 3).map(p => `${mpEsc(p.name)} ${p.strength}`).join(', ')}${z.spieler.length > 3 ? ' …' : ''}), frei werden ${formatVal(z.gehalt)} je Spieltag` : 'keine Verträge laufen aus'}
            <div style="color:var(--text-muted); font-size:var(--fs-caption);">Danach ${formatVal(z.lohnDanach)} Gehälter, ${formatVal(z.spielraum)} Spielraum im heutigen Budget (ohne Ersatz und Verlängerungen).</div>
            ${z.spieler.length ? `<button onclick="erinnerungVorbelegen(this.dataset.text)" data-text="${mpEsc('Verträge klären: ' + z.spieler.slice(0, 3).map(p => p.name).join(', '))}" class="btn-secondary" style="margin-top:4px;">📝 Erinnern</button>` : ''}</div>`).join('');
}

// ---------- Marktwert-Kurve ----------

// Marktwert je Saison, abgeleitet aus dem gespeicherten Stärkeverlauf (der Marktwert hängt an der Stärke);
// der letzte Punkt ist der echte aktuelle Marktwert
function getMarketValueCurve(p) {
    const hist = (p.strengthHistory || []).filter(h => typeof h.strength === 'number');
    const punkte = hist.map(h => ({ saison: h.season, wert: calculatePlayerMarketValue(h.strength) }));
    const letzte = punkte[punkte.length - 1];
    if (letzte && letzte.saison === game.season) letzte.wert = p.marketValue || letzte.wert;
    else punkte.push({ saison: game.season, wert: p.marketValue || 0 });
    return punkte;
}

function renderMarketValueCurve(p) {
    const box = document.getElementById('pd-marketcurve');
    if (!box) return;
    const kurve = getMarketValueCurve(p);
    if (kurve.length < 2) { box.innerHTML = ''; return; }
    const w = 260, h = 50, pad = 4;
    const minV = Math.min(...kurve.map(k => k.wert)), maxV = Math.max(...kurve.map(k => k.wert));
    const spanne = Math.max(1, maxV - minV);
    const xy = (k, i) => [pad + (i / (kurve.length - 1)) * (w - pad * 2), h - pad - ((k.wert - minV) / spanne) * (h - pad * 2)];
    const punkte = kurve.map((k, i) => xy(k, i).map(v => v.toFixed(1)).join(',')).join(' ');
    const steigt = kurve[kurve.length - 1].wert >= kurve[0].wert;
    const farbe = steigt ? 'var(--primary)' : 'var(--danger)';
    const diff = kurve[kurve.length - 1].wert - kurve[0].wert;
    box.innerHTML = `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:2px; text-align:left;">💶 Marktwert (Saison ${kurve[0].saison}-${kurve[kurve.length - 1].saison}): ${formatVal(kurve[0].wert)} → ${formatVal(kurve[kurve.length - 1].wert)} (${diff >= 0 ? '+' : ''}${formatVal(diff)})</div>
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px;" role="img" aria-label="Marktwert-Kurve von ${formatVal(kurve[0].wert)} auf ${formatVal(kurve[kurve.length - 1].wert)}">
            <polyline points="${punkte}" fill="none" stroke="${farbe}" stroke-width="2"/>
            ${kurve.map((k, i) => { const [x, y] = xy(k, i); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${farbe}"/>`; }).join('')}
        </svg>`;
}

// ---------- Transferbilanz je Saison ----------

// Am Saisonende festhalten: das Kontojournal hält nur die letzten Buchungen, alte Saisons gingen verloren
function archiveTransferBilanz() {
    if (typeof getTransferBilanz !== 'function') return;
    if (!Array.isArray(game.transferBilanzHistory)) game.transferBilanzHistory = [];
    const b = getTransferBilanz(game.season);
    const summe = b.verkauf + b.weiterverkauf + b.kauf + b.handgeld;
    game.transferBilanzHistory = game.transferBilanzHistory.filter(x => x.season !== game.season);
    if (summe > 0) game.transferBilanzHistory.push({ season: game.season, verkauf: b.verkauf + b.weiterverkauf, kauf: b.kauf + b.handgeld, netto: b.netto });
    game.transferBilanzHistory = game.transferBilanzHistory.slice(-20);
}

function renderTransferBilanzHistory() {
    const hist = (game.transferBilanzHistory || []).slice().reverse();
    if (!hist.length) return '';
    const gesamt = hist.reduce((s, x) => s + x.netto, 0);
    return `<div class="box" style="margin-bottom:6px;">
        <strong style="font-size:var(--fs-body);">🗂️ Frühere Saisons</strong>
        ${hist.map(x => `<div style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-small); margin-top:3px;">
            <span>Saison ${x.season}</span><span style="color:var(--text-muted);">+${formatVal(x.verkauf)} / −${formatVal(x.kauf)}</span>
            <strong style="color:${x.netto >= 0 ? 'var(--primary)' : 'var(--danger)'};">${x.netto >= 0 ? '+' : ''}${formatVal(x.netto)}</strong></div>`).join('')}
        <div style="display:flex; justify-content:space-between; font-size:var(--fs-body); margin-top:4px; border-top:1px solid var(--border); padding-top:3px;"><span>Gesamtsaldo</span><strong style="color:${gesamt >= 0 ? 'var(--primary)' : 'var(--danger)'};">${gesamt >= 0 ? '+' : ''}${formatVal(gesamt)}</strong></div>
    </div>`;
}

// ---------- Entwicklungsprognose ----------

// Erwartete Stärke in 1, 2 und 3 Jahren (Spanne): fortgeschrieben mit derselben Entwicklungsregel wie am Saisonende
function getDevelopmentForecast(p, jahre = 3) {
    let tief = p.strength, hoch = p.strength;
    const arch = getPlayerArchetype(p);
    const ergebnis = [];
    for (let k = 0; k < jahre; k++) {
        const [min, max] = getDevelopmentRange({ age: (p.age || 25) + k, archetype: p.archetype || undefined, id: p.id });
        tief = Math.max(20, Math.min(99, tief + min));
        hoch = Math.max(20, Math.min(99, hoch + max));
        ergebnis.push({ jahr: k + 1, alter: (p.age || 25) + k + 1, tief, hoch });
    }
    return { arch, ergebnis };
}

function renderDevelopmentForecast(p) {
    const box = document.getElementById('pd-forecast');
    if (!box) return;
    if (!p.age) { box.innerHTML = ''; return; }
    const f = getDevelopmentForecast(p, 3);
    const letzter = f.ergebnis[f.ergebnis.length - 1];
    const trend = letzter.hoch > p.strength ? 'gut' : (letzter.tief < p.strength - 1 ? 'schlecht' : '');
    box.innerHTML = `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:10px 0 4px; text-align:left;">Entwicklungsprognose</div>
        <div class="ui-card-meta" style="justify-content:center;">${f.ergebnis.map(e => uiChip(`In ${e.jahr} J. (${e.alter}): ${e.tief === e.hoch ? e.tief : e.tief + '–' + e.hoch}`, e.jahr === 3 ? trend : '')).join('')}</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:4px; text-align:left;">${f.arch.icon} ${f.arch.name}: Höhepunkt mit etwa ${f.arch.peakAge} Jahren. Spanne aus der Alterungsregel, Training und Spielpraxis nicht eingerechnet.</div>`;
}
