# Anstoß FM13 in Unreal Engine

Portierung des Browserspiels in ein Unreal-Engine-5-Projekt (C++). Der Spielkern ist vollständig in C++ geschrieben und ohne Engine getestet. Darüber liegen ein Menü mit Maussteuerung (Slate) und ein 3D-Stadion aus den Grundformen der Engine.

**Stand der Builds:** Der Spielkern und die Textoberfläche liefen bereits in Unreal Engine 5.8, ohne Fehler. Das Menü, das 3D-Stadion und die Runden A und B kamen danach und sind mit der echten Engine noch nicht gebaut. Falls beim Bauen Fehler kommen, bitte die Fehlerliste schicken.

## Bauen und starten

Voraussetzungen (Windows):

- Unreal Engine 5.8 über den Epic Games Launcher (kostenlos)
- Visual Studio 2022 mit „Spieleentwicklung mit C++“

Schritte:

1. Rechtsklick auf `AnstossFM13.uproject` → „Generate Visual Studio project files“.
2. `AnstossFM13.sln` öffnen, Konfiguration „Development Editor“, Projekt `AnstossFM13` bauen (Strg + Umschalt + B).
3. F5 startet den Editor. Dort „Play“ drücken.

Die Datei `AnstossFM13.uproject` nie direkt in Visual Studio öffnen. Visual Studio schreibt sie dann in einer Kodierung um, die Unreal nicht lesen kann.

## Bedienung

Links das Menü, oben die Kennzahlen mit dem Knopf **„Spieltag spielen“**, rechts das 3D-Stadion. Alles geht mit der Maus, die Tasten funktionieren zusätzlich:

| Taste | Wirkung |
|---|---|
| Leertaste | nächster Spieltag, nach Spieltag 34 Saison abschließen |
| 1 bis 9, 0 | Seiten: Übersicht, Tabelle, Kader, Transfermarkt, Jugend, Finanzen, Postfach, Verein, Spiel, Pokal |
| T | Taktik: Formation, Spielstil, Plan des nächsten Gegners |
| Pfeil hoch/runter, Enter, Entf | Auswahl, Aktion, abgeben (wie in der Textansicht) |
| F5 / F9 | Spielstand 1 speichern / laden |
| F8 | Spielstand aus dem Browserspiel übernehmen |
| F2 | neue Karriere |
| F1 | zwischen Menü und alter Textansicht wechseln |

Nach jedem Spieltag speichert das Spiel automatisch (`Saved/SaveGames/autosave.json`), beim nächsten Start geht es dort weiter.

## Spielstand aus dem Browserspiel übernehmen

1. Im Browserspiel im Bereich Spielstand **„Als Datei exportieren“** wählen. Die Datei `anstoss-fm13-<Verein>-S<Saison>-SpT<Spieltag>.json` landet im Ordner **Downloads**.
2. Im Unreal-Spiel **F8** drücken oder unter **Karriere** auf „Browser-Spielstand übernehmen“ klicken. Das Spiel nimmt die neueste solche Datei aus Downloads oder aus `Saved/Import`.
3. Der bisherige Stand bleibt als Spielstand `vor-import` erhalten.

Übernommen wird alles, was die Unreal-Fassung kennt: Verein, Saison, Spieltag, Liga, Geld, Fans, Vorstand, Saisonziel, Kader, Talente, Stadion, Ticketpreis, Jugendakademie, alle sechs Ligen mit Tabellen und Spielplan, DFB- und Landespokal, Postfach und Laufbahn. Was es dort noch nicht gibt (Aktien, Immobilien, Privatleben, zweite Mannschaft und weiteres), nennt eine Meldung im Postfach.

## Was das Spiel inzwischen kann (Runde A)

