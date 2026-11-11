// Tests des Spielkerns ohne Unreal Engine: g++ mit der Nachbildung in CoreMinimal.h.
// Bauen und starten: unreal/Tests/Host/run.sh
#include "CoreMinimal.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Economy.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Match.h"
#include "../../Source/AnstossFM13/FM13Core/FM13World.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Fitness.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Strength.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Staff.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Locker.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Youth.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Poker.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Transfers.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Tactics.h"
#include "ReferenzStaerke.h"
#include "../../Source/AnstossFM13/FM13Core/FM13SaveCodec.h"
#include "../../Source/AnstossFM13/FM13Core/FM13BrowserImport.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Tactics.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Development.h"
#include <dirent.h>
#include <fstream>
#include <sstream>
#include "Referenzwerte.h"
#include <set>
#include <map>
#include <cmath>

static int GBestanden = 0, GFehler = 0;
#define PRUEFE(Bed, ...) do { if (Bed) { ++GBestanden; } else { ++GFehler; std::printf("  FEHLER %s:%d: ", __FILE__, __LINE__); std::printf(__VA_ARGS__); std::printf("\n"); } } while (0)

static void TestFormeln()
{
	std::printf("Formeln gegen das Browserspiel\n");
	for (const FRefWert& R : RefWerte)
	{
		const int64 Mv = FM13Economy::MarketValue(R.Staerke, nullptr);
		PRUEFE(Mv == R.Marktwert, "Marktwert Staerke %d: %lld statt %lld", R.Staerke, (long long)Mv, R.Marktwert);
		const int32 W = FM13Economy::Wage(R.Marktwert, R.Staerke);
		PRUEFE(W == R.Gehalt, "Gehalt Staerke %d: %d statt %d", R.Staerke, W, R.Gehalt);
	}
	for (const FRefTv& R : RefTv)
	{
		const int64 Tv = FM13Economy::TvMoney(R.Liga, R.Platz);
		PRUEFE(Tv == R.Tv, "TV Liga %d Platz %d: %lld statt %lld", R.Liga, R.Platz, (long long)Tv, R.Tv);
	}
	// getExpectedGoals: gleich stark = 1,35; 10 Punkte Vorsprung = 1,8 zu 0,9; Grenzen
	FM13Match::FExpectedGoals X = FM13Match::ExpectedGoals(60, 60, EFM13Playstyle::Ausgeglichen, EFM13Playstyle::Ausgeglichen);
	PRUEFE(std::fabs(X.Home - 1.35f) < 1e-4f && std::fabs(X.Away - 1.35f) < 1e-4f, "xG gleich stark");
	X = FM13Match::ExpectedGoals(70, 60, EFM13Playstyle::Ausgeglichen, EFM13Playstyle::Ausgeglichen);
	PRUEFE(std::fabs(X.Home - 1.80f) < 1e-4f && std::fabs(X.Away - 0.90f) < 1e-4f, "xG 10 Punkte: %.3f %.3f", X.Home, X.Away);
	X = FM13Match::ExpectedGoals(99, 1, EFM13Playstyle::Ausgeglichen, EFM13Playstyle::Ausgeglichen);
	PRUEFE(std::fabs(X.Home - 5.5f) < 1e-4f && std::fabs(X.Away - 0.15f) < 1e-4f, "xG Grenzen");
	X = FM13Match::ExpectedGoals(60, 60, EFM13Playstyle::Offensiv, EFM13Playstyle::Defensiv);
	PRUEFE(std::fabs(X.Home - 1.35f * 1.18f * 0.85f) < 1e-4f && std::fabs(X.Away - 1.35f * 1.12f * 0.90f) < 1e-4f, "xG Spielstile");
	// Vorstand
	PRUEFE(FM13Match::BoardShift(EFM13Expectation::Favorit, 0, 1) == -3, "Favorit verliert -3");
	PRUEFE(FM13Match::BoardShift(EFM13Expectation::Aussenseiter, 1, 1) == 1, "Aussenseiter Remis +1");
	// Poisson: Mittelwert nahe Lambda
	FRandomStream Rng(7);
	double Summe = 0; const int N = 200000;
	for (int i = 0; i < N; ++i) Summe += FM13Match::Poisson(Rng, 1.35f);
	PRUEFE(std::fabs(Summe / N - 1.35) < 0.02, "Poisson-Mittel %.3f", Summe / N);
}

static void TestSpielplan()
{
	std::printf("Spielplan und Tabelle\n");
	FFM13World W;
	W.NewGame(TEXT("Testverein"), 42);
	PRUEFE(W.Leagues.Num() == 6, "6 Ligen");
	std::set<std::string> Namen;
	for (const FFM13League& L : W.Leagues)
	{
		PRUEFE(L.Clubs.Num() == 18, "Liga %d hat %d Vereine", L.Level, L.Clubs.Num());
		PRUEFE(L.MatchdayCount() == 34, "Liga %d hat %d Spieltage", L.Level, L.MatchdayCount());
		PRUEFE(L.Fixtures.Num() == 306, "Liga %d hat %d Spiele", L.Level, L.Fixtures.Num());
		for (const FFM13Club& C : L.Clubs) Namen.insert(C.Name.S);
		// Jede Paarung genau einmal je Heimrecht, jeder Verein spielt an jedem Spieltag genau einmal
		std::map<std::pair<int, int>, int> Paar;
		std::map<std::pair<int, int>, int> ProTag;
		std::vector<int> Heim(18, 0);
		for (const FFM13Fixture& F : L.Fixtures)
		{
			Paar[{ F.Home, F.Away }]++;
			ProTag[{ F.Matchday, F.Home }]++;
			ProTag[{ F.Matchday, F.Away }]++;
			Heim[F.Home]++;
		}
		bool bPaareOk = Paar.size() == 306;
		for (auto& E : Paar) if (E.second != 1 || E.first.first == E.first.second) bPaareOk = false;
		PRUEFE(bPaareOk, "Liga %d: jede Paarung einmal daheim und einmal auswaerts", L.Level);
		bool bTageOk = ProTag.size() == 34 * 18;
		for (auto& E : ProTag) if (E.second != 1) bTageOk = false;
		PRUEFE(bTageOk, "Liga %d: jeder Verein einmal pro Spieltag", L.Level);
		bool bHeimOk = true;
		for (int h : Heim) if (h != 17) bHeimOk = false;
		PRUEFE(bHeimOk, "Liga %d: 17 Heimspiele je Verein", L.Level);
	}
	PRUEFE(Namen.size() == 108, "108 verschiedene Vereinsnamen (%d)", (int)Namen.size());
	PRUEFE(W.OwnLeague().FindOwn() >= 0 && W.LeagueLevel == 5, "Eigener Verein in der 6. Liga");
	PRUEFE(W.Squad.Num() == 18, "Startkader 18 Spieler");

	for (int i = 0; i < 34; ++i) W.PlayMatchday();
	PRUEFE(W.IsSeasonFinished(), "Saison nach 34 Spieltagen fertig");
	PRUEFE(!W.PlayMatchday(), "Kein 35. Spieltag");
	for (const FFM13League& L : W.Leagues)
	{
		int Spiele = 0, Tore = 0, Gegentore = 0, Punkte = 0, Siege = 0, Remis = 0;
		for (const FFM13Club& C : L.Clubs) { Spiele += C.Played; Tore += C.GoalsFor; Gegentore += C.GoalsAgainst; Punkte += C.Points(); Siege += C.Won; Remis += C.Drawn; }
		PRUEFE(Spiele == 18 * 34, "Liga %d: alle Spiele gezaehlt", L.Level);
		PRUEFE(Tore == Gegentore, "Liga %d: Tore = Gegentore", L.Level);
		PRUEFE(Punkte == Siege * 3 + Remis, "Liga %d: Punktesumme", L.Level);
		const TArray<int32> Idx = L.SortedIndices();
		bool bSortiert = true;
		for (int i = 1; i < Idx.Num(); ++i) if (FM13CompareRows(L.Clubs[Idx[i]], L.Clubs[Idx[i - 1]])) bSortiert = false;
		PRUEFE(bSortiert, "Liga %d: Tabelle sortiert", L.Level);
	}
}

static void TestFinanzen()
{
	std::printf("Finanzen und Kontoauszug\n");
	FFM13World W;
	W.NewGame(TEXT("Testverein"), 3);
	const int64 Start = W.Money;
	int Heim = 0;
	int Pokaltore = 0;
	for (int i = 0; i < 34; ++i)
	{
		W.PlayMatchday();
		if (W.LastCupReport.bPlayed) Pokaltore += W.LastCupReport.OwnGoals;
		if (W.LastReport.bHome)
		{
			++Heim;
			PRUEFE(W.LastReport.Attendance > 0 && W.LastReport.Attendance <= W.StadiumCapacity, "Zuschauer im Rahmen");
		}
		else PRUEFE(W.LastReport.Attendance == 0, "Auswaerts keine Zuschauereinnahmen");
		PRUEFE((int)W.LastReport.Scorers.Num() == W.LastReport.OwnGoals, "Torschuetzen = eigene Tore");
	}
	PRUEFE(Heim == 17, "17 Heimspiele (%d)", Heim);
	int64 Summe = 0;
	for (const FFM13Booking& B : W.Bookings) { Summe += B.Amount; PRUEFE(!B.Label.IsEmpty(), "Buchung mit Etikett"); }
	PRUEFE(Start + Summe == W.Money, "Kontostand = Start + Buchungen");
	int ToreKader = 0;
	for (const FFM13Player& P : W.Squad) ToreKader += P.GoalsSeason;
	PRUEFE(ToreKader == W.OwnLeague().Clubs[W.OwnLeague().FindOwn()].GoalsFor + Pokaltore, "Saisontore der Spieler = Liga- plus Pokaltore");
	std::printf("  Saison 1 in der 6. Liga: Kontostand %lld -> %lld, Platz %d\n", (long long)Start, (long long)W.Money, W.OwnRank());
}

static void TestSaisonende()
{
	std::printf("Saisonende, Auf- und Abstieg, mehrere Saisons\n");
	FFM13World W;
	W.NewGame(TEXT("Testverein"), 11);
	int Aufstiege = 0, Abstiege = 0;
	for (int Saison = 0; Saison < 12 && !W.bSacked; ++Saison)
	{
		while (W.PlayMatchday()) {}
		if (W.bSacked) break;
		const int32 AltLevel = W.LeagueLevel;
		const FFM13SeasonSummary S = W.ConcludeSeason();
		PRUEFE(S.Rank >= 1 && S.Rank <= 18, "Platz im Rahmen");
		if (S.Outcome == EFM13SeasonOutcome::Promoted) { ++Aufstiege; PRUEFE(W.LeagueLevel == AltLevel - 1, "Aufstieg wechselt die Liga"); }
		if (S.Outcome == EFM13SeasonOutcome::Relegated) { ++Abstiege; PRUEFE(W.LeagueLevel == AltLevel + 1, "Abstieg wechselt die Liga"); }
		if (S.Outcome == EFM13SeasonOutcome::Stayed) PRUEFE(W.LeagueLevel == AltLevel, "Klassenerhalt bleibt");
		int Eigene = 0;
		std::set<std::string> Namen;
		for (const FFM13League& L : W.Leagues)
		{
			PRUEFE(L.Clubs.Num() == 18, "Nach Saison %d: Liga %d hat %d Vereine", S.Season, L.Level, L.Clubs.Num());
			PRUEFE(L.MatchdayCount() == 34, "Neuer Spielplan");
			for (const FFM13Club& C : L.Clubs)
			{
				Namen.insert(C.Name.S);
				if (C.bOwn) { ++Eigene; PRUEFE(L.Level == W.LeagueLevel, "Eigener Verein in der richtigen Liga"); }
				PRUEFE(C.Played == 0, "Tabelle zurueckgesetzt");
				if (!C.bOwn) PRUEFE(C.Strength >= 35 && C.Strength <= 96, "KI-Staerke im Rahmen");
			}
		}
		PRUEFE(Eigene == 1, "Genau ein eigener Verein");
		PRUEFE(Namen.size() == 108, "Keine Vereine verloren oder doppelt");
		PRUEFE(W.Squad.Num() >= FM13::MinSquadSize, "Kader mindestens 16 Spieler");
		PRUEFE(W.Matchday == 1 && W.Season == S.Season + 1, "Neue Saison beginnt");
		std::printf("  Saison %d: %s Platz %d, Kontostand %lld, Staerke %d, Vorstand %d\n", S.Season, FM13::LeagueName(S.Level), S.Rank, (long long)W.Money, W.OwnStrength(), W.BoardSat);
	}
	std::printf("  Aufstiege %d, Abstiege %d, entlassen %s\n", Aufstiege, Abstiege, W.bSacked ? "ja" : "nein");
	PRUEFE(W.History.Num() >= 1, "Saisonchronik");
}

static void TestKaderAktionen()
{
	std::printf("Transfers, Vertraege, Jugend, Stadion\n");
	FFM13World W;
	W.NewGame(TEXT("Testverein"), 5);
	FString Grund;
	W.Money = 100000000;
	W.WageBudget = 100000000;
	const int32 Vorher = W.Squad.Num();
	const int64 Preis = W.Market[0].Price;
	const int64 Geld = W.Money;
	PRUEFE(W.BuyPlayer(0, Grund), "Kauf klappt");
	PRUEFE(W.Squad.Num() == Vorher + 1 && W.Money == Geld - Preis, "Kauf bucht Preis und Spieler");
	W.Money = 0;
	PRUEFE(!W.BuyPlayer(0, Grund) && Grund.Contains(TEXT("Vereinskonto")), "Ohne Geld kein Kauf");
	W.Money = -1;
	PRUEFE(!W.BuyPlayer(0, Grund) && Grund.Contains(TEXT("Transfersperre")), "Im Minus Transfersperre");
	W.Money = 100000000;
	W.WageBudget = W.WagesPerMatchday();
	PRUEFE(!W.BuyPlayer(0, Grund) && Grund.Contains(TEXT("Gehaltsbudget")), "Gehaltsbudget begrenzt Kaeufe");
	W.WageBudget = 100000000;
	W.Money = 0;
	const int32 Id = W.Squad[0].Id;
	PRUEFE(W.SellPlayer(Id, Grund) && W.Money > 0, "Verkauf bringt Geld");
	PRUEFE(!W.FindPlayer(Id), "Verkaufter Spieler weg");
	while (W.Squad.Num() > FM13::MinSquadSize) W.SellPlayer(W.Squad.Last().Id, Grund);
	PRUEFE(!W.SellPlayer(W.Squad[0].Id, Grund), "Mindestkader bleibt");
	FFM13Player& P = W.Squad[1];
	P.ContractYears = 1;
	const int32 AltLohn = P.Wage;
	PRUEFE(W.RenewContract(P.Id, 3, Grund) && P.ContractYears == 3 && P.Wage >= AltLohn, "Verlaengerung");
	PRUEFE(!W.RenewContract(P.Id, 3, Grund), "Laeuft noch lange genug");
	W.Money = 100000000;
	PRUEFE(W.ExpandStadium(1000, Grund), "Ausbau startet");
	PRUEFE(!W.ExpandStadium(1000, Grund), "Nur ein Ausbau gleichzeitig");
	const int32 Kap = W.StadiumCapacity;
	for (int i = 0; i < 6; ++i) W.PlayMatchday();
	PRUEFE(W.StadiumCapacity == Kap + 1000, "Ausbau nach 6 Spieltagen fertig");
	PRUEFE(W.UpgradeYouthAcademy(Grund) && W.YouthAcademyLevel == 2, "Akademie ausgebaut");
	while (W.PlayMatchday()) {}
	const FFM13SeasonSummary S = W.ConcludeSeason();
	PRUEFE(S.NewYouth.Num() == 3, "Drei Talente mit Akademie 2 (%d)", S.NewYouth.Num());
	const int32 Jugend = W.YouthTalents.Num();
	PRUEFE(W.PromoteYouth(0, Grund) && W.YouthTalents.Num() == Jugend - 1, "Talent aufgerueckt");
	PRUEFE(W.SetTicketPrice(20, Grund) && W.TicketPrice == 20, "Ticketpreis");
	PRUEFE(!W.SetTicketPrice(0, Grund), "Ticketpreis 0 abgelehnt");
}

static void TestDeterminismus()
{
	std::printf("Gleicher Seed, gleiches Spiel\n");
	FFM13World A, B;
	A.NewGame(TEXT("X"), 99);
	B.NewGame(TEXT("X"), 99);
	for (int i = 0; i < 34; ++i) { A.PlayMatchday(); B.PlayMatchday(); }
	PRUEFE(A.Money == B.Money && A.OwnRank() == B.OwnRank(), "Determinismus");
}

static void TestEntlassung()
{
	std::printf("Entlassung nur am Saisonende\n");
	FFM13World W;
	W.NewGame(TEXT("Testverein"), 21);
	W.Season = 2;
	W.BoardSat = 10;
	W.SeasonTarget = 1;
	// Ein sehr schwacher Kader verliert fast alles
	for (FFM13Player& P : W.Squad) P.Strength = 1;
	for (int i = 0; i < 20; ++i) W.PlayMatchday();
	PRUEFE(!W.bSacked, "Waehrend der Saison keine Entlassung");
	PRUEFE(W.LowBoardSatStreak >= 6, "Serie unter der Schwelle gezaehlt (%d)", W.LowBoardSatStreak);
	while (W.PlayMatchday()) {}
	// Verlauf festlegen: vor sechs Spielen 20, jetzt 10 = keine Erholung
	FFM13World Erholt = W;
	W.BoardHistory = { 20, 18, 15, 12, 10, 10, 10 };
	W.BoardSat = 10;
	W.ConcludeSeason();
	PRUEFE(W.bSacked, "Am Saisonende entlassen");
	PRUEFE(!W.PlayMatchday(), "Nach Entlassung kein Spieltag");
	// Erholung: Vertrauen über dem Wert von vor sechs Spielen schützt (wie im Browserspiel)
	Erholt.BoardHistory = { 8, 9, 10, 10, 11, 12, 12 };
	Erholt.BoardSat = 12;
	Erholt.ConcludeSeason();
	PRUEFE(!Erholt.bSacked, "Erholtes Vertrauen schuetzt vor der Entlassung");

	// Ziel erreicht schützt: gleiche Lage, aber das Ziel ist der letzte Platz
	FFM13World Z;
	Z.NewGame(TEXT("Testverein"), 21);
	Z.Season = 2;
	Z.BoardSat = 10;
	for (FFM13Player& P : Z.Squad) P.Strength = 1;
	while (Z.PlayMatchday()) {}
	Z.SeasonTarget = 18;
	Z.ConcludeSeason();
	PRUEFE(!Z.bSacked, "Saisonziel erreicht: keine Entlassung");
}

static void TestSpielstand()
{
	std::printf("Spielstand: Speichern, Laden, Weiterspielen\n");
	FFM13World W;
	W.NewGame(TEXT("Verein mit \"Zeichen\" \\ und\nZeile"), 77);
	FString Grund;
	W.Money = 5000000;
	W.WageBudget = 10000000;
	for (int i = 0; i < 20; ++i) W.PlayMatchday();
	W.BuyPlayer(0, Grund);
	W.ExpandStadium(1500, Grund);

	const FString Text = FM13Save::Encode(W);
	FFM13World L;
	FString Fehler;
	PRUEFE(FM13Save::Decode(Text, L, Fehler), "Laden klappt (%s)", *Fehler);
	PRUEFE(FM13Save::Encode(L) == Text, "Gespeichert = neu kodiert (Rundlauf ohne Verlust)");
	PRUEFE(L.ClubName == W.ClubName, "Sonderzeichen im Namen bleiben");
	// Weiterspielen: beide Welten laufen gleich weiter, auch über das Saisonende
	while (W.PlayMatchday()) {}
	while (L.PlayMatchday()) {}
	W.ConcludeSeason();
	L.ConcludeSeason();
	for (int i = 0; i < 10; ++i) { W.PlayMatchday(); L.PlayMatchday(); }
	PRUEFE(W.Money == L.Money && W.OwnRank() == L.OwnRank() && W.Season == L.Season && W.LeagueLevel == L.LeagueLevel, "Geladener Stand spielt identisch weiter");
	PRUEFE(FM13Save::Encode(W) == FM13Save::Encode(L), "Nach 44 Spieltagen identisch");

	// Kaputte Stände werden abgelehnt, das Ziel bleibt unverändert
	FFM13World Ziel;
	Ziel.NewGame(TEXT("Bleibt"), 1);
	const FString Vorher = FM13Save::Encode(Ziel);
	PRUEFE(!FM13Save::Decode(TEXT("{kaputt"), Ziel, Fehler), "Kaputtes JSON abgelehnt");
	PRUEFE(!FM13Save::Decode(TEXT("{\"foo\":1}"), Ziel, Fehler), "Fremdes JSON abgelehnt");
	PRUEFE(!FM13Save::Decode(Text.S.substr(0, Text.Len() / 2).c_str(), Ziel, Fehler), "Halber Spielstand abgelehnt");
	FString OhneLiga = Text;
	{
		const std::string::size_type Pos = OhneLiga.S.find("\"leagues\":[");
		OhneLiga.S.replace(Pos, 11, "\"leaguesX\":[");
	}
	PRUEFE(!FM13Save::Decode(OhneLiga, Ziel, Fehler) && Fehler.Contains(TEXT("Ligen")), "Fehlende Ligen erkannt (%s)", *Fehler);
	PRUEFE(FM13Save::Encode(Ziel) == Vorher, "Ziel nach Fehlern unveraendert");

	// Alter Stand ohne neue Felder: Standardwerte greifen
	FString Alt = Text;
	{
		const std::string::size_type Pos = Alt.S.find("\"training\":");
		const std::string::size_type Ende = Alt.S.find(',', Pos);
		Alt.S.erase(Pos, Ende - Pos + 1);
	}
	FFM13World A;
	PRUEFE(FM13Save::Decode(Alt, A, Fehler) && A.TrainingLevel == 1, "Fehlendes Feld bekommt den Startwert");
	std::printf("  Groesse eines Spielstands: %d Zeichen\n", Text.Len());
}

static void TestPokalUndVerletzungen()
{
	std::printf("Pokale, Verletzungen, Live-Ticker\n");
	FFM13World W;
	W.NewGame(TEXT("Testverein"), 31);
	PRUEFE(!W.DfbPokal.bOwnEntered, "6. Liga: nicht im DFB-Pokal");
	PRUEFE(W.DfbPokal.Alive.Num() == 32, "DFB-Pokal mit 32 Vereinen (%d)", W.DfbPokal.Alive.Num());
	PRUEFE(W.Landespokal.bOwnEntered && W.Landespokal.Alive.Num() == 16, "Landespokal mit 16 Vereinen");
	int Pokalspiele = 0, Tickerfehler = 0;
	while (W.PlayMatchday())
	{
		for (const FFM13OwnMatchReport* R : { &W.LastReport, &W.LastCupReport })
		{
			if (!R->bPlayed) continue;
			int Tore = 0;
			for (const FString& Zeile : R->Ticker) if (Zeile.Contains(TEXT("TOR fuer")) || Zeile.Contains(TEXT("Gegentor"))) ++Tore;
			bool bAbpfiff = false;
			for (const FString& Zeile : R->Ticker) if (Zeile.Contains(TEXT("Abpfiff"))) bAbpfiff = true;
			if (Tore != R->OwnGoals + R->OppGoals || !bAbpfiff) ++Tickerfehler;
			if (R == &W.LastCupReport) ++Pokalspiele;
		}
		// Verletzte stehen nie in der Startelf
		for (int32 Id : W.StartingEleven()) PRUEFE(W.FindPlayer(Id)->InjuredMatchdays == 0, "Verletzter in der Startelf");
	}
	PRUEFE(Tickerfehler == 0, "Ticker zeigt alle Tore und den Abpfiff (%d Fehler)", Tickerfehler);
	PRUEFE(Pokalspiele >= 1 && Pokalspiele <= 4, "Eigene Landespokalspiele: %d", Pokalspiele);
	PRUEFE(!W.Landespokal.Winner.IsEmpty() && !W.DfbPokal.Winner.IsEmpty(), "Beide Pokale haben einen Sieger");
	PRUEFE(W.Landespokal.Alive.Num() == 1 && W.DfbPokal.Alive.Num() == 1, "Am Ende bleibt je ein Verein");
	std::printf("  Landespokal: %s, DFB-Pokal: %s, eigene Pokalspiele %d\n", *W.Landespokal.Winner, *W.DfbPokal.Winner, Pokalspiele);

	// Landespokalsieg bringt den DFB-Pokal der nächsten Saison
	int Versuche = 0;
	bool bGeschafft = false;
	for (int32 Seed = 100; Seed < 160 && !bGeschafft; ++Seed)
	{
		FFM13World V;
		V.NewGame(TEXT("Pokalteam"), Seed);
		for (FFM13Player& P : V.Squad) P.Strength = 60; // klar stärker als die Unterklassen
		while (V.PlayMatchday()) {}
		++Versuche;
		if (V.Landespokal.Winner == V.ClubName)
		{
			PRUEFE(V.bDfbViaLandespokal, "Landespokalsieger merkt sich den DFB-Startplatz");
			const int64 Vorher = V.Money;
			V.ConcludeSeason();
			PRUEFE(V.DfbPokal.bOwnEntered && V.DfbPokal.Alive.Contains(V.ClubName), "Naechste Saison im DFB-Pokal");
			PRUEFE(!V.bDfbViaLandespokal, "Startplatz eingeloest");
			(void)Vorher;
			bGeschafft = true;
		}
	}
	PRUEFE(bGeschafft, "Ein starkes Team gewinnt den Landespokal (%d Versuche)", Versuche);

	// Ab der 3. Liga direkt im DFB-Pokal
	FFM13World D;
	D.NewGame(TEXT("Drittligist"), 7, 2);
	PRUEFE(D.DfbPokal.bOwnEntered && D.DfbPokal.Alive.Num() == 32, "3. Liga: direkt im DFB-Pokal mit 32 Vereinen");
	PRUEFE(!D.Landespokal.bOwnEntered && D.Landespokal.IsFinished(), "3. Liga: kein Landespokal");
	bool bPraemie = false;
	while (D.PlayMatchday()) {}
	for (const FFM13Booking& B : D.Bookings) if (B.Label.Contains(TEXT("DFB-Pokal: Praemie"))) bPraemie = true;
	PRUEFE(bPraemie || !D.DfbPokal.bOwnAlive, "Weiterkommen bringt Praemie");
}

