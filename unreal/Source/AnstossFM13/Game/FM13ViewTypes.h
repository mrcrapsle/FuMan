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
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Assists = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Fitness = 100;   // Kondition 10 bis 100
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Trait;           // besondere Faehigkeit, leer = keine
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bCaptain = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 DailyForm = 50;  // Tagesform 5 bis 95
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString GradeAverage;   // Schnitt, z. B. "2,4", leer ohne Spiel
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString LastGrade;      // letzte Note, leer ohne Spiel
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Appearances = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 MarketValue = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Wage = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ContractYears = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bInStartingEleven = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 InjuredMatchdays = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 SuspendedMatchdays = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 YellowCards = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 SeasonsAtClub = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Archetype;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Character;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Morale = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bBenched = false;
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
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString BestPlayer;            // Spieler des Spiels mit Note, leer ohne Ligaspiel
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> TeamOfMatchday; // Elf des Spieltags (Note 1,5 oder besser)
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Ticker;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Injuries;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Competition;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bPenalties = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bAdvanced = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Weather;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Referee;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString OppArchetype;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 TacticBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Cards;
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

USTRUCT(BlueprintType)
struct FFM13TacticsView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Formation;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Style;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> Formations;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> StyleKeys;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> StyleLabels;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<int32> StyleBonuses;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> StyleArchetypes;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ElfStrength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 MatchStrength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 StyleBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") float FormationBonus = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 FitnessCostPercent = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString NextOpponent;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 NextOpponentStrength = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bNextHome = true;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString OppPlan;        // öffentlicher Grundstil des Gegners
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bOppReacted = false; // nur nach dem Spiel bekannt, hier immer false
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 MatchupBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Predictable;   // leer = nicht berechenbar
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Referee;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bManualLineup = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> TalkKeys;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> TalkLabels;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<float> TalkBonuses;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString PendingTalk;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Prep;           // gewählte Vorbereitung (leer = keine)
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ForecastWin = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ForecastDraw = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ForecastLoss = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") float MoraleBonus = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Rival;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 MatchdaysToDerby = -1;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> DerbyPreps;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 DerbyStimmungCost = 0;
};

USTRUCT(BlueprintType)
struct FFM13EuropeView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bActive = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bQualifiedNext = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Stage;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Winner;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> GroupA;     // fertige Tabellenzeilen
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> GroupB;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> KnockOut;   // Halbfinale und Finale
	UPROPERTY(BlueprintReadOnly, Category = "FM13") TArray<FString> LastResults;
};

USTRUCT(BlueprintType)
struct FFM13SponsorView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Name;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Base = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 WinBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 PromotionBonus = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 SignOn = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 MatchdaysLeft = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Tier;
};

USTRUCT(BlueprintType)
struct FFM13IncomingOfferView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString PlayerName;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Club;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 Price = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bYouth = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 ExpiresMatchday = 0;
};

USTRUCT(BlueprintType)
struct FFM13AchievementView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Label;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bUnlocked = false;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Season = 0;
};

USTRUCT(BlueprintType)
struct FFM13LegendView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Name;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString Position;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Seasons = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Goals = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 RetiredSeason = 0;
};

USTRUCT(BlueprintType)
struct FFM13RecordsView
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString BiggestWin;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 UnbeatenStreak = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 LongestUnbeatenStreak = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 RecordAttendance = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int64 RecordTransferFee = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString LastRelegation;
};
