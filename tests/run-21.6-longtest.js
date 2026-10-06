const { test, expect } = require('@playwright/test');

test.describe('Phase 21.6: Langzeittest Bundesliga (10+ Saisons)', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('file:///home/user/FuMan/dist/anstoss-fm13-standalone.html');
  });

  test('Starte Bundesliga-Karriere und spiele 10 Saisons', async () => {
    // Neues Spiel
    await page.click('button:has-text("Neues Spiel")');
    await page.waitForSelector('#new-game-club-select');
    
    // Wähle Klub (mittleres Niveau für gutes Balancing)
    await page.selectOption('#new-game-club-select', 'Eintracht Frankfurt');
    await page.click('button:has-text("Spiel starten")');
    await page.waitForSelector('#screen-dashboard', { timeout: 30000 });

    let season = 1;
    let errors = [];
    let balanceFindings = [];

    for (let s = 0; s < 10; s++) {
      console.log(`\n=== Saison ${season} ===`);
      
      // Check Spielstand
      try {
        const gameVersion = await page.evaluate(() => window.GAME_VERSION?.number);
        const money = await page.evaluate(() => window.game?.money);
        const rank = await page.evaluate(() => {
          const league = window.leaguesData?.[window.game?.leagueLevel - 1];
          if (!league) return null;
          return league.findIndex(t => t.name === window.game?.clubName) + 1;
        });
        console.log(`  Version: ${gameVersion}, Geld: €${money?.toLocaleString('de-DE')}, Rang: ${rank}`);
      } catch (e) {
        errors.push(`Saison ${season}: ${e.message}`);
      }

      // Spiele Saison (alle 34 Spieltage)
      for (let md = 1; md <= 34; md++) {
        try {
          // Matchday Simulation oder Live
          const hasLiveOption = await page.locator('button:has-text("Livespiel")').count() > 0;
          
          if (hasLiveOption && md % 10 === 0) {
            // Alle 10 Spieltage ein Livespiel
            await page.click('button:has-text("Livespiel")');
            await page.waitForSelector('#match-ticker', { timeout: 60000 });
            // Auto-resolve
            await page.evaluate(() => {
              if (window.simulateRestOfMatch) window.simulateRestOfMatch();
            });
            await page.waitForSelector('#match-end-summary', { timeout: 30000 });
            await page.click('button:has-text("Weiter")');
          } else {
            // Simuliert
            await page.click('button:has-text("Nur Ergebnis")');
          }
          
          await page.waitForSelector('#dash-next-matchday, #dash-season-end', { timeout: 10000 });
        } catch (e) {
          errors.push(`Saison ${season}, MD ${md}: ${e.message}`);
          break;
        }
      }

      // Saisonende
      try {
        await page.click('button:has-text("Nächste Saison")');
        await page.waitForSelector('#screen-dashboard', { timeout: 10000 });
        season++;
      } catch (e) {
        errors.push(`Saisonende ${season}: ${e.message}`);
        break;
      }
    }

    console.log(`\n✓ Langzeittest abgeschlossen: ${season} Saisons gespielt`);
    if (errors.length > 0) {
      console.log(`\n⚠ Fehler gefunden (${errors.length}):`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    
    expect(season).toBeGreaterThanOrEqual(10);
  });
});
