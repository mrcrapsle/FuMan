// Langzeittest (Phase 21.6, Startliga per LIGA=0..5, Standard Bundesliga): ein Bot spielt N Saisons im gebauten Spiel und
// schreibt je Saison Platz, Geld, Budgets, Gehaltssumme, Kaderstärke, Pokal/Europa und Vorstand.
//   node scripts/longrun-bundesliga.js [saisons=20] [modus=aktiv|passiv] [läufe=1] [datei]
// aktiv:  verlängert gute auslaufende Verträge (normale Vertragsgespräche) und kauft im Sommer
//         den besten bezahlbaren Marktspieler, der die Elf verstärkt (Sofortkauf).
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
                    squad.filter(p => (p.contracts || 0) <= 1 && p.strength >= median && p.age <= 31).forEach(p => {
                        extendContract(p.id);
                        if (contractTalk) acceptContractTalk();
                        contractTalk = null;
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
                const start = { season: game.season, liga: game.leagueLevel, europa: !!game.inEurope };
                // Diagnose: abgelehnte Aktionen (Fehler-Toasts) und Postfach-Titel dieser Saison
                window.__fehlerToasts = window.__fehlerToasts || {};
                if (!window.__toastGewrappt) {
                    const orig = showToast;
                    showToast = function (msg, typ) { if (typ === 'error') { const k = String(msg).replace(/[0-9.,]+/g, '#').slice(0, 70); window.__fehlerToasts[k] = (window.__fehlerToasts[k] || 0) + 1; } return orig.apply(this, arguments); };
                    const origPost = addInboxMessage;
                    addInboxMessage = function (typ, titel) { window.__post.push(String(titel)); return origPost.apply(this, arguments); };
                    window.__toastGewrappt = true;
                }
                window.__fehlerToasts = {};
                window.__post = [];
                const kaderVorher = squad.map(p => p.id);
                verwalten();
                simulateMatchdays(17);
                verwalten();
                simulateMatchdays(17);
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
                zeile.abgaenge = kaderVorher.filter(id => !squad.some(p => p.id === id)).length;
                zeile.toasts = Object.entries(window.__fehlerToasts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => v + 'x ' + k);
                zeile.post = window.__post
                    .filter(t => /Lizenz|Aufstieg|Abstieg|Nachfrist|Vertrag|verlässt|ablösefrei|Gehaltsbudget|Rücklagen/i.test(t)).slice(0, 12);
                return zeile;
            } catch (e) { return { crash: e.message + ' ' + (e.stack || '').split('\n')[1] }; }
        }, modus === 'aktiv');
        zeilen.push(r);
        if (r.crash || r.entlassen) break;
    }
    await ctx.close();
    console.log(`\n== Lauf ${lauf} (${modus}) ==`);
    console.log('Ssn Liga Pl Pkt   Geld Transf GehBud/Spt GehSum  Elf Liga Top Kad Vst Europa        Pokal');
    zeilen.forEach(z => {
        if (z.crash) return console.log('ABSTURZ: ' + z.crash);
        if (z.entlassen) return console.log(`${String(z.season).padStart(3)} ENTLASSEN (Liga ${z.liga + 1})`);
        console.log(`${String(z.season).padStart(3)} ${String(z.liga + 1).padStart(4)} ${String(z.platz).padStart(2)} ${String(z.punkte).padStart(3)} ${mio(z.geld)} ${mio(z.transfer)} ${String(Math.round(z.gehaltBudget / 1000)).padStart(7)}k ${String(Math.round(z.gehaltSumme / 1000)).padStart(5)}k ${String(z.elf).padStart(4)} ${String(z.ligaSchnitt).padStart(4)} ${String(z.ligaTop).padStart(3)} ${String(z.kader).padStart(3)} ${String(z.vorstand).padStart(3)} ${z.europaRunde ? ('CC:' + z.europaRunde).padEnd(13) : '-'.padEnd(13)} ${z.pokal ? 'Pokal ' + z.pokal : ''}${z.ligaDanach !== z.liga ? ' → Liga ' + (z.ligaDanach + 1) : ''}`);
    });
    if (process.env.DIAG) zeilen.forEach(z => { if (z.season) console.log(`\n[S${z.season}] Abgänge ${z.abgaenge} | Fehler: ${(z.toasts || []).join(' ; ')}\n      Post: ${(z.post || []).join(' ; ')}`); });
    if (fehler.length) console.log('JS-Fehler: ' + [...new Set(fehler)].slice(0, 5).join(' | '));
    return zeilen;
}

(async () => {
    const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    for (let i = 1; i <= laeufe; i++) await karriere(browser, i);
    await browser.close();
})();
