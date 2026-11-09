#include "FM13GameInstance.h"
#include "FM13Core/FM13SaveCodec.h"
#include "FM13Core/FM13BrowserImport.h"
#include "FM13Core/FM13Development.h"
#include "FM13Core/FM13Tactics.h"
#include "HAL/PlatformMisc.h"
#include "HAL/FileManager.h"
#include "Misc/DateTime.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

namespace
{
	const TCHAR* AutosaveSlot = TEXT("autosave");

}

void UFM13GameInstance::Init()
{
	Super::Init();
	FString Fehler;
	if (!HasSaveGame(AutosaveSlot) || !LoadGame(AutosaveSlot, Fehler))
	{
		if (!Fehler.IsEmpty()) UE_LOG(LogTemp, Warning, TEXT("FM13: Autosave nicht geladen: %s"), *Fehler);
		NewGame(TEXT("1.FC Moritz Leipzig"));
	}
}

void UFM13GameInstance::NewGame(const FString& ClubName, int32 Seed)
{
	const int32 Saat = Seed != 0 ? Seed : (int32)(FDateTime::Now().GetTicks() & 0x7fffffff);
	Kern.NewGame(ClubName, Saat);
	Changed();
}

bool UFM13GameInstance::PlayMatchday(FString& OutReason)
{
	if (Kern.bSacked) { OutReason = TEXT("Du bist entlassen. Starte eine neue Karriere."); return false; }
	if (Kern.IsSeasonFinished()) { OutReason = TEXT("Die Saison ist vorbei. Schliesse sie zuerst ab."); return false; }
	if (!Kern.PlayMatchday()) { OutReason = TEXT("Der Spieltag konnte nicht gespielt werden."); return false; }
	if (bAutosave)
	{
		FString Fehler;
		if (!SaveGame(AutosaveSlot, Fehler)) UE_LOG(LogTemp, Warning, TEXT("FM13: Autosave fehlgeschlagen: %s"), *Fehler);
	}
	Changed();
	return true;
}

bool UFM13GameInstance::ConcludeSeason(FString& OutSummary)
{
	if (!Kern.IsSeasonFinished()) { OutSummary = TEXT("Die Saison laeuft noch."); return false; }
	if (Kern.bSacked) { OutSummary = TEXT("Du bist entlassen."); return false; }
	const FFM13SeasonSummary S = Kern.ConcludeSeason();
	const TCHAR* Ausgang = S.Outcome == EFM13SeasonOutcome::Promoted ? TEXT("Aufstieg!") : (S.Outcome == EFM13SeasonOutcome::Relegated ? TEXT("Abstieg.") : TEXT("Klassenerhalt."));
	OutSummary = FString::Printf(TEXT("Saison %d: Platz %d mit %d Punkten. %s %d Abgaenge, %d neue Talente."),
		S.Season, S.Rank, S.Points, Ausgang, S.Left.Num(), S.NewYouth.Num());
	if (Kern.bSacked) OutSummary += TEXT(" Der Vorstand hat dich entlassen.");
	if (bAutosave) { FString Fehler; SaveGame(AutosaveSlot, Fehler); }
	Changed();
	return true;
}

// ---------- Ansichten ----------

FFM13PlayerView UFM13GameInstance::MakePlayerView(const FFM13Player& P, bool bInEleven)
{
	FFM13PlayerView V;
	V.Id = P.Id;
	V.Name = P.Name;
	V.Position = FM13PositionName(P.Pos);
	V.Strength = P.Strength;
	V.Potential = P.Potential;
	V.Age = P.Age;
	V.GoalsSeason = P.GoalsSeason;
	V.Appearances = P.Appearances;
	V.MarketValue = P.MarketValue;
	V.Wage = P.Wage;
	V.ContractYears = P.ContractYears;
	V.bInStartingEleven = bInEleven;
	V.InjuredMatchdays = P.InjuredMatchdays;
	V.SuspendedMatchdays = P.SuspendedMatchdays;
	V.YellowCards = P.YellowCards;
	V.SeasonsAtClub = P.SeasonsAtClub;
	V.Archetype = FM13Dev::Archetypes()[FMath::Min((int32)P.Archetype, FM13Dev::Archetypes().Num() - 1)].Name;
	V.Character = FM13CharacterName(P.Character);
	V.Morale = P.Morale;
	return V;
}

