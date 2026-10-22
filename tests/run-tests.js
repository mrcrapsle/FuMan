// ============================================================================
// AUTOMATISIERTE TESTSUITE - Anstoß Mobile Pro FM13
// ============================================================================
// Läuft die gebaute Standalone-Datei in einem echten Browser (Playwright) und
// prüft die kritischsten Systeme: Struktur, Speichern/Laden (dort steckten die
// gravierendsten bisher gefundenen Bugs!), Wirtschaft, Kader, Jugend, Transfer,
// Stadion und die Match-Simulation über mehrere Saisons hinweg.
//
// Aufruf: node run-tests.js  (aus dem tests/-Ordner heraus; TEST_JOBS=1 läuft seriell, Standard 3 parallel)
// Erwartet eine bereits gebaute dist/anstoss-fm13-standalone.html (via build.py).
//
// Aufbau: lib.js (assert, freshPage, Zähler), suites/*.js (die Suiten nach Themen), hier nur der Ablauf
// (Reihenfolge, Parallelität, Zusammenfassung). TEST_ONLY=<Teilstring des Suitennamens> wählt Suiten aus.
// ============================================================================

const { chromium } = require('playwright');
const { stats, suiteAusgabe, originalLog } = require('./lib');
const fs = require('fs');
const path = require('path');

// Alle Suiten aus tests/suites/ in einem Objekt (Name -> Funktion)
const S = {};
fs.readdirSync(path.join(__dirname, 'suites')).filter(f => f.endsWith('.js')).sort()
    .forEach(f => Object.assign(S, require('./suites/' + f)));

