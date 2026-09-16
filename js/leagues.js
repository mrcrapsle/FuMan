
// ==========================================
// LIGA-SYSTEM: INITIALISIERUNG & SPIELPLAN
// ==========================================
    function assignRivalriesAndFriendships(teams) {
        // 18 Teams -> 9 Rivalen-Paare (Index 0-1, 2-3, ...) und 9 Freundschafts-Paare,
        // versetzt gebildet (Index 1-2, 3-4, ...), damit sich beide nie überschneiden.
        for (let i = 0; i < teams.length - 1; i += 2) {
            teams[i].rivalName = teams[i + 1].name;
            teams[i + 1].rivalName = teams[i].name;
        }
        for (let i = 1; i < teams.length; i += 2) {
            let j = (i + 1) % teams.length;
            teams[i].friendName = teams[j].name;
            teams[j].friendName = teams[i].name;
        }
    }

    function getOurLeagueTeam() {
        return leaguesData[game.leagueLevel]?.find(t => t.name === game.clubName);
    }

    function getOurRivalName() {
        return getOurLeagueTeam()?.rivalName || null;
    }

    function getOurFriendName() {
        return getOurLeagueTeam()?.friendName || null;
    }

    // Gegner-Identität (NEU): jedes Team bekommt einen eigenen Spielstil, der sein
    // Torverhalten (sowohl in Spielen gegen uns als auch in reinen KI-vs-KI-Spielen)
    // tatsächlich beeinflusst - Offensiv-Teams schießen mehr Tore, kassieren aber auch mehr;
    // Defensiv-Teams umgekehrt. Bisher waren alle KI-Teams bis auf ihre Stärke identisch.
    const AI_PLAYSTYLES = [
        { id: 'offensiv', label: 'Offensiv-Fußball', goalBonus: 0.18, concedeBonus: 0.12 },
        { id: 'defensiv', label: 'Defensive Stabilität', goalBonus: -0.10, concedeBonus: -0.15 },
        { id: 'ausgeglichen', label: 'Ausgeglichenes Spiel', goalBonus: 0, concedeBonus: 0 },
        { id: 'konter', label: 'Konter-Fußball', goalBonus: 0.05, concedeBonus: -0.05 }
    ];
    function getTeamPlaystyle(team) {
        return AI_PLAYSTYLES.find(p => p.id === team?.playstyle) || AI_PLAYSTYLES[2];
    }

    function initLeagues() {
        usedClubNames.clear();
        leaguesData = [];
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let teams = [];
            for (let t = 0; t < 18; t++) {
                let name = (l === game.leagueLevel && t === 0) ? game.clubName : generateTeamName();
                let baseStr = 82 - (l * 10) + Math.floor(Math.random() * 6);
                teams.push({
                    name: name, played: 0, won: 0, drawn: 0, lost: 0,
                    goalsFor: 0, goalsAgainst: 0, points: 0,
                    strength: baseStr, baseStrength: baseStr, recentForm: [],
                    rivalName: null, friendName: null,
                    playstyle: AI_PLAYSTYLES[Math.floor(Math.random() * AI_PLAYSTYLES.length)].id
                });
            }
            assignRivalriesAndFriendships(teams);
            leaguesData.push(teams);
        }
        // Permanenter Rivale: wird EINMALIG beim ersten Aufruf festgelegt und bleibt über alle
        // Saisons hinweg derselbe Verein (anders als die zufällig neu gewürfelten normalen
        // Rivalen-Paare oben) - dafür wird er jede Saison explizit in unsere aktuelle Liga
        // "gezwungen", damit die Rivalitäts-Bilanz (siehe rivalryRecord) überhaupt wachsen kann.
        if (!game.permanentRivalName) game.permanentRivalName = generateTeamName();
        insertSecondTeamIntoLeagues();
        insertPermanentRivalIntoLeagues();
        generateFixtures();
        initDynamicCup();
        initEuropeCup();
    }

    // ==========================================
    // LEBENDE LIGA: ECHTES AUF-/ABSTIEGSSYSTEM FÜR ALLE 108 KI-VEREINE (NEU)
    // ==========================================
    // Bisher warf initLeagues() JEDE Saison die komplette Liga-Pyramide weg und würfelte
    // für alle 6 Ligen x 18 Teams (außer den beiden fest "eingebauten" Sonderplätzen
    // Zweite Mannschaft & Permanenter Rivale) neue Namen UND neue Zufallsstärken neu aus.
    // Dadurch gab es de facto keine Gegner mit Vereinsgeschichte - "Kopf-an-Kopf"-Bilanzen
    // gegen einen Namen waren über Saisongrenzen hinweg reiner Zufall. Diese Funktion ersetzt
    // den initLeagues()-Aufruf am Saisonende: dieselben 108 Vereinsobjekte bleiben bestehen,
    // steigen nach echter Tabellenplatzierung symmetrisch auf/ab (2 rauf/2 runter je
    // Liga-Grenze, dadurch bleiben alle Ligen dauerhaft bei exakt 18 Teams) und werden dabei
    // von einer kleinen "Transferfenster"-Simulation begleitet, die ihre Stärke je nach
    // Erfolg der letzten Saison und neuem Liganiveau weiterentwickelt - Vereine können sich
    // so über mehrere Saisons hinweg wirklich hocharbeiten oder absacken.
    function evolveAiTeamStrength(team, info) {
        // Unser eigenes Team wird über den Kader simuliert, nicht über dieses Feld - das
        // Feld selbst ist für uns nur ein ungenutztes Überbleibsel der Tabellenzeile.
        if (team.name === game.clubName) return;
        // Stärke-Historie (NEU): analog zu p.strengthHistory beim eigenen Kader - macht die
        // Formkurve eines Vereins über mehrere Saisons hinweg sichtbar (siehe Vereinsakte in
        // showHeadToHeadStats()), statt dass nur der aktuelle Wert bekannt ist.
        if (!team.strengthHistory) team.strengthHistory = [];
        team.strengthHistory.push({ season: game.season, strength: team.strength });
        if (team.strengthHistory.length > 8) team.strengthHistory.shift();
        let newLevel = info.outcome === 'promoted' ? info.level - 1 : (info.outcome === 'relegated' ? info.level + 1 : info.level);
        let targetBase = 82 - newLevel * 10;
        // Innerhalb einer Zielband-Breite von ±5 landet der Tabellenerste am oberen, der
        // Letzte am unteren Ende - Vereine, die ihr Niveau klar dominieren, driften so über
        // mehrere Saisons weiter nach oben (und irgendwann in die nächste Aufstiegszone).
        let rankQuality = 1 - (info.rank - 1) / Math.max(1, info.totalTeams - 1);
        let targetStrength = targetBase - 5 + rankQuality * 10;
        // Sanfte Annäherung (40% der Distanz) statt Sofort-Sprung, plus etwas Zufallsrauschen
        // fürs simulierte Transferfenster (mal ein Glücksgriff, mal eine verkorkste Saison).
        let noise = (Math.random() - 0.5) * 6;
        let newStrength = team.strength + (targetStrength - team.strength) * 0.4 + noise;
        team.strength = Math.max(35, Math.min(96, Math.round(newStrength)));
        team.baseStrength = team.strength;
    }

    function advanceLeaguesToNewSeason() {
        // Rang & Auf-/Abstiegs-Ausgang JEDES Vereins anhand der GERADE beendeten Saison
        // festhalten, bevor irgendetwas verschoben oder zurückgesetzt wird.
        let standingsPerLevel = leaguesData.map(table =>
            [...table].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
        );
        // Unser eigener Auf-/Abstieg wird woanders eigenständig entschieden (inkl. DFB-
        // Lizenzprüfung - kann vom reinen Tabellenplatz abweichen!) und weiter unten per
        // insertOurTeamIntoLeagues() zwangsversetzt. Er darf hier keinen der 2 KI-Auf-/
        // Abstiegsplätze "verbrauchen", sonst würden bei einem Platz-1-Aufstieg nur noch 1
        // statt 2 KI-Teams mit aufsteigen und eine Liga würde nach und nach schrumpfen.
        let outcomeOf = new Map();
        let promotedInto = Array.from({ length: NUM_LEAGUES }, () => []);
        let relegatedInto = Array.from({ length: NUM_LEAGUES }, () => []);
        let leaving = new Set();
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let standings = standingsPerLevel[l];
            let aiOnly = standings.filter(t => t.name !== game.clubName);
            let promoted = l > 0 ? aiOnly.slice(0, 2) : [];
            let relegated = l < NUM_LEAGUES - 1 ? aiOnly.slice(-2) : [];
            standings.forEach((t, idx) => {
                let outcome = promoted.includes(t) ? 'promoted' : (relegated.includes(t) ? 'relegated' : 'stayed');
                outcomeOf.set(t, { rank: idx + 1, level: l, outcome, totalTeams: standings.length });
            });
            promoted.forEach(t => { promotedInto[l - 1].push(t); leaving.add(t); });
            relegated.forEach(t => { relegatedInto[l + 1].push(t); leaving.add(t); });
        }

        let newLeaguesData = [];
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let stayers = standingsPerLevel[l].filter(t => !leaving.has(t));
            newLeaguesData.push([...stayers, ...promotedInto[l], ...relegatedInto[l]]);
        }
        leaguesData = newLeaguesData;

        // Neuer Verein-News-Ticker (NEU): welche Vereine sind neu in unserer aktuellen Liga -
        // sonst würde man den vollzogenen Auf-/Abstieg der Konkurrenz nie erfahren.
        let arrivingInOurLevel = [...promotedInto[game.leagueLevel], ...relegatedInto[game.leagueLevel]]
            .filter(t => t.name !== game.clubName && t.name !== game.secondTeam.name);
        let rivalOutcome = game.permanentRivalName ? [...outcomeOf.entries()].find(([t]) => t.name === game.permanentRivalName) : null;

        leaguesData.forEach((table, l) => {
            table.forEach(t => {
                let info = outcomeOf.get(t);
                if (info) evolveAiTeamStrength(t, info);
                t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0;
                t.goalsFor = 0; t.goalsAgainst = 0; t.points = 0; t.recentForm = [];
                t.rivalName = null; t.friendName = null;
            });
            assignRivalriesAndFriendships(table);
        });

        insertOurTeamIntoLeagues();
        insertSecondTeamIntoLeagues();
        insertPermanentRivalIntoLeagues();
        generateFixtures();
        initDynamicCup();
        initEuropeCup();

        if (arrivingInOurLevel.length > 0) {
            let names = arrivingInOurLevel.map(t => t.name).join(', ');
            addInboxMessage('vertrag', `📰 Neue Gesichter in der ${leagueNames[game.leagueLevel]}`, `Diese Saison neu in deiner Liga: ${names}.`, 'screen-league');
        }
        if (rivalOutcome) {
            let [, info] = rivalOutcome;
            if (info.outcome === 'promoted') addInboxMessage('vertrag', `⚔️ ${game.permanentRivalName} steigt auf!`, `Dein Rivale ${game.permanentRivalName} wurde befördert und bekommt dadurch spürbar mehr Substanz.`, 'screen-league');
            else if (info.outcome === 'relegated') addInboxMessage('vertrag', `⚔️ ${game.permanentRivalName} steigt ab!`, `Dein Rivale ${game.permanentRivalName} ist abgestiegen und dürfte dadurch vorerst schwächer werden.`, 'screen-league');
        }
    }

    // Verschiebt den Verein mit diesem Namen in die Ziel-Liga (Positions-Tausch mit dem
    // schwächsten dortigen Nicht-Sonder-Team) statt ihn wie früher einfach neu zu benennen.
    // Unter der jetzt PERSISTENTEN Liga-Pyramide (siehe advanceLeaguesToNewSeason) würde
    // reines Neu-Benennen sonst jede Saison einen zusätzlichen Geister-Verein mit demselben
    // Namen hinterlassen, weil der alte Namensträger von letzter Saison unverändert
    // irgendwo liegen bleibt. Gibt es noch KEINEN Träger dieses Namens (z.B. beim
    // allerersten Aufruf), wird stattdessen wie bisher einfach umbenannt.
    function relocateNamedTeamToLevel(name, targetLevel, protectedNames) {
        if (!name) return null;
        let targetTable = leaguesData[targetLevel];
        if (!targetTable) return null;
        let oldLevel = -1, oldIdx = -1;
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let idx = leaguesData[l].findIndex(t => t.name === name);
            if (idx !== -1) { oldLevel = l; oldIdx = idx; break; }
        }
        if (oldLevel === targetLevel) return targetTable[oldIdx];
        let candidates = targetTable.filter(t => t.name !== name && !protectedNames.includes(t.name));
        if (candidates.length === 0) return null;
        let weakest = candidates.reduce((min, t) => t.strength < min.strength ? t : min, candidates[0]);
        if (oldLevel === -1) { weakest.name = name; return weakest; }
        let targetIdx = targetTable.indexOf(weakest);
        let existing = leaguesData[oldLevel][oldIdx];
        leaguesData[oldLevel].splice(oldIdx, 1, weakest);
        targetTable.splice(targetIdx, 1, existing);
        return existing;
    }

    // Setzt unsere eigene Tabellenzeile zwangsweise in game.leagueLevel um, FALLS der
    // Auf-/Abstiegs-Algorithmus oben (der rein nach Tabellenplatz geht) zu einem anderen
    // Ergebnis kommt als die tatsächliche, an anderer Stelle bereits getroffene Entscheidung
    // (z.B. DFB-Lizenz verweigert trotz Platz 1/2 - dann bleiben wir doch in der alten Liga).
    // Echter Tausch der Array-Positionen zwischen beiden Ligen (wie relocateNamedTeamToLevel
    // oben) statt simplem Überschreiben - so bleibt der verdrängte KI-Verein erhalten.
    function insertOurTeamIntoLeagues() {
        let oldLevel = -1, oldIdx = -1;
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let idx = leaguesData[l].findIndex(t => t.name === game.clubName);
            if (idx !== -1) { oldLevel = l; oldIdx = idx; break; }
        }
        if (oldLevel === -1 || oldLevel === game.leagueLevel) return;
        let targetTable = leaguesData[game.leagueLevel];
        let candidates = targetTable.filter(t => t.name !== game.secondTeam.name && t.name !== game.permanentRivalName);
        if (candidates.length === 0) return;
        let weakest = candidates.reduce((min, t) => t.strength < min.strength ? t : min, candidates[0]);
        let targetIdx = targetTable.indexOf(weakest);
        let ourTeam = leaguesData[oldLevel][oldIdx];
        leaguesData[oldLevel].splice(oldIdx, 1, weakest);
        targetTable.splice(targetIdx, 1, ourTeam);
    }

    function insertPermanentRivalIntoLeagues() {
        if (!game.permanentRivalName) return;
        let slot = relocateNamedTeamToLevel(game.permanentRivalName, game.leagueLevel, [game.clubName, game.secondTeam.name]);
        if (!slot) return;
        let ourTeam = leaguesData[game.leagueLevel].find(t => t.name === game.clubName);
        if (ourTeam) { ourTeam.rivalName = game.permanentRivalName; slot.rivalName = game.clubName; }
    }

    // ==========================================
    // RIVALITÄTEN: ERZFEIND-WECHSEL-MECHANIK (NEU)
    // ==========================================
    // Wird bei jedem Saisonabschluss geprüft: wird eine Rivalität über viele Spiele hinweg
    // extrem einseitig (fast immer Sieg oder fast immer Niederlage), verliert sie ihre
    // emotionale Spannung - ein neuer Erzfeind tritt auf den Plan, die alte Rivalität
    // wandert als abgeschlossenes Kapitel ins Rivalen-Archiv statt einfach zu verschwinden.
    function checkRivalChangeEvent() {
        let totalMatches = rivalryRecord.wins + rivalryRecord.draws + rivalryRecord.losses;
        if (totalMatches < 8) return; // zu früh für eine fundierte Einschätzung
        let winRate = rivalryRecord.wins / totalMatches;
        let lossRate = rivalryRecord.losses / totalMatches;
        if (winRate < 0.78 && lossRate < 0.78) return; // Rivalität ist noch ausgeglichen genug
        if (Math.random() > 0.25) return; // nicht sofort bei jeder Gelegenheit, sondern schleichend

        let oldRivalName = game.permanentRivalName;
        game.rivalHistoryArchive.push({
            name: oldRivalName, endedSeason: game.season,
            record: { ...rivalryRecord }
        });
        if (game.rivalHistoryArchive.length > 10) game.rivalHistoryArchive.shift();

        let newRivalName = generateTeamName();
        game.permanentRivalName = newRivalName;
        rivalryRecord = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, biggestWin: null, matches: [], shootoutsVsRival: 0 };
        insertPermanentRivalIntoLeagues();

        let reason = winRate >= 0.78 ? `du hast ${oldRivalName} zu deutlich dominiert` : `${oldRivalName} hat dich zu deutlich dominiert`;
        addInboxMessage('vertrag', `⚔️ Neuer Erzfeind: ${newRivalName}!`, `Die Rivalität mit ${oldRivalName} hat ihre Spannung verloren (${reason}) - ${newRivalName} übernimmt die Rolle als neuer Angstgegner. Die alte Rivalität bleibt für immer im Rivalen-Archiv erhalten.`, 'screen-history');
        showToast(`⚔️ Neuer Erzfeind: ${newRivalName}!`, 'success');
    }

    // Zentrale, einmalige Stelle für die Rivalitäts-Bilanz - bewusst so gebaut, dass sie von
    // ALLEN DREI Spieltag-Verarbeitungswegen (Live-Spiel, Saison durchsimulieren, Admin
    // vorspulen) aus aufgerufen werden kann, damit die Statistik unabhängig vom gewählten
    // Modus konsistent mitwächst.
    function recordRivalryResult(opponentName, ourGoals, oppGoals) {
        if (!game.permanentRivalName || opponentName !== game.permanentRivalName) return;
        rivalryRecord.matches.push({ season: game.season, matchday: game.matchday, ourGoals, oppGoals });        rivalryRecord.goalsFor += ourGoals;
        rivalryRecord.goalsAgainst += oppGoals;
        let margin = ourGoals - oppGoals;
        if (margin > 0) {
            rivalryRecord.wins++;
            if (!rivalryRecord.biggestWin || margin > rivalryRecord.biggestWin.margin) rivalryRecord.biggestWin = { margin, ourGoals, oppGoals, season: game.season };
            addInboxMessage('vertrag', `🔥 Derbysieg gegen ${opponentName}!`, `${ourGoals}:${oppGoals} - Gesamtbilanz: ${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N`, 'screen-history');
        } else if (margin < 0) {
            rivalryRecord.losses++;
            addInboxMessage('vertrag', `😔 Derby gegen ${opponentName} verloren`, `${ourGoals}:${oppGoals} - Gesamtbilanz: ${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N`, 'screen-history');
        } else {
            rivalryRecord.draws++;
            addInboxMessage('vertrag', `⚖️ Unentschieden im Derby gegen ${opponentName}`, `${ourGoals}:${oppGoals} - Gesamtbilanz: ${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N`, 'screen-history');
        }
    }

    function generateFixtures() {
        fixturesData = [];
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let teams = leaguesData[l];
            let n = teams.length;
            let schedule = [];
            let indices = Array.from({length: n}, (_, i) => i);

            for (let r = 0; r < n - 1; r++) {
                let pairings = [];
                for (let i = 0; i < n / 2; i++) {
                    let home = indices[i], away = indices[n - 1 - i];
                    if (r % 2 === 1) { let tmp = home; home = away; away = tmp; }
                    pairings.push({ home: home, away: away, homeGoals: null, awayGoals: null, played: false });
                }
                schedule.push(pairings);
                let last = indices.pop();
                indices.splice(1, 0, last);
            }
            let returnSchedule = schedule.map(round => round.map(m => ({ home: m.away, away: m.home, homeGoals: null, awayGoals: null, played: false })));
            fixturesData.push([...schedule, ...returnSchedule]);
        }
    }

    function getOpponentStrength(name) {
        for (let l = 0; l < NUM_LEAGUES; l++) {
            let t = leaguesData[l]?.find(x => x.name === name);
            if (t) return t.strength;
        }
        return 75;
    }

    // Liefert einen ECHTEN Vereinsnamen aus der jetzt persistenten Liga-Pyramide (statt
    // eines mit generateTeamName() frisch ausgewürfelten, komplett unverbundenen Namens) -
    // für Systeme, die "irgendein anderer Klub" brauchen (Transferangebote, Abwerbeversuche
    // um den Manager). So tauchen dieselben Vereine, die man aus der eigenen Liga-Tabelle
    // kennt, auch dort als handelnde Akteure auf, statt dass jedes Mal ein neuer, nie wieder
    // auftauchender Fantasiename erscheint.
    function pickRandomOpposingClubName(preferHigherOrEqualLevel = false) {
        let excluded = [game.clubName, game.secondTeam.name, game.permanentRivalName];
        let pool = leaguesData.flatMap((table, l) => table.filter(t => !excluded.includes(t.name)).map(t => ({ team: t, level: l })));
        if (pool.length === 0) return generateTeamName();
        if (preferHigherOrEqualLevel) {
            let higher = pool.filter(p => p.level <= game.leagueLevel); // kleinerer Index = höhere Liga
            if (higher.length > 0) pool = higher;
        }
        return pool[Math.floor(Math.random() * pool.length)].team.name;
    }

    function setLeagueLevel(lvl) {
        game.leagueLevel = lvl;
        for (let i = 0; i < NUM_LEAGUES; i++) {
            let btn = document.getElementById('btn-lvl-' + i);
            if (btn) btn.className = (i === lvl) ? 'btn-action' : 'btn-secondary';
        }
        renderLeagueView();
    }

    function setLeagueTab(tab) {
        ['table', 'fixtures'].forEach(t => {
            document.getElementById('league-tab-' + t).style.display = (t === tab) ? 'block' : 'none';
            let btn = document.getElementById('btn-tab-' + t);
            if (btn) btn.className = (t === tab) ? 'btn-action' : 'btn-secondary';
        });
    }

    function changeLeagueMatchday(dir) {
        game.viewingMatchday = Math.max(1, Math.min(34, (game.viewingMatchday || game.matchday) + dir));
        renderLeagueView();
    }

    // Torschützenliste (NEU): erste echte individuelle Torstatistik im Spiel - zeigt die
    // eigenen Top-Torschützen der laufenden Saison.
    function renderTopScorersBox() {
        let box = document.getElementById('top-scorers-box');
        if (!box) return;
        let scorers = [...squad].filter(p => (p.goalsSeason || 0) > 0).sort((a, b) => b.goalsSeason - a.goalsSeason).slice(0, 8);
        if (scorers.length === 0) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Noch keine Tore in dieser Saison.</div>'; return; }
        box.innerHTML = scorers.map((p, idx) => `
            <div class="box" style="display:flex; justify-content:space-between; align-items:center; font-size:10px;">
                <span>${idx === 0 ? '👑 ' : ''}<strong class="badge badge-${(p.pos||'mit').toLowerCase()}">${p.pos}</strong> ${p.name}</span>
                <strong style="color:var(--accent); font-size:13px;">${p.goalsSeason} ⚽</strong>
            </div>`).join('');
    }

    function renderLeagueView() {
        renderTopScorersBox();

        // WICHTIG: Zwei getrennte Referenzen! fixturesData verweist per Index auf die
        // ORIGINAL-Reihenfolge in leaguesData[level] - die darf nie sortiert werden,
        // sonst würden Teams plötzlich falsch gegeneinander antreten (Spielplan-Korruption).
        // Für die Tabellenansicht wird stattdessen eine sortierte KOPIE erzeugt.
        let rawTeams = leaguesData[game.leagueLevel] || [];
        let sortedTeams = [...rawTeams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
        let tbody = document.getElementById('league-table-body');
        tbody.innerHTML = '';
        sortedTeams.forEach((t, idx) => {
            let tr = document.createElement('tr');
            let isUs = (t.name === game.clubName);
            let formIcons = { W: '<span style="color:var(--primary);">●</span>', D: '<span style="color:var(--accent);">●</span>', L: '<span style="color:var(--danger);">●</span>' };
            let formHtml = (t.recentForm || []).map(r => formIcons[r] || '').join(' ');
            // Kopf-an-Kopf-Statistik (NEU): Klick auf einen Gegnernamen zeigt die historische
            // Bilanz gegen genau diesen Verein.
            let nameCell = isUs ? t.name : `<span onclick="showHeadToHeadStats('${t.name.replace(/'/g, "\\'")}')" style="text-decoration:underline dotted; cursor:pointer;">${t.name}</span>`;
            tr.innerHTML = `<td>${idx+1}</td><td style="text-align:left; ${isUs?'color:var(--primary); font-weight:bold;':''}">${nameCell}</td><td>${t.played}</td><td>${t.goalsFor}:${t.goalsAgainst}</td><td>${t.goalsFor-t.goalsAgainst}</td><td><strong>${t.points}</strong></td><td style="font-size:9px; white-space:nowrap;">${formHtml}</td>`;
            tbody.appendChild(tr);
        });
        let h2hBox = document.getElementById('head-to-head-box');
        if (h2hBox) h2hBox.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Tippe auf einen Vereinsnamen in der Tabelle für die Kopf-an-Kopf-Bilanz.</div>';

        let md = game.viewingMatchday || game.matchday;
        let titleEl = document.getElementById('fixture-view-mday-title');
        if (titleEl) titleEl.innerText = 'Spieltag ' + md;

        let list = document.getElementById('matchday-fixtures-list');
        list.innerHTML = '';
        let fixs = fixturesData[game.leagueLevel] ? fixturesData[game.leagueLevel][md - 1] : [];
        if (fixs) {
            fixs.forEach(f => {
                let h = rawTeams[f.home]?.name || "Team A", a = rawTeams[f.away]?.name || "Team B";
                let hTeamObj = rawTeams[f.home], aTeamObj = rawTeams[f.away];
                let isDerby = hTeamObj && aTeamObj && (hTeamObj.rivalName === a || aTeamObj.rivalName === h);
                let isFriendly = hTeamObj && aTeamObj && (hTeamObj.friendName === a || aTeamObj.friendName === h);
                let tag = isDerby ? ' <span style="color:var(--danger); font-weight:900;">🔥 DERBY</span>' : (isFriendly ? ' <span style="color:var(--blue);">🤝</span>' : '');
                // Zuschauerzahl bei bereits gespielten eigenen Heimspielen anzeigen - aus der
                // dauerhaften Zuschauerhistorie nachgeschlagen, nicht nur beim allerletzten Spiel.
                let attendanceTag = '';
                if (f.played && h === game.clubName) {
                    let entry = (game.attendanceHistory || []).find(e => e.season === game.season && e.matchday === md && e.opponent === a);
                    if (entry) attendanceTag = `<div style="font-size:9px; color:var(--text-muted); width:100%; text-align:center;">👥 ${entry.attendance.toLocaleString('de-DE')} Zuschauer</div>`;
                }
                let row = document.createElement('div');
                row.className = 'fixture-row';
                row.style.flexWrap = 'wrap';
                row.innerHTML = `<span>${h}</span><strong>${f.played ? f.homeGoals + ':' + f.awayGoals : 'vs'}</strong><span>${a}</span>${tag}${attendanceTag}`;
                list.appendChild(row);
            });
        }
    }

    // Kopf-an-Kopf-Statistik (NEU): zeigt die historische Bilanz gegen einen bestimmten
    // Ligagegner in einer eigenen Box unterhalb der Tabelle.
    // Vereinsakte (erweitert seit der persistenten Liga-Pyramide, siehe
    // advanceLeaguesToNewSeason()): zeigt jetzt zusätzlich zur Kopf-an-Kopf-Bilanz das
    // aktuelle Liganiveau, die aktuelle Stärke und - sofern schon mindestens eine Saison
    // vergangen ist - die Formkurve des Vereins über die Zeit, statt nur die reinen
    // Duell-Ergebnisse gegeneinander.
    function showHeadToHeadStats(oppName) {
        playSound('click');
        let box = document.getElementById('head-to-head-box');
        if (!box) return;

        let levelIdx = leaguesData.findIndex(table => table.some(t => t.name === oppName));
        let team = levelIdx !== -1 ? leaguesData[levelIdx].find(t => t.name === oppName) : null;
        let profileLine = team
            ? `Aktuell: ${leagueNames[levelIdx]} · Stärke ${team.strength}`
            : 'Aktuell nicht in der Liga-Pyramide vertreten.';
        let formLine = (team && team.strengthHistory && team.strengthHistory.length > 0)
            ? `<br>Formkurve (Stärke über die letzten Saisons): ${team.strengthHistory.map(h => h.strength).join(' → ')} → <strong>${team.strength}</strong>`
            : '';

        let rec = game.headToHeadRecords[oppName];
        let h2hLine = (!rec || (rec.wins + rec.draws + rec.losses) === 0)
            ? `Noch keine Duelle gegen ${oppName} ausgetragen.`
            : `${rec.wins}S ${rec.draws}U ${rec.losses}N · Tore ${rec.goalsFor}:${rec.goalsAgainst}<br>Letzte Ergebnisse: ${rec.lastResults.join(', ')}`;

        box.innerHTML = `<div class="box" style="font-size:10px;">
            <strong style="color:var(--accent);">🗂️ Vereinsakte: ${oppName}</strong><br>
            ${profileLine}${formLine}
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.12);">${h2hLine}</div>
        </div>`;
    }

