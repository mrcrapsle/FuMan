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

	const TCHAR* SeitenNamen[] = { TEXT("Uebersicht"), TEXT("Tabelle"), TEXT("Kader"), TEXT("Transfermarkt"), TEXT("Jugend"),
		TEXT("Finanzen"), TEXT("Postfach"), TEXT("Verein"), TEXT("Spiel"), TEXT("Pokal"), TEXT("Karriere") };
	constexpr int32 SeitenAnzahl = 11;

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
	for (int32 i = 0; i < SeitenAnzahl; ++i)
	{
		const FString Name = FString::Printf(TEXT("%s  %s"), i < 9 ? *FString::FromInt(i + 1) : (i == 9 ? TEXT("0") : TEXT(" ")), SeitenNamen[i]);
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 2.f))
		[
			SNew(SBox).HeightOverride(36.f)
			[
				Knopf(Name, FOnClicked::CreateSP(this, &SFM13Menu::OnPage, i), i == Aktiv ? CKnopfAktiv : CKnopf, 13)
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
	Box->AddSlot().AutoHeight()[Ueberschrift(FM13::LeagueName(Liga))];
	const TArray<float> B = { 40.f, 300.f, 40.f, 40.f, 40.f, 40.f, 80.f, 60.f, 50.f };
	Box->AddSlot().AutoHeight()[Zeile({ TEXT("Pl."), TEXT("Verein"), TEXT("Sp"), TEXT("S"), TEXT("U"), TEXT("N"), TEXT("Tore"), TEXT("Diff"), TEXT("Pkt") }, B, CGedimmt, false, nullptr, true)];
	for (const FFM13TableRowView& R : G->GetTable(Liga))
	{
		const FLinearColor Farbe = R.bOwn ? CAkzent : ((R.Rank <= 2 && Liga > 0) ? CGut : ((R.Rank >= 17 && Liga < FM13::NumLeagues - 1) ? CSchlecht : CText));
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ FString::FromInt(R.Rank), R.Club, FString::FromInt(R.Played), FString::FromInt(R.Won), FString::FromInt(R.Drawn),
			FString::FromInt(R.Lost), FString::Printf(TEXT("%d:%d"), R.GoalsFor, R.GoalsAgainst), FString::Printf(TEXT("%+d"), R.GoalDiff), FString::FromInt(R.Points) }, B, Farbe, R.bOwn)];
	}
	return Box;
}

TSharedRef<SWidget> SFM13Menu::BuildSquad()
{
	const UFM13GameInstance* G = Game.Get();
	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	if (!G) return Box;
	const int32 Auswahl = Controller.IsValid() ? Controller->Selection : -1;
	const TArray<float> B = { 60.f, 230.f, 60.f, 50.f, 50.f, 50.f, 130.f, 100.f, 60.f };
	Box->AddSlot().AutoHeight()[Txt(TEXT("* = Startelf (beste Elf im 4-4-2, Verletzte fehlen)"), CGedimmt, 11)];
	Box->AddSlot().AutoHeight()[Zeile({ TEXT("Pos"), TEXT("Name"), TEXT("Staerke"), TEXT("Pot."), TEXT("Alter"), TEXT("Tore"), TEXT("Marktwert"), TEXT("Gehalt"), TEXT("Vertrag") }, B, CGedimmt, false, nullptr, true)];
	const TArray<FFM13PlayerView> Kader = G->GetSquad();
	for (int32 i = 0; i < Kader.Num(); ++i)
	{
		const FFM13PlayerView& P = Kader[i];
		TSharedRef<SHorizontalBox> Knoepfe = SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 4.f, 0.f))[Knopf(TEXT("Verlaengern"), FOnClicked::CreateSP(this, &SFM13Menu::OnRenew, P.Id), CKnopf, 11)]
			+ SHorizontalBox::Slot().AutoWidth()[Knopf(TEXT("Verkaufen"), FOnClicked::CreateSP(this, &SFM13Menu::OnSell, P.Id), FLinearColor(0.35f, 0.10f, 0.10f, 1.f), 11)];
		const FString Name = P.InjuredMatchdays > 0 ? FString::Printf(TEXT("%s (verletzt %d)"), *P.Name, P.InjuredMatchdays) : P.Name;
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 1.f))[Zeile({ P.Position + (P.bInStartingEleven ? TEXT(" *") : TEXT("")), Name, FString::FromInt(P.Strength),
			FString::FromInt(P.Potential), FString::FromInt(P.Age), FString::FromInt(P.GoalsSeason), Geld(P.MarketValue), Geld(P.Wage), FString::Printf(TEXT("%d J."), P.ContractYears) },
			B, P.InjuredMatchdays > 0 ? CSchlecht : (P.ContractYears <= 1 ? CAkzent : CText), i == Auswahl, Knoepfe)];
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
