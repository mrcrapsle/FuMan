// ============================================================================
// ADMIN-WERKZEUGE (Phase 26.19): Test- und Diagnosewerkzeuge im Admin-Modus, ergänzend zu js/admin.js.
// Diagnosen lesen nur; alles andere ändert den Spielstand erst auf Tipp. Container: #admin-tools-box.
// ============================================================================

const ADMIN_POSITIONEN = ['TW', 'ABW', 'MIT', 'ST'];
const ADMIN_BEDIEN_SCHLUESSEL = ['anstoss_fm13_favoriten', 'anstoss_fm13_kaderansicht'];
let adminSpielerId = null;
let adminZufallAlt = null;

function adminZahl(id, min, max) {
    const el = document.getElementById(id);
    const v = el && String(el.value).trim() !== '' ? Number(el.value) : NaN;
    return Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null;
}

function adminSpielerOptionen(gewaehlt) {
    return squad.map(p => `<option value="${p.id}"${p.id === gewaehlt ? ' selected' : ''}>${mpEsc(p.name)} (${p.pos}, ${p.strength})</option>`).join('');
}

// ---------- 1. Spieler-Editor ----------
function adminSpielerWaehlen(id) {
    adminSpielerId = id;
    renderAdminTools();
}

function adminSpielerUebernehmen() {
    const p = squad.find(x => x.id === adminSpielerId);
    if (!p) { showToast('Bitte zuerst einen Spieler aus dem Kader wählen.', 'error'); return false; }
    const werte = { strength: adminZahl('adm-sp-staerke', 1, 99), age: adminZahl('adm-sp-alter', 15, 45), contracts: adminZahl('adm-sp-vertrag', 1, 10),
        fitness: adminZahl('adm-sp-fitness', 0, 100), morale: adminZahl('adm-sp-moral', 0, 100) };
    if (Object.values(werte).some(v => v === null)) { showToast('Bitte in jedes Feld eine Zahl eintragen.', 'error'); return false; }
    Object.assign(p, werte);
    const pos = document.getElementById('adm-sp-pos');
    if (pos && ADMIN_POSITIONEN.includes(pos.value)) p.pos = pos.value;
    if (typeof calculatePlayerMarketValue === 'function') p.marketValue = calculatePlayerMarketValue(p.strength);
    updateUI();
    renderAdminView();
    showToast(`🛠️ ${p.name}: Stärke ${p.strength}, ${p.age} J., Vertrag ${p.contracts}, Fitness ${p.fitness} %, Moral ${p.morale}, ${p.pos}.`, 'success', 4000);
    return true;
}

// ---------- 2. Bis Saisonende vorspulen ----------
function adminBisSaisonende() {
    if (game.matchday > 34) { showToast('Alle 34 Spieltage sind gespielt - jetzt die Saison abschließen.', 'error'); return; }
    adminAdvanceMatchdays(35 - game.matchday);
}

// ---------- 3. Wetter für den nächsten Spieltag ----------
function adminWetterSetzen() {
    const sel = document.getElementById('adm-wetter');
    const i = sel ? Number(sel.value) : -1;
    if (!WEATHER_TYPES[i]) { showToast('Bitte ein Wetter wählen.', 'error'); return; }
    game.adminWetter = i;
    renderAdminTools();
    showToast(`${WEATHER_TYPES[i].icon} Nächster Spieltag: ${WEATHER_TYPES[i].name}.`, 'success');
}

// ---------- 4. Stärke des nächsten Ligagegners ----------
function adminGegnerStaerkeSetzen() {
    const m = typeof getNextLeagueMatch === 'function' ? getNextLeagueMatch() : null;
    if (!m) { showToast('Kein nächstes Ligaspiel gefunden.', 'error'); return; }
    const v = adminZahl('adm-gegner-staerke', 1, 99);
    if (v === null) { showToast('Bitte eine Stärke zwischen 1 und 99 eintragen.', 'error'); return; }
    m.opp.strength = v;
    m.opp.baseStrength = v;
    renderAdminTools();
    showToast(`🎯 ${m.opp.name}: Stärke ${v}.`, 'success');
}

// ---------- 5. Transfermarkt neu erzeugen ----------
function adminMarktNeu() {
    refreshTransferMarket();
    showToast(`🔄 Transfermarkt neu erzeugt: ${marketPlayers.length} Spieler.`, 'success');
}

