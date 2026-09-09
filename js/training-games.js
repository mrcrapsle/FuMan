// ==========================================
// TRAINING-MINISPIELE (Elfmeterschießen & Flankentraining)
// ==========================================
// Beide Minispiele trainieren echte Spielerwerte (shooting/passing), die zuvor nur
// kosmetisch angezeigt wurden. Begrenzt auf wenige Einheiten pro Spieltag, damit
// kein unbegrenztes "Grinding" der Werte möglich ist.

const MAX_TRAINING_SESSIONS_PER_MATCHDAY = 2;

function ensureTrainingSessionsReset() {
    if (game.lastTrainingMatchday !== game.matchday) {
        game.lastTrainingMatchday = game.matchday;
        game.trainingPlaysToday = 0;
    }
}

function trainingSessionsLeft() {
    ensureTrainingSessionsReset();
    return Math.max(0, MAX_TRAINING_SESSIONS_PER_MATCHDAY - (game.trainingPlaysToday || 0));
}

function consumeTrainingSession() {
    ensureTrainingSessionsReset();
    game.trainingPlaysToday = (game.trainingPlaysToday || 0) + 1;
}

// ---------- ELFMETERSCHIESSEN ----------
let penaltyGameState = null;

function openPenaltyGame(playerId) {
    if (trainingSessionsLeft() <= 0) { showToast('Keine Trainingseinheiten mehr heute übrig!', 'error'); return; }
    let player = squad.find(p => p.id === playerId);
    if (!player) return;
    playSound('click');
    penaltyGameState = { playerId, shotsTaken: 0, goals: 0, totalShots: 5 };
    document.getElementById('minigame-title').innerText = '⚽ Elfmeterschießen: ' + player.name;
    document.getElementById('minigame-penalty').style.display = 'block';
    document.getElementById('minigame-crossing').style.display = 'none';
    document.getElementById('minigame-overlay').classList.add('show');
    updatePenaltyGameUI();
}

function updatePenaltyGameUI() {
    let s = penaltyGameState;
    if (!s) return;
    document.getElementById('penalty-progress').innerText = `Schuss ${s.shotsTaken + 1} / ${s.totalShots} — Tore: ${s.goals}`;
    document.getElementById('penalty-result').innerText = '';
}

// Trefferwahrscheinlichkeit als eigene, testbare Funktion (keine DOM-Abhängigkeit)
function calcPenaltyScoreChance(shooting, matched) {
    return matched
        ? Math.max(0.10, Math.min(0.5, 0.25 + (shooting - 60) * 0.01))
        : Math.max(0.60, Math.min(0.97, 0.85 + (shooting - 60) * 0.005));
}

function takePenaltyShot(zone) {
    let s = penaltyGameState;
    if (!s || s.shotsTaken >= s.totalShots) return;
    let player = squad.find(p => p.id === s.playerId);
    let shooting = player ? player.shooting : 60;
    let keeperGuess = Math.floor(Math.random() * 6);
    let matched = (zone === keeperGuess);
    let scoreProb = calcPenaltyScoreChance(shooting, matched);
    let scored = Math.random() < scoreProb;
    if (scored) { s.goals++; playSound('goal'); } else playSound('whistle');

    s.shotsTaken++;
    let resultEl = document.getElementById('penalty-result');
    resultEl.innerText = scored ? '⚽ TOR!' : '🧤 GEHALTEN!';
    resultEl.style.color = scored ? 'var(--primary)' : 'var(--danger)';

    if (s.shotsTaken >= s.totalShots) setTimeout(() => finishPenaltyGame(), 900);
    else setTimeout(() => updatePenaltyGameUI(), 900);
}

function finishPenaltyGame() {
    let s = penaltyGameState;
    if (!s) return;
    let player = squad.find(p => p.id === s.playerId);
    consumeTrainingSession();
    let boostChance = s.goals >= 4 ? 0.6 : (s.goals === 3 ? 0.35 : 0.15);
    let boosted = false;
    if (player) {
        player.fitness = Math.max(10, player.fitness - 3);
        if (Math.random() < boostChance) {
            player.shooting = Math.min(99, (player.shooting || 60) + 1);
            boosted = true;
        }
        if (s.goals === s.totalShots && Math.random() < 0.15) {
            player.strength = Math.min(99, player.strength + 1);
        }
    }
    game.bestPenaltyScore = Math.max(game.bestPenaltyScore || 0, s.goals);
    let resultEl = document.getElementById('penalty-result');
    resultEl.innerText = `Ergebnis: ${s.goals}/${s.totalShots} Tore` + (boosted ? ' — Schusskraft verbessert! 📈' : '');
    resultEl.style.color = 'var(--accent)';
    renderTrainingView();
    setTimeout(() => closeMinigame(), 1600);
}

