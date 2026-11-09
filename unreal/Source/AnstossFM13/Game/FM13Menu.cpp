#include "FM13Menu.h"
#include "FM13GameInstance.h"
#include "FM13PlayerController.h"
#include "Styling/CoreStyle.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SNullWidget.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
	// Farben wie das dunkle Theme des Browserspiels
	const FLinearColor CHintergrund(0.010f, 0.017f, 0.035f, 0.94f);
	const FLinearColor CPanel(0.033f, 0.050f, 0.085f, 0.96f);
	const FLinearColor CZeile(0.045f, 0.065f, 0.105f, 1.f);
	const FLinearColor CText(0.90f, 0.93f, 0.97f, 1.f);
	const FLinearColor CGedimmt(0.55f, 0.62f, 0.75f, 1.f);
	const FLinearColor CAkzent(1.f, 0.76f, 0.24f, 1.f);
	const FLinearColor CGut(0.13f, 0.88f, 0.66f, 1.f);
	const FLinearColor CSchlecht(1.f, 0.38f, 0.38f, 1.f);
	const FLinearColor CKnopf(0.10f, 0.16f, 0.28f, 1.f);
	const FLinearColor CKnopfAktiv(0.85f, 0.62f, 0.15f, 1.f);

	// Reihenfolge in der Navigation: Seite, Name, Taste
	struct FSeite { EFM13Page Seite; const TCHAR* Name; const TCHAR* Taste; };
	const FSeite Seiten[] = {
		{ EFM13Page::Uebersicht, TEXT("Uebersicht"), TEXT("1") }, { EFM13Page::Tabelle, TEXT("Tabelle"), TEXT("2") },
		{ EFM13Page::Kader, TEXT("Kader"), TEXT("3") }, { EFM13Page::Taktik, TEXT("Taktik"), TEXT("T") },
		{ EFM13Page::Transfermarkt, TEXT("Transfermarkt"), TEXT("4") }, { EFM13Page::Jugend, TEXT("Jugend"), TEXT("5") },
		{ EFM13Page::Finanzen, TEXT("Finanzen"), TEXT("6") }, { EFM13Page::Postfach, TEXT("Postfach"), TEXT("7") },
		{ EFM13Page::Verein, TEXT("Verein"), TEXT("8") }, { EFM13Page::Spiel, TEXT("Spiel"), TEXT("9") },
		{ EFM13Page::Pokal, TEXT("Pokal"), TEXT("0") }, { EFM13Page::Karriere, TEXT("Karriere"), TEXT(" ") }
	};

	FSlateFontInfo Schrift(int32 Groesse, bool bFett = false)
	{
		return FCoreStyle::GetDefaultFontStyle(bFett ? "Bold" : "Regular", Groesse);
	}

	TSharedRef<SWidget> Txt(const FString& S, const FLinearColor& Farbe = CText, int32 Groesse = 13, bool bFett = false)
	{
		return SNew(STextBlock).Text(FText::FromString(S)).Font(Schrift(Groesse, bFett)).ColorAndOpacity(Farbe).AutoWrapText(true);
	}

	TSharedRef<SWidget> Ueberschrift(const FString& S)
	{
		return SNew(SBox).Padding(FMargin(0.f, 10.f, 0.f, 6.f))[Txt(S, CAkzent, 16, true)];
	}

	// Tabellenzeile mit festen Spaltenbreiten; Extra = Knöpfe am Ende
	TSharedRef<SWidget> Zeile(const TArray<FString>& Zellen, const TArray<float>& Breiten, const FLinearColor& Farbe,
		bool bHervorheben = false, TSharedPtr<SWidget> Extra = nullptr, bool bKopf = false)
	{
		TSharedRef<SHorizontalBox> Box = SNew(SHorizontalBox);
		for (int32 i = 0; i < Zellen.Num(); ++i)
		{
			const float B = Breiten.IsValidIndex(i) ? Breiten[i] : 80.f;
			Box->AddSlot().AutoWidth().VAlign(VAlign_Center)
			[
				SNew(SBox).WidthOverride(B).Padding(FMargin(4.f, 0.f))
				[
					SNew(STextBlock).Text(FText::FromString(Zellen[i])).Font(Schrift(bKopf ? 11 : 13, bKopf)).ColorAndOpacity(bKopf ? CGedimmt : Farbe)
				]
			];
		}
		if (Extra.IsValid()) Box->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(FMargin(6.f, 0.f))[Extra.ToSharedRef()];
		return SNew(SBorder)
			.BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush"))
			.BorderBackgroundColor(bHervorheben ? FLinearColor(0.14f, 0.22f, 0.40f, 1.f) : (bKopf ? FLinearColor(0, 0, 0, 0) : CZeile))
			.Padding(FMargin(6.f, 4.f))
			[Box];
	}

	TSharedRef<SButton> Knopf(const FString& S, FOnClicked Klick, const FLinearColor& Farbe = CKnopf, int32 Groesse = 12)
	{
		return SNew(SButton)
			.IsFocusable(false)
			.ButtonColorAndOpacity(Farbe)
			.ContentPadding(FMargin(10.f, 4.f))
			.OnClicked(Klick)
			[
				SNew(STextBlock).Text(FText::FromString(S)).Font(Schrift(Groesse, true)).ColorAndOpacity(CText)
			];
	}

	FString Geld(int64 V) { return UFM13GameInstance::FormatMoney(V); }

	// Spielvorbereitung: Ansatz des Gegners, auf den die Woche ausgerichtet wird
	const TCHAR* PrepKeys[] = { TEXT("P"), TEXT("B"), TEXT("K") };
	const TCHAR* PrepLabels[] = { TEXT("gegen Pressing"), TEXT("gegen Ballbesitz"), TEXT("gegen Konter") };
	const TCHAR* PrepNamen[] = { TEXT("Pressing"), TEXT("Ballbesitz"), TEXT("Konter") }; // so meldet GetTactics().Prep die Wahl
	// Derbywoche
	const TCHAR* DerbyKeys[] = { TEXT("stimmung"), TEXT("praemie"), TEXT("kampfansage") };
	const TCHAR* DerbyLabels[] = { TEXT("Stimmung machen"), TEXT("Derby-Praemie"), TEXT("Kampfansage") };
}

