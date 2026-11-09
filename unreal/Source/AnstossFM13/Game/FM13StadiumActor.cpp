#include "FM13StadiumActor.h"
#include "FM13GameInstance.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"

namespace
{
	// Maße in cm (Unreal): Spielfeld 105 x 68 m, Grundformen sind 100 cm groß
	constexpr float FeldX = 10500.f;
	constexpr float FeldY = 6800.f;
	constexpr float Linie = 12.f;
	constexpr float Rand = 600.f;     // Abstand Seitenlinie bis Tribüne
	constexpr float Reihe = 120.f;    // Tiefe einer Tribünenreihe
	constexpr float Stufe = 70.f;     // Höhe einer Reihe

	const FLinearColor Rasen(0.05f, 0.30f, 0.07f);
	const FLinearColor RasenHell(0.07f, 0.38f, 0.09f);
	const FLinearColor Weiss(0.95f, 0.95f, 0.95f);
	const FLinearColor Beton(0.30f, 0.30f, 0.32f);
	const FLinearColor Sitz(0.12f, 0.14f, 0.20f);
	const FLinearColor Heim(0.80f, 0.08f, 0.08f);
	const FLinearColor Gast(0.10f, 0.25f, 0.85f);
	const FLinearColor Torwart(0.95f, 0.75f, 0.10f);
}

AFM13StadiumActor::AFM13StadiumActor()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AFM13StadiumActor::BeginPlay()
{
	Super::BeginPlay();
	Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	Cylinder = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	BaseMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (!Cube || !Cylinder || !Sphere)
	{
		UE_LOG(LogTemp, Warning, TEXT("FM13: Grundformen der Engine nicht gefunden, kein 3D-Stadion."));
		return;
	}
	SpawnLightsAndCamera();
	if (UFM13GameInstance* G = GetGameInstance<UFM13GameInstance>()) G->OnStateChanged.AddDynamic(this, &AFM13StadiumActor::HandleStateChanged);
	Rebuild();
}

void AFM13StadiumActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UFM13GameInstance* G = GetGameInstance<UFM13GameInstance>()) G->OnStateChanged.RemoveDynamic(this, &AFM13StadiumActor::HandleStateChanged);
	Super::EndPlay(EndPlayReason);
}

void AFM13StadiumActor::HandleStateChanged()
{
	Rebuild();
}

UStaticMeshComponent* AFM13StadiumActor::AddPart(UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color, bool bPlayer)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
	C->SetMobility(EComponentMobility::Movable);
	C->SetupAttachment(RootComponent);
	C->SetStaticMesh(Mesh);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->SetRelativeLocation(Location);
	C->SetRelativeScale3D(Scale);
	if (BaseMaterial)
	{
		UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(BaseMaterial, this);
		M->SetVectorParameterValue(TEXT("Color"), Color);
		C->SetMaterial(0, M);
	}
	C->RegisterComponent();
	if (bPlayer) Players.Add(C); else StadiumParts.Add(C);
	return C;
}

void AFM13StadiumActor::Rebuild()
{
	const UFM13GameInstance* G = GetGameInstance<UFM13GameInstance>();
	if (!G || !Cube) return;
	const FFM13StatusView S = G->GetStatus();
	const FFM13MatchReportView R = G->GetLastReport();
	// Auslastung des letzten Heimspiels in Prozent (vor dem ersten Heimspiel halb voll)
	const int32 Auslastung = (R.bPlayed && R.bHome && S.StadiumCapacity > 0) ? FMath::Clamp(R.Attendance * 100 / S.StadiumCapacity, 0, 100) : 50;
	if (S.StadiumCapacity == BuiltCapacity && Auslastung == BuiltOccupancy) return;
	BuiltCapacity = S.StadiumCapacity;
	BuiltOccupancy = Auslastung;

	for (UStaticMeshComponent* C : StadiumParts) if (C) C->DestroyComponent();
	StadiumParts.Reset();
	BuildPitch();
	BuildStands(S.StadiumCapacity, Auslastung / 100.f);
	if (!Players.Num()) BuildPlayers();
}

