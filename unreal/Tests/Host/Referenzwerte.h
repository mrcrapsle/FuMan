#pragma once
// Erzeugt aus den Originalformeln des Browserspiels (js/entities.js, js/media-rights.js), Zufall fest auf 0,5.
// Neu erzeugen aus dem Repo-Stamm: node unreal/Tests/Host/referenz.js
struct FRefWert { int32 Staerke; long long Marktwert; int32 Gehalt; };
static const FRefWert RefWerte[] = {
	{ 20, 15000LL, 200 },
	{ 30, 15000LL, 200 },
	{ 44, 15000LL, 250 },
	{ 45, 15000LL, 250 },
	{ 50, 30000LL, 600 },
	{ 58, 150000LL, 3200 },
	{ 59, 150000LL, 2100 },
	{ 63, 245000LL, 2650 },
	{ 68, 1020000LL, 7300 },
	{ 69, 1025000LL, 9600 },
	{ 72, 1260000LL, 10650 },
	{ 77, 6100000LL, 32450 },
	{ 78, 7505000LL, 51250 },
	{ 82, 11380000LL, 64850 },
	{ 85, 35440000LL, 149050 },
	{ 86, 35900000LL, 150650 },
	{ 90, 51705000LL, 205950 },
	{ 99, 208545000LL, 754900 },
};
struct FRefTv { int32 Liga; int32 Platz; long long Tv; };
static const FRefTv RefTv[] = {
	{ 0, 1, 96000000LL },
	{ 0, 9, 67840000LL },
	{ 0, 18, 36160000LL },
	{ 1, 1, 12000000LL },
	{ 1, 9, 8480000LL },
	{ 1, 18, 4520000LL },
	{ 2, 1, 1500000LL },
	{ 2, 9, 1060000LL },
	{ 2, 18, 565000LL },
	{ 3, 1, 930000LL },
	{ 3, 9, 657200LL },
	{ 3, 18, 350300LL },
	{ 4, 1, 225000LL },
	{ 4, 9, 159000LL },
	{ 4, 18, 84750LL },
	{ 5, 1, 150000LL },
	{ 5, 9, 106000LL },
	{ 5, 18, 56500LL },
};
