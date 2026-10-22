// Ausschreitungen (Board-Karte "Ausschreitungen mehr ausbauen"):
// - Risiko nicht mehr nur im Heim-Derby: auch Auswärts-Derbys, Fan-Feindschaften (FAN_FEINDSCHAFTEN) und Brisanzspiele
//   (Spitzenspiel oder Abstiegsduell, beide Teams oben bzw. unten) können eskalieren.
// - Drei Stufen: Pyro (leicht), Krawall (mittel), schwere Ausschreitungen (Geisterspiel daheim).
// - Fanprojekt und gelockertes Pyro-Verbot wirken jetzt wirklich, dazu Fan-Dialog vor einem
//   Risikospiel, Bewährung nach wiederholten Vorfällen und eine Chronik (game.ausschreitungen).
// Die Prüfung läuft aus processPostMatchRoutine() (js/match-live.js) nach jedem eigenen Ligaspiel.

const AUSSCHREITUNG_STUFEN = {
    pyro: { name: '🧨 Pyro im Block', ton: 'warn' },
    krawall: { name: '👊 Krawall', ton: 'schlecht' },
    schwer: { name: '🔥 Schwere Ausschreitungen', ton: 'schlecht' }
};
const FAN_DIALOG_KOSTEN = 3000;

// Fan-Feindschaften: keine Derbys (die regelt isDerbyMatch in js/club-geo.js), aber verfeindete Fanszenen.
// Risikospiel mit 8 % daheim und 4 % auswärts. Namen wie im Spiel (leicht verfremdet).
const FAN_FEINDSCHAFTEN = [
    // Nordost
    ['BFC Dynamoo', 'Lokomotiv Leipzich', 'Ost-Feindschaft'], ['BFC Dynamoo', 'Dynamo Dressden', 'Dynamo-Duell'], ['BFC Dynamoo', 'FC Energie Cotbus', 'Ost-Feindschaft'],
    ['Lokomotiv Leipzich', 'Hallescher FK 96', 'Mitteldeutsche Feindschaft'], ['Lokomotiv Leipzich', 'Carl Zeiss Jenna', 'Mitteldeutsche Feindschaft'],
    ['BSG Chemie Leipzich', 'Carl Zeiss Jenna', 'Mitteldeutsche Feindschaft'], ['BSG Chemie Leipzich', 'Hallescher FK 96', 'Mitteldeutsche Feindschaft'],
    ['Chemnitzer FCC', 'Lokomotiv Leipzich', 'Sachsen-Feindschaft'], ['Chemnitzer FCC', 'FSV Zwikau', 'Westsachsen-Feindschaft'],
    ['FC Energie Cotbus', 'SV Babelsbergh 03', 'Brandenburg-Feindschaft'], ['Hansa Rostok', 'SV Babelsbergh 03', 'Ost-Feindschaft'],
    ['1. FC Magdeborg', 'FC Energie Cotbus', 'Ost-Feindschaft'], ['Carl Zeiss Jenna', 'Hallescher FK 96', 'Mitteldeutsche Feindschaft'],
    // Nord
    ['VfB Oldenborg', 'SV Meppenn', 'Nordwest-Feindschaft'], ['VfB Oldenborg', 'VfL Osnabruk', 'Nordwest-Feindschaft'], ['VfB Oldenborg', 'Kickers Emdenn', 'Ostfriesland-Feindschaft'],
    ['Eintracht Braunschweigh', 'VfL Osnabruk', 'Nord-Feindschaft'], ['Hansa Rostok', 'VfB Lubek', 'Ostsee-Feindschaft'],
    // West
    ['Rot-Weiss Essn', 'Alemannia Aachn', 'West-Feindschaft'], ['Rot-Weiss Essn', 'Wuppertaler SVV', 'West-Feindschaft'], ['KFC Uerdingenn 05', 'Fortuna Dusseldorf', 'Niederrhein-Feindschaft'],
    ['Rot-Weiss Oberhausn', 'MSV Duisborg', 'Niederrhein-Feindschaft'], ['SC Verll', 'SC Wiedenbruk', 'OWL-Feindschaft'], ['Alemannia Aachn', 'SC Fortuna Kohln', 'Rheinland-Feindschaft'],
    // Südwest
    ['Kickers Offenbachh', 'SV Waldhof Manheim', 'Südwest-Feindschaft'], ['Kickers Offenbachh', 'FSV Frankfurtt', 'Main-Feindschaft'], ['SV Waldhof Manheim', '1. FC Kaiserslauten', 'Südwest-Feindschaft'],
    ['Eintracht Trierr', '1. FC Saarbrukken', 'Mosel-Saar-Feindschaft'], ['FK Pirmasenss', '1. FC Kaiserslauten', 'Pfalz-Feindschaft'], ['Stuttgarter Kikkers', 'SSV Ulm 1847', 'Schwaben-Feindschaft'],
    // Bundesliga, 2. und 3. Liga (recherchiert; Derbys und Traditionsduelle aus js/club-geo.js stehen nicht doppelt hier)
    ['Borussia Dortmunt', 'RB Leibzig', 'Anti-RB-Feindschaft'], ['Hertha BSK', 'Hansa Rostok', 'Ost-West-Feindschaft'], ['Hertha BSK', 'Union Berlien', 'Berliner Feindschaft'],
    ['Union Berlien', 'Hansa Rostok', 'Ost-Feindschaft'], ['Union Berlien', 'Dynamo Dressden', 'Ost-Feindschaft'], ['Hansa Rostok', '1. FC Magdeborg', 'Ost-Feindschaft'],
    ['Hansa Rostok', 'Erzgebirge Aua', 'Ost-Feindschaft'], ['Dynamo Dressden', 'Hallescher FK 96', 'Ost-Feindschaft'], ['Dynamo Dressden', 'Erzgebirge Aua', 'Sachsen-Feindschaft'],
    ['Hamburger SP', 'FC St. Paulli', 'Hamburger Feindschaft'], ['Bayern Munchen', 'TSV 1861 Munchen', 'Münchner Feindschaft'], ['1. FC Nurnberg', 'TSV 1861 Munchen', 'Süd-Feindschaft'],
    ['Karlsruher SK', 'Hannover 97', 'Nord-Süd-Feindschaft'], ['SV Darmstadt 99', 'Kickers Offenbachh', 'Hessen-Feindschaft'], ['Arminia Bilefeld', 'VfL Osnabruk', 'Westfalen-Feindschaft'],
    ['Alemannia Aachn', 'SC Preussen Munsterr', 'West-Feindschaft'],
    // Bayern
    ['TSV 1861 Munchen', 'FC Augsburgh', 'Bayern-Feindschaft'], ['TSV 1861 Munchen', 'SpVgg Unterhachingen', 'Münchner Vorort-Feindschaft'], ['TSV 1861 Munchen', 'Turkgucu Munchen', 'Münchner Feindschaft'],
    ['SpVgg Bayreuthh', 'SpVgg Bayern Hoff', 'Oberfranken-Feindschaft'], ['SpVgg Bayreuthh', '1. FC Nurnberg', 'Franken-Feindschaft']
];

