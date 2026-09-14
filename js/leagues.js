
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
        return leaguesData[game.leagueLevel]?.find(t => t.name === "1.FC Moritz Leipzig");
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
                let name = (l === game.leagueLevel && t === 0) ? "1.FC Moritz Leipzig" : generateTeamName();
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

    function insertPermanentRivalIntoLeagues() {
        if (!game.permanentRivalName) return;
        let table = leaguesData[game.leagueLevel];
        if (!table) return;
        let candidates = table.filter(t => t.name !== "1.FC Moritz Leipzig" && t.name !== game.secondTeam.name);
        if (candidates.length === 0) return;
        let slot = candidates.reduce((min, t) => t.strength < min.strength ? t : min, candidates[0]);
        slot.name = game.permanentRivalName;
        let ourTeam = table.find(t => t.name === "1.FC Moritz Leipzig");
        if (ourTeam) { ourTeam.rivalName = game.permanentRivalName; slot.rivalName = "1.FC Moritz Leipzig"; }
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
            let isUs = (t.name === "1.FC Moritz Leipzig");
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
                if (f.played && h === "1.FC Moritz Leipzig") {
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
    function showHeadToHeadStats(oppName) {
        playSound('click');
        let box = document.getElementById('head-to-head-box');
        if (!box) return;
        let rec = game.headToHeadRecords[oppName];
        if (!rec || (rec.wins + rec.draws + rec.losses) === 0) {
            box.innerHTML = `<div class="box" style="font-size:10px;">Noch keine Duelle gegen <strong>${oppName}</strong> ausgetragen.</div>`;
            return;
        }
        let total = rec.wins + rec.draws + rec.losses;
        box.innerHTML = `<div class="box" style="font-size:10px;">
            <strong style="color:var(--accent);">Bilanz gegen ${oppName}</strong> (${total} Duelle)<br>
            ${rec.wins}S ${rec.draws}U ${rec.losses}N · Tore ${rec.goalsFor}:${rec.goalsAgainst}<br>
            Letzte Ergebnisse: ${rec.lastResults.join(', ')}
        </div>`;
    }

