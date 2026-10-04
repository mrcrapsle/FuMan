/* eslint-disable no-undef */
// Standards im Livespiel: Elfmeter (Schützenwahl mit Trefferchance), Freistoß in Tornähe
// (direkt / Flanke / kurz) und Videobeweis. Ein Standard hält das Spiel an wie die
// Halbzeitansprache (currentMatch.awaitingSetPiece); beim schnellen Durchspielen
// (simulateRestOfMatch) entscheidet resolveSetPiece() automatisch die Standardwahl.
// Gegnerische Elfmeter laufen ohne Entscheidung, der Torwart (Elfmeter-Killer) zählt.
// Im Elfmeterschießen wählt man zusätzlich den Torwart (getShootoutKeeperModifier, europe.js).

const SET_PIECE_PENALTY_BASE = 0.02;   // je Spielzug, skaliert mit der Überlegenheit
const SET_PIECE_FREEKICK_CHANCE = 0.06;
const VAR_CHECK_CHANCE = 0.07;          // je Tor, davon wird gut ein Drittel zurückgenommen

function setPieceOnPitch() {
    return squad.filter(p => lineup.includes(p.id) && !currentMatch.sentOff.includes(p.id));
}

function getLivePenaltyChance(p, gefoult) {
    let prob = 0.62 + ((p.shooting || 50) - 60) * 0.004 + (p.penaltyTrainingBonus || 0);
    if (p.id === game.penaltyTakerId) prob += 0.05;                  // Routine des festen Schützen
    if (p.trait === 'Elfmeter-Killer') prob += 0.06;
    if (staffMembers.setPieceCoach && staffMembers.setPieceCoach.hired) prob += 0.02;
    if ((p.fitness || 100) < 60) prob -= 0.05;
    const knapp = Math.abs(currentMatch.homeGoals - currentMatch.awayGoals) <= 1 && currentMatch.minute >= 75;
    if (knapp && p.character !== 'Selbstbewusst') prob -= 0.04;      // Nerven in der Schlussphase
    if (gefoult) prob -= 0.03;                                        // der Gefoulte ist oft noch angeschlagen
    if (typeof getDrillMastery === 'function') prob += 0.06 * getDrillMastery('elfmeter'); // einstudiert (set-piece-drills.js)
    return Math.max(0.45, Math.min(0.93, prob));
}

function getFreeKickOptions() {
    const onPitch = setPieceOnPitch();
    const coach = staffMembers.setPieceCoach && staffMembers.setPieceCoach.hired ? 0.02 : 0;
    const schuetze = onPitch.find(p => p.id === game.freeKickTakerId) || [...onPitch].sort((a, b) => (b.shooting || 0) - (a.shooting || 0))[0];
    const kopfball = [...onPitch].filter(p => p.pos === 'ABW' || p.pos === 'ST').sort((a, b) => b.strength - a.strength)[0] || schuetze;
    const flanker = onPitch.find(p => p.id === game.cornerTakerId) || schuetze;
    // Einstudierte Varianten (js/set-piece-drills.js)
    const geuebt = k => (typeof getDrillMastery === 'function' ? getDrillMastery(k) : 0);
    const tag = k => (typeof drillTag === 'function' ? drillTag(k) : '');
    return {
        direkt: { label: `🎯 Direkt schießen (${schuetze ? schuetze.name : '-'})`, schuetze,
            prob: Math.max(0.03, Math.min(0.36, 0.05 + ((schuetze ? schuetze.shooting : 50) - 60) * 0.003 + (schuetze && schuetze.trait === 'Freistoß-Gott' ? 0.15 : 0) + coach + 0.06 * geuebt('direkt'))),
            risiko: 0, hinweis: 'Hängt ganz vom Schützen ab' + tag('direkt') },
        flanke: { label: `🔝 Flanke auf ${kopfball ? kopfball.name : 'den Kopfballspieler'}`, schuetze: kopfball, vorlage: flanker,
            prob: Math.max(0.05, Math.min(0.25, 0.09 + ((kopfball ? kopfball.strength : 50) - 60) * 0.002 + (flanker && flanker.passing >= 75 ? 0.02 : 0) + coach + 0.05 * geuebt('flanke'))),
            risiko: Math.round(0.04 * (1 - 0.5 * geuebt('flanke')) * 1000) / 1000, hinweis: 'Geklärt? Dann droht ein Konter' + tag('flanke') },
        kurz: { label: '↪️ Kurz ausführen', schuetze: null, prob: 0.04 + 0.06 * geuebt('kurz'), risiko: 0, hinweis: 'Sicher, aber selten gefährlich' + tag('kurz') }
    };
}

