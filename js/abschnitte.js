// Weniger Scrollen (3.156): Lange Bildschirme mit mehreren Bereichen bekommen oben eine
// Abschnitts-Leiste. Sichtbar ist ein Bereich (gemerkt je Bildschirm), „☰ Alle“ zeigt wie früher
// alles untereinander. Lange Kartenlisten klappen über kompaktKarten() zu: Kopfzeile sichtbar,
// der Rest auf Tipp. Die Bereiche bleiben im DOM, ausgeblendet wird nur per Klasse.
// Testsuite: window.anstossOhneKompakt zeigt alles wie früher (testAbschnitte schaltet es ab).

// Bildschirme mit Abschnitts-Leiste. Ein Bereich ist ein direktes Kind mit Überschrift
// (.panel, .accordion-section, .panel-grid); was davor steht (Kopf, Kennzahlen), bleibt immer sichtbar.
const ABSCHNITT_SEITEN = ['screen-manager-tree', 'screen-private', 'screen-merch', 'screen-premium', 'screen-contracts',
    'screen-industry', 'screen-stadium', 'screen-campus', 'screen-staff', 'screen-sponsors', 'screen-stocks', 'screen-calendar',
    'screen-finances', 'screen-training', 'screen-squad-planning', 'screen-history', 'screen-design', 'screen-fans', 'screen-real-estate'];
const ABSCHNITT_KEY = 'anstoss_fm13_abschnitt_';
// Erster Besuch: dieser Bereich statt des obersten (die Hauptsache der Seite)
const ABSCHNITT_START = { 'screen-contracts': '📝 Verträge', 'screen-premium': '🚀 Booster' };
const ABSCHNITT_MIN = 3;   // erst ab drei Bereichen lohnt die Leiste

function abschnitteAus() { return !!window.anstossOhneKompakt; }

// Kurzer Name eines Bereichs: data-abschnitt, sonst der erste Teil der Überschrift
function abschnittName(el) {
    if (el.dataset && el.dataset.abschnitt) return el.dataset.abschnitt;
    const kopf = el.querySelector('.panel-header, .accordion-header, h2, h3');
    if (!kopf) return '';
    const teil = kopf.firstElementChild && kopf.firstElementChild.textContent.trim() ? kopf.firstElementChild : kopf;
    let text = teil.textContent.replace(/[▼▲]/g, '').replace(/\s+/g, ' ').trim();
    if (!text) text = kopf.textContent.replace(/[▼▲]/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 26) text = text.slice(0, 25).trim() + '…';
    return text;
}

function abschnittBereiche(sc) {
    const kinder = [...sc.children].filter(k => !k.classList.contains('abschnitt-leiste'));
    const bereiche = [];
    kinder.forEach(k => {
        const kopf = k.matches('.panel, .accordion-section, .panel-grid') && abschnittName(k);
        if (kopf) bereiche.push({ name: kopf, teile: [k] });
        else if (bereiche.length) bereiche[bereiche.length - 1].teile.push(k);   // Kasten ohne Überschrift gehört zum Bereich davor
    });
    return bereiche;
}

function abschnittSichtbar(b) {
    return b.teile.some(t => t.style.display !== 'none' && !t.hidden && (t.textContent.trim() || t.querySelector('canvas, input, select')));
}

// Aus showScreen(): Leiste bauen bzw. auffrischen und den gemerkten Bereich zeigen.
function abschnitteAnwenden(screenId) {
    const sc = document.getElementById(screenId);
    if (!sc) return;
    kompaktMarkierte(sc);
    if (!ABSCHNITT_SEITEN.includes(screenId)) return;
    let leiste = sc.querySelector(':scope > .abschnitt-leiste');
    // Gesperrter Bereich (js/freischaltungen.js) oder Testmodus: alles wie früher
    const gesperrt = !!sc.querySelector(':scope > .freischalt-vorschau');
    const bereiche = gesperrt ? [] : abschnittBereiche(sc).filter(abschnittSichtbar);
    if (abschnitteAus() || bereiche.length < ABSCHNITT_MIN) {
        if (leiste) leiste.remove();
        sc.querySelectorAll('.abschnitt-aus').forEach(el => el.classList.remove('abschnitt-aus'));
        return;
    }
    if (!leiste) {
        leiste = document.createElement('div');
        leiste.className = 'abschnitt-leiste';
        leiste.setAttribute('aria-label', 'Bereiche dieser Seite');
        const erster = bereiche[0].teile[0];
        sc.insertBefore(leiste, erster);
    }
    let wahl = safeLocalGet(ABSCHNITT_KEY + screenId) || '';
    if (wahl !== 'alle' && !bereiche.some(b => b.name === wahl)) wahl = bereiche.some(b => b.name === ABSCHNITT_START[screenId]) ? ABSCHNITT_START[screenId] : bereiche[0].name;
    const id = (i) => `btn-tab-abschnitt-${screenId.replace('screen-', '')}-${i}`;
    leiste.innerHTML = bereiche.map((b, i) => `<button id="${id(i)}" class="${b.name === wahl ? 'btn-action' : 'btn-secondary'}" onclick="abschnittWaehlen('${screenId}', ${i})">${b.name}</button>`).join('')
        + `<button id="${id('alle')}" class="${wahl === 'alle' ? 'btn-action' : 'btn-secondary'}" onclick="abschnittWaehlen('${screenId}', 'alle')" title="Alle Bereiche untereinander">☰ Alle</button>`;
    leiste.dataset.namen = JSON.stringify(bereiche.map(b => b.name));
    // Alle Bereiche (auch gerade unsichtbare) ein- bzw. ausblenden
    abschnittBereiche(sc).forEach(b => b.teile.forEach(t => t.classList.toggle('abschnitt-aus', wahl !== 'alle' && b.name !== wahl)));
}

