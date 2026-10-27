// 3D-Livespiel (Board-Karte "Live Spiel mehr animiert, 3D-Figuren"): Canvas mit echter Perspektive
// wie eine TV-Kamera von der Haupttribüne. Gezeichnet wird der Zustand der Spielphysik
// (js/spielphysik.js): Ball mit Höhe und Schatten, 22 Spieler, Schiedsrichter. Ticker und Anzeigetafel
// folgen dort dem Ball; die Ansicht selbst verändert nichts am Spiel.
// Läuft nur, solange das Livespiel sichtbar ist. Bei reduzierter Bewegung gibt es nur Standbilder
// (die Physik läuft dann nicht, der Ticker wie früher). Umschalten zur Taktiktafel über #live-3d-umschalter.

const LIVE3D_LAENGE = 105, LIVE3D_BREITE = 68;
const LIVE3D_KAMERA_ABSTAND = 45;          // Meter von der nahen Seitenlinie bis zur Kamera
const LIVE3D_FIGUR = 2.7;                   // Figuren etwas größer als maßstäblich, sonst sind sie auf dem Handy winzig
const LIVE3D_KEY = 'anstoss_fm13_live3d';
const LIVE3D_GEGNER_FARBEN = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#212121', '#00acc1', '#c62828'];

let live3d = null;   // Zustand der Ansicht, nicht im Spielstand

