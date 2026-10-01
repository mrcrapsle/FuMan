/* eslint-disable no-undef */
// Jugend-Laufbahn: macht den Weg eines Talents sichtbar.
// - Potenzial: jedes Talent hat eine echte Obergrenze p.potential (aus der Potenzial-Stufe);
//   ohne Prüfung ist sie unbekannt, nach der Prüfung als Spanne sichtbar. Die monatliche
//   Entwicklung (tickYouthDevelopment) wächst bis zu dieser Grenze.
// - Alterung: Talente werden am Saisonende ein Jahr älter (ageYouthAtSeasonEnd). Mit 19 endet
//   die A-Jugend: Profivertrag, Leihe, Reserve oder Abschied - wer nach 8 Spieltagen keine
//   Entscheidung hat, wechselt gegen eine kleine Ausbildungsentschädigung.
// - Leihe zur Entwicklung: Talente ab 17 gehen zu einem echten KI-Verein (Liga tiefer = mehr
//   Spielzeit, eigene Liga = höheres Niveau). Einsätze, Tore und Fortschritt werden je Spieltag
//   in tickLoanedPlayers() gezählt; die Leihe läuft über loanedPlayers (youthLoan: true).
// - Durchbruch-Momente: Leistungssprünge in der Akademie, Profidebüt, erstes Profitor und
//   erste Elf des Spieltags eigener Absolventen landen in game.youthMoments.

const YOUTH_POTENTIAL_RANGE = { 1: [58, 68], 2: [67, 78], 3: [77, 89] };
const YOUTH_PRO_AGE = 19;
const YOUTH_DECISION_MATCHDAYS = 8;
let youthLoanChoiceId = null;

function ensureYouthPotential(p) {
    if (!p) return p;
    if (!p.potentialTier && typeof assignYouthPotentialTier === 'function') assignYouthPotentialTier(p);
    if (typeof p.potential !== 'number') {
        const [lo, hi] = YOUTH_POTENTIAL_RANGE[p.potentialTier] || [60, 72];
        p.potential = Math.max(p.strength + 4, lo + Math.floor(Math.random() * (hi - lo + 1)));
    }
    if (typeof p.youthSeasonStart !== 'number') p.youthSeasonStart = p.strength;
    return p;
}

function getYouthPotentialText(p) {
    if (!p.potentialRevealed) return '❓ unbekannt';
    return `${Math.max(p.strength, p.potential - 2)}-${p.potential + 2}`;
}

function addYouthMoment(icon, text) {
    if (!game.youthMoments) game.youthMoments = [];
    game.youthMoments.unshift({ season: game.season, matchday: game.matchday, icon, text });
    if (game.youthMoments.length > 15) game.youthMoments.length = 15;
}

// ---------- Profivertrag ----------
// Der Marktwert streut zufällig - das Angebot wird je Stärke festgehalten, damit die Karte
// genau das Gehalt zeigt, das unterschrieben wird.
function getYouthProWage(p) {
    if (p.proWageQuote && p.proWageQuote.strength === p.strength) return p.proWageQuote.wage;
    const basis = calculatePlayerWage(calculatePlayerMarketValue(p.strength), p.strength);
    // Ausnahmetalente wissen um ihren Wert, Mittelmaß nimmt, was es bekommt.
    const wage = Math.round(basis * ({ 1: 0.8, 2: 1, 3: 1.3 }[p.potentialTier] || 1) / 10) * 10;
    p.proWageQuote = { strength: p.strength, wage };
    return wage;
}

// Aus promoteYouth(): echter Profivertrag statt Jugendkonditionen.
function signYouthProContract(p) {
    p.contracts = 3;
    p.wage = getYouthProWage(p);
    p.academyGraduate = true;
    p.proDecisionLeft = null;
    delete p.proWageQuote;
    p.milestones = p.milestones || {};
}

