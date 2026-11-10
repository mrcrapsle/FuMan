#pragma once

#include "CoreMinimal.h"

// Grundtypen des Spielkerns. Reines C++ ohne UCLASS/USTRUCT: der Kern läuft so auch ohne Engine
// (Tests unter unreal/Tests/Host). Die UE-Schicht (Game/) macht daraus Blueprint-Daten.
// Vorbild sind game, squad und leaguesData aus dem Browserspiel (js/state.js, js/entities.js, js/leagues.js).

namespace FM13
{
	const int32 AiHomeAdvantage = 3;   // AI_HOME_ADVANTAGE: Heimvorteil der KI-Vereine, die eigene Elf bekommt ihn in calcTeamStrength()
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
const TCHAR* FM13CharacterName(uint8 Character);

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
	int32 InjuredMatchdays = 0; // fällt so viele Spieltage aus (0 = fit)
	int32 SuspendedMatchdays = 0; // gesperrt (Rot oder fünfte Gelbe)
	int32 YellowCards = 0;      // Gelbe Karten der Saison, jede fünfte sperrt
	int32 SeasonsAtClub = 0;    // für Legenden beim Karriereende
	uint8 Archetype = 0;        // Entwicklungstyp (FM13Dev), aus der Id abgeleitet
	uint8 Character = 0;        // characterPool: Ruhig, Emotional, Ehrgeizig, Selbstbewusst, Bescheiden, Hitzkoepfig
	int32 Morale = 65;          // 5 bis 100
	int32 Assists = 0;          // Vorlagen der Saison (Liga und Pokal)
	int32 AssistsCareer = 0;
	int32 GradeSum = 0;         // Summe der Ligennoten in Zehnteln (1,0 bis 6,0 = 10 bis 60)
	int32 GradeGames = 0;       // Ligaspiele mit Note in der Saison
	int32 LastGrade = 0;        // letzte Note in Zehnteln (0 = noch keine)
	int32 TeamOfMatchday = 0;   // Nominierungen fuer die Elf des Spieltags in der Saison (Note 1,5 oder besser)
	int32 Fitness = 100;        // Kondition 10 bis 100
	int32 DailyForm = 50;       // Tagesform 5 bis 95, jeder Spieltag neu
	uint8 Trait = 0;            // FM13Strength::ETrait, 0 = keiner
	int32 AppearancesTotal = 0; // Einsätze insgesamt (Führungsqualität, js/locker-room.js)
	int32 TimesInjured = 0;     // frühere Verletzungen: macht anfälliger
	bool bChronic = false;      // chronische Beschwerden (Medizincheck): Risiko x 1,5

	bool IsAvailable() const { return InjuredMatchdays <= 0 && SuspendedMatchdays <= 0; }
};

// Personal im Campus (js/campus-staff.js): eingestellt, Ausbaustufe 1 bis 3, Automatik-Aufgabe ("" = Standard)
struct FFM13Staff
{
	bool bHired = false;
	int32 Level = 1;
	FString Task;
	int32 Morale = 80;        // staffMeta.morale: unter 70 wirkt er nur zu 85 %, unter 40 zu 65 %
};

// Hauptsponsor (js/sponsors.js, vereinfacht: keine Verhandlung, keine Themenboni)
struct FFM13Sponsor
{
	FString Name;
	int32 Base = 0;           // pro Spieltag
	int32 WinBonus = 0;       // pro Sieg
	int32 PromotionBonus = 0; // beim Aufstieg
	int32 SignOn = 0;         // Handgeld bei Unterschrift
	int32 MatchdaysLeft = 0;  // Restlaufzeit in Spieltagen
	FString Tier;             // "kurz", "mittel", "lang"
};

// Angebot eines KI-Vereins für einen eigenen Spieler oder ein Talent (transfermarket.js, youth-sales.js)
struct FFM13IncomingOffer
{
	int32 PlayerId = 0;
	bool bYouth = false;
	FString PlayerName;
	FString Club;
	int64 Price = 0;
	int32 ExpiresMatchday = 0; // gilt bis einschließlich dieses Spieltags
};

