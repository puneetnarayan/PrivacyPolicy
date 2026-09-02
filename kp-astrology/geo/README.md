# Location database (places.db)

This folder builds and holds `places.db`, the local SQLite database behind
the app's worldwide location search (Birth Place and Astrologer's Location
selectors — `js/locationService.js` / `js/locationSelector.js`). Everything
here runs entirely offline once `places.db` exists; nothing in the running
app calls a geocoding API.

## What's bundled right now

`places.db` shipped in this repo (~34 MB) is built from
[dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database)
(**Open Database License v1.0 (ODbL) — attribution required, see
`LICENSE-dr5hn-dataset.txt` in this folder**; itself compiled from GeoNames
and other public sources) via `build-places-db-from-dr5hn.js`. It covers
**~153,000 towns and cities worldwide**, each with exact coordinates,
state/country names, population, and IANA timezone, with English-only
alternate names (e.g. "Bangalore" for Bengaluru). This is enough for every
city in this app's original test list (Mumbai, Delhi, Bengaluru, Chennai,
Kolkata, Gorakhpur, London, New York, Paris, Zurich, Singapore, Dubai,
Sydney, Tokyo, and duplicate-name cases like the 6 different "London"s) —
but it does **not** include every small village on its own. `Toranagallu`
(Karnataka), the specific village used as this feature's original test
case, is below this dataset's inclusion threshold — see "Optional
supplementary database" just below for how that specific case is actually
covered (a real GeoNames-derived India-wide database, verified end-to-end).

**Attribution**: if you deploy this app with the bundled database, ODbL
requires crediting the dr5hn/countries-states-cities-database project (and,
transitively, GeoNames — see `LICENSE-dr5hn-dataset.txt`) somewhere
reasonably discoverable (an About/Credits section, footer, or similar).
This requirement goes away once you rebuild `places.db` from GeoNames
directly via `import-geonames.js` below, GeoNames data itself being CC-BY
4.0 (attribution to geonames.org still required, but no share-alike
obligation on your own app code).

**Why not the full GeoNames dataset from the start:** the sandboxed
environment this was built in could not reach `download.geonames.org`
directly (network policy — confirmed with `x-deny-reason: host_not_allowed`
on a direct request). `import-geonames.js` below is the real GeoNames
importer, fully GeoNames-schema-compatible, and HAS since been run
end-to-end against a real GeoNames file — a genuine `IN.zip` (India,
660,026 source rows) was supplied directly and imported successfully:
"Torangallu" was found via its alternate name "Toranagallu" with the
correct coordinates, `Asia/Kolkata` timezone, and — self-derived from the
file's own administrative-boundary rows, no separate lookup file needed —
state "Karnataka" and district "Ballari", exactly matching the original
spec's example. That result ships as the optional `geo/places-india.db`
described next. Full worldwide village-level coverage (not just India)
works the same way — run `import-geonames.js` yourself against
`allCountries.txt` or another country's `.zip`, either downloaded on a
machine that can reach geonames.org, or handed to Claude directly to run.

## Optional supplementary database (e.g. full India village coverage)

`js/locationService.js` loads `places.db` (required) plus any of a small
list of OPTIONAL supplementary database files it finds — currently just
`geo/places-india.db`. If that file exists, it's loaded in addition to
(not instead of) `places.db`, and searches run against both and merge the
results — so you get worldwide city coverage AND full India village
coverage at once, without needing a single combined database.

