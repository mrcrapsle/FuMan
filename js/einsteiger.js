// Einsteiger-Hilfen (Neulings-Analyse 3.145): Einsteiger-Modus beim Karrierestart (game.einsteiger),
// kompakter Spieltag mit Anleitung, Kopfzeile wächst mit, Profi-Abschnitte der Übersicht erst ab der
// Rückrunde, Menü in "Wichtig" und "Mehr", Kader-Feinheiten eingeklappt.
// Ohne Einsteiger-Modus (alte Stände, Tests) bleibt alles wie gewohnt sichtbar.

let selectedNewGameEinsteiger = true;
let einsteigerVorbereitungOffen = false;
const EINSTEIGER_FRUEH_BIS = 17;   // Profi-Abschnitte der Übersicht ab dem 18. Spieltag der ersten Saison
const EINSTEIGER_ANLEITUNG_BIS = 3; // Erklärung zum Spieltag in den ersten drei Spielen
const NAV_WICHTIG = ['screen-dashboard', 'screen-squad', 'screen-training', 'screen-transfer', 'screen-finances', 'screen-inbox', 'screen-league'];

function einsteigerAktiv() { return typeof game !== 'undefined' && game.einsteiger === true; }
function einsteigerFrueh() { return einsteigerAktiv() && game.season === 1 && game.matchday <= EINSTEIGER_FRUEH_BIS; }

