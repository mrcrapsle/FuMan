// Stadionansicht (Phase 26.31): das eigene Stadion als Canvas-Bild mit Perspektive, oben auf der Stadionseite.
// Gezeichnet wird nur, was im Spiel steht: Tribünen wachsen mit den Plätzen je Block (stadium.blocks), Imbiss,
// Fanshop und Toiletten stehen je Ausbaustufe hinter der Tribüne, die Ränge füllen sich nach den echten
// Zuschauerzahlen der Heimspiele (game.attendanceHistory), Flutlicht, Dach, Anzeigetafeln, Rasenzustand,
// Wetter, Baustellen (game.stadiumConstructionQueue) und gebaute Anlagen (stadium.upgrades) sind sichtbar.
// Wischen dreht, zwei Finger oder das Mausrad zoomen, ein Tipp auf einen Block öffnet dessen Ausbau.
// Dazu Rundflug (nach einem fertigen Ausbau automatisch, Marker game.stadionRundflug), Risiko-Ebene für
// Ausschreitungen und eine Vorher/Nachher-Ansicht für den nächsten Rangausbau.
// Nur Ansicht: verändert keine Spielwerte. Läuft nur, solange die Stadionseite offen ist; ohne Bewegung
// (Rundflug, Wetter, Fahnen, Kran) wird nur bei Änderungen neu gezeichnet. Illustration: feste Farben erlaubt.

const STADION3D_KEY = 'anstoss_fm13_stadion3d';
const STADION3D_KAMERAS = [
    { name: 'Luftbild', yaw: 0.6, pitch: 0.86, dist: 2.0, tx: 0, ty: 0 },
    { name: 'Haupttribüne', yaw: -Math.PI / 2, pitch: 0.44, dist: 0.95, tx: 14, ty: 0 },
    { name: 'Hinter dem Tor', yaw: 0, pitch: 0.32, dist: 0.85, tx: 0, ty: 30 }
];
// Kamera im eigenen Fenster "Vereinsgelände" (stadionGelaendeOeffnen)
const STADION3D_GELAENDE_KAMERA = { yaw: 0.75, pitch: 0.95, dist: 3.9, tx: 10, ty: 0 };
const STADION3D_LICHT = [
    { id: 'tag', name: '☀️ Tag' },
    { id: 'abend', name: '🌆 Abend' },
    { id: 'nacht', name: '🌙 Nacht' }
];
// Lage der Blöcke: Seite (N/S hinter den Toren, W Haupttribüne, E Gegengerade), Rang und Abschnitt der Seite
const STADION3D_BLOECKE = [
    { key: 'west', seite: 'W', rang: 0, von: -54, bis: 54 },
    { key: 'gegen', seite: 'E', rang: 0, von: -54, bis: 30 },
    { key: 'familie', seite: 'E', rang: 0, von: 30, bis: 54 },
    { key: 'haupt', seite: 'N', rang: 0, von: -38, bis: 16 },
    { key: 'gaeste', seite: 'N', rang: 0, von: 16, bis: 38 },
    { key: 'kurve', seite: 'S', rang: 0, von: -38, bis: 38 },
    { key: 'hauptNord', seite: 'N', rang: 1, von: -38, bis: 38 },
    { key: 'suedOber', seite: 'S', rang: 1, von: -38, bis: 38 }
];
// Anteil an der Auslastung je Block (Kurve zuerst voll, Gästeblock zuletzt); die Summe wird auf die echte Zahl gebracht
const STADION3D_GEWICHT = { kurve: 1.3, familie: 1.05, haupt: 1, west: 1, gegen: 1, hauptNord: 0.85, suedOber: 0.85, vipLogen: 1.15, presse: 0.75, gaeste: 0.6 };
// Gebaute Anlagen außerhalb der Tribünen: Lage (Seite, Abschnitt), Größe, Dachfarbe, Symbol
const STADION3D_ANLAGEN = {
    stadion_museum: { seite: 'W', t: -34, b: 14, l: 10, h: 7, farbe: '#b08d57', icon: '🏛️' },
    flagship_store: { seite: 'W', t: 34, b: 12, l: 9, h: 6, farbe: '#d84315', icon: '🛍️' },
    pressezentrum: { seite: 'W', t: 0, b: 10, l: 8, h: 8, farbe: '#546e7a', icon: '🎙️' },
    medizinzentrum: { seite: 'E', t: -30, b: 10, l: 8, h: 5, farbe: '#e0e0e0', icon: '🏥' },
    business_center: { seite: 'E', t: 26, b: 12, l: 12, h: 14, farbe: '#455a64', icon: '🏢' },
    familienbereich: { seite: 'S', t: 26, b: 10, l: 10, h: 3, farbe: '#ffb300', icon: '🎠' },
    public_viewing: { seite: 'S', t: -24, b: 16, l: 8, h: 7, farbe: '#263238', icon: '📽️' },
    ladestationen: { seite: 'N', t: -22, b: 18, l: 10, h: 1.2, farbe: '#78909c', icon: '🔌' },
    bahnanbindung: { seite: 'N', t: 24, b: 16, l: 8, h: 5, farbe: '#5d4037', icon: '🚉' }
};
// Vereinsgelände (Campus, Jugendakademie, Immobilien): Lage als Rechteck an einer Seite (t entlang der Seite,
// d vom Außenrand der Tribünen) oder in einer Ecke, Form und Höhe je Ausbaustufe
const STADION3D_CAMPUS = {
    trainingground: { seite: 'E', t: [-36, 36], d: [34, 80], form: 'platz', icon: '⚽', ziel: 'screen-campus' },
    internat: { seite: 'E', t: [44, 64], d: [40, 56], form: 'haus', farbe: '#8d6e63', icon: '🏫', h: l => 6 + l * 2, ziel: 'screen-campus' },
    museum: { seite: 'W', t: [-40, -22], d: [34, 48], form: 'haus', farbe: '#c9b38a', icon: '🏛️', h: l => 5 + l, ziel: 'screen-campus' },
    megastore: { seite: 'W', t: [-12, 12], d: [34, 50], form: 'haus', farbe: '#e65100', icon: '🛍️', h: l => 6 + l * 1.5, ziel: 'screen-campus' },
    fankneipe: { seite: 'W', t: [22, 34], d: [34, 44], form: 'haus', farbe: '#6d4c41', icon: '🍺', h: l => 4 + l * 0.6, ziel: 'screen-campus' },
    foodtrucks: { seite: 'W', t: [42, 72], d: [34, 40], form: 'reihe', icon: '🌭', ziel: 'screen-campus' },
    turnstiles: { seite: 'W', t: [-14, 14], d: [4, 6], form: 'tore', ziel: 'screen-campus' },
    parkhaus: { seite: 'N', t: [-52, -20], d: [34, 58], form: 'haus', farbe: '#9e9e9e', icon: '🅿️', h: l => l * 3.2, deck: true, ziel: 'screen-campus' },
    securityAcademy: { seite: 'N', t: [20, 44], d: [34, 48], form: 'haus', farbe: '#37474f', icon: '🛡️', h: l => 5 + l, ziel: 'screen-campus' },
    hotel: { seite: 'S', t: [-44, -24], d: [34, 50], form: 'haus', farbe: '#b0bec5', icon: '🏨', h: l => 12 + l * 7, fenster: true, ziel: 'screen-campus' },
    reha: { seite: 'S', t: [20, 46], d: [34, 50], form: 'haus', farbe: '#e3f2fd', icon: '🩺', h: l => 5 + l * 1.5, ziel: 'screen-campus' }
};
// Jugendakademie: kleiner Platz mit Vereinsheim, immer da (Stufe ab 1)
const STADION3D_JUGEND = { seite: 'E', t: [-82, -46], d: [36, 60], heim: { t: [-82, -72], d: [62, 70] } };
// Immobilien (Paket): in den Ecken und auf dem äußeren Ring; ecke [x, y] in Vielfachen von X/Y (siehe stadion3dGelaendePlan)
const STADION3D_IMMO = {
    parkplatz: { ecke: [-1, -1], groesse: [40, 30], form: 'parkplatz', icon: '🚗' },
    buerokomplex: { ecke: [1, -1], groesse: [16, 16], form: 'haus', farbe: '#546e7a', icon: '🏢', h: l => 20 + l * 12, fenster: true },
    wohnanlage: { ecke: [-1, 1], groesse: [36, 30], form: 'bloecke', farbe: '#d7ccc8', icon: '🏘️', h: () => 12 },
    einkaufszentrum: { ecke: [1, 1], groesse: [40, 26], form: 'haus', farbe: '#ffcc80', icon: '🛒', h: l => 8 + l * 2 },
    hotelbeteiligung: { seite: 'S', t: [58, 74], d: [40, 54], form: 'haus', farbe: '#90a4ae', icon: '🏨', h: l => 18 + l * 8, fenster: true },
    gewerbepark: { seite: 'N', t: [56, 92], d: [36, 56], form: 'bloecke', farbe: '#a1887f', icon: '🏭', h: () => 7 }
};
const STADION3D_GEGNER_FARBEN = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#212121', '#00acc1', '#c62828'];
const STADION3D_KLEIDUNG = ['#37474f', '#eceff1', '#455a64', '#1565c0', '#6d4c41', '#212121', '#90a4ae', '#c62828'];

let stadionAnsicht = null;   // Zustand der Ansicht, nicht im Spielstand

