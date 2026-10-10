/* eslint-disable no-undef */
// Spielstand-Sicherheit (Phase 20.7): jeder Spielstand wird VOR dem Übernehmen geprüft
// (validateAndRepairSave) - ein unlesbarer oder kaputter Stand lässt das laufende Spiel
// unangetastet, kleine Schäden (doppelte Spieler-IDs, NaN-Werte, verwaiste Aufstellung)
// werden repariert und gemeldet. Vor dem Laden, vor dem Überschreiben eines Slots und vor
// einem neuen Spiel landet der bisherige Stand in einer Sicherheitskopie (SAVE_BACKUP_KEY).
// Geschrieben wird über writeSaveVerified(): Fehlerursache (blockiert/voll) wird erkannt,
// der Stand zurückgelesen, und bei vollem Speicher weicht zuerst die Sicherheitskopie.

const SAVE_BACKUP_KEY = 'anstoss_fm13_backup';
// Chromium erlaubt ~5,2 Mio. Zeichen pro Herkunft (gemessen), Firefox 5 MiB - darunter bleiben.
const STORAGE_BUDGET_CHARS = 5000000;
const STORAGE_WARN_SHARE = 0.8;
const EXPORT_REMINDER_SEASONS = 3;
let speicherWarnungGezeigt = false;

function buildSaveMeta(extra) {
    return Object.assign({
        savedAt: new Date().toLocaleString('de-DE'),
        savedTs: Date.now(),
        version: GAME_VERSION.number,
        clubName: game.clubName,
        league: leagueNames[game.leagueLevel],
        season: game.season,
        matchday: Math.min(34, game.matchday),
        money: game.money
    }, extra || {});
}

// Belegter Speicher (Schlüssel + Wert in Zeichen). Gezählt wird ALLES: bei file:// teilen sich
// alle lokalen Dateien denselben Speicher, fremde Einträge nehmen dem Spiel also Platz weg.
function getStorageUsage() {
    const eintraege = [];
    try {
        const ls = window.localStorage;
        for (let i = 0; i < ls.length; i++) {
            const k = ls.key(i);
            if (!k) continue;
            eintraege.push({ key: k, size: k.length + (ls.getItem(k) || '').length, game: k.startsWith('anstoss_fm13') });
        }
    } catch (e) { return { used: 0, budget: STORAGE_BUDGET_CHARS, share: 0, entries: [], blocked: true }; }
    const used = eintraege.reduce((a, e) => a + e.size, 0);
    const fremd = eintraege.filter(e => !e.game).reduce((a, e) => a + e.size, 0);
    return { used, foreign: fremd, budget: STORAGE_BUDGET_CHARS, share: used / STORAGE_BUDGET_CHARS, entries: eintraege, blocked: false };
}

function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}

// Schreibt einen Spielstand und liest ihn zur Kontrolle zurück.
// Ergebnis: { ok, reason: 'blockiert' | 'voll' | 'pruefung' }
function writeSaveVerified(key, json) {
    const versuch = () => {
        try { window.localStorage.setItem(key, json); return { ok: true }; }
        catch (e) { return { ok: false, reason: isQuotaError(e) ? 'voll' : 'blockiert' }; }
    };
    let r = versuch();
    let backupWeg = false;
    // Speicher voll: die Sicherheitskopie ist der entbehrlichste Stand - sie weicht zuerst.
    if (!r.ok && r.reason === 'voll' && key !== SAVE_BACKUP_KEY && safeLocalGet(SAVE_BACKUP_KEY)) {
        safeLocalRemove(SAVE_BACKUP_KEY);
        backupWeg = true;
        r = versuch();
        if (r.ok) r.backupDropped = true;
    }
    // backupDropped auch bei Fehlschlag: die Meldung nennt dann, dass die Kopie umsonst weg ist
    if (!r.ok) return { ...r, backupDropped: backupWeg };
    if (safeLocalGet(key) !== json) return { ok: false, reason: 'pruefung' };
    if (key !== SAVE_BACKUP_KEY) maybeWarnStorageFull();
    return r;
}

function describeSaveFailure(r) {
    if (r.reason === 'voll') {
        const u = getStorageUsage();
        const kopie = r.backupDropped ? ' Die Sicherheitskopie wurde dafür schon entfernt und reicht trotzdem nicht.' : '';
        return `💾 Speicher voll (${Math.round(u.used / 1000)} von ~${Math.round(u.budget / 1000)} Tsd. Zeichen belegt): lösche einen alten Slot oder exportiere den Spielstand als Datei.${kopie}`;
    }
    if (r.reason === 'pruefung') return '💾 Speichern fehlgeschlagen: der Stand ließ sich nicht fehlerfrei zurücklesen. Bitte erneut speichern oder als Datei exportieren.';
    return '💾 Speichern nicht möglich: Dieser Browser/diese Ansicht blockiert lokalen Speicher für diese Datei. Öffne die Datei in einem normalen Browser (z.B. "Öffnen mit..." → Chrome), nicht in der Dateivorschau.';
}

