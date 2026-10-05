/* eslint-disable no-undef */
// Vereine mit echten Orten und regionale Ligen (Phase 24.1).
//
// Jeder Verein hat eine Stadt (getClubCity). Die Namen bleiben wie bisher MINIMAL verfremdet
// (siehe entities.js), die Orte sind echt. Ab der 4. Liga ist der deutsche Fußball regional
// geteilt - welche Regionalliga, Oberliga und 6. Liga gespielt wird, hängt an der Heimatstadt
// des eigenen Vereins (game.homeCity, im Neues-Spiel-Dialog gewählt):
//   Liga 4: Regionalliga der Region (Nord, Nordost, West, Südwest, Bayern)
//   Liga 5: Oberliga des Landes bzw. Landesteils (echte Vereine, aufgefüllt mit Vereinen aus
//           echten Orten derselben Gegend)
//   Liga 6: Landes-/Verbandsliga des Landes (Sachsen: echte Sachsenliga, sonst Vereine aus
//           echten Orten des Landes)
// Liga 1-3 sind bundesweit (TOP_LEAGUE_CLUB_NAMES in entities.js).
// Einträge 'Name|Stadt'; Orte 'Ort' oder 'Stadtteil>Stadt' (Berlin, Hamburg, Bremen ...).

const HOME_REGIONS = {
    nord: { label: 'Nord', regionalliga: 'Regionalliga Nord' },
    nordost: { label: 'Nordost', regionalliga: 'Regionalliga Nordost' },
    west: { label: 'West', regionalliga: 'Regionalliga West' },
    suedwest: { label: 'Südwest', regionalliga: 'Regionalliga Südwest' },
    bayern: { label: 'Bayern', regionalliga: 'Regionalliga Bayern' }
};

// Wählbare Heimatstädte: Bundesland, Region, Oberliga, 6. Liga, Landesverband (Landespokal).
const HOME_CITIES = {
    'Hamburg': { state: 'Hamburg', region: 'nord', ol: 'hh', l6: 'hh', verband: 'Hamburg' },
    'Bremen': { state: 'Bremen', region: 'nord', ol: 'hb', l6: 'hb', verband: 'Bremen' },
    'Bremerhaven': { state: 'Bremen', region: 'nord', ol: 'hb', l6: 'hb', verband: 'Bremen' },
    'Hannover': { state: 'Niedersachsen', region: 'nord', ol: 'ni', l6: 'ni', verband: 'Niedersachsen' },
    'Braunschweig': { state: 'Niedersachsen', region: 'nord', ol: 'ni', l6: 'ni', verband: 'Niedersachsen' },
    'Oldenburg': { state: 'Niedersachsen', region: 'nord', ol: 'ni', l6: 'ni', verband: 'Niedersachsen' },
    'Osnabrück': { state: 'Niedersachsen', region: 'nord', ol: 'ni', l6: 'ni', verband: 'Niedersachsen' },
    'Göttingen': { state: 'Niedersachsen', region: 'nord', ol: 'ni', l6: 'ni', verband: 'Niedersachsen' },
    'Kiel': { state: 'Schleswig-Holstein', region: 'nord', ol: 'sh', l6: 'sh', verband: 'Schleswig-Holstein' },
    'Lübeck': { state: 'Schleswig-Holstein', region: 'nord', ol: 'sh', l6: 'sh', verband: 'Schleswig-Holstein' },
    'Flensburg': { state: 'Schleswig-Holstein', region: 'nord', ol: 'sh', l6: 'sh', verband: 'Schleswig-Holstein' },
    'Berlin': { state: 'Berlin', region: 'nordost', ol: 'nofv_n', l6: 'be', verband: 'Berlin' },
    'Potsdam': { state: 'Brandenburg', region: 'nordost', ol: 'nofv_n', l6: 'bb', verband: 'Brandenburg' },
    'Cottbus': { state: 'Brandenburg', region: 'nordost', ol: 'nofv_n', l6: 'bb', verband: 'Brandenburg' },
    'Rostock': { state: 'Mecklenburg-Vorpommern', region: 'nordost', ol: 'nofv_n', l6: 'mv', verband: 'Mecklenburg-Vorpommern' },
    'Schwerin': { state: 'Mecklenburg-Vorpommern', region: 'nordost', ol: 'nofv_n', l6: 'mv', verband: 'Mecklenburg-Vorpommern' },
    'Magdeburg': { state: 'Sachsen-Anhalt', region: 'nordost', ol: 'nofv_n', l6: 'st', verband: 'Sachsen-Anhalt' },
    'Halle': { state: 'Sachsen-Anhalt', region: 'nordost', ol: 'nofv_s', l6: 'st', verband: 'Sachsen-Anhalt' },
    'Leipzig': { state: 'Sachsen', region: 'nordost', ol: 'nofv_s', l6: 'sn', verband: 'Sachsen' },
    'Dresden': { state: 'Sachsen', region: 'nordost', ol: 'nofv_s', l6: 'sn', verband: 'Sachsen' },
    'Chemnitz': { state: 'Sachsen', region: 'nordost', ol: 'nofv_s', l6: 'sn', verband: 'Sachsen' },
    'Zwickau': { state: 'Sachsen', region: 'nordost', ol: 'nofv_s', l6: 'sn', verband: 'Sachsen' },
    'Erfurt': { state: 'Thüringen', region: 'nordost', ol: 'nofv_s', l6: 'th', verband: 'Thüringen' },
    'Jena': { state: 'Thüringen', region: 'nordost', ol: 'nofv_s', l6: 'th', verband: 'Thüringen' },
    'Dortmund': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'wf', l6: 'wf', verband: 'Westfalen' },
    'Gelsenkirchen': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'wf', l6: 'wf', verband: 'Westfalen' },
    'Bochum': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'wf', l6: 'wf', verband: 'Westfalen' },
    'Münster': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'wf', l6: 'wf', verband: 'Westfalen' },
    'Bielefeld': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'wf', l6: 'wf', verband: 'Westfalen' },
    'Düsseldorf': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'nr', l6: 'nr', verband: 'Niederrhein' },
    'Duisburg': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'nr', l6: 'nr', verband: 'Niederrhein' },
    'Essen': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'nr', l6: 'nr', verband: 'Niederrhein' },
    'Mönchengladbach': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'nr', l6: 'nr', verband: 'Niederrhein' },
    'Wuppertal': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'nr', l6: 'nr', verband: 'Niederrhein' },
    'Köln': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'mr', l6: 'mr', verband: 'Mittelrhein' },
    'Bonn': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'mr', l6: 'mr', verband: 'Mittelrhein' },
    'Aachen': { state: 'Nordrhein-Westfalen', region: 'west', ol: 'mr', l6: 'mr', verband: 'Mittelrhein' },
    'Frankfurt': { state: 'Hessen', region: 'suedwest', ol: 'he', l6: 'he', verband: 'Hessen' },
    'Kassel': { state: 'Hessen', region: 'suedwest', ol: 'he', l6: 'he', verband: 'Hessen' },
    'Darmstadt': { state: 'Hessen', region: 'suedwest', ol: 'he', l6: 'he', verband: 'Hessen' },
    'Stuttgart': { state: 'Baden-Württemberg', region: 'suedwest', ol: 'bw', l6: 'wue', verband: 'Württemberg' },
    'Ulm': { state: 'Baden-Württemberg', region: 'suedwest', ol: 'bw', l6: 'wue', verband: 'Württemberg' },
    'Karlsruhe': { state: 'Baden-Württemberg', region: 'suedwest', ol: 'bw', l6: 'bad', verband: 'Baden' },
    'Mannheim': { state: 'Baden-Württemberg', region: 'suedwest', ol: 'bw', l6: 'bad', verband: 'Baden' },
    'Freiburg': { state: 'Baden-Württemberg', region: 'suedwest', ol: 'bw', l6: 'bad', verband: 'Südbaden' },
    'Mainz': { state: 'Rheinland-Pfalz', region: 'suedwest', ol: 'rps', l6: 'rp', verband: 'Südwest' },
    'Kaiserslautern': { state: 'Rheinland-Pfalz', region: 'suedwest', ol: 'rps', l6: 'rp', verband: 'Südwest' },
    'Koblenz': { state: 'Rheinland-Pfalz', region: 'suedwest', ol: 'rps', l6: 'rp', verband: 'Rheinland' },
    'Saarbrücken': { state: 'Saarland', region: 'suedwest', ol: 'rps', l6: 'sl', verband: 'Saarland' },
    'München': { state: 'Bayern', region: 'bayern', ol: 'by_s', l6: 'by_s', verband: 'Bayern' },
    'Augsburg': { state: 'Bayern', region: 'bayern', ol: 'by_s', l6: 'by_s', verband: 'Bayern' },
    'Regensburg': { state: 'Bayern', region: 'bayern', ol: 'by_s', l6: 'by_s', verband: 'Bayern' },
    'Nürnberg': { state: 'Bayern', region: 'bayern', ol: 'by_n', l6: 'by_n', verband: 'Bayern' },
    'Würzburg': { state: 'Bayern', region: 'bayern', ol: 'by_n', l6: 'by_n', verband: 'Bayern' },
    'Bayreuth': { state: 'Bayern', region: 'bayern', ol: 'by_n', l6: 'by_n', verband: 'Bayern' }
};
const DEFAULT_HOME_CITY = 'Leipzig';

