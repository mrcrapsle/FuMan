
    // ==========================================
    // SPIELERPORTRÄTS: PROZEDURALE AVATARE (NEU)
    // ==========================================
    // Echte Fotos sind hier aus zwei Gründen keine Option: es gibt in dieser Umgebung kein
    // Bildgenerierungs-Werkzeug, UND der Kader entsteht komplett prozedural (Saisonstart,
    // Jugendförderung, Transfermarkt) - ein fester Bildersatz würde niemals alle jemals
    // erzeugten Spieler abdecken und würde die Ein-Datei-HTML-Größe massiv aufblähen.
    // Stattdessen erzeugt getPlayerAvatarSVG() für JEDEN Spieler ein eindeutiges, deterministisch
    // aus der Spieler-ID abgeleitetes Porträt (dieselbe seededRand()-Technik wie beim
    // kosmetischen 18er-Fähigkeitenraster in entities.js) - Hautton, Frisur, Bartwuchs und
    // Augenbrauen bleiben über die gesamte Karriere hinweg für denselben Spieler stabil.
    // Der Mundausdruck ist bewusst NICHT geseedet, sondern hängt live an der aktuellen Moral,
    // eine kleine Narbe erscheint bei häufig verletzten Spielern (p.timesInjured) - echte
    // Spieldaten fließen so sichtbar ins Porträt ein statt nur zufällig zu sein.

    const AVATAR_SKIN_TONES = ['#f4cba3', '#e8b48c', '#d49a6a', '#b97d4e', '#8a5a34', '#5c3a22'];
    const AVATAR_HAIR_COLORS = ['#1b1b1b', '#3b2412', '#6b4226', '#a9793f'];
    const AVATAR_HAIR_GREY = ['#9a9a9a', '#c7c7c7'];
    const AVATAR_HAIR_STYLES = ['buzz', 'short', 'side', 'curly', 'mohawk', 'long'];
    const AVATAR_POS_BG = { TW: '#2563eb', ABW: '#16a34a', MIT: '#d97706', ST: '#dc2626' };

    function pickSeeded(arr, seed, salt) {
        return arr[Math.floor(seededRand(seed, salt) * arr.length) % arr.length];
    }

    // Baut die Haar-Silhouette abhängig vom gewählten Stil - alle Pfade auf ein 100x100-Raster
    // abgestimmt, damit sie zum Kopf (Ellipse cx=50 cy=56 r=25) passen.
    function buildAvatarHairPath(style, color) {
        switch (style) {
            case 'buzz':
                return `<path d="M 26 46 Q 26 24 50 22 Q 74 24 74 46 Q 74 36 50 34 Q 26 36 26 46 Z" fill="${color}"/>`;
            case 'short':
                return `<path d="M 24 50 Q 22 20 50 18 Q 78 20 76 50 Q 76 32 62 28 Q 68 40 60 34 Q 50 26 40 34 Q 32 40 38 28 Q 24 32 24 50 Z" fill="${color}"/>`;
            case 'side':
                return `<path d="M 25 48 Q 24 18 52 17 Q 79 19 75 48 Q 75 30 50 27 L 30 32 Q 25 36 25 48 Z" fill="${color}"/>`;
            case 'curly':
                return `<g fill="${color}">
                    <circle cx="32" cy="32" r="7"/><circle cx="42" cy="24" r="8"/><circle cx="54" cy="21" r="8"/>
                    <circle cx="66" cy="26" r="7.5"/><circle cx="74" cy="37" r="6.5"/><circle cx="27" cy="42" r="6"/>
                </g>`;
            case 'mohawk':
                return `<path d="M 44 14 Q 50 10 56 14 L 58 40 Q 50 44 42 40 Z" fill="${color}"/>`;
            case 'long':
                return `<path d="M 22 58 Q 20 18 50 16 Q 80 18 78 58 L 70 58 Q 74 34 60 26 Q 66 40 58 32 Q 50 24 42 32 Q 34 40 40 26 Q 26 34 30 58 Z" fill="${color}"/>`;
            default:
                return '';
        }
    }

    function buildAvatarFacialHairPath(type, color) {
        switch (type) {
            case 'stubble':
                return `<path d="M 34 62 Q 50 76 66 62 Q 66 72 50 78 Q 34 72 34 62 Z" fill="${color}" opacity="0.28"/>`;
            case 'mustache':
                return `<path d="M 38 63 Q 44 60 50 63 Q 56 60 62 63 Q 58 67 50 65 Q 42 67 38 63 Z" fill="${color}"/>`;
            case 'goatee':
                return `<g>
                    <path d="M 38 63 Q 44 60 50 63 Q 56 60 62 63 Q 58 67 50 65 Q 42 67 38 63 Z" fill="${color}"/>
                    <path d="M 42 68 Q 50 80 58 68 Q 58 76 50 79 Q 42 76 42 68 Z" fill="${color}"/>
                </g>`;
            case 'fullbeard':
                return `<path d="M 30 58 Q 30 78 50 82 Q 70 78 70 58 Q 70 70 60 72 Q 62 65 56 68 Q 58 62 50 65 Q 42 62 44 68 Q 38 65 40 72 Q 30 70 30 58 Z" fill="${color}"/>`;
            default:
                return '';
        }
    }

    // Zentrale Merkmalsermittlung - getrennt von der eigentlichen SVG-Ausgabe, damit sowohl
    // das Porträt als auch (bei Bedarf) andere Stellen dieselben, konsistenten Merkmale eines
    // Spielers abfragen können, ohne die Zeichenlogik zu duplizieren.
    function getAvatarTraits(p) {
        let seed = (p && p.id) || 'unbekannt';
        let age = (p && p.age) || 24;
        let skin = pickSeeded(AVATAR_SKIN_TONES, seed, 'skin');
        // Ältere Spieler haben eine spürbar erhöhte Glatzen-/Grauhaar-Chance statt komplett
        // zufällig verteilt zu sein - ein alterstypischer, plausibler Touch.
        let baldChance = Math.max(0, (age - 29) * 0.028);
        let isBald = seededRand(seed, 'baldcheck') < baldChance;
        let hairStyle = isBald ? 'bald' : pickSeeded(AVATAR_HAIR_STYLES, seed, 'hairstyle');
        let greyChance = Math.max(0, (age - 27) * 0.035);
        let hairColor = seededRand(seed, 'greycheck') < greyChance
            ? pickSeeded(AVATAR_HAIR_GREY, seed, 'greytone')
            : pickSeeded(AVATAR_HAIR_COLORS, seed, 'haircolor');
        // Bartwahl: jüngere Spieler überwiegend bartlos, ältere häufiger Vollbart - über
        // altersabhängige Gewichtungslisten statt einer festen Gleichverteilung.
        let beardOptions = age < 21 ? ['none', 'none', 'none', 'stubble']
            : age < 28 ? ['none', 'stubble', 'stubble', 'mustache', 'goatee']
            : ['stubble', 'goatee', 'fullbeard', 'fullbeard', 'mustache', 'none'];
        let facialHair = pickSeeded(beardOptions, seed, 'beard');
        let angryBrows = p && p.character === 'Hitzköpfig';
        let headband = !!(p && p.character === 'Selbstbewusst' && seededRand(seed, 'headband') < 0.4);
        let scar = !!(p && (p.timesInjured || 0) >= 3 && seededRand(seed, 'scar') < 0.65);
        return { skin, hairStyle, hairColor, facialHair, angryBrows, headband, scar };
    }

    // Erzeugt das komplette Porträt als Inline-SVG-String (crisp bei jeder Größe, keine
    // separate Bilddatei nötig). size gibt die Kantenlänge in Pixel für Breite/Höhe vor, das
    // interne Raster bleibt immer 100x100.
    function getPlayerAvatarSVG(p, size = 56) {
        if (!p) return '';
        let t = getAvatarTraits(p);
        let posBg = AVATAR_POS_BG[p.pos] || '#64748b';
        let morale = p.morale ?? 80;
        // Mundausdruck bewusst NICHT geseedet, sondern live an die aktuelle Stimmung des
        // Spielers gekoppelt - dasselbe Porträt wirkt je nach Moral sichtbar anders.
        let mouth = morale >= 65
            ? '<path d="M 37 68 Q 50 77 63 68" stroke="#3a2418" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
            : (morale <= 32
                ? '<path d="M 37 73 Q 50 65 63 73" stroke="#3a2418" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
                : '<line x1="40" y1="70" x2="60" y2="70" stroke="#3a2418" stroke-width="2.4" stroke-linecap="round"/>');
        let browY = t.angryBrows ? 44 : 42;
        let browTilt = t.angryBrows ? 4 : 0;
        let eyebrows = `
            <path d="M 34 ${browY + browTilt} Q 40 ${browY - browTilt} 46 ${browY}" stroke="#3a2418" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M 54 ${browY} Q 60 ${browY - browTilt} 66 ${browY + browTilt}" stroke="#3a2418" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
        let scarMark = t.scar ? '<line x1="63" y1="48" x2="60" y2="58" stroke="#b3564a" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>' : '';
        let headbandMark = t.headband
            ? `<path d="M 25 40 Q 50 30 75 40 L 75 45 Q 50 36 25 45 Z" fill="${pickSeeded(['#dc2626', '#2563eb', '#16a34a', '#f59e0b'], p.id, 'headbandcolor')}"/>`
            : '';
        let hairMarkup = t.hairStyle === 'bald' ? '' : buildAvatarHairPath(t.hairStyle, t.hairColor);
        let facialHairMarkup = buildAvatarFacialHairPath(t.facialHair, t.hairColor);

        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <defs><clipPath id="avaclip-${p.id}"><circle cx="50" cy="50" r="49"/></clipPath></defs>
            <g clip-path="url(#avaclip-${p.id})">
                <circle cx="50" cy="50" r="50" fill="${posBg}" opacity="0.16"/>
                <ellipse cx="50" cy="88" rx="26" ry="18" fill="${t.skin}"/>
                <ellipse cx="27" cy="58" rx="4.5" ry="6" fill="${t.skin}"/>
                <ellipse cx="73" cy="58" rx="4.5" ry="6" fill="${t.skin}"/>
                <ellipse cx="50" cy="56" rx="25" ry="26" fill="${t.skin}"/>
                ${facialHairMarkup}
                <ellipse cx="40" cy="55" rx="4.2" ry="3" fill="#fff"/>
                <ellipse cx="60" cy="55" rx="4.2" ry="3" fill="#fff"/>
                <circle cx="${40 + (seededRand(p.id, 'eyedir') * 2 - 1)}" cy="55" r="1.7" fill="#241a12"/>
                <circle cx="${60 + (seededRand(p.id, 'eyedir') * 2 - 1)}" cy="55" r="1.7" fill="#241a12"/>
                ${eyebrows}
                <path d="M 49 58 Q 47 63 49 65 L 51 65" stroke="#00000022" stroke-width="1.3" fill="none" stroke-linecap="round"/>
                ${mouth}
                ${scarMark}
                ${hairMarkup}
                ${headbandMark}
            </g>
        </svg>`;
    }

    // Kleiner Wrapper mit rundem Rahmen für Listenzeilen (Kader, Transfermarkt, Jugend, etc.) -
    // damit an jeder Einbindungsstelle dieselbe Größe/Optik entsteht statt vieler leicht
    // abweichender Inline-Styles.
    function renderPlayerAvatarTag(p, size = 40) {
        return `<span class="player-avatar" style="display:inline-flex; width:${size}px; height:${size}px; border-radius:50%; overflow:hidden; flex-shrink:0; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);">${getPlayerAvatarSVG(p, size)}</span>`;
    }
