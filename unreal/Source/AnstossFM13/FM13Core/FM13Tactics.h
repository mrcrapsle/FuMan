#pragma once

#include "FM13Types.h"

// Taktik (js/squad.js FORMATION_RATINGS, js/match.js TACTIC_STYLE_CONFIG, js/opponent-tactics.js).
namespace FM13Tactics
{
	struct FFormation { const TCHAR* Name; int32 Def; int32 Off; int32 Slots[4]; }; // Slots: TW, ABW, MIT, ST
	struct FStyle { const TCHAR* Key; const TCHAR* Label; int32 Tempo; int32 Press; TCHAR Archetype; }; // P, B, K, N

	const TArray<FFormation>& Formations();
	const TArray<FStyle>& Styles();
	const FFormation& Formation(const FString& Name);   // unbekannt: 4-4-2
	const FStyle& Style(const FString& Key);            // unbekannt: ausgeglichen

	// round(((tempo-50) + (press-50)) / 25)
	int32 StyleBonus(const FString& Key);
	// 1 + ((tempo-50) + (press-50)) / 400: höheres Tempo kostet Kraft (hier: Verletzungsrisiko)
	float StyleFitnessMultiplier(const FString& Key);
	float FormationOffBonus(const FString& Formation);  // (off - 60) * 0.04
	float FormationDefBonus(const FString& Formation);  // (def - 60) * 0.04

	// KI-Spielstil -> Ansatz; eigener Ansatz schlägt: Pressing > Ballbesitz > Konter > Pressing
	TCHAR AiArchetype(EFM13Playstyle Style);
	int32 MatchupBonus(const FString& OwnStyle, TCHAR OppArchetype);   // +2, 0, -2
	TCHAR PredictableArchetype(const TArray<FString>& RecentStyles);    // 3 von 5 gleich, sonst 0
	TCHAR CounterTo(TCHAR Archetype);                                   // der Ansatz, der ihn schlägt
	const TCHAR* ArchetypeLabel(TCHAR Archetype);
}
