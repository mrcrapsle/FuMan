#include "FM13Fitness.h"

#include <cmath>

namespace FM13Fitness
{
	int32 Runden(double Wert)
	{
		return (int32)std::floor(Wert + 0.5);
	}

	// Reihenfolge wie in processPostMatchRoutine(): Grundwert, Personal (Athletik, Ernährung, Physio, Greenkeeper),
	// Intensität, Erholungsschwerpunkt, Spielstil, Wetter, Reisemüdigkeit. Live-Zurufe und Team-Anweisungen fehlen noch.
	int32 Verlust(const FKraftEingabe& E)
	{
		int32 F = E.bFitnessGuru ? 6 : 9;

		if (E.bAthletiktrainer) F = Runden(F * 0.7);
		if (E.bErnaehrung)
		{
			const double Ermuedung = E.bErnaehrungLeistung ? 0.98 - 0.02 * E.ErnaehrungStufe : 0.92 - 0.04 * E.ErnaehrungStufe;
			F = Runden(F * Ermuedung);
		}
		if (E.bPhysio) F = Runden(F * (E.bPhysioBelastung ? 0.9 : 1.0));
		if (E.bGreenkeeper && !E.bAuswaerts) F = Runden(F * (E.bGreenkeeperTempo ? 1.1 : 1.0));

		double IntensitaetFaktor = 1.0;
		if (E.Intensitaet == TEXT("hart")) IntensitaetFaktor = 1.25;
		else if (E.Intensitaet == TEXT("locker")) IntensitaetFaktor = 0.75;
		F = Runden(F * IntensitaetFaktor);

		if (E.Teamtraining == TEXT("erholung")) F = FMath::Max(3, F - 2);

		const double StilFaktor = 1.0 + ((E.Tempo - 50) + (E.Pressing - 50)) / 400.0;
		F = Runden(F * StilFaktor);

		F = Runden(F * E.WetterFaktor);

		if (E.bAuswaerts && E.LigaStufe <= 1)
		{
			double BusFaktor = E.bBusSponsor ? (E.bBusBanden ? 1.75 : 1.5) : 2.0;
			F += E.bBus ? Runden(3 * BusFaktor) : 3;
		}
		return F;
	}

	int32 Erholung(const FString& Teamtraining)
	{
		return Teamtraining == TEXT("kondition") ? 31 : 26;
	}

	// Stammspieler verlieren Kraft und erholen sich unter der Woche um ein Viertel der Bank-Erholung,
	// Bankspieler erholen sich voll. Der Wert bleibt zwischen 10 und 100 (Startelf) bzw. höchstens 100.
	int32 NachSpiel(int32 Kondition, bool bInStartelf, int32 Kraftverlust, const FString& Teamtraining)
	{
		const int32 B = Erholung(Teamtraining);
		if (bInStartelf) return FMath::Max(10, FMath::Min(100, Kondition - Kraftverlust + Runden(B / 4.0)));
		return FMath::Min(100, Kondition + B);
	}

	// Tagesform: Moral und Kondition verschieben den Mittelwert von 50, dazu ein Zufall von ±20.
	int32 Tagesform(int32 Moral, int32 Kondition, double Zufall)
	{
		const double Bias = (Moral - 50) * 0.15 + (Kondition - 80) * 0.1;
		const int32 Wert = (int32)std::floor(50.0 + Bias + Zufall + 0.5);
		return FMath::Max(5, FMath::Min(95, Wert));
	}

	const TArray<FEinheit>& Einheiten()
	{
		static const TArray<FEinheit> Liste = {
			{ TEXT("ausgeglichen"), TEXT("Ausgeglichen"), 1 }, { TEXT("kondition"), TEXT("Kondition"), 3 }, { TEXT("technik"), TEXT("Technik"), 2 },
			{ TEXT("taktik"), TEXT("Taktik"), 2 }, { TEXT("matchprep"), TEXT("Match-Prep"), 2 }, { TEXT("standards"), TEXT("Standards"), 1 },
			{ TEXT("erholung"), TEXT("Erholung"), -2 }, { TEXT("frei"), TEXT("Frei"), -3 }
		};
		return Liste;
	}

	const TCHAR* TagName(int32 Tag)
	{
		static const TCHAR* Namen[7] = { TEXT("Mo"), TEXT("Di"), TEXT("Mi"), TEXT("Do"), TEXT("Fr"), TEXT("Sa"), TEXT("So") };
		return Namen[FMath::Clamp(Tag, 0, 6)];
	}

