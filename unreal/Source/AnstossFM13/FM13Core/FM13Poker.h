#pragma once

#include "FM13Types.h"

// Transferpoker (js/transfer-poker.js, js/transfermarket.js): Forderung, Schmerzgrenze, Gehalt. Reine Regeln,
// der Zufall wird als Zahl zwischen 0 und 1 hereingereicht, damit Tests die Werte direkt prüfen können.
namespace FM13Poker
{
	// pokerRunden(): unter 100.000 auf 100 genau, darüber auf 1.000 genau
	int64 Runden(double Betrag);

	// POKER_TOUGHNESS nach Charakter (Ruhig, Emotional, Ehrgeizig, Selbstbewusst, Bescheiden, Hitzkoepfig)
	double Zaehigkeit(uint8 Charakter);

	// Schmerzgrenze des Verkaeufers: Marktwert x (0,82 + Vertrag x 0,05), Vertrag 1 bis 4 Jahre
	int64 Schmerzgrenze(int64 Marktwert, int32 Vertrag);
	// Forderung: mindestens 1,01 x Schmerzgrenze, sonst Marktwert x (1 + Vertrag x 0,04 + Zufall x 0,12)
	int64 Forderung(int64 Marktwert, int32 Vertrag, int64 Schmerzgrenze, double Zufall);

	// Gehaltsforderung des Spielers nach der Einigung auf die Abloese (Gehalt je Spieltag, auf 10 gerundet)
	int64 Gehaltsforderung(int64 Gehalt, double Zaehigkeit, double Zufall, bool bBerater);
	// Einmal nachverhandeln: zaehe Charaktere lassen sich selten druecken
	int64 Nachverhandlung(int64 Forderung, bool bErfolg);   // Erfolg: x 0,9, Misserfolg: x 1,05, auf 10 gerundet
	double NachverhandlungChance(double Zaehigkeit);       // max(0,15; 0,75 - (Zaehigkeit - 0,75) x 0,9)

	// Rivale steigt ein: Gebot 1,05 bis 1,17 x Schmerzgrenze
	int64 RivalenGebot(int64 Schmerzgrenze, double Zufall);
}
