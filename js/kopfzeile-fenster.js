// Kopfzeilen-Fenster: ein Tipp auf eine Kennzahl oben (Konto, Holding, Level, Fans/Vorstand, Spieltag)
// öffnet ein kleines Fenster mit den wichtigsten Zahlen, ein, zwei schnellen Einstellungen und dem Weg
// zur vollen Seite. Die Fenster lesen nur echte Daten; ändern lässt sich nur, was auch die Seite selbst
// ändert (Ticketpreise, Überweisung an die Holding, Aufstellungsvorlage) und das über deren Funktionen.

const KOPF_FENSTER_TITEL = {
    konto: '💶 Vereinskonto',
    holding: '🏢 Holding-Konto',
    level: '⭐ Manager-Level',
    stimmung: '📣 Fans und Vorstand',
    spieltag: '📅 Spieltag'
};

let kopfFensterArt = null;

function oeffneKopfFenster(art) {
    if (!KOPF_FENSTER_TITEL[art]) return;
    const overlay = document.getElementById('kopf-fenster-overlay');
    if (!overlay) return;
    kopfFensterArt = art;
    renderKopfFenster();
    overlay.setAttribute('aria-label', KOPF_FENSTER_TITEL[art].replace(/^\S+\s/, ''));
    overlay.classList.add('show');
    if (typeof mpFokusHalten === 'function') mpFokusHalten('kopf-fenster-overlay');
}

function schliesseKopfFenster() {
    const overlay = document.getElementById('kopf-fenster-overlay');
    if (overlay) overlay.classList.remove('show');
    const chip = kopfFensterArt && document.querySelector(`.kpi-chip[data-kopf="${kopfFensterArt}"]`);
    kopfFensterArt = null;
    if (chip) chip.focus();
}

// Vom Fenster auf die volle Seite.
function kopfFensterZurSeite(screenId) {
    schliesseKopfFenster();
    if (typeof showScreen === 'function') showScreen(screenId);
}

function renderKopfFenster() {
    const box = document.getElementById('kopf-fenster-inhalt');
    if (!box || !kopfFensterArt) return;
    const inhalt = {
        konto: kopfFensterKonto,
        holding: kopfFensterHolding,
        level: kopfFensterLevel,
        stimmung: kopfFensterStimmung,
        spieltag: kopfFensterSpieltag
    }[kopfFensterArt]();
    box.innerHTML = `<div class="panel-header">${KOPF_FENSTER_TITEL[kopfFensterArt]}</div>${inhalt}`;
}

// Zeile „Bezeichnung … Wert“.
function kopfZeile(label, wert) {
    return `<div class="kopf-zeile"><span>${label}</span><strong>${wert}</strong></div>`;
}

function kopfKnoepfe(knoepfe) {
    return `<div class="kopf-knoepfe">${knoepfe.map(([text, screenId, klasse]) =>
        `<button onclick="kopfFensterZurSeite('${screenId}')" class="${klasse || 'btn-action'}">${text}</button>`).join('')}</div>`;
}

function kopfVorzeichen(betrag) {
    return (betrag >= 0 ? '+' : '') + formatVal(betrag);
}

// ---------- Vereinskonto ----------

const KOPF_TICKET_STUFEN = [
    { key: 'guenstig', name: 'Günstig', faktor: 0.8 },
    { key: 'markt', name: 'Marktpreis', faktor: 1 },
    { key: 'premium', name: 'Premium', faktor: 1.25 }
];

function kopfTicketPreise(faktor) {
    const p = {};
    ['steh', 'sitz', 'vip'].forEach(k => { p[k] = Math.max(1, Math.round(getMarketTicketPrice(k) * faktor)); });
    return p;
}

