// Reaktionsspiele bei Standards (Elfmeter, Freistoß, Ecke): Ein Cursor läuft über eine Leiste,
// erst von links nach rechts, dann von oben nach unten; wer ihn in der Mitte stoppt, schießt genau.
// Elfmeter: vorher die Ecke wählen, der Torwart ahnt manchmal richtig. Elfmeter gegen uns: wohin
// springt unser Torwart? Das Ergebnis (zielung) verschiebt die Trefferchance (reaktionsChance() in
// js/set-pieces.js) und bestimmt in der Spielphysik, wohin der Ball fliegt.
// Gute Schützen bewegen den Cursor langsamer und haben eine breitere Mitte.
// Ohne Reaktionsspiel (Schalter, "Kurz ausführen", schnelles Durchspielen) bleibt alles wie bisher.

const REAKTION_KEY = 'anstoss_fm13_reaktionsspiel';
let reaktion = null;   // laufendes Reaktionsspiel, nicht im Spielstand
let reaktionSaat = 0x6d2b79f5;
function reaktionRnd() { reaktionSaat = (reaktionSaat * 1664525 + 1013904223) >>> 0; return reaktionSaat / 4294967296; }

function reaktionsspielAn() { return safeLocalGet(REAKTION_KEY) !== '0'; }
function reaktionsspielUmschalten() {
    safeLocalSet(REAKTION_KEY, reaktionsspielAn() ? '0' : '1');
    showToast(reaktionsspielAn() ? '🎮 Reaktionsspiele bei Standards an' : 'Reaktionsspiele aus: Standards laufen automatisch', 'info');
    if (typeof showSetPiecePanel === 'function' && typeof currentMatch !== 'undefined' && currentMatch && currentMatch.setPiece) showSetPiecePanel();
}

function reaktionsBilanz() {
    if (!game.reaktionsBilanz) game.reaktionsBilanz = { versuche: 0, perfekt: 0, erfolge: 0 };
    return game.reaktionsBilanz;
}
function reaktionsBilanzBuchen(zielung, erfolg) {
    const b = reaktionsBilanz();
    b.versuche++;
    if (typeof zielung.q === 'number' && zielung.q >= 0.9) b.perfekt++;
    if (erfolg) b.erfolge++;
}

// Schwierigkeit aus dem Können: Zeit für einen Weg über die Leiste und Breite der Mitte
function reaktionsTempo(wert) {
    const w = Number(wert) || 50;
    return { dauer: Math.max(0.55, Math.min(1.4, 0.95 + (w - 60) * 0.008)), zone: Math.max(0.08, Math.min(0.24, 0.14 + (w - 60) * 0.0025)) };
}

// Ablauf je Standard: Stufen (ecke = Ecke wählen, quer/hoch = Leisten, torwart = Sprung wählen)
function reaktionsPlan(sp, choice) {
    if (sp.type === 'elfmeter') {
        const kandidat = getPenaltyCandidates(sp.gefoultId).find(c => String(c.p.id) === String(choice)) || getPenaltyCandidates(sp.gefoultId)[0];
        const p = kandidat.p;
        return { titel: `❗ Elfmeter: ${p.name}`, prob: kandidat.prob, stufen: [
            { art: 'ecke', text: 'Wohin schießt du? (aus Sicht des Schützen)' },
            { art: 'quer', text: 'Platzierung: tippe, wenn der Cursor in der Mitte ist', ...reaktionsTempo(p.shooting) },
            { art: 'hoch', text: 'Schusskraft: tippe in der Mitte', ...reaktionsTempo(p.shooting) }
        ], twRaten: true };
    }
    if (sp.type === 'elfmeter-gegner') {
        return { titel: '🧤 Elfmeter gegen uns', prob: 1 - getOpponentPenaltyChance(), stufen: [{ art: 'torwart', text: 'Wohin springt dein Torwart? (aus seiner Sicht)', zeit: 2.6 }] };
    }
    const ecke = sp.type === 'ecke';
    const optionen = ecke ? getCornerOptions() : getFreeKickOptions();
    const o = optionen[choice] || optionen[ecke ? 'flanke' : 'direkt'];
    if (choice === 'direkt') {
        const s = o.schuetze || {};
        return { titel: `🎯 Freistoß direkt: ${s.name || ''}`, prob: o.prob, stufen: [
            { art: 'quer', text: 'Richtung: tippe in der Mitte', ...reaktionsTempo(s.shooting) },
            { art: 'hoch', text: 'Über die Mauer: tippe in der Mitte', ...reaktionsTempo(s.shooting) }
        ] };
    }
    const flanker = o.vorlage || o.schuetze || {}, kopf = o.schuetze || {};
    return { titel: `${ecke ? '🚩 Ecke' : '🔝 Freistoßflanke'} auf ${kopf.name || 'den Kopfballspieler'}`, prob: o.prob, stufen: [
        { art: 'quer', text: `Flanke von ${flanker.name || 'außen'}: tippe in der Mitte`, ...reaktionsTempo(flanker.passing) },
        { art: 'hoch', text: `Kopfball ${kopf.name || ''}: tippe in der Mitte`, ...reaktionsTempo(kopf.strength) }
    ] };
}

