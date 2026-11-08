// Tests des Spielkerns ohne Unreal Engine: g++ mit der Nachbildung in CoreMinimal.h.
// Bauen und starten: unreal/Tests/Host/run.sh
#include "CoreMinimal.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Economy.h"
#include "../../Source/AnstossFM13/FM13Core/FM13Match.h"
#include "../../Source/AnstossFM13/FM13Core/FM13World.h"
#include "../../Source/AnstossFM13/FM13Core/FM13SaveCodec.h"
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
	TestSpielstand();
	TestBotKarriere();
	std::printf("\nERGEBNIS: %d bestanden, %d fehlgeschlagen\n", GBestanden, GFehler);
	return GFehler == 0 ? 0 : 1;
}
