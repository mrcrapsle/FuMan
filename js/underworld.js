
    function renderUnderworldView() {
        document.getElementById('uw-pressure').innerText = underworld.pressure + '%';
        let acts = [];
        if (underworld.activeSabotages.pyroHotel) acts.push("🧨 Hotel-Feuerwerk");
        if (underworld.activeSabotages.stealBanner) acts.push("🏴‍☠️ Zaunfahne geklaut");
        if (underworld.activeSabotages.weedKiller) acts.push("🧪 Rasen-Sabotage");
        if (underworld.activeSabotages.refBribe) acts.push("⌚ Rolex für Schiedsrichter");
        if (underworld.activeSabotages.bribeOpponent) acts.push("💰 Gegenspieler geschmiert");
        if (underworld.activeSabotages.doping) acts.push("☠️ Dopingmittel im Umlauf");
        document.getElementById('uw-active-tricks').innerText = acts.length > 0 ? acts.join(' | ') : 'Keine';

        let offenseEl = document.getElementById('uw-offense-count');
        if (offenseEl) offenseEl.innerText = underworld.offenseCount || 0;

        const btnMap = {
            pyroHotel: 'btn-uw-pyro',
            stealBanner: 'btn-uw-banner',
            weedKiller: 'btn-uw-weed',
            refBribe: 'btn-uw-ref',
            bribeOpponent: 'btn-uw-bribe',
            doping: 'btn-uw-doping'
        };
        for (let k in btnMap) {
            let b = document.getElementById(btnMap[k]);
            if (b) {
                b.style.borderColor = underworld.activeSabotages[k] ? 'var(--primary)' : '#334155';
                b.style.color = underworld.activeSabotages[k] ? 'var(--primary)' : 'var(--accent)';
            }
        }

        let spyBtn = document.getElementById('btn-uw-spy');
        if (spyBtn) spyBtn.innerText = underworld.spyIntelActive ? '🕵️ Insider-Info aktiv fürs nächste Spiel ✓' : '🕵️ Spionage beim Gegner [15.000 €]';
        let betBtn = document.getElementById('btn-uw-insiderbet');
        if (betBtn) {
            let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
            let stakePreview = Math.round(10000 * scale * 4 / 1000) * 1000;
            betBtn.innerText = underworld.insiderBetActive ? '💰 Insider-Wette läuft bereits ✓' : `💰 Insider-Wett-Coup [${formatVal(stakePreview)} Einsatz]`;
        }
    }

    function buyUnderworldAction(type, cost, press) {
        if (underworld.activeSabotages[type]) {
            showToast('Diese Aktion läuft bereits für das nächste Spiel.', 'error', 4000);
            return;
        }
        if (game.money < cost) { showToast(`Nicht genug Schwarzgeld: ${formatVal(cost)} nötig, ${formatVal(game.money)} vorhanden.`, 'error', 4500); return; }
        playSound('whistle');
        game.money -= cost;
        underworld.activeSabotages[type] = true;
        underworld.pressure = Math.min(100, underworld.pressure + press);
        if (type === 'stealBanner') game.fans = 100;
        renderUnderworldView();
        updateUI();
        let dangerNote = underworld.pressure >= 70 ? "\n⚠️ WARNUNG: Der Ermittlungsdruck ist alarmierend hoch. Eine Razzia steht kurz bevor!" : "";
        showNotice('🕵️ Operation eingefädelt', `Im Schatten der Nacht wurde alles vorbereitet. Die Sache wirkt im nächsten Pflichtspiel.\n\nErmittlungsdruck: ${underworld.pressure}%.${dangerNote}`, { typ: 'warn' });
    }

    function hireUnderworldLawyer() {
        if (game.money < 20000) { showToast(`Dr. Gauner verlangt 20.000 € Schweigegeld - vorhanden sind ${formatVal(game.money)}.`, 'error', 4500); return; }
        playSound('click');
        game.money -= 20000;
        underworld.pressure = Math.max(0, underworld.pressure - 40);
        renderUnderworldView();
        updateUI();
        showNotice('🛡️ Beweise verschwunden', 'Dr. Gauner hat unter fragwürdigen Umständen Beweise verschwinden lassen. Der Ermittlungsdruck sinkt um 40 Prozentpunkte - für den Moment.', { typ: 'warn' });
    }

    // ---------- NEUE UNTERWELT-AKTIONEN ----------

    // Spionage beim Gegner: kauft vorab Insider-Informationen zur gegnerischen Aufstellungs-
    // Tendenz - wirkt sich auf den ohnehin vorhandenen Videoanalyse-Bericht vorm nächsten
    // Spiel aus (siehe renderPreMatchAnalysis() in match.js), diesmal aber garantiert statt
    // zufällig, da die Infos direkt "besorgt" wurden.
    function buyUnderworldSpyIntel() {
        let cost = 15000;
        if (underworld.spyIntelActive) { showToast('Die Spionage-Infos für das nächste Spiel liegen bereits vor.', 'error', 4000); return; }
        if (game.money < cost) { showToast(`Der Informant verlangt ${formatVal(cost)} - vorhanden sind ${formatVal(game.money)}.`, 'error', 4500); return; }
        playSound('whistle');
        game.money -= cost;
        underworld.spyIntelActive = true;
        underworld.pressure = Math.min(100, underworld.pressure + 8);
        renderUnderworldView();
        updateUI();
        showNotice('🕵️ Informant angeworben', `Ein Informant im gegnerischen Verein liefert exklusive Details fürs nächste Spiel - die Videoanalyse vor dem Anpfiff fällt dadurch besonders präzise aus.\n\nErmittlungsdruck: ${underworld.pressure}%.`, { typ: 'warn' });
    }

    // Schweigegeld direkt zahlen: gezielte Schadensbegrenzung, wenn eine bestimmte
    // Enthüllung droht - günstiger als der Anwalt, dafür mit geringerer Wirkung.
    function payUnderworldHushMoney() {
        let cost = 8000;
        if (game.money < cost) { showToast(`Schweigegeld nicht gedeckt: ${formatVal(cost)} nötig, ${formatVal(game.money)} vorhanden.`, 'error', 4500); return; }
        if (underworld.pressure <= 0) { showToast('Aktuell besteht kein Ermittlungsdruck, den es zu besänftigen lohnt.', 'error', 4000); return; }
        playSound('click');
        game.money -= cost;
        underworld.pressure = Math.max(0, underworld.pressure - 15);
        renderUnderworldView();
        updateUI();
        showToast(`🤫 Ein diskretes Kuvert wechselt den Besitzer - der Ermittlungsdruck sinkt auf ${underworld.pressure}%.`, 'success', 5000);
    }

    // Insider-Wett-Coup: über Unterwelt-Kanäle wird heimlich auf den eigenen Sieg im
    // nächsten Spiel gewettet - bei Sieg eine deutliche Zusatzauszahlung, bei Nichtantreten
    // des erwarteten Ergebnisses verpufft der Einsatz ohne weitere Konsequenz (im Gegensatz
    // zu den offenen Sabotage-Aktionen gibt's hier kein zusätzliches Entdeckungsrisiko, dafür
    // ist der Gewinn geringer als bei echter Spielmanipulation).
    function placeUnderworldInsiderBet() {
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let stake = Math.round(10000 * scale * 4 / 1000) * 1000;
        if (underworld.insiderBetActive) { showToast('Für das nächste Spiel liegt bereits eine Insider-Wette vor.', 'error', 4000); return; }
        if (game.money < stake) { showToast(`Einsatz nicht gedeckt: ${formatVal(stake)} nötig, ${formatVal(game.money)} vorhanden.`, 'error', 4500); return; }
        playSound('click');
        game.money -= stake;
        underworld.insiderBetActive = true;
        underworld.insiderBetStake = stake;
        renderUnderworldView();
        updateUI();
        showNotice('💰 Insider-Wette platziert', `${formatVal(stake)} sind heimlich auf den eigenen Sieg im nächsten Spiel gesetzt.\n\nBei einem Sieg kommt die dreifache Summe zurück - ohne zusätzliches Entdeckungsrisiko.`, { typ: 'warn' });
    }

    // Löst die Insider-Wette nach dem Spiel auf - wird aus applyMatchdayFinances() (match.js)
    // aufgerufen, sobald das Ergebnis feststeht.
    function resolveUnderworldInsiderBet(won) {
        if (!underworld.insiderBetActive) return;
        underworld.insiderBetActive = false;
        if (won) {
            // Bugfix: Auszahlung war bisher unabhängig vom tatsächlichen (jetzt liga-
            // skalierten) Einsatz fix bei 30.000 € - jetzt konsistent das Dreifache des
            // tatsächlich eingesetzten Betrags.
            let payout = (underworld.insiderBetStake || 10000) * 3;
            game.money += payout;
            addInboxMessage('vertrag', '💰 Insider-Wett-Coup ausgezahlt!', `Der heimliche Sieg-Tipp ging auf - ${formatVal(payout)} sind soeben über obskure Kanäle auf dem Vereinskonto eingegangen.`, 'screen-underworld');
        } else {
            addInboxMessage('vertrag', '📉 Insider-Wette verpufft', 'Ohne Sieg gab es diesmal keine Auszahlung auf die heimliche Wette - der Einsatz ist verloren.', 'screen-underworld');
        }
    }