async function main() {
    console.log('='.repeat(60));
    console.log('ANSTOSS FM13 - AUTOMATISIERTE TESTSUITE');
    console.log('='.repeat(60));

    // Versuche zuerst 1243, dann 1194 (für verschiedene Umgebungen)
    let executablePath;
    const { existsSync } = require('fs');
    if (existsSync('/opt/pw-browsers/chromium-1243/chrome-linux/chrome')) {
        executablePath = '/opt/pw-browsers/chromium-1243/chrome-linux/chrome';
    } else if (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) {
        executablePath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    }
    const browser = await chromium.launch(executablePath ? { executablePath } : {});

    const suites = [
        S.testStructuralSelfTest,
        S.testSaveLoad,
        S.testMatchSimulationStability,
        S.testEconomy,
        S.testSquadAndTactics,
        S.testYouthAcademy,
        S.testYouthPathway,
        S.testSponsorConflict,
        S.testLexicon,
        S.testSeasonPreview,
        S.testAttendanceCapVaries,
        S.testLockerRoom,
        S.testSetPieces,
        S.testCupFinal,
        S.testCleanupPart8,
        S.testScenarioBalance,
        S.testSaveSafety,
        S.testOneHandControls,
        S.testDerbyWeek,
        S.testCoTrainerLive,
        S.testPregameTalk,
        S.testMatchPrep,
        S.testSetPieceDrills,
        S.testRefereeCritique,
        S.testMedicalCheck,
        S.testPreContracts,
        S.testBuyback,
        S.testRumors,
        S.testWinterTalk,
        S.testTransferStrategy,
        S.testYouthSales,
        S.testBookingLabels,
        S.testSponsorRenewal,
        S.testTrainingGrowthCaps,
        S.testProLoans,
        S.testCaptainSuccession,
        S.testLexiconEnglish,
        S.testPromotionTvAdvance,
        S.testTvAdvanceGracePeriod,
        S.testCupAndLeagueSameDay,
        S.testBoardEarlyWarning,
        S.testRunde36Anzeigen,
        S.testKiAngebotObergrenze,
        S.testRunde40Funktionen,
        S.testRueckennummerUndWette,
        S.testLegendenNummer,
        S.testAlteAngebotKappung,
        S.testStaffAufgabenModi,
        S.testPersonalEinstellen,
        S.testGreenkeeperAufgabe,
        S.testPersonalEinstellenHandy,
        S.testAnalystErnaehrung,
        S.testPersonalGrundAnzeige,
        S.testVorstandHub,
        S.testDesignThemes,
        S.testKeineFestenFarben,
        S.testKontrastAlleThemes,
        S.testBedienelementeHabenNamen,
        S.testAutoThemeUndBewegung,
        S.testKopfzeileHinweisUndPokerFenster,
        S.testFensterTastaturUndSpeicher,
        S.testSpielvorbereitung,
        S.testVertragsWerkzeuge,
        S.testStatistikWerkzeuge,
        S.testManagerWerkzeuge,
        S.testVergleichUndNotizen,
        S.testFeinschliffNachPhase26,
        S.testRunde27Funktionen,
        S.testRunde28Funktionen,
        S.testRunde29Funktionen,
        S.testRunde30Funktionen,
        S.testRunde31Funktionen,
        S.testRunde32Markt,
        S.testRunde32Spieltag,
        S.testRunde32Uebersicht,
        S.testRunde32Statistik,
        S.testRunde33Funktionen,
        S.testStadionWerkzeuge,
        S.testPostfachLoeschen,
        S.testFreischaltungen,
        S.testFreischaltungenPlus,
        S.testGrundfassung,
        S.testKopfzeilenFenster,
        S.testAusschreitungen,
        S.testStartmenue,
        S.testAdminWerkzeuge,
        S.testPrivatlebenPlus,
        S.testOeffentlicheFassung,
        S.testAdminPin,
        S.testKnopfWorteHandy,
        S.testEntlassungsGrund,
        S.testEnglishUi,
        S.testSwapDeals,
        S.testPlayerProfile,
        S.testHomeRegion,
        S.testLocalDerbies,
        S.testEuropeDraw,
        S.testCleanupNine,
        S.testBundesligaLongRun,
        S.testCareerScenarios,
        S.testAutosaveResume,
        S.testOpponentTactics,
        S.testTransferPoker,
        S.testNationalTeam,
        S.testTransferMarket,
        S.testStadiumSystems,
        S.testAllScreensRender,
        S.testOldSaveMigration,
        S.testTrainingOverhaul,
        S.testLivingLeaguePersistence,
        S.testClubRenameAndSwitch,
        S.testTransferMarketAndClubDossier,
        S.testFreeTextInputSanitization,
        S.testSaveExportImportAndErrorLog,
        S.testLeagueStats,
        S.testAchievementsSystem,
        S.testConfigurableNewGameStart,
        S.testAccessibilityContrastAndFontSizes,
        S.testLanguageToggle,
        S.testManagerOffice,
        S.testTaxAndAdvisor,
        S.testStadiumWideBanden,
        S.testOfficeAtmosphereAndCrest,
        S.testRealisticMerchSales,
        S.testBuildingPaymentAndPrices,
        S.testAutoSaveAndPartialSimulation,
        S.testConfirmBeforeIrreversibleActions,
        S.testFinanceLedgerAndStatement,
        S.testEconomyBalance,
        S.testSecondTeamAndTrainingAutomation,
        S.testLeagueEconomy,
        S.testTransferMarketFairness,
        S.testSecondTeamFriendlies,
        S.testOfficeEvents,
        S.testNoNativeDialogs,
        S.testFakeDecisions,
        S.testEuropeanCup,
        S.testLoadingGuard,
        S.testAttendanceRealism,
        S.testClubAndPlayerNames,
        S.testLandesPokal,
        S.testFinancialFairplay,
        S.testBonusClauses,
        S.testSquadPlanningTool,
        S.testStadiumAusbau2,
        S.testPlayerAvatars,
        S.testTrainingCalendar,
        S.testTacticAutomation,
        S.testObjectivesEventsSeasonTickets,
        S.testCodeIntegrity,
        S.testPhase11,
        S.testWomenTeamExtras,
        S.testBoardRestart,
        S.testPhase12,
        S.testPhase13,
        S.testPhase13Teil2,
        S.testPhase13Teil3,
        S.testPhase13Teil4,
        S.testPhase14Teil1,
        S.testPhase14Teil2,
        S.testPhase14Teil3,
        S.testPhase14Teil4,
        S.testLongRun,
        S.testTacticRecords,
        S.testCupLive,
        S.testSeasonEvents,
        S.testMobileLayout,
        S.testCareerBalancing,
        S.testLiveMatchEngine,
        S.testNoWriteOnlyGameFields,
        S.testAiClubs,
        S.testPlayerStats,
        S.testOnboarding,
        S.testCompactSave,
        S.testPressConference,
        S.testContractTalks,
        S.testJobOffers,
        S.testSpielstandAeltereVersion,
        S.testTastaturFokus,
        S.testDashAutosaveZeile,
        S.testSpielstandFehlermeldung,
        S.testCoTrainerLiveBilanz,
        S.testEuropaGruppenPlatz,
        S.testVorvertragsFrist,
        S.testAeltereStaende,
        S.testModalFokus,
        S.testAutosaveLadeMeldung,
        S.testEnglischDynamischeTexte,
        S.testHinweisAnzeige,
        S.testVorwarnungTrend,
        S.testDashVorwarnZeile,
        S.testDruckHinweis,
        S.testStartzeit,
        S.testRuntimeRoundTrip,
    ];

    // TEST_ONLY=Landes npm test -> nur Suiten, deren Name den Text enthält
    const only = process.env.TEST_ONLY;
    // Die langsamsten Suiten (rund 5 s) starten zuerst, dann füllen die kurzen Suiten die Lücken (25.25)
    const vorne = new Set(['testKnopfWorteHandy', 'testKontrastAlleThemes', 'testAeltereStaende', 'testMobileLayout', 'testBedienelementeHabenNamen', 'testManagerOffice', 'testLoadingGuard']);
    const alle = (only ? suites.filter(s => s.name.includes(only)) : [...suites])
        .sort((a, b) => (vorne.has(b.name) ? 1 : 0) - (vorne.has(a.name) ? 1 : 0));
    // Zeitmessungen laufen allein nach den übrigen Suiten - parallele Last würde sie verfälschen (25.26)
    const einzeln = new Set(['testStartzeit']);
    const liste = alle.filter(s => !einzeln.has(s.name));
    const allein = alle.filter(s => einzeln.has(s.name));

    // Suiten laufen parallel (TEST_JOBS, Standard 3). Jede Suite bekommt einen eigenen
    // Browser-Kontext = eigener Speicher, so sieht keine Suite den Stand einer anderen.
    // Ihre Ausgabe wird gesammelt und am Stück ausgegeben, damit sich die Protokolle nicht mischen.
    const jobs = Math.max(1, parseInt(process.env.TEST_JOBS || '3', 10) || 3);
    let naechste = 0;
    const laufen = async () => {
        while (naechste < liste.length) {
            const suite = liste[naechste++];
            const ausgabe = [];
            const start = Date.now();
            // Startmenü (js/startmenue.js) beim Start aus: die Suiten bedienen das Spiel direkt; testStartmenue schaltet es ein.
            // Freischaltungen (js/freischaltungen.js): die Suiten testen die Bereiche selbst, also alles offen;
            // testFreischaltungen nimmt das Kennzeichen wieder weg. Wirkt nur in der Entwickler-Fassung. Bewusst
            // nicht im localStorage: ein Schreiben vor dem Seitenstart verlor beim Neuladen andere frische Werte.
            const allesFrei = async c => { await c.addInitScript(() => { window.anstossTestAllesFrei = true; window.anstossOhneStartmenue = true; }); return c; };
            const ctx = await allesFrei(await browser.newContext());
            // Eigene Kontexte (z.B. mit Viewport) gehören zur Suite und werden mit ihr geschlossen,
            // denn BrowserContext.newPage() nimmt keine Optionen.
            const eigene = [];
            const browserShim = {
                newPage: async opts => {
                    if (!opts) return ctx.newPage();
                    const neu = await allesFrei(await browser.newContext(opts));
                    eigene.push(neu);
                    return neu.newPage();
                },
                newContext: async opts => {
                    const neu = await allesFrei(await browser.newContext(opts));
                    eigene.push(neu);
                    return neu;
                },
            };
            try {
                await suiteAusgabe.run(ausgabe, () => suite(browserShim));
            } catch (e) {
                stats.failed++;
                stats.failedTests.push(`${suite.name} (Testlauf abgebrochen: ${e.message})`);
                ausgabe.push(`\nTestlauf abgebrochen in ${suite.name}: ${e.message}`);
            } finally {
                for (const c of [ctx, ...eigene]) await c.close().catch(() => {});
            }
            ausgabe.push(`  ⏱ ${suite.name}: ${((Date.now() - start) / 1000).toFixed(1)} s`);
            originalLog(ausgabe.join('\n'));
        }
    };
    await Promise.all(Array.from({ length: Math.min(jobs, liste.length) }, laufen));
    liste.splice(0, liste.length, ...allein);
    naechste = 0;
    await laufen();

    await browser.close();

    console.log('\n' + '='.repeat(60));
    console.log(`ERGEBNIS: ${stats.passed} bestanden, ${stats.failed} fehlgeschlagen`);
    if (stats.failedTests.length > 0) {
        console.log('\nFehlgeschlagene Tests:');
        stats.failedTests.forEach(t => console.log(`  - ${t}`));
        // In GitHub Actions zusätzlich als Annotation: die sind über die API lesbar, auch
        // wenn das Protokoll selbst nicht abrufbar ist.
        if (process.env.GITHUB_ACTIONS) stats.failedTests.forEach(t => console.log(`::error title=Test fehlgeschlagen (${process.env.GAME_FILE || 'standalone'})::${String(t).replace(/[\r\n]+/g, ' ').slice(0, 300)}`));
    }
    console.log('='.repeat(60));
    process.exit(stats.failed > 0 ? 1 : 0);
}

main();