// Liga 1-3: bundesweit, Städte der Vereine aus entities.js (TOP_LEAGUE_CLUB_NAMES).
const TOP_CLUB_CITIES = {
    'Bayern Munchen': 'München', 'Borussia Dortmunt': 'Dortmund', 'RB Leibzig': 'Leipzig', 'Bayer Leverkussen': 'Leverkusen',
    'Eintracht Frankfurth': 'Frankfurt', 'VfB Stuttgardt': 'Stuttgart', 'TSG Hoffennheim': 'Sinsheim', 'SC Freyburg': 'Freiburg',
    'Union Berlien': 'Berlin', 'Borussia Monchengladbach': 'Mönchengladbach', 'VfL Wolfburg': 'Wolfsburg', 'Mainz 06': 'Mainz',
    'FC Augsburgh': 'Augsburg', 'Werder Breman': 'Bremen', 'VfL Bochumm': 'Bochum', '1. FC Heidenheimm': 'Heidenheim',
    'SV Darmstadt 99': 'Darmstadt', '1. FC Koln': 'Köln',
    'Hamburger SP': 'Hamburg', 'Schalke 05': 'Gelsenkirchen', 'Hertha BSK': 'Berlin', 'Fortuna Dusseldorf': 'Düsseldorf',
    'SC Padernborn': 'Paderborn', 'FC St. Paulli': 'Hamburg', 'Holstein Kiehl': 'Kiel', '1. FC Nurnberg': 'Nürnberg',
    'Karlsruher SK': 'Karlsruhe', 'Hannover 97': 'Hannover', 'SV Elversbergh': 'Spiesen-Elversberg', 'Greuther Furth': 'Fürth',
    '1. FC Kaiserslauten': 'Kaiserslautern', 'Eintracht Braunschweigh': 'Braunschweig', 'Hansa Rostok': 'Rostock', 'VfL Osnabruk': 'Osnabrück',
    'SV Wehen Wiesbadn': 'Wiesbaden', 'SSV Ulm 1847': 'Ulm',
    'Dynamo Dressden': 'Dresden', 'TSV 1861 Munchen': 'München', 'MSV Duisborg': 'Duisburg', 'FC Ingolstat 04': 'Ingolstadt',
    '1. FC Saarbrukken': 'Saarbrücken', 'SSV Jahn Regensborg': 'Regensburg', 'SpVgg Unterhachingen': 'Unterhaching', 'SC Verll': 'Verl',
    'SV Sandhausn': 'Sandhausen', 'SV Waldhof Manheim': 'Mannheim', 'Rot-Weiss Essn': 'Essen', 'Arminia Bilefeld': 'Bielefeld',
    'Viktoria Kolln': 'Köln', 'SC Preussen Munsterr': 'Münster', 'VfB Lubek': 'Lübeck', 'Alemannia Aachn': 'Aachen',
    'Stuttgarter Kikkers': 'Stuttgart', 'TSV Havelsee': 'Garbsen'
};

