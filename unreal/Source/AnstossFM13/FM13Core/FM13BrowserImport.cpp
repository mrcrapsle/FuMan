#include "FM13BrowserImport.h"
#include "FM13Economy.h"
#include "FM13Json.h"

namespace
{
	using namespace FM13Json;

	EFM13Position PositionFrom(const FString& S)
	{
		if (S == TEXT("TW")) return EFM13Position::TW;
		if (S == TEXT("ABW")) return EFM13Position::ABW;
		if (S == TEXT("ST")) return EFM13Position::ST;
		return EFM13Position::MIT;
	}

	EFM13Playstyle StyleFrom(const FString& S)
	{
		if (S == TEXT("offensiv")) return EFM13Playstyle::Offensiv;
		if (S == TEXT("defensiv")) return EFM13Playstyle::Defensiv;
		if (S == TEXT("konter")) return EFM13Playstyle::Konter;
		return EFM13Playstyle::Ausgeglichen;
	}

	FFM13Player ReadPlayer(const FReader& R, int32 N, int32 NewId, bool bYouth)
	{
		FFM13Player P;
		P.Id = NewId;
		P.Name = R.Str(N, TEXT("name"), TEXT("Unbekannt"));
		P.Pos = PositionFrom(R.Str(N, TEXT("pos"), TEXT("MIT")));
		P.Strength = FMath::Clamp((int32)R.Int(N, TEXT("strength"), 40), 1, 99);
		P.Age = FMath::Clamp((int32)R.Int(N, TEXT("age"), 24), 15, 45);
		// Potenzial gibt es im Browserspiel nur bei Talenten; sonst eine Schätzung nach dem Alter
		const int32 Pot = (int32)R.Int(N, TEXT("potential"), 0);
		P.Potential = Pot > 0 ? FMath::Clamp(Pot, P.Strength, 99) : FMath::Min(99, P.Strength + (P.Age <= 21 ? 8 : (P.Age <= 24 ? 4 : 1)));
		P.GoalsSeason = (int32)R.Int(N, TEXT("goalsSeason"), 0);
		P.GoalsCareer = (int32)R.Int(N, TEXT("goalsCareer"), 0);
		P.Appearances = (int32)R.Int(N, TEXT("appearancesSeason"), 0);
		P.MarketValue = FMath::Max<int64>(10000, R.Int(N, TEXT("marketValue"), FM13Economy::MarketValue(P.Strength, nullptr)));
		P.Wage = bYouth ? 0 : FMath::Max(0, (int32)R.Int(N, TEXT("wage"), FM13Economy::Wage(P.MarketValue, P.Strength)));
		P.ContractYears = bYouth ? 0 : FMath::Clamp((int32)R.Int(N, TEXT("contracts"), 2), 1, 5);
		P.InjuredMatchdays = FMath::Clamp((int32)R.Int(N, TEXT("injured"), 0), 0, 34);
		return P;
	}

