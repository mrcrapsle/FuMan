#pragma once

#include "FM13Types.h"

// K.-o.-Wettbewerb (DFB-Pokal und Landespokal, js/cup.js und js/landescup.js).
// Die Vereine werden per Name geführt, ihre Stärke kommt beim Spiel aus der Liga.
struct FFM13CupMatch
{
	FString Home;
	FString Away;
	int32 HomeGoals = 0;
	int32 AwayGoals = 0;
	bool bPenalties = false;
	FString Winner;
};

struct FFM13Cup
{
	FString Name;
	TArray<FString> RoundNames;
	TArray<int32> RoundMatchdays;
	TArray<int64> Prizes;          // Prämie für das Weiterkommen in der Runde (Finale: für den Sieg)

	int32 Round = 0;               // nächste Runde
	TArray<FString> Alive;         // noch im Wettbewerb
	bool bOwnEntered = false;
	bool bOwnAlive = false;
	FString Winner;
	TArray<FFM13CupMatch> LastRound;

	bool IsFinished() const { return !Winner.IsEmpty() || Round >= RoundMatchdays.Num(); }
	int32 NextMatchday() const { return IsFinished() ? 0 : RoundMatchdays[Round]; }
	FString NextRoundName() const { return IsFinished() ? FString() : RoundNames[Round]; }
};

namespace FM13CupRules
{
	// DFB_POKAL_QUOTEN, DFB_POKAL_DIREKT_AB_LIGA
	constexpr int32 DfbDirectFromLevel = 2;   // 3. Liga und höher spielen direkt mit
	FFM13Cup MakeDfbPokal();
	FFM13Cup MakeLandespokal();
	// Elfmeterschießen: der Stärkere hat leichte Vorteile (30 bis 70 %)
	float PenaltyWinChance(int32 OwnStrength, int32 OppStrength);
}