// Liga 4: Regionalligen (je 18 echte Vereine).
const REGIONALLIGA_CLUBS = {
    nord: ['VfB Oldenborg|Oldenburg', 'SV Meppenn|Meppen', 'Kickers Emdenn|Emden', '1. FC Phonix Lubeck|Lübeck', 'SC Weiche Flensborg 08|Flensburg',
        'Eintracht Norderstett|Norderstedt', 'Teutonia Ottensenn|Hamburg', 'SV Drochtersen/Assell|Drochtersen', 'Blau-Weiss Lohnne|Lohne',
        'Bremer SVV|Bremen', 'Altona 94|Hamburg', 'Luneburger SK Hanza|Lüneburg', 'SV Atlas Delmenhorstt|Delmenhorst', 'Heider SVV|Heide',
        'Arminia Hannoverr|Hannover', 'BSV Rehdenn|Rehden', 'SSV Jeddeloo|Edewecht', 'VfV 06 Hildesheimm|Hildesheim'],
    nordost: ['1. FC Magdeborg|Magdeburg', 'Erzgebirge Aua|Aue', 'Lokomotiv Leipzich|Leipzig', 'Carl Zeiss Jenna|Jena', 'BFC Dynamoo|Berlin',
        'BSG Chemie Leipzich|Leipzig', 'FSV Zwikau|Zwickau', 'FC Energie Cotbus|Cottbus', 'Hallescher FK 96|Halle', 'Chemnitzer FCC|Chemnitz',
        'ZFC Meussen|Meuselwitz', 'Viktoria Berlien|Berlin', 'VSG Altglienike|Berlin', 'SV Babelsbergh 03|Potsdam', 'Greifswalder FCC|Greifswald',
        'FSV Luckenwaldde|Luckenwalde', 'SV Bischofswerdda|Bischofswerda', 'FC Eilenborg|Eilenburg'],
    west: ['Rot-Weiss Oberhausn|Oberhausen', 'Wuppertaler SVV|Wuppertal', 'SC Fortuna Kohln|Köln', 'KFC Uerdingenn 05|Krefeld',
        'SV Rodinghausenn|Rödinghausen', 'SC Wiedenbruk|Rheda-Wiedenbrück', '1. FC Bocholtt|Bocholt', 'Sportfreunde Lottee|Lotte',
        'FC Gutersloo|Gütersloh', 'SSVg Velbertt|Velbert', 'TuS Ennepetall|Ennepetal', 'FC Wegberg-Beek|Wegberg', 'Sportfreunde Siegenn|Siegen',
        'SV Lippstadt 08|Lippstadt', 'VfB Hombergg|Duisburg', '1. FC Klevve|Kleve', 'Turkspor Dortmundd|Dortmund', '1. FC Kaan-Marienbornn|Siegen'],
    suedwest: ['Kickers Offenbachh|Offenbach', 'FC 08 Homborg|Homburg', 'TSV Steinbach Haigerr|Haiger', 'FSV Frankfurtt|Frankfurt',
        'Hessen Kassell|Kassel', 'SGV Freibergg|Freiberg am Neckar', 'FC-Astoria Walldorff|Walldorf', 'SG Barockstadt Fuldaa|Fulda',
        'TSV Schott Mainzz|Mainz', 'FC Giessenn|Gießen', 'Bahlinger SCC|Bahlingen', 'Eintracht Trierr|Trier', 'FK Pirmasenss|Pirmasens',
        'TuS Koblennz|Koblenz', '1. CfR Pforzheimm|Pforzheim', 'Wormatia Wormss|Worms', 'FC 08 Villingenn|Villingen-Schwenningen',
        'Eintracht Stadtallendorff|Stadtallendorf'],
    bayern: ['Wurzburger Kickerss|Würzburg', '1. FC Schweinfort 05|Schweinfurt', 'SpVgg Bayreuthh|Bayreuth', 'FV Illertissenn|Illertissen',
        'TSV Aubstadtt|Aubstadt', 'SV Wacker Burghausenn|Burghausen', 'FC Memmingenn|Memmingen', 'TSV Buchbachh|Buchbach',
        'DJK Vilzingg|Cham', 'SpVgg Hankofen-Haiing|Leiblfing', 'Turkgucu Munchen|München', 'TSV Rain/Lechh|Rain', 'SV Viktoria Aschaffenborg|Aschaffenburg',
        'FC Eintracht Bambergg|Bamberg', 'SpVgg Ansbach 08|Ansbach', 'VfB Eichstatt|Eichstätt', 'TSV Schwaben Augsborg|Augsburg', 'SV Heimstettenn|Kirchheim bei München']
};

