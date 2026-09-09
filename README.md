# Anstoß Mobile Pro - FM13

## Struktur
- `index.html` — Grundgerüst, referenziert css/ und js/ Module
- `css/styles.css` — komplettes Styling
- `js/*.js` — Spiellogik, ein Modul pro Themenbereich
- `build.py` — fügt alles zu einer einzelnen, spielbaren Datei zusammen
- `tests/run-tests.js` — automatisierte Regressionstests (Playwright)

## Spielen / Testen auf dem Handy
```
python3 build.py
```
Erzeugt `dist/anstoss-fm13-standalone.html` — diese eine Datei per
Dateimanager öffnen (funktioniert auch offline, keine Ordnerstruktur nötig).

## Automatisierte Tests ausführen
Voraussetzung: Node.js + Playwright installiert (`npm install playwright`).
```
node tests/run-tests.js
```
Baut das Spiel automatisch neu und prüft u.a.:
- alle Screens laden ohne Konsolenfehler
- Kader-Rotation hält die Fitness über eine Saison stabil
- ein Team mit Stärke 99 dominiert die Liga zuverlässig
- Torschnitt in ausgeglichenen Ligen bleibt realistisch
- Speichern/Laden-Zyklus (inkl. Getter-Felder)
- Admin-Import/Export
- Pokal- und Europapokal-Simulation laufen fehlerfrei
- Kapitän/Elfmeter/Freistoß-Rollen sind nach Kader-Init korrekt gesetzt
- der Spielplan bleibt korrekt, auch wenn die Tabelle mittendrin angesehen wird

Bei jeder Code-Änderung einfach erneut ausführen, um Regressionen sofort
zu erkennen.

## Bekannte Lücken (kein Bug, aber unvollständig)
- Aktuell keine offenen bekannten Lücken dieser Art (Verletzungen, Moral, Manager-Stress
  und alle 7 Spieler-Traits wurden an echte Spielmechanik angebunden).

## Performance (Stand: Playwright-Messung)
- Ladezeit bis spielbereit: ~150-200ms
- Volle Saison durchsimulieren (34 Spieltage, 6 Ligen): ~60-150ms
- Screen-Wechsel: unter 2ms im Schnitt
- Speicherstand pro Slot: ~150 KB (3 Slots = weit unter dem Browser-Limit für localStorage)

## Ligasystem
- 6 Stufen von 1. Bundesliga bis 6. Liga (Landesliga), alle mit frei erfundenen,
  aber authentisch klingenden Vereinsnamen (keine echten Marken/Vereine).
- Der eigene Verein heißt "Lok Leipzig", Startpunkt ist die 6. Liga (Landesliga).
- Jedes Team hat einen Rivalen (Derby) und einen Fanfreund innerhalb der eigenen Liga.
- Heim-Derbys können zu Ausschreitungen führen (Geldstrafe + erzwungenes Geisterspiel
  beim nächsten Heimspiel), Risiko sinkt deutlich mit höherem Ordnerdienst-Wert.

## Finanzsystem (neueste Erweiterung)
- Echte Budget-Durchsetzung: Transfer- und Gehaltsbudget sind jetzt harte Kaufgrenzen,
  nicht mehr nur Anzeigewerte. Neuvergabe zu Saisonbeginn abhängig vom Tabellenplatz.
- Kredit-Staffelung mit drei echten Laufzeiten (kurz/mittel/lang) und automatischer
  Ratenzahlung pro Spieltag, max. 3 gleichzeitig laufende Kredite.
- Insolvenzrisiko: anhaltend negatives Konto führt zu Transfersperre (ab 6 Spieltagen),
  Zwangsverkauf (alle 10 Spieltage) und Punktabzug (alle 15 Spieltage).
- Wettbüro ("QuotenFuchs", fiktiver Buchmacher): Quoten aus Stärkedifferenz + Heimvorteil,
  Buchmacher-Marge sorgt für negativen Erwartungswert wie bei einem echten Anbieter,
  Einsatz gedeckelt auf 15% des Kontostands.
