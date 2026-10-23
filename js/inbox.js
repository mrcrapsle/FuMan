
    // ==========================================
    // Postfach: zentrales Nachrichtensystem für Transferangebote, Verletzungen,
    // auslaufende Verträge, Finanzwarnungen, Scouting-Ergebnisse & Spielanalysen.
    // Ergänzt die bestehenden Toasts (die bleiben für sofortiges Feedback), gibt aber
    // zusätzlich eine durchsuchbare, dauerhafte Übersicht wie in der Referenz-App.
    // ==========================================
    let inboxMessages = [];
    let inboxArchive = [];
    let inboxFilter = 'alle';
    const MAX_INBOX_MESSAGES = 80;

    function addInboxMessage(category, title, body, screenLink) {
        // Eindeutige ID: mehrere Mails in derselben Millisekunde bekamen sonst manchmal dieselbe
        let id = Date.now() + Math.floor(Math.random() * 1000);
        while (inboxMessages.some(m => m.id === id) || inboxArchive.some(m => m.id === id)) id++;
        inboxMessages.unshift({
            id,
            category, title, body, screenLink,
            read: false,
            important: false,
            matchday: Math.min(34, game.matchday),
            season: game.season
        });
        if (inboxMessages.length > MAX_INBOX_MESSAGES) {
            // Älteste GELESENE, NICHT WICHTIGE Nachrichten zuerst entfernen
            let readIdx = -1;
            for (let i = inboxMessages.length - 1; i >= 0; i--) { if (inboxMessages[i].read && !inboxMessages[i].important) { readIdx = i; break; } }
            inboxMessages.splice(readIdx !== -1 ? readIdx : inboxMessages.length - 1, 1);
        }
        updateUI();
        if (document.getElementById('screen-inbox') && document.getElementById('screen-inbox').style.display !== 'none') renderInboxView();
    }

    function setInboxFilter(cat) {
        playSound('click');
        inboxFilter = cat;
        inboxAuswahl.clear();   // ausgewählt wird nur, was man sieht
        ['alle', 'wichtig', 'transfer', 'verletzung', 'finanzen', 'scouting', 'archiv'].forEach(c => {
            let btn = document.getElementById('inbox-filter-' + c);
            if (btn) btn.className = (c === cat) ? 'btn-action' : 'btn-secondary';
            if (btn) btn.style.fontSize = 'var(--fs-caption)';
        });
        renderInboxView();
    }

    function markInboxRead(id) {
        let m = inboxMessages.find(x => x.id === id);
        if (m && !m.read) { m.read = true; updateUI(); renderInboxView(); }
    }

    function markAllInboxRead() {
        playSound('click');
        inboxMessages.forEach(m => m.read = true);
        updateUI();
        renderInboxView();
    }

    // Wichtig-Markierung: wichtige Nachrichten werden nicht automatisch gelöscht,
    // wenn das Postfach voll wird, und lassen sich per eigenem Filter isoliert ansehen.
    function toggleInboxImportant(id) {
        let m = inboxMessages.find(x => x.id === id) || inboxArchive.find(x => x.id === id);
        if (m) { m.important = !m.important; renderInboxView(); }
    }

    // Nachrichten-Archiv: statt endgültig zu löschen, wandern Nachrichten ins Archiv
    // und lassen sich von dort wiederherstellen oder erst dort endgültig entfernen.
    function archiveInboxMessage(id) {
        let idx = inboxMessages.findIndex(m => m.id === id);
        if (idx === -1) return;
        let [m] = inboxMessages.splice(idx, 1);
        inboxArchive.unshift(m);
        if (inboxArchive.length > 100) inboxArchive.pop();
        renderInboxView(); updateUI();
    }
    function restoreInboxMessage(id) {
        let idx = inboxArchive.findIndex(m => m.id === id);
        if (idx === -1) return;
        let [m] = inboxArchive.splice(idx, 1);
        inboxMessages.unshift(m);
        renderInboxView(); updateUI();
    }
    // Löschen (Board-Karte „Postfach: Mails löschen“): einzeln über 🗑️, mehrere über die Auswahl,
    // alle gelesenen der Ansicht auf einmal oder das ganze Archiv. Der letzte Löschvorgang lässt
    // sich rückgängig machen (nur im Speicher, nach dem Laden eines Spielstands verworfen).
    let inboxAuswahlModus = false;
    let inboxAuswahl = new Set();
    let inboxLetztesLoeschen = null;

    function inboxLoeschen(ids) {
        let weg = new Set(ids);
        let eintraege = [];
        inboxMessages.forEach((m, index) => { if (weg.has(m.id)) eintraege.push({ m, liste: 'post', index }); });
        inboxArchive.forEach((m, index) => { if (weg.has(m.id)) eintraege.push({ m, liste: 'archiv', index }); });
        if (eintraege.length === 0) return 0;
        inboxMessages = inboxMessages.filter(m => !weg.has(m.id));
        inboxArchive = inboxArchive.filter(m => !weg.has(m.id));
        weg.forEach(id => inboxAuswahl.delete(id));
        inboxLetztesLoeschen = eintraege;
        renderInboxView(); updateUI();
        return eintraege.length;
    }
    function deleteInboxMessage(id) {
        playSound('click');
        inboxLoeschen([id]);
    }
    function inboxLoeschenRueckgaengig() {
        if (!inboxLetztesLoeschen) { showToast('Es gibt nichts wiederherzustellen.', 'error'); return; }
        // An der alten Stelle einsetzen, aufsteigend, damit jede Mail ihren Platz wiederbekommt
        inboxLetztesLoeschen.slice().sort((a, b) => a.index - b.index).forEach(e => {
            let liste = e.liste === 'archiv' ? inboxArchive : inboxMessages;
            liste.splice(Math.min(e.index, liste.length), 0, e.m);
        });
        let n = inboxLetztesLoeschen.length;
        inboxLetztesLoeschen = null;
        showToast(n === 1 ? '↩ Mail wiederhergestellt.' : `↩ ${n} Mails wiederhergestellt.`, 'success');
        renderInboxView(); updateUI();
    }
    // Gelesene der aktuellen Ansicht ohne ★ Wichtig; im Archiv alles.
    function getInboxLoeschbare() {
        if (inboxFilter === 'archiv') return inboxArchive.slice();
        return getInboxAnsicht().filter(m => m.read && !m.important);
    }
    function inboxAnsichtLeeren(btn) {
        let ziel = getInboxLoeschbare();
        if (ziel.length === 0) {
            showToast(inboxFilter === 'archiv' ? 'Das Archiv ist schon leer.' : 'Keine gelesenen Mails ohne ★ in dieser Ansicht.', 'error');
            return;
        }
        if (!requireConfirm(btn, `${ziel.length === 1 ? '1 Mail' : ziel.length + ' Mails'} löschen?`)) return;
        let n = inboxLoeschen(ziel.map(m => m.id));
        showToast(`🗑️ ${n === 1 ? '1 Mail' : n + ' Mails'} gelöscht.`, 'success');
    }
    function setInboxAuswahlModus(an) {
        playSound('click');
        inboxAuswahlModus = !!an;
        inboxAuswahl.clear();
        renderInboxView();
    }
    function toggleInboxAuswahl(id) {
        if (inboxAuswahl.has(id)) inboxAuswahl.delete(id); else inboxAuswahl.add(id);
        renderInboxView();
    }
    function inboxAlleAuswaehlen() {
        let ansicht = getInboxAnsicht();
        let alle = ansicht.length > 0 && ansicht.every(m => inboxAuswahl.has(m.id));
        ansicht.forEach(m => { if (alle) inboxAuswahl.delete(m.id); else inboxAuswahl.add(m.id); });
        renderInboxView();
    }
    function inboxAuswahlLoeschen(btn) {
        if (inboxAuswahl.size === 0) { showToast('Tippe zuerst die Mails an, die weg sollen.', 'error'); return; }
        if (!requireConfirm(btn, `${inboxAuswahl.size === 1 ? '1 Mail' : inboxAuswahl.size + ' Mails'} löschen?`)) return;
        let n = inboxLoeschen([...inboxAuswahl]);
        inboxAuswahlModus = false;
        showToast(`🗑️ ${n === 1 ? '1 Mail' : n + ' Mails'} gelöscht.`, 'success');
        renderInboxView();
    }

    const INBOX_CATEGORY_META = {
        transfer: { icon: '🤝', color: 'var(--blue)', label: 'Transfer' },
        verletzung: { icon: '🩹', color: 'var(--danger)', label: 'Verletzung' },
        finanzen: { icon: '💰', color: 'var(--accent)', label: 'Finanzen' },
        scouting: { icon: '🔭', color: 'var(--teal)', label: 'Scouting' },
        analyse: { icon: '📋', color: 'var(--blue)', label: 'Analyse' }, // --violet ist im Kontrast-Theme eine dunkle Fläche, keine Schriftfarbe
        vertrag: { icon: '📄', color: 'var(--purple)', label: 'Vertrag' }
    };

    function getInboxAnsicht() {
        let filtered = inboxFilter === 'alle' ? inboxMessages
            : inboxFilter === 'wichtig' ? inboxMessages.filter(m => m.important)
            : inboxFilter === 'archiv' ? inboxArchive
            : inboxMessages.filter(m => m.category === inboxFilter);
        // Wichtige Nachrichten immer zuerst anzeigen (außer im Archiv-Filter).
        if (inboxFilter !== 'archiv') filtered = [...filtered].sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0));
        return filtered;
    }

    function renderInboxAktionen(ansicht) {
        let box = document.getElementById('inbox-aktionen');
        if (!box) return;
        let raster = 'display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9em), 1fr)); gap:4px; margin-bottom:8px;';
        let rueck = inboxLetztesLoeschen
            ? `<div class="box" id="inbox-rueckgaengig" style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; font-size:var(--fs-caption);">
                <span>🗑️ ${inboxLetztesLoeschen.length === 1 ? '1 Mail' : inboxLetztesLoeschen.length + ' Mails'} gelöscht.</span>
                <button onclick="inboxLoeschenRueckgaengig()" class="btn-secondary" style="flex:0 0 auto; width:auto; font-size:var(--fs-caption);">↩ Rückgängig</button>
            </div>` : '';
        if (inboxAuswahlModus) {
            let alle = ansicht.length > 0 && ansicht.every(m => inboxAuswahl.has(m.id));
            box.innerHTML = `${rueck}
                <div style="font-size:var(--fs-caption); color:var(--text-muted); margin-bottom:4px;">Tippe Mails an, um sie auszuwählen: ${inboxAuswahl.size} ausgewählt.</div>
                <div style="${raster}">
                    <button onclick="inboxAuswahlLoeschen(this)" class="btn-action" style="font-size:var(--fs-caption);">🗑️ Ausgewählte löschen (${inboxAuswahl.size})</button>
                    <button onclick="inboxAlleAuswaehlen()" class="btn-secondary" style="font-size:var(--fs-caption);">${alle ? '☐ Keine auswählen' : '☑ Alle auswählen'}</button>
                    <button onclick="setInboxAuswahlModus(false)" class="btn-secondary" style="font-size:var(--fs-caption);">Fertig</button>
                </div>`;
            return;
        }
        let loeschbar = getInboxLoeschbare().length;
        box.innerHTML = `${rueck}
            <div style="${raster}">
                <button onclick="inboxAnsichtLeeren(this)" class="btn-secondary" style="font-size:var(--fs-caption);">🗑️ ${inboxFilter === 'archiv' ? 'Archiv leeren' : 'Gelesene löschen'}${loeschbar ? ` (${loeschbar})` : ''}</button>
                <button onclick="setInboxAuswahlModus(true)" class="btn-secondary" style="font-size:var(--fs-caption);">☑ Auswählen</button>
            </div>`;
    }

    function renderInboxView() {
        let list = document.getElementById('inbox-messages-list');
        if (!list) return;
        let filtered = getInboxAnsicht();
        renderInboxAktionen(filtered);
        let unreadTotal = inboxMessages.filter(m => !m.read).length;
        let summaryEl = document.getElementById('inbox-unread-summary');
        if (summaryEl) summaryEl.innerText = unreadTotal > 0 ? ` — ${unreadTotal} ungelesen` : ' — alles gelesen';

        if (filtered.length === 0) {
            list.innerHTML = `<div class="box" style="font-size:var(--fs-small); color:var(--text-muted);">${inboxFilter === 'archiv' ? 'Archiv ist leer.' : 'Keine Nachrichten in dieser Kategorie.'}</div>`;
            return;
        }
        let isArchiveView = inboxFilter === 'archiv';
        list.innerHTML = filtered.map(m => {
            if (inboxAuswahlModus) return renderInboxAuswahlKarte(m);
            let meta = INBOX_CATEGORY_META[m.category] || { icon: '📌', color: 'var(--accent)', label: 'Info' };
            let linkBtn = m.screenLink ? `<button onclick="markInboxRead(${m.id}); showScreen('${m.screenLink}')" class="btn-secondary">Ansehen →</button>` : '';
            let archiveBtn = isArchiveView
                ? `<button onclick="event.stopPropagation(); restoreInboxMessage(${m.id})" class="ui-icon-btn" style="color:var(--primary);" title="Wiederherstellen" aria-label="Wiederherstellen">↺</button>`
                : `<button onclick="event.stopPropagation(); archiveInboxMessage(${m.id})" class="ui-icon-btn" title="Archivieren" aria-label="Archivieren">🗄️</button>`;
            // Kartenmuster: Kategorie als Bild, Titel, Kategorie und Datum, Chips, Aktionen rechts
            return `
                <div class="box ui-mail${m.read ? ' ui-mail-gelesen' : ''}" style="border-left-color:${m.important ? 'var(--gold)' : meta.color}; cursor:pointer;" onclick="markInboxRead(${m.id})">
                    ${renderUiCard({
                        thumb: `<span class="ui-thumb-icon" style="background:color-mix(in srgb, ${meta.color} 16%, transparent); border-color:color-mix(in srgb, ${meta.color} 40%, transparent);">${meta.icon}</span>`,
                        title: `<span style="color:${meta.color};">${m.title}</span>`,
                        sub: `${meta.label} · SpT ${m.matchday} · Saison ${m.season}`,
                        meta: [m.read ? '' : uiChip('● Neu', 'gut'), m.important ? uiChip('★ Wichtig', 'warn') : ''],
                        aside: `<span class="ui-icon-row">
                            <button onclick="event.stopPropagation(); toggleInboxImportant(${m.id})" class="ui-icon-btn" style="color:${m.important ? 'var(--gold)' : 'var(--text-muted)'};" title="Als wichtig markieren" aria-label="Als wichtig markieren">${m.important ? '★' : '☆'}</button>
                            ${archiveBtn}
                            <button onclick="event.stopPropagation(); deleteInboxMessage(${m.id})" class="ui-icon-btn" title="Löschen" aria-label="Löschen">🗑️</button>
                        </span>`,
                        body: m.body,
                        actions: linkBtn
                    })}
                </div>`;
        }).join('');
    }

    // Auswahl: ein Tipp auf die Mail wählt sie aus, statt sie zu öffnen oder zu markieren.
    function renderInboxAuswahlKarte(m) {
        let meta = INBOX_CATEGORY_META[m.category] || { icon: '📌', color: 'var(--accent)', label: 'Info' };
        let an = inboxAuswahl.has(m.id);
        return `
            <div class="box ui-mail${m.read ? ' ui-mail-gelesen' : ''}${an ? ' ui-mail-auswahl' : ''}" role="checkbox" aria-checked="${an}" tabindex="0" style="border-left-color:${an ? 'var(--danger)' : meta.color}; cursor:pointer;" onclick="toggleInboxAuswahl(${m.id})" onkeydown="if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggleInboxAuswahl(${m.id}); }">
                ${renderUiCard({
                    thumb: `<span class="ui-thumb-icon" style="background:color-mix(in srgb, ${an ? 'var(--danger)' : meta.color} 16%, transparent); border-color:color-mix(in srgb, ${an ? 'var(--danger)' : meta.color} 40%, transparent);">${an ? '☑' : '☐'}</span>`,
                    title: `<span style="color:${meta.color};">${m.title}</span>`,
                    sub: `${meta.label} · SpT ${m.matchday} · Saison ${m.season}`,
                    meta: [an ? uiChip('🗑️ Ausgewählt', 'schlecht') : '', m.important ? uiChip('★ Wichtig', 'warn') : '']
                })}
            </div>`;
    }

