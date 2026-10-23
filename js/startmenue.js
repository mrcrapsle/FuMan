// Startmenü (Titelbildschirm): erscheint bei jedem Start über dem geladenen Spiel.
// - Weiterspielen (wenn ein Spielstand geladen wurde), Neue Karriere, Spielstand laden.
// - Neue Karriere in drei Arten:
//   gruenden:    eigener Verein mit Namen, Stadt, Startliga, Startkapital und Tempo (der bisherige
//                Neues-Spiel-Kasten #new-game-setup-box wird dafür ins Menü verschoben).
//   uebernehmen: einen bestehenden Verein der Pyramide frei wählen (Neustart, dann Auswahl).
//   jobs:        "Trainer gesucht": Vereine mit einem Vorstandsziel (Karriere-Szenarien, js/scenarios.js).
// Übernehmen und Jobs laden neu (frische Ligen der gewählten Stadt) und zeigen danach die Auswahl.
// Die Testsuite blendet das Menü beim Start über window.anstossOhneStartmenue aus (tests/run-tests.js).

let startmenueSchritt = 'titel';
let startmenueGeladen = false;
// Erster Start ohne Spielstand: "Verein gründen" startet ohne Rückfrage (es geht nichts verloren).
let startmenueErststart = false;
let startmenueJobs = null;
let startmenueLigaFilter = null;

const STARTMENUE_ARTEN = {
    gruenden: { titel: '🏗️ Verein gründen', text: 'Eigener Verein mit eigenem Namen in deiner Heimatstadt. Du wählst Startliga, Startkapital und Freischalt-Tempo.' },
    uebernehmen: { titel: '🤝 Verein übernehmen', text: 'Werde Trainer eines bestehenden Vereins aus der Liga-Pyramide deiner Region, von der Kreisliga bis zur Bundesliga.' },
    jobs: { titel: '📋 Trainer gesucht', text: 'Vereine suchen gerade einen Trainer, jeder mit einem klaren Auftrag des Vorstands und einer Frist.' }
};

function startmenueEl() { return document.getElementById('startmenue-overlay'); }

// Aus window.onload (index.html). Gibt true zurück, wenn das Menü offen ist (dann kein Tutorial).
function zeigeStartmenueBeimStart(neuesSpiel, geladen) {
    startmenueGeladen = !!geladen;
    const modus = safeSessionGet('anstoss_fm13_newgame_modus');
    if (modus) safeSessionRemove('anstoss_fm13_newgame_modus');
    if (modus === 'uebernehmen' || modus === 'jobs') {
        startmenueGeladen = false;
        startmenueErststart = true;
        oeffneStartmenue(modus);
        return true;
    }
    if (neuesSpiel || window.anstossOhneStartmenue === true) return false;
    startmenueErststart = !startmenueGeladen;
    oeffneStartmenue('titel');
    return true;
}

function oeffneStartmenue(schritt) {
    const el = startmenueEl();
    if (!el) return;
    startmenueSchritt = schritt || 'titel';
    if (startmenueSchritt === 'jobs' && !startmenueJobs) startmenueJobs = erzeugeStartmenueJobs();
    el.hidden = false;
    el.classList.add('show');
    renderStartmenue();
    const erster = el.querySelector('button, input, select');
    if (erster) erster.focus();
}

function schliesseStartmenue() {
    const el = startmenueEl();
    if (!el) return;
    gruendenKastenZurueck();
    el.classList.remove('show');
    el.hidden = true;
}

function startmenueWeiterspielen() {
    schliesseStartmenue();
    if (typeof maybeShowTutorial === 'function') maybeShowTutorial();
}

// Der bisherige Neues-Spiel-Kasten wandert für "Verein gründen" ins Menü und danach zurück.
function gruendenKastenZurueck() {
    const box = document.getElementById('new-game-setup-box');
    const heimat = document.getElementById('new-game-setup-heimat');
    if (box && heimat && box.parentElement !== heimat.parentElement) {
        heimat.after(box);
        box.style.display = 'none';
    }
}

function startmenueKopf(titel, zurueck) {
    return `<div class="startmenue-kopf">
        ${zurueck ? `<button onclick="oeffneStartmenue('${zurueck}')" class="btn-secondary startmenue-zurueck" title="Zurück">← Zurück</button>` : ''}
        <div class="startmenue-titel">${titel}</div>
    </div>`;
}

