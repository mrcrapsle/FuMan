/* eslint-disable no-undef */
// Kabine: Rangordnung, Grüppchen (Cliquen), Unzufriedene und die Kapitänsfrage. Baut auf dem
// einen Mannschaftsrat auf (js/team-council.js: Kapitän + zwei Führungsspieler nach
// getLeadershipScore()). Früher gab es daneben einen zweiten "Führungsspieler-Rat" mit anderen
// Mitgliedern (campus-staff.js) - zusammengelegt in Phase 20.2.
//
// Wirkung: eine Clique mit Stimmung unter 40 rumort und zieht monatlich den Rest des Kaders
// runter (ein Kapitän mit Autorität halbiert das), unruhige Cliquen kosten Teamstärke
// (getCliqueChemistryModifier), ihr Wortführer meldet sich über den Rat. Unzufriedene
// Leistungsträger kommen ins Büro (pickUnhappyVisitor, js/office-events.js). Ein Kapitänswechsel
// trifft den alten Kapitän und - ohne Rückhalt in der Kabine - den Rat.

const CLIQUE_AGE_LABELS = { jung: 'Junge Wilde', mitte: 'Mittelbau', erfahren: 'Routiniers' };
const CLIQUE_UNREST_MOOD = 40;

// Führungsqualität: Leader-Eigenschaft, Alter, Erfahrung, Moral.
function getLeadershipScore(p) {
    return (p.trait === 'Leader' ? 30 : 0) + Math.max(0, (p.age || 25) - 26) * 2
        + Math.min(p.appearances || 0, 150) * 0.12 + (p.morale || 50) * 0.15;
}

function getLockerRoomStatus(p) {
    if (p.id === game.captainId) return { key: 'kapitaen', label: 'Ⓒ Kapitän' };
    const rat = (game.teamCouncil && game.teamCouncil.memberIds) || [];
    if (rat.includes(p.id)) return { key: 'rat', label: '🗣️ Führungsspieler' };
    if ((p.appearances || 0) >= 30 || (p.age || 25) >= 27) return { key: 'etabliert', label: 'Etabliert' };
    if ((p.age || 25) <= 21) return { key: 'talent', label: '🌱 Talent' };
    return { key: 'mitlaeufer', label: 'Mitläufer' };
}

// Cliquen nach Nation und Altersgruppe (ab 3 Spielern), mit Stimmung und Wortführer.
function computeSquadCliques() {
    const groups = {};
    squad.forEach(p => {
        const ageGroup = (p.age || 25) <= 23 ? 'jung' : ((p.age || 25) >= 30 ? 'erfahren' : 'mitte');
        const key = `${p.nation || 'Deutschland'}-${ageGroup}`;
        (groups[key] = groups[key] || []).push(p);
    });
    const cliques = Object.entries(groups).filter(([, members]) => members.length >= 3).map(([key, members]) => {
        const [nation, alter] = key.split('-');
        const flag = typeof NATIONS !== 'undefined' && NATIONS[nation] ? NATIONS[nation].flag : '🏳️';
        const mood = Math.round(members.reduce((s, p) => s + (p.morale || 50), 0) / members.length);
        const leader = [...members].sort((a, b) => getLeadershipScore(b) - getLeadershipScore(a))[0];
        return { key, name: `${flag} ${CLIQUE_AGE_LABELS[alter] || alter}`, members, size: members.length, mood, leader, unruhig: mood < CLIQUE_UNREST_MOOD };
    });
    const largestClique = [...cliques].sort((a, b) => b.size - a.size)[0];
    return { cliques, largestClique, fragmentation: cliques.length };
}

function getCliqueChemistryModifier() {
    const { cliques, largestClique, fragmentation } = computeSquadCliques();
    let bonus = 0;
    if (largestClique && largestClique.size >= squad.length * 0.4 && !largestClique.unruhig) bonus += 1.5; // einende Clique
    if (fragmentation >= 5) bonus -= 1;                                                                 // viele kleine Grüppchen
    bonus -= Math.min(1.5, cliques.filter(c => c.unruhig).length * 0.5);                               // rumorende Cliquen
    return bonus;
}

function captainHasAuthority() {
    const k = squad.find(p => p.id === game.captainId);
    return !!k && (k.morale || 50) >= 60 && getLeadershipScore(k) >= 20;
}

// Monatlich nach dem Mannschaftsrat (processPostMatchRoutine).
function tickLockerRoom() {
    const { cliques } = computeSquadCliques();
    const autoritaet = captainHasAuthority();
    cliques.forEach(c => {
        if (c.unruhig) {
            if (!autoritaet || Math.random() < 0.5) adjustMorale(squad.filter(p => !c.members.includes(p)), -1);
        } else if (c.mood >= 75) {
            adjustMorale(c.members, 1);
        }
    });
}