	// Pokal aus roundsHistory: erste offene Runde = noch dabei, abgeschlossene Runden ergeben Sieger
	void ReadCup(const FReader& R, int32 CupObj, const FString& Own, FFM13Cup& Cup, bool bOwnEnteredFlag)
	{
		const TArray<int32> Runden = R.Items(CupObj, TEXT("roundsHistory"));
		if (!Runden.Num()) return; // nichts gespeichert: frisch ausgelost lassen
		auto Sieger = [&R](int32 Paar) -> FString
		{
			const FString Elf = R.Str(Paar, TEXT("penaltyWinner"), TEXT(""));
			if (!Elf.IsEmpty()) return Elf;
			const int64 H = R.Int(Paar, TEXT("homeGoals"), -1), A = R.Int(Paar, TEXT("awayGoals"), -1);
			return H >= A ? R.Str(Paar, TEXT("home"), TEXT("")) : R.Str(Paar, TEXT("away"), TEXT(""));
		};
		Cup.Alive.Reset();
		Cup.LastRound.Reset();
		Cup.Winner = FString();
		int32 Abgeschlossen = 0;
		TArray<FString> LetzteSieger;
		for (int32 Runde : Runden)
		{
			const TArray<int32> Paare = R.Items(Runde, TEXT("pairings"));
			if (!R.Bool(Runde, TEXT("completed"), false))
			{
				for (int32 Paar : Paare)
				{
					Cup.Alive.Add(R.Str(Paar, TEXT("home"), TEXT("")));
					Cup.Alive.Add(R.Str(Paar, TEXT("away"), TEXT("")));
				}
				break;
			}
			++Abgeschlossen;
			LetzteSieger.Reset();
			Cup.LastRound.Reset();
			for (int32 Paar : Paare)
			{
				FFM13CupMatch M;
				M.Home = R.Str(Paar, TEXT("home"), TEXT(""));
				M.Away = R.Str(Paar, TEXT("away"), TEXT(""));
				M.HomeGoals = (int32)FMath::Max<int64>(0, R.Int(Paar, TEXT("homeGoals"), 0));
				M.AwayGoals = (int32)FMath::Max<int64>(0, R.Int(Paar, TEXT("awayGoals"), 0));
				M.bPenalties = !R.Str(Paar, TEXT("penaltyWinner"), TEXT("")).IsEmpty();
				M.Winner = Sieger(Paar);
				Cup.LastRound.Add(M);
				LetzteSieger.Add(M.Winner);
			}
		}
		// Nächste Runde noch nicht ausgelost: die Sieger der letzten Runde sind dabei
		if (!Cup.Alive.Num()) Cup.Alive = LetzteSieger;
		Cup.Round = FMath::Min(Abgeschlossen, Cup.RoundMatchdays.Num());
		if (Cup.Round >= Cup.RoundMatchdays.Num() && LetzteSieger.Num() == 1) Cup.Winner = LetzteSieger[0];
		Cup.bOwnEntered = bOwnEnteredFlag;
		Cup.bOwnAlive = bOwnEnteredFlag && (Cup.Alive.Contains(Own) || Cup.Winner == Own);
	}
}

