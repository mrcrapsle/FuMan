    // ==========================================
    // POSTFACH: zentrales Nachrichtensystem für Transferangebote, Verletzungen,
    // auslaufende Verträge, Finanzwarnungen, Scouting-Ergebnisse & Spielanalysen.
    // Ergänzt die bestehenden Toasts (die bleiben für sofortiges Feedback), gibt aber
    // zusätzlich eine durchsuchbare, dauerhafte Übersicht wie in der Referenz-App.
    // ==========================================
    let inboxMessages = [];
    let inboxArchive = [];
    let inboxFilter = 'alle';
    const MAX_INBOX_MESSAGES = 80;

    function addInboxMessage(category, title, body, screenLink) {
        inboxMessages.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
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
        ['alle', 'wichtig', 'transfer', 'verletzung', 'finanzen', 'scouting', 'archiv'].forEach(c => {
            let btn = document.getElementById('inbox-filter-' + c);
            if (btn) btn.className = (c === cat) ? 'btn-action' : 'btn-secondary';
            if (btn) btn.style.fontSize = '9px';
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

    // Wichtig-Markierung (NEU): wichtige Nachrichten werden nicht automatisch gelöscht,
    // wenn das Postfach voll wird, und lassen sich per eigenem Filter isoliert ansehen.
    function toggleInboxImportant(id) {
        let m = inboxMessages.find(x => x.id === id) || inboxArchive.find(x => x.id === id);
        if (m) { m.important = !m.important; renderInboxView(); }
    }

    // Nachrichten-Archiv (NEU): statt endgültig zu löschen, wandern Nachrichten ins Archiv
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
    function deleteInboxMessage(id) {
        inboxMessages = inboxMessages.filter(m => m.id !== id);
        inboxArchive = inboxArchive.filter(m => m.id !== id);
        renderInboxView(); updateUI();
    }

    const INBOX_CATEGORY_META = {
        transfer: { icon: '🤝', color: 'var(--blue)' },
        verletzung: { icon: '🩹', color: 'var(--danger)' },
        finanzen: { icon: '💰', color: 'var(--accent)' },
        scouting: { icon: '🔭', color: 'var(--teal)' },
        analyse: { icon: '📋', color: 'var(--violet)' },
        vertrag: { icon: '📄', color: 'var(--purple)' }
    };

    function renderInboxView() {
        let list = document.getElementById('inbox-messages-list');
        if (!list) return;
        let source = inboxFilter === 'archiv' ? inboxArchive : inboxMessages;
        let filtered = inboxFilter === 'alle' ? inboxMessages
            : inboxFilter === 'wichtig' ? inboxMessages.filter(m => m.important)
            : inboxFilter === 'archiv' ? inboxArchive
            : inboxMessages.filter(m => m.category === inboxFilter);
        // Wichtige Nachrichten immer zuerst anzeigen (außer im Archiv-Filter).
        if (inboxFilter !== 'archiv') filtered = [...filtered].sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0));
        let unreadTotal = inboxMessages.filter(m => !m.read).length;
        let summaryEl = document.getElementById('inbox-unread-summary');
        if (summaryEl) summaryEl.innerText = unreadTotal > 0 ? ` — ${unreadTotal} ungelesen` : ' — alles gelesen';

        if (filtered.length === 0) {
            list.innerHTML = `<div class="box" style="font-size:10px; color:#64748b;">${inboxFilter === 'archiv' ? 'Archiv ist leer.' : 'Keine Nachrichten in dieser Kategorie.'}</div>`;
            return;
        }
        let isArchiveView = inboxFilter === 'archiv';
        list.innerHTML = filtered.map(m => {
            let meta = INBOX_CATEGORY_META[m.category] || { icon: '📌', color: 'var(--accent)' };
            let linkBtn = m.screenLink ? `<button onclick="markInboxRead(${m.id}); showScreen('${m.screenLink}')" class="btn-secondary" style="font-size:9px; width:auto; margin-top:4px;">Ansehen →</button>` : '';
            let archiveBtn = isArchiveView
                ? `<button onclick="event.stopPropagation(); restoreInboxMessage(${m.id})" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:11px; padding:0 2px;" title="Wiederherstellen">↺</button>`
                : `<button onclick="event.stopPropagation(); archiveInboxMessage(${m.id})" style="background:none; border:none; color:#64748b; cursor:pointer; font-size:11px; padding:0 2px;" title="Archivieren">🗄️</button>`;
            return `
                <div class="box" style="border-left-color:${m.important ? 'var(--gold)' : meta.color}; ${m.read ? 'opacity:0.6;' : ''} cursor:pointer;" onclick="markInboxRead(${m.id})">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <strong style="color:${meta.color};">${meta.icon} ${m.title}</strong>
                        <span>
                            <button onclick="event.stopPropagation(); toggleInboxImportant(${m.id})" style="background:none; border:none; color:${m.important ? 'var(--gold)' : '#64748b'}; cursor:pointer; font-size:12px; padding:0 2px;" title="Als wichtig markieren">${m.important ? '★' : '☆'}</button>
                            ${archiveBtn}
                            <button onclick="event.stopPropagation(); deleteInboxMessage(${m.id})" style="background:none; border:none; color:#64748b; cursor:pointer; font-size:11px; padding:0 2px;" title="Endgültig löschen">✕</button>
                        </span>
                    </div>
                    <div style="font-size:10px; margin-top:3px;">${m.body}</div>
                    <div style="font-size:8px; color:#64748b; margin-top:4px;">Saison ${m.season} · Spieltag ${m.matchday}/34 ${m.read ? '' : ' · <span style="color:var(--primary);">● Neu</span>'}</div>
                    ${linkBtn}
                </div>`;
        }).join('');
    }
