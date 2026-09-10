// "Saved Natives" — CSV-backed store for native identity + birth data
// (Name, Sex, Location, City, State, Country, Birth Date, Birth Time,
// Latitude, Longitude, Timezone Mode, UTC Offset, Notes), so a chart can
// be saved for later review/record without re-typing birth details. Pure
// CSV parse/serialize + record helpers here (testable standalone, no DOM);
// the file-picker/UI wiring lives in ui.js since it needs browser APIs and
// this app's existing birth-field/tab functions.
//
// No existing calculation file is touched — this only reads/writes the
// SAME birth fields (birthLocalDate, birthLat, etc.) the Chart & Analysis
// tab already has, via ui.js.

const SAVED_NATIVES_LOGIC_TEXT = [
  ['Saved Natives — Logic and Sequence'],
  [''],
  ['Records are stored as plain CSV (one native per row), with a fixed header: Name, Sex, Location, City, State, Country, BirthDate, BirthTime, Latitude, Longitude, TimezoneMode, UTCOffset, Notes. "UTCOffset" holds whichever value the Chart & Analysis tab\'s Timezone mode is actually set to at save time — a UTC offset string (e.g. "+5:30") when in offset mode, or the IANA zone name (e.g. "Asia/Kolkata") when in zone-name mode — so no data is lost either way, in one column.'],
  ['SAVE: the currently-entered Name/Sex/Location/City/State/Country/Notes (this tab) plus the CURRENT Birth Date/Time/Latitude/Longitude/Timezone (Chart & Analysis tab) are combined into one record. If a record with the same Name (case-insensitive) already exists, it is UPDATED in place; otherwise a new row is appended.'],
  ['LOAD: selecting a record populates the Chart & Analysis tab\'s birth fields and this tab\'s identity fields, then immediately (re)generates the full chart and every dependent report — the same as pressing "Generate Full Chart" yourself.'],
  ['SEARCH: a plain substring match across every column (case-insensitive) — matches on partial name, city, notes, etc.'],
  ['FILE ACCESS: in Chrome/Edge, "Browse / Connect CSV File" keeps a live handle to your chosen file — every Save/Delete writes back to it directly, no repeated file dialogs. In browsers without that capability (Firefox, Safari), the file loads read-only; after saving, a fresh copy downloads for you to manually replace your file with — this app is a static offline page with no server, so this is the most it can do without a plugin.'],
  [''],
  ['Caveat: this is local file storage, not a database server — back up your CSV file yourself (e.g. copy it alongside this app, or into cloud-synced storage) the same way you would any other personal spreadsheet.']
];

const NATIVE_CSV_HEADERS = ['Name', 'Sex', 'Location', 'City', 'State', 'Country', 'BirthDate', 'BirthTime', 'Latitude', 'Longitude', 'TimezoneMode', 'UTCOffset', 'Notes'];
const NATIVE_FIELD_KEYS = ['name', 'sex', 'location', 'city', 'state', 'country', 'birthDate', 'birthTime', 'latitude', 'longitude', 'timezoneMode', 'utcOffset', 'notes'];

// Minimal RFC4180-style CSV tokenizer — handles quoted fields containing
// commas, double-quotes (escaped as ""), and embedded newlines (needed
// for the free-text Notes column), which a plain String.split(',') can't.
function parseCsvText(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // skip — paired \n (if any) ends the row above
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvEscapeField(value) {
  const s = String(value === undefined || value === null ? '' : value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function serializeCsvRows(rows) {
  return rows.map(r => r.map(csvEscapeField).join(',')).join('\r\n');
}

// Parses full CSV text (with header row) into an array of native record
// objects using NATIVE_FIELD_KEYS — matches columns by header NAME (not
// position), so a CSV with reordered or partially-missing columns still
// loads correctly instead of silently misaligning fields.
function parseNativesCsvText(text) {
  if (!text || !text.trim()) return [];
  const rows = parseCsvText(text.replace(/^﻿/, '').trim());
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => {
      const rec = {};
      NATIVE_FIELD_KEYS.forEach((key, i) => {
        const idx = header.indexOf(NATIVE_CSV_HEADERS[i].toLowerCase());
        rec[key] = idx >= 0 ? (r[idx] || '') : (r[i] || '');
      });
      return rec;
    });
}

function nativesToCsvText(records) {
  const rows = [NATIVE_CSV_HEADERS, ...records.map(rec => NATIVE_FIELD_KEYS.map(k => rec[k] || ''))];
  return serializeCsvRows(rows);
}

// Case-insensitive substring match across every field.
function nativeMatchesQuery(rec, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return NATIVE_FIELD_KEYS.some(k => String(rec[k] || '').toLowerCase().includes(q));
}

// Finds the index of an existing record with the same Name
// (case-insensitive, trimmed) — used to decide update-in-place vs. append.
function findNativeIndexByName(records, name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return -1;
  return records.findIndex(r => String(r.name || '').trim().toLowerCase() === key);
}

if (typeof module !== 'undefined') {
  module.exports = {
    SAVED_NATIVES_LOGIC_TEXT, NATIVE_CSV_HEADERS, NATIVE_FIELD_KEYS,
    parseCsvText, csvEscapeField, serializeCsvRows,
    parseNativesCsvText, nativesToCsvText, nativeMatchesQuery, findNativeIndexByName
  };
}
