/* eslint-disable no-undef */

const SPONSOR_TYPES = {
  equipment: {
    name: 'Ausrüstung',
    baseValue: 100000,
    duration: 24,
    benefits: { training: 0.05, morale: 0.03 }
  },
  beverageBrand: {
    name: 'Getränkemarke',
    baseValue: 150000,
    duration: 24,
    benefits: { revenue: 50000, fanEngagement: 0.05 }
  },
  automotive: {
    name: 'Automobilhersteller',
    baseValue: 250000,
    duration: 36,
    benefits: { revenue: 80000, reputation: 0.05 }
  },
  technology: {
    name: 'Technologieunternehmen',
    baseValue: 200000,
    duration: 24,
    benefits: { training: 0.08, infrastructure: 0.05 }
  },
  financial: {
    name: 'Finanzdienstleistung',
    baseValue: 300000,
    duration: 48,
    benefits: { revenue: 100000, stability: 0.05 }
  },
  retail: {
    name: 'Einzelhandelskette',
    baseValue: 120000,
    duration: 24,
    benefits: { fanEngagement: 0.08, revenue: 30000 }
  }
};

const sponsorState = {
  sponsors: [],
  negotiations: [],
  totalSponsorRevenue: 0,
  sponsorshipHistory: []
};

function initializeSponsors() {
  if (!game.sponsors) {
    game.sponsors = [];
  }
  if (!game.sponsorNegotiations) {
    game.sponsorNegotiations = [];
  }
  if (!game.totalSponsorRevenue) {
    game.totalSponsorRevenue = 0;
  }
}

function createSponsorOffer() {
  if (!game.sponsors) game.sponsors = [];

  const types = Object.keys(SPONSOR_TYPES);
  const randomType = types[Math.floor(Math.random() * types.length)];
  const typeConfig = SPONSOR_TYPES[randomType];

  const offer = {
    id: game.sponsors.length + game.sponsorNegotiations.length,
    name: typeConfig.name,
    type: randomType,
    value: Math.round(typeConfig.baseValue * (0.8 + Math.random() * 0.4)),
    duration: typeConfig.duration,
    benefits: { ...typeConfig.benefits },
    status: 'pending',
    negotiations: 0,
    createdMatchday: game.matchday,
    expiresMatchday: game.matchday + 8
  };

  if (!game.sponsorNegotiations) game.sponsorNegotiations = [];
  game.sponsorNegotiations.push(offer);

  if (game.inbox) {
    addInboxMessage(`💼 Sponsorangebot: ${offer.name}`, `€${offer.value.toLocaleString()} für ${offer.duration} Spieltage`);
  }

  return offer;
}

function negotiateSponsorship(offerId, strategy) {
  if (!game.sponsorNegotiations) return false;

  const offer = game.sponsorNegotiations.find(o => o.id === offerId);
  if (!offer || offer.status !== 'pending') return false;

  offer.negotiations++;

  let successChance = 0.6;
  if (strategy === 'aggressive') {
    successChance = 0.4;
    offer.value = Math.round(offer.value * 1.15);
  } else if (strategy === 'friendly') {
    successChance = 0.8;
    offer.value = Math.round(offer.value * 0.9);
  }

  if (Math.random() < successChance || offer.negotiations > 2) {
    signSponsorshipDeal(offer);
    game.sponsorNegotiations = game.sponsorNegotiations.filter(o => o.id !== offerId);
    return true;
  }

  return false;
}

function signSponsorshipDeal(offer) {
  const sponsorship = {
    id: (game.sponsors || []).length,
    name: offer.name,
    type: offer.type,
    value: offer.value,
    startMatchday: game.matchday,
    endMatchday: game.matchday + offer.duration,
    active: true,
    benefits: offer.benefits,
    signedSeason: game.season
  };

  if (!game.sponsors) game.sponsors = [];
  game.sponsors.push(sponsorship);

  if (game.inbox) {
    addInboxMessage(`✅ Sponsoring abgeschlossen`, `${sponsorship.name}: €${sponsorship.value.toLocaleString()}`);
  }

  return sponsorship;
}

function rejectSponsorshipOffer(offerId) {
  if (!game.sponsorNegotiations) return;
  game.sponsorNegotiations = game.sponsorNegotiations.filter(o => o.id !== offerId);
}

function processSponsorPayments() {
  if (!game.sponsors) return 0;

  let totalIncome = 0;
  game.sponsors.forEach((sponsor) => {
    if (sponsor.active && game.matchday <= sponsor.endMatchday) {
      const monthlyPayment = Math.round(sponsor.value / (sponsor.endMatchday - sponsor.startMatchday + 1));
      totalIncome += monthlyPayment;
      sponsor.totalPaid = (sponsor.totalPaid || 0) + monthlyPayment;
    } else if (game.matchday > sponsor.endMatchday) {
      sponsor.active = false;
    }
  });

  return totalIncome;
}