FFM13StatusView UFM13GameInstance::GetStatus() const
{
	FFM13StatusView S;
	S.ClubName = Kern.ClubName;
	S.LeagueName = FM13::LeagueName(Kern.LeagueLevel);
	S.LeagueLevel = Kern.LeagueLevel;
	S.Season = Kern.Season;
	S.Matchday = Kern.Matchday;
	S.Money = Kern.Money;
	S.Fans = Kern.Fans;
	S.BoardSat = Kern.BoardSat;
	S.SeasonTarget = Kern.SeasonTarget;
	S.Rank = Kern.Leagues.Num() ? Kern.OwnRank() : 0;
	S.OwnStrength = Kern.OwnStrength();
	S.WageBudget = Kern.WageBudget;
	S.Wages = Kern.WagesPerMatchday();
	S.SquadValue = Kern.SquadValue();
	S.StadiumCapacity = Kern.StadiumCapacity;
	S.PendingSeats = Kern.PendingSeats;
	S.PendingSeatsMatchdays = Kern.PendingSeatsMatchdays;
	S.TicketPrice = Kern.TicketPrice;
	S.YouthAcademyLevel = Kern.YouthAcademyLevel;
	S.YouthAcademyUpgradeCost = Kern.YouthAcademyUpgradeCost();
	S.TrainingLevel = Kern.TrainingLevel;
	S.TrainingUpgradeCost = Kern.TrainingUpgradeCost();
	S.bSeasonFinished = Kern.IsSeasonFinished();
	S.bSacked = Kern.bSacked;
	S.bTransferEmbargo = Kern.HasTransferEmbargo();
	return S;
}

FFM13MatchReportView UFM13GameInstance::MakeReportView(const FFM13OwnMatchReport& R)
{
	FFM13MatchReportView V;
	V.bPlayed = R.bPlayed; V.bHome = R.bHome; V.Opponent = R.Opponent;
	V.OwnGoals = R.OwnGoals; V.OppGoals = R.OppGoals; V.OwnStrength = R.OwnStrength; V.OppStrength = R.OppStrength;
	V.Attendance = R.Attendance; V.Income = R.Income; V.Expenses = R.Expenses; V.BoardShift = R.BoardShift;
	V.Scorers = R.Scorers; V.Ticker = R.Ticker; V.Injuries = R.Injuries; V.Competition = R.Competition;
	V.bPenalties = R.bPenalties; V.bAdvanced = R.bAdvanced;
	V.Weather = R.Weather; V.Referee = R.Referee; V.OppArchetype = R.OppArchetype; V.TacticBonus = R.TacticBonus; V.Cards = R.Cards;
	if (!R.Talk.IsEmpty()) V.Cards.Insert(FString::Printf(TEXT("Ansprache %s: %+.1f"), *R.Talk, R.TalkBonus), 0);
	if (R.PrepBonus > 0.f) V.Cards.Insert(TEXT("Vorbereitung richtig: +2,5"), 0);
	if (R.bDerby) V.Cards.Insert(FString::Printf(TEXT("Derby (Vorbereitung %+.1f)"), R.DerbyBonus), 0);
	return V;
}

FFM13MatchReportView UFM13GameInstance::GetLastReport() const { return MakeReportView(Kern.LastReport); }
FFM13MatchReportView UFM13GameInstance::GetLastCupReport() const { return MakeReportView(Kern.LastCupReport); }

FFM13CupView UFM13GameInstance::MakeCupView(const FFM13Cup& C)
{
	FFM13CupView V;
	V.Name = C.Name;
	V.bOwnEntered = C.bOwnEntered;
	V.bOwnAlive = C.bOwnAlive;
	V.bFinished = C.IsFinished();
	V.NextRound = C.NextRoundName();
	V.NextMatchday = C.NextMatchday();
	V.TeamsLeft = C.Alive.Num();
	V.Winner = C.Winner;
	for (const FFM13CupMatch& M : C.LastRound)
		V.LastRound.Add(FString::Printf(TEXT("%s - %s  %d:%d%s"), *M.Home, *M.Away, M.HomeGoals, M.AwayGoals, M.bPenalties ? TEXT(" n.E.") : TEXT("")));
	return V;
}

TArray<FFM13CupView> UFM13GameInstance::GetCups() const
{
	TArray<FFM13CupView> Out;
	Out.Add(MakeCupView(Kern.DfbPokal));
	if (Kern.Landespokal.bOwnEntered) Out.Add(MakeCupView(Kern.Landespokal));
	return Out;
}

TArray<FFM13PlayerView> UFM13GameInstance::GetSquad() const
{
	const TArray<int32> Elf = Kern.StartingEleven();
	TArray<FFM13PlayerView> Out;
	for (const FFM13Player& P : Kern.Squad)
	{
		FFM13PlayerView V = MakePlayerView(P, Elf.Contains(P.Id));
		V.bBenched = Kern.ManualBench.Contains(P.Id);
		Out.Add(V);
	}
	// Sortierung wie im Kader: Position, dann Stärke
	Out.Sort([](const FFM13PlayerView& A, const FFM13PlayerView& B)
	{
		static const TCHAR* Reihe[] = { TEXT("TW"), TEXT("ABW"), TEXT("MIT"), TEXT("ST") };
		auto Rang = [](const FString& Pos) { for (int32 i = 0; i < 4; ++i) if (Pos == Reihe[i]) return i; return 4; };
		if (Rang(A.Position) != Rang(B.Position)) return Rang(A.Position) < Rang(B.Position);
		return A.Strength > B.Strength;
	});
	return Out;
}

