// ============================================================================
// PRIVATLEBEN, ERWEITERUNG (Phase 26.19): Sparkonto, Fortbildungen, Mentaltraining, Gehaltsverhandlung, Haustier,
// Besitz verkaufen, Finanzübersicht, Vermögensverlauf und private Ziele. Ergänzt js/private-life.js; der Zustand
// liegt in privateLife (Standardwerte in js/state.js, alte Stände bekommen sie über Object.assign beim Laden).
// Spielwirkung nur über den vorhandenen Weg: Stress senkt die Teamstärke (calcTeamStrength), XP über addManagerXP().
// ============================================================================

const PRIVAT_ZINS_JAHR = 0.03;
const PRIVAT_VERKAUF_ANTEIL = 0.7;
const MENTALTRAINING = { kosten: 8000, spieltage: 6, abklingzeit: 17 };

const PRIVAT_KURSE = [
    { id: 'sprache', name: 'Sprachkurs Englisch', kosten: 3000, xp: 120, stress: 3, prestige: 1, abklingzeit: 10, desc: 'Für Interviews mit internationalen Medien und neuen Spielern.' },
    { id: 'psychologie', name: 'Seminar Sportpsychologie', kosten: 6000, xp: 200, stress: -6, prestige: 1, abklingzeit: 12, desc: 'Lernen, mit Druck umzugehen - der Stress sinkt.' },
    { id: 'medien', name: 'Medientraining', kosten: 4000, xp: 100, stress: 2, prestige: 3, abklingzeit: 10, desc: 'Souverän vor der Kamera, das Ansehen steigt.' },
    { id: 'hospitation', name: 'Hospitation bei einem Spitzenklub', kosten: 12000, xp: 400, stress: 5, prestige: 2, abklingzeit: 17, desc: 'Eine Woche beim Training eines Spitzenvereins zuschauen.' }
];

const PRIVAT_HAUSTIERE = [
    { id: 'none', name: 'Kein Haustier', kosten: 0, unterhalt: 0, stress: 0, prestige: 0 },
    { id: 'katze', name: 'Katze', kosten: 800, unterhalt: 40, stress: 1, prestige: 0 },
    { id: 'hund', name: 'Hund', kosten: 1500, unterhalt: 80, stress: 2, prestige: 1 },
    { id: 'pferd', name: 'Reitpferd', kosten: 25000, unterhalt: 600, stress: 3, prestige: 3 }
];

function getPrivatExtrasStandard() {
    return { sparkonto: 0, kurseZuletzt: {}, haustier: 'none', verlauf: [], mentalBis: 0, mentalZuletzt: -999, gehaltVerhandeltSaison: 0 };
}

// Absoluter Spieltag über Saisons hinweg, für Abklingzeiten
function privatSpieltagAbs() { return game.season * 34 + game.matchday; }

function ensurePrivatExtras() {
    if (typeof privateLife.sparkonto !== 'number' || !Number.isFinite(privateLife.sparkonto)) privateLife.sparkonto = 0;
    if (!privateLife.kurseZuletzt || typeof privateLife.kurseZuletzt !== 'object') privateLife.kurseZuletzt = {};
    if (!PRIVAT_HAUSTIERE.some(h => h.id === privateLife.haustier)) privateLife.haustier = 'none';
    if (!Array.isArray(privateLife.verlauf)) privateLife.verlauf = [];
    if (typeof privateLife.mentalBis !== 'number') privateLife.mentalBis = 0;
    if (typeof privateLife.mentalZuletzt !== 'number') privateLife.mentalZuletzt = -999;
    if (typeof privateLife.gehaltVerhandeltSaison !== 'number') privateLife.gehaltVerhandeltSaison = 0;
}

// ---------- Besitz verkaufen ----------
function sellLifestyleAsset(assetId) {
    const a = LIFESTYLE_ASSETS.find(x => x.id === assetId);
    if (!a || !privateLife.assets.includes(assetId)) { showToast('Diesen Besitz hast du nicht.', 'error'); return false; }
    const erloes = Math.round(a.cost * PRIVAT_VERKAUF_ANTEIL);
    privateLife.assets = privateLife.assets.filter(x => x !== assetId);
    privateLife.money += erloes;
    privateLife.prestige = Math.max(0, privateLife.prestige - a.prestige);
    renderPrivateLifeView();
    showToast(`🏷️ ${a.name} verkauft: +${formatVal(erloes)} (-${a.prestige} Prestige).`, 'success');
    return true;
}

