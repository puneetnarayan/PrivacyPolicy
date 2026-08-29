// UI glue: reads planet/cusp tables (typed or uploaded JSON/CSV), birth/moon
// inputs, runs all KP calculations, and renders results.

const PLANET_NAMES_DEFAULT = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

let state = {
  planets: [],   // { name, sign, house, starLord, subLord, subSubLord, retrograde }
  cusps: [],     // { house, sign, starLord, subLord, subSubLord }
  // Cells last set by "Generate Full Chart" (not since hand-edited), as "rowIndex:col" keys.
  // Rendered with a light-green background until the user edits that specific cell.
  updatedPlanetCells: new Set(),
  updatedCuspCells: new Set()
};

const BIRTH_INPUT_IDS = ['birthLocalDate', 'birthLocalTime', 'birthLat', 'birthLon'];

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
  el('computeEphemerisBtn').addEventListener('click', computeEphemerisLongitudes);
  el('computeTransitBtn').addEventListener('click', computeTransitSnapshot);
  el('generateChartBtn').addEventListener('click', generateFullChart);
  el('startLiveRpBtn').addEventListener('click', startLiveRulingPlanets);
  el('startDynamicTransitBtn').addEventListener('click', startDynamicTransitTable);
  initRectifyTab();
  initEventTimingTab();
  initChartsTab();
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  el('timezoneMode').addEventListener('change', toggleTimezoneModeInputs);
  populateIanaZoneOptions();
  toggleTimezoneModeInputs();

  BIRTH_INPUT_IDS.forEach(id => {
    el(id).classList.add('birth-input-pending');
    el(id).addEventListener('input', () => {
      el(id).classList.remove('birth-input-submitted');
      el(id).classList.add('birth-input-pending');
    });
  });
  ['birthDateTime', 'moonLongitude'].forEach(id => {
    el(id).addEventListener('input', () => el(id).classList.remove('cell-updated'));
  });

  startLiveRulingPlanets();
  startDynamicTransitTable();

  initSettingsTab();
  checkForUpdatesIfDue(showUpdatePopup);
  initEngineStatusBadge();
}

function initEngineStatusBadge() {
  const render = () => {
    el('engineStatusBadge').textContent = window.SWISSEPH_READY
      ? 'Calculation engine: Swiss Ephemeris (WASM)'
      : 'Calculation engine: astronomy-engine (fallback — Swiss Ephemeris still loading or unavailable)';
  };
  render();
  document.addEventListener('swisseph-ready', render);
  document.addEventListener('swisseph-load-failed', render);
}

// --- Settings ---
function initSettingsTab() {
  const settings = loadSettings();

  const fillSelect = (selectId, options, currentValue) => {
    el(selectId).innerHTML = options.map(o =>
      `<option value="${o.id}" ${o.implemented ? '' : 'disabled'} ${o.id === currentValue ? 'selected' : ''}>${o.label}</option>`
    ).join('');
  };
  fillSelect('settingAyanamsa', AVAILABLE_AYANAMSAS, settings.ayanamsa);
  fillSelect('settingHouseSystem', AVAILABLE_HOUSE_SYSTEMS, settings.houseSystem);
  fillSelect('settingNodeMethod', AVAILABLE_NODE_METHODS, settings.nodeMethod);

  el('settingsLogicOutput').innerHTML = renderLogicDetails(SETTINGS_LOGIC_TEXT);
  renderSettingsSummary(settings);

  el('saveSettingsBtn').addEventListener('click', () => {
    const newSettings = {
      ayanamsa: el('settingAyanamsa').value,
      houseSystem: el('settingHouseSystem').value,
      nodeMethod: el('settingNodeMethod').value
    };
    saveSettings(newSettings);
    renderSettingsSummary(newSettings);
    el('statusMsg').textContent = 'Settings saved.';
  });

  el('checkUpdatesNowBtn').addEventListener('click', () => {
    el('updateCheckStatus').textContent = 'Checking...';
    checkForUpdatesNow({
      onUpdateAvailable: manifest => {
        el('updateCheckStatus').textContent = '';
        showUpdatePopup(manifest);
      },
      onUpToDate: () => { el('updateCheckStatus').textContent = "You're up to date (v" + INSTALLED_VERSION + ')'; },
      onNetworkError: () => {
        el('updateCheckStatus').textContent = '';
        showNoInternetPopup();
      }
    });
  });
}

function renderSettingsSummary(settings) {
  const summary = describeSettings(settings);
  el('settingsSummaryBox').innerHTML = `<h3>Current Settings</h3><p>${summary}</p>`;
  el('settingsUsedBadge').textContent = 'Settings used: ' + summary;
}

// --- Update checker ---

// "No internet" popup: auto-closes after 10 seconds OR immediately on
// Cancel, whichever happens first — per explicit request, unlike the silent
// background weekly check.
function showNoInternetPopup() {
  const popup = document.createElement('div');
  popup.className = 'update-popup no-internet';
  popup.innerHTML = `
    <h4>KP Astrology Analyzer</h4>
    <p>No internet connection — could not check for updates.</p>
    <div class="controls">
      <button id="noInternetCancelBtn">Cancel</button>
    </div>
  `;
  document.body.appendChild(popup);
  const close = () => popup.remove();
  popup.querySelector('#noInternetCancelBtn').addEventListener('click', close);
  setTimeout(close, 10000);
}