function kopfFensterKonto() {
    const ledger = game.financeLedger || [];
    const letzte = ledger[ledger.length - 1];
    const f = typeof getLiquidityForecast === 'function' ? getLiquidityForecast() : null;
    const gehalt = squad.reduce((s, p) => s + (p.wage || 0), 0);
    let html = `<div class="ui-card-meta" style="margin-bottom:6px;">${uiChip(`Kasse ${formatVal(game.money)}`, game.money < 0 ? 'schlecht' : 'gut')}</div>`;
    if (letzte) {
        const netto = (letzte.summeEin || 0) - (letzte.summeAus || 0);
        html += kopfZeile(`Letzter Spieltag (${letzte.matchday}., ${letzte.heimspiel ? 'Heim' : 'Auswärts'})`, uiChip(kopfVorzeichen(netto), netto >= 0 ? 'gut' : 'schlecht'));
    }
    if (f && f.avg !== null) {
        html += kopfZeile('Ø je Spieltag', uiChip(kopfVorzeichen(f.avg), f.avg >= 0 ? 'gut' : 'schlecht'));
        const p = f.punkte[0];
        if (p && p.wert !== null) html += kopfZeile(`Vorschau in ${p.spt} Spieltag${p.spt === 1 ? '' : 'en'}`, formatVal(p.wert));
        if (f.minusIn) html += `<div class="box kopf-warnung">⚠️ Bei diesem Schnitt rutscht das Konto in etwa ${f.minusIn} Spieltagen ins Minus.</div>`;
    } else {
        html += `<div class="kopf-hinweis">Die Vorschau erscheint nach der ersten Spieltagsabrechnung.</div>`;
    }
    html += kopfZeile('Transferbudget', formatVal(game.transferBudget || 0));
    html += kopfZeile('Kadergehälter', `${formatVal(gehalt)}${game.wageBudget ? ` von ${formatVal(game.wageBudget)}` : ''}`);
    if (typeof getMarketTicketPrice === 'function' && game.ticketPrices) {
        const t = game.ticketPrices;
        html += `<div class="ui-overline kopf-abschnitt">Ticketpreise (Steh / Sitz / VIP)</div>
            <div class="kopf-hinweis">Jetzt ${t.steh} / ${t.sitz} / ${t.vip} €</div>
            <div class="kopf-knoepfe kopf-knoepfe-eng">${KOPF_TICKET_STUFEN.map(s => {
                const p = kopfTicketPreise(s.faktor);
                const aktiv = p.steh === t.steh && p.sitz === t.sitz && p.vip === t.vip;
                return `<button onclick="kopfSetzeTicketStufe('${s.key}')" class="${aktiv ? 'btn-action' : 'btn-secondary'}" title="${p.steh} / ${p.sitz} / ${p.vip} €">${s.name}</button>`;
            }).join('')}</div>`;
    }
    return html + kopfKnoepfe([['🏦 Zu den Finanzen', 'screen-finances']]);
}

function kopfSetzeTicketStufe(key) {
    const stufe = KOPF_TICKET_STUFEN.find(s => s.key === key);
    if (!stufe || typeof getMarketTicketPrice !== 'function') return;
    const p = kopfTicketPreise(stufe.faktor);
    const t = game.ticketPrices;
    if (p.steh === t.steh && p.sitz === t.sitz && p.vip === t.vip) { showToast(`Die Preise stehen schon auf „${stufe.name}“.`, 'info'); return; }
    t.steh = p.steh; t.sitz = p.sitz; t.vip = p.vip;
    if (typeof ticketPricePreview !== 'undefined') ticketPricePreview = null;
    if (typeof renderTicketPriceSliders === 'function') renderTicketPriceSliders();
    showToast(`🎟️ Ticketpreise „${stufe.name}“: ${p.steh} / ${p.sitz} / ${p.vip} €.`, 'success');
    renderKopfFenster();
    updateUI();
}

// ---------- Holding ----------

function kopfFensterHolding() {
    if (typeof istFreigeschaltet === 'function' && !istFreigeschaltet('holding')) {
        const b = typeof getFreischaltBereich === 'function' ? getFreischaltBereich('holding') : null;
        let fehlt = '';
        if (b && typeof getFreischaltStand === 'function') {
            const s = getFreischaltStand();
            fehlt = getFreischaltBedingungen(b).filter(c => !bedingungErfuellt(c, s)).map(c => `<li>${bedingungRest(c, s)}</li>`).join('');
        }
        return `<div class="box kopf-warnung">🔒 Die Holding ist noch gesperrt.${fehlt ? ` Es fehlt:<ul class="kopf-liste">${fehlt}</ul>` : ''}</div>
            ${kopfZeile('Holding-Konto', formatVal(holdingCompany.money))}
            ${kopfKnoepfe([['🌳 Alle Freischaltungen', 'screen-manager-tree']])}`;
    }
    const offen = (holdingCompany.b2bContracts || []).filter(c => !c.done);
    let html = `<div class="ui-card-meta" style="margin-bottom:6px;">${uiChip(`Konto ${formatVal(holdingCompany.money)}`, holdingCompany.money < 0 ? 'schlecht' : 'gut')}</div>`;
    if (typeof getHoldingValuation === 'function') html += kopfZeile('Unternehmenswert', formatVal(getHoldingValuation()));
    html += kopfZeile('Offene B2B-Aufträge', offen.length);
    if (offen.length) html += `<ul class="kopf-liste">${offen.slice(0, 3).map(c => `<li>${c.item} für ${c.club}: ${formatVal(c.payout)}</li>`).join('')}</ul>`;
    html += `<div class="ui-overline kopf-abschnitt">Vom Vereinskonto überweisen</div>
        <div class="kopf-knoepfe kopf-knoepfe-eng">${[10000, 50000, 100000].map(b => `<button onclick="kopfUeberweiseHolding(${b})" class="btn-secondary">${formatVal(b)}</button>`).join('')}</div>`;
    return html + kopfKnoepfe([['🏢 Zur Holding', 'screen-holding']]);
}

