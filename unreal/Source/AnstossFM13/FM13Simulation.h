#pragma once

#include "CoreMinimal.h"
#include "FM13Model.h"

// Port von getExpectedGoals() und poissonRandom() aus js/utils.js.
namespace FM13Sim
{
	struct FExpectedGoals
	{
		float HomeXg = 1.35f;
		float AwayXg = 1.35f;
	};

	// Erwartete Tore: Stärkedifferenz verschiebt beide Werte um 0,045 pro Punkt, Grenzen 0,15 bis 5,5.
	FExpectedGoals ExpectedGoals(int32 HomeStrength, int32 AwayStrength);

	// Knuth-Poisson-Zufall, wie in der JS-Fassung.
	int32 PoissonRandom(FRandomStream& Rng, float Lambda);

	FFM13MatchResult SimulateMatch(FRandomStream& Rng, int32 HomeStrength, int32 AwayStrength);
}