// ---------- FLANKENTRAINING ----------
let crossingGameState = null;
let crossingAnimTimer = null;

// Testbare reine Funktion: ordnet eine Balkenposition (0-100) einer Trefferzone zu
function crossingGetZone(position) {
    if (position >= 42 && position <= 58) return 'perfekt';
    if ((position >= 26 && position < 42) || (position > 58 && position <= 74)) return 'gut';
    return 'schlecht';
}

function openCrossingGame(playerId) {
    if (trainingSessionsLeft() <= 0) { showToast('Keine Trainingseinheiten mehr heute übrig!', 'error'); return; }
    let player = squad.find(p => p.id === playerId);
    if (!player) return;
    playSound('click');
    crossingGameState = { playerId, attempts: 0, totalAttempts: 5, score: 0, position: 0, direction: 1 };
    document.getElementById('minigame-title').innerText = '🎯 Flankentraining: ' + player.name;
    document.getElementById('minigame-penalty').style.display = 'none';
    document.getElementById('minigame-crossing').style.display = 'block';
    document.getElementById('minigame-overlay').classList.add('show');
    updateCrossingGameUI();
    startCrossingAnimation();
}

function startCrossingAnimation() {
    clearInterval(crossingAnimTimer);
    crossingAnimTimer = setInterval(() => {
        let s = crossingGameState;
        if (!s) return;
        s.position += s.direction * 4;
        if (s.position >= 100) { s.position = 100; s.direction = -1; }
        if (s.position <= 0) { s.position = 0; s.direction = 1; }
        let marker = document.getElementById('crossing-marker');
        if (marker) marker.style.left = s.position + '%';
    }, 40);
}

function updateCrossingGameUI() {
    let s = crossingGameState;
    if (!s) return;
    document.getElementById('crossing-progress').innerText = `Versuch ${s.attempts + 1} / ${s.totalAttempts} — Punkte: ${s.score}`;
    document.getElementById('crossing-result').innerText = '';
}

function takeCrossingAttempt() {
    let s = crossingGameState;
    if (!s || s.attempts >= s.totalAttempts) return;
    let zone = crossingGetZone(s.position);
    let points = zone === 'perfekt' ? 3 : (zone === 'gut' ? 1 : 0);
    s.score += points;
    s.attempts++;
    playSound(zone === 'perfekt' ? 'goal' : 'click');

    let label = { perfekt: '🎯 PERFEKT!', gut: '👍 Gut!', schlecht: '❌ Daneben!' }[zone];
    let resultEl = document.getElementById('crossing-result');
    resultEl.innerText = label;
    resultEl.style.color = zone === 'perfekt' ? 'var(--primary)' : (zone === 'gut' ? 'var(--accent)' : 'var(--danger)');

    if (s.attempts >= s.totalAttempts) {
        clearInterval(crossingAnimTimer);
        setTimeout(() => finishCrossingGame(), 900);
    } else {
        setTimeout(() => updateCrossingGameUI(), 900);
    }
}

function finishCrossingGame() {
    let s = crossingGameState;
    if (!s) return;
    let player = squad.find(p => p.id === s.playerId);
    consumeTrainingSession();
    let maxScore = s.totalAttempts * 3;
    let boostChance = s.score >= maxScore * 0.8 ? 0.6 : (s.score >= maxScore * 0.5 ? 0.35 : 0.15);
    let boosted = false;
    if (player) {
        player.fitness = Math.max(10, player.fitness - 3);
        if (Math.random() < boostChance) {
            player.passing = Math.min(99, (player.passing || 60) + 1);
            boosted = true;
        }
        if (s.score === maxScore && Math.random() < 0.15) {
            player.strength = Math.min(99, player.strength + 1);
        }
    }
    game.bestCrossingScore = Math.max(game.bestCrossingScore || 0, s.score);
    let resultEl = document.getElementById('crossing-result');
    resultEl.innerText = `Ergebnis: ${s.score}/${maxScore} Punkte` + (boosted ? ' — Passspiel verbessert! 📈' : '');
    resultEl.style.color = 'var(--accent)';
    renderTrainingView();
    setTimeout(() => closeMinigame(), 1600);
}

