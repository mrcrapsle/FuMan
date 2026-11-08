#include "FM13Names.h"

namespace
{
	const TCHAR* Vornamen[] = {
		TEXT("Lukas"), TEXT("Jonas"), TEXT("Leon"), TEXT("Finn"), TEXT("Paul"), TEXT("Ben"), TEXT("Elias"), TEXT("Noah"),
		TEXT("Felix"), TEXT("Max"), TEXT("Tim"), TEXT("Jan"), TEXT("Niklas"), TEXT("Moritz"), TEXT("David"), TEXT("Tom"),
		TEXT("Marco"), TEXT("Kevin"), TEXT("Dennis"), TEXT("Sven"), TEXT("Kai"), TEXT("Robin"), TEXT("Mats"), TEXT("Emre"),
		TEXT("Luca"), TEXT("Mehmet"), TEXT("Pavel"), TEXT("Jakub"), TEXT("Mario"), TEXT("Florian")
	};
	const TCHAR* Nachnamen[] = {
		TEXT("Schmidt"), TEXT("Wagner"), TEXT("Becker"), TEXT("Hoffmann"), TEXT("Schulz"), TEXT("Koch"), TEXT("Richter"),
		TEXT("Klein"), TEXT("Wolf"), TEXT("Neumann"), TEXT("Schwarz"), TEXT("Zimmermann"), TEXT("Braun"), TEXT("Hartmann"),
		TEXT("Lange"), TEXT("Werner"), TEXT("Krause"), TEXT("Lehmann"), TEXT("Kaiser"), TEXT("Fuchs"), TEXT("Peters"),
		TEXT("Scholz"), TEXT("Brandt"), TEXT("Vogel"), TEXT("Yilmaz"), TEXT("Kowalski"), TEXT("Novak"), TEXT("Berger"),
		TEXT("Engel"), TEXT("Sommer")
	};
	const TCHAR* Praefixe[] = {
		TEXT("FC"), TEXT("SV"), TEXT("VfB"), TEXT("TSV"), TEXT("SC"), TEXT("VfL"), TEXT("SpVgg"), TEXT("FSV"), TEXT("Eintracht"),
		TEXT("Borussia"), TEXT("Fortuna"), TEXT("Rot-Weiss"), TEXT("Union"), TEXT("Germania"), TEXT("Viktoria")
	};
	const TCHAR* Orte[] = {
		TEXT("Hamburg"), TEXT("Bremen"), TEXT("Kiel"), TEXT("Rostock"), TEXT("Hannover"), TEXT("Braunschweig"), TEXT("Magdeburg"),
		TEXT("Dresden"), TEXT("Chemnitz"), TEXT("Erfurt"), TEXT("Jena"), TEXT("Kassel"), TEXT("Bielefeld"), TEXT("Paderborn"),
		TEXT("Dortmund"), TEXT("Bochum"), TEXT("Essen"), TEXT("Duisburg"), TEXT("Aachen"), TEXT("Bonn"), TEXT("Koblenz"),
		TEXT("Mainz"), TEXT("Darmstadt"), TEXT("Offenbach"), TEXT("Mannheim"), TEXT("Karlsruhe"), TEXT("Freiburg"),
		TEXT("Stuttgart"), TEXT("Ulm"), TEXT("Augsburg"), TEXT("Regensburg"), TEXT("Nuernberg"), TEXT("Fuerth"), TEXT("Wuerzburg"),
		TEXT("Saarbruecken"), TEXT("Trier"), TEXT("Osnabrueck"), TEXT("Muenster"), TEXT("Oldenburg"), TEXT("Luebeck"),
		TEXT("Cottbus"), TEXT("Halle"), TEXT("Zwickau"), TEXT("Aue"), TEXT("Wiesbaden"), TEXT("Siegen"), TEXT("Hagen"),
		TEXT("Krefeld"), TEXT("Oberhausen"), TEXT("Wuppertal"), TEXT("Lautern"), TEXT("Homburg"), TEXT("Pforzheim"),
		TEXT("Heilbronn"), TEXT("Reutlingen"), TEXT("Ingolstadt"), TEXT("Passau"), TEXT("Bayreuth"), TEXT("Hof"), TEXT("Gera")
	};

	template <typename T, int32 N> constexpr int32 Anzahl(T (&)[N]) { return N; }
}

namespace FM13Names
{
	FString PlayerName(FRandomStream& Rng)
	{
		return FString(Vornamen[Rng.RandRange(0, Anzahl(Vornamen) - 1)]) + TEXT(" ") + Nachnamen[Rng.RandRange(0, Anzahl(Nachnamen) - 1)];
	}

	FString ClubName(FRandomStream& Rng, TArray<FString>& Used)
	{
		for (int32 Versuch = 0; Versuch < 400; ++Versuch)
		{
			const FString Name = FString(Praefixe[Rng.RandRange(0, Anzahl(Praefixe) - 1)]) + TEXT(" ") + Orte[Rng.RandRange(0, Anzahl(Orte) - 1)];
			if (!Used.Contains(Name)) { Used.Add(Name); return Name; }
		}
		// Rückfall: durchnummeriert, damit nie zwei Vereine gleich heißen
		const FString Name = FString::Printf(TEXT("FC Verein %d"), Used.Num() + 1);
		Used.Add(Name);
		return Name;
	}
}
