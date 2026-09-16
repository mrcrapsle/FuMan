
    // ---------- WETTER ---------- (aus match.js ausgelagert - reine Datei-Organisation,
    // keine Verhaltensänderung)
    // Wird zu Beginn JEDES Spieltags gewürfelt - unabhängig davon, ob live gespielt,
    // die Saison durchsimuliert oder per Admin vorgespult wird (siehe rollWeather()-Aufrufe
    // in setupMatch(), simulateFullSeason() und adminAdvanceMatchdays()), damit die Effekte
    // auf Ausdauer/Verletzungen in processPostMatchRoutine() unabhängig vom gewählten Modus
    // konsistent greifen.
    const WEATHER_TYPES = [
        { name: 'Sonnig', icon: '☀️', weight: 35, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0 },
        { name: 'Bewölkt', icon: '☁️', weight: 30, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0 },
        { name: 'Regen', icon: '🌧️', weight: 18, fitLossMult: 1.05, injuryMult: 1.15, cardMult: 1.15, goalMult: 0.95, attendanceMult: 0.93 },
        { name: 'Schnee', icon: '❄️', weight: 7, fitLossMult: 1.1, injuryMult: 1.2, cardMult: 1.2, goalMult: 0.85, attendanceMult: 0.88 },
        { name: 'Hitze', icon: '🥵', weight: 10, fitLossMult: 1.25, injuryMult: 1.05, cardMult: 1.0, goalMult: 1.0, attendanceMult: 0.96 },
        { name: 'Sturm', icon: '🌪️', weight: 3, fitLossMult: 1.3, injuryMult: 1.35, cardMult: 1.1, goalMult: 0.8, attendanceMult: 0.7, isStorm: true }
    ];

    let currentWeather = WEATHER_TYPES[0];

    function rollWeather() {
        // Wettergarantie (Premium-Booster, NEU): erzwingt sonniges Wetter (erster, neutraler
        // Eintrag in WEATHER_TYPES) statt der normalen Zufallsauswahl.
        if (game.weatherGuaranteeNextMatch) {
            currentWeather = WEATHER_TYPES[0];
            game.weatherGuaranteeNextMatch = false;
            return currentWeather;
        }
        let totalWeight = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0);
        let roll = Math.random() * totalWeight;
        for (let w of WEATHER_TYPES) {
            if (roll < w.weight) {
                currentWeather = w;
                // Rasenheizung (NEU, Bugfix): hatte bisher außer einem kleinen Stadionwert-
                // Bonus KEINERLEI Spielwirkung - dabei ist die Neutralisierung von
                // Schnee/Frost-Nachteilen genau ihr realer Zweck. Bei installierter
                // Rasenheizung bleibt der Platz bei Schnee bespielbar wie bei normalem Wetter.
                if (w.name === 'Schnee' && typeof stadium !== 'undefined' && stadium.rasenheizung) {
                    currentWeather = { ...w, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0, neutralizedBySnow: true };
                    addInboxMessage('vertrag', '❄️ Schnee, aber der Rasen bleibt bespielbar!', 'Dank der Rasenheizung sind die Auswirkungen des Schneefalls komplett neutralisiert - der Platz ist in bestem Zustand.', 'screen-calendar');
                }
                // Stadiondach (NEU, Bugfix): hatte bisher außer einem visuellen Overlay und
                // etwas Stadionwert KEINERLEI Spielwirkung - ein überdachtes Stadion sollte
                // aber logischerweise gegen Regen und Sturm unempfindlich sein.
                if ((w.name === 'Regen' || w.isStorm) && typeof stadium !== 'undefined' && stadium.dach) {
                    currentWeather = { ...w, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0, neutralizedByRoof: true };
                    addInboxMessage('vertrag', `${w.icon} ${w.name}, aber das Dach hält dicht!`, `Dank der Komplett-Überdachung bleibt das Stadion von den Auswirkungen des ${w.name.toLowerCase()}s komplett verschont.`, 'screen-calendar');
                }
                // Klimaanlage (NEU, Stadion-Erweiterung): neutralisiert Hitze-Wetter komplett.
                if (w.name === 'Hitze' && typeof stadium !== 'undefined' && stadium.upgrades?.klimaanlage) {
                    currentWeather = { ...w, fitLossMult: 1.0, injuryMult: 1.0, cardMult: 1.0, goalMult: 1.0, attendanceMult: 1.0, neutralizedByAC: true };
                    addInboxMessage('vertrag', `${w.icon} Hitze, aber die Klimaanlage hält kühl!`, 'Dank der Klimaanlage sind alle negativen Auswirkungen der Hitzewelle neutralisiert.', 'screen-calendar');
                }
                // Sturm-Warnung (NEU): dramatische Vorwarnung statt einer echten
                // Spielverlegung (die den Spielplan strukturell gefährden würde) - viele
                // Fans bleiben aus Sorge vor einer Absage zu Hause (siehe attendanceMult).
                if (w.isStorm) addInboxMessage('vertrag', '🌪️ Sturmwarnung vor dem nächsten Spiel!', 'Der Deutsche Wetterdienst warnt vor Sturmböen - das Spiel findet trotzdem statt, aber viele Fans dürften der Warnung folgen und zu Hause bleiben.', 'screen-calendar');
                return currentWeather;
            }
            roll -= w.weight;
        }
        currentWeather = WEATHER_TYPES[0];
        return currentWeather;
    }
