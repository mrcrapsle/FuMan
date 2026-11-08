#include "FM13Cup.h"

namespace FM13CupRules
{
	FFM13Cup MakeDfbPokal()
	{
		FFM13Cup C;
		C.Name = TEXT("DFB-Pokal");
		C.RoundNames = { TEXT("1. Runde"), TEXT("Achtelfinale"), TEXT("Viertelfinale"), TEXT("Halbfinale"), TEXT("Finale") };
		C.RoundMatchdays = { 4, 12, 20, 28, 34 };
		C.Prizes = { 215000, 430000, 860000, 1720000, 4300000 };
		return C;
	}

	FFM13Cup MakeLandespokal()
	{
		FFM13Cup C;
		C.Name = TEXT("Landespokal");
		C.RoundNames = { TEXT("Achtelfinale"), TEXT("Viertelfinale"), TEXT("Halbfinale"), TEXT("Landespokal-Finale") };
		C.RoundMatchdays = { 6, 14, 22, 30 };
		// Kleine Prämien; der eigentliche Preis ist der Startplatz im DFB-Pokal der nächsten Saison
		C.Prizes = { 8000, 15000, 30000, 60000 };
		return C;
	}

	float PenaltyWinChance(int32 OwnStrength, int32 OppStrength)
	{
		return FMath::Clamp(0.5f + (float)(OwnStrength - OppStrength) * 0.01f, 0.3f, 0.7f);
	}
}