// ---------- Sparkonto ----------
function privatSparen(betrag) {
    ensurePrivatExtras();
    if (!betrag || betrag <= 0 || privateLife.money < betrag) { showToast('Ungültiger Betrag oder nicht genug Privatvermögen.', 'error'); return false; }
    privateLife.money -= betrag;
    privateLife.sparkonto += betrag;
    renderPrivateLifeView();
    showToast(`🐷 ${formatVal(betrag)} aufs Sparkonto gelegt.`, 'success');
    return true;
}

function privatAbheben(betrag) {
    ensurePrivatExtras();
    if (!betrag || betrag <= 0 || privateLife.sparkonto < betrag) { showToast('Ungültiger Betrag oder zu wenig auf dem Sparkonto.', 'error'); return false; }
    privateLife.sparkonto -= betrag;
    privateLife.money += betrag;
    renderPrivateLifeView();
    showToast(`🐷 ${formatVal(betrag)} vom Sparkonto abgehoben.`, 'success');
    return true;
}

function getPrivatZinsenProSpieltag() {
    ensurePrivatExtras();
    return Math.round(privateLife.sparkonto * PRIVAT_ZINS_JAHR / 34);
}

// ---------- Fortbildungen ----------
function getKursRest(k) {
    ensurePrivatExtras();
    const zuletzt = privateLife.kurseZuletzt[k.id];
    return typeof zuletzt === 'number' ? Math.max(0, zuletzt + k.abklingzeit - privatSpieltagAbs()) : 0;
}

function besucheKurs(kursId) {
    const k = PRIVAT_KURSE.find(x => x.id === kursId);
    if (!k) return false;
    const rest = getKursRest(k);
    if (rest > 0) { showToast(`${k.name}: wieder in ${rest} Spieltag${rest === 1 ? '' : 'en'} möglich.`, 'error'); return false; }
    if (privateLife.money < k.kosten) { showToast(`Privatvermögen reicht nicht: ${formatVal(k.kosten)} nötig.`, 'error'); return false; }
    privateLife.money -= k.kosten;
    privateLife.stress = Math.max(0, Math.min(100, privateLife.stress + k.stress));
    privateLife.prestige += k.prestige;
    privateLife.kurseZuletzt[k.id] = privatSpieltagAbs();
    if (typeof addManagerXP === 'function') addManagerXP(k.xp);
    renderPrivateLifeView();
    updateUI();
    showToast(`🎓 ${k.name}: +${k.xp} Erfahrung, Stress ${k.stress > 0 ? '+' : ''}${k.stress} %, +${k.prestige} Prestige.`, 'success', 4000);
    return true;
}

// ---------- Mentaltraining ----------
// Halbiert sechs Spieltage lang den Stresszuwachs nach Niederlagen und Remis (match-live.js, wie „Eiserne Nerven“)
function istMentaltrainingAktiv() {
    ensurePrivatExtras();
    return privateLife.mentalBis > privatSpieltagAbs();
}

function bucheMentaltraining() {
    ensurePrivatExtras();
    if (istMentaltrainingAktiv()) { showToast('Das Mentaltraining läuft noch.', 'error'); return false; }
    const rest = Math.max(0, privateLife.mentalZuletzt + MENTALTRAINING.abklingzeit - privatSpieltagAbs());
    if (rest > 0) { showToast(`Mentaltraining wieder in ${rest} Spieltag${rest === 1 ? '' : 'en'} möglich.`, 'error'); return false; }
    if (privateLife.money < MENTALTRAINING.kosten) { showToast(`Privatvermögen reicht nicht: ${formatVal(MENTALTRAINING.kosten)} nötig.`, 'error'); return false; }
    privateLife.money -= MENTALTRAINING.kosten;
    privateLife.mentalZuletzt = privatSpieltagAbs();
    privateLife.mentalBis = privatSpieltagAbs() + MENTALTRAINING.spieltage;
    renderPrivateLifeView();
    showToast(`🧘 Mentaltraining gebucht: ${MENTALTRAINING.spieltage} Spieltage halber Stress nach Rückschlägen.`, 'success', 4000);
    return true;
}

// ---------- Gehaltsverhandlung (einmal je Saison) ----------
function getGehaltsChance() {
    const tab = typeof sortedTable === 'function' ? sortedTable(game.leagueLevel) : [];
    const platz = tab.findIndex(t => t.name === game.clubName) + 1;
    const obereHaelfte = platz > 0 && platz <= Math.ceil(tab.length / 2);
    return Math.max(0.05, Math.min(0.9, (game.boardSat || 0) / 100 * 0.7 + (obereHaelfte ? 0.2 : 0)));
}

