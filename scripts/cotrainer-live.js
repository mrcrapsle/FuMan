// Livespiel-Bilanz des Co-Trainers (25.25): spielt N Livespiele gegen einen gleich starken Gegner.
// Jedes Spiel wird zufällig einer Strategie zugeteilt: "folgen" (jeder Hinweis wird befolgt) oder
// "ignorieren" (kein Hinweis wird befolgt). So verändert nur die Strategie den Verlauf, nicht die
// Spiele selbst. Ausgegeben werden Siege je Strategie und die Bilanz, die das Spiel selbst führt.
//   node scripts/cotrainer-live.js [spiele=200] [datei=dist/anstoss-fm13-standalone.html] [fitness=100]
const path = require('path');
const fs = require('fs');
const { chromium } = require('../tests/node_modules/playwright');


const spiele = parseInt(process.argv[2] || '200', 10);
// Fitness des Kaders vor jedem Spiel (100 = ausgeruht; ~60-70 wie nach einer Dichte von Spielen)
const fitness = parseInt(process.argv[4] || '100', 10);
const datei = path.resolve(__dirname, '..', process.argv[3] || 'dist/anstoss-fm13-standalone.html');
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Misst N Livespiele auf einer geöffneten Seite. Ergebnis: Spiele mit Strategie, Hinweise, Historie des Spiels.
async function messeLiveSpiele(page, spiele, fitness) {
    return await page.evaluate(([n, fitness]) => {
        closeTutorial();
        staffMembers.coTrainer.hired = true;
        game.coTrainerHistory = { followedMatches: 0, followedWins: 0, ownMatches: 0, ownWins: 0 };
        const out = [];
        for (let i = 0; i < n; i++) {
            const folgen = Math.random() < 0.5;
            squad.forEach(p => { p.fitness = fitness; });
            lineup = pickBestLineupIds();
            setupMatch(game.clubName, 'Testgegner Live', calcTeamStrength(true), true, false, null);
            stopLiveTickerAutoplay();
            currentMatch.halftimeShown = true;
            let befolgt = 0, hinweise = 0;
            while (currentMatch.minute < 90) {
                if (currentMatch.awaitingSetPiece) resolveSetPiece(null, true);
                simulateMatchStep();
                if (coTrainerActiveHint) {
                    hinweise++;
                    if (folgen) { followCoTrainerHint(0); befolgt++; } else ignoreCoTrainerHint();
                }
            }
            const tore = [currentMatch.homeGoals, currentMatch.awayGoals];
            const ergebnis = tore[0] > tore[1] ? 'win' : (tore[0] === tore[1] ? 'draw' : 'loss');
            // Die Bilanz schreibt das Spiel selbst: simulateMatchStep() beendet das Spiel am Ende und ruft
            // processPostMatchRoutine() auf, dort läuft recordLiveCoTrainerMatch().
            out.push({ folgen, ergebnis, befolgt, hinweise, tore: tore[0] - tore[1] });
        }
        return { zeilen: out, historie: game.coTrainerHistory };
    }, [spiele, fitness]);
}

// Gibt Siege je Strategie und die Bilanz des Spiels aus.
function zusammenfassung(zeilen, historie) {
    const gruppe = (folgen) => {
        const z = zeilen.filter(x => x.folgen === folgen);
        const siege = z.filter(x => x.ergebnis === 'win').length;
        const mit = z.filter(x => x.befolgt > 0).length;
        const diff = z.reduce((s, x) => s + x.tore, 0) / Math.max(1, z.length);
        return { n: z.length, siege, quote: (100 * siege / Math.max(1, z.length)).toFixed(1), diff: diff.toFixed(2), mit };
    };
    const folgen = gruppe(true), ignorieren = gruppe(false);
    const mitHinweis = zeilen.filter(x => x.hinweise > 0).length;
    console.log(`Livespiele: ${zeilen.length}, davon mit mindestens einem Hinweis: ${mitHinweis} (${(100 * mitHinweis / zeilen.length).toFixed(1)} %)`);
    console.log(`Strategie folgen:     ${folgen.n} Spiele, ${folgen.siege} Siege = ${folgen.quote} %, Tordifferenz Ø ${folgen.diff}`);
    console.log(`Strategie ignorieren: ${ignorieren.n} Spiele, ${ignorieren.siege} Siege = ${ignorieren.quote} %, Tordifferenz Ø ${ignorieren.diff}`);
    console.log(`Bilanz des Spiels (Kader > Co-Trainer-Historie): mit befolgten Hinweisen ${historie.liveFollowedWins || 0}/${historie.liveMatchesFollowed || 0} Siege, ohne ${historie.liveOwnWins || 0}/${historie.liveMatchesOwn || 0} Siege`);
}

module.exports = { messeLiveSpiele, zusammenfassung };

if (require.main === module) {
    (async () => {
        const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
        const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
        const page = await browser.newPage();
        page.on('pageerror', e => console.error('JS-Fehler:', e.message));
        await page.goto('file://' + datei);
        await page.waitForTimeout(600);
        const { zeilen, historie } = await messeLiveSpiele(page, spiele, fitness);
        zusammenfassung(zeilen, historie);
        await browser.close();
    })();
}
