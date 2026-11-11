# Portierung: Stand je Ordner und Modul

Diese Liste geht jeden Ordner des Repositorys und jedes Modul des Browserspiels durch und hält fest, was davon in der Unreal-Fassung steckt. Sie wird mit jeder Runde fortgeschrieben.

Bedeutung der Spalte „Stand“:
- **portiert**: Die Regeln sind übernommen, die Formeln wo möglich 1:1 und gegen das Browserspiel geprüft.
- **teilweise**: Der Kern ist da, Teile fehlen oder sind vereinfacht (Spalte „In Unreal“).
- **offen**: Noch nicht in Unreal.
- **entfällt**: Gehört zur Browser-Oberfläche. In Unreal übernimmt das die Engine selbst (Slate, Eingaben, Lokalisierung).

Stand nach Runde B und der Stärkeformel: **17 portiert, 33 teilweise, 84 offen, 11 entfallen** (von 145 Modulen in `js/`).

## Ordner

| Ordner | Inhalt | In Unreal |
|---|---|---|
| `js/` | 145 Module, rund 45.000 Zeilen: das ganze Spiel | Schrittweise nach `unreal/Source/AnstossFM13/` (Liste unten) |
| `css/` | Aussehen der Browser-Oberfläche (Themes, Farben) | Die Farben des dunklen Themes stecken im Menü (`FM13Menu.cpp`) und in der Textansicht |
| `index.html` | Seitengerüst mit allen Bildschirmen | Menü-Seiten (`FM13Menu`) |
| `tests/` | Playwright-Tests des Browserspiels, alte Spielstände | Die Spielstände in `tests/fixtures/saves` prüfen den Import (`KernTest.cpp`) |
| `scripts/` | Bot-Läufe und Auswertungen | Der Bot-Manager aus `longrun-bundesliga.js` steckt vereinfacht in `TestBotKarriere` |
| `docs/` | Projekt-Historie, Einsteiger-Test | Bleibt Doku; für Unreal gibt es `unreal/README.md` und diese Liste |
| `dist/` | Gebaute Browser-Fassungen | Entfällt (in Unreal baut die Engine) |
| `.github/` | CI: Test und Veröffentlichung | Neuer Job `unreal-host-tests` startet `unreal/Tests/Host/run.sh` |
| `runenfeuer/` | Eigenes Spiel (Clan-Krieg mit Orks und Magiern), nicht Teil des Fußballmanagers | Nicht übernommen. Bei Bedarf als eigenes Unreal-Projekt |
| `unreal/` | Die Unreal-Fassung selbst | – |

## Module in `js/`

### Kern und Spielablauf

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `state.js` | 688 | teilweise | Spielzustand | FFM13World (nur die portierten Felder) |
| `entities.js` | 314 | portiert | Spieler und Vereine | FM13Economy (Marktwert, Gehalt 1:1), FM13Names, CreatePlayer |
| `utils.js` | 167 | portiert | Torformel, Tabellenreihenfolge | FM13Match::ExpectedGoals, Poisson, FM13CompareRows |
| `leagues.js` | 425 | portiert | 6 Ligen, Spielplan, Auf- und Abstieg | FM13League, FM13World::AdvanceLeagues |
| `match.js` | 632 | teilweise | Spieltag-Ablauf, Teamstärke | calcTeamStrength 1:1 (FM13Strength, 60 Vergleichsfälle gegen das Browserspiel), Heimvorteil der KI, Eingespieltheit. Neutral bis zum Port: Kabine, Unterwelt, Fan-Aktionen, Team-Anweisungen, Trainingslager, Spielerrollen, Zweikampfhärte bei Karten und Verletzungen |
| `match-post.js` | 567 | teilweise | Vorstand, Entlassung | CheckJobSecurity, CheckSeasonEndSacking (Pressestimmen offen) |
| `season-end.js` | 601 | teilweise | Saisonende, Budgets | ConcludeSeason, PlanSeason mit Liga-Budget, Platzfaktor, Untergrenze, Abstiegsklausel, Rücklagen und Aufstiegsbudget (halbes Liga-Transferbudget, Schub für die nächste Saison). Offen: Eigengehalt des Managers (gehört zum Privatleben und braucht die Ausgabenbuchung) |
| `save.js` | 663 | portiert | Spielstand | FM13SaveCodec, Autosave, Slots |
| `save-safety.js` | 297 | portiert | Sicheres Speichern und Laden | Prüfen vor dem Übernehmen, Zwischendatei, .bak |
| `inbox.js` | 261 | portiert | Postfach | Messages, Postfach-Seite |
| `relegation.js` | 143 | portiert | Relegation | FFM13World::PlayRelegation (Runde A) |
| `weather.js` | 69 | portiert | Wetter | FM13Match::Weathers (Runde A) |
| `referees.js` | 66 | portiert | Schiedsrichter | FM13Match::RefereeFor, Karten und Sperren (Runde A) |