function showUpdatePopup(manifest) {
  const popup = document.createElement('div');
  popup.className = 'update-popup';
  popup.innerHTML = `
    <h4>KP Astrology Analyzer</h4>
    <p>A new version is available.</p>
    <p>Current version: ${INSTALLED_VERSION}<br>New version: ${manifest.version}</p>
    ${manifest.releaseNotes ? '<ul>' + manifest.releaseNotes.map(n => `<li>${n}</li>`).join('') + '</ul>' : ''}
    <div id="updatePopupBody">
      <div class="controls">
        <button id="updateNowBtn">Update Now</button>
        <button id="updateLaterBtn">Later</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);

  const close = () => popup.remove();
  let autoCloseTimer = setTimeout(close, 10000);

  popup.querySelector('#updateNowBtn').addEventListener('click', () => {
    clearTimeout(autoCloseTimer); // downloading can take longer than 10s — stop the auto-close once started
    startUpdateDownload(popup, manifest, close);
  });
  popup.querySelector('#updateLaterBtn').addEventListener('click', close);
}

// Downloads manifest.downloadUrl with a live progress bar, replacing the
// popup's button row. Offers Cancel throughout. On completion, hands the
// downloaded file to the browser's normal save flow (this app has no real
// signing/atomic-install infrastructure yet — see ARCHITECTURE_STATUS.md).
function startUpdateDownload(popup, manifest, close) {
  const body = popup.querySelector('#updatePopupBody');
  const abortController = new AbortController();
  body.innerHTML = `
    <p>Downloading update...</p>
    <progress id="updateProgressBar" value="0" max="100"></progress>
    <p id="updateProgressText" style="font-size:0.8em;color:#666;">0%</p>
    <div class="controls"><button id="updateCancelBtn">Cancel</button></div>
  `;
  body.querySelector('#updateCancelBtn').addEventListener('click', () => {
    abortController.abort();
    close();
  });

  downloadWithProgress(manifest.downloadUrl, (loaded, total) => {
    const bar = body.querySelector('#updateProgressBar');
    const text = body.querySelector('#updateProgressText');
    if (!bar) return; // popup was closed/cancelled mid-download
    if (total) {
      const pct = Math.round((loaded / total) * 100);
      bar.value = pct;
      bar.removeAttribute('indeterminate');
      text.textContent = pct + '%  (' + (loaded / 1e6).toFixed(1) + ' / ' + (total / 1e6).toFixed(1) + ' MB)';
    } else {
      bar.removeAttribute('value');
      text.textContent = (loaded / 1e6).toFixed(1) + ' MB downloaded';
    }
  }, abortController.signal)
    .then(blob => {
      if (!popup.isConnected) return; // cancelled
      const url = URL.createObjectURL(blob);
      const filename = manifest.downloadUrl.split('/').pop() || 'update-download';
      body.innerHTML = `<p>Downloaded. Click below to save it, then run it to install.</p>
        <div class="controls"><a id="saveUpdateLink" href="${url}" download="${filename}">Save Update File</a>
        <button id="updateDoneBtn">Close</button></div>`;
      body.querySelector('#updateDoneBtn').addEventListener('click', close);
    })
    .catch(err => {
      if (!popup.isConnected) return; // cancelled — already closed
      body.innerHTML = `<p>Download failed: ${err.message}</p><div class="controls"><button id="updateDoneBtn">Close</button></div>`;
      body.querySelector('#updateDoneBtn').addEventListener('click', close);
    });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
}

function toggleTimezoneModeInputs() {
  const mode = el('timezoneMode').value;
  el('ianaZoneLabel').hidden = mode !== 'iana';
  el('utcOffsetLabel').hidden = mode !== 'offset';
}

function populateIanaZoneOptions() {
  const select = el('ianaZone');
  let zones;
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch (e) {
    zones = null;
  }
  if (!zones || !zones.length) {
    select.innerHTML = '<option value="">(not supported in this browser — use UTC offset mode instead)</option>';
    el('timezoneMode').value = 'offset';
    toggleTimezoneModeInputs();
    return;
  }
  select.innerHTML = zones.map(z => `<option value="${z}">${z}</option>`).join('');
  const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (guessed && zones.includes(guessed)) select.value = guessed;
}

// Reads the local birth date/time + place + timezone, converts to UTC, and
// generates a full chart (planets + cusps) via the offline ephemeris and
// Placidus cusp calculation — filling both tables in one step.
function generateFullChart() {
  const dateStr = el('birthLocalDate').value;
  const timeStr = el('birthLocalTime').value;
  const lat = parseFloat(el('birthLat').value);
  const lon = parseFloat(el('birthLon').value);

  if (!dateStr || !timeStr || isNaN(lat) || isNaN(lon)) {
    el('statusMsg').textContent = 'Enter birth date, time, latitude, and longitude first.';
    return;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  let birthUtc;
  try {
    if (el('timezoneMode').value === 'iana') {
      const zone = el('ianaZone').value;
      if (!zone) { el('statusMsg').textContent = 'Select a time zone, or switch to UTC offset mode.'; return; }
      birthUtc = zonedLocalToUtc(year, month, day, hour, minute, zone);
    } else {
      const offsetMinutes = parseUtcOffsetToMinutes(el('utcOffset').value);
      birthUtc = offsetLocalToUtc(year, month, day, hour, minute, offsetMinutes);
    }
  } catch (err) {
    el('statusMsg').textContent = 'Timezone error: ' + err.message;
    return;
  }

  const chart = generateChart(birthUtc, lat, lon);

  state.planets = chart.planets.map(p => ({ ...p, longitude: String(p.longitude) }));
  state.cusps = chart.cusps.map(c => ({ house: c.house, sign: c.sign, nakshatra: c.nakshatra, pada: c.pada, starLord: c.starLord, subLord: c.subLord, subSubLord: c.subSubLord }));

  const planetCols = ['name', 'sign', 'nakshatra', 'pada', 'house', 'starLord', 'subLord', 'subSubLord', 'retrograde', 'longitude'];
  state.updatedPlanetCells = new Set();
  state.planets.forEach((p, i) => planetCols.forEach(c => state.updatedPlanetCells.add(i + ':' + c)));

  const cuspCols = ['house', 'sign', 'nakshatra', 'pada', 'starLord', 'subLord', 'subSubLord'];
  state.updatedCuspCells = new Set();
  state.cusps.forEach((c, i) => cuspCols.forEach(col => state.updatedCuspCells.add(i + ':' + col)));

  renderPlanetTable();
  renderCuspTable();

  const pad = n => String(n).padStart(2, '0');
  el('birthDateTime').value = `${birthUtc.getUTCFullYear()}-${pad(birthUtc.getUTCMonth() + 1)}-${pad(birthUtc.getUTCDate())}T${pad(birthUtc.getUTCHours())}:${pad(birthUtc.getUTCMinutes())}`;
  el('moonLongitude').value = chart.moonLongitude.toFixed(4);
  el('birthDateTime').classList.add('cell-updated');
  el('moonLongitude').classList.add('cell-updated');

  BIRTH_INPUT_IDS.forEach(id => {
    el(id).classList.remove('birth-input-pending');
    el(id).classList.add('birth-input-submitted');
  });

  el('autoChartOutput').innerHTML = renderLogicDetails(AUTO_CHART_LOGIC_TEXT) + renderLogicDetails(TIMEZONE_LOGIC_TEXT) + renderLogicDetails(PLACIDUS_LOGIC_TEXT) + renderLogicDetails(KP_SUBLORD_LOGIC_TEXT) +
    `<p>Generated chart for birth UTC instant: <strong>${birthUtc.toISOString()}</strong>. Review the Planets and Cusps tables above, then run "Compute KP Analysis" below.</p>`;
  el('statusMsg').textContent = 'Full chart generated. Review Planets/Cusps tables, then click "Compute KP Analysis".';
}

// Fills the Planets table's longitude column (and sign, if blank) from the
// offline ephemeris, using the birth date/time already entered. No network
// call is made — everything runs from ephemeris.js's local models.
function computeEphemerisLongitudes() {
  const birthStr = el('birthDateTime').value;
  if (!birthStr) {
    el('statusMsg').textContent = 'Enter Birth Date/Time first (in the Dasha & Ruling Planet Inputs section above).';
    return;
  }
  const birthDateTime = new Date(birthStr);
  const longitudes = computePlanetLongitudes(birthDateTime);

  let filled = 0;
  state.planets.forEach((p, i) => {
    if (longitudes[p.name] !== undefined) {
      p.longitude = longitudes[p.name].toFixed(4);
      state.updatedPlanetCells.add(i + ':longitude');
      if (!p.sign) {
        const lords = deriveKpLords(longitudes[p.name]);
        p.sign = lords.sign;
        p.nakshatra = lords.nakshatra;
        p.pada = lords.pada;
        ['sign', 'nakshatra', 'pada'].forEach(c => state.updatedPlanetCells.add(i + ':' + c));
      }
      filled++;
    }
  });
  renderPlanetTable();
  el('ephemerisOutput').innerHTML = renderLogicDetails(EPHEMERIS_LOGIC_TEXT) +
    `<p>Filled exact longitude for ${filled} planet row(s). Ayanamsa used: Lahiri, ${lahiriAyanamsaDegrees(birthDateTime).toFixed(4)}° at this date.</p>`;
  el('statusMsg').textContent = `Ephemeris: filled longitude for ${filled} planet(s). Re-run "Compute KP Analysis" to refresh dependent reports.`;
}

function computeTransitSnapshot() {
  const momentStr = el('transitMoment').value;
  const moment = momentStr ? new Date(momentStr) : new Date();
  const longitudes = computePlanetLongitudes(moment);
  const cusps = state.cusps.filter(c => c.house);

  const planetsForAspect = Object.keys(longitudes).map(name => ({ name, longitude: longitudes[name] }));
  const aspects = cusps.length ? findAspects(planetsForAspect, cusps) : [];

  let html = renderLogicDetails(EPHEMERIS_LOGIC_TEXT);
  html += `<p><strong>Snapshot for:</strong> ${moment.toISOString()}</p>`;
  html += '<table><thead><tr><th>Planet</th><th>Longitude</th><th>Sign</th><th>Aspected Houses (whole-sign)</th></tr></thead><tbody>';
  Object.keys(longitudes).forEach(name => {
    const lon = longitudes[name];
    const sign = SIGNS[Math.floor(lon / 30)];
    const aspect = aspects.find(a => a.planet === name);
    html += `<tr><td>${name}</td><td>${lon.toFixed(2)}°</td><td>${sign}</td><td>${aspect ? aspect.aspectedHouses.join(', ') : '(no cusps loaded)'}</td></tr>`;
  });
  html += '</tbody></table>';
  el('transitOutput').innerHTML = html;
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
  return { name: name || '', sign: '', nakshatra: '', pada: '', house: '', starLord: '', subLord: '', subSubLord: '', retrograde: false, longitude: '' };
}
function blankCusp(house) {
  return { house, sign: '', nakshatra: '', pada: '', starLord: '', subLord: '', subSubLord: '' };
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
  const cols = ['name', 'sign', 'nakshatra', 'pada', 'house', 'starLord', 'subLord', 'subSubLord', 'retrograde', 'longitude'];
  el('planetTable').innerHTML = renderEditableTable('planets', state.planets, cols, state.updatedPlanetCells);
  attachTableListeners('planetTable', 'planets', cols);
}
function renderCuspTable() {
  const cols = ['house', 'sign', 'nakshatra', 'pada', 'starLord', 'subLord', 'subSubLord'];
  el('cuspTable').innerHTML = renderEditableTable('cusps', state.cusps, cols, state.updatedCuspCells);
  attachTableListeners('cuspTable', 'cusps', cols);
}

function renderEditableTable(kind, rows, cols, updatedCells) {
  let html = '<table><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach((row, i) => {
    html += '<tr>' + cols.map(c => {
      const updatedClass = updatedCells && updatedCells.has(i + ':' + c) ? ' class="cell-updated"' : '';
      if (c === 'retrograde') {
        return `<td><input type="checkbox" data-row="${i}" data-col="${c}"${updatedClass} ${row[c] ? 'checked' : ''}></td>`;
      }
      return `<td><input type="text" data-row="${i}" data-col="${c}"${updatedClass} value="${row[c] ?? ''}"></td>`;
    }).join('') + '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function attachTableListeners(tableId, kind, cols) {
  const updatedCells = kind === 'planets' ? state.updatedPlanetCells : state.updatedCuspCells;
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
      updatedCells.delete(row + ':' + col);
      input.classList.remove('cell-updated');
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

    // Planetary Relations (combustion/conjunction/aspect) — only for planets with a numeric longitude.
    const planetsWithLongitude = planets
      .map(p => ({ ...p, longitude: parseFloat(p.longitude) }))
      .filter(p => !isNaN(p.longitude));
    if (planetsWithLongitude.length) {
      const relations = analyzePlanetaryRelations(planetsWithLongitude, cusps);
      renderPlanetaryRelations(relations);
    } else {
      el('planetaryRelationsOutput').innerHTML = renderLogicDetails(PLANETARY_RELATIONS_LOGIC_TEXT) +
        '<p>No planet has an exact longitude yet — use the Ephemeris section above (or type longitudes manually) to enable this.</p>';
    }

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

    renderAllVedicCharts();

    el('statusMsg').textContent = 'Computation complete.';
  } catch (err) {
    el('statusMsg').textContent = 'Error: ' + err.message;
    console.error(err);
  }
}

// Renders any of the *_LOGIC_TEXT arrays (from significators.js, rulingPlanets.js,
// dasha.js, lifePromise.js) as a collapsible block, so each module's logic is
// shown once, sourced from that module, instead of being retyped in ui.js.
function renderLogicDetails(logicTextRows) {
  return '<details><summary>Logic and sequence used below</summary><pre>' +
    logicTextRows.map(row => row[0] || '').join('\n') +
    '</pre></details>';
}

function renderSignificators(byHouse) {
  let html = renderLogicDetails(SIGNIFICATOR_LOGIC_TEXT);
  html += '<table><thead><tr><th>House</th><th>Cusp Sign</th><th>Occupants</th><th>Owners</th><th>Star Lord of Occupants</th><th>Star Lord of Owners</th><th>All Significators</th></tr></thead><tbody>';
  for (let h = 1; h <= 12; h++) {
    const s = byHouse[h];
    html += `<tr><td>${h}</td><td>${s.cuspSign || ''}</td><td>${s.occupants.join(', ')}</td><td>${s.owners.join(', ')}</td><td>${s.starLordOfOccupants.join(', ')}</td><td>${s.starLordOfOwners.join(', ')}</td><td>${s.allSignificators.join(', ')}</td></tr>`;
  }
  html += '</tbody></table>';
  el('significatorsOutput').innerHTML = html;
}

function renderPlanetaryRelations(relations) {
  let html = renderLogicDetails(PLANETARY_RELATIONS_LOGIC_TEXT);

  html += '<h4>Combust Planets</h4><table><thead><tr><th>Planet</th><th>Separation from Sun</th><th>Orb</th></tr></thead><tbody>';
  relations.combust.forEach(c => {
    html += `<tr><td>${c.planet}</td><td>${c.separationFromSun}°</td><td>${c.orb}°</td></tr>`;
  });
  if (!relations.combust.length) html += '<tr><td colspan="3">None</td></tr>';
  html += '</tbody></table>';

  html += '<h4>Conjunctions</h4><table><thead><tr><th>Planet A</th><th>Planet B</th><th>Separation</th></tr></thead><tbody>';
  relations.conjunctions.forEach(c => {
    html += `<tr><td>${c.planetA}</td><td>${c.planetB}</td><td>${c.separation}°</td></tr>`;
  });
  if (!relations.conjunctions.length) html += '<tr><td colspan="3">None</td></tr>';
  html += '</tbody></table>';

  html += '<h4>Aspects (whole-sign)</h4><table><thead><tr><th>Planet</th><th>Aspected Signs</th><th>Aspected Houses</th></tr></thead><tbody>';
  relations.aspects.forEach(a => {
    html += `<tr><td>${a.planet}</td><td>${a.aspectedSigns.join(', ')}</td><td>${a.aspectedHouses.join(', ') || '—'}</td></tr>`;
  });
  html += '</tbody></table>';

  el('planetaryRelationsOutput').innerHTML = html;
}

function renderRulingPlanets(rp) {
  el('rulingPlanetsOutput').innerHTML = renderLogicDetails(RULING_PLANET_LOGIC_TEXT) + `
    <p><strong>Day Lord:</strong> ${rp.dayLord}</p>
    <p><strong>Ascendant Lords:</strong> Sign: ${rp.ascendantLords.signLord}, Star: ${rp.ascendantLords.starLord}, Sub: ${rp.ascendantLords.subLord}</p>
    <p><strong>Moon Lords:</strong> Sign: ${rp.moonLords.signLord}, Star: ${rp.moonLords.starLord}, Sub: ${rp.moonLords.subLord}</p>
    <p><strong>All Ruling Planets:</strong> ${rp.allRulingPlanets.join(', ')}</p>
  `;
}

function renderDasha(dasha) {
  const fmt = d => d.toISOString().slice(0, 10);
  let html = renderLogicDetails(DASHA_LOGIC_TEXT);
  html += `<p><strong>Birth Nakshatra:</strong> ${dasha.birthNakshatra.name} (Star Lord: ${dasha.birthNakshatra.starLord})</p>`;
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

// Each life topic gets its own pastel-colored card, cycled through this list.
const LIFE_TOPIC_PASTELS = ['pastel-pink', 'pastel-blue', 'pastel-yellow', 'pastel-mint', 'pastel-lavender', 'pastel-peach'];

function renderLifeTopics(lifeTopics) {
  let html = renderLogicDetails(LIFE_TOPIC_LOGIC_TEXT) + '<div class="rp-live-container">';
  Object.values(lifeTopics).forEach((result, i) => {
    html += `<div class="rp-box ${LIFE_TOPIC_PASTELS[i % LIFE_TOPIC_PASTELS.length]}">`;
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
    html += '</div>';
  });
  html += '</div>';
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

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(LIFE_TOPIC_LOGIC_TEXT), 'Logic');

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

// --- Live Ruling Planets (astrologer's location) ---
let liveRpTimer = null;
let liveRpLat = null;
let liveRpLon = null;
let liveRpUpcoming = [];

function startLiveRulingPlanets() {
  liveRpLat = parseFloat(el('astroLat').value);
  liveRpLon = parseFloat(el('astroLon').value);
  if (isNaN(liveRpLat) || isNaN(liveRpLon)) {
    el('statusMsg').textContent = 'Enter the astrologer\'s latitude and longitude first.';
    return;
  }
  if (liveRpTimer) clearInterval(liveRpTimer);
  el('liveRpLogicOutput').innerHTML = renderLogicDetails(LIVE_RP_LOGIC_TEXT);
  refreshLiveRulingPlanets();
  liveRpTimer = setInterval(tickLiveRulingPlanets, 1000);
  el('statusMsg').textContent = 'Live Ruling Planets display started.';
}

function refreshLiveRulingPlanets() {
  const now = new Date();
  const live = computeLiveRulingPlanets(now, liveRpLat, liveRpLon);
  liveRpUpcoming = getUpcomingChanges(now, liveRpLat, liveRpLon);
  renderLiveRulingPlanetsBox(live, now);
  renderUpcomingChangesBox(liveRpUpcoming);
}

function tickLiveRulingPlanets() {
  const now = new Date();
  if (liveRpUpcoming.length && liveRpUpcoming[0].changeAt.getTime() <= now.getTime()) {
    refreshLiveRulingPlanets();
    return;
  }
  updateLiveRpClockAndCountdowns(now);
}

const LEVEL_LABEL = { subSub: 'Sub-Sub Lord', sub: 'Sub Lord', star: 'Star Lord (Nakshatra)', sign: 'Sign' };

function renderLiveRulingPlanetsBox(live, now) {
  el('liveRpBox').innerHTML = `
    <h3>Live Ruling Planets</h3>
    <p id="liveRpClock" style="font-size:0.8em;color:#666;"></p>
    <p><strong>Day Lord:</strong> ${live.dayLord}</p>
    <p><strong>Ascendant:</strong> ${live.ascendant.sign} (${live.ascendant.nakshatra})<br>Star: ${live.ascendant.starLord} · Sub: ${live.ascendant.subLord} · Sub-Sub: ${live.ascendant.subSubLord}</p>
    <p><strong>Moon:</strong> ${live.moon.sign} (${live.moon.nakshatra})<br>Star: ${live.moon.starLord} · Sub: ${live.moon.subLord} · Sub-Sub: ${live.moon.subSubLord}</p>
    <p><strong>All Ruling Planets:</strong> ${live.allRulingPlanets.join(', ')}</p>
  `;
}

function renderUpcomingChangesBox(upcoming) {
  let html = '<h3>Upcoming Changes</h3><ul class="countdown-list">';
  upcoming.forEach((u, i) => {
    const fromLabel = u.fromKey.split('|').pop();
    const toLabel = u.toKey.split('|').pop();
    html += `<li><strong>${u.body} — ${LEVEL_LABEL[u.level]}</strong><br>${fromLabel} &rarr; ${toLabel} at ${u.changeAt.toLocaleTimeString()}<br><span class="countdown" data-target="${u.changeAt.getTime()}">--:--:--</span></li>`;
  });
  html += '</ul>';
  el('upcomingChangesBox').innerHTML = html || '<h3>Upcoming Changes</h3><p>None found in the search window.</p>';
  updateLiveRpClockAndCountdowns(new Date());
}

function updateLiveRpClockAndCountdowns(now) {
  const clock = el('liveRpClock');
  if (clock) clock.textContent = now.toLocaleString();
  document.querySelectorAll('#upcomingChangesBox .countdown').forEach(countdownEl => {
    const target = Number(countdownEl.dataset.target);
    let diff = Math.max(0, Math.round((target - now.getTime()) / 1000));
    const h = Math.floor(diff / 3600); diff -= h * 3600;
    const m = Math.floor(diff / 60); diff -= m * 60;
    const s = diff;
    countdownEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });
}

// --- Dynamic Transit Table (all 9 planets, live) ---
let dynTransitTimer = null;
let dynTransitLat = null;
let dynTransitLon = null;
let dynTransitUpcoming = [];

function startDynamicTransitTable() {
  dynTransitLat = parseFloat(el('transitLat').value);
  dynTransitLon = parseFloat(el('transitLon').value);
  if (isNaN(dynTransitLat) || isNaN(dynTransitLon)) {
    el('statusMsg').textContent = 'Enter latitude and longitude for the Live Transit Table first.';
    return;
  }
  if (dynTransitTimer) clearInterval(dynTransitTimer);
  el('dynamicTransitLogicOutput').innerHTML = renderLogicDetails(DYNAMIC_TRANSIT_LOGIC_TEXT);
  refreshDynamicTransitTable();
  dynTransitTimer = setInterval(tickDynamicTransitTable, 1000);
}

function refreshDynamicTransitTable() {
  const now = new Date();
  const table = computeTransitTable(now, dynTransitLat, dynTransitLon);
  dynTransitUpcoming = computeAllPlanetUpcomingChanges(now);
  renderDynamicTransitTableBox(table, now);
  renderDynamicTransitCountdownBox(dynTransitUpcoming);
}

function tickDynamicTransitTable() {
  const now = new Date();
  if (dynTransitUpcoming.length && dynTransitUpcoming[0].changeAt.getTime() <= now.getTime()) {
    refreshDynamicTransitTable();
    return;
  }
  updateDynamicTransitClockAndCountdowns(now);
}

function renderDynamicTransitTableBox(table, now) {
  let html = `<h3>Live Transit Table</h3><p id="dynTransitClock" style="font-size:0.8em;color:#666;"></p>`;
  html += '<table><thead><tr><th>Planet</th><th>Sign</th><th>Nakshatra</th><th>Star Lord</th><th>Sub Lord</th><th>Sub-Sub Lord</th><th>House</th></tr></thead><tbody>';
  table.forEach(p => {
    html += `<tr><td>${p.name}</td><td>${p.sign}</td><td>${p.nakshatra}</td><td>${p.starLord}</td><td>${p.subLord}</td><td>${p.subSubLord}</td><td>${p.house}</td></tr>`;
  });
  html += '</tbody></table>';
  el('dynamicTransitTableBox').innerHTML = html;
}

const DYNAMIC_TRANSIT_COUNTDOWN_LIMIT = 20;

function renderDynamicTransitCountdownBox(upcoming) {
  const shown = upcoming.slice(0, DYNAMIC_TRANSIT_COUNTDOWN_LIMIT);
  let html = '<h3>Upcoming Changes (soonest first)</h3><ul class="countdown-list">';
  shown.forEach(u => {
    const fromLabel = u.fromKey.split('|').pop();
    const toLabel = u.toKey.split('|').pop();
    html += `<li><strong>${u.body} — ${LEVEL_LABEL[u.level]}</strong><br>${fromLabel} &rarr; ${toLabel} at ${u.changeAt.toLocaleString()}<br><span class="countdown" data-target="${u.changeAt.getTime()}">--:--:--</span></li>`;
  });
  html += '</ul>';
  if (upcoming.length > shown.length) {
    html += `<p style="font-size:0.8em;color:#666;">${upcoming.length - shown.length} more (slower, further-out) changes not shown.</p>`;
  }
  el('dynamicTransitCountdownBox').innerHTML = html || '<h3>Upcoming Changes</h3><p>None found in the search window.</p>';
  updateDynamicTransitClockAndCountdowns(new Date());
}

function updateDynamicTransitClockAndCountdowns(now) {
  const clock = el('dynTransitClock');
  if (clock) clock.textContent = now.toLocaleString();
  document.querySelectorAll('#dynamicTransitCountdownBox .countdown').forEach(countdownEl => {
    const target = Number(countdownEl.dataset.target);
    let diffSec = Math.max(0, Math.round((target - now.getTime()) / 1000));
    const d = Math.floor(diffSec / 86400); diffSec -= d * 86400;
    const h = Math.floor(diffSec / 3600); diffSec -= h * 3600;
    const m = Math.floor(diffSec / 60); diffSec -= m * 60;
    const s = diffSec;
    countdownEl.textContent = (d > 0 ? d + 'd ' : '') + `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });
}

