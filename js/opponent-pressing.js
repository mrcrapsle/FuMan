/* eslint-disable no-undef */
// Phase 23.12: Gegner-Pressing-Analyse
// Erkenne die Pressing-Intensität und empfehle Gegentaktiken

function ensureOpponentPressing() {
    if (!game.opponentPressing) {
        game.opponentPressing = {};
    }
}

function estimateOpponentPressingIntensity(oppTeam) {
    // Analyse des Gegnervereins basierend auf verfügbaren Daten
    if (!oppTeam) return 50;

    let intensity = 50;

    if (oppTeam.strength >= 80) intensity = 75;
    else if (oppTeam.strength >= 70) intensity = 65;
    else if (oppTeam.strength >= 60) intensity = 55;
    else intensity = 45;

    // Varianz hinzufügen (Gegner spielen nicht immer gleich)
    intensity += (Math.random() - 0.5) * 10;

    return Math.max(30, Math.min(90, intensity));
}

function getPressingCounterTactic(pressingIntensity) {
    // Empfehle Gegentaktiken basierend auf Pressing-Intensität
    if (pressingIntensity >= 75) {
        return {
            name: 'Direktspiel',
            desc: 'Spielen über lange Pässe, Pressing umgehen',
            bonus: 1.5,
            recommendation: 'Nutze deine Stürmer!'
        };
    } else if (pressingIntensity >= 60) {
        return {
            name: 'Kurzes Spiel',
            desc: 'Schnelle Kurz-Pässe zum Aufbau',
            bonus: 1.2,
            recommendation: 'Nutze Ballkontrolle!'
        };
    } else if (pressingIntensity >= 45) {
        return {
            name: 'Ballbesitz',
            desc: 'Kontrolliere das Spiel mit Ballbesitz',
            bonus: 1.1,
            recommendation: 'Guter Mix!'
        };
    } else {
        return {
            name: 'Offensiv spielen',
            desc: 'Der Gegner drückt nicht – nutze das!',
            bonus: 0.8,
            recommendation: 'Aggressive Spielweise!'
        };
    }
}

function getOpponentPressingData(oppName) {
    ensureOpponentPressing();
    let key = oppName;

    if (!game.opponentPressing[key]) {
        game.opponentPressing[key] = {
            lastAnalyzed: game.matchday,
            intensity: 0,
            matches: 0,
            avgIntensity: 50
        };
    }

    return game.opponentPressing[key];
}

function recordOpponentPressingFromMatch(oppName, actualIntensity) {
    let data = getOpponentPressingData(oppName);
    data.matches += 1;
    data.avgIntensity = (data.avgIntensity * (data.matches - 1) + actualIntensity) / data.matches;
    data.lastAnalyzed = game.matchday;
}

function getOpponentPressingBonus(pressingIntensity, myTactic) {
    // Bonus hängt ab vom gewählten Gegentaktik-System
    // Wenn die tatsächliche Taktik zur Empfehlung passt, gibt es einen Bonus
    let matchBonus = 0;

    // Generischer Bonus: je besser die Anpassung, desto höher
    if (pressingIntensity >= 75) {
        matchBonus = 0.5; // 0,5% Stärkebonus
    } else if (pressingIntensity >= 60) {
        matchBonus = 0.3;
    }

    return matchBonus;
}

function renderOpponentPressingPanel() {
    ensureOpponentPressing();
    let box = document.getElementById('opponent-pressing-box');
    if (!box) return;

    let match = getUpcomingMatch();
    if (!match) {
        box.innerHTML = '<div style="color:var(--text-muted); font-size:10px; padding:8px;">Kein bevorstehender Match.</div>';
        return;
    }

    let oppTeam = getTeamByName(match.away === game.clubName ? match.home : match.away);
    let pressingIntensity = estimateOpponentPressingIntensity(oppTeam);
    let pressingData = getOpponentPressingData(match.away === game.clubName ? match.home : match.away);
    let counterTactic = getPressingCounterTactic(pressingIntensity);

    let html = `
        <div style="background:rgba(100,150,200,0.1); padding:8px; border-radius:4px; margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:4px;">Gegner: ${match.away === game.clubName ? match.home : match.away}</div>
            <div style="font-size:10px; margin-bottom:8px;">
                <div>Geschätzte Pressing-Intensität: <strong>${Math.round(pressingIntensity)}/100</strong></div>
                <div style="background:rgba(0,0,0,0.3); height:8px; border-radius:4px; margin:4px 0; overflow:hidden;">
                    <div style="background:linear-gradient(90deg, var(--accent), var(--primary)); width:${pressingIntensity}%; height:100%;"></div>
                </div>
                ${pressingData.matches > 0 ? `<div style="color:var(--text-muted); font-size:9px;">Basierend auf ${pressingData.matches} vorherigen Spielen (Durchschnitt: ${Math.round(pressingData.avgIntensity)})</div>` : ''}
            </div>
        </div>

        <div style="background:linear-gradient(135deg, rgba(76,175,80,0.2), rgba(76,175,80,0.05)); padding:8px; border-radius:4px; border-left:3px solid var(--primary); margin-bottom:8px;">
            <div style="font-weight:bold; margin-bottom:4px;">💡 Empfohlene Gegentaktik:</div>
            <div style="font-size:10px; font-weight:bold; color:var(--accent); margin-bottom:4px;">${counterTactic.name}</div>
            <div style="font-size:9px; margin-bottom:4px;">${counterTactic.desc}</div>
            <div style="font-size:9px; background:rgba(255,255,255,0.1); padding:4px; border-radius:3px; color:var(--text-muted);">
                "${counterTactic.recommendation}"
            </div>
            <div style="font-size:8px; color:var(--accent); margin-top:4px;">Potentieller Bonus: +${(counterTactic.bonus * 0.1).toFixed(1)}% Stärke</div>
        </div>

        <div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; font-size:9px;">
            <strong>Pressing-Intensität erklärt:</strong>
            <div style="margin-top:4px; font-size:8px; line-height:1.4;">
                🔴 75+: Aggressive Gegner (hohes Pressing) → Direktspiel nutzen<br>
                🟠 60-75: Moderates Pressing → Kurzes Spiel empfohlen<br>
                🟡 45-60: Defensiv organisiert → Ballbesitz-Strategie<br>
                🟢 &lt;45: Passiv → Aggressiv angreifen!
            </div>
        </div>
    `;

    box.innerHTML = html;
}

function getUpcomingMatch() {
    // Gibt die nächste Ligabegegnung zurück
    if (!leaguesData || !leaguesData[game.leagueLevel]) return null;
    let league = leaguesData[game.leagueLevel];
    let fixtures = league.fixtures || [];
    let upcoming = fixtures.find(f => f.matchday >= game.matchday && (f.home === game.clubName || f.away === game.clubName));
    return upcoming;
}