struct FFM13ClubRecords
{
	int32 BiggestWinFor = 0, BiggestWinAgainst = 0;
	FString BiggestWinOpponent;
	int32 BiggestWinSeason = 0;
	int32 UnbeatenStreak = 0;
	int32 LongestUnbeatenStreak = 0;
	int32 RecordAttendance = 0;
	int64 RecordTransferFee = 0;
};

struct FFM13Achievement
{
	FString Id;
	int32 Season = 0;
	int32 Matchday = 0;
};

struct FFM13Legend
{
	FString Name;
	FString Position;
	int32 Seasons = 0;
	int32 Goals = 0;
	int32 BestStrength = 0;
	int32 RetiredSeason = 0;
};

// Europapokal (js/europe.js, „Champions Cup“): zwei Vierergruppen, Halbfinale mit Hin- und Rückspiel, Finale
struct FFM13EuroTeam
{
	FString Name;
	int32 Strength = 80;
	int32 Played = 0, Won = 0, Drawn = 0, Lost = 0, GoalsFor = 0, GoalsAgainst = 0;
	int32 Points() const { return Won * 3 + Drawn; }
};

struct FFM13EuroTie
{
	FString A, B;                 // A hat im Hinspiel Heimrecht
	int32 Leg1A = -1, Leg1B = -1, Leg2A = -1, Leg2B = -1;
	bool bPenalties = false;
	FString Winner;
};

struct FFM13Europe
{
	bool bActive = false;         // Wettbewerb läuft in dieser Saison (eigener Verein dabei)
	TArray<FFM13EuroTeam> Groups[2];
	int32 GroupRound = 0;         // gespielte Gruppenspieltage (0 bis 6)
	TArray<FFM13EuroTie> Semis;
	FFM13EuroTie Final;
	FString Winner;
	FString OwnStage;             // "Gruppe", "Halbfinale", "Finale", "Sieger"
	TArray<FString> LastResults;  // Ergebnisse des letzten Europapokal-Spieltags
};

struct FFM13RelegationResult
{
	bool bPlayed = false;
	bool bForPromotion = false;  // true: eigener Dritter gegen den 16. der Liga darüber
	FString Opponent;
	int32 Leg1Own = 0, Leg1Opp = 0, Leg2Own = 0, Leg2Opp = 0;
	bool bPenalties = false;
	bool bWon = false;
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
	FString BestPlayer;       // Spieler des Spiels (beste Note), nur Liga
	int32 BestGrade = 0;      // in Zehnteln
	TArray<FString> TeamOfMatchday; // Elf des Spieltags: Note 1,5 oder besser
	TArray<FString> Ticker;     // Spielverlauf Minute für Minute
	FString Weather;
	FString Referee;
	FString OppArchetype;       // geplanter Ansatz des Gegners (Pressing, Ballbesitz, Konter, neutral)
	int32 TacticBonus = 0;      // Taktik-Duell: +2, 0 oder -2
	TArray<FString> Cards;      // Rote Karten und Sperren
	FString Talk;               // gehaltene Kabinenansprache
	float TalkBonus = 0.f;
	float PrepBonus = 0.f;      // Spielvorbereitung (richtig getippt +2,5)
	float DerbyBonus = 0.f;
	bool bDerby = false;
	TArray<FString> Injuries;   // in diesem Spiel verletzt
	FString Competition;        // "Liga", "DFB-Pokal", "Landespokal"
	bool bPenalties = false;
	bool bAdvanced = false;     // Pokal: weiter
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
	TArray<FString> NewLegends;
	TArray<FString> NewAchievements;
	TArray<FString> Awards;     // Auszeichnungen der Saison (Torjäger, Spieler, Trainer)
	FFM13RelegationResult Relegation;
};