static void TestBrowserImport()
{
	std::printf("Import echter Spielstaende des Browserspiels (tests/fixtures/saves)\n");
	const std::string Ordner = "../../../tests/fixtures/saves/";
	DIR* D = opendir(Ordner.c_str());
	PRUEFE(D != nullptr, "Ordner mit Spielstaenden gefunden");
	if (!D) return;
	std::vector<std::string> Dateien;
	while (dirent* E = readdir(D)) { std::string N = E->d_name; if (N.size() > 5 && N.substr(N.size() - 5) == ".json") Dateien.push_back(N); }
	closedir(D);
	std::sort(Dateien.begin(), Dateien.end());
	PRUEFE(Dateien.size() >= 5, "Mindestens 5 Spielstaende (%d)", (int)Dateien.size());
	for (const std::string& Name : Dateien)
	{
		std::ifstream F(Ordner + Name, std::ios::binary);
		std::stringstream B; B << F.rdbuf();
		FFM13World W;
		FString Fehler;
		TArray<FString> Hinweise;
		const bool bOk = FM13BrowserImport::Import(FString(B.str()), W, Fehler, Hinweise, 5);
		PRUEFE(bOk, "%s importiert (%s)", Name.c_str(), *Fehler);
		if (!bOk) continue;
		// Kennzahlen gegen die Datei (per Node gelesen wäre doppelt; hier Plausibilität und Konsistenz)
		PRUEFE(W.Leagues.Num() == 6 && W.OwnLeague().FindOwn() >= 0, "%s: 6 Ligen, eigener Verein gefunden", Name.c_str());
		int Eigene = 0;
		for (const FFM13League& L : W.Leagues)
		{
			PRUEFE(L.Clubs.Num() == 18 && L.MatchdayCount() == 34 && L.Fixtures.Num() == 306, "%s: Liga %d vollstaendig", Name.c_str(), L.Level);
			for (const FFM13Club& C : L.Clubs) if (C.bOwn) ++Eigene;
			// Tabelle passt zu den gespielten Partien
			int Gespielt = 0; for (const FFM13Fixture& Fx : L.Fixtures) if (Fx.bPlayed) ++Gespielt;
			int Summe = 0; for (const FFM13Club& C : L.Clubs) Summe += C.Played;
			PRUEFE(Summe == Gespielt * 2, "%s: Liga %d Tabelle %d = 2 x %d Spiele", Name.c_str(), L.Level, Summe, Gespielt);
		}
		PRUEFE(Eigene == 1, "%s: genau ein eigener Verein", Name.c_str());
		PRUEFE(W.Squad.Num() >= 11 && W.StadiumCapacity >= 500, "%s: Kader und Stadion", Name.c_str());
		// Gleiche Namen und Zahlen wie in der Datei
		PRUEFE(B.str().find("\"clubName\":\"" + W.ClubName.S + "\"") != std::string::npos, "%s: Vereinsname", Name.c_str());
		PRUEFE(B.str().find(W.Squad[0].Name.S) != std::string::npos, "%s: Spielername %s", Name.c_str(), *W.Squad[0].Name);
		if (Name == "karriere-liga4-v3.104-s3.json")
		{
			PRUEFE(W.Records.BiggestWinFor == 5 && W.Records.BiggestWinOpponent == FString(TEXT("Viktoria Berlien")) && W.Records.RecordAttendance == 6980, "%s: Rekorde uebernommen", Name.c_str());
			PRUEFE(W.Achievements.Num() == 2 && W.Sponsor.MatchdaysLeft == 0, "%s: Erfolge und Sponsorlage uebernommen", Name.c_str());
		}
		// Weiterspielen und speichern
		FFM13World Kopie;
		FString F2;
		PRUEFE(FM13Save::Decode(FM13Save::Encode(W), Kopie, F2), "%s: als Unreal-Spielstand speicherbar (%s)", Name.c_str(), *F2);
		int Tage = 0;
		while (!W.bSacked && Tage < 40) { if (!W.PlayMatchday()) { if (W.IsSeasonFinished()) W.ConcludeSeason(); else break; } ++Tage; }
		PRUEFE(W.bSacked || Tage == 40, "%s: 40 Spieltage weitergespielt (%d)", Name.c_str(), Tage);
		std::printf("  %-36s %s S%d/%d %s, Konto %lld, %d Spieler, %d Talente, Stadion %d%s\n", Name.c_str(), *W.ClubName, Kopie.Season, FMath::Min(Kopie.Matchday, 34),
			FM13::LeagueName(Kopie.LeagueLevel), (long long)Kopie.Money, Kopie.Squad.Num(), Kopie.YouthTalents.Num(), Kopie.StadiumCapacity, Kopie.bSacked ? ", entlassen" : "");
	}
	// Fremde Dateien werden abgelehnt
	FFM13World X; FString Fehler; TArray<FString> H;
	PRUEFE(!FM13BrowserImport::Import(TEXT("{\"foo\":1}"), X, Fehler, H) && Fehler.Contains(TEXT("kein exportierter")), "Fremdes JSON abgelehnt");
	PRUEFE(!FM13BrowserImport::Import(TEXT("{kaputt"), X, Fehler, H), "Kaputtes JSON abgelehnt");
}

static void TestRundeA()
{
	std::printf("Runde A: Taktik, Wetter, Schiedsrichter, Karten, Sponsor, Angebote, Entwicklung, Erfolge, Relegation\n");
	// Spielstil-Boni wie getTacticStyleBonus(): round(((tempo-50)+(press-50))/25)
	PRUEFE(FM13Tactics::StyleBonus(TEXT("pressing")) == 2 && FM13Tactics::StyleBonus(TEXT("defensiv")) == -2 && FM13Tactics::StyleBonus(TEXT("konter")) == 0
		&& FM13Tactics::StyleBonus(TEXT("kickrush")) == 2 && FM13Tactics::StyleBonus(TEXT("umschaltspiel")) == 1 && FM13Tactics::StyleBonus(TEXT("ballbesitz")) == 0, "Spielstil-Boni");
	PRUEFE(std::fabs(FM13Tactics::StyleFitnessMultiplier(TEXT("pressing")) - 1.14f) < 1e-4f, "Pressing kostet 14 Prozent mehr Kraft");
	PRUEFE(std::fabs(FM13Tactics::FormationOffBonus(TEXT("3-4-3")) - 0.72f) < 1e-4f && std::fabs(FM13Tactics::FormationDefBonus(TEXT("5-4-1")) - 1.12f) < 1e-4f, "Formationsboni");
	// Schere-Stein-Papier: Pressing > Ballbesitz > Konter > Pressing
	PRUEFE(FM13Tactics::MatchupBonus(TEXT("pressing"), TEXT('B')) == 2 && FM13Tactics::MatchupBonus(TEXT("pressing"), TEXT('K')) == -2
		&& FM13Tactics::MatchupBonus(TEXT("ausgeglichen"), TEXT('P')) == 0 && FM13Tactics::MatchupBonus(TEXT("ballbesitz"), TEXT('K')) == 2, "Taktik-Duell");
	PRUEFE(FM13Tactics::PredictableArchetype({ TEXT("pressing"), TEXT("offensiv"), TEXT("defensiv"), TEXT("umschaltspiel") }) == TEXT('P'), "Berechenbar: 3x Pressing-Ansatz");
	PRUEFE(FM13Tactics::PredictableArchetype({ TEXT("pressing"), TEXT("defensiv"), TEXT("ballbesitz") }) == 0, "Nicht berechenbar");
	PRUEFE(FM13Tactics::CounterTo(TEXT('P')) == TEXT('K'), "Konter schlaegt Pressing");

	// Entwicklungstypen wie getDevelopmentRange()
	int32 Mi = 0, Ma = 0;
	FM13Dev::DevelopmentRange(20, 0, Mi, Ma); PRUEFE(Mi == 1 && Ma == 2, "Konstanter Profi mit 20: +1 bis +2 (%d..%d)", Mi, Ma);
	FM13Dev::DevelopmentRange(29, 0, Mi, Ma); PRUEFE(Mi == 0 && Ma == 0, "Am Hoehepunkt keine Aenderung");
	FM13Dev::DevelopmentRange(32, 0, Mi, Ma); PRUEFE(Mi == -2 && Ma == -1, "Konstanter Profi mit 32: -2 bis -1 (%d..%d)", Mi, Ma);
	FM13Dev::DevelopmentRange(20, 3, Mi, Ma); PRUEFE(Mi == 1 && Ma == 4, "Wunderkind mit 20: +1 bis +4 (%d..%d)", Mi, Ma);
	int32 Typen[5] = { 0, 0, 0, 0, 0 };
	for (int32 Id = 1; Id <= 5000; ++Id) Typen[FM13Dev::ArchetypeFor(Id)]++;
	PRUEFE(Typen[0] > 1500 && Typen[0] < 2500 && Typen[3] > 200 && Typen[3] < 700, "Typen etwa nach Gewicht verteilt (%d %d %d %d %d)", Typen[0], Typen[1], Typen[2], Typen[3], Typen[4]);

	// Wetter und Schiedsrichter
	FRandomStream Rng(3);
	int32 Wetter[6] = { 0, 0, 0, 0, 0, 0 };
	for (int32 i = 0; i < 10000; ++i) Wetter[FM13Match::RollWeather(Rng)]++;
	PRUEFE(Wetter[0] > 3000 && Wetter[0] < 4000 && Wetter[5] > 150 && Wetter[5] < 450, "Wetter nach Gewicht (Sonne %d, Sturm %d)", Wetter[0], Wetter[5]);
	PRUEFE(FString(FM13Match::RefereeFor(2, 5, 5, 19).Name) == FString(FM13Match::RefereeFor(2, 5, 5, 19).Name), "Schiedsrichter fest angesetzt");
	for (int32 L = 0; L < 6; ++L) { const FM13Match::FReferee& Ref = FM13Match::RefereeFor(1, 7, L, 10); PRUEFE(L >= Ref.MinLeague && L <= Ref.MaxLeague, "Schiedsrichter pfeift in seiner Liga"); }

	// Formation bestimmt die Startelf
	FFM13World W;
	W.NewGame(TEXT("Taktikverein"), 8);
	FString Grund;
	PRUEFE(W.SetFormation(TEXT("4-3-3"), Grund) && W.Formation == FString(TEXT("4-3-3")), "Formation setzen");
	PRUEFE(!W.SetFormation(TEXT("2-2-6"), Grund) && !Grund.IsEmpty(), "Unbekannte Formation abgelehnt");
	int32 St = 0;
	for (int32 Id : W.StartingEleven()) if (W.FindPlayer(Id)->Pos == EFM13Position::ST) ++St;
	PRUEFE(St == 3, "4-3-3 stellt 3 Stuermer auf (%d)", St);
	PRUEFE(W.SetTacticStyle(TEXT("pressing"), Grund) && std::fabs(W.OwnMatchStrengthExact(TEXT('B'), true) - W.OwnMatchStrengthExact(TEXT('N'), true) - 2.0) < 1e-9, "Pressing gegen Ballbesitz: Taktik-Duell +2");
	PRUEFE(W.NextLeagueOpponent() != nullptr && W.OppPlanArchetype != 0, "Gegnerplan fuer das naechste Ligaspiel");

	// Gesperrte und Verletzte spielen nicht; Karten im Spiel
	W.Squad[0].SuspendedMatchdays = 2;
	PRUEFE(!W.StartingEleven().Contains(W.Squad[0].Id), "Gesperrter Spieler nicht in der Startelf");
	int32 Gelb = 0, Rot = 0, WetterGesehen = 0;
	for (int32 i = 0; i < 34; ++i)
	{
		W.PlayMatchday();
		for (const FString& Z : W.LastReport.Ticker) { if (Z.Contains(TEXT("Gelbe Karte"))) ++Gelb; if (Z.Contains(TEXT("ROTE KARTE"))) ++Rot; if (Z.Contains(TEXT("Wetter:"))) ++WetterGesehen; }
	}
	PRUEFE(Gelb > 20 && Gelb < 140, "Gelbe Karten in einer Saison: %d", Gelb);
	PRUEFE(WetterGesehen == 34, "Wetter und Schiedsrichter im Ticker (%d)", WetterGesehen);
	std::printf("  Saison mit 4-3-3 Pressing: %d Gelbe, %d Rote\n", Gelb, Rot);

	// Sponsor: Startvertrag 34 Spieltage, danach Angebote; Wechsel nur kurz vor Ende
	PRUEFE(W.Sponsor.Name == FString(TEXT("Kein Hauptsponsor")) && W.SponsorOffers.Num() == 3, "Nach 34 Spieltagen: Vertrag aus, drei Angebote (%s, %d)", *W.Sponsor.Name, W.SponsorOffers.Num());
	const FFM13Sponsor Lang = W.SponsorOffers[2];
	const int64 Vorher = W.Money;
	PRUEFE(W.AcceptSponsorOffer(2, Grund) && W.Sponsor.Name == Lang.Name && W.Sponsor.MatchdaysLeft == 68 && W.Money == Vorher + Lang.SignOn, "Langer Vertrag mit Handgeld");
	PRUEFE(Lang.Base >= 1500 && Lang.Base <= 4100, "Grundbetrag in der 6. Liga im Rahmen (%d)", Lang.Base);
	W.SponsorOffers.Add(Lang);
	PRUEFE(!W.AcceptSponsorOffer(0, Grund) && Grund.Contains(TEXT("laeuft noch")), "Laufender Vertrag laesst keinen Wechsel zu");

	// Angebote für eigene Spieler
	FFM13IncomingOffer O;
	O.PlayerId = W.Squad[3].Id; O.PlayerName = W.Squad[3].Name; O.Club = TEXT("Testclub"); O.Price = 777000; O.ExpiresMatchday = 99;
	W.IncomingOffers.Add(O);
	const int32 Kader = W.Squad.Num();
	const int64 Geld = W.Money;
	PRUEFE(W.AcceptIncomingOffer(W.IncomingOffers.Num() - 1, Grund) && W.Squad.Num() == Kader - 1 && W.Money == Geld + 777000, "Angebot angenommen (%s)", *Grund);
	PRUEFE(W.Records.RecordTransferFee >= 777000, "Rekordablöse gemerkt");

	// Erfolge und Rekorde
	W.Money = 2000000;
	W.ConcludeSeason(); // Saison 1 ist vorbei: Abschluss prüft die Erfolge
	W.PlayMatchday();
	PRUEFE(W.Achievements.ContainsByPredicate([](const FFM13Achievement& A) { return A.Id == FString(TEXT("millionaer")); }), "Erfolg Millionaer");
	PRUEFE(FFM13World::AchievementCount() == 15 && FFM13World::AchievementLabel(TEXT("meister")).Contains(TEXT("Meister")), "Erfolgsliste");
	PRUEFE(W.Records.LongestUnbeatenStreak >= W.Records.UnbeatenStreak, "Serie ohne Niederlage gefuehrt");

	// Saisonende: Entwicklung, Legenden, Relegation
	FFM13World V;
	V.NewGame(TEXT("Legendenverein"), 12);
	V.Squad[0].Age = 37; V.Squad[0].SeasonsAtClub = 6; V.Squad[0].GoalsCareer = 12;
	const FString LegName = V.Squad[0].Name;
	while (V.PlayMatchday()) {}
	TArray<int32> VorherIds;
	for (const FFM13Player& P : V.Squad) VorherIds.Add(P.Id);
	const FFM13SeasonSummary S = V.ConcludeSeason();
	PRUEFE(V.Legends.Num() >= 1 && V.Legends[0].Name == LegName && S.NewLegends.Contains(LegName), "Vereinslegende beim Karriereende");
	int32 Falsch = 0;
	for (const FFM13Player& P : V.Squad) if (VorherIds.Contains(P.Id) && P.SeasonsAtClub < 1) ++Falsch;
	PRUEFE(Falsch == 0, "Saisons im Verein werden gezaehlt (%d ohne Zaehlung)", Falsch);

	// Relegation: Platz 16 bzw. 3 spielen zwei Partien
	int32 Relegationen = 0, Gewonnen = 0;
	for (int32 Seed = 200; Seed < 260; ++Seed)
	{
		FFM13World X;
		X.NewGame(TEXT("Relegationsverein"), Seed, 3);
		while (X.PlayMatchday()) {}
		const int32 Platz = X.OwnRank();
		const int32 Liga = X.LeagueLevel;
		const FFM13SeasonSummary T = X.ConcludeSeason();
		if (Platz == 16 || Platz == 3)
		{
			++Relegationen;
			PRUEFE(T.Relegation.bPlayed && T.Relegation.bForPromotion == (Platz == 3), "Relegation bei Platz %d", Platz);
			if (T.Relegation.bWon) ++Gewonnen;
			if (Platz == 16) PRUEFE(X.LeagueLevel == (T.Relegation.bWon ? Liga : Liga + 1), "Platz 16: Klassenerhalt nur mit Sieg");
			if (Platz == 3) PRUEFE(X.LeagueLevel == (T.Relegation.bWon ? Liga - 1 : Liga), "Platz 3: Aufstieg nur mit Sieg");
		}
		else PRUEFE(!T.Relegation.bPlayed, "Keine Relegation auf Platz %d", Platz);
	}
	PRUEFE(Relegationen >= 3, "Relegation kommt vor (%d von 60)", Relegationen);
	std::printf("  Relegation: %d gespielt, %d gewonnen\n", Relegationen, Gewonnen);

	// Spielstand behält alles
	const FString Text = FM13Save::Encode(W);
	FFM13World L;
	FString F;
	PRUEFE(FM13Save::Decode(Text, L, F) && FM13Save::Encode(L) == Text, "Spielstand mit Taktik, Sponsor, Angeboten, Erfolgen (%s)", *F);
	PRUEFE(L.Formation == W.Formation && L.Sponsor.Name == W.Sponsor.Name && L.Achievements.Num() == W.Achievements.Num(), "Neue Felder nach dem Laden");
}

// Teamstaerke gegen calcTeamStrength() des Browserspiels (ReferenzStaerke.h aus referenz-staerke.js)
static void TestTeamstaerke()
{
	std::printf("Teamstaerke: calcTeamStrength und pickBestLineupIds gegen das Browserspiel\n");
	int32 Gleich = 0, Faelle = 0;
	for (const FRefStaerke& Ref : RefStaerke)
	{
		FM13Strength::FEingabe E;
		for (int32 i = 0; i < 11; ++i)
		{
			FM13Strength::FSpieler S;
			S.Strength = Ref.Spieler[i][0]; S.Fitness = Ref.Spieler[i][1]; S.DailyForm = Ref.Spieler[i][2]; S.Morale = Ref.Spieler[i][3]; S.Age = Ref.Spieler[i][4];
			S.Pos = (EFM13Position)Ref.Spieler[i][5]; S.Trait = (uint8)Ref.Spieler[i][6]; S.bCaptain = i == Ref.Kapitaen;
			E.Elf.Add(S);
		}
		const int32* X = Ref.X;
		static const int32 Lizenz[4] = { 0, 1, 2, 4 };
		E.bHome = X[0] != 0; E.LicenseBoost = Lizenz[X[1]]; E.Fans = X[2]; E.ChemistryBonus = FM13Strength::ChemistryBonus(X[3] * 55, 55);
		E.bTactician = X[4] != 0; E.WeatherGoalMult = FM13Match::Weathers()[X[5]].GoalMult; E.Stress = X[6];
		E.TeamTraining = RefTraining[X[7]]; E.StyleBonus = FM13Tactics::StyleBonus(RefStile[X[8]]);
		E.FormationOff = (FM13Tactics::Formation(RefFormationen[X[9]]).Off - 60) * 0.04; E.TackleHardness = RefHaerte[X[10]]; E.TrainingGround = X[11];
		const int32* Co = X + 12; const int32* Gk = X + 16; const int32* An = X + 20; const int32* Nu = X + 24;
		E.bCoTrainer = Co[0] != 0; E.CoTrainerLevel = Co[1]; E.CoTrainerWirkung = Co[2] >= 70 ? 1.0 : (Co[2] >= 40 ? 0.85 : 0.65);
		E.bGreenkeeper = Gk[0] != 0; E.GreenkeeperLevel = Gk[1]; E.bGreenkeeperTempo = Gk[3] != 0;
		E.bAnalystTiefe = An[0] != 0 && An[3] != 0; E.AnalystLevel = An[1];
		E.bErnaehrungLeistung = Nu[0] != 0 && Nu[3] != 0; E.ErnaehrungLevel = Nu[1];
		E.bSynergie = Co[0] != 0 && An[0] != 0;
		const int32 Wert = FM13Strength::Team(E);
		++Faelle;
		if (Wert == Ref.Erwartet) ++Gleich;
		PRUEFE(Wert == Ref.Erwartet, "Teamstaerke Fall %d: %d statt %d", Faelle, Wert, Ref.Erwartet);
	}
	std::printf("  %d von %d Teamstaerken gleich\n", Gleich, Faelle);

	// Automatische Aufstellung: dieselben elf Spieler wie pickBestLineupIds()
	int32 ElfGleich = 0, ElfFaelle = 0;
	for (const FRefElf& Ref : RefElf)
	{
		FFM13World W;
		W.NewGame(TEXT("Aufstellverein"), 5);
		W.Squad.Reset();
		W.ManualLineup.Reset();
		for (int32 i = 0; i < Ref.Anzahl; ++i)
		{
			FFM13Player P;
			P.Id = i + 1; P.Strength = Ref.Spieler[i][0]; P.Fitness = Ref.Spieler[i][1]; P.Pos = (EFM13Position)Ref.Spieler[i][2];
			P.InjuredMatchdays = Ref.Spieler[i][3]; P.SuspendedMatchdays = Ref.Spieler[i][4];
			W.Squad.Add(P);
		}
		FString Grund;
		W.SetFormation(RefFormationen[Ref.Formation], Grund);
		TArray<int32> Ids = W.StartingEleven();
		Ids.Sort([](int32 A, int32 B) { return A < B; });
		bool bGleich = Ids.Num() == Ref.AnzahlElf;
		for (int32 i = 0; bGleich && i < Ids.Num(); ++i) if (Ids[i] != Ref.Elf[i] + 1) bGleich = false;
		++ElfFaelle;
		if (bGleich) ++ElfGleich;
		PRUEFE(bGleich, "Aufstellung Fall %d weicht ab", ElfFaelle);
	}
	std::printf("  %d von %d Aufstellungen gleich\n", ElfGleich, ElfFaelle);

	// Noten: computePlayerGrade() des Browserspiels
	int32 NotenGleich = 0, NotenFaelle = 0;
	for (const auto& N : RefNoten)
	{
		const int32 Note = FM13Strength::Grade(N[0], N[1], N[2], N[3], N[4], (EFM13Position)N[5], N[6] / 1000.0);
		++NotenFaelle;
		if (Note == N[7]) ++NotenGleich;
		PRUEFE(Note == N[7], "Note Fall %d: %d statt %d", NotenFaelle, Note, N[7]);
	}
	std::printf("  %d von %d Noten gleich\n", NotenGleich, NotenFaelle);
	PRUEFE(FM13Strength::ScorerWeight(EFM13Position::ST, 0) == 50 && FM13Strength::ScorerWeight(EFM13Position::TW, 0) == 2
		&& FM13Strength::ScorerWeight(EFM13Position::ABW, FM13Strength::Eisenfuss) == 40 && FM13Strength::AssistWeight(EFM13Position::MIT) == 40, "Gewichte fuer Torschuetzen und Vorlagen");

	// Kapitaen, Eingespieltheit, Heimvorteil und Aufstiegseuphorie in der Spielwelt
	FFM13World W;
	W.NewGame(TEXT("Staerkeverein"), 33);
	PRUEFE(W.CaptainId == 0 && W.LineupChemistry() == 0, "Vor dem ersten Spiel: kein Kapitaen, keine Eingespieltheit");
	bool bMoral80 = true;
	for (const FFM13Player& P : W.Squad) if (P.Morale != 80 || P.Fitness != 100 || P.Trait > 8) bMoral80 = false;
	PRUEFE(bMoral80, "Neue Spieler: Moral 80, Kondition 100, gueltiger Trait");
	PRUEFE(W.TeamStrength(true) - W.TeamStrength(false) >= 1 && W.TeamStrength(true) - W.TeamStrength(false) <= 3, "Heimvorteil +3 gegen Auswaertsfans bis +1,5");
	W.PlayMatchday();
	PRUEFE(W.FindPlayer(W.CaptainId) != nullptr, "Nach dem ersten Spieltag traegt jemand die Binde");
	PRUEFE(W.PairA.Num() == 55 && W.PairValue[0] == 1, "Eingespieltheit: 55 Paare mit je einem Punkt");
	for (int32& V : W.PairValue) V = 30;
	for (FFM13Player& P : W.Squad) { P.InjuredMatchdays = 0; P.SuspendedMatchdays = 0; }
	W.ManualLineup.Reset();
	for (int32 k = 0; k < W.PairA.Num() && W.ManualLineup.Num() < 11; ++k) { W.ManualLineup.AddUnique(W.PairA[k]); W.ManualLineup.AddUnique(W.PairB[k]); }
	PRUEFE(W.LineupChemistry() == 3, "Volle Eingespieltheit: +3 (%d)", W.LineupChemistry());
	W.PromotionBoostLevel = W.LeagueLevel; W.PromotionBoostSeason = W.Season;
	W.Matchday = 10; PRUEFE(W.PromotionEuphoria() == 3.0, "Aufstiegseuphorie bis Spieltag 10: +3");
	W.Matchday = 17; PRUEFE(W.PromotionEuphoria() == 1.5, "Aufstiegseuphorie bis Spieltag 17: +1,5");
	W.Matchday = 18; PRUEFE(W.PromotionEuphoria() == 0.0, "Aufstiegseuphorie danach: 0");
	W.PromotionBoostSeason = W.Season + 1; W.Matchday = 5; PRUEFE(W.PromotionEuphoria() == 0.0, "Aufstiegseuphorie nur in der Saison nach dem Aufstieg");
	// Kapitaen faellt aus: der Spieler mit der groessten Fuehrungsqualitaet uebernimmt
	FFM13World K;
	K.NewGame(TEXT("Kapitaensverein"), 34);
	for (FFM13Player& P : K.Squad) { P.Trait = 0; P.Age = 24; P.Morale = 60; P.AppearancesTotal = 0; }
	K.Squad[5].Trait = FM13Strength::Leader;
	K.PlayMatchday();
	PRUEFE(K.CaptainId == K.Squad[5].Id, "Der Leader wird Kapitaen");
	for (FFM13Player& P : K.Squad) P.InjuredMatchdays = 0;
	K.Squad[5].InjuredMatchdays = 3; K.Squad[2].Age = 34;
	K.PlayMatchday();
	PRUEFE(K.CaptainId == K.Squad[2].Id, "Verletzter Kapitaen: der Erfahrenste uebernimmt");
	std::printf("\n");
}