// ---------- Alterung & Entscheidung mit 19 ----------
function ageYouthAtSeasonEnd() {
    const faellig = [];
    const altern = p => {
        ensureYouthPotential(p);
        p.age = (p.age || 17) + 1;
        p.youthSeasonStart = p.strength;
        if (p.age >= YOUTH_PRO_AGE && !p.proDecisionLeft) { p.proDecisionLeft = YOUTH_DECISION_MATCHDAYS; faellig.push(p); }
    };
    youthTalents.forEach(altern);
    (loanedPlayers || []).filter(l => l.youthLoan).forEach(l => altern(l.player));
    if (faellig.length) {
        addInboxMessage('vertrag', `✍️ Profivertrag-Entscheidung: ${faellig.map(p => p.name).join(', ')}`,
            `${faellig.map(p => `${p.name} (${p.pos}, Stärke ${p.strength}, Potenzial ${getYouthPotentialText(p)})`).join('; ')} ${faellig.length > 1 ? 'sind' : 'ist'} der A-Jugend entwachsen. ` +
            `Profivertrag, Leihe, Reserve oder Abschied - entscheide in der Jugendakademie innerhalb von ${YOUTH_DECISION_MATCHDAYS} Spieltagen, sonst ${faellig.length > 1 ? 'wechseln sie' : 'wechselt er'} ablösefrei.`, 'screen-youth');
    }
}

// Jeden Spieltag: offene Entscheidungen laufen ab.
function tickYouthProDecisions() {
    for (let i = youthTalents.length - 1; i >= 0; i--) {
        const p = youthTalents[i];
        if (!p.proDecisionLeft) continue;
        p.proDecisionLeft--;
        if (p.proDecisionLeft === 3) addInboxMessage('vertrag', `⏳ ${p.name} wartet auf ein Angebot`, `Noch 3 Spieltage: ohne Profivertrag, Leihe oder Reserve verlässt ${p.name} den Verein.`, 'screen-youth');
        if (p.proDecisionLeft <= 0) {
            youthTalents.splice(i, 1);
            game.youthHospitants = (game.youthHospitants || []).filter(id => id !== p.id);
            const entschaedigung = Math.round(calculatePlayerMarketValue(p.strength) * 0.1 / 100) * 100;
            game.money += entschaedigung;
            const ziel = getYouthLoanClubs(p)[0];
            addYouthMoment('👋', `${p.name} (${p.strength}) wechselt ohne Profivertrag zu ${ziel ? ziel.name : 'einem anderen Verein'}`);
            addInboxMessage('vertrag', `👋 ${p.name} ist weg`, `Ohne Angebot hat ${p.name} bei ${ziel ? ziel.name : 'einem anderen Verein'} unterschrieben. Ausbildungsentschädigung: ${formatVal(entschaedigung)}.`, 'screen-youth');
        }
    }
}

// ---------- Leihe zur Entwicklung ----------
// Drei echte KI-Vereine: zwei eine Liga tiefer (Stammplatz) und einer eine Liga höher als die
// Stammplatz-Liga (höheres Niveau, weniger Spielzeit). In der untersten Liga kommen die
// Stammplatz-Vereine aus der eigenen Liga und die Herausforderung aus der Liga darüber.
function getYouthLoanClubs(p) {
    const stamm = Math.min(leaguesData.length - 1, game.leagueLevel + 1);
    const hoch = Math.max(0, stamm - 1);
    const pick = (level, n, aufschlag) => [...(leaguesData[level] || [])].filter(t => typeof isAiClub === 'function' ? isAiClub(t) : t.name !== game.clubName)
        .sort((a, b) => Math.abs(a.strength - p.strength - aufschlag) - Math.abs(b.strength - p.strength - aufschlag))
        .slice(0, n).map(t => ({ name: t.name, level, strength: t.strength }));
    const stammVereine = pick(stamm, 2, 0);
    return [...stammVereine, ...pick(hoch, 3, 6).filter(c => !stammVereine.some(v => v.name === c.name)).slice(0, 1)];
}

function getYouthLoanPlayChance(p, clubStrength) {
    return Math.max(0.15, Math.min(0.95, 0.55 + (p.strength - clubStrength) * 0.04));
}

