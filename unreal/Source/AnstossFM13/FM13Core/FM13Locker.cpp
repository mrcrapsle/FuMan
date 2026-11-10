#include "FM13Locker.h"

#include <algorithm>
#include <cmath>

namespace FM13Locker
{
	namespace
	{
		const TCHAR* Namen[6] = { TEXT("Deutschland"), TEXT("Oesterreich"), TEXT("Schweiz"), TEXT("Polen"), TEXT("Niederlande"), TEXT("Frankreich") };
		// Wurf 0 bis 9 wie nationPool: 5x Deutschland, je einmal die anderen
		const uint8 Wurf[10] = { 0, 0, 0, 0, 0, 1, 2, 3, 4, 5 };
	}

	const TCHAR* Nation(uint8 Index) { return Namen[Index < 6 ? Index : 0]; }
	uint8 NationFromRoll(int32 W) { return Wurf[W < 0 ? 0 : (W > 9 ? 9 : W)]; }
	int32 AnzahlNationen() { return 6; }

	double Fuehrung(bool bLeader, int32 Alter, int32 Einsaetze, int32 Moral)
	{
		return (bLeader ? 30.0 : 0.0) + std::max(0, Alter - 26) * 2.0 + std::min(Einsaetze, 150) * 0.12 + Moral * 0.15;
	}

	uint8 Altersgruppe(int32 Alter)
	{
		if (Alter <= 23) return 0;   // jung
		if (Alter >= 30) return 2;   // erfahren
		return 1;                    // mitte
	}

	const TCHAR* AltersgruppeName(uint8 Gruppe)
	{
		static const TCHAR* N[3] = { TEXT("Junge Wilde"), TEXT("Mittelbau"), TEXT("Routiniers") };
		return N[Gruppe < 3 ? Gruppe : 1];
	}

	EStatus Status(bool bKapitaen, bool bRat, int32 Alter, int32 Einsaetze)
	{
		if (bKapitaen) return EStatus::Kapitaen;
		if (bRat) return EStatus::Rat;
		if (Einsaetze >= 30 || Alter >= 27) return EStatus::Etabliert;
		if (Alter <= 21) return EStatus::Talent;
		return EStatus::Mitlaeufer;
	}

	double CliqueModifikator(int32 AnzahlKader, int32 GroessteClique, bool bGroessteRumort, int32 AnzahlCliquen, int32 AnzahlRumorend)
	{
		double B = 0.0;
		if (GroessteClique >= AnzahlKader * 0.4 && !bGroessteRumort) B += 1.5;
		if (AnzahlCliquen >= 5) B -= 1.0;
		B -= std::min(1.5, AnzahlRumorend * 0.5);
		return B;
	}

	double Stabilisator(int32 Schnitt)
	{
		return Schnitt >= 70 ? 3.0 : (Schnitt <= 35 ? -2.0 : 0.0);
	}

	bool KapitaenAutoritaet(int32 Moral, double Fuehrung)
	{
		return Moral >= 60 && Fuehrung >= 20.0;
	}
}
