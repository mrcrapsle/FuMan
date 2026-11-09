#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "FM13PlayerController.generated.h"

class UFM13GameInstance;
class SFM13Menu;
class SWidget;

UENUM(BlueprintType)
enum class EFM13Page : uint8
{
	Uebersicht,
	Tabelle,
	Kader,
	Transfermarkt,
	Jugend,
	Finanzen,
	Postfach,
	Verein,
	Spiel,
	Pokal,
	Karriere
};

// Tastatursteuerung für die Platzhalter-Oberfläche:
// Leertaste = nächster Spieltag (bzw. Saison abschließen), 1-8 = Seiten, Pfeile = Auswahl,
// 9 = Live-Ticker, 0 = Pokale, Enter = Aktion der Seite, Entf = abgeben/entlassen, Links/Rechts = Ticketpreis, F5/F9 = Speichern/Laden,
// F2 = neue Karriere, F8 = Spielstand aus dem Browserspiel übernehmen, F1 = Menü oder Textansicht.
// Das Menü (SFM13Menu) bedient dieselben Funktionen mit der Maus.
UCLASS()
class ANSTOSSFM13_API AFM13PlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AFM13PlayerController();

	UPROPERTY(BlueprintReadOnly, Category = "FM13") EFM13Page Page = EFM13Page::Uebersicht;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") int32 Selection = 0;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") FString StatusLine;
	UPROPERTY(BlueprintReadOnly, Category = "FM13") double StatusUntil = 0.0;

	// Meldung für einige Sekunden unten im Bild (wie showToast im Browserspiel)
	UFUNCTION(BlueprintCallable, Category = "FM13") void ShowStatus(const FString& Text, float Seconds = 4.f);
	UFUNCTION(BlueprintCallable, Category = "FM13") void SetPage(EFM13Page NewPage);
	int32 SelectionCount() const;
	bool IsStatusVisible() const;

	// Nächster Spieltag oder, nach Spieltag 34, Saisonabschluss (Leertaste und Knopf im Menü)
	UFUNCTION(BlueprintCallable, Category = "FM13") void AdvanceGame();

	// true: alte Textansicht (HUD) statt Menü
	UPROPERTY(BlueprintReadOnly, Category = "FM13") bool bTextMode = false;

protected:
	virtual void SetupInputComponent() override;
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	UFUNCTION() void HandleStateChanged();

private:
	UFM13GameInstance* Game() const;
	void RefreshMenu();
	void OnToggleText();

	TSharedPtr<SFM13Menu> Menu;
	TSharedPtr<SWidget> MenuHost;

	void OnWeiter();
	void OnHoch();
	void OnRunter();
	void OnAktion();
	void OnEntfernen();
	void OnPreisPlus();
	void OnPreisMinus();
	void OnSpeichern();
	void OnLaden();
	void OnNeu();
	void OnImport();
	void OnSeite1() { SetPage(EFM13Page::Uebersicht); }
	void OnSeite2() { SetPage(EFM13Page::Tabelle); }
	void OnSeite3() { SetPage(EFM13Page::Kader); }
	void OnSeite4() { SetPage(EFM13Page::Transfermarkt); }
	void OnSeite5() { SetPage(EFM13Page::Jugend); }
	void OnSeite6() { SetPage(EFM13Page::Finanzen); }
	void OnSeite7() { SetPage(EFM13Page::Postfach); }
	void OnSeite8() { SetPage(EFM13Page::Verein); }
	void OnSeite9() { SetPage(EFM13Page::Spiel); }
	void OnSeite0() { SetPage(EFM13Page::Pokal); }
};