// --- Birth Time Rectification ---
let rectifyEvents = [{ type: 'marriage', date: '' }, { type: 'career', date: '' }];

function initRectifyTab() {
  el('rectifyLogicOutput').innerHTML = renderLogicDetails(RECTIFICATION_LOGIC_TEXT);
  renderRectifyEventsTable();

  const zones = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return null; } })();
  if (zones && zones.length) {
    el('rectifyIanaZone').innerHTML = zones.map(z => `<option value="${z}">${z}</option>`).join('');
    const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (guessed && zones.includes(guessed)) el('rectifyIanaZone').value = guessed;
  } else {
    el('rectifyIanaZone').innerHTML = '<option value="">(not supported — use UTC offset mode)</option>';
    el('rectifyTzMode').value = 'offset';
  }
  toggleRectifyTzModeInputs();

  el('rectifyTzMode').addEventListener('change', toggleRectifyTzModeInputs);
  el('addRectifyEventBtn').addEventListener('click', () => {
    rectifyEvents.push({ type: 'marriage', date: '' });
    renderRectifyEventsTable();
  });
  el('runRectifyBtn').addEventListener('click', runRectification);
}

function toggleRectifyTzModeInputs() {
  const mode = el('rectifyTzMode').value;
  el('rectifyIanaZoneLabel').hidden = mode !== 'iana';
  el('rectifyUtcOffsetLabel').hidden = mode !== 'offset';
}