// Liga 5: Oberligen - echte Vereine; was fehlt, kommt aus den Orten der Gegend (OBERLIGA_TOWNS).
const OBERLIGEN = {
    hh: { name: 'Oberliga Hamburg', towns: ['hh', 'sh'], clubs: ['TuS Dassendorff|Dassendorf', 'SC Victoria Hamborg|Hamburg', 'SC Concordia Hamborg|Hamburg',
        'HSV Barmbek-Uhlenhorstt|Hamburg', 'USC Palomma|Hamburg', 'Hamm United FCC|Hamburg', 'Niendorfer TSVV|Hamburg', 'SV Curslack-Neuengammee|Hamburg',
        'FC Suderelbe|Hamburg', 'SV Halstenbek-Rellingenn|Halstenbek', 'Meiendorfer SVV|Hamburg', 'Bramfelder SVV|Hamburg', 'TSV Saseel|Hamburg',
        'Wedeler TSVV|Wedel', 'SC Condor Hamborg|Hamburg', 'SV Rugenbergenn|Bönningstedt', 'FC Union Tornesh|Tornesch'] },
    hb: { name: 'Bremen-Liga', towns: ['hb', 'ni'], clubs: ['FC Oberneulandd|Bremen', 'BSC Hastedtt|Bremen', 'Blumenthaler SVV|Bremen', 'TuS Komet Arstenn|Bremen',
        'Vatan Sport Bremenn|Bremen', 'Leher TSS|Bremerhaven', 'OSC Bremerhavenn|Bremerhaven', 'FC Union 61 Bremen|Bremen', 'TSV Grollandd|Bremen',
        'SV Hemelingenn|Bremen', 'BTS Neustadtt|Bremen', 'ESC Geestemundee|Bremerhaven', 'TS Woltmershausenn|Bremen', 'Habenhauser FVV|Bremen',
        'SG Aumund-Vegesackk|Bremen', 'TuSpo Surheidee|Bremerhaven', 'FC Bremerhavenn|Bremerhaven'] },
    ni: { name: 'Oberliga Niedersachsen', towns: ['ni'], clubs: ['Lupo Martini Wolfsborg|Wolfsburg', 'Goslarer SC 09|Goslar', 'MTV Wolfenbuttel|Wolfenbüttel',
        'TuS Bersenbruk|Bersenbrück', '1. FC Germania Egestorff|Barsinghausen', 'Heeslinger SCC|Heeslingen', 'Rotenburger SVV|Rotenburg (Wümme)',
        'SV Ramlingen/Ehlershausenn|Burgdorf', 'VfL Oldenborg|Oldenburg', 'SC Spelle-Venhauss|Spelle', 'Eintracht Cellee|Celle', '1. FC Wunstorff|Wunstorf',
        'TB Uphusenn|Achim', 'Hannoverscher SCC|Hannover', 'FC Eintracht Northeimm|Northeim', 'SV Wilhelmshavenn|Wilhelmshaven', 'FT Braunschweigg|Braunschweig',
        'TSV Godshornn|Langenhagen'] },
    sh: { name: 'Oberliga Schleswig-Holstein', towns: ['sh'], clubs: ['SV Todesfeldee|Todesfelde', 'SV Eutin 09|Eutin', 'TSV Krop|Kropp', 'Husumer SVV|Husum',
        'PSV Neumunster|Neumünster', 'SV Eichedee|Steinburg', 'TSV Schilkseee|Kiel', 'Preetzer TSVV|Preetz', 'Inter Turkspor Kiell|Kiel',
        'Oldenburger SVV|Oldenburg in Holstein', 'NTSV Strand 09|Timmendorfer Strand', 'TSB Flensborg|Flensburg', 'SV Dornbreite Lubeck|Lübeck',
        'Breitenfelder SVV|Breitenfelde', 'FC Kilia Kiell|Kiel', 'TuS Rotenhoff|Rendsburg', 'Heikendorfer SVV|Heikendorf'] },
    nofv_n: { name: 'NOFV-Oberliga Nord', towns: ['be', 'bb', 'mv'], clubs: ['VfB Krieschoww|Krieschow', 'Ludwigsfelder FCC|Ludwigsfelde', '1. FC Lok Stendall|Stendal',
        'FC Anker Wismarr|Wismar', 'FC Optik Rathenoww|Rathenow', 'Tennis Borussia Berlien|Berlin', 'SV Lichtenbergh 47|Berlin', 'FSV Barlebn|Barleben',
        'Malchower SV 91|Malchow', 'Torgelower FC Greiff|Torgelow', 'FC Mecklenburg Schwerinn|Schwerin', 'Brandenburger SC Sud 05|Brandenburg an der Havel',
        'Berliner AK 07|Berlin', 'Hertha 03 Zehlendorff|Berlin', 'SV Tasmania Berlien|Berlin', 'MSV Neuruppinn|Neuruppin', 'Rostocker FCC|Rostock',
        'FC Stahl Brandenborg|Brandenburg an der Havel'] },
    nofv_s: { name: 'NOFV-Oberliga Süd', towns: ['sn', 'th', 'st'], clubs: ['VfB Auerbah|Auerbach', 'SV Schott Jenna|Jena', 'FC Grimma 1919|Grimma',
        'SV Merseburgh 99|Merseburg', 'FSV Budissa Bautzn|Bautzen', 'SG Union Sandersdorff|Sandersdorf', 'VfL Halle 96|Halle', 'SC Freitall|Freital',
        'FC Einheit Rudolstadtt|Rudolstadt', 'FC Rot-Weiss Erfurtt|Erfurt', 'FSV Wacker Nordhausn|Nordhausen', 'FC Thuringen Weimarr|Weimar',
        'VFC Plauenn|Plauen', 'BSG Wismut Gerra|Gera', 'SV 09 Arnstadtt|Arnstadt', 'SSV Markranstadtt|Markranstädt', 'FC Oberlausitz Neugersdorff|Ebersbach-Neugersdorf',
        'Kickers 94 Markkleeborg|Markkleeberg', '1. FC Romonta Amsdorff|Amsdorf', 'Dresdner SC 1898|Dresden'] },
    wf: { name: 'Oberliga Westfalen', towns: ['wf'], clubs: ['SpVgg Vredenn|Vreden', 'ASC 08 Dortmund|Dortmund', 'FC Eintracht Rheinee|Rheine',
        'Westfalia Rhynernn|Hamm', 'SV Schermbekk|Schermbeck', 'Holzwickeder SCC|Holzwickede', 'TSG Sprockhovel|Sprockhövel', 'Hammer SpVgg|Hamm',
        'SC Westfalia Hernee|Herne', 'DJK TuS Hordell|Bochum', 'FC Iserlohnn|Iserlohn', 'SV Hohenlimborg 10|Hagen', 'TuS Halternn|Haltern am See',
        'Delbrucker SC|Delbrück', 'SpVgg Erkenschwik|Oer-Erkenschwick', 'YEG Hassell|Gelsenkirchen'] },
    nr: { name: 'Oberliga Niederrhein', towns: ['nr'], clubs: ['SpVg Schonnebek|Essen', 'ETB SW Essenn|Essen', 'TVD Velbertt|Velbert', 'VfB Hildenn|Hilden',
        '1. FC Monheimm|Monheim am Rhein', 'Ratingen 05/19|Ratingen', 'SC St. Toniss|Tönisvorst', 'Cronenberger SCC|Wuppertal', 'FC Krayy|Essen',
        'SV Sonsbekk|Sonsbeck', 'Sportfreunde Baumbergg|Monheim am Rhein', 'SV Biemenhorstt|Bocholt', 'TuRU Dusseldorff|Düsseldorf',
        'SC Union Nettetall|Nettetal', '1. FC Monchengladbachh|Mönchengladbach', 'VfR Krefeld-Fischelnn|Krefeld'] },
    mr: { name: 'Mittelrheinliga', towns: ['mr'], clubs: ['FC Hennef 06|Hennef', 'Bonner SCC|Bonn', 'SV Bergisch Gladbach 08|Bergisch Gladbach', 'FC Peschh|Köln',
        'SpVg Frechen 21|Frechen', 'Siegburger SV 05|Siegburg', 'FC Hurth|Hürth', 'SC Borussia Lindenthal|Köln', 'Blau-Weiss Konigsdorf|Frechen',
        '1. FC Durenn|Düren', 'VfL Alfterr|Alfter', 'Eintracht Hohkeppell|Lindlar', 'SV Eilendorff|Aachen', 'SpVg Wesseling-Urfeldd|Wesseling',
        '1. FC Spichh|Troisdorf', 'SV Breinigg|Stolberg', 'Viktoria Arnoldsweilerr|Düren'] },
    he: { name: 'Hessenliga', towns: ['he'], clubs: ['SC Hessen Dreieichh|Dreieich', 'FC Eddersheimm|Hattersheim', 'SC Rot-Weiss Frankfurtt|Frankfurt',
        'KSV Baunatall|Baunatal', 'Hunfelder SV|Hünfeld', 'Turk Gucu Friedbergg|Friedberg', 'SV Zeilsheimm|Frankfurt', 'FSV Fernwaldd|Fernwald',
        'VfB Ginsheimm|Ginsheim-Gustavsburg', 'SpVgg 04 Neu-Isenburg|Neu-Isenburg', '1. FC Erlenseee|Erlensee', 'CSC 04 Kassel|Kassel',
        'SV Buchonia Fliedenn|Flieden', 'Viktoria Griesheimm|Griesheim', 'FC Bayern Alzenauu|Alzenau', 'SV Unter-Flockenbachh|Gorxheimertal'] },
    bw: { name: 'Oberliga Baden-Württemberg', towns: ['wue', 'bad'], clubs: ['FC Nottingenn|Remchingen', 'TSG Balingenn|Balingen', 'SV Oberachernn|Achern',
        '1. Goppinger SV|Göppingen', 'FSV 09 Bissingen|Bietigheim-Bissingen', 'SV Fellbachh|Fellbach', 'TSV Essingenn|Essingen', 'FV Ravensborg|Ravensburg',
        'VfR Aalenn|Aalen', '1. FC Normannia Gmund|Schwäbisch Gmünd', 'TSG Backnangg|Backnang', 'ATSV Mutschelbachh|Karlsbad', 'SV Linxx|Rheinau',
        'FC Denzlingenn|Denzlingen', 'Kehler FVV|Kehl'] },
    rps: { name: 'Oberliga Rheinland-Pfalz/Saar', towns: ['rp', 'sl'], clubs: ['FV Engerss|Neuwied', 'FC Arminia Ludwigshafenn|Ludwigshafen', 'FV Dieffle|Dillingen',
        'SV Auersmacherr|Kleinblittersdorf', 'TSV Gau-Odernheimm|Gau-Odernheim', 'FC Hertha Wiesbachh|Eppelborn', 'SV Morlauternn|Kaiserslautern',
        'FC Karbachh|Karbach', 'TuS Mechtersheimm|Römerberg', 'Ludwigshafener SCC|Ludwigshafen', 'Hassia Bingenn|Bingen', 'SV Rochling Volklingen|Völklingen',
        'Borussia Neunkirchenn|Neunkirchen', 'SC 07 Idar-Obersteinn|Idar-Oberstein', 'SV Gonsenheimm|Mainz', 'Rot-Weiss Koblenzz|Koblenz'] },
    by_n: { name: 'Bayernliga Nord', towns: ['by_n'], clubs: ['Wurzburger FVV|Würzburg', 'ATSV Erlangenn|Erlangen', 'TSV Grossbardorff|Großbardorf',
        'SC Eltersdorff|Erlangen', 'DJK Gebenbachh|Gebenbach', 'SpVgg SV Weidenn|Weiden', '1. SC Feuchtt|Feucht', 'SV Erlenbachh|Erlenbach am Main',
        'TSV Abtswindd|Abtswind', 'FC Coburgg|Coburg', 'ASV Chamm|Cham', 'SV Seligenportenn|Pyrbaum', 'TSV Neudrossenfeldd|Neudrossenfeld',
        'SpVgg Bayern Hoff|Hof', 'FC Ambergg|Amberg', 'TSV Kornborg|Nürnberg'] },
    by_s: { name: 'Bayernliga Süd', towns: ['by_s'], clubs: ['TSV 1866 Dachau|Dachau', 'SV Pullachh|Pullach', 'FC Pipinsriedd|Altomünster', 'TSV Landsbergg|Landsberg am Lech',
        '1. FC Sonthofenn|Sonthofen', 'TSV Kotternn|Kempten', 'FC Ismaningg|Ismaning', 'SV Kirchanschoring|Kirchanschöring', 'TSV Schwabmunchen|Schwabmünchen',
        'Turkspor Augsborg|Augsburg', 'FC Deisenhofenn|Oberhaching', 'SV Erlbachh|Erlbach', 'TSV Wasserborg|Wasserburg am Inn', 'FC Gundelfingenn|Gundelfingen',
        'TSV Nordlingen|Nördlingen', 'SV Donaustauff|Donaustauf', 'FC Unterfohring|Unterföhring'] }
};