void SFM13Menu::Construct(const FArguments& InArgs)
{
	Game = InArgs._Game;
	Controller = InArgs._Controller;

	ChildSlot
	[
		SNew(SHorizontalBox)
		// Navigation
		+ SHorizontalBox::Slot().AutoWidth()
		[
			SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(CHintergrund).Padding(FMargin(10.f))
			[
				SAssignNew(NavBox, SBox).WidthOverride(190.f)
			]
		]
		// Kopf, Seite, Meldungszeile
		+ SHorizontalBox::Slot().FillWidth(0.64f)
		[
			SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(CPanel).Padding(FMargin(16.f, 12.f))
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()[SAssignNew(TopBox, SBox)]
				+ SVerticalBox::Slot().FillHeight(1.f).Padding(FMargin(0.f, 8.f))
				[
					SNew(SScrollBox) + SScrollBox::Slot()[SAssignNew(PageBox, SBox)]
				]
				+ SVerticalBox::Slot().AutoHeight()
				[
					SNew(STextBlock).Font(Schrift(13, true)).ColorAndOpacity(CAkzent).AutoWrapText(true)
					.Text_Lambda([this]()
					{
						const AFM13PlayerController* PC = Controller.Get();
						return FText::FromString(PC && PC->IsStatusVisible() ? PC->StatusLine : FString(TEXT("Leertaste oder Knopf oben: naechster Spieltag.  Zahlentasten 1-9 und 0 wechseln die Seite.")));
					})
				]
			]
		]
		// Platz für das 3D-Stadion (durchsichtig, Klicks gehen ans Spiel)
		+ SHorizontalBox::Slot().FillWidth(0.36f)[SNullWidget::NullWidget]
	];
	Refresh();
}

void SFM13Menu::Refresh()
{
	if (NavBox.IsValid()) NavBox->SetContent(BuildNav());
	if (TopBox.IsValid()) TopBox->SetContent(BuildTopBar());
	if (PageBox.IsValid()) PageBox->SetContent(BuildPage());
}

void SFM13Menu::Status(const FString& Text, float Seconds)
{
	if (AFM13PlayerController* PC = Controller.Get()) PC->ShowStatus(Text, Seconds);
}

// ---------- Rahmen ----------

TSharedRef<SWidget> SFM13Menu::BuildNav()
{
	const AFM13PlayerController* PC = Controller.Get();
	const int32 Aktiv = PC ? (int32)PC->Page : 0;
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 12.f))[Txt(TEXT("ANSTOSS FM13"), CAkzent, 16, true)];
	for (const FSeite& Seite : Seiten)
	{
		const FString Name = FString::Printf(TEXT("%s  %s"), Seite.Taste, Seite.Name);
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 2.f))
		[
			SNew(SBox).HeightOverride(34.f)
			[
				Knopf(Name, FOnClicked::CreateSP(this, &SFM13Menu::OnPage, (int32)Seite.Seite), (int32)Seite.Seite == Aktiv ? CKnopfAktiv : CKnopf, 13)
			]
		];
	}
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildTopBar()
{
	const UFM13GameInstance* G = Game.Get();
	if (!G) return Txt(TEXT("GameInstance fehlt"), CSchlecht);
	const FFM13StatusView S = G->GetStatus();
	const FString Weiter = S.bSacked ? TEXT("Entlassen") : (S.bSeasonFinished ? TEXT("Saison abschliessen") : FString::Printf(TEXT("Spieltag %d spielen"), S.Matchday));
	return SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight()[Txt(FString::Printf(TEXT("%s  |  %s  |  Saison %d"), *S.ClubName, *S.LeagueName, S.Season), CAkzent, 17, true)]
			+ SVerticalBox::Slot().AutoHeight()[Txt(FString::Printf(TEXT("Konto %s    Platz %d (Ziel %d)    Vorstand %d    Fans %d    Elf %d"),
				*Geld(S.Money), S.Rank, S.SeasonTarget, S.BoardSat, S.Fans, S.OwnStrength), S.Money < 0 ? CSchlecht : CText, 13)]
		]
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
		[
			SNew(SBox).HeightOverride(48.f)
			[
				Knopf(Weiter, FOnClicked::CreateSP(this, &SFM13Menu::OnNext), S.bSacked ? CSchlecht : CKnopfAktiv, 15)
			]
		];
}

TSharedRef<SWidget> SFM13Menu::BuildPage()
{
	const AFM13PlayerController* PC = Controller.Get();
	switch (PC ? PC->Page : EFM13Page::Uebersicht)
	{
	case EFM13Page::Tabelle: return BuildTable();
	case EFM13Page::Kader: return BuildSquad();
	case EFM13Page::Transfermarkt: return BuildMarket();
	case EFM13Page::Jugend: return BuildYouth();
	case EFM13Page::Finanzen: return BuildFinances();
	case EFM13Page::Postfach: return BuildInbox();
	case EFM13Page::Verein: return BuildClub();
	case EFM13Page::Spiel: return BuildMatch();
	case EFM13Page::Pokal: return BuildCups();
	case EFM13Page::Karriere: return BuildCareer();
	case EFM13Page::Taktik: return BuildTactics();
	default: return BuildOverview();
	}
}

// ---------- Seiten ----------

