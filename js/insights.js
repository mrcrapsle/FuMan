// ============================================================================
// STATISTIK UND INFORMATION (Phase 26.3): Serien-Tracker, Formkurve je Spieler, CSV-Export,
// Spielbericht teilen und Fachwort-Hilfe. Alles liest echte Spieldaten; geschrieben wird nur
// die Serien-Buchführung (game.serien) und die letzten Noten je Spieler (p.formNoten).
// ============================================================================

// ---------- Serien-Tracker ----------

const SERIEN_ARTEN = [
    { id: 'sieg', icon: '🔥', label: 'Siegesserie', einheit: 'Siege' },
    { id: 'unbesiegt', icon: '🛡️', label: 'Ungeschlagen', einheit: 'Spiele' },
    { id: 'heimSieg', icon: '🏟️', label: 'Heimsiege in Folge', einheit: 'Siege' },
    { id: 'zuNull', icon: '🧤', label: 'Ohne Gegentor', einheit: 'Spiele' },
    { id: 'ohneSieg', icon: '🥶', label: 'Ohne Sieg', einheit: 'Spiele', schlecht: true },
    { id: 'niederlage', icon: '📉', label: 'Niederlagenserie', einheit: 'Spiele', schlecht: true },
    { id: 'torlos', icon: '🚫', label: 'Ohne eigenes Tor', einheit: 'Spiele', schlecht: true }
];

function ensureSerienState() {
    if (!game.serien || typeof game.serien !== 'object') game.serien = {};
    if (!game.serien.aktuell) game.serien.aktuell = {};
    if (!game.serien.rekord) game.serien.rekord = {};
    SERIEN_ARTEN.forEach(a => { if (typeof game.serien.aktuell[a.id] !== 'number') game.serien.aktuell[a.id] = 0; });
}

// Aus updateLeagueTable() nach jedem eigenen Ligaspiel (live und simuliert)
function recordOwnLeagueResult(ourGoals, oppGoals, isHome) {
    ensureSerienState();
    const s = game.serien.aktuell;
    const sieg = ourGoals > oppGoals, niederlage = ourGoals < oppGoals;
    s.sieg = sieg ? s.sieg + 1 : 0;
    s.unbesiegt = niederlage ? 0 : s.unbesiegt + 1;
    s.ohneSieg = sieg ? 0 : s.ohneSieg + 1;
    s.niederlage = niederlage ? s.niederlage + 1 : 0;
    s.zuNull = oppGoals === 0 ? s.zuNull + 1 : 0;
    s.torlos = ourGoals === 0 ? s.torlos + 1 : 0;
    if (isHome) s.heimSieg = sieg ? s.heimSieg + 1 : 0;
    if (typeof recordPresetResult === 'function') recordPresetResult(ourGoals, oppGoals);
    if (typeof recordTagResult === 'function') recordTagResult(ourGoals, oppGoals);
    SERIEN_ARTEN.forEach(a => {
        const r = game.serien.rekord[a.id];
        if (s[a.id] > 0 && (!r || s[a.id] > r.n)) game.serien.rekord[a.id] = { n: s[a.id], season: game.season, matchday: game.matchday };
    });
}

function renderSeriesTracker() {
    const box = document.getElementById('series-tracker-box');
    if (!box) return;
    ensureSerienState();
    const zeilen = SERIEN_ARTEN.map(a => {
        const n = game.serien.aktuell[a.id], r = game.serien.rekord[a.id];
        const ton = n === 0 ? '' : (a.schlecht ? (n >= 3 ? 'schlecht' : 'warn') : (n >= 3 ? 'gut' : ''));
        const istRekord = r && n > 0 && n === r.n;
        return `<div class="box" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin:4px 0; font-size:var(--fs-small);${n === 0 ? ' opacity:1; color:var(--text-muted);' : ''}">
            <span>${a.icon} ${a.label}</span>
            <span style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
                ${uiChip(`${n} ${a.einheit}`, ton)}
                ${r ? uiChip(`${istRekord ? '🏆 ' : ''}Rekord ${r.n} (Saison ${r.season})`, istRekord ? 'gut' : '') : ''}
            </span></div>`;
    }).join('');
    box.innerHTML = `<div class="panel-header" style="color:var(--gold);">🔥 Serien und Rekorde</div>
        <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:4px;">Gezählt werden deine Ligaspiele, auch über den Saisonwechsel hinweg.</div>${zeilen}`;
}

