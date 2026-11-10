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

	// Taktik (js/squad.js, js/match.js, js/opponent-tactics.js)
	FString Formation = TEXT("4-4-2");
	FString TacticStyle = TEXT("ausgeglichen");
	FString TeamTraining = TEXT("ausgeglichen");   // Teamtraining des Spieltags (js/training.js)
	FString TrainingIntensity = TEXT("normal");     // Trainingsintensität: hart, normal, locker
	bool bBusTravel = false;                        // Reisemodus Bus statt Flugzeug
	bool bBusSponsor = false;                       // gesponserter Bus
	bool bBusBanden = false;                        // Bandensponsor-Variante
	FFM13Staff AthletikTrainer, Ernaehrungsberater, Physio, Greenkeeper; // Personal im Campus
	bool bFitnessGuru = false;                      // Perk Fitness-Guru
	// Stärke der eigenen Elf (calcTeamStrength, js/match.js)
	FFM13Staff CoTrainer, Analyst;
	int32 LicenseLevel = 0;                         // Trainerlizenz 0 bis 3 (Stärke +0, +1, +2, +4)
	int32 Stress = 15;                              // Privatleben: Stress des Managers, -0,03 Stärke je Punkt
	bool bTactician = false;                        // Perk Taktiker: +3
	int32 CampusTrainingGround = 0;                 // Campus: Trainingsgelände mit Flutlicht, +1 je Stufe
	FString TackleHardness = TEXT("normal");        // Zweikampfhärte: hart, normal, vorsichtig
	int32 CaptainId = 0;                            // Kapitän (0 = keiner)
	TArray<int32> PairA, PairB, PairValue;          // Eingespieltheit je Spielerpaar (PairA < PairB), höchstens 30
	int32 PromotionBoostLevel = -1;                 // Aufstiegseuphorie: Liga und Saison nach dem Aufstieg
	int32 PromotionBoostSeason = 0;
	int32 TeamStrength(bool bHome) const;           // calcTeamStrength()
	double OwnMatchStrengthExact(TCHAR OppArchetype, bool bHome) const; // Ligaspiel: getOwnLeagueMatchStrength() plus Ansprache
	double OwnCupStrength(bool bHome) const;        // Pokal, Europapokal, Relegation
	double PromotionEuphoria() const;
	int32 LineupChemistry() const;                  // Eingespieltheit der Elf: 0 bis 3
	EFM13Playstyle OwnPlaystyle() const;
	TArray<FString> RecentStyles;           // Spielstile der letzten Ligaspiele (für die Gegner-Analyse)
	TCHAR OppPlanArchetype = 0;             // geplanter Ansatz des nächsten Liga-Gegners
	bool bOppPlanReacted = false;           // der Gegner hat sich auf dich eingestellt
	int32 WeatherIndex = 0;                 // Wetter des aktuellen Spieltags (FM13Match::Weathers)

	// Sponsor, Angebote, Ehrungen
	FFM13Sponsor Sponsor;
	TArray<FFM13Sponsor> SponsorOffers;
	TArray<FFM13IncomingOffer> IncomingOffers;
	FFM13ClubRecords Records;
	TArray<FFM13Achievement> Achievements;
	TArray<FFM13Legend> Legends;
	FFM13RelegationResult LastRelegation;

	// Runde B: Aufstellung, Ansprache, Vorbereitung, Derby, Europapokal
	TArray<int32> ManualLineup;             // bis 11 Spieler-Ids; leer = automatisch die besten
	TArray<int32> ManualBench;              // bewusst herausgenommen: werden beim Auffüllen übergangen
	FString PendingTalk;                    // Kabinenansprache für das nächste Spiel ("fokus", "mut", "druck")
	TArray<FString> TalkHistory;            // letzte Ansprachen (dreimal gleich nutzt sich ab)
	TCHAR PrepArchetype = 0;                // Spielvorbereitung: erwarteter Ansatz des nächsten Gegners
	int32 PrepMatchday = 0;
	FString RivalName;                      // Derby-Gegner in der eigenen Liga
	TArray<FString> DerbyPreps;             // gebuchte Derby-Vorbereitungen ("stimmung", "praemie", "kampfansage")
	int32 DerbyPrepMatchday = 0;
	bool bEuropeNextSeason = false;         // qualifiziert (Bundesliga Platz 1-4 oder Pokalsieger)
	int32 EuropePot = 2;
	FFM13Europe Europe;
	TArray<FString> AwardHistory;           // Auszeichnungen je Saison

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

	// ---------- Taktik ----------
	bool SetFormation(const FString& Name, FString& OutReason);
	bool SetTacticStyle(const FString& Key, FString& OutReason);
	int32 OwnMatchStrength(TCHAR OppArchetype) const;     // Elf + Spielstil + Formation + Taktik-Duell
	const FFM13Club* NextLeagueOpponent(bool* OutHome = nullptr) const;
	FString RefereeName() const;

	// ---------- Aufstellung, Ansprache, Vorbereitung, Derby (Runde B) ----------
	bool SetManualLineup(const TArray<int32>& Ids, FString& OutReason);
	bool ToggleLineupPlayer(int32 PlayerId, FString& OutReason);
	void ClearManualLineup() { ManualLineup.Reset(); ManualBench.Reset(); }
	bool IsManualLineup() const { return ManualLineup.Num() > 0; }
	bool ChooseTalk(const FString& Type, FString& OutReason);
	float TalkBonus(const FString& Type) const;          // computePregameTalkBonus()
	bool SetMatchPrep(TCHAR Archetype, FString& OutReason);
	float MatchPrepBonus() const;
	float MoraleBonus() const;
	bool IsDerbyNext() const;
	int32 MatchdaysToDerby() const;                      // 0 = Derby heute, -1 = keins in Sicht
	bool BookDerbyPrep(const FString& Type, FString& OutReason);
	int64 DerbyPrepCost(const FString& Type) const;
	// Spielprognose des Chef-Analysten (js/match-scout.js): 500 Simulationen
	void Forecast(int32& OutWin, int32& OutDraw, int32& OutLoss) const;

	// ---------- Angebote ----------
	bool AcceptSponsorOffer(int32 Index, FString& OutReason);
	bool AcceptIncomingOffer(int32 Index, FString& OutReason);
	bool DeclineIncomingOffer(int32 Index, FString& OutReason);
	static FString AchievementLabel(const FString& Id);
	static int32 AchievementCount();

	// ---------- Verein ----------
	bool SetTicketPrice(int32 Price, FString& OutReason);
	bool ExpandStadium(int32 Seats, FString& OutReason);
	bool UpgradeYouthAcademy(FString& OutReason);
	int64 YouthAcademyUpgradeCost() const;
	bool UpgradeTraining(FString& OutReason);
	int64 TrainingUpgradeCost() const;

	// Pokale der laufenden Saison neu auslosen (auch für den Import aus dem Browserspiel)
	void InitCups();
	// Plan des nächsten Liga-Gegners festlegen (nach jedem Spieltag, Saisonstart und Import)
	void PrepareOppPlan();

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
	void RollCards(FFM13OwnMatchReport& Report, TArray<FString>& OutYellow, TArray<FString>& OutRed);
	void MakeSponsorOffers();
	void TickSponsor();
	void TickIncomingOffers();
	void UpdateRecords(int32 OwnGoals, int32 OppGoals, const FString& Opp, int32 Attendance);
	void CheckAchievements(bool bSeasonEnd, int32 Rank, EFM13SeasonOutcome Outcome, TArray<FString>* OutNew = nullptr);
	void Unlock(const FString& Id, TArray<FString>* OutNew);
	FFM13RelegationResult PlayRelegation(int32 Rank);
	TArray<int32> LineupIndices(int32& OutStrength) const;
	void ResolveMatchMood(int32 OwnGoals, int32 OppGoals, const FFM13OwnMatchReport& Report);
	void PickRival();
	void InitEurope();
	void PlayEuropeMatchday();
	void SeasonAwards(FFM13SeasonSummary& S, int32 Rank, EFM13SeasonOutcome Outcome);
	void CheckSeasonEndSacking(int32 Rank);
	void AdvanceLeagues(int32 OwnRank, EFM13SeasonOutcome OwnOutcome);
	void EvolveAiClub(FFM13Club& C, int32 Rank, int32 OldLevel, EFM13SeasonOutcome Outcome);
	void DevelopPlayers(FFM13SeasonSummary& Summary);
	void YouthIntake(FFM13SeasonSummary& Summary);
	void PickScorers(int32 Goals, TArray<FString>& OutNames);
	void ApplyGrades(int32 OwnGoals, int32 OppGoals);
	void ApplyFitnessAfterMatchday(bool bHome);
	void TickPairChemistry();
	void EnsureCaptain();
	TArray<int32> MatchGoals;   // Tore und Vorlagen des letzten eigenen Spiels je Kaderindex
	TArray<int32> MatchAssists;
	void PlayCupRound(FFM13Cup& Cup, bool bDfb);
	void RollInjuries(FFM13OwnMatchReport& Report);
	void FinishOwnReport(FFM13OwnMatchReport& Report, const FString& OppName, bool bHome, const TArray<FString>& Yellow, const TArray<FString>& Red);
};