function renderStartmenue() {
    const inhalt = document.getElementById('startmenue-inhalt');
    if (!inhalt) return;
    if (startmenueSchritt !== 'gruenden') gruendenKastenZurueck();
    const s = startmenueSchritt;
    let html = '';
    if (s === 'titel') html = startmenueTitelHtml();
    else if (s === 'karriere') html = startmenueKarriereHtml();
    else if (s === 'gruenden') html = startmenueKopf('🏗️ Verein gründen', 'karriere');
    else if (s === 'uebernehmen') html = startmenueUebernehmenHtml();
    else if (s === 'jobs') html = startmenueJobsHtml();
    else if (s === 'laden') html = startmenueLadenHtml();
    inhalt.innerHTML = html;
    if (s === 'karriere' && typeof renderNewGameEinsteigerOptions === 'function') renderNewGameEinsteigerOptions();
    if (s === 'gruenden') {
        const box = document.getElementById('new-game-setup-box');
        if (box) {
            inhalt.appendChild(box);
            box.style.display = 'block';
            const name = document.getElementById('new-game-clubname');
            if (name && !name.value) name.placeholder = `z. B. FC ${selectedNewGameCity} 1920`;
            if (typeof renderNewGameSetupOptions === 'function') renderNewGameSetupOptions();
        }
    }
}

function startmenueTitelHtml() {
    const weiter = startmenueGeladen
        ? `<button onclick="startmenueWeiterspielen()" id="startmenue-weiter" class="btn-action startmenue-gross">▶ Weiterspielen<span>${mpEsc(game.clubName)} · ${typeof leagueNames !== 'undefined' ? mpEsc(leagueNames[game.leagueLevel] || '') : ''} · Saison ${game.season}, ${Math.min(34, game.matchday)}. Spieltag</span></button>`
        : '';
    const version = typeof GAME_VERSION !== 'undefined' ? `Version ${GAME_VERSION.number}` : '';
    return `<div class="startmenue-logo">⚽</div>
        <div class="startmenue-name">Anstoß Mobile Pro</div>
        <div class="startmenue-unter">Fußballmanager · FM13 · ${version}</div>
        <div class="startmenue-knoepfe">
            ${weiter}
            <button onclick="oeffneStartmenue('karriere')" id="startmenue-neu" class="${startmenueGeladen ? 'btn-secondary' : 'btn-action'} startmenue-gross">🆕 Neue Karriere<span>Verein gründen, übernehmen oder einen Trainerjob annehmen</span></button>
            <button onclick="oeffneStartmenue('laden')" id="startmenue-laden" class="btn-secondary startmenue-gross">📂 Spielstand laden<span>Gespeicherte Stände oder eine Datei</span></button>
        </div>`;
}

function startmenueKarriereHtml() {
    const stadt = typeof getHomeCityOptions === 'function'
        ? `<label class="startmenue-feld">Heimatstadt (bestimmt die Ligen deiner Region)
            <select id="startmenue-stadt" onchange="selectedNewGameCity=this.value; startmenueJobs=null;" class="input-inline">
                ${getHomeCityOptions().map(o => `<option value="${o.city}" ${o.city === selectedNewGameCity ? 'selected' : ''}>${o.city} (${o.state})</option>`).join('')}
            </select></label>`
        : '';
    return startmenueKopf('🆕 Neue Karriere', 'titel') + stadt
        + '<div class="startmenue-feld">Erfahrung<div id="startmenue-einsteiger-btns" class="startmenue-ligen"></div></div>'
        + `<div class="startmenue-knoepfe">${Object.entries(STARTMENUE_ARTEN).map(([k, a]) =>
            `<button onclick="startmenueArtWaehlen('${k}')" id="startmenue-${k}" class="btn-secondary startmenue-gross">${a.titel}<span>${a.text}</span></button>`).join('')}</div>`;
}

