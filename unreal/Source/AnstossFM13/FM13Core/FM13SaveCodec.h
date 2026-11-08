#pragma once

#include "FM13World.h"

// Spielstand als JSON-Text. Im Kern statt mit FJsonObject, damit der Rundlauf ohne Engine testbar ist.
// Die UE-Schicht (UFM13GameInstance) schreibt und liest nur die Datei.
// Wie loadSaveSafely() im Browserspiel: Decode prüft den Stand und lässt das Ziel bei einem Fehler unverändert.
namespace FM13Save
{
	constexpr int32 Version = 1;

	FString Encode(const FFM13World& World);
	bool Decode(const FString& Text, FFM13World& OutWorld, FString& OutError);
}
