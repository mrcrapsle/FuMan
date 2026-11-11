#pragma once

#include "FM13Types.h"

// Transfer-Regeln rund um den Markt (js/medical-check.js, js/buyback.js, js/transfer-strategy.js,
// js/rumors.js, js/pre-contracts.js). Reine Formeln: der Zufall kommt als Zahl zwischen 0 und 1
// herein, damit Tests die Werte direkt pruefen koennen. Zustand und Ablauf liegen in FFM13World.
namespace FM13Transfers
{
	// JavaScript Math.round: auf die naechste ganze Zahl, Halbe nach oben
	int64 JsRunden(double X);

	// Gleichmaessig verteilte Zahl zwischen 0 und 1 aus der Kennung (fuer Berater, ohne den Hauptzufall zu verbrauchen)
	double HashEinheit(int32 Kennung, uint32 Salz);

	// ---------- Medizincheck (js/medical-check.js) ----------
	// ensureMedicalProfile(): Alter 29+ erhoeht die Quote chronischer Probleme um 0,1
	FFM13MedBefund WuerfleBefund(int32 Alter, double Zufall, double ZufallAnzahl, double ZufallWochen);
	// getMedicalCheckFee(): 3 % der Abloese mal Physio-Faktor, auf 100 gerundet, mindestens 1.500
	int64 MedizinGebuehr(int64 Ablose, double PhysioAusfall);
	// Preisnachlass nach einem auffaelligen Befund: chronisch 0,8, verletzt 0,85 (auf 1.000 gerundet)
	double MedizinRabatt(EFM13Medical Issue);
	bool MedizinAuffaellig(EFM13Medical Issue);

	// ---------- Rueckkauf (js/buyback.js) ----------
	constexpr int32 BuybackMaxAge = 25;
	constexpr int32 BuybackSeasons = 2;
	int64 RueckkaufSofort(int64 Angebot);   // 90 % des Angebots, auf Euro gerundet
	int64 RueckkaufPreis(int64 Angebot);    // 140 % des Angebots, auf 1.000 gerundet
	bool RueckkaufMoeglich(int32 Alter);
	// tickBuybackOptions(): Entwicklung beim neuen Verein je Alter
	int32 RueckkaufEntwicklung(int32 Alter, double Zufall);

	// ---------- Transferstrategie (js/transfer-strategy.js) ----------
	enum class EStrategie : uint8 { Jugend, Sofort, Sparen, Ausgewogen };
	double StrategieBudgetAnteil(EStrategie S);   // -0,3 / +0,4 / -0,5 / 0
	int32 StrategieZielVerschiebung(EStrategie S); // +1 / -2 / +2 / 0 (Platz, kleiner ist besser)
	int64 StrategieBudgetDelta(int64 LigaBudget, EStrategie S);
	int32 StrategieZiel(int32 AltesZiel, int32 Verschiebung, int32 AnzahlTeams);
	constexpr int32 StrategieJugendSpieler = 3;
	constexpr int32 StrategieJugendSpiele = 10;
	// Abrechnung am Saisonende: Vorstandszufriedenheit-Aenderung und Erfuellung
	struct FStrategieAbrechnung { bool bErfuellt = false; int32 Vorstand = 0; int32 Fans = 0; };
	FStrategieAbrechnung StrategieAbrechnung(EStrategie S, int32 Eigengewaechse, int32 Platz, int32 Ziel, int64 Saisonbilanz);

	// ---------- Geruechte (js/rumors.js) ----------
	enum class EQuelle : uint8 { Boulevard, Blog, Fach };
	double QuelleTrefferquote(EQuelle Q);    // 0,3 / 0,5 / 0,75
	EQuelle QuelleWuerfeln(double Zufall);    // unter 0,45 Boulevard, unter 0,8 Blog, sonst Fach
	// dementieren: Ehrgeizige und Selbstbewusste Moral -5, alle anderen +3
	int32 DementiMoral(uint8 Charakter, int32 Moral);
	int32 AnheizenMoral(int32 Moral);   // -3
	// Angebots-Multiplikator nach einem wahren Geruecht: (Verhandler 1,05 oder 0,85 + Zufall x 0,35), anheizen x 1,15
	double GeruechtMultiplikator(bool bVerhandler, double Zufall, bool bAngeheizt);
	bool GeruechtWechselwillig(uint8 Charakter);

	// ---------- Vorvertraege (js/pre-contracts.js) ----------
	constexpr int32 PreContractStartMatchday = 18;
	constexpr int32 PreContractMaxPending = 3;
	constexpr int32 PreContractOfferDeadline = 3;
	int64 VorvertragGehalt(int64 Gehalt);        // Gehalt x 1,2, auf 10 gerundet
	int64 VorvertragHandgeld(int64 Gehalt, bool bDoppelt);   // 12 bzw. 24 Spieltagsgehaelter
	// Zusagewahrscheinlichkeit: 0,6 + (Elfschnitt - Staerke) x 0,04, Platz 1-3 +0,1, doppelt +0,25, zwischen 0,1 und 0,95
	double VorvertragChance(int32 ElfSchnitt, int32 Staerke, int32 Rang, bool bDoppelt);
}
