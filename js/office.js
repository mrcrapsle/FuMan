
    // ==========================================
    // MANAGERBÜRO - POINT-AND-CLICK STARTBILDSCHIRM
    // ==========================================
    // Bewusst in reinem CSS-3D (perspective + preserve-3d + translate3d) gebaut und NICHT
    // mit Three.js/WebGL: das Spiel muss eine einzige, offline lauffähige HTML-Datei
    // bleiben (siehe build.py). Eine 3D-Bibliothek würde ~600 KB Fremdcode einbetten und
    // in Android-WebViews auf file://-URLs zusätzlich WebGL voraussetzen. Dieselbe
    // CSS-3D-Technik nutzen im Projekt bereits die Taktiktafel und die Stadionschüssel.
    //
    // Aufbau: Die Kamera steht in der Raummitte und blickt auf die Rückwand. Objekte an
    // den Wänden sind KINDER der jeweiligen Wand-Ebene und werden dadurch automatisch
    // korrekt mitperspektiviert - nur die freistehenden Möbel (Schreibtisch, Tresor) sind
    // eigene, zur Kamera gedrehte Ebenen im Raum.

    const OFFICE_ROOM = { w: 900, h: 560, d: 640 };

    let officeLightOn = true;
    let officeIsEntering = false;

    // Jedes Objekt ist ein anklickbarer Hotspot. "wall" bestimmt, in welche Ebene es
    // gehängt wird; "pos" ist die ganz normale 2D-Position INNERHALB dieser Ebene.
    // Freistehende Möbel (wall: 'room') bekommen stattdessen eine eigene 3D-Position.
    const OFFICE_HOTSPOTS = [
        {
            id: 'window', wall: 'back', target: 'screen-stadium',
            pos: 'left:40px; top:60px; width:320px; height:215px;',
            art: () => `
                <div class="off-window-sky">
                    <div class="off-moon"></div>
                    ${[14, 42, 78, 120, 210, 268, 320].map((x, i) => `<div class="off-star" style="left:${x}px; top:${12 + (i % 3) * 16}px;"></div>`).join('')}
                    <div class="off-stadium-glow"></div>
                    <div class="off-stadium-bowl"></div>
                    ${[30, 300].map(x => `<div class="off-pylon" style="left:${x}px;"><div class="off-pylon-head"></div></div>`).join('')}
                </div>
                <div class="off-window-frame"></div>
                <div class="off-window-sill">${formatVal(stadium.total || 0)} ${t('office_label_seats')}</div>`
        },
        {
            id: 'calendar', wall: 'back', target: 'screen-calendar',
            pos: 'left:395px; top:70px; width:142px; height:158px;',
            art: () => {
                let days = [];
                for (let i = 1; i <= 24; i++) {
                    let isToday = i === ((game.matchday - 1) % 24) + 1;
                    days.push(`<span class="off-cal-day${isToday ? ' off-cal-today' : ''}">${i}</span>`);
                }
                return `
                    <div class="off-cal-ring"></div><div class="off-cal-ring" style="left:auto; right:26px;"></div>
                    <div class="off-cal-head">${t('office_label_season')} ${game.season}</div>
                    <div class="off-cal-grid">${days.join('')}</div>
                    <div class="off-cal-foot">${t('office_label_matchday')} ${game.matchday}</div>`;
            }
        },
        {
            id: 'trophy', wall: 'back', target: 'screen-league',
            pos: 'left:608px; top:70px; width:242px; height:300px;',
            art: () => {
                let count = (game.trophies || []).length;
                let shelves = [0, 1, 2].map(row => {
                    let cups = '';
                    for (let i = 0; i < 3; i++) {
                        let idx = row * 3 + i;
                        cups += idx < count
                            ? `<div class="off-cup"><div class="off-cup-bowl"></div><div class="off-cup-stem"></div><div class="off-cup-base"></div></div>`
                            : `<div class="off-cup off-cup-empty"></div>`;
                    }
                    return `<div class="off-shelf">${cups}</div>`;
                }).join('');
                return `<div class="off-cabinet-glass">${shelves}</div>
                        <div class="off-cabinet-plate">${count} ${t('office_label_trophies')}</div>`;
            }
        },
        {
            id: 'tacticsboard', wall: 'left', target: 'screen-squad',
            pos: 'left:404px; top:108px; width:226px; height:212px;',
            art: () => {
                let lines = (game.formation || '4-4-2').split('-').map(n => parseInt(n) || 0);
                let rows = [[1], ...lines.map(n => Array(n).fill(0))];
                let markers = rows.map((row, ri) => {
                    let y = 14 + ri * (232 / rows.length);
                    return row.map((_, pi) => {
                        let x = ((pi + 1) / (row.length + 1)) * 100;
                        return `<div class="off-tac-dot" style="left:${x}%; top:${y}px;"></div>`;
                    }).join('');
                }).join('');
                return `<div class="off-tac-board">
                            <div class="off-tac-pitch"><div class="off-tac-circle"></div>${markers}</div>
                            <div class="off-tac-label">${game.formation || '4-4-2'}</div>
                        </div>`;
            }
        },
        {
            id: 'door', wall: 'left', target: 'screen-training',
            pos: 'left:196px; top:120px; width:190px; height:400px;',
            art: () => `
                <div class="off-door">
                    <div class="off-door-panel"></div><div class="off-door-panel"></div>
                    <div class="off-door-knob"></div>
                    <div class="off-door-sign">${t('office_label_door_sign')}</div>
                </div>`
        },
        {
            id: 'cabinet', wall: 'right', target: 'screen-transfer',
            pos: 'left:266px; top:206px; width:172px; height:300px;',
            art: () => `
                <div class="off-filing">
                    ${[t('office_label_drawer_transfers'), t('office_label_drawer_contracts'), t('office_label_drawer_scouting')].map(l => `<div class="off-drawer"><span>${l}</span><div class="off-drawer-handle"></div></div>`).join('')}
                </div>`
        },
        {
            id: 'safe', wall: 'right', target: 'screen-finances',
            pos: 'left:58px; top:298px; width:190px; height:192px;',
            art: () => `
                <div class="off-safe">
                    <div class="off-safe-dial"></div>
                    <div class="off-safe-display">${formatVal(game.money)}</div>
                    <div class="off-safe-handle"></div>
                </div>`
        },
        {
            id: 'monitor', wall: 'room', target: 'screen-dashboard',
            size: 'width:200px; height:140px;', at: 'translate3d(-30px, 25px, -70px)',
            art: () => `
                <div class="off-monitor">
                    <div class="off-monitor-screen">
                        <div class="off-mon-line" style="width:70%;"></div>
                        <div class="off-mon-line" style="width:45%;"></div>
                        <div class="off-mon-bars">${[38, 58, 30, 72, 50, 84].map(h => `<span style="height:${h}%;"></span>`).join('')}</div>
                    </div>
                    <div class="off-monitor-foot"></div>
                </div>`
        },
        {
            id: 'phone', wall: 'room', target: 'screen-inbox',
            size: 'width:110px; height:74px;', at: 'translate3d(175px, 58px, -70px)',
            art: () => {
                let unread = (typeof inboxMessages !== 'undefined') ? inboxMessages.filter(m => !m.read).length : 0;
                return `<div class="off-phone${unread > 0 ? ' off-phone-ringing' : ''}">
                            <div class="off-phone-handset"></div>
                            <div class="off-phone-base"></div>
                            ${unread > 0 ? `<div class="off-phone-badge">${unread}</div>` : ''}
                        </div>`;
            }
        },
        {
            id: 'lamp', wall: 'room', action: 'lamp',
            size: 'width:105px; height:130px;', at: 'translate3d(-210px, 30px, -70px)',
            art: () => `
                <div class="off-lamp">
                    <div class="off-lamp-shade"></div>
                    <div class="off-lamp-arm"></div>
                    <div class="off-lamp-foot"></div>
                </div>`
        }
    ];

    function officeHotspotText(id, suffix) {
        return t('office_hs_' + id + (suffix || ''));
    }

    // Baut den kompletten Raum (Wände + Objekte) als HTML. Bewusst aus JS heraus statt als
    // statisches Markup in index.html: die Objekte zeigen echten Spielstand an (Spieltag,
    // Trophäen, Kontostand, ungelesene Post) und werden bei jedem Betreten neu aufgebaut.
    function buildOfficeRoom() {
        const R = OFFICE_ROOM;
        const faces = {
            back: `width:${R.w}px; height:${R.h}px; transform: translate(-50%,-50%) translateZ(-${R.d / 2}px);`,
            left: `width:${R.d}px; height:${R.h}px; transform: translate(-50%,-50%) rotateY(90deg) translateZ(-${R.w / 2}px);`,
            right: `width:${R.d}px; height:${R.h}px; transform: translate(-50%,-50%) rotateY(-90deg) translateZ(-${R.w / 2}px);`,
            floor: `width:${R.w}px; height:${R.d}px; transform: translate(-50%,-50%) rotateX(90deg) translateZ(-${R.h / 2}px);`,
            ceiling: `width:${R.w}px; height:${R.d}px; transform: translate(-50%,-50%) rotateX(-90deg) translateZ(-${R.h / 2}px);`
        };

        const hotspotHtml = (hs) => {
            let isRoom = hs.wall === 'room';
            // Wandobjekte werden ganz normal 2D in ihrer Wand positioniert, freistehende
            // Möbel bekommen eine echte 3D-Position im Raum.
            let style = isRoom
                ? `${hs.size} transform: translate(-50%,-50%) ${hs.at};`
                : hs.pos;
            return `<div class="office-hotspot ${isRoom ? 'office-hotspot-free' : ''}" id="office-hs-${hs.id}" style="${style}">
                        ${hs.art()}
                        <div class="office-hotspot-tag">${officeHotspotText(hs.id)}</div>
                    </div>`;
        };

        let wallHtml = (name) => {
            let items = OFFICE_HOTSPOTS.filter(h => h.wall === name).map(hotspotHtml).join('');
            if (name === 'floor') items += `<div class="office-rug"></div>`;
            return `<div class="office-face office-face-${name}" style="${faces[name]}">${items}</div>`;
        };

        let desk = `<div class="office-desk" style="transform: translate(-50%,-50%) translate3d(0, 175px, -80px);"></div>`
            + `<div class="office-nameplate" style="transform: translate(-50%,-50%) translate3d(60px, 112px, -70px);">${game.clubName}</div>`;
        let freeItems = OFFICE_HOTSPOTS.filter(h => h.wall === 'room').map(hotspotHtml).join('');
        let motes = Array.from({ length: 10 }, (_, i) =>
            `<div class="office-mote" style="left:${8 + i * 9}%; top:${15 + (i * 17) % 60}%; animation-delay:${i * 1.3}s;"></div>`).join('');

        return ['back', 'left', 'right', 'floor', 'ceiling'].map(wallHtml).join('')
            + desk + freeItems
            + `<div class="office-lightpool"></div>` + motes;
    }

    function renderOfficeView() {
        let room = document.getElementById('office-room');
        if (!room) return;
        room.innerHTML = buildOfficeRoom();
        let title = document.getElementById('office-club-title');
        if (title) title.innerText = game.clubName;
        officeSetSentence(null);
        applyOfficeLight();
        fitOfficeScale();
    }

    // Die Szene wird immer für 900x560 komponiert und anschließend als Ganzes auf die
    // tatsächliche Breite skaliert. Ohne das würde auf schmalen Geräten schlicht der halbe
    // Raum (beide Seitenwände samt Tür, Taktiktafel, Tresor, Aktenschrank) außerhalb des
    // Sichtkegels liegen - eine kleinere Perspektive allein reicht dagegen nicht aus.
    function fitOfficeScale() {
        let viewport = document.getElementById('office-viewport');
        let scaler = document.getElementById('office-scaler');
        if (!viewport || !scaler) return;
        let rect = viewport.getBoundingClientRect();
        if (!rect.width) return;
        // Auf schmalen Geräten darf die Szene seitlich leicht überstehen (die äußersten
        // Wandecken sind leer), damit der Raum nicht auf Briefmarkengröße schrumpft. Weiter
        // beschneiden geht nicht: Tür und Aktenschrank sitzen am Rand der Seitenwände und
        // müssen anklickbar bleiben (siehe testManagerOffice).
        let logicalWidth = rect.width < 560 ? 760 : 900;
        let k = Math.min(rect.width / logicalWidth, rect.height / 560);
        scaler.style.transform = `scale(${k.toFixed(4)})`;
        renderOfficeQuickNav(rect.height - 560 * k, (rect.height + 560 * k) / 2);
    }

    // Auf hohen, schmalen Displays bleibt über und unter der Kulisse viel Platz frei (ein
    // breiter Raum füllt ein Hochformat nun einmal nicht aus) - und die Objekte sind dort
    // klein zum Antippen. Dann erscheint darunter dieselbe Auswahl noch einmal als
    // beschriftete Schaltflächen; auf breiten Displays bleibt sie ausgeblendet.
    function renderOfficeQuickNav(leftoverSpace, sceneBottom) {
        let nav = document.getElementById('office-quicknav');
        if (!nav) return;
        if (leftoverSpace < 150) { nav.style.display = 'none'; nav.innerHTML = ''; return; }
        nav.style.display = 'flex';
        nav.style.top = Math.round(sceneBottom + 14) + 'px';
        nav.innerHTML = OFFICE_HOTSPOTS.filter(h => h.target).map(h =>
            `<button class="office-quicknav-btn" onclick="officeEnterHotspot('${h.id}')">${officeHotspotText(h.id)}</button>`
        ).join('');
    }

    // Trefferprüfung bewusst SELBST über die projizierten Bildschirmrechtecke, statt sich auf
    // die native Hit-Detection des Browsers zu verlassen: für 3D-transformierte Elemente ist
    // die je nach Chromium-Version unzuverlässig - in einer neueren Version waren 9 der 10
    // Objekte nicht mehr anklickbar, obwohl das Bild unverändert korrekt aussah (in der CI
    // aufgefallen). getBoundingClientRect() liefert dagegen versionsübergreifend stabil das
    // Rechteck, in dem das Objekt tatsächlich auf dem Bildschirm liegt.
    //
    // Reihenfolge = Tiefe: freistehende Möbel stehen vor den Wandobjekten, überlappen sie also.
    function officeHotspotAtPoint(clientX, clientY) {
        let ordered = [...OFFICE_HOTSPOTS].sort((a, b) => (a.wall === 'room' ? 0 : 1) - (b.wall === 'room' ? 0 : 1));
        for (let hs of ordered) {
            let el = document.getElementById('office-hs-' + hs.id);
            if (!el) continue;
            let r = el.getBoundingClientRect();
            if (r.width && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return hs.id;
        }
        return null;
    }

    // Hervorhebung ebenfalls aus JS setzen statt per CSS :hover - :hover hängt an derselben
    // unzuverlässigen Trefferprüfung wie der Klick.
    function setOfficeHover(id) {
        document.querySelectorAll('.office-hotspot').forEach(el => {
            el.classList.toggle('office-hotspot-hover', el.id === 'office-hs-' + id);
        });
        let viewport = document.getElementById('office-viewport');
        if (viewport) viewport.style.cursor = id ? 'pointer' : '';
        officeSetSentence(id);
    }

    function officeSetSentence(id) {
        let el = document.getElementById('office-sentence');
        if (!el) return;
        el.innerText = id ? officeHotspotText(id, '_verb') : t('office_default_sentence');
        el.classList.toggle('office-sentence-active', !!id);
    }

    function applyOfficeLight() {
        let screen = document.getElementById('screen-office');
        if (screen) screen.classList.toggle('office-dark', !officeLightOn);
    }

    function toggleOfficeLamp() {
        officeLightOn = !officeLightOn;
        playSound('click');
        applyOfficeLight();
    }

    // Klick auf ein Objekt: kurze Kamerafahrt darauf zu + Ausblenden, dann der echte
    // Screenwechsel - das ist der "Übergang" aus klassischen Point-and-Click-Adventures.
    function officeEnterHotspot(id) {
        if (officeIsEntering) return;
        let hs = OFFICE_HOTSPOTS.find(h => h.id === id);
        if (!hs) return;
        if (hs.action === 'lamp') { toggleOfficeLamp(); return; }

        officeIsEntering = true;
        playSound('click');
        let stage = document.getElementById('office-stage');
        let fade = document.getElementById('office-fade');
        let target = document.getElementById('office-hs-' + id);
        if (stage && target) {
            // Grob in Richtung des angeklickten Objekts zoomen (Bildschirmmitte als Bezug).
            let rect = target.getBoundingClientRect();
            let vp = document.getElementById('office-viewport').getBoundingClientRect();
            let dx = (vp.left + vp.width / 2) - (rect.left + rect.width / 2);
            let dy = (vp.top + vp.height / 2) - (rect.top + rect.height / 2);
            stage.style.transform = `translate3d(${dx * 0.6}px, ${dy * 0.6}px, 300px)`;
        }
        if (fade) fade.classList.add('show');

        setTimeout(() => {
            officeIsEntering = false;
            if (stage) stage.style.transform = '';
            if (fade) fade.classList.remove('show');
            showScreen(hs.target);
        }, 520);
    }

    // Parallaxe: Maus-/Fingerbewegung dreht die Kamera minimal - dadurch verschieben sich
    // nahe Objekte (Schreibtisch) sichtbar stärker als die Rückwand, was den Raum überhaupt
    // erst räumlich wirken lässt.
    function initOfficeParallax() {
        let viewport = document.getElementById('office-viewport');
        let room = document.getElementById('office-room');
        if (!viewport || !room || viewport.dataset.parallaxReady) return;
        viewport.dataset.parallaxReady = '1';

        const apply = (clientX, clientY) => {
            let rect = viewport.getBoundingClientRect();
            let nx = ((clientX - rect.left) / rect.width - 0.5) * 2;
            let ny = ((clientY - rect.top) / rect.height - 0.5) * 2;
            room.style.setProperty('--office-ry', (-nx * 7).toFixed(2) + 'deg');
            room.style.setProperty('--office-rx', (ny * 4.5).toFixed(2) + 'deg');
        };

        // Bedienelemente über der Kulisse (Leiste, Schnellauswahl) haben eigene Knöpfe und
        // dürfen nicht zusätzlich als Klick in den Raum gewertet werden.
        const isOverlayTarget = (e) => !!(e.target.closest && e.target.closest('.office-hud, .office-quicknav'));

        viewport.addEventListener('click', e => {
            if (isOverlayTarget(e)) return;
            let id = officeHotspotAtPoint(e.clientX, e.clientY);
            if (id) officeEnterHotspot(id);
        });

        viewport.addEventListener('mousemove', e => {
            apply(e.clientX, e.clientY);
            setOfficeHover(isOverlayTarget(e) ? null : officeHotspotAtPoint(e.clientX, e.clientY));
        });
        viewport.addEventListener('touchmove', e => {
            if (e.touches && e.touches[0]) apply(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        viewport.addEventListener('mouseleave', () => {
            room.style.setProperty('--office-ry', '0deg');
            room.style.setProperty('--office-rx', '0deg');
            setOfficeHover(null);
        });
        window.addEventListener('resize', fitOfficeScale);
    }
