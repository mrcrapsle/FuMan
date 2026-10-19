// Freischaltungen (Board-Karte „Freischaltungssystem“): Bereiche, die erst mit einem gewachsenen
// Verein Sinn ergeben, öffnen sich über echte Erfolge der Manager-Laufbahn: höchste erreichte Liga,
// Meistertitel, Ligasiege und -tore, Pokale, Champions Cup und Manager-Level. Die Zahlen kommen aus
// game.managerCareer (abgeschlossene Saisons, js/manager-analytics.js) plus der laufenden Saison.
// Gesperrt heißt: der Bereich bleibt als graue Vorschau sichtbar, oben stehen die Bedingungen, Aktionen
// sagen per Toast warum nicht, und laufender Betrieb ruht (Fabriken, Mieten, Stadion-Anlagen,
// Sparpläne, Training der Zweiten, Namensrechte, Medienvertrag, Luxus-Erträge).
// Einmal offen, bleibt ein Bereich offen (game.freischaltungen, auch nach Abstieg oder Vereinswechsel).

// Reihenfolge zählt: ein Bereich, der einen anderen voraussetzt ('bereich'), steht dahinter.
const FREISCHALT_BEREICHE = [
    { key: 'wetten', paket: 'finanzwelt', name: 'Sportwetten', icon: '🎲', screens: ['screen-betting'], ziel: 'screen-betting',
        text: 'Wetten auf eigene Spiele.', bedingungen: [{ art: 'spiele', wert: 68 }, { art: 'level', wert: 3 }] },
    { key: 'namensrechte', paket: 'grundspiel', name: 'Stadion-Namensrechte', icon: '🏷️', screens: [], ziel: 'screen-stadium',
        text: 'Namensrechte am Stadion verkaufen, mit Ablöse und Einnahmen je Heimspiel.', bedingungen: [{ art: 'liga', wert: 3 }, { art: 'siege', wert: 40 }, { art: 'level', wert: 3 }] },
    { key: 'zweite', paket: 'vereinswachstum', name: 'Zweite Mannschaft', icon: '🥈', screens: ['screen-second-team'], ziel: 'screen-second-team',
        text: 'Gründung und Führung einer zweiten Mannschaft.', bedingungen: [{ art: 'liga', wert: 3 }, { art: 'meister', wert: 1 }, { art: 'siege', wert: 50 }] },
    { key: 'frauen', paket: 'vereinswachstum', name: 'Frauenmannschaft', icon: '👩', screens: ['screen-women'], ziel: 'screen-women',
        text: 'Gründung und Führung einer Frauenmannschaft.', bedingungen: [{ art: 'liga', wert: 3 }, { art: 'meister', wert: 2 }, { art: 'tore', wert: 150 }] },
    { key: 'immobilien', paket: 'finanzwelt', name: 'Immobilien', icon: '🏘️', screens: ['screen-real-estate'], ziel: 'screen-real-estate',
        text: 'Immobilien kaufen, ausbauen und vermieten.', bedingungen: [{ art: 'liga', wert: 2 }, { art: 'pokal', wert: 1 }, { art: 'level', wert: 4 }] },
    { key: 'medienrechte', paket: 'grundspiel', name: 'Medienrechte-Partner', icon: '📺', screens: [], ziel: 'screen-finances',
        text: 'Eigener Medienpartner mit Handgeld und Zahlungen je Heimspiel.', bedingungen: [{ art: 'liga', wert: 2 }, { art: 'meister', wert: 2 }, { art: 'level', wert: 4 }] },
    { key: 'stadionanlagen', paket: 'vereinswachstum', name: 'Stadion-Anlagen', icon: '🏗️', screens: [], ziel: 'screen-stadium',
        text: 'Die 20 Stadion-Erweiterungen (Sicherheit, Komfort, Einnahmen, Heimvorteil).', bedingungen: [{ art: 'liga', wert: 2 }, { art: 'meister', wert: 3 }, { art: 'siege', wert: 100 }] },
    { key: 'aktien', paket: 'finanzwelt', name: 'Aktien & Kapitalmarkt', icon: '📈', screens: ['screen-stocks'], ziel: 'screen-stocks',
        text: 'Aktien, Optionen, Limits und Sparpläne.', bedingungen: [{ art: 'liga', wert: 1 }, { art: 'siege', wert: 150 }, { art: 'level', wert: 5 }] },
    { key: 'luxus', paket: 'grundspiel', name: 'Privatleben-Luxus', icon: '💎', screens: [], ziel: 'screen-private',
        text: 'Besitz ab 250.000 €, Reitpferd und große Nebenjobs im Privatleben.', bedingungen: [{ art: 'liga', wert: 1 }, { art: 'meister', wert: 3 }, { art: 'level', wert: 5 }] },
    { key: 'grossprojekte', paket: 'vereinswachstum', name: 'Große Ausbauprojekte', icon: '🏟️', screens: [], ziel: 'screen-stadium',
        text: 'Zusatztribüne, Ränge, Großausbau, zweiter Rang, Umbauten, Hybridrasen.', bedingungen: [{ art: 'liga', wert: 1 }, { art: 'meister', wert: 4 }, { art: 'tore', wert: 500 }] },
    { key: 'holding', paket: 'konzern', name: 'Holding & B2B', icon: '🏢', screens: ['screen-holding'], ziel: 'screen-holding',
        text: 'Holding-Konto, Überweisungen und B2B-Aufträge.', bedingungen: [{ art: 'liga', wert: 0 }, { art: 'spiele', wert: 300 }, { art: 'level', wert: 6 }] },
    { key: 'industrie', paket: 'konzern', name: 'Industrie & Rohstoffe', icon: '🏭', screens: ['screen-industry', 'screen-raw-materials'], ziel: 'screen-industry',
        text: 'Fabriken, Produktion, Rohstoffhandel und Übernahmen.', bedingungen: [{ art: 'bereich', wert: 'holding' }, { art: 'dmeister', wert: 1 }, { art: 'europa', wert: 1 }] }
];

