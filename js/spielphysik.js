// Spielphysik im Livespiel: Ball und 22 Spieler werden physikalisch berechnet (Schwerkraft,
// Luftwiderstand, Rollreibung, Aufsprung, Pfosten, Latte, Netz, Laufen mit begrenzter
// Beschleunigung). Die Spiellogik (simulateMatchStep() in js/match-live.js) legt wie bisher fest,
// WAS in einem Spielzug passiert (Tore aus getExpectedGoals(), Karten, Chancen, Standards), und
// schreibt es mit Minute ins Drehbuch. Die Regie hier spielt das Drehbuch auf dem Platz nach:
// Ein Tor erscheint im Ticker und auf der Anzeigetafel erst, wenn der Ball im Bild die Torlinie
// überquert; Chancen, Karten und Standards erscheinen, wenn sie auf dem Platz passieren. Die Art
// der Szene folgt dem Tickertext (Kopfball nach Ecke, Konter, Distanzschuss, Pfosten ...).
// js/live-3d.js zeichnet nur diesen Zustand. Ohne 3D-Ansicht, bei reduzierter Bewegung, beim
// schnellen Durchspielen und mit "Nächste Szene" läuft alles sofort wie vorher.
// Eigener Zufall (spRnd): Math.random gehört der Spiellogik, die Physik ändert keine Ergebnisse.

const SP_L = 105, SP_B = 68, SP_G = 9.81;
const SP_PFOSTEN = [30.34, 37.66], SP_LATTE = 2.44;
const SP_ROLL = 1.6;          // Rollreibung auf Rasen in m/s²
const SP_LUFT = 0.011;        // Luftwiderstand (Verzögerung = SP_LUFT · v²)
const SP_DT = 1 / 120;        // fester Physik-Takt in Sekunden
const SP_TEMPO_KEY = 'anstoss_fm13_live_tempo';
// Sekunden je Spielminute und Faktor für die Physik je Tempostufe
const SP_TEMPI = { 1: { sek: 0.9, physik: 1 }, 2: { sek: 0.45, physik: 1.35 }, 4: { sek: 0.2, physik: 1.8 } };
// Wie fällt das Tor? Tickertext (GOAL_STYLES in js/match.js) -> Szene
const SP_TOR_SZENEN = {
    'per Kopfball nach einer Ecke': 'ecke', 'mit einem Flachschuss ins lange Eck': 'flach', 'nach einem blitzschnellen Konter': 'konter',
    'mit einem Distanzschuss aus 20 Metern': 'distanz', 'als Abstauber nach einer Torwartparade': 'abstauber', 'nach einem feinen Doppelpass': 'doppelpass',
    'mit einem sehenswerten Volley': 'volley', 'per Elfmeter': 'elfmeter', 'mit einem direkten Freistoß': 'freistoss',
    'mit einem traumhaften direkten Freistoß': 'freistoss', 'nach einer Flanke von außen': 'flanke'
};
// Chancen und Füllzeilen (js/match.js) -> Szene und Ausgang
const SP_CHANCEN_SZENEN = {
    'Gute Kombination, aber der letzte Pass sitzt nicht.': ['fehlpass'],
    'Distanzschuss geht knapp über die Latte!': ['distanz', 'drueber'],
    'Der gegnerische Torwart klärt in höchster Not zur Ecke.': ['kombination', 'parade'],
    'Kopfball nach Ecke – knapp vorbei!': ['ecke', 'vorbei'],
    'Der Pfosten rettet für den Gegner!': ['kombination', 'pfosten'],
    'Flanke von rechts, der Kopfball streicht knapp am Tor vorbei.': ['flanke', 'vorbei'],
    'Schneller Konter - im letzten Moment noch abgelaufen.': ['konter-abgelaufen'],
    'Freistoß aus 18 Metern, der Torwart lenkt ihn über die Latte!': ['freistoss', 'parade'],
    'Doppelpass im Strafraum, aber der Abschluss ist zu harmlos.': ['doppelpass', 'harmlos'],
    'Ein Schuss wird im letzten Moment noch geblockt.': ['kombination', 'geblockt'],
    'Gefährlicher Konter, aber unsere Abwehr klärt in letzter Sekunde.': ['konter-abgelaufen'],
    'Fernschuss des Gegners geht knapp drüber.': ['distanz', 'drueber'],
    'Unser Torwart pariert stark!': ['kombination', 'parade'],
    'Der Gegner vergibt eine Großchance freistehend!': ['kombination', 'vorbei'],
    'Gefährliche Flanke in unseren Strafraum - geklärt!': ['flanke-geklaert'],
    'Der Gegner trifft nur das Außennetz.': ['kombination', 'aussennetz'],
    'Unsere Abwehr steht nach einem Ballverlust weit offen - Glück gehabt!': ['konter', 'vorbei'],
    'Ein Kopfball des Gegners landet auf der Latte!': ['flanke', 'latte'],
    'Ecke wird ungefährlich geklärt.': ['ecke-geklaert'],
    'Zweikampf im Mittelfeld, Ball geht ins Toraus.': ['seitenaus'],
    'Ein Freistoß aus dem Halbfeld segelt ins Toraus.': ['halbfeld-freistoss'],
    'Abseits! Der Linienrichter hebt die Fahne.': ['abseits'],
    'Ein Spieler bleibt kurz liegen, geht dann aber weiter.': ['liegen'],
    'Der Schiedsrichter lässt eine Rudelbildung schlichten.': ['rudel'],
    'Hektische Szene an der Mittellinie, der Schiedsrichter beruhigt.': ['rudel']
};
// Ungefähre Dauer einer Szene in Sekunden: so früh beginnt sie vor ihrer Minute
const SP_SZENEN_DAUER = { tor: 7, chance: 6, schuss: 5, karte: 5, standard: 6, 'standard-gegner': 8, var: 9 };

