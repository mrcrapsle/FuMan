# Anstoß FM13 in Unreal Engine

Portierung des Browserspiels in ein Unreal-Engine-5-Projekt (C++). Der Spielkern ist vollständig in C++ geschrieben und ohne Engine getestet. Darüber liegen ein Menü mit Maussteuerung (Slate) und ein 3D-Stadion aus den Grundformen der Engine.

**Stand der Builds:** Der Spielkern und die Textoberfläche liefen bereits in Unreal Engine 5.8, ohne Fehler. Das Menü und das 3D-Stadion kamen danach und sind mit der echten Engine noch nicht gebaut. Falls beim Bauen Fehler kommen, bitte die Fehlerliste schicken.

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

Das Skript baut zwei Testprogramme mit g++:

1. **Spielkern** gegen eine Nachbildung der UE-Grundtypen. 3937 Prüfungen:
   - Marktwert, Gehalt und TV-Geld gegen Referenzwerte aus den Original-JS-Funktionen (`node unreal/Tests/Host/referenz.js`).
   - Spielplan, Tabelle, Finanzen, Auf- und Abstieg, Transfers, Verträge, Jugend, Stadion, Pokale, Verletzungen, Ticker, Entlassungsregeln.
   - Eigener Spielstand: Rundlauf, identisches Weiterspielen, Ablehnung kaputter Stände.
   - **Import:** Alle 11 echten Spielstände aus `tests/fixtures/saves` werden übernommen, die Tabellen passen zu den Spielplänen, und jeder Stand spielt 40 Spieltage weiter.
   - Bot-Karrieren über 15 Saisons.
2. **UE-Schicht** gegen eine dünne Engine-Nachbildung (37 Prüfungen): Tasten, Seiten, Saisonabschluss, Speichern, Laden, Autosave, Import über F8, Umschalten zur Textansicht. Menü und 3D-Stadion brauchen die echte Engine und sind hier ausgenommen.

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
- Transfermarkt: Kauf zum Angebotspreis, ohne Verhandlung
- Verträge, Stadion- und Akademieausbau, Verletzungen
- Live-Ticker als Text, 3D-Stadion aus Grundformen

**Noch nicht portiert:**

- Spiel: 3D-Livespiel mit Ballphysik, Taktik und Aufstellung von Hand, Standards, Europapokal, zweite Mannschaft, Frauenteam
- Wirtschaft: Sponsorenverhandlung, Medien, Merchandising, Aktien, Wetten, Immobilien, Holding, Industrie
- Darstellung: Büro, Privatleben, Vereinswappen und -farben
- Rahmen: Freischaltungen, Einsteiger-Modus, Erfolge, Werkbank, Lexikon, Englisch, Admin-Menü