function getPenaltyCandidates(gefoultId) {
    const onPitch = setPieceOnPitch().filter(p => p.pos !== 'TW');
    const liste = [];
    const fest = onPitch.find(p => p.id === game.penaltyTakerId);
    if (fest) liste.push({ p: fest, grund: 'fester Schütze' });
    const gefoult = onPitch.find(p => p.id === gefoultId);
    if (gefoult && !liste.some(x => x.p === gefoult)) liste.push({ p: gefoult, grund: 'der Gefoulte will selbst' });
    [...onPitch].sort((a, b) => (b.shooting || 0) - (a.shooting || 0)).forEach(p => {
        if (liste.length < 4 && !liste.some(x => x.p === p)) liste.push({ p, grund: `Schuss ${p.shooting}` });
    });
    return liste.map(x => ({ ...x, prob: getLivePenaltyChance(x.p, x.p.id === gefoultId) }));
}

// Aus simulateMatchStep(): startet ggf. einen Standard. true = dieser Spielzug ist damit vorbei.
function rollLiveSetPiece(ourDiff) {
    if (!currentMatch || currentMatch.awaitingSetPiece) return false;
    const onPitch = setPieceOnPitch().filter(p => p.pos !== 'TW');
    if (!onPitch.length) return false;
    const elfmeterUns = Math.max(0.008, Math.min(0.04, SET_PIECE_PENALTY_BASE * (1 + ourDiff * 0.03)));
    const elfmeterGegner = Math.max(0.008, Math.min(0.04, SET_PIECE_PENALTY_BASE * (1 - ourDiff * 0.03)));
    const wurf = Math.random();
    if (wurf < elfmeterUns) {
        const gefoult = onPitch[Math.floor(Math.random() * onPitch.length)];
        const nachVar = Math.random() < 0.25;
        currentMatch.setPiece = { type: 'elfmeter', gefoultId: gefoult.id, minute: currentMatch.minute };
        tickerLine(`<div style="color:var(--gold); font-weight:bold;">❗ ${currentMatch.minute}. Min: ${nachVar ? '📺 Nach Videobeweis: ' : ''}ELFMETER für uns! ${gefoult.name} wird im Strafraum gelegt.</div>`);
    } else if (wurf < elfmeterUns + elfmeterGegner) {
        playOpponentPenalty();
        return true;
    } else if (wurf < elfmeterUns + elfmeterGegner + SET_PIECE_FREEKICK_CHANCE * (ourDiff > -8 ? 1 : 0.5)) {
        currentMatch.setPiece = { type: 'freistoss', minute: currentMatch.minute };
        tickerLine(`<div style="color:var(--gold);">🎯 ${currentMatch.minute}. Min: Freistoß in aussichtsreicher Position, 20 Meter vor dem Tor!</div>`);
    } else {
        return false;
    }
    currentMatch.awaitingSetPiece = true;
    showSetPiecePanel();
    return true;
}

function tickerLine(html) {
    const log = document.getElementById('ticker-log');
    if (!log) return;
    log.innerHTML += html;
    log.scrollTop = log.scrollHeight;
}

function refreshLiveScore() {
    const el = document.getElementById('live-score');
    if (el) el.innerText = currentMatch.homeGoals + ' : ' + currentMatch.awayGoals;
}

function ownSetPieceGoal(scorer, assist, text) {
    if (currentMatch.isHome) currentMatch.homeGoals++; else currentMatch.awayGoals++;
    if (typeof recordLiveShot === 'function') recordLiveShot(currentMatch.isHome, true);
    playSound('goal');
    if (scorer) creditOwnGoal(setPieceOnPitch(), scorer, assist || null);
    const ourName = currentMatch.isHome ? currentMatch.homeName : currentMatch.awayName;
    tickerLine(`<div style="color:var(--primary); font-weight:bold;">⚽ ${currentMatch.minute}. Min: TOR! ${text} für ${ourName}!</div>`);
}

