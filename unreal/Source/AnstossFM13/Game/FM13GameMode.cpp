#include "FM13GameMode.h"
#include "FM13HUD.h"
#include "FM13PlayerController.h"
#if !defined(FM13_NO_SLATE)
#include "FM13StadiumActor.h"
#include "Engine/World.h"
#endif

AFM13GameMode::AFM13GameMode()
{
	HUDClass = AFM13HUD::StaticClass();
	PlayerControllerClass = AFM13PlayerController::StaticClass();
	DefaultPawnClass = nullptr;
}

void AFM13GameMode::BeginPlay()
{
	Super::BeginPlay();
#if !defined(FM13_NO_SLATE)
	if (UWorld* W = GetWorld()) W->SpawnActor<AFM13StadiumActor>(FVector::ZeroVector, FRotator::ZeroRotator);
#endif
}
