// Mitgliederversammlung: nach jedem Saisonabschluss legt der Verein vor seinen Mitgliedern
// Rechenschaft ab. Grundlage sind echte Zahlen (Endplatz gegen die Erwartung zu Saisonbeginn,
// Auf-/Abstieg, Finanzergebnis, Fanstimmung). Du wählst Rede und Beitragsantrag, dann wird
// über die Entlastung abgestimmt - mit Folgen für Vorstand, Fans und Kasse.

const ASSEMBLY_AUTO_AFTER = 6;   // Spieltage, bis die Versammlung ohne dich stattfindet
const ASSEMBLY_SHOW_RESULT_FOR = 4;  // Spieltage, die das Ergebnis im Dashboard stehen bleibt
const ASSEMBLY_LEAGUE_FACTOR = [1.0, 0.7, 0.45, 0.3, 0.2, 0.12];

const ASSEMBLY_SPEECHES = {
    selbstkritisch: { label: 'Selbstkritisch', desc: 'Fehler eingestehen, Besserung versprechen' },
    visionaer: { label: 'Visionär', desc: 'Große Ziele für die Zukunft ausrufen' },
    zahlen: { label: 'Zahlen sprechen lassen', desc: 'Nüchtern mit Tabelle und Bilanz argumentieren' }
};
const ASSEMBLY_FEES = {
    senken: { label: 'Beitrag senken', fans: 3, approval: 4, money: -60000 },
    halten: { label: 'Beitrag halten', fans: 0, approval: 0, money: 0 },
    erhoehen: { label: 'Beitrag erhöhen', fans: -4, approval: -6, money: 120000 }
};

function assemblyLeagueFactor(level) {
    return ASSEMBLY_LEAGUE_FACTOR[level] ?? ASSEMBLY_LEAGUE_FACTOR[ASSEMBLY_LEAGUE_FACTOR.length - 1];
}

// Erwarteter Platz = Rang der eigenen Kaderstärke in der (neuen) Liga zu Saisonbeginn.
function recordSeasonExpectationRank() {
    const teams = leaguesData[game.leagueLevel] || [];
    // Schnitt der besten Elf: gleiche Skala wie die Gegnerstärken, ohne Taktik-/Heimboni.
    const top11 = squad.map(p => p.strength).sort((x, y) => y - x).slice(0, 11);
    const own = top11.length ? top11.reduce((x, y) => x + y, 0) / top11.length : 0;
    const exp = game.seasonExpectation && game.seasonExpectation.season === game.season
        ? game.seasonExpectation : (game.seasonExpectation = { season: game.season, startMoney: Math.round(game.money) });
    exp.leagueLevel = game.leagueLevel;
    exp.teams = teams.length;
    exp.expectedRank = 1 + teams.filter(t => t.name !== game.clubName && t.strength > own).length;
}

function recordSeasonExpectation() {
    game.seasonExpectation = { season: game.season, startMoney: Math.round(game.money) };
    recordSeasonExpectationRank();
}

function getSeasonExpectation() {
    if (!game.seasonExpectation || game.seasonExpectation.season !== game.season) recordSeasonExpectation();
    return game.seasonExpectation;
}

// Im Saisonabschluss, VOR dem Ligawechsel: Bilanz der abgelaufenen Saison festhalten.
function prepareMemberAssembly(finalRank) {
    const exp = getSeasonExpectation();
    game.pendingAssemblyReport = {
        season: game.season,
        finalRank,
        expectedRank: exp.expectedRank,
        teams: exp.teams,
        leagueLevel: game.leagueLevel,
        startMoney: exp.startMoney,
        fans: Math.round(game.fans)
    };
}

