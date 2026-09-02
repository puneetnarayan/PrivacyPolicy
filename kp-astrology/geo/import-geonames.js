#!/usr/bin/env node
// Builds places.db from REAL GeoNames dump files — this is the path to
// COMPLETE worldwide coverage, including small villages (e.g.
// Toranagallu) that the bundled places.db (build-places-db-from-dr5hn.js)
// does not include. Run this yourself, on a machine that can reach
// GeoNames (this repo's own dev environment could not — see geo/README.md
// for why the bundled database is a curated town/city-level subset
// instead of this script's output).
//
// GeoNames download page: https://download.geonames.org/export/dump/
// You need, at minimum, ONE of:
//   - cities500.txt / cities1000.txt / cities5000.txt / cities15000.txt
//     (all populated places above that population threshold, worldwide)
//   - allCountries.txt (EVERY populated place GeoNames has, worldwide —
//     large, ~350MB — this is what gets you literal villages)
//   - <CC>.txt (e.g. IN.txt, from <CC>.zip) for one country's full data,
//     including villages, without downloading the whole world
// Optional but recommended (for real state/district NAMES instead of codes):
//   - admin1CodesASCII.txt  (state/province code -> name)
//   - admin2Codes.txt       (district/county code -> name)
//   - countryInfo.txt       (country code -> country name; optional, this
//     script also has a small built-in fallback table)
//
// Usage:
//   node import-geonames.js --main cities500.txt --admin1 admin1CodesASCII.txt \
//     --admin2 admin2Codes.txt --country countryInfo.txt --out places.db
//
// Safe to re-run: each run rebuilds places.db from scratch (it does not
// try to merge/diff against a previous run) — rerun whenever you download
// an updated GeoNames dump.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const initSqlJs = require('fts5-sql-bundle').initSqlJs;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return args;
}

async function readLines(filePath, onLine) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    onLine(line);
    count++;
  }
  return count;
}

// Small built-in fallback so country names show up even without
// countryInfo.txt — GeoNames' own countryInfo.txt (if supplied) always
// takes priority over this.
const FALLBACK_COUNTRY_NAMES = { IN: 'India', US: 'United States', GB: 'United Kingdom', FR: 'France',
  CH: 'Switzerland', SG: 'Singapore', AE: 'United Arab Emirates', AU: 'Australia', JP: 'Japan' };

