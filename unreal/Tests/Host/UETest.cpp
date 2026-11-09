// Bedient die UE-Schicht (Game/) gegen die Engine-Nachbildung wie ein Spieler: Tasten, Seiten, Speichern.
#include "UEMock/UEMock.h"
#include "Game/FM13GameInstance.h"
#include "Game/FM13PlayerController.h"
#include "Game/FM13HUD.h"
#include "Game/FM13GameMode.h"

// SetupInputComponent ist geschützt; im Test über eine Ableitung erreichbar
struct FTestController : AFM13PlayerController { using AFM13PlayerController::SetupInputComponent; using AFM13PlayerController::BeginPlay; using AFM13PlayerController::EndPlay; };

static int GOk = 0, GFail = 0;
#define PRUEFE(Bed, ...) do { if (Bed) ++GOk; else { ++GFail; std::printf("  FEHLER %s:%d: ", __FILE__, __LINE__); std::printf(__VA_ARGS__); std::printf("\n"); } } while (0)

int main()
{
	if (std::system("rm -rf /tmp/fm13-uemock") != 0) std::printf("Aufraeumen fehlgeschlagen\n");
	UEngine Engine; GEngine = &Engine;
	UFM13GameInstance GI;
	GI.Init();
	PRUEFE(GI.GetStatus().LeagueLevel == 5 && GI.GetSquad().Num() == 18, "Init startet eine neue Karriere");

	AFM13GameMode Mode;
	PRUEFE(Mode.HUDClass.C == AFM13HUD::StaticClass() && Mode.PlayerControllerClass.C == AFM13PlayerController::StaticClass(), "GameMode setzt HUD und Controller");

	FTestController PC;
	PC.GI = &GI;
	UInputComponent Input;
	PC.InputComponent = &Input;
	PC.SetupInputComponent();
	PRUEFE(Input.Bindings.size() == 23, "23 Tasten gebunden (%d)", (int)Input.Bindings.size());
	PC.BeginPlay();
	PRUEFE(GI.OnStateChanged.Liste.size() == 1, "Controller hoert auf Aenderungen");

	UCanvas Canvas;
	AFM13HUD HUD;
	HUD.GI = &GI;
	HUD.Owner = &PC;
	HUD.Canvas = &Canvas;
	auto Taste = [&](const char* K) { Input.Bindings[K](); };
	auto Zeichne = [&]() { HUD.TextCalls = 0; HUD.DrawHUD(); return HUD.TextCalls; };

	// Menü ist Standard: das HUD zeichnet dann nichts, F1 schaltet auf die Textansicht
	PRUEFE(Zeichne() == 0, "Im Menue-Modus zeichnet das HUD nichts");
	Taste("F1");
	PRUEFE(PC.bTextMode && Zeichne() > 3, "F1 zeigt die Textansicht");

	// Alle Seiten zeichnen etwas
	const char* Seiten[] = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "0" };
	for (const char* S : Seiten) { Taste(S); PRUEFE(Zeichne() > 3, "Seite %s zeichnet", S); }

	// Eine ganze Saison per Leertaste, dazu Aktionen auf den Seiten
	Taste("4"); Taste("Down"); Taste("Enter");      // Kaufversuch
	Taste("3"); Taste("Down"); Taste("Enter");      // Verlängerungsversuch
	const int32 Preis = GI.GetStatus().TicketPrice;
	Taste("8"); Taste("Right"); Taste("Right"); Taste("Left"); // Ticketpreis +1
	PRUEFE(GI.GetStatus().TicketPrice == Preis + 1, "Ticketpreis per Pfeil (%d statt %d)", GI.GetStatus().TicketPrice, Preis + 1);
	Taste("1"); Taste("Right");
	PRUEFE(GI.GetStatus().TicketPrice == Preis + 1 && PC.StatusLine.Contains("Verein (8)"), "Pfeil ausserhalb der Vereinsseite erklaert sich");
	Taste("1");
	for (int i = 0; i < 34; ++i) { Taste("Space"); Zeichne(); }
	PRUEFE(GI.GetStatus().bSeasonFinished, "Nach 34 Leertasten ist die Saison vorbei");
	Taste("9"); PRUEFE(Zeichne() > 10, "Ticker-Seite zeigt das letzte Spiel");
	Taste("0"); PRUEFE(Zeichne() > 5, "Pokal-Seite");
	Taste("Space");
	PRUEFE(GI.GetStatus().Season == 2 && GI.GetStatus().Matchday == 1, "Leertaste schliesst die Saison ab");
	PRUEFE(PC.StatusLine.Contains("Saison 1"), "Saisonbilanz als Meldung (%s)", *PC.StatusLine);

	// Speichern, weiterspielen, laden: zurück zum gespeicherten Stand
	Taste("F5");
	PRUEFE(PC.StatusLine.Contains("Gespeichert"), "F5 speichert (%s)", *PC.StatusLine);
	const int64 Geld = GI.GetStatus().Money;
	for (int i = 0; i < 5; ++i) Taste("Space");
	Taste("F9");
	PRUEFE(GI.GetStatus().Money == Geld && GI.GetStatus().Matchday == 1, "F9 laedt den Stand");
	// Autosave nach jedem Spieltag
	PRUEFE(GI.HasSaveGame("autosave"), "Autosave existiert");
	UFM13GameInstance Neu;
	Neu.Init();
	PRUEFE(Neu.GetStatus().Season == GI.GetStatus().Season, "Neustart laedt den Autosave");

	// Kaputte Datei: Laden scheitert sauber, Sicherung (.bak) wird genutzt
	FString Fehler;
	FFileHelper::SaveStringToFile("{kaputt", "/tmp/fm13-uemock//SaveGames/spielstand1.json");
	const bool bGeladen = GI.LoadGame("spielstand1", Fehler);
	PRUEFE(!bGeladen || Fehler.Contains("Sicherung"), "Kaputter Stand: Fehler oder Sicherung (%s)", *Fehler);

	// Import: ohne Datei eine Erklärung, mit Datei im (falschen) Downloads-Ordner der neueste Stand
	setenv("USERPROFILE", "/tmp/fm13-uemock/profil", 1);
	setenv("HOME", "/tmp/fm13-uemock/profil", 1);
	Taste("F8");
	PRUEFE(PC.StatusLine.Contains("Keine exportierte Datei"), "F8 ohne Datei erklaert sich (%s)", *PC.StatusLine);
	if (std::system("mkdir -p /tmp/fm13-uemock/profil/Downloads && cp ../../../tests/fixtures/saves/v3.103.json /tmp/fm13-uemock/profil/Downloads/anstoss-fm13-Alt-S1-SpT1.json && sleep 1 && cp ../../../tests/fixtures/saves/karriere-liga4-v3.104-s3.json /tmp/fm13-uemock/profil/Downloads/anstoss-fm13-Neu-S4-SpT1.json") != 0) std::printf("Kopieren fehlgeschlagen\n");
	Taste("F8");
	PRUEFE(PC.StatusLine.Contains("Uebernommen") && GI.GetStatus().Season == 4 && GI.GetStatus().LeagueLevel == 2, "F8 uebernimmt den neuesten Browser-Spielstand (%s)", *PC.StatusLine);
	PRUEFE(GI.HasSaveGame("vor-import"), "Vorheriger Stand als vor-import gesichert");
	PRUEFE(GI.GetYouth().Num() == 10 && GI.GetSquad().Num() == 21, "Kader und Talente uebernommen");
	Taste("Space");
	PRUEFE(GI.GetStatus().Matchday == 2, "Importierter Stand spielt weiter");

	// Taktik, Sponsor, Angebote, Erfolge über die GameInstance
	{
		FString Grund;
		const FFM13TacticsView T0 = GI.GetTactics();
		PRUEFE(T0.Formations.Num() == 8 && T0.StyleKeys.Num() == 8, "Taktik-Ansicht mit 8 Formationen und 8 Stilen");
		PRUEFE(GI.SetFormation("5-4-1", Grund) && GI.GetTactics().Formation == FString("5-4-1"), "Formation ueber die GameInstance");
		PRUEFE(GI.SetTacticStyle("pressing", Grund) && GI.GetTactics().StyleBonus == 2, "Spielstil ueber die GameInstance");
		PRUEFE(!GI.SetTacticStyle("tiki", Grund) && !Grund.IsEmpty(), "Unbekannter Stil erklaert sich");
		PRUEFE(GI.GetAchievements().Num() == 13, "13 Erfolge in der Ansicht");
		PRUEFE(!GI.GetSponsor().Name.IsEmpty(), "Sponsor in der Ansicht");
		Taste("T");
		PRUEFE(PC.Page == EFM13Page::Taktik, "Taste T oeffnet die Taktik");
	}

	// Neue Karriere
	Taste("F2");
	PRUEFE(GI.GetStatus().Season == 1 && GI.GetStatus().Matchday == 1, "F2 startet neu");
	PRUEFE(UFM13GameInstance::FormatMoney(1234567) == FString("1.234.567 €"), "Geldformat (%s)", *UFM13GameInstance::FormatMoney(1234567));
	PRUEFE(UFM13GameInstance::FormatMoney(-500) == FString("-500 €"), "Negatives Geld");

	PC.EndPlay(EEndPlayReason::Destroyed);
	PRUEFE(GI.OnStateChanged.Liste.empty(), "EndPlay meldet den Controller ab");
	std::printf("UE-Schicht gegen Nachbildung: %d bestanden, %d fehlgeschlagen\n", GOk, GFail);
	return GFail ? 1 : 0;
}
