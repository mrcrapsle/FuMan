#pragma once

#include "CoreMinimal.h"

// Datenmodell des Spiels. Plain C++ (keine UCLASS), damit die Logik ohne Editor testbar bleibt.
// Entspricht den Feldern aus js/state.js und js/entities.js (game, squad, Liga-Tabelle).

enum class EFM13Position : uint8 { TW, ABW, MIT, ST };

struct FFM13Player
{
	int32 Id = 0;
	FString Name;
	EFM13Position Pos = EFM13Position::MIT;
	int32 Strength = 50;     // 0-99, Quelle der Spielstärke
	int32 Age = 24;
	int32 GoalsSeason = 0;
	int32 Wage = 0;          // Gehalt pro Spieltag in Euro
};

struct FFM13Team
{
	FString Name;
	int32 LeagueLevel = 5;
	TArray<FFM13Player> Squad;

	// Mannschaftsstärke: Mittel der besten 11 (Port von calcTeamStrength vereinfacht)
	int32 Strength() const;
};

struct FFM13TableRow
{
	FString Team;
	int32 Played = 0;
	int32 Won = 0;
	int32 Drawn = 0;
	int32 Lost = 0;
	int32 GoalsFor = 0;
	int32 GoalsAgainst = 0;

	int32 Points() const { return Won * 3 + Drawn; }
	int32 GoalDiff() const { return GoalsFor - GoalsAgainst; }
};

struct FFM13Fixture
{
	int32 Matchday = 0;
	int32 HomeIndex = 0;   // Index in der Ligaliste
	int32 AwayIndex = 0;
	bool bPlayed = false;
	int32 HomeGoals = 0;
	int32 AwayGoals = 0;
};

struct FFM13MatchResult
{
	int32 HomeGoals = 0;
	int32 AwayGoals = 0;
};