let livePhysik = null;   // Zustand des laufenden Livespiels, nicht im Spielstand
let spSaat = 0x2545f491;
function spRnd() { spSaat = (spSaat * 1664525 + 1013904223) >>> 0; return spSaat / 4294967296; }
function spKlemme(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------- Schalter ----------
function spielphysikAktiv() {
    if (window.anstossOhnePhysik) return false;
    if (typeof live3dAn !== 'function' || !live3dAn() || live3dReduziert()) return false;
    return !!document.getElementById('live-3d-canvas');
}
function spTempo() {
    const t = Number(typeof safeLocalGet === 'function' ? safeLocalGet(SP_TEMPO_KEY) : 1);
    return SP_TEMPI[t] ? t : 1;
}
function spielTempoSetzen(t) {
    if (!SP_TEMPI[t]) return;
    safeLocalSet(SP_TEMPO_KEY, String(t));
    spTempoKnoepfe();
    showToast(`Spieltempo ${t}×`, 'info', 1500);
}
function spTempoKnoepfe() {
    const box = document.getElementById('live-tempo-box');
    if (!box) return;
    box.hidden = !spielphysikAktiv();
    const t = spTempo();
    [1, 2, 4].forEach(n => { const b = document.getElementById('live-tempo-' + n); if (b) b.className = n === t ? 'btn-action' : 'btn-secondary'; });
}

// ---------- Koordinaten ----------
// Team 0 (Heim) spielt in der ersten Halbzeit nach rechts.
function spR(team) { return (team === 0) !== !!(livePhysik && livePhysik.zweite) ? 1 : -1; }
// Angriffssicht (ax ab dem eigenen Tor, ay von links in Laufrichtung) -> Platz
function spW(team, ax, ay) { return spR(team) > 0 ? { x: ax, y: ay } : { x: SP_L - ax, y: SP_B - ay }; }
function spA(team, x, y) { return spW(team, x, y); }
function spTorX(team) { return spR(team) > 0 ? SP_L : 0; }   // Tor, auf das team schießt

// ---------- Aufbau ----------
function spSlots(formation) {
    const coords = typeof getFormationCoords === 'function' ? getFormationCoords(formation || '4-4-2') : null;
    const liste = (coords && coords.length === 11 ? coords : [{ top: 88, left: 50 }, { top: 70, left: 18 }, { top: 70, left: 39 }, { top: 70, left: 61 }, { top: 70, left: 82 },
        { top: 45, left: 18 }, { top: 45, left: 39 }, { top: 45, left: 61 }, { top: 45, left: 82 }, { top: 18, left: 35 }, { top: 18, left: 65 }]);
    return liste.map((c, i) => ({
        fx: i === 0 ? 0.025 : spKlemme(0.03 + (90 - c.top) / 76 * 0.6, 0.12, 0.66),
        fy: c.left / 100,
        rolle: i === 0 ? 'TW' : (c.top >= 60 ? 'ABW' : (c.top >= 30 ? 'MIT' : 'ST'))
    }));
}

function spEigeneAufPlatz() {
    const m = currentMatch;
    const ordnung = { TW: 0, ABW: 1, MIT: 2, ST: 3 };
    return squad.filter(p => lineup.includes(p.id) && !(m.sentOff || []).includes(p.id))
        .sort((a, b) => (ordnung[a.pos] - ordnung[b.pos]) || (b.strength - a.strength));
}

function spNeu(m) {
    const eigen = m.isHome ? 0 : 1;
    const figuren = [];
    [0, 1].forEach(team => {
        const slots = spSlots(team === eigen ? game.formation : '4-4-2');
        slots.forEach((s, i) => {
            const haut = typeof live3dHaut === 'function' ? live3dHaut(team, i, m.homeName) : '';
            figuren.push({ team, nr: i, rolle: s.rolle, fx: s.fx, fy: s.fy, torwart: i === 0, x: 52.5, y: 34, vx: 0, vy: 0, zx: 52.5, zy: 34,
                phase: (i * 7 + team * 3) % 6, haut, id: null, name: '', karte: 0, karteBis: 0, jubel: 0, hecht: 0, hechtZeit: 0, liegt: 0, sprint: false, aktiv: true });
        });
    });
    livePhysik = {
        match: m, f: figuren, eigen,
        ball: { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, halter: null, letzter: 0, imNetz: null, aus: null },
        schiri: { x: 48, y: 30, vx: 0, vy: 0, zx: 48, zy: 30, phase: 0 },
        t: 0, rest: 0, uhr: m.minute || 0, ende: m.minute || 0, anzeige: [m.homeGoals, m.awayGoals],
        besitz: 0, zielBesitz: 50, pass: null, naechsterPass: 0, schuss: null,
        queue: [], szene: null, text: null, textBis: 0, zweite: !!(m.halftimeShown && m.minute >= 45),
        halbzeitWartet: false, abpfiff: m.minute >= 90, angezeigteMinute: -1, roteGegner: 0
    };
    spKaderAbgleich();
    spAnstoss(0, true);
}

// Eigene Figuren tragen die echten Spieler (Namen über dem Ballführenden, Torschütze schießt selbst).
function spKaderAbgleich() {
    const lp = livePhysik, m = lp.match;
    const auf = spEigeneAufPlatz();
    const eigene = lp.f.filter(f => f.team === lp.eigen);
    const vergeben = new Set();
    eigene.forEach(f => { if (f.id && auf.some(p => p.id === f.id)) vergeben.add(f.id); else f.id = null; });
    const frei = auf.filter(p => !vergeben.has(p.id));
    eigene.forEach(f => {
        if (f.id) return;
        const passend = frei.find(p => (p.pos === 'TW') === f.torwart) || (f.torwart ? null : frei.find(p => p.pos !== 'TW'));
        if (passend) { f.id = passend.id; frei.splice(frei.indexOf(passend), 1); }
    });
    eigene.forEach(f => {
        const p = f.id ? squad.find(x => x.id === f.id) : null;
        f.name = p ? String(p.name).split(' ').slice(-1)[0] : '';
        f.aktiv = !!p;
    });
    // Platzverweise beim Gegner: je Rot fehlt eine Figur
    const gegnerSeite = lp.eigen === 0 ? 1 : 0;
    const rote = m.stats ? m.stats.red[gegnerSeite] || 0 : 0;
    const gegner = lp.f.filter(f => f.team !== lp.eigen && !f.torwart);
    const raus = gegner.filter(f => f.rolle !== 'ABW').slice(0, rote);
    gegner.forEach(f => { f.aktiv = !raus.includes(f); });
}

function spAktive(team) { return livePhysik.f.filter(f => f.aktiv && (team === undefined || f.team === team)); }
function spFeld(team) { return spAktive(team).filter(f => !f.torwart); }
function spTorwart(team) { return livePhysik.f.find(f => f.team === team && f.torwart); }
function spDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function spNaechster(liste, p) { return liste.reduce((a, c) => (!a || spDist(c, p) < spDist(a, p) ? c : a), null); }

// ---------- Anstoß ----------
function spAnstoss(team, sofort) {
    const lp = livePhysik;
    lp.besitz = team; lp.pass = null; lp.schuss = null;
    lp.f.forEach(f => {
        const ax = f.torwart ? 1.5 : f.fx * SP_L * 0.72;
        const w = spW(f.team, Math.min(ax, 50), f.fy * SP_B);
        f.zx = w.x; f.zy = w.y; f.jubel = 0; f.hecht = 0; f.liegt = 0; f.sprint = false;
        if (sofort) { f.x = w.x; f.y = w.y; f.vx = 0; f.vy = 0; }
    });
    const st = spFeld(team).filter(f => f.rolle === 'ST')[0] || spFeld(team)[0];
    if (st) { st.zx = 52.5 - spR(team) * 0.6; st.zy = 34; if (sofort) { st.x = st.zx; st.y = st.zy; } }
    const b = lp.ball;
    Object.assign(b, { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, halter: sofort ? st : null, imNetz: null, aus: null, letzter: team });
    lp.anstossFigur = st;
    lp.naechsterPass = lp.t + 1.2;
}

// ---------- Ballphysik ----------
function spBallSchritt(b, dt) {
    if (b.z > 0.0001 || b.vz > 0) {
        b.vz -= SP_G * dt;
        const v = Math.hypot(b.vx, b.vy, b.vz), k = Math.max(0, 1 - SP_LUFT * v * dt);
        b.vx *= k; b.vy *= k; b.vz *= k;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.z <= 0) {
            b.z = 0;
            if (b.vz < -1.8) { b.vz = -b.vz * 0.5; b.vx *= 0.82; b.vy *= 0.82; } else b.vz = 0;
        }
    } else {
        const v = Math.hypot(b.vx, b.vy);
        if (v > 0) {
            const nv = Math.max(0, v - (SP_ROLL + SP_LUFT * 0.5 * v * v) * dt);
            b.vx *= nv / v; b.vy *= nv / v;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
    }
}

// Flachpass: Startgeschwindigkeit, mit der der Ball nach T Sekunden d Meter weit gerollt ist.
function spRollWeg(v0, T) {
    const b = { x: 0, y: 0, z: 0, vx: v0, vy: 0, vz: 0 };
    for (let t = 0; t < T; t += SP_DT) spBallSchritt(b, SP_DT);
    return b.x;
}
function spFlachLoesen(d, T) {
    let lo = 0.3, hi = 42;
    if (spRollWeg(hi, T) < d) return hi;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (spRollWeg(mid, T) < d) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
}
// Flug mit horizontaler Startgeschwindigkeit s und vz: Höhe und Zeit, wenn der Ball d Meter weit ist.
// Landet er vorher, zählt das als negative Höhe (damit die Suche über vz eindeutig bleibt).
function spFlug(s, vz, d, z0) {
    const b = { x: 0, y: 0, z: Math.max(0.11, z0 || 0), vx: s, vy: 0, vz };
    let t = 0, gelandet = false;
    while (b.x < d && t < 8) {
        const px = b.x, pz = b.z;
        spBallSchritt(b, SP_DT); t += SP_DT;
        if (b.z === 0 && !gelandet && t > 0.05) gelandet = true;
        if (b.x >= d) { const f = (d - px) / Math.max(1e-6, b.x - px); return { t, z: gelandet ? -1 - (d - b.x) : pz + (b.z - pz) * f }; }
        if (Math.hypot(b.vx, b.vy) < 0.05) break;
    }
    return { t, z: -1 - Math.max(0, d - b.x) };
}
function spVzLoesen(s, d, zZiel, z0) {
    let lo = -8, hi = 26;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (spFlug(s, mid, d, z0).z < zZiel) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
}
// Hoher Ball: kommt nach etwa T Sekunden in Höhe zZiel bei d Metern an.
function spHochLoesen(d, zZiel, T, z0) {
    let s = Math.max(4, d / T * 1.15), vz = 0;
    for (let k = 0; k < 5; k++) {
        vz = spVzLoesen(s, d, zZiel, z0);
        const t = spFlug(s, vz, d, z0).t;
        s = spKlemme(s * t / T, 4, 40);
    }
    return { s, vz: spVzLoesen(s, d, zZiel, z0) };
}

// Schießt den Ball von seiner Lage zum Punkt (x, y, z); hoch = Bogen, sonst flach bzw. als Schuss.
function spSpielen(ziel, opt) {
    const lp = livePhysik, b = lp.ball;
    const von = b.halter;
    if (von) { b.letzter = von.team; b.z = Math.max(b.z, 0); }
    b.halter = null; b.imNetz = null; b.aus = null;
    const dx = ziel.x - b.x, dy = ziel.y - b.y, d = Math.max(0.5, Math.hypot(dx, dy));
    const ux = dx / d, uy = dy / d;
    if (opt.schuss) {
        const s = opt.tempo || 24;
        const vz = spVzLoesen(s, d, ziel.z === undefined ? 0.5 : ziel.z, b.z);
        b.vx = ux * s; b.vy = uy * s; b.vz = vz;
        if (b.z < 0.02 && vz < 0) b.vz = 0;
    } else if (opt.hoch) {
        const T = opt.dauer || spKlemme(d / 18 + 0.6, 0.9, 2.8);
        const l = spHochLoesen(d, ziel.z === undefined ? 0.3 : ziel.z, T, b.z);
        b.vx = ux * l.s; b.vy = uy * l.s; b.vz = l.vz;
    } else {
        const T = opt.dauer || spKlemme(d / 15 + 0.3, 0.55, 2.2);
        const v = spFlachLoesen(d, T);
        b.vx = ux * v; b.vy = uy * v; b.vz = 0; b.z = 0;
    }
    if (von) von.schussZeit = lp.t;
}

// Zuspiel zu figur Richtung (x, y): das Ziel rückt so nah, dass er es rechtzeitig erreicht.
function spZuspiel(figur, x, y, opt) {
    opt = opt || {};
    const lp = livePhysik, b = lp.ball;
    let zx = x, zy = y;
    if (figur) {
        const dx = x - figur.x, dy = y - figur.y, weg = Math.hypot(dx, dy);
        const maxWeg = (opt.maxZeit || 2.3) * 7.2;
        if (weg > maxWeg) { zx = figur.x + dx / weg * maxWeg; zy = figur.y + dy / weg * maxWeg; }
    }
    const d = Math.hypot(zx - b.x, zy - b.y);
    const hoch = opt.hoch !== undefined ? opt.hoch : d > 28;
    let T = opt.dauer || (hoch ? spKlemme(d / 18 + 0.6, 0.9, 2.8) : spKlemme(d / 15 + 0.3, 0.55, 2.2));
    if (figur) T = Math.min(3.2, Math.max(T, Math.hypot(figur.x - zx, figur.y - zy) / 7 + 0.35));
    spSpielen({ x: zx, y: zy, z: opt.z !== undefined ? opt.z : 0.3 }, { hoch, dauer: T });
    if (figur) { figur.zx = zx; figur.zy = zy; figur.sprint = Math.hypot(figur.x - zx, figur.y - zy) > 6; }
    lp.pass = figur ? { figur, x: zx, y: zy, bis: lp.t + T } : null;
    return { x: zx, y: zy, T };
}

// Torrahmen, Netz und Aus nach jedem Ballschritt
function spRahmen(b, px, py, pz) {
    if (b.imNetz !== null) {
        const tiefe = Math.abs(b.x - b.imNetz);
        if (tiefe > 1.9) { b.x = b.imNetz + (b.imNetz ? 1.9 : -1.9); b.vx *= -0.15; b.vy *= 0.4; }
        if (b.y < SP_PFOSTEN[0] + 0.1 || b.y > SP_PFOSTEN[1] - 0.1) { b.y = spKlemme(b.y, SP_PFOSTEN[0] + 0.1, SP_PFOSTEN[1] - 0.1); b.vy *= -0.3; }
        if (b.z > 2.2) { b.z = 2.2; b.vz = -Math.abs(b.vz) * 0.3; }
        return null;
    }
    for (const linie of [0, SP_L]) {
        const quer = linie === 0 ? (px > 0 && b.x <= 0) : (px < SP_L && b.x >= SP_L);
        if (!quer) continue;
        const f = (linie - px) / (b.x - px);
        const yc = py + (b.y - py) * f, zc = pz + (b.z - pz) * f;
        const pfosten = Math.min(Math.abs(yc - SP_PFOSTEN[0]), Math.abs(yc - SP_PFOSTEN[1])) < 0.17 && zc < SP_LATTE + 0.06;
        const latte = yc > SP_PFOSTEN[0] && yc < SP_PFOSTEN[1] && Math.abs(zc - SP_LATTE) < 0.17;
        if (pfosten || latte) {
            b.x = linie + (linie ? -0.15 : 0.15); b.vx *= -0.55;
            if (latte) b.vz = -Math.abs(b.vz) * 0.4 - 1;
            b.vy += (spRnd() - 0.5) * 4;
            return 'aluminium';
        }
        if (yc > SP_PFOSTEN[0] && yc < SP_PFOSTEN[1] && zc < SP_LATTE) { b.imNetz = linie; return 'tor'; }
        b.aus = 'tor';
        return 'aus';
    }
    if (b.y < -0.3 || b.y > SP_B + 0.3) { b.aus = 'seite'; return 'aus'; }
    return null;
}

// ---------- Drehbuch ----------
// Aus simulateMatchStep(): Minute für ein Ereignis im laufenden Spielzug.
function spielphysikMinute(von, bis) {
    if (bis <= von + 1) return Math.max(1, bis);
    return Math.max(1, Math.min(bis, von + 1 + Math.floor(spRnd() * (bis - von))));
}

// Übernimmt die Ereignisse eines Spielzugs (Minuten von..bis).
function spielphysikDrehbuch(liste, von, bis) {
    const lp = livePhysik;
    if (!lp || lp.match !== currentMatch) { (liste || []).forEach(spAufdecken); spAnzeigeSync(); return; }
    // Ein annulliertes oder bestätigtes Tor zieht die Zeile des Videobeweises hinter sich her.
    const ordnung = [];
    let vorab = [];
    (liste || []).forEach(ev => {
        if (ev.minute === undefined) ev.minute = bis;
        // Ankündigung ("Elfmeter für ...") erscheint, sobald der Ball auf dem Punkt liegt
        if (ev.art === 'vorab') { vorab.push(ev); return; }
        if (vorab.length) { ev.vorher = vorab; vorab = []; }
        const letztes = ordnung[ordnung.length - 1];
        if (letztes && letztes.art === 'var' && ev.art === 'tor' && !ev.annulliert) { ordnung.pop(); ev.nachher = [letztes]; ev.var = true; }
        if (ev.art === 'var' && ev.zurueck) { ordnung.push({ art: 'tor', annulliert: true, team: ev.team, minute: ev.minute, nachher: [ev], var: true }); return; }
        ordnung.push(ev);
    });
    if (vorab.length) ordnung.push(...vorab.map(v => Object.assign(v, { art: 'info' })));
    ordnung.forEach((ev, i) => { ev.reihe = i; });
    ordnung.sort((a, b) => (a.minute - b.minute) || (a.reihe - b.reihe));
    lp.queue.push(...ordnung);
    lp.ende = Math.max(lp.ende, bis);
    lp.zielBesitz = currentMatch.letzterBesitz || 50;
}

// Ereignisse aus einer Standard-Entscheidung (nach dem Reaktionsspiel): kommen sofort dran.
function spielphysikStandardDrehbuch(liste, zielung) {
    const lp = livePhysik;
    if (!lp || lp.match !== currentMatch) { (liste || []).forEach(spAufdecken); spAnzeigeSync(); return; }
    const m = currentMatch.minute;
    let vorab = [];
    liste = (liste || []).filter(ev => {
        if (ev.minute === undefined) ev.minute = m;
        if (ev.art === 'vorab') { vorab.push(ev); return false; }
        if (vorab.length) { ev.vorher = vorab; vorab = []; }
        return true;
    });
    const haupt = liste.find(ev => ev.standardSchuss) || liste[0];
    if (haupt) haupt.zielung = zielung || null;
    lp.queue.unshift(...liste);
}

function spAufdecken(ev) {
    if (!ev || ev.aufgedeckt) return;
    ev.aufgedeckt = true;
    (ev.vorher || []).forEach(spAufdecken);
    if (ev.html) {
        const log = document.getElementById('ticker-log');
        if (log) { log.innerHTML += ev.html; log.scrollTop = log.scrollHeight; }
    }
    if (ev.stand && livePhysik) { livePhysik.anzeige = ev.stand.slice(); spAnzeigeSchreiben(); }
    (ev.nachher || []).forEach(spAufdecken);
    if (ev.aktion) ev.aktion();
}

// Alles Offene sofort zeigen ("Nächste Szene", "Spiel abpfeifen", Umschalten auf die Taktiktafel).
function spielphysikAufholen() {
    const lp = livePhysik;
    if (!lp || lp.eingefroren) return;
    const offen = [];
    if (lp.szene && lp.szene.ev) offen.push(lp.szene.ev);
    offen.push(...lp.queue);
    lp.queue = []; lp.szene = null; lp.schuss = null; lp.pass = null;
    offen.forEach(spAufdecken);
    lp.uhr = Math.max(lp.uhr, currentMatch ? currentMatch.minute : lp.uhr);
    lp.ende = lp.uhr;
    spAnzeigeSync();
    if (currentMatch && currentMatch.minute < 90 && !lp.halbzeitWartet) spAnstoss(lp.besitz, true);
}

function spAnzeigeSync() {
    if (!currentMatch) return;
    if (livePhysik && livePhysik.match === currentMatch) livePhysik.anzeige = [currentMatch.homeGoals, currentMatch.awayGoals];
    const el = document.getElementById('live-score');
    if (el) el.innerText = currentMatch.homeGoals + ' : ' + currentMatch.awayGoals;
    if (typeof renderLiveMatchStats === 'function') renderLiveMatchStats();
}
function spAnzeigeSchreiben() {
    const el = document.getElementById('live-score');
    if (el && livePhysik) el.innerText = livePhysik.anzeige[0] + ' : ' + livePhysik.anzeige[1];
}

// ---------- Regie: Szenen ----------
function spText(text, sek) { livePhysik.text = text; livePhysik.textBis = livePhysik.t + sek; }

function spSchuetze(team, spielerId) {
    const lp = livePhysik;
    const feste = spielerId ? lp.f.find(f => f.aktiv && f.team === team && f.id === spielerId && !f.torwart) : null;
    if (feste) return feste;
    const feld = spFeld(team);
    const sturm = feld.filter(f => f.rolle === 'ST');
    const r = spR(team);
    return (sturm.length ? sturm : feld).sort((a, b) => (b.x - a.x) * r)[0];
}
// Mitspieler nahe einem Punkt (Angriffssicht), bevorzugt mit der Rolle
function spAnspiel(team, ax, ay, rolle, ohne) {
    const ziel = spW(team, ax, ay);
    let liste = spFeld(team).filter(f => f !== livePhysik.ball.halter && !(ohne || []).includes(f));
    const mitRolle = rolle ? liste.filter(f => f.rolle === rolle) : [];
    if (mitRolle.length) liste = mitRolle;
    const figur = spNaechster(liste, ziel) || spFeld(team)[0];
    return { figur, x: ziel.x, y: ziel.y };
}

function spSzeneBauen(ev) {
    const lp = livePhysik;
    const A = [];
    const team = ev.team === undefined || ev.team === null ? (spRnd() < lp.zielBesitz / 100 ? 0 : 1) : ev.team;
    const gegner = 1 - team;
    let art = 'kombination', ergebnis = 'vorbei';
    if (ev.art === 'tor') { art = ev.standard || SP_TOR_SZENEN[ev.stil] || 'kombination'; ergebnis = 'tor'; }
    else if (ev.art === 'chance') { const z = SP_CHANCEN_SZENEN[ev.text] || ['kombination', ['vorbei', 'gehalten', 'drueber'][Math.floor(spRnd() * 3)]]; art = z[0]; ergebnis = z[1] || 'vorbei'; }
    else if (ev.art === 'schuss') { art = spRnd() < 0.5 ? 'distanz' : 'kombination'; ergebnis = ['vorbei', 'drueber', 'gehalten', 'geblockt'][Math.floor(spRnd() * 4)]; }
    else if (ev.art === 'standard-gegner') { art = ev.standard; ergebnis = ev.ergebnis; }
    if (ev.standardSchuss) { art = ev.standard || 'freistoss'; ergebnis = ev.art === 'tor' ? 'tor' : (ev.ergebnis || 'verschossen'); }
    // Vergeben nach dem Reaktionsspiel: wohin der Ball geht, sagt die Zielung
    if (ergebnis === 'verschossen') {
        const z = ev.zielung;
        if (z && Math.abs(z.v || 0) > 0.5 && Math.abs(z.v) >= Math.abs(z.h || 0)) ergebnis = 'drueber';
        else if (z && Math.abs(z.h || 0) > 0.5) ergebnis = 'vorbei';
        else ergebnis = art === 'freistoss' && spRnd() < 0.4 ? 'mauer' : (spRnd() < 0.55 ? 'gehalten' : 'parade');
    }
    const sz = { ev, art, ergebnis, team, aktionen: A, i: 0, start: lp.t };
    const schuetze = () => spSchuetze(team, ev.spielerId);
    if (ev.standardSchuss) { spStandardAbschluss(sz, art, ergebnis); return sz; }
    if (art === 'kurz') art = 'kombination';

    // Karten: Foul, Pfiff, Karte, Freistoß
    if (ev.art === 'karte') {
        const taeter = (ev.spielerId && lp.f.find(f => f.id === ev.spielerId && f.aktiv)) || spNaechster(spFeld(ev.team), lp.ball);
        A.push(aFoul(ev.team, taeter));
        A.push(aKarte(taeter, ev.rot, ev));
        A.push(aFreistossKurz(1 - ev.team));
        return sz;
    }
    // Eigener Standard beginnt: Foul bzw. Ecke, Aufstellung, dann wartet das Spiel auf die Entscheidung
    if (ev.art === 'standard') {
        if (ev.typ === 'ecke') { A.push(aBallGewinn(team)); A.push(aPass(() => spAnspiel(team, 88, spRnd() < 0.5 ? 8 : 60, 'MIT'))); A.push(aAus('ecke', team)); }
        else {
            const opfer = () => (ev.spielerId && lp.f.find(f => f.id === ev.spielerId && f.aktiv)) || schuetze();
            A.push(aBallGewinn(team));
            A.push(aPass(() => { const o = opfer(); const p = spW(team, ev.typ === 'elfmeter' ? 92 : 82, 28 + spRnd() * 12); return { figur: o, x: p.x, y: p.y }; }));
            A.push(aFoul(gegner, null));
        }
        A.push(aAufstellen(ev.typ, team));
        A.push(aAufdecken());
        return sz;
    }
    // Gegnerischer Elfmeter mit Torwart-Reaktionsspiel: Aufstellen, dann Entscheidung
    if (ev.art === 'standard-gegner-start') {
        A.push(aBallGewinn(team));
        A.push(aPass(() => { const p = spW(team, 92, 30 + spRnd() * 8); return { figur: schuetze(), x: p.x, y: p.y }; }));
        A.push(aFoul(gegner, null));
        A.push(aAufstellen('elfmeter', team));
        A.push(aAufdecken());
        return sz;
    }
    if (art === 'fehlpass' || art === 'konter-abgelaufen' || art === 'flanke-geklaert' || art === 'ecke-geklaert' || art === 'abseits' || art === 'seitenaus' || art === 'halbfeld-freistoss' || art === 'liegen' || art === 'rudel') {
        spSzeneOhneSchuss(sz, art);
        return sz;
    }
    // Standards im Spielfluss (Tor "per Elfmeter", "mit einem direkten Freistoß", gegnerische Standards)
    if (art === 'elfmeter' || art === 'freistoss' || art === 'ecke' || art === 'flanke-standard') {
        A.push(aBallGewinn(team));
        if (art === 'ecke') { A.push(aPass(() => spAnspiel(team, 86, spRnd() < 0.5 ? 10 : 58, 'MIT'))); A.push(aAus('ecke', team)); }
        else {
            A.push(aPass(() => { const p = spW(team, art === 'elfmeter' ? 92 : 80 + spRnd() * 4, 26 + spRnd() * 16); return { figur: schuetze(), x: p.x, y: p.y }; }));
            A.push(aFoul(gegner, null));
        }
        A.push(aAufstellen(art === 'flanke-standard' ? 'freistoss' : art, team));
        spStandardAbschluss(sz, art, ergebnis);
        return sz;
    }
    // Aus dem Spiel heraus
    A.push(aBallGewinn(team));
    if (art === 'konter') {
        A.push(aPass(() => { const s = schuetze(); const p = spW(team, 74 + spRnd() * 8, 20 + spRnd() * 28); return { figur: s, x: p.x, y: p.y }; }, { hoch: true, sprint: true }));
        A.push(aDribbel(() => spW(team, 86 + spRnd() * 4, 28 + spRnd() * 12), 0.8));
    } else if (art === 'flanke' || art === 'volley') {
        const links = spRnd() < 0.5;
        A.push(aPass(() => spAnspiel(team, 58 + spRnd() * 8, links ? 14 : 54, 'MIT')));
        A.push(aPass(() => { const p = spW(team, 88 + spRnd() * 5, links ? 4 + spRnd() * 4 : 60 + spRnd() * 4); const f = spNaechster(spFeld(team).filter(x => x !== lp.ball.halter), p); return { figur: f, x: p.x, y: p.y }; }, { sprint: true }));
        A.push(aPass(() => { const s = schuetze(); const p = spW(team, 93 + spRnd() * 3, 29 + spRnd() * 10); return { figur: s, x: p.x, y: p.y, z: art === 'volley' ? 0.9 : 1.9 }; }, { hoch: true, direkt: true, sprint: true }));
    } else if (art === 'doppelpass' || art === 'abstauber') {
        A.push(aPass(() => spAnspiel(team, 66 + spRnd() * 6, 22 + spRnd() * 24, 'MIT')));
        const partner = { f: null };
        A.push(aPass(() => { const s = schuetze(); const p = spW(team, 78 + spRnd() * 4, 24 + spRnd() * 20); return { figur: s, x: p.x, y: p.y }; }));
        A.push(aPass(() => { const z = spAnspiel(team, 84, 34 + (spRnd() - 0.5) * 18, null, [schuetze()]); partner.f = z.figur; return z; }));
        A.push(aPass(() => { const s = schuetze(); const p = spW(team, 91 + spRnd() * 3, 28 + spRnd() * 12); return { figur: s, x: p.x, y: p.y }; }, { sprint: true }));
    } else if (art === 'distanz') {
        A.push(aPass(() => spAnspiel(team, 60 + spRnd() * 6, 20 + spRnd() * 28, 'MIT')));
        A.push(aPass(() => { const p = spW(team, 80 + spRnd() * 3, 24 + spRnd() * 20); const f = spNaechster(spFeld(team).filter(x => x !== lp.ball.halter && (x.rolle === 'MIT' || x.id === ev.spielerId)), p) || schuetze(); return { figur: ev.spielerId ? schuetze() : f, x: p.x, y: p.y }; }));
        A.push(aDribbel(() => spW(team, 83, 34 + (spRnd() - 0.5) * 14), 0.5));
    } else {
        A.push(aPass(() => spAnspiel(team, 56 + spRnd() * 10, 16 + spRnd() * 36, 'MIT')));
        A.push(aPass(() => { const s = schuetze(); const p = spW(team, 84 + spRnd() * 4, 22 + spRnd() * 24); return { figur: s, x: p.x, y: p.y }; }, { sprint: true }));
        A.push(aDribbel(() => spW(team, 89 + spRnd() * 3, 27 + spRnd() * 14), 0.6));
    }
    if (art === 'abstauber' && ergebnis === 'tor') {
        A.push(aSchuss(team, 'parade-abpraller'));
        A.push(aAbstauber(team, schuetze));
    }
    const tempo = art === 'distanz' ? 27 : (art === 'flanke' ? 17 : (art === 'volley' ? 23 : (ergebnis === 'harmlos' ? 12 : 23)));
    A.push(aSchuss(team, ergebnis, { tempo, flach: art === 'flach', kopf: art === 'flanke' }));
    A.push(aNachSchuss(team));
    return sz;
}

function spStandardAbschluss(sz, art, ergebnis) {
    const A = sz.aktionen, team = sz.team;
    const ev = sz.ev;
    const z = ev.zielung || null;
    if (ergebnis === 'geklaert') {
        A.push(aPass(() => { const p = spW(team, 93, 30 + spRnd() * 8); return { figur: spNaechster(spFeld(1 - team), p), x: p.x, y: p.y, z: 1.9 }; }, { hoch: true, direkt: true }));
        A.push(aKopfballWeg(1 - team));
        A.push(aAufdecken());
        A.push(aNachSchuss(team));
        return;
    }
    if (art === 'kurz') {
        A.push(aPass(() => spAnspiel(team, spA(team, livePhysik.ball.x, livePhysik.ball.y).x + 2, spA(team, livePhysik.ball.x, livePhysik.ball.y).y + 6, null, [livePhysik.standardSchuetze])));
        A.push(aDribbel(() => spW(team, 86, 30 + spRnd() * 8), 0.5));
        A.push(aSchuss(team, ergebnis, { tempo: 22, zielung: z }));
    } else if (art === 'ecke' || art === 'flanke' || art === 'flanke-standard') {
        // Flanke vom Punkt auf den Kopfballspieler
        A.push(aPass(() => {
            const s = spSchuetze(team, ev.spielerId);
            const p = spW(team, 93 + spRnd() * 3, 30 + spRnd() * 8 + (z ? z.h * 3 : 0));
            return { figur: s, x: p.x, y: p.y, z: 1.9 };
        }, { hoch: true, direkt: true, sprint: true }));
        A.push(aSchuss(team, ergebnis, { tempo: 17, kopf: true, zielung: z }));
    } else if (art === 'elfmeter') {
        A.push(aWarten(0.6));
        A.push(aSchuss(team, ergebnis, { tempo: 25, zielung: z, elfmeter: true }));
    } else {
        A.push(aWarten(0.5));
        A.push(aSchuss(team, ergebnis, { tempo: 25, zielung: z, ueberMauer: true }));
    }
    A.push(aNachSchuss(team));
}

function spSzeneOhneSchuss(sz, art) {
    const A = sz.aktionen, team = sz.team, gegner = 1 - team;
    const lp = livePhysik;
    if (art === 'fehlpass' || art === 'konter-abgelaufen') {
        A.push(aBallGewinn(team));
        A.push(aPass(() => spAnspiel(team, 64 + spRnd() * 6, 20 + spRnd() * 28, 'MIT')));
        // Der letzte Pass landet beim Verteidiger
        A.push(aPass(() => { const p = spW(team, 86 + spRnd() * 4, 28 + spRnd() * 12); const v = spNaechster(spFeld(gegner), p); return { figur: v, x: p.x, y: p.y }; }, { sprint: true }));
        A.push(aAufdecken());
        A.push(aKlaeren(gegner));
    } else if (art === 'flanke-geklaert' || art === 'ecke-geklaert') {
        A.push(aBallGewinn(team));
        if (art === 'ecke-geklaert') { A.push(aPass(() => spAnspiel(team, 86, spRnd() < 0.5 ? 10 : 58, 'MIT'))); A.push(aAus('ecke', team)); A.push(aAufstellen('ecke', team)); }
        else A.push(aPass(() => { const p = spW(team, 88, spRnd() < 0.5 ? 6 : 62); return { figur: spNaechster(spFeld(team).filter(x => x !== lp.ball.halter), p), x: p.x, y: p.y }; }, { sprint: true }));
        A.push(aPass(() => { const p = spW(team, 94, 30 + spRnd() * 8); return { figur: spNaechster(spFeld(gegner), p), x: p.x, y: p.y, z: 1.9 }; }, { hoch: true, direkt: true }));
        A.push(aKopfballWeg(gegner));
        A.push(aAufdecken());
    } else if (art === 'abseits') {
        A.push(aBallGewinn(team));
        A.push(aPass(() => { const s = spSchuetze(team); const p = spW(team, 84 + spRnd() * 4, 26 + spRnd() * 16); return { figur: s, x: p.x, y: p.y }; }, { hoch: true, sprint: true }));
        A.push(aPfiff('Abseits'));
        A.push(aAufdecken());
        A.push(aFreistossKurz(gegner));
    } else if (art === 'seitenaus') {
        A.push(aZweikampfAus());
        A.push(aAufdecken());
        A.push(aEinwurf());
    } else if (art === 'halbfeld-freistoss') {
        A.push(aFoul(gegner, null));
        A.push(aAufdecken());
        A.push(aPass(() => { const p = spW(team, 107, 20 + spRnd() * 28); return { figur: null, x: p.x, y: p.y, z: 0.2 }; }, { hoch: true }));
        A.push(aNachSchuss(team));
    } else if (art === 'liegen') {
        A.push(aFoul(gegner, null, 2.2));
        A.push(aAufdecken());
        A.push(aFreistossKurz(team));
    } else {
        A.push(aFoul(gegner, null));
        A.push(aRudel());
        A.push(aAufdecken());
        A.push(aFreistossKurz(team));
    }
}

// ---------- Aktionen ----------
// Jede Aktion: start(), fertig() -> true, wenn sie durch ist; max = Notbremse in Sekunden.
function aWarten(sek) { return { max: sek, fertig: () => false }; }
function aAufdecken() { return { start: () => { const sz = livePhysik.szene; if (sz) spAufdecken(sz.ev); }, fertig: () => true }; }
function aPfiff(text) { return { start: () => { spText(text, 1.6); if (typeof playSound === 'function') playSound('whistle'); livePhysik.ball.halter = null; }, max: 1.2, fertig: () => false }; }

function aBallGewinn(team) {
    let jaeger = null, fehlpass = false;
    // Hat der Gegner den Ball, spielt er einen Fehlpass, den unser Mann abfängt
    const abfangen = () => {
        const lp = livePhysik, b = lp.ball, h = b.halter;
        fehlpass = true;
        const dd = Math.max(0.1, spDist(h, jaeger)), lauf = Math.min(dd * 0.45, 11);
        const p = { x: jaeger.x + (h.x - jaeger.x) / dd * lauf, y: jaeger.y + (h.y - jaeger.y) / dd * lauf };
        const T = spKlemme(Math.hypot(jaeger.x - p.x, jaeger.y - p.y) / 7 + 0.35, 0.5, 2);
        spSpielen(p, { dauer: T });
        jaeger.zx = p.x; jaeger.zy = p.y;
        lp.pass = { figur: jaeger, x: p.x, y: p.y, bis: lp.t + T };
    };
    return {
        max: 3,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            if (b.halter && b.halter.team === team) return;
            // Ein Pass zum eigenen Mann ist schon unterwegs: der nimmt ihn an
            const unterwegs = !b.halter && lp.pass && lp.pass.figur && lp.pass.figur.team === team;
            jaeger = unterwegs ? lp.pass.figur : spNaechster(spFeld(team), b);
            if (!jaeger) return;
            jaeger.sprint = true;
            if (unterwegs) { jaeger.zx = lp.pass.x; jaeger.zy = lp.pass.y; }
            else if (b.halter) abfangen();
        },
        jeBild: () => {
            const lp = livePhysik, b = lp.ball;
            if (!jaeger || (b.halter && b.halter.team === team)) return;
            if (b.halter && !fehlpass) { abfangen(); return; }
            if (lp.pass && lp.pass.figur === jaeger) { jaeger.zx = lp.pass.x; jaeger.zy = lp.pass.y; return; }
            // Dem rollenden Ball entgegen: dorthin, wo er gleich ist
            const vor = Math.min(1.2, spDist(jaeger, b) / 7);
            jaeger.zx = b.x + b.vx * vor; jaeger.zy = b.y + b.vy * vor;
        },
        fertig: () => {
            const lp = livePhysik, b = lp.ball;
            if (b.halter && b.halter.team === team) return true;
            if (jaeger && spDist(jaeger, b) < 1.5 && b.z < 1.4 && !(b.halter && b.halter.team !== team && !fehlpass)) {
                if (b.halter) { b.halter.liegt = 0.6; }
                spAnnehmen(jaeger); jaeger.sprint = false;
                return true;
            }
            return false;
        },
        ende: () => {
            const lp = livePhysik, b = lp.ball;
            if (!(b.halter && b.halter.team === team) && jaeger) { jaeger.x = b.x; jaeger.y = b.y; b.z = 0; spAnnehmen(jaeger); }
            if (jaeger) jaeger.sprint = false;
            lp.besitz = team;
        }
    };
}

