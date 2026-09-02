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
// Optional supplementary databases (same schema), loaded in ADDITION to
// places.db when present — lets you drop in a deeper, single-country
// GeoNames import (e.g. geo/places-india.db, built via import-geonames.js,
// for full village-level India coverage) without replacing the smaller
// worldwide-cities database that ships by default. A missing file here is
// completely normal (not an error) — it's just not installed.
const OPTIONAL_SUPPLEMENTARY_DB_PATHS = ['geo/places-india.db'];
const SQLJS_WASM_DIR = 'js/sqljs/';

let dbLoadPromise = null;

async function loadOneDb(SQL, dbPath, required) {
  try {
    const response = await fetch(dbPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));
    // sql.js doesn't validate the file at construction time — a
    // placeholder/corrupt file (e.g. before you've dropped in the real
    // geo/places-india.db) only fails once a query runs against it, which
    // would otherwise crash every search. Validate now, at load time, so a
    // bad optional file is caught here and treated as "not installed"
    // instead of breaking search for everything else.
    db.exec(`SELECT 1 FROM places LIMIT 1`);
    return db;
  } catch (err) {
    if (required) throw new Error(`Could not load ${dbPath} (${err.message}).`);
    return null; // optional supplementary DB simply isn't installed — not an error
  }
}

// Returns an array of loaded sql.js Database objects: places.db (required)
// plus any installed optional supplementary databases. Searches run
// against every database in this array and merge the results.
function loadPlacesDb() {
  if (dbLoadPromise) return dbLoadPromise;
  dbLoadPromise = (async () => {
    const initSqlJsFn = window.initSqlJs;
    if (!initSqlJsFn) throw new Error('sql.js failed to load (js/sqljs/sql-wasm.js missing or blocked).');
    const SQL = await initSqlJsFn({ locateFile: file => SQLJS_WASM_DIR + file });
    const primary = await loadOneDb(SQL, PLACES_DB_PATH, true);
    const supplementary = await Promise.all(OPTIONAL_SUPPLEMENTARY_DB_PATHS.map(p => loadOneDb(SQL, p, false)));
    return [primary, ...supplementary.filter(Boolean)];
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
// Same columns, qualified with "p." — needed when joining places (aliased
// p) against places_fts, since both tables have an alternate_names column
// and an unqualified reference is ambiguous.
const SELECT_COLUMNS_QUALIFIED = SELECT_COLUMNS.split(',').map(c => 'p.' + c.trim()).join(', ');

function runQuery(db, sql, params) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Phase 1 only: indexed prefix match on ONE database's search_name index —
// fast even across 500,000+ rows, since SQLite can use
// idx_places_search_name for a bounded range scan instead of examining
// every row. Tags each row with `_dbIndex` so ids from different databases
// (each starting their own PRIMARY KEY at 1) never collide when merged.
function searchOneDbPrefix(db, dbIndex, q, limit) {
  const upperBound = q.slice(0, -1) + String.fromCharCode(q.charCodeAt(q.length - 1) + 1);
  const rows = runQuery(db, `
    SELECT ${SELECT_COLUMNS} FROM places
    WHERE search_name >= ? AND search_name < ?
    ORDER BY population DESC LIMIT ?
  `, [q, upperBound, limit * 3]);
  rows.forEach(r => { r._dbIndex = dbIndex; });
  return rows;
}

// Escapes a search term for use as an FTS5 phrase-prefix query — wraps it
// in double quotes (doubling any internal ones, per FTS5 string-literal
// rules) with a trailing '*' for prefix matching on the last token. This
// makes "toran" match a token like "toranagallu" via the FTS5 index,
// instead of a full unindexed LIKE '%toran%' table scan.
function ftsPrefixQuery(q) {
  return `"${q.replace(/"/g, '""')}"*`;
}

// Phase 2 only: broader token/substring search against ONE database's
// places_fts index (built by both build scripts — see geo/README.md) —
// FTS5-indexed, so still fast even on a 500,000+ row single-country
// import, unlike a full LIKE '%...%' table scan. Falls back to the older
// (slower) LIKE-based scan if a database doesn't have places_fts at all
// (e.g. one built before FTS5 support was added) — treated as a normal,
// optional degradation, not an error.
function searchOneDbContains(db, dbIndex, q, limit) {
  let rows;
  try {
    rows = runQuery(db, `
      SELECT ${SELECT_COLUMNS_QUALIFIED} FROM places p JOIN places_fts f ON f.rowid = p.id
      WHERE places_fts MATCH ?
      ORDER BY p.population DESC LIMIT ?
    `, [ftsPrefixQuery(q), limit * 5]);
  } catch (err) {
    // No places_fts table (older database) — fall back to a plain scan.
    rows = runQuery(db, `
      SELECT ${SELECT_COLUMNS} FROM places
      WHERE (search_name LIKE ? OR lower(alternate_names) LIKE ?)
      ORDER BY population DESC LIMIT ?
    `, ['%' + q + '%', '%' + q + '%', limit * 5]);
  }
  rows.forEach(r => { r._dbIndex = dbIndex; });
  return rows;
}

// Searches every loaded database (places.db plus any installed optional
// supplementary databases) for `query`, merges the results, and returns up
// to `limit` location objects ranked per LOCATION_SERVICE_LOGIC_TEXT's rule
// 4. Returns [] for queries under 2 characters (never searches on 0-1
// chars) — call sites debounce and enforce the minimum-length gate too.
async function searchPlaces(query, limit) {
  limit = limit || 8;
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];

  const dbs = await loadPlacesDb();

  // Phase 1 across EVERY database first (cheap, indexed) — only if the
  // COMBINED total across all databases still falls short does Phase 2
  // (the expensive contains-scan) run at all, and only against databases
  // whose own Phase 1 came up short. This matters once more than one
  // database is loaded: without checking the combined total first, adding
  // a large supplementary database (e.g. a full-country village import)
  // would make EVERY search pay that database's full contains-scan cost,
  // even when another already-loaded database had plenty of matches.
  const prefixResults = dbs.map((db, i) => searchOneDbPrefix(db, i, q, limit));
  let candidateRows = prefixResults.flat();

  if (candidateRows.length < limit) {
    const containsResults = dbs.map((db, i) =>
      prefixResults[i].length < limit ? searchOneDbContains(db, i, q, limit) : []);
    const seen = new Set(candidateRows.map(r => `${r._dbIndex}:${r.id}`));
    containsResults.flat().forEach(r => {
      const key = `${r._dbIndex}:${r.id}`;
      if (!seen.has(key)) { candidateRows.push(r); seen.add(key); }
    });
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