function closeMinigame() {
    let overlay = document.getElementById('minigame-overlay');
    if (overlay) overlay.classList.remove('show');
    clearInterval(crossingAnimTimer);
    penaltyGameState = null;
    crossingGameState = null;
    goalkeeperGameState = null;
}

// ---------- TORWART-TRAINING: ELFMETER HALTEN ----------
// Passend zum neuen Torwart-Spezialisten-Fokus - der Nutzer wählt als Torhüter eine
// Ecke, in die er sich wirft; trifft die Wahl mit der tatsächlichen Schussrichtung
// zusammen, ist die Parade deutlich wahrscheinlicher (abhängig von der Abwehr-Fähigkeit).
let goalkeeperGameState = null;

function openGoalkeeperGame(playerId) {
    if (trainingSessionsLeft() <= 0) { showToast('Keine Trainingseinheiten mehr heute übrig!', 'error'); return; }
    let player = squad.find(p => p.id === playerId);
    if (!player) return;
    if (player.pos !== 'TW') { showToast('Dieses Training ist nur für Torhüter gedacht!', 'error'); return; }
    playSound('click');
    goalkeeperGameState = { playerId, shotsFaced: 0, saves: 0, totalShots: 5 };
    document.getElementById('minigame-title').innerText = '🧤 Elfmeter halten: ' + player.name;
    document.getElementById('minigame-penalty').style.display = 'none';
    document.getElementById('minigame-crossing').style.display = 'none';
    document.getElementById('minigame-goalkeeper').style.display = 'block';
    document.getElementById('minigame-overlay').classList.add('show');
    updateGoalkeeperGameUI();
}
function updateGoalkeeperGameUI() {
    let s = goalkeeperGameState;
    if (!s) return;
    document.getElementById('goalkeeper-progress').innerText = `Schuss ${s.shotsFaced + 1} / ${s.totalShots} — Paraden: ${s.saves}`;
    document.getElementById('goalkeeper-result').innerText = '';
}
// Testbare reine Funktion, analog zu calcPenaltyScoreChance
function calcGoalkeeperSaveChance(defense, matched) {
    return matched
        ? Math.max(0.5, Math.min(0.9, 0.65 + (defense - 60) * 0.01))
        : Math.max(0.03, Math.min(0.3, 0.12 + (defense - 60) * 0.005));
}
function takeGoalkeeperDive(zone) {
    let s = goalkeeperGameState;
    if (!s || s.shotsFaced >= s.totalShots) return;
    let player = squad.find(p => p.id === s.playerId);
    let defense = player ? player.defense : 60;
    let shooterZone = Math.floor(Math.random() * 6);
    let matched = (zone === shooterZone);
    let saveProb = calcGoalkeeperSaveChance(defense, matched);
    let saved = Math.random() < saveProb;
    if (saved) { playSound('goal'); } else playSound('whistle');
    if (saved) s.saves++;

    s.shotsFaced++;
    let resultEl = document.getElementById('goalkeeper-result');
    resultEl.innerText = saved ? '🧤 GEHALTEN!' : '⚽ TOR KASSIERT!';
    resultEl.style.color = saved ? 'var(--primary)' : 'var(--danger)';

    if (s.shotsFaced >= s.totalShots) setTimeout(() => finishGoalkeeperGame(), 900);
    else setTimeout(() => updateGoalkeeperGameUI(), 900);
}
function finishGoalkeeperGame() {
    let s = goalkeeperGameState;
    if (!s) return;
    let player = squad.find(p => p.id === s.playerId);
    consumeTrainingSession();
    let boostChance = s.saves >= 4 ? 0.6 : (s.saves === 3 ? 0.35 : 0.15);
    let boosted = false;
    if (player) {
        player.fitness = Math.max(10, player.fitness - 3);
        if (Math.random() < boostChance) {
            player.defense = Math.min(99, (player.defense || 60) + 1);
            boosted = true;
        }
        if (s.saves === s.totalShots && Math.random() < 0.15) {
            player.strength = Math.min(99, player.strength + 1);
        }
    }
    game.bestGoalkeeperScore = Math.max(game.bestGoalkeeperScore || 0, s.saves);
    let resultEl = document.getElementById('goalkeeper-result');
    resultEl.innerText = `Ergebnis: ${s.saves}/${s.totalShots} Paraden` + (boosted ? ' — Abwehrstärke verbessert! 📈' : '');
    resultEl.style.color = 'var(--accent)';
    renderTrainingView();
    setTimeout(() => closeMinigame(), 1600);
}