TArray<FFM13PlayerView> UFM13GameInstance::GetYouth() const
{
	TArray<FFM13PlayerView> Out;
	for (const FFM13Player& P : Kern.YouthTalents) Out.Add(MakePlayerView(P, false));
	return Out;
}

TArray<FFM13OfferView> UFM13GameInstance::GetMarket() const
{
	TArray<FFM13OfferView> Out;
	for (const FFM13MarketOffer& O : Kern.Market)
	{
		FFM13OfferView V;
		V.Player = MakePlayerView(O.Player, false);
		V.Price = O.Price;
		Out.Add(V);
	}
	return Out;
}

TArray<FFM13TableRowView> UFM13GameInstance::GetTable(int32 Level) const
{
	TArray<FFM13TableRowView> Out;
	const int32 L = Level < 0 ? Kern.LeagueLevel : Level;
	if (!Kern.Leagues.IsValidIndex(L)) return Out;
	const FFM13League& Liga = Kern.Leagues[L];
	const TArray<int32> Idx = Liga.SortedIndices();
	for (int32 r = 0; r < Idx.Num(); ++r)
	{
		const FFM13Club& C = Liga.Clubs[Idx[r]];
		FFM13TableRowView V;
		V.Rank = r + 1; V.Club = C.Name; V.Played = C.Played; V.Won = C.Won; V.Drawn = C.Drawn; V.Lost = C.Lost;
		V.GoalsFor = C.GoalsFor; V.GoalsAgainst = C.GoalsAgainst; V.GoalDiff = C.GoalDiff(); V.Points = C.Points(); V.bOwn = C.bOwn;
		Out.Add(V);
	}
	return Out;
}

TArray<FFM13FixtureView> UFM13GameInstance::GetOwnFixtures() const
{
	TArray<FFM13FixtureView> Out;
	if (!Kern.Leagues.IsValidIndex(Kern.LeagueLevel)) return Out;
	const FFM13League& Liga = Kern.OwnLeague();
	for (const FFM13Fixture& F : Liga.Fixtures)
	{
		if (!Liga.Clubs[F.Home].bOwn && !Liga.Clubs[F.Away].bOwn) continue;
		FFM13FixtureView V;
		V.Matchday = F.Matchday; V.Home = Liga.Clubs[F.Home].Name; V.Away = Liga.Clubs[F.Away].Name;
		V.bPlayed = F.bPlayed; V.HomeGoals = F.HomeGoals; V.AwayGoals = F.AwayGoals;
		Out.Add(V);
	}
	Out.Sort([](const FFM13FixtureView& A, const FFM13FixtureView& B) { return A.Matchday < B.Matchday; });
	return Out;
}

TArray<FFM13BookingView> UFM13GameInstance::GetBookings(int32 MaxCount) const
{
	TArray<FFM13BookingView> Out;
	for (int32 i = Kern.Bookings.Num() - 1; i >= 0 && Out.Num() < MaxCount; --i)
	{
		const FFM13Booking& B = Kern.Bookings[i];
		FFM13BookingView V;
		V.Label = B.Label; V.Amount = B.Amount; V.Season = B.Season; V.Matchday = B.Matchday;
		Out.Add(V);
	}
	return Out;
}

TArray<FFM13MessageView> UFM13GameInstance::GetMessages(int32 MaxCount) const
{
	TArray<FFM13MessageView> Out;
	for (int32 i = Kern.Messages.Num() - 1; i >= 0 && Out.Num() < MaxCount; --i)
	{
		const FFM13Message& M = Kern.Messages[i];
		FFM13MessageView V;
		V.Title = M.Title; V.Body = M.Body; V.Season = M.Season; V.Matchday = M.Matchday;
		Out.Add(V);
	}
	return Out;
}

TArray<FFM13SeasonRecordView> UFM13GameInstance::GetHistory() const
{
	TArray<FFM13SeasonRecordView> Out;
	for (int32 i = Kern.History.Num() - 1; i >= 0; --i)
	{
		const FFM13SeasonRecord& R = Kern.History[i];
		FFM13SeasonRecordView V;
		V.Season = R.Season;
		V.LeagueName = FM13::LeagueName(R.Level);
		V.Rank = R.Rank;
		V.Points = R.Points;
		V.Outcome = R.Outcome == EFM13SeasonOutcome::Promoted ? TEXT("Aufstieg") : (R.Outcome == EFM13SeasonOutcome::Relegated ? TEXT("Abstieg") : TEXT("Klassenerhalt"));
		Out.Add(V);
	}
	return Out;
}

