#!/usr/bin/env bash
# Prüfung vor jedem Merge/Push auf main - dieselben Schritte wie die CI, lokal und mit
# kurzer Zusammenfassung. Bricht beim ersten roten Schritt ab und zeigt nur die Fehler.
#   npm run check          alles
#   npm run check -- fast  ohne die minifizierte Variante (etwa halb so lang)
set -uo pipefail
cd "$(dirname "$0")/.."

LOGDIR="dist/check-logs"
mkdir -p "$LOGDIR"
START=$(date +%s)
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() {
    printf '  \033[31m✗ %s\033[0m\n' "$1"
    [ -n "${2:-}" ] && { echo; sed 's/^/      /' "$2" | tail -n "${3:-40}"; }
    echo; echo "PRÜFUNG FEHLGESCHLAGEN - nicht mergen. Volles Log: ${2:-}"
    exit 1
}

echo "== Prüfung vor dem Merge =="

python3 build.py > "$LOGDIR/build.log" 2>&1 || fail "Build" "$LOGDIR/build.log"
ok "Build ($(grep -o '[0-9]* Zeichen' "$LOGDIR/build.log"))"

[ -d node_modules ] || npm install --silent > "$LOGDIR/npm.log" 2>&1 || fail "npm install" "$LOGDIR/npm.log"
npm run --silent lint > "$LOGDIR/lint.log" 2>&1 || { grep -E ' error |✖' "$LOGDIR/lint.log" > "$LOGDIR/lint-errors.log"; fail "Lint" "$LOGDIR/lint-errors.log"; }
ok "Lint ($(grep -o '[0-9]* warnings' "$LOGDIR/lint.log" || echo '0 warnings'), 0 Fehler)"

[ -d tests/node_modules ] || (cd tests && npm install --silent) > "$LOGDIR/npm-tests.log" 2>&1 || fail "npm install (tests)" "$LOGDIR/npm-tests.log"

run_tests() { # $1 = Bezeichnung, $2 = GAME_FILE
    local log="$LOGDIR/tests-$2.log"
    (cd tests && GAME_FILE="$2" node run-tests.js) > "$log" 2>&1
    local code=$?
    local summary; summary=$(grep 'ERGEBNIS' "$log" | sed 's/ERGEBNIS: //')
    if [ $code -ne 0 ]; then
        sed -n '/Fehlgeschlagene Tests:/,$p' "$log" > "$LOGDIR/tests-failed.log"
        [ -s "$LOGDIR/tests-failed.log" ] || tail -n 30 "$log" > "$LOGDIR/tests-failed.log"
        fail "Tests $1 (${summary:-abgebrochen})" "$LOGDIR/tests-failed.log" 60
    fi
    ok "Tests $1 ($summary)"
}

run_tests "Standalone" "anstoss-fm13-standalone.html"

if [ "${1:-}" != "fast" ]; then
    npm run --silent minify > "$LOGDIR/minify.log" 2>&1 || fail "Minify" "$LOGDIR/minify.log"
    ok "Minify"
    run_tests "minifiziert" "anstoss-fm13-standalone.min.html"
fi

echo
echo "ALLES GRÜN nach $(( $(date +%s) - START ))s - bereit zum Mergen."