function getFanFeindschaft(a, b) {
    const f = FAN_FEINDSCHAFTEN.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
    return f ? f[2] : null;
}

function ensureAusschreitungState() {
    if (!Array.isArray(game.ausschreitungen)) game.ausschreitungen = [];
    if (typeof fanCentralState.pyroLockerungSpiele !== 'number') fanCentralState.pyroLockerungSpiele = 0;
}

// Brisanz aus der Tabelle: beide Teams in den Top 4 oder beide in den letzten 4.
function getAusschreitungBrisanz(gegner) {
    if (!gegner || typeof sortedTable !== 'function') return null;
    const tab = sortedTable(game.leagueLevel) || [];
    const n = tab.length;
    const ich = tab.findIndex(t => t.name === game.clubName);
    const er = tab.findIndex(t => t.name === gegner);
    if (n < 8 || ich < 0 || er < 0 || game.matchday < 5) return null;
    if (ich < 4 && er < 4) return 'Spitzenspiel';
    if (ich >= n - 4 && er >= n - 4) return 'Abstiegsduell';
    return null;
}

// Vorfälle mit Krawall oder schlimmer in dieser und der Vorsaison.
function getAusschreitungBewaehrung() {
    ensureAusschreitungState();
    return game.ausschreitungen.filter(v => v.stufe !== 'pyro' && v.season >= game.season - 1).length;
}

function fanDialogAktiv() {
    const d = game.fanDialog;
    return !!d && d.season === game.season && d.matchday === game.matchday;
}