FFM13TacticsView UFM13GameInstance::GetTactics() const
{
	FFM13TacticsView V;
	V.Formation = Kern.Formation;
	V.Style = Kern.TacticStyle;
	for (const FM13Tactics::FFormation& F : FM13Tactics::Formations()) V.Formations.Add(F.Name);
	for (const FM13Tactics::FStyle& St : FM13Tactics::Styles())
	{
		V.StyleKeys.Add(St.Key);
		V.StyleLabels.Add(St.Label);
		V.StyleBonuses.Add(FM13Tactics::StyleBonus(St.Key));
		V.StyleArchetypes.Add(FM13Tactics::ArchetypeLabel(St.Archetype));
	}
	V.ElfStrength = Kern.OwnStrength();
	V.MatchStrength = Kern.OwnMatchStrength(Kern.OppPlanArchetype);
	V.StyleBonus = FM13Tactics::StyleBonus(Kern.TacticStyle);
	V.FormationBonus = FM13Tactics::FormationOffBonus(Kern.Formation) + FM13Tactics::FormationDefBonus(Kern.Formation) * 0.6f;
	V.FitnessCostPercent = FMath::RoundToInt((FM13Tactics::StyleFitnessMultiplier(Kern.TacticStyle) - 1.f) * 100.f);
	bool bHeim = true;
	if (const FFM13Club* Opp = Kern.NextLeagueOpponent(&bHeim))
	{
		V.NextOpponent = Opp->Name;
		V.NextOpponentStrength = Opp->Strength;
		V.bNextHome = bHeim;
	}
	// Nur der öffentliche Grundstil: ob der Gegner sich auf dich einstellt, zeigt erst das Spiel
	const FFM13Club* Naechster = Kern.NextLeagueOpponent();
	const TCHAR Grundstil = Naechster ? FM13Tactics::AiArchetype(Naechster->Playstyle) : 0;
	V.OppPlan = FM13Tactics::ArchetypeLabel(Grundstil);
	V.bOppReacted = false;
	V.MatchupBonus = FM13Tactics::MatchupBonus(Kern.TacticStyle, Grundstil);
	V.MatchStrength = Kern.OwnMatchStrength(Grundstil ? Grundstil : TEXT('N'));
	V.bManualLineup = Kern.IsManualLineup();
	const TCHAR* Reden[3][2] = { { TEXT("fokus"), TEXT("Keine Ueberheblichkeit") }, { TEXT("mut"), TEXT("Ihr habt nichts zu verlieren") }, { TEXT("druck"), TEXT("Heute zaehlt nur der Sieg") } };
	for (const auto& Rede : Reden) { V.TalkKeys.Add(Rede[0]); V.TalkLabels.Add(Rede[1]); V.TalkBonuses.Add(Kern.TalkBonus(Rede[0])); }
	V.PendingTalk = Kern.PendingTalk;
	V.Prep = (Kern.PrepMatchday == Kern.Matchday && Kern.PrepArchetype) ? FString(FM13Tactics::ArchetypeLabel(Kern.PrepArchetype)) : FString();
	Kern.Forecast(V.ForecastWin, V.ForecastDraw, V.ForecastLoss);
	V.MoraleBonus = Kern.MoraleBonus();
	V.Rival = Kern.RivalName;
	V.MatchdaysToDerby = Kern.MatchdaysToDerby();
	if (V.MatchdaysToDerby >= 0 && Kern.DerbyPrepMatchday == Kern.Matchday + V.MatchdaysToDerby) V.DerbyPreps = Kern.DerbyPreps;
	V.DerbyStimmungCost = Kern.DerbyPrepCost(TEXT("stimmung"));
	const TCHAR Lesbar = FM13Tactics::PredictableArchetype(Kern.RecentStyles);
	V.Predictable = Lesbar ? FString(FM13Tactics::ArchetypeLabel(Lesbar)) : FString();
	V.Referee = Kern.RefereeName();
	return V;
}

static FFM13SponsorView MakeSponsorView(const FFM13Sponsor& S)
{
	FFM13SponsorView V;
	V.Name = S.Name; V.Base = S.Base; V.WinBonus = S.WinBonus; V.PromotionBonus = S.PromotionBonus;
	V.SignOn = S.SignOn; V.MatchdaysLeft = S.MatchdaysLeft; V.Tier = S.Tier;
	return V;
}

FFM13SponsorView UFM13GameInstance::GetSponsor() const { return MakeSponsorView(Kern.Sponsor); }

TArray<FFM13SponsorView> UFM13GameInstance::GetSponsorOffers() const
{
	TArray<FFM13SponsorView> Out;
	for (const FFM13Sponsor& S : Kern.SponsorOffers) Out.Add(MakeSponsorView(S));
	return Out;
}