	FWoche Woche(const TArray<FString>& Plan)
	{
		FWoche W;
		TArray<FString> Arten;
		TArray<int32> Anzahl;
		for (const FString& Tag : Plan)
		{
			int32 Load = 1; // unbekannte Einheit zählt wie ausgeglichen
			for (const FEinheit& E : Einheiten()) if (Tag == E.Key) Load = E.Load;
			W.Load += Load;
			if (Tag == TEXT("frei")) W.Frei++; else W.Einheiten++;
			int32 k = 0;
			for (; k < Arten.Num(); ++k) if (Arten[k] == Tag) break;
			if (k == Arten.Num()) { Arten.Add(Tag); Anzahl.Add(0); }
			Anzahl[k]++;
		}
		W.Risk = FMath::Max(2, FMath::Min(28, W.Load * 2 - W.Frei * 4));
		// Schwerpunkt: die häufigste Einheit außer "frei"; bei Gleichstand die, die zuerst in der Woche steht
		W.Dominant = TEXT("ausgeglichen");
		int32 Beste = 0;
		for (int32 k = 0; k < Arten.Num(); ++k)
			if (Arten[k] != TEXT("frei") && Anzahl[k] > Beste) { Beste = Anzahl[k]; W.Dominant = Arten[k]; }
		W.TeamTraining = W.Dominant == TEXT("standards") ? FString(TEXT("ausgeglichen")) : W.Dominant;
		return W;
	}

	TArray<FString> Standardplan(const FString& Name)
	{
		static const TCHAR* Plaene[5][8] = {
			{ TEXT("ausgeglichen"), TEXT("ausgeglichen"), TEXT("technik"), TEXT("ausgeglichen"), TEXT("taktik"), TEXT("ausgeglichen"), TEXT("erholung"), TEXT("frei") },
			{ TEXT("kondition"), TEXT("kondition"), TEXT("kondition"), TEXT("erholung"), TEXT("kondition"), TEXT("ausgeglichen"), TEXT("erholung"), TEXT("frei") },
			{ TEXT("technik"), TEXT("technik"), TEXT("standards"), TEXT("technik"), TEXT("ausgeglichen"), TEXT("technik"), TEXT("erholung"), TEXT("frei") },
			{ TEXT("taktik"), TEXT("taktik"), TEXT("ausgeglichen"), TEXT("taktik"), TEXT("standards"), TEXT("taktik"), TEXT("erholung"), TEXT("frei") },
			{ TEXT("regeneration"), TEXT("erholung"), TEXT("erholung"), TEXT("ausgeglichen"), TEXT("erholung"), TEXT("ausgeglichen"), TEXT("frei"), TEXT("frei") }
		};
		int32 Zeile = 0; // unbekannter Name: ausgeglichen
		for (int32 k = 0; k < 5; ++k) if (Name == Plaene[k][0]) Zeile = k;
		TArray<FString> Plan;
		for (int32 Tag = 1; Tag <= 7; ++Tag) Plan.Add(Plaene[Zeile][Tag]);
		return Plan;
	}

	TArray<FString> Startplan()
	{
		TArray<FString> Plan;
		for (int32 Tag = 0; Tag < 5; ++Tag) Plan.Add(TEXT("ausgeglichen"));
		Plan.Add(TEXT("erholung"));
		Plan.Add(TEXT("frei"));
		return Plan;
	}

	double VerletzungTeam(const FVerletzung& E)
	{
		double C = E.Teamtraining == TEXT("erholung") ? 0.024 : 0.03;
		if (E.bSchutz) C = 0.0;
		else if (E.bGluecksbringer) C *= 0.4;
		if (E.bPraevention) C *= 0.82;
		C *= (1.0 - E.StadionSenkung);
		C *= FMath::Max(0.9, FMath::Min(1.2, 1.0 + (85 - E.Rasen) / 85.0 * 0.25));
		C *= E.Wetter;
		if (E.Haerte == TEXT("hart")) C *= 1.3;
		if (E.Haerte == TEXT("vorsichtig")) C *= 0.75;
		C *= (1.0 - E.LagerSenkung);
		C *= (1.0 + (E.WochenRisiko - 10) * 0.012);
		double Faktor = 1.0; // TRAINING_INTENSITY_INJURY_FACTOR
		if (E.Intensitaet == TEXT("hart")) Faktor = 1.25;
		else if (E.Intensitaet == TEXT("intensiv")) Faktor = 1.15;
		else if (E.Intensitaet == TEXT("leicht")) Faktor = 0.88;
		else if (E.Intensitaet == TEXT("locker")) Faktor = 0.8;
		else if (E.Intensitaet == TEXT("erholung")) Faktor = 0.75;
		return C * Faktor;
	}

	double VerletzungSpieler(double Team, int32 Fruehere, int32 Alter, bool bWetterfest, double Wetter, bool bChronisch)
	{
		const double Anfaellig = 1.0 + FMath::Min(2.5, Fruehere * 0.18);
		double C = Team * Anfaellig;
		if (bWetterfest && Wetter > 1.0) C = Team * 1.0 * Anfaellig / Wetter;
		if (Fruehere >= 2) C *= 0.72;
		C *= Alter >= 35 ? 1.4 : (Alter >= 32 ? 1.2 : (Alter <= 21 ? 0.85 : 1.0));
		if (bChronisch) C *= 1.5;
		return C;
	}

	int32 VerletzungDauer(int32 Basis, int32 RehaStufe, bool bPhysio)
	{
		const double Senkung = FMath::Max(0.25, 1.0 - RehaStufe * 0.08 - (bPhysio ? 0.5 : 0.0));
		return FMath::Max(1, Runden(Basis * Senkung));
	}
}
