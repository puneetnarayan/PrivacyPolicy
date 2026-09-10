# Architecture Status — vs. the Offline-First Desktop App Requirements

This tracks what's implemented against the requested architecture, so it's
clear what's real vs. deferred at any point.

## Done

- **"Saved Natives" tab — CSV-backed save/search/load** (`js/savedNatives.js`,
  `js/ui.js`, `index.html`): save a native's identity (Name, Sex,
  Location, City, State, Country, Notes) plus the CURRENT Chart &
  Analysis tab's birth fields (Birth Date, Birth Time, Latitude,
  Longitude, Timezone Mode, UTC Offset/IANA zone) to a plain CSV file,
  search across every field, and load any saved native back with one
  click — which repopulates the birth fields and immediately regenerates
  the full chart, same as pressing "Generate Full Chart" yourself.
  Additive only — reads/writes the SAME birth fields every other tab
  already uses; no calculation file touched.
  - **File access**: in Chrome/Edge, "Browse / Connect CSV File" (and
    "Start a New (Empty) CSV") use the File System Access API to keep a
    live, writable file handle — every Save/Delete writes straight back
    to that file with no repeated file dialogs. In browsers without that
    API (Firefox, Safari), the file loads read-only via a plain
    `<input type=file>`, and Save/Delete instead trigger a fresh CSV
    download to manually replace the file with — this app is a static
    offline page with no server, so a real always-automatic write isn't
    possible there without the Electron wrapper's Node `fs` access
    (unfinished/not installer-packaged yet), which was flagged as the
    honest trade-off rather than silently promising full automation
    everywhere.
  - **CSV format**: `js/savedNatives.js` has its own small RFC4180-style
    parser/serializer (handles quoted fields, embedded commas, and
    embedded newlines in Notes) — the existing `parseCsvBundle()` used
    for planet/cusp uploads is a plain comma-split and isn't safe for
    free-text fields, so this is a separate, purpose-built implementation
    rather than reusing/stretching that one. Columns are matched by
    header NAME on load, not position, so a reordered or partially
    edited CSV still loads correctly. `UTCOffset` holds whichever value
    is actually active (an offset string or an IANA zone name) in one
    column, documented in the tab's own logic notes.
  - Save matches an existing record by Name (case-insensitive) and
    updates it in place; otherwise appends a new row.
  - Verified via Playwright (fallback file-input path, since the native
    file-picker dialogs aren't automatable): save with no file connected
    correctly downloads a well-formed CSV (including a Notes field
    containing a comma, verified byte-for-byte); loading a CSV via the
    fallback input populates the search table; search filters correctly
    (including the "no matches" case); clicking Load switches to the
    Main tab, populates all birth fields, and regenerates the chart
    (verified via a real 9-row planet table and the status message);
    Delete removes the record and produces a correctly-updated CSV. Full
    existing regression suite still passes.
- **Vimshottari Dasha (4 Levels) tab: light-yellow selection highlight**
  (`js/ui.js`, `index.html`): clicking any lord to open its sub-periods
  now also highlights that clicked row in light yellow
  (`.dasha-row-selected`), at whichever level it was clicked, in addition
  to (not instead of) the existing orange current-period highlight. If
  the current-period row itself is the one clicked, it keeps its orange
  background (verified: that row ends up carrying both
  `dasha-row-current` and `dasha-row-selected` classes, and the CSS rule
  order — current declared after selected — makes orange win on the
  tie, exactly as requested). Verified via Playwright: clicking a
  non-current row turns it light yellow (`rgb(255, 249, 176)`) while the
  real current row elsewhere stays orange (`rgb(255, 179, 71)`);
  clicking the current row itself stays orange; full existing
  regression suite (auto-open, manual column navigation/truncation)
  still passes unchanged.
- **Vimshottari Dasha (4 Levels) tab: auto-open current path, orange
  current-period highlight, dropped UTC-offset display** (`js/ui.js`,
  `index.html`): three small UX fixes, additive only.
  - `autoExpandCurrentDashaPath()` now runs right after the initial
    Mahadasha column renders — it walks whichever period actually
    contains "now" at each level and clicks through it programmatically
    (reusing each row's own existing click handler, not a separate
    render path), so all 4 columns (Mahadasha/Antardasha/
    Pratyantardasha/Sookshmadasha) are open by default instead of
    requiring 3 manual clicks. Manually clicking a different lord still
    works exactly as before (truncates and rebuilds columns after it).
  - Every column's rows now check `now >= period.start && now <
    period.end` and add a `.dasha-row-current` class (orange background,
    bold text) — this is computed per-row from the actual date range, not
    from a tracked "path index", so it stays correct even if the user
    navigates to a different branch (nothing lights up there, correctly,
    since that branch isn't the real current period).
  - `formatDashaMoment()` no longer appends the "UTC+5:30"/"UTC" suffix
    to Start/End cells — the offset is still used correctly to compute
    the displayed local time, it's just not shown as text anymore.
  - Verified via Playwright: a fresh Refresh auto-opens all 4 columns
    with a real orange-highlighted row at every level (matching the
    actual current Mahadasha/Antardasha/Pratyantardasha/Sookshmadasha),
    no "UTC" text anywhere in the columns, manual navigation to a
    different branch still truncates/rebuilds correctly, and the full
    existing regression suite still passes.
- **Career tab: Dasha/Bhukti overlay, hybrid career spectrum, and
  confidence/caution scoring** (`js/careerTab.js`, `js/ui.js`): extends
  last round's Career tab with the four items you specified, still
  additive-only — no existing calculation file touched.
  - **Rule D (Dynamic Dasha/Bhukti overlay)**: the static Job/Business
    scores are now blended with an Active Period Score computed the same
    way from the CURRENT Mahadasha and Antardasha lords' own "scripts"
    (lord + its own Star Lord + its own Sub Lord) — `Final Score =
    0.4×Static + 0.4×Bhukti + 0.2×Dasha`, per side. Two period-conflict
    alerts are checked: static strongly favoring Business (≥20-point gap)
    while the Bhukti lord's script strongly hits Career Obstacle houses
    (2+ of 5/8/12); static strongly favoring Job while the Bhukti lord's
    script strongly hits the Resignation/Break houses (2+ of 1/5/9).
    Falls back to the static-only score when no dasha is available,
    clearly labeled either way.
  - **Rule E (Hybrid career spectrum)**: the same combined house union
    scored against four overlapping patterns — Corporate (6,10,11, 7
    absent), Independent Business (7,10,11, 6 absent), Freelancing (6, 7,
    AND 3 all present), Equity/Partnership (7,8,11) — shown as a 4-bar
    percentage spectrum (not mutually exclusive) plus a single best-fit
    classification checked in priority order, with a graceful fallback
    ("closest fit") when no pattern cleanly matches.
  - **Rule F (Confidence & Caution scoring)**: every insight (Job/Business,
    each of the 3 signal checks, Workspace Direction) starts at 100%
    confidence and loses points per a documented rule set (−25% for a Sub
    Lord signifying both a supporting and an obstacle house at once, −15%
    for a Sub Lord sitting in a house with no primary career
    signification, −20% for the Job/Business insight specifically when
    the static reading and the active Bhukti lord's own leaning disagree).
    Anything under 65%, or carrying any deduction at all, is surfaced
    inline (a small caution tag next to the result) AND collected into a
    dedicated "Caution / Hazy Blocks" section — distinct amber/dashed
    styling, feature name, status badge, itemized reasoning, and a
    feature-specific mitigation suggestion — never silently smoothed over.
  - **Rule C demotion**: the Workspace Direction widget is relabeled
    "Practical Advice & Secondary / Optional Alignment Strategy" with a
    permanent disclaimer ("Directional alignments are secondary
    astrological factors and should be secondary to practical
    room/property constraints.") always shown, not just when flagged.
  - All percentages/scores rounded to the nearest 5 throughout, per
    explicit request (`round5()` helper).
  - **Real bug found and fixed during testing**: `analyzeForeignOpportunity()`
    computed its own `chain6`/`chain10` cusp chains internally but never
    returned them — invisible before because nothing else read those
    fields, but the new confidence system's `chain6.cslSubLord` access
    crashed with a clear stack trace the moment it was wired in. Fixed by
    adding `chain6, chain10` to that function's existing return object
    (purely additive — the fields it already returned are unchanged, nothing
    that previously read this function's output is affected).
  - Verified via Playwright end-to-end (Default Values → Career tab, zero
    manual clicks needed thanks to the auto-populate wiring from the
    previous round): all new sections render with internally consistent
    numbers (e.g. Job/Business 40/60 whose components trace back exactly
    through the printed Static/Bhukti/Dasha arithmetic; the 4-bar spectrum
    summing to 100%; 5 caution blocks each showing real per-Sub-Lord
    reasoning), no console errors, and the full pre-existing regression
    suite (Main tab, other methodology tabs, Event Analysis) still passes
    unchanged.
- **All analysis tabs auto-populate on data submit/load, plus a
  step-by-step calculation trace on the Career tab** (`js/ui.js`): two
  related UX fixes, both additive.
  1. `runComputations()` — the single function every data-submission path
     already funnels through (Generate Full Chart, Default Values, file
     upload/Generate button, manual "Compute KP Analysis") — now also
     calls a new `refreshAllAnalysisTabs()` at the end, which re-renders
     KP Default, Four-Step, Khullar, Bhaskaran, Naadi, Career, and
     Vimshottari Dasha (4 Levels) automatically (each wrapped separately
     so one tab's error can't block the others). Event Analysis/
     Comparative Analysis are selection-driven, so they only auto-refresh
     if the user already has event(s) selected — an empty selection isn't
     overwritten. Each tab's own "Refresh" button still works (e.g. to
     force a re-run after switching tabs), it's just no longer the ONLY
     way to see first results.
  2. `init()` now calls `generateFullChart()` once automatically right
     after birth details load (the user's own saved details from
     localStorage, or this app's baked-in defaults) — so a brand-new page
     load populates every tab immediately, with zero manual clicks,
     verified via Playwright (planet table, significators, and all seven
     auto-refreshed tabs all show real content on a fresh `page.goto()`
     with no button clicks at all).
  3. **Career tab step-by-step trace**: each result now has an inline,
     expandable "How was this calculated?" section built entirely from
     data the analysis functions already returned (no new calculation) —
     the Job vs. Business result shows all 3 cusp chains' Star/Sub Lords
     and each chain planet's own significator houses, the union, the
     Job/Business scoring arithmetic (primary ×2 + secondary ×1), the
     percentage conversion, the 15-point threshold check, and the
     Obstacle/Resignation-combo scoring — in the same order the code
     actually computes them. Each of the three signal cards (Interview,
     Payment, Foreign) and the Workspace Direction result got the same
     treatment, showing the exact chain/houses/condition that produced
     that flag. Verified via Playwright: 4 "How was this calculated?"
     sections render with real numbers substituted in, matching the
     underlying analysis object's actual values.
- **"Profession & Career" tab** (placed after Comparative Analysis, before
  Vimshottari Dasha): a Job vs. Business suitability engine plus three
  functional signal checks and Vastu-style workspace direction guidance —
  built to your exact specification. Additive only: new file
  `js/careerTab.js`; `index.html`/`js/ui.js` changes are new tab
  button/panel/script tag/CSS/init call only. No existing calculation
  file touched.
  - **Job vs. Business**: unions the significator houses of the 10th, 6th,
    and 7th cusp Sub Lord chains (CSL + that lord's own Star Lord + Sub
    Lord), scores them against Job (primary 2,6,10,11 / secondary 1,3) and
    Business (primary 2,7,10,11 / secondary 3,9) house sets, and reports a
    Job%/Business% bar plus a Primary Recommendation ("Strongly Suited for
    Job/Business" or "Hybrid / Freelancing / Contractual" when the gap is
    under 15 points). Career Obstacle houses (5,8,12) and the full
    Resignation/Break combination (1,5,9) are tracked and shown
    separately, not folded into the percentages.
  - **Functional signals**: Interview & Scheduling (3rd cusp chain hits
    5/8/12 without 10/11 support), Payment & Cashflow Risk (2nd/11th
    chain hits 5/8 without 2/11 support — recommends collecting advance
    payments when flagged), Foreign/Offsite Potential (6th/10th chain
    hits at least 2 of 9/12/3) — each rendered as a clearly flagged/OK
    signal card, never a silent pass/fail.
  - **Workspace direction**: 10th cusp sign (falling back to 2nd, then
    11th) mapped by element to a direction (Fire→East, Earth→South,
    Air→West, Water→North).
  - UI: percentage bar, positive/negative house pill tags, signal cards,
    and a practical-advice box — reusing the app's existing
    pastel/output-box visual language, no new framework (built in this
    app's actual stack — plain HTML/CSS/JS — not React/TypeScript, since
    the request's own constraints rule out introducing a framework).
  - **Explicitly flagged as one specific, documented rule set** (per your
    own spec) — not independently verified against a published KP
    career-analysis reference, and deliberately kept separate from the
    KP Default/Four-Step/Khullar/Bhaskaran/Naadi tabs' own significator
    logic (same caveat convention every other methodology tab uses).
  - Verified via Playwright: all four UI sections render real computed
    data (Job/Business bar summing to 100%, 8 house pills, 3 signal
    cards, workspace direction resolved), no page errors, and the full
    existing regression suite still passes unchanged.
- **KP Default, Event Analysis, and Comparative Analysis tabs** — the
  remaining three tabs from the original methodology-tabs spec, completing
  it alongside the four already built. Additive only: new files
  `js/kpDefaultTab.js`, `js/eventAnalysisTab.js`, `js/comparativeAnalysisTab.js`;
  `index.html`/`js/ui.js` changes are new tab buttons/panels/script
  tags/init calls only, nothing existing removed or altered. No existing
  calculation file touched.
  - **KP Default** (placed before "4-Step Theory"): sections A-F per the
    spec — planet significator table, node representation, detailed
    per-planet chains (Self/STL/SUB/STL-of-SUB + cusp connections +
    aspects when exact longitude is available, else explicitly
    "Not available from current calculation engine" rather than a guess),
    a planet signification table split into primary (Occupant/Owner) vs.
    secondary (Star Lord of Occupant/Owner) sources, a 12-row cusp
    signification table, and the existing house-wise significator
    breakdown reproduced for completeness. Pure presentation over
    significators.js/kpSubLords.js — no new significator rule.
  - **Event Analysis** (placed after Naadi Significators): a button grid
    grouped by category (all 32 events already in `eventRules.js`, plus 5
    additively-merged events — `EXTRA_EVENT_RULES` in `eventAnalysisTab.js`
    — for the Health category and two Children-specific queries the
    original spec named that `eventRules.js` didn't yet have;
    `eventRules.js` itself is never edited). Multiple events select
    independently; each gets its own collapsible result card (Event
    Promise, relevant cusps, opposing significators, the Four-Step chain
    for the best-connecting planet, current Dasha/Transit support, a
    non-absolute Final Judgement, and Timing Windows with age-at-window
    in years-months-days-hours). Select All / Clear All provided.
    **Real bug found and fixed during testing**: the shared timing-search
    engine (`eventTimingEngine.js`'s `scoreCandidate`) looks up events by
    key directly in `EVENT_RULES`, so it silently doesn't know about the 5
    additively-merged events — calling it for one of those crashed the
    whole render (an uncaught exception mid-loop left the previous
    selection's card stuck on screen instead of updating). Fixed by
    detecting this case (`findEventTimingWindows` returns `null`, not an
    empty array, when the event isn't in the shared engine's own registry)
    and showing an honest "Timing windows aren't available for this
    app-added event definition" message instead of crashing — deliberately
    NOT fixed by merging the extra events into the real `EVENT_RULES`
    object, since that would have silently widened Event Timing/Horary/
    Cuspal Interlinks' own event dropdowns too.
  - **Comparative Analysis**: for whichever event(s) are currently
    selected in Event Analysis (shared selection state), compares KP
    Default / Four-Step / S.P. Khullar / K. Bhaskaran / Naadi side by
    side — each methodology finds its own best-connecting planet from its
    own significator data; the Overall row reports a descriptive tally
    ("N of 5 methods support"), never a voting rule. Documented caveat:
    since Khullar/Bhaskaran/Naadi reuse the same underlying significator
    computation as KP Default (no independently-derived formula was
    available — see each tab's own caveat), their comparison rows often
    match KP Default exactly; Four-Step differs because it applies its own
    primary-only strength filter. Flagged as an honest reflection of what
    is actually implemented, not manufactured disagreement.
  - Verified via Playwright: KP Default's six sections all render real
    data; Event Analysis's 37 buttons render across 10 categories,
    multi-select/deselect/Select-All/Clear-All all work correctly with no
    page errors after the fix above; Comparative Analysis produces a real
    5-method + Overall table; full existing regression suite (Main tab,
    the four methodology tabs) still passes unchanged.
- **Four KP methodology tabs** — "4-Step Theory", "S.P. Khullar", "K. Bhaskaran",
  "Naadi Significators" — added between "Cuspal Interlinks" and "Vimshottari
  Dasha (4 Levels)". Each is a pure, read-only interpretation layer over the
  SAME currently-loaded chart (`state.planets`/`state.cusps`) and the SAME
  `buildSignificators()` output the rest of the app already uses — **no
  change to any existing calculation file** (`kpSubLords.js`, `ephemeris.js`,
  `placidusCusps.js`, `dasha.js`, `significators.js`, `eventRules.js`,
  `cuspalInterlinks.js`, `settings.js` all untouched). New files, all
  additive: `js/kpMethodologyCommon.js` (shared helpers — notation, node
  representation, house-nature classification, chart-data snapshot),
  `js/fourStepTheory.js`, `js/spKhullar.js`, `js/kBhaskaran.js`,
  `js/naadiSignificators.js`. Each has its own "Refresh" button (same
  pattern as Charts/Dasha-Levels) and does not affect any other tab.
  - **Four-Step Theory**: Planet → Star Lord → Sub Lord → **Star Lord of
    the Sub Lord** (Step 4) — kept as a distinct field (`subLordStarLord`)
    from the planet's ordinary Sub-Sub Lord (`planetSubSubLord`), verified
    to differ in practice (e.g. natal Sun: ordinary SSL = Ketu, Step 4 =
    Venus). Primary/secondary strength uses the published Four-Step rule:
    an occupied house is primary only if no other planet sits in that
    lord's own star; an owned house is primary only if no planet occupies
    it.
  - **S.P. Khullar / K. Bhaskaran / Naadi Significators**: table/card
    layouts reproduce the STRUCTURE of the reference screenshots you
    supplied (Lords of/Positional/Star-Sub-SS Lord cards; PLA/STL/SUB/SSL
    + Planet/Significator/Cusps tables; Planet/Star/Sub/SS Lord chain
    cards respectively), built on this app's standard significator engine.
    Per your own instruction, this is flagged rather than claimed as an
    independently re-derived Khullar/Bhaskaran/Naadi formula — published
    S.P. Khullar and K. Bhaskaran work centers on Cuspal Interlinks (this
    app's existing `cuspalInterlinks.js`), and no separately-documented
    "Naadi Significators" rule distinct from the standard KP 4-level chain
    was found; corrections welcome as you cross-check specific rows.
  - **Notation** (confirmed by you): `#` = planet posited in a nakshatra
    ruled by itself; `*` = no other planet posited in a nakshatra ruled by
    this planet (also the Four-Step strength test); `R` = retrograde,
    rendered in red (`.kp-retrograde`, verified via computed style
    `rgb(198, 40, 40)`); `(+)` = the planet's own significator houses
    include both a supporting (Favorable: 1,3,5,7,9,11) and an obstructing
    (Unfavorable: 4,8,12) house at once — reusing the same fixed
    house-nature classification `cuspalInterlinks.js` already applies, not
    a new invented rule.
  - **Node representation** (Rahu/Ketu): shown as two SEPARATELY labeled
    rows, never merged — "Represents (sign lord of occupied sign)" and
    "Represents (planet conjunct the node)" (exact-longitude conjunction,
    same `CONJUNCTION_ORB` test `planetaryRelations.js` already uses, when
    longitude is available; falls back to same-house placement otherwise).
  - **Deferred, not forgotten**: "KP Default" (enhanced Tab 1), "Event
    Analysis" (button-grid, multi-select event cards), and "Comparative
    Analysis" from the original spec were not built in this pass — flagged
    to the user as a following phase, not silently dropped.
  - Verified via Playwright: all four tabs render real computed data (no
    page errors beyond two pre-existing unrelated 404s), retrograde
    renders in red, Four-Step's Step 4 correctly differs from the ordinary
    Sub-Sub Lord, and the full existing regression suite (Main tab,
    Vimshottari Dasha 4 Levels) still passes unchanged.
- **Location search removed, per explicit request**: the worldwide
  GeoNames-based location-selector feature (search box, dropdown, offline
  SQLite database, "Use My Current Location") built earlier has been fully
  removed — it was taking too long to load and isn't needed. Deleted:
  `js/locationService.js`, `js/locationSelector.js`, `js/sqljs/` (the sql.js
  WASM runtime), and the entire `geo/` folder (build scripts, `places.db`,
  `places-india.db`, docs). Removed from `index.html`/`js/ui.js`: the two
  location-selector containers, their script tags, and `initLocationSelectors()`.
  Birth Place and Astrologer's Location are back to plain manual
  latitude/longitude entry only (the fields were always there underneath
  the selector, so nothing else changed) — `setIanaZoneSelectValue()` is
  kept since `loadDefaultBirthDetails()` still uses it for the timezone
  `<select>`.
- **"Generate" button next to the file upload control** (`index.html`,
  Main tab controls; `generateFromUploadedData()` in `js/ui.js`): lets you
  explicitly (re-)trigger full computation instead of relying only on the
  file input's automatic `change` event (which still also works, unchanged).
  Clicking it re-reads whichever file is currently selected in the upload
  box and reruns the same pipeline as before (parse → Planets/Cusps tables →
  `runComputations()` — significators, ruling planets, Vimshottari dasha,
  life-topic analysis, planetary relations, D1/D9/KP charts); if no file is
  selected, it recomputes from whatever is already in the Planets/Cusps
  tables instead of doing nothing (useful after manually editing a cell).
  `handleUpload()` was split so both the automatic `change` handler and this
  button share one `processUploadedFile()` implementation. **Bug fix**: the
  button originally did nothing (no error, no update) when clicked before
  any file had ever been chosen and the Planets/Cusps tables were still
  empty (e.g. right after "Reset All", or on a fresh page load) — it fell
  through to `runComputations()`, which just showed a guard message with no
  visible change. It now opens the file picker itself in that case (the
  input's own existing `change` handler then processes whatever gets
  chosen), so clicking "Generate" always leads somewhere in one click; the
  "file already selected" and "table already has manually-entered data"
  cases behave as before.
- **"Vimshottari Dasha (4 Levels)" tab**, placed right before Settings
  (`index.html`; `initDashaLevelsTab()`/`renderDashaLevelsTab()`/
  `renderDashaColumn()` in `js/ui.js`): a read-only, table-based drill-down
  view of the same dasha computed for whatever birth data is currently
  loaded in the Chart & Analysis tab (manual entry, Auto-Generate, or
  uploaded file) — reuses `computeVimshottariDasha()` unchanged, called
  with `levels: 4` instead of the Main tab's `levels: 3`, to also reach
  Sookshmadasha (the 4th level). Each level (Mahadasha, Antardasha,
  Pratyantardasha, Sookshmadasha) is a table with columns Lord | Start |
  End | Age at Start; clicking a lord opens its sub-period table in a new
  column to its right (side by side with the column clicked from, not
  replacing it) — clicking a different lord in an already-open column
  discards and rebuilds every column after it. Start/End show date **and**
  local clock time (not just date), read via `dashaLocalParts()` in the
  Chart & Analysis tab's own timezone setting (IANA zone or UTC offset),
  falling back to plain UTC if neither is set — same source of truth used
  everywhere else in the app, never a separate guess. "Age at Start" is
  the person's age in years-months-days at that period's start, via
  `calendarAgeYMD()` — a calendar (Y-M-D) difference ignoring time-of-day,
  the same convention this app's existing "Dasha Balance at Birth" already
  uses. Has its own "Refresh" button (same pattern as the Charts tab) — it
  does not auto-update when the chart changes, and doesn't feed back into
  or affect any other tab. Verified with a Playwright test confirming
  9 periods at each of the 4 levels for a real generated chart, correct
  0y-0m-0d age at the very first Mahadasha/Antardasha/Sookshmadasha (each
  starts exactly at birth), a real local time (not just a date) shown per
  row, and that switching the selected lord in one column correctly
  discards the columns opened after it.
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
- **Location search: switched to an FTS5-enabled SQLite WASM build,
  fixing a real ~500ms slowdown** (`js/sqljs/`, `js/locationService.js`,
  `geo/build-places-db-from-dr5hn.js`, `geo/import-geonames.js`): the
  vendored sql.js WASM build lacked the FTS5 extension, so the "contains"
  fallback search (needed for e.g. Toranagallu, findable only via its
  alternate name, not a name prefix) ran an unindexed LIKE '%...%' scan —
  fine on the small worldwide database, but 400-600ms against the
  ~558,000-row India database, measured directly after the previous
  optimization (checking combined results across databases before falling
  back) only partly helped. Switched `js/sqljs/` to
  [`fts5-sql-bundle`](https://www.npmjs.com/package/fts5-sql-bundle) (a
  drop-in sql.js build with FTS5 compiled in) and added a `places_fts`
  virtual table (indexing `alternate_names`) to both build scripts — the
  same fallback search is now consistently under 10ms. Also fixed a real
  bug found while wiring this in: the JOIN query's column list was
  ambiguous (`alternate_names` exists in both the `places` table and
  `places_fts`), which silently threw and fell back to the old slow path
  every time — masking the fix until qualified column references were
  added. `places-india.db` rebuilt at 97.7MB (under GitHub's 100MB limit)
  by indexing only `alternate_names` in FTS5, not `ascii_name` (already
  covered by the existing B-tree prefix index) — halves the India
  database's FTS5 overhead; the smaller bundled `places.db` keeps both
  columns indexed since its overhead is small in absolute terms. 34/34
  tests still pass; verified in-browser with real per-query timings.
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

- **Snappy location-database loading** (`js/locationService.js`): loading was
  split into two phases instead of one eager fetch of everything. `loadPrimaryDb()`
  fetches only the required `geo/places.db` (~38 MB) and resolves as soon as
  that's ready — this is what the location selectors wait on, so the app
  becomes searchable (worldwide cities) quickly. The optional `geo/places-india.db`
  (~98 MB, India village-level coverage) is now fetched separately, scheduled
  via `requestIdleCallback` (falls back to `setTimeout(…, 300)` where
  `requestIdleCallback` doesn't exist) so it loads in the background without
  competing with page-critical resources (Swiss Ephemeris WASM, xlsx.js,
  astronomy.js) for bandwidth/CPU during initial load. `loadedDbs` is
  reassigned (not mutated) once the supplementary DB finishes, so any search
  that runs later automatically includes it; a search that happens to run
  before it's ready simply searches what's loaded so far — no error, no
  blocking. Verified via `geo/test-location-search.js` (34/34 passing) and a
  real browser measurement on this machine: search box interactive and
  primary DB ready in ~2.3s (serving both DBs locally over
  `python3 -m http.server`; real-world numbers depend on your actual hosting
  and network), and a "Toranagallu" search run 4.5s after page load already
  found its match — i.e. the India DB had already loaded in the background
  by the time a user would plausibly have started typing.

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