TArray<FFM13IncomingOfferView> UFM13GameInstance::GetIncomingOffers() const
{
	TArray<FFM13IncomingOfferView> Out;
	for (const FFM13IncomingOffer& O : Kern.IncomingOffers)
	{
		FFM13IncomingOfferView V;
		V.PlayerName = O.PlayerName; V.Club = O.Club; V.Price = O.Price; V.bYouth = O.bYouth; V.ExpiresMatchday = O.ExpiresMatchday;
		Out.Add(V);
	}
	return Out;
}

TArray<FFM13AchievementView> UFM13GameInstance::GetAchievements() const
{
	static const TCHAR* Ids[] = { TEXT("millionaer"), TEXT("multimillionaer"), TEXT("aufstieg"), TEXT("bundesliga"), TEXT("meister"), TEXT("pokalsieger"),
		TEXT("landespokal"), TEXT("relegation"), TEXT("unbeaten-10"), TEXT("unbeaten-20"), TEXT("talentschmiede"), TEXT("grosses-stadion"), TEXT("legende"), TEXT("europa"), TEXT("europa-sieger") };
	TArray<FFM13AchievementView> Out;
	for (const TCHAR* Id : Ids)
	{
		FFM13AchievementView V;
		V.Label = FFM13World::AchievementLabel(Id);
		if (const FFM13Achievement* A = Kern.Achievements.FindByPredicate([Id](const FFM13Achievement& X) { return X.Id == Id; }))
		{
			V.bUnlocked = true;
			V.Season = A->Season;
		}
		Out.Add(V);
	}
	return Out;
}

TArray<FFM13LegendView> UFM13GameInstance::GetLegends() const
{
	TArray<FFM13LegendView> Out;
	for (const FFM13Legend& L : Kern.Legends)
	{
		FFM13LegendView V;
		V.Name = L.Name; V.Position = L.Position; V.Seasons = L.Seasons; V.Goals = L.Goals; V.RetiredSeason = L.RetiredSeason;
		Out.Add(V);
	}
	return Out;
}

FFM13RecordsView UFM13GameInstance::GetRecords() const
{
	const FFM13ClubRecords& R = Kern.Records;
	FFM13RecordsView V;
	V.BiggestWin = R.BiggestWinFor > 0 ? FString::Printf(TEXT("%d:%d gegen %s (Saison %d)"), R.BiggestWinFor, R.BiggestWinAgainst, *R.BiggestWinOpponent, R.BiggestWinSeason) : FString(TEXT("-"));
	V.UnbeatenStreak = R.UnbeatenStreak;
	V.LongestUnbeatenStreak = R.LongestUnbeatenStreak;
	V.RecordAttendance = R.RecordAttendance;
	V.RecordTransferFee = R.RecordTransferFee;
	const FFM13RelegationResult& Rel = Kern.LastRelegation;
	if (Rel.bPlayed)
		V.LastRelegation = FString::Printf(TEXT("%s gegen %s: %d:%d und %d:%d%s - %s"), Rel.bForPromotion ? TEXT("Aufstiegs-Relegation") : TEXT("Abstiegs-Relegation"),
			*Rel.Opponent, Rel.Leg1Own, Rel.Leg1Opp, Rel.Leg2Own, Rel.Leg2Opp, Rel.bPenalties ? TEXT(" n.E.") : TEXT(""), Rel.bWon ? TEXT("gewonnen") : TEXT("verloren"));
	return V;
}

FFM13EuropeView UFM13GameInstance::GetEurope() const
{
	const FFM13Europe& E = Kern.Europe;
	FFM13EuropeView V;
	V.bActive = E.bActive;
	V.bQualifiedNext = Kern.bEuropeNextSeason;
	V.Stage = E.OwnStage;
	V.Winner = E.Winner;
	for (int32 G = 0; G < 2; ++G)
	{
		TArray<FFM13EuroTeam> T = E.Groups[G];
		T.Sort([](const FFM13EuroTeam& A, const FFM13EuroTeam& B)
		{
			if (A.Points() != B.Points()) return A.Points() > B.Points();
			return (A.GoalsFor - A.GoalsAgainst) > (B.GoalsFor - B.GoalsAgainst);
		});
		for (const FFM13EuroTeam& X : T)
			(G == 0 ? V.GroupA : V.GroupB).Add(FString::Printf(TEXT("%-24s %d Sp  %d:%d  %d Pkt"), *X.Name, X.Played, X.GoalsFor, X.GoalsAgainst, X.Points()));
	}
	for (const FFM13EuroTie& T : E.Semis)
	{
		FString Z = FString::Printf(TEXT("Halbfinale: %s - %s"), *T.A, *T.B);
		if (T.Leg1A >= 0) Z += FString::Printf(TEXT("  %d:%d"), T.Leg1A, T.Leg1B);
		if (T.Leg2A >= 0) Z += FString::Printf(TEXT(", Rueckspiel %d:%d"), T.Leg2B, T.Leg2A);
		if (!T.Winner.IsEmpty()) Z += TEXT("  -> ") + T.Winner;
		V.KnockOut.Add(Z);
	}
	if (!E.Final.A.IsEmpty())
		V.KnockOut.Add(FString::Printf(TEXT("Finale: %s - %s%s"), *E.Final.A, *E.Final.B, E.Final.Winner.IsEmpty() ? TEXT("") : *FString::Printf(TEXT("  %d:%d -> %s"), E.Final.Leg1A, E.Final.Leg1B, *E.Final.Winner)));
	V.LastResults = E.LastResults;
	return V;
}