// Kondition und Tagesform (js/match-live.js): Werte von Hand nach den JS-Regeln gerechnet
static void TestKondition()
{
	std::printf("Kondition: Kraftverlust, Erholung, Tagesform\n");
	using namespace FM13Fitness;
	FKraftEingabe E;
	PRUEFE(Verlust(E) == 9, "Grundverlust 9 zu Hause");
	FKraftEingabe Gut = E; Gut.bFitnessGuru = true;
	PRUEFE(Verlust(Gut) == 6, "Fitnessguru: 6");
	FKraftEingabe Hart = E; Hart.Intensitaet = TEXT("hart");
	PRUEFE(Verlust(Hart) == 11, "Intensitaet hart: round(9 x 1,25) = 11");
	FKraftEingabe Locker = E; Locker.Intensitaet = TEXT("locker");
	PRUEFE(Verlust(Locker) == 7, "Intensitaet locker: round(6,75) = 7");
	FKraftEingabe Erh = E; Erh.Teamtraining = TEXT("erholung");
	PRUEFE(Verlust(Erh) == 7, "Erholungsschwerpunkt: 9 - 2 = 7");
	FKraftEingabe Press = E; Press.Tempo = 68; Press.Pressing = 88;
	PRUEFE(Verlust(Press) == 10, "Pressing 68/88: round(9 x 1,14) = 10");
	FKraftEingabe Hitze = E; Hitze.WetterFaktor = 1.25;
	PRUEFE(Verlust(Hitze) == 11, "Hitze: round(9 x 1,25) = 11");
	FKraftEingabe Auswaerts = E; Auswaerts.bAuswaerts = true;
	PRUEFE(Verlust(Auswaerts) == 12, "Auswaerts oberste Liga: 9 + 3");
	Auswaerts.LigaStufe = 2;
	PRUEFE(Verlust(Auswaerts) == 9, "Auswaerts tiefere Liga: keine Reisemuedigkeit");
	FKraftEingabe Bus = E; Bus.bAuswaerts = true; Bus.bBus = true;
	PRUEFE(Verlust(Bus) == 15, "Bus ohne Sponsor: 9 + round(3 x 2) = 15");
	Bus.bBusSponsor = true;
	PRUEFE(Verlust(Bus) == 14, "Bus mit Hauptsponsor: 9 + round(4,5) = 14");
	Bus.bBusBanden = true;
	PRUEFE(Verlust(Bus) == 14, "Bus mit Bandensponsor: 9 + round(5,25) = 14");
	FKraftEingabe Alles = E; Alles.Intensitaet = TEXT("hart"); Alles.Tempo = 68; Alles.Pressing = 88; Alles.WetterFaktor = 1.25; Alles.bAuswaerts = true;
	PRUEFE(Verlust(Alles) == 19, "Hart, Pressing, Hitze, auswaerts: 11, 13, 16, +3 = 19");

	// Personal und Perk (js/match-live.js: Athletik 0,7, Ernaehrung, Physio, Greenkeeper; Perk Fitness-Guru)
	FKraftEingabe Athletik = E; Athletik.bAthletiktrainer = true;
	PRUEFE(Verlust(Athletik) == 6, "Athletiktrainer: round(9 x 0,7) = 6");
	FKraftEingabe Ernaehr = E; Ernaehr.bErnaehrung = true; Ernaehr.ErnaehrungStufe = 1;
	PRUEFE(Verlust(Ernaehr) == 8, "Ernaehrung Stufe 1 Standard: round(9 x 0,88) = 8");
	Ernaehr.bErnaehrungLeistung = true;
	PRUEFE(Verlust(Ernaehr) == 9, "Ernaehrung Leistungskueche Stufe 1: round(9 x 0,96) = 9");
	Ernaehr.ErnaehrungStufe = 3; Ernaehr.bErnaehrungLeistung = false;
	PRUEFE(Verlust(Ernaehr) == 7, "Ernaehrung Standard Stufe 3: round(9 x 0,80) = 7");
	FKraftEingabe Phys = E; Phys.bPhysio = true; Phys.bPhysioBelastung = true;
	PRUEFE(Verlust(Phys) == 8, "Physio Belastungssteuerung: round(8,1) = 8");
	FKraftEingabe Green = E; Green.bGreenkeeper = true; Green.bGreenkeeperTempo = true;
	PRUEFE(Verlust(Green) == 10, "Greenkeeper Tempo zu Hause: round(9,9) = 10");
	Green.bAuswaerts = true;
	PRUEFE(Verlust(Green) == 12, "Greenkeeper wirkt nicht auswaerts: 9 + 3 = 12");
	FKraftEingabe Guru = E; Guru.bFitnessGuru = true; Guru.bAthletiktrainer = true;
	PRUEFE(Verlust(Guru) == 4, "Fitness-Guru und Athletik: round(6 x 0,7) = 4");
	PRUEFE(Erholung(TEXT("kondition")) == 31 && Erholung(TEXT("ausgeglichen")) == 26, "Erholung der Bank 31 oder 26");
	PRUEFE(NachSpiel(100, true, 9, TEXT("ausgeglichen")) == 98, "Startelf 100 - 9 + round(6,5) = 98");
	PRUEFE(NachSpiel(100, true, 9, TEXT("kondition")) == 99, "Kondition: 100 - 9 + round(7,75) = 99");
	PRUEFE(NachSpiel(12, true, 20, TEXT("ausgeglichen")) == 10, "Startelf sinkt nicht unter 10");
	PRUEFE(NachSpiel(80, false, 9, TEXT("ausgeglichen")) == 100, "Bank erholt sich bis 100");
	PRUEFE(NachSpiel(50, false, 9, TEXT("ausgeglichen")) == 76, "Bank 50 + 26 = 76");

	PRUEFE(Tagesform(65, 100, 0.0) == 54, "Tagesform Moral 65, Kondition 100: 50 + 4,25 = 54");
	PRUEFE(Tagesform(65, 100, -20.0) == 34, "Tagesform mit Zufall -20: 34");
	PRUEFE(Tagesform(65, 100, 20.0) == 74, "Tagesform mit Zufall +20: 74");
	PRUEFE(Tagesform(5, 10, -20.0) == 16, "Tagesform schwach: 16");
	std::printf("\n");
}

// Wochenplan, Kraftverlust und Verletzungswurf gegen die Rechnung des Browserspiels (ReferenzStaerke.h)
static void TestTrainingReferenz()
{
	std::printf("Training: Wochenplan, Kraftverlust und Verletzungswurf gegen das Browserspiel\n");
	int32 Gleich = 0, Faelle = 0;
	for (const auto& R : RefWochen)
	{
		TArray<FString> Plan;
		for (int32 T = 0; T < 7; ++T) Plan.Add(RefEinheiten[R[T]]);
		const FM13Fitness::FWoche W = FM13Fitness::Woche(Plan);
		const bool b = W.Load == R[7] && W.Frei == R[8] && W.Einheiten == R[9] && W.Risk == R[10] && W.Dominant == FString(RefEinheiten[R[11]]) && W.TeamTraining == FString(RefEinheiten[R[12]]);
		++Faelle; if (b) ++Gleich;
		PRUEFE(b, "Wochenplan Fall %d weicht ab (Risiko %d statt %d)", Faelle, W.Risk, R[10]);
	}
	std::printf("  %d von %d Wochenplaenen gleich\n", Gleich, Faelle);

	static const char* Intens[3] = { "normal", "hart", "locker" };
	Gleich = Faelle = 0;
	for (const auto& X : RefKraft)
	{
		FM13Fitness::FKraftEingabe E;
		E.bFitnessGuru = X[0] != 0; E.bAthletiktrainer = X[1] != 0; E.bErnaehrung = X[2] != 0; E.ErnaehrungStufe = X[3]; E.bErnaehrungLeistung = X[4] != 0;
		E.bPhysio = X[5] != 0; E.bPhysioBelastung = X[6] != 0; E.bGreenkeeper = X[7] != 0; E.bGreenkeeperTempo = X[8] != 0; E.bAuswaerts = X[9] == 0;
		E.Intensitaet = Intens[X[10]]; E.Teamtraining = RefTraining[X[11]];
		E.Tempo = FM13Tactics::Style(RefStile[X[12]]).Tempo; E.Pressing = FM13Tactics::Style(RefStile[X[12]]).Press;
		E.WetterFaktor = FM13Match::Weathers()[X[13]].FitLossMult; E.LigaStufe = X[14]; E.bBus = X[15] != 0; E.bBusSponsor = X[16] != 0; E.bBusBanden = X[17] != 0;
		const int32 V = FM13Fitness::Verlust(E);
		++Faelle; if (V == X[18]) ++Gleich;
		PRUEFE(V == X[18], "Kraftverlust Fall %d: %d statt %d", Faelle, V, X[18]);
	}
	std::printf("  %d von %d Kraftverlusten gleich\n", Gleich, Faelle);

	Gleich = Faelle = 0;
	for (const FRefVerletzung& R : RefVerletzung)
	{
		TArray<FString> Plan;
		for (int32 T = 0; T < 7; ++T) Plan.Add(RefEinheiten[R.Plan[T]]);
		const int32* X = R.X;
		FM13Fitness::FVerletzung E;
		E.Teamtraining = RefTraining[X[0]]; E.Wetter = FM13Match::Weathers()[X[1]].InjuryMult; E.Haerte = RefHaerte[X[2]]; E.Intensitaet = Intens[X[3]];
		E.WochenRisiko = FM13Fitness::Woche(Plan).Risk;
		const double Team = FM13Fitness::VerletzungTeam(E);
		const double Spieler = FM13Fitness::VerletzungSpieler(Team, X[4], X[5], X[6] != 0, E.Wetter, X[7] != 0);
		const int32 Dauer = FM13Fitness::VerletzungDauer(X[8], X[9], X[10] != 0);
		const bool b = std::fabs(Team - R.Team) < 1e-12 && std::fabs(Spieler - R.Spieler) < 1e-12 && Dauer == R.Dauer;
		++Faelle; if (b) ++Gleich;
		PRUEFE(b, "Verletzung Fall %d: Team %.6f statt %.6f, Spieler %.6f statt %.6f, Dauer %d statt %d", Faelle, Team, R.Team, Spieler, R.Spieler, Dauer, R.Dauer);
	}
	std::printf("  %d von %d Verletzungswuerfen gleich\n", Gleich, Faelle);

	// Wochenplan in der Spielwelt
	FFM13World W;
	W.NewGame(TEXT("Trainingsverein"), 61);
	FString Grund;
	PRUEFE(W.WeeklyPlan.Num() == 7 && W.TeamTraining == FString(TEXT("ausgeglichen")), "Startplan: fuenfmal ausgeglichen, Erholung, frei");
	PRUEFE(W.ApplyWeeklyTrainingPreset(TEXT("kondition"), Grund) && W.TeamTraining == FString(TEXT("kondition")), "Standardplan Kondition setzt das Teamtraining");
	PRUEFE(W.SetWeeklyTrainingDay(0, TEXT("taktik"), Grund) && W.SetWeeklyTrainingDay(1, TEXT("taktik"), Grund) && W.SetWeeklyTrainingDay(3, TEXT("taktik"), Grund)
		&& W.TeamTraining == FString(TEXT("taktik")), "Drei Taktik-Tage: Schwerpunkt Taktik");
	PRUEFE(!W.SetWeeklyTrainingDay(7, TEXT("taktik"), Grund) && !W.SetWeeklyTrainingDay(0, TEXT("yoga"), Grund) && !W.ApplyWeeklyTrainingPreset(TEXT("urlaub"), Grund), "Unbekannter Tag, Einheit oder Plan abgelehnt");
	PRUEFE(W.SetTrainingIntensity(TEXT("hart"), Grund) && !W.SetTrainingIntensity(TEXT("brutal"), Grund), "Intensitaet hart, unbekannte abgelehnt");
	const double Hart = W.InjuryChance();
	W.SetTrainingIntensity(TEXT("locker"), Grund);
	PRUEFE(W.InjuryChance() < Hart, "Lockeres Training senkt das Verletzungsrisiko");
	FFM13World L;
	FString Fehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(W), L, Fehler) && L.WeeklyPlan[0] == FString(TEXT("taktik")) && L.TrainingIntensity == FString(TEXT("locker")), "Wochenplan bleibt im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Personal (js/campus-staff.js). Die Werte sind von Hand nach den JS-Formeln gerechnet, nicht gegen die Originalfunktion ausgefuehrt.
