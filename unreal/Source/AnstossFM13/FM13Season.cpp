#include "FM13Season.h"
#include "FM13Simulation.h"

void FFM13League::BuildSchedule()
{
	Fixtures.Reset();
	const int32 N0 = Teams.Num();
	if (N0 < 2) return;

	// Freilos bei ungerader Teamzahl: Index -1 steht für "spielfrei"
	TArray<int32> Plan;
	for (int32 i = 0; i < N0; ++i) Plan.Add(i);
	if (N0 % 2 == 1) Plan.Add(-1);
	const int32 N = Plan.Num();
	const int32 Runden = N - 1;

	for (int32 Runde = 0; Runde < Runden; ++Runde)
	{
		for (int32 k = 0; k < N / 2; ++k)
		{
			int32 A = Plan[k];
			int32 B = Plan[N - 1 - k];
			if (A < 0 || B < 0) continue;
			// Hinrunde: Heim wechselt nach Runde, damit es fair bleibt
			const bool bTauschen = (k == 0 && Runde % 2 == 1);
			FFM13Fixture F;
			F.Matchday = Runde + 1;
			F.HomeIndex = bTauschen ? B : A;
			F.AwayIndex = bTauschen ? A : B;
			Fixtures.Add(F);
		}
		// Kreis drehen: erstes Element fest, Rest rotiert
		const int32 Letzte = Plan[N - 1];
		for (int32 i = N - 1; i > 1; --i) Plan[i] = Plan[i - 1];
		Plan[1] = Letzte;
	}

	// Rückrunde: Heim und Gast getauscht, Spieltage hinten angehängt
	const int32 HinRunden = Runden;
	const int32 Anzahl = Fixtures.Num();
	for (int32 i = 0; i < Anzahl; ++i)
	{
		FFM13Fixture R = Fixtures[i];
		R.Matchday += HinRunden;
		Swap(R.HomeIndex, R.AwayIndex);
		Fixtures.Add(R);
	}
	CurrentMatchday = 1;
}

int32 FFM13League::MatchdayCount() const
{
	int32 Max = 0;
	for (const FFM13Fixture& F : Fixtures) Max = FMath::Max(Max, F.Matchday);
	return Max;
}

void FFM13League::RebuildTable()
{
	Table.Reset();
	for (const FFM13Team& T : Teams)
	{
		FFM13TableRow Row;
		Row.Team = T.Name;
		Table.Add(Row);
	}
	for (const FFM13Fixture& F : Fixtures)
	{
		if (!F.bPlayed) continue;
		FFM13TableRow& H = Table[F.HomeIndex];
		FFM13TableRow& A = Table[F.AwayIndex];
		H.Played++; A.Played++;
		H.GoalsFor += F.HomeGoals; H.GoalsAgainst += F.AwayGoals;
		A.GoalsFor += F.AwayGoals; A.GoalsAgainst += F.HomeGoals;
		if (F.HomeGoals > F.AwayGoals) { H.Won++; A.Lost++; }
		else if (F.HomeGoals < F.AwayGoals) { A.Won++; H.Lost++; }
		else { H.Drawn++; A.Drawn++; }
	}
	Table.Sort([](const FFM13TableRow& A, const FFM13TableRow& B)
	{
		if (A.Points() != B.Points()) return A.Points() > B.Points();
		if (A.GoalDiff() != B.GoalDiff()) return A.GoalDiff() > B.GoalDiff();
		return A.GoalsFor > B.GoalsFor;
	});
}

void FFM13League::PlayCurrentMatchday(FRandomStream& Rng)
{
	for (FFM13Fixture& F : Fixtures)
	{
		if (F.Matchday != CurrentMatchday || F.bPlayed) continue;
		const FFM13MatchResult R = FM13Sim::SimulateMatch(Rng, Teams[F.HomeIndex].Strength(), Teams[F.AwayIndex].Strength());
		F.HomeGoals = R.HomeGoals;
		F.AwayGoals = R.AwayGoals;
		F.bPlayed = true;
	}
	CurrentMatchday++;
	RebuildTable();
}
