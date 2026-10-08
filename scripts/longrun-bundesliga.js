// Langzeittest (Phase 21.6, Startliga per LIGA=0..5, Standard Bundesliga): ein Bot spielt N Saisons im gebauten Spiel und
// schreibt je Saison Platz, Geld, Budgets, Gehaltssumme, Kaderstärke, Pokal/Europa und Vorstand.
//   node scripts/longrun-bundesliga.js [saisons=20] [modus=aktiv|passiv] [läufe=1] [datei]
// aktiv:  verlängert gute auslaufende Verträge (auch Legenden/Publikumslieblinge bis 33), kauft in
//         den Fenstern Verstärkungen, löst Ultimaten nach jedem Spieltag, führt das Wintergespräch
//         und hält die Mitgliederversammlung mit passender Rede. Fehlt einer Position Tiefe,
//         zieht er Jugendspieler hoch oder holt Vereinslose. Als Aufstiegskandidat (Platz <= 6)
//         baut er die Lizenzauflagen der nächsthöheren Liga und spart dafür in den Fenstern.
//         Sponsoren: nimmt eingetroffene Angebote an (Haupt, Ausrüster, Ärmel, Banden, Namensrechte).
//         Mehr als 24 Spieler: verkauft in den Fenstern die schwächsten Nicht-Stammspieler (ab 21 J.).
//         Über dem Gehaltsbudget gibt er die teuersten Nicht-Stammspieler ab (z. B. nach einem Abstieg).
//         Tabelle: K/V = Käufe/Verkäufe der Saison, E = Platzerwartung des Vorstands,
//         J = eigene Jugendspieler in der besten Elf / im Kader. Talente ab Kader-Median-Stärke zieht er hoch.
//         Talentangebote: verkauft (mit Beteiligung), wessen Potenzial unter dem Kader-Median liegt; TV = Erlös.
// passiv: spielt nur, der Kader wird nie angefasst.
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const { chromium } = require(path.join(root, 'tests/node_modules/playwright'));
const saisons = parseInt(process.argv[2] || '20', 10);
const modus = process.argv[3] || 'aktiv';
const laeufe = parseInt(process.argv[4] || '1', 10);
const datei = path.resolve(root, process.argv[5] || 'dist/anstoss-fm13-standalone.html');

const LIGA_START = parseInt(process.env.LIGA || '0', 10);
const mio = v => (v / 1e6).toFixed(1).padStart(6);