function reaktionsspielStarten(sp, choice, fertig) {
    const plan = reaktionsPlan(sp, choice);
    reaktion = { sp, choice, plan, fertig, stufe: 0, werte: [], ecke: undefined, twEcke: undefined, laeuft: false, start: 0, gestoppt: false };
    // Elfmeter: Ahnt der Torwart die Ecke? (eigener Zufall, damit die Spiellogik ihre Folge behält)
    if (plan.twRaten) { const w = reaktionRnd(); reaktion.twEcke = w < 0.42 ? -1 : (w < 0.84 ? 1 : 0); }
    if (sp.type === 'elfmeter-gegner') { const w = reaktionRnd(); reaktion.schussEcke = w < 0.4 ? -1 : (w < 0.8 ? 1 : 0); }
    const ov = document.getElementById('reaktion-overlay');
    if (ov) ov.classList.add('show');
    reaktionsStufeZeigen();
}

function reaktionsStufeZeigen() {
    const r = reaktion;
    if (!r) return;
    const st = r.plan.stufen[r.stufe];
    const titel = document.getElementById('reaktion-titel');
    const box = document.getElementById('reaktion-feld');
    if (!titel || !box) return;
    titel.innerText = r.plan.titel;
    const b = reaktionsBilanz();
    const bilanz = b.versuche ? `Deine Bilanz: ${b.erfolge} von ${b.versuche} geglückt, ${b.perfekt}× perfekt` : 'Erster Versuch - viel Glück!';
    const kopf = `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Schritt ${r.stufe + 1} von ${r.plan.stufen.length} · ${bilanz}</div>
        <div style="font-size:var(--fs-body); font-weight:700; margin-bottom:8px;">${st.text}</div>`;
    if (st.art === 'ecke' || st.art === 'torwart') {
        box.innerHTML = kopf + `<div class="reaktion-tor" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="reaktion-ecken">
                <button onclick="reaktionsEcke(-1)" class="btn-action">⬅️ Links</button>
                <button onclick="reaktionsEcke(0)" class="btn-secondary">⬆️ Mitte</button>
                <button onclick="reaktionsEcke(1)" class="btn-action">Rechts ➡️</button>
            </div>${st.art === 'torwart' ? '<div class="reaktion-uhr" id="reaktion-uhr"><div id="reaktion-uhr-balken"></div></div>' : ''}
            <div id="reaktion-ergebnis" class="reaktion-ergebnis" role="status"></div>`;
        r.start = performance.now();
        r.laeuft = st.art === 'torwart';
        if (r.laeuft) requestAnimationFrame(reaktionsTakt);
        return;
    }
    const quer = st.art === 'quer';
    box.innerHTML = kopf + `<div class="reaktion-leiste ${quer ? 'quer' : 'hoch'}" onclick="reaktionsTippen()" role="button" aria-label="Jetzt tippen">
            <div class="reaktion-zone" style="${quer ? `left:${50 - st.zone * 50}%; width:${st.zone * 100}%` : `top:${50 - st.zone * 50}%; height:${st.zone * 100}%`};"></div>
            <div class="reaktion-cursor" id="reaktion-cursor"></div>
        </div>
        <button onclick="reaktionsTippen()" class="btn-primary reaktion-jetzt" id="reaktion-jetzt">👆 Jetzt!</button>
        <div id="reaktion-ergebnis" class="reaktion-ergebnis" role="status"></div>`;
    r.start = performance.now();
    r.gestoppt = false;
    r.laeuft = true;
    requestAnimationFrame(reaktionsTakt);
    const k = document.getElementById('reaktion-jetzt');
    if (k) k.focus();
}

// Lage des Cursors: Dreieckswelle zwischen -1 und 1
function reaktionsLage(st, ms) {
    const p = (ms / 1000) / st.dauer;
    const t = p % 2;
    return t < 1 ? -1 + 2 * t : 3 - 2 * t;
}

function reaktionsTakt(jetzt) {
    const r = reaktion;
    if (!r || !r.laeuft) return;
    const st = r.plan.stufen[r.stufe];
    if (st.art === 'torwart') {
        const rest = Math.max(0, 1 - (jetzt - r.start) / 1000 / st.zeit);
        const balken = document.getElementById('reaktion-uhr-balken');
        if (balken) balken.style.width = (rest * 100) + '%';
        if (rest <= 0) { r.laeuft = false; reaktionsEcke(null); return; }
    } else {
        const lage = reaktionsLage(st, jetzt - r.start);
        const c = document.getElementById('reaktion-cursor');
        if (c) { if (st.art === 'quer') c.style.left = (50 + lage * 46) + '%'; else c.style.top = (50 + lage * 46) + '%'; }
    }
    requestAnimationFrame(reaktionsTakt);
}

