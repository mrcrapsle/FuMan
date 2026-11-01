// Werkbank (Runde 34): 20 kleine Auswertungen im Reiter „🧰 Werkbank“ der Vereinsgeschichte.
// Alles liest echte Daten (Kader, Finanzen, Zuschauer, Rekorde). Eigene Eingaben (Sparziel,
// Notizbuch) liegen in game.werkbank und werden über ensureWerkbankState() abgesichert.
// Die Auswertungen verändern nie Geld oder Kader; nur die Rechner zeigen Zahlen an.

const WERKBANK_RICHT = { TW: 2, ABW: 4, MIT: 4, ST: 2 };   // Richtwerte je Position
const WERKBANK_SPRUECHE = [
    'Ein guter Kader gewinnt Spiele, bevor sie gespielt werden.',
    'Wer heute die Jugend fördert, spielt morgen mit Stammkräften.',
    'Ein voller Platz ist die beste Werbung, die der Verein hat.',
    'Die Tabelle lügt nie, aber sie erzählt nur die halbe Geschichte.',
    'Erst die Finanzen, dann der Wunschspieler.',
    'Verletzungen kommen selten gelegen, aber die Breite hilft.',
    'Ein Sieg im Derby wiegt mehr als drei Punkte.',
    'Wer den Gegner kennt, muss nicht raten.'
];

function ensureWerkbankState() {
    if (!game.werkbank || typeof game.werkbank !== 'object') game.werkbank = {};
    if (!('sparziel' in game.werkbank)) game.werkbank.sparziel = null;
    if (typeof game.werkbank.notiz !== 'string') game.werkbank.notiz = '';
    return game.werkbank;
}