namespace FM13BrowserImport
{
	bool Import(const FString& Text, FFM13World& OutWorld, FString& OutError, TArray<FString>& OutNotes, int32 Seed)
	{
		FDocument Doc;
		if (!Parse(Text, Doc, OutError)) { OutError = TEXT("Die Datei ist kein gueltiges JSON: ") + OutError; return false; }
		const FReader R(Doc.Nodes);
		const int32 Root = Doc.Root;
		const int32 G = R.Find(Root, TEXT("game"));
		if (!R.IsObject(G) || R.Find(Root, TEXT("squad")) < 0 || R.Find(Root, TEXT("leaguesData")) < 0)
		{
			OutError = TEXT("Das ist kein exportierter Spielstand des Browserspiels (game, squad oder leaguesData fehlen).");
			return false;
		}

		FFM13World W;
		W.Rng.Initialize(Seed);
		W.ClubName = R.Str(G, TEXT("clubName"), TEXT(""));
		W.Season = FMath::Max(1, (int32)R.Int(G, TEXT("season"), 1));
		W.Matchday = FMath::Clamp((int32)R.Int(G, TEXT("matchday"), 1), 1, FM13::MatchdaysPerSeason + 1);
		W.LeagueLevel = FMath::Clamp((int32)R.Int(G, TEXT("leagueLevel"), FM13::StartLeagueLevel), 0, FM13::NumLeagues - 1);
		W.Money = R.Int(G, TEXT("money"), 0);
		W.Fans = FMath::Clamp((int32)R.Int(G, TEXT("fans"), 75), 0, 100);
		W.BoardSat = FMath::Clamp((int32)R.Int(G, TEXT("boardSat"), 80), 10, 100);
		W.LowBoardSatStreak = (int32)R.Int(G, TEXT("lowBoardSatStreak"), 0);
		for (int32 N : R.Items(G, TEXT("boardSatVerlauf"))) W.BoardHistory.Add((int32)R.IntAt(N, 50));
		W.bSacked = R.Bool(G, TEXT("sackPending"), false);
		W.TvPaidThisSeason = R.Int(G, TEXT("tvMoneyPaidThisSeason"), 0);
		W.bDfbViaLandespokal = R.Bool(G, TEXT("dfbPokalViaLandespokal"), false);
		W.YouthAcademyLevel = FMath::Clamp((int32)R.Int(G, TEXT("youthAcademyLvl"), 1), 1, 5);
		W.TrainingLevel = FMath::Clamp((int32)R.Int(G, TEXT("equipmentLevel"), 0) + 1, 1, 5);
		const int32 Ticket = (int32)R.Int(R.Find(G, TEXT("ticketPrices")), TEXT("steh"), FM13Economy::BaseTicketPrice(W.LeagueLevel));
		W.TicketPrice = FMath::Clamp(Ticket, 1, FM13Economy::BaseTicketPrice(W.LeagueLevel) * 5);
		const int32 Erwartung = R.Find(G, TEXT("seasonExpectation"));
		W.SeasonTarget = (R.IsObject(Erwartung) && R.Int(Erwartung, TEXT("season"), 0) == W.Season)
			? FMath::Clamp((int32)R.Int(Erwartung, TEXT("expectedRank"), 9), 1, FM13::TeamsPerLeague) : 9;
		if (W.ClubName.IsEmpty()) { OutError = TEXT("Vereinsname fehlt im Spielstand."); return false; }

		// Stadion: Summe der Blöcke plus Zusatzplätze (stadium.total ist im Browser ein Getter)
		const int32 Stadion = R.Find(Root, TEXT("stadium"));
		int64 Plaetze = 0;
		const int32 Bloecke = R.Find(Stadion, TEXT("blocks"));
		if (R.IsObject(Bloecke)) for (int32 B : Doc.Nodes[Bloecke].Children) Plaetze += R.Int(B, TEXT("cap"), 0);
		Plaetze += R.Int(Stadion, TEXT("bonusCapacity"), 0);
		if (Plaetze <= 0) Plaetze = R.Int(Stadion, TEXT("total"), 4000);
		W.StadiumCapacity = (int32)FMath::Clamp<int64>(Plaetze, 500, 150000);

		// Kader und Jugend (die Browser-Ids sind Texte, hier gibt es neue Zahlen)
		for (int32 N : R.Items(Root, TEXT("squad"))) W.Squad.Add(ReadPlayer(R, N, W.NextPlayerId++, false));
		for (int32 N : R.Items(Root, TEXT("youthTalents"))) W.YouthTalents.Add(ReadPlayer(R, N, W.NextPlayerId++, true));
		if (!W.Squad.Num()) { OutError = TEXT("Der Kader im Spielstand ist leer."); return false; }

		// Ligen: Tabellenzeilen und gepackter Spielplan [Heim, Gast, Tore Heim, Tore Gast] (-1 = offen)
		const TArray<int32> Ligen = R.Items(Root, TEXT("leaguesData"));
		if (Ligen.Num() != FM13::NumLeagues) { OutError = FString::Printf(TEXT("Der Spielstand hat %d statt 6 Ligen."), Ligen.Num()); return false; }
		const int32 Fx = R.Find(Root, TEXT("fixturesData"));
		const TArray<int32> FxLigen = R.Items(Fx, TEXT("ligen"));
		for (int32 L = 0; L < FM13::NumLeagues; ++L)
		{
			FFM13League Liga;
			Liga.Level = L;
			for (int32 T : R.Elements(Ligen[L]))
			{
				FFM13Club C;
				C.Name = R.Str(T, TEXT("name"), TEXT("?"));
				C.bOwn = C.Name == W.ClubName && L == W.LeagueLevel;
				C.Strength = FMath::Clamp((int32)R.Int(T, TEXT("strength"), FM13::LeagueBaseStrength(L)), 1, 99);
				C.Playstyle = StyleFrom(R.Str(T, TEXT("playstyle"), TEXT("ausgeglichen")));
				C.Played = (int32)R.Int(T, TEXT("played"), 0);
				C.Won = (int32)R.Int(T, TEXT("won"), 0);
				C.Drawn = (int32)R.Int(T, TEXT("drawn"), 0);
				C.Lost = (int32)R.Int(T, TEXT("lost"), 0);
				C.GoalsFor = (int32)R.Int(T, TEXT("goalsFor"), 0);
				C.GoalsAgainst = (int32)R.Int(T, TEXT("goalsAgainst"), 0);
				Liga.Clubs.Add(C);
				W.UsedClubNames.Add(C.Name);
			}
			if (Liga.Clubs.Num() != FM13::TeamsPerLeague)
			{
				OutError = FString::Printf(TEXT("Liga %d hat %d statt 18 Vereine."), L + 1, Liga.Clubs.Num());
				return false;
			}
			if (FxLigen.IsValidIndex(L))
			{
				const TArray<int32> Tage = R.Elements(FxLigen[L]);
				for (int32 Tag = 0; Tag < Tage.Num(); ++Tag)
					for (int32 Spiel : R.Elements(Tage[Tag]))
					{
						const TArray<int32> V = R.Elements(Spiel);
						if (V.Num() < 4) continue;
						FFM13Fixture F;
						F.Matchday = Tag + 1;
						F.Home = (int32)R.IntAt(V[0], -1);
						F.Away = (int32)R.IntAt(V[1], -1);
						const int64 HG = R.IntAt(V[2], -1), AG = R.IntAt(V[3], -1);
						F.bPlayed = HG >= 0 && AG >= 0;
						F.HomeGoals = F.bPlayed ? (int32)HG : 0;
						F.AwayGoals = F.bPlayed ? (int32)AG : 0;
						if (Liga.Clubs.IsValidIndex(F.Home) && Liga.Clubs.IsValidIndex(F.Away)) Liga.Fixtures.Add(F);
					}
			}
			// Kein oder unvollständiger Spielplan (sehr alte Stände): neu erzeugen, gespielte Ergebnisse gehen dann nur über die Tabelle
			if (Liga.MatchdayCount() != FM13::MatchdaysPerSeason || Liga.Fixtures.Num() != FM13::TeamsPerLeague / 2 * FM13::MatchdaysPerSeason)
			{
				Liga.BuildSchedule(W.Rng);
				for (FFM13Fixture& F : Liga.Fixtures) if (F.Matchday < W.Matchday) F.bPlayed = true;
				OutNotes.Add(FString::Printf(TEXT("Spielplan der %s neu erzeugt (im Spielstand unvollstaendig)."), FM13::LeagueName(L)));
			}
			W.Leagues.Add(Liga);
		}
		if (W.OwnLeague().FindOwn() < 0)
		{
			OutError = FString::Printf(TEXT("Der eigene Verein steht nicht in der %s."), FM13::LeagueName(W.LeagueLevel));
			return false;
		}

		// Pokale: erst frisch, dann den gespeicherten Stand übernehmen
		W.InitCups();
		ReadCup(R, R.Find(Root, TEXT("cupTournament")), W.ClubName, W.DfbPokal, R.Bool(G, TEXT("inCup"), W.DfbPokal.bOwnEntered));
		const int32 Lp = R.Find(Root, TEXT("landesPokal"));
		bool bImLandespokal = false;
		const TArray<int32> LpRunden = R.Items(Lp, TEXT("roundsHistory"));
		if (LpRunden.Num())
			for (int32 Paar : R.Items(LpRunden[0], TEXT("pairings")))
				if (R.Str(Paar, TEXT("home"), TEXT("")) == W.ClubName || R.Str(Paar, TEXT("away"), TEXT("")) == W.ClubName) bImLandespokal = true;
		if (LpRunden.Num()) ReadCup(R, Lp, W.ClubName, W.Landespokal, bImLandespokal);

		// Gehaltsbudget pro Spieltag wie im Browserspiel; nie unter den laufenden Gehältern
		W.WageBudget = FMath::Max<int64>(W.WagesPerMatchday(), R.Int(G, TEXT("wageBudget"), W.WagesPerMatchday()));

		// Laufbahn: managerCareer (Level 0-basiert), Ausgang aus der Liga der Folgesaison
		const TArray<int32> Laufbahn = R.Items(G, TEXT("managerCareer"));
		for (int32 i = 0; i < Laufbahn.Num(); ++i)
		{
			FFM13SeasonRecord Rec;
			Rec.Season = (int32)R.Int(Laufbahn[i], TEXT("season"), i + 1);
			Rec.Level = FMath::Clamp((int32)R.Int(Laufbahn[i], TEXT("level"), W.LeagueLevel), 0, FM13::NumLeagues - 1);
			Rec.Rank = (int32)R.Int(Laufbahn[i], TEXT("rank"), 0);
			Rec.Points = (int32)R.Int(Laufbahn[i], TEXT("points"), 0);
			const int32 Naechste = i + 1 < Laufbahn.Num() ? (int32)R.Int(Laufbahn[i + 1], TEXT("level"), Rec.Level) : W.LeagueLevel;
			Rec.Outcome = Naechste < Rec.Level ? EFM13SeasonOutcome::Promoted : (Naechste > Rec.Level ? EFM13SeasonOutcome::Relegated : EFM13SeasonOutcome::Stayed);
			W.History.Add(Rec);
		}

		// Postfach: die letzten 40 Meldungen, älteste zuerst
		const TArray<int32> Post = R.Items(Root, TEXT("inboxMessages"));
		for (int32 i = FMath::Min(Post.Num(), 40) - 1; i >= 0; --i)
		{
			FFM13Message M;
			M.Title = R.Str(Post[i], TEXT("title"), TEXT(""));
			M.Body = R.Str(Post[i], TEXT("body"), TEXT(""));
			M.Season = W.Season;
			M.Matchday = W.Matchday;
			if (!M.Title.IsEmpty()) W.Messages.Add(M);
		}

		W.RefreshMarket();
		W.AddMessage(TEXT("Spielstand uebernommen"), FString::Printf(TEXT("%s, Saison %d, Spieltag %d, %s: %d Spieler, %d Talente."),
			*W.ClubName, W.Season, FMath::Min(W.Matchday, FM13::MatchdaysPerSeason), FM13::LeagueName(W.LeagueLevel), W.Squad.Num(), W.YouthTalents.Num()));

		// Was der Port (noch) nicht kennt
		const TCHAR* Fehlt[][2] = {
			{ TEXT("stockMarket"), TEXT("Aktien") }, { TEXT("realEstatePortfolio"), TEXT("Immobilien") }, { TEXT("holdingCompany"), TEXT("Holding") },
			{ TEXT("privateLife"), TEXT("Privatleben") }, { TEXT("secondTeamSquad"), TEXT("zweite Mannschaft") }, { TEXT("merchandise"), TEXT("Merchandising") },
			{ TEXT("staffMembers"), TEXT("Mitarbeiter") }, { TEXT("europeTournament"), TEXT("Europapokal") }, { TEXT("managerRPG"), TEXT("Manager-Talente") }
		};
		TArray<FString> Weg;
		for (const auto& E : Fehlt) if (R.Find(Root, E[0]) >= 0) Weg.Add(E[1]);
		if (Weg.Num()) OutNotes.Add(TEXT("Noch nicht in der Unreal-Fassung und daher nicht uebernommen: ") + FString::Join(Weg, TEXT(", ")) + TEXT("."));

		OutWorld = W;
		return true;
	}
}
