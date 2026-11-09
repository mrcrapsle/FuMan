#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"

class UFM13GameInstance;
class AFM13PlayerController;
class SBox;

// Menü-Oberfläche in Slate (reiner C++-Code, keine Editor-Assets):
// links die Navigation, oben die Kennzahlen mit dem Knopf „Nächster Spieltag“, in der Mitte die Seite,
// unten die Meldungszeile. Rechts bleibt das 3D-Stadion sichtbar.
// Die Seite selbst steht im PlayerController (auch die Zahlentasten wechseln sie).
class SFM13Menu : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SFM13Menu) {}
		SLATE_ARGUMENT(TWeakObjectPtr<UFM13GameInstance>, Game)
		SLATE_ARGUMENT(TWeakObjectPtr<AFM13PlayerController>, Controller)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	// Neu zeichnen nach jeder Änderung am Spielstand oder Seitenwechsel
	void Refresh();

private:
	TWeakObjectPtr<UFM13GameInstance> Game;
	TWeakObjectPtr<AFM13PlayerController> Controller;
	TSharedPtr<SBox> TopBox;
	TSharedPtr<SBox> PageBox;
	TSharedPtr<SBox> NavBox;
	int32 TableLevel = -1;        // Tabelle: angezeigte Liga (-1 = eigene)
	bool bConfirmNewGame = false; // „Neue Karriere“ braucht einen zweiten Klick

	TSharedRef<SWidget> BuildNav();
	TSharedRef<SWidget> BuildTopBar();
	TSharedRef<SWidget> BuildPage();
	TSharedRef<SWidget> BuildOverview();
	TSharedRef<SWidget> BuildTable();
	TSharedRef<SWidget> BuildSquad();
	TSharedRef<SWidget> BuildMarket();
	TSharedRef<SWidget> BuildYouth();
	TSharedRef<SWidget> BuildFinances();
	TSharedRef<SWidget> BuildInbox();
	TSharedRef<SWidget> BuildClub();
	TSharedRef<SWidget> BuildMatch();
	TSharedRef<SWidget> BuildCups();
	TSharedRef<SWidget> BuildCareer();
	TSharedRef<SWidget> BuildTactics();
	TSharedRef<SWidget> BuildOffers(bool bYouth);

	// Aktionen (Payload über CreateSP)
	FReply OnPage(int32 PageIndex);
	FReply OnNext();
	FReply OnBuy(int32 MarketIndex);
	FReply OnSell(int32 PlayerId);
	FReply OnRenew(int32 PlayerId);
	FReply OnPromote(int32 YouthIndex);
	FReply OnRelease(int32 YouthIndex);
	FReply OnTicket(int32 Delta);
	FReply OnExpand(int32 Seats);
	FReply OnAcademy();
	FReply OnTraining();
	FReply OnTableLevel(int32 Level);
	FReply OnSave();
	FReply OnLoad();
	FReply OnImport();
	FReply OnNewGame();
	FReply OnFormation(int32 Index);
	FReply OnStyle(int32 Index);
	FReply OnSponsor(int32 Index);
	FReply OnAcceptOffer(int32 Index);
	FReply OnDeclineOffer(int32 Index);

	void Status(const FString& Text, float Seconds = 5.f);
};