TArray<FString> UFM13GameInstance::GetAwards() const { return Kern.AwardHistory; }

TArray<FFM13TableRowView> UFM13GameInstance::GetTableSplit(int32 Level, int32 Mode) const
{
	if (Mode <= 0) return GetTable(Level);
	TArray<FFM13TableRowView> Out;
	const int32 L = Level < 0 ? Kern.LeagueLevel : Level;
	if (!Kern.Leagues.IsValidIndex(L)) return Out;
	const FFM13League& Liga = Kern.Leagues[L];
	TArray<FFM13Club> Clubs = Liga.Clubs;
	for (FFM13Club& C : Clubs) C.ResetStats();
	for (const FFM13Fixture& F : Liga.Fixtures)
	{
		if (!F.bPlayed) continue;
		const int32 i = Mode == 1 ? F.Home : F.Away;
		const int32 Tore = Mode == 1 ? F.HomeGoals : F.AwayGoals, Gegen = Mode == 1 ? F.AwayGoals : F.HomeGoals;
		FFM13Club& C = Clubs[i];
		C.Played++; C.GoalsFor += Tore; C.GoalsAgainst += Gegen;
		if (Tore > Gegen) C.Won++; else if (Tore == Gegen) C.Drawn++; else C.Lost++;
	}
	TArray<int32> Idx;
	for (int32 i = 0; i < Clubs.Num(); ++i) Idx.Add(i);
	Idx.Sort([&Clubs](int32 A, int32 B) { return FM13CompareRows(Clubs[A], Clubs[B]); });
	for (int32 r = 0; r < Idx.Num(); ++r)
	{
		const FFM13Club& C = Clubs[Idx[r]];
		FFM13TableRowView V;
		V.Rank = r + 1; V.Club = C.Name; V.Played = C.Played; V.Won = C.Won; V.Drawn = C.Drawn; V.Lost = C.Lost;
		V.GoalsFor = C.GoalsFor; V.GoalsAgainst = C.GoalsAgainst; V.GoalDiff = C.GoalDiff(); V.Points = C.Points(); V.bOwn = C.bOwn;
		Out.Add(V);
	}
	return Out;
}

TArray<FString> UFM13GameInstance::GetLeagueStats(int32 Level) const
{
	// league-stats.js (Ausschnitt): beste Offensive, beste Abwehr, meiste Siege, meiste Remis
	TArray<FString> Out;
	const int32 L = Level < 0 ? Kern.LeagueLevel : Level;
	if (!Kern.Leagues.IsValidIndex(L)) return Out;
	const TArray<FFM13Club>& C = Kern.Leagues[L].Clubs;
	if (!C.Num() || C[0].Played + C[1].Played == 0) { Out.Add(TEXT("Noch keine Spiele.")); return Out; }
	int32 Off = 0, Def = 0, Sieg = 0, Remis = 0;
	for (int32 i = 1; i < C.Num(); ++i)
	{
		if (C[i].GoalsFor > C[Off].GoalsFor) Off = i;
		if (C[i].GoalsAgainst < C[Def].GoalsAgainst) Def = i;
		if (C[i].Won > C[Sieg].Won) Sieg = i;
		if (C[i].Drawn > C[Remis].Drawn) Remis = i;
	}
	int32 Tore = 0, Spiele = 0;
	for (const FFM13Fixture& F : Kern.Leagues[L].Fixtures) if (F.bPlayed) { Tore += F.HomeGoals + F.AwayGoals; ++Spiele; }
	Out.Add(FString::Printf(TEXT("Beste Offensive: %s (%d Tore)"), *C[Off].Name, C[Off].GoalsFor));
	Out.Add(FString::Printf(TEXT("Beste Abwehr: %s (%d Gegentore)"), *C[Def].Name, C[Def].GoalsAgainst));
	Out.Add(FString::Printf(TEXT("Meiste Siege: %s (%d)"), *C[Sieg].Name, C[Sieg].Won));
	Out.Add(FString::Printf(TEXT("Meiste Remis: %s (%d)"), *C[Remis].Name, C[Remis].Drawn));
	Out.Add(FString::Printf(TEXT("Tore pro Spiel: %.2f (%d Spiele)"), Spiele ? (float)Tore / (float)Spiele : 0.f, Spiele));
	return Out;
}