function live3dAn() { return safeLocalGet(LIVE3D_KEY) !== '0'; }
function live3dReduziert() {
    const m = document.documentElement.getAttribute('data-motion');
    if (m === 'normal') return false;
    if (m === 'reduziert') return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// ---------- Aufbau ----------
function live3dHash(text) { let h = 0; for (const c of String(text || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// Hautton einer Figur (fest je Spiel, damit sich nichts bei jedem Bild ändert)
function live3dHaut(team, i, heimName) {
    return ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'][live3dHash((team ? 'g' : 'h') + i + (heimName || '')) % 5];
}

function live3dFarben() {
    const m = typeof currentMatch !== 'undefined' ? currentMatch : null;
    const eigene = m && m.isHome === false ? (game.clubCrestAwayColor || '#3fb6ff') : (game.clubCrestColor || '#8b5cf6');
    const gegnerName = m ? (m.isHome ? m.awayName : m.homeName) : '';
    let gegner = LIVE3D_GEGNER_FARBEN[live3dHash(gegnerName) % LIVE3D_GEGNER_FARBEN.length];
    if (live3dFarbAbstand(gegner, eigene) < 120) gegner = LIVE3D_GEGNER_FARBEN.find(f => live3dFarbAbstand(f, eigene) >= 120) || '#f5f5f5';
    const heim = m && m.isHome === false ? gegner : eigene;
    const gast = m && m.isHome === false ? eigene : gegner;
    return { heim, gast };
}
function live3dRgb(hex) { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function live3dFarbAbstand(a, b) { const x = live3dRgb(a), y = live3dRgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); }
function live3dDunkler(hex, f) { const [r, g, b] = live3dRgb(hex); return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`; }

function live3dNeu() {
    const m = currentMatch;
    live3d = { match: m, farben: live3dFarben(), kameraX: 52.5, text: null, textBis: 0, zeit: 0, letzterFrame: 0, laeuft: false, frames: 0 };
    // Ohne laufende Physik (reduzierte Bewegung) trotzdem Aufstellung für das Standbild
    if (typeof spNeu === 'function' && (typeof livePhysik === 'undefined' || !livePhysik || livePhysik.match !== m)) spNeu(m);
}

function live3dText(text, sekunden) { live3d.text = text; live3d.textBis = live3d.zeit + sekunden; }

// Ein Bild weiter: Physik rechnen (js/spielphysik.js), Kamera folgt dem Ball.
function live3dSchritt(dt) {
    const d = live3d;
    d.zeit += dt;
    if (typeof spielphysikTakt === 'function') spielphysikTakt(dt);
    const lp = typeof livePhysik !== 'undefined' ? livePhysik : null;
    const bx = lp ? lp.ball.x : 52.5;
    // Bei Ausschreitungen nach dem Abpfiff schwenkt die Kamera zur betroffenen Kurve
    const kz = Math.max(24, Math.min(81, d.krawall ? d.krawall.x : bx));
    d.kameraX += (kz - d.kameraX) * Math.min(1, dt * 2.2);
}

// ---------- Zeichnen ----------
function live3dProjektion(W, H) {
    // Ferne Seitenlinie bei 24 % der Höhe, nahe bei 96 %
    const dNah = LIVE3D_KAMERA_ABSTAND, dFern = LIVE3D_KAMERA_ABSTAND + LIVE3D_BREITE;
    const K = (0.96 - 0.24) * H / (1 / dNah - 1 / dFern);
    const horizont = 0.96 * H - K / dNah;
    const F = W * dNah / 58;   // an der nahen Seitenlinie sind 58 m zu sehen
    return { W, H, K, horizont, F };
}
function live3dPunkt(P, x, y, h) {
    const d = LIVE3D_KAMERA_ABSTAND + (LIVE3D_BREITE - y);
    const s = P.F / d;
    return { x: P.W / 2 + (x - live3d.kameraX) * s, y: P.horizont + P.K / d - (h || 0) * s, s };
}

function live3dZeichnen(ctx, P) {
    const { W, H } = P;
    // Himmel und Tribüne
    const himmel = ctx.createLinearGradient(0, 0, 0, H * 0.2);
    himmel.addColorStop(0, '#0b1426'); himmel.addColorStop(1, '#1b2b4a');
    ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, H);
    const fern = live3dPunkt(P, 0, 0, 0);
    ctx.fillStyle = '#263248';
    ctx.fillRect(0, fern.y - H * 0.13, W, H * 0.13);
    // Zuschauer als Punkte, an der Kamera festgemacht, damit sie beim Schwenken mitlaufen
    for (let i = 0; i < 260; i++) {
        const wx = (i * 37.3) % 150 - 22, reihe = (i * 7) % 6;
        const p = live3dPunkt(P, wx, -4 - reihe * 1.6, reihe * 1.4 + 1);
        if (p.x < -4 || p.x > W + 4) continue;
        ctx.fillStyle = ['#c9d2e3', '#e57373', '#90caf9', '#ffe082', '#a5d6a7'][(i * 13) % 5];
        ctx.fillRect(p.x, p.y, Math.max(1.5, p.s * 0.7), Math.max(1.5, p.s * 0.9));
    }
    // Fanblöcke hinter den Toren: Heimblock in der eigenen Farbe, Gästeblock in der Gastfarbe (3.159)
    const blockFarben = [[-17, -4, live3d.farben.heim], [108, 121, live3d.farben.gast]];
    blockFarben.forEach(([x0, x1, farbe], b) => {
        for (let i = 0; i < 90; i++) {
            const wx = x0 + ((i * 7.7 + b * 3.1) % (x1 - x0)), reihe = i % 5;
            const wy = 12 + ((i * 13.3) % 44);
            const p = live3dPunkt(P, wx, wy, 1.2 + reihe * 1.5);
            if (p.x < -4 || p.x > W + 4) continue;
            ctx.fillStyle = (i % 4) ? farbe : '#ffffff';   // jeder vierte Fan im Schal oder Trikot-Weiß
            ctx.fillRect(p.x, p.y, Math.max(1.5, p.s * 0.8), Math.max(1.5, p.s * 1.0));
        }
    });
    // Rasen mit Mähstreifen
    for (let i = 0; i < 12; i++) {
        const x0 = i * LIVE3D_LAENGE / 12 - 0.01, x1 = (i + 1) * LIVE3D_LAENGE / 12;
        const a = live3dPunkt(P, x0, 0), b = live3dPunkt(P, x1, 0), c = live3dPunkt(P, x1, LIVE3D_BREITE), d = live3dPunkt(P, x0, LIVE3D_BREITE);
        ctx.fillStyle = i % 2 ? '#2e7d32' : '#388e3c';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }
    // Rand neben dem Spielfeld
    const nl = live3dPunkt(P, -20, LIVE3D_BREITE + 4), nr = live3dPunkt(P, 125, LIVE3D_BREITE + 4), sl = live3dPunkt(P, -20, LIVE3D_BREITE), sr = live3dPunkt(P, 125, LIVE3D_BREITE);
    ctx.fillStyle = '#245f28'; ctx.beginPath(); ctx.moveTo(sl.x, sl.y); ctx.lineTo(sr.x, sr.y); ctx.lineTo(nr.x, nr.y); ctx.lineTo(nl.x, nl.y); ctx.fill();
    // Linien
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.3;
    const linie = pts => { ctx.beginPath(); pts.forEach((q, i) => { const p = live3dPunkt(P, q[0], q[1]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke(); };
    linie([[0, 0], [105, 0], [105, 68], [0, 68], [0, 0]]);
    linie([[52.5, 0], [52.5, 68]]);
    linie(Array.from({ length: 33 }, (_, i) => [52.5 + 9.15 * Math.cos(i / 32 * Math.PI * 2), 34 + 9.15 * Math.sin(i / 32 * Math.PI * 2)]));
    [[0, 1], [105, -1]].forEach(([x, r]) => {
        linie([[x, 13.85], [x + 16.5 * r, 13.85], [x + 16.5 * r, 54.15], [x, 54.15]]);
        linie([[x, 24.85], [x + 5.5 * r, 24.85], [x + 5.5 * r, 43.15], [x, 43.15]]);
    });
    // Eckfahnen
    [[0, 0], [105, 0], [0, 68], [105, 68]].forEach(([x, y]) => {
        const f = live3dPunkt(P, x, y, 0), k = live3dPunkt(P, x, y, 1.5);
        ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(k.x, k.y); ctx.stroke();
        ctx.fillStyle = '#ffd54f'; ctx.fillRect(k.x, k.y, Math.max(3, k.s * 0.5), Math.max(2, k.s * 0.35));
    });
    // Figuren, Schiedsrichter, Tore und Ball nach Tiefe sortiert
    const lp = typeof livePhysik !== 'undefined' && livePhysik && livePhysik.match === live3d.match ? livePhysik : null;
    const dinge = [];
    if (lp) {
        lp.f.forEach(p => { if (p.aktiv) dinge.push({ y: p.y, mal: () => live3dFigur(ctx, P, p, lp) }); });
        dinge.push({ y: lp.schiri.y, mal: () => live3dFigur(ctx, P, Object.assign({ team: -1, nr: 0, haut: '#e0ac69', jubel: 0, hecht: 0, karte: 0, liegt: 0 }, lp.schiri), lp) });
        dinge.push({ y: lp.ball.y + 0.01, mal: () => live3dBall(ctx, P, lp.ball) });
    }
    [0, 105].forEach(x => { dinge.push({ y: 30.3, mal: () => live3dTor(ctx, P, x, 'hinten') }); dinge.push({ y: 37.7, mal: () => live3dTor(ctx, P, x, 'vorn') }); });
    dinge.sort((a, b) => a.y - b.y).forEach(x => x.mal());
    // Name des eigenen Ballführenden
    if (lp && lp.ball.halter && lp.ball.halter.name && lp.ball.halter.team === lp.eigen) {
        const h = lp.ball.halter, k = live3dPunkt(P, h.x, h.y, LIVE3D_FIGUR * 2.2);
        ctx.font = `700 ${Math.round(Math.max(10, H * 0.042))}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const bw = ctx.measureText(h.name).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(k.x - bw / 2, k.y - Math.max(10, H * 0.042) - 4, bw, Math.max(10, H * 0.042) + 4);
        ctx.fillStyle = '#ffffff'; ctx.fillText(h.name, k.x, k.y - 1);
    }
    // Ausschreitungen nach dem Abpfiff (js/ausschreitungen-szene.js)
    if (live3d.krawall && typeof live3dZeichneKrawall === 'function') live3dZeichneKrawall(ctx, P);
    // Einblendung: eigene der Ansicht (Ausschreitungen) vor der aus der Physik
    let text = null;
    if (live3d.text && live3d.zeit < live3d.textBis) text = live3d.text;
    else if (lp && lp.text && lp.t < lp.textBis) text = lp.text;
    if (text) {
        const gross = text === 'TOR!' || text === 'Gegentor';
        ctx.font = `900 ${Math.round(H * (gross ? 0.16 : 0.09))}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(text, W / 2 + 2, H * 0.42 + 2);
        ctx.fillStyle = text === 'TOR!' ? '#ffd54f' : '#ffffff'; ctx.fillText(text, W / 2, H * 0.42);
    }
    // Spielstand oben links: Uhr und Tore so, wie sie auf dem Platz gefallen sind
    const m = live3d.match;
    ctx.font = `700 ${Math.round(Math.max(11, H * 0.055))}px system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const minute = lp ? Math.max(1, Math.floor(lp.uhr)) : m.minute;
    const stand = lp ? lp.anzeige : [m.homeGoals, m.awayGoals];
    const zeile = `${minute}'  ${stand[0]}:${stand[1]}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(6, 6, ctx.measureText(zeile).width + 12, Math.max(11, H * 0.055) + 8);
    ctx.fillStyle = '#ffffff'; ctx.fillText(zeile, 12, 10);
}

function live3dTor(ctx, P, x, teil) {
    const r = x > 50 ? 1 : -1, tiefe = 2 * r;
    const y0 = teil === 'hinten' ? 30.34 : 37.66;
    const p0 = live3dPunkt(P, x, y0, 0), p1 = live3dPunkt(P, x, y0, 2.44), p2 = live3dPunkt(P, x + tiefe, y0, 0), p3 = live3dPunkt(P, x + tiefe, y0, 2.0);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    if (teil === 'vorn') {
        // Netz
        const a = live3dPunkt(P, x + tiefe, 30.34, 2.0), b = live3dPunkt(P, x + tiefe, 37.66, 2.0), c = live3dPunkt(P, x + tiefe, 37.66, 0), d = live3dPunkt(P, x + tiefe, 30.34, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
        const q = live3dPunkt(P, x, 30.34, 2.44);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, p0.s * 0.25);
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p0.x, p0.y); ctx.stroke();
        const q0 = live3dPunkt(P, x, 30.34, 0);
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q0.x, q0.y); ctx.stroke();
    }
}

function live3dFigur(ctx, P, p) {
    const fuss = live3dPunkt(P, p.x, p.y, 0);
    if (fuss.x < -20 || fuss.x > P.W + 20) return;
    const g = LIVE3D_FIGUR * fuss.s;     // Pixel je Meter Figur
    const hoehe = 1.8 * g;
    // team -1 = Schiedsrichter in Schwarz
    const farbe = p.team === -1 ? '#212121' : (p.torwart ? (p.team === 0 ? '#c0ca33' : '#ff7043') : (p.team === 0 ? live3d.farben.heim : live3d.farben.gast));
    const schwung = Math.sin(p.phase) * 0.28 * g;
    const sprung = p.jubel > 0 ? Math.abs(Math.sin(live3d.zeit * 9 + p.nr)) * 0.5 * g : 0;
    // Hechtsprung kippt zur Seite, ein gefoulter Spieler liegt am Boden
    const neigung = p.liegt > 0 ? 1.45 : (p.hecht ? p.hecht * Math.min(1, (p.hechtZeit || 0) * 4) * 0.9 : 0);
    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(fuss.x, fuss.y, 0.42 * g, 0.14 * g, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(fuss.x, fuss.y - sprung);
    if (neigung) ctx.rotate(neigung);
    // Beine
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = Math.max(1, 0.16 * g); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.08 * g, -0.85 * g); ctx.lineTo(-0.1 * g + schwung, 0);
    ctx.moveTo(0.08 * g, -0.85 * g); ctx.lineTo(0.1 * g - schwung, 0); ctx.stroke();
    // Hose
    ctx.fillStyle = live3dDunkler(farbe, 0.45);
    ctx.fillRect(-0.2 * g, -0.98 * g, 0.4 * g, 0.22 * g);
    // Trikot mit Schattierung
    ctx.fillStyle = farbe;
    ctx.beginPath(); ctx.moveTo(-0.24 * g, -1.0 * g); ctx.lineTo(-0.27 * g, -1.5 * g); ctx.lineTo(0.27 * g, -1.5 * g); ctx.lineTo(0.24 * g, -1.0 * g); ctx.closePath(); ctx.fill();
    ctx.fillStyle = live3dDunkler(farbe, 0.75);
    ctx.fillRect(0.06 * g, -1.5 * g, 0.21 * g, 0.5 * g);
    // Arme (beim Jubel hoch)
    ctx.strokeStyle = p.haut; ctx.lineWidth = Math.max(1, 0.12 * g);
    const handY = p.jubel > 0 ? -2.0 * g : -1.08 * g;   // beim Jubel nach oben, sonst hängend
    ctx.beginPath(); ctx.moveTo(-0.27 * g, -1.45 * g); ctx.lineTo(-0.36 * g - schwung * 0.5, handY);
    ctx.moveTo(0.27 * g, -1.45 * g); ctx.lineTo(0.36 * g + schwung * 0.5, handY); ctx.stroke();
    // Kopf
    ctx.fillStyle = p.haut;
    ctx.beginPath(); ctx.arc(0, -hoehe + 0.1 * g, 0.17 * g, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath(); ctx.arc(0, -hoehe + 0.04 * g, 0.17 * g, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Karte über dem Spieler
    if (p.karte) {
        ctx.fillStyle = p.karte === 2 ? '#e53935' : '#fdd835';
        ctx.fillRect(fuss.x + 0.3 * g, fuss.y - hoehe - 0.7 * g, 0.35 * g, 0.5 * g);
    }
}

function live3dBall(ctx, P, b) {
    const boden = live3dPunkt(P, b.x, b.y, 0), luft = live3dPunkt(P, b.x, b.y, (b.z || 0) + 0.22);
    const r = Math.max(2, 0.22 * LIVE3D_FIGUR * boden.s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(boden.x, boden.y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(luft.x, luft.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333333';
    ctx.beginPath(); ctx.arc(luft.x - r * 0.25, luft.y - r * 0.2, r * 0.32, 0, Math.PI * 2); ctx.fill();
}

// ---------- Lauf ----------
function live3dCanvas() { return document.getElementById('live-3d-canvas'); }

function live3dGroesse() {
    const c = live3dCanvas();
    if (!c) return null;
    const breite = (c.parentElement && c.parentElement.offsetWidth) || 360;
    const hoehe = Math.round(Math.max(190, Math.min(360, breite * 0.6)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(breite * dpr) || c.height !== Math.round(hoehe * dpr)) {
        c.width = Math.round(breite * dpr); c.height = Math.round(hoehe * dpr);
        c.style.height = hoehe + 'px';
    }
    return { W: breite, H: hoehe, dpr };
}

function live3dZeichneEinmal() {
    const c = live3dCanvas();
    if (!c || !live3d) return;
    const g = live3d.groesse || live3dGroesse();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    live3dZeichnen(ctx, live3dProjektion(g.W, g.H));
    live3d.frames++;
}

function live3dSichtbar() {
    const sc = document.getElementById('screen-matchday');
    return !!sc && sc.style.display !== 'none' && live3dAn() && !document.hidden;
}

function live3dFrame(t) {
    if (!live3d || !live3d.laeuft) return;
    if (!live3dSichtbar() || typeof currentMatch === 'undefined' || !currentMatch) { live3d.laeuft = false; return; }
    // Neues Spiel bei laufender Ansicht (z. B. Pokal, dann Liga): frisch aufstellen
    if (currentMatch !== live3d.match) { live3dNeu(); live3d.laeuft = true; live3d.groesse = live3dGroesse(); }
    const dt = Math.min(0.05, live3d.letzterFrame ? (t - live3d.letzterFrame) / 1000 : 0.016);
    live3d.letzterFrame = t;
    live3dSchritt(dt);
    live3dZeichneEinmal();
    // Abpfiff: das Bild steht, die Schleife endet
    if (typeof livePhysik !== 'undefined' && livePhysik && livePhysik.eingefroren) { live3d.laeuft = false; return; }
    requestAnimationFrame(live3dFrame);
}

// Aus onScreenShown('screen-matchday') und beim Umschalten.
function live3dAnzeigen() {
    live3dUmschalterZeigen();
    if (!live3dAn() || typeof currentMatch === 'undefined' || !currentMatch) return;
    if (!live3d || live3d.match !== currentMatch) live3dNeu();
    live3d.groesse = live3dGroesse();
    if (live3dReduziert()) {
        live3d.laeuft = false;
        live3dZeichneEinmal();
        // Ohne Animation nur bei neuen Ereignissen neu zeichnen
        clearInterval(live3d.intervall);
        live3d.intervall = setInterval(() => {
            if (!live3d || !live3dSichtbar() || currentMatch !== live3d.match) { clearInterval(live3d && live3d.intervall); return; }
            const stand = JSON.stringify([live3d.match.homeGoals, live3d.match.awayGoals, live3d.match.minute, (live3d.match.sentOff || []).length]);
            if (stand !== live3d.letzterStand) {
                live3d.letzterStand = stand;
                if (typeof livePhysik !== 'undefined' && livePhysik) { livePhysik.anzeige = [live3d.match.homeGoals, live3d.match.awayGoals]; livePhysik.uhr = live3d.match.minute; }
                live3dZeichneEinmal();
            }
        }, 600);
        return;
    }
    if (!live3d.laeuft) { live3d.laeuft = true; live3d.letzterFrame = 0; requestAnimationFrame(live3dFrame); }
}

function live3dUmschalterZeigen() {
    const an = live3dAn();
    const c = live3dCanvas(), alt = document.querySelector('#screen-matchday .live-stadium-frame'), k = document.getElementById('live-3d-umschalter');
    if (c) c.hidden = !an;
    if (alt) alt.style.display = an ? 'none' : '';
    if (k) k.textContent = an ? '🧩 Taktiktafel zeigen' : '🎥 3D-Ansicht zeigen';
}

function live3dUmschalten() {
    safeLocalSet(LIVE3D_KEY, live3dAn() ? '0' : '1');
    if (live3d) live3d.laeuft = false;
    // Läuft gerade ein Spiel, übernimmt der passende Takt: Spielphysik mit 3D, sonst der alte Ticker
    const laeuft = typeof currentMatch !== 'undefined' && currentMatch && currentMatch.minute < 90;
    if (!live3dAn() && typeof spielphysikBeenden === 'function') spielphysikBeenden();
    live3dAnzeigen();
    if (laeuft && typeof startLiveTickerAutoplay === 'function' && (!live3dAn() || (typeof spielphysikAktiv === 'function' && spielphysikAktiv()))) {
        const pause = typeof liveTickerPaused !== 'undefined' && liveTickerPaused;
        startLiveTickerAutoplay();
        if (pause && typeof toggleLiveTickerAutoplay === 'function') toggleLiveTickerAutoplay();
    }
    if (typeof spTempoKnoepfe === 'function') spTempoKnoepfe();
    if (!live3dAn() && typeof render3DPitch === 'function') render3DPitch('live-pitch');
}

window.addEventListener('resize', () => { if (live3d && live3dSichtbar()) { live3d.groesse = live3dGroesse(); if (!live3d.laeuft) live3dZeichneEinmal(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && live3d && live3dSichtbar()) live3dAnzeigen(); });
