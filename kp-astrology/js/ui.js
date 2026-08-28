// UI glue: reads planet/cusp tables (typed or uploaded JSON/CSV), birth/moon
// inputs, runs all KP calculations, and renders results.

const PLANET_NAMES_DEFAULT = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

let state = {
  planets: [],   // { name, sign, house, starLord, subLord, subSubLord, retrograde }
  cusps: []      // { house, sign, starLord, subLord, subSubLord }
};

// Cached results from the last runComputations(), used by the Life Topics export.
let lastResults = { significators: null, dasha: null };

function el(id) { return document.getElementById(id); }

function init() {
  renderPlanetTable();
  renderCuspTable();
  el('loadSampleBtn').addEventListener('click', loadSampleData);
  el('uploadInput').addEventListener('change', handleUpload);
  el('computeBtn').addEventListener('click', runComputations);
  el('addPlanetRowBtn').addEventListener('click', () => { state.planets.push(blankPlanet()); renderPlanetTable(); });
  el('addCuspRowBtn').addEventListener('click', () => { state.cusps.push(blankCusp(state.cusps.length + 1)); renderCuspTable(); });
  el('exportLifeTopicsBtn').addEventListener('click', exportLifeTopicsReport);
}

// Fields that hold a planet name vs. a sign name, per record type — used to
// canonicalize case/whitespace variants (e.g. "rahu", "SATURN ") to the
// spelling the KP lookup tables expect (e.g. "Rahu", "Saturn").
const PLANET_FIELDS = ['name', 'starLord', 'subLord', 'subSubLord'];
const SIGN_FIELDS = ['sign'];

// Normalizes planet/sign fields in place and returns a list of warnings for
// any value that didn't match a known planet or sign name.
function canonicalizeRecords(records) {
  const warnings = [];
  records.forEach((rec, i) => {
    PLANET_FIELDS.forEach(f => {
      if (rec[f]) {
        const canonical = canonicalPlanetName(rec[f]);
        if (!isKnownPlanetName(rec[f])) warnings.push(`Row ${i + 1}: "${rec[f]}" (${f}) is not a recognized planet name`);
        rec[f] = canonical;
      }
    });
    SIGN_FIELDS.forEach(f => {
      if (rec[f]) {
        const canonical = canonicalSignName(rec[f]);
        if (!isKnownSignName(rec[f])) warnings.push(`Row ${i + 1}: "${rec[f]}" (${f}) is not a recognized sign name`);
        rec[f] = canonical;
      }
    });
  });
  return warnings;
}

function blankPlanet(name) {
  return { name: name || '', sign: '', house: '', starLord: '', subLord: '', subSubLord: '', retrograde: false };
}
function blankCusp(house) {
  return { house, sign: '', starLord: '', subLord: '', subSubLord: '' };
}

function loadSampleData() {
  state.planets = PLANET_NAMES_DEFAULT.map(n => blankPlanet(n));
  state.cusps = Array.from({ length: 12 }, (_, i) => blankCusp(i + 1));
  renderPlanetTable();
  renderCuspTable();
  el('statusMsg').textContent = 'Loaded empty template for 9 planets and 12 cusps. Fill in the fields.';
}

function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const isExcel = /\.xlsx$/i.test(file.name);
  const reader = new FileReader();

  reader.onload = evt => {
    try {
      let data;
      if (isExcel) {
        data = parseExcelBundle(evt.target.result);
      } else {
        const text = evt.target.result;
        data = file.name.endsWith('.csv') ? parseCsvBundle(text) : JSON.parse(text);
      }
      if (data.planets) state.planets = data.planets;
      if (data.cusps) state.cusps = data.cusps;
      if (data.moon) { el('moonLongitude').value = data.moon.longitude ?? ''; }
      if (data.birthDateTime) { el('birthDateTime').value = data.birthDateTime; }

      const warnings = [...canonicalizeRecords(state.planets), ...canonicalizeRecords(state.cusps)];
      renderPlanetTable();
      renderCuspTable();
      el('statusMsg').textContent = warnings.length
        ? `Loaded data from ${file.name}. Warnings: ${warnings.join('; ')}`
        : 'Loaded data from ' + file.name;
    } catch (err) {
      el('statusMsg').textContent = 'Failed to parse file: ' + err.message;
    }
  };

  if (isExcel) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}

