
    // ==========================================
    // KADERPLANUNGSTOOL (NEU)
    // ==========================================
    // Positionstiefe (siehe renderSquadDepthChart in squad.js), Altersstruktur und auslaufende
    // Verträge (siehe renderSeasonPlanningBox in contracts.js) existierten bisher als drei
    // getrennte, unabhängige Kästen auf zwei verschiedenen Screens - eine Schwäche, die erst
    // durch das ZUSAMMENSPIEL aller drei Faktoren entsteht (z.B. eine dünn besetzte Abwehr,
    // die ZUGLEICH überaltert ist UND reihenweise auslaufende Verträge hat), war nirgends auf
    // einen Blick sichtbar. Dieser eigene Screen führt alle drei zusammen und leitet daraus
    // konkrete, positionsscharfe Warnungen für die kommenden Saisons ab.

    const SQUAD_PLANNING_POS_LABELS = { TW: '🧤 Torwart', ABW: '🛡️ Abwehr', MIT: '⚙️ Mittelfeld', ST: '⚡ Sturm' };
    // Dieselben Mindestwerte wie in renderSquadDepthChart() (squad.js), damit "dünn besetzt"
    // im ganzen Spiel dasselbe bedeutet.
    const SQUAD_PLANNING_MIN_HEALTHY = { TW: 2, ABW: 5, MIT: 5, ST: 3 };
    const SQUAD_PLANNING_AGING_THRESHOLD = 30; // ab diesem Alter zählt ein Spieler als "im Herbst der Karriere"
    const SQUAD_PLANNING_CONTRACT_URGENT = 1; // <= X Jahre Restlaufzeit = dringend (wie in renderSeasonPlanningBox)

    // Zentrale Analyse pro Positionsgruppe - wird von allen Kästen dieses Tools genutzt, damit
    // die Zahlen (und die daraus abgeleitete Risikostufe) garantiert übereinstimmen.
    function getSquadPlanningAnalysis() {
        return Object.keys(SQUAD_PLANNING_POS_LABELS).map(pos => {
            let players = squad.filter(p => p.pos === pos);
            let count = players.length;
            let avgAge = count > 0 ? players.reduce((s, p) => s + p.age, 0) / count : 0;
            let aging = players.filter(p => p.age >= SQUAD_PLANNING_AGING_THRESHOLD);
            let cliff = players.filter(p => p.contracts <= SQUAD_PLANNING_CONTRACT_URGENT);
            let minHealthy = SQUAD_PLANNING_MIN_HEALTHY[pos];

            let thin = count < minHealthy;
            // "Überaltert": mindestens die Hälfte der Positionsgruppe ist 30+ - bei sehr kleinen
            // Gruppen (z.B. 2 Torhüter) reicht das nicht für ein Fehlurteil durch einen einzigen
            // Ausreißer, weil dann gleichzeitig meist auch "thin" bereits zuschlägt.
            let agingRisk = count > 0 && (aging.length / count) >= 0.5;
            // "Vertragsklippe": mindestens die Hälfte der ohnehin für diese Position nötigen
            // Mindestbesetzung läuft binnen der erlaubten Frist aus - unabhängig von der
            // tatsächlichen (evtl. größeren) Kadergröße, damit auch ein Kader mit vielen
            // Ergänzungsspielern die Kernbesetzung nicht künstlich verdeckt.
            let cliffRisk = cliff.length >= Math.ceil(minHealthy / 2);

            let riskScore = (thin ? 1 : 0) + (agingRisk ? 1 : 0) + (cliffRisk ? 1 : 0);
            let riskLabel = riskScore >= 2 ? '🔴 KRITISCH' : (riskScore === 1 ? '🟡 BEOBACHTEN' : '🟢 SOLIDE');
            let riskColor = riskScore >= 2 ? 'var(--danger)' : (riskScore === 1 ? 'var(--accent)' : 'var(--primary)');

            return { pos, label: SQUAD_PLANNING_POS_LABELS[pos], players, count, avgAge, aging, cliff, minHealthy, thin, agingRisk, cliffRisk, riskScore, riskLabel, riskColor };
        });
    }

    function renderSquadPlanningPositionBox() {
        let box = document.getElementById('squad-planning-position-box');
        if (!box) return;
        if (squad.length === 0) { box.innerHTML = '<div class="box">Kein Kader vorhanden.</div>'; return; }
        let analysis = getSquadPlanningAnalysis();
        box.innerHTML = analysis.map(a => `
            <div class="box" style="border-left-color:${a.riskColor}; margin-bottom:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; margin-bottom:2px;">
                    <span>${a.label}</span>
                    <strong style="color:${a.riskColor};">${a.riskLabel}</strong>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:3px; font-size:8px; color:var(--text-muted);">
                    <div>Besetzung: <strong style="color:${a.thin ? 'var(--danger)' : 'var(--text-primary)'};">${a.count} / ${a.minHealthy}+</strong></div>
                    <div>Ø Alter: <strong style="color:${a.agingRisk ? 'var(--danger)' : 'var(--text-primary)'};">${a.avgAge.toFixed(1)} J.</strong></div>
                    <div>Vertrag ≤${SQUAD_PLANNING_CONTRACT_URGENT} J.: <strong style="color:${a.cliffRisk ? 'var(--danger)' : 'var(--text-primary)'};">${a.cliff.length} Spieler</strong></div>
                </div>
            </div>`).join('');
    }

    // ALTERSPYRAMIDE: zeigt die Verteilung über den GESAMTEN Kader statt nur einen einzelnen
    // Durchschnittswert (siehe renderSquadOverviewBox in squad.js) - ein Kader kann im Schnitt
    // "passend" wirken, obwohl er tatsächlich aus zwei Extremgruppen (viele sehr junge UND
    // viele sehr alte Spieler, kaum jemand in der Mitte) besteht.
    const SQUAD_PLANNING_AGE_BUCKETS = [
        { label: 'bis 20', test: a => a <= 20 },
        { label: '21-24', test: a => a >= 21 && a <= 24 },
        { label: '25-28', test: a => a >= 25 && a <= 28 },
        { label: '29-31', test: a => a >= 29 && a <= 31 },
        { label: '32+', test: a => a >= 32 }
    ];
    function renderSquadPlanningAgeBox() {
        let box = document.getElementById('squad-planning-age-box');
        if (!box) return;
        if (squad.length === 0) { box.innerHTML = ''; return; }
        let maxCount = Math.max(1, ...SQUAD_PLANNING_AGE_BUCKETS.map(b => squad.filter(p => b.test(p.age)).length));
        box.innerHTML = SQUAD_PLANNING_AGE_BUCKETS.map(b => {
            let count = squad.filter(p => b.test(p.age)).length;
            let pct = Math.round((count / maxCount) * 100);
            let isOld = b.label === '32+';
            return `
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px; font-size:9px;">
                    <span style="width:42px; color:var(--text-muted);">${b.label}</span>
                    <div style="flex:1; background:rgba(255,255,255,0.06); border-radius:999px; height:8px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${isOld ? 'var(--accent)' : 'var(--primary)'}; border-radius:999px;"></div>
                    </div>
                    <strong style="width:20px; text-align:right;">${count}</strong>
                </div>`;
        }).join('');
    }

    // AUSLAUFENDE VERTRÄGE NACH POSITION: renderSeasonPlanningBox() (contracts.js) listet
    // bereits alle dringenden Fälle namentlich auf - hier geht es NICHT um dieselbe Liste
    // nochmal, sondern um die Häufung PRO POSITION, damit sichtbar wird, WO die Vertragsklippe
    // tatsächlich liegt statt nur, DASS es welche gibt.
    function renderSquadPlanningContractBox() {
        let box = document.getElementById('squad-planning-contract-box');
        if (!box) return;
        if (squad.length === 0) { box.innerHTML = ''; return; }
        let analysis = getSquadPlanningAnalysis();
        let totalCliff = analysis.reduce((s, a) => s + a.cliff.length, 0);
        if (totalCliff === 0) {
            box.innerHTML = '<div class="box" style="font-size:9px; color:var(--primary);">✓ Keine Position hat eine gefährliche Häufung auslaufender Verträge.</div>';
            return;
        }
        box.innerHTML = analysis.filter(a => a.cliff.length > 0).map(a => `
            <div class="box" style="font-size:9px; display:flex; justify-content:space-between;${a.cliffRisk ? ' border-left-color:var(--danger);' : ''}">
                <span>${a.label}</span>
                <strong style="color:${a.cliffRisk ? 'var(--danger)' : 'var(--text-primary)'};">${a.cliff.map(p => p.name).join(', ')}</strong>
            </div>`).join('');
    }

    // KRITISCHE SCHWACHSTELLEN: verdichtet die Analyse zu konkreten, handlungsleitenden Sätzen -
    // genau der Mehrwert, der beim bloßen Nebeneinander der einzelnen Kästen fehlte.
    function renderSquadPlanningWarningsBox() {
        let box = document.getElementById('squad-planning-warnings-box');
        if (!box) return;
        if (squad.length === 0) { box.innerHTML = ''; return; }
        let analysis = getSquadPlanningAnalysis();
        let warnings = analysis.filter(a => a.riskScore >= 1).sort((a, b) => b.riskScore - a.riskScore).map(a => {
            let gruende = [];
            if (a.thin) gruende.push(`nur ${a.count} von mindestens ${a.minHealthy} nötigen Spielern`);
            if (a.agingRisk) gruende.push(`Ø-Alter ${a.avgAge.toFixed(1)} Jahre (${a.aging.length} Spieler ab ${SQUAD_PLANNING_AGING_THRESHOLD})`);
            if (a.cliffRisk) gruende.push(`${a.cliff.length} Vertrag(e) laufen in ≤${SQUAD_PLANNING_CONTRACT_URGENT} Jahr(en) aus`);
            return `<div class="box" style="border-left-color:${a.riskColor}; margin-bottom:4px;">
                <div style="font-size:10px; font-weight:800; color:${a.riskColor};">${a.riskLabel} · ${a.label}</div>
                <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${gruende.join(' · ')}</div>
            </div>`;
        }).join('');
        box.innerHTML = warnings || '<div class="box" style="font-size:9px; color:var(--primary);">✓ Keine Position zeigt aktuell eine kombinierte Schwäche für die kommenden Saisons.</div>';
    }

    function renderSquadPlanningView() {
        renderSquadPlanningPositionBox();
        renderSquadPlanningAgeBox();
        renderSquadPlanningContractBox();
        renderSquadPlanningWarningsBox();
    }
