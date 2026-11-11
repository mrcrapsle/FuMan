#include "FM13SaveCodec.h"
#include "FM13Fitness.h"
#include "FM13Youth.h"
#include "FM13Staff.h"
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
		void FieldReal(const TCHAR* K, double V) { Key(K); Out += FString::Printf(TEXT("%.6f"), V); bFirst = false; }
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
		W.Field(TEXT("assists"), P.Assists);
		W.Field(TEXT("assistsCareer"), P.AssistsCareer);
		W.Field(TEXT("gradeSum"), P.GradeSum);
		W.Field(TEXT("gradeGames"), P.GradeGames);
		W.Field(TEXT("lastGrade"), P.LastGrade);
		W.Field(TEXT("elf"), P.TeamOfMatchday);
		W.Field(TEXT("fitness"), P.Fitness);
		W.Field(TEXT("dailyForm"), P.DailyForm);
		W.Field(TEXT("trait"), (int64)P.Trait);
		W.Field(TEXT("appsTotal"), P.AppearancesTotal);
		W.Field(TEXT("timesInjured"), P.TimesInjured);
		W.Field(TEXT("nation"), (int64)P.Nation);
		W.Field(TEXT("potentialTier"), (int64)P.PotentialTier);
		W.Field(TEXT("proDecisionLeft"), P.ProDecisionLeft);
		W.FieldBool(TEXT("academyGraduate"), P.bAcademyGraduate);
		W.Field(TEXT("meilensteinDebut"), P.MeilensteinDebut);
		W.Field(TEXT("meilensteinTor"), P.MeilensteinTor);
		W.Field(TEXT("meilensteinElf"), P.MeilensteinElf);
		W.FieldBool(TEXT("potentialRevealed"), P.bPotentialRevealed);
		W.Field(TEXT("youthFocus"), P.YouthFocus);
		W.Field(TEXT("mentorId"), P.MentorId);
		W.Field(TEXT("friendId"), P.FriendId);
		W.Field(TEXT("tenure"), P.SquadTenure);
		W.FieldBool(TEXT("chronic"), P.bChronic);
		W.Field(TEXT("preOfferClub"), P.PreOfferClub);
		W.Field(TEXT("preOfferDeadline"), P.PreOfferDeadline);
		W.Field(TEXT("preSignedClub"), P.PreSignedClub);
		W.FieldBool(TEXT("hasAgent"), P.bHasAgent);
		W.Field(TEXT("agentIndex"), (int64)P.AgentIndex);
		W.Field(TEXT("agentFeeMicro"), (int64)FMath::RoundToInt64(P.AgentFeePct * 1000000.0));
		W.Field(TEXT("apps"), P.Appearances);
		W.Field(TEXT("mv"), P.MarketValue);
		W.Field(TEXT("wage"), P.Wage);
		W.Field(TEXT("contract"), P.ContractYears);
		W.Field(TEXT("inj"), P.InjuredMatchdays);
		W.Field(TEXT("susp"), P.SuspendedMatchdays);
		W.Field(TEXT("yel"), P.YellowCards);
		W.Field(TEXT("seasons"), P.SeasonsAtClub);
		W.Field(TEXT("arch"), (int64)P.Archetype);
		W.Field(TEXT("char"), (int64)P.Character);
		W.Field(TEXT("morale"), P.Morale);
		W.EndObject();
	}

	void WriteSponsor(FWriter& W, const FFM13Sponsor& S)
	{
		W.Field(TEXT("name"), S.Name); W.Field(TEXT("base"), S.Base); W.Field(TEXT("win"), S.WinBonus);
		W.Field(TEXT("promo"), S.PromotionBonus); W.Field(TEXT("signOn"), S.SignOn); W.Field(TEXT("left"), S.MatchdaysLeft); W.Field(TEXT("tier"), S.Tier);
	}

	void WriteEuroTie(FWriter& W, const FFM13EuroTie& T)
	{
		W.Field(TEXT("a"), T.A); W.Field(TEXT("b"), T.B);
		W.Field(TEXT("l1a"), T.Leg1A); W.Field(TEXT("l1b"), T.Leg1B); W.Field(TEXT("l2a"), T.Leg2A); W.Field(TEXT("l2b"), T.Leg2B);
		W.FieldBool(TEXT("pen"), T.bPenalties); W.Field(TEXT("win"), T.Winner);
	}

	void WriteStrings(FWriter& W, const TCHAR* Key, const TArray<FString>& L)
	{
		W.ArrayKey(Key);
		for (const FString& X : L) W.ElementStr(X);
		W.EndArray();
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
		W.Field(TEXT("rngKabineSeed"), (int64)S.RngKabine.GetCurrentSeed());
		W.Field(TEXT("rngTransferSeed"), (int64)S.RngTransfer.GetCurrentSeed());
		W.Field(TEXT("transferBudget"), S.TransferBudget);
		W.FieldBool(TEXT("winterActive"), S.bWinterWindowActive);
		W.FieldBool(TEXT("winterUsed"), S.bWinterWindowUsed);
		W.Field(TEXT("winterClose"), S.WinterWindowCloseMatchday);
		W.FieldBool(TEXT("strategySet"), S.bStrategySet);
		W.Field(TEXT("strategySeason"), S.Strategy.Season);
		W.Field(TEXT("strategyChoice"), (int64)S.Strategy.Choice);
		W.FieldBool(TEXT("strategyAuto"), S.Strategy.bAuto);
		W.Field(TEXT("strategyOldGoal"), S.Strategy.OldGoal);
		W.Field(TEXT("strategyGoal"), S.Strategy.Goal);
		W.Field(TEXT("strategyDelta"), S.Strategy.BudgetDelta);
		W.Field(TEXT("strategyResult"), S.Strategy.Result);
		W.Field(TEXT("rumorNr"), S.RumorNr);
		W.Field(TEXT("rumorHit0"), S.RumorHits[0]);
		W.Field(TEXT("rumorHit1"), S.RumorHits[1]);
		W.Field(TEXT("rumorHit2"), S.RumorHits[2]);
		W.Field(TEXT("rumorMiss0"), S.RumorMisses[0]);
		W.Field(TEXT("rumorMiss1"), S.RumorMisses[1]);
		W.Field(TEXT("rumorMiss2"), S.RumorMisses[2]);
		W.ArrayKey(TEXT("rumors"));
		for (const FFM13World::FFM13Rumor& G : S.Rumors)
		{
			W.ElementObject();
			W.Field(TEXT("id"), G.Id);
			W.Field(TEXT("source"), (int64)G.Source);
			W.FieldBool(TEXT("truth"), G.bTruth);
			W.Field(TEXT("club"), G.Club);
			W.Field(TEXT("type"), G.Type);
			W.Field(TEXT("playerId"), G.PlayerId);
			W.Field(TEXT("playerName"), G.PlayerName);
			W.Field(TEXT("created"), G.Created);
			W.Field(TEXT("season"), G.Season);
			W.Field(TEXT("resolveAt"), G.ResolveAt);
			W.Field(TEXT("reaction"), G.Reaction);
			W.FieldBool(TEXT("backedOff"), G.bBackedOff);
			W.Field(TEXT("outcome"), G.Outcome);
			W.EndObject();
		}
		W.EndArray();
		W.Field(TEXT("pokerActive"), S.Poker.bActive ? 1 : 0);
		W.Field(TEXT("pokerPlayer"), S.Poker.PlayerId);
		W.Field(TEXT("pokerOffer"), S.Poker.Offer);
		W.Field(TEXT("pokerRounds"), S.Poker.Rounds);
		W.Field(TEXT("pokerPatience"), S.Poker.Patience);
		W.FieldReal(TEXT("pokerRivalChance"), S.Poker.RivalChance);
		W.FieldBool(TEXT("pokerRival"), S.Poker.bRival);
		W.Field(TEXT("pokerRivalClub"), S.Poker.RivalClub);
		W.Field(TEXT("pokerRivalBid"), S.Poker.RivalBid);
		W.Field(TEXT("pokerAgreed"), S.Poker.AgreedFee);
		W.Field(TEXT("pokerWage"), S.Poker.WageDemand);
		W.FieldBool(TEXT("pokerWageTalked"), S.Poker.bWageTalked);
		WriteStrings(W, TEXT("pokerLog"), S.Poker.Log);
		W.FieldBool(TEXT("dfbViaLandespokal"), S.bDfbViaLandespokal);
		W.Field(TEXT("formation"), S.Formation);
		W.Field(TEXT("tacticStyle"), S.TacticStyle);
		W.Field(TEXT("teamTraining"), S.TeamTraining);
		W.Field(TEXT("trainingIntensity"), S.TrainingIntensity);
		W.FieldBool(TEXT("busTravel"), S.bBusTravel);
		W.FieldBool(TEXT("busSponsor"), S.bBusSponsor);
		W.FieldBool(TEXT("busBanden"), S.bBusBanden);
		W.FieldBool(TEXT("fitnessGuru"), S.bFitnessGuru);
		W.FieldBool(TEXT("tactician"), S.bTactician);
		W.Field(TEXT("license"), S.LicenseLevel);
		W.Field(TEXT("stress"), S.Stress);
		W.Field(TEXT("campusTrainingGround"), S.CampusTrainingGround);
		W.Field(TEXT("tackleHardness"), S.TackleHardness);
		W.Field(TEXT("captain"), S.CaptainId);
		W.Field(TEXT("youthCoachId"), S.YouthCoachId);
		W.Field(TEXT("youthCoachCount"), S.YouthCoachCount);
		W.Field(TEXT("rngJugendSeed"), (int64)S.RngJugend.GetCurrentSeed());
		W.FieldBool(TEXT("ratAktiv"), S.Anliegen.bAktiv);
		W.Field(TEXT("ratTyp"), S.Anliegen.Typ);
		W.Field(TEXT("ratTitel"), S.Anliegen.Titel);
		W.Field(TEXT("ratText"), S.Anliegen.Text);
		W.Field(TEXT("ratKosten"), S.Anliegen.Kosten);
		W.Field(TEXT("ratSpieler"), S.Anliegen.Spieler);
		W.Field(TEXT("ratWortfuehrer"), S.Anliegen.Wortfuehrer);
		W.Field(TEXT("ratKapitaen"), S.Anliegen.Kapitaen);
		W.Field(TEXT("ratNachfolger"), S.Anliegen.Nachfolger);
		W.Field(TEXT("ratClique"), S.Anliegen.Clique);
		W.Field(TEXT("ratSaison"), S.Anliegen.Saison);
		W.Field(TEXT("ratSpieltag"), S.Anliegen.Spieltag);
		W.ArrayKey(TEXT("ratVerlauf"));
		for (const FString& Z : S.RatVerlauf) W.ElementStr(Z);
		W.EndArray();
		W.ArrayKey(TEXT("ownSeasonGoals"));
		for (int32 V : S.OwnSeasonGoals) W.ElementInt(V);
		W.EndArray();
		W.Field(TEXT("promotionBoostLevel"), S.PromotionBoostLevel);
		W.Field(TEXT("promotionBoostSeason"), S.PromotionBoostSeason);
		W.Field(TEXT("campusReha"), S.CampusReha);
		W.ArrayKey(TEXT("council"));
		for (int32 Id : S.CouncilIds) W.ElementInt(Id);
		W.EndArray();
		W.Field(TEXT("wageBudgetCap"), S.WageBudgetCap);
		W.Field(TEXT("lastMeetingSeason"), S.LastMeetingSeason);
		W.Field(TEXT("poachSlot"), S.PoachSlot);
		W.Field(TEXT("poachRetention"), S.PoachRetention);
		W.ArrayKey(TEXT("weeklyPlan"));
		for (const FString& Tag : S.WeeklyPlan) W.ElementStr(Tag);
		W.EndArray();
		W.ArrayKey(TEXT("pairChemistry"));
		for (int32 k = 0; k < S.PairA.Num(); ++k) { W.ElementInt(S.PairA[k]); W.ElementInt(S.PairB[k]); W.ElementInt(S.PairValue[k]); }
		W.EndArray();
		const FFM13Staff* Personal[6] = { &S.AthletikTrainer, &S.Ernaehrungsberater, &S.Physio, &S.Greenkeeper, &S.CoTrainer, &S.Analyst };
		const TCHAR* PersonalKeys[6] = { TEXT("athletik"), TEXT("ernaehrung"), TEXT("physio"), TEXT("greenkeeper"), TEXT("coTrainer"), TEXT("analyst") };
		for (int32 i = 0; i < 6; ++i)
		{
			W.FieldReal(*(FString(PersonalKeys[i]) + TEXT("Morale")), Personal[i]->Morale);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("Wage")), Personal[i]->Wage);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("Contract")), Personal[i]->Contract);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("HiredSeason")), Personal[i]->HiredSeason);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("OnLeave")), Personal[i]->OnLeave);
			W.FieldBool(*(FString(PersonalKeys[i]) + TEXT("Interim")), Personal[i]->bInterim);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("UpgradeDays")), Personal[i]->UpgradeDays);
			W.FieldBool(*(FString(PersonalKeys[i]) + TEXT("Hired")), Personal[i]->bHired);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("Level")), Personal[i]->Level);
			W.Field(*(FString(PersonalKeys[i]) + TEXT("Task")), Personal[i]->Task);
		}
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
		W.ArrayKey(TEXT("manualLineup"));
		for (int32 Id : S.ManualLineup) W.ElementInt(Id);
		W.EndArray();
		W.ArrayKey(TEXT("manualBench"));
		for (int32 Id : S.ManualBench) W.ElementInt(Id);
		W.EndArray();
		W.Field(TEXT("pendingTalk"), S.PendingTalk);
		WriteStrings(W, TEXT("talkHistory"), S.TalkHistory);
		W.Field(TEXT("prepArch"), (int64)S.PrepArchetype);
		W.Field(TEXT("prepMatchday"), S.PrepMatchday);
		W.Field(TEXT("rival"), S.RivalName);
		WriteStrings(W, TEXT("derbyPreps"), S.DerbyPreps);
		W.Field(TEXT("derbyPrepMatchday"), S.DerbyPrepMatchday);
		W.FieldBool(TEXT("europeNext"), S.bEuropeNextSeason);
		W.Field(TEXT("europePot"), S.EuropePot);
		WriteStrings(W, TEXT("awards"), S.AwardHistory);
		W.ObjectKey(TEXT("europe"));
		W.FieldBool(TEXT("active"), S.Europe.bActive);
		W.Field(TEXT("round"), S.Europe.GroupRound);
		W.Field(TEXT("winner"), S.Europe.Winner);
		W.Field(TEXT("stage"), S.Europe.OwnStage);
		WriteStrings(W, TEXT("last"), S.Europe.LastResults);
		for (int32 G = 0; G < 2; ++G)
		{
			W.ArrayKey(G == 0 ? TEXT("groupA") : TEXT("groupB"));
			for (const FFM13EuroTeam& T : S.Europe.Groups[G])
			{
				W.ElementObject();
				W.Field(TEXT("name"), T.Name); W.Field(TEXT("str"), T.Strength); W.Field(TEXT("p"), T.Played); W.Field(TEXT("w"), T.Won);
				W.Field(TEXT("d"), T.Drawn); W.Field(TEXT("l"), T.Lost); W.Field(TEXT("gf"), T.GoalsFor); W.Field(TEXT("ga"), T.GoalsAgainst);
				W.EndObject();
			}
			W.EndArray();
		}
		W.ArrayKey(TEXT("semis"));
		for (const FFM13EuroTie& T : S.Europe.Semis) { W.ElementObject(); WriteEuroTie(W, T); W.EndObject(); }
		W.EndArray();
		W.ObjectKey(TEXT("final")); WriteEuroTie(W, S.Europe.Final); W.EndObject();
		W.EndObject();
		WriteCup(W, TEXT("dfbPokal"), S.DfbPokal);
		WriteCup(W, TEXT("landespokal"), S.Landespokal);

		W.ArrayKey(TEXT("squad"));
		for (const FFM13Player& P : S.Squad) WritePlayer(W, P);
		W.EndArray();
		W.ArrayKey(TEXT("youth"));
		for (const FFM13Player& P : S.YouthTalents) WritePlayer(W, P);
		W.EndArray();
		W.ArrayKey(TEXT("youthLoans"));
		for (const FFM13World::FFM13YouthLoan& L : S.YouthLoans)
		{
			W.ElementObject();
			W.Key(TEXT("player")); W.bFirst = true;
			{
				FWriter Inner;
				WritePlayer(Inner, L.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.Field(TEXT("club"), L.Club);
			W.Field(TEXT("clubLevel"), L.ClubLevel);
			W.Field(TEXT("clubStrength"), L.ClubStrength);
			W.Field(TEXT("duration"), L.Duration);
			W.Field(TEXT("originalStrength"), L.OriginalStrength);
			W.Field(TEXT("apps"), L.Apps);
			W.Field(TEXT("goals"), L.Goals);
			W.FieldReal(TEXT("devProgress"), L.DevProgress);
			W.EndObject();
		}
		W.EndArray();
		WriteStrings(W, TEXT("youthMoments"), S.YouthMoments);
		W.ArrayKey(TEXT("market"));
		for (const FFM13MarketOffer& O : S.Market)
		{
			W.ElementObject();
			W.Field(TEXT("price"), O.Price);
			W.Field(TEXT("sellerClub"), O.SellerClub);
			W.Field(TEXT("sellerMinimum"), O.SellerMinimum);
			W.Field(TEXT("askingPrice"), O.AskingPrice);
			W.FieldBool(TEXT("pokerBroken"), O.bPokerBroken);
			W.Field(TEXT("medIssue"), (int64)O.Medical.Issue);
			W.Field(TEXT("medInjuries"), O.Medical.Injuries);
			W.Field(TEXT("medWeeks"), O.Medical.Weeks);
			W.FieldBool(TEXT("medChecked"), O.Medical.bChecked);
			W.FieldBool(TEXT("medRolled"), O.bMedicalRolled);
			W.FieldBool(TEXT("bargain"), O.bDeadlineBargain);
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

		W.Field(TEXT("preContractPoolSeason"), S.PreContractPoolSeason);
		W.Field(TEXT("lastDeadlineKey"), S.LastDeadlineKey);
		W.ArrayKey(TEXT("aiNews"));
		for (const FFM13World::FFM13AiNews& N : S.AiNews)
		{
			W.ElementObject();
			W.Field(TEXT("season"), N.Season);
			W.Field(TEXT("matchday"), N.Matchday);
			W.Field(TEXT("player"), N.Player);
			W.Field(TEXT("pos"), (int64)N.Pos);
			W.Field(TEXT("strength"), N.Strength);
			W.Field(TEXT("from"), N.From);
			W.Field(TEXT("to"), N.To);
			W.Field(TEXT("fee"), N.Fee);
			W.FieldBool(TEXT("retired"), N.bRetired);
			W.Field(TEXT("fromLeague"), N.FromLeague);
			W.Field(TEXT("toLeague"), N.ToLeague);
			W.EndObject();
		}
		W.EndArray();
		W.Field(TEXT("freeNegPlayer"), S.FreeNegotiation.PlayerId);
		W.Field(TEXT("freeNegFee"), S.FreeNegotiation.CounterFee);
		W.Field(TEXT("swapId"), S.Poker.SwapId);
		W.ArrayKey(TEXT("agentRelations"));
		for (int32 I = 0; I < S.AgentRelationKeys.Num(); ++I)
		{
			W.ElementObject();
			W.Field(TEXT("agent"), S.AgentRelationKeys[I]);
			W.Field(TEXT("level"), S.AgentRelationVals[I]);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("freeAgents"));
		for (const FFM13World::FFM13FreeAgent& F : S.FreeAgents)
		{
			W.ElementObject();
			W.Key(TEXT("player")); W.bFirst = true;
			{
				FWriter Inner;
				WritePlayer(Inner, F.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.Field(TEXT("signOnFee"), F.SignOnFee);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("loanables"));
		for (const FFM13Loanable& L : S.Loanables)
		{
			W.ElementObject();
			W.Key(TEXT("player")); W.bFirst = true;
			{
				FWriter Inner;
				WritePlayer(Inner, L.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.Field(TEXT("parentClub"), L.ParentClub);
			W.Field(TEXT("loanFee"), L.LoanFee);
			W.Field(TEXT("buyOptionFee"), L.BuyOptionFee);
			W.Field(TEXT("duration"), L.DurationMatchdays);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("incomingLoans"));
		for (const FFM13IncomingLoan& L : S.IncomingLoans)
		{
			W.ElementObject();
			W.Field(TEXT("playerId"), L.PlayerId);
			W.Field(TEXT("parentClub"), L.ParentClub);
			W.Field(TEXT("matchdaysLeft"), L.MatchdaysLeft);
			W.Field(TEXT("buyOptionFee"), L.BuyOptionFee);
			W.EndObject();
		}
		W.EndArray();
		W.ArrayKey(TEXT("preContractPool"));
		for (const FFM13World::FFM13PreContractCandidate& C : S.PreContractPool)
		{
			W.ElementObject();
			W.Key(TEXT("player")); W.bFirst = true;
			{
				FWriter Inner;
				WritePlayer(Inner, C.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.Field(TEXT("sellerClub"), C.SellerClub);
			W.FieldBool(TEXT("refused"), C.bRefused);
			W.EndObject();
		}
		W.EndArray();

		W.ArrayKey(TEXT("preContracts"));
		for (const FFM13World::FFM13PreContractDeal& D : S.PreContracts)
		{
			W.ElementObject();
			W.Key(TEXT("player")); W.bFirst = true;
			{
				FWriter Inner;
				WritePlayer(Inner, D.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.Field(TEXT("from"), D.From);
			W.Field(TEXT("season"), D.Season);
			W.EndObject();
		}
		W.EndArray();

		W.ArrayKey(TEXT("buybackOptions"));
		for (const FFM13BuybackOption& O : S.BuybackOptions)
		{
			W.ElementObject();
			W.Key(TEXT("player")); W.bFirst = true;
			{
				FWriter Inner;
				WritePlayer(Inner, O.Player);
				W.Out += Inner.Out;
			}
			W.bFirst = false;
			W.Field(TEXT("club"), O.Club);
			W.Field(TEXT("price"), O.Price);
			W.Field(TEXT("untilSeason"), O.UntilSeason);
			W.Field(TEXT("saleStrength"), O.SaleStrength);
			W.Field(TEXT("season"), O.Season);
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
				W.FieldBool(TEXT("hasStar"), C.bHasStar);
				W.Field(TEXT("starPos"), (int64)C.StarPos);
				W.Field(TEXT("starName"), C.StarName);
				W.Field(TEXT("starStrength"), C.StarStrength);
				W.Field(TEXT("starAge"), C.StarAge);
				W.Field(TEXT("starGoals"), C.StarGoals);
				W.FieldBool(TEXT("hasStriker"), C.bHasStriker);
				W.Field(TEXT("strikerName"), C.StrikerName);
				W.Field(TEXT("strikerGoals"), C.StrikerGoals);
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
		P.Assists = (int32)R.Int(Obj, TEXT("assists"), 0);
		P.AssistsCareer = (int32)R.Int(Obj, TEXT("assistsCareer"), 0);
		P.GradeSum = (int32)R.Int(Obj, TEXT("gradeSum"), 0);
		P.GradeGames = (int32)R.Int(Obj, TEXT("gradeGames"), 0);
		P.LastGrade = (int32)R.Int(Obj, TEXT("lastGrade"), 0);
		P.TeamOfMatchday = FMath::Max(0, (int32)R.Int(Obj, TEXT("elf"), 0));
		P.Fitness = FMath::Clamp((int32)R.Int(Obj, TEXT("fitness"), 100), 10, 100);
		P.DailyForm = FMath::Clamp((int32)R.Int(Obj, TEXT("dailyForm"), 50), 5, 95);
		P.Trait = (uint8)FMath::Clamp((int32)R.Int(Obj, TEXT("trait"), 0), 0, 8);
		P.AppearancesTotal = FMath::Max(0, (int32)R.Int(Obj, TEXT("appsTotal"), 0));
		P.TimesInjured = FMath::Max(0, (int32)R.Int(Obj, TEXT("timesInjured"), 0));
		P.Nation = (uint8)FMath::Clamp((int32)R.Int(Obj, TEXT("nation"), 0), 0, 5);
		P.PotentialTier = (uint8)FMath::Clamp((int32)R.Int(Obj, TEXT("potentialTier"), 0), 0, 3);
		P.ProDecisionLeft = (int32)R.Int(Obj, TEXT("proDecisionLeft"), 0);
		P.bAcademyGraduate = R.Bool(Obj, TEXT("academyGraduate"), false);
		P.MeilensteinDebut = R.Str(Obj, TEXT("meilensteinDebut"), TEXT(""));
		P.MeilensteinTor = R.Str(Obj, TEXT("meilensteinTor"), TEXT(""));
		P.MeilensteinElf = R.Str(Obj, TEXT("meilensteinElf"), TEXT(""));
		P.bPotentialRevealed = R.Bool(Obj, TEXT("potentialRevealed"), false);
		P.YouthFocus = R.Str(Obj, TEXT("youthFocus"), TEXT("allgemein"));
		P.MentorId = (int32)R.Int(Obj, TEXT("mentorId"), 0);
		P.FriendId = (int32)R.Int(Obj, TEXT("friendId"), 0);
		P.SquadTenure = FMath::Max(0, (int32)R.Int(Obj, TEXT("tenure"), 0));
		P.bChronic = R.Bool(Obj, TEXT("chronic"), false);
		P.PreOfferClub = R.Str(Obj, TEXT("preOfferClub"), TEXT(""));
		P.PreOfferDeadline = (int32)R.Int(Obj, TEXT("preOfferDeadline"), 0);
		P.PreSignedClub = R.Str(Obj, TEXT("preSignedClub"), TEXT(""));
		P.bHasAgent = R.Bool(Obj, TEXT("hasAgent"), false);
		P.AgentIndex = (uint8)R.Int(Obj, TEXT("agentIndex"), 0);
		P.AgentFeePct = (double)R.Int(Obj, TEXT("agentFeeMicro"), 0) / 1000000.0;
		P.Appearances = (int32)R.Int(Obj, TEXT("apps"), 0);
		P.MarketValue = R.Int(Obj, TEXT("mv"), 15000);
		P.Wage = (int32)R.Int(Obj, TEXT("wage"), 250);
		P.ContractYears = (int32)R.Int(Obj, TEXT("contract"), 1);
		P.InjuredMatchdays = (int32)R.Int(Obj, TEXT("inj"), 0);
		P.SuspendedMatchdays = (int32)R.Int(Obj, TEXT("susp"), 0);
		P.YellowCards = (int32)R.Int(Obj, TEXT("yel"), 0);
		P.SeasonsAtClub = (int32)R.Int(Obj, TEXT("seasons"), 0);
		P.Archetype = (uint8)FMath::Clamp((int32)R.Int(Obj, TEXT("arch"), 0), 0, 4);
		P.Character = (uint8)FMath::Clamp((int32)R.Int(Obj, TEXT("char"), 0), 0, 5);
		P.Morale = FMath::Clamp((int32)R.Int(Obj, TEXT("morale"), 65), 5, 100);
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

	FFM13EuroTie ReadEuroTie(const FReader& R, int32 N)
	{
		FFM13EuroTie T;
		T.A = R.Str(N, TEXT("a"), TEXT("")); T.B = R.Str(N, TEXT("b"), TEXT(""));
		T.Leg1A = (int32)R.Int(N, TEXT("l1a"), -1); T.Leg1B = (int32)R.Int(N, TEXT("l1b"), -1);
		T.Leg2A = (int32)R.Int(N, TEXT("l2a"), -1); T.Leg2B = (int32)R.Int(N, TEXT("l2b"), -1);
		T.bPenalties = R.Bool(N, TEXT("pen"), false); T.Winner = R.Str(N, TEXT("win"), TEXT(""));
		return T;
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
		W.RngKabine.Initialize((int32)R.Int(Root, TEXT("rngKabineSeed"), 1));
		W.bDfbViaLandespokal = R.Bool(Root, TEXT("dfbViaLandespokal"), false);
		W.Formation = R.Str(Root, TEXT("formation"), TEXT("4-4-2"));
		W.TacticStyle = R.Str(Root, TEXT("tacticStyle"), TEXT("ausgeglichen"));
		W.TeamTraining = R.Str(Root, TEXT("teamTraining"), TEXT("ausgeglichen"));
		W.TrainingIntensity = R.Str(Root, TEXT("trainingIntensity"), TEXT("normal"));
		W.bBusTravel = R.Bool(Root, TEXT("busTravel"), false);
		W.bBusSponsor = R.Bool(Root, TEXT("busSponsor"), false);
		W.bBusBanden = R.Bool(Root, TEXT("busBanden"), false);
		W.bFitnessGuru = R.Bool(Root, TEXT("fitnessGuru"), false);
		W.bTactician = R.Bool(Root, TEXT("tactician"), false);
		W.LicenseLevel = FMath::Clamp((int32)R.Int(Root, TEXT("license"), 0), 0, 3);
		W.Stress = FMath::Clamp((int32)R.Int(Root, TEXT("stress"), 15), 0, 100);
		W.CampusTrainingGround = FMath::Clamp((int32)R.Int(Root, TEXT("campusTrainingGround"), 0), 0, 5);
		W.TackleHardness = R.Str(Root, TEXT("tackleHardness"), TEXT("normal"));
		W.CaptainId = (int32)R.Int(Root, TEXT("captain"), 0);
		W.YouthCoachId = (int32)R.Int(Root, TEXT("youthCoachId"), 0);
		W.YouthCoachCount = (int32)R.Int(Root, TEXT("youthCoachCount"), 0);
		W.RngJugend.Initialize((int32)R.Int(Root, TEXT("rngJugendSeed"), 1));
		W.RngTransfer.Initialize((int32)R.Int(Root, TEXT("rngTransferSeed"), 1));
		W.Poker.bActive = R.Int(Root, TEXT("pokerActive"), 0) != 0;
		W.Poker.PlayerId = (int32)R.Int(Root, TEXT("pokerPlayer"), 0);
		W.Poker.Offer = R.Int(Root, TEXT("pokerOffer"), 0);
		W.Poker.Rounds = (int32)R.Int(Root, TEXT("pokerRounds"), 0);
		W.Poker.Patience = (int32)R.Int(Root, TEXT("pokerPatience"), 0);
		W.Poker.RivalChance = R.Real(Root, TEXT("pokerRivalChance"), 0.15);
		W.Poker.bRival = R.Bool(Root, TEXT("pokerRival"), false);
		W.Poker.RivalClub = R.Str(Root, TEXT("pokerRivalClub"), TEXT(""));
		W.Poker.RivalBid = R.Int(Root, TEXT("pokerRivalBid"), 0);
		W.Poker.AgreedFee = R.Int(Root, TEXT("pokerAgreed"), 0);
		W.Poker.WageDemand = R.Int(Root, TEXT("pokerWage"), 0);
		W.Poker.bWageTalked = R.Bool(Root, TEXT("pokerWageTalked"), false);
		for (int32 N : R.Items(Root, TEXT("pokerLog"))) W.Poker.Log.Add(P.Nodes[N].Text);
		W.Anliegen.bAktiv = R.Bool(Root, TEXT("ratAktiv"), false);
		W.Anliegen.Typ = R.Str(Root, TEXT("ratTyp"), TEXT(""));
		W.Anliegen.Titel = R.Str(Root, TEXT("ratTitel"), TEXT(""));
		W.Anliegen.Text = R.Str(Root, TEXT("ratText"), TEXT(""));
		W.Anliegen.Kosten = R.Int(Root, TEXT("ratKosten"), 0);
		W.Anliegen.Spieler = (int32)R.Int(Root, TEXT("ratSpieler"), 0);
		W.Anliegen.Wortfuehrer = (int32)R.Int(Root, TEXT("ratWortfuehrer"), 0);
		W.Anliegen.Kapitaen = (int32)R.Int(Root, TEXT("ratKapitaen"), 0);
		W.Anliegen.Nachfolger = (int32)R.Int(Root, TEXT("ratNachfolger"), 0);
		W.Anliegen.Clique = (int32)R.Int(Root, TEXT("ratClique"), -1);
		W.Anliegen.Saison = (int32)R.Int(Root, TEXT("ratSaison"), 0);
		W.Anliegen.Spieltag = (int32)R.Int(Root, TEXT("ratSpieltag"), 0);
		for (int32 N : R.Items(Root, TEXT("ratVerlauf"))) W.RatVerlauf.Add(P.Nodes[N].Text);
		for (int32 N : R.Items(Root, TEXT("ownSeasonGoals"))) W.OwnSeasonGoals.Add((int32)P.Nodes[N].Number);
		for (int32 N : R.Items(Root, TEXT("council"))) W.CouncilIds.Add((int32)P.Nodes[N].Number);
		W.PromotionBoostLevel = (int32)R.Int(Root, TEXT("promotionBoostLevel"), -1);
		W.PromotionBoostSeason = (int32)R.Int(Root, TEXT("promotionBoostSeason"), 0);
		W.CampusReha = FMath::Clamp((int32)R.Int(Root, TEXT("campusReha"), 0), 0, 5);
		W.WageBudgetCap = R.Int(Root, TEXT("wageBudgetCap"), 0);
		W.LastMeetingSeason = (int32)R.Int(Root, TEXT("lastMeetingSeason"), 0);
		W.PoachSlot = (int32)R.Int(Root, TEXT("poachSlot"), -1);
		W.PoachRetention = R.Int(Root, TEXT("poachRetention"), 0);
		for (int32 N : R.Items(Root, TEXT("weeklyPlan"))) W.WeeklyPlan.Add(P.Nodes[N].Text);
		if (W.WeeklyPlan.Num() != 7) W.WeeklyPlan = FM13Fitness::Startplan();
		{
			const TArray<int32> Paare = R.Items(Root, TEXT("pairChemistry"));
			for (int32 k = 0; k + 2 < Paare.Num(); k += 3)
			{
				W.PairA.Add((int32)P.Nodes[Paare[k]].Number);
				W.PairB.Add((int32)P.Nodes[Paare[k + 1]].Number);
				W.PairValue.Add(FMath::Clamp((int32)P.Nodes[Paare[k + 2]].Number, 0, 30));
			}
		}
		FFM13Staff* Personal[6] = { &W.AthletikTrainer, &W.Ernaehrungsberater, &W.Physio, &W.Greenkeeper, &W.CoTrainer, &W.Analyst };
		const TCHAR* PersonalKeys[6] = { TEXT("athletik"), TEXT("ernaehrung"), TEXT("physio"), TEXT("greenkeeper"), TEXT("coTrainer"), TEXT("analyst") };
		const TCHAR* StaffSchluessel[6] = { TEXT("fitCoach"), TEXT("nutritionist"), TEXT("physio"), TEXT("greenkeeper"), TEXT("coTrainer"), TEXT("analyst") };
		for (int32 i = 0; i < 6; ++i)
		{
			Personal[i]->Morale = FMath::Clamp(R.Real(Root, *(FString(PersonalKeys[i]) + TEXT("Morale")), 80.0), 0.0, 100.0);
			Personal[i]->Wage = R.Int(Root, *(FString(PersonalKeys[i]) + TEXT("Wage")), FM13Staff::GehaltFuer(StaffSchluessel[i]));
			Personal[i]->Contract = (int32)R.Int(Root, *(FString(PersonalKeys[i]) + TEXT("Contract")), 34);
			Personal[i]->HiredSeason = (int32)R.Int(Root, *(FString(PersonalKeys[i]) + TEXT("HiredSeason")), 0);
			Personal[i]->OnLeave = (int32)R.Int(Root, *(FString(PersonalKeys[i]) + TEXT("OnLeave")), 0);
			Personal[i]->bInterim = R.Bool(Root, *(FString(PersonalKeys[i]) + TEXT("Interim")), false);
			Personal[i]->UpgradeDays = (int32)R.Int(Root, *(FString(PersonalKeys[i]) + TEXT("UpgradeDays")), 0);
			Personal[i]->bHired = R.Bool(Root, *(FString(PersonalKeys[i]) + TEXT("Hired")), false);
			Personal[i]->Level = FMath::Clamp((int32)R.Int(Root, *(FString(PersonalKeys[i]) + TEXT("Level")), 1), 1, 3);
			Personal[i]->Task = R.Str(Root, *(FString(PersonalKeys[i]) + TEXT("Task")), TEXT(""));
		}
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
		for (int32 N : R.Items(Root, TEXT("manualLineup"))) W.ManualLineup.Add((int32)P.Nodes[N].Number);
		for (int32 N : R.Items(Root, TEXT("manualBench"))) W.ManualBench.Add((int32)P.Nodes[N].Number);
		W.PendingTalk = R.Str(Root, TEXT("pendingTalk"), TEXT(""));
		for (int32 N : R.Items(Root, TEXT("talkHistory"))) W.TalkHistory.Add(P.Nodes[N].Text);
		W.PrepArchetype = (TCHAR)R.Int(Root, TEXT("prepArch"), 0);
		W.PrepMatchday = (int32)R.Int(Root, TEXT("prepMatchday"), 0);
		W.RivalName = R.Str(Root, TEXT("rival"), TEXT(""));
		for (int32 N : R.Items(Root, TEXT("derbyPreps"))) W.DerbyPreps.Add(P.Nodes[N].Text);
		W.DerbyPrepMatchday = (int32)R.Int(Root, TEXT("derbyPrepMatchday"), 0);
		W.bEuropeNextSeason = R.Bool(Root, TEXT("europeNext"), false);
		W.EuropePot = (int32)R.Int(Root, TEXT("europePot"), 2);
		for (int32 N : R.Items(Root, TEXT("awards"))) W.AwardHistory.Add(P.Nodes[N].Text);
		const int32 Eu = R.Find(Root, TEXT("europe"));
		W.Europe.bActive = R.Bool(Eu, TEXT("active"), false);
		W.Europe.GroupRound = (int32)R.Int(Eu, TEXT("round"), 0);
		W.Europe.Winner = R.Str(Eu, TEXT("winner"), TEXT(""));
		W.Europe.OwnStage = R.Str(Eu, TEXT("stage"), TEXT(""));
		for (int32 N : R.Items(Eu, TEXT("last"))) W.Europe.LastResults.Add(P.Nodes[N].Text);
		for (int32 G = 0; G < 2; ++G)
			for (int32 N : R.Items(Eu, G == 0 ? TEXT("groupA") : TEXT("groupB")))
			{
				FFM13EuroTeam T;
				T.Name = R.Str(N, TEXT("name"), TEXT("?")); T.Strength = (int32)R.Int(N, TEXT("str"), 80); T.Played = (int32)R.Int(N, TEXT("p"), 0);
				T.Won = (int32)R.Int(N, TEXT("w"), 0); T.Drawn = (int32)R.Int(N, TEXT("d"), 0); T.Lost = (int32)R.Int(N, TEXT("l"), 0);
				T.GoalsFor = (int32)R.Int(N, TEXT("gf"), 0); T.GoalsAgainst = (int32)R.Int(N, TEXT("ga"), 0);
				W.Europe.Groups[G].Add(T);
			}
		for (int32 N : R.Items(Eu, TEXT("semis"))) W.Europe.Semis.Add(ReadEuroTie(R, N));
		const int32 Fi = R.Find(Eu, TEXT("final"));
		if (Fi >= 0) W.Europe.Final = ReadEuroTie(R, Fi);
		W.DfbPokal = FM13CupRules::MakeDfbPokal();
		W.Landespokal = FM13CupRules::MakeLandespokal();
		// Ältere Stände ohne Pokal: Wettbewerbe dieser Saison gelten als beendet (ab der nächsten Saison normal)
		if (!ReadCup(R, P.Nodes, Root, TEXT("dfbPokal"), W.DfbPokal)) W.DfbPokal.Round = W.DfbPokal.RoundMatchdays.Num();
		if (!ReadCup(R, P.Nodes, Root, TEXT("landespokal"), W.Landespokal)) W.Landespokal.Round = W.Landespokal.RoundMatchdays.Num();

		for (int32 N : R.Items(Root, TEXT("squad"))) W.Squad.Add(ReadPlayer(R, N));
		for (int32 N : R.Items(Root, TEXT("youth"))) W.YouthTalents.Add(ReadPlayer(R, N));
		for (int32 N : R.Items(Root, TEXT("youthLoans")))
		{
			FFM13World::FFM13YouthLoan L;
			L.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			L.Club = R.Str(N, TEXT("club"), TEXT(""));
			L.ClubLevel = (int32)R.Int(N, TEXT("clubLevel"), 0);
			L.ClubStrength = (int32)R.Int(N, TEXT("clubStrength"), 50);
			L.Duration = (int32)R.Int(N, TEXT("duration"), 0);
			L.OriginalStrength = (int32)R.Int(N, TEXT("originalStrength"), 0);
			L.Apps = (int32)R.Int(N, TEXT("apps"), 0);
			L.Goals = (int32)R.Int(N, TEXT("goals"), 0);
			L.DevProgress = R.Real(N, TEXT("devProgress"), 0.0);
			W.YouthLoans.Add(L);
		}
		W.TransferBudget = R.Int(Root, TEXT("transferBudget"), 0);
		W.bWinterWindowActive = R.Bool(Root, TEXT("winterActive"), false);
		W.bWinterWindowUsed = R.Bool(Root, TEXT("winterUsed"), false);
		W.WinterWindowCloseMatchday = (int32)R.Int(Root, TEXT("winterClose"), 0);
		W.bStrategySet = R.Bool(Root, TEXT("strategySet"), false);
		W.Strategy.Season = (int32)R.Int(Root, TEXT("strategySeason"), 0);
		W.Strategy.Choice = (FM13Transfers::EStrategie)R.Int(Root, TEXT("strategyChoice"), 3);
		W.Strategy.bAuto = R.Bool(Root, TEXT("strategyAuto"), false);
		W.Strategy.OldGoal = (int32)R.Int(Root, TEXT("strategyOldGoal"), 0);
		W.Strategy.Goal = (int32)R.Int(Root, TEXT("strategyGoal"), 0);
		W.Strategy.BudgetDelta = R.Int(Root, TEXT("strategyDelta"), 0);
		W.Strategy.Result = (int32)R.Int(Root, TEXT("strategyResult"), 0);
		W.RumorNr = (int32)R.Int(Root, TEXT("rumorNr"), 0);
		W.RumorHits[0] = (int32)R.Int(Root, TEXT("rumorHit0"), 0);
		W.RumorHits[1] = (int32)R.Int(Root, TEXT("rumorHit1"), 0);
		W.RumorHits[2] = (int32)R.Int(Root, TEXT("rumorHit2"), 0);
		W.RumorMisses[0] = (int32)R.Int(Root, TEXT("rumorMiss0"), 0);
		W.RumorMisses[1] = (int32)R.Int(Root, TEXT("rumorMiss1"), 0);
		W.RumorMisses[2] = (int32)R.Int(Root, TEXT("rumorMiss2"), 0);
		for (int32 N : R.Items(Root, TEXT("rumors")))
		{
			FFM13World::FFM13Rumor G;
			G.Id = R.Str(N, TEXT("id"), TEXT(""));
			G.Source = (FM13Transfers::EQuelle)R.Int(N, TEXT("source"), 0);
			G.bTruth = R.Bool(N, TEXT("truth"), false);
			G.Club = R.Str(N, TEXT("club"), TEXT(""));
			G.Type = R.Str(N, TEXT("type"), TEXT(""));
			G.PlayerId = (int32)R.Int(N, TEXT("playerId"), 0);
			G.PlayerName = R.Str(N, TEXT("playerName"), TEXT(""));
			G.Created = (int32)R.Int(N, TEXT("created"), 0);
			G.Season = (int32)R.Int(N, TEXT("season"), 0);
			G.ResolveAt = (int32)R.Int(N, TEXT("resolveAt"), 0);
			G.Reaction = R.Str(N, TEXT("reaction"), TEXT(""));
			G.bBackedOff = R.Bool(N, TEXT("backedOff"), false);
			G.Outcome = R.Str(N, TEXT("outcome"), TEXT(""));
			W.Rumors.Add(G);
		}
		W.PreContractPoolSeason = (int32)R.Int(Root, TEXT("preContractPoolSeason"), 0);
		W.FreeNegotiation.PlayerId = (int32)R.Int(Root, TEXT("freeNegPlayer"), 0);
		W.FreeNegotiation.CounterFee = R.Int(Root, TEXT("freeNegFee"), 0);
		W.Poker.SwapId = (int32)R.Int(Root, TEXT("swapId"), 0);
		for (int32 N : R.Items(Root, TEXT("agentRelations")))
		{
			W.AgentRelationKeys.Add((int32)R.Int(N, TEXT("agent"), 0));
			W.AgentRelationVals.Add((int32)R.Int(N, TEXT("level"), 0));
		}
		for (int32 N : R.Items(Root, TEXT("freeAgents")))
		{
			FFM13World::FFM13FreeAgent F;
			F.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			F.SignOnFee = R.Int(N, TEXT("signOnFee"), 0);
			W.FreeAgents.Add(F);
		}
		W.LastDeadlineKey = R.Str(Root, TEXT("lastDeadlineKey"), TEXT(""));
		for (int32 N : R.Items(Root, TEXT("aiNews")))
		{
			FFM13World::FFM13AiNews A;
			A.Season = (int32)R.Int(N, TEXT("season"), 0);
			A.Matchday = (int32)R.Int(N, TEXT("matchday"), 0);
			A.Player = R.Str(N, TEXT("player"), TEXT(""));
			A.Pos = (EFM13Position)FMath::Clamp((int32)R.Int(N, TEXT("pos"), 3), 0, 3);
			A.Strength = (int32)R.Int(N, TEXT("strength"), 0);
			A.From = R.Str(N, TEXT("from"), TEXT(""));
			A.To = R.Str(N, TEXT("to"), TEXT(""));
			A.Fee = R.Int(N, TEXT("fee"), 0);
			A.bRetired = R.Bool(N, TEXT("retired"), false);
			A.FromLeague = (int32)R.Int(N, TEXT("fromLeague"), 0);
			A.ToLeague = (int32)R.Int(N, TEXT("toLeague"), 0);
			W.AiNews.Add(A);
		}
		for (int32 N : R.Items(Root, TEXT("loanables")))
		{
			FFM13Loanable L;
			L.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			L.ParentClub = R.Str(N, TEXT("parentClub"), TEXT(""));
			L.LoanFee = R.Int(N, TEXT("loanFee"), 0);
			L.BuyOptionFee = R.Int(N, TEXT("buyOptionFee"), 0);
			L.DurationMatchdays = (int32)R.Int(N, TEXT("duration"), 34);
			W.Loanables.Add(L);
		}
		for (int32 N : R.Items(Root, TEXT("incomingLoans")))
		{
			FFM13IncomingLoan L;
			L.PlayerId = (int32)R.Int(N, TEXT("playerId"), 0);
			L.ParentClub = R.Str(N, TEXT("parentClub"), TEXT(""));
			L.MatchdaysLeft = (int32)R.Int(N, TEXT("matchdaysLeft"), 0);
			L.BuyOptionFee = R.Int(N, TEXT("buyOptionFee"), 0);
			W.IncomingLoans.Add(L);
		}
		for (int32 N : R.Items(Root, TEXT("preContractPool")))
		{
			FFM13World::FFM13PreContractCandidate C;
			C.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			C.SellerClub = R.Str(N, TEXT("sellerClub"), TEXT(""));
			C.bRefused = R.Bool(N, TEXT("refused"), false);
			W.PreContractPool.Add(C);
		}
		for (int32 N : R.Items(Root, TEXT("preContracts")))
		{
			FFM13World::FFM13PreContractDeal D;
			D.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			D.From = R.Str(N, TEXT("from"), TEXT(""));
			D.Season = (int32)R.Int(N, TEXT("season"), 0);
			W.PreContracts.Add(D);
		}
		for (int32 N : R.Items(Root, TEXT("buybackOptions")))
		{
			FFM13BuybackOption O;
			O.Player = ReadPlayer(R, R.Find(N, TEXT("player")));
			O.Club = R.Str(N, TEXT("club"), TEXT(""));
			O.Price = R.Int(N, TEXT("price"), 0);
			O.UntilSeason = (int32)R.Int(N, TEXT("untilSeason"), 0);
			O.SaleStrength = (int32)R.Int(N, TEXT("saleStrength"), 0);
			O.Season = (int32)R.Int(N, TEXT("season"), 0);
			W.BuybackOptions.Add(O);
		}
		for (int32 N : R.Items(Root, TEXT("youthMoments"))) W.YouthMoments.Add(P.Nodes[N].Text);
		for (int32 N : R.Items(Root, TEXT("market")))
		{
			FFM13MarketOffer O;
			O.Price = R.Int(N, TEXT("price"), 0);
			O.SellerClub = R.Str(N, TEXT("sellerClub"), TEXT(""));
			O.SellerMinimum = R.Int(N, TEXT("sellerMinimum"), 0);
			O.AskingPrice = R.Int(N, TEXT("askingPrice"), 0);
			O.bPokerBroken = R.Bool(N, TEXT("pokerBroken"), false);
			O.Medical.Issue = (EFM13Medical)R.Int(N, TEXT("medIssue"), 0);
			O.Medical.Injuries = (int32)R.Int(N, TEXT("medInjuries"), 0);
			O.Medical.Weeks = (int32)R.Int(N, TEXT("medWeeks"), 0);
			O.Medical.bChecked = R.Bool(N, TEXT("medChecked"), false);
			O.bMedicalRolled = R.Bool(N, TEXT("medRolled"), false);
			O.bDeadlineBargain = R.Bool(N, TEXT("bargain"), false);
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
				Club.bHasStar = R.Bool(C, TEXT("hasStar"), false);
				Club.StarPos = (EFM13Position)FMath::Clamp((int32)R.Int(C, TEXT("starPos"), 3), 0, 3);
				Club.StarName = R.Str(C, TEXT("starName"), TEXT(""));
				Club.StarStrength = (int32)R.Int(C, TEXT("starStrength"), 0);
				Club.StarAge = (int32)R.Int(C, TEXT("starAge"), 0);
				Club.StarGoals = (int32)R.Int(C, TEXT("starGoals"), 0);
				Club.bHasStriker = R.Bool(C, TEXT("hasStriker"), false);
				Club.StrikerName = R.Str(C, TEXT("strikerName"), TEXT(""));
				Club.StrikerGoals = (int32)R.Int(C, TEXT("strikerGoals"), 0);
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
