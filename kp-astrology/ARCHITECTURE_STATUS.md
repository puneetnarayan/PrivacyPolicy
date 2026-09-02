# Architecture Status — vs. the Offline-First Desktop App Requirements

This tracks what's implemented against the requested architecture, so it's
clear what's real vs. deferred at any point.

## Done

- **D1 / D9 / KP Charts** (`js/vedicCharts.js`, "Charts" tab): visual Rasi
  (D1), Navamsa (D9), and KP charts, each selectable in South Indian
  (fixed sign grid) or North Indian (diamond, fixed house positions, SVG)
  layout. Reuses the currently loaded chart (state.planets/state.cusps) —
  the only new calculation is the classical Navamsa (D9) sign formula
  (verified against all three sign-modality cases: movable/fixed/dual).
  The North Indian polygon layout's 12 regions were verified
  self-consistent (every consecutive house shares a polygon edge, closing
  into a valid clockwise cycle) and cross-checked on a real chart: house 1
  correctly lands on the natal Ascendant's sign, and the KP chart's real
  Placidus cusp signs matched previously-verified output exactly. Not
  visually compared against a second reference chart image, since this
  environment has no way to do that — flagged as a caveat in-app.
- **Event Timing & Fructification Engine** (`js/eventRules.js`,
  `js/eventTimingEngine.js`, "Event Timing" tab): searches a configurable
  future horizon (1-20 years or custom) for when a promised event is likely
  to fructify, combining Event Promise (significators.js), DBA Capability
  (dasha.js, extended to a 4th Sookshmadasha level), and Transit Activation
  (ephemeris.js + kpSubLords.js) into one 0-100 "Astrological Activation
  Score" (never called a probability). Uses progressive-resolution search
  (month screening -> daily detail for the top-N months -> hourly detail
  on demand for a clicked day) rather than computing every hour of a
  multi-year horizon — a 2-year search with 3 months drilled to daily/hourly
  detail completes in about 1.5 seconds. Every score shows its full
  breakdown plus separately-listed positive and conflicting factors. 32
  starter event definitions across 8 categories (Relationships, Career,
  Finance, Property, Education, Family, Travel, Legal) live in one plain,
  JSON-shaped config object — editable without touching any function.
  Reuses the CURRENTLY LOADED chart (state.planets/state.cusps) from the
  Chart & Analysis tab; introduces no new astronomical calculation.
  Year -> Month -> Day -> Hour drill-down and a ranked "Top Windows" list
  are implemented as clickable tables, not a graphical calendar-grid
  widget — a deliberate scoping choice given the size of the rest of the
  request, not an oversight.
