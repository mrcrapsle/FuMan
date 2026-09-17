
    // ==========================================
    // VEREINS-WAPPEN-EDITOR
    // ==========================================
    const CREST_COLOR_PRESETS = ['#f5b942', '#3fb6ff', '#ff4d6d', '#22e0a8', '#8b5cf6', '#ff8a5c', '#ffffff', '#c0c0c0'];
    const CREST_SYMBOL_PRESETS = ['FCM', '⚽', '🦁', '🐺', '🦅', '⚡', '🔥', '★'];
    // Zweite Wappen-Ebene: kleines Muster-Badge in der Ecke, unabhängig vom Hauptsymbol
    // wählbar, für mehr Individualisierung ohne das Hauptsymbol zu ersetzen.
    const CREST_PATTERN_PRESETS = [
        { key: 'keins', label: 'Kein Muster', icon: '' },
        { key: 'stern', label: 'Stern', icon: '★' },
        { key: 'streifen', label: 'Streifen', icon: '▌▌' },
        { key: 'krone', label: 'Krone', icon: '👑' },
        { key: 'schild', label: 'Schild', icon: '🛡️' },
        { key: 'blitz', label: 'Blitz', icon: '⚡' },
        { key: 'jubilaeum', label: 'Jubiläum', icon: '🎖️', locked: true }
    ];

    // Wappen-Jubiläums-Editionen: bei runden Saisonzahlen (10., 20., ...) wird automatisch
    // ein besonderes Jubiläums-Musterelement freigeschaltet - eine kleine, dauerhafte
    // Belohnung fürs lange Durchhalten in ein und derselben Karriere.
    function checkJubileeCrestUnlock() {
        if (game.season > 0 && game.season % 10 === 0) {
            if (!game.jubileeMatchesPlayed) game.jubileeMatchesPlayed = [];
            if (!game.jubileeMatchesPlayed.includes(game.season)) {
                game.jubileeMatchesPlayed.push(game.season);
                if (!game.jubileePatternUnlocked) {
                    game.jubileePatternUnlocked = true;
                    addInboxMessage('vertrag', '🎖️ Jubiläums-Wappenmuster freigeschaltet!', `${game.season} Saisons als Manager desselben Vereins - zur Feier gibt es ein exklusives Jubiläums-Musterelement im Wappen-Editor!`, 'screen-manager-tree');
                    showToast('🎖️ Jubiläums-Wappenmuster freigeschaltet!', 'success');
                }
                playJubileeSpecialMatch();
            }
        }
    }

    // Jubiläums-Sonderspiel: ein nostalgisches Traditions-Testspiel gegen eine Alt-Herren-
    // Auswahl ehemaliger Spieler zur 10./20./... Jubiläumssaison - rein zeremoniell mit
    // Fan-Prestige- und Geldbonus, ohne Auswirkung auf die laufende Saison.
    function playJubileeSpecialMatch() {
        let scale = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        let income = Math.round(20000 * (game.season / 10) * scale * 8);
        game.money += income;
        game.fans = Math.min(100, game.fans + 8);
        squad.forEach(p => { p.morale = Math.min(100, p.morale + 3); });
        // Echte ehemalige Top-Spieler statt einer anonymen Alt-Herren-Auswahl, sofern
        // welche in der Vereinsgeschichte erfasst wurden (siehe recordNotablePastPlayer()).
        let veterans = (game.notablePastPlayers || []).slice(-6);
        let veteranNames = veterans.length > 0
            ? veterans.sort((a, b) => b.strength - a.strength).slice(0, 3).map(v => v.name).join(', ')
            : null;
        let veteranText = veteranNames
            ? `Vereinslegenden wie ${veteranNames} liefen noch einmal im Trikot von ${game.clubName} auf`
            : `Ehemalige Vereinslegenden liefen noch einmal für die Alt-Herren-Auswahl auf`;
        addInboxMessage('vertrag', `🎉 Jubiläums-Traditionsspiel: ${game.season} Jahre ${game.clubName}!`,
            `${veteranText} - ein emotionaler Nachmittag vor vollen Rängen. Einnahmen: ${formatVal(income)}, spürbarer Stimmungsschub für Fans und Mannschaft!`, 'screen-calendar');
        showToast(`🎉 Jubiläums-Traditionsspiel ausgetragen! +${formatVal(income)}`, 'success');
        pendingMilestoneInterviewType = 'jubilee';
        updateUI();
    }

    function hexToRgba(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function applyClubCrest() {
        // Klubname an allen statischen Stellen im Markup aktualisieren (Header, Dashboard-
        // Hero, Nächste-Begegnung-Box) - relevant seit renameClub() (career.js) den Namen
        // zur Laufzeit ändern kann, diese Stellen aber ursprünglich als reines HTML mit dem
        // Startnamen fest verdrahtet waren.
        ['header-club-name', 'dash-hero-club-name', 'dash-our-club-name', 'career-club-name-display'].forEach(id => {
            let nameEl = document.getElementById(id);
            if (nameEl) nameEl.innerText = game.clubName;
        });
        let el = document.getElementById('club-logo-display');
        if (!el) return;
        let color = game.clubCrestColor || '#f5b942';
        let symbolEl = document.getElementById('club-logo-symbol-text');
        if (symbolEl) symbolEl.innerText = game.clubCrestSymbol || 'FCM';
        // Bewusst OHNE color-mix()/CSS-Farbfunktionen (in älteren Android-WebViews evtl. nicht
        // unterstützt) - stattdessen simpler radialer Verlauf aus per-JS berechneten RGBA-Werten.
        let gradient = `radial-gradient(circle at 35% 30%, ${hexToRgba(color, 0.65)} 0%, ${color} 55%, ${hexToRgba(color, 0.75)} 100%)`;
        el.style.background = gradient;

        // Sponsoren-Ring: bei aktivem Hauptsponsor erscheint ein dezenter farbiger Rahmen
        // um das Vereinswappen (Symbolik für's Sponsoren-Logo auf dem Trikot/Wappen).
        let hasSponsor = game.sponsor && game.sponsor.base > 500;
        el.style.boxShadow = hasSponsor ? `0 0 0 3px var(--teal), 0 0 12px rgba(23,201,184,0.5)` : 'none';

        // Zweite Wappen-Ebene: kleines Muster-Badge unten rechts am Vereinswappen.
        let badge = document.getElementById('club-logo-pattern-badge');
        let pattern = CREST_PATTERN_PRESETS.find(p => p.key === (game.clubCrestPattern || 'keins'));
        if (badge) {
            if (pattern && pattern.icon) {
                badge.innerText = pattern.icon;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        // Dritte, kombinierbare Wappen-Ebene (NEU): Tier-/Maskottchen-Symbol oben links, damit
        // Initialen, Muster-Badge und Tier-Symbol frei miteinander kombiniert werden können.
        let animalBadge = document.getElementById('club-logo-animal-badge');
        if (animalBadge) {
            if (game.clubCrestAnimal) { animalBadge.innerText = game.clubCrestAnimal; animalBadge.style.display = 'flex'; }
            else animalBadge.style.display = 'none';
        }

        // Große Live-Vorschau im Wappen-Editor (falls sichtbar) - identisches Aussehen wie
        // das kleine Header-Wappen, nur größer zum genauen Begutachten vor dem "Speichern".
        let preview = document.getElementById('crest-preview-large');
        let previewSymbol = document.getElementById('crest-preview-symbol-text');
        let previewBadge = document.getElementById('crest-preview-pattern-badge');
        let previewAnimalBadge = document.getElementById('crest-preview-animal-badge');
        if (preview) {
            preview.style.background = gradient;
            preview.style.boxShadow = hasSponsor ? `0 0 0 5px var(--teal), 0 0 20px rgba(23,201,184,0.5)` : 'none';
            if (previewSymbol) previewSymbol.innerText = game.clubCrestSymbol || 'FCM';
            if (previewBadge) {
                if (pattern && pattern.icon) { previewBadge.innerText = pattern.icon; previewBadge.style.display = 'flex'; }
                else previewBadge.style.display = 'none';
            }
            if (previewAnimalBadge) {
                if (game.clubCrestAnimal) { previewAnimalBadge.innerText = game.clubCrestAnimal; previewAnimalBadge.style.display = 'flex'; }
                else previewAnimalBadge.style.display = 'none';
            }
        }
    }

    // Wappen-Historie: merkt sich das vorherige Design, bevor es geändert wird - sichtbar im
    // Vereinsmuseum (Campus-Gebäude), sobald dieses mindestens Stufe 1 erreicht hat.
    function snapshotCurrentCrest() {
        let snapshot = { color: game.clubCrestColor, symbol: game.clubCrestSymbol, pattern: game.clubCrestPattern, season: game.season };
        let last = crestHistory[crestHistory.length - 1];
        if (last && last.color === snapshot.color && last.symbol === snapshot.symbol && last.pattern === snapshot.pattern) return;
        crestHistory.push(snapshot);
        if (crestHistory.length > 20) crestHistory.shift();
    }

    function renderCrestMuseumGallery() {
        let box = document.getElementById('crest-museum-gallery');
        if (!box) return;
        let lvl = campusBuildings.museum ? campusBuildings.museum.lvl : 0;
        if (lvl === 0) {
            box.innerHTML = '<div class="box" style="font-size:10px; color:#94a3b8;">Baue das Vereinsmuseum aus (mind. Stufe 1), um hier vergangene Wappen-Designs zu sehen.</div>';
            return;
        }
        // Höhere Museumsstufen zeigen mehr archivierte Wappen gleichzeitig UND schalten
        // zusätzliche Vitrinen frei (Rivalen-Bilanz ab Stufe 3, Karriere-Meilensteine ab
        // Stufe 5) - der Ausbau des Gebäudes hat damit einen sichtbaren, wachsenden Nutzen.
        const DISPLAY_LIMITS = { 1: 3, 2: 6, 3: 10, 4: 15, 5: 20 };
        let limit = DISPLAY_LIMITS[lvl] || 3;
        let shown = crestHistory.slice(-limit);

        let html = '';
        if (shown.length === 0) {
            html += '<div class="box" style="font-size:10px; color:#94a3b8;">Noch keine früheren Wappen-Designs archiviert - ändere das Wappen im Manager-Talentbaum-Screen.</div>';
        } else {
            html += `<div style="font-size:9px; color:#94a3b8; margin-bottom:6px;">Zeigt die letzten ${shown.length} von ${crestHistory.length} archivierten Designs (Museum Stufe ${lvl}).</div>`;
            html += '<div style="display:flex; gap:8px; flex-wrap:wrap;">' + shown.map(c => {
                let patternMeta = CREST_PATTERN_PRESETS.find(p => p.key === c.pattern);
                return `
                    <div style="text-align:center;">
                        <div style="position:relative; width:48px; height:48px; border-radius:50%; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:900; color:#1a1200; border:2px solid rgba(255,255,255,0.6); background:radial-gradient(circle at 35% 30%, ${hexToRgba(c.color, 0.65)} 0%, ${c.color} 55%, ${hexToRgba(c.color, 0.75)} 100%);">
                            ${c.symbol}
                            ${patternMeta && patternMeta.icon ? `<span style="position:absolute; bottom:-2px; right:-2px; width:14px; height:14px; background:#0d1220; border-radius:50%; font-size:8px; display:flex; align-items:center; justify-content:center;">${patternMeta.icon}</span>` : ''}
                        </div>
                        <div style="font-size:8px; color:#94a3b8; margin-top:2px;">Saison ${c.season}</div>
                    </div>`;
            }).join('') + '</div>';
        }

        if (lvl >= 3) {
            html += `<div class="box" style="margin-top:10px; font-size:10px;"><strong style="color:var(--teal);">🆚 Rivalen-Vitrine:</strong> ${game.permanentRivalName || '-'} · Bilanz: ${rivalryRecord.wins}S ${rivalryRecord.draws}U ${rivalryRecord.losses}N${(rivalryRecord.shootoutsVsRival || 0) >= 2 ? ` · 😰 ${rivalryRecord.shootoutsVsRival}× Nervenkrieg im Elfmeterschießen` : ''}</div>`;
        }
        if (lvl >= 5) {
            html += `<div class="box" style="margin-top:6px; font-size:10px;"><strong style="color:var(--gold);">🏅 Karriere-Vitrine:</strong> Level ${managerRPG.level} · ${(game.trophies || []).length} Trophäen · ${game.timesSacked || 0}× entlassen${game.legendStatus ? ' · 👑 Vereinslegende' : ''}</div>`;
            let milestones = (game.attendanceMilestonesReached || []).slice().sort((a,b) => b - a);
            let milestoneText = milestones.length > 0 ? `Höchster Meilenstein: ${milestones[0].toLocaleString('de-DE')} Zuschauer` : 'Noch keine Zuschauer-Meilensteine';
            let jubileeText = (game.jubileeMatchesPlayed || []).length > 0 ? ` · 🎖️ ${game.jubileeMatchesPlayed.length} Jubiläumssaison(en) gefeiert` : '';
            html += `<div class="box" style="margin-top:6px; font-size:10px;"><strong style="color:var(--blue);">📊 Meilenstein-Vitrine:</strong> Zuschauerrekord ${(game.recordAttendance || 0).toLocaleString('de-DE')} (Saison ${game.recordAttendanceSeason || '-'}) · ${milestoneText}${jubileeText}</div>`;
            let favorites = (game.crowdFavoriteHistory || []).slice(-6).reverse();
            let favoritesText = favorites.length > 0 ? favorites.map(f => `${f.name} (S${f.season})`).join(' · ') : 'Noch keine Gala ausgetragen';
            html += `<div class="box" style="margin-top:6px; font-size:10px;"><strong style="color:#ff6b9d;">❤️ Publikumslieblings-Vitrine:</strong> ${favoritesText}</div>`;
        }
        box.innerHTML = html;
    }

    function setCrestColor(color) {
        playSound('click');
        snapshotCurrentCrest();
        game.clubCrestColor = color;
        applyClubCrest();
        renderCrestEditor();
    }
    function setAwayColor(color) {
        playSound('click');
        game.clubCrestAwayColor = color;
        renderCrestEditor();
        showToast('🎽 Auswärtstrikot-Farbe geändert!', 'success');
    }
    function setCrestSymbol(symbol) {
        playSound('click');
        snapshotCurrentCrest();
        game.clubCrestSymbol = symbol;
        applyClubCrest();
        renderCrestEditor();
    }
    // Eigene Wappen-Elemente kombinierbar (NEU): Tier-/Maskottchen-Symbol als dritte,
    // unabhängig wählbare Ebene neben Initialen und Muster-Badge.
    const CREST_ANIMAL_OPTIONS = [null, '🦁', '🐺', '🦅', '🐴', '🐻', '🐗', '🦊', '🐂'];
    function setCrestAnimal(animal) {
        playSound('click');
        snapshotCurrentCrest();
        game.clubCrestAnimal = animal;
        applyClubCrest();
        renderCrestEditor();
    }
    function renderCrestAnimalOptions() {
        let box = document.getElementById('crest-animal-options');
        if (!box) return;
        box.innerHTML = CREST_ANIMAL_OPTIONS.map(a => {
            let active = (game.clubCrestAnimal || null) === a;
            return `<button onclick="setCrestAnimal(${a ? `'${a}'` : 'null'})" class="${active ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:16px; padding:6px 10px;">${a || '✕'}</button>`;
        }).join('');
    }
    function setCrestPattern(key) {
        playSound('click');
        snapshotCurrentCrest();
        game.clubCrestPattern = key;
        applyClubCrest();
        renderCrestEditor();
    }
    function renderCrestEditor() {
        renderCrestAnimalOptions();
        let colorBox = document.getElementById('crest-color-options');
        let symbolBox = document.getElementById('crest-symbol-options');
        let patternBox = document.getElementById('crest-pattern-options');
        if (colorBox) {
            colorBox.innerHTML = CREST_COLOR_PRESETS.map(c => `<button onclick="setCrestColor('${c}')" style="width:32px; height:32px; border-radius:50%; background:${c}; border:${game.clubCrestColor === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.3)'}; cursor:pointer;"></button>`).join('');
        }
        if (symbolBox) {
            symbolBox.innerHTML = CREST_SYMBOL_PRESETS.map(s => `<button onclick="setCrestSymbol('${s}')" class="${game.clubCrestSymbol === s ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:16px; padding:6px 12px;">${s}</button>`).join('');
        }
        if (patternBox) {
            patternBox.innerHTML = CREST_PATTERN_PRESETS.filter(p => !p.locked || game.jubileePatternUnlocked).map(p => `<button onclick="setCrestPattern('${p.key}')" class="${(game.clubCrestPattern || 'keins') === p.key ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:13px; padding:6px 10px;">${p.icon ? p.icon + ' ' : ''}${p.label}</button>`).join('');
        }
        let awayColorBox = document.getElementById('crest-away-color-options');
        if (awayColorBox) {
            awayColorBox.innerHTML = CREST_COLOR_PRESETS.map(c => `<button onclick="setAwayColor('${c}')" style="width:32px; height:32px; border-radius:50%; background:${c}; border:${game.clubCrestAwayColor === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.3)'}; cursor:pointer;"></button>`).join('');
        }
    }

