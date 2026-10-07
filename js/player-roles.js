/* eslint-disable no-undef */
// Phase 23.10: Spieler-Rollen & Anweisungen
// Gib jedem Spieler spezifische taktische Anweisungen für sein Verhalten

let PLAYER_ROLE_INSTRUCTIONS = {
    'aggressiv': { label: '⚔️ Aggressiv', desc: 'Presse früh, hohes Risiko', bonus: { strength: 1.5, tackling: 2, passing: -1 } },
    'defensiv': { label: '🛡️ Defensiv', desc: 'Sicherer spielen, weniger Risiko', bonus: { strength: 1, tackling: 1, passing: 0.5 } },
    'kreativ': { label: '✨ Kreativ', desc: 'Mehr Dribbling & Pässe nach vorn', bonus: { passing: 2, dribbling: 2, strength: -1 } },
    'ausbau': { label: '🔄 Aufbau', desc: 'Ballkontrolle von hinten, sichere Pässe', bonus: { passing: 1.5, possession: 1.5, strength: 0 } },
    'kreuzer': { label: '⚡ Flanker', desc: 'Flügel beherrschen, viele Flanken', bonus: { crossing: 2, strength: 1, passing: 1 } },
    'standard': { label: '⚪ Standard', desc: 'Normale Spielweise', bonus: { strength: 0, passing: 0, tackling: 0 } }
};

function ensurePlayerRoles() {
    if (!game.playerRoles) {
        game.playerRoles = {};
    }
    squad.forEach(p => {
        if (!game.playerRoles[p.id]) {
            game.playerRoles[p.id] = 'standard';
        }
    });
}

function applyPlayerRole(playerId, role) {
    ensurePlayerRoles();
    let p = squad.find(pl => pl.id === playerId);
    if (!p || !PLAYER_ROLE_INSTRUCTIONS[role]) return false;

    game.playerRoles[p.id] = role;
    showToast(`✓ ${p.name} erhält Anweisung: ${PLAYER_ROLE_INSTRUCTIONS[role].label}`, 'success');
    return true;
}

function getPlayerRole(playerId) {
    ensurePlayerRoles();
    return game.playerRoles[playerId] || 'standard';
}

function getPlayerRoleBonus(playerId, stat) {
    let role = getPlayerRole(playerId);
    let roleData = PLAYER_ROLE_INSTRUCTIONS[role];
    return roleData?.bonus?.[stat] || 0;
}

function applyPlayerRoleModifiers(strength) {
    ensurePlayerRoles();
    let totalMod = 0;
    let activeRoles = 0;

    squad.forEach(p => {
        let role = getPlayerRole(p.id);
        if (role !== 'standard') {
            let mod = PLAYER_ROLE_INSTRUCTIONS[role].bonus.strength || 0;
            totalMod += mod * 0.1;
            activeRoles++;
        }
    });

    return strength * (1 + totalMod / Math.max(1, activeRoles));
}

function renderPlayerRolesPanel() {
    ensurePlayerRoles();
    let box = document.getElementById('player-roles-box');
    if (!box) return;

    let starterIds = game.lineup?.starters || [];
    let starters = starterIds.map(id => squad.find(p => p.id === id)).filter(Boolean).slice(0, 11);

    if (starters.length === 0) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Wähle zuerst eine Aufstellung.</div>';
        return;
    }

    let html = '<div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">Gib Spielern taktische Rollen für ihre Spielweise:</div>';

    starters.forEach(p => {
        let currentRole = getPlayerRole(p.id);
        let roleLabel = PLAYER_ROLE_INSTRUCTIONS[currentRole]?.label || '⚪ Standard';

        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-weight:bold; font-size:10px;">${p.name} (${p.pos})</div>
                    <div style="font-size:9px; color:var(--accent);">${roleLabel}</div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:2px;">
                    ${Object.keys(PLAYER_ROLE_INSTRUCTIONS).map(role => {
                        let isActive = currentRole === role;
                        return `<button onclick="applyPlayerRole('${p.id}', '${role}')" class="${isActive ? 'btn-action' : 'btn-secondary'}" style="font-size:7px; padding:2px;">${PLAYER_ROLE_INSTRUCTIONS[role].label}</button>`;
                    }).join('')}
                </div>
                <div style="font-size:8px; color:var(--text-muted); margin-top:3px;">${PLAYER_ROLE_INSTRUCTIONS[currentRole]?.desc || 'Normale Spielweise'}</div>
            </div>
        `;
    });

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Rollen beeinflussen das Spielerverhalten im Live-Spiel und die Teamstärke.
        </div>
    `;

    box.innerHTML = html;
}
