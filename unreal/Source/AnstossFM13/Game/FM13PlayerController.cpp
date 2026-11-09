#include "FM13PlayerController.h"
#include "FM13GameInstance.h"
#include "Components/InputComponent.h"
#include "Engine/World.h"
#include "InputCoreTypes.h"
#if !defined(FM13_NO_SLATE)
#include "FM13Menu.h"
#include "Engine/GameViewportClient.h"
#include "Widgets/SWeakWidget.h"
#endif

AFM13PlayerController::AFM13PlayerController()
{
	bShowMouseCursor = true;
}

UFM13GameInstance* AFM13PlayerController::Game() const
{
	return GetGameInstance<UFM13GameInstance>();
}

void AFM13PlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	check(InputComponent);
	InputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &AFM13PlayerController::OnWeiter);
	InputComponent->BindKey(EKeys::Up, IE_Pressed, this, &AFM13PlayerController::OnHoch);
	InputComponent->BindKey(EKeys::Down, IE_Pressed, this, &AFM13PlayerController::OnRunter);
	InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AFM13PlayerController::OnAktion);
	InputComponent->BindKey(EKeys::Delete, IE_Pressed, this, &AFM13PlayerController::OnEntfernen);
	InputComponent->BindKey(EKeys::Right, IE_Pressed, this, &AFM13PlayerController::OnPreisPlus);
	InputComponent->BindKey(EKeys::Left, IE_Pressed, this, &AFM13PlayerController::OnPreisMinus);
	InputComponent->BindKey(EKeys::F5, IE_Pressed, this, &AFM13PlayerController::OnSpeichern);
	InputComponent->BindKey(EKeys::F9, IE_Pressed, this, &AFM13PlayerController::OnLaden);
	InputComponent->BindKey(EKeys::F2, IE_Pressed, this, &AFM13PlayerController::OnNeu);
	InputComponent->BindKey(EKeys::F8, IE_Pressed, this, &AFM13PlayerController::OnImport);
	InputComponent->BindKey(EKeys::F1, IE_Pressed, this, &AFM13PlayerController::OnToggleText);
	InputComponent->BindKey(EKeys::One, IE_Pressed, this, &AFM13PlayerController::OnSeite1);
	InputComponent->BindKey(EKeys::Two, IE_Pressed, this, &AFM13PlayerController::OnSeite2);
	InputComponent->BindKey(EKeys::Three, IE_Pressed, this, &AFM13PlayerController::OnSeite3);
	InputComponent->BindKey(EKeys::Four, IE_Pressed, this, &AFM13PlayerController::OnSeite4);
	InputComponent->BindKey(EKeys::Five, IE_Pressed, this, &AFM13PlayerController::OnSeite5);
	InputComponent->BindKey(EKeys::Six, IE_Pressed, this, &AFM13PlayerController::OnSeite6);
	InputComponent->BindKey(EKeys::Seven, IE_Pressed, this, &AFM13PlayerController::OnSeite7);
	InputComponent->BindKey(EKeys::Eight, IE_Pressed, this, &AFM13PlayerController::OnSeite8);
	InputComponent->BindKey(EKeys::Nine, IE_Pressed, this, &AFM13PlayerController::OnSeite9);
	InputComponent->BindKey(EKeys::Zero, IE_Pressed, this, &AFM13PlayerController::OnSeite0);
	InputComponent->BindKey(EKeys::T, IE_Pressed, this, &AFM13PlayerController::OnSeiteTaktik);
}

void AFM13PlayerController::ShowStatus(const FString& Text, float Seconds)
{
	StatusLine = Text;
	StatusUntil = (GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0) + Seconds;
}

void AFM13PlayerController::SetPage(EFM13Page NewPage)
{
	Page = NewPage;
	Selection = 0;
	RefreshMenu();
}

bool AFM13PlayerController::IsStatusVisible() const
{
	return !StatusLine.IsEmpty() && (GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0) < StatusUntil;
}

