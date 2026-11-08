#pragma once

#include "FM13Types.h"

// Eine Liga mit 18 Vereinen: Spielplan (Hin- und Rückrunde), Tabelle und Ergebnisse.
struct FFM13League
{
	int32 Level = 0;
	TArray<FFM13Club> Clubs;
	TArray<FFM13Fixture> Fixtures;

	// Kreis-Methode mit zufälliger Startreihenfolge; Rückrunde mit getauschtem Heimrecht
	void BuildSchedule(FRandomStream& Rng);
	void ResetStats();

	// Indizes der Vereine in Tabellenreihenfolge (Punkte, Tordifferenz, Tore, Name)
	TArray<int32> SortedIndices() const;
	int32 RankOf(int32 ClubIndex) const;
	int32 FindClub(const FString& Name) const;
	int32 FindOwn() const;

	void ApplyResult(FFM13Fixture& F, int32 HomeGoals, int32 AwayGoals);
	int32 MatchdayCount() const;
};

// compareTableRows aus js/leagues.js
bool FM13CompareRows(const FFM13Club& A, const FFM13Club& B);