**A real `places-india.db`** (built from the actual GeoNames `IN.zip`,
verified against this app's own Toranagallu test case, with state/district
names self-derived from the file's own admin boundary records) **is
committed to this repo, by explicit request** — at ~97MB it's close to
GitHub's 100MB hard file-size limit, which is worth knowing before you fork
or mirror this repo (large git history, slower clones), but it fits. If you
ever want to remove it from history (e.g. before making the repo public),
rebuild it locally instead: `import-geonames.js --main IN.txt --out
geo/places-india.db` (below) rebuilds it from your own downloaded
`IN.zip` in under a minute, and `geo/.gitignore`'s comment explains how to
stop tracking it again.

The same mechanism works for any other single-country deep import you want
— just add its path to `OPTIONAL_SUPPLEMENTARY_DB_PATHS` in
`js/locationService.js`.

**Licensing note**: unlike the bundled `places.db` (ODbL), `places-india.db`
is built directly from GeoNames data, which is
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution to
geonames.org is required if you deploy it, but there's no share-alike
obligation on your own app code.

## Rebuilding with full GeoNames data (recommended for production use)

1. Go to <https://download.geonames.org/export/dump/> and download one of:
   - `cities500.zip` (every populated place with population ≥ 500 — good
     balance of size vs. coverage; still misses the very smallest hamlets)
   - `allCountries.zip` (**every** populated place GeoNames has, worldwide
     — this is what gets you literal small villages like Toranagallu; ~350
     MB zipped, ~1.5 GB unzipped)
   - `<CC>.zip` (e.g. `IN.zip` for India only) — full village-level detail
     for one country, without downloading the whole planet
   - Optionally also `admin1CodesASCII.txt`, `admin2Codes.txt`,
     `countryInfo.txt` (from the same page) for real state/district names
     instead of just codes
2. Unzip the `.txt` file(s) into this `geo/` folder (or anywhere you like).
3. `cd geo && npm install` (one-time — installs `sql.js`, the SQLite-via-
   WebAssembly library this app already uses).
4. Run:
   ```
   node import-geonames.js --main cities500.txt \
     --admin1 admin1CodesASCII.txt --admin2 admin2Codes.txt \
     --country countryInfo.txt --out places.db
   ```
5. Replace the old `geo/places.db` with the new one. Reload the app (via a
   local server, same as always — see the main README) and searches now
   query your full dataset.

The script prints an import report: source records read, imported,
rejected (missing lat/lon/name/timezone, or not a populated place), and how
many names appear more than once (expected — same-named places in
different countries). Safe to re-run any time GeoNames publishes an
update — it rebuilds `places.db` from scratch each time rather than
diffing against the previous run.

### Which GeoNames feature classes are imported

Only feature class `P` (populated places — cities, towns, villages,
hamlets) is imported by default. GeoNames' dump files also contain
mountains, rivers, administrative boundary markers, etc. under other
feature classes; these are skipped since they're not birthplaces. Edit the
`featureClass !== 'P'` check in `import-geonames.js` if you want to widen
this.

## Database schema

```sql
places (
  id INTEGER PRIMARY KEY,
  geonames_id INTEGER,       -- the real GeoNames ID when built from GeoNames data
  name TEXT NOT NULL,        -- canonical name, as GeoNames/the source has it
  ascii_name TEXT NOT NULL,  -- ASCII-only version (diacritics stripped)
  alternate_names TEXT,      -- comma- or pipe-separated: spelling variants, transliterations, local names
  country_code TEXT, country_name TEXT,
  admin1_code TEXT, admin1_name TEXT,   -- state/province
  admin2_code TEXT, admin2_name TEXT,   -- district/county (GeoNames import only — the bundled build has no admin2 data)
  latitude REAL NOT NULL, longitude REAL NOT NULL,  -- full precision, never rounded
  population INTEGER,
  feature_class TEXT, feature_code TEXT,
  timezone TEXT,              -- IANA zone ID, e.g. "Asia/Kolkata" — used directly, never derived from longitude/country
  search_name TEXT NOT NULL   -- lowercased ascii_name, what the indexed prefix search actually queries
);
CREATE INDEX idx_places_name ON places(name);
CREATE INDEX idx_places_ascii_name ON places(ascii_name);
CREATE INDEX idx_places_search_name ON places(search_name);
CREATE INDEX idx_places_country ON places(country_code);
CREATE INDEX idx_places_geonames_id ON places(geonames_id);
CREATE INDEX idx_places_population ON places(population);
```

**FTS5**: the sql.js WASM build vendored into `js/sqljs/` is
[`fts5-sql-bundle`](https://www.npmjs.com/package/fts5-sql-bundle) — a
custom sql.js build with the FTS5 extension compiled in (the plain `sql.js`
npm package does NOT have FTS5, which this app used at first — searches
against the ~558,000-row India database took 400-600ms with a plain LIKE
'%...%' scan; switching to FTS5 for that fallback path brought it under
10ms). `js/locationService.js` uses a two-phase strategy: Phase 1 is an
indexed prefix match on `search_name` (near-instant, even across 500,000+
rows); Phase 2, only run when Phase 1 doesn't find enough results, queries
each database's `places_fts` virtual table (`CREATE VIRTUAL TABLE
places_fts USING fts5(alternate_names, content='places',
content_rowid='id')` — see the two build scripts) via `MATCH` with a
phrase-prefix query, instead of an unindexed table scan. If a database
predates this (no `places_fts` table), Phase 2 falls back to the old LIKE
scan automatically rather than erroring.

## How timezone is determined

Every place record carries its own IANA timezone ID (`Asia/Kolkata`,
`Europe/London`, etc.), taken directly from the source data — **never**
derived from longitude or guessed from country. When you select a
location, its timezone ID is used with this app's existing
`zonedLocalToUtc()` (`js/timezone.js`, unchanged) to convert the entered
local birth date/time to UTC — that function defers to the browser's own
`Intl` implementation, which carries the full IANA tzdata (including
historical DST/offset rule changes), so a birth date from decades ago
under a different UTC offset or DST rule than today is converted
correctly. `js/locationSelector.js`'s manual-entry fallback requires you to
type the IANA zone ID yourself, for exactly the same reason: this app never
assumes UTC or guesses a timezone from coordinates alone.

## How the app uses latitude/longitude

`js/locationSelector.js`'s `getSelectedLocation()` returns the location's
exact `latitude`/`longitude` (full precision, never rounded) plus its
`timezone`. In the app itself, selecting a Birth Place fills the existing
Birth Latitude/Longitude/Timezone fields that already drive the entire
natal-chart calculation pipeline (`generateFullChart()` in `js/ui.js`,
unchanged); selecting an Astrologer's Location fills the existing
Astrologer Latitude/Longitude fields (Live Ruling Planets) and the Horary
Prediction tab's judgment-place fields. The two selectors are fully
independent — picking one never changes the other — since the Native's
birth chart and the astrologer's/query location serve different KP
purposes (see `LOCATION_SELECTOR_LOGIC_TEXT` in `js/locationSelector.js`
and the equivalent notes on the Horary tab).

## Updating in future

- New GeoNames data: re-run `import-geonames.js` with freshly downloaded
  files (step 4 above) and replace `places.db`.
- New IANA timezone rules (e.g. a country changes its DST policy): nothing
  to do here — timezone conversion goes through the browser's own `Intl`
  API (`js/timezone.js`), which is updated by browser vendors independently
  of this app.
- Want the bundled (out-of-the-box) database refreshed from a newer
  dr5hn release instead of switching to full GeoNames: re-run
  `build-places-db-from-dr5hn.js` against a freshly downloaded
  `json-cities.json.gz` / `countries.json` / `states.json` from that
  project's [latest release](https://github.com/dr5hn/countries-states-cities-database/releases).