// ---------- 6. Transferangebot erzwingen ----------
function adminAngebotErzwingen() {
    const sel = document.getElementById('adm-angebot-spieler');
    const p = sel ? squad.find(x => x.id === sel.value) : null;
    if (!p) { showToast('Bitte einen Spieler wählen.', 'error'); return false; }
    if (incomingOffers.some(o => o.playerId === p.id)) { showToast(`Für ${p.name} liegt schon ein Angebot vor.`, 'error'); return false; }
    const vorher = incomingOffers.length;
    triggerNewAITransferOffer(p);
    if (incomingOffers.length === vorher) { showToast(`Kein Verein hat für ${p.name} geboten.`, 'error'); return false; }
    updateUI();
    showToast(`📨 Angebot für ${p.name}: ${formatVal(incomingOffers[0].currentBid)} von ${incomingOffers[0].clubName || 'einem Verein'}.`, 'success', 4000);
    return true;
}

// ---------- 7. Jugendtalent ohne Kosten ----------
function adminJugendtalent() {
    if (youthTalents.length >= getYouthAcademyCapacity()) { showToast('Jugendkader-Kapazität erreicht.', 'error'); return; }
    bucheMitLabel('🛠️ Admin', getYouthScoutCost()); // gleicht die Scouting-Kosten im Kontoauszug aus
    scoutYouthTalent();
}

// ---------- 8. Teamstärke-Diagnose ----------
// Dieselbe Basis wie calcTeamStrength() (match.js); die benannten Posten sind einzeln gerechnet, der Rest fasst Stab,
// Campus, Fans, Merkmale, Rollen und Kapitän zusammen.
function getAdminStaerkeDiagnose() {
    const starting = squad.filter(p => lineup.includes(p.id));
    if (!starting.length) return null;
    const basis = starting.reduce((acc, p) => acc + p.strength * (p.fitness / 100) * (0.9 + (p.dailyForm ?? 50) / 500), 0) / Math.max(11, starting.length);
    const moral = (starting.reduce((acc, p) => acc + (p.morale || 80), 0) / starting.length - 80) * 0.06;
    const posten = [
        ['Startelf (Stärke, Fitness, Tagesform)', basis],
        ['Trainerlizenz', licenseConfig[privateLife.license].boost],
        ['Stress des Managers', -(privateLife.stress || 0) * 0.03],
        ['Moral', moral],
        ['Eingespieltheit', getLineupChemistryStats().bonus],
        ['Spielstil', getTacticStyleBonus(game.tacticStyle)],
        ['Formation', getFormationOffBonus()],
        ['Zweikampfhärte', getTackleHardnessBonus(game.tackleHardness)]
    ];
    const auswaerts = calcTeamStrength(false), heim = calcTeamStrength(true);
    const summe = posten.reduce((t, x) => t + x[1], 0);
    posten.push(['Übrige Boni (Stab, Campus, Fans, Merkmale …), gerundet', auswaerts - summe]);
    return { posten, heim, auswaerts, spieler: starting.length };
}

// ---------- 9. Speicher-Diagnose ----------
function getAdminSpeicherDiagnose() {
    const state = buildSaveState();
    const teile = Object.keys(state).map(k => ({ k, n: JSON.stringify(state[k] === undefined ? null : state[k]).length })).sort((a, b) => b.n - a.n);
    const spiel = Object.keys(game).map(k => ({ k: 'game.' + k, n: JSON.stringify(game[k] === undefined ? null : game[k]).length })).sort((a, b) => b.n - a.n);
    const geraet = [];
    try {
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('anstoss_fm13_')) geraet.push({ k, n: (safeLocalGet(k) || '').length }); }
    } catch (e) { /* Android WebView auf file:// blockiert localStorage */ }
    return { gesamt: JSON.stringify(state).length, teile: teile.slice(0, 6), spiel: spiel.slice(0, 6), geraet: geraet.sort((a, b) => b.n - a.n) };
}

function adminBedienEinstellungenZuruecksetzen() {
    ADMIN_BEDIEN_SCHLUESSEL.forEach(k => safeLocalRemove(k));
    if (typeof renderFavoritenLeiste === 'function') renderFavoritenLeiste();
    renderAdminTools();
    showToast('🧹 Favoriten und Kaderansicht zurückgesetzt.', 'success');
}

// ---------- 10. Datenprüfung und Reparatur ----------
const ADMIN_ZAHLFELDER = { strength: 50, fitness: 100, morale: 80, wage: 1000, marketValue: 100000, age: 25, contracts: 1 };