// Expects an .xlsx workbook with three sheets:
//   "Planets" - header row: name, sign, house, starLord, subLord, subSubLord, retrograde
//   "Cusps"   - header row: house, sign, starLord, subLord, subSubLord
//   "Meta"    - two columns, no header: key, value  (rows: birthDateTime, moonLongitude)
function parseExcelBundle(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const result = { planets: [], cusps: [] };

  const planetsSheet = workbook.Sheets['Planets'];
  if (planetsSheet) {
    const rows = XLSX.utils.sheet_to_json(planetsSheet, { defval: '' });
    result.planets = rows.map(r => normalizeRow(r, ['house']));
  }

  const cuspsSheet = workbook.Sheets['Cusps'];
  if (cuspsSheet) {
    const rows = XLSX.utils.sheet_to_json(cuspsSheet, { defval: '' });
    result.cusps = rows.map(r => normalizeRow(r, ['house']));
  }

  const metaSheet = workbook.Sheets['Meta'];
  if (metaSheet) {
    const rows = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
    const meta = {};
    rows.forEach(r => { if (r[0]) meta[String(r[0]).trim()] = r[1]; });
    if (meta.moonLongitude !== undefined) result.moon = { longitude: Number(meta.moonLongitude) };
    if (meta.birthDateTime !== undefined) result.birthDateTime = excelValueToDateTimeLocal(meta.birthDateTime);
  }

  return result;
}

function normalizeRow(row, numericFields) {
  const obj = {};
  Object.keys(row).forEach(key => {
    const normKey = { starlord: 'starLord', sublord: 'subLord', subsublord: 'subSubLord' }[key.toLowerCase()] || key;
    let val = row[key];
    if (numericFields.includes(normKey) && val !== '') val = Number(val);
    if (normKey === 'retrograde') val = /^(true|yes|1)$/i.test(String(val));
    obj[normKey] = val;
  });
  return obj;
}

// Accepts either an Excel serial date number or a text date and returns the
// "YYYY-MM-DDTHH:mm" format the datetime-local input needs.
function excelValueToDateTimeLocal(value) {
  let date;
  if (typeof value === 'number') {
    date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

// Expects a JSON file structured as { planets: [...], cusps: [...], moon: {longitude}, birthDateTime }.
// CSV support: two sections separated by a blank line, first "planets" header row, then "cusps" header row.
function parseCsvBundle(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  const result = { planets: [], cusps: [] };
  blocks.forEach(block => {
    const lines = block.trim().split('\n').map(l => l.split(',').map(c => c.trim()));
    const header = lines[0].map(h => h.toLowerCase());
    const rows = lines.slice(1);
    if (header.includes('name')) {
      result.planets = rows.map(r => rowToObj(header, r, ['house']));
    } else if (header.includes('house')) {
      result.cusps = rows.map(r => rowToObj(header, r, ['house']));
    }
  });
  return result;
}
function rowToObj(header, row, numericFields) {
  const obj = {};
  header.forEach((h, i) => {
    const key = { starlord: 'starLord', sublord: 'subLord', subsublord: 'subSubLord' }[h] || h;
    let val = row[i];
    if (numericFields.includes(key) && val !== undefined) val = Number(val);
    if (key === 'retrograde') val = /^(true|yes|1)$/i.test(val);
    obj[key] = val;
  });
  return obj;
}

function renderPlanetTable() {
  const cols = ['name', 'sign', 'house', 'starLord', 'subLord', 'subSubLord', 'retrograde'];
  el('planetTable').innerHTML = renderEditableTable('planets', state.planets, cols);
  attachTableListeners('planetTable', 'planets', cols);
}
function renderCuspTable() {
  const cols = ['house', 'sign', 'starLord', 'subLord', 'subSubLord'];
  el('cuspTable').innerHTML = renderEditableTable('cusps', state.cusps, cols);
  attachTableListeners('cuspTable', 'cusps', cols);
}

function renderEditableTable(kind, rows, cols) {
  let html = '<table><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach((row, i) => {
    html += '<tr>' + cols.map(c => {
      if (c === 'retrograde') {
        return `<td><input type="checkbox" data-row="${i}" data-col="${c}" ${row[c] ? 'checked' : ''}></td>`;
      }
      return `<td><input type="text" data-row="${i}" data-col="${c}" value="${row[c] ?? ''}"></td>`;
    }).join('') + '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function attachTableListeners(tableId, kind, cols) {
  el(tableId).querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const row = Number(input.dataset.row);
      const col = input.dataset.col;
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (col === 'house') value = Number(value);
      else if (PLANET_FIELDS.includes(col)) value = canonicalPlanetName(value);
      else if (SIGN_FIELDS.includes(col)) value = canonicalSignName(value);
      state[kind][row][col] = value;
      if (col !== 'house' && input.type !== 'checkbox') input.value = value;
    });
  });
}