// Risiko eines Spiels samt Faktoren für die Anzeige.
// ctx: { gegner, heim, tordiff } (tordiff nur nach dem Spiel bekannt).
function getAusschreitungsLage(ctx) {
    ensureAusschreitungState();
    const faktoren = [];
    const derby = typeof isDerbyOpponent === 'function' && isDerbyOpponent(ctx.gegner);
    const feindschaft = derby ? null : getFanFeindschaft(game.clubName, ctx.gegner);
    const brisanz = derby || feindschaft ? null : getAusschreitungBrisanz(ctx.gegner);
    let chance = 0;
    if (derby && ctx.heim) { chance = 0.12; faktoren.push('Heim-Derby'); }
    else if (derby) { chance = 0.06; faktoren.push('Auswärts-Derby'); }
    else if (feindschaft) { chance = ctx.heim ? 0.08 : 0.04; faktoren.push(`Fan-Feindschaft (${feindschaft})`); }
    else if (brisanz) { chance = ctx.heim ? 0.04 : 0.025; faktoren.push(brisanz); }
    if (chance === 0) return { chance: 0, faktoren, derby, brisanz, feindschaft };

    const mal = (f, text) => { chance *= f; faktoren.push(`${text} ×${f.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`); };
    if (ctx.heim) {
        // Ordner wirken nur daheim; auswärts stellt der Gastgeber die Sicherheitskräfte.
        const ordner = (game.stewards || 0) + (typeof securityWorkforce !== 'undefined' ? securityWorkforce.permanentStewards : 0);
        const skill = typeof securityWorkforce !== 'undefined' ? (1 + (securityWorkforce.skillLevel - 1) * 0.12) : 1;
        const f = 1 - Math.min(0.92, (ordner / 100) * 0.8 * skill);
        if (f < 1) mal(Math.round(f * 100) / 100, `Ordner (${ordner})`);
        if (typeof getStadiumSecurityBonus === 'function' && getStadiumSecurityBonus() > 0) mal(Math.round((1 - getStadiumSecurityBonus()) * 100) / 100, 'Sicherheitstechnik');
        if (typeof getDerbyRiskFactor === 'function' && derby && getDerbyRiskFactor() !== 1) mal(Math.round(getDerbyRiskFactor() * 100) / 100, 'Derby-Woche');
    }
    if (staffMembers.fanLiaison && staffMembers.fanLiaison.hired) mal(0.7, 'Fanbeauftragter');
    if (fanCentralState.fanProjectFunded) mal(0.75, 'Fanprojekt');
    if (fanDialogAktiv()) mal(0.6, 'Fan-Dialog');
    if (ctx.heim && game.securityCalmNextMatch) mal(0.15, 'Sicherheitslage beruhigt');
    if (fanCentralState.pyroLockerungSpiele > 0) mal(1.4, 'Pyro-Verbot gelockert');
    const ultras = (typeof fanGroups !== 'undefined' ? fanGroups : []).find(g => g.id === 'ultras');
    if (ultras && ultras.mood < 35) mal(1.25, 'Ultras verärgert');
    if (getAusschreitungBewaehrung() >= 2) mal(1.2, 'Bewährung');
    if (typeof ctx.tordiff === 'number' && ctx.tordiff <= -3) mal(1.3, 'Klatsche');
    return { chance: Math.min(0.5, chance), faktoren, derby, brisanz, feindschaft };
}