static void TestPersonal()
{
	std::printf("Personal: Einstellen, Entlassen, Weiterbilden, Vertraege, Abwerbung, Ausfall\n");
	FString G;
	FFM13World W;
	W.NewGame(TEXT("Personalverein"), 71);
	W.Money = 500000;
	PRUEFE(W.StaffHire(0, 0, G) && W.Money == 458000 && W.CoTrainer.bHired && W.CoTrainer.Wage == 8000 && W.CoTrainer.Level == 1,
		"Guenstige Nachwuchskraft: 60000 x 0,7 = 42000 gezahlt");
	PRUEFE(std::fabs(W.CoTrainer.Morale - 60.0) < 1e-9 && W.CoTrainer.Contract == 34 && W.CoTrainer.HiredSeason == W.Season, "Startmoral 60, Vertrag 34, Saison notiert");
	PRUEFE(!W.StaffHire(0, 1, G) && G.Len() > 0, "Besetzte Stelle nicht noch einmal besetzen");

	FFM13World E;
	E.NewGame(TEXT("Elitenverein"), 72);
	E.Money = 500000;
	PRUEFE(E.StaffHire(0, 2, G) && E.Money == 404000 && E.CoTrainer.Level == 2 && std::fabs(E.CoTrainer.Morale - 95.0) < 1e-9,
		"Renommierte Fachkraft: 60000 x 1,6 = 96000, Stufe 2, Moral 95");

	FFM13World Arm;
	Arm.NewGame(TEXT("Armverein"), 73);
	Arm.Money = 1000;
	PRUEFE(!Arm.StaffHire(0, 1, G) && !Arm.CoTrainer.bHired && G.Contains(TEXT("Geld")), "Ohne Geld keine Einstellung");

	FFM13World Cap;
	Cap.NewGame(TEXT("Obergrenze"), 74);
	Cap.Money = 500000;
	Cap.WageBudgetCap = 10000;
	PRUEFE(Cap.StaffHire(0, 0, G), "Co-Trainer (8000) passt unter die Obergrenze 10000");
	PRUEFE(Cap.StaffHireBreaksCap(1) && !Cap.StaffHire(1, 0, G), "Athletik (6000) sprengt 10000 zusammen mit dem Co-Trainer (8000)");
	Cap.WageBudgetCap = 20000;
	PRUEFE(!Cap.StaffHireBreaksCap(1) && Cap.StaffHire(1, 0, G), "Obergrenze 20000: Athletik passt");

	// Entlassen: Abfindung Gehalt x Stufe
	FFM13World F;
	F.NewGame(TEXT("Entlassung"), 75);
	F.Money = 500000;
	F.StaffHire(0, 2, G);
	const int64 VorEntlassung = F.Money;
	PRUEFE(F.StaffFire(0, G) && F.Money == VorEntlassung - 16000 && !F.CoTrainer.bHired, "Entlassen zahlt Abfindung 8000 x Stufe 2 = 16000");

	// Weiterbildung: 60000 x 0,6 = 36000, Dauer round(36000/8000) = 5 Spieltage
	FFM13World U;
	U.NewGame(TEXT("Weiterbildung"), 76);
	U.Money = 500000;
	U.StaffHire(0, 1, G);
	PRUEFE(U.StaffUpgrade(0, G) && U.Money == 500000 - 60000 - 36000 && U.CoTrainer.UpgradeDays == 5, "Weiterbildung kostet 36000, dauert 5 Spieltage");
	PRUEFE(!U.StaffUpgrade(0, G), "Zweite Weiterbildung waehrend der laufenden nicht erlaubt");
	for (int32 k = 0; k < 5; ++k) U.TickStaff();
	PRUEFE(U.CoTrainer.Level == 2 && U.CoTrainer.UpgradeDays == 0, "Nach 5 Spieltagen Stufe 2");

	// Verlaengern: 60000 x 0,4 = 24000, Vertrag 34, Moral +10
	FFM13World V;
	V.NewGame(TEXT("Vertrag"), 77);
	V.Money = 500000;
	V.StaffHire(0, 1, G);
	V.CoTrainer.Contract = 3;
	const int64 VorVerl = V.Money;
	PRUEFE(V.StaffRenew(0, G) && V.Money == VorVerl - 24000 && V.CoTrainer.Contract == 34 && std::fabs(V.CoTrainer.Morale - 90.0) < 1e-9, "Verlaengern: 24000, Vertrag 34, Moral 80 + 10");

	// Gehaltserhoehung: 8000 x 5 = 40000, neues Gehalt round(8800), Moral +20
	FFM13World R;
	R.NewGame(TEXT("Gehalt"), 78);
	R.Money = 500000;
	R.StaffHire(0, 1, G);
	PRUEFE(R.StaffRaise(0, G) && R.CoTrainer.Wage == 8800 && R.Money == 500000 - 60000 - 40000 && std::fabs(R.CoTrainer.Morale - 100.0) < 1e-9,
		"Gehaltserhoehung: 40000, Gehalt 8800, Moral 80 + 20 (Hoechstwert 100)");

	// Moral sinkt um 0,3 je Spieltag, nicht unter 20; Vertrag laeuft aus
	FFM13World M;
	M.NewGame(TEXT("Moral"), 79);
	M.Money = 500000;
	M.StaffHire(0, 1, G);
	M.TickStaff();
	PRUEFE(std::fabs(M.CoTrainer.Morale - 79.7) < 1e-9, "Moral 80 nach einem Spieltag 79,7");
	M.CoTrainer.Contract = 1;
	M.TickStaff();
	PRUEFE(!M.CoTrainer.bHired, "Vertrag ausgelaufen: die Stelle ist frei");

	// Jahres-Meeting einmal je Saison
	FFM13World T;
	T.NewGame(TEXT("Meeting"), 80);
	T.Money = 500000;
	T.StaffHire(0, 1, G);
	PRUEFE(T.StaffMeeting(G) && std::fabs(T.CoTrainer.Morale - 88.0) < 1e-9 && !T.StaffMeeting(G), "Meeting: +8 Moral, nur einmal je Saison");

	// Abwerbung: Bindungspraemie Gehalt x 15 = 120000
	FFM13World A;
	A.NewGame(TEXT("Abwerbung"), 81);
	A.Money = 500000;
	A.StaffHire(0, 1, G);
	A.PoachSlot = 0; A.PoachRetention = A.CoTrainer.Wage * 15;
	PRUEFE(A.StaffResolvePoach(true, G) && A.CoTrainer.bHired && std::fabs(A.CoTrainer.Morale - 100.0) < 1e-9 && A.PoachSlot < 0, "Bindungspraemie: Moral 100, bleibt");
	A.PoachSlot = 0; A.PoachRetention = 120000;
	PRUEFE(A.StaffResolvePoach(false, G) && !A.CoTrainer.bHired, "Abwerbung ohne Zahlung: die Stelle ist frei");

	// Kurzfristiger Ausfall: Interims-Ersatz wie wage x 3
	FFM13World X;
	X.NewGame(TEXT("Ausfall"), 82);
	X.Money = 500000;
	X.StaffHire(0, 1, G);
	X.CoTrainer.OnLeave = 3;
	const int64 VorInterim = X.Money;
	PRUEFE(X.StaffInterim(0, G) && X.Money == VorInterim - 24000 && X.CoTrainer.bInterim, "Interims-Ersatz kostet Gehalt x 3 = 24000");
	for (int32 k = 0; k < 3; ++k) X.TickStaff();
	PRUEFE(X.CoTrainer.OnLeave == 0 && !X.CoTrainer.bInterim, "Nach drei Spieltagen ist der Ausfall vorbei");

	// Spielstand: Moral, Gehalt, Vertrag, Weiterbildung und Obergrenze bleiben erhalten
	FFM13World Sp;
	Sp.NewGame(TEXT("Spielstand"), 83);
	Sp.Money = 500000;
	Sp.StaffHire(1, 1, G);
	Sp.StaffRaise(1, G);
	Sp.StaffUpgrade(1, G);
	Sp.WageBudgetCap = 30000;
	Sp.LastMeetingSeason = 1;
	FFM13World Ld;
	FString Fehler;
	const bool bOk = FM13Save::Decode(FM13Save::Encode(Sp), Ld, Fehler);
	PRUEFE(bOk && Ld.AthletikTrainer.bHired && Ld.AthletikTrainer.Wage == 6600 && Ld.AthletikTrainer.UpgradeDays == Sp.AthletikTrainer.UpgradeDays
		&& std::fabs(Ld.AthletikTrainer.Morale - Sp.AthletikTrainer.Morale) < 1e-6 && Ld.WageBudgetCap == 30000 && Ld.LastMeetingSeason == 1,
		"Personal und Obergrenze bleiben im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Kabine (js/locker-room.js, js/team-council.js): Cliquen, Stimmung, Kapitaen, Rat, Freundschaften
static void TestKabine()
{
	std::printf("Kabine: Cliquen, Fuehrung, Kapitaen, Mannschaftsrat, Freundschaften\n");
	PRUEFE(FM13Locker::NationFromRoll(0) == 0 && FM13Locker::NationFromRoll(4) == 0 && FM13Locker::NationFromRoll(5) == 1 && FM13Locker::NationFromRoll(9) == 5,
		"Nationen: fuenf von zehn Deutsche, dann je ein Land");
	PRUEFE(FM13Locker::Altersgruppe(23) == 0 && FM13Locker::Altersgruppe(24) == 1 && FM13Locker::Altersgruppe(30) == 2, "Altersgruppen jung bis 23, erfahren ab 30");
	PRUEFE(std::fabs(FM13Locker::Fuehrung(true, 30, 150, 50) - (30 + 8 + 18 + 7.5)) < 1e-9, "Fuehrung: Leader 30, Alter 8, Einsaetze 18, Moral 7,5");
	PRUEFE(FM13Locker::Status(false, false, 20, 0) == FM13Locker::EStatus::Talent && FM13Locker::Status(false, false, 28, 0) == FM13Locker::EStatus::Etabliert, "Rangordnung: Talent und Etabliert");

	// Ein Kader aus fuenf Cliquen zu je drei Spielern: Viele Grueppchen kosten -1
	FFM13World Gruppen;
	Gruppen.NewGame(TEXT("Gruppen"), 91);
	Gruppen.Squad.Reset();
	for (int32 i = 0; i < 15; ++i)
	{
		FFM13Player P;
		P.Id = 1000 + i; P.Name = TEXT("Spieler"); P.Strength = 60; P.Age = 24; P.Morale = 80; P.Nation = (uint8)(i / 3); P.Pos = EFM13Position::MIT;
		Gruppen.Squad.Add(P);
	}
	PRUEFE(std::fabs(Gruppen.CliqueModifier() + 1.0) < 1e-9, "Fuenf Cliquen zu drei: -1 (%.2f)", Gruppen.CliqueModifier());

	// Eine einende Clique: alle gleich, Stimmung gut: +1,5
	FFM13World Eins;
	Eins.NewGame(TEXT("Eins"), 92);
	for (FFM13Player& P : Eins.Squad) { P.Nation = 0; P.Age = 24; P.Morale = 80; }
	PRUEFE(std::fabs(Eins.CliqueModifier() - 1.5) < 1e-9, "Eine einende Clique: +1,5 (%.2f)", Eins.CliqueModifier());
	// Dieselbe Clique rumort: kein Bonus, dafuer -0,5
	for (FFM13Player& P : Eins.Squad) P.Morale = 30;
	PRUEFE(std::fabs(Eins.CliqueModifier() + 0.5) < 1e-9, "Rumorende Clique: -0,5 (%.2f)", Eins.CliqueModifier());

	// Mannschaftsrat: Kapitaen plus die zwei Fuehrungsspieler; Stabilisator je nach Schnitt
	FFM13World Rat;
	Rat.NewGame(TEXT("Rat"), 93);
	Rat.Squad[0].Trait = FM13Strength::Leader;
	Rat.CaptainId = Rat.Squad[1].Id;
	Rat.ElectCouncil();
	PRUEFE(Rat.CouncilIds.Num() == 3 && Rat.CouncilIds[0] == Rat.CaptainId && Rat.CouncilIds.Contains(Rat.Squad[0].Id), "Rat: Kapitaen und der Leader");
	for (int32 Id : Rat.CouncilIds) if (FFM13Player* P = Rat.FindPlayer(Id)) P->Morale = 80;
	PRUEFE(std::fabs(Rat.CouncilStabilizer() - 3.0) < 1e-9, "Rat mit Moral 80: +3");
	for (int32 Id : Rat.CouncilIds) if (FFM13Player* P = Rat.FindPlayer(Id)) P->Morale = 30;
	PRUEFE(std::fabs(Rat.CouncilStabilizer() + 2.0) < 1e-9, "Rat mit Moral 30: -2");

	// Kapitaenswechsel: alter -12, neuer +8; ohne Stellung im Rat -4 fuer den Rat
	FFM13World Wechsel;
	Wechsel.NewGame(TEXT("Wechsel"), 94);
	Wechsel.CaptainId = Wechsel.Squad[0].Id;
	Wechsel.ElectCouncil();
	const int32 Alt = Wechsel.Squad[0].Id, Neu = Wechsel.Squad[10].Id;
	Wechsel.Squad[0].Morale = 60; Wechsel.Squad[10].Morale = 60; Wechsel.Squad[10].AppearancesTotal = 0; Wechsel.Squad[10].Age = 22;
	FString Folge;
	PRUEFE(Wechsel.ChangeCaptain(Neu, false, Folge) && Wechsel.CaptainId == Neu, "Kapitaenswechsel gelingt");
	PRUEFE(Wechsel.FindPlayer(Alt)->Morale == 48 && Wechsel.FindPlayer(Neu)->Morale == 68, "Alter Kapitaen -12, neuer +8");
	PRUEFE(Folge.Contains(TEXT("Standing")), "Ohne Standing: Hinweis in der Kabine");

	// Freundschaften: nach langer Zeit im Kader sind die Paare gegenseitig und nie mit sich selbst
	FFM13World Freunde;
	Freunde.NewGame(TEXT("Freunde"), 95);
	for (int32 k = 0; k < 300; ++k) Freunde.TickFriendships();
	bool bSymmetrisch = true, bSelbst = false;
	for (const FFM13Player& P : Freunde.Squad)
	{
		if (P.FriendId == P.Id) bSelbst = true;
		if (P.FriendId != 0) { const FFM13Player* Q = Freunde.FindPlayer(P.FriendId); if (!Q || Q->FriendId != P.Id) bSymmetrisch = false; }
	}
	PRUEFE(bSymmetrisch && !bSelbst, "Kabinen-Freunde sind gegenseitig und nie mit sich selbst");

	// Monatlicher Kabinentick: rumorende Clique zieht die anderen herunter, zufriedene hebt sich
	FFM13World Monat;
	Monat.NewGame(TEXT("Monat"), 96);
	Monat.Squad.Reset();
	for (int32 i = 0; i < 9; ++i)
	{
		FFM13Player P;
		P.Id = 2000 + i; P.Name = TEXT("M"); P.Strength = 60; P.Age = 24; P.Pos = EFM13Position::MIT;
		P.Nation = i < 3 ? 0 : (i < 6 ? 1 : 2); P.Morale = i < 3 ? 30 : 80;
		Monat.Squad.Add(P);
	}
	Monat.TickLockerRoom();
	// Die rumorende Clique zieht alle anderen um 1 herunter, die zufriedenen Cliquen heben sich um 1: unter dem Strich 80.
	bool bNetto = true;
	for (int32 i = 3; i < 9; ++i) if (Monat.Squad[i].Morale != 80) bNetto = false;
	PRUEFE(bNetto && Monat.Squad[0].Morale == 30, "Monatlich: rumorende Clique -1 fuer die anderen, zufriedene +1 (%d)", Monat.Squad[3].Morale);

	// Spielstand: Nation, Freund, Dienstzeit und Rat bleiben erhalten
	FFM13World Sp;
	Sp.NewGame(TEXT("Kabinenspeicher"), 97);
	Sp.Squad[0].Nation = 3; Sp.Squad[0].FriendId = Sp.Squad[1].Id; Sp.Squad[1].FriendId = Sp.Squad[0].Id; Sp.Squad[0].SquadTenure = 25;
	Sp.CaptainId = Sp.Squad[2].Id; Sp.ElectCouncil();
	FFM13World Ld;
	FString Fehler;
	const bool bOk = FM13Save::Decode(FM13Save::Encode(Sp), Ld, Fehler);
	PRUEFE(bOk && Ld.Squad[0].Nation == 3 && Ld.Squad[0].FriendId == Sp.Squad[1].Id && Ld.Squad[0].SquadTenure == 25 && Ld.CouncilIds.Num() == Sp.CouncilIds.Num() && Ld.CouncilIds[0] == Sp.CouncilIds[0],
		"Kabine bleibt im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Mannschaftsrat (js/team-council.js): Anliegen, Antworten, Verfall, Kosten nach der Liga
static void TestMannschaftsrat()
{
	std::printf("Mannschaftsrat: Anliegen, Antworten, Verfall\n");
	FString G;
	FFM13World W;
	W.NewGame(TEXT("Rat"), 101, 0);
	W.Money = 500000;
	PRUEFE(W.CouncilCost(40000) == 40000 && W.CouncilCost(60000) == 60000, "Liga 1: Faktor 1");
	W.LeagueLevel = 2;
	PRUEFE(W.CouncilCost(40000) == 18000, "Liga 3: 40000 x 0,45 = 18000");
	W.LeagueLevel = 0;

	for (FFM13Player& P : W.Squad) P.Morale = 40;
	FFM13World::FAnliegen A;
	PRUEFE(W.FindCouncilConcern(A) && A.Typ == FString(TEXT("stimmung")) && A.Kosten == 40000, "Stimmung unter 45: Mannschaftsabend fuer 40000");
	W.Anliegen = A; W.Anliegen.bAktiv = true;
	const int64 VorAbend = W.Money;
	PRUEFE(W.AnswerConcern(0, G) && W.Money == VorAbend - 40000 && W.Squad[0].Morale == 46 && !W.Anliegen.bAktiv, "Antwort Mannschaftsabend: Geld, Moral +6, erledigt");
	PRUEFE(W.RatVerlauf.Num() == 1, "Die Entscheidung steht im Verlauf");

	FFM13World Arm;
	Arm.NewGame(TEXT("Arm"), 102);
	Arm.Money = 1000;
	for (FFM13Player& P : Arm.Squad) P.Morale = 40;
	FFM13World::FAnliegen B;
	Arm.FindCouncilConcern(B);
	Arm.Anliegen = B; Arm.Anliegen.bAktiv = true;
	PRUEFE(!Arm.AnswerConcern(0, G) && Arm.Anliegen.bAktiv, "Ohne Geld bleibt das Anliegen offen");
	PRUEFE(Arm.AnswerConcern(1, G) && !Arm.Anliegen.bAktiv, "Ablehnen kostet nichts");

	FFM13World E;
	E.NewGame(TEXT("Einsatz"), 103);
	E.Money = 500000;
	for (FFM13Player& P : E.Squad) { P.Morale = 80; P.Appearances = 3; }
	E.Squad[4].Appearances = 0; E.Squad[4].Strength = 90;
	E.Matchday = 9;
	FFM13World::FAnliegen C;
	PRUEFE(E.FindCouncilConcern(C) && C.Typ == FString(TEXT("einsatzzeit")) && C.Spieler == E.Squad[4].Id, "Einsatzzeit: der starke Spieler ohne Einsatz");
	E.Anliegen = C; E.Anliegen.bAktiv = true;
	const int32 VorGespraech = E.Squad[4].Morale;
	PRUEFE(E.AnswerConcern(0, G) && E.Squad[4].Morale == VorGespraech + 10, "Gespraech: +10 fuer den Spieler");

	FFM13World S;
	S.NewGame(TEXT("Serie"), 104, 0);
	S.Money = 500000;
	for (FFM13Player& P : S.Squad) P.Morale = 80;
	S.OwnSeasonGoals = { 2, 0, 3, 1, 1, 0 };
	FFM13World::FAnliegen D;
	PRUEFE(S.FindCouncilConcern(D) && D.Typ == FString(TEXT("praemie")) && D.Kosten == 60000, "Drei Siege: Praemie 60000");

	FFM13World V;
	V.NewGame(TEXT("Verfall"), 105);
	V.Money = 500000;
	for (FFM13Player& P : V.Squad) P.Morale = 40;
	V.Matchday = 2;
	V.TickTeamCouncil();
	PRUEFE(V.Anliegen.bAktiv, "Anliegen gemeldet");
	V.Matchday = 5;
	V.TickTeamCouncil();
	PRUEFE(V.Anliegen.bAktiv, "Nach drei Spieltagen noch offen");
	V.Matchday = 6;
	V.TickTeamCouncil();
	PRUEFE(V.RatVerlauf.Num() > 0 && V.RatVerlauf[0].Contains(TEXT("verfallen")), "Nach vier Spieltagen verfallen");

	FFM13World Sp;
	Sp.NewGame(TEXT("Ratspeicher"), 106);
	Sp.Money = 500000;
	for (FFM13Player& P : Sp.Squad) P.Morale = 40;
	Sp.OwnSeasonGoals = { 1, 0, 2, 2 };
	FFM13World::FAnliegen F;
	Sp.FindCouncilConcern(F);
	Sp.Anliegen = F; Sp.Anliegen.bAktiv = true;
	FFM13World Ld;
	FString Fehler;
	const bool bOk = FM13Save::Decode(FM13Save::Encode(Sp), Ld, Fehler);
	PRUEFE(bOk && Ld.Anliegen.bAktiv && Ld.Anliegen.Typ == Sp.Anliegen.Typ && Ld.OwnSeasonGoals.Num() == 4 && Ld.Anliegen.Kosten == Sp.Anliegen.Kosten,
		"Mannschaftsrat bleibt im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Jugend (js/youth-pathway.js, js/youth-academy-extended.js): Stufe, Spanne, Wachstum, Rangliste
static void TestJugend()
{
	std::printf("Jugend: Potenzialstufe, Trainer, Wachstum, Talentwert\n");
	PRUEFE(FM13Youth::Stufe(0.5) == 1 && FM13Youth::Stufe(0.7) == 2 && FM13Youth::Stufe(0.95) == 3, "Stufe: unter 0,6 / 0,9 / darueber");
	int32 U = 0, O = 0;
	FM13Youth::PotenzialSpanne(2, U, O);
	PRUEFE(U == 67 && O == 78, "Spanne Stufe 2: 67 bis 78");
	PRUEFE(std::fabs(FM13Youth::Trainerbonus(false, 9) - 1.0) < 1e-9, "Ohne Jugendtrainer: 1");
	PRUEFE(std::fabs(FM13Youth::Trainerbonus(true, 0) - 1.15) < 1e-9 && std::fabs(FM13Youth::Trainerbonus(true, 5) - 1.25) < 1e-9 && std::fabs(FM13Youth::Trainerbonus(true, 40) - 1.5) < 1e-9,
		"Trainer 1,15, je Ernennung 0,02 mehr, hoechstens 1,5");
	// Gleichmaessig Zufall 1: 1,5 Zuwachs. Potenzial 60, Staerke 50 (Luecke 10): round(51,5) = 52
	PRUEFE(FM13Youth::Wachstum(50, 60, 18, 1.0, false, false, 1.0) == 52, "Wachstum 50 nach 52 bei Zufall 1");
	// Luecke unter 5: Zuwachs mal 0,3 -> 0,45 -> 57
	PRUEFE(FM13Youth::Wachstum(57, 60, 18, 1.0, false, false, 1.0) == 57, "Kleine Luecke bremst (0,45)");
	// Schwerpunkt 1,2 und Mentor 1,35: 1,5 x 1,62 = 2,43 -> round(52,43) = 52
	PRUEFE(FM13Youth::Wachstum(50, 60, 18, 1.0, true, true, 1.0) == 52, "Schwerpunkt und Mentor: 2,43 -> 52");
	// Alter 25: Daempfung 0,75 -> 1,125 -> 51
	PRUEFE(FM13Youth::Wachstum(50, 60, 25, 1.0, false, false, 1.0) == 51, "Alter 25 daempft auf 0,75");
	// Trainer 1,15 -> 1,725 -> round(51,725) = 52
	PRUEFE(FM13Youth::Wachstum(50, 60, 18, 1.15, false, false, 1.0) == 52, "Trainer 1,15 bei Zufall 1");
	// Nie ueber dem Potenzial
	PRUEFE(FM13Youth::Wachstum(59, 60, 18, 1.5, true, true, 1.0) == 59, "Nahe am Potenzial bremst der Abstand den Zuwachs (59)");
	PRUEFE(FM13Youth::Wachstum(59, 60, 18, 1.5, false, false, 1.0) <= 60, "Nie ueber dem Potenzial");
	// Rangliste: Luecke 10, Alter 18 (Bonus 20), Trait 10, Mentor 8 -> 48
	PRUEFE(FM13Youth::Talentwert(50, 60, 18, true, true) == 48 && FM13Youth::Talentwert(50, 60, 18, false, false) == 30, "Talentwert: Luecke + Alter + Trait + Mentor");

	// Monatlicher Lauf im Spiel: Talente werden gestuft und wachsen, Trainer zaehlt
	FFM13World W;
	W.NewGame(TEXT("Jugend"), 111, 0);
	W.YouthTalents.Reset();
	for (int32 i = 0; i < 3; ++i)
	{
		FFM13Player T;
		T.Id = 3000 + i; T.Name = TEXT("Talent"); T.Strength = 50; T.Potential = 70; T.Age = 17; T.Pos = EFM13Position::MIT;
		W.YouthTalents.Add(T);
	}
	FString G;
	W.Money = 100000;
	PRUEFE(!W.AssignYouthCoach(12345, G) && W.AssignYouthCoach(W.Squad[0].Id, G) && W.YouthCoachId == W.Squad[0].Id && W.Money == 85000 && W.YouthCoachCount == 1,
		"Jugendtrainer: 15000, nur ein bekannter Spieler");
	W.TickYouthDevelopment();
	bool bGewachsen = true;
	for (const FFM13Player& T : W.YouthTalents) { if (T.Strength < 50 || T.Strength > 70 || T.PotentialTier == 0) bGewachsen = false; }
	PRUEFE(bGewachsen, "Monatlich: Talente wachsen hoechstens bis zum Potenzial, Stufe gesetzt");

	// Spielstand: Trainer, Stufe und Zufall bleiben erhalten
	FFM13World Sp;
	Sp.NewGame(TEXT("Jugendspeicher"), 112, 0);
	Sp.YouthTalents.Reset();
	FFM13Player T;
	T.Id = 4000; T.Name = TEXT("T"); T.Strength = 50; T.Potential = 70; T.Age = 17; T.PotentialTier = 2; T.YouthFocus = TEXT("technik"); T.MentorId = Sp.Squad[0].Id;
	Sp.YouthTalents.Add(T);
	Sp.YouthCoachId = Sp.Squad[1].Id; Sp.YouthCoachCount = 3;
	FFM13World Ld;
	FString Fehler;
	const bool bOk = FM13Save::Decode(FM13Save::Encode(Sp), Ld, Fehler);
	PRUEFE(bOk && Ld.YouthTalents.Num() == 1 && Ld.YouthTalents[0].PotentialTier == 2 && Ld.YouthTalents[0].YouthFocus == FString(TEXT("technik")) && Ld.YouthTalents[0].MentorId == Sp.Squad[0].Id
		&& Ld.YouthCoachId == Sp.YouthCoachId && Ld.YouthCoachCount == 3, "Jugend bleibt im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Jugend-Laufbahn (js/youth-pathway.js): Entscheidung mit 19, Leihe, Rueckkehr, Durchbrueche, Meilensteine
static void TestJugendLaufbahn()
{
	std::printf("Jugend-Laufbahn: Entscheidung, Leihe, Rueckkehr, Meilensteine\n");
	FString G;
	FFM13World W;
	W.NewGame(TEXT("Laufbahn"), 121, 0);
	W.Money = 500000;
	W.YouthTalents.Reset();
	FFM13Player T;
	T.Id = 5000; T.Name = TEXT("Talent"); T.Strength = 50; T.Potential = 70; T.Age = 18; T.Pos = EFM13Position::ST; T.PotentialTier = 2;
	W.YouthTalents.Add(T);
	// Mit 19 wird die Entscheidung faellig: acht Spieltage Frist
	W.AgeYouthAtSeasonEnd();
	PRUEFE(W.YouthTalents[0].Age == 19 && W.YouthTalents[0].ProDecisionLeft == 8, "Mit 19 Jahren: acht Spieltage Frist");
	// Ablauf ohne Angebot: das Talent verlaesst den Verein, Entschaedigung 10 % des Marktwerts
	const int64 VorAblauf = W.Money;
	const int64 MW = FM13Economy::MarketValue(50, nullptr);
	for (int32 k = 0; k < 8; ++k) W.TickYouthPathway();
	const int64 Entschaedigung = (int64)std::floor(MW * 0.1 / 100.0 + 0.5) * 100;
	PRUEFE(W.YouthTalents.Num() == 0 && W.Money == VorAblauf + Entschaedigung, "Ablauf ohne Angebot: das Talent ist weg, der Verein erhaelt %lld", (long long)Entschaedigung);

	// Leihe: Vereine nach Staerke, eine Liga tiefer zwei, eine hoeher einer
	FFM13World L;
	L.NewGame(TEXT("Leihe"), 122, 1);
	L.YouthTalents.Reset();
	FFM13Player Y;
	Y.Id = 6000; Y.Name = TEXT("Leihgabe"); Y.Strength = 55; Y.Potential = 75; Y.Age = 17; Y.Pos = EFM13Position::MIT; Y.PotentialTier = 2;
	L.YouthTalents.Add(Y);
	const TArray<FFM13World::FFM13YouthLoan> Vereine = L.YouthLoanClubs(Y);
	PRUEFE(Vereine.Num() == 3 && Vereine[0].ClubLevel == 2 && Vereine[2].ClubLevel == 1, "Leihe: zwei Stammvereine eine Liga tiefer, einer eine Liga hoeher");
	PRUEFE(L.LoanYouth(Y.Id, Vereine[0].Club, G) && L.YouthTalents.Num() == 0 && L.YouthLoans.Num() == 1, "Verliehen");
	PRUEFE(L.YouthLoans[0].Duration == 17, "Dauer am ersten Spieltag: 17 (max. 17)");
	// Nach der Leihe kommt das Talent zurueck, mit Bilanz im Verlauf
	for (int32 k = 0; k < 40 && L.YouthLoans.Num() > 0; ++k) L.TickYouthPathway();
	PRUEFE(L.YouthLoans.Num() == 0 && L.YouthTalents.Num() == 1, "Nach der Leihe zurueck in der Akademie");
	PRUEFE(L.YouthMoments.Num() >= 2, "Die Leihe steht im Verlauf der Jugend");
	PRUEFE(!L.LoanYouth(Y.Id, TEXT("Unbekannt"), G), "Unbekannter Verein wird abgelehnt");

	// Meilensteine: Absolvent in der Startelf, erstes Tor, erste Elf
	FFM13World M;
	M.NewGame(TEXT("Meilenstein"), 123, 0);
	M.Squad[0].bAcademyGraduate = true;
	M.MatchGoals.Reset(); M.MatchAssists.Reset();
	for (int32 i = 0; i < M.Squad.Num(); ++i) { M.MatchGoals.Add(i == 0 ? 1 : 0); M.MatchAssists.Add(0); }
	M.Squad[0].LastGrade = 12;
	M.Season = 2; M.Matchday = 5;
	M.CheckYouthMilestones({ 0 });
	PRUEFE(M.Squad[0].MeilensteinDebut == FString(TEXT("S2/SpT 5")) && M.Squad[0].MeilensteinTor == M.Squad[0].MeilensteinDebut && M.Squad[0].MeilensteinElf == M.Squad[0].MeilensteinDebut,
		"Debuet, Tor und Elf am selben Spieltag festgehalten");
	PRUEFE(M.YouthMoments.Num() == 3, "Drei Momente im Verlauf");

	// Spielstand: Entscheidung, Absolvent, Leihe und Verlauf bleiben erhalten
	FFM13World Sp;
	Sp.NewGame(TEXT("Laufbahnspeicher"), 124, 0);
	Sp.YouthTalents.Reset();
	FFM13Player Q; Q.Id = 7000; Q.Name = TEXT("Q"); Q.Strength = 50; Q.Potential = 70; Q.Age = 19; Q.ProDecisionLeft = 4;
	Sp.YouthTalents.Add(Q);
	Sp.AddYouthMoment(TEXT("Test"));
	FFM13World Ld;
	FString Fehler;
	const bool bOk = FM13Save::Decode(FM13Save::Encode(Sp), Ld, Fehler);
	PRUEFE(bOk && Ld.YouthTalents.Num() == 1 && Ld.YouthTalents[0].ProDecisionLeft == 4 && Ld.YouthMoments.Num() == 1, "Jugend-Laufbahn bleibt im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Transfer-Regeln (js/medical-check.js, js/buyback.js, js/transfer-strategy.js, js/rumors.js, js/pre-contracts.js).
// Werte von Hand nach den JS-Formeln gerechnet.
static void TestTransferRegeln()
{
	std::printf("Transfer-Regeln: Medizin, Rueckkauf, Strategie, Geruechte, Vorvertraege\n");
	using namespace FM13Transfers;
	PRUEFE(JsRunden(2.5) == 3 && JsRunden(2.49) == 2, "JsRunden: Halbe nach oben");
	PRUEFE(MedizinGebuehr(1000000, 1.0) == 30000 && MedizinGebuehr(10000, 1.0) == 1500 && MedizinGebuehr(1000000, 0.5) == 15000, "Medizin-Gebuehr: 3  Prozent, auf 100 gerundet, mind. 1.500");
	PRUEFE(MedizinRabatt(EFM13Medical::Chronisch) == 0.8 && MedizinRabatt(EFM13Medical::Verletzt) == 0.85 && MedizinRabatt(EFM13Medical::Ok) == 1.0, "Medizin-Rabatt 0,8  oder  0,85");
	PRUEFE(WuerfleBefund(25, 0.2, 0, 0).Issue == EFM13Medical::Verletzt && WuerfleBefund(25, 0.2, 0, 0).Weeks == 2, "Befund: 0,2 bei Alter 25 ist verletzt (Quote 0,12 + 0,1)");
	PRUEFE(WuerfleBefund(30, 0.1, 0, 0).Issue == EFM13Medical::Chronisch && WuerfleBefund(30, 0.1, 0, 0).Injuries == 3, "Befund: 30 Jahre, Quote 0,22, chronisch mit 3 Verletzungen");
	PRUEFE(WuerfleBefund(20, 0.5, 0, 0).Issue == EFM13Medical::Ok, "Befund: 0,5 ist unauffaellig");
	PRUEFE(RueckkaufSofort(100000) == 90000 && RueckkaufPreis(100000) == 140000 && RueckkaufPreis(123456) == 173000, "Rueckkauf: 90  Prozent sofort, 140  Prozent Preis auf 1.000");
	PRUEFE(RueckkaufMoeglich(25) && !RueckkaufMoeglich(26), "Rueckkauf nur bis 25 Jahre");
	PRUEFE(RueckkaufEntwicklung(20, 0.5) == 4 && RueckkaufEntwicklung(23, 0.9) == 4 && RueckkaufEntwicklung(25, 0.5) == 0 && RueckkaufEntwicklung(30, 0.5) == -2, "Rueckkauf-Entwicklung je Altersstufe");
	PRUEFE(StrategieBudgetDelta(10000000, EStrategie::Jugend) == -3000000 && StrategieBudgetDelta(10000000, EStrategie::Sofort) == 4000000 && StrategieBudgetDelta(10000000, EStrategie::Sparen) == -5000000, "Strategie: Budget -30  Prozent  oder  +40  Prozent  oder  -50  Prozent");
	PRUEFE(StrategieZiel(9, 1, 18) == 10 && StrategieZiel(2, -2, 18) == 1 && StrategieZiel(17, 2, 18) == 18, "Strategie: Ziel begrenzt auf 1 bis Teamzahl");
	const FStrategieAbrechnung J = StrategieAbrechnung(EStrategie::Jugend, 3, 0, 0, 0);
	PRUEFE(J.bErfuellt && J.Vorstand == 6 && J.Fans == 3, "Jugend erfuellt: Vorstand +6, Fans +3");
	PRUEFE(!StrategieAbrechnung(EStrategie::Sofort, 0, 5, 4, 0).bErfuellt && StrategieAbrechnung(EStrategie::Sofort, 0, 5, 4, 0).Vorstand == -8, "Sofort-Erfolg verfehlt: -8");
	PRUEFE(!StrategieAbrechnung(EStrategie::Sparen, 0, 0, 0, -1).bErfuellt && StrategieAbrechnung(EStrategie::Sparen, 0, 0, 0, -1).Vorstand == -6, "Sparen mit Minus: -6");
	PRUEFE(DementiMoral(2, 60) == 55 && DementiMoral(0, 60) == 63 && DementiMoral(2, 3) == 0, "Dementi: Ehrgeizige -5, andere +3, nie unter 0");
	PRUEFE(AnheizenMoral(2) == 0 && AnheizenMoral(50) == 47, "Anheizen: Moral -3");
	PRUEFE(std::fabs(GeruechtMultiplikator(true, 0.5, false) - 1.225) < 1e-9 && std::fabs(GeruechtMultiplikator(true, 0.5, true) - 1.40875) < 1e-9, "Geruecht-Angebot: 1,225 und angeheizt x 1,15");
	PRUEFE(VorvertragGehalt(1000) == 1200 && VorvertragGehalt(1001) == 1200 && VorvertragHandgeld(1200, false) == 14400 && VorvertragHandgeld(1200, true) == 28800, "Vorvertrag: Gehalt x 1,2, Handgeld 12 bzw. 24 Gehaelter");
	PRUEFE(std::fabs(VorvertragChance(60, 50, 2, false) - 0.95) < 1e-9 && std::fabs(VorvertragChance(50, 50, 5, false) - 0.6) < 1e-9 && std::fabs(VorvertragChance(50, 50, 5, true) - 0.85) < 1e-9, "Vorvertrag-Zusage: Elf, Rang und Handgeld");
	std::printf("\n");
}

// Medizincheck (js/medical-check.js): Befund, Gebuehr, Preisnachlass und Auswirkung nach der Unterschrift
static void TestMedizincheck()
{
	std::printf("Medizincheck: Befund, Gebuehr, Nachlass, Unterschrift\n");
	FFM13World W;
	W.NewGame(TEXT("Medizin"), 141, 0);
	W.Money = 50000000;
	FString G;
	const int32 Id = W.Market[0].Player.Id;
	W.OpenPoker(Id, G);
	W.Poker.Offer = W.Market[0].AskingPrice;
	W.SubmitPokerOffer(G);
	const int64 Alt = W.Poker.AgreedFee;
	const int64 Vor = W.Money;
	// Chronisch: Check kostet 3 % der Abloese, Preis sinkt um 20 %
	W.Market[0].Medical.Issue = EFM13Medical::Chronisch;
	W.Market[0].Medical.Injuries = 4;
	W.Market[0].bMedicalRolled = true;
	PRUEFE(W.RunMedicalCheck(G), "Check gelingt bei geeignetem Konto");
	const int64 Gebuehr = FM13Transfers::MedizinGebuehr(Alt, 1.0);
	PRUEFE(W.Money == Vor - Gebuehr, "Check kostet die Gebuehr (%lld)", (long long)Gebuehr);
	PRUEFE(W.Poker.AgreedFee == FM13Transfers::JsRunden((double)Alt * 0.8 / 1000.0) * 1000, "Abloese sinkt um 20 %%");
	PRUEFE(!W.RunMedicalCheck(G), "Zweiter Check wird abgelehnt");
	PRUEFE(W.Market[0].Medical.bChecked, "Befund ist als untersucht markiert");
	W.SignPokerDeal(G);
	bool bChronisch = false;
	for (const FFM13Player& P : W.Squad) if (P.Id == Id) bChronisch = P.bChronic && P.TimesInjured >= 4;
	PRUEFE(bChronisch, "Chronischer Befund wirkt sich nach der Unterschrift aus");

	// Ohne Check: verletzt kommt verletzt an und meldet sich im Postfach
	FFM13World A;
	A.NewGame(TEXT("Blind"), 142, 0);
	A.Money = 50000000;
	A.TransferBudget = 100000000;
	A.WageBudget = 1000000000;
	const int32 IdA = A.Market[0].Player.Id;
	A.OpenPoker(IdA, G);
	A.Poker.Offer = A.Market[0].AskingPrice;
	A.SubmitPokerOffer(G);
	A.Market[0].Medical.Issue = EFM13Medical::Verletzt;
	A.Market[0].Medical.Weeks = 4;
	A.Market[0].bMedicalRolled = true;
	const int32 Nachrichten = A.Messages.Num();
	PRUEFE(A.SignPokerDeal(G), "Blinder Sofortkauf gelingt");
	bool bVerletzt = false;
	for (const FFM13Player& P : A.Squad) if (P.Id == IdA) bVerletzt = P.InjuredMatchdays == 4;
	PRUEFE(bVerletzt, "Verletzter Befund fehlt nach der Unterschrift");
	PRUEFE(A.Messages.Num() == Nachrichten + 2 && A.Messages[A.Messages.Num() - 2].Title.Contains(TEXT("Boese Ueberraschung")), "Ohne Check gibt es eine Meldung");

	// Wechselfenster (tickTransferWindows): Sommer bis Spieltag 3, Winter 17 bis 20
	FFM13World F;
	F.NewGame(TEXT("Fenster"), 144, 0);
	F.Money = 500000000;
	F.TransferBudget = 500000000;
	F.WageBudget = 1000000000;
	PRUEFE(F.IsTransferWindowOpen() && F.TransferBudget == 500000000, "Fenster: am Saisonstart offen");
	F.Matchday = 5;
	PRUEFE(!F.IsTransferWindowOpen(), "Fenster: nach Spieltag 3 zu");
	F.Matchday = 17;
	F.TickTransferWindows();
	PRUEFE(F.bWinterWindowActive && F.IsTransferWindowOpen() && F.WinterWindowCloseMatchday == 20, "Winterfenster oeffnet am Spieltag 17 bis 20");
	F.Matchday = 19;
	F.TickTransferWindows();
	PRUEFE(F.bWinterWindowActive, "Winterfenster bleibt am Spieltag 19 offen");
	F.Matchday = 20;
	F.TickTransferWindows();
	PRUEFE(!F.bWinterWindowActive && !F.IsTransferWindowOpen(), "Winterfenster schliesst am Spieltag 20");
	F.Matchday = 5;
	FString GrundF;
	PRUEFE(F.Market.Num() > 0 && !F.BuyPlayer(0, GrundF) && GrundF.Contains(TEXT("Wechselfenster")), "Kauf ausserhalb des Fensters abgelehnt");
	F.Matchday = 2;
	const int64 BudgetVor = F.TransferBudget;
	const int64 Preis = F.Market[0].Price;
	PRUEFE(F.BuyPlayer(0, GrundF) && F.TransferBudget == BudgetVor - Preis, "Kauf im Fenster kostet das Transferbudget");
	FFM13World Knapp;
	Knapp.NewGame(TEXT("Budget"), 145, 0);
	Knapp.Money = 500000000;
	Knapp.TransferBudget = 1000;
	FString GrundK;
	PRUEFE(!Knapp.BuyPlayer(0, GrundK) && GrundK.Contains(TEXT("Transferbudget")), "Zu kleines Transferbudget: Kauf abgelehnt");
	PRUEFE(FFM13World::LeagueTransferBudget(0) == 25000000 && FFM13World::LeagueTransferBudget(5) == 40000 && FFM13World::LeagueTransferBudget(9) == 40000, "Liga-Transferbudget je Stufe, begrenzt");

	// Rueckkauf (js/buyback.js): Verkauf mit Option, Alterung, Ausuebung im Fenster
	FFM13World R;
	R.NewGame(TEXT("Rueckkauf"), 146, 0);
	R.Money = 500000000;
	R.TransferBudget = 500000000;
	R.Matchday = 2;
	R.Squad[0].Age = 22;
	const int32 RId = R.Squad[0].Id;
	FFM13IncomingOffer RO;
	RO.PlayerId = RId; RO.PlayerName = R.Squad[0].Name; RO.Club = TEXT("Testklub"); RO.Price = 1000000; RO.ExpiresMatchday = 9;
	R.IncomingOffers.Add(RO);
	FString RGrund;
	const int64 RGeld = R.Money;
	PRUEFE(R.AcceptIncomingOfferWithBuyback(0, RGrund) && R.BuybackOptions.Num() == 1, "Rueckkauf-Verkauf: Option angelegt (%s)", *RGrund);
	PRUEFE(R.Money == RGeld + 900000 && R.BuybackOptions[0].Price == 1400000 && R.BuybackOptions[0].UntilSeason == R.Season + 2, "Verkauf zu 90 %%, Rueckkauf zu 140 %%, Laufzeit 2 Saisons");
	R.Squad[0].Age = 30;
	R.IncomingOffers.Add(RO);
	PRUEFE(!R.AcceptIncomingOfferWithBuyback(0, RGrund) && RGrund.Contains(TEXT("bis 25")), "Ueber 25 Jahre keine Rueckkaufoption");
	// Alterung zum Saisonende: der Spieler ist jetzt 23
	FFM13World Gealtert = R;
	Gealtert.Squad.Reset();
	FFM13Player Verkauft = Gealtert.BuybackOptions[0].Player;
	Gealtert.TickBuybackOptions();
	PRUEFE(Gealtert.BuybackOptions[0].Player.Age == Verkauft.Age + 1, "Saisonende: Spieler altert um ein Jahr");
	PRUEFE(Gealtert.BuybackOptions[0].Player.Strength >= 20 && Gealtert.BuybackOptions[0].Player.Strength <= 99, "Saisonende: Staerke bleibt in 20 bis 99");
	// Option laeuft ab, wenn die Saison erreicht ist
	FFM13World Ende = R;
	Ende.Season = Ende.BuybackOptions[0].UntilSeason;
	Ende.TickBuybackOptions();
	PRUEFE(Ende.BuybackOptions.Num() == 0, "Option verfaellt nach der Laufzeit");
	// Ausuebung im Fenster: Spieler kehrt zurueck, Option verschwindet
	FFM13World Ruck = R;
	const int64 RuckGeld = Ruck.Money;
	const int64 RuckBudget = Ruck.TransferBudget;
	const int32 RuckKader = Ruck.Squad.Num();
	const int32 RuckFans = Ruck.Fans;
	FString RuckGrund;
	PRUEFE(Ruck.ExerciseBuyback(RId, RuckGrund) && Ruck.Squad.Num() == RuckKader + 1 && Ruck.BuybackOptions.Num() == 0, "Rueckkauf im Fenster: Spieler zurueck (%s)", *RuckGrund);
	PRUEFE(Ruck.Money == RuckGeld - 1400000 && Ruck.TransferBudget == RuckBudget - 1400000 && Ruck.Fans == FMath::Min(100, RuckFans + 2), "Rueckkauf kostet 140 %%, Fans +2");
	Ruck.Matchday = 10;
	FFM13World Spaet = R;
	Spaet.Matchday = 10;
	FString SpaetGrund;
	PRUEFE(!Spaet.ExerciseBuyback(RId, SpaetGrund) && SpaetGrund.Contains(TEXT("Wechselfenster")), "Rueckkauf ausserhalb des Fensters abgelehnt");

	// Rueckkauf und Budget bleiben im Spielstand
	FFM13World Sp2;
	Sp2.NewGame(TEXT("RueckkaufSpeicher"), 147, 0);
	Sp2.Money = 500000000;
	Sp2.TransferBudget = 77000000;
	Sp2.Matchday = 2;
	Sp2.Squad[0].Age = 21;
	FFM13IncomingOffer SO;
	SO.PlayerId = Sp2.Squad[0].Id; SO.PlayerName = Sp2.Squad[0].Name; SO.Club = TEXT("Speicherklub"); SO.Price = 2000000; SO.ExpiresMatchday = 9;
	Sp2.IncomingOffers.Add(SO);
	FString SpGrund;
	Sp2.AcceptIncomingOfferWithBuyback(0, SpGrund);
	FFM13World Sp2Ld;
	FString SpFehler;
	const bool bSpOk = FM13Save::Decode(FM13Save::Encode(Sp2), Sp2Ld, SpFehler);
	PRUEFE(bSpOk && Sp2Ld.BuybackOptions.Num() == 1 && Sp2Ld.BuybackOptions[0].Price == Sp2.BuybackOptions[0].Price && Sp2Ld.BuybackOptions[0].Club == TEXT("Speicherklub"), "Rueckkaufoption bleibt im Spielstand (%s)", *SpFehler);
	PRUEFE(Sp2Ld.TransferBudget == Sp2.TransferBudget && Sp2Ld.BuybackOptions[0].Player.Age == Sp2.BuybackOptions[0].Player.Age, "Transferbudget und Spielerdaten bleiben im Spielstand");

	// Transferstrategie (js/transfer-strategy.js): Wahl, Automatik, Abrechnung
	FFM13World T;
	T.NewGame(TEXT("Strategie"), 148, 0);
	T.Matchday = 1;
	T.SeasonTarget = 9;
	T.TransferBudget = 10000000;
	FString TGrund;
	PRUEFE(T.ChooseTransferStrategy(FM13Transfers::EStrategie::Sofort, TGrund), "Strategie: Sofort-Erfolg am Saisonstart gewaehlt (%s)", *TGrund);
	PRUEFE(T.TransferBudget == 20000000 && T.SeasonTarget == 7, "Sofort-Erfolg: Budget +40 %%, Ziel 2 Plaetze hoeher");
	PRUEFE(!T.ChooseTransferStrategy(FM13Transfers::EStrategie::Sparen, TGrund) && TGrund.Contains(TEXT("steht schon")), "Strategie nur einmal je Saison");
	FFM13World Auto;
	Auto.NewGame(TEXT("Automatik"), 149, 0);
	Auto.Matchday = 5;
	Auto.TickTransferStrategy();
	PRUEFE(Auto.Strategy.bAuto && Auto.Strategy.Choice == FM13Transfers::EStrategie::Ausgewogen, "Nach Spieltag 3 ohne Wahl: ausgewogen");
	PRUEFE(!Auto.ChooseTransferStrategy(FM13Transfers::EStrategie::Jugend, TGrund), "Nach Spieltag 3 keine Wahl mehr");
	// Abrechnung Sofort-Erfolg verfehlt: Platz 9 statt 7
	T.BoardSat = 50;
	T.ResolveTransferStrategy(9);
	PRUEFE(T.BoardSat == 42 && T.Strategy.Result == 2, "Sofort-Erfolg verfehlt: Vorstand -8");
	// Sofort-Erfolg erreicht
	FFM13World Erfolg = T;
	Erfolg.Strategy.Result = 0;
	Erfolg.BoardSat = 50;
	Erfolg.ResolveTransferStrategy(6);
	PRUEFE(Erfolg.BoardSat == 55 && Erfolg.Strategy.Result == 1, "Sofort-Erfolg erreicht: Vorstand +5");
	// Jugend: drei Eigengewaechse mit 10 Spielen
	FFM13World Jugend;
	Jugend.NewGame(TEXT("Jugend"), 150, 0);
	Jugend.Matchday = 1;
	FString JGrund;
	Jugend.ChooseTransferStrategy(FM13Transfers::EStrategie::Jugend, JGrund);
	for (int32 i = 0; i < 3; ++i) { Jugend.Squad[i].bAcademyGraduate = true; Jugend.Squad[i].Appearances = 10; }
	Jugend.BoardSat = 50;
	Jugend.Fans = 50;
	Jugend.ResolveTransferStrategy(8);
	PRUEFE(Jugend.BoardSat == 56 && Jugend.Fans == 53 && Jugend.Strategy.Result == 1, "Jugend erfuellt: Vorstand +6, Fans +3");
	// Sparen mit Minus
	FFM13World Spar;
	Spar.NewGame(TEXT("Sparen"), 151, 0);
	Spar.Matchday = 1;
	Spar.ChooseTransferStrategy(FM13Transfers::EStrategie::Sparen, JGrund);
	FFM13Booking Minus;
	Minus.Label = TEXT("Verlust"); Minus.Amount = -5000; Minus.Season = Spar.Season;
	Spar.Bookings.Add(Minus);
	Spar.BoardSat = 50;
	Spar.ResolveTransferStrategy(10);
	PRUEFE(Spar.BoardSat == 44 && Spar.Strategy.Result == 2, "Sparen mit Minus: Vorstand -6");
	// Strategie bleibt im Spielstand
	FFM13World StSp = T;
	FFM13World StLd;
	FString StFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(StSp), StLd, StFehler) && StLd.bStrategySet && StLd.Strategy.Choice == FM13Transfers::EStrategie::Sofort && StLd.Strategy.Goal == StSp.Strategy.Goal, "Transferstrategie bleibt im Spielstand (%s)", *StFehler);
	// Ausgewogen aendert nichts
	FFM13World Aus;
	Aus.NewGame(TEXT("Ausgewogen"), 152, 0);
	Aus.Matchday = 1;
	Aus.ChooseTransferStrategy(FM13Transfers::EStrategie::Ausgewogen, JGrund);
	Aus.BoardSat = 50;
	Aus.ResolveTransferStrategy(18);
	PRUEFE(Aus.BoardSat == 50 && Aus.Strategy.Result == 0, "Ausgewogen: keine Veraenderung");
	// Gerueuchtekueche (js/rumors.js): Aufloesung, Reaktion, Obergrenze, Spielstand
	FFM13World GW;
	GW.NewGame(TEXT("Geruechte"), 153, 0);
	GW.Matchday = 4;
	// Ente: keine Wirkung auf den Kader, Trefferquote zaehlt Fehlschlag
	FFM13World::FFM13Rumor Ente;
	Ente.Id = TEXT("rum_t1"); Ente.Source = FM13Transfers::EQuelle::Blog; Ente.bTruth = false;
	Ente.Type = TEXT("abwerbung"); Ente.Club = TEXT("Testklub"); Ente.PlayerId = GW.Squad[0].Id; Ente.PlayerName = GW.Squad[0].Name; Ente.Season = GW.Season; Ente.ResolveAt = 5;
	GW.Rumors.Insert(Ente, 0);
	GW.Matchday = 5;
	GW.TickRumors();
	const int32 EnteIdx = GW.Rumors.IndexOfByPredicate([](const FFM13World::FFM13Rumor& X) { return X.Id == TEXT("rum_t1"); });
	PRUEFE(EnteIdx >= 0 && GW.Rumors[EnteIdx].Outcome == TEXT("ente") && GW.RumorMisses[1] >= 1, "Ente: Fehlschlag gezaehlt");
	// Wahres Abwerbe-Geruecht: ein Angebot des Vereins kommt, Dementi wirkt auf die Moral
	GW.Squad[1].Character = 2;   // Ehrgeizig
	GW.Squad[1].Morale = 60;
	FFM13World::FFM13Rumor Wahr;
	Wahr.Id = TEXT("rum_t2"); Wahr.Source = FM13Transfers::EQuelle::Fach; Wahr.bTruth = true;
	Wahr.Type = TEXT("abwerbung"); Wahr.Club = TEXT("Testklub"); Wahr.PlayerId = GW.Squad[1].Id; Wahr.PlayerName = GW.Squad[1].Name; Wahr.Season = GW.Season; Wahr.ResolveAt = 5;
	GW.Rumors.Insert(Wahr, 0);
	FString GwGrund;
	PRUEFE(GW.ReactToRumor(TEXT("rum_t2"), TEXT("dementieren"), GwGrund) && GW.Squad[1].Morale == 55, "Dementi: Ehrgeizige verlieren 5 Moral");
	PRUEFE(!GW.ReactToRumor(TEXT("rum_t2"), TEXT("anheizen"), GwGrund) && GwGrund.Contains(TEXT("schon")), "Zweite Reaktion abgelehnt");
	GW.TickRumors();
	const int32 WahrIdx = GW.Rumors.IndexOfByPredicate([](const FFM13World::FFM13Rumor& X) { return X.Id == TEXT("rum_t2"); });
	PRUEFE(WahrIdx >= 0 && (GW.Rumors[WahrIdx].Outcome == TEXT("wahr") || GW.Rumors[WahrIdx].Outcome == TEXT("zurueckgezogen")), "Wahres Geruecht wird aufgeloest");
	PRUEFE(GW.RumorHits[2] >= 1, "Trefferquote Fach zaehlt Treffer");
	if (WahrIdx >= 0 && GW.Rumors[WahrIdx].Outcome == TEXT("wahr"))
	{
		bool bAngebot = false;
		for (const FFM13IncomingOffer& O : GW.IncomingOffers) if (O.PlayerId == GW.Squad[1].Id && O.Club == TEXT("Testklub")) bAngebot = true;
		PRUEFE(bAngebot, "Wahres Geruecht: ein Angebot des Vereins liegt vor");
	}
	// Obergrenze: ein Klub aus der 5. Stufe bietet hoechstens 400.000
	FFM13World Ober;
	Ober.NewGame(TEXT("Obergrenze"), 154, 0);
	Ober.Matchday = 4;
	const int32 OberId = Ober.Squad[0].Id;
	Ober.Squad[0].MarketValue = 90000000;
	FString Verein5;
	for (const FFM13Club& C : Ober.Leagues[5].Clubs) if (!C.bOwn) { Verein5 = C.Name; break; }
	PRUEFE(Ober.TriggerAIOffer(OberId, Verein5, 1.0) && Ober.IncomingOffers.Last().Price <= 400000, "KI-Angebot der 5. Stufe ist auf 400.000 begrenzt");
	// Spielstand: Geruechte, Trefferquoten und Angebote bleiben erhalten
	FFM13World GSp = GW;
	FFM13World GLd;
	FString GwFehler;
	const bool bGOk = FM13Save::Decode(FM13Save::Encode(GSp), GLd, GwFehler);
	PRUEFE(bGOk && GLd.Rumors.Num() == GSp.Rumors.Num() && GLd.RumorHits[2] == GSp.RumorHits[2] && GLd.Rumors.ContainsByPredicate([](const FFM13World::FFM13Rumor& X) { return X.Id == TEXT("rum_t2") && X.Reaction == TEXT("dementieren"); }), "Geruechte bleiben im Spielstand (%s)", *GwFehler);
	// Vorvertraege (js/pre-contracts.js): Pool, Angebot, Obergrenze, Frist, Verlaengerung, Zuzug
	FFM13World VV;
	VV.NewGame(TEXT("Vorvertraege"), 155, 0);
	VV.Money = 500000000;
	VV.WageBudget = 1000000000;
	VV.Matchday = 17;
	VV.EnsurePreContractPool();
	PRUEFE(VV.PreContractPool.Num() == 0, "Vorvertraege: vor Spieltag 18 kein Pool");
	VV.Matchday = 18;
	VV.EnsurePreContractPool();
	PRUEFE(VV.PreContractPool.Num() == 4, "Vorvertraege: vier Kandidaten ab Spieltag 18");
	bool bVereinGesetzt = true;
	for (const FFM13World::FFM13PreContractCandidate& C : VV.PreContractPool) if (C.SellerClub.IsEmpty()) bVereinGesetzt = false;
	PRUEFE(bVereinGesetzt, "Vorvertraege: jeder Kandidat hat einen Verein");
	// Angebot bis zur Entscheidung (Zusage oder Absage)
	const int32 KandId = VV.PreContractPool[0].Player.Id;
	const int64 VorGeld = VV.Money;
	const int32 OrigWage = VV.PreContractPool[0].Player.Wage;
	const int64 Handgeld = FM13Transfers::VorvertragHandgeld(FM13Transfers::VorvertragGehalt(OrigWage), true);
	FString VGrund;
	bool bZusage = false;
	for (int32 k = 0; k < 8 && !bZusage; ++k)
	{
		if (VV.OfferPreContract(KandId, true, VGrund)) bZusage = true;
		else if (VV.PreContractPool.ContainsByPredicate([KandId](const FFM13World::FFM13PreContractCandidate& C) { return C.Player.Id == KandId && C.bRefused; })) break;
	}
	if (bZusage)
	{
		PRUEFE(VV.PreContracts.Num() == 1 && VV.Money == VorGeld - Handgeld, "Zusage: Handgeld gebucht, Vorvertrag angelegt");
		PRUEFE(VV.PreContracts[0].Player.Wage == FM13Transfers::VorvertragGehalt(OrigWage) && !VV.PreContractPool.ContainsByPredicate([KandId](const FFM13World::FFM13PreContractCandidate& C) { return C.Player.Id == KandId; }), "Zusage: Spieler aus dem Pool genommen");
	}
	else
	{
		PRUEFE(VV.Money == VorGeld, "Absage: kein Handgeld");
	}
	// Hoechstens drei offene Vorvertraege
	FFM13World VM = VV;
	VM.PreContracts.Reset();
	for (int32 k = 0; k < 3; ++k)
	{
		FFM13World::FFM13PreContractDeal Platz;
		Platz.Player = VM.Squad[k];
		VM.PreContracts.Add(Platz);
	}
	FFM13World::FFM13PreContractCandidate Extra;
	Extra.Player = VM.Squad[1];
	Extra.Player.Id = 999999;
	VM.PreContractPool.Add(Extra);
	FString VMGrund;
	PRUEFE(!VM.OfferPreContract(999999, false, VMGrund) && VMGrund.Contains(TEXT("Hoechstens")), "Vorvertraege: hoechstens drei offene");
	// Frist verstrichen: der Spieler unterschreibt beim anderen Verein
	FFM13World Frist = VV;
	Frist.Matchday = 20;
	Frist.Squad[0].PreOfferClub = TEXT("Testklub");
	Frist.Squad[0].PreOfferDeadline = 20;
	Frist.Squad[0].ContractYears = 1;
	Frist.TickPreContracts();
	PRUEFE(Frist.Squad[0].PreSignedClub == TEXT("Testklub") && Frist.Squad[0].PreOfferClub.IsEmpty(), "Frist verstrichen: Vorvertrag beim Verein unterschrieben");
	// Verlaengerung vor der Frist: das Angebot ist vom Tisch
	FFM13World Verl = VV;
	Verl.Matchday = 20;
	Verl.Squad[1].PreOfferClub = TEXT("Testklub");
	Verl.Squad[1].PreOfferDeadline = 23;
	Verl.Squad[1].ContractYears = 2;
	Verl.TickPreContracts();
	PRUEFE(Verl.Squad[1].PreOfferClub.IsEmpty() && Verl.Squad[1].PreSignedClub.IsEmpty(), "Verlaengert: Angebot vom Tisch");
	// Saisonwechsel: Vorvertrag wird Spieler, Vertrag drei Jahre, Alter plus eins
	FFM13World Zuzug = VV;
	const int32 ZKader = Zuzug.Squad.Num();
	FFM13World::FFM13PreContractDeal Deal;
	Deal.Player = VV.Squad[2];
	Deal.Player.Id = 888888;
	Deal.Player.Age = 25;
	Deal.From = TEXT("Altklub");
	Zuzug.PreContracts.Reset();
	Zuzug.PreContracts.Add(Deal);
	Zuzug.JoinPreContractPlayers();
	bool bZugezogen = false;
	for (const FFM13Player& P : Zuzug.Squad) if (P.Id == 888888 && P.Age == 26 && P.ContractYears == 3) bZugezogen = true;
	PRUEFE(Zuzug.Squad.Num() == ZKader + 1 && bZugezogen && Zuzug.PreContracts.Num() == 0, "Zuzug: Spieler kommt mit Vertrag und Alter plus eins");
	// Leihspieler (js/transfermarket.js): Leihe, Kaufoption, Ablauf, Deadline-Day
	FFM13World LW;
	LW.NewGame(TEXT("Leihe"), 156, 0);
	LW.Money = 500000000;
	LW.TransferBudget = 500000000;
	LW.WageBudget = 1000000000;
	LW.Matchday = 2;
	PRUEFE(LW.Loanables.Num() == 3, "Leihspieler: drei Angebote je Markt-Neuaufbau");
	while (LW.Squad.Num() >= 21) LW.Squad.RemoveAt(LW.Squad.Num() - 1);
	const int32 LKader = LW.Squad.Num();
	const int64 LFee = LW.Loanables[0].LoanFee;
	const int32 LId = LW.Loanables[0].Player.Id;
	FString LGrund;
	const int64 LGeld = LW.Money;
	PRUEFE(LW.SignLoanPlayer(0, LGrund) && LW.Squad.Num() == LKader + 1 && LW.IncomingLoans.Num() == 1, "Leihe: Spieler kommt in den Kader (%s)", *LGrund);
	PRUEFE(LW.Money == LGeld - LFee && LW.IncomingLoans[0].MatchdaysLeft == 34, "Leihe: Gebuehr gezahlt, 34 Spieltage");
	// Kaufoption ziehen: Spieler bleibt dauerhaft
	const int64 LOpt = LW.IncomingLoans[0].BuyOptionFee;
	PRUEFE(LW.ExerciseLoanBuyOption(LId, LGrund) && LW.IncomingLoans.Num() == 0, "Kaufoption: Leihe endet");
	bool LDauer = false;
	for (const FFM13Player& P : LW.Squad) if (P.Id == LId && P.ContractYears == 3) LDauer = true;
	PRUEFE(LDauer && LW.Money == LGeld - LFee - LOpt, "Kaufoption: Vertrag drei Jahre, Ablöse gezahlt");
	// Ohne Kaufoption: die Leihe laeuft ab, der Spieler geht zurueck
	FFM13World LAb = LW;
	LAb.Loanables.Reset();
	FFM13Loanable LAbLei;
	LAbLei.Player = LAb.Squad[0];
	LAbLei.Player.Id = 777001;
	LAbLei.ParentClub = TEXT("Mutterklub");
	LAbLei.LoanFee = 1000;
	LAbLei.BuyOptionFee = 5000;
	LAb.Loanables.Add(LAbLei);
	FString LAbGrund;
	LAb.SignLoanPlayer(0, LAbGrund);
	LAb.IncomingLoans.Last().MatchdaysLeft = 1;
	const int32 LVorAb = LAb.Squad.Num();
	LAb.TickIncomingLoans();
	PRUEFE(LAb.Squad.Num() == LVorAb - 1 && LAb.IncomingLoans.Num() == 0, "Leihe abgelaufen: Spieler kehrt zurueck");
	// Leihe nur im Fenster
	FFM13World LSp = LW;
	LSp.Matchday = 10;
	FString LSpGrund;
	LSp.Loanables.Reset();
	LSp.Loanables.Add(LAbLei);
	PRUEFE(!LSp.SignLoanPlayer(0, LSpGrund) && LSpGrund.Contains(TEXT("Wechselfenster")), "Leihe ausserhalb des Fensters abgelehnt");
	// Deadline-Day: einmal je Fenster, mit Schnaeppchen und Ticker
	FFM13World DD;
	DD.NewGame(TEXT("Deadline"), 157, 0);
	DD.Matchday = 3;
	auto DeadlineMeldungen = [](const FFM13World& Welt) { int32 N = 0; for (const FFM13Message& M : Welt.Messages) if (M.Title.Contains(TEXT("DEADLINE"))) N++; return N; };
	DD.TickTransferWindows();
	const int32 DMit = DeadlineMeldungen(DD);
	DD.TickTransferWindows();
	PRUEFE(DD.LastDeadlineKey == TEXT("1-sommer") && DMit == 1 && DeadlineMeldungen(DD) == 1, "Deadline-Day: einmal je Fenster");
	int32 DBargain = 0;
	for (const FFM13MarketOffer& O : DD.Market) if (O.bDeadlineBargain) DBargain++;
	PRUEFE(DBargain == FMath::Min(2, DD.Market.Num()), "Deadline-Day: zwei Schnaeppchen");
	// Spielstand: Leihen, Fenster-Schluessel und Schnaeppchen bleiben
	FFM13World LSave = LW;
	LSave.Loanables.Reset();
	LSave.Loanables.Add(LAbLei);
	LSave.LastDeadlineKey = TEXT("1-sommer");
	FFM13World LSaveLd;
	FString LSaveFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(LSave), LSaveLd, LSaveFehler) && LSaveLd.Loanables.Num() == 1 && LSaveLd.LastDeadlineKey == TEXT("1-sommer") && LSaveLd.Loanables[0].ParentClub == TEXT("Mutterklub"), "Leihen und Fenster-Schluessel bleiben im Spielstand (%s)", *LSaveFehler);
	// Berater, freie Spieler, Tausch (js/entities.js, js/transfermarket.js, js/transfer-poker.js)
	FFM13World BW;
	BW.NewGame(TEXT("Berater"), 158, 0);
	BW.Money = 500000000;
	BW.TransferBudget = 500000000;
	BW.WageBudget = 1000000000;
	BW.Matchday = 2;
	const double Hash = FM13Transfers::HashEinheit(42, 1);
	PRUEFE(Hash >= 0.0 && Hash < 1.0 && Hash == FM13Transfers::HashEinheit(42, 1), "Berater: Kennungs-Wert ist fest und liegt zwischen 0 und 1");
	FFM13Player Mit;
	Mit.bHasAgent = true;
	Mit.AgentIndex = 2;
	Mit.AgentFeePct = 0.05;
	PRUEFE(BW.AgentFee(Mit, 1000000) == 50000 && BW.AgentFee(FFM13Player(), 1000000) == 0, "Berater: 5 Prozent der Ablöse, ohne Berater nichts");
	FString BGrund;
	BW.Money = 100000;
	PRUEFE(BW.ImproveAgentRelation(2, BGrund) && BW.Money == 97000 && BW.AgentRelation(2) == 5, "Beziehung: 3.000 Kosten, Stufe 5");
	PRUEFE(BW.AgentFee(Mit, 1000000) == 45000, "Beziehung senkt die Provision um 0,1 Prozentpunkte je Stufe");
	// Kauf mit Berater: Konto zahlt Ablöse und Provision, das Budget nur die Ablöse
	BW.Money = 500000000;
	BW.Market[0].Player.bHasAgent = true;
	BW.Market[0].Player.AgentIndex = 3;
	BW.Market[0].Player.AgentFeePct = 0.1;
	const int64 BPreis = BW.Market[0].Price;
	const int64 BGeld = BW.Money;
	const int64 BBudget = BW.TransferBudget;
	PRUEFE(BW.BuyPlayer(0, BGrund), "Kauf mit Berater gelingt (%s)", *BGrund);
	PRUEFE(BW.Money == BGeld - BPreis - FM13Transfers::JsRunden((double)BPreis * 0.1) && BW.TransferBudget == BBudget - BPreis, "Kauf: Konto zahlt Provision, Budget nur die Ablöse");
	// Verkauf: Provision wird abgezogen, das Budget steigt um 85 %
	FFM13IncomingOffer VO;
	VO.PlayerId = BW.Squad[0].Id; VO.PlayerName = BW.Squad[0].Name; VO.Club = TEXT("Kaeufer"); VO.Price = 2000000; VO.ExpiresMatchday = 9;
	BW.Squad[0].bHasAgent = true; BW.Squad[0].AgentFeePct = 0.05; BW.Squad[0].AgentIndex = 1;
	BW.IncomingOffers.Add(VO);
	const int64 VGeld = BW.Money;
	const int64 VBudget = BW.TransferBudget;
	PRUEFE(BW.AcceptIncomingOffer(BW.IncomingOffers.Num() - 1, BGrund), "Verkauf klappt (%s)", *BGrund);
	PRUEFE(BW.Money == VGeld + 2000000 - 100000 && BW.TransferBudget == VBudget + 1700000, "Verkauf: Berater kassiert 5 %%, Budget +85 %%");
	// Freie Spieler: Handgeld, Gegenangebot und Verpflichtung
	FFM13World FA;
	FA.NewGame(TEXT("Freie"), 159, 0);
	FA.Money = 500000000;
	FA.WageBudget = 1000000000;
	PRUEFE(FA.FreeAgents.Num() == 4, "Freie Spieler: vier je Markt-Neuaufbau");
	const int32 FKader = FA.Squad.Num();
	const int64 FGeld = FA.Money;
	const int64 FHandgeld = FA.FreeAgents[0].SignOnFee;
	bool FUnter = false;
	for (int32 k = 0; k < 10 && !FUnter; ++k)
	{
		FString FGrund;
		if (FA.SignFreeAgent(0, FGrund)) FUnter = true;
	}
	PRUEFE(FUnter && FA.Squad.Num() == FKader + 1 && FA.FreeAgents.Num() == 3, "Freie Spieler: unterschreibt nach höchstens zehn Versuchen");
	PRUEFE(FA.Money < FGeld && FA.Money >= FGeld - FHandgeld * 2, "Freie Spieler: Handgeld wird gebucht");
	// Tausch im Poker: Tauschspieler geht, Ablöse wird verrechnet
	FFM13World TW;
	TW.NewGame(TEXT("Tausch"), 160, 0);
	TW.Money = 500000000;
	TW.TransferBudget = 500000000;
	TW.WageBudget = 1000000000;
	TW.Matchday = 2;
	while (TW.Squad.Num() <= 18) { FFM13Player Kopie = TW.Squad[0]; Kopie.Id = TW.NextPlayerId++; TW.Squad.Add(Kopie); }
	TW.Squad[0].Age = 25;
	TW.Squad[0].Strength = 99;
	TW.Squad[0].MarketValue = 2000000;
	TW.Squad[0].InjuredMatchdays = 0;
	const int32 TauschId = TW.Squad[0].Id;
	FString TauGrund;
	TW.OpenPoker(TW.Market[0].Player.Id, TauGrund);
	TW.Poker.Offer = TW.Market[0].AskingPrice;
	TW.SubmitPokerOffer(TauGrund);
	const int64 TAblose = TW.Poker.AgreedFee;
	PRUEFE(TW.SetPokerSwap(TauschId, TauGrund), "Tausch: Spieler für den Tausch gewählt");
	const int64 TAnrechnung = FMath::Min<int64>(TAblose, FM13Transfers::JsRunden(1700000.0 / 1000.0) * 1000);
	const int64 TGeld = TW.Money;
	const int64 TBudget = TW.TransferBudget;
	const int32 TKader = TW.Squad.Num();
	PRUEFE(TW.SignPokerDeal(TauGrund), "Tausch: Unterschrift gelingt (%s)", *TauGrund);
	bool TWeg = true;
	for (const FFM13Player& P : TW.Squad) if (P.Id == TauschId) TWeg = false;
	PRUEFE(TWeg && TW.Squad.Num() == TKader, "Tausch: Tauschspieler geht, Kader bleibt gleich groß");
	PRUEFE(TW.Money == TGeld - (TAblose - TAnrechnung) && TW.TransferBudget == TBudget - ((TAblose - TAnrechnung) + FM13Transfers::JsRunden((double)TAnrechnung * 0.15)), "Tausch: bar und Budget nach Anrechnung");
	// Freier Vertragsschluss braucht die gesperrten Plaetze nicht
	FFM13World TSp = TW;
	TSp.Matchday = 1;
	(void)TSp;
	// Spielstand: Berater, freie Spieler und Verhandlungstausch bleiben
	FFM13World BSave = BW;
	BSave.FreeAgents = FA.FreeAgents;
	BSave.FreeNegotiation.PlayerId = 555;
	BSave.FreeNegotiation.CounterFee = 12345;
	FFM13World BLd;
	FString BFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(BSave), BLd, BFehler) && BLd.AgentRelation(2) == 5 && BLd.FreeAgents.Num() == BSave.FreeAgents.Num() && BLd.FreeNegotiation.CounterFee == 12345 && std::fabs(BLd.Squad[0].AgentFeePct - BSave.Squad[0].AgentFeePct) < 1e-6, "Berater und freie Spieler bleiben im Spielstand (%s)", *BFehler);
	// KI-Vereine (js/ai-clubs.js): Sterne, Alterung, Torgutschrift, Fenster-Wechsel
	FFM13World KI;
	KI.NewGame(TEXT("KIVereine"), 161, 0);
	KI.EnsureAiStars();
	bool KIAlleSterne = true;
	int32 KIAnzahl = 0;
	for (const FFM13League& L : KI.Leagues) for (const FFM13Club& C : L.Clubs) if (!C.bOwn) { KIAnzahl++; if (!C.bHasStar) KIAlleSterne = false; }
	PRUEFE(KIAlleSterne && KIAnzahl > 0, "KI-Vereine: jeder hat einen Star");
	// Alterung: Stern mit 33 wird Karriereende, der Verein bekommt einen neuen Stern
	int32 AltIdx = -1;
	for (int32 I = 0; I < KI.Leagues[0].Clubs.Num(); ++I) if (!KI.Leagues[0].Clubs[I].bOwn) { AltIdx = I; break; }
	const FString AltName = KI.Leagues[0].Clubs[AltIdx].StarName;
	KI.Leagues[0].Clubs[AltIdx].StarAge = 33;
	KI.AgeAiStars();
	bool KIRuhestand = false;
	for (const FFM13World::FFM13AiNews& N : KI.AiNews) if (N.bRetired) KIRuhestand = true;
	PRUEFE(KIRuhestand, "Karriereende: Meldung im Ticker (%s)", *AltName);
	// Torgutschrift: die Tore gehen an Star, Sturmspitze oder Mitspieler, nie mehr als vergeben
	FFM13Club& Tor = KI.Leagues[0].Clubs[1];
	Tor.bHasStar = true; Tor.StarPos = EFM13Position::ST; Tor.StarGoals = 0; Tor.bHasStriker = false; Tor.StrikerGoals = 0;
	KI.CreditAiLeagueGoals(Tor, 10);
	PRUEFE(Tor.bHasStriker && Tor.StarGoals + Tor.StrikerGoals <= 10 && Tor.StarGoals >= 0 && Tor.StrikerGoals >= 0, "Torgutschrift: nie mehr Tore als gefallen");
	// Fenster-Spieltag 2: der Ticker legt Wechsel an oder bleibt still, nie ohne Fenster
	FFM13World KF = KI;
	KF.Matchday = 5;
	const int32 KFNews = KF.AiNews.Num();
	KF.TickAiTransfers();
	PRUEFE(KF.AiNews.Num() == KFNews, "Kein Wechsel ausserhalb der Fenster");
	FFM13World KW2 = KI;
	KW2.Matchday = 2;
	KW2.TickAiTransfers();
	bool KIWechselOk = true;
	for (const FFM13World::FFM13AiNews& N : KW2.AiNews) if (!N.bRetired && (N.To.IsEmpty() || N.From == N.To || N.Fee <= 0)) KIWechselOk = false;
	PRUEFE(KIWechselOk, "Fenster 2: Wechsel haben Käufer, Verkäufer und Ablöse");
	// Financial Fairplay (js/ffp.js): Ausnahmen, Verwarnung, Sperre, Punktabzug, Spielstand
	FFM13World FF;
	FF.NewGame(TEXT("FFP"), 162, 0);
	FF.Money = 500000000;
	FF.Bookings.Reset();
	FFM13Booking FBuch;
	FBuch.Label = TEXT("Stadionausbau"); FBuch.Amount = -90000000; FBuch.Season = FF.Season;
	FF.Bookings.Add(FBuch);
	PRUEFE(FF.FfpSeasonNet() == 0, "FFP: Stadionausbau zaehlt nicht als Verlust");
	FBuch.Label = TEXT("Gehaelter"); FBuch.Amount = -20000000;
	FF.Bookings.Add(FBuch);
	PRUEFE(FF.FfpSeasonNet() == -20000000 && FF.FfpAllowedLossPerSeason() == 12800000, "FFP: Verlust zaehlt, erlaubt 20 Prozent der Liga-Basis (12,8 Mio.)");
	FF.EvaluateFinancialFairplay();
	PRUEFE(FF.FfpStrikes == 1 && !FF.bFfpEmbargo && FF.FfpLastResult.bVerstoss, "FFP: erste Verwarnung ohne Sperre");
	FF.Bookings.Reset();
	FBuch.Season = FF.Season; FBuch.Label = TEXT("Gehaelter"); FBuch.Amount = -20000000; FF.Bookings.Add(FBuch);
	FF.EvaluateFinancialFairplay();
	PRUEFE(FF.FfpStrikes == 2 && FF.bFfpEmbargo && FF.HasTransferEmbargo(), "FFP: zweiter Verstoss sperrt Transfers");
	FF.Bookings.Reset();
	FBuch.Season = FF.Season; FBuch.Amount = -20000000; FF.Bookings.Add(FBuch);
	FF.EvaluateFinancialFairplay();
	PRUEFE(FF.FfpStrikes == 3 && FF.PendingFfpDeduction == 3, "FFP: dritter Verstoss: drei Punkte Abzug vorgemerkt");
	// Punktabzug nach dem Tabellen-Neustart
	for (FFM13Club& C : FF.Leagues[FF.LeagueLevel].Clubs) if (C.bOwn) { C.Won = 2; C.Drawn = 0; }
	FF.ApplyPendingFfpPointDeduction();
	bool FPunkte = false;
	for (const FFM13Club& C : FF.Leagues[FF.LeagueLevel].Clubs) if (C.bOwn && C.Points() == 3) FPunkte = true;
	PRUEFE(FPunkte && FF.PendingFfpDeduction == 0, "FFP: Abzug von drei Punkten (6 auf 3)");
	// Sauberes Jahr lockert die Sanktionen
	FF.Bookings.Reset();
	FF.FfpHistory.Reset();
	FF.FfpHistory.Add(0); FF.FfpHistory.Add(0);
	FF.EvaluateFinancialFairplay();
	PRUEFE(FF.FfpStrikes == 2 && !FF.FfpLastResult.bVerstoss, "FFP: sauberes Jahr lockert eine Stufe");
	// Spielstand
	FFM13World FSave = FF;
	FFM13World FLd;
	FString FFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(FSave), FLd, FFehler) && FLd.FfpStrikes == FSave.FfpStrikes && FLd.FfpHistory.Num() == FSave.FfpHistory.Num() && FLd.bFfpEmbargo == FSave.bFfpEmbargo, "FFP bleibt im Spielstand (%s)", *FFehler);
	// Erfolgsbasierte Vertragsboni (js/bonusclauses.js)
	FFM13World BO;
	BO.NewGame(TEXT("Boni"), 163, 0);
	BO.Money = 500000000;
	FFM13Player& BP = BO.Squad[0];
	BP.MarketValue = 10000000;
	BP.bHasAgent = false;
	const int32 BId = BP.Id;
	FString BonGrund;
	PRUEFE(BO.BonusMindest(BP, 0) == 120000 && BO.BonusMindest(BP, 1) == 70000 && BO.BonusMindest(BP, 2) == 200000, "Boni: Mindestbetrag je Marktwert (1,2 / 0,7 / 2 Prozent)");
	PRUEFE(!BO.SetBonusClause(BId, 0, 5, 1000, BonGrund) && BonGrund.Contains(TEXT("mindestens")), "Boni: zu niedriger Betrag abgelehnt");
	const int32 BMoral = BP.Morale;
	PRUEFE(BO.SetBonusClause(BId, 0, 5, 120000, BonGrund) && BO.FindPlayer(BId)->Morale == FMath::Min(100, BMoral + 3), "Boni: Torbonus vereinbart, Moral +3");
	// Tore erreicht: Auszahlung einmal, danach nicht mehr
	FFM13Player* BPt = BO.FindPlayer(BId);
	BPt->GoalsSeason = 5;
	const int64 BonGeld = BO.Money;
	BO.CheckMatchdayBonusClauses(*BPt);
	PRUEFE(BO.Money == BonGeld - 120000 && BO.FindPlayer(BId)->bBonusBezahlt[0], "Boni: Torbonus bei 5 Toren ausgezahlt");
	BO.CheckMatchdayBonusClauses(*BO.FindPlayer(BId));
	PRUEFE(BO.Money == BonGeld - 120000, "Boni: nicht zweimal in einer Saison");
	// Beraterprovision kommt dazu
	FFM13World BA;
	BA.NewGame(TEXT("BoniBerater"), 164, 0);
	BA.Money = 500000000;
	FFM13Player& BAP = BA.Squad[0];
	BAP.MarketValue = 10000000;
	BAP.bHasAgent = true; BAP.AgentFeePct = 0.1; BAP.AgentIndex = 0;
	const int32 BAId = BAP.Id;
	BA.SetBonusClause(BAId, 1, 10, 100000, BonGrund);
	BA.FindPlayer(BAId)->Appearances = 10;
	const int64 BAGeld = BA.Money;
	BA.CheckMatchdayBonusClauses(*BA.FindPlayer(BAId));
	PRUEFE(BA.Money == BAGeld - 110000, "Boni: Einsatzbonus zuzueglich zehn Prozent Beraterprovision");
	// Aufstiegsbonus
	BO.SetBonusClause(BId, 2, 0, 200000, BonGrund);
	const int64 BAufGeld = BO.Money;
	BO.TriggerPromotionBonusClauses();
	PRUEFE(BO.Money == BAufGeld - 200000 && BO.FindPlayer(BId)->bBonusBezahlt[2], "Boni: Aufstiegsbonus bei vollzogenem Aufstieg");
	// Klausel entfernen zahlt nichts mehr
	BO.RemoveBonusClause(BId, 2, BonGrund);
	PRUEFE(!BO.FindPlayer(BId)->Bonus[2].bAktiv, "Boni: Klausel entfernt");
	// Spielstand
	FFM13World BSaveW = BO;
	FFM13World BLdW;
	FString BonFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(BSaveW), BLdW, BonFehler) && BLdW.FindPlayer(BId)->Bonus[0].Betrag == 120000 && BLdW.FindPlayer(BId)->bBonusBezahlt[0], "Boni bleiben im Spielstand (%s)", *BonFehler);
	// Mitgliederversammlung, Vorstand, Saisonwette (js/member-assembly.js, js/board-room.js)
	FFM13World MV;
	MV.NewGame(TEXT("Versammlung"), 165, 0);
	MV.Money = 1000000;
	const int32 MVErw = MV.GetSeasonExpectation().ExpectedRank;
	PRUEFE(MVErw >= 1 && MVErw <= FM13::TeamsPerLeague, "Platzerwartung liegt zwischen 1 und der Teamzahl");
	MV.PrepareMemberAssembly(3);
	MV.Money = 1500000;
	MV.OpenMemberAssembly();
	PRUEFE(MV.bHasMemberAssembly && MV.MemberAssembly.bOpen && MV.MemberAssembly.Report.FinanceResult == 500000, "Versammlung einberufen mit Finanzergebnis");
	FString MVGrund;
	PRUEFE(MV.SetAssemblyChoice(false, 2, MVGrund) && MV.SetAssemblyChoice(true, 1, MVGrund), "Beitragsantrag und Rede gewählt");
	const int64 MVGeld = MV.Money;
	const int32 MVBoard = MV.BoardSat;
	PRUEFE(MV.HoldMemberAssembly(false, MVGrund) && !MV.MemberAssembly.bOpen, "Versammlung abgehalten");
	PRUEFE(MV.Money == MVGeld + 120000 && MV.MemberAssembly.Money == 120000, "Beitrag erhöhen bringt 120.000 in der Bundesliga");
	PRUEFE(MV.MemberAssembly.Zustimmung >= 5 && MV.MemberAssembly.Zustimmung <= 95, "Zustimmung liegt zwischen 5 und 95");
	const int32 MVZ = MV.MemberAssembly.Zustimmung;
	const int32 MVErwartet = MVZ >= 70 ? 10 : (MVZ >= 50 ? 5 : -10);
	PRUEFE(MV.MemberAssembly.BoardDelta == MVErwartet && MV.BoardSat == FMath::Clamp(MVBoard + MVErwartet, 10, 100), "Vorstand folgt der Zustimmung (%d %%)", MVZ);
	// Unvorbereitet: nach sechs Spieltagen findet sie ohne den Manager statt
	FFM13World MA;
	MA.NewGame(TEXT("Automatik"), 166, 0);
	MA.PrepareMemberAssembly(10);
	MA.OpenMemberAssembly();
	MA.Matchday = MA.MemberAssembly.OpenedMatchday + 6;
	MA.TickMemberAssembly();
	PRUEFE(!MA.MemberAssembly.bOpen && MA.MemberAssembly.bAutomatisch, "Versammlung nach sechs Spieltagen ohne den Manager");
	// Vorstand meldet sich bei schlechter Stimmung, einmal je Saison
	FFM13World VS;
	VS.NewGame(TEXT("Vorstand"), 167, 0);
	VS.BoardSat = 20;
	const int32 VSVorher = VS.Messages.Num();
	VS.TickBoardRoom();
	const int32 VSNach = VS.Messages.Num();
	VS.TickBoardRoom();
	PRUEFE(VSNach > VSVorher && VS.Messages.Num() == VSNach, "Vorstand: unzufriedenes Mitglied meldet sich einmal je Saison");
	// Saisonwette: zwei Plaetze besser, gewonnen mit Praemie
	FFM13World WT;
	WT.NewGame(TEXT("Wette"), 168, 0);
	WT.Money = 1000000;
	WT.Expectation.ExpectedRank = 9;
	WT.Expectation.Season = WT.Season;
	FString WGrund;
	PRUEFE(WT.SetSaisonWette(WGrund) && WT.Wette.Platz == 7, "Wette: Platz zwei besser als die Erwartung");
	PRUEFE(!WT.SetSaisonWette(WGrund), "Wette: nur einmal je Saison");
	WT.BoardSat = 50;
	const int64 WGeld = WT.Money;
	WT.ResolveSaisonWette(6);
	PRUEFE(WT.BoardSat == 62 && WT.Money == WGeld + 900000 && !WT.bHasWette, "Wette gewonnen: Prämie 900.000 und Vorstand +12");
	// Spielstand
	FFM13World MVSave = MV;
	FFM13World MVLd;
	FString MVFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(MVSave), MVLd, MVFehler) && MVLd.MemberAssembly.Zustimmung == MV.MemberAssembly.Zustimmung && MVLd.Expectation.ExpectedRank == MV.Expectation.ExpectedRank, "Versammlung und Erwartung bleiben im Spielstand (%s)", *MVFehler);
	// Wintergespraech (js/winter-talk.js)
	FFM13World WG;
	WG.NewGame(TEXT("Winter"), 169, 0);
	WG.Money = 1000000;
	WG.Matchday = 18;
	WG.Expectation.Season = WG.Season;
	WG.Expectation.ExpectedRank = 9;
	WG.Expectation.Teams = 18;
	WG.TransferBudget = 0;
	const int32 WGBoard = WG.BoardSat;
	FString WGGrund;
	PRUEFE(WG.IsWinterTalkOpen() && WG.WinterBudgetAmount() == 7500000, "Winter: offen an Spieltag 18, Budget 30 Prozent der Liga-Basis (7,5 Mio.)");
	PRUEFE(WG.ChooseWinterTalk(FFM13World::EWinterWeg::Hoch, WGGrund) && WG.WinterTalk.Goal == 7 && WG.TransferBudget == 7500000 && WG.BoardSat == FMath::Min(100, WGBoard + 5), "Winter hoch: Ziel Platz 7, Budget frei, Vorstand +5");
	PRUEFE(!WG.ChooseWinterTalk(FFM13World::EWinterWeg::Kurs, WGGrund) && WGGrund.Contains(TEXT("schon")), "Winter: nur ein Weg je Saison");
	// Versprechen gehalten: Platz 6 erreicht das Ziel 7
	FFM13World WGOk = WG;
	WGOk.ResolveWinterTalk(6);
	PRUEFE(WGOk.WinterTalk.Result == 1, "Winter: versprochenes Ziel erreicht");
	// Versprechen gebrochen: Platz 9
	FFM13World WGNein = WG;
	WGNein.BoardSat = 50;
	WGNein.ResolveWinterTalk(9);
	PRUEFE(WGNein.WinterTalk.Result == 2 && WGNein.BoardSat == 40, "Winter: versprochenes Ziel verfehlt, Vorstand -10");
	// Runter: Ziel zwei Plaetze tiefer, Vorstand -4
	FFM13World WGR;
	WGR.NewGame(TEXT("WinterRunter"), 170, 0);
	WGR.Matchday = 19;
	WGR.Expectation.Season = WGR.Season; WGR.Expectation.ExpectedRank = 9; WGR.Expectation.Teams = 18;
	WGR.BoardSat = 50;
	PRUEFE(WGR.ChooseWinterTalk(FFM13World::EWinterWeg::Runter, WGGrund) && WGR.Expectation.ExpectedRank == 11 && WGR.BoardSat == 46, "Winter runter: Ziel Platz 11, Vorstand -4");
	// Verpasst: nach Spieltag 20 ohne Gespraech
	FFM13World WV;
	WV.NewGame(TEXT("WinterVerpasst"), 171, 0);
	WV.Matchday = 21;
	WV.BoardSat = 50;
	WV.TickWinterTalk();
	PRUEFE(WV.WinterTalk.Weg == FFM13World::EWinterWeg::Verpasst && WV.BoardSat == 48, "Winter verpasst: Vorstand -2");
	// Budget: bewilligt oder abgelehnt, genau eines davon
	FFM13World WB;
	WB.NewGame(TEXT("WinterBudget"), 172, 0);
	WB.Matchday = 18;
	WB.Expectation.Season = WB.Season; WB.Expectation.ExpectedRank = 9; WB.Expectation.Teams = 18;
	WB.BoardSat = 50;
	const int32 WBVor = WB.BoardSat;
	const int64 WBBudget = WB.TransferBudget;
	WB.ChooseWinterTalk(FFM13World::EWinterWeg::Budget, WGGrund);
	const bool WBJa = WB.TransferBudget == WBBudget + 7500000;
	const bool WBNein = WB.BoardSat == FMath::Max(10, WBVor - 3);
	PRUEFE(WBJa != WBNein, "Winter Budget: entweder bewilligt oder abgelehnt");
	// Spielstand
	FFM13World WSave = WG;
	FFM13World WLd;
	FString WFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(WSave), WLd, WFehler) && WLd.bHasWinterTalk && WLd.WinterTalk.Goal == 7 && WLd.TransferBudget == 7500000, "Wintergespraech bleibt im Spielstand (%s)", *WFehler);
	// Immobilien und Rohstoffboerse (js/real-estate.js, js/commodities.js)
	FFM13World IM;
	IM.NewGame(TEXT("Immo"), 173, 0);
	IM.Money = 500000000;
	PRUEFE(IM.ImmobilienKosten(0) == 3200000 * 0.035 * 0 + 3200000 && IM.ImmobilienKosten(0) == 3200000, "Immobilien: Kosten Stufe 1 = Grundpreis (Bundesliga-Skala 1,0)");
	FString IGrund;
	const int64 IGeld = IM.Money;
	PRUEFE(IM.KaufeOderAusbaueImmobilie(0, IGrund) && IM.Money == IGeld - 3200000 && IM.ImmobilienBauten.Num() == 1, "Kauf: voll bezahlt, Baustelle startet");
	PRUEFE(!IM.KaufeOderAusbaueImmobilie(0, IGrund) && IGrund.Contains(TEXT("Baustelle")), "Immobilien: nur eine Baustelle je Objekt");
	// Bauzeit: Kosten geteilt durch 400.000, mindestens zehn Spieltage
	PRUEFE(IM.ImmobilienBauten[0].TageRest == 10, "Bauzeit: mindestens zehn Spieltage");
	for (int32 t = 0; t < 10; ++t) IM.TickImmobilien();
	PRUEFE(IM.Immobilien[0].bBesitz && IM.Immobilien[0].Stufe == 1 && IM.ImmobilienBauten.Num() == 0, "Fertig: Objekt gehoert dem Verein, Stufe 1");
	PRUEFE(IM.ImmobilienMiete(0) == 12600, "Miete Stufe 1 = Grundmiete");
	const int64 IMiet = IM.Money;
	IM.TickImmobilien();
	PRUEFE(IM.Money == IMiet + 12600, "Mieteinnahmen je Spieltag aufs Konto");
	PRUEFE(IM.KaufeOderAusbaueImmobilie(0, IGrund) && IM.ImmobilienKosten(0) == 6400000, "Ausbau Stufe 2 kostet das Doppelte");
	// Verkauf zu 55 Prozent
	FFM13World IV = IM;
	const int64 IVGeld = IV.Money;
	IV.ImmobilienBauten.Reset();
	FString IVGrund;
	PRUEFE(IV.VerkaufeImmobilie(0, IVGrund) && IV.Money == IVGeld + FM13Transfers::JsRunden(3200000.0 * 1 * 2 / 2.0 * 0.55) && !IV.Immobilien[0].bBesitz, "Verkauf: 55 Prozent der gezahlten Summe");
	// Rohstoffboerse: Preise bleiben in ihren Grenzen
	for (int32 t = 0; t < 200; ++t) IM.TickCommodityMarket();
	bool IGrenzen = true;
	for (int32 k = 0; k < 4; ++k) if (IM.Rohstoffe[k].Preis < IM.Rohstoffe[k].MinPreis - 1e-9 || IM.Rohstoffe[k].Preis > IM.Rohstoffe[k].MaxPreis + 1e-9) IGrenzen = false;
	PRUEFE(IGrenzen && IM.RohstoffEreignis.Len() > 0, "Rohstoffboerse: Preise bleiben zwischen Mindest- und Hoechstpreis");
	FFM13World ILd;
	FString IFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(IM), ILd, IFehler) && ILd.Immobilien[0].Stufe == IM.Immobilien[0].Stufe && ILd.Rohstoffe[0].Preis == IM.Rohstoffe[0].Preis, "Immobilien und Rohstoffe bleiben im Spielstand (%s)", *IFehler);
	// Holding und Industrie (js/industry.js, js/holding.js)
	FFM13World HI;
	HI.NewGame(TEXT("Holding"), 174, 0);
	HI.Money = 500000000;
	PRUEFE(HI.HoldingGeld == 50000 && HI.HoldingWert() == 50000, "Holding: Startgeld 50.000, Wert 50.000");
	FString HGrund;
	PRUEFE(!HI.KaufeFabrik(0, HGrund) && HGrund.Contains(TEXT("reicht nicht")), "Fabrik: Holding-Konto reicht nicht");
	HI.HoldingGeld = 1000000;
	PRUEFE(HI.KaufeFabrik(0, HGrund) && HI.Fabriken[0].bBesitz && HI.HoldingGeld == 400000, "Fabrik gekauft, bezahlt vom Holding-Konto");
	PRUEFE(HI.HoldingWert() == 530000, "Holdingwert: 50.000 plus 80 Prozent der Fabrikkosten (600.000)");
	PRUEFE(HI.ProduktionsDauer(0) == 4 && HI.ProduktionsDauer(1) == 4, "Produktionsdauer Stufe 1: vier Spieltage");
	// Produktion: Trikots aus Baumwolle, nach vier Spieltagen im Lager
	const int32 HLager = HI.Waren[0].Lager;
	const int32 HRoh = HI.Rohstoffe[0].Lager;
	PRUEFE(HI.StarteProduktion(0, 100, HGrund) && HI.Produktionen.Num() == 1 && HI.Rohstoffe[0].Lager == HRoh - 100, "Produktion: 100 Trikots verbrauchen 100 kg Baumwolle");
	for (int32 t = 0; t < 4; ++t) HI.TickProduktion();
	PRUEFE(HI.Produktionen.Num() == 0 && HI.Waren[0].Lager == HLager + 100, "Produktion: nach vier Spieltagen im Lager");
	PRUEFE(!HI.StarteProduktion(1, 10, HGrund) && HGrund.Contains(TEXT("Fabrik")), "Produktion ohne Fabrik abgelehnt");
	// Rohstoffe und Lager
	const int64 HKaufPreis = FM13Transfers::JsRunden(HI.Rohstoffe[0].Preis * 100);
	const int64 HVorKauf = HI.HoldingGeld;
	PRUEFE(HI.KaufeRohstoff(0, 100, HGrund) && HI.HoldingGeld == HVorKauf - HKaufPreis, "Rohstoff gekauft, bezahlt vom Holding-Konto");
	PRUEFE(HI.LagerKapazitaet() == 2000 && !HI.KaufeRohstoff(0, 2000, HGrund) && HGrund.Contains(TEXT("Lagerkapazitaet")), "Lager voll: kein Zukauf ueber die Kapazitaet");
	PRUEFE(HI.AusbaueLager(HGrund) && HI.LagerKapazitaet() == 4000, "Zentrallager ausgebaut, Kapazitaet verdoppelt");
	// Lohnfertigung: Auftrag 1 braucht 1000 kg Baumwolle
	HI.Rohstoffe[0].Lager = 500;
	PRUEFE(!HI.ErfuelleB2B(1, HGrund) && HGrund.Contains(TEXT("Rohstoff")), "Lohnfertigung: zu wenig Rohstoff");
	HI.Rohstoffe[0].Lager = 2000;
	const int64 HGeldB2B = HI.HoldingGeld;
	PRUEFE(HI.ErfuelleB2B(1, HGrund) && HI.B2BAuftraege[0].bErledigt && HI.HoldingGeld == HGeldB2B + 65000, "Lohnfertigung ausgeliefert, Honorar 65.000 aufs Holding-Konto");
	// Saisonstart: je eigener Fabrik ein neuer Auftrag
	HI.ErneuereB2BAuftraege();
	bool HNeuerAuftrag = false;
	for (const FFM13World::FFM13B2BAuftrag& Neu : HI.B2BAuftraege) if (Neu.Fabrik == 0 && !Neu.bErledigt) HNeuerAuftrag = Neu.Honorar > 0;
	PRUEFE(HNeuerAuftrag, "Saisonstart: neuer Lohnfertigungs-Auftrag fuer die Textilfabrik");
	// Ueberweisungen zwischen Verein und Holding
	const int64 HVerein = HI.Money;
	const int64 HHold = HI.HoldingGeld;
	PRUEFE(HI.UeberweisungZurHolding(100000, HGrund) && HI.Money == HVerein - 100000 && HI.HoldingGeld == HHold + 100000, "Ueberweisung Verein zur Holding");
	PRUEFE(HI.UeberweisungVonHolding(100000, HGrund) && HI.Money == HVerein && HI.HoldingGeld == HHold, "Ueberweisung Holding zum Verein");
	// Fusion: schwacher Konkurrent (unter 50) und 1,5 mal Kosten
	HI.Konkurrenten[0].Staerke = 40;
	HI.HoldingGeld = 2000000;
	PRUEFE(HI.FusioniereFabrik(0, HGrund) && HI.Fabriken[0].Stufe == 2 && HI.Konkurrenten.Num() == 2, "Fusion: Fabrik eine Stufe hoeher, Konkurrent verschwindet");
	// Uebernahmeangebot annehmen: Holding geht, Fabriken gehen weg
	HI.Uebernahmen.Add(FFM13World::FFM13Uebernahme{ TEXT("TexPro Industries"), 1000000, HI.Matchday + 5 });
	const int64 HVorUebernahme = HI.Money;
	PRUEFE(HI.AntworteUebernahme(true, HGrund) && HI.Money == HVorUebernahme + 1000000 && !HI.Fabriken[0].bBesitz && HI.Uebernahmen.Num() == 0, "Uebernahme angenommen: Verkaufserloes, Fabriken weg");
	// Spielstand
	FFM13World HSave = HI;
	FFM13World HLd;
	FString HFehler;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(HSave), HLd, HFehler) && HLd.HoldingGeld == HSave.HoldingGeld && HLd.Waren[0].Lager == HSave.Waren[0].Lager && HLd.B2BAuftraege.Num() == HSave.B2BAuftraege.Num() && HLd.Fabriken[0].Stufe == HSave.Fabriken[0].Stufe, "Holding und Industrie bleiben im Spielstand (%s)", *HFehler);
	// Gehaltsbudget und Vertragsforderung (js/season-end.js, js/contracts.js), von Hand nachgerechnet
	PRUEFE(FFM13World::LeagueWageBudget(0) == 1575000 && FFM13World::LeagueWageBudget(5) == 8000 && FFM13World::LeagueWageBudget(9) == 8000, "Liga-Gehaltsbudget je Stufe, begrenzt");
	FFM13World GB;
	GB.NewGame(TEXT("Gehaltsbudget"), 175, 5);
	PRUEFE(GB.WageBudget == 8000, "Karrierestart 6. Liga: Gehaltsbudget 8.000 je Spieltag");
	GB.Squad.Reset();
	FFM13Player GP;
	GP.Id = 9001; GP.Name = TEXT("Testspieler"); GP.Wage = 1000; GP.Morale = 50; GP.ContractYears = 3; GP.Strength = 50; GP.MarketValue = 15000; GP.Age = 25;
	GB.Squad.Add(GP);
	GB.Money = -1;
	PRUEFE(GB.WageBudgetFloor() == 1000, "Untergrenze: Konto im Minus friert die laufenden Gehaelter ein");
	GB.Money = 1000000;
	PRUEFE(GB.WageBudgetFloor() == 2000, "Untergrenze: 1.000 plus 5 Prozent Spielraum, auf 1.000 aufgerundet");
	const int64 GBNach = GB.ApplyRelegationWageClause();
	PRUEFE(GBNach == 600 && GB.Squad[0].Wage == 600 && GB.Squad[0].Morale == 47, "Abstiegsklausel: Gehalt -40 Prozent, Moral -3");
	// Ruecklagen: 10 Mio. Konto, Reserve = max(600, 4.000) x 17 = 68.000
	GB.WageBudget = 8000;
	GB.TransferBudget = 0;
	GB.Money = 10000000;
	GB.ApplyCashSurplusBudgets();
	PRUEFE(GB.TransferBudget == 3950000 && GB.WageBudget == 8000 + 29000, "Ruecklagen: 40 Prozent ins Transferbudget, 10 Prozent auf 34 Spieltage ins Gehaltsbudget");
	// Forderung bei der Verlaengerung: einziger Spieler ist Top 3 und Stammspieler, Faktor 1,25
	const int32 GBMarkt = FM13Economy::Wage(GB.Squad[0].MarketValue, GB.Squad[0].Strength);
	const int32 GBSoll = (int32)(FM13Transfers::JsRunden(FMath::Max(600.0, (double)GBMarkt * 1.25) / 10.0) * 10);
	PRUEFE(GB.RenewalWage(GB.Squad[0]) == GBSoll, "Verlaengerung: Marktgehalt x 1,25 fuer die Top 3, nie unter dem alten Gehalt");
	PRUEFE(GB.RenewalSigningFee(GB.Squad[0], 2) == 2 * FMath::Max<int64>(1500, FM13Transfers::JsRunden((double)GBSoll * 4.0 / 100.0) * 100), "Handgeld: vier Spieltagsgehaelter je Jahr, mindestens 1.500");
	GB.Squad[0].ContractYears = 1;
	GB.WageBudget = 1000000;
	const int64 GBGeld = GB.Money;
	FString GBGrund;
	PRUEFE(GB.RenewContract(9001, 2, GBGrund) && GB.Money < GBGeld && GB.Squad[0].Wage == GBSoll, "Verlaengerung bucht das Handgeld und setzt das neue Gehalt (%s)", *GBGrund);
	// Konto zu klein fuer den Check: nichts wird abgebucht
	FFM13World K;
	K.NewGame(TEXT("Knapp"), 143, 0);
	K.Money = 50000000;
	const int32 IdK = K.Market[0].Player.Id;
	K.OpenPoker(IdK, G);
	K.Poker.Offer = K.Market[0].AskingPrice;
	K.SubmitPokerOffer(G);
	K.Money = 100;
	K.Market[0].bMedicalRolled = true;
	PRUEFE(!K.RunMedicalCheck(G) && K.Money == 100 && !K.Market[0].Medical.bChecked, "Zu wenig Geld: kein Check, nichts abgebucht");
	std::printf("\n");
}

