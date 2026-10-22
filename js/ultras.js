// Fanszene (Ultras): eigene Gruppe des Vereins mit Mitgliedern, XP und Level, vier Fähigkeiten,
// Ausrüstung, eigener Gruppenkasse (getrennt vom Vereinskonto) und Duellen gegen die Gruppen anderer
// Vereine. Das Duell läuft als Canvas-Kampf über drei Runden, in jeder Runde wählt der Spieler die Taktik.
// Wirkung: Stimmung und Heimstärke (calcTeamStrength über getUltrasStaerkeBonus), Ausschreitungsrisiko
// (getUltrasRisikoFaktor in js/ausschreitungen.js), Stimmung der Fangruppe „ultras“ in js/fans.js.
// Ticks: ultrasSpieltagTick() aus processPostMatchRoutine(), ultrasMonatsTick() aus runMonthlyClubTicks().

const ULTRAS_AKTIONEN_PRO_SPIELTAG = 2;
const ULTRAS_RUNDEN = 3;
const ULTRAS_RUNDEN_DAUER = 1400;   // ms je Kampfrunde im Canvas
const ULTRAS_DUELL_ANREISE = 300;
const ULTRAS_KAUTION = 1500;        // je Festnahme
const ULTRAS_MITGLIEDSBEITRAG = 4;  // je aktivem Mitglied und Monat

const ULTRAS_SKILLS = [
    { key: 'anfeuern', name: 'Anfeuern', text: 'Stimmung im Block, Bonus für die Heimstärke.' },
    { key: 'choreo', name: 'Choreografie', text: 'Choreos gelingen öfter und wirken stärker.' },
    { key: 'organisation', name: 'Organisation', text: 'Weniger Ausschreitungen, Gästeblock billiger.' },
    { key: 'kampf', name: 'Straßenkampf', text: 'Mehr Kampfwert in Duellen gegen andere Gruppen.' }
];
const ULTRAS_SKILL_MAX = 5;

const ULTRAS_AUSRUESTUNG = [
    { key: 'fahnen', name: 'Fahnen & Banner', preis: 1500, max: 3, text: 'Erleichtert Choreos.' },
    { key: 'trommeln', name: 'Trommeln & Megafone', preis: 1200, max: 3, text: 'Verstärkt das Anfeuern am Heimspiel.' },
    { key: 'schutz', name: 'Schutzausrüstung', preis: 2000, max: 3, text: 'Weniger Verletzte in Duellen.' },
    { key: 'funk', name: 'Funkgeräte', preis: 2500, max: 2, text: 'Bessere Abstimmung im Duell.' },
    { key: 'pyro', name: 'Pyro-Lager (3 Bengalos)', preis: 1800, max: 99, text: 'Verbrauchsgut. Erhöht das Risiko im nächsten Spiel.' }
];

const ULTRAS_AKTIONEN = {
    anfeuern: { name: 'Anfeuern', kosten: 0, xp: 5, text: 'Der Block singt durchgehend. Stimmung steigt.' },
    choreo: { name: 'Choreografie', kosten: 1200, xp: 15, text: 'Eine Choreo im Block. Gelingt sie, steigen Stimmung und Ansehen.' },
    pyro: { name: 'Pyro zünden', kosten: 0, xp: 8, text: 'Bengalos im Block. Stimmung steigt stark, das nächste Spiel wird riskanter.' },
    werben: { name: 'Mitglieder werben', kosten: 150, xp: 5, text: 'Neue Mitglieder in der Szene gewinnen.' },
    gaesteblock: { name: 'Gästeblock organisieren', kosten: 600, xp: 10, text: 'Bus zum nächsten Auswärtsspiel. Nur vor einem Auswärtsspiel möglich.' },
    duell: { name: 'Duell herausfordern', kosten: ULTRAS_DUELL_ANREISE, xp: 0, text: 'Kampf gegen die Gruppe eines anderen Vereins.' }
};

const ULTRAS_TAKTIKEN = {
    vorstoss: { name: 'Vorstoß', angriff: 1.3, verlust: 0.14, festnahme: 1.5, text: 'Volle Attacke: hoher Druck, viele Verletzte, Festnahmen wahrscheinlicher.' },
    halten: { name: 'Halten', angriff: 1.0, verlust: 0.07, festnahme: 1.0, text: 'Block zusammenhalten, ausgewogen.' },
    rueckzug: { name: 'Rückzug', angriff: 0.6, verlust: 0.02, festnahme: 0.4, text: 'Kaum Verletzte, aber wenig Druck.' }
};

const ULTRAS_GEGNER_NAMEN = ['Rote Front', 'Blaue Garde', 'Wilde Meute', 'Südsturm', 'Die Unbeugsamen', 'Schwarze Legion', 'Hafenbande', 'Kurve 1893'];

// Laufende Kampf- und Choreo-Ansicht; nicht gespeichert.
let ultrasDuell = null;
let ultrasChoreo = null;
let ultrasFrameId = null;
let ultrasLetzterTs = null;

