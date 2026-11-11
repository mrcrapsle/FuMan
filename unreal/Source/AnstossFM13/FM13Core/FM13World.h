#pragma once

#include "FM13Types.h"
#include "FM13League.h"
#include "FM13Cup.h"
#include "FM13Transfers.h"

// Der gesamte Spielzustand (entspricht dem globalen game-Objekt plus squad und leaguesData)
// und alle Abläufe. Die Oberfläche ruft nur diese Funktionen auf; Render-Code ändert nie Geld.
class FFM13World
{
public:
	TArray<int32> MatchGoals;   // Tore des letzten eigenen Spiels je Kaderindex (Meilensteine, Noten)
	TArray<int32> MatchAssists; // Vorlagen des letzten eigenen Spiels je Kaderindex
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
	int32 YouthCoachId = 0;                        // Jugendtrainer aus dem Profikader (0 = keiner)
	int32 YouthCoachCount = 0;                     // Ernennungen insgesamt (Erfahrung, 0,02 je Stufe)
	FRandomStream RngJugend;                       // eigener Zufall fuer die Jugend, damit andere Systeme gleich bleiben
	void TickYouthDevelopment();                   // monatlich: tickYouthDevelopment()
	// Jugend-Laufbahn (js/youth-pathway.js): Entscheidung mit 19, Leihe, Rueckkehr, Durchbrueche, Meilensteine
	struct FFM13YouthLoan
	{
		FFM13Player Player;
		FString Club;
		int32 ClubLevel = 0;
		int32 ClubStrength = 50;
		int32 Duration = 0;
		int32 OriginalStrength = 0;
		int32 Apps = 0;
		int32 Goals = 0;
		double DevProgress = 0.0;
	};
	TArray<FFM13YouthLoan> YouthLoans;
	TArray<FString> YouthMoments;                  // neueste zuerst, hoechstens 15
	void AddYouthMoment(const FString& Text);
	TArray<FFM13YouthLoan> YouthLoanClubs(const FFM13Player& P) const;   // getYouthLoanClubs(): Stammverein x2, Verein eine Liga hoeher x1
	bool LoanYouth(int32 PlayerId, const FString& Verein, FString& OutReason);
	void ReturnFromLoan(const FFM13YouthLoan& L);
	void TickYouthPathway();                       // taeglich: Entscheidungen, Leihen
	void TickYouthBreakthroughs();                 // monatlich
	void CheckYouthMilestones(const TArray<int32>& Starter);  // Debuet, erstes Tor, erste Elf
	void AgeYouthAtSeasonEnd();                    // ageYouthAtSeasonEnd()
	bool AssignYouthCoach(int32 PlayerId, FString& OutReason);
	void RemoveYouthCoach();
	TArray<int32> CouncilIds;                       // Mannschaftsrat: Kapitän und zwei Führungsspieler
	double CouncilStabilizer() const;               // getCouncilMoraleStabilizer()
	double CliqueModifier() const;                  // getCliqueChemistryModifier()
	void ElectCouncil();                            // electTeamCouncil()
	bool ChangeCaptain(int32 NewId, bool bViaCouncil, FString& OutFolge);  // handleCaptainChange()
	void TickLockerRoom();                          // monatlich nach dem Rat
	// Mannschaftsrat: monatliches Anliegen und die Antwort darauf (js/team-council.js)
	struct FAnliegen
	{
		bool bAktiv = false;
		FString Typ;                // stimmung, einsatzzeit, training, clique, kapitaen, praemie
		FString Titel;
		FString Text;
		int64 Kosten = 0;
		int32 Spieler = 0;          // Spieler-Id (Einsatzzeit)
		int32 Wortfuehrer = 0;      // Clique: Spieler-Id des Sprechers
		int32 Kapitaen = 0;         // Kapitaenfrage
		int32 Nachfolger = 0;
		int32 Clique = -1;          // Clique als Index in der Liste der Kabine, nur fuer den Zug
		int32 Saison = 0;
		int32 Spieltag = 0;
	};
	FAnliegen Anliegen;
	TArray<FString> RatVerlauf;     // letzte sechs Entscheidungen des Rates
	TArray<int32> OwnSeasonGoals;   // Tore fuer und gegen in den Ligaspielen dieser Saison, paarweise
	int64 CouncilCost(int64 Basis) const;          // councilCost()
	bool FindCouncilConcern(FAnliegen& Out) const;  // findCouncilConcern()
	bool AnswerConcern(int32 Option, FString& OutReason);  // answerCouncilConcern()
	void TickTeamCouncil();                         // monatlich vor der Kabine
	int32 CouncilOptionCount(const FString& Typ) const;
	TArray<FFM13Player*> CouncilMembers();
	void TickFriendships();                         // jeder Spieltag
	int32 UnhappyVisitor() const;                   // pickUnhappyVisitor(), 0 = keiner
	TArray<int32> PairA, PairB, PairValue;          // Eingespieltheit je Spielerpaar (PairA < PairB), höchstens 30
	int32 PromotionBoostLevel = -1;                 // Aufstiegseuphorie: Liga und Saison nach dem Aufstieg
	int32 PromotionBoostSeason = 0;
	// Training (js/training.js): Wochenplan mit sieben Tagen, daraus folgt das Teamtraining
	TArray<FString> WeeklyPlan;
	int32 CampusReha = 0;                           // Campus: Reha-Klinik, verkürzt Ausfallzeiten
	// Personal: Einstellen, Entlassen, Weiterbilden, Vertraege, Abwerbung (js/campus-staff.js)
	int64 WageBudgetCap = 0;                        // Personalbudget-Obergrenze je Spieltag, 0 = keine
	int32 LastMeetingSeason = 0;                    // Jahres-Meeting (0 = noch keins)
	int32 PoachSlot = -1;                           // Abwerbeversuch offen: Stelle, -1 = keiner
	int64 PoachRetention = 0;                       // Bindungspraemie
	FFM13Staff* StaffSlot(int32 Slot);
	bool StaffHire(int32 Slot, int32 Bewerber, FString& OutReason);
	bool StaffFire(int32 Slot, FString& OutReason);
	bool StaffUpgrade(int32 Slot, FString& OutReason);
	bool StaffRenew(int32 Slot, FString& OutReason);
	bool StaffRaise(int32 Slot, FString& OutReason);
	bool StaffInterim(int32 Slot, FString& OutReason);
	bool StaffMeeting(FString& OutReason);
	bool StaffSetWageCap(int64 Cap, FString& OutReason);
	bool StaffResolvePoach(bool bPay, FString& OutReason);
	bool StaffHireBreaksCap(int32 Slot) const;
	int64 StaffWagesTotal() const;
	void TickStaff();                               // einmal je Spieltag
	bool SetWeeklyTrainingDay(int32 Day, const FString& Unit, FString& OutReason);
	bool ApplyWeeklyTrainingPreset(const FString& Name, FString& OutReason);
	bool SetTrainingIntensity(const FString& Level, FString& OutReason);
	double InjuryChance() const;                    // Grundrisiko je Spieler der Startelf an diesem Spieltag
	int32 NextFitnessLoss(bool bHome) const;        // Kraftverlust der Startelf im Spiel
	int32 TeamStrength(bool bHome) const;           // calcTeamStrength()
	double OwnMatchStrengthExact(TCHAR OppArchetype, bool bHome) const; // Ligaspiel: getOwnLeagueMatchStrength() plus Ansprache
	double OwnCupStrength(bool bHome) const;        // Pokal, Europapokal, Relegation
	double PromotionEuphoria() const;
	int64 PromotionTransferBonus() const;   // getPromotionTransferBonus(): halbes Liga-Transferbudget
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
	FRandomStream RngKabine;            // eigener Zufall fuer Nationen, Cliquen und Freundschaften: die Spielzahlen bleiben unberuehrt

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
	bool HasTransferEmbargo() const { return bInsolvenzEmbargo || bFfpEmbargo; }   // isTransferEmbargoActive(): Insolvenz-Sperre (ab 6 Spieltagen im Minus) oder Financial Fairplay
	bool FitsWageBudget(int64 ExtraWage) const { return WagesPerMatchday() + ExtraWage <= WageBudget; }