// Transferpoker (js/transfer-poker.js): Forderung, Schmerzgrenze, Gehalt. Werte von Hand nach den JS-Formeln gerechnet.
static void TestTransferpoker()
{
	std::printf("Transferpoker: Runden, Forderung, Gehalt, Verhandlung\n");
	PRUEFE(FM13Poker::Runden(12345) == 12300 && FM13Poker::Runden(123456) == 123000 && FM13Poker::Runden(99950) == 100000, "Runden: unter 100.000 auf 100, darueber auf 1.000");
	PRUEFE(FM13Poker::Schmerzgrenze(1000000, 2) == 920000, "Schmerzgrenze: 1 Mio x (0,82 + 2 x 0,05) = 920.000");
	PRUEFE(FM13Poker::Forderung(1000000, 2, 920000, 0.0) == 1080000, "Forderung: 1 Mio x (1 + 2 x 0,04) = 1.080.000");
	PRUEFE(FM13Poker::Gehaltsforderung(8000, 1.0, 0.5, false) == 8480, "Gehalt: 8000 x 1,06 = 8480");
	PRUEFE(FM13Poker::Nachverhandlung(8480, true) == 7630 && FM13Poker::Nachverhandlung(8480, false) == 8900, "Nachverhandlung: x 0,9 oder x 1,05");
	PRUEFE(std::fabs(FM13Poker::NachverhandlungChance(1.0) - 0.525) < 1e-9 && std::fabs(FM13Poker::NachverhandlungChance(1.35) - 0.21) < 1e-9, "Chance: 0,525 bei Zaehigkeit 1, 0,21 bei 1,35");
	PRUEFE(FM13Poker::RivalenGebot(1000000, 0.0) == 1050000, "Rivale: 1,05 x Schmerzgrenze");

	FFM13World W;
	W.NewGame(TEXT("Transfer"), 131, 0);
	W.Money = 50000000;
	PRUEFE(W.Market.Num() > 0, "Markt ist gefuellt");
	for (const FFM13MarketOffer& O : W.Market)
		if (O.SellerMinimum <= 0 || O.AskingPrice < O.SellerMinimum || O.Price != O.AskingPrice || O.SellerClub.IsEmpty())
		{ PRUEFE(false, "Markt: Verkaeufer und Preise gesetzt"); break; }
	FString G;
	const int32 Id = W.Market[0].Player.Id;
	PRUEFE(W.OpenPoker(Id, G) && W.Poker.bActive && W.Poker.Offer == FM13Poker::Runden(W.Market[0].AskingPrice * 0.85), "Verhandlung: Angebot 85 %% der Forderung");
	// Volles Angebot: sofort Einigung, danach Gehalt und Verpflichtung
	W.Poker.Offer = W.Market[0].AskingPrice;
	PRUEFE(W.SubmitPokerOffer(G) && W.Poker.AgreedFee == W.Market[0].AskingPrice && W.Poker.WageDemand > 0, "Angebot in Hoehe der Forderung: Einigung");
	const int64 VorKauf = W.Money;
	const int64 Fee = W.Poker.AgreedFee;
	PRUEFE(W.HagglePokerWage(G) && !W.HagglePokerWage(G), "Gehalt nur einmal nachverhandeln");
	const int64 Gehalt = W.Poker.WageDemand;
	const int32 Kader = W.Squad.Num();
	PRUEFE(W.SignPokerDeal(G) && W.Squad.Num() == Kader + 1 && W.Money == VorKauf - Fee && !W.Poker.bActive && W.MarketIndexOf(Id) < 0, "Vertrag: Kader +1, Konto -Ablöse, Verhandlung beendet");
	bool bGehalt = false;
	for (const FFM13Player& P : W.Squad) if (P.Id == Id && P.Wage >= Gehalt - 1 && P.Wage <= Gehalt + 1) bGehalt = true;
	PRUEFE(bGehalt, "Der neue Spieler bekommt das verhandelte Gehalt");

	// Zu wenig geboten: die Verkaeufer gehen auf, bis die Geduld aufgebraucht ist
	FFM13World A;
	A.NewGame(TEXT("Frech"), 132, 0);
	A.Money = 5000000;
	const int32 IdA = A.Market[0].Player.Id;
	A.OpenPoker(IdA, G);
	A.Poker.Patience = 1;
	A.Poker.Offer = 100;
	A.SubmitPokerOffer(G);
	PRUEFE(!A.Poker.bActive && A.MarketIndexOf(IdA) >= 0 && A.Market[A.MarketIndexOf(IdA)].bPokerBroken, "Frech geboten: Verein bricht ab, nur noch Sofortkauf");
	PRUEFE(!A.OpenPoker(IdA, G), "Nach dem Abbruch keine neue Verhandlung");

	FFM13World Sp;
	Sp.NewGame(TEXT("Pokerspeicher"), 133, 0);
	Sp.Money = 5000000;
	Sp.OpenPoker(Sp.Market[0].Player.Id, G);
	FFM13World Ld;
	FString Fehler;
	const bool bOk = FM13Save::Decode(FM13Save::Encode(Sp), Ld, Fehler);
	PRUEFE(bOk && Ld.Poker.bActive && Ld.Poker.PlayerId == Sp.Poker.PlayerId && Ld.Poker.Offer == Sp.Poker.Offer && Ld.Market[0].SellerClub == Sp.Market[0].SellerClub
		&& Ld.Market[0].AskingPrice == Sp.Market[0].AskingPrice, "Transfer bleibt im Spielstand (%s)", *Fehler);
	std::printf("\n");
}

