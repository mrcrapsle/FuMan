/* eslint-disable no-undef */
// Spiel-Lexikon: durchsuchbare Hilfe zu allen wichtigen Werten und Regeln - was ein Wert
// bedeutet, wie er wirkt und wie man ihn beeinflusst, jeweils mit Sprung zum passenden
// Bildschirm. Eigener Bildschirm screen-lexicon (Menü: Karriere & Spezial).

const LEXICON_ENTRIES = [
    { cat: 'Spieler', title: 'Stärke', screen: 'screen-squad',
        text: 'Grundwert jedes Spielers (bis 99). Die Startelf zählt: Stärke × Fitness × Tagesform, gemittelt über elf Spieler, plus Boni (Taktik, Heimvorteil, Kapitän, Traits).',
        tips: ['Training und Spielpraxis entwickeln junge Spieler', 'Ab etwa 30 baut die Stärke im Sommer ab (Archetyp entscheidet)', 'Verbesserungen kauft man am Transfermarkt'] },
    { cat: 'Spieler', title: 'Fitness', screen: 'screen-training',
        text: 'Jedes Spiel kostet Kraft, Pausen bringen sie zurück. Stammspieler erholen sich zwischen den Spieltagen nur zu einem Viertel so stark wie Bankspieler - wer immer dieselbe Elf bringt, wird müde.',
        tips: ['Rotieren (Vorbericht bietet „Ausgeruhte Elf“ an)', 'Trainingsschwerpunkt Kondition oder Erholung', 'Gegenpressing und hohe Außenverteidiger kosten zusätzlich Kraft, Tief stehen spart sie'] },
    { cat: 'Spieler', title: 'Moral', screen: 'screen-squad',
        text: 'Stimmung der Spieler. Der Schnitt der Startelf verschiebt die Teamstärke: über 80 % gibt es einen Bonus, darunter einen Abzug.',
        tips: ['Siege, Einsätze, Elf des Spieltags und Länderspiele heben sie', 'Gebrochene Versprechen (Einsatzgarantie, Pressekonferenz) und Bankdrücken senken sie', 'Der Mannschaftsrat dämpft Moralstürze nach Niederlagen'] },
    { cat: 'Spieler', title: 'Tagesform', screen: 'screen-squad',
        text: 'Schwankt von Spiel zu Spiel um den Wert 50 und verändert die effektive Stärke leicht - gute Tage und schlechte Tage.',
        tips: ['„Trainer stellt Top-Elf auf“ berücksichtigt Tagesform und Fitness'] },
    { cat: 'Spieler', title: 'Potenzial (Jugend)', screen: 'screen-youth',
        text: 'Obergrenze, bis zu der sich ein Talent entwickeln kann. Ungeprüft unbekannt; die Potenzial-Prüfung (3.000 €) zeigt eine Spanne.',
        tips: ['Leihe zur Entwicklung bringt mit Stammplatz mehr als die Akademie allein', 'Mentor und Jugendtrainer beschleunigen die Entwicklung', 'Mit 19 ist eine Profivertrag-Entscheidung fällig'] },
    { cat: 'Spieler', title: 'Marktwert', screen: 'screen-transfer',
        text: 'Richtwert für Ablösen. Steigt mit der Stärke, mit Länderspielen, Turniererfolgen und Auszeichnungen.',
        tips: ['Verkäufer verlangen meist etwas mehr als den Marktwert', 'Am Deadline-Day gibt es Schnäppchen (-30 %)'] },
    { cat: 'Spieler', title: 'Kicker-Noten & Elf des Spieltags', screen: 'screen-squad',
        text: 'Nach jedem Ligaspiel bekommt jeder Startspieler eine Note von 1,0 bis 6,0. Mit 1,5 oder besser gibt es die Nominierung für die Elf des Spieltags und einen Moralschub.',
        tips: ['Ein Notenschnitt von 2,5 oder besser senkt die Schwelle für die Nationalmannschaft'] },
    { cat: 'Spieler', title: 'Verletzungen', screen: 'screen-squad',
        text: 'Nach jedem Spiel wird für die Eingesetzten gewürfelt. Das Risiko steigt mit harter Trainingsintensität (bis +25 %), dem Alter (ab 32 +20 %, ab 35 +40 %) und früheren Verletzungen; junge Spieler sind robuster.',
        tips: ['Lockeres Training und Erholung senken das Risiko', 'Physiotherapeut (halbe Ausfallzeit) und Reha-Zentrum verkürzen Ausfälle', 'Länderspielreisen bringen ein zusätzliches Risiko'] },
    { cat: 'Taktik', title: 'Gegnervorbereitung (Match-Prep)', screen: 'screen-training',
        text: 'Mit dem Trainingsschwerpunkt Match-Prep bereitest du dich auf den Spielstil des nächsten Ligagegners vor: tippst du richtig (Pressing, Ballbesitz oder Konter), gibt es +2,5 Stärke - daneben gibt es nichts. Der Schwerpunkt Taktik bringt dagegen sicher +2.',
        tips: ['Ohne Chef-Analyst kennst du nur den Grundstil aus der Presse - ein berechenbarer Manager wird gekontert, dann liegt die Vorbereitung daneben', 'Die Vorbereitung gilt nur für den Spieltag, für den du sie gewählt hast, und nur in der Liga'] },
    { cat: 'Taktik', title: 'Taktik-Duell', screen: 'screen-squad',
        text: 'Pressing schlägt Ballbesitz, Ballbesitz schlägt Konter, Konter schlägt Pressing - ±2 Stärke im Ligaspiel. Ausgeglichen und Kick and Rush sind neutral.',
        tips: ['Wer in 3 von 5 Ligaspielen denselben Ansatz wählt, ist berechenbar - Gegner stellen sich darauf ein', 'Der Chef-Analyst verrät im Vorbericht den Plan des Gegners', 'Im Livespiel zählt die aktuell gewählte Taktik'] },
    { cat: 'Taktik', title: 'Standards & Elfmeter im Livespiel', screen: 'screen-squad',
        text: 'Bei einem Elfmeter oder Freistoß in Tornähe hält das Livespiel an. Elfmeter: Du wählst den Schützen - der feste Schütze hat Routine (+5 %), der Gefoulte will oft selbst, ist aber angeschlagen; in der Schlussphase eines knappen Spiels flattern die Nerven (außer bei Selbstbewussten). Freistoß: direkt (hängt am Schützen), Flanke auf den Kopfballspieler (Konterrisiko) oder kurz (sicher, selten gefährlich). Der Videobeweis nimmt manches Tor zurück.',
        tips: ['Feste Schützen stellst du in der Aufstellung ein', 'Im Elfmeterschießen kannst du einen Elfmeter-Killer von der Bank bringen - das kostet einen Wechsel', 'Beim schnellen Durchspielen entscheidet der Trainer automatisch'] },
    { cat: 'Taktik', title: 'Co-Trainer im Livespiel', screen: 'screen-squad',
        text: 'Ein eingestellter Co-Trainer meldet sich im Livespiel mit Hinweisen aus dem echten Spielstand - jeweils mit einer Aktion per Tipp. Stufe 1: müde Spieler, Rückstand oder knappe Führung in der Schlussphase. Stufe 2: zusätzlich Gelb-Rot-Gefahr und ein verlorenes Taktik-Duell (ab der 20. Minute, mit Chef-Analyst sofort). Stufe 3: erkennt auch ein gewinnbares Taktik-Duell.',
        tips: ['Jede Aktion kostet, was sie sonst auch kostet: einen Wechsel, Zweikampfstärke oder Ordnung hinten', 'Ein schlecht gelaunter Co-Trainer meldet sich seltener - Gehaltserhöhung hebt seine Laune', 'Befolgte Hinweise stärken das Vertrauen in ihn (Kader > Co-Trainer-Historie)'] },
    { cat: 'Taktik', title: 'Standards einstudieren', screen: 'screen-training',
        text: 'Setze im Wochenplan Tage auf „🚩 Standards“ und wähle darunter eine Variante: direkter Freistoß, Freistoßflanke, kurz ausgeführt, Elfmeter oder Ecken. Jeder Standards-Tag bringt der Variante 10 Punkte pro Spieltag (mit Standards-Spezialist 15), alle anderen verlieren 2. Bei 100 % bringt sie im Livespiel bis zu +6 % Torchance bzw. Trefferquote, die Flanke halbiert zusätzlich das Konterrisiko.',
        tips: ['Jeder Standards-Tag fehlt Taktik, Technik oder Kondition', 'Der Livespiel-Freistoß zeigt, wie gut eine Variante einstudiert ist'] },
    { cat: 'Taktik', title: 'Schiedsrichter-Kritik', screen: 'screen-dashboard',
        text: 'Gab es im Livespiel strittige Szenen (Platzverweis, Elfmeter gegen dich, vom VAR aberkanntes Tor) und hast du nicht gewonnen, fragen nach dem Abpfiff die Reporter. Öffentliche Kritik: Fans +3, Medien −2, Geldstrafe nach Liga (jede weitere in der Saison verdoppelt sie), und der Schiedsrichter pfeift deine nächsten 2 Spiele unter ihm strenger. Schriftliche Beschwerde: Gebühr, 35 % Chance, dass ein Platzverweis zurückgenommen wird (ohne Rot nur Vorstand +1). Schweigen: Vorstand +2, Fans −1.',
        tips: ['Die Schiedsrichter-Vorschau auf dem Dashboard zeigt, wer noch verärgert ist', 'Gegen einen nachtragenden Schiedsrichter lieber vorsichtig in die Zweikämpfe'] },
    { cat: 'Taktik', title: 'Mannschaftsanweisungen', screen: 'screen-squad',
        text: 'Gegenpressing (+1,5 Stärke, +15 % Kraftverbrauch), hohe Außenverteidiger (+1, +8 %), Tief stehen (−0,5, −15 %; schließt die anderen aus).',
        tips: ['Bei vollem Spielplan Kraft sparen, in wichtigen Spielen draufgehen'] },
    { cat: 'Taktik', title: 'Kabinenansprache vor dem Anpfiff', screen: 'screen-dashboard',
        text: 'Im Spielvorbericht wählst du eine Ansprache: „Keine Überheblichkeit“ wirkt als Favorit (und bei ruhigen Spielern), „Nichts zu verlieren“ als Außenseiter - als Favorit schadet sie. „Heute zählt nur der Sieg“ beflügelt Ehrgeizige und Selbstbewusste, lässt Emotionale und Hitzköpfe verkrampfen; Sieg bringt danach Moral +3, Niederlage kostet Moral 4.',
        tips: ['Dreimal hintereinander dieselbe Rede wirkt nur noch halb', 'Die Charaktere der Startelf stehen im Vorbericht - auch die Halbzeit-Ansprache nutzt sie', 'Gilt im Livespiel und bei „Nur Ergebnis“, in Liga und Pokal'] },
    { cat: 'Taktik', title: 'Pressekonferenz', screen: 'screen-dashboard',
        text: 'Vor jedem Spiel: drei Antworten mit echter Wirkung (Moral, Stärke im nächsten Spiel, Vorstand, Fans). Versprechen werden nach dem Spiel abgerechnet.',
        tips: ['Wer einen Sieg verspricht und verliert, verliert Ansehen bei Medien, Fans und Vorstand'] },
    { cat: 'Verein', title: 'Vorstandszufriedenheit', screen: 'screen-dashboard',
        text: 'Wie zufrieden der Vorstand ist (0-100). Bleibt sie mehrere Spieltage unter 25, folgt erst eine Warnung, dann die Entlassung. In der ersten Saison gibt es Schonfrist.',
        tips: ['Siege und erreichte Saisonziele heben sie', 'Schulden, gebrochene Versprechen und Niederlagenserien senken sie', 'Der Vorstandsraum erklärt jedes Mitglied einzeln'] },
    { cat: 'Verein', title: 'Kabine, Cliquen & Kapitän', screen: 'screen-squad',
        text: 'Ein Mannschaftsrat: Kapitän plus die zwei Spieler mit der größten Führungsqualität (Leader-Eigenschaft, Alter, Erfahrung, Moral). Spieler gruppieren sich nach Nation und Alter; fällt die Stimmung einer Gruppe unter 40, rumort sie: Teamstärke sinkt, und jeden Monat färbt die Laune auf den Rest ab. Ein Kapitän mit Autorität (Moral ab 60) dämpft das.',
        tips: ['Wortführer melden sich beim Mannschaftsrat (anhören oder klare Ansage)', 'Unzufriedene Leistungsträger kommen ins Büro: Einsatzgarantie, Leistung einfordern oder Wechsel erlauben', 'Kapitän wechseln kostet den alten Kapitän Moral - einen Neuling ohne Standing nimmt der Rat übel'] },
    { cat: 'Verein', title: 'Fanstimmung', screen: 'screen-fans',
        text: 'Wie zufrieden die Anhänger sind (0-100). Beeinflusst Zuschauer, Fanartikel und Mitgliederzahlen.',
        tips: ['Mega-Choreo: +2 Stärke im nächsten Heimspiel', 'Sonderzug: +1,5 im nächsten Auswärtsspiel', 'Saisonziel bis Spieltag 6 setzen - Prämie bei Erfolg, Stimmungsverlust bei Misserfolg'] },
    { cat: 'Verein', title: 'Medienimage', screen: 'screen-dashboard',
        text: 'Ein Wert für dein Bild in der Öffentlichkeit. Beeinflusst Sponsoren und Jobangebote.',
        tips: ['Pressekonferenzen und Interviews wirken direkt darauf'] },
    { cat: 'Verein', title: 'Lizenzauflagen', screen: 'screen-stadium',
        text: 'Für den Aufstieg verlangt der Verband Mindeststandards: Oberliga 1.000 Plätze · Regionalliga 3.000 Plätze und 30.000 € Reserve · 3. Liga 6.000 Plätze, Flutlicht, 100.000 € · 2. Liga 10.000 Plätze, Internat Stufe 1, 250.000 € · 1. Liga 15.000 Plätze, Internat Stufe 2, 500.000 €. Fehlt etwas, gibt es 3 Spieltage Nachfrist, danach verfällt der Aufstieg.',
        tips: ['Die Übersicht steht im Stadion-Bildschirm, an Spieltag 30 warnt das Postfach', 'Das Internat in unteren Ligen bauen - dort kostet es einen Bruchteil', 'Rechtzeitig bauen - Baustellen brauchen einige Spieltage'] },
    { cat: 'Finanzen', title: 'Gehaltsbudget', screen: 'screen-finances',
        text: 'Höchstsumme aller Spielergehälter pro Spieltag. Neue Verträge über dem Budget sind nicht möglich.',
        tips: ['Verkäufe und auslaufende Verträge schaffen Luft', 'Im Gehaltsgespräch einmal nachverhandeln'] },
    { cat: 'Finanzen', title: 'Transferbudget', screen: 'screen-finances',
        text: 'Wie viel Ablöse der Vorstand freigibt. Unabhängig vom Kontostand: beides muss reichen.',
        tips: ['Verkäufe erhöhen es', 'Mit dem Vorstand lässt sich nachverhandeln'] },
    { cat: 'Finanzen', title: 'Financial Fairplay', screen: 'screen-finances',
        text: 'Über drei Saisons darf der Verein nur begrenzt Verlust machen (je nach Liga). Investitionen in Stadion, Gelände und Jugend zählen nicht. Bei Verstoß: Verwarnung, dann Transfersperre und Punktabzug.',
        tips: ['Das Buchungsjournal zeigt, wofür das Geld ausgegeben wird', 'Nicht verwechseln mit der Transfersperre bei negativem Kontostand'] },
    { cat: 'Finanzen', title: 'Negativer Kontostand', screen: 'screen-finances',
        text: 'Bleibt das Konto im Minus: nach 3 Spieltagen Warnung, nach 6 Transfersperre, alle 10 Spieltage ein Zwangsverkauf des wertvollsten Spielers.',
        tips: ['Rücklage und Ausgaben-Warnlimit helfen, rechtzeitig gegenzusteuern'] },
    { cat: 'Finanzen', title: 'Abstellungsprämien', screen: 'screen-squad',
        text: 'Für Nationalspieler zahlt der Verband 15.000 € je Spieler und Länderspielpause, bei WM/EM 10.000 bzw. 12.000 € je Spieler und Turniertag.',
        tips: ['Steht im Kontoauszug unter „Abstellungsprämien“'] },
    { cat: 'Finanzen', title: 'Sponsoren & Branchenkonflikt', screen: 'screen-sponsors',
        text: 'Hauptsponsor, Trikotärmel, Banden und Mannschaftsbus werden einzeln vergeben. Ist bereits ein Partner derselben Branche unter Vertrag, steht am Angebot „Branchenkonflikt mit …“: dann zahlt der neue Sponsor nur 70 % aller Beträge.',
        tips: ['Branchen mischen bringt mehr Geld als zwei Partner aus derselben Branche', 'Erfolge und Medienimage locken bessere Sponsoren an'] },
    { cat: 'Finanzen', title: 'Ticketpreise & Zuschauer', screen: 'screen-finances',
        text: 'Ticketerlöse sind neben den TV-Geldern die größte Einnahme. Die Zuschauerzahl hängt von Fanstimmung, Liga, Gegner und Stadionkomfort ab; hohe Preise bringen mehr pro Kopf, aber weniger Zuschauer und schlechtere Stimmung in der Kurve.',
        tips: ['In unteren Ligen begrenzt das Liga-Interesse die Zuschauer (6. Liga bis etwa 1.000) - ein größeres Stadion hilft dort nicht, Wetter, Form und Preis zählen trotzdem', 'Leere Ränge werden automatisch gesperrt und kosten weniger Unterhalt', 'Fressbuden und Toiletten erhöhen den Komfort und damit die Zuschauer'] },
    { cat: 'Transfers', title: 'Transferpoker', screen: 'screen-transfer',
        text: 'Jeder Marktspieler gehört einem KI-Verein mit Forderung und verdeckter Schmerzgrenze. Unter der Grenze gibt es keine Zusage, sehr niedrige Angebote kosten doppelt Geduld. Bei begehrten Spielern kann ein Rivale mitbieten und den Spieler wegschnappen.',
        tips: ['Sofortkauf zahlt die Forderung', 'Nach der Einigung folgt das Gehaltsgespräch'] },
    { cat: 'Transfers', title: 'Medizincheck', screen: 'screen-transfer',
        text: 'Jeder Spieler auf dem Transfermarkt hat einen verdeckten Befund: unauffällig, chronische Probleme (im Kader dauerhaft ×1,5 Verletzungsrisiko, 3-5 Verletzungen in der Akte) oder aktuell verletzt (fällt 2-5 Spiele aus). Ältere Spieler haben öfter chronische Probleme. Im Transferpoker kannst du nach der Ablöse-Einigung einen Medizincheck machen lassen: 3 % der Ablöse (mit Chef-Physio die Hälfte, mindestens 1.500 €). Findet er etwas, senkt der Verein die Ablöse (chronisch −20 %, verletzt −15 %) - oder du brichst ab.',
        tips: ['Der Sofortkauf ist blind - ein Befund zeigt sich erst nach der Unterschrift', 'Bei teuren und älteren Spielern lohnt sich der Check fast immer', 'Chronische Probleme erkennst du im Kader am 🩹'] },
    { cat: 'Transfers', title: 'Transferfenster', screen: 'screen-transfer',
        text: 'Sommer: Spieltage 1-3, Winter: Spieltage 18-20. Am letzten Tag (Deadline-Day) gibt es Schnäppchen und hektische Wechsel.',
        tips: ['Der Transfer-Ticker zeigt, wohin die Stars der anderen Vereine wechseln'] },
    { cat: 'Transfers', title: 'Vertragsgespräch', screen: 'screen-contracts',
        text: 'Verlängerungen sind Gehaltsgespräche: Stammspieler und Stars fordern mehr, ältere Spieler weniger. Zähe Charaktere lassen sich schwer drücken; nach zwei geplatzten Runden ist für die Saison Schluss.',
        tips: ['Eine Einsatzgarantie macht Spieler billiger - aber wird geprüft'] },
    { cat: 'Wettbewerbe', title: 'Auf- und Abstieg', screen: 'screen-league',
        text: 'Platz 1 und 2 steigen direkt auf, Platz 3 spielt Relegation gegen den 16. der Liga darüber. Platz 16 muss in die Relegation, Platz 17 und 18 steigen ab. Die Aufstiegsprämie richtet sich nach der neuen Liga: 150.000 € (Oberliga) bis 5 Mio. € (Bundesliga).',
        tips: ['Bei Gleichstand entscheiden Tordifferenz, dann erzielte Tore'] },
    { cat: 'Wettbewerbe', title: 'Saisonvorschau & Experten-Check', screen: 'screen-dashboard',
        text: 'Vor jeder Saison tippen die Experten die ganze Tabelle; dein Platz ist dieselbe Erwartung, an der dich Vorstand und Mitgliederversammlung messen. Am Saisonende zeigt der Rückblick Tipp gegen Wirklichkeit, Überraschung, Flop und den Spieler der Saison (beste Ø-Note, mindestens 10 Ligaspiele).',
        tips: ['3 Plätze besser als getippt: Medienimage +3, Fans +2', '4 Plätze schlechter: Medienimage -3', 'Alle Jahre stehen in Historie > Chronik'] },
    { cat: 'Wettbewerbe', title: 'Länderspielpausen & Turniere', screen: 'screen-squad',
        text: 'Pausen nach den Spieltagen 6, 13, 24 und 30. Nominiert wird, wer die Schwelle seines Landes erreicht. Nach jeder geraden Saison WM oder EM.',
        tips: ['Kein Ligaspiel fällt aus, aber die Reise kostet Fitness'] },
    { cat: 'Wettbewerbe', title: 'Derby-Woche', screen: 'screen-dashboard',
        text: 'Ab 3 Spieltagen vor dem Ligaspiel gegen den Erzrivalen erscheint die Derby-Woche: Choreo (Heim) bzw. Sonderzug (auswärts) bringt +1,5 Stärke, eine Kampfansage +1 - beides nur am Derby-Tag. Ein Derby zählt für die Fans doppelt: Sieg +2, Niederlage -2.',
        tips: ['Die Choreo erhöht das Ausschreitungsrisiko (Pyro) - das Sicherheitskonzept senkt es auf ein Drittel', 'Die Prämie hebt die Moral sofort um 5 und kostet nur bei Sieg (2 Spieltagsgehälter der Startelf) - eine Niederlage drückt die Moral um 4', 'Kampfansage: Sieg bringt Medien +3 und Fans +2, Niederlage kostet Medien, Fans und Vorstand'] },
    { cat: 'Wettbewerbe', title: 'Pokalfinale', screen: 'screen-dashboard',
        text: 'Steht dein Verein im Finale des DFB- oder Landespokals, beginnt drei Spieltage vorher die Finalwoche: Ticketkontingent an die Fans (weniger Geld, Fans +4, +1 Stärke) oder an Sponsoren (mehr Geld, Fans -2), Fan-Sonderzüge (+1,5 Stärke) und ein Kurztrainingslager (+1 Stärke). Nach einem Sieg wählst du die Titelfeier: Autokorso (kostet, Fans +6, Medienimage +3) oder Kabinenfeier (Moral +8).',
        tips: ['Die Vorbereitung wirkt nur im Endspiel, live wie simuliert', 'Alle Endspiele stehen in Historie > Titel'] },
    { cat: 'Wettbewerbe', title: 'Pokale', screen: 'screen-cup',
        text: 'Landespokal in den unteren Ligen, DFB-Pokal ab der 3. Liga, der Champions Cup für die Spitze. Eigene Pokalspiele laufen live.',
        tips: ['Pokaltore zählen nicht für die Ligastatistik und die Noten'] },
    { cat: 'Karriere', title: 'Erzfeind-Trainer', screen: 'screen-history',
        text: 'Dein Erzfeind ist eine Person, kein Verein: anfangs trainiert er den Erzrivalen, wird er entlassen oder spielt sein Klub woanders, übernimmt er meist einen Verein in deiner Liga. Verlierst du gegen ihn, spielt deine Elf das nächste Duell mit +1,5 Stärke (Revanche) - der Revanche-Sieg bringt Fans und Medien.',
        tips: ['Seine Persönlichkeit wirkt: Taktik-Fuchs kontert jeden ausrechenbaren Stil, Publikumsliebling ist zu Hause stärker, Aufsteiger-Talent wird jedes Jahr besser, Alte Schule kostet Fitness, Provokateur nach Siegen Moral', 'Einmal pro Saison will er einen unzufriedenen Stammspieler (125 % Marktwert) - Verkaufen ärgert die Fans, Ablehnen kostet den Spieler Moral', 'Bilanz und alle Duelle: Historie > Rivalen'] },
    { cat: 'Karriere', title: 'Jobangebote', screen: 'screen-dashboard',
        text: 'Erfolgreiche Manager bekommen Angebote von stärkeren Vereinen. Ein Wechsel nimmt Karriere und Trophäen mit, der Kader ist neu.',
        tips: ['Ein Angebot gilt 6 Spieltage', 'Man kann es auch als Druckmittel für den Vorstand nutzen'] },
    { cat: 'Karriere', title: 'Karriere-Szenarien', screen: 'screen-dashboard',
        text: 'Beim neuen Spiel wählbar: Absteiger retten, Pleiteklub sanieren, Traditionsverein zurückführen, Meister oder Chaos - mit Ziel, Frist und 1-3 Sternen.',
        tips: ['Danach geht die Karriere als freies Spiel weiter', 'Pleiteklub: Kredite zählen als Schulden, jeder Zwangsverkauf kostet einen Stern - zwei lassen die Sanierung scheitern'] },
    { cat: 'Bedienung', title: 'Bedienung mit einer Hand', screen: 'screen-dashboard',
        text: 'Auf dem Handy liegt alles Wichtige im Daumenbereich: der Knopf „▶ Spieltag“ startet von jedem Bildschirm den nächsten Spieltag, „☰ Menü“ in der unteren Leiste öffnet alle Bereiche, Fenster fahren von unten ein und im Livespiel bleiben Szene, Pause und Abpfiff über der Leiste stehen. Die Zurück-Taste schließt Meldungen, Fenster und Menü oder geht einen Bildschirm zurück - erst zweimal Zurück auf dem Startbildschirm verlässt das Spiel.',
        tips: ['Linkshänder: Menü → Einstellungen → „Weiter-Knopf“ nach links stellen (oder ausblenden)', 'Fenster mit ✕ schließen auch per Tipp auf die dunkle Fläche daneben', 'Sprache und Ton stehen auf dem Handy im Menü unter Einstellungen'] },
    { cat: 'Bedienung', title: 'Speichern', screen: 'screen-dashboard',
        text: 'Drei Speicher-Slots plus automatisches Speichern alle 5 Spieltage. Beim Start wird immer der zuletzt gespeicherte Stand geladen - ist er beschädigt, der nächstneuere heile. Jeder Stand wird vor dem Laden geprüft: kaputte Stände lassen das laufende Spiel unangetastet, kleine Schäden werden repariert. Vor dem Laden, dem Überschreiben eines Slots und einem neuen Spiel entsteht eine Sicherheitskopie.',
        tips: ['Wenn der Browser das Speichern blockiert, Spielstand als Datei exportieren', 'In der Dateivorschau mancher Handys geht Speichern nicht - im Browser öffnen', 'Der Füllstand steht unter den Speicherständen - ab 80 % warnt das Spiel, bei vollem Speicher weicht zuerst die Sicherheitskopie', 'Nur eine exportierte Datei übersteht das Leeren des Browserspeichers - das Spiel erinnert alle 3 Saisons daran'] }
];

