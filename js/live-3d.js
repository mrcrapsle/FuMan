// 3D-Livespiel (Board-Karte "Live Spiel mehr animiert, 3D-Figuren"): Canvas mit echter Perspektive
// wie eine TV-Kamera von der Haupttribüne. 22 Figuren mit Laufanimation spielen sich den Ball zu,
// pressen, schießen aufs Tor, der Torwart pariert, Tore werden gefeiert. Die Szenen folgen dem echten
// Spielgeschehen: Tore, Karten, Halbzeit und Abpfiff liest der Lauf aus currentMatch, Torchancen
// meldet simulateMatchStep() über live3dSpielzug(). Das Ergebnis berechnet weiter allein die
// Spiellogik (js/match-live.js), die Ansicht verändert nichts.
// Läuft nur, solange das Livespiel sichtbar ist. Bei reduzierter Bewegung wird nur bei Ereignissen
// neu gezeichnet. Umschalten zur bisherigen Taktiktafel über #live-3d-umschalter.

const LIVE3D_LAENGE = 105, LIVE3D_BREITE = 68;
const LIVE3D_KAMERA_ABSTAND = 45;          // Meter von der nahen Seitenlinie bis zur Kamera
const LIVE3D_FIGUR = 2.7;                   // Figuren etwas größer als maßstäblich, sonst sind sie auf dem Handy winzig
const LIVE3D_KEY = 'anstoss_fm13_live3d';
const LIVE3D_GEGNER_FARBEN = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#212121', '#00acc1', '#c62828'];
// Grundordnung (Anteile von Länge/Breite, Angriff nach rechts): Torwart, Abwehr, Mittelfeld, Sturm
const LIVE3D_ORDNUNG = [[0.04, 0.5], [0.2, 0.15], [0.18, 0.38], [0.18, 0.62], [0.2, 0.85], [0.42, 0.18], [0.38, 0.4], [0.38, 0.6], [0.42, 0.82], [0.6, 0.38], [0.6, 0.62]];

let live3d = null;   // Zustand der Ansicht, nicht im Spielstand
// Eigener Zufall der Ansicht: Math.random gehört der Spiellogik (Tests setzen dort feste Folgen).
let live3dSaat = 0x9e3779b9;
function live3dRnd() { live3dSaat = (live3dSaat * 1664525 + 1013904223) >>> 0; return live3dSaat / 4294967296; }

