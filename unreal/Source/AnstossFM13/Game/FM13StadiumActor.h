#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FM13StadiumActor.generated.h"

class UStaticMesh;
class UMaterialInterface;
class UStaticMeshComponent;
class ACameraActor;

// 3D-Stadion aus den Grundformen der Engine (/Engine/BasicShapes): Rasen mit Streifen und Linien,
// Tore, Tribünen nach Stadiongröße (Farbe nach Auslastung des letzten Heimspiels), Flutlicht ab 10.000,
// Dach ab 25.000 Plätzen, 22 Spieler im 4-4-2 mit Ball. Eine Kamera kreist langsam und zeigt das Stadion
// rechts neben dem Menü. Baut sich neu, wenn sich das Stadion ändert (OnStateChanged der GameInstance).
UCLASS()
class ANSTOSSFM13_API AFM13StadiumActor : public AActor
{
	GENERATED_BODY()

public:
	AFM13StadiumActor();
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaSeconds) override;

	// Grad, um die die Kamera nach links schaut, damit das Stadion rechts im Bild steht (Menü links)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FM13") float CameraSideOffset = 24.f;
	// Grad pro Sekunde, mit der die Kamera kreist (0 = steht)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FM13") float OrbitSpeed = 3.f;

	UFUNCTION() void HandleStateChanged();

private:
	UPROPERTY() TObjectPtr<UStaticMesh> Cube;
	UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
	UPROPERTY() TObjectPtr<UStaticMesh> Sphere;
	UPROPERTY() TObjectPtr<UMaterialInterface> BaseMaterial;
	UPROPERTY() TObjectPtr<ACameraActor> Camera;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> StadiumParts;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Players;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Ball;

	TArray<FVector> PlayerBase;
	TArray<float> PlayerPhase;
	FVector BallTarget = FVector::ZeroVector;
	int32 BuiltCapacity = -1;
	int32 BuiltOccupancy = -1;
	float Time = 0.f;
	float OrbitAngle = 0.f;

	void Rebuild();
	UStaticMeshComponent* AddPart(UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color, bool bPlayer = false);
	void BuildPitch();
	void BuildStands(int32 Capacity, float Occupancy);
	void BuildPlayers();
	void SpawnLightsAndCamera();
	void UpdateCamera(float DeltaSeconds);
	void PickBallTarget();
};
