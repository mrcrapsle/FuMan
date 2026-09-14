
    // ==========================================
    // DYNAMISCHE ROHSTOFF-BÖRSE (ENGINE)
    // ==========================================
    function updateCommodityMarket() {
        const events = [
            { text: "🚢 Frachterblockade im Suezkanal: Baumwolle explodiert im Preis (+35%)!", mat: "cotton", mult: 1.35 },
            { text: "🐑 Rekordschur in Neuseeland: Wolle schwemmt den Markt (-25%)!", mat: "wool", mult: 0.75 },
            { text: "🛢️ Raffinerie-Ausfall: Kunststoff-Granulat deutlich teurer (+30%)!", mat: "plastic", mult: 1.30 },
            { text: "🐮 Globale Überproduktion: Lederpreis gibt spürbar nach (-20%)!", mat: "leather", mult: 0.80 },
            { text: "📈 Weltweite Rohstoff-Rallye: Alle Märkte ziehen kräftig an (+15%)!", mat: "all", mult: 1.15 }
        ];

        let isEvent = Math.random() < 0.22;
        if (isEvent) {
            let ev = events[Math.floor(Math.random() * events.length)];
            rawMaterials.activeMarketEvent = ev.text;
            if (ev.mat === 'all') {
                ['cotton', 'wool', 'leather', 'plastic'].forEach(k => {
                    let oldP = rawMaterials[k].currentPrice;
                    rawMaterials[k].currentPrice = Math.min(rawMaterials[k].maxPrice, +(rawMaterials[k].currentPrice * ev.mult).toFixed(2));
                    rawMaterials[k].delta = +(rawMaterials[k].currentPrice - oldP).toFixed(2);
                });
            } else if (rawMaterials[ev.mat]) {
                let oldP = rawMaterials[ev.mat].currentPrice;
                rawMaterials[ev.mat].currentPrice = Math.min(rawMaterials[ev.mat].maxPrice, Math.max(rawMaterials[ev.mat].minPrice, +(rawMaterials[ev.mat].currentPrice * ev.mult).toFixed(2)));
                rawMaterials[ev.mat].delta = +(rawMaterials[ev.mat].currentPrice - oldP).toFixed(2);
            }
        } else {
            rawMaterials.activeMarketEvent = "Ruhiger und stabiler Handel an den internationalen Rohstoffbörsen.";
            ['cotton', 'wool', 'leather', 'plastic'].forEach(k => {
                let r = rawMaterials[k];
                let change = (Math.random() - 0.48) * 0.45;
                let oldP = r.currentPrice;
                r.currentPrice = Math.min(r.maxPrice, Math.max(r.minPrice, +(r.currentPrice + change).toFixed(2)));
                r.delta = +(r.currentPrice - oldP).toFixed(2);
            });
        }
    }


