/* eslint-disable no-undef */
// Schiedsrichter-Kritik nach dem Spiel (Phase 22.4): das Livespiel merkt sich strittige
// Szenen (currentMatch.controversies: eigener Platzverweis, Elfmeter gegen uns, vom VAR
// aberkanntes eigenes Tor). Endet so ein Spiel ohne Sieg, bietet #ref-critique-box nach dem
// Abpfiff drei Wege - jeder mit echter Wirkung:
//   öffentlich kritisieren: Fans +3, Medienimage -2, Geldstrafe nach Liga (jede weitere Kritik
//                           in der Saison verdoppelt sie), der Schiedsrichter pfeift unsere
//                           nächsten 2 Spiele unter ihm strenger (Kartenschwelle x1,2)
//   schriftliche Beschwerde: Gebühr; 35 % Chance, dass der Verband einen Platzverweis
//                           zurücknimmt (Sperre weg) - ohne Rot nur Vorstand +1
//   schweigen:              Vorstand +2, Fans -1
// Der Groll des Schiedsrichters (game.refereeGrudges[refId]) wirkt in setupMatch() über
// applyRefereeGrudge().

const REF_CRITIQUE_FINES = [50000, 25000, 10000, 5000, 2500, 1500];
const REF_COMPLAINT_FEE = [5000, 3000, 1500, 800, 400, 250];
const REF_COMPLAINT_SUCCESS = 0.35;
const REF_GRUDGE_MATCHES = 2;
const REF_GRUDGE_CARD_MULT = 1.2;

function noteRefereeControversy(type, data) {
    if (!currentMatch) return;
    if (!currentMatch.controversies) currentMatch.controversies = [];
    currentMatch.controversies.push(Object.assign({ type, minute: currentMatch.minute }, data || {}));
}

function describeControversy(c) {
    if (c.type === 'rot') return `${c.minute}. Min: Platzverweis gegen ${c.name}`;
    if (c.type === 'elfmeter') return `${c.minute}. Min: Elfmeter gegen uns`;
    if (c.type === 'var') return `${c.minute}. Min: unser Tor vom VAR aberkannt`;
    return `${c.minute}. Min: strittige Szene`;
}

function getRefCritiqueFine() {
    const basis = REF_CRITIQUE_FINES[game.leagueLevel] ?? 1500;
    const r = game.refCritiques && game.refCritiques.season === game.season ? game.refCritiques.count : 0;
    return basis * Math.pow(2, r);
}

// Nach dem Abpfiff (endMatchSimulation): nur bei strittigen Szenen und ohne Sieg.
function offerRefereeCritique() {
    const box = document.getElementById('ref-critique-box');
    if (!box || !currentMatch) return;
    const wir = currentMatch.isHome ? currentMatch.homeGoals : currentMatch.awayGoals;
    const die = currentMatch.isHome ? currentMatch.awayGoals : currentMatch.homeGoals;
    const strittig = currentMatch.controversies || [];
    if (!strittig.length || wir > die || !currentMatch.referee) { box.innerHTML = ''; return; }
    currentMatch.critiquePending = true;
    currentMatch.critiqueWhen = { season: game.season, matchday: game.matchday };
    renderRefereeCritiqueBox();
}

function renderRefereeCritiqueBox() {
    const box = document.getElementById('ref-critique-box');
    if (!box) return;
    if (!currentMatch || !currentMatch.critiquePending) { box.innerHTML = ''; return; }
    const ref = currentMatch.referee;
    const rot = (currentMatch.controversies || []).some(c => c.type === 'rot');
    const gebuehr = REF_COMPLAINT_FEE[game.leagueLevel] ?? 250;
    box.innerHTML = `<div class="box" style="font-size:10px; border-left-color:var(--danger);">🧑‍⚖️ <strong>Strittige Szenen mit ${ref.name}:</strong>
        <div style="color:var(--text-muted);">${currentMatch.controversies.map(describeControversy).join(' · ')}</div>
        <div style="margin-top:4px;">Die Reporter warten - was sagst du zum Schiedsrichter?</div>
        <button onclick="chooseRefereeCritique('kritik')" class="btn-danger" style="font-size:10px; margin-top:4px;">😠 Öffentlich kritisieren · Fans +3, Medien -2, Strafe ${formatVal(getRefCritiqueFine())}, er pfeift dich 2 Spiele strenger</button>
        <button onclick="chooseRefereeCritique('beschwerde')" class="btn-secondary" style="font-size:10px; margin-top:4px;">📝 Schriftliche Beschwerde · ${formatVal(gebuehr)} Gebühr, ${rot ? '35 % Chance: Rot-Sperre aufgehoben' : 'ohne Rot nur Vorstand +1'}</button>
        <button onclick="chooseRefereeCritique('schweigen')" class="btn-secondary" style="font-size:10px; margin-top:4px;">🤐 Nichts sagen · Vorstand +2, Fans -1</button></div>`;
}

