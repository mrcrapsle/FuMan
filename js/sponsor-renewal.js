/* eslint-disable no-undef */
// Hauptsponsor-Verlängerung (Phase 25.19): bisher lief der Vertrag einfach aus (Bot-Postfach: fast
// jede Saison "Hauptsponsor-Vertrag ausgelaufen"), danach fehlte das Geld bis zum nächsten
// Abschluss. Jetzt bietet der Sponsor SPONSOR_RENEWAL_LEAD Spieltage vor dem Ende selbst eine
// Verlängerung an (game.sponsorRenewal, Box #sponsor-renewal-box im Sponsoren-Bildschirm):
//   Konditionen   Sockel und Siegprämie × (0,8 + Treue / 250), dazu der Ligawechsel seit der
//                 Unterschrift (SPONSOR_LEAGUE_FACTOR); unter SPONSOR_RENEWAL_MIN_LOYALTY Treue
//                 verlängert er gar nicht
//   annehmen      +SPONSOR_RENEWAL_DAYS Spieltage Laufzeit, Treue +5
//   nachverhandeln einmal: Chance = Treue %, Erfolg +10 %, sonst zieht er das Angebot zurück
//   ablehnen      der Vertrag läuft aus, neue Angebote kommen wie bisher

const SPONSOR_RENEWAL_LEAD = 6;
const SPONSOR_RENEWAL_DAYS = 34;
const SPONSOR_RENEWAL_MIN_LOYALTY = 20;

function getSponsorRenewal() {
    const r = game.sponsorRenewal;
    return r && game.sponsor && r.name === game.sponsor.name && (game.sponsor.duration || 0) > 0 ? r : null;
}

function buildSponsorRenewalOffer() {
    const sp = game.sponsor;
    const treue = typeof sp.loyalty === 'number' ? sp.loyalty : 65;
    const ligaJetzt = SPONSOR_LEAGUE_FACTOR[game.leagueLevel] ?? 1;
    const ligaDamals = typeof sp.signedLevel === 'number' ? (SPONSOR_LEAGUE_FACTOR[sp.signedLevel] ?? ligaJetzt) : ligaJetzt;
    const faktor = (0.8 + treue / 250) * (ligaJetzt / ligaDamals);
    return { name: sp.name, faktor: Math.round(faktor * 100) / 100, base: Math.round(sp.base * faktor / 100) * 100,
        winBonus: Math.round(sp.winBonus * faktor / 100) * 100, haggled: false };
}

// Aus tickContractDurations() nach dem Herunterzählen der Laufzeit.
function checkSponsorRenewalOffer() {
    const sp = game.sponsor;
    if (!sp || sp.name === 'Kein Hauptsponsor' || sp.duration !== SPONSOR_RENEWAL_LEAD) return;
    const treue = typeof sp.loyalty === 'number' ? sp.loyalty : 65;
    if (treue < SPONSOR_RENEWAL_MIN_LOYALTY) {
        game.sponsorRenewal = null;
        addInboxMessage('vertrag', `🤝 ${sp.name} verlängert nicht`, `Noch ${sp.duration} Spieltage läuft der Vertrag mit ${sp.name} - nach der sportlichen Talfahrt (Treue ${treue}) will der Sponsor nicht verlängern. Zeit, neue Angebote zu prüfen.`, 'screen-sponsors');
        return;
    }
    game.sponsorRenewal = buildSponsorRenewalOffer();
    const r = game.sponsorRenewal;
    addInboxMessage('vertrag', `🤝 ${sp.name} will verlängern`, `Noch ${sp.duration} Spieltage läuft der Vertrag. ${sp.name} bietet eine Verlängerung um ${SPONSOR_RENEWAL_DAYS} Spieltage an: Sockel ${formatVal(r.base)} statt ${formatVal(sp.base)}, Siegprämie ${formatVal(r.winBonus)} - Sponsoren-Bildschirm.`, 'screen-sponsors');
}

function acceptSponsorRenewal() {
    const r = getSponsorRenewal();
    if (!r) { showToast('Kein Verlängerungsangebot offen.', 'error'); return; }
    const sp = game.sponsor;
    sp.base = r.base; sp.winBonus = r.winBonus;
    sp.duration = (sp.duration || 0) + SPONSOR_RENEWAL_DAYS;
    sp.signedLevel = game.leagueLevel;
    sp.loyalty = Math.min(100, (typeof sp.loyalty === 'number' ? sp.loyalty : 65) + 5);
    game.sponsorRenewal = null;
    playSound('goal');
    showToast(`🤝 ${sp.name} verlängert um ${SPONSOR_RENEWAL_DAYS} Spieltage - ${formatVal(sp.base)} Sockel pro Spieltag.`, 'success', 5000);
    if (typeof renderSponsorsView === 'function') renderSponsorsView();
    updateUI();
}

function haggleSponsorRenewal() {
    const r = getSponsorRenewal();
    if (!r) { showToast('Kein Verlängerungsangebot offen.', 'error'); return; }
    if (r.haggled) { showToast('Nachverhandelt wird nur einmal.', 'error'); return; }
    const treue = typeof game.sponsor.loyalty === 'number' ? game.sponsor.loyalty : 65;
    r.haggled = true;
    if (Math.random() < treue / 100) {
        r.base = Math.round(r.base * 1.1 / 100) * 100;
        r.winBonus = Math.round(r.winBonus * 1.1 / 100) * 100;
        showToast(`📈 ${r.name} legt 10 % drauf: ${formatVal(r.base)} Sockel.`, 'success', 4500);
    } else {
        game.sponsorRenewal = null;
        showToast(`📉 ${r.name} zieht das Angebot zurück - der Vertrag läuft aus.`, 'error', 4500);
    }
    if (typeof renderSponsorsView === 'function') renderSponsorsView();
}

function declineSponsorRenewal() {
    if (!getSponsorRenewal()) return;
    game.sponsorRenewal = null;
    showToast('Der Hauptsponsor-Vertrag läuft aus - neue Angebote kommen in die Sponsoren-Zentrale.', 'success');
    if (typeof renderSponsorsView === 'function') renderSponsorsView();
}

function renderSponsorRenewalBox() {
    const box = document.getElementById('sponsor-renewal-box');
    if (!box) return;
    const r = getSponsorRenewal();
    if (!r) { box.innerHTML = ''; return; }
    const sp = game.sponsor;
    const treue = typeof sp.loyalty === 'number' ? sp.loyalty : 65;
    box.innerHTML = `<div class="box" style="border-left-color:var(--gold); font-size:10px;">🤝 <strong>${r.name}</strong> bietet eine Verlängerung um ${SPONSOR_RENEWAL_DAYS} Spieltage (noch ${sp.duration} Spieltage Laufzeit): Sockel <strong>${formatVal(r.base)}</strong> (bisher ${formatVal(sp.base)}), Siegprämie ${formatVal(r.winBonus)}.
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:4px;">
            <button onclick="acceptSponsorRenewal()" class="btn-action" style="font-size:9px;">✅ Verlängern</button>
            <button onclick="haggleSponsorRenewal()" class="btn-secondary" style="font-size:9px;"${r.haggled ? ' disabled' : ''}>📈 +10 % fordern (${treue} %)</button>
            <button onclick="declineSponsorRenewal()" class="btn-secondary" style="font-size:9px;">❌ Auslaufen lassen</button>
        </div></div>`;
}
