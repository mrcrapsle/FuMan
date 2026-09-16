
    // ==========================================
    // ACHIEVEMENTS: VON TROPHÄEN LOSGELÖSTE MEILENSTEINE (NEU)
    // ==========================================
    // Trophäen (game.trophies) markieren sportliche Erfolge (Meisterschaft, Pokalsieg).
    // Achievements sind bewusst BREITER angelegt - auch wirtschaftliche/strukturelle
    // Meilensteine (erste Million, Zweite Mannschaft gegründet, ...) und humorvolle
    // "Ehrenabzeichen" (überlebte erste Entlassung), die sonst nirgends sichtbar wären.
    // Bewusst NUR LESEND: prüft ausschließlich bereits an anderer Stelle getrackte Werte,
    // beeinflusst also nie die eigentliche Spielbalance.
    const ACHIEVEMENT_DEFINITIONS = [
        { id: 'millionaire', icon: '💰', label: 'Millionär', desc: 'Vereinskonto erreicht 1.000.000 €', condition: () => game.money >= 1000000 },
        { id: 'multimillionaire', icon: '💰', label: 'Multimillionär', desc: 'Vereinskonto erreicht 10.000.000 €', condition: () => game.money >= 10000000 },
        { id: 'bundesliga', icon: '⚽', label: 'Ganz oben angekommen', desc: 'Aufstieg in die höchste Liga geschafft', condition: () => game.leagueLevel === 0 },
        { id: 'cup-winner', icon: '🏆', label: 'Pokalheld', desc: 'DFB-Pokal gewonnen', condition: () => (game.trophies || []).some(t => t.includes('DFB-Pokalsieger')) },
        { id: 'europe-winner', icon: '🌟', label: 'Europas Krone', desc: 'Champions Cup gewonnen', condition: () => (game.trophies || []).some(t => t.includes('Champions Cup Sieger')) },
        { id: 'unbeaten-10', icon: '🔥', label: 'Unbezwingbar', desc: '10 Spiele in Folge ungeschlagen', condition: () => (game.clubRecords?.longestUnbeatenStreak || 0) >= 10 },
        { id: 'unbeaten-20', icon: '🔥', label: 'Wall aus Stahl', desc: '20 Spiele in Folge ungeschlagen', condition: () => (game.clubRecords?.longestUnbeatenStreak || 0) >= 20 },
        { id: 'perfect-season', icon: '💯', label: 'Makellos', desc: 'Eine komplette Saison ohne Niederlage', condition: () => (game.trophies || []).some(t => t.includes('Ungeschlagene Saison')) },
        { id: 'legend', icon: '👑', label: 'Vereinslegende', desc: 'Legenden-Status durch Vereinstreue erreicht', condition: () => game.legendStatus === true },
        { id: 'second-team', icon: '🥈', label: 'Doppelt aufgestellt', desc: 'Zweite Mannschaft gegründet', condition: () => game.secondTeam?.isActive === true },
        { id: 'youth-academy', icon: '🎓', label: 'Talentschmiede', desc: 'Jugendakademie auf Stufe 3 ausgebaut', condition: () => (game.youthAcademyLvl || 0) >= 3 },
        { id: 'survived-sacking', icon: '🚪', label: 'Comeback-Manager', desc: 'Die erste Entlassung überstanden und weitergemacht', condition: () => (game.timesSacked || 0) >= 1 }
    ];
    function checkAchievements() {
        if (!game.achievements) game.achievements = [];
        ACHIEVEMENT_DEFINITIONS.forEach(def => {
            if (game.achievements.some(a => a.id === def.id)) return;
            if (!def.condition()) return;
            game.achievements.push({ id: def.id, season: game.season, matchday: game.matchday });
            addInboxMessage('vertrag', `🎖️ Achievement freigeschaltet: ${def.label}!`, `${def.icon} ${def.label} - ${def.desc}`, 'screen-history');
            showToast(`🎖️ Achievement: ${def.label}!`, 'success');
        });
    }
    function renderAchievementsBox() {
        let box = document.getElementById('achievements-box');
        if (!box) return;
        let unlocked = new Set((game.achievements || []).map(a => a.id));
        box.innerHTML = `
            <div style="font-size:9px; color:var(--text-muted); margin-bottom:4px;">${unlocked.size} / ${ACHIEVEMENT_DEFINITIONS.length} freigeschaltet</div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
                ${ACHIEVEMENT_DEFINITIONS.map(def => {
                    let isUnlocked = unlocked.has(def.id);
                    return `<div title="${def.desc}" style="text-align:center; padding:6px 2px; border-radius:8px; background:${isUnlocked ? 'rgba(23,201,184,0.15)' : 'rgba(255,255,255,0.04)'}; opacity:${isUnlocked ? '1' : '0.35'};">
                        <div style="font-size:20px;">${def.icon}</div>
                        <div style="font-size:8px; margin-top:2px;">${def.label}</div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }
