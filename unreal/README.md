# Anstoß FM13 in Unreal Engine

Portierung des Browserspiels in ein Unreal-Engine-5-Projekt (C++). Der Spielkern ist vollständig in C++ geschrieben und hier ohne Engine getestet. Die Oberfläche ist ein Platzhalter, der den ganzen Spielablauf bedienbar macht.

**Wichtig:** Ich konnte das Projekt nicht mit der echten Unreal Engine bauen, weil in meiner Umgebung kein Editor installiert ist. Kern und UE-Schicht sind gegen Nachbildungen geprüft (siehe [Tests](#tests)). Der erste echte Build bei dir kann noch Fehler in UE-spezifischen Aufrufen zeigen. Die Meldungen bitte zurückgeben, dann behebe ich sie.

## Bauen und starten

Voraussetzungen (Windows):

- Unreal Engine 5.4 über den Epic Games Launcher (kostenlos)
- Visual Studio 2022 mit „Spieleentwicklung mit C++“

Schritte:

1. Rechtsklick auf `AnstossFM13.uproject` → „Generate Visual Studio project files“.
2. `AnstossFM13.sln` öffnen, Konfiguration „Development Editor“, Projekt `AnstossFM13` bauen.
3. `AnstossFM13.uproject` doppelklicken. Der Editor öffnet die leere Karte `/Engine/Maps/Entry`.
4. „Play“ drücken. Das Spiel startet sofort, denn GameMode und GameInstance stehen in `Config/DefaultEngine.ini`.

Eine andere Engine-Version trägst du in `AnstossFM13.uproject` unter `EngineAssociation` ein. Gebaut für 5.4, neuere 5.x sollten passen.

## Steuerung (Platzhalter-Oberfläche)

| Taste | Wirkung |
|---|---|
| Leertaste | nächster Spieltag, nach Spieltag 34 Saison abschließen |
| 1 bis 9, 0 | Seiten: Übersicht, Tabelle, Kader, Transfermarkt, Jugend, Finanzen, Postfach, Verein, Spiel (Live-Ticker), Pokal |
| Pfeil hoch/runter | Auswahl in Listen |
| Enter | Aktion der Seite: kaufen (Markt), Vertrag +3 Jahre (Kader), hochziehen (Jugend), Ausbau (Verein) |
| Entf | verkaufen (Kader), entlassen (Jugend) |
| Pfeil links/rechts | Ticketpreis (Seite Verein) |
| F5 / F9 | Spielstand 1 speichern / laden |
| F2 | neue Karriere |

Nach jedem Spieltag speichert das Spiel automatisch (`Saved/SaveGames/autosave.json`), beim nächsten Start geht es dort weiter.

## Aufbau

```
Source/AnstossFM13/
  FM13Core/   Spielkern, reines C++ ohne UCLASS (läuft auch ohne Engine)
    FM13Types       Grundtypen, Ligennamen, Konstanten
    FM13Economy     Marktwert, Gehalt, TV-Geld (1:1), Zuschauer, Sponsor
    FM13Match       Torerwartung mit Spielstilen, Poisson, Vorstand, Live-Ticker
    FM13League      Spielplan (Hin- und Rückrunde), Tabelle
    FM13Cup         DFB-Pokal und Landespokal
    FM13World       gesamter Spielzustand und alle Abläufe
    FM13SaveCodec   Spielstand als JSON mit Prüfung
    FM13Names       Spieler- und Vereinsnamen
  Game/       UE-Schicht
    FM13GameInstance     einzige Schnittstelle der Oberfläche zum Kern (Blueprint-Funktionen)
    FM13ViewTypes        USTRUCTs für Blueprints und UMG
    FM13GameMode, FM13PlayerController, FM13HUD   Platzhalter-Oberfläche
Tests/Host/   Tests ohne Engine
```

Für eine richtige Oberfläche baust du UMG-Widgets, die nur die Funktionen von `UFM13GameInstance` aufrufen (`GetStatus`, `GetSquad`, `GetTable`, `BuyPlayer` …) und sich bei `OnStateChanged` neu zeichnen. Jede Aktion gibt über `OutReason` zurück, warum sie nicht ging, wie die Meldungen im Browserspiel.

## Tests

```bash
unreal/Tests/Host/run.sh
```

Das Skript baut zwei Testprogramme mit g++:

1. **Spielkern** gegen eine Nachbildung der UE-Grundtypen (`FString`, `TArray`, `FMath`, `FRandomStream`). Derzeit 3713 Prüfungen:
   - Marktwert, Gehalt und TV-Geld gegen Referenzwerte aus den Original-JS-Funktionen. Die Werte erzeugt `node unreal/Tests/Host/referenz.js` (aus dem Repo-Stamm).
   - Spielplan, Tabelle, Finanzen, Kontoauszug, Auf- und Abstieg über 12 Saisons.
   - Transfers, Verträge, Jugend, Stadion, Pokale, Verletzungen, Ticker, Entlassungsregeln.
   - Spielstand: Rundlauf, identisches Weiterspielen, Ablehnung kaputter Stände.
   - Bot-Karrieren über 15 Saisons: Ein einfacher Manager kommt mit den meisten Seeds bis in die 2. Liga oder Bundesliga.
2. **UE-Schicht** gegen eine dünne Engine-Nachbildung (28 Prüfungen). Das prüft meinen eigenen Code: Tasten, alle Seiten, Saisonabschluss, Speichern und Laden, Autosave, Rückfall auf die Sicherung. Ob die echten Engine-Signaturen stimmen, zeigt erst der Build im Editor.

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
- Training (Entwicklung pro Spieltag), Alterung, Jugend-Jahrgänge
- Transfermarkt: Kauf zum Angebotspreis, ohne Verhandlung, Medizincheck oder Gerüchte
- Verträge, Stadion- und Akademieausbau, Verletzungen
- Live-Ticker als Textverlauf

**Noch nicht portiert:**

- Spiel: 3D-Livespiel mit Ballphysik, Taktik und Aufstellung von Hand, Standards und Reaktionsspiele, Europapokal, zweite Mannschaft, Frauenteam
- Wirtschaft: Sponsorenverhandlung, Medien und Pressekonferenzen, Merchandising, Aktien, Wetten, Immobilien, Holding, Industrie
- Darstellung: Stadion-3D, Büro, Privatleben
- Rahmen: Freischaltungen, Einsteiger-Modus, Erfolge, Werkbank, Lexikon, Englisch, Admin-Menü

Die nächsten sinnvollen Schritte:

1. Den ersten echten Build machen und Fehler zurückmelden.
2. Aufstellung und Taktik von Hand.
3. UMG-Oberfläche statt HUD-Text.
4. Ein 3D-Spieltag mit dem vorhandenen Ticker als Drehbuch.
