// Reusable location-picker component: a search box with a ranked
// autocomplete dropdown (backed by locationService.js's searchPlaces()),
// auto-populated state/country/lat/lon/timezone fields, a manual
// coordinate-entry fallback, and (optionally) a "Use My Current Location"
// button. Instantiated twice — once for the Native/Birth Location, once
// for the Astrologer's/Query Location — each instance is fully
// independent: selecting a location in one never touches the other, since
// each call to createLocationSelector() gets its own closed-over state.

const LOCATION_SELECTOR_LOGIC_TEXT = [
  ['Location Selector — Logic and Sequence'],
  [''],
  ['1. As you type (2+ characters), the search is debounced by 250ms and run against locationService.js\'s local SQLite database (geo/places.db) — nothing is sent over the network.'],
  ['2. Each dropdown result shows the place name, its state/administrative area and country (so same-named places in different countries are distinguishable), and its exact coordinates.'],
  ['3. Selecting a result fills Latitude, Longitude, State, District, Country, and Timezone automatically from that database record — these fields become read-only (an "Edit manually" link switches to manual entry, e.g. for a place not in the database).'],
  ['4. Manual entry validates Latitude (-90 to 90) and Longitude (-180 to 180) before the location is considered valid; Timezone must also be entered manually in this mode, since there is no place record to derive it from.'],
  ['5. Nothing is assumed by default: getSelectedLocation() returns null (not 0,0/UTC) until a real location — from the database or entered manually — has been provided, so a chart can never silently be computed for the wrong place.'],
  ['6. "Use My Current Location" (only offered where explicitly wired in, e.g. the Astrologer\'s Location) requests browser geolocation ONLY when clicked — never automatically on page load — and never substitutes for the Native/Birth Location, which always keeps its own independent state.']
];

// Basic reverse-geocoding: finds the nearest DB place to a raw lat/lon (for
// "Use My Current Location", which only gives coordinates) using a simple
// bounding-box + Haversine nearest-match — good enough to label the point,
// not used for the astrology calculation itself (that always uses the
// raw geolocation coordinates directly, unrounded).
async function reverseGeocodeNearest(lat, lon) {
  const dbs = await loadPlacesDb(); // [places.db, ...any installed optional supplementary databases]
  const boxDeg = 1.0; // ~110km box; widened once below if nothing found
  for (const box of [boxDeg, 5, 20]) {
    const rows = dbs.flatMap(db => {
      const stmt = db.prepare(`
        SELECT id, geonames_id, name, ascii_name, alternate_names, country_code, country_name,
          admin1_code, admin1_name, admin2_code, admin2_name, latitude, longitude, population, timezone
        FROM places WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        ORDER BY population DESC LIMIT 50
      `);
      stmt.bind([lat - box, lat + box, lon - box, lon + box]);
      const dbRows = [];
      while (stmt.step()) dbRows.push(stmt.getAsObject());
      stmt.free();
      return dbRows;
    });
    if (rows.length) {
      const toRad = d => d * Math.PI / 180;
      const dist = r => {
        const dLat = toRad(r.latitude - lat), dLon = toRad(r.longitude - lon);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(r.latitude)) * Math.sin(dLon / 2) ** 2;
        return 2 * Math.asin(Math.sqrt(a));
      };
      rows.sort((a, b) => dist(a) - dist(b));
      return rowToLocation(rows[0]);
    }
  }
  return null;
}

function isValidLat(v) { return !isNaN(v) && v >= -90 && v <= 90; }
function isValidLon(v) { return !isNaN(v) && v >= -180 && v <= 180; }