FString UFM13GameInstance::FormatMoney(int64 Amount)
{
	// 1234567 -> "1.234.567 €"
	FString Ziffern = FString::Printf(TEXT("%lld"), (long long)FMath::Abs(Amount));
	FString Out;
	for (int32 i = 0; i < Ziffern.Len(); ++i)
	{
		if (i > 0 && (Ziffern.Len() - i) % 3 == 0) Out.AppendChar(TEXT('.'));
		Out.AppendChar(Ziffern[i]);
	}
	return (Amount < 0 ? TEXT("-") : TEXT("")) + Out + TEXT(" €");
}

// ---------- Aktionen ----------

bool UFM13GameInstance::BuyPlayer(int32 MarketIndex, FString& OutReason) { const bool b = Kern.BuyPlayer(MarketIndex, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::SellPlayer(int32 PlayerId, FString& OutReason) { const bool b = Kern.SellPlayer(PlayerId, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::RenewContract(int32 PlayerId, int32 Years, FString& OutReason) { const bool b = Kern.RenewContract(PlayerId, Years, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::PromoteYouth(int32 YouthIndex, FString& OutReason) { const bool b = Kern.PromoteYouth(YouthIndex, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::ReleaseYouth(int32 YouthIndex, FString& OutReason) { const bool b = Kern.ReleaseYouth(YouthIndex, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::SetTicketPrice(int32 Price, FString& OutReason) { const bool b = Kern.SetTicketPrice(Price, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::ExpandStadium(int32 Seats, FString& OutReason) { const bool b = Kern.ExpandStadium(Seats, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::UpgradeYouthAcademy(FString& OutReason) { const bool b = Kern.UpgradeYouthAcademy(OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::UpgradeTraining(FString& OutReason) { const bool b = Kern.UpgradeTraining(OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::SetFormation(const FString& Formation, FString& OutReason) { const bool b = Kern.SetFormation(Formation, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::SetTacticStyle(const FString& Style, FString& OutReason) { const bool b = Kern.SetTacticStyle(Style, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::AcceptSponsorOffer(int32 Index, FString& OutReason) { const bool b = Kern.AcceptSponsorOffer(Index, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::AcceptIncomingOffer(int32 Index, FString& OutReason) { const bool b = Kern.AcceptIncomingOffer(Index, OutReason); Changed(); return b; }
bool UFM13GameInstance::DeclineIncomingOffer(int32 Index, FString& OutReason) { const bool b = Kern.DeclineIncomingOffer(Index, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::ToggleLineupPlayer(int32 PlayerId, FString& OutReason) { const bool b = Kern.ToggleLineupPlayer(PlayerId, OutReason); if (b) Changed(); return b; }
void UFM13GameInstance::AutoLineup() { Kern.ClearManualLineup(); Changed(); }
bool UFM13GameInstance::ChooseTalk(const FString& Type, FString& OutReason) { const bool b = Kern.ChooseTalk(Type, OutReason); if (b) Changed(); return b; }
bool UFM13GameInstance::SetMatchPrep(const FString& Archetype, FString& OutReason)
{
	const bool b = Archetype.Len() == 1 && Kern.SetMatchPrep(Archetype[0], OutReason);
	if (!b && OutReason.IsEmpty()) OutReason = TEXT("Unbekannter Ansatz.");
	if (b) Changed();
	return b;
}
bool UFM13GameInstance::BookDerbyPrep(const FString& Type, FString& OutReason) { const bool b = Kern.BookDerbyPrep(Type, OutReason); if (b) Changed(); return b; }

void UFM13GameInstance::Changed()
{
	OnStateChanged.Broadcast();
}

// ---------- Spielstand ----------

FString UFM13GameInstance::SlotPath(const FString& Slot)
{
	return FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("SaveGames"), Slot + TEXT(".json"));
}

bool UFM13GameInstance::HasSaveGame(const FString& Slot) const
{
	return IFileManager::Get().FileExists(*SlotPath(Slot));
}

bool UFM13GameInstance::SaveGame(const FString& Slot, FString& OutError)
{
	const FString Ziel = SlotPath(Slot);
	const FString Zwischen = Ziel + TEXT(".tmp");
	const FString Text = FM13Save::Encode(Kern);
	if (!FFileHelper::SaveStringToFile(Text, *Zwischen, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))
	{
		OutError = TEXT("Zwischendatei konnte nicht geschrieben werden.");
		return false;
	}
	// Zurücklesen und prüfen, bevor der alte Stand ersetzt wird
	FString Gelesen;
	FFM13World Probe;
	FString Fehler;
	if (!FFileHelper::LoadFileToString(Gelesen, *Zwischen) || Gelesen != Text || !FM13Save::Decode(Gelesen, Probe, Fehler))
	{
		IFileManager::Get().Delete(*Zwischen);
		OutError = TEXT("Gespeicherter Stand liess sich nicht pruefen: ") + Fehler;
		return false;
	}
	IFileManager& FM = IFileManager::Get();
	if (FM.FileExists(*Ziel)) FM.Move(*(Ziel + TEXT(".bak")), *Ziel, true);
	if (!FM.Move(*Ziel, *Zwischen, true))
	{
		OutError = TEXT("Spielstand konnte nicht ersetzt werden.");
		return false;
	}
	return true;
}

bool UFM13GameInstance::LoadGame(const FString& Slot, FString& OutError)
{
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *SlotPath(Slot)))
	{
		OutError = TEXT("Spielstand nicht gefunden.");
		return false;
	}
	if (!FM13Save::Decode(Text, Kern, OutError))
	{
		// Rückfall auf die Sicherung des vorigen Stands
		FString Alt;
		FString AltFehler;
		if (FFileHelper::LoadFileToString(Alt, *(SlotPath(Slot) + TEXT(".bak"))) && FM13Save::Decode(Alt, Kern, AltFehler))
		{
			OutError += TEXT(" Die Sicherung wurde geladen.");
			Changed();
			return true;
		}
		return false;
	}
	Changed();
	return true;
}

// ---------- Import aus dem Browserspiel ----------

TArray<FString> UFM13GameInstance::FindBrowserExports()
{
	// Neueste zuerst
	TArray<FString> Ordner;
	const FString Profil = FPlatformMisc::GetEnvironmentVariable(TEXT("USERPROFILE"));
	if (!Profil.IsEmpty()) Ordner.Add(FPaths::Combine(Profil, TEXT("Downloads")));
	const FString Home = FPlatformMisc::GetEnvironmentVariable(TEXT("HOME"));
	if (!Home.IsEmpty()) Ordner.Add(FPaths::Combine(Home, TEXT("Downloads")));
	Ordner.Add(FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Import")));

	struct FTreffer { FString Pfad; FDateTime Zeit; };
	TArray<FTreffer> Treffer;
	IFileManager& FM = IFileManager::Get();
	for (const FString& O : Ordner)
	{
		TArray<FString> Namen;
		FM.FindFiles(Namen, *FPaths::Combine(O, TEXT("anstoss-fm13-*.json")), true, false);
		for (const FString& N : Namen)
		{
			FTreffer T;
			T.Pfad = FPaths::Combine(O, N);
			T.Zeit = FM.GetTimeStamp(*T.Pfad);
			Treffer.Add(T);
		}
	}
	Treffer.Sort([](const FTreffer& A, const FTreffer& B) { return A.Zeit > B.Zeit; });
	TArray<FString> Out;
	for (const FTreffer& T : Treffer) Out.Add(T.Pfad);
	return Out;
}

bool UFM13GameInstance::ImportBrowserSave(FString& OutMessage)
{
	const TArray<FString> Dateien = FindBrowserExports();
	if (!Dateien.Num())
	{
		OutMessage = TEXT("Keine exportierte Datei gefunden. Im Browserspiel unter Spielstand \"Als Datei exportieren\" waehlen; die Datei anstoss-fm13-....json muss in Downloads liegen.");
		return false;
	}
	return ImportBrowserSaveFile(Dateien[0], OutMessage);
}

bool UFM13GameInstance::ImportBrowserSaveFile(const FString& Path, FString& OutMessage)
{
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		OutMessage = TEXT("Datei konnte nicht gelesen werden: ") + Path;
		return false;
	}
	FFM13World Neu;
	FString Fehler;
	TArray<FString> Hinweise;
	const int32 Saat = (int32)(FDateTime::Now().GetTicks() & 0x7fffffff);
	if (!FM13BrowserImport::Import(Text, Neu, Fehler, Hinweise, Saat))
	{
		OutMessage = TEXT("Import fehlgeschlagen: ") + Fehler;
		return false;
	}
	// Bisherigen Stand sichern, bevor er ersetzt wird
	FString SicherungFehler;
	SaveGame(TEXT("vor-import"), SicherungFehler);
	Kern = Neu;
	OutMessage = FString::Printf(TEXT("Uebernommen: %s, Saison %d, Spieltag %d, %s."), *Kern.ClubName, Kern.Season,
		FMath::Min(Kern.Matchday, FM13::MatchdaysPerSeason), FM13::LeagueName(Kern.LeagueLevel));
	for (const FString& H : Hinweise) Kern.AddMessage(TEXT("Import"), H);
	if (bAutosave) { FString F; SaveGame(TEXT("autosave"), F); }
	Changed();
	return true;
}