// Liga 6: Landes-/Verbandsliga je Land. Sachsen mit der echten Sachsenliga.
const LIGA6 = {
    sn: { name: 'Sachsenliga', clubs: ['SV Blau-Weiss Leipzich|Leipzig', 'TSV Grosspostwitzz|Großpostwitz', 'SG Traktor Reichenbah|Reichenbach im Vogtland',
        'BSG Stahl Riesaa|Riesa', 'FC Rot-Weiss Mittweidda|Mittweida', 'TSV Bernsdorff|Bernsdorf', 'SG Dynamo Hoyerswerdda|Hoyerswerda', 'SV Motor Zschopauu|Zschopau',
        'SG Chemie Bohlenn|Böhlen', 'SV Blau-Gelb Grunaa|Chemnitz', 'TSV Oberwiesenthall|Oberwiesenthal', 'VfB Empor Glauchauu|Glauchau', 'FC Lossnitz|Lößnitz',
        'Heidenauer SVV|Heidenau', 'Radebeuler BCC|Radebeul', 'SV Einheit Kamenzz|Kamenz', 'BSC Freibergg|Freiberg', 'SG Taucha 98|Taucha',
        'Roter Stern Leipzich|Leipzig', 'FSV Neusalza-Sprembergg|Neusalza-Spremberg', 'SC Borea Dressden|Dresden', 'VfL Pirna-Copitzz|Pirna',
        'ESV Delitzschh|Delitzsch', 'SV Tapfer Leipzich|Leipzig', 'FV Dresden 07 Laubegast|Dresden', 'Doebelner SC|Döbeln'] },
    th: { name: 'Thüringenliga' }, st: { name: 'Verbandsliga Sachsen-Anhalt' }, bb: { name: 'Brandenburgliga' }, be: { name: 'Berlin-Liga' },
    mv: { name: 'Verbandsliga Mecklenburg-Vorpommern' }, hh: { name: 'Landesliga Hamburg' }, hb: { name: 'Landesliga Bremen' },
    ni: { name: 'Landesliga Niedersachsen' }, sh: { name: 'Landesliga Schleswig-Holstein' }, wf: { name: 'Landesliga Westfalen' },
    nr: { name: 'Landesliga Niederrhein' }, mr: { name: 'Landesliga Mittelrhein' }, he: { name: 'Verbandsliga Hessen' },
    wue: { name: 'Verbandsliga Württemberg' }, bad: { name: 'Verbandsliga Baden' }, rp: { name: 'Verbandsliga Südwest' },
    sl: { name: 'Saarlandliga' }, by_n: { name: 'Landesliga Bayern Nord' }, by_s: { name: 'Landesliga Bayern Süd' }
};

