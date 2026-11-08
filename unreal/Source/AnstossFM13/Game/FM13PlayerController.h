#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "FM13PlayerController.generated.h"

class UFM13GameInstance;

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
	Pokal
};

// Tastatursteuerung für die Platzhalter-Oberfläche:
// Leertaste = nächster Spieltag (bzw. Saison abschließen), 1-8 = Seiten, Pfeile = Auswahl,
// 9 = Live-Ticker, 0 = Pokale, Enter = Aktion der Seite, Entf = abgeben/entlassen, Links/Rechts = Ticketpreis, F5/F9 = Speichern/Laden,
// F2 = neue Karriere.
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

protected:
	virtual void SetupInputComponent() override;

private:
	UFM13GameInstance* Game() const;

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