- **Taktik:** 8 Formationen bestimmen die Startelf, 8 Spielstile geben Stärke und kosten Kraft. Gegner wählen ihren Ansatz nach Schere-Stein-Papier. Wer berechenbar spielt, wird gelesen; der Chef-Analyst verrät den Plan.
- **Spieltag:** Wetter (Tore, Verletzungen, Karten, Zuschauer), feste Schiedsrichter mit eigener Strenge, Gelbe und Rote Karten mit Sperren.
- **Relegation:** Platz 16 gegen den Dritten der Liga darunter, Platz 3 gegen den 16. der Liga darüber.
- **Sponsor:** Startvertrag, danach drei Angebote mit Laufzeit, Handgeld und Aufstiegsprämie.
- **Angebote:** KI-Vereine bieten für deine Spieler und Talente.
- **Entwicklung:** Jeder Spieler hat einen Entwicklungstyp mit eigenem Leistungshöhepunkt.
- **Ehrungen:** 13 Erfolge, Vereinsrekorde und Legenden beim Karriereende.

## Runde B

- **Aufstellung von Hand:** Auf der Kader-Seite holt „Rein“ einen Spieler in die Startelf, „Raus“ nimmt ihn heraus. Fehlende Plätze füllt das Spiel auf. „Automatisch aufstellen“ setzt wieder die beste Elf.
- **Moral und Charakter:** Jeder Spieler hat beides. Die Moral der Elf geht in die Spielstärke ein.
- **Kabinenansprache:** Drei Ansprachen vor dem Spiel. Der Bonus hängt von der Lage ab, und dieselbe Ansprache nutzt sich ab.
- **Spielvorbereitung und Prognose:** Du richtest die Woche auf einen Ansatz des Gegners aus. Triffst du ihn, gibt es +2,5 Stärke. Die Prognose nennt Sieg, Remis und Niederlage in Prozent.
- **Derby-Woche:** Jeder Verein hat einen Rivalen. Ab drei Spieltagen vor dem Derby kannst du Stimmung machen, eine Prämie zahlen oder eine Kampfansage machen.
- **Europapokal:** Platz 1 bis 4 der Bundesliga oder der DFB-Pokalsieg bringen dich hinein. Es gibt zwei Vierergruppen, Halbfinale und Finale, mit Prämien bis 25 Mio. €.
- **Spielerstatistik:** Vorlagen (Saison und Karriere) und eine Note nach jedem Ligaspiel für die Startelf. Der Kader zeigt Vorlagen und den Notenschnitt.
- **Liga:** Heim- und Auswärtstabelle, eine Liga-Statistik und Auszeichnungen am Saisonende.

## Teamstärke wie im Browserspiel

Die Stärke der eigenen Elf rechnet jetzt dieselbe Formel wie `calcTeamStrength()` im Browserspiel. Ein Skript führt die Originalfunktion in Node aus, und die Tests vergleichen 60 Fälle damit.

