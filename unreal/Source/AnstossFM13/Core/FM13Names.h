#pragma once

#include "FM13Types.h"

// Namen für Spieler und Vereine (kleinere Auswahl als firstNames/lastNames in js/state.js).
namespace FM13Names
{
	FString PlayerName(FRandomStream& Rng);
	// Vereinsname, der in Used noch nicht vorkommt; wird dort eingetragen
	FString ClubName(FRandomStream& Rng, TArray<FString>& Used);
}
