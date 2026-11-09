#pragma once

#include "CoreMinimal.h"
#include "FM13ViewTypes.generated.h"

// Blueprint-Sicht auf den Spielkern. Nur Kopien zum Anzeigen: Änderungen laufen immer über die
// Funktionen von UFM13GameInstance, nie über diese Strukturen.

USTRUCT(BlueprintType)
struct FFM13PlayerView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Id = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Name;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Position;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Strength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Potential = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Age = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 GoalsSeason = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Appearances = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 MarketValue = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Wage = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ContractYears = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bInStartingEleven = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 InjuredMatchdays = 0;
};

USTRUCT(BlueprintType)
struct FFM13OfferView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FFM13PlayerView Player;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Price = 0;
};

USTRUCT(BlueprintType)
struct FFM13TableRowView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Rank = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Club;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Played = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Won = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Drawn = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Lost = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 GoalsFor = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 GoalsAgainst = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 GoalDiff = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Points = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bOwn = false;
};

USTRUCT(BlueprintType)
struct FFM13FixtureView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Matchday = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Home;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Away;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bPlayed = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 HomeGoals = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 AwayGoals = 0;
};

USTRUCT(BlueprintType)
struct FFM13BookingView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Label;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Amount = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Season = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Matchday = 0;
};

USTRUCT(BlueprintType)
struct FFM13MessageView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Title;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Body;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Season = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Matchday = 0;
};

USTRUCT(BlueprintType)
struct FFM13MatchReportView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bPlayed = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bHome = true;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Opponent;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 OwnGoals = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 OppGoals = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 OwnStrength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 OppStrength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Attendance = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Income = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Expenses = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 BoardShift = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Scorers;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Ticker;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Injuries;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Competition;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bPenalties = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bAdvanced = false;
};

USTRUCT(BlueprintType)
struct FFM13CupView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Name;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bOwnEntered = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bOwnAlive = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bFinished = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString NextRound;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 NextMatchday = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 TeamsLeft = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Winner;
	// Ergebnisse der letzten Runde als fertige Zeilen ("Heim - Gast 2:1 n.E.")
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> LastRound;
};

USTRUCT(BlueprintType)
struct FFM13StatusView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString ClubName;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString LeagueName;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 LeagueLevel = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Season = 1;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Matchday = 1;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Money = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Fans = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 BoardSat = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 SeasonTarget = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Rank = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 OwnStrength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 WageBudget = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Wages = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 SquadValue = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 StadiumCapacity = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 PendingSeats = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 PendingSeatsMatchdays = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 TicketPrice = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 YouthAcademyLevel = 1;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 YouthAcademyUpgradeCost = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 TrainingLevel = 1;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 TrainingUpgradeCost = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bSeasonFinished = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bSacked = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bTransferEmbargo = false;
};

USTRUCT(BlueprintType)
struct FFM13SeasonRecordView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Season = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString LeagueName;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Rank = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Points = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Outcome;   // "Aufstieg", "Abstieg", "Klassenerhalt"
};
