#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "FM13GameMode.generated.h"

// Startet ohne Spielfigur: das Spiel ist reine Oberfläche (HUD-Platzhalter oder eigene UMG-Widgets).
UCLASS()
class ANSTOSSFM13_API AFM13GameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AFM13GameMode();
};
