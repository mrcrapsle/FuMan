#include "FM13GameInstance.h"
#include "FM13Core/FM13SaveCodec.h"
#include "FM13Core/FM13BrowserImport.h"
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
	for (const FFM13Player& P : Kern.Squad) Out.Add(MakePlayerView(P, Elf.Contains(P.Id)));
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