function runComputations() {
  try {
    const planets = state.planets.filter(p => p.name);
    const cusps = state.cusps.filter(c => c.house);

    if (!planets.length || !cusps.length) {
      el('statusMsg').textContent = 'Please provide at least one planet and one cusp before computing.';
      return;
    }

    // Significators
    const significators = buildSignificators(planets, cusps);
    renderSignificators(significators);
    lastResults.significators = significators;

    // Ruling planets
    const ascendant = cusps.find(c => Number(c.house) === 1);
    const moonPlanet = planets.find(p => p.name === 'Moon');
    const momentStr = el('rpMoment').value;
    const moment = momentStr ? new Date(momentStr) : new Date();
    if (ascendant && moonPlanet) {
      const rp = buildRulingPlanets(moment, ascendant, moonPlanet);
      renderRulingPlanets(rp);
    } else {
      el('rulingPlanetsOutput').textContent = 'Need house-1 cusp and a Moon planet row to compute ruling planets.';
    }

    // Dasha
    const moonLon = parseFloat(el('moonLongitude').value);
    const birthStr = el('birthDateTime').value;
    if (!isNaN(moonLon) && birthStr) {
      const birthDateTime = new Date(birthStr);
      const dasha = computeVimshottariDasha(moonLon, birthDateTime, { levels: 3 });
      renderDasha(dasha);
      lastResults.dasha = dasha;
    } else {
      el('dashaOutput').textContent = 'Enter Moon longitude and birth date/time to compute the Vimshottari dasha.';
      lastResults.dasha = null;
    }

    // Life Topic Promise Analysis
    const lifeMomentStr = el('lifeTopicMoment').value;
    const lifeMoment = lifeMomentStr ? new Date(lifeMomentStr) : new Date();
    const runningLords = lastResults.dasha ? findActivePeriod(lastResults.dasha, lifeMoment) : null;
    const lifeTopics = analyzeAllLifeTopics(significators, runningLords);
    lastResults.lifeTopics = lifeTopics;
    renderLifeTopics(lifeTopics);

    el('statusMsg').textContent = 'Computation complete.';
  } catch (err) {
    el('statusMsg').textContent = 'Error: ' + err.message;
    console.error(err);
  }
}

function renderSignificators(byHouse) {
  let html = '<table><thead><tr><th>House</th><th>Cusp Sign</th><th>Occupants</th><th>Owners</th><th>Star Lord of Occupants</th><th>Star Lord of Owners</th><th>All Significators</th></tr></thead><tbody>';
  for (let h = 1; h <= 12; h++) {
    const s = byHouse[h];
    html += `<tr><td>${h}</td><td>${s.cuspSign || ''}</td><td>${s.occupants.join(', ')}</td><td>${s.owners.join(', ')}</td><td>${s.starLordOfOccupants.join(', ')}</td><td>${s.starLordOfOwners.join(', ')}</td><td>${s.allSignificators.join(', ')}</td></tr>`;
  }
  html += '</tbody></table>';
  el('significatorsOutput').innerHTML = html;
}