function verhandleGehalt() {
    ensurePrivatExtras();
    if (privateLife.gehaltVerhandeltSaison === game.season) { showToast('Diese Saison hast du schon verhandelt.', 'error'); return null; }
    privateLife.gehaltVerhandeltSaison = game.season;
    const erfolg = Math.random() < getGehaltsChance();
    if (erfolg) {
        const alt = privateLife.wage;
        privateLife.wage = Math.round(alt * 1.15);
        showToast(`🤝 Der Vorstand erhöht dein Gehalt: ${formatVal(alt)} → ${formatVal(privateLife.wage)} je Spieltag.`, 'success', 4500);
    } else {
        game.boardSat = Math.max(0, (game.boardSat || 0) - 3);
        showToast('🤝 Der Vorstand lehnt ab und ist etwas verstimmt (Vorstand -3).', 'error', 4500);
    }
    renderPrivateLifeView();
    updateUI();
    return erfolg;
}

// ---------- Haustier ----------
function setHaustier(id) {
    ensurePrivatExtras();
    const h = PRIVAT_HAUSTIERE.find(x => x.id === id);
    if (!h || h.id === privateLife.haustier) { renderPrivateLifeView(); return false; }
    if (privateLife.money < h.kosten) { showToast(`Privatvermögen reicht nicht: ${formatVal(h.kosten)} nötig.`, 'error'); renderPrivateLifeView(); return false; }
    const alt = PRIVAT_HAUSTIERE.find(x => x.id === privateLife.haustier);
    privateLife.money -= h.kosten;
    privateLife.prestige = Math.max(0, privateLife.prestige - (alt ? alt.prestige : 0) + h.prestige);
    privateLife.haustier = h.id;
    renderPrivateLifeView();
    showToast(h.id === 'none' ? '🐾 Dein Haustier lebt jetzt bei Freunden.' : `🐾 Willkommen, ${h.name}!`, 'success');
    return true;
}

// ---------- Spieltag: Zinsen, Erträge, Haustier ----------
// Aus processPrivateLifeMatchday()
function processPrivatExtrasSpieltag() {
    ensurePrivatExtras();
    privateLife.sparkonto += getPrivatZinsenProSpieltag();
    privateLife.money += getBesitzErtraege();
    const h = PRIVAT_HAUSTIERE.find(x => x.id === privateLife.haustier);
    if (h && h.id !== 'none') {
        privateLife.money -= h.unterhalt;
        privateLife.stress = Math.max(0, privateLife.stress - h.stress);
    }
}

function getBesitzErtraege() {
    return LIFESTYLE_ASSETS.filter(a => a.income && privateLife.assets.includes(a.id)).reduce((t, a) => t + a.income, 0);
}

// ---------- Finanzübersicht je Spieltag ----------
function getPrivatFinanzen() {
    ensurePrivatExtras();
    const hobby = HOBBIES.find(h => h.id === privateLife.hobby), rel = RELATIONSHIP_STATUSES.find(r => r.id === privateLife.relationship);
    const tier = PRIVAT_HAUSTIERE.find(x => x.id === privateLife.haustier);
    const posten = [
        ['Gehalt', privateLife.wage],
        ['Erträge aus Besitz', getBesitzErtraege()],
        ['Zinsen Sparkonto', getPrivatZinsenProSpieltag()],
        ['Hobby', -(hobby ? hobby.wageCost : 0)],
        ['Beziehung', -(rel ? rel.wageCost : 0)],
        ['Haustier', -(tier ? tier.unterhalt : 0)],
        ['Assistent', privateLife.assistantHired ? -400 : 0]
    ].filter(x => x[1] !== 0);
    return { posten, saldo: posten.reduce((t, x) => t + x[1], 0), stressMalus: (privateLife.stress || 0) * 0.03 };
}

// ---------- Vermögen und Verlauf ----------
function getPrivatVermoegen() {
    ensurePrivatExtras();
    const besitz = LIFESTYLE_ASSETS.filter(a => privateLife.assets.includes(a.id)).reduce((t, a) => t + Math.round(a.cost * PRIVAT_VERKAUF_ANTEIL), 0);
    return privateLife.money + privateLife.sparkonto + besitz;
}

