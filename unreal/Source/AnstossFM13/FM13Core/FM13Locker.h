#pragma once

#include "FM13Types.h"

// Kabine (js/locker-room.js, js/team-council.js): Führung, Cliquen, Rangordnung. Reine Regeln.
namespace FM13Locker
{
	// nationPool aus js/entities.js: fünf von zehn Spielern sind Deutsche, je einer aus den anderen Ländern
	const TCHAR* Nation(uint8 Index);
	uint8 NationFromRoll(int32 Wurf);     // Wurf 0 bis 9
	int32 AnzahlNationen();

	// getLeadershipScore(): Führungsspieler-Eigenschaft, Alter ueber 26, Einsaetze (max 150), Moral
	double Fuehrung(bool bLeader, int32 Alter, int32 Einsaetze, int32 Moral);

	// Altersgruppe fuer Cliquen: jung bis 23, erfahren ab 30, sonst Mittelbau
	uint8 Altersgruppe(int32 Alter);
	const TCHAR* AltersgruppeName(uint8 Gruppe);

	// Rangordnung: Kapitaen, Rat, Etabliert (30 Einsaetze oder 27 Jahre), Talent (bis 21), Mitlaeufer
	enum class EStatus : uint8 { Kapitaen, Rat, Etabliert, Mitlaeufer, Talent };
	EStatus Status(bool bKapitaen, bool bRat, int32 Alter, int32 Einsaetze);

	const int32 UnruheMoral = 40;         // Clique unter diesem Schnitt rumort
	const int32 ZufriedenMoral = 75;      // Clique ab diesem Schnitt hebt die Stimmung

	// Teamstaerke durch die Kabine: einende Clique +1,5, viele Grueppchen -1, rumorende Cliquen je -0,5 (hoechstens -1,5)
	double CliqueModifikator(int32 AnzahlKader, int32 GroessteClique, bool bGroessteRumort, int32 AnzahlCliquen, int32 AnzahlRumorend);
	// Mannschaftsrat: Stabilisator je nach Schnitt der Ratsmitglieder: 3 ab 70, -2 bis 35
	double Stabilisator(int32 Schnitt);
	// Kapitaen mit Autoritaet: Moral 60 oder mehr und Fuehrung 20 oder mehr (captainHasAuthority)
	bool KapitaenAutoritaet(int32 Moral, double Fuehrung);
}