function applySponsorBenefits() {
  if (!game.sponsors) return;

  let trainingBonus = 0;
  let moraleBonus = 0;
  let infrastructureBonus = 0;

  game.sponsors.forEach((sponsor) => {
    if (sponsor.active && game.matchday <= sponsor.endMatchday) {
      if (sponsor.benefits.training) trainingBonus += sponsor.benefits.training;
      if (sponsor.benefits.morale) moraleBonus += sponsor.benefits.morale;
      if (sponsor.benefits.infrastructure) infrastructureBonus += sponsor.benefits.infrastructure;
    }
  });

  if (squad && trainingBonus > 0) {
    squad.forEach(player => {
      if (player.strength < 100) {
        player.strength = Math.min(100, player.strength + (trainingBonus * 100 * 0.01));
      }
    });
  }

  if (squad && moraleBonus > 0) {
    squad.forEach(player => {
      if (player.morale < 100) {
        player.morale = Math.min(100, player.morale + (moraleBonus * 100 * 0.01));
      }
    });
  }

  return { trainingBonus, moraleBonus, infrastructureBonus };
}

function tickSponsorNegotiations() {
  if (!game.sponsorNegotiations) return;

  game.sponsorNegotiations = game.sponsorNegotiations.filter((offer) => {
    if (game.matchday > offer.expiresMatchday) {
      if (game.inbox) {
        addInboxMessage(`❌ Sponsorangebot abgelaufen`, offer.name);
      }
      return false;
    }
    return true;
  });

  if (Math.random() < 0.15 && (!game.sponsorNegotiations || game.sponsorNegotiations.length < 3)) {
    createSponsorOffer();
  }
}

function renderSponsorManagementPanel() {
  const panel = document.getElementById('sponsor-management-panel');
  if (!panel) return;

  initializeSponsors();

  const activeSponsors = (game.sponsors || []).filter(s => s.active && game.matchday <= s.endMatchday);
  const totalMonthlyIncome = activeSponsors.reduce((sum, s) => {
    const payment = Math.round(s.value / (s.endMatchday - s.startMatchday + 1));
    return sum + payment;
  }, 0);

  let html = '<div class="panel-content">';
  html += `<h3>Sponsoring & Partnerschaften</h3>`;

  html += '<div class="sponsor-stats">';
  html += `<div class="stat-box">Aktive Sponsoren: ${activeSponsors.length}</div>`;
  html += `<div class="stat-box">Monatliche Einnahmen: €${totalMonthlyIncome.toLocaleString()}</div>`;
  html += `<div class="stat-box">Ausstehende Angebote: ${(game.sponsorNegotiations || []).length}</div>`;
  html += '</div>';

  html += '<h4>Aktive Sponsoren:</h4>';
  if (activeSponsors.length > 0) {
    activeSponsors.forEach((sponsor) => {
      const monthlyPayment = Math.round(sponsor.value / (sponsor.endMatchday - sponsor.startMatchday + 1));
      const remaining = sponsor.endMatchday - game.matchday;
      html += `<div class="sponsor-item">`;
      html += `<strong>${sponsor.name}</strong>`;
      html += `<div class="sponsor-info">€${monthlyPayment.toLocaleString()}/Monat | Verbleibend: ${remaining} Spieltage</div>`;
      html += `<div class="sponsor-info">Vorteile: Training +${(sponsor.benefits.training * 100).toFixed(1)}% | Moral +${(sponsor.benefits.morale * 100).toFixed(1)}%</div>`;
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Keine aktiven Sponsoren</div>';
  }

  html += '<h4>Sponsorangebote:</h4>';
  if (game.sponsorNegotiations && game.sponsorNegotiations.length > 0) {
    game.sponsorNegotiations.forEach((offer) => {
      html += `<div class="offer-item">`;
      html += `<strong>${offer.name}</strong>`;
      html += `<div class="offer-info">€${offer.value.toLocaleString()} | ${offer.duration} Spieltage</div>`;
      html += `<button onclick="negotiateSponsorship(${offer.id}, 'friendly')" style="background:#4CAF50; color:white; border:none; padding:4px 8px; margin-right:4px; border-radius:3px; font-size:10px;">Freundlich</button>`;
      html += `<button onclick="negotiateSponsorship(${offer.id}, 'aggressive')" style="background:#FFC107; color:#000; border:none; padding:4px 8px; margin-right:4px; border-radius:3px; font-size:10px;">Aggressiv</button>`;
      html += `<button onclick="rejectSponsorshipOffer(${offer.id})" style="background:#FF5252; color:white; border:none; padding:4px 8px; border-radius:3px; font-size:10px;">Ablehnen</button>`;
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Keine aktuellen Angebote</div>';
  }

  html += '</div>';
  panel.innerHTML = html;
}
