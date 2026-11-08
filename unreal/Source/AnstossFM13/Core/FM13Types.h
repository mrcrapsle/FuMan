#pragma once

#include "CoreMinimal.h"

// Grundtypen des Spielkerns. Reines C++ ohne UCLASS/USTRUCT: der Kern läuft so auch ohne Engine
// (Tests unter unreal/Tests/Host). Die UE-Schicht (Game/) macht daraus Blueprint-Daten.
// Vorbild sind game, squad und leaguesData aus dem Browserspiel (js/state.js, js/entities.js, js/leagues.js).

namespace FM13
{
	constexpr int32 NumLeagues = 6;            // 1. Bundesliga bis 6. Liga (Landesliga)
	constexpr int32 TeamsPerLeague = 18;
	constexpr int32 MatchdaysPerSeason = 34;
	constexpr int32 MaxSquadSize = 30;
	constexpr int32 MinSquadSize = 16;
	constexpr int32 StartLeagueLevel = 5;      // wie im Browserspiel: Start ganz unten
	constexpr int32 BoardWarningThreshold = 25; // BOARD_SAT_WARNING_THRESHOLD
	constexpr int32 BoardSackStreak = 6;        // BOARD_SAT_SACK_STREAK
	constexpr int32 MaxBookings = 400;
	constexpr int32 MaxMessages = 200;

	// leagueNames aus js/state.js (ohne Umlaute im Quelltext)
	const TCHAR* LeagueName(int32 Level);
	// Grundstärke einer Liga: 82 - Level * 10 (initLeagues, evolveAiTeamStrength)
	inline int32 LeagueBaseStrength(int32 Level) { return 82 - Level * 10; }
}

enum class EFM13Position : uint8 { TW = 0, ABW = 1, MIT = 2, ST = 3 };
enum class EFM13Playstyle : uint8 { Offensiv = 0, Defensiv = 1, Ausgeglichen = 2, Konter = 3 };
enum class EFM13Expectation : uint8 { Favorit = 0, Offen = 1, Aussenseiter = 2 };
enum class EFM13SeasonOutcome : uint8 { Stayed = 0, Promoted = 1, Relegated = 2 };

const TCHAR* FM13PositionName(EFM13Position Pos);

struct FFM13Player
{
	int32 Id = 0;
	FString Name;
	EFM13Position Pos = EFM13Position::MIT;
	int32 Strength = 50;
	int32 Potential = 50;     // Obergrenze für die Entwicklung junger Spieler
	int32 Age = 24;
	int32 GoalsSeason = 0;
	int32 GoalsCareer = 0;
	int32 Appearances = 0;    // Einsätze in der laufenden Saison
	int64 MarketValue = 15000;
	int32 Wage = 250;         // Euro pro Spieltag
	int32 ContractYears = 2;  // Restlaufzeit in Saisons
};

// Tabellenzeile und Verein in einem, wie in leaguesData.
struct FFM13Club
{
	FString Name;
	int32 Strength = 50;      // KI-Stärke; beim eigenen Verein zählt der Kader
	EFM13Playstyle Playstyle = EFM13Playstyle::Ausgeglichen;
	bool bOwn = false;

	int32 Played = 0;
	int32 Won = 0;
	int32 Drawn = 0;
	int32 Lost = 0;
	int32 GoalsFor = 0;
	int32 GoalsAgainst = 0;

	int32 Points() const { return Won * 3 + Drawn; }
	int32 GoalDiff() const { return GoalsFor - GoalsAgainst; }
	void ResetStats() { Played = Won = Drawn = Lost = GoalsFor = GoalsAgainst = 0; }
};

struct FFM13Fixture
{
	int32 Matchday = 1;
	int32 Home = 0;           // Index in FFM13League::Clubs
	int32 Away = 0;
	bool bPlayed = false;
	int32 HomeGoals = 0;
	int32 AwayGoals = 0;
};

// Kontoauszug: jede Buchung trägt ein Etikett (wie bucheMitLabel in js/finances.js)
struct FFM13Booking
{
	FString Label;
	int64 Amount = 0;
	int32 Season = 1;
	int32 Matchday = 1;
};

struct FFM13Message
{
	FString Title;
	FString Body;
	int32 Season = 1;
	int32 Matchday = 1;
};

struct FFM13MarketOffer
{
	FFM13Player Player;
	int64 Price = 0;
};

struct FFM13SeasonRecord
{
	int32 Season = 1;
	int32 Level = 5;
	int32 Rank = 0;
	int32 Points = 0;
	EFM13SeasonOutcome Outcome = EFM13SeasonOutcome::Stayed;
};

// Bericht über das eigene Spiel eines Spieltags (für Oberfläche und Tests)
struct FFM13OwnMatchReport
{
	bool bPlayed = false;
	bool bHome = true;
	FString Opponent;
	int32 OwnGoals = 0;
	int32 OppGoals = 0;
	int32 OwnStrength = 0;
	int32 OppStrength = 0;
	int32 Attendance = 0;
	int64 Income = 0;
	int64 Expenses = 0;
	int32 BoardShift = 0;
	TArray<FString> Scorers;
};

struct FFM13SeasonSummary
{
	int32 Season = 1;
	int32 Level = 5;
	int32 Rank = 0;
	int32 Points = 0;
	EFM13SeasonOutcome Outcome = EFM13SeasonOutcome::Stayed;
	int64 TvPayout = 0;
	TArray<FString> Left;      // Spieler, die gegangen sind (Vertragsende, Ruhestand)
	TArray<FString> NewYouth;  // neue Talente
};