function maybeWarnStorageFull() {
    if (speicherWarnungGezeigt) return;
    const u = getStorageUsage();
    if (u.share < STORAGE_WARN_SHARE) return;
    speicherWarnungGezeigt = true;
    showToast(`⚠️ Der Speicher ist zu ${Math.round(u.share * 100)} % belegt - bald passt kein Spielstand mehr hinein. Lösche alte Slots oder exportiere als Datei.`, 'error', 7000);
}

// Prüft einen eingelesenen Spielstand und repariert kleine Schäden direkt im Objekt.
// fatal: der Stand ist nicht zu gebrauchen (dann wird NICHTS übernommen).
function validateAndRepairSave(p) {
    const repairs = [];
    if (!p || typeof p !== 'object') return { fatal: 'kein Spielstand', repairs };
    if (!p.game || typeof p.game !== 'object') return { fatal: 'Vereinsdaten fehlen', repairs };
    if (!Array.isArray(p.squad)) return { fatal: 'Kader fehlt', repairs };
    if (!Array.isArray(p.leaguesData) || p.leaguesData.length !== NUM_LEAGUES || p.leaguesData.some(l => !Array.isArray(l))) return { fatal: 'Ligatabellen fehlen', repairs };
    const g = p.game;
    if (!Number.isInteger(g.leagueLevel) || g.leagueLevel < 0 || g.leagueLevel >= NUM_LEAGUES) return { fatal: 'Liga unbekannt', repairs };
    const club = g.clubName;
    if (!club || !p.leaguesData.some(l => l.some(t => t && t.name === club))) return { fatal: 'eigener Verein fehlt in den Tabellen', repairs };

    // Kader: kaputte Einträge raus, doppelte IDs neu vergeben, Zahlen reparieren.
    const vorher = p.squad.length;
    p.squad = p.squad.filter(s => s && typeof s === 'object' && s.id !== undefined && s.id !== null);
    if (p.squad.length < vorher) repairs.push(`${vorher - p.squad.length} unlesbare Spieler entfernt`);
    if (p.squad.length < 11) return { fatal: 'Kader hat keine 11 Spieler', repairs };
    const ids = new Set();
    let maxId = Math.max(0, ...p.squad.map(s => Number(s.id)).filter(Number.isFinite));
    let doppelt = 0;
    p.squad.forEach(s => {
        if (ids.has(s.id)) { s.id = ++maxId; doppelt++; }
        ids.add(s.id);
    });
    if (doppelt) repairs.push(`${doppelt} doppelte Spieler-IDs neu vergeben`);
    const standard = { strength: 50, fitness: 100, morale: 60, age: 25, wage: 1000, contracts: 1 };
    let zahlen = 0;
    p.squad.forEach(s => {
        Object.entries(standard).forEach(([k, v]) => {
            if (typeof s[k] !== 'number' || !Number.isFinite(s[k])) { s[k] = v; zahlen++; }
        });
        if (typeof s.marketValue !== 'number' || !Number.isFinite(s.marketValue)) { s.marketValue = calculatePlayerMarketValue(s.strength); zahlen++; }
    });
    if (zahlen) repairs.push(`${zahlen} ungültige Spielerwerte ersetzt`);

    // Vereinswerte
    const vereinsWerte = { money: 0, boardSat: 50, fans: 50, season: 1, matchday: 1 };
    Object.entries(vereinsWerte).forEach(([k, v]) => {
        if (typeof g[k] !== 'number' || !Number.isFinite(g[k])) { g[k] = v; repairs.push(`${k} ungültig, auf ${v} gesetzt`); }
    });
    if (g.matchday < 1 || g.matchday > 35) { g.matchday = Math.min(35, Math.max(1, Math.round(g.matchday))); repairs.push('Spieltag korrigiert'); }

    // Aufstellung: nur Spieler aus dem Kader, sonst neu aufstellen lassen.
    if (Array.isArray(p.lineup)) {
        const gueltig = p.lineup.filter(id => ids.has(id));
        if (gueltig.length !== p.lineup.length) {
            p.lineup = gueltig;
            repairs.push('Aufstellung bereinigt');
        }
        if (p.lineup.length < 11) p.needsAutoLineup = true;
    } else {
        p.needsAutoLineup = true;
    }
    return { fatal: null, repairs };
}

function compareGameVersions(a, b) {
    const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return d;
    }
    return 0;
}