	void RefreshMarket();
	void SetMarketTerms(FFM13MarketOffer& O);          // ensureTransferTerms(): Verkaeufer, Schmerzgrenze, Forderung
	FRandomStream RngTransfer;                         // eigener Zufall fuer Transfers, damit der Rest gleich bleibt
	FRandomStream RngIndustrie;                        // eigener Zufall fuer Rohstoffe, Konkurrenten, Holding-Auftraege
	// Transferbudget und Wechselfenster (js/transfermarket.js, js/season-end.js)
	int64 TransferBudget = 0;                          // game.transferBudget: Budget der Saison
	bool bWinterWindowActive = false;                  // Winterfenster offen (game.winterWindowActive)
	bool bWinterWindowUsed = false;                    // in dieser Saison schon geoeffnet
	int32 WinterWindowCloseMatchday = 0;               // letzter Spieltag des Winterfensters
	static int64 LeagueTransferBudget(int32 Level);    // getLeagueTransferBudget(): 25 Mio. bis 40.000
	// Gehaltsbudget wie js/season-end.js: Liga-Tabelle x Platzfaktor, Untergrenze, Abstiegsklausel, Ruecklagen
	static int64 LeagueWageBudget(int32 Level);        // getLeagueWageBudget(): 1,575 Mio. bis 8.000 je Spieltag
	int32 LastSeasonRank = 0;                          // Endplatz der letzten Saison (0 = erste Saison)
	int64 RelegationWages = 0;                         // gekuerzte Gehaltssumme nach dem Abstieg, nur fuer die naechste Planung
	int64 RenewalWageBuffer() const;                   // getRenewalWageBuffer()
	int64 WageBudgetFloor() const;                     // getWageBudgetFloor()
	int64 ApplyRelegationWageClause();                 // Gehaelter -40 %, Moral -3
	void ApplyCashSurplusBudgets();                    // 40 % der Ruecklagen ins Transfer-, 10 % ins Gehaltsbudget
	bool IsSummerWindowOpen() const { return Matchday <= 3; }
	bool IsTransferWindowOpen() const { return IsSummerWindowOpen() || bWinterWindowActive; }
	bool TransferWindowGate(FString& OutReason) const;  // Meldung, wenn kein Fenster offen ist
	void TickTransferWindows();                        // nach jedem Spieltag: Winterfenster auf und zu
	// Leihspieler (js/transfermarket.js): Leihe mit Kaufoption, Rueckkehr nach 34 Spieltagen
	TArray<FFM13Loanable> Loanables;
	TArray<FFM13IncomingLoan> IncomingLoans;
	FString LastDeadlineKey;                           // "Saison-Fenster", Deadline-Day nur einmal
	void RefreshLoanables();                           // beim Markt-Neuaufbau
	bool SignLoanPlayer(int32 Index, FString& OutReason);
	bool ExerciseLoanBuyOption(int32 PlayerId, FString& OutReason);
	void TickIncomingLoans();                          // nach jedem Spieltag
	void RunDeadlineDay(const FString& Fenster);       // "sommer" oder "winter", einmal je Fenster
	// Wechsel zwischen KI-Vereinen (js/ai-clubs.js): Sterne, Fenster am Spieltag 2 und 19, Ticker
	struct FFM13AiNews
	{
		int32 Season = 0;
		int32 Matchday = 0;
		FString Player;
		EFM13Position Pos = EFM13Position::ST;
		int32 Strength = 0;
		FString From;
		FString To;             // leer bei Karriereende
		int64 Fee = 0;
		bool bRetired = false;
		int32 FromLeague = 0;
		int32 ToLeague = 0;
	};
	TArray<FFM13AiNews> AiNews;                         // neueste zuerst, hoechstens 30
	bool IsAiClub(const FFM13Club& C) const;
	void EnsureAiStars();
	void AddAiNews(const FFM13AiNews& Eintrag);
	FFM13AiNews AiStarNews(int32 L, int32 I) const;
	void TickAiTransfers();                             // Fenster-Spieltage 2 und 19, nach dem Spieltag
	void AgeAiStars();                                  // Saisonende: altern, Karriereende mit 34
	void CreditAiLeagueGoals(FFM13Club& C, int32 Tore); // jedes Tor geht an den Star, die Sturmspitze oder einen Mitspieler
	bool TriggerRandomAIOffer();                       // Deadline-Day: zufaelliger Spieler, zufaelliger Klub

