#pragma once

#include "FM13Types.h"

// Teamstärke der eigenen Elf: calcTeamStrength() aus js/match.js, Term für Term in derselben Reihenfolge.
// Reine Rechnung ohne Zustand. Systeme, die es in Unreal noch nicht gibt, stehen als Eingabe mit
// neutralem Vorgabewert da (so rechnet auch das Browserspiel, solange man sie nicht nutzt).
namespace FM13Strength
{
	// Spieler-Traits (js/entities.js, traitsPool). 0 = kein Trait.
	enum ETrait : uint8 { Kein = 0, TorInstinkt, FreistossGott, ElfmeterKiller, Leader, Eisenfuss, Fluegelflitzer, Zweikampfmonster, Wetterfest, TraitAnzahl };
	const TCHAR* TraitName(uint8 Trait);

	struct FSpieler
	{
		int32 Strength = 50;
		int32 Fitness = 100;
		int32 DailyForm = 50;
		int32 Morale = 80;
		int32 Age = 25;
		EFM13Position Pos = EFM13Position::MIT;
		uint8 Trait = 0;
		bool bCaptain = false;
		bool bRoleFits = false;            // Spielerrolle passt zur Stärke (+0,8), Rollen fehlen in Unreal noch
	};

	struct FEingabe
	{
		TArray<FSpieler> Elf;
		bool bHome = false;
		int32 LicenseBoost = 0;            // Trainerlizenz: 0, 1, 2 oder 4
		bool bCoTrainer = false; int32 CoTrainerLevel = 1; double CoTrainerWirkung = 1.0; // Wirkung 1 / 0,85 / 0,65 nach Moral
		bool bGreenkeeper = false; int32 GreenkeeperLevel = 1; bool bGreenkeeperTempo = false;
		bool bAnalystTiefe = false; int32 AnalystLevel = 1;         // Chef-Analyst mit Tiefenanalyse
		bool bErnaehrungLeistung = false; int32 ErnaehrungLevel = 1; // Ernährungsberater mit Leistungsküche
		int32 TrainingGround = 0;          // Campus: Trainingsgelände mit Flutlicht, +1 je Stufe
		bool bSynergie = false;            // Co-Trainer und Chef-Analyst zusammen: +1
		bool bVideoAnalyse = false;        // +2 für ein Spiel
		int32 Fans = 50; bool bFanBus = false;
		int32 ChemistryBonus = 0;          // Eingespieltheit 0 bis 3
		double CliqueModifier = 0.0;       // Kabine: Cliquen
		double CouncilStabilizer = 0.0;    // Kabine: Mannschaftsrat (x 0,3)
		bool bStealBanner = false;         // Unterwelt, nur daheim +3
		bool bTactician = false;           // Perk Taktiker +3
		double WeatherGoalMult = 1.0;      // für den Trait Wetterfest
		double BlockCulture = 0.0;         // Fan-Kultur der Blöcke (daheim)
		double StadiumHome = 0.0;          // Beschallungsanlage (daheim)
		double FanSupport = 0.0;           // Choreo oder Sonderzug
		int32 Stress = 0;                  // Privatleben: -0,03 je Punkt
		FString TeamTraining;              // "taktik": +2
		int32 StyleBonus = 0;              // getTacticStyleBonus()
		double FormationOff = 0.0;         // getFormationOffBonus()
		double TeamInstruction = 0.0;      // Team-Anweisungen
		FString TackleHardness;            // hart +1,5, vorsichtig -1
		double CampBonus = 0.0;            // Trainingslager
		bool bDoping = false;              // Unterwelt +8
	};

	int32 Team(const FEingabe& E);
	int32 ChemistryBonus(int32 SummeDerPaare, int32 AnzahlPaare); // getLineupChemistryStats(): 0 bis 3
}
