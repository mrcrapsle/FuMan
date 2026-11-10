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
		// Personal und Perks (vor allem der Athletiktrainer, der Ernährungsberater, der Physio und der Greenkeeper)
		bool bFitnessGuru = false;             // Perk: Grundverlust 6 statt 9
		bool bAthletiktrainer = false;         // -30 Prozent
		bool bErnaehrung = false;              // Ernährungsberater eingestellt
		int32 ErnaehrungStufe = 1;
		bool bErnaehrungLeistung = false;      // Aufgabe Leistungsküche statt Fitness-Ernährung
		bool bPhysio = false;                  // Chef-Physio: Faktor 1 (Standard) oder 0,9 (Belastungssteuerung)
		bool bPhysioBelastung = false;
		bool bGreenkeeper = false;             // Greenkeeper: Ermüdung 1,1 mit Tempo-Aufgabe, nur bei Heimspielen
		bool bGreenkeeperTempo = false;
	};

	int32 Runden(double Wert);                 // Math.round() für positive Werte
	int32 Verlust(const FKraftEingabe& E);     // Kraftverlust eines Spielers im Spiel
	int32 Erholung(const FString& Teamtraining); // Erholung der Bankspieler pro Spieltag (31 Kondition, sonst 26)
	int32 NachSpiel(int32 Kondition, bool bInStartelf, int32 Kraftverlust, const FString& Teamtraining);
	int32 Tagesform(int32 Moral, int32 Kondition, double Zufall); // Zufall in [-20, 20)

	// Wochenplan (js/training.js): sieben Tage mit je einer Einheit. Aus der Verteilung folgen Belastung,
	// Verletzungsrisiko und der Schwerpunkt, der als Teamtraining wirkt.
	struct FEinheit { const TCHAR* Key; const TCHAR* Label; int32 Load; };
	const TArray<FEinheit>& Einheiten();
	const TCHAR* TagName(int32 Tag);                       // Mo bis So
	struct FWoche { int32 Load = 0; int32 Frei = 0; int32 Einheiten = 0; int32 Risk = 0; FString Dominant; FString TeamTraining; };
	FWoche Woche(const TArray<FString>& Plan);             // computeWeeklyTrainingStats()
	TArray<FString> Standardplan(const FString& Name);     // ausgeglichen, kondition, technik, taktik, regeneration
	TArray<FString> Startplan();                           // Plan eines neuen Spiels

	// Verletzungswurf nach dem Spieltag (js/match-live.js, processPostMatchRoutine())
	struct FVerletzung
	{
		FString Teamtraining;              // erholung: Grundrisiko 2,4 % statt 3 %
		bool bSchutz = false;              // Premium: Verletzungsschutz
		bool bGluecksbringer = false;      // Premium: x 0,4
		bool bPraevention = false;         // Präventionsprogramm: x 0,82
		double StadionSenkung = 0.0;       // Medizinzentrum, Rasenpflege
		int32 Rasen = 85;                  // Rasenzustand, 85 ist neutral
		double Wetter = 1.0;               // InjuryMult des Wetters
		FString Haerte;                    // hart x 1,3, vorsichtig x 0,75
		double LagerSenkung = 0.0;         // Trainingslager
		int32 WochenRisiko = 10;           // Risiko des Wochenplans, 10 ist neutral
		FString Intensitaet;               // hart 1,25 / normal 1 / locker 0,8
	};
	double VerletzungTeam(const FVerletzung& E);
	double VerletzungSpieler(double Team, int32 FruehereVerletzungen, int32 Alter, bool bWetterfest, double Wetter, bool bChronisch);
	int32 VerletzungDauer(int32 Basis, int32 RehaStufe, bool bPhysio); // Basis 1 bis 4 Spiele
}