// Pass zu figur nach (x, y); opt.hoch = Bogen, opt.direkt = Ball wird nicht angenommen (Kopfball/Volley folgt)
function aPass(zielFn, opt) {
    opt = opt || {};
    let ziel = null, T = 1, selbst = false;
    return {
        max: 4.2,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            ziel = zielFn();
            if (!ziel) return;
            if (!b.halter && b.z < 0.5 && Math.hypot(b.vx, b.vy) < 2) b.halter = spNaechster(spFeld(lp.besitz), b);
            // Hat der Empfänger den Ball schon, läuft er selbst mit ihm dorthin
            if (ziel.figur && ziel.figur === b.halter && !opt.direkt) { selbst = true; ziel.figur.sprint = true; ziel.figur.zx = ziel.x; ziel.figur.zy = ziel.y; return; }
            // Ziel so wählen, dass der Empfänger es in gut zwei Sekunden erreicht (sonst rollt der Ball ins Leere)
            let sprint = !!opt.sprint;
            if (ziel.figur) {
                const dx = ziel.x - ziel.figur.x, dy = ziel.y - ziel.figur.y, weg = Math.hypot(dx, dy);
                if (weg > 9) sprint = true;
                const maxWeg = 2.3 * (sprint ? 7.4 : 5.8);
                if (weg > maxWeg) { ziel.x = ziel.figur.x + dx / weg * maxWeg; ziel.y = ziel.figur.y + dy / weg * maxWeg; }
            }
            const d = Math.hypot(ziel.x - b.x, ziel.y - b.y);
            T = opt.hoch ? spKlemme(d / 18 + 0.6, 0.9, 2.8) : spKlemme(d / 15 + 0.3, 0.55, 2.2);
            // Der Ball kommt an, wenn der Empfänger dort sein kann
            if (ziel.figur) {
                const lauf = Math.hypot(ziel.figur.x - ziel.x, ziel.figur.y - ziel.y) / (sprint ? 7.0 : 5.4);
                T = Math.min(3.2, Math.max(T, lauf + 0.35));
            }
            spSpielen({ x: ziel.x, y: ziel.y, z: ziel.z }, { hoch: opt.hoch, dauer: T });
            if (ziel.figur) { ziel.figur.zx = ziel.x; ziel.figur.zy = ziel.y; ziel.figur.sprint = sprint || d > 25; lp.pass = { figur: ziel.figur, x: ziel.x, y: ziel.y, direkt: !!opt.direkt, bis: lp.t + T }; }
            else lp.pass = null;
        },
        jeBild: () => { if (ziel && ziel.figur) { ziel.figur.zx = ziel.x; ziel.figur.zy = ziel.y; } },
        fertig: () => {
            const lp = livePhysik, b = lp.ball;
            if (!ziel) return true;
            if (selbst) return Math.hypot(ziel.figur.x - ziel.x, ziel.figur.y - ziel.y) < 1.5 || lp.t - lp.szene.aktionen[lp.szene.i].t0 > 1.6;
            if (!ziel.figur) return !!b.aus || (Math.hypot(b.vx, b.vy) < 0.3 && b.z < 0.05);
            const nah = Math.hypot(b.x - ziel.figur.x, b.y - ziel.figur.y) < 1.5;
            if (opt.direkt) return nah && b.z < 2.4 && b.z > (ziel.z || 0) - 0.6 || Math.hypot(b.x - ziel.x, b.y - ziel.y) < 0.8;
            if (nah && b.z < 1.5) { spAnnehmen(ziel.figur); return true; }
            return false;
        },
        ende: () => {
            const lp = livePhysik, b = lp.ball;
            if (ziel && ziel.figur) ziel.figur.sprint = false;
            if (selbst) return;
            if (ziel && ziel.figur && !opt.direkt && b.halter !== ziel.figur) { b.x = ziel.figur.x; b.y = ziel.figur.y; b.z = 0; spAnnehmen(ziel.figur); }
            if (ziel && ziel.figur && opt.direkt && Math.hypot(b.x - ziel.figur.x, b.y - ziel.figur.y) > 1.5) { ziel.figur.x = b.x - spR(ziel.figur.team) * 0.4; ziel.figur.y = b.y; }
            lp.pass = null;
        }
    };
}
function spAnnehmen(f) {
    const lp = livePhysik, b = lp.ball;
    f.sprint = false;
    b.halter = f; b.vx = b.vy = b.vz = 0; b.z = 0; b.letzter = f.team; lp.besitz = f.team; lp.pass = null;
}

