# Architecture Status — vs. the Offline-First Desktop App Requirements

This tracks what's implemented against the requested architecture, so it's
clear what's real vs. deferred at any point.

## Done

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

- **Swiss Ephemeris WASM**: the app still uses `astronomy-engine` (MIT,
  analytic/VSOP87, already verified against physical sanity checks). Swap
  this in once you supply `swisseph.wasm` + its data files — the calculation
  call sites (`ephemeris.js`, `placidusCusps.js`) are the only places that
  would need to change.
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