function chooseRefereeCritique(art) {
    if (!currentMatch || !currentMatch.critiquePending) { showToast('Dazu ist es jetzt zu spät.', 'error'); return; }
    const ref = currentMatch.referee;
    currentMatch.critiquePending = false;
    if (!game.refereeCritiqueLog) game.refereeCritiqueLog = [];
    let text = '';
    if (art === 'kritik') {
        const strafe = getRefCritiqueFine();
        setzeBuchungskontext('🧑‍⚖️ Verbandsstrafe');
        game.money -= strafe;
        loescheBuchungskontext();
        game.refCritiques = { season: game.season, count: (game.refCritiques && game.refCritiques.season === game.season ? game.refCritiques.count : 0) + 1 };
        game.fans = Math.min(100, game.fans + 3);
        if (typeof changeMediaImage === 'function') changeMediaImage(-2); else game.managerMediaImage = Math.max(0, (game.managerMediaImage ?? 50) - 2);
        if (!game.refereeGrudges) game.refereeGrudges = {};
        game.refereeGrudges[ref.id] = REF_GRUDGE_MATCHES;
        text = `Klare Worte gegen ${ref.name}: Fans +3, Medien -2, ${formatVal(strafe)} Strafe - und er wird es sich merken.`;
    } else if (art === 'beschwerde') {
        const gebuehr = REF_COMPLAINT_FEE[game.leagueLevel] ?? 250;
        setzeBuchungskontext('🧑‍⚖️ Beschwerdegebühr');
        game.money -= gebuehr;
        loescheBuchungskontext();
        const rot = (currentMatch.controversies || []).find(c => c.type === 'rot');
        if (rot && Math.random() < REF_COMPLAINT_SUCCESS) {
            const p = squad.find(x => x.id === rot.playerId);
            if (p) p.suspended = 0;
            text = `Der Verband gibt dir recht: der Platzverweis gegen ${rot.name} wird zurückgenommen, keine Sperre.`;
        } else if (rot) {
            text = 'Der Verband weist die Beschwerde zurück - die Sperre bleibt.';
        } else {
            game.boardSat = Math.min(100, game.boardSat + 1);
            text = 'Sachlich eingereicht - der Vorstand schätzt den Ton (+1).';
        }
    } else {
        game.boardSat = Math.min(100, game.boardSat + 2);
        game.fans = Math.max(game.fanBaseFloor || 0, game.fans - 1);
        text = 'Kein Wort zum Schiedsrichter: Vorstand +2, die Fans hätten sich mehr Feuer gewünscht (-1).';
    }
    const wann = currentMatch.critiqueWhen || { season: game.season, matchday: game.matchday };
    game.refereeCritiqueLog.unshift({ season: wann.season, matchday: wann.matchday, ref: ref.name, art });
    if (game.refereeCritiqueLog.length > 10) game.refereeCritiqueLog.length = 10;
    showToast(`🧑‍⚖️ ${text}`, art === 'kritik' ? 'error' : 'success', 5000);
    renderRefereeCritiqueBox();
    updateUI();
}

// setupMatch(): ein verärgerter Schiedsrichter pfeift strenger gegen uns.
function applyRefereeGrudge() {
    if (!currentMatch || !currentMatch.referee || !game.refereeGrudges) return;
    const ref = currentMatch.referee;
    const rest = game.refereeGrudges[ref.id] || 0;
    if (rest <= 0) return;
    game.refereeGrudges[ref.id] = rest - 1;
    if (game.refereeGrudges[ref.id] <= 0) delete game.refereeGrudges[ref.id];
    currentMatch.referee = Object.assign({}, ref, { cardMult: ref.cardMult * REF_GRUDGE_CARD_MULT, grudge: true });
    const log = document.getElementById('ticker-log');
    if (log) log.innerHTML += `<div style="color:var(--danger);">🧑‍⚖️ ${ref.name} hat deine Kritik nicht vergessen - er pfeift heute strenger.</div>`;
}

const REF_CRITIQUE_LABELS = { kritik: 'öffentlich kritisiert', beschwerde: 'Beschwerde eingereicht', schweigen: 'geschwiegen' };

// Vorschau auf dem Dashboard (renderRefereePreview): Groll und letzte Reaktion anzeigen.
function getRefereeGrudgeNote(refId, refName) {
    const rest = game.refereeGrudges ? game.refereeGrudges[refId] || 0 : 0;
    const letzte = (game.refereeCritiqueLog || []).find(e => e.ref === refName);
    return (rest > 0 ? `<br><span style="color:var(--danger);">😠 Noch verärgert über deine Kritik (${rest} Spiel${rest > 1 ? 'e' : ''} strenger)</span>` : '')
        + (letzte ? `<br>Zuletzt (Saison ${letzte.season}, ${letzte.matchday}. Spieltag): ${REF_CRITIQUE_LABELS[letzte.art] || letzte.art}` : '');
}