function getYouthLoanDevPerApp(p, clubStrength) {
    return 0.25 + Math.max(0, clubStrength - p.strength) * 0.015;
}

function openYouthLoanChoice(id) {
    youthLoanChoiceId = youthLoanChoiceId === id ? null : id;
    renderYouthPathwayBoxes();
}

function loanYouthForDevelopment(id, clubName) {
    const p = youthTalents.find(y => y.id === id);
    if (!p) return;
    if ((p.age || 0) < 17) { showToast('Leihen sind erst ab 17 Jahren möglich.', 'error'); return; }
    const club = getYouthLoanClubs(p).find(c => c.name === clubName);
    if (!club) return;
    ensureYouthPotential(p);
    const dauer = Math.max(8, Math.min(17, 34 - game.matchday));
    youthTalents = youthTalents.filter(y => y.id !== id);
    game.youthHospitants = (game.youthHospitants || []).filter(h => h !== id);
    p.proDecisionLeft = null;
    loanedPlayers.push({ player: p, loanClub: club.name, duration: dauer, originalStrength: p.strength, youthLoan: true, clubStrength: club.strength, apps: 0, goals: 0, devProgress: 0 });
    youthLoanChoiceId = null;
    playSound('click');
    addYouthMoment('📤', `${p.name} geht für ${dauer} Spieltage zu ${club.name} (${leagueNames[club.level]})`);
    showToast(`📤 ${p.name} für ${dauer} Spieltage an ${club.name} verliehen`, 'success');
    renderYouthView();
    updateUI();
}

// Aus tickLoanedPlayers(): ein Spieltag beim Leihverein.
function tickYouthLoanMatchday(loan) {
    const p = loan.player;
    if (Math.random() < getYouthLoanPlayChance(p, loan.clubStrength)) {
        loan.apps++;
        if (Math.random() < ({ ST: 0.3, MIT: 0.12, ABW: 0.04, TW: 0 }[p.pos] || 0.1)) loan.goals++;
        loan.devProgress += getYouthLoanDevPerApp(p, loan.clubStrength) * ({ 1: 0.8, 2: 1, 3: 1.3 }[p.potentialTier] || 1);
    } else {
        loan.devProgress += 0.03;
    }
    if (loan.devProgress >= 1 && p.strength < (p.potential || 99)) { loan.devProgress -= 1; p.strength++; }
}

// Aus tickLoanedPlayers() bei Leihende (oder Rückruf): zurück in die Akademie.
function returnYouthFromLoan(loan) {
    const p = loan.player;
    youthTalents.push(p);
    if ((p.age || 0) >= YOUTH_PRO_AGE && !p.proDecisionLeft) p.proDecisionLeft = YOUTH_DECISION_MATCHDAYS;
    const plus = p.strength - loan.originalStrength;
    addYouthMoment('📥', `${p.name} zurück von ${loan.loanClub}: ${loan.apps} Einsätze, ${loan.goals} Tore, ${plus > 0 ? '+' : ''}${plus} Stärke`);
    addInboxMessage('vertrag', `📥 ${p.name} zurück von der Leihe`, `Bilanz bei ${loan.loanClub}: ${loan.apps} Einsätze, ${loan.goals} Tore. Stärke ${loan.originalStrength} → ${p.strength}.`, 'screen-youth');
}

// ---------- Durchbruch-Momente ----------
// Monatlich: ein Talent mit Luft nach oben legt einen Leistungssprung hin.
function tickYouthBreakthroughs() {
    youthTalents.forEach(p => {
        ensureYouthPotential(p);
        const luft = p.potential - p.strength;
        if (luft < 6 || Math.random() > 0.04 * ({ 1: 0.5, 2: 1, 3: 1.8 }[p.potentialTier] || 1)) return;
        const sprung = Math.min(luft - 2, 3 + Math.floor(Math.random() * 3));
        p.strength += sprung;
        addYouthMoment('💥', `Durchbruch: ${p.name} (${p.age} J.) legt einen Leistungssprung hin, +${sprung} auf ${p.strength}`);
        addInboxMessage('vertrag', `💥 Durchbruch in der Akademie: ${p.name}`, `${p.name} (${p.pos}, ${p.age} Jahre) hat im Training den Knoten platzen lassen: Stärke +${sprung}, jetzt ${p.strength}.`, 'screen-youth');
    });
}