// Für findCouncilConcern(): rumorende Clique oder die Kapitänsfrage.
function findLockerRoomConcern() {
    const unruhig = computeSquadCliques().cliques.filter(c => c.unruhig).sort((a, b) => a.mood - b.mood)[0];
    if (unruhig && unruhig.leader) {
        return { type: 'clique', cliqueKey: unruhig.key, leaderId: unruhig.leader.id, title: `Die Gruppe ${unruhig.name} rumort`,
            text: `${unruhig.leader.name} spricht für ${unruhig.size} Spieler (Stimmung ${unruhig.mood}). Die schlechte Laune färbt auf die Kabine ab und kostet Teamstärke.` };
    }
    const kapitaen = squad.find(p => p.id === game.captainId);
    if (kapitaen) {
        const ohneEinsatz = game.matchday >= 10 && (kapitaen.appearancesSeason || 0) < game.matchday * 0.4;
        if ((kapitaen.morale || 50) < 35 || ohneEinsatz) {
            const nachfolger = getCouncilMembers().filter(p => p.id !== kapitaen.id).sort((a, b) => getLeadershipScore(b) - getLeadershipScore(a))[0];
            if (nachfolger) {
                return { type: 'kapitaen', captainId: kapitaen.id, successorId: nachfolger.id, title: 'Die Kapitänsfrage',
                    text: ohneEinsatz ? `${kapitaen.name} trägt die Binde, spielt aber kaum (${kapitaen.appearancesSeason || 0} Einsätze). Der Rat schlägt ${nachfolger.name} vor.`
                        : `${kapitaen.name} wirkt als Kapitän ausgebrannt (Moral ${Math.round(kapitaen.morale || 50)}). Der Rat schlägt ${nachfolger.name} vor.` };
            }
        }
    }
    return null;
}

function getCliqueByKey(key) {
    return computeSquadCliques().cliques.find(c => c.key === key) || null;
}

// Kapitän weg (Verkauf, Leihe, Tausch, Vertragsende, Karriereende - 25.22): vorher zeigte
// game.captainId ins Leere, die Elf spielte still ohne Kapitänsbonus und ohne Autorität in der
// Kabine. Der Spieler mit der größten Führungsqualität übernimmt (ohne Moral-Malus, der alte ist weg).
function ensureCaptainPresent() {
    // Verletzt zählt wie weg (25.23): ein Kapitän auf der Tribüne bringt auf dem Platz keinen Bonus.
    if (!squad.length || squad.some(p => p.id === game.captainId && !(p.injured > 0))) return null;
    const neu = [...squad].filter(p => !(p.injured > 0)).sort((a, b) => getLeadershipScore(b) - getLeadershipScore(a))[0] || squad[0];
    game.captainId = neu.id;
    if (typeof electTeamCouncil === 'function') electTeamCouncil(true);
    addInboxMessage('vertrag', `Ⓒ ${neu.name} übernimmt die Binde`, `Der bisherige Kapitän ist nicht mehr im Kader. ${neu.name} hat die größte Führungsqualität und führt die Mannschaft jetzt an - ändern kannst du das im Kader.`, 'screen-squad');
    return neu;
}

// Einziger Weg, die Binde zu wechseln (Auswahlfeld im Kader und Kapitänsfrage des Rats).
function handleCaptainChange(newId, viaRat) {
    const alt = squad.find(p => p.id === game.captainId);
    const neu = squad.find(p => String(p.id) === String(newId));
    if (!neu || (alt && alt.id === neu.id)) return;
    if (alt) adjustMorale([alt], -12);
    adjustMorale([neu], 8);
    const status = getLockerRoomStatus(neu).key;
    game.captainId = neu.id;
    let folge;
    if (viaRat) {
        adjustMorale(squad.filter(p => p !== alt && p !== neu), 2);
        folge = 'Der Rat steht hinter der Entscheidung, die Kabine zieht mit (+2 Moral).';
    } else if (status !== 'rat' && status !== 'etabliert') {
        adjustMorale(getCouncilMembers().filter(p => p !== neu && p !== alt), -4);
        folge = `${neu.name} hat in der Kabine noch wenig Standing - die Führungsspieler sind irritiert (-4 Moral).`;
    } else {
        folge = `${neu.name} ist in der Kabine anerkannt.`;
    }
    if (typeof electTeamCouncil === 'function') electTeamCouncil(true);
    addInboxMessage('vertrag', `Ⓒ Neuer Kapitän: ${neu.name}`, `${alt ? `${alt.name} gibt die Binde ab und ist enttäuscht (-12 Moral). ` : ''}${folge}`, 'screen-squad');
    showToast(`Ⓒ ${neu.name} ist neuer Kapitän. ${folge}`, viaRat || status === 'rat' || status === 'etabliert' ? 'success' : 'error', 5000);
}