// Echte Orte je Land/Landesteil - für Vereine der unteren Ligen ('Stadtteil>Stadt' bei Großstädten).
const REGION_TOWNS = {
    sn: ['Leipzig', 'Dresden', 'Chemnitz', 'Zwickau', 'Plauen', 'Görlitz', 'Bautzen', 'Freiberg', 'Pirna', 'Meißen', 'Riesa', 'Döbeln', 'Grimma', 'Delitzsch',
        'Torgau', 'Radebeul', 'Freital', 'Hoyerswerda', 'Kamenz', 'Zittau', 'Annaberg-Buchholz', 'Glauchau', 'Crimmitschau', 'Werdau', 'Oelsnitz', 'Borna', 'Wurzen', 'Coswig'],
    th: ['Erfurt', 'Jena', 'Gera', 'Weimar', 'Gotha', 'Nordhausen', 'Eisenach', 'Suhl', 'Mühlhausen', 'Altenburg', 'Saalfeld', 'Rudolstadt', 'Ilmenau', 'Arnstadt',
        'Sonneberg', 'Sondershausen', 'Apolda', 'Greiz', 'Meiningen', 'Bad Langensalza', 'Zeulenroda', 'Pößneck', 'Schmalkalden', 'Heiligenstadt'],
    st: ['Magdeburg', 'Halle', 'Dessau', 'Wittenberg', 'Halberstadt', 'Stendal', 'Merseburg', 'Bernburg', 'Weißenfels', 'Naumburg', 'Wernigerode', 'Quedlinburg',
        'Zeitz', 'Bitterfeld', 'Sangerhausen', 'Aschersleben', 'Schönebeck', 'Köthen', 'Burg', 'Salzwedel', 'Haldensleben', 'Eisleben', 'Staßfurt', 'Zerbst'],
    bb: ['Potsdam', 'Cottbus', 'Brandenburg an der Havel', 'Frankfurt (Oder)', 'Oranienburg', 'Eberswalde', 'Falkensee', 'Bernau', 'Königs Wusterhausen',
        'Fürstenwalde', 'Neuruppin', 'Schwedt', 'Senftenberg', 'Luckenwalde', 'Ludwigsfelde', 'Rathenow', 'Spremberg', 'Guben', 'Prenzlau', 'Strausberg',
        'Wittenberge', 'Teltow', 'Hennigsdorf', 'Forst'],
    be: ['Spandau>Berlin', 'Köpenick>Berlin', 'Neukölln>Berlin', 'Lichtenberg>Berlin', 'Pankow>Berlin', 'Reinickendorf>Berlin', 'Steglitz>Berlin',
        'Tempelhof>Berlin', 'Charlottenburg>Berlin', 'Wedding>Berlin', 'Friedrichshain>Berlin', 'Kreuzberg>Berlin', 'Marzahn>Berlin', 'Hellersdorf>Berlin',
        'Treptow>Berlin', 'Weißensee>Berlin', 'Hohenschönhausen>Berlin', 'Tegel>Berlin', 'Mariendorf>Berlin', 'Schöneberg>Berlin', 'Wilmersdorf>Berlin', 'Moabit>Berlin'],
    mv: ['Rostock', 'Schwerin', 'Neubrandenburg', 'Stralsund', 'Greifswald', 'Wismar', 'Güstrow', 'Waren', 'Neustrelitz', 'Parchim', 'Ludwigslust', 'Anklam',
        'Pasewalk', 'Torgelow', 'Bergen auf Rügen', 'Wolgast', 'Ribnitz-Damgarten', 'Grevesmühlen', 'Hagenow', 'Malchow', 'Demmin', 'Teterow'],
    hh: ['Altona>Hamburg', 'Barmbek>Hamburg', 'Bergedorf>Hamburg', 'Billstedt>Hamburg', 'Eimsbüttel>Hamburg', 'Harburg>Hamburg', 'Wandsbek>Hamburg',
        'Eppendorf>Hamburg', 'Winterhude>Hamburg', 'Rahlstedt>Hamburg', 'Lurup>Hamburg', 'Wilhelmsburg>Hamburg', 'Blankenese>Hamburg', 'Volksdorf>Hamburg',
        'Poppenbüttel>Hamburg', 'Finkenwerder>Hamburg', 'Lokstedt>Hamburg', 'Farmsen>Hamburg', 'Bahrenfeld>Hamburg', 'Osdorf>Hamburg'],
    hb: ['Vegesack>Bremen', 'Hemelingen>Bremen', 'Findorff>Bremen', 'Huchting>Bremen', 'Walle>Bremen', 'Gröpelingen>Bremen', 'Horn>Bremen', 'Osterholz>Bremen',
        'Habenhausen>Bremen', 'Burglesum>Bremen', 'Schwachhausen>Bremen', 'Obervieland>Bremen', 'Lehe>Bremerhaven', 'Leherheide>Bremerhaven', 'Wulsdorf>Bremerhaven',
        'Geestemünde>Bremerhaven', 'Mitte>Bremerhaven', 'Weddewarden>Bremerhaven', 'Grohn>Bremen', 'Sebaldsbrück>Bremen'],
    ni: ['Hannover', 'Braunschweig', 'Oldenburg', 'Osnabrück', 'Wolfsburg', 'Göttingen', 'Salzgitter', 'Hildesheim', 'Delmenhorst', 'Wilhelmshaven', 'Lüneburg',
        'Celle', 'Garbsen', 'Hameln', 'Lingen', 'Langenhagen', 'Nordhorn', 'Wolfenbüttel', 'Goslar', 'Peine', 'Emden', 'Cuxhaven', 'Stade', 'Gifhorn', 'Verden',
        'Cloppenburg', 'Leer', 'Uelzen', 'Vechta'],
    sh: ['Kiel', 'Lübeck', 'Flensburg', 'Neumünster', 'Norderstedt', 'Elmshorn', 'Pinneberg', 'Itzehoe', 'Wedel', 'Ahrensburg', 'Geesthacht', 'Rendsburg',
        'Henstedt-Ulzburg', 'Schleswig', 'Husum', 'Heide', 'Bad Oldesloe', 'Eutin', 'Preetz', 'Kaltenkirchen', 'Mölln', 'Ratzeburg', 'Eckernförde'],
    wf: ['Dortmund', 'Gelsenkirchen', 'Bochum', 'Münster', 'Bielefeld', 'Paderborn', 'Hagen', 'Hamm', 'Herne', 'Gütersloh', 'Iserlohn', 'Witten', 'Lünen', 'Marl',
        'Recklinghausen', 'Castrop-Rauxel', 'Gladbeck', 'Dorsten', 'Arnsberg', 'Lippstadt', 'Minden', 'Herford', 'Detmold', 'Rheine', 'Ahlen', 'Unna', 'Soest', 'Lüdenscheid'],
    nr: ['Düsseldorf', 'Duisburg', 'Essen', 'Mönchengladbach', 'Oberhausen', 'Krefeld', 'Wuppertal', 'Mülheim an der Ruhr', 'Solingen', 'Remscheid', 'Neuss', 'Moers',
        'Velbert', 'Ratingen', 'Viersen', 'Wesel', 'Kleve', 'Dinslaken', 'Kempen', 'Goch', 'Hilden', 'Grevenbroich', 'Emmerich'],
    mr: ['Köln', 'Bonn', 'Aachen', 'Leverkusen', 'Bergisch Gladbach', 'Düren', 'Troisdorf', 'Siegburg', 'Euskirchen', 'Hürth', 'Frechen', 'Kerpen', 'Brühl',
        'Wesseling', 'Hennef', 'Eschweiler', 'Stolberg', 'Alsdorf', 'Würselen', 'Pulheim', 'Bergheim', 'Bornheim'],
    he: ['Frankfurt', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach', 'Hanau', 'Gießen', 'Marburg', 'Fulda', 'Rüsselsheim', 'Wetzlar', 'Bad Homburg', 'Oberursel',
        'Rodgau', 'Dreieich', 'Bensheim', 'Lampertheim', 'Limburg', 'Viernheim', 'Baunatal', 'Bad Vilbel', 'Langen', 'Neu-Isenburg', 'Maintal'],
    wue: ['Stuttgart', 'Ulm', 'Heilbronn', 'Reutlingen', 'Esslingen', 'Ludwigsburg', 'Tübingen', 'Sindelfingen', 'Göppingen', 'Böblingen', 'Aalen', 'Schwäbisch Gmünd',
        'Waiblingen', 'Ravensburg', 'Friedrichshafen', 'Kornwestheim', 'Backnang', 'Bietigheim', 'Nürtingen', 'Kirchheim unter Teck', 'Schwäbisch Hall', 'Crailsheim'],
    bad: ['Karlsruhe', 'Mannheim', 'Freiburg', 'Heidelberg', 'Pforzheim', 'Offenburg', 'Baden-Baden', 'Bruchsal', 'Rastatt', 'Lörrach', 'Weinheim', 'Sinsheim',
        'Walldorf', 'Schwetzingen', 'Ettlingen', 'Kehl', 'Lahr', 'Emmendingen', 'Villingen-Schwenningen', 'Konstanz', 'Singen', 'Waldshut-Tiengen'],
    rp: ['Mainz', 'Ludwigshafen', 'Koblenz', 'Trier', 'Kaiserslautern', 'Worms', 'Neuwied', 'Neustadt an der Weinstraße', 'Speyer', 'Frankenthal', 'Landau',
        'Pirmasens', 'Zweibrücken', 'Andernach', 'Bad Kreuznach', 'Idar-Oberstein', 'Bingen', 'Alzey', 'Lahnstein', 'Mayen', 'Wittlich', 'Haßloch'],
    sl: ['Saarbrücken', 'Neunkirchen', 'Homburg', 'Völklingen', 'Sankt Ingbert', 'Saarlouis', 'Merzig', 'Sankt Wendel', 'Blieskastel', 'Dillingen', 'Lebach',
        'Püttlingen', 'Heusweiler', 'Schiffweiler', 'Ottweiler', 'Wadern', 'Quierschied', 'Riegelsberg', 'Bexbach', 'Eppelborn'],
    by_n: ['Nürnberg', 'Fürth', 'Erlangen', 'Würzburg', 'Bamberg', 'Bayreuth', 'Schweinfurt', 'Aschaffenburg', 'Ansbach', 'Hof', 'Coburg', 'Kulmbach', 'Forchheim',
        'Schwabach', 'Amberg', 'Weiden', 'Kitzingen', 'Lichtenfels', 'Kronach', 'Herzogenaurach', 'Neustadt an der Aisch', 'Marktredwitz'],
    by_s: ['München', 'Augsburg', 'Regensburg', 'Ingolstadt', 'Landshut', 'Rosenheim', 'Kempten', 'Passau', 'Freising', 'Straubing', 'Dachau', 'Memmingen',
        'Kaufbeuren', 'Neu-Ulm', 'Erding', 'Garmisch-Partenkirchen', 'Deggendorf', 'Traunstein', 'Fürstenfeldbruck', 'Germering', 'Starnberg', 'Mühldorf']
};