// Saisonende (concludeSeasonAndAdvance): Vermögen festhalten, höchstens 20 Saisons
function archivePrivatVermoegen() {
    ensurePrivatExtras();
    privateLife.verlauf = privateLife.verlauf.filter(x => x.season !== game.season).concat({ season: game.season, wert: getPrivatVermoegen() }).slice(-20);
}

// ---------- Private Ziele ----------
function getPrivatZiele() {
    const vermoegen = getPrivatVermoegen();
    const wohnen = LIFESTYLE_ASSETS.filter(a => a.category === 'Wohnen');
    const anteil = (ist, soll) => Math.max(0, Math.min(1, ist / soll));
    return [
        { text: 'Vermögen 100.000 €', anteil: anteil(vermoegen, 100000) },
        { text: 'Vermögen 1 Mio. €', anteil: anteil(vermoegen, 1000000) },
        { text: 'Vermögen 10 Mio. €', anteil: anteil(vermoegen, 10000000) },
        { text: '50 Prestige', anteil: anteil(privateLife.prestige, 50) },
        { text: '100 Prestige', anteil: anteil(privateLife.prestige, 100) },
        { text: 'UEFA-Pro-Lizenz', anteil: anteil(privateLife.license, licenseConfig.length - 1) },
        { text: 'Alle Wohnobjekte', anteil: anteil(wohnen.filter(a => privateLife.assets.includes(a.id)).length, wohnen.length) },
        { text: 'Autobiografie veröffentlicht', anteil: privateLife.autobiographyWritten ? 1 : 0 },
        { text: 'Alle Fortbildungen besucht', anteil: anteil(PRIVAT_KURSE.filter(k => typeof privateLife.kurseZuletzt[k.id] === 'number').length, PRIVAT_KURSE.length) }
    ];
}