- **Kondition und Tagesform** zählen in die Stärke. Eine müde Elf spielt schwächer, die automatische Aufstellung wechselt deshalb erschöpfte Spieler aus.
- **Heimvorteil:** +3 daheim, auch für die Gegner. Auswärts helfen die mitgereisten Fans.
- **Kapitän, Fähigkeiten (Traits) und Eingespieltheit** geben Boni. Der Kader zeigt den Kapitän mit „(C)“.
- **Personal, Lizenz, Perks und Stress** aus dem Browser-Spielstand wirken mit.
- **Noten:** Die Note nach jedem Ligaspiel rechnet wie im Browserspiel (halbe Noten, Tagesform, Tore, Vorlagen, Zu-Null). Wer 1,5 oder besser bekommt, steht in der Elf des Spieltags und gewinnt 3 Moral.
- **Training der Woche:** Auf der Taktik-Seite planst du sieben Tage (ein Klick wechselt die Einheit) oder nimmst einen Standardplan. Der Schwerpunkt wirkt als Teamtraining, die Belastung auf das Verletzungsrisiko. Dazu die Intensität Locker, Normal oder Hart.
- **Personal im Verein:** Auf der Verein-Seite stellst du Co-Trainer, Athletiktrainer, Physio, Greenkeeper, Analyst und Ernährungsberater ein, wählst aus drei Bewerbern, bildest weiter, verlängerst Verträge und erhöhst Gehälter. Abwerbeversuche kommen vor, eine Bindungsprämie hält den Trainer.
- **Kabine:** Spieler kommen aus Nationen und Altersgruppen. Gleiche bilden Cliquen. Eine rumorende Clique zieht den Rest herunter, ein Kapitän mit Autorität bremst das. Der Mannschaftsrat (Kapitän plus zwei Führungsspieler) stabilisiert oder schwächt die Stimmung. Gelegentlich werden Mitspieler beste Freunde.
- **Mannschaftsrat:** Einmal im Monat meldet der Rat ein Anliegen, etwa eine schlechte Stimmung, einen übergangenen Spieler, harte Trainingsarbeit oder die Bitte um eine Prämie nach drei Siegen. Du antwortest auf der Kader-Seite. Unbeantwortet verfällt das Anliegen nach vier Spieltagen.
- **Jugend:** Jeder Talent bekommt eine Potenzialstufe. Monatlich wächst er nach seiner Grenze, je nach Jugendtrainer (bis 1,5), Schwerpunkt, Mentor und Alter. Ein Jugendtrainer kostet 15 000 €.
- **Jugend-Laufbahn:** Mit 19 musst du innerhalb von acht Spieltagen entscheiden: Profivertrag, Leihe oder abschied (dann gibt es eine Ausbildungsentschädigung). Talente können an drei Vereine verliehen werden und kommen mit Bilanz zurück. Erste Einsätze, Tore und Elf-Nominierungen der Absolventen stehen im Verlauf.
- **Verletzungen** entstehen wie im Browserspiel einmal je Spieltag in der Startelf. Wer schon oft verletzt war oder älter ist, fällt eher aus.
- **Aufstiegseuphorie:** +3 Stärke bis Spieltag 10 nach einem Aufstieg, +1,5 bis Spieltag 17.

Was aus jedem Ordner und Modul des Browserspiels schon in Unreal steckt, steht in [PORTIERUNG.md](PORTIERUNG.md).

## Grafik

Das Browserspiel enthält keine Bilddateien. Alle Grafik dort zeichnet der Code selbst (Canvas und CSS). In Unreal ist sie deshalb neu gebaut, aus Würfeln, Zylindern und Kugeln der Engine:

- Rasen mit Mähstreifen, Linien, Mittelkreis, Strafräume, Tore mit Netz.
- Tribünen: Die Reihenzahl wächst mit der Stadiongröße. Volle Reihen haben Vereinsfarbe, leere sind grau, nach der Auslastung des letzten Heimspiels.
- Flutlicht ab 10.000 Plätzen, Dach ab 25.000 Plätzen.
- 22 Spieler im 4-4-2, die sich bewegen, und ein Ball.
- Eine Kamera, die langsam kreist. Wie weit sie zur Seite schaut, legen `CameraSideOffset` und `OrbitSpeed` am `AFM13StadiumActor` fest.

## Aufbau

```
Source/AnstossFM13/
  FM13Core/   Spielkern, reines C++ ohne UCLASS (läuft auch ohne Engine)
    FM13Types          Grundtypen, Ligennamen, Konstanten
    FM13Economy        Marktwert, Gehalt, TV-Geld (1:1), Zuschauer, Sponsor
    FM13Match          Torerwartung mit Spielstilen, Poisson, Vorstand, Live-Ticker
    FM13League         Spielplan (Hin- und Rückrunde), Tabelle
    FM13Cup            DFB-Pokal und Landespokal
    FM13World          gesamter Spielzustand und alle Abläufe
    FM13SaveCodec      eigener Spielstand als JSON mit Prüfung
    FM13Json           JSON-Leser (auch für den Browser-Spielstand)
    FM13BrowserImport  Übernahme des Browser-Spielstands
    FM13Names          Spieler- und Vereinsnamen
  Game/       UE-Schicht
    FM13GameInstance     einzige Schnittstelle zum Kern (Blueprint-Funktionen, Speichern, Import)
    FM13ViewTypes        USTRUCTs für Blueprints und UMG
    FM13Menu             Menü in Slate
    FM13StadiumActor     3D-Stadion
    FM13GameMode, FM13PlayerController, FM13HUD   Start, Tasten, Textansicht
Tests/Host/   Tests ohne Engine
```

