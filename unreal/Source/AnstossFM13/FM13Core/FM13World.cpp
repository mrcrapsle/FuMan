#include "FM13World.h"
#include "FM13Transfers.h"
#include "FM13Economy.h"
#include "FM13Match.h"
#include "FM13Names.h"
#include "FM13Tactics.h"
#include "FM13Development.h"
#include "FM13Fitness.h"
#include "FM13Staff.h"
#include "FM13Locker.h"
#include "FM13Youth.h"
#include "FM13Poker.h"
#include <cmath>
#include "FM13Strength.h"

namespace
{
	// Start je Liga: Kontostand und Stadiongröße (das Browserspiel startet immer in der 6. Liga mit 150.000 €)
	const int64 StartMoney[FM13::NumLeagues] = { 30000000, 6000000, 1500000, 600000, 250000, 150000 };

	// Sponsor-Faktor je Liga (SPONSOR_LEAGUE_FACTOR in js/sponsors.js)
	const float SponsorLeagueFactor[FM13::NumLeagues] = { 74.f, 20.f, 6.5f, 3.2f, 1.0f, 0.75f };

	// Beste Elf: je Position die Stärksten; fehlt ein Spieler, rückt der beste Rest mit -10 auf die Position.
	// Gibt Indizes in Squad zurück, OutStrength ist der Schnitt der Elf.
	// Beste Elf in der gewählten Formation: je Position die Stärksten (Verletzte und Gesperrte fehlen)
	// pickBestLineupIds() aus js/squad.js: je Position die Stärksten nach Stärke x Kondition. Erschöpfte Feldspieler
	// (unter 50 % Kondition) bekommen ihren Platz nicht fest, den Rest füllen die Stärksten auf (Torhüter zuletzt).
	// OutStrength ist der Schnitt der reinen Stärke der Elf (getOwnMatchExpectation).
	TArray<int32> BestEleven(const TArray<FFM13Player>& Squad, const FString& Formation, int32& OutStrength)
	{
		const int32* Slots = FM13Tactics::Formation(Formation).Slots;
		auto Eff = [&Squad](int32 i) { return Squad[i].Strength * (Squad[i].Fitness / 100.0); };
		TArray<int32> Idx;
		for (int32 i = 0; i < Squad.Num(); ++i) if (Squad[i].IsAvailable()) Idx.Add(i);
		// stabile Reihenfolge wie Array.sort(): bei Gleichstand entscheidet der Platz im Kader
		Idx.Sort([&Eff](int32 A, int32 B) { const double EA = Eff(A), EB = Eff(B); return EA != EB ? EA > EB : A < B; });

		TArray<int32> Elf;
		for (int32 i : Idx) if (Squad[i].Pos == EFM13Position::TW) { Elf.Add(i); break; }
		for (int32 Pos = 1; Pos < 4; ++Pos)
		{
			int32 Gefunden = 0;
			for (int32 i : Idx)
			{
				if (Gefunden >= Slots[Pos]) break;
				if ((int32)Squad[i].Pos != Pos || Squad[i].Fitness < 50) continue;
				Elf.Add(i);
				++Gefunden;
			}
		}
		for (int32 Durchgang = 0; Durchgang < 2; ++Durchgang) // erst Feldspieler, dann Torhüter
			for (int32 i : Idx)
			{
				if (Elf.Num() >= 11) break;
				if (Elf.Contains(i) || (Squad[i].Pos == EFM13Position::TW) != (Durchgang == 1)) continue;
				Elf.Add(i);
			}
		int64 Summe = 0;
		for (int32 i : Elf) Summe += Squad[i].Strength;
		OutStrength = Elf.Num() > 0 ? FMath::RoundToInt((float)Summe / (float)Elf.Num()) : 0;
		return Elf;
	}

}

// ---------- Neues Spiel ----------

void FFM13World::NewGame(const FString& InClubName, int32 Seed, int32 StartLevel)
{
	*this = FFM13World();
	Rng.Initialize(Seed);
	RngKabine.Initialize(Seed * 7919 + 13);
	RngJugend.Initialize(Seed * 104729 + 29);
	RngTransfer.Initialize(Seed * 31337 + 7);
	RngIndustrie.Initialize(Seed * 15485863 + 11);
	TransferBudget = LeagueTransferBudget(StartLevel);
	ResetOekonomieGrunddaten();
	ClubName = InClubName.IsEmpty() ? FString(TEXT("1.FC Moritz Leipzig")) : InClubName;
	LeagueLevel = FMath::Clamp(StartLevel, 0, FM13::NumLeagues - 1);
	Money = StartMoney[LeagueLevel];
	ResetStadiumBlocks();
	UsedClubNames.Add(ClubName);
	WeeklyPlan = FM13Fitness::Startplan();
	InitLeagues(LeagueLevel);

	// Startkader: 2 TW, 6 ABW, 6 MIT, 4 ST auf dem Niveau der Liga
	const int32 Basis = FM13::LeagueBaseStrength(LeagueLevel);
	const int32 Anzahl[4] = { 2, 6, 6, 4 };
	for (int32 Pos = 0; Pos < 4; ++Pos)
		for (int32 n = 0; n < Anzahl[Pos]; ++n)
			Squad.Add(CreatePlayer((EFM13Position)Pos, Basis - 3, Basis + 4, 18, 32));

	// Startsponsor wie im Browserspiel (Stadtwerke & Regionalbank), auf die Liga hochgerechnet
	const float Faktor = SponsorLeagueFactor[LeagueLevel] / SponsorLeagueFactor[FM13::NumLeagues - 1];
	Sponsor.Name = TEXT("Stadtwerke & Regionalbank");
	Sponsor.Base = (int32)(FMath::RoundToInt(3000.f * Faktor / 100.f) * 100);
	Sponsor.WinBonus = (int32)(FMath::RoundToInt(1500.f * Faktor / 100.f) * 100);
	Sponsor.PromotionBonus = (int32)(FMath::RoundToInt(20000.f * Faktor / 500.f) * 500);
	Sponsor.MatchdaysLeft = FM13::MatchdaysPerSeason;
	Sponsor.Tier = TEXT("mittel");
	InitCups();
	PlanSeason();
	PickRival();
	RefreshMarket();
	PrepareOppPlan();
	AddMessage(TEXT("Willkommen"), FString::Printf(TEXT("Der Vorstand begruesst dich als neuen Trainer von %s in der %s."), *ClubName, FM13::LeagueName(LeagueLevel)));
}

FFM13Player FFM13World::CreatePlayer(EFM13Position Pos, int32 MinStr, int32 MaxStr, int32 MinAge, int32 MaxAge)
{
	FFM13Player P;
	P.Id = NextPlayerId++;
	P.Name = FM13Names::PlayerName(Rng);
	P.Pos = Pos;
	P.Strength = FMath::Clamp(Rng.RandRange(MinStr, MaxStr), 1, 99);
	P.Age = Rng.RandRange(MinAge, MaxAge);
	// Junge Spieler haben Luft nach oben, ältere sind am Ende ihrer Entwicklung
	P.Potential = FMath::Min(99, P.Strength + (P.Age <= 23 ? Rng.RandRange(3, 12) : Rng.RandRange(0, 2)));
	P.MarketValue = FM13Economy::MarketValue(P.Strength, &Rng);
	P.Wage = FM13Economy::Wage(P.MarketValue, P.Strength);
	P.ContractYears = Rng.RandRange(1, 3);
	P.Archetype = FM13Dev::ArchetypeFor(P.Id);
	P.Character = (uint8)Rng.RandRange(0, 5);
	P.Morale = 80;
	P.Trait = Rng.FRand() < 0.35f ? (uint8)(1 + Rng.RandRange(0, 7)) : 0; // js/entities.js: 35 % haben einen Trait
	P.Nation = FM13Locker::NationFromRoll(RngKabine.RandRange(0, 9));
	P.DailyForm = 50 + Rng.RandRange(-10, 9); // Startwert wie js/entities.js
	// Berater ab Staerke 62 (js/entities.js), aus der Kennung abgeleitet: der Hauptzufall bleibt gleich
	if (P.Strength >= 62 && FM13Transfers::HashEinheit(P.Id, 1) < 0.3 + (double)FMath::Max(0, P.Strength - 62) * 0.01)
	{
		P.bHasAgent = true;
		P.AgentIndex = (uint8)FMath::Clamp((int32)(FM13Transfers::HashEinheit(P.Id, 2) * 8.0), 0, 7);
		P.AgentFeePct = 0.03 + FM13Transfers::HashEinheit(P.Id, 3) * 0.05;
	}
	return P;
}

void FFM13World::InitLeagues(int32 StartLevel)
{
	Leagues.Reset();
	for (int32 L = 0; L < FM13::NumLeagues; ++L)
	{
		FFM13League Liga;
		Liga.Level = L;
		for (int32 T = 0; T < FM13::TeamsPerLeague; ++T)
		{
			FFM13Club C;
			if (L == StartLevel && T == 0)
			{
				C.Name = ClubName;
				C.bOwn = true;
				C.Playstyle = (EFM13Playstyle)Rng.RandRange(0, 3); // auch der eigene Verein hat einen (js/leagues.js)
				C.Strength = FM13::LeagueBaseStrength(L);
			}
			else
			{
				C.Name = FM13Names::ClubName(Rng, UsedClubNames);
				C.Strength = FM13::LeagueBaseStrength(L) + Rng.RandRange(0, 5);
				C.Playstyle = (EFM13Playstyle)Rng.RandRange(0, 3);
			}
			Liga.Clubs.Add(C);
		}
		Liga.BuildSchedule(Rng);
		Leagues.Add(Liga);
	}
}

// ---------- Spieltag ----------

bool FFM13World::PlayMatchday()
{
	if (bSacked || IsSeasonFinished() || Leagues.Num() != FM13::NumLeagues) return false;
	LastReport = FFM13OwnMatchReport();
	LastCupReport = FFM13OwnMatchReport();
	EnsureCaptain();
	WeatherIndex = FM13Match::RollWeather(Rng);

	if (DfbPokal.NextMatchday() == Matchday) PlayCupRound(DfbPokal, true);
	if (Europe.bActive) PlayEuropeMatchday();
	if (Landespokal.NextMatchday() == Matchday) PlayCupRound(Landespokal, false);

	for (FFM13League& L : Leagues)
	{
		for (FFM13Fixture& F : L.Fixtures)
		{
			if (F.Matchday != Matchday || F.bPlayed) continue;
			const FFM13Club& H = L.Clubs[F.Home];
			const FFM13Club& A = L.Clubs[F.Away];
			if (H.bOwn || A.bOwn) { PlayOwnFixture(L, F); continue; }
			const FM13Match::FExpectedGoals Xg = FM13Match::ExpectedGoals(H.Strength + FM13::AiHomeAdvantage, A.Strength, H.Playstyle, A.Playstyle);
			const int32 HG = FM13Match::Poisson(Rng, Xg.Home);
			const int32 AG = FM13Match::Poisson(Rng, Xg.Away);
			L.ApplyResult(F, HG, AG);
			CreditAiLeagueGoals(L.Clubs[F.Home], HG);
			CreditAiLeagueGoals(L.Clubs[F.Away], AG);
		}
	}

	for (FFM13Player& P : Squad) CheckMatchdayBonusClauses(P);

	// TV-Geld in Raten nach dem laufenden Tabellenplatz (applyMatchdayFinances im Browserspiel)
	const int64 Rate = FM13Economy::TvMoney(LeagueLevel, OwnRank()) / FM13::MatchdaysPerSeason;
	if (Rate > 0)
	{
		Book(TEXT("TV-Geld (Rate)"), Rate);
		TvPaidThisSeason += Rate;
		LastReport.Income += Rate;
	}

	// Stadionausbau läuft über mehrere Spieltage
	if (PendingSeatsMatchdays > 0 && --PendingSeatsMatchdays == 0)
	{
		for (FFM13StadiumBlock& B : StadiumBlocks) if (B.Key == TEXT("gegen")) B.Cap += PendingSeats;   // Zwischenstand bis zum Baustellen-Port: Zusatzplaetze im Ostblock
		AddMessage(TEXT("Stadionausbau fertig"), FString::Printf(TEXT("%d neue Plaetze, das Stadion fasst jetzt %d Zuschauer."), PendingSeats, StadiumTotal()));
		PendingSeats = 0;
	}

	TrainPlayers();
	// Verletzte erholen sich: wer heute verletzt wurde, fällt ab dem nächsten Spieltag aus
	for (FFM13Player& P : Squad)
	{
		if (P.InjuredMatchdays > 0) P.InjuredMatchdays--;
		if (P.SuspendedMatchdays > 0) P.SuspendedMatchdays--;
	}
	TickIncomingOffers();
	TickTransferWindows();
	TickAiTransfers();
	TickIncomingLoans();
	if (Matchday % 4 == 0) RefreshMarket();
	TickBoardRoom();
	TickWinterTalk();
	TickMemberAssembly();
	TickRohstoffPreise();
	TickKonkurrenten();
	TickUebernahmeAblauf();
	TickProduktion();
	TickLimitedEdition();
	TickSaisonkollektion();
	TickCommodityMarket();
	TickImmobilien();
	TickFriendships();
	TickYouthPathway();
	if (Matchday % 4 == 0) { TickYouthDevelopment(); TickYouthBreakthroughs(); TickTeamCouncil(); TickLockerRoom(); }
	++Matchday;
	TickTransferStrategy();
	TickRumors();
	TickPreContracts();
	CheckJobSecurity();
	CheckAchievements(false, OwnRank(), EFM13SeasonOutcome::Stayed);
	PrepareOppPlan();
	return true;
}

void FFM13World::PlayOwnFixture(FFM13League& L, FFM13Fixture& F)
{
	const bool bHome = L.Clubs[F.Home].bOwn;
	const FFM13Club& Opp = bHome ? L.Clubs[F.Away] : L.Clubs[F.Home];
	const int32 Elf = OwnStrength();
	const double OwnExact = OwnMatchStrengthExact(OppPlanArchetype, bHome);
	const int32 Own = FMath::RoundToInt((float)OwnExact);
	const EFM13Playstyle EigenStil = (bHome ? L.Clubs[F.Home] : L.Clubs[F.Away]).Playstyle;
	const int32 OppStr = Opp.Strength + (bHome ? 0 : FM13::AiHomeAdvantage); // getOpponentMatchStrength()
	const FString OppName = Opp.Name;
	const FM13Match::FWeather& Wetter = FM13Match::Weathers()[WeatherIndex];

	FM13Match::FExpectedGoals Xg = bHome
		? FM13Match::ExpectedGoals(OwnExact, OppStr, EigenStil, Opp.Playstyle)
		: FM13Match::ExpectedGoals(OppStr, OwnExact, Opp.Playstyle, EigenStil);
	Xg.Home *= (float)Wetter.GoalMult;
	Xg.Away *= (float)Wetter.GoalMult;
	const int32 HG = FM13Match::Poisson(Rng, Xg.Home);
	const int32 AG = FM13Match::Poisson(Rng, Xg.Away);
	L.ApplyResult(F, HG, AG);

	const int32 OwnGoals = bHome ? HG : AG;
	const int32 OppGoals = bHome ? AG : HG;
	OwnSeasonGoals.Add(OwnGoals);
	OwnSeasonGoals.Add(OppGoals);

	int32 Dummy = 0;
	for (int32 i : LineupIndices(Dummy)) { Squad[i].Appearances++; Squad[i].AppearancesTotal++; }
	PickScorers(OwnGoals, LastReport.Scorers);
	ApplyGrades(OwnGoals, OppGoals);
	CheckYouthMilestones(LineupIndices(Dummy));
	ApplyFitnessAfterMatchday(bHome);
	TickPairChemistry();
	TickStaff();

	// Vorstand: Erwartung aus der Elf ohne Taktik (wie getOwnMatchExpectation)
	const int32 Shift = FM13Match::BoardShift(FM13Match::Expectation(Elf, Opp.Strength), OwnGoals, OppGoals);
	BoardSat = FMath::Clamp(BoardSat + Shift, 10, 100);
	if (OwnGoals > OppGoals) Fans = FMath::Min(100, Fans + 1);
	else if (OwnGoals < OppGoals) Fans = FMath::Max(0, Fans - 1);

	const int32 Att = bHome ? FMath::Min(StadiumTotal(), FMath::RoundToInt((float)FM13Economy::Attendance(StadiumTotal(), Fans, LeagueLevel, OwnRank(), TicketAverage()) * (float)Wetter.AttendanceMult)) : 0;
	ApplyMatchdayFinances(bHome, OwnGoals > OppGoals, Att);
	CheckReleaseClauseTriggers();
	CheckSellOnClausePayouts();
	TickStadiumConstruction();
	TickDfbNachfrist();
	TickFixedDeposit();
	TickMoneyHistory();
	TickCreditRating();          // wie js/match-live.js: Festgeld und Bonitaet je Spieltag
	ProcessLoanInstallments();   // Kreditraten, dann die Insolvenzpruefung (gleiche Reihenfolge wie im Browserspiel)
	CheckInsolvencyRisk();
	TickSponsor();

	RecentStyles.Add(TacticStyle);
	if (RecentStyles.Num() > 6) RecentStyles.RemoveAt(0);
	UpdateRecords(OwnGoals, OppGoals, OppName, Att);

	LastReport.Competition = TEXT("Liga");
	LastReport.OwnGoals = OwnGoals;
	LastReport.OppGoals = OppGoals;
	LastReport.OwnStrength = Own;
	LastReport.OppStrength = OppStr;
	LastReport.Attendance = Att;
	LastReport.BoardShift = Shift;
	LastReport.Weather = Wetter.Name;
	LastReport.Referee = RefereeName();
	LastReport.OppArchetype = FM13Tactics::ArchetypeLabel(OppPlanArchetype);
	LastReport.TacticBonus = FM13Tactics::MatchupBonus(TacticStyle, OppPlanArchetype);
	LastReport.PrepBonus = MatchPrepBonus();
	LastReport.bDerby = OppName == RivalName;
	if (!PendingTalk.IsEmpty())
	{
		LastReport.Talk = PendingTalk;
		LastReport.TalkBonus = TalkBonus(PendingTalk);
		TalkHistory.Add(PendingTalk);
		if (TalkHistory.Num() > 5) TalkHistory.RemoveAt(0);
	}
	if (LastReport.bDerby && DerbyPrepMatchday == Matchday)
		LastReport.DerbyBonus = (DerbyPreps.Contains(TEXT("stimmung")) ? 1.5f : 0.f) + (DerbyPreps.Contains(TEXT("kampfansage")) ? 1.f : 0.f);
	ResolveMatchMood(OwnGoals, OppGoals, LastReport);
	PendingTalk = FString();
	TArray<FString> Gelb, Rot;
	RollCards(LastReport, Gelb, Rot);
	FinishOwnReport(LastReport, OppName, bHome, Gelb, Rot);
	RollInjuries(LastReport);
}

void FFM13World::FinishOwnReport(FFM13OwnMatchReport& Report, const FString& OppName, bool bHome, const TArray<FString>& Yellow, const TArray<FString>& Red)
{
	Report.bPlayed = true;
	Report.bHome = bHome;
	Report.Opponent = OppName;
	TArray<FString> Elf;
	for (int32 Id : StartingEleven()) if (const FFM13Player* P = FindPlayer(Id)) Elf.Add(P->Name);
	Report.Ticker = FM13Match::BuildTicker(Rng, ClubName, OppName, bHome, Report.Scorers, Report.OppGoals, Elf, Yellow, Red, Report.Weather, Report.Referee);
	if (Report.bPenalties)
		Report.Ticker.Add(Report.bAdvanced ? TEXT("Elfmeterschiessen gewonnen!") : TEXT("Im Elfmeterschiessen ausgeschieden."));
}

// Grundrisiko des Verletzungswurfs: Teamtraining, Wetter, Zweikampfhärte, Wochenplan und Intensität.
// Stadion-Anlagen, Rasenzustand, Premium-Booster und Trainingslager gibt es in Unreal noch nicht (neutral).
double FFM13World::InjuryChance() const
{
	FM13Fitness::FVerletzung E;
	E.Teamtraining = TeamTraining;
	E.Wetter = FM13Match::Weathers()[WeatherIndex].InjuryMult;
	E.Haerte = TackleHardness;
	E.WochenRisiko = FM13Fitness::Woche(WeeklyPlan.Num() == 7 ? WeeklyPlan : FM13Fitness::Startplan()).Risk;
	E.Intensitaet = TrainingIntensity;
	return FM13Fitness::VerletzungTeam(E);
}

// Verletzungswurf wie in processPostMatchRoutine(): einmal je Spieltag für die Startelf.
// Wer schon oft verletzt war oder älter ist, fällt eher aus; Reha-Klinik und Physio verkürzen die Pause.
void FFM13World::RollInjuries(FFM13OwnMatchReport& Report)
{
	const double Team = InjuryChance();
	const double Wetter = FM13Match::Weathers()[WeatherIndex].InjuryMult;
	for (int32 Id : StartingEleven())
	{
		FFM13Player* P = FindPlayer(Id);
		if (!P) continue;
		const double Chance = FM13Fitness::VerletzungSpieler(Team, P->TimesInjured, P->Age, P->Trait == FM13Strength::Wetterfest, Wetter, P->bChronic);
		if (Rng.RandRange(0, 999999) / 1000000.0 >= Chance) continue;
		const int32 Dauer = FM13Fitness::VerletzungDauer(Rng.RandRange(1, 4), CampusReha, Physio.bHired);
		P->InjuredMatchdays = Dauer + 1; // +1: der Abbau am Ende dieses Spieltags zählt nicht als Ausfall
		P->TimesInjured++;
		Report.Injuries.Add(FString::Printf(TEXT("%s (%d Spiele)"), *P->Name, Dauer));
		AddMessage(FString::Printf(TEXT("%s verletzt"), *P->Name), FString::Printf(TEXT("Faellt fuer %d Spiel(e) aus. (%d. Verletzung in dieser Karriere)%s"), Dauer, P->TimesInjured,
			P->TimesInjured >= 3 ? TEXT(" Wird zunehmend verletzungsanfaellig!") : TEXT("")));
	}
}

bool FFM13World::SetWeeklyTrainingDay(int32 Day, const FString& Unit, FString& OutReason)
{
	if (Day < 0 || Day > 6) { OutReason = TEXT("Unbekannter Tag."); return false; }
	bool bBekannt = false;
	for (const FM13Fitness::FEinheit& E : FM13Fitness::Einheiten()) if (Unit == E.Key) bBekannt = true;
	if (!bBekannt) { OutReason = TEXT("Unbekannte Trainingseinheit."); return false; }
	while (WeeklyPlan.Num() < 7) WeeklyPlan.Add(TEXT("ausgeglichen"));
	WeeklyPlan[Day] = Unit;
	TeamTraining = FM13Fitness::Woche(WeeklyPlan).TeamTraining;
	return true;
}

bool FFM13World::ApplyWeeklyTrainingPreset(const FString& Name, FString& OutReason)
{
	static const TCHAR* Namen[5] = { TEXT("ausgeglichen"), TEXT("kondition"), TEXT("technik"), TEXT("taktik"), TEXT("regeneration") };
	bool bBekannt = false;
	for (const TCHAR* N : Namen) if (Name == N) bBekannt = true;
	if (!bBekannt) { OutReason = TEXT("Unbekannter Standardplan."); return false; }
	WeeklyPlan = FM13Fitness::Standardplan(Name);
	TeamTraining = FM13Fitness::Woche(WeeklyPlan).TeamTraining;
	return true;
}

bool FFM13World::SetTrainingIntensity(const FString& Level, FString& OutReason)
{
	if (Level != TEXT("locker") && Level != TEXT("normal") && Level != TEXT("hart")) { OutReason = TEXT("Unbekannte Intensitaet."); return false; }
	TrainingIntensity = Level;
	return true;
}

// LEAGUE_OPERATING_COST (js/finances.js): Betriebskosten je Saison, je Liga
namespace
{
	int64 BetriebskostenJeSaison(int32 Liga)
	{
		static const int64 Kosten[6] = { 40000000, 5000000, 500000, 0, 0, 0 };
		return Kosten[FMath::Clamp(Liga, 0, 5)];
	}
}

void FFM13World::ApplyMatchdayFinances(bool bHome, bool bWin, int32 Att)
{
	auto Buche = [this](const TCHAR* Label, int64 Betrag)
	{
		if (Betrag == 0) return;
		Book(Label, Betrag);
		if (Betrag > 0) LastReport.Income += Betrag; else LastReport.Expenses -= Betrag;
	};
	// Brutto wie grossIncome in js/match-live.js: Tickets, Fanshop, Sponsor und die TV-Rate dieses Spieltags
	const int64 Tickets = bHome ? TicketRevenue(Att) : 0;
	const int64 Fanshop = SimulateMerchSales(bHome && Att > 0, bWin, Att);
	const int64 SponsorBrutto = Sponsor.Base + (bWin ? Sponsor.WinBonus : 0);
	const int64 TvRate = FM13Economy::TvMoney(LeagueLevel, OwnRank()) / FM13::MatchdaysPerSeason;
	const int64 Brutto = Tickets + Fanshop + SponsorBrutto + TvRate;
	const int64 Steuer = FM13Transfers::JsRunden((double)FMath::Max<int64>(0, Brutto) * 0.12);   // getTaxRate(): 12 Prozent ohne Steuerberater
	const int64 Betrieb = FM13Transfers::JsRunden((double)BetriebskostenJeSaison(LeagueLevel) / (double)FM13::MatchdaysPerSeason);
	int64 Reise = 0;
	if (!bHome)
	{
		// Auswaertsfahrt: (800 + (6 - Liga) x 300), Bus spart 45 Prozent; Reisefaktor nach Entfernung folgt mit der Geografie
		Reise = FM13Transfers::JsRunden((800.0 + (double)(6 - FMath::Clamp(LeagueLevel, 0, 5)) * 300.0) * (bBusTravel ? 0.55 : 1.0));
	}
	const int64 Personal = StaffWagesTotal();
	if (bHome) Buche(TEXT("Ticketeinnahmen"), Tickets);
	if (bHome && Att > 0) { HeimZuschauer.Add(Att); while (HeimZuschauer.Num() > 8) HeimZuschauer.RemoveAt(0); }
	Buche(TEXT("Fanshop-Erloes"), Fanshop);
	Buche(TEXT("Sponsor Grundbetrag"), Sponsor.Base);
	if (bWin) Buche(TEXT("Sponsor Siegpraemie"), Sponsor.WinBonus);
	Buche(TEXT("Gehaelter"), -WagesPerMatchday());
	Buche(TEXT("Personalgehaelter"), -Personal);
	Buche(TEXT("Steuern und Abgaben"), -Steuer);
	Buche(TEXT("Betriebskosten"), -Betrieb);
	if (Reise > 0) Buche(TEXT("Reisekosten"), -Reise);
	Buche(TEXT("Stadion-Unterhalt"), -(int64)(StadiumTotal() / 8));
	Buche(TEXT("Jugendakademie"), -(int64)YouthAcademyLevel * 250);
}

void FFM13World::CheckJobSecurity()
{
	// Konto im Minus kostet Vertrauen (im Browserspiel kommt dazu die Transfersperre)
	if (Money < 0) BoardSat = FMath::Max(10, BoardSat - 2);
	// Wie checkJobSecurity() in js/match-post.js: erste Saison ist Schonzeit, während der Saison wird nur
	// gezählt und gewarnt. Entlassen wird erst am Saisonende (CheckSeasonEndSacking).
	if (Season <= 1) { LowBoardSatStreak = 0; return; }
	BoardHistory.Add(BoardSat);
	if (BoardHistory.Num() > 7) BoardHistory.RemoveAt(0);
	if (BoardSat <= FM13::BoardWarningThreshold) ++LowBoardSatStreak;
	else LowBoardSatStreak = 0;

	const int32 N = BoardHistory.Num();
	const bool bFallend = N >= 3 && BoardHistory[N - 3] > BoardHistory[N - 2] && BoardHistory[N - 2] > BoardHistory[N - 1];
	if ((BoardSat < 50 || (BoardSat < 60 && bFallend)) && EarlyWarnSeason != Season)
	{
		EarlyWarnSeason = Season;
		AddMessage(TEXT("Der Vorstand wird unruhig"), FString::Printf(TEXT("Die Zufriedenheit des Vorstands ist auf %d gefallen."), BoardSat));
	}
	if (LowBoardSatStreak == 3)
		AddMessage(TEXT("Warnung des Vorstands"), TEXT("Bleibt das Vertrauen so niedrig, droht am Saisonende die Entlassung."));
}

void FFM13World::CheckSeasonEndSacking(int32 Rank)
{
	// checkSeasonEndSacking(): Vertrauen unter der Schwelle, die letzten Spiele darunter, keine Erholung
	// gegenüber dem Wert vor sechs Spielen und Saisonziel verfehlt (Platz 1-2 oder Erwartung)
	if (Season <= 1) return;
	const bool bErholt = BoardHistory.Num() >= 7 && BoardSat > BoardHistory[0];
	BoardHistory.Reset();
	const bool bZielErreicht = Rank > 0 && (Rank <= 2 || Rank <= SeasonTarget);
	if (BoardSat <= FM13::BoardWarningThreshold && LowBoardSatStreak >= FM13::BoardSackStreak && !bErholt && !bZielErreicht)
	{
		bSacked = true;
		AddMessage(TEXT("Entlassen"), FString::Printf(TEXT("Nach Platz %d trennt sich der Vorstand von dir."), Rank));
	}
}

void FFM13World::PickScorers(int32 Goals, TArray<FString>& OutNames)
{
	int32 Dummy = 0;
	const TArray<int32> Elf = LineupIndices(Dummy);
	// creditOwnGoal() aus js/player-stats.js: Torschütze nach Position gewichtet (Eisenfuß trifft öfter),
	// in drei von vier Fällen mit Vorlage eines Mitspielers
	MatchGoals.Reset();
	MatchAssists.Reset();
	for (int32 i = 0; i < Squad.Num(); ++i) { MatchGoals.Add(0); MatchAssists.Add(0); }
	int32 Summe = 0;
	for (int32 i : Elf) Summe += FM13Strength::ScorerWeight(Squad[i].Pos, Squad[i].Trait);
	for (int32 g = 0; g < Goals && Summe > 0; ++g)
	{
		int32 Wurf = Rng.RandRange(1, Summe);
		int32 Schuetze = -1;
		for (int32 i : Elf)
		{
			Wurf -= FM13Strength::ScorerWeight(Squad[i].Pos, Squad[i].Trait);
			if (Wurf <= 0) { Schuetze = i; break; }
		}
		if (Schuetze < 0) continue;
		Squad[Schuetze].GoalsSeason++;
		MatchGoals[Schuetze]++;
		FString Zeile = Squad[Schuetze].Name;
		int32 Vorlagen = 0;
		for (int32 i : Elf) if (i != Schuetze) Vorlagen += FM13Strength::AssistWeight(Squad[i].Pos);
		if (Vorlagen > 0 && Rng.FRand() < 0.75f)
		{
			int32 V = Rng.RandRange(1, Vorlagen);
			for (int32 i : Elf)
			{
				if (i == Schuetze) continue;
				V -= FM13Strength::AssistWeight(Squad[i].Pos);
				if (V <= 0)
				{
					Squad[i].Assists++;
					MatchAssists[i]++;
					Zeile += FString::Printf(TEXT(" (Vorlage %s)"), *Squad[i].Name);
					break;
				}
			}
		}
		OutNames.Add(Zeile);
	}
}

// gradeOwnMatch() aus js/player-stats.js: Note für jeden Spieler der Startelf nach einem Ligaspiel,
// Spieler des Spiels, Elf des Spieltags (Note 1,5 oder besser) mit Moralschub +3.
void FFM13World::ApplyGrades(int32 OwnGoals, int32 OppGoals)
{
	int32 Dummy = 0;
	int32 Bester = -1;
	for (int32 i : LineupIndices(Dummy))
	{
		FFM13Player& P = Squad[i];
		P.LastGrade = FM13Strength::Grade(OwnGoals, OppGoals, P.DailyForm, MatchGoals.IsValidIndex(i) ? MatchGoals[i] : 0,
			MatchAssists.IsValidIndex(i) ? MatchAssists[i] : 0, P.Pos, Rng.RandRange(0, 999999) / 1000000.0);
		P.GradeSum += P.LastGrade;
		P.GradeGames++;
		if (Bester < 0 || P.LastGrade < Squad[Bester].LastGrade) Bester = i;
		if (P.LastGrade <= 15)
		{
			P.TeamOfMatchday++;
			P.Morale = FMath::Min(100, P.Morale + 3);
			LastReport.TeamOfMatchday.Add(FString::Printf(TEXT("%s (Note %d,%d)"), *P.Name, P.LastGrade / 10, P.LastGrade % 10));
		}
	}
	if (Bester >= 0) { LastReport.BestPlayer = Squad[Bester].Name; LastReport.BestGrade = Squad[Bester].LastGrade; }
	if (LastReport.TeamOfMatchday.Num())
		AddMessage(TEXT("Elf des Spieltags"), FString::Printf(TEXT("Die Fachpresse nominiert %s fuer die Elf des %d. Spieltags. Moralschub!"),
			*FString::Join(LastReport.TeamOfMatchday, TEXT(", ")), Matchday));
}

int32 FFM13World::NextFitnessLoss(bool bHome) const
{
	FM13Fitness::FKraftEingabe E;
	E.bFitnessGuru = bFitnessGuru;
	E.bAthletiktrainer = AthletikTrainer.bHired;
	E.bErnaehrung = Ernaehrungsberater.bHired;
	E.ErnaehrungStufe = Ernaehrungsberater.Level;
	E.bErnaehrungLeistung = Ernaehrungsberater.Task == TEXT("leistung");
	E.bPhysio = Physio.bHired;
	E.bPhysioBelastung = Physio.Task == TEXT("belastung");
	E.bGreenkeeper = Greenkeeper.bHired;
	E.bGreenkeeperTempo = Greenkeeper.Task == TEXT("tempo");
	E.Intensitaet = TrainingIntensity;
	E.Teamtraining = TeamTraining;
	E.Tempo = FM13Tactics::Style(TacticStyle).Tempo;
	E.Pressing = FM13Tactics::Style(TacticStyle).Press;
	E.WetterFaktor = FM13Match::Weathers()[WeatherIndex].FitLossMult;
	E.bAuswaerts = !bHome;
	E.LigaStufe = LeagueLevel;
	E.bBus = bBusTravel;
	E.bBusSponsor = bBusSponsor;
	E.bBusBanden = bBusBanden;
	return FM13Fitness::Verlust(E);
}

// Tagesform und Kondition nach jedem verarbeiteten Spieltag (js/match-live.js, processPostMatchRoutine()).
// Erst die Tagesform aus Moral und alter Kondition, dann der Kraftverlust der Startelf und die Erholung der Bank.
void FFM13World::ApplyFitnessAfterMatchday(bool bHome)
{
	int32 Dummy = 0;
	const TArray<int32> Elf = LineupIndices(Dummy);
	for (FFM13Player& P : Squad)
	{
		const double Zufall = Rng.RandRange(0, 999999) / 1000000.0 * 40.0 - 20.0;
		P.DailyForm = FM13Fitness::Tagesform(P.Morale, P.Fitness, Zufall);
	}

	const int32 Kraftverlust = NextFitnessLoss(bHome);

	for (int32 i = 0; i < Squad.Num(); ++i)
		Squad[i].Fitness = FM13Fitness::NachSpiel(Squad[i].Fitness, Elf.Contains(i), Kraftverlust, TeamTraining);
}

// ---------- Saisonende ----------

FFM13SeasonSummary FFM13World::ConcludeSeason()
{
	FFM13SeasonSummary S;
	S.Season = Season;
	S.Level = LeagueLevel;
	if (!IsSeasonFinished() || bSacked) return S;

	const int32 Rank = OwnRank();
	const FFM13Club& Eigen = OwnLeague().Clubs[OwnLeague().FindOwn()];
	S.Rank = Rank;
	S.Points = Eigen.Points();

	// TV-Abrechnung: Differenz zwischen Anspruch nach Endstand und gezahlten Raten
	const int64 Anspruch = FM13Economy::TvMoney(LeagueLevel, Rank);
	const int64 Rest = Anspruch - TvPaidThisSeason;
	if (Rest != 0) Book(Rest > 0 ? TEXT("TV-Restausschuettung") : TEXT("TV-Rueckforderung"), Rest);
	TvPaidThisSeason = 0;
	S.TvPayout = Anspruch;

	EFM13SeasonOutcome Outcome = EFM13SeasonOutcome::Stayed;
	if (Rank <= 2 && LeagueLevel > 0) Outcome = EFM13SeasonOutcome::Promoted;
	else if (Rank >= FM13::TeamsPerLeague - 1 && LeagueLevel < FM13::NumLeagues - 1) Outcome = EFM13SeasonOutcome::Relegated;
	// Relegation (js/relegation.js): Platz 16 gegen den Dritten darunter, Platz 3 gegen den 16. darüber
	LastRelegation = PlayRelegation(Rank);
	S.Relegation = LastRelegation;
	if (LastRelegation.bPlayed)
	{
		if (LastRelegation.bForPromotion && LastRelegation.bWon) Outcome = EFM13SeasonOutcome::Promoted;
		if (!LastRelegation.bForPromotion && !LastRelegation.bWon) Outcome = EFM13SeasonOutcome::Relegated;
		if (LastRelegation.bWon) Unlock(TEXT("relegation"), &S.NewAchievements);
	}
	// DFB-Lizenz (season-end.js): der Aufstieg braucht die erfuellten Auflagen, sonst gibt es eine Nachfrist von drei Spieltagen
	if (Outcome == EFM13SeasonOutcome::Promoted && LeagueLevel > 0)
	{
		const FFM13LizenzStatus Lizenz = DfbLicensingStatus();
		if (Lizenz.Fehlend.Num() > 0)
		{
			DfbNachfrist.bAktiv = true;
			DfbNachfrist.Ziel = Lizenz.ZielLiga;
			DfbNachfrist.Frist = 3;
			AddMessage(TEXT("DFB-Lizenz vorlaeufig verweigert - Nachfrist!"), FString::Printf(TEXT("Sportlich ist der Aufstieg geschafft, aber der DFB verweigert vorerst die Lizenz. Offen: %s. Frist: drei Spieltage."), *Lizenz.Fehlend[0]));
			Outcome = EFM13SeasonOutcome::Stayed;
		}
		else if (Lizenz.Auflagen.Num() > 0) AddMessage(TEXT("Lizenz unter Auflagen"), TEXT("Der DFB erteilt die Lizenz unter Auflagen - die Baustellen muessen fertig werden."));
	}
	S.Outcome = Outcome;
	if (Outcome == EFM13SeasonOutcome::Promoted && Sponsor.PromotionBonus > 0) Book(TEXT("Sponsor Aufstiegspraemie"), Sponsor.PromotionBonus);

	FFM13SeasonRecord Rec;
	Rec.Season = Season; Rec.Level = LeagueLevel; Rec.Rank = Rank; Rec.Points = S.Points; Rec.Outcome = Outcome;
	History.Add(Rec);

	// Zuerst die Entlassungsprüfung (wie in concludeSeasonAndAdvance), dann die Saisonbewertung
	CheckSeasonEndSacking(Rank);

	// Saisonbewertung relativ zum Saisonziel (vereinfacht evaluateSeasonEndObjectives)
	const int32 Abstand = SeasonTarget - Rank;
	int32 Wertung = 0;
	if (Abstand >= 3) Wertung = 12;
	else if (Abstand >= 0) Wertung = 6;
	else if (Abstand >= -3) Wertung = -6;
	else Wertung = -18;
	BoardSat = FMath::Clamp(BoardSat + Wertung, 10, 100);
	ResolveTransferStrategy(Rank);
	EvaluateFinancialFairplay();
	ResolveSaisonWette(Rank);
	ResolveWinterTalk(Rank);
	PrepareMemberAssembly(Rank);
	if (Outcome == EFM13SeasonOutcome::Relegated) RelegatedIntoSeason = Season + 1;
	LastSeasonRank = Rank;
	RelegationWages = 0;
	if (Outcome == EFM13SeasonOutcome::Relegated)
	{
		RelegationWages = ApplyRelegationWageClause();
		// Fallschirmgeld (js/media-rights.js): 25 % des TV-Grundbetrags der verlassenen Liga
		const int64 Fallschirm = FM13Transfers::JsRunden((double)FM13Economy::LeagueBaseTvMoney(LeagueLevel) * 0.25 / 1000.0) * 1000;
		if (Fallschirm > 0) { Book(TEXT("Fallschirmgeld (TV)"), Fallschirm); AddMessage(TEXT("Fallschirmgeld"), FString::Printf(TEXT("Die alte Liga zahlt dem Absteiger einmalig %lld aus dem TV-Topf."), (long long)Fallschirm)); }
	}
	if (Outcome == EFM13SeasonOutcome::Promoted) { BoardSat = FMath::Min(100, BoardSat + 15); Fans = FMath::Min(100, Fans + 10); }
	if (Outcome == EFM13SeasonOutcome::Relegated) { BoardSat = FMath::Max(10, BoardSat - 15); Fans = FMath::Max(0, Fans - 10); }
	if (Rank == 1) { BoardSat = FMath::Min(100, BoardSat + 5); Fans = FMath::Min(100, Fans + 5); }
	LowBoardSatStreak = 0;

	CheckAchievements(true, Rank, Outcome, &S.NewAchievements);
	// Europapokal der nächsten Saison: Bundesliga Platz 1 bis 4 oder DFB-Pokalsieger
	const bool bLigaPlatz = LeagueLevel == 0 && Rank <= 4;
	bEuropeNextSeason = bLigaPlatz || DfbPokal.Winner == ClubName;
	EuropePot = bLigaPlatz ? (Rank == 1 ? 0 : (Rank <= 3 ? 1 : 2)) : 3;
	if (bEuropeNextSeason) AddMessage(TEXT("Europapokal!"), TEXT("Der Verein spielt naechste Saison im Champions Cup."));
	SeasonAwards(S, Rank, Outcome);
	AgeAiStars();
	AdvanceLeagues(Rank, Outcome);
	ApplyPendingFfpPointDeduction();
	if (Outcome == EFM13SeasonOutcome::Promoted) TriggerPromotionBonusClauses();
	// Transferbudget der neuen Saison: Liga-Budget x Platzierungsfaktor (season-end.js)
	const double Platzfaktor = Rank <= 4 ? 1.3 : (Rank <= 10 ? 1.0 : 0.8);
	TransferBudget = FM13Transfers::JsRunden((double)LeagueTransferBudget(LeagueLevel) * Platzfaktor / 1000.0) * 1000;
	bWinterWindowActive = false;
	bWinterWindowUsed = false;
	WinterWindowCloseMatchday = 0;
	bStrategySet = false;
	if (Outcome == EFM13SeasonOutcome::Promoted && LeagueLevel == 0) Unlock(TEXT("bundesliga"), &S.NewAchievements);
	DevelopPlayers(S);
	YouthIntake(S);

	TickBuybackOptions();
	JoinPreContractPlayers();
	CheckPlaytimePromises();
	++Season;
	ErneuereB2BAuftraege();
	OpenMemberAssembly();
	RecordSeasonExpectationRank();
	Matchday = 1;
	OwnSeasonGoals.Reset();
	Stress = (int32)FMath::RoundToInt((float)Stress / 2.f + 0.001f); // Sommerpause halbiert den Stress
	if (Outcome == EFM13SeasonOutcome::Promoted)
	{
		// markPromotionBoost(): nach dem Saisonende gilt der Schub fuer die naechste Saison (Season + 1), dazu das Aufstiegsbudget
		PromotionBoostLevel = LeagueLevel;
		PromotionBoostSeason = Season + 1;
		TransferBudget += PromotionTransferBonus();
	}
	for (FFM13League& L : Leagues)
	{
		L.ResetStats();
		L.BuildSchedule(Rng);
	}
	InitCups();
	PlanSeason();
	PickRival();
	Europe = FFM13Europe();
	if (bEuropeNextSeason) InitEurope();
	bEuropeNextSeason = false;
	ManualLineup.RemoveAll([this](int32 Id) { return !FindPlayer(Id); });
	ManualBench.RemoveAll([this](int32 Id) { return !FindPlayer(Id); });
	RefreshMarket();
	IncomingOffers.Reset();
	RecentStyles.Reset();
	if (Sponsor.MatchdaysLeft <= 0 && !SponsorOffers.Num()) MakeSponsorOffers();
	PrepareOppPlan();

	const TCHAR* Text = Outcome == EFM13SeasonOutcome::Promoted ? TEXT("Aufstieg") : (Outcome == EFM13SeasonOutcome::Relegated ? TEXT("Abstieg") : TEXT("Klassenerhalt"));
	AddMessage(FString::Printf(TEXT("Saison %d beendet: Platz %d"), S.Season, Rank),
		FString::Printf(TEXT("%s. Neue Liga: %s. TV-Geld: %lld Euro."), Text, FM13::LeagueName(LeagueLevel), (long long)Anspruch));
	return S;
}

void FFM13World::AdvanceLeagues(int32 /*OwnRank*/, EFM13SeasonOutcome OwnOutcome)
{
	// Wie advanceLeaguesToNewSeason(): je Liga-Grenze steigen 2 KI-Vereine auf und 2 ab, der eigene
	// Verein zählt dabei nicht mit. Danach wird er mit dem schwächsten KI-Verein der Zielliga getauscht,
	// damit alle Ligen bei 18 Vereinen bleiben (insertOurTeamIntoLeagues).
	TArray<TArray<FFM13Club>> Neu;
	for (int32 L = 0; L < FM13::NumLeagues; ++L) Neu.Add(TArray<FFM13Club>());

	for (int32 L = 0; L < FM13::NumLeagues; ++L)
	{
		const FFM13League& Liga = Leagues[L];
		const TArray<int32> Sortiert = Liga.SortedIndices();
		TArray<int32> NurKi;
		for (int32 i : Sortiert) if (!Liga.Clubs[i].bOwn) NurKi.Add(i);

		for (int32 r = 0; r < Sortiert.Num(); ++r)
		{
			const int32 i = Sortiert[r];
			FFM13Club C = Liga.Clubs[i];
			if (C.bOwn) { Neu[L].Add(C); continue; }
			const int32 KiPlatz = NurKi.IndexOfByPredicate([i](int32 X) { return X == i; });
			EFM13SeasonOutcome O = EFM13SeasonOutcome::Stayed;
			if (L > 0 && KiPlatz < 2) O = EFM13SeasonOutcome::Promoted;
			else if (L < FM13::NumLeagues - 1 && KiPlatz >= NurKi.Num() - 2) O = EFM13SeasonOutcome::Relegated;
			EvolveAiClub(C, r + 1, L, O);
			const int32 Ziel = O == EFM13SeasonOutcome::Promoted ? L - 1 : (O == EFM13SeasonOutcome::Relegated ? L + 1 : L);
			Neu[Ziel].Add(C);
		}
	}

	if (OwnOutcome != EFM13SeasonOutcome::Stayed)
	{
		const int32 Alt = LeagueLevel;
		const int32 Ziel = OwnOutcome == EFM13SeasonOutcome::Promoted ? Alt - 1 : Alt + 1;
		const int32 EigenIdx = Neu[Alt].IndexOfByPredicate([](const FFM13Club& C) { return C.bOwn; });
		int32 Schwach = -1;
		for (int32 i = 0; i < Neu[Ziel].Num(); ++i)
			if (!Neu[Ziel][i].bOwn && (Schwach < 0 || Neu[Ziel][i].Strength < Neu[Ziel][Schwach].Strength)) Schwach = i;
		if (EigenIdx >= 0 && Schwach >= 0)
		{
			const FFM13Club Eigen = Neu[Alt][EigenIdx];
			const FFM13Club Tausch = Neu[Ziel][Schwach];
			Neu[Alt].RemoveAt(EigenIdx);
			Neu[Ziel].RemoveAt(Schwach);
			Neu[Ziel].Add(Eigen);
			Neu[Alt].Add(Tausch);
			LeagueLevel = Ziel;
		}
	}

	for (int32 L = 0; L < FM13::NumLeagues; ++L) Leagues[L].Clubs = Neu[L];
}

void FFM13World::EvolveAiClub(FFM13Club& C, int32 Rank, int32 OldLevel, EFM13SeasonOutcome Outcome)
{
	// evolveAiTeamStrength(): sanfte Annäherung an das Niveau der neuen Liga plus Rauschen
	const int32 NewLevel = Outcome == EFM13SeasonOutcome::Promoted ? OldLevel - 1 : (Outcome == EFM13SeasonOutcome::Relegated ? OldLevel + 1 : OldLevel);
	const float RankQuality = 1.f - (float)(Rank - 1) / (float)FMath::Max(1, FM13::TeamsPerLeague - 1);
	const float Ziel = (float)FM13::LeagueBaseStrength(NewLevel) - 5.f + RankQuality * 10.f;
	const float Rauschen = (Rng.FRand() - 0.5f) * 6.f;
	const float Tempo = Outcome == EFM13SeasonOutcome::Relegated ? 0.55f : 0.4f;
	const float Neu = (float)C.Strength + (Ziel - (float)C.Strength) * Tempo + Rauschen;
	C.Strength = FMath::Clamp(FMath::RoundToInt(Neu), 35, 96);
}

void FFM13World::DevelopPlayers(FFM13SeasonSummary& S)
{
	for (FFM13Player& P : Squad)
	{
		// Entwicklungstyp (js/player-development.js): Änderung nach dem Abstand zum Höhepunkt
		int32 Min = 0, Max = 0;
		FM13Dev::DevelopmentRange(P.Age, P.Archetype, Min, Max);
		P.Age++;
		P.Strength = FMath::Clamp(P.Strength + Rng.RandRange(Min, Max), 20, 99);
		P.Potential = FMath::Max(P.Potential, P.Strength);
		P.SeasonsAtClub++;
		P.YellowCards = 0;
		P.MarketValue = FM13Economy::MarketValue(P.Strength, &Rng);
		P.GoalsCareer += P.GoalsSeason;
		P.GoalsSeason = 0;
		for (bool& B : P.bBonusBezahlt) B = false;   // ensureBonusClauseFields: neue Saison, neue Auszahlung
		P.Fitness = 100; // Sommerpause, js/season-end.js
		P.AssistsCareer += P.Assists;
		P.Assists = 0;
		P.GradeSum = 0;
		P.GradeGames = 0;
		P.TeamOfMatchday = 0;
		P.LastGrade = 0;
		P.Appearances = 0;
		P.ContractYears--;
		P.InjuredMatchdays = FMath::Max(0, P.InjuredMatchdays - 6); // Sommerpause
	}

	// Vertragsende und Karriereende
	TArray<FFM13Player> Bleiben;
	for (const FFM13Player& P : Squad)
	{
		const bool bRuhestand = P.Age >= 37 || (P.Age >= 35 && Rng.RandRange(0, 1) == 1);
		if (bRuhestand)
		{
			S.Left.Add(P.Name + TEXT(" (Karriereende)"));
			// Legende (js/player-retirement.js): lange im Verein oder viele Tore
			if (P.SeasonsAtClub >= 5 || P.GoalsCareer >= 50)
			{
				FFM13Legend L;
				L.Name = P.Name; L.Position = FM13PositionName(P.Pos); L.Seasons = P.SeasonsAtClub;
				L.Goals = P.GoalsCareer; L.BestStrength = P.Strength; L.RetiredSeason = Season;
				Legends.Add(L);
				S.NewLegends.Add(P.Name);
				AddMessage(TEXT("Neue Vereinslegende"), FString::Printf(TEXT("%s beendet die Karriere nach %d Saisons und %d Toren."), *P.Name, P.SeasonsAtClub, P.GoalsCareer));
				Unlock(TEXT("legende"), &S.NewAchievements);
			}
			continue;
		}
		if (P.ContractYears <= 0) { S.Left.Add(P.Name + (P.PreSignedClub.IsEmpty() ? TEXT(" (Vertragsende)") : FString::Printf(TEXT(" (Vorvertrag bei %s)"), *P.PreSignedClub))); continue; }
		Bleiben.Add(P);
	}
	Squad = Bleiben;

	// Notverpflichtungen, damit immer genug Spieler da sind (mindestens 2 TW)
	const int32 Basis = FM13::LeagueBaseStrength(LeagueLevel);
	auto Zaehle = [this](EFM13Position Pos) { int32 N = 0; for (const FFM13Player& P : Squad) if (P.Pos == Pos) ++N; return N; };
	while (Zaehle(EFM13Position::TW) < 2)
	{
		FFM13Player P = CreatePlayer(EFM13Position::TW, Basis - 10, Basis - 4, 20, 30);
		Squad.Add(P);
		AddMessage(TEXT("Notverpflichtung"), P.Name + TEXT(" kommt ablosefrei als Torwart."));
	}
	while (Squad.Num() < FM13::MinSquadSize)
	{
		const EFM13Position Pos = (EFM13Position)Rng.RandRange(1, 3);
		FFM13Player P = CreatePlayer(Pos, Basis - 10, Basis - 4, 20, 30);
		Squad.Add(P);
		AddMessage(TEXT("Notverpflichtung"), P.Name + TEXT(" kommt ablosefrei, damit der Kader reicht."));
	}

	// Talente werden ein Jahr aelter (ageYouthAtSeasonEnd); ihr Wachstum kommt monatlich aus TickYouthDevelopment()
	AgeYouthAtSeasonEnd();
	for (FFM13Player& T : YouthTalents) T.MarketValue = FM13Economy::MarketValue(T.Strength, nullptr);
}

// ageYouthAtSeasonEnd(): ein Jahr aelter, ab 19 offene Entscheidung mit acht Spieltagen Frist (auch in der Leihe)
void FFM13World::AgeYouthAtSeasonEnd()
{
	auto Altern = [this](FFM13Player& T)
	{
		T.Age++;
		if (T.Age >= 19 && T.ProDecisionLeft == 0 && !T.bAcademyGraduate) T.ProDecisionLeft = 8;
	};
	for (FFM13Player& T : YouthTalents) Altern(T);
	for (FFM13YouthLoan& L : YouthLoans) Altern(L.Player);
	int32 Faellig = 0;
	for (const FFM13Player& T : YouthTalents) if (T.ProDecisionLeft == 8) ++Faellig;
	if (Faellig) AddMessage(TEXT("Profivertrag-Entscheidung"), FString::Printf(TEXT("%d Talent(e) sind der A-Jugend entwachsen. Entscheide innerhalb von 8 Spieltagen."), Faellig));
}

// tickYouthDevelopment(): monatlich. Jeder Talent wächst nach seiner Potenzialgrenze, Jugendtrainer, Schwerpunkt, Mentor und Alter.
void FFM13World::TickYouthDevelopment()
{
	const double Trainer = FM13Youth::Trainerbonus(YouthCoachId != 0, YouthCoachCount);
	for (FFM13Player& T : YouthTalents)
	{
		if (T.PotentialTier == 0) T.PotentialTier = FM13Youth::Stufe(RngJugend.FRand());
		const bool bSchwerpunkt = T.YouthFocus != TEXT("allgemein");
		const bool bMentor = T.MentorId != 0 && FindPlayer(T.MentorId) != nullptr;
		const double Zufall = RngJugend.RandRange(0, 999999) / 1000000.0;
		T.Strength = FM13Youth::Wachstum(T.Strength, T.Potential, T.Age, Trainer, bSchwerpunkt, bMentor, Zufall);
		T.MarketValue = FM13Economy::MarketValue(T.Strength, nullptr);
	}
}

bool FFM13World::AssignYouthCoach(int32 PlayerId, FString& OutReason)
{
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht gefunden."); return false; }
	if (Money < 15000) { OutReason = TEXT("Nicht genug Geld! Benoetigt: 15000"); return false; }
	Book(TEXT("Jugendtrainer"), -15000);
	YouthCoachId = PlayerId;
	YouthCoachCount++;
	return true;
}

void FFM13World::RemoveYouthCoach()
{
	YouthCoachId = 0;
}

void FFM13World::YouthIntake(FFM13SeasonSummary& S)
{
	const int32 Basis = FM13::LeagueBaseStrength(LeagueLevel);
	const int32 Anzahl = 1 + YouthAcademyLevel;
	for (int32 n = 0; n < Anzahl && YouthTalents.Num() < 12; ++n)
	{
		FFM13Player T = CreatePlayer((EFM13Position)Rng.RandRange(0, 3), Basis - 14 + YouthAcademyLevel * 2, Basis - 6 + YouthAcademyLevel * 2, 16, 17);
		T.Potential = FMath::Min(99, T.Strength + Rng.RandRange(8, 15 + YouthAcademyLevel * 4));
		// Potenzialstufe: Zufall, Akademie (0,04 je Stufe ueber der ersten) - assignYouthPotentialTier()
		T.PotentialTier = FM13Youth::Stufe(RngJugend.FRand() + (YouthAcademyLevel - 1) * 0.04);
		T.bPotentialRevealed = false;
		T.Wage = 0;
		T.ContractYears = 0;
		YouthTalents.Add(T);
		S.NewYouth.Add(T.Name);
	}
}

// ---------- Kader ----------

int32 FFM13World::OwnStrength() const
{
	int32 Staerke = 0;
	LineupIndices(Staerke);
	return Staerke;
}

TArray<int32> FFM13World::StartingEleven() const
{
	int32 Dummy = 0;
	TArray<int32> Ids;
	for (int32 i : LineupIndices(Dummy)) Ids.Add(Squad[i].Id);
	return Ids;
}

int32 FFM13World::ClubStrength(const FString& Name, EFM13Playstyle& OutStyle) const
{
	OutStyle = EFM13Playstyle::Ausgeglichen;
	if (Name == ClubName) return OwnStrength();
	for (const FFM13League& L : Leagues)
	{
		const int32 i = L.FindClub(Name);
		if (i >= 0) { OutStyle = L.Clubs[i].Playstyle; return L.Clubs[i].Strength; }
	}
	return 75;
}

// ---------- Pokale ----------

void FFM13World::InitCups()
{
	// DFB-Pokal: 18/8/4/2 Vereine aus den Ligen 1 bis 4, der eigene ab der 3. Liga oder als Landespokalsieger
	DfbPokal = FM13CupRules::MakeDfbPokal();
	const bool bDfbDabei = LeagueLevel <= FM13CupRules::DfbDirectFromLevel || bDfbViaLandespokal;
	bDfbViaLandespokal = false; // Startplatz eingelöst
	DfbPokal.bOwnEntered = bDfbDabei;
	DfbPokal.bOwnAlive = bDfbDabei;
	if (bDfbDabei) DfbPokal.Alive.Add(ClubName);
	static const int32 Quoten[4] = { 18, 8, 4, 2 };
	for (int32 L = 0; L < 4 && L < Leagues.Num(); ++L)
	{
		TArray<FString> Pool;
		for (const FFM13Club& C : Leagues[L].Clubs) if (!C.bOwn) Pool.Add(C.Name);
		for (int32 i = Pool.Num() - 1; i > 0; --i) Swap(Pool[i], Pool[Rng.RandRange(0, i)]);
		const int32 Frei = Quoten[L] - (bDfbDabei && LeagueLevel == L ? 1 : 0);
		for (int32 i = 0; i < Frei && i < Pool.Num() && DfbPokal.Alive.Num() < 32; ++i) DfbPokal.Alive.Add(Pool[i]);
	}

	// Landespokal: nur für Vereine unterhalb der 3. Liga, 16 Teilnehmer aus den Ligen 4 bis 6
	Landespokal = FM13CupRules::MakeLandespokal();
	if (LeagueLevel > FM13CupRules::DfbDirectFromLevel)
	{
		Landespokal.bOwnEntered = true;
		Landespokal.bOwnAlive = true;
		Landespokal.Alive.Add(ClubName);
		TArray<FString> Pool;
		for (int32 L = 3; L < FM13::NumLeagues; ++L) for (const FFM13Club& C : Leagues[L].Clubs) if (!C.bOwn) Pool.Add(C.Name);
		for (int32 i = Pool.Num() - 1; i > 0; --i) Swap(Pool[i], Pool[Rng.RandRange(0, i)]);
		for (int32 i = 0; i < 15 && i < Pool.Num(); ++i) Landespokal.Alive.Add(Pool[i]);
	}
	else
	{
		Landespokal.Round = Landespokal.RoundMatchdays.Num(); // nicht dabei
	}
}

void FFM13World::PlayCupRound(FFM13Cup& Cup, bool bDfb)
{
	if (Cup.IsFinished() || Cup.Alive.Num() < 2) return;
	// Auslosung
	TArray<FString> Lostopf = Cup.Alive;
	for (int32 i = Lostopf.Num() - 1; i > 0; --i) Swap(Lostopf[i], Lostopf[Rng.RandRange(0, i)]);
	Cup.LastRound.Reset();
	TArray<FString> Weiter;
	const FString Runde = Cup.RoundNames[Cup.Round];
	const int64 Praemie = Cup.Prizes[Cup.Round];
	for (int32 i = 0; i + 1 < Lostopf.Num(); i += 2)
	{
		FFM13CupMatch M;
		M.Home = Lostopf[i];
		M.Away = Lostopf[i + 1];
		// Pokal wie js/cup.js: ohne Spielstile; Heimvorteil nur, wenn der eigene Verein beteiligt ist
		EFM13Playstyle HS, AS;
		const bool bEigenesSpiel = M.Home == ClubName || M.Away == ClubName;
		const double HExakt = M.Home == ClubName ? OwnCupStrength(true) : ClubStrength(M.Home, HS) + (bEigenesSpiel ? FM13::AiHomeAdvantage : 0);
		const double AExakt = M.Away == ClubName ? OwnCupStrength(false) : ClubStrength(M.Away, AS);
		const int32 HStr = FMath::RoundToInt((float)HExakt), AStr = FMath::RoundToInt((float)AExakt);
		const FM13Match::FExpectedGoals Xg = FM13Match::ExpectedGoals(HExakt, AExakt, EFM13Playstyle::Ausgeglichen, EFM13Playstyle::Ausgeglichen);
		M.HomeGoals = FM13Match::Poisson(Rng, Xg.Home);
		M.AwayGoals = FM13Match::Poisson(Rng, Xg.Away);
		if (M.HomeGoals == M.AwayGoals)
		{
			M.bPenalties = true;
			M.Winner = Rng.FRand() < FM13CupRules::PenaltyWinChance(HStr, AStr) ? M.Home : M.Away;
		}
		else M.Winner = M.HomeGoals > M.AwayGoals ? M.Home : M.Away;
		Weiter.Add(M.Winner);
		Cup.LastRound.Add(M);

		const bool bHome = M.Home == ClubName;
		if (!bHome && M.Away != ClubName) continue;

		// Eigenes Pokalspiel
		FFM13OwnMatchReport& R = LastCupReport;
		R = FFM13OwnMatchReport();
		R.Competition = Cup.Name;
		R.OwnGoals = bHome ? M.HomeGoals : M.AwayGoals;
		R.OppGoals = bHome ? M.AwayGoals : M.HomeGoals;
		R.OwnStrength = bHome ? HStr : AStr;
		R.OppStrength = bHome ? AStr : HStr;
		R.bPenalties = M.bPenalties;
		R.bAdvanced = M.Winner == ClubName;
		PickScorers(R.OwnGoals, R.Scorers);
		if (bHome)
		{
			// Pokal-Heimspiel: Zuschauer wie in der Liga, im Pokal etwas mehr Andrang
			R.Attendance = FMath::Min(StadiumTotal(), FM13Economy::Attendance(StadiumTotal(), Fans, LeagueLevel, OwnRank(), TicketAverage()) * 6 / 5);
			const int64 Tickets = TicketRevenue(R.Attendance);
			Book(Cup.Name + TEXT(": Ticketeinnahmen"), Tickets);
			R.Income += Tickets;
		}
		if (R.bAdvanced)
		{
			Book(Cup.Name + TEXT(": Praemie ") + Runde, Praemie);
			R.Income += Praemie;
			BoardSat = FMath::Min(100, BoardSat + 3);
			Fans = FMath::Min(100, Fans + 2);
		}
		else
		{
			Cup.bOwnAlive = false;
			AddMessage(Cup.Name, FString::Printf(TEXT("Aus in der Runde %s gegen %s."), *Runde, *(bHome ? M.Away : M.Home)));
		}
		R.Weather = FM13Match::Weathers()[WeatherIndex].Name;
		FinishOwnReport(R, bHome ? M.Away : M.Home, bHome, TArray<FString>(), TArray<FString>());
	}
	if (Lostopf.Num() % 2 == 1) Weiter.Add(Lostopf.Last()); // Freilos
	Cup.Alive = Weiter;
	Cup.Round++;
	if (Cup.Alive.Num() == 1)
	{
		Cup.Winner = Cup.Alive[0];
		if (Cup.Winner == ClubName)
		{
			AddMessage(FString::Printf(TEXT("%s gewonnen!"), *Cup.Name), bDfb ? TEXT("Der Verein holt den DFB-Pokal!") : TEXT("Landespokalsieger: naechste Saison spielt der Verein im DFB-Pokal."));
			if (!bDfb) bDfbViaLandespokal = true;
			Unlock(bDfb ? TEXT("pokalsieger") : TEXT("landespokal"), nullptr);
			BoardSat = FMath::Min(100, BoardSat + 10);
			Fans = FMath::Min(100, Fans + 8);
		}
	}
}

int32 FFM13World::OwnRank() const
{
	if (!Leagues.IsValidIndex(LeagueLevel)) return 0;
	const FFM13League& L = Leagues[LeagueLevel];
	return L.RankOf(L.FindOwn());
}

int64 FFM13World::WagesPerMatchday() const
{
	int64 Summe = 0;
	for (const FFM13Player& P : Squad) Summe += P.Wage;
	return Summe;
}

int64 FFM13World::SquadValue() const
{
	int64 Summe = 0;
	for (const FFM13Player& P : Squad) Summe += P.MarketValue;
	return Summe;
}

FFM13Player* FFM13World::FindPlayer(int32 Id)
{
	return Squad.FindByPredicate([Id](const FFM13Player& P) { return P.Id == Id; });
}

const FFM13Player* FFM13World::FindPlayer(int32 Id) const
{
	return Squad.FindByPredicate([Id](const FFM13Player& P) { return P.Id == Id; });
}

void FFM13World::RefreshMarket()
{
	Market.Reset();
	const int32 Basis = FM13::LeagueBaseStrength(LeagueLevel);
	for (int32 n = 0; n < 8; ++n)
	{
		FFM13MarketOffer O;
		O.Player = CreatePlayer((EFM13Position)Rng.RandRange(0, 3), Basis - 4, Basis + 8, 19, 31);
		O.Player.ContractYears = 3;
		Rng.FRand(); // Reihenfolge des alten Preiswurfs beibehalten
		SetMarketTerms(O);
		Market.Add(O);
	}
	RefreshFreeAgents();
	RefreshLoanables();
}

bool FFM13World::BuyPlayer(int32 MarketIndex, FString& OutReason)
{
	if (!Market.IsValidIndex(MarketIndex)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	if (Squad.Num() >= FM13::MaxSquadSize) { OutReason = TEXT("Der Kader ist voll (30 Spieler)."); return false; }
	if (!TransferWindowGate(OutReason)) return false;
	FFM13MarketOffer& O = Market[MarketIndex];
	const FFM13MedBefund Befund = EnsureMedical(O);
	if (!FinalizePurchase(O.Player, O.Price, O.Player.Wage, 0, Befund, O.SellerClub, OutReason)) return false;
	Market.RemoveAt(MarketIndex);
	AddMessage(TEXT("Neuzugang"), Squad.Last().Name + TEXT(" unterschreibt fuer drei Jahre."));
	return true;
}

// ---------- Kredite (js/finances.js: LOAN_TIERS, takeLoanTier, processLoanInstallments, specialRepayLoan) ----------

namespace
{
	struct FKreditStufe { const TCHAR* Key; const TCHAR* Name; int32 Laufzeit; double Zins; };
	const FKreditStufe KreditStufen[3] = {
		{ TEXT("kurz"), TEXT("Kurzfristig"), 10, 0.15 },
		{ TEXT("mittel"), TEXT("Mittelfristig"), 20, 0.10 },
		{ TEXT("lang"), TEXT("Langfristig"), 34, 0.06 },
	};
	const int32 MaxAktiveKredite = 3;   // MAX_ACTIVE_LOANS

	// getCreditRatingInterestModifier(): Bonitaet in Zehnteln (850 = 85)
	double KreditZinsAufschlag(int32 RatingZehntel)
	{
		if (RatingZehntel >= 850) return -0.03;
		if (RatingZehntel >= 600) return 0.0;
		if (RatingZehntel >= 350) return 0.03;
		return 0.07;
	}
}

bool FFM13World::TakeLoanTier(const FString& Key, int64 Amount, FString& OutReason)
{
	if (ActiveLoans.Num() >= MaxAktiveKredite) { OutReason = TEXT("Maximal 3 laufende Kredite gleichzeitig!"); return false; }
	const FKreditStufe* Stufe = nullptr;
	for (const FKreditStufe& S : KreditStufen) if (Key == S.Key) Stufe = &S;
	if (!Stufe || Amount <= 0) { OutReason = TEXT("Bitte einen gueltigen Betrag eingeben!"); return false; }
	const double Zins = FMath::Max(0.02, Stufe->Zins + KreditZinsAufschlag(CreditRatingTenth));
	const int64 Gesamt = FM13Transfers::JsRunden((double)Amount * (1.0 + Zins));   // Math.round(amount * (1 + rate))
	const int64 Rate = (Gesamt + Stufe->Laufzeit - 1) / Stufe->Laufzeit;             // Math.ceil(total / duration)
	Book(TEXT("Kredit: Aufnahme"), Amount);
	FFM13Loan L;
	L.Id = NextLoanId++;
	L.TierName = Stufe->Name;
	L.Principal = Amount;
	L.Installment = Rate;
	L.MatchdaysLeft = Stufe->Laufzeit;
	L.TotalToRepay = Gesamt;
	ActiveLoans.Add(L);
	return true;
}

// Alt-Sofortkredit: flacher Aufschlag von 12 %, freie Rueckzahlung
void FFM13World::TakeLoanLegacy(int64 Amount)
{
	Book(TEXT("Kredit: Soforthilfe"), Amount);
	LoanDebt += FM13Transfers::JsRunden((double)Amount * 1.12);
}

bool FFM13World::PayLoanLegacy(int64 Amount)
{
	if (LoanDebt <= 0 || Money < Amount) return false;
	Book(TEXT("Kredit: Tilgung"), -Amount);
	LoanDebt -= Amount;
	return true;
}

// processLoanInstallments(): jeder Spieltag zieht die Rate, abgelaufene Kredite fallen weg
void FFM13World::ProcessLoanInstallments()
{
	if (ActiveLoans.Num() == 0) return;
	for (FFM13Loan& L : ActiveLoans)
	{
		Book(TEXT("Kredit: Rate"), -L.Installment);
		L.MatchdaysLeft--;
	}
	for (const FFM13Loan& L : ActiveLoans)
		if (L.MatchdaysLeft <= 0)
			AddMessage(TEXT("Kredit zurueckgezahlt"), FString(TEXT("Der Kredit ")) + L.TierName + TEXT(" ist vollstaendig zurueckgezahlt."));
	ActiveLoans.RemoveAll([](const FFM13Loan& L) { return L.MatchdaysLeft <= 0; });
}

// specialRepayLoan(): vorzeitige Komplett-Tilgung zu 85 % der Restschuld
bool FFM13World::SpecialRepayLoan(int32 LoanId, FString& OutReason)
{
	const int32 Idx = ActiveLoans.IndexOfByPredicate([LoanId](const FFM13Loan& L) { return L.Id == LoanId; });
	if (Idx < 0) { OutReason = TEXT("Kredit nicht gefunden."); return false; }
	const FFM13Loan L = ActiveLoans[Idx];
	const int64 Abloese = FM13Transfers::JsRunden((double)(L.Installment * L.MatchdaysLeft) * 0.85);
	if (Money < Abloese) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Abloese); return false; }
	Book(TEXT("Kredit: Sondertilgung"), -Abloese);
	ActiveLoans.RemoveAt(Idx);
	return true;
}

// tickCreditRating(): gute Wirtschaft (Konto im Plus, kein Minus-Streak) bessert die Bonitaet, sonst sinkt sie
void FFM13World::TickCreditRating()
{
	if (Money >= 0 && NegativeStreak == 0) CreditRatingTenth = FMath::Min(1000, CreditRatingTenth + 3);
	else CreditRatingTenth = FMath::Max(100, CreditRatingTenth - 15);
}

// ---------- Festgeld (js/finances.js: openFixedDeposit, tickFixedDeposit) ----------

bool FFM13World::OpenFixedDeposit(int64 Amount, int32 Matchdays, FString& OutReason)
{
	if (bFestgeld) { OutReason = TEXT("Es laeuft bereits eine Festgeldanlage!"); return false; }
	if (Amount <= 0 || Money < Amount) { OutReason = TEXT("Ungueltiger Betrag oder nicht genug Geld!"); return false; }
	// Zinsstufen nach Laufzeit: 3 %, ab 10 Spieltagen 7 %, ab 20 Spieltagen 12 %
	const double Zins = Matchdays >= 20 ? 0.12 : (Matchdays >= 10 ? 0.07 : 0.03);
	Book(TEXT("Festgeld: Anlage"), -Amount);
	Festgeld.Principal = Amount;
	Festgeld.TotalMatchdays = Matchdays;
	Festgeld.MatchdaysLeft = Matchdays;
	Festgeld.Payout = FM13Transfers::JsRunden((double)Amount * (1.0 + Zins));   // Math.round(amount * (1 + rate))
	bFestgeld = true;
	return true;
}

// tickFixedDeposit(): jeder Spieltag zaehlt herunter, bei Ablauf wird ausgezahlt
void FFM13World::TickFixedDeposit()
{
	if (!bFestgeld) return;
	Festgeld.MatchdaysLeft--;
	if (Festgeld.MatchdaysLeft > 0) return;
	Book(TEXT("Festgeld: Auszahlung"), Festgeld.Payout);
	AddMessage(TEXT("Festgeldanlage ausgezahlt!"), FString::Printf(TEXT("Die Festgeldanlage ueber %lld wurde ausgezahlt: %lld."), (long long)Festgeld.Principal, (long long)Festgeld.Payout));
	bFestgeld = false;
}

// tickMoneyHistory(): Kontostand je Spieltag, die letzten 20 bleiben fuer den Verlauf
void FFM13World::TickMoneyHistory()
{
	FFM13MoneyPoint P;
	P.Matchday = Matchday; P.Season = Season; P.Money = Money;
	MoneyHistory.Add(P);
	if (MoneyHistory.Num() > 20) MoneyHistory.RemoveAt(0);
}

// sellPlayer() (js/transfermarket.js): Sofortverkauf zu 80 % des Marktwerts, Beraterprovision
// wird abgezogen, Kader darf nicht unter 11 fallen. Eingespielte Elf: erst der zweite Klick
// (bChemieBestaetigt) verkauft, wie die Warnung im Browserspiel.
bool FFM13World::SellPlayer(int32 PlayerId, FString& OutReason, bool bChemieBestaetigt)
{
	const int32 Idx = Squad.IndexOfByPredicate([PlayerId](const FFM13Player& P) { return P.Id == PlayerId; });
	if (Idx < 0) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (Squad.Num() <= 11) { OutReason = TEXT("Der Kader darf nicht unter 11 Spieler fallen."); return false; }
	const FFM13Player P = Squad[Idx];

	// checkHighChemistryBeforeSale(): nur Startelf, und nur bei mindestens zwei Partnern ab Eingespieltheit 15
	if (!bChemieBestaetigt && StartingEleven().Contains(PlayerId))
	{
		FString Namen;
		int32 Partner = 0;
		for (int32 Oid : StartingEleven())
		{
			if (Oid == PlayerId) continue;
			const int32 A = FMath::Min(PlayerId, Oid), B = FMath::Max(PlayerId, Oid);
			int32 Wert = 0;
			for (int32 k = 0; k < PairA.Num(); ++k) if (PairA[k] == A && PairB[k] == B) { Wert = PairValue[k]; break; }
			if (Wert < 15) continue;
			Partner++;
			if (const FFM13Player* X = FindPlayer(Oid)) Namen += (Namen.IsEmpty() ? TEXT("") : TEXT(", ")) + X->Name;
		}
		if (Partner >= 2)
		{
			OutReason = FString::Printf(TEXT("%s ist stark eingespielt mit %s. Mit dem Bestaetigen-Schalter trotzdem verkaufen."), *P.Name, *Namen);
			return false;
		}
	}

	const int64 Sum = FM13Transfers::JsRunden((double)P.MarketValue * 0.80);   // Math.round(marketValue * 0.80)
	const int64 Provision = AgentFee(P, Sum);                                  // getAgentFee()
	Book(FString(TEXT("Spielerverkauf: ")) + P.Name, Sum - Provision);
	TransferBudget += FM13Transfers::JsRunden((double)Sum * 0.80);             // game.transferBudget += Math.round(sum * 0.8)
	// checkFriendshipDeparture(): der beste Freund verliert Moral und die Freundschaft
	if (P.FriendId != 0)
	{
		if (FFM13Player* Freund = FindPlayer(P.FriendId))
		{
			Freund->Morale = FMath::Max(10, Freund->Morale - 12);
			Freund->FriendId = 0;
			AddMessage(TEXT("Kabinen-Freundschaft zerbrochen"), Freund->Name + TEXT(" ist sichtlich mitgenommen vom Abgang seines besten Freundes ") + P.Name + TEXT(" - die Moral leidet kurzzeitig."));
		}
	}
	Squad.RemoveAt(Idx);
	ManualLineup.RemoveAll([PlayerId](int32 Id) { return Id == PlayerId; });
	IncomingOffers.RemoveAll([PlayerId](const FFM13IncomingOffer& O) { return !O.bYouth && O.PlayerId == PlayerId; });
	return true;
}

// checkInsolvencyRisk() (js/finances.js): jeden Spieltag nach den Finanzen. Ein Tag im Minus
// zaehlt hoch, ab 3 gibt es eine Warnung, ab 6 die Transfersperre (bis das Konto wieder im Plus ist),
// alle 10 Tage ein Zwangsverkauf des teuersten Spielers (60 % Marktwert), alle 15 Tage 3 Punkte Abzug.
void FFM13World::CheckInsolvencyRisk()
{
	if (Money < 0) NegativeStreak++;
	else { NegativeStreak = 0; bInsolvenzEmbargo = false; return; }
	const int32 Streak = NegativeStreak;

	if (Streak == 3)
		AddMessage(TEXT("Finanzwarnung"), TEXT("Der Vorstand beobachtet die andauernden roten Zahlen mit wachsender Sorge."));
	if (Streak == 6 && !bInsolvenzEmbargo)
	{
		bInsolvenzEmbargo = true;
		AddMessage(TEXT("Transfersperre verhaengt"), TEXT("Wegen anhaltender Zahlungsprobleme verhaengt der Vorstand eine Transfersperre, bis das Konto wieder im Plus ist."));
	}
	if (Streak > 0 && Streak % 10 == 0 && Squad.Num() > 11)
	{
		// hoechster Marktwert; bei Gleichstand gewinnt der Erste in der Kaderreihenfolge (stabile Sortierung)
		int32 Bester = -1;
		for (int32 i = 0; i < Squad.Num(); ++i) if (Bester < 0 || Squad[i].MarketValue > Squad[Bester].MarketValue) Bester = i;
		if (Bester >= 0)
		{
			const FFM13Player P = Squad[Bester];
			const int64 Wert = FM13Transfers::JsRunden((double)P.MarketValue * 0.60);   // ohne Steuerberater, ohne Krisenfest-Perk
			Squad.RemoveAt(Bester);
			ManualLineup.RemoveAll([&P](int32 Id) { return Id == P.Id; });
			Book(FString(TEXT("Zwangsverkauf: ")) + P.Name, Wert);
			ForcedSalesCount++;
			AddMessage(TEXT("Zwangsverkauf!"), FString::Printf(TEXT("Der Vorstand hat %s notgedrungen fuer %lld verkauft (unter Marktwert)."), *P.Name, (long long)Wert));
		}
	}
	if (Streak > 0 && Streak % 15 == 0 && Leagues.IsValidIndex(LeagueLevel))
	{
		for (FFM13Club& C : Leagues[LeagueLevel].Clubs)
		{
			if (!C.bOwn) continue;
			// points = max(0, points - 3): wirksam ist nur, was noch da ist
			C.PointDeduction += FMath::Min(3, FMath::Max(0, C.Points()));
			AddMessage(TEXT("Punktabzug"), TEXT("Wegen anhaltender Zahlungsunfaehigkeit verhaengt der Verband einen Abzug von 3 Punkten."));
		}
	}
}

// ---------- Vertragsgespraeche (js/contracts.js: extendContract, counterContractTalk, acceptContractTalk, checkPlaytimePromises) ----------

// getContractTalkOffer(): Angebot aus Forderung, Garantie (15 Einsaetze, 15 % weniger Gehalt) und Laufzeit
namespace
{
	void TalkAngebot(const FFM13World& W, const FFM13Player& P, const FFM13World::FFM13ContractTalk& T, int64& Gehalt, int64& Handgeld, int64& Berater)
	{
		const bool bStamm = W.StartingEleven().Contains(P.Id);
		const double Garantie = (T.bGarantie && !bStamm) ? 0.85 : 1.0;
		Gehalt = FM13Transfers::JsRunden((double)W.RenewalWage(P) * T.OfferFactor * Garantie / 10.0) * 10;
		Handgeld = W.RenewalSigningFee(P, T.Years);
		Berater = W.AgentFee(P, Handgeld);
	}
}

bool FFM13World::StartContractTalk(int32 PlayerId, FString& OutReason)
{
	const FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (P->TalksBlockedSeason == Season) { OutReason = FString::Printf(TEXT("%s will diese Saison nicht mehr verhandeln."), *P->Name); return false; }
	if (!P->PreSignedClub.IsEmpty()) { OutReason = FString::Printf(TEXT("%s hat schon einen Vorvertrag bei %s unterschrieben - er geht am Saisonende."), *P->Name, *P->PreSignedClub); return false; }
	ContractTalk.bActive = true;
	ContractTalk.PlayerId = PlayerId;
	ContractTalk.Years = P->Age >= 30 ? 1 : 2;
	ContractTalk.OfferFactor = 1.0;
	ContractTalk.bGarantie = false;
	ContractTalk.Rounds = 0;
	return true;
}

bool FFM13World::SetContractTalkYears(int32 Years, FString& OutReason)
{
	if (!ContractTalk.bActive) { OutReason = TEXT("Kein Gespraech offen."); return false; }
	if (Years < 1 || Years > 5) { OutReason = TEXT("Laufzeit 1 bis 5 Jahre."); return false; }
	ContractTalk.Years = Years;
	return true;
}

void FFM13World::ToggleContractTalkGuarantee()
{
	if (ContractTalk.bActive) ContractTalk.bGarantie = !ContractTalk.bGarantie;
}

void FFM13World::CancelContractTalk()
{
	ContractTalk.bActive = false;
}

// counterContractTalk(): Gegenangebot 10 % unter der Forderung. Zaehe Charaktere sagen oefter nein.
// Der Wurf kommt aus der Kennung des Spielers, dem Spieltag und dem Stand des Gespraechs (wie HashEinheit
// bei Beratern), damit der Spielstand reproduzierbar bleibt. Die Chance ist die des Browserspiels.
bool FFM13World::CounterContractTalk(FString& OutReason)
{
	if (!ContractTalk.bActive) { OutReason = TEXT("Kein Gespraech offen."); return false; }
	FFM13Player* P = FindPlayer(ContractTalk.PlayerId);
	if (!P) { ContractTalk.bActive = false; OutReason = TEXT("Spieler nicht im Kader."); return false; }
	const double Zaehigkeit = FM13Poker::Zaehigkeit(P->Character);
	const double Chance = FMath::Clamp(0.7 - (Zaehigkeit - 1.0) * 1.2 - (1.0 - ContractTalk.OfferFactor) * 2.0, 0.1, 0.9);
	const uint32 Salz = (uint32)(Season * 100000 + ContractTalk.Rounds * 1000 + (int32)FMath::RoundToInt((float)(ContractTalk.OfferFactor * 100.0)));
	if (FM13Transfers::HashEinheit(P->Id, Salz) < Chance)
	{
		ContractTalk.OfferFactor = FM13Transfers::JsRunden((ContractTalk.OfferFactor - 0.1) * 100.0) / 100.0;
		OutReason = FString::Printf(TEXT("%s geht auf dein Gegenangebot ein."), *P->Name);
		return true;
	}
	ContractTalk.Rounds++;
	P->Morale = FMath::Max(10, P->Morale - 4);
	if (ContractTalk.Rounds >= 2)
	{
		P->TalksBlockedSeason = Season;
		ContractTalk.bActive = false;
		AddMessage(FString(TEXT("Vertragsgespraeche geplatzt: ")) + P->Name, P->Name + TEXT(" fuehlt sich unterbewertet und will diese Saison nicht mehr ueber einen neuen Vertrag reden."));
		OutReason = FString::Printf(TEXT("%s bricht die Gespraeche ab - erst naechste Saison wieder."), *P->Name);
	}
	else
	{
		OutReason = FString::Printf(TEXT("%s lehnt ab und besteht auf seiner Forderung."), *P->Name);
	}
	return false;
}

// acceptContractTalk(): Handgeld und Beraterprovision werden gebucht, das Gehalt gilt ab sofort
bool FFM13World::AcceptContractTalk(FString& OutReason)
{
	if (!ContractTalk.bActive) { OutReason = TEXT("Kein Gespraech offen."); return false; }
	FFM13Player* P = FindPlayer(ContractTalk.PlayerId);
	if (!P) { ContractTalk.bActive = false; OutReason = TEXT("Spieler nicht im Kader."); return false; }
	int64 Gehalt = 0, Handgeld = 0, Berater = 0;
	TalkAngebot(*this, *P, ContractTalk, Gehalt, Handgeld, Berater);
	const int64 Kosten = Handgeld + Berater;
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Handgeld nicht gedeckt: %lld noetig."), (long long)Kosten); return false; }
	if (!FitsWageBudget(Gehalt - P->Wage)) { OutReason = FString::Printf(TEXT("Gehaltsbudget reicht nicht (%lld pro Spieltag)."), (long long)WageBudget); return false; }
	Book(TEXT("Handgeld und Berater: ") + P->Name, -Kosten);
	const bool bStamm = StartingEleven().Contains(P->Id);
	P->Wage = (int32)Gehalt;
	P->ContractYears += ContractTalk.Years;
	if (ContractTalk.bGarantie && !bStamm) { P->PlaytimeSeason = Season + 1; P->PlaytimeMinApps = 15; }
	P->Morale = FMath::Min(100, P->Morale + 5);
	OutReason = FString::Printf(TEXT("%s verlaengert um %d J. - %lld pro Spieltag."), *P->Name, ContractTalk.Years, (long long)Gehalt);
	ContractTalk.bActive = false;
	return true;
}

// checkPlaytimePromises(): am Saisonende zaehlt die Einsatzgarantie; wer sie verfehlt, verliert 20 Moral
void FFM13World::CheckPlaytimePromises()
{
	for (FFM13Player& P : Squad)
	{
		if (P.PlaytimeSeason != Season) continue;
		if (P.Appearances < P.PlaytimeMinApps)
		{
			P.Morale = FMath::Max(10, P.Morale - 20);
			AddMessage(FString(TEXT("Einsatzgarantie gebrochen: ")) + P.Name, FString::Printf(TEXT("%s kam nur auf %d statt der zugesagten %d Einsaetze und ist schwer enttaeuscht."), *P.Name, P.Appearances, P.PlaytimeMinApps));
		}
		P.PlaytimeSeason = 0;
		P.PlaytimeMinApps = 0;
	}
}

// ---------- Ausstiegsklauseln (js/contracts.js: setReleaseClause, removeReleaseClause, checkReleaseClauseTriggers) ----------

namespace
{
	const TCHAR* const InternationalClubNames[] = {
		TEXT("Real Madriz"),
		TEXT("FC Barcalona"),
		TEXT("Atletico Madriz"),
		TEXT("FC Sevillia"),
		TEXT("Valencia CFF"),
		TEXT("Real Betiss"),
		TEXT("Manchester Unitad"),
		TEXT("Manchester Cyty"),
		TEXT("Liverpol FC"),
		TEXT("Chelsea FC London"),
		TEXT("Arsenall London"),
		TEXT("Tottenham Hotspurr"),
		TEXT("Juwentus Turin"),
		TEXT("AC Millan"),
		TEXT("Inter Milano"),
		TEXT("SSC Neapell"),
		TEXT("AS Romm"),
		TEXT("Lazio Romm"),
		TEXT("Paris St. Germaine"),
		TEXT("Olympique Marseile"),
		TEXT("Olympique Lyonn"),
		TEXT("AS Monakko"),
		TEXT("Ajax Amsterdaam"),
		TEXT("PSV Eindhofen"),
		TEXT("Feyenoordt Rotterdam"),
		TEXT("FC Porto Portugal"),
		TEXT("Benfika Lissabon"),
		TEXT("Sporting Lissabonn"),
		TEXT("Club Bruggge"),
		TEXT("Celtic Glasgoww"),
		TEXT("Galatasaray Istanbull"),
		TEXT("Fenerbahce Istanbull"),
		TEXT("Roter Stern Belgratt"),
		TEXT("Schachtar Donezkk"),
		TEXT("Zenit St. Petersborg"),
		TEXT("RB Salzborg"),
		TEXT("Rapid Wienn"),
		TEXT("FC Baselll"),
		TEXT("Young Boys Bernn")
	};
	const int32 InternationalClubNameCount = 39;
}

// setReleaseClause(): mindestens 110 % des Marktwerts; bis 130 % freut sich der Spieler (Moral +6)
bool FFM13World::SetReleaseClause(int32 PlayerId, int64 Amount, FString& OutReason)
{
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	const int64 Minimum = FM13Transfers::JsRunden((double)P->MarketValue * 1.1);
	if (Amount < Minimum) { OutReason = FString::Printf(TEXT("Mindestbetrag: %lld (110 Prozent des Marktwerts)!"), (long long)Minimum); return false; }
	P->ReleaseClause = Amount;
	if ((double)Amount / (double)P->MarketValue <= 1.3) P->Morale = FMath::Min(100, P->Morale + 6);
	OutReason = FString::Printf(TEXT("Ausstiegsklausel fuer %s auf %lld festgelegt."), *P->Name, (long long)Amount);
	return true;
}

bool FFM13World::RemoveReleaseClause(int32 PlayerId, FString& OutReason)
{
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	P->ReleaseClause = 0;
	OutReason = FString::Printf(TEXT("Ausstiegsklausel fuer %s entfernt."), *P->Name);
	return true;
}

// checkReleaseClauseTriggers(): jeden Spieltag. Die Chance sinkt mit der Klausel, steigt mit der Staerke.
// Der Wurf kommt aus Kennung und Spieltag (HashEinheit), damit kein eigener Zufallsstrom fuer diesen Schritt noetig ist.
void FFM13World::CheckReleaseClauseTriggers()
{
	for (int32 i = Squad.Num() - 1; i >= 0; --i)
	{
		const FFM13Player P = Squad[i];
		if (P.ReleaseClause <= 0) continue;
		const double Basis = 0.008 * ((double)P.Strength / 60.0);
		const double Verhaeltnis = (double)P.ReleaseClause / (double)P.MarketValue;
		const double Chance = Basis / FMath::Max(1.0, Verhaeltnis - 0.8);
		const uint32 Salz = (uint32)(Season * 1000 + Matchday);
		if (FM13Transfers::HashEinheit(P.Id, Salz) >= Chance) continue;
		const int32 Wahl = FMath::Min(InternationalClubNameCount - 1, (int32)(FM13Transfers::HashEinheit(P.Id, Salz + 500) * InternationalClubNameCount));
		const FString Kaeufer = InternationalClubNames[Wahl];
		Book(FString(TEXT("Ausstiegsklausel: ")) + P.Name, P.ReleaseClause);
		Squad.RemoveAt(i);
		ManualLineup.RemoveAll([&P](int32 Id) { return Id == P.Id; });
		AddMessage(FString(TEXT("Ausstiegsklausel ausgeloest: ")) + P.Name,
			Kaeufer + TEXT(" hat die Ausstiegsklausel von ") + P.Name + TEXT(" gezogen und sofort ") + FString::Printf(TEXT("%lld"), (long long)P.ReleaseClause) + TEXT(" ueberwiesen - der Spieler verlaesst den Verein augenblicklich."));
	}
}

// ---------- Weiterverkaufsbeteiligung (js/transfermarket.js: acceptTransferOfferWithClause, checkSellOnClausePayouts) ----------

// Der kaufende Verein zahlt 6 % weniger sofort; dafuer bekommt der Verein 15 % von jedem spaeteren Weiterverkauf
bool FFM13World::AcceptIncomingOfferWithSellOn(int32 Index, FString& OutReason)
{
	if (!IncomingOffers.IsValidIndex(Index)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	const FFM13IncomingOffer O = IncomingOffers[Index];
	const int64 Preis = FM13Transfers::JsRunden((double)O.Price * 0.94);   // Math.round(offer.currentBid * 0.94)
	IncomingOffers[Index].Price = Preis;
	if (!AcceptIncomingOffer(Index, OutReason)) return false;
	FFM13SellOn K;
	K.PlayerName = O.PlayerName;
	K.BuyingClub = O.Club;
	K.Percent = 15;
	K.OriginalSaleValue = Preis;
	SellOnClauses.Add(K);
	OutReason = FString::Printf(TEXT("%s wechselt fuer %lld zu %s - dazu 15 Prozent von jedem kuenftigen Weiterverkauf."), *K.PlayerName, (long long)Preis, *K.BuyingClub);
	return true;
}

// checkSellOnClausePayouts(): jeden Spieltag mit 1,5 % Chance je Klausel. Der Weiterverkaufswert liegt
// zwischen dem 1,3- und dem 2,5-fachen des Verkaufspreises; die Beteiligung wird sofort gezahlt.
void FFM13World::CheckSellOnClausePayouts()
{
	for (int32 i = SellOnClauses.Num() - 1; i >= 0; --i)
	{
		const FFM13SellOn K = SellOnClauses[i];
		const int32 Kennung = (int32)(K.OriginalSaleValue % 1000003) + i * 7919;
		const uint32 Salz = (uint32)(Season * 1000 + Matchday);
		if (FM13Transfers::HashEinheit(Kennung, Salz) >= 0.015) continue;
		const double Faktor = 1.3 + 1.2 * FM13Transfers::HashEinheit(Kennung, Salz + 1);
		const int64 Weiterverkauf = FM13Transfers::JsRunden((double)K.OriginalSaleValue * Faktor);
		const int64 Auszahlung = FM13Transfers::JsRunden((double)Weiterverkauf * (double)K.Percent / 100.0);
		Book(FString(TEXT("Weiterverkaufsbeteiligung: ")) + K.PlayerName, Auszahlung);
		AddMessage(TEXT("Weiterverkaufsbeteiligung ausgezahlt!"),
			K.BuyingClub + TEXT(" hat ") + K.PlayerName + FString::Printf(TEXT(" fuer %lld weiterverkauft - deine %d-Prozent-Beteiligung: %lld!"), (long long)Weiterverkauf, K.Percent, (long long)Auszahlung));
		SellOnClauses.RemoveAt(i);
	}
}

// ---------- Stadion-Daten (js/stadium.js: stadium.blocks, bonusCapacity, total; js/finances.js: ticketPrices) ----------

// Startstadion wie im Browserspiel (js/state.js): zehn Blöcke, 15.550 Plätze, Preise 12/24/80/90 Euro
void FFM13World::ResetStadiumBlocks()
{
	StadiumBlocks.Reset();
	auto Add = [this](const TCHAR* Key, const TCHAR* Name, int32 Cap, int32 Seats, int64 Cost)
	{
		FFM13StadiumBlock B;
		B.Key = Key; B.Name = Name; B.Cap = Cap; B.AddSeats = Seats; B.Cost = Cost;
		StadiumBlocks.Add(B);
	};
	Add(TEXT("haupt"), TEXT("Nord-Unterrang"), 2000, 500, 8000000);
	Add(TEXT("hauptNord"), TEXT("Nord-Oberrang"), 1500, 500, 7000000);
	Add(TEXT("kurve"), TEXT("Suedtribuene (Ultras)"), 3000, 1000, 6500000);
	Add(TEXT("suedOber"), TEXT("Sued-Oberrang"), 1500, 500, 7000000);
	Add(TEXT("gegen"), TEXT("Ost-Gegengerade"), 3000, 1000, 10500000);
	Add(TEXT("west"), TEXT("West-Haupttribuene"), 2000, 500, 9000000);
	Add(TEXT("vipLogen"), TEXT("VIP-Logen"), 50, 25, 4500000);
	Add(TEXT("gaeste"), TEXT("Gaeste-Block"), 1500, 500, 4000000);
	Add(TEXT("familie"), TEXT("Familienblock"), 800, 300, 3500000);
	Add(TEXT("presse"), TEXT("Presse-Tribuene"), 200, 100, 3000000);
	BonusCapacity = 0;
	TicketSteh = 12; TicketSitz = 24; TicketVip = 80; TicketDauerkarte = 90;
	StehShare = 0.5; SitzShare = 0.45; VipShare = 0.05;
}

// stadium.total: Summe der Blockplätze plus Zusatzplätze
int32 FFM13World::StadiumTotal() const
{
	int64 Summe = BonusCapacity;
	for (const FFM13StadiumBlock& B : StadiumBlocks) Summe += B.Cap;
	return (int32)Summe;
}

// stadium.vipTotal: die VIP-Logen (50, wenn der Block fehlt)
int32 FFM13World::VipTotal() const
{
	for (const FFM13StadiumBlock& B : StadiumBlocks) if (B.Key == TEXT("vipLogen")) return B.Cap;
	return 50;
}

// getMarketTicketPrice(): Marktpreis je Kategorie, skaliert mit dem Ligafaktor (1 + (4 - Liga) x 0,25)
int64 FFM13World::MarketTicketPrice(const FString& Kategorie) const
{
	int64 Basis = 12;
	if (Kategorie == TEXT("sitz")) Basis = 24;
	else if (Kategorie == TEXT("vip")) Basis = 80;
	else if (Kategorie == TEXT("dauerkarte")) Basis = 90;
	const double Faktor = (4.0 - (double)FMath::Clamp(LeagueLevel, 0, 5)) * 0.25 + 1.0;
	return FM13Transfers::JsRunden((double)Basis * Faktor);
}

// Mittlerer Ticketpreis aus den Kategorien und ihren Anteilen (Eingang fuer die Zuschauerformel)
int32 FFM13World::TicketAverage() const
{
	return (int32)FM13Transfers::JsRunden((double)TicketSteh * StehShare + (double)TicketSitz * SitzShare + (double)TicketVip * VipShare);
}

// Einnahmen eines Heimspiels nach Kategorie (matchRevenue in js/finances.js): Stehplaetze, Sitzplaetze, VIP begrenzt auf die Logen
int64 FFM13World::TicketRevenue(int32 Att) const
{
	const int64 Steh = FM13Transfers::JsRunden((double)Att * StehShare);
	const int64 Sitz = FM13Transfers::JsRunden((double)Att * SitzShare);
	const int64 Vip = FMath::Min<int64>(VipTotal(), FM13Transfers::JsRunden((double)Att * VipShare));
	return Steh * TicketSteh + Sitz * TicketSitz + Vip * TicketVip;
}

// updateTicketPriceSlider()/getTicketSliderRange(): je Kategorie von 35 % bis 400 % des Marktpreises
bool FFM13World::SetTicketPrices(int64 Steh, int64 Sitz, int64 Vip, FString& OutReason)
{
	const TCHAR* Namen[3] = { TEXT("Stehplatz"), TEXT("Sitzplatz"), TEXT("VIP") };
	const TCHAR* Kat[3] = { TEXT("steh"), TEXT("sitz"), TEXT("vip") };
	const int64 Werte[3] = { Steh, Sitz, Vip };
	for (int32 i = 0; i < 3; ++i)
	{
		const int64 Markt = MarketTicketPrice(Kat[i]);
		const int64 Min = FMath::Max<int64>(1, FM13Transfers::JsRunden((double)Markt * 0.35));
		const int64 Max = FM13Transfers::JsRunden((double)Markt * 4.0);
		if (Werte[i] < Min || Werte[i] > Max)
		{
			OutReason = FString::Printf(TEXT("%s: erlaubt sind %lld bis %lld Euro."), Namen[i], (long long)Min, (long long)Max);
			return false;
		}
	}
	TicketSteh = Steh; TicketSitz = Sitz; TicketVip = Vip;
	return true;
}

bool FFM13World::SetTicketPrice(int32 Price, FString& OutReason)
{
	return SetTicketPrices(Price, TicketSitz, TicketVip, OutReason);   // UE-Schnittstelle: nur der Stehplatzpreis
}

// ---------- Baustellen des Stadions (js/stadium.js: queueStadiumConstruction, tickStadiumConstruction, expandBlock, upgradeBlockInfra) ----------

namespace
{
	// STADIUM_COST_SCALE (js/stadium.js): Kostenfaktor je Liga
	double StadionKostenFaktor(int32 Liga)
	{
		static const double Faktor[6] = { 1.0, 0.55, 0.28, 0.14, 0.07, 0.035 };
		return Faktor[FMath::Clamp(Liga, 0, 5)];
	}
}

// getConstructionDays(): mindestens 10 Spieltage, je 400.000 Euro ein weiterer Tag
int32 FFM13World::BauTage(int64 Kosten) const
{
	return FMath::Max(10, (int32)FM13Transfers::JsRunden((double)Kosten / 400000.0));
}

// Kosten der naechsten Rangerweiterung (selectStadiumBlock): Blockkosten x (Ausbaustufe + 1) x Liga-Faktor
int64 FFM13World::BlockAusbauKosten(const FFM13StadiumBlock& B) const
{
	return FM13Transfers::JsRunden((double)B.Cost * (double)(B.Expansions + 1) * StadionKostenFaktor(LeagueLevel));
}

// Komfortausbau (Fressbude, Merch-Stand, Toiletten): 15.000 / 12.000 / 10.000 Euro x Liga-Faktor x 20, mindestens 50.000 / 40.000 / 35.000
int64 FFM13World::KomfortKosten(int32 Art) const
{
	const double Skala = StadionKostenFaktor(LeagueLevel);
	const double Basis[3] = { 15000.0, 12000.0, 10000.0 };
	const int64 Mindest[3] = { 50000, 40000, 35000 };
	return FMath::Max<int64>(Mindest[Art], FM13Transfers::JsRunden(Basis[Art] * Skala * 20.0));
}

// Eine Baustelle eroeffnen: voll bezahlt beim Auftrag, Effekt erst nach der Bauzeit (queueStadiumConstruction)
bool FFM13World::StarteBaustelle(FFM13StadiumBaustelle Auftrag, const FString& Name, FString& OutReason)
{
	for (const FFM13StadiumBaustelle& B : StadiumBaustellen)
		if (B.Typ == Auftrag.Typ && B.Block == Auftrag.Block && B.Infra == Auftrag.Infra)
		{
			OutReason = TEXT("Fuer diese Anlage laeuft bereits eine Baustelle!");
			return false;
		}
	if (Money < Auftrag.Kosten)
	{
		OutReason = FString::Printf(TEXT("Baukosten nicht gedeckt: %lld auf dem Konto, %lld noetig."), (long long)Money, (long long)Auftrag.Kosten);
		return false;
	}
	Book(TEXT("Stadionausbau"), -Auftrag.Kosten);
	Auftrag.TageRest = BauTage(Auftrag.Kosten);
	Auftrag.Gesamttage = Auftrag.TageRest;
	StadiumBaustellen.Add(Auftrag);
	AddMessage(FString(TEXT("Bauprojekt gestartet: ")) + Name, FString::Printf(TEXT("%lld wurden vollstaendig bezahlt. Fertigstellung in %d Spieltagen."), (long long)Auftrag.Kosten, Auftrag.Gesamttage));
	return true;
}

// expandBlock(): der Block bekommt seine Zusatzplaetze nach der Bauzeit; hoechstens 5 Ausbaustufen je Block
bool FFM13World::ExpandBlock(const FString& Key, FString& OutReason)
{
	FFM13StadiumBlock* B = nullptr;
	for (FFM13StadiumBlock& K : StadiumBlocks) if (K.Key == Key) B = &K;
	if (!B) { OutReason = TEXT("Dieser Block gibt es nicht."); return false; }
	if (B->Expansions >= 5) { OutReason = TEXT("Dieser Block hat die maximale Ausbaustufe erreicht."); return false; }
	FFM13StadiumBaustelle Auftrag;
	Auftrag.Typ = 0;
	Auftrag.Block = Key;
	Auftrag.Seats = B->AddSeats;
	Auftrag.Kosten = BlockAusbauKosten(*B);
	return StarteBaustelle(Auftrag, FString(TEXT("Rangerweiterung ")) + B->Name, OutReason);
}

// upgradeBlockInfra(): Fressbude (0), Merch-Stand (1), Toiletten (2), hoechstens Stufe 3
bool FFM13World::UpgradeBlockInfra(const FString& Key, int32 Art, FString& OutReason)
{
	FFM13StadiumBlock* B = nullptr;
	for (FFM13StadiumBlock& K : StadiumBlocks) if (K.Key == Key) B = &K;
	if (!B) { OutReason = TEXT("Dieser Block gibt es nicht."); return false; }
	const int32 Stufe = Art == 0 ? B->FoodLvl : (Art == 1 ? B->MerchLvl : B->ToiletLvl);
	if (Stufe >= 3) { OutReason = TEXT("Maximalstufe erreicht - hier ist kein weiterer Ausbau moeglich."); return false; }
	FFM13StadiumBaustelle Auftrag;
	Auftrag.Typ = 1;
	Auftrag.Block = Key;
	Auftrag.Infra = Art;
	Auftrag.Kosten = KomfortKosten(Art);
	const TCHAR* Namen[3] = { TEXT("Fressbude"), TEXT("Merch-Stand"), TEXT("Toiletten") };
	return StarteBaustelle(Auftrag, FString(B->Name) + TEXT(": ") + Namen[Art], OutReason);
}

// tickStadiumConstruction(): jeden Spieltag zaehlen die Baustellen herunter, fertige wirken sofort
void FFM13World::TickStadiumConstruction()
{
	for (int32 i = StadiumBaustellen.Num() - 1; i >= 0; --i)
	{
		FFM13StadiumBaustelle& P = StadiumBaustellen[i];
		P.TageRest--;
		if (P.TageRest > 0) continue;
		if (P.Typ == 2) bFlutlicht = true;
		for (FFM13StadiumBlock& B : StadiumBlocks)
		{
			if (B.Key != P.Block) continue;
			if (P.Typ == 0) { B.Cap += P.Seats; B.Expansions++; }
			else if (P.Infra == 0) B.FoodLvl = FMath::Min(3, B.FoodLvl + 1);
			else if (P.Infra == 1) B.MerchLvl = FMath::Min(3, B.MerchLvl + 1);
			else B.ToiletLvl = FMath::Min(3, B.ToiletLvl + 1);
		}
		AddMessage(TEXT("Bauprojekt fertig"), FString(TEXT("Fertig: ")) + P.Block + TEXT("."));
		StadiumBaustellen.RemoveAt(i);
	}
}

// ---------- DFB-Lizenz (js/stadium.js: DFB_LICENSING_REQUIREMENTS, checkDfbLicensingStatus, getLicenceBuildsInProgress) ----------

namespace
{
	// Anforderungen je Liga (Ziel = naechsthoehere Liga): Kapazitaet, Flutlicht, Finanzreserve, Jugendinternat
	struct FLizenzBedingung { int32 MinKapazitaet; bool bFlutlicht; int64 MinReserve; int32 MinInternat; };
	const FLizenzBedingung LizenzBedingungen[6] = {
		{ 15000, true, 500000, 2 },   // 1. Bundesliga
		{ 10000, true, 250000, 1 },   // 2. Bundesliga
		{ 6000, true, 100000, 0 },    // 3. Liga
		{ 3000, false, 30000, 0 },    // Regionalliga
		{ 1000, false, 0, 0 },        // Oberliga
		{ 0, false, 0, 0 },           // Landesliga
	};
}

// Kapazitaetsplaetze, die gerade im Bau sind (Rangerweiterungen zaehlen als Auflage im Bau)
int32 FFM13World::BauPlaetze() const
{
	int32 Summe = 0;
	for (const FFM13StadiumBaustelle& P : StadiumBaustellen) if (P.Typ == 0) Summe += P.Seats;
	return Summe;
}

// checkDfbLicensingStatus(): welche Auflagen fuer die naechste Liga fehlen; Auflagen im Bau gelten als erfuellbar
FFM13World::FFM13LizenzStatus FFM13World::DfbLicensingStatus() const
{
	FFM13LizenzStatus S;
	if (LeagueLevel <= 0) return S;
	S.ZielLiga = LeagueLevel - 1;
	const FLizenzBedingung& Req = LizenzBedingungen[FMath::Clamp(S.ZielLiga, 0, 5)];
	const int32 Bau = BauPlaetze();
	const int32 Kap = StadiumTotal();
	auto Pruefe = [&S](bool bAktiv, bool bErfuellt, bool bImBau, const FString& Text)
	{
		if (!bAktiv) return;
		S.Gesamt++;
		if (bErfuellt || bImBau) S.Erfuellt++;
		if (!bErfuellt && bImBau) S.Auflagen.Add(Text + TEXT(" (im Bau)"));
		else if (!bErfuellt) S.Fehlend.Add(Text);
	};
	Pruefe(Req.MinKapazitaet > 0, Kap >= Req.MinKapazitaet, Kap + Bau >= Req.MinKapazitaet,
		FString::Printf(TEXT("Stadionkapazitaet: %d / %d"), Kap, Req.MinKapazitaet));
	Pruefe(Req.bFlutlicht, bFlutlicht, FlutlichImBau(), TEXT("Flutlichtanlage fehlt"));
	S.MinKapazitaet = Req.MinKapazitaet; S.MinReserve = Req.MinReserve; S.bFlutlichNoetig = Req.bFlutlicht;
	Pruefe(Req.MinReserve > 0, Money >= Req.MinReserve, false,
		FString::Printf(TEXT("Finanzreserve: %lld / %lld"), (long long)Money, (long long)Req.MinReserve));
	// Jugendinternat (Campusgebaeude) ist im Kern noch nicht portiert: Stufe 0
	Pruefe(Req.MinInternat > 0, false, false, FString::Printf(TEXT("Jugendinternat: Stufe 0 / %d"), Req.MinInternat));
	return S;
}

// checkDfbLicenseDeadlines(): jeden Spieltag zaehlt die Nachfrist herunter. Ob der Aufstieg nachtraeglich
// in die Liga eingebaut wird, ist noch offen (die Liga-Tabelle laesst sich waehrend der Saison nicht umbauen).
void FFM13World::TickDfbNachfrist()
{
	if (!DfbNachfrist.bAktiv) return;
	if (DfbLicensingStatus().Fehlend.Num() == 0)
	{
		DfbNachfrist.bAktiv = false;
		AddMessage(TEXT("Nachfrist: Auflagen erfuellt"), TEXT("Die Auflagen sind innerhalb der Nachfrist erfuellt. Der Aufstieg wird fuer diese Saison nicht nachgeholt (nachtraegliche Wertung noch offen)."));
		return;
	}
	DfbNachfrist.Frist--;
	if (DfbNachfrist.Frist <= 0)
	{
		DfbNachfrist.bAktiv = false;
		AddMessage(TEXT("DFB-Nachfrist verstrichen"), TEXT("Die Nachfrist ist ohne Erfolg verstrichen - der Aufstieg verfaellt fuer diese Saison."));
	}
}

// Flutlicht im Bau? (Auflage im Bau gilt als erfuellbar)
bool FFM13World::FlutlichImBau() const
{
	for (const FFM13StadiumBaustelle& P : StadiumBaustellen) if (P.Typ == 2) return true;
	return false;
}

// specialInstall flutlicht (js/stadium.js: getSpecialInstallCost): 3,5 Mio. x Liga-Faktor, auf 10.000 gerundet
bool FFM13World::BuildFlutlicht(FString& OutReason)
{
	if (bFlutlicht) { OutReason = TEXT("Das Flutlicht steht schon."); return false; }
	const double Faktor = FMath::Max(0.2, StadionKostenFaktor(LeagueLevel));
	FFM13StadiumBaustelle Auftrag;
	Auftrag.Typ = 2;
	Auftrag.Block = TEXT("flutlicht");
	Auftrag.Kosten = FM13Transfers::JsRunden(3500000.0 * Faktor / 10000.0) * 10000;
	return StarteBaustelle(Auftrag, TEXT("Flutlicht-Masten"), OutReason);
}

// getContractDemand() (js/contracts.js): Marktgehalt mal Rollenfaktor, Stammspieler unter 31 nehmen keine Kuerzung hin
int32 FFM13World::RenewalWage(const FFM13Player& P) const
{
	const double Markt = (double)FM13Economy::Wage(P.MarketValue, P.Strength);
	const bool bStamm = StartingEleven().Contains(P.Id);
	int32 Staerker = 0;   // Top 3 nach Staerke; bei Gleichstand zaehlt die Kaderreihenfolge (stabile Sortierung)
	for (const FFM13Player& X : Squad)
	{
		if (X.Id == P.Id) break;
		if (X.Strength >= P.Strength) Staerker++;
	}
	bool bNach = false;
	for (const FFM13Player& X : Squad)
	{
		if (X.Id == P.Id) { bNach = true; continue; }
		if (bNach && X.Strength > P.Strength) Staerker++;
	}
	const bool bTop3 = Staerker < 3;
	double Faktor = bTop3 ? 1.25 : (bStamm ? 1.1 : 0.95);
	if (P.Age >= 31) Faktor -= 0.1;
	if (P.Morale < 40) Faktor += 0.1;
	else if (P.Morale >= 80) Faktor -= 0.05;
	const double Untergrenze = (bStamm && P.Age < 31) ? (double)P.Wage : (double)P.Wage * 0.85;
	int64 Gehalt = FM13Transfers::JsRunden(FMath::Max(Untergrenze, Markt * Faktor) / 10.0) * 10;
	if (!P.PreOfferClub.IsEmpty()) Gehalt = FM13Transfers::JsRunden((double)Gehalt * 1.15 / 10.0) * 10;   // er weiss, was er wert ist
	return (int32)Gehalt;
}

// Handgeld je Vertragsjahr: vier Spieltagsgehaelter, mindestens 1.500, auf 100 gerundet (CONTRACT_HANDGELD_MATCHDAYS)
int64 FFM13World::RenewalSigningFee(const FFM13Player& P, int32 Years) const
{
	const int64 ProJahr = FMath::Max<int64>(1500, FM13Transfers::JsRunden((double)RenewalWage(P) * 4.0 / 100.0) * 100);
	return ProJahr * Years;
}

bool FFM13World::RenewContract(int32 PlayerId, int32 Years, FString& OutReason)
{
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (Years < 1 || Years > 5) { OutReason = TEXT("Laufzeit 1 bis 5 Jahre."); return false; }
	if (P->ContractYears >= 3) { OutReason = TEXT("Der Vertrag laeuft noch lange genug."); return false; }
	if (!P->PreSignedClub.IsEmpty()) { OutReason = FString::Printf(TEXT("%s hat schon einen Vorvertrag bei %s unterschrieben."), *P->Name, *P->PreSignedClub); return false; }
	const int32 NeuLohn = RenewalWage(*P);
	const int64 Handgeld = RenewalSigningFee(*P, Years);
	const int64 Kosten = Handgeld + AgentFee(*P, Handgeld);
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Handgeld nicht gedeckt: %lld noetig."), (long long)Kosten); return false; }
	if (!FitsWageBudget(NeuLohn - P->Wage)) { OutReason = TEXT("Die Gehaltserhoehung sprengt das Gehaltsbudget."); return false; }
	Book(FString::Printf(TEXT("Vertragsverlaengerung: %s"), *P->Name), -Kosten);
	P->Wage = NeuLohn;
	P->ContractYears = Years;
	return true;
}

bool FFM13World::PromoteYouth(int32 YouthIndex, FString& OutReason)
{
	if (!YouthTalents.IsValidIndex(YouthIndex)) { OutReason = TEXT("Dieses Talent gibt es nicht."); return false; }
	if (Squad.Num() >= FM13::MaxSquadSize) { OutReason = TEXT("Der Kader ist voll (30 Spieler)."); return false; }
	FFM13Player P = YouthTalents[YouthIndex];
	P.MarketValue = FM13Economy::MarketValue(P.Strength, &Rng);
	P.Wage = FM13Economy::Wage(P.MarketValue, P.Strength);
	if (!FitsWageBudget(P.Wage)) { OutReason = TEXT("Das Gehalt sprengt das Gehaltsbudget des Vorstands."); return false; }
	P.ContractYears = 3;
	// signYouthProContract(): Gehalt mit der Stufe (1 x 0,8, 2 x 1, 3 x 1,3), auf 10 gerundet; Absolvent
	{
		const double Faktor = P.PotentialTier == 1 ? 0.8 : (P.PotentialTier == 3 ? 1.3 : 1.0);
		P.Wage = (int32)(std::floor((double)P.Wage * Faktor / 10.0 + 0.5) * 10.0);
	}
	P.bAcademyGraduate = true;
	P.ProDecisionLeft = 0;
	Squad.Add(P);
	IncomingOffers.RemoveAll([&P](const FFM13IncomingOffer& O) { return O.bYouth && O.PlayerId == P.Id; });
	YouthTalents.RemoveAt(YouthIndex);
	AddMessage(TEXT("Aus der Jugend"), P.Name + TEXT(" rueckt in den Profikader auf."));
	return true;
}

bool FFM13World::ReleaseYouth(int32 YouthIndex, FString& OutReason)
{
	if (!YouthTalents.IsValidIndex(YouthIndex)) { OutReason = TEXT("Dieses Talent gibt es nicht."); return false; }
	const int32 Id = YouthTalents[YouthIndex].Id;
	IncomingOffers.RemoveAll([Id](const FFM13IncomingOffer& O) { return O.bYouth && O.PlayerId == Id; });
	YouthTalents.RemoveAt(YouthIndex);
	return true;
}

// ---------- Verein ----------

bool FFM13World::ExpandStadium(int32 Seats, FString& OutReason)
{
	if (PendingSeatsMatchdays > 0) { OutReason = TEXT("Es laeuft schon ein Ausbau."); return false; }
	if (Seats < 500 || Seats > 20000) { OutReason = TEXT("Ausbau zwischen 500 und 20.000 Plaetzen."); return false; }
	const int64 Kosten = FM13Economy::StadiumExpansionCost(Seats);
	if (Money < Kosten) { OutReason = TEXT("Nicht genug Geld fuer den Ausbau."); return false; }
	Book(TEXT("Stadionausbau"), -Kosten);
	PendingSeats = Seats;
	PendingSeatsMatchdays = FM13Economy::StadiumBuildMatchdays;
	return true;
}

int64 FFM13World::YouthAcademyUpgradeCost() const
{
	return 50000LL * YouthAcademyLevel * YouthAcademyLevel;
}

bool FFM13World::UpgradeYouthAcademy(FString& OutReason)
{
	if (YouthAcademyLevel >= 5) { OutReason = TEXT("Die Jugendakademie ist voll ausgebaut."); return false; }
	const int64 Kosten = YouthAcademyUpgradeCost();
	if (Money < Kosten) { OutReason = TEXT("Nicht genug Geld fuer den Ausbau."); return false; }
	Book(TEXT("Ausbau Jugendakademie"), -Kosten);
	YouthAcademyLevel++;
	return true;
}

void FFM13World::PlanSeason()
{
	// Saisonziel: Platz der eigenen Elf in einer Stärke-Rangliste der Liga, plus zwei Plätze Puffer
	const FFM13League& L = OwnLeague();
	const int32 Eigen = OwnStrength();
	int32 Besser = 0;
	for (const FFM13Club& C : L.Clubs) if (!C.bOwn && C.Strength > Eigen) ++Besser;
	SeasonTarget = FMath::Clamp(Besser + 1 + 2, 1, FM13::TeamsPerLeague - 2);

	// Gehaltsbudget wie js/season-end.js: Liga-Wert x Platzfaktor, mindestens die Untergrenze und im Jahr
	// nach dem Abstieg 90 % der gekuerzten Gehaelter; dazu Ruecklagen ueber der Reserve
	if (LastSeasonRank <= 0)
	{
		// Karrierestart (js/state.js, js/career.js): Liga-Wert; mindestens die laufenden Gehaelter plus 5 % Spielraum
		// (wie getWageBudgetFloor ohne Verlustsaison), sonst waere in der Bundesliga keine Verpflichtung moeglich
		WageBudget = FMath::Max<int64>(LeagueWageBudget(LeagueLevel), (int64)std::ceil((double)WagesPerMatchday() * 1.05 / 1000.0) * 1000);
	}
	else
	{
		const double Platzfaktor = LastSeasonRank <= 4 ? 1.3 : (LastSeasonRank <= 10 ? 1.0 : 0.8);
		const int64 Liga = FM13Transfers::JsRunden((double)LeagueWageBudget(LeagueLevel) * Platzfaktor / 100.0) * 100;
		const int64 Abstieg = (int64)std::ceil((double)RelegationWages * 0.9 / 1000.0) * 1000;
		WageBudget = FMath::Max<int64>(Liga, FMath::Max<int64>(WageBudgetFloor(), Abstieg));
		ApplyCashSurplusBudgets();
		RelegationWages = 0;
	}
	AddMessage(TEXT("Saisonziel"), FString::Printf(TEXT("Der Vorstand erwartet mindestens Platz %d. Gehaltsbudget: %lld Euro pro Spieltag."), SeasonTarget, (long long)WageBudget));
}

void FFM13World::TrainPlayers()
{
	// Training pro Spieltag: Spieler unter ihrem Potenzial machen ab und zu einen Schritt nach vorn,
	// ältere bauen ab. Ein besserer Trainingsplatz erhöht die Chance (vereinfacht js/training.js).
	const float Chance = 0.04f + 0.015f * (float)TrainingLevel;
	for (FFM13Player& P : Squad)
	{
		if (P.InjuredMatchdays > 0) continue;
		if (P.Age <= 27 && P.Strength < P.Potential && Rng.FRand() < Chance) P.Strength++;
		else if (P.Age >= 31 && Rng.FRand() < 0.03f) P.Strength = FMath::Max(1, P.Strength - 1);
	}
}

int64 FFM13World::TrainingUpgradeCost() const
{
	return 40000LL * TrainingLevel * TrainingLevel;
}

bool FFM13World::UpgradeTraining(FString& OutReason)
{
	if (TrainingLevel >= 5) { OutReason = TEXT("Der Trainingsplatz ist voll ausgebaut."); return false; }
	const int64 Kosten = TrainingUpgradeCost();
	if (Money < Kosten) { OutReason = TEXT("Nicht genug Geld fuer den Ausbau."); return false; }
	Book(TEXT("Ausbau Trainingsplatz"), -Kosten);
	TrainingLevel++;
	return true;
}

// ---------- Taktik ----------

bool FFM13World::SetFormation(const FString& Name, FString& OutReason)
{
	for (const FM13Tactics::FFormation& F : FM13Tactics::Formations())
		if (Name == F.Name) { Formation = Name; return true; }
	OutReason = TEXT("Diese Formation gibt es nicht.");
	return false;
}

bool FFM13World::SetTacticStyle(const FString& Key, FString& OutReason)
{
	for (const FM13Tactics::FStyle& St : FM13Tactics::Styles())
		if (Key == St.Key) { TacticStyle = Key; return true; }
	OutReason = TEXT("Diesen Spielstil gibt es nicht.");
	return false;
}

// calcTeamStrength() aus js/match.js: alle Eingaben aus dem Spielstand. Was Unreal noch nicht kennt
// (Kabine, Unterwelt, Fan-Aktionen, Team-Anweisungen, Trainingslager, Spielerrollen), bleibt neutral.
int32 FFM13World::TeamStrength(bool bHome) const
{
	int32 Dummy = 0;
	FM13Strength::FEingabe E;
	for (int32 i : LineupIndices(Dummy))
	{
		const FFM13Player& P = Squad[i];
		FM13Strength::FSpieler S;
		S.Strength = P.Strength; S.Fitness = P.Fitness; S.DailyForm = P.DailyForm; S.Morale = P.Morale; S.Age = P.Age;
		S.Pos = P.Pos; S.Trait = P.Trait; S.bCaptain = CaptainId != 0 && P.Id == CaptainId;
		E.Elf.Add(S);
	}
	static const int32 LizenzBonus[4] = { 0, 1, 2, 4 };
	E.bHome = bHome;
	E.LicenseBoost = LizenzBonus[FMath::Clamp(LicenseLevel, 0, 3)];
	E.bCoTrainer = CoTrainer.bHired; E.CoTrainerLevel = CoTrainer.Level;
	E.CoTrainerWirkung = CoTrainer.Morale >= 70 ? 1.0 : (CoTrainer.Morale >= 40 ? 0.85 : 0.65);
	E.bGreenkeeper = Greenkeeper.bHired; E.GreenkeeperLevel = Greenkeeper.Level; E.bGreenkeeperTempo = Greenkeeper.Task == TEXT("tempo");
	E.bAnalystTiefe = Analyst.bHired && Analyst.Task == TEXT("tiefe"); E.AnalystLevel = Analyst.Level;
	E.bErnaehrungLeistung = Ernaehrungsberater.bHired && Ernaehrungsberater.Task == TEXT("leistung"); E.ErnaehrungLevel = Ernaehrungsberater.Level;
	E.TrainingGround = CampusTrainingGround;
	E.bSynergie = CoTrainer.bHired && Analyst.bHired;
	E.Fans = Fans;
	E.ChemistryBonus = LineupChemistry();
	E.bTactician = bTactician;
	E.WeatherGoalMult = FM13Match::Weathers()[WeatherIndex].GoalMult;
	E.Stress = Stress;
	E.TeamTraining = TeamTraining;
	E.StyleBonus = FM13Tactics::StyleBonus(TacticStyle);
	E.FormationOff = (FM13Tactics::Formation(Formation).Off - 60) * 0.04;
	E.TackleHardness = TackleHardness;
	E.CouncilStabilizer = CouncilStabilizer() * 0.3;
	E.CliqueModifier = CliqueModifier();
	return FM13Strength::Team(E);
}

// Eigene Spiele laufen wie das Livespiel des Browserspiels: der Abwehrwert der Formation zählt zu 60 % mit (js/match-live.js)
double FFM13World::OwnCupStrength(bool bHome) const
{
	return TeamStrength(bHome) + (FM13Tactics::Formation(Formation).Def - 60) * 0.04 * 0.6;
}

int64 FFM13World::PromotionTransferBonus() const
{
	// PROMOTION_BUDGET_SHARE = 0,5 vom Liga-Transferbudget, auf 1.000 gerundet (promotion-boost.js)
	return FM13Transfers::JsRunden((double)LeagueTransferBudget(LeagueLevel) * 0.5 / 1000.0) * 1000;
}

double FFM13World::PromotionEuphoria() const
{
	if (PromotionBoostSeason != Season || PromotionBoostLevel != LeagueLevel) return 0.0;
	return Matchday <= 10 ? 3.0 : (Matchday <= 17 ? 1.5 : 0.0);
}

EFM13Playstyle FFM13World::OwnPlaystyle() const
{
	if (!Leagues.IsValidIndex(LeagueLevel)) return EFM13Playstyle::Ausgeglichen;
	const int32 i = Leagues[LeagueLevel].FindOwn();
	return i >= 0 ? Leagues[LeagueLevel].Clubs[i].Playstyle : EFM13Playstyle::Ausgeglichen;
}

// getOwnLeagueMatchStrength(): Teamstärke, Taktik-Duell, Derby, Vorbereitung, Aufstiegseuphorie; dazu die Ansprache
double FFM13World::OwnMatchStrengthExact(TCHAR OppArchetype, bool bHome) const
{
	double V = OwnCupStrength(bHome) + FM13Tactics::MatchupBonus(TacticStyle, OppArchetype);
	// Vorbereitung, Ansprache, Derby und Euphorie zählen nur im nächsten Ligaspiel (OppArchetype gesetzt)
	if (OppArchetype)
	{
		V += MatchPrepBonus();
		if (!PendingTalk.IsEmpty()) V += TalkBonus(PendingTalk);
		if (IsDerbyNext() && DerbyPrepMatchday == Matchday)
		{
			if (DerbyPreps.Contains(TEXT("stimmung"))) V += 1.5;
			if (DerbyPreps.Contains(TEXT("kampfansage"))) V += 1.0;
		}
		V += PromotionEuphoria();
	}
	return V;
}

int32 FFM13World::OwnMatchStrength(TCHAR OppArchetype) const
{
	bool bHome = true;
	NextLeagueOpponent(&bHome);
	return FMath::RoundToInt((float)OwnMatchStrengthExact(OppArchetype, bHome));
}

// Eingespieltheit (js/match.js): jedes Paar der Startelf sammelt je Spieltag einen Punkt, höchstens 30
void FFM13World::TickPairChemistry()
{
	const TArray<int32> Elf = StartingEleven();
	for (int32 i = 0; i < Elf.Num(); ++i)
		for (int32 j = i + 1; j < Elf.Num(); ++j)
		{
			const int32 A = FMath::Min(Elf[i], Elf[j]), B = FMath::Max(Elf[i], Elf[j]);
			int32 k = 0;
			for (; k < PairA.Num(); ++k) if (PairA[k] == A && PairB[k] == B) break;
			if (k == PairA.Num()) { PairA.Add(A); PairB.Add(B); PairValue.Add(0); }
			PairValue[k] = FMath::Min(30, PairValue[k] + 1);
		}
}

int32 FFM13World::LineupChemistry() const
{
	const TArray<int32> Elf = StartingEleven();
	if (Elf.Num() < 2) return 0;
	int32 Summe = 0, Paare = 0;
	for (int32 i = 0; i < Elf.Num(); ++i)
		for (int32 j = i + 1; j < Elf.Num(); ++j)
		{
			const int32 A = FMath::Min(Elf[i], Elf[j]), B = FMath::Max(Elf[i], Elf[j]);
			for (int32 k = 0; k < PairA.Num(); ++k) if (PairA[k] == A && PairB[k] == B) { Summe += PairValue[k]; break; }
			++Paare;
		}
	return FM13Strength::ChemistryBonus(Summe, Paare);
}

// ensureCaptainPresent() aus js/locker-room.js: fehlt der Kapitän oder ist er verletzt, übernimmt der Spieler
// mit der größten Führungsqualität (Leader, Alter über 26, Einsätze, Moral).
void FFM13World::EnsureCaptain()
{
	if (!Squad.Num()) return;
	for (const FFM13Player& P : Squad) if (P.Id == CaptainId && P.InjuredMatchdays <= 0) return;
	auto Fuehrung = [](const FFM13Player& P)
	{
		return (P.Trait == FM13Strength::Leader ? 30.0 : 0.0) + FMath::Max(0, P.Age - 26) * 2.0
			+ FMath::Min(P.AppearancesTotal, 150) * 0.12 + (P.Morale > 0 ? P.Morale : 50) * 0.15;
	};
	const FFM13Player* Neu = nullptr;
	for (const FFM13Player& P : Squad)
		if (P.InjuredMatchdays <= 0 && (!Neu || Fuehrung(P) > Fuehrung(*Neu))) Neu = &P;
	if (!Neu) Neu = &Squad[0];
	CaptainId = Neu->Id;
	ElectCouncil();
	AddMessage(FString::Printf(TEXT("%s uebernimmt die Binde"), *Neu->Name),
		FString::Printf(TEXT("%s hat die groesste Fuehrungsqualitaet und fuehrt die Mannschaft jetzt als Kapitaen aufs Feld."), *Neu->Name));
}

const FFM13Club* FFM13World::NextLeagueOpponent(bool* OutHome) const
{
	if (!Leagues.IsValidIndex(LeagueLevel)) return nullptr;
	const FFM13League& L = Leagues[LeagueLevel];
	for (const FFM13Fixture& F : L.Fixtures)
	{
		if (F.Matchday != Matchday || F.bPlayed) continue;
		if (L.Clubs[F.Home].bOwn) { if (OutHome) *OutHome = true; return &L.Clubs[F.Away]; }
		if (L.Clubs[F.Away].bOwn) { if (OutHome) *OutHome = false; return &L.Clubs[F.Home]; }
	}
	return nullptr;
}

FString FFM13World::RefereeName() const
{
	return FM13Match::RefereeFor(Season, Matchday, LeagueLevel, ClubName.Len()).Name;
}

void FFM13World::PrepareOppPlan()
{
	// getOppTacticPlan(): wer berechenbar ist (3 von 5 Spielen gleicher Ansatz), gegen den stellt sich
	// der Gegner mit 35 % ein, Teams aus der oberen Tabellenhälfte mit 60 %
	OppPlanArchetype = 0;
	bOppPlanReacted = false;
	const FFM13Club* Opp = NextLeagueOpponent();
	if (!Opp) return;
	const TCHAR Basis = FM13Tactics::AiArchetype(Opp->Playstyle);
	OppPlanArchetype = Basis;
	const TCHAR Lesbar = FM13Tactics::PredictableArchetype(RecentStyles);
	if (!Lesbar) return;
	const FFM13League& L = OwnLeague();
	const int32 Platz = L.RankOf(L.FindClub(Opp->Name));
	const float Chance = 0.35f + (Platz > 0 && Platz <= FM13::TeamsPerLeague / 2 ? 0.25f : 0.f);
	const TCHAR Konter = FM13Tactics::CounterTo(Lesbar);
	if (Konter && Konter != Basis && Rng.FRand() < Chance)
	{
		OppPlanArchetype = Konter;
		bOppPlanReacted = true;
	}
}

void FFM13World::RollCards(FFM13OwnMatchReport& Report, TArray<FString>& OutYellow, TArray<FString>& OutRed)
{
	// Schiedsrichter-Strenge und Wetter wirken auf die Karten (js/referees.js, js/weather.js)
	const float Mult = FM13Match::RefereeFor(Season, Matchday, LeagueLevel, ClubName.Len()).CardMult * (float)FM13Match::Weathers()[WeatherIndex].CardMult;
	const TArray<int32> Elf = StartingEleven();
	if (!Elf.Num()) return;
	const int32 Gelbe = FMath::Min(5, FM13Match::Poisson(Rng, 1.6f * Mult));
	for (int32 k = 0; k < Gelbe; ++k)
	{
		FFM13Player* P = FindPlayer(Elf[Rng.RandRange(0, Elf.Num() - 1)]);
		if (!P) continue;
		P->YellowCards++;
		OutYellow.Add(P->Name);
		if (P->YellowCards % 5 == 0)
		{
			P->SuspendedMatchdays = FMath::Max(P->SuspendedMatchdays, 2); // +1: der Abbau am Ende dieses Spieltags
			Report.Cards.Add(FString::Printf(TEXT("%s: fuenfte Gelbe Karte, 1 Spiel gesperrt"), *P->Name));
		}
	}
	if (Rng.FRand() < 0.04f * Mult)
	{
		FFM13Player* P = FindPlayer(Elf[Rng.RandRange(0, Elf.Num() - 1)]);
		if (P)
		{
			const int32 Spiele = Rng.RandRange(1, 3);
			P->SuspendedMatchdays = FMath::Max(P->SuspendedMatchdays, Spiele + 1);
			OutRed.Add(P->Name);
			Report.Cards.Add(FString::Printf(TEXT("%s: Rote Karte, %d Spiele gesperrt"), *P->Name, Spiele));
			AddMessage(TEXT("Rote Karte"), FString::Printf(TEXT("%s ist fuer %d Spiele gesperrt."), *P->Name, Spiele));
		}
	}
}

// ---------- Sponsor ----------

void FFM13World::MakeSponsorOffers()
{
	// checkIncomingSponsorOffers(): Grundbetrag und Siegprämie nach Liga-Faktor, Laufzeit als Stufe
	struct FStufe { const TCHAR* Name; int32 Spieltage; float Pay; float SignOn; };
	const FStufe Stufen[3] = { { TEXT("kurz"), 17, 1.0f, 0.f }, { TEXT("mittel"), 34, 1.1f, 0.5f }, { TEXT("lang"), 68, 1.2f, 1.f } };
	static const TCHAR* Vorne[] = { TEXT("Nord"), TEXT("Rhein"), TEXT("Metro"), TEXT("City"), TEXT("Regio"), TEXT("Vital"), TEXT("Elektro"), TEXT("Bau"), TEXT("Agrar"), TEXT("Media") };
	static const TCHAR* Hinten[] = { TEXT("Energie"), TEXT("Bank"), TEXT("Bau AG"), TEXT("Logistik"), TEXT("Versicherung"), TEXT("Technik"), TEXT("Finanz"), TEXT("Handel"), TEXT("Werke"), TEXT("Digital") };
	const float Lf = SponsorLeagueFactor[LeagueLevel];
	SponsorOffers.Reset();
	for (const FStufe& St : Stufen)
	{
		FFM13Sponsor O;
		O.Name = FString(Vorne[Rng.RandRange(0, 9)]) + Hinten[Rng.RandRange(0, 9)];
		O.Tier = St.Name;
		O.MatchdaysLeft = St.Spieltage;
		O.Base = FMath::RoundToInt((2000.f + Rng.FRand() * 2500.f) * Lf * St.Pay / 100.f) * 100;
		O.WinBonus = FMath::RoundToInt((800.f + Rng.FRand() * 1500.f) * Lf * St.Pay / 100.f) * 100;
		O.PromotionBonus = FMath::RoundToInt((12000.f + Rng.FRand() * 18000.f) * Lf / 500.f) * 500;
		O.SignOn = St.SignOn > 0.f ? FMath::RoundToInt((float)O.Base * 8.f * St.SignOn / 100.f) * 100 : 0;
		SponsorOffers.Add(O);
	}
	AddMessage(TEXT("Sponsorenangebote"), TEXT("Drei Unternehmen wollen Hauptsponsor werden. Die Angebote stehen unter Verein."));
}

void FFM13World::TickSponsor()
{
	// Ohne Vertrag (auch nach einem Import) liegen immer Angebote bereit
	if (Sponsor.MatchdaysLeft <= 0) { if (!SponsorOffers.Num()) MakeSponsorOffers(); return; }
	Sponsor.MatchdaysLeft--;
	if (Sponsor.MatchdaysLeft == 4 && !SponsorOffers.Num()) MakeSponsorOffers();
	if (Sponsor.MatchdaysLeft == 0)
	{
		AddMessage(TEXT("Sponsorvertrag ausgelaufen"), FString::Printf(TEXT("Der Vertrag mit %s ist beendet. Bis zum naechsten Vertrag zahlt nur ein kleiner Ausruester."), *Sponsor.Name));
		Sponsor.Name = TEXT("Kein Hauptsponsor");
		Sponsor.Base = 500; Sponsor.WinBonus = 200; Sponsor.PromotionBonus = 0; Sponsor.SignOn = 0; Sponsor.Tier = TEXT("");
		if (!SponsorOffers.Num()) MakeSponsorOffers();
	}
}

bool FFM13World::AcceptSponsorOffer(int32 Index, FString& OutReason)
{
	if (!SponsorOffers.IsValidIndex(Index)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	if (Sponsor.MatchdaysLeft > 4) { OutReason = FString::Printf(TEXT("Der Vertrag mit %s laeuft noch %d Spieltage."), *Sponsor.Name, Sponsor.MatchdaysLeft); return false; }
	Sponsor = SponsorOffers[Index];
	SponsorOffers.Reset();
	if (Sponsor.SignOn > 0) Book(TEXT("Sponsor Handgeld"), Sponsor.SignOn);
	AddMessage(TEXT("Neuer Hauptsponsor"), FString::Printf(TEXT("%s zahlt %d Euro pro Spieltag und %d Euro pro Sieg, %d Spieltage lang."), *Sponsor.Name, Sponsor.Base, Sponsor.WinBonus, Sponsor.MatchdaysLeft));
	return true;
}

// ---------- Angebote für eigene Spieler ----------

void FFM13World::TickIncomingOffers()
{
	IncomingOffers.RemoveAll([this](const FFM13IncomingOffer& O) { return O.ExpiresMatchday < Matchday; });
	if (IncomingOffers.Num() >= 4) return;
	auto KiVerein = [this]()
	{
		const int32 L = FMath::Clamp(LeagueLevel - Rng.RandRange(0, 1), 0, FM13::NumLeagues - 1);
		TArray<FString> Namen;
		for (const FFM13Club& C : Leagues[L].Clubs) if (!C.bOwn) Namen.Add(C.Name);
		return Namen.Num() ? Namen[Rng.RandRange(0, Namen.Num() - 1)] : FString(TEXT("KI-Verein"));
	};
	auto SchonAngefragt = [this](int32 Id, bool bYouth) { return IncomingOffers.ContainsByPredicate([Id, bYouth](const FFM13IncomingOffer& O) { return O.PlayerId == Id && O.bYouth == bYouth; }); };

	// Profis: gute Spieler wecken Interesse (transfermarket.js, vereinfacht)
	if (Squad.Num() > FM13::MinSquadSize + 1 && Rng.FRand() < 0.10f)
	{
		const int32 Elf = OwnStrength();
		TArray<int32> Kandidaten;
		for (int32 i = 0; i < Squad.Num(); ++i) if (Squad[i].Strength >= Elf - 6 && !SchonAngefragt(Squad[i].Id, false)) Kandidaten.Add(i);
		if (Kandidaten.Num())
		{
			const FFM13Player& P = Squad[Kandidaten[Rng.RandRange(0, Kandidaten.Num() - 1)]];
			FFM13IncomingOffer O;
			O.PlayerId = P.Id; O.PlayerName = P.Name; O.Club = KiVerein();
			O.Price = FMath::Max<int64>(10000, FMath::RoundToInt64((double)P.MarketValue * (0.85 + Rng.FRand() * 0.55) / 5000.0) * 5000);
			O.ExpiresMatchday = Matchday + 3;
			IncomingOffers.Add(O);
			AddMessage(TEXT("Angebot fuer einen Spieler"), FString::Printf(TEXT("%s bietet %lld Euro fuer %s. Das Angebot gilt 3 Spieltage."), *O.Club, (long long)O.Price, *O.PlayerName));
		}
	}
	// Talente (js/youth-sales.js): KI-Vereine bieten für Akademie-Talente
	if (YouthTalents.Num() && Rng.FRand() < 0.05f)
	{
		const FFM13Player& T = YouthTalents[Rng.RandRange(0, YouthTalents.Num() - 1)];
		if (!SchonAngefragt(T.Id, true))
		{
			FFM13IncomingOffer O;
			O.PlayerId = T.Id; O.bYouth = true; O.PlayerName = T.Name; O.Club = KiVerein();
			const double Wert = (double)FM13Economy::MarketValue(FMath::Max(T.Strength, (T.Strength + T.Potential) / 2), nullptr);
			O.Price = FMath::Max<int64>(25000, FMath::RoundToInt64(Wert * (1.0 + Rng.FRand() * 0.8) / 5000.0) * 5000);
			O.ExpiresMatchday = Matchday + 3;
			IncomingOffers.Add(O);
			AddMessage(TEXT("Angebot fuer ein Talent"), FString::Printf(TEXT("%s bietet %lld Euro fuer das Talent %s."), *O.Club, (long long)O.Price, *O.PlayerName));
		}
	}
}

bool FFM13World::AcceptIncomingOffer(int32 Index, FString& OutReason)
{
	if (!IncomingOffers.IsValidIndex(Index)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	const FFM13IncomingOffer O = IncomingOffers[Index];
	if (O.bYouth)
	{
		const int32 i = YouthTalents.IndexOfByPredicate([&O](const FFM13Player& P) { return P.Id == O.PlayerId; });
		if (i < 0) { OutReason = TEXT("Das Talent ist nicht mehr im Verein."); IncomingOffers.RemoveAt(Index); return false; }
		YouthTalents.RemoveAt(i);
		Book(FString::Printf(TEXT("Talentverkauf an %s: %s"), *O.Club, *O.PlayerName), O.Price);
	}
	else
	{
		const int32 i = Squad.IndexOfByPredicate([&O](const FFM13Player& P) { return P.Id == O.PlayerId; });
		if (i < 0) { OutReason = TEXT("Der Spieler ist nicht mehr im Verein."); IncomingOffers.RemoveAt(Index); return false; }
		if (Squad.Num() <= FM13::MinSquadSize) { OutReason = TEXT("Mindestens 16 Spieler muessen bleiben."); return false; }
		// completeOfferSale(): der Berater kassiert, ins Transferbudget fliessen 85 % des Erloes
		const int64 Provision = AgentFee(Squad[i], O.Price);
		Book(FString::Printf(TEXT("Verkauf an %s: %s"), *O.Club, *O.PlayerName), O.Price - Provision);
		TransferBudget += FM13Transfers::JsRunden((double)O.Price * 0.85);
		Squad.RemoveAt(i);
	}
	Records.RecordTransferFee = FMath::Max(Records.RecordTransferFee, O.Price);
	IncomingOffers.RemoveAll([&O](const FFM13IncomingOffer& X) { return X.PlayerId == O.PlayerId && X.bYouth == O.bYouth; });
	AddMessage(TEXT("Verkauf"), FString::Printf(TEXT("%s wechselt fuer %lld Euro zu %s."), *O.PlayerName, (long long)O.Price, *O.Club));
	return true;
}

bool FFM13World::DeclineIncomingOffer(int32 Index, FString& OutReason)
{
	if (!IncomingOffers.IsValidIndex(Index)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	IncomingOffers.RemoveAt(Index);
	return true;
}

// ---------- Rekorde und Erfolge ----------

void FFM13World::UpdateRecords(int32 OwnGoals, int32 OppGoals, const FString& Opp, int32 Attendance)
{
	Records.UnbeatenStreak = OwnGoals >= OppGoals ? Records.UnbeatenStreak + 1 : 0;
	Records.LongestUnbeatenStreak = FMath::Max(Records.LongestUnbeatenStreak, Records.UnbeatenStreak);
	const int32 Diff = OwnGoals - OppGoals;
	const int32 Alt = Records.BiggestWinFor - Records.BiggestWinAgainst;
	if (Diff > 0 && (Diff > Alt || (Diff == Alt && OwnGoals > Records.BiggestWinFor)))
	{
		Records.BiggestWinFor = OwnGoals; Records.BiggestWinAgainst = OppGoals;
		Records.BiggestWinOpponent = Opp; Records.BiggestWinSeason = Season;
	}
	if (Attendance > Records.RecordAttendance)
	{
		if (Records.RecordAttendance > 0) AddMessage(TEXT("Zuschauerrekord"), FString::Printf(TEXT("%d Zuschauer, so viele wie nie."), Attendance));
		Records.RecordAttendance = Attendance;
	}
}

namespace
{
	struct FErfolg { const TCHAR* Id; const TCHAR* Label; };
	const FErfolg Erfolge[] = {
		{ TEXT("millionaer"), TEXT("Millionaer: Vereinskonto 1 Mio. Euro") },
		{ TEXT("multimillionaer"), TEXT("Multimillionaer: Vereinskonto 10 Mio. Euro") },
		{ TEXT("aufstieg"), TEXT("Aufsteiger: erster Aufstieg") },
		{ TEXT("bundesliga"), TEXT("Ganz oben angekommen: Bundesliga") },
		{ TEXT("meister"), TEXT("Meister: Platz 1 am Saisonende") },
		{ TEXT("pokalsieger"), TEXT("Pokalheld: DFB-Pokal gewonnen") },
		{ TEXT("landespokal"), TEXT("Landespokalsieger") },
		{ TEXT("relegation"), TEXT("Nervenstark: Relegation gewonnen") },
		{ TEXT("unbeaten-10"), TEXT("Unbezwingbar: 10 Spiele ohne Niederlage") },
		{ TEXT("unbeaten-20"), TEXT("Wall aus Stahl: 20 Spiele ohne Niederlage") },
		{ TEXT("talentschmiede"), TEXT("Talentschmiede: Jugendakademie Stufe 3") },
		{ TEXT("grosses-stadion"), TEXT("Grosse Buehne: 25.000 Plaetze") },
		{ TEXT("legende"), TEXT("Vereinslegende verabschiedet") },
		{ TEXT("europa"), TEXT("International: Champions Cup erreicht") },
		{ TEXT("europa-sieger"), TEXT("Europas Krone: Champions Cup gewonnen") }
	};
}

FString FFM13World::AchievementLabel(const FString& Id)
{
	for (const FErfolg& E : Erfolge) if (Id == E.Id) return E.Label;
	return Id;
}

int32 FFM13World::AchievementCount()
{
	return (int32)(sizeof(Erfolge) / sizeof(Erfolge[0]));
}

void FFM13World::Unlock(const FString& Id, TArray<FString>* OutNew)
{
	if (Achievements.ContainsByPredicate([&Id](const FFM13Achievement& A) { return A.Id == Id; })) return;
	FFM13Achievement A;
	A.Id = Id; A.Season = Season; A.Matchday = Matchday;
	Achievements.Add(A);
	AddMessage(TEXT("Erfolg freigeschaltet"), AchievementLabel(Id));
	if (OutNew) OutNew->Add(AchievementLabel(Id));
}

void FFM13World::CheckAchievements(bool bSeasonEnd, int32 Rank, EFM13SeasonOutcome Outcome, TArray<FString>* OutNew)
{
	if (Money >= 1000000) Unlock(TEXT("millionaer"), OutNew);
	if (Money >= 10000000) Unlock(TEXT("multimillionaer"), OutNew);
	if (Records.LongestUnbeatenStreak >= 10) Unlock(TEXT("unbeaten-10"), OutNew);
	if (Records.LongestUnbeatenStreak >= 20) Unlock(TEXT("unbeaten-20"), OutNew);
	if (YouthAcademyLevel >= 3) Unlock(TEXT("talentschmiede"), OutNew);
	if (StadiumTotal() >= 25000) Unlock(TEXT("grosses-stadion"), OutNew);
	if (!bSeasonEnd) return;
	if (Rank == 1) Unlock(TEXT("meister"), OutNew);
	if (Outcome == EFM13SeasonOutcome::Promoted) Unlock(TEXT("aufstieg"), OutNew);
}

// ---------- Relegation ----------

FFM13RelegationResult FFM13World::PlayRelegation(int32 Rank)
{
	FFM13RelegationResult R;
	int32 Gegnerliga = -1;
	if (Rank == 16 && LeagueLevel < FM13::NumLeagues - 1) { Gegnerliga = LeagueLevel + 1; R.bForPromotion = false; }
	else if (Rank == 3 && LeagueLevel > 0) { Gegnerliga = LeagueLevel - 1; R.bForPromotion = true; }
	if (Gegnerliga < 0) return R;
	const FFM13League& L = Leagues[Gegnerliga];
	TArray<int32> Tabelle;
	for (int32 i : L.SortedIndices()) if (!L.Clubs[i].bOwn) Tabelle.Add(i);
	if (Tabelle.Num() < 3) return R;
	// Gegner: Dritter der Liga darunter bzw. Drittletzter (16.) der Liga darüber
	const FFM13Club& Gegner = L.Clubs[R.bForPromotion ? Tabelle[Tabelle.Num() - 3] : Tabelle[2]];
	R.bPlayed = true;
	R.Opponent = Gegner.Name;
	const int32 Eigen = OwnStrength();
	const EFM13Playstyle EigenStil = OwnPlaystyle();
	int32 Tore[2][2] = { { 0, 0 }, { 0, 0 } };
	for (int32 Leg = 0; Leg < 2; ++Leg)
	{
		// Der Verein aus der unteren Liga hat im Hinspiel Heimrecht
		const bool bHeim = R.bForPromotion == (Leg == 0);
		const FM13Match::FExpectedGoals Xg = bHeim
			? FM13Match::ExpectedGoals(OwnCupStrength(true), Gegner.Strength, EigenStil, Gegner.Playstyle)
			: FM13Match::ExpectedGoals(Gegner.Strength + FM13::AiHomeAdvantage, OwnCupStrength(false), Gegner.Playstyle, EigenStil);
		const int32 H = FM13Match::Poisson(Rng, Xg.Home), A = FM13Match::Poisson(Rng, Xg.Away);
		Tore[Leg][0] = bHeim ? H : A;
		Tore[Leg][1] = bHeim ? A : H;
		if (bHeim)
		{
			const int32 Zuschauer = StadiumTotal(); // Relegation: ausverkauft
			Book(TEXT("Relegation: Ticketeinnahmen"), TicketRevenue(Zuschauer));
		}
	}
	R.Leg1Own = Tore[0][0]; R.Leg1Opp = Tore[0][1]; R.Leg2Own = Tore[1][0]; R.Leg2Opp = Tore[1][1];
	const int32 Eigene = R.Leg1Own + R.Leg2Own, Fremde = R.Leg1Opp + R.Leg2Opp;
	R.bWon = Eigene > Fremde;
	if (Eigene == Fremde)
	{
		R.bPenalties = true;
		R.bWon = Rng.FRand() < 0.5f + FMath::Clamp((float)(Eigen - Gegner.Strength) / 100.f, -0.15f, 0.15f);
	}
	Fans = FMath::Clamp(Fans + (R.bWon ? 4 : -4), 0, 100);
	const TCHAR* Titel = R.bForPromotion ? (R.bWon ? TEXT("Aufstieg ueber die Relegation!") : TEXT("Relegation verloren, kein Aufstieg"))
		: (R.bWon ? TEXT("Klassenerhalt in der Relegation!") : TEXT("Abstieg nach Relegation"));
	AddMessage(Titel, FString::Printf(TEXT("Gegen %s: Hinspiel %d:%d, Rueckspiel %d:%d%s."), *R.Opponent, R.Leg1Own, R.Leg1Opp, R.Leg2Own, R.Leg2Opp,
		R.bPenalties ? TEXT(", Elfmeterschiessen") : TEXT("")));
	return R;
}

// ---------- Aufstellung, Moral, Ansprache, Vorbereitung (Runde B) ----------

TArray<int32> FFM13World::LineupIndices(int32& OutStrength) const
{
	if (ManualLineup.Num() == 0) return BestEleven(Squad, Formation, OutStrength);
	// Eigene Aufstellung: Ausfälle ersetzt das Spiel automatisch durch den Besten der Position.
	// Wie im Browserspiel zählt die Stärke jedes Spielers voll, auch außerhalb seiner Position.
	int32 Rest[4];
	for (int32 k = 0; k < 4; ++k) Rest[k] = FM13Tactics::Formation(Formation).Slots[k];
	TArray<int32> Elf;
	int64 Summe = 0;
	for (int32 Id : ManualLineup)
	{
		const int32 i = Squad.IndexOfByPredicate([Id](const FFM13Player& P) { return P.Id == Id; });
		if (i < 0 || !Squad[i].IsAvailable() || Elf.Contains(i) || Elf.Num() >= 11) continue;
		Elf.Add(i);
		const int32 Pos = (int32)Squad[i].Pos;
		if (Rest[Pos] > 0) Rest[Pos]--;
		Summe += Squad[i].Strength;
	}
	TArray<int32> Frei;
	for (int32 i = 0; i < Squad.Num(); ++i) if (Squad[i].IsAvailable() && !Elf.Contains(i)) Frei.Add(i);
	// Bewusst auf die Bank gesetzte Spieler kommen nur, wenn sonst niemand mehr da ist
	Frei.Sort([this](int32 A, int32 B)
	{
		const bool BA = ManualBench.Contains(Squad[A].Id), BB = ManualBench.Contains(Squad[B].Id);
		if (BA != BB) return !BA;
		return Squad[A].Strength > Squad[B].Strength;
	});
	for (int32 Pos = 0; Pos < 4 && Elf.Num() < 11; ++Pos)
		for (int32 n = 0; n < Rest[Pos] && Elf.Num() < 11; ++n)
		{
			const int32 k = Frei.IndexOfByPredicate([this, Pos](int32 i) { return (int32)Squad[i].Pos == Pos; });
			if (k < 0) break;
			Elf.Add(Frei[k]); Summe += Squad[Frei[k]].Strength; Frei.RemoveAt(k);
			Rest[Pos]--;
		}
	while (Elf.Num() < 11 && Frei.Num()) { Elf.Add(Frei[0]); Summe += Squad[Frei[0]].Strength; Frei.RemoveAt(0); }
	OutStrength = Elf.Num() ? FMath::RoundToInt((float)Summe / (float)Elf.Num()) : 0;
	return Elf;
}

bool FFM13World::SetManualLineup(const TArray<int32>& Ids, FString& OutReason)
{
	if (Ids.Num() > 11) { OutReason = TEXT("Hoechstens 11 Spieler."); return false; }
	for (int32 Id : Ids) if (!FindPlayer(Id)) { OutReason = TEXT("Ein Spieler ist nicht im Kader."); return false; }
	ManualLineup = Ids;
	ManualBench.Reset();
	return true;
}

bool FFM13World::ToggleLineupPlayer(int32 PlayerId, FString& OutReason)
{
	const FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (!ManualLineup.Num()) ManualLineup = StartingEleven();  // ab jetzt eigene Aufstellung
	if (ManualLineup.Contains(PlayerId)) { ManualLineup.Remove(PlayerId); ManualBench.AddUnique(PlayerId); return true; }
	if (!P->IsAvailable()) { OutReason = TEXT("Verletzt oder gesperrt: kann nicht spielen."); return false; }
	if (ManualLineup.Num() >= 11) { OutReason = TEXT("Die Elf ist voll. Nimm zuerst einen Spieler heraus."); return false; }
	ManualLineup.Add(PlayerId);
	ManualBench.Remove(PlayerId);
	return true;
}

// Moral der Elf in der Teamstärke: (Schnitt - 80) x 0,06 wie in calcTeamStrength()
float FFM13World::MoraleBonus() const
{
	int32 Dummy = 0;
	const TArray<int32> Elf = LineupIndices(Dummy);
	if (!Elf.Num()) return 0.f;
	int32 Summe = 0;
	for (int32 i : Elf) Summe += Squad[i].Morale > 0 ? Squad[i].Morale : 80;
	return (float)(((double)Summe / Elf.Num() - 80.0) * 0.06);
}

bool FFM13World::ChooseTalk(const FString& Type, FString& OutReason)
{
	if (Type != TEXT("fokus") && Type != TEXT("mut") && Type != TEXT("druck")) { OutReason = TEXT("Diese Ansprache gibt es nicht."); return false; }
	if (!NextLeagueOpponent()) { OutReason = TEXT("Am naechsten Spieltag gibt es kein Ligaspiel."); return false; }
	PendingTalk = Type;
	return true;
}

float FFM13World::TalkBonus(const FString& Type) const
{
	// computePregameTalkBonus(): Lage (Favorit, offen, Außenseiter) plus Charaktere der Startelf
	const FFM13Club* Opp = NextLeagueOpponent();
	const EFM13Expectation Lage = Opp ? FM13Match::Expectation(OwnStrength(), Opp->Strength) : EFM13Expectation::Offen;
	int32 Dummy = 0;
	const TArray<int32> Elf = LineupIndices(Dummy);
	auto Anteil = [this, &Elf](std::initializer_list<int32> Arten)
	{
		if (!Elf.Num()) return 0.f;
		int32 n = 0;
		for (int32 i : Elf) for (int32 A : Arten) if (Squad[i].Character == A) ++n;
		return (float)n / (float)Elf.Num();
	};
	// 0 Ruhig, 1 Emotional, 2 Ehrgeizig, 3 Selbstbewusst, 4 Bescheiden, 5 Hitzköpfig
	float B = 0.f;
	if (Type == TEXT("fokus")) B = (Lage == EFM13Expectation::Favorit ? 1.5f : (Lage == EFM13Expectation::Offen ? 0.75f : 0.f)) + Anteil({ 0, 4 });
	else if (Type == TEXT("mut")) B = (Lage == EFM13Expectation::Favorit ? -1.f : (Lage == EFM13Expectation::Offen ? 0.75f : 2.f)) + Anteil({ 1, 2 });
	else if (Type == TEXT("druck")) B = 0.5f + 2.5f * Anteil({ 2, 3 }) - 2.5f * Anteil({ 1, 5 });
	const int32 N = TalkHistory.Num();
	if (N >= 2 && TalkHistory[N - 1] == Type && TalkHistory[N - 2] == Type) B /= 2.f;  // nutzt sich ab
	return (float)FMath::RoundToInt(B * 10.f) / 10.f;
}

bool FFM13World::SetMatchPrep(TCHAR Archetype, FString& OutReason)
{
	if (Archetype != TEXT('P') && Archetype != TEXT('B') && Archetype != TEXT('K')) { OutReason = TEXT("Unbekannter Ansatz."); return false; }
	if (!NextLeagueOpponent()) { OutReason = TEXT("Am naechsten Spieltag hast du kein Ligaspiel - die Vorbereitung greift nur in der Liga."); return false; }
	PrepArchetype = Archetype;
	PrepMatchday = Matchday;
	return true;
}

float FFM13World::MatchPrepBonus() const
{
	// js/match-prep.js: richtig getippt +2,5 Stärke
	return (PrepMatchday == Matchday && PrepArchetype && PrepArchetype == OppPlanArchetype) ? 2.5f : 0.f;
}

void FFM13World::ResolveMatchMood(int32 OwnGoals, int32 OppGoals, const FFM13OwnMatchReport& Report)
{
	const int32 Ergebnis = OwnGoals > OppGoals ? 1 : (OwnGoals == OppGoals ? 0 : -1);
	const TArray<int32> Elf = StartingEleven();
	for (FFM13Player& P : Squad)
	{
		int32 D = 0;
		if (Elf.Contains(P.Id))
		{
			D = Ergebnis * 3;
			if (Report.Talk == TEXT("druck")) D += Ergebnis > 0 ? 3 : (Ergebnis < 0 ? -4 : 0);
		}
		else D = -1; // Bankspieler wollen spielen
		P.Morale = FMath::Clamp(P.Morale + D, 5, 100);
	}
	// Derby-Folgen (js/derby-week.js)
	if (Report.bDerby)
	{
		Fans = FMath::Clamp(Fans + Ergebnis * 2, 0, 100);
		if (DerbyPrepMatchday == Matchday)
		{
			if (DerbyPreps.Contains(TEXT("praemie")))
			{
				if (Ergebnis > 0)
				{
					int64 Gehalt = 0;
					for (int32 Id : Elf) if (const FFM13Player* P = FindPlayer(Id)) Gehalt += P->Wage;
					Book(TEXT("Derby-Praemie"), -Gehalt * 2);
				}
				else if (Ergebnis < 0) for (int32 Id : Elf) if (FFM13Player* P = FindPlayer(Id)) P->Morale = FMath::Max(5, P->Morale - 3);
			}
			if (DerbyPreps.Contains(TEXT("kampfansage")))
			{
				Fans = FMath::Clamp(Fans + Ergebnis * 3, 0, 100);
				BoardSat = FMath::Clamp(BoardSat + Ergebnis * 2, 10, 100);
			}
			if (DerbyPreps.Contains(TEXT("stimmung")) && !Report.bHome) Fans = FMath::Min(100, Fans + 2); // Sonderzug bindet die Fans
		}
	}
}

// ---------- Derby-Woche ----------

void FFM13World::PickRival()
{
	// Im Browserspiel nach Ort (club-geo.js). Hier: ein Verein mit gleichem Ortsnamen, sonst ein fester Rivale je Liga.
	const FFM13League& L = OwnLeague();
	TArray<FString> Woerter;
	ClubName.ParseIntoArray(Woerter, TEXT(" "), true);
	for (const FFM13Club& C : L.Clubs)
	{
		if (C.bOwn) continue;
		for (const FString& W : Woerter) if (W.Len() >= 4 && C.Name.Contains(W)) { RivalName = C.Name; return; }
	}
	if (L.Clubs.Num() && RivalName.Len() && L.FindClub(RivalName) >= 0) return;  // Rivale bleibt, solange er in der Liga ist
	TArray<FString> Namen;
	for (const FFM13Club& C : L.Clubs) if (!C.bOwn) Namen.Add(C.Name);
	Namen.Sort([](const FString& A, const FString& B) { return A < B; });
	uint32 H = 7;
	for (int32 i = 0; i < ClubName.Len(); ++i) H = H * 31 + (uint32)ClubName[i];
	RivalName = Namen.Num() ? Namen[(int32)((H + (uint32)LeagueLevel * 13u) % (uint32)Namen.Num())] : FString();
}

bool FFM13World::IsDerbyNext() const
{
	const FFM13Club* Opp = NextLeagueOpponent();
	return Opp && Opp->Name == RivalName;
}

int32 FFM13World::MatchdaysToDerby() const
{
	if (RivalName.IsEmpty() || !Leagues.IsValidIndex(LeagueLevel)) return -1;
	const FFM13League& L = OwnLeague();
	const int32 Rivale = L.FindClub(RivalName), Eigen = L.FindOwn();
	for (const FFM13Fixture& F : L.Fixtures)
	{
		if (F.bPlayed || F.Matchday < Matchday || F.Matchday > Matchday + 3) continue;
		if ((F.Home == Eigen && F.Away == Rivale) || (F.Home == Rivale && F.Away == Eigen)) return F.Matchday - Matchday;
	}
	return -1;
}

int64 FFM13World::DerbyPrepCost(const FString& Type) const
{
	static const int64 Stimmung[FM13::NumLeagues] = { 120000, 60000, 25000, 12000, 6000, 3000 };
	return Type == TEXT("stimmung") ? Stimmung[LeagueLevel] : 0;
}

bool FFM13World::BookDerbyPrep(const FString& Type, FString& OutReason)
{
	if (Type != TEXT("stimmung") && Type != TEXT("praemie") && Type != TEXT("kampfansage")) { OutReason = TEXT("Unbekannte Vorbereitung."); return false; }
	const int32 Abstand = MatchdaysToDerby();
	if (Abstand < 0) { OutReason = TEXT("Kein Derby in den naechsten 3 Spieltagen."); return false; }
	const int32 Tag = Matchday + Abstand;
	if (DerbyPrepMatchday != Tag) { DerbyPreps.Reset(); DerbyPrepMatchday = Tag; }
	if (DerbyPreps.Contains(Type)) { OutReason = TEXT("Schon gebucht."); return false; }
	const int64 Kosten = DerbyPrepCost(Type);
	if (Money < Kosten) { OutReason = TEXT("Nicht genug Geld."); return false; }
	if (Kosten > 0) Book(TEXT("Derby: Choreo und Sonderzug"), -Kosten);
	if (Type == TEXT("praemie")) for (int32 Id : StartingEleven()) if (FFM13Player* P = FindPlayer(Id)) P->Morale = FMath::Min(100, P->Morale + 5);
	DerbyPreps.Add(Type);
	return true;
}

// ---------- Spielprognose ----------

void FFM13World::Forecast(int32& OutWin, int32& OutDraw, int32& OutLoss) const
{
	OutWin = OutDraw = OutLoss = 0;
	bool bHeim = true;
	const FFM13Club* Opp = NextLeagueOpponent(&bHeim);
	if (!Opp) return;
	FRandomStream Sim(Season * 7919 + Matchday * 104729 + LeagueLevel);
	const double Eigen = OwnMatchStrengthExact(OppPlanArchetype, bHeim);
	const EFM13Playstyle EigenStil = OwnPlaystyle();
	const FM13Match::FExpectedGoals Xg = bHeim
		? FM13Match::ExpectedGoals(Eigen, Opp->Strength, EigenStil, Opp->Playstyle)
		: FM13Match::ExpectedGoals(Opp->Strength + FM13::AiHomeAdvantage, Eigen, Opp->Playstyle, EigenStil);
	int32 S = 0, U = 0, N = 0;
	for (int32 k = 0; k < 500; ++k)
	{
		const int32 H = FM13Match::Poisson(Sim, Xg.Home), A = FM13Match::Poisson(Sim, Xg.Away);
		const int32 Wir = bHeim ? H : A, Die = bHeim ? A : H;
		if (Wir > Die) ++S; else if (Wir == Die) ++U; else ++N;
	}
	OutWin = S * 100 / 500; OutDraw = U * 100 / 500; OutLoss = 100 - OutWin - OutDraw;
}

// ---------- Europapokal ----------

namespace
{
	const TCHAR* EuroTopf[4][11] = {
		{ TEXT("Real Madriz"), TEXT("FC Barcalona"), TEXT("Manchester Cyty"), TEXT("Liverpol FC"), TEXT("Paris St. Germaine"), TEXT("Inter Milano"), TEXT("Arsenall London") },
		{ TEXT("Atletico Madriz"), TEXT("Juwentus Turin"), TEXT("AC Millan"), TEXT("Chelsea FC London"), TEXT("Manchester Unitad"), TEXT("SSC Neapell"), TEXT("Benfika Lissabon"), TEXT("FC Porto Portugal") },
		{ TEXT("Ajax Amsterdaam"), TEXT("PSV Eindhofen"), TEXT("Sporting Lissabonn"), TEXT("Tottenham Hotspurr"), TEXT("AS Romm"), TEXT("Olympique Marseile"), TEXT("Galatasaray Istanbull"), TEXT("Club Bruggge"), TEXT("Feyenoordt Rotterdam") },
		{ TEXT("Celtic Glasgoww"), TEXT("RB Salzborg"), TEXT("Schachtar Donezkk"), TEXT("Roter Stern Belgratt"), TEXT("Young Boys Bernn"), TEXT("FC Baselll"), TEXT("Fenerbahce Istanbull"), TEXT("Olympique Lyonn"), TEXT("AS Monakko"), TEXT("FC Sevillia"), TEXT("Lazio Romm") }
	};
	const int32 TopfStaerke[4][2] = { { 4, 2 }, { 0, -2 }, { -4, -6 }, { -8, -10 } };
	const int32 EuroGruppenTage[6] = { 3, 7, 11, 15, 19, 23 };
	// Paarungen je Gruppenspieltag (Indizes in der Gruppe), Rückrunde mit Heimtausch
	const int32 EuroPaare[6][2][2] = { { { 0, 1 }, { 2, 3 } }, { { 0, 2 }, { 1, 3 } }, { { 0, 3 }, { 1, 2 } }, { { 1, 0 }, { 3, 2 } }, { { 2, 0 }, { 3, 1 } }, { { 3, 0 }, { 2, 1 } } };
}

void FFM13World::InitEurope()
{
	// initEuropeCup(): Feldstärke aus den vier stärksten anderen Bundesligisten, zwei Teams je Topf
	// Indizes statt Zeiger: TArray::Sort in UE dereferenziert Zeiger, Indizes verhalten sich überall gleich
	const TArray<FFM13Club>& BL = Leagues[0].Clubs;
	TArray<int32> Deutsche;
	for (int32 i = 0; i < BL.Num(); ++i) if (!BL[i].bOwn) Deutsche.Add(i);
	Deutsche.Sort([&BL](int32 A, int32 B) { return BL[A].Strength > BL[B].Strength; });
	int32 Mitte = 85;
	if (Deutsche.Num() >= 4) Mitte = (BL[Deutsche[0]].Strength + BL[Deutsche[1]].Strength + BL[Deutsche[2]].Strength + BL[Deutsche[3]].Strength) / 4;
	const int32 EigeneGruppe = Rng.RandRange(0, 1);
	const int32 DeutscherTopf = EuropePot == 1 ? 2 : 1;
	Europe = FFM13Europe();
	Europe.bActive = true;
	Europe.OwnStage = TEXT("Gruppe");
	for (int32 Topf = 0; Topf < 4; ++Topf)
	{
		TArray<FString> Pool;
		for (const TCHAR* N : EuroTopf[Topf]) if (N) Pool.Add(N);
		for (int32 Platz = 0; Platz < 2; ++Platz)
		{
			const int32 Gruppe = Platz == 0 ? EigeneGruppe : 1 - EigeneGruppe;
			FFM13EuroTeam T;
			T.Strength = FMath::Clamp(Mitte + TopfStaerke[Topf][Platz] + Rng.RandRange(-1, 1), 45, 95);
			if (Topf == EuropePot && Platz == 0) T.Name = ClubName;
			else if (Topf == DeutscherTopf && Platz == 1 && Deutsche.Num()) { T.Name = BL[Deutsche[0]].Name; T.Strength = BL[Deutsche[0]].Strength; }
			else { const int32 k = Rng.RandRange(0, Pool.Num() - 1); T.Name = Pool[k]; Pool.RemoveAt(k); }
			Europe.Groups[Gruppe].Add(T);
		}
	}
	Unlock(TEXT("europa"), nullptr);
}

void FFM13World::PlayEuropeMatchday()
{
	// Art: 0 = Gruppe und Hinspiel, 1 = Halbfinal-Rueckspiel (eigener Heimvorteil +2, Gegner daheim ohne Bonus), 2 = Finale (js/europe.js)
	auto Spiel = [this](const FString& Heim, int32 HStr, const FString& Gast, int32 GStr, int32& OutH, int32& OutA, int32 Art)
	{
		const bool bEigenHeim = Heim == ClubName, bEigenGast = Gast == ClubName;
		const double HExakt = bEigenHeim ? OwnCupStrength(true) + (Art == 1 ? 2 : 0) : HStr + ((bEigenGast && Art == 0) ? FM13::AiHomeAdvantage : 0);
		const double GExakt = bEigenGast ? OwnCupStrength(Art == 2) : GStr;
		const int32 HS = FMath::RoundToInt((float)HExakt), GS = FMath::RoundToInt((float)GExakt);
		const FM13Match::FExpectedGoals Xg = FM13Match::ExpectedGoals(HExakt, GExakt, EFM13Playstyle::Ausgeglichen, EFM13Playstyle::Ausgeglichen);
		OutH = FM13Match::Poisson(Rng, Xg.Home);
		OutA = FM13Match::Poisson(Rng, Xg.Away);
		if (bEigenHeim || bEigenGast)
		{
			FFM13OwnMatchReport& R = LastCupReport;
			R = FFM13OwnMatchReport();
			R.Competition = TEXT("Champions Cup");
			R.OwnGoals = bEigenHeim ? OutH : OutA;
			R.OppGoals = bEigenHeim ? OutA : OutH;
			R.OwnStrength = bEigenHeim ? HS : GS;
			R.OppStrength = bEigenHeim ? GS : HS;
			PickScorers(R.OwnGoals, R.Scorers);
			if (bEigenHeim)
			{
				R.Attendance = StadiumTotal();   // Europapokal: ausverkauft
				const int64 Tickets = TicketRevenue(StadiumTotal()) * 3 / 2;
				Book(TEXT("Europapokal: Ticketeinnahmen"), Tickets);
				R.Income += Tickets;
			}
			R.Weather = FM13Match::Weathers()[WeatherIndex].Name;
			FinishOwnReport(R, bEigenHeim ? Gast : Heim, bEigenHeim, TArray<FString>(), TArray<FString>());
		}
	};
	Europe.LastResults.Reset();

	// Gruppenphase
	for (int32 Runde = 0; Runde < 6; ++Runde)
	{
		if (EuroGruppenTage[Runde] != Matchday || Europe.GroupRound != Runde) continue;
		if (Runde == 0)
		{
			Book(TEXT("Europapokal: Startpraemie"), 4000000);
			AddMessage(TEXT("Champions Cup"), TEXT("Die Gruppenphase beginnt. 4.000.000 Euro Startpraemie."));
		}
		for (int32 G = 0; G < 2; ++G)
			for (int32 p = 0; p < 2; ++p)
			{
				FFM13EuroTeam& H = Europe.Groups[G][EuroPaare[Runde][p][0]];
				FFM13EuroTeam& A = Europe.Groups[G][EuroPaare[Runde][p][1]];
				int32 HG = 0, AG = 0;
				Spiel(H.Name, H.Strength, A.Name, A.Strength, HG, AG, 0);
				H.Played++; A.Played++; H.GoalsFor += HG; H.GoalsAgainst += AG; A.GoalsFor += AG; A.GoalsAgainst += HG;
				if (HG > AG) { H.Won++; A.Lost++; } else if (HG < AG) { A.Won++; H.Lost++; } else { H.Drawn++; A.Drawn++; }
				if ((H.Name == ClubName && HG > AG) || (A.Name == ClubName && AG > HG)) Book(TEXT("Europapokal: Siegpraemie"), 1500000);
				Europe.LastResults.Add(FString::Printf(TEXT("%s - %s  %d:%d"), *H.Name, *A.Name, HG, AG));
			}
		Europe.GroupRound++;
		if (Europe.GroupRound == 6)
		{
			for (int32 G = 0; G < 2; ++G)
				Europe.Groups[G].Sort([](const FFM13EuroTeam& X, const FFM13EuroTeam& Y)
				{
					if (X.Points() != Y.Points()) return X.Points() > Y.Points();
					return (X.GoalsFor - X.GoalsAgainst) > (Y.GoalsFor - Y.GoalsAgainst);
				});
			auto Halb = [](const FFM13EuroTeam& A, const FFM13EuroTeam& B) { FFM13EuroTie T; T.A = A.Name; T.B = B.Name; return T; };
			Europe.Semis = { Halb(Europe.Groups[0][0], Europe.Groups[1][1]), Halb(Europe.Groups[1][0], Europe.Groups[0][1]) };
			bool bDabei = false;
			for (const FFM13EuroTie& T : Europe.Semis) if (T.A == ClubName || T.B == ClubName) bDabei = true;
			if (bDabei)
			{
				Europe.OwnStage = TEXT("Halbfinale");
				Book(TEXT("Europapokal: Halbfinale"), 8000000);
				AddMessage(TEXT("Champions Cup Halbfinale!"), TEXT("Die Gruppe ist ueberstanden. 8.000.000 Euro Erfolgspraemie."));
			}
			else AddMessage(TEXT("Champions Cup"), TEXT("Aus in der Gruppenphase."));
		}
		return;
	}

	auto StaerkeVon = [this](const FString& N)
	{
		for (int32 G = 0; G < 2; ++G) for (const FFM13EuroTeam& T : Europe.Groups[G]) if (T.Name == N) return T.Strength;
		return 80;
	};
	// Halbfinale: Hinspiel 27, Rückspiel 29
	if ((Matchday == 27 || Matchday == 29) && Europe.Semis.Num() == 2)
	{
		for (FFM13EuroTie& T : Europe.Semis)
		{
			int32 H = 0, A = 0;
			if (Matchday == 27) { Spiel(T.A, StaerkeVon(T.A), T.B, StaerkeVon(T.B), H, A, 0); T.Leg1A = H; T.Leg1B = A; }
			else
			{
				Spiel(T.B, StaerkeVon(T.B), T.A, StaerkeVon(T.A), H, A, 1); T.Leg2B = H; T.Leg2A = A;
				const int32 SA = T.Leg1A + T.Leg2A, SB = T.Leg1B + T.Leg2B;
				if (SA == SB) { T.bPenalties = true; T.Winner = Rng.FRand() < 0.5f + (StaerkeVon(T.A) - StaerkeVon(T.B)) * 0.02f ? T.A : T.B; }
				else T.Winner = SA > SB ? T.A : T.B;
			}
			Europe.LastResults.Add(FString::Printf(TEXT("%s - %s  %d:%d"), Matchday == 27 ? *T.A : *T.B, Matchday == 27 ? *T.B : *T.A, H, A));
		}
		if (Matchday == 29)
		{
			Europe.Final.A = Europe.Semis[0].Winner;
			Europe.Final.B = Europe.Semis[1].Winner;
			if (Europe.Final.A == ClubName || Europe.Final.B == ClubName) { Europe.OwnStage = TEXT("Finale"); AddMessage(TEXT("Champions Cup Finale!"), TEXT("Der Verein steht im Endspiel.")); }
		}
		return;
	}
	// Finale am Spieltag 31
	if (Matchday == 31 && !Europe.Final.A.IsEmpty() && Europe.Winner.IsEmpty())
	{
		FFM13EuroTie& F = Europe.Final;
		int32 H = 0, A = 0;
		Spiel(F.A, StaerkeVon(F.A), F.B, StaerkeVon(F.B), H, A, 2);
		F.Leg1A = H; F.Leg1B = A;
		if (H == A) { F.bPenalties = true; F.Winner = Rng.FRand() < 0.5f + (StaerkeVon(F.A) - StaerkeVon(F.B)) * 0.02f ? F.A : F.B; }
		else F.Winner = H > A ? F.A : F.B;
		Europe.Winner = F.Winner;
		Europe.LastResults.Add(FString::Printf(TEXT("Finale: %s - %s  %d:%d%s"), *F.A, *F.B, H, A, F.bPenalties ? TEXT(" n.E.") : TEXT("")));
		if (F.Winner == ClubName)
		{
			Europe.OwnStage = TEXT("Sieger");
			Book(TEXT("Europapokal: Titel"), 25000000);
			BoardSat = FMath::Min(100, BoardSat + 15);
			Fans = FMath::Min(100, Fans + 15);
			AddMessage(TEXT("Champions Cup gewonnen!"), TEXT("Der Verein ist die Nummer eins in Europa. 25.000.000 Euro Praemie."));
			Unlock(TEXT("europa-sieger"), nullptr);
		}
	}
}

// ---------- Auszeichnungen ----------

void FFM13World::SeasonAwards(FFM13SeasonSummary& S, int32 Rank, EFM13SeasonOutcome Outcome)
{
	// league-awards.js (vereinfacht): Torjäger und Spieler der Saison im eigenen Verein, Trainer der Saison
	const FFM13Player* Torjaeger = nullptr;
	const FFM13Player* Bester = nullptr;
	for (const FFM13Player& P : Squad)
	{
		if (!Torjaeger || P.GoalsSeason > Torjaeger->GoalsSeason) Torjaeger = &P;
		const int32 Wert = P.Appearances * 2 + P.GoalsSeason * 3 + P.Strength;
		if (!Bester || Wert > Bester->Appearances * 2 + Bester->GoalsSeason * 3 + Bester->Strength) Bester = &P;
	}
	if (Torjaeger && Torjaeger->GoalsSeason > 0) S.Awards.Add(FString::Printf(TEXT("Torjaeger: %s (%d Tore)"), *Torjaeger->Name, Torjaeger->GoalsSeason));
	if (Bester) S.Awards.Add(FString::Printf(TEXT("Spieler der Saison: %s"), *Bester->Name));
	if (Rank == 1 || Outcome == EFM13SeasonOutcome::Promoted || Rank <= SeasonTarget - 5) S.Awards.Add(TEXT("Trainer der Saison: du"));
	for (const FString& A : S.Awards) AwardHistory.Add(FString::Printf(TEXT("Saison %d: %s"), Season, *A));
	if (S.Awards.Num()) AddMessage(TEXT("Auszeichnungen der Saison"), FString::Join(S.Awards, TEXT(", ")));
}

// ---------- Hilfen ----------

void FFM13World::Book(const FString& Label, int64 Amount)
{
	Money += Amount;
	FFM13Booking B;
	B.Label = Label; B.Amount = Amount; B.Season = Season; B.Matchday = Matchday;
	Bookings.Add(B);
	if (Bookings.Num() > FM13::MaxBookings) Bookings.RemoveAt(0);
}

void FFM13World::AddMessage(const FString& Title, const FString& Body)
{
	FFM13Message M;
	M.Title = Title; M.Body = Body; M.Season = Season; M.Matchday = Matchday;
	Messages.Add(M);
	if (Messages.Num() > FM13::MaxMessages) Messages.RemoveAt(0);
}

// ---------- Personal (js/campus-staff.js) ----------

FFM13Staff* FFM13World::StaffSlot(int32 Slot)
{
	switch (Slot)
	{
	case 0: return &CoTrainer;
	case 1: return &AthletikTrainer;
	case 2: return &Physio;
	case 3: return &Greenkeeper;
	case 4: return &Analyst;
	case 5: return &Ernaehrungsberater;
	default: return nullptr;
	}
}

int64 FFM13World::StaffWagesTotal() const
{
	const FFM13Staff* Stellen[6] = { &CoTrainer, &AthletikTrainer, &Physio, &Greenkeeper, &Analyst, &Ernaehrungsberater };
	int64 Summe = 0;
	for (const FFM13Staff* S : Stellen) if (S->bHired) Summe += S->Wage;
	return Summe;
}

// staffHireBreaksCap(): eine Neueinstellung darf die Obergrenze nicht sprengen
bool FFM13World::StaffHireBreaksCap(int32 Slot) const
{
	const FFM13Staff* S = const_cast<FFM13World*>(this)->StaffSlot(Slot);
	if (!S || WageBudgetCap <= 0 || S->bHired) return false;
	return StaffWagesTotal() + FM13Staff::Rollen()[Slot].Gehalt > WageBudgetCap;
}

bool FFM13World::StaffHire(int32 Slot, int32 Kandidat, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(Slot);
	if (!S || !FM13Staff::Bewerber().IsValidIndex(Kandidat)) { OutReason = TEXT("Unbekannte Stelle oder Bewerber."); return false; }
	if (S->bHired) { OutReason = TEXT("Diese Position ist bereits besetzt."); return false; }
	const int64 Preis = FM13Staff::PreisFuerBewerber(Slot, Kandidat);
	if (Money < Preis) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Preis); return false; }
	if (StaffHireBreaksCap(Slot)) { OutReason = TEXT("Die Personalbudget-Obergrenze wuerde gesprengt."); return false; }
	const FM13Staff::FBewerber& B = FM13Staff::Bewerber()[Kandidat];
	Book(FString::Printf(TEXT("Einstellung: %s"), FM13Staff::Rollen()[Slot].Name), -Preis);
	S->bHired = true;
	S->Wage = FM13Staff::Rollen()[Slot].Gehalt;
	S->Contract = FM13Staff::VertragsLaufzeit;
	S->Morale = B.Moral;
	S->HiredSeason = Season;
	S->Level = B.Stufe;
	S->OnLeave = 0; S->bInterim = false; S->UpgradeDays = 0;
	return true;
}

// toggleStaffMember(): Entlassen kostet die Abfindung (Gehalt x Stufe), wenn das Konto sie deckt
bool FFM13World::StaffFire(int32 Slot, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(Slot);
	if (!S || !S->bHired) { OutReason = TEXT("Niemand auf dieser Stelle."); return false; }
	const int64 Abf = FM13Staff::Abfindung(S->Wage, S->Level);
	if (Abf > 0 && Money >= Abf) Book(FString::Printf(TEXT("Abfindung: %s"), FM13Staff::Rollen()[Slot].Name), -Abf);
	*S = FFM13Staff();
	return true;
}

// upgradeStaffMember(): Weiterbildung laeuft als Baustelle; bezahlt wird beim Auftrag
bool FFM13World::StaffUpgrade(int32 Slot, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(Slot);
	if (!S || !S->bHired) { OutReason = TEXT("Erst einstellen, dann weiterbilden."); return false; }
	if (S->Level >= 3) { OutReason = TEXT("Maximale Ausbaustufe bereits erreicht."); return false; }
	if (S->UpgradeDays > 0) { OutReason = TEXT("Weiterbildung laeuft bereits."); return false; }
	const int64 Kosten = FM13Staff::WeiterbildungKosten(Slot, S->Level);
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Kosten); return false; }
	Book(FString::Printf(TEXT("Weiterbildung: %s"), FM13Staff::Rollen()[Slot].Name), -Kosten);
	S->UpgradeDays = FM13Staff::WeiterbildungTage(Kosten);
	return true;
}

bool FFM13World::StaffRenew(int32 Slot, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(Slot);
	if (!S || !S->bHired) { OutReason = TEXT("Niemand auf dieser Stelle."); return false; }
	const int64 Kosten = FM13Staff::VerlaengerungKosten(Slot);
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Kosten); return false; }
	Book(FString::Printf(TEXT("Vertragsverlaengerung: %s"), FM13Staff::Rollen()[Slot].Name), -Kosten);
	S->Contract = FM13Staff::VertragsLaufzeit;
	S->Morale = FMath::Min(100.0, S->Morale + 10.0);
	return true;
}

bool FFM13World::StaffRaise(int32 Slot, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(Slot);
	if (!S || !S->bHired) { OutReason = TEXT("Niemand auf dieser Stelle."); return false; }
	const int64 Kosten = FM13Staff::GehaltserhoehungKosten(S->Wage);
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Kosten); return false; }
	Book(FString::Printf(TEXT("Gehaltserhoehung: %s"), FM13Staff::Rollen()[Slot].Name), -Kosten);
	S->Wage = FM13Staff::NeuesGehalt(S->Wage);
	S->Morale = FMath::Min(100.0, S->Morale + 20.0);
	return true;
}

// Interims-Ersatz fuer drei Spieltage, wenn die Stelle kurzfristig ausfaellt
bool FFM13World::StaffInterim(int32 Slot, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(Slot);
	if (!S || S->OnLeave <= 0) { OutReason = TEXT("Kein Ausfall auf dieser Stelle."); return false; }
	const int64 Kosten = S->Wage * 3;
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Kosten); return false; }
	Book(FString::Printf(TEXT("Interims-Ersatz: %s"), FM13Staff::Rollen()[Slot].Name), -Kosten);
	S->bInterim = true;
	return true;
}

// Jahres-Meeting: einmal je Saison, +8 Moral fuer das Personal und +2 fuer die Mannschaft
bool FFM13World::StaffMeeting(FString& OutReason)
{
	if (LastMeetingSeason == Season) { OutReason = TEXT("Das Meeting fuer diese Saison wurde bereits abgehalten."); return false; }
	LastMeetingSeason = Season;
	FFM13Staff* Stellen[6] = { &CoTrainer, &AthletikTrainer, &Physio, &Greenkeeper, &Analyst, &Ernaehrungsberater };
	for (FFM13Staff* S : Stellen) if (S->bHired) S->Morale = FMath::Min(100.0, S->Morale + 8.0);
	for (FFM13Player& P : Squad) P.Morale = FMath::Min(100, P.Morale + 2);
	return true;
}

bool FFM13World::StaffSetWageCap(int64 Cap, FString& OutReason)
{
	if (Cap < 0) { OutReason = TEXT("Die Obergrenze kann nicht negativ sein."); return false; }
	WageBudgetCap = Cap;
	return true;
}

// Abwerbeversuch: Bindungspraemie (Gehalt x 15) oder die Stelle ist frei
bool FFM13World::StaffResolvePoach(bool bPay, FString& OutReason)
{
	FFM13Staff* S = StaffSlot(PoachSlot);
	if (PoachSlot < 0 || !S) { OutReason = TEXT("Kein Abwerbeversuch offen."); return false; }
	if (bPay)
	{
		if (Money < PoachRetention) { OutReason = TEXT("Nicht genug Geld fuer die Bindungspraemie."); return false; }
		Book(TEXT("Bindungspraemie"), -PoachRetention);
		S->Morale = 100;
	}
	else
	{
		AddMessage(TEXT("Abgewandert"), FString::Printf(TEXT("%s hat den Verein verlassen."), FM13Staff::Rollen()[PoachSlot].Name));
		*S = FFM13Staff();
	}
	PoachSlot = -1;
	PoachRetention = 0;
	return true;
}

// Taeglicher Ablauf (processPostMatchRoutine): Vertraege, Moral, Abwerbung, Ausfaelle, Weiterbildung
void FFM13World::TickStaff()
{
	FFM13Staff* Stellen[6] = { &CoTrainer, &AthletikTrainer, &Physio, &Greenkeeper, &Analyst, &Ernaehrungsberater };
	for (int32 Slot = 0; Slot < 6; ++Slot)
	{
		FFM13Staff& S = *Stellen[Slot];
		if (!S.bHired) continue;
		if (--S.Contract == 5)
			AddMessage(TEXT("Vertrag laeuft aus"), FString::Printf(TEXT("Der Vertrag von %s endet in 5 Spieltagen. Jetzt verlaengern, sonst verlaesst er den Verein."), FM13Staff::Rollen()[Slot].Name));
		if (S.Contract <= 0)
		{
			AddMessage(TEXT("Vertrag ausgelaufen"), FString::Printf(TEXT("%s hat den Verein verlassen."), FM13Staff::Rollen()[Slot].Name));
			S = FFM13Staff();
			continue;
		}
		S.Morale = FM13Staff::MoralAbnahme(S.Morale);
	}
	// Abwerbung: 2 von 100 Spieltagen, sofern nichts offen ist
	if (PoachSlot < 0 && Rng.FRand() < 0.02f)
	{
		TArray<int32> Besetzt;
		for (int32 Slot = 0; Slot < 6; ++Slot) if (Stellen[Slot]->bHired) Besetzt.Add(Slot);
		if (Besetzt.Num())
		{
			PoachSlot = Besetzt[Rng.RandRange(0, Besetzt.Num() - 1)];
			PoachRetention = Stellen[PoachSlot]->Wage * 15;
			AddMessage(TEXT("Abwerbeversuch"), FString::Printf(TEXT("Ein Konkurrenzverein wirbt %s ab. Bindungspraemie: %lld."), FM13Staff::Rollen()[PoachSlot].Name, (long long)PoachRetention));
		}
	}
	// Kurzfristiger Ausfall: 1 von 100 Spieltagen, Ausfall fuer drei Spieltage
	if (Rng.FRand() < 0.01f)
	{
		TArray<int32> Frei;
		for (int32 Slot = 0; Slot < 6; ++Slot) if (Stellen[Slot]->bHired && Stellen[Slot]->OnLeave == 0) Frei.Add(Slot);
		if (Frei.Num())
		{
			const int32 Slot = Frei[Rng.RandRange(0, Frei.Num() - 1)];
			Stellen[Slot]->OnLeave = 3;
			AddMessage(TEXT("Ausfall"), FString::Printf(TEXT("%s faellt kurzfristig aus (3 Spieltage)."), FM13Staff::Rollen()[Slot].Name));
		}
	}
	for (int32 Slot = 0; Slot < 6; ++Slot)
	{
		FFM13Staff& S = *Stellen[Slot];
		if (S.OnLeave > 0) { if (--S.OnLeave == 0) S.bInterim = false; }
		if (S.UpgradeDays > 0 && --S.UpgradeDays == 0 && S.Level < 3)
		{
			S.Level++;
			AddMessage(TEXT("Weiterbildung abgeschlossen"), FString::Printf(TEXT("%s ist jetzt auf Stufe %d."), FM13Staff::Rollen()[Slot].Name, S.Level));
		}
	}
}

// ---------- Kabine und Mannschaftsrat (js/locker-room.js, js/team-council.js) ----------

namespace
{
	struct FKabineClique { uint8 Nation; uint8 Alter; TArray<int32> Mitglieder; int32 Stimmung; int32 Fuehrer; };

	// computeSquadCliques(): Cliquen aus Nation und Altersgruppe, ab drei Spielern, in der Reihenfolge des Kaders
	TArray<FKabineClique> Cliquen(const TArray<FFM13Player>& Kader)
	{
		TArray<FKabineClique> Liste;
		for (const FFM13Player& P : Kader)
		{
			const uint8 Alter = FM13Locker::Altersgruppe(P.Age);
			int32 k = 0;
			for (; k < Liste.Num(); ++k) if (Liste[k].Nation == P.Nation && Liste[k].Alter == Alter) break;
			if (k == Liste.Num()) Liste.Add(FKabineClique{ P.Nation, Alter, {}, 0, -1 });
			Liste[k].Mitglieder.Add(P.Id);
		}
		TArray<FKabineClique> Ergebnis;
		for (FKabineClique& C : Liste)
		{
			if (C.Mitglieder.Num() < 3) continue;
			int64 Summe = 0;
			int32 Bester = -1;
			double BesteFuehrung = -1e9;
			for (int32 Id : C.Mitglieder)
			{
				for (const FFM13Player& P : Kader) if (P.Id == Id)
				{
					Summe += P.Morale;
					const double F = FM13Locker::Fuehrung(P.Trait == 4, P.Age, P.AppearancesTotal, P.Morale);
					if (F > BesteFuehrung) { BesteFuehrung = F; Bester = Id; }
				}
			}
			C.Stimmung = (int32)std::floor((double)Summe / C.Mitglieder.Num() + 0.5);
			C.Fuehrer = Bester;
			Ergebnis.Add(C);
		}
		return Ergebnis;
	}

	double FuehrungVon(const TArray<FFM13Player>& Kader, int32 Id)
	{
		for (const FFM13Player& P : Kader) if (P.Id == Id) return FM13Locker::Fuehrung(P.Trait == 4, P.Age, P.AppearancesTotal, P.Morale);
		return 0.0;
	}
}

double FFM13World::CliqueModifier() const
{
	const TArray<FKabineClique> C = Cliquen(Squad);
	int32 Groesste = 0, GroesstRumort = 0, Rumort = 0;
	for (const FKabineClique& K : C)
	{
		const bool bRumort = K.Stimmung < FM13Locker::UnruheMoral;
		if (bRumort) ++Rumort;
		if (K.Mitglieder.Num() > Groesste) { Groesste = K.Mitglieder.Num(); GroesstRumort = bRumort ? 1 : 0; }
	}
	return FM13Locker::CliqueModifikator(Squad.Num(), Groesste, GroesstRumort != 0, C.Num(), Rumort);
}

double FFM13World::CouncilStabilizer() const
{
	if (CouncilIds.Num() == 0) return 0.0;
	int64 Summe = 0;
	int32 N = 0;
	for (int32 Id : CouncilIds) for (const FFM13Player& P : Squad) if (P.Id == Id) { Summe += P.Morale; ++N; }
	if (N == 0) return 0.0;
	return FM13Locker::Stabilisator((int32)std::floor((double)Summe / N + 0.5));
}

// electTeamCouncil(): Kapitaen plus die zwei Fuehrungsspieler (ohne Kapitaen drei)
void FFM13World::ElectCouncil()
{
	struct FKandidat { int32 Id; double F; };
	TArray<FKandidat> Rest;
	for (const FFM13Player& P : Squad) if (P.Id != CaptainId) Rest.Add({ P.Id, FM13Locker::Fuehrung(P.Trait == 4, P.Age, P.AppearancesTotal, P.Morale) });
	Rest.Sort([](const FKandidat& A, const FKandidat& B) { return A.F > B.F; });
	CouncilIds.Reset();
	if (CaptainId != 0 && FindPlayer(CaptainId)) CouncilIds.Add(CaptainId);
	const int32 Anzahl = CouncilIds.Num() ? 2 : 3;
	for (int32 k = 0; k < Rest.Num() && k < Anzahl; ++k) CouncilIds.Add(Rest[k].Id);
}

// handleCaptainChange(): der alte Kapitaen verliert 12 Moral, der neue gewinnt 8. Die Kabine reagiert je nach Stellung.
bool FFM13World::ChangeCaptain(int32 NewId, bool bViaCouncil, FString& OutFolge)
{
	FFM13Player* Neu = FindPlayer(NewId);
	if (!Neu || NewId == CaptainId) return false;
	FFM13Player* Alt = CaptainId ? FindPlayer(CaptainId) : nullptr;
	if (Alt) Alt->Morale = FMath::Clamp(Alt->Morale - 12, 10, 100);
	Neu->Morale = FMath::Clamp(Neu->Morale + 8, 10, 100);
	const FM13Locker::EStatus Stellung = FM13Locker::Status(false, CouncilIds.Contains(NewId), Neu->Age, Neu->AppearancesTotal);
	CaptainId = NewId;
	if (bViaCouncil)
	{
		for (FFM13Player& P : Squad) if (&P != Alt && &P != Neu) P.Morale = FMath::Clamp(P.Morale + 2, 10, 100);
		OutFolge = TEXT("Der Rat steht hinter der Entscheidung, die Kabine zieht mit (+2 Moral).");
	}
	else if (Stellung != FM13Locker::EStatus::Rat && Stellung != FM13Locker::EStatus::Etabliert)
	{
		for (int32 Id : CouncilIds) if (Id != NewId && Id != (Alt ? Alt->Id : -1)) if (FFM13Player* P = FindPlayer(Id)) P->Morale = FMath::Clamp(P->Morale - 4, 10, 100);
		OutFolge = FString::Printf(TEXT("%s hat in der Kabine noch wenig Standing - die Fuehrungsspieler sind irritiert (-4 Moral)."), *Neu->Name);
	}
	else OutFolge = FString::Printf(TEXT("%s ist in der Kabine anerkannt."), *Neu->Name);
	ElectCouncil();
	return true;
}

// Monatlich: rumorende Cliquen ziehen den Rest des Kaders herunter (ohne Kapitaen mit Autoritaet nur halb so oft),
// zufriedene Cliquen heben sich selbst.
void FFM13World::TickLockerRoom()
{
	ElectCouncil();
	const TArray<FKabineClique> C = Cliquen(Squad);
	const FFM13Player* Kap = CaptainId ? FindPlayer(CaptainId) : nullptr;
	const bool bAutoritaet = Kap && FM13Locker::KapitaenAutoritaet(Kap->Morale, FuehrungVon(Squad, Kap->Id));
	for (const FKabineClique& K : C)
	{
		if (K.Stimmung < FM13Locker::UnruheMoral)
		{
			if (!bAutoritaet || RngKabine.FRand() < 0.5f)
				for (FFM13Player& P : Squad) if (!K.Mitglieder.Contains(P.Id)) P.Morale = FMath::Clamp(P.Morale - 1, 10, 100);
		}
		else if (K.Stimmung >= FM13Locker::ZufriedenMoral)
		{
			for (int32 Id : K.Mitglieder) if (FFM13Player* P = FindPlayer(Id)) P->Morale = FMath::Clamp(P->Morale + 1, 10, 100);
		}
	}
}

// tickLockerFriendships(): wer lange genug im Kader ist, wird gelegentlich Freund eines Mitspielers (5 %)
void FFM13World::TickFriendships()
{
	for (FFM13Player& P : Squad) P.SquadTenure++;
	TArray<int32> Ohne;
	for (const FFM13Player& P : Squad) if (P.FriendId == 0 && P.SquadTenure >= 20) Ohne.Add(P.Id);
	if (Ohne.Num() < 2 || RngKabine.FRand() >= 0.05f) return;
	const int32 A = Ohne[RngKabine.RandRange(0, Ohne.Num() - 1)];
	TArray<int32> Andere;
	for (int32 Id : Ohne) if (Id != A) Andere.Add(Id);
	const int32 B = Andere[RngKabine.RandRange(0, Andere.Num() - 1)];
	if (FFM13Player* PA = FindPlayer(A)) PA->FriendId = B;
	if (FFM13Player* PB = FindPlayer(B)) PB->FriendId = A;
}

// pickUnhappyVisitor(): ein Leistungstraeger ueber dem Kaderschnitt mit Moral unter 35, nicht im Rat, nicht verletzt
int32 FFM13World::UnhappyVisitor() const
{
	if (Squad.Num() < 5) return 0;
	TArray<int32> Staerken;
	for (const FFM13Player& P : Squad) Staerken.Add(P.Strength);
	Staerken.Sort([](int32 A, int32 B) { return A < B; });
	const int32 Median = Staerken[Squad.Num() / 2];
	const FFM13Player* Bester = nullptr;
	for (const FFM13Player& P : Squad)
	{
		if (P.Morale >= 35 || P.Strength < Median || P.InjuredMatchdays > 0 || P.Id == CaptainId || CouncilIds.Contains(P.Id)) continue;
		if (!Bester || P.Morale < Bester->Morale) Bester = &P;
	}
	return Bester ? Bester->Id : 0;
}

// ---------- Mannschaftsrat (js/team-council.js) ----------

namespace
{
	// adjustMorale(): Moral in 10 bis 100
	void MoralEl(FFM13Player& P, int32 D) { P.Morale = FMath::Clamp(P.Morale + D, 10, 100); }
	void MoralEl(FFM13Player* P, int32 D) { if (P) MoralEl(*P, D); }
	template <typename C> void AdjustMorale(C&& Liste, int32 D) { for (auto&& E : Liste) MoralEl(E, D); }
	void Moral(FFM13Player* P, int32 D) { if (P) MoralEl(*P, D); }

	// COUNCIL_LEAGUE_COST_FACTOR: je tiefer die Liga, desto guenstiger die Wuensche des Rates
	const double RatKostenFaktor[6] = { 1.0, 0.7, 0.45, 0.3, 0.2, 0.12 };
	const int32 RatFrist = 4; // Spieltage, bis ein unbeantwortetes Anliegen verfaellt
}

int64 FFM13World::CouncilCost(int64 Basis) const
{
	const double F = RatKostenFaktor[FMath::Clamp(LeagueLevel, 0, 5)];
	return (int64)std::floor((double)Basis * F / 500.0 + 0.5) * 500;
}

int32 FFM13World::CouncilOptionCount(const FString& Typ) const
{
	if (Typ == TEXT("stimmung") || Typ == TEXT("training") || Typ == TEXT("clique") || Typ == TEXT("kapitaen") || Typ == TEXT("praemie")) return 2;
	if (Typ == TEXT("einsatzzeit")) return 2;
	return 0;
}

// findCouncilConcern(): zuerst die Stimmung, dann die Kabine, dann Einsatzzeit, Training und Siegesserie
bool FFM13World::FindCouncilConcern(FAnliegen& Out) const
{
	if (Squad.Num() == 0) return false;
	int64 Summe = 0;
	for (const FFM13Player& P : Squad) Summe += P.Morale;
	const double Schnitt = (double)Summe / Squad.Num();
	if (Schnitt < 45)
	{
		Out.Typ = TEXT("stimmung");
		Out.Titel = TEXT("Die Stimmung in der Kabine ist im Keller");
		Out.Text = FString::Printf(TEXT("Die durchschnittliche Moral liegt bei %d. Der Rat schlaegt einen gemeinsamen Mannschaftsabend vor."), (int32)std::floor(Schnitt + 0.5));
		Out.Kosten = CouncilCost(40000);
		return true;
	}

	// Kabine: rumorende Clique oder die Kapitaensfrage
	const TArray<FKabineClique> C = Cliquen(Squad);
	int32 Unruhig = -1;
	for (int32 k = 0; k < C.Num(); ++k)
		if (C[k].Stimmung < FM13Locker::UnruheMoral && (Unruhig < 0 || C[k].Stimmung < C[Unruhig].Stimmung)) Unruhig = k;
	if (Unruhig >= 0 && C[Unruhig].Fuehrer > 0)
	{
		const FKabineClique& K = C[Unruhig];
		const FFM13Player* Fuehrer = nullptr;
		for (const FFM13Player& P : Squad) if (P.Id == K.Fuehrer) Fuehrer = &P;
		Out.Typ = TEXT("clique");
		Out.Titel = FString::Printf(TEXT("Die Gruppe %s %s rumort"), FM13Locker::Nation(K.Nation), FM13Locker::AltersgruppeName(K.Alter));
		Out.Text = FString::Printf(TEXT("%s spricht fuer %d Spieler (Stimmung %d). Die schlechte Laune faerbt auf die Kabine ab und kostet Teamstaerke."),
			Fuehrer ? *Fuehrer->Name : TEXT("Der Wortfuehrer"), K.Mitglieder.Num(), K.Stimmung);
		Out.Wortfuehrer = K.Fuehrer;
		Out.Clique = Unruhig;
		return true;
	}
	if (const FFM13Player* Kap = CaptainId ? FindPlayer(CaptainId) : nullptr)
	{
		const bool bOhneEinsatz = Matchday >= 10 && Kap->Appearances < Matchday * 0.4;
		if (Kap->Morale < 35 || bOhneEinsatz)
		{
			const FFM13Player* Nach = nullptr;
			double BesteF = -1e9;
			for (int32 Id : CouncilIds)
			{
				if (Id == Kap->Id) continue;
				for (const FFM13Player& P : Squad) if (P.Id == Id)
				{
					const double F = FM13Locker::Fuehrung(P.Trait == 4, P.Age, P.AppearancesTotal, P.Morale);
					if (!Nach || F > BesteF) { Nach = &P; BesteF = F; }
				}
			}
			if (Nach)
			{
				Out.Typ = TEXT("kapitaen");
				Out.Titel = TEXT("Die Kapitaensfrage");
				Out.Text = bOhneEinsatz
					? FString::Printf(TEXT("%s traegt die Binde, spielt aber kaum (%d Einsaetze). Der Rat schlaegt %s vor."), *Kap->Name, Kap->Appearances, *Nach->Name)
					: FString::Printf(TEXT("%s wirkt als Kapitaen ausgebrannt (Moral %d). Der Rat schlaegt %s vor."), *Kap->Name, (int32)std::floor(Kap->Morale + 0.5), *Nach->Name);
				Out.Kapitaen = Kap->Id;
				Out.Nachfolger = Nach->Id;
				return true;
			}
		}
	}

	// Einsatzzeit: ein starker Spieler ohne Einsatz in dieser Saison (ab Spieltag 8)
	TArray<int32> Staerken;
	for (const FFM13Player& P : Squad) Staerken.Add(P.Strength);
	Staerken.Sort([](int32 A, int32 B) { return A < B; });
	const int32 Median = Staerken[Squad.Num() / 2];
	const FFM13Player* Vergessen = nullptr;
	if (Matchday >= 8)
		for (const FFM13Player& P : Squad)
			if (P.Appearances == 0 && P.Strength >= Median && P.InjuredMatchdays <= 0 && (!Vergessen || P.Strength > Vergessen->Strength)) Vergessen = &P;
	if (Vergessen)
	{
		Out.Typ = TEXT("einsatzzeit");
		Out.Titel = FString::Printf(TEXT("%s fuehlt sich uebergangen"), *Vergessen->Name);
		Out.Text = FString::Printf(TEXT("%s (Staerke %d) hat diese Saison noch kein Spiel gemacht. Der Rat bittet um ein klaerendes Gespraech."), *Vergessen->Name, Vergessen->Strength);
		Out.Spieler = Vergessen->Id;
		return true;
	}

	if (TrainingIntensity == TEXT("hart"))
	{
		Out.Typ = TEXT("training");
		Out.Titel = TEXT("Die Trainingsbelastung ist zu hoch");
		Out.Text = TEXT("Die Fuehrungsspieler melden muede Beine und wachsenden Unmut ueber das harte Training.");
		return true;
	}

	// Siegesserie: die letzten drei Ligaspiele gewonnen
	const int32 Spiele = OwnSeasonGoals.Num() / 2;
	if (Spiele >= 3)
	{
		bool bSerie = true;
		for (int32 k = Spiele - 3; k < Spiele; ++k) if (!(OwnSeasonGoals[2 * k] > OwnSeasonGoals[2 * k + 1])) bSerie = false;
		if (bSerie)
		{
			Out.Typ = TEXT("praemie");
			Out.Titel = TEXT("Die Mannschaft moechte eine Praemie fuer die Siegesserie");
			Out.Text = TEXT("Drei Siege in Folge - der Rat bittet um eine Sonderpraemie fuer die Mannschaft.");
			Out.Kosten = CouncilCost(60000);
			return true;
		}
	}
	return false;
}

// answerCouncilConcern(): die Antwort wirkt auf Moral und Kasse, das Anliegen ist danach erledigt
bool FFM13World::AnswerConcern(int32 Option, FString& OutReason)
{
	if (!Anliegen.bAktiv) { OutReason = TEXT("Kein offenes Anliegen."); return false; }
	if (Option < 0 || Option >= CouncilOptionCount(Anliegen.Typ)) { OutReason = TEXT("Unbekannte Antwort."); return false; }
	const FAnliegen A = Anliegen;
	const TArray<FFM13Player*> Rat = CouncilMembers();
	const bool bKostet = (A.Typ == TEXT("stimmung") || A.Typ == TEXT("praemie")) && Option == 0;
	if (bKostet && Money < A.Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Geld (%lld)."), (long long)A.Kosten); return false; }
	if (bKostet) Book(TEXT("Mannschaftsrat"), -A.Kosten);

	FString Ergebnis;
	if (A.Typ == TEXT("stimmung"))
	{
		if (Option == 0) { AdjustMorale(Squad, 6); Ergebnis = TEXT("Mannschaftsabend organisiert, Moral +6"); }
		else { AdjustMorale(Rat, -5); Ergebnis = TEXT("Abgelehnt, der Rat ist verstimmt"); }
	}
	else if (A.Typ == TEXT("einsatzzeit"))
	{
		FFM13Player* P = FindPlayer(A.Spieler);
		if (Option == 0) { Moral(P, 10); Ergebnis = TEXT("Gespraech gefuehrt, Spieler beruhigt"); }
		else { Moral(P, -10); AdjustMorale(Rat, -2); Ergebnis = TEXT("Abgewiesen, der Spieler ist enttaeuscht"); }
	}
	else if (A.Typ == TEXT("training"))
	{
		if (Option == 0) { TrainingIntensity = TEXT("normal"); AdjustMorale(Squad, 4); Ergebnis = TEXT("Training entschaerft, Moral +4"); }
		else { AdjustMorale(Squad, -4); Ergebnis = TEXT("Haerte beibehalten, Moral -4"); }
	}
	else if (A.Typ == TEXT("clique"))
	{
		const TArray<FKabineClique> C = Cliquen(Squad);
		const FKabineClique* K = (A.Clique >= 0 && A.Clique < C.Num()) ? &C[A.Clique] : nullptr;
		if (Option == 0)
		{
			if (K) for (int32 Id : K->Mitglieder) Moral(FindPlayer(Id), 8);
			for (FFM13Player* P : Rat) if (!K || !K->Mitglieder.Contains(P->Id)) Moral(P, -2);
			Ergebnis = TEXT("Gruppe angehoert: ihre Stimmung steigt (+8), der Rat sieht eine Bevorzugung (-2)");
		}
		else
		{
			if (K) for (FFM13Player& P : Squad) { if (K->Mitglieder.Contains(P.Id)) MoralEl(P, -3); else MoralEl(P, 2); }
			Moral(FindPlayer(A.Wortfuehrer), -6);
			Ergebnis = TEXT("Klare Linie: die Gruppe murrt (-3, Wortfuehrer -6), der Rest der Kabine zieht mit (+2)");
		}
	}
	else if (A.Typ == TEXT("kapitaen"))
	{
		if (Option == 0)
		{
			Moral(FindPlayer(A.Kapitaen), 10);
			for (FFM13Player* P : Rat) if (P->Id != A.Kapitaen) Moral(P, -2);
			Ergebnis = TEXT("Kapitaen gestaerkt (+10), der Rat ist skeptisch (-2)");
		}
		else
		{
			FString Folge;
			ChangeCaptain(A.Nachfolger, true, Folge);
			Ergebnis = TEXT("Kapitaenswechsel mit Rueckendeckung des Rats");
		}
	}
	else if (A.Typ == TEXT("praemie"))
	{
		if (Option == 0) { AdjustMorale(Squad, 5); Ergebnis = TEXT("Praemie gezahlt, Moral +5"); }
		else { AdjustMorale(Squad, -3); Ergebnis = TEXT("Praemie abgelehnt, Moral -3"); }
	}

	RatVerlauf.Insert(FString::Printf(TEXT("S%d/ST%d: %s - %s"), Season, Matchday, *A.Titel, *Ergebnis), 0);
	while (RatVerlauf.Num() > 6) RatVerlauf.RemoveAt(RatVerlauf.Num() - 1);
	Anliegen = FAnliegen();
	return true;
}

// tickTeamCouncil(): alle vier Spieltage. Ein unbeantwortetes Anliegen verfaellt nach vier Spieltagen,
// der Rat ist dann verstimmt (-3). Ist der Rat gut gelaunt, hebt sich die Kabine (+1), sonst sinkt sie (-1).
void FFM13World::TickTeamCouncil()
{
	if (Anliegen.bAktiv)
	{
		const int32 Alter = (Matchday - Anliegen.Spieltag) + (Season > Anliegen.Saison ? 34 : 0);
		if (Alter < RatFrist) return;
		for (FFM13Player* P : CouncilMembers()) Moral(P, -3);
		RatVerlauf.Insert(FString::Printf(TEXT("S%d/ST%d: %s - Unbeantwortet verfallen, der Rat ist verstimmt"), Season, Matchday, *Anliegen.Titel), 0);
		while (RatVerlauf.Num() > 6) RatVerlauf.RemoveAt(RatVerlauf.Num() - 1);
		Anliegen = FAnliegen();
	}
	ElectCouncil();
	const TArray<FFM13Player*> Rat = CouncilMembers();
	int64 Summe = 0;
	for (const FFM13Player* P : Rat) Summe += P->Morale;
	const double RatSchnitt = Rat.Num() ? (double)Summe / Rat.Num() : 0.0;
	for (FFM13Player& P : Squad) if (!CouncilIds.Contains(P.Id)) { if (RatSchnitt >= 70) MoralEl(P, 1); else if (RatSchnitt < 35) MoralEl(P, -1); }

	FAnliegen Neu;
	if (FindCouncilConcern(Neu))
	{
		Neu.bAktiv = true;
		Neu.Saison = Season;
		Neu.Spieltag = Matchday;
		Anliegen = Neu;
		AddMessage(FString::Printf(TEXT("Mannschaftsrat: %s"), *Neu.Titel), FString::Printf(TEXT("%s Antworte im Kader-Bereich beim Mannschaftsrat."), *Neu.Text));
	}
}

// Mitglieder des Rates als Zeiger (getCouncilMembers)
TArray<FFM13Player*> FFM13World::CouncilMembers()
{
	TArray<FFM13Player*> Liste;
	for (int32 Id : CouncilIds) if (FFM13Player* P = FindPlayer(Id)) Liste.Add(P);
	return Liste;
}

// ---------- Jugend-Laufbahn (js/youth-pathway.js) ----------

void FFM13World::AddYouthMoment(const FString& Text)
{
	YouthMoments.Insert(FString::Printf(TEXT("S%d/SpT %d: %s"), Season, Matchday, *Text), 0);
	while (YouthMoments.Num() > 15) YouthMoments.RemoveAt(YouthMoments.Num() - 1);
}

// getYouthLoanClubs(): zwei Vereine der Liga darunter nach Staerke, dazu einer eine Liga hoeher (Aufschlag 6).
// Ohne eigene Liga darunter kommen alle aus der eigenen Liga.
TArray<FFM13World::FFM13YouthLoan> FFM13World::YouthLoanClubs(const FFM13Player& P) const
{
	TArray<FFM13YouthLoan> Ergebnis;
	const int32 Stamm = FMath::Min(Leagues.Num() - 1, LeagueLevel + 1);
	const int32 Hoch = FMath::Max(0, Stamm - 1);
	auto Waehle = [this, &P](int32 Stufe, int32 Anzahl, int32 Aufschlag)
	{
		TArray<FFM13YouthLoan> Liste;
		if (!Leagues.IsValidIndex(Stufe)) return Liste;
		for (const FFM13Club& C : Leagues[Stufe].Clubs)
		{
			if (C.bOwn) continue;
			FFM13YouthLoan L; L.Club = C.Name; L.ClubLevel = Stufe; L.ClubStrength = C.Strength;
			Liste.Add(L);
		}
		// stabile Sortierung nach Abstand der Staerke (wie Array.sort in JS)
		for (int32 i = 1; i < Liste.Num(); ++i)
			for (int32 j = i; j > 0; --j)
			{
				const int32 A = FMath::Abs(Liste[j - 1].ClubStrength - P.Strength - Aufschlag);
				const int32 B = FMath::Abs(Liste[j].ClubStrength - P.Strength - Aufschlag);
				if (B < A) Swap(Liste[j - 1], Liste[j]); else break;
			}
		TArray<FFM13YouthLoan> Oben;
		for (int32 k = 0; k < Liste.Num() && k < Anzahl; ++k) Oben.Add(Liste[k]);
		return Oben;
	};
	const TArray<FFM13YouthLoan> StammVereine = Waehle(Stamm, 2, 0);
	Ergebnis = StammVereine;
	for (const FFM13YouthLoan& C : Waehle(Hoch, 3, 6))
	{
		bool bSchon = false;
		for (const FFM13YouthLoan& V : StammVereine) if (V.Club == C.Club) bSchon = true;
		if (!bSchon) { Ergebnis.Add(C); break; }
	}
	return Ergebnis;
}

bool FFM13World::LoanYouth(int32 PlayerId, const FString& Verein, FString& OutReason)
{
	int32 Index = -1;
	for (int32 i = 0; i < YouthTalents.Num(); ++i) if (YouthTalents[i].Id == PlayerId) Index = i;
	if (Index < 0) { OutReason = TEXT("Dieses Talent gibt es nicht."); return false; }
	FFM13Player P = YouthTalents[Index];
	if (P.Age < 17) { OutReason = TEXT("Leihen sind erst ab 17 Jahren moeglich."); return false; }
	bool bGefunden = false;
	FFM13YouthLoan Gewaehlt;
	for (const FFM13YouthLoan& C : YouthLoanClubs(P)) if (C.Club == Verein) { Gewaehlt = C; bGefunden = true; }
	if (!bGefunden) { OutReason = TEXT("Dieser Verein steht nicht zur Wahl."); return false; }
	YouthTalents.RemoveAt(Index);
	P.ProDecisionLeft = 0;
	Gewaehlt.Player = P;
	Gewaehlt.Duration = FMath::Max(8, FMath::Min(17, 34 - Matchday));
	Gewaehlt.OriginalStrength = P.Strength;
	YouthLoans.Add(Gewaehlt);
	AddYouthMoment(FString::Printf(TEXT("%s geht fuer %d Spieltage zu %s"), *P.Name, Gewaehlt.Duration, *Verein));
	return true;
}

// returnYouthFromLoan(): zurueck in die Akademie, mit der Bilanz der Leihe
void FFM13World::ReturnFromLoan(const FFM13YouthLoan& L)
{
	FFM13Player P = L.Player;
	YouthTalents.Add(P);
	if (P.Age >= 19 && P.ProDecisionLeft == 0 && !P.bAcademyGraduate) P.ProDecisionLeft = 8;
	const int32 Plus = P.Strength - L.OriginalStrength;
	AddYouthMoment(FString::Printf(TEXT("%s zurueck von %s: %d Einsaetze, %d Tore, %+d Staerke"), *P.Name, *L.Club, L.Apps, L.Goals, Plus));
	AddMessage(FString::Printf(TEXT("%s zurueck von der Leihe"), *P.Name), FString::Printf(TEXT("Bilanz bei %s: %d Einsaetze, %d Tore."), *L.Club, L.Apps, L.Goals));
}

// tickYouthProDecisions() und tickLoanedPlayers() fuer die Jugend: taeglich
void FFM13World::TickYouthPathway()
{
	// Entscheidungsfrist laeuft ab: nach acht Spieltagen ohne Angebot wechselt das Talent ablosefrei
	for (int32 i = YouthTalents.Num() - 1; i >= 0; --i)
	{
		FFM13Player& P = YouthTalents[i];
		if (P.ProDecisionLeft == 0) continue;
		P.ProDecisionLeft--;
		if (P.ProDecisionLeft == 3) AddMessage(FString::Printf(TEXT("%s wartet auf ein Angebot"), *P.Name), TEXT("Noch 3 Spieltage: ohne Profivertrag, Leihe oder Reserve verlaesst das Talent den Verein."));
		if (P.ProDecisionLeft <= 0)
		{
			const int64 Entschaedigung = (int64)std::floor(FM13Economy::MarketValue(P.Strength, nullptr) * 0.1 / 100.0 + 0.5) * 100;
			Book(TEXT("Ausbildungsentschaedigung"), Entschaedigung);
			AddYouthMoment(FString::Printf(TEXT("%s (%d) wechselt ohne Profivertrag"), *P.Name, P.Strength));
			AddMessage(FString::Printf(TEXT("%s ist weg"), *P.Name), FString::Printf(TEXT("Ohne Angebot hat %s den Verein verlassen. Ausbildungsentschaedigung: %lld."), *P.Name, (long long)Entschaedigung));
			YouthTalents.RemoveAt(i);
		}
	}
	// Leihen: je Spieltag ein Einsatz mit Wahrscheinlichkeit, Entwicklung nach Niveau
	for (int32 i = YouthLoans.Num() - 1; i >= 0; --i)
	{
		FFM13YouthLoan& L = YouthLoans[i];
		L.Duration--;
		FFM13Player& P = L.Player;
		const double Spielzeit = FMath::Max(0.15, FMath::Min(0.95, 0.55 + (P.Strength - L.ClubStrength) * 0.04));
		const double Stufe = P.PotentialTier == 1 ? 0.8 : (P.PotentialTier == 3 ? 1.3 : 1.0);
		if (RngJugend.FRand() < Spielzeit)
		{
			L.Apps++;
			const double Tor = P.Pos == EFM13Position::ST ? 0.3 : (P.Pos == EFM13Position::MIT ? 0.12 : (P.Pos == EFM13Position::ABW ? 0.04 : 0.0));
			if (RngJugend.FRand() < Tor) L.Goals++;
			L.DevProgress += (0.25 + FMath::Max(0, L.ClubStrength - P.Strength) * 0.015) * Stufe;
		}
		else L.DevProgress += 0.03;
		if (L.DevProgress >= 1.0 && P.Strength < P.Potential) { L.DevProgress -= 1.0; P.Strength++; }
		if (L.Duration <= 0)
		{
			ReturnFromLoan(L);
			YouthLoans.RemoveAt(i);
		}
	}
}

// tickYouthBreakthroughs(): ein Talent mit Luft nach oben kann einen Sprung machen (4 % je Monat, nach Stufe)
void FFM13World::TickYouthBreakthroughs()
{
	for (FFM13Player& P : YouthTalents)
	{
		const int32 Luft = P.Potential - P.Strength;
		const double Stufe = P.PotentialTier == 1 ? 0.5 : (P.PotentialTier == 3 ? 1.8 : 1.0);
		if (Luft < 6 || RngJugend.FRand() > 0.04 * Stufe) continue;
		const int32 Sprung = FMath::Min(Luft - 2, 3 + (int32)std::floor(RngJugend.FRand() * 3.0));
		P.Strength += Sprung;
		AddYouthMoment(FString::Printf(TEXT("Durchbruch: %s (%d J.) legt einen Leistungssprung hin, +%d auf %d"), *P.Name, P.Age, Sprung, P.Strength));
		AddMessage(FString::Printf(TEXT("Durchbruch in der Akademie: %s"), *P.Name), FString::Printf(TEXT("%s hat im Training den Knoten platzen lassen: Staerke +%d, jetzt %d."), *P.Name, Sprung, P.Strength));
	}
}

// checkYouthMilestones(): der erste Einsatz, das erste Tor und die erste Elf des Spieltags eigener Absolventen
void FFM13World::CheckYouthMilestones(const TArray<int32>& Starter)
{
	const FString Wann = FString::Printf(TEXT("S%d/SpT %d"), Season, Matchday);
	for (int32 i : Starter)
	{
		FFM13Player& P = Squad[i];
		if (!P.bAcademyGraduate) continue;
		if (P.MeilensteinDebut.IsEmpty()) { P.MeilensteinDebut = Wann; AddYouthMoment(FString::Printf(TEXT("Profidebuet: %s (%d J.) steht erstmals in der Startelf"), *P.Name, P.Age)); }
		if (P.MeilensteinTor.IsEmpty() && i < MatchGoals.Num() && MatchGoals[i] > 0)
		{
			P.MeilensteinTor = Wann;
			AddYouthMoment(FString::Printf(TEXT("Erstes Profitor: %s trifft fuer %s"), *P.Name, *ClubName));
			P.Morale = FMath::Min(100, P.Morale + 5);
		}
		if (P.MeilensteinElf.IsEmpty() && P.LastGrade > 0 && P.LastGrade <= 15)
		{
			P.MeilensteinElf = Wann;
			AddYouthMoment(FString::Printf(TEXT("%s zum ersten Mal in der Elf des Spieltags"), *P.Name));
		}
	}
}

// ---------- Transferpoker (js/transfer-poker.js) ----------

// ensureTransferTerms(): Verkaeufer aus dem eigenen und dem Liga-Niveau darunter, der Spielerstaerke am naechsten
void FFM13World::SetMarketTerms(FFM13MarketOffer& O)
{
	struct FKlub { FString Name; int32 Staerke; };
	TArray<FKlub> Pool;
	for (int32 L : { LeagueLevel, LeagueLevel - 1 })
		if (Leagues.IsValidIndex(L))
			for (const FFM13Club& C : Leagues[L].Clubs) if (!C.bOwn) Pool.Add(FKlub{ C.Name, C.Strength });
	// stabil nach Abstand zur Staerke sortieren (wie Array.sort in JS)
	for (int32 i = 1; i < Pool.Num(); ++i)
		for (int32 j = i; j > 0 && FMath::Abs(Pool[j].Staerke - O.Player.Strength) < FMath::Abs(Pool[j - 1].Staerke - O.Player.Strength); --j)
			Swap(Pool[j], Pool[j - 1]);
	O.SellerClub = Pool.Num() ? Pool[RngTransfer.RandRange(0, FMath::Min(6, Pool.Num()) - 1)].Name : FString(TEXT("ein Ligakonkurrent"));
	const int32 Vertrag = FMath::Clamp(O.Player.ContractYears, 1, 4);
	O.SellerMinimum = FM13Poker::Schmerzgrenze(O.Player.MarketValue, Vertrag);
	O.AskingPrice = FM13Poker::Forderung(O.Player.MarketValue, Vertrag, O.SellerMinimum, RngTransfer.RandRange(0, 999999) / 1000000.0);
	O.Price = O.AskingPrice;
}

int32 FFM13World::MarketIndexOf(int32 PlayerId) const
{
	for (int32 i = 0; i < Market.Num(); ++i) if (Market[i].Player.Id == PlayerId) return i;
	return -1;
}

// openTransferPoker(): Spieler begehrt, wenn er zu den drei besten des Marktes gehoert
bool FFM13World::OpenPoker(int32 PlayerId, FString& OutReason)
{
	const int32 Idx = MarketIndexOf(PlayerId);
	if (Idx < 0) { OutReason = TEXT("Dieser Spieler ist nicht mehr auf dem Markt."); return false; }
	if (HasTransferEmbargo()) { OutReason = TEXT("Transfersperre: das Konto ist im Minus."); return false; }
	FFM13MarketOffer& O = Market[Idx];
	if (O.bPokerBroken) { OutReason = FString::Printf(TEXT("%s verhandelt nicht mehr - nur noch der Sofortkauf zur Forderung."), *O.SellerClub); return false; }
	if (!(Poker.bActive && Poker.PlayerId == PlayerId))
	{
		int32 Beste = 0;
		for (const FFM13MarketOffer& M : Market) Beste = FMath::Max(Beste, M.Player.Strength);
		Poker = FFM13PokerState();
		Poker.bActive = true;
		Poker.PlayerId = PlayerId;
		Poker.Patience = 3 + RngTransfer.RandRange(0, 2);
		Poker.Offer = FM13Poker::Runden(O.AskingPrice * 0.85);
		Poker.RivalChance = O.Player.Strength >= Beste - 3 ? 0.45 : 0.15;
		Poker.Log.Add(FString::Printf(TEXT("%s verlangt %lld fuer %s (Marktwert %lld)."), *O.SellerClub, (long long)O.AskingPrice, *O.Player.Name, (long long)O.Player.MarketValue));
	}
	return true;
}

void FFM13World::ClosePoker()
{
	Poker = FFM13PokerState();
}

bool FFM13World::AdjustPokerOffer(int32 Prozent, FString& OutReason)
{
	const int32 Idx = MarketIndexOf(Poker.PlayerId);
	if (!Poker.bActive || Idx < 0) { OutReason = TEXT("Keine Verhandlung offen."); return false; }
	if (Poker.AgreedFee) { OutReason = TEXT("Die Ablöse ist schon vereinbart."); return false; }
	const int64 Schritt = FMath::Max<int64>(100, FM13Poker::Runden((double)Market[Idx].Player.MarketValue * FMath::Abs(Prozent) / 100.0));
	Poker.Offer = FMath::Max<int64>(100, Poker.Offer + (Prozent < 0 ? -1 : 1) * Schritt);
	return true;
}

// tickPokerRival(): steigt ein Rivale ein, treibt er die Schmerzgrenze hoch und schnappt sich den Spieler, wenn das Gebot zu niedrig bleibt
bool FFM13World::TickPokerRival(int32 Idx)
{
	FFM13MarketOffer& O = Market[Idx];
	if (!Poker.bRival && Poker.Rounds >= 1 && RngTransfer.RandRange(0, 999999) / 1000000.0 < Poker.RivalChance)
	{
		TArray<FString> Namen;
		TArray<int32> Staerken;
		if (Leagues.IsValidIndex(LeagueLevel))
			for (const FFM13Club& C : Leagues[LeagueLevel].Clubs) if (!C.bOwn && C.Name != O.SellerClub) { Namen.Add(C.Name); Staerken.Add(C.Strength); }
		FString Rivale = TEXT("Ein Konkurrent");
		if (Namen.Num())
		{
			TArray<int32> Idxs;
			for (int32 k = 0; k < Namen.Num(); ++k) Idxs.Add(k);
			Idxs.Sort([&Staerken](int32 A, int32 B) { return Staerken[A] > Staerken[B]; });
			Rivale = Namen[Idxs[RngTransfer.RandRange(0, FMath::Min(5, Idxs.Num()) - 1)]];
		}
		const int64 Gebot = FM13Poker::RivalenGebot(O.SellerMinimum, RngTransfer.RandRange(0, 999999) / 1000000.0);
		Poker.bRival = true;
		Poker.RivalClub = Rivale;
		Poker.RivalBid = Gebot;
		O.SellerMinimum = Gebot + 1000;
		O.AskingPrice = FMath::Max(O.AskingPrice, O.SellerMinimum);
		O.Price = O.AskingPrice;
		Poker.Log.Add(FString::Printf(TEXT("%s bietet %lld - der Preis zieht an!"), *Rivale, (long long)Gebot));
		return false;
	}
	if (Poker.bRival && Poker.Offer < Poker.RivalBid && RngTransfer.RandRange(0, 999999) / 1000000.0 < 0.35)
	{
		AddMessage(FString::Printf(TEXT("%s geht zu %s"), *O.Player.Name, *Poker.RivalClub), FString::Printf(TEXT("Waehrend der Verhandlungen hat %s %lld an %s gezahlt."), *Poker.RivalClub, (long long)Poker.RivalBid, *O.SellerClub));
		Market.RemoveAt(Idx);
		ClosePoker();
		return true;
	}
	return false;
}

// Einigung auf die Abloese: der Spieler will ein Gehalt, das wir einmal nachverhandeln koennen
static void EinigungAufAblose(FFM13World::FFM13PokerState& Pk, const FFM13MarketOffer& O, int64 Fee, double Zufall)
{
	Pk.AgreedFee = Fee;
	Pk.WageDemand = FM13Poker::Gehaltsforderung(O.Player.Wage, FM13Poker::Zaehigkeit(O.Player.Character), Zufall, false);
	Pk.Log.Add(FString::Printf(TEXT("Abloese vereinbart: %lld. %s fordert %lld Gehalt pro Spieltag."), (long long)Fee, *O.Player.Name, (long long)Pk.WageDemand));
}

// submitPokerOffer(): ein Angebot annehmen, ein Gegenangebot machen oder die Gespraeche beenden
bool FFM13World::SubmitPokerOffer(FString& OutReason)
{
	const int32 Idx = MarketIndexOf(Poker.PlayerId);
	if (!Poker.bActive || Idx < 0) { OutReason = TEXT("Keine Verhandlung offen."); return false; }
	if (Poker.AgreedFee) { OutReason = TEXT("Die Ablöse ist schon vereinbart."); return false; }
	FFM13MarketOffer& O = Market[Idx];
	const int64 Angebot = Poker.Offer;
	Poker.Rounds++;
	Poker.Log.Add(FString::Printf(TEXT("Dein Angebot: %lld"), (long long)Angebot));
	if (Angebot >= O.AskingPrice)
	{
		EinigungAufAblose(Poker, O, Angebot, RngTransfer.RandRange(0, 999999) / 1000000.0);
		return true;
	}
	const double Spanne = (double)FMath::Max<int64>(1, O.AskingPrice - O.SellerMinimum);
	if (Angebot >= O.SellerMinimum && RngTransfer.RandRange(0, 999999) / 1000000.0 < 0.4 + 0.6 * (double)(Angebot - O.SellerMinimum) / Spanne)
	{
		Poker.Log.Add(FString::Printf(TEXT("%s: Einverstanden."), *O.SellerClub));
		EinigungAufAblose(Poker, O, Angebot, RngTransfer.RandRange(0, 999999) / 1000000.0);
		return true;
	}
	const bool bFrech = Angebot < (double)O.SellerMinimum * 0.75;
	Poker.Patience -= bFrech ? 2 : 1;
	if (Poker.Patience <= 0)
	{
		O.bPokerBroken = true;
		O.AskingPrice = FM13Poker::Runden((double)O.AskingPrice * 1.1);
		O.Price = O.AskingPrice;
		Poker.Log.Add(FString::Printf(TEXT("%s bricht die Gespraeche ab. Nur noch Sofortkauf fuer %lld."), *O.SellerClub, (long long)O.AskingPrice));
		ClosePoker();
		return true;
	}
	// Gegenangebot: der Verkaeufer kommt ein Stueck entgegen, nie unter die Schmerzgrenze
	const int64 Neu = FM13Poker::Runden((double)O.AskingPrice - (double)(O.AskingPrice - Angebot) * (bFrech ? 0.05 : 0.35));
	O.AskingPrice = FMath::Max(O.SellerMinimum, Neu);
	O.Price = O.AskingPrice;
	Poker.Log.Add(bFrech ? FString::Printf(TEXT("%s: Das ist eine Frechheit. Forderung bleibt bei %lld."), *O.SellerClub, (long long)O.AskingPrice)
		: FString::Printf(TEXT("%s kontert: %lld."), *O.SellerClub, (long long)O.AskingPrice));
	TickPokerRival(Idx);
	return true;
}

bool FFM13World::AcceptPokerAsking(FString& OutReason)
{
	const int32 Idx = MarketIndexOf(Poker.PlayerId);
	if (!Poker.bActive || Idx < 0) { OutReason = TEXT("Keine Verhandlung offen."); return false; }
	if (Poker.AgreedFee) { OutReason = TEXT("Die Ablöse ist schon vereinbart."); return false; }
	Poker.Rounds++;
	EinigungAufAblose(Poker, Market[Idx], Market[Idx].AskingPrice, RngTransfer.RandRange(0, 999999) / 1000000.0);
	return true;
}

// Gehaltsgespraech: einmal nachverhandeln
bool FFM13World::HagglePokerWage(FString& OutReason)
{
	const int32 Idx = MarketIndexOf(Poker.PlayerId);
	if (!Poker.bActive || Idx < 0 || !Poker.AgreedFee) { OutReason = TEXT("Die Ablöse ist noch nicht vereinbart."); return false; }
	if (Poker.bWageTalked) { OutReason = TEXT("Das Gehalt ist schon besprochen."); return false; }
	Poker.bWageTalked = true;
	const double Z = FM13Poker::Zaehigkeit(Market[Idx].Player.Character);
	const bool bErfolg = RngTransfer.RandRange(0, 999999) / 1000000.0 < FM13Poker::NachverhandlungChance(Z);
	Poker.WageDemand = FM13Poker::Nachverhandlung(Poker.WageDemand, bErfolg);
	Poker.Log.Add(bErfolg ? FString::Printf(TEXT("%s akzeptiert %lld pro Spieltag."), *Market[Idx].Player.Name, (long long)Poker.WageDemand)
		: FString::Printf(TEXT("%s fuehlt sich unterschaetzt: jetzt %lld pro Spieltag."), *Market[Idx].Player.Name, (long long)Poker.WageDemand));
	return true;
}

// signPokerDeal(): Abloese, Gehalt und Platz im Kader pruefen, dann der Wechsel
bool FFM13World::SignPokerDeal(FString& OutReason)
{
	const int32 Idx = MarketIndexOf(Poker.PlayerId);
	if (!Poker.bActive || Idx < 0 || !Poker.AgreedFee) { OutReason = TEXT("Die Ablöse ist noch nicht vereinbart."); return false; }
	if (!TransferWindowGate(OutReason)) return false;
	if (Squad.Num() >= FM13::MaxSquadSize) { OutReason = TEXT("Der Kader ist voll (30 Spieler)."); return false; }
	const FFM13MarketOffer& O = Market[Idx];
	const FFM13MedBefund Befund = EnsureMedical(Market[Idx]);
	FFM13Player Kauf = O.Player;
	Kauf.Wage = (int32)Poker.WageDemand;
	if (!FinalizePurchase(Kauf, Poker.AgreedFee, Poker.WageDemand, Poker.SwapId, Befund, O.SellerClub, OutReason)) return false;
	Market.RemoveAt(Idx);
	AddMessage(TEXT("Neuzugang"), FString::Printf(TEXT("%s unterschreibt fuer %lld (Gehalt %lld pro Spieltag)."), *Kauf.Name, (long long)Poker.AgreedFee, (long long)Poker.WageDemand));
	ClosePoker();
	return true;
}

// ---------- Medizincheck (js/medical-check.js) ----------

namespace
{
	FString BefundText(const FFM13MedBefund& B)
	{
		switch (B.Issue)
		{
			case EFM13Medical::Chronisch: return FString::Printf(TEXT("chronische Probleme (%d fruehere Verletzungen, dauerhaft hoeheres Verletzungsrisiko)"), B.Injuries);
			case EFM13Medical::Verletzt: return FString::Printf(TEXT("aktuell verletzt (faellt %d Spiele aus)"), B.Weeks);
			default: return TEXT("unauffaellig");
		}
	}
}

double FFM13World::PhysioAusfall() const
{
	if (!Physio.bHired) return 1.0;
	return Physio.Task == TEXT("belastung") ? 0.3 : 0.5;   // getPhysioEffekt() in js/campus-staff.js
}

FFM13MedBefund& FFM13World::EnsureMedical(FFM13MarketOffer& O)
{
	if (!O.bMedicalRolled)
	{
		// Drei Wuerfe in fester Reihenfolge, damit der Ablauf je Seed gleich bleibt
		const double Zufall = RngTransfer.FRand();
		const double ZufallAnzahl = RngTransfer.FRand();
		const double ZufallWochen = RngTransfer.FRand();
		O.Medical = FM13Transfers::WuerfleBefund(O.Player.Age, Zufall, ZufallAnzahl, ZufallWochen);
		O.bMedicalRolled = true;
	}
	return O.Medical;
}

bool FFM13World::RunMedicalCheck(FString& OutReason)
{
	const int32 Idx = MarketIndexOf(Poker.PlayerId);
	if (!Poker.bActive || Idx < 0 || Poker.AgreedFee <= 0) { OutReason = TEXT("Der Medizincheck kommt erst, wenn die Abloese vereinbart ist."); return false; }
	FFM13MarketOffer& O = Market[Idx];
	FFM13MedBefund& B = EnsureMedical(O);
	if (B.bChecked) { OutReason = FString::Printf(TEXT("%s wurde schon untersucht: %s."), *O.Player.Name, *BefundText(B)); return false; }
	const int64 Gebuehr = FM13Transfers::MedizinGebuehr(Poker.AgreedFee, PhysioAusfall());
	if (Money < Gebuehr) { OutReason = FString::Printf(TEXT("Der Medizincheck kostet %lld - so viel ist nicht auf dem Konto."), (long long)Gebuehr); return false; }
	Book(TEXT("Medizincheck"), -Gebuehr);
	B.bChecked = true;
	if (!FM13Transfers::MedizinAuffaellig(B.Issue))
	{
		Poker.Log.Add(FString::Printf(TEXT("Medizincheck (%lld): %s ist kerngesund."), (long long)Gebuehr, *O.Player.Name));
		return true;
	}
	// Der Verein senkt Ablöse, Forderung und Schmerzgrenze um denselben Faktor
	const double Faktor = FM13Transfers::MedizinRabatt(B.Issue);
	const int64 Alt = Poker.AgreedFee;
	Poker.AgreedFee = FM13Transfers::JsRunden((double)Alt * Faktor / 1000.0) * 1000;
	O.AskingPrice = FM13Transfers::JsRunden((double)O.AskingPrice * Faktor / 1000.0) * 1000;
	O.SellerMinimum = FMath::Min<int64>(O.AskingPrice, FM13Transfers::JsRunden((double)O.SellerMinimum * Faktor / 1000.0) * 1000);
	O.Price = O.AskingPrice;
	Poker.Log.Add(FString::Printf(TEXT("Medizincheck (%lld): %s. %s senkt die Abloese von %lld auf %lld - oder du laesst es."),
		(long long)Gebuehr, *BefundText(B), *O.SellerClub, (long long)Alt, (long long)Poker.AgreedFee));
	return true;
}

void FFM13World::ApplyMedicalOnArrival(FFM13Player& P, const FFM13MedBefund& B)
{
	// Der Befund wird Wirklichkeit: chronisch erhoeht das Verletzungsrisiko, verletzt fehlt zuerst
	if (B.Issue == EFM13Medical::Chronisch)
	{
		P.bChronic = true;
		P.TimesInjured = FMath::Max(P.TimesInjured, B.Injuries);
	}
	else if (B.Issue == EFM13Medical::Verletzt)
	{
		P.InjuredMatchdays = FMath::Max(P.InjuredMatchdays, B.Weeks);
	}
	if (FM13Transfers::MedizinAuffaellig(B.Issue) && !B.bChecked)
		AddMessage(FString::Printf(TEXT("Boese Ueberraschung: %s"), *P.Name), FString::Printf(TEXT("Ohne Medizincheck verpflichtet - jetzt stellt die Vereinsaerztin fest: %s."), *BefundText(B)));
}

// ---------- Transferbudget und Wechselfenster (js/transfermarket.js, js/squad.js) ----------

namespace
{
	constexpr int32 WinterWindowOpenMatchday = 17;   // openWinterWindow() am Spieltag 17
	constexpr int32 WinterWindowMatchdays = 3;        // WINTER_WINDOW_MATCHDAYS
}

int64 FFM13World::LeagueTransferBudget(int32 Level)
{
	static const int64 Budgets[] = { 25000000, 3000000, 900000, 250000, 60000, 40000 };   // LEAGUE_TRANSFER_BUDGET
	return Budgets[FMath::Clamp(Level, 0, 5)];
}

bool FFM13World::TransferWindowGate(FString& OutReason) const
{
	if (IsTransferWindowOpen()) return true;
	OutReason = TEXT("Transfers gehen nur im Wechselfenster (Spieltag 1 bis 3 oder Winterfenster).");
	return false;
}

// tickTransferWindows(): wird nach jedem gespielten Spieltag aufgerufen, Matchday ist dabei noch der gespielte.
void FFM13World::TickTransferWindows()
{
	if (Matchday == WinterWindowOpenMatchday && !bWinterWindowUsed)
	{
		RefreshMarket();
		bWinterWindowActive = true;
		bWinterWindowUsed = true;
		WinterWindowCloseMatchday = Matchday + WinterWindowMatchdays;
		AddMessage(TEXT("Winter-Transferfenster geoeffnet"), FString::Printf(TEXT("Bis einschliesslich Spieltag %d treffen deutlich mehr Angebote ein."), WinterWindowCloseMatchday));
		return;
	}
	if (bWinterWindowActive)
	{
		if (WinterWindowCloseMatchday <= 0) WinterWindowCloseMatchday = Matchday + 1;
		if (Matchday >= WinterWindowCloseMatchday)
		{
			bWinterWindowActive = false;
			RunDeadlineDay(TEXT("winter"));
		}
	}
	if (Matchday == 3) RunDeadlineDay(TEXT("sommer"));
}

// ---------- Rueckkauf (js/buyback.js) ----------

bool FFM13World::AcceptIncomingOfferWithBuyback(int32 Index, FString& OutReason)
{
	if (!IncomingOffers.IsValidIndex(Index)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	const FFM13IncomingOffer O = IncomingOffers[Index];
	const FFM13Player* P = O.bYouth ? nullptr : FindPlayer(O.PlayerId);
	if (!P || !FM13Transfers::RueckkaufMoeglich(P->Age)) { OutReason = TEXT("Eine Rueckkaufoption gibt es nur fuer Spieler bis 25 Jahre."); return false; }
	const FFM13Player Kopie = *P;
	// Der Kaeufer zahlt 10 % weniger sofort; die Option kostet ihn den Preis, den er bezahlt hat
	const int64 Sofort = FM13Transfers::RueckkaufSofort(O.Price);
	const int64 Preis = FM13Transfers::RueckkaufPreis(O.Price);
	IncomingOffers[Index].Price = Sofort;
	if (!AcceptIncomingOffer(Index, OutReason))
	{
		IncomingOffers[Index].Price = O.Price;
		return false;
	}
	FFM13BuybackOption Option;
	Option.Player = Kopie;
	Option.Club = O.Club;
	Option.Price = Preis;
	Option.UntilSeason = Season + FM13Transfers::BuybackSeasons;
	Option.SaleStrength = Kopie.Strength;
	Option.Season = Season;
	BuybackOptions.Add(Option);
	AddMessage(TEXT("Rueckkaufoption"), FString::Printf(TEXT("%s wechselt fuer %lld zu %s - Rueckkauf bis Saison %d fuer %lld moeglich."),
		*Kopie.Name, (long long)Sofort, *O.Club, Option.UntilSeason, (long long)Preis));
	return true;
}

// tickBuybackOptions(): Saisonende, Season ist noch die alte Saison.
void FFM13World::TickBuybackOptions()
{
	for (int32 i = BuybackOptions.Num() - 1; i >= 0; --i)
	{
		FFM13BuybackOption& Option = BuybackOptions[i];
		if (Season >= Option.UntilSeason)
		{
			AddMessage(TEXT("Rueckkaufoption verfallen"), FString::Printf(TEXT("Die Option, %s von %s zurueckzuholen, ist abgelaufen."), *Option.Player.Name, *Option.Club));
			BuybackOptions.RemoveAt(i);
			continue;
		}
		FFM13Player& P = Option.Player;
		P.Age += 1;
		const double Zufall = RngTransfer.FRand();
		P.Strength = FMath::Clamp(P.Strength + FM13Transfers::RueckkaufEntwicklung(P.Age, Zufall), 20, 99);
		P.MarketValue = FM13Economy::MarketValue(P.Strength, nullptr);
		AddMessage(FString::Printf(TEXT("%s bei %s"), *P.Name, *Option.Club),
			FString::Printf(TEXT("%s (%d J.) steht jetzt bei Staerke %d (beim Verkauf %d). Rueckkauf fuer %lld bis Saison %d - nur im Transferfenster."),
				*P.Name, P.Age, P.Strength, Option.SaleStrength, (long long)Option.Price, Option.UntilSeason));
	}
}

bool FFM13World::ExerciseBuyback(int32 PlayerId, FString& OutReason)
{
	const int32 Idx = BuybackOptions.IndexOfByPredicate([PlayerId](const FFM13BuybackOption& O) { return O.Player.Id == PlayerId; });
	if (Idx < 0) { OutReason = TEXT("Diese Rueckkaufoption gibt es nicht mehr."); return false; }
	if (!TransferWindowGate(OutReason)) return false;
	if (HasTransferEmbargo()) { OutReason = TEXT("Transfersperre: das Konto ist im Minus."); return false; }
	const FFM13BuybackOption Option = BuybackOptions[Idx];
	if (Money < Option.Price) { OutReason = FString::Printf(TEXT("Vereinskonto reicht nicht: %lld noetig."), (long long)Option.Price); return false; }
	if (TransferBudget < Option.Price) { OutReason = FString::Printf(TEXT("Transferbudget reicht nicht: %lld noetig, %lld verfuegbar."), (long long)Option.Price, (long long)TransferBudget); return false; }
	if (Squad.Num() >= FM13::MaxSquadSize) { OutReason = TEXT("Der Kader ist voll (30 Spieler)."); return false; }
	FFM13Player P = Option.Player;
	const int32 Gehalt = FMath::Max(P.Wage, FM13Economy::Wage(P.MarketValue, P.Strength));
	if (!FitsWageBudget(Gehalt)) { OutReason = TEXT("Das Gehalt sprengt das Gehaltsbudget des Vorstands."); return false; }
	P.Wage = Gehalt;
	Book(FString(TEXT("Rueckkauf: ")) + P.Name, -Option.Price);
	TransferBudget -= Option.Price;
	P.ContractYears = 3;
	P.Fitness = 100;
	P.Morale = 80;
	P.InjuredMatchdays = 0;
	P.SuspendedMatchdays = 0;
	Squad.Add(P);
	BuybackOptions.RemoveAt(Idx);
	Fans = FMath::Min(100, Fans + 2);
	AddMessage(TEXT("Rueckkehr"), FString::Printf(TEXT("%s kehrt fuer %lld von %s zurueck (Staerke %d, Fans +2)."), *P.Name, (long long)Option.Price, *Option.Club, P.Strength));
	return true;
}

// ---------- Transferstrategie (js/transfer-strategy.js) ----------

bool FFM13World::ChooseTransferStrategy(FM13Transfers::EStrategie Choice, FString& OutReason)
{
	if (!IsTransferStrategyOpen())
	{
		OutReason = bStrategySet ? TEXT("Die Transferstrategie fuer diese Saison steht schon.") : TEXT("Die Transferstrategie wird bis Spieltag 3 festgelegt.");
		return false;
	}
	const int32 Teams = FM13::TeamsPerLeague;
	const int32 Alt = SeasonTarget;
	const int32 Verschiebung = FM13Transfers::StrategieZielVerschiebung(Choice);
	const int32 Ziel = FM13Transfers::StrategieZiel(Alt, Verschiebung, Teams);
	if (Choice == FM13Transfers::EStrategie::Sofort && Alt == 1) { OutReason = TEXT("Platz 1 ist schon das Ziel - Sofort-Erfolg geht nicht hoeher."); return false; }
	const int64 Delta = FM13Transfers::StrategieBudgetDelta(LeagueTransferBudget(LeagueLevel), Choice);
	const int64 Vorher = TransferBudget;
	TransferBudget = FMath::Max<int64>(0, TransferBudget + Delta);
	SeasonTarget = Ziel;
	Strategy.Season = Season;
	Strategy.Choice = Choice;
	Strategy.bAuto = false;
	Strategy.OldGoal = Alt;
	Strategy.Goal = Ziel;
	Strategy.BudgetDelta = TransferBudget - Vorher;
	Strategy.Result = 0;
	bStrategySet = true;
	AddMessage(TEXT("Transferstrategie"), FString::Printf(TEXT("Transferbudget %+lld. Saisonziel jetzt Platz %d."), (long long)(TransferBudget - Vorher), SeasonTarget));
	return true;
}

// Jeden Spieltag nach dem Zaehler: wer bis Spieltag 3 nichts gewaehlt hat, bleibt ausgewogen.
void FFM13World::TickTransferStrategy()
{
	if (Matchday > 3 && Matchday <= FM13::MatchdaysPerSeason && !bStrategySet)
	{
		Strategy = FFM13TransferStrategy();
		Strategy.Season = Season;
		Strategy.bAuto = true;
		bStrategySet = true;
	}
}

int32 FFM13World::CountYouthGraduates() const
{
	int32 N = 0;
	for (const FFM13Player& P : Squad) if (P.bAcademyGraduate && P.Appearances >= FM13Transfers::StrategieJugendSpiele) N++;
	return N;
}

int64 FFM13World::SeasonProfit() const
{
	return FfpSeasonNet();
}

// Saisonende: Abrechnung der Linie gegen das Saisonziel (der Vorstand bewertet, ob das Versprechen gehalten wurde).
void FFM13World::ResolveTransferStrategy(int32 FinalRank)
{
	if (!bStrategySet || Strategy.Result != 0 || Strategy.bAuto || Strategy.Season != Season) return;
	if (Strategy.Choice == FM13Transfers::EStrategie::Ausgewogen) return;
	const int32 Eigen = CountYouthGraduates();
	const FM13Transfers::FStrategieAbrechnung A = FM13Transfers::StrategieAbrechnung(Strategy.Choice, Eigen, FinalRank, Strategy.Goal, SeasonProfit());
	BoardSat = FMath::Clamp(BoardSat + A.Vorstand, 10, 100);
	if (A.Fans) Fans = FMath::Min(100, Fans + A.Fans);
	Strategy.Result = A.bErfuellt ? 1 : 2;
	AddMessage(FString::Printf(TEXT("Transferstrategie %s"), A.bErfuellt ? TEXT("erfuellt") : TEXT("verfehlt")),
		FString::Printf(TEXT("Platz %d, Ziel Platz %d, Eigengewaechse %d, Saisonbilanz %lld. Vorstand %+d."), FinalRank, Strategy.Goal, Eigen, (long long)SeasonProfit(), A.Vorstand));
}

// ---------- Gerueuchteku che (js/rumors.js) ----------

int32 FFM13World::InterestThreshold() const
{
	if (Squad.Num() == 0) return 48;
	int64 Summe = 0;
	for (const FFM13Player& P : Squad) Summe += P.Strength;
	return FMath::Max(20, (int32)FM13Transfers::JsRunden((double)Summe / Squad.Num()));
}

int32 FFM13World::ClubLevelByName(const FString& Name) const
{
	for (int32 L = 0; L < Leagues.Num(); ++L)
		for (const FFM13Club& C : Leagues[L].Clubs) if (C.Name == Name) return L;
	return -1;
}

FString FFM13World::RandomOpposingClub(bool bPreferHigherOrEqual)
{
	TArray<FString> Namen;
	for (int32 L = 0; L < Leagues.Num(); ++L)
		for (const FFM13Club& C : Leagues[L].Clubs)
			if (!C.bOwn && (!bPreferHigherOrEqual || L <= LeagueLevel)) Namen.Add(C.Name);
	if (Namen.Num() == 0) return TEXT("Ein Konkurrent");
	return Namen[RngTransfer.RandRange(0, Namen.Num() - 1)];
}

// Obergrenze je Liga-Stufe fuer ein KI-Angebot (KI_ANGEBOT_OBERGRENZE in js/transfermarket.js)
namespace
{
	int64 KiObergrenze(int32 Stufe)
	{
		static const int64 Grenzen[] = { 250000000, 60000000, 15000000, 5000000, 1500000, 400000 };
		return Grenzen[FMath::Clamp(Stufe, 0, 5)];
	}
}

bool FFM13World::TriggerAIOffer(int32 PlayerId, const FString& Club, double Multiplier)
{
	const FFM13Player* P = FindPlayer(PlayerId);
	if (!P) return false;
	if (IncomingOffers.ContainsByPredicate([PlayerId](const FFM13IncomingOffer& O) { return O.PlayerId == PlayerId && !O.bYouth; })) return false;
	const double Roh = (double)P->MarketValue * Multiplier;
	const int32 Stufe = ClubLevelByName(Club);
	const int64 Obergrenze = KiObergrenze(Stufe >= 0 ? Stufe : 0);
	// Kleine Abloesen auf 500 genau, ab 50.000 auf 5.000 genau; nie ueber die Obergrenze des Kaeufers
	const int64 Betrag = Roh < 50000 ? FMath::Max<int64>(1000, FM13Transfers::JsRunden(Roh / 500.0) * 500)
		: FMath::Max<int64>(10000, FM13Transfers::JsRunden(Roh / 5000.0) * 5000);
	FFM13IncomingOffer O;
	O.PlayerId = P->Id;
	O.PlayerName = P->Name;
	O.Club = Club;
	O.Price = FMath::Min(Obergrenze, Betrag);
	O.ExpiresMatchday = Matchday + 3;
	IncomingOffers.Add(O);
	AddMessage(FString::Printf(TEXT("Angebot fuer %s"), *P->Name), FString::Printf(TEXT("%s bietet %lld fuer %s."), *Club, (long long)O.Price, *P->Name));
	return true;
}

bool FFM13World::CreateRumor(FFM13Rumor& Out)
{
	const FM13Transfers::EQuelle Quelle = FM13Transfers::QuelleWuerfeln(RngTransfer.FRand());
	const bool bWahr = RngTransfer.FRand() < FM13Transfers::QuelleTrefferquote(Quelle);
	const int32 Schwelle = InterestThreshold();
	auto Offen = [this](int32 Id) { return Rumors.ContainsByPredicate([Id](const FFM13Rumor& R) { return R.Outcome.IsEmpty() && R.PlayerId == Id; }); };
	TArray<int32> Kandidaten;   // Kaderindizes
	for (int32 i = 0; i < Squad.Num(); ++i)
	{
		const FFM13Player& P = Squad[i];
		if (P.Strength < Schwelle || Offen(P.Id)) continue;
		if (IncomingOffers.ContainsByPredicate([&P](const FFM13IncomingOffer& O) { return O.PlayerId == P.Id && !O.bYouth; })) continue;
		Kandidaten.Add(i);
	}
	TArray<int32> Markt;        // Marktindizes
	for (int32 i = 0; i < Market.Num(); ++i) if (!Offen(Market[i].Player.Id)) Markt.Add(i);
	const FString Verein = RandomOpposingClub(true);
	FFM13Rumor R;
	R.Id = FString::Printf(TEXT("rum_%d"), ++RumorNr);
	R.Source = Quelle;
	R.bTruth = bWahr;
	R.Club = Verein;
	R.Created = Matchday;
	R.Season = Season;
	if (Kandidaten.Num() && (RngTransfer.FRand() < 0.6f || Markt.Num() == 0))
	{
		const FFM13Player& P = Squad[Kandidaten[RngTransfer.RandRange(0, Kandidaten.Num() - 1)]];
		R.Type = TEXT("abwerbung");
		R.PlayerId = P.Id;
		R.PlayerName = P.Name;
		R.ResolveAt = Matchday + 1 + RngTransfer.RandRange(0, 2);
		Out = R;
		return true;
	}
	if (Markt.Num() == 0) return false;
	const FFM13MarketOffer& M = Market[Markt[RngTransfer.RandRange(0, Markt.Num() - 1)]];
	R.Type = TEXT("markt");
	R.PlayerId = M.Player.Id;
	R.PlayerName = M.Player.Name;
	R.ResolveAt = Matchday + 2;
	Out = R;
	return true;
}

// Jeden Spieltag: faellige Geruechte aufloesen, neue streuen (hoechstens drei offene, bis Spieltag 33).
void FFM13World::TickRumors()
{
	for (FFM13Rumor& R : Rumors)
		if (R.Outcome.IsEmpty() && (R.Season != Season || Matchday >= R.ResolveAt)) ResolveRumor(R);
	int32 Offen = 0;
	for (const FFM13Rumor& R : Rumors) if (R.Outcome.IsEmpty()) Offen++;
	if (Offen < 3 && Matchday < 34 && RngTransfer.FRand() < 0.3f)
	{
		FFM13Rumor Neu;
		if (CreateRumor(Neu))
		{
			Rumors.Insert(Neu, 0);
			AddMessage(FString::Printf(TEXT("Geruecht: %s"), *Neu.PlayerName),
				Neu.Type == TEXT("abwerbung") ? FString::Printf(TEXT("%s soll an %s interessiert sein."), *Neu.Club, *Neu.PlayerName)
				: FString::Printf(TEXT("%s soll kurz vor einem Wechsel zu %s stehen."), *Neu.PlayerName, *Neu.Club));
		}
	}
	// Nur die jeweils acht neuesten abgeschlossenen Geruechte bleiben
	int32 Abgeschlossen = 0;
	for (int32 i = 0; i < Rumors.Num(); ++i)
	{
		if (Rumors[i].Outcome.IsEmpty()) continue;
		if (++Abgeschlossen > 8) { Rumors.RemoveAt(i); --i; }
	}
}

void FFM13World::ResolveRumor(FFM13Rumor& R)
{
	const int32 Q = (int32)R.Source;
	if (!R.bTruth)
	{
		R.Outcome = TEXT("ente");
		RumorMisses[Q]++;
		return;
	}
	RumorHits[Q]++;
	if (R.Type == TEXT("markt"))
	{
		const int32 Idx = Market.IndexOfByPredicate([&R](const FFM13MarketOffer& M) { return M.Player.Id == R.PlayerId; });
		if (Idx < 0) { R.Outcome = TEXT("erledigt"); return; }
		Market.RemoveAt(Idx);
		if (Poker.bActive && Poker.PlayerId == R.PlayerId) ClosePoker();
		AddMessage(FString::Printf(TEXT("Geruecht bestaetigt: %s ist weg"), *R.PlayerName), FString::Printf(TEXT("%s wechselt zu %s."), *R.PlayerName, *R.Club));
		R.Outcome = TEXT("wahr");
		return;
	}
	const FFM13Player* P = FindPlayer(R.PlayerId);
	if (!P) { R.Outcome = TEXT("erledigt"); return; }
	if (R.Reaction == TEXT("dementieren") && R.bBackedOff)
	{
		R.Outcome = TEXT("zurueckgezogen");
		AddMessage(FString::Printf(TEXT("%s zieht zurueck"), *R.Club), FString::Printf(TEXT("Nach deinem Dementi verzichtet %s auf ein Angebot fuer %s."), *R.Club, *P->Name));
		return;
	}
	const double Mult = FM13Transfers::GeruechtMultiplikator(false, RngTransfer.FRand(), R.Reaction == TEXT("anheizen"));
	TriggerAIOffer(R.PlayerId, R.Club, Mult);
	R.Outcome = TEXT("wahr");
}

bool FFM13World::ReactToRumor(const FString& Id, const FString& Art, FString& OutReason)
{
	const int32 Idx = Rumors.IndexOfByPredicate([&Id](const FFM13Rumor& R) { return R.Id == Id; });
	if (Idx < 0 || !Rumors[Idx].Outcome.IsEmpty() || Rumors[Idx].Type != TEXT("abwerbung")) { OutReason = TEXT("Zu diesem Geruecht gibt es nichts mehr zu sagen."); return false; }
	FFM13Rumor& R = Rumors[Idx];
	if (!R.Reaction.IsEmpty()) { OutReason = TEXT("Du hast dich dazu schon geaeussert."); return false; }
	FFM13Player* P = FindPlayer(R.PlayerId);
	if (!P) { OutReason = TEXT("Der Spieler ist nicht mehr im Kader."); return false; }
	R.Reaction = Art;
	if (Art == TEXT("dementieren"))
	{
		P->Morale = FM13Transfers::DementiMoral(P->Character, P->Morale);
		R.bBackedOff = R.bTruth && RngTransfer.FRand() < 0.5f;
		AddMessage(TEXT("Dementi"), FString::Printf(TEXT("%s ist unverkaeuflich. %s"), *P->Name,
			FM13Transfers::GeruechtWechselwillig(P->Character) ? TEXT("Er haette gern mit dem Verein gesprochen (Moral -5).") : TEXT("Er fuehlt sich wertgeschaetzt (Moral +3).")));
	}
	else if (Art == TEXT("anheizen"))
	{
		P->Morale = FM13Transfers::AnheizenMoral(P->Morale);
		AddMessage(TEXT("Angeheizt"), FString::Printf(TEXT("Ein Angebot fiele hoeher aus - %s fuehlt sich weggeschoben (Moral -3)."), *P->Name));
	}
	return true;
}

// ---------- Vorvertraege (js/pre-contracts.js) ----------

TArray<FString> FFM13World::PreContractClubs() const
{
	TArray<FString> Namen;
	for (int32 L = FMath::Max(0, LeagueLevel - 1); L <= LeagueLevel && L < Leagues.Num(); ++L)
		for (const FFM13Club& C : Leagues[L].Clubs) if (!C.bOwn) Namen.Add(C.Name);
	return Namen;
}

// ensurePreContractPool(): ab Spieltag 18, vier Kandidaten je Saison. Der Pool wuerfelt mit dem
// Transfer-Zufall, damit der Hauptzufall der Saison unberuehrt bleibt.
void FFM13World::EnsurePreContractPool()
{
	if (Matchday < FM13Transfers::PreContractStartMatchday) return;
	if (PreContractPoolSeason == Season && PreContractPool.Num() > 0) return;
	PreContractPool.Reset();
	PreContractPoolSeason = Season;
	const int32 MinStaerke = 50 + (3 - LeagueLevel) * 9;
	const TArray<FString> Vereine = PreContractClubs();
	FRandomStream Haupt = Rng;
	Rng = RngTransfer;
	for (int32 i = 0; i < 4; ++i)
	{
		EFM13Position Pos = EFM13Position::ABW;
		if (i == 0 && RngTransfer.FRand() < 0.3f) Pos = EFM13Position::TW;
		else
		{
			const int32 W = RngTransfer.RandRange(0, 2);
			Pos = W == 0 ? EFM13Position::ABW : (W == 1 ? EFM13Position::MIT : EFM13Position::ST);
		}
		FFM13PreContractCandidate C;
		C.Player = CreatePlayer(Pos, MinStaerke, MinStaerke + 13, 22, 31);
		C.Player.ContractYears = 0;
		C.SellerClub = Vereine.Num() ? Vereine[RngTransfer.RandRange(0, Vereine.Num() - 1)] : TEXT("ein Ligakonkurrent");
		PreContractPool.Add(C);
	}
	RngTransfer = Rng;
	Rng = Haupt;
}

bool FFM13World::OfferPreContract(int32 CandidateId, bool bDoppelt, FString& OutReason)
{
	EnsurePreContractPool();
	const int32 Idx = PreContractPool.IndexOfByPredicate([CandidateId](const FFM13PreContractCandidate& C) { return C.Player.Id == CandidateId; });
	if (Idx < 0) { OutReason = TEXT("Dieser Spieler ist nicht mehr zu haben."); return false; }
	FFM13PreContractCandidate& C = PreContractPool[Idx];
	if (C.bRefused) { OutReason = FString::Printf(TEXT("%s hat schon abgesagt."), *C.Player.Name); return false; }
	if (PreContracts.Num() >= FM13Transfers::PreContractMaxPending) { OutReason = FString::Printf(TEXT("Hoechstens %d Vorvertraege auf einmal - der Kader fuer die neue Saison braucht auch Platz."), FM13Transfers::PreContractMaxPending); return false; }
	if (HasTransferEmbargo()) { OutReason = TEXT("Transfersperre aktiv - auch keine Vorvertraege."); return false; }
	const int64 Gehalt = FM13Transfers::VorvertragGehalt(C.Player.Wage);
	const int64 Handgeld = FM13Transfers::VorvertragHandgeld(Gehalt, bDoppelt);
	if (Money < Handgeld) { OutReason = FString::Printf(TEXT("Handgeld nicht gedeckt: %lld noetig."), (long long)Handgeld); return false; }
	// Gehaltssumme der neuen Saison: wer bleibt, plus offene Vorvertraege, plus dieser Spieler
	int64 Summe = Gehalt;
	for (const FFM13Player& P : Squad) if (P.ContractYears > 1) Summe += P.Wage;
	for (const FFM13PreContractDeal& D : PreContracts) Summe += D.Player.Wage;
	if (Summe > WageBudget) { OutReason = FString::Printf(TEXT("Gehaltsbudget der neuen Saison reicht nicht (%lld > %lld)."), (long long)Summe, (long long)WageBudget); return false; }
	// Zusagewahrscheinlichkeit nach Elfschnitt, Rang und Handgeld
	const TArray<int32> Elf = StartingEleven();
	double Schnitt = C.Player.Strength;
	if (Elf.Num())
	{
		int64 Sum = 0; int32 N = 0;
		for (int32 Id : Elf) if (const FFM13Player* P = FindPlayer(Id)) { Sum += P->Strength; N++; }
		if (N) Schnitt = (double)Sum / N;
	}
	const double Chance = FM13Transfers::VorvertragChance((int32)Schnitt, C.Player.Strength, OwnRank(), bDoppelt);
	if (RngTransfer.FRand() < Chance)
	{
		Book(FString(TEXT("Handgeld Vorvertrag: ")) + C.Player.Name, -Handgeld);
		FFM13PreContractDeal D;
		D.Player = C.Player;
		D.Player.Wage = (int32)Gehalt;
		D.From = C.SellerClub;
		D.Season = Season;
		PreContracts.Add(D);
		PreContractPool.RemoveAt(Idx);
		AddMessage(TEXT("Vorvertrag"), FString::Printf(TEXT("%s unterschreibt einen Vorvertrag: ablösefrei ab der neuen Saison (%lld Handgeld)."), *D.Player.Name, (long long)Handgeld));
		return true;
	}
	C.bRefused = true;
	OutReason = FString::Printf(TEXT("%s lehnt ab - er sieht seine Zukunft woanders."), *C.Player.Name);
	return false;
}

// Jeden Spieltag: Konkurrenz um die Kandidaten, Angebote fuer eigene Spieler mit auslaufendem Vertrag.
void FFM13World::TickPreContracts()
{
	if (Matchday < FM13Transfers::PreContractStartMatchday) return;
	EnsurePreContractPool();
	if (Matchday > FM13Transfers::PreContractStartMatchday)
	{
		for (int32 i = PreContractPool.Num() - 1; i >= 0; --i)
		{
			if (RngTransfer.FRand() >= 0.08f) continue;
			AddMessage(FString::Printf(TEXT("Vorvertrag woanders: %s"), *PreContractPool[i].Player.Name),
				FString::Printf(TEXT("%s wechselt zur neuen Saison ablösefrei von %s zu einem Konkurrenten."), *PreContractPool[i].Player.Name, *PreContractPool[i].SellerClub));
			PreContractPool.RemoveAt(i);
		}
	}
	// Median der Kaderstaerke
	TArray<int32> Staerken;
	for (const FFM13Player& P : Squad)
	{
		// Einfuegesortierung, damit das Ergebnis je Stand gleich bleibt
		int32 Pos = Staerken.Num();
		while (Pos > 0 && Staerken[Pos - 1] > P.Strength) --Pos;
		Staerken.Insert(P.Strength, Pos);
	}
	const int32 Median = Staerken.Num() ? Staerken[Staerken.Num() / 2] : 0;
	for (FFM13Player& P : Squad)
	{
		if (!P.PreOfferClub.IsEmpty() && P.ContractYears > 1)
		{
			AddMessage(FString::Printf(TEXT("%s bleibt"), *P.Name), FString::Printf(TEXT("Mit der Verlaengerung ist das Vorvertrags-Angebot von %s vom Tisch."), *P.PreOfferClub));
			P.PreOfferClub = TEXT("");
			continue;
		}
		if (!P.PreOfferClub.IsEmpty() && Matchday >= P.PreOfferDeadline)
		{
			P.PreSignedClub = P.PreOfferClub;
			P.PreOfferClub = TEXT("");
			AddMessage(FString::Printf(TEXT("%s unterschreibt bei %s"), *P.Name, *P.PreSignedClub), FString::Printf(TEXT("Die Frist ist verstrichen: %s verlaesst den Verein am Saisonende ablösefrei."), *P.Name));
			continue;
		}
		if (P.ContractYears == 1 && P.PreOfferClub.IsEmpty() && P.PreSignedClub.IsEmpty() && P.Strength >= Median && Matchday <= 30 && RngTransfer.FRand() < 0.06f)
		{
			// Ein Verein, der ihn sich leisten kann: Staerke mindestens seine minus 5
			TArray<FString> Interessenten;
			for (const FString& Name : PreContractClubs())
			{
				EFM13Playstyle Stil;
				if (ClubStrength(Name, Stil) >= P.Strength - 5) Interessenten.Add(Name);
			}
			if (Interessenten.Num() == 0) continue;
			P.PreOfferClub = Interessenten[RngTransfer.RandRange(0, Interessenten.Num() - 1)];
			P.PreOfferDeadline = Matchday + FM13Transfers::PreContractOfferDeadline;
			AddMessage(FString::Printf(TEXT("Vorvertrags-Angebot fuer %s"), *P.Name), FString::Printf(TEXT("%s bietet %s einen Vorvertrag fuer die neue Saison. Verlaengere bis Spieltag %d, sonst unterschreibt er dort."), *P.PreOfferClub, *P.Name, P.PreOfferDeadline));
		}
	}
}

// Saisonwechsel: Vorvertraege werden Spieler; alle Spieler sind jetzt eine Saison aelter.
void FFM13World::JoinPreContractPlayers()
{
	for (const FFM13PreContractDeal& D : PreContracts)
	{
		FFM13Player P = D.Player;
		P.Age += 1;
		P.ContractYears = 3;
		P.Fitness = 100;
		P.PreOfferClub = TEXT("");
		P.PreSignedClub = TEXT("");
		if (Squad.ContainsByPredicate([&P](const FFM13Player& X) { return X.Id == P.Id; })) P.Id = NextPlayerId++;
		Squad.Add(P);
		AddMessage(FString::Printf(TEXT("Neuzugang: %s"), *P.Name), FString::Printf(TEXT("%s (%s, Staerke %d) kommt wie vereinbart ablösefrei von %s."), *P.Name, FM13PositionName(P.Pos), P.Strength, *D.From));
	}
	PreContracts.Reset();
}

// ---------- Leihspieler (js/transfermarket.js) ----------

// Drei eingehende Leihspieler je Markt-Neuaufbau. Sie wuerfeln mit dem Transfer-Zufall.
void FFM13World::RefreshLoanables()
{
	Loanables.Reset();
	const int32 MinStaerke = 50 + (3 - LeagueLevel) * 9;
	const int32 MaxStaerke = MinStaerke + 9;
	const TArray<FString> Stammvereine = { TEXT("FC Brueckenstadt"), TEXT("Sportfreunde Nordwind"), TEXT("SV Hafenbogen") };
	FRandomStream Haupt = Rng;
	Rng = RngTransfer;
	for (int32 i = 0; i < 3; ++i)
	{
		FFM13Loanable L;
		const int32 W = RngTransfer.RandRange(0, 3);
		L.Player = CreatePlayer((EFM13Position)W, MinStaerke - 2, MaxStaerke + 4, 19, 31);
		L.Player.ContractYears = 1;
		L.ParentClub = Stammvereine[RngTransfer.RandRange(0, Stammvereine.Num() - 1)];
		L.LoanFee = FMath::Max<int64>(1000, FM13Transfers::JsRunden((double)L.Player.MarketValue * 0.12));
		L.BuyOptionFee = FM13Transfers::JsRunden((double)L.Player.MarketValue * 0.85);
		Loanables.Add(L);
	}
	RngTransfer = Rng;
	Rng = Haupt;
}

bool FFM13World::SignLoanPlayer(int32 Index, FString& OutReason)
{
	if (!Loanables.IsValidIndex(Index)) { OutReason = TEXT("Dieser Leihspieler ist nicht mehr da."); return false; }
	if (!TransferWindowGate(OutReason)) return false;
	const FFM13Loanable L = Loanables[Index];
	if (Money < L.LoanFee) { OutReason = FString::Printf(TEXT("Leihgebuehr nicht gedeckt: %lld noetig."), (long long)L.LoanFee); return false; }
	if (Squad.Num() >= 22) { OutReason = TEXT("Kader bereits voll (22 Spieler)."); return false; }
	if (TransferBudget < L.LoanFee) { OutReason = FString::Printf(TEXT("Transferbudget reicht nicht fuer die Leihgebuehr: %lld noetig."), (long long)L.LoanFee); return false; }
	if (!FitsWageBudget(L.Player.Wage)) { OutReason = TEXT("Das Gehalt sprengt das Gehaltsbudget des Vorstands."); return false; }
	Book(FString(TEXT("Leihgebuehr: ")) + L.Player.Name, -L.LoanFee);
	TransferBudget -= L.LoanFee;
	FFM13Player P = L.Player;
	P.ContractYears = 1;
	Squad.Add(P);
	FFM13IncomingLoan Leihe;
	Leihe.PlayerId = P.Id;
	Leihe.ParentClub = L.ParentClub;
	Leihe.MatchdaysLeft = L.DurationMatchdays;
	Leihe.BuyOptionFee = L.BuyOptionFee;
	IncomingLoans.Add(Leihe);
	Loanables.RemoveAt(Index);
	AddMessage(FString::Printf(TEXT("%s ausgeliehen"), *P.Name), FString::Printf(TEXT("%s kommt fuer diese Saison von %s auf Leihbasis - Kaufoption: %lld."), *P.Name, *L.ParentClub, (long long)L.BuyOptionFee));
	return true;
}

bool FFM13World::ExerciseLoanBuyOption(int32 PlayerId, FString& OutReason)
{
	const int32 Idx = IncomingLoans.IndexOfByPredicate([PlayerId](const FFM13IncomingLoan& L) { return L.PlayerId == PlayerId; });
	if (Idx < 0) { OutReason = TEXT("Diese Leihe gibt es nicht mehr."); return false; }
	const int32 PIdx = Squad.IndexOfByPredicate([PlayerId](const FFM13Player& P) { return P.Id == PlayerId; });
	if (PIdx < 0) { OutReason = TEXT("Der Spieler ist nicht mehr im Kader."); return false; }
	if (!TransferWindowGate(OutReason)) return false;
	const FFM13IncomingLoan Leihe = IncomingLoans[Idx];
	if (Money < Leihe.BuyOptionFee) { OutReason = FString::Printf(TEXT("Kaufoption nicht gedeckt: %lld noetig."), (long long)Leihe.BuyOptionFee); return false; }
	if (TransferBudget < Leihe.BuyOptionFee) { OutReason = FString::Printf(TEXT("Transferbudget reicht nicht: %lld noetig."), (long long)Leihe.BuyOptionFee); return false; }
	Book(FString(TEXT("Kaufoption: ")) + Squad[PIdx].Name, -Leihe.BuyOptionFee);
	TransferBudget -= Leihe.BuyOptionFee;
	Squad[PIdx].ContractYears = 3;
	IncomingLoans.RemoveAt(Idx);
	AddMessage(FString::Printf(TEXT("%s dauerhaft verpflichtet"), *Squad[PIdx].Name), FString::Printf(TEXT("%s wechselt dauerhaft von %s zum Verein."), *Squad[PIdx].Name, *Leihe.ParentClub));
	return true;
}

// tickIncomingLoans(): jeder Spieltag zaehlt herunter, abgelaufene Leihen kehren zurueck.
void FFM13World::TickIncomingLoans()
{
	for (int32 i = IncomingLoans.Num() - 1; i >= 0; --i)
	{
		FFM13IncomingLoan& L = IncomingLoans[i];
		L.MatchdaysLeft--;
		if (L.MatchdaysLeft > 0) continue;
		const int32 PIdx = Squad.IndexOfByPredicate([&L](const FFM13Player& P) { return P.Id == L.PlayerId; });
		if (PIdx >= 0)
		{
			AddMessage(FString::Printf(TEXT("Leihe beendet: %s"), *Squad[PIdx].Name), FString::Printf(TEXT("%s kehrt wie vereinbart zu %s zurueck."), *Squad[PIdx].Name, *L.ParentClub));
			Squad.RemoveAt(PIdx);
		}
		IncomingLoans.RemoveAt(i);
	}
}

// ---------- Deadline-Day (js/transfermarket.js: runDeadlineDay) ----------

bool FFM13World::TriggerRandomAIOffer()
{
	const int32 Schwelle = InterestThreshold();
	TArray<int32> Ziele;
	for (int32 i = 0; i < Squad.Num(); ++i)
	{
		const FFM13Player& P = Squad[i];
		if (P.Strength >= Schwelle && !IncomingOffers.ContainsByPredicate([&P](const FFM13IncomingOffer& O) { return O.PlayerId == P.Id && !O.bYouth; })) Ziele.Add(i);
	}
	if (Ziele.Num() == 0) return false;
	const FFM13Player& Ziel = Squad[Ziele[RngTransfer.RandRange(0, Ziele.Num() - 1)]];
	const FString Verein = RandomOpposingClub(true);
	const double Multiplikator = 0.85 + RngTransfer.FRand() * 0.35;
	return TriggerAIOffer(Ziel.Id, Verein, Multiplikator);
}

void FFM13World::RunDeadlineDay(const FString& Fenster)
{
	const FString Schluessel = FString::Printf(TEXT("%d-%s"), Season, *Fenster);
	if (LastDeadlineKey == Schluessel) return;
	LastDeadlineKey = Schluessel;
	TArray<FString> Ticker;

	// Last-Minute-Angebote fuer eigene Spieler, nur bis zum naechsten Spieltag gueltig
	const int32 Vorher = IncomingOffers.Num();
	const int32 Anzahl = 3 + RngTransfer.RandRange(0, 2);
	for (int32 i = 0; i < Anzahl; ++i) TriggerRandomAIOffer();
	for (int32 i = Vorher; i < IncomingOffers.Num(); ++i)
	{
		IncomingOffers[i].ExpiresMatchday = Matchday + 1;
		Ticker.Add(FString::Printf(TEXT("%s bietet in letzter Minute %lld fuer %s"), *IncomingOffers[i].Club, (long long)IncomingOffers[i].Price, *IncomingOffers[i].PlayerName));
	}

	// Drei Klubs der eigenen Liga holen kurz vor Schluss einen Neuzugang
	TArray<int32> Klubs;
	if (Leagues.IsValidIndex(LeagueLevel))
		for (int32 i = 0; i < Leagues[LeagueLevel].Clubs.Num(); ++i) if (!Leagues[LeagueLevel].Clubs[i].bOwn) Klubs.Add(i);
	for (int32 k = 0; k < 3 && Klubs.Num() > 0; ++k)
	{
		const int32 Wahl = RngTransfer.RandRange(0, Klubs.Num() - 1);
		FFM13Club& C = Leagues[LeagueLevel].Clubs[Klubs[Wahl]];
		Klubs.RemoveAt(Wahl);
		const int32 Plus = 1 + RngTransfer.RandRange(0, 2);
		C.Strength = FMath::Min(96, C.Strength + Plus);
		Ticker.Add(FString::Printf(TEXT("%s holt kurz vor Schluss einen Neuzugang (Staerke +%d)"), *C.Name, Plus));
	}

	// Zwei Marktspieler werden zum Schnaeppchen: Marktwert minus 30 %, Forderung neu
	TArray<int32> Markt;
	for (int32 i = 0; i < Market.Num(); ++i) if (!Market[i].bDeadlineBargain) Markt.Add(i);
	for (int32 k = 0; k < 2 && Markt.Num() > 0; ++k)
	{
		const int32 Wahl = RngTransfer.RandRange(0, Markt.Num() - 1);
		FFM13MarketOffer& O = Market[Markt[Wahl]];
		Markt.RemoveAt(Wahl);
		O.Player.MarketValue = FMath::Max<int64>(5000, FM13Transfers::JsRunden((double)O.Player.MarketValue * 0.7 / 5000.0) * 5000);
		O.bDeadlineBargain = true;
		SetMarketTerms(O);
		Ticker.Add(FString::Printf(TEXT("Schnaeppchen: %s (%s, Staerke %d) fuer nur %lld zu haben"), *O.Player.Name, FM13PositionName(O.Player.Pos), O.Player.Strength, (long long)O.AskingPrice));
	}

	FString Text;
	for (const FString& Zeile : Ticker) Text += FString(TEXT("- ")) + Zeile + TEXT("\n");
	AddMessage(FString::Printf(TEXT("DEADLINE-DAY (%s)"), Fenster == TEXT("winter") ? TEXT("Winter") : TEXT("Sommer")),
		Text.Len() ? Text : FString(TEXT("Die Wechselperiode schliesst - ruhiger letzter Tag.")));
}

// ---------- Berater, freie Spieler, Tausch (js/transfer-poker.js, js/entities.js, js/transfermarket.js) ----------

namespace
{
	const TCHAR* AgentNamen[] = { TEXT("Klaus Berger"), TEXT("Sandra Voigt"), TEXT("Marco Lindner"), TEXT("Julia Sommer"), TEXT("Thomas Krause"), TEXT("Nina Falk"), TEXT("Ruediger Stahl"), TEXT("Petra Wolff") };
}

FString FFM13World::AgentName(int32 AgentIndex)
{
	return AgentNamen[FMath::Clamp(AgentIndex, 0, 7)];
}

int32 FFM13World::AgentRelationLevelIndex(int32 AgentIndex) const
{
	return AgentRelationKeys.IndexOfByPredicate([AgentIndex](int32 K) { return K == AgentIndex; });
}

int32 FFM13World::AgentRelation(int32 AgentIndex) const
{
	const int32 I = AgentRelationLevelIndex(AgentIndex);
	return I >= 0 ? AgentRelationVals[I] : 0;
}

// getAgentFee(): Provision je Geldtransfer, eine gepflegte Beziehung senkt sie (0,1 Prozentpunkte je Stufe)
int64 FFM13World::AgentFee(const FFM13Player& P, int64 Basis) const
{
	if (!P.bHasAgent) return 0;
	const double Satz = FMath::Max(0.01, P.AgentFeePct - AgentRelation(P.AgentIndex) * 0.001);
	return FM13Transfers::JsRunden((double)Basis * Satz);
}

// improveAgentRelationship(): kostet 3.000 plus 500 je Stufe, Stufe plus 5, hoechstens 30
bool FFM13World::ImproveAgentRelation(int32 AgentIndex, FString& OutReason)
{
	const int32 Stufe = AgentRelation(AgentIndex);
	const int64 Kosten = 3000 + (int64)Stufe * 500;
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Geld! Benoetigt: %lld"), (long long)Kosten); return false; }
	Book(FString(TEXT("Beratervertrauen: ")) + AgentName(AgentIndex), -Kosten);
	const int32 Neu = FMath::Min(30, Stufe + 5);
	const int32 I = AgentRelationLevelIndex(AgentIndex);
	if (I >= 0) AgentRelationVals[I] = Neu;
	else { AgentRelationKeys.Add(AgentIndex); AgentRelationVals.Add(Neu); }
	return true;
}

// finalizePlayerPurchase(): alle Pruefungen an einer Stelle, dann Abschluss.
bool FFM13World::FinalizePurchase(const FFM13Player& Kauf, int64 Ablose, int64 Gehalt, int32 TauschId, const FFM13MedBefund& Befund, const FString& Verkaeufer, FString& OutReason)
{
	if (HasTransferEmbargo()) { OutReason = TEXT("Transfersperre: das Konto ist im Minus."); return false; }
	const int32 TauschIdx = TauschId ? Squad.IndexOfByPredicate([TauschId](const FFM13Player& P) { return P.Id == TauschId; }) : -1;
	if (TauschId && (TauschIdx < 0 || !IsSwapCandidate(Squad[TauschIdx], Kauf, Verkaeufer)))
	{ OutReason = TEXT("Dieser Spieler kommt fuer den Tausch nicht (mehr) in Frage."); return false; }
	const FFM13Player* Tausch = TauschIdx >= 0 ? &Squad[TauschIdx] : nullptr;
	const int64 Anrechnung = Tausch ? SwapValue(*Tausch, Kauf, Verkaeufer, Ablose) : 0;
	const int64 Bar = Ablose - Anrechnung;
	// Der Tauschspieler zaehlt wie ein Verkauf: sein Berater kassiert auf die Anrechnung
	const int64 Beraterkosten = AgentFee(Kauf, Ablose) + (Tausch ? AgentFee(*Tausch, Anrechnung) : 0);
	const int64 BudgetBedarf = Bar + FM13Transfers::JsRunden((double)Anrechnung * 0.15);
	const int64 Gesamt = Bar + Beraterkosten;
	if (Money < Gesamt) { OutReason = FString::Printf(TEXT("Vereinskonto reicht nicht: %lld noetig."), (long long)Gesamt); return false; }
	if (TransferBudget < BudgetBedarf) { OutReason = FString::Printf(TEXT("Transferbudget reicht nicht: %lld noetig, %lld verfuegbar."), (long long)BudgetBedarf, (long long)TransferBudget); return false; }
	const int64 Lohnsumme = WagesPerMatchday() - (Tausch ? Tausch->Wage : 0);
	if (Lohnsumme + Gehalt > WageBudget) { OutReason = TEXT("Das Gehalt sprengt das Gehaltsbudget des Vorstands."); return false; }

	Book(FString(TEXT("Spielerkauf: ")) + Kauf.Name, -Gesamt);
	TransferBudget -= BudgetBedarf;
	if (Tausch)
	{
		const FFM13Player Weg = *Tausch;
		Squad.RemoveAt(TauschIdx);
		ManualLineup.RemoveAll([&Weg](int32 Id) { return Id == Weg.Id; });
		ManualBench.RemoveAll([&Weg](int32 Id) { return Id == Weg.Id; });
		AddMessage(TEXT("Tausch"), FString::Printf(TEXT("%s geht zu %s - angerechnet auf die Ablöse für %s: %lld, bar gezahlt: %lld."), *Weg.Name, *Verkaeufer, *Kauf.Name, (long long)Anrechnung, (long long)Bar));
	}
	FFM13Player P = Kauf;
	P.Wage = (int32)Gehalt;
	Squad.Add(P);
	ApplyMedicalOnArrival(Squad.Last(), Befund);
	return true;
}

// isSwapCandidate(): Tauschspieler jung genug, gesund, nicht geliehen, und der Verkaeufer braucht ihn
bool FFM13World::IsSwapCandidate(const FFM13Player& Tausch, const FFM13Player& Kauf, const FString& Verkaeufer) const
{
	if (Tausch.Age > 30 || Tausch.InjuredMatchdays > 0) return false;
	if (IncomingLoans.ContainsByPredicate([&Tausch](const FFM13IncomingLoan& L) { return L.PlayerId == Tausch.Id; })) return false;
	if (Squad.Num() <= 17) return false;   // SWAP_MIN_SQUAD
	EFM13Playstyle Stil;
	const int32 VereinsStaerke = Verkaeufer.IsEmpty() ? Kauf.Strength : ClubStrength(Verkaeufer, Stil);
	const int32 Minimum = FMath::Max(Kauf.Strength - 10, VereinsStaerke - 4);   // SWAP_MAX_GAP, SWAP_CLUB_GAP
	return Tausch.Strength >= Minimum;
}

int64 FFM13World::SwapValue(const FFM13Player& Tausch, const FFM13Player& Kauf, const FString& Verkaeufer, int64 Ablose) const
{
	if (!IsSwapCandidate(Tausch, Kauf, Verkaeufer)) return 0;
	return FMath::Min<int64>(Ablose, FM13Transfers::JsRunden((double)Tausch.MarketValue * 0.85 / 1000.0) * 1000);
}

bool FFM13World::SetPokerSwap(int32 PlayerId, FString& OutReason)
{
	if (!Poker.bActive) { OutReason = TEXT("Keine Verhandlung offen."); return false; }
	Poker.SwapId = PlayerId;
	return true;
}

// Freie Spieler: vier je Markt-Neuaufbau, Handgeld sechs Gehaelter. Wuerfelt mit dem Transfer-Zufall.
void FFM13World::RefreshFreeAgents()
{
	FreeAgents.Reset();
	const int32 MinStaerke = 50 + (3 - LeagueLevel) * 9;
	const int32 MaxStaerke = MinStaerke + 9;
	FRandomStream Haupt = Rng;
	Rng = RngTransfer;
	for (int32 i = 0; i < 4; ++i)
	{
		FFM13FreeAgent F;
		const int32 W = RngTransfer.RandRange(0, 3);
		F.Player = CreatePlayer((EFM13Position)W, FMath::Max(40, MinStaerke - 4), MaxStaerke - 2, 19, 31);
		F.Player.MarketValue = 0;
		F.Player.ContractYears = 1;
		F.SignOnFee = FM13Transfers::JsRunden((double)F.Player.Wage * 6.0);
		FreeAgents.Add(F);
	}
	RngTransfer = Rng;
	Rng = Haupt;
	FreeNegotiation = FFM13FreeNegotiation();
}

// signFreeAgent(): zaehe Charaktere fordern manchmal ein Gegenangebot, das zweite Mal wird akzeptiert.
bool FFM13World::SignFreeAgent(int32 Index, FString& OutReason)
{
	if (!FreeAgents.IsValidIndex(Index)) { OutReason = TEXT("Dieser Spieler ist nicht mehr zu haben."); return false; }
	if (HasTransferEmbargo()) { OutReason = TEXT("Transfersperre aktiv."); return false; }
	const FFM13FreeAgent F = FreeAgents[Index];
	const double Zaehigkeit = FM13Poker::Zaehigkeit(F.Player.Character);
	if (FreeNegotiation.PlayerId != F.Player.Id)
	{
		const double Chance = FMath::Min(0.75, 0.25 * Zaehigkeit);
		if (RngTransfer.FRand() < Chance)
		{
			FreeNegotiation.PlayerId = F.Player.Id;
			FreeNegotiation.CounterFee = FM13Transfers::JsRunden((double)F.SignOnFee * (1.15 + (Zaehigkeit - 1.0) * 0.3));
			OutReason = FString::Printf(TEXT("%s verlangt ein Gegenangebot: %lld statt %lld Handgeld. Nochmal wählen zum Akzeptieren."), *F.Player.Name, (long long)FreeNegotiation.CounterFee, (long long)F.SignOnFee);
			return false;
		}
	}
	const int64 Handgeld = FreeNegotiation.PlayerId == F.Player.Id ? FreeNegotiation.CounterFee : F.SignOnFee;
	if (Money < Handgeld) { OutReason = FString::Printf(TEXT("Handgeld nicht gedeckt: %lld noetig."), (long long)Handgeld); return false; }
	if (!FitsWageBudget(F.Player.Wage)) { OutReason = TEXT("Das Gehalt sprengt das Gehaltsbudget des Vorstands."); return false; }
	if (Squad.Num() >= FM13::MaxSquadSize) { OutReason = TEXT("Der Kader ist voll (30 Spieler)."); return false; }
	Book(FString(TEXT("Handgeld Vereinslose: ")) + F.Player.Name, -Handgeld);
	FFM13Player P = F.Player;
	Squad.Add(P);
	FreeAgents.RemoveAt(Index);
	FreeNegotiation = FFM13FreeNegotiation();
	AddMessage(TEXT("Neuzugang"), FString::Printf(TEXT("%s unterschreibt ablösefrei (Handgeld %lld)."), *P.Name, (long long)Handgeld));
	return true;
}

// ---------- Wechsel zwischen KI-Vereinen (js/ai-clubs.js) ----------

namespace
{
	// makeAiStar(): Staerke des Sterns = Vereinsstaerke + Zuschlag (5, jung 2) + Zufall x 5, hoechstens 95
	int32 AiStarStaerke(FRandomStream& Rng, int32 Vereinsstaerke, int32 Zuschlag)
	{
		const double Wert = (double)Vereinsstaerke + (double)Zuschlag + Rng.FRand() * 5.0;
		return FMath::Min(95, (int32)FM13Transfers::JsRunden(Wert));
	}

	const EFM13Position AiStarPositionen[6] = { EFM13Position::ST, EFM13Position::ST, EFM13Position::MIT, EFM13Position::MIT, EFM13Position::ABW, EFM13Position::TW };
	const int32 AiTransferSpieltage[2] = { 2, 19 };   // Sommer- und Winterfenster
}

bool FFM13World::IsAiClub(const FFM13Club& C) const
{
	return !C.bOwn;
}

void FFM13World::AddAiNews(const FFM13AiNews& Eintrag)
{
	AiNews.Insert(Eintrag, 0);
	while (AiNews.Num() > 30) AiNews.RemoveAt(AiNews.Num() - 1);
}

// makeAiStar(): Staerke aus dem Verein plus 5 (jung 2), Alter 22 bis 30 (jung 19 bis 21)
void FFM13World::EnsureAiStars()
{
	for (int32 L = 0; L < Leagues.Num(); ++L)
		for (int32 I = 0; I < Leagues[L].Clubs.Num(); ++I)
		{
			FFM13Club& C = Leagues[L].Clubs[I];
			if (!IsAiClub(C) || C.bHasStar) continue;
			C.bHasStar = true;
			C.StarPos = AiStarPositionen[RngTransfer.RandRange(0, 5)];
			C.StarStrength = AiStarStaerke(RngTransfer, C.Strength, 5);
			C.StarAge = RngTransfer.RandRange(22, 30);
			C.StarName = FM13Names::PlayerName(RngTransfer);
			C.StarGoals = 0;
		}
}

FFM13World::FFM13AiNews FFM13World::AiStarNews(int32 L, int32 I) const
{
	const FFM13Club& C = Leagues[L].Clubs[I];
	FFM13AiNews N;
	N.Player = C.StarName;
	N.Pos = C.StarPos;
	N.Strength = C.StarStrength;
	N.From = C.Name;
	return N;
}

// tickAiTransfers(): an den Fenster-Spieltagen 1 bis 2 Wechsel je Liga, Staerke wandert mit dem Spieler
void FFM13World::TickAiTransfers()
{
	bool bFenster = false;
	for (int32 Tag : AiTransferSpieltage) if (Matchday == Tag) bFenster = true;
	if (!bFenster) return;
	EnsureAiStars();
	struct FMeldung { int32 Liga; FString Text; };
	TArray<FMeldung> Meldungen;
	for (int32 L = 0; L < Leagues.Num(); ++L)
	{
		// Tabelle der KI-Vereine: Punkte, dann Staerke
		TArray<int32> Tabelle;
		for (int32 I = 0; I < Leagues[L].Clubs.Num(); ++I) if (IsAiClub(Leagues[L].Clubs[I])) Tabelle.Add(I);
		auto Punkte = [this, L](int32 I) { const FFM13Club& C = Leagues[L].Clubs[I]; return 3 * C.Won + C.Drawn; };
		// stabile Einfuegesortierung: Punkte absteigend, dann Staerke absteigend
		for (int32 a = 1; a < Tabelle.Num(); ++a)
			for (int32 b = a; b > 0; --b)
			{
				const int32 X = Tabelle[b - 1], Y = Tabelle[b];
				const bool bTauschen = Punkte(Y) > Punkte(X) || (Punkte(Y) == Punkte(X) && Leagues[L].Clubs[Y].Strength > Leagues[L].Clubs[X].Strength);
				if (!bTauschen) break;
				Tabelle[b - 1] = Y; Tabelle[b] = X;
			}
		if (Tabelle.Num() < 8) continue;
		const int32 Deals = 1 + (RngTransfer.FRand() < 0.5f ? 1 : 0);
		for (int32 d = 0; d < Deals; ++d)
		{
			const int32 Kaeufer = Tabelle[RngTransfer.RandRange(0, FMath::Min(5, Tabelle.Num()) - 1)];
			int32 VerkaeuferLiga = L;
			int32 Verkaeufer = -1;
			if (L < Leagues.Num() - 1 && RngTransfer.FRand() < 0.35f)
			{
				// Star der besten Stern-Staerke in der Liga darunter
				VerkaeuferLiga = L + 1;
				int32 Bester = -1;
				for (int32 I = 0; I < Leagues[L + 1].Clubs.Num(); ++I)
				{
					const FFM13Club& C = Leagues[L + 1].Clubs[I];
					if (!IsAiClub(C)) continue;
					if (Bester < 0 || C.StarStrength > Leagues[L + 1].Clubs[Bester].StarStrength) Bester = I;
				}
				Verkaeufer = Bester;
			}
			else
			{
				TArray<int32> Kandidaten;
				for (int32 k = Tabelle.Num() / 2; k < Tabelle.Num(); ++k) if (Tabelle[k] != Kaeufer) Kandidaten.Add(Tabelle[k]);
				if (Kandidaten.Num()) Verkaeufer = Kandidaten[RngTransfer.RandRange(0, Kandidaten.Num() - 1)];
			}
			if (Verkaeufer < 0) continue;
			const FFM13Club& K = Leagues[L].Clubs[Kaeufer];
			FFM13Club& V = Leagues[VerkaeuferLiga].Clubs[Verkaeufer];
			if (!V.bHasStar || (VerkaeuferLiga == L && Verkaeufer == Kaeufer)) continue;
			if (V.StarStrength < K.Strength) continue;   // nur echte Verstaerkungen
			FFM13Club& KW = Leagues[L].Clubs[Kaeufer];
			// Wechsel: Kaeufer bekommt den Star, Verkaeufer ein Nachwuchstalent
			const int32 Delta = FMath::Max(1, FMath::Min(2, (int32)FM13Transfers::JsRunden((double)(V.StarStrength - KW.Strength) / 6.0)));
			KW.Strength = FMath::Min(96, KW.Strength + Delta);
			V.Strength = FMath::Max(20, V.Strength - Delta);
			const int64 Ablose = FM13Transfers::JsRunden((double)FM13Economy::MarketValue(V.StarStrength, nullptr) * (1.1 + RngTransfer.FRand() * 0.4) / 10000.0) * 10000;
			if (!KW.bHasStar || V.StarStrength > KW.StarStrength)
			{
				KW.bHasStar = true; KW.StarPos = V.StarPos; KW.StarName = V.StarName; KW.StarStrength = V.StarStrength; KW.StarAge = V.StarAge; KW.StarGoals = V.StarGoals;
			}
			FFM13AiNews N;
			N.Player = V.StarName; N.Pos = V.StarPos; N.Strength = V.StarStrength; N.From = V.Name; N.To = KW.Name;
			N.Fee = Ablose; N.FromLeague = VerkaeuferLiga; N.ToLeague = L;
			N.Season = Season; N.Matchday = Matchday;
			AddAiNews(N);
			// Der Verkaeufer bekommt ein Nachwuchstalent als neuen Star
			V.StarPos = AiStarPositionen[RngTransfer.RandRange(0, 5)];
			V.StarStrength = AiStarStaerke(RngTransfer, V.Strength, 2);
			V.StarAge = RngTransfer.RandRange(19, 21);
			V.StarName = FM13Names::PlayerName(RngTransfer);
			V.StarGoals = 0;
			Meldungen.Add(FMeldung{ L, FString::Printf(TEXT("%s (%s, %d) wechselt von %s zu %s - Ablöse %lld"), *N.Player, FM13PositionName(N.Pos), N.Strength, *N.From, *N.To, (long long)Ablose) });
		}
	}
	if (Meldungen.Num() == 0) return;
	// Eigene Liga zuerst
	TArray<FMeldung> Sortiert;
	for (const FMeldung& M : Meldungen) if (M.Liga == LeagueLevel) Sortiert.Add(M);
	for (const FMeldung& M : Meldungen) if (M.Liga != LeagueLevel) Sortiert.Add(M);
	FString Text;
	for (const FMeldung& M : Sortiert) Text += FString(TEXT("- ")) + FM13::LeagueName(M.Liga) + TEXT(": ") + M.Text + TEXT("\n");
	AddMessage(FString::Printf(TEXT("Transfer-Ticker (%s)"), Matchday < 10 ? TEXT("Sommer") : TEXT("Winter")), Text);
}

// ageAiStars(): Saisonende, Karriereende mit 34 und ein neuer Star beim Verein
void FFM13World::AgeAiStars()
{
	EnsureAiStars();
	for (int32 L = 0; L < Leagues.Num(); ++L)
		for (int32 I = 0; I < Leagues[L].Clubs.Num(); ++I)
		{
			FFM13Club& C = Leagues[L].Clubs[I];
			if (!IsAiClub(C) || !C.bHasStar) continue;
			C.StarAge++;
			if (C.StarAge < 34) continue;
			FFM13AiNews N;
			N.Player = C.StarName; N.Pos = C.StarPos; N.Strength = C.StarStrength; N.From = C.Name; N.Fee = 0; N.bRetired = true;
			N.Season = Season; N.Matchday = Matchday; N.FromLeague = L; N.ToLeague = L;
			AddAiNews(N);
			C.StarPos = AiStarPositionen[RngTransfer.RandRange(0, 5)];
			C.StarStrength = AiStarStaerke(RngTransfer, C.Strength, 5);
			C.StarAge = RngTransfer.RandRange(22, 30);
			C.StarName = FM13Names::PlayerName(RngTransfer);
			C.StarGoals = 0;
		}
}

// creditAiLeagueGoals(): Anteil je Position fuer den Star, 26 % fuer die Sturmspitze, der Rest ungenannt
void FFM13World::CreditAiLeagueGoals(FFM13Club& C, int32 Tore)
{
	if (!IsAiClub(C) || Tore <= 0) return;
	if (!C.bHasStar) { EnsureAiStars(); }
	if (!C.bHasStriker) { C.bHasStriker = true; C.StrikerName = FM13Names::PlayerName(RngTransfer); C.StrikerGoals = 0; }
	double Anteil = 0.15;
	switch (C.StarPos)
	{
		case EFM13Position::ST: Anteil = 0.3; break;
		case EFM13Position::MIT: Anteil = 0.18; break;
		case EFM13Position::ABW: Anteil = 0.07; break;
		case EFM13Position::TW: Anteil = 0.0; break;
	}
	for (int32 i = 0; i < Tore; ++i)
	{
		const double Wurf = RngTransfer.FRand();
		if (Wurf < Anteil) C.StarGoals++;
		else if (Wurf < Anteil + 0.26) C.StrikerGoals++;
	}
}

// ---------- Financial Fairplay (js/ffp.js) ----------

// Stadion, Vereinsgelaende und Jugend zaehlen nicht als Verlust. Im C++-Kern heissen die Buchungen so.
bool FFM13World::FfpExempt(const FString& Label)
{
	return Label == TEXT("Stadionausbau") || Label == TEXT("Ausbau Jugendakademie") || Label == TEXT("Ausbau Trainingsplatz")
		|| Label == TEXT("Kredit: Aufnahme") || Label == TEXT("Kredit: Rate") || Label == TEXT("Kredit: Sondertilgung")
		|| Label == TEXT("Kredit: Soforthilfe") || Label == TEXT("Kredit: Tilgung")
		|| Label == TEXT("Festgeld: Anlage") || Label == TEXT("Festgeld: Auszahlung");   // Finanzierung, kein Verlust (FFP_EXEMPTE_LABELS)
}

int64 FFM13World::FfpSeasonNet() const
{
	int64 Summe = 0;
	for (const FFM13Booking& B : Bookings) if (B.Season == Season && !FfpExempt(B.Label)) Summe += B.Amount;
	return Summe;
}

int64 FFM13World::FfpAllowedLossPerSeason() const
{
	return FM13Transfers::JsRunden((double)FM13Economy::LeagueBaseTvMoney(LeagueLevel) * 0.20);
}

// evaluateFinancialFairplay(): Saisonende, vor Season++. Verwarnung, dann Transfersperre, dann Punktabzug.
void FFM13World::EvaluateFinancialFairplay()
{
	const int64 Netto = FfpSeasonNet();
	FfpHistory.Add(Netto);
	if (FfpHistory.Num() > 3) FfpHistory.RemoveAt(0);
	int64 Kumulativ = 0;
	for (int64 N : FfpHistory) Kumulativ += N;
	const int64 Erlaubt = FfpAllowedLossPerSeason() * FfpHistory.Num();
	const bool bVerstoss = Kumulativ < -Erlaubt;
	FfpLastResult = FFM13FfpResult();
	FfpLastResult.Season = Season;
	FfpLastResult.Net = Netto;
	FfpLastResult.Kumulativ = Kumulativ;
	FfpLastResult.Erlaubt = Erlaubt;
	FfpLastResult.Ueberwacht = FfpHistory.Num();
	FfpLastResult.bVerstoss = bVerstoss;
	bHasFfpResult = true;
	PendingFfpDeduction = 0;

	if (!bVerstoss)
	{
		// Ein sauberes Jahr baut Vertrauen wieder auf
		if (FfpStrikes > 0) FfpStrikes--;
		if (FfpStrikes == 0) bFfpEmbargo = false;
		return;
	}
	FfpStrikes++;
	const int64 Ueberschreitung = -Kumulativ - Erlaubt;
	if (FfpStrikes == 1)
	{
		AddMessage(TEXT("Financial-Fairplay-Verwarnung"), FString::Printf(TEXT("Der Verband hat die Bilanzen der letzten %d Saison(en) geprueft: %lld zu viel Verlust. Es bleibt bei einer Verwarnung - bei anhaltendem Verstoss drohen eine Transfersperre und ein Punktabzug."), FfpHistory.Num(), (long long)Ueberschreitung));
	}
	else if (FfpStrikes == 2)
	{
		bFfpEmbargo = true;
		AddMessage(TEXT("Financial-Fairplay: Transfersperre"), TEXT("Wiederholter Verstoss gegen die Ausgabenregeln - Transfersperre, bis die Bilanzen wieder im erlaubten Rahmen liegen."));
	}
	else
	{
		bFfpEmbargo = true;
		PendingFfpDeduction = FMath::Min(9, (FfpStrikes - 2) * 3);
		AddMessage(TEXT("Financial-Fairplay: Punktabzug"), FString::Printf(TEXT("Anhaltender Verstoss - zusaetzlich zur Transfersperre %d Punkte Abzug fuer die neue Saison."), PendingFfpDeduction));
	}
}

// applyPendingFfpPointDeduction(): direkt nach dem Tabellen-Neustart, ohne Untergrenze bei 0.
void FFM13World::ApplyPendingFfpPointDeduction()
{
	if (PendingFfpDeduction <= 0) return;
	if (Leagues.IsValidIndex(LeagueLevel))
		for (FFM13Club& C : Leagues[LeagueLevel].Clubs) if (C.bOwn) C.PointDeduction += PendingFfpDeduction;
	PendingFfpDeduction = 0;
}

// ---------- Erfolgsbasierte Vertragsboni (js/bonusclauses.js) ----------

namespace
{
	const TCHAR* BonusNamen[3] = { TEXT("Torbonus"), TEXT("Einsatzbonus"), TEXT("Aufstiegsbonus") };
}

// Mindestbetrag: Tor 1,2 %, Einsatz 0,7 %, Aufstieg 2 % des Marktwerts (jeweils mit Untergrenze)
int64 FFM13World::BonusMindest(const FFM13Player& P, int32 Typ)
{
	switch (Typ)
	{
		case 0: return FMath::Max<int64>(500, FM13Transfers::JsRunden((double)P.MarketValue * 0.012));
		case 1: return FMath::Max<int64>(300, FM13Transfers::JsRunden((double)P.MarketValue * 0.007));
		default: return FMath::Max<int64>(1000, FM13Transfers::JsRunden((double)P.MarketValue * 0.02));
	}
}

bool FFM13World::SetBonusClause(int32 PlayerId, int32 Typ, int32 Schwelle, int64 Betrag, FString& OutReason)
{
	if (Typ < 0 || Typ > 2) { OutReason = TEXT("Unbekannte Klausel."); return false; }
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (Typ != 2 && Schwelle <= 0) { OutReason = TEXT("Bitte eine gueltige Schwelle angeben."); return false; }
	if (Betrag <= 0) { OutReason = TEXT("Bitte einen gueltigen Bonusbetrag angeben."); return false; }
	const int64 Mindest = BonusMindest(*P, Typ);
	if (Betrag < Mindest) { OutReason = FString::Printf(TEXT("%s verlangt fuer diese Klausel mindestens %lld."), *P->Name, (long long)Mindest); return false; }
	P->Bonus[Typ].bAktiv = true;
	P->Bonus[Typ].Schwelle = Typ == 2 ? 0 : Schwelle;
	P->Bonus[Typ].Betrag = Betrag;
	P->bBonusBezahlt[Typ] = false;   // eine neue Klausel ist noch nicht eingeloest
	P->Morale = FMath::Min(100, P->Morale + 3);
	return true;
}

bool FFM13World::RemoveBonusClause(int32 PlayerId, int32 Typ, FString& OutReason)
{
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P || Typ < 0 || Typ > 2) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	P->Bonus[Typ] = FFM13Player::FFM13BonusKlausel();
	return true;
}

// payOutBonusClause(): bucht ueber den Kontoauszug, die Beraterprovision kommt dazu
void FFM13World::PayOutBonusClause(FFM13Player& P, int32 Typ)
{
	if (!P.Bonus[Typ].bAktiv || P.bBonusBezahlt[Typ]) return;
	P.bBonusBezahlt[Typ] = true;
	const int64 Provision = AgentFee(P, P.Bonus[Typ].Betrag);
	Book(FString::Printf(TEXT("%s: %s"), BonusNamen[Typ], *P.Name), -(P.Bonus[Typ].Betrag + Provision));
	AddMessage(FString::Printf(TEXT("%s ausgezahlt: %s"), BonusNamen[Typ], *P.Name),
		FString::Printf(TEXT("%s hat die vereinbarte Bonusklausel erreicht - %lld werden ausgezahlt%s."), *P.Name, (long long)P.Bonus[Typ].Betrag,
			Provision > 0 ? *FString::Printf(TEXT(" (zzgl. %lld Beraterprovision)"), (long long)Provision) : TEXT("")));
}

// checkMatchdayBonusClauses(): Tore und Einsaetze der Saison, Aufstieg kommt separat
void FFM13World::CheckMatchdayBonusClauses(FFM13Player& P)
{
	if (P.Bonus[0].bAktiv && !P.bBonusBezahlt[0] && P.GoalsSeason >= P.Bonus[0].Schwelle) PayOutBonusClause(P, 0);
	if (P.Bonus[1].bAktiv && !P.bBonusBezahlt[1] && P.Appearances >= P.Bonus[1].Schwelle) PayOutBonusClause(P, 1);
}

void FFM13World::TriggerPromotionBonusClauses()
{
	for (FFM13Player& P : Squad) if (P.Bonus[2].bAktiv) PayOutBonusClause(P, 2);
}

// ---------- Platzerwartung, Mitgliederversammlung, Vorstand, Saisonwette (js/member-assembly.js, js/board-room.js) ----------

namespace
{
	const double AssemblyLeagueFactor[6] = { 1.0, 0.7, 0.45, 0.3, 0.2, 0.12 };   // ASSEMBLY_LEAGUE_FACTOR
	const int32 AssemblyAutoAfter = 6;     // Spieltage, bis die Versammlung ohne den Manager stattfindet
	const TCHAR* BoardFirst[10] = { TEXT("Klaus"), TEXT("Petra"), TEXT("Bernd"), TEXT("Anke"), TEXT("Helmut"), TEXT("Sabine"), TEXT("Wolfgang"), TEXT("Ute"), TEXT("Dieter"), TEXT("Monika") };
	const TCHAR* BoardLast[10] = { TEXT("Brenner"), TEXT("Hofmann"), TEXT("Kessler"), TEXT("Lang"), TEXT("Seifert"), TEXT("Albrecht"), TEXT("Vogt"), TEXT("Kraemer"), TEXT("Busch"), TEXT("Wendel") };
	// Beitragsantrag: Fans, Zustimmung, Geld (je nach Liga skaliert)
	struct FBeitrag { int32 Fans; int32 Zustimmung; int64 Geld; };
	const FBeitrag Beitraege[3] = { { 3, 4, -60000 }, { 0, 0, 0 }, { -4, -6, 120000 } };
	int32 Clamp100(int32 X) { return FMath::Clamp(X, 0, 100); }
}

FString FFM13World::BoardName(int32 Rolle) const
{
	// Namen aus der Vereinslaenge, wie im Browserspiel (feste Zuordnung je Verein)
	const int32 Seed = ClubName.Len();
	const int32 Vorname = (Seed + Rolle * 3) % 10;
	const int32 Nachname = (Seed * 2 + Rolle * 5) % 10;
	return FString::Printf(TEXT("%s %s"), BoardFirst[Vorname], BoardLast[Nachname]);
}

void FFM13World::RecordSeasonExpectationRank()
{
	// Erwartung: Platz der Elf-Staerke in der aktuellen Liga
	const int32 Teams = Leagues.IsValidIndex(LeagueLevel) ? Leagues[LeagueLevel].Clubs.Num() : 0;
	TArray<int32> Staerken;
	for (const FFM13Player& P : Squad) Staerken.Add(P.Strength);
	// absteigend sortieren (Einfuegesortierung), die besten elf zaehlen
	TArray<int32> Sortiert;
	for (int32 X : Staerken)
	{
		int32 Pos = Sortiert.Num();
		while (Pos > 0 && Sortiert[Pos - 1] < X) --Pos;
		Sortiert.Insert(X, Pos);
	}
	const int32 N = FMath::Min(11, Sortiert.Num());
	int64 Summe = 0;
	for (int32 i = 0; i < N; ++i) Summe += Sortiert[i];
	const double Eigen = N ? (double)Summe / N : 0.0;
	int32 Besser = 0;
	if (Leagues.IsValidIndex(LeagueLevel))
		for (const FFM13Club& C : Leagues[LeagueLevel].Clubs) if (!C.bOwn && (double)C.Strength > Eigen) Besser++;
	Expectation.Season = Season;
	Expectation.LeagueLevel = LeagueLevel;
	Expectation.Teams = Teams;
	Expectation.ExpectedRank = 1 + Besser;
	// Nach einem Abstieg wird Platz 3 erwartet: die Liga hat dort eigene Aufsteiger-Kandidaten
	if (RelegatedIntoSeason == Season) Expectation.ExpectedRank = FMath::Max(Expectation.ExpectedRank, 3);
}

void FFM13World::RecordSeasonExpectation()
{
	Expectation = FFM13Expectation();
	Expectation.Season = Season;
	Expectation.StartMoney = Money;
	RecordSeasonExpectationRank();
}

const FFM13World::FFM13Expectation& FFM13World::GetSeasonExpectation()
{
	if (Expectation.Season != Season) RecordSeasonExpectation();
	return Expectation;
}

// prepareMemberAssembly(): Bilanz der abgelaufenen Saison festhalten, vor dem Ligawechsel
void FFM13World::PrepareMemberAssembly(int32 FinalRank)
{
	const FFM13Expectation& E = GetSeasonExpectation();
	PendingAssemblyReport = FFM13AssemblyReport();
	PendingAssemblyReport.bValid = true;
	PendingAssemblyReport.Season = Season;
	PendingAssemblyReport.FinalRank = FinalRank;
	PendingAssemblyReport.ExpectedRank = E.ExpectedRank;
	PendingAssemblyReport.Teams = E.Teams;
	PendingAssemblyReport.LeagueLevel = LeagueLevel;
	PendingAssemblyReport.StartMoney = E.StartMoney;
	PendingAssemblyReport.Fans = Fans;
}

// openMemberAssembly(): nach Season++, Finanzergebnis abschliessen, Versammlung einberufen
void FFM13World::OpenMemberAssembly()
{
	const FFM13AssemblyReport R0 = PendingAssemblyReport;
	PendingAssemblyReport = FFM13AssemblyReport();
	Expectation = FFM13Expectation();
	Expectation.Season = Season;
	Expectation.StartMoney = Money;
	if (!R0.bValid) return;
	FFM13AssemblyReport R = R0;
	R.FinanceResult = Money - R0.StartMoney;
	R.bPromoted = LeagueLevel < R0.LeagueLevel;
	R.bRelegated = LeagueLevel > R0.LeagueLevel;
	MemberAssembly = FFM13MemberAssembly();
	MemberAssembly.bOpen = true;
	MemberAssembly.Report = R;
	MemberAssembly.OpenedMatchday = 1;
	MemberAssembly.Season = Season;
	bHasMemberAssembly = true;
	AddMessage(TEXT("Mitgliederversammlung einberufen"), FString::Printf(TEXT("Die Mitglieder erwarten deinen Bericht zur Saison %d (Platz %d, erwartet Platz %d). Bereite Rede und Beitragsantrag vor."), R.Season, R.FinalRank, R.ExpectedRank));
}

// assemblyBaseApproval(): Stimmung der Mitglieder aus der tatsaechlichen Saison
int32 FFM13World::AssemblyBaseApproval(const FFM13AssemblyReport& R) const
{
	double A = 55.0;
	A += FMath::Clamp((R.ExpectedRank - R.FinalRank) * 4, -25, 25);
	if (R.bPromoted) A += 15.0;
	if (R.bRelegated) A -= 20.0;
	A += R.FinanceResult >= 0 ? 5.0 : -8.0;
	A += (R.Fans - 60) / 4.0;
	return (int32)FMath::FloorToInt(A);
}

int32 FFM13World::SpeechEffect(int32 Speech, const FFM13AssemblyReport& R)
{
	const bool bGut = R.FinalRank <= R.ExpectedRank || R.bPromoted;
	if (Speech == 0) return bGut ? -3 : 6;    // selbstkritisch
	if (Speech == 1) return bGut ? 7 : -6;    // visionaer
	return R.FinanceResult >= 0 ? 3 : -2;     // zahlen
}

bool FFM13World::SetAssemblyChoice(bool bSpeech, int32 Value, FString& OutReason)
{
	if (!bHasMemberAssembly || !MemberAssembly.bOpen) { OutReason = TEXT("Keine offene Mitgliederversammlung."); return false; }
	if (bSpeech) { if (Value < 0 || Value > 2) return false; MemberAssembly.Speech = Value; }
	else { if (Value < 0 || Value > 2) return false; MemberAssembly.Fee = Value; }
	return true;
}

// holdMemberAssembly(): Zustimmung, Vorstandsfolge, Beitrag
bool FFM13World::HoldMemberAssembly(bool bAutomatisch, FString& OutReason)
{
	if (!bHasMemberAssembly || !MemberAssembly.bOpen) { OutReason = TEXT("Keine offene Mitgliederversammlung."); return false; }
	const FFM13AssemblyReport& R = MemberAssembly.Report;
	const FBeitrag& B = Beitraege[MemberAssembly.Fee];
	const double Faktor = AssemblyLeagueFactor[FMath::Clamp(LeagueLevel, 0, 5)];
	const int64 Betrag = FM13Transfers::JsRunden((double)B.Geld * Faktor / 1000.0) * 1000;
	if (Betrag < 0 && Money < -Betrag) { OutReason = FString::Printf(TEXT("Nicht genug Geld fuer die Beitragssenkung (%lld)."), (long long)-Betrag); return false; }

	const int32 Zustimmung = (int32)FM13Transfers::JsRunden(FMath::Max(5.0, FMath::Min(95.0, (double)(AssemblyBaseApproval(R) + SpeechEffect(MemberAssembly.Speech, R) + B.Zustimmung + (bAutomatisch ? -5 : 0)))));
	const bool bEntlastet = Zustimmung >= 50;
	// Nicht entlastet kostet einheitlich 10
	const int32 BoardDelta = Zustimmung >= 70 ? 10 : (bEntlastet ? 5 : -10);
	BoardSat = FMath::Clamp(BoardSat + BoardDelta, 10, 100);
	Fans = Clamp100(Fans + B.Fans);
	if (Betrag != 0) Book(TEXT("Mitgliedsbeitraege"), Betrag);

	MemberAssembly.bOpen = false;
	MemberAssembly.HeldMatchday = Matchday;
	MemberAssembly.Zustimmung = Zustimmung;
	MemberAssembly.bEntlastet = bEntlastet;
	MemberAssembly.BoardDelta = BoardDelta;
	MemberAssembly.Money = Betrag;
	MemberAssembly.bAutomatisch = bAutomatisch;
	AddMessage(bEntlastet ? TEXT("Mitgliederversammlung: entlastet") : TEXT("Mitgliederversammlung: nicht entlastet"),
		FString::Printf(TEXT("%s%d%% Zustimmung. Vorstandszufriedenheit %+d."), bAutomatisch ? TEXT("Die Versammlung fand ohne deine Vorbereitung statt. ") : TEXT(""), Zustimmung, BoardDelta));
	return true;
}

// Nach jedem Spieltag: unvorbereitete Versammlung findet nach sechs Spieltagen ohne den Manager statt.
void FFM13World::TickMemberAssembly()
{
	GetSeasonExpectation();
	if (bHasMemberAssembly && MemberAssembly.bOpen && Matchday - MemberAssembly.OpenedMatchday >= AssemblyAutoAfter)
	{
		FString Grund;
		HoldMemberAssembly(true, Grund);
	}
}

// Monatlich: Vorstandsmitglieder mit Stimmung unter 30 melden sich, je Saison und Rolle einmal.
void FFM13World::BoardViews(FFM13BoardView Out[4]) const
{
	const FFM13Expectation& E = Expectation;
	const int32 Rang = OwnRank();
	// Praesident
	Out[0].Mood = BoardSat;
	Out[0].Reason = BoardSat >= 60 ? TEXT("Zufrieden mit der Gesamtentwicklung.") : (BoardSat >= 35 ? TEXT("Erwartet eine Steigerung.") : TEXT("Stellt deine Arbeit offen infrage."));
	// Finanzvorstand
	const int64 Delta = E.Season == Season ? Money - E.StartMoney : 0;
	const int64 Basis = FMath::Max<int64>(20000, FMath::Abs(E.StartMoney) > 0 ? FMath::Abs(E.StartMoney) : 100000);
	const double Schwung = FMath::Max(-30.0, FMath::Min(30.0, (double)Delta / (double)Basis * 60.0));
	Out[1].Mood = FMath::Clamp((int32)FM13Transfers::JsRunden(55.0 + Schwung), 0, 100);
	Out[1].Reason = FString::Printf(TEXT("%s von %lld seit Saisonbeginn."), Delta >= 0 ? TEXT("Plus") : TEXT("Minus"), (long long)FMath::Abs(Delta));
	// Sportvorstand
	if (Rang > 0 && E.ExpectedRank > 0 && Matchday > 3)
	{
		Out[2].Mood = FMath::Clamp((int32)FM13Transfers::JsRunden(55.0 + (double)(E.ExpectedRank - Rang) * 6.0), 0, 100);
		Out[2].Reason = FString::Printf(TEXT("Platz %d, erwartet war Platz %d."), Rang, E.ExpectedRank);
	}
	else
	{
		Out[2].Mood = 55;
		Out[2].Reason = TEXT("Wartet die ersten Spieltage ab.");
	}
	// Nachwuchsleiter: Talente in der Jugend (die Akademie-Rangliste fehlt im C++-Kern)
	const int32 Talente = YouthTalents.Num();
	Out[3].Mood = FMath::Clamp((int32)FM13Transfers::JsRunden(35.0 + Talente * 5.0), 0, 100);
	Out[3].Reason = FString::Printf(TEXT("%d Talent(e) in der Jugend."), Talente);
}

void FFM13World::TickBoardRoom()
{
	FFM13BoardView V[4];
	BoardViews(V);
	const TCHAR* Titel[4] = { TEXT("Praesident"), TEXT("Finanzvorstand"), TEXT("Sportvorstand"), TEXT("Nachwuchsleiter") };
	const TCHAR* Rat[4] = { TEXT("erwaegt Konsequenzen, wenn sich nichts aendert."), TEXT("fordert einen Sparkurs - Gehaelter und laufende Kosten pruefen."), TEXT("verlangt bessere Ergebnisse - Aufstellung und Training ueberdenken."), TEXT("wuenscht mehr Talente in der Jugendabteilung.") };
	for (int32 R = 0; R < 4; ++R)
	{
		const FString Schluessel = FString::Printf(TEXT("%d-%d"), Season, R);
		if (V[R].Mood >= 30 || BoardWarned.Contains(Schluessel)) continue;
		BoardWarned.Add(Schluessel);
		AddMessage(FString::Printf(TEXT("%s %s ist unzufrieden"), Titel[R], *BoardName(R)), FString::Printf(TEXT("%s %s %s"), *V[R].Reason, *BoardName(R), Rat[R]));
	}
	// Schluessel alter Saisons werfen
	for (int32 i = BoardWarned.Num() - 1; i >= 0; --i)
	{
		const FString Praefix = FString::Printf(TEXT("%d-"), Season);
		if (BoardWarned[i].Left(Praefix.Len()) != Praefix) BoardWarned.RemoveAt(i);
	}
}

// setzeSaisonWette(): zwei Plaetze besser als die Erwartung, Platz mindestens 1
bool FFM13World::SetSaisonWette(FString& OutReason)
{
	const FFM13Expectation& E = GetSeasonExpectation();
	if (E.ExpectedRank <= 0) { OutReason = TEXT("Ohne Saisonziel des Vorstands gibt es keine Wette."); return false; }
	if (bHasWette && Wette.Season == Season) { OutReason = TEXT("Die Wette laeuft in dieser Saison schon."); return false; }
	Wette.Season = Season;
	Wette.Platz = FMath::Max(1, E.ExpectedRank - 2);
	bHasWette = true;
	return true;
}

// resolveSaisonWette(): Gewonnen gibt Praemie und Vertrauen, verloren zieht der Vorstand Vertrauen ab
void FFM13World::ResolveSaisonWette(int32 MyRank)
{
	if (!bHasWette || Wette.Season != Season) return;
	if (MyRank > 0 && MyRank <= Wette.Platz)
	{
		const int64 Praemie = (int64)(FM13::NumLeagues - LeagueLevel) * 150000;
		BoardSat = FMath::Min(100, BoardSat + 12);
		Book(TEXT("Saisonwette gewonnen"), Praemie);
		AddMessage(TEXT("Wette gewonnen"), FString::Printf(TEXT("Platz %d: die Wette auf Platz %d oder besser ist aufgegangen. Der Vorstand zahlt %lld."), MyRank, Wette.Platz, (long long)Praemie));
	}
	else
	{
		BoardSat = FMath::Max(0, BoardSat - 10);
		AddMessage(TEXT("Wette verloren"), FString::Printf(TEXT("Platz %d: die Wette auf Platz %d oder besser ist verloren. Der Vorstand zieht Vertrauen ab."), MyRank, Wette.Platz));
	}
	bHasWette = false;
}

// ---------- Wintergespraech (js/winter-talk.js) ----------

int64 FFM13World::WinterBudgetAmount() const
{
	return FM13Transfers::JsRunden((double)LeagueTransferBudget(LeagueLevel) * 0.3 / 1000.0) * 1000;
}

double FFM13World::WinterBudgetChance() const
{
	const int32 Rang = OwnRank();
	const int32 Erwartet = Expectation.ExpectedRank;
	const int32 Diff = (Rang > 0 && Erwartet > 0) ? Erwartet - Rang : 0;
	return FMath::Max(0.1, FMath::Min(0.9, 0.3 + Diff * 0.08 + (BoardSat - 50) / 200.0));
}

bool FFM13World::IsWinterTalkOpen() const
{
	return Matchday >= 18 && Matchday <= 20 && !(bHasWinterTalk && WinterTalk.Season == Season);
}

bool FFM13World::ChooseWinterTalk(EWinterWeg Weg, FString& OutReason)
{
	if (!IsWinterTalkOpen())
	{
		OutReason = (bHasWinterTalk && WinterTalk.Season == Season) ? TEXT("Das Wintergespraech hat schon stattgefunden.") : TEXT("Das Wintergespraech gibt es an den Spieltagen 18 bis 20.");
		return false;
	}
	const FFM13Expectation& E0 = GetSeasonExpectation();
	const int32 Erwartet = E0.ExpectedRank;
	const int32 Teams = E0.Teams;
	FFM13WinterTalk T;
	T.Season = Season;
	T.Weg = Weg;
	T.OldGoal = Erwartet;
	T.Goal = Erwartet;
	T.RankAtTalk = OwnRank();
	FString Text;
	switch (Weg)
	{
		case EWinterWeg::Hoch:
			if (Erwartet <= 1) { OutReason = TEXT("Hoeher als Platz 1 geht es nicht."); return false; }
			T.Goal = FMath::Max(1, Erwartet - 2);
			Expectation.ExpectedRank = T.Goal;
			T.Budget = WinterBudgetAmount();
			TransferBudget += T.Budget;
			BoardSat = FMath::Min(100, BoardSat + 5);
			Text = FString::Printf(TEXT("Neues Ziel Platz %d. Der Vorstand gibt %lld Winterbudget frei."), T.Goal, (long long)T.Budget);
			break;
		case EWinterWeg::Runter:
			if (Erwartet <= 0 || Erwartet >= Teams) { OutReason = TEXT("Tiefer laesst sich das Ziel nicht setzen."); return false; }
			T.Goal = FMath::Min(Teams, Erwartet + 2);
			Expectation.ExpectedRank = T.Goal;
			BoardSat = FMath::Max(10, BoardSat - 4);
			Text = FString::Printf(TEXT("Neues Ziel Platz %d. Der Vorstand ist enttaeuscht (-4), misst die Saison aber daran."), T.Goal);
			break;
		case EWinterWeg::Budget:
			if (RngTransfer.FRand() < WinterBudgetChance())
			{
				T.Budget = WinterBudgetAmount();
				TransferBudget += T.Budget;
				Text = FString::Printf(TEXT("Der Vorstand bewilligt %lld Winterbudget."), (long long)T.Budget);
			}
			else
			{
				BoardSat = FMath::Max(10, BoardSat - 3);
				Text = TEXT("Abgelehnt - erst die Leistung, dann das Geld (Vorstand -3).");
			}
			break;
		case EWinterWeg::Kurs:
			BoardSat = FMath::Min(100, BoardSat + 2);
			Text = TEXT("Ihr bleibt beim Kurs - der Vorstand schaetzt die Ruhe (+2).");
			break;
		default:
			return false;
	}
	WinterTalk = T;
	bHasWinterTalk = true;
	AddMessage(TEXT("Wintergespraech"), Text);
	return true;
}

// Nach jedem Spieltag: nach Spieltag 20 ohne Gespraech verpasst
void FFM13World::TickWinterTalk()
{
	if (Matchday > 20 && Matchday <= FM13::MatchdaysPerSeason && !(bHasWinterTalk && WinterTalk.Season == Season))
	{
		WinterTalk = FFM13WinterTalk();
		WinterTalk.Season = Season;
		WinterTalk.Weg = EWinterWeg::Verpasst;
		bHasWinterTalk = true;
		BoardSat = FMath::Max(10, BoardSat - 2);
		AddMessage(TEXT("Wintergespraech verpasst"), TEXT("Der Vorstand hat in der Winterpause vergeblich auf dich gewartet (-2)."));
	}
}

// Saisonende: ein erhoehtes Ziel wird eingeloest
void FFM13World::ResolveWinterTalk(int32 FinalRank)
{
	if (!bHasWinterTalk || WinterTalk.Season != Season || WinterTalk.Weg != EWinterWeg::Hoch || WinterTalk.Result != 0) return;
	if (FinalRank <= WinterTalk.Goal)
	{
		WinterTalk.Result = 1;
		BoardSat = FMath::Min(100, BoardSat + 5);
		AddMessage(TEXT("Winterversprechen gehalten"), FString::Printf(TEXT("Platz %d - das im Winter erhoehte Ziel (Platz %d) ist erreicht. Vorstand +5."), FinalRank, WinterTalk.Goal));
	}
	else
	{
		WinterTalk.Result = 2;
		BoardSat = FMath::Max(10, BoardSat - 10);
		AddMessage(TEXT("Winterversprechen gebrochen"), FString::Printf(TEXT("Platz %d statt des im Winter versprochenen Platzes %d. Vorstand -10."), FinalRank, WinterTalk.Goal));
	}
}

// ---------- Rohstoffboerse und Immobilien (js/commodities.js, js/real-estate.js) ----------

namespace
{
	// STADIUM_COST_SCALE je Liga: Bauten und Immobilien werden in tieferen Ligen guenstiger
	const double StadionKostenSkala[6] = { 1.0, 0.55, 0.28, 0.14, 0.07, 0.035 };
	double KostenSkala(int32 Liga) { return (Liga >= 0 && Liga < 6) ? StadionKostenSkala[Liga] : 0.035; }
	double Auf2(double X) { return std::round(X * 100.0) / 100.0; }   // toFixed(2)
}

void FFM13World::TickCommodityMarket()
{
	// Ereignisse: 22 % Wahrscheinlichkeit je Spieltag, sonst ruhiger Handel
	const bool bEreignis = RngIndustrie.FRand() < 0.22f;
	if (bEreignis)
	{
		struct FEreignis { const TCHAR* Text; int32 Mat; double Faktor; };   // Mat -1: alle
		const FEreignis Liste[5] = {
			{ TEXT("Frachterblockade im Suezkanal: Baumwolle explodiert im Preis (+35 Prozent)!"), 0, 1.35 },
			{ TEXT("Rekordschur in Neuseeland: Wolle schwemmt den Markt (-25 Prozent)!"), 1, 0.75 },
			{ TEXT("Raffinerie-Ausfall: Kunststoff-Granulat deutlich teurer (+30 Prozent)!"), 3, 1.30 },
			{ TEXT("Globale Ueberproduktion: Lederpreis gibt spuerbar nach (-20 Prozent)!"), 2, 0.80 },
			{ TEXT("Weltweite Rohstoff-Rallye: Alle Maerkte ziehen kraeftig an (+15 Prozent)!"), -1, 1.15 },
		};
		const FEreignis& E = Liste[RngIndustrie.RandRange(0, 4)];
		RohstoffEreignis = E.Text;
		for (int32 k = 0; k < 4; ++k)
		{
			if (E.Mat >= 0 && E.Mat != k) continue;
			FFM13Rohstoff& R = Rohstoffe[k];
			const double Alt = R.Preis;
			double Neu = Auf2(R.Preis * E.Faktor);
			if (E.Mat >= 0) Neu = FMath::Clamp(Neu, R.MinPreis, R.MaxPreis);
			else Neu = FMath::Min(R.MaxPreis, Neu);
			R.Preis = Neu;
			R.Delta = Auf2(Neu - Alt);
		}
	}
	else
	{
		RohstoffEreignis = TEXT("Ruhiger und stabiler Handel an den internationalen Rohstoffboersen.");
		for (int32 k = 0; k < 4; ++k)
		{
			FFM13Rohstoff& R = Rohstoffe[k];
			const double Veraenderung = (RngIndustrie.FRand() - 0.48) * 0.45;
			const double Alt = R.Preis;
			R.Preis = FMath::Clamp(Auf2(R.Preis + Veraenderung), R.MinPreis, R.MaxPreis);
			R.Delta = Auf2(R.Preis - Alt);
		}
	}
}

int64 FFM13World::ImmobilienKosten(int32 Objekt) const
{
	const FFM13Immobilie& I = Immobilien[Objekt];
	return FMath::Max<int64>(200000, FM13Transfers::JsRunden((double)I.BasisKosten * (I.Stufe + 1) * KostenSkala(LeagueLevel)));
}

int64 FFM13World::ImmobilienMiete(int32 Objekt) const
{
	const FFM13Immobilie& I = Immobilien[Objekt];
	if (!I.bBesitz) return 0;
	// Stufe n kostet n-mal den Grundpreis, die Miete waechst im selben Verhaeltnis
	int64 Miete = FM13Transfers::JsRunden((double)I.BasisMiete * I.Stufe * (I.Stufe + 1) / 2.0 * KostenSkala(LeagueLevel));
	if (Objekt == 4) Miete = FM13Transfers::JsRunden((double)Miete * (1.0 + 50.0 / 200.0));   // Hotel: Medienimage 50 (ohne Medien-System im Kern)
	return Miete;
}

bool FFM13World::KaufeOderAusbaueImmobilie(int32 Objekt, FString& OutReason)
{
	if (Objekt < 0 || Objekt > 5) { OutReason = TEXT("Dieses Objekt gibt es nicht."); return false; }
	FFM13Immobilie& I = Immobilien[Objekt];
	if (I.Stufe >= I.Max) { OutReason = TEXT("Objekt bereits voll ausgebaut!"); return false; }
	if (ImmobilienBauten.ContainsByPredicate([Objekt](const FFM13Immobilienbau& B) { return B.Objekt == Objekt; }))
	{ OutReason = TEXT("Fuer diese Anlage laeuft bereits eine Baustelle!"); return false; }
	const int64 Kosten = ImmobilienKosten(Objekt);
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Baukosten nicht gedeckt: %lld noetig."), (long long)Kosten); return false; }
	const int32 Tage = FMath::Max(10, (int32)FM13Transfers::JsRunden((double)Kosten / 400000.0));
	Book(FString::Printf(TEXT("Bau: %s"), *I.Name), -Kosten);
	FFM13Immobilienbau B;
	B.Objekt = Objekt;
	B.TageRest = Tage;
	B.Summe = Kosten;
	B.Label = FString::Printf(TEXT("%s (Stufe %d)"), *I.Name, I.Stufe + 1);
	ImmobilienBauten.Add(B);
	AddMessage(FString::Printf(TEXT("Bauprojekt gestartet: %s"), *B.Label), FString::Printf(TEXT("%lld wurden vollstaendig bezahlt. Fertigstellung in %d Spieltagen."), (long long)Kosten, Tage));
	return true;
}

// Verkauf zu 55 % der gezahlten Kaufsummen (Marktabschlag)
bool FFM13World::VerkaufeImmobilie(int32 Objekt, FString& OutReason)
{
	FFM13Immobilie& I = Immobilien[Objekt];
	if (!I.bBesitz) { OutReason = TEXT("Dieses Objekt gehoert dem Verein nicht."); return false; }
	const int64 Erloes = FM13Transfers::JsRunden((double)I.BasisKosten * I.Stufe * (I.Stufe + 1) / 2.0 * KostenSkala(LeagueLevel) * 0.55);
	Book(FString::Printf(TEXT("Verkauf: %s"), *I.Name), Erloes);
	I.bBesitz = false;
	I.Stufe = 0;
	AddMessage(TEXT("Immobilie verkauft"), FString::Printf(TEXT("%s verkauft (+%lld)."), *I.Name, (long long)Erloes));
	return true;
}

// Jeden Spieltag: Mieten auf das Konto, Baustellen zaehlen herunter und werden fertig
void FFM13World::TickImmobilien()
{
	int64 Summe = 0;
	for (int32 k = 0; k < 6; ++k) Summe += ImmobilienMiete(k);
	if (Summe > 0) Book(TEXT("Mieteinnahmen"), Summe);
	for (int32 i = ImmobilienBauten.Num() - 1; i >= 0; --i)
	{
		FFM13Immobilienbau& B = ImmobilienBauten[i];
		B.TageRest--;
		if (B.TageRest > 0) continue;
		FFM13Immobilie& I = Immobilien[B.Objekt];
		I.bBesitz = true;
		I.Stufe++;
		AddMessage(FString::Printf(TEXT("Fertig: %s"), *B.Label), FString::Printf(TEXT("%s steht jetzt auf Stufe %d."), *I.Name, I.Stufe));
		ImmobilienBauten.RemoveAt(i);
	}
}

// Grunddaten aus js/state.js: Rohstoffe und Immobilien. Auch der Lader ruft das, damit Mindest- und Hoechstpreise stimmen.
void FFM13World::ResetOekonomieGrunddaten()
{
	Rohstoffe[0] = FFM13Rohstoff{ TEXT("Baumwolle & Synthetik"), 600, 4.0, 4.10, 2.20, 7.50, 0.10 };
	Rohstoffe[1] = FFM13Rohstoff{ TEXT("Wolle & Garn"), 400, 3.0, 2.90, 1.80, 5.50, -0.10 };
	Rohstoffe[2] = FFM13Rohstoff{ TEXT("Leder & Kautschuk"), 250, 6.0, 6.30, 3.50, 10.50, 0.30 };
	Rohstoffe[3] = FFM13Rohstoff{ TEXT("Kunststoff & Pigmente"), 500, 2.0, 1.95, 1.10, 4.20, -0.05 };
	Immobilien[0] = FFM13Immobilie{ TEXT("Parkplatz-Gelaende"), false, 0, 3, 3200000, 12600 };
	Immobilien[1] = FFM13Immobilie{ TEXT("Buerokomplex 'Vereins-Tower'"), false, 0, 3, 8500000, 27900 };
	Immobilien[2] = FFM13Immobilie{ TEXT("Wohnanlage am Stadion"), false, 0, 3, 12000000, 33800 };
	Immobilien[3] = FFM13Immobilie{ TEXT("Einkaufszentrum 'Fan-Meile'"), false, 0, 3, 18000000, 44100 };
	Immobilien[4] = FFM13Immobilie{ TEXT("Hotel-Beteiligung"), false, 0, 3, 22000000, 51800 };
	Immobilien[5] = FFM13Immobilie{ TEXT("Gewerbepark"), false, 0, 3, 15000000, 36900 };
	// Industrie und Holding (js/state.js)
	Fabriken[0] = FFM13Fabrik{ TEXT("Textilfabrik 'Stoff & Naht'"), TEXT("Trikots"), 0, false, 1, 5, 600000 };
	Fabriken[1] = FFM13Fabrik{ TEXT("Strickerei 'Maschenwerk'"), TEXT("Schals"), 1, false, 1, 5, 320000 };
	Fabriken[2] = FFM13Fabrik{ TEXT("Leder- & Ballmanufaktur"), TEXT("Baelle"), 2, false, 1, 5, 420000 };
	Fabriken[3] = FFM13Fabrik{ TEXT("Spritzguss- & Zubehoerwerk"), TEXT("Caps & Wimpel"), 3, false, 1, 5, 250000 };
	HoldingGeld = 50000;
	Lagerstufe = 1;
	B2BAuftraege.Reset();
	B2BAuftraege.Add(FFM13B2BAuftrag{ 1, -1, TEXT("Real Madriz"), TEXT("Trikots"), 1000, 0, 1000, 65000, false });
	B2BAuftraege.Add(FFM13B2BAuftrag{ 2, -1, TEXT("Bayern Muenchen"), TEXT("Fan-Schals"), 2000, 1, 1200, 38000, false });
	B2BAuftraege.Add(FFM13B2BAuftrag{ 3, -1, TEXT("Liverpol FC"), TEXT("Spielbaelle"), 800, 2, 960, 48000, false });
	NextB2BId = 4;
	Konkurrenten.Reset();
	Konkurrenten.Add(FFM13Firma{ TEXT("TexPro Industries"), 60, TEXT("") });
	Konkurrenten.Add(FFM13Firma{ TEXT("Nordwoll Handels-KG"), 55, TEXT("") });
	Konkurrenten.Add(FFM13Firma{ TEXT("LederWerk Sued"), 65, TEXT("") });
	Uebernahmen.Reset();
	RohstoffEreignisBias = 0;
	Waren.Reset();
	const TCHAR* WarenNamen[25] = { TEXT("Heimtrikot 2026/27"), TEXT("Fan-Schal 'Tradition'"), TEXT("Snapback Cap"), TEXT("Offizieller Spielball"), TEXT("Auswaertstrikot 2026/27"), TEXT("Torwarttrikot"), TEXT("Trainingsshirt"), TEXT("Kapuzenpulli mit Wappen"), TEXT("Baby-Body 'Nachwuchs'"), TEXT("Bademantel"), TEXT("Stutzen-Set"), TEXT("Wintermuetze"), TEXT("Fan-Handschuhe"), TEXT("Stadion-Decke"), TEXT("Auswaerts-Schal"), TEXT("Leder-Geldboerse"), TEXT("Schluesselanhaenger"), TEXT("Mini-Ball fuer Kinder"), TEXT("Sporttasche"), TEXT("Wimpel 'Heimspiel'"), TEXT("Vereins-Tasse"), TEXT("Trinkflasche"), TEXT("Regenschirm"), TEXT("Handyhuelle mit Wappen") };
	const int32 WarenLager[25] = { 250, 500, 300, 150, 180, 90, 220, 200, 120, 60, 300, 240, 200, 140, 260, 120, 500, 200, 110, 400, 320, 280, 160, 240 };
	const int32 WarenRoh[25] = { 0, 1, 3, 2, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3 };
	const double WarenMenge[25] = { 1.0, 0.6, 0.5, 1.2, 1.0, 1.0, 0.7, 1.3, 0.4, 1.8, 0.4, 0.5, 0.4, 1.4, 0.6, 0.5, 0.1, 0.4, 1.5, 0.2, 0.4, 0.5, 0.8, 0.3 };
	const int32 WarenFabrik[25] = { 0, 1, 3, 2, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3 };
	// Einkauf, Verkaufspreis und Beliebtheit je Artikel (js/state.js, merchandise)
	const int64 WarenKosten[25] = { 14, 4, 5, 9, 14, 15, 8, 16, 5, 22, 3, 5, 4, 11, 4, 8, 1, 4, 18, 2, 3, 4, 7, 4 };
	const int64 WarenPreis[25] = { 65, 18, 22, 35, 65, 69, 34, 55, 22, 79, 14, 19, 16, 39, 18, 29, 8, 15, 59, 9, 13, 16, 25, 18 };
	const double WarenBeliebt[25] = { 1.0, 1.2, 0.8, 0.45, 0.55, 0.2, 0.6, 0.7, 0.35, 0.15, 0.75, 0.8, 0.6, 0.4, 0.7, 0.35, 1.1, 0.65, 0.3, 0.9, 0.85, 0.7, 0.45, 0.6 };
	for (int32 i = 0; i < 25; ++i) Waren.Add(FFM13Ware{ WarenNamen[i], WarenLager[i], WarenRoh[i], WarenMenge[i], WarenFabrik[i], WarenKosten[i], WarenPreis[i], WarenPreis[i], WarenBeliebt[i], 0, 0 });
	MerchVerlauf.Reset();
	HeimZuschauer.Reset();
	LimitedEdition = FFM13LimitedEdition();
	Saisonkollektion = FFM13Saisonkollektion();
	Produktionen.Reset();
}

// ---------- Holding und Industrie (js/industry.js, js/holding.js) ----------

namespace
{
	const TCHAR* InternationaleVereine[] = {
		TEXT("Real Madriz"), TEXT("FC Barcalona"), TEXT("Atletico Madriz"), TEXT("FC Sevillia"), TEXT("Valencia CFF"), TEXT("Real Betiss"),
		TEXT("Manchester Unitad"), TEXT("Manchester Cyty"), TEXT("Liverpol FC"), TEXT("Chelsea FC London"), TEXT("Arsenall London"), TEXT("Tottenham Hotspurr"),
		TEXT("Juwentus Turin"), TEXT("AC Millan"), TEXT("Inter Milano"), TEXT("SSC Neapell"), TEXT("AS Romm"), TEXT("Lazio Romm"),
		TEXT("Paris St. Germaine"), TEXT("Olympique Marseile"), TEXT("Olympique Lyonn"), TEXT("AS Monakko"),
		TEXT("Ajax Amsterdaam"), TEXT("PSV Eindhofen"), TEXT("Feyenoordt Rotterdam"), TEXT("FC Porto Portugal"), TEXT("Benfika Lissabon"),
		TEXT("Sporting Lissabonn"), TEXT("Club Bruggge"),
		TEXT("Celtic Glasgoww"), TEXT("Galatasaray Istanbull"), TEXT("Fenerbahce Istanbull"), TEXT("Roter Stern Belgratt"),
		TEXT("Schachtar Donezkk"), TEXT("Zenit St. Petersborg"), TEXT("RB Salzborg"), TEXT("Rapid Wienn"), TEXT("FC Baselll"), TEXT("Young Boys Bernn"),
	};
	const TCHAR* MarktEreignisse[] = {
		TEXT("Stabile Weltmaerkte - keine besonderen Vorkommnisse."),
		TEXT("Rohstoffknappheit durch Lieferengpaesse treibt die Preise!"),
		TEXT("Ueberangebot am Weltmarkt drueckt die Preise."),
		TEXT("Handelsabkommen sorgt fuer guenstigere Importe."),
		TEXT("Energiepreiskrise verteuert die Produktion weltweit."),
		TEXT("Stoerungen in globalen Lieferketten sorgen fuer Nervositaet."),
	};
}

int64 FFM13World::LagerBestand() const
{
	int64 Summe = 0;
	for (const FFM13Rohstoff& R : Rohstoffe) Summe += R.Lager;
	return Summe;
}

// getHoldingValuation(): Grundwert 50.000 plus 80 % der Summe aus Kauf und Ausbau je Fabrik
int64 FFM13World::HoldingWert() const
{
	double Investiert = 0.0;
	for (const FFM13Fabrik& F : Fabriken) if (F.bBesitz) Investiert += (double)F.Kosten * (F.Stufe * (F.Stufe + 1) / 2.0);
	return FM13Transfers::JsRunden(50000.0 + Investiert * 0.8);
}

bool FFM13World::KaufeFabrik(int32 Index, FString& OutReason)
{
	if (!Fabriken[Index].Name.Len()) { OutReason = TEXT("Diese Fabrik gibt es nicht."); return false; }
	FFM13Fabrik& F = Fabriken[Index];
	if (F.bBesitz) { OutReason = TEXT("Die Fabrik gehoert schon dem Verein."); return false; }
	if (HoldingGeld < F.Kosten) { OutReason = FString::Printf(TEXT("Holding-Konto reicht nicht: %lld von %lld."), (long long)HoldingGeld, (long long)F.Kosten); return false; }
	HoldingGeld -= F.Kosten;
	F.bBesitz = true;
	return true;
}

bool FFM13World::AusbaueFabrik(int32 Index, FString& OutReason)
{
	FFM13Fabrik& F = Fabriken[Index];
	if (!F.bBesitz) { OutReason = TEXT("Die Fabrik gehoert dem Verein noch nicht."); return false; }
	if (F.Stufe >= F.Max) { OutReason = TEXT("Maximalstufe erreicht."); return false; }
	const int64 Kosten = F.Kosten * (F.Stufe + 1);
	if (HoldingGeld < Kosten) { OutReason = FString::Printf(TEXT("Holding-Konto reicht nicht: %lld noetig."), (long long)Kosten); return false; }
	HoldingGeld -= Kosten;
	F.Stufe++;
	return true;
}

// mergeFactoryWithCompetitor(): schwacher Konkurrent (Staerke unter 50), 1,5 mal Kosten, eine Stufe mehr
bool FFM13World::FusioniereFabrik(int32 Index, FString& OutReason)
{
	FFM13Fabrik& F = Fabriken[Index];
	if (!F.bBesitz) { OutReason = TEXT("Diese Fabrik gehoert dir noch nicht."); return false; }
	const int32 Schwach = Konkurrenten.IndexOfByPredicate([](const FFM13Firma& K) { return K.Staerke < 50; });
	if (Schwach < 0) { OutReason = TEXT("Aktuell kein fusionswilliger schwacher Konkurrent am Markt."); return false; }
	const int64 Kosten = FM13Transfers::JsRunden((double)F.Kosten * 1.5);
	if (HoldingGeld < Kosten) { OutReason = FString::Printf(TEXT("Nicht genug Holding-Kapital! Benoetigt: %lld"), (long long)Kosten); return false; }
	HoldingGeld -= Kosten;
	F.Stufe = FMath::Min(F.Max, F.Stufe + 1);
	Konkurrenten.RemoveAt(Schwach);
	return true;
}

int32 FFM13World::ProduktionsDauer(int32 Fabrik) const
{
	return FMath::Max(1, 4 - (int32)FMath::FloorToInt((Fabriken[Fabrik].Stufe - 1) * 0.7));   // Stufe 1: 4 Spieltage, Stufe 5: 1
}

bool FFM13World::StarteProduktion(int32 Ware, int32 Menge, FString& OutReason)
{
	if (!Waren.IsValidIndex(Ware)) { OutReason = TEXT("Dieses Produkt gibt es nicht."); return false; }
	const FFM13Ware& W = Waren[Ware];
	const FFM13Fabrik& F = Fabriken[W.Fabrik];
	const int32 Bedarf = (int32)std::ceil(W.RohstoffMenge * Menge);   // kg, aufgerundet
	if (!F.bBesitz) { OutReason = FString::Printf(TEXT("Dafuer fehlt die passende Fabrik: %s."), *F.Name); return false; }
	if (Rohstoffe[W.Rohstoff].Lager < Bedarf) { OutReason = FString::Printf(TEXT("Zu wenig Rohstoff: %d kg am Lager, %d kg noetig."), Rohstoffe[W.Rohstoff].Lager, Bedarf); return false; }
	Rohstoffe[W.Rohstoff].Lager -= Bedarf;
	const int32 Dauer = ProduktionsDauer(W.Fabrik);
	FFM13Produktion P;
	P.Ware = Ware;
	P.Menge = Menge;
	P.TageRest = Dauer;
	P.Dauer = Dauer;
	Produktionen.Add(P);
	return true;
}

void FFM13World::TickProduktion()
{
	for (int32 i = Produktionen.Num() - 1; i >= 0; --i)
	{
		FFM13Produktion& P = Produktionen[i];
		P.TageRest--;
		if (P.TageRest > 0) continue;
		Waren[P.Ware].Lager += P.Menge;
		AddMessage(TEXT("Produktion abgeschlossen"), FString::Printf(TEXT("%dx %s liegen jetzt im Lager bereit."), P.Menge, *Waren[P.Ware].Name));
		Produktionen.RemoveAt(i);
	}
}

bool FFM13World::KaufeRohstoff(int32 Rohstoff, int32 Menge, FString& OutReason)
{
	FFM13Rohstoff& R = Rohstoffe[Rohstoff];
	const int64 Kosten = FM13Transfers::JsRunden(R.Preis * Menge);
	if (LagerBestand() + Menge > LagerKapazitaet()) { OutReason = TEXT("Lagerkapazitaet erschoepft - bau das Zentrallager weiter aus."); return false; }
	if (HoldingGeld < Kosten) { OutReason = TEXT("Nicht genug Geld auf dem Holding-Konto."); return false; }
	HoldingGeld -= Kosten;
	R.Lager += Menge;
	return true;
}

bool FFM13World::AusbaueLager(FString& OutReason)
{
	if (Lagerstufe >= 5) { OutReason = TEXT("Zentrallager ist bereits voll ausgebaut."); return false; }
	if (HoldingGeld < 30000) { OutReason = FString::Printf(TEXT("Holding-Konto reicht nicht: %lld von 30.000 noetig."), (long long)HoldingGeld); return false; }
	HoldingGeld -= 30000;
	Lagerstufe++;
	return true;
}

// tickRawMaterialPrices(): 15 % Ereignis je Spieltag, dann Schwankung mit Ereignisrichtung
void FFM13World::TickRohstoffPreise()
{
	if (RngIndustrie.FRand() < 0.15f)
	{
		const int32 Wahl = RngIndustrie.RandRange(0, 5);
		RohstoffEreignis = MarktEreignisse[Wahl];
		RohstoffEreignisBias = Wahl == 1 ? 1 : (Wahl == 2 ? -1 : 0);
	}
	for (int32 k = 0; k < 4; ++k)
	{
		FFM13Rohstoff& R = Rohstoffe[k];
		const double Schwung = (RngIndustrie.FRand() - 0.5) * (R.BasisPreis * 0.08) + RohstoffEreignisBias * (R.BasisPreis * 0.03);
		const double Neu = FMath::Max(R.MinPreis, FMath::Min(R.MaxPreis, R.Preis + Schwung));
		const double Alt = R.Preis;
		R.Delta = std::round((Neu - Alt) * 100.0) / 100.0;
		R.Preis = std::round(Neu * 100.0) / 100.0;
	}
}

// tickCompetitorFirms(): Staerke wandert, selten ein Uebernahmeangebot einer starken Firma
void FFM13World::TickKonkurrenten()
{
	for (FFM13Firma& K : Konkurrenten)
	{
		K.Staerke = FMath::Clamp(K.Staerke + RngIndustrie.RandRange(-3, 3), 30, 95);
		if (RngIndustrie.FRand() < 0.08f)
		{
			const TCHAR* Aktionen[4] = { TEXT("expandiert aggressiv"), TEXT("kaempft mit Lieferproblemen"), TEXT("senkt die Preise stark"), TEXT("meldet Rekordgewinne") };
			K.LetzteAktion = Aktionen[RngIndustrie.RandRange(0, 3)];
		}
	}
	const int32 Dominant = Konkurrenten.IndexOfByPredicate([](const FFM13Firma& K) { return K.Staerke >= 85; });
	bool bFabrik = false;
	for (const FFM13Fabrik& F : Fabriken) if (F.bBesitz) bFabrik = true;
	if (Dominant >= 0 && bFabrik && Uebernahmen.Num() == 0 && RngIndustrie.FRand() < 0.05f)
	{
		FFM13Uebernahme U;
		U.Firma = Konkurrenten[Dominant].Name;
		U.Angebot = FM13Transfers::JsRunden((double)HoldingWert() * (1.1 + RngIndustrie.FRand() * 0.3));
		U.GueltigBis = Matchday + 5;
		Uebernahmen.Add(U);
		AddMessage(FString::Printf(TEXT("Uebernahmeangebot von %s"), *U.Firma), FString::Printf(TEXT("%s bietet %lld fuer die komplette Holding. Gueltig fuer 5 Spieltage."), *U.Firma, (long long)U.Angebot));
	}
}

void FFM13World::TickUebernahmeAblauf()
{
	Uebernahmen.RemoveAll([this](const FFM13Uebernahme& U) { return U.GueltigBis < Matchday; });
}

// Annehmen: Verkauf der Holding, alle Fabriken gehen weg, Holding-Konto und Lager bleiben
bool FFM13World::AntworteUebernahme(bool bAnnehmen, FString& OutReason)
{
	if (Uebernahmen.Num() == 0) { OutReason = TEXT("Kein Angebot mehr offen."); return false; }
	const FFM13Uebernahme U = Uebernahmen[0];
	if (bAnnehmen)
	{
		Book(TEXT("Verkauf der Holding"), U.Angebot);
		for (FFM13Fabrik& F : Fabriken) { F.bBesitz = false; F.Stufe = 1; }
		AddMessage(TEXT("Holding verkauft"), FString::Printf(TEXT("Die Holding wurde fuer %lld an %s verkauft."), (long long)U.Angebot, *U.Firma));
	}
	Uebernahmen.RemoveAt(0);
	return true;
}

bool FFM13World::ErfuelleB2B(int32 AuftragId, FString& OutReason)
{
	const int32 Idx = B2BAuftraege.IndexOfByPredicate([AuftragId](const FFM13B2BAuftrag& A) { return A.Id == AuftragId; });
	if (Idx < 0 || B2BAuftraege[Idx].bErledigt) { OutReason = TEXT("Diesen Auftrag gibt es nicht mehr."); return false; }
	const FFM13B2BAuftrag& A = B2BAuftraege[Idx];
	if (Rohstoffe[A.Rohstoff].Lager < A.RohstoffMenge) { OutReason = FString::Printf(TEXT("Zu wenig Rohstoff: %d kg am Lager, %d kg noetig."), Rohstoffe[A.Rohstoff].Lager, A.RohstoffMenge); return false; }
	Rohstoffe[A.Rohstoff].Lager -= A.RohstoffMenge;
	HoldingGeld += A.Honorar;
	B2BAuftraege[Idx].bErledigt = true;
	return true;
}

// refreshB2BContracts(): Saisonstart, je eigener Fabrik ein Auftrag fuer ihr Produkt
void FFM13World::ErneuereB2BAuftraege()
{
	B2BAuftraege.RemoveAll([](const FFM13B2BAuftrag& A) { return A.bErledigt; });
	for (int32 k = 0; k < 4; ++k)
	{
		const FFM13Fabrik& F = Fabriken[k];
		if (!F.bBesitz) continue;
		if (B2BAuftraege.ContainsByPredicate([k](const FFM13B2BAuftrag& A) { return A.Fabrik == k; })) continue;
		const int32 Menge = 400 + F.Stufe * 200;
		FFM13B2BAuftrag A;
		A.Id = NextB2BId++;
		A.Fabrik = k;
		A.Verein = InternationaleVereine[RngIndustrie.RandRange(0, 39)];
		A.Artikel = F.Produkt;
		A.Menge = Menge * 2;
		A.Rohstoff = F.Rohstoff;
		A.RohstoffMenge = Menge;
		A.Honorar = FM13Transfers::JsRunden((double)Menge * Rohstoffe[F.Rohstoff].BasisPreis * 3.0 * (1.0 + 0.1 * F.Stufe) / 1000.0) * 1000;
		B2BAuftraege.Add(A);
	}
}

bool FFM13World::UeberweisungZurHolding(int64 Betrag, FString& OutReason)
{
	if (Money < Betrag) { OutReason = FString::Printf(TEXT("Vereinskonto reicht nicht: %lld von %lld."), (long long)Money, (long long)Betrag); return false; }
	Book(TEXT("Ueberweisung an die Holding"), -Betrag);
	HoldingGeld += Betrag;
	return true;
}

bool FFM13World::UeberweisungVonHolding(int64 Betrag, FString& OutReason)
{
	if (HoldingGeld < Betrag) { OutReason = FString::Printf(TEXT("Holding-Konto reicht nicht: %lld von %lld."), (long long)HoldingGeld, (long long)Betrag); return false; }
	HoldingGeld -= Betrag;
	Book(TEXT("Ueberweisung von der Holding"), Betrag);
	return true;
}

// ---------- Fanshop (js/merchandise.js) ----------

namespace
{
	int64 MerchRund(double X) { return FM13Transfers::JsRunden(X); }
}

int32 FFM13World::AverageHeimZuschauer() const
{
	if (HeimZuschauer.Num() == 0) return FMath::Max(200, StadiumTotal());
	int64 Summe = 0;
	for (int32 A : HeimZuschauer) Summe += A;
	return (int32)MerchRund((double)Summe / HeimZuschauer.Num());
}

// calculateElasticity(): Preis gegen Marktoptimum
double FFM13World::ElastizitaetFaktor(int64 Preis, int64 Optimal)
{
	const double Verhaeltnis = (double)Preis / (double)FMath::Max<int64>(1, Optimal);
	if (Verhaeltnis <= 0.6) return 1.8;
	if (Verhaeltnis <= 0.85) return 1.35;
	if (Verhaeltnis <= 1.15) return 1.0;
	if (Verhaeltnis <= 1.45) return 0.55;
	return FMath::Max(0.08, std::pow(1.0 / Verhaeltnis, 2.5));
}

// simulateMerchSales(): Budgets aus Zuschauern, Stimmung und Reichweite, auf die Artikel verteilt, dann am Lager ausgeliefert
int64 FFM13World::SimulateMerchSales(bool bHome, bool bWin, int32 Zuschauer)
{
	const int32 Schnitt = AverageHeimZuschauer();
	int32 TopStaerke = 55;
	for (const FFM13Player& P : Squad) TopStaerke = FMath::Max(TopStaerke, P.Strength);
	auto Zufall = [this]() { return 0.85 + RngIndustrie.FRand() * 0.3; };   // Spieltag ist nie genau wie der letzte
	double Stadion = 0.0;
	if (bHome && Zuschauer > 0) Stadion = (double)Zuschauer * 3.0 * (bWin ? 1.35 : 0.85) * Zufall();
	const double Stadt = (double)Schnitt * 0.8 * (0.4 + (Fans / 100.0) * 0.9) * Zufall();
	const double Starfaktor = 1.0 + FMath::Max(0, TopStaerke - 55) * 0.012;
	const double Online = (double)Schnitt * 0.6 * Starfaktor * (0.4 + (BoardSat / 100.0) * 0.6) * Zufall();
	double Multi = 1.0;
	if (Saisonkollektion.bAktiv) Multi = 1.0 + Saisonkollektion.Schub / 100.0;
	const double StadionB = Stadion * Multi, StadtB = Stadt * Multi, OnlineB = Online * Multi;

	// Gewichte: Beliebtheit mal Preisfaktor
	TArray<double> Gewichte;
	double Summe = 0.0;
	for (const FFM13Ware& W : Waren)
	{
		const double G = FMath::Max(0.0, W.Beliebtheit * ElastizitaetFaktor(W.Preis, W.OptimalPreis));
		Gewichte.Add(G);
		Summe += G;
	}
	auto Verteilen = [this, &Gewichte, Summe](double Budget, int32 Index)
	{
		TArray<int32> Stueck;
		for (int32 i = 0; i < Waren.Num(); ++i)
		{
			int32 Anteil = 0;
			if (Summe > 0.0) Anteil = (int32)MerchRund((Gewichte[i] / Summe) * Budget / (double)FMath::Max<int64>(1, Waren[i].Preis));
			Stueck.Add(FMath::Max(0, Anteil));
		}
		(void)Index;
		return Stueck;
	};
	const TArray<int32> WunschStadion = Verteilen(StadionB, 0);
	const TArray<int32> WunschStadt = Verteilen(StadtB, 1);
	const TArray<int32> WunschOnline = Verteilen(OnlineB, 2);

	// Am Lager ausliefern
	int64 Gesamt = 0;
	FFM13MerchEintrag Eintrag;
	Eintrag.Season = Season;
	Eintrag.Matchday = Matchday;
	Eintrag.Zuschauer = Zuschauer;
	for (int32 i = 0; i < Waren.Num(); ++i)
	{
		FFM13Ware& W = Waren[i];
		const int32 Wunsch = WunschStadion[i] + WunschStadt[i] + WunschOnline[i];
		const int32 Verkauft = FMath::Min(W.Lager, Wunsch);
		const double Anteil = Wunsch > 0 ? (double)Verkauft / Wunsch : 0.0;
		(void)MerchRund(WunschStadion[i] * Anteil);
		W.Lager -= Verkauft;
		const int64 Umsatz = (int64)Verkauft * W.Preis;
		W.LetztVerkauft = Verkauft;
		W.LetztUmsatz = Umsatz;
		Gesamt += Umsatz;
		if (Verkauft > 0 || Wunsch > Verkauft)
		{
			FFM13MerchEintrag::FArtikel A;
			A.Name = W.Name; A.Verkauft = Verkauft; A.Umsatz = Umsatz; A.Verpasst = FMath::Max(0, Wunsch - Verkauft);
			Eintrag.Artikel.Add(A);
		}
		Eintrag.Umsatz += Umsatz;
	}
	MerchVerlauf.Add(Eintrag);
	while (MerchVerlauf.Num() > 34) MerchVerlauf.RemoveAt(0);
	return Gesamt;
}

// orderMerchBatch(): Grosshandel, Einkaufspreis je Stueck
bool FFM13World::BestelleWare(int32 Ware, int32 Menge, FString& OutReason)
{
	if (!Waren.IsValidIndex(Ware) || Menge <= 0) { OutReason = TEXT("Dieses Produkt gibt es nicht."); return false; }
	const int64 Kosten = Waren[Ware].Kosten * Menge;
	if (Money < Kosten) { OutReason = FString::Printf(TEXT("Vereinskonto reicht nicht: %lld noetig."), (long long)Kosten); return false; }
	Book(FString::Printf(TEXT("Grosshandel: %s"), *Waren[Ware].Name), -Kosten);
	Waren[Ware].Lager += Menge;
	return true;
}

bool FFM13World::SetzeWarenPreis(int32 Ware, int64 Preis)
{
	if (!Waren.IsValidIndex(Ware)) return false;
	Waren[Ware].Preis = FMath::Max<int64>(1, Preis);
	return true;
}

bool FFM13World::StarteLimitedEdition(const FString& Name, int32 Stueck, int64 Preis, FString& OutReason)
{
	if (LimitedEdition.bAktiv && LimitedEdition.Lager > 0) { OutReason = TEXT("Es laeuft noch eine limitierte Edition!"); return false; }
	LimitedEdition = FFM13LimitedEdition();
	LimitedEdition.bAktiv = true;
	LimitedEdition.Name = Name;
	LimitedEdition.Lager = Stueck;
	LimitedEdition.Start = Stueck;
	LimitedEdition.Preis = Preis;
	return true;
}

// tickLimitedEditionSales(): Nachfrage aus Fans und Stimmung, ausverkauft ist ausverkauft
void FFM13World::TickLimitedEdition()
{
	if (!LimitedEdition.bAktiv || LimitedEdition.Lager <= 0) return;
	const int32 Nachfrage = (int32)MerchRund((5.0 + Fans / 8.0) * (BoardSat / 100.0));
	const int32 Verkauft = FMath::Min(LimitedEdition.Lager, Nachfrage);
	LimitedEdition.Lager -= Verkauft;
	LimitedEdition.Verkauft += Verkauft;
	const int64 Erloes = (int64)Verkauft * LimitedEdition.Preis;
	LimitedEdition.Umsatz += Erloes;
	Book(FString::Printf(TEXT("Limitierte Edition: %s"), *LimitedEdition.Name), Erloes);
	if (LimitedEdition.Lager <= 0 && Verkauft > 0)
		AddMessage(TEXT("Limitierte Edition ausverkauft"), FString::Printf(TEXT("%s ist komplett ausverkauft - insgesamt %lld Erloes aus %d Stueck."), *LimitedEdition.Name, (long long)LimitedEdition.Umsatz, LimitedEdition.Start));
}

void FFM13World::StarteSaisonkollektion(int32 SchubProzent, int32 Spieltage)
{
	Saisonkollektion.bAktiv = true;
	Saisonkollektion.Schub = SchubProzent;
	Saisonkollektion.AblaeuftBei = Matchday + Spieltage;
}

void FFM13World::TickSaisonkollektion()
{
	if (Saisonkollektion.bAktiv && Matchday >= Saisonkollektion.AblaeuftBei)
	{
		Saisonkollektion.bAktiv = false;
		AddMessage(TEXT("Saisonale Kollektion beendet"), TEXT("Der Verkaufsschub der saisonalen Kollektion ist ausgelaufen."));
	}
}

// ---------- Gehaltsbudget (js/season-end.js, js/squad.js) ----------

int64 FFM13World::LeagueWageBudget(int32 Level)
{
	static const int64 Budgets[] = { 1575000, 520000, 110000, 36000, 11000, 8000 };   // LEAGUE_WAGE_BUDGET
	return Budgets[FMath::Clamp(Level, 0, 5)];
}

// getRenewalWageBuffer(): Erhoehungen der Spieler, deren Vertrag in der neuen Saison auslaeuft.
// Die Planung laeuft hier nach dem Herunterzaehlen der Vertraege, deshalb Restlaufzeit 1 statt 2.
int64 FFM13World::RenewalWageBuffer() const
{
	int64 Summe = 0;
	for (const FFM13Player& P : Squad) if (P.ContractYears == 1) Summe += FMath::Max(0, RenewalWage(P) - P.Wage);
	return Summe;
}

int64 FFM13World::WageBudgetFloor() const
{
	const int64 Summe = WagesPerMatchday();
	auto Auf1000 = [](double X) { return (int64)std::ceil(X / 1000.0) * 1000; };
	if (Money < 0) return Auf1000((double)Summe);                       // Konto im Minus: eingefroren
	// Bilanz der gerade beendeten Saison (EvaluateFinancialFairplay hat sie festgehalten)
	const int64 SaisonNetto = bHasFfpResult ? FfpLastResult.Net : 0;
	const bool bOhneVerlust = SaisonNetto >= 0 || Money >= Summe * 34;
	const double Deckel = (double)LeagueWageBudget(LeagueLevel) * 1.5;   // WAGE_FLOOR_GROWTH_CAP
	if ((double)Summe >= Deckel) return Auf1000((double)(Summe + (Money >= Summe * 17 ? RenewalWageBuffer() : 0)));
	const double Spielraum = bOhneVerlust ? (double)Summe * 0.05 : 0.0;
	return Auf1000((double)Summe + Spielraum + (double)RenewalWageBuffer());
}

// applyRelegationWageClause(): alle Gehaelter sinken um 40 %, mindestens 150, auf 50 gerundet
int64 FFM13World::ApplyRelegationWageClause()
{
	if (Squad.Num() == 0) return 0;
	const int64 Vorher = WagesPerMatchday();
	for (FFM13Player& P : Squad)
	{
		P.Wage = FMath::Max(150, (int32)(FM13Transfers::JsRunden((double)P.Wage * 0.6 / 50.0) * 50));
		P.Morale = FMath::Max(10, P.Morale - 3);
	}
	const int64 Nachher = WagesPerMatchday();
	AddMessage(TEXT("Abstiegsklausel greift"), FString::Printf(TEXT("Mit dem Abstieg sinken alle Spielergehaelter vertragsgemaess um 40 %% (%lld auf %lld pro Spieltag). Moral -3."), (long long)Vorher, (long long)Nachher));
	return Nachher;
}

// applyCashSurplusBudgets(): Reserve = halbe Saison der Gehaelter, mindestens des halben Budgets
void FFM13World::ApplyCashSurplusBudgets()
{
	const double Reserve = FMath::Max((double)WagesPerMatchday(), (double)WageBudget * 0.5) * 34.0 * 0.5;
	const double Ueberschuss = FMath::Max(0.0, (double)Money - Reserve);
	const int64 Transfer = FM13Transfers::JsRunden(Ueberschuss * 0.4 / 50000.0) * 50000;
	const int64 Gehalt = FM13Transfers::JsRunden(Ueberschuss * 0.1 / 34.0 / 1000.0) * 1000;
	if (!Transfer && !Gehalt) return;
	TransferBudget += Transfer;
	WageBudget += Gehalt;
	AddMessage(TEXT("Vorstand gibt Ruecklagen frei"), FString::Printf(TEXT("Zusaetzlich %lld Transferbudget und %lld Gehaltsbudget pro Spieltag."), (long long)Transfer, (long long)Gehalt));
}
