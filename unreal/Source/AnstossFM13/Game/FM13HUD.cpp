#include "FM13HUD.h"
#include "FM13GameInstance.h"
#include "FM13PlayerController.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"

namespace
{
	// Farben wie das dunkle Theme des Browserspiels (css/styles.css)
	const FLinearColor Hintergrund(0.010f, 0.017f, 0.035f, 1.f);
	const FLinearColor Panel(0.033f, 0.050f, 0.085f, 1.f);
	const FLinearColor Text(0.90f, 0.93f, 0.97f, 1.f);
	const FLinearColor Gedimmt(0.55f, 0.62f, 0.75f, 1.f);
	const FLinearColor Akzent(1.f, 0.76f, 0.24f, 1.f);
	const FLinearColor Gut(0.13f, 0.88f, 0.66f, 1.f);
	const FLinearColor Schlecht(1.f, 0.38f, 0.38f, 1.f);
	const FLinearColor Auswahl(0.12f, 0.20f, 0.36f, 1.f);

	constexpr float Zeile = 26.f;
	constexpr float Rand = 40.f;
}

void AFM13HUD::Line(const FString& T, float X, const FLinearColor& Color)
{
	DrawText(T, Color, X * Scale, Y, GEngine ? GEngine->GetMediumFont() : nullptr, Scale);
	Y += Zeile * Scale;
}

void AFM13HUD::Row(const TArray<FString>& Cells, const TArray<float>& Columns, const FLinearColor& Color)
{
	UFont* Font = GEngine ? GEngine->GetMediumFont() : nullptr;
	for (int32 i = 0; i < Cells.Num() && i < Columns.Num(); ++i)
		DrawText(Cells[i], Color, Columns[i] * Scale, Y, Font, Scale);
	Y += Zeile * Scale;
}

void AFM13HUD::Bar(float X, float Width, float Fraction, const FLinearColor& Color)
{
	const float H = 10.f * Scale;
	DrawRect(Panel, X * Scale, Y, Width * Scale, H);
	DrawRect(Color, X * Scale, Y, Width * Scale * FMath::Clamp(Fraction, 0.f, 1.f), H);
	Y += 16.f * Scale;
}

void AFM13HUD::DrawHUD()
{
	Super::DrawHUD();
	if (!Canvas) return;
	const UFM13GameInstance* G = GetGameInstance<UFM13GameInstance>();
	const AFM13PlayerController* PC = Cast<AFM13PlayerController>(GetOwningPlayerController());
	// Im Menü-Modus zeichnet SFM13Menu; die Textansicht kommt nur mit F1
	if (PC && !PC->bTextMode) return;
	// Auf 1080 Zeilen ausgelegt, wächst und schrumpft mit dem Fenster
	Scale = FMath::Max(0.8f, (float)Canvas->SizeY / 1080.f * 1.3f); // größer als die Grundschrift, wächst mit dem Fenster
	DrawRect(Hintergrund, 0.f, 0.f, (float)Canvas->SizeX, (float)Canvas->SizeY);
	Y = Rand * Scale;
	if (!G || !PC) { Line(TEXT("Anstoss FM13: GameInstance fehlt (DefaultEngine.ini pruefen)."), Rand, Schlecht); return; }

	DrawHeader(*G);
	switch (PC->Page)
	{
	case EFM13Page::Tabelle: DrawTable(*G); break;
	case EFM13Page::Kader: DrawSquad(*G, PC->Selection); break;
	case EFM13Page::Transfermarkt: DrawMarket(*G, PC->Selection); break;
	case EFM13Page::Jugend: DrawYouth(*G, PC->Selection); break;
	case EFM13Page::Finanzen: DrawFinances(*G); break;
	case EFM13Page::Postfach: DrawInbox(*G); break;
	case EFM13Page::Verein: DrawClub(*G, PC->Selection); break;
	case EFM13Page::Spiel: DrawMatch(*G); break;
	case EFM13Page::Pokal: DrawCups(*G); break;
	default: DrawOverview(*G); break;
	}
	DrawFooter(*PC);
}