function playOpponentPenalty() {
    const keeper = setPieceOnPitch().find(p => p.pos === 'TW');
    let prob = 0.76 - (keeper && keeper.trait === 'Elfmeter-Killer' ? 0.12 : 0) - (staffMembers.twTrainer && staffMembers.twTrainer.hired ? 0.04 : 0);
    const oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
    tickerLine(`<div style="color:var(--danger);">❗ ${currentMatch.minute}. Min: Elfmeter für ${oppName}...</div>`);
    if (Math.random() < prob) {
        if (currentMatch.isHome) currentMatch.awayGoals++; else currentMatch.homeGoals++;
        if (typeof recordLiveShot === 'function') recordLiveShot(!currentMatch.isHome, true);
        playSound('goal');
        tickerLine(`<div style="color:var(--danger);">⚽ ${currentMatch.minute}. Min: Verwandelt. Gegentor vom Punkt.</div>`);
    } else {
        tickerLine(`<div style="color:var(--blue); font-weight:bold;">🧤 ${currentMatch.minute}. Min: GEHALTEN! ${keeper ? keeper.name : 'Unser Torwart'} pariert den Elfmeter!</div>`);
        if (keeper) keeper.morale = Math.min(100, (keeper.morale || 50) + 5);
    }
    refreshLiveScore();
}

// Videobeweis vor einem Tor (simulateMatchStep): true = das Tor zählt nicht.
function varOverturnsGoal(ourGoal) {
    if (Math.random() >= VAR_CHECK_CHANCE) return false;
    const zurueck = Math.random() < 0.4;
    tickerLine(`<div style="color:#94a3b8;">📺 ${currentMatch.minute}. Min: Der Videoassistent prüft das Tor${ourGoal ? '' : ' des Gegners'}... ${zurueck ? '<strong>Abseits - Tor zurückgenommen!</strong>' : 'Tor zählt!'}</div>`);
    return zurueck;
}

function showSetPiecePanel() {
    const sp = currentMatch && currentMatch.setPiece;
    const box = document.getElementById('setpiece-options');
    const titel = document.getElementById('setpiece-title');
    if (!sp || !box || !titel) return;
    if (sp.type === 'elfmeter') {
        titel.innerText = '❗ Elfmeter - wer schießt?';
        box.innerHTML = getPenaltyCandidates(sp.gefoultId).map(c => `<button onclick="resolveSetPiece('${c.p.id}')" class="btn-secondary" style="text-align:left; margin-bottom:4px;">
            <strong>${c.p.name}</strong> · ${Math.round(c.prob * 100)} % <span style="font-size:9px; color:var(--text-muted);">(${c.grund})</span></button>`).join('');
    } else {
        titel.innerText = '🎯 Freistoß - wie ausführen?';
        box.innerHTML = Object.entries(getFreeKickOptions()).map(([k, o]) => `<button onclick="resolveSetPiece('${k}')" class="btn-secondary" style="text-align:left; margin-bottom:4px;">
            <strong>${o.label}</strong> · ${Math.round(o.prob * 100)} % Torchance<br><span style="font-size:9px; color:var(--text-muted);">${o.hinweis}${o.risiko ? ` (Konterrisiko ${Math.round(o.risiko * 100)} %)` : ''}</span></button>`).join('');
    }
    const ov = document.getElementById('setpiece-overlay');
    if (ov) ov.classList.add('show');
}

function defaultSetPieceChoice(sp) {
    if (sp.type === 'elfmeter') return String(getPenaltyCandidates(sp.gefoultId)[0].p.id);
    const o = getFreeKickOptions();
    return o.direkt.prob >= o.flanke.prob ? 'direkt' : 'flanke';
}