function pruefeAusschreitungen(ctx) {
    const lage = getAusschreitungsLage(ctx);
    if (ctx.heim && fanCentralState.pyroLockerungSpiele > 0) fanCentralState.pyroLockerungSpiele--;
    if (lage.chance <= 0 || Math.random() >= lage.chance) return null;

    const bewaehrung = getAusschreitungBewaehrung();
    const wurf = Math.random() + bewaehrung * 0.1;
    const stufe = wurf < 0.55 ? 'pyro' : (wurf < 0.85 ? 'krawall' : 'schwer');
    if (stufe !== 'pyro') game.riotCount = (game.riotCount || 0) + 1;
    const n = game.riotCount || 0;
    let strafe = stufe === 'pyro' ? 3000 + n * 1500 : (stufe === 'krawall' ? 6000 + n * 3000 : 8000 + n * 4000);
    if (stufe === 'schwer' && !ctx.heim) strafe = Math.round(strafe * 1.5);
    // Sicherheitschef verhandelt mit dem Verband nach.
    if (staffMembers.secChief && staffMembers.secChief.hired) strafe = Math.round(strafe * 0.5);
    strafe = Math.min(Math.max(0, game.money), strafe);
    if (strafe > 0) bucheMitLabel('Verbandsstrafe Ausschreitungen', -strafe);

    const fansMinus = stufe === 'pyro' ? 2 : (stufe === 'krawall' ? 6 : 12);
    const vorstandMinus = stufe === 'pyro' ? 0 : (stufe === 'krawall' ? 4 : 8);
    game.fans = Math.max(game.fanBaseFloor || 0, game.fans - fansMinus);
    game.boardSat = Math.max(10, game.boardSat - vorstandMinus);
    const geisterspiel = stufe === 'schwer' && ctx.heim;
    if (geisterspiel) game.forcedGhostGame = true;

    const eintrag = { season: game.season, matchday: game.matchday, gegner: ctx.gegner || '', heim: !!ctx.heim, stufe, strafe, geisterspiel };
    game.ausschreitungen.unshift(eintrag);
    if (game.ausschreitungen.length > 30) game.ausschreitungen.length = 30;
    if (typeof pushFanFeedEntry === 'function') pushFanFeedEntry(`${AUSSCHREITUNG_STUFEN[stufe].name} gegen ${ctx.gegner || 'den Gegner'}: Strafe ${formatVal(strafe)}.`);

    const ort = ctx.heim ? 'rund ums Stadion' : 'im Gästeblock';
    const texte = {
        pyro: `Im Fanblock brennen Bengalos, das Spiel wird kurz unterbrochen.\n\nStrafe: ${formatVal(strafe)}. Fans -${fansMinus}.`,
        krawall: `Fangruppen geraten ${ort} aneinander, die Polizei muss eingreifen.\n\nStrafe: ${formatVal(strafe)}. Fans -${fansMinus}, Vorstand -${vorstandMinus}.`,
        schwer: `Rivalisierende Fangruppen liefern sich Straßenschlachten ${ort}.\n\nStrafe: ${formatVal(strafe)}. Fans -${fansMinus}, Vorstand -${vorstandMinus}.` + (geisterspiel ? ' Der Verband verhängt ein Geisterspiel für die nächste Heimpartie.' : '')
    };
    const warnung = bewaehrung + (stufe !== 'pyro' ? 1 : 0) >= 2 ? '\n\n⚠️ Der Verband hat euch auf Bewährung gesetzt: weitere Vorfälle werden wahrscheinlicher schwer.' : '';
    // Bild statt reiner Meldung (js/ausschreitungen-szene.js): Szene im Fanblock, im offenen Livespiel auch auf der Tribüne
    if (typeof zeigeAusschreitungSzene === 'function') zeigeAusschreitungSzene(eintrag, AUSSCHREITUNG_STUFEN[stufe].name, texte[stufe] + warnung);
    else showNotice(AUSSCHREITUNG_STUFEN[stufe].name, texte[stufe] + warnung, { typ: 'warn' });
    if (typeof live3dAusschreitung === 'function') live3dAusschreitung(eintrag);
    return eintrag;
}

function ausschreitungNaechstesSpiel() {
    const liga = leaguesData[game.leagueLevel] || [];
    const tag = (fixturesData[game.leagueLevel] || [])[game.matchday - 1] || [];
    const f = tag.find(x => liga[x.home]?.name === game.clubName || liga[x.away]?.name === game.clubName);
    if (!f || f.played) return null;
    const heim = liga[f.home].name === game.clubName;
    return { gegner: liga[heim ? f.away : f.home].name, heim };
}

function fuehreFanDialog() {
    const spiel = ausschreitungNaechstesSpiel();
    if (!spiel) { showToast('Gerade steht kein Ligaspiel an.', 'error'); return; }
    if (getAusschreitungsLage(spiel).chance <= 0) { showToast('Das nächste Spiel gilt nicht als Risikospiel, ein Fan-Dialog ist nicht nötig.', 'info'); return; }
    if (fanDialogAktiv()) { showToast('Der Fan-Dialog für dieses Spiel läuft schon.', 'info'); return; }
    if (game.money < FAN_DIALOG_KOSTEN) { showToast(`Nicht genug Geld: ${formatVal(FAN_DIALOG_KOSTEN)} nötig.`, 'error'); return; }
    bucheMitLabel('Fan-Dialog', -FAN_DIALOG_KOSTEN);
    game.fanDialog = { season: game.season, matchday: game.matchday };
    if (typeof pushFanFeedEntry === 'function') pushFanFeedEntry(`🗣️ Fan-Dialog vor dem Spiel gegen ${spiel.gegner}: Szene und Polizei sprechen sich ab.`);
    showToast('🗣️ Fan-Dialog geführt: Risiko fürs nächste Spiel deutlich gesenkt.', 'success');
    renderAusschreitungenBox();
    if (typeof updateUI === 'function') updateUI();
}

