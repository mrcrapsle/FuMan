// Livespiel im eigenen Fenster (3.157): Das Spiel öffnet nicht mehr als Bildschirm, sondern als
// Vollbild-Fenster über der aktuellen Seite. Der Inhalt ist weiterhin #screen-matchday (Taktik,
// Wechsel, Ticker, Standards, 3D-Ansicht) - er wird beim Öffnen in das Fenster verschoben und beim
// Schließen an seine Stelle zurückgesetzt. „Ausblenden“ schließt das Fenster ohne das Spiel zu
// beenden (Ticker pausiert); über das Band auf der Übersicht geht es wieder auf.
// Schließen über den Knopf ist erst nach dem Abpfiff möglich (finishMatch() in js/match-post.js).

let liveFensterHeimat = null;   // { parent, naechstes } - wohin #screen-matchday zurückkommt
let liveFensterBeendet = false; // Spielbericht geschlossen: kein Band mehr

function liveFensterElement() {
    let fenster = document.getElementById('live-fenster');
    if (fenster) return fenster;
    fenster = document.createElement('div');
    fenster.id = 'live-fenster';
    fenster.className = 'live-fenster';
    fenster.setAttribute('role', 'dialog');
    fenster.setAttribute('aria-modal', 'true');
    fenster.setAttribute('aria-label', 'Livespiel');
    fenster.style.display = 'none';
    fenster.innerHTML = `<div class="live-fenster-kopf">
            <strong>⚽ Livespiel</strong>
            <button id="live-fenster-ausblenden" class="btn-secondary" onclick="liveFensterAusblenden()" title="Fenster schließen, das Spiel läuft weiter nicht">⤓ Ausblenden</button>
        </div>
        <div class="live-fenster-huelle" id="live-fenster-huelle"></div>`;
    document.body.appendChild(fenster);
    return fenster;
}

// Aus setupMatch(): öffnet das Spiel im Fenster. Ohne Fenster-Modul wie bisher als Bildschirm.
function liveFensterOeffnen() {
    const sc = document.getElementById('screen-matchday');
    if (!sc) return;
    const fenster = liveFensterElement();
    const huelle = document.getElementById('live-fenster-huelle');
    if (!liveFensterHeimat) liveFensterHeimat = { parent: sc.parentElement, naechstes: sc.nextElementSibling };
    liveFensterBeendet = false;
    huelle.appendChild(sc);
    sc.style.display = 'block';
    fenster.style.display = 'flex';
    document.body.classList.add('live-fenster-offen');
    if (typeof updateOneHandFab === 'function') updateOneHandFab();
    // Das Spiel gilt als aktueller Bildschirm (Kontoauszug, Zurück-Taste)
    if (typeof aktiverScreen !== 'undefined') aktiverScreen = 'screen-matchday';
    const inhalt = fenster.querySelector('.live-fenster-huelle');
    if (inhalt) inhalt.scrollTop = 0;
    // Die 3D-Ansicht beginnt beim Öffnen (sonst wie früher über onScreenShown)
    if (typeof live3dAnzeigen === 'function') live3dAnzeigen();
    if (typeof spTempoKnoepfe === 'function') spTempoKnoepfe();
    const kopf = document.getElementById('live-fenster-ausblenden');
    if (kopf) kopf.focus();
    liveFensterBandAktualisieren();
}

// Ist das Spiel gerade im Fenster offen?
function liveFensterOffen() {
    return document.body.classList.contains('live-fenster-offen');
}

// Aus showScreen(): solange das Spiel im Fenster läuft, bleibt man darin. Eine andere Seite würde den
// Spielinhalt ausblenden und das Fenster leer zurücklassen (Wisch, Zurück-Taste, Knöpfe darunter).
function liveFensterBlockiert(screenId) {
    if (!liveFensterOffen() || screenId === 'screen-matchday') return false;
    showToast('Das Spiel läuft im Fenster - erst ausblenden oder den Spielbericht schließen.', 'info', 3000);
    return true;
}

