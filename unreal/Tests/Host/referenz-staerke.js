// Referenzwerte für die Teamstärke und die automatische Aufstellung: führt die Original-Funktionen
// calcTeamStrength() und pickBestLineupIds() des Browserspiels mit festen Eingaben aus.
// Aufruf aus dem Repo-Stamm: node unreal/Tests/Host/referenz-staerke.js  -> schreibt unreal/Tests/Host/ReferenzStaerke.h
const fs = require('fs');
const lese = f => fs.readFileSync(f, 'utf8');
const klammer = (src, i, auf, zu) => { let d = 0; for (let k = src.indexOf(auf, i); k < src.length; k++) { if (src[k] === auf) d++; if (src[k] === zu) { d--; if (d === 0) return k; } } throw new Error('Klammer'); };
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error(name); const kopf = src.indexOf(')', i); return src.slice(i, klammer(src, kopf, '{', '}') + 1); };
const konst = (src, name, auf, zu) => { const i = src.indexOf('const ' + name + ' = '); if (i < 0) throw new Error(name); return src.slice(i, klammer(src, i, auf, zu) + 1) + ';'; };
const match = lese('js/match.js'), squadJs = lese('js/squad.js'), staff = lese('js/campus-staff.js'), state = lese('js/state.js'), weather = lese('js/weather.js');