function renderRulingPlanets(rp) {
  el('rulingPlanetsOutput').innerHTML = `
    <p><strong>Day Lord:</strong> ${rp.dayLord}</p>
    <p><strong>Ascendant Lords:</strong> Sign: ${rp.ascendantLords.signLord}, Star: ${rp.ascendantLords.starLord}, Sub: ${rp.ascendantLords.subLord}</p>
    <p><strong>Moon Lords:</strong> Sign: ${rp.moonLords.signLord}, Star: ${rp.moonLords.starLord}, Sub: ${rp.moonLords.subLord}</p>
    <p><strong>All Ruling Planets:</strong> ${rp.allRulingPlanets.join(', ')}</p>
  `;
}

function renderDasha(dasha) {
  const fmt = d => d.toISOString().slice(0, 10);
  let html = `<p><strong>Birth Nakshatra:</strong> ${dasha.birthNakshatra.name} (Star Lord: ${dasha.birthNakshatra.starLord})</p>`;
  html += `<p><strong>Dasha Balance at Birth:</strong> ${dasha.balance.years}y ${dasha.balance.months}m ${dasha.balance.days}d</p>`;
  html += '<table><thead><tr><th>Mahadasha</th><th>Start</th><th>End</th></tr></thead><tbody>';
  dasha.mahadashas.forEach(m => {
    html += `<tr class="maha-row" data-lord="${m.lord}"><td>${m.lord}</td><td>${fmt(m.start)}</td><td>${fmt(m.end)}</td></tr>`;
  });
  html += '</tbody></table>';
  html += '<div id="antarDetail"></div>';
  el('dashaOutput').innerHTML = html;

  el('dashaOutput').querySelectorAll('.maha-row').forEach(row => {
    row.addEventListener('click', () => {
      const lord = row.dataset.lord;
      const maha = dasha.mahadashas.find(m => m.lord === lord);
      renderAntarDetail(maha);
    });
  });
}

function renderAntarDetail(maha) {
  const fmt = d => d.toISOString().slice(0, 10);
  let html = `<h4>${maha.lord} Mahadasha — Antardashas</h4><table><thead><tr><th>Antardasha</th><th>Start</th><th>End</th></tr></thead><tbody>`;
  (maha.antardashas || []).forEach(a => {
    html += `<tr class="antar-row" data-lord="${a.lord}"><td>${a.lord}</td><td>${fmt(a.start)}</td><td>${fmt(a.end)}</td></tr>`;
  });
  html += '</tbody></table><div id="pratyantarDetail"></div>';
  el('antarDetail').innerHTML = html;

  el('antarDetail').querySelectorAll('.antar-row').forEach(row => {
    row.addEventListener('click', () => {
      const lord = row.dataset.lord;
      const antar = maha.antardashas.find(a => a.lord === lord);
      renderPratyantarDetail(antar);
    });
  });
}

function renderPratyantarDetail(antar) {
  const fmt = d => d.toISOString().slice(0, 10);
  let html = `<h5>${antar.lord} Antardasha — Pratyantardashas</h5><table><thead><tr><th>Pratyantardasha</th><th>Start</th><th>End</th></tr></thead><tbody>`;
  (antar.pratyantardashas || []).forEach(p => {
    html += `<tr><td>${p.lord}</td><td>${fmt(p.start)}</td><td>${fmt(p.end)}</td></tr>`;
  });
  html += '</tbody></table>';
  el('pratyantarDetail').innerHTML = html;
}

function renderLifeTopics(lifeTopics) {
  let html = '';
  Object.values(lifeTopics).forEach(result => {
    html += `<h3>${result.topic.label}</h3>`;
    html += `<p><em>${result.topic.note}</em></p>`;
    html += `<p><strong>Favorable houses:</strong> ${result.topic.favorable.join(', ')} &nbsp; <strong>Obstacle houses:</strong> ${result.topic.obstacles.join(', ')}</p>`;
    html += '<table><thead><tr><th>House</th><th>Sign</th><th>Significators</th></tr></thead><tbody>';
    result.houseSig.forEach(h => {
      html += `<tr><td>${h.house}</td><td>${h.cuspSign || ''}</td><td>${h.significators.join(', ')}</td></tr>`;
    });
    html += '</tbody></table>';
    html += '<table><thead><tr><th>Connecting Planet</th><th>Favorable Houses Linked</th><th>Also Touches Obstacle House(s)</th></tr></thead><tbody>';
    result.connecting.forEach(c => {
      html += `<tr><td>${c.planet}</td><td>${c.housesConnected.join(', ')}</td><td>${c.obstacleHouses.join(', ') || '—'}</td></tr>`;
    });
    if (!result.connecting.length) html += '<tr><td colspan="3">No planet connects 2+ favorable houses</td></tr>';
    html += '</tbody></table>';
    html += `<p><strong>Verdict:</strong> ${result.verdict}</p>`;
    html += `<p><strong>Timing:</strong> ${result.timingNote}</p>`;
  });
  el('lifeTopicsOutput').innerHTML = html;
}