function kopfUeberweiseHolding(betrag) {
    if (typeof transferClubToHolding !== 'function') { showToast('Die Holding gibt es in dieser Fassung nicht.', 'error'); return; }
    const vorher = holdingCompany.money;
    transferClubToHolding(betrag);
    if (holdingCompany.money !== vorher) showToast(`🏢 ${formatVal(betrag)} an die Holding überwiesen.`, 'success');
    renderKopfFenster();
}

// ---------- Manager-Level ----------

function kopfFensterLevel() {
    const max = managerRPG.maxXp || 1;
    const anteil = Math.max(0, Math.min(1, managerRPG.xp / max));
    let html = `<div class="ui-card-meta" style="margin-bottom:6px;">${uiChip(`Level ${managerRPG.level}`, 'gut')}${managerRPG.points > 0 ? uiChip(`${managerRPG.points} Skill-Punkt${managerRPG.points === 1 ? '' : 'e'} frei`, 'warn') : ''}</div>`;
    html += kopfZeile('Erfahrung', `${managerRPG.xp} / ${max} XP`);
    html += `<div class="freischalt-balken"><span style="width:${Math.round(anteil * 100)}%;"></span></div>`;
    html += kopfZeile('Bis zum nächsten Level', `${Math.max(0, max - managerRPG.xp)} XP`);
    const n = typeof getNaechsteFreischaltung === 'function' ? getNaechsteFreischaltung() : null;
    if (n) html += `<div class="box" style="margin-top:8px;"><div class="ui-overline" style="color:var(--text-muted);">🔓 Nächste Freischaltung</div>
        <strong>${n.b.icon} ${n.b.name}</strong><div class="kopf-hinweis">Es fehlt: ${n.fehlt.join(', ')}</div></div>`;
    return html + kopfKnoepfe([['🌳 Zum Talentbaum', 'screen-manager-tree']]);
}

// ---------- Fans und Vorstand ----------

function kopfStimmungTon(wert) {
    return wert >= 70 ? 'gut' : (wert >= 45 ? 'warn' : 'schlecht');
}

function kopfFensterStimmung() {
    const fans = Math.round(game.fans), vorstand = Math.round(game.boardSat);
    let html = `<div class="ui-card-meta" style="margin-bottom:6px;">${uiChip(`Fans ${fans}%`, kopfStimmungTon(fans))}${uiChip(`Vorstand ${vorstand}%`, kopfStimmungTon(vorstand))}</div>`;
    const verlauf = game.boardSatVerlauf || [];
    if (verlauf.length >= 2) {
        const diff = verlauf[verlauf.length - 1] - verlauf[0];
        html += kopfZeile(`Vorstand über ${verlauf.length} Spieltage`, uiChip(`${diff >= 0 ? '+' : ''}${diff}`, diff >= 0 ? 'gut' : 'schlecht'));
    }
    const tabelle = typeof sortedTable === 'function' ? sortedTable(game.leagueLevel) : [];
    const platz = tabelle.findIndex(t => t.name === game.clubName) + 1;
    // Nur lesen: die Erwartung legt js/member-assembly.js zum Saisonstart an.
    const exp = game.seasonExpectation && game.seasonExpectation.season === game.season ? game.seasonExpectation : null;
    if (platz > 0) html += kopfZeile('Tabellenplatz', `${platz}.`);
    if (exp && exp.expectedRank) {
        const abstand = platz > 0 ? exp.expectedRank - platz : 0;
        html += kopfZeile('Erwartet', `${exp.expectedRank}. ${platz > 0 ? uiChip(abstand >= 0 ? 'im Soll' : `${-abstand} Plätze dahinter`, abstand >= 0 ? 'gut' : (abstand >= -3 ? 'warn' : 'schlecht')) : ''}`);
    }
    const warnungen = [];
    if (vorstand < 25) warnungen.push('Der Vorstand denkt über eine Entlassung nach.');
    else if (vorstand < 50) warnungen.push('Der Vorstand wird unruhig, die nächsten Ergebnisse zählen.');
    if (fans < 40) warnungen.push('Die Fans sind unzufrieden: Ticketpreise und Ergebnisse prüfen.');
    html += warnungen.map(w => `<div class="box kopf-warnung">⚠️ ${w}</div>`).join('');
    return html + kopfKnoepfe([['🏛️ Vorstandsraum', 'screen-vorstand-raum'], ['📣 Fans', 'screen-fans', 'btn-secondary']]);
}

