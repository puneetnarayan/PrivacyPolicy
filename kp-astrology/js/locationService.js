// Worldwide place search, backed by a local SQLite database (geo/places.db,
// built from GeoNames-derived data — see geo/README.md) loaded once via
// sql.js (SQLite compiled to WebAssembly, js/sqljs/), the same
// "WASM engine, offline, no server" pattern this app already uses for
// Swiss Ephemeris. No network call is made after places.db has loaded.
//
// Shared by BOTH location pickers in the app (Native/Birth Location and
// Astrologer's/Query Location) — one search service, one database,
// instantiated as two independent UI components (locationSelector.js).

const LOCATION_SERVICE_LOGIC_TEXT = [
  ['Location Search — Logic and Sequence'],
  [''],
  ['1. DATA SOURCE: geo/places.db, a local SQLite database built offline ahead of time from a GeoNames-derived worldwide places dataset (see geo/README.md for exactly which one, its licensing, and how to rebuild it from full GeoNames dump files for village-level coverage beyond this bundled build\'s ~153,000 towns/cities).'],
  ['2. LOADING: places.db is fetched once (a local file, not a live API call) and opened via sql.js (SQLite compiled to WebAssembly) — after this one-time load, every search runs entirely offline against the in-memory database.'],
  ['3. SEARCH: Phase 1 is an indexed PREFIX match (place name starts with what you typed) — this is near-instant even across 150,000+ rows because it uses a real B-tree index, not a full scan. Phase 2 (a broader "contains" scan across both the name and alternate/native-language names) only runs if Phase 1 found fewer results than requested, keeping the common case fast while still catching a match anywhere in a name.'],
  ['4. RANKING: exact name match, then name starts with your text, then an alternate name matches exactly, then name contains your text, then an alternate name contains your text — ties broken by population (larger places first).'],
  ['5. Selecting a result returns the FULL location record (GeoNames-derived ID, name, state/admin area, country, exact latitude/longitude, and IANA timezone) — never just a place name string — so the exact same location can always be reproduced later.'],
  [''],
  ['Caveat: the bundled places.db covers towns and cities worldwide (~153,000 places) but not every small village — see geo/README.md for how to rebuild it from full GeoNames dump files (which do include village-level "populated place" records) for complete coverage of very small/obscure birthplaces. Until then, use the manual coordinate entry fallback for a place not found here.']
];

const PLACES_DB_PATH = 'geo/places.db';
const SQLJS_WASM_DIR = 'js/sqljs/';

let dbLoadPromise = null;

function loadPlacesDb() {
  if (dbLoadPromise) return dbLoadPromise;
  dbLoadPromise = (async () => {
    const initSqlJsFn = window.initSqlJs;
    if (!initSqlJsFn) throw new Error('sql.js failed to load (js/sqljs/sql-wasm.js missing or blocked).');
    const SQL = await initSqlJsFn({ locateFile: file => SQLJS_WASM_DIR + file });
    const response = await fetch(PLACES_DB_PATH);
    if (!response.ok) throw new Error(`Could not load ${PLACES_DB_PATH} (HTTP ${response.status}).`);
    const buffer = await response.arrayBuffer();
    return new SQL.Database(new Uint8Array(buffer));
  })();
  return dbLoadPromise;
}

// Kicks off the (one-time) database load in the background without
// blocking anything — call this once at app startup so the first search a
// user actually types is already fast.
function preloadLocationDb() {
  loadPlacesDb().catch(err => console.error('Location database failed to load:', err));
}

function rowToLocation(row) {
  return {
    id: row.id,
    geonamesId: row.geonames_id,
    name: row.name,
    displayName: row.name,
    asciiName: row.ascii_name,
    alternateNames: (row.alternate_names || '').split('|').filter(Boolean),
    state: row.admin1_name || null,
    district: row.admin2_name || null,
    country: row.country_name || null,
    countryCode: row.country_code || null,
    latitude: row.latitude,
    longitude: row.longitude,
    population: row.population || 0,
    timezone: row.timezone
  };
}

// One line under the place name in the dropdown — state/country, prominent
// enough to tell apart same-named places (e.g. "Ontario, Canada" vs
// "England, United Kingdom" vs "Kentucky, United States").
function locationSubtitle(loc) {
  return [loc.state, loc.country].filter(Boolean).join(', ');
}

function locationCoordsText(loc) {
  const latDir = loc.latitude >= 0 ? 'N' : 'S';
  const lonDir = loc.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(loc.latitude).toFixed(6)}° ${latDir}, ${Math.abs(loc.longitude).toFixed(6)}° ${lonDir}`;
}

const SELECT_COLUMNS = `id, geonames_id, name, ascii_name, alternate_names, country_code, country_name,
  admin1_code, admin1_name, admin2_code, admin2_name, latitude, longitude, population, timezone`;

function runQuery(db, sql, params) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Searches places.db for `query`, returns up to `limit` location objects,
// ranked per LOCATION_SERVICE_LOGIC_TEXT's rule 4. Returns [] for queries
// under 2 characters (never searches on 0-1 chars) — call sites debounce
// and enforce the minimum-length gate at the UI layer too.
async function searchPlaces(query, limit) {
  limit = limit || 8;
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];

  const db = await loadPlacesDb();
  const upperBound = q.slice(0, -1) + String.fromCharCode(q.charCodeAt(q.length - 1) + 1);

  // Phase 1: indexed prefix match on the primary (search_name) index — fast
  // even across 150,000+ rows, since SQLite can use idx_places_search_name
  // for a bounded range scan instead of examining every row.
  const prefixRows = runQuery(db, `
    SELECT ${SELECT_COLUMNS} FROM places
    WHERE search_name >= ? AND search_name < ?
    ORDER BY population DESC LIMIT ?
  `, [q, upperBound, limit * 3]);

  let candidateRows = prefixRows;
  if (candidateRows.length < limit) {
    // Phase 2: broader contains-scan (name OR alternate names contain the
    // query anywhere) — only runs when Phase 1 didn't find enough, so the
    // common "name starts with what I typed" case never pays this cost.
    const containsRows = runQuery(db, `
      SELECT ${SELECT_COLUMNS} FROM places
      WHERE (search_name LIKE ? OR lower(alternate_names) LIKE ?)
      ORDER BY population DESC LIMIT ?
    `, ['%' + q + '%', '%' + q + '%', limit * 5]);
    const seen = new Set(candidateRows.map(r => r.id));
    containsRows.forEach(r => { if (!seen.has(r.id)) { candidateRows.push(r); seen.add(r.id); } });
  }

  const ranked = candidateRows.map(row => {
    const name = String(row.name).toLowerCase();
    const alt = String(row.alternate_names || '').toLowerCase().split('|');
    let rank;
    if (name === q) rank = 1;
    else if (name.startsWith(q)) rank = 2;
    else if (alt.includes(q)) rank = 3;
    else if (name.includes(q)) rank = 4;
    else if (alt.some(a => a.includes(q))) rank = 5;
    else rank = 6;
    return { row, rank };
  });
  ranked.sort((a, b) => a.rank - b.rank || (b.row.population || 0) - (a.row.population || 0));

  return ranked.slice(0, limit).map(r => rowToLocation(r.row));
}

if (typeof module !== 'undefined') {
  module.exports = {
    LOCATION_SERVICE_LOGIC_TEXT, loadPlacesDb, preloadLocationDb,
    searchPlaces, rowToLocation, locationSubtitle, locationCoordsText
  };
}
