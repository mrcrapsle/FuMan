// Freischaltungen (Board-Karte „Freischaltungssystem“): Bereiche, die erst mit einem gewachsenen
// Verein Sinn ergeben, öffnen sich über echte Erfolge der Manager-Laufbahn: höchste erreichte Liga,
// Meistertitel, Ligasiege und -tore, Pokale, Champions Cup und Manager-Level. Die Zahlen kommen aus
// game.managerCareer (abgeschlossene Saisons, js/manager-analytics.js) plus der laufenden Saison.
// Gesperrt heißt: der Bildschirm zeigt die Bedingungen, Aktionen sagen per Toast warum nicht, und
// laufender Betrieb ruht (Fabriken, Mieten, Stadion-Anlagen, Sparpläne, Training der Zweiten).
// Einmal offen, bleibt ein Bereich offen (game.freischaltungen, auch nach Abstieg oder Vereinswechsel).

// Reihenfolge zählt: ein Bereich, der einen anderen voraussetzt ('bereich'), steht dahinter.
const FREISCHALT_BEREICHE = [
    { key: 'wetten', name: 'Sportwetten', icon: '🎲', screens: ['screen-betting'], ziel: 'screen-betting',
        text: 'Wetten auf eigene Spiele.', bedingungen: [{ art: 'spiele', wert: 68 }, { art: 'level', wert: 3 }] },
    { key: 'zweite', name: 'Zweite Mannschaft', icon: '🥈', screens: ['screen-second-team'], ziel: 'screen-second-team',
        text: 'Gründung und Führung einer zweiten Mannschaft.', bedingungen: [{ art: 'liga', wert: 3 }, { art: 'meister', wert: 1 }, { art: 'siege', wert: 50 }] },
    { key: 'frauen', name: 'Frauenmannschaft', icon: '👩', screens: ['screen-women'], ziel: 'screen-women',
        text: 'Gründung und Führung einer Frauenmannschaft.', bedingungen: [{ art: 'liga', wert: 3 }, { art: 'meister', wert: 2 }, { art: 'tore', wert: 150 }] },
    { key: 'immobilien', name: 'Immobilien', icon: '🏘️', screens: ['screen-real-estate'], ziel: 'screen-real-estate',
        text: 'Immobilien kaufen, ausbauen und vermieten.', bedingungen: [{ art: 'liga', wert: 2 }, { art: 'pokal', wert: 1 }, { art: 'level', wert: 4 }] },
    { key: 'stadionanlagen', name: 'Stadion-Anlagen', icon: '🏗️', screens: [], ziel: 'screen-stadium',
        text: 'Die 20 Stadion-Erweiterungen (Sicherheit, Komfort, Einnahmen, Heimvorteil).', bedingungen: [{ art: 'liga', wert: 2 }, { art: 'meister', wert: 3 }, { art: 'siege', wert: 100 }] },
    { key: 'aktien', name: 'Aktien & Kapitalmarkt', icon: '📈', screens: ['screen-stocks'], ziel: 'screen-stocks',
        text: 'Aktien, Optionen, Limits und Sparpläne.', bedingungen: [{ art: 'liga', wert: 1 }, { art: 'siege', wert: 150 }, { art: 'level', wert: 5 }] },
    { key: 'grossprojekte', name: 'Große Ausbauprojekte', icon: '🏟️', screens: [], ziel: 'screen-stadium',
        text: 'Zusatztribüne, Ränge, Großausbau, zweiter Rang, Umbauten, Hybridrasen.', bedingungen: [{ art: 'liga', wert: 1 }, { art: 'meister', wert: 4 }, { art: 'tore', wert: 500 }] },
    { key: 'holding', name: 'Holding & B2B', icon: '🏢', screens: ['screen-holding'], ziel: 'screen-holding',
        text: 'Holding-Konto, Überweisungen und B2B-Aufträge.', bedingungen: [{ art: 'liga', wert: 0 }, { art: 'spiele', wert: 300 }, { art: 'level', wert: 6 }] },
    { key: 'industrie', name: 'Industrie & Rohstoffe', icon: '🏭', screens: ['screen-industry', 'screen-raw-materials'], ziel: 'screen-industry',
        text: 'Fabriken, Produktion, Rohstoffhandel und Übernahmen.', bedingungen: [{ art: 'bereich', wert: 'holding' }, { art: 'dmeister', wert: 1 }, { art: 'europa', wert: 1 }] }
];

function getFreischaltBereich(key) {
    return FREISCHALT_BEREICHE.find(b => b.key === key) || null;
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
    return !!(game.freischaltungen && game.freischaltungen[key]);
}

// Für Aktionen: sagt per Toast, was noch fehlt (keine stillen Knöpfe).
function bereichGesperrt(key) {
    if (istFreigeschaltet(key)) return false;
    const b = getFreischaltBereich(key);
    if (!b) return false;
    const s = getFreischaltStand();
    const offen = b.bedingungen.filter(c => !bedingungErfuellt(c, s)).map(bedingungText);
    showToast(`🔒 ${b.name} ist noch gesperrt. Es fehlt: ${offen.join(', ')}.`, 'error', 5000);
    return true;
}

