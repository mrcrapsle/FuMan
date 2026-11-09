#pragma once

#include "FM13World.h"

// Übernimmt einen Spielstand des Browserspiels (Datei aus „Spielstand als Datei exportieren“,
// js/save.js exportSaveToFile) in die Unreal-Fassung. Übernommen wird alles, was der Port kennt:
// Verein, Saison, Spieltag, Liga, Geld, Fans, Vorstand, Kader, Jugend, Stadion, Ticketpreis,
// alle sechs Ligen mit Tabellen und Spielplan, Pokale, Postfach und Laufbahn.
// Alles Weitere (Aktien, Immobilien, Privatleben ...) bleibt im Browserspiel; OutNotes nennt es.
namespace FM13BrowserImport
{
	bool Import(const FString& Text, FFM13World& OutWorld, FString& OutError, TArray<FString>& OutNotes, int32 Seed = 1);
}
