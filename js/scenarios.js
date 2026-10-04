/* eslint-disable no-undef */
// Karriere-Szenarien: beim "Neues Spiel" wählbare Herausforderungen mit eigenem Start
// (Liga, Kader, Kasse, Fans) und einem klaren Ziel samt Frist. Bewertet wird am Saisonende
// (evaluateScenarioAtSeasonEnd() nach Auf-/Abstieg), mit 1-3 Sternen bei Erfolg. Danach
// geht die Karriere als freies Spiel weiter. Zustand: game.scenario, Abschlüsse in
// game.scenarioResults.

const CAREER_SCENARIOS = {
    absteiger: {
        title: '🆘 Rettet den Absteiger', level: 2, seasons: 1,
        desc: 'Ein Drittligist mit zu schwachem Kader, fast leerer Kasse und müden Fans. Ziel: Klassenerhalt in der ersten Saison (auch über die Relegation).',
        setup() {
            squad.forEach(p => { p.strength = Math.max(30, p.strength - 11); p.marketValue = calculatePlayerMarketValue(p.strength); });
            game.money = 120000; game.fans = 35; game.boardSat = 45;
        },
        check(s) {
            if (game.leagueLevel > s.startLevel) return { done: true, ok: false, text: 'Abgestiegen - der Verein war nicht zu retten.' };
            const sterne = s.lastRank <= 10 ? 3 : (s.lastRank <= 14 ? 2 : 1);
            return { done: true, ok: true, stars: sterne, text: `Klassenerhalt auf Platz ${s.lastRank}${sterne === 1 ? ' (über die Relegation bzw. auf den letzten Drücker)' : ''}.` };
        }
    },
    pleite: {
        title: '💸 Pleiteklub sanieren', level: 3, seasons: 2,
        desc: 'Ein Viertligist mit 600.000 € Schulden auf dem Konto und überhöhten Gehältern. Im Minus drohen Transfersperre und alle 10 Spieltage ein Zwangsverkauf. Ziel: binnen zwei Saisons schwarze Zahlen (offene Kredite zählen als Schulden), ohne abzusteigen - saniert der Vorstand per Zwangsverkauf, kostet das Sterne, ab zwei Zwangsverkäufen gilt die Sanierung als gescheitert.',
        setup() {
            squad.forEach(p => { p.wage = Math.round(p.wage * 1.15 / 10) * 10; });
            game.money = -600000; game.boardSat = 50;
        },
        check(s) {
            if (game.leagueLevel > s.startLevel) return { done: true, ok: false, text: 'Abgestiegen - die Sanierung ist gescheitert.' };
            const jahre = game.season - s.startSeason;
            // Zwangsverkäufe (checkInsolvencyRisk) sanieren den Verein ohne Zutun des Managers:
            // im Langzeittest 20.6 war das Szenario so auch ganz ohne Eingriff nach einer Saison
            // mit 3 Sternen geschafft (zwei Zwangsverkäufe à ~380.000 €).
            const zwang = getScenarioForcedSales(s);
            if (zwang >= 2) return { done: true, ok: false, text: `Der Vorstand musste ${zwang} Spieler zwangsverkaufen - saniert hat nicht der Manager.` };
            const netto = getScenarioNetCash();
            if (netto >= 0) {
                const sterne = Math.max(1, (jahre === 1 ? 3 : (netto >= 250000 ? 2 : 1)) - zwang);
                return { done: true, ok: true, stars: sterne, text: `Saniert nach ${jahre} Saison${jahre > 1 ? 's' : ''}: ${formatVal(netto)} ohne Kreditschulden${zwang ? ' (ein Zwangsverkauf kostet einen Stern)' : ''}.` };
            }
            if (jahre >= this.seasons) return { done: true, ok: false, text: `Nach ${jahre} Saisons noch immer ${formatVal(netto)} im Minus (Kredite eingerechnet).` };
            return { done: false, text: `Noch ${formatVal(-netto)} bis zur schwarzen Null (Kredite eingerechnet).` };
        }
    },
    tradition: {
        title: '🏛️ Traditionsverein zurück nach oben', level: 4, seasons: 4,
        desc: 'Ein abgestürzter Traditionsklub in der 5. Liga: großes Stadion, treue Fans, ungeduldiger Vorstand. Ziel: binnen vier Saisons zurück in die 3. Liga.',
        setup() {
            game.fans = 85; game.boardSat = 55;
            Object.values(stadium.blocks || {}).forEach(b => { if (b && typeof b.cap === 'number') b.cap = Math.round(b.cap * 1.6 / 50) * 50; });
        },
        check(s) {
            const jahre = game.season - s.startSeason;
            if (game.leagueLevel <= 2) {
                const sterne = jahre <= 2 ? 3 : (jahre === 3 ? 2 : 1);
                return { done: true, ok: true, stars: sterne, text: `Zurück in der 3. Liga nach ${jahre} Saisons.` };
            }
            if (jahre >= this.seasons) return { done: true, ok: false, text: `Nach ${jahre} Saisons noch in der ${leagueNames[game.leagueLevel]}.` };
            return { done: false, text: `Aktuell ${leagueNames[game.leagueLevel]} - noch ${this.seasons - jahre} Saison${this.seasons - jahre > 1 ? 's' : ''}.` };
        }
    },
    titel: {
        title: '🏆 Meister oder Chaos', level: 0, seasons: 1,
        desc: 'Ein Erstligist mit Starensemble und einem Vorstand, der nur eines akzeptiert. Ziel: Meisterschaft in der ersten Saison.',
        setup() {
            squad.forEach(p => { p.strength = Math.min(95, p.strength + 3); p.marketValue = calculatePlayerMarketValue(p.strength); });
            game.boardSat = 55;
        },
        check(s) {
            if (s.lastRank === 1) return { done: true, ok: true, stars: 3, text: 'Deutscher Meister in der ersten Saison!' };
            return { done: true, ok: false, text: `Nur Platz ${s.lastRank} - der Vorstand hatte den Titel verlangt.` };
        }
    }
};

