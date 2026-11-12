#include "FM13Economy.h"

namespace
{
	constexpr float MarketValueLowCoeff = 83.f;     // MARKET_VALUE_LOW_COEFF
	constexpr float MarketValueLowCoeffOld = 450.f; // MARKET_VALUE_LOW_COEFF_OLD
	const int64 LeagueBaseTvMoneyTabelle[FM13::NumLeagues] = { 64000000, 8000000, 1000000, 620000, 150000, 100000 };
}

namespace FM13Economy
{
	int64 MarketValue(int32 Str, FRandomStream* Rng)
	{
		double Val = 0.0;
		if (Str <= 58) Val = 15000.0 + FMath::Pow((float)FMath::Max(0, Str - 44), 2.8f) * MarketValueLowCoeff;
		else if (Str <= 68) Val = 150000.0 + FMath::Pow((float)(Str - 58), 3.2f) * 550.0;
		else if (Str <= 77) Val = 1025000.0 + FMath::Pow((float)(Str - 68), 3.8f) * 1200.0;
		else if (Str <= 85) Val = 7500000.0 + FMath::Pow((float)(Str - 77), 4.2f) * 4500.0;
		else Val = 35500000.0 + FMath::Pow((float)(Str - 85), 2.3f) * 400000.0;
		Val = FMath::Min(Val, 250000000.0);
		const double Streuung = Rng ? (0.92 + Rng->FRand() * 0.16) : 1.0;
		const int64 Gerundet = FMath::RoundToInt64(Val * Streuung / 5000.0) * 5000;
		return FMath::Max<int64>(10000, Gerundet);
	}

	int32 Wage(int64 Mv, int32 Str)
	{
		const double Unterhalb = 15000.0 + FMath::Max<double>(0.0, (double)Mv - 15000.0) * MarketValueLowCoeffOld / MarketValueLowCoeff;
		double ProSpieltag;
		if (Str <= 58) ProSpieltag = 60.0 + Str * 3.0 + Unterhalb * 0.004;
		else if (Str <= 68) ProSpieltag = 1200.0 + Mv * 0.006;
		else if (Str <= 77) ProSpieltag = 5000.0 + Mv * 0.0045;
		else ProSpieltag = 25000.0 + Mv * 0.0035;
		return FMath::Max(150, (int32)(FMath::RoundToInt64(ProSpieltag / 50.0) * 50));
	}

	int64 LeagueBaseTvMoney(int32 Level)
	{
		return (Level >= 0 && Level < FM13::NumLeagues) ? LeagueBaseTvMoneyTabelle[Level] : 100000;
	}

	int64 TvMoney(int32 Level, int32 Rank)
	{
		const int64 Basis = (Level >= 0 && Level < FM13::NumLeagues) ? LeagueBaseTvMoneyTabelle[Level] : 100000;
		const double Faktor = FMath::Max(0.4, 1.5 - (Rank - 1) * 0.055); // Platz 1: 1,5-fach, Platz 18: ~0,6-fach
		return FMath::RoundToInt64(Basis * Faktor);
	}

	int32 BaseTicketPrice(int32 Level)
	{
		// Mittlerer Ticketpreis der Liga: Kategorien 12/24/80 Euro mit Anteilen 50/45/5 Prozent, mal Ligafaktor (1 + (4 - Liga) x 0,25)
		const float Faktor = (4.f - (float)FMath::Clamp(Level, 0, FM13::NumLeagues - 1)) * 0.25f + 1.f;
		return FMath::FloorToInt(Faktor * 20.8f + 0.5f);
	}

	// Vereinfachung gegenüber calculateMatchAttendanceDetails() (js/stadium.js): Grundnachfrage je Liga,
	// Fans und Tabellenplatz heben sie, ein Preis über dem Richtpreis senkt sie (gleiche Neigung wie im
	// Ticket-Rechner der Werkbank: -1,2 % Zuschauer je +1 % Preis). Mehr als voll geht nicht.
	int32 Attendance(int32 Capacity, int32 Fans, int32 Level, int32 Rank, int32 TicketPrice)
	{
		static const float Grundnachfrage[FM13::NumLeagues] = { 40000.f, 22000.f, 9000.f, 3500.f, 1500.f, 700.f };
		const float Basis = Grundnachfrage[FMath::Clamp(Level, 0, FM13::NumLeagues - 1)];
		const float FanFaktor = 0.6f + FMath::Clamp(Fans, 0, 100) / 100.f * 0.8f;           // 0,6 bis 1,4
		const float PlatzFaktor = 1.15f - (FMath::Clamp(Rank, 1, FM13::TeamsPerLeague) - 1) * 0.02f; // 1,15 bis 0,81
		const float PreisVerhaeltnis = (float)TicketPrice / (float)BaseTicketPrice(Level);
		const float PreisFaktor = FMath::Clamp(1.f - 1.2f * (PreisVerhaeltnis - 1.f), 0.2f, 1.3f);
		const int32 Nachfrage = FMath::RoundToInt(Basis * FanFaktor * PlatzFaktor * PreisFaktor);
		return FMath::Clamp(Nachfrage, 0, Capacity);
	}

	// Der Startsponsor im Browserspiel zahlt 3.000 € Grundbetrag und 1.500 € Siegprämie (6. Liga).
	// Höhere Ligen bekommen im Port feste Stufen statt der Angebotsverhandlung aus js/sponsors.js.
	int32 SponsorBase(int32 Level)
	{
		static const int32 Werte[FM13::NumLeagues] = { 400000, 90000, 30000, 12000, 6000, 3000 };
		return Werte[FMath::Clamp(Level, 0, FM13::NumLeagues - 1)];
	}

	int32 SponsorWinBonus(int32 Level)
	{
		return SponsorBase(Level) / 2;
	}

	int64 StadiumExpansionCost(int32 Seats)
	{
		return (int64)FMath::Max(0, Seats) * 450;
	}
}
