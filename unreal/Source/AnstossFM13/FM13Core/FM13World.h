#pragma once

#include "FM13Types.h"
#include "FM13League.h"
#include "FM13Cup.h"

// Der gesamte Spielzustand (entspricht dem globalen game-Objekt plus squad und leaguesData)
// und alle Abläufe. Die Oberfläche ruft nur diese Funktionen auf; Render-Code ändert nie Geld.
class FFM13World
{
public:
	// ---------- Zustand ----------
	FString ClubName;
	int32 Season = 1;
	int32 Matchday = 1;                 // nächster zu spielender Spieltag (1 bis 34, danach Saisonende)
	int32 LeagueLevel = FM13::StartLeagueLevel;
	int64 Money = 150000;
	int32 Fans = 75;                    // 0 bis 100
	int32 BoardSat = 80;                // Vorstandszufriedenheit 10 bis 100
	int32 LowBoardSatStreak = 0;
	TArray<int32> BoardHistory;         // letzte 7 Werte nach jedem Spiel (boardSatVerlauf)
	int32 EarlyWarnSeason = 0;
	int32 SeasonTarget = 9;             // Saisonziel des Vorstands (Tabellenplatz), aus der Kaderstärke
	int64 WageBudget = 0;               // Gehaltsbudget pro Spieltag, vom Vorstand je Saison festgelegt
	bool bSacked = false;

	int32 StadiumCapacity = 4000;
	int32 PendingSeats = 0;             // laufender Ausbau
	int32 PendingSeatsMatchdays = 0;
	int32 TicketPrice = 13;
	int32 YouthAcademyLevel = 1;        // 1 bis 5: mehr und bessere Talente
	int32 TrainingLevel = 1;            // 1 bis 5: Trainingsplatz, beschleunigt die Entwicklung

	int64 TvPaidThisSeason = 0;
	int32 NextPlayerId = 1;

	TArray<FFM13Player> Squad;
	TArray<FFM13Player> YouthTalents;
	TArray<FFM13MarketOffer> Market;
	TArray<FFM13League> Leagues;        // Index = Level, 0 ist die Bundesliga
	TArray<FFM13Booking> Bookings;
	TArray<FFM13Message> Messages;
	TArray<FFM13SeasonRecord> History;
	TArray<FString> UsedClubNames;

	FFM13Cup DfbPokal;
	FFM13Cup Landespokal;
	bool bDfbViaLandespokal = false;     // Landespokal gewonnen: Startplatz im DFB-Pokal der nächsten Saison

	FFM13OwnMatchReport LastReport;
	FFM13OwnMatchReport LastCupReport;   // eigenes Pokalspiel dieses Spieltags (bPlayed = false, wenn keins)
	FRandomStream Rng;

	// ---------- Ablauf ----------
	void NewGame(const FString& InClubName, int32 Seed, int32 StartLevel = FM13::StartLeagueLevel);

	// Spielt den aktuellen Spieltag in allen sechs Ligen. false, wenn die Saison vorbei oder der Trainer entlassen ist.
	bool PlayMatchday();
	bool IsSeasonFinished() const { return Matchday > FM13::MatchdaysPerSeason; }

	// Saisonende: TV-Abrechnung, Auf-/Abstieg, Entwicklung, Verträge, Jugend, neuer Spielplan
	FFM13SeasonSummary ConcludeSeason();

	// ---------- Kader und Transfers ----------
	int32 OwnStrength() const;               // beste Elf im 4-4-2 (ohne Verletzte)
	TArray<int32> StartingEleven() const;    // Ids der besten Elf
	int32 ClubStrength(const FString& Name, EFM13Playstyle& OutStyle) const;
	int32 OwnRank() const;
	const FFM13League& OwnLeague() const { return Leagues[LeagueLevel]; }
	FFM13League& OwnLeague() { return Leagues[LeagueLevel]; }
	int64 WagesPerMatchday() const;
	int64 SquadValue() const;
	bool HasTransferEmbargo() const { return Money < 0; }
	bool FitsWageBudget(int64 ExtraWage) const { return WagesPerMatchday() + ExtraWage <= WageBudget; }

	void RefreshMarket();
	bool BuyPlayer(int32 MarketIndex, FString& OutReason);
	bool SellPlayer(int32 PlayerId, FString& OutReason);
	bool RenewContract(int32 PlayerId, int32 Years, FString& OutReason);
	int32 RenewalWage(const FFM13Player& P) const;
	bool PromoteYouth(int32 YouthIndex, FString& OutReason);
	bool ReleaseYouth(int32 YouthIndex, FString& OutReason);

	// ---------- Verein ----------
	bool SetTicketPrice(int32 Price, FString& OutReason);
	bool ExpandStadium(int32 Seats, FString& OutReason);
	bool UpgradeYouthAcademy(FString& OutReason);
	int64 YouthAcademyUpgradeCost() const;
	bool UpgradeTraining(FString& OutReason);
	int64 TrainingUpgradeCost() const;

	// ---------- Hilfen ----------
	FFM13Player* FindPlayer(int32 Id);
	const FFM13Player* FindPlayer(int32 Id) const;
	void Book(const FString& Label, int64 Amount);
	void AddMessage(const FString& Title, const FString& Body);

private:
	FFM13Player CreatePlayer(EFM13Position Pos, int32 MinStr, int32 MaxStr, int32 MinAge, int32 MaxAge);
	void InitLeagues(int32 StartLevel);
	void PlayOwnFixture(FFM13League& L, FFM13Fixture& F);
	void ApplyMatchdayFinances(bool bHome, bool bWin, int32 Attendance);
	void CheckJobSecurity();
	void TrainPlayers();
	void PlanSeason();
	void CheckSeasonEndSacking(int32 Rank);
	void AdvanceLeagues(int32 OwnRank, EFM13SeasonOutcome OwnOutcome);
	void EvolveAiClub(FFM13Club& C, int32 Rank, int32 OldLevel, EFM13SeasonOutcome Outcome);
	void DevelopPlayers(FFM13SeasonSummary& Summary);
	void YouthIntake(FFM13SeasonSummary& Summary);
	void PickScorers(int32 Goals, TArray<FString>& OutNames);
	void InitCups();
	void PlayCupRound(FFM13Cup& Cup, bool bDfb);
	void RollInjuries(FFM13OwnMatchReport& Report);
	void FinishOwnReport(FFM13OwnMatchReport& Report, const FString& OppName, bool bHome);
};