// Vereinsnamen-Vorsätze nach Gegend (Osten mit den typischen BSG-Namen).
const TOWN_PREFIXES = {
    ost: ['SV', 'FSV', 'SG', 'BSG Motor', 'BSG Empor', 'SV Lok', 'SG Traktor', 'SV Chemie', 'FC Stahl', 'SV Fortuna', 'TSV', 'VfB', 'SV Eintracht', 'FC Einheit'],
    west: ['SV', 'TuS', 'SC', 'VfL', 'VfB', 'FC', 'SpVgg', 'TSV', 'SG', 'DJK', 'SV Germania', 'FC Viktoria', 'SV Rot-Weiß', 'SV Blau-Weiß', 'SuS'],
    sued: ['TSV', 'SV', 'FC', 'SpVgg', 'SC', 'VfB', 'TSG', 'FV', 'VfR', 'SSV', 'ASV', 'DJK', 'FC Viktoria', 'SV Eintracht']
};
const OST_KEYS = ['sn', 'th', 'st', 'bb', 'be', 'mv'];
const SUED_KEYS = ['by_n', 'by_s', 'wue', 'bad'];

function townCityOf(eintrag) {
    const [ort, stadt] = eintrag.split('>');
    return { ort, stadt: stadt || ort };
}

// Generierte Vereine für einen Orte-Schlüssel: jede Kombination Vorsatz + Ort, gemischt.
function buildTownClubs(key, seed) {
    const prefixes = OST_KEYS.includes(key) ? TOWN_PREFIXES.ost : SUED_KEYS.includes(key) ? TOWN_PREFIXES.sued : TOWN_PREFIXES.west;
    const towns = REGION_TOWNS[key] || [];
    const out = [];
    towns.forEach((t, i) => {
        const { ort, stadt } = townCityOf(t);
        out.push(`${prefixes[(i * 7 + seed) % prefixes.length]} ${ort}|${stadt}`);
        out.push(`${prefixes[(i * 11 + seed + 3) % prefixes.length]} ${ort}|${stadt}`);
    });
    return out;
}