- **Real Swiss Ephemeris, compiled to WebAssembly** (`ephemeris/`,
  `js/swissephBridge.js`): via the `swisseph-wasm` npm package (GPL-3.0-or-later,
  itself built from the official AGPL-3.0-or-later Swiss Ephemeris — fine for
  this app's personal, single-user, non-distributed use; revisit before ever
  sharing/hosting it). It becomes the app's calculation engine automatically
  once loaded (typically well under a second), computing planet longitudes
  and Placidus houses via Swiss Ephemeris's own native sidereal/house
  routines instead of this app's hand-written approximations. If it fails to
  load (or hasn't finished loading yet), `ephemeris.js`/`placidusCusps.js`
  fall back to the existing astronomy-engine implementation automatically —
  verified by deliberately blocking the .wasm file and confirming the app
  still computes a full, correct chart. A status line at the top of the page
  always shows which engine is active. Cross-checking the two engines against
  each other for a real test chart resolved Placidus's earlier "not yet
  independently verified" caveat: they agree to within ayanamsa-precision
  (a few hundredths of a degree).
- **Update download with progress** (`js/updater.js`, `ui.js`): "Update Now"
  streams the download with a live progress bar (bytes/percent), Cancel
  available throughout, then hands you the file to save and run — it does
  not yet verify a signature or atomically replace files (still needs real
  hosting/signing infrastructure, see below).
- **No-internet popup**: a manual "Check for Updates Now" button (Settings
  tab) that, on failure to reach the manifest, shows a small popup saying so
  — auto-closing after 10 seconds or immediately on Cancel, whichever is
  first. The silent weekly background check is unchanged (still says
  nothing on failure, by original design).
- **Settings module** (`js/settings.js`): Ayanamsa, House System, Node Method
  are explicit, persisted (localStorage), and shown per-chart (see the
  "Settings used" line above the Compute button, and the Settings tab).
  Only implemented options are selectable — nothing is offered that doesn't
  actually work.
- **Weekly update checker** (`js/updater.js`): checks at most once per 7
  days, 4-second timeout, fails silently offline, proper numeric semver
  comparison (not string comparison), 10-second auto-closing popup, never
  blocks startup. Client-side only — see "Deferred" below.
- **Location selector: two more real bugs fixed, placeholder file added**
  (`js/locationSelector.js`, `js/locationService.js`, `geo/places-india.db`):
  (1) A corrupt/placeholder database file at `geo/places-india.db` (e.g.
  before you've dropped the real one in) was crashing search entirely — a
  `SELECT 1 FROM places LIMIT 1` validation at LOAD time now catches this
  and treats it exactly like a missing/not-installed optional database,
  instead of only failing (and taking down every search, including for the
  bundled worldwide database) once a query actually ran against it. (2) The
  location search box now shows visible "Loading location database..." /
  "Searching..." / error feedback instead of silently doing nothing —
  found while chasing an intermittent one-off failure that could not be
  reliably reproduced afterward, but the lack of any visible state during
  loading was a real gap either way. `geo/places-india.db` is now a tracked
  4KB placeholder text file (not real SQLite) marking exactly where to drop
  the real ~97MB database — `.gitignore` no longer excludes the filename,
  so replacing it locally is a normal (uncommitted) file change, not a
  new/renamed path to remember.
- **Location selector: real GeoNames import verified, IANA-alias bug fixed**
  (`geo/import-geonames.js`, `js/locationService.js`, `js/ui.js`): a real
  GeoNames `IN.zip` (660,026 source rows) was supplied and imported
  end-to-end — `import-geonames.js` now also self-derives admin1/admin2
  (state/district) names directly from the dump file's own ADM1/ADM2
  boundary rows when no separate lookup file is given (36 India states/UTs,
  763 districts, verified). Result: "Toranagallu" now correctly resolves to
  Torangallu, Karnataka, Ballari district, India, Asia/Kolkata — the exact
  example from the original spec. `js/locationService.js` now loads an
  OPTIONAL supplementary database (`geo/places-india.db`) alongside the
  bundled worldwide `places.db` when present, merging search results from
  both — worldwide city coverage plus full India village coverage
  together, without replacing either. The India database itself (~97MB,
  GeoNames CC-BY 4.0) IS committed to git, by explicit request (close to
  GitHub's 100MB limit but under it) — see geo/README.md for the tradeoff
  this implies for forking/mirroring the repo. Also fixed a
  real bug this surfaced: some browsers' `Intl.supportedValuesOf('timeZone')`
  enumerate an older alias (e.g. "Asia/Calcutta") for the same zone as
  "Asia/Kolkata" — setting a `<select>`'s value to the unlisted-but-valid
  name silently failed, leaving the timezone field blank (which would have
  broken the actual UTC conversion, not just the display). Fixed via a
  shared `setIanaZoneSelectValue()` helper that adds the option if missing
  before setting it — applied everywhere a location or saved default sets
  an IANA zone field. 34/34 integration tests pass, including new
  Toranagallu-specific checks (skipped gracefully when
  `places-india.db` isn't installed).
- **Worldwide location selector** (`geo/`, `js/locationService.js`,
  `js/locationSelector.js`): a reusable search-as-you-type location picker,
  backed by a local SQLite database (`geo/places.db`, ~34MB, ~153,000
  towns/cities worldwide with state/country/population/IANA timezone) via
  sql.js (SQLite compiled to WebAssembly, `js/sqljs/` — the same
  "WASM engine, offline, no server" pattern already used for Swiss
  Ephemeris). One search service/database, TWO fully independent instances:
  Birth Place (Chart & Analysis tab, feeds the existing
  birthLat/birthLon/timezoneMode/ianaZone fields that already drive
  `generateFullChart()`, unchanged) and Astrologer's Location (feeds the
  existing astroLat/astroLon and the Horary tab's judgment-place fields).
  Selecting one never touches the other. Features: debounced (250ms)
  ranked autocomplete (exact > prefix > alt-name-exact > contains >
  alt-name-contains > population), duplicate-name places shown with
  state/country so e.g. six different "London"s are distinguishable,
  manual coordinate entry with -90..90 / -180..180 validation for places
  not in the database, an optional "Use My Current Location" button
  (Astrologer's Location only, browser geolocation requested only on
  click, never on page load), and `getSelectedLocation()` returning null
  (never a silent 0,0/UTC default) until a real location has been chosen.
  Timezone always comes from the place record's own IANA zone ID — never
  derived from longitude or guessed from country — feeding the existing
  `zonedLocalToUtc()` (`js/timezone.js`, unchanged), which uses the
  browser's own `Intl`/tzdata for historically-correct local-to-UTC
  conversion. CAVEAT: the bundled database covers towns/cities but not
  every small village (the feature's own test case, Toranagallu, is below
  its threshold) — `geo/import-geonames.js` builds the same schema from
  REAL GeoNames dump files for complete worldwide village-level coverage;
  it could not be run end-to-end here because this dev sandbox's network
  policy blocks download.geonames.org, but it was verified against a
  hand-built GeoNames-format sample reproducing the exact
  Torangallu/Toranagallu alternate-name scenario from the original spec.
  30/30 integration tests pass (`geo/test-location-search.js`) against the
  real `searchPlaces()` code path for the app's full test list (6 Indian
  cities, 8 international cities, London duplicate-name resolution,
  alternate-name search, coordinate/timezone integrity, min-length gating,
  performance). Full documentation in `geo/README.md` (data source,
  licensing/attribution, schema, how to rebuild from full GeoNames data,
  how timezone is determined, how the app consumes lat/lon).
- **Chart & Analysis tab UI overhaul**: the Auto-Generate Full Chart
  section now sits at the top, right below "Choose File" (previously
  buried below the Planets/Cusps tables). New "Default Values" (reloads
  the baked-in default birth details and regenerates everything) and
  "Reset All" (blanks all data, marks every field needing manual entry in
  yellow) buttons next to Choose File. "Generate Full Chart" now cascades
  into every other report (significators, ruling planets, dasha, life
  topics, charts) in one click instead of requiring a separate "Compute KP
  Analysis" press — and skips re-computing entirely if the birth details
  haven't changed since the last generation. Uploading a CSV/JSON/Excel
  file populates the Planets/Cusps tables immediately (unchanged) and now
  also cascades into every report the same way, with each essential field
  (name/sign/house/star lord/sub lord) colored light green when filled or
  light red when missing, live-updated as you edit. Default chart style in
  the Charts tab is now North Indian. Default birth details updated to
  1970-06-02 18:45, 26.7658°N 83.3649°E. (Live Ruling Planets and the Live
  Transit Table already auto-started on page load using their own default
  coordinates before this change — confirmed still working, not new.)
- **Cuspal Interlinks (Bhaskaran Paddhatee)** (`js/cuspalInterlinks.js`,
  "Cuspal Interlinks" tab): for chosen house cusps, walks the Sub Lord ->
  (that planet's own) Star Lord -> (that planet's own) Sub Lord chain,
  shows each link's significated houses, and classifies favorability via
  the standard KP house-nature rule (1,3,5,7,9,11 Favorable; 4,8,12
  Unfavorable; 2,6,10 Neutral) — modeled on a reference KP software's
  Cuspal Links screen (screenshot supplied by the user). Also computes
  whether the Moon reflects a selected query, and Final/Common/Fruitful
  significators across the analyzed cusps for that query. Works on THREE
  chart sources: the natal chart (always available), the Horary chart
  (only after "Analyze Horary" has actually been pressed — reuses the same
  `lastHoraryAnalysis` gate as the Event Promise tab), and a new "Time
  Chart" mode (any arbitrary moment/place, reusing `autoChart.js`'s
  `generateChart()` unchanged). CAVEAT, flagged prominently in-app: the
  house-favorability rule, the Sub Lord chain, and the Moon/significators
  logic reproduce standard KP mechanics already used elsewhere in this
  app — but the reference software's exact "Potential Stl/Sbl" and
  combined-verdict scoring formula could not be reliably reverse-engineered
  from a screenshot, so this app uses its own documented, simpler
  combination rule for those two columns specifically, which may disagree
  with that software's exact wording on some rows.
- **Auto Predicted Event Promise** (`js/eventPromiseTable.js`, "Auto
  Predicted Event Promise" tab): a per-house/per-Moon breakdown table of
  the same Event Promise check used elsewhere in this app, styled after a
  reference KP software's Event Analysis screen (a screenshot the user
  supplied) — one row per relevant cusp (the event's topic cusp + its
  required houses) plus a Moon row, each showing Sign/Nakshatra/DMS, its
  Sub Lord/Star Lord/Sub-Sub Lord and the Sub Lord's own house placement,
  its full significator list, and a Y/N + hand-pointer flag for whether it
  confirms the query. Always shown for the currently loaded natal chart; a
  second Horary-chart version of the same table appears below it ONLY
  after "Analyze Horary" has actually been pressed at least once in the
  Horary Prediction tab (tracked via a `lastHoraryAnalysis` flag) — the
  Horary tab's pre-filled default number is never used here on its own, so
  nothing appears from an un-submitted default. Introduces no new
  astronomical calculation — reuses significators.js and the sign/star/sub
  lord fields already derived by kpSubLords.js.
- **Ruling Planets filter, wired into Horary Prediction and Event Timing**
  (`horaryEngine.js`'s `applyRulingPlanetFilter`, `eventTimingEngine.js`'s
  `applyRulingPlanetFilterToPromise`, both reusing `rulingPlanets.js` /
  `liveRulingPlanets.js` unchanged): a checkbox on each tab ("Show Ruling
  Planets...") controls only whether the Ruling Planets list itself is
  displayed — the promise/genuineness verdict is ALWAYS shown twice, side
  by side ("without RP filter" vs "with RP filter", the latter requiring
  the deciding planet to itself be a current Ruling Planet), with an
  explicit caution that this is one optional confirmation technique, not a
  required step, and the two readings can disagree. Horary uses Ruling
  Planets cast for the judgment moment/place; Event Timing uses them cast
  for the search start date at the birth location (since Event Promise
  there is natal, not date-specific).
- **Horary Prediction** (`js/horaryTable.js`, `js/horaryChart.js`,
  `js/horaryEngine.js`, "Horary Prediction" tab): KP Horary number (1-243
  currently — see caveat below) casting and the 4-step reading method
  (query genuineness via Moon + Lagna sub lord, event promise via the
  topic cusp's sub lord, cuspal strength ranking, conflicts vs. opposing
  houses), covering all 32 existing event topics from `eventRules.js` via
  a new `topicCuspHouse` field (this app's proposed KP default per topic —
  editable). The Horary Ascendant is looked up from the SAME standard
  sub-lord subdivision table used everywhere else (kpSubLords.js), and the
  other 11 cusps are derived by rotating the REAL Placidus house framework
  for the moment of judgment so its cusp 1 lands on the horary Ascendant —
  reuses existing calculation code, introduces no new astronomical
  calculation. CAVEAT: classical KP Horary literature describes 249
  numbers; this table currently covers the well-verified 243 (the standard
  sub-lord count) and leaves 244-249 unmapped rather than guess at a rule
  that could silently shift every number's mapping — flagged prominently
  in-app, pending your cross-check against known reference numbers from
  your existing KP Horary software.
- **Marriage Longevity Score** (`js/eventTimingEngine.js`, Event Timing tab):
  a natal-only 0-100 score (shown only for the Marriage / Separation-Divorce
  events) checking whether the 7th cusp's sub lord/sub-sub lord chain, the
  2nd/7th/11th lords, the Rahu-Ketu axis, and the 7th cusp's star lord lean
  toward 2/7/11 (stability) or 6/10/12 (separation). Unlike the rest of the
  Event Timing tab, this does not depend on a candidate date — it is a
  structural read of the natal chart, meant to be read alongside the
  Separation/Divorce timing search to see when (if ever) a vulnerable
  wiring actually gets activated by a dasha period. Reuses only
  significators.js output; no new astronomical calculation. Flagged in-app
  as one documented rule set, not settled classical doctrine.
- **Pada** (nakshatra quarter) added to `kpSubLords.js` and shown in the
  Planets/Cusps tables.
- **Electron scaffold** (`package.json`, `main.js`): wraps the existing
  `index.html` unchanged in a desktop window. Run with `npm install && npm start`
  once you have Node.js installed. Not yet built into a Windows installer.
- Tabs, pastel styling, live transit table, live ruling planets, dasha,
  significators, life-topic analysis, Excel import/export — unchanged from
  before this round of work, per instruction not to redesign anything working.

## Deferred (by your explicit decision, not overlooked)

- **BNN calculations**: not implemented — need a reference for what this
  system computes before it can be built correctly.
- **Real update hosting, code signing, atomic file replacement**: `updater.js`
  checks a manifest and shows the popup, but "Update Now" currently just
  opens `downloadUrl` for you to run manually — it doesn't download, verify
  a SHA-256/signature, or atomically replace app files. That needs your
  actual hosting/signing setup to build against; `update-manifest.example.json`
  shows the expected shape.
- **Full modular file split** (`app.js`, `birthdata.js`, `chart.js`,
  `houses.js` etc. as the prompt's suggested tree names): `ui.js` still
  holds most UI logic. Splitting it is safe to do incrementally later
  without touching the calculation modules, which are already separate
  files.

## Not changed

Every existing calculation (Placidus cusps, KP sub-lords, Vimshottari dasha,
significators, life-topic promise analysis, live ruling planets, dynamic
transit table) is untouched — only additive changes were made.
