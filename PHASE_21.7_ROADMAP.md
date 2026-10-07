# Phase 21.7: Startzeit & Dateigröße — Ergebnis

Messung: `node scripts/measure-startup.js [datei] [läufe] [profil]` (Playwright, CPU 4x gedrosselt).

## Startzeit (v3.69, minifizierte Datei, Median aus 3 Läufen)

| Fall | DOMContentLoaded | Boot (window.onload) | bedienbar nach |
|---|---|---|---|
| Neues Spiel | 520 ms | 306 ms | 831 ms |
| Spielstand laden (nach 1 Saison) | 310 ms | 80 ms | 390 ms |
| Neues Spiel, nach 21.7 (1,38 MB) | 459 ms | 304 ms | 767 ms |

Die Startzeit ist kein Engpass mehr (der Struktur-Selbsttest beim Start fiel schon früher weg).
Der Rest ist fast nur Einlesen/Kompilieren des Skripts.

## Dateigröße

- Kein toter Code: alle 1.493 Funktionen werden aufgerufen (Lint `no-unused-vars` im Gesamtbündel).
- Zwei Drittel des Skripts sind Text (Spieltexte, HTML-Vorlagen, Vereinsnamen, Lexikon) - echter Inhalt.
- Phase 25.1 (Phase-23-Panels ohne Wirkung entfernt): 2,36 MB → 2,24 MB unminifiziert.
- `minify.js` (21.7): lokale Variablen verkürzen (`mangle: { toplevel: false }`, globale Namen
  bleiben wegen `onclick="…"`), CSS und HTML-Gerüst ohne Kommentare/Mehrfach-Leerraum:
  1,58 MB → 1,42 MB (gzip 419 → 388 KB).

## Bewusst nicht gemacht

- Code-Splitting / Lazy-Loading: das Spiel ist absichtlich EINE Offline-Datei - Aufteilen macht sie
  nicht kleiner, Nachladen geht auf `file://` in Android-WebViews nicht zuverlässig.
- Leerraum in JS-Vorlagen-Strings (~22 KB): Risiko für `white-space`-abhängige Texte, wenig Gewinn.
