#include "FM13World.h"
#include "FM13Economy.h"
#include "FM13Match.h"
#include "FM13Names.h"
#include "FM13Tactics.h"
#include "FM13Development.h"

namespace
{
	// Start je Liga: Kontostand und Stadiongröße (das Browserspiel startet immer in der 6. Liga mit 150.000 €)
	const int64 StartMoney[FM13::NumLeagues] = { 30000000, 6000000, 1500000, 600000, 250000, 150000 };
	const int32 StartCapacity[FM13::NumLeagues] = { 60000, 30000, 15000, 8000, 5000, 4000 };

	// Sponsor-Faktor je Liga (SPONSOR_LEAGUE_FACTOR in js/sponsors.js)
	const float SponsorLeagueFactor[FM13::NumLeagues] = { 74.f, 20.f, 6.5f, 3.2f, 1.0f, 0.75f };

	// Beste Elf: je Position die Stärksten; fehlt ein Spieler, rückt der beste Rest mit -10 auf die Position.
	// Gibt Indizes in Squad zurück, OutStrength ist der Schnitt der Elf.
	// Beste Elf in der gewählten Formation: je Position die Stärksten (Verletzte und Gesperrte fehlen)
	TArray<int32> BestEleven(const TArray<FFM13Player>& Squad, const FString& Formation, int32& OutStrength)
	{
		const int32* Slots = FM13Tactics::Formation(Formation).Slots;
		TArray<int32> Idx;
		for (int32 i = 0; i < Squad.Num(); ++i) if (Squad[i].IsAvailable()) Idx.Add(i);
		Idx.Sort([&Squad](int32 A, int32 B) { return Squad[A].Strength > Squad[B].Strength; });

		TArray<int32> Elf;
		TArray<uint8> Vergeben;
		for (int32 i = 0; i < Squad.Num(); ++i) Vergeben.Add(0);
		int64 Summe = 0;
		int32 Offen = 0;
		for (int32 Pos = 0; Pos < 4; ++Pos)
		{
			int32 Gefunden = 0;
			for (int32 i : Idx)
			{
				if (Gefunden >= Slots[Pos]) break;
				if (Vergeben[i] || (int32)Squad[i].Pos != Pos) continue;
				Vergeben[i] = 1;
				Elf.Add(i);
				Summe += Squad[i].Strength;
				++Gefunden;
			}
			Offen += Slots[Pos] - Gefunden;
		}
		for (int32 i : Idx)
		{
			if (Offen <= 0) break;
			if (Vergeben[i]) continue;
			Vergeben[i] = 1;
			Elf.Add(i);
			Summe += FMath::Max(1, Squad[i].Strength - 10);
			--Offen;
		}
		// Weniger als elf Spieler: leere Plätze zählen mit Stärke 0
		OutStrength = Idx.Num() > 0 ? FMath::RoundToInt((float)Summe / 11.f) : 0;
		return Elf;
	}

	int64 RoundTo(int64 Value, int64 Step) { return FMath::RoundToInt64((double)Value / (double)Step) * Step; }
}

// ---------- Neues Spiel ----------