// Stadt je Vereinsname (einmal aufgebaut).
let clubCityIndex = null;
function buildClubCityIndex() {
    clubCityIndex = Object.assign({}, TOP_CLUB_CITIES);
    const add = e => { const [n, c] = e.split('|'); if (c && !clubCityIndex[n]) clubCityIndex[n] = c; };
    Object.values(REGIONALLIGA_CLUBS).forEach(l => l.forEach(add));
    Object.values(OBERLIGEN).forEach(o => o.clubs.forEach(add));
    Object.values(LIGA6).forEach(o => (o.clubs || []).forEach(add));
    Object.keys(REGION_TOWNS).forEach(k => [0, 1, 2, 3, 4].forEach(s => buildTownClubs(k, s).forEach(add)));
    return clubCityIndex;
}

function getHomeCity() {
    return HOME_CITIES[game.homeCity] ? game.homeCity : DEFAULT_HOME_CITY;
}
function getHomeInfo() {
    return HOME_CITIES[getHomeCity()];
}

// Stadt eines Vereins (null, wenn unbekannt). Eigener Verein und Zweite Mannschaft: Heimatstadt.
function getClubCity(name) {
    if (!name) return null;
    if (name === game.clubName || (game.secondTeam && name === game.secondTeam.name)) return getHomeCity();
    const idx = clubCityIndex || buildClubCityIndex();
    if (idx[name]) return idx[name];
    // Unbekannter Name (alter Spielstand, umbenannt): Ort am Namensende erkennen.
    const orte = Object.keys(HOME_CITIES).concat(...Object.values(REGION_TOWNS).map(l => l.map(t => townCityOf(t).ort)));
    const treffer = orte.filter(o => name.endsWith(' ' + o)).sort((a, b) => b.length - a.length)[0];
    if (!treffer) return null;
    const eintrag = Object.values(REGION_TOWNS).flat().find(t => townCityOf(t).ort === treffer);
    return eintrag ? townCityOf(eintrag).stadt : treffer;
}

// Namen-Pool einer regionalen Liga (Stufe 3-5) für die Heimat - echte Vereine zuerst, dann Orte.
function getRegionalClubPool(level) {
    const info = getHomeInfo();
    const namen = e => e.split('|')[0];
    if (level === 3) return REGIONALLIGA_CLUBS[info.region].map(namen).concat(...OBERLIGEN[info.ol].towns.map(k => buildTownClubs(k, 1).map(namen)));
    if (level === 4) {
        const ol = OBERLIGEN[info.ol];
        return ol.clubs.map(namen).concat(...ol.towns.map(k => buildTownClubs(k, 2).map(namen)));
    }
    if (level === 5) {
        const l6 = LIGA6[info.l6];
        return (l6.clubs || []).map(namen).concat(buildTownClubs(info.l6, 0).map(namen), buildTownClubs(info.l6, 4).map(namen));
    }
    return [];
}

// Wie viele echte Vereine stehen ganz vorn im Pool (der Rest sind Vereine aus echten Orten)?
function getRegionalRealCount(level) {
    const info = getHomeInfo();
    if (level === 3) return REGIONALLIGA_CLUBS[info.region].length;
    if (level === 4) return OBERLIGEN[info.ol].clubs.length;
    if (level === 5) return (LIGA6[info.l6].clubs || []).length;
    return 0;
}

// Ligennamen und Landespokal zur Heimat (Neues Spiel, Laden).
function applyHomeRegion() {
    const info = getHomeInfo();
    leagueNames[3] = `4. Liga (${HOME_REGIONS[info.region].regionalliga})`;
    leagueNames[4] = `5. Liga (${OBERLIGEN[info.ol].name})`;
    leagueNames[5] = `6. Liga (${LIGA6[info.l6].name})`;
    if (typeof landesPokal !== 'undefined') landesPokal.region = info.verband;
}

// Alte Spielstände ohne Heimatstadt: ihre unteren Ligen sind der Nordost-Strang (Sachsen).
function ensureHomeCity() {
    if (HOME_CITIES[game.homeCity]) return;
    const nordost = Object.keys(HOME_CITIES).filter(c => HOME_CITIES[c].region === 'nordost');
    game.homeCity = nordost.find(c => (game.clubName || '').includes(c)) || DEFAULT_HOME_CITY;
}

function getHomeCityOptions() {
    return Object.keys(HOME_CITIES).map(c => ({ city: c, state: HOME_CITIES[c].state, region: HOME_REGIONS[HOME_CITIES[c].region].label }));
}
