/* eslint-disable no-undef */
// Medizincheck bei Transfers (Phase 22.5): jeder Spieler auf dem Transfermarkt hat einen
// verdeckten Befund (p.medical, einmal je Marktspieler gewürfelt, ältere Spieler öfter):
//   ok         unauffällig
//   chronisch  chronische Probleme - im Kader dauerhaft x1,5 Verletzungsrisiko (p.chronicIssue)
//              und 3-5 frühere Verletzungen in der Akte (p.timesInjured)
//   verletzt   kommt verletzt an und fällt 2-5 Spiele aus
// Den Check gibt es nur im Transferpoker NACH der Ablöse-Einigung (wie im echten Fußball vor
// der Unterschrift): er kostet 3 % der Ablöse (mit Chef-Physio die Hälfte, mind. 1.500 €).
// Findet er etwas, verhandelt der Verein die Ablöse automatisch nach (chronisch -20 %,
// verletzt -15 %) - oder man lässt den Spieler ganz sausen. Der Sofortkauf bleibt blind: ein
// verdeckter Befund kommt dann erst nach der Unterschrift ans Licht.

const MEDICAL_CHECK_RATE = 0.03;
const MEDICAL_CHECK_MIN = 1500;
const MEDICAL_DISCOUNT = { chronisch: 0.8, verletzt: 0.85 };
const CHRONIC_INJURY_FACTOR = 1.5;

function ensureMedicalProfile(p) {
    if (!p.medical) {
        const r = Math.random();
        const chronischQuote = 0.12 + ((p.age || 25) >= 29 ? 0.1 : 0);
        if (r < chronischQuote) p.medical = { issue: 'chronisch', injuries: 3 + Math.floor(Math.random() * 3), checked: false };
        else if (r < chronischQuote + 0.1) p.medical = { issue: 'verletzt', weeks: 2 + Math.floor(Math.random() * 4), checked: false };
        else p.medical = { issue: 'ok', checked: false };
    }
    return p.medical;
}

function getMedicalCheckFee(ablose) {
    const physio = staffMembers.physio && staffMembers.physio.hired ? 0.5 : 1;
    return Math.max(MEDICAL_CHECK_MIN, Math.round(ablose * MEDICAL_CHECK_RATE * physio / 100) * 100);
}

function describeMedical(m) {
    if (m.issue === 'chronisch') return `chronische Probleme (${m.injuries} frühere Verletzungen, dauerhaft höheres Verletzungsrisiko)`;
    if (m.issue === 'verletzt') return `aktuell verletzt (fällt ${m.weeks} Spiele aus)`;
    return 'unauffällig';
}

// Kurzer Befund für Marktliste und Spieler-Popup.
function getMedicalTag(p) {
    const m = p.medical;
    if (!m || !m.checked) return '🩺 ungeprüft';
    return m.issue === 'ok' ? '🩺 Befund unauffällig' : `⚠️ ${m.issue === 'chronisch' ? 'chronische Probleme' : `verletzt (${m.weeks} Sp.)`}`;
}

// Transferpoker, nach der Ablöse-Einigung.
function runMedicalCheck() {
    const p = typeof getPokerPlayer === 'function' ? getPokerPlayer() : null;
    const t = transferPoker;
    if (!p || !t || !t.agreedFee) { showToast('Der Medizincheck kommt erst, wenn die Ablöse vereinbart ist.', 'error'); return; }
    const m = ensureMedicalProfile(p);
    if (m.checked) { showToast(`${p.name} wurde schon untersucht: ${describeMedical(m)}.`, 'error'); return; }
    const gebuehr = getMedicalCheckFee(t.agreedFee);
    if (game.money < gebuehr) { showToast(`Der Medizincheck kostet ${formatVal(gebuehr)} - so viel ist nicht auf dem Konto.`, 'error'); return; }
    setzeBuchungskontext('🩺 Medizincheck');
    game.money -= gebuehr;
    loescheBuchungskontext();
    m.checked = true;
    playSound('click');
    if (m.issue === 'ok') {
        t.log.push(`🩺 Medizincheck (${formatVal(gebuehr)}): ${p.name} ist kerngesund.`);
    } else {
        const faktor = MEDICAL_DISCOUNT[m.issue];
        const alt = t.agreedFee;
        t.agreedFee = Math.round(alt * faktor / 1000) * 1000;
        p.askingPrice = Math.round(p.askingPrice * faktor / 1000) * 1000;
        p.sellerMinimum = Math.min(p.askingPrice, Math.round(p.sellerMinimum * faktor / 1000) * 1000);
        t.log.push(`⚠️ Medizincheck (${formatVal(gebuehr)}): ${describeMedical(m)}. ${p.sellerClub} senkt die Ablöse von ${formatVal(alt)} auf ${formatVal(t.agreedFee)} - oder du lässt es.`);
    }
    renderTransferPokerBox();
    updateUI();
}

// finalizePlayerPurchase(): der Befund wird Wirklichkeit.
function applyMedicalOnArrival(p) {
    const m = ensureMedicalProfile(p);
    if (m.issue === 'chronisch') {
        p.chronicIssue = true;
        p.timesInjured = Math.max(p.timesInjured || 0, m.injuries);
    } else if (m.issue === 'verletzt') {
        p.injured = Math.max(p.injured || 0, m.weeks);
    }
    if (m.issue !== 'ok' && !m.checked) {
        addInboxMessage('verletzung', `🩺 Böse Überraschung: ${p.name}`, `Ohne Medizincheck verpflichtet - jetzt stellt die Vereinsärztin fest: ${describeMedical(m)}.`, 'screen-squad');
        showToast(`🩺 Ohne Medizincheck: ${p.name} - ${describeMedical(m)}.`, 'error', 6000);
    }
    delete p.medical;
}

// Verletzungswurf (processPostMatchRoutine) und Risikoanzeige.
function getChronicInjuryFactor(p) {
    return p && p.chronicIssue ? CHRONIC_INJURY_FACTOR : 1;
}