// Einziger Weg, einen Spielstand zu übernehmen: prüfen, Sicherheitskopie, laden, nachreparieren.
// options: { label, backup (bool), silent (bool) } → true/false
// Was nach einem abgewiesenen Laden gilt und wo der Ausweg liegt (25.25).
function saveLoadHinweis(label) {
    if (safeLocalGet(SAVE_BACKUP_KEY)) return 'Das laufende Spiel bleibt unverändert; eine Sicherheitskopie liegt unter „🛟 Sicherheitskopie wiederherstellen“ (Speicherstände) bereit.';
    const ausweg = label === 'Autosave' ? 'lade einen Spielstand aus einem Slot' : 'lade einen anderen Slot oder den Autosave';
    return `Das laufende Spiel bleibt unverändert; ${ausweg}.`;
}

function loadSaveSafely(raw, options) {
    const o = Object.assign({ label: 'Spielstand', backup: true, silent: false }, options || {});
    const name = `Spielstand „${o.label}“`;
    let p;
    try { p = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (e) {
        if (!o.silent) showToast(`⛔ ${name} ist beschädigt und nicht lesbar. ${saveLoadHinweis(o.label)}`, 'error', 6000);
        return false;
    }
    const check = validateAndRepairSave(p);
    if (check.fatal) {
        if (!o.silent) showToast(`⛔ ${name} ist beschädigt (${check.fatal}). ${saveLoadHinweis(o.label)}`, 'error', 6000);
        return false;
    }
    if (o.backup) backupCurrentGame(`vor dem Laden von „${o.label}“`);
    const braucheAufstellung = p.needsAutoLineup;
    delete p.needsAutoLineup;
    applyLoadedState(p);
    if (typeof insertOurTeamIntoLeagues === 'function') insertOurTeamIntoLeagues();
    if (braucheAufstellung && typeof autoLineup === 'function') autoLineup();
    if (check.repairs.length) {
        showToast(`🔧 ${name} beim Laden repariert: ${check.repairs.join(', ')}.`, 'success', 6000);
    }
    if (p.meta && p.meta.version && compareGameVersions(p.meta.version, GAME_VERSION.number) > 0) {
        showToast(`⚠️ ${name} stammt aus einer neueren Version (${p.meta.version}) als dieses Spiel (${GAME_VERSION.number}) - lade die aktuelle Version, sonst können Daten fehlen.`, 'error', 7000);
    }
    return true;
}

// Sicherheitskopie des laufenden Spiels (eine einzige, die jeweils letzte).
function backupCurrentGame(reason) {
    if (!Array.isArray(squad) || !squad.length) return false;
    try {
        const state = buildSaveState();
        state.meta = buildSaveMeta({ backupReason: reason });
        return writeSaveVerified(SAVE_BACKUP_KEY, JSON.stringify(state)).ok;
    } catch (e) { console.error('Sicherheitskopie fehlgeschlagen:', e); return false; }
}

// Slot überschreiben: der alte Inhalt wandert in die Sicherheitskopie.
function backupSlotBeforeOverwrite(key, label) {
    const alt = safeLocalGet(key);
    if (!alt) return;
    try {
        const p = JSON.parse(alt);
        p.meta = Object.assign({}, p.meta || {}, { backupReason: `„${label}“ vor dem Überschreiben` });
        writeSaveVerified(SAVE_BACKUP_KEY, JSON.stringify(p));
    } catch (e) { /* kaputter alter Slot: nichts zu sichern */ }
}

function restoreSaveBackup() {
    const raw = safeLocalGet(SAVE_BACKUP_KEY);
    if (!raw) { showToast('Es gibt keine Sicherheitskopie.', 'error'); return false; }
    // Das laufende Spiel wird dabei selbst zur Sicherheitskopie - der Schritt ist umkehrbar.
    if (!loadSaveSafely(raw, { label: 'Sicherheitskopie' })) return false;
    updateUI();
    showScreen('screen-dashboard');
    playSound('whistle');
    showToast('🛟 Sicherheitskopie wiederhergestellt - der vorherige Stand ist jetzt die neue Sicherheitskopie.', 'success', 4500);
    renderSaveSlotsUI();
    return true;
}

// Beim Start: zuletzt geschriebenen Stand laden, bei Schaden den nächstneueren heilen.
function listStoredSaves() {
    const quellen = [{ key: AUTOSAVE_KEY, id: 'auto', label: 'Autosave' }];
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) quellen.push({ key: SAVE_SLOT_PREFIX + i, id: 'slot' + i, label: `Slot ${i}` });
    quellen.push({ key: SAVE_BACKUP_KEY, id: 'backup', label: 'Sicherheitskopie' });
    return quellen.map(q => {
        const raw = safeLocalGet(q.key);
        if (!raw) return null;
        let meta = null;
        try { meta = JSON.parse(raw).meta || null; } catch (e) { /* kaputt - bleibt ohne Meta in der Liste */ }
        return Object.assign({}, q, { raw, meta, ts: (meta && meta.savedTs) || 0 });
    }).filter(Boolean);
}

