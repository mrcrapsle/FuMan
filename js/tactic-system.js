/* eslint-disable no-undef */
// Taktik-Bilanz: echte Ergebnisse je Kombination aus Formation und Spielstil sowie die
// tatsächlichen Auswirkungen der aktuellen Wahl auf die Teamstärke (FORMATION_RATINGS in
// squad.js, getTacticStyleBonus()/getFormationDefBonus() in match.js). Früher stand hier ein
// losgelöstes "Taktik-System" mit eigenen Formationen, deren Werte nirgends wirkten.

// Nach jedem eigenen Ligaspiel aus processPostMatchRoutine() aufgerufen.
function analyzeMatchTactics(match) {
  if (!match) return;
  if (!game.tacticRecords) game.tacticRecords = {};
  const key = `${game.formation || '4-4-2'}|${game.tacticStyle || 'ausgeglichen'}`;
  const r = game.tacticRecords[key] || (game.tacticRecords[key] = { s: 0, u: 0, n: 0, tore: 0, gegentore: 0 });
  if (match.won) r.s++;
  else if (match.draw) r.u++;
  else r.n++;
  r.tore += match.score || 0;
  r.gegentore += match.conceded || 0;
}

function getTacticRecordRows() {
  return Object.entries(game.tacticRecords || {}).map(([key, r]) => {
    const [formation, stil] = key.split('|');
    const spiele = r.s + r.u + r.n;
    return { formation, stil, spiele, ...r, schnitt: spiele ? (r.s * 3 + r.u) / spiele : 0 };
  }).filter(r => r.spiele > 0);
}

function renderTacticSystemPanel() {
  const panel = document.getElementById('tactic-system-panel');
  if (!panel) return;
  const stilLabel = s => (typeof TACTIC_STYLE_CONFIG !== 'undefined' && TACTIC_STYLE_CONFIG[s]) ? TACTIC_STYLE_CONFIG[s].label : s;
  const vz = n => (n > 0 ? '+' : '') + n.toFixed(1);
  let html = '';

  // Aktuelle Wahl: genau die Werte, die in calcTeamStrength() und die Live-Simulation eingehen.
  if (typeof FORMATION_RATINGS !== 'undefined' && typeof getTacticStyleBonus === 'function') {
    const rating = FORMATION_RATINGS[game.formation] || { def: 60, off: 60 };
    const angriff = getFormationOffBonus() + getTacticStyleBonus(game.tacticStyle);
    const abwehr = getFormationDefBonus() * 0.6;
    const kraft = Math.round((getTacticStyleFitnessMultiplier(game.tacticStyle) - 1) * 100);
    html += `<div style="font-size:10px; line-height:1.6;">Aktuell: <b>${game.formation}</b> · <b>${stilLabel(game.tacticStyle)}</b><br>`
      + `Formation: Abwehr ${rating.def} / Angriff ${rating.off}<br>`
      + `Teamstärke-Effekt: Angriff <b>${vz(angriff)}</b> · Abwehr <b>${vz(abwehr)}</b> · Kraftverbrauch <b>${kraft > 0 ? '+' : ''}${kraft}%</b></div>`;
  }

  const rows = getTacticRecordRows().sort((a, b) => b.spiele - a.spiele);
  if (!rows.length) {
    html += '<div style="font-size:10px; color:var(--text-muted); margin-top:6px;">Noch keine Ligaspiele mit Taktik-Bilanz.</div>';
    panel.innerHTML = html;
    return;
  }
  html += '<table style="width:100%; font-size:10px; margin-top:6px; border-collapse:collapse;">'
    + '<tr style="color:var(--text-muted); text-align:left;"><th>Formation</th><th>Stil</th><th>Sp.</th><th>S-U-N</th><th>Tore</th><th>Pkt/Sp.</th></tr>';
  rows.slice(0, 8).forEach(r => {
    const aktiv = r.formation === game.formation && r.stil === game.tacticStyle;
    const farbe = r.schnitt >= 1.8 ? 'var(--green, #4CAF50)' : r.schnitt >= 1.1 ? 'var(--gold, #FFC107)' : 'var(--red, #FF5252)';
    html += `<tr style="${aktiv ? 'font-weight:bold;' : ''}"><td>${r.formation}</td><td>${stilLabel(r.stil)}</td><td>${r.spiele}</td>`
      + `<td>${r.s}-${r.u}-${r.n}</td><td>${r.tore}:${r.gegentore}</td><td style="color:${farbe};">${r.schnitt.toFixed(2)}</td></tr>`;
  });
  html += '</table>';
  const erprobt = rows.filter(r => r.spiele >= 5).sort((a, b) => b.schnitt - a.schnitt);
  if (erprobt.length >= 2) {
    const best = erprobt[0];
    html += `<div style="font-size:10px; color:var(--gold, #FFC107); margin-top:6px;">💡 Beste erprobte Kombination: ${best.formation} · ${stilLabel(best.stil)} (${best.schnitt.toFixed(2)} Punkte pro Spiel)</div>`;
  }
  panel.innerHTML = html;
}