// ---------- Spieltag ----------

// Die nächsten eigenen Ligaspiele ab dem aktuellen Spieltag.
function kopfNaechsteSpiele(anzahl) {
    const liga = leaguesData[game.leagueLevel] || [];
    const plan = (typeof fixturesData !== 'undefined' && fixturesData[game.leagueLevel]) || [];
    const tabelle = typeof sortedTable === 'function' ? sortedTable(game.leagueLevel) : [];
    const platzVon = name => tabelle.findIndex(t => t.name === name) + 1;
    const liste = [];
    for (let md = game.matchday; md <= 34 && liste.length < anzahl; md++) {
        const f = (plan[md - 1] || []).find(x => liga[x.home] && liga[x.away] && (liga[x.home].name === game.clubName || liga[x.away].name === game.clubName));
        if (!f) continue;
        const heim = liga[f.home].name === game.clubName;
        const gegner = liga[heim ? f.away : f.home];
        liste.push({ md, heim, gegner: gegner.name, platz: platzVon(gegner.name), derby: typeof isDerbyMatch === 'function' && isDerbyMatch(game.clubName, gegner.name) });
    }
    return liste;
}

function kopfFensterSpieltag() {
    if (game.matchday > 34) return `<div class="kopf-hinweis">Die Saison ist gespielt. Der Abschluss läuft über das Dashboard.</div>${kopfKnoepfe([['🏠 Zum Dashboard', 'screen-dashboard']])}`;
    const spiele = kopfNaechsteSpiele(4);
    const tabelle = typeof sortedTable === 'function' ? sortedTable(game.leagueLevel) : [];
    const eigen = tabelle.findIndex(t => t.name === game.clubName) + 1;
    const esc = typeof mpEsc === 'function' ? mpEsc : (x => x);
    let html = `<div class="ui-card-meta" style="margin-bottom:6px;">${uiChip(`Spieltag ${game.matchday} / 34`)}${eigen ? uiChip(`Platz ${eigen}`) : ''}</div>`;
    const n = spiele[0];
    if (n) {
        html += `<div class="box"><div class="ui-overline" style="color:var(--text-muted);">Nächstes Spiel</div>
            <strong>${n.heim ? 'Heim' : 'Auswärts'} gegen ${esc(n.gegner)}</strong>${n.platz ? ` (Platz ${n.platz})` : ''}${n.derby ? ` ${uiChip('Derby', 'warn')}` : ''}</div>`;
    }
    if (spiele.length > 1) html += `<ul class="kopf-liste">${spiele.slice(1).map(s => `<li>${s.md}. ${s.heim ? 'H' : 'A'} ${esc(s.gegner)}${s.platz ? ` (${s.platz}.)` : ''}</li>`).join('')}</ul>`;
    const probleme = typeof getLineupProblems === 'function' ? getLineupProblems() : [];
    if (probleme.length) html += probleme.slice(0, 3).map(p => `<div class="box kopf-warnung">⚠️ ${p.text}</div>`).join('');
    else html += `<div class="kopf-hinweis">✓ Die Startelf ist spielbereit.</div>`;
    const vorlagen = (game.lineupPresets || []).map((v, i) => v ? { v, i } : null).filter(Boolean);
    if (vorlagen.length && typeof loadLineupPreset === 'function') {
        html += `<div class="ui-overline kopf-abschnitt">Aufstellungsvorlage</div>
            <div class="kopf-knoepfe">${vorlagen.map(({ v, i }) => `<button onclick="kopfLadeVorlage(${i})" class="btn-secondary">📂 ${esc(v.name)}</button>`).join('')}</div>`;
    }
    return html + kopfKnoepfe([['👥 Aufstellung', 'screen-squad'], ['📅 Kalender', 'screen-calendar', 'btn-secondary']]);
}

function kopfLadeVorlage(slot) {
    loadLineupPreset(slot);
    renderKopfFenster();
}

// Enter und Leertaste öffnen das Fenster wie ein Tipp (die Chips sind role="button").
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const chip = e.target && e.target.closest ? e.target.closest('.kpi-chip[data-kopf]') : null;
    if (!chip) return;
    e.preventDefault();
    oeffneKopfFenster(chip.dataset.kopf);
});
