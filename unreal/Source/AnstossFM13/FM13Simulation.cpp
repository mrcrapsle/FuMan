#include "FM13Simulation.h"

int32 FFM13Team::Strength() const
{
	if (Squad.Num() == 0) return 0;
	TArray<int32> Werte;
	for (const FFM13Player& P : Squad) Werte.Add(P.Strength);
	Werte.Sort([](int32 A, int32 B) { return A > B; });
	const int32 N = FMath::Min(11, Werte.Num());
	int64 Summe = 0;
	for (int32 i = 0; i < N; ++i) Summe += Werte[i];
	return static_cast<int32>(Summe / N);
}

namespace FM13Sim
{
	FExpectedGoals ExpectedGoals(int32 HomeStrength, int32 AwayStrength)
	{
		const float Diff = static_cast<float>(HomeStrength - AwayStrength);
		FExpectedGoals R;
		R.HomeXg = FMath::Max(0.15f, FMath::Min(5.5f, 1.35f + Diff * 0.045f));
		R.AwayXg = FMath::Max(0.15f, FMath::Min(5.5f, 1.35f - Diff * 0.045f));
		R.HomeXg = FMath::Max(0.1f, R.HomeXg);
		R.AwayXg = FMath::Max(0.1f, R.AwayXg);
		return R;
	}

	int32 PoissonRandom(FRandomStream& Rng, float Lambda)
	{
		// Knuth: multipliziere Zufallszahlen bis das Produkt unter exp(-lambda) fällt
		const float L = FMath::Exp(-Lambda);
		int32 K = 0;
		float P = 1.0f;
		do
		{
			++K;
			P *= Rng.FRand();
		} while (P > L && K < 20);
		return K - 1;
	}

	FFM13MatchResult SimulateMatch(FRandomStream& Rng, int32 HomeStrength, int32 AwayStrength)
	{
		const FExpectedGoals Xg = ExpectedGoals(HomeStrength, AwayStrength);
		FFM13MatchResult R;
		R.HomeGoals = PoissonRandom(Rng, Xg.HomeXg);
		R.AwayGoals = PoissonRandom(Rng, Xg.AwayXg);
		return R;
	}
}