function live3dAn() { return safeLocalGet(LIVE3D_KEY) !== '0'; }
function live3dReduziert() {
    const m = document.documentElement.getAttribute('data-motion');
    if (m === 'normal') return false;
    if (m === 'reduziert') return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// ---------- Aufbau ----------
function live3dHash(text) { let h = 0; for (const c of String(text || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

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
    const farben = live3dFarben();
    const spieler = [];
    [0, 1].forEach(team => {
        LIVE3D_ORDNUNG.forEach((o, i) => {
            const haut = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'][live3dHash((team ? 'g' : 'h') + i + (m.homeName || '')) % 5];
            spieler.push({ team, nr: i, x: 52.5, y: 34, zx: 52.5, zy: 34, phase: (i * 7 + team * 3) % 6,   // fest statt Math.random: die Ansicht zieht beim Anpfiff keine Zufallszahlen aus dem Spiel
                 haut, torwart: i === 0, karte: 0, jubel: 0, hecht: 0 });
        });
    });
    live3d = {
        match: m, spieler, farben,
        ball: { x: 52.5, y: 34, h: 0, flug: null, halter: null },
        besitz: 0, kameraX: 52.5, szenen: [], szene: null, text: null, textBis: 0,
        letzteTore: [m.homeGoals, m.awayGoals], letzteKarten: Object.keys(m.yellowCards || {}).length + (m.sentOff || []).length,
        halbzeit: !!m.halftimeShown, abpfiff: m.minute >= 90, naechsterPass: 0, zeit: 0, letzterFrame: 0, laeuft: false, frames: 0
    };
    live3dAnstoss(0);
}

// Angriffsrichtung: Heim spielt in der ersten Halbzeit nach rechts.
function live3dRichtung(team) {
    const zweite = live3d && live3d.match && live3d.match.minute >= 45 && live3d.match.halftimeShown;
    const heimRechts = !zweite;
    return (team === 0) === heimRechts ? 1 : -1;
}

function live3dGrundposition(s) {
    const o = LIVE3D_ORDNUNG[s.nr];
    const r = live3dRichtung(s.team);
    return { x: r > 0 ? o[0] * LIVE3D_LAENGE : LIVE3D_LAENGE - o[0] * LIVE3D_LAENGE, y: o[1] * LIVE3D_BREITE };
}

function live3dAnstoss(team) {
    live3d.besitz = team;
    live3d.spieler.forEach(s => { const g = live3dGrundposition(s); s.x = g.x; s.y = g.y; s.jubel = 0; s.hecht = 0; });
    const stuermer = live3d.spieler.find(s => s.team === team && s.nr === 9);
    stuermer.x = 52.5; stuermer.y = 34;
    live3d.ball = { x: 52.5, y: 34, h: 0, flug: null, halter: stuermer };
    live3d.naechsterPass = live3d.zeit + 0.8;
}

// ---------- Ereignisse ----------
// Aus simulateMatchStep() (js/match-live.js): 'home' = Angriff des eigenen Teams, 'away' = des Gegners.
function live3dSpielzug(richtung, ereignis) {
    if (!live3d || !ereignis || richtung === 'midfield') return;
    const m = live3d.match;
    const eigenesTeam = m.isHome ? 0 : 1;
    const team = richtung === 'home' ? eigenesTeam : 1 - eigenesTeam;
    // Tore erkennt live3dPruefeSpielstand() am Spielstand; fiel in diesem Spielzug keins, wird es eine Chance.
    if (live3d.match !== m) return;
    const vorher = live3d.letzteTore[0] + live3d.letzteTore[1];
    live3dPruefeSpielstand();
    if (live3d.letzteTore[0] + live3d.letzteTore[1] === vorher) live3dSzene({ art: 'chance', team });
}

function live3dSzene(s) {
    if (!live3d) return;
    // Bei vielen Szenen auf einmal (Ticker schneller als die Bilder) fallen alte Chancen weg.
    live3d.szenen = live3d.szenen.filter(x => x.art !== 'chance').slice(-2);
    live3d.szenen.push(s);
    if (live3dReduziert()) live3dZeichneEinmal();
}

function live3dPruefeSpielstand() {
    const m = live3d.match;
    if (m.homeGoals > live3d.letzteTore[0]) live3dSzene({ art: 'tor', team: 0 });
    if (m.awayGoals > live3d.letzteTore[1]) live3dSzene({ art: 'tor', team: 1 });
    live3d.letzteTore = [m.homeGoals, m.awayGoals];
    const karten = Object.keys(m.yellowCards || {}).length + (m.sentOff || []).length;
    if (karten > live3d.letzteKarten) live3dSzene({ art: 'karte', rot: (m.sentOff || []).length > (live3d.rote || 0) });
    live3d.rote = (m.sentOff || []).length;
    live3d.letzteKarten = karten;
    if (m.halftimeShown && !live3d.halbzeit) { live3d.halbzeit = true; live3dText('Halbzeit', 2.5); live3dAnstoss(1); }
    if (m.minute >= 90 && !live3d.abpfiff) { live3d.abpfiff = true; live3d.szenen = []; live3dText('Abpfiff', 99); }
}

function live3dText(text, sekunden) { live3d.text = text; live3d.textBis = live3d.zeit + sekunden; }

// Startet eine Szene: Angriff über zwei, drei Stationen bis zum Abschluss.
function live3dStarteSzene(s) {
    const r = live3dRichtung(s.team);
    const torX = r > 0 ? LIVE3D_LAENGE : 0;
    const angreifer = live3d.spieler.filter(p => p.team === s.team && !p.torwart);
    const vorne = angreifer.sort((a, b) => (b.x - a.x) * r)[0];
    live3d.besitz = s.team;
    s.schritte = [
        { ziel: angreifer.find(p => p.nr === 6) || vorne, dauer: 0.7 },
        { ziel: angreifer.find(p => p.nr === 9) || vorne, dauer: 0.7 },
        { schuss: true, torX, torY: 34 + (live3dRnd() * 6 - 3), dauer: 0.55 }
    ];
    s.schritt = 0; s.start = live3d.zeit;
    if (s.art === 'karte') {
        s.schritte = [{ pause: true, dauer: 1.6 }];
        const taeter = live3d.spieler.filter(p => p.team !== live3d.besitz && !p.torwart)[Math.floor(live3dRnd() * 10)];
        if (taeter) { taeter.karte = s.rot ? 2 : 1; s.taeter = taeter; }
    }
    live3d.szene = s;
}

function live3dSzeneWeiter(dt) {
    const s = live3d.szene;
    const b = live3d.ball;
    if (b.flug) return;   // erst landen lassen
    const schritt = s.schritte[s.schritt];
    if (!schritt) { live3dSzeneEnde(s); return; }
    if (schritt.pause) {
        schritt.dauer -= dt;
        if (schritt.dauer <= 0) { if (s.taeter) s.taeter.karte = 0; s.schritt++; }
        return;
    }
    if (schritt.schuss) {
        const torwart = live3d.spieler.find(p => p.team !== s.team && p.torwart);
        const trifft = s.art === 'tor';
        const zielY = trifft ? schritt.torY : (live3dRnd() < 0.5 ? torwart.y + (live3dRnd() * 2 - 1) : schritt.torY + (live3dRnd() < 0.5 ? -6 : 6));
        const zielX = trifft ? schritt.torX + (schritt.torX > 50 ? 1.2 : -1.2) : (Math.abs(zielY - torwart.y) < 2 ? torwart.x : schritt.torX + (schritt.torX > 50 ? 2 : -2));
        live3dPass(b.halter, { x: zielX, y: zielY }, schritt.dauer, trifft ? 1.6 : 1.1);
        torwart.hecht = trifft || Math.abs(zielY - torwart.y) > 2 ? (zielY > torwart.y ? 1 : -1) : 0.01;
        s.ergebnis = trifft ? 'tor' : (Math.abs(zielY - torwart.y) < 2 ? 'gehalten' : 'vorbei');
        s.torwart = torwart;
        s.schritt++;
        return;
    }
    live3dPass(b.halter, schritt.ziel, schritt.dauer, 0.6);
    s.schritt++;
}

function live3dSzeneEnde(s) {
    live3d.szene = null;
    if (s.art === 'tor') {
        const m = live3d.match;
        const eigen = (m.isHome ? 0 : 1) === s.team;
        live3dText(eigen ? 'TOR!' : 'Gegentor', 2.2);
        live3d.spieler.forEach(p => { if (p.team === s.team) p.jubel = 2.2; });
        live3d.jubelEnde = live3d.zeit + 2.2;
        live3d.anstossNach = 1 - s.team;
    } else if (s.art === 'chance') {
        if (s.ergebnis === 'gehalten' && s.torwart) { live3dText('Gehalten!', 1.2); live3d.ball.halter = s.torwart; live3d.besitz = s.torwart.team; }
        else { live3dText('Knapp vorbei', 1.2); const tw = live3d.spieler.find(p => p.team !== s.team && p.torwart); live3d.ball.halter = tw; live3d.besitz = tw.team; live3d.ball.x = tw.x; live3d.ball.y = tw.y; live3d.ball.h = 0; }
        live3d.naechsterPass = live3d.zeit + 1;
    } else if (s.art === 'karte') {
        live3d.naechsterPass = live3d.zeit + 0.4;
    }
}

// ---------- Bewegung ----------
function live3dPass(von, ziel, dauer, bogen) {
    const b = live3d.ball;
    b.flug = { ax: b.x, ay: b.y, bx: ziel.x, by: ziel.y, t: 0, dauer, bogen, empfaenger: ziel.team !== undefined ? ziel : null };
    b.halter = null;
}

function live3dSchritt(dt) {
    const d = live3d;
    d.zeit += dt;
    live3dPruefeSpielstand();
    const b = d.ball;

    // Jubel vorbei -> Anstoß
    if (d.jubelEnde && d.zeit >= d.jubelEnde) { d.jubelEnde = 0; live3dAnstoss(d.anstossNach); }

    if (!d.szene && !d.jubelEnde && d.szenen.length && !b.flug && !d.abpfiff) live3dStarteSzene(d.szenen.shift());
    if (d.szene) live3dSzeneWeiter(dt);

    // Ball
    if (b.flug) {
        const f = b.flug;
        f.t += dt / f.dauer;
        const t = Math.min(1, f.t);
        b.x = f.ax + (f.bx - f.ax) * t;
        b.y = f.ay + (f.by - f.ay) * t;
        b.h = Math.sin(Math.PI * t) * f.bogen * 3;
        if (t >= 1) {
            b.flug = null; b.h = 0;
            if (f.empfaenger) { b.halter = f.empfaenger; d.besitz = f.empfaenger.team; }
        }
    } else if (b.halter) {
        // Dribbeln: der Ballführende trägt den Ball langsam Richtung Tor
        const r = live3dRichtung(b.halter.team);
        if (!d.szene && !d.jubelEnde && !d.abpfiff && !b.halter.torwart) b.halter.zx = Math.max(3, Math.min(102, b.halter.x + r * 3));
        b.x += (b.halter.x + 0.6 * r - b.x) * Math.min(1, dt * 8);
        b.y += (b.halter.y + 0.3 - b.y) * Math.min(1, dt * 8);
    }

    // Ruhiges Passspiel zwischen den Szenen
    if (!d.szene && !d.jubelEnde && !d.abpfiff && b.halter && !b.flug && d.zeit >= d.naechsterPass) {
        const r = live3dRichtung(b.halter.team);
        const mit = d.spieler.filter(p => p.team === b.halter.team && p !== b.halter && !p.torwart);
        // eher nach vorn, aber nicht zu weit
        mit.sort((a, c) => ((c.x - b.halter.x) * r - Math.abs(c.y - b.halter.y) * 0.3) - ((a.x - b.halter.x) * r - Math.abs(a.y - b.halter.y) * 0.3));
        let ziel = mit[Math.floor(live3dRnd() * Math.min(4, mit.length))];
        // Ballverlust ans pressende Team
        if (live3dRnd() < 0.18) {
            const gegner = d.spieler.filter(p => p.team !== b.halter.team && !p.torwart);
            ziel = gegner.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
        }
        // Weit vorn ohne Szene: zurück ins Mittelfeld, damit Abschlüsse den echten Chancen vorbehalten bleiben
        const toreX = r > 0 ? 88 : 17;
        if ((r > 0 && b.halter.x > toreX) || (r < 0 && b.halter.x < toreX)) ziel = mit.sort((a, c) => (a.x - c.x) * r)[0];
        live3dPass(b.halter, ziel, 0.5 + Math.hypot(ziel.x - b.x, ziel.y - b.y) / 40, Math.hypot(ziel.x - b.x, ziel.y - b.y) > 25 ? 2 : 0.3);
        d.naechsterPass = d.zeit + 0.9 + live3dRnd() * 1.2;
    }

    // Spieler: Grundordnung, zur Ballseite verschoben; der Nächste presst
    const bx = b.x, by = b.y;
    const naechster = [0, 1].map(team => d.spieler.filter(p => p.team === team && !p.torwart)
        .reduce((a, c) => (Math.hypot(c.x - bx, c.y - by) < Math.hypot(a.x - bx, a.y - by) ? c : a)));
    d.spieler.forEach(p => {
        const g = live3dGrundposition(p);
        const r = live3dRichtung(p.team);
        const imBesitz = d.besitz === p.team;
        let zx = g.x + (bx - 52.5) * 0.45 + (imBesitz ? 8 * r : -4 * r);
        let zy = g.y + (by - 34) * 0.25;
        if (p.torwart) { zx = g.x + (bx - 52.5) * 0.06; zy = 34 + (by - 34) * 0.15; }
        if (p === naechster[p.team] && !imBesitz) { zx = bx - r * 1.2; zy = by; }
        if (b.flug && b.flug.empfaenger === p) { zx = b.flug.bx; zy = b.flug.by; }
        if (b.halter === p && !p.torwart) { zx = p.zx; zy = p.y; }
        if (p.jubel > 0) { p.jubel -= dt; zx = p.x; zy = p.y; }
        zx = Math.max(1, Math.min(104, zx)); zy = Math.max(1, Math.min(67, zy));
        const dx = zx - p.x, dy = zy - p.y, dist = Math.hypot(dx, dy);
        const tempo = (p.torwart ? 5 : 7.5) * dt;
        if (dist > 0.05) { const k = Math.min(1, tempo / dist); p.x += dx * k; p.y += dy * k; p.phase += Math.min(dist, tempo) * 2.2; }
        if (p.hecht) { p.hechtZeit = (p.hechtZeit || 0) + dt; if (p.hechtZeit > 1.2) { p.hecht = 0; p.hechtZeit = 0; } }
    });

    // Kamera folgt dem Ball
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
    // Figuren und Tore nach Tiefe sortiert
    const dinge = live3d.spieler.map(p => ({ y: p.y, mal: () => live3dFigur(ctx, P, p) }));
    [0, 105].forEach(x => { dinge.push({ y: 30.3, mal: () => live3dTor(ctx, P, x, 'hinten') }); dinge.push({ y: 37.7, mal: () => live3dTor(ctx, P, x, 'vorn') }); });
    dinge.push({ y: live3d.ball.y + 0.01, mal: () => live3dBall(ctx, P) });
    dinge.sort((a, b) => a.y - b.y).forEach(x => x.mal());
    // Ausschreitungen nach dem Abpfiff (js/ausschreitungen-szene.js)
    if (live3d.krawall && typeof live3dZeichneKrawall === 'function') live3dZeichneKrawall(ctx, P);
    // Einblendung
    if (live3d.text && live3d.zeit < live3d.textBis) {
        const gross = live3d.text === 'TOR!' || live3d.text === 'Gegentor';
        ctx.font = `900 ${Math.round(H * (gross ? 0.16 : 0.09))}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(live3d.text, W / 2 + 2, H * 0.42 + 2);
        ctx.fillStyle = live3d.text === 'TOR!' ? '#ffd54f' : '#ffffff'; ctx.fillText(live3d.text, W / 2, H * 0.42);
    }
    // Spielstand oben links
    const m = live3d.match;
    ctx.font = `700 ${Math.round(Math.max(11, H * 0.055))}px system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const zeile = `${m.minute}'  ${m.homeGoals}:${m.awayGoals}`;
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
    const farbe = p.torwart ? (p.team === 0 ? '#c0ca33' : '#ff7043') : (p.team === 0 ? live3d.farben.heim : live3d.farben.gast);
    const schwung = Math.sin(p.phase) * 0.28 * g;
    const sprung = p.jubel > 0 ? Math.abs(Math.sin(live3d.zeit * 9 + p.nr)) * 0.5 * g : 0;
    const neigung = p.hecht ? p.hecht * Math.min(1, (p.hechtZeit || 0) * 4) * 0.9 : 0;
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

function live3dBall(ctx, P) {
    const b = live3d.ball;
    const boden = live3dPunkt(P, b.x, b.y, 0), luft = live3dPunkt(P, b.x, b.y, b.h + 0.22);
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
    // Reduzierte Bewegung: Szenen springen ans Ende
    if (live3dReduziert()) {
        for (let i = 0; i < 400 && (live3d.szene || live3d.szenen.length || live3d.ball.flug); i++) live3dSchritt(0.05);
    }
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
    // Hinkt die Ansicht dem Ticker hinterher, läuft sie schneller
    const tempo = live3d.szenen.length > 1 ? 2 : 1;
    live3dSchritt(dt * tempo);
    live3dZeichneEinmal();
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
            const vorher = JSON.stringify([live3d.letzteTore, live3d.letzteKarten, live3d.match.minute]);
            live3dPruefeSpielstand();
            if (vorher !== JSON.stringify([live3d.letzteTore, live3d.letzteKarten, live3d.match.minute])) live3dZeichneEinmal();
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
    live3dAnzeigen();
    if (!live3dAn() && typeof render3DPitch === 'function') render3DPitch('live-pitch');
}

window.addEventListener('resize', () => { if (live3d && live3dSichtbar()) { live3d.groesse = live3dGroesse(); if (!live3d.laeuft) live3dZeichneEinmal(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && live3d && live3dSichtbar()) live3dAnzeigen(); });
