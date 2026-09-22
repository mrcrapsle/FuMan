    // ==========================================
    // BÜRO-EREIGNISSE: BESUCHER IM MANAGERBÜRO
    // ==========================================
    // Das Managerbüro war bisher reine Kulisse mit Navigation - alles, was im Verein
    // passierte, landete als Text im Postfach. Jetzt kommen Leute vorbei und sitzen auf
    // dem Besucherstuhl vor dem Schreibtisch, bis man sich um sie kümmert. Jede Begegnung
    // hat mehrere Antworten mit echten, unterschiedlichen Folgen - es gibt bewusst keine
    // Option, die immer richtig ist.
    const OFFICE_EVENT_TIMEOUT = 5;      // Spieltage, dann gibt der Besucher auf
    const OFFICE_EVENT_CHANCE = 0.28;    // je Spieltag, wenn gerade niemand wartet

    // Jede Wirkung ist eine Funktion, damit sie erst beim Antworten ausgewertet wird und
    // die aktuellen Spielwerte benutzt (Ligastufe, Kontostand, Kadergrösse).
    const OFFICE_EVENTS = [
        {
            id: 'berater',
            person: 'Spielerberater',
            farbe: '#c084fc',
            titel: () => 'Ein Spielerberater wartet auf Sie',
            text: () => {
                let p = squad.length ? squad[Math.floor(Math.random() * squad.length)] : null;
                return `„Mein Klient${p ? ` ${p.name}` : ''} fühlt sich unter Wert bezahlt. Ein Zeichen des guten Willens wäre jetzt angebracht - sonst höre ich mich anderswo um."`;
            },
            optionen: [
                {
                    label: 'Handgeld zahlen',
                    hinweis: () => `${formatVal(getOfficeEventScaledSum(8000))} · Moral steigt`,
                    wirkung: () => {
                        let summe = getOfficeEventScaledSum(8000);
                        if (game.money < summe) return { ok: false, text: `Das Konto gibt ${formatVal(summe)} nicht her.` };
                        game.money -= summe;
                        squad.forEach(p => { p.morale = Math.min(100, p.morale + 4); });
                        return { ok: true, text: `${formatVal(summe)} gezahlt - die Kabine registriert das wohlwollend.` };
                    }
                },
                {
                    label: 'Freundlich ablehnen',
                    hinweis: () => 'Kostet nichts, drückt aber die Stimmung',
                    wirkung: () => {
                        squad.forEach(p => { p.morale = Math.max(10, p.morale - 3); });
                        return { ok: true, text: 'Der Berater zieht mit versteinerter Miene ab. Die Mannschaft hat davon gehört.' };
                    }
                },
                {
                    label: 'Auf die Vertragslage verweisen',
                    hinweis: () => 'Keine Folgen - vorerst',
                    wirkung: () => ({ ok: true, text: 'Sie verweisen auf laufende Verträge. Der Berater kommt wieder, so viel ist sicher.' })
                }
            ]
        },
        {
            id: 'fandelegation',
            person: 'Fan-Delegation',
            farbe: '#38bdf8',
            titel: () => 'Drei Fanvertreter bitten um ein Gespräch',
            text: () => `„Die Stehplatzpreise sind für viele von uns kaum noch zu stemmen. Wir wollen keine Ultras sein, die nur meckern - aber reden müssen wir."`,
            optionen: [
                {
                    label: 'Stehplätze billiger machen',
                    hinweis: () => '-2 € pro Stehplatz · Fans begeistert',
                    wirkung: () => {
                        game.ticketPrices.steh = Math.max(3, game.ticketPrices.steh - 2);
                        game.fans = Math.min(100, game.fans + 6);
                        return { ok: true, text: `Stehplätze kosten jetzt ${game.ticketPrices.steh} € - die Kurve feiert Sie dafür.` };
                    }
                },
                {
                    label: 'Fanprojekt mitfinanzieren',
                    hinweis: () => `${formatVal(getOfficeEventScaledSum(4000))} · Fans zufrieden`,
                    wirkung: () => {
                        let summe = getOfficeEventScaledSum(4000);
                        if (game.money < summe) return { ok: false, text: `Das Konto gibt ${formatVal(summe)} nicht her.` };
                        game.money -= summe;
                        game.fans = Math.min(100, game.fans + 4);
                        if (typeof fanCentralState !== 'undefined') fanCentralState.fanProjectFunded = true;
                        return { ok: true, text: `${formatVal(summe)} ins Fanprojekt - ein Signal, das ankommt.` };
                    }
                },
                {
                    label: 'Auf die Finanzlage verweisen',
                    hinweis: () => 'Fans enttäuscht',
                    wirkung: () => {
                        game.fans = Math.max(0, game.fans - 5);
                        return { ok: true, text: 'Sie legen die Zahlen offen. Verstanden wird das nicht überall.' };
                    }
                }
            ]
        },
        {
            id: 'journalist',
            person: 'Lokaljournalist',
            farbe: '#fbbf24',
            titel: () => 'Der Lokalreporter steht mit laufendem Aufnahmegerät da',
            text: () => `„Nur zwei Minuten! Wie ordnen Sie die aktuelle Lage ein - und was sagen Sie den Leuten, die schon an Ihnen zweifeln?"`,
            optionen: [
                {
                    label: 'Selbstbewusst antworten',
                    hinweis: () => 'Medienimage steigt, Vorstand wird hellhörig',
                    wirkung: () => {
                        game.managerMediaImage = Math.min(100, (game.managerMediaImage || 50) + 8);
                        game.boardSat = Math.max(0, (game.boardSat || 50) - 3);
                        return { ok: true, text: 'Eine kernige Ansage - die Schlagzeile ist Ihnen sicher, der Vorstand hebt die Augenbraue.' };
                    }
                },
                {
                    label: 'Bescheiden bleiben',
                    hinweis: () => 'Vorstand zufrieden, Medien gelangweilt',
                    wirkung: () => {
                        game.boardSat = Math.min(100, (game.boardSat || 50) + 4);
                        game.managerMediaImage = Math.max(0, (game.managerMediaImage || 50) - 2);
                        return { ok: true, text: 'Sie bleiben sachlich. Der Vorstand liest das gern, die Redaktion weniger.' };
                    }
                },
                {
                    label: 'Keine Zeit',
                    hinweis: () => 'Medienimage sinkt deutlich',
                    wirkung: () => {
                        game.managerMediaImage = Math.max(0, (game.managerMediaImage || 50) - 7);
                        return { ok: true, text: 'Die Tür fällt zu. Am nächsten Tag steht „Manager mauert" in der Zeitung.' };
                    }
                }
            ]
        },
        {
            id: 'platzwart',
            person: 'Platzwart',
            farbe: '#4ade80',
            titel: () => 'Der Platzwart steht mit schlammigen Stiefeln vor Ihnen',
            text: () => `„Chef, der Rasen ist durch. Wenn wir jetzt nichts machen, spielen wir bald auf einem Acker - und das sieht man dann auch."`,
            optionen: [
                {
                    label: 'Rasen sanieren lassen',
                    hinweis: () => `${formatVal(getOfficeEventScaledSum(6000))} · Heimstärke bleibt`,
                    wirkung: () => {
                        let summe = getOfficeEventScaledSum(6000);
                        if (game.money < summe) return { ok: false, text: `Das Konto gibt ${formatVal(summe)} nicht her.` };
                        game.money -= summe;
                        game.pitchDamaged = false;
                        return { ok: true, text: `${formatVal(summe)} für neue Soden und Drainage - der Platz ist wieder bespielbar.` };
                    }
                },
                {
                    label: 'Erst mal flicken lassen',
                    hinweis: () => 'Billiger, hält aber nicht lange',
                    wirkung: () => {
                        let summe = getOfficeEventScaledSum(1500);
                        if (game.money < summe) return { ok: false, text: `Selbst ${formatVal(summe)} sind gerade nicht drin.` };
                        game.money -= summe;
                        return { ok: true, text: `${formatVal(summe)} für eine Notreparatur. Der Platzwart schüttelt den Kopf.` };
                    }
                },
                {
                    label: 'Muss so gehen',
                    hinweis: () => 'Fans und Mannschaft leiden',
                    wirkung: () => {
                        game.pitchDamaged = true;
                        game.fans = Math.max(0, game.fans - 3);
                        squad.forEach(p => { p.morale = Math.max(10, p.morale - 2); });
                        return { ok: true, text: 'Es bleibt beim Acker. Auf dem wird in den nächsten Wochen gespielt.' };
                    }
                }
            ]
        },
        {
            id: 'nachwuchstrainer',
            person: 'Nachwuchstrainer',
            farbe: '#a3e635',
            titel: () => 'Der Nachwuchstrainer klopft an',
            text: () => `„Ich habe da einen Jungen, der bei uns nichts mehr lernt. Entweder er bekommt seine Chance, oder wir verlieren ihn an den nächsten Verein."`,
            optionen: [
                {
                    label: 'Den Jungen fördern',
                    hinweis: () => `${formatVal(getOfficeEventScaledSum(3000))} · Talent wird stärker`,
                    wirkung: () => {
                        let summe = getOfficeEventScaledSum(3000);
                        if (game.money < summe) return { ok: false, text: `Das Konto gibt ${formatVal(summe)} nicht her.` };
                        if (!youthTalents.length) return { ok: false, text: 'In der Jugendakademie ist derzeit niemand - erst scouten.' };
                        game.money -= summe;
                        let talent = youthTalents[Math.floor(Math.random() * youthTalents.length)];
                        talent.strength = Math.min(99, talent.strength + 3);
                        return { ok: true, text: `${talent.name} bekommt ein Extraprogramm und wächst auf Stärke ${talent.strength}.` };
                    }
                },
                {
                    label: 'Später',
                    hinweis: () => 'Keine Folgen',
                    wirkung: () => ({ ok: true, text: 'Der Trainer nickt knapp und geht. Er wird nachhaken.' })
                }
            ]
        },
        {
            id: 'steuerpruefer',
            person: 'Steuerprüfer',
            farbe: '#f87171',
            titel: () => 'Eine Prüferin des Finanzamts sitzt bereits im Besucherstuhl',
            text: () => financeCentralState.taxAdvisorHired
                ? `„Routineprüfung. Ihr Steuerberater hat allerdings sauber vorgearbeitet - das geht schnell."`
                : `„Routineprüfung. Ihre Unterlagen sind... sagen wir: ausbaufähig. Ohne fachliche Begleitung wird das unangenehm."`,
            optionen: [
                {
                    label: 'Prüfung über sich ergehen lassen',
                    hinweis: () => financeCentralState.taxAdvisorHired ? 'Mit Berater glimpflich' : 'Ohne Berater teuer',
                    wirkung: () => {
                        if (financeCentralState.taxAdvisorHired) {
                            return { ok: true, text: 'Alles belegt, alles sauber. Die Prüferin verabschiedet sich nach einer Stunde.' };
                        }
                        let nachzahlung = getOfficeEventScaledSum(12000);
                        game.money -= nachzahlung;
                        return { ok: true, text: `Nachzahlung über ${formatVal(nachzahlung)}. Ein Steuerberater hätte das verhindert.` };
                    }
                }
            ]
        },
        {
            id: 'sponsorbesuch',
            person: 'Sponsorenvertreterin',
            farbe: '#2dd4bf',
            titel: () => 'Ihre Ansprechpartnerin beim Hauptsponsor ist da',
            text: () => `„Wir hätten Lust auf eine gemeinsame Aktion am Spieltag. Kostet Sie Aufwand, bringt uns beiden Sichtbarkeit - und Ihnen einen Bonus."`,
            optionen: [
                {
                    label: 'Aktion zusagen',
                    hinweis: () => `Bonus ${formatVal(getOfficeEventScaledSum(9000))}, kostet etwas Kondition`,
                    wirkung: () => {
                        let bonus = getOfficeEventScaledSum(9000);
                        game.money += bonus;
                        squad.forEach(p => { p.fitness = Math.max(40, p.fitness - 3); });
                        return { ok: true, text: `Autogrammstunde und Fototermin durchgezogen - ${formatVal(bonus)} Bonus, dafür ein müder Kader.` };
                    }
                },
                {
                    label: 'Dankend ablehnen',
                    hinweis: () => 'Kein Bonus, kein Aufwand',
                    wirkung: () => ({ ok: true, text: 'Sie halten den Kader aus dem Termingeschäft heraus. Verständnis ja, Begeisterung nein.' })
                }
            ]
        },
        {
            id: 'vereinsaeltester',
            person: 'Vereinsältester',
            farbe: '#fdba74',
            titel: () => 'Ein Ehrenmitglied bittet um fünf Minuten',
            text: () => `„Ich bin seit 1974 dabei. Man hört, der Verein denke über Dinge nach, die nicht zu uns passen. Ich möchte nur wissen, wofür wir noch stehen."`,
            optionen: [
                {
                    label: 'Tradition zusichern',
                    hinweis: () => 'Fans begeistert, Vorstand skeptisch',
                    wirkung: () => {
                        game.fans = Math.min(100, game.fans + 7);
                        game.boardSat = Math.max(0, (game.boardSat || 50) - 4);
                        return { ok: true, text: 'Sie geben ein klares Bekenntnis ab. In der Kurve spricht sich das herum.' };
                    }
                },
                {
                    label: 'Wachstum verteidigen',
                    hinweis: () => 'Vorstand zufrieden, Fans verstimmt',
                    wirkung: () => {
                        game.boardSat = Math.min(100, (game.boardSat || 50) + 6);
                        game.fans = Math.max(0, game.fans - 4);
                        return { ok: true, text: 'Sie erklären den Kurs. Der Vorstand hört das gern, das Ehrenmitglied geht wortlos.' };
                    }
                }
            ]
        }
    ];

    // Alle Geldbeträge skalieren mit der Ligastufe - 8.000 € Handgeld sind in der
    // Kreisklasse ein Vermögen und in der Bundesliga Portokasse.
    function getOfficeEventScaledSum(basis) {
        let faktor = typeof leagueScaleFactor === 'function' ? leagueScaleFactor() : 1;
        return Math.round(basis * Math.pow(faktor, 3) / 100) * 100;
    }

    function getPendingOfficeEvent() {
        if (!game.officeEvent) return null;
        return OFFICE_EVENTS.find(e => e.id === game.officeEvent.id) || null;
    }

    function rollOfficeEvent() {
        if (game.officeEvent) { checkOfficeEventTimeout(); return; }
        if (Math.random() > OFFICE_EVENT_CHANCE) return;
        let ereignis = OFFICE_EVENTS[Math.floor(Math.random() * OFFICE_EVENTS.length)];
        game.officeEvent = {
            id: ereignis.id,
            seit: game.matchday,
            season: game.season,
            titel: ereignis.titel(),
            text: ereignis.text()
        };
        addInboxMessage('vertrag', `🚪 Besuch im Büro: ${ereignis.person}`,
            `${game.officeEvent.titel}. Im Managerbüro wartet jemand auf eine Antwort - wer zu lange wartet, verpasst die Gelegenheit.`, 'screen-office');
    }

    // Wer sich nicht kümmert, verpasst die Gelegenheit. Das Ereignis blockiert also nie,
    // auch wenn jemand das Büro nie betritt.
    function checkOfficeEventTimeout() {
        if (!game.officeEvent) return;
        let gewartet = (game.matchday - game.officeEvent.seit) + (game.season > game.officeEvent.season ? 34 : 0);
        if (gewartet < OFFICE_EVENT_TIMEOUT) return;
        let ereignis = getPendingOfficeEvent();
        addInboxMessage('vertrag', `🚪 ${ereignis ? ereignis.person : 'Der Besucher'} hat das Warten aufgegeben`,
            'Niemand hat sich im Büro um das Anliegen gekümmert. Die Gelegenheit ist vorbei.', 'screen-office');
        game.officeEvent = null;
    }

    function resolveOfficeEvent(index) {
        let ereignis = getPendingOfficeEvent();
        if (!ereignis) return;
        let option = ereignis.optionen[index];
        if (!option) return;
        setzeBuchungskontext('🚪 Bürotermin');
        let ergebnis = option.wirkung();
        loescheBuchungskontext();
        if (!ergebnis.ok) { showToast(ergebnis.text, 'error', 4500); return; }
        playSound('click');
        if (!Array.isArray(game.officeEventHistory)) game.officeEventHistory = [];
        game.officeEventHistory.push({
            season: game.season, matchday: game.matchday,
            person: ereignis.person, wahl: option.label, ergebnis: ergebnis.text
        });
        if (game.officeEventHistory.length > 20) game.officeEventHistory.shift();
        addInboxMessage('vertrag', `🚪 Bürotermin mit ${ereignis.person}`, `Ihre Entscheidung: „${option.label}". ${ergebnis.text}`, 'screen-office');
        game.officeEvent = null;
        showToast(ergebnis.text, 'success', 5500);
        renderOfficeEventPanel();
        renderOfficeView();
        updateUI();
    }

    function closeOfficeEventPanel() {
        let panel = document.getElementById('office-event-panel');
        if (panel) panel.style.display = 'none';
    }

    function openOfficeEventPanel() {
        let ereignis = getPendingOfficeEvent();
        if (!ereignis) { showToast('Der Besucherstuhl ist leer - gerade wartet niemand auf Sie.', '', 3500); return; }
        renderOfficeEventPanel();
        let panel = document.getElementById('office-event-panel');
        if (panel) panel.style.display = 'flex';
    }

    function renderOfficeEventPanel() {
        let panel = document.getElementById('office-event-panel');
        if (!panel) return;
        let ereignis = getPendingOfficeEvent();
        if (!ereignis) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
        let gewartet = game.matchday - game.officeEvent.seit;
        let rest = Math.max(0, OFFICE_EVENT_TIMEOUT - gewartet);
        panel.innerHTML = `
            <div class="office-event-card" style="border-color:${ereignis.farbe};">
                <div style="font-size:10px; color:${ereignis.farbe}; font-weight:900; letter-spacing:0.5px;">${ereignis.person.toUpperCase()}</div>
                <div style="font-size:13px; font-weight:900; margin:4px 0;">${game.officeEvent.titel}</div>
                <div style="font-size:11px; color:#cbd5e1; font-style:italic; margin-bottom:8px;">${game.officeEvent.text}</div>
                ${ereignis.optionen.map((o, i) => `
                    <button onclick="resolveOfficeEvent(${i})" class="btn-secondary" style="font-size:10px; text-align:left; margin-bottom:4px;">
                        <strong>${o.label}</strong><br><span style="font-size:9px; color:var(--text-muted);">${o.hinweis()}</span>
                    </button>`).join('')}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                    <span style="font-size:9px; color:var(--text-muted);">Geduldet sich noch ${rest} Spieltag${rest === 1 ? '' : 'e'}</span>
                    <button onclick="closeOfficeEventPanel()" class="btn-secondary" style="width:auto; font-size:9px;">Später</button>
                </div>
            </div>`;
    }