void FFM13World::NewGame(const FString& InClubName, int32 Seed, int32 StartLevel)
{
	*this = FFM13World();
	Rng.Initialize(Seed);
	ClubName = InClubName.IsEmpty() ? FString(TEXT("1.FC Moritz Leipzig")) : InClubName;
	LeagueLevel = FMath::Clamp(StartLevel, 0, FM13::NumLeagues - 1);
	Money = StartMoney[LeagueLevel];
	StadiumCapacity = StartCapacity[LeagueLevel];
	TicketPrice = FM13Economy::BaseTicketPrice(LeagueLevel);
	UsedClubNames.Add(ClubName);
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
	P.Morale = Rng.RandRange(60, 75);
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
			const FM13Match::FExpectedGoals Xg = FM13Match::ExpectedGoals(H.Strength, A.Strength, H.Playstyle, A.Playstyle);
			const int32 HG = FM13Match::Poisson(Rng, Xg.Home);
			const int32 AG = FM13Match::Poisson(Rng, Xg.Away);
			L.ApplyResult(F, HG, AG);
		}
	}

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
		StadiumCapacity += PendingSeats;
		AddMessage(TEXT("Stadionausbau fertig"), FString::Printf(TEXT("%d neue Plaetze, das Stadion fasst jetzt %d Zuschauer."), PendingSeats, StadiumCapacity));
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
	if (Matchday % 4 == 0) RefreshMarket();
	++Matchday;
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
	const int32 Own = OwnMatchStrength(OppPlanArchetype);
	const int32 OppStr = Opp.Strength;
	const FString OppName = Opp.Name;
	const FM13Match::FWeather& Wetter = FM13Match::Weathers()[WeatherIndex];

	FM13Match::FExpectedGoals Xg = bHome
		? FM13Match::ExpectedGoals(Own, OppStr, EFM13Playstyle::Ausgeglichen, Opp.Playstyle)
		: FM13Match::ExpectedGoals(OppStr, Own, Opp.Playstyle, EFM13Playstyle::Ausgeglichen);
	Xg.Home *= Wetter.GoalMult;
	Xg.Away *= Wetter.GoalMult;
	const int32 HG = FM13Match::Poisson(Rng, Xg.Home);
	const int32 AG = FM13Match::Poisson(Rng, Xg.Away);
	L.ApplyResult(F, HG, AG);

	const int32 OwnGoals = bHome ? HG : AG;
	const int32 OppGoals = bHome ? AG : HG;

	int32 Dummy = 0;
	for (int32 i : LineupIndices(Dummy)) Squad[i].Appearances++;
	PickScorers(OwnGoals, LastReport.Scorers);

	// Vorstand: Erwartung aus der Elf ohne Taktik (wie getOwnMatchExpectation)
	const int32 Shift = FM13Match::BoardShift(FM13Match::Expectation(Elf, OppStr), OwnGoals, OppGoals);
	BoardSat = FMath::Clamp(BoardSat + Shift, 10, 100);
	if (OwnGoals > OppGoals) Fans = FMath::Min(100, Fans + 1);
	else if (OwnGoals < OppGoals) Fans = FMath::Max(0, Fans - 1);

	const int32 Att = bHome ? FMath::Min(StadiumCapacity, FMath::RoundToInt((float)FM13Economy::Attendance(StadiumCapacity, Fans, LeagueLevel, OwnRank(), TicketPrice) * Wetter.AttendanceMult)) : 0;
	ApplyMatchdayFinances(bHome, OwnGoals > OppGoals, Att);
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

