#!/usr/bin/env bash
# Baut und startet die Tests ohne Unreal Engine:
#  1. Spielkern (FM13Core) gegen eine Nachbildung der UE-Grundtypen
#  2. UE-Schicht (Game/) gegen eine dünne Engine-Nachbildung (nur eigene Logik, keine echten UE-Signaturen)
set -euo pipefail
cd "$(dirname "$0")"
SRC=../../Source/AnstossFM13
KERN=$SRC/FM13Core
OUT="${TMPDIR:-/tmp}"
g++ -std=c++17 -O2 -Wall -Wextra -Wshadow -Werror -I. -I"$KERN" -o "$OUT/fm13-kerntest" KernTest.cpp "$KERN"/*.cpp
"$OUT/fm13-kerntest"
g++ -std=c++17 -O1 -Wall -Wextra -Wshadow -Werror -Wno-unused-parameter -IUEMock -I. -I"$SRC" -I"$SRC/Game" -o "$OUT/fm13-uetest" \
	UETest.cpp UEMock/UEMock.cpp "$KERN"/*.cpp "$SRC"/Game/*.cpp "$SRC"/AnstossFM13.cpp
"$OUT/fm13-uetest"
