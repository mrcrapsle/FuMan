#include "FM13Json.h"

namespace
{
	using namespace FM13Json;

	class FParser
	{
	public:
		const FString& In;
		int32 Pos = 0;
		TArray<FNode>& Nodes;
		FString Error;
		int32 Depth = 0;

		FParser(const FString& InText, TArray<FNode>& InNodes) : In(InText), Nodes(InNodes) {}

		bool Fail(const TCHAR* Msg) { if (Error.IsEmpty()) Error = FString::Printf(TEXT("%s (Zeichen %d)"), Msg, Pos); return false; }
		void SkipWs() { while (Pos < In.Len() && (In[Pos] == TEXT(' ') || In[Pos] == TEXT('\n') || In[Pos] == TEXT('\r') || In[Pos] == TEXT('\t'))) ++Pos; }
		bool Eat(TCHAR C) { SkipWs(); if (Pos < In.Len() && In[Pos] == C) { ++Pos; return true; } return false; }
		static bool IsDigit(TCHAR C) { return C >= TEXT('0') && C <= TEXT('9'); }

		bool ParseString(FString& Out)
		{
			if (!Eat(TEXT('"'))) return Fail(TEXT("Anfuehrungszeichen erwartet"));
			while (Pos < In.Len())
			{
				const TCHAR C = In[Pos++];
				if (C == TEXT('"')) return true;
				if (C != TEXT('\\')) { Out.AppendChar(C); continue; }
				if (Pos >= In.Len()) break;
				const TCHAR E = In[Pos++];
				if (E == TEXT('n')) Out.AppendChar(TEXT('\n'));
				else if (E == TEXT('r')) Out.AppendChar(TEXT('\r'));
				else if (E == TEXT('t')) Out.AppendChar(TEXT('\t'));
				else if (E == TEXT('b')) Out.AppendChar(TEXT('\b'));
				else if (E == TEXT('f')) Out.AppendChar(TEXT('\f'));
				else if (E == TEXT('u'))
				{
					if (Pos + 4 > In.Len()) break;
					uint32 Code = 0;
					for (int32 k = 0; k < 4; ++k)
					{
						const TCHAR H = In[Pos++];
						Code <<= 4;
						if (IsDigit(H)) Code |= (uint32)(H - TEXT('0'));
						else if (H >= TEXT('a') && H <= TEXT('f')) Code |= (uint32)(H - TEXT('a') + 10);
						else if (H >= TEXT('A') && H <= TEXT('F')) Code |= (uint32)(H - TEXT('A') + 10);
						else return Fail(TEXT("Ungueltige Unicode-Folge"));
					}
					Out.AppendChar((TCHAR)Code);
				}
				else Out.AppendChar(E);
			}
			return Fail(TEXT("Text nicht abgeschlossen"));
		}

		bool ParseValue(int32& OutIndex)
		{
			SkipWs();
			if (Pos >= In.Len()) return Fail(TEXT("Unerwartetes Ende"));
			if (++Depth > 200) return Fail(TEXT("Zu tief verschachtelt"));
			const bool bOk = ParseValueInner(OutIndex);
			--Depth;
			return bOk;
		}

