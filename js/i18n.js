
    // ==========================================
    // I18N - SPRACHUMSCHALTER (DE/EN)
    // ==========================================
    // Bewusst NUR ein Wörterbuch-Lookup (t(key)), kein Framework: das Spiel ist ein
    // einziger globaler Scope ohne Build-Step für echte i18n-Bibliotheken. Deutsch ist
    // und bleibt die Quelle der Wahrheit - fehlt ein Key in "en", fällt t() automatisch
    // auf den deutschen Text zurück (nie ein leerer/kaputter String).
    //
    // WICHTIG (Umfang): Diese erste Ausbaustufe deckt die global sichtbare Ober-
    // fläche ab (Header, Seitenmenü, Tutorial) - die riesige Menge an Bildschirm-
    // Inhalten (Kader, Transfermarkt, Finanzen, ...) wird schrittweise in Folge-
    // Commits ergänzt und bleibt bis dahin auf Englisch ebenfalls Deutsch (durch den
    // Fallback oben nie ein technischer Fehler, nur noch nicht übersetzter Text).
    let currentLang = 'de';

    const I18N = {
        de: {
            nav_category_main: 'Hauptzentrale',
            nav_dashboard: '📊 FM13 Dashboard',
            nav_calendar: '📅 Kalender & Termine',
            nav_inbox: '📬 Postfach',
            nav_category_team: 'Team & Kader',
            nav_squad: '⚽ Kader & 3D Taktik',
            nav_second_team: '🥈 Zweite Mannschaft',
            nav_training: '🏋️ Training & Förderung',
            nav_transfer: '🤝 Kaderplanung & Transfers',
            nav_category_infra: 'Ausbau & Infrastruktur',
            nav_stadium: '🏟️ Ausbau & Infrastruktur',
            nav_category_finance: 'Finanzen & Wirtschaft',
            nav_finances: '🏦 Finanzen & Kapitalmarkt',
            nav_industry: '🏭 Industrie & Merchandising',
            nav_category_competitions: 'Wettbewerbe',
            nav_league: '🏆 Wettbewerbe & Trophäen',
            nav_cup: '🏆 DFB-Pokal',
            nav_category_career: 'Karriere & Spezial',
            nav_manager_tree: '🌳 Manager-Talentbaum',
            nav_private: '🎩 Spezial & Privatleben',
            nav_admin: '🛠️ Admin & Cheats PRO',
            nav_office: '🏢 Managerbüro',
            office_title: 'MANAGERBÜRO',
            office_default_sentence: 'Wohin soll es gehen? Klick dich durch dein Büro.',
            office_to_dashboard: '📊 Zum Dashboard',
            office_enter: '🏢 Ins Managerbüro',
            office_hs_window: 'Fenster',
            office_hs_window_verb: 'Über das Vereinsgelände schauen',
            office_hs_calendar: 'Wandkalender',
            office_hs_calendar_verb: 'Den Terminplan studieren',
            office_hs_trophy: 'Trophäenschrank',
            office_hs_trophy_verb: 'Die Trophäen polieren',
            office_hs_tacticsboard: 'Taktiktafel',
            office_hs_tacticsboard_verb: 'Aufstellung und Taktik planen',
            office_hs_door: 'Tür',
            office_hs_door_verb: 'Zum Trainingsgelände gehen',
            office_hs_cabinet: 'Aktenschrank',
            office_hs_cabinet_verb: 'Spielerakten und Transfers durchgehen',
            office_hs_safe: 'Tresor',
            office_hs_safe_verb: 'Die Vereinskasse prüfen',
            office_hs_monitor: 'Monitor',
            office_hs_monitor_verb: 'Den Lagebericht auf dem Monitor lesen',
            office_hs_phone: 'Telefon',
            office_hs_phone_verb: 'Nachrichten abhören',
            office_hs_lamp: 'Schreibtischlampe',
            office_hs_lamp_verb: 'Das Licht umschalten',
            office_label_seats: 'Plätze',
            office_label_season: 'SAISON',
            office_label_matchday: 'Spieltag',
            office_label_trophies: 'TROPHÄEN',
            office_label_drawer_transfers: 'TRANSFERS',
            office_label_drawer_contracts: 'VERTRÄGE',
            office_label_drawer_scouting: 'SCOUTING',
            office_label_door_sign: 'TRAININGS-<br>GELÄNDE',
            header_konto: 'Vereins-Konto',
            header_holding: 'Holding-Konto',
            header_mgr_level: 'Manager-Level',
            header_fans_board: 'Fans / Vorstand',
            header_matchday: 'Spieltag',
            sound_on: '🔊 Sound: AN',
            sound_off: '🔇 Sound: AUS',
            lang_toggle_title: 'Sprache wechseln / Switch language',
            tutorial_prev: '← Zurück',
            tutorial_next: 'Weiter →',
            tutorial_start: "Los geht's! ⚽",
            tutorial_replay: '❓ Kurzanleitung erneut anzeigen',
            tutorial_1_title: '⚽ Willkommen beim {CLUB}!',
            tutorial_1_body: `Du übernimmst als Manager einen Klub in der <strong>6. Liga (Kreisklasse)</strong>. Dein Ziel: aufsteigen, den Verein ausbauen und irgendwann den Champions Cup holen.<br><br>
                <strong style="color:var(--primary);">Die Bereiche im Menü:</strong><br>
                ⚽ Kader &amp; Taktik · 🏟️ Ausbau &amp; Infrastruktur · 🏦 Finanzen &amp; Kapitalmarkt · 🏆 Wettbewerbe · 🎩 Spezial<br><br>
                <strong style="color:var(--accent);">Tipp:</strong> "▶ Spieltag starten" für Live-Erlebnis, "⚡ Saison durchsimulieren" für den schnellen Überblick.`,
            tutorial_2_title: '🌍 Scouting-Netzwerk 2.0',
            tutorial_2_body: `Statt eines einzelnen Chef-Scouts baust du ein <strong>Netzwerk aus Regional-Scouts</strong> auf (Südamerika, Afrika, Westeuropa, Osteuropa).<br><br>
                Jede Mission dauert echte <strong>Spieltage</strong> (kein Sofort-Ergebnis mehr) - und frisch gefundene Talente zeigen ihre Werte zunächst nur als <strong>ungefähre Spanne</strong>. Beobachte sie weiter oder zahle für eine genauere Auswertung, um Klarheit zu bekommen.<br><br>
                Alle je entdeckten Spieler landen dauerhaft in der <strong>Talent-Datenbank</strong> zum Nachschlagen.`,
            tutorial_3_title: '🏗️ Stadion-Baustellen',
            tutorial_3_body: `Stadion-Ausbauten sind keine Sofortkäufe mehr: Du zahlst eine <strong>Anzahlung von 30%</strong>, der Rest wird erst bei Fertigstellung fällig.<br><br>
                Jedes Projekt hat eine echte <strong>Bauzeit</strong> (mehrere Spieltage) - im Stadion-Screen siehst du unter "Laufende Bauprojekte" den Fortschritt.<br><br>
                Die Preise skalieren mit deiner Liga: In der Bundesliga kosten große Ausbauten realistische zweistellige Millionenbeträge, in unteren Ligen bleibt es erschwinglich.`,
            tutorial_4_title: '🤖 Personal-Automatisierung',
            tutorial_4_body: `Mehrere Personal-Rollen können jetzt <strong>eigenständig Aufgaben übernehmen</strong>, wenn du sie im Personal-Screen auf "Automatik" statt "Manuell" stellst:<br><br>
                🔭 Chef-Scout: entsendet freie Scouts automatisch<br>
                📋 Sportdirektor: verlängert auslaufende Verträge<br>
                📈 Marketing-Direktor: nimmt gute Sponsoren-Angebote an<br>
                🎯 Standards-Spezialist: wählt die besten Elfmeter-/Freistoß-/Eckenschützen<br><br>
                So bleibt der Verein auch am Laufen, wenn du dich lieber auf Taktik und Transfers konzentrierst.`
        },
        en: {
            nav_category_main: 'Main HQ',
            nav_dashboard: '📊 FM13 Dashboard',
            nav_calendar: '📅 Calendar & Fixtures',
            nav_inbox: '📬 Inbox',
            nav_category_team: 'Team & Squad',
            nav_squad: '⚽ Squad & 3D Tactics',
            nav_second_team: '🥈 Reserve Team',
            nav_training: '🏋️ Training & Development',
            nav_transfer: '🤝 Squad Planning & Transfers',
            nav_category_infra: 'Facilities & Infrastructure',
            nav_stadium: '🏟️ Facilities & Infrastructure',
            nav_category_finance: 'Finance & Business',
            nav_finances: '🏦 Finance & Capital Markets',
            nav_industry: '🏭 Industry & Merchandising',
            nav_category_competitions: 'Competitions',
            nav_league: '🏆 Competitions & Trophies',
            nav_cup: '🏆 National Cup',
            nav_category_career: 'Career & Special',
            nav_manager_tree: '🌳 Manager Talent Tree',
            nav_private: '🎩 Special & Private Life',
            nav_admin: '🛠️ Admin & Cheats PRO',
            nav_office: "🏢 Manager's Office",
            office_title: "MANAGER'S OFFICE",
            office_default_sentence: 'Where to? Click your way around the office.',
            office_to_dashboard: '📊 To the dashboard',
            office_enter: "🏢 Enter the office",
            office_hs_window: 'Window',
            office_hs_window_verb: 'Look out over the club grounds',
            office_hs_calendar: 'Wall calendar',
            office_hs_calendar_verb: 'Study the schedule',
            office_hs_trophy: 'Trophy cabinet',
            office_hs_trophy_verb: 'Polish the trophies',
            office_hs_tacticsboard: 'Tactics board',
            office_hs_tacticsboard_verb: 'Plan line-up and tactics',
            office_hs_door: 'Door',
            office_hs_door_verb: 'Head out to the training ground',
            office_hs_cabinet: 'Filing cabinet',
            office_hs_cabinet_verb: 'Go through player files and transfers',
            office_hs_safe: 'Safe',
            office_hs_safe_verb: 'Check the club funds',
            office_hs_monitor: 'Monitor',
            office_hs_monitor_verb: 'Read the status report on the monitor',
            office_hs_phone: 'Telephone',
            office_hs_phone_verb: 'Listen to your messages',
            office_hs_lamp: 'Desk lamp',
            office_hs_lamp_verb: 'Switch the light',
            office_label_seats: 'seats',
            office_label_season: 'SEASON',
            office_label_matchday: 'Matchday',
            office_label_trophies: 'TROPHIES',
            office_label_drawer_transfers: 'TRANSFERS',
            office_label_drawer_contracts: 'CONTRACTS',
            office_label_drawer_scouting: 'SCOUTING',
            office_label_door_sign: 'TRAINING<br>GROUND',
            header_konto: 'Club Account',
            header_holding: 'Holding Account',
            header_mgr_level: 'Manager Level',
            header_fans_board: 'Fans / Board',
            header_matchday: 'Matchday',
            sound_on: '🔊 Sound: ON',
            sound_off: '🔇 Sound: OFF',
            lang_toggle_title: 'Sprache wechseln / Switch language',
            tutorial_prev: '← Back',
            tutorial_next: 'Next →',
            tutorial_start: "Let's go! ⚽",
            tutorial_replay: '❓ Show tutorial again',
            tutorial_1_title: '⚽ Welcome to {CLUB}!',
            tutorial_1_body: `You take over as manager of a club in the <strong>bottom division</strong>. Your goal: get promoted, build up the club, and eventually win the Champions Cup.<br><br>
                <strong style="color:var(--primary);">The areas in the menu:</strong><br>
                ⚽ Squad &amp; Tactics · 🏟️ Facilities &amp; Infrastructure · 🏦 Finance &amp; Capital Markets · 🏆 Competitions · 🎩 Special<br><br>
                <strong style="color:var(--accent);">Tip:</strong> "▶ Start matchday" for the live experience, "⚡ Simulate season" for a quick overview.`,
            tutorial_2_title: '🌍 Scouting Network 2.0',
            tutorial_2_body: `Instead of a single chief scout, you build a <strong>network of regional scouts</strong> (South America, Africa, Western Europe, Eastern Europe).<br><br>
                Every mission takes real <strong>matchdays</strong> (no more instant results) - and freshly found talents only show their stats as an <strong>approximate range</strong> at first. Keep observing them or pay for a more precise assessment to get clarity.<br><br>
                Every player ever discovered stays permanently in the <strong>talent database</strong> for later lookup.`,
            tutorial_3_title: '🏗️ Stadium Construction',
            tutorial_3_body: `Stadium upgrades are no longer instant purchases: you pay a <strong>30% deposit</strong>, the rest is only due on completion.<br><br>
                Every project has a real <strong>build time</strong> (several matchdays) - the stadium screen shows the progress under "Ongoing construction projects".<br><br>
                Prices scale with your league: in the top division, big upgrades cost realistic double-digit millions, while lower leagues stay affordable.`,
            tutorial_4_title: '🤖 Staff Automation',
            tutorial_4_body: `Several staff roles can now <strong>take over tasks on their own</strong> if you set them to "Automatic" instead of "Manual" on the staff screen:<br><br>
                🔭 Chief scout: dispatches free scouts automatically<br>
                📋 Sporting director: renews expiring contracts<br>
                📈 Marketing director: accepts good sponsor offers<br>
                🎯 Set-piece specialist: picks the best penalty/free-kick/corner takers<br><br>
                That way the club keeps running even if you'd rather focus on tactics and transfers.`
        }
    };

    function t(key) {
        return (I18N[currentLang] && I18N[currentLang][key]) || I18N.de[key] || key;
    }

    function applyI18nToDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        if (typeof renderTutorialPage === 'function') renderTutorialPage();
        let soundBtn = document.getElementById('btn-sound-toggle');
        if (soundBtn) soundBtn.innerText = isMasterSoundOn ? t('sound_on') : t('sound_off');
    }

    function setLanguage(lang) {
        currentLang = lang === 'en' ? 'en' : 'de';
        safeLocalSet('anstoss_fm13_language', currentLang);
        applyI18nToDOM();
    }

    function toggleLanguage() {
        setLanguage(currentLang === 'de' ? 'en' : 'de');
    }

    function initLanguage() {
        let stored = safeLocalGet('anstoss_fm13_language');
        currentLang = stored === 'en' ? 'en' : 'de';
        applyI18nToDOM();
    }
