/* eslint-disable no-undef */
// Standards im Livespiel: Elfmeter (Schützenwahl mit Trefferchance), Freistoß in Tornähe
// (direkt / Flanke / kurz) und Videobeweis. Ein Standard hält das Spiel an wie die
// Halbzeitansprache (currentMatch.awaitingSetPiece); beim schnellen Durchspielen
// (simulateRestOfMatch) entscheidet resolveSetPiece() automatisch die Standardwahl.
// Gegnerische Elfmeter laufen ohne Entscheidung, der Torwart (Elfmeter-Killer) zählt.
// Im Elfmeterschießen wählt man zusätzlich den Torwart (getShootoutKeeperModifier, europe.js).

const SET_PIECE_PENALTY_BASE = 0.02;   // je Spielzug, skaliert mit der Überlegenheit
const SET_PIECE_FREEKICK_CHANCE = 0.06;
// Ecken als eigene Entscheidung gibt es nur, wenn die Spielphysik das Spiel zeigt (js/spielphysik.js);
// sonst stecken sie wie bisher als kleiner Bonus in den erwarteten Toren.
const SET_PIECE_CORNER_CHANCE = 0.09;
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

function getCornerOptions() {
    const onPitch = setPieceOnPitch();
    const coach = staffMembers.setPieceCoach && staffMembers.setPieceCoach.hired ? 0.02 : 0;
    const flanker = onPitch.find(p => p.id === game.cornerTakerId) || [...onPitch].filter(p => p.pos !== 'TW').sort((a, b) => (b.passing || 0) - (a.passing || 0))[0];
    const kopfball = [...onPitch].filter(p => (p.pos === 'ABW' || p.pos === 'ST') && p !== flanker).sort((a, b) => b.strength - a.strength)[0] || flanker;
    const geuebt = typeof getDrillMastery === 'function' ? getDrillMastery('ecke') : 0;
    return {
        flanke: { label: `🔝 Flanke auf ${kopfball ? kopfball.name : 'den Kopfballspieler'}`, schuetze: kopfball, vorlage: flanker,
            prob: Math.max(0.04, Math.min(0.2, 0.06 + ((kopfball ? kopfball.strength : 50) - 60) * 0.002 + (flanker && flanker.passing >= 75 ? 0.02 : 0) + coach + 0.05 * geuebt)),
            risiko: 0, hinweis: 'Hoch in den Strafraum' },
        kurz: { label: '↪️ Kurz ausführen', schuetze: null, prob: 0.03 + 0.04 * geuebt, risiko: 0, hinweis: 'Sicher, aber selten gefährlich' }
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
    // Auch der Gegner bekommt Freistöße (25.12) - vorher gab es sie nur für uns.
    const freistossUns = SET_PIECE_FREEKICK_CHANCE * (ourDiff > -8 ? 1 : 0.5);
    const freistossGegner = SET_PIECE_FREEKICK_CHANCE * (ourDiff < 8 ? 1 : 0.5);
    const wurf = Math.random();
    const eigen = currentMatch.isHome ? 0 : 1;
    const regie = !!currentMatch.drehbuch;   // das Spiel läuft gerade auf dem Platz (js/spielphysik.js)
    const anzeigen = { aktion: showSetPiecePanel };
    if (wurf < elfmeterUns) {
        const gefoult = onPitch[Math.floor(Math.random() * onPitch.length)];
        const nachVar = Math.random() < 0.25;
        currentMatch.setPiece = { type: 'elfmeter', gefoultId: gefoult.id, minute: currentMatch.minute };
        currentMatch.awaitingSetPiece = true;
        tickerLine(`<div style="color:var(--gold); font-weight:bold;">❗ ${currentMatch.minute}. Min: ${nachVar ? '📺 Nach Videobeweis: ' : ''}ELFMETER für uns! ${gefoult.name} wird im Strafraum gelegt.</div>`,
            Object.assign({ art: 'standard', typ: 'elfmeter', team: eigen, spielerId: gefoult.id }, anzeigen));
    } else if (wurf < elfmeterUns + elfmeterGegner) {
        // Mit Spielphysik und Reaktionsspielen entscheidet man, wohin der eigene Torwart springt
        if (regie && typeof reaktionsspielAn === 'function' && reaktionsspielAn()) {
            const oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
            currentMatch.setPiece = { type: 'elfmeter-gegner', minute: currentMatch.minute };
            currentMatch.awaitingSetPiece = true;
            tickerLine(`<div style="color:var(--danger);">❗ ${currentMatch.minute}. Min: Elfmeter für ${oppName}...</div>`,
                Object.assign({ art: 'standard-gegner-start', team: 1 - eigen }, anzeigen));
            if (typeof noteRefereeControversy === 'function') noteRefereeControversy('elfmeter');
            return true;
        }
        playOpponentPenalty();
        return true;
    } else if (wurf < elfmeterUns + elfmeterGegner + freistossUns) {
        currentMatch.setPiece = { type: 'freistoss', minute: currentMatch.minute };
        currentMatch.awaitingSetPiece = true;
        tickerLine(`<div style="color:var(--gold);">🎯 ${currentMatch.minute}. Min: Freistoß in aussichtsreicher Position, 20 Meter vor dem Tor!</div>`,
            Object.assign({ art: 'standard', typ: 'freistoss', team: eigen }, anzeigen));
    } else if (wurf < elfmeterUns + elfmeterGegner + freistossUns + freistossGegner) {
        playOpponentFreeKick();
        return true;
    } else if (regie && wurf < elfmeterUns + elfmeterGegner + freistossUns + freistossGegner + SET_PIECE_CORNER_CHANCE * (ourDiff > -8 ? 1 : 0.5)) {
        currentMatch.setPiece = { type: 'ecke', minute: currentMatch.minute };
        currentMatch.awaitingSetPiece = true;
        tickerLine(`<div style="color:var(--gold);">🚩 ${currentMatch.minute}. Min: Ecke für uns!</div>`,
            Object.assign({ art: 'standard', typ: 'ecke', team: eigen }, anzeigen));
    } else {
        return false;
    }
    return true;
}

// ereignis: was auf dem Platz passiert (für js/spielphysik.js), siehe liveTicker() in js/match-live.js
function tickerLine(html, ereignis) {
    if (typeof liveTicker === 'function') { liveTicker(html, ereignis); return; }
    const log = document.getElementById('ticker-log');
    if (!log) return;
    log.innerHTML += html;
    log.scrollTop = log.scrollHeight;
}

function refreshLiveScore() {
    if (currentMatch && currentMatch.drehbuch) return;   // mit Spielphysik zeigt die Anzeige erst, was auf dem Platz passiert ist
    const el = document.getElementById('live-score');
    if (el) el.innerText = currentMatch.homeGoals + ' : ' + currentMatch.awayGoals;
}

function ownSetPieceGoal(scorer, assist, text, standard) {
    if (currentMatch.isHome) currentMatch.homeGoals++; else currentMatch.awayGoals++;
    if (typeof recordLiveShot === 'function') recordLiveShot(currentMatch.isHome, true);
    playSound('goal');
    if (scorer) creditOwnGoal(setPieceOnPitch(), scorer, assist || null);
    const ourName = currentMatch.isHome ? currentMatch.homeName : currentMatch.awayName;
    tickerLine(`<div style="color:var(--primary); font-weight:bold;">⚽ ${currentMatch.minute}. Min: TOR! ${text} für ${ourName}!</div>`,
        { art: 'tor', team: currentMatch.isHome ? 0 : 1, spielerId: scorer ? scorer.id : null, standard, standardSchuss: true, stand: [currentMatch.homeGoals, currentMatch.awayGoals] });
}

function getOpponentPenaltyChance() {
    const keeper = setPieceOnPitch().find(p => p.pos === 'TW');
    return 0.76 - (keeper && keeper.trait === 'Elfmeter-Killer' ? 0.12 : 0) - (staffMembers.twTrainer && staffMembers.twTrainer.hired ? getTwTrainerEffekt().elfmeter : 0);
}

// Gegnerischer Elfmeter. zielung (Torwart-Reaktionsspiel): twEcke = wohin unser Torwart springt,
// ecke = wohin der Schütze schießt; richtig geraten hält er viel öfter.
function playOpponentPenalty(zielung, ohneAnkuendigung) {
    const keeper = setPieceOnPitch().find(p => p.pos === 'TW');
    let prob = getOpponentPenaltyChance();
    if (zielung && zielung.twEcke !== undefined && zielung.twEcke !== null) prob = zielung.twEcke === zielung.ecke ? Math.max(0.2, prob - 0.4) : Math.min(0.93, prob + 0.1);
    const oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
    const gegnerTeam = currentMatch.isHome ? 1 : 0;
    if (!ohneAnkuendigung) {
        tickerLine(`<div style="color:var(--danger);">❗ ${currentMatch.minute}. Min: Elfmeter für ${oppName}...</div>`, { art: 'vorab' });
        if (typeof noteRefereeControversy === 'function') noteRefereeControversy('elfmeter');
    }
    const ereignis = { art: 'standard-gegner', standard: 'elfmeter', team: gegnerTeam, standardSchuss: !!ohneAnkuendigung };
    if (Math.random() < prob) {
        if (currentMatch.isHome) currentMatch.awayGoals++; else currentMatch.homeGoals++;
        if (typeof recordLiveShot === 'function') recordLiveShot(!currentMatch.isHome, true);
        playSound('goal');
        tickerLine(`<div style="color:var(--danger);">⚽ ${currentMatch.minute}. Min: Verwandelt. Gegentor vom Punkt.</div>`,
            Object.assign(ereignis, { ergebnis: 'tor', stand: [currentMatch.homeGoals, currentMatch.awayGoals] }));
    } else {
        tickerLine(`<div style="color:var(--blue); font-weight:bold;">🧤 ${currentMatch.minute}. Min: GEHALTEN! ${keeper ? keeper.name : 'Unser Torwart'} pariert den Elfmeter!</div>`,
            Object.assign(ereignis, { ergebnis: 'parade' }));
        if (keeper) keeper.morale = Math.min(100, (keeper.morale || 50) + 5);
    }
    refreshLiveScore();
}

// Gegnerischer Freistoß: läuft ohne Entscheidung, Trefferchance wie ein durchschnittlicher
// eigener Freistoß; ein einstudierter Torwart (Torwarttrainer) hält öfter.
function playOpponentFreeKick() {
    const oppName = currentMatch.isHome ? currentMatch.awayName : currentMatch.homeName;
    const prob = 0.08 - (staffMembers.twTrainer && staffMembers.twTrainer.hired ? 0.02 : 0);
    const ereignis = { art: 'standard-gegner', standard: 'freistoss', team: currentMatch.isHome ? 1 : 0 };
    if (Math.random() < prob) {
        if (currentMatch.isHome) currentMatch.awayGoals++; else currentMatch.homeGoals++;
        if (typeof recordLiveShot === 'function') recordLiveShot(!currentMatch.isHome, true);
        playSound('goal');
        tickerLine(`<div style="color:var(--danger);">⚽ ${currentMatch.minute}. Min: Freistoß für ${oppName} - direkt verwandelt.</div>`,
            Object.assign(ereignis, { ergebnis: 'tor', stand: [currentMatch.homeGoals, currentMatch.awayGoals] }));
    } else {
        tickerLine(`<div style="color:var(--text-muted); font-size:var(--fs-small);">${currentMatch.minute}. Min: Freistoß für ${oppName} - die Mauer steht.</div>`,
            Object.assign(ereignis, { ergebnis: 'mauer' }));
    }
    refreshLiveScore();
}

// Videobeweis vor einem Tor (simulateMatchStep): true = das Tor zählt nicht.
function varOverturnsGoal(ourGoal, minute) {
    if (Math.random() >= VAR_CHECK_CHANCE) return false;
    const zurueck = Math.random() < 0.4;
    const min = minute || currentMatch.minute;
    tickerLine(`<div style="color:var(--text-muted);">📺 ${min}. Min: Der Videoassistent prüft das Tor${ourGoal ? '' : ' des Gegners'}... ${zurueck ? '<strong>Abseits - Tor zurückgenommen!</strong>' : 'Tor zählt!'}</div>`,
        { art: 'var', zurueck, minute: min, team: ourGoal === currentMatch.isHome ? 0 : 1 });
    return zurueck;
}

function showSetPiecePanel() {
    const sp = currentMatch && currentMatch.setPiece;
    const box = document.getElementById('setpiece-options');
    const titel = document.getElementById('setpiece-title');
    if (!sp || !box || !titel) return;
    const knopf = (wahl, inhalt) => `<button onclick="standardWaehlen('${wahl}')" class="btn-secondary" style="text-align:left; margin-bottom:4px;">${inhalt}</button>`;
    const reaktion = typeof reaktionsspielAn === 'function' && reaktionsspielAn();
    if (sp.type === 'elfmeter') {
        titel.innerText = '❗ Elfmeter - wer schießt?';
        box.innerHTML = getPenaltyCandidates(sp.gefoultId).map(c => knopf(c.p.id,
            `<strong>${c.p.name}</strong> · ${Math.round(c.prob * 100)} % <span style="font-size:var(--fs-caption); color:var(--text-muted);">(${c.grund})</span>`)).join('');
    } else if (sp.type === 'elfmeter-gegner') {
        titel.innerText = '🧤 Elfmeter gegen uns';
        box.innerHTML = knopf('torwart', `<strong>🧤 Selbst im Tor stehen</strong><br><span style="font-size:var(--fs-caption); color:var(--text-muted);">Du wählst, wohin der Torwart springt. Richtig geraten hält er viel öfter.</span>`)
            + `<button onclick="standardAusfuehren('torwart', null)" class="btn-secondary" style="text-align:left; margin-bottom:4px;"><strong>Dem Torwart vertrauen</strong> · ${Math.round((1 - getOpponentPenaltyChance()) * 100)} % gehalten</button>`;
    } else {
        const ecke = sp.type === 'ecke';
        titel.innerText = ecke ? '🚩 Ecke - wie ausführen?' : '🎯 Freistoß - wie ausführen?';
        const optionen = ecke ? getCornerOptions() : getFreeKickOptions();
        box.innerHTML = Object.entries(optionen).map(([k, o]) => knopf(k,
            `<strong>${o.label}</strong> · ${Math.round(o.prob * 100)} % Torchance<br><span style="font-size:var(--fs-caption); color:var(--text-muted);">${o.hinweis}${o.risiko ? ` (Konterrisiko ${Math.round(o.risiko * 100)} %)` : ''}</span>`)).join('');
    }
    if (reaktion && sp.type !== 'elfmeter-gegner') box.innerHTML += `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin-top:4px;">🎮 Danach führst du selbst aus: im richtigen Moment tippen (außer bei „Kurz ausführen“).</div>`;
    box.innerHTML += `<button onclick="reaktionsspielUmschalten()" class="btn-secondary" style="width:auto; font-size:var(--fs-caption); margin-top:6px;">${reaktion ? '🎮 Reaktionsspiele aus' : '🎮 Reaktionsspiele an'}</button>`;
    const ov = document.getElementById('setpiece-overlay');
    if (ov) ov.classList.add('show');
}

function defaultSetPieceChoice(sp) {
    if (sp.type === 'elfmeter') return String(getPenaltyCandidates(sp.gefoultId)[0].p.id);
    if (sp.type === 'elfmeter-gegner') return 'torwart';
    if (sp.type === 'ecke') return 'flanke';
    const o = getFreeKickOptions();
    return o.direkt.prob >= o.flanke.prob ? 'direkt' : 'flanke';
}

// Trefferchance nach dem Reaktionsspiel (js/reaktionsspiel.js): q = 0 (daneben) bis 1 (genau in der Mitte).
function reaktionsChance(prob, zielung) {
    if (!zielung || typeof zielung.q !== 'number') return prob;
    let p = prob + (zielung.q - 0.55) * 0.4;
    // Elfmeter: Ahnt der Torwart die Ecke, muss der Schuss sehr genau sein
    if (zielung.twEcke !== undefined && zielung.ecke !== undefined) {
        if (zielung.twEcke === zielung.ecke) p -= zielung.q > 0.85 ? 0.05 : 0.22;
        else p += 0.05;
    }
    return Math.max(prob * 0.4, Math.min(Math.min(0.97, prob + 0.25), p));
}

// Ausführen nach der Wahl im Fenster: erst das Reaktionsspiel, dann die Auswertung.
function standardWaehlen(choice) {
    const sp = currentMatch && currentMatch.setPiece;
    if (!sp) { showToast('Dieser Standard ist schon vorbei.', 'error'); return; }
    if (choice === 'kurz' || typeof reaktionsspielAn !== 'function' || !reaktionsspielAn() || typeof reaktionsspielStarten !== 'function') { standardAusfuehren(choice, null); return; }
    const ov = document.getElementById('setpiece-overlay');
    if (ov) ov.classList.remove('show');
    reaktionsspielStarten(sp, choice, zielung => standardAusfuehren(choice, zielung));
}

// Wertet aus; läuft die Spielphysik, wandert das Ergebnis ins Drehbuch und wird auf dem Platz gespielt.
function standardAusfuehren(choice, zielung) {
    if (!currentMatch || !currentMatch.setPiece) return;
    const regie = typeof spielphysikLaeuft === 'function' && spielphysikLaeuft();
    if (regie) currentMatch.drehbuch = [];
    try {
        resolveSetPiece(choice, false, zielung);
    } finally {
        if (regie && currentMatch) {
            const liste = currentMatch.drehbuch || [];
            currentMatch.drehbuch = null;
            spielphysikStandardDrehbuch(liste, zielung);
        }
    }
}

function resolveSetPiece(choice, silent, zielung) {
    const sp = currentMatch && currentMatch.setPiece;
    if (!sp) return;
    const ov = document.getElementById('setpiece-overlay');
    if (ov) ov.classList.remove('show');
    if (choice === undefined || choice === null) choice = defaultSetPieceChoice(sp);
    const eigen = currentMatch.isHome ? 0 : 1;
    const tore = () => [currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals, currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals];
    const torVorher = tore();
    const daneben = (standard, extra) => Object.assign({ art: 'chance', team: eigen, standard, standardSchuss: true, ergebnis: 'verschossen' }, extra || {});
    if (sp.type === 'elfmeter') {
        const kandidat = getPenaltyCandidates(sp.gefoultId).find(c => String(c.p.id) === String(choice)) || getPenaltyCandidates(sp.gefoultId)[0];
        const p = kandidat.p;
        p.penaltiesTaken = (p.penaltiesTaken || 0) + 1;
        if (Math.random() < reaktionsChance(kandidat.prob, zielung)) {
            p.penaltiesScored = (p.penaltiesScored || 0) + 1;
            if (p.id === sp.gefoultId) p.morale = Math.min(100, (p.morale || 50) + 6);
            ownSetPieceGoal(p, null, `${p.name} verwandelt den Elfmeter`, 'elfmeter');
        } else {
            p.morale = Math.max(10, (p.morale || 50) - 5);
            tickerLine(`<div style="color:var(--danger); font-weight:bold;">❌ ${sp.minute}. Min: ${p.name} vergibt den Elfmeter!</div>`, daneben('elfmeter', { spielerId: p.id }));
        }
    } else if (sp.type === 'elfmeter-gegner') {
        playOpponentPenalty(zielung, true);
    } else {
        const ecke = sp.type === 'ecke';
        const optionen = ecke ? getCornerOptions() : getFreeKickOptions();
        const o = optionen[choice] || optionen[ecke ? 'flanke' : 'direkt'];
        const standard = ecke ? (choice === 'kurz' ? 'kurz' : 'ecke') : (choice === 'direkt' ? 'freistoss' : (choice === 'flanke' ? 'flanke-standard' : 'kurz'));
        if (Math.random() < reaktionsChance(o.prob, zielung)) {
            const text = ecke
                ? (choice === 'kurz' ? 'Ecke kurz ausgeführt, flach ins Tor' : `${o.schuetze.name} köpft die Ecke ein`)
                : (choice === 'direkt' ? `${o.schuetze.name} zirkelt den Freistoß direkt ins Tor` : (choice === 'flanke' ? `${o.schuetze.name} köpft die Freistoßflanke ein` : 'Kurz ausgeführt, abgefälscht'));
            ownSetPieceGoal(o.schuetze, o.vorlage, text, standard);
        } else if (o.risiko && Math.random() < 0.15 * (o.risiko / 0.04)) { // geklärte Flanke: Konter, ~4 % Gegentor (einstudiert weniger)
            tickerLine(`<div style="color:var(--danger);">⚡ ${sp.minute}. Min: Flanke geklärt - Konter!</div>`, daneben(standard, { ergebnis: 'geklaert' }));
            if (Math.random() < 0.27) {
                if (currentMatch.isHome) currentMatch.awayGoals++; else currentMatch.homeGoals++;
                playSound('goal');
                tickerLine(`<div style="color:var(--danger);">⚽ ${sp.minute}. Min: Gegentor nach dem Konter.</div>`,
                    { art: 'tor', team: 1 - eigen, stil: 'nach einem blitzschnellen Konter', stand: [currentMatch.homeGoals, currentMatch.awayGoals], sofort: true });
            }
        } else {
            tickerLine(`<div style="color:var(--text-muted); font-size:var(--fs-small);">${sp.minute}. Min: ${ecke ? 'Die Ecke bringt nichts ein.' : 'Der Freistoß bringt nichts ein.'}</div>`, daneben(standard, o.schuetze ? { spielerId: o.schuetze.id } : null));
        }
    }
    // Bilanz der Reaktionsspiele: Treffer bzw. gehaltener Elfmeter
    if (zielung && typeof reaktionsBilanzBuchen === 'function') reaktionsBilanzBuchen(zielung, sp.type === 'elfmeter-gegner' ? tore()[1] === torVorher[1] : tore()[0] > torVorher[0]);
    currentMatch.setPiece = null;
    currentMatch.awaitingSetPiece = false;
    refreshLiveScore();
    if (!silent && !currentMatch.drehbuch && typeof renderLiveMatchStats === 'function') renderLiveMatchStats();
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
        return `<button onclick="chooseShootoutKeeper('${k.id}')" class="${aktuell && aktuell.id === k.id ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:var(--fs-caption); margin:0 4px 4px 0;">🧤 ${k.name} (${k.strength}${k.trait === 'Elfmeter-Killer' ? ', Elfmeter-Killer' : ''})${imSpiel ? '' : ' · Einwechslung'}</button>`;
    }).join('');
}