function stadion3dAn() { return safeLocalGet(STADION3D_KEY) !== '0'; }
function stadion3dReduziert() {
    const m = document.documentElement.getAttribute('data-motion');
    if (m === 'normal') return false;
    if (m === 'reduziert') return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function stadion3dHash(text) { let h = 2166136261; for (const c of String(text || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
function stadion3dZufall(a, b, c) { return (stadion3dHash(a + ':' + b + ':' + c) % 10007) / 10007; }
function stadion3dRgb(hex) { const h = String(hex || '#888888').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function stadion3dMisch(hex, f, ziel) {
    const a = stadion3dRgb(hex), b = stadion3dRgb(ziel || '#000000');
    const k = i => Math.max(0, Math.min(255, Math.round(a[i] + (b[i] - a[i]) * f))).toString(16).padStart(2, '0');
    return '#' + k(0) + k(1) + k(2);
}
function stadion3dAbstand(a, b) { const x = stadion3dRgb(a), y = stadion3dRgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); }

function stadion3dNeu() {
    const k = STADION3D_KAMERAS[0];
    stadionAnsicht = {
        kamera: 0, yaw: k.yaw, pitch: k.pitch, dist: k.dist, tx: k.tx, ty: k.ty, zoom: 1, ziel: null,
        licht: 'tag', spielIdx: null, risiko: false, flug: null, vorschau: null, auswahl: null,
        zeit: 0, laeuft: false, frames: 0, letzterFrame: 0, groesse: null, zeiger: new Map(),
        treffer: [], szene: {}, rundflugText: ''
    };
}

// ---------- Daten aus dem Spiel ----------
function stadion3dFarben(gegnerName) {
    const eigene = game.clubCrestColor || '#8b5cf6';
    const zweite = game.clubCrestAwayColor && stadion3dAbstand(game.clubCrestAwayColor, eigene) > 90 ? game.clubCrestAwayColor : '#f5f5f5';
    let gegner = STADION3D_GEGNER_FARBEN[stadion3dHash(gegnerName) % STADION3D_GEGNER_FARBEN.length];
    if (stadion3dAbstand(gegner, eigene) < 120) gegner = STADION3D_GEGNER_FARBEN.find(f => stadion3dAbstand(f, eigene) >= 120) || '#f5f5f5';
    return { eigene, zweite, gegner };
}

// Heimspiele zum Blättern: diese Saison, sonst die letzten der Vorsaison
function stadion3dHeimspiele() {
    const alle = (game.attendanceHistory || []).filter(e => e && typeof e.attendance === 'number');
    const jetzt = alle.filter(e => e.season === game.season);
    return jetzt.length ? jetzt : alle.slice(-17);
}

// Das gewählte Heimspiel oder, ohne Heimspiel, die Prognose für das nächste
function stadion3dSpiel() {
    const liste = stadion3dHeimspiele();
    if (liste.length) {
        let i = stadionAnsicht && stadionAnsicht.spielIdx !== null ? stadionAnsicht.spielIdx : liste.length - 1;
        i = Math.max(0, Math.min(liste.length - 1, i));
        const e = liste[i];
        return { prognose: false, index: i, anzahl: liste.length, zuschauer: e.attendance, kapazitaet: e.capacity || stadium.total || 1, gegner: e.opponent || '', season: e.season, matchday: e.matchday };
    }
    let zuschauer = 0;
    try { if (typeof calculateMatchAttendanceDetails === 'function') zuschauer = calculateMatchAttendanceDetails(1, 1, 1).zuschauer; } catch (e) { zuschauer = 0; }
    const naechstes = typeof ausschreitungNaechstesSpiel === 'function' ? ausschreitungNaechstesSpiel() : null;
    return { prognose: true, index: 0, anzahl: 0, zuschauer, kapazitaet: stadium.total || 1, gegner: naechstes && naechstes.heim ? naechstes.gegner : '' };
}

// Auslastung je Block: Gewichte, gekappt bei voll, Summe gleich der echten Zuschauerzahl
function stadion3dFuellung(spiel) {
    const bloecke = stadium.blocks || {};
    const keys = Object.keys(bloecke);
    const kapGesamt = keys.reduce((s, k) => s + (bloecke[k].cap || 0), 0) || 1;
    const quote = Math.max(0, Math.min(1, spiel.zuschauer / Math.max(1, spiel.kapazitaet)));
    const ziel = quote * kapGesamt;
    const f = {};
    keys.forEach(k => { f[k] = Math.min(1, quote * (STADION3D_GEWICHT[k] || 1)); });
    for (let runde = 0; runde < 4; runde++) {
        const summe = keys.reduce((s, k) => s + f[k] * (bloecke[k].cap || 0), 0);
        if (summe <= 0) break;
        const faktor = ziel / summe;
        keys.forEach(k => { f[k] = Math.min(1, f[k] * faktor); });
    }
    return f;
}

function stadion3dChoreo() {
    const naechstes = typeof ausschreitungNaechstesSpiel === 'function' ? ausschreitungNaechstesSpiel() : null;
    if (naechstes && naechstes.heim && typeof isDerbyOpponent === 'function' && isDerbyOpponent(naechstes.gegner)) return 'Derby-Choreo';
    if (game.serien && game.serien.aktuell && game.serien.aktuell.sieg >= 3) return 'Sieges-Choreo';
    return '';
}

function stadion3dRisiko() {
    if (typeof getAusschreitungsLage !== 'function' || typeof ausschreitungNaechstesSpiel !== 'function') return null;
    const spiel = ausschreitungNaechstesSpiel();
    if (!spiel) return { spiel: null, chance: 0, je: {} };
    const lage = getAusschreitungsLage(spiel);
    const r = lage.chance || 0;
    const kurve = spiel.heim ? r : 0;
    const gaeste = !spiel.heim ? r : (lage.derby ? r * 0.8 : r * 0.4);
    return { spiel, chance: r, je: { kurve, suedOber: kurve * 0.6, gaeste, west: r * 0.2, vipLogen: r * 0.1, presse: r * 0.1, gegen: r * 0.3, familie: r * 0.15, haupt: r * 0.3, hauptNord: r * 0.25 } };
}
function stadion3dRisikoFarbe(r) { return r <= 0 ? '#4caf50' : (r < 0.03 ? '#9ccc65' : (r < 0.08 ? '#ffb300' : '#e53935')); }

// Laufende Bauten mit Fortschritt
function stadion3dBaustellen() {
    return (game.stadiumConstructionQueue || []).filter(p => ['blockExpand', 'blockInfra', 'specialInstall', 'capacityProject', 'stadiumUpgrade', 'campusBuilding', 'youthAcademyLvl', 'youthCapacity', 'realEstate'].includes(p.type))
        .map(p => ({ p, anteil: Math.max(0, Math.min(1, 1 - (p.daysLeft || 0) / Math.max(1, p.totalDays || 1))) }));
}

// ---------- Aufbau der Tribünen ----------
const STADION3D_SEITEN = {
    N: { o: [0, -1], tv: [1, 0], a0: 59.5 },
    S: { o: [0, 1], tv: [1, 0], a0: 59.5 },
    W: { o: [-1, 0], tv: [0, 1], a0: 40 },
    E: { o: [1, 0], tv: [0, 1], a0: 40 }
};
function stadion3dWelt(seite, t, d, z) {
    const s = STADION3D_SEITEN[seite];
    return [t * s.tv[0] + d * s.o[0], t * s.tv[1] + d * s.o[1], z];
}

// Bauart nach Größe: klein mit Laufbahn und nur überdachter Haupttribüne, mittel als reines Fußballstadion mit
// Dach über Haupt- und Gegentribüne, groß mit geschlossenen Ecken und Dach rundum, riesig mit Dachring auch über den Ecken
const STADION3D_STUFEN = {
    klein: { name: 'Sportplatz mit Laufbahn', laufbahn: true, daecher: ['W'], ecken: false, ring: false },
    mittel: { name: 'Fußballstadion', laufbahn: false, daecher: ['W', 'E'], ecken: false, ring: false },
    gross: { name: 'Arena', laufbahn: false, daecher: ['W', 'E', 'N', 'S'], ecken: true, ring: false },
    riesig: { name: 'Großarena', laufbahn: false, daecher: ['W', 'E', 'N', 'S'], ecken: true, ring: true }
};
function stadion3dStufe(kapazitaet) {
    const k = kapazitaet || 0;
    return k < 20000 ? 'klein' : (k < 35000 ? 'mittel' : (k < 60000 ? 'gross' : 'riesig'));
}
// Laufbahn (400 m): Geraden bei x = ±36,5 von y = -42,2 bis 42,2, Kurven mit 36,5 m Radius, acht Bahnen (9,8 m)
const STADION3D_BAHN = { r: 36.5, gerade: 42.2, breite: 9.8 };

// Ränge eines Blocks aus den Plätzen: 0,5 m je Sitz, 0,8 m je Reihe
function stadion3dReihen(cap, laenge) { return Math.max(2, Math.min(80, Math.ceil((cap || 0) / Math.max(1, laenge / 0.5)))); }

function stadion3dLayout() {
    const bl = stadium.blocks || {};
    const v = stadionAnsicht && stadionAnsicht.vorschau;
    const bau = {};
    stadion3dBaustellen().forEach(x => { if (x.p.type === 'blockExpand' && x.p.params) bau[x.p.params.blockKey] = { plus: x.p.params.seats || 0, anteil: x.anteil }; });
    const bonusHalb = Math.round((stadium.bonusCapacity || 0) / 2);
    const stufe = stadion3dStufe(stadium.total), bauart = STADION3D_STUFEN[stufe];
    // Mit Laufbahn stehen die Tribünen weiter weg, hinter den Toren hinter der Kurve
    const a0 = bauart.laufbahn
        ? { N: STADION3D_BAHN.gerade + STADION3D_BAHN.r + STADION3D_BAHN.breite + 3, S: STADION3D_BAHN.gerade + STADION3D_BAHN.r + STADION3D_BAHN.breite + 3, W: STADION3D_BAHN.r + STADION3D_BAHN.breite + 2.5, E: STADION3D_BAHN.r + STADION3D_BAHN.breite + 2.5 }
        : { N: STADION3D_SEITEN.N.a0, S: STADION3D_SEITEN.S.a0, W: STADION3D_SEITEN.W.a0, E: STADION3D_SEITEN.E.a0 };
    const segmente = [];
    const tiefeUnten = { N: 0, S: 0, W: 0, E: 0 }, hoeheUnten = { N: 0, S: 0, W: 0, E: 0 };
    const kapEff = (key, cap) => {
        let c = cap;
        if (key === 'haupt' || key === 'kurve') c += bonusHalb;
        return c;
    };
    const baue = (def, a, h0, zF, reiheT, reiheH) => {
        const b = bl[def.key];
        if (!b) return null;
        const laenge = def.bis - def.von;
        const cap = kapEff(def.key, b.cap || 0);
        let ziel = cap, geist = null;
        if (v && v.blockKey === def.key) { ziel = cap + Math.round((b.addSeats || 0) * v.mix); geist = 'vorschau'; }
        else if (bau[def.key]) { ziel = cap + bau[def.key].plus; geist = 'bau'; }
        const reihen = stadion3dReihen(cap, laenge), reihenZiel = Math.max(reihen, stadion3dReihen(ziel, laenge));
        const seg = { key: def.key, seite: def.seite, rang: def.rang, von: def.von, bis: def.bis, a, h0, zF,
            tiefe: reihen * reiheT, hub: reihen * reiheH, tiefeZiel: reihenZiel * reiheT, hubZiel: reihenZiel * reiheH,
            reihen, geist: reihenZiel > reihen ? geist : null, bauAnteil: bau[def.key] ? bau[def.key].anteil : 0 };
        segmente.push(seg);
        return seg;
    };
    STADION3D_BLOECKE.filter(d => d.rang === 0).forEach(d => {
        const seg = baue(d, a0[d.seite], 1.2, 0, 0.8, 0.42);
        if (seg) { tiefeUnten[d.seite] = Math.max(tiefeUnten[d.seite], seg.tiefeZiel); hoeheUnten[d.seite] = Math.max(hoeheUnten[d.seite], seg.h0 + seg.hubZiel); }
    });
    STADION3D_BLOECKE.filter(d => d.rang === 1).forEach(d => {
        const a = a0[d.seite] + tiefeUnten[d.seite] + 1.5;
        const h0 = hoeheUnten[d.seite] + 4;
        baue(d, a, h0, h0 - 1.6, 0.85, 0.55);
    });
    // Haupttribüne: Logen als Glasband, Presse daneben
    const vip = bl.vipLogen, presse = bl.presse;
    const aW = a0.W + tiefeUnten.W + 1, hW = hoeheUnten.W + 1.5;
    const kaesten = [];
    if (vip) {
        const l = Math.max(16, Math.min(80, 14 + (vip.cap || 0) * 0.16));
        kaesten.push({ key: 'vipLogen', seite: 'W', von: -l / 2, bis: l / 2, a: aW, z0: hW, tiefe: 5, hoehe: 4.5 });
    }
    if (presse) {
        const l = Math.max(8, Math.min(30, 6 + (presse.cap || 0) * 0.06));
        const start = -(vip ? Math.max(16, Math.min(80, 14 + (vip.cap || 0) * 0.16)) / 2 : 0) - 1 - l;
        kaesten.push({ key: 'presse', seite: 'W', von: start, bis: start + l, a: aW, z0: hW, tiefe: 4, hoehe: 3.5 });
    }
    // Äußerer Rand und Höhe je Seite
    const aussen = { N: 0, S: 0, W: 0, E: 0 }, oben = { N: 0, S: 0, W: 0, E: 0 };
    segmente.forEach(s => { aussen[s.seite] = Math.max(aussen[s.seite], s.a + s.tiefeZiel); oben[s.seite] = Math.max(oben[s.seite], s.h0 + s.hubZiel); });
    kaesten.forEach(k => { aussen[k.seite] = Math.max(aussen[k.seite], k.a + k.tiefe); oben[k.seite] = Math.max(oben[k.seite], k.z0 + k.hoehe); });
    const radius = Math.max(aussen.N, aussen.S, aussen.W + 20, aussen.E + 20) + 30;
    return { segmente, kaesten, aussen, oben, radius, stufe, bauart, a0, tiefeUnten, hoeheUnten };
}

// ---------- Kamera ----------
function stadion3dProjektion(W, H, layout) {
    const a = stadionAnsicht;
    const D = layout.radius * a.dist / a.zoom;
    const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
    const C = [a.tx + D * cp * Math.sin(a.yaw), a.ty - D * cp * Math.cos(a.yaw), D * sp];
    const f = [-cp * Math.sin(a.yaw), cp * Math.cos(a.yaw), -sp];
    let r = [f[1], -f[0], 0];
    const rl = Math.hypot(r[0], r[1]) || 1; r = [r[0] / rl, r[1] / rl, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const fokus = Math.max(W, H * 1.4) * 0.95;
    return { C, f, r, u, fokus, W, H, cx: W / 2, cy: H * 0.54 };
}
function stadion3dPunkt(P, x, y, z) {
    const dx = x - P.C[0], dy = y - P.C[1], dz = z - P.C[2];
    const tz = dx * P.f[0] + dy * P.f[1] + dz * P.f[2];
    if (tz < 1) return null;
    const tx = dx * P.r[0] + dy * P.r[1] + dz * P.r[2];
    const ty = dx * P.u[0] + dy * P.u[1] + dz * P.u[2];
    return { x: P.cx + P.fokus * tx / tz, y: P.cy - P.fokus * ty / tz, s: P.fokus / tz, tz };
}
// Fläche mit Schnitt an der Kamera-Ebene (große Bodenflächen reichen hinter die Kamera)
function stadion3dPolyGeklippt(P, punkte) {
    const kam = punkte.map(([x, y, z]) => {
        const dx = x - P.C[0], dy = y - P.C[1], dz = z - P.C[2];
        return [dx * P.r[0] + dy * P.r[1] + dz * P.r[2], dx * P.u[0] + dy * P.u[1] + dz * P.u[2], dx * P.f[0] + dy * P.f[1] + dz * P.f[2]];
    });
    const nah = 1.5, aus = [];
    for (let i = 0; i < kam.length; i++) {
        const a = kam[i], b = kam[(i + 1) % kam.length];
        if (a[2] >= nah) aus.push(a);
        if ((a[2] >= nah) !== (b[2] >= nah)) { const t = (nah - a[2]) / (b[2] - a[2]); aus.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, nah]); }
    }
    return aus.length >= 3 ? aus.map(([tx, ty, tz]) => ({ x: P.cx + P.fokus * tx / tz, y: P.cy - P.fokus * ty / tz })) : null;
}
function stadion3dAbstandC(P, p) { return Math.hypot(p[0] - P.C[0], p[1] - P.C[1], p[2] - P.C[2]); }

// ---------- Zeichnen ----------
// Flächen werden gesammelt und von hinten nach vorn gezeichnet; jede Fläche kennt ihre Normale (nur sichtbare Seiten)
function stadion3dFlaeche(liste, P, punkte, normale, stil) {
    const m = [0, 0, 0];
    punkte.forEach(p => { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; });
    m[0] /= punkte.length; m[1] /= punkte.length; m[2] /= punkte.length;
    if (normale && (normale[0] * (P.C[0] - m[0]) + normale[1] * (P.C[1] - m[1]) + normale[2] * (P.C[2] - m[2])) <= 0) return;
    const pr = punkte.map(p => stadion3dPunkt(P, p[0], p[1], p[2]));
    if (pr.some(p => !p)) return;
    liste.push({ abstand: stadion3dAbstandC(P, m), pr, stil, mitte: m });
}

// Prisma eines Rangs: Sitzschräge, Vorderwand, Rückwand, Seiten, bei Oberrängen die Unterseite
function stadion3dRang(liste, P, s, von, bis, a, tiefe, h0, hub, zF, stil) {
    const w = (t, d, z) => stadion3dWelt(s, t, d, z);
    const S = STADION3D_SEITEN[s];
    const o = [S.o[0], S.o[1], 0], tv = [S.tv[0], S.tv[1], 0];
    const k = hub / Math.max(0.1, tiefe);
    const schraege = [w(von, a, h0), w(bis, a, h0), w(bis, a + tiefe, h0 + hub), w(von, a + tiefe, h0 + hub)];
    stadion3dFlaeche(liste, P, schraege, [-o[0] * k, -o[1] * k, 1], Object.assign({ art: 'schraege', t: [von, bis], d: [a, a + tiefe], h: [h0, h0 + hub] }, stil));
    // Wände in der Fassadenfarbe (stil.wand), nicht in der Sitzfarbe
    const wand = (ton, extra) => Object.assign({}, stil, { art: 'wand', ton, farbe: stil.wand || stil.farbe }, extra || {});
    if (!stil.ohneFront) stadion3dFlaeche(liste, P, [w(von, a, zF), w(bis, a, zF), w(bis, a, h0), w(von, a, h0)], [-o[0], -o[1], 0], wand(0.8));
    stadion3dFlaeche(liste, P, [w(von, a + tiefe, 0), w(bis, a + tiefe, 0), w(bis, a + tiefe, h0 + hub), w(von, a + tiefe, h0 + hub)], o, wand(0.62, { fassade: !stil.geist }));
    const seite = t => [w(t, a, zF), w(t, a, h0), w(t, a + tiefe, h0 + hub), w(t, a + tiefe, 0)];
    stadion3dFlaeche(liste, P, seite(von), [-tv[0], -tv[1], 0], wand(0.75));
    stadion3dFlaeche(liste, P, seite(bis), [tv[0], tv[1], 0], wand(0.75));
    if (zF > 0.5) {
        const q = zF / Math.max(0.1, tiefe);
        stadion3dFlaeche(liste, P, [w(von, a, zF), w(bis, a, zF), w(bis, a + tiefe, 0), w(von, a + tiefe, 0)], [-o[0] * q, -o[1] * q, -1], wand(0.4));
    }
}

// Quader (Gebäude, Buden, Logen): vier Seiten und Dach
function stadion3dQuader(liste, P, x0, y0, x1, y1, z0, z1, stil) {
    const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
    stadion3dFlaeche(liste, P, [[lx, ly, z1], [hx, ly, z1], [hx, hy, z1], [lx, hy, z1]], [0, 0, 1], Object.assign({}, stil, { art: stil.art || 'dach', ton: 1 }));
    stadion3dFlaeche(liste, P, [[lx, ly, z0], [hx, ly, z0], [hx, ly, z1], [lx, ly, z1]], [0, -1, 0], Object.assign({}, stil, { art: stil.artWand || 'wand', ton: 0.72 }));
    stadion3dFlaeche(liste, P, [[lx, hy, z0], [hx, hy, z0], [hx, hy, z1], [lx, hy, z1]], [0, 1, 0], Object.assign({}, stil, { art: stil.artWand || 'wand', ton: 0.6 }));
    stadion3dFlaeche(liste, P, [[lx, ly, z0], [lx, hy, z0], [lx, hy, z1], [lx, ly, z1]], [-1, 0, 0], Object.assign({}, stil, { art: stil.artWand || 'wand', ton: 0.82 }));
    stadion3dFlaeche(liste, P, [[hx, ly, z0], [hx, hy, z0], [hx, hy, z1], [hx, ly, z1]], [1, 0, 0], Object.assign({}, stil, { art: stil.artWand || 'wand', ton: 0.66 }));
}
function stadion3dQuaderSeite(liste, P, seite, t0, t1, d0, d1, z0, z1, stil) {
    const p0 = stadion3dWelt(seite, t0, d0, 0), p1 = stadion3dWelt(seite, t1, d1, 0);
    stadion3dQuader(liste, P, p0[0], p0[1], p1[0], p1[1], z0, z1, stil);
}

// Linien-Objekte (Masten, Kräne, Fahnen) mit eigener Zeichenfunktion
function stadion3dObjekt(liste, P, ort, zeichne) { liste.push({ abstand: stadion3dAbstandC(P, ort), objekt: zeichne }); }

function stadion3dPfad(ctx, pr) { ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y); for (let i = 1; i < pr.length; i++) ctx.lineTo(pr[i].x, pr[i].y); ctx.closePath(); }

function stadion3dLichtFaktor() {
    const l = stadionAnsicht.licht;
    return l === 'nacht' ? (stadium.flutlicht ? 0.62 : 0.3) : (l === 'abend' ? 0.78 : 1);
}

function stadion3dWetter() {
    const w = typeof currentWeather !== 'undefined' && currentWeather ? currentWeather : null;
    if (!w) return '';
    if (w.isStorm) return 'sturm';
    if (w.name === 'Regen') return 'regen';
    if (w.name === 'Schnee') return 'schnee';
    if (w.name === 'Bewölkt') return 'wolken';
    return '';
}

function stadion3dHimmel(ctx, W, H) {
    const l = stadionAnsicht.licht, wetter = stadion3dWetter();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (l === 'nacht') { g.addColorStop(0, '#05070f'); g.addColorStop(1, '#16213a'); }
    else if (l === 'abend') { g.addColorStop(0, '#2c3e70'); g.addColorStop(0.6, '#c0607a'); g.addColorStop(1, '#f6a65a'); }
    else if (wetter === 'regen' || wetter === 'sturm' || wetter === 'wolken') { g.addColorStop(0, '#7b8794'); g.addColorStop(1, '#c4ccd4'); }
    else if (wetter === 'schnee') { g.addColorStop(0, '#aab6c2'); g.addColorStop(1, '#e8eef3'); }
    else { g.addColorStop(0, '#4f9ee8'); g.addColorStop(1, '#bfe3ff'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (l === 'nacht') {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 40; i++) { const x = stadion3dZufall('stern', i, 1) * W, y = stadion3dZufall('stern', i, 2) * H * 0.45; ctx.globalAlpha = 0.3 + stadion3dZufall('stern', i, 3) * 0.6; ctx.fillRect(x, y, 1.2, 1.2); }
        ctx.globalAlpha = 1;
    }
}

function stadion3dBoden(ctx, P, layout) {
    const R = layout.radius * 3, f = stadion3dLichtFaktor();
    const ecken = stadion3dPolyGeklippt(P, [[-R, -R, 0], [R, -R, 0], [R, R, 0], [-R, R, 0]]);
    const winter = stadion3dWetter() === 'schnee';
    if (ecken) { ctx.fillStyle = stadion3dMisch(winter ? '#dfe6ea' : '#55704a', 1 - f, '#000000'); stadion3dPfad(ctx, ecken); ctx.fill(); }
    // Vorplatz rund ums Stadion
    const vx = layout.aussen.W + 14, ex = layout.aussen.E + 14, ny = layout.aussen.N + 12, sy = layout.aussen.S + 12;
    const platz = stadion3dPolyGeklippt(P, [[-vx, -ny, 0], [ex, -ny, 0], [ex, sy, 0], [-vx, sy, 0]]);
    if (platz) { ctx.fillStyle = stadion3dMisch('#9e9e9e', 1 - f * 0.95, '#000000'); stadion3dPfad(ctx, platz); ctx.fill(); }
}

// ---------- Vereinsgelände ----------
function stadion3dRechteck(seite, t, d, aussen) {
    const a = stadion3dWelt(seite, t[0], aussen + d[0], 0), b = stadion3dWelt(seite, t[1], aussen + d[1], 0);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

// Alle Gebäude des Geländes mit Stufe, Lage und laufendem Bau. Ohne Stufe erscheint nur eine Baustelle.
function stadion3dGelaendePlan(layout) {
    const plan = [];
    const bau = (typ, key) => (game.stadiumConstructionQueue || []).find(q => q.type === typ && (!key || (q.params && q.params.key === key)));
    const anteil = q => q ? Math.max(0, Math.min(1, 1 - (q.daysLeft || 0) / Math.max(1, q.totalDays || 1))) : 0;
    if (typeof campusBuildings !== 'undefined') {
        Object.keys(STADION3D_CAMPUS).forEach(key => {
            const b = campusBuildings[key], def = STADION3D_CAMPUS[key];
            if (!b) return;
            const q = bau('campusBuilding', key);
            if (!b.lvl && !q) return;
            plan.push(Object.assign({ id: 'campus:' + key, key, name: b.name, lvl: b.lvl || 0, max: b.max, desc: b.desc, bau: q, anteil: anteil(q),
                rect: stadion3dRechteck(def.seite, def.t, def.d, layout.aussen[def.seite]) }, def));
        });
    }
    const jq = bau('youthAcademyLvl') || bau('youthCapacity');
    const J = STADION3D_JUGEND;
    plan.push({ id: 'jugend', key: 'jugend', name: 'Jugendakademie', lvl: game.youthAcademyLvl || 1, max: typeof YOUTH_ACADEMY_MAX_LVL !== 'undefined' ? YOUTH_ACADEMY_MAX_LVL : 5,
        desc: 'Nachwuchsplatz und Vereinsheim; die Stufe bestimmt, wie stark neue Talente starten.', form: 'jugend', icon: '🎓', ziel: 'screen-youth', bau: jq, anteil: anteil(jq),
        rect: stadion3dRechteck(J.seite, J.t, J.d, layout.aussen[J.seite]), heim: stadion3dRechteck(J.seite, J.heim.t, J.heim.d, layout.aussen[J.seite]) });
    if (typeof realEstatePortfolio !== 'undefined') {
        const X = Math.max(layout.aussen.W, layout.aussen.E) + 50, Y = Math.max(layout.aussen.N, layout.aussen.S) + 40;
        Object.keys(STADION3D_IMMO).forEach(key => {
            const r = realEstatePortfolio[key], def = STADION3D_IMMO[key];
            if (!r) return;
            const q = bau('realEstate', key);
            if (!(r.owned && r.lvl) && !q) return;
            let rect;
            if (def.ecke) {
                const cx = def.ecke[0] * X, cy = def.ecke[1] * Y, [gx, gy] = def.groesse;
                rect = [cx - gx / 2, cy - gy / 2, cx + gx / 2, cy + gy / 2];
            } else rect = stadion3dRechteck(def.seite, def.t, def.d, layout.aussen[def.seite]);
            plan.push(Object.assign({ id: 'immo:' + key, key, name: r.name, lvl: r.owned ? (r.lvl || 0) : 0, max: r.max, desc: r.desc, bau: q, anteil: anteil(q), rect, ziel: 'screen-real-estate' }, def));
        });
    }
    return plan;
}

function stadion3dFlach(ctx, P, x0, y0, x1, y1, farbe, z) {
    const pr = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => stadion3dPunkt(P, p[0], p[1], z || 0.05));
    if (pr.some(p => !p)) return null;
    ctx.fillStyle = farbe; stadion3dPfad(ctx, pr); ctx.fill();
    return pr;
}

// Kleiner Fußballplatz (Trainingsgelände, Jugend): Rasen, Linien, Mittelkreis
function stadion3dKleinfeld(ctx, P, r, f) {
    const [x0, y0, x1, y1] = r;
    const pr = stadion3dFlach(ctx, P, x0, y0, x1, y1, stadion3dMisch('#3a8f3e', 1 - f, '#000000'));
    if (!pr) return null;
    const lang = (x1 - x0) >= (y1 - y0);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * f})`; ctx.lineWidth = Math.max(0.6, P.fokus / 900);
    const m = 2;
    const rand = [[x0 + m, y0 + m], [x1 - m, y0 + m], [x1 - m, y1 - m], [x0 + m, y1 - m], [x0 + m, y0 + m]].map(p => stadion3dPunkt(P, p[0], p[1], 0.08));
    if (rand.every(Boolean)) { ctx.beginPath(); ctx.moveTo(rand[0].x, rand[0].y); rand.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const mitte = lang ? [[mx, y0 + m], [mx, y1 - m]] : [[x0 + m, my], [x1 - m, my]];
    const ml = mitte.map(p => stadion3dPunkt(P, p[0], p[1], 0.08));
    if (ml.every(Boolean)) { ctx.beginPath(); ctx.moveTo(ml[0].x, ml[0].y); ctx.lineTo(ml[1].x, ml[1].y); ctx.stroke(); }
    const rk = Math.min(x1 - x0, y1 - y0) * 0.14, kreis = [];
    for (let i = 0; i <= 20; i++) { const w = i / 20 * Math.PI * 2; const q = stadion3dPunkt(P, mx + Math.cos(w) * rk, my + Math.sin(w) * rk, 0.08); if (q) kreis.push(q); }
    if (kreis.length > 3) { ctx.beginPath(); ctx.moveTo(kreis[0].x, kreis[0].y); kreis.slice(1).forEach(q => ctx.lineTo(q.x, q.y)); ctx.stroke(); }
    return pr;
}

// Flache Teile des Geländes vor allen Gebäuden: Plätze, Parkplatz, Fundamente neuer Bauten
function stadion3dGelaendeBoden(ctx, P, plan) {
    const f = stadion3dLichtFaktor(), a = stadionAnsicht;
    plan.forEach(g => {
        const [x0, y0, x1, y1] = g.rect;
        let pr = null;
        if (!g.lvl) {
            pr = stadion3dFlach(ctx, P, x0, y0, x1, y1, stadion3dMisch('#a1887f', 1 - f, '#000000'));
            if (pr) { ctx.strokeStyle = '#ff9800'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
        } else if (g.form === 'platz' || g.form === 'jugend') pr = stadion3dKleinfeld(ctx, P, g.rect, f);
        else if (g.form === 'parkplatz') {
            // Größer mit jeder Stufe, Autos nach festem Muster
            const w = (x1 - x0) * (0.55 + 0.15 * Math.min(3, g.lvl)), cx = (x0 + x1) / 2;
            pr = stadion3dFlach(ctx, P, cx - w / 2, y0, cx + w / 2, y1, stadion3dMisch('#616161', 1 - f, '#000000'));
            const farben = STADION3D_KLEIDUNG;
            for (let i = 0; i < Math.round(w / 3.2); i++) for (let j = 0; j < 4; j++) {
                if (stadion3dZufall('auto', i, j) > 0.7) continue;
                const ax = cx - w / 2 + 1 + i * 3.2, ay = y0 + 2 + j * ((y1 - y0 - 4) / 4);
                stadion3dFlach(ctx, P, ax, ay, ax + 2, ay + 4.2, stadion3dMisch(farben[(i + j) % farben.length], 1 - f, '#000000'), 0.4);
            }
        }
        if (pr) { if (a.auswahl === g.id) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2.5; stadion3dPfad(ctx, pr); ctx.stroke(); } a.treffer.push({ key: g.id, pr }); }
    });
}

// Gebäude des Geländes in die Zeichenliste
function stadion3dGelaendeBauen(liste, P, plan, layout, szene) {
    const a = stadionAnsicht;
    plan.forEach(g => {
        const [x0, y0, x1, y1] = g.rect;
        const stil = (farbe, extra) => Object.assign({ farbe, ziel: g.id, auswahl: a.auswahl === g.id }, extra || {});
        if (g.lvl) {
            if (g.form === 'haus') {
                stadion3dQuader(liste, P, x0, y0, x1, y1, 0, g.h(g.lvl), stil(g.farbe, { icon: g.icon, fenster: g.fenster }));
                if (g.deck) for (let i = 1; i < g.lvl; i++) stadion3dQuader(liste, P, x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3, i * 3.2 - 0.25, i * 3.2, stil('#757575'));
            } else if (g.form === 'bloecke') {
                const n = g.key === 'gewerbepark' ? g.lvl + 1 : g.lvl;
                const lang = (x1 - x0) >= (y1 - y0), schritt = ((lang ? x1 - x0 : y1 - y0)) / n;
                for (let i = 0; i < n; i++) {
                    const s0 = (lang ? x0 : y0) + i * schritt + 1.2, s1 = s0 + schritt - 2.4;
                    if (lang) stadion3dQuader(liste, P, s0, y0, s1, y1, 0, g.h(g.lvl), stil(g.farbe, { icon: i === 0 ? g.icon : null }));
                    else stadion3dQuader(liste, P, x0, s0, x1, s1, 0, g.h(g.lvl), stil(g.farbe, { icon: i === 0 ? g.icon : null }));
                }
            } else if (g.form === 'reihe') {
                const n = g.lvl * 2, lang = (x1 - x0) >= (y1 - y0), schritt = (lang ? x1 - x0 : y1 - y0) / n;
                for (let i = 0; i < n; i++) {
                    const s0 = (lang ? x0 : y0) + i * schritt + 0.5, s1 = s0 + Math.min(4, schritt - 1);
                    const farbe = ['#ffb300', '#e53935', '#43a047', '#1e88e5'][i % 4];
                    if (lang) stadion3dQuader(liste, P, s0, y0, s1, y1, 0, 2.8, stil(farbe, { icon: i === 0 ? g.icon : null }));
                    else stadion3dQuader(liste, P, x0, s0, x1, s1, 0, 2.8, stil(farbe, { icon: i === 0 ? g.icon : null }));
                }
            } else if (g.form === 'tore') {
                const n = g.lvl * 2, lang = (x1 - x0) >= (y1 - y0), schritt = (lang ? x1 - x0 : y1 - y0) / n;
                for (let i = 0; i < n; i++) {
                    const s0 = (lang ? x0 : y0) + i * schritt + schritt * 0.3, s1 = s0 + schritt * 0.4;
                    if (lang) stadion3dQuader(liste, P, s0, y0, s1, y1, 0, 2.4, stil('#cfd8dc'));
                    else stadion3dQuader(liste, P, x0, s0, x1, s1, 0, 2.4, stil('#cfd8dc'));
                }
            } else if (g.form === 'platz') {
                // Trainingsgelände mit Flutlicht: vier Masten, ab Stufe 3 ein Funktionsgebäude
                const h = 14 + g.lvl * 2;
                [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => stadion3dMast(liste, P, x, y, h));
                if (g.lvl >= 3) {
                    const S = STADION3D_SEITEN.E, d = layout.aussen.E + 81;
                    const p0 = [S.o[0] * d, -10], p1 = [S.o[0] * (d + 6), 10];
                    stadion3dQuader(liste, P, p0[0], p0[1], p1[0], p1[1], 0, 3 + g.lvl * 0.5, stil('#8d6e63', { icon: g.icon }));
                }
            } else if (g.form === 'jugend' && g.heim) {
                const [hx0, hy0, hx1, hy1] = g.heim;
                stadion3dQuader(liste, P, hx0, hy0, hx1, hy1, 0, 3 + g.lvl, stil('#a1887f', { icon: g.icon }));
            }
        }
        if (g.bau) {
            stadion3dKran(liste, P, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(26, (g.h ? g.h(g.lvl + 1) : 10) + 12), g.anteil, String(g.name).replace(/\s*(['"„&]|Stufe).*$/, '').slice(0, 22));
            szene.kraene.push({ type: g.bau.type, anteil: Math.round(g.anteil * 100) });
        }
        szene.gelaende.push({ id: g.id, lvl: g.lvl, bau: !!g.bau });
    });
}

// ---------- Bauart: Ecken, Dächer, Banden, Laufbahn ----------
const STADION3D_ECKEN = [[1, -1, 'N', 'E'], [-1, -1, 'N', 'W'], [1, 1, 'S', 'E'], [-1, 1, 'S', 'W']];
function stadion3dEckPunkte(layout, sx, sy, nord, ost) {
    const aN = layout.a0[nord], aE = layout.a0[ost], dN = layout.tiefeUnten[nord], dE = layout.tiefeUnten[ost];
    return { P1: [38 * sx, sy * aN], P2: [sx * aE, sy * 54], BN: [38 * sx, sy * (aN + dN)], C: [sx * (aE + dE), sy * (aN + dN)], BE: [sx * (aE + dE), sy * 54],
        h1: Math.max(1.5, Math.min(layout.hoeheUnten[nord], layout.hoeheUnten[ost])) };
}

// Geschlossene Ecken großer Stadien: Sitzschräge zwischen den Enden der Nachbartribünen, Außenwände
function stadion3dEcken(liste, P, layout, fuellung, farben, szene) {
    szene.ecken = 0;
    STADION3D_ECKEN.forEach(([sx, sy, nord, ost]) => {
        const e = stadion3dEckPunkte(layout, sx, sy, nord, ost);
        if (!layout.tiefeUnten[nord] || !layout.tiefeUnten[ost]) return;
        const z0 = 1.2, z1 = e.h1;
        const nachbarn = layout.segmente.filter(sg => sg.rang === 0 && (sg.seite === nord || sg.seite === ost)).map(sg => fuellung[sg.key] || 0);
        const fuell = nachbarn.length ? nachbarn.reduce((x, y) => x + y, 0) / nachbarn.length : 0;
        const stil = { farbe: stadion3dMisch(farben.eigene, 0.2, '#303030'), wand: '#d5dbe0', farben, fuellung: fuell, art: 'ecke',
            ecke: { P1: e.P1, P2: e.P2, BN: e.BN, C: e.C, BE: e.BE, z0, z1 }, key: 'ecke' + sx + sy };
        const pkt = (q, z) => [q[0], q[1], z];
        stadion3dFlaeche(liste, P, [pkt(e.P1, z0), pkt(e.P2, z0), pkt(e.BE, z1), pkt(e.C, z1), pkt(e.BN, z1)], [-sx * 0.5, -sy * 0.5, 1], stil);
        const wand = (ton) => ({ farbe: '#d5dbe0', art: 'wand', ton });
        stadion3dFlaeche(liste, P, [pkt(e.BN, 0), pkt(e.C, 0), pkt(e.C, z1), pkt(e.BN, z1)], [0, sy, 0], Object.assign(wand(0.62), { fassade: true, farben }));
        stadion3dFlaeche(liste, P, [pkt(e.C, 0), pkt(e.BE, 0), pkt(e.BE, z1), pkt(e.C, z1)], [sx, 0, 0], Object.assign(wand(0.7), { fassade: true, farben }));
        stadion3dFlaeche(liste, P, [pkt(e.P1, 0), pkt(e.P2, 0), pkt(e.P2, z0), pkt(e.P1, z0)], [-sx, -sy, 0], wand(0.8));
        szene.ecken++;
    });
}

function stadion3dEckPublikum(ctx, P, st, f) {
    const e = st.ecke, farben = st.farben;
    const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    for (let j = 0; j < 10; j++) {
        const v = (j + 0.5) / 10;
        for (let i = 0; i < 24; i++) {
            const u = (i + 0.5) / 24;
            if (stadion3dZufall(st.key, i, j) >= st.fuellung) continue;
            const vorn = lerp(e.P1, e.P2, u), hinten = u < 0.5 ? lerp(e.BN, e.C, u * 2) : lerp(e.C, e.BE, (u - 0.5) * 2);
            const p = lerp(vorn, hinten, v);
            const q = stadion3dPunkt(P, p[0], p[1], e.z0 + (e.z1 - e.z0) * v + 0.4);
            if (!q) continue;
            const g = Math.max(0.9, q.s * 1.15);
            const farbe = stadion3dZufall('e', i, j) < 0.35 ? farben.eigene : STADION3D_KLEIDUNG[(i * 7 + j) % STADION3D_KLEIDUNG.length];
            ctx.fillStyle = stadion3dMisch(farbe, 1 - f, '#000000');
            ctx.fillRect(q.x - g / 2, q.y - g, g, g * 1.25);
        }
    }
}

// Tribünendach: leicht zum Spielfeld ansteigend, hinten auf Stützen; die Komplett-Überdachung reicht weiter nach vorn
function stadion3dTribuenendach(liste, P, layout, s, komplett, solar) {
    const lang = s === 'N' || s === 'S' ? 38 : 54;
    const vorn = komplett ? layout.a0[s] - 4 : layout.a0[s] + 1.5;
    const hinten = layout.aussen[s] + 0.6, z = layout.oben[s] + 3.5;
    const pts = [stadion3dWelt(s, -lang, vorn, z + 2), stadion3dWelt(s, lang, vorn, z + 2), stadion3dWelt(s, lang, hinten, z), stadion3dWelt(s, -lang, hinten, z)];
    stadion3dFlaeche(liste, P, pts, null, { farbe: solar ? '#1a3a5c' : '#eef1f3', art: 'dach', ton: 1, alpha: komplett ? 0.55 : 0.6, solar, umriss: true });
    // Stützen an der Rückseite
    const n = Math.max(2, Math.round(lang * 2 / 18));
    for (let i = 0; i <= n; i++) {
        const t = -lang + i * (lang * 2 / n);
        const fuss = stadion3dWelt(s, t, hinten, 0), kopf = stadion3dWelt(s, t, hinten, z);
        stadion3dObjekt(liste, P, [fuss[0], fuss[1], z / 2], ctx => {
            const a = stadion3dPunkt(P, ...fuss), b = stadion3dPunkt(P, ...kopf);
            if (!a || !b) return;
            ctx.strokeStyle = stadion3dMisch('#90a4ae', 1 - stadion3dLichtFaktor(), '#000000'); ctx.lineWidth = Math.max(1, b.s * 0.5);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
    }
}

// Dachring der Arenen: vier Bänder mit Gehrung an den Ecken, innen offen über dem Spielfeld; die Großarena hat
// ein breiteres Dach und Pylone auf dem Ring, die Komplett-Überdachung reicht bis an die Spielfeldkante
function stadion3dDachring(liste, P, layout, solar, komplett) {
    const riesig = layout.bauart.ring;
    const z = Math.max(layout.oben.N, layout.oben.S, layout.oben.W, layout.oben.E) + 4;
    const vor = komplett ? -4 : (riesig ? 1 : 4);
    const xi = layout.a0.W + vor, yi = layout.a0.N + vor;
    const xo = Math.max(layout.aussen.W, layout.aussen.E) + 1, yo = Math.max(layout.aussen.N, layout.aussen.S) + 1;
    const stil = { farbe: solar ? '#1a3a5c' : '#eef1f3', art: 'dach', ton: 1, alpha: 0.62, solar, umriss: true };
    [
        [[-xi, -yi], [xi, -yi], [xo, -yo], [-xo, -yo]],
        [[xi, -yi], [xi, yi], [xo, yo], [xo, -yo]],
        [[xi, yi], [-xi, yi], [-xo, yo], [xo, yo]],
        [[-xi, yi], [-xi, -yi], [-xo, -yo], [-xo, yo]]
    ].forEach(band => stadion3dFlaeche(liste, P, band.map(([x, y], i) => [x, y, i < 2 ? z + 2 : z]), null, stil));
    // Stützen außen am Ring, bei der Großarena Pylone über dem Dach
    const stuetzen = [];
    for (let i = 0; i <= 4; i++) { const u = -1 + i / 2; stuetzen.push([u * xo, -yo], [u * xo, yo], [-xo, u * yo], [xo, u * yo]); }
    stuetzen.forEach(([x, y]) => stadion3dObjekt(liste, P, [x, y, z / 2], ctx => {
        const a = stadion3dPunkt(P, x, y, 0), b = stadion3dPunkt(P, x, y, riesig ? z + 12 : z);
        if (!a || !b) return;
        ctx.strokeStyle = stadion3dMisch(riesig ? '#eceff1' : '#90a4ae', 1 - stadion3dLichtFaktor(), '#000000'); ctx.lineWidth = Math.max(1, b.s * (riesig ? 0.8 : 0.5));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }));
}

// Werbebanden um das Spielfeld (zum Spielfeld gewandt) und zwei Trainerbänke vor der Haupttribüne
function stadion3dBanden(liste, P, layout) {
    const klein = layout.bauart.laufbahn;
    const farben = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#f5f5f5', '#fb8c00', '#8e24aa', game.clubCrestColor || '#8b5cf6'];
    const seiteX = klein ? 35.3 : 37, seiteY = 56;
    let n = 0;
    const bande = (p0, p1, normale) => {
        stadion3dFlaeche(liste, P, [[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], 0.9], [p0[0], p0[1], 0.9]], normale, { farbe: farben[n++ % farben.length], art: 'bande' });
    };
    for (let y = -52.5; y < 52.5; y += 7.5) {
        [-1, 1].forEach(sx => { if (!(klein && sx < 0 && Math.abs(y + 3.75) < 17)) bande([sx * seiteX, y], [sx * seiteX, y + 7.5], [-sx, 0, 0]); });
    }
    for (let x = -34; x < 34; x += 8.5) [-1, 1].forEach(sy => { if (Math.abs(x + 4.25) > 5) bande([x, sy * seiteY], [x + 8.5, sy * seiteY], [0, -sy, 0]); });
    const bx0 = klein ? -36.4 : -39.6, bx1 = klein ? -35.5 : -37.6;
    [[-16, -6], [6, 16]].forEach(([y0, y1]) => stadion3dQuader(liste, P, bx0, y0, bx1, y1, 0, 1.9, { farbe: '#455a64', art: 'dach' }));
}

// Laufbahn kleiner Stadien: rote Bahn, Rasen im Innenraum, Bahnlinien
// Oval der Laufbahn: Halbkreise um (0, ±g), dazwischen die Geraden
function stadion3dLaufbahnPunkte(r, g) {
    const oval = [];
    for (let i = 0; i <= 18; i++) { const w = i / 18 * Math.PI; oval.push([Math.cos(w) * r, g + Math.sin(w) * r]); }
    for (let i = 0; i <= 18; i++) { const w = Math.PI + i / 18 * Math.PI; oval.push([Math.cos(w) * r, -g + Math.sin(w) * r]); }
    return oval;
}
function stadion3dLaufbahn(ctx, P) {
    const f = stadion3dLichtFaktor(), B = STADION3D_BAHN;
    const zeichne = (r, farbe) => {
        const pr = stadion3dPolyGeklippt(P, stadion3dLaufbahnPunkte(r, B.gerade).map(([x, y]) => [x, y, 0.02]));
        if (pr) { ctx.fillStyle = stadion3dMisch(farbe, 1 - f, '#000000'); stadion3dPfad(ctx, pr); ctx.fill(); }
        return pr;
    };
    zeichne(B.r + B.breite, '#b4553f');
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.3 * f})`; ctx.lineWidth = 0.7;
    for (let i = 1; i < 4; i++) {
        const pr = stadion3dPolyGeklippt(P, stadion3dLaufbahnPunkte(B.r + i * B.breite / 4, B.gerade).map(([x, y]) => [x, y, 0.03]));
        if (pr) { stadion3dPfad(ctx, pr); ctx.stroke(); }
    }
    zeichne(B.r, '#3a8f3e');
}

function stadion3dRasen(ctx, P, layout) {
    const f = stadion3dLichtFaktor();
    const nachtHell = stadionAnsicht.licht === 'nacht' && stadium.flutlicht ? 1.25 : 1;
    if (layout && layout.bauart.laufbahn) stadion3dLaufbahn(ctx, P);
    else {
        const rand = stadion3dPolyGeklippt(P, [[-40, -59.5, 0], [40, -59.5, 0], [40, 59.5, 0], [-40, 59.5, 0]]);
        if (!rand) return;
        ctx.fillStyle = stadion3dMisch('#2f7d32', 1 - Math.min(1, f * nachtHell), '#000000'); stadion3dPfad(ctx, rand); ctx.fill();
    }
    // Mähstreifen
    for (let i = 0; i < 12; i++) {
        const y0 = -52.5 + i * 8.75, y1 = y0 + 8.75;
        const q = [[-34, y0], [34, y0], [34, y1], [-34, y1]].map(p => stadion3dPunkt(P, p[0], p[1], 0));
        ctx.fillStyle = stadion3dMisch(i % 2 ? '#3f9a44' : '#358a3a', 1 - Math.min(1, f * nachtHell), '#000000');
        stadion3dPfad(ctx, q); ctx.fill();
    }
    // Abnutzung nach dem echten Rasenzustand: Torräume, Elfmeterpunkte, Mittelkreis
    const zustand = typeof stadium.pitchCondition === 'number' ? stadium.pitchCondition : 85;
    const schaden = Math.max(0, Math.min(1, (82 - zustand) / 55));
    if (schaden > 0) {
        const stellen = [[0, -48, 7, 4], [0, 48, 7, 4], [0, -41.5, 3, 3], [0, 41.5, 3, 3], [0, 0, 6, 5], [-24, -20, 4, 6], [22, 18, 4, 6], [10, -30, 3, 4], [-12, 30, 3, 4]];
        const anzahl = Math.ceil(stellen.length * schaden);
        ctx.fillStyle = stadion3dMisch('#8d6e4a', 1 - f, '#000000');
        stellen.slice(0, anzahl).forEach(([x, y, rx, ry]) => {
            const pts = [];
            for (let i = 0; i < 14; i++) { const w = i / 14 * Math.PI * 2; const p = stadion3dPunkt(P, x + Math.cos(w) * rx * (0.6 + schaden * 0.5), y + Math.sin(w) * ry * (0.6 + schaden * 0.5), 0.02); if (p) pts.push(p); }
            if (pts.length > 3) { ctx.globalAlpha = 0.35 + schaden * 0.5; stadion3dPfad(ctx, pts); ctx.fill(); }
        });
        ctx.globalAlpha = 1;
    }
    // Linien
    const linie = pts => { const pr = pts.map(p => stadion3dPunkt(P, p[0], p[1], 0.03)); if (pr.some(p => !p)) return; ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y); pr.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); };
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.35 * f})`; ctx.lineWidth = Math.max(0.6, P.fokus / 600);
    linie([[-34, -52.5], [34, -52.5], [34, 52.5], [-34, 52.5], [-34, -52.5]]);
    linie([[-34, 0], [34, 0]]);
    [-1, 1].forEach(r => {
        linie([[-20.16, r * 52.5], [-20.16, r * 36], [20.16, r * 36], [20.16, r * 52.5]]);
        linie([[-9.16, r * 52.5], [-9.16, r * 47], [9.16, r * 47], [9.16, r * 52.5]]);
    });
    const kreis = []; for (let i = 0; i <= 28; i++) { const w = i / 28 * Math.PI * 2; kreis.push([Math.cos(w) * 9.15, Math.sin(w) * 9.15]); }
    linie(kreis);
    stadionAnsicht.szene.rasen = { zustand, flecken: schaden > 0 ? Math.ceil(9 * schaden) : 0 };
}

function stadion3dTore(liste, P) {
    [-1, 1].forEach(r => {
        stadion3dObjekt(liste, P, [0, r * 52.5, 1.2], ctx => {
            const pts = [[-3.66, r * 52.5, 0], [-3.66, r * 52.5, 2.44], [3.66, r * 52.5, 2.44], [3.66, r * 52.5, 0]].map(p => stadion3dPunkt(P, p[0], p[1], p[2]));
            if (pts.some(p => !p)) return;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, pts[1].s * 0.15);
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
        });
    });
}

// Sitzschräge mit Publikum: Punkte je Sitzgruppe, besetzt nach der Auslastung des Blocks
function stadion3dPublikum(ctx, P, st, f) {
    const fuell = st.fuellung || 0, farben = st.farben;
    const [t0, t1] = st.t, [d0, d1] = st.d, [h0, h1] = st.h;
    const spalten = Math.max(4, Math.min(46, Math.round((t1 - t0) / 2.3)));
    const reihen = Math.max(2, Math.min(18, Math.round((d1 - d0) / 1.7)));
    const choreo = st.choreo;
    for (let j = 0; j < reihen; j++) {
        const v = (j + 0.5) / reihen;
        for (let i = 0; i < spalten; i++) {
            const u = (i + 0.5) / spalten;
            const p = stadion3dWelt(st.seite, t0 + (t1 - t0) * u, d0 + (d1 - d0) * v, h0 + (h1 - h0) * v + 0.4);
            const q = stadion3dPunkt(P, p[0], p[1], p[2]);
            if (!q) continue;
            const g = Math.max(0.9, q.s * 1.15);
            let farbe;
            if (choreo) farbe = (Math.floor(u * 8) % 2 === 0) ? farben.eigene : farben.zweite;
            else if (stadion3dZufall(st.key, i, j) >= fuell) continue;
            else if (st.key === 'gaeste') farbe = stadion3dZufall(st.key, j, i) < 0.75 ? farben.gegner : STADION3D_KLEIDUNG[(i + j) % STADION3D_KLEIDUNG.length];
            else if (st.key === 'kurve' || st.key === 'suedOber') farbe = stadion3dZufall('k', i, j) < 0.7 ? farben.eigene : farben.zweite;
            else farbe = stadion3dZufall('m', i, j) < 0.35 ? farben.eigene : STADION3D_KLEIDUNG[stadion3dHash(st.key + i + '-' + j) % STADION3D_KLEIDUNG.length];
            ctx.fillStyle = stadion3dMisch(farbe, 1 - f, '#000000');
            ctx.fillRect(q.x - g / 2, q.y - g, g, g * 1.25);
        }
    }
}

function stadion3dZeichneFlaeche(ctx, P, e, f) {
    const st = e.stil;
    if (st.art === 'ecke') {
        ctx.fillStyle = stadion3dMisch(st.farbe, 1 - f, '#000000'); stadion3dPfad(ctx, e.pr); ctx.fill();
        stadion3dEckPublikum(ctx, P, st, f);
        return;
    }
    if (st.art === 'bande') {
        ctx.fillStyle = stadion3dMisch(st.farbe, 1 - Math.max(f, stadionAnsicht.licht === 'nacht' && stadium.flutlicht ? 0.9 : 0), '#000000');
        stadion3dPfad(ctx, e.pr); ctx.fill();
        return;
    }
    let farbe = st.farbe || '#9e9e9e';
    if (st.art === 'wand' || st.art === 'dach') farbe = stadion3dMisch(farbe, 1 - (st.ton || 1), '#000000');
    ctx.globalAlpha = st.alpha || 1;
    ctx.fillStyle = stadion3dMisch(farbe, 1 - f, '#000000');
    stadion3dPfad(ctx, e.pr); ctx.fill();
    if (st.umriss) { ctx.globalAlpha = 0.9; ctx.strokeStyle = stadion3dMisch('#607d8b', 1 - f, '#000000'); ctx.lineWidth = 1.2; ctx.stroke(); }
    if (st.fassade && st.farben && e.pr.length === 4) {
        // Band in Vereinsfarbe oben an der Außenwand
        const [p0, p1, p2, p3] = e.pr, l = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
        const band = [l(p0, p3, 0.72), l(p1, p2, 0.72), l(p1, p2, 0.86), l(p0, p3, 0.86)];
        ctx.globalAlpha = 1; ctx.fillStyle = stadion3dMisch(st.farben.eigene, 1 - f, '#000000');
        stadion3dPfad(ctx, band); ctx.fill();
    }
    if (st.art === 'schraege' && !st.geist) {
        if (st.risiko !== undefined) { ctx.globalAlpha = 0.85; ctx.fillStyle = stadion3dRisikoFarbe(st.risiko); stadion3dPfad(ctx, e.pr); ctx.fill(); }
        else stadion3dPublikum(ctx, P, st, f);
        // Reihenlinien
        ctx.globalAlpha = 0.18; ctx.strokeStyle = '#000000'; ctx.lineWidth = 0.6;
        const n = Math.min(12, Math.round((st.d[1] - st.d[0]) / 3));
        for (let i = 1; i < n; i++) {
            const v = i / n;
            const a = stadion3dPunkt(P, ...stadion3dWelt(st.seite, st.t[0], st.d[0] + (st.d[1] - st.d[0]) * v, st.h[0] + (st.h[1] - st.h[0]) * v));
            const b = stadion3dPunkt(P, ...stadion3dWelt(st.seite, st.t[1], st.d[0] + (st.d[1] - st.d[0]) * v, st.h[0] + (st.h[1] - st.h[0]) * v));
            if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
    }
    if (st.geist) {
        ctx.globalAlpha = 0.95; ctx.strokeStyle = st.geist === 'bau' ? '#ff9800' : '#ffd54f';
        ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); stadion3dPfad(ctx, e.pr); ctx.stroke(); ctx.setLineDash([]);
        if (st.geist === 'bau' && st.art === 'schraege') {
            // Gerüst: Gitter über dem neuen Rang
            ctx.globalAlpha = 0.6; ctx.lineWidth = 0.8;
            for (let i = 1; i < 6; i++) {
                const u = i / 6;
                const a = stadion3dPunkt(P, ...stadion3dWelt(st.seite, st.t[0] + (st.t[1] - st.t[0]) * u, st.d[0], st.h[0]));
                const b = stadion3dPunkt(P, ...stadion3dWelt(st.seite, st.t[0] + (st.t[1] - st.t[0]) * u, st.d[1], 0));
                if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
            }
        }
    }
    if (st.fenster && st.art === 'wand') {
        // Fensterreihen an Hotel und Bürotürmen, nachts beleuchtet
        const [p0, p1, p2, p3] = e.pr;
        ctx.globalAlpha = stadionAnsicht.licht === 'tag' ? 0.35 : 0.8;
        ctx.strokeStyle = stadionAnsicht.licht === 'tag' ? '#263238' : '#ffe082'; ctx.lineWidth = 0.7;
        for (let i = 1; i < 8; i++) {
            const u = i / 8;
            ctx.beginPath(); ctx.moveTo(p0.x + (p3.x - p0.x) * u, p0.y + (p3.y - p0.y) * u); ctx.lineTo(p1.x + (p2.x - p1.x) * u, p1.y + (p2.y - p1.y) * u); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    if (st.auswahl && (st.art === 'schraege' || st.art === 'glas' || (st.ziel && st.art === 'dach'))) {
        ctx.globalAlpha = 1; ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2.5; stadion3dPfad(ctx, e.pr); ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// Flutlichtmast mit Strahlern, nachts mit Lichtkegel
function stadion3dMast(liste, P, x, y, hoehe) {
    stadion3dObjekt(liste, P, [x, y, hoehe / 2], ctx => {
        const fuss = stadion3dPunkt(P, x, y, 0), kopf = stadion3dPunkt(P, x, y, hoehe);
        if (!fuss || !kopf) return;
        const f = stadion3dLichtFaktor();
        ctx.strokeStyle = stadion3dMisch('#b0bec5', 1 - f, '#000000'); ctx.lineWidth = Math.max(1.2, kopf.s * 0.9);
        ctx.beginPath(); ctx.moveTo(fuss.x, fuss.y); ctx.lineTo(kopf.x, kopf.y); ctx.stroke();
        const b = Math.max(5, kopf.s * 7), h = Math.max(3, kopf.s * 4);
        const nacht = stadionAnsicht.licht !== 'tag';
        ctx.fillStyle = nacht ? '#fffde7' : '#78909c';
        ctx.fillRect(kopf.x - b / 2, kopf.y - h, b, h);
        if (nacht) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(kopf.x, kopf.y - h / 2, 0, kopf.x, kopf.y - h / 2, b * 3);
            g.addColorStop(0, 'rgba(255,250,220,0.85)'); g.addColorStop(1, 'rgba(255,250,220,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kopf.x, kopf.y - h / 2, b * 3, 0, Math.PI * 2); ctx.fill();
            const mitte = stadion3dPunkt(P, x * 0.25, y * 0.25, 0);
            if (mitte && stadionAnsicht.licht === 'nacht') {
                const k = ctx.createLinearGradient(kopf.x, kopf.y, mitte.x, mitte.y);
                k.addColorStop(0, 'rgba(255,250,220,0.22)'); k.addColorStop(1, 'rgba(255,250,220,0)');
                ctx.fillStyle = k; ctx.beginPath(); ctx.moveTo(kopf.x - b / 2, kopf.y); ctx.lineTo(mitte.x - b * 6, mitte.y); ctx.lineTo(mitte.x + b * 6, mitte.y); ctx.lineTo(kopf.x + b / 2, kopf.y); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
    });
}

// Baukran mit drehendem Ausleger und Fortschrittsbalken
function stadion3dKran(liste, P, x, y, hoehe, anteil, text) {
    stadion3dObjekt(liste, P, [x, y, hoehe / 2], ctx => {
        const fuss = stadion3dPunkt(P, x, y, 0), kopf = stadion3dPunkt(P, x, y, hoehe);
        if (!fuss || !kopf) return;
        const w = stadionAnsicht.zeit * 0.25 + (x + y) * 0.05;
        const spitze = stadion3dPunkt(P, x + Math.cos(w) * hoehe * 0.6, y + Math.sin(w) * hoehe * 0.6, hoehe);
        const gegen = stadion3dPunkt(P, x - Math.cos(w) * hoehe * 0.2, y - Math.sin(w) * hoehe * 0.2, hoehe);
        ctx.strokeStyle = '#fbc02d'; ctx.lineWidth = Math.max(1.2, kopf.s * 0.7);
        ctx.beginPath(); ctx.moveTo(fuss.x, fuss.y); ctx.lineTo(kopf.x, kopf.y); ctx.stroke();
        if (spitze && gegen) {
            ctx.beginPath(); ctx.moveTo(gegen.x, gegen.y); ctx.lineTo(spitze.x, spitze.y); ctx.stroke();
            const haken = stadion3dPunkt(P, x + Math.cos(w) * hoehe * 0.45, y + Math.sin(w) * hoehe * 0.45, hoehe * 0.55);
            const oben = stadion3dPunkt(P, x + Math.cos(w) * hoehe * 0.45, y + Math.sin(w) * hoehe * 0.45, hoehe);
            if (haken && oben) { ctx.lineWidth = 0.8; ctx.strokeStyle = '#424242'; ctx.beginPath(); ctx.moveTo(oben.x, oben.y); ctx.lineTo(haken.x, haken.y); ctx.stroke(); }
        }
        // Fortschritt
        const bw = 46, bh = 6, bx = kopf.x - bw / 2, by = kopf.y - 16;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#ff9800'; ctx.fillRect(bx, by, bw * anteil, bh);
        ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
        const zeile = `${text} ${Math.round(anteil * 100)} %`;
        ctx.strokeText(zeile, kopf.x, by - 2); ctx.fillText(zeile, kopf.x, by - 2);
    });
}

function stadion3dFahnen(liste, P, seg, farben) {
    const n = Math.max(4, Math.round((seg.bis - seg.von) / 9));
    for (let i = 0; i < n; i++) {
        const t = seg.von + (i + 0.5) / n * (seg.bis - seg.von);
        const fuss = stadion3dWelt(seg.seite, t, seg.a + 0.6, seg.h0);
        stadion3dObjekt(liste, P, fuss, ctx => {
            const a = stadion3dPunkt(P, fuss[0], fuss[1], fuss[2]), b = stadion3dPunkt(P, fuss[0], fuss[1], fuss[2] + 4.5);
            if (!a || !b) return;
            ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            const welle = Math.sin(stadionAnsicht.zeit * 5 + i) * b.s * 0.6;
            const l = b.s * 3.2, h = b.s * 2;
            ctx.fillStyle = i % 2 ? farben.eigene : farben.zweite;
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + l / 2, b.y + welle, b.x + l, b.y + welle * 0.4);
            ctx.lineTo(b.x + l, b.y + h + welle * 0.4); ctx.quadraticCurveTo(b.x + l / 2, b.y + h + welle, b.x, b.y + h); ctx.closePath(); ctx.fill();
        });
    }
}

function stadion3dSzeneBauen(P, layout, plan) {
    const liste = [];
    const a = stadionAnsicht;
    const spiel = stadion3dSpiel();
    const fuellung = stadion3dFuellung(spiel);
    const farben = stadion3dFarben(spiel.gegner);
    const choreo = stadion3dChoreo();
    const risiko = a.risiko ? stadion3dRisiko() : null;
    const szene = { bloecke: [], kraene: [], anlagen: [], gelaende: [], fahnen: false, choreo, flutlicht: !!stadium.flutlicht, dach: !!stadium.dach, anzeigen: !!stadium.videowalls, spiel, geist: null };
    layout.segmente.forEach(s => {
        const b = stadium.blocks[s.key];
        // Sitze in Vereinsfarbe, Stehtraversen der kleinen Stadien in Beton
        const traverse = layout.stufe === 'klein' && s.seite !== 'W';
        const sitz = traverse ? '#8a8f94' : (s.key === 'gaeste' ? '#5f6b73' : stadion3dMisch(farben.eigene, s.rang ? 0.35 : 0.2, '#303030'));
        const stil = { key: s.key, seite: s.seite, farbe: sitz, wand: layout.stufe === 'klein' ? '#a7a9a6' : '#d5dbe0', fuellung: fuellung[s.key] || 0, farben, auswahl: a.auswahl === s.key,
            choreo: !!choreo && s.key === 'kurve', risiko: risiko ? (risiko.je[s.key] || 0) : undefined };
        stadion3dRang(liste, P, s.seite, s.von, s.bis, s.a, s.tiefe, s.h0, s.hub, s.zF, stil);
        if (s.geist) {
            const g = { key: s.key, seite: s.seite, farbe: s.geist === 'bau' ? '#ffcc80' : '#fff59d', alpha: 0.42, geist: s.geist, ohneFront: true };
            stadion3dRang(liste, P, s.seite, s.von, s.bis, s.a + s.tiefe, s.tiefeZiel - s.tiefe, s.h0 + s.hub, s.hubZiel - s.hub, 0, g);
            szene.geist = { key: s.key, art: s.geist, reihen: s.reihen };
        }
        szene.bloecke.push({ key: s.key, cap: b ? b.cap : 0, reihen: s.reihen, fuellung: Math.round((fuellung[s.key] || 0) * 100) });
        // Buden hinter dem Block: Imbiss, Fanshop, Toiletten je Stufe
        if (b && s.rang === 0) {
            const buden = [];
            for (let i = 0; i < (b.foodLvl || 0); i++) buden.push('#ffb300');
            for (let i = 0; i < (b.merchLvl || 0); i++) buden.push(farben.eigene);
            for (let i = 0; i < (b.toiletLvl || 0); i++) buden.push('#90a4ae');
            const mitte = (s.von + s.bis) / 2, d = layout.aussen[s.seite] + 3;
            buden.forEach((farbe, i) => {
                const t = mitte + (i - (buden.length - 1) / 2) * 4.2;
                stadion3dQuaderSeite(liste, P, s.seite, t - 1.6, t + 1.6, d, d + 3, 0, 2.6, { farbe, key: s.key });
            });
            szene.bloecke[szene.bloecke.length - 1].buden = buden.length;
        }
        if (s.key === 'kurve' && b && (b.cultureStrength ?? 30) >= 50) { stadion3dFahnen(liste, P, s, farben); szene.fahnen = true; }
    });
    // Logen und Presse
    layout.kaesten.forEach(k => {
        const b = stadium.blocks[k.key];
        const glas = k.key === 'vipLogen';
        const r = risiko ? risiko.je[k.key] || 0 : undefined;
        stadion3dQuaderSeite(liste, P, k.seite, k.von, k.bis, k.a, k.a + k.tiefe, k.z0, k.z0 + k.hoehe,
            { farbe: r !== undefined ? stadion3dRisikoFarbe(r) : (glas ? (stadium.upgrades && stadium.upgrades.vip_lounges ? '#80deea' : '#4dd0e1') : '#cfd8dc'), key: k.key, art: 'dach', artWand: glas ? 'glas' : 'wand', auswahl: a.auswahl === k.key });
        szene.bloecke.push({ key: k.key, cap: b ? b.cap : 0, fuellung: Math.round((fuellung[k.key] || 0) * 100) });
    });
    // Gästeblock-Zaun
    const g = layout.segmente.find(s => s.key === 'gaeste');
    if (g) {
        const fuss = stadion3dWelt('N', g.von, g.a, 0);
        stadion3dObjekt(liste, P, [fuss[0], fuss[1] - 5, 4], ctx => {
            ctx.strokeStyle = 'rgba(220,220,220,0.85)'; ctx.lineWidth = 1;
            for (let i = 0; i <= 6; i++) {
                const v = i / 6;
                const p0 = stadion3dPunkt(P, ...stadion3dWelt('N', g.von, g.a + g.tiefe * v, g.h0 + g.hub * v));
                const p1 = stadion3dPunkt(P, ...stadion3dWelt('N', g.von, g.a + g.tiefe * v, g.h0 + g.hub * v + 3));
                if (p0 && p1) { ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
            }
        });
    }
    // Ecken (große Stadien): geschlossene Schüssel
    if (layout.bauart.ecken) stadion3dEcken(liste, P, layout, fuellung, farben, szene);
    // Dächer: Komplett-Überdachung (Spezial-Installation) oder Tribünendächer nach Bauart
    const solar = !!(stadium.upgrades && stadium.upgrades.solaranlage);
    const dachSeiten = stadium.dach ? ['N', 'S', 'W', 'E'] : layout.bauart.daecher;
    // Arenen: ein durchgehender Dachring über Tribünen und Ecken statt einzelner Platten
    if (layout.bauart.ecken) stadion3dDachring(liste, P, layout, solar, stadium.dach);
    else dachSeiten.forEach(s => stadion3dTribuenendach(liste, P, layout, s, stadium.dach, solar));
    szene.daecher = dachSeiten.slice();
    szene.dachring = !!layout.bauart.ecken;
    szene.stufe = layout.stufe;
    // Werbebanden und Trainerbänke
    stadion3dBanden(liste, P, layout);
    // Anzeigetafeln hinter den Toren
    if (stadium.videowalls) {
        ['N', 'S'].forEach(s => {
            const z = layout.oben[s] + (stadium.dach ? 8 : 2), d = layout.aussen[s] - 1;
            const pts = [stadion3dWelt(s, -9, d, z), stadion3dWelt(s, 9, d, z), stadion3dWelt(s, 9, d, z + 6), stadion3dWelt(s, -9, d, z + 6)];
            const S = STADION3D_SEITEN[s];
            stadion3dFlaeche(liste, P, pts, [-S.o[0], -S.o[1], 0], { farbe: '#101418', art: 'tafel', text: stadion3dTafelText(spiel) });
        });
    }
    // Flutlichtmasten in den Ecken
    if (stadium.flutlicht) {
        const h = Math.max(42, Math.max(layout.oben.N, layout.oben.S, layout.oben.W, layout.oben.E) + 18);
        const x = Math.max(layout.aussen.W, layout.aussen.E) - 6, y = Math.max(layout.aussen.N, layout.aussen.S) - 8;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => stadion3dMast(liste, P, sx * x, sy * y, h));
    }
    // Gebaute Anlagen
    const up = stadium.upgrades || {};
    Object.keys(STADION3D_ANLAGEN).filter(k => up[k]).forEach(k => {
        const an = STADION3D_ANLAGEN[k], d = layout.aussen[an.seite] + 10;
        stadion3dQuaderSeite(liste, P, an.seite, an.t - an.l / 2, an.t + an.l / 2, d, d + an.b, 0, an.h, { farbe: an.farbe, icon: an.icon });
        szene.anlagen.push(k);
    });
    if (up.solaranlage && !stadium.dach) {
        const d = layout.aussen.E + 10;
        stadion3dQuaderSeite(liste, P, 'E', -6, 8, d, d + 12, 0, 0.6, { farbe: '#1a3a5c', solar: true });
        szene.anlagen.push('solaranlage');
    }
    // Ehrenwand der Publikumslieblinge als Denkmal auf dem Vorplatz
    const lieblinge = [...new Set((game.crowdFavoriteHistory || []).map(x => x.name))];
    if (lieblinge.length >= 3) {
        const d = layout.aussen.W + 8;
        stadion3dQuaderSeite(liste, P, 'W', 14, 18, d, d + 4, 0, 1.2, { farbe: '#9e9e9e' });
        stadion3dQuaderSeite(liste, P, 'W', 15.3, 16.7, d + 1.3, d + 2.7, 1.2, 4.6, { farbe: '#c9a227', icon: '❤️' });
        szene.anlagen.push('denkmal');
    }
    // Vereinsgelände: Campus, Jugendakademie, Immobilien (mit eigenen Kränen)
    stadion3dGelaendeBauen(liste, P, plan || [], layout, szene);
    // Baustellen am Stadion
    stadion3dBaustellen().filter(x => !['campusBuilding', 'youthAcademyLvl', 'youthCapacity', 'realEstate'].includes(x.p.type)).forEach(({ p, anteil }) => {
        let ort = null;
        const seg = p.params && p.params.blockKey ? layout.segmente.find(s => s.key === p.params.blockKey) : null;
        const kasten = p.params && p.params.blockKey ? layout.kaesten.find(k => k.key === p.params.blockKey) : null;
        if (seg) ort = stadion3dWelt(seg.seite, (seg.von + seg.bis) / 2 + 8, layout.aussen[seg.seite] + 6, 0);
        else if (kasten) ort = stadion3dWelt('W', (kasten.von + kasten.bis) / 2, layout.aussen.W + 6, 0);
        else if (p.type === 'specialInstall') {
            const key = p.params && p.params.key;
            ort = key === 'flutlicht' ? [layout.aussen.E, layout.aussen.N, 0] : (key === 'videowalls' ? [-layout.aussen.W + 10, -layout.aussen.N - 4, 0] : (key === 'rasenheizung' ? [-30, 0, 0] : stadion3dWelt('W', 20, layout.aussen.W + 6, 0)));
        } else if (p.type === 'capacityProject') ort = stadion3dWelt('S', -14, layout.aussen.S + 6, 0);
        else if (p.type === 'stadiumUpgrade') {
            const an = STADION3D_ANLAGEN[p.params && p.params.key];
            ort = an ? stadion3dWelt(an.seite, an.t, layout.aussen[an.seite] + 14, 0) : stadion3dWelt('E', 0, layout.aussen.E + 8, 0);
        }
        if (!ort) return;
        const blk = p.params && p.params.blockKey && stadium.blocks[p.params.blockKey];
        const kurz = p.type === 'blockExpand' && blk ? `${blk.name} +${(p.params.seats || 0).toLocaleString('de-DE')}` : String(p.label || 'Baustelle').replace(/^[^:]*:\s*/, '').slice(0, 24);
        stadion3dKran(liste, P, ort[0], ort[1], Math.max(34, layout.oben.W + 14), anteil, kurz);
        szene.kraene.push({ type: p.type, anteil: Math.round(anteil * 100) });
    });
    stadion3dTore(liste, P);
    a.szene = Object.assign(a.szene, szene);
    return liste;
}

function stadion3dTafelText(spiel) {
    const b = (game.spielberichte || []).find(x => !x.cup);
    if (b && b.titel) return String(b.titel).slice(0, 28);
    return spiel.prognose ? (stadium.name || game.clubName || 'Willkommen') : `${(spiel.zuschauer || 0).toLocaleString('de-DE')} Zuschauer`;
}

function stadion3dZeichnen(ctx, P, layout) {
    const a = stadionAnsicht, W = P.W, H = P.H;
    const f = stadion3dLichtFaktor();
    a.szene = {};
    stadion3dHimmel(ctx, W, H);
    stadion3dBoden(ctx, P, layout);
    a.treffer = [];
    const plan = stadion3dGelaendePlan(layout);
    stadion3dGelaendeBoden(ctx, P, plan);
    stadion3dRasen(ctx, P, layout);
    const liste = stadion3dSzeneBauen(P, layout, plan);
    liste.sort((x, y) => y.abstand - x.abstand);
    liste.forEach(e => {
        if (e.objekt) { e.objekt(ctx); return; }
        const st = e.stil;
        if (st.art === 'glas') {
            ctx.globalAlpha = 0.85; ctx.fillStyle = stadion3dMisch(st.farbe, 1 - Math.max(f, a.licht === 'tag' ? 0 : 0.9), '#000000');
            stadion3dPfad(ctx, e.pr); ctx.fill();
            if (a.licht !== 'tag') { ctx.fillStyle = 'rgba(255,236,179,0.55)'; ctx.fill(); }
            ctx.globalAlpha = 1;
            if (st.auswahl) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2.5; ctx.stroke(); }
        } else if (st.art === 'tafel') {
            ctx.fillStyle = '#101418'; stadion3dPfad(ctx, e.pr); ctx.fill();
            const m = stadion3dPunkt(P, e.mitte[0], e.mitte[1], e.mitte[2]);
            if (m) {
                const breite = Math.abs(e.pr[1].x - e.pr[0].x);
                ctx.fillStyle = a.licht === 'tag' ? '#ffe082' : '#fff59d';
                ctx.font = `700 ${Math.max(6, Math.min(14, breite / 12))}px system-ui, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(st.text, m.x, m.y, breite * 0.92);
            }
        } else {
            stadion3dZeichneFlaeche(ctx, P, e, f);
            if (st.solar) {
                ctx.strokeStyle = 'rgba(144,202,249,0.5)'; ctx.lineWidth = 0.6;
                const [p0, p1, p2, p3] = e.pr;
                for (let i = 1; i < 8; i++) { const u = i / 8; ctx.beginPath(); ctx.moveTo(p0.x + (p1.x - p0.x) * u, p0.y + (p1.y - p0.y) * u); ctx.lineTo(p3.x + (p2.x - p3.x) * u, p3.y + (p2.y - p3.y) * u); ctx.stroke(); }
            }
            if (st.icon && st.art === 'dach') {
                const m = stadion3dPunkt(P, e.mitte[0], e.mitte[1], e.mitte[2] + 3);
                if (m) { ctx.font = `${Math.max(10, Math.min(22, m.s * 6))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(st.icon, m.x, m.y); }
            }
        }
        if (st.key && (st.art === 'schraege' || st.art === 'glas' || (st.art === 'dach' && (st.key === 'vipLogen' || st.key === 'presse'))) && !st.geist) a.treffer.push({ key: st.key, pr: e.pr });
        else if (st.ziel && (st.art === 'dach' || st.art === 'wand')) a.treffer.push({ key: st.ziel, pr: e.pr });
    });
    // Lichtshow bei Nacht
    if (a.licht === 'nacht' && stadium.upgrades && stadium.upgrades.lichtshow) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const farben = ['rgba(255,64,129,0.25)', 'rgba(64,196,255,0.25)', 'rgba(255,215,64,0.25)'];
        for (let i = 0; i < 6; i++) {
            const w = a.zeit * 0.8 + i * 1.05;
            const fuss = stadion3dPunkt(P, Math.cos(i) * 45, Math.sin(i) * 60, layout.oben.W + 4);
            if (!fuss) continue;
            ctx.strokeStyle = farben[i % 3]; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(fuss.x, fuss.y); ctx.lineTo(fuss.x + Math.cos(w) * W * 0.3, fuss.y - H * 0.6); ctx.stroke();
        }
        ctx.restore();
        a.szene.lichtshow = true;
    }
    stadion3dWetterZeichnen(ctx, W, H);
    if (a.licht === 'nacht' && !stadium.flutlicht) { ctx.fillStyle = 'rgba(0,0,10,0.35)'; ctx.fillRect(0, 0, W, H); }
    // Name oben links
    ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.fillStyle = '#ffffff';
    const name = stadium.name || 'Vereinsstadion';
    ctx.strokeText(name, 8, 7, W - 16); ctx.fillText(name, 8, 7, W - 16);
    if (a.flug) stadion3dFlugKarte(ctx, W, H);
    a.szene.licht = a.licht;
    a.szene.wetter = stadion3dWetter();
}

function stadion3dWetterZeichnen(ctx, W, H) {
    const w = stadion3dWetter(), t = stadionAnsicht.zeit;
    if (w === 'regen' || w === 'sturm') {
        ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1;
        const n = w === 'sturm' ? 120 : 70, schief = w === 'sturm' ? 7 : 2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const x = (stadion3dZufall('r', i, 1) * W + t * 40 * schief) % W, y = (stadion3dZufall('r', i, 2) * H + t * 420) % H;
            ctx.moveTo(x, y); ctx.lineTo(x - schief, y + 10);
        }
        ctx.stroke();
    } else if (w === 'schnee') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 80; i++) {
            const x = (stadion3dZufall('s', i, 1) * W + Math.sin(t + i) * 8) % W, y = (stadion3dZufall('s', i, 2) * H + t * 30) % H;
            ctx.beginPath(); ctx.arc(x, y, 1.4 + stadion3dZufall('s', i, 3) * 1.4, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// ---------- Rundflug ----------
function stadion3dFlugKarten() {
    const karten = [];
    if (stadionAnsicht.rundflugText) karten.push(['🏗️ Fertig gebaut', stadionAnsicht.rundflugText]);
    karten.push(['🏟️ ' + (stadium.name || 'Vereinsstadion'), stadium.namingRightsSponsor ? `Namensgeber: ${stadium.namingRightsSponsor}` : (game.clubName || '')]);
    karten.push(['👥 Kapazität', `${(stadium.total || 0).toLocaleString('de-DE')} Plätze`]);
    const gelaende = typeof campusBuildings !== 'undefined' ? Object.keys(STADION3D_CAMPUS).filter(k => campusBuildings[k] && campusBuildings[k].lvl > 0).length : 0;
    if (gelaende) karten.push(['🏫 Vereinsgelände', `${gelaende} Campus-Gebäude, Jugendakademie Stufe ${game.youthAcademyLvl || 1}`]);
    karten.push(['🏆 Zuschauerrekord', `${(game.recordAttendance || 0).toLocaleString('de-DE')} Zuschauer`]);
    if (typeof getStadiumMarketValue === 'function') karten.push(['💰 Stadionwert', `${(getStadiumMarketValue() / 1000000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`]);
    return karten;
}
function stadion3dFlugKarte(ctx, W, H) {
    const fl = stadionAnsicht.flug, karten = fl.karten;
    const i = Math.min(karten.length - 1, Math.floor(fl.t / fl.dauer * karten.length));
    const [titel, text] = karten[i];
    const bw = Math.min(W - 24, 260), bh = 46, x = (W - bw) / 2, y = H - bh - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(x, y, 4, bh);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px system-ui, sans-serif'; ctx.fillText(titel, x + 12, y + 7, bw - 20);
    ctx.font = '500 12px system-ui, sans-serif'; ctx.fillStyle = '#e0e0e0'; ctx.fillText(text, x + 12, y + 26, bw - 20);
    stadionAnsicht.szene.flugKarte = i;
}
function stadionRundflug(text) {
    if (!stadionAnsicht) stadion3dNeu();
    const a = stadionAnsicht;
    a.rundflugText = text || '';
    a.flug = { t: 0, dauer: 15, yaw0: a.yaw, karten: stadion3dFlugKarten() };
    a.ziel = null; a.tx = 0; a.ty = 0; a.dist = STADION3D_KAMERAS[0].dist;
    if (stadion3dReduziert()) {
        // Ohne Bewegung: eine Karte nach der anderen, Bild steht
        a.flug.t = 0;
        stadion3dZeichneEinmal();
        clearInterval(a.flugIntervall);
        a.flugIntervall = setInterval(() => {
            if (!a.flug || !stadion3dSichtbar()) { clearInterval(a.flugIntervall); a.flug = null; return; }
            a.flug.t += a.flug.dauer / a.flug.karten.length;
            if (a.flug.t >= a.flug.dauer) { a.flug = null; clearInterval(a.flugIntervall); }
            stadion3dZeichneEinmal();
            stadion3dLeisteAktualisieren();
        }, 2500);
        stadion3dLeisteAktualisieren();
        return;
    }
    stadion3dLeisteAktualisieren();
    stadion3dStarte();
}
function stadion3dFlugSchritt(dt) {
    const a = stadionAnsicht, fl = a.flug;
    fl.t += dt;
    const u = Math.min(1, fl.t / fl.dauer);
    a.yaw = fl.yaw0 + u * Math.PI * 2;
    a.pitch = 0.35 + Math.sin(u * Math.PI) * 0.55;
    a.zoom = 1 + Math.sin(u * Math.PI * 2) * 0.25;
    if (u >= 1) {
        a.flug = null; a.zoom = 1;
        const k = STADION3D_KAMERAS[a.kamera];
        a.ziel = { yaw: k.yaw, pitch: k.pitch, dist: k.dist, tx: k.tx, ty: k.ty };
        stadion3dLeisteAktualisieren();
    }
}

// ---------- Lauf ----------
function stadion3dCanvas() { return document.getElementById('stadion-3d-canvas'); }

function stadion3dGroesse() {
    const c = stadion3dCanvas();
    if (!c) return null;
    const breite = (c.parentElement && c.parentElement.offsetWidth) || 360;
    const fenster = stadionAnsicht && stadionAnsicht.gelaendeFenster;
    const hoehe = fenster ? Math.round(Math.max(260, Math.min(window.innerHeight * 0.6, breite * 1.1, 620)))
        : Math.round(Math.max(220, Math.min(420, breite * 0.68)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(breite * dpr) || c.height !== Math.round(hoehe * dpr)) {
        c.width = Math.round(breite * dpr); c.height = Math.round(hoehe * dpr);
        c.style.height = hoehe + 'px';
    }
    return { W: breite, H: hoehe, dpr };
}

function stadion3dZeichneEinmal() {
    const c = stadion3dCanvas();
    if (!c || !stadionAnsicht || (!stadion3dAn() && !stadionAnsicht.gelaendeFenster)) return;
    const g = stadionAnsicht.groesse || (stadionAnsicht.groesse = stadion3dGroesse());
    if (!g) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    const layout = stadion3dLayout();
    stadionAnsicht.layout = layout;
    stadionAnsicht.P = stadion3dProjektion(g.W, g.H, layout);
    stadion3dZeichnen(ctx, stadionAnsicht.P, layout);
    stadionAnsicht.frames++;
    c.setAttribute('aria-label', stadion3dBeschreibung());
}

function stadion3dBeschreibung() {
    const sp = stadion3dSpiel();
    const quote = Math.round(sp.zuschauer / Math.max(1, sp.kapazitaet) * 100);
    return `${stadium.name || 'Vereinsstadion'}: ${(stadium.total || 0).toLocaleString('de-DE')} Plätze, ${sp.prognose ? 'Prognose' : 'Heimspiel'} ${quote} % ausgelastet` +
        `${stadium.dach ? ', mit Dach' : ''}${stadium.flutlicht ? ', mit Flutlicht' : ''}${(game.stadiumConstructionQueue || []).length ? ', Baustellen offen' : ''}`;
}

function stadion3dSichtbar() {
    // Die Stadionseite liegt im Hub "Ausbau": sichtbar ist sie nur, wenn sie samt Hub im Layout steht
    if (stadionAnsicht && stadionAnsicht.gelaendeFenster) return !document.hidden;
    const sc = document.getElementById('screen-stadium');
    return !!sc && sc.style.display !== 'none' && sc.getClientRects().length > 0 && stadion3dAn() && !document.hidden;
}

// Braucht das Bild Bewegung? Sonst wird nur bei Änderungen gezeichnet
function stadion3dBewegt() {
    const a = stadionAnsicht;
    if (!a || stadion3dReduziert()) return false;
    if (a.flug || a.ziel || a.zeiger.size) return true;
    const w = stadion3dWetter();
    if (w === 'regen' || w === 'schnee' || w === 'sturm') return true;
    if (stadion3dBaustellen().length) return true;
    const k = stadium.blocks && stadium.blocks.kurve;
    if (k && (k.cultureStrength ?? 30) >= 50) return true;
    return a.licht === 'nacht' && !!(stadium.upgrades && stadium.upgrades.lichtshow);
}

function stadion3dFrame(t) {
    const a = stadionAnsicht;
    if (!a || !a.laeuft) return;
    if (!stadion3dSichtbar()) { a.laeuft = false; return; }
    const dt = Math.min(0.05, a.letzterFrame ? (t - a.letzterFrame) / 1000 : 0.016);
    // Höchstens 30 Bilder je Sekunde
    if (a.letzterFrame && t - a.letzterFrame < 30) { requestAnimationFrame(stadion3dFrame); return; }
    a.letzterFrame = t;
    a.zeit += dt;
    if (a.flug) stadion3dFlugSchritt(dt);
    else if (a.ziel) {
        const k = Math.min(1, dt * 6);
        let dy = a.ziel.yaw - a.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        a.yaw += dy * k; a.pitch += (a.ziel.pitch - a.pitch) * k; a.dist += (a.ziel.dist - a.dist) * k;
        a.tx += (a.ziel.tx - a.tx) * k; a.ty += (a.ziel.ty - a.ty) * k;
        if (Math.abs(dy) < 0.002 && Math.abs(a.ziel.pitch - a.pitch) < 0.002 && Math.abs(a.ziel.dist - a.dist) < 0.002 && Math.abs(a.ziel.tx - a.tx) + Math.abs(a.ziel.ty - a.ty) < 0.05) {
            Object.assign(a, { yaw: a.ziel.yaw, pitch: a.ziel.pitch, dist: a.ziel.dist, tx: a.ziel.tx, ty: a.ziel.ty }); a.ziel = null;
        }
    }
    stadion3dZeichneEinmal();
    if (!stadion3dBewegt()) { a.laeuft = false; return; }
    requestAnimationFrame(stadion3dFrame);
}

function stadion3dStarte() {
    const a = stadionAnsicht;
    if (!a || !stadion3dSichtbar()) return;
    if (!stadion3dBewegt()) { stadion3dZeichneEinmal(); return; }
    if (!a.laeuft) { a.laeuft = true; a.letzterFrame = 0; requestAnimationFrame(stadion3dFrame); }
}

// Aus onScreenShown('screen-stadium') und beim Umschalten
function stadionAnsichtAnzeigen() {
    stadion3dUmschalterZeigen();
    if (!stadion3dAn()) return;
    if (!stadionAnsicht) stadion3dNeu();
    stadionAnsicht.groesse = stadion3dGroesse();
    stadion3dEreignisse();
    stadion3dLeisteAktualisieren();
    // Nach einem fertigen Ausbau: Rundflug
    if (game.stadionRundflug) {
        const text = game.stadionRundflug;
        game.stadionRundflug = null;
        stadionRundflug(text);
        return;
    }
    stadion3dZeichneEinmal();
    stadion3dStarte();
}

// Aus renderStadiumView(): ohne Größen zu lesen neu zeichnen
function stadionAnsichtAktualisieren() {
    if (!stadionAnsicht || !stadion3dSichtbar()) return;
    stadion3dLeisteAktualisieren();
    if (!stadionAnsicht.laeuft) stadion3dZeichneEinmal();
    if (stadionAnsicht.blockFenster) stadion3dBlockFensterInhalt();
}

function stadion3dUmschalterZeigen() {
    const an = stadion3dAn();
    const box = document.getElementById('stadion-3d-box'), alt = document.querySelector('#screen-stadium .stadium-hero-visual-wrapper'), k = document.getElementById('stadion-3d-umschalter');
    if (box) box.hidden = !an;
    if (alt) alt.style.display = an ? 'none' : '';
    if (k) k.textContent = an ? '🧩 Klassische Ansicht' : '🎥 Stadionansicht zeigen';
}

function stadion3dUmschalten() {
    safeLocalSet(STADION3D_KEY, stadion3dAn() ? '0' : '1');
    if (stadionAnsicht) stadionAnsicht.laeuft = false;
    stadionAnsichtAnzeigen();
    if (!stadion3dAn() && typeof renderStadiumImmersiveHero === 'function') renderStadiumImmersiveHero();
}

// ---------- Bedienung ----------
function stadionKamera() {
    const a = stadionAnsicht;
    if (!a) return;
    if (a.flug) { showToast('Der Rundflug läuft noch.', 'info'); return; }
    a.kamera = (a.kamera + 1) % STADION3D_KAMERAS.length;
    const k = STADION3D_KAMERAS[a.kamera];
    a.zoom = 1;
    if (stadion3dReduziert()) { Object.assign(a, { yaw: k.yaw, pitch: k.pitch, dist: k.dist, tx: k.tx, ty: k.ty }); a.ziel = null; }
    else a.ziel = { yaw: k.yaw, pitch: k.pitch, dist: k.dist, tx: k.tx, ty: k.ty };
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
    stadion3dStarte();
}

function stadionLicht() {
    const a = stadionAnsicht;
    if (!a) return;
    const i = STADION3D_LICHT.findIndex(l => l.id === a.licht);
    a.licht = STADION3D_LICHT[(i + 1) % STADION3D_LICHT.length].id;
    if (a.licht === 'nacht' && !stadium.flutlicht) showToast('Ohne Flutlicht bleibt es dunkel. Die Flutlichtanlage gibt es unter Spezial-Installationen.', 'info', 3500);
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
    stadion3dStarte();
}

function stadionSpielBlaettern(richtung) {
    const a = stadionAnsicht;
    if (!a) return;
    const liste = stadion3dHeimspiele();
    if (!liste.length) { showToast('Noch kein Heimspiel: die Ränge zeigen die Prognose für das nächste.', 'info'); return; }
    const jetzt = a.spielIdx === null ? liste.length - 1 : a.spielIdx;
    const neu = jetzt + richtung;
    if (neu < 0 || neu >= liste.length) { showToast(richtung < 0 ? 'Das ist das erste Heimspiel.' : 'Das ist das letzte Heimspiel.', 'info'); return; }
    a.spielIdx = neu;
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
}

function stadionRisikoEbene() {
    const a = stadionAnsicht;
    if (!a) return;
    if (!stadion3dRisiko()) { showToast('Die Risiko-Ebene gibt es mit dem Ausschreitungs-System.', 'info'); return; }
    a.risiko = !a.risiko;
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
}

function stadionZoom(faktor) {
    const a = stadionAnsicht;
    if (!a) return;
    a.zoom = Math.max(0.6, Math.min(2.6, a.zoom * faktor));
    stadion3dZeichneEinmal();
}

function stadionDrehen(winkel) {
    const a = stadionAnsicht;
    if (!a || a.flug) return;
    a.yaw += winkel; a.ziel = null;
    stadion3dZeichneEinmal();
}

// Ein Tipp: welcher Block liegt oben?
function stadion3dTreffer(x, y) {
    const a = stadionAnsicht;
    for (let i = a.treffer.length - 1; i >= 0; i--) {
        const pr = a.treffer[i].pr;
        let drin = false;
        for (let j = 0, k = pr.length - 1; j < pr.length; k = j++) {
            if (((pr[j].y > y) !== (pr[k].y > y)) && (x < (pr[k].x - pr[j].x) * (y - pr[j].y) / (pr[k].y - pr[j].y) + pr[j].x)) drin = !drin;
        }
        if (drin) return a.treffer[i].key;
    }
    return null;
}

function stadion3dEreignisse() {
    const c = stadion3dCanvas();
    if (!c || c.dataset.bereit) return;
    c.dataset.bereit = '1';
    const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', e => {
        const a = stadionAnsicht;
        if (!a) return;
        a.zeiger.set(e.pointerId, Object.assign(pos(e), { start: performance.now(), sx: pos(e).x, sy: pos(e).y }));
        if (a.zeiger.size === 2) { const [p, q] = [...a.zeiger.values()]; a.pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), zoom: a.zoom }; }
        if (c.setPointerCapture && e.pointerType === 'mouse') c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', e => {
        const a = stadionAnsicht;
        if (!a || !a.zeiger.has(e.pointerId)) return;
        const alt = a.zeiger.get(e.pointerId), neu = pos(e);
        if (a.zeiger.size === 2 && a.pinch) {
            alt.x = neu.x; alt.y = neu.y;
            const [p, q] = [...a.zeiger.values()];
            a.zoom = Math.max(0.6, Math.min(2.6, a.pinch.zoom * Math.hypot(p.x - q.x, p.y - q.y) / Math.max(10, a.pinch.d)));
        } else if (!a.flug) {
            a.yaw -= (neu.x - alt.x) * 0.008;
            if (e.pointerType === 'mouse') a.pitch = Math.max(0.18, Math.min(1.35, a.pitch + (neu.y - alt.y) * 0.005));
            a.ziel = null;
            alt.x = neu.x; alt.y = neu.y;
        }
        stadion3dZeichneEinmal();
    });
    const ende = e => {
        const a = stadionAnsicht;
        if (!a || !a.zeiger.has(e.pointerId)) return;
        const z = a.zeiger.get(e.pointerId), p = pos(e);
        a.zeiger.delete(e.pointerId);
        if (a.zeiger.size < 2) a.pinch = null;
        if (e.type === 'pointerup' && Math.hypot(p.x - z.sx, p.y - z.sy) < 7 && performance.now() - z.start < 500) {
            const key = stadion3dTreffer(p.x, p.y);
            if (key) stadionBlockOeffnen(key);
        }
        stadion3dStarte();
    };
    c.addEventListener('pointerup', ende);
    c.addEventListener('pointercancel', ende);
    c.addEventListener('wheel', e => { e.preventDefault(); stadionZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
    c.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); stadionDrehen(0.15); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); stadionDrehen(-0.15); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); stadionZoom(1.15); }
        else if (e.key === '-') { e.preventDefault(); stadionZoom(1 / 1.15); }
    });
}

// ---------- Leiste unter dem Bild ----------
function stadion3dLeisteAktualisieren() {
    const a = stadionAnsicht;
    if (!a) return;
    const kam = document.getElementById('stadion-3d-kamera'), licht = document.getElementById('stadion-3d-licht'), ris = document.getElementById('stadion-3d-risiko'), flug = document.getElementById('stadion-3d-flug');
    if (kam) kam.textContent = '🎥 ' + STADION3D_KAMERAS[a.kamera].name;
    if (licht) licht.textContent = (STADION3D_LICHT.find(l => l.id === a.licht) || STADION3D_LICHT[0]).name;
    const gLicht = document.getElementById('stadion-gelaende-licht');
    if (gLicht) gLicht.textContent = (STADION3D_LICHT.find(l => l.id === a.licht) || STADION3D_LICHT[0]).name;
    if (ris) { ris.className = a.risiko ? 'btn-action' : 'btn-secondary'; ris.setAttribute('aria-pressed', a.risiko ? 'true' : 'false'); }
    if (flug) flug.textContent = a.flug ? '🎬 Rundflug läuft' : '🎬 Rundflug';
    const info = document.getElementById('stadion-3d-info');
    if (info) {
        const sp = stadion3dSpiel();
        const quote = Math.round(sp.zuschauer / Math.max(1, sp.kapazitaet) * 100);
        const chips = [];
        const choreo = stadion3dChoreo();
        if (choreo) chips.push(uiChip('🎌 ' + choreo, 'gut'));
        const bau = stadion3dBaustellen().length;
        if (bau) chips.push(uiChip(`🏗️ ${bau} ${bau === 1 ? 'Baustelle' : 'Baustellen'}`, 'warn'));
        if (a.licht === 'nacht' && !stadium.flutlicht) chips.push(uiChip('Kein Flutlicht', 'schlecht'));
        const wetter = typeof currentWeather !== 'undefined' && currentWeather ? currentWeather.icon + ' ' + currentWeather.name : '';
        if (wetter) chips.push(uiChip(wetter));
        let risikoText = '';
        if (a.risiko) {
            const r = stadion3dRisiko();
            risikoText = r && r.spiel ? `<div style="margin-top:3px;">⚠️ Risiko je Block für ${mpEscStadion(r.spiel.gegner)} (${r.spiel.heim ? 'Heim' : 'Auswärts'}): ${(Math.round(r.chance * 1000) / 10).toLocaleString('de-DE')} % <span style="color:var(--text-muted);">· grün ruhig, rot hoch</span></div>` : '<div style="margin-top:3px;">⚠️ Gerade steht kein Ligaspiel an.</div>';
        }
        info.innerHTML = `<div><strong>${sp.prognose ? 'Prognose nächstes Heimspiel' : `Heimspiel ${sp.index + 1} von ${sp.anzahl}`}</strong>${sp.gegner ? ` gegen ${mpEscStadion(sp.gegner)}` : ''}${!sp.prognose && sp.matchday ? ` <span style="color:var(--text-muted);">(Saison ${sp.season}, ${sp.matchday}. Spieltag)</span>` : ''}</div>
            <div>${(sp.zuschauer || 0).toLocaleString('de-DE')} von ${(sp.kapazitaet || 0).toLocaleString('de-DE')} Plätzen · ${quote} % Auslastung</div>
            ${risikoText}
            ${chips.length ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${chips.join('')}</div>` : ''}`;
    }
    const vb = document.getElementById('stadion-3d-vorschau');
    if (vb) {
        const v = a.vorschau, b = v && stadium.blocks[v.blockKey];
        vb.hidden = !b;
        if (b) {
            const lbl = document.getElementById('stadion-3d-vorschau-text');
            if (lbl) lbl.textContent = `${b.name}: ${b.cap.toLocaleString('de-DE')} → ${(b.cap + Math.round(b.addSeats * v.mix)).toLocaleString('de-DE')} Plätze`;
            const r = document.getElementById('stadion-3d-vorschau-regler');
            if (r && Number(r.value) !== Math.round(v.mix * 100)) r.value = Math.round(v.mix * 100);
        }
    }
}
function mpEscStadion(t) { return typeof mpEsc === 'function' ? mpEsc(t) : String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Block-Fenster und Vorschau ----------
function stadionBlockOeffnen(key) {
    const b = stadium.blocks && stadium.blocks[key];
    const g = !b ? stadion3dGelaendeEintrag(key) : null;
    if ((!b && !g) || !stadionAnsicht) return;
    stadionAnsicht.auswahl = key;
    stadionAnsicht.blockFenster = key;
    stadion3dBlockFensterInhalt(true);
    const ov = document.getElementById('stadion-block-overlay');
    if (ov) { ov.setAttribute('aria-label', b ? b.name : g.name); ov.classList.add('show'); }
    if (typeof mpFokusHalten === 'function') mpFokusHalten('stadion-block-overlay');
    stadion3dZeichneEinmal();
}

// Gebäude des Vereinsgeländes nach seiner Kennung (campus:…, immo:…, jugend)
function stadion3dGelaendeEintrag(id) {
    if (!stadionAnsicht) return null;
    const layout = stadionAnsicht.layout || stadion3dLayout();
    return stadion3dGelaendePlan(layout).find(g => g.id === id) || null;
}

function stadion3dGelaendeFensterInhalt(box, g) {
    const ziel = g.ziel && document.getElementById(g.ziel) ? g.ziel : null;
    const zielName = { 'screen-campus': 'Zum Campus', 'screen-youth': 'Zur Jugend', 'screen-real-estate': 'Zu den Immobilien' }[ziel] || 'Zur Seite';
    box.innerHTML = `<div class="panel-header">${g.icon || '🏗️'} ${mpEscStadion(g.name)}</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">
            ${uiChip(g.lvl ? `Stufe ${g.lvl}/${g.max}` : 'Noch nicht gebaut', g.lvl ? 'gut' : '')}
            ${g.bau ? uiChip(`🏗️ Im Bau: noch ${g.bau.daysLeft} Spieltage`, 'warn') : ''}
        </div>
        <div style="font-size:var(--fs-small); margin-bottom:6px;">${mpEscStadion(g.desc || '')}</div>
        ${ziel ? `<button onclick="schliesseStadionBlock(); stadionGelaendeSchliessen(); showScreen('${ziel}')" class="btn-action">➜ ${zielName}</button>` : ''}`;
}

function stadion3dBlockFensterInhalt(mitKlang) {
    const key = stadionAnsicht && stadionAnsicht.blockFenster;
    const b = key && stadium.blocks[key];
    const box = document.getElementById('stadion-block-inhalt');
    if (!b && key && box) { const g = stadion3dGelaendeEintrag(key); if (g) stadion3dGelaendeFensterInhalt(box, g); return; }
    if (!b || !box) return;
    const sp = stadion3dSpiel();
    const f = Math.round((stadion3dFuellung(sp)[key] || 0) * 100);
    const r = stadion3dRisiko();
    const risiko = r && r.spiel ? Math.round((r.je[key] || 0) * 1000) / 10 : null;
    const bau = (game.stadiumConstructionQueue || []).filter(p => p.params && p.params.blockKey === key);
    const kultur = typeof b.cultureStrength === 'number' ? Math.round(b.cultureStrength) : null;
    box.innerHTML = `<div class="panel-header">🏟️ ${mpEscStadion(b.name)}</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">
            ${uiChip(`${b.cap.toLocaleString('de-DE')} Plätze`)}
            ${uiChip(`${f} % besetzt${sp.prognose ? ' (Prognose)' : ''}`, f >= 80 ? 'gut' : (f >= 45 ? 'warn' : 'schlecht'))}
            ${uiChip(`Ausbau ${b.expansions}/5`)}
            ${kultur !== null ? uiChip(`Fankultur ${kultur}`, kultur >= 50 ? 'gut' : '') : ''}
            ${risiko !== null ? uiChip(`Risiko ${risiko.toLocaleString('de-DE')} %`, risiko <= 0 ? 'gut' : (risiko < 3 ? 'warn' : 'schlecht')) : ''}
        </div>
        ${bau.length ? `<div class="box" style="font-size:var(--fs-caption);">🏗️ ${bau.map(p => `${mpEscStadion(p.label)}: noch ${p.daysLeft} Spieltage`).join('<br>')}</div>` : ''}
        ${b.expansions < 5 ? `<button onclick="stadionVorschauStarten('${key}')" class="btn-secondary" style="margin:4px 0;">👁️ Ausbau im Bild zeigen (+${(b.addSeats || 0).toLocaleString('de-DE')} Plätze)</button>` : ''}
        <div id="stadion-block-aktionen" class="box"></div>`;
    if (typeof selectStadiumBlock === 'function') selectStadiumBlock(key, 'stadion-block-aktionen', !mitKlang);
}

function schliesseStadionBlock() {
    const ov = document.getElementById('stadion-block-overlay');
    if (ov) ov.classList.remove('show');
    if (stadionAnsicht) { stadionAnsicht.blockFenster = null; if (!stadionAnsicht.vorschau) stadionAnsicht.auswahl = null; }
    stadion3dZeichneEinmal();
    const c = stadion3dCanvas();
    if (c) c.focus();
}

function stadionVorschauStarten(key) {
    const b = stadium.blocks && stadium.blocks[key];
    if (!b || !stadionAnsicht) return;
    if (b.expansions >= 5) { showToast('Dieser Block ist voll ausgebaut.', 'info'); return; }
    stadionAnsicht.vorschau = { blockKey: key, mix: 1 };
    stadionAnsicht.auswahl = key;
    schliesseStadionBlock();
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
}

function stadionVorschauRegler(wert) {
    if (!stadionAnsicht || !stadionAnsicht.vorschau) return;
    stadionAnsicht.vorschau.mix = Math.max(0, Math.min(1, Number(wert) / 100));
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
}

function stadionVorschauEnde() {
    if (!stadionAnsicht) return;
    stadionAnsicht.vorschau = null;
    stadionAnsicht.auswahl = null;
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
}

window.addEventListener('resize', () => { if (stadionAnsicht && stadion3dSichtbar()) { stadionAnsicht.groesse = stadion3dGroesse(); stadion3dZeichneEinmal(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && stadionAnsicht && stadion3dSichtbar()) stadion3dStarte(); });

// ---------- Vereinsgelände im eigenen Fenster ----------
// Dieselbe Canvas wandert ins Fenster (#stadion-gelaende-overlay) und zeigt das ganze Gelände; beim Schließen kehrt sie
// mit der vorigen Kamera zurück auf die Stadionseite. So gibt es nur eine Ansicht, und auch vom Campus aus geht es.
function stadionGelaendeOeffnen() {
    const c = stadion3dCanvas(), platz = document.getElementById('stadion-gelaende-platz'), ov = document.getElementById('stadion-gelaende-overlay');
    if (!c || !platz || !ov) return;
    if (!stadionAnsicht) stadion3dNeu();
    const a = stadionAnsicht;
    if (!a.gelaendeFenster) {
        a.vorFenster = { kamera: a.kamera, yaw: a.yaw, pitch: a.pitch, dist: a.dist, tx: a.tx, ty: a.ty, zoom: a.zoom, flug: null };
        a.flug = null; a.ziel = null;
        Object.assign(a, STADION3D_GELAENDE_KAMERA, { zoom: 1 });
        a.gelaendeFenster = true;
        c.hidden = false;
        platz.appendChild(c);
    }
    ov.classList.add('show');
    stadion3dEreignisse();
    a.groesse = stadion3dGroesse();
    stadion3dGelaendeListe();
    stadion3dLeisteAktualisieren();
    stadion3dZeichneEinmal();
    stadion3dStarte();
    if (typeof mpFokusHalten === 'function') mpFokusHalten('stadion-gelaende-overlay');
}

function stadionGelaendeSchliessen() {
    const ov = document.getElementById('stadion-gelaende-overlay');
    if (ov) ov.classList.remove('show');
    const a = stadionAnsicht;
    if (!a || !a.gelaendeFenster) return;
    a.gelaendeFenster = false;
    a.laeuft = false;
    if (a.vorFenster) Object.assign(a, a.vorFenster);
    a.auswahl = null;
    const c = stadion3dCanvas(), box = document.getElementById('stadion-3d-box');
    if (c && box) box.insertBefore(c, box.firstChild);
    if (stadion3dSichtbar()) { a.groesse = stadion3dGroesse(); stadion3dZeichneEinmal(); stadion3dStarte(); }
    else a.groesse = null;
}

// Liste unter dem Bild: jedes Gebäude als Knopf (auch ohne Tippen ins Bild erreichbar)
function stadion3dGelaendeListe() {
    const box = document.getElementById('stadion-gelaende-liste');
    if (!box || !stadionAnsicht) return;
    const plan = stadion3dGelaendePlan(stadionAnsicht.layout || stadion3dLayout());
    const gebaut = plan.filter(g => g.lvl > 0 || g.bau);
    box.innerHTML = `<div style="margin-bottom:4px;">${gebaut.length} ${gebaut.length === 1 ? 'Anlage' : 'Anlagen'} auf dem Gelände${plan.filter(g => g.bau).length ? `, ${plan.filter(g => g.bau).length} im Bau` : ''}. Weitere Gebäude baust du im Campus und bei den Immobilien.</div>
        <div class="stadion-gelaende-knoepfe">${gebaut.map(g => `<button onclick="stadionBlockOeffnen('${g.id}')" class="btn-secondary">${g.icon || '🏗️'} ${mpEscStadion(String(g.name).replace(/\s*['"„].*$/, ''))} ${g.lvl ? `· ${g.lvl}` : '· im Bau'}</button>`).join('')}</div>`;
}

// ---------- Stadionbild im Dashboard ----------
// Ein Standbild des eigenen Stadions oben im Dashboard (#dash-stadion-canvas): dieselbe Zeichnung wie auf der Stadionseite
// mit fester Kamera. Die Canvas hat eine feste Auflösung (720 x 380), es werden keine Größen gelesen; der Zustand der
// Stadionansicht (Kamera, Auswahl, Treffer) bleibt unberührt.
const STADION3D_DASHBOARD_KAMERA = { yaw: 0.62, pitch: 0.78, dist: 2.05, tx: 0, ty: 0, zoom: 1 };
function stadionDashboardZeichnen() {
    const c = document.getElementById('dash-stadion-canvas');
    const ctx = c && c.getContext ? c.getContext('2d') : null;
    if (!ctx) return false;
    if (!stadionAnsicht) stadion3dNeu();
    const a = stadionAnsicht;
    const felder = ['yaw', 'pitch', 'dist', 'tx', 'ty', 'zoom', 'auswahl', 'vorschau', 'risiko', 'flug', 'szene', 'treffer', 'layout', 'P'];
    const vorher = {};
    felder.forEach(k => { vorher[k] = a[k]; });
    try {
        Object.assign(a, STADION3D_DASHBOARD_KAMERA, { auswahl: null, vorschau: null, risiko: false, flug: null, szene: {}, treffer: [] });
        const W = 360, H = 190;
        ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
        const layout = stadion3dLayout();
        stadion3dZeichnen(ctx, stadion3dProjektion(W, H, layout), layout);
        c.setAttribute('aria-label', stadion3dBeschreibung());
        c.dataset.stufe = layout.stufe;
    } finally {
        felder.forEach(k => { a[k] = vorher[k]; });
    }
    return true;
}