void AFM13StadiumActor::BuildPitch()
{
	// Boden rund ums Feld und Rasen mit Mähstreifen
	AddPart(Cube, FVector(0, 0, -60), FVector(FeldX / 100.f + 40.f, FeldY / 100.f + 40.f, 1.f), Beton);
	const int32 Streifen = 14;
	const float Breite = FeldX / Streifen;
	for (int32 i = 0; i < Streifen; ++i)
		AddPart(Cube, FVector(-FeldX / 2 + Breite * (i + 0.5f), 0, -5), FVector(Breite / 100.f, (FeldY + 800.f) / 100.f, 0.1f), i % 2 ? Rasen : RasenHell);

	auto Strich = [this](float X, float Y, float Lx, float Ly) { AddPart(Cube, FVector(X, Y, 1), FVector(Lx / 100.f, Ly / 100.f, 0.02f), Weiss); };
	// Außenlinien, Mittellinie
	Strich(0, -FeldY / 2, FeldX, Linie);
	Strich(0, FeldY / 2, FeldX, Linie);
	Strich(-FeldX / 2, 0, Linie, FeldY);
	Strich(FeldX / 2, 0, Linie, FeldY);
	Strich(0, 0, Linie, FeldY);
	// Mittelkreis aus kurzen Stücken (Radius 9,15 m)
	const int32 Stuecke = 32;
	for (int32 i = 0; i < Stuecke; ++i)
	{
		const float A = 2.f * PI * i / Stuecke;
		UStaticMeshComponent* C = AddPart(Cube, FVector(FMath::Cos(A) * 915.f, FMath::Sin(A) * 915.f, 1), FVector(1.9f, Linie / 100.f, 0.02f), Weiss);
		C->SetRelativeRotation(FRotator(0.f, FMath::RadiansToDegrees(A) + 90.f, 0.f));
	}
	// Strafräume (16,5 x 40,3 m) und Torräume (5,5 x 18,3 m) auf beiden Seiten, Tore 7,32 x 2,44 m
	for (const float Seite : { -1.f, 1.f })
	{
		const float Grund = Seite * FeldX / 2;
		Strich(Grund - Seite * 1650.f, 0, Linie, 4030.f);
		Strich(Grund - Seite * 825.f, -2015.f, 1650.f, Linie);
		Strich(Grund - Seite * 825.f, 2015.f, 1650.f, Linie);
		Strich(Grund - Seite * 550.f, 0, Linie, 1830.f);
		Strich(Grund - Seite * 275.f, -915.f, 550.f, Linie);
		Strich(Grund - Seite * 275.f, 915.f, 550.f, Linie);
		AddPart(Cylinder, FVector(Grund + Seite * 20.f, -366.f, 122.f), FVector(0.12f, 0.12f, 2.44f), Weiss);
		AddPart(Cylinder, FVector(Grund + Seite * 20.f, 366.f, 122.f), FVector(0.12f, 0.12f, 2.44f), Weiss);
		AddPart(Cube, FVector(Grund + Seite * 20.f, 0, 244.f), FVector(0.12f, 7.44f, 0.12f), Weiss);
		AddPart(Cube, FVector(Grund + Seite * 120.f, 0, 122.f), FVector(0.05f, 7.32f, 2.44f), FLinearColor(0.8f, 0.8f, 0.8f)); // Netz
	}
}