## Tests

```bash
unreal/Tests/Host/run.sh
```

Die CI startet das Skript bei jedem Push (Job `unreal-host-tests` in `.github/workflows/build-test.yml`).

Das Skript baut zwei Testprogramme mit g++:

1. **Spielkern** gegen eine Nachbildung der UE-Grundtypen. 5105 Prüfungen:
   - Marktwert, Gehalt und TV-Geld gegen Referenzwerte aus den Original-JS-Funktionen (`node unreal/Tests/Host/referenz.js`).
   - Teamstärke, Aufstellung, Noten, Wochenplan, Kraftverlust und Verletzungswurf gegen die Original-JS-Rechnung (`node unreal/Tests/Host/referenz-staerke.js`).
   - Spielplan, Tabelle, Finanzen, Auf- und Abstieg, Transfers, Verträge, Jugend, Stadion, Pokale, Verletzungen, Ticker, Entlassungsregeln.
   - Transferpoker (`FM13Poker`): Forderung, Schmerzgrenze, Geduld und Abbruch, Rivalen-Gebot, Gehaltsverhandlung, Verpflichtung; im Spielstand gespeichert.
   - Medizincheck, Rückkaufoption, Transferstrategie, Gerüchteküche, Vorverträge (`FM13Transfers`, `FFM13World`); Transferbudget und Wechselfenster; alles im Spielstand gespeichert.
   - Eigener Spielstand: Rundlauf, identisches Weiterspielen, Ablehnung kaputter Stände.
   - **Import:** Alle 11 echten Spielstände aus `tests/fixtures/saves` werden übernommen, die Tabellen passen zu den Spielplänen, und jeder Stand spielt 40 Spieltage weiter.
   - Bot-Karrieren über 15 Saisons.
2. **UE-Schicht** gegen eine dünne Engine-Nachbildung (44 Prüfungen): Tasten, Seiten, Saisonabschluss, Speichern, Laden, Autosave, Import über F8, Umschalten zur Textansicht. Menü und 3D-Stadion brauchen die echte Engine und sind hier ausgenommen.

## Stand der Portierung

**1:1 aus dem Browserspiel übernommen:**

- Torerwartung (`getExpectedGoals`) mit Spielstilen und Poisson-Toren
- Marktwert, Gehalt, kollektives TV-Geld (Raten pro Spieltag plus Restausschüttung)
- 6 Ligen mit je 18 Vereinen, Auf- und Abstieg 2/2, Entwicklung der KI-Vereine
- Vorstandsreaktion pro Spiel nach Erwartung (Favorit, offen, Außenseiter)
- Entlassung nur am Saisonende (Schwelle, Serie, Erholung, Saisonziel)
- DFB-Pokal mit Kontingenten und Prämien, Qualifikation über den Landespokal

**Vereinfacht:**

- Zuschauer, Sponsor, Gehaltsbudget, Saisonziel
- Training, Alterung, Jugend-Jahrgänge
- Transfermarkt: Kauf zum Angebotspreis mit Verkäufer und Mindestpreis; Transferpoker mit Verhandlung (Angebot, Gegenangebot, Gehalt)
- Verträge, Stadion- und Akademieausbau, Verletzungen
- Live-Ticker als Text, 3D-Stadion aus Grundformen

**Noch nicht portiert:**

- Spiel: 3D-Livespiel mit Ballphysik, Standards, Live-Statistik, zweite Mannschaft, Frauenteam
- Wirtschaft: Sponsorenverhandlung, Medien, Merchandising, Aktien, Wetten, Immobilien, Holding, Industrie
- Darstellung: Büro, Privatleben, Vereinswappen und -farben
- Rahmen: Freischaltungen, Einsteiger-Modus, Erfolge, Werkbank, Lexikon, Englisch, Admin-Menü