// Nach jedem Spieltag, am Saisonende und beim Laden. still: ohne Meldungen (alte Spielstände).
function pruefeFreischaltungen(still = false) {
    if (!game.freischaltungen || typeof game.freischaltungen !== 'object') game.freischaltungen = {};
    const s = getFreischaltStand();
    const neu = [];
    FREISCHALT_BEREICHE.forEach(b => {
        if (game.freischaltungen[b.key]) return;
        if (b.bedingungen.every(c => bedingungErfuellt(c, s))) {
            game.freischaltungen[b.key] = { season: game.season, matchday: Math.min(34, game.matchday) };
            neu.push(b);
        }
    });
    if (neu.length && !still) {
        neu.forEach(b => {
            addInboxMessage('analyse', `🔓 Freigeschaltet: ${b.name}`, `${b.text} Geschafft mit: ${b.bedingungen.map(bedingungText).join(', ')}. Dazu gibt es 250 Manager-XP.`, b.ziel);
        });
        showNotice('🔓 Neuer Bereich freigeschaltet', neu.map(b => `${b.icon} ${b.name}: ${b.text}`).join('\n'));
        neu.forEach(() => addManagerXP(250));
    }
    if (neu.length) aktualisiereFreischaltSperren();
    return neu;
}

function renderFreischaltBedingungen(b, s) {
    return b.bedingungen.map(c => {
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
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">${b.text} Dieser Bereich öffnet sich, sobald alle Bedingungen erfüllt sind.</div>
        ${renderFreischaltBedingungen(b, s)}
        <button onclick="showScreen('screen-manager-tree')" class="btn-secondary" style="margin-top:6px;">🔓 Alle Freischaltungen ansehen</button>
    </div>`;
}

// Gesperrte Bildschirme zeigen nur die Karte; Menü- und Reiterknöpfe tragen ein Schloss.
function aktualisiereFreischaltSperren() {
    FREISCHALT_BEREICHE.forEach(b => {
        const zu = !istFreigeschaltet(b.key);
        b.screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                let karte = el.querySelector(':scope > .freischalt-karte');
                if (zu) {
                    if (!karte) { karte = document.createElement('div'); el.insertBefore(karte, el.firstChild); }
                    karte.outerHTML = renderFreischaltKarte(b.key);
                    el.classList.add('freischalt-gesperrt');
                } else {
                    if (karte) karte.remove();
                    el.classList.remove('freischalt-gesperrt');
                }
            }
            // In einem Hub nur der Reiter: der Menüpunkt öffnet auch offene Nachbarn (z. B. den Fanshop).
            const imHub = typeof SUB_SCREEN_TO_HUB !== 'undefined' && SUB_SCREEN_TO_HUB[id];
            const knoepfe = imHub ? [document.getElementById('hubtab-btn-' + id)] : document.querySelectorAll(`button[onclick*="showScreen('${id}')"]`);
            knoepfe.forEach(btn => { if (btn) btn.classList.toggle('freischalt-zu', zu); });
        });
    });
}

// Einmal beim ersten Laden eines Stands von vor dem System: was offen ist und was ruht.
function meldeFreischaltungenEingefuehrt(offen) {
    const zu = FREISCHALT_BEREICHE.filter(b => !game.freischaltungen[b.key]);
    if (!zu.length) return;
    addInboxMessage('analyse', '🔓 Neu: Freischaltungen', `Einige Bereiche öffnen sich jetzt erst über Erfolge deiner Laufbahn. Nach deiner bisherigen Bilanz ${offen.length ? `offen: ${offen.map(b => b.name).join(', ')}` : 'ist noch keiner offen'}. Gesperrt, bis die Bedingungen erfüllt sind: ${zu.map(b => b.name).join(', ')}. Was dort schon läuft, ruht so lange. Alle Bedingungen stehen im Manager-Talentbaum.`, 'screen-manager-tree');
}

// Übersicht im Manager-Talentbaum: alle Bereiche mit Stand.
function renderFreischaltUebersicht() {
    const box = document.getElementById('freischaltungen-box');
    if (!box) return;
    const s = getFreischaltStand();
    const offen = FREISCHALT_BEREICHE.filter(b => istFreigeschaltet(b.key)).length;
    box.innerHTML = `
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:6px;">Manche Bereiche ergeben erst mit einem gewachsenen Verein Sinn. Sie öffnen sich über Erfolge deiner Laufbahn: Liga, Titel, Siege, Tore, Pokale und Manager-Level. Offen bleibt offen, auch nach einem Abstieg.</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
            ${uiChip(`${offen} von ${FREISCHALT_BEREICHE.length} offen`, offen === FREISCHALT_BEREICHE.length ? 'gut' : '')}
            ${uiChip(`${s.spiele.toLocaleString('de-DE')} Ligaspiele`)}${uiChip(`${s.siege.toLocaleString('de-DE')} Siege`)}${uiChip(`${s.tore.toLocaleString('de-DE')} Tore`)}
            ${uiChip(`${s.meister} Meistertitel`)}${uiChip(`${s.pokal} Pokalsiege`)}${uiChip(`Level ${s.level}`)}
        </div>
        ${FREISCHALT_BEREICHE.map(b => {
            const info = game.freischaltungen && game.freischaltungen[b.key];
            if (istFreigeschaltet(b.key)) {
                return `<div class="box freischalt-eintrag" style="display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:4px;">
                    <span><strong>${b.icon} ${b.name}</strong><br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${info ? `Offen seit Saison ${info.season}, Spieltag ${info.matchday}` : 'Offen (Entwickler-Schalter)'}</span></span>
                    <button onclick="showScreen('${b.ziel}')" class="btn-secondary" style="flex:0 0 auto; width:auto; font-size:var(--fs-caption);">Öffnen</button>
                </div>`;
            }
            return `<div class="box freischalt-eintrag" style="margin-bottom:4px;">
                <div style="margin-bottom:4px;"><strong>🔒 ${b.icon} ${b.name}</strong> <span style="font-size:var(--fs-caption); color:var(--text-muted);">${b.text}</span></div>
                ${renderFreischaltBedingungen(b, s)}
            </div>`;
        }).join('')}`;
}
