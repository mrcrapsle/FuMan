// Spielerentwicklung: Jeder Spieler hat einen Entwicklungstyp mit eigenem Leistungshöhepunkt.
// Am Saisonende wird der Kader ein Jahr älter - vor dem Höhepunkt legen Spieler zu, danach
// bauen sie ab. Bisher alterte im Spiel niemand: das einzige Alterungsmodul setzte das Alter
// jeden Monat auf das Beitrittsalter zurück. Löst drei Module ab (Archetypen, die nie
// zugewiesen wurden, eine kaputte Alterung und eine Karrierestatistik, die nicht gespeichert wurde).

const ARCHETYPES = {
    'steady-eddy': { name: 'Konstanter Profi', icon: '⚖️', peakAge: 29, developmentRate: 1.0, declineRate: 1.0, weight: 40 },
    'late-bloomer': { name: 'Spätzünder', icon: '📈', peakAge: 31, developmentRate: 0.8, declineRate: 0.8, weight: 20 },
    'early-bloomer': { name: 'Frühe Blüte', icon: '⭐', peakAge: 25, developmentRate: 1.4, declineRate: 1.4, weight: 20 },
    'wonderkid': { name: 'Wunderkind', icon: '🌟', peakAge: 27, developmentRate: 1.8, declineRate: 1.6, weight: 8 },
    'fallen-star': { name: 'Früh verglüht', icon: '💔', peakAge: 24, developmentRate: 0.6, declineRate: 2.0, weight: 12 }
};

// Fester Typ je Spieler (aus der ID abgeleitet, damit er nicht vom Zufall beim Laden abhängt).
function getPlayerArchetype(p) {
    if (!ARCHETYPES[p.archetype]) {
        const hash = String(p.id).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7) % 100;
        let sum = 0;
        p.archetype = Object.keys(ARCHETYPES).find(k => (sum += ARCHETYPES[k].weight) > hash) || 'steady-eddy';
    }
    return ARCHETYPES[p.archetype];
}

// Erwartete Stärkeänderung für das kommende Lebensjahr: [min, max].
function getDevelopmentRange(p) {
    const arch = getPlayerArchetype(p);
    const vomHoehepunkt = (p.age || 25) - arch.peakAge;
    if (vomHoehepunkt < -1) return [Math.round(arch.developmentRate * 0.5), Math.round(arch.developmentRate * 2)];
    if (vomHoehepunkt <= 1) return [0, 0];
    const abbau = arch.declineRate * 0.4 * vomHoehepunkt;
    return [-Math.round(abbau + 1), -Math.max(0, Math.round(abbau))];
}

function agePlayer(p) {
    const [min, max] = getDevelopmentRange(p);
    const delta = min + Math.floor(Math.random() * (max - min + 1));
    p.age = (p.age || 25) + 1;
    const alt = p.strength;
    p.strength = Math.max(20, Math.min(99, p.strength + delta));
    if (p.strength !== alt && typeof calculatePlayerMarketValue === 'function') p.marketValue = calculatePlayerMarketValue(p.strength);
    return p.strength - alt;
}

// Saisonende: ganzer Kader (und zweite Mannschaft) wird ein Jahr älter.
function agePlayersAtSeasonEnd() {
    const changes = squad.map(p => ({ p, delta: agePlayer(p) }));
    if (typeof secondTeamSquad !== 'undefined') secondTeamSquad.forEach(agePlayer);
    // Wer jetzt das Rentenalter erreicht, beendet seine Laufbahn zum Saisonwechsel.
    if (typeof tickPlayerRetirement === 'function') tickPlayerRetirement();
    const auf = changes.filter(c => c.delta > 0).sort((a, b) => b.delta - a.delta);
    const ab = changes.filter(c => c.delta < 0).sort((a, b) => a.delta - b.delta);
    const liste = arr => arr.slice(0, 3).map(c => `${c.p.name} (${c.p.age}, ${c.delta > 0 ? '+' : ''}${c.delta})`).join(', ');
    addInboxMessage('vertrag', '📈 Spielerentwicklung über den Sommer',
        `Der Kader ist ein Jahr älter. ${auf.length} Spieler haben sich verbessert${auf.length ? `, am stärksten ${liste(auf)}` : ''}. ` +
        `${ab.length} haben abgebaut${ab.length ? `, am deutlichsten ${liste(ab)}` : ''}.`, 'screen-squad-planning');
}

