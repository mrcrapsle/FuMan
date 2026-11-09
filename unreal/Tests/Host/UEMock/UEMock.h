#pragma once
// Dünne Nachbildung der Engine-Klassen, die Game/ benutzt. Nur für eine Syntax- und Typprüfung des
// eigenen Codes ohne Unreal Engine. Echte Signaturen prüft erst der Build im Editor.
#include "CoreMinimal.h"
#include <map>
#include <memory>

#define UCLASS(...)
#define USTRUCT(...)
#define UENUM(...)
#define UPROPERTY(...)
#define UFUNCTION(...)
#define GENERATED_BODY() public: STATIC_CLASS_MOCK
#define ANSTOSSFM13_API
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE(Name) struct Name { \
	std::vector<std::pair<void*, std::function<void()>>> Liste; \
	void Broadcast() const { auto Kopie = Liste; for (auto& E : Kopie) E.second(); } \
	template <typename U> void AddDynamic(U* O, void (U::*F)()) { Liste.push_back({ (void*)O, [O, F]() { (O->*F)(); } }); } \
	template <typename U> void RemoveDynamic(U* O, void (U::*)()) { Liste.erase(std::remove_if(Liste.begin(), Liste.end(), [O](auto& E) { return E.first == (void*)O; }), Liste.end()); } };
#define UE_LOG(Cat, Verb, Fmt, ...) std::printf(Fmt "\n", ##__VA_ARGS__)
#define IMPLEMENT_PRIMARY_GAME_MODULE(Mod, Name, Str)

// Geteilte Zeiger (nur was die UE-Schicht ohne Slate braucht)
template <typename T> class TSharedPtr { public: std::shared_ptr<T> P; bool IsValid() const { return (bool)P; } void Reset() { P.reset(); } T* operator->() const { return P.get(); } };

struct FLinearColor { float R, G, B, A; FLinearColor(float r, float g, float b, float a = 1.f) : R(r), G(g), B(b), A(a) {} };
class UFont {};
class UObject { public: virtual ~UObject() {} };
template <typename T> T* Cast(UObject* O) { return dynamic_cast<T*>(O); }
template <typename T> const T* Cast(const UObject* O) { return dynamic_cast<const T*>(O); }
struct UClass {};
template <typename T> struct TSubclassOf { UClass* C = nullptr; TSubclassOf() {} TSubclassOf(UClass* In) : C(In) {} TSubclassOf(std::nullptr_t) {} };
#define STATIC_CLASS_MOCK static UClass* StaticClass() { static UClass C; return &C; }

class UWorld { public: double GetTimeSeconds() const { return 0.0; } };
// Super erzeugt in UE der Header-Generator; hier erbt die abgeleitete Klasse den Namen von der Basis
class UGameInstance : public UObject { public: using Super = UGameInstance; virtual void Init() {} };

namespace EEndPlayReason { enum Type { Destroyed, EndPlayInEditor }; }

class AActor : public UObject
{
public:
	virtual void BeginPlay() {}
	virtual void EndPlay(const EEndPlayReason::Type) {}
	UGameInstance* GI = nullptr;
	UWorld* GetWorld() const { static UWorld W; return &W; }
	template <typename T> T* GetGameInstance() const { return dynamic_cast<T*>(GI); }
};

enum EInputEvent { IE_Pressed, IE_Released };
struct FKey { const char* Name; };
struct EKeys
{
	static inline const FKey SpaceBar{ "Space" }, Up{ "Up" }, Down{ "Down" }, Enter{ "Enter" }, Delete{ "Delete" }, Right{ "Right" }, Left{ "Left" },
		F1{ "F1" }, F2{ "F2" }, F8{ "F8" }, F5{ "F5" }, F9{ "F9" }, One{ "1" }, Two{ "2" }, Three{ "3" }, Four{ "4" }, Five{ "5" }, Six{ "6" }, Seven{ "7" }, Eight{ "8" }, Nine{ "9" }, Zero{ "0" }, T{ "T" };
};
class UInputComponent
{
public:
	std::map<std::string, std::function<void()>> Bindings;
	template <typename UserClass> void BindKey(const FKey Key, EInputEvent, UserClass* Object, void (UserClass::*Func)()) { Bindings[Key.Name] = [Object, Func]() { (Object->*Func)(); }; }
};

class APlayerController : public AActor
{
public:
	using Super = APlayerController;
	bool IsLocalController() const { return true; }
	bool bShowMouseCursor = false;
	UInputComponent* InputComponent = nullptr;
	virtual void SetupInputComponent() {}
};
class AGameModeBase : public AActor
{
public:
	using Super = AGameModeBase;
	TSubclassOf<UObject> HUDClass, PlayerControllerClass, DefaultPawnClass;
};
class UCanvas { public: int32 SizeX = 1920, SizeY = 1080; };
class AHUD : public AActor
{
public:
	using Super = AHUD;
	UCanvas* Canvas = nullptr;
	APlayerController* Owner = nullptr;
	int32 TextCalls = 0;
	virtual void DrawHUD() {}
	APlayerController* GetOwningPlayerController() const { return Owner; }
	void DrawText(const FString&, FLinearColor, float, float, UFont* = nullptr, float = 1.f, bool = false) { ++TextCalls; }
	void DrawRect(FLinearColor, float, float, float, float) {}
};
class UEngine { public: UFont* GetMediumFont() { static UFont F; return &F; } };
inline UEngine* GEngine = nullptr;

struct FDateTime { int64 Ticks = 0; static FDateTime Now() { return FDateTime{ 123456789 }; } int64 GetTicks() const { return Ticks; } bool operator>(const FDateTime& O) const { return Ticks > O.Ticks; } };
struct FPlatformMisc { static FString GetEnvironmentVariable(const char* Name); };
struct FPaths
{
	static FString ProjectSavedDir() { return FString("/tmp/fm13-uemock/"); }
	template <typename... T> static FString Combine(const FString& A, T... Rest) { FString Out = A; ((Out = Out + FString("/") + FString(Rest)), ...); return Out; }
};
struct FFileHelper
{
	enum class EEncodingOptions { ForceUTF8WithoutBOM };
	static bool SaveStringToFile(const FString& S, const char* Path, EEncodingOptions = EEncodingOptions::ForceUTF8WithoutBOM);
	static bool LoadFileToString(FString& Out, const char* Path);
};
class IFileManager
{
public:
	static IFileManager& Get() { static IFileManager M; return M; }
	bool FileExists(const char* Path);
	bool Delete(const char* Path);
	bool Move(const char* Dest, const char* Src, bool Replace = true);
	void FindFiles(TArray<FString>& Found, const char* Wildcard, bool Files, bool Dirs);
	FDateTime GetTimeStamp(const char* Path);
};
class IModuleInterface { public: virtual ~IModuleInterface() {} virtual void StartupModule() {} virtual void ShutdownModule() {} };

