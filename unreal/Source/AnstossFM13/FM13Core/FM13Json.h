#pragma once

#include "FM13Types.h"

// Kleiner JSON-Leser für Spielstände (eigener und der des Browserspiels). Flacher Knotenpool:
// Kinder sind Indizes in Nodes. Zahlen mit Komma oder Exponent werden als double gelesen.
namespace FM13Json
{
	enum class ENodeType : uint8 { Null, Bool, Number, String, Array, Object };

	struct FNode
	{
		ENodeType Type = ENodeType::Null;
		int64 Number = 0;     // ganzzahliger Anteil (gerundet bei Kommazahlen)
		double Real = 0.0;    // genauer Wert
		bool bValue = false;
		FString Text;
		TArray<FString> Keys;
		TArray<int32> Children;
	};

	struct FDocument
	{
		TArray<FNode> Nodes;
		int32 Root = -1;
	};

	bool Parse(const FString& Text, FDocument& Out, FString& OutError);

	// Lesezugriff mit Standardwerten
	class FReader
	{
	public:
		const TArray<FNode>& Nodes;
		explicit FReader(const TArray<FNode>& In) : Nodes(In) {}

		bool IsObject(int32 N) const { return Nodes.IsValidIndex(N) && Nodes[N].Type == ENodeType::Object; }
		bool IsArray(int32 N) const { return Nodes.IsValidIndex(N) && Nodes[N].Type == ENodeType::Array; }
		int32 Find(int32 Obj, const TCHAR* Key) const;
		int64 Int(int32 Obj, const TCHAR* Key, int64 Default) const;
		double Real(int32 Obj, const TCHAR* Key, double Default) const;
		bool Bool(int32 Obj, const TCHAR* Key, bool Default) const;
		FString Str(int32 Obj, const TCHAR* Key, const FString& Default) const;
		TArray<int32> Items(int32 Obj, const TCHAR* Key) const;
		// Elemente eines Arrays (Knotenindex statt Schlüssel)
		TArray<int32> Elements(int32 Arr) const { return IsArray(Arr) ? Nodes[Arr].Children : TArray<int32>(); }
		int64 IntAt(int32 N, int64 Default) const { return (Nodes.IsValidIndex(N) && Nodes[N].Type == ENodeType::Number) ? Nodes[N].Number : Default; }
	};
}
