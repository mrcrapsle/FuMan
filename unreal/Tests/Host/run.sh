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
# Slate-Menü und 3D-Szene brauchen die echte Engine; hier nur die übrige Logik (FM13_NO_SLATE)
GAME_CPP=$(ls "$SRC"/Game/*.cpp | grep -v -e FM13Menu.cpp -e FM13Stadium)
g++ -std=c++17 -O1 -Wall -Wextra -Wshadow -Werror -Wno-unused-parameter -DFM13_NO_SLATE -IUEMock -I. -I"$SRC" -I"$SRC/Game" -o "$OUT/fm13-uetest" \
	UETest.cpp UEMock/UEMock.cpp "$KERN"/*.cpp $GAME_CPP "$SRC"/AnstossFM13.cpp
"$OUT/fm13-uetest"
