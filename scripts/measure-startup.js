#!/usr/bin/env node
/**
 * Misst die Startup-Zeit des Spiels mit Chromium
 * Nutzung: node scripts/measure-startup.js
 */

const chromium = require('chromium');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function measureStartup() {
  const distPath = path.resolve(__dirname, '../dist/anstoss-fm13-standalone.html');
  const fileUrl = 'file://' + distPath;
  
  console.log('📊 Messe Startup-Zeit...\n');
  
  // Starten mit --disable-sync um schneller zu booten
  const chromeArgs = [
    '--disable-sync',
    '--disable-background-networking',
    '--disable-plugins',
    '--disable-device-discovery-notifications',
    `--app=${fileUrl}`
  ];
  
  const startTime = Date.now();
  let bootTime = null;
  let msgCount = 0;
  
  const chrome = spawn(chromium.path, chromeArgs, { stdio: 'pipe' });
  
  // Parse CDP messages für Performance-Metriken
  chrome.stdout.on('data', (data) => {
    msgCount++;
    if (msgCount % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      process.stdout.write(`.`);
    }
  });
  
  // Nach 8 Sekunden abbrechen (sollte bis dahin fertig sein)
  const timeout = setTimeout(() => {
    chrome.kill();
    bootTime = Date.now() - startTime;
    
    console.log(`\n\n⏱️  Startup-Zeit: ${bootTime}ms`);
    console.log(`   Ziel: < 3000ms für moderne Geräte`);
    console.log(`   Aktuell: ${bootTime > 3000 ? '❌ ZU LANGSAM' : '✅ OK'}`);
    
    process.exit(bootTime > 3000 ? 1 : 0);
  }, 8000);
  
  chrome.on('error', (err) => {
    clearTimeout(timeout);
    console.error('Fehler beim Starten von Chrome:', err);
    process.exit(1);
  });
}

measureStartup().catch(console.error);