// Schließt das Fenster und setzt das Spiel an seine Stelle zurück. beendet = true nach „Spielbericht
// schließen“ (finishMatch): dann gibt es kein Band mehr für dieses Spiel.
function liveFensterSchliessen(beendet) {
    if (beendet) liveFensterBeendet = true;
    const sc = document.getElementById('screen-matchday');
    const fenster = document.getElementById('live-fenster');
    if (sc && liveFensterHeimat && liveFensterHeimat.parent) {
        const { parent, naechstes } = liveFensterHeimat;
        parent.insertBefore(sc, naechstes && naechstes.parentElement === parent ? naechstes : null);
        sc.style.display = 'none';
    }
    liveFensterHeimat = null;
    if (fenster) fenster.style.display = 'none';
    document.body.classList.remove('live-fenster-offen');
    if (typeof updateOneHandFab === 'function') updateOneHandFab();
    liveFensterBandAktualisieren();
}

// „Ausblenden“: das Fenster geht zu, das Spiel bleibt stehen. Hat das Ausblenden den Ticker
// pausiert, merkt sich das liveFensterPausiert; wieder öffnen läuft dann weiter.
let liveFensterPausiert = false;
function liveFensterAusblenden() {
    const laeuft = typeof currentMatch !== 'undefined' && currentMatch && currentMatch.minute < 90;
    if (laeuft && typeof liveTickerPaused !== 'undefined' && !liveTickerPaused && typeof toggleLiveTickerAutoplay === 'function') {
        toggleLiveTickerAutoplay();
        liveFensterPausiert = true;
    }
    liveFensterSchliessen();
    if (typeof live3d !== 'undefined' && live3d) live3d.laeuft = false;
    if (typeof showScreen === 'function') showScreen('screen-dashboard');
}

// Wieder öffnen (aus dem Band auf der Übersicht). Nach dem Abpfiff bleibt das Spiel stehen,
// bis der Spielbericht geschlossen ist.
function liveFensterWiederOeffnen() {
    if (typeof currentMatch === 'undefined' || !currentMatch) return;
    liveFensterOeffnen();
    if (liveFensterPausiert && typeof liveTickerPaused !== 'undefined' && liveTickerPaused && typeof toggleLiveTickerAutoplay === 'function') {
        toggleLiveTickerAutoplay();
    }
    liveFensterPausiert = false;
}

// Band auf der Übersicht: zeigt ein laufendes Spiel, das ausgeblendet ist (oder noch offen).
function liveFensterBandAktualisieren() {
    const band = document.getElementById('live-band');
    if (!band) return;
    // Laufend oder nach dem Abpfiff noch nicht mit „Spielbericht schließen“ beendet
    const fertigOffen = document.getElementById('btn-finish-match') && document.getElementById('btn-finish-match').style.display !== 'none';
    const laeuft = !liveFensterBeendet && typeof currentMatch !== 'undefined' && currentMatch && (currentMatch.minute < 90 || fertigOffen);
    const offen = !!document.body.classList.contains('live-fenster-offen');
    if (!laeuft || offen) { band.style.display = 'none'; band.innerHTML = ''; return; }
    band.style.display = 'block';
    band.innerHTML = `<div class="box" style="display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap; border-left-color:var(--primary);">
        <span>⚽ <strong>Spiel läuft</strong> · ${currentMatch.minute}. Minute · ${currentMatch.homeGoals}:${currentMatch.awayGoals}</span>
        <button onclick="liveFensterWiederOeffnen()" class="btn-action" style="width:auto;">▶ Spiel öffnen</button>
    </div>`;
}

// Aus renderDashboardView(): das Band an die richtige Stelle, Stand auffrischen.
function liveFensterBandZeichnen() {
    if (!document.getElementById('live-band')) {
        const oben = document.querySelector('#screen-dashboard .dashboard-hero-sky') || document.querySelector('#screen-dashboard > *');
        if (!oben) return;
        const band = document.createElement('div');
        band.id = 'live-band';
        band.setAttribute('role', 'status');
        oben.parentElement.insertBefore(band, oben);
    }
    liveFensterBandAktualisieren();
}