function getAdminDatenpruefung() {
    const befunde = [];
    const ids = new Set();
    squad.forEach(p => {
        if (ids.has(p.id)) befunde.push(`Doppelte Spieler-ID ${p.id} (${p.name})`);
        ids.add(p.id);
        Object.keys(ADMIN_ZAHLFELDER).forEach(f => { if (typeof p[f] !== 'number' || !Number.isFinite(p[f])) befunde.push(`${p.name}: ${f} ist keine Zahl`); });
        if ((p.contracts || 0) < 1) befunde.push(`${p.name}: Vertrag ${p.contracts}`);
    });
    lineup.forEach(id => { if (!squad.some(p => p.id === id)) befunde.push(`Aufstellung enthält unbekannte ID ${id}`); });
    if (new Set(lineup).size !== lineup.length) befunde.push('Aufstellung enthält einen Spieler doppelt');
    ['money', 'transferBudget', 'wageBudget', 'fans', 'boardSat'].forEach(f => { if (typeof game[f] !== 'number' || !Number.isFinite(game[f])) befunde.push(`game.${f} ist keine Zahl`); });
    return befunde;
}

function adminDatenReparieren() {
    const vorher = getAdminDatenpruefung().length;
    if (!vorher) { showToast('✓ Keine Auffälligkeiten - nichts zu reparieren.', 'success'); return 0; }
    const ids = new Set();
    squad = squad.filter(p => { if (ids.has(p.id)) return false; ids.add(p.id); return true; });
    squad.forEach(p => {
        Object.keys(ADMIN_ZAHLFELDER).forEach(f => { if (typeof p[f] !== 'number' || !Number.isFinite(p[f])) p[f] = ADMIN_ZAHLFELDER[f]; });
        if (p.contracts < 1) p.contracts = 1;
    });
    lineup = [...new Set(lineup.filter(id => squad.some(p => p.id === id)))];
    if (lineup.length < 11) autoLineup();
    ['money', 'transferBudget', 'wageBudget'].forEach(f => { if (typeof game[f] !== 'number' || !Number.isFinite(game[f])) game[f] = 0; });
    ['fans', 'boardSat'].forEach(f => { if (typeof game[f] !== 'number' || !Number.isFinite(game[f])) game[f] = 50; });
    const nachher = getAdminDatenpruefung().length;
    updateUI();
    renderAdminView();
    showToast(`🔧 ${vorher - nachher} von ${vorher} Auffälligkeiten repariert.`, nachher ? 'error' : 'success', 4000);
    return vorher - nachher;
}

// ---------- 11. Sicherungspunkt (nur in dieser Sitzung) ----------
let adminSicherung = null;

function adminSicherungSetzen() {
    adminSicherung = { json: JSON.stringify(buildSaveState()), season: game.season, matchday: game.matchday };
    renderAdminTools();
    showToast(`📌 Sicherungspunkt gesetzt (Saison ${game.season}, Spieltag ${game.matchday}).`, 'success');
}

function adminSicherungLaden() {
    if (!adminSicherung) { showToast('Es gibt noch keinen Sicherungspunkt.', 'error'); return false; }
    if (!loadSaveSafely(adminSicherung.json, { label: 'Admin-Sicherungspunkt' })) return false;
    updateUI();
    renderAdminView();
    showToast(`⏪ Zurück zu Saison ${adminSicherung.season}, Spieltag ${adminSicherung.matchday}.`, 'success');
    return true;
}

// ---------- 12. Bildschirm direkt öffnen ----------
function adminBildschirmOeffnen() {
    const sel = document.getElementById('adm-bildschirm');
    if (!sel || !document.getElementById(sel.value)) { showToast('Bitte einen Bildschirm wählen.', 'error'); return; }
    showScreen(sel.value);
}

// ---------- 13. Zufall festlegen (bis zum Neuladen) ----------
function adminZufallFestlegen() {
    const seed = adminZahl('adm-seed', 1, 2147483647);
    if (seed === null) { showToast('Bitte eine ganze Zahl als Startwert eintragen.', 'error'); return; }
    if (!adminZufallAlt) adminZufallAlt = Math.random;
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    renderAdminTools();
    showToast(`🎲 Zufall festgelegt (Startwert ${seed}) - gleiche Abläufe ergeben gleiche Ergebnisse.`, 'success', 4000);
}

