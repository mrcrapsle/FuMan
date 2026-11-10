#include "FM13Poker.h"

#include <cmath>

namespace FM13Poker
{
	namespace
	{
		int64 JsRound(double V) { return (int64)std::floor(V + 0.5); }
	}

	int64 Runden(double Betrag)
	{
		return Betrag < 100000 ? JsRound(Betrag / 100.0) * 100 : JsRound(Betrag / 1000.0) * 1000;
	}

	double Zaehigkeit(uint8 C)
	{
		switch (C)
		{
		case 0: return 0.9;   // Ruhig
		case 1: return 1.1;   // Emotional
		case 2: return 1.35;  // Ehrgeizig
		case 3: return 1.2;   // Selbstbewusst
		case 4: return 0.75;  // Bescheiden
		case 5: return 1.15;  // Hitzkoepfig
		default: return 1.0;
		}
	}

	int64 Schmerzgrenze(int64 Marktwert, int32 Vertrag)
	{
		const int32 V = FMath::Max(1, FMath::Min(4, Vertrag));
		return Runden((double)Marktwert * (0.82 + V * 0.05));
	}

	int64 Forderung(int64 Marktwert, int32 Vertrag, int64 Min, double Zufall)
	{
		const int32 V = FMath::Max(1, FMath::Min(4, Vertrag));
		return FMath::Max(Runden((double)Min * 1.01), Runden((double)Marktwert * (1.0 + V * 0.04 + Zufall * 0.12)));
	}

	int64 Gehaltsforderung(int64 Gehalt, double Z, double Zufall, bool bBerater)
	{
		const double Faktor = 1.0 + (Z - 1.0) * 0.6 + Zufall * 0.12 + (bBerater ? 0.05 : 0.0);
		return JsRound((double)Gehalt * Faktor / 10.0) * 10;
	}

	double NachverhandlungChance(double Z)
	{
		return FMath::Max(0.15, 0.75 - (Z - 0.75) * 0.9);
	}

	int64 Nachverhandlung(int64 F, bool bErfolg)
	{
		return bErfolg ? JsRound((double)F * 0.9 / 10.0) * 10 : JsRound((double)F * 1.05 / 10.0) * 10;
	}

	int64 RivalenGebot(int64 Min, double Zufall)
	{
		return Runden((double)Min * (1.05 + Zufall * 0.12));
	}
}