function startmenueArtWaehlen(art) {
    if (art === 'gruenden') { oeffneStartmenue('gruenden'); return; }
    if (!STARTMENUE_ARTEN[art]) return;
    // Neustart mit frischen Ligen der gewählten Stadt; danach zeigt das Menü die Auswahl.
    if (typeof backupCurrentGame === 'function' && startmenueGeladen) backupCurrentGame('vor der neuen Karriere');
    safeSessionSet(FORCE_NEW_GAME_FLAG, '1');
    safeSessionSet('anstoss_fm13_newgame_city', selectedNewGameCity);
    safeSessionSet('anstoss_fm13_newgame_modus', art);
    if (typeof selectedNewGameEinsteiger !== 'undefined') safeSessionSet('anstoss_fm13_newgame_einsteiger', selectedNewGameEinsteiger ? '1' : '0');
    if (typeof selectedNewGameTempo !== 'undefined') safeSessionSet('anstoss_fm13_newgame_freischaltung', selectedNewGameTempo);
    location.reload();
}

// ---------- Verein übernehmen ----------
function startmenueVereine(level) {
    return (leaguesData[level] || [])
        .filter(t => t.name !== game.clubName && !(game.secondTeam && t.name === game.secondTeam.name))
        .slice().sort((a, b) => (b.strength || 0) - (a.strength || 0));
}

