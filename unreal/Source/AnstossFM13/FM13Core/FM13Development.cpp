#include "FM13Development.h"

namespace FM13Dev
{
	const TArray<FArchetype>& Archetypes()
	{
		static const TArray<FArchetype> Liste = {
			{ TEXT("Konstanter Profi"), 29, 1.0f, 1.0f, 40 },
			{ TEXT("Spaetzuender"), 31, 0.8f, 0.8f, 20 },
			{ TEXT("Fruehe Bluete"), 25, 1.4f, 1.4f, 20 },
			{ TEXT("Wunderkind"), 27, 1.8f, 1.6f, 8 },
			{ TEXT("Frueh verglueht"), 24, 0.6f, 2.0f, 12 }
		};
		return Liste;
	}

	uint8 ArchetypeFor(int32 PlayerId)
	{
		// Streuung aus der Id wie getPlayerArchetype() (dort aus der Text-Id)
		uint32 H = 7;
		const FString Id = FString::FromInt(PlayerId);
		for (int32 i = 0; i < Id.Len(); ++i) H = (H * 31 + (uint32)Id[i]) % 1000;
		const int32 Wert = (int32)((H * 37u + (uint32)PlayerId * 13u) % 100u);
		int32 Summe = 0;
		for (int32 i = 0; i < Archetypes().Num(); ++i)
		{
			Summe += Archetypes()[i].Weight;
			if (Summe > Wert) return (uint8)i;
		}
		return 0;
	}

	void DevelopmentRange(int32 Age, uint8 Archetype, int32& OutMin, int32& OutMax)
	{
		const FArchetype& A = Archetypes()[FMath::Min((int32)Archetype, Archetypes().Num() - 1)];
		const int32 VomHoehepunkt = Age - A.PeakAge;
		if (VomHoehepunkt < -1)
		{
			OutMin = FMath::RoundToInt(A.DevelopmentRate * 0.5f);
			OutMax = FMath::RoundToInt(A.DevelopmentRate * 2.f);
			return;
		}
		if (VomHoehepunkt <= 1) { OutMin = 0; OutMax = 0; return; }
		const float Abbau = A.DeclineRate * 0.4f * (float)VomHoehepunkt;
		OutMin = -FMath::RoundToInt(Abbau + 1.f);
		OutMax = -FMath::Max(0, FMath::RoundToInt(Abbau));
	}
}
