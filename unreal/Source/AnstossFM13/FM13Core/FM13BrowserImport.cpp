#include "FM13BrowserImport.h"
#include "FM13Fitness.h"
#include "FM13Economy.h"
#include "FM13Json.h"
#include "FM13Development.h"

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

	// Trait aus dem Browserspiel (js/entities.js). Verglichen wird der Anfang ohne Umlaute und ß.
	uint8 TraitFrom(const FString& Name)
	{
		if (Name.Left(4) == TEXT("Tor-")) return 1;
		if (Name.Left(7) == TEXT("Freisto")) return 2;
		if (Name.Left(8) == TEXT("Elfmeter")) return 3;
		if (Name == TEXT("Leader")) return 4;
		if (Name.Left(7) == TEXT("Eisenfu")) return 5;
		if (Name.Left(2) == TEXT("Fl") && Name.Contains(TEXT("gelflitzer"))) return 6;
		if (Name.Left(9) == TEXT("Zweikampf")) return 7;
		if (Name == TEXT("Wetterfest")) return 8;
		return 0;
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
		// Saisonwerte des Browserspiels: statsSeason mit vorlagen und notenSumme (1,0 bis 6,0)
		const int32 St = R.Find(N, TEXT("statsSeason"));
		if (St >= 0)
		{
			P.Assists = FMath::Max(0, (int32)R.Int(St, TEXT("vorlagen"), 0));
			P.GradeGames = FMath::Max(0, (int32)R.Int(St, TEXT("spiele"), 0));
			P.TeamOfMatchday = FMath::Max(0, (int32)R.Int(St, TEXT("elf"), 0));
			P.GradeSum = P.GradeGames > 0 ? FMath::Clamp((int32)FMath::RoundToInt(R.Real(St, TEXT("notenSumme"), 0.0) * 10.0), 0, P.GradeGames * 60) : 0;
		}
		// p.assists zaehlt im Browserspiel die laufende Saison mit, hier kommt sie erst am Saisonende dazu
		P.AssistsCareer = FMath::Max(0, (int32)R.Int(N, TEXT("assists"), P.Assists) - P.Assists);
		P.LastGrade = FMath::Clamp(FMath::RoundToInt((float)R.Real(N, TEXT("lastGrade"), 0.0) * 10.f), 0, 60);
		P.Appearances = (int32)R.Int(N, TEXT("appearancesSeason"), 0);
		P.MarketValue = FMath::Max<int64>(10000, R.Int(N, TEXT("marketValue"), FM13Economy::MarketValue(P.Strength, nullptr)));
		P.Wage = bYouth ? 0 : FMath::Max(0, (int32)R.Int(N, TEXT("wage"), FM13Economy::Wage(P.MarketValue, P.Strength)));
		P.ContractYears = bYouth ? 0 : FMath::Clamp((int32)R.Int(N, TEXT("contracts"), 2), 1, 5);
		P.InjuredMatchdays = FMath::Clamp((int32)R.Int(N, TEXT("injured"), 0), 0, 34);
		P.SuspendedMatchdays = FMath::Clamp((int32)R.Int(N, TEXT("suspended"), 0), 0, 10);
		const FString Charakter = R.Str(N, TEXT("character"), TEXT(""));
		for (uint8 c = 0; c < 6; ++c) if (Charakter.Len() >= 4 && FString(FM13CharacterName(c)).Contains(Charakter.Left(4))) P.Character = c;
		P.Morale = FMath::Clamp(FMath::RoundToInt((float)R.Real(N, TEXT("morale"), 65.0)), 5, 100);
		P.Fitness = FMath::Clamp(FMath::RoundToInt((float)R.Real(N, TEXT("fitness"), 100.0)), 10, 100);
		P.DailyForm = FMath::Clamp(FMath::RoundToInt((float)R.Real(N, TEXT("dailyForm"), 50.0)), 5, 95);
		P.Trait = TraitFrom(R.Str(N, TEXT("trait"), TEXT("")));
		P.AppearancesTotal = FMath::Max(0, (int32)R.Int(N, TEXT("appearances"), 0));
		P.TimesInjured = FMath::Max(0, (int32)R.Int(N, TEXT("timesInjured"), 0));
		P.bChronic = R.Bool(N, TEXT("chronicIssue"), false);
		P.Archetype = FM13Dev::ArchetypeFor(NewId);
		// Saisons im Verein: aus der Stärke-Historie (ein Eintrag je Saison)
		P.SeasonsAtClub = FMath::Max(0, R.Items(N, TEXT("strengthHistory")).Num() - 1);
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

		// Taktik, Sponsor, Rekorde, Erfolge
		FString Egal;
		W.SetFormation(R.Str(G, TEXT("formation"), TEXT("4-4-2")), Egal);
		W.SetTacticStyle(R.Str(G, TEXT("tacticStyle"), TEXT("ausgeglichen")), Egal);
		W.TeamTraining = R.Str(G, TEXT("teamTraining"), TEXT("ausgeglichen"));
		W.TrainingIntensity = R.Str(G, TEXT("trainingIntensity"), TEXT("normal"));
		W.bBusTravel = R.Str(G, TEXT("travelMode"), TEXT("flugzeug")) == TEXT("bus");
		W.bBusSponsor = R.Bool(G, TEXT("busSponsorActive"), false);
		// Personal: staffMembers (hired, task) und staffMeta (level), Perk aus managerRPG.perks
		const int32 Personal = R.Find(Root, TEXT("staffMembers"));
		const int32 Meta = R.Find(Root, TEXT("staffMeta"));
		const int32 Rpg = R.Find(R.Find(Root, TEXT("managerRPG")), TEXT("perks"));
		W.bFitnessGuru = R.Bool(Rpg, TEXT("fitnessGuru"), false);
		W.bTactician = R.Bool(Rpg, TEXT("tactician"), false);
		// Privatleben (Lizenz, Stress), Campus, Zweikampfhaerte, Aufstiegseuphorie
		const int32 Privat = R.Find(Root, TEXT("privateLife"));
		W.LicenseLevel = FMath::Clamp((int32)R.Int(Privat, TEXT("license"), 0), 0, 3);
		W.Stress = FMath::Clamp(FMath::RoundToInt((float)R.Real(Privat, TEXT("stress"), 15.0)), 0, 100);
		W.CampusTrainingGround = FMath::Clamp((int32)R.Int(R.Find(R.Find(Root, TEXT("campusBuildings")), TEXT("trainingground")), TEXT("lvl"), 0), 0, 5);
		W.TackleHardness = R.Str(G, TEXT("tackleHardness"), TEXT("normal"));
		W.CampusReha = FMath::Clamp((int32)R.Int(R.Find(R.Find(Root, TEXT("campusBuildings")), TEXT("reha")), TEXT("lvl"), 0), 0, 5);
		// Wochenplan: Objekt mit den Tagen mo bis so
		const int32 Plan = R.Find(G, TEXT("weeklyTrainingPlan"));
		static const TCHAR* Tage[7] = { TEXT("mo"), TEXT("di"), TEXT("mi"), TEXT("do"), TEXT("fr"), TEXT("sa"), TEXT("so") };
		W.WeeklyPlan = FM13Fitness::Startplan();
		if (R.IsObject(Plan)) for (int32 T = 0; T < 7; ++T) W.WeeklyPlan[T] = R.Str(Plan, Tage[T], W.WeeklyPlan[T]);
		const int32 Schub = R.Find(G, TEXT("promotionBoost"));
		W.PromotionBoostLevel = (int32)R.Int(Schub, TEXT("level"), -1);
		W.PromotionBoostSeason = (int32)R.Int(Schub, TEXT("season"), 0);
		// Kapitaen und Eingespieltheit haengen an den Browser-Ids der Spieler (Texte): auf die neuen Nummern umsetzen
		TArray<FString> BrowserIds;
		for (int32 N : R.Items(Root, TEXT("squad"))) BrowserIds.Add(R.Str(N, TEXT("id"), TEXT("")));
		auto NeueId = [&W, &BrowserIds](const FString& Alt)
		{
			for (int32 k = 0; k < BrowserIds.Num() && k < W.Squad.Num(); ++k) if (!Alt.IsEmpty() && BrowserIds[k] == Alt) return W.Squad[k].Id;
			return 0;
		};
		W.CaptainId = NeueId(R.Str(G, TEXT("captainId"), TEXT("")));
		const int32 Chemie = R.Find(G, TEXT("pairChemistry"));
		if (R.IsObject(Chemie))
		{
			const FNode& C = Doc.Nodes[Chemie];
			for (int32 k = 0; k < C.Keys.Num() && k < C.Children.Num(); ++k)
			{
				TArray<FString> Teile;
				C.Keys[k].ParseIntoArray(Teile, TEXT("_"), true);
				if (Teile.Num() != 2) continue;
				const int32 A = NeueId(Teile[0]), B = NeueId(Teile[1]);
				if (A == 0 || B == 0 || A == B) continue;
				W.PairA.Add(FMath::Min(A, B)); W.PairB.Add(FMath::Max(A, B));
				W.PairValue.Add(FMath::Clamp((int32)Doc.Nodes[C.Children[k]].Number, 0, 30));
			}
		}
		FFM13Staff* Stab[6] = { &W.AthletikTrainer, &W.Ernaehrungsberater, &W.Physio, &W.Greenkeeper, &W.CoTrainer, &W.Analyst };
		const TCHAR* Schluessel[6] = { TEXT("fitCoach"), TEXT("nutritionist"), TEXT("physio"), TEXT("greenkeeper"), TEXT("coTrainer"), TEXT("analyst") };
		for (int32 i = 0; i < 6; ++i)
		{
			Stab[i]->Morale = FMath::Clamp(FMath::RoundToInt((float)R.Real(R.Find(Meta, Schluessel[i]), TEXT("morale"), 80.0)), 0, 100);
			const int32 S = R.Find(Personal, Schluessel[i]);
			Stab[i]->bHired = R.Bool(S, TEXT("hired"), false);
			Stab[i]->Task = R.Str(S, TEXT("task"), TEXT(""));
			Stab[i]->Level = FMath::Clamp((int32)R.Int(R.Find(Meta, Schluessel[i]), TEXT("level"), 1), 1, 3);
		}
		W.bBusBanden = R.Bool(G, TEXT("busSponsorViaBanden"), false);
		for (int32 N : R.Items(G, TEXT("recentTacticStyles"))) W.RecentStyles.Add(Doc.Nodes[N].Text);
		const int32 Sp = R.Find(G, TEXT("sponsor"));
		W.Sponsor.Name = R.Str(Sp, TEXT("name"), TEXT("Kein Hauptsponsor"));
		W.Sponsor.Base = (int32)R.Int(Sp, TEXT("base"), 500);
		W.Sponsor.WinBonus = (int32)R.Int(Sp, TEXT("winBonus"), 200);
		W.Sponsor.PromotionBonus = (int32)R.Int(Sp, TEXT("promotionBonus"), 0);
		W.Sponsor.Tier = R.Str(Sp, TEXT("tier"), TEXT(""));
		const int32 Laufzeit = (int32)R.Int(Sp, TEXT("duration"), 0);
		// „Kein Hauptsponsor“ hat im Browserspiel die Laufzeit 999
		W.Sponsor.MatchdaysLeft = (W.Sponsor.Name.Contains(TEXT("Kein Hauptsponsor")) || Laufzeit >= 999) ? 0 : FMath::Clamp(Laufzeit, 0, 102);
		const int32 Rk = R.Find(G, TEXT("clubRecords"));
		const int32 Sieg = R.Find(Rk, TEXT("biggestWin"));
		W.Records.BiggestWinFor = (int32)R.Int(Sieg, TEXT("ourGoals"), 0);
		W.Records.BiggestWinAgainst = (int32)R.Int(Sieg, TEXT("oppGoals"), 0);
		W.Records.BiggestWinOpponent = R.Str(Sieg, TEXT("opponent"), TEXT(""));
		W.Records.BiggestWinSeason = (int32)R.Int(Sieg, TEXT("season"), 0);
		W.Records.UnbeatenStreak = (int32)R.Int(Rk, TEXT("currentUnbeatenStreak"), 0);
		W.Records.LongestUnbeatenStreak = (int32)R.Int(Rk, TEXT("longestUnbeatenStreak"), 0);
		W.Records.RecordAttendance = (int32)R.Int(G, TEXT("recordAttendance"), 0);
		const TCHAR* ErfolgIds[][2] = {
			{ TEXT("millionaire"), TEXT("millionaer") }, { TEXT("multimillionaire"), TEXT("multimillionaer") }, { TEXT("bundesliga"), TEXT("bundesliga") },
			{ TEXT("cup-winner"), TEXT("pokalsieger") }, { TEXT("unbeaten-10"), TEXT("unbeaten-10") }, { TEXT("unbeaten-20"), TEXT("unbeaten-20") },
			{ TEXT("youth-academy"), TEXT("talentschmiede") }, { TEXT("legend"), TEXT("legende") }
		};
		for (int32 N : R.Items(G, TEXT("achievements")))
		{
			const FString Id = R.Str(N, TEXT("id"), TEXT(""));
			for (const auto& E : ErfolgIds)
				if (Id == E[0])
				{
					FFM13Achievement A;
					A.Id = E[1]; A.Season = (int32)R.Int(N, TEXT("season"), 1); A.Matchday = (int32)R.Int(N, TEXT("matchday"), 1);
					W.Achievements.Add(A);
				}
		}
		W.PrepareOppPlan();

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