function loadNewestIntactSave(bevorzugt) {
    const staende = listStoredSaves();
    if (!staende.length) return false;
    const erster = staende.find(s => s.id === bevorzugt);
    const rest = staende.filter(s => s !== erster && s.id !== 'backup').sort((a, b) => b.ts - a.ts);
    const backup = staende.filter(s => s.id === 'backup');
    const reihenfolge = [erster, ...rest, ...backup].filter(Boolean);
    for (const s of reihenfolge) {
        if (loadSaveSafely(s.raw, { label: s.label, backup: false, silent: true })) {
            updateUI();
            if (erster && s !== erster) {
                showToast(`⚠️ Spielstand „${erster.label}“ war beschädigt - geladen wurde stattdessen „${s.label}“ (Saison ${game.season}, Spieltag ${Math.min(34, game.matchday)}).`, 'error', 8000);
            } else if (s.id === 'auto') {
                showToast(`📂 Automatischer Spielstand geladen (Saison ${game.season}, Spieltag ${Math.min(34, game.matchday)}).`, 'success', 3500);
            }
            return true;
        }
    }
    showToast('⛔ Alle gespeicherten Spielstände sind beschädigt - es startet ein neues Spiel. Hast du einen Datei-Export, kannst du ihn unter 💾 Speicherstände importieren.', 'error', 9000);
    return false;
}

// Erinnerung am Saisonende: Browserdaten können verloren gehen, ein Datei-Export nicht.
function remindSaveExport() {
    const seit = game.season - (game.lastExportSeason || 0);
    if (seit < EXPORT_REMINDER_SEASONS) return;
    if (game.lastExportReminderSeason === game.season) return;
    game.lastExportReminderSeason = game.season;
    addInboxMessage('finanzen', '💾 Spielstand sichern?', `${game.lastExportSeason ? `Dein letzter Datei-Export ist ${seit} Saisons her.` : 'Du hast deinen Spielstand noch nie als Datei exportiert.'} Wird der Browserspeicher geleert (Cache löschen, App neu installieren), sind alle Slots weg - eine exportierte Datei nicht.\n\n💾 Speicherstände → "Als Datei exportieren".`, 'screen-dashboard');
}

function renderSaveSafetyBox() {
    const box = document.getElementById('save-safety-box');
    if (!box) return;
    const u = getStorageUsage();
    const prozent = Math.min(100, Math.round(u.share * 100));
    const farbe = u.share >= STORAGE_WARN_SHARE ? 'var(--danger)' : (u.share >= 0.5 ? 'var(--gold)' : 'var(--primary)');
    let backup = '';
    const raw = safeLocalGet(SAVE_BACKUP_KEY);
    if (raw) {
        let m = {};
        try { m = JSON.parse(raw).meta || {}; } catch (e) { m = { backupReason: 'beschädigt' }; }
        backup = `<div style="margin-top:6px;">🛟 <strong>Sicherheitskopie</strong> (${m.backupReason || 'ohne Angabe'}): ${m.clubName || '-'} · Saison ${m.season ?? '?'} · Spieltag ${m.matchday ?? '?'} · ${m.savedAt || ''}
            <button onclick="restoreSaveBackup()" class="btn-secondary" style="font-size:9px; margin-top:4px;">🛟 Sicherheitskopie wiederherstellen</button></div>`;
    } else {
        backup = '<div style="margin-top:6px; color:var(--text-muted);">🛟 Sicherheitskopie: entsteht automatisch vor dem Laden, vor dem Überschreiben eines Slots und vor einem neuen Spiel.</div>';
    }
    const exp = game.lastExportSeason ? `Saison ${game.lastExportSeason}` : 'noch nie';
    box.innerHTML = `<div style="font-size:10px;">
        <div>📦 Speicher belegt: <strong style="color:${farbe};">${prozent} %</strong> (${Math.round(u.used / 1000)} von ~${Math.round(u.budget / 1000)} Tsd. Zeichen${u.foreign > 50000 ? `, davon ${Math.round(u.foreign / 1000)} Tsd. durch andere Seiten/Dateien` : ''})${u.blocked ? ' - <span style="color:var(--danger);">Speicher blockiert!</span>' : ''}</div>
        <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; margin-top:3px;"><div style="height:6px; width:${prozent}%; background:${farbe}; border-radius:3px;"></div></div>
        <div style="margin-top:4px; color:var(--text-muted);">📤 Letzter Datei-Export: ${exp} - nur eine exportierte Datei übersteht das Leeren des Browserspeichers.</div>
        ${backup}</div>`;
}