function renderAusschreitungenBox() {
    const box = document.getElementById('ausschreitungen-box');
    if (!box) return;
    ensureAusschreitungState();
    const spiel = ausschreitungNaechstesSpiel();
    const lage = spiel ? getAusschreitungsLage(spiel) : null;
    let html = '';
    if (!spiel) {
        html += '<div class="box">Kein Ligaspiel offen.</div>';
    } else if (lage.chance <= 0) {
        html += `<div class="box">Nächstes Spiel: ${mpEsc(spiel.gegner)} (${spiel.heim ? 'Heim' : 'Auswärts'}) ${uiChip('Kein Risikospiel', 'gut')}</div>`;
    } else {
        const p = Math.round(lage.chance * 1000) / 10;
        const ton = p < 3 ? 'gut' : (p < 8 ? 'warn' : 'schlecht');
        html += `<div class="box"><div>Nächstes Spiel: <strong>${mpEsc(spiel.gegner)}</strong> (${spiel.heim ? 'Heim' : 'Auswärts'}) ${uiChip(`Risiko ${p.toLocaleString('de-DE')} %`, ton)}</div>
            <div style="color:var(--text-muted); font-size:var(--fs-caption); margin-top:3px;">${lage.faktoren.map(mpEsc).join(' · ')}</div>
            <button onclick="fuehreFanDialog()" class="btn-secondary" style="margin-top:6px;" ${fanDialogAktiv() ? 'disabled' : ''}>${fanDialogAktiv() ? '🗣️ Fan-Dialog geführt (×0,6)' : `🗣️ Fan-Dialog führen [${formatVal(FAN_DIALOG_KOSTEN)}]`}</button></div>`;
    }
    const bew = getAusschreitungBewaehrung();
    const extras = [];
    if (bew >= 2) extras.push(uiChip(`Bewährung: ${bew} Vorfälle`, 'schlecht'));
    else if (bew === 1) extras.push(uiChip('1 Vorfall, noch keine Bewährung', 'warn'));
    if (fanCentralState.pyroLockerungSpiele > 0) extras.push(uiChip(`Pyro gelockert: noch ${fanCentralState.pyroLockerungSpiele} Heimspiele`, 'warn'));
    if (game.forcedGhostGame) extras.push(uiChip('Nächstes Heimspiel: Geisterspiel', 'schlecht'));
    if (extras.length) html += `<div style="display:flex; flex-wrap:wrap; gap:4px; margin:4px 0;">${extras.join('')}</div>`;
    const liste = game.ausschreitungen.slice(0, 6);
    html += liste.length
        ? `<div style="font-size:var(--fs-small);">${liste.map(v => `<div class="box" style="display:flex; justify-content:space-between; gap:6px; flex-wrap:wrap;"><span>S${v.season}/${v.matchday}. ${AUSSCHREITUNG_STUFEN[v.stufe]?.name || v.stufe} · ${mpEsc(v.gegner)} (${v.heim ? 'H' : 'A'})</span><span style="color:var(--danger);">-${formatVal(v.strafe)}${v.geisterspiel ? ' · 👻' : ''}</span></div>`).join('')}</div>`
        : '<div style="color:var(--text-muted); font-size:var(--fs-caption);">Bisher keine Vorfälle.</div>';
    html += '<canvas id="ausschreitung-karte" class="ausschreitung-karte" role="img" aria-label="Stadionkarte: Risiko je Block und Vorfälle dieser Saison"></canvas><div class="startmenue-hinweis">Farbe je Block nach dem Risiko des nächsten Spiels (grün ruhig, rot hoch), Symbole für Vorfälle dieser Saison.</div>';
    box.innerHTML = html;
    if (typeof zeichneAusschreitungKarte === 'function') zeichneAusschreitungKarte(lage, spiel);
}