TSharedRef<SWidget> SFM13Menu::BuildOverview()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const FFM13StatusView S = G->GetStatus();
	if (S.bSacked) Box->AddSlot().AutoHeight()[Txt(TEXT("Du bist entlassen. Unter Karriere startest du neu oder uebernimmst einen Browser-Spielstand."), CSchlecht, 14, true)];
	if (S.bSeasonFinished && !S.bSacked) Box->AddSlot().AutoHeight()[Txt(TEXT("Die Saison ist vorbei. Oben auf \"Saison abschliessen\": Auf- und Abstieg, Vertraege, neue Talente."), CAkzent, 14, true)];

	for (const FFM13MatchReportView& R : { G->GetLastReport(), G->GetLastCupReport() })
	{
		if (!R.bPlayed) continue;
		const FLinearColor Farbe = R.OwnGoals > R.OppGoals ? CGut : (R.OwnGoals < R.OppGoals ? CSchlecht : CText);
		Box->AddSlot().AutoHeight()[Ueberschrift(R.Competition + TEXT(": letztes Spiel"))];
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("%s %s   %d:%d%s"), R.bHome ? TEXT("Heim gegen") : TEXT("Auswaerts bei"), *R.Opponent, R.OwnGoals, R.OppGoals,
			R.bPenalties ? TEXT(" (Elfmeterschiessen)") : TEXT("")), Farbe, 15, true)];
		if (R.Scorers.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Tore: ") + FString::Join(R.Scorers, TEXT(", ")))];
		if (R.Injuries.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Verletzt: ") + FString::Join(R.Injuries, TEXT(", ")), CSchlecht)];
		if (R.Cards.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Karten: ") + FString::Join(R.Cards, TEXT(", ")), CAkzent)];
		if (!R.Weather.IsEmpty() && R.Competition == TEXT("Liga"))
			Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Wetter %s, Schiedsrichter %s, Gegner spielte %s (Taktik-Duell %+d)"), *R.Weather, *R.Referee, *R.OppArchetype, R.TacticBonus), CGedimmt)];
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Zuschauer %d   Einnahmen %s   Ausgaben %s   Vorstand %+d"), R.Attendance, *Geld(R.Income), *Geld(R.Expenses), R.BoardShift), CGedimmt)];
	}

	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Naechste Spiele"))];
	int32 n = 0;
	for (const FFM13FixtureView& F : G->GetOwnFixtures())
	{
		if (F.bPlayed || n >= 5) continue;
		Box->AddSlot().AutoHeight()[Zeile({ FString::Printf(TEXT("%d."), F.Matchday), F.Home, TEXT("-"), F.Away }, { 50.f, 280.f, 20.f, 280.f }, CText)];
		++n;
	}
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Pokale"))];
	for (const FFM13CupView& C : G->GetCups())
	{
		const FString Stand = !C.Winner.IsEmpty() ? FString::Printf(TEXT("Sieger: %s"), *C.Winner)
			: (!C.bOwnEntered ? FString(TEXT("nicht qualifiziert")) : (C.bOwnAlive ? FString::Printf(TEXT("dabei - %s am Spieltag %d"), *C.NextRound, C.NextMatchday) : FString(TEXT("ausgeschieden"))));
		Box->AddSlot().AutoHeight()[Txt(C.Name + TEXT(": ") + Stand, C.bOwnAlive ? CGut : CGedimmt)];
	}
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Verein"))];
	Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Gehaelter %s von %s Budget pro Spieltag   Kaderwert %s   Stadion %d Plaetze"),
		*Geld(S.Wages), *Geld(S.WageBudget), *Geld(S.SquadValue), S.StadiumCapacity), S.Wages > S.WageBudget ? CSchlecht : CText)];
	if (S.bTransferEmbargo) Box->AddSlot().AutoHeight()[Txt(TEXT("Transfersperre: das Konto ist im Minus."), CSchlecht, 13, true)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildTable()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const int32 Eigene = G->GetStatus().LeagueLevel;
	const int32 Liga = TableLevel < 0 ? Eigene : TableLevel;
	TSharedRef<SHorizontalBox> Ligen = SNew(SHorizontalBox);
	for (int32 L = 0; L < FM13::NumLeagues; ++L)
		Ligen->AddSlot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))
		[
			Knopf(FString::Printf(TEXT("%d. Liga"), L + 1), FOnClicked::CreateSP(this, &SFM13Menu::OnTableLevel, L), L == Liga ? CKnopfAktiv : CKnopf, 11)
		];
	Box->AddSlot().AutoHeight()[Ligen];
	const TCHAR* Arten[] = { TEXT("Gesamt"), TEXT("Heim"), TEXT("Auswaerts") };
	TSharedRef<SHorizontalBox> Modi = SNew(SHorizontalBox);
	for (int32 M = 0; M < 3; ++M)
		Modi->AddSlot().AutoWidth().Padding(FMargin(0.f, 4.f, 4.f, 0.f))
		[
			Knopf(Arten[M], FOnClicked::CreateSP(this, &SFM13Menu::OnTableMode, M), M == TableMode ? CKnopfAktiv : CKnopf, 11)
		];
	Box->AddSlot().AutoHeight()[Modi];
	Box->AddSlot().AutoHeight()[Ueberschrift(FString(FM13::LeagueName(Liga)) + (TableMode == 1 ? TEXT(" - Heimtabelle") : (TableMode == 2 ? TEXT(" - Auswaertstabelle") : TEXT(""))))];
	const TArray<float> B = { 40.f, 300.f, 40.f, 40.f, 40.f, 40.f, 80.f, 60.f, 50.f };
	Box->AddSlot().AutoHeight()[Zeile({ TEXT("Pl."), TEXT("Verein"), TEXT("Sp"), TEXT("S"), TEXT("U"), TEXT("N"), TEXT("Tore"), TEXT("Diff"), TEXT("Pkt") }, B, CGedimmt, false, nullptr, true)];
	for (const FFM13TableRowView& R : G->GetTableSplit(Liga, TableMode))
	{
		const FLinearColor Farbe = R.bOwn ? CAkzent : ((R.Rank <= 2 && Liga > 0) ? CGut : ((R.Rank >= 17 && Liga < FM13::NumLeagues - 1) ? CSchlecht : CText));
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ FString::FromInt(R.Rank), R.Club, FString::FromInt(R.Played), FString::FromInt(R.Won), FString::FromInt(R.Drawn),
			FString::FromInt(R.Lost), FString::Printf(TEXT("%d:%d"), R.GoalsFor, R.GoalsAgainst), FString::Printf(TEXT("%+d"), R.GoalDiff), FString::FromInt(R.Points) }, B, Farbe, R.bOwn)];
	}
	const TArray<FString> Statistik = G->GetLeagueStats(Liga);
	if (Statistik.Num()) Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Statistik der Liga"))];
	for (const FString& Z : Statistik) Box->AddSlot().AutoHeight()[Txt(Z, CGedimmt, 12)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildSquad()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const int32 Auswahl = Controller.IsValid() ? Controller->Selection : -1;
	const TArray<float> B = { 60.f, 230.f, 60.f, 50.f, 50.f, 50.f, 50.f, 60.f, 60.f, 60.f, 60.f, 110.f, 130.f, 100.f, 60.f };
	Box->AddSlot().AutoHeight()[BuildOffers(false)];
	const FFM13TacticsView Taktik = G->GetTactics();
	Box->AddSlot().AutoHeight()
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)[Txt(Taktik.bManualLineup
			? FString::Printf(TEXT("* = Startelf, von Hand aufgestellt (%s). Fehlende Plaetze fuellt das Spiel auf."), *Taktik.Formation)
			: FString::Printf(TEXT("* = Startelf, automatisch (beste Elf im %s, Verletzte und Gesperrte fehlen)"), *Taktik.Formation), CGedimmt, 11)]
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(10.f, 0.f))[Knopf(TEXT("Automatisch aufstellen"), FOnClicked::CreateSP(this, &SFM13Menu::OnAutoLineup), Taktik.bManualLineup ? CKnopfAktiv : CKnopf, 11)]
	];
	Box->AddSlot().AutoHeight()[Zeile({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Pot."), TEXT("Alter"), TEXT("Tore"), TEXT("Vorl."), TEXT("Note"), TEXT("Kond."), TEXT("Form"), TEXT("Moral"), TEXT("Charakter"), TEXT("Marktwert"), TEXT("Gehalt"), TEXT("Vertrag") }, B, CGedimmt, false, nullptr, true)];
	const TArray<FFM13PlayerView> Kader = G->GetSquad();
	for (int32 i = 0; i < Kader.Num(); ++i)
	{
		const FFM13PlayerView& P = Kader[i];
		TSharedRef<SHorizontalBox> Knoepfe = SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))[SNew(SBox).WidthOverride(70.f)[Knopf(P.bInStartingEleven ? TEXT("Raus") : TEXT("Rein"),
				FOnClicked::CreateSP(this, &SFM13Menu::OnToggleLineup, P.Id), P.bInStartingEleven ? CKnopf : FLinearColor(0.08f, 0.35f, 0.20f, 1.f), 11)]]
			+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))[Knopf(TEXT("Verlaengern"), FOnClicked::CreateSP(this, &SFM13Menu::OnRenew, P.Id), CKnopf, 11)]
			+ SHorizontalBox::Slot().AutoWidth()[Knopf(TEXT("Verkaufen"), FOnClicked::CreateSP(this, &SFM13Menu::OnSell, P.Id), FLinearColor(0.35f, 0.10f, 0.10f, 1.f), 11)];
		FString Name = P.InjuredMatchdays > 0 ? FString::Printf(TEXT("%s (verletzt %d)"), *P.Name, P.InjuredMatchdays) : P.Name;
		if (P.SuspendedMatchdays > 0) Name += FString::Printf(TEXT(" (gesperrt %d)"), P.SuspendedMatchdays);
		if (P.bBenched) Name += TEXT(" (draussen)");
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ P.Position + (P.bInStartingEleven ? TEXT(" *") : TEXT("")), Name, FString::FromInt(P.Strength),
			FString::FromInt(P.Potential), FString::FromInt(P.Age), FString::FromInt(P.GoalsSeason), FString::FromInt(P.Assists),
			P.GradeAverage.IsEmpty() ? TEXT("-") : P.GradeAverage, FString::FromInt(P.Fitness), FString::FromInt(P.DailyForm), FString::FromInt(P.Morale), P.Character, Geld(P.MarketValue), Geld(P.Wage), FString::Printf(TEXT("%d J."), P.ContractYears) },
			B, (P.InjuredMatchdays > 0 || P.SuspendedMatchdays > 0) ? CSchlecht : (P.ContractYears <= 1 ? CAkzent : CText), i == Auswahl, Knoepfe)];
	}
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildMarket()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const FFM13StatusView S = G->GetStatus();
	Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Konto %s   Gehaltsbudget %s, davon frei %s pro Spieltag. Neue Angebote alle 4 Spieltage."),
		*Geld(S.Money), *Geld(S.WageBudget), *Geld(FMath::Max<int64>(0, S.WageBudget - S.Wages))), CGedimmt)];
	const TArray<float> B = { 60.f, 230.f, 60.f, 50.f, 140.f, 110.f };
	Box->AddSlot().AutoHeight()[Zeile({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Alter"), TEXT("Preis"), TEXT("Gehalt") }, B, CGedimmt, false, nullptr, true)];
	const TArray<FFM13OfferView> Markt = G->GetMarket();
	const int32 Auswahl = Controller.IsValid() ? Controller->Selection : -1;
	for (int32 i = 0; i < Markt.Num(); ++i)
	{
		const FFM13OfferView& O = Markt[i];
		const bool bLeistbar = O.Price <= S.Money && S.Wages + O.Player.Wage <= S.WageBudget && !S.bTransferEmbargo;
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ O.Player.Position, O.Player.Name, FString::FromInt(O.Player.Strength), FString::FromInt(O.Player.Age),
			Geld(O.Price), Geld(O.Player.Wage) }, B, bLeistbar ? CText : CGedimmt, i == Auswahl,
			Knopf(TEXT("Kaufen"), FOnClicked::CreateSP(this, &SFM13Menu::OnBuy, i), bLeistbar ? FLinearColor(0.08f, 0.35f, 0.20f, 1.f) : CKnopf, 11))];
	}
	if (!Markt.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Der Markt ist leer. In ein paar Spieltagen kommen neue Spieler."), CGedimmt)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildYouth()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	Box->AddSlot().AutoHeight()[BuildOffers(true)];
	Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Jugendakademie Stufe %d: am Saisonende kommen %d neue Talente."), G->GetStatus().YouthAcademyLevel, 1 + G->GetStatus().YouthAcademyLevel), CGedimmt)];
	const TArray<float> B = { 60.f, 230.f, 60.f, 60.f, 50.f };
	Box->AddSlot().AutoHeight()[Zeile({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Pot."), TEXT("Alter") }, B, CGedimmt, false, nullptr, true)];
	const TArray<FFM13PlayerView> Jugend = G->GetYouth();
	for (int32 i = 0; i < Jugend.Num(); ++i)
	{
		const FFM13PlayerView& P = Jugend[i];
		TSharedRef<SHorizontalBox> Knoepfe = SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))[Knopf(TEXT("Hochziehen"), FOnClicked::CreateSP(this, &SFM13Menu::OnPromote, i), FLinearColor(0.08f, 0.35f, 0.20f, 1.f), 11)]
			+ SHorizontalBox::Slot().AutoWidth()[Knopf(TEXT("Entlassen"), FOnClicked::CreateSP(this, &SFM13Menu::OnRelease, i), FLinearColor(0.35f, 0.10f, 0.10f, 1.f), 11)];
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ P.Position, P.Name, FString::FromInt(P.Strength), FString::FromInt(P.Potential), FString::FromInt(P.Age) }, B, CText, false, Knoepfe)];
	}
	if (!Jugend.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Noch keine Talente. Am Saisonende kommt der neue Jahrgang."), CGedimmt)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildFinances()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const FFM13StatusView S = G->GetStatus();
	Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Konto %s   Kaderwert %s   Gehaelter %s von %s pro Spieltag"), *Geld(S.Money), *Geld(S.SquadValue), *Geld(S.Wages), *Geld(S.WageBudget)), CText, 14, true)];
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Kontoauszug"))];
	const TArray<float> B = { 90.f, 360.f, 150.f };
	for (const FFM13BookingView& K : G->GetBookings(40))
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ FString::Printf(TEXT("S%d / %d"), K.Season, K.Matchday), K.Label, Geld(K.Amount) }, B, K.Amount < 0 ? CSchlecht : CGut)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildInbox()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	for (const FFM13MessageView& M : G->GetMessages(40))
	{
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 3.f))
		[
			SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(CZeile).Padding(FMargin(10.f, 6.f))
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()[Txt(FString::Printf(TEXT("Saison %d, Spieltag %d   %s"), M.Season, FMath::Min(M.Matchday, 34), *M.Title), CAkzent, 13, true)]
				+ SVerticalBox::Slot().AutoHeight()[Txt(M.Body)]
			]
		];
	}
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildClub()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const FFM13StatusView S = G->GetStatus();
	const FFM13SponsorView Sp = G->GetSponsor();
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Hauptsponsor"))];
	Box->AddSlot().AutoHeight()[Txt(Sp.MatchdaysLeft > 0
		? FString::Printf(TEXT("%s: %s pro Spieltag, %s pro Sieg, %s beim Aufstieg. Noch %d Spieltage."), *Sp.Name, *Geld(Sp.Base), *Geld(Sp.WinBonus), *Geld(Sp.PromotionBonus), Sp.MatchdaysLeft)
		: FString::Printf(TEXT("%s: nur %s pro Spieltag. Waehle ein Angebot."), *Sp.Name, *Geld(Sp.Base)), Sp.MatchdaysLeft > 0 ? CText : CSchlecht)];
	const TArray<FFM13SponsorView> Angebote = G->GetSponsorOffers();
	for (int32 i = 0; i < Angebote.Num(); ++i)
	{
		const FFM13SponsorView& A = Angebote[i];
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 2.f))[Zeile({ A.Name, FString::Printf(TEXT("%s (%d Sp.)"), *A.Tier, A.MatchdaysLeft), Geld(A.Base) + TEXT(" / Spt"),
			Geld(A.WinBonus) + TEXT(" / Sieg"), A.SignOn > 0 ? TEXT("Handgeld ") + Geld(A.SignOn) : FString(TEXT("")) }, { 200.f, 110.f, 130.f, 130.f, 160.f }, CText, false,
			Knopf(TEXT("Unterschreiben"), FOnClicked::CreateSP(this, &SFM13Menu::OnSponsor, i), FLinearColor(0.08f, 0.35f, 0.20f, 1.f), 11))];
	}
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Ticketpreis"))];
	Box->AddSlot().AutoHeight()
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth()[Knopf(TEXT("- 5"), FOnClicked::CreateSP(this, &SFM13Menu::OnTicket, -5))]
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(4.f, 0.f))[Knopf(TEXT("- 1"), FOnClicked::CreateSP(this, &SFM13Menu::OnTicket, -1))]
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(FMargin(12.f, 0.f))[Txt(FString::Printf(TEXT("%d Euro"), S.TicketPrice), CAkzent, 16, true)]
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(4.f, 0.f))[Knopf(TEXT("+ 1"), FOnClicked::CreateSP(this, &SFM13Menu::OnTicket, 1))]
		+ SHorizontalBox::Slot().AutoWidth()[Knopf(TEXT("+ 5"), FOnClicked::CreateSP(this, &SFM13Menu::OnTicket, 5))]
	];
	Box->AddSlot().AutoHeight()[Txt(TEXT("Hoehere Preise bringen mehr pro Karte, aber weniger Zuschauer."), CGedimmt, 11)];

	Box->AddSlot().AutoHeight()[Ueberschrift(FString::Printf(TEXT("Stadion: %d Plaetze"), S.StadiumCapacity))];
	if (S.PendingSeatsMatchdays > 0)
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Ausbau um %d Plaetze laeuft noch %d Spieltage."), S.PendingSeats, S.PendingSeatsMatchdays), CAkzent)];
	else
	{
		TSharedRef<SHorizontalBox> Ausbau = SNew(SHorizontalBox);
		for (int32 Plaetze : { 1000, 2000, 5000, 10000 })
			Ausbau->AddSlot().AutoWidth().Padding(FMargin(0.f, 0.f, 6.f, 0.f))
			[
				Knopf(FString::Printf(TEXT("+%d Plaetze (%s)"), Plaetze, *Geld((int64)Plaetze * 450)), FOnClicked::CreateSP(this, &SFM13Menu::OnExpand, Plaetze), CKnopf, 11)
			];
		Box->AddSlot().AutoHeight()[Ausbau];
		Box->AddSlot().AutoHeight()[Txt(TEXT("Ein Ausbau dauert 6 Spieltage."), CGedimmt, 11)];
	}

	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Jugendakademie und Trainingsplatz"))];
	Box->AddSlot().AutoHeight()
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 6.f, 0.f))
		[
			Knopf(S.YouthAcademyLevel >= 5 ? FString(TEXT("Akademie Stufe 5 (voll)")) : FString::Printf(TEXT("Akademie Stufe %d -> %d (%s)"), S.YouthAcademyLevel, S.YouthAcademyLevel + 1, *Geld(S.YouthAcademyUpgradeCost)),
				FOnClicked::CreateSP(this, &SFM13Menu::OnAcademy))
		]
		+ SHorizontalBox::Slot().AutoWidth()
		[
			Knopf(S.TrainingLevel >= 5 ? FString(TEXT("Training Stufe 5 (voll)")) : FString::Printf(TEXT("Training Stufe %d -> %d (%s)"), S.TrainingLevel, S.TrainingLevel + 1, *Geld(S.TrainingUpgradeCost)),
				FOnClicked::CreateSP(this, &SFM13Menu::OnTraining))
		]
	];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildMatch()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	bool bEtwas = false;
	for (const FFM13MatchReportView& R : { G->GetLastReport(), G->GetLastCupReport() })
	{
		if (!R.bPlayed) continue;
		bEtwas = true;
		Box->AddSlot().AutoHeight()[Ueberschrift(FString::Printf(TEXT("%s: %s %s"), *R.Competition, R.bHome ? TEXT("Heim gegen") : TEXT("Auswaerts bei"), *R.Opponent))];
		for (const FString& Z : R.Ticker)
			Box->AddSlot().AutoHeight()[Txt(Z, Z.Contains(TEXT("TOR fuer")) ? CGut : (Z.Contains(TEXT("Gegentor")) ? CSchlecht : CText))];
		for (const FString& V : R.Injuries) Box->AddSlot().AutoHeight()[Txt(TEXT("Verletzt: ") + V, CSchlecht)];
	}
	if (!bEtwas) Box->AddSlot().AutoHeight()[Txt(TEXT("Noch kein Spiel gespielt. Oben auf \"Spieltag spielen\"."), CGedimmt)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildCups()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	for (const FFM13CupView& C : G->GetCups())
	{
		Box->AddSlot().AutoHeight()[Ueberschrift(C.Name)];
		if (!C.Winner.IsEmpty()) Box->AddSlot().AutoHeight()[Txt(TEXT("Sieger: ") + C.Winner, CGut, 14, true)];
		else Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Naechste Runde: %s am Spieltag %d, noch %d Vereine. Eigener Verein: %s"), *C.NextRound, C.NextMatchday, C.TeamsLeft,
			!C.bOwnEntered ? TEXT("nicht qualifiziert") : (C.bOwnAlive ? TEXT("dabei") : TEXT("ausgeschieden"))))];
		for (const FString& Z : C.LastRound) Box->AddSlot().AutoHeight()[Txt(Z, CGedimmt, 12)];
	}
	const FFM13EuropeView E = G->GetEurope();
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Europapokal"))];
	if (!E.bActive)
		Box->AddSlot().AutoHeight()[Txt(E.bQualifiedNext ? FString(TEXT("Qualifiziert fuer die naechste Saison!"))
			: FString(TEXT("Nicht dabei. Platz 1 bis 4 der Bundesliga oder der DFB-Pokalsieg bringen dich hinein.")), E.bQualifiedNext ? CGut : CGedimmt)];
	else
	{
		Box->AddSlot().AutoHeight()[Txt(E.Winner.IsEmpty() ? TEXT("Stand: ") + E.Stage : TEXT("Sieger: ") + E.Winner, E.Winner.IsEmpty() ? CText : CGut, 14, true)];
		if (E.GroupA.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Gruppe A"), CAkzent, 13, true)];
		for (const FString& Z : E.GroupA) Box->AddSlot().AutoHeight()[Txt(Z, CText, 12)];
		if (E.GroupB.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Gruppe B"), CAkzent, 13, true)];
		for (const FString& Z : E.GroupB) Box->AddSlot().AutoHeight()[Txt(Z, CText, 12)];
		for (const FString& Z : E.KnockOut) Box->AddSlot().AutoHeight()[Txt(Z, CAkzent, 12)];
		for (const FString& Z : E.LastResults) Box->AddSlot().AutoHeight()[Txt(Z, CGedimmt, 12)];
	}
	Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 10.f))[Txt(TEXT("Unterhalb der 3. Liga fuehrt der Weg in den DFB-Pokal nur ueber den Landespokal."), CGedimmt, 11)];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildCareer()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Spielstand"))];
	Box->AddSlot().AutoHeight()
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 6.f, 0.f))[Knopf(TEXT("Speichern (F5)"), FOnClicked::CreateSP(this, &SFM13Menu::OnSave))]
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 6.f, 0.f))[Knopf(TEXT("Laden (F9)"), FOnClicked::CreateSP(this, &SFM13Menu::OnLoad))]
		+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 6.f, 0.f))[Knopf(TEXT("Browser-Spielstand uebernehmen (F8)"), FOnClicked::CreateSP(this, &SFM13Menu::OnImport), FLinearColor(0.08f, 0.35f, 0.20f, 1.f))]
		+ SHorizontalBox::Slot().AutoWidth()[Knopf(bConfirmNewGame ? TEXT("Wirklich neu anfangen?") : TEXT("Neue Karriere"), FOnClicked::CreateSP(this, &SFM13Menu::OnNewGame), bConfirmNewGame ? CSchlecht : CKnopf)]
	];
	Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 4.f))[Txt(TEXT("Browser-Spielstand: im Browserspiel \"Spielstand als Datei exportieren\", die Datei landet in Downloads. Dann hier uebernehmen."), CGedimmt, 11)];

	const FFM13RecordsView Rek = G->GetRecords();
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Vereinsrekorde"))];
	Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Hoechster Sieg: %s\nSerie ohne Niederlage: %d (Rekord %d)\nZuschauerrekord: %d\nRekordverkauf: %s"),
		*Rek.BiggestWin, Rek.UnbeatenStreak, Rek.LongestUnbeatenStreak, Rek.RecordAttendance, *Geld(Rek.RecordTransferFee)))];
	if (!Rek.LastRelegation.IsEmpty()) Box->AddSlot().AutoHeight()[Txt(TEXT("Letzte Relegation: ") + Rek.LastRelegation, CAkzent)];

	const TArray<FFM13AchievementView> Erfolge = G->GetAchievements();
	int32 Frei = 0;
	for (const FFM13AchievementView& E : Erfolge) if (E.bUnlocked) ++Frei;
	Box->AddSlot().AutoHeight()[Ueberschrift(FString::Printf(TEXT("Erfolge (%d von %d)"), Frei, Erfolge.Num()))];
	for (const FFM13AchievementView& E : Erfolge)
		Box->AddSlot().AutoHeight()[Txt(E.bUnlocked ? FString::Printf(TEXT("[x] %s (Saison %d)"), *E.Label, E.Season) : FString(TEXT("[ ] ")) + E.Label, E.bUnlocked ? CGut : CGedimmt, 12)];

	const TArray<FString> Auszeichnungen = G->GetAwards();
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Auszeichnungen"))];
	if (!Auszeichnungen.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Am Saisonende kuert die Liga Torschuetzenkoenig, Spieler und Talent der Saison."), CGedimmt, 12)];
	for (const FString& Z : Auszeichnungen) Box->AddSlot().AutoHeight()[Txt(Z, CAkzent, 12)];

	const TArray<FFM13LegendView> Legenden = G->GetLegends();
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Vereinslegenden"))];
	if (!Legenden.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Noch keine. Wer 5 Saisons bleibt oder 50 Tore schiesst, wird beim Karriereende Legende."), CGedimmt, 12)];
	for (const FFM13LegendView& L : Legenden)
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("%s (%s): %d Saisons, %d Tore, Abschied Saison %d"), *L.Name, *L.Position, L.Seasons, L.Goals, L.RetiredSeason), CAkzent, 12)];

	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Laufbahn"))];
	const TArray<FFM13SeasonRecordView> Laufbahn = G->GetHistory();
	if (!Laufbahn.Num()) Box->AddSlot().AutoHeight()[Txt(TEXT("Noch keine abgeschlossene Saison."), CGedimmt)];
	const TArray<float> B = { 80.f, 220.f, 60.f, 60.f, 140.f };
	if (Laufbahn.Num()) Box->AddSlot().AutoHeight()[Zeile({ TEXT("Saison"), TEXT("Liga"), TEXT("Platz"), TEXT("Punkte"), TEXT("Ausgang") }, B, CGedimmt, false, nullptr, true)];
	for (const FFM13SeasonRecordView& R : Laufbahn)
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ FString::FromInt(R.Season), R.LeagueName, FString::FromInt(R.Rank), FString::FromInt(R.Points), R.Outcome }, B,
			R.Outcome == TEXT("Aufstieg") ? CGut : (R.Outcome == TEXT("Abstieg") ? CSchlecht : CText))];
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildOffers(bool bYouth)
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const TArray<FFM13IncomingOfferView> Angebote = G->GetIncomingOffers();
	bool bTitel = false;
	for (int32 i = 0; i < Angebote.Num(); ++i)
	{
		const FFM13IncomingOfferView& O = Angebote[i];
		if (O.bYouth != bYouth) continue;
		if (!bTitel) { Box->AddSlot().AutoHeight()[Ueberschrift(bYouth ? TEXT("Angebote fuer Talente") : TEXT("Angebote fuer deine Spieler"))]; bTitel = true; }
		TSharedRef<SHorizontalBox> Knoepfe = SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))[Knopf(TEXT("Annehmen"), FOnClicked::CreateSP(this, &SFM13Menu::OnAcceptOffer, i), FLinearColor(0.08f, 0.35f, 0.20f, 1.f), 11)]
			+ SHorizontalBox::Slot().AutoWidth()[Knopf(TEXT("Ablehnen"), FOnClicked::CreateSP(this, &SFM13Menu::OnDeclineOffer, i), CKnopf, 11)];
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ O.PlayerName, O.Club, Geld(O.Price), FString::Printf(TEXT("bis Spt. %d"), O.ExpiresMatchday) },
			{ 200.f, 220.f, 130.f, 90.f }, CAkzent, false, Knoepfe)];
	}
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildTactics()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const FFM13TacticsView T = G->GetTactics();
	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Naechstes Ligaspiel"))];
	if (T.NextOpponent.IsEmpty()) Box->AddSlot().AutoHeight()[Txt(TEXT("Kein Ligaspiel mehr in dieser Saison."), CGedimmt)];
	else
	{
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("%s %s (Staerke %d), Schiedsrichter %s"), T.bNextHome ? TEXT("Heim gegen") : TEXT("Auswaerts bei"), *T.NextOpponent, T.NextOpponentStrength, *T.Referee), CText, 14, true)];
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Chef-Analyst: Der Gegner plant %s%s. Dein Stil: Taktik-Duell %+d."), *T.OppPlan,
			T.bOppReacted ? TEXT(" - er hat sich auf dich eingestellt") : TEXT(""), T.MatchupBonus), T.MatchupBonus > 0 ? CGut : (T.MatchupBonus < 0 ? CSchlecht : CGedimmt))];
	}
	Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Spielstaerke %d = Elf %d %+d Spielstil %+.1f Formation %+d Duell. Kraftkosten %+d Prozent (Verletzungsrisiko)."),
		T.MatchStrength, T.ElfStrength, T.StyleBonus, T.FormationBonus, T.MatchupBonus, T.FitnessCostPercent), CAkzent)];
	if (!T.Predictable.IsEmpty())
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Achtung: Du spielst berechenbar (%s). Gegner stellen sich darauf ein."), *T.Predictable), CSchlecht, 12)];
	if (!T.NextOpponent.IsEmpty())
	{
		Box->AddSlot().AutoHeight()[Txt(FString::Printf(TEXT("Prognose: Sieg %d   Remis %d   Niederlage %d (Prozent). Moral der Elf %+.1f."),
			T.ForecastWin, T.ForecastDraw, T.ForecastLoss, T.MoraleBonus), CText, 13, true)];

		Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Kabinenansprache"))];
		TSharedRef<SHorizontalBox> Ansprachen = SNew(SHorizontalBox);
		for (int32 i = 0; i < T.TalkKeys.Num(); ++i)
			Ansprachen->AddSlot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))
			[
				Knopf(FString::Printf(TEXT("%s (%+.1f)"), T.TalkLabels.IsValidIndex(i) ? *T.TalkLabels[i] : *T.TalkKeys[i], T.TalkBonuses.IsValidIndex(i) ? T.TalkBonuses[i] : 0.f),
					FOnClicked::CreateSP(this, &SFM13Menu::OnTalk, i), T.TalkKeys[i] == T.PendingTalk ? CKnopfAktiv : CKnopf, 12)
			];
		Box->AddSlot().AutoHeight()[Ansprachen];
		Box->AddSlot().AutoHeight()[Txt(T.PendingTalk.IsEmpty() ? FString(TEXT("Noch keine Ansprache fuer dieses Spiel. Dieselbe Ansprache nutzt sich ab."))
			: FString(TEXT("Gewaehlt fuer das naechste Spiel.")), CGedimmt, 11)];

		Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Spielvorbereitung"))];
		TSharedRef<SHorizontalBox> Vorbereitung = SNew(SHorizontalBox);
		for (int32 i = 0; i < 3; ++i)
			Vorbereitung->AddSlot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))
			[
				Knopf(PrepLabels[i], FOnClicked::CreateSP(this, &SFM13Menu::OnPrep, i), T.Prep == PrepNamen[i] ? CKnopfAktiv : CKnopf, 12)
			];
		Box->AddSlot().AutoHeight()[Vorbereitung];
		Box->AddSlot().AutoHeight()[Txt(TEXT("Triffst du den Ansatz des Gegners, gibt es +2,5 Staerke. Der Chef-Analyst oben nennt nur den Grundstil."), CGedimmt, 11)];

		if (!T.Rival.IsEmpty())
		{
			Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Derby gegen ") + T.Rival)];
			Box->AddSlot().AutoHeight()[Txt(T.MatchdaysToDerby < 0 ? FString(TEXT("In dieser Saison kein Derby mehr."))
				: (T.MatchdaysToDerby == 0 ? FString(TEXT("Das naechste Spiel ist das Derby!")) : FString::Printf(TEXT("Derby in %d Spieltagen."), T.MatchdaysToDerby)),
				T.MatchdaysToDerby == 0 ? CAkzent : CText)];
			if (T.MatchdaysToDerby >= 0 && T.MatchdaysToDerby <= 3)
			{
				TSharedRef<SHorizontalBox> Derby = SNew(SHorizontalBox);
				for (int32 i = 0; i < 3; ++i)
				{
					const bool bGebucht = T.DerbyPreps.Contains(DerbyKeys[i]);
					const FString Name = i == 0 ? FString::Printf(TEXT("%s (%s)"), DerbyLabels[i], *Geld(T.DerbyStimmungCost)) : FString(DerbyLabels[i]);
					Derby->AddSlot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))
					[
						Knopf(bGebucht ? Name + TEXT(" - gebucht") : Name, FOnClicked::CreateSP(this, &SFM13Menu::OnDerbyPrep, i), bGebucht ? CKnopfAktiv : CKnopf, 12)
					];
				}
				Box->AddSlot().AutoHeight()[Derby];
				Box->AddSlot().AutoHeight()[Txt(TEXT("Stimmung +1,5 Staerke, Praemie +5 Moral fuer die Elf, Kampfansage +1 (verlorenes Derby kostet dann mehr)."), CGedimmt, 11)];
			}
		}
	}

	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Formation"))];
	TSharedRef<SHorizontalBox> Formationen = SNew(SHorizontalBox);
	for (int32 i = 0; i < T.Formations.Num(); ++i)
		Formationen->AddSlot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))
		[
			Knopf(T.Formations[i], FOnClicked::CreateSP(this, &SFM13Menu::OnFormation, i), T.Formations[i] == T.Formation ? CKnopfAktiv : CKnopf, 12)
		];
	Box->AddSlot().AutoHeight()[Formationen];

	Box->AddSlot().AutoHeight()[Ueberschrift(TEXT("Spielstil"))];
	for (int32 i = 0; i < T.StyleKeys.Num(); ++i)
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth()[SNew(SBox).WidthOverride(170.f)[Knopf(T.StyleLabels[i], FOnClicked::CreateSP(this, &SFM13Menu::OnStyle, i), T.StyleKeys[i] == T.Style ? CKnopfAktiv : CKnopf, 12)]]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(FMargin(10.f, 0.f))[Txt(FString::Printf(TEXT("Staerke %+d, Ansatz %s"), T.StyleBonuses[i], *T.StyleArchetypes[i]), CGedimmt, 12)]
		];
	Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 8.f))[Txt(TEXT("Pressing schlaegt Ballbesitz, Ballbesitz knackt Konter, Konter bestraft Pressing (je +2). Wer drei von fuenf Spielen gleich spielt, wird gelesen."), CGedimmt, 11)];
	return Box;
}