const code = `
${konst(match, 'TACTIC_STYLE_CONFIG', '{', '}')}
${konst(squadJs, 'FORMATION_RATINGS', '{', '}')}
${konst(state, 'licenseConfig', '[', ']')}
${konst(weather, 'WEATHER_TYPES', '[', ']')}
${konst(staff, 'STAFF_SYNERGIES', '[', ']')}
const TRAIT_BONUS_CAP = 3; const PLAYER_ROLES = {};
let squad = [], lineup = [], game = {}, privateLife = {}, staffMembers = {}, staffMeta = {}, campusBuildings = {}, underworld = { activeSabotages: {} }, managerRPG = { perks: {} }, currentWeather = WEATHER_TYPES[0];
function autoLineup() { lineup = pickBestLineupIds(); }
${['calcTeamStrength', 'getTacticStyleBonus', 'getFormationOffBonus', 'getTackleHardnessBonus', 'getLineupChemistryStats'].map(n => fn(match, n)).join('\n')}
${fn(squadJs, 'pickBestLineupIds')}
${['getGreenkeeperEffekt', 'getAnalystEffekt', 'getNutritionistEffekt', 'getStaffLevelMultiplier', 'getStaffEffectivenessMultiplier', 'getActiveStaffSynergies'].map(n => fn(staff, n)).join('\n')}

let saat = 12345;
const zufall = n => { saat = (saat * 1103515245 + 12345) & 0x7fffffff; return (saat >>> 8) % n; };
const POS = ['TW', 'ABW', 'MIT', 'ST'];
const TRAITS = ['Kein', 'Tor-Instinkt', 'Freistoß-Gott', 'Elfmeter-Killer', 'Leader', 'Eisenfuß', 'Flügelflitzer', 'Zweikampfmonster', 'Wetterfest'];
const STILE = ['ausgeglichen', 'ballbesitz', 'konter', 'pressing', 'kickrush', 'defensiv', 'offensiv', 'umschaltspiel'];
const FORMATIONEN = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-2-3-1', '4-1-4-1', '3-4-3', '5-4-1'];
const TRAINING = ['ausgeglichen', 'taktik', 'kondition', 'erholung'];
const HAERTE = ['normal', 'hart', 'vorsichtig'];
const KEYS = ['coTrainer', 'greenkeeper', 'analyst', 'nutritionist'];

const staerke = [];
for (let n = 0; n < 60; n++) {
    const schlicht = n < 6; // die ersten Fälle ohne Personal und Extras
    squad = []; lineup = [];
    for (let i = 0; i < 11; i++) {
        const p = { id: 'p' + i, strength: 30 + zufall(60), fitness: 10 + zufall(91), dailyForm: 5 + zufall(91), morale: 5 + zufall(96), age: 17 + zufall(20),
            pos: i === 0 ? 'TW' : POS[1 + zufall(3)], trait: TRAITS[zufall(3) === 0 ? zufall(9) : 0] };
        squad.push(p); lineup.push(p.id);
    }
    const kap = zufall(3) === 0 ? -1 : zufall(11);
    const x = {
        heim: zufall(2), lizenz: schlicht ? 0 : zufall(4), fans: zufall(101), chemie: schlicht ? 0 : zufall(31), taktiker: schlicht ? 0 : zufall(2),
        wetter: zufall(WEATHER_TYPES.length), stress: schlicht ? 0 : zufall(60), training: zufall(TRAINING.length), stil: zufall(STILE.length),
        formation: zufall(FORMATIONEN.length), haerte: schlicht ? 0 : zufall(HAERTE.length), gelaende: schlicht ? 0 : zufall(6)
    };
    staffMembers = {}; staffMeta = {};
    ['fitCoach', 'physio', 'scout', 'sportDir'].forEach(k => { staffMembers[k] = { hired: false }; });
    const personal = [];
    KEYS.forEach(k => {
        const hired = schlicht ? 0 : zufall(2), lvl = 1 + zufall(3), moral = 20 + zufall(81), zweite = zufall(2);
        const task = k === 'greenkeeper' ? (zweite ? 'tempo' : 'pflege') : (k === 'analyst' ? (zweite ? 'tiefe' : 'vorbericht') : (k === 'nutritionist' ? (zweite ? 'leistung' : 'fitness') : 'aus'));
        staffMembers[k] = { hired: !!hired, task }; staffMeta[k] = { level: lvl, morale: moral };
        personal.push(hired, lvl, moral, zweite);
    });
    game = { captainId: kap >= 0 ? squad[kap].id : null, fans: x.fans, teamTraining: TRAINING[x.training], tacticStyle: STILE[x.stil], formation: FORMATIONEN[x.formation], tackleHardness: HAERTE[x.haerte], pairChemistry: {} };
    for (let i = 0; i < 11; i++) for (let j = i + 1; j < 11; j++) game.pairChemistry[[squad[i].id, squad[j].id].sort().join('_')] = x.chemie;
    privateLife = { license: x.lizenz, stress: x.stress };
    campusBuildings = { trainingground: { lvl: x.gelaende } };
    managerRPG = { perks: { tactician: !!x.taktiker } };
    currentWeather = WEATHER_TYPES[x.wetter];
    const erwartet = calcTeamStrength(!!x.heim);
    staerke.push({ spieler: squad.map(p => [p.strength, p.fitness, p.dailyForm, p.morale, p.age, POS.indexOf(p.pos), TRAITS.indexOf(p.trait)]), kap,
        x: [x.heim, x.lizenz, x.fans, x.chemie, x.taktiker, x.wetter, x.stress, x.training, x.stil, x.formation, x.haerte, x.gelaende, ...personal], erwartet });
}

const elf = [];
for (let n = 0; n < 40; n++) {
    squad = [];
    const groesse = 12 + zufall(12);
    for (let i = 0; i < groesse; i++) squad.push({ id: i, strength: 30 + zufall(50), fitness: 10 + zufall(91), pos: POS[i < 2 ? 0 : 1 + zufall(3)], injured: zufall(8) === 0 ? 2 : 0, suspended: zufall(12) === 0 ? 1 : 0 });
    const f = zufall(FORMATIONEN.length);
    game = { formation: FORMATIONEN[f] };
    const ids = pickBestLineupIds().slice().sort((a, b) => a - b);
    elf.push({ f, spieler: squad.map(p => [p.strength, p.fitness, POS.indexOf(p.pos), p.injured, p.suspended]), ids });
}
JSON.stringify({ staerke, elf, stile: STILE, formationen: FORMATIONEN, training: TRAINING, haerte: HAERTE });`;
const r = JSON.parse(eval(code));
const zeile = a => '{ ' + a.join(', ') + ' }';
let h = "#pragma once\n// Erzeugt aus calcTeamStrength() (js/match.js) und pickBestLineupIds() (js/squad.js) des Browserspiels.\n// Neu erzeugen aus dem Repo-Stamm: node unreal/Tests/Host/referenz-staerke.js\n";
h += "// Spieler: Staerke, Kondition, Tagesform, Moral, Alter, Position, Trait. X: Heim, Lizenz, Fans, Eingespieltheit je Paar, Taktiker, Wetter, Stress,\n// Training, Stil, Formation, Haerte, Trainingsgelaende, dann je Mitarbeiter (Co-Trainer, Greenkeeper, Analyst, Ernaehrung): eingestellt, Stufe, Moral, zweite Aufgabe.\n";
h += `static const char* RefStile[] = ${zeile(r.stile.map(s => '"' + s + '"'))};\nstatic const char* RefFormationen[] = ${zeile(r.formationen.map(s => '"' + s + '"'))};\n`;
h += `static const char* RefTraining[] = ${zeile(r.training.map(s => '"' + s + '"'))};\nstatic const char* RefHaerte[] = ${zeile(r.haerte.map(s => '"' + s + '"'))};\n`;
h += "struct FRefStaerke { int32 Spieler[11][7]; int32 Kapitaen; int32 X[28]; int32 Erwartet; };\nstatic const FRefStaerke RefStaerke[] = {\n"
    + r.staerke.map(s => `\t{ { ${s.spieler.map(zeile).join(', ')} }, ${s.kap}, ${zeile(s.x)}, ${s.erwartet} },`).join('\n') + "\n};\n";
h += "struct FRefElf { int32 Formation; int32 Anzahl; int32 Spieler[24][5]; int32 AnzahlElf; int32 Elf[11]; };\nstatic const FRefElf RefElf[] = {\n"
    + r.elf.map(e => `\t{ ${e.f}, ${e.spieler.length}, { ${e.spieler.map(zeile).join(', ')} }, ${e.ids.length}, ${zeile(e.ids)} },`).join('\n') + "\n};\n";
fs.writeFileSync('unreal/Tests/Host/ReferenzStaerke.h', h);
console.log('ReferenzStaerke.h geschrieben: ' + r.staerke.length + ' Staerken, ' + r.elf.length + ' Aufstellungen');
