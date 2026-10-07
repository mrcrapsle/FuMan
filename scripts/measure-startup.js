// Startzeit messen wie auf einem Mittelklasse-Handy (CPU 4x gedrosselt, wie Phase 19.8).
//   node scripts/measure-startup.js [datei=dist/anstoss-fm13-standalone.min.html] [läufe=3] [profil]
// Misst "Neues Spiel" (leerer Speicher) und "Spielstand laden" (nach einer gespielten Saison).
// Mit "profil" werden die teuersten Funktionen beim Laden des Spielstands ausgegeben.
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const { chromium } = require(path.join(root, 'tests/node_modules/playwright'));
const datei = path.resolve(root, process.argv[2] || 'dist/anstoss-fm13-standalone.min.html');
const laeufe = parseInt(process.argv[3] || '3', 10);
const profil = process.argv[4] === 'profil';

async function messen(browser, url, vorbereiten, mitProfil) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    if (vorbereiten) {
        await page.goto(url);
        await page.waitForFunction(() => !document.getElementById('app-loading'));
        await page.evaluate(vorbereiten);
    }
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (mitProfil) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
    const t0 = Date.now();
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 120000 });
    const gesamt = Date.now() - t0;
    const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        return { dom: Math.round(n.domContentLoadedEventEnd), onloadStart: Math.round(n.loadEventStart), onloadEnde: Math.round(n.loadEventEnd) };
    });
    let top = null;
    if (mitProfil) {
        const { profile } = await cdp.send('Profiler.stop');
        const self = {};
        const dt = profile.timeDeltas || [];
        const byId = new Map(profile.nodes.map(n => [n.id, n]));
        (profile.samples || []).forEach((id, i) => {
            const n = byId.get(id);
            const name = (n.callFrame.functionName || '(anonym)') + ':' + n.callFrame.lineNumber;
            self[name] = (self[name] || 0) + (dt[i] || 0) / 1000;
        });
        top = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`);
    }
    await ctx.close();
    return { gesamt, ...nav, top };
}

(async () => {
    const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    const url = 'file://' + datei;
    const kb = Math.round(fs.statSync(datei).size / 1024);
    console.log(`Datei: ${path.relative(root, datei)} (${kb} KB), CPU 4x gedrosselt, ${laeufe} Läufe\n`);
    const saison = () => { closeTutorial(); game.sackPending = false; simulateMatchdays(34); saveGameToSlot(1); };
    for (const [name, vorb] of [['Neues Spiel', null], ['Spielstand laden', saison]]) {
        const werte = [];
        for (let i = 0; i < laeufe; i++) werte.push(await messen(browser, url, vorb, false));
        const med = k => werte.map(w => w[k]).sort((a, b) => a - b)[Math.floor(werte.length / 2)];
        console.log(`${name.padEnd(18)} DOMContentLoaded ${med('dom')} ms · Boot (onload) ${med('onloadEnde') - med('onloadStart')} ms · bis bedienbar ${med('onloadEnde')} ms`);
    }
    if (profil) {
        const r = await messen(browser, url, saison, true);
        console.log('\nTeuerste Funktionen (Eigenzeit) beim Laden eines Spielstands:\n' + r.top.join('\n'));
    }
    await browser.close();
})();
