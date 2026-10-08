/* eslint-disable no-undef */
// Profis verleihen (Phase 25.20): bisher ließen sich nur Spieler der zweiten Mannschaft und Talente
// verleihen - ein teurer Ergänzungsspieler blieb bis zum Verkauf auf der Gehaltsliste. Jetzt im
// Wechselfenster (isTransferWindowOpen) bis zum Saisonende an einen KI-Verein der eigenen Liga oder
// eine Liga darunter, bei dem er Stammspieler wäre (getProLoanTerms):
//   Gehaltsanteil   der Leihverein zahlt 40-100 % (100 %, wenn der Spieler mindestens so stark wie
//                   der Verein ist, je Punkt darunter 10 % weniger); den Rest zahlt der Verein weiter
//                   ('🔁 Leihspieler-Gehalt', tickLoanedPlayers)
//   Gehaltsbudget   der Spieler zählt nicht mehr mit (er steht nicht im Kader)
//   Rückkehr        nach dem 34. Spieltag, Moral +5, bis 23 Jahre +1 Stärke (grantTrainingStrength)
// Höchstens PRO_LOAN_MAX gleichzeitig, mindestens PRO_LOAN_MIN_SQUAD Spieler bleiben.

const PRO_LOAN_MAX = 3;
const PRO_LOAN_MIN_SQUAD = 16;

function getProLoanTerms(p) {
    const ligen = [game.leagueLevel, Math.min(NUM_LEAGUES - 1, game.leagueLevel + 1)];
    const vereine = ligen.flatMap(l => leaguesData[l] || [])
        .filter(t => t && t.name !== game.clubName && !(game.secondTeam && t.name === game.secondTeam.name));
    if (!vereine.length) return null;
    const passend = vereine.filter(t => t.strength <= p.strength + 2).sort((a, b) => b.strength - a.strength);
    const club = passend[0] || [...vereine].sort((a, b) => a.strength - b.strength)[0];
    const anteil = Math.max(0.4, Math.min(1, 1 - (club.strength - p.strength) * 0.1));
    return { club: club.name, anteil: Math.round(anteil * 100) / 100, eigen: Math.round((p.wage || 0) * (1 - anteil) / 10) * 10 };
}

function getProLoans() {
    return (loanedPlayers || []).filter(l => l.proLoan);
}

function loanOutProPlayer(id, btn) {
    const p = squad.find(x => x.id === id);
    if (!p) return;
    if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) { showToast('Profis lassen sich nur im Wechselfenster verleihen (Spieltag 1-3 und 18-20).', 'error', 4500); return; }
    if (squad.length <= PRO_LOAN_MIN_SQUAD) { showToast(`Mindestens ${PRO_LOAN_MIN_SQUAD} Spieler müssen im Kader bleiben.`, 'error'); return; }
    if (getProLoans().length >= PRO_LOAN_MAX) { showToast(`Höchstens ${PRO_LOAN_MAX} Profis gleichzeitig verliehen.`, 'error'); return; }
    if ((incomingLoans || []).some(l => l.playerId === p.id)) { showToast(`${p.name} ist selbst nur ausgeliehen.`, 'error'); return; }
    const t = getProLoanTerms(p);
    if (!t) { showToast('Kein Leihverein gefunden.', 'error'); return; }
    if (!requireConfirm(btn, `Bis Saisonende verleihen? Eigenanteil ${formatVal(t.eigen)}/SpT`)) return;
    playSound('click');
    squad = squad.filter(x => x.id !== p.id);
    lineup = lineup.filter(x => x !== p.id);
    if (lineup.length < 11 && typeof autoLineup === 'function') autoLineup();
    loanedPlayers.push({ player: p, loanClub: t.club, duration: Math.max(1, 35 - game.matchday), originalStrength: p.strength, proLoan: true, anteil: t.anteil, eigen: t.eigen });
    addInboxMessage('vertrag', `🔁 ${p.name} an ${t.club} verliehen`, `${p.name} spielt bis Saisonende bei ${t.club}. Der Leihverein zahlt ${Math.round(t.anteil * 100)} % seines Gehalts, dein Anteil: ${formatVal(t.eigen)} pro Spieltag. Im Gehaltsbudget zählt er nicht mehr.`, 'screen-transfer');
    showToast(`🔁 ${p.name} bis Saisonende an ${t.club} verliehen (${Math.round(t.anteil * 100)} % Gehalt übernimmt der Leihverein).`, 'success', 5000);
    if (typeof renderTransferView === 'function') renderTransferView();
    updateUI();
}

// Aus tickLoanedPlayers() für jede Profi-Leihe: Eigenanteil buchen, nach dem 34. Spieltag zurück.
function tickProLoan(loan) {
    if (loan.eigen > 0 && typeof bucheMitLabel === 'function') bucheMitLabel('🔁 Leihspieler-Gehalt', -loan.eigen);
    if (loan.duration > 0) return false;
    const p = loan.player;
    squad.push(p);
    p.morale = Math.min(100, (p.morale || 50) + 5);
    let plus = 0;
    if ((p.age || 25) <= 23 && typeof grantTrainingStrength === 'function' && grantTrainingStrength(p)) plus = 1;
    addInboxMessage('vertrag', `📥 ${p.name} von ${loan.loanClub} zurück`, `${p.name} kehrt nach der Leihe mit Spielpraxis zurück (Moral +5${plus ? ', Stärke +1' : ''}).`, 'screen-squad');
    return true;
}

function renderProLoansBox() {
    const box = document.getElementById('pro-loans-box');
    if (!box) return;
    const leihen = getProLoans();
    const fenster = typeof isTransferWindowOpen === 'function' && isTransferWindowOpen();
    if (!leihen.length) { box.innerHTML = fenster ? `<div class="box" style="font-size:9px; color:var(--text-muted);">🔁 Profis verleihen: bis Saisonende an einen Verein, bei dem sie spielen - der Leihverein übernimmt 40-100 % des Gehalts. Knopf in der Liste unten.</div>` : ''; return; }
    box.innerHTML = `<div class="box" style="font-size:9px;"><strong>🔁 Verliehene Profis</strong>${leihen.map(l => `<div>${l.player.name} bei ${l.loanClub} - noch ${l.duration} Spieltage, Eigenanteil ${formatVal(l.eigen)}/SpT</div>`).join('')}</div>`;
}
