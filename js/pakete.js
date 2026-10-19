// Grundfassung mit großen Updates (build.py, Ausbaustufen): welche Pakete in dieser Fassung stecken.
// build.py ersetzt die Zeile mit SPIEL_PAKETE je Fassung; modular (npm run serve) ist alles dabei.
// Was in einem fehlenden Paket liegt, hat in der Datei weder Bildschirm noch Menüpunkt; die Grunddaten
// (js/state.js) bleiben, damit Spielstände zwischen den Fassungen passen.
let SPIEL_PAKETE = ['vereinswachstum', 'finanzwelt', 'konzern'];
const SPIEL_PAKET_INFO = {
    vereinswachstum: { name: 'Vereinswachstum', icon: '🌱', text: 'Zweite Mannschaft, Frauenmannschaft, Stadion-Anlagen und große Ausbauprojekte.', screens: ['screen-second-team', 'screen-women'] },
    finanzwelt: { name: 'Finanzwelt', icon: '📈', text: 'Aktien und Kapitalmarkt, Sportwetten und Immobilien.', screens: ['screen-stocks', 'screen-betting', 'screen-real-estate'] },
    konzern: { name: 'Konzern', icon: '🏢', text: 'Holding mit B2B-Aufträgen, Industrie, Fabriken und Rohstoffe.', screens: ['screen-holding', 'screen-industry', 'screen-raw-materials'] }
};

function paketVorhanden(key) {
    return !key || key === 'grundspiel' || SPIEL_PAKETE.includes(key);
}

function getPaketVonBildschirm(id) {
    return Object.keys(SPIEL_PAKET_INFO).find(k => SPIEL_PAKET_INFO[k].screens.includes(id)) || null;
}

// Beim Laden: was seit dem letzten Stand dieses Spiels dazugekommen ist (game.bekanntePakete).
// Ein Stand ohne die Liste (vor dem System oder ein neues Spiel) übernimmt sie still.
function pruefeNeuePakete() {
    const bekannt = Array.isArray(game.bekanntePakete) ? game.bekanntePakete : null;
    game.bekanntePakete = SPIEL_PAKETE.slice();
    if (!bekannt) return [];
    const neu = SPIEL_PAKETE.filter(k => !bekannt.includes(k));
    if (!neu.length) return neu;
    const text = neu.map(k => `${SPIEL_PAKET_INFO[k].icon} ${SPIEL_PAKET_INFO[k].name}: ${SPIEL_PAKET_INFO[k].text}`).join('\n\n');
    addInboxMessage('analyse', '🎁 Neu in diesem Update', `${text}\n\nAuch für die neuen Bereiche gelten die Freischaltungen, siehe Manager-Talentbaum.`, 'screen-manager-tree');
    showNotice('🎁 Neu in diesem Update', `${text}\n\nAuch für die neuen Bereiche gelten die Freischaltungen, siehe Manager-Talentbaum.`);
    return neu;
}