// Builds the same data as renderLifeTopics(), as sheet rows (array-of-arrays),
// for the Excel export. One sheet per topic plus a Summary and a Logic sheet.
function buildLifeTopicsWorkbook(lifeTopics) {
  const wb = XLSX.utils.book_new();

  const summaryRows = [['Topic', 'Favorable Houses', 'Obstacle Houses', 'Verdict', 'Timing Note']];
  Object.values(lifeTopics).forEach(r => {
    summaryRows.push([r.topic.label, r.topic.favorable.join(', '), r.topic.obstacles.join(', '), r.verdict, r.timingNote]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  const logicRows = [
    ['KP Life-Topic Promise Analysis — Logic and Sequence'],
    [''],
    ['1. Each life topic maps to a fixed set of houses: "favorable" houses that support the event, and "obstacle" houses that typically delay/deny it.'],
    ['2. For each favorable house, list its significators: occupants, owner (cusp sign lord), star lord of occupants, star lord of owner.'],
    ['3. A planet appearing as a significator of 2+ favorable houses is a "connecting planet" — a candidate to give the event, especially during its dasha/bhukti.'],
    ['4. A connecting planet that ALSO significates an obstacle house is weakened/mixed — may delay or complicate the event.'],
    ['5. Verdict:'],
    ['   - Strongly Promised: a planet connects ALL favorable houses with no obstacle-house significance.'],
    ['   - Promised with some obstruction: a planet connects ALL favorable houses but also touches an obstacle house.'],
    ['   - Partially / Weakly Promised: a planet connects 2+ (not all) favorable houses.'],
    ['   - Not clearly promised: no planet connects 2+ favorable houses in the data given.'],
    ['6. Timing: the running Mahadasha/Antardasha/Pratyantardasha lord is checked against the connecting planets — if it is one of them, the event is more likely to fructify in this period rather than remain a chart-only promise.'],
    [''],
    ['Caveat: this is a simplified, deterministic heuristic capturing the core KP "significator connection" rule.'],
    ['It does not weigh planetary strength, aspects, the house cusp\'s own sub-lord, or retrogression nuances.'],
    ['Treat the verdict as a first-pass screening to be confirmed against dasha timing and a qualified astrologer\'s judgement.']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logicRows), 'Logic');

  Object.values(lifeTopics).forEach(r => {
    const rows = [
      [r.topic.label],
      [r.topic.note],
      ['Favorable houses', r.topic.favorable.join(', ')],
      ['Obstacle houses', r.topic.obstacles.join(', ')],
      [''],
      ['House', 'Sign', 'Significators'],
      ...r.houseSig.map(h => [h.house, h.cuspSign || '', h.significators.join(', ')]),
      [''],
      ['Connecting Planet', 'Favorable Houses Linked', 'Also Touches Obstacle House(s)'],
      ...(r.connecting.length
        ? r.connecting.map(c => [c.planet, c.housesConnected.join(', '), c.obstacleHouses.join(', ') || ''])
        : [['(none)', '', '']]),
      [''],
      ['Verdict', r.verdict],
      ['Timing', r.timingNote]
    ];
    const sheetName = r.topic.label.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  });

  return wb;
}

function exportLifeTopicsReport() {
  if (!lastResults.lifeTopics) {
    el('statusMsg').textContent = 'Run "Compute KP Analysis" first, then export.';
    return;
  }
  const wb = buildLifeTopicsWorkbook(lastResults.lifeTopics);
  XLSX.writeFile(wb, 'kp-life-topics-report.xlsx');
  el('statusMsg').textContent = 'Exported kp-life-topics-report.xlsx';
}

document.addEventListener('DOMContentLoaded', init);