void AFM13HUD::DrawHeader(const UFM13GameInstance& G)
{
	const FFM13StatusView S = G.GetStatus();
	DrawRect(Panel, 0.f, 0.f, (float)Canvas->SizeX, 120.f * Scale);
	Line(FString::Printf(TEXT("%s  |  %s  |  Saison %d, Spieltag %d"), *S.ClubName, *S.LeagueName, S.Season, FMath::Min(S.Matchday, 34)), Rand, Akzent);
	Line(FString::Printf(TEXT("Konto %s   Platz %d (Ziel %d)   Vorstand %d   Fans %d   Elf %d"),
		*UFM13GameInstance::FormatMoney(S.Money), S.Rank, S.SeasonTarget, S.BoardSat, S.Fans, S.OwnStrength), Rand, S.Money < 0 ? Schlecht : Text);
	Line(TEXT("1 Uebersicht  2 Tabelle  3 Kader  4 Markt  5 Jugend  6 Finanzen  7 Postfach  8 Verein  9 Spiel  0 Pokal   F1 Menue"), Rand, Gedimmt);
	Y += 20.f * Scale;
}

void AFM13HUD::DrawOverview(const UFM13GameInstance& G)
{
	const FFM13StatusView S = G.GetStatus();
	const FFM13MatchReportView R = G.GetLastReport();
	if (S.bSacked) { Line(TEXT("Du bist entlassen. F2 startet eine neue Karriere."), Rand, Schlecht); return; }
	if (S.bSeasonFinished) Line(TEXT("Die Saison ist vorbei. Leertaste schliesst sie ab (Auf- und Abstieg, Vertraege, Jugend)."), Rand, Akzent);
	if (R.bPlayed)
	{
		Line(TEXT("Letztes Spiel"), Rand, Gedimmt);
		const FLinearColor Farbe = R.OwnGoals > R.OppGoals ? Gut : (R.OwnGoals < R.OppGoals ? Schlecht : Text);
		Line(FString::Printf(TEXT("%s %s  %d:%d"), R.bHome ? TEXT("Heim gegen") : TEXT("Auswaerts bei"), *R.Opponent, R.OwnGoals, R.OppGoals), Rand, Farbe);
		if (R.Scorers.Num()) Line(TEXT("Tore: ") + FString::Join(R.Scorers, TEXT(", ")), Rand, Text);
		if (R.bHome) Line(FString::Printf(TEXT("Zuschauer: %d"), R.Attendance), Rand, Text);
		Line(FString::Printf(TEXT("Einnahmen %s, Ausgaben %s, Vorstand %+d"), *UFM13GameInstance::FormatMoney(R.Income), *UFM13GameInstance::FormatMoney(R.Expenses), R.BoardShift), Rand, Text);
		Y += 10.f * Scale;
	}
	for (const FFM13CupView& C : G.GetCups())
	{
		if (!C.bOwnEntered) continue;
		const FString Stand = !C.Winner.IsEmpty() ? FString::Printf(TEXT("Sieger: %s"), *C.Winner)
			: (C.bOwnAlive ? FString::Printf(TEXT("noch dabei, %s am Spieltag %d"), *C.NextRound, C.NextMatchday) : FString(TEXT("ausgeschieden")));
		Line(C.Name + TEXT(": ") + Stand, Rand, C.bOwnAlive ? Gut : Gedimmt);
	}
	Line(TEXT("Naechste Spiele"), Rand, Gedimmt);
	int32 Gezeigt = 0;
	for (const FFM13FixtureView& F : G.GetOwnFixtures())
	{
		if (F.bPlayed || Gezeigt >= 5) continue;
		Line(FString::Printf(TEXT("%2d.  %s - %s"), F.Matchday, *F.Home, *F.Away), Rand, Text);
		++Gezeigt;
	}
	Y += 10.f * Scale;
	Line(TEXT("Vorstand"), Rand, Gedimmt);
	Bar(Rand, 400.f, S.BoardSat / 100.f, S.BoardSat <= 25 ? Schlecht : Gut);
	Line(FString::Printf(TEXT("Gehaelter %s von %s Budget pro Spieltag"), *UFM13GameInstance::FormatMoney(S.Wages), *UFM13GameInstance::FormatMoney(S.WageBudget)), Rand, S.Wages > S.WageBudget ? Schlecht : Text);
	if (S.bTransferEmbargo) Line(TEXT("Transfersperre: das Konto ist im Minus."), Rand, Schlecht);
}