function formatDevelopmentRange(p) {
    const [min, max] = getDevelopmentRange(p);
    if (max === 0 && min === 0) return '<span style="color:var(--text-muted);">→ Höhepunkt</span>';
    if (min >= 0) return `<span style="color:var(--primary);">↑ +${min === max ? max : `${min}-${max}`}</span>`;
    return `<span style="color:var(--danger);">↓ ${max === min ? min : `${max} bis ${min}`}</span>`;
}

function renderPlayerDevelopmentPanel() {
    const box = document.getElementById('player-development-box');
    if (!box) return;
    const rows = [...squad].sort((a, b) => (a.age || 0) - (b.age || 0)).map(p => {
        const arch = getPlayerArchetype(p);
        const hist = p.strengthHistory || [];
        const letzte = hist.length ? p.strength - hist[hist.length - 1].strength : 0;
        return `<div style="display:grid; grid-template-columns: 1fr auto auto auto; gap:6px; padding:2px 0; border-top:1px solid rgba(255,255,255,0.06); align-items:center;">
            <span>${p.name} <span style="color:var(--text-muted);">${p.pos}, ${p.age} J.</span></span>
            <span title="${arch.name}, Höhepunkt mit ${arch.peakAge}">${arch.icon}</span>
            <span>${p.strength}${letzte ? ` <span style="color:${letzte > 0 ? 'var(--primary)' : 'var(--danger)'};">(${letzte > 0 ? '+' : ''}${letzte})</span>` : ''}</span>
            <span style="white-space:nowrap;">${formatDevelopmentRange(p)}</span>
        </div>`;
    }).join('');
    box.innerHTML = `<div style="font-size:9px;">
        <div style="color:var(--text-muted); margin-bottom:4px;">Am Saisonende altern alle Spieler um ein Jahr. Rechts: erwartete Stärkeänderung im Sommer (Klammer: seit Saisonbeginn).</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px;">${Object.values(ARCHETYPES).map(a => `<span>${a.icon} ${a.name} (${a.peakAge})</span>`).join('')}</div>
        ${rows}
    </div>`;
}

// Karriere-Block im Spielerdetail - aus gespeicherten Spielerdaten.
function renderPlayerCareerPanel(playerId) {
    const p = squad.find(x => x.id === playerId);
    if (!p) return '';
    const arch = getPlayerArchetype(p);
    const hist = p.strengthHistory || [];
    const peak = hist.reduce((best, h) => (h.strength > best.strength ? h : best), { strength: p.strength, season: game.season });
    const saisons = hist.filter(h => h.apps !== undefined).slice(-5).reverse();
    return `<div class="box" style="font-size:9px;">
        <div style="font-weight:700; color:var(--accent); margin-bottom:4px;">📊 KARRIERE</div>
        ${arch.icon} ${arch.name} - Höhepunkt mit etwa ${arch.peakAge} Jahren · nächster Sommer: ${formatDevelopmentRange(p)}<br>
        ${p.appearances || 0} Pflichtspiele · ${p.goalsCareer || 0} Tore · Bestwert Stärke ${peak.strength} (Saison ${peak.season})
        ${saisons.length ? `<div style="margin-top:4px;">${saisons.map(h => `Saison ${h.season}: ${h.apps} Spiele, ${h.goals} Tore, Stärke ${h.strength}`).join('<br>')}</div>` : ''}
    </div>`;
}

// Alte Spielstände: Daten der abgelösten Module.
function cleanupLegacyDevelopmentState() {
    delete game.playerDevelopment;
    // Die alte Alterung hinterließ Kommazahlen bei Alter und Stärke.
    squad.forEach(p => { p.age = Math.round(p.age || 25); p.strength = Math.round(p.strength); });
}
