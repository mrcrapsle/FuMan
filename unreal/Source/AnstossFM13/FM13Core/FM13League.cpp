#include "FM13League.h"

bool FM13CompareRows(const FFM13Club& A, const FFM13Club& B)
{
	if (A.Points() != B.Points()) return A.Points() > B.Points();
	if (A.GoalDiff() != B.GoalDiff()) return A.GoalDiff() > B.GoalDiff();
	if (A.GoalsFor != B.GoalsFor) return A.GoalsFor > B.GoalsFor;
	return A.Name < B.Name;
}

void FFM13League::BuildSchedule(FRandomStream& Rng)
{
	Fixtures.Reset();
	const int32 N0 = Clubs.Num();
	if (N0 < 2) return;

	TArray<int32> Plan;
	for (int32 i = 0; i < N0; ++i) Plan.Add(i);
	// Zufällige Reihenfolge, damit nicht jede Saison dieselben Paarungen am selben Spieltag stehen
	for (int32 i = Plan.Num() - 1; i > 0; --i) Swap(Plan[i], Plan[Rng.RandRange(0, i)]);
	if (N0 % 2 == 1) Plan.Add(-1); // Freilos
	const int32 N = Plan.Num();
	const int32 Runden = N - 1;

	for (int32 Runde = 0; Runde < Runden; ++Runde)
	{
		for (int32 k = 0; k < N / 2; ++k)
		{
			const int32 A = Plan[k];
			const int32 B = Plan[N - 1 - k];
			if (A < 0 || B < 0) continue;
			// Heimrecht abwechseln: gerade Runden A daheim, ungerade B (beim festen ersten Platz wichtig)
			const bool bTausch = (Runde + k) % 2 == 1;
			FFM13Fixture F;
			F.Matchday = Runde + 1;
			F.Home = bTausch ? B : A;
			F.Away = bTausch ? A : B;
			Fixtures.Add(F);
		}
		// Kreis drehen: Platz 0 bleibt, der Rest rückt eins weiter
		const int32 Letzte = Plan[N - 1];
		for (int32 i = N - 1; i > 1; --i) Plan[i] = Plan[i - 1];
		Plan[1] = Letzte;
	}

	const int32 Hin = Fixtures.Num();
	for (int32 i = 0; i < Hin; ++i)
	{
		FFM13Fixture R = Fixtures[i];
		R.Matchday += Runden;
		Swap(R.Home, R.Away);
		Fixtures.Add(R);
	}
}

void FFM13League::ResetStats()
{
	for (FFM13Club& C : Clubs) C.ResetStats();
	for (FFM13Fixture& F : Fixtures) { F.bPlayed = false; F.HomeGoals = F.AwayGoals = 0; }
}

TArray<int32> FFM13League::SortedIndices() const
{
	TArray<int32> Idx;
	for (int32 i = 0; i < Clubs.Num(); ++i) Idx.Add(i);
	Idx.Sort([this](int32 A, int32 B) { return FM13CompareRows(Clubs[A], Clubs[B]); });
	return Idx;
}

int32 FFM13League::RankOf(int32 ClubIndex) const
{
	const TArray<int32> Idx = SortedIndices();
	for (int32 i = 0; i < Idx.Num(); ++i) if (Idx[i] == ClubIndex) return i + 1;
	return 0;
}

int32 FFM13League::FindClub(const FString& Name) const
{
	return Clubs.IndexOfByPredicate([&Name](const FFM13Club& C) { return C.Name == Name; });
}

int32 FFM13League::FindOwn() const
{
	return Clubs.IndexOfByPredicate([](const FFM13Club& C) { return C.bOwn; });
}

void FFM13League::ApplyResult(FFM13Fixture& F, int32 HomeGoals, int32 AwayGoals)
{
	F.HomeGoals = HomeGoals;
	F.AwayGoals = AwayGoals;
	F.bPlayed = true;
	FFM13Club& H = Clubs[F.Home];
	FFM13Club& A = Clubs[F.Away];
	H.Played++; A.Played++;
	H.GoalsFor += HomeGoals; H.GoalsAgainst += AwayGoals;
	A.GoalsFor += AwayGoals; A.GoalsAgainst += HomeGoals;
	if (HomeGoals > AwayGoals) { H.Won++; A.Lost++; }
	else if (HomeGoals < AwayGoals) { A.Won++; H.Lost++; }
	else { H.Drawn++; A.Drawn++; }
}

int32 FFM13League::MatchdayCount() const
{
	int32 Max = 0;
	for (const FFM13Fixture& F : Fixtures) Max = FMath::Max(Max, F.Matchday);
	return Max;
}
