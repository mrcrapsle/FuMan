
    // Zwei-Klick-Bestätigung für folgenreiche, nicht umkehrbare Aktionen (Verkaufen,
    // Entlassen, Jugendspieler hochziehen). Bewusst KEIN window.confirm(): native Dialoge
    // werden in manchen Android-WebViews unterdrückt - die Rückfrage wäre dort unsichtbar
    // und die Aktion liefe entweder ungefragt durch oder gar nicht (dieselbe Falle, die den
    // Fabrikbau wirkungslos wirken ließ).
    //
    // Aufruf am Anfang der Aktion:  if (!requireConfirm(btn, 'Wirklich verkaufen?')) return;
    // Der erste Klick färbt den Knopf und stellt die Frage, der zweite führt aus. Ohne
    // zweiten Klick fällt der Knopf nach wenigen Sekunden von selbst zurück.
    // ==========================================
    // MELDUNGSFENSTER STATT alert()
    // ==========================================
    // alert() wird in manchen Android-WebViews unterdrueckt. Bei reinen Fehlermeldungen
    // reicht ein Toast, bei WICHTIGEN Ereignissen aber nicht: die Entlassung durch den
    // Vorstand etwa zeigte ihren Text per alert() und lud danach sofort die Seite neu -
    // wurde der Dialog unterdrueckt, war der Verein ohne ein Wort der Erklaerung weg.
    // showNotice() ist ein Meldungsfenster in der Seite selbst, das bestaetigt werden muss
    // und erst danach weiterlaeuft.
    //
    // Anders als alert() blockiert es nicht. Waehrend einer durchsimulierten Saison koennen
    // mehrere Meldungen zusammenkommen - die werden deshalb in einer Schlange gesammelt und
    // nacheinander gezeigt, statt sich gegenseitig zu ueberschreiben.
    let noticeQueue = [];
    let noticeActive = false;

    function showNotice(titel, text, optionen = {}) {
        noticeQueue.push({ titel, text, ...optionen });
        if (noticeQueue.length > 12) noticeQueue.splice(0, noticeQueue.length - 12);
        // Auch wenn schon eine Meldung offen ist, neu zeichnen: sonst bliebe der Hinweis
        // "noch N weitere Meldungen" auf dem Stand von vorhin stehen.
        renderNextNotice();
    }

    function renderNextNotice() {
        let box = document.getElementById('app-notice');
        if (!box) {
            // Ohne Container (z.B. sehr frueh beim Start) darf nichts verlorengehen:
            // dann wenigstens als Toast, und die Folgeaktion trotzdem ausfuehren.
            let n = noticeQueue.shift();
            if (n) {
                if (typeof showToast === 'function') showToast(`${n.titel}: ${n.text}`, n.typ === 'warn' ? 'error' : 'success', 6000);
                if (typeof n.danach === 'function') n.danach();
            }
            noticeActive = noticeQueue.length > 0;
            if (noticeActive) renderNextNotice();
            return;
        }
        if (noticeQueue.length === 0) {
            noticeActive = false;
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        noticeActive = true;
        let n = noticeQueue[0];
        box.style.display = 'flex';
        box.innerHTML = `
            <div class="app-notice-card${n.typ === 'warn' ? ' app-notice-warn' : ''}">
                <div class="app-notice-title">${n.titel}</div>
                <div class="app-notice-text">${String(n.text).replace(/\n/g, '<br>')}</div>
                <button onclick="dismissNotice()" class="${n.typ === 'warn' ? 'btn-danger' : 'btn-action'}">${n.knopf || 'Verstanden'}</button>
                ${noticeQueue.length > 1 ? `<div class="app-notice-count">Noch ${noticeQueue.length - 1} weitere Meldung${noticeQueue.length - 1 === 1 ? '' : 'en'}</div>` : ''}
            </div>`;
    }

    function dismissNotice() {
        let n = noticeQueue.shift();
        if (typeof playSound === 'function') playSound('click');
        // Die Folgeaktion laeuft NACH dem Schliessen - bei der Entlassung haengt daran der
        // Neustart, der vorher ungefragt sofort passierte.
        if (n && typeof n.danach === 'function') n.danach();
        renderNextNotice();
    }

    const confirmTimers = new WeakMap();
    function requireConfirm(btn, frage, dauerMs = 3500) {
        if (!btn || !btn.dataset) return true;   // ohne Knopf-Kontext nicht blockieren
        if (btn.dataset.confirming === 'true') {
            clearTimeout(confirmTimers.get(btn));
            btn.dataset.confirming = 'false';
            if (btn.dataset.confirmOriginal !== undefined) btn.innerHTML = btn.dataset.confirmOriginal;
            btn.style.background = btn.dataset.confirmOrigBg || '';
            btn.style.color = btn.dataset.confirmOrigColor || '';
            return true;
        }
        btn.dataset.confirming = 'true';
        btn.dataset.confirmOriginal = btn.innerHTML;
        btn.dataset.confirmOrigBg = btn.style.background;
        btn.dataset.confirmOrigColor = btn.style.color;
        btn.innerHTML = frage;
        btn.style.background = 'linear-gradient(135deg, #c73545, #a82838)';
        btn.style.color = '#fff';
        confirmTimers.set(btn, setTimeout(() => {
            if (btn.isConnected && btn.dataset.confirming === 'true') {
                btn.dataset.confirming = 'false';
                btn.innerHTML = btn.dataset.confirmOriginal;
                btn.style.background = btn.dataset.confirmOrigBg || '';
                btn.style.color = btn.dataset.confirmOrigColor || '';
            }
        }, dauerMs));
        return false;
    }

    function formatVal(val) {
        if (Math.abs(val) >= 1000000) {
            return (val / 1000000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Mio. €';
        }
        return (val || 0).toLocaleString('de-DE') + ' €';
    }

    // ==========================================
    // TOR-SIMULATION (erwartete Tore, Poisson-verteilt)
    // ==========================================
    // Erzeugt eine realistische, ganzzahlige Torzahl um einen Erwartungswert (lambda) herum,
    // statt eines reinen Zufallswerts. So schwankt die Anzahl der Tore glaubwürdig,
    // bleibt aber im statistischen Mittel beim erwarteten Wert.
    function poissonRandom(lambda) {
        if (lambda <= 0) return 0;
        let L = Math.exp(-lambda), k = 0, p = 1;
        do { k++; p *= Math.random(); } while (p > L);
        return k - 1;
    }

    // Berechnet erwartete Tore für beide Teams basierend auf dem Stärkeunterschied.
    // Wichtig: Die Torerwartung des schwächeren Teams SINKT mit wachsendem Rückstand
    // (statt wie zuvor konstant bei einem Zufalls-Sockel zu bleiben) - so schlägt sich
    // eine starke Verteidigung/Torwart auch tatsächlich in weniger Gegentoren nieder.
    function simulateGoals(myStr, oppStr, myTeam = null, oppTeam = null) {
        let diff = myStr - oppStr;
        let myXg = Math.max(0.15, Math.min(5.5, 1.35 + diff * 0.045));
        let oppXg = Math.max(0.15, Math.min(5.5, 1.35 - diff * 0.045));
        // Gegner-Identität (NEU): Offensiv-/Defensiv-/Konter-Spielstile verschieben die
        // erwarteten Tore beider Teams tatsächlich, statt dass jedes KI-Team bis auf seine
        // Stärke identisch spielt.
        if (myTeam) {
            let style = getTeamPlaystyle(myTeam);
            myXg *= (1 + style.goalBonus);
            oppXg *= (1 - style.concedeBonus);
        }
        if (oppTeam) {
            let style = getTeamPlaystyle(oppTeam);
            oppXg *= (1 + style.goalBonus);
            myXg *= (1 - style.concedeBonus);
        }
        myXg = Math.max(0.1, myXg);
        oppXg = Math.max(0.1, oppXg);
        return { myGoals: poissonRandom(myXg), oppGoals: poissonRandom(oppXg) };
    }

