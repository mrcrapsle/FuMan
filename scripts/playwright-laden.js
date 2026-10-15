// Lädt Playwright für die Skripte: bevorzugt tests/node_modules (npm install im Ordner tests/), sonst das
// global bereitgestellte Paket (z. B. in Cloud-Sitzungen unter /opt/node-tools) oder ein per NODE_PATH erreichbares.
const path = require('path');
const kandidaten = [
    path.join(__dirname, '..', 'tests', 'node_modules', 'playwright'),
    'playwright',
    '/opt/node-tools/node_modules/playwright'
];
let fehler = null;
for (const k of kandidaten) {
    try { module.exports = require(k); fehler = null; break; } catch (e) { fehler = e; }
}
if (fehler) throw new Error('Playwright nicht gefunden (npm install im Ordner tests/ ausführen): ' + fehler.message);