function adminZufallZuruecksetzen() {
    if (!adminZufallAlt) { showToast('Der Zufall ist nicht festgelegt.', 'error'); return; }
    Math.random = adminZufallAlt;
    adminZufallAlt = null;
    renderAdminTools();
    showToast('🎲 Zufall wieder frei.', 'success');
}

// ---------- 14. Zeichenzeiten messen ----------
const ADMIN_MESS_ANSICHTEN = [['Dashboard', 'renderDashboardView'], ['Kader', 'renderSquadView'], ['Transfermarkt', 'renderTransferView'], ['Liga-Tabelle', 'renderLeagueView'], ['Finanzen', 'renderFinancesView'], ['Postfach', 'renderInboxView']];
let adminMessung = null;

function adminZeitenMessen() {
    adminMessung = ADMIN_MESS_ANSICHTEN.filter(([, fn]) => typeof window[fn] === 'function').map(([name, fn]) => {
        const t0 = performance.now();
        for (let i = 0; i < 3; i++) window[fn]();
        return { name, ms: (performance.now() - t0) / 3 };
    });
    renderAdminTools();
    showToast('⏱️ Zeichenzeiten gemessen.', 'success');
}

// ---------- 15. Alle Erfolge freischalten ----------
function adminAlleErfolge() {
    if (!game.achievements) game.achievements = [];
    let neu = 0;
    ACHIEVEMENT_DEFINITIONS.forEach(def => {
        if (game.achievements.some(a => a.id === def.id)) return;
        game.achievements.push({ id: def.id, season: game.season, matchday: game.matchday });
        neu++;
    });
    renderAdminTools();
    showToast(neu ? `🎖️ ${neu} Erfolg${neu === 1 ? '' : 'e'} freigeschaltet.` : 'Alle Erfolge sind schon freigeschaltet.', neu ? 'success' : 'error');
    return neu;
}

// ---------- Darstellung ----------
// ---------- 17. Freischaltungen (js/freischaltungen.js) ----------
// Je Gerät: alle gesperrten Bereiche zum Testen öffnen. Die Testsuite setzt stattdessen ein Kennzeichen
// im Fenster (tests/run-tests.js): Schreiben in den Gerätespeicher vor dem Seitenstart verlor dort andere Werte.
const ADMIN_ALLES_FREI_KEY = 'anstoss_fm13_alles_frei';
function adminAlleFreigeschaltet() {
    if (window.anstossTestAllesFrei === true) return true;
    return typeof safeLocalGet === 'function' && safeLocalGet(ADMIN_ALLES_FREI_KEY) === '1';
}
function adminFreischaltungenUmschalten() {
    if (adminAlleFreigeschaltet()) safeLocalRemove(ADMIN_ALLES_FREI_KEY);
    else safeLocalSet(ADMIN_ALLES_FREI_KEY, '1');
    showToast(adminAlleFreigeschaltet() ? '🔓 Alle Bereiche offen (nur dieses Gerät).' : '🔒 Freischaltungen gelten wieder.', 'success');
    if (typeof aktualisiereFreischaltSperren === 'function') aktualisiereFreischaltSperren();
    renderAdminTools();
}

