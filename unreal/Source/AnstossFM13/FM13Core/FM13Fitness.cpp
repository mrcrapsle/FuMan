#include "FM13Fitness.h"

#include <cmath>

namespace FM13Fitness
{
	int32 Runden(double Wert)
	{
		return (int32)std::floor(Wert + 0.5);
	}

	// Reihenfolge wie in processPostMatchRoutine(): Grundwert, Intensität, Erholungsschwerpunkt,
	// Spielstil, Wetter, Reisemüdigkeit. Trainerstab, Live-Zurufe und Team-Anweisungen fehlen noch.
	int32 Verlust(const FKraftEingabe& E)
	{
		int32 F = E.bFitnessGuru ? 6 : 9;

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
}
