#include "FM13SaveCodec.h"
#include "FM13Json.h"

// ---------- Schreiben ----------
namespace
{
	class FWriter
	{
	public:
		FString Out;
		bool bFirst = true;

		void Comma() { if (!bFirst) Out += TEXT(","); bFirst = false; }
		void Key(const TCHAR* K) { Comma(); Str(K); Out += TEXT(":"); bFirst = true; }
		void Str(const FString& S)
		{
			Out.AppendChar(TEXT('"'));
			for (int32 i = 0; i < S.Len(); ++i)
			{
				const TCHAR C = S[i];
				if (C == TEXT('"')) Out += TEXT("\\\"");
				else if (C == TEXT('\\')) Out += TEXT("\\\\");
				else if (C == TEXT('\n')) Out += TEXT("\\n");
				else if (C == TEXT('\r')) Out += TEXT("\\r");
				else if (C == TEXT('\t')) Out += TEXT("\\t");
				else if (static_cast<uint32>(C) < 0x20u) Out += FString::Printf(TEXT("\\u%04x"), (int32)C);
				else Out.AppendChar(C);
			}
			Out.AppendChar(TEXT('"'));
		}
		void Int(int64 V) { Out += FString::Printf(TEXT("%lld"), (long long)V); }

		void BeginObject() { Out += TEXT("{"); bFirst = true; }
		void EndObject() { Out += TEXT("}"); bFirst = false; }
		void BeginArray() { Out += TEXT("["); bFirst = true; }
		void EndArray() { Out += TEXT("]"); bFirst = false; }

		void Field(const TCHAR* K, int64 V) { Key(K); Int(V); bFirst = false; }
		void Field(const TCHAR* K, const FString& V) { Key(K); Str(V); bFirst = false; }
		void FieldBool(const TCHAR* K, bool V) { Key(K); Out += V ? TEXT("true") : TEXT("false"); bFirst = false; }
		void ArrayKey(const TCHAR* K) { Key(K); BeginArray(); }
		void ObjectKey(const TCHAR* K) { Key(K); BeginObject(); }
		void ElementObject() { Comma(); BeginObject(); }
		void ElementInt(int64 V) { Comma(); Int(V); }
		void ElementStr(const FString& V) { Comma(); Str(V); }
	};

	void WritePlayer(FWriter& W, const FFM13Player& P)
	{
		W.ElementObject();
		W.Field(TEXT("id"), P.Id);
		W.Field(TEXT("name"), P.Name);
		W.Field(TEXT("pos"), (int64)P.Pos);
		W.Field(TEXT("str"), P.Strength);
		W.Field(TEXT("pot"), P.Potential);
		W.Field(TEXT("age"), P.Age);
		W.Field(TEXT("goals"), P.GoalsSeason);
		W.Field(TEXT("goalsCareer"), P.GoalsCareer);
		W.Field(TEXT("apps"), P.Appearances);
		W.Field(TEXT("mv"), P.MarketValue);
		W.Field(TEXT("wage"), P.Wage);
		W.Field(TEXT("contract"), P.ContractYears);
		W.Field(TEXT("inj"), P.InjuredMatchdays);
		W.Field(TEXT("susp"), P.SuspendedMatchdays);
		W.Field(TEXT("yel"), P.YellowCards);
		W.Field(TEXT("seasons"), P.SeasonsAtClub);
		W.Field(TEXT("arch"), (int64)P.Archetype);
		W.EndObject();
	}

	void WriteSponsor(FWriter& W, const FFM13Sponsor& S)
	{
		W.Field(TEXT("name"), S.Name); W.Field(TEXT("base"), S.Base); W.Field(TEXT("win"), S.WinBonus);
		W.Field(TEXT("promo"), S.PromotionBonus); W.Field(TEXT("signOn"), S.SignOn); W.Field(TEXT("left"), S.MatchdaysLeft); W.Field(TEXT("tier"), S.Tier);
	}