let lexiconCategory = 'Alle';
let lexiconScreenFilter = null; // aus einem Bildschirm-Tipp geöffnet: nur Einträge zu diesem Bildschirm

function setLexiconCategory(cat) {
    lexiconCategory = cat;
    lexiconScreenFilter = null;
    renderLexicon();
}

function hasLexiconEntriesFor(screenId) {
    return LEXICON_ENTRIES.some(e => e.screen === screenId);
}

// Normaler Aufruf über das Menü (showScreen): immer das ganze Lexikon.
function showLexiconView() {
    lexiconScreenFilter = null;
    renderLexicon();
}

// Aus den Bildschirm-Tipps (js/onboarding.js): springt ins Lexikon, gefiltert auf diesen Bildschirm.
function openLexiconForScreen(screenId) {
    const input = document.getElementById('lexicon-search');
    if (input) input.value = '';
    lexiconCategory = 'Alle';
    showScreen('screen-lexicon');
    lexiconScreenFilter = hasLexiconEntriesFor(screenId) ? screenId : null;
    renderLexicon();
}

function renderLexicon() {
    const box = document.getElementById('lexicon-list');
    if (!box) return;
    const input = document.getElementById('lexicon-search');
    const suche = (input ? input.value : '').trim().toLowerCase();
    const kategorien = ['Alle', ...new Set(LEXICON_ENTRIES.map(e => e.cat))];
    const chips = document.getElementById('lexicon-categories');
    if (chips) chips.innerHTML = kategorien.map(k => `<button onclick="setLexiconCategory('${k}')" class="${k === lexiconCategory ? 'btn-action' : 'btn-secondary'}" style="width:auto; font-size:9px; padding:4px 8px;">${k}</button>`).join('');
    const filterHinweis = document.getElementById('lexicon-screen-filter');
    if (filterHinweis) filterHinweis.innerHTML = lexiconScreenFilter ? `<div class="box" style="font-size:10px; display:flex; justify-content:space-between; align-items:center; gap:6px;"><span>Nur Einträge zum Bildschirm, von dem du kommst.</span><button onclick="setLexiconCategory('Alle')" class="btn-secondary" style="width:auto; font-size:9px;">Alle zeigen</button></div>` : '';
    const treffer = LEXICON_ENTRIES.filter(e => (lexiconCategory === 'Alle' || e.cat === lexiconCategory)
        && (!lexiconScreenFilter || e.screen === lexiconScreenFilter)
        && (!suche || (e.title + ' ' + e.text + ' ' + e.tips.join(' ')).toLowerCase().includes(suche)));
    box.innerHTML = treffer.length ? treffer.map(e => `<div class="box" style="font-size:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <strong style="color:var(--accent);">${e.title}</strong><span style="font-size:8px; color:var(--text-muted);">${e.cat}</span>
        </div>
        <div style="margin-top:3px;">${e.text}</div>
        <ul style="margin:4px 0 0 0; padding-left:16px;">${e.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        <button onclick="showScreen('${e.screen}')" class="btn-secondary" style="width:auto; font-size:9px; margin-top:4px;">➜ Zum Bildschirm</button>
    </div>`).join('') : '<div style="font-size:10px; color:var(--text-muted);">Kein Eintrag gefunden. Anderen Begriff versuchen oder Kategorie „Alle“ wählen.</div>';
}