// Freischalt-Tempo, beim neuen Spiel gewählt (game.freischaltTempo): schnell halbiert die Zahlen und
// verlangt eine Liga weniger; Deutscher Meister und Champions Cup bleiben. offen: alles von Anfang an.
const FREISCHALT_TEMPI = [
    { key: 'normal', name: 'Normal', text: 'Bereiche über die Laufbahn freispielen.' },
    { key: 'schnell', name: 'Schnell', text: 'Halbe Zahlen, eine Liga weniger.' },
    { key: 'offen', name: 'Alles offen', text: 'Ohne Freispielen, alles von Anfang an.' }
];

// Luxus im Privatleben (js/private-life.js, js/private-life-extra.js)
const LUXUS_MIN_KOSTEN = 250000;
const LUXUS_MIN_PRESTIGE = 30;
function istLuxusBesitz(a) { return !!a && a.cost >= LUXUS_MIN_KOSTEN; }
function istLuxusNebenjob(a) { return !!a && a.minPrestige >= LUXUS_MIN_PRESTIGE; }

function getFreischaltBereich(key) {
    return FREISCHALT_BEREICHE.find(b => b.key === key) || null;
}

// Nur Bereiche, deren Paket diese Fassung enthält (js/pakete.js).
function getAusgelieferteBereiche() {
    return FREISCHALT_BEREICHE.filter(b => typeof paketVorhanden !== 'function' || paketVorhanden(b.paket));
}

function getFreischaltTempo() {
    return FREISCHALT_TEMPI.some(t => t.key === game.freischaltTempo) ? game.freischaltTempo : 'normal';
}

// Bedingungen mit dem gewählten Tempo.
function getFreischaltBedingungen(b) {
    if (getFreischaltTempo() !== 'schnell') return b.bedingungen;
    return b.bedingungen.map(c => {
        if (c.art === 'liga') return { art: 'liga', wert: Math.min(NUM_LEAGUES - 1, c.wert + 1) };
        if (c.art === 'bereich' || c.art === 'dmeister' || c.art === 'europa') return c;
        return { art: c.art, wert: Math.max(1, Math.ceil(c.wert / 2)) };
    });
}

