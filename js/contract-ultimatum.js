
    // (aus match.js ausgelagert - reine Datei-Organisation, keine Verhaltensänderung)
    // ---------- VERTRAGS-ULTIMATUM UNZUFRIEDENER STARS ----------
    // Ein sehr starker, aber unzufriedener Spieler stellt ein Ultimatum: neuer Vertrag oder
    // Verkauf. Statt einer sofortigen Entscheidung im blockierenden Modal gibt es jetzt eine
    // Frist von 3 Spieltagen mit Erinnerungen - mehr taktischer Spielraum, aber echte
    // Konsequenzen, wenn man es einfach aussitzt.
    function checkContractUltimatum() {
        if (game.activeUltimatumPlayerId) return;
        let candidates = squad.filter(p => p.strength >= 75 && p.morale < 35 && p.contracts <= 2);
        if (candidates.length === 0) return;
        // "Spielerberater-Kontakt"-Perk halbiert die Eskalationswahrscheinlichkeit insgesamt.
        let triggerChance = managerRPG.perks.playerCare ? 0.075 : 0.15;
        if (Math.random() > triggerChance) return;
        let p = candidates[Math.floor(Math.random() * candidates.length)];
        // Ein Berater vermittelt oft frühzeitig und verhindert die offene Eskalation - bei
        // Spielern mit Berater greift eine zusätzliche Chance, dass es gar nicht erst zum
        // öffentlichen Ultimatum kommt (stattdessen eine stille, provisionspflichtige Lösung).
        if (p.agent && Math.random() < 0.5) {
            let commission = Math.max(1500, Math.round(p.marketValue * 0.03));
            if (game.money >= commission) {
                game.money -= commission;
                p.morale = Math.min(100, p.morale + 20);
                game.ultimatumHistory.agentPreEmpted = (game.ultimatumHistory.agentPreEmpted || 0) + 1;
                addInboxMessage('vertrag', `🕴️ Berater vermittelt: ${p.name} beruhigt`, `${p.agent.name} hat frühzeitig vermittelt, bevor es zur offenen Eskalation kam - für ${formatVal(commission)} Provision ist ${p.name} vorerst wieder zufrieden.`, 'screen-squad');
                showToast(`🕴️ Berater von ${p.name} hat vermittelt (${formatVal(commission)})!`, 'success');
                return;
            }
        }
        // Wiederholungstäter: wer schon einmal ein Ultimatum gestellt hat, eskaliert beim
        // nächsten Mal schneller und härter - kürzere Frist, weniger Geduld.
        let repeatCount = p.ultimatumCount || 0;
        let deadlineSpan = Math.max(1, 3 - repeatCount);
        game.activeUltimatumPlayerId = p.id;
        game.ultimatumDeadlineMatchday = game.matchday + deadlineSpan;
        game.ultimatumReminderSent = false;
        game.ultimatumExtensionUsed = false;
        game.ultimatumPressLeakOccurred = false;
        let repeatNote = repeatCount > 0 ? ` Da dies bereits das ${repeatCount + 1}. Mal ist, bleibt diesmal weniger Zeit (${deadlineSpan} statt 3 Spieltage)!` : '';
        addInboxMessage('vertrag', `⚠️ Ultimatum von ${p.name}!`, `${p.name} fordert einen neuen Vertrag oder Verkauf - du hast bis Spieltag ${game.ultimatumDeadlineMatchday} Zeit, dich zu entscheiden.${repeatNote}`, 'screen-squad');
        showToast(`⚠️ ${p.name} stellt ein Ultimatum! Frist: Spieltag ${game.ultimatumDeadlineMatchday}`, 'error');
    }

    // Vorschuss-Zahlung zur einmaligen Fristverlängerung (+2 Spieltage) - hilfreich, wenn
    // man gerade knapp bei Kasse ist und noch etwas Zeit braucht, um das Geld für einen
    // neuen Vertrag zusammenzubekommen.
    function extendUltimatumDeadline() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p || game.ultimatumExtensionUsed) return;
        let advanceFee = Math.max(1000, Math.round(p.wage * 2));
        if (game.money < advanceFee) { showToast(`Nicht genug Geld für den Vorschuss! Benötigt: ${formatVal(advanceFee)}`, 'error'); return; }
        game.money -= advanceFee;
        game.ultimatumDeadlineMatchday += 2;
        game.ultimatumExtensionUsed = true;
        game.ultimatumReminderSent = false;
        addInboxMessage('vertrag', `⏳ Frist verlängert (Vorschuss an ${p.name})`, `${formatVal(advanceFee)} Vorschuss gezahlt - die Frist läuft jetzt bis Spieltag ${game.ultimatumDeadlineMatchday}.`, 'screen-squad');
        showToast(`⏳ Frist um 2 Spieltage verlängert (${formatVal(advanceFee)})!`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        updateUI();
    }

    // Wird jeden Spieltag aufgerufen (siehe processPostMatchRoutine): erinnert einmalig kurz
    // vor Ablauf und bestraft konsequent, wenn die Frist ungenutzt verstreicht.
    function tickContractUltimatum() {
        if (!game.activeUltimatumPlayerId) return;
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) { game.activeUltimatumPlayerId = null; return; } // Spieler ist anderweitig weg (z.B. verkauft)

        let remaining = game.ultimatumDeadlineMatchday - game.matchday;
        // Öffentliche Spieler-Forderung an die Presse (NEU): geht die Frist zäh voran, kann
        // der Spieler von sich aus an die Presse gehen - erhöht den Druck auf den Vorstand,
        // bringt dem Spieler aber gleichzeitig Sympathie bei den eigenen Fans ein, die sein
        // offenes Wort oft nachvollziehen können.
        if (!game.ultimatumPressLeakOccurred && remaining <= 2 && remaining >= 1 && Math.random() < 0.2) {
            game.ultimatumPressLeakOccurred = true;
            game.boardSat = Math.max(1, game.boardSat - 4);
            game.fans = Math.min(100, game.fans + 3);
            addInboxMessage('vertrag', `📰 ${p.name} geht an die Presse!`, `${p.name} hat sein Ultimatum öffentlich gemacht - die Presse berichtet ausführlich. Der Vorstand ist verärgert über die Eskalation, viele Fans zeigen aber Verständnis für die Offenheit.`, 'screen-squad');
            showToast(`📰 ${p.name} hat das Ultimatum öffentlich gemacht!`, 'error');
        }
        if (remaining === 1 && !game.ultimatumReminderSent) {
            game.ultimatumReminderSent = true;
            addInboxMessage('vertrag', `⏰ Ultimatum läuft bald ab!`, `Nur noch 1 Spieltag, um auf das Ultimatum von ${p.name} zu reagieren!`, 'screen-squad');
            showToast(`⏰ Ultimatum von ${p.name} läuft nächsten Spieltag ab!`, 'error');
        }
        if (game.matchday >= game.ultimatumDeadlineMatchday) {
            // Frist verstrichen ohne Reaktion: deutliche, dauerhafte Konsequenz statt eines
            // risikofreien Ignorierens. Zählt in der Karrierestatistik genauso als
            // "ignoriert" wie das explizite Klicken auf den Ignorieren-Button - bisher wurde
            // das passive Verstreichenlassen dort gar nicht mitgezählt.
            game.ultimatumHistory.ignored = (game.ultimatumHistory.ignored || 0) + 1;
            p.morale = Math.max(5, p.morale - 25);
            game.boardSat = Math.max(1, game.boardSat - 5);
            addInboxMessage('vertrag', `😡 Ultimatum verstrichen: ${p.name} tief verärgert!`, `Die Frist ist ungenutzt verstrichen - ${p.name} ist nun offen unzufrieden, die Stimmung im Kader leidet.`, 'screen-squad');
            showToast(`😡 Ultimatum-Frist von ${p.name} verstrichen - Moral eingebrochen!`, 'error');
            game.activeUltimatumPlayerId = null;
            game.ultimatumDeadlineMatchday = null;
        }
    }

    // Nochmal-Chance (Krisenmanager-Perk, NEU): einmal pro Saison lässt sich ein aktives
    // Ultimatum kostenlos und ohne Konsequenzen besänftigen - der Manager nutzt seine
    // Erfahrung, um in letzter Minute doch noch eine gütliche Einigung zu finden.
    function resolveUltimatumSecondChance() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p || !managerRPG.perks.secondChance || game.secondChanceUsedSeason === game.season) return;
        p.morale = Math.min(100, p.morale + 25);
        game.secondChanceUsedSeason = game.season;
        game.activeUltimatumPlayerId = null;
        document.getElementById('ultimatum-overlay').classList.remove('show');
        showToast(`🕊️ Nochmal-Chance genutzt: Das Ultimatum von ${p.name} ist besänftigt - kostenlos!`, 'success');
        renderSquadView();
        updateUI();
    }

    function resolveUltimatumRenew() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) return;
        // Wiederholungstäter fordern beim erneuten Ultimatum auch höhere Ablösen für die
        // Vertragsverlängerung - die Geduld nutzt sich spürbar ab.
        // Eskalationskappung: die Ablöseforderung steigt mit jedem Wiederholungsfall, aber
        // nicht endlos - ab dem 2,5-fachen ist Schluss, damit ein Vielfach-Wiederholungstäter
        // nicht zu einem unbezahlbaren Betrag führt.
        let repeatMult = Math.min(2.5, 1 + (p.ultimatumCount || 0) * 0.4);
        let fee = Math.max(3000, Math.round(p.marketValue * 0.15 * repeatMult));
        if (game.money < fee) { showToast(`Nicht genug Geld! Benötigt: ${formatVal(fee)}`, 'error'); return; }
        game.money -= fee;
        p.contracts += 2;
        p.morale = Math.min(100, p.morale + 30);
        p.ultimatumCount = (p.ultimatumCount || 0) + 1;
        game.ultimatumHistory.renewed = (game.ultimatumHistory.renewed || 0) + 1;
        addInboxMessage('vertrag', `✅ Ultimatum gelöst: ${p.name} bleibt!`, `Der neue Vertrag (${formatVal(fee)}) besänftigt ${p.name} spürbar - Moral deutlich verbessert.`, 'screen-squad');
        showToast(`✅ ${p.name} hat einen neuen Vertrag unterschrieben!`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }
    function resolveUltimatumSell() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) return;
        let sum = Math.round(p.marketValue * 0.75);
        game.money += sum;
        if (typeof checkFriendshipDeparture === 'function') checkFriendshipDeparture(p);
        squad = squad.filter(x => x.id !== p.id);
        lineup = lineup.filter(id => id !== p.id);
        game.ultimatumHistory.sold = (game.ultimatumHistory.sold || 0) + 1;
        addInboxMessage('vertrag', `💰 Ultimatum gelöst: ${p.name} verkauft`, `Um weiteren Unmut zu vermeiden, wurde ${p.name} für ${formatVal(sum)} abgegeben (unter Marktwert wegen der angespannten Situation).`, 'screen-squad');
        showToast(`💰 ${p.name} für ${formatVal(sum)} verkauft.`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }
    function resolveUltimatumIgnore() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (p) {
            p.morale = Math.max(5, p.morale - 15);
            game.ultimatumHistory.ignored = (game.ultimatumHistory.ignored || 0) + 1;
            addInboxMessage('vertrag', `😠 Ultimatum ignoriert: ${p.name} verärgert`, `${p.name} ist sichtlich verärgert über die fehlende Reaktion - die Moral sinkt weiter.`, 'screen-squad');
        }
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }
    // Öffnet das Entscheidungs-Modal bei Bedarf jederzeit während der Frist (statt
    // erzwungen sofort) - aufrufbar über den Hinweis-Banner im Kader-Screen.
    function resolveUltimatumViaAgent() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p || !p.agent) return;
        let commission = Math.max(2000, Math.round(p.marketValue * 0.06));
        if (game.money < commission) { showToast(`Nicht genug Geld! Beraterprovision: ${formatVal(commission)}`, 'error'); return; }
        game.money -= commission;
        p.morale = Math.min(100, p.morale + 22);
        game.ultimatumHistory.renewed = (game.ultimatumHistory.renewed || 0) + 1;
        game.ultimatumHistory.agentMediated = (game.ultimatumHistory.agentMediated || 0) + 1;
        addInboxMessage('vertrag', `🕴️ Ultimatum über Berater gelöst: ${p.name}`, `${p.agent.name} hat für ${formatVal(commission)} Provision vermittelt - ${p.name} ist wieder zufrieden, ganz ohne neuen Vertrag.`, 'screen-squad');
        showToast(`🕴️ Ultimatum über Berater gelöst (${formatVal(commission)})!`, 'success');
        document.getElementById('ultimatum-overlay').classList.remove('show');
        game.activeUltimatumPlayerId = null;
        game.ultimatumDeadlineMatchday = null;
        updateUI();
    }

    function openUltimatumModal() {
        let p = squad.find(x => x.id === game.activeUltimatumPlayerId);
        if (!p) return;
        document.getElementById('ultimatum-player-name').innerText = p.name;
        let ultAvatarBox = document.getElementById('ultimatum-player-avatar');
        if (ultAvatarBox) ultAvatarBox.innerHTML = (typeof getPlayerAvatarSVG === 'function') ? getPlayerAvatarSVG(p, 64) : '';
        document.getElementById('ultimatum-player-info').innerText = `Stärke ${p.strength} · Moral ${p.morale}% · Restvertrag: ${p.contracts} Jahr(e) · Frist: Spieltag ${game.ultimatumDeadlineMatchday}${(p.ultimatumCount || 0) > 0 ? ` · ⚠️ ${p.ultimatumCount}. Ultimatum` : ''}`;
        let agentBtn = document.getElementById('btn-ultimatum-agent');
        if (agentBtn) {
            if (p.agent) {
                agentBtn.style.display = 'block';
                let commission = Math.max(2000, Math.round(p.marketValue * 0.06));
                agentBtn.innerText = `🕴️ Über Berater ${p.agent.name} lösen [${formatVal(commission)}]`;
            } else {
                agentBtn.style.display = 'none';
            }
        }
        let extendBtn = document.getElementById('btn-ultimatum-extend');
        let secondChanceBtn = document.getElementById('btn-ultimatum-secondchance');
        if (secondChanceBtn) {
            let available = managerRPG.perks.secondChance && game.secondChanceUsedSeason !== game.season;
            secondChanceBtn.style.display = available ? 'block' : 'none';
        }
        if (extendBtn) {
            if (game.ultimatumExtensionUsed) {
                extendBtn.disabled = true;
                extendBtn.innerText = '⏳ Fristverlängerung bereits genutzt';
            } else {
                extendBtn.disabled = false;
                let advanceFee = Math.max(1000, Math.round(p.wage * 2));
                extendBtn.innerText = `⏳ Vorschuss zahlen, Frist +2 Spieltage [${formatVal(advanceFee)}]`;
            }
        }
        document.getElementById('ultimatum-overlay').classList.add('show');
    }

