#include "FM13Strength.h"

#include <cmath>

namespace FM13Strength
{
	namespace
	{
		const double TraitBonusCap = 3.0;
		int32 JsRound(double V) { return (int32)std::floor(V + 0.5); } // Math.round()
	}

	const TCHAR* TraitName(uint8 Trait)
	{
		static const TCHAR* Namen[TraitAnzahl] = { TEXT(""), TEXT("Tor-Instinkt"), TEXT("Freistoss-Gott"), TEXT("Elfmeter-Killer"), TEXT("Leader"),
			TEXT("Eisenfuss"), TEXT("Fluegelflitzer"), TEXT("Zweikampfmonster"), TEXT("Wetterfest") };
		return Trait < TraitAnzahl ? Namen[Trait] : Namen[0];
	}

	int32 ChemistryBonus(int32 SummeDerPaare, int32 AnzahlPaare)
	{
		const int32 Prozent = AnzahlPaare > 0 ? JsRound((double)SummeDerPaare / AnzahlPaare / 30.0 * 100.0) : 0;
		return JsRound(Prozent / 100.0 * 3.0);
	}

	int32 Grade(int32 OwnGoals, int32 OppGoals, int32 DailyForm, int32 Tore, int32 Vorlagen, EFM13Position Pos, double Zufall)
	{
		double Note = 3.5 - FMath::Max(-0.75, FMath::Min(0.75, (OwnGoals - OppGoals) * 0.3));
		Note -= (DailyForm - 50) / 100.0;
		Note -= Tore * 0.75;
		Note -= Vorlagen * 0.4;
		if (Pos == EFM13Position::TW || Pos == EFM13Position::ABW)
		{
			if (OppGoals == 0) Note -= 0.5;
			else if (OppGoals >= 3) Note += 0.4;
		}
		Note += Zufall - 0.5;
		const int32 Halbe = FMath::Max(2, FMath::Min(12, JsRound(Note * 2.0))); // 1,0 bis 6,0 in halben Noten
		return Halbe * 5;
	}

	int32 ScorerWeight(EFM13Position Pos, uint8 Trait)
	{
		static const int32 Gewicht[4] = { 2, 10, 30, 50 }; // TW 0,15 -> Math.round(1,5) = 2
		return Gewicht[(int32)Pos] + (Trait == Eisenfuss ? 30 : 0);
	}

	int32 AssistWeight(EFM13Position Pos)
	{
		static const int32 Gewicht[4] = { 1, 15, 40, 20 };
		return Gewicht[(int32)Pos];
	}

	int32 Team(const FEingabe& E)
	{
		const int32 N = E.Elf.Num();
		if (N == 0) return 50;

		double Summe = 0.0;
		for (const FSpieler& P : E.Elf) Summe += P.Strength * (P.Fitness / 100.0) * (0.9 + P.DailyForm / 500.0);

		double Bonus = E.LicenseBoost + (E.bCoTrainer ? 2.0 * E.CoTrainerLevel * E.CoTrainerWirkung : 0.0) + (E.bHome ? 3.0 : 0.0);
		if (E.bHome && E.bGreenkeeper) Bonus += (E.bGreenkeeperTempo ? 3 : 2) * E.GreenkeeperLevel;
		if (E.bAnalystTiefe) Bonus += 1 * E.AnalystLevel;
		if (E.bErnaehrungLeistung) Bonus += 1 * E.ErnaehrungLevel;
		Bonus += E.TrainingGround * 1;
		if (E.bSynergie) Bonus += 1;
		if (E.bVideoAnalyse) Bonus += 2;

		if (!E.bHome)
		{
			Bonus += (E.Fans / 100.0) * 1.5;
			if (E.bFanBus) Bonus += 1.5;
		}

		Bonus += E.ChemistryBonus;
		Bonus += E.CliqueModifier;
		Bonus += E.CouncilStabilizer * 0.3;

		if (E.bStealBanner && E.bHome) Bonus += 3;
		if (E.bTactician) Bonus += 3;

		auto Hat = [&E](uint8 Trait) { for (const FSpieler& P : E.Elf) if (P.Trait == Trait) return true; return false; };
		double Traits = 0.0;
		if (Hat(Leader)) Traits += 2;
		if (Hat(TorInstinkt)) Traits += 1.5;
		if (Hat(FreistossGott)) Traits += 1;
		{
			bool bKiller = false;
			for (const FSpieler& P : E.Elf) if (P.Trait == ElfmeterKiller && P.Pos == EFM13Position::TW) bKiller = true;
			if (bKiller) Traits += 1.5;
		}
		if (Hat(Eisenfuss)) Traits += 1;
		if (Hat(Fluegelflitzer)) Traits += 1;
		if (Hat(Zweikampfmonster)) Traits += 1.5;
		if (E.WeatherGoalMult < 1.0 && Hat(Wetterfest)) Traits += 1.5;
		Bonus += FMath::Min(TraitBonusCap, Traits);

		if (E.bHome) Bonus += E.BlockCulture;
		if (E.bHome) Bonus += E.StadiumHome;
		Bonus += E.FanSupport;

		for (const FSpieler& P : E.Elf) if (P.bCaptain) { Bonus += P.Age >= 30 ? 2.0 : 1.2; break; }

		double MoralSumme = 0.0;
		for (const FSpieler& P : E.Elf) MoralSumme += P.Morale > 0 ? P.Morale : 80; // (p.morale || 80)
		Bonus += (MoralSumme / N - 80.0) * 0.06;

		Bonus -= E.Stress * 0.03;

		if (E.TeamTraining == TEXT("taktik")) Bonus += 2;

		Bonus += E.StyleBonus;
		Bonus += E.FormationOff;
		Bonus += E.TeamInstruction;
		Bonus += E.TackleHardness == TEXT("hart") ? 1.5 : (E.TackleHardness == TEXT("vorsichtig") ? -1.0 : 0.0);
		Bonus += E.CampBonus;
		if (E.bDoping) Bonus += 8;

		for (const FSpieler& P : E.Elf) if (P.bRoleFits) Bonus += 0.8;

		return FMath::Max(1, JsRound(Summe / FMath::Max(11, N) + Bonus));
	}
}
