#include "FM13Transfers.h"

#include <algorithm>
#include <cstdint>
#include <cmath>

namespace FM13Transfers
{
	int64 JsRunden(double X) { return (int64)std::floor(X + 0.5); }

	double HashEinheit(int32 Kennung, uint32 Salz)
	{
		std::uint64_t Z = (std::uint64_t)(std::uint32_t)Kennung * 0x9E3779B97F4A7C15ull + (std::uint64_t)Salz * 0xBF58476D1CE4E5B9ull;
		Z = (Z ^ (Z >> 30)) * 0xBF58476D1CE4E5B9ull;
		Z = (Z ^ (Z >> 27)) * 0x94D049BB133111EBull;
		Z = Z ^ (Z >> 31);
		return (double)(Z >> 11) / 9007199254740992.0;
	}

	FFM13MedBefund WuerfleBefund(int32 Alter, double Zufall, double ZufallAnzahl, double ZufallWochen)
	{
		FFM13MedBefund B;
		const double ChronischQuote = 0.12 + (Alter >= 29 ? 0.1 : 0.0);
		if (Zufall < ChronischQuote) { B.Issue = EFM13Medical::Chronisch; B.Injuries = 3 + (int32)(ZufallAnzahl * 3.0); }
		else if (Zufall < ChronischQuote + 0.1) { B.Issue = EFM13Medical::Verletzt; B.Weeks = 2 + (int32)(ZufallWochen * 4.0); }
		return B;
	}

	int64 MedizinGebuehr(int64 Ablose, double PhysioAusfall)
	{
		const int64 Gebuehr = JsRunden((double)Ablose * 0.03 * PhysioAusfall / 100.0) * 100;
		return Gebuehr > 1500 ? Gebuehr : 1500;
	}

	double MedizinRabatt(EFM13Medical Issue)
	{
		switch (Issue)
		{
			case EFM13Medical::Chronisch: return 0.8;
			case EFM13Medical::Verletzt: return 0.85;
			default: return 1.0;
		}
	}

	bool MedizinAuffaellig(EFM13Medical Issue) { return Issue != EFM13Medical::Ok; }

	int64 RueckkaufSofort(int64 Angebot) { return JsRunden((double)Angebot * 0.9); }
	int64 RueckkaufPreis(int64 Angebot) { return JsRunden((double)Angebot * 1.4 / 1000.0) * 1000; }
	bool RueckkaufMoeglich(int32 Alter) { return Alter <= BuybackMaxAge; }

	int32 RueckkaufEntwicklung(int32 Alter, double Zufall)
	{
		if (Alter <= 21) return 2 + (int32)(Zufall * 5.0);
		if (Alter <= 24) return 1 + (int32)(Zufall * 4.0);
		if (Alter <= 26) return (int32)(Zufall * 3.0) - 1;
		return -1 - (int32)(Zufall * 3.0);
	}

	double StrategieBudgetAnteil(EStrategie S)
	{
		switch (S)
		{
			case EStrategie::Jugend: return -0.3;
			case EStrategie::Sofort: return 0.4;
			case EStrategie::Sparen: return -0.5;
			default: return 0.0;
		}
	}

	int32 StrategieZielVerschiebung(EStrategie S)
	{
		switch (S)
		{
			case EStrategie::Jugend: return 1;
			case EStrategie::Sofort: return -2;
			case EStrategie::Sparen: return 2;
			default: return 0;
		}
	}

	int64 StrategieBudgetDelta(int64 LigaBudget, EStrategie S)
	{
		return JsRunden((double)LigaBudget * StrategieBudgetAnteil(S) / 1000.0) * 1000;
	}

	int32 StrategieZiel(int32 AltesZiel, int32 Verschiebung, int32 AnzahlTeams)
	{
		return std::max(1, std::min(AnzahlTeams, AltesZiel + Verschiebung));
	}

	FStrategieAbrechnung StrategieAbrechnung(EStrategie S, int32 Eigengewaechse, int32 Platz, int32 Ziel, int64 Saisonbilanz)
	{
		FStrategieAbrechnung A;
		switch (S)
		{
			case EStrategie::Jugend:
				A.bErfuellt = Eigengewaechse >= StrategieJugendSpieler;
				A.Vorstand = A.bErfuellt ? 6 : -6;
				A.Fans = A.bErfuellt ? 3 : 0;
				break;
			case EStrategie::Sofort:
				A.bErfuellt = Ziel <= 0 || Platz <= Ziel;
				A.Vorstand = A.bErfuellt ? 5 : -8;
				break;
			case EStrategie::Sparen:
				A.bErfuellt = Saisonbilanz >= 0;
				A.Vorstand = A.bErfuellt ? 5 : -6;
				break;
			default:
				break;
		}
		return A;
	}

	double QuelleTrefferquote(EQuelle Q)
	{
		switch (Q)
		{
			case EQuelle::Boulevard: return 0.3;
			case EQuelle::Blog: return 0.5;
			default: return 0.75;
		}
	}

	EQuelle QuelleWuerfeln(double Zufall)
	{
		if (Zufall < 0.45) return EQuelle::Boulevard;
		if (Zufall < 0.8) return EQuelle::Blog;
		return EQuelle::Fach;
	}

	bool GeruechtWechselwillig(uint8 Charakter)
	{
		// characterPool: 2 Ehrgeizig, 3 Selbstbewusst
		return Charakter == 2 || Charakter == 3;
	}

	int32 DementiMoral(uint8 Charakter, int32 Moral)
	{
		const int32 Neu = Moral + (GeruechtWechselwillig(Charakter) ? -5 : 3);
		return std::clamp(Neu, 0, 100);
	}

	int32 AnheizenMoral(int32 Moral) { return std::max(0, Moral - 3); }

	double GeruechtMultiplikator(bool bVerhandler, double Zufall, bool bAngeheizt)
	{
		const double Basis = (bVerhandler ? 1.05 : 0.85) + Zufall * 0.35;
		return Basis * (bAngeheizt ? 1.15 : 1.0);
	}

	int64 VorvertragGehalt(int64 Gehalt) { return JsRunden((double)Gehalt * 1.2 / 10.0) * 10; }

	int64 VorvertragHandgeld(int64 Gehalt, bool bDoppelt) { return Gehalt * (bDoppelt ? 24 : 12); }

	double VorvertragChance(int32 ElfSchnitt, int32 Staerke, int32 Rang, bool bDoppelt)
	{
		const double Chance = 0.6 + (ElfSchnitt - Staerke) * 0.04 + (Rang > 0 && Rang <= 3 ? 0.1 : 0.0) + (bDoppelt ? 0.25 : 0.0);
		return std::max(0.1, std::min(0.95, Chance));
	}
}