function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.main || !args.out) {
    console.error('Usage: node import-geonames.js --main <cities500.txt|allCountries.txt|CC.txt> --out <places.db> [--admin1 admin1CodesASCII.txt] [--admin2 admin2Codes.txt] [--country countryInfo.txt]');
    process.exit(1);
  }

  const admin1Names = new Map(); // "CC.CODE" -> name
  const admin2Names = new Map(); // "CC.ADMIN1.ADMIN2" -> name
  const countryNames = new Map(Object.entries(FALLBACK_COUNTRY_NAMES));

  const admin1Count = await readLines(args.admin1, line => {
    const [key, name] = line.split('\t');
    if (key) admin1Names.set(key, name);
  });
  const admin2Count = await readLines(args.admin2, line => {
    const [key, name] = line.split('\t');
    if (key) admin2Names.set(key, name);
  });
  const countryCount = await readLines(args.country, line => {
    if (line.startsWith('#')) return;
    const cols = line.split('\t');
    if (cols[0] && cols[4]) countryNames.set(cols[0], cols[4]);
  });
  console.log(`Loaded ${admin1Count} admin1 codes, ${admin2Count} admin2 codes, ${countryCount} country names (from dedicated lookup files, if given).`);

  // Self-derive admin1/admin2 names directly from the main dump's own ADM1/
  // ADM2 boundary rows (feature_class 'A') for any code not already covered
  // by --admin1/--admin2 above — no separate lookup file download required.
  // (GeoNames' own admin1CodesASCII.txt/admin2Codes.txt, if supplied, still
  // take priority since they're read first.)
  const cleanAdminName = s => String(s || '').replace(/^(State of|Union Territory of|National Capital Territory of)\s+/i, '').trim();
  let derivedAdmin1 = 0, derivedAdmin2 = 0;
  await readLines(args.main, line => {
    const c = line.split('\t');
    if (c.length < 18) return;
    const [, name, , , , , featureClass, featureCode, countryCode, , admin1Code, admin2Code] = c;
    if (featureClass !== 'A') return;
    if (featureCode === 'ADM1' && admin1Code) {
      const key = `${countryCode}.${admin1Code}`;
      if (!admin1Names.has(key)) { admin1Names.set(key, cleanAdminName(name)); derivedAdmin1++; }
    } else if (featureCode === 'ADM2' && admin1Code && admin2Code) {
      const key = `${countryCode}.${admin1Code}.${admin2Code}`;
      if (!admin2Names.has(key)) { admin2Names.set(key, cleanAdminName(name)); derivedAdmin2++; }
    }
  });
  console.log(`Self-derived ${derivedAdmin1} admin1 names and ${derivedAdmin2} admin2 names from the main file's own ADM1/ADM2 rows.`);

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
    CREATE INDEX idx_places_ascii_name ON places(ascii_name);
    CREATE INDEX idx_places_search_name ON places(search_name);
    CREATE INDEX idx_places_country ON places(country_code);

    -- FTS5 indexes ONLY alternate_names, not ascii_name: leading-prefix
    -- search on ascii_name is already fast via idx_places_search_name's
    -- B-tree (see locationService.js's Phase 1); FTS5's actual job is fast
    -- token/prefix search on alternate_names (spelling variants,
    -- transliterations), which a B-tree prefix index can't do since the
    -- match can be on ANY of several pipe-separated alt names, not just the
    -- first. Skipping ascii_name here roughly halves the FTS5 index's
    -- storage cost on a large single-country import (proportionally larger
    -- than the bundled worldwide places.db, which keeps both columns
    -- indexed since its FTS5 overhead is small in absolute terms).
    CREATE VIRTUAL TABLE places_fts USING fts5(alternate_names, content='places', content_rowid='id');
  `);
  const insertStmt = db.prepare(`
    INSERT INTO places (id, geonames_id, name, ascii_name, alternate_names, country_code, country_name,
      admin1_code, admin1_name, admin2_code, admin2_name, latitude, longitude, population,
      feature_class, feature_code, timezone, search_name)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let sourceCount = 0, imported = 0, rejected = 0, nextId = 1;
  const seenNames = new Map(); // name -> count, for the "duplicate names" report

  db.run('BEGIN TRANSACTION');
  await readLines(args.main, line => {
    sourceCount++;
    // GeoNames main dump: 19 tab-separated columns (see GeoNames export README).
    const c = line.split('\t');
    if (c.length < 18) { rejected++; return; }
    const [geonameid, name, asciiname, alternatenames, latStr, lonStr, featureClass, featureCode,
      countryCode, , admin1Code, admin2Code, , , populationStr, , , timezone] = c;

    const lat = parseFloat(latStr), lon = parseFloat(lonStr);
    if (!name || isNaN(lat) || isNaN(lon) || !timezone) { rejected++; return; }
    // Only populated places (feature class 'P') by default — skip mountains,
    // rivers, etc. that GeoNames also carries. Remove this filter if you
    // specifically want other feature classes searchable too.
    if (featureClass !== 'P') { rejected++; return; }

    const ascii = asciiname || stripDiacritics(name);
    const admin1Key = `${countryCode}.${admin1Code}`;
    const admin2Key = `${countryCode}.${admin1Code}.${admin2Code}`;
    const id = nextId++;
    // GeoNames' own alternatenames column is comma-separated; normalize to
    // '|' so it matches the separator used schema-wide (and so an alt name
    // that itself happens to contain a comma isn't split incorrectly).
    const alternateNames = (alternatenames || '').split(',').map(s => s.trim()).filter(Boolean).join('|');

    insertStmt.run([
      id, Number(geonameid) || null, name, ascii, alternateNames,
      countryCode || null, countryNames.get(countryCode) || null,
      admin1Code || null, admin1Names.get(admin1Key) || null,
      admin2Code || null, admin2Names.get(admin2Key) || null,
      lat, lon, Number(populationStr) || null,
      featureClass || null, featureCode || null, timezone, ascii.toLowerCase()
    ]);
    imported++;
    seenNames.set(name, (seenNames.get(name) || 0) + 1);
  });
  db.run('COMMIT');
  insertStmt.free();

  db.run(`INSERT INTO places_fts(rowid, alternate_names) SELECT id, alternate_names FROM places WHERE alternate_names != ''`);
  db.run(`VACUUM`);

  const duplicateNames = [...seenNames.values()].filter(n => n > 1).length;
  const data = db.export();
  fs.writeFileSync(args.out, Buffer.from(data));

  console.log('--- Import report ---');
  console.log(`Source records read:    ${sourceCount}`);
  console.log(`Imported:               ${imported}`);
  console.log(`Rejected:                ${rejected} (missing required field, non-'P' feature class, or malformed row)`);
  console.log(`Names appearing >1 time: ${duplicateNames} (expected — same-named places in different countries/regions)`);
  console.log(`Database file:           ${args.out} (${(fs.statSync(args.out).size / 1e6).toFixed(1)} MB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
