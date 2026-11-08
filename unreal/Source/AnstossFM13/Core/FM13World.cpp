#include "FM13World.h"
#include "FM13Economy.h"
#include "FM13Match.h"
#include "FM13Names.h"

namespace
{
	// Start je Liga: Kontostand und Stadiongröße (das Browserspiel startet immer in der 6. Liga mit 150.000 €)
	const int64 StartMoney[FM13::NumLeagues] = { 30000000, 6000000, 1500000, 600000, 250000, 150000 };
	const int32 StartCapacity[FM13::NumLeagues] = { 60000, 30000, 15000, 8000, 5000, 4000 };

	// Formation 4-4-2: so viele Plätze je Position (TW, ABW, MIT, ST)
	const int32 Slots[4] = { 1, 4, 4, 2 };

	// Beste Elf: je Position die Stärksten; fehlt ein Spieler, rückt der beste Rest mit -10 auf die Position.
	// Gibt Indizes in Squad zurück, OutStrength ist der Schnitt der Elf.
	TArray<int32> BestEleven(const TArray<FFM13Player>& Squad, int32& OutStrength)
	{
		TArray<int32> Idx;
		for (int32 i = 0; i < Squad.Num(); ++i) Idx.Add(i);
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
		OutStrength = Squad.Num() > 0 ? FMath::RoundToInt((float)Summe / 11.f) : 0;
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

	PlanSeason();
	RefreshMarket();
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
	if (Matchday % 4 == 0) RefreshMarket();
	++Matchday;
	CheckJobSecurity();
	return true;
}

void FFM13World::PlayOwnFixture(FFM13League& L, FFM13Fixture& F)
{
	const bool bHome = L.Clubs[F.Home].bOwn;
	const FFM13Club& Opp = bHome ? L.Clubs[F.Away] : L.Clubs[F.Home];
	const int32 Own = OwnStrength();
	const int32 OppStr = Opp.Strength;
	const FString OppName = Opp.Name;

	const FM13Match::FExpectedGoals Xg = bHome
		? FM13Match::ExpectedGoals(Own, OppStr, EFM13Playstyle::Ausgeglichen, Opp.Playstyle)
		: FM13Match::ExpectedGoals(OppStr, Own, Opp.Playstyle, EFM13Playstyle::Ausgeglichen);
	const int32 HG = FM13Match::Poisson(Rng, Xg.Home);
	const int32 AG = FM13Match::Poisson(Rng, Xg.Away);
	L.ApplyResult(F, HG, AG);

	const int32 OwnGoals = bHome ? HG : AG;
	const int32 OppGoals = bHome ? AG : HG;

	int32 Dummy = 0;
	for (int32 i : BestEleven(Squad, Dummy)) Squad[i].Appearances++;
	PickScorers(OwnGoals, LastReport.Scorers);

	const int32 Shift = FM13Match::BoardShift(FM13Match::Expectation(Own, OppStr), OwnGoals, OppGoals);
	BoardSat = FMath::Clamp(BoardSat + Shift, 10, 100);
	if (OwnGoals > OppGoals) Fans = FMath::Min(100, Fans + 1);
	else if (OwnGoals < OppGoals) Fans = FMath::Max(0, Fans - 1);

	const int32 Att = bHome ? FM13Economy::Attendance(StadiumCapacity, Fans, LeagueLevel, OwnRank(), TicketPrice) : 0;
	ApplyMatchdayFinances(bHome, OwnGoals > OppGoals, Att);

	LastReport.bPlayed = true;
	LastReport.bHome = bHome;
	LastReport.Opponent = OppName;
	LastReport.OwnGoals = OwnGoals;
	LastReport.OppGoals = OppGoals;
	LastReport.OwnStrength = Own;
	LastReport.OppStrength = OppStr;
	LastReport.Attendance = Att;
	LastReport.BoardShift = Shift;
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
	Buche(TEXT("Sponsor Grundbetrag"), FM13Economy::SponsorBase(LeagueLevel));
	if (bWin) Buche(TEXT("Sponsor Siegpraemie"), FM13Economy::SponsorWinBonus(LeagueLevel));
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
	const TArray<int32> Elf = BestEleven(Squad, Dummy);
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
	S.Outcome = Outcome;

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

	AdvanceLeagues(Rank, Outcome);
	DevelopPlayers(S);
	YouthIntake(S);

	++Season;
	Matchday = 1;
	for (FFM13League& L : Leagues)
	{
		L.ResetStats();
		L.BuildSchedule(Rng);
	}
	PlanSeason();
	RefreshMarket();

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
		P.Age++;
		int32 Delta;
		if (P.Age <= 23) Delta = P.Strength < P.Potential ? Rng.RandRange(1, 4) : Rng.RandRange(-1, 1);
		else if (P.Age <= 29) Delta = Rng.RandRange(-1, 2);
		else if (P.Age <= 32) Delta = Rng.RandRange(-3, 0);
		else Delta = Rng.RandRange(-5, -1);
		int32 Neu = P.Strength + Delta;
		if (P.Age <= 23) Neu = FMath::Min(Neu, FMath::Max(P.Potential, P.Strength));
		P.Strength = FMath::Clamp(Neu, 1, 99);
		P.MarketValue = FM13Economy::MarketValue(P.Strength, &Rng);
		P.GoalsCareer += P.GoalsSeason;
		P.GoalsSeason = 0;
		P.Appearances = 0;
		P.ContractYears--;
	}

	// Vertragsende und Karriereende
	TArray<FFM13Player> Bleiben;
	for (const FFM13Player& P : Squad)
	{
		const bool bRuhestand = P.Age >= 37 || (P.Age >= 35 && Rng.RandRange(0, 1) == 1);
		if (bRuhestand) { S.Left.Add(P.Name + TEXT(" (Karriereende)")); continue; }
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
	BestEleven(Squad, Staerke);
	return Staerke;
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
	YouthTalents.RemoveAt(YouthIndex);
	AddMessage(TEXT("Aus der Jugend"), P.Name + TEXT(" rueckt in den Profikader auf."));
	return true;
}

bool FFM13World::ReleaseYouth(int32 YouthIndex, FString& OutReason)
{
	if (!YouthTalents.IsValidIndex(YouthIndex)) { OutReason = TEXT("Dieses Talent gibt es nicht."); return false; }
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
	const int64 Einnahmen = FM13Economy::SponsorBase(LeagueLevel) + FM13Economy::TvMoney(LeagueLevel, 9) / FM13::MatchdaysPerSeason
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