function aDribbel(zielFn, sek) {
    let ziel = null;
    return {
        max: sek,
        start: () => { ziel = zielFn(); const h = livePhysik.ball.halter; if (h) h.sprint = true; },
        jeBild: () => { const h = livePhysik.ball.halter; if (h && ziel) { h.zx = ziel.x; h.zy = ziel.y; } },
        fertig: () => false,
        ende: () => { const h = livePhysik.ball.halter; if (h) h.sprint = false; }
    };
}

// Torschuss. ergebnis: tor, gehalten, harmlos, parade, parade-abpraller, vorbei, drueber, pfosten, latte, aussennetz, geblockt, mauer
function aSchuss(team, ergebnis, opt) {
    opt = opt || {};
    let t0 = 0;
    return {
        max: 4,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            t0 = lp.t;
            const tw = spTorwart(1 - team);
            const torX = spTorX(team);
            const twY = tw ? tw.y : 34;
            const seite = spRnd() < 0.5 ? -1 : 1;
            const z = opt.zielung;
            // Links/rechts aus Sicht des Schützen -> Platz (Schütze nach rechts: links = kleines y)
            const r = spR(team);
            const sicht = ys => 34 + (ys - 34) * r;
            // Elfmeter: Torwart wählt eine Ecke (aus dem Reaktionsspiel oder zufällig)
            if (opt.elfmeter && tw) {
                const twEcke = z && z.twEcke !== undefined ? z.twEcke : (spRnd() < 0.4 ? -1 : (spRnd() < 0.67 ? 1 : 0));
                tw.elfY = sicht(34 + twEcke * 2.6);
            }
            // Zielpunkt auf der Torlinie
            let y = 34, h = 0.5;
            if (ergebnis === 'tor') {
                // weg vom Torwart, in die Ecke; mit Zielung aus dem Reaktionsspiel dorthin
                if (z && z.ecke !== undefined) y = sicht(z.ecke === 0 ? 34 + (spRnd() - 0.5) * 1.2 : 34 + z.ecke * (2.3 + spRnd() * 0.9));
                else { const ecke = (twY > 34 ? -1 : 1) * (spRnd() < 0.8 ? 1 : -1); y = 34 + ecke * (2.3 + spRnd() * 0.9); }
                h = opt.flach ? 0.2 : (opt.kopf ? 0.4 + spRnd() * 0.9 : 0.25 + spRnd() * 1.6);
                if (z && z.v !== undefined) h = spKlemme(1.15 - z.v * 0.9, 0.15, 2.05);
            } else if (opt.elfmeter && tw && ['gehalten', 'harmlos', 'parade'].includes(ergebnis)) { y = tw.elfY + (spRnd() - 0.5) * 0.8; h = 0.4 + spRnd() * 0.8; }
            else if (ergebnis === 'gehalten' || ergebnis === 'harmlos') { y = twY + (spRnd() - 0.5) * 1.0; h = 0.4 + spRnd() * 0.9; }
            else if (ergebnis === 'parade' || ergebnis === 'parade-abpraller') { y = twY + seite * (1.4 + spRnd() * 0.6); h = 0.5 + spRnd() * 1.2; }
            else if (ergebnis === 'pfosten') { y = seite < 0 ? SP_PFOSTEN[0] : SP_PFOSTEN[1]; h = 0.6 + spRnd() * 1.2; }
            else if (ergebnis === 'latte') { y = 32 + spRnd() * 4; h = SP_LATTE; }
            else if (ergebnis === 'drueber') { y = 31.5 + spRnd() * 5; h = 2.9 + spRnd() * 0.8; }
            else if (ergebnis === 'aussennetz') { y = seite < 0 ? SP_PFOSTEN[0] - 0.45 : SP_PFOSTEN[1] + 0.45; h = 0.4 + spRnd() * 0.8; }
            else { y = seite < 0 ? SP_PFOSTEN[0] - 0.8 - spRnd() * 2 : SP_PFOSTEN[1] + 0.8 + spRnd() * 2; h = 0.3 + spRnd() * 1.4; }
            // Daneben nach dem Reaktionsspiel: in die Richtung, in die der Cursor daneben lag
            if (z && ergebnis !== 'tor' && z.h !== undefined && Math.abs(z.h) > 0.45 && (ergebnis === 'vorbei' || ergebnis === 'drueber')) {
                if (Math.abs(z.v || 0) > Math.abs(z.h)) { h = 2.9 + Math.abs(z.v) * 0.8; y = sicht(34 + z.h * 3); }
                else y = sicht(z.h < 0 ? SP_PFOSTEN[0] - 0.6 - Math.abs(z.h) * 1.5 : SP_PFOSTEN[1] + 0.6 + Math.abs(z.h) * 1.5);
            }
            const blocker = ergebnis === 'geblockt' || ergebnis === 'mauer' ? spNaechster(spFeld(1 - team), b) : null;
            if (blocker) { const r = spR(team); blocker.x = b.x + r * 2.2; blocker.y = b.y + (spRnd() - 0.5) * 0.6; blocker.zx = blocker.x; blocker.zy = blocker.y; }
            const tempo = ergebnis === 'harmlos' ? 13 : (opt.tempo || 23);
            spSpielen({ x: torX, y, z: h }, { schuss: true, tempo });
            lp.schuss = { team, ergebnis, zielY: y, zielZ: h, torwart: tw, blocker, t0, elfmeter: !!opt.elfmeter, abgewehrt: false };
            if (typeof playSound === 'function' && ergebnis !== 'harmlos') playSound('kick');
        },
        fertig: () => {
            const lp = livePhysik, b = lp.ball, s = lp.schuss;
            if (!s) return true;
            if (s.ergebnis === 'tor') return b.imNetz !== null && livePhysik.t - t0 > 0.15 && Math.hypot(b.vx, b.vy) < 6;
            if (s.abgewehrt && livePhysik.t - s.abgewehrt > 0.7) return true;
            if (b.halter) return true;
            if (b.aus) return true;
            return false;
        },
        ende: () => {
            const lp = livePhysik;
            // Notfall: der Ball ist nicht im Netz gelandet (sollte nicht vorkommen) - Tor trotzdem zeigen
            if (lp.schuss && lp.schuss.ergebnis === 'tor' && lp.ball.imNetz === null) spTorErkannt();
            if (lp.szene && lp.szene.ev && lp.schuss && lp.schuss.ergebnis !== 'tor' && lp.schuss.ergebnis !== 'parade-abpraller') spAufdecken(lp.szene.ev);
            lp.schuss = null;
        }
    };
}

