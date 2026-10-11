#!/usr/bin/env bash
# Startet einen Bot-Lauf und schreibt am Ende eine eindeutige Abschlusszeile in die Ausgabe.
# Aufruf (am besten mit nohup oder run_in_background starten):
#   scripts/bot-hintergrund.sh <ausgabedatei> <bot-argumente…>
#   LIGA=0 scripts/bot-hintergrund.sh mess.txt 10 passiv 6 bot.html
# Abschluss: letzte Zeile "=== ENDE exit=<code> ===". Ein Monitor sucht genau diesen Text.
# BOT überschreibt den Befehl (für Tests).
set -uo pipefail
cd "$(dirname "$0")/.."
ausgabe="${1:?Ausgabedatei fehlt}"
shift
BOT="${BOT:-node scripts/longrun-bundesliga.js}"
$BOT "$@" > "$ausgabe" 2>&1
code=$?
echo "=== ENDE exit=$code ===" >> "$ausgabe"
exit "$code"
