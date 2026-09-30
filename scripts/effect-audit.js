// Wirkungsanalyse: spielt N Saisons im gebauten Spiel und summiert je Funktion, wie stark
// sie Geld, Kaderstärke, Moral, Fans, Vorstand und Verletzte verändert (nur die jeweils
// innerste Funktion zählt, damit Aufrufketten nicht mehrfach gezählt werden).
//   node scripts/effect-audit.js [saisons=2] [datei=dist/anstoss-fm13-standalone.html] [filter]
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const { chromium } = require(path.join(root, 'tests/node_modules/playwright'));
const saisons = parseInt(process.argv[2] || '2', 10);
const datei = path.resolve(root, process.argv[3] || 'dist/anstoss-fm13-standalone.html');
const filter = process.argv[4] || '';

// Funktionsname -> Quelldatei (für die Zuordnung in der Ausgabe)
const herkunft = {};
for (const f of fs.readdirSync(path.join(root, 'js'))) {
    for (const m of fs.readFileSync(path.join(root, 'js', f), 'utf8').matchAll(/^\s*function (\w+)\s*\(/gm)) herkunft[m[1]] = f.replace('.js', '');
}

(async () => {
    const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    const page = await browser.newPage();
    page.on('dialog', d => d.accept());
    await page.goto('file://' + datei);
    await page.waitForTimeout(400);
    const res = await page.evaluate((saisons) => {
        const mess = () => ({
            geld: game.money, staerke: squad.reduce((s, p) => s + (p.strength || 0), 0),
            moral: squad.reduce((s, p) => s + (p.morale || 0), 0) / Math.max(1, squad.length),
            fans: game.fans, vorstand: game.boardSat, verletzt: squad.filter(p => p.injured > 0).length
        });
        const summe = {};
        const stapel = [];
        for (const name of Object.getOwnPropertyNames(window)) {
            const d = Object.getOwnPropertyDescriptor(window, name); const f = d && d.value;
            if (typeof f !== 'function' || !d.writable || /^[A-Z]/.test(name) || Function.prototype.toString.call(f).includes('[native code]')) continue;
            window[name] = function (...a) {
                const vor = mess(); stapel.push({ kind: {} });
                try { return f.apply(this, a); } finally {
                    const ich = stapel.pop(); const nach = mess();
                    const s = summe[name] || (summe[name] = { aufrufe: 0 });
                    s.aufrufe++;
                    for (const k of Object.keys(vor)) {
                        const eigen = (nach[k] - vor[k]) - (ich.kind[k] || 0);
                        if (Math.abs(eigen) > 1e-9) s[k] = (s[k] || 0) + eigen;
                        if (stapel.length) stapel[stapel.length - 1].kind[k] = (stapel[stapel.length - 1].kind[k] || 0) + (nach[k] - vor[k]);
                    }
                }
            };
        }
        for (let s = 0; s < saisons; s++) {
            while (game.matchday <= 34) { game.sackPending = false; simulateMatchdays(1); }
            concludeSeasonAndAdvance();
        }
        return summe;
    }, saisons);
    const rund = (v, n = 0) => v === undefined ? '' : (Math.round(v * 10 ** n) / 10 ** n).toString();
    const zeilen = Object.entries(res)
        .map(([name, s]) => ({ name, datei: herkunft[name] || '?', ...s }))
        .filter(z => ['geld', 'staerke', 'moral', 'fans', 'vorstand', 'verletzt'].some(k => z[k] !== undefined))
        .filter(z => !filter || z.datei.includes(filter) || z.name.includes(filter))
        .sort((a, b) => a.datei.localeCompare(b.datei) || a.name.localeCompare(b.name));
    console.log(`Wirkung je Funktion über ${saisons} Saison(en) (nur eigene Änderungen):`);
    console.log('datei'.padEnd(28) + 'funktion'.padEnd(34) + 'aufrufe'.padStart(8) + 'geld'.padStart(11) + 'stärke'.padStart(9) + 'moral'.padStart(8) + 'fans'.padStart(7) + 'vorst.'.padStart(8) + 'verl.'.padStart(7));
    for (const z of zeilen) {
        console.log(z.datei.padEnd(28) + z.name.padEnd(34) + String(z.aufrufe).padStart(8) + rund(z.geld).padStart(11) + rund(z.staerke, 1).padStart(9) + rund(z.moral, 1).padStart(8) + rund(z.fans, 1).padStart(7) + rund(z.vorstand, 1).padStart(8) + rund(z.verletzt).padStart(7));
    }
    await browser.close();
})();