// Laufbahn-Zahlen: abgeschlossene Saisons plus die laufende, solange sie noch nicht archiviert ist.
function getFreischaltStand() {
    const liste = Array.isArray(game.managerCareer) ? game.managerCareer : [];
    const s = { spiele: 0, siege: 0, tore: 0, meister: 0, dmeister: 0, liga: game.leagueLevel };
    liste.forEach(e => {
        s.spiele += (e.won || 0) + (e.drawn || 0) + (e.lost || 0);
        s.siege += e.won || 0;
        s.tore += e.goalsFor || 0;
        if (e.rank === 1) { s.meister++; if (e.level === 0) s.dmeister++; }
        if (typeof e.level === 'number') s.liga = Math.min(s.liga, e.level);
    });
    if (!liste.some(e => e.season === game.season && e.club === game.clubName)) {
        const tab = (leaguesData[game.leagueLevel] || []).find(t => t.name === game.clubName) || {};
        s.spiele += (tab.won || 0) + (tab.drawn || 0) + (tab.lost || 0);
        s.siege += tab.won || 0;
        s.tore += tab.goalsFor || 0;
    }
    const trophaeen = Array.isArray(game.trophies) ? game.trophies : [];
    s.pokal = trophaeen.filter(t => /pokalsieger/i.test(t)).length;
    s.europa = trophaeen.filter(t => /Champions Cup Sieger/.test(t)).length;
    s.level = managerRPG.level;
    return s;
}

function bedingungErfuellt(c, s) {
    if (c.art === 'liga') return s.liga <= c.wert;
    if (c.art === 'bereich') return !!(game.freischaltungen && game.freischaltungen[c.wert]);
    return (s[c.art] || 0) >= c.wert;
}

function bedingungText(c) {
    const n = c.wert;
    switch (c.art) {
        case 'liga': return `${leagueNames[n]} erreicht`;
        case 'meister': return n === 1 ? '1 Meistertitel' : `${n} Meistertitel`;
        case 'dmeister': return 'Deutscher Meister';
        case 'siege': return `${n} Ligasiege`;
        case 'tore': return `${n} Ligatore`;
        case 'spiele': return `${n} Ligaspiele`;
        case 'pokal': return n === 1 ? '1 Pokalsieg' : `${n} Pokalsiege`;
        case 'europa': return 'Champions Cup gewonnen';
        case 'level': return `Manager-Level ${n}`;
        case 'bereich': return `${(getFreischaltBereich(n) || {}).name || n} freigeschaltet`;
        default: return '';
    }
}

// Was noch fehlt, kurz (Dashboard): „noch 12 Ligasiege“, „Regionalliga erreichen“.
function bedingungRest(c, s) {
    if (c.art === 'liga') return `${leagueNames[c.wert]} erreichen`;
    if (c.art === 'bereich' || c.art === 'dmeister' || c.art === 'europa') return bedingungText(c);
    if (c.art === 'level') return `Manager-Level ${c.wert} (jetzt ${s.level})`;
    return `noch ${bedingungText({ art: c.art, wert: Math.max(1, c.wert - (s[c.art] || 0)) })}`;
}

// Stand und Anteil (0 bis 1) für den Fortschrittsbalken.
function bedingungStand(c, s) {
    if (c.art === 'liga') {
        const unten = NUM_LEAGUES - 1;
        return { text: `bisher ${leagueNames[s.liga]}`, anteil: c.wert >= unten ? 1 : Math.max(0, Math.min(1, (unten - s.liga) / (unten - c.wert))) };
    }
    if (c.art === 'bereich') {
        const offen = bedingungErfuellt(c, s);
        return { text: offen ? 'offen' : 'noch gesperrt', anteil: offen ? 1 : 0 };
    }
    const ist = s[c.art] || 0;
    return { text: `${ist.toLocaleString('de-DE')} / ${c.wert.toLocaleString('de-DE')}`, anteil: Math.max(0, Math.min(1, ist / c.wert)) };
}

function istFreigeschaltet(key) {
    if (typeof adminAlleFreigeschaltet === 'function' && adminAlleFreigeschaltet()) return true;
    if (getFreischaltTempo() === 'offen') return true;
    return !!(game.freischaltungen && game.freischaltungen[key]);
}

// Für Aktionen: sagt per Toast, was noch fehlt (keine stillen Knöpfe).
function bereichGesperrt(key) {
    if (istFreigeschaltet(key)) return false;
    const b = getFreischaltBereich(key);
    if (!b) return false;
    const s = getFreischaltStand();
    const offen = getFreischaltBedingungen(b).filter(c => !bedingungErfuellt(c, s)).map(bedingungText);
    showToast(`🔒 ${b.name} ist noch gesperrt. Es fehlt: ${offen.join(', ')}.`, 'error', 5000);
    return true;
}

