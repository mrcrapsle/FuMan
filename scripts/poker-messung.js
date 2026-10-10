// Transferpoker-Messung (Punkt 9 der Runde 25.30): spielt je Markt-Spieler eine Verhandlung
// mit einer festen Strategie durch und zählt Abschlüsse, Preis gegen Forderung und verbrauchte Geduld.
//   node scripts/poker-messung.js [spiele=20] [datei]
// Strategien: start = Anteil der Forderung für das erste Angebot, schritt = Erhöhung je Runde (Prozentpunkte).
const path = require('path');
const root = path.resolve(__dirname, '..');
const { chromium } = require(path.join(root, 'tests/node_modules/playwright'));

const STRATEGIEN = [
    { name: 'knapp (85 %, +5)', start: 0.85, schritt: 5 },
    { name: 'fair (92 %, +4)', start: 0.92, schritt: 4 },
    { name: 'hoch (98 %, +2)', start: 0.98, schritt: 2 }
];

async function spiel(browser, datei, strategie) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('file://' + datei);
    await page.waitForTimeout(400);
    const ergebnisse = await page.evaluate(({ start, schritt }) => {
        closeTutorial();
        game.sackPending = false;
        const out = [];
        // Mehrere Markt-Spieler: je ein Versuch, Spieler ohne Verhandlung zählen nicht
        for (let idx = 0; idx < marketPlayers.length && idx < 10; idx++) {
            const p = marketPlayers[idx];
            if (!p) continue;
            ensureTransferTerms(p);
            openTransferPoker(idx);
            if (!transferPoker) continue;
            const patienz0 = transferPoker.patience;
            const forderung = p.askingPrice;
            transferPoker.offer = Math.round(forderung * start / 1000) * 1000;
            let runden = 0;
            while (transferPoker && !transferPoker.agreedFee && transferPoker.patience > 0 && runden < 12) {
                submitPokerOffer();
                runden++;
                if (!transferPoker || transferPoker.agreedFee) break;
                // Nach einem Gegenangebot erhöhen wir um den Schritt, bis zur Forderung
                transferPoker.offer = Math.min(forderung, Math.round(transferPoker.offer * (1 + schritt / 100) / 1000) * 1000);
            }
            const abgeschlossen = !!(transferPoker && transferPoker.agreedFee);
            out.push({
                abgeschlossen,
                preisAnteil: abgeschlossen ? transferPoker.agreedFee / forderung : null,
                runden,
                geduldVerbraucht: abgeschlossen ? patienz0 - transferPoker.patience : patienz0,
                verbrannt: !abgeschlossen && !!p.pokerBroken
            });
            closeTransferPoker();
        }
        return out;
    }, strategie);
    await ctx.close();
    return ergebnisse;
}

(async () => {
    const spiele = parseInt(process.argv[2] || '20', 10);
    const datei = path.resolve(process.argv[3] || path.join(root, 'dist/anstoss-fm13-standalone.html'));
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const s of STRATEGIEN) {
        const alle = [];
        for (let i = 0; i < spiele; i++) alle.push(...await spiel(browser, datei, s));
        const abschluesse = alle.filter(e => e.abgeschlossen);
        const anteil = abschluesse.reduce((a, e) => a + e.preisAnteil, 0) / Math.max(1, abschluesse.length);
        const geduld = alle.reduce((a, e) => a + e.geduldVerbraucht, 0) / Math.max(1, alle.length);
        const pleite = alle.filter(e => e.verbrannt).length;
        console.log(`${s.name}: ${alle.length} Verhandlungen, Abschluss ${(100 * abschluesse.length / Math.max(1, alle.length)).toFixed(0)} %, ` +
            `Preis im Schnitt ${(100 * anteil).toFixed(1)} % der Forderung, Geduld verbraucht ${geduld.toFixed(1)}, Gespräche abgebrochen ${pleite}`);
    }
    await browser.close();
})();