function renderRectifyEventsTable() {
  const typeOptions = Object.keys(RECTIFICATION_EVENT_TYPES)
    .map(key => `<option value="${key}">${RECTIFICATION_EVENT_TYPES[key].label}</option>`).join('');
  let html = '<table><thead><tr><th>Event Type</th><th>Event Date</th><th></th></tr></thead><tbody>';
  rectifyEvents.forEach((ev, i) => {
    html += `<tr>
      <td><select data-row="${i}" data-field="type">${typeOptions}</select></td>
      <td><input type="date" data-row="${i}" data-field="date" value="${ev.date}"></td>
      <td><button data-row="${i}" class="removeRectifyEventBtn">Remove</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  el('rectifyEventsTable').innerHTML = html;

  el('rectifyEventsTable').querySelectorAll('select, input').forEach(input => {
    input.addEventListener('change', () => {
      const row = Number(input.dataset.row);
      rectifyEvents[row][input.dataset.field] = input.value;
    });
  });
  el('rectifyEventsTable').querySelectorAll('.removeRectifyEventBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      rectifyEvents.splice(Number(btn.dataset.row), 1);
      renderRectifyEventsTable();
    });
  });

  // Restore each row's selected event type (innerHTML rebuild resets <select> to its first option).
  rectifyEvents.forEach((ev, i) => {
    const select = el('rectifyEventsTable').querySelector(`select[data-row="${i}"]`);
    if (select) select.value = ev.type;
  });
}

function runRectification() {
  const dateStr = el('rectifyDate').value;
  const timeStr = el('rectifyTime').value;
  const lat = parseFloat(el('rectifyLat').value);
  const lon = parseFloat(el('rectifyLon').value);
  const windowMinutes = parseInt(el('rectifyWindow').value, 10);
  const stepMinutes = parseInt(el('rectifyStep').value, 10);

  if (!dateStr || !timeStr || isNaN(lat) || isNaN(lon)) {
    el('statusMsg').textContent = 'Enter approximate birth date, time, latitude, and longitude first.';
    return;
  }
  const eventsWithDates = rectifyEvents.filter(ev => ev.date);
  if (!eventsWithDates.length) {
    el('statusMsg').textContent = 'Add at least one known life event with a date.';
    return;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  let centerUtc;
  try {
    if (el('rectifyTzMode').value === 'iana') {
      const zone = el('rectifyIanaZone').value;
      if (!zone) { el('statusMsg').textContent = 'Select a time zone, or switch to UTC offset mode.'; return; }
      centerUtc = zonedLocalToUtc(year, month, day, hour, minute, zone);
    } else {
      centerUtc = offsetLocalToUtc(year, month, day, hour, minute, parseUtcOffsetToMinutes(el('rectifyUtcOffset').value));
    }
  } catch (err) {
    el('statusMsg').textContent = 'Timezone error: ' + err.message;
    return;
  }

  const events = eventsWithDates.map(ev => {
    const [ey, em, ed] = ev.date.split('-').map(Number);
    return { type: ev.type, date: new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0)) };
  });

  el('statusMsg').textContent = 'Running rectification...';
  const results = rectifyBirthTime(centerUtc, windowMinutes, stepMinutes, lat, lon, events);
  renderRectifyResults(results, events.length);
  el('statusMsg').textContent = `Rectification complete: ${results.length} candidate time(s) scored.`;
}

function renderRectifyResults(results, eventCount) {
  const maxPossible = eventCount * 3;
  const topScore = results.length ? results[0].score : 0;

  let html = `<h3>Rectification Results</h3><p>Ranked best-fit first. Top score: ${topScore} / ${maxPossible}.</p>`;
  html += '<table><thead><tr><th>Candidate Birth Time (UTC)</th><th>Score</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const isTop = r.score === topScore;
    html += `<tr class="rectifyResultRow" data-idx="${i}" ${isTop ? 'style="font-weight:bold;background:#f0e6ff;"' : ''}>
      <td>${r.candidateUtc.toISOString()}</td><td>${r.score} / ${r.maxPossible}</td></tr>`;
  });
  html += '</tbody></table><div id="rectifyDetailBox"></div>';
  el('rectifyOutput').innerHTML = html;

  el('rectifyOutput').querySelectorAll('.rectifyResultRow').forEach(row => {
    row.addEventListener('click', () => renderRectifyDetail(results[Number(row.dataset.idx)]));
  });
  if (results.length) renderRectifyDetail(results[0]);
}

function renderRectifyDetail(result) {
  let html = `<h4>Detail for ${result.candidateUtc.toISOString()}</h4>`;
  html += '<table><thead><tr><th>Event</th><th>Houses</th><th>Running Lords (M/A/P)</th><th>Matches</th></tr></thead><tbody>';
  result.perEvent.forEach(pe => {
    const lords = [pe.runningLords.mahadasha, pe.runningLords.antardasha, pe.runningLords.pratyantardasha].filter(Boolean).join(' / ');
    html += `<tr><td>${pe.label}</td><td>${pe.houses.join(', ')}</td><td>${lords}</td><td>${pe.matches.join(', ') || '—'}</td></tr>`;
  });
  html += '</tbody></table>';
  el('rectifyDetailBox').innerHTML = html;
}

// --- Event Timing & Fructification ---
let eventTimingMonths = [];
let eventTimingNatal = null;

function initEventTimingTab() {
  el('eventTimingLogicOutput').innerHTML = renderLogicDetails(EVENT_TIMING_LOGIC_TEXT);

  const byCategory = {};
  Object.keys(EVENT_RULES).forEach(key => {
    const cat = EVENT_RULES[key].category;
    (byCategory[cat] = byCategory[cat] || []).push(key);
  });
  el('eventTimingSelect').innerHTML = Object.keys(byCategory).map(cat =>
    `<optgroup label="${cat}">` +
    byCategory[cat].map(key => `<option value="${key}">${EVENT_RULES[key].label}</option>`).join('') +
    '</optgroup>'
  ).join('');

  const today = new Date();
  el('eventTimingStartDate').value = today.toISOString().slice(0, 10);

  el('eventTimingHorizon').addEventListener('change', () => {
    el('eventTimingCustomYearsLabel').hidden = el('eventTimingHorizon').value !== 'custom';
  });
  el('runEventTimingBtn').addEventListener('click', runEventTimingSearch);
}

function runEventTimingSearch() {
  if (!state.planets.length || !state.cusps.length) {
    el('statusMsg').textContent = 'Load/generate a chart in the Chart & Analysis tab first.';
    return;
  }
  const moonLon = parseFloat(el('moonLongitude').value);
  const birthStr = el('birthDateTime').value;
  if (isNaN(moonLon) || !birthStr) {
    el('statusMsg').textContent = 'Enter Moon Longitude and Birth Date/Time (UTC) in the Chart & Analysis tab first.';
    return;
  }

  const eventKey = el('eventTimingSelect').value;
  const horizonSel = el('eventTimingHorizon').value;
  const years = horizonSel === 'custom' ? parseInt(el('eventTimingCustomYears').value, 10) : parseInt(horizonSel, 10);
  const startDate = new Date(el('eventTimingStartDate').value + 'T00:00:00Z');
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear() + years, startDate.getUTCMonth(), startDate.getUTCDate()));
  const windowThreshold = parseInt(el('eventTimingWindowThreshold').value, 10);
  const topN = parseInt(el('eventTimingTopMonths').value, 10);

  el('statusMsg').textContent = 'Searching timeline...';

  eventTimingNatal = buildNatalContext(
    state.planets.filter(p => p.name), state.cusps.filter(c => c.house),
    moonLon, new Date(birthStr)
  );

  const promise = scorePromise(EVENT_RULES[eventKey], eventTimingNatal.significators, EVENT_TIMING_WEIGHTS);
  renderEventTimingPromise(eventKey, promise);

  eventTimingMonths = searchMonths(eventKey, eventTimingNatal, startDate, endDate);
  renderEventTimingYears(eventKey, eventTimingMonths);

  // Auto-drill into the top N months to build a ranked "Top Windows" list across the whole horizon.
  const topMonths = [...eventTimingMonths].sort((a, b) => b.total - a.total).slice(0, topN);
  const allWindows = [];
  topMonths.forEach(m => {
    const days = searchDays(eventKey, eventTimingNatal, m.year, m.month);
    detectWindows(days, windowThreshold).forEach(w => allWindows.push({ year: m.year, month: m.month, ...w }));
  });
  allWindows.sort((a, b) => b.peak.total - a.peak.total);
  renderEventTimingTopWindows(eventKey, allWindows);

  el('statusMsg').textContent = `Event timing search complete: ${eventTimingMonths.length} months screened, ${topMonths.length} drilled into daily detail.`;
}

function renderEventTimingPromise(eventKey, promise) {
  const eventDef = EVENT_RULES[eventKey];
  el('eventTimingPromiseBox').innerHTML = `
    <h3>Event Promise: ${eventDef.label}</h3>
    <p><strong>${promise.promised ? 'YES — promise found' : 'NOT clearly promised'}</strong> (required houses: ${eventDef.requiredHouses.join(', ')})</p>
    <p>${promise.bestPlanet ? `Best connecting planet: <strong>${promise.bestPlanet}</strong>, signifying houses ${promise.housesConnected.join(', ')} of ${eventDef.requiredHouses.length}.` : 'No single planet connects the required houses.'}</p>
    <p style="font-size:0.85em;color:#666;">Timing below is only meaningful once promise is established — see the Life Topic Promise Analysis tab for a fuller promise check.</p>
  `;
}

const LEVEL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function renderEventTimingTopWindows(eventKey, windows) {
  let html = '<h3>Top Event Windows (ranked)</h3>';
  if (!windows.length) {
    html += '<p>No windows found at the selected threshold in the drilled-into months. Try a lower threshold or more months.</p>';
  } else {
    html += '<table><thead><tr><th>#</th><th>Window</th><th>Peak Date</th><th>Peak Score</th><th>Classification</th></tr></thead><tbody>';
    windows.forEach((w, i) => {
      const monthName = LEVEL_MONTH_NAMES[w.month];
      html += `<tr class="eventWindowRow" data-idx="${i}" style="cursor:pointer;">
        <td>${i + 1}</td><td>${w.startDay}-${w.endDay} ${monthName} ${w.year}</td>
        <td>${w.peak.day} ${monthName} ${w.year}</td><td>${w.peak.total}</td><td>${w.peak.classification}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  el('eventTimingWindowsBox').innerHTML = html;
  el('eventTimingWindowsBox').querySelectorAll('.eventWindowRow').forEach(row => {
    row.addEventListener('click', () => {
      const w = windows[Number(row.dataset.idx)];
      renderEventTimingMonthsForYear(eventKey, w.year);
      renderEventTimingDays(eventKey, w.year, w.month);
      renderEventTimingHours(eventKey, w.year, w.month, w.peak.day);
    });
  });
}

function renderEventTimingYears(eventKey, months) {
  const byYear = {};
  months.forEach(m => { (byYear[m.year] = byYear[m.year] || []).push(m); });

  let html = '<h3>Years</h3><table><thead><tr><th>Year</th><th>Peak Score</th><th>Strongest Month</th></tr></thead><tbody>';
  Object.keys(byYear).sort().forEach(year => {
    const yearMonths = byYear[year];
    const peak = yearMonths.reduce((b, m) => (m.total > b.total ? m : b), yearMonths[0]);
    html += `<tr class="eventYearRow" data-year="${year}" style="cursor:pointer;">
      <td>${year}</td><td>${peak.total} (${peak.classification})</td><td>${LEVEL_MONTH_NAMES[peak.month]}</td></tr>`;
  });
  html += '</tbody></table>';
  el('eventTimingYearsBox').innerHTML = html;

  el('eventTimingYearsBox').querySelectorAll('.eventYearRow').forEach(row => {
    row.addEventListener('click', () => renderEventTimingMonthsForYear(eventKey, Number(row.dataset.year)));
  });
}

function renderEventTimingMonthsForYear(eventKey, year) {
  const yearMonths = eventTimingMonths.filter(m => m.year === year);
  let html = `<h3>Months — ${year}</h3><table><thead><tr><th>Month</th><th>Score</th><th>Classification</th></tr></thead><tbody>`;
  yearMonths.forEach(m => {
    html += `<tr class="eventMonthRow" data-year="${m.year}" data-month="${m.month}" style="cursor:pointer;">
      <td>${LEVEL_MONTH_NAMES[m.month]}</td><td>${m.total}</td><td>${m.classification}</td></tr>`;
  });
  html += '</tbody></table>';
  el('eventTimingMonthsBox').innerHTML = html;

  el('eventTimingMonthsBox').querySelectorAll('.eventMonthRow').forEach(row => {
    row.addEventListener('click', () => renderEventTimingDays(eventKey, Number(row.dataset.year), Number(row.dataset.month)));
  });
}

function renderEventTimingDays(eventKey, year, month) {
  const days = searchDays(eventKey, eventTimingNatal, year, month);
  let html = `<h3>Days — ${LEVEL_MONTH_NAMES[month]} ${year}</h3><table><thead><tr><th>Day</th><th>Score</th><th>Classification</th></tr></thead><tbody>`;
  days.forEach(d => {
    html += `<tr class="eventDayRow" data-year="${year}" data-month="${month}" data-day="${d.day}" style="cursor:pointer;">
      <td>${d.day}</td><td>${d.total}</td><td>${d.classification}</td></tr>`;
  });
  html += '</tbody></table>';
  el('eventTimingDaysBox').innerHTML = html;

  el('eventTimingDaysBox').querySelectorAll('.eventDayRow').forEach(row => {
    row.addEventListener('click', () => renderEventTimingHours(eventKey, Number(row.dataset.year), Number(row.dataset.month), Number(row.dataset.day)));
  });
}

function renderEventTimingHours(eventKey, year, month, day) {
  const hours = searchHours(eventKey, eventTimingNatal, year, month, day);
  let html = `<h3>Hours — ${day} ${LEVEL_MONTH_NAMES[month]} ${year} (UTC)</h3><table><thead><tr><th>Hour</th><th>Score</th><th>Classification</th></tr></thead><tbody>`;
  hours.forEach(h => {
    html += `<tr class="eventHourRow" data-idx="${h.hour}" style="cursor:pointer;">
      <td>${String(h.hour).padStart(2, '0')}:00</td><td>${h.total}</td><td>${h.classification}</td></tr>`;
  });
  html += '</tbody></table>';
  el('eventTimingHoursBox').innerHTML = html;

  el('eventTimingHoursBox').querySelectorAll('.eventHourRow').forEach(row => {
    row.addEventListener('click', () => renderEventTimingDetail(hours[Number(row.dataset.idx)]));
  });

  // Auto-show the peak hour's detail.
  const bestHour = hours.reduce((b, h) => (h.total > b.total ? h : b), hours[0]);
  renderEventTimingDetail(bestHour);
}

function renderEventTimingDetail(result) {
  const lords = [result.runningLords.mahadasha, result.runningLords.antardasha, result.runningLords.pratyantardasha, result.runningLords.sookshmadasha].filter(Boolean).join(' / ');
  let html = `<h3>Detail — ${result.date.toISOString()}</h3>`;
  html += `<p><strong>Activation Score: ${result.total}/100 (${result.classification})</strong></p>`;
  html += `<p><strong>DBA:</strong> ${lords}</p>`;
  html += `<p><strong>Required Houses:</strong> ${result.requiredHouses.join(', ')}</p>`;
  html += '<p><strong>Score Breakdown:</strong></p><ul>';
  html += `<li>Event Promise: ${result.breakdown.promise.score} / ${result.breakdown.promise.maxScore}</li>`;
  html += `<li>DBA Capability: ${result.breakdown.dba.score} / ${result.breakdown.dba.maxScore} (${result.breakdown.dba.capableCount}/${result.breakdown.dba.totalLords} lords capable)</li>`;
  html += `<li>Transit → Significator: ${result.breakdown.transit.breakdown.significator.score} / ${result.breakdown.transit.breakdown.significator.max} (raw, before DBA dampening)</li>`;
  html += `<li>Transit → Cusp: ${result.breakdown.transit.breakdown.cusp.score} / ${result.breakdown.transit.breakdown.cusp.max} (raw, before DBA dampening)</li>`;
  html += `<li>Transit Star Lord: ${result.breakdown.transit.breakdown.starLord.score} / ${result.breakdown.transit.breakdown.starLord.max} (raw, before DBA dampening)</li>`;
  html += `<li>Transit Sub Lord: ${result.breakdown.transit.breakdown.subLord.score} / ${result.breakdown.transit.breakdown.subLord.max} (raw, before DBA dampening)</li>`;
  html += `<li><strong>Transit Total after DBA dampening: ${result.breakdown.transit.score} / ${result.breakdown.transit.maxScore}</strong> (raw ${result.breakdown.transit.rawScore} × ${Math.round(result.breakdown.transit.dampenMultiplier * 100)}%)</li>`;
  if (result.convergenceBonus) html += `<li><strong>Convergence Bonus: +${result.convergenceBonus}</strong> (Promise + DBA + Transit all independently confirmed)</li>`;
  html += '</ul>';
  html += '<p><strong>Positive Factors:</strong></p><ul>' + result.positiveFactors.map(f => `<li>${f}</li>`).join('') + '</ul>';
  html += '<p><strong>Conflicting Factors:</strong></p><ul>' + (result.negativeFactors.length ? result.negativeFactors.map(f => `<li>${f}</li>`).join('') : '<li>None</li>') + '</ul>';
  el('eventTimingDetailBox').innerHTML = html;
}

// --- D1 / D9 / KP Charts ---
function initChartsTab() {
  el('vedicChartsLogicOutput').innerHTML = renderLogicDetails(VEDIC_CHARTS_LOGIC_TEXT);
  el('refreshChartsBtn').addEventListener('click', renderAllVedicCharts);
  document.querySelectorAll('input[name="chartStyle"]').forEach(r => r.addEventListener('change', renderAllVedicCharts));
}

function renderAllVedicCharts() {
  const planets = state.planets.filter(p => p.name);
  const cusps = state.cusps.filter(c => c.house);
  if (!planets.length || !cusps.length) {
    const msg = '<p>Load/generate a chart in the Chart & Analysis tab first.</p>';
    el('d1ChartBox').innerHTML = msg; el('d9ChartBox').innerHTML = msg; el('kpChartBox').innerHTML = msg;
    return;
  }
  const style = document.querySelector('input[name="chartStyle"]:checked').value;

  if (style === 'south') {
    el('d1ChartBox').innerHTML = renderSouthIndianSimple(buildD1ChartData(planets));
    const d9 = buildD9ChartData(planets);
    el('d9ChartBox').innerHTML = renderSouthIndianSimple(d9.bySign) +
      (d9.skipped.length ? `<p style="font-size:0.75em;color:#a04000;">No longitude, omitted: ${d9.skipped.join(', ')}</p>` : '');
    el('kpChartBox').innerHTML = renderSouthIndianKp(buildKpChartData(planets, cusps));
  } else {
    el('d1ChartBox').innerHTML = renderNorthIndianSvg(buildD1NorthIndian(planets, cusps), 'whole-sign');
    const d9 = buildD9NorthIndian(planets, cusps);
    el('d9ChartBox').innerHTML = renderNorthIndianSvg(d9.byHouse, 'whole-sign') +
      (d9.skipped.length ? `<p style="font-size:0.75em;color:#a04000;">No longitude, omitted: ${d9.skipped.join(', ')}</p>` : '');
    el('kpChartBox').innerHTML = renderNorthIndianSvg(buildKpNorthIndian(planets, cusps), 'kp');
  }
}

function renderSouthIndianSimple(bySign) {
  let html = '<div class="vedic-chart-grid">';
  SOUTH_INDIAN_GRID.forEach(sign => {
    if (!sign) { html += '<div class="vedic-chart-cell"></div>'; return; }
    const planetsHere = bySign[sign] || [];
    html += `<div class="vedic-chart-cell"><span class="sign-name">${sign.slice(0, 3)}</span>${planetsHere.join(', ')}</div>`;
  });
  html += '</div>';
  return html;
}

function renderSouthIndianKp(bySignKp) {
  let html = '<div class="vedic-chart-grid">';
  SOUTH_INDIAN_GRID.forEach(sign => {
    if (!sign) { html += '<div class="vedic-chart-cell"></div>'; return; }
    const data = bySignKp[sign] || { planets: [], houses: [] };
    const houseBadges = data.houses.map(h => `H${h.house}`).join(' ');
    const lordText = data.houses.map(h => `H${h.house}:${h.starLord || '?'}/${h.subLord || '?'}`).join('; ');
    html += `<div class="vedic-chart-cell"><span class="sign-name">${sign.slice(0, 3)} <span class="house-badge">${houseBadges}</span></span>${data.planets.join(', ')}<span class="lord-info">${lordText}</span></div>`;
  });
  html += '</div>';
  return html;
}

function renderNorthIndianSvg(byHouse, mode) {
  let svg = '<svg class="vedic-chart-svg" viewBox="0 0 300 300" width="320" height="320">';
  NORTH_INDIAN_HOUSES.forEach(h => {
    svg += `<polygon points="${h.points}" fill="#fff" stroke="#555" stroke-width="1.5" />`;
    const data = byHouse[h.house];
    let signLabel, extra = '';
    if (mode === 'kp') {
      signLabel = data.sign ? data.sign.slice(0, 3) : '?';
      extra = `${data.starLord ? data.starLord.slice(0, 2) : '?'}/${data.subLord ? data.subLord.slice(0, 2) : '?'}`;
    } else {
      signLabel = SIGNS[data.signIndex].slice(0, 3);
    }
    const planetsText = data.planets.map(p => p.slice(0, 2)).join(' ');
    svg += `<text x="${h.label[0]}" y="${h.label[1] - 8}" text-anchor="middle" font-weight="bold">H${h.house}:${signLabel}</text>`;
    if (extra) svg += `<text x="${h.label[0]}" y="${h.label[1] + 3}" text-anchor="middle" font-size="9" fill="#666">${extra}</text>`;
    svg += `<text x="${h.label[0]}" y="${h.label[1] + (extra ? 14 : 8)}" text-anchor="middle" fill="#a04000">${planetsText}</text>`;
  });
  svg += '</svg>';
  return svg;
}

document.addEventListener('DOMContentLoaded', init);
