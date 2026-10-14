// Gemeinsame Hilfen der Testsuite: Zähler, assert, Seitenstart und die Ausgabe-Puffer paralleler Suiten.
const path = require('path');
const util = require('util');
const { AsyncLocalStorage } = require('async_hooks');

const TESTS_DIR = __dirname;

// Parallele Suiten schreiben über console.log: Jede Suite sammelt ihre Zeilen im eigenen
// Puffer (AsyncLocalStorage folgt den await-Ketten), ausgegeben wird der Puffer am Suitenende.
const originalLog = console.log;
const suiteAusgabe = new AsyncLocalStorage();
console.log = (...args) => {
    const puffer = suiteAusgabe.getStore();
    if (puffer) puffer.push(util.format(...args));
    else originalLog(...args);
};

// GAME_FILE env var erlaubt, dieselbe Suite auch gegen die minifizierte Variante laufen
// zu lassen (siehe minify.js/CI) - Standard bleibt die normale, lesbare Build-Ausgabe.
const GAME_PATH = 'file://' + path.resolve(TESTS_DIR, '../dist/' + (process.env.GAME_FILE || 'anstoss-fm13-standalone.html'));

const stats = { passed: 0, failed: 0, failedTests: [] };

function assert(condition, label) {
    if (condition) {
        stats.passed++;
        console.log(`  ✓ ${label}`);
    } else {
        stats.failed++;
        stats.failedTests.push(label);
        console.log(`  ✗ ${label}`);
    }
}

async function freshPage(browser) {
    const page = await browser.newPage();
    // Jede Suite hat ihren eigenen Browser-Kontext (eigener Speicher, siehe main()). Innerhalb
    // einer Suite teilen sich die Seiten aber den Speicher: ohne diesen Schritt würde eine neue
    // Seite den Autosave einer vorherigen laden (Start lädt den zuletzt geschriebenen Stand).
    // testAutosaveResume prüft dieses Startverhalten bewusst ohne Bereinigung.
    await page.addInitScript(() => { try { localStorage.removeItem('anstoss_fm13_last_save'); } catch (e) { /* egal */ } });
    let consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(e.message));
    await page.goto(GAME_PATH);
    // Boot fertig = die Ladeebene ist entfernt (finally im window.onload); statt fester 400 ms darauf warten
    await page.waitForFunction(() => !document.getElementById('app-loading'), null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(100);
    return { page, consoleErrors };
}

module.exports = { assert, freshPage, GAME_PATH, TESTS_DIR, stats, suiteAusgabe, originalLog };