function reaktionsTippen() {
    const r = reaktion;
    if (!r || !r.laeuft || r.gestoppt) return;
    const st = r.plan.stufen[r.stufe];
    if (st.art !== 'quer' && st.art !== 'hoch') return;
    r.gestoppt = true; r.laeuft = false;
    const lage = reaktionsLage(st, performance.now() - r.start);
    const genau = Math.abs(lage) <= st.zone ? 1 : Math.max(0, 1 - (Math.abs(lage) - st.zone) / (1 - st.zone));
    r.werte.push({ art: st.art, lage, genau });
    if (navigator.vibrate) { try { navigator.vibrate(genau >= 1 ? [20, 30, 20] : 25); } catch (e) { /* egal */ } }
    const erg = document.getElementById('reaktion-ergebnis');
    if (erg) {
        const wort = genau >= 1 ? '✨ Perfekt!' : (genau > 0.6 ? '👍 Gut' : (genau > 0.3 ? '😬 Knapp' : '❌ Daneben'));
        erg.innerHTML = `<strong style="color:${genau > 0.6 ? 'var(--primary)' : (genau > 0.3 ? 'var(--accent)' : 'var(--danger)')};">${wort}</strong>`;
    }
    setTimeout(reaktionsWeiter, 650);
}

function reaktionsEcke(ecke) {
    const r = reaktion;
    if (!r) return;
    const st = r.plan.stufen[r.stufe];
    r.laeuft = false;
    if (st.art === 'torwart') {
        // Der Spieler wählt aus Sicht des Torwarts; gespeichert wird aus Sicht des Schützen
        r.twEcke = ecke === null ? 0 : -ecke;
        const erg = document.getElementById('reaktion-ergebnis');
        if (erg) erg.innerHTML = ecke === null ? 'Zu spät - der Torwart bleibt stehen.' : 'Der Schütze läuft an …';
    } else r.ecke = ecke === null ? 0 : ecke;
    setTimeout(reaktionsWeiter, st.art === 'torwart' ? 500 : 200);
}

function reaktionsWeiter() {
    const r = reaktion;
    if (!r) return;
    r.stufe++;
    if (r.stufe < r.plan.stufen.length) { reaktionsStufeZeigen(); return; }
    reaktionsAbschluss();
}

function reaktionsZielung() {
    const r = reaktion;
    const quer = r.werte.find(w => w.art === 'quer'), hoch = r.werte.find(w => w.art === 'hoch');
    const z = {};
    if (quer || hoch) {
        z.h = quer ? quer.lage : 0;
        z.v = hoch ? hoch.lage : 0;
        z.q = ((quer ? quer.genau : 1) + (hoch ? hoch.genau : 1)) / 2;
    }
    if (r.sp.type === 'elfmeter') { z.ecke = r.ecke === undefined ? 0 : r.ecke; z.twEcke = r.twEcke; }
    if (r.sp.type === 'elfmeter-gegner') { z.ecke = r.schussEcke; z.twEcke = r.twEcke === undefined ? 0 : r.twEcke; }
    return z;
}

function reaktionsAbschluss() {
    const r = reaktion;
    const z = reaktionsZielung();
    const box = document.getElementById('reaktion-feld');
    let chance;
    if (r.sp.type === 'elfmeter-gegner') {
        const gegner = getOpponentPenaltyChance();
        const tor = z.twEcke === z.ecke ? Math.max(0.2, gegner - 0.4) : Math.min(0.93, gegner + 0.1);
        chance = `Abwehrchance jetzt ${Math.round((1 - tor) * 100)} % ${z.twEcke === z.ecke ? '- richtig geahnt!' : ''}`;
    } else {
        chance = `Trefferchance jetzt ${Math.round(reaktionsChance(r.plan.prob, z) * 100)} % (vorher ${Math.round(r.plan.prob * 100)} %)`;
        if (z.twEcke !== undefined && z.ecke !== undefined) chance += z.twEcke === z.ecke ? ' · Der Torwart ahnt die Ecke!' : ' · Der Torwart springt falsch.';
    }
    if (box) box.innerHTML = `<div style="font-size:var(--fs-body-lg); font-weight:800; margin:10px 0;">${chance}</div>`;
    setTimeout(() => reaktionsBeenden(z), 1100);
}

function reaktionsBeenden(z) {
    const r = reaktion;
    reaktion = null;
    const ov = document.getElementById('reaktion-overlay');
    if (ov) ov.classList.remove('show');
    if (r && r.fertig) r.fertig(z);
}

// Schließen-Knopf und Escape: der Standard wird automatisch ausgeführt
function reaktionsspielAbbrechen() {
    if (!reaktion) { const ov = document.getElementById('reaktion-overlay'); if (ov) ov.classList.remove('show'); return; }
    reaktion.laeuft = false;
    reaktionsBeenden(null);
}

document.addEventListener('keydown', e => {
    if (!reaktion || (e.key !== ' ' && e.key !== 'Enter')) return;
    const st = reaktion.plan.stufen[reaktion.stufe];
    if (st && (st.art === 'quer' || st.art === 'hoch')) { e.preventDefault(); reaktionsTippen(); }
});
