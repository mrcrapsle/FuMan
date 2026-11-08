// Referenzwerte aus den Original-Funktionen des Browserspiels (Zufall fest auf 0,5 = keine Streuung)
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
console.log(JSON.stringify({ out, tv }));`;
console.log(eval(code) || '');