function wbKader() { return (typeof squad !== 'undefined' && Array.isArray(squad)) ? squad : []; }
function wbGeld(n) { return `${Math.round(n || 0).toLocaleString('de-DE')} €`; }
function wbProzent(teil, ganze) { return ganze > 0 ? Math.max(0, Math.min(100, Math.round((teil / ganze) * 100))) : 0; }
function wbBalken(prozent) {
    return `<div style="background:var(--surface-2); height:8px; border-radius:4px; overflow:hidden; margin:3px 0;"><div style="width:${prozent}%; height:100%; background:var(--accent);"></div></div>`;
}
function wbZeile(links, rechts) {
    return `<div style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-small); padding:2px 0;"><span>${links}</span><strong>${rechts}</strong></div>`;
}
function wbKarte(titel, inhalt, hinweis = '') {
    return `<div class="panel" style="margin:0 0 8px; padding:10px;">
        <div class="panel-header" style="font-size:var(--fs-body);">${titel}</div>
        ${hinweis ? `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:4px;">${hinweis}</div>` : ''}
        ${inhalt}
    </div>`;
}

// ---------- Kader (1-5) ----------
// 1. Altersprofil
function wbAltersprofil() {
    const k = wbKader();
    if (!k.length) return wbKarte('👥 Altersprofil', '<div>Noch kein Kader.</div>');
    const schnitt = k.reduce((s, p) => s + (p.age || 0), 0) / k.length;
    const jung = k.filter(p => (p.age || 0) <= 21).length;
    const alt = k.filter(p => (p.age || 0) >= 30).length;
    return wbKarte('👥 Altersprofil', `
        ${wbZeile('Durchschnittsalter', schnitt.toFixed(1) + ' J.')}
        ${wbZeile('Bis 21 Jahre', jung + ' Spieler')}${wbBalken(wbProzent(jung, k.length))}
        ${wbZeile('Ab 30 Jahre', alt + ' Spieler')}${wbBalken(wbProzent(alt, k.length))}`,
        'Ein gesunder Kader hat Jugend und Erfahrung nebeneinander.');
}

// 2. Positions-Tiefe mit Richtwerten
function wbPositionsTiefe() {
    const k = wbKader();
    const zeilen = Object.keys(WERKBANK_RICHT).map(pos => {
        const n = k.filter(p => p.pos === pos).length;
        const luecke = n < WERKBANK_RICHT[pos];
        return wbZeile(`${pos} (Richtwert ${WERKBANK_RICHT[pos]})`, `${n}${luecke ? ' ⚠️ dünn' : ' ✓'}`);
    }).join('');
    return wbKarte('🧩 Positions-Tiefe', zeilen, 'Warnt, wenn eine Position unter dem Richtwert liegt. Ausfälle merkt man dann sofort.');
}

// 3. Stärke-Verteilung
function wbStaerkeVerteilung() {
    const k = wbKader();
    if (!k.length) return wbKarte('📊 Stärke-Verteilung', '<div>Noch kein Kader.</div>');
    const gruppen = [[40, 49], [50, 59], [60, 69], [70, 79], [80, 99]];
    const zahlen = gruppen.map(([a, b]) => k.filter(p => (p.strength || 0) >= a && (p.strength || 0) <= b).length);
    const hoechst = Math.max(1, ...zahlen);
    const zeilen = gruppen.map(([a, b], i) => wbZeile(b === 99 ? `${a}+` : `${a}–${b}`, `${zahlen[i]}`) + wbBalken(wbProzent(zahlen[i], hoechst))).join('');
    return wbKarte('📊 Stärke-Verteilung', zeilen, 'Wie viele Spieler in welchem Stärkebereich stehen.');
}

// 4. Torjäger der Saison
function wbTorjaeger() {
    const top = wbKader().filter(p => (p.goalsSeason || 0) > 0).sort((a, b) => b.goalsSeason - a.goalsSeason).slice(0, 5);
    const zeilen = top.length ? top.map(p => wbZeile(`${p.name} (${p.pos})`, `${p.goalsSeason} Tore`)).join('') : '<div>Noch kein Tor in dieser Saison.</div>';
    return wbKarte('⚽ Torjäger der Saison', zeilen);
}

// 5. Talent-Radar (bis 21, nach Stärke)
function wbTalentRadar() {
    const top = wbKader().filter(p => (p.age || 99) <= 21).sort((a, b) => (b.strength || 0) - (a.strength || 0)).slice(0, 5);
    const zeilen = top.length ? top.map(p => wbZeile(`${p.name} (${p.pos}, ${p.age} J.)`, `Stärke ${p.strength}`)).join('') : '<div>Keine Talente bis 21 im Kader.</div>';
    return wbKarte('🌱 Talent-Radar', zeilen, 'Junge Spieler nach Stärke. Wer hier oben steht, verdient Einsatzzeit.');
}

// ---------- Entwicklung (6-8) ----------
function wbDelta(p) {
    const h = Array.isArray(p.strengthHistory) ? p.strengthHistory : [];
    if (h.length < 2) return 0;
    return (h[h.length - 1].strength || 0) - (h[h.length - 2].strength || 0);
}

// 6. Form-Gewinner und -Verlierer
function wbFormLaeufer() {
    const mit = wbKader().map(p => ({ p, d: wbDelta(p) })).filter(x => x.d !== 0);
    const hoch = mit.filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
    const runter = mit.filter(x => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3);
    const zeile = x => wbZeile(`${x.p.name} (${x.p.pos})`, `${x.d > 0 ? '+' : ''}${x.d}`);
    return wbKarte('📈 Form-Gewinner & -Verlierer',
        `<div style="font-size:var(--fs-caption); margin-bottom:2px;">Gewinner</div>${hoch.map(zeile).join('') || '<div>–</div>'}
         <div style="font-size:var(--fs-caption); margin:6px 0 2px;">Verlierer</div>${runter.map(zeile).join('') || '<div>–</div>'}`,
        'Veränderung der Stärke seit der letzten Saisonauswertung.');
}

// 7. Kaderwert-Schätzung
function wbKaderwert() {
    const k = wbKader();
    if (!k.length || typeof calculatePlayerMarketValue !== 'function') return wbKarte('💶 Kaderwert (Schätzung)', '<div>Noch kein Kader.</div>');
    const summe = k.reduce((s, p) => s + (calculatePlayerMarketValue(p.strength) || 0), 0);
    const wertvollster = k.reduce((b, p) => (p.strength || 0) > (b.strength || 0) ? p : b, k[0]);
    return wbKarte('💶 Kaderwert (Schätzung)', wbZeile('Gesamtwert', wbGeld(summe)) + wbZeile('Wertvollster Spieler', `${wertvollster.name} (${wertvollster.pos})`),
        'Grobe Schätzung aus der Stärke, nicht der Marktpreis.');
}

// 8. Charakter-Verteilung
function wbCharaktere() {
    const zaehl = {};
    wbKader().forEach(p => { const t = p.trait && p.trait !== 'Kein' ? p.trait : null; if (t) zaehl[t] = (zaehl[t] || 0) + 1; });
    const top = Object.entries(zaehl).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const zeilen = top.length ? top.map(([t, n]) => wbZeile(t, `${n}`)).join('') : '<div>Keine besonderen Eigenschaften im Kader.</div>';
    return wbKarte('🎭 Eigenschaften im Kader', zeilen);
}

// ---------- Finanzen (9-12) ----------
// 9. Ticket-Rechner (Schätzung am letzten Heimspiel)
function wbTicketRechner() {
    const hist = Array.isArray(game.attendanceHistory) ? game.attendanceHistory : [];
    const letzt = hist[hist.length - 1];
    if (!letzt) return wbKarte('🎟️ Ticket-Rechner', '<div>Noch kein Heimspiel gespielt.</div>');
    const basis = (game.ticketPrices && game.ticketPrices.steh) || 12;
    const zeilen = [0.8, 0.9, 1.0, 1.1, 1.2].map(f => {
        const besucher = Math.min(letzt.capacity || letzt.attendance, Math.round(letzt.attendance * Math.max(0.2, 1 - 1.2 * (f - 1))));
        return wbZeile(`Stehplatz ${Math.round(basis * f)} € (${Math.round((f - 1) * 100) >= 0 ? '+' : ''}${Math.round((f - 1) * 100)} %)`, `${besucher.toLocaleString('de-DE')} Zuschauer · ${wbGeld(besucher * Math.round(basis * f))}`);
    }).join('');
    return wbKarte('🎟️ Ticket-Rechner', zeilen, 'Schätzung mit dem Stehplatz-Preis als Maßstab. Höhere Preise senken die Besucherzahl etwas.');
}

// 10. Sparziel
function wbSparziel() {
    const st = ensureWerkbankState();
    const sz = st.sparziel;
    const eingabe = `<div style="display:grid; gap:4px; margin-top:6px;">
        <input id="wb-sparziel-name" type="text" placeholder="Wofür sparen? (z. B. Stadion-Dach)" value="${sz ? sz.name : ''}" style="min-height:32px;">
        <input id="wb-sparziel-betrag" type="number" min="1" placeholder="Betrag in €" style="min-height:32px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn-action" onclick="wbSparzielSetzen()" style="width:auto;">Ziel setzen</button>
            ${sz ? '<button class="btn-secondary" onclick="wbSparzielLoeschen()" style="width:auto;">Ziel entfernen</button>' : ''}
        </div></div>`;
    let fortschritt = '<div>Noch kein Sparziel gesetzt.</div>';
    if (sz) {
        const p = wbProzent(game.money, sz.betrag);
        fortschritt = `${wbZeile(sz.name, wbGeld(sz.betrag))}${wbBalken(p)}<div style="font-size:var(--fs-caption);">${p >= 100 ? '🎉 Ziel erreicht' : `Noch ${wbGeld(Math.max(0, sz.betrag - game.money))} bis zum Ziel`}</div>`;
    }
    return wbKarte('🐷 Sparziel', fortschritt + eingabe);
}

// 11. Reserve in Spieltagen (Gehälter aus dem Kader)
function wbReserve() {
    const gehaltSumme = wbKader().reduce((s, p) => s + (p.wage || 0), 0);
    const tage = gehaltSumme > 0 ? Math.floor(game.money / gehaltSumme) : null;
    return wbKarte('🛟 Reserve in Spieltagen',
        wbZeile('Kontostand', wbGeld(game.money)) + wbZeile('Gehälter pro Spieltag', wbGeld(gehaltSumme)) +
        wbZeile('Reicht für', tage === null ? '–' : `${tage} Spieltage`),
        'Nur die Gehälter gerechnet, ohne Einnahmen. Ein Richtwert für die Sicherheit.');
}

// 12. Heimspiel-Schnitt
function wbHeimSchnitt() {
    const hist = (Array.isArray(game.attendanceHistory) ? game.attendanceHistory : []).slice(-5);
    if (!hist.length) return wbKarte('🏟️ Heimspiel-Schnitt', '<div>Noch kein Heimspiel gespielt.</div>');
    const schnitt = hist.reduce((s, h) => s + (h.attendance || 0), 0) / hist.length;
    const kap = hist[hist.length - 1].capacity || 16000;
    return wbKarte('🏟️ Heimspiel-Schnitt', wbZeile('Ø letzte 5 Heimspiele', `${Math.round(schnitt).toLocaleString('de-DE')}`) + wbZeile('Auslastung', `${wbProzent(schnitt, kap)} %`) + wbBalken(wbProzent(schnitt, kap)));
}

// ---------- Verein & Saison (13-17) ----------
// 13. Saisonfortschritt
function wbSaisonfortschritt() {
    const gesamt = 34;
    const gespielt = Math.min(gesamt, Math.max(0, (game.matchday || 1) - 1));
    return wbKarte('📅 Saisonfortschritt', wbZeile('Spieltag', `${Math.min(gesamt, game.matchday || 1)} von ${gesamt}`) + wbBalken(wbProzent(gespielt, gesamt)) +
        wbZeile('Noch zu spielen', `${gesamt - gespielt} Spieltage`));
}

// 14. Vereinsrekorde
function wbRekorde() {
    const r = game.clubRecords || {};
    const sieg = r.biggestWin ? `${r.biggestWin.ourGoals}:${r.biggestWin.oppGoals}` : '–';
    const tore = r.mostGoalsInMatch && typeof r.mostGoalsInMatch === 'object' ? `${(r.mostGoalsInMatch.ourGoals || 0) + (r.mostGoalsInMatch.oppGoals || 0)} Tore` : (typeof r.mostGoalsInMatch === 'number' ? `${r.mostGoalsInMatch} Tore` : '–');
    return wbKarte('🥇 Vereinsrekorde', wbZeile('Höchster Sieg', sieg) + wbZeile('Längste Serie ohne Niederlage', `${r.longestUnbeatenStreak || 0} Spiele`) + wbZeile('Meiste Tore in einem Spiel', tore));
}

// 15. Erfolgssammlung
function wbErfolge() {
    const n = Array.isArray(game.achievements) ? game.achievements.length : 0;
    return wbKarte('🎖️ Erfolgssammlung', wbZeile('Freigeschaltete Erfolge', `${n}`) + wbBalken(wbProzent(n, 20)),
        'Der Balken zeigt grob den Fortschritt bei 20 Erfolgen.');
}

// 16. Stimmungsbarometer
function wbStimmung() {
    const posten = [['Fans', game.fans], ['Medienruf', game.mediaReputation], ['Vorstand', game.boardSat]];
    const zeilen = posten.map(([name, wert]) => {
        const v = Math.max(0, Math.min(100, Math.round(wert || 0)));
        return wbZeile(name, `${v} / 100`) + wbBalken(v);
    }).join('');
    return wbKarte('🌡️ Stimmungsbarometer', zeilen);
}

// 17. Notizbuch (frei, bleibt im Spielstand)
function wbNotizbuch() {
    const st = ensureWerkbankState();
    return wbKarte('📝 Notizbuch', `<textarea id="wb-notiz" rows="4" placeholder="Eigene Gedanken zur Saison ..." oninput="wbNotizSpeichern(this.value)" style="width:100%; min-height:72px;">${st.notiz}</textarea>`,
        'Wird mit dem Spielstand gespeichert.');
}

// ---------- Werkzeuge (18-20) ----------
// 18. Tagesspruch (fest je Spieltag)
function wbTagesspruch() {
    const nr = (game.matchday || 1) % WERKBANK_SPRUECHE.length;
    return wbKarte('💬 Spruch des Spieltags', `<div style="font-style:italic;">„${WERKBANK_SPRUECHE[nr]}“</div>`);
}

// 19. Transfer-Rechner (Ablöse, Gehalt und Vertragsjahre)
function wbTransferRechner() {
    return wbKarte('🧮 Transfer-Rechner', `<div style="display:grid; gap:4px;">
        <input id="wb-tr-abloese" type="number" min="0" placeholder="Ablöse in €" style="min-height:32px;">
        <input id="wb-tr-gehalt" type="number" min="0" placeholder="Gehalt pro Spieltag in €" style="min-height:32px;">
        <input id="wb-tr-jahre" type="number" min="1" max="5" value="3" placeholder="Vertragsjahre" style="min-height:32px;">
        <button class="btn-action" onclick="wbTransferRechnen()" style="width:auto;">Rechnen</button>
        <div id="wb-tr-ergebnis" style="font-size:var(--fs-small);"></div></div>`,
        'Gesamtkosten über den Vertrag: Ablöse plus Gehalt für 34 Spieltage je Jahr.');
}

// 20. Kader als Text (zum Kopieren)
function wbKaderText() {
    const zeilen = wbKader().map(p => `${p.name} (${p.pos}, Stärke ${p.strength}, ${p.age} J.)`).join('\n');
    return wbKarte('📋 Kader als Text', `<textarea id="wb-kader-text" readonly rows="5" style="width:100%; min-height:90px; font-size:var(--fs-caption);">${zeilen || 'Noch kein Kader.'}</textarea>
        <button class="btn-secondary" onclick="wbKaderMarkieren()" style="width:auto; margin-top:4px;">Alles markieren</button>`,
        'Zum Einfügen in eine Nachricht oder Notiz.');
}

// ---------- Aktionen ----------
function wbSparzielSetzen() {
    const st = ensureWerkbankState();
    const name = (document.getElementById('wb-sparziel-name')?.value || '').trim();
    const betrag = Math.round(Number(document.getElementById('wb-sparziel-betrag')?.value) || 0);
    if (!name || betrag <= 0) { showToast('Bitte Namen und einen Betrag über 0 € eingeben.', 'info', 2500); return; }
    st.sparziel = { name: name.slice(0, 40), betrag };
    showToast(`🐷 Sparziel gesetzt: ${st.sparziel.name}`, 'success');
    renderWerkbankBox();
}
function wbSparzielLoeschen() {
    ensureWerkbankState().sparziel = null;
    showToast('Sparziel entfernt.', 'info', 2000);
    renderWerkbankBox();
}
function wbNotizSpeichern(text) {
    ensureWerkbankState().notiz = String(text || '').slice(0, 2000);
}
function wbTransferRechnen() {
    const ab = Math.max(0, Number(document.getElementById('wb-tr-abloese')?.value) || 0);
    const gehalt = Math.max(0, Number(document.getElementById('wb-tr-gehalt')?.value) || 0);
    const jahre = Math.min(5, Math.max(1, Math.round(Number(document.getElementById('wb-tr-jahre')?.value) || 1)));
    const gesamt = ab + gehalt * 34 * jahre;
    const ziel = document.getElementById('wb-tr-ergebnis');
    if (ziel) ziel.innerHTML = `${wbZeile('Ablöse', wbGeld(ab))}${wbZeile(`Gehalt über ${jahre} Jahr(e)`, wbGeld(gehalt * 34 * jahre))}${wbZeile('Gesamtkosten', wbGeld(gesamt))}`;
}
function wbKaderMarkieren() {
    const feld = document.getElementById('wb-kader-text');
    if (!feld) return;
    feld.focus();
    feld.select();
    showToast('Kaderliste markiert - jetzt kopieren.', 'info', 2000);
}

// Reihenfolge der 20 Karten
const WERKBANK_KARTEN = [
    wbAltersprofil, wbPositionsTiefe, wbStaerkeVerteilung, wbTorjaeger, wbTalentRadar,
    wbFormLaeufer, wbKaderwert, wbCharaktere,
    wbTicketRechner, wbSparziel, wbReserve, wbHeimSchnitt,
    wbSaisonfortschritt, wbRekorde, wbErfolge, wbStimmung, wbNotizbuch,
    wbTagesspruch, wbTransferRechner, wbKaderText
];

function renderWerkbankBox() {
    const box = document.getElementById('werkbank-box');
    if (!box) return;
    ensureWerkbankState();
    box.innerHTML = WERKBANK_KARTEN.map(f => f()).join('');
}