// Nach jedem Spieltag, am Saisonende (vor dem Saisonwechsel) und beim Laden. still: ohne Meldungen.
function pruefeFreischaltungen(still = false) {
    if (!game.freischaltungen || typeof game.freischaltungen !== 'object') game.freischaltungen = {};
    if (getFreischaltTempo() === 'offen') return [];
    const s = getFreischaltStand();
    const neu = [];
    getAusgelieferteBereiche().forEach(b => {
        if (game.freischaltungen[b.key]) return;
        if (getFreischaltBedingungen(b).every(c => bedingungErfuellt(c, s))) {
            game.freischaltungen[b.key] = { season: game.season, matchday: Math.min(34, game.matchday) };
            neu.push(b);
        }
    });
    if (neu.length && !still) {
        if (!game.freischaltNeu || typeof game.freischaltNeu !== 'object') game.freischaltNeu = {};
        neu.forEach(b => {
            game.freischaltNeu[b.key] = true;
            addInboxMessage('analyse', `🔓 Freigeschaltet: ${b.name}`, `${b.text} Geschafft mit: ${getFreischaltBedingungen(b).map(bedingungText).join(', ')}. Dazu gibt es 250 Manager-XP.`, b.ziel);
        });
        showNotice('🔓 Neuer Bereich freigeschaltet', neu.map(b => `${b.icon} ${b.name}: ${b.text}`).join('\n'));
        neu.forEach(() => addManagerXP(250));
    }
    if (neu.length) aktualisiereFreischaltSperren();
    return neu;
}

function renderFreischaltBedingungen(b, s) {
    return getFreischaltBedingungen(b).map(c => {
        const ok = bedingungErfuellt(c, s);
        const st = bedingungStand(c, s);
        return `<div class="freischalt-zeile">
            <div style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-caption);">
                <span>${ok ? '✅' : '⬜'} ${bedingungText(c)}</span>
                <span style="color:var(--text-muted); white-space:nowrap;">${st.text}</span>
            </div>
            <div class="freischalt-balken"><span style="width:${Math.round(st.anteil * 100)}%;"></span></div>
        </div>`;
    }).join('');
}

function renderFreischaltKarte(key) {
    const b = getFreischaltBereich(key);
    if (!b) return '';
    const s = getFreischaltStand();
    return `<div class="freischalt-karte box">
        <div class="ui-overline" style="color:var(--text-muted);">🔒 Noch gesperrt</div>
        <div style="font-size:var(--fs-title-sm); font-weight:900; margin:2px 0;">${b.icon} ${b.name}</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">${b.text} Darunter siehst du den Bereich schon als Vorschau; er öffnet sich, sobald alle Bedingungen erfüllt sind.</div>
        ${renderFreischaltBedingungen(b, s)}
        <button onclick="showScreen('screen-manager-tree')" class="btn-secondary" style="margin-top:6px;">🔓 Alle Freischaltungen ansehen</button>
    </div>`;
}

// Für Teilbereiche in fremden Bildschirmen (Stadion, Finanzen): Karte plus graue Vorschau. stil gilt
// für die Vorschau (z. B. ein Raster), beides spannt in einem Raster über alle Spalten.
function freischaltVorschau(key, html, stil = '') {
    if (istFreigeschaltet(key)) return html;
    return `<div style="grid-column:1 / -1;">${renderFreischaltKarte(key)}</div><div class="freischalt-vorschau" inert aria-hidden="true" style="grid-column:1 / -1; ${stil}">${html}</div>`;
}

// Ein gesperrter Bildschirm: Karte oben, der Rest wandert in eine graue, nicht bedienbare Vorschau.
function sperreFreischaltBildschirm(el, key, zu) {
    let karte = el.querySelector(':scope > .freischalt-karte');
    let vorschau = el.querySelector(':scope > .freischalt-vorschau');
    if (zu) {
        if (!vorschau) {
            vorschau = document.createElement('div');
            vorschau.className = 'freischalt-vorschau';
            el.appendChild(vorschau);
        }
        // auch Teile, die ein Neuzeichnen neben die Vorschau gesetzt hat
        [...el.children].forEach(k => { if (k !== vorschau && !k.classList.contains('freischalt-karte')) vorschau.appendChild(k); });
        vorschau.setAttribute('inert', '');
        vorschau.setAttribute('aria-hidden', 'true');
        if (!karte) { karte = document.createElement('div'); el.insertBefore(karte, el.firstChild); }
        karte.outerHTML = renderFreischaltKarte(key);
        el.classList.add('freischalt-gesperrt');
    } else {
        if (karte) karte.remove();
        if (vorschau) {
            while (vorschau.firstChild) el.insertBefore(vorschau.firstChild, vorschau);
            vorschau.remove();
        }
        el.classList.remove('freischalt-gesperrt');
    }
}