// Abpraller nach der Parade: der Schütze staubt ab (das eigentliche Tor folgt im nächsten Schuss)
function aAbstauber(team, schuetzeFn) {
    let s = null;
    return {
        max: 2.2,
        start: () => { s = schuetzeFn(); if (s) s.sprint = true; },
        jeBild: () => { const b = livePhysik.ball; if (s) { s.zx = b.x; s.zy = b.y; } },
        fertig: () => { const b = livePhysik.ball; if (s && spDist(s, b) < 1 && b.z < 1.2) { spAnnehmen(s); return true; } return false; },
        ende: () => { const b = livePhysik.ball; if (s && b.halter !== s) { s.x = b.x - spR(team) * 0.5; s.y = b.y; b.z = 0; spAnnehmen(s); } }
    };
}

function aNachSchuss(team) {
    return {
        start: () => {
            const lp = livePhysik, b = lp.ball, sz = lp.szene;
            lp.standardHalten = false;
            if (!sz) return;
            const rest = [];
            const verteidiger = 1 - team;
            if (b.imNetz !== null) { rest.push(aJubel(team)); rest.push(aAnstossAktion(verteidiger)); }
            else if (b.halter && b.halter.torwart) { rest.push(aWarten(1.1)); rest.push(aAbwurf(b.halter.team)); }
            else if (b.aus === 'tor') rest.push(aAbstoss(b.letzter === verteidiger ? verteidiger : verteidiger));
            else if (b.aus === 'seite') rest.push(aEinwurf());
            else rest.push(aKlaeren(verteidiger));
            sz.aktionen.splice(sz.i + 1, 0, ...rest);
        },
        fertig: () => true
    };
}

