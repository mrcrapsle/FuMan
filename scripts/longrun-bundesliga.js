// Langzeittest (Phase 21.6, Startliga per LIGA=0..5, Standard Bundesliga): ein Bot spielt N Saisons im gebauten Spiel und
// schreibt je Saison Platz, Geld, Budgets, Gehaltssumme, Kaderstärke, Pokal/Europa und Vorstand.
//   node scripts/longrun-bundesliga.js [saisons=20] [modus=aktiv|passiv] [läufe=1] [datei]
// aktiv:  verlängert gute auslaufende Verträge (auch Legenden/Publikumslieblinge bis 33), kauft in
//         den Fenstern Verstärkungen, löst Ultimaten nach jedem Spieltag, führt das Wintergespräch
//         und hält die Mitgliederversammlung mit passender Rede. Fehlt einer Position Tiefe,
//         zieht er Jugendspieler hoch oder holt Vereinslose.
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
                const verwalten = () => {
                    if (!aktiv) return;
                    const lizenz = checkDfbLicensingStatus();
                    const flutlicht = lizenz.missing.length === 1 && lizenz.missing[0].startsWith('Flutlicht');
                    if (flutlicht && game.money >= getSpecialInstallCost('flutlicht') + 100000) upgradeSpecialInstall('flutlicht');
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
                    // Pro Wechselfenster: erst die Elf verstärken, dann den Kader auf 22 auffüllen.
                    for (let versuch = 0; fenster && versuch < 6; versuch++) {
                        const ids = pickBestLineupIds();
                        const schwaechster = Math.min(...squad.filter(p => ids.includes(p.id)).map(p => p.strength));
                        const gehaelter = squad.reduce((a, p) => a + (p.wage || 0), 0);
                        const bezahlbar = x => getTransferAsking(x.p) <= game.transferBudget
                            && game.money - getTransferAsking(x.p) > (gehaelter + x.p.wage) * 34 * 0.3;
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
                verwalten();
                while (game.matchday <= 34 && !game.sackPending) {
                    if (game.matchday === 18) verwalten();
                    simulateMatchdays(1);
                    reagieren();
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
                concludeSeasonAndAdvance();
                const eu = (game.europeHistory || []).find(e => e.season === start.season);
                zeile.europaRunde = eu ? eu.stage : '';
                zeile.ligaDanach = game.leagueLevel;
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
        console.log(`${String(z.season).padStart(3)} ${String(z.liga + 1).padStart(4)} ${String(z.platz).padStart(2)} ${String(z.punkte).padStart(3)} ${mio(z.geld)} ${mio(z.transfer)} ${String(Math.round(z.gehaltBudget / 1000)).padStart(7)}k ${String(Math.round(z.gehaltSumme / 1000)).padStart(5)}k ${String(z.elf).padStart(4)} ${String(z.ligaSchnitt).padStart(4)} ${String(z.ligaTop).padStart(3)} ${String(z.kader).padStart(3)} ${String(z.vorstand).padStart(3)} ${z.europaRunde ? ('CC:' + z.europaRunde).padEnd(13) : '-'.padEnd(13)} ${z.pokal ? 'Pokal ' + z.pokal : ''}${z.ligaDanach !== z.liga ? ' → Liga ' + (z.ligaDanach + 1) : ''}${z.notkader ? ' NOTKADER' : ''}${z.entlassenAmEnde ? ' ENTLASSEN (Saisonende)' : ''}`);
    });
    if (process.env.DIAG) zeilen.forEach(z => { if (z.season) console.log(`\n[S${z.season}] Verlängerung ${JSON.stringify(z.vl)} | Abgänge ${z.abgaenge} | Fehler: ${(z.toasts || []).join(' ; ')}\n      Post: ${(z.post || []).join(' ; ')}`); });
    if (process.env.STRDIAG) zeilen.forEach(z => { if (z.str) console.log(`[S${z.season} Liga ${z.liga + 1} Pl ${z.platz}] ${z.str}`); });
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