function renderAdminTools() {
    const box = document.getElementById('admin-tools-box');
    if (!box) return;
    const p = squad.find(x => x.id === adminSpielerId) || squad[0];
    if (p) adminSpielerId = p.id;
    const feld = (id, label, wert, min, max) => `<label class="ui-field"><span class="ui-field-label">${label}</span><input id="${id}" type="number" class="input-inline" min="${min}" max="${max}" value="${wert}" style="width:100%;"></label>`;
    const raster = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 8em), 1fr)); gap:6px; margin:6px 0;';
    const m = typeof getNextLeagueMatch === 'function' ? getNextLeagueMatch() : null;
    const diag = getAdminStaerkeDiagnose();
    const speicher = getAdminSpeicherDiagnose();
    const befunde = getAdminDatenpruefung();
    const kb = n => `${(n / 1024).toFixed(1)} KB`;
    // Hauptbildschirme und die Unterbildschirme der Hubs (SUB_SCREEN_TO_HUB in js/ui-core.js), so wie showScreen() sie kennt
    const bildschirme = [...document.querySelectorAll('[id^="screen-"]')].filter(el => (typeof SUB_SCREEN_TO_HUB !== 'undefined' && SUB_SCREEN_TO_HUB[el.id]) || (el.parentElement && el.parentElement.closest('[id^="screen-"]') === null)).map(el => el.id).sort();
    const erfolge = (game.achievements || []).length;
    box.innerHTML = `
        <details class="ui-fold"><summary>✏️ Spieler-Editor</summary>
            ${p ? `<label class="ui-field"><span class="ui-field-label">Spieler</span><select id="adm-sp-wahl" class="input-inline" style="width:100%;" onchange="adminSpielerWaehlen(this.value)">${adminSpielerOptionen(p.id)}</select></label>
            <div style="${raster}">${feld('adm-sp-staerke', 'Stärke', p.strength, 1, 99)}${feld('adm-sp-alter', 'Alter', p.age || 25, 15, 45)}${feld('adm-sp-vertrag', 'Vertrag (Jahre)', p.contracts || 1, 1, 10)}${feld('adm-sp-fitness', 'Fitness', p.fitness, 0, 100)}${feld('adm-sp-moral', 'Moral', p.morale || 80, 0, 100)}
                <label class="ui-field"><span class="ui-field-label">Position</span><select id="adm-sp-pos" class="input-inline" style="width:100%;">${ADMIN_POSITIONEN.map(x => `<option${x === p.pos ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
            <button onclick="adminSpielerUebernehmen()" class="btn-action">✏️ Werte übernehmen</button>` : 'Kein Spieler im Kader.'}
        </details>
        <details class="ui-fold"><summary>⏩ Spieltag, Wetter und Gegner</summary>
            <button onclick="adminBisSaisonende()" class="btn-secondary" style="margin:4px 0;">⏩ Bis zum Saisonende vorspulen (noch ${Math.max(0, 35 - game.matchday)} Spieltage)</button>
            <div style="${raster}"><label class="ui-field"><span class="ui-field-label">Wetter am nächsten Spieltag</span><select id="adm-wetter" class="input-inline" style="width:100%;">${WEATHER_TYPES.map((w, i) => `<option value="${i}"${game.adminWetter === i ? ' selected' : ''}>${w.icon} ${w.name}</option>`).join('')}</select></label>
                <button onclick="adminWetterSetzen()" class="btn-secondary">🌦️ Wetter festlegen</button></div>
            ${typeof game.adminWetter === 'number' && WEATHER_TYPES[game.adminWetter] ? `<div style="font-size:var(--fs-caption); color:var(--text-muted);">Festgelegt: ${WEATHER_TYPES[game.adminWetter].icon} ${WEATHER_TYPES[game.adminWetter].name}</div>` : ''}
            ${m ? `<div style="${raster}">${feld('adm-gegner-staerke', `Stärke ${mpEsc(m.opp.name)} (jetzt ${Math.round(m.opp.strength)})`, Math.round(m.opp.strength), 1, 99)}<button onclick="adminGegnerStaerkeSetzen()" class="btn-secondary">🎯 Gegnerstärke setzen</button></div>` : ''}
        </details>
        <details class="ui-fold"><summary>🔁 Markt, Angebote und Jugend</summary>
            <button onclick="adminMarktNeu()" class="btn-secondary" style="margin:4px 0;">🔄 Transfermarkt neu erzeugen</button>
            ${squad.length ? `<div style="${raster}"><label class="ui-field"><span class="ui-field-label">Angebot für</span><select id="adm-angebot-spieler" class="input-inline" style="width:100%;">${adminSpielerOptionen(null)}</select></label>
                <button onclick="adminAngebotErzwingen()" class="btn-secondary">📨 Angebot erzwingen</button></div>` : ''}
            <button onclick="adminJugendtalent()" class="btn-secondary" style="margin:4px 0;">🎓 Jugendtalent ohne Kosten (${youthTalents.length} / ${getYouthAcademyCapacity()})</button>
            <button onclick="adminAlleErfolge()" class="btn-secondary" style="margin:4px 0;">🎖️ Alle Erfolge freischalten (${erfolge} / ${ACHIEVEMENT_DEFINITIONS.length})</button>
            <button onclick="adminFreischaltungenUmschalten()" class="btn-secondary" style="margin:4px 0;">${adminAlleFreigeschaltet() ? '🔒 Freischaltungen wieder anwenden' : '🔓 Alle gesperrten Bereiche öffnen (nur dieses Gerät)'}</button>
        </details>
        <details class="ui-fold"><summary>📊 Teamstärke-Diagnose</summary>
            ${diag ? `<div style="font-size:var(--fs-small); margin:4px 0;">Heim <strong>${diag.heim}</strong> · Auswärts <strong>${diag.auswaerts}</strong> · ${diag.spieler} Spieler in der Startelf</div>
            ${diag.posten.map(([n, v]) => `<div class="box" style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-small); margin:2px 0;"><span style="overflow-wrap:anywhere;">${n}</span><strong style="flex:0 0 auto;">${v >= 0 ? '+' : ''}${v.toFixed(1)}</strong></div>`).join('')}` : 'Keine Startelf aufgestellt.'}
        </details>
        <details class="ui-fold"><summary>💾 Speicher und Datenprüfung</summary>
            <div style="font-size:var(--fs-small); margin:4px 0;">Spielstand ${kb(speicher.gesamt)}. Größte Teile: ${speicher.teile.map(x => `${mpEsc(x.k)} ${kb(x.n)}`).join(', ')}.<br>Größte Felder in game: ${speicher.spiel.map(x => `${mpEsc(x.k)} ${kb(x.n)}`).join(', ')}.<br>Gerät: ${speicher.geraet.length ? speicher.geraet.map(x => `${mpEsc(x.k.replace('anstoss_fm13_', ''))} ${kb(x.n)}`).join(', ') : 'kein Zugriff auf den Gerätespeicher'}.</div>
            <button onclick="adminBedienEinstellungenZuruecksetzen()" class="btn-secondary" style="margin:4px 0;">🧹 Favoriten und Kaderansicht zurücksetzen</button>
            <div class="box" style="font-size:var(--fs-small); margin:4px 0; border-left-color:${befunde.length ? 'var(--danger)' : 'var(--primary)'};">${befunde.length ? `⚠️ ${befunde.length} Auffälligkeit${befunde.length === 1 ? '' : 'en'}: ${befunde.slice(0, 6).map(mpEsc).join('; ')}${befunde.length > 6 ? ' …' : ''}` : '✓ Kader, Aufstellung und Kassenwerte ohne Auffälligkeiten.'}</div>
            <button onclick="adminDatenReparieren()" class="btn-secondary">🔧 Daten reparieren</button>
        </details>
        <details class="ui-fold"><summary>📌 Sicherungspunkt und Zufall</summary>
            <div style="font-size:var(--fs-caption); color:var(--text-muted); margin:4px 0;">Der Sicherungspunkt gilt nur bis zum Neuladen der Seite. Der festgelegte Zufall macht Testläufe wiederholbar.</div>
            <div style="${raster}"><button onclick="adminSicherungSetzen()" class="btn-secondary">📌 Sicherungspunkt setzen</button>
                <button onclick="adminSicherungLaden()" class="btn-secondary"${adminSicherung ? '' : ' disabled'}>⏪ ${adminSicherung ? `Zurück zu Saison ${adminSicherung.season}, SpT ${adminSicherung.matchday}` : 'Kein Sicherungspunkt'}</button></div>
            <div style="${raster}">${feld('adm-seed', 'Startwert für den Zufall', 12345, 1, 2147483647)}<button onclick="adminZufallFestlegen()" class="btn-secondary">🎲 Zufall festlegen</button>
                <button onclick="adminZufallZuruecksetzen()" class="btn-secondary"${adminZufallAlt ? '' : ' disabled'}>🎲 Zufall freigeben</button></div>
        </details>
        <details class="ui-fold"><summary>🧭 Bildschirme und Zeichenzeiten</summary>
            <div style="${raster}"><label class="ui-field"><span class="ui-field-label">Bildschirm</span><select id="adm-bildschirm" class="input-inline" style="width:100%;">${bildschirme.map(id => `<option value="${id}">${id.replace('screen-', '')}</option>`).join('')}</select></label>
                <button onclick="adminBildschirmOeffnen()" class="btn-secondary">🧭 Öffnen</button></div>
            <button onclick="adminZeitenMessen()" class="btn-secondary" style="margin:4px 0;">⏱️ Zeichenzeiten messen</button>
            ${adminMessung ? adminMessung.map(x => `<div class="box" style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-small); margin:2px 0;"><span>${x.name}</span><strong style="color:${x.ms > 50 ? 'var(--danger)' : 'var(--text-main)'};">${x.ms.toFixed(1)} ms</strong></div>`).join('') : ''}
        </details>`;
}
