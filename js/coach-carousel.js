// Trainerkarussell: Jeder KI-Verein hat einen Trainer. Bei anhaltendem Misserfolg (hinten in
// der Tabelle, schwache Form) wird er entlassen - der Nachfolger bringt einen anderen
// Spielstil und kurzfristig Schwung (+3 Stärke für 4 Spieltage, "Trainereffekt"). Der
// Trainer des permanenten Rivalen ist game.rivalManagerName und wird mitgeführt.

const COACH_BOUNCE = 3;
const COACH_BOUNCE_MATCHDAYS = 4;

function getTeamCoach(team) {
    if (!team.coach) team.coach = { name: team.name === game.permanentRivalName && game.rivalManagerName ? game.rivalManagerName : getRandomName(), since: game.season, sackedThisSeason: false };
    return team.coach;
}

function coachCarouselTeams() {
    const reserve = game.secondTeam && game.secondTeam.name;
    return (leaguesData[game.leagueLevel] || []).filter(t => t.name !== game.clubName && t.name !== reserve);
}

// Monatlich: Entlassungen in der eigenen Liga.
function tickCoachCarousel() {
    if (game.matchday < 8 || game.matchday > 30) return;
    const table = [...(leaguesData[game.leagueLevel] || [])].sort(compareTableRows);
    const meldungen = [];
    coachCarouselTeams().forEach(t => {
        const coach = getTeamCoach(t);
        if (coach.sackedThisSeason === game.season) return;
        const rank = table.indexOf(t) + 1;
        const niederlagen = (t.recentForm || []).filter(r => r === 'L').length;
        let chance = 0;
        if (rank >= 15 && niederlagen >= 3) chance = 0.35;
        else if (rank >= 16) chance = 0.15;
        else if (niederlagen >= 4) chance = 0.12;
        if (Math.random() >= chance) return;

        const alt = coach.name;
        const altStil = getTeamPlaystyle(t);
        const neueStile = AI_PLAYSTYLES.filter(s => s.id !== t.playstyle);
        t.playstyle = neueStile[Math.floor(Math.random() * neueStile.length)].id;
        let neu = getRandomName();
        if (t.name === game.permanentRivalName && typeof assignRivalManagerPersonality === 'function') {
            assignRivalManagerPersonality();
            neu = game.rivalManagerName;
        }
        t.coach = { name: neu, since: game.season, sackedThisSeason: game.season };
        if (typeof onCoachSacked === 'function') onCoachSacked(t, alt);
        t.coachBounce = { amount: COACH_BOUNCE, until: game.matchday + COACH_BOUNCE_MATCHDAYS };
        t.baseStrength = (t.baseStrength || t.strength) + COACH_BOUNCE;
        t.strength += COACH_BOUNCE;
        meldungen.push({ t, alt, neu, rank, altStil: altStil.label, neuStil: getTeamPlaystyle(t).label });
    });
    meldungen.forEach(m => {
        addInboxMessage('vertrag', `🎠 Trainerwechsel bei ${m.t.name}`,
            `${m.t.name} (Platz ${m.rank}) trennt sich von Trainer ${m.alt}. Nachfolger ${m.neu} stellt von „${m.altStil}“ auf „${m.neuStil}“ um - in den nächsten ${COACH_BOUNCE_MATCHDAYS} Spieltagen ist mit einem Trainereffekt zu rechnen.`, 'screen-league');
    });
    if (!game.coachChanges) game.coachChanges = [];
    meldungen.forEach(m => game.coachChanges.push({ season: game.season, matchday: game.matchday, club: m.t.name, alt: m.alt, neu: m.neu }));
    if (game.coachChanges.length > 30) game.coachChanges.splice(0, game.coachChanges.length - 30);
}

// Jeden Spieltag: abgelaufenen Trainereffekt wieder herausnehmen.
function tickCoachBounce(force = false) {
    (leaguesData || []).forEach(table => table.forEach(t => {
        if (t.coachBounce && (force || game.matchday >= t.coachBounce.until)) {
            t.baseStrength -= t.coachBounce.amount;
            t.strength -= t.coachBounce.amount;
            delete t.coachBounce;
        }
    }));
}

// Kurzinfo für Spielanalyse und Prognose.
function getCoachInfoHtml(team) {
    if (!team || team.name === game.clubName) return '';
    const coach = getTeamCoach(team);
    const neu = team.coachBounce ? ' <span style="color:var(--accent);">(neuer Trainer - Trainereffekt!)</span>' : '';
    return `🎩 Trainer: <strong>${coach.name}</strong>${neu}`;
}

function renderCoachCarouselBox() {
    const box = document.getElementById('coach-carousel-box');
    if (!box) return;
    const wechsel = (game.coachChanges || []).filter(c => c.season === game.season).slice().reverse();
    box.innerHTML = `<div style="font-size:9px;">${wechsel.length
        ? wechsel.map(c => `<div style="padding:2px 0; border-top:1px solid rgba(255,255,255,0.06);">Spt ${c.matchday}: <strong>${c.club}</strong> - ${c.alt} ➜ ${c.neu}</div>`).join('')
        : '<span style="color:var(--text-muted);">Diese Saison noch keine Trainerwechsel in deiner Liga.</span>'}</div>`;
}
