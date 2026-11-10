#include "FM13Match.h"
#include "FM13Names.h"

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

	FExpectedGoals ExpectedGoals(double HomeStrength, double AwayStrength, EFM13Playstyle HomeStyle, EFM13Playstyle AwayStyle)
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

	TArray<FString> BuildTicker(FRandomStream& Rng, const FString& OwnName, const FString& OppName, bool bHome,
		const TArray<FString>& OwnScorers, int32 OppGoals, const TArray<FString>& OwnPlayers,
		const TArray<FString>& YellowCards, const TArray<FString>& RedCards, const FString& Weather, const FString& Referee)
	{
		struct FEreignis { int32 Minute; int32 Art; FString Name; }; // Art: 0 eigenes Tor, 1 Gegentor, 2 Chance, 3 Gegnerchance, 4 Gelb, 5 Rot
		TArray<FEreignis> Liste;
		TArray<int32> Belegt;
		auto FreieMinute = [&Rng, &Belegt]()
		{
			for (int32 Versuch = 0; Versuch < 50; ++Versuch)
			{
				const int32 M = Rng.RandRange(2, 90);
				if (M != 45 && !Belegt.Contains(M)) { Belegt.Add(M); return M; }
			}
			return Rng.RandRange(2, 90);
		};
		for (const FString& N : OwnScorers) Liste.Add({ FreieMinute(), 0, N });
		for (int32 g = 0; g < OppGoals; ++g) Liste.Add({ FreieMinute(), 1, FM13Names::PlayerName(Rng) });
		const int32 Chancen = Rng.RandRange(2, 4);
		for (int32 c = 0; c < Chancen; ++c)
		{
			const bool bEigen = Rng.RandRange(0, 1) == 0;
			const FString Name = bEigen && OwnPlayers.Num() ? OwnPlayers[Rng.RandRange(0, OwnPlayers.Num() - 1)] : FM13Names::PlayerName(Rng);
			Liste.Add({ FreieMinute(), bEigen ? 2 : 3, Name });
		}
		for (const FString& N : YellowCards) Liste.Add({ FreieMinute(), 4, N });
		for (const FString& N : RedCards) Liste.Add({ FreieMinute(), 5, N });
		Liste.Sort([](const FEreignis& A, const FEreignis& B) { return A.Minute < B.Minute; });

		const FString& Heim = bHome ? OwnName : OppName;
		const FString& Gast = bHome ? OppName : OwnName;
		TArray<FString> Out;
		Out.Add(FString::Printf(TEXT("1'  Anpfiff: %s gegen %s"), *Heim, *Gast));
		if (!Weather.IsEmpty() || !Referee.IsEmpty())
			Out.Add(FString::Printf(TEXT("    Wetter: %s, Schiedsrichter: %s"), Weather.IsEmpty() ? TEXT("-") : *Weather, Referee.IsEmpty() ? TEXT("-") : *Referee));
		int32 Eigen = 0, Gegner = 0;
		bool bPause = false;
		auto Stand = [&]() { return bHome ? FString::Printf(TEXT("%d:%d"), Eigen, Gegner) : FString::Printf(TEXT("%d:%d"), Gegner, Eigen); };
		for (const FEreignis& E : Liste)
		{
			if (!bPause && E.Minute > 45) { Out.Add(FString::Printf(TEXT("45'  Halbzeit, Stand %s"), *Stand())); bPause = true; }
			switch (E.Art)
			{
			case 0: ++Eigen; Out.Add(FString::Printf(TEXT("%d'  TOR fuer %s! %s trifft zum %s"), E.Minute, *OwnName, *E.Name, *Stand())); break;
			case 1: ++Gegner; Out.Add(FString::Printf(TEXT("%d'  Gegentor: %s trifft fuer %s, %s"), E.Minute, *E.Name, *OppName, *Stand())); break;
			case 2: Out.Add(FString::Printf(TEXT("%d'  Chance: %s scheitert knapp"), E.Minute, *E.Name)); break;
			case 3: Out.Add(FString::Printf(TEXT("%d'  %s hat eine Chance, aber vorbei"), E.Minute, *OppName)); break;
			case 5: Out.Add(FString::Printf(TEXT("%d'  ROTE KARTE fuer %s"), E.Minute, *E.Name)); break;
			default: Out.Add(FString::Printf(TEXT("%d'  Gelbe Karte fuer %s"), E.Minute, *E.Name)); break;
			}
		}
		if (!bPause) Out.Add(FString::Printf(TEXT("45'  Halbzeit, Stand %s"), *Stand()));
		Out.Add(FString::Printf(TEXT("90'  Abpfiff, Endstand %s"), *Stand()));
		return Out;
	}

	const TArray<FWeather>& Weathers()
	{
		static const TArray<FWeather> Liste = {
			{ TEXT("Sonnig"), 35, 1.0f, 1.0f, 1.0f, 1.0f, 1.0 },
			{ TEXT("Bewoelkt"), 30, 1.0f, 1.0f, 1.0f, 1.0f, 1.0 },
			{ TEXT("Regen"), 18, 1.15f, 1.15f, 0.95f, 0.93f, 1.05 },
			{ TEXT("Schnee"), 7, 1.2f, 1.2f, 0.85f, 0.88f, 1.1 },
			{ TEXT("Hitze"), 10, 1.05f, 1.0f, 1.0f, 0.96f, 1.25 },
			{ TEXT("Sturm"), 3, 1.35f, 1.1f, 0.8f, 0.7f, 1.3 }
		};
		return Liste;
	}

	int32 RollWeather(FRandomStream& Rng)
	{
		int32 Summe = 0;
		for (const FWeather& W : Weathers()) Summe += W.Weight;
		int32 Wurf = Rng.RandRange(0, Summe - 1);
		for (int32 i = 0; i < Weathers().Num(); ++i)
		{
			if (Wurf < Weathers()[i].Weight) return i;
			Wurf -= Weathers()[i].Weight;
		}
		return 0;
	}

	const FReferee& RefereeFor(int32 Season, int32 Matchday, int32 Level, int32 ClubNameLength)
	{
		static const TArray<FReferee> Alle = {
			{ TEXT("Tobias Hartung"), TEXT("Kleinlich"), 1.4f, 0, 2 }, { TEXT("Felix Brenner"), TEXT("Souveraen"), 0.9f, 0, 1 },
			{ TEXT("Deniz Aydin"), TEXT("Grosszuegig"), 0.7f, 0, 2 }, { TEXT("Marco Wendt"), TEXT("Konsequent"), 1.2f, 0, 3 },
			{ TEXT("Sabine Lorenz"), TEXT("Souveraen"), 1.0f, 0, 3 }, { TEXT("Luka Petrovic"), TEXT("Laesst laufen"), 0.75f, 1, 4 },
			{ TEXT("Jens Krause"), TEXT("Kleinlich"), 1.35f, 2, 5 }, { TEXT("Nina Haas"), TEXT("Konsequent"), 1.15f, 2, 5 },
			{ TEXT("Uwe Schubert"), TEXT("Grosszuegig"), 0.8f, 3, 5 }, { TEXT("Kerem Demir"), TEXT("Souveraen"), 1.0f, 3, 5 },
			{ TEXT("Heiko Vogt"), TEXT("Hektisch"), 1.3f, 4, 5 }, { TEXT("Paula Ernst"), TEXT("Laesst laufen"), 0.85f, 4, 5 }
		};
		TArray<int32> Pool;
		for (int32 i = 0; i < Alle.Num(); ++i) if (Level >= Alle[i].MinLeague && Level <= Alle[i].MaxLeague) Pool.Add(i);
		// Gleiche Formel wie getRefereeFor(): feste Ansetzung ohne Zufall
		const uint32 Seed = (uint32)(Season * 131 + Matchday * 17 + Level * 7 + ClubNameLength);
		return Alle[Pool[(int32)(Seed % (uint32)Pool.Num())]];
	}
}
