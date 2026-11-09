#include "FM13Types.h"

namespace FM13
{
	const TCHAR* LeagueName(int32 Level)
	{
		static const TCHAR* Namen[NumLeagues] = {
			TEXT("1. Bundesliga"), TEXT("2. Liga"), TEXT("3. Liga"),
			TEXT("4. Liga (Regionalliga)"), TEXT("5. Liga (Oberliga)"), TEXT("6. Liga (Landesliga)")
		};
		return (Level >= 0 && Level < NumLeagues) ? Namen[Level] : TEXT("?");
	}
}

const TCHAR* FM13PositionName(EFM13Position Pos)
{
	switch (Pos)
	{
	case EFM13Position::TW: return TEXT("TW");
	case EFM13Position::ABW: return TEXT("ABW");
	case EFM13Position::MIT: return TEXT("MIT");
	default: return TEXT("ST");
	}
}

const TCHAR* FM13CharacterName(uint8 Character)
{
	static const TCHAR* Namen[] = { TEXT("Ruhig"), TEXT("Emotional"), TEXT("Ehrgeizig"), TEXT("Selbstbewusst"), TEXT("Bescheiden"), TEXT("Hitzkoepfig") };
	return Namen[Character % 6];
}