// Knöpfe, die einen Bereich öffnen: im Hub der Reiter plus (für NEU) der Menüpunkt des Hubs.
function getFreischaltKnoepfe(b, mitMenue) {
    const ziele = b.screens.length ? b.screens : [b.ziel];
    const knoepfe = new Set();
    ziele.forEach(id => {
        const hub = typeof SUB_SCREEN_TO_HUB !== 'undefined' && SUB_SCREEN_TO_HUB[id];
        if (hub) {
            const reiter = document.getElementById('hubtab-btn-' + id);
            if (reiter) knoepfe.add(reiter);
            if (mitMenue) (HUB_MEMBERS[hub] || []).forEach(m => document.querySelectorAll(`.nav-btn[onclick*="showScreen('${m}')"]`).forEach(k => knoepfe.add(k)));
        } else {
            document.querySelectorAll(`button[onclick*="showScreen('${id}')"]`).forEach(k => knoepfe.add(k));
        }
    });
    return [...knoepfe];
}

// Am Ende von showScreen(): Vorschau und Schlösser setzen; ein besuchter Bereich verliert sein NEU.
function aktualisiereFreischaltSperren(screenId = null) {
    const neuListe = game.freischaltNeu && typeof game.freischaltNeu === 'object' ? game.freischaltNeu : {};
    FREISCHALT_BEREICHE.forEach(b => {
        const zu = !istFreigeschaltet(b.key);
        b.screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) sperreFreischaltBildschirm(el, b.key, zu);
        });
        if (screenId && neuListe[b.key] && (b.screens.includes(screenId) || b.ziel === screenId)) delete neuListe[b.key];
    });
    document.querySelectorAll('.freischalt-zu, .freischalt-neu').forEach(k => k.classList.remove('freischalt-zu', 'freischalt-neu'));
    FREISCHALT_BEREICHE.forEach(b => {
        if (b.screens.length && !istFreigeschaltet(b.key)) getFreischaltKnoepfe(b, false).forEach(k => k.classList.add('freischalt-zu'));
        else if (neuListe[b.key]) getFreischaltKnoepfe(b, true).forEach(k => k.classList.add('freischalt-neu'));
    });
}

// Einmal beim ersten Laden eines Stands von vor dem System: was offen ist und was ruht.
function meldeFreischaltungenEingefuehrt(offen) {
    const zu = getAusgelieferteBereiche().filter(b => !istFreigeschaltet(b.key));
    if (!zu.length) return;
    addInboxMessage('analyse', '🔓 Neu: Freischaltungen', `Einige Bereiche öffnen sich jetzt erst über Erfolge deiner Laufbahn. Nach deiner bisherigen Bilanz ${offen.length ? `offen: ${offen.map(b => b.name).join(', ')}` : 'ist noch keiner offen'}. Gesperrt, bis die Bedingungen erfüllt sind: ${zu.map(b => b.name).join(', ')}. Was dort schon läuft, ruht so lange. Alle Bedingungen stehen im Manager-Talentbaum.`, 'screen-manager-tree');
}

// Der gesperrte Bereich mit dem meisten Fortschritt (Durchschnitt der Balken), für das Dashboard.
function getNaechsteFreischaltung() {
    const s = getFreischaltStand();
    let beste = null;
    getAusgelieferteBereiche().forEach(b => {
        if (istFreigeschaltet(b.key)) return;
        const bed = getFreischaltBedingungen(b);
        const anteil = bed.reduce((t, c) => t + (bedingungErfuellt(c, s) ? 1 : bedingungStand(c, s).anteil), 0) / bed.length;
        if (!beste || anteil > beste.anteil) beste = { b, anteil, fehlt: bed.filter(c => !bedingungErfuellt(c, s)).map(c => bedingungRest(c, s)) };
    });
    return beste;
}