function ensureUltrasState() {
    if (!game.ultras) game.ultras = {};
    const u = game.ultras;
    const standard = {
        name: `Szene ${game.clubName || ''}`.trim(), xp: 0, level: 1, skillPunkte: 0,
        mitglieder: 40, stimmung: 60, ansehen: 30, kasse: 5000,
        polizei: 0, akten: 0, verletzte: [], skills: {}, ausruestung: {},
        aktionen: { schluessel: '', anzahl: 0 }, pyroNaechstesSpiel: false, gaesteblock: null,
        bilanz: {}, chronik: []
    };
    Object.keys(standard).forEach(k => { if (u[k] === undefined) u[k] = standard[k]; });
    ULTRAS_SKILLS.forEach(s => { if (typeof u.skills[s.key] !== 'number') u.skills[s.key] = 1; });
    ULTRAS_AUSRUESTUNG.forEach(a => { if (typeof u.ausruestung[a.key] !== 'number') u.ausruestung[a.key] = 0; });
    if (!Array.isArray(u.verletzte)) u.verletzte = [];
    if (!Array.isArray(u.chronik)) u.chronik = [];
    return u;
}

function ultrasSkill(key) { return ensureUltrasState().skills[key] || 0; }
function ultrasAusruestung(key) { return ensureUltrasState().ausruestung[key] || 0; }
function ultrasAktiv() {
    const u = ensureUltrasState();
    const verletzt = u.verletzte.reduce((s, v) => s + v.anzahl, 0);
    return Math.max(0, u.mitglieder - verletzt);
}
function ultrasXpSchwelle(lvl) { return 50 * lvl * lvl; }

function ultrasChronik(text, ton = '') {
    const u = ensureUltrasState();
    u.chronik.unshift({ season: game.season, matchday: game.matchday, text, ton });
    if (u.chronik.length > 40) u.chronik.length = 40;
}

function ultrasXpGeben(menge) {
    const u = ensureUltrasState();
    u.xp += menge;
    let aufgestiegen = false;
    while (u.xp >= ultrasXpSchwelle(u.level)) {
        u.xp -= ultrasXpSchwelle(u.level);
        u.level++;
        u.skillPunkte++;
        aufgestiegen = true;
    }
    if (aufgestiegen) {
        ultrasChronik(`Level ${u.level} erreicht. Ein Fähigkeitspunkt ist frei.`, 'gut');
        showToast(`📣 Die Szene steigt auf Level ${u.level} auf.`, 'success');
    }
}

