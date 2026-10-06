/* eslint-disable no-undef */
// Phase 23.8: Set-Piece-Spezialisten
// Spieler mit besonderen Fähigkeiten bei Standards verbessern die Chancen
// Ecken, Freistöße, Elfmeter trainierbar und entwickelbar

function ensureSetPieceSpecialists() {
    if (!game.setPieceSpecialists) {
        game.setPieceSpecialists = {
            cornerKickers: [],
            freeKickTakers: [],
            penaltyTakers: [],
            setpieceStats: {}
        };
    }

    // Initialisiere jeden Spieler mit Set-Piece-Werten
    squad.forEach(p => {
        if (!p.setpieceSkills) {
            p.setpieceSkills = {
                cornerQuality: Math.random() * 30 + 40,  // 40-70
                freeKickQuality: Math.random() * 30 + 40,
                penaltyQuality: Math.random() * 40 + 50, // 50-90 (wichtiger)
                cornerTraining: 0,
                freeKickTraining: 0,
                penaltyTraining: 0
            };
        }
    });
}

// Findet den besten Eckenschützen im Kader
function getBestCornerKicker() {
    ensureSetPieceSpecialists();
    let available = squad.filter(p => !p.injured && !p.suspended);
    if (available.length === 0) return null;

    let best = available.reduce((a, b) => {
        let aScore = (a.setpieceSkills?.cornerQuality || 50) + (a.setpieceSkills?.cornerTraining || 0) * 0.5;
        let bScore = (b.setpieceSkills?.cornerQuality || 50) + (b.setpieceSkills?.cornerTraining || 0) * 0.5;
        return aScore > bScore ? a : b;
    });

    return best;
}

// Findet den besten Freistoßschützen
function getBestFreeKickTaker() {
    ensureSetPieceSpecialists();
    let available = squad.filter(p => !p.injured && !p.suspended);
    if (available.length === 0) return null;

    let best = available.reduce((a, b) => {
        let aScore = (a.setpieceSkills?.freeKickQuality || 50) + (a.setpieceSkills?.freeKickTraining || 0) * 0.5;
        let bScore = (b.setpieceSkills?.freeKickQuality || 50) + (b.setpieceSkills?.freeKickTraining || 0) * 0.5;
        return aScore > bScore ? a : b;
    });

    return best;
}

// Findet den besten Elfmeterschützen
function getBestPenaltyTaker() {
    ensureSetPieceSpecialists();
    let available = squad.filter(p => !p.injured && !p.suspended && p.pos === 'ST');
    if (available.length === 0) available = squad.filter(p => !p.injured && !p.suspended);
    if (available.length === 0) return null;

    let best = available.reduce((a, b) => {
        let aScore = (a.setpieceSkills?.penaltyQuality || 50) + (a.setpieceSkills?.penaltyTraining || 0) * 0.5;
        let bScore = (b.setpieceSkills?.penaltyQuality || 50) + (b.setpieceSkills?.penaltyTraining || 0) * 0.5;
        return aScore > bScore ? a : b;
    });

    return best;
}

// Trainiert einen Spieler in einem Set-Piece-Bereich
function trainSetPieceSkill(playerId, skillType) {
    let p = squad.find(pl => pl.id === playerId);
    if (!p || !p.setpieceSkills) return false;

    // Training kostet Fitness
    if (p.fitness < 15) {
        showToast('⚠️ Spieler zu müde für Set-Piece-Training', 'warning');
        return false;
    }

    p.fitness = Math.max(0, p.fitness - 10);

    if (skillType === 'corner') {
        p.setpieceSkills.cornerTraining = Math.min(100, p.setpieceSkills.cornerTraining + 5);
        p.setpieceSkills.cornerQuality = Math.min(99, p.setpieceSkills.cornerQuality + 0.5);
    } else if (skillType === 'freekick') {
        p.setpieceSkills.freeKickTraining = Math.min(100, p.setpieceSkills.freeKickTraining + 5);
        p.setpieceSkills.freeKickQuality = Math.min(99, p.setpieceSkills.freeKickQuality + 0.5);
    } else if (skillType === 'penalty') {
        p.setpieceSkills.penaltyTraining = Math.min(100, p.setpieceSkills.penaltyTraining + 5);
        p.setpieceSkills.penaltyQuality = Math.min(99, p.setpieceSkills.penaltyQuality + 0.8);
    }

    return true;
}

// Berechnet Set-Piece-Bonus für Chancen-Verbesserung
function getSetPieceBonus(skillType, playerQuality = 50) {
    // Gute Set-Piece-Spieler erhöhen die Chancen um bis zu 15%
    let bonus = (playerQuality - 50) * 0.3;
    return Math.max(-10, Math.min(15, bonus));
}

// Generiert Set-Piece-Szenen mit besseren Chancen durch Spezialisten
function generateSetPieceScene(type, shooter = null) {
    ensureSetPieceSpecialists();

    let quality = 50;
    let shooterName = 'Unbekannt';

    if (type === 'corner') {
        let kicker = shooter || getBestCornerKicker();
        if (kicker) {
            quality = kicker.setpieceSkills.cornerQuality + (kicker.setpieceSkills.cornerTraining / 20);
            shooterName = kicker.name;
        }
    } else if (type === 'freekick') {
        let taker = shooter || getBestFreeKickTaker();
        if (taker) {
            quality = taker.setpieceSkills.freeKickQuality + (taker.setpieceSkills.freeKickTraining / 20);
            shooterName = taker.name;
        }
    } else if (type === 'penalty') {
        let taker = shooter || getBestPenaltyTaker();
        if (taker) {
            quality = taker.setpieceSkills.penaltyQuality + (taker.setpieceSkills.penaltyTraining / 20);
            shooterName = taker.name;
        }
    }

    return {
        type: type,
        quality: quality,
        shooter: shooterName,
        bonus: getSetPieceBonus(type, quality),
        successChance: 40 + (quality - 50) * 0.8 + getSetPieceBonus(type, quality) * 2
    };
}