		bool ParseValueInner(int32& OutIndex)
		{
			FNode N;
			const TCHAR C = In[Pos];
			if (C == TEXT('{'))
			{
				++Pos;
				N.Type = ENodeType::Object;
				OutIndex = Nodes.Add(N);
				if (Eat(TEXT('}'))) return true;
				do
				{
					FString K;
					SkipWs();
					if (!ParseString(K)) return false;
					if (!Eat(TEXT(':'))) return Fail(TEXT("Doppelpunkt erwartet"));
					int32 Kind = -1;
					if (!ParseValue(Kind)) return false;
					Nodes[OutIndex].Keys.Add(K);
					Nodes[OutIndex].Children.Add(Kind);
				} while (Eat(TEXT(',')));
				return Eat(TEXT('}')) ? true : Fail(TEXT("Schliessende Klammer } erwartet"));
			}
			if (C == TEXT('['))
			{
				++Pos;
				N.Type = ENodeType::Array;
				OutIndex = Nodes.Add(N);
				if (Eat(TEXT(']'))) return true;
				do
				{
					int32 Kind = -1;
					if (!ParseValue(Kind)) return false;
					Nodes[OutIndex].Children.Add(Kind);
				} while (Eat(TEXT(',')));
				return Eat(TEXT(']')) ? true : Fail(TEXT("Schliessende Klammer ] erwartet"));
			}
			if (C == TEXT('"'))
			{
				N.Type = ENodeType::String;
				if (!ParseString(N.Text)) return false;
				OutIndex = Nodes.Add(N);
				return true;
			}
			if (C == TEXT('t') || C == TEXT('f') || C == TEXT('n'))
			{
				const TCHAR* Wort = C == TEXT('t') ? TEXT("true") : (C == TEXT('f') ? TEXT("false") : TEXT("null"));
				for (int32 k = 0; Wort[k]; ++k, ++Pos)
					if (Pos >= In.Len() || In[Pos] != Wort[k]) return Fail(TEXT("Unbekanntes Wort"));
				N.Type = C == TEXT('n') ? ENodeType::Null : ENodeType::Bool;
				N.bValue = C == TEXT('t');
				OutIndex = Nodes.Add(N);
				return true;
			}
			// Zahl: -?ziffern(.ziffern)?([eE][+-]?ziffern)?
			const int32 Start = Pos;
			bool bNeg = false;
			if (In[Pos] == TEXT('-')) { bNeg = true; ++Pos; }
			if (Pos >= In.Len() || !IsDigit(In[Pos])) return Fail(TEXT("Zahl erwartet"));
			double Wert = 0.0;
			while (Pos < In.Len() && IsDigit(In[Pos])) { Wert = Wert * 10.0 + (double)(In[Pos] - TEXT('0')); ++Pos; }
			if (Pos < In.Len() && In[Pos] == TEXT('.'))
			{
				++Pos;
				double Teil = 0.1;
				if (Pos >= In.Len() || !IsDigit(In[Pos])) return Fail(TEXT("Ziffer nach dem Punkt erwartet"));
				while (Pos < In.Len() && IsDigit(In[Pos])) { Wert += Teil * (double)(In[Pos] - TEXT('0')); Teil *= 0.1; ++Pos; }
			}
			if (Pos < In.Len() && (In[Pos] == TEXT('e') || In[Pos] == TEXT('E')))
			{
				++Pos;
				bool bExpNeg = false;
				if (Pos < In.Len() && (In[Pos] == TEXT('+') || In[Pos] == TEXT('-'))) { bExpNeg = In[Pos] == TEXT('-'); ++Pos; }
				if (Pos >= In.Len() || !IsDigit(In[Pos])) return Fail(TEXT("Exponent erwartet"));
				int32 Exp = 0;
				while (Pos < In.Len() && IsDigit(In[Pos])) { Exp = FMath::Min(400, Exp * 10 + (int32)(In[Pos] - TEXT('0'))); ++Pos; }
				for (int32 k = 0; k < Exp; ++k) Wert = bExpNeg ? Wert / 10.0 : Wert * 10.0;
			}
			(void)Start;
			N.Type = ENodeType::Number;
			N.Real = bNeg ? -Wert : Wert;
			// Ganzzahliger Wert: gerundet, auf int64 begrenzt
			const double Begrenzt = FMath::Clamp(N.Real, -9.0e18, 9.0e18);
			N.Number = FMath::RoundToInt64(Begrenzt);
			OutIndex = Nodes.Add(N);
			return true;
		}
	};
}

namespace FM13Json
{
	bool Parse(const FString& Text, FDocument& Out, FString& OutError)
	{
		Out = FDocument();
		FParser P(Text, Out.Nodes);
		// Byte-Order-Mark am Anfang überspringen (0xFEFF in UE, EF BB BF als Einzelbytes in den Host-Tests)
		while (P.Pos < P.In.Len() && static_cast<uint32>(P.In[P.Pos]) > 0x7Fu) ++P.Pos;
		int32 Root = -1;
		if (!P.ParseValue(Root)) { OutError = P.Error; return false; }
		P.SkipWs();
		if (P.Pos != Text.Len()) { OutError = TEXT("Unerwartete Zeichen nach dem JSON."); return false; }
		Out.Root = Root;
		return true;
	}

	int32 FReader::Find(int32 Obj, const TCHAR* Key) const
	{
		if (!IsObject(Obj)) return -1;
		const FString K(Key);
		const FNode& N = Nodes[Obj];
		for (int32 i = 0; i < N.Keys.Num(); ++i) if (N.Keys[i] == K) return N.Children[i];
		return -1;
	}

	int64 FReader::Int(int32 Obj, const TCHAR* Key, int64 Default) const
	{
		const int32 N = Find(Obj, Key);
		return (N >= 0 && Nodes[N].Type == ENodeType::Number) ? Nodes[N].Number : Default;
	}

	double FReader::Real(int32 Obj, const TCHAR* Key, double Default) const
	{
		const int32 N = Find(Obj, Key);
		return (N >= 0 && Nodes[N].Type == ENodeType::Number) ? Nodes[N].Real : Default;
	}

	bool FReader::Bool(int32 Obj, const TCHAR* Key, bool Default) const
	{
		const int32 N = Find(Obj, Key);
		return (N >= 0 && Nodes[N].Type == ENodeType::Bool) ? Nodes[N].bValue : Default;
	}

	FString FReader::Str(int32 Obj, const TCHAR* Key, const FString& Default) const
	{
		const int32 N = Find(Obj, Key);
		return (N >= 0 && Nodes[N].Type == ENodeType::String) ? Nodes[N].Text : Default;
	}

	TArray<int32> FReader::Items(int32 Obj, const TCHAR* Key) const
	{
		return Elements(Find(Obj, Key));
	}
}