function ultrasKlemme(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Aktionen je Spieltag: höchstens ULTRAS_AKTIONEN_PRO_SPIELTAG, pro Spieltag gezählt.
function ultrasAktionenFrei() {
    const u = ensureUltrasState();
    const schluessel = `${game.season}-${game.matchday}`;
    if (u.aktionen.schluessel !== schluessel) return ULTRAS_AKTIONEN_PRO_SPIELTAG;
    return ULTRAS_AKTIONEN_PRO_SPIELTAG - u.aktionen.anzahl;
}
function ultrasAktionVerbrauchen() {
    const u = ensureUltrasState();
    const schluessel = `${game.season}-${game.matchday}`;
    if (u.aktionen.schluessel !== schluessel) u.aktionen = { schluessel, anzahl: 0 };
    u.aktionen.anzahl++;
}

// Gruppe eines fremden Vereins: fest aus dem Namen abgeleitet, damit sie jedes Mal gleich ist.
function ultrasGegnerGruppe(verein) {
    let h = 0;
    for (const c of String(verein)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const mitglieder = 25 + (h % 30);
    return {
        name: ULTRAS_GEGNER_NAMEN[h % ULTRAS_GEGNER_NAMEN.length],
        mitglieder,
        aktiv: mitglieder,
        kampf: 1 + ((h >> 3) % 4),
        schutz: (h >> 5) % 3
    };
}

function ultrasAktionAusfuehren(key, parameter) {
    const u = ensureUltrasState();
    const a = ULTRAS_AKTIONEN[key];
    if (!a) return;
    if (ultrasAktionenFrei() <= 0) { showToast(`Heute sind schon ${ULTRAS_AKTIONEN_PRO_SPIELTAG} Aktionen gelaufen. Nächster Spieltag.`, 'info'); return; }
    if (u.kasse < a.kosten) { showToast(`Die Gruppenkasse reicht nicht: ${formatVal(a.kosten)} nötig.`, 'error'); return; }
    const sparfaktor = 1 - ultrasSkill('organisation') * 0.05;
    const kosten = key === 'gaesteblock' ? Math.round(a.kosten * sparfaktor) : a.kosten;
    const erfolgreich = (() => {
        switch (key) {
            case 'anfeuern': {
                u.stimmung = ultrasKlemme(u.stimmung + 6 + ultrasSkill('anfeuern'), 0, 100);
                return { text: 'Der Block singt durchgehend.' };
            }
            case 'choreo': {
                const chance = ultrasKlemme(0.5 + ultrasSkill('choreo') * 0.08 + ultrasAusruestung('fahnen') * 0.05 - u.polizei / 400, 0.1, 0.95);
                const gelungen = Math.random() < chance;
                u.kasse -= kosten;
                if (gelungen) {
                    u.stimmung = ultrasKlemme(u.stimmung + 12, 0, 100);
                    u.ansehen = ultrasKlemme(u.ansehen + 4, 0, 100);
                    ultrasChronik('Choreo gelungen: Der Block steht geschlossen.', 'gut');
                } else {
                    u.stimmung = ultrasKlemme(u.stimmung - 3, 0, 100);
                    u.polizei = ultrasKlemme(u.polizei + 3, 0, 100);
                    ultrasChronik('Choreo missglückt: Die Ordner haben die Fahnen konfisziert.', 'schlecht');
                }
                ultrasChoreo = { start: null, erfolg: gelungen, dauer: 2600 };
                return { text: gelungen ? 'Choreo gelungen.' : 'Choreo missglückt.', gelungen };
            }
            case 'pyro': {
                if (u.ausruestung.pyro <= 0) { showToast('Kein Pyro im Lager. Im Ausrüstungs-Laden gibt es Nachschub.', 'error'); return null; }
                if (u.pyroNaechstesSpiel) { showToast('Fürs nächste Spiel liegt schon Pyro bereit.', 'info'); return null; }
                u.ausruestung.pyro--;
                u.pyroNaechstesSpiel = true;
                u.stimmung = ultrasKlemme(u.stimmung + 10, 0, 100);
                u.polizei = ultrasKlemme(u.polizei + 8, 0, 100);
                ultrasChronik('Bengalos im Block gezündet.', 'warn');
                return { text: 'Bengalos gezündet.' };
            }
            case 'werben': {
                u.kasse -= kosten;
                const neu = 1 + Math.floor(u.ansehen / 40) + (ultrasSkill('organisation') >= 3 ? 1 : 0);
                u.mitglieder = Math.min(200, u.mitglieder + neu);
                return { text: `${neu} neue Mitglieder.` };
            }
            case 'gaesteblock': {
                const naechstes = typeof ausschreitungNaechstesSpiel === 'function' ? ausschreitungNaechstesSpiel() : null;
                if (!naechstes) { showToast('Gerade steht kein Ligaspiel an.', 'info'); return null; }
                if (naechstes.heim) { showToast('Der Gästeblock braucht ein Auswärtsspiel. Das nächste Spiel ist daheim.', 'info'); return null; }
                if (u.gaesteblock) { showToast('Der Bus fürs nächste Spiel ist schon gebucht.', 'info'); return null; }
                u.kasse -= kosten;
                u.gaesteblock = { season: game.season, matchday: game.matchday };
                return { text: `Bus nach ${naechstes.gegner} gebucht.` };
            }
            case 'duell': {
                if (ultrasDuell) { showToast('Ein Duell läuft schon.', 'info'); return null; }
                if (!parameter) { showToast('Wähle zuerst eine Gruppe aus.', 'info'); return null; }
                if (ultrasAktiv() < 5) { showToast('Für ein Duell braucht die Szene mindestens fünf aktive Mitglieder.', 'error'); return null; }
                u.kasse -= kosten;
                ultrasStarteDuell(parameter);
                return { text: '', ohneToast: true };
            }
        }
        return null;
    })();
    if (!erfolgreich) return;
    ultrasAktionVerbrauchen();
    if (a.xp) ultrasXpGeben(a.xp);
    if (!erfolgreich.ohneToast) showToast(`${a.name}: ${erfolgreich.text}`, erfolgreich.gelungen === false ? 'error' : 'success');
    renderUltrasScreen();
    if (ultrasChoreo) ultrasStarteLoop();
    if (typeof updateUI === 'function') updateUI();
}

function ultrasFaehigkeitSteigern(key) {
    const u = ensureUltrasState();
    if (u.skillPunkte <= 0) { showToast('Keine freien Fähigkeitspunkte. Die Szene braucht mehr XP.', 'info'); return; }
    if (u.skills[key] >= ULTRAS_SKILL_MAX) { showToast('Diese Fähigkeit ist schon auf dem Maximum.', 'info'); return; }
    u.skillPunkte--;
    u.skills[key]++;
    ultrasChronik(`Fähigkeit ${ULTRAS_SKILLS.find(s => s.key === key).name} auf Stufe ${u.skills[key]}.`, 'gut');
    renderUltrasScreen();
}

function ultrasAusruestungKaufen(key) {
    const u = ensureUltrasState();
    const a = ULTRAS_AUSRUESTUNG.find(x => x.key === key);
    if (!a) return;
    if (key !== 'pyro' && u.ausruestung[key] >= a.max) { showToast(`${a.name} ist schon auf dem Maximum.`, 'info'); return; }
    if (u.kasse < a.preis) { showToast(`Die Gruppenkasse reicht nicht: ${formatVal(a.preis)} nötig.`, 'error'); return; }
    u.kasse -= a.preis;
    u.ausruestung[key] += key === 'pyro' ? 3 : 1;
    ultrasChronik(`Ausrüstung gekauft: ${a.name}.`, '');
    renderUltrasScreen();
}

// Canvas-Duell ----------------------------------------------------------------

function ultrasStarteDuell(verein) {
    ultrasDuell = {
        gegner: verein, gruppe: ultrasGegnerGruppe(verein),
        gespielt: 0, siege: 0, niederlagen: 0, verletzt: 0, festnahmen: 0,
        phase: 'wahl', anim: 0, verlauf: [], ergebnis: null,
        aktivStart: ultrasAktiv(), letzteTaktik: null
    };
    ultrasChronik(`Duell gegen die Gruppe ${ultrasDuell.gruppe.name} (${verein}) angesetzt.`, '');
    renderUltrasScreen();
    ultrasStarteLoop();
    showToast(`⚔️ Duell gegen ${ultrasDuell.gruppe.name} beginnt.`, 'info');
}

function ultrasWaehleTaktik(taktikKey) {
    const d = ultrasDuell;
    if (!d || d.phase !== 'wahl' || !ULTRAS_TAKTIKEN[taktikKey]) return;
    const u = ensureUltrasState();
    const t = ULTRAS_TAKTIKEN[taktikKey];
    const gegnerKeys = Object.keys(ULTRAS_TAKTIKEN);
    const gKey = gegnerKeys[Math.floor(Math.random() * gegnerKeys.length)];
    const g = ULTRAS_TAKTIKEN[gKey];
    const zufall = () => 0.85 + Math.random() * 0.3;

    const funk = 1 + u.ausruestung.funk * 0.05;
    const eigenKraft = ultrasAktiv() * (1 + ultrasSkill('kampf') * 0.12) * t.angriff * funk * zufall();
    const gegnerKraft = d.gruppe.aktiv * (1 + d.gruppe.kampf * 0.12) * g.angriff * zufall();
    const sieg = eigenKraft >= gegnerKraft;

    const schutz = 1 - u.ausruestung.schutz * 0.15;
    const verletzt = Math.round(ultrasAktiv() * t.verlust * (0.5 + Math.random()) * schutz * (sieg ? 0.8 : 1.2));
    const gegnerVerletzt = Math.round(d.gruppe.aktiv * g.verlust * (0.5 + Math.random()) * (sieg ? 1.2 : 0.8));
    const festnahmeChance = ultrasKlemme((0.08 + u.polizei / 400) * t.festnahme, 0, 0.6);
    const festnahmen = Math.random() < festnahmeChance ? 1 : 0;

    d.verletzt += verletzt;
    d.festnahmen += festnahmen;
    d.gruppe.aktiv = Math.max(0, d.gruppe.aktiv - gegnerVerletzt);
    if (sieg) d.siege++; else d.niederlagen++;
    d.gespielt++;
    d.letzteTaktik = taktikKey;
    d.verlauf.push({ runde: d.gespielt, taktik: taktikKey, gegnerTaktik: gKey, sieg, verletzt, gegnerVerletzt, festnahmen });
    d.phase = 'anim';
    d.anim = 0;
    renderUltrasScreen();
    ultrasStarteLoop();
}

function ultrasDuellEnde() {
    const d = ultrasDuell;
    const u = ensureUltrasState();
    const ergebnis = d.siege > d.niederlagen ? 'sieg' : (d.siege < d.niederlagen ? 'niederlage' : 'unentschieden');
    const ansehenDelta = { sieg: 8, unentschieden: 2, niederlage: -6 }[ergebnis];
    const xp = { sieg: 40, unentschieden: 20, niederlage: 15 }[ergebnis];
    u.ansehen = ultrasKlemme(u.ansehen + ansehenDelta, 0, 100);
    if (d.verletzt > 0) u.verletzte.push({ anzahl: d.verletzt, monate: 2 });
    if (d.festnahmen > 0) {
        u.akten += d.festnahmen;
        u.polizei = ultrasKlemme(u.polizei + 6 * d.festnahmen, 0, 100);
        const kaution = Math.min(u.kasse, ULTRAS_KAUTION * d.festnahmen);
        u.kasse -= kaution;
    }
    const bilanz = u.bilanz[d.gegner] || { s: 0, n: 0, u: 0 };
    if (ergebnis === 'sieg') bilanz.s++; else if (ergebnis === 'niederlage') bilanz.n++; else bilanz.u++;
    u.bilanz[d.gegner] = bilanz;
    const text = { sieg: 'gewonnen', niederlage: 'verloren', unentschieden: 'unentschieden' }[ergebnis];
    ultrasChronik(`Duell gegen ${d.gruppe.name} (${d.gegner}) ${text}: ${d.siege}:${d.niederlagen}, ${d.verletzt} Verletzte, ${d.festnahmen} Festnahme(n).`, ergebnis === 'niederlage' ? 'schlecht' : (ergebnis === 'sieg' ? 'gut' : ''));
    ultrasXpGeben(xp);
    if (u.akten >= 3) ultrasStadionverbot();
    d.ergebnis = ergebnis;
    d.phase = 'ende';
    showNotice('⚔️ Duell ' + text, `Gegen ${d.gruppe.name}: ${d.siege}:${d.niederlagen} in Runden.\n\nAnsehen ${ansehenDelta >= 0 ? '+' : ''}${ansehenDelta}. Verletzte: ${d.verletzt}. Festnahmen: ${d.festnahmen}.`, { typ: ergebnis === 'niederlage' ? 'warn' : 'info' });
    renderUltrasScreen();
}

function ultrasStadionverbot() {
    const u = ensureUltrasState();
    if (u.mitglieder <= 5) return;
    u.akten -= 3;
    u.mitglieder--;
    ultrasChronik('Ein Mitglied bekommt ein Stadionverbot nach drei Akten.', 'schlecht');
}

// Ticks ------------------------------------------------------------------------

function ultrasSpieltagTick(ctx) {
    const u = ensureUltrasState();
    const heim = !!ctx.heim;
    if (heim) {
        // Merchandise und Stehplatzerlöse der Szene gehen in die Gruppenkasse.
        u.kasse += Math.round(ultrasAktiv() * 0.6 * (1 + u.ansehen / 200));
    }
    if (u.gaesteblock) {
        if (!heim) {
            u.ansehen = ultrasKlemme(u.ansehen + 3, 0, 100);
            u.stimmung = ultrasKlemme(u.stimmung + 5, 0, 100);
            ultrasXpGeben(10);
            ultrasChronik(`Gästeblock bei ${ctx.gegner || 'dem Gegner'}: der Block hat mitgesungen.`, 'gut');
        }
        u.gaesteblock = null;
    }
    if (u.pyroNaechstesSpiel) u.pyroNaechstesSpiel = false;
    // Ausschreitung dieses Spieltags aus js/ausschreitungen.js der Szene zurechnen (nur einmal).
    const letzte = (game.ausschreitungen || [])[0];
    if (letzte && !letzte.ultrasVerarbeitet && letzte.season === game.season && letzte.matchday === game.matchday) {
        letzte.ultrasVerarbeitet = true;
        const schwer = letzte.stufe === 'schwer';
        const krawall = letzte.stufe === 'krawall';
        u.polizei = ultrasKlemme(u.polizei + (schwer ? 20 : (krawall ? 12 : 4)), 0, 100);
        if (krawall || schwer) {
            u.akten++;
            if (schwer) u.verletzte.push({ anzahl: Math.min(u.mitglieder, 2), monate: 1 });
            ultrasChronik(`${letzte.stufe === 'schwer' ? 'Schwere Ausschreitungen' : 'Krawall'} gegen ${letzte.gegner || 'den Gegner'}: Polizeiakte.`, 'schlecht');
        }
    }
    u.stimmung = Math.round(u.stimmung + (55 - u.stimmung) * 0.1);
    ultrasXpGeben(10);
    // Die Fangruppe „ultras“ in js/fans.js folgt der Szene.
    const gruppe = typeof fanGroups !== 'undefined' ? fanGroups.find(g => g.id === 'ultras') : null;
    if (gruppe) gruppe.mood = ultrasKlemme(Math.round(gruppe.mood + (u.stimmung - gruppe.mood) * 0.15), 0, 100);
}

function ultrasMonatsTick() {
    const u = ensureUltrasState();
    u.kasse += ultrasAktiv() * ULTRAS_MITGLIEDSBEITRAG;
    u.verletzte = u.verletzte.map(v => ({ anzahl: v.anzahl, monate: v.monate - 1 })).filter(v => v.monate > 0);
    u.polizei = ultrasKlemme(u.polizei - 6, 0, 100);
    u.ansehen = ultrasKlemme(u.ansehen + (u.ansehen > 30 ? -1 : 0), 0, 100);
    if (u.ansehen >= 50 && u.stimmung >= 55 && u.mitglieder < 200 && Math.random() < 0.5) u.mitglieder++;
    if (u.akten >= 3) ultrasStadionverbot();
}

// Schnittstellen zu anderen Systemen ------------------------------------------------

// Heimstärke: eine gute Stimmung im Block hilft, eine schlechte schadet; auswärts wirkt nichts.
function getUltrasStaerkeBonus(isHome) {
    if (!isHome) return 0;
    const u = ensureUltrasState();
    const wert = (u.stimmung - 50) / 25 + ultrasSkill('anfeuern') * 0.15 + ultrasAusruestung('trommeln') * 0.2;
    return ultrasKlemme(Math.round(wert * 10) / 10, -1, 3);
}

// Faktor für getAusschreitungsLage() (js/ausschreitungen.js): Pyro im Lager, Polizeidruck und Bewährung heizen auf,
// Organisation dämpft.
function getUltrasRisikoFaktor(heim) {
    const u = ensureUltrasState();
    let f = 1 + u.polizei / 400;
    f *= 1 - ultrasSkill('organisation') * 0.05;
    if (u.pyroNaechstesSpiel) f *= 1.3;
    if (u.akten >= 3) f *= 1.1;
    if (!heim) f *= 1.05;
    return Math.round(ultrasKlemme(f, 0.7, 1.5) * 100) / 100;
}

// Rendering --------------------------------------------------------------------------

function ultrasTokenFarbe(name) {
    const wert = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return wert || 'gray';
}

function ultrasZeichneBlock(ctx, x, y, anzahl, farbe, verlust = 0, versatz = 0) {
    const zeilen = 6;
    const spalten = Math.max(1, Math.ceil(Math.min(anzahl, 60) / zeilen));
    for (let i = 0; i < Math.min(anzahl, 60); i++) {
        const sp = Math.floor(i / zeilen);
        const ze = i % zeilen;
        const px = x + sp * 12 + versatz;
        const py = y + ze * 12;
        ctx.globalAlpha = i < Math.min(anzahl, 60) * (1 - verlust) ? 1 : 0.25;
        ctx.fillStyle = farbe;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    return spalten;
}

function ultrasZeichneFrame(ts) {
    const canvas = document.getElementById('ultras-canvas');
    if (!canvas || !canvas.getContext) return false;
    const ctx = canvas.getContext('2d');
    const dt = ultrasLetzterTs === null || ts === undefined ? 0 : Math.min(100, ts - ultrasLetzterTs);
    ultrasLetzterTs = ts === undefined ? null : ts;
    const reduziert = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const w = canvas.width, h = canvas.height;
    const hintergrund = ultrasTokenFarbe('--surface-panel');
    const eigen = ultrasTokenFarbe('--primary');
    const feind = ultrasTokenFarbe('--danger');
    const text = ultrasTokenFarbe('--text-main');
    ctx.fillStyle = hintergrund;
    ctx.fillRect(0, 0, w, h);
    let laeuft = false;

    if (ultrasDuell) {
        const d = ultrasDuell;
        if (d.phase === 'anim') {
            d.anim = reduziert ? 1 : Math.min(1, d.anim + dt / ULTRAS_RUNDEN_DAUER);
            if (d.anim >= 1) {
                if (d.gespielt >= ULTRAS_RUNDEN) ultrasDuellEnde();
                else { d.phase = 'wahl'; renderUltrasScreen(); }
            } else laeuft = true;
        }
        const letzte = d.verlauf[d.verlauf.length - 1];
        const fortschritt = d.phase === 'anim' ? Math.sin(d.anim * Math.PI) : 0;
        const nahe = d.phase === 'anim' ? Math.min(1, d.anim * 2) : 0;
        const aktiv = Math.max(0, ultrasAktiv());
        const verlustEigen = letzte && d.phase === 'anim' ? Math.min(1, letzte.verletzt / Math.max(1, aktiv)) : 0;
        const verlustFeind = letzte && d.phase === 'anim' ? Math.min(1, letzte.gegnerVerletzt / Math.max(1, d.gruppe.mitglieder)) : 0;
        const siegEigen = letzte && letzte.sieg;
        const mitte = w / 2;
        const abstand = 150 - nahe * 90;
        ctx.font = '13px sans-serif';
        ctx.fillStyle = text;
        ctx.textAlign = 'center';
        ctx.fillText(`Gegner: ${d.gruppe.name}`, w * 0.75, 18);
        ctx.fillText(`${ultrasGruppenname()}`, w * 0.25, 18);
        ultrasZeichneBlock(ctx, mitte - abstand - 60 + (siegEigen ? fortschritt * 18 : 0), 40, aktiv, eigen, verlustEigen);
        ultrasZeichneBlock(ctx, mitte + abstand + 10 - (letzte && !siegEigen ? fortschritt * 18 : 0), 40, d.gruppe.aktiv, feind, verlustFeind);
        ctx.fillStyle = text;
        ctx.font = 'bold 15px sans-serif';
        const info = d.phase === 'ende' ? `Ergebnis: ${d.siege}:${d.niederlagen}` : (letzte && d.phase === 'anim' ? (letzte.sieg ? 'Runde gewonnen' : 'Runde verloren') : `Runde ${d.gespielt + 1} von ${ULTRAS_RUNDEN}`);
        ctx.fillText(info, mitte, h - 16);
        return laeuft;
    }

    if (ultrasChoreo) {
        const c = ultrasChoreo;
        if (c.start === null) c.start = ts === undefined ? 0 : ts;
        const t = reduziert ? 1 : Math.min(1, ((ts === undefined ? c.start : ts) - c.start) / c.dauer);
        const spalten = 16, zeilen = 6;
        const kw = w / spalten, kh = h / zeilen;
        const mitte = [4, 6, 8, 10, 12, 13];
        for (let x = 0; x < spalten; x++) {
            for (let y = 0; y < zeilen; y++) {
                const reihenfolge = (x / spalten) * 0.7 + (y / zeilen) * 0.3;
                const sichtbar = Math.min(1, Math.max(0, (t * 1.6 - reihenfolge)));
                const bild = c.erfolg ? (mitte.includes(x) || y === 0 || y === zeilen - 1 ? 1 : 0) : ((x + y) % 2);
                if (sichtbar <= 0) continue;
                ctx.globalAlpha = sichtbar * (bild ? 1 : 0.35);
                ctx.fillStyle = bild ? (c.erfolg ? eigen : feind) : text;
                ctx.fillRect(x * kw + 2, y * kh + 2, kw - 4, kh - 4);
            }
        }
        ctx.globalAlpha = 1;
        if (t < 1 && !reduziert) laeuft = true;
        else if (t >= 1) ultrasChoreo = null;
        return laeuft;
    }

    // Ruhebild: Block der Szene.
    ctx.fillStyle = text;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ultrasGruppenname(), w / 2, 18);
    ultrasZeichneBlock(ctx, w / 2 - 80, 36, ultrasAktiv(), eigen, 0);
    ultrasZeichneBlock(ctx, w / 2 + 20, 36, ultrasAktiv(), eigen, 0);
    return false;
}

function ultrasGruppenname() { return ensureUltrasState().name; }

function ultrasTick(ts) {
    ultrasFrameId = null;
    if (typeof aktiverScreen !== 'undefined' && aktiverScreen !== 'screen-ultras') return;
    if (ultrasZeichneFrame(ts)) ultrasFrameId = requestAnimationFrame(ultrasTick);
    else ultrasLetzterTs = null;
}

function ultrasStarteLoop() {
    if (ultrasFrameId !== null) return;
    if (typeof window.requestAnimationFrame !== 'function') { ultrasZeichneFrame(undefined); return; }
    ultrasFrameId = requestAnimationFrame(ultrasTick);
}

function renderUltrasScreen() {
    const u = ensureUltrasState();
    const box = document.getElementById('ultras-status-box');
    if (!box) return;
    const aktiv = ultrasAktiv();
    const naechsteStufe = ultrasXpSchwelle(u.level);
    const xpAnteil = Math.round((u.xp / naechsteStufe) * 100);
    box.innerHTML = `
        <div class="box">
            <strong>${mpEsc(u.name)}</strong> ${uiChip(`Level ${u.level}`, 'gut')} ${uiChip(`${u.skillPunkte} Fähigkeitspunkt(e) frei`, u.skillPunkte > 0 ? 'warn' : '')}
            <div style="height:6px; border-radius:3px; background:var(--chip-bg); margin:6px 0;"><div style="width:${xpAnteil}%; height:100%; border-radius:3px; background:var(--accent);"></div></div>
            <div style="font-size:var(--fs-caption); color:var(--text-muted);">XP ${u.xp} / ${naechsteStufe} bis Level ${u.level + 1}</div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 120px), 1fr)); gap:6px; margin-top:6px;">
            <div class="box"><div class="ui-overline">Mitglieder</div><strong>${aktiv} / ${u.mitglieder}</strong></div>
            <div class="box"><div class="ui-overline">Stimmung</div><strong>${u.stimmung}</strong></div>
            <div class="box"><div class="ui-overline">Ansehen</div><strong>${u.ansehen}</strong></div>
            <div class="box"><div class="ui-overline">Gruppenkasse</div><strong>${formatVal(u.kasse)}</strong></div>
            <div class="box"><div class="ui-overline">Polizeidruck</div><strong>${u.polizei}</strong></div>
            <div class="box"><div class="ui-overline">Akten</div><strong>${u.akten} / 3</strong></div>
        </div>
        ${u.verletzte.length ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:4px;">Verletzt: ${u.verletzte.reduce((s, v) => s + v.anzahl, 0)} (Rückkehr in ${Math.max(...u.verletzte.map(v => v.monate))} Monaten)</div>` : ''}`;

    const aktionen = document.getElementById('ultras-aktionen-box');
    if (aktionen) {
        const frei = ultrasAktionenFrei();
        const knoepfe = Object.keys(ULTRAS_AKTIONEN).filter(k => k !== 'duell').map(k => {
            const a = ULTRAS_AKTIONEN[k];
            return `<button class="btn-secondary" onclick="ultrasAktionAusfuehren('${k}')" title="${mpEsc(a.text)}">${a.name}${a.kosten ? ` [${formatVal(a.kosten)}]` : ''}</button>`;
        }).join('');
        aktionen.innerHTML = `<div class="box" style="font-size:var(--fs-caption); color:var(--text-muted);">Heute frei: ${frei} von ${ULTRAS_AKTIONEN_PRO_SPIELTAG} Aktionen. Pyro im Lager: ${u.ausruestung.pyro}</div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap:6px;">${knoepfe}</div>`;
    }

    const skills = document.getElementById('ultras-skills-box');
    if (skills) {
        skills.innerHTML = ULTRAS_SKILLS.map(s => `<div class="box" style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
            <span><strong>${s.name}</strong> Stufe ${u.skills[s.key]} / ${ULTRAS_SKILL_MAX}<br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${s.text}</span></span>
            <button class="btn-secondary" onclick="ultrasFaehigkeitSteigern('${s.key}')">+1 Punkt</button></div>`).join('');
    }

    const shop = document.getElementById('ultras-shop-box');
    if (shop) {
        shop.innerHTML = ULTRAS_AUSRUESTUNG.map(a => `<div class="box" style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
            <span><strong>${a.name}</strong> ${a.key === 'pyro' ? `(${u.ausruestung.pyro})` : `(${u.ausruestung[a.key]} / ${a.max})`}<br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${a.text}</span></span>
            <button class="btn-secondary" onclick="ultrasAusruestungKaufen('${a.key}')">Kaufen [${formatVal(a.preis)}]</button></div>`).join('');
    }

    const duell = document.getElementById('ultras-duell-box');
    if (duell) {
        if (!ultrasDuell) {
            const tabelle = typeof sortedTable === 'function' ? (sortedTable(game.leagueLevel) || []) : [];
            const gegner = tabelle.filter(t => t.name !== game.clubName);
            const optionen = gegner.map(t => `<option value="${mpEsc(t.name)}">${mpEsc(t.name)}</option>`).join('');
            duell.innerHTML = `<div class="box">Ein Duell kostet ${formatVal(ULTRAS_DUELL_ANREISE)} Anreise und dauert ${ULTRAS_RUNDEN} Runden. Du wählst pro Runde die Taktik.</div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                    <select id="ultras-gegner-select" style="flex:1 1 180px;">${optionen || '<option value="">Keine Gegner in der Liga</option>'}</select>
                    <button class="btn-secondary" onclick="ultrasDuellStarten()">⚔️ Herausfordern</button>
                </div>`;
        } else {
            const d = ultrasDuell;
            const taktiken = Object.keys(ULTRAS_TAKTIKEN).map(k => `<button class="btn-secondary" onclick="ultrasWaehleTaktik('${k}')" title="${mpEsc(ULTRAS_TAKTIKEN[k].text)}" ${d.phase !== 'wahl' ? 'disabled' : ''}>${ULTRAS_TAKTIKEN[k].name}</button>`).join('');
            const verlauf = d.verlauf.map(v => `<div style="font-size:var(--fs-caption);">Runde ${v.runde}: ${ULTRAS_TAKTIKEN[v.taktik].name} gegen ${ULTRAS_TAKTIKEN[v.gegnerTaktik].name} · ${v.sieg ? 'gewonnen' : 'verloren'} · Verletzte ${v.verletzt}${v.festnahmen ? ' · Festnahme' : ''}</div>`).join('');
            duell.innerHTML = `<div class="box"><strong>Gegen ${mpEsc(d.gruppe.name)}</strong> (${mpEsc(d.gegner)}) · Ihr: ${ultrasAktiv()} aktiv · Gegner: ${d.gruppe.aktiv} aktiv</div>
                ${d.phase === 'ende' ? `<div class="box">Duell beendet: ${d.ergebnis === 'sieg' ? 'gewonnen' : (d.ergebnis === 'niederlage' ? 'verloren' : 'unentschieden')} (${d.siege}:${d.niederlagen}).</div>` : `<div style="display:flex; gap:6px; flex-wrap:wrap;">${taktiken}</div>`}
                ${verlauf}
                ${d.phase === 'ende' ? '<button class="btn-secondary" style="margin-top:6px;" onclick="ultrasDuellSchliessen()">Zurück zur Szene</button>' : ''}`;
        }
    }

    const chronik = document.getElementById('ultras-chronik-box');
    if (chronik) {
        const bilanz = Object.keys(u.bilanz).map(k => `${mpEsc(k)}: ${u.bilanz[k].s}:${u.bilanz[k].n} (${u.bilanz[k].u} unentschieden)`);
        chronik.innerHTML = (bilanz.length ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Duellbilanz (Siege:Niederlagen): ${bilanz.join(' · ')}</div>` : '')
            + (u.chronik.length
                ? u.chronik.slice(0, 12).map(c => `<div class="box" style="font-size:var(--fs-small);"><span style="color:var(--text-muted);">S${c.season}/${c.matchday}.</span> ${mpEsc(c.text)}</div>`).join('')
                : '<div style="color:var(--text-muted); font-size:var(--fs-caption);">Noch keine Einträge.</div>');
    }
    ultrasStarteLoop();
}

function ultrasDuellStarten() {
    const sel = document.getElementById('ultras-gegner-select');
    ultrasAktionAusfuehren('duell', sel ? sel.value : '');
}

function ultrasDuellSchliessen() {
    ultrasDuell = null;
    renderUltrasScreen();
}
