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
