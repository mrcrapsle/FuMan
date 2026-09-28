
    // ==========================================
    // SPONSORING-SYSTEM
    // ==========================================
    // Manager können Sponsorings abschließen für wiederkehrende
    // monatliche Einnahmen. Unterschiedliche Sponsoren mit verschiedenen
    // Bedingungen, Laufzeiten und Bonuseffekten (Spielermarktbonus, etc.)

    let sponsoringDeals = {
        adidas: {
            name: "Adidas",
            logo: "👟",
            active: false,
            monthlyIncome: 0,
            endsInMonth: 0,
            bonus: { type: 'playerMarketDiscount', value: 5 } // 5% Rabatt auf Spielerkäufe
        },
        volkswagen: {
            name: "Volkswagen",
            logo: "🚗",
            active: false,
            monthlyIncome: 0,
            endsInMonth: 0,
            bonus: { type: 'travelCostReduction', value: 15 } // 15% Rabatt auf Auswärtsfahrten
        },
        lufthansa: {
            name: "Lufthansa",
            logo: "✈️",
            active: false,
            monthlyIncome: 0,
            endsInMonth: 0,
            bonus: { type: 'flightDiscount', value: 25 } // 25% Rabatt auf Flüge
        },
        sparkasse: {
            name: "Sparkasse",
            logo: "🏦",
            active: false,
            monthlyIncome: 0,
            endsInMonth: 0,
            bonus: { type: 'interestReduction', value: 2 } // 2% weniger Kreditzinsen
        },
        telekom: {
            name: "Telekom",
            logo: "📱",
            active: false,
            monthlyIncome: 0,
            endsInMonth: 0,
            bonus: { type: 'none', value: 0 }
        },
        hauptbrauerei: {
            name: "Brauerei (Heimat)",
            logo: "🍺",
            active: false,
            monthlyIncome: 0,
            endsInMonth: 0,
            bonus: { type: 'none', value: 0 }
        }
    };

    const SPONSORING_OFFERS = {
        adidas: {
            minStarRating: 2.0,
            baseIncome: 35000,
            contract: { minMonths: 12, maxMonths: 60 },
            description: "Globaler Sportartikelhersteller. Einnahmen steigen mit deiner Kaderstärke."
        },
        volkswagen: {
            minStarRating: 1.5,
            baseIncome: 40000,
            contract: { minMonths: 24, maxMonths: 60 },
            description: "Automobilhersteller. Subventioniert deine Auswärtsfahrten."
        },
        lufthansa: {
            minStarRating: 2.5,
            baseIncome: 45000,
            contract: { minMonths: 12, maxMonths: 48 },
            description: "Fluggesellschaft. Reduziert deine Flugkosten deutlich."
        },
        sparkasse: {
            minStarRating: 1.0,
            baseIncome: 25000,
            contract: { minMonths: 12, maxMonths: 60 },
            description: "Finanzinstitut. Reduziert deine Kreditzinsen."
        },
        telekom: {
            minStarRating: 1.5,
            baseIncome: 30000,
            contract: { minMonths: 24, maxMonths: 60 },
            description: "Telekommunikation. Stabile Einnahmen, geringe Anforderungen."
        },
        hauptbrauerei: {
            minStarRating: 1.0,
            baseIncome: 20000,
            contract: { minMonths: 12, maxMonths: 36 },
            description: "Lokale Brauerei. Kleines, aber stabiles Einkommen."
        }
    };

    function getSponsoringIncome(dealKey) {
        let deal = sponsoringDeals[dealKey];
        if (!deal || !deal.active) return 0;

        let income = deal.monthlyIncome;
        // Adidas: +2% pro Punkt Kaderstärke über Basis
        if (dealKey === 'adidas') {
            let avgSquadStr = (squad || []).reduce((s, p) => s + (p.str || 50), 0) / Math.max(squad.length, 1);
            income = Math.round(income * (1 + (avgSquadStr - 50) * 0.01));
        }
        return income;
    }

    function tickSponsoringIncome() {
        let total = 0;
        Object.keys(sponsoringDeals).forEach(key => {
            let deal = sponsoringDeals[key];
            if (!deal.active) return;
            deal.endsInMonth--;
            if (deal.endsInMonth <= 0) {
                deal.active = false;
                deal.monthlyIncome = 0;
                showToast(`📋 Sponsoring-Vertrag mit ${deal.name} endet!`, 'info');
            }
            total += getSponsoringIncome(key);
        });
        if (total > 0) game.money += total;
        return total;
    }

    function openSponsoringNegotiation(dealKey) {
        let offer = SPONSORING_OFFERS[dealKey];
        let deal = sponsoringDeals[dealKey];

        if (!offer) return;
        if (deal.active) {
            showToast(`${deal.name}-Vertrag läuft bereits!`, 'error');
            return;
        }

        // Check Voraussetzung
        let starRating = game.managerMediaImage ? game.managerMediaImage / 100 : 0.5;
        if (starRating < offer.minStarRating) {
            showToast(`Dein Ruf ist zu niedrig! Benötigt: ${offer.minStarRating.toFixed(1)} Sterne, hast: ${starRating.toFixed(1)}`, 'error');
            return;
        }

        let modal = document.createElement('div');
        modal.className = 'generic-modal-overlay show';
        modal.innerHTML = `
            <div class="generic-modal" style="max-width: 420px;">
                <div style="font-size: 14px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 28px;">${deal.logo}</span>
                        <strong>${offer.description}</strong>
                    </div>
                </div>
                <div class="box" style="margin-bottom: 8px;">
                    <strong>Vertragsoptionen:</strong>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px;">
                        ${[12, 24, 36, 48, 60].filter(m => m >= offer.contract.minMonths && m <= offer.contract.maxMonths).map(months => {
                            let monthlyIncome = Math.round(offer.baseIncome * (1 + (months - 12) * 0.02)); // Längere Verträge = 2% pro Monat mehr
                            let totalIncome = monthlyIncome * months;
                            return `<button class="btn-action" onclick="concludeSponsoringDeal('${dealKey}', ${months}, ${monthlyIncome})" style="font-size: 10px; padding: 8px;">
                                ${months}M: ${formatVal(monthlyIncome)}/Mo<br><small>= ${formatVal(totalIncome)}</small>
                            </button>`;
                        }).join('')}
                    </div>
                </div>
                <button onclick="this.closest('.generic-modal-overlay').remove()" class="btn-secondary" style="width: 100%;">Abbrechen</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
        });
    }

    function concludeSponsoringDeal(dealKey, months, monthlyIncome) {
        let deal = sponsoringDeals[dealKey];
        deal.active = true;
        deal.monthlyIncome = monthlyIncome;
        deal.endsInMonth = months;

        showToast(`✅ ${months} Monate mit ${deal.name} vereinbart! +${formatVal(monthlyIncome)}/Monat`, 'success');
        document.querySelectorAll('.generic-modal-overlay').forEach(m => m.remove());
        renderSponsoringPanel();
    }

    function renderSponsoringPanel() {
        let box = document.getElementById('sponsoring-list');
        if (!box) return;

        let totalActive = Object.values(sponsoringDeals).filter(d => d.active).length;
        let totalIncome = Object.keys(sponsoringDeals).reduce((sum, key) => sum + getSponsoringIncome(key), 0);

        box.innerHTML = `
            <div class="box" style="margin-bottom: 6px; font-size: 10px;">
                <strong>${totalActive}</strong> aktive Verträge ·
                <strong style="color: var(--gold);">+${formatVal(totalIncome)}</strong>/Monat
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                ${Object.entries(sponsoringDeals).map(([key, deal]) => {
                    let offer = SPONSORING_OFFERS[key];
                    let income = getSponsoringIncome(key);
                    return `
                        <div class="box" style="padding: 6px; font-size: 9px; ${deal.active ? 'border: 1px solid var(--primary);' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong>${deal.logo} ${deal.name}</strong>
                                ${deal.active ? `<small style="color: var(--primary);">${deal.endsInMonth}M</small>` : ''}
                            </div>
                            <div style="color: #94a3b8; font-size: 8px; margin: 2px 0;">
                                ${offer.description.substring(0, 35)}...
                            </div>
                            ${deal.active
                                ? `<div style="color: var(--gold); margin-top: 4px;">+${formatVal(income)}/Monat</div>`
                                : `<button onclick="openSponsoringNegotiation('${key}')" class="btn-action" style="width: 100%; margin-top: 4px; font-size: 8px; padding: 4px;">
                                    Verhandeln
                                </button>`
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