// Ueber eine ganze Saison: Kondition und Tagesform bleiben in ihren Grenzen, Sommerpause setzt Kondition auf 100
static void TestKonditionSaison()
{
	FFM13World W;
	W.NewGame(TEXT("Konditionsverein"), 91);
	for (int i = 0; i < 34; ++i) W.PlayMatchday();
	bool bGrenzen = true;
	int32 Kondition10 = 0;
	for (const FFM13Player& P : W.Squad)
	{
		if (P.Fitness < 10 || P.Fitness > 100 || P.DailyForm < 5 || P.DailyForm > 95) bGrenzen = false;
		if (P.Fitness < 40) ++Kondition10;
	}
	PRUEFE(bGrenzen, "Kondition 10-100 und Tagesform 5-95 nach einer Saison");
	// Personal und Perk überstehen den Spielstand
	FFM13World Stab;
	Stab.NewGame(TEXT("Stabverein"), 92);
	Stab.AthletikTrainer.bHired = true; Stab.Ernaehrungsberater.bHired = true; Stab.Ernaehrungsberater.Level = 3;
	Stab.Ernaehrungsberater.Task = TEXT("leistung"); Stab.bFitnessGuru = true; Stab.Greenkeeper.bHired = true; Stab.Greenkeeper.Task = TEXT("tempo");
	FFM13World Lade;
	FString Fehler;
	const bool bGelesen = FM13Save::Decode(FM13Save::Encode(Stab), Lade, Fehler);
	PRUEFE(bGelesen && Lade.AthletikTrainer.bHired && Lade.Ernaehrungsberater.Level == 3 && Lade.Ernaehrungsberater.Task == TEXT("leistung") && Lade.bFitnessGuru && Lade.Greenkeeper.Task == TEXT("tempo") && !Lade.Physio.bHired,
		"Personal und Perk bleiben im Spielstand erhalten (%s)", *Fehler);
	W.ConcludeSeason();
	bool bSommer = true;
	for (const FFM13Player& P : W.Squad) if (P.Fitness != 100) bSommer = false;
	PRUEFE(bSommer, "Sommerpause: Kondition 100");
}

