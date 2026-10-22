// Ausschreitungen als Bild (Canvas): Szene im Fanblock nach dem Abpfiff (Fenster), Effekt im 3D-Livespiel
// (js/live-3d.js) und Stadionkarte mit Risiko je Block in der Fan-Zentrale. Nur Ansicht: ob und wie schwer
// es kracht, entscheidet pruefeAusschreitungen() (js/ausschreitungen.js) wie bisher nach dem Spiel.
// Bei reduzierter Bewegung zeigen Fenster und Livespiel ein ruhiges Standbild.

const SZENE_DAUER = 8;   // Sekunden, danach bleibt das letzte Bild stehen
let ausschreitungSzene = null;

function szeneReduziert() { return typeof live3dReduziert === 'function' ? live3dReduziert() : false; }
function szeneZufall(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function szeneFarben(eintrag) {
    const eigene = game.clubCrestColor || '#8b5cf6';
    const gegner = typeof LIVE3D_GEGNER_FARBEN !== 'undefined' ? LIVE3D_GEGNER_FARBEN[(typeof live3dHash === 'function' ? live3dHash(eintrag.gegner) : 0) % LIVE3D_GEGNER_FARBEN.length] : '#e53935';
    return { eigene, gegner: gegner === eigene ? '#f5f5f5' : gegner };
}

// ---------- Fenster nach dem Spiel ----------
// Aus pruefeAusschreitungen(): ersetzt die bisherige Meldung, Text und Folgen bleiben gleich.
function zeigeAusschreitungSzene(eintrag, titel, text) {
    const ov = document.getElementById('ausschreitung-szene-overlay');
    if (!ov) { showNotice(titel, text, { typ: 'warn' }); return; }
    document.getElementById('ausschreitung-szene-titel').textContent = titel;
    document.getElementById('ausschreitung-szene-text').innerHTML = mpEsc(text).replace(/\n/g, '<br>');
    ov.classList.add('show');
    const rnd = szeneZufall(eintrag.season * 1000 + eintrag.matchday * 7 + (eintrag.strafe || 0));
    const farben = szeneFarben(eintrag);
    const fans = Array.from({ length: 90 }, (_, i) => ({ reihe: i % 6, x: rnd(), phase: rnd() * 6, gegner: eintrag.stufe !== 'pyro' && rnd() < 0.4, tempo: 0.6 + rnd() }));
    const fackeln = Array.from({ length: eintrag.stufe === 'pyro' ? 7 : 4 }, () => ({ x: 0.15 + rnd() * 0.7, reihe: Math.floor(rnd() * 4) }));
    const laeufer = eintrag.stufe === 'schwer' ? Array.from({ length: 14 }, () => ({ x: 0.1 + rnd() * 0.8, start: rnd() * 3, tempo: 0.18 + rnd() * 0.2, seite: rnd() < 0.5 ? -1 : 1 })) : [];
    if (ausschreitungSzene && ausschreitungSzene.raf) cancelAnimationFrame(ausschreitungSzene.raf);
    ausschreitungSzene = { eintrag, farben, fans, fackeln, laeufer, rauch: [], t0: 0, zeit: 0, raf: 0, rnd, bilder: 0 };
    const c = document.getElementById('ausschreitung-szene-canvas');
    const breite = (c.parentElement && c.parentElement.offsetWidth) || 320;
    const hoehe = Math.round(Math.min(260, Math.max(170, breite * 0.55)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(breite * dpr); c.height = Math.round(hoehe * dpr); c.style.height = hoehe + 'px';
    ausschreitungSzene.W = breite; ausschreitungSzene.H = hoehe; ausschreitungSzene.dpr = dpr;
    if (szeneReduziert()) { ausschreitungSzene.zeit = SZENE_DAUER * 0.6; szeneZeichnen(); return; }
    const schritt = t => {
        const sz = ausschreitungSzene;
        if (!sz || !ov.classList.contains('show')) return;
        if (!sz.t0) sz.t0 = t;
        sz.zeit = (t - sz.t0) / 1000;
        szeneZeichnen();
        if (sz.zeit < SZENE_DAUER) sz.raf = requestAnimationFrame(schritt);
    };
    ausschreitungSzene.raf = requestAnimationFrame(schritt);
}

function schliesseAusschreitungSzene() {
    const ov = document.getElementById('ausschreitung-szene-overlay');
    if (ov) ov.classList.remove('show');
    if (ausschreitungSzene && ausschreitungSzene.raf) cancelAnimationFrame(ausschreitungSzene.raf);
    ausschreitungSzene = null;
}

function szeneZeichnen() {
    const sz = ausschreitungSzene;
    const c = document.getElementById('ausschreitung-szene-canvas');
    if (!sz || !c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
    const { W, H, zeit } = sz;
    const st = sz.eintrag.stufe;
    // Nachthimmel, Flutlicht
    const himmel = ctx.createLinearGradient(0, 0, 0, H);
    himmel.addColorStop(0, '#070b16'); himmel.addColorStop(1, '#16223a');
    ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, H);
    // Blaulicht bei schweren Ausschreitungen
    if (st === 'schwer' && Math.floor(zeit * 3) % 2 === 0) { ctx.fillStyle = 'rgba(40,90,255,0.14)'; ctx.fillRect(0, 0, W, H); }
    // Tribüne (Stufen) und Zaun
    const blockOben = H * 0.12, blockUnten = H * 0.68;
    for (let r = 0; r < 6; r++) {
        const y = blockOben + r * (blockUnten - blockOben) / 6;
        ctx.fillStyle = r % 2 ? '#2a3550' : '#323f5e';
        ctx.fillRect(0, y, W, (blockUnten - blockOben) / 6);
    }
    // Rasen unten
    ctx.fillStyle = '#2e7d32'; ctx.fillRect(0, blockUnten + H * 0.06, W, H);
    ctx.fillStyle = '#388e3c'; for (let i = 0; i < 6; i++) ctx.fillRect(i * W / 3, blockUnten + H * 0.06, W / 6, H);
    // Fans
    const aufstand = st === 'pyro' ? 0.6 : 1;
    sz.fans.forEach(f => {
        const reiheH = (blockUnten - blockOben) / 6;
        let x = f.x * W;
        // Krawall: die Gästegruppe drückt in die Mitte
        if (st !== 'pyro' && f.gegner) x += Math.sin(zeit * f.tempo * 2 + f.phase) * 6 - 10 * Math.min(1, zeit / 3);
        const y = blockOben + (f.reihe + 1) * reiheH;
        const huepf = Math.abs(Math.sin(zeit * 5 * f.tempo + f.phase)) * 3 * aufstand;
        const g = reiheH * 0.9;
        ctx.fillStyle = f.gegner ? sz.farben.gegner : sz.farben.eigene;
        ctx.fillRect(x - g * 0.22, y - g * 0.75 - huepf, g * 0.44, g * 0.55);
        ctx.fillStyle = '#e0ac69';
        ctx.beginPath(); ctx.arc(x, y - g * 0.88 - huepf, g * 0.16, 0, Math.PI * 2); ctx.fill();
        // Arme hoch
        ctx.strokeStyle = '#e0ac69'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - g * 0.2, y - g * 0.7 - huepf); ctx.lineTo(x - g * 0.32, y - g * 1.05 - huepf + Math.sin(zeit * 6 + f.phase) * 2);
        ctx.moveTo(x + g * 0.2, y - g * 0.7 - huepf); ctx.lineTo(x + g * 0.32, y - g * 1.05 - huepf - Math.sin(zeit * 6 + f.phase) * 2); ctx.stroke();
    });
    // Zaun
    ctx.strokeStyle = 'rgba(200,210,230,0.55)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 6) { ctx.beginPath(); ctx.moveTo(x, blockUnten); ctx.lineTo(x, blockUnten + H * 0.06); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, blockUnten); ctx.lineTo(W, blockUnten); ctx.stroke();
    // Bengalos und Rauch
    sz.fackeln.forEach((f, i) => {
        if (zeit < i * 0.35) return;
        const reiheH = (blockUnten - blockOben) / 6;
        const x = f.x * W, y = blockOben + (f.reihe + 0.6) * reiheH;
        const flackern = 0.7 + 0.3 * Math.sin(zeit * 30 + i);
        const glut = ctx.createRadialGradient(x, y, 0, x, y, 26 * flackern);
        glut.addColorStop(0, 'rgba(255,240,200,0.95)'); glut.addColorStop(0.25, 'rgba(255,80,40,0.8)'); glut.addColorStop(1, 'rgba(255,40,20,0)');
        ctx.fillStyle = glut; ctx.beginPath(); ctx.arc(x, y, 26 * flackern, 0, Math.PI * 2); ctx.fill();
    });
    // Rauchwolken steigen auf und ziehen nach rechts
    const wolken = Math.min(40, Math.floor(zeit * 6));
    for (let i = 0; i < wolken; i++) {
        const f = sz.fackeln[i % sz.fackeln.length];
        const alter = zeit - i / 6;
        const x = f.x * W + alter * 14 + Math.sin(i) * 8, y = blockOben + f.reihe * 10 - alter * 16;
        const r = 10 + alter * 7;
        ctx.fillStyle = `rgba(${st === 'pyro' ? '230,120,120' : '170,170,180'},${Math.max(0, 0.32 - alter * 0.04)})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Krawall: Ordnerkette in Warnwesten vor dem Zaun
    if (st !== 'pyro') {
        const n = 8;
        for (let i = 0; i < n; i++) {
            const x = (i + 0.5) * W / n + Math.sin(zeit * 2 + i) * 2;
            const y = blockUnten + H * 0.17;
            ctx.fillStyle = st === 'schwer' ? '#1a237e' : '#fdd835';
            ctx.fillRect(x - 5, y - 16, 10, 12);
            ctx.fillStyle = st === 'schwer' ? '#263238' : '#e0ac69';
            ctx.beginPath(); ctx.arc(x, y - 19, 4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#111111'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x - 3, y + 4); ctx.moveTo(x + 3, y - 4); ctx.lineTo(x + 3, y + 4); ctx.stroke();
        }
        // Becher und Feuerzeuge fliegen
        for (let i = 0; i < 6; i++) {
            const t = ((zeit * 0.8 + i * 0.37) % 1.4) / 1.4;
            const x0 = (0.2 + i * 0.12) * W, x1 = x0 + 30, yb = blockUnten - 10;
            ctx.fillStyle = '#eeeeee';
            ctx.fillRect(x0 + (x1 - x0) * t, yb - Math.sin(Math.PI * t) * 40 + t * 50, 3, 4);
        }
    }
    // Schwer: Platzsturm über den Zaun
    sz.laeufer.forEach(l => {
        const t = zeit - l.start;
        if (t < 0) return;
        const y = blockUnten - 6 + Math.min(1, t * 1.4) * H * 0.25;
        const x = l.x * W + l.seite * t * 20;
        const g = 14;
        ctx.fillStyle = sz.farben.eigene;
        ctx.fillRect(x - 3, y - g * 0.75, 6, g * 0.5);
        ctx.fillStyle = '#e0ac69'; ctx.beginPath(); ctx.arc(x, y - g * 0.9, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.5;
        const s = Math.sin(t * 14) * 3;
        ctx.beginPath(); ctx.moveTo(x, y - g * 0.25); ctx.lineTo(x - 2 + s, y); ctx.moveTo(x, y - g * 0.25); ctx.lineTo(x + 2 - s, y); ctx.stroke();
    });
    // Einblendung
    const name = (AUSSCHREITUNG_STUFEN[st] || {}).name || '';
    ctx.font = `800 ${Math.round(H * 0.08)}px system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(8, 8, ctx.measureText(name).width + 16, H * 0.08 + 10);
    ctx.fillStyle = '#ffffff'; ctx.fillText(name, 16, 13);
    sz.bilder++;
}

// ---------- Effekt im 3D-Livespiel ----------
// Aus pruefeAusschreitungen() nach dem Abpfiff: läuft im noch offenen Livespiel weiter.
function live3dAusschreitung(eintrag) {
    if (typeof live3d === 'undefined' || !live3d || typeof currentMatch === 'undefined' || live3d.match !== currentMatch) return;
    const rnd = szeneZufall(eintrag.matchday * 13 + eintrag.season);
    // Heimkurve hinter dem einen Tor, Gästeblock hinter dem anderen
    const x = eintrag.heim ? 8 : 97;
    live3d.krawall = {
        stufe: eintrag.stufe, start: live3d.zeit, x,
        fackeln: Array.from({ length: 5 }, () => ({ x: x + (rnd() - 0.5) * 18, h: 1 + rnd() * 4 })),
        laeufer: eintrag.stufe === 'schwer' ? Array.from({ length: 10 }, () => ({ x: x + (rnd() - 0.5) * 20, ziel: { x: 30 + rnd() * 45, y: 10 + rnd() * 48 }, start: rnd() * 2 })) : []
    };
    live3dText((AUSSCHREITUNG_STUFEN[eintrag.stufe] || {}).name || '', 4);
    if (szeneReduziert() && typeof live3dZeichneEinmal === 'function') live3dZeichneEinmal();
}

// Aus live3dZeichnen(): Bengalos und Rauch auf der Tribüne, bei schweren Ausschreitungen Fans auf dem Rasen.
function live3dZeichneKrawall(ctx, P) {
    const k = live3d.krawall;
    if (!k) return;
    const t = szeneReduziert() ? 3 : live3d.zeit - k.start;
    k.fackeln.forEach((f, i) => {
        const p = live3dPunkt(P, f.x, -3 - (i % 3) * 1.5, f.h);
        const fl = 0.7 + 0.3 * Math.sin(live3d.zeit * 25 + i);
        const r = Math.max(4, p.s * 3 * fl);
        const glut = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        glut.addColorStop(0, 'rgba(255,240,200,0.95)'); glut.addColorStop(0.3, 'rgba(255,70,30,0.75)'); glut.addColorStop(1, 'rgba(255,40,20,0)');
        ctx.fillStyle = glut; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        // Rauch zieht übers Feld
        for (let j = 0; j < 4; j++) {
            const alter = Math.max(0, t - j * 0.8);
            const q = live3dPunkt(P, f.x + alter * 2.5, -2 + alter * 2.2, f.h + alter * 1.5);
            ctx.fillStyle = `rgba(220,130,130,${Math.max(0, 0.25 - alter * 0.025)})`;
            ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(4, q.s * (2 + alter * 1.2)), 0, Math.PI * 2); ctx.fill();
        }
    });
    k.laeufer.forEach(l => {
        const z = Math.max(0, Math.min(1, (t - l.start) / 4));
        if (t < l.start) return;
        const x = l.x + (l.ziel.x - l.x) * z, y = -1 + (l.ziel.y + 1) * z;
        const p = live3dPunkt(P, x, y, 0);
        const g = 2.7 * p.s;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.4 * g, 0.13 * g, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#263238'; ctx.fillRect(p.x - 0.22 * g, p.y - 1.5 * g, 0.44 * g, 0.65 * g);
        ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = Math.max(1, 0.15 * g);
        const s = Math.sin(live3d.zeit * 12 + l.x) * 0.25 * g;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 0.85 * g); ctx.lineTo(p.x - s, p.y); ctx.moveTo(p.x, p.y - 0.85 * g); ctx.lineTo(p.x + s, p.y); ctx.stroke();
        ctx.fillStyle = '#e0ac69'; ctx.beginPath(); ctx.arc(p.x, p.y - 1.68 * g, 0.17 * g, 0, Math.PI * 2); ctx.fill();
    });
}

// ---------- Stadionkarte in der Fan-Zentrale ----------
// Draufsicht mit vier Blöcken: Farbe nach dem Risiko des nächsten Spiels, Marker für Vorfälle dieser Saison.
function zeichneAusschreitungKarte(lage, spiel) {
    const c = document.getElementById('ausschreitung-karte');
    if (!c) return;
    const breite = 300, hoehe = 170;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = breite * dpr; c.height = hoehe * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, breite, hoehe);
    const risiko = lage ? lage.chance : 0;
    const ton = r => r <= 0 ? '#4caf50' : (r < 0.03 ? '#9ccc65' : (r < 0.08 ? '#ffb300' : '#e53935'));
    const heimKurve = spiel && spiel.heim ? risiko : 0;
    const gaeste = spiel && !spiel.heim ? risiko : (spiel && lage && lage.derby ? risiko * 0.8 : risiko * 0.4);
    const bloecke = [
        { name: 'Heimkurve', x: 8, y: 30, w: 34, h: 110, r: heimKurve },
        { name: 'Gästeblock', x: 258, y: 30, w: 34, h: 110, r: gaeste },
        { name: 'Haupttribüne', x: 50, y: 142, w: 200, h: 22, r: risiko * 0.2 },
        { name: 'Gegengerade', x: 50, y: 6, w: 200, h: 22, r: risiko * 0.3 }
    ];
    bloecke.forEach(b => {
        ctx.fillStyle = ton(b.r); ctx.globalAlpha = 0.85; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (b.h > b.w) { ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(b.name, 0, 0); ctx.restore(); }
        else ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
    });
    // Spielfeld
    ctx.fillStyle = '#2e7d32'; ctx.fillRect(50, 32, 200, 106);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(54, 36, 192, 98); ctx.beginPath(); ctx.moveTo(150, 36); ctx.lineTo(150, 134); ctx.stroke();
    ctx.beginPath(); ctx.arc(150, 85, 14, 0, Math.PI * 2); ctx.stroke();
    // Vorfälle dieser Saison
    (game.ausschreitungen || []).filter(v => v.season === game.season).slice(0, 8).forEach((v, i) => {
        const x = v.heim ? 64 : 236, y = 46 + (i % 6) * 15;   // am Rand des Spielfelds vor dem Block
        ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(v.stufe === 'pyro' ? '🧨' : (v.stufe === 'krawall' ? '👊' : '🔥'), x, y);
    });
}