### Spiel und Taktik

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `opponent-tactics.js` | 98 | portiert | Gegner-Taktik | FM13Tactics, PrepareOppPlan (Runde A) |
| `tactic-system.js` | 67 | teilweise | Taktik-Bilanz | Taktik-Seite im Menü (Bilanz je Kombination offen) |
| `squad.js` | 1022 | teilweise | Kader, Formationen | Kader-Seite, Formationen, Aufstellung von Hand, automatische Aufstellung wie pickBestLineupIds (40 Vergleichsfälle), Moral, Charakter, Traits |
| `matchprep.js` | 940 | offen | SPIELVORBEREITUNG (Phase 26.1): Aufstellungs- und Taktikvorlagen sowie der Spieltag-Check |  |
| `match-prep.js` | 86 | portiert | Spielvorbereitung | SetMatchPrep: Ansatz des Gegners treffen gibt +2,5 (1:1), Taktik-Seite |
| `match-scout.js` | 74 | teilweise | Spielprognose | Forecast aus der Torerwartung (Sieg/Remis/Niederlage), Taktik-Seite |
| `match-live.js` | 1536 | offen | LIVE-STATISTIK |  |
| `live-3d.js` | 362 | teilweise | 3D-Livespiel | 3D-Stadion mit Spielern und Ball (echtes Livespiel offen) |
| `spielphysik.js` | 1437 | offen | Spielphysik im Livespiel: Ball und 22 Spieler werden physikalisch berechnet (Schwerkraft, |  |
| `set-pieces.js` | 373 | offen | Standards im Livespiel: Elfmeter (Schützenwahl mit Trefferchance), Freistoß in Tornähe |  |
| `set-piece-drills.js` | 87 | offen | Standards einstudieren (Phase 22.3): "Standards" ist eine echte Einheit im Wochenplan |  |
| `reaktionsspiel.js` | 234 | offen | Reaktionsspiele bei Standards (Elfmeter, Freistoß, Ecke): Ein Cursor läuft über eine Leist |  |
| `co-trainer-live.js` | 213 | offen | Co-Trainer im Livespiel (Phase 21.3): nach jeder Szene prüft der Co-Trainer (staffMembers. |  |
| `pregame-talk.js` | 119 | portiert | Kabinenansprache | ChooseTalk: drei Ansprachen, Bonus nach Lage und Abnutzung (1:1), Taktik-Seite |
| `referee-critique.js` | 135 | offen | Schiedsrichter-Kritik nach dem Spiel (Phase 22.4): das Livespiel merkt sich strittige |  |
| `derby-week.js` | 224 | teilweise | Derby-Woche | Rivale, Stimmung, Prämie, Kampfansage mit Folgen (Runde B); Fan-Aktionen offen |
| `ausschreitungen.js` | 216 | offen | Ausschreitungen (Board-Karte "Ausschreitungen mehr ausbauen"): |  |
| `ausschreitungen-szene.js` | 260 | offen | Ausschreitungen als Bild (Canvas): Szene im Fanblock nach dem Abpfiff (Fenster), Effekt im |  |
| `live-fenster.js` | 138 | entfällt | Livespiel-Fenster im Browser | eigene Seite in Unreal |

### Wettbewerbe

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `cup.js` | 299 | portiert | DFB-Pokal | FM13Cup, PlayCupRound |
| `landescup.js` | 201 | portiert | Landespokal | FM13Cup, Qualifikation für den DFB-Pokal |
| `cup-live.js` | 210 | offen | Pokal als Livespiel: An Pokal-Spieltagen spielt der Nutzer die eigene Partie im DFB-Pokal, |  |
| `cup-final.js` | 182 | offen | Pokalfinale als Großereignis (DFB-Pokal und Landespokal): drei Spieltage vor dem Endspiel |  |
| `europe.js` | 646 | teilweise | Champions Cup | Zwei Vierergruppen, Halbfinale, Finale, Prämien, Qualifikation (Runde B); Auslosung vereinfacht |
| `national-team.js` | 172 | offen | Länderspiele & Turniere: feste Länderspielpausen nach den Spieltagen 6, 13, 24 und 30. |  |
| `league-awards.js` | 100 | teilweise | Liga-Auszeichnungen | Torschützenkönig, Spieler und Talent der Saison (Runde B); Elf der Saison offen |
| `league-stats.js` | 145 | teilweise | Liga-Statistik | Heim-/Auswärtstabelle, Liga-Statistik (Runde B); Torjägerliste aller Vereine offen |
| `promotion-boost.js` | 53 | teilweise | Aufstiegsschub | Aufstiegseuphorie +3 bis Spieltag 10, +1,5 bis 17. Offen: Aufstiegsbudget, TV-Vorschuss |
| `season-events.js` | 243 | offen | Saison-Ereignisse (Phase 15): Saisoneröffnung vor dem 1. Spieltag, Hallenturnier in der |  |
| `season-preview.js` | 151 | offen | Saisonvorschau & Experten-Check: vor jeder Saison tippen die Experten die komplette Tabell |  |
| `season-objectives.js` | 391 | offen | Season Goals & Objectives System |  |
| `scenarios.js` | 174 | offen | Karriere-Szenarien: beim "Neues Spiel" wählbare Herausforderungen mit eigenem Start |  |
| `club-geo.js` | 456 | offen | Vereine mit echten Orten und regionale Ligen (Phase 24.1). |  |
| `ai-clubs.js` | 136 | portiert | KI-Vereine: jeder KI-Klub hat einen namentlich bekannten Star (team.star). In beiden |  |
| `coach-carousel.js` | 107 | offen | Trainerkarussell: Jeder KI-Verein hat einen Trainer. Bei anhaltendem Misserfolg (hinten in |  |

### Kader und Spieler

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `player-development.js` | 117 | portiert | Entwicklungstypen | FM13Development (Runde A) |
| `player-retirement.js` | 112 | teilweise | Karriereende, Legenden | Ruhestand, Legenden (Runde A) |
| `player-stats.js` | 119 | portiert | Spielerstatistik und Noten | Tore, Vorlagen, Noten (120 Vergleichsfälle gegen computePlayerGrade), Spieler des Spiels, Elf des Spieltags mit Moralschub |
| `player-profile.js` | 101 | offen | Spieler-Karriereprofil (Phase 22.10): im Spieler-Popup statt der kurzen Karrierezeile ein |  |
| `playerdetail.js` | 309 | offen | SPIELER-DETAIL-POPUP: wiederverwendbares Modal für Kader, Transfermarkt, Scouting & |  |
| `player-compare.js` | 93 | offen | SPIELER-VERGLEICH (Phase 26.6): zwei Spieler nebeneinander, aus dem Spielerdetail geöffnet |  |
| `player-scandals.js` | 180 | offen | Spieler-Skandale |  |
| `squad-radar.js` | 231 | offen | SQUAD-STRENGTH-RADAR |  |
| `squadplanning.js` | 262 | offen | KADERPLANUNGSTOOL |  |
| `locker-room.js` | 187 | portiert | Kabine: Nationen, Cliquen, Stimmung, Rangordnung, Kapitän, Kabinen-Freunde | FM13Locker, FFM13World::CliqueModifier/TickLockerRoom/ChangeCaptain/TickFriendships (Kabinentests). Offen: Anzeige im Menü, Freundschaft bei Abgang, Büro-Besuch |
| `team-council.js` | 186 | portiert | Mannschaftsrat | Monatliches Anliegen (Stimmung, Kabine, Einsatzzeit, Training, Siegesserie), Antworten mit Kosten nach Liga, Verfall nach vier Spieltagen, Verlauf. 2 Antworttypen sind mit Tests gegen die Regel geprüft, Kabinen-Antworten mit Kapitänswechsel über den Kern
| `contracts.js` | 296 | teilweise | Verträge | Verlängern mit Verhandlung wie im Browserspiel: Angebot aus Forderung, Laufzeit, Garantie (15 Einsätze, 15 % weniger), Gegenangebot (10 % weniger, zwei Absagen sperren die Saison), Handgeld und Berater, Einsatzgarantie am Saisonende. Ausstiegsklauseln: setzen ab 110 Prozent des Marktwerts (Moral +6 bis 130 Prozent), entfernen, tägliche Auslösung mit Käufer aus der Klubliste (Wurf je Spieltag). Offen: Sportdirektor-Rabatt, Gehaltsbudget-Prüfung mit der Liste der Verträge, Fan-Reaktion beim Verkauf eines Publikumslieblings |
| `contract-tools.js` | 222 | offen | VERTRAGS- UND TRANSFER-WERKZEUGE (Phase 26.2): Gehalts-Ampel, Verlängerungs-Assistent, |  |
| `contract-ultimatum.js` | 222 | offen | (aus match.js ausgelagert - reine Datei-Organisation, keine Verhaltensänderung) |  |
| `bonusclauses.js` | 140 | portiert | ERFOLGSBASIERTE VERTRAGSBONI |  |
| `pro-loans.js` | 74 | offen | Profis verleihen (Phase 25.20): bisher ließen sich nur Spieler der zweiten Mannschaft und  |  |
| `secondteam.js` | 919 | offen | ZWEITE MANNSCHAFT: eigenständiger Klub, der parallel zur ersten Mannschaft ganz |  |
| `women-team.js` | 388 | offen | Frauenmannschaft: eigenes Team mit Kader, eigener Liga (12 Teams, 22 Spieltage parallel zu |  |
| `avatars.js` | 152 | offen | SPIELERPORTRÄTS: PROZEDURALE AVATARE |  |

### Transfers

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `transfermarket.js` | 1016 | teilweise | Transfermarkt, KI-Angebote | Markt, Kauf, Verkauf, KI-Angebote (Runde A), Transferbudget, Wechselfenster, Rückkauf-Ausübung, Gerüchte-Angebote, Leihspieler mit Kaufoption, Deadline-Day, Beraterprovision, freie Spieler, Tauschgeschäft im Poker, KI-Stern-Transfers. Direktverkauf wie sellPlayer(): 80 % Marktwert, Beraterprovision, Transferbudget, Kabinen-Freundschaft, Zweit-Klick bei eingespielter Elf. Offen: Scout-Rabatt (ohne Scout-Personal im Kern), Verhandlungsfuchs-Perk, Vereinslegenden und Publikumsliebling beim Abgang |
| `transfer-poker.js` | 288 | teilweise | Transferpoker: Spieler vom Transfermarkt werden einem echten KI-Verein abgekauft. Der |  |
| `transfer-strategy.js` | 131 | portiert | Transferstrategie mit dem Vorstand (Phase 25.18): zu Saisonbeginn (Spieltag 1-3, Karte |  |
| `medical-check.js` | 96 | portiert | Medizincheck bei Transfers (Phase 22.5): jeder Spieler auf dem Transfermarkt hat einen |  |
| `pre-contracts.js` | 202 | portiert | Vorverträge (Phase 22.6): ablösefreie Wechsel zur neuen Saison - in beide Richtungen. |  |
| `buyback.js` | 107 | portiert | Rückkaufoption beim Verkauf (Phase 22.7): ein Angebot für einen Spieler bis 25 Jahre kann |  |
| `rumors.js` | 142 | portiert (Medienimage und Verhandlungsperk folgen) | Gerüchteküche (Phase 22.8): nach Spieltagen tauchen Transfergerüchte auf (game.rumors, |  |
| `scouting.js` | 366 | offen | WELTWEITES Scouting-Netzwerk 2.0 (komplett neu aufgebaut) |  |
| `youth-sales.js` | 135 | portiert | Talente verkaufen | KI-Angebote für Talente (Runde A) |

### Jugend und Training

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `youth.js` | 464 | teilweise | Jugendakademie | Akademie-Stufen, Jahrgänge, Hochziehen |
| `youth-pathway.js` | 293 | teilweise | Jugend-Laufbahn: Profi-Entscheidung mit 19 (acht Spieltage Frist, Ausbildungsentschädigung), Leihe zu drei Vereinen, Rückkehr mit Bilanz, Durchbrüche, Meilensteine, Anzeige der Entscheidungen, Leihen und Rangliste auf der Jugend-Seite. Offen: Reserve-Wechsel |
| `youth-academy-extended.js` | 248 | teilweise | Monatliche Entwicklung mit Jugendtrainer, Schwerpunkt, Mentor und Alter (FFM13World::TickYouthDevelopment), Potenzialstufen. Offen: Talentranking im Menü, Jugendtrainer-Auswahl im Menü, Akademie-Erweiterung |
| `academy-ranking.js` | 138 | offen | Akademie-Rangliste |  |
| `training.js` | 874 | teilweise | Training | Wochenplan mit sieben Tagen, Standardpläne, Intensität, Kondition und Tagesform (60 Wochenpläne und 80 Kraftverluste gegen das Browserspiel geprüft). Offen: Einzeltraining, Trainingslager, eigene Vorlagen, Extras |
| `training-games.js` | 299 | offen | TRAINING-MINISPIELE (Elfmeterschießen & Flankentraining) |  |
| `medical-department.js` | 126 | teilweise | Verletzungen | Verletzungswurf wie im Browserspiel (80 Vergleichsfälle): Wochenplan, Intensität, Wetter, Härte, Alter, frühere Verletzungen, Reha und Physio. Offen: Verletzungen durch Ereignisse, Verlauf je Spieler, Panel |

### Finanzen und Wirtschaft

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `finances.js` | 1012 | teilweise | Buchungen, Kontoauszug, Insolvenz, Kredite | Book, Kontoauszug, Insolvenzkette (checkInsolvencyRisk: Warnung ab 3 Tagen, Transfersperre ab 6, Zwangsverkauf 60 % alle 10, Punktabzug alle 15 Tage), Kredite (Stufen kurz/mittel/lang mit Raten, Sondertilgung 85 %, Bonität mit Zinsaufschlag, Alt-Sofortkredit), Festgeld (drei Zinsstufen, eine Anlage), Kontoverlauf (letzte 20 Spieltage). Offen: Steuerberater und Krisenfest-Perk (Perks im Kern noch nicht da), Finanzzentrale |
| `financial-charts.js` | 225 | offen | FINANZ-DASHBOARD-CHARTS |  |
| `ffp.js` | 132 | portiert | Financial Fairplay |  |
| `media-rights.js` | 244 | teilweise | TV-Geld | TvMoney 1:1, Raten und Restausschüttung (Medienverträge offen) |
| `sponsors.js` | 835 | teilweise | Sponsoren | Hauptsponsor mit drei Angeboten (Runde A); Ärmel, Ausrüster, Banden offen |
| `sponsor-renewal.js` | 99 | teilweise | Sponsorverlängerung | Angebote 4 Spieltage vor Vertragsende (Runde A) |
| `merchandise.js` | 418 | teilweise | 3-KANAL FANSHOP VERTRIEB |  |
| `industry.js` | 332 | teilweise | Lange Liste: Karten zuklappen (js/abschnitte.js) |  |
| `commodities.js` | 41 | portiert | DYNAMISCHE ROHSTOFF-BÖRSE (ENGINE) |  |
| `holding.js` | 103 | portiert | Betriebswert der Holding: Grundwert plus 80 % der in Fabriken gesteckten Summe (Kauf |  |
| `stocks.js` | 292 | offen | AKTIENMARKT: ECHTE KURSBEWEGUNG, EVENTS & 3D-CHART |  |
| `betting.js` | 227 | offen | WETTBÜRO: FIKTIVER BUCHMACHER MIT ECHTEN QUOTEN |  |
| `real-estate.js` | 114 | portiert | Immobilien-Portfolio |  |
| `premium.js` | 264 | offen | Premium-Shop (SIMULIERT) |  |
| `underworld.js` | 141 | offen | NEUE UNTERWELT-AKTIONEN |  |

### Stadion und Fans

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `stadium.js` | 1306 | teilweise | Stadion | Kapazität, Ausbau, Zuschauer, Ticketpreis (Blöcke, Anlagen offen) |
| `stadium-tools.js` | 220 | offen | Stadion-Werkzeuge (Phase 26.21): Fans ohne Karte, Rendite je Ausbau, Bau-Chronik und |  |
| `stadium-events.js` | 124 | offen | Stadion-Events: Veranstaltungen im eigenen Stadion abseits der Ligaspiele. |  |
| `stadion-canvas.js` | 2222 | teilweise | Stadionansicht | AFM13StadiumActor in 3D (Gelände, Anlagen offen) |
| `fans.js` | 605 | offen | Zuschauerranking: die Top-Heimspiele nach Zuschauerzahl über die gesamte Karriere, |  |

### Verein, Vorstand, Medien

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `board-room.js` | 138 | portiert | Vorstand: vier Mitglieder, die je einen echten Bereich beurteilen und damit erklären, wohe |  |
| `member-assembly.js` | 181 | portiert | Mitgliederversammlung: nach jedem Saisonabschluss legt der Verein vor seinen Mitgliedern |  |
| `winter-talk.js` | 140 | portiert | Winterpausen-Gespräch mit dem Vorstand (Phase 22.9): nach der Hinrunde (Spieltag 18-20, |  |
| `media-department.js` | 243 | offen | Medienabteilung: aktive Pressearbeit auf dem einen echten Medienimage |  |
| `campus-staff.js` | 694 | teilweise | Personal | Wirkung von Co-Trainer, Analyst, Greenkeeper, Ernährungsberater, Athletiktrainer, Physio auf Stärke und Kondition (aus dem Browser-Spielstand). Offen: Einstellen, Ausbau, Verträge, übriges Personal |
| `crest.js` | 273 | offen | Vereins-Wappen-EDITOR |  |
| `freischaltungen.js` | 364 | offen | Freischaltungen (Board-Karte „Freischaltungssystem“): Bereiche, die erst mit einem gewachs |  |
| `achievements.js` | 56 | teilweise | Erfolge | 13 Erfolge (Runde A), Liste angepasst |
| `hall-of-fame.js` | 37 | offen | Hall of Fame |  |
| `history.js` | 133 | teilweise | Vereinsgeschichte | Laufbahn, Rekorde, Legenden |
| `career.js` | 395 | teilweise | Manager-Laufbahn | Laufbahn-Liste (Statistiken offen) |
| `manager-rpg.js` | 225 | teilweise | Manager-Talente | Perks Taktiker und Fitness-Guru wirken (aus dem Browser-Spielstand). Offen: Erfahrung, Talentbaum, übrige Perks |
| `manager-analytics.js` | 60 | offen | Manager-Statistik |  |
| `manager-tools.js` | 677 | offen | MANAGER-WERKZEUGE (Phase 26.4): Liquiditäts-Vorschau, Konto-Alarm, Spieler-Etiketten, |  |
| `insights.js` | 778 | offen | STATISTIK UND INFORMATION (Phase 26.3): Serien-Tracker, Formkurve je Spieler, CSV-Export, |  |
| `werkbank.js` | 298 | offen | Werkbank | 20 Auswertungen |

### Büro und Privatleben

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `office.js` | 477 | offen | MANAGERBÜRO - POINT-AND-CLICK STARTBILDSCHIRM |  |
| `office-events.js` | 420 | offen | BÜRO-EREIGNISSE: BESUCHER IM MANAGERBÜRO |  |
| `private-life.js` | 242 | teilweise | Privatleben | Trainerlizenz und Stress wirken auf die Teamstärke. Offen: alles andere |
| `private-life-extra.js` | 289 | offen | PRIVATLEBEN, ERWEITERUNG (Phase 26.19): Sparkonto, Fortbildungen, Mentaltraining, Gehaltsv |  |

### Oberfläche und Rahmen

| Modul | Zeilen | Stand | Inhalt | In Unreal |
|---|---:|---|---|---|
| `ui-core.js` | 412 | entfällt | Bildschirmwechsel HTML | Menü-Seiten, PlayerController |
| `ui-cards.js` | 53 | entfällt | Karten-Bausteine HTML | Slate-Bausteine im Menü |
| `render-dashboard.js` | 158 | teilweise | Übersicht | Übersichtsseite im Menü |
| `kopfzeile-fenster.js` | 262 | entfällt | Kopfzeilen-Fenster im Browser | Kopfzeile im Menü |
| `abschnitte.js` | 163 | entfällt | Abschnitts-Leisten im Browser | Slate-Seiten |
| `swipe-tabs.js` | 97 | entfällt | Wischen zwischen Reitern | – |
| `one-hand.js` | 285 | entfällt | Einhand-Bedienung Handy | – |
| `a11y.js` | 159 | entfällt | Barrierefreiheit im Browser | In Unreal über Slate selbst |
| `design-settings.js` | 204 | entfällt | Browser-Themes | Farben im Menü |
| `audio.js` | 83 | offen | Geräusche | Sound Cues in Unreal |
| `i18n.js` | 235 | offen | Englisch | Lokalisierung über FText |
| `i18n-ui.js` | 122 | offen | Englische Oberfläche | Lokalisierung über FText |
| `lexicon.js` | 312 | offen | Lexikon |  |
| `lexicon-en.js` | 249 | offen | Lexikon englisch |  |
| `calendar.js` | 247 | offen | Kalender |  |
| `startmenue.js` | 262 | offen | Startmenü |  |
| `onboarding.js` | 99 | offen | Erste Schritte |  |
| `einsteiger.js` | 200 | offen | Einsteiger-Modus |  |
| `neue-version.js` | 54 | entfällt | Neue-Version-Hinweis (GitHub Pages) | Patches über Unreal |
| `pakete.js` | 32 | entfällt | Update-Pakete des Browser-Builds | – |
| `admin.js` | 569 | offen | Admin-Menü | Entwickler-Werkzeuge |
| `admin-tools.js` | 328 | offen | Admin-Werkzeuge |  |

## Nächste Runden (Vorschlag)

1. **Runde B, Spiel (erledigt, Live-Statistik offen):** Aufstellung von Hand, Matchvorbereitung und Spielprognose, Kabinenansprache, Derby-Woche, Live-Statistik, Europapokal, Liga-Auszeichnungen und -Statistik.
2. **Runde C, Kader** (Spielerstatistik und Noten erledigt):  Kabine und Mannschaftsrat, Vertragsverhandlung und Ultimatum, Bonusklauseln, Leihen, zweite Mannschaft, Frauenteam.
3. **Runde D, Transfers:** Transferpoker, Medizincheck, Vorverträge, Rückkauf, Gerüchte, Scouting, Transferstrategie.
4. **Runde E, Wirtschaft:** Finanzzentrale, Fair Play, Merchandising, Industrie, Rohstoffe, Holding, Aktien, Wetten, Immobilien.
5. **Runde F, Verein:** Fans und Fan-Gruppen, Stadion-Blöcke und -Anlagen, Stadion-Events, Ausschreitungen, Vorstand, Mitgliederversammlung, Wintergespräch, Medienabteilung, Mitarbeiter, Wappen, Freischaltungen.
6. **Runde G, Rahmen:** Büro, Privatleben, Manager-Talente, Startmenü, Einsteiger-Modus, Lexikon, Englisch, Admin-Menü, Klänge.
7. **Runde H, Livespiel:** 3D-Livespiel mit Ballphysik, Standards und Reaktionsspielen.