// Aus gradeOwnMatch(): Profidebüt, erstes Profitor und erste Elf des Spieltags eigener Absolventen.
function checkYouthMilestones(starter, tore) {
    starter.filter(p => p.academyGraduate).forEach(p => {
        const m = p.milestones || (p.milestones = {});
        const wann = `S${game.season}/SpT ${game.matchday}`;
        if (!m.debut) { m.debut = wann; addYouthMoment('🎉', `Profidebüt: ${p.name} (${p.age} J.) steht erstmals in der Startelf`); }
        if (!m.tor && (tore[p.id] || 0) > 0) { m.tor = wann; addYouthMoment('⚽', `Erstes Profitor: ${p.name} trifft für ${game.clubName}`); p.morale = Math.min(100, (p.morale || 50) + 5); }
        if (!m.elf && p.lastGrade <= 1.5) { m.elf = wann; addYouthMoment('⭐', `${p.name} zum ersten Mal in der Elf des Spieltags (Note ${formatGrade(p.lastGrade)})`); }
    });
}

// ---------- Anzeige ----------
function renderYouthDecisionBox() {
    const box = document.getElementById('youth-decision-box');
    if (!box) return;
    const offen = youthTalents.filter(p => p.proDecisionLeft);
    if (!offen.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="panel" style="border:1px solid var(--accent);">
        <div class="panel-header" style="color:var(--accent);">✍️ PROFIVERTRAG-ENTSCHEIDUNG</div>
        ${offen.map(p => {
            const idx = youthTalents.indexOf(p);
            return `<div class="box" style="font-size:10px;">
                <strong>${p.name}</strong> (${p.pos}, ${p.age} J., Stärke ${p.strength}, Potenzial ${getYouthPotentialText(p)}) - noch <strong>${p.proDecisionLeft}</strong> Spieltage
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:6px;">
                    <button onclick="promoteYouth(${idx}, this)" class="btn-action" style="font-size:9px;">✍️ Profivertrag (3 J., ${formatVal(getYouthProWage(p))}/SpT)</button>
                    <button onclick="openYouthLoanChoice('${p.id}')" class="btn-secondary" style="font-size:9px;">📤 Verleihen</button>
                    ${game.secondTeam.isActive ? `<button onclick="promoteYouthToSecondTeam(${idx}, this)" class="btn-secondary" style="font-size:9px;">🅱️ In die Reserve</button>` : ''}
                    <button onclick="releaseYouthTalent('${p.id}', this)" class="btn-secondary" style="font-size:9px; color:var(--danger);">👋 Ziehen lassen</button>
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

function renderYouthLoanChoiceBox() {
    const box = document.getElementById('youth-loan-choice-box');
    if (!box) return;
    const p = youthTalents.find(y => y.id === youthLoanChoiceId);
    if (!p) { box.innerHTML = ''; youthLoanChoiceId = null; return; }
    const dauer = Math.max(8, Math.min(17, 34 - game.matchday));
    box.innerHTML = `<div class="panel" style="border:1px solid var(--teal);">
        <div class="panel-header" style="color:var(--teal);">📤 LEIHE ZUR ENTWICKLUNG: ${p.name} (${p.strength})</div>
        <div style="font-size:9px; color:var(--text-muted); margin-bottom:6px;">${dauer} Spieltage. Mehr Spielzeit oder höheres Niveau - beides bringt Entwicklung.</div>
        ${getYouthLoanClubs(p).map(c => {
            const spielzeit = Math.round(getYouthLoanPlayChance(p, c.strength) * 100);
            const proSpiel = getYouthLoanDevPerApp(p, c.strength);
            return `<div class="box" style="display:flex; justify-content:space-between; align-items:center; gap:6px; font-size:9px;">
                <span><strong>${c.name}</strong> · ${leagueNames[c.level]} · Stärke ${c.strength}<br>Spielzeit ca. ${spielzeit} % · Entwicklung je Einsatz ${proSpiel >= 0.3 ? 'hoch' : 'normal'}</span>
                <button onclick="loanYouthForDevelopment('${p.id}', '${c.name.replace(/'/g, "\\'")}')" class="btn-action" style="width:auto; font-size:9px;">Verleihen</button>
            </div>`;
        }).join('')}
        <button onclick="openYouthLoanChoice('${p.id}')" class="btn-secondary" style="width:auto; font-size:9px;">Abbrechen</button>
    </div>`;
}

function renderYouthLoansBox() {
    const box = document.getElementById('youth-loans-box');
    if (!box) return;
    const leihen = (loanedPlayers || []).filter(l => l.youthLoan);
    box.innerHTML = leihen.length
        ? leihen.map(l => `<div class="box" style="font-size:9px;">📤 <strong>${l.player.name}</strong> bei ${l.loanClub} · noch ${l.duration} SpT · ${l.apps} Einsätze, ${l.goals} Tore · Stärke ${l.originalStrength} → ${l.player.strength}</div>`).join('')
        : '<div style="font-size:9px; color:var(--text-muted);">Kein Talent verliehen. Ab 17 Jahren kann ein Talent bei einem anderen Verein Spielpraxis sammeln.</div>';
}

function renderYouthPotentialBox() {
    const box = document.getElementById('youth-leaderboard-box');
    if (!box) return;
    const liste = [...youthTalents].map(ensureYouthPotential).sort((a, b) => b.strength - a.strength);
    if (!liste.length) { box.innerHTML = '<div style="font-size:9px; color:var(--text-muted);">Keine Talente in der Akademie.</div>'; return; }
    box.innerHTML = liste.map(p => {
        const plus = p.strength - p.youthSeasonStart;
        const ziel = p.potentialRevealed ? p.potential : Math.max(p.strength + 1, 90);
        const breite = Math.round(Math.min(100, p.strength / ziel * 100));
        return `<div style="font-size:9px; margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between;"><span>${p.name} <span style="color:var(--text-muted);">${p.pos}, ${p.age} J.</span></span>
                <span>Stärke <strong>${p.strength}</strong>${plus ? ` <span style="color:${plus > 0 ? 'var(--primary)' : 'var(--danger)'};">(${plus > 0 ? '+' : ''}${plus} diese Saison)</span>` : ''} · Potenzial ${getYouthPotentialText(p)}</span></div>
            <div style="height:6px; background:rgba(150,150,150,0.2); border-radius:3px; margin-top:2px;"><div style="height:6px; width:${breite}%; background:${p.potentialRevealed ? 'var(--primary)' : 'var(--text-muted)'}; border-radius:3px;"></div></div>
        </div>`;
    }).join('') + '<div style="font-size:8px; color:var(--text-muted);">Balken: Stärke im Verhältnis zum Potenzial (grau = Potenzial noch nicht geprüft).</div>';
}

function renderYouthMomentsBox() {
    const box = document.getElementById('youth-moments-box');
    if (!box) return;
    const liste = game.youthMoments || [];
    box.innerHTML = liste.length
        ? liste.slice(0, 10).map(m => `<div class="box" style="font-size:9px;">${m.icon} <span style="color:var(--text-muted);">S${m.season}/SpT ${m.matchday}:</span> ${m.text}</div>`).join('')
        : '<div style="font-size:9px; color:var(--text-muted);">Noch keine besonderen Momente. Durchbrüche, Leihen und Profidebüts eigener Talente erscheinen hier.</div>';
}

function renderYouthPathwayBoxes() {
    renderYouthDecisionBox();
    renderYouthLoanChoiceBox();
    renderYouthLoansBox();
    renderYouthPotentialBox();
    renderYouthMomentsBox();
}
