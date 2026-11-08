#!/usr/bin/env bash
# Baut und startet die Kern-Tests ohne Unreal Engine.
set -euo pipefail
cd "$(dirname "$0")"
KERN=../../Source/AnstossFM13/Core
OUT="${TMPDIR:-/tmp}/fm13-kerntest"
g++ -std=c++17 -O2 -Wall -Wextra -Werror -I. -I"$KERN" -o "$OUT" KernTest.cpp "$KERN"/*.cpp
"$OUT"
