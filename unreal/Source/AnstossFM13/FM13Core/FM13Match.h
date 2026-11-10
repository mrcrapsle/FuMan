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

	FExpectedGoals ExpectedGoals(double HomeStrength, double AwayStrength, EFM13Playstyle HomeStyle, EFM13Playstyle AwayStyle);
	int32 Poisson(FRandomStream& Rng, float Lambda);

	// Erwartung vor dem Spiel und Vorstandsreaktion danach (match-live.js, boardShift)
	EFM13Expectation Expectation(int32 OwnStrength, int32 OppStrength);
	int32 BoardShift(EFM13Expectation Erwartung, int32 OwnGoals, int32 OppGoals);

	// Wetter (js/weather.js): wird je Spieltag gewürfelt und wirkt auf das eigene Spiel
	struct FWeather { const TCHAR* Name; int32 Weight; double InjuryMult; double CardMult; double GoalMult; double AttendanceMult; double FitLossMult; };
	const TArray<FWeather>& Weathers();
	int32 RollWeather(FRandomStream& Rng);

	// Schiedsrichter (js/referees.js): feste Ansetzung je Saison, Spieltag und Liga
	struct FReferee { const TCHAR* Name; const TCHAR* Style; float CardMult; int32 MinLeague; int32 MaxLeague; };
	const FReferee& RefereeFor(int32 Season, int32 Matchday, int32 Level, int32 ClubNameLength);

	// Live-Ticker: verteilt die feststehenden Tore auf Minuten und ergänzt Chancen, Karten und Pausenstand.
	// Wie im Browserspiel kommt das Ergebnis allein aus der Torformel, der Ticker erzählt es nur.
	TArray<FString> BuildTicker(FRandomStream& Rng, const FString& OwnName, const FString& OppName, bool bHome,
		const TArray<FString>& OwnScorers, int32 OppGoals, const TArray<FString>& OwnPlayers,
		const TArray<FString>& YellowCards = TArray<FString>(), const TArray<FString>& RedCards = TArray<FString>(),
		const FString& Weather = FString(), const FString& Referee = FString());
}