// Trainiert Set-Piece-Spiele monatlich
function tickSetPieceMonthlyDevelopment() {
    ensureSetPieceSpecialists();

    // Passive Entwicklung: Training trägt Früchte
    squad.forEach(p => {
        if (!p.setpieceSkills) return;

        // Abklingen lassen wenn nicht trainiert
        p.setpieceSkills.cornerTraining = Math.max(0, p.setpieceSkills.cornerTraining - 2);
        p.setpieceSkills.freeKickTraining = Math.max(0, p.setpieceSkills.freeKickTraining - 2);
        p.setpieceSkills.penaltyTraining = Math.max(0, p.setpieceSkills.penaltyTraining - 2);

        // Kleine zufällige Verbesserung bei viel Training
        if (p.setpieceSkills.cornerTraining > 50 && Math.random() < 0.1) {
            p.setpieceSkills.cornerQuality = Math.min(99, p.setpieceSkills.cornerQuality + 0.3);
        }
        if (p.setpieceSkills.freeKickTraining > 50 && Math.random() < 0.1) {
            p.setpieceSkills.freeKickQuality = Math.min(99, p.setpieceSkills.freeKickQuality + 0.3);
        }
        if (p.setpieceSkills.penaltyTraining > 50 && Math.random() < 0.1) {
            p.setpieceSkills.penaltyQuality = Math.min(99, p.setpieceSkills.penaltyQuality + 0.3);
        }
    });
}

// Rendert das Set-Piece-Panel
function renderSetPieceSpecialistsPanel() {
    ensureSetPieceSpecialists();
    let box = document.getElementById('setpiece-specialists-box');
    if (!box) return;

    let cornerKicker = getBestCornerKicker();
    let freeKickTaker = getBestFreeKickTaker();
    let penaltyTaker = getBestPenaltyTaker();

    let html = `
        <div style="font-size:9px; margin-bottom:6px; color:var(--text-muted);">
            Die besten Set-Piece-Spezialisten:
        </div>
    `;

    // Eckenschütze
    if (cornerKicker) {
        let quality = cornerKicker.setpieceSkills.cornerQuality;
        let training = cornerKicker.setpieceSkills.cornerTraining;
        let bonus = getSetPieceBonus('corner', quality);
        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="font-weight:bold; margin-bottom:2px;">🔄 Ecken</div>
                <div style="font-size:8px; margin-bottom:2px;">${cornerKicker.name}</div>
                <div style="font-size:8px; color:var(--text-muted);">
                    Qualität: <strong>${Math.round(quality)}</strong> | Training: <strong>${Math.round(training)}</strong>
                </div>
                <div style="font-size:8px; color:${bonus > 0 ? 'var(--green)' : 'var(--text-muted)'};">
                    ${bonus > 0 ? '+' : ''}${bonus.toFixed(1)}% Chancen-Bonus
                </div>
            </div>
        `;
    }

    // Freistoßschütze
    if (freeKickTaker) {
        let quality = freeKickTaker.setpieceSkills.freeKickQuality;
        let training = freeKickTaker.setpieceSkills.freeKickTraining;
        let bonus = getSetPieceBonus('freekick', quality);
        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="font-weight:bold; margin-bottom:2px;">⚡ Freistöße</div>
                <div style="font-size:8px; margin-bottom:2px;">${freeKickTaker.name}</div>
                <div style="font-size:8px; color:var(--text-muted);">
                    Qualität: <strong>${Math.round(quality)}</strong> | Training: <strong>${Math.round(training)}</strong>
                </div>
                <div style="font-size:8px; color:${bonus > 0 ? 'var(--green)' : 'var(--text-muted)'};">
                    ${bonus > 0 ? '+' : ''}${bonus.toFixed(1)}% Chancen-Bonus
                </div>
            </div>
        `;
    }

    // Elfmeterschütze
    if (penaltyTaker) {
        let quality = penaltyTaker.setpieceSkills.penaltyQuality;
        let training = penaltyTaker.setpieceSkills.penaltyTraining;
        let bonus = getSetPieceBonus('penalty', quality);
        html += `
            <div style="background:rgba(100,150,200,0.1); padding:6px; border-radius:4px; margin-bottom:4px;">
                <div style="font-weight:bold; margin-bottom:2px;">🎯 Elfmeter</div>
                <div style="font-size:8px; margin-bottom:2px;">${penaltyTaker.name}</div>
                <div style="font-size:8px; color:var(--text-muted);">
                    Qualität: <strong>${Math.round(quality)}</strong> | Training: <strong>${Math.round(training)}</strong>
                </div>
                <div style="font-size:8px; color:${bonus > 0 ? 'var(--green)' : 'var(--text-muted)'};">
                    ${bonus > 0 ? '+' : ''}${bonus.toFixed(1)}% Erfolgs-Bonus
                </div>
            </div>
        `;
    }

    html += `
        <div style="font-size:8px; color:var(--text-muted); margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
            💡 Training: Wähle Spieler im Kader und trainiere ihre Set-Piece-Fähigkeiten (kostet Fitness)
        </div>
    `;

    box.innerHTML = html;
}
