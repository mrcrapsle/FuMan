#pragma once

#include "FM13Types.h"

// Entwicklungstypen (js/player-development.js): jeder Spieler hat einen festen Typ mit eigenem
// Leistungshöhepunkt. Vor dem Höhepunkt legt er zu, danach baut er ab.
namespace FM13Dev
{
	struct FArchetype { const TCHAR* Name; int32 PeakAge; float DevelopmentRate; float DeclineRate; int32 Weight; };
	const TArray<FArchetype>& Archetypes();
	// Fester Typ aus der Spieler-Id (gleiche Gewichte wie im Browserspiel)
	uint8 ArchetypeFor(int32 PlayerId);
	// Erwartete Stärkeänderung für das kommende Lebensjahr [Min, Max]
	void DevelopmentRange(int32 Age, uint8 Archetype, int32& OutMin, int32& OutMax);
}