void AFM13StadiumActor::BuildStands(int32 Capacity, float Occupancy)
{
	// Reihen je Tribüne nach Stadiongröße: 4.000 Plätze ~ 3 Reihen, 80.000 ~ 22 Reihen
	const int32 Reihen = FMath::Clamp(FMath::RoundToInt(FMath::Sqrt((float)Capacity) / 13.f), 2, 24);
	const float Voll = FMath::Clamp(Occupancy, 0.f, 1.f);
	struct FSeite { FVector Richtung; float Laenge; };
	const FSeite Seiten[4] = {
		{ FVector(0, -1, 0), FeldX }, { FVector(0, 1, 0), FeldX },
		{ FVector(-1, 0, 0), FeldY }, { FVector(1, 0, 0), FeldY }
	};
	for (const FSeite& S : Seiten)
	{
		const bool bLang = FMath::Abs(S.Richtung.Y) > 0.5f;
		const float Abstand = (bLang ? FeldY : FeldX) / 2 + Rand;
		for (int32 r = 0; r < Reihen; ++r)
		{
			const FVector Mitte = S.Richtung * (Abstand + Reihe * (r + 0.5f)) + FVector(0, 0, Stufe * (r + 0.5f));
			const float Laenge = S.Laenge + 2.f * Reihe * r;
			const FVector Groesse = bLang ? FVector(Laenge / 100.f, Reihe / 100.f, Stufe / 100.f) : FVector(Reihe / 100.f, Laenge / 100.f, Stufe / 100.f);
			// Untere Reihen füllen sich zuerst; volle Reihen in Vereinsfarbe, leere grau
			const float Anteil = FMath::Clamp(Voll * Reihen - r, 0.f, 1.f);
			const FLinearColor Farbe = FMath::Lerp(Sitz, FMath::Lerp(Heim, Weiss, (r % 4 == 3) ? 0.6f : 0.f), Anteil);
			AddPart(Cube, Mitte, Groesse, Farbe);
		}
		// Rückwand
		const float Hinten = Abstand + Reihe * Reihen + 50.f;
		const float Hoehe = Stufe * Reihen + 300.f;
		const float Laenge = S.Laenge + 2.f * Reihe * Reihen;
		AddPart(Cube, S.Richtung * Hinten + FVector(0, 0, Hoehe / 2), bLang ? FVector(Laenge / 100.f, 1.f, Hoehe / 100.f) : FVector(1.f, Laenge / 100.f, Hoehe / 100.f), Beton);
		// Dach ab 25.000 Plätzen
		if (Capacity >= 25000)
		{
			const float Tiefe = Reihe * Reihen * 0.8f;
			AddPart(Cube, S.Richtung * (Hinten - Tiefe / 2) + FVector(0, 0, Hoehe + 20.f),
				bLang ? FVector(Laenge / 100.f, Tiefe / 100.f, 0.4f) : FVector(Tiefe / 100.f, Laenge / 100.f, 0.4f), FLinearColor(0.75f, 0.77f, 0.80f));
		}
	}
	// Flutlicht ab 10.000 Plätzen: vier Masten in den Ecken
	if (Capacity >= 10000)
	{
		const float Ex = FeldX / 2 + Rand + Reihe * Reihen;
		const float Ey = FeldY / 2 + Rand + Reihe * Reihen;
		for (const FVector& Ecke : { FVector(Ex, Ey, 0), FVector(-Ex, Ey, 0), FVector(Ex, -Ey, 0), FVector(-Ex, -Ey, 0) })
		{
			const float Mast = Stufe * Reihen + 3000.f;
			AddPart(Cylinder, Ecke + FVector(0, 0, Mast / 2), FVector(0.8f, 0.8f, Mast / 100.f), Beton);
			AddPart(Cube, Ecke + FVector(0, 0, Mast + 150.f), FVector(6.f, 1.f, 3.f), FLinearColor(1.f, 0.98f, 0.85f));
		}
	}
}

void AFM13StadiumActor::BuildPlayers()
{
	// 4-4-2 für beide Teams, Heim links (x < 0), Gast rechts; Positionen relativ zur Feldlänge
	const TArray<FVector2D> Formation = {
		{ -0.46f, 0.f },
		{ -0.30f, -0.30f }, { -0.32f, -0.10f }, { -0.32f, 0.10f }, { -0.30f, 0.30f },
		{ -0.14f, -0.32f }, { -0.16f, -0.10f }, { -0.16f, 0.10f }, { -0.14f, 0.32f },
		{ -0.04f, -0.10f }, { -0.04f, 0.12f }
	};
	PlayerBase.Reset();
	PlayerPhase.Reset();
	for (int32 Team = 0; Team < 2; ++Team)
	{
		for (int32 i = 0; i < Formation.Num(); ++i)
		{
			const float Sx = Team == 0 ? 1.f : -1.f;
			const FVector Pos(Formation[i].X * FeldX * Sx, Formation[i].Y * FeldY * 2.f * 0.5f * Sx, 90.f);
			const FLinearColor Farbe = i == 0 ? Torwart : (Team == 0 ? Heim : Gast);
			AddPart(Cylinder, Pos, FVector(0.5f, 0.5f, 1.8f), Farbe, true);
			AddPart(Sphere, Pos + FVector(0, 0, 110.f), FVector(0.25f, 0.25f, 0.25f), FLinearColor(0.85f, 0.65f, 0.5f), true); // Kopf
			PlayerBase.Add(Pos);
			PlayerPhase.Add(FMath::FRandRange(0.f, 2.f * PI));
		}
	}
	Ball = AddPart(Sphere, FVector(0, 0, 11.f), FVector(0.22f, 0.22f, 0.22f), Weiss, false);
	StadiumParts.Remove(Ball); // der Ball bleibt beim Neubau des Stadions erhalten
	PickBallTarget();
}