// Nach game.season++ (inkl. Saisonend-Prämien, vor den Dauerkarten der neuen Saison):
// Finanzergebnis abschließen, Versammlung einberufen. Die Platzerwartung der neuen Saison
// folgt nach advanceLeaguesToNewSeason() über recordSeasonExpectationRank().
function openMemberAssembly() {
    const r = game.pendingAssemblyReport;
    game.pendingAssemblyReport = null;
    game.seasonExpectation = { season: game.season, startMoney: Math.round(game.money) };
    if (!r) return;
    r.financeResult = Math.round(game.money - r.startMoney);
    r.promoted = game.leagueLevel < r.leagueLevel;
    r.relegated = game.leagueLevel > r.leagueLevel;
    // Eröffnet zwischen den Saisons: game.matchday steht hier noch auf 35 und wird erst danach
    // auf 1 gesetzt - mit 35 fand die Versammlung nie automatisch statt.
    game.memberAssembly = { report: r, status: 'offen', openedMatchday: 1, season: game.season, speech: 'zahlen', fee: 'halten' };
    addInboxMessage('vertrag', '🗳️ Mitgliederversammlung einberufen',
        `Die Mitglieder erwarten deinen Bericht zur Saison ${r.season} (Platz ${r.finalRank}, erwartet Platz ${r.expectedRank}). Bereite im Dashboard Rede und Beitragsantrag vor.`, 'screen-dashboard');
}

// Stimmung der Mitglieder vor der Rede, aus der tatsächlichen Saison.
function assemblyBaseApproval(r) {
    let a = 55;
    a += Math.max(-25, Math.min(25, (r.expectedRank - r.finalRank) * 4));
    if (r.promoted) a += 15;
    if (r.relegated) a -= 20;
    a += r.financeResult >= 0 ? 5 : -8;
    a += (r.fans - 60) / 4;
    return a;
}

function speechEffect(speech, r) {
    const gut = r.finalRank <= r.expectedRank || r.promoted;
    if (speech === 'selbstkritisch') return gut ? -3 : 6;
    if (speech === 'visionaer') return gut ? 7 : -6;
    return r.financeResult >= 0 ? 3 : -2; // zahlen
}

function setAssemblyChoice(field, value) {
    const a = game.memberAssembly;
    if (!a || a.status !== 'offen') return;
    if (field === 'speech' && ASSEMBLY_SPEECHES[value]) a.speech = value;
    if (field === 'fee' && ASSEMBLY_FEES[value]) a.fee = value;
    renderMemberAssemblyPanel();
}

function holdMemberAssembly(automatisch) {
    const a = game.memberAssembly;
    if (!a || a.status !== 'offen') return;
    const r = a.report;
    const fee = ASSEMBLY_FEES[a.fee];
    const money = Math.round(fee.money * assemblyLeagueFactor(game.leagueLevel) / 1000) * 1000;
    if (money < 0 && game.money < -money) { showToast(`Nicht genug Geld für die Beitragssenkung (${formatVal(-money)}).`, 'error'); return; }

    const zustimmung = Math.round(Math.max(5, Math.min(95, assemblyBaseApproval(r) + speechEffect(a.speech, r) + fee.approval
        + (automatisch ? -5 : 0))));
    const entlastet = zustimmung >= 50;
    // Nicht entlastet kostet einheitlich -10 (früher -20 unter 30 % Zustimmung: zusammen mit dem
    // verfehlten Saisonziel kippte das im Langzeittest fast jede Karriere in die Entlassung).
    const boardDelta = zustimmung >= 70 ? 10 : entlastet ? 5 : -10;

    game.boardSat = Math.max(10, Math.min(100, game.boardSat + boardDelta));
    game.fans = Math.max(game.fanBaseFloor || 0, Math.min(100, game.fans + fee.fans));
    if (money !== 0) {
        setzeBuchungskontext('🗳️ Mitgliedsbeiträge');
        game.money += money;
        loescheBuchungskontext();
    }
    Object.assign(a, { status: 'abgehalten', heldMatchday: game.matchday, zustimmung, entlastet, boardDelta, money, automatisch: !!automatisch });
    const titel = entlastet ? `✅ Entlastet mit ${zustimmung}% Zustimmung` : `❌ Nicht entlastet (${zustimmung}% Zustimmung)`;
    addInboxMessage('vertrag', `🗳️ Mitgliederversammlung: ${titel}`,
        `${automatisch ? 'Die Versammlung fand ohne deine Vorbereitung statt. ' : ''}Vorstandszufriedenheit ${boardDelta > 0 ? '+' : ''}${boardDelta}. ${fee.label}${money ? ` (${money > 0 ? '+' : ''}${formatVal(money)})` : ''}.`, 'screen-dashboard');
    if (!automatisch) showToast(`🗳️ ${titel}`, entlastet ? 'success' : 'error');
    updateUI();
}