	void WriteCup(FWriter& W, const TCHAR* Key, const FFM13Cup& C)
	{
		W.ObjectKey(Key);
		W.Field(TEXT("round"), C.Round);
		W.FieldBool(TEXT("ownEntered"), C.bOwnEntered);
		W.FieldBool(TEXT("ownAlive"), C.bOwnAlive);
		W.Field(TEXT("winner"), C.Winner);
		W.ArrayKey(TEXT("alive"));
		for (const FString& N : C.Alive) W.ElementStr(N);
		W.EndArray();
		W.ArrayKey(TEXT("last"));
		for (const FFM13CupMatch& M : C.LastRound)
		{
			W.ElementObject();
			W.Field(TEXT("h"), M.Home); W.Field(TEXT("a"), M.Away);
			W.Field(TEXT("hg"), M.HomeGoals); W.Field(TEXT("ag"), M.AwayGoals);
			W.FieldBool(TEXT("pen"), M.bPenalties); W.Field(TEXT("win"), M.Winner);
			W.EndObject();
		}
		W.EndArray();
		W.EndObject();
	}
}

namespace FM13Save
{
	FString Encode(const FFM13World& S)
	{
		FWriter W;
		W.BeginObject();
		W.Field(TEXT("version"), Version);
		W.Field(TEXT("clubName"), S.ClubName);
		W.Field(TEXT("season"), S.Season);
		W.Field(TEXT("matchday"), S.Matchday);
		W.Field(TEXT("leagueLevel"), S.LeagueLevel);
		W.Field(TEXT("money"), S.Money);
		W.Field(TEXT("fans"), S.Fans);
		W.Field(TEXT("boardSat"), S.BoardSat);
		W.Field(TEXT("lowBoardSatStreak"), S.LowBoardSatStreak);
		W.ArrayKey(TEXT("boardHistory"));
		for (int32 V : S.BoardHistory) W.ElementInt(V);
		W.EndArray();
		W.Field(TEXT("earlyWarnSeason"), S.EarlyWarnSeason);
		W.Field(TEXT("seasonTarget"), S.SeasonTarget);
		W.Field(TEXT("wageBudget"), S.WageBudget);
		W.FieldBool(TEXT("sacked"), S.bSacked);
		W.Field(TEXT("capacity"), S.StadiumCapacity);
		W.Field(TEXT("pendingSeats"), S.PendingSeats);
		W.Field(TEXT("pendingSeatsMatchdays"), S.PendingSeatsMatchdays);
		W.Field(TEXT("ticketPrice"), S.TicketPrice);
		W.Field(TEXT("academy"), S.YouthAcademyLevel);
		W.Field(TEXT("training"), S.TrainingLevel);
		W.Field(TEXT("tvPaid"), S.TvPaidThisSeason);
		W.Field(TEXT("nextPlayerId"), S.NextPlayerId);
		W.Field(TEXT("rngSeed"), (int64)S.Rng.GetCurrentSeed());
		W.FieldBool(TEXT("dfbViaLandespokal"), S.bDfbViaLandespokal);
		W.Field(TEXT("formation"), S.Formation);
		W.Field(TEXT("tacticStyle"), S.TacticStyle);
		W.ArrayKey(TEXT("recentStyles"));
		for (const FString& St : S.RecentStyles) W.ElementStr(St);
		W.EndArray();
		W.Field(TEXT("oppPlan"), (int64)S.OppPlanArchetype);
		W.FieldBool(TEXT("oppPlanReacted"), S.bOppPlanReacted);
		W.Field(TEXT("weather"), S.WeatherIndex);
		W.ObjectKey(TEXT("sponsor")); WriteSponsor(W, S.Sponsor); W.EndObject();
		W.ArrayKey(TEXT("sponsorOffers"));
		for (const FFM13Sponsor& O : S.SponsorOffers) { W.ElementObject(); WriteSponsor(W, O); W.EndObject(); }
		W.EndArray();
		W.ArrayKey(TEXT("incomingOffers"));
		for (const FFM13IncomingOffer& O : S.IncomingOffers)
		{
			W.ElementObject();
			W.Field(TEXT("id"), O.PlayerId); W.FieldBool(TEXT("youth"), O.bYouth); W.Field(TEXT("name"), O.PlayerName);
			W.Field(TEXT("club"), O.Club); W.Field(TEXT("price"), O.Price); W.Field(TEXT("until"), O.ExpiresMatchday);
			W.EndObject();
		}
		W.EndArray();
		W.ObjectKey(TEXT("records"));
		W.Field(TEXT("winFor"), S.Records.BiggestWinFor); W.Field(TEXT("winAgainst"), S.Records.BiggestWinAgainst);
		W.Field(TEXT("winOpp"), S.Records.BiggestWinOpponent); W.Field(TEXT("winSeason"), S.Records.BiggestWinSeason);
		W.Field(TEXT("unbeaten"), S.Records.UnbeatenStreak); W.Field(TEXT("longestUnbeaten"), S.Records.LongestUnbeatenStreak);
		W.Field(TEXT("attendance"), S.Records.RecordAttendance); W.Field(TEXT("fee"), S.Records.RecordTransferFee);
		W.EndObject();
		W.ArrayKey(TEXT("achievements"));
		for (const FFM13Achievement& A : S.Achievements) { W.ElementObject(); W.Field(TEXT("id"), A.Id); W.Field(TEXT("season"), A.Season); W.Field(TEXT("matchday"), A.Matchday); W.EndObject(); }
		W.EndArray();
		W.ArrayKey(TEXT("legends"));
		for (const FFM13Legend& L : S.Legends)
		{
			W.ElementObject();
			W.Field(TEXT("name"), L.Name); W.Field(TEXT("pos"), L.Position); W.Field(TEXT("seasons"), L.Seasons);
			W.Field(TEXT("goals"), L.Goals); W.Field(TEXT("best"), L.BestStrength); W.Field(TEXT("retired"), L.RetiredSeason);
			W.EndObject();
		}
		W.EndArray();
		WriteCup(W, TEXT("dfbPokal"), S.DfbPokal);
		WriteCup(W, TEXT("landespokal"), S.Landespokal);

		W.ArrayKey(TEXT("squad"));
		for (const FFM13Player& P : S.Squad) WritePlayer(W, P);
		W.EndArray();
		W.ArrayKey(TEXT("youth"));
		for (const FFM13Player& P : S.YouthTalents) WritePlayer(W, P);
		W.EndArray();
		W.ArrayKey(TEXT("market"));
		for (const FFM13MarketOffer& O : S.Market)
		{
			W.ElementObject();
			W.Field(TEXT("price"), O.Price);
			W.Key(TEXT("player")); W.bFirst = true; // WritePlayer setzt selbst das Komma
			{
				FWriter Inner;
				WritePlayer(Inner, O.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.EndObject();
		}
		W.EndArray();

		W.ArrayKey(TEXT("leagues"));
		for (const FFM13League& L : S.Leagues)
		{
			W.ElementObject();
			W.Field(TEXT("level"), L.Level);
			W.ArrayKey(TEXT("clubs"));
			for (const FFM13Club& C : L.Clubs)
			{
				W.ElementObject();
				W.Field(TEXT("name"), C.Name);
				W.Field(TEXT("str"), C.Strength);
				W.Field(TEXT("style"), (int64)C.Playstyle);
				W.FieldBool(TEXT("own"), C.bOwn);
				W.Field(TEXT("p"), C.Played);
				W.Field(TEXT("w"), C.Won);
				W.Field(TEXT("d"), C.Drawn);
				W.Field(TEXT("l"), C.Lost);
				W.Field(TEXT("gf"), C.GoalsFor);
				W.Field(TEXT("ga"), C.GoalsAgainst);
				W.EndObject();
			}
			W.EndArray();
			W.ArrayKey(TEXT("fixtures"));
			for (const FFM13Fixture& F : L.Fixtures)
			{
				// kompakt: [Spieltag, Heim, Gast, gespielt, Tore Heim, Tore Gast]
				W.Comma(); W.BeginArray();
				W.ElementInt(F.Matchday); W.ElementInt(F.Home); W.ElementInt(F.Away);
				W.ElementInt(F.bPlayed ? 1 : 0); W.ElementInt(F.HomeGoals); W.ElementInt(F.AwayGoals);
				W.EndArray();
			}
			W.EndArray();
			W.EndObject();
		}
		W.EndArray();

		W.ArrayKey(TEXT("bookings"));
		for (const FFM13Booking& B : S.Bookings)
		{
			W.ElementObject();
			W.Field(TEXT("label"), B.Label); W.Field(TEXT("amount"), B.Amount);
			W.Field(TEXT("season"), B.Season); W.Field(TEXT("matchday"), B.Matchday);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("messages"));
		for (const FFM13Message& M : S.Messages)
		{
			W.ElementObject();
			W.Field(TEXT("title"), M.Title); W.Field(TEXT("body"), M.Body);
			W.Field(TEXT("season"), M.Season); W.Field(TEXT("matchday"), M.Matchday);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("history"));
		for (const FFM13SeasonRecord& R : S.History)
		{
			W.ElementObject();
			W.Field(TEXT("season"), R.Season); W.Field(TEXT("level"), R.Level); W.Field(TEXT("rank"), R.Rank);
			W.Field(TEXT("points"), R.Points); W.Field(TEXT("outcome"), (int64)R.Outcome);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("usedClubNames"));
		for (const FString& N : S.UsedClubNames) W.ElementStr(N);
		W.EndArray();
		W.EndObject();
		return W.Out;
	}
}

// ---------- Lesen ----------
namespace
{
	using namespace FM13Json;

	FFM13Player ReadPlayer(const FReader& R, int32 Obj)
	{
		FFM13Player P;
		P.Id = (int32)R.Int(Obj, TEXT("id"), 0);
		P.Name = R.Str(Obj, TEXT("name"), TEXT("?"));
		P.Pos = (EFM13Position)FMath::Clamp((int32)R.Int(Obj, TEXT("pos"), 2), 0, 3);
		P.Strength = FMath::Clamp((int32)R.Int(Obj, TEXT("str"), 50), 1, 99);
		P.Potential = FMath::Clamp((int32)R.Int(Obj, TEXT("pot"), P.Strength), 1, 99);
		P.Age = (int32)R.Int(Obj, TEXT("age"), 24);
		P.GoalsSeason = (int32)R.Int(Obj, TEXT("goals"), 0);
		P.GoalsCareer = (int32)R.Int(Obj, TEXT("goalsCareer"), 0);
		P.Appearances = (int32)R.Int(Obj, TEXT("apps"), 0);
		P.MarketValue = R.Int(Obj, TEXT("mv"), 15000);
		P.Wage = (int32)R.Int(Obj, TEXT("wage"), 250);
		P.ContractYears = (int32)R.Int(Obj, TEXT("contract"), 1);
		P.InjuredMatchdays = (int32)R.Int(Obj, TEXT("inj"), 0);
		P.SuspendedMatchdays = (int32)R.Int(Obj, TEXT("susp"), 0);
		P.YellowCards = (int32)R.Int(Obj, TEXT("yel"), 0);
		P.SeasonsAtClub = (int32)R.Int(Obj, TEXT("seasons"), 0);
		P.Archetype = (uint8)FMath::Clamp((int32)R.Int(Obj, TEXT("arch"), 0), 0, 4);
		return P;
	}

	FFM13Sponsor ReadSponsor(const FReader& R, int32 N)
	{
		FFM13Sponsor S;
		S.Name = R.Str(N, TEXT("name"), TEXT("Kein Hauptsponsor")); S.Base = (int32)R.Int(N, TEXT("base"), 500); S.WinBonus = (int32)R.Int(N, TEXT("win"), 200);
		S.PromotionBonus = (int32)R.Int(N, TEXT("promo"), 0); S.SignOn = (int32)R.Int(N, TEXT("signOn"), 0); S.MatchdaysLeft = (int32)R.Int(N, TEXT("left"), 0);
		S.Tier = R.Str(N, TEXT("tier"), TEXT(""));
		return S;
	}

	// Pokal: Regeln (Runden, Spieltage, Prämien) kommen aus dem Code, gespeichert ist nur der Stand
	bool ReadCup(const FReader& R, const TArray<FNode>& Nodes, int32 Root, const TCHAR* Key, FFM13Cup& Out)
	{
		const int32 C = R.Find(Root, Key);
		if (C < 0) return false;
		Out.Round = FMath::Clamp((int32)R.Int(C, TEXT("round"), 0), 0, Out.RoundMatchdays.Num());
		Out.bOwnEntered = R.Bool(C, TEXT("ownEntered"), false);
		Out.bOwnAlive = R.Bool(C, TEXT("ownAlive"), false);
		Out.Winner = R.Str(C, TEXT("winner"), TEXT(""));
		for (int32 N : R.Items(C, TEXT("alive"))) Out.Alive.Add(Nodes[N].Text);
		for (int32 N : R.Items(C, TEXT("last")))
		{
			FFM13CupMatch M;
			M.Home = R.Str(N, TEXT("h"), TEXT("")); M.Away = R.Str(N, TEXT("a"), TEXT(""));
			M.HomeGoals = (int32)R.Int(N, TEXT("hg"), 0); M.AwayGoals = (int32)R.Int(N, TEXT("ag"), 0);
			M.bPenalties = R.Bool(N, TEXT("pen"), false); M.Winner = R.Str(N, TEXT("win"), TEXT(""));
			Out.LastRound.Add(M);
		}
		return true;
	}
}

namespace FM13Save
{
	bool Decode(const FString& Text, FFM13World& OutWorld, FString& OutError)
	{
		FDocument P;
		if (!Parse(Text, P, OutError)) { OutError = TEXT("Spielstand ist kein gueltiges JSON: ") + OutError; return false; }
		const int32 Root = P.Root;
		const FReader R(P.Nodes);
		if (R.Find(Root, TEXT("clubName")) < 0) { OutError = TEXT("Kein Spielstand von Anstoss FM13."); return false; }
		const int64 V = R.Int(Root, TEXT("version"), 0);
		if (V < 1 || V > Version) { OutError = FString::Printf(TEXT("Unbekannte Spielstand-Version %lld."), (long long)V); return false; }

		// In eine Kopie lesen: das Ziel bleibt bei einem Fehler unangetastet
		FFM13World W;
		W.ClubName = R.Str(Root, TEXT("clubName"), TEXT(""));
		W.Season = (int32)R.Int(Root, TEXT("season"), 1);
		W.Matchday = (int32)R.Int(Root, TEXT("matchday"), 1);
		W.LeagueLevel = (int32)R.Int(Root, TEXT("leagueLevel"), FM13::StartLeagueLevel);
		W.Money = R.Int(Root, TEXT("money"), 0);
		W.Fans = (int32)R.Int(Root, TEXT("fans"), 75);
		W.BoardSat = (int32)R.Int(Root, TEXT("boardSat"), 80);
		W.LowBoardSatStreak = (int32)R.Int(Root, TEXT("lowBoardSatStreak"), 0);
		for (int32 N : R.Items(Root, TEXT("boardHistory"))) W.BoardHistory.Add((int32)P.Nodes[N].Number);
		W.EarlyWarnSeason = (int32)R.Int(Root, TEXT("earlyWarnSeason"), 0);
		W.SeasonTarget = (int32)R.Int(Root, TEXT("seasonTarget"), 9);
		W.WageBudget = R.Int(Root, TEXT("wageBudget"), 0);
		W.bSacked = R.Bool(Root, TEXT("sacked"), false);
		W.StadiumCapacity = (int32)R.Int(Root, TEXT("capacity"), 4000);
		W.PendingSeats = (int32)R.Int(Root, TEXT("pendingSeats"), 0);
		W.PendingSeatsMatchdays = (int32)R.Int(Root, TEXT("pendingSeatsMatchdays"), 0);
		W.TicketPrice = (int32)R.Int(Root, TEXT("ticketPrice"), 13);
		W.YouthAcademyLevel = (int32)R.Int(Root, TEXT("academy"), 1);
		W.TrainingLevel = (int32)R.Int(Root, TEXT("training"), 1);
		W.TvPaidThisSeason = R.Int(Root, TEXT("tvPaid"), 0);
		W.NextPlayerId = (int32)R.Int(Root, TEXT("nextPlayerId"), 1);
		W.Rng.Initialize((int32)R.Int(Root, TEXT("rngSeed"), 1));
		W.bDfbViaLandespokal = R.Bool(Root, TEXT("dfbViaLandespokal"), false);
		W.Formation = R.Str(Root, TEXT("formation"), TEXT("4-4-2"));
		W.TacticStyle = R.Str(Root, TEXT("tacticStyle"), TEXT("ausgeglichen"));
		for (int32 N : R.Items(Root, TEXT("recentStyles"))) W.RecentStyles.Add(P.Nodes[N].Text);
		W.OppPlanArchetype = (TCHAR)R.Int(Root, TEXT("oppPlan"), 0);
		W.bOppPlanReacted = R.Bool(Root, TEXT("oppPlanReacted"), false);
		W.WeatherIndex = FMath::Clamp((int32)R.Int(Root, TEXT("weather"), 0), 0, 5);
		const int32 Sp = R.Find(Root, TEXT("sponsor"));
		if (Sp >= 0) W.Sponsor = ReadSponsor(R, Sp);
		else { W.Sponsor.Name = TEXT("Kein Hauptsponsor"); W.Sponsor.Base = 500; W.Sponsor.WinBonus = 200; }
		for (int32 N : R.Items(Root, TEXT("sponsorOffers"))) W.SponsorOffers.Add(ReadSponsor(R, N));
		for (int32 N : R.Items(Root, TEXT("incomingOffers")))
		{
			FFM13IncomingOffer O;
			O.PlayerId = (int32)R.Int(N, TEXT("id"), 0); O.bYouth = R.Bool(N, TEXT("youth"), false); O.PlayerName = R.Str(N, TEXT("name"), TEXT(""));
			O.Club = R.Str(N, TEXT("club"), TEXT("")); O.Price = R.Int(N, TEXT("price"), 0); O.ExpiresMatchday = (int32)R.Int(N, TEXT("until"), 0);
			W.IncomingOffers.Add(O);
		}
		const int32 Rk = R.Find(Root, TEXT("records"));
		W.Records.BiggestWinFor = (int32)R.Int(Rk, TEXT("winFor"), 0); W.Records.BiggestWinAgainst = (int32)R.Int(Rk, TEXT("winAgainst"), 0);
		W.Records.BiggestWinOpponent = R.Str(Rk, TEXT("winOpp"), TEXT("")); W.Records.BiggestWinSeason = (int32)R.Int(Rk, TEXT("winSeason"), 0);
		W.Records.UnbeatenStreak = (int32)R.Int(Rk, TEXT("unbeaten"), 0); W.Records.LongestUnbeatenStreak = (int32)R.Int(Rk, TEXT("longestUnbeaten"), 0);
		W.Records.RecordAttendance = (int32)R.Int(Rk, TEXT("attendance"), 0); W.Records.RecordTransferFee = R.Int(Rk, TEXT("fee"), 0);
		for (int32 N : R.Items(Root, TEXT("achievements")))
		{
			FFM13Achievement A;
			A.Id = R.Str(N, TEXT("id"), TEXT("")); A.Season = (int32)R.Int(N, TEXT("season"), 0); A.Matchday = (int32)R.Int(N, TEXT("matchday"), 0);
			if (!A.Id.IsEmpty()) W.Achievements.Add(A);
		}
		for (int32 N : R.Items(Root, TEXT("legends")))
		{
			FFM13Legend L;
			L.Name = R.Str(N, TEXT("name"), TEXT("")); L.Position = R.Str(N, TEXT("pos"), TEXT("")); L.Seasons = (int32)R.Int(N, TEXT("seasons"), 0);
			L.Goals = (int32)R.Int(N, TEXT("goals"), 0); L.BestStrength = (int32)R.Int(N, TEXT("best"), 0); L.RetiredSeason = (int32)R.Int(N, TEXT("retired"), 0);
			W.Legends.Add(L);
		}
		W.DfbPokal = FM13CupRules::MakeDfbPokal();
		W.Landespokal = FM13CupRules::MakeLandespokal();
		// Ältere Stände ohne Pokal: Wettbewerbe dieser Saison gelten als beendet (ab der nächsten Saison normal)
		if (!ReadCup(R, P.Nodes, Root, TEXT("dfbPokal"), W.DfbPokal)) W.DfbPokal.Round = W.DfbPokal.RoundMatchdays.Num();
		if (!ReadCup(R, P.Nodes, Root, TEXT("landespokal"), W.Landespokal)) W.Landespokal.Round = W.Landespokal.RoundMatchdays.Num();

		for (int32 N : R.Items(Root, TEXT("squad"))) W.Squad.Add(ReadPlayer(R, N));
		for (int32 N : R.Items(Root, TEXT("youth"))) W.YouthTalents.Add(ReadPlayer(R, N));
		for (int32 N : R.Items(Root, TEXT("market")))
		{
			FFM13MarketOffer O;
			O.Price = R.Int(N, TEXT("price"), 0);
			O.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			W.Market.Add(O);
		}
		for (int32 N : R.Items(Root, TEXT("leagues")))
		{
			FFM13League L;
			L.Level = (int32)R.Int(N, TEXT("level"), 0);
			for (int32 C : R.Items(N, TEXT("clubs")))
			{
				FFM13Club Club;
				Club.Name = R.Str(C, TEXT("name"), TEXT("?"));
				Club.Strength = (int32)R.Int(C, TEXT("str"), 50);
				Club.Playstyle = (EFM13Playstyle)FMath::Clamp((int32)R.Int(C, TEXT("style"), 2), 0, 3);
				Club.bOwn = R.Bool(C, TEXT("own"), false);
				Club.Played = (int32)R.Int(C, TEXT("p"), 0);
				Club.Won = (int32)R.Int(C, TEXT("w"), 0);
				Club.Drawn = (int32)R.Int(C, TEXT("d"), 0);
				Club.Lost = (int32)R.Int(C, TEXT("l"), 0);
				Club.GoalsFor = (int32)R.Int(C, TEXT("gf"), 0);
				Club.GoalsAgainst = (int32)R.Int(C, TEXT("ga"), 0);
				L.Clubs.Add(Club);
			}
			for (int32 F : R.Items(N, TEXT("fixtures")))
			{
				const TArray<int32>& T = P.Nodes[F].Children;
				if (P.Nodes[F].Type != ENodeType::Array || T.Num() != 6) { OutError = TEXT("Spielplan beschaedigt."); return false; }
				FFM13Fixture Fx;
				Fx.Matchday = (int32)P.Nodes[T[0]].Number;
				Fx.Home = (int32)P.Nodes[T[1]].Number;
				Fx.Away = (int32)P.Nodes[T[2]].Number;
				Fx.bPlayed = P.Nodes[T[3]].Number != 0;
				Fx.HomeGoals = (int32)P.Nodes[T[4]].Number;
				Fx.AwayGoals = (int32)P.Nodes[T[5]].Number;
				L.Fixtures.Add(Fx);
			}
			W.Leagues.Add(L);
		}
		for (int32 N : R.Items(Root, TEXT("bookings")))
		{
			FFM13Booking B;
			B.Label = R.Str(N, TEXT("label"), TEXT("")); B.Amount = R.Int(N, TEXT("amount"), 0);
			B.Season = (int32)R.Int(N, TEXT("season"), 1); B.Matchday = (int32)R.Int(N, TEXT("matchday"), 1);
			W.Bookings.Add(B);
		}
		for (int32 N : R.Items(Root, TEXT("messages")))
		{
			FFM13Message M;
			M.Title = R.Str(N, TEXT("title"), TEXT("")); M.Body = R.Str(N, TEXT("body"), TEXT(""));
			M.Season = (int32)R.Int(N, TEXT("season"), 1); M.Matchday = (int32)R.Int(N, TEXT("matchday"), 1);
			W.Messages.Add(M);
		}
		for (int32 N : R.Items(Root, TEXT("history")))
		{
			FFM13SeasonRecord Rec;
			Rec.Season = (int32)R.Int(N, TEXT("season"), 1); Rec.Level = (int32)R.Int(N, TEXT("level"), 5);
			Rec.Rank = (int32)R.Int(N, TEXT("rank"), 0); Rec.Points = (int32)R.Int(N, TEXT("points"), 0);
			Rec.Outcome = (EFM13SeasonOutcome)FMath::Clamp((int32)R.Int(N, TEXT("outcome"), 0), 0, 2);
			W.History.Add(Rec);
		}
		for (int32 N : R.Items(Root, TEXT("usedClubNames"))) W.UsedClubNames.Add(P.Nodes[N].Text);

		// Prüfung wie loadSaveSafely: Struktur muss stimmen, sonst bleibt der alte Stand
		if (W.ClubName.IsEmpty()) { OutError = TEXT("Vereinsname fehlt."); return false; }
		if (W.Leagues.Num() != FM13::NumLeagues) { OutError = TEXT("Ligen fehlen im Spielstand."); return false; }
		if (W.LeagueLevel < 0 || W.LeagueLevel >= FM13::NumLeagues) { OutError = TEXT("Ungueltige Liga."); return false; }
		int32 Eigene = 0;
		for (const FFM13League& L : W.Leagues)
		{
			if (L.Clubs.Num() != FM13::TeamsPerLeague) { OutError = TEXT("Eine Liga hat nicht 18 Vereine."); return false; }
			for (const FFM13Fixture& F : L.Fixtures)
				if (!L.Clubs.IsValidIndex(F.Home) || !L.Clubs.IsValidIndex(F.Away)) { OutError = TEXT("Spielplan verweist auf unbekannte Vereine."); return false; }
			for (const FFM13Club& C : L.Clubs) if (C.bOwn) { ++Eigene; if (L.Level != W.LeagueLevel) { OutError = TEXT("Eigener Verein in der falschen Liga."); return false; } }
		}
		if (Eigene != 1) { OutError = TEXT("Eigener Verein fehlt oder ist doppelt."); return false; }
		if (W.Squad.Num() == 0) { OutError = TEXT("Kader ist leer."); return false; }
		if (W.Matchday < 1 || W.Matchday > FM13::MatchdaysPerSeason + 1) { OutError = TEXT("Ungueltiger Spieltag."); return false; }

		OutWorld = W;
		return true;
	}
}