void FFM13World::RollInjuries(FFM13OwnMatchReport& Report)
{
	// Rolle nach dem Spiel wie in processPostMatchRoutine(): Startelf, ältere Spieler etwas anfälliger
	for (int32 Id : StartingEleven())
	{
		FFM13Player* P = FindPlayer(Id);
		if (!P) continue;
		const float Chance = (0.02f + (float)FMath::Max(0, P->Age - 30) * 0.004f)
			* FM13Match::Weathers()[WeatherIndex].InjuryMult * FM13Tactics::StyleFitnessMultiplier(TacticStyle);
		if (Rng.FRand() >= Chance) continue;
		const float Schwere = Rng.FRand();
		const int32 Dauer = Schwere < 0.6f ? Rng.RandRange(1, 2) : (Schwere < 0.9f ? Rng.RandRange(3, 5) : Rng.RandRange(6, 10));
		P->InjuredMatchdays = Dauer + 1; // +1: der Abbau am Ende dieses Spieltags zählt nicht als Ausfall
		Report.Injuries.Add(FString::Printf(TEXT("%s (%d Spieltage)"), *P->Name, Dauer));
		AddMessage(TEXT("Verletzung"), FString::Printf(TEXT("%s faellt %d Spieltage aus."), *P->Name, Dauer));
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
	if (bHome) Buche(TEXT("Ticketeinnahmen"), (int64)Att * TicketPrice);
	Buche(TEXT("Sponsor Grundbetrag"), Sponsor.Base);
	if (bWin) Buche(TEXT("Sponsor Siegpraemie"), Sponsor.WinBonus);
	Buche(TEXT("Gehaelter"), -WagesPerMatchday());
	Buche(TEXT("Stadion-Unterhalt"), -(int64)(StadiumCapacity / 8));
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
	static const int32 Gewicht[4] = { 0, 1, 3, 5 }; // TW, ABW, MIT, ST
	int32 Summe = 0;
	for (int32 i : Elf) Summe += Gewicht[(int32)Squad[i].Pos];
	for (int32 g = 0; g < Goals && Summe > 0; ++g)
	{
		int32 Wurf = Rng.RandRange(1, Summe);
		for (int32 i : Elf)
		{
			Wurf -= Gewicht[(int32)Squad[i].Pos];
			if (Wurf <= 0)
			{
				Squad[i].GoalsSeason++;
				OutNames.Add(Squad[i].Name);
				break;
			}
		}
	}
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
	AdvanceLeagues(Rank, Outcome);
	if (Outcome == EFM13SeasonOutcome::Promoted && LeagueLevel == 0) Unlock(TEXT("bundesliga"), &S.NewAchievements);
	DevelopPlayers(S);
	YouthIntake(S);

	++Season;
	Matchday = 1;
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
		if (P.ContractYears <= 0) { S.Left.Add(P.Name + TEXT(" (Vertragsende)")); continue; }
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

	// Talente reifen weiter
	for (FFM13Player& T : YouthTalents)
	{
		T.Age++;
		T.Strength = FMath::Min(T.Potential, T.Strength + Rng.RandRange(2, 5));
		T.MarketValue = FM13Economy::MarketValue(T.Strength, nullptr);
	}
}

void FFM13World::YouthIntake(FFM13SeasonSummary& S)
{
	const int32 Basis = FM13::LeagueBaseStrength(LeagueLevel);
	const int32 Anzahl = 1 + YouthAcademyLevel;
	for (int32 n = 0; n < Anzahl && YouthTalents.Num() < 12; ++n)
	{
		FFM13Player T = CreatePlayer((EFM13Position)Rng.RandRange(0, 3), Basis - 14 + YouthAcademyLevel * 2, Basis - 6 + YouthAcademyLevel * 2, 16, 17);
		T.Potential = FMath::Min(99, T.Strength + Rng.RandRange(8, 15 + YouthAcademyLevel * 4));
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
	return 40;
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
		EFM13Playstyle HS, AS;
		const int32 HStr = ClubStrength(M.Home, HS);
		const int32 AStr = ClubStrength(M.Away, AS);
		const FM13Match::FExpectedGoals Xg = FM13Match::ExpectedGoals(HStr, AStr, HS, AS);
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
			R.Attendance = FMath::Min(StadiumCapacity, FM13Economy::Attendance(StadiumCapacity, Fans, LeagueLevel, OwnRank(), TicketPrice) * 6 / 5);
			const int64 Tickets = (int64)R.Attendance * TicketPrice;
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
		RollInjuries(R);
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
		O.Price = RoundTo((int64)((double)O.Player.MarketValue * (1.0 + Rng.FRand() * 0.25)), 5000);
		Market.Add(O);
	}
}

bool FFM13World::BuyPlayer(int32 MarketIndex, FString& OutReason)
{
	if (!Market.IsValidIndex(MarketIndex)) { OutReason = TEXT("Dieses Angebot gibt es nicht mehr."); return false; }
	if (Squad.Num() >= FM13::MaxSquadSize) { OutReason = TEXT("Der Kader ist voll (30 Spieler)."); return false; }
	const FFM13MarketOffer O = Market[MarketIndex];
	if (HasTransferEmbargo()) { OutReason = TEXT("Transfersperre: das Konto ist im Minus."); return false; }
	if (Money < O.Price) { OutReason = TEXT("Nicht genug Geld auf dem Konto."); return false; }
	if (!FitsWageBudget(O.Player.Wage)) { OutReason = TEXT("Das Gehalt sprengt das Gehaltsbudget des Vorstands."); return false; }
	Book(FString(TEXT("Transfer: ")) + O.Player.Name, -O.Price);
	Squad.Add(O.Player);
	Market.RemoveAt(MarketIndex);
	AddMessage(TEXT("Neuzugang"), O.Player.Name + TEXT(" unterschreibt fuer drei Jahre."));
	return true;
}

bool FFM13World::SellPlayer(int32 PlayerId, FString& OutReason)
{
	const int32 Idx = Squad.IndexOfByPredicate([PlayerId](const FFM13Player& P) { return P.Id == PlayerId; });
	if (Idx < 0) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (Squad.Num() <= FM13::MinSquadSize) { OutReason = TEXT("Mindestens 16 Spieler muessen bleiben."); return false; }
	const FFM13Player P = Squad[Idx];
	const int64 Erloes = RoundTo((int64)((double)P.MarketValue * 0.9), 5000);
	Book(FString(TEXT("Verkauf: ")) + P.Name, Erloes);
	Squad.RemoveAt(Idx);
	IncomingOffers.RemoveAll([PlayerId](const FFM13IncomingOffer& O) { return !O.bYouth && O.PlayerId == PlayerId; });
	return true;
}

int32 FFM13World::RenewalWage(const FFM13Player& P) const
{
	const int32 Markt = FM13Economy::Wage(P.MarketValue, P.Strength);
	return (int32)(FMath::RoundToInt64(FMath::Max(P.Wage, Markt) * 1.1 / 50.0) * 50);
}

bool FFM13World::RenewContract(int32 PlayerId, int32 Years, FString& OutReason)
{
	FFM13Player* P = FindPlayer(PlayerId);
	if (!P) { OutReason = TEXT("Spieler nicht im Kader."); return false; }
	if (Years < 1 || Years > 5) { OutReason = TEXT("Laufzeit 1 bis 5 Jahre."); return false; }
	if (P->ContractYears >= 3) { OutReason = TEXT("Der Vertrag laeuft noch lange genug."); return false; }
	const int32 NeuLohn = RenewalWage(*P);
	if (!FitsWageBudget(NeuLohn - P->Wage)) { OutReason = TEXT("Die Gehaltserhoehung sprengt das Gehaltsbudget."); return false; }
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

bool FFM13World::SetTicketPrice(int32 Price, FString& OutReason)
{
	const int32 Basis = FM13Economy::BaseTicketPrice(LeagueLevel);
	if (Price < 1 || Price > Basis * 5) { OutReason = FString::Printf(TEXT("Erlaubt sind 1 bis %d Euro."), Basis * 5); return false; }
	TicketPrice = Price;
	return true;
}

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

	// Gehaltsbudget (vereinfacht getWageBudgetFloor/applyCashSurplusBudgets in js/season-end.js):
	// 70 % der erwarteten Einnahmen pro Spieltag, nie unter den laufenden Gehältern
	const int32 Zuschauer = FM13Economy::Attendance(StadiumCapacity, Fans, LeagueLevel, 9, TicketPrice);
	const int64 Einnahmen = (int64)FMath::Max(Sponsor.Base, 500) + FM13Economy::TvMoney(LeagueLevel, 9) / FM13::MatchdaysPerSeason
		+ (int64)Zuschauer * TicketPrice / 2;
	const int64 Reserve = FMath::Max<int64>(0, Money) / (FM13::MatchdaysPerSeason * 3); // ein Drittel des Polsters verteilt auf drei Saisons
	WageBudget = FMath::Max<int64>(WagesPerMatchday(), Einnahmen * 7 / 10 + Reserve);
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
	for (FFM13Player& T : YouthTalents)
		if (T.Strength < T.Potential && Rng.FRand() < Chance) T.Strength++;
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

int32 FFM13World::OwnMatchStrength(TCHAR OppArchetype) const
{
	// calcTeamStrength + getTacticStyleBonus + Formationsboni + Taktik-Duell (getOwnLeagueMatchStrength)
	const float Formationen = FM13Tactics::FormationOffBonus(Formation) + FM13Tactics::FormationDefBonus(Formation) * 0.6f;
	float Zusatz = Formationen + MoraleBonus();
	// Vorbereitung, Ansprache und Derby zählen nur im nächsten Ligaspiel (OppArchetype gesetzt)
	if (OppArchetype)
	{
		Zusatz += MatchPrepBonus();
		if (!PendingTalk.IsEmpty()) Zusatz += TalkBonus(PendingTalk);
		if (IsDerbyNext() && DerbyPrepMatchday == Matchday)
		{
			if (DerbyPreps.Contains(TEXT("stimmung"))) Zusatz += 1.5f;
			if (DerbyPreps.Contains(TEXT("kampfansage"))) Zusatz += 1.f;
		}
	}
	return OwnStrength() + FM13Tactics::StyleBonus(TacticStyle) + FMath::RoundToInt(Zusatz) + FM13Tactics::MatchupBonus(TacticStyle, OppArchetype);
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
	const float Mult = FM13Match::RefereeFor(Season, Matchday, LeagueLevel, ClubName.Len()).CardMult * FM13Match::Weathers()[WeatherIndex].CardMult;
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
		Squad.RemoveAt(i);
		Book(FString::Printf(TEXT("Verkauf an %s: %s"), *O.Club, *O.PlayerName), O.Price);
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
	if (StadiumCapacity >= 25000) Unlock(TEXT("grosses-stadion"), OutNew);
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
	const int32 Eigen = OwnMatchStrength(0);
	int32 Tore[2][2] = { { 0, 0 }, { 0, 0 } };
	for (int32 Leg = 0; Leg < 2; ++Leg)
	{
		// Der Verein aus der unteren Liga hat im Hinspiel Heimrecht
		const bool bHeim = R.bForPromotion == (Leg == 0);
		const FM13Match::FExpectedGoals Xg = bHeim
			? FM13Match::ExpectedGoals(Eigen, Gegner.Strength, EFM13Playstyle::Ausgeglichen, Gegner.Playstyle)
			: FM13Match::ExpectedGoals(Gegner.Strength, Eigen, Gegner.Playstyle, EFM13Playstyle::Ausgeglichen);
		const int32 H = FM13Match::Poisson(Rng, Xg.Home), A = FM13Match::Poisson(Rng, Xg.Away);
		Tore[Leg][0] = bHeim ? H : A;
		Tore[Leg][1] = bHeim ? A : H;
		if (bHeim)
		{
			const int32 Zuschauer = StadiumCapacity; // Relegation: ausverkauft
			Book(TEXT("Relegation: Ticketeinnahmen"), (int64)Zuschauer * TicketPrice);
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
	// Eigene Aufstellung: Ausfälle ersetzt das Spiel automatisch durch den Besten der Position,
	// wer außerhalb seiner Position spielt, bringt 10 Punkte weniger (wie die Vorlagen im Browserspiel)
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
		if (Rest[Pos] > 0) { Rest[Pos]--; Summe += Squad[i].Strength; }
		else Summe += FMath::Max(1, Squad[i].Strength - 10);
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
	while (Elf.Num() < 11 && Frei.Num()) { Elf.Add(Frei[0]); Summe += FMath::Max(1, Squad[Frei[0]].Strength - 10); Frei.RemoveAt(0); }
	OutStrength = Elf.Num() ? FMath::RoundToInt((float)Summe / 11.f) : 0;
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

float FFM13World::MoraleBonus() const
{
	int32 Dummy = 0;
	const TArray<int32> Elf = LineupIndices(Dummy);
	if (!Elf.Num()) return 0.f;
	int32 Summe = 0;
	for (int32 i : Elf) Summe += Squad[i].Morale;
	const int32 Schnitt = Summe / Elf.Num();
	return Schnitt >= 75 ? 1.f : (Schnitt <= 35 ? -1.f : 0.f);
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
	const int32 Eigen = OwnMatchStrength(OppPlanArchetype);
	const FM13Match::FExpectedGoals Xg = bHeim
		? FM13Match::ExpectedGoals(Eigen, Opp->Strength, EFM13Playstyle::Ausgeglichen, Opp->Playstyle)
		: FM13Match::ExpectedGoals(Opp->Strength, Eigen, Opp->Playstyle, EFM13Playstyle::Ausgeglichen);
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
	auto Spiel = [this](const FString& Heim, int32 HStr, const FString& Gast, int32 GStr, int32& OutH, int32& OutA)
	{
		const bool bEigenHeim = Heim == ClubName, bEigenGast = Gast == ClubName;
		const int32 HS = bEigenHeim ? OwnMatchStrength(0) : HStr, GS = bEigenGast ? OwnMatchStrength(0) : GStr;
		const FM13Match::FExpectedGoals Xg = FM13Match::ExpectedGoals(HS, GS, EFM13Playstyle::Ausgeglichen, EFM13Playstyle::Ausgeglichen);
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
				R.Attendance = StadiumCapacity;   // Europapokal: ausverkauft
				const int64 Tickets = (int64)StadiumCapacity * TicketPrice * 3 / 2;
				Book(TEXT("Europapokal: Ticketeinnahmen"), Tickets);
				R.Income += Tickets;
			}
			R.Weather = FM13Match::Weathers()[WeatherIndex].Name;
			FinishOwnReport(R, bEigenHeim ? Gast : Heim, bEigenHeim, TArray<FString>(), TArray<FString>());
			RollInjuries(R);
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
				Spiel(H.Name, H.Strength, A.Name, A.Strength, HG, AG);
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
			if (Matchday == 27) { Spiel(T.A, StaerkeVon(T.A), T.B, StaerkeVon(T.B), H, A); T.Leg1A = H; T.Leg1B = A; }
			else
			{
				Spiel(T.B, StaerkeVon(T.B), T.A, StaerkeVon(T.A), H, A); T.Leg2B = H; T.Leg2A = A;
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
		Spiel(F.A, StaerkeVon(F.A), F.B, StaerkeVon(F.B), H, A);
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
