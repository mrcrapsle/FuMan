#include "FM13GameMode.h"
#include "FM13HUD.h"
#include "FM13PlayerController.h"

AFM13GameMode::AFM13GameMode()
{
	HUDClass = AFM13HUD::StaticClass();
	PlayerControllerClass = AFM13PlayerController::StaticClass();
	DefaultPawnClass = nullptr;
}