void AFM13StadiumActor::PickBallTarget()
{
	if (!PlayerBase.Num()) return;
	const FVector Ziel = PlayerBase[FMath::RandRange(0, PlayerBase.Num() - 1)];
	BallTarget = FVector(Ziel.X, Ziel.Y, 11.f);
}

void AFM13StadiumActor::SpawnLightsAndCamera()
{
	UWorld* W = GetWorld();
	if (!W) return;
	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	// Sonne und schwächeres Gegenlicht (die leere Karte hat sonst kein Licht)
	if (ADirectionalLight* Sonne = W->SpawnActor<ADirectionalLight>(FVector::ZeroVector, FRotator(-40.f, 35.f, 0.f), P))
	{
		Sonne->GetLightComponent()->SetMobility(EComponentMobility::Movable);
		Sonne->GetLightComponent()->SetIntensity(6.f);
	}
	if (ADirectionalLight* Fuell = W->SpawnActor<ADirectionalLight>(FVector::ZeroVector, FRotator(-60.f, 215.f, 0.f), P))
	{
		Fuell->GetLightComponent()->SetMobility(EComponentMobility::Movable);
		Fuell->GetLightComponent()->SetIntensity(2.f);
		Fuell->GetLightComponent()->SetCastShadows(false);
	}
	Camera = W->SpawnActor<ACameraActor>(FVector(-9000.f, -9000.f, 6000.f), FRotator::ZeroRotator, P);
	if (Camera) Camera->GetCameraComponent()->SetFieldOfView(70.f);
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
		if (Camera) PC->SetViewTarget(Camera);
}

void AFM13StadiumActor::UpdateCamera(float DeltaSeconds)
{
	if (!Camera) return;
	OrbitAngle += OrbitSpeed * DeltaSeconds;
	const float Entfernung = FMath::Max(16000.f, BuiltCapacity > 0 ? 12000.f + FMath::Sqrt((float)BuiltCapacity) * 30.f : 16000.f);
	const float A = FMath::DegreesToRadians(OrbitAngle);
	const FVector Pos(FMath::Cos(A) * Entfernung, FMath::Sin(A) * Entfernung, Entfernung * 0.45f);
	FRotator Blick = (FVector::ZeroVector - Pos).Rotation();
	Blick.Yaw -= CameraSideOffset; // nach links schauen: das Stadion rückt nach rechts neben das Menü
	Camera->SetActorLocationAndRotation(Pos, Blick);
	// Bleibt die Kamera aktiv? (Andere Systeme könnten die Ansicht umstellen)
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
		if (PC->GetViewTarget() != Camera) PC->SetViewTarget(Camera);
}

void AFM13StadiumActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Time += DeltaSeconds;
	UpdateCamera(DeltaSeconds);

	// Spieler pendeln um ihre Position (Körper und Kopf sind zwei Teile je Spieler)
	for (int32 i = 0; i < PlayerBase.Num(); ++i)
	{
		const float Ph = PlayerPhase[i];
		const FVector Off(FMath::Sin(Time * 0.7f + Ph) * 300.f, FMath::Cos(Time * 0.5f + Ph * 1.3f) * 200.f, 0.f);
		if (Players.IsValidIndex(i * 2)) Players[i * 2]->SetRelativeLocation(PlayerBase[i] + Off);
		if (Players.IsValidIndex(i * 2 + 1)) Players[i * 2 + 1]->SetRelativeLocation(PlayerBase[i] + Off + FVector(0, 0, 110.f));
	}
	// Ball rollt zum nächsten Spieler
	if (Ball)
	{
		const FVector Jetzt = Ball->GetRelativeLocation();
		const FVector Weg = BallTarget - Jetzt;
		const float Schritt = 1800.f * DeltaSeconds;
		if (Weg.Size() <= Schritt) { Ball->SetRelativeLocation(BallTarget); PickBallTarget(); }
		else Ball->SetRelativeLocation(Jetzt + Weg.GetSafeNormal() * Schritt);
	}
}
