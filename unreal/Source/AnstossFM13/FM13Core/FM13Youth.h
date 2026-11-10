#pragma once

#include "FM13Types.h"

// Jugend (js/youth-pathway.js, js/youth-academy-extended.js, js/youth.js): Potenzialstufe, Spanne und Monatswachstum.
// Reine Regeln, damit Tests die Werte direkt prüfen können.
namespace FM13Youth
{
	// assignYouthPotentialTier(): Wurf aus Zufall, Internat (0,06 je Stufe) und Akademie (0,04 je Stufe ueber der ersten)
	uint8 Stufe(double Wurf);
	// YOUTH_POTENTIAL_RANGE: Spanne des Potenzials je Stufe ohne Liga-Basis
	void PotenzialSpanne(uint8 Stufe, int32& Untere, int32& Obere);
	// Trainerbonus: 1 ohne Jugendtrainer, sonst 1,15 + 0,02 je frueherer Ernennung, hoechstens 1,5
	double Trainerbonus(bool bHatTrainer, int32 Ernennungen);
	// Ein Monatsschritt des Wachstums (tickYouthDevelopment). Zufall in [0, 1).
	int32 Wachstum(int32 Staerke, int32 Potenzial, int32 Alter, double Trainer, bool bSchwerpunkt, bool bMentor, double Zufall);
	// Talentwert der Rangliste (calculateYouthTalentScore)
	int32 Talentwert(int32 Staerke, int32 Potenzial, int32 Alter, bool bTrait, bool bMentor);
}