// ---------- Aktionen ----------

FReply SFM13Menu::OnPage(int32 PageIndex)
{
	if (AFM13PlayerController* PC = Controller.Get()) PC->SetPage((EFM13Page)PageIndex);
	bConfirmNewGame = false;
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnNext()
{
	if (AFM13PlayerController* PC = Controller.Get()) PC->AdvanceGame();
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnBuy(int32 MarketIndex)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->BuyPlayer(MarketIndex, Grund) ? TEXT("Spieler verpflichtet (Vertrag 3 Jahre).") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnSell(int32 PlayerId)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->SellPlayer(PlayerId, Grund) ? TEXT("Spieler verkauft (90 % vom Marktwert).") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnRenew(int32 PlayerId)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->RenewContract(PlayerId, 3, Grund) ? TEXT("Vertrag um drei Jahre verlaengert.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnPromote(int32 YouthIndex)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->PromoteYouth(YouthIndex, Grund) ? TEXT("Talent in den Profikader geholt.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnRelease(int32 YouthIndex)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->ReleaseYouth(YouthIndex, Grund) ? TEXT("Talent entlassen.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnTicket(int32 Delta)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; if (!G->SetTicketPrice(G->GetStatus().TicketPrice + Delta, Grund)) Status(Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnExpand(int32 Seats)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->ExpandStadium(Seats, Grund) ? TEXT("Stadionausbau beauftragt, fertig in 6 Spieltagen.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnAcademy()
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->UpgradeYouthAcademy(Grund) ? TEXT("Jugendakademie ausgebaut.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnTraining()
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->UpgradeTraining(Grund) ? TEXT("Trainingsplatz ausgebaut.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnTableLevel(int32 Level)
{
	TableLevel = Level;
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnSave()
{
	if (UFM13GameInstance* G = Game.Get()) { FString Fehler; Status(G->SaveGame(TEXT("spielstand1"), Fehler) ? TEXT("Gespeichert in Spielstand 1.") : Fehler); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnLoad()
{
	if (UFM13GameInstance* G = Game.Get()) { FString Fehler; Status(G->LoadGame(TEXT("spielstand1"), Fehler) ? TEXT("Spielstand 1 geladen.") : Fehler); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnImport()
{
	if (UFM13GameInstance* G = Game.Get()) { FString Meldung; G->ImportBrowserSave(Meldung); Status(Meldung, 10.f); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnFormation(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get())
	{
		const TArray<FString> F = G->GetTactics().Formations;
		FString Grund;
		if (F.IsValidIndex(Index) && !G->SetFormation(F[Index], Grund)) Status(Grund);
	}
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnStyle(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get())
	{
		const TArray<FString> K = G->GetTactics().StyleKeys;
		FString Grund;
		if (K.IsValidIndex(Index) && !G->SetTacticStyle(K[Index], Grund)) Status(Grund);
	}
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnSponsor(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->AcceptSponsorOffer(Index, Grund) ? TEXT("Neuer Hauptsponsor unterschrieben.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnAcceptOffer(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->AcceptIncomingOffer(Index, Grund) ? TEXT("Verkauft.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnDeclineOffer(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; Status(G->DeclineIncomingOffer(Index, Grund) ? TEXT("Angebot abgelehnt.") : Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnNewGame()
{
	if (!bConfirmNewGame)
	{
		bConfirmNewGame = true;
		Status(TEXT("Noch einmal klicken, um eine neue Karriere in der 6. Liga zu starten. Der jetzige Stand wird ersetzt."));
	}
	else if (UFM13GameInstance* G = Game.Get())
	{
		bConfirmNewGame = false;
		G->NewGame(TEXT("1.FC Moritz Leipzig"));
		Status(TEXT("Neue Karriere in der 6. Liga gestartet."));
	}
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnToggleLineup(int32 PlayerId)
{
	if (UFM13GameInstance* G = Game.Get()) { FString Grund; if (!G->ToggleLineupPlayer(PlayerId, Grund)) Status(Grund); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnAutoLineup()
{
	if (UFM13GameInstance* G = Game.Get()) { G->AutoLineup(); Status(TEXT("Die beste Elf steht wieder automatisch auf dem Platz.")); }
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnTalk(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get())
	{
		const FFM13TacticsView T = G->GetTactics();
		FString Grund;
		if (!T.TalkKeys.IsValidIndex(Index)) Status(TEXT("Unbekannte Ansprache."));
		else Status(G->ChooseTalk(T.TalkKeys[Index], Grund) ? TEXT("Ansprache fuer das naechste Spiel gewaehlt.") : Grund);
	}
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnPrep(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get())
	{
		FString Grund;
		if (Index < 0 || Index > 2) Status(TEXT("Unbekannter Ansatz."));
		else Status(G->SetMatchPrep(PrepKeys[Index], Grund) ? FString::Printf(TEXT("Training ausgerichtet: %s."), PrepLabels[Index]) : Grund);
	}
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnDerbyPrep(int32 Index)
{
	if (UFM13GameInstance* G = Game.Get())
	{
		FString Grund;
		if (Index < 0 || Index > 2) Status(TEXT("Unbekannte Vorbereitung."));
		else Status(G->BookDerbyPrep(DerbyKeys[Index], Grund) ? FString::Printf(TEXT("%s gebucht."), DerbyLabels[Index]) : Grund);
	}
	Refresh();
	return FReply::Handled();
}

FReply SFM13Menu::OnTableMode(int32 Mode)
{
	TableMode = FMath::Clamp(Mode, 0, 2);
	Refresh();
	return FReply::Handled();
}
