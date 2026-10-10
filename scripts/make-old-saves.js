// Erzeugt Spielstand-Fixtures aus alten Builds (25.25, Test testAeltereStaende):
//   node scripts/make-old-saves.js <Ausgabeordner> <version>=<pfad-zur-alten-html> ...
// Jede alte Datei wird im Browser geöffnet, ein Spielstand in Slot 1 geschrieben und der rohe
// Inhalt als <Ausgabeordner>/v<version>.json abgelegt. Der Test lädt diese Dateien in den
// aktuellen Build und prüft, dass sie ohne Absturz und mit erhaltenem Geld und Kader laden.
const fs = require('fs');
const path = require('path');
const { chromium } = require('../tests/node_modules/playwright');

const [, , ausgabe, ...paare] = process.argv;
if (!ausgabe || paare.length === 0) { console.error('Aufruf: node scripts/make-old-saves.js <Ausgabeordner> <version>=<pfad> ...'); process.exit(1); }
const SLOT_KEY = 'anstoss_fm13_save_slot_1';

(async () => {
    const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
    fs.mkdirSync(ausgabe, { recursive: true });
    for (const paar of paare) {
        const [version, datei] = paar.split('=');
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const fehler = [];
        page.on('pageerror', e => fehler.push(e.message));
        await page.goto('file://' + path.resolve(datei));
        await page.waitForTimeout(600);
        const raw = await page.evaluate((key) => {
            try { closeTutorial(); } catch (e) { /* ältere Builds ohne Tutorial-Schließen */ }
            saveGameToSlot(1);
            return localStorage.getItem(key);
        }, SLOT_KEY);
        if (!raw) { console.error(`Kein Spielstand von ${version} erhalten`); process.exitCode = 1; }
        else {
            const ziel = path.join(ausgabe, `v${version}.json`);
            fs.writeFileSync(ziel, raw);
            console.log(`${version}: ${ziel} (${Math.round(raw.length / 1024)} KB)${fehler.length ? ' Fehler: ' + fehler.slice(0, 2).join(' | ') : ''}`);
        }
        await ctx.close();
    }
    await browser.close();
})();
