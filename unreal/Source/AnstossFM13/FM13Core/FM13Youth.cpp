#include "FM13Youth.h"

#include <cmath>

namespace FM13Youth
{
	uint8 Stufe(double Wurf)
	{
		return Wurf < 0.6 ? 1 : (Wurf < 0.9 ? 2 : 3);
	}

	void PotenzialSpanne(uint8 S, int32& Untere, int32& Obere)
	{
		switch (S)
		{
		case 1: Untere = 58; Obere = 68; return;
		case 2: Untere = 67; Obere = 78; return;
		case 3: Untere = 77; Obere = 89; return;
		default: Untere = 60; Obere = 72; return;
		}
	}

	double Trainerbonus(bool bHatTrainer, int32 Ernennungen)
	{
		if (!bHatTrainer) return 1.0;
		return std::min(1.5, 1.15 + Ernennungen * 0.02);
	}

	// Staerke steigt um bis zu 1,5 je Monat, mal Trainer, Schwerpunkt (1,2), Mentor (1,35) und Alterdaempfung.
	// Liegt das Potenzial nah an der Staerke, wird der Zuwachs stark gebremst.
	int32 Wachstum(int32 Staerke, int32 Potenzial, int32 Alter, double Trainer, bool bSchwerpunkt, bool bMentor, double Zufall)
	{
		const double Daempfung = std::max(0.5, 1.0 - std::max(0, Alter - 20) * 0.05);
		const double Fokus = bSchwerpunkt ? 1.2 : 1.0;
		const double Mentor = bMentor ? 1.35 : 1.0;
		const int32 Luecke = std::max(0, Potenzial - Staerke);
		double Zuwachs = Zufall * 1.5 * Trainer * Fokus * Mentor * Daempfung;
		if (Luecke < 5) Zuwachs *= 0.3;
		if (Luecke < 2) Zuwachs *= 0.1;
		const int32 Neu = (int32)std::floor(Staerke + Zuwachs + 0.5);
		return std::min(Potenzial, Neu);
	}

	// calculateYouthTalentScore(): Entwicklungsraum, Alter, Trait und Mentor
	int32 Talentwert(int32 Staerke, int32 Potenzial, int32 Alter, bool bTrait, bool bMentor)
	{
		const int32 Raum = std::max(0, Potenzial - Staerke);
		const int32 AlterBonus = std::max(0, (22 - Alter) * 5);
		return Raum + AlterBonus + (bTrait ? 10 : 0) + (bMentor ? 8 : 0);
	}
}
