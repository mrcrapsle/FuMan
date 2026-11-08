#pragma once

#include "CoreMinimal.h"
#include "FM13Model.h"

// Liga: Rundenplan (Kreis-Methode, Hin- und Rückrunde) und Tabelle.
struct FFM13League
{
	TArray<FFM13Team> Teams;
	TArray<FFM13Fixture> Fixtures;
	TArray<FFM13TableRow> Table;
	int32 CurrentMatchday = 1;

	// Erzeugt den Spielplan für alle Teams (Hin- und Rückrunde). Bei ungerader Teamzahl gibt es ein Freilos.
	void BuildSchedule();

	// Bringt die Tabelle aus allen gespielten Spielen. Sortierung: Punkte, Tordifferenz, Tore.
	void RebuildTable();

	// Alle Partien des aktuellen Spieltags spielen (Ergebnisse über die Simulation).
	void PlayCurrentMatchday(FRandomStream& Rng);

	int32 MatchdayCount() const;
	bool IsSeasonFinished() const { return CurrentMatchday > MatchdayCount(); }
};