// Runde C (Spielerstatistik): Vorlagen, Noten nach jedem Ligaspiel, Saisonwechsel
static void TestSpielerNoten()
{
	std::printf("Runde C: Vorlagen, Noten, Saisonwechsel\n");
	FFM13World W;
	W.NewGame(TEXT("Notenverein"), 77);
	for (int i = 0; i < 34; ++i) W.PlayMatchday();
	int32 Vorlagen = 0, Tore = 0, Noten = 0, Einsaetze = 0;
	bool bNotenOk = true, bNotenAnzahl = true;
	for (const FFM13Player& P : W.Squad)
	{
		Vorlagen += P.Assists;
		Tore += P.GoalsSeason;
		if (P.GradeGames > 0) ++Noten;
		if (P.GradeGames != P.Appearances) bNotenAnzahl = false;
		if (P.GradeGames > 0 && (P.GradeSum < 10 * P.GradeGames || P.GradeSum > 60 * P.GradeGames)) bNotenOk = false;
		if (P.LastGrade != 0 && (P.LastGrade < 10 || P.LastGrade > 60)) bNotenOk = false;
		Einsaetze += P.Appearances;
	}
	PRUEFE(Vorlagen <= Tore, "Vorlagen (%d) hoechstens so viele wie Tore (%d)", Vorlagen, Tore);
	PRUEFE(Vorlagen > 0, "Es gibt Vorlagen in der Saison");
	PRUEFE(bNotenOk, "Noten liegen zwischen 1,0 und 6,0");
	PRUEFE(bNotenAnzahl, "Jeder Einsatz in der Liga hat genau eine Note");
	PRUEFE(Noten >= 11 && Einsaetze > 0, "Mindestens elf Spieler mit Note");
	W.ConcludeSeason();
	int32 Rest = 0;
	for (const FFM13Player& P : W.Squad) { if (P.Assists != 0 || P.GradeGames != 0 || P.LastGrade != 0) ++Rest; }
	PRUEFE(Rest == 0, "Saisonwechsel setzt Vorlagen und Noten zurueck");
	std::printf("\n");
}

