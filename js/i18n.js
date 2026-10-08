
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
            nav_women: '👩 Frauenmannschaft',
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
            nav_lexicon: '📖 Spiel-Lexikon',
            nav_admin: '🛠️ Admin & Cheats PRO',
            nav_office: '🏢 Managerbüro',
            office_title: 'MANAGERBÜRO',
            office_default_sentence: 'Wohin soll es gehen? Klick dich durch dein Büro.',
            office_to_dashboard: '📊 Zum Dashboard',
            office_enter: '🏢 Ins Managerbüro',
            office_hs_crest: 'Vereinswappen',
            office_hs_crest_verb: 'Das Vereinswappen betrachten',
            office_outlook_home: 'Heimspiel',
            office_outlook_away: 'Auswärtsspiel',
            office_outlook_cup: 'Pokalabend',
            office_outlook_europe: 'Europapokal-Abend',
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
            office_hs_visitor: 'Besucherstuhl',
            office_hs_visitor_verb: 'Nachsehen, wer im Büro wartet',
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
            tutorial_1_body: `Du übernimmst den Verein in der <strong>{LIGA}</strong>. Dein Ziel: aufsteigen, den Verein ausbauen und irgendwann den Champions Cup holen.<br><br>
                <strong style="color:var(--primary);">Bedienung:</strong> Die Leiste unten führt zu Start, Kader, Transfer, Finanzen, Postfach und Speichern. Alles andere (Stadion, Jugend, Scouting, Personal ...) findest du im Menü <strong>☰</strong> oben links.<br><br>
                Auf dem Start-Bildschirm hakt eine Liste <strong>„Erste Schritte“</strong> die wichtigsten Stationen ab.`,
            tutorial_2_title: '🏟️ Der Spieltag',
            tutorial_2_body: `<strong>▶ Spieltag starten</strong> spielt live: Taktik ändern, auswechseln, Halbzeitansprache halten und die Statistik verfolgen. Pokalspiele kommen dabei vor dem Ligaspiel dran.<br><br>
                <strong>⏩ 5 Spieltage</strong> oder <strong>⚡ Saison durchsimulieren</strong> gehen schnell - die Elf stellt dann der Trainer auf.<br><br>
                <strong style="color:var(--accent);">Wichtig:</strong> Stammspieler ermüden. Vor dem Anpfiff warnt dich das Spiel und stellt auf Wunsch eine ausgeruhte Elf auf.`,
            tutorial_3_title: '💶 Geld & Vorstand',
            tutorial_3_body: `Einnahmen kommen aus Tickets, Sponsoren, Fanartikeln und TV-Geld, die größte Ausgabe sind die Gehälter (Gehaltsbudget beachten). Jede Buchung steht im Finanz-Journal.<br><br>
                Im Minus gilt eine Transfersperre. Der <strong>Vorstand</strong> bewertet Ergebnisse und Finanzen - bleibt seine Zufriedenheit zu lange im Keller, wirst du entlassen.`,
            tutorial_4_title: '📈 Der Weg nach oben',
            tutorial_4_body: `Platz 1 und 2 steigen direkt auf, Platz 3 spielt Relegation. Für jede höhere Liga verlangt der Verband <strong>Lizenzauflagen</strong>: Stadiongröße, Finanzreserve, ab der 3. Liga Flutlicht, ab der 2. Liga ein Jugendinternat. Die Übersicht steht im Stadion-Bildschirm - rechtzeitig erfüllen!<br><br>
                Verstärke den Kader über den Transfermarkt (neue Spieler zu jedem Wechselfenster) und die eigene Jugend.`
        },
        en: {
            nav_category_main: 'Main HQ',
            nav_dashboard: '📊 FM13 Dashboard',
            nav_calendar: '📅 Calendar & Fixtures',
            nav_inbox: '📬 Inbox',
            nav_category_team: 'Team & Squad',
            nav_squad: '⚽ Squad & 3D Tactics',
            nav_second_team: '🥈 Reserve Team',
            nav_women: '👩 Women\'s Team',
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
            nav_lexicon: '📖 Game Glossary',
            nav_admin: '🛠️ Admin & Cheats PRO',
            nav_office: "🏢 Manager's Office",
            office_title: "MANAGER'S OFFICE",
            office_default_sentence: 'Where to? Click your way around the office.',
            office_to_dashboard: '📊 To the dashboard',
            office_enter: "🏢 Enter the office",
            office_hs_crest: 'Club crest',
            office_hs_crest_verb: 'Look at the club crest',
            office_outlook_home: 'Home match',
            office_outlook_away: 'Away match',
            office_outlook_cup: 'Cup night',
            office_outlook_europe: 'European night',
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
            office_hs_visitor: 'Visitor chair',
            office_hs_visitor_verb: 'See who is waiting in the office',
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
            tutorial_1_body: `You take over the club in the <strong>{LIGA}</strong>. Your goal: get promoted, build up the club and eventually win the Champions Cup.<br><br>
                <strong style="color:var(--primary);">Controls:</strong> The bar at the bottom leads to Start, Squad, Transfer, Finance, Inbox and Save. Everything else (stadium, youth, scouting, staff ...) is in the <strong>☰</strong> menu at the top left.<br><br>
                On the start screen a <strong>"First steps"</strong> list ticks off the most important stations.`,
            tutorial_2_title: '🏟️ Matchday',
            tutorial_2_body: `<strong>▶ Start matchday</strong> plays live: change tactics, make substitutions, give a half-time talk and follow the stats. Cup matches come before the league match.<br><br>
                <strong>⏩ 5 matchdays</strong> or <strong>⚡ Simulate season</strong> are quick - the coach picks the line-up.<br><br>
                <strong style="color:var(--accent);">Important:</strong> regulars get tired. Before kick-off the game warns you and can field a rested XI.`,
            tutorial_3_title: '💶 Money & Board',
            tutorial_3_body: `Income comes from tickets, sponsors, merchandise and TV money; the biggest cost is wages (mind the wage budget). Every booking is listed in the finance journal.<br><br>
                A negative balance means a transfer ban. The <strong>board</strong> judges results and finances - if its satisfaction stays too low for too long, you get sacked.`,
            tutorial_4_title: '📈 The way up',
            tutorial_4_body: `Places 1 and 2 are promoted directly, place 3 plays a relegation play-off. Every higher league requires <strong>licence conditions</strong>: stadium size, financial reserve, floodlights from the 3rd league, a youth boarding school from the 2nd league. The overview is on the stadium screen - meet them in time!<br><br>
                Strengthen the squad via the transfer market (new players every window) and your own youth.`
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
        if (typeof applyUiTranslation === 'function') applyUiTranslation(currentLang);
    }

    function toggleLanguage() {
        setLanguage(currentLang === 'de' ? 'en' : 'de');
    }

    function initLanguage() {
        let stored = safeLocalGet('anstoss_fm13_language');
        currentLang = stored === 'en' ? 'en' : 'de';
        applyI18nToDOM();
        if (currentLang === 'en' && typeof applyUiTranslation === 'function') applyUiTranslation('en');
    }