// ---------- Darstellung ----------
function renderPrivateLifeExtras() {
    ensurePrivatExtras();
    const geld = x => `<strong style="color:${x < 0 ? 'var(--danger)' : 'var(--text-main)'};">${x > 0 ? '+' : ''}${formatVal(x)}</strong>`;
    const zeile = (l, r) => `<div class="box" style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-small); margin:2px 0;"><span style="overflow-wrap:anywhere;">${l}</span><span style="flex:0 0 auto;">${r}</span></div>`;
    const raster = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 9em), 1fr)); gap:6px; margin:6px 0;';
    const fin = getPrivatFinanzen();
    const finanzBox = document.getElementById('priv-finanz-box');
    if (finanzBox) {
        const chance = Math.round(getGehaltsChance() * 100), verhandelt = privateLife.gehaltVerhandeltSaison === game.season;
        finanzBox.innerHTML = `<div class="panel-header">🐷 Sparkonto und Finanzen</div>
            ${zeile('Sparkonto', `<strong>${formatVal(privateLife.sparkonto)}</strong> · ${Math.round(PRIVAT_ZINS_JAHR * 100)} % Zinsen im Jahr`)}
            <label class="ui-field"><span class="ui-field-label">Betrag</span><input type="number" id="priv-spar-input" class="input-inline" placeholder="Betrag in €" style="width:100%;"></label>
            <div style="${raster}"><button onclick="privatSparen(parseInt(document.getElementById('priv-spar-input').value) || 0)" class="btn-action">🐷 Einzahlen</button>
                <button onclick="privatAbheben(parseInt(document.getElementById('priv-spar-input').value) || 0)" class="btn-secondary">💶 Abheben</button></div>
            <div class="ui-overline" style="margin-top:6px;">Je Spieltag</div>
            ${fin.posten.map(([n, v]) => zeile(n, geld(v))).join('')}${zeile('<strong>Saldo</strong>', geld(fin.saldo))}
            <div style="font-size:var(--fs-caption); color:var(--text-muted); margin:4px 0;">Dein Stress kostet die Mannschaft zurzeit ${fin.stressMalus.toFixed(1)} Punkte Teamstärke.</div>
            <div class="ui-overline" style="margin-top:6px;">Gehaltsverhandlung</div>
            <div style="font-size:var(--fs-small); margin:4px 0;">Einmal je Saison: +15 % Gehalt, bei Ablehnung Vorstand -3. Chance jetzt ${chance} % (Vorstandszufriedenheit und Tabellenplatz).</div>
            <button onclick="verhandleGehalt()" class="btn-secondary"${verhandelt ? ' disabled' : ''}>🤝 ${verhandelt ? 'Diese Saison schon verhandelt' : 'Mehr Gehalt fordern'}</button>`;
    }
    const kursBox = document.getElementById('priv-kurse-box');
    if (kursBox) {
        const mentalAktiv = istMentaltrainingAktiv();
        const mentalRest = Math.max(0, privateLife.mentalZuletzt + MENTALTRAINING.abklingzeit - privatSpieltagAbs());
        kursBox.innerHTML = `<div class="panel-header">🎓 Fortbildung und Mentaltraining</div>
            ${PRIVAT_KURSE.map(k => { const rest = getKursRest(k); return `<div class="player-row"><span><strong>${k.name}</strong><br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${k.desc} +${k.xp} Erfahrung, Stress ${k.stress > 0 ? '+' : ''}${k.stress} %, +${k.prestige} Prestige.</span></span>
                <button onclick="besucheKurs('${k.id}')" class="btn-action" style="width:auto; font-size:var(--fs-caption);"${rest > 0 ? ' disabled' : ''}>${rest > 0 ? `Noch ${rest} SpT` : formatVal(k.kosten)}</button></div>`; }).join('')}
            <div class="player-row"><span><strong>🧘 Mentaltraining</strong><br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${MENTALTRAINING.spieltage} Spieltage lang steigt dein Stress nach Niederlagen und Remis nur halb so stark.${mentalAktiv ? ` Aktiv bis Spieltag ${privateLife.mentalBis - game.season * 34}.` : ''}</span></span>
                <button onclick="bucheMentaltraining()" class="btn-action" style="width:auto; font-size:var(--fs-caption);"${mentalAktiv || mentalRest > 0 ? ' disabled' : ''}>${mentalAktiv ? 'Aktiv' : mentalRest > 0 ? `Noch ${mentalRest} SpT` : formatVal(MENTALTRAINING.kosten)}</button></div>`;
    }
    const tierSel = document.getElementById('priv-haustier-select');
    if (tierSel) {
        tierSel.innerHTML = PRIVAT_HAUSTIERE.map(h => `<option value="${h.id}"${privateLife.haustier === h.id ? ' selected' : ''}>${h.name}${h.kosten ? ` (${formatVal(h.kosten)})` : ''}</option>`).join('');
        const h = PRIVAT_HAUSTIERE.find(x => x.id === privateLife.haustier);
        const desc = document.getElementById('priv-haustier-desc');
        if (desc) desc.innerText = h && h.id !== 'none' ? `-${h.stress} % Stress je Spieltag, Unterhalt ${formatVal(h.unterhalt)} je Spieltag${h.prestige ? `, +${h.prestige} Prestige` : ''}.` : 'Ein Haustier senkt den Stress jeden Spieltag ein wenig.';
    }
    const zielBox = document.getElementById('priv-ziele-box');
    if (zielBox) {
        const punkte = [...privateLife.verlauf.map(x => ({ kurz: String(x.season), wert: x.wert })), { kurz: 'jetzt', wert: getPrivatVermoegen() }];
        let kurve = `<div style="font-size:var(--fs-small);">Vermögen heute ${formatVal(punkte[punkte.length - 1].wert)} (Bargeld, Sparkonto und Besitz zum Verkaufswert). Nach dem ersten Saisonende entsteht hier die Kurve.</div>`;
        if (punkte.length >= 2) {
            const w = 300, h = 80, pad = 8, max = Math.max(...punkte.map(x => x.wert)), min = Math.min(...punkte.map(x => x.wert)), sp = Math.max(1, max - min);
            const xy = (x, i) => `${(pad + i * (w - pad * 2) / (punkte.length - 1)).toFixed(1)},${(h - pad - (x.wert - min) / sp * (h - pad * 2)).toFixed(1)}`;
            kurve = `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px; display:block;" role="img" aria-label="Vermögensverlauf"><polyline points="${punkte.map(xy).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2" /></svg>
                <div style="font-size:var(--fs-caption); color:var(--text-muted);">${punkte.map(x => `${x.kurz}: ${formatVal(x.wert)}`).join(' · ')}</div>`;
        }
        zielBox.innerHTML = `<div class="panel-header">📈 Vermögen und Ziele</div>${kurve}
            <div class="ui-overline" style="margin-top:6px;">Private Ziele</div>
            ${getPrivatZiele().map(z => zeile(`${z.anteil >= 1 ? '✅' : '⬜'} ${z.text}`, z.anteil >= 1 ? '<strong style="color:var(--primary);">erreicht</strong>' : `${Math.floor(z.anteil * 100)} %`)).join('')}`;
    }
}
