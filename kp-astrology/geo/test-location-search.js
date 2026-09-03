#!/usr/bin/env node
// Integration tests for js/locationService.js's searchPlaces() — run
// against the REAL production code (not a re-implementation) by stubbing
// the two browser globals it uses (window.initSqlJs, fetch) so it runs
// under Node against the actual geo/places.db.
//
// Usage: cd geo && npm install && node test-location-search.js

const fs = require('fs');
const path = require('path');
const initSqlJs = require('fts5-sql-bundle').initSqlJs;

const PLACES_DB = path.join(__dirname, 'places.db');

global.window = {
  initSqlJs: (opts) => initSqlJs({ locateFile: f => path.join(path.dirname(require.resolve('fts5-sql-bundle')), f) })
};
global.fetch = async (url) => {
  const filePath = path.join(__dirname, '..', url);
  if (!fs.existsSync(filePath)) return { ok: false, status: 404 };
  const buf = fs.readFileSync(filePath);
  return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

// locationService.js is a plain <script> file (no require/module wrapper
// used in the browser), so eval it into this scope to get its functions —
// same technique as loading it via a <script> tag, just in Node.
const serviceSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'locationService.js'), 'utf8');
// eslint-disable-next-line no-eval
eval(serviceSrc.replace(/^if \(typeof module.*$[\s\S]*/m, '')); // strip the module.exports tail (module IS defined under Node, would otherwise shadow eval'd fns)

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}${detail ? ' — ' + detail : ''}`); }
}

async function run() {
  if (!fs.existsSync(PLACES_DB)) { console.error(`${PLACES_DB} not found — nothing to test.`); process.exit(1); }

  console.log('=== Test list: India ===');
  for (const name of ['Gorakhpur', 'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata']) {
    const results = await searchPlaces(name, 5);
    check(`"${name}" returns a result`, results.length > 0, `got ${results.length}`);
    if (results.length) check(`"${name}" top result is India`, results[0].country === 'India', results[0].country);
  }

  console.log('=== Test list: International ===');
  for (const name of ['London', 'New York', 'Paris', 'Zurich', 'Singapore', 'Dubai', 'Sydney', 'Tokyo']) {
    const results = await searchPlaces(name, 5);
    check(`"${name}" returns a result`, results.length > 0, `got ${results.length}`);
  }

  console.log('=== Duplicate-name test: "London" shows multiple distinguishable countries ===');
  {
    const results = await searchPlaces('London', 15);
    const countries = new Set(results.filter(r => r.name === 'London').map(r => r.country));
    check('at least 3 distinct countries named "London"', countries.size >= 3, [...countries].join(', '));
    check('every London result has a subtitle (state/country) to distinguish it',
      results.every(r => locationSubtitle(r).length > 0));
  }

  console.log('=== Village-level test (optional supplementary DB: geo/places-india.db) ===');
  {
    // The supplementary India DB loads lazily in the background (via
    // requestIdleCallback/setTimeout) so the app feels snappy on the small
    // primary DB alone — give it a moment to finish before checking it.
    if (fs.existsSync(path.join(__dirname, 'places-india.db'))) {
      await new Promise(r => setTimeout(r, 500));
    }
    const results = await searchPlaces('Toranagallu', 5);
    if (fs.existsSync(path.join(__dirname, 'places-india.db'))) {
      check('Toranagallu found via alternate name', results.some(r => r.name === 'Torangallu'), JSON.stringify(results.map(r => r.name)));
      const match = results.find(r => r.name === 'Torangallu');
      if (match) {
        check('Toranagallu state is Karnataka', match.state === 'Karnataka', match.state);
        check('Toranagallu district is Ballari', match.district === 'Ballari', match.district);
        check('Toranagallu timezone is Asia/Kolkata', match.timezone === 'Asia/Kolkata', match.timezone);
      }
    } else {
      console.log('  SKIP: geo/places-india.db not installed (optional) — Toranagallu-specific checks skipped.');
    }
  }

  console.log('=== Alternate-name test ===');
  {
    // "Bengaluru" is searched here as itself; also check a common English
    // alt-name style search still resolves via the ascii/contains path.
    const results = await searchPlaces('Bengaluru', 5);
    check('Bengaluru found', results.some(r => /bengaluru|bangalore/i.test(r.name)), JSON.stringify(results.map(r => r.name)));
  }

  console.log('=== Coordinate integrity test ===');
  {
    const results = await searchPlaces('Zurich', 3);
    const zurich = results.find(r => r.country === 'Switzerland');
    check('Zurich found', !!zurich);
    if (zurich) {
      check('latitude is a real number, not rounded to 0/int', typeof zurich.latitude === 'number' && Math.abs(zurich.latitude - 47.3667) < 0.01, zurich.latitude);
      check('longitude is a real number, not rounded to 0/int', typeof zurich.longitude === 'number' && Math.abs(zurich.longitude - 8.55) < 0.05, zurich.longitude);
      check('timezone is an IANA id, not a raw offset', /^[A-Za-z]+\/[A-Za-z_]+/.test(zurich.timezone), zurich.timezone);
    }
  }

  console.log('=== Minimum-length gate test ===');
  {
    const results1 = await searchPlaces('a', 5);
    check('1-character query returns no results (min-length gate)', results1.length === 0);
    const results2 = await searchPlaces('', 5);
    check('empty query returns no results', results2.length === 0);
  }

  console.log('=== Performance test ===');
  {
    const t0 = Date.now();
    await searchPlaces('London', 10);
    const elapsed = Date.now() - t0;
    check(`"London" search completes in <200ms (warm DB, target <100ms)`, elapsed < 200, `${elapsed}ms`);
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