static void TestRundeB()
{
	std::printf("Runde B: Aufstellung, Moral, Ansprache, Vorbereitung, Prognose, Derby, Europapokal, Auszeichnungen\n");
	FFM13World W;
	W.NewGame(TEXT("Aufstellungsverein"), 41);
	FString Grund;
	// Eigene Aufstellung: Spieler raus, Ersatz kommt automatisch, außerhalb der Position -10
	const TArray<int32> Auto = W.StartingEleven();
	const int32 Raus = Auto[3];
	PRUEFE(W.ToggleLineupPlayer(Raus, Grund) && W.ManualLineup.Num() == 10 && !W.StartingEleven().Contains(Raus) && W.StartingEleven().Num() == 11, "Spieler raus, Elf wird ohne ihn aufgefuellt");
	TArray<int32> BankIds;
	for (const FFM13Player& P : W.Squad) if (!W.ManualLineup.Contains(P.Id) && P.Id != Raus && P.IsAvailable()) BankIds.Add(P.Id);
	PRUEFE(BankIds.Num() >= 2 && W.ToggleLineupPlayer(BankIds[0], Grund) && W.StartingEleven().Contains(BankIds[0]) && W.ManualLineup.Num() == 11, "Bankspieler eingewechselt");
	PRUEFE(!W.ToggleLineupPlayer(BankIds[1], Grund) && Grund.Contains(TEXT("voll")), "Volle Elf nimmt niemanden mehr auf");
	PRUEFE(W.ToggleLineupPlayer(Raus, Grund) == false, "Herausgenommener kommt nicht ueber die volle Elf zurueck");
	// Elf nur aus Torhütern und Stürmern: Positionsstrafe senkt die Stärke
	TArray<int32> Falsch;
	for (const FFM13Player& P : W.Squad) if ((P.Pos == EFM13Position::ST || P.Pos == EFM13Position::TW) && Falsch.Num() < 6) Falsch.Add(P.Id);
	for (const FFM13Player& P : W.Squad) if (P.Pos == EFM13Position::ABW && Falsch.Num() < 11) Falsch.Add(P.Id);
	const int32 StaerkeAuto = (W.ClearManualLineup(), W.OwnStrength());
	// Wie im Browserspiel (calcTeamStrength) zaehlt die Staerke der gewaehlten Spieler, unabhaengig von der Position
	double Summe = 0.0; int32 Anzahl = 0;
	for (int32 Id : Falsch) { Summe += W.FindPlayer(Id)->Strength; ++Anzahl; }
	PRUEFE(W.SetManualLineup(Falsch, Grund) && Anzahl == 11 && W.OwnStrength() == FMath::RoundToInt((float)(Summe / 11.0)), "Die Elf zaehlt mit der Staerke der Spieler, nicht mit der Position (%d)", W.OwnStrength());
	(void)StaerkeAuto;
	W.ClearManualLineup();
	// Verletzte Stammkraft in der eigenen Elf wird ersetzt
	TArray<int32> Elf = W.StartingEleven();
	W.SetManualLineup(Elf, Grund);
	W.FindPlayer(Elf[0])->InjuredMatchdays = 3;
	PRUEFE(!W.StartingEleven().Contains(Elf[0]) && W.StartingEleven().Num() == 11, "Verletzte aus der eigenen Elf werden ersetzt");
	W.FindPlayer(Elf[0])->InjuredMatchdays = 0;
	W.ClearManualLineup();

	// Kabinenansprache wie computePregameTalkBonus()
	for (FFM13Player& P : W.Squad) { P.Character = 0; P.Morale = 65; } // alle ruhig
	const float Fokus = W.TalkBonus(TEXT("fokus"));
	const float Druck = W.TalkBonus(TEXT("druck"));
	PRUEFE(Fokus >= 1.75f - 0.01f && Fokus <= 2.5f + 0.01f, "Fokus mit ruhiger Elf: Lage + 1,0 (%.2f)", Fokus);
	PRUEFE(std::fabs(Druck - 0.5f) < 0.01f, "Druck ohne Ehrgeizige: 0,5 (%.2f)", Druck);
	W.TalkHistory = { TEXT("fokus"), TEXT("fokus") };
	PRUEFE(std::fabs(W.TalkBonus(TEXT("fokus")) - FMath::RoundToInt(Fokus * 5.f) / 10.f) < 0.11f, "Dreimal dieselbe Rede: halber Effekt");
	PRUEFE(W.ChooseTalk(TEXT("mut"), Grund) && W.PendingTalk == FString(TEXT("mut")) && !W.ChooseTalk(TEXT("bitten"), Grund), "Ansprache waehlen");

	// Moral in der Teamstaerke: (Schnitt - 80) x 0,06 wie im Browserspiel
	for (FFM13Player& P : W.Squad) P.Morale = 80;
	PRUEFE(std::fabs(W.MoraleBonus()) < 1e-6f, "Moral 80: kein Bonus");
	for (FFM13Player& P : W.Squad) P.Morale = 30;
	PRUEFE(std::fabs(W.MoraleBonus() + 3.f) < 1e-5f, "Moral 30: -3");
	for (FFM13Player& P : W.Squad) P.Morale = 60;

	// Spielvorbereitung: richtig getippt +2,5
	PRUEFE(W.SetMatchPrep(W.OppPlanArchetype, Grund) && W.MatchPrepBonus() == 2.5f, "Vorbereitung richtig getippt");
	PRUEFE(W.SetMatchPrep(FM13Tactics::CounterTo(W.OppPlanArchetype), Grund) && W.MatchPrepBonus() == 0.f, "Falsch getippt: kein Bonus");
	PRUEFE(!W.SetMatchPrep(TEXT('X'), Grund), "Unbekannter Ansatz abgelehnt");

	// Prognose
	int32 S = 0, U = 0, N = 0;
	W.Forecast(S, U, N);
	PRUEFE(S + U + N == 100 && S > 0 && N > 0, "Prognose ergibt 100 Prozent (%d/%d/%d)", S, U, N);

	// Derby: Rivale in der Liga, Vorbereitung nur in den 3 Spieltagen davor
	PRUEFE(!W.RivalName.IsEmpty() && W.OwnLeague().FindClub(W.RivalName) >= 0, "Rivale in der eigenen Liga (%s)", *W.RivalName);
	int32 Gebucht = 0, Derbys = 0;
	W.Money = 10000000;
	for (int32 i = 0; i < 34; ++i)
	{
		const int32 Abstand = W.MatchdaysToDerby();
		if (Abstand >= 0 && Abstand <= 3 && W.BookDerbyPrep(TEXT("stimmung"), Grund)) ++Gebucht;
		if (Abstand > 3 || Abstand < 0) PRUEFE(!W.BookDerbyPrep(TEXT("kampfansage"), Grund), "Ohne Derby keine Vorbereitung");
		if (W.IsDerbyNext()) { W.BookDerbyPrep(TEXT("kampfansage"), Grund); PRUEFE(W.OwnMatchStrength(W.OppPlanArchetype) >= W.OwnStrength(), "Derby-Bonus wirkt"); }
		W.PlayMatchday();
		if (W.LastReport.bDerby) { ++Derbys; PRUEFE(W.LastReport.DerbyBonus >= 2.5f - 0.01f, "Derby mit Choreo und Kampfansage (%.1f)", W.LastReport.DerbyBonus); }
	}
	PRUEFE(Derbys == 2 && Gebucht == 2, "Zwei Derbys je Saison, beide vorbereitet (%d, %d)", Derbys, Gebucht);

	// Auszeichnungen
	W.ConcludeSeason();
	PRUEFE(W.AwardHistory.Num() >= 1, "Auszeichnungen am Saisonende (%d)", W.AwardHistory.Num());

	// Europapokal: ein sehr starker Bundesligist qualifiziert sich und spielt Gruppe, Halbfinale, Finale
	FFM13World E;
	E.NewGame(TEXT("Europaverein"), 77, 0);
	for (FFM13Player& P : E.Squad) P.Strength = 97;
	while (E.PlayMatchday()) {}
	PRUEFE(E.OwnRank() <= 4, "Starker Verein unter den ersten vier (%d)", E.OwnRank());
	E.ConcludeSeason();
	PRUEFE(E.Europe.bActive && E.Europe.Groups[0].Num() == 4 && E.Europe.Groups[1].Num() == 4, "Zwei Vierergruppen");
	bool bEigenDabei = false;
	for (int32 G = 0; G < 2; ++G) for (const FFM13EuroTeam& T : E.Europe.Groups[G]) if (T.Name == E.ClubName) bEigenDabei = true;
	PRUEFE(bEigenDabei, "Eigener Verein in einer Gruppe");
	for (FFM13Player& P : E.Squad) P.Strength = 97;
	int32 EuroSpiele = 0;
	while (E.PlayMatchday()) if (E.LastCupReport.bPlayed && E.LastCupReport.Competition == FString(TEXT("Champions Cup"))) ++EuroSpiele;
	PRUEFE(E.Europe.GroupRound == 6 && E.Europe.Semis.Num() == 2 && !E.Europe.Winner.IsEmpty(), "Gruppe, Halbfinale und Finale gespielt (Sieger %s)", *E.Europe.Winner);
	PRUEFE(EuroSpiele >= 6, "Mindestens 6 eigene Europapokalspiele (%d)", EuroSpiele);
	bool bStart = false;
	for (const FFM13Booking& B : E.Bookings) if (B.Label.Contains(TEXT("Startpraemie"))) bStart = true;
	PRUEFE(bStart, "Startpraemie gebucht");
	PRUEFE(E.Achievements.ContainsByPredicate([](const FFM13Achievement& A) { return A.Id == FString(TEXT("europa")); }), "Erfolg Champions Cup erreicht");
	for (int32 G = 0; G < 2; ++G) for (const FFM13EuroTeam& T : E.Europe.Groups[G]) PRUEFE(T.Played == 6, "Jedes Gruppenteam spielt 6 Mal");
	std::printf("  Champions Cup: eigene Stufe %s, Sieger %s, %d eigene Spiele\n", *E.Europe.OwnStage, *E.Europe.Winner, EuroSpiele);

	// Spielstand
	FFM13World L;
	FString F;
	PRUEFE(FM13Save::Decode(FM13Save::Encode(E), L, F) && FM13Save::Encode(L) == FM13Save::Encode(E), "Spielstand mit Europapokal und Runde-B-Feldern (%s)", *F);
}

// Einfacher Manager wie scripts/longrun-bundesliga.js (aktiv): kauft Verstärkungen, verlängert Stammkräfte,
// zieht gute Talente hoch und baut aus, wenn genug Geld da ist.
static void BotZug(FFM13World& W)
{
	FString Grund;
	const int32 Elf = W.OwnStrength();
	// Der Bot plant wie ein vorsichtiger Manager: die Gehaelter duerfen hoechstens 80 % der erwarteten
	// Saisoneinnahmen kosten (TV-Geld nach Tabellenplatz plus Heimspiel-Tickets), umgelegt auf den Spieltag
	const int64 Saisoneinnahmen = FM13Economy::TvMoney(W.LeagueLevel, FMath::Max(1, W.OwnRank())) + (int64)W.StadiumCapacity * W.TicketPrice * 17 * 6 / 10;
	const int64 Gehaltsgrenze = Saisoneinnahmen * 8 / 10 / FM13::MatchdaysPerSeason;
	// Liegen die Gehaelter ueber der Grenze (etwa nach einem Abstieg), geht je Spieltag der teuerste Spieler
	if (W.WagesPerMatchday() > Gehaltsgrenze && W.Squad.Num() > FM13::MinSquadSize)
	{
		int32 Teuer = 0;
		for (int32 i = 1; i < W.Squad.Num(); ++i) if (W.Squad[i].Wage > W.Squad[Teuer].Wage) Teuer = i;
		W.SellPlayer(W.Squad[Teuer].Id, Grund);
	}
	// Kaufen: bester Spieler, der die Elf verbessert und bezahlbar bleibt
	int32 Bester = -1;
	for (int32 i = 0; i < W.Market.Num(); ++i)
	{
		const FFM13MarketOffer& O = W.Market[i];
		const bool bBezahlbar = O.Price <= W.Money * 3 / 10 && W.Money - O.Price > (W.WagesPerMatchday() + O.Player.Wage) * 12
			&& W.WagesPerMatchday() + O.Player.Wage <= Gehaltsgrenze;
		if (bBezahlbar && O.Player.Strength > Elf + 1 && (Bester < 0 || O.Player.Strength > W.Market[Bester].Player.Strength)) Bester = i;
	}
	if (Bester >= 0 && W.Squad.Num() >= FM13::MaxSquadSize)
	{
		// Platz schaffen: schwächsten Spieler abgeben
		int32 Schwach = 0;
		for (int32 i = 1; i < W.Squad.Num(); ++i) if (W.Squad[i].Strength < W.Squad[Schwach].Strength) Schwach = i;
		W.SellPlayer(W.Squad[Schwach].Id, Grund);
	}
	if (Bester >= 0) W.BuyPlayer(Bester, Grund);
	// Verlängern: wer zur Elf gehört
	for (FFM13Player& P : W.Squad)
		if (P.ContractYears <= 1 && P.Strength >= Elf - 3 && W.WagesPerMatchday() - P.Wage + W.RenewalWage(P) <= Gehaltsgrenze
			&& W.Money > W.RenewalSigningFee(P, 3) * 3) W.RenewContract(P.Id, 3, Grund);
	// Talente
	for (int32 i = W.YouthTalents.Num() - 1; i >= 0; --i)
		if (W.YouthTalents[i].Strength >= Elf - 6 && W.Squad.Num() < FM13::MaxSquadSize) W.PromoteYouth(i, Grund);
	// Ausbauen mit Reserve
	if (W.Money > W.TrainingUpgradeCost() * 4) W.UpgradeTraining(Grund);
	if (W.Money > W.YouthAcademyUpgradeCost() * 4) W.UpgradeYouthAcademy(Grund);
	const int32 Auslastung = W.LastReport.bHome && W.StadiumCapacity > 0 ? W.LastReport.Attendance * 100 / W.StadiumCapacity : 0;
	if (Auslastung >= 98 && W.Money > FM13Economy::StadiumExpansionCost(2000) * 5) W.ExpandStadium(2000, Grund);
}

static void TestBotKarriere()
{
	std::printf("Bot-Karriere ueber 15 Saisons (aktiv)\n");
	int BesteLiga = 5;
	for (int32 Seed : { 1, 2, 3, 4, 5 })
	{
		FFM13World W;
		W.NewGame(TEXT("Bot FC"), Seed);
		std::string Weg;
		for (int Saison = 0; Saison < 15 && !W.bSacked; ++Saison)
		{
			while (!W.IsSeasonFinished() && !W.bSacked)
			{
				W.PlayMatchday();
				BotZug(W);
			}
			if (W.bSacked) break;
			const FFM13SeasonSummary S = W.ConcludeSeason();
			Weg += "L" + std::to_string(S.Level + 1) + ":" + std::to_string(S.Rank) + (S.Outcome == EFM13SeasonOutcome::Promoted ? "^ " : S.Outcome == EFM13SeasonOutcome::Relegated ? "v " : " ");
			PRUEFE(W.Money > -5000000, "Bot bleibt finanziell im Rahmen (%lld)", (long long)W.Money);
		}
		BesteLiga = std::min(BesteLiga, (int)W.LeagueLevel);
		std::printf("  Seed %d: %s| Ende %s, Staerke %d, Konto %lld, entlassen %s\n", Seed, Weg.c_str(), FM13::LeagueName(W.LeagueLevel), W.OwnStrength(), (long long)W.Money, W.bSacked ? "ja" : "nein");
	}
	PRUEFE(BesteLiga <= 3, "Mindestens ein Bot steigt bis in die 3. Liga oder hoeher auf (bestes Level %d)", BesteLiga);
}

int main()
{
	TestFormeln();
	TestSpielplan();
	TestFinanzen();
	TestSaisonende();
	TestKaderAktionen();
	TestDeterminismus();
	TestEntlassung();
	TestPokalUndVerletzungen();
	TestRundeA();
	TestRundeB();
	TestTeamstaerke();
	TestKondition();
	TestTrainingReferenz();
	TestPersonal();
	TestKabine();
	TestMannschaftsrat();
	TestJugend();
	TestJugendLaufbahn();
	TestTransferpoker();
	TestTransferRegeln();
	TestMedizincheck();
	TestKonditionSaison();
	TestSpielerNoten();
	TestSpielstand();
	TestBrowserImport();
	TestBotKarriere();
	std::printf("\nERGEBNIS: %d bestanden, %d fehlgeschlagen\n", GBestanden, GFehler);
	return GFehler == 0 ? 0 : 1;
}
