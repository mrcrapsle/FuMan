
    // ==========================================
    // SPIELER-ARCHETYPEN
    // ==========================================
    // Verschiedene Spielertypen haben unterschiedliche Entwicklungsmuster:
    // - Frühe Blüte (jung stark, dann Abstieg)
    // - Spätzünder (anfangs schwach, später stark)
    // - Konstante Karriere (stabil)
    // - Überflieger (schnelle Entwicklung)
    // - Fallfiguren (erfahren aber schneller Abstieg)
    /* eslint-disable no-undef */

    const ARCHETYPES = {
        'early-bloomer': {
            name: 'Frühe Blüte',
            description: 'Jung extrem talentiert, stellt sich schnell durch',
            peakAge: 25,
            declineRate: 1.5,
            developmentRate: 1.4,
            icon: '⭐',
            traits: ['Ambitioniert', 'Durchsetzungsstark']
        },
        'late-bloomer': {
            name: 'Spätzünder',
            description: 'Wird erst mit Erfahrung richtig gut',
            peakAge: 32,
            declineRate: 0.8,
            developmentRate: 0.8,
            icon: '📈',
            traits: ['Geduldig', 'Professionell']
        },
        'steady-eddy': {
            name: 'Konstanter Profi',
            description: 'Stabile Karriere ohne große Sprünge',
            peakAge: 29,
            declineRate: 1.0,
            developmentRate: 1.0,
            icon: '⚖️',
            traits: ['Zuverlässig', 'Beständig']
        },
        'wonderkid': {
            name: 'Wunderkind',
            description: 'Expotenzielle Entwicklung in den besten Jahren',
            peakAge: 27,
            declineRate: 2.0,
            developmentRate: 1.8,
            icon: '🌟',
            traits: ['Ehrgeiziger', 'Talentiert']
        },
        'fallen-star': {
            name: 'Gefallener Star',
            description: 'War einmal großartig, fällt schnell ab',
            peakAge: 24,
            declineRate: 2.5,
            developmentRate: 0.6,
            icon: '💔',
            traits: ['Erfahrener', 'Unreif']
        }
    };

    function assignArchetype(playerId, archetyype) {
        let p = squad.find(x => x.id === playerId);
        if (!p) return { success: false, message: 'Spieler nicht gefunden' };
        if (!ARCHETYPES[archetyype]) return { success: false, message: 'Archetyp unbekannt' };

        p.archetype = archetyype;
        showToast(`✅ ${p.name} ist jetzt ein(e) ${ARCHETYPES[archetyype].name}`, 'success');
        return { success: true };
    }

    function getArchetypeBonus(player, stat) {
        if (!player || !player.archetype) return 1.0;
        let arch = ARCHETYPES[player.archetype];
        if (!arch) return 1.0;

        let ageFromPeak = player.age - arch.peakAge;
        let bonus = 1.0;

        // Im Peak-Alter optimal
        if (Math.abs(ageFromPeak) <= 1) bonus = 1.0 + 0.15;
        // Vor dem Peak: development rate
        else if (ageFromPeak < 0) {
            bonus = 1.0 + (0.08 * arch.developmentRate);
        }
        // Nach dem Peak: decline rate
        else {
            bonus = 1.0 - (ageFromPeak * 0.02 * arch.declineRate);
            bonus = Math.max(0.6, bonus);
        }

        return bonus;
    }

    function simulateArchetypeCareer(archetype, startAge = 20, endAge = 36) {
        let arch = ARCHETYPES[archetype];
        if (!arch) return [];

        let career = [];
        for (let age = startAge; age <= endAge; age++) {
            let ageFromPeak = age - arch.peakAge;
            let strength = 60; // Base strength

            // Entwicklung zum Peak
            if (ageFromPeak < 0) {
                let yearsToPeak = -ageFromPeak;
                strength += yearsToPeak * 2 * arch.developmentRate;
            }
            // Nach dem Peak
            else {
                strength -= ageFromPeak * 1.5 * arch.declineRate;
            }

            strength = Math.max(40, Math.min(strength, 95));
            career.push({ age, strength: Math.round(strength) });
        }
        return career;
    }

    function renderArchetypesPanel() {
        const box = document.getElementById('archetypes-panel');
        if (!box) return;

        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">🎭 SPIELER-ARCHETYPEN</div>`;

        // Kurzbeschreibungen aller Archetypen
        Object.entries(ARCHETYPES).forEach(([key, arch]) => {
            html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:6px; font-size:9px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <strong>${arch.icon} ${arch.name}</strong>
                    <span style="color:var(--text-muted); font-size:8px;">Peak: ${arch.peakAge}J.</span>
                </div>
                <div style="font-size:8px; color:var(--text-muted); margin-bottom:3px;">${arch.description}</div>
                <div style="font-size:8px; color:var(--accent);">
                    Entwicklung: ${(arch.developmentRate * 100).toFixed(0)}% · Verfall: ${(arch.declineRate * 100).toFixed(0)}%
                </div>
            </div>`;
        });

        // Spieler nach Archetypen gruppiert
        let playersByArchetype = {};
        squad.forEach(p => {
            let arch = p.archetype || 'unassigned';
            if (!playersByArchetype[arch]) playersByArchetype[arch] = [];
            playersByArchetype[arch].push(p);
        });

        if (Object.keys(playersByArchetype).length > 1 || playersByArchetype['unassigned']?.length < squad.length) {
            html += `<div style="font-size:9px; font-weight:bold; margin-top:8px; margin-bottom:4px;">📊 SPIELER NACH TYP</div>`;
            Object.entries(playersByArchetype).forEach(([arch, players]) => {
                if (players.length === 0) return;
                let archObj = ARCHETYPES[arch];
                let label = archObj ? archObj.name : 'Nicht zugewiesen';
                html += `<div style="font-size:8px; color:var(--accent); margin-bottom:2px;">${label}: ${players.length} Spieler</div>`;
                players.slice(0, 3).forEach(p => {
                    html += `<div style="font-size:7px; color:var(--text-muted); margin-left:8px;">• ${p.name} (${p.age}J.)</div>`;
                });
                if (players.length > 3) html += `<div style="font-size:7px; color:var(--text-muted); margin-left:8px;">+ ${players.length - 3} weitere</div>`;
            });
        }

        box.innerHTML = html;
    }

    function renderArchetypeComparisonChart() {
        const box = document.getElementById('archetype-comparison-box');
        if (!box) return;

        let html = `<div style="font-size:10px; font-weight:bold; margin-bottom:6px;">📈 KARRIERE-VERLAUF NACH ARCHETYP</div>`;

        Object.entries(ARCHETYPES).forEach(([key, arch]) => {
            let career = simulateArchetypeCareer(key);
            let minStrength = Math.min(...career.map(c => c.strength));
            let maxStrength = Math.max(...career.map(c => c.strength));
            let range = maxStrength - minStrength || 1;

            html += `<div style="background:rgba(100,100,100,0.1); padding:6px; border-radius:4px; margin-bottom:6px;">
                <div style="font-weight:bold; font-size:9px; margin-bottom:4px;">${arch.icon} ${arch.name}</div>
                <div style="display:flex; gap:1px; height:20px; align-items:flex-end;">
                    ${career.map(c => {
                        let height = ((c.strength - minStrength) / range) * 20;
                        return `<div style="flex:1; height:${Math.max(1, height)}px; background:var(--accent); border-radius:1px;" title="${c.age}J: ${c.strength}"></div>`;
                    }).join('')}
                </div>
                <div style="font-size:7px; color:var(--text-muted); margin-top:2px;">
                    20J → 36J: ${career[0].strength} → ${career[career.length - 1].strength}
                </div>
            </div>`;
        });

        box.innerHTML = html;
    }