	// Transferpoker (js/transfer-poker.js)
	struct FFM13PokerState
	{
		bool bActive = false;
		int32 PlayerId = 0;          // Spieler auf dem Markt
		int64 Offer = 0;             // dein Angebot
		int32 Rounds = 0;
		int32 Patience = 0;
		double RivalChance = 0.15;
		bool bRival = false;
		FString RivalClub;
		int64 RivalBid = 0;
		int64 AgreedFee = 0;         // 0 = noch keine Einigung
		int64 WageDemand = 0;        // Gehalt je Spieltag, das der Spieler will
		bool bWageTalked = false;
		int32 SwapId = 0;            // Tauschspieler aus dem eigenen Kader (0 = keiner)
		TArray<FString> Log;
	};
	FFM13PokerState Poker;
	bool OpenPoker(int32 PlayerId, FString& OutReason);
	void ClosePoker();
	bool AdjustPokerOffer(int32 Prozent, FString& OutReason);
	bool SubmitPokerOffer(FString& OutReason);
	bool AcceptPokerAsking(FString& OutReason);
	bool HagglePokerWage(FString& OutReason);
	bool SignPokerDeal(FString& OutReason);
	// Gemeinsamer Abschluss fuer Sofortkauf und Verhandlung (js/transfer-poker.js: finalizePlayerPurchase)
	bool FinalizePurchase(const FFM13Player& Kauf, int64 Ablose, int64 Gehalt, int32 TauschId, const FFM13MedBefund& Befund, const FString& Verkaeufer, FString& OutReason);
	int64 AgentFee(const FFM13Player& P, int64 Basis) const;          // getAgentFee()
	int32 AgentRelation(int32 AgentIndex) const;                       // game.agentRelationships
	bool ImproveAgentRelation(int32 AgentIndex, FString& OutReason);   // improveAgentRelationship()
	static FString AgentName(int32 AgentIndex);
	int32 AgentRelationLevelIndex(int32 AgentIndex) const;
	TArray<int32> AgentRelationKeys;                                   // Index je Eintrag von AgentRelationVals
	TArray<int32> AgentRelationVals;
	// Freie Spieler ohne Ablöse (js/transfermarket.js: freeAgentPlayers)
	struct FFM13FreeAgent
	{
		FFM13Player Player;
		int64 SignOnFee = 0;
	};
	TArray<FFM13FreeAgent> FreeAgents;
	struct FFM13FreeNegotiation
	{
		int32 PlayerId = 0;
		int64 CounterFee = 0;
	};
	FFM13FreeNegotiation FreeNegotiation;                              // offenes Gegenangebot
	void RefreshFreeAgents();
	bool SignFreeAgent(int32 Index, FString& OutReason);
	// Tauschgeschäft im Poker (js/transfer-poker.js: getSwapValue, isSwapCandidate)
	bool IsSwapCandidate(const FFM13Player& Tausch, const FFM13Player& Kauf, const FString& Verkaeufer) const;
	int64 SwapValue(const FFM13Player& Tausch, const FFM13Player& Kauf, const FString& Verkaeufer, int64 Ablose) const;
	bool SetPokerSwap(int32 PlayerId, FString& OutReason);
	// Medizincheck (js/medical-check.js): nach der Abloese-Einigung, kostet 3 % der Abloese
	bool RunMedicalCheck(FString& OutReason);
	FFM13MedBefund& EnsureMedical(FFM13MarketOffer& O);  // wuerfelt den Befund beim ersten Bedarf
	double PhysioAusfall() const;                        // getPhysioEffekt().ausfall, 1 ohne Physio
	void ApplyMedicalOnArrival(FFM13Player& P, const FFM13MedBefund& B);
	int32 MarketIndexOf(int32 PlayerId) const;
	bool TickPokerRival(int32 MarktIndex);            // true, wenn der Spieler zum Rivalen gegangen ist
	bool BuyPlayer(int32 MarketIndex, FString& OutReason);
	bool SellPlayer(int32 PlayerId, FString& OutReason, bool bChemieBestaetigt = false);   // sellPlayer(): 80 % Marktwert, Beraterprovision; bChemieBestaetigt = zweiter Klick bei eingespielter Elf
	void CheckInsolvencyRisk();                       // checkInsolvencyRisk() (js/finances.js): jeden Spieltag nach den Finanzen
	bool RenewContract(int32 PlayerId, int32 Years, FString& OutReason);
	struct FFM13ContractTalk { bool bActive = false; int32 PlayerId = 0; int32 Years = 1; double OfferFactor = 1.0; bool bGarantie = false; int32 Rounds = 0; };
	FFM13ContractTalk ContractTalk;                // game.contractTalk: offenes Verhandlungsgespraech
	bool StartContractTalk(int32 PlayerId, FString& OutReason);        // extendContract()
	bool SetContractTalkYears(int32 Years, FString& OutReason);        // setContractTalkYears()
	void ToggleContractTalkGuarantee();                                 // toggleContractTalkGuarantee()
	void CancelContractTalk();                                          // cancelContractTalk()
	bool CounterContractTalk(FString& OutReason);                       // counterContractTalk(): true = Spieler geht auf 10 % weniger ein
	bool SetReleaseClause(int32 PlayerId, int64 Amount, FString& OutReason);   // setReleaseClause(): mindestens 110 %% des Marktwerts
	bool RemoveReleaseClause(int32 PlayerId, FString& OutReason);                 // removeReleaseClause()
	void CheckReleaseClauseTriggers();                                           // checkReleaseClauseTriggers(): jeden Spieltag
	bool AcceptContractTalk(FString& OutReason);                        // acceptContractTalk()
	void CheckPlaytimePromises();                                       // checkPlaytimePromises(): Saisonende
	int32 RenewalWage(const FFM13Player& P) const;
	int64 RenewalSigningFee(const FFM13Player& P, int32 Years) const;   // Handgeld der Verlaengerung
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
	// Rueckkauf (js/buyback.js): Verkauf mit Option, Entwicklung beim neuen Verein, Ausuebung im Fenster
	TArray<FFM13BuybackOption> BuybackOptions;
	bool AcceptIncomingOfferWithBuyback(int32 Index, FString& OutReason);
	void TickBuybackOptions();                        // zum Saisonende, vor Season++
	// Transferstrategie mit dem Vorstand (js/transfer-strategy.js): eine Linie je Saison bis Spieltag 3
	struct FFM13TransferStrategy
	{
		int32 Season = 0;
		FM13Transfers::EStrategie Choice = FM13Transfers::EStrategie::Ausgewogen;
		bool bAuto = false;      // nicht gewaehlt: ausgewogen gesetzt
		int32 OldGoal = 0;
		int32 Goal = 0;          // 0 = kein Ziel (Sofort-Erfolg ohne Tabellenziel)
		int64 BudgetDelta = 0;
		int32 Result = 0;        // 0 offen, 1 erreicht, 2 verfehlt
	};
	FFM13TransferStrategy Strategy;
	bool bStrategySet = false;                        // fuer diese Saison gewaehlt oder automatisch gesetzt
	bool IsTransferStrategyOpen() const { return Matchday <= 3 && !bStrategySet; }
	bool ChooseTransferStrategy(FM13Transfers::EStrategie Choice, FString& OutReason);
	void TickTransferStrategy();                      // nach jedem Spieltag: nichts gewaehlt -> ausgewogen
	// Financial Fairplay (js/ffp.js): Verluste ueber drei Saisons, ohne Stadion, Gelaende, Jugend und Finanzierung
	struct FFM13FfpResult
	{
		int32 Season = 0;
		int64 Net = 0;
		int64 Kumulativ = 0;
		int64 Erlaubt = 0;
		int32 Ueberwacht = 0;
		bool bVerstoss = false;
	};
	TArray<int64> FfpHistory;        // Saisonergebnisse, hoechstens drei
	int32 FfpStrikes = 0;            // Verstoesse in Folge
	bool bFfpEmbargo = false;        // Transfersperre durch das Financial Fairplay
	bool bInsolvenzEmbargo = false;  // game.transferEmbargo: ab 6 Spieltagen im Minus, weg sobald das Konto im Plus ist
	int32 NegativeStreak = 0;        // game.negativeStreak: Spieltage in Folge im Minus
	int32 ForcedSalesCount = 0;      // game.forcedSalesCount: Zwangsverkaeufe
	struct FFM13Loan
	{
		int32 Id = 0;
		FString TierName;
		int64 Principal = 0;
		int64 Installment = 0;
		int32 MatchdaysLeft = 0;
		int64 TotalToRepay = 0;
	};
	TArray<FFM13Loan> ActiveLoans;                 // game.activeLoans: laufende Kredite mit Ratenzahlung (hoechstens 3)
	int32 NextLoanId = 1;
	int64 LoanDebt = 0;                            // game.loanDebt: Alt-Sofortkredit (Soforthilfe / Tilgen)
	int32 CreditRatingTenth = 700;                 // financeCentralState.creditRating mal 10, ganzzahlig damit das Speichern exakt bleibt
	struct FFM13Festgeld
	{
		int64 Principal = 0;
		int64 Payout = 0;
		int32 MatchdaysLeft = 0;
		int32 TotalMatchdays = 0;
	};
	FFM13Festgeld Festgeld;                        // game.financeCentralState.fixedDeposit
	bool bFestgeld = false;                        // true = eine Festgeldanlage laeuft
	struct FFM13MoneyPoint { int32 Matchday = 0; int32 Season = 0; int64 Money = 0; };
	TArray<FFM13MoneyPoint> MoneyHistory;          // financeCentralState.moneyHistory: letzte 20 Spieltage
	void TickMoneyHistory();                       // tickMoneyHistory()
	bool OpenFixedDeposit(int64 Amount, int32 Matchdays, FString& OutReason);   // openFixedDeposit()
	void TickFixedDeposit();                       // tickFixedDeposit(): jeden Spieltag
	bool TakeLoanTier(const FString& Key, int64 Amount, FString& OutReason);   // takeLoanTier()
	void TakeLoanLegacy(int64 Amount);             // takeLoan() (Soforthilfe)
	bool PayLoanLegacy(int64 Amount);              // payLoan() (Tilgen)
	void ProcessLoanInstallments();                // processLoanInstallments(): jeden Spieltag
	bool SpecialRepayLoan(int32 LoanId, FString& OutReason);   // specialRepayLoan(): vorzeitige Tilgung mit 15 % Rabatt
	void TickCreditRating();                       // tickCreditRating(): Bonitaet je Spieltag
	int32 PendingFfpDeduction = 0;   // Punktabzug fuer die neue Saison, nach dem Tabellen-Neustart
	bool bHasFfpResult = false;
	FFM13FfpResult FfpLastResult;
	static bool FfpExempt(const FString& Label);     // Stadion, Gelaende, Jugend: zaehlen nicht als Verlust
	int64 FfpSeasonNet() const;                      // Summe der nicht ausgenommenen Buchungen dieser Saison
	int64 FfpAllowedLossPerSeason() const;           // 20 % der Liga-Basis der TV-Gelder
	void EvaluateFinancialFairplay();                // Saisonende, vor Season++
	void ApplyPendingFfpPointDeduction();            // nach dem Tabellen-Neustart
	// Erfolgsbasierte Vertragsboni (js/bonusclauses.js)
	static int64 BonusMindest(const FFM13Player& P, int32 Typ);   // Mindestbetrag je Marktwert
	bool SetBonusClause(int32 PlayerId, int32 Typ, int32 Schwelle, int64 Betrag, FString& OutReason);
	bool RemoveBonusClause(int32 PlayerId, int32 Typ, FString& OutReason);
	void PayOutBonusClause(FFM13Player& P, int32 Typ);            // Konto, Beraterprovision, hoechstens einmal je Saison
	void CheckMatchdayBonusClauses(FFM13Player& P);               // nach jedem Spieltag: Tore und Einsaetze
	void TriggerPromotionBonusClauses();                          // bei vollzogenem Aufstieg
	void ResolveTransferStrategy(int32 FinalRank);    // Saisonende, vor der Vorstandsversammlung
	// Platzerwartung der Saison (js/member-assembly.js: seasonExpectation) und Vorstandsstimmung (js/board-room.js)
	struct FFM13Expectation
	{
		int32 Season = 0;
		int64 StartMoney = 0;
		int32 ExpectedRank = 0;
		int32 Teams = 0;
		int32 LeagueLevel = 0;
	};
	FFM13Expectation Expectation;
	int32 RelegatedIntoSeason = 0;            // nach einem Abstieg: Erwartung mindestens Platz 3
	void RecordSeasonExpectation();           // Saisonbeginn: Geld und Erwartung nach Kaderstaerke
	void RecordSeasonExpectationRank();
	const FFM13Expectation& GetSeasonExpectation();
	// Mitgliederversammlung (js/member-assembly.js)
	struct FFM13AssemblyReport
	{
		bool bValid = false;
		int32 Season = 0;
		int32 FinalRank = 0;
		int32 ExpectedRank = 0;
		int32 Teams = 0;
		int32 LeagueLevel = 0;
		int64 StartMoney = 0;
		int32 Fans = 0;
		int64 FinanceResult = 0;
		bool bPromoted = false;
		bool bRelegated = false;
	};
	struct FFM13MemberAssembly
	{
		bool bOpen = false;             // false: abgehalten
		FFM13AssemblyReport Report;
		int32 OpenedMatchday = 1;
		int32 Season = 0;
		int32 Speech = 2;               // 0 selbstkritisch, 1 visionaer, 2 zahlen
		int32 Fee = 1;                  // 0 senken, 1 halten, 2 erhoehen
		int32 HeldMatchday = 0;
		int32 Zustimmung = 0;
		bool bEntlastet = false;
		int32 BoardDelta = 0;
		int64 Money = 0;
		bool bAutomatisch = false;
	};
	FFM13AssemblyReport PendingAssemblyReport;
	FFM13MemberAssembly MemberAssembly;
	bool bHasMemberAssembly = false;
	void PrepareMemberAssembly(int32 FinalRank);     // vor dem Ligawechsel
	void OpenMemberAssembly();                       // nach Season++
	int32 AssemblyBaseApproval(const FFM13AssemblyReport& R) const;
	static int32 SpeechEffect(int32 Speech, const FFM13AssemblyReport& R);
	bool SetAssemblyChoice(bool bSpeech, int32 Value, FString& OutReason);
	bool HoldMemberAssembly(bool bAutomatisch, FString& OutReason);
	void TickMemberAssembly();                       // nach jedem Spieltag
	// Vorstand (js/board-room.js)
	struct FFM13BoardView
	{
		int32 Mood = 0;
		FString Reason;
	};
	void BoardViews(FFM13BoardView Out[4]) const;    // praesident, finanzen, sport, nachwuchs
	FString BoardName(int32 Rolle) const;
	TArray<FString> BoardWarned;                     // "Saison-Rolle", je Saison einmal
	void TickBoardRoom();                            // nach jedem Spieltag
	// Saisonwette (js/board-room.js): zwei Plaetze besser als der Vorstand
	struct FFM13SaisonWette
	{
		int32 Season = 0;
		int32 Platz = 0;
	};
	FFM13SaisonWette Wette;
	bool bHasWette = false;
	bool SetSaisonWette(FString& OutReason);
	void ResolveSaisonWette(int32 MyRank);
	// Wintergespraech mit dem Vorstand (js/winter-talk.js): Spieltag 18 bis 20, ein Weg je Saison
	enum class EWinterWeg : uint8 { Keiner, Hoch, Runter, Budget, Kurs, Verpasst };
	struct FFM13WinterTalk
	{
		int32 Season = 0;
		EWinterWeg Weg = EWinterWeg::Keiner;
		int32 OldGoal = 0;
		int32 Goal = 0;
		int32 RankAtTalk = 0;
		int64 Budget = 0;        // bewilligtes Winterbudget (0 = keins)
		int32 Result = 0;        // 0 offen, 1 erreicht, 2 verfehlt
	};
	FFM13WinterTalk WinterTalk;
	bool bHasWinterTalk = false;
	int64 WinterBudgetAmount() const;                 // 30 % des Liga-Transferbudgets, auf 1.000 gerundet
	double WinterBudgetChance() const;
	bool IsWinterTalkOpen() const;
	bool ChooseWinterTalk(EWinterWeg Weg, FString& OutReason);
	void TickWinterTalk();                            // nach jedem Spieltag: verpasst
	void ResolveWinterTalk(int32 FinalRank);          // Saisonende: hoch-Versprechen einloesen
	// Rohstoffboerse (js/commodities.js, Grunddaten aus js/state.js): Baumwolle, Wolle, Leder, Kunststoff
	struct FFM13Rohstoff
	{
		FString Name;
		int32 Lager = 0;        // kg
		double BasisPreis = 0;
		double Preis = 0;
		double MinPreis = 0;
		double MaxPreis = 0;
		double Delta = 0;
	};
	FFM13Rohstoff Rohstoffe[4];
	FString RohstoffEreignis = TEXT("Stabile Weltmaerkte zu Saisonbeginn.");
	void TickCommodityMarket();                       // jeden Spieltag, nach dem Spiel
	void ResetOekonomieGrunddaten();                  // Rohstoffe und Immobilien auf den Startstand
	// Holding und Industrie (js/industry.js, js/holding.js). Der Fanshop-Verkauf (js/merchandise.js) fehlt noch.
	struct FFM13Fabrik
	{
		FString Name;
		FString Produkt;
		int32 Rohstoff = 0;        // Index in Rohstoffe
		bool bBesitz = false;
		int32 Stufe = 1;
		int32 Max = 5;
		int64 Kosten = 0;
	};
	FFM13Fabrik Fabriken[4];       // Textil, Strickerei, Leder, Spritzguss
	int64 HoldingGeld = 50000;
	int32 Lagerstufe = 1;          // Zentrallager, Kapazitaet je Stufe 2.000 kg
	int64 LagerKapazitaet() const { return (int64)Lagerstufe * 2000; }
	int64 LagerBestand() const;
	struct FFM13B2BAuftrag
	{
		int32 Id = 0;
		int32 Fabrik = 0;
		FString Verein;
		FString Artikel;
		int32 Menge = 0;           // Stueck
		int32 Rohstoff = 0;
		int32 RohstoffMenge = 0;   // kg
		int64 Honorar = 0;
		bool bErledigt = false;
	};
	TArray<FFM13B2BAuftrag> B2BAuftraege;
	int32 NextB2BId = 1;
	struct FFM13Ware
	{
		FString Name;
		int32 Lager = 0;           // Stueck
		int32 Rohstoff = 0;
		double RohstoffMenge = 0;  // kg je Stueck
		int32 Fabrik = 0;
		int64 Kosten = 0;          // Einkaufspreis Grosshandel
		int64 Preis = 0;           // Verkaufspreis
		int64 OptimalPreis = 0;    // Marktoptimum
		double Beliebtheit = 1.0;
		int32 LetztVerkauft = 0;
		int64 LetztUmsatz = 0;
	};
	TArray<FFM13Ware> Waren;
	struct FFM13Produktion
	{
		int32 Ware = 0;
		int32 Menge = 0;
		int32 TageRest = 0;
		int32 Dauer = 0;
	};
	TArray<FFM13Produktion> Produktionen;
	struct FFM13Firma
	{
		FString Name;
		int32 Staerke = 60;
		FString LetzteAktion;
	};
	TArray<FFM13Firma> Konkurrenten;
	struct FFM13Uebernahme
	{
		FString Firma;
		int64 Angebot = 0;
		int32 GueltigBis = 0;
	};
	TArray<FFM13Uebernahme> Uebernahmen;
	int32 RohstoffEreignisBias = 0;   // +1 Knappheit, -1 Ueberangebot, 0 sonst (Preisrichtung nach dem Ereignis)
	int64 HoldingWert() const;        // getHoldingValuation()
	// Fanshop (js/merchandise.js). Stände, Megastore, Marketing-Direktor, Ausrüster und Booster fehlen im Kern.
	struct FFM13MerchEintrag
	{
		int32 Season = 0;
		int32 Matchday = 0;
		int32 Zuschauer = 0;
		int64 Umsatz = 0;
		struct FArtikel { FString Name; int32 Verkauft = 0; int64 Umsatz = 0; int32 Verpasst = 0; };
		TArray<FArtikel> Artikel;
	};
	TArray<FFM13MerchEintrag> MerchVerlauf;      // hoechstens 34 Spieltage
	TArray<int32> HeimZuschauer;                 // letzte acht Heimspiele
	int32 AverageHeimZuschauer() const;
	static double ElastizitaetFaktor(int64 Preis, int64 Optimal);
	int64 SimulateMerchSales(bool bHome, bool bWin, int32 Zuschauer);   // simulateMerchSales(): Erloes des Spieltags
	bool BestelleWare(int32 Ware, int32 Menge, FString& OutReason);     // orderMerchBatch()
	bool SetzeWarenPreis(int32 Ware, int64 Preis);                    // setMerchPrice()
	struct FFM13LimitedEdition
	{
		bool bAktiv = false;
		FString Name;
		int32 Lager = 0;
		int32 Start = 0;
		int64 Preis = 0;
		int32 Verkauft = 0;
		int64 Umsatz = 0;
	};
	FFM13LimitedEdition LimitedEdition;
	bool StarteLimitedEdition(const FString& Name, int32 Stueck, int64 Preis, FString& OutReason);
	void TickLimitedEdition();
	struct FFM13Saisonkollektion
	{
		bool bAktiv = false;
		int32 Schub = 0;            // Prozent
		int32 AblaeuftBei = 0;       // Spieltag
	};
	FFM13Saisonkollektion Saisonkollektion;
	void StarteSaisonkollektion(int32 SchubProzent, int32 Spieltage);
	void TickSaisonkollektion();
	bool KaufeFabrik(int32 Index, FString& OutReason);
	bool AusbaueFabrik(int32 Index, FString& OutReason);
	bool FusioniereFabrik(int32 Index, FString& OutReason);
	int32 ProduktionsDauer(int32 Fabrik) const;
	bool StarteProduktion(int32 Ware, int32 Menge, FString& OutReason);
	void TickProduktion();                             // jeden Spieltag: Countdown, Lager wird aufgefuellt
	bool KaufeRohstoff(int32 Rohstoff, int32 Menge, FString& OutReason);
	bool AusbaueLager(FString& OutReason);
	void TickRohstoffPreise();                         // jeden Spieltag, vor der Rohstoffboerse
	void TickKonkurrenten();                           // jeden Spieltag
	void TickUebernahmeAblauf();
	bool AntworteUebernahme(bool bAnnehmen, FString& OutReason);
	bool ErfuelleB2B(int32 AuftragId, FString& OutReason);
	void ErneuereB2BAuftraege();                       // Saisonstart: je eigener Fabrik ein Auftrag
	bool UeberweisungZurHolding(int64 Betrag, FString& OutReason);
	bool UeberweisungVonHolding(int64 Betrag, FString& OutReason);
	// Immobilien-Portfolio (js/real-estate.js): sechs Objekte, je bis Stufe drei, Miete je Spieltag
	struct FFM13Immobilie
	{
		FString Name;
		bool bBesitz = false;
		int32 Stufe = 0;
		int32 Max = 3;
		int64 BasisKosten = 0;
		int64 BasisMiete = 0;
	};
	FFM13Immobilie Immobilien[6];
	// Baustellen der Immobilien (Teil der Baustellen-Warteschlange in js/stadium.js): voll bezahlt beim Auftrag
	struct FFM13Immobilienbau
	{
		int32 Objekt = 0;
		int32 TageRest = 0;
		int64 Summe = 0;
		FString Label;
	};
	TArray<FFM13Immobilienbau> ImmobilienBauten;
	int64 ImmobilienKosten(int32 Objekt) const;       // getRealEstateCost()
	int64 ImmobilienMiete(int32 Objekt) const;        // getRealEstateIncome(), Hotel mit Medienfaktor 50
	bool KaufeOderAusbaueImmobilie(int32 Objekt, FString& OutReason);
	bool VerkaufeImmobilie(int32 Objekt, FString& OutReason);
	void TickImmobilien();                            // jeden Spieltag: Mieten, Bauzeit
	// Gerueuchtekueche (js/rumors.js): hoechstens drei offene Geruechte, jede Quelle mit echter Trefferquote
	struct FFM13Rumor
	{
		FString Id;
		FM13Transfers::EQuelle Source = FM13Transfers::EQuelle::Boulevard;
		bool bTruth = false;
		FString Club;
		FString Type;            // abwerbung (Verein will deinen Spieler) oder markt (Marktspieler wechselt)
		int32 PlayerId = 0;
		FString PlayerName;
		int32 Created = 0;
		int32 Season = 0;
		int32 ResolveAt = 0;
		FString Reaction;        // leer, dementieren, anheizen, schweigen
		bool bBackedOff = false;
		FString Outcome;         // leer (offen), ente, wahr, zurueckgezogen, erledigt
	};
	TArray<FFM13Rumor> Rumors;      // neueste zuerst
	int32 RumorHits[3] = { 0, 0, 0 };
	int32 RumorMisses[3] = { 0, 0, 0 };
	int32 RumorNr = 0;
	int32 InterestThreshold() const;        // getTransferInterestThreshold(): Kaderschnitt, mind. 20
	int32 ClubLevelByName(const FString& Name) const;   // Liga-Stufe eines Vereins, -1 wenn nicht vorhanden
	FString RandomOpposingClub(bool bPreferHigherOrEqual);  // pickRandomOpposingClubName()
	bool TriggerAIOffer(int32 PlayerId, const FString& Club, double Multiplier);   // triggerNewAITransferOffer(gezielt)
	bool CreateRumor(FFM13Rumor& Out);
	void TickRumors();                      // nach jedem Spieltag
	void ResolveRumor(FFM13Rumor& R);
	// Vorvertraege (js/pre-contracts.js): ablösefrei zur neuen Saison, ab Spieltag 18
	struct FFM13PreContractCandidate
	{
		FFM13Player Player;
		FString SellerClub;
		bool bRefused = false;
	};
	struct FFM13PreContractDeal
	{
		FFM13Player Player;     // Gehalt steht schon fest
		FString From;           // bisheriger Verein
		int32 Season = 0;
	};
	TArray<FFM13PreContractCandidate> PreContractPool;
	int32 PreContractPoolSeason = 0;
	TArray<FFM13PreContractDeal> PreContracts;         // offene Vorvertraege, hoechstens drei
	TArray<FString> PreContractClubs() const;          // eigene Liga und die darueber, ohne uns
	void EnsurePreContractPool();
	bool OfferPreContract(int32 CandidateId, bool bDoppelt, FString& OutReason);
	void TickPreContracts();                           // nach jedem Spieltag
	void JoinPreContractPlayers();                     // zum Saisonwechsel, vor Season++
	bool ReactToRumor(const FString& Id, const FString& Art, FString& OutReason);
	int32 CountYouthGraduates() const;                // Eigengewaechse mit 10 oder mehr Ligaspielen
	int64 SeasonProfit() const;                       // Summe der Buchungen dieser Saison
	bool ExerciseBuyback(int32 PlayerId, FString& OutReason);
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
	void PlayCupRound(FFM13Cup& Cup, bool bDfb);
	void RollInjuries(FFM13OwnMatchReport& Report);
	void FinishOwnReport(FFM13OwnMatchReport& Report, const FString& OppName, bool bHome, const TArray<FString>& Yellow, const TArray<FString>& Red);
};