// ---------- Formkurve je Spieler ----------

// Aus gradeOwnMatch(): die letzten fünf Noten (1,0 ist die beste)
function recordPlayerFormGrade(p, note) {
    if (!Array.isArray(p.formNoten)) p.formNoten = [];
    p.formNoten.push(note);
    if (p.formNoten.length > 5) p.formNoten.shift();
}

function getFormTrend(noten) {
    if (!noten || noten.length < 4) return null;
    const alt = noten.slice(0, noten.length - 2), neu = noten.slice(-2);
    const mw = a => a.reduce((s, x) => s + x, 0) / a.length;
    const diff = mw(alt) - mw(neu); // positiv = Noten werden besser
    return diff >= 0.5 ? 'steigend' : (diff <= -0.5 ? 'fallend' : 'stabil');
}

function renderPlayerForm(p) {
    const box = document.getElementById('pd-form');
    if (!box) return;
    const noten = Array.isArray(p.formNoten) ? p.formNoten : [];
    if (!noten.length) {
        box.innerHTML = `<div style="font-size:var(--fs-caption); color:var(--text-muted); margin:8px 0; text-align:center;">📊 Formkurve: noch keine Noten aus Ligaspielen.</div>`;
        return;
    }
    const schnitt = noten.reduce((s, x) => s + x, 0) / noten.length;
    const trend = getFormTrend(noten);
    const pille = n => uiChip(typeof formatGrade === 'function' ? formatGrade(n) : String(n), n <= 2 ? 'gut' : (n <= 3.5 ? '' : (n <= 4.5 ? 'warn' : 'schlecht')));
    const trendText = trend === 'steigend' ? '📈 steigend' : (trend === 'fallend' ? '📉 fallend' : (trend === 'stabil' ? '➡️ stabil' : ''));
    box.innerHTML = `<div class="ui-overline" style="font-size:var(--fs-caption); color:var(--text-muted); margin:10px 0 4px; text-align:left;">Formkurve (letzte ${noten.length} Ligaspiele)</div>
        <div class="ui-card-meta" style="justify-content:center;">${noten.map(pille).join('')}${uiChip(`Ø ${typeof formatGrade === 'function' ? formatGrade(schnitt) : schnitt.toFixed(1)}`, schnitt <= 2.5 ? 'gut' : (schnitt >= 4 ? 'schlecht' : ''))}${trendText ? uiChip(trendText, trend === 'steigend' ? 'gut' : (trend === 'fallend' ? 'warn' : '')) : ''}</div>`;
}

// ---------- CSV-Export ----------

