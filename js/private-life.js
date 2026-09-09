    // ==========================================
    // TRAINER-PRIVATLEBEN: GEHALT, LIFESTYLE, HOBBYS, EINKOMMENSQUELLEN
    // ==========================================
    function renderPrivateLifeView() {
        document.getElementById('priv-money').innerText = formatVal(privateLife.money);
        document.getElementById('priv-wage').innerText = formatVal(privateLife.wage);
        document.getElementById('priv-license').innerText = licenseConfig[privateLife.license].name;
        document.getElementById('priv-stress').innerText = privateLife.stress + '%';
        let prestigeEl = document.getElementById('priv-prestige');
        if (prestigeEl) prestigeEl.innerText = privateLife.prestige;

        let box = document.getElementById('priv-license-box');
        if (privateLife.license < licenseConfig.length - 1) {
            let nextLic = licenseConfig[privateLife.license + 1];
            box.innerHTML = `Nächste Lizenz: <strong>${nextLic.name}</strong><br><button onclick="upgradeLicense()" class="btn-action" style="margin-top:4px;">Lizenz erwerben [${formatVal(nextLic.cost)}]</button>`;
        } else {
            box.innerHTML = `<span style="color:var(--primary);">★ Höchste Lizenz (UEFA Pro) aktiv!</span>`;
        }

        // Lifestyle-Assets
        let assetsList = document.getElementById('priv-assets-list');
        if (assetsList) {
            assetsList.innerHTML = LIFESTYLE_ASSETS.map(a => {
                let owned = privateLife.assets.includes(a.id);
                return `<div class="player-row">
                    <span><strong>${a.name}</strong> <span style="color:#64748b; font-size:9px;">(${a.category})</span><br><span style="font-size:9px; color:#aaa;">${a.desc} · +${a.prestige} Prestige, -${a.stressRelief}% Stress</span></span>
                    <button onclick="buyLifestyleAsset('${a.id}')" class="${owned ? 'btn-secondary' : 'btn-action'}" style="width:auto;" ${owned ? 'disabled' : ''}>${owned ? 'Besessen ✓' : `Kaufen [${formatVal(a.cost)}]`}</button>
                </div>`;
            }).join('');
        }

        // Einkommensquellen (mit Cooldown-Anzeige)
        let incomeList = document.getElementById('priv-income-activities');
        if (incomeList) {
            incomeList.innerHTML = PRESTIGE_INCOME_ACTIVITIES.map(a => {
                let cdLeft = Math.max(0, (privateLife.lastActivity[a.id] || -999) + a.cooldown - game.matchday);
                let locked = privateLife.prestige < a.minPrestige;
                let disabled = locked || cdLeft > 0;
                let label = locked ? `Benötigt ${a.minPrestige} Prestige` : (cdLeft > 0 ? `Noch ${cdLeft} SpT gesperrt` : `+${formatVal(a.income)} (-${a.stressCost}% Stress)`);
                return `<div class="player-row">
                    <span><strong>${a.name}</strong><br><span style="font-size:9px; color:#aaa;">${a.desc}</span></span>
                    <button onclick="doPrestigeActivity('${a.id}')" class="btn-action" style="width:auto; font-size:9px;" ${disabled ? 'disabled' : ''}>${label}</button>
                </div>`;
            }).join('');
        }

        // Hobby-Auswahl
        let hobbySelect = document.getElementById('priv-hobby-select');
        if (hobbySelect) {
            hobbySelect.innerHTML = HOBBIES.map(h => `<option value="${h.id}" ${privateLife.hobby === h.id ? 'selected' : ''}>${h.name}</option>`).join('');
            let currentHobby = HOBBIES.find(h => h.id === privateLife.hobby);
            let hobbyDescEl = document.getElementById('priv-hobby-desc');
            if (hobbyDescEl && currentHobby) hobbyDescEl.innerText = currentHobby.desc + (currentHobby.wageCost > 0 ? ` (Unterhalt: ${formatVal(currentHobby.wageCost)}/SpT)` : '');
        }

        // Beziehungsstatus
        let relSelect = document.getElementById('priv-relationship-select');
        if (relSelect) {
            relSelect.innerHTML = RELATIONSHIP_STATUSES.map(r => `<option value="${r.id}" ${privateLife.relationship === r.id ? 'selected' : ''}>${r.name}</option>`).join('');
            let currentRel = RELATIONSHIP_STATUSES.find(r => r.id === privateLife.relationship);
            let relDescEl = document.getElementById('priv-relationship-desc');
            if (relDescEl && currentRel) relDescEl.innerText = currentRel.desc + (currentRel.wageCost > 0 ? ` (Unterhalt: ${formatVal(currentRel.wageCost)}/SpT)` : '');
        }

        // Neue Funktionen: Button-Zustände
        let autobioBtn = document.getElementById('btn-priv-autobio');
        if (autobioBtn) {
            if (privateLife.autobiographyWritten) { autobioBtn.disabled = true; autobioBtn.innerText = '📖 Autobiografie bereits veröffentlicht ✓'; }
            else { autobioBtn.disabled = false; autobioBtn.innerText = '📖 Autobiografie schreiben (ab 40 Prestige, einmalig)'; }
        }
        let socialBtn = document.getElementById('btn-priv-social');
        if (socialBtn) socialBtn.innerText = privateLife.socialMediaActive ? '📱 Soziale-Medien-Präsenz: AKTIV (kleiner Fan-Bonus, etwas Stress)' : '📱 Soziale-Medien-Präsenz: INAKTIV';
        let assistantBtn = document.getElementById('btn-priv-assistant');
        if (assistantBtn) assistantBtn.innerText = privateLife.assistantHired ? '🧑‍💼 Assistent AKTIV (-3% Stress/SpT, 400 €/SpT)' : '🧑‍💼 Persönlichen Assistenten einstellen [5.000 € Antritt, 400 €/SpT]';
    }

    function upgradeLicense() {
        let nextLic = licenseConfig[privateLife.license + 1];
        if (privateLife.money < nextLic.cost) return;
        playSound('click');
        privateLife.money -= nextLic.cost;
        privateLife.license++;
        renderPrivateLifeView();
        updateUI();
    }

    function doPrivateActivity(act) {
        playSound('click');
        if (act === 'golf' && privateLife.money >= 500) { privateLife.money -= 500; privateLife.stress = Math.max(0, privateLife.stress - 15); }
        if (act === 'wellness' && privateLife.money >= 1800) { privateLife.money -= 1800; privateLife.stress = Math.max(0, privateLife.stress - 25); }
        if (act === 'urlaub' && privateLife.money >= 4500) { privateLife.money -= 4500; privateLife.stress = Math.max(0, privateLife.stress - 40); }
        renderPrivateLifeView();
    }

    // ---------- LIFESTYLE-ASSETS ----------
    function buyLifestyleAsset(assetId) {
        let asset = LIFESTYLE_ASSETS.find(a => a.id === assetId);
        if (!asset || privateLife.assets.includes(assetId)) return;
        if (privateLife.money < asset.cost) { showToast('Nicht genug Privatvermögen!', 'error'); return; }
        playSound('whistle');
        privateLife.money -= asset.cost;
        privateLife.assets.push(assetId);
        privateLife.prestige += asset.prestige;
        privateLife.stress = Math.max(0, privateLife.stress - asset.stressRelief);
        renderPrivateLifeView();
        showToast(`🏆 ${asset.name} erworben! +${asset.prestige} Prestige`, 'success');
    }

    // ---------- PRESTIGE-EINKOMMENSAKTIVITÄTEN ----------
    function doPrestigeActivity(activityId) {
        let activity = PRESTIGE_INCOME_ACTIVITIES.find(a => a.id === activityId);
        if (!activity) return;
        if (privateLife.prestige < activity.minPrestige) { showToast(`Benötigt mindestens ${activity.minPrestige} Prestige!`, 'error'); return; }
        let cdLeft = Math.max(0, (privateLife.lastActivity[activityId] || -999) + activity.cooldown - game.matchday);
        if (cdLeft > 0) { showToast(`Noch ${cdLeft} Spieltage gesperrt!`, 'error'); return; }
        playSound('whistle');
        privateLife.money += activity.income;
        privateLife.stress = Math.min(100, privateLife.stress + activity.stressCost);
        privateLife.lastActivity[activityId] = game.matchday;
        renderPrivateLifeView();
        showToast(`💰 ${activity.name}: +${formatVal(activity.income)}!`, 'success');
    }

    // ---------- HOBBY & BEZIEHUNGSSTATUS ----------
    function setHobby(hobbyId) {
        if (!HOBBIES.some(h => h.id === hobbyId)) return;
        privateLife.hobby = hobbyId;
        renderPrivateLifeView();
    }

    function setRelationshipStatus(statusId) {
        if (!RELATIONSHIP_STATUSES.some(r => r.id === statusId)) return;
        privateLife.relationship = statusId;
        renderPrivateLifeView();
    }

    // ---------- WOHLTÄTIGKEIT & KAPITALTRANSFER ----------
    function makeCharityDonation(amount) {
        if (!amount || amount <= 0 || privateLife.money < amount) { showToast('Ungültiger Betrag oder nicht genug Privatvermögen!', 'error'); return; }
        playSound('click');
        privateLife.money -= amount;
        game.boardSat = Math.min(100, game.boardSat + Math.round(amount / 5000));
        game.fans = Math.min(100, game.fans + Math.round(amount / 8000));
        privateLife.prestige += Math.round(amount / 10000);
        renderPrivateLifeView();
        updateUI();
        showToast(`❤️ Wohltätigkeitsspende über ${formatVal(amount)} gespendet - Image verbessert!`, 'success');
    }

    function depositToClub(amount) {
        if (!amount || amount <= 0 || privateLife.money < amount) { showToast('Ungültiger Betrag oder nicht genug Privatvermögen!', 'error'); return; }
        playSound('whistle');
        privateLife.money -= amount;
        game.money += amount;
        renderPrivateLifeView();
        updateUI();
        showToast(`🏦 ${formatVal(amount)} aus dem Privatvermögen ins Vereinskonto eingezahlt!`, 'success');
    }

    // ---------- NEUE PRIVATLEBEN-FUNKTIONEN ----------

    // Autobiografie schreiben: einmalige, große Belohnung ab hohem Prestige - danach
    // dauerhaft nicht mehr verfügbar (man schreibt seine Lebensgeschichte nur einmal).
    function writeAutobiography() {
        if (privateLife.autobiographyWritten) { showToast('Die Autobiografie wurde bereits veröffentlicht!', 'error'); return; }
        if (privateLife.prestige < 40) { showToast('Benötigt mindestens 40 Prestige, um verlegt zu werden!', 'error'); return; }
        playSound('goal');
        let income = 60000 + privateLife.prestige * 500;
        privateLife.money += income;
        privateLife.prestige += 15;
        privateLife.autobiographyWritten = true;
        game.fans = Math.min(100, game.fans + 8);
        addInboxMessage('vertrag', '📖 Autobiografie veröffentlicht!', `Deine Lebensgeschichte "Vom Anpfiff zum Aufstieg" erscheint in den Buchläden - ${formatVal(income)} Vorschuss und deutlich mehr Prestige & Fan-Sympathie!`, 'screen-private');
        showToast(`📖 Autobiografie veröffentlicht! +${formatVal(income)}`, 'success');
        renderPrivateLifeView();
        updateUI();
    }

    // Soziale-Medien-Präsenz: dauerhaft umschaltbar. Aktiv gibt einen kleinen, stetigen
    // Fan-Sympathie-Bonus, kostet aber laufend etwas Stress (öffentliche Aufmerksamkeit).
    function toggleSocialMediaPresence() {
        privateLife.socialMediaActive = !privateLife.socialMediaActive;
        playSound('click');
        showToast(privateLife.socialMediaActive ? '📱 Soziale-Medien-Präsenz aktiviert!' : '📱 Soziale-Medien-Präsenz deaktiviert.', 'success');
        renderPrivateLifeView();
    }

    // Persönlicher Assistent: laufende Gehaltskosten, senkt aber jeden Spieltag passiv den
    // Stresspegel - sinnvoll für stark beanspruchte, prestigereiche Manager.
    function toggleAssistant() {
        if (!privateLife.assistantHired && privateLife.money < 5000) { showToast('5.000 € Antrittsgehalt benötigt!', 'error'); return; }
        if (!privateLife.assistantHired) privateLife.money -= 5000;
        privateLife.assistantHired = !privateLife.assistantHired;
        playSound('click');
        showToast(privateLife.assistantHired ? '🧑‍💼 Persönlicher Assistent eingestellt!' : '🧑‍💼 Assistent entlassen.', 'success');
        renderPrivateLifeView();
        updateUI();
    }

    // ---------- SPIELTAGS-ROUTINE: GEHALT, HOBBY- & BEZIEHUNGS-UNTERHALT ----------
    // Bisher wurde privateLife.wage nur angezeigt, aber nie tatsächlich ausgezahlt - Kernbug.
    function processPrivateLifeMatchday() {
        privateLife.money += privateLife.wage;

        let hobby = HOBBIES.find(h => h.id === privateLife.hobby);
        if (hobby) {
            if (hobby.wageCost > 0) privateLife.money -= hobby.wageCost;
            if (hobby.stressDecay > 0) privateLife.stress = Math.max(0, privateLife.stress - hobby.stressDecay);
        }

        let rel = RELATIONSHIP_STATUSES.find(r => r.id === privateLife.relationship);
        if (rel) {
            if (rel.wageCost > 0) privateLife.money -= rel.wageCost;
            if (rel.stressDecayBonus > 0) privateLife.stress = Math.max(0, privateLife.stress - rel.stressDecayBonus);
        }

        if (privateLife.socialMediaActive) {
            game.fans = Math.min(100, game.fans + 0.3);
            privateLife.stress = Math.min(100, privateLife.stress + 1);
        }
        if (privateLife.assistantHired) {
            privateLife.money -= 400;
            privateLife.stress = Math.max(0, privateLife.stress - 3);
        }
    }
