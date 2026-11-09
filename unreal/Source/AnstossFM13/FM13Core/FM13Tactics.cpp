#include "FM13Tactics.h"

namespace FM13Tactics
{
	const TArray<FFormation>& Formations()
	{
		static const TArray<FFormation> Liste = {
			{ TEXT("4-4-2"), 60, 58, { 1, 4, 4, 2 } },
			{ TEXT("4-3-3"), 55, 72, { 1, 4, 3, 3 } },
			{ TEXT("3-5-2"), 62, 64, { 1, 3, 5, 2 } },
			{ TEXT("5-3-2"), 82, 46, { 1, 5, 3, 2 } },
			{ TEXT("4-2-3-1"), 64, 64, { 1, 4, 5, 1 } },
			{ TEXT("4-1-4-1"), 70, 52, { 1, 4, 5, 1 } },
			{ TEXT("3-4-3"), 48, 78, { 1, 3, 4, 3 } },
			{ TEXT("5-4-1"), 88, 34, { 1, 5, 4, 1 } }
		};
		return Liste;
	}

	const TArray<FStyle>& Styles()
	{
		static const TArray<FStyle> Liste = {
			{ TEXT("ausgeglichen"), TEXT("Ausgeglichen"), 50, 50, TEXT('N') },
			{ TEXT("ballbesitz"), TEXT("Ballbesitz"), 42, 58, TEXT('B') },
			{ TEXT("konter"), TEXT("Konterfussball"), 64, 26, TEXT('K') },
			{ TEXT("pressing"), TEXT("Pressing"), 68, 88, TEXT('P') },
			{ TEXT("kickrush"), TEXT("Kick and Rush"), 78, 60, TEXT('N') },
			{ TEXT("defensiv"), TEXT("Defensiv"), 36, 20, TEXT('K') },
			{ TEXT("offensiv"), TEXT("Offensiv"), 68, 72, TEXT('P') },
			{ TEXT("umschaltspiel"), TEXT("Umschaltspiel"), 72, 62, TEXT('P') }
		};
		return Liste;
	}

	const FFormation& Formation(const FString& Name)
	{
		for (const FFormation& F : Formations()) if (Name == F.Name) return F;
		return Formations()[0];
	}

	const FStyle& Style(const FString& Key)
	{
		for (const FStyle& S : Styles()) if (Key == S.Key) return S;
		return Styles()[0];
	}

	int32 StyleBonus(const FString& Key)
	{
		const FStyle& S = Style(Key);
		return FMath::RoundToInt((float)((S.Tempo - 50) + (S.Press - 50)) / 25.f);
	}

	float StyleFitnessMultiplier(const FString& Key)
	{
		const FStyle& S = Style(Key);
		return 1.f + (float)((S.Tempo - 50) + (S.Press - 50)) / 400.f;
	}

	float FormationOffBonus(const FString& Name) { return (float)(Formation(Name).Off - 60) * 0.04f; }
	float FormationDefBonus(const FString& Name) { return (float)(Formation(Name).Def - 60) * 0.04f; }

	TCHAR AiArchetype(EFM13Playstyle S)
	{
		switch (S)
		{
		case EFM13Playstyle::Offensiv: return TEXT('P');
		case EFM13Playstyle::Defensiv: return TEXT('K');
		case EFM13Playstyle::Konter: return TEXT('K');
		default: return TEXT('B');
		}
	}

	static TCHAR Beats(TCHAR A)
	{
		if (A == TEXT('P')) return TEXT('B');
		if (A == TEXT('B')) return TEXT('K');
		if (A == TEXT('K')) return TEXT('P');
		return 0;
	}

	int32 MatchupBonus(const FString& OwnStyle, TCHAR Opp)
	{
		const TCHAR Own = Style(OwnStyle).Archetype;
		if (!Opp || Own == TEXT('N') || Opp == TEXT('N')) return 0;
		if (Beats(Own) == Opp) return 2;
		if (Beats(Opp) == Own) return -2;
		return 0;
	}

	TCHAR PredictableArchetype(const TArray<FString>& Recent)
	{
		int32 Anzahl[3] = { 0, 0, 0 };
		const TCHAR Typen[3] = { TEXT('P'), TEXT('B'), TEXT('K') };
		const int32 Start = FMath::Max(0, Recent.Num() - 5);
		for (int32 i = Start; i < Recent.Num(); ++i)
		{
			const TCHAR A = Style(Recent[i]).Archetype;
			for (int32 k = 0; k < 3; ++k) if (A == Typen[k]) ++Anzahl[k];
		}
		int32 Best = 0;
		for (int32 k = 1; k < 3; ++k) if (Anzahl[k] > Anzahl[Best]) Best = k;
		return Anzahl[Best] >= 3 ? Typen[Best] : 0;
	}

	TCHAR CounterTo(TCHAR A)
	{
		for (TCHAR K : { TEXT('P'), TEXT('B'), TEXT('K') }) if (Beats(K) == A) return K;
		return 0;
	}

	const TCHAR* ArchetypeLabel(TCHAR A)
	{
		if (A == TEXT('P')) return TEXT("Pressing");
		if (A == TEXT('B')) return TEXT("Ballbesitz");
		if (A == TEXT('K')) return TEXT("Konter");
		return TEXT("neutral");
	}
}