async function karriere(browser, lauf) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    await page.goto('file://' + datei);
    await page.evaluate((liga) => {
        sessionStorage.setItem('anstoss_fm13_force_new_game', '1');
        sessionStorage.setItem('anstoss_fm13_newgame_leaguelevel', String(liga));
        sessionStorage.setItem('anstoss_fm13_newgame_money', '150000');
    }, LIGA_START);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('app-loading'));
    // BOARDDIAG=1: jede Änderung der Vorstandszufriedenheit der aufrufenden Funktion zuordnen.
    if (process.env.BOARDDIAG) await page.evaluate(() => {
        let wert = game.boardSat;
        window.__board = {};
        Object.defineProperty(game, 'boardSat', {
            configurable: true, enumerable: true,
            get() { return wert; },
            set(v) {
                const d = v - wert;
                if (d) {
                    const namen = (new Error().stack || '').split('\n').slice(2)
                        .map(l => (l.match(/at (?:Object\.)?([\w$.]+) \(/) || [])[1]).filter(Boolean);
                    const k = namen.find(n => !/^(Array|eval|Object)/.test(n)) || '?';
                    window.__board[k] = (window.__board[k] || 0) + d;
                }
                wert = v;
            }
        });
    });
    // VBDIAG=1 (25.19): Buchungen ohne eigenen Buchungstext (landen unter dem offenen Bildschirm,
    // im Bot "Vereinsbüro") der auslösenden Funktion zuordnen.
    if (process.env.VBDIAG) await page.evaluate(() => {
        const orig = protokolliereBuchung;
        window.__vb = {};
        protokolliereBuchung = function (delta) {
            if (/Vereinsbüro|Sonstige Buchung/.test(buchungsLabelErmitteln())) {
                const namen = (new Error().stack || '').split('\n').slice(2)
                    .map(l => (l.match(/at (?:Object\.)?([\w$.]+) \(/) || [])[1]).filter(Boolean)
                    .filter(n => !/^(Object|Array|eval|set|get)$/.test(n));
                const k = namen.slice(0, 2).join('<') || '?';
                window.__vb[k] = (window.__vb[k] || 0) + delta;
            }
            return orig.apply(this, arguments);
        };
    });
    // STRDIAG=1: je eigenem Ligaspiel die Spielstärke zerlegen (Elf, Fitness, Form, Moral, Boni).
    if (process.env.STRDIAG) await page.evaluate(() => {
        const orig = getOwnLeagueMatchStrength;
        window.__str = [];
        getOwnLeagueMatchStrength = function (isHome, opp) {
            const wert = orig.apply(this, arguments);
            const elf = squad.filter(p => lineup.includes(p.id));
            const schnitt = f => elf.reduce((a, p) => a + f(p), 0) / Math.max(1, elf.length);
            const basis = elf.reduce((a, p) => a + p.strength * (p.fitness / 100) * (0.9 + (p.dailyForm ?? 50) / 500), 0) / Math.max(11, elf.length);
            window.__str.push({ wert, opp: opp ? opp.strength : 0, n: elf.length, staerke: schnitt(p => p.strength),
                fit: schnitt(p => p.fitness), form: schnitt(p => p.dailyForm ?? 50), moral: schnitt(p => p.morale || 80), basis,
                chemie: getLineupChemistryStats().bonus, clique: typeof getCliqueChemistryModifier === 'function' ? getCliqueChemistryModifier() : 0,
                stil: getTacticStyleBonus(game.tacticStyle) + getFormationOffBonus(), stress: privateLife.stress || 0,
                minFit: Math.min(...elf.map(p => p.fitness)), kader: squad.length,
                pos: ['TW', 'ABW', 'MIT', 'ST'].map(k => squad.filter(p => p.pos === k && !p.injured && !p.suspended).length).join('/'),
                muede: elf.filter(p => p.fitness < 60).map(p => p.pos).join('') });
            return wert;
        };
    });
    const zeilen = [];
    for (let s = 0; s < saisons; s++) {
        const r = await page.evaluate((aktiv) => {
            try {
                closeTutorial();
                const elfStaerke = () => { const ids = pickBestLineupIds(); return squad.filter(p => ids.includes(p.id)).reduce((a, p) => a + p.strength, 0) / Math.max(1, ids.length); };
                // Lizenzplanung wie ein ambitionierter Mensch: wer in der laufenden oder letzten Saison
                // auf Platz 6 oder besser steht, baut die Auflagen der nächsthöheren Liga rechtzeitig
                // (Bauzeit!) und hält das Geld dafür in den Wechselfenstern zurück.
                const ligaSchnitt = () => { const t = (leaguesData[game.leagueLevel] || []).filter(x => x.name !== game.clubName); return t.reduce((a, x) => a + x.strength, 0) / Math.max(1, t.length); };
                const kandidat = () => game.leagueLevel > 0
                    && (Math.min(window.__letzterPlatz || 99, game.matchday > 3 ? (getOwnLeagueRank() || 99) : 99) <= 6 || elfStaerke() >= ligaSchnitt());
                const lizenzPlan = () => {
                    const req = DFB_LICENSING_REQUIREMENTS[game.leagueLevel - 1];
                    const q = game.stadiumConstructionQueue || [];
                    const plan = [];
                    if (req.floodlight && !stadium.flutlicht && !q.some(p => p.type === 'specialInstall' && p.params.key === 'flutlicht'))
                        plan.push({ art: 'flutlicht', kosten: getSpecialInstallCost('flutlicht') });
                    if ((campusBuildings.internat?.lvl || 0) < req.minYouthLvl && !q.some(p => p.type === 'campusBuilding' && p.params.key === 'internat'))
                        plan.push({ art: 'internat', kosten: getCampusUpgradeCost('internat') });
                    const imBau = k => q.filter(p => p.type === 'blockExpand' && p.params.blockKey === k).length;
                    let plaetze = stadium.total + q.filter(p => p.type === 'blockExpand').reduce((a, p) => a + p.params.seats, 0);
                    const bloecke = Object.entries(stadium.blocks).map(([k, b]) => ({ k, b, exp: b.expansions + imBau(k) }));
                    while (plaetze < req.minCapacity) {
                        const w = bloecke.filter(x => x.exp < 5 && x.b.addSeats > 0)
                            .map(x => ({ x, kosten: Math.round(x.b.cost * (x.exp + 1) * getStadiumCostScale()) }))
                            .sort((a, b) => a.kosten / a.x.b.addSeats - b.kosten / b.x.b.addSeats)[0];
                        if (!w) break;
                        plan.push({ art: 'block', key: w.x.k, seats: w.x.b.addSeats, kosten: w.kosten, frei: imBau(w.x.k) === 0 && w.x.exp === w.x.b.expansions });
                        w.x.exp++;
                        plaetze += w.x.b.addSeats;
                    }
                    return { plan, reserve: req.minMoney, summe: plan.reduce((a, x) => a + x.kosten, 0) };
                };
                const lizenzRuecklage = () => {
                    if (!kandidat()) return 0;
                    const l = lizenzPlan();
                    return l.summe + l.reserve;
                };
                const lizenzBauen = () => {
                    if (!aktiv || !kandidat()) return;
                    const { plan, reserve } = lizenzPlan();
                    const puffer = reserve + squad.reduce((a, p) => a + (p.wage || 0), 0) * 6;
                    plan.forEach(x => {
                        if ((x.art === 'block' && !x.frei) || game.money - x.kosten < puffer) return;
                        if (x.art === 'flutlicht') upgradeSpecialInstall('flutlicht');
                        else if (x.art === 'internat') upgradeCampusBuilding('internat');
                        else expandBlock(x.key, x.seats, x.kosten);
                    });
                };
                // Sponsoren wie ein Mensch: nur natürlich eingetroffene Angebote, jeweils das
                // wertvollste (Handgeld + Saisonwert, Branchenkonflikt -30 %); Banden füllen, solange
                // Plätze frei sind; Namensrechte einmal verkaufen.
                const sponsoren = () => {
                    if (!aktiv) return;
                    const wert = (o, slot, proSpieltag) => ((o.signOn || 0) + proSpieltag * 34) * (getExclusivityConflict(o.category, slot) ? 0.7 : 1);
                    const beste = (liste, slot, f) => [...liste].sort((a, b) => wert(b, slot, f(b)) - wert(a, slot, f(a)))[0];
                    // Verlängerungsangebot des Hauptsponsors (25.19) annehmen.
                    if (typeof getSponsorRenewal === 'function' && getSponsorRenewal()) acceptSponsorRenewal();
                    if ((game.sponsor?.base || 0) <= 500 && sponsorOffers.length) acceptSponsorOffer(beste(sponsorOffers, 'sponsor', o => o.base).id);
                    if (!(game.kitSupplier?.income > 0) && kitSupplierOffers.length) acceptKitOffer(beste(kitSupplierOffers, 'kit', o => o.income / 2).id);
                    if (!(game.sleeveSponsor?.income > 0) && sleeveSponsorOffers.length) acceptSleeveOffer(beste(sleeveSponsorOffers, 'sleeve', o => o.income).id);
                    [...bandenOffers].forEach(o => { if (bandenOffers.some(x => x.id === o.id)) acceptBandenOffer(o.id); });
                    if (!stadium.namingRightsSponsor) {
                        sellNamingRights();
                        if (game.pendingNamingCeremony) resolveNamingCeremony('traditional');
                    }
                };
                const verwalten = () => {
                    if (!aktiv) return;
                    sponsoren();
                    lizenzBauen();
                    const fenster = game.matchday <= 3 || (game.matchday >= 18 && game.matchday <= 20);
                    const median = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)];
                    const halten = p => (p.strength >= median && p.age <= 31) || ((isClubLegend(p) || p.isCrowdFavorite) && p.age <= 33);
                    window.__vl = window.__vl || { versucht: 0, verlaengert: 0, nichtGehalten: 0 };
                    // Wer gehen darf: nur so viele, dass mindestens 18 Spieler bleiben (stärkste zuerst halten).
                    const auslaufend = squad.filter(p => (p.contracts || 0) <= 1).sort((a, b) => b.strength - a.strength);
                    let bleiben = squad.length - auslaufend.length;
                    auslaufend.forEach(p => {
                        if (!halten(p) && (bleiben >= 18 || p.age >= 34)) { window.__vl.nichtGehalten++; return; }
                        bleiben++;
                        const vorher = p.contracts;
                        window.__vl.versucht++;
                        extendContract(p.id);
                        if (contractTalk) acceptContractTalk();
                        contractTalk = null;
                        if (p.contracts > vorher) window.__vl.verlaengert++;
                    });
                    // Talente wie ein Mensch (25.17): wer schon so stark ist wie der Kader-Median, kommt hoch.
                    const kaderMedian = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)];
                    for (let n = 0; n < 3 && squad.length < 26; n++) {
                        const t = youthTalents.map((p, i) => ({ p, i })).filter(x => (x.p.age || 17) >= 17 && x.p.strength >= kaderMedian)
                            .sort((a, b) => b.p.strength - a.p.strength)[0];
                        if (!t) break;
                        const vorher = squad.length;
                        promoteYouth(t.i, null);
                        if (squad.length === vorher) promoteYouth(t.i, null);
                        if (squad.length === vorher) break;
                    }
                    // Kaderplanung wie ein Mensch: fehlt einer Position Tiefe (2 TW/6 ABW/6 MIT/4 ST),
                    // erst passende Jugendspieler hochziehen (kein Gehaltsbudget nötig), dann
                    // Vereinslose holen.
                    const SOLL = { TW: 2, ABW: 6, MIT: 6, ST: 4 };
                    Object.entries(SOLL).forEach(([pos, soll]) => {
                        for (let n = squad.filter(p => p.pos === pos).length; n < soll; n++) {
                            const jugend = youthTalents.map((p, i) => ({ p, i })).filter(x => x.p.pos === pos && (x.p.age || 17) >= 17)
                                .sort((a, b) => b.p.strength - a.p.strength)[0];
                            if (jugend) { promoteYouth(jugend.i, null); continue; }
                            const frei = freeAgentPlayers.map((p, i) => ({ p, i })).filter(x => x.p.pos === pos)
                                .sort((a, b) => b.p.strength - a.p.strength)[0];
                            if (!frei) break;
                            const vorher = squad.length;
                            signFreeAgent(frei.i);
                            if (squad.length === vorher) signFreeAgent(frei.i); // Gegenangebot annehmen
                            if (squad.length === vorher) break;
                        }
                    });
                    // Kader verschlanken wie ein Mensch (25.17): mehr als 24 Spieler kosten nur Gehalt -
                    // im Wechselfenster die schwächsten Nicht-Stammspieler (keine Jugend unter 21) verkaufen.
                    if (fenster) {
                        window.__verk = window.__verk || 0;
                        // Über dem Gehaltsbudget (z. B. nach einem Abstieg): teuerste Nicht-Stammspieler abgeben,
                        // solange mindestens 18 Spieler bleiben - sonst drohen Minus und Zwangsverkäufe der Besten.
                        for (let n = 0; n < 6 && squad.length > 18 && squad.reduce((a, p) => a + (p.wage || 0), 0) > game.wageBudget; n++) {
                            const ids = pickBestLineupIds();
                            const teuer = squad.filter(p => !ids.includes(p.id) && !isClubLegend(p)).sort((a, b) => b.wage - a.wage)[0];
                            if (!teuer) break;
                            const vorher = squad.length;
                            sellPlayer(teuer.id, null);
                            if (squad.length === vorher) sellPlayer(teuer.id, null);
                            if (squad.length === vorher) break;
                            window.__verk++;
                        }
                        for (let n = 0; n < 6 && squad.length > 24; n++) {
                            const ids = pickBestLineupIds();
                            const weg = squad.filter(p => !ids.includes(p.id) && (p.age || 25) >= 21 && !isClubLegend(p))
                                .sort((a, b) => a.strength - b.strength)[0];
                            if (!weg) break;
                            const vorher = squad.length;
                            sellPlayer(weg.id, null);
                            if (squad.length === vorher) sellPlayer(weg.id, null); // Bestätigung
                            if (squad.length === vorher) break;
                            window.__verk++;
                        }
                    }
                    const ruecklage = lizenzRuecklage();
                    // Nachwuchs sichten wie ein Mensch (25.17): am 1. und 18. Spieltag bis zu 2 Talente,
                    // solange die Akademie Platz hat und die Kasse über der Rücklage bleibt.
                    if (game.matchday === 1 || game.matchday === 18) {
                        for (let n = 0; n < 2 && youthTalents.length < getYouthAcademyCapacity()
                            && game.money - getYouthScoutCost() > ruecklage + getYouthScoutCost() * 10; n++) scoutYouthTalent();
                    }
                    // Pro Wechselfenster: erst die Elf verstärken, dann den Kader auf 22 auffüllen.
                    // In der DFB-Nachfrist nichts kaufen: dort zählt nur noch die Finanzreserve.
                    for (let versuch = 0; fenster && !game.dfbGracePeriod && versuch < 6; versuch++) {
                        const ids = pickBestLineupIds();
                        const schwaechster = Math.min(...squad.filter(p => ids.includes(p.id)).map(p => p.strength));
                        const gehaelter = squad.reduce((a, p) => a + (p.wage || 0), 0);
                        const bezahlbar = x => getTransferAsking(x.p) <= game.transferBudget
                            && game.money - getTransferAsking(x.p) > (gehaelter + x.p.wage) * 34 * 0.3 + ruecklage;
                        const alle = marketPlayers.map((p, i) => ({ p, i })).filter(bezahlbar);
                        let wahl = alle.filter(x => x.p.strength > schwaechster + 2).sort((a, b) => b.p.strength - a.p.strength)[0];
                        if (!wahl && squad.length < 22) wahl = alle.sort((a, b) => b.p.strength - a.p.strength)[0];
                        if (!wahl) break;
                        const vorher = squad.length;
                        buyPlayer(wahl.i);
                        if (squad.length === vorher) break;
                    }
                };
                // Nach jedem Spieltag wie ein Mensch reagieren: Ultimatum lösen statt verstreichen
                // lassen, Wintergespräch führen.
                const reagieren = () => {
                    if (!aktiv) return;
                    if (game.activeUltimatumPlayerId) {
                        const p = squad.find(x => x.id === game.activeUltimatumPlayerId);
                        resolveUltimatumRenew();
                        if (game.activeUltimatumPlayerId && p && p.agent) resolveUltimatumViaAgent();
                        if (game.activeUltimatumPlayerId && p && !isClubLegend(p) && !p.isCrowdFavorite) resolveUltimatumSell();
                        if (game.activeUltimatumPlayerId) resolveUltimatumIgnore();
                    }
                    if (isWinterTalkOpen()) chooseWinterTalk('kurs');
                    // Talentangebote (25.18): verkaufen, wer es nicht über den Kader-Median schafft.
                    if (typeof getOpenYouthOffers === 'function') {
                        const med = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)];
                        getOpenYouthOffers().slice().forEach(o => {
                            const t = youthTalents.find(p => p.id === o.playerId);
                            if (!t) return;
                            if ((t.potential || t.strength) < med) { acceptYouthOffer(o.id, true); window.__talentVerk = (window.__talentVerk || 0) + o.betrag; }
                            else rejectYouthOffer(o.id);
                        });
                    }
                    sponsoren();
                    lizenzBauen();
                    // Mitgliederversammlung selbst halten, Rede passend zur Saison.
                    const mv = game.memberAssembly;
                    if (mv && mv.status === 'offen') {
                        const gut = mv.report.finalRank <= mv.report.expectedRank || mv.report.promoted;
                        setAssemblyChoice('speech', gut ? 'visionaer' : 'selbstkritisch');
                        holdMemberAssembly(false);
                    }
                };
                const start = { season: game.season, liga: game.leagueLevel, europa: !!game.inEurope };
                // Diagnose: abgelehnte Aktionen (Fehler-Toasts) und Postfach-Titel dieser Saison
                window.__fehlerToasts = window.__fehlerToasts || {};
                if (!window.__toastGewrappt) {
                    const orig = showToast;
                    showToast = function (msg, typ) { if (typ === 'error') { const k = String(msg).replace(/[0-9.,]+/g, '#').slice(0, 70); window.__fehlerToasts[k] = (window.__fehlerToasts[k] || 0) + 1; } return orig.apply(this, arguments); };
                    const origPost = addInboxMessage;
                    addInboxMessage = function (typ, titel) { window.__post.push(String(titel)); return origPost.apply(this, arguments); };
                    const origNotice = showNotice;
                    showNotice = function (titel) { window.__post.push('Meldung: ' + String(titel)); return origNotice.apply(this, arguments); };
                    window.__toastGewrappt = true;
                }
                window.__fehlerToasts = {};
                window.__post = [];
                window.__board = {};
                const kaderVorher = squad.map(p => p.id);
                // FINDIAG: jede Kontobewegung der Saison nach Posten (Spieltagsjournal + Kontoauszug).
                window.__fin = {};
                window.__finGesehen = window.__finGesehen || new WeakMap();
                const finSammeln = () => {
                    const add = (k, v) => { if (v) window.__fin[k] = (window.__fin[k] || 0) + v; };
                    (game.financeLedger || []).forEach(e => {
                        if (window.__finGesehen.has(e)) return;
                        window.__finGesehen.set(e, 1);
                        e.einnahmen.forEach(x => add(x.label, x.amount));
                        e.ausgaben.forEach(x => add(x.label, -x.amount));
                    });
                    (game.kontoauszug || []).forEach(e => {
                        const alt = window.__finGesehen.get(e) || 0;
                        add(e.label, e.amount - alt);
                        window.__finGesehen.set(e, e.amount);
                    });
                };
                finSammeln();
                window.__fin = {};
                verwalten();
                while (game.matchday <= 34 && !game.sackPending) {
                    if (game.matchday === 18) verwalten();
                    simulateMatchdays(1);
                    reagieren();
                    finSammeln();
                }
                if (game.sackPending) return { ...start, entlassen: true };
                const tabelle = [...leaguesData[game.leagueLevel]].sort(compareTableRows);
                const ich = tabelle.find(t => t.name === game.clubName);
                const zeile = {
                    ...start,
                    platz: tabelle.indexOf(ich) + 1, punkte: ich.pts ?? ich.points,
                    geld: game.money, transfer: game.transferBudget, gehaltBudget: game.wageBudget,
                    gehaltSumme: squad.reduce((a, p) => a + (p.wage || 0), 0),
                    elf: Math.round(elfStaerke() * 10) / 10,
                    ligaSchnitt: Math.round(tabelle.filter(t => t !== ich).reduce((a, t) => a + t.strength, 0) / (tabelle.length - 1)),
                    ligaTop: Math.max(...tabelle.filter(t => t !== ich).map(t => t.strength)), kader: squad.length, vorstand: Math.round(game.boardSat),
                    pokal: (game.cupFinals || []).filter(f => f.season === game.season && f.won).map(f => f.comp).join('+')
                };
                zeile.lizenzVorEnde = checkDfbLicensingStatus().missing.join(' / ');
                zeile.erwartet = game.seasonExpectation && game.seasonExpectation.season === game.season ? game.seasonExpectation.expectedRank : null;
                const geldVorEnde = game.money;
                concludeSeasonAndAdvance();
                finSammeln();
                zeile.saisonEnde = game.money - geldVorEnde;
                if (window.__vb) { zeile.vb = Object.entries(window.__vb).filter(([, v]) => Math.abs(v) >= 50000).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8); window.__vb = {}; }
                zeile.fin = Object.entries(window.__fin).filter(([, v]) => Math.abs(v) >= 50000).sort((a, b) => b[1] - a[1]);
                const eu = (game.europeHistory || []).find(e => e.season === start.season);
                zeile.europaRunde = eu ? eu.stage : '';
                zeile.ligaDanach = game.leagueLevel;
                window.__letzterPlatz = zeile.ligaDanach === start.liga ? zeile.platz : 99;
                // Nur eine echte Sperre zählt (25.18): auf einem Aufstiegsplatz geblieben, weil Auflagen fehlten.
                // Vorher wurde nach dem Saisonwechsel gezählt - nach jedem Aufstieg also die Lizenz der übernächsten Liga.
                zeile.lizenzOffen = start.liga > 0 && zeile.platz <= 2 && zeile.ligaDanach === start.liga && zeile.lizenzVorEnde
                    ? zeile.lizenzVorEnde.split(' / ').length : 0;
                zeile.entlassenAmEnde = !!game.sackPending;
                zeile.board = Object.entries(window.__board || {}).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Math.round(v)}`);
                if (window.__str) {
                    const st = window.__str, m = f => Math.round(st.reduce((a, x) => a + f(x), 0) / Math.max(1, st.length) * 10) / 10;
                    zeile.str = `Spiele ${st.length} | Wert ${m(x => x.wert)} vs Gegner ${m(x => x.opp)} | Elf ${m(x => x.n)}x ${m(x => x.staerke)} Fit ${m(x => x.fit)} Form ${m(x => x.form)} Moral ${m(x => x.moral)} Basis ${m(x => x.basis)} | Chemie ${m(x => x.chemie)} Clique ${m(x => x.clique)} Stil ${m(x => x.stil)} Stress ${m(x => x.stress)} | minFit ${m(x => x.minFit)} Kader ${m(x => x.kader)} | Spt1 ${st[0] && st[0].pos} Spt20 ${st[19] && st[19].pos} Spt34 ${st[33] && st[33].pos} | müde: ${Object.entries(st.map(x => x.muede).join('').split('').reduce((o, c) => (o[c] = (o[c] || 0) + 1, o), {})).map(([k, v]) => k + v).join(' ')}`;
                    window.__str = [];
                }
                zeile.vl = window.__vl; window.__vl = null;
                zeile.notkader = window.__post.some(t => t.includes('Vertragskrise'));
                zeile.abgaenge = kaderVorher.filter(id => !squad.some(p => p.id === id)).length;
                zeile.kaeufe = squad.filter(p => p.joined && p.joined.via === 'kauf' && p.joined.season === start.season).length;
                zeile.verkaeufe = window.__verk || 0; window.__verk = 0;
                zeile.talentErloes = window.__talentVerk || 0; window.__talentVerk = 0;
                const elfIds = pickBestLineupIds();
                zeile.jugend = squad.filter(p => p.joined && p.joined.via === 'jugend').length;
                zeile.jugendElf = squad.filter(p => p.joined && p.joined.via === 'jugend' && elfIds.includes(p.id)).length;
                zeile.toasts = Object.entries(window.__fehlerToasts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => v + 'x ' + k);
                zeile.post = window.__post
                    .filter(t => /Lizenz|Aufstieg|Abstieg|Nachfrist|Vertrag|verlässt|ablösefrei|Gehaltsbudget|Rücklagen/i.test(t)).slice(0, 12);
                return zeile;
            } catch (e) { return { crash: e.message + ' ' + (e.stack || '').split('\n')[1] }; }
        }, modus === 'aktiv');
        zeilen.push(r);
        if (r.crash || r.entlassen || r.entlassenAmEnde) break;
    }
    await ctx.close();
    console.log(`\n== Lauf ${lauf} (${modus}) ==`);
    console.log('Ssn Liga Pl Pkt   Geld Transf GehBud/Spt GehSum  Elf Liga Top Kad Vst Europa        Pokal');
    zeilen.forEach(z => {
        if (z.crash) return console.log('ABSTURZ: ' + z.crash);
        if (z.entlassen) return console.log(`${String(z.season).padStart(3)} ENTLASSEN (Liga ${z.liga + 1})`);
        console.log(`${String(z.season).padStart(3)} ${String(z.liga + 1).padStart(4)} ${String(z.platz).padStart(2)} ${String(z.punkte).padStart(3)} ${mio(z.geld)} ${mio(z.transfer)} ${String(Math.round(z.gehaltBudget / 1000)).padStart(7)}k ${String(Math.round(z.gehaltSumme / 1000)).padStart(5)}k ${String(z.elf).padStart(4)} ${String(z.ligaSchnitt).padStart(4)} ${String(z.ligaTop).padStart(3)} ${String(z.kader).padStart(3)} ${String(z.vorstand).padStart(3)} ${z.europaRunde ? ('CC:' + z.europaRunde).padEnd(13) : '-'.padEnd(13)} ${z.pokal ? 'Pokal ' + z.pokal : ''}${z.ligaDanach !== z.liga ? ' → Liga ' + (z.ligaDanach + 1) : ''}${z.lizenzOffen ? ` LIZENZ-SPERRE:${z.lizenzOffen}` : ''}${z.notkader ? ' NOTKADER' : ''}${z.entlassenAmEnde ? ' ENTLASSEN (Saisonende)' : ''}${z.kaeufe || z.verkaeufe ? ` K${z.kaeufe}/V${z.verkaeufe}` : ''}${z.erwartet ? ` E${z.erwartet}` : ''}${z.jugend ? ` J${z.jugendElf}/${z.jugend}` : ''}${z.talentErloes ? ` TV${(z.talentErloes / 1e6).toFixed(2)}M` : ''}`);
    });
    if (process.env.DIAG) zeilen.forEach(z => { if (z.season) console.log(`\n[S${z.season}] Lizenz offen: ${z.lizenzVorEnde || '-'} | Verlängerung ${JSON.stringify(z.vl)} | Abgänge ${z.abgaenge} | Fehler: ${(z.toasts || []).join(' ; ')}\n      Post: ${(z.post || []).join(' ; ')}`); });
    if (process.env.STRDIAG) zeilen.forEach(z => { if (z.str) console.log(`[S${z.season} Liga ${z.liga + 1} Pl ${z.platz}] ${z.str}`); });
    if (process.env.FINDIAG) zeilen.forEach(z => {
        if (!z.fin) return;
        const ein = z.fin.filter(([, v]) => v > 0), aus = z.fin.filter(([, v]) => v < 0).reverse();
        const f = ([k, v]) => `${k} ${(v / 1e6).toFixed(1)}`;
        console.log(`[S${z.season} Liga ${z.liga + 1} Pl ${z.platz}] +${(ein.reduce((a, [, v]) => a + v, 0) / 1e6).toFixed(1)} / ${(aus.reduce((a, [, v]) => a + v, 0) / 1e6).toFixed(1)} Mio | Saisonende ${(z.saisonEnde / 1e6).toFixed(1)}\n   EIN: ${ein.map(f).join(' | ')}\n   AUS: ${aus.map(f).join(' | ')}`);
    });
    if (process.env.VBDIAG) zeilen.forEach(z => { if (z.vb) console.log(`[S${z.season} Liga ${z.liga + 1} VB] ${z.vb.map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)}`).join(' | ')}`); });
    if (process.env.BOARDDIAG) zeilen.forEach(z => { if (z.board) console.log(`[S${z.season} Liga ${z.liga + 1} Pl ${z.platz} Vst ${z.vorstand}] ${z.board.join(' | ')}`); });
    if (fehler.length) console.log('JS-Fehler: ' + [...new Set(fehler)].slice(0, 5).join(' | '));
    return zeilen;
}

(async () => {
    const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    for (let i = 1; i <= laeufe; i++) await karriere(browser, i);
    await browser.close();
})();
