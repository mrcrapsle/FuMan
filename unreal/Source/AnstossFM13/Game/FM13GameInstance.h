#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "FM13Core/FM13World.h"
#include "FM13ViewTypes.h"
#include "FM13GameInstance.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FFM13StateChanged);

// Hält den Spielzustand über Levelwechsel hinweg und ist die einzige Schnittstelle der Oberfläche
// (HUD, UMG-Widgets, Blueprints) zum Spielkern. Jede Aktion meldet per OutReason, warum sie nicht ging
// ("keine stillen Knöpfe" wie im Browserspiel).
UCLASS()
class ANSTOSSFM13_API UFM13GameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	virtual void Init() override;

	// Wird nach jeder Änderung ausgelöst; Widgets zeichnen sich daraufhin neu
	UPROPERTY(BlueprintAssignable, Category = "FM13")
	FFM13StateChanged OnStateChanged;

	// Nach jedem Spieltag automatisch speichern (Spielstand "autosave")
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FM13")
	bool bAutosave = true;

	// ---------- Ablauf ----------
	UFUNCTION(BlueprintCallable, Category = "FM13")
	void NewGame(const FString& ClubName, int32 Seed = 0);

	UFUNCTION(BlueprintCallable, Category = "FM13")
	bool PlayMatchday(FString& OutReason);

	// Saisonende; OutSummary ist ein kurzer Text für die Anzeige
	UFUNCTION(BlueprintCallable, Category = "FM13")
	bool ConcludeSeason(FString& OutSummary);

	// ---------- Ansichten ----------
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13StatusView GetStatus() const;
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13MatchReportView GetLastReport() const;
	// Eigenes Pokalspiel des letzten Spieltags (bPlayed = false, wenn keins)
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13MatchReportView GetLastCupReport() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13CupView> GetCups() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13PlayerView> GetSquad() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13PlayerView> GetYouth() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13OfferView> GetMarket() const;
	// Level -1 = eigene Liga
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13TableRowView> GetTable(int32 Level = -1) const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13FixtureView> GetOwnFixtures() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13BookingView> GetBookings(int32 MaxCount = 30) const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13MessageView> GetMessages(int32 MaxCount = 30) const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13SeasonRecordView> GetHistory() const;
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13TacticsView GetTactics() const;
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13SponsorView GetSponsor() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13SponsorView> GetSponsorOffers() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13IncomingOfferView> GetIncomingOffers() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13AchievementView> GetAchievements() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13LegendView> GetLegends() const;
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13RecordsView GetRecords() const;
	UFUNCTION(BlueprintPure, Category = "FM13") FFM13EuropeView GetEurope() const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FString> GetAwards() const;
	// Mode 0 = gesamt, 1 = nur Heimspiele, 2 = nur Auswärtsspiele (aus dem Spielplan berechnet)
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FFM13TableRowView> GetTableSplit(int32 Level, int32 Mode) const;
	UFUNCTION(BlueprintPure, Category = "FM13") TArray<FString> GetLeagueStats(int32 Level) const;
	UFUNCTION(BlueprintPure, Category = "FM13") static FString FormatMoney(int64 Amount);

	// ---------- Aktionen ----------
	UFUNCTION(BlueprintCallable, Category = "FM13") bool BuyPlayer(int32 MarketIndex, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool SellPlayer(int32 PlayerId, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool RenewContract(int32 PlayerId, int32 Years, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool PromoteYouth(int32 YouthIndex, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool ReleaseYouth(int32 YouthIndex, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool SetTicketPrice(int32 Price, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool ExpandStadium(int32 Seats, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool UpgradeYouthAcademy(FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool UpgradeTraining(FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool SetFormation(const FString& Formation, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool SetTacticStyle(const FString& Style, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool AcceptSponsorOffer(int32 Index, FString& OutReason);
	// Index in GetIncomingOffers()
	UFUNCTION(BlueprintCallable, Category = "FM13") bool AcceptIncomingOffer(int32 Index, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool DeclineIncomingOffer(int32 Index, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool ToggleLineupPlayer(int32 PlayerId, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") void AutoLineup();
	UFUNCTION(BlueprintCallable, Category = "FM13") bool ChooseTalk(const FString& Type, FString& OutReason);
	// Archetype: "P" (Pressing), "B" (Ballbesitz), "K" (Konter)
	UFUNCTION(BlueprintCallable, Category = "FM13") bool SetMatchPrep(const FString& Archetype, FString& OutReason);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool BookDerbyPrep(const FString& Type, FString& OutReason);

	// ---------- Spielstand ----------
	// Schreibt erst eine Zwischendatei, liest sie zurück und prüft sie, erst dann ersetzt sie den alten
	// Stand (wie writeSaveVerified). Der vorige Stand bleibt als .bak erhalten.
	UFUNCTION(BlueprintCallable, Category = "FM13") bool SaveGame(const FString& Slot, FString& OutError);
	// Lädt nur einen geprüften Stand (wie loadSaveSafely); bei einem Fehler bleibt das laufende Spiel
	UFUNCTION(BlueprintCallable, Category = "FM13") bool LoadGame(const FString& Slot, FString& OutError);
	UFUNCTION(BlueprintPure, Category = "FM13") bool HasSaveGame(const FString& Slot) const;

	// ---------- Import aus dem Browserspiel ----------
	// Sucht die neueste exportierte Datei (anstoss-fm13-*.json) in Downloads und in Saved/Import
	// und übernimmt sie. Der bisherige Stand bleibt als Spielstand "vor-import" erhalten.
	UFUNCTION(BlueprintCallable, Category = "FM13") bool ImportBrowserSave(FString& OutMessage);
	UFUNCTION(BlueprintCallable, Category = "FM13") bool ImportBrowserSaveFile(const FString& Path, FString& OutMessage);
	UFUNCTION(BlueprintPure, Category = "FM13") static TArray<FString> FindBrowserExports();

	const FFM13World& GetWorldState() const { return Kern; }

private:
	FFM13World Kern;

	static FString SlotPath(const FString& Slot);
	static FFM13PlayerView MakePlayerView(const FFM13Player& P, bool bInEleven);
	static FFM13MatchReportView MakeReportView(const FFM13OwnMatchReport& R);
	static FFM13CupView MakeCupView(const FFM13Cup& C);
	void Changed();
};