// config: { containerId, label (string), showCurrentLocationButton (bool) }
// Returns { getSelectedLocation(), setLocation(loc), clear() }.
function createLocationSelector(config) {
  const container = el(config.containerId);
  const uid = config.containerId; // unique-enough prefix for this instance's element ids

  container.innerHTML = `
    <div class="loc-selector">
      <label style="display:block;font-weight:bold;margin-bottom:4px;">${config.label}</label>
      <div style="position:relative;max-width:480px;">
        <input type="text" id="${uid}_search" placeholder="🔍 Start typing place name..." autocomplete="off"
          style="width:100%;box-sizing:border-box;padding:6px 8px;">
        <div id="${uid}_dropdown" style="display:none;position:absolute;z-index:50;background:#fff;border:1px solid #999;
          border-radius:4px;max-height:280px;overflow-y:auto;width:100%;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>
      </div>
      ${config.showCurrentLocationButton ? `<button type="button" id="${uid}_currentLocBtn" style="margin-top:6px;">Use My Current Location</button>` : ''}
      <p id="${uid}_selectedSummary" style="margin:8px 0 0;font-weight:bold;"></p>

      <div style="margin-top:6px;">
        <label>State/Province: <input type="text" id="${uid}_state" readonly style="background:#f0f0f0;"></label>
        <label>District: <input type="text" id="${uid}_district" readonly style="background:#f0f0f0;"></label>
        <label>Country: <input type="text" id="${uid}_country" readonly style="background:#f0f0f0;"></label><br><br>
        <label>Latitude: <input type="text" id="${uid}_lat" readonly style="background:#f0f0f0;width:120px;"></label>
        <label>Longitude: <input type="text" id="${uid}_lon" readonly style="background:#f0f0f0;width:120px;"></label>
        <label>Timezone: <input type="text" id="${uid}_tz" readonly style="background:#f0f0f0;width:160px;"></label>
      </div>
      <p style="margin:6px 0;"><a href="#" id="${uid}_manualToggle">Can't find your location? Edit coordinates manually</a></p>
      <div id="${uid}_manualBox" hidden style="border:1px dashed #999;border-radius:6px;padding:8px;max-width:480px;">
        <label>Latitude (-90 to 90): <input type="text" id="${uid}_manualLat" placeholder="e.g. 28.6139" style="width:120px;"></label>
        <label>Longitude (-180 to 180): <input type="text" id="${uid}_manualLon" placeholder="e.g. 77.2090" style="width:120px;"></label><br><br>
        <label>Timezone (IANA, e.g. Asia/Kolkata): <input type="text" id="${uid}_manualTz" placeholder="Asia/Kolkata" style="width:200px;"></label>
        <button type="button" id="${uid}_manualApply" style="margin-left:8px;">Use These Coordinates</button>
        <p id="${uid}_manualError" style="color:#b71c1c;font-size:0.85em;margin:4px 0 0;"></p>
      </div>
      <p id="${uid}_validationMsg" style="color:#b71c1c;font-weight:bold;"></p>
    </div>
  `;

  let selected = null; // full location object (from DB) or a manual {latitude,longitude,timezone,manual:true}
  let debounceTimer = null;
  let activeResults = [];

  const searchInput = el(`${uid}_search`);
  const dropdown = el(`${uid}_dropdown`);

  function renderDropdown(results) {
    activeResults = results;
    if (!results.length) {
      dropdown.innerHTML = `<div style="padding:8px 10px;color:#666;">No matches in the local database. Try a different spelling, or use "Edit coordinates manually" below.</div>`;
      dropdown.style.display = 'block';
      return;
    }
    dropdown.innerHTML = results.map((loc, i) => `
      <div class="loc-option" data-idx="${i}" style="padding:6px 10px;border-bottom:1px solid #eee;cursor:pointer;">
        <div style="font-weight:bold;">${loc.name}</div>
        <div style="font-size:0.85em;color:#555;">${locationSubtitle(loc) || '(no admin/country data)'}</div>
        <div style="font-size:0.8em;color:#888;">${locationCoordsText(loc)}</div>
      </div>
    `).join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.loc-option').forEach(opt => {
      opt.addEventListener('mouseenter', () => opt.style.background = '#f0f4ff');
      opt.addEventListener('mouseleave', () => opt.style.background = '');
      opt.addEventListener('mousedown', e => { e.preventDefault(); selectResult(activeResults[Number(opt.dataset.idx)]); });
    });
  }

  function selectResult(loc) {
    selected = loc;
    searchInput.value = loc.name;
    dropdown.style.display = 'none';
    el(`${uid}_manualBox`).hidden = true;
    fillFieldsFromSelection();
  }

  function fillFieldsFromSelection() {
    if (!selected) return;
    el(`${uid}_state`).value = selected.state || '';
    el(`${uid}_district`).value = selected.district || '';
    el(`${uid}_country`).value = selected.country || '';
    el(`${uid}_lat`).value = selected.latitude;
    el(`${uid}_lon`).value = selected.longitude;
    el(`${uid}_tz`).value = selected.timezone || '';
    el(`${uid}_selectedSummary`).textContent = selected.manual
      ? `Manually entered coordinates`
      : `${selected.name}${locationSubtitle(selected) ? ', ' + locationSubtitle(selected) : ''}`;
    el(`${uid}_validationMsg`).textContent = '';
    if (typeof config.onSelect === 'function') config.onSelect(selected);
  }

  searchInput.addEventListener('input', () => {
    selected = null;
    el(`${uid}_selectedSummary`).textContent = '';
    ['state', 'district', 'country', 'lat', 'lon', 'tz'].forEach(f => { el(`${uid}_${f}`).value = ''; });
    clearTimeout(debounceTimer);
    const q = searchInput.value;
    if (q.trim().length < 2) { dropdown.style.display = 'none'; return; }
    debounceTimer = setTimeout(async () => {
      try {
        const results = await searchPlaces(q, 10);
        renderDropdown(results);
      } catch (err) {
        dropdown.innerHTML = `<div style="padding:8px;color:#b71c1c;">Location search unavailable: ${err.message}</div>`;
        dropdown.style.display = 'block';
      }
    }, 250);
  });
  searchInput.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));

  el(`${uid}_manualToggle`).addEventListener('click', e => {
    e.preventDefault();
    el(`${uid}_manualBox`).hidden = !el(`${uid}_manualBox`).hidden;
  });

  el(`${uid}_manualApply`).addEventListener('click', () => {
    const lat = parseFloat(el(`${uid}_manualLat`).value);
    const lon = parseFloat(el(`${uid}_manualLon`).value);
    const tz = el(`${uid}_manualTz`).value.trim();
    const errBox = el(`${uid}_manualError`);
    if (!isValidLat(lat)) { errBox.textContent = 'Latitude must be between -90 and 90.'; return; }
    if (!isValidLon(lon)) { errBox.textContent = 'Longitude must be between -180 and 180.'; return; }
    if (!tz) { errBox.textContent = 'Enter an IANA timezone (e.g. Asia/Kolkata).'; return; }
    errBox.textContent = '';
    selected = { manual: true, name: 'Manual coordinates', state: null, district: null, country: null,
      countryCode: null, latitude: lat, longitude: lon, timezone: tz, geonamesId: null };
    searchInput.value = '';
    el(`${uid}_manualBox`).hidden = true;
    fillFieldsFromSelection();
  });

  if (config.showCurrentLocationButton) {
    el(`${uid}_currentLocBtn`).addEventListener('click', () => {
      if (!navigator.geolocation) { el(`${uid}_validationMsg`).textContent = 'Geolocation is not available in this browser.'; return; }
      el(`${uid}_validationMsg`).textContent = 'Requesting your location...';
      navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        el(`${uid}_validationMsg`).textContent = '';
        try {
          const nearest = await reverseGeocodeNearest(lat, lon);
          selected = nearest
            ? { ...nearest, latitude: lat, longitude: lon, name: nearest.name + ' (nearest match — your exact coordinates are used)' }
            : { manual: true, name: 'Current location', state: null, district: null, country: null, countryCode: null, latitude: lat, longitude: lon, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, geonamesId: null };
          searchInput.value = '';
          fillFieldsFromSelection();
        } catch (err) {
          el(`${uid}_validationMsg`).textContent = 'Could not look up your location: ' + err.message;
        }
      }, err => {
        el(`${uid}_validationMsg`).textContent = 'Location permission denied or unavailable: ' + err.message;
      });
    });
  }

  return {
    // Returns the clean data object for the astrology engine, or null (with
    // a validation message shown) if no location has been selected yet.
    getSelectedLocation() {
      if (!selected) {
        el(`${uid}_validationMsg`).textContent = 'Please select a location (search above, or enter coordinates manually).';
        return null;
      }
      if (!isValidLat(selected.latitude) || !isValidLon(selected.longitude) || !selected.timezone) {
        el(`${uid}_validationMsg`).textContent = 'Selected location is missing latitude, longitude, or timezone.';
        return null;
      }
      el(`${uid}_validationMsg`).textContent = '';
      return {
        latitude: selected.latitude, longitude: selected.longitude, timezone: selected.timezone,
        geonamesId: selected.geonamesId, countryCode: selected.countryCode, country: selected.country,
        state: selected.state, district: selected.district, name: selected.name
      };
    },
    // Restores a previously-saved location object without requiring a
    // fresh search (e.g. loading persisted birth details on page reload).
    setLocation(loc) {
      selected = loc;
      searchInput.value = loc.manual ? '' : (loc.name || '');
      fillFieldsFromSelection();
    },
    clear() {
      selected = null;
      searchInput.value = '';
      ['state', 'district', 'country', 'lat', 'lon', 'tz'].forEach(f => { el(`${uid}_${f}`).value = ''; });
      el(`${uid}_selectedSummary`).textContent = '';
      el(`${uid}_validationMsg`).textContent = '';
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { LOCATION_SELECTOR_LOGIC_TEXT, createLocationSelector, reverseGeocodeNearest, isValidLat, isValidLon };
}
