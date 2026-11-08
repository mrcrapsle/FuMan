// Referenzwerte aus den Original-Funktionen des Browserspiels (Zufall fest auf 0,5 = keine Streuung).
// Aufruf aus dem Repo-Stamm: node unreal/Tests/Host/referenz.js  -> schreibt unreal/Tests/Host/Referenzwerte.h
const fs = require('fs');
const src = fs.readFileSync('js/entities.js', 'utf8');
const pick = (name) => { const i = src.indexOf('function ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const media = fs.readFileSync('js/media-rights.js', 'utf8');
const tvSrc = media.slice(media.indexOf('function calculateCollectiveTvMoney'), media.indexOf('}', media.indexOf('function calculateCollectiveTvMoney')) + 1);
const code = `const MARKET_VALUE_LOW_COEFF = 83; const MARKET_VALUE_LOW_COEFF_OLD = 450; const managerRPG = { perks: {} };
const LEAGUE_BASE_TV_MONEY = [64000000, 8000000, 1000000, 620000, 150000, 100000];
Math.random = () => 0.5;
${pick('calculatePlayerMarketValue')}\n${pick('calculatePlayerWage')}\n${tvSrc}
const out = [];
for (const s of [20, 30, 44, 45, 50, 58, 59, 63, 68, 69, 72, 77, 78, 82, 85, 86, 90, 99]) { const mv = calculatePlayerMarketValue(s); out.push({ s, mv, wage: calculatePlayerWage(mv, s) }); }
const tv = []; for (let l = 0; l < 6; l++) for (const r of [1, 9, 18]) tv.push({ l, r, tv: calculateCollectiveTvMoney(l, r) });
JSON.stringify({ out, tv });`;
const r = JSON.parse(eval(code));
let h = "#pragma once\n// Erzeugt aus den Originalformeln des Browserspiels (js/entities.js, js/media-rights.js), Zufall fest auf 0,5.\n// Neu erzeugen aus dem Repo-Stamm: node unreal/Tests/Host/referenz.js\n";
h += "struct FRefWert { int32 Staerke; long long Marktwert; int32 Gehalt; };\nstatic const FRefWert RefWerte[] = {\n" + r.out.map(o => `\t{ ${o.s}, ${o.mv}LL, ${o.wage} },`).join("\n") + "\n};\n";
h += "struct FRefTv { int32 Liga; int32 Platz; long long Tv; };\nstatic const FRefTv RefTv[] = {\n" + r.tv.map(o => `\t{ ${o.l}, ${o.r}, ${o.tv}LL },`).join("\n") + "\n};\n";
fs.writeFileSync('unreal/Tests/Host/Referenzwerte.h', h);
console.log('Referenzwerte.h geschrieben: ' + r.out.length + ' Staerken, ' + r.tv.length + ' TV-Werte');