let selectedNewGameScenario = null;

// Pleite-Szenario: Kontostand abzüglich offener Kredite - sonst "saniert" ein Kredit sofort.
function getScenarioNetCash() {
    const raten = (typeof activeLoans !== 'undefined' ? activeLoans : []).reduce((a, l) => a + l.installment * l.matchdaysLeft, 0);
    return game.money - (game.loanDebt || 0) - raten;
}

function getScenarioForcedSales(s) {
    return Math.max(0, (game.forcedSalesCount || 0) - ((s && s.forcedAtStart) || 0));
}

// Neues Spiel (window.onload nach dem Reload): Szenario-Start anwenden.
function applyScenarioStart(id) {
    const sc = CAREER_SCENARIOS[id];
    if (!sc) return;
    sc.setup();
    game.scenario = { id, startSeason: game.season, startLevel: game.leagueLevel, lastRank: null, status: 'aktiv', forcedAtStart: game.forcedSalesCount || 0 };
    addInboxMessage('vertrag', `${sc.title}: Die Mission beginnt`, `${sc.desc}\n\nFrist: ${sc.seasons} Saison${sc.seasons > 1 ? 's' : ''}. Bewertet wird jeweils am Saisonende.`, 'screen-dashboard');
}

// Saisonende (vor Auf-/Abstieg): Abschlussplatz merken.
function recordScenarioSeasonRank(rank) {
    if (game.scenario && game.scenario.status === 'aktiv') game.scenario.lastRank = rank;
}

