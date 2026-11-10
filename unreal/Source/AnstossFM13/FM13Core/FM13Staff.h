#pragma once

#include "FM13Types.h"

// Personal im Campus (js/campus-staff.js): Preise, Bewerber, Gehaltsrechnung. Reine Formeln, ohne Spielzustand.
namespace FM13Staff
{
	// Die sechs Stellen mit einer Wirkung in Unreal, in der Reihenfolge der Steckplaetze in FM13World::StaffSlot()
	struct FRolle { const TCHAR* Key; const TCHAR* Name; int64 Gehalt; int64 Kosten; };
	const TArray<FRolle>& Rollen();
	int32 AnzahlRollen();
	int64 GehaltFuer(const TCHAR* Key);                     // Standardgehalt zum Schluessel (wie im Browserspiel)

	// Bewerber beim Einstellen: Preisfaktor, Startmoral, Startstufe
	struct FBewerber { const TCHAR* Name; double PreisFaktor; int32 Moral; int32 Stufe; };
	const TArray<FBewerber>& Bewerber();

	int64 PreisFuerBewerber(int32 Rolle, int32 Kandidat);   // Round(Kosten x Faktor)
	int64 Abfindung(int64 Gehalt, int32 Stufe);             // Gehalt x Stufe beim Entlassen
	int64 WeiterbildungKosten(int32 Rolle, int32 Stufe);    // Round(Kosten x 0,6 x Stufe)
	int32 WeiterbildungTage(int64 Kosten);                   // Round(Kosten / 8000) zwischen 3 und 8
	int64 VerlaengerungKosten(int32 Rolle);                  // Round(Kosten x 0,4)
	int64 GehaltserhoehungKosten(int64 Gehalt);              // Gehalt x 5
	int64 NeuesGehalt(int64 Gehalt);                         // Round(Gehalt x 1,1)
	double MoralAbnahme(double Moral);                       // -0,3 je Spieltag, Untergrenze 20
	double Wirksamkeit(double Moral);                        // 1 ab 70, 0,85 ab 40, sonst 0,65
	constexpr int32 VertragsLaufzeit = 34;
}