function aJubel(team) {
    return {
        max: 2.6,
        start: () => {
            const lp = livePhysik;
            const eigen = team === lp.eigen;
            const sz = lp.szene;
            const annulliert = sz && sz.ev && sz.ev.annulliert;
            spText(annulliert ? 'Videobeweis …' : (eigen ? 'TOR!' : 'Gegentor'), annulliert ? 2.8 : 2.6);
            const fahne = spW(team, 103, spRnd() < 0.5 ? 2 : 66);
            lp.f.forEach(f => { if (f.team === team && f.aktiv && !f.torwart) { f.jubel = 3; f.zx = fahne.x + (spRnd() - 0.5) * 6; f.zy = fahne.y + (spRnd() - 0.5) * 6; f.sprint = true; } });
        },
        fertig: () => false,
        ende: () => {
            const lp = livePhysik;
            lp.f.forEach(f => { f.jubel = 0; f.sprint = false; });
            const sz = lp.szene;
            if (sz && sz.ev && sz.ev.annulliert) { spText('Kein Tor – Abseits', 2); spAufdecken(sz.ev); }
        }
    };
}

function aAnstossAktion(team) {
    return { max: 1.2, start: () => spAnstoss(team, false), fertig: () => false,
        ende: () => { const lp = livePhysik, st = lp.anstossFigur; if (st) { st.x = st.zx; st.y = st.zy; spAnnehmen(st); lp.ball.x = 52.5; lp.ball.y = 34; } } };
}

function aAbwurf(team) {
    return { start: () => { const z = spAnspiel(team, 30 + spRnd() * 12, 12 + spRnd() * 44, 'ABW'); spZuspiel(z.figur, z.x, z.y, { hoch: spRnd() < 0.5, z: 0.2 }); livePhysik.besitz = team; },
        max: 0.3, fertig: () => false };
}
function aAbstoss(team) {
    return {
        max: 2.4,
        start: () => {
            const lp = livePhysik, b = lp.ball, tw = spTorwart(team);
            const p = spW(team, 5.5, 34 + (spRnd() < 0.5 ? -8 : 8));
            Object.assign(b, { x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, halter: null, aus: null, imNetz: null });
            if (tw) { tw.zx = p.x - spR(team) * 1.5; tw.zy = p.y; }
            lp.abstossT = lp.t + 1.1;
            lp.besitz = team;
        },
        jeBild: () => {
            const lp = livePhysik, tw = spTorwart(team);
            if (lp.abstossT && lp.t >= lp.abstossT && tw) {
                lp.abstossT = 0;
                tw.x = lp.ball.x - spR(team) * 0.6; tw.y = lp.ball.y;
                const z = spAnspiel(team, 40 + spRnd() * 10, 14 + spRnd() * 40, 'MIT');
                spZuspiel(z.figur, z.x, z.y, { hoch: true, z: 0.4, maxZeit: 2.8 });
            }
        },
        fertig: () => false
    };
}
function aEinwurf() {
    return {
        max: 2.4,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            const team = 1 - (b.letzter || 0);
            const p = { x: spKlemme(b.x, 3, 102), y: b.y < 34 ? 0.2 : SP_B - 0.2 };
            Object.assign(b, { x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, aus: null, imNetz: null });
            const w = spNaechster(spFeld(team), p);
            if (w) { w.zx = p.x; w.zy = p.y; }
            lp.einwurf = { team, werfer: w, t: lp.t + 1.4 };
            lp.besitz = team;
        },
        jeBild: () => {
            const lp = livePhysik, e = lp.einwurf;
            if (e && lp.t >= e.t && e.werfer) {
                lp.einwurf = null;
                e.werfer.x = lp.ball.x; e.werfer.y = lp.ball.y;
                const z = spAnspiel(e.team, spA(e.team, lp.ball.x, 0).x + 4, lp.ball.y < 34 ? 10 : 58, null, [e.werfer]);
                spZuspiel(z.figur, z.x, z.y, { hoch: true, dauer: 0.9 });
            }
        },
        fertig: () => false
    };
}
// Verteidiger schlägt den Ball weit weg ins Mittelfeld
function aKlaeren(team) {
    let v = null;
    return {
        max: 3,
        start: () => { const b = livePhysik.ball; v = b.halter && b.halter.team === team ? b.halter : spNaechster(spFeld(team), b); if (v) v.sprint = true; },
        jeBild: () => { const b = livePhysik.ball; if (v && b.halter !== v) { v.zx = b.x; v.zy = b.y; } },
        fertig: () => {
            const lp = livePhysik, b = lp.ball;
            if (!v) return true;
            if (b.aus) return true;
            if ((spDist(v, b) < 1.2 && b.z < 2) || b.halter === v) {
                b.halter = v;
                const z = spAnspiel(team, 45 + spRnd() * 12, 10 + spRnd() * 48, 'MIT');
                spZuspiel(z.figur, z.x, z.y, { hoch: true, z: 0.4, maxZeit: 2.8 });
                lp.besitz = team; v.sprint = false;
                return true;
            }
            return false;
        },
        ende: () => { if (v) v.sprint = false; }
    };
}
function aKopfballWeg(team) {
    return {
        max: 1.2,
        fertig: () => {
            const lp = livePhysik, b = lp.ball;
            const v = spNaechster(spFeld(team), b);
            if (v && spDist(v, b) < 1.4) {
                b.halter = null;
                const z = spAnspiel(team, 40 + spRnd() * 10, 10 + spRnd() * 48, 'MIT');
                spZuspiel(z.figur, z.x, z.y, { hoch: true, z: 0.4, maxZeit: 2.8 });
                lp.besitz = team;
                return true;
            }
            return false;
        }
    };
}
// Ball geht über die Grundlinie (für die Ecke)
function aAus(art, team) {
    return {
        max: 1.4,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            const ziel = spW(team, 107, spA(team, b.x, b.y).y < 34 ? 6 : 62);
            spSpielen({ x: ziel.x, y: ziel.y, z: 0.1 }, { dauer: 0.9 });
            b.letzter = 1 - team;
        },
        fertig: () => !!livePhysik.ball.aus
    };
}
function aZweikampfAus() {
    return {
        max: 2.2,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            const h = b.halter || spNaechster(spAktive(), b);
            const nahe = b.y < 34 ? -2 : SP_B + 2;
            const v = spNaechster(spFeld(1 - (h ? h.team : 0)), b);
            if (v) { v.zx = b.x; v.zy = b.y; v.sprint = true; }
            spSpielen({ x: b.x + (spRnd() - 0.5) * 8, y: nahe }, { dauer: 1 });
            b.letzter = v ? v.team : 0;
        },
        fertig: () => !!livePhysik.ball.aus
    };
}
function aAufstellen(typ, team) {
    return {
        max: 2.2,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            const gegner = 1 - team;
            const r = spR(team);
            let spot;
            if (typ === 'elfmeter') spot = spW(team, 94, 34);
            else if (typ === 'ecke') spot = spW(team, 104.6, spA(team, b.x, b.y).y < 34 ? 0.4 : 67.6);
            else spot = { x: spKlemme(b.x, 3, 102), y: spKlemme(b.y, 3, 65) };
            Object.assign(b, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0, vz: 0, halter: null, aus: null, imNetz: null });
            lp.besitz = team; lp.standardOrt = spot;
            const schuetze = spSchuetze(team, lp.szene && lp.szene.ev ? lp.szene.ev.schuetzeId : null);
            const angreifer = spFeld(team), abwehr = spFeld(gegner);
            const tw = spTorwart(gegner);
            if (tw) { const t = spW(gegner, 0.5, 34); tw.zx = t.x; tw.zy = t.y; }
            // Ausführender an den Ball
            const ausf = typ === 'ecke' ? spNaechster(angreifer.filter(f => f.rolle !== 'ABW' || angreifer.length < 4), spot) : schuetze;
            lp.standardSchuetze = ausf;
            angreifer.forEach((f, i) => {
                if (f === ausf) { f.zx = spot.x - r * 0.8; f.zy = spot.y; return; }
                let p;
                if (typ === 'elfmeter') p = spW(team, 83 + (i % 2) * 1.5, 16 + i * 4.2);
                else if (typ === 'ecke' || spA(team, spot.x, spot.y).x > 70) p = spW(team, 88 + (i % 4) * 2, 26 + (i * 2.3) % 16);
                else p = spW(team, spA(team, spot.x, spot.y).x + 12 + (i % 3) * 3, 18 + i * 3);
                f.zx = p.x; f.zy = p.y;
            });
            abwehr.forEach((f, i) => {
                let p;
                if (typ === 'elfmeter') p = spW(team, 82.5 + (i % 2) * 1.5, 14 + i * 4.2);
                else if (typ === 'freistoss' && i < 4) {
                    // Mauer 9,15 m vor dem Ball Richtung Tor
                    const torX = spTorX(team), dx = torX - spot.x, dy = 34 - spot.y, d = Math.hypot(dx, dy);
                    p = { x: spot.x + dx / d * 9.15 - dy / d * (i - 1.5) * 0.7, y: spot.y + dy / d * 9.15 + dx / d * (i - 1.5) * 0.7 };
                } else p = spW(team, 90 + (i % 3) * 2.5, 27 + (i * 2.1) % 14);
                f.zx = p.x; f.zy = p.y;
            });
            lp.standardHalten = true;
        },
        fertig: () => {
            const lp = livePhysik;
            return lp.f.every(f => !f.aktiv || Math.hypot(f.zx - f.x, f.zy - f.y) < 2.5);
        },
        ende: () => {
            const lp = livePhysik;
            if (lp.standardSchuetze) { lp.standardSchuetze.x = lp.standardSchuetze.zx; lp.standardSchuetze.y = lp.standardSchuetze.zy; lp.ball.halter = null; }
            if (lp.szene && lp.szene.ev) (lp.szene.ev.vorher || []).forEach(spAufdecken);
        }
    };
}