void AFM13PlayerController::BeginPlay()
{
	Super::BeginPlay();
	if (UFM13GameInstance* G = Game()) G->OnStateChanged.AddDynamic(this, &AFM13PlayerController::HandleStateChanged);
#if !defined(FM13_NO_SLATE)
	if (!IsLocalController()) return;
	UWorld* W = GetWorld();
	UGameViewportClient* Viewport = W ? W->GetGameViewport() : nullptr;
	if (!Viewport) return;
	Menu = SNew(SFM13Menu).Game(Game()).Controller(this);
	MenuHost = SNew(SWeakWidget).PossiblyNullContent(Menu);
	Viewport->AddViewportWidgetContent(MenuHost.ToSharedRef(), 10);
	// Maus fürs Menü, Tasten weiter fürs Spiel
	FInputModeGameAndUI Modus;
	Modus.SetHideCursorDuringCapture(false);
	Modus.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
	SetInputMode(Modus);
#endif
}

void AFM13PlayerController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UFM13GameInstance* G = Game()) G->OnStateChanged.RemoveDynamic(this, &AFM13PlayerController::HandleStateChanged);
#if !defined(FM13_NO_SLATE)
	UWorld* W = GetWorld();
	if (UGameViewportClient* Viewport = W ? W->GetGameViewport() : nullptr)
		if (MenuHost.IsValid()) Viewport->RemoveViewportWidgetContent(MenuHost.ToSharedRef());
#endif
	MenuHost.Reset();
	Menu.Reset();
	Super::EndPlay(EndPlayReason);
}

void AFM13PlayerController::HandleStateChanged()
{
	RefreshMenu();
}

void AFM13PlayerController::RefreshMenu()
{
#if !defined(FM13_NO_SLATE)
	if (Menu.IsValid()) Menu->Refresh();
#endif
}

void AFM13PlayerController::OnToggleText()
{
	bTextMode = !bTextMode;
#if !defined(FM13_NO_SLATE)
	if (MenuHost.IsValid()) MenuHost->SetVisibility(bTextMode ? EVisibility::Collapsed : EVisibility::SelfHitTestInvisible);
#endif
	ShowStatus(bTextMode ? TEXT("Textansicht (F1 zurueck zum Menue).") : TEXT("Menue (F1 fuer die Textansicht)."));
}

int32 AFM13PlayerController::SelectionCount() const
{
	const UFM13GameInstance* G = Game();
	if (!G) return 0;
	switch (Page)
	{
	case EFM13Page::Kader: return G->GetSquad().Num();
	case EFM13Page::Transfermarkt: return G->GetMarket().Num();
	case EFM13Page::Jugend: return G->GetYouth().Num();
	case EFM13Page::Verein: return 3; // Stadion, Akademie, Training
	default: return 0;
	}
}

void AFM13PlayerController::OnHoch()
{
	const int32 N = SelectionCount();
	if (N > 0) Selection = (Selection - 1 + N) % N;
	RefreshMenu();
}

void AFM13PlayerController::OnRunter()
{
	const int32 N = SelectionCount();
	if (N > 0) Selection = (Selection + 1) % N;
	RefreshMenu();
}

void AFM13PlayerController::OnWeiter()
{
	AdvanceGame();
}

void AFM13PlayerController::AdvanceGame()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	FString Text;
	if (G->GetStatus().bSeasonFinished && !G->GetStatus().bSacked)
	{
		G->ConcludeSeason(Text);
		ShowStatus(Text, 8.f);
		SetPage(EFM13Page::Uebersicht);
		return;
	}
	if (G->PlayMatchday(Text))
	{
		const FFM13MatchReportView R = G->GetLastReport();
		FString Meldung = FString::Printf(TEXT("%s %d:%d gegen %s"), R.OwnGoals > R.OppGoals ? TEXT("Sieg") : (R.OwnGoals == R.OppGoals ? TEXT("Remis") : TEXT("Niederlage")), R.OwnGoals, R.OppGoals, *R.Opponent);
		const FFM13MatchReportView P = G->GetLastCupReport();
		if (P.bPlayed) Meldung += FString::Printf(TEXT("   |   %s: %d:%d gegen %s, %s"), *P.Competition, P.OwnGoals, P.OppGoals, *P.Opponent, P.bAdvanced ? TEXT("weiter") : TEXT("ausgeschieden"));
		ShowStatus(Meldung, 6.f);
	}
	else ShowStatus(Text);
}