function abschnittWaehlen(screenId, i) {
    const sc = document.getElementById(screenId);
    const leiste = sc && sc.querySelector(':scope > .abschnitt-leiste');
    if (!leiste) return;
    const namen = JSON.parse(leiste.dataset.namen || '[]');
    const wahl = i === 'alle' ? 'alle' : namen[i];
    if (!wahl) return;
    safeLocalSet(ABSCHNITT_KEY + screenId, wahl);
    abschnitteAnwenden(screenId);
    // Zum Anfang der Leiste, damit der gewählte Bereich oben beginnt (kein Seitensprung zu einem Kasten)
    const inhalt = document.getElementById('main-content');
    const oben = leiste.getBoundingClientRect().top;
    if (oben < 0) {
        if (inhalt && inhalt.scrollHeight > inhalt.clientHeight) inhalt.scrollTop += oben - 8;
        else if (document.scrollingElement) document.scrollingElement.scrollTop += oben - 8;
    }
    if (typeof playSound === 'function') playSound('click');
}

// Springt zu dem Bereich, in dem das Element liegt (für Wege aus anderen Fenstern).
function abschnittZeigen(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const sc = ABSCHNITT_SEITEN.map(s => document.getElementById(s)).find(s => s && s.contains(el));
    if (!sc) return;
    const b = abschnittBereiche(sc).find(x => x.teile.some(t => t.contains(el)));
    if (b) { safeLocalSet(ABSCHNITT_KEY + sc.id, b.name); abschnitteAnwenden(sc.id); }
}

// ---------- Aufklappbare Karten ----------
// Eine kompakte Karte zeigt nur ihr erstes Kind (die Kopfzeile); ein Tipp darauf klappt auf.
// Ein einziger Klick-Lauscher am Dokument, damit es auch nach jedem Neuzeichnen einer Karte klappt.
// Offene Karten bleiben über ein Neuzeichnen offen (gemerkt am Text der Kopfzeile).
const kompaktOffen = new Set();
function kompaktSchluessel(karte) {
    // Name statt ganzer Kopfzeile: Zahlen darin (Lagerbestand ...) ändern sich beim Neuzeichnen
    const kopf = karte.firstElementChild;
    const teil = kopf ? ([...kopf.querySelectorAll(':scope > *, .ui-card-title')].find(k => k.textContent.trim() && !k.classList.contains('kompakt-pfeil')) || kopf) : null;
    return (karte.dataset.kompaktName || '') + '|' + (teil ? teil.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '');
}
function kompaktElement(karte, standardOffen) {
    const kopf = karte.firstElementChild;
    if (!kopf || karte.children.length < 2 || abschnitteAus()) return;
    karte.classList.add('kompakt-karte');
    kopf.classList.add('kompakt-kopf');
    kopf.setAttribute('role', 'button');
    kopf.setAttribute('tabindex', '0');
    if (!kopf.querySelector(':scope > .kompakt-pfeil')) kopf.insertAdjacentHTML('beforeend', '<span class="kompakt-pfeil" aria-hidden="true">▾</span>');
    const schluessel = kompaktSchluessel(karte);
    const auf = kompaktOffen.has(schluessel) || (standardOffen && !kompaktOffen.has('zu|' + schluessel));
    karte.classList.toggle('offen', auf);
    kopf.setAttribute('aria-expanded', auf ? 'true' : 'false');
}
function kompaktUmschalten(karte) {
    const schluessel = kompaktSchluessel(karte);
    const auf = !karte.classList.contains('offen');
    karte.classList.toggle('offen', auf);
    if (karte.firstElementChild) karte.firstElementChild.setAttribute('aria-expanded', auf ? 'true' : 'false');
    if (auf) { kompaktOffen.add(schluessel); kompaktOffen.delete('zu|' + schluessel); } else { kompaktOffen.delete(schluessel); kompaktOffen.add('zu|' + schluessel); }
}
// Karten eines Containers (lange Listen) kompakt machen
function kompaktKarten(containerId) {
    const box = document.getElementById(containerId);
    if (!box || abschnitteAus()) return;
    box.classList.add('kompakt-liste');
    [...box.children].forEach(k => kompaktElement(k, false));
}
// Bereiche mit data-kompakt in einem Bildschirm (aus showScreen über abschnitteAnwenden)
function kompaktMarkierte(sc) {
    sc.querySelectorAll('[data-kompakt]').forEach(el => kompaktElement(el, el.dataset.kompakt === 'offen'));
}
document.addEventListener('click', e => {
    const kopf = e.target.closest('.kompakt-karte > :first-child');
    if (!kopf) return;
    // Knöpfe und Felder in der Kopfzeile tun weiter das Ihre
    const bedien = e.target.closest('button, input, select, a, label, textarea');
    if (bedien && kopf.contains(bedien) && bedien !== kopf) return;
    kompaktUmschalten(kopf.parentElement);
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const kopf = e.target.closest && e.target.closest('.kompakt-karte > :first-child');
    if (!kopf || e.target !== kopf) return;
    e.preventDefault();
    kompaktUmschalten(kopf.parentElement);
});