void AFM13HUD::DrawTable(const UFM13GameInstance& G)
{
	const TArray<float> Sp = { Rand, Rand + 50.f, Rand + 520.f, Rand + 580.f, Rand + 640.f, Rand + 700.f, Rand + 760.f, Rand + 860.f, Rand + 940.f };
	Row({ TEXT("Pl."), TEXT("Verein"), TEXT("Sp"), TEXT("S"), TEXT("U"), TEXT("N"), TEXT("Tore"), TEXT("Diff"), TEXT("Pkt") }, Sp, Gedimmt);
	for (const FFM13TableRowView& R : G.GetTable())
	{
		const int32 Rk = R.Rank;
		const FLinearColor Farbe = R.bOwn ? Akzent : (Rk <= 2 ? Gut : (Rk >= 17 ? Schlecht : Text));
		Row({ FString::FromInt(Rk), R.Club, FString::FromInt(R.Played), FString::FromInt(R.Won), FString::FromInt(R.Drawn), FString::FromInt(R.Lost),
			FString::Printf(TEXT("%d:%d"), R.GoalsFor, R.GoalsAgainst), FString::Printf(TEXT("%+d"), R.GoalDiff), FString::FromInt(R.Points) }, Sp, Farbe);
	}
}

void AFM13HUD::DrawSquad(const UFM13GameInstance& G, int32 Selection)
{
	const TArray<float> Sp = { Rand, Rand + 70.f, Rand + 380.f, Rand + 460.f, Rand + 540.f, Rand + 620.f, Rand + 700.f, Rand + 880.f, Rand + 1020.f };
	Row({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Pot."), TEXT("Alter"), TEXT("Tore"), TEXT("Marktwert"), TEXT("Gehalt"), TEXT("Vertrag") }, Sp, Gedimmt);
	const TArray<FFM13PlayerView> Kader = G.GetSquad();
	for (int32 i = 0; i < Kader.Num(); ++i)
	{
		const FFM13PlayerView& P = Kader[i];
		if (i == Selection) DrawRect(Auswahl, (Rand - 8.f) * Scale, Y, (float)Canvas->SizeX - 2.f * (Rand - 8.f) * Scale, Zeile * Scale);
		Row({ P.Position + (P.bInStartingEleven ? TEXT(" *") : TEXT("")), P.InjuredMatchdays > 0 ? P.Name + FString::Printf(TEXT(" (verletzt %d)"), P.InjuredMatchdays) : P.Name, FString::FromInt(P.Strength), FString::FromInt(P.Potential), FString::FromInt(P.Age),
			FString::FromInt(P.GoalsSeason), UFM13GameInstance::FormatMoney(P.MarketValue), UFM13GameInstance::FormatMoney(P.Wage),
			FString::Printf(TEXT("%d J."), P.ContractYears) }, Sp, P.ContractYears <= 1 ? Akzent : Text);
	}
	Line(TEXT("* = Startelf.  Enter: Vertrag um 3 Jahre verlaengern   Entf: verkaufen (90 % Marktwert)"), Rand, Gedimmt);
}

void AFM13HUD::DrawMarket(const UFM13GameInstance& G, int32 Selection)
{
	const TArray<float> Sp = { Rand, Rand + 70.f, Rand + 380.f, Rand + 460.f, Rand + 540.f, Rand + 720.f };
	Row({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Alter"), TEXT("Preis"), TEXT("Gehalt") }, Sp, Gedimmt);
	const TArray<FFM13OfferView> Markt = G.GetMarket();
	for (int32 i = 0; i < Markt.Num(); ++i)
	{
		const FFM13OfferView& O = Markt[i];
		if (i == Selection) DrawRect(Auswahl, (Rand - 8.f) * Scale, Y, (float)Canvas->SizeX - 2.f * (Rand - 8.f) * Scale, Zeile * Scale);
		Row({ O.Player.Position, O.Player.Name, FString::FromInt(O.Player.Strength), FString::FromInt(O.Player.Age),
			UFM13GameInstance::FormatMoney(O.Price), UFM13GameInstance::FormatMoney(O.Player.Wage) }, Sp, Text);
	}
	if (!Markt.Num()) Line(TEXT("Der Markt ist leer. Alle vier Spieltage kommen neue Spieler."), Rand, Gedimmt);
	Line(TEXT("Enter: verpflichten (Vertrag 3 Jahre). Neue Angebote alle 4 Spieltage."), Rand, Gedimmt);
}

void AFM13HUD::DrawYouth(const UFM13GameInstance& G, int32 Selection)
{
	const TArray<float> Sp = { Rand, Rand + 70.f, Rand + 380.f, Rand + 460.f, Rand + 540.f };
	Row({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Pot."), TEXT("Alter") }, Sp, Gedimmt);
	const TArray<FFM13PlayerView> Jugend = G.GetYouth();
	for (int32 i = 0; i < Jugend.Num(); ++i)
	{
		const FFM13PlayerView& P = Jugend[i];
		if (i == Selection) DrawRect(Auswahl, (Rand - 8.f) * Scale, Y, (float)Canvas->SizeX - 2.f * (Rand - 8.f) * Scale, Zeile * Scale);
		Row({ P.Position, P.Name, FString::FromInt(P.Strength), FString::FromInt(P.Potential), FString::FromInt(P.Age) }, Sp, Text);
	}
	if (!Jugend.Num()) Line(TEXT("Noch keine Talente. Am Saisonende kommt der neue Jahrgang."), Rand, Gedimmt);
	Line(TEXT("Enter: in den Profikader holen   Entf: entlassen"), Rand, Gedimmt);
}

void AFM13HUD::DrawFinances(const UFM13GameInstance& G)
{
	const FFM13StatusView S = G.GetStatus();
	Line(FString::Printf(TEXT("Kaderwert %s   Gehaelter %s pro Spieltag   Budget %s"), *UFM13GameInstance::FormatMoney(S.SquadValue),
		*UFM13GameInstance::FormatMoney(S.Wages), *UFM13GameInstance::FormatMoney(S.WageBudget)), Rand, Text);
	Y += 8.f * Scale;
	const TArray<float> Sp = { Rand, Rand + 140.f, Rand + 640.f };
	Row({ TEXT("Spieltag"), TEXT("Buchung"), TEXT("Betrag") }, Sp, Gedimmt);
	for (const FFM13BookingView& B : G.GetBookings(26))
		Row({ FString::Printf(TEXT("S%d / %d"), B.Season, B.Matchday), B.Label, UFM13GameInstance::FormatMoney(B.Amount) }, Sp, B.Amount < 0 ? Schlecht : Gut);
}

void AFM13HUD::DrawInbox(const UFM13GameInstance& G)
{
	for (const FFM13MessageView& M : G.GetMessages(14))
	{
		Line(FString::Printf(TEXT("S%d / %d  %s"), M.Season, M.Matchday, *M.Title), Rand, Akzent);
		Line(M.Body, Rand + 20.f, Text);
	}
}

void AFM13HUD::DrawClub(const UFM13GameInstance& G, int32 Selection)
{
	const FFM13StatusView S = G.GetStatus();
	Line(FString::Printf(TEXT("Ticketpreis: %d Euro  (Links/Rechts aendern)"), S.TicketPrice), Rand, Text);
	Y += 10.f * Scale;
	const FString Zeilen[3] = {
		S.PendingSeatsMatchdays > 0
			? FString::Printf(TEXT("Stadion: %d Plaetze, Ausbau +%d laeuft noch %d Spieltage"), S.StadiumCapacity, S.PendingSeats, S.PendingSeatsMatchdays)
			: FString::Printf(TEXT("Stadion: %d Plaetze  -  Ausbau um 2.000 Plaetze fuer %s"), S.StadiumCapacity, *UFM13GameInstance::FormatMoney(2000LL * 450)),
		S.YouthAcademyLevel >= 5 ? FString(TEXT("Jugendakademie: Stufe 5 (voll ausgebaut)"))
			: FString::Printf(TEXT("Jugendakademie: Stufe %d  -  Ausbau fuer %s"), S.YouthAcademyLevel, *UFM13GameInstance::FormatMoney(S.YouthAcademyUpgradeCost)),
		S.TrainingLevel >= 5 ? FString(TEXT("Trainingsplatz: Stufe 5 (voll ausgebaut)"))
			: FString::Printf(TEXT("Trainingsplatz: Stufe %d  -  Ausbau fuer %s"), S.TrainingLevel, *UFM13GameInstance::FormatMoney(S.TrainingUpgradeCost))
	};
	for (int32 i = 0; i < 3; ++i)
	{
		if (i == Selection) DrawRect(Auswahl, (Rand - 8.f) * Scale, Y, (float)Canvas->SizeX - 2.f * (Rand - 8.f) * Scale, Zeile * Scale);
		Line(Zeilen[i], Rand, Text);
	}
	Line(TEXT("Enter: ausgewaehlten Ausbau beauftragen"), Rand, Gedimmt);
}

void AFM13HUD::DrawMatch(const UFM13GameInstance& G)
{
	// Live-Ticker der letzten Spiele (Liga und Pokal), zwei Spalten
	const FFM13MatchReportView Spiele[2] = { G.GetLastReport(), G.GetLastCupReport() };
	const float Start = Y;
	float X = Rand;
	bool bEtwas = false;
	for (const FFM13MatchReportView& R : Spiele)
	{
		if (!R.bPlayed) continue;
		bEtwas = true;
		Y = Start;
		Line(FString::Printf(TEXT("%s: %s %s"), *R.Competition, R.bHome ? TEXT("Heim gegen") : TEXT("Auswaerts bei"), *R.Opponent), X, Akzent);
		for (const FString& Z : R.Ticker) Line(Z, X, Z.Contains(TEXT("TOR fuer")) ? Gut : (Z.Contains(TEXT("Gegentor")) ? Schlecht : Text));
		for (const FString& V : R.Injuries) Line(TEXT("Verletzt: ") + V, X, Schlecht);
		X += 760.f;
	}
	if (!bEtwas) Line(TEXT("Noch kein Spiel gespielt. Leertaste startet den Spieltag."), Rand, Gedimmt);
}

void AFM13HUD::DrawCups(const UFM13GameInstance& G)
{
	for (const FFM13CupView& C : G.GetCups())
	{
		Line(C.Name, Rand, Akzent);
		if (!C.Winner.IsEmpty()) Line(FString::Printf(TEXT("Sieger: %s"), *C.Winner), Rand, Gut);
		else Line(FString::Printf(TEXT("Naechste Runde: %s am Spieltag %d, noch %d Vereine. Eigener Verein: %s"), *C.NextRound, C.NextMatchday, C.TeamsLeft,
			!C.bOwnEntered ? TEXT("nicht qualifiziert") : (C.bOwnAlive ? TEXT("dabei") : TEXT("ausgeschieden"))), Rand, Text);
		int32 n = 0;
		for (const FString& Z : C.LastRound) { if (n++ >= 8) break; Line(Z, Rand + 20.f, Gedimmt); }
		Y += 12.f * Scale;
	}
	Line(TEXT("Unterhalb der 3. Liga fuehrt der Weg in den DFB-Pokal nur ueber den Landespokal."), Rand, Gedimmt);
}

void AFM13HUD::DrawFooter(const AFM13PlayerController& PC)
{
	const float Unten = (float)Canvas->SizeY - 70.f * Scale;
	Y = Unten;
	const double Jetzt = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0;
	if (!PC.StatusLine.IsEmpty() && Jetzt < PC.StatusUntil) Line(PC.StatusLine, Rand, Akzent);
	else Y += Zeile * Scale;
	Line(TEXT("Leertaste: naechster Spieltag   F5 speichern   F9 laden   F2 neue Karriere   F8 Browser-Spielstand uebernehmen"), Rand, Gedimmt);
}