function csvZelle(v) {
    const t = String(v == null ? '' : v);
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function csvText(zeilen) {
    // Semikolon und BOM: deutsche Tabellenkalkulationen öffnen die Datei direkt richtig
    return '﻿' + zeilen.map(z => z.map(csvZelle).join(';')).join('\r\n') + '\r\n';
}
function csvZahl(n, stellen = 1) { return typeof n === 'number' ? n.toFixed(stellen).replace('.', ',') : ''; }

function buildKaderCsv() {
    const kopf = ['Name', 'Position', 'Alter', 'Stärke', 'Fitness %', 'Moral', 'Marktwert €', 'Gehalt € je Spieltag', 'Vertrag (Jahre Rest)', 'Spiele (Saison)', 'Tore (Saison)', 'Vorlagen (Saison)', 'Notenschnitt (Saison)', 'Etiketten', 'Verletzungen (gesamt)', 'Verpasste Spiele (letzte Ausfälle)'];
    const zeilen = [...squad].sort((a, b) => b.strength - a.strength).map(p => {
        const st = p.statsSeason;
        return [p.name, p.pos, p.age || '', p.strength, p.fitness, p.morale ?? '', p.marketValue || 0, p.wage || 0, p.contracts,
            st ? st.spiele : 0, st ? st.tore : 0, st ? st.vorlagen : 0, st && st.spiele ? csvZahl(st.notenSumme / st.spiele, 2) : '',
            // Etiketten ohne Symbol (js/manager-tools.js), Verletzungen aus Zähler und Verlauf (js/medical-department.js)
            typeof getPlayerTags === 'function' ? getPlayerTags(p).map(t => SPIELER_ETIKETTEN.find(e => e.id === t).label.replace(/^\S+\s+/, '')).join(', ') : '',
            p.timesInjured || 0, (Array.isArray(p.injuryLog) ? p.injuryLog : []).reduce((sum, e) => sum + (e.tage || 0), 0)];
    });
    return csvText([kopf, ...zeilen]);
}

function buildTabelleCsv() {
    const tab = [...(leaguesData[game.leagueLevel] || [])].sort(compareTableRows);
    const kopf = ['Platz', 'Verein', 'Spiele', 'Siege', 'Unentschieden', 'Niederlagen', 'Tore', 'Gegentore', 'Differenz', 'Punkte'];
    return csvText([kopf, ...tab.map((t, i) => [i + 1, t.name, t.played, t.won, t.drawn, t.lost, t.goalsFor, t.goalsAgainst, t.goalsFor - t.goalsAgainst, t.points])]);
}

function downloadTextFile(name, text, mime) {
    try {
        const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (e) {
        showToast('Export nicht möglich: ' + e.message, 'error', 4000);
        return false;
    }
}

function csvDateiname(art) {
    const verein = game.clubName.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '').trim().replace(/\s+/g, '-') || 'Verein';
    return `anstoss-fm13-${verein}-S${game.season}-${art}.csv`;
}
function exportKaderCsv() {
    if (downloadTextFile(csvDateiname('Kader'), buildKaderCsv())) showToast(`📊 Kader (${squad.length} Spieler) als CSV exportiert.`, 'success');
}
function exportTabelleCsv() {
    if (downloadTextFile(csvDateiname('Tabelle'), buildTabelleCsv())) showToast('📊 Tabelle als CSV exportiert.', 'success');
}

// ---------- Spielbericht teilen ----------

function buildMatchReportText() {
    if (typeof currentMatch === 'undefined' || !currentMatch) return '';
    const m = currentMatch;
    const tab = [...(leaguesData[game.leagueLevel] || [])].sort(compareTableRows);
    const platz = tab.findIndex(t => t.name === game.clubName) + 1;
    const eigene = tab.find(t => t.name === game.clubName);
    const log = document.getElementById('ticker-log');
    const tore = log ? [...log.children].map(d => d.innerText.trim()).filter(t => /^⚽ \d+\. Min:/.test(t)).slice(0, 8) : [];
    const zeilen = [
        m.isCup ? `⚽ Pokalspiel · Saison ${game.season}` : `⚽ Spieltag ${game.matchday} · ${typeof leagueNames !== 'undefined' ? leagueNames[game.leagueLevel] : 'Liga'} · Saison ${game.season}`,
        `${m.homeName} ${m.homeGoals}:${m.awayGoals} ${m.awayName}`
    ];
    if (tore.length) zeilen.push('Tore:', ...tore.map(t => '  ' + (t.length > 90 ? t.slice(0, 87) + '…' : t)));
    if (game.lastMatchBestPlayer && game.lastMatchBestPlayer.matchday === game.matchday) zeilen.push(`Bester Spieler: ${game.lastMatchBestPlayer.name} (Note ${typeof formatGrade === 'function' ? formatGrade(game.lastMatchBestPlayer.note) : game.lastMatchBestPlayer.note})`);
    if (!m.isCup && platz && eigene) zeilen.push(`Tabelle: Platz ${platz}, ${eigene.points} Punkte`);
    zeilen.push('— Anstoß Mobile Pro FM13');
    return zeilen.join('\n');
}

function openShareReport() {
    const text = buildMatchReportText();
    if (!text) { showToast('Es gibt noch keinen Spielbericht zum Teilen.', 'error'); return; }
    const feld = document.getElementById('share-report-text');
    const ov = document.getElementById('share-report-overlay');
    if (!feld || !ov) return;
    feld.value = text;
    const teilen = document.getElementById('share-report-native');
    if (teilen) teilen.style.display = typeof navigator.share === 'function' ? '' : 'none';
    ov.classList.add('show');
}
function closeShareReport() {
    const ov = document.getElementById('share-report-overlay');
    if (ov) ov.classList.remove('show');
}
function copyShareReport() {
    const feld = document.getElementById('share-report-text');
    if (!feld) return;
    const fertig = () => showToast('📋 Spielbericht kopiert.', 'success');
    const notfall = () => {
        feld.focus(); feld.select();
        try { document.execCommand('copy') ? fertig() : showToast('Markiere den Text und kopiere ihn von Hand.', 'error', 4000); }
        catch (e) { showToast('Markiere den Text und kopiere ihn von Hand.', 'error', 4000); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(feld.value).then(fertig, notfall);
    else notfall();
}
function nativeShareReport() {
    const feld = document.getElementById('share-report-text');
    if (feld && typeof navigator.share === 'function') navigator.share({ text: feld.value }).catch(() => { /* abgebrochen */ });
}

// ---------- Fachwort-Hilfe ----------

// Ein Begriff im Text, der den passenden Lexikon-Eintrag als Fenster öffnet
function fw(label, term) {
    return `<span class="fachwort" role="button" tabindex="0" data-fachwort="${mpEsc(term || label)}">${label}</span>`;
}

function findFachwort(term) {
    if (typeof LEXICON_ENTRIES === 'undefined') return null;
    return LEXICON_ENTRIES.find(e => e.title === term) || LEXICON_ENTRIES.find(e => e.title.startsWith(term)) || null;
}

function openFachwort(term) {
    const e = findFachwort(term);
    const ov = document.getElementById('fachwort-overlay');
    const box = document.getElementById('fachwort-content');
    if (!e || !ov || !box) { showToast(`Zu „${term}“ gibt es keinen Lexikon-Eintrag.`, 'error'); return; }
    box.innerHTML = `<div class="panel-header">📖 ${mpEsc(e.title)}</div>
        <div style="font-size:var(--fs-body); text-align:left; margin-bottom:8px;">${e.text}</div>
        ${e.tips && e.tips.length ? `<ul style="text-align:left; font-size:var(--fs-small); margin:0 0 8px 18px; padding:0;">${e.tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
        <button onclick="closeFachwort(); showLexiconView(); setLexiconCategory('Alle');" class="btn-secondary">📖 Im Lexikon öffnen</button>
        ${e.screen ? `<button onclick="closeFachwort(); showScreen('${e.screen}')" class="btn-secondary" style="margin-top:6px;">➜ Zum Bildschirm</button>` : ''}`;
    ov.classList.add('show');
}
function closeFachwort() {
    const ov = document.getElementById('fachwort-overlay');
    if (ov) ov.classList.remove('show');
}

// Antippen und Tastatur für alle Fachwörter, auch für später eingefügte
document.addEventListener('click', ev => {
    const el = ev.target.closest && ev.target.closest('.fachwort');
    if (el) { ev.preventDefault(); openFachwort(el.dataset.fachwort); }
});
document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = ev.target.closest && ev.target.closest('.fachwort');
    if (el) { ev.preventDefault(); openFachwort(el.dataset.fachwort); }
});

// ---------- Saisonrückblick (Phase 26.13) ----------
// Ein Fenster pro abgeschlossener Saison: Tabelle, beste Aufstellungsvorlage, Etiketten-Bilanz, Transferbilanz, Ausfälle
// und die Notizen zu Gegnern. Alle Daten gibt es schon (Karriere-Archiv, Bilanz-Archive, Verletzungs-Verlauf); das Fenster
// sammelt sie nur und verändert nichts.

function getReviewSeasons() {
    const karriere = Array.isArray(game.managerCareer) ? game.managerCareer : [];
    return karriere.filter(e => e.club === game.clubName && e.season < game.season).map(e => e.season).slice(-3).reverse();
}

function buildSeasonReviewHtml(saison) {
    const fmt = v => v.toFixed(2).replace('.', ',');
    const abschnitt = (titel, inhalt) => `<div class="box" style="font-size:var(--fs-small); margin:6px 0; text-align:left;"><strong>${titel}</strong><br>${inhalt}</div>`;
    const leer = text => `<span style="color:var(--text-muted);">${text}</span>`;
    const teile = [];
    const k = (game.managerCareer || []).find(e => e.season === saison && e.club === game.clubName);
    teile.push(abschnitt('🏆 Tabelle', k ? `Platz ${k.rank} in der ${mpEsc(k.league)}: ${k.won}S ${k.drawn}U ${k.lost}N, Tore ${k.goalsFor}:${k.goalsAgainst}, ${k.points} Punkte.` : leer('Keine Tabelle gespeichert.')));
    const va = (game.vorlageBilanzArchiv || []).find(a => a.season === saison);
    const beste = va && typeof findeBesteVorlage === 'function' ? findeBesteVorlage(va.eintraege) : null;
    const vaGesamt = va ? Object.values(va.eintraege).filter(b => b.spiele > 0) : [];
    teile.push(abschnitt('📈 Aufstellungsvorlagen', beste ? `🏅 „${mpEsc(beste.name)}“: ${beste.s}S ${beste.u}U ${beste.n}N, ${fmt(presetPunkteProSpiel(beste))} Punkte je Spiel (${vaGesamt.length} Vorlage${vaGesamt.length === 1 ? '' : 'n'} im Einsatz).`
        : vaGesamt.length ? `${vaGesamt.length} Vorlage${vaGesamt.length === 1 ? '' : 'n'} im Einsatz, aber keine mit drei Einsätzen.` : leer('Keine Vorlage wurde in Ligaspielen genutzt.')));
    const tv = game.etikettBilanzVorjahr;
    let etiketten = '';
    if (tv && tv.season === saison && tv.daten && typeof SPIELER_ETIKETTEN !== 'undefined') {
        etiketten = SPIELER_ETIKETTEN.filter(e => tv.daten[e.id] && tv.daten[e.id].mit.spiele >= TAG_BILANZ_MIN && tv.daten[e.id].ohne.spiele >= TAG_BILANZ_MIN).map(e => {
            const d = tv.daten[e.id], diff = tagPunkteProSpiel(d.mit) - tagPunkteProSpiel(d.ohne);
            return `${e.label}: mit ${fmt(tagPunkteProSpiel(d.mit))}, ohne ${fmt(tagPunkteProSpiel(d.ohne))} Pkt/Spiel (${diff >= 0 ? '+' : ''}${fmt(diff)})`;
        }).join('<br>');
    }
    teile.push(abschnitt('🏷️ Etiketten', etiketten || leer('Keine Etiketten mit genug Spielen (je Seite mindestens 5) in dieser Saison.')));
    const tb = (game.transferBilanzHistory || []).find(x => x.season === saison);
    teile.push(abschnitt('💰 Transfers', tb ? `Verkäufe +${formatVal(tb.verkauf)}, Käufe −${formatVal(tb.kauf)}, Saldo <strong style="color:${tb.netto >= 0 ? 'var(--primary)' : 'var(--danger)'};">${tb.netto >= 0 ? '+' : ''}${formatVal(tb.netto)}</strong>.` : leer('Keine Transfers in dieser Saison.')));
    const ausfaelle = squad.map(p => {
        const log = (Array.isArray(p.injuryLog) ? p.injuryLog : []).filter(e => e.season === saison);
        return { p, n: log.length, tage: log.reduce((sum, e) => sum + (e.tage || 0), 0) };
    }).filter(x => x.n > 0).sort((a, b) => b.tage - a.tage);
    const summe = ausfaelle.reduce((sum, x) => sum + x.tage, 0);
    teile.push(abschnitt('🩹 Ausfälle', ausfaelle.length ? `${summe} verpasste Spiele bei ${ausfaelle.length} aktuellen Spielern. Am längsten: ${ausfaelle.slice(0, 3).map(x => `${mpEsc(x.p.name)} (${x.tage})`).join(', ')}.` : leer('Bei den heutigen Spielern ist für diese Saison nichts im Verlauf.')));
    const notizen = Object.keys(game.gegnerNotizen || {}).filter(n => game.gegnerNotizen[n].season === saison).sort((a, b) => a.localeCompare(b));
    teile.push(abschnitt('📓 Notizen zu Gegnern', notizen.length ? notizen.map(n => `<strong>${mpEsc(n)}</strong>: ${mpEsc(game.gegnerNotizen[n].text)}`).join('<br>') : leer('In dieser Saison wurde keine Notiz geschrieben oder geändert.')));
    return teile.join('');
}

function openSeasonReview(saison) {
    const body = document.getElementById('season-review-body'), ov = document.getElementById('season-review-overlay');
    if (!body || !ov) return;
    saison = Number(saison) || getReviewSeasons()[0];
    if (!saison) { showToast('Es gibt noch keine abgeschlossene Saison für einen Rückblick.', 'error'); return; }
    body.innerHTML = `<div class="panel-header">📚 Saisonrückblick ${saison}</div>` + buildSeasonReviewHtml(saison);
    ov.classList.add('show');
}

function closeSeasonReview() {
    const ov = document.getElementById('season-review-overlay');
    if (ov) ov.classList.remove('show');
}

function renderSeasonReviewBox() {
    const box = document.getElementById('season-review-box');
    if (!box) return;
    const saisons = getReviewSeasons();
    box.innerHTML = '<div class="panel-header" style="color:var(--blue);">📚 Saisonrückblick</div>'
        + (saisons.length ? `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 9em), 1fr)); gap:6px;">${saisons.map(s => `<button onclick="openSeasonReview(${s})" class="btn-secondary">Saison ${s}</button>`).join('')}</div>`
            : '<div style="font-size:var(--fs-small); color:var(--text-muted);">Nach dem ersten Saisonende findest du hier einen Rückblick auf Tabelle, Aufstellungsvorlagen, Etiketten, Transfers, Ausfälle und Notizen.</div>');
}

// Saisonende: Hinweis im Postfach (ein Fenster würde sich mit den Meldungen des Saisonwechsels stapeln)
function announceSeasonReview() {
    const saison = game.season - 1;
    if (saison < 1 || typeof addInboxMessage !== 'function') return;
    addInboxMessage('info', `📚 Saisonrückblick ${saison}`, 'Tabelle, beste Aufstellungsvorlage, Etiketten, Transfers, Ausfälle und Notizen der Saison auf einen Blick: Kader → Analyse → Saisonrückblick.', 'screen-squad');
}

function renderInsightsPanels() {
    renderSeriesTracker();
    renderSeasonReviewBox();
}