// ---------- Auswahl beim Start ----------
function renderNewGameEinsteigerOptions() {
    const html = [[true, '🎓 Einsteiger', 'Kompakter Spieltag, weniger auf einmal'], [false, '🧠 Erfahren', 'Alles von Anfang an']]
        .map(([wert, name, text]) => `<button onclick="selectedNewGameEinsteiger=${wert}; renderNewGameEinsteigerOptions();" class="${selectedNewGameEinsteiger === wert ? 'btn-action' : 'btn-secondary'}" style="font-size:var(--fs-caption); padding:5px 2px;">${name}<br><span style="font-size:var(--fs-micro);">${text}</span></button>`).join('');
    ['new-game-einsteiger-btns', 'startmenue-einsteiger-btns'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

function setEinsteigerModus(an) {
    game.einsteiger = !!an;
    einsteigerVorbereitungOffen = false;
    wendeEinsteigerAn();
    showToast(an ? '🎓 Einsteiger-Modus an: kompakter Spieltag und aufgeräumte Übersicht.' : '🧠 Einsteiger-Modus aus: alle Bereiche und die volle Spielvorbereitung sind sichtbar.', 'success');
}

function renderEinsteigerSchalter() {
    const el = document.getElementById('einsteiger-schalter');
    if (!el) return;
    el.innerHTML = `<button onclick="setEinsteigerModus(${!einsteigerAktiv()})" class="btn-secondary" style="margin:4px 0;">🎓 Einsteiger-Modus: ${einsteigerAktiv() ? 'AN' : 'AUS'}</button>`;
}

// ---------- Spieltag ----------
// Aus onScreenShown('screen-prematch-press'): Anpfiff-Knöpfe oben, im Einsteiger-Modus die
// Vorbereitung (Gegner, Ansprache, Presse) eingeklappt und in den ersten Spielen eine kurze Anleitung.
function renderEinsteigerSpieltag() {
    const box = document.getElementById('einsteiger-spieltag-box');
    const vorbereitung = document.getElementById('prematch-vorbereitung');
    if (!box || !vorbereitung) return;
    const kompakt = einsteigerAktiv() && !einsteigerVorbereitungOffen;
    vorbereitung.style.display = kompakt ? 'none' : '';
    const info = typeof pendingMatchInfo !== 'undefined' && pendingMatchInfo ? pendingMatchInfo : null;
    const gegner = info ? info.oppName : '';
    const anleitung = einsteigerAktiv() && game.season === 1 && game.matchday <= EINSTEIGER_ANLEITUNG_BIS
        ? `<div class="einsteiger-anleitung"><strong>So läuft ein Spieltag:</strong>
            <ol><li><strong>Anpfiff</strong> startet das Livespiel mit Ticker. Du kannst dort zusehen, Spieler wechseln und in der Halbzeit eine Ansprache halten, musst aber nichts tun.</li>
            <li><strong>Nur Ergebnis</strong> rechnet das Spiel sofort durch und zeigt den Spielbericht.</li>
            <li>Danach geht es zurück zur Übersicht und zum nächsten Spieltag.</li></ol>
            Ansprache, Pressekonferenz und Gegneranalyse sind freiwillig, sie bringen kleine Vorteile.</div>`
        : '';
    box.innerHTML = `<div class="panel einsteiger-spieltag">
        <div class="panel-header">⚽ ${gegner ? `Spiel gegen ${mpEsc(gegner)}` : 'Dein Spiel'}</div>
        ${anleitung}
        <div class="einsteiger-knoepfe">
            <button onclick="skipPressAndPlay()" id="einsteiger-anpfiff" class="btn-action">▶ Ohne Vorbereitung anpfeifen</button>
            <button onclick="resolveMatchInstantly()" class="btn-secondary">⚡ Nur Ergebnis</button>
        </div>
        ${einsteigerAktiv() ? `<button onclick="einsteigerVorbereitungOffen=!einsteigerVorbereitungOffen; renderEinsteigerSpieltag();" id="einsteiger-vorbereitung-knopf" class="btn-secondary" style="margin-top:6px;">${kompakt ? '🎙️ Vorbereitung zeigen (Gegner, Ansprache, Presse)' : '▴ Vorbereitung einklappen'}</button>` : ''}
    </div>`;
}

// ---------- Kopfzeile, Übersicht, Menü, Kader ----------
// Aus updateUI(): Sichtbarkeit nach Freischaltung und Einsteiger-Stand.
function wendeEinsteigerAn() {
    const holding = document.querySelector('.kpi-chip[data-kopf="holding"]');
    if (holding) holding.hidden = typeof istFreigeschaltet === 'function' && !istFreigeschaltet('holding');
    const level = document.querySelector('.kpi-chip[data-kopf="level"]');
    if (level) level.hidden = einsteigerAktiv() && game.season === 1 && (typeof managerRPG === 'undefined' || managerRPG.level < 2);
    document.documentElement.classList.toggle('einsteiger-frueh', einsteigerFrueh());
    const hinweis = document.getElementById('einsteiger-dash-hinweis');
    if (hinweis) hinweis.innerHTML = einsteigerFrueh()
        ? `<div class="box startmenue-hinweis">🎓 Weitere Bereiche (Holding, Europa, Wochenrückblick, Transferstrategie) erscheinen ab dem ${EINSTEIGER_FRUEH_BIS + 1}. Spieltag. <a href="#" onclick="setEinsteigerModus(false); return false;">Alles jetzt zeigen</a></div>`
        : '';
    const feinheiten = document.getElementById('kader-feinheiten');
    if (feinheiten && !feinheiten.dataset.gesetzt) {
        feinheiten.open = !einsteigerAktiv();
        feinheiten.dataset.gesetzt = '1';
    }
    ordneMenue();
    renderEinsteigerSchalter();
    renderWasJetzt();
    pruefeEinsteigerAbschluss();
}

// Menü: die wichtigsten Bildschirme oben, der Rest unter "Mehr" (im Einsteiger-Modus eingeklappt).
function ordneMenue() {
    const nav = document.getElementById('app-sidebar');
    if (!nav) return;
    let mehr = document.getElementById('nav-mehr');
    if (!mehr) {
        const ziel = b => (b.getAttribute('onclick') || '').match(/showScreen\('([^']+)'\)/);
        const knoepfe = [...nav.querySelectorAll(':scope > button.nav-btn')];
        const erste = nav.querySelector(':scope > .nav-category');
        if (!erste) return;
        const kopf = document.createElement('div');
        kopf.className = 'nav-category';
        kopf.textContent = 'Wichtig';
        nav.insertBefore(kopf, erste);
        let davor = erste;
        NAV_WICHTIG.forEach(id => {
            const b = knoepfe.find(k => { const m = ziel(k); return m && m[1] === id; });
            if (b) nav.insertBefore(b, davor);
        });
        const umschalter = document.createElement('button');
        umschalter.id = 'nav-mehr-knopf';
        umschalter.className = 'btn-secondary nav-mehr-knopf';
        umschalter.onclick = () => { const offen = mehr.hidden; mehr.hidden = !offen; safeLocalSet('anstoss_fm13_nav_mehr', offen ? '1' : '0'); umschalter.setAttribute('aria-expanded', String(offen)); umschalter.textContent = offen ? '▴ Weniger anzeigen' : '▾ Mehr Bereiche'; };
        nav.insertBefore(umschalter, erste);
        mehr = document.createElement('div');
        mehr.id = 'nav-mehr';
        nav.insertBefore(mehr, erste);
        // Alles zwischen "Mehr" und den Einstellungen wandert in den Bereich
        const ende = nav.querySelector(':scope > .one-hand-settings');
        while (mehr.nextSibling && mehr.nextSibling !== ende) mehr.appendChild(mehr.nextSibling);
    }
    markiereGesperrteMenuepunkte(mehr);
    const gemerkt = safeLocalGet('anstoss_fm13_nav_mehr');
    const offen = gemerkt === null ? !einsteigerAktiv() : gemerkt === '1';
    mehr.hidden = !offen;
    const k = document.getElementById('nav-mehr-knopf');
    if (k) { k.setAttribute('aria-expanded', String(offen)); k.textContent = offen ? '▴ Weniger anzeigen' : '▾ Mehr Bereiche'; }
}

// ---------- Saisoneröffnung, Spielbericht, Abschluss ----------
// Einsteiger: die Wahl zur Saisoneröffnung erst, wenn drei der Ersten Schritte erledigt sind
// (sie bleibt dafür bis zum 2. Spieltag offen, js/season-events.js).
function einsteigerSaisonEroeffnungWarten() {
    if (!einsteigerAktiv() || game.season !== 1 || game.matchday !== 1) return false;
    const ob = typeof ensureOnboarding === 'function' ? ensureOnboarding() : null;
    return !!ob && !ob.finished && Object.keys(ob.done || {}).length < 3;
}

// Aus endMatchSimulation(): kurze Einordnung nach den ersten zwei Ligaspielen.
function renderEinsteigerBericht() {
    const box = document.getElementById('einsteiger-bericht-box');
    if (!box) return;
    const m = typeof currentMatch !== 'undefined' ? currentMatch : null;
    if (!einsteigerAktiv() || game.season !== 1 || game.matchday > 2 || !m || m.cupTie) { box.innerHTML = ''; return; }
    const unsere = m.isHome ? m.homeGoals : m.awayGoals, gegner = m.isHome ? m.awayGoals : m.homeGoals;
    const wir = Math.round(m.isHome ? m.homeStr : m.awayStr), sie = Math.round(m.isHome ? m.awayStr : m.homeStr);
    const elf = squad.filter(p => lineup.includes(p.id));
    const fit = elf.length ? Math.round(elf.reduce((a, p) => a + (p.fitness || 0), 0) / elf.length) : 0;
    const gruende = [];
    gruende.push(wir >= sie + 2 ? `Ihr wart stärker eingeschätzt (${wir} zu ${sie}).` : (sie >= wir + 2 ? `Der Gegner war stärker eingeschätzt (${sie} zu ${wir}) - Training und Verstärkungen helfen.` : `Beide Teams waren etwa gleich stark (${wir} zu ${sie}), da entscheiden Tagesform und Glück.`));
    if (fit && fit < 80) gruende.push(`Die Startelf hatte im Schnitt nur ${fit} % Fitness. Rotation oder das Training „Kondition“ helfen.`);
    const fwText = (label, term) => typeof fw === 'function' ? fw(label, term) : label;
    box.innerHTML = `<div class="box einsteiger-anleitung">🎓 <strong>${unsere > gegner ? 'Sieg' : (unsere < gegner ? 'Niederlage' : 'Unentschieden')} - so ordnest du das ein:</strong>
        <ul>${gruende.map(g => `<li>${g}</li>`).join('')}
        <li>Die ${fwText('Noten', 'Kicker-Noten & Elf des Spieltags')} gehen von 1 (sehr gut) bis 6 (sehr schlecht), wie im Kicker.</li></ul>
        Mit „Spielbericht schließen“ geht es zurück zur Übersicht.</div>`;
}

// Einmal nach der Hinrunde: die Grundlagen sitzen, mehr Bereiche erscheinen.
function pruefeEinsteigerAbschluss() {
    if (!einsteigerAktiv() || game.einsteigerAbschluss || game.season !== 1 || game.matchday <= EINSTEIGER_FRUEH_BIS) return;
    const ov = document.getElementById('einsteiger-abschluss-overlay');
    if (!ov) return;
    game.einsteigerAbschluss = true;
    document.getElementById('einsteiger-abschluss-inhalt').innerHTML = `<div class="panel-header">🎓 Hinrunde geschafft!</div>
        <div style="font-size:var(--fs-body); margin-bottom:8px;">Du kennst jetzt die Grundlagen. Ab sofort siehst du auf der Übersicht auch den Wochenrückblick, die Transferstrategie, Holding und Europa.</div>
        <div style="font-size:var(--fs-body); margin-bottom:10px;">Der Einsteiger-Modus hält die Spielvorbereitung (Gegner, Ansprache, Presse) weiter eingeklappt und das Menü kurz. Du kannst ihn jetzt ausschalten oder später im Menü unter Einstellungen.</div>
        <div class="einsteiger-knoepfe">
            <button onclick="setEinsteigerModus(false); schliesseEinsteigerAbschluss();" class="btn-action">🧠 Einsteiger-Modus aus</button>
            <button onclick="schliesseEinsteigerAbschluss()" class="btn-secondary">🎓 Noch anlassen</button>
        </div>`;
    ov.classList.add('show');
}

function schliesseEinsteigerAbschluss() {
    const ov = document.getElementById('einsteiger-abschluss-overlay');
    if (ov) ov.classList.remove('show');
}

// ---------- Was jetzt? ----------
// Die eine wichtigste nächste Handlung aus dem Manager-Assistenten (js/manager-tools.js), sonst der Spieltag.
function renderWasJetzt() {
    const box = document.getElementById('was-jetzt-box');
    if (!box) return;
    if (game.matchday > 34) { box.innerHTML = ''; return; }
    const todo = typeof getManagerTodos === 'function' ? getManagerTodos()[0] : null;
    box.innerHTML = todo
        ? `<div class="box was-jetzt"><span class="ui-overline">Was jetzt?</span><div>${todo.icon} ${todo.text}</div><button onclick="${todo.aktion}" class="btn-action">${todo.label}</button></div>`
        : `<div class="box was-jetzt"><span class="ui-overline">Was jetzt?</span><div>✅ Alles erledigt. Weiter geht es mit dem ${Math.min(34, game.matchday)}. Spieltag.</div><button onclick="startMatchdayFlow()" class="btn-action">▶ Spieltag ${Math.min(34, game.matchday)}</button></div>`;
}

// ---------- Gesperrte Bereiche im Menü ----------
function markiereGesperrteMenuepunkte(mehr) {
    if (typeof FREISCHALT_BEREICHE === 'undefined' || typeof istFreigeschaltet !== 'function') return;
    const gesperrt = {};
    FREISCHALT_BEREICHE.forEach(b => { if (!istFreigeschaltet(b.key)) b.screens.forEach(sc => { gesperrt[sc] = b; }); });
    [...mehr.querySelectorAll('button.nav-btn')].forEach(btn => {
        const m = (btn.getAttribute('onclick') || '').match(/showScreen\('([^']+)'\)/);
        const b = m && gesperrt[m[1]];
        btn.classList.toggle('nav-gesperrt', !!b);
        if (b) { btn.title = `🔒 ${b.name}: noch gesperrt. Tippen zeigt, was fehlt.`; mehr.appendChild(btn); }
        else if (btn.title && btn.title.startsWith('🔒')) btn.removeAttribute('title');
    });
}
