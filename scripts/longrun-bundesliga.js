// Langzeittest ab der Bundesliga (Phase 21.6): ein Bot spielt N Saisons im gebauten Spiel und
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

const mio = v => (v / 1e6).toFixed(1).padStart(6);

async function karriere(browser, lauf) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    await page.goto('file://' + datei);
    await page.evaluate(() => {
        sessionStorage.setItem('anstoss_fm13_force_new_game', '1');
        sessionStorage.setItem('anstoss_fm13_newgame_leaguelevel', '0');
        sessionStorage.setItem('anstoss_fm13_newgame_money', '150000');
    });
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
                    const median = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)];
                    squad.filter(p => (p.contracts || 0) <= 1 && p.strength >= median && p.age <= 31).forEach(p => {
                        extendContract(p.id);
                        if (contractTalk) acceptContractTalk();
                        contractTalk = null;
                    });
                    if (game.matchday <= 3 && squad.length < 26) {
                        const ids = pickBestLineupIds();
                        const schwaechster = Math.min(...squad.filter(p => ids.includes(p.id)).map(p => p.strength));
                        const kandidaten = marketPlayers.map((p, i) => ({ p, i }))
                            .filter(x => x.p.strength > schwaechster + 2 && getTransferAsking(x.p) <= game.transferBudget && getTransferAsking(x.p) < game.money * 0.6)
                            .sort((a, b) => b.p.strength - a.p.strength);
                        if (kandidaten.length) buyPlayer(kandidaten[0].i);
                    }
                };
                const start = { season: game.season, liga: game.leagueLevel, europa: !!game.inEurope };
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
                    elf: Math.round(elfStaerke() * 10) / 10, kader: squad.length, vorstand: Math.round(game.boardSat),
                    pokal: (game.cupFinals || []).filter(f => f.season === game.season && f.won).map(f => f.comp).join('+')
                };
                concludeSeasonAndAdvance();
                const eu = (game.europeHistory || []).find(e => e.season === start.season);
                zeile.europaRunde = eu ? eu.stage : '';
                zeile.ligaDanach = game.leagueLevel;
                return zeile;
            } catch (e) { return { crash: e.message + ' ' + (e.stack || '').split('\n')[1] }; }
        }, modus === 'aktiv');
        zeilen.push(r);
        if (r.crash || r.entlassen) break;
    }
    await ctx.close();
    console.log(`\n== Lauf ${lauf} (${modus}) ==`);
    console.log('Ssn Liga Pl Pkt   Geld Transf GehBud/Spt GehSum  Elf Kad Vst Europa        Pokal');
    zeilen.forEach(z => {
        if (z.crash) return console.log('ABSTURZ: ' + z.crash);
        if (z.entlassen) return console.log(`${String(z.season).padStart(3)} ENTLASSEN (Liga ${z.liga + 1})`);
        console.log(`${String(z.season).padStart(3)} ${String(z.liga + 1).padStart(4)} ${String(z.platz).padStart(2)} ${String(z.punkte).padStart(3)} ${mio(z.geld)} ${mio(z.transfer)} ${String(Math.round(z.gehaltBudget / 1000)).padStart(7)}k ${String(Math.round(z.gehaltSumme / 1000)).padStart(5)}k ${String(z.elf).padStart(4)} ${String(z.kader).padStart(3)} ${String(z.vorstand).padStart(3)} ${z.europaRunde ? ('CC:' + z.europaRunde).padEnd(13) : '-'.padEnd(13)} ${z.pokal ? 'Pokal ' + z.pokal : ''}${z.ligaDanach !== z.liga ? ' → Liga ' + (z.ligaDanach + 1) : ''}`);
    });
    if (fehler.length) console.log('JS-Fehler: ' + [...new Set(fehler)].slice(0, 5).join(' | '));
    return zeilen;
}

(async () => {
    const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    for (let i = 1; i <= laeufe; i++) await karriere(browser, i);
    await browser.close();
})();