function renderNaechsteFreischaltung() {
    const box = document.getElementById('dashboard-freischaltung-box');
    if (!box) return;
    const n = getNaechsteFreischaltung();
    if (!n) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = `<div class="box" style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
        <div style="font-size:var(--fs-title); line-height:1;">${n.b.icon}</div>
        <div style="flex:1; min-width:0;">
            <div class="ui-overline" style="color:var(--text-muted);">🔓 Nächste Freischaltung</div>
            <div style="font-weight:800;">${n.b.name}</div>
            <div style="font-size:var(--fs-caption); color:var(--text-muted);">Es fehlt: ${n.fehlt.join(', ')}</div>
            <div class="freischalt-balken"><span style="width:${Math.round(n.anteil * 100)}%;"></span></div>
        </div>
        <button onclick="showScreen('screen-manager-tree')" class="btn-secondary" style="flex:0 0 auto; width:auto; font-size:var(--fs-caption);">Alle</button>
    </div>`;
}

// Für den Saisonrückblick (js/season-end.js): in der Saison freigeschaltete Bereiche.
function getFreischaltungenDerSaison(saison) {
    const liste = game.freischaltungen && typeof game.freischaltungen === 'object' ? game.freischaltungen : {};
    return FREISCHALT_BEREICHE.filter(b => liste[b.key] && liste[b.key].season === saison);
}

// Spielstart (js/save.js): Wahl des Freischalt-Tempos.
let selectedNewGameTempo = 'normal';
function renderNewGameTempoOptions() {
    const box = document.getElementById('new-game-tempo-btns');
    if (!box) return;
    box.innerHTML = FREISCHALT_TEMPI.map(t => `<button onclick="selectedNewGameTempo='${t.key}'; renderNewGameTempoOptions();" class="${t.key === selectedNewGameTempo ? 'btn-action' : 'btn-secondary'}" style="font-size:var(--fs-caption); padding:5px 2px;">${t.name}<br><span style="font-size:var(--fs-micro);">${t.text}</span></button>`).join('');
}

// Übersicht im Manager-Talentbaum: alle Bereiche mit Stand.
function renderFreischaltUebersicht() {
    const box = document.getElementById('freischaltungen-box');
    if (!box) return;
    const s = getFreischaltStand();
    const bereiche = getAusgelieferteBereiche();
    const offen = bereiche.filter(b => istFreigeschaltet(b.key)).length;
    const tempo = FREISCHALT_TEMPI.find(t => t.key === getFreischaltTempo());
    box.innerHTML = `
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Manche Bereiche ergeben erst mit einem gewachsenen Verein Sinn. Sie öffnen sich über Erfolge deiner Laufbahn: Liga, Titel, Siege, Tore, Pokale und Manager-Level. Gesperrte Bereiche siehst du schon als graue Vorschau. Offen bleibt offen, auch nach einem Abstieg.</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
            ${uiChip(`${offen} von ${bereiche.length} offen`, offen === bereiche.length ? 'gut' : '')}${uiChip(`Tempo: ${tempo.name}`)}
            ${uiChip(`${s.spiele.toLocaleString('de-DE')} Ligaspiele`)}${uiChip(`${s.siege.toLocaleString('de-DE')} Siege`)}${uiChip(`${s.tore.toLocaleString('de-DE')} Tore`)}
            ${uiChip(`${s.meister} Meistertitel`)}${uiChip(`${s.pokal} Pokalsiege`)}${uiChip(`Level ${s.level}`)}
        </div>
        ${bereiche.map(b => {
            const info = game.freischaltungen && game.freischaltungen[b.key];
            if (istFreigeschaltet(b.key)) {
                const seit = info ? `Offen seit Saison ${info.season}, Spieltag ${info.matchday}` : (getFreischaltTempo() === 'offen' ? 'Offen (Tempo „Alles offen“)' : 'Offen (Entwickler-Schalter)');
                return `<div class="box freischalt-eintrag" style="display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:4px;">
                    <span><strong>${b.icon} ${b.name}</strong>${game.freischaltNeu && game.freischaltNeu[b.key] ? ' ' + uiChip('NEU', 'gut') : ''}<br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${seit}</span></span>
                    <button onclick="showScreen('${b.ziel}')" class="btn-secondary" style="flex:0 0 auto; width:auto; font-size:var(--fs-caption);">Öffnen</button>
                </div>`;
            }
            return `<div class="box freischalt-eintrag freischalt-eintrag-zu" style="margin-bottom:4px;">
                <div style="margin-bottom:4px;"><strong>🔒 ${b.icon} ${b.name}</strong> <span style="font-size:var(--fs-caption); color:var(--text-muted);">${b.text}</span></div>
                ${renderFreischaltBedingungen(b, s)}
            </div>`;
        }).join('')}`;
}