function aFoul(taeterTeam, taeter, liegen) {
    let t = taeter, opfer = null;
    return {
        max: 2.5,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            opfer = b.halter && b.halter.team !== taeterTeam ? b.halter : spNaechster(spFeld(1 - taeterTeam), b);
            if (!t) t = spNaechster(spFeld(taeterTeam), opfer || b);
            if (t) t.sprint = true;
        },
        jeBild: () => { if (t && opfer) { t.zx = opfer.x; t.zy = opfer.y; } },
        fertig: () => t && opfer && spDist(t, opfer) < 1.3,
        ende: () => {
            const lp = livePhysik, b = lp.ball;
            if (opfer) { opfer.liegt = liegen || 1.4; b.x = opfer.x; b.y = opfer.y; }
            if (t) t.sprint = false;
            b.halter = null; b.vx = b.vy = b.vz = 0; b.z = 0;
            lp.schiri.zx = b.x + 3; lp.schiri.zy = b.y - 2; lp.schiriBis = lp.t + 3;
            if (typeof playSound === 'function') playSound('whistle');
            spText('Foul', 1.2);
        }
    };
}
function aKarte(figur, rot, ev) {
    return {
        max: 2.6,
        start: () => {
            const lp = livePhysik;
            lp.schiriBis = lp.t + 3;
            if (figur) { lp.schiri.zx = figur.x + 1.5; lp.schiri.zy = figur.y; figur.karte = rot ? 2 : 1; figur.karteBis = lp.t + 2.4; }
            spAufdecken(ev);
            spText(rot ? 'Rote Karte' : 'Gelbe Karte', 1.8);
        },
        fertig: () => false,
        ende: () => { if (figur) { figur.karte = 0; if (rot) { figur.aktiv = false; if (livePhysik.ball.halter === figur) livePhysik.ball.halter = null; } } }
    };
}
function aFreistossKurz(team) {
    return {
        max: 1.8,
        start: () => {
            const lp = livePhysik, b = lp.ball;
            const f = spNaechster(spFeld(team), b);
            if (f) { f.zx = b.x - spR(team) * 0.5; f.zy = b.y; }
            lp.freistossKurz = { team, f, t: lp.t + 1.2 };
            lp.besitz = team;
        },
        jeBild: () => {
            const lp = livePhysik, k = lp.freistossKurz;
            if (k && lp.t >= k.t && k.f) {
                lp.freistossKurz = null;
                k.f.x = lp.ball.x - spR(team) * 0.5; k.f.y = lp.ball.y;
                const z = spAnspiel(team, spA(team, lp.ball.x, lp.ball.y).x - 6, spA(team, lp.ball.x, lp.ball.y).y + (spRnd() - 0.5) * 16, null, [k.f]);
                spZuspiel(z.figur, z.x, z.y, { hoch: false });
            }
        },
        fertig: () => false
    };
}
function aRudel() {
    return {
        max: 2.2,
        start: () => {
            const b = livePhysik.ball;
            spAktive().filter(f => !f.torwart).sort((a, c) => spDist(a, b) - spDist(c, b)).slice(0, 6).forEach((f, i) => { f.zx = b.x + Math.cos(i) * 1.6; f.zy = b.y + Math.sin(i) * 1.6; });
            livePhysik.schiri.zx = b.x; livePhysik.schiri.zy = b.y + 1; livePhysik.schiriBis = livePhysik.t + 3;
        },
        fertig: () => false
    };
}

// ---------- Tor ----------
function spTorErkannt() {
    const lp = livePhysik, sz = lp.szene;
    if (!sz || !sz.ev || sz.torGezeigt) return;
    sz.torGezeigt = true;
    if (sz.ev.annulliert) { spText('Tor?', 1.2); return; }   // Videobeweis folgt im Jubel
    spAufdecken(sz.ev);
}

// ---------- Takt ----------
// Ein Bild: dt in Sekunden (echte Zeit). Aus live3dFrame().
function spielphysikTakt(dtEcht) {
    const lp = livePhysik;
    if (lp && lp.eingefroren) return;
    const m = typeof currentMatch !== 'undefined' ? currentMatch : null;
    if (!lp || !m || lp.match !== m || !spielphysikAktiv()) return;
    if (typeof liveTickerPaused !== 'undefined' && liveTickerPaused && !lp.abpfiff) return;
    const tempo = SP_TEMPI[spTempo()];
    lp.rest += Math.min(0.1, dtEcht) * tempo.physik;
    let schritte = 0;
    while (lp.rest >= SP_DT && schritte < 40) { lp.rest -= SP_DT; schritte++; spSchritt(SP_DT, tempo); }
}

function spSchritt(dt, tempo) {
    const lp = livePhysik, m = lp.match;
    lp.t += dt;
    if (lp.f.some(f => f.team === lp.eigen && f.aktiv && f.id && !lineup.includes(f.id)) || (lp.t % 1 < dt)) spKaderAbgleich();
    // Halbzeit: weiter erst, wenn die Ansprache gewählt ist
    if (lp.halbzeitWartet && !m.awaitingHalftimeTalk) { lp.halbzeitWartet = false; lp.zweite = true; spAnstoss(1, false); }
    // Halbzeit oder Abpfiff ohne Drehbuch ("Nächste Szene"): Seiten wechseln bzw. stehen bleiben
    if (!lp.zweite && !lp.halbzeitWartet && m.halftimeShown && !m.awaitingHalftimeTalk && lp.uhr >= 45 && !lp.szene && !lp.queue.some(e => e.art === 'halbzeit')) { lp.zweite = true; spAnstoss(1, true); }
    if (!lp.abpfiff && m.minute >= 90 && !lp.szene && !lp.queue.length && lp.uhr >= 90) { lp.abpfiff = true; spText('Abpfiff', 99); }
    const entscheidung = (m.awaitingHalftimeTalk || m.awaitingSetPiece) && !lp.szene && !lp.queue.length;
    const wartet = lp.halbzeitWartet || entscheidung || lp.abpfiff;

    // Uhr: läuft bis zur Minute des nächsten offenen Ereignisses bzw. bis zum Ende des Spielzugs
    if (!wartet) {
        const naechstes = lp.szene ? lp.szene.ev : lp.queue[0];
        const deckel = naechstes ? naechstes.minute : lp.ende;
        lp.uhr = Math.min(deckel, lp.uhr + dt / tempo.sek / tempo.physik);
        if (lp.szene && lp.szene.ev && lp.szene.ev.aufgedeckt && !lp.queue.length) lp.uhr = Math.min(lp.ende, lp.uhr);
    }
    spMinuteZeigen();

    // Nächste Szene starten
    if (!lp.szene && lp.queue.length && !lp.halbzeitWartet) {
        const ev = lp.queue[0];
        if (spOhneSzene(ev)) {
            if (lp.uhr >= ev.minute - 0.01) { lp.queue.shift(); spOhneSzeneAufdecken(ev); }
        } else {
            const vorlauf = (SP_SZENEN_DAUER[ev.art] || 6) / tempo.sek / tempo.physik;
            if (lp.uhr >= ev.minute - vorlauf || ev.sofort || ev.standardSchuss || ev.ausAufstellung) {
                lp.queue.shift();
                lp.standardHalten = !!ev.standardSchuss && lp.standardHalten;
                lp.szene = spSzeneBauen(ev);
            }
        }
    }
    if (lp.szene) spSzeneLauf();
    else if (!wartet && !lp.standardHalten) spFueller();

    // Physik
    spBallLauf(dt);
    spFigurenLauf(dt);

    // Spielzug durch: Anzeige angleichen, nächsten Spielzug holen
    if (!lp.szene && !lp.queue.length && !wartet && lp.uhr >= lp.ende - 0.001) {
        if (!lp.syncNach || lp.syncNach !== lp.ende) { lp.syncNach = lp.ende; spAnzeigeSync(); }
        if (m.minute < 90 && !m.awaitingHalftimeTalk && !m.awaitingSetPiece && typeof simulateMatchStep === 'function') {
            simulateMatchStep(true);
        }
    }
}

function spOhneSzene(ev) { return ['info', 'halbzeit', 'abpfiff', 'cotrainer'].includes(ev.art) || (ev.art === 'standard-gegner' && !ev.standard); }
function spOhneSzeneAufdecken(ev) {
    const lp = livePhysik;
    if (ev.art === 'halbzeit') { lp.halbzeitWartet = true; lp.uhr = 45; spText('Halbzeit', 3); }
    if (ev.art === 'abpfiff') { lp.abpfiff = true; lp.uhr = 90; spText('Abpfiff', 99); lp.ball.halter = null; }
    spMinuteZeigen();
    spAufdecken(ev);
    if (ev.art === 'abpfiff') spAnzeigeSync();
}

function spMinuteZeigen() {
    const lp = livePhysik;
    const min = Math.max(1, Math.floor(lp.uhr));
    if (min === lp.angezeigteMinute) return;
    lp.angezeigteMinute = min;
    const el = document.getElementById('live-minute');
    if (el) el.innerText = min + '. Minute';
}

function spSzeneLauf() {
    const lp = livePhysik, sz = lp.szene;
    const a = sz.aktionen[sz.i];
    if (!a) { spSzeneEnde(); return; }
    if (!a.laeuft) { a.laeuft = true; a.t0 = lp.t; if (a.start) a.start(); }
    if (a.jeBild) a.jeBild();
    const fertig = a.fertig ? a.fertig() : true;
    if (fertig || lp.t - a.t0 > (a.max || 5)) {
        if (a.ende) a.ende();
        sz.i++;
    }
    // Notbremse für die ganze Szene
    if (lp.t - sz.start > 30) spSzeneEnde();
}
function spSzeneEnde() {
    const lp = livePhysik, sz = lp.szene;
    lp.szene = null;
    lp.schuss = null;
    // Nach dem Aufstellen eines Standards bleiben alle stehen, bis entschieden ist
    lp.standardHalten = !!(sz && sz.ev && (sz.ev.art === 'standard' || sz.ev.art === 'standard-gegner-start'));
    if (sz && sz.ev && !sz.ev.aufgedeckt) spAufdecken(sz.ev);
    lp.f.forEach(f => { f.sprint = false; f.jubel = 0; });
    if (lp.ball.aus) { lp.ball.aus = null; const h = spNaechster(spFeld(1 - (lp.ball.letzter || 0)), lp.ball); if (h) { lp.ball.x = spKlemme(lp.ball.x, 1, 104); lp.ball.y = spKlemme(lp.ball.y, 1, 67); spAnnehmen(h); } }
    if (lp.ball.imNetz !== null) spAnstoss(1 - (sz ? sz.team : 0), true);
    lp.naechsterPass = lp.t + 0.8;
}

// Ballbesitz zwischen den Szenen: Passspiel im Mittelfeld, Ballverluste nach dem Ballbesitz-Anteil aus der Spiellogik
function spFueller() {
    const lp = livePhysik, b = lp.ball;
    if (b.aus) {
        b.aus = null; b.imNetz = null;
        const team = 1 - (b.letzter || 0);
        b.x = spKlemme(b.x, 1, 104); b.y = spKlemme(b.y, 0.5, 67.5); b.z = 0; b.vx = b.vy = b.vz = 0;
        const h = spNaechster(spFeld(team), b);
        if (h) { h.x = b.x; h.y = b.y; spAnnehmen(h); }
        lp.naechsterPass = lp.t + 1;
        return;
    }
    if (b.halter) {
        const h = b.halter, r = spR(h.team);
        const hA = spA(h.team, h.x, h.y);
        if (!h.torwart) {
            const ziel = spW(h.team, Math.min(hA.x + 3, 72), hA.y);
            h.zx = ziel.x; h.zy = ziel.y;
        }
        if (lp.t < lp.naechsterPass) return;
        const anteil = h.team === 0 ? lp.zielBesitz / 100 : 1 - lp.zielBesitz / 100;
        const mit = spFeld(h.team).filter(f => f !== h);
        // nach vorn, aber nicht in den Strafraum (Abschlüsse gehören den echten Chancen)
        const kandidaten = mit.filter(f => spA(f.team, f.x, f.y).x < 78).sort((a, c) => {
            const wa = (a.x - h.x) * r - Math.abs(a.y - h.y) * 0.4 - Math.abs(spDist(a, h) - 16) * 0.5;
            const wc = (c.x - h.x) * r - Math.abs(c.y - h.y) * 0.4 - Math.abs(spDist(c, h) - 16) * 0.5;
            return wc - wa;
        });
        let ziel = kandidaten[Math.floor(spRnd() * Math.min(4, kandidaten.length))] || mit[0];
        if (!ziel) return;
        let zx = ziel.x + r * 2, zy = ziel.y;
        // Ballverlust: der Pass landet beim Gegner
        if (spRnd() < 0.42 * (1 - anteil) + 0.04) {
            const mitte = { x: (h.x + zx) / 2, y: (h.y + zy) / 2 };
            const dieb = spNaechster(spFeld(1 - h.team), mitte);
            if (dieb) { ziel = dieb; zx = mitte.x + (dieb.x - mitte.x) * 0.3; zy = mitte.y + (dieb.y - mitte.y) * 0.3; }
        }
        spZuspiel(ziel, zx, zy);
        lp.naechsterPass = lp.t + 1.6 + spRnd() * 1.6;
    } else if (!lp.pass && Math.hypot(b.vx, b.vy) < 3 && b.z < 0.6) {
        // freier Ball: der Nächste holt ihn
        const f = spNaechster(spFeld(), b);
        if (f) { f.zx = b.x; f.zy = b.y; if (spDist(f, b) < 0.9) { spAnnehmen(f); lp.naechsterPass = lp.t + 1 + spRnd(); } }
    }
}

