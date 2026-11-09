#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "FM13GameMode.generated.h"

// Startet ohne Spielfigur: Menü (Slate) plus 3D-Stadion (AFM13StadiumActor), das der GameMode beim Start setzt.
UCLASS()
class ANSTOSSFM13_API AFM13GameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AFM13GameMode();
	virtual void BeginPlay() override;
};