void AFM13PlayerController::OnAktion()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	FString Grund;
	bool bOk = false;
	switch (Page)
	{
	case EFM13Page::Transfermarkt:
		bOk = G->BuyPlayer(Selection, Grund);
		ShowStatus(bOk ? TEXT("Spieler verpflichtet.") : Grund);
		Selection = FMath::Clamp(Selection, 0, FMath::Max(0, SelectionCount() - 1));
		return;
	case EFM13Page::Kader:
	{
		const TArray<FFM13PlayerView> Kader = G->GetSquad();
		if (!Kader.IsValidIndex(Selection)) { ShowStatus(TEXT("Kein Spieler ausgewaehlt.")); return; }
		bOk = G->RenewContract(Kader[Selection].Id, 3, Grund);
		ShowStatus(bOk ? FString::Printf(TEXT("Vertrag von %s um drei Jahre verlaengert."), *Kader[Selection].Name) : Grund);
		return;
	}
	case EFM13Page::Jugend:
		bOk = G->PromoteYouth(Selection, Grund);
		ShowStatus(bOk ? TEXT("Talent in den Profikader geholt.") : Grund);
		Selection = FMath::Clamp(Selection, 0, FMath::Max(0, SelectionCount() - 1));
		return;
	case EFM13Page::Verein:
		if (Selection == 0) bOk = G->ExpandStadium(2000, Grund);
		else if (Selection == 1) bOk = G->UpgradeYouthAcademy(Grund);
		else bOk = G->UpgradeTraining(Grund);
		ShowStatus(bOk ? TEXT("Ausbau beauftragt.") : Grund);
		return;
	default:
		ShowStatus(TEXT("Auf dieser Seite gibt es keine Aktion. Leertaste spielt den naechsten Spieltag."));
		return;
	}
}

void AFM13PlayerController::OnEntfernen()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	FString Grund;
	if (Page == EFM13Page::Kader)
	{
		const TArray<FFM13PlayerView> Kader = G->GetSquad();
		if (!Kader.IsValidIndex(Selection)) { ShowStatus(TEXT("Kein Spieler ausgewaehlt.")); return; }
		const FString Name = Kader[Selection].Name;
		const bool bOk = G->SellPlayer(Kader[Selection].Id, Grund);
		ShowStatus(bOk ? FString::Printf(TEXT("%s verkauft."), *Name) : Grund);
		Selection = FMath::Clamp(Selection, 0, FMath::Max(0, SelectionCount() - 1));
	}
	else if (Page == EFM13Page::Jugend)
	{
		const bool bOk = G->ReleaseYouth(Selection, Grund);
		ShowStatus(bOk ? TEXT("Talent entlassen.") : Grund);
		Selection = FMath::Clamp(Selection, 0, FMath::Max(0, SelectionCount() - 1));
	}
	else ShowStatus(TEXT("Abgeben geht im Kader (3) und in der Jugend (5)."));
}

void AFM13PlayerController::OnPreisPlus()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	if (Page != EFM13Page::Verein) { ShowStatus(TEXT("Ticketpreise stellst du auf der Seite Verein (8) ein.")); return; }
	FString Grund;
	if (!G->SetTicketPrice(G->GetStatus().TicketPrice + 1, Grund)) ShowStatus(Grund);
}

void AFM13PlayerController::OnPreisMinus()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	if (Page != EFM13Page::Verein) { ShowStatus(TEXT("Ticketpreise stellst du auf der Seite Verein (8) ein.")); return; }
	FString Grund;
	if (!G->SetTicketPrice(G->GetStatus().TicketPrice - 1, Grund)) ShowStatus(Grund);
}

void AFM13PlayerController::OnSpeichern()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	FString Fehler;
	ShowStatus(G->SaveGame(TEXT("spielstand1"), Fehler) ? TEXT("Gespeichert in Spielstand 1.") : Fehler);
}

void AFM13PlayerController::OnLaden()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	FString Fehler;
	ShowStatus(G->LoadGame(TEXT("spielstand1"), Fehler) ? TEXT("Spielstand 1 geladen.") : Fehler);
	SetPage(EFM13Page::Uebersicht);
}

void AFM13PlayerController::OnNeu()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	G->NewGame(TEXT("1.FC Moritz Leipzig"));
	SetPage(EFM13Page::Uebersicht);
	ShowStatus(TEXT("Neue Karriere in der 6. Liga gestartet."));
}

void AFM13PlayerController::OnImport()
{
	UFM13GameInstance* G = Game();
	if (!G) return;
	FString Meldung;
	G->ImportBrowserSave(Meldung);
	ShowStatus(Meldung, 10.f);
	SetPage(EFM13Page::Uebersicht);
}
