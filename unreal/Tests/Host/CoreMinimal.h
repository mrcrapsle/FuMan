#pragma once
// Nachbildung der wenigen UE-Grundtypen, die der Spielkern nutzt (nur für Tests ohne Unreal Engine).
// Im echten Projekt kommt CoreMinimal.h aus der Engine; dieser Ordner liegt dann nicht im Include-Pfad.
#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <functional>
#include <string>
#include <utility>
#include <vector>

typedef int32_t int32;
typedef int64_t int64;
typedef uint8_t uint8;
typedef uint32_t uint32;
typedef char TCHAR;
#define TEXT(x) x
#define check(x) do { if (!(x)) { std::fprintf(stderr, "check failed: %s\n", #x); std::abort(); } } while (0)

template <typename T> inline void Swap(T& A, T& B) { std::swap(A, B); }

class FString
{
public:
	std::string S;
	FString() {}
	FString(const char* C) : S(C ? C : "") {}
	FString(const std::string& X) : S(X) {}
	const char* operator*() const { return S.c_str(); }
	int32 Len() const { return (int32)S.size(); }
	bool IsEmpty() const { return S.empty(); }
	bool operator==(const FString& O) const { return S == O.S; }
	bool operator!=(const FString& O) const { return S != O.S; }
	bool operator<(const FString& O) const { return S < O.S; }
	FString operator+(const FString& O) const { return FString(S + O.S); }
	FString& operator+=(const FString& O) { S += O.S; return *this; }
	bool Contains(const FString& O) const { return S.find(O.S) != std::string::npos; }
	static FString FromInt(int64 V) { return FString(std::to_string(V)); }
	static FString Printf(const char* Fmt, ...)
	{
		char Buf[4096];
		va_list Args; va_start(Args, Fmt);
		std::vsnprintf(Buf, sizeof(Buf), Fmt, Args);
		va_end(Args);
		return FString(Buf);
	}
};
inline FString operator+(const char* A, const FString& B) { return FString(std::string(A) + B.S); }

template <typename T>
class TArray
{
public:
	std::vector<T> V;
	TArray() {}
	TArray(std::initializer_list<T> L) : V(L) {}
	int32 Num() const { return (int32)V.size(); }
	int32 Add(const T& X) { V.push_back(X); return (int32)V.size() - 1; }
	void Append(const TArray<T>& O) { V.insert(V.end(), O.V.begin(), O.V.end()); }
	void Insert(const T& X, int32 I) { V.insert(V.begin() + I, X); }
	void Reset() { V.clear(); }
	void Empty() { V.clear(); }
	T& operator[](int32 I) { check(I >= 0 && I < Num()); return V[I]; }
	const T& operator[](int32 I) const { check(I >= 0 && I < Num()); return V[I]; }
	bool IsValidIndex(int32 I) const { return I >= 0 && I < Num(); }
	T& Last() { check(Num() > 0); return V.back(); }
	const T& Last() const { check(Num() > 0); return V.back(); }
	void RemoveAt(int32 I) { check(IsValidIndex(I)); V.erase(V.begin() + I); }
	template <typename P> int32 RemoveAll(P Pred) { auto It = std::remove_if(V.begin(), V.end(), Pred); int32 N = (int32)(V.end() - It); V.erase(It, V.end()); return N; }
	template <typename P> void Sort(P Pred) { std::sort(V.begin(), V.end(), Pred); }
	template <typename P> void StableSort(P Pred) { std::stable_sort(V.begin(), V.end(), Pred); }
	template <typename P> T* FindByPredicate(P Pred) { for (auto& X : V) if (Pred(X)) return &X; return nullptr; }
	template <typename P> const T* FindByPredicate(P Pred) const { for (auto& X : V) if (Pred(X)) return &X; return nullptr; }
	template <typename P> int32 IndexOfByPredicate(P Pred) const { for (int32 i = 0; i < Num(); ++i) if (Pred(V[i])) return i; return -1; }
	template <typename P> bool ContainsByPredicate(P Pred) const { return IndexOfByPredicate(Pred) >= 0; }
	bool Contains(const T& X) const { return std::find(V.begin(), V.end(), X) != V.end(); }
	typename std::vector<T>::iterator begin() { return V.begin(); }
	typename std::vector<T>::iterator end() { return V.end(); }
	typename std::vector<T>::const_iterator begin() const { return V.begin(); }
	typename std::vector<T>::const_iterator end() const { return V.end(); }
};

struct FMath
{
	template <typename T> static T Max(T A, T B) { return A > B ? A : B; }
	template <typename T> static T Min(T A, T B) { return A < B ? A : B; }
	template <typename T> static T Clamp(T X, T Lo, T Hi) { return X < Lo ? Lo : (X > Hi ? Hi : X); }
	template <typename T> static T Abs(T X) { return X < 0 ? -X : X; }
	static float Exp(float X) { return std::exp(X); }
	static float Pow(float A, float B) { return std::pow(A, B); }
	static float Sqrt(float X) { return std::sqrt(X); }
	static int32 RoundToInt(float X) { return (int32)std::lround(X); }
	static int32 FloorToInt(float X) { return (int32)std::floor(X); }
	static int64 RoundToInt64(double X) { return (int64)std::llround(X); }
};

// Gleiche Formel wie FRandomStream in der Engine ist nicht nötig: der Kern verlangt nur Determinismus je Seed.
class FRandomStream
{
public:
	uint32 Seed = 1;
	FRandomStream() {}
	explicit FRandomStream(int32 InSeed) { Initialize(InSeed); }
	void Initialize(int32 InSeed) { Seed = (uint32)InSeed; }
	int32 GetCurrentSeed() const { return (int32)Seed; }
	float FRand() { Seed = Seed * 196314165u + 907633515u; return (float)((Seed >> 8) & 0xFFFFFF) / 16777216.0f; }
	int32 RandRange(int32 Lo, int32 Hi) { if (Hi <= Lo) return Lo; return Lo + (int32)(FRand() * (float)(Hi - Lo + 1)) % (Hi - Lo + 1); }
};