// Monatlich: nicht vorbereitete Versammlung findet irgendwann ohne dich statt.
function tickMemberAssembly() {
    if (!game.seasonExpectation || game.seasonExpectation.season !== game.season) recordSeasonExpectation();
    const a = game.memberAssembly;
    if (a && a.openedMatchday > game.matchday) a.openedMatchday = 1; // Spielstände mit dem alten Wert 35
    if (a && a.status === 'offen' && game.matchday - a.openedMatchday >= ASSEMBLY_AUTO_AFTER) holdMemberAssembly(true);
}

function renderMemberAssemblyPanel() {
    const box = document.getElementById('member-assembly-box');
    if (!box) return;
    const a = game.memberAssembly;
    const sichtbar = a && a.season === game.season && (a.status === 'offen' || game.matchday <= (a.heldMatchday || 0) + ASSEMBLY_SHOW_RESULT_FOR);
    if (!sichtbar) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    const r = a.report;
    const verlauf = r.promoted ? '⬆️ Aufstieg' : r.relegated ? '⬇️ Abstieg' : 'Klassenerhalt';
    let html = `<div class="panel-header" style="color:var(--gold);">🗳️ MITGLIEDERVERSAMMLUNG (SAISON ${r.season})</div>
        <div style="font-size:9px; display:grid; grid-template-columns:1fr 1fr; gap:3px; margin-bottom:6px;">
            <div>Endplatz: <strong>${r.finalRank}.</strong> (erwartet: ${r.expectedRank}.)</div>
            <div>${verlauf}</div>
            <div>Finanzergebnis: <strong style="color:${r.financeResult >= 0 ? 'var(--primary)' : 'var(--danger)'};">${r.financeResult >= 0 ? '+' : ''}${formatVal(r.financeResult)}</strong></div>
            <div>Fan-Stimmung: ${r.fans}%</div>
        </div>`;
    if (a.status === 'offen') {
        const rest = ASSEMBLY_AUTO_AFTER - (game.matchday - Math.min(a.openedMatchday, game.matchday));
        html += '<div style="font-size:9px; font-weight:bold;">Deine Rede</div>';
        html += Object.entries(ASSEMBLY_SPEECHES).map(([k, s]) => `<button onclick="setAssemblyChoice('speech','${k}')" class="${a.speech === k ? 'btn-action' : 'btn-secondary'}" style="font-size:8px; padding:3px 6px; margin:2px 3px 2px 0;" title="${s.desc}">${s.label}</button>`).join('');
        html += '<div style="font-size:9px; font-weight:bold; margin-top:4px;">Antrag zum Mitgliedsbeitrag</div>';
        html += Object.entries(ASSEMBLY_FEES).map(([k, f]) => {
            const m = Math.round(f.money * assemblyLeagueFactor(game.leagueLevel) / 1000) * 1000;
            return `<button onclick="setAssemblyChoice('fee','${k}')" class="${a.fee === k ? 'btn-action' : 'btn-secondary'}" style="font-size:8px; padding:3px 6px; margin:2px 3px 2px 0;">${f.label}${m ? ` (${m > 0 ? '+' : ''}${formatVal(m)})` : ''}</button>`;
        }).join('');
        html += `<button onclick="holdMemberAssembly()" class="btn-gold" style="width:100%; font-size:10px; padding:6px; margin-top:6px;">🗳️ Versammlung durchführen</button>
            <div style="font-size:8px; color:var(--text-muted); margin-top:3px;">Ohne dich findet sie in ${Math.max(0, rest)} Spieltag(en) statt - unvorbereitet kostet das Zustimmung.</div>`;
    } else {
        html += `<div style="font-size:10px; font-weight:bold; color:${a.entlastet ? 'var(--primary)' : 'var(--danger)'};">${a.entlastet ? '✅ Entlastet' : '❌ Nicht entlastet'} - ${a.zustimmung}% Zustimmung</div>
            <div style="font-size:9px; color:var(--text-muted);">Vorstandszufriedenheit ${a.boardDelta > 0 ? '+' : ''}${a.boardDelta}${a.money ? ` · Beiträge ${a.money > 0 ? '+' : ''}${formatVal(a.money)}` : ''}${a.automatisch ? ' · ohne Vorbereitung abgehalten' : ''}</div>`;
    }
    box.innerHTML = html;
}