function resolveSetPiece(choice, silent) {
    const sp = currentMatch && currentMatch.setPiece;
    if (!sp) return;
    const ov = document.getElementById('setpiece-overlay');
    if (ov) ov.classList.remove('show');
    if (choice === undefined || choice === null) choice = defaultSetPieceChoice(sp);
    if (sp.type === 'elfmeter') {
        const kandidat = getPenaltyCandidates(sp.gefoultId).find(c => String(c.p.id) === String(choice)) || getPenaltyCandidates(sp.gefoultId)[0];
        const p = kandidat.p;
        p.penaltiesTaken = (p.penaltiesTaken || 0) + 1;
        if (Math.random() < kandidat.prob) {
            p.penaltiesScored = (p.penaltiesScored || 0) + 1;
            if (p.id === sp.gefoultId) p.morale = Math.min(100, (p.morale || 50) + 6);
            ownSetPieceGoal(p, null, `${p.name} verwandelt den Elfmeter`);
        } else {
            p.morale = Math.max(10, (p.morale || 50) - 5);
            tickerLine(`<div style="color:var(--danger); font-weight:bold;">❌ ${sp.minute}. Min: ${p.name} vergibt den Elfmeter!</div>`);
        }
    } else {
        const o = getFreeKickOptions()[choice] || getFreeKickOptions().direkt;
        if (Math.random() < o.prob) {
            ownSetPieceGoal(o.schuetze, o.vorlage, choice === 'direkt' ? `${o.schuetze.name} zirkelt den Freistoß direkt ins Tor` : (choice === 'flanke' ? `${o.schuetze.name} köpft die Freistoßflanke ein` : 'Kurz ausgeführt, abgefälscht'));
        } else if (o.risiko && Math.random() < 0.15 * (o.risiko / 0.04)) { // geklärte Flanke: Konter, ~4 % Gegentor (einstudiert weniger)
            tickerLine(`<div style="color:var(--danger);">⚡ ${sp.minute}. Min: Flanke geklärt - Konter!</div>`);
            if (Math.random() < 0.27) {
                if (currentMatch.isHome) currentMatch.awayGoals++; else currentMatch.homeGoals++;
                playSound('goal');
                tickerLine(`<div style="color:var(--danger);">⚽ ${sp.minute}. Min: Gegentor nach dem Konter.</div>`);
            }
        } else {
            tickerLine(`<div style="color:#64748b; font-size:10px;">${sp.minute}. Min: Der Freistoß bringt nichts ein.</div>`);
        }
    }
    currentMatch.setPiece = null;
    currentMatch.awaitingSetPiece = false;
    refreshLiveScore();
    if (!silent && typeof renderLiveMatchStats === 'function') renderLiveMatchStats();
}

// Elfmeterschießen: Wirkung unseres Torwarts auf die gegnerische Trefferquote.
let shootoutKeeperId = null;
function getShootoutKeeper() {
    const wahl = shootoutKeeperId && squad.find(p => p.id === shootoutKeeperId);
    return wahl || squad.find(p => lineup.includes(p.id) && p.pos === 'TW') || null;
}
function getShootoutKeeperModifier() {
    const k = getShootoutKeeper();
    if (!k) return 0;
    return -((k.trait === 'Elfmeter-Killer' ? 0.08 : 0) + Math.max(-0.03, Math.min(0.04, (k.strength - 60) * 0.0015)));
}
function chooseShootoutKeeper(id) {
    const k = squad.find(p => String(p.id) === String(id));
    if (!k) return;
    const imSpiel = lineup.includes(k.id);
    if (!imSpiel && typeof substitutionsLeft !== 'undefined' && substitutionsLeft <= 0) { showToast('Kein Wechsel mehr frei - der Torwart vom Platz muss ran.', 'error'); return; }
    shootoutKeeperId = k.id;
    if (typeof renderShooterSelectionModal === 'function') renderShooterSelectionModal();
}
function renderShootoutKeeperChoice() {
    const torhueter = squad.filter(p => p.pos === 'TW' && !(p.injured > 0) && !(p.suspended > 0));
    const aktuell = getShootoutKeeper();
    return torhueter.map(k => {
        const imSpiel = lineup.includes(k.id);
        return `<button onclick="chooseShootoutKeeper('${k.id}')" class="${aktuell && aktuell.id === k.id ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:9px; margin:0 4px 4px 0;">🧤 ${k.name} (${k.strength}${k.trait === 'Elfmeter-Killer' ? ', Elfmeter-Killer' : ''})${imSpiel ? '' : ' · Einwechslung'}</button>`;
    }).join('');
}
