#!/usr/bin/env node
// Builds the BUNDLED (out-of-the-box) places.db from a GeoNames-derived
// worldwide cities dataset (dr5hn/countries-states-cities-database,
// MIT-licensed, itself compiled from GeoNames + other public sources).
//
// This is the "works immediately after cloning" database — see
// import-geonames.js for the script that builds places.db from REAL
// GeoNames dump files (cities500/cities1000/allCountries + IN.zip etc.),
// which is what you need to run to get every small village (e.g.
// Toranagallu) — this bundled build only goes down to town/city level
// (~153,000 places worldwide), not individual villages. See geo/README.md.
//
// Search uses plain indexed SQL (no FTS5 virtual table) — the sql.js WASM
// build available to this app does not have the FTS5 extension compiled
// in. At ~150K-1M rows, indexed prefix queries plus a bounded contains-scan
// (locationService.js) comfortably meet the <100ms target; re-add FTS5 (via
// a build of sql.js/sqlite-wasm that includes it) if the database grows
// much larger than a full GeoNames worldwide import.
//
// Usage: node build-places-db-from-dr5hn.js <path-to-cities.json> <path-to-countries.json> <path-to-states.json> <output-places.db>

const fs = require('fs');
const path = require('path');
const initSqlJs = require('fts5-sql-bundle').initSqlJs;

function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function main() {
  const [, , citiesPath, countriesPath, statesPath, outPath] = process.argv;
  if (!citiesPath || !countriesPath || !statesPath || !outPath) {
    console.error('Usage: node build-places-db-from-dr5hn.js <cities.json> <countries.json> <states.json> <places.db>');
    process.exit(1);
  }

  console.log('Reading source JSON...');
  const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
  const countries = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
  const states = JSON.parse(fs.readFileSync(statesPath, 'utf8'));
  const countryById = new Map(countries.map(c => [c.id, c]));
  const stateById = new Map(states.map(s => [s.id, s]));

  console.log(`Source records: ${cities.length} cities, ${countries.length} countries, ${states.length} states.`);

  const SQL = await initSqlJs({ locateFile: file => path.join(path.dirname(require.resolve('fts5-sql-bundle')), file) });
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE places (
      id INTEGER PRIMARY KEY,
      geonames_id INTEGER,
      name TEXT NOT NULL,
      ascii_name TEXT NOT NULL,
      alternate_names TEXT,
      country_code TEXT,
      country_name TEXT,
      admin1_code TEXT,
      admin1_name TEXT,
      admin2_code TEXT,
      admin2_name TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      population INTEGER,
      feature_class TEXT,
      feature_code TEXT,
      timezone TEXT,
      search_name TEXT NOT NULL
    );
    CREATE INDEX idx_places_name ON places(name);
    CREATE INDEX idx_places_ascii_name ON places(ascii_name);
    CREATE INDEX idx_places_search_name ON places(search_name);
    CREATE INDEX idx_places_country ON places(country_code);
    CREATE INDEX idx_places_geonames_id ON places(geonames_id);
    CREATE INDEX idx_places_population ON places(population);

    CREATE VIRTUAL TABLE places_fts USING fts5(ascii_name, alternate_names, content='places', content_rowid='id');
  `);

  const insertStmt = db.prepare(`
    INSERT INTO places (id, geonames_id, name, ascii_name, alternate_names, country_code, country_name,
      admin1_code, admin1_name, admin2_code, admin2_name, latitude, longitude, population,
      feature_class, feature_code, timezone, search_name)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  let imported = 0, rejected = 0;
  let nextId = 1;

  db.run('BEGIN TRANSACTION');
  cities.forEach(c => {
    const lat = parseFloat(c.latitude), lon = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lon) || !c.name || !c.timezone) { rejected++; return; }

    const country = countryById.get(c.country_id);
    const state = stateById.get(c.state_id);
    const asciiName = stripDiacritics(c.name);
    // Keep alternate names to English only (per explicit instruction) —
    // just the "en" translation, when present and different from the
    // primary name. This keeps the bundled database compact and searches
    // stay English-only; drop this restriction (see the ASCII-any-language
    // version in git history) if you want other-language searchability.
    const altNamesSet = new Set();
    if (c.translations && c.translations.en && c.translations.en !== c.name) altNamesSet.add(c.translations.en);
    const alternateNames = [...altNamesSet].join('|');
    const searchName = asciiName.toLowerCase();

    const id = nextId++;
    insertStmt.run([
      id, c.id, c.name, asciiName, alternateNames,
      c.country_code || (country ? country.iso2 : null), c.country_name || (country ? country.name : null),
      c.state_code || (state ? state.state_code : null), c.state_name || (state ? state.name : null),
      null, null, // dr5hn dataset has no admin2 (district/county) level
      lat, lon, c.population || null,
      'P', c.type === 'city' ? 'PPL' : 'PPLA3', c.timezone, searchName
    ]);
    imported++;
  });
  db.run('COMMIT');
  insertStmt.free();

  db.run(`INSERT INTO places_fts(rowid, ascii_name, alternate_names) SELECT id, ascii_name, alternate_names FROM places`);

  const data = db.export();
  fs.writeFileSync(outPath, Buffer.from(data));

  console.log(`Imported: ${imported}`);
  console.log(`Rejected (missing lat/lon/name/timezone): ${rejected}`);
  console.log(`Database written to: ${outPath} (${(fs.statSync(outPath).size / 1e6).toFixed(1)} MB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
