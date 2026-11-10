#include "FM13Staff.h"

#include <cmath>

namespace FM13Staff
{
	namespace
	{
		int64 JsRound(double V) { return (int64)std::floor(V + 0.5); }
	}

	// Gehalt und Kosten wie in staffMembers (js/state.js)
	const TArray<FRolle>& Rollen()
	{
		static const TArray<FRolle> Liste = {
			{ TEXT("coTrainer"), TEXT("Co-Trainer"), 8000, 60000 },
			{ TEXT("fitCoach"), TEXT("Athletik- & Konditionstrainer"), 6000, 50000 },
			{ TEXT("physio"), TEXT("Chef-Physiotherapeut"), 7000, 55000 },
			{ TEXT("greenkeeper"), TEXT("Head-Greenkeeper"), 4000, 30000 },
			{ TEXT("analyst"), TEXT("Chef-Analyst"), 7000, 60000 },
			{ TEXT("nutritionist"), TEXT("Ernaehrungsberater"), 5500, 45000 }
		};
		return Liste;
	}

	int32 AnzahlRollen() { return Rollen().Num(); }

	int64 GehaltFuer(const TCHAR* Key)
	{
		for (const FRolle& R : Rollen()) if (FString(R.Key) == FString(Key)) return R.Gehalt;
		return 0;
	}

	// openCandidatePool(): drei Bewerber mit Preis, Startmoral und Startstufe
	const TArray<FBewerber>& Bewerber()
	{
		static const TArray<FBewerber> Liste = {
			{ TEXT("Guenstige Nachwuchskraft"), 0.7, 60, 1 },
			{ TEXT("Solider Standardkandidat"), 1.0, 80, 1 },
			{ TEXT("Renommierte Fachkraft"), 1.6, 95, 2 }
		};
		return Liste;
	}

	int64 PreisFuerBewerber(int32 Rolle, int32 Kandidat)
	{
		return JsRound((double)Rollen()[Rolle].Kosten * Bewerber()[Kandidat].PreisFaktor);
	}

	int64 Abfindung(int64 Gehalt, int32 Stufe) { return Gehalt * Stufe; }

	int64 WeiterbildungKosten(int32 Rolle, int32 Stufe)
	{
		return JsRound((double)Rollen()[Rolle].Kosten * 0.6 * Stufe);
	}

	int32 WeiterbildungTage(int64 Kosten)
	{
		return (int32)FMath::Max<int64>(3, FMath::Min<int64>(8, JsRound((double)Kosten / 8000.0)));
	}

	int64 VerlaengerungKosten(int32 Rolle) { return JsRound((double)Rollen()[Rolle].Kosten * 0.4); }
	int64 GehaltserhoehungKosten(int64 Gehalt) { return Gehalt * 5; }
	int64 NeuesGehalt(int64 Gehalt) { return JsRound((double)Gehalt * 1.1); }
	double MoralAbnahme(double Moral) { return FMath::Max(20.0, Moral - 0.3); }
	double Wirksamkeit(double Moral) { return Moral >= 70 ? 1.0 : (Moral >= 40 ? 0.85 : 0.65); }
}
