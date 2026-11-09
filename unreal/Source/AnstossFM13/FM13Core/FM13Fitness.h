#pragma once

#include "FM13Types.h"

// Kondition und Tagesform nach dem Spieltag (js/match-live.js, processPostMatchRoutine(),
// js/training.js). Reine Rechnung ohne Zustand, damit Tests die Werte direkt prüfen können.
// Runden wie Math.round() im Browserspiel (halbe Werte nach oben, Eingaben sind positiv).
namespace FM13Fitness
{
	// Eingaben des Kraftverlusts. Trainerstab und Perks folgen mit ihrem Abschnitt.
	struct FKraftEingabe
	{
		bool bFitnessGuru = false;             // Perk: Grundverlust 6 statt 9
		FString Intensitaet = TEXT("normal");  // Trainingsintensität: hart 1,25, locker 0,75
		FString Teamtraining = TEXT("ausgeglichen");
		int32 Tempo = 50;                      // Spielstil (FM13Tactics), Tempo und Pressing 0-100
		int32 Pressing = 50;
		double WetterFaktor = 1.0;             // FitLossMult des Spieltags
		bool bAuswaerts = false;
		int32 LigaStufe = 0;                   // 0 = oberste Liga; Reisemüdigkeit nur in den obersten zwei
		bool bBus = false;                     // Reisemodus Bus statt Flugzeug
		bool bBusSponsor = false;              // gesponserter Bus halbiert den Malus zur Hälfte
		bool bBusBanden = false;               // Bandensponsor-Variante mildert etwas weniger
	};

	int32 Runden(double Wert);                 // Math.round() für positive Werte
	int32 Verlust(const FKraftEingabe& E);     // Kraftverlust eines Spielers im Spiel
	int32 Erholung(const FString& Teamtraining); // Erholung der Bankspieler pro Spieltag (31 Kondition, sonst 26)
	int32 NachSpiel(int32 Kondition, bool bInStartelf, int32 Kraftverlust, const FString& Teamtraining);
	int32 Tagesform(int32 Moral, int32 Kondition, double Zufall); // Zufall in [-20, 20)
}
