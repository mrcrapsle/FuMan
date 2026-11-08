#pragma once

#include "FM13Types.h"

// Spielberechnung, gemeinsam für eigene und KI-Spiele (wie getExpectedGoals() in js/utils.js).
namespace FM13Match
{
	struct FExpectedGoals
	{
		float Home = 1.35f;
		float Away = 1.35f;
	};

	// AI_PLAYSTYLES aus js/leagues.js
	float GoalBonus(EFM13Playstyle Style);
	float ConcedeBonus(EFM13Playstyle Style);

	FExpectedGoals ExpectedGoals(int32 HomeStrength, int32 AwayStrength, EFM13Playstyle HomeStyle, EFM13Playstyle AwayStyle);
	int32 Poisson(FRandomStream& Rng, float Lambda);

	// Erwartung vor dem Spiel und Vorstandsreaktion danach (match-live.js, boardShift)
	EFM13Expectation Expectation(int32 OwnStrength, int32 OppStrength);
	int32 BoardShift(EFM13Expectation Erwartung, int32 OwnGoals, int32 OppGoals);

	// Live-Ticker: verteilt die feststehenden Tore auf Minuten und ergänzt Chancen, Karten und Pausenstand.
	// Wie im Browserspiel kommt das Ergebnis allein aus der Torformel, der Ticker erzählt es nur.
	TArray<FString> BuildTicker(FRandomStream& Rng, const FString& OwnName, const FString& OppName, bool bHome,
		const TArray<FString>& OwnScorers, int32 OppGoals, const TArray<FString>& OwnPlayers);
}