function spBallLauf(dt) {
    const lp = livePhysik, b = lp.ball;
    if (b.halter) {
        const h = b.halter;
        const v = Math.hypot(h.vx, h.vy);
        const ux = v > 0.3 ? h.vx / v : spR(h.team), uy = v > 0.3 ? h.vy / v : 0;
        b.x += (h.x + ux * 0.55 - b.x) * Math.min(1, dt * 14);
        b.y += (h.y + uy * 0.55 - b.y) * Math.min(1, dt * 14);
        b.z = 0; b.vx = h.vx; b.vy = h.vy; b.vz = 0;
        return;
    }
    const px = b.x, py = b.y, pz = b.z;
    spBallSchritt(b, dt);
    // Weit im Aus bleibt der Ball liegen (Bande)
    if (b.aus && (b.x < -4 || b.x > SP_L + 4 || b.y < -4 || b.y > SP_B + 4)) { b.x = spKlemme(b.x, -4, SP_L + 4); b.y = spKlemme(b.y, -4, SP_B + 4); b.vx = b.vy = b.vz = 0; b.z = 0; }
    const treffer = spRahmen(b, px, py, pz);
    if (treffer === 'tor') spTorErkannt();
    if (treffer === 'aluminium') { spText(b.z > 2 ? 'Latte!' : 'Pfosten!', 1.2); if (lp.schuss) lp.schuss.abgewehrt = lp.t; }
    if (treffer === 'aus' && lp.schuss && !lp.schuss.abgewehrt) lp.schuss.abgewehrt = lp.t;
    // Torwart und Blocker beim Schuss
    const s = lp.schuss;
    if (s && !s.abgewehrt) {
        const tw = s.torwart;
        if (s.blocker && spDist(s.blocker, b) < 0.8 && b.z < 1.9) {
            b.vx *= -0.35; b.vy = b.vy * 0.4 + (spRnd() - 0.5) * 8; b.vz = Math.abs(b.vz) * 0.4 + 2;
            s.abgewehrt = lp.t; spText('Geblockt', 1);
        } else if (tw && ['gehalten', 'harmlos', 'parade', 'parade-abpraller'].includes(s.ergebnis) && Math.hypot(b.x - tw.x, b.y - tw.y) < 1.15 && b.z < 2.4) {
            if (s.ergebnis === 'gehalten' || s.ergebnis === 'harmlos') { b.halter = tw; b.vx = b.vy = b.vz = 0; b.z = 0; lp.besitz = tw.team; spText('Gehalten!', 1.2); }
            else {
                const r = spR(s.team);
                b.vx = -r * (3 + spRnd() * 3); b.vy = (b.y < 34 ? -1 : 1) * (4 + spRnd() * 3); b.vz = 3 + spRnd() * 2;
                if (s.ergebnis === 'parade' && spRnd() < 0.5) { b.vx = r * 2; b.vz = 6; }
                spText('Parade!', 1.2);
            }
            s.abgewehrt = lp.t;
        }
    }
    // Pass angekommen?
    const p = lp.pass;
    if (p && p.figur && !p.direkt && !lp.szene) {
        if (Math.hypot(b.x - p.figur.x, b.y - p.figur.y) < 1.2 && b.z < 1.3) spAnnehmen(p.figur);
        else if (lp.t > p.bis + 1.5) lp.pass = null;
    }
}

function spFigurenLauf(dt) {
    const lp = livePhysik, b = lp.ball;
    const aktive = spAktive();
    // Wer presst? Der Nächste des Teams ohne Ball
    const presser = [0, 1].map(team => team === lp.besitz ? null : spNaechster(spFeld(team), b));
    const sz = lp.szene;
    aktive.forEach(f => {
        const gesteuert = (sz && (f.sprint || f.jubel > 0)) || lp.standardHalten || (lp.pass && lp.pass.figur === f) || b.halter === f || f.liegt > 0;
        if (!gesteuert && !lp.abpfiff) {
            const g = spGrundziel(f);
            f.zx = g.x; f.zy = g.y;
            if (f === presser[f.team] && !lp.halbzeitWartet) { f.zx = b.x - spR(f.team) * 1.2; f.zy = b.y; }
        }
        // Torwart beim Schuss: Hechtsprung
        const s = lp.schuss;
        if (f.torwart && s && s.torwart === f && !s.abgewehrt) {
            const reaktion = lp.t - s.t0 > 0.12;
            let zielY = s.zielY;
            if (s.elfmeter && f.elfY !== undefined) zielY = f.elfY;
            else if (s.ergebnis === 'tor') zielY = f.y + Math.sign(s.zielY - f.y) * Math.max(0, Math.min(Math.abs(s.zielY - f.y) - 1.6, 1.4));
            else if (!['gehalten', 'harmlos', 'parade', 'parade-abpraller'].includes(s.ergebnis)) zielY = f.y + (s.zielY - f.y) * 0.3;
            if (reaktion) { f.zy = zielY; f.zx = f.x; if (Math.abs(zielY - f.y) > 0.8 && !f.hecht) f.hecht = zielY > f.y ? 1 : -1; f.sprint = true; }
        }
        if (f.hecht) { f.hechtZeit += dt; if (f.hechtZeit > 1.3) { f.hecht = 0; f.hechtZeit = 0; if (f.torwart) f.sprint = false; } }
        spBewegen(f, dt);
        if (f.jubel > 0) f.jubel = Math.max(0.01, f.jubel - dt);
    });
    // Abstand halten
    for (let i = 0; i < aktive.length; i++) {
        for (let j = i + 1; j < aktive.length; j++) {
            const a = aktive[i], c = aktive[j];
            if (a.sprint || c.sprint) continue;   // Zweikampf und Laufduell: dürfen nah heran
            const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
            if (d > 0.001 && d < 0.9) {
                const k = (0.9 - d) * 0.5;
                if (b.halter !== a && !a.torwart) { a.x -= dx / d * k; a.y -= dy / d * k; }
                if (b.halter !== c && !c.torwart) { c.x += dx / d * k; c.y += dy / d * k; }
            }
        }
    }
    // Schiedsrichter läuft mit dem Spiel
    const sr = lp.schiri;
    if (!(lp.schiriBis > lp.t)) { sr.zx = b.x - 8; sr.zy = spKlemme(b.y + 10, 6, 62); }
    const dx = sr.zx - sr.x, dy = sr.zy - sr.y, d = Math.hypot(dx, dy);
    if (d > 0.3) { const s = Math.min(6, d * 1.5) * dt; sr.x += dx / d * s; sr.y += dy / d * s; sr.phase += s * 2; }
}

function spGrundziel(f) {
    const lp = livePhysik, b = lp.ball;
    const imBesitz = lp.besitz === f.team;
    const bA = spA(f.team, b.x, b.y);
    let ax, ay;
    if (f.torwart) {
        ax = 1.2 + spKlemme((45 - bA.x) / 45, 0, 1) * 4;
        ay = 34 + (bA.y - 34) * 0.16;
    } else {
        ax = f.fx * SP_L + (bA.x - 52.5) * 0.55 + (imBesitz ? 7 : -5);
        ay = f.fy * SP_B + (bA.y - 34) * 0.3;
        if (imBesitz) ay = 34 + (ay - 34) * 1.1;
        ax = spKlemme(ax, 6, 99); ay = spKlemme(ay, 2, 66);
    }
    return spW(f.team, ax, ay);
}

function spBewegen(f, dt) {
    if (f.liegt > 0) { f.liegt -= dt; f.vx *= 0.8; f.vy *= 0.8; f.x += f.vx * dt; f.y += f.vy * dt; return; }
    const dx = f.zx - f.x, dy = f.zy - f.y, d = Math.hypot(dx, dy);
    const vmax = f.hecht ? 7 : (f.sprint ? 8.2 : (f.torwart ? 5 : 6.2));
    let wx = 0, wy = 0;
    if (d > 0.05) { const s = Math.min(vmax, d * 2.4); wx = dx / d * s; wy = dy / d * s; }
    const ax = wx - f.vx, ay = wy - f.vy, a = Math.hypot(ax, ay), amax = (f.hecht ? 30 : 10) * dt;
    if (a > amax) { f.vx += ax / a * amax; f.vy += ay / a * amax; } else { f.vx = wx; f.vy = wy; }
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.x = spKlemme(f.x, -2, SP_L + 2); f.y = spKlemme(f.y, -2, SP_B + 2);
    f.phase += Math.hypot(f.vx, f.vy) * dt * 1.9;
}

// ---------- Start und Ende ----------
// Aus startLiveTickerAutoplay(): übernimmt den Ablauf, wenn die Physik läuft.
function spielphysikStart() {
    if (!spielphysikAktiv() || typeof currentMatch === 'undefined' || !currentMatch) { livePhysik = null; return false; }
    spNeu(currentMatch);
    spTempoKnoepfe();
    return true;
}
function spielphysikLaeuft() { return !!livePhysik && typeof currentMatch !== 'undefined' && livePhysik.match === currentMatch && spielphysikAktiv(); }
// Nach dem Abpfiff (endMatchSimulation): nichts läuft mehr auf dem Platz. Ball und Spieler bleiben
// stehen, die Bildschleife der 3D-Ansicht endet (live3dFrame prüft lp.eingefroren).
function spielphysikEnde() {
    const lp = livePhysik;
    if (!lp) return;
    lp.queue = []; lp.szene = null; lp.schuss = null; lp.pass = null; lp.standardHalten = false;
    lp.abpfiff = true; lp.uhr = 90; lp.ende = 90; lp.halbzeitWartet = false;
    const b = lp.ball;
    Object.assign(b, { halter: null, vx: 0, vy: 0, vz: 0, z: 0, aus: null });
    lp.f.forEach(f => { f.vx = 0; f.vy = 0; f.sprint = false; f.jubel = 0; f.hecht = 0; f.liegt = 0; f.zx = f.x; f.zy = f.y; });
    lp.eingefroren = true;
    spAnzeigeSync();
    spMinuteZeigen();
}
// Beim Umschalten auf die Taktiktafel: alles Offene zeigen, dann wieder der alte Ticker-Takt
function spielphysikBeenden() {
    if (!livePhysik) return;
    spielphysikAufholen();
    livePhysik = null;
}