// Saisonende (nach Auf-/Abstieg und Saisonwechsel): Ziel prüfen.
function evaluateScenarioAtSeasonEnd() {
    const s = game.scenario;
    if (!s || s.status !== 'aktiv') return null;
    const sc = CAREER_SCENARIOS[s.id];
    if (!sc) return null;
    const r = sc.check(s);
    if (!r.done) {
        addInboxMessage('vertrag', `${sc.title}: Zwischenstand`, r.text, 'screen-dashboard');
        return r;
    }
    s.status = r.ok ? 'geschafft' : 'gescheitert';
    s.stars = r.ok ? r.stars : 0;
    s.result = r.text;
    s.endSeason = game.season - 1;
    if (!game.scenarioResults) game.scenarioResults = [];
    game.scenarioResults.unshift({ id: s.id, title: sc.title, ok: r.ok, stars: s.stars, text: r.text, season: s.endSeason });
    if (r.ok && typeof addManagerXP === 'function') addManagerXP(300 * r.stars);
    showNotice(r.ok ? `${sc.title}: geschafft ${'⭐'.repeat(r.stars)}` : `${sc.title}: gescheitert`,
        `${r.text}\n\n${r.ok ? `Bewertung: ${'⭐'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} (+${300 * r.stars} Manager-XP).` : 'Die Karriere geht trotzdem weiter.'}`, { typ: r.ok ? 'info' : 'warn' });
    addInboxMessage('vertrag', `${sc.title}: ${r.ok ? 'geschafft' : 'gescheitert'}`, r.text, 'screen-dashboard');
    return r;
}

function renderScenarioCard() {
    const box = document.getElementById('dash-scenario-box');
    if (!box) return;
    const s = game.scenario;
    const sc = s ? CAREER_SCENARIOS[s.id] : null;
    if (!sc) { box.innerHTML = ''; return; }
    let inhalt;
    if (s.status === 'aktiv') {
        const restSaisons = s.startSeason + sc.seasons - game.season;
        const zwang = s.id === 'pleite' ? `<div style="margin-top:2px;">💸 Zwangsverkäufe: ${getScenarioForcedSales(s)} / 2${game.money < 0 ? ` · ${game.negativeStreak || 0} Spieltage im Minus (alle 10 ein Zwangsverkauf)` : ''}</div>` : '';
        inhalt = `<div style="color:var(--text-muted);">${sc.desc}</div><div style="margin-top:4px;">⏳ Bewertung am Ende von Saison ${game.season}${restSaisons > 0 ? ` · Frist bis Saison ${s.startSeason + sc.seasons - 1}` : ''}</div>${zwang}`;
    } else {
        inhalt = `<div>${s.status === 'geschafft' ? `✅ Geschafft ${'⭐'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}` : '❌ Gescheitert'} - ${s.result}</div><div style="color:var(--text-muted); margin-top:2px;">Die Karriere läuft als freies Spiel weiter.</div>`;
    }
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--accent); margin-bottom:6px;">🎯 <strong>Szenario: ${sc.title}</strong>${inhalt}</div>`;
}

function renderNewGameScenarioOptions() {
    const box = document.getElementById('new-game-scenario-btns');
    if (!box) return;
    const knopf = (id, text) => `<button onclick="selectNewGameScenario(${id ? `'${id}'` : 'null'})" class="${selectedNewGameScenario === id ? 'btn-action' : 'btn-secondary'}" style="font-size:9px; padding:5px 2px;">${text}</button>`;
    const sc = selectedNewGameScenario ? CAREER_SCENARIOS[selectedNewGameScenario] : null;
    box.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
        ${knopf(null, '🎮 Freies Spiel')}
        ${Object.entries(CAREER_SCENARIOS).map(([id, s]) => knopf(id, s.title)).join('')}
    </div>
    <div style="font-size:9px; color:var(--text-muted); margin-top:4px;">${sc ? `${sc.desc} (Startliga: ${leagueNames[sc.level]}, Liga- und Kapitalwahl entfallen.)` : 'Freies Spiel: Liga und Startkapital frei wählbar, kein festes Ziel.'}</div>`;
}

function selectNewGameScenario(id) {
    selectedNewGameScenario = id;
    renderNewGameScenarioOptions();
}
