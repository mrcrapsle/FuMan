#pragma once

#include "FM13Types.h"

// Wirtschaftsformeln. MarketValue, Wage und TvMoney sind 1:1 aus dem Browserspiel übernommen
// (calculatePlayerMarketValue, calculatePlayerWage in js/entities.js, calculateCollectiveTvMoney in
// js/media-rights.js). Zuschauer und Sponsor sind vereinfacht, siehe Kommentare in FM13Economy.cpp.
namespace FM13Economy
{
	// Rng = nullptr: ohne die Streuung von ±8 % (für Anzeigen und Tests)
	int64 MarketValue(int32 Strength, FRandomStream* Rng);
	int32 Wage(int64 MarketValue, int32 Strength);
	int64 TvMoney(int32 Level, int32 Rank);

	// Richtpreis eines Tickets je Liga und die Zuschauerzahl bei gegebenem Preis
	int32 BaseTicketPrice(int32 Level);
	int32 Attendance(int32 Capacity, int32 Fans, int32 Level, int32 Rank, int32 TicketPrice);

	// Sponsor-Grundbetrag pro Spieltag und Siegprämie je Liga
	int32 SponsorBase(int32 Level);
	int32 SponsorWinBonus(int32 Level);

	// Kosten eines Stadionausbaus
	int64 StadiumExpansionCost(int32 Seats);
	constexpr int32 StadiumBuildMatchdays = 6;
}
