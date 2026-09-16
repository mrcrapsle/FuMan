
    // Onboarding: erscheint nur, solange dieses Gerät die Kurzanleitung noch nie gesehen hat
    // (unabhängig von Speicherständen - wer schon spielt, kennt sich bereits aus).
    function maybeShowTutorial() {
        if (!safeLocalGet('anstoss_fm13_tutorial_seen')) {
            tutorialPage = 0;
            renderTutorialPage();
            let overlay = document.getElementById('tutorial-overlay');
            if (overlay) overlay.classList.add('show');
        }
    }

    function closeTutorial() {
        let overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.classList.remove('show');
        safeLocalSet('anstoss_fm13_tutorial_seen', 'true');
    }

    // Mehrseitiges Tutorial (NEU): erklärt jetzt auch die neueren, komplexeren Systeme
    // (Scouting-Netzwerk 2.0, Stadion-Baustellen, Personal-Automatisierung) statt nur die
    // Grundstruktur der Menüs - bisher blieb ein neuer Spieler bei diesen Tiefensystemen
    // komplett auf sich gestellt.
    let tutorialPage = 0;
    // Texte selbst liegen im Sprachwörterbuch (js/i18n.js, Keys tutorial_N_title/body) -
    // hier nur noch die Key-Zuordnung pro Seite, damit t() beim Rendern die aktuell
    // gewählte Sprache (DE/EN) ziehen kann.
    const TUTORIAL_PAGES = [
        { titleKey: 'tutorial_1_title', bodyKey: 'tutorial_1_body' },
        { titleKey: 'tutorial_2_title', bodyKey: 'tutorial_2_body' },
        { titleKey: 'tutorial_3_title', bodyKey: 'tutorial_3_body' },
        { titleKey: 'tutorial_4_title', bodyKey: 'tutorial_4_body' }
    ];
    function renderTutorialPage() {
        let page = TUTORIAL_PAGES[tutorialPage];
        let titleEl = document.getElementById('tutorial-title');
        let bodyEl = document.getElementById('tutorial-body');
        let dotsEl = document.getElementById('tutorial-dots');
        let nextBtn = document.getElementById('tutorial-next-btn');
        let prevBtn = document.getElementById('tutorial-prev-btn');
        if (titleEl) titleEl.innerHTML = t(page.titleKey).replace('{CLUB}', game.clubName);
        if (bodyEl) bodyEl.innerHTML = t(page.bodyKey);
        if (dotsEl) dotsEl.innerHTML = TUTORIAL_PAGES.map((_, i) => `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; margin:0 2px; background:${i === tutorialPage ? 'var(--accent)' : 'rgba(255,255,255,0.25)'};"></span>`).join('');
        if (prevBtn) {
            prevBtn.style.visibility = tutorialPage === 0 ? 'hidden' : 'visible';
            prevBtn.innerText = t('tutorial_prev');
        }
        if (nextBtn) nextBtn.innerText = tutorialPage === TUTORIAL_PAGES.length - 1 ? t('tutorial_start') : t('tutorial_next');
    }
    function tutorialNext() {
        if (tutorialPage < TUTORIAL_PAGES.length - 1) { tutorialPage++; renderTutorialPage(); }
        else closeTutorial();
    }
    function tutorialPrev() {
        if (tutorialPage > 0) { tutorialPage--; renderTutorialPage(); }
    }

    // Toast-Benachrichtigung: unabhängig von window.alert(), da manche eingebetteten
    // WebViews (z.B. Dateimanager-Vorschauen) native Dialoge unterdrücken können.
    function showToast(message, type, duration = 2800) {
        let toast = document.getElementById('app-toast');
        if (!toast) return;
        toast.innerText = message;
        toast.className = 'app-toast show' + (type === 'error' ? ' toast-error' : '');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => { toast.classList.remove('show'); }, duration);
    }

    // Ordnet jeden Hub seinen Mitglieds-Screens zu (für Sichtbarkeits- und Tab-Umschaltung)
    const HUB_MEMBERS = {
        'screen-hub-wirtschaft': ['screen-industry', 'screen-raw-materials', 'screen-holding', 'screen-merch'],
        'screen-hub-finanzen': ['screen-finances', 'screen-stocks', 'screen-sponsors', 'screen-betting'],
        'screen-hub-ausbau': ['screen-stadium', 'screen-campus', 'screen-staff', 'screen-fans', 'screen-real-estate'],
        'screen-hub-kaderplanung': ['screen-transfer', 'screen-scouting-global', 'screen-youth', 'screen-contracts'],
        'screen-hub-wettbewerbe': ['screen-league', 'screen-europe', 'screen-history'],
        'screen-hub-spezial': ['screen-private', 'screen-underworld', 'screen-premium']
    };
    // Kehrt HUB_MEMBERS um: Mitglieds-Screen -> zugehöriger Hub
    const SUB_SCREEN_TO_HUB = {};
    for (let hubId in HUB_MEMBERS) {
        HUB_MEMBERS[hubId].forEach(memberId => { SUB_SCREEN_TO_HUB[memberId] = hubId; });
    }

    // ---------- HTML-STRUKTUR-SELBSTTEST ----------
    // Prüft automatisch, ob JEDER Screen (Top-Level + alle Hub-Unterscreens) nach
    // showScreen() tatsächlich sichtbar UND mit Inhalt gefüllt ist. Entstanden aus einem
    // sehr hartnäckigen Bug: eine einzelne fehlende schließende </div> irgendwo im
    // statischen HTML hatte mehrere Screens (Admin, Livespiel, Pressekonferenz) eine Ebene
    // zu tief verschachtelt, wodurch sie nach showScreen() zwar technisch "display:block"
    // waren, aber wegen der falschen Elternstruktur keine sichtbare Höhe hatten - von außen
    // sah das Spiel dadurch komplett funktionslos aus, obwohl der komplette JS-Code fehlerfrei
    // lief. Dieser Test hätte das beim nächsten Bauen sofort sichtbar gemacht.
    function runStructuralSelfTest(silent = true) {
        let topScreens = ['screen-dashboard', 'screen-calendar', 'screen-inbox', 'screen-squad', 'screen-second-team', 'screen-training', 'screen-manager-tree', 'screen-admin', 'screen-prematch-press', 'screen-matchday'];
        let allTestIds = [...topScreens, ...Object.keys(HUB_MEMBERS), ...Object.values(HUB_MEMBERS).flat()];
        let problems = [];
        let originalTopScreen = topScreens.find(s => document.getElementById(s)?.style.display === 'block') || 'screen-dashboard';

        allTestIds.forEach(id => {
            let el = document.getElementById(id);
            if (!el) { problems.push(`${id}: Element existiert nicht im DOM!`); return; }
            try { showScreen(id); } catch (e) { problems.push(`${id}: showScreen() wirft einen Fehler: ${e.message}`); return; }
            let computedDisplay = getComputedStyle(el).display;
            if (computedDisplay === 'none') {
                problems.push(`${id}: bleibt nach showScreen() unsichtbar (display:none)!`);
                return;
            }
            let rect = el.getBoundingClientRect();
            if (rect.height < 5 && el.children.length > 0) {
                problems.push(`${id}: sichtbar laut CSS, aber Höhe nur ${Math.round(rect.height)}px trotz ${el.children.length} Kindelementen - vermutlich Verschachtelungsfehler im HTML!`);
            }
        });

        showScreen(originalTopScreen); // Ursprünglichen Zustand wiederherstellen

        // Zusätzlicher Pre-Release-Check: prüft, ob jedes onclick-Attribut im gesamten
        // sichtbaren DOM tatsächlich auf eine existierende globale Funktion verweist - fängt
        // "Funktion nicht gefunden"-Fehler ab, bevor ein Nutzer live darauf klickt.
        let onclickProblems = [];
        document.querySelectorAll('[onclick]').forEach(el => {
            let expr = el.getAttribute('onclick');
            let match = expr.match(/^\s*([a-zA-Z_$][\w$]*)\s*\(/);
            if (!match) return; // komplexere Inline-Ausdrücke (z.B. direkte DOM-Zugriffe) werden übersprungen
            let fnName = match[1];
            if (typeof window[fnName] !== 'function') {
                onclickProblems.push(`onclick="${expr.slice(0, 60)}${expr.length > 60 ? '...' : ''}" verweist auf nicht existierende Funktion "${fnName}"! (Element: ${el.id || el.className || el.tagName})`);
            }
        });
        problems = problems.concat(onclickProblems);

        // Selbsttest-Ergebnis-Archiv: speichert jedes Testergebnis mit Zeitstempel, damit im
        // Admin-Bereich nachvollziehbar bleibt, wann zuletzt ein Problem gefunden wurde.
        if (!game.selfTestHistory) game.selfTestHistory = [];
        game.selfTestHistory.unshift({ timestamp: new Date().toLocaleString('de-DE'), problemsCount: problems.length, problems: problems.slice(0, 10) });
        if (game.selfTestHistory.length > 20) game.selfTestHistory.length = 20;
        if (typeof renderSelfTestArchive === 'function') renderSelfTestArchive();

        if (problems.length > 0) {
            console.error('⚠️ Struktur-Selbsttest fehlgeschlagen:', problems);
            let banner = document.getElementById('global-error-banner');
            let content = document.getElementById('global-error-content');
            if (banner && content) {
                banner.style.display = 'block';
                problems.forEach(p => {
                    let line = document.createElement('div');
                    line.style.borderTop = '1px solid rgba(255,255,255,0.2)';
                    line.style.padding = '4px 0';
                    line.textContent = '[Struktur-Test] ' + p;
                    content.appendChild(line);
                });
                // Hinweis auf die Export-Funktion, damit gefundene Probleme einfach gemeldet
                // werden können statt nur per Screenshot.
                let hintLine = document.createElement('div');
                hintLine.style.borderTop = '1px solid rgba(255,255,255,0.3)';
                hintLine.style.padding = '6px 0';
                hintLine.style.fontWeight = 'bold';
                hintLine.style.color = '#ffe27a';
                hintLine.textContent = '💡 Tipp: Im Admin-Bereich unter "Struktur-Selbsttest" kannst du diesen Verlauf per Knopfdruck exportieren, um ihn zu melden.';
                content.appendChild(hintLine);
            }
            if (!silent) alert(`⚠️ Struktur-Selbsttest fand ${problems.length} Problem(e):\n\n${problems.join('\n')}`);
        } else if (!silent) {
            if (typeof showToast === 'function') showToast(`✅ Struktur-Selbsttest: alle ${allTestIds.length} Screens OK!`, 'success');
            else alert(`✅ Struktur-Selbsttest: alle ${allTestIds.length} Screens OK!`);
        }
        return problems;
    }

    function showHubTab(subScreenId) {
        let hubId = SUB_SCREEN_TO_HUB[subScreenId];
        if (!hubId) return;
        HUB_MEMBERS[hubId].forEach(memberId => {
            let el = document.getElementById(memberId);
            if (el) el.style.display = (memberId === subScreenId) ? 'block' : 'none';
            let btn = document.getElementById('hubtab-btn-' + memberId);
            if (btn) {
                // Zustandsklasse (aktiv/inaktiv) austauschen, dabei aber thematische
                // Zusatzklassen (z.B. "tab-industry", "tab-europe") erhalten, statt
                // die gesamte className zu überschreiben.
                let extraClasses = btn.className.split(' ').filter(c => c !== 'btn-action' && c !== 'btn-secondary');
                let stateClass = (memberId === subScreenId) ? 'btn-action' : 'btn-secondary';
                btn.className = [stateClass, ...extraClasses].join(' ');
            }
        });
    }

    // Slide-In-Menü (NEU): öffnet/schließt die Navigation als Overlay-Drawer statt eines
    // permanenten Grids - schafft deutlich mehr Platz für den eigentlichen Bildschirminhalt.
    function toggleMenuDrawer() {
        playSound('click');
        document.getElementById('app-sidebar').classList.toggle('menu-open');
        document.getElementById('menu-backdrop').classList.toggle('menu-open');
    }
    function closeMenuDrawer() {
        document.getElementById('app-sidebar').classList.remove('menu-open');
        document.getElementById('menu-backdrop').classList.remove('menu-open');
    }

    function showScreen(screenId) {
        playSound('click');
        const screens = [
            'screen-dashboard', 'screen-calendar', 'screen-inbox', 'screen-squad', 'screen-second-team', 'screen-training',
            'screen-manager-tree', 'screen-admin', 'screen-cup',
            'screen-hub-wirtschaft', 'screen-hub-finanzen', 'screen-hub-ausbau',
            'screen-hub-kaderplanung', 'screen-hub-wettbewerbe', 'screen-hub-spezial',
            'screen-prematch-press', 'screen-matchday'
        ];
        // Wenn screenId ein Hub-Mitglied ist (z.B. "screen-stocks"), muss der ÜBERGEORDNETE
        // Hub-Container ("screen-hub-finanzen") sichtbar geschaltet werden, nicht das Mitglied direkt.
        let topLevelId = SUB_SCREEN_TO_HUB[screenId] || screenId;

        screens.forEach(s => {
            let el = document.getElementById(s);
            if (el) el.style.display = (s === topLevelId) ? 'block' : 'none';
        });

        // Innerhalb eines Hubs den passenden Tab aktivieren (Geschwister-Panels ausblenden)
        if (SUB_SCREEN_TO_HUB[screenId]) showHubTab(screenId);

        document.querySelectorAll('.nav-btn').forEach(btn => {
            let onclick = btn.getAttribute('onclick') || '';
            if (onclick.includes(topLevelId) || onclick.includes(screenId)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        // Slide-In-Menü (NEU): automatisch schließen, sobald ein Ziel ausgewählt wurde.
        closeMenuDrawer();

        if (screenId === 'screen-dashboard') renderDashboardView();
        if (screenId === 'screen-calendar') renderCalendarView();
        if (screenId === 'screen-inbox') renderInboxView();
        if (screenId === 'screen-squad') { renderSquadView(); render3DPitch(); }
        if (screenId === 'screen-second-team') renderSecondTeamView();
        if (screenId === 'screen-manager-tree') { renderCareerSummary(); renderCrestEditor(); applyClubCrest(); }
        if (screenId === 'screen-campus') renderCrestMuseumGallery();
        if (screenId === 'screen-training') renderTrainingView();
        if (screenId === 'screen-europe') renderEuropeView();
        if (screenId === 'screen-manager-tree') renderManagerRPGView();
        if (screenId === 'screen-scouting-global') renderGlobalScoutingView();
        if (screenId === 'screen-industry') renderIndustryView();
        if (screenId === 'screen-raw-materials') renderRawMaterialsView();
        if (screenId === 'screen-holding') renderHoldingView();
        if (screenId === 'screen-merch') renderMerchView();
        if (screenId === 'screen-finances') renderFinancesView();
        if (screenId === 'screen-stocks') renderStocksView();
        if (screenId === 'screen-sponsors') renderSponsorsView();
        if (screenId === 'screen-betting') renderBettingView();
        if (screenId === 'screen-finances') renderFinancesView();
        if (screenId === 'screen-stadium') renderStadiumView();
        if (screenId === 'screen-campus') renderCampusView();
        if (screenId === 'screen-staff') renderStaffView();
        if (screenId === 'screen-fans') renderFansView();
        if (screenId === 'screen-real-estate' && typeof renderRealEstateView === 'function') renderRealEstateView();
        if (screenId === 'screen-transfer') renderTransferView();
        if (screenId === 'screen-league') renderLeagueView();
        if (screenId === 'screen-cup') renderCupView();
        if (screenId === 'screen-youth') renderYouthView();
        if (screenId === 'screen-contracts') renderContractsView();
        if (screenId === 'screen-private') renderPrivateLifeView();
        if (screenId === 'screen-underworld') renderUnderworldView();
        if (screenId === 'screen-premium' && typeof renderPremiumShopView === 'function') renderPremiumShopView();
        if (screenId === 'screen-history') renderHistoryView();
        if (screenId === 'screen-admin') renderAdminView();
        updateUI();
    }

    function updateUI() {
        document.getElementById('top-money').innerText = formatVal(game.money);
        document.getElementById('top-holding-money').innerText = formatVal(holdingCompany.money);
        document.getElementById('top-fans').innerText = game.fans + '%';
        document.getElementById('top-board').innerText = game.boardSat + '%';
        document.getElementById('top-matchday').innerText = Math.min(34, game.matchday) + ' / 34';
        document.getElementById('head-league-name').innerText = leagueNames[game.leagueLevel];
        document.getElementById('head-season').innerText = "Saison " + game.season;
        document.getElementById('top-mgr-lvl').innerText = `Lvl ${managerRPG.level} (${managerRPG.xp} XP)`;

        let badge = document.getElementById('sidebar-offers-badge');
        if (badge) {
            if (incomingOffers.length > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = incomingOffers.length;
            } else {
                badge.style.display = 'none';
            }
        }
        let tabBadge = document.getElementById('tab-offers-badge');
        if (tabBadge) tabBadge.innerText = incomingOffers.length;

        let inboxUnread = (typeof inboxMessages !== 'undefined') ? inboxMessages.filter(m => !m.read).length : 0;
        let inboxBadge = document.getElementById('sidebar-inbox-badge');
        if (inboxBadge) {
            if (inboxUnread > 0) { inboxBadge.style.display = 'inline-block'; inboxBadge.innerText = inboxUnread; }
            else { inboxBadge.style.display = 'none'; }
        }
    }

