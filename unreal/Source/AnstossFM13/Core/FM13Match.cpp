#include "FM13Match.h"

namespace FM13Match
{
	float GoalBonus(EFM13Playstyle Style)
	{
		switch (Style)
		{
		case EFM13Playstyle::Offensiv: return 0.18f;
		case EFM13Playstyle::Defensiv: return -0.10f;
		case EFM13Playstyle::Konter: return 0.05f;
		default: return 0.f;
		}
	}

	float ConcedeBonus(EFM13Playstyle Style)
	{
		switch (Style)
		{
		case EFM13Playstyle::Offensiv: return 0.12f;
		case EFM13Playstyle::Defensiv: return -0.15f;
		case EFM13Playstyle::Konter: return -0.05f;
		default: return 0.f;
		}
	}

	FExpectedGoals ExpectedGoals(int32 HomeStrength, int32 AwayStrength, EFM13Playstyle HomeStyle, EFM13Playstyle AwayStyle)
	{
		const float Diff = (float)(HomeStrength - AwayStrength);
		FExpectedGoals R;
		R.Home = FMath::Clamp(1.35f + Diff * 0.045f, 0.15f, 5.5f);
		R.Away = FMath::Clamp(1.35f - Diff * 0.045f, 0.15f, 5.5f);
		// Spielstil: goalBonus erhöht die eigenen Tore, concedeBonus die Gegentore
		R.Home *= (1.f + GoalBonus(HomeStyle));
		R.Away *= (1.f + ConcedeBonus(HomeStyle));
		R.Away *= (1.f + GoalBonus(AwayStyle));
		R.Home *= (1.f + ConcedeBonus(AwayStyle));
		R.Home = FMath::Max(0.1f, R.Home);
		R.Away = FMath::Max(0.1f, R.Away);
		return R;
	}

	int32 Poisson(FRandomStream& Rng, float Lambda)
	{
		if (Lambda <= 0.f) return 0;
		const float L = FMath::Exp(-Lambda);
		int32 K = 0;
		float P = 1.f;
		do
		{
			++K;
			P *= Rng.FRand();
		} while (P > L && K < 30);
		return K - 1;
	}

	EFM13Expectation Expectation(int32 OwnStrength, int32 OppStrength)
	{
		const int32 Diff = OwnStrength - OppStrength;
		// getOwnMatchExpectation(): mehr als 4 Punkte Unterschied entscheiden
		if (Diff > 4) return EFM13Expectation::Favorit;
		if (Diff < -4) return EFM13Expectation::Aussenseiter;
		return EFM13Expectation::Offen;
	}

	int32 BoardShift(EFM13Expectation Erwartung, int32 OwnGoals, int32 OppGoals)
	{
		const int32 Ergebnis = OwnGoals > OppGoals ? 0 : (OwnGoals == OppGoals ? 1 : 2); // Sieg, Remis, Niederlage
		static const int32 Tabelle[3][3] = {
			{ 1, -1, -3 },  // Favorit
			{ 2, 0, -2 },   // offen
			{ 3, 1, -1 }    // Aussenseiter
		};
		return Tabelle[(int32)Erwartung][Ergebnis];
	}
}