function startmenueUebernehmenHtml() {
    if (startmenueLigaFilter === null) startmenueLigaFilter = game.leagueLevel;
    const ligen = (typeof leagueNames !== 'undefined' ? leagueNames : []).map((n, l) =>
        `<button onclick="startmenueLigaFilter=${l}; renderStartmenue();" class="${l === startmenueLigaFilter ? 'btn-action' : 'btn-secondary'}">${mpEsc(n)}</button>`).join('');
    const vereine = startmenueVereine(startmenueLigaFilter);
    const max = Math.max(1, ...vereine.map(t => t.strength || 0));
    return startmenueKopf('🤝 Verein übernehmen', 'karriere')
        + `<div class="startmenue-hinweis">Wähle eine Liga und einen Verein. Stärkere Vereine haben höhere Erwartungen, schwächere mehr Zeit.</div>
        <div class="startmenue-ligen">${ligen}</div>
        <div class="startmenue-liste">${vereine.map((t, i) => {
            const rolle = i < 3 ? uiChip('Favorit', 'warn') : (i >= vereine.length - 4 ? uiChip('Abstiegskandidat', 'schlecht') : uiChip('Mittelfeld', 'gut'));
            return `<div class="box startmenue-verein"><div><strong>${mpEsc(t.name)}</strong> ${rolle}
                <div class="startmenue-balken"><span style="width:${Math.round((t.strength || 0) / max * 100)}%"></span></div></div>
                <button onclick="startmenueVereinUebernehmen(${JSON.stringify(t.name).replace(/"/g, '&quot;')})" class="btn-action">Übernehmen</button></div>`;
        }).join('')}</div>`;
}

// Gemeinsamer Antritt bei einem bestehenden Verein (Übernehmen und Jobs).
function startmenueAntreten(name, szenario) {
    const altName = game.clubName;
    const altLevel = game.leagueLevel;
    if (!switchToClub(name)) { showToast('Diesen Verein gibt es nicht mehr.', 'error'); return false; }
    // Der automatisch angelegte Startverein bleibt als ganz normaler Gegner mit neuem Namen in seiner Liga.
    const altZeile = (leaguesData[altLevel] || []).find(t => t.name === altName);
    if (altZeile && typeof generateTeamName === 'function') altZeile.name = generateTeamName(altLevel);
    const level = game.leagueLevel;
    if (typeof setzeBuchungskontext === 'function') setzeBuchungskontext('🏁 Startkapital');
    game.money = typeof getNewGameStartMoney === 'function' ? getNewGameStartMoney(level, 150000) : 150000;
    if (typeof loescheBuchungskontext === 'function') loescheBuchungskontext();
    if (typeof scaleStadiumForLeague === 'function') scaleStadiumForLeague(level);
    if (typeof grantStartLeagueLicence === 'function') grantStartLeagueLicence(level);
    if (szenario && typeof applyScenarioStart === 'function') applyScenarioStart(szenario);
    if (typeof forceSponsorRenewalAtSeasonStart === 'function') forceSponsorRenewalAtSeasonStart(true);
    if (typeof writeAutoSaveNow === 'function') writeAutoSaveNow();
    startmenueJobs = null;
    startmenueLigaFilter = null;
    schliesseStartmenue();
    updateUI();
    showScreen('screen-dashboard');
    showToast(`🤝 Willkommen beim ${game.clubName}!`, 'success');
    if (typeof maybeShowTutorial === 'function') maybeShowTutorial();
    return true;
}

function startmenueVereinUebernehmen(name) { startmenueAntreten(name, null); }

// ---------- Trainer gesucht ----------
// Je Karriere-Szenario ein passender Verein aus der Liga des Szenarios.
function erzeugeStartmenueJobs() {
    if (typeof CAREER_SCENARIOS === 'undefined') return [];
    return Object.entries(CAREER_SCENARIOS).map(([key, sc]) => {
        const vereine = startmenueVereine(sc.level);
        if (!vereine.length) return null;
        let verein;
        if (key === 'titel') verein = vereine[Math.floor(Math.random() * Math.min(3, vereine.length))];
        else if (key === 'absteiger' || key === 'pleite') verein = vereine[vereine.length - 1 - Math.floor(Math.random() * Math.min(3, vereine.length))];
        else verein = vereine[Math.floor(Math.random() * vereine.length)];
        return { key, verein: verein.name, level: sc.level };
    }).filter(Boolean);
}

function startmenueJobsHtml() {
    if (!startmenueJobs) startmenueJobs = erzeugeStartmenueJobs();
    return startmenueKopf('📋 Trainer gesucht', 'karriere')
        + '<div class="startmenue-hinweis">Diese Vereine suchen gerade einen Trainer. Schaffst du das Ziel in der Frist, gibt es bis zu drei Sterne; danach geht die Karriere frei weiter.</div>'
        + `<div class="startmenue-liste">${startmenueJobs.map((j, i) => {
            const sc = CAREER_SCENARIOS[j.key];
            return `<div class="box startmenue-job"><div class="startmenue-job-kopf"><strong>${mpEsc(j.verein)}</strong> ${uiChip(mpEsc(leagueNames[j.level] || ''), '')} ${uiChip(`Frist: ${sc.seasons} Saison${sc.seasons > 1 ? 's' : ''}`, 'warn')}</div>
                <div class="startmenue-job-auftrag">${sc.title}</div>
                <div class="startmenue-hinweis">${mpEsc(sc.desc)}</div>
                <button onclick="startmenueJobAnnehmen(${i})" class="btn-action">Job annehmen</button></div>`;
        }).join('')}</div>`;
}

function startmenueJobAnnehmen(i) {
    const j = (startmenueJobs || [])[i];
    if (!j) { showToast('Dieses Angebot gibt es nicht mehr.', 'error'); return; }
    startmenueAntreten(j.verein, j.key);
}

// ---------- Laden ----------
function startmenueLadenHtml() {
    const zeilen = [];
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
        const m = typeof getSlotMeta === 'function' ? getSlotMeta(i) : null;
        zeilen.push(m
            ? `<div class="box startmenue-verein"><div><strong>Slot ${i}: ${mpEsc(m.clubName || '')}</strong><div class="startmenue-hinweis">${mpEsc(m.league || '')} · Saison ${m.season}, ${m.matchday}. Spieltag · ${mpEsc(m.savedAt || '')}</div></div>
                <button onclick="startmenueSlotLaden(${i})" class="btn-action">Laden</button></div>`
            : `<div class="box startmenue-hinweis">Slot ${i}: leer</div>`);
    }
    const auto = safeLocalGet(AUTOSAVE_KEY);
    if (auto) zeilen.push(`<div class="box startmenue-verein"><div><strong>Automatischer Spielstand</strong></div><button onclick="startmenueAutoLaden()" class="btn-action">Laden</button></div>`);
    return startmenueKopf('📂 Spielstand laden', 'titel')
        + `<div class="startmenue-liste">${zeilen.join('')}</div>
        <button onclick="document.getElementById('save-import-file-input').click()" class="btn-secondary" style="margin-top:8px;">📥 Aus Datei importieren</button>`;
}

function startmenueSlotLaden(i) {
    if (loadGameFromSlot(i, false)) { startmenueGeladen = true; startmenueWeiterspielen(); }
}

function startmenueAutoLaden() {
    if (loadAutoSave()) { startmenueGeladen = true; startmenueWeiterspielen(); }
}
