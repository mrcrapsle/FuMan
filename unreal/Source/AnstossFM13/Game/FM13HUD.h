#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "FM13HUD.generated.h"

class UFM13GameInstance;
class AFM13PlayerController;

// Platzhalter-Oberfläche: zeichnet die acht Seiten als Text direkt auf den Bildschirm.
// Für eine richtige Oberfläche UMG-Widgets bauen, die dieselben Funktionen der GameInstance nutzen.
UCLASS()
class ANSTOSSFM13_API AFM13HUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

private:
	float Scale = 1.f;
	float Y = 0.f;

	void Line(const FString& Text, float X, const FLinearColor& Color);
	void Row(const TArray<FString>& Cells, const TArray<float>& Columns, const FLinearColor& Color);
	void Bar(float X, float Width, float Fraction, const FLinearColor& Color);

	void DrawHeader(const UFM13GameInstance& G);
	void DrawOverview(const UFM13GameInstance& G);
	void DrawTable(const UFM13GameInstance& G);
	void DrawSquad(const UFM13GameInstance& G, int32 Selection);
	void DrawMarket(const UFM13GameInstance& G, int32 Selection);
	void DrawYouth(const UFM13GameInstance& G, int32 Selection);
	void DrawFinances(const UFM13GameInstance& G);
	void DrawInbox(const UFM13GameInstance& G);
	void DrawClub(const UFM13GameInstance& G, int32 Selection);
	void DrawMatch(const UFM13GameInstance& G);
	void DrawCups(const UFM13GameInstance& G);
	void DrawFooter(const AFM13PlayerController& PC);
};