// Ein frustrierter Leistungsträger (nicht im Rat) kommt ins Büro (js/office-events.js).
function pickUnhappyVisitor() {
    if (squad.length < 5) return null;
    const median = [...squad].map(p => p.strength).sort((a, b) => a - b)[Math.floor(squad.length / 2)];
    const rat = (game.teamCouncil && game.teamCouncil.memberIds) || [];
    return squad.filter(p => (p.morale || 50) < 35 && p.strength >= median && !(p.injured > 0) && p.id !== game.captainId && !rat.includes(p.id))
        .sort((a, b) => (a.morale || 50) - (b.morale || 50))[0] || null;
}

function renderCliqueBox() {
    const box = document.getElementById('squad-cliques-box');
    if (!box) return;
    const { cliques, largestClique } = computeSquadCliques();
    if (cliques.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine erkennbaren Grüppchen im Kader.</div>'; return; }
    const mod = getCliqueChemistryModifier();
    box.innerHTML = [...cliques].sort((a, b) => b.size - a.size).slice(0, 5).map(c => {
        const dominant = largestClique && c.key === largestClique.key;
        const farbe = c.unruhig ? 'var(--danger)' : (c.mood >= 75 ? 'var(--primary)' : 'var(--text-muted)');
        return `<div class="box" style="font-size:9px; ${c.unruhig ? 'border-left-color:var(--danger);' : (dominant ? 'border-left-color:var(--primary);' : '')}">
            ${dominant ? '👑 ' : ''}<strong>${c.name}</strong> (${c.size}) · <span style="color:${farbe};">Stimmung ${c.mood}${c.unruhig ? ' - rumort!' : ''}</span><br>
            <span style="color:var(--text-muted);">Wortführer: ${c.leader ? c.leader.name : '-'} · ${c.members.map(m => m.name.split(' ').pop()).join(', ')}</span></div>`;
    }).join('') + `<div style="font-size:9px; color:var(--text-muted); margin-top:4px;">Wirkung auf die Teamstärke: ${mod >= 0 ? '+' : ''}${mod.toFixed(1)} · Unter Stimmung ${CLIQUE_UNREST_MOOD} rumort eine Gruppe und zieht jeden Monat den Rest der Kabine runter${captainHasAuthority() ? ' (dein Kapitän hat Autorität und dämpft das)' : ''}.</div>`;
}

function renderLockerHierarchyBox() {
    const box = document.getElementById('locker-hierarchy-box');
    if (!box) return;
    const gruppen = {};
    squad.forEach(p => { const s = getLockerRoomStatus(p); (gruppen[s.key] = gruppen[s.key] || { label: s.label, spieler: [] }).spieler.push(p); });
    const reihenfolge = ['kapitaen', 'rat', 'etabliert', 'mitlaeufer', 'talent'];
    const unzufrieden = squad.filter(p => (p.morale || 50) < 35);
    box.innerHTML = reihenfolge.filter(k => gruppen[k]).map(k => `<div style="font-size:9px; padding:2px 0;"><strong>${gruppen[k].label}</strong> (${gruppen[k].spieler.length}): <span style="color:var(--text-muted);">${gruppen[k].spieler.map(p => p.name.split(' ').pop()).join(', ')}</span></div>`).join('')
        + (unzufrieden.length ? `<div class="box" style="font-size:9px; border-left-color:var(--danger); margin-top:4px;">😠 Unzufrieden: ${unzufrieden.map(p => `${p.name} (${Math.round(p.morale || 50)})`).join(', ')} - unzufriedene Leistungsträger stehen irgendwann im Büro.</div>` : '')
        + `<div style="font-size:9px; color:var(--text-muted); margin-top:4px;">Kapitän wechseln geht im Reiter Aufstellung - der alte Kapitän ist enttäuscht, ohne Standing des Neuen auch der Rat.</div>`;
}

// Jeden Spieltag: wer lange genug gemeinsam im Kader ist, wird gelegentlich "bester Freund"
// eines Mitspielers - verlässt einer den Verein, leidet der andere (checkFriendshipDeparture()).
function tickLockerFriendships() {
    squad.forEach(p => { p.squadTenureMatchdays = (p.squadTenureMatchdays || 0) + 1; });
    const ohneFreund = squad.filter(p => !p.friendPlayerId && (p.squadTenureMatchdays || 0) >= 20);
    if (ohneFreund.length < 2 || Math.random() >= 0.05) return;
    const a = ohneFreund[Math.floor(Math.random() * ohneFreund.length)];
    const andere = ohneFreund.filter(p => p.id !== a.id);
    const b = andere[Math.floor(Math.random() * andere.length)];
    a.friendPlayerId = b.id; b.friendPlayerId = a.id;
    addInboxMessage('vertrag', '🤝 Kabinen-Freundschaft entstanden', `${a.name} und ${b.name} sind in der Kabine beste Freunde geworden.`, 'screen-squad');
}
