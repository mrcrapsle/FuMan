
    // Zwei-Klick-Bestätigung für folgenreiche, nicht umkehrbare Aktionen (Verkaufen,
    // Entlassen, Jugendspieler hochziehen). Bewusst KEIN window.confirm(): native Dialoge
    // werden in manchen Android-WebViews unterdrückt - die Rückfrage wäre dort unsichtbar
    // und die Aktion liefe entweder ungefragt durch oder gar nicht (dieselbe Falle, die den
    // Fabrikbau wirkungslos wirken ließ).
    //
    // Aufruf am Anfang der Aktion:  if (!requireConfirm(btn, 'Wirklich verkaufen?')) return;
    // Der erste Klick färbt den Knopf und stellt die Frage, der zweite führt aus. Ohne
    // zweiten Klick fällt der Knopf nach wenigen Sekunden von selbst zurück.
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

