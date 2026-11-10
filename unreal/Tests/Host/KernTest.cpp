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
#include <map>
#include <set>

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
	PRUEFE(!W.BuyPlayer(0, Grund) && Grund.Contains(TEXT("Geld")), "Ohne Geld kein Kauf");
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
	// Kaufen: bester Spieler, der die Elf verbessert und bezahlbar bleibt
	int32 Bester = -1;
	for (int32 i = 0; i < W.Market.Num(); ++i)
	{
		const FFM13MarketOffer& O = W.Market[i];
		const bool bBezahlbar = O.Price <= W.Money * 4 / 10 && W.Money - O.Price > (W.WagesPerMatchday() + O.Player.Wage) * 12;
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
		if (P.ContractYears <= 1 && P.Strength >= Elf - 3) W.RenewContract(P.Id, 3, Grund);
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
	TestKonditionSaison();
	TestSpielerNoten();
	TestSpielstand();
	TestBrowserImport();
	TestBotKarriere();
	std::printf("\nERGEBNIS: %d bestanden, %d fehlgeschlagen\n", GBestanden, GFehler);
	return GFehler == 0 ? 0 : 1;
}
