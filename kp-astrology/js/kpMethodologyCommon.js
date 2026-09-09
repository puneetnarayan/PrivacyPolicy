// Shared, read-only helpers for the KP interpretation-methodology tabs
// (Four-Step Theory, S.P. Khullar, K. Bhaskaran, Naadi Significators, and
// later Event Analysis / Comparative Analysis). Introduces NO new
// astronomical calculation — everything here reads the SAME chart data
// (state.planets/state.cusps) and the SAME significators.js output already
// used throughout this app. None of kpSubLords.js, significators.js,
// dasha.js, ephemeris.js, planetaryRelations.js, eventRules.js, or
// cuspalInterlinks.js is modified by this file or by any file that uses it.

const KP_METHODOLOGY_COMMON_LOGIC_TEXT = [
  ['KP Methodology Tabs — Shared Logic'],
  [''],
  ['Every methodology tab below (Four-Step Theory, S.P. Khullar, K. Bhaskaran, Naadi Significators) reads the SAME currently-loaded chart (Chart & Analysis tab\'s Planets/Cusps tables) and the SAME underlying significator engine (significators.js) — only the PRESENTATION and interpretation layer differs per tab. Each has its own Refresh button and does not recompute or alter any other tab.'],
  ['Notation: "#" = the planet is posited in a nakshatra ruled by itself ("in its own star"). "*" = NO OTHER planet is posited in a nakshatra ruled by this planet ("no planet in its star") — this is also the Four-Step Theory\'s own strength test. "R" (shown in red) = retrograde.'],
  ['"(+)" on a planet marks that its own significator houses include BOTH a supporting house (Favorable: 1,3,5,7,9,11) and an obstructing house (Unfavorable: 4,8,12) at once — both influences are present together.'],
  ['Node representation (Rahu/Ketu) is always shown as TWO SEPARATELY LABELED conventions, never merged: (a) the sign lord of the sign the node occupies, and (b) any planet conjunct the node (by exact longitude if available, else by same house placement).']
];

// Fixed KP house-nature classification — the SAME one cuspalInterlinks.js
// already uses (Favorable 1,3,5,7,9,11 / Unfavorable 4,8,12 / Neutral 2,6,10).
// Duplicated here (not imported) only because this file must also work
// standalone in the Node.js test harness; the values are identical by
// construction and never diverge.
const KP_HOUSE_NATURE = { favorable: [1, 3, 5, 7, 9, 11], unfavorable: [4, 8, 12], neutral: [2, 6, 10] };

// 3-letter abbreviations for compact table cells, per Section 25's
// requested convention (SUN/MOO/MAR/RAH/JUP/SAT/MER/KET/VEN).
const PLANET_ABBR = {
  Sun: 'SUN', Moon: 'MOO', Mars: 'MAR', Mercury: 'MER',
  Jupiter: 'JUP', Venus: 'VEN', Saturn: 'SAT', Rahu: 'RAH', Ketu: 'KET'
};
function abbr(planetName) {
  return planetName ? (PLANET_ABBR[planetName] || planetName) : '—';
}

function findPlanetRecord(planets, name) {
  return planets.find(p => p.name === name) || null;
}

// Houses a planet OWNS (is the traditional sign lord of that cusp's sign) —
// derived from cusps + SIGN_LORD (kpTables.js), the same table
// significators.js already uses for "owners". Not stored on the planet
// record itself, so every methodology tab that needs it derives it here
// instead of duplicating the lookup.
function housesOwnedBy(cusps, planetName) {
  if (!planetName) return [];
  return cusps
    .filter(c => SIGN_LORD[c.sign] === planetName)
    .map(c => Number(c.house))
    .sort((a, b) => a - b);
}

// "*" test (also the Four-Step Theory strength test): true when NO OTHER
// planet is posited in a nakshatra ruled by planetName.
function noPlanetInOwnStar(planets, planetName) {
  if (!planetName) return false;
  return !planets.some(p => p.name !== planetName && p.starLord === planetName);
}

// "#" test: true when planetName is posited in a nakshatra ruled by itself.
function inOwnStar(planets, planetName) {
  const p = findPlanetRecord(planets, planetName);
  return !!(p && p.starLord === planetName);
}

// Combined "#"/"*" notation string for one planet record (does not include
// "R" — retrograde is rendered separately, in red, by each tab's own view
// code, since it needs HTML styling rather than a plain-text character).
function planetNotation(planets, planet) {
  const marks = [];
  if (inOwnStar(planets, planet.name)) marks.push('#');
  if (noPlanetInOwnStar(planets, planet.name)) marks.push('*');
  return marks.join('');
}

// "(+)" mixed-support/obstruct marker: true when `houses` includes at
// least one Favorable AND at least one Unfavorable house.
function hasSupportAndObstructMix(houses) {
  const hasFav = houses.some(h => KP_HOUSE_NATURE.favorable.includes(h));
  const hasUnfav = houses.some(h => KP_HOUSE_NATURE.unfavorable.includes(h));
  return hasFav && hasUnfav;
}

// Node representation (Rahu/Ketu), always as two separately labeled
// conventions. Uses exact-longitude conjunction (same CONJUNCTION_ORB test
// planetaryRelations.js already applies elsewhere) when longitude is
// available on both records, else falls back to same-house placement.
function nodeRepresentation(nodePlanet, planets) {
  const signLordConvention = SIGN_LORD[nodePlanet.sign] || null;
  const nodeLon = parseFloat(nodePlanet.longitude);
  let conjunctConvention, conjunctMethod;
  if (!isNaN(nodeLon) && typeof angularSeparation === 'function' && typeof CONJUNCTION_ORB === 'number') {
    conjunctConvention = planets
      .filter(p => p.name !== nodePlanet.name && !isNaN(parseFloat(p.longitude)) &&
        angularSeparation(parseFloat(p.longitude), nodeLon) <= CONJUNCTION_ORB)
      .map(p => p.name);
    conjunctMethod = 'exact longitude, same rule as Planetary Relations';
  } else {
    conjunctConvention = planets
      .filter(p => p.name !== nodePlanet.name && Number(p.house) === Number(nodePlanet.house))
      .map(p => p.name);
    conjunctMethod = 'same house placement (exact longitude not available)';
  }
  return { signLordConvention, conjunctConvention, conjunctMethod };
}

// Snapshot of the currently loaded chart, built once per tab Refresh —
// returns null if the Planets/Cusps tables aren't populated yet, so every
// tab's view code can show one consistent "load a chart first" message
// instead of each reimplementing the check.
function buildMethodologyChartData() {
  const planets = state.planets.filter(p => p.name);
  const cusps = state.cusps.filter(c => c.house);
  if (!planets.length || !cusps.length) return null;
  const significators = buildSignificators(planets, cusps);
  return { planets, cusps, significators };
}

// Given a map of planetName -> houses-it-signifies (built differently per
// methodology — KP Default/Naadi use significators.js's reverse lookup,
// Four-Step uses only PRIMARY houses, Khullar/Bhaskaran use their own
// "positional"/"significator" house lists), finds whichever planet connects
// the most of `requiredHouses` — the shared "best connecting planet"
// concept every methodology's own promise-check and Comparative Analysis
// both need, kept in ONE place instead of five near-duplicates.
function bestConnectingPlanet(housesMap, requiredHouses) {
  let bestPlanet = null, bestHouses = [];
  PLANET_NAMES.forEach(name => {
    const houses = housesMap[name] || [];
    const connected = requiredHouses.filter(h => houses.includes(h));
    if (connected.length > bestHouses.length) { bestPlanet = name; bestHouses = connected; }
  });
  return { bestPlanet, housesConnected: bestHouses, fraction: requiredHouses.length ? bestHouses.length / requiredHouses.length : 0 };
}

// Translates a 0-1 connection fraction into the non-absolute language
// Section 39 requires — used wherever a methodology's own promise-check
// (not the existing numeric Astrological Activation Score, which has its
// own EVENT_TIMING_THRESHOLDS wording) needs a plain-language verdict.
const JUDGEMENT_BANDS = [
  { min: 1, label: 'Strongly Supported' },
  { min: 0.75, label: 'Supported' },
  { min: 0.5, label: 'Moderately Supported' },
  { min: 0.25, label: 'Mixed / Conditional' },
  { min: 0.01, label: 'Weakly Supported' },
  { min: 0, label: 'Not Supported' }
];
function judgementLanguage(fraction) {
  const band = JUDGEMENT_BANDS.find(b => fraction >= b.min);
  return band ? band.label : 'Insufficient Data';
}

// Calendar (Y-M-D-H) breakdown between two UTC instants, ignoring finer
// than the hour — used for "Age at Event" (Section 19). Based directly on
// the two instants' own UTC calendar fields (not converted to birth-place
// local time, unlike the Vimshottari Dasha tab's display) — kept simple
// and clearly documented as such in the UI, since the age question here is
// "how much time elapsed", not "what did the clock read".
function ageBreakdown(fromDateUtc, toDateUtc) {
  const msDiff = toDateUtc.getTime() - fromDateUtc.getTime();
  if (msDiff < 0) return null;
  let years = toDateUtc.getUTCFullYear() - fromDateUtc.getUTCFullYear();
  let months = toDateUtc.getUTCMonth() - fromDateUtc.getUTCMonth();
  let days = toDateUtc.getUTCDate() - fromDateUtc.getUTCDate();
  let hours = toDateUtc.getUTCHours() - fromDateUtc.getUTCHours();
  if (hours < 0) { days--; hours += 24; }
  if (days < 0) { months--; days += new Date(Date.UTC(toDateUtc.getUTCFullYear(), toDateUtc.getUTCMonth(), 0)).getUTCDate(); }
  if (months < 0) { years--; months += 12; }
  return { years, months, days, hours };
}

if (typeof module !== 'undefined') {
  module.exports = {
    KP_METHODOLOGY_COMMON_LOGIC_TEXT, KP_HOUSE_NATURE,
    PLANET_ABBR, abbr,
    findPlanetRecord, housesOwnedBy, noPlanetInOwnStar, inOwnStar, planetNotation,
    hasSupportAndObstructMix, nodeRepresentation, buildMethodologyChartData,
    bestConnectingPlanet, judgementLanguage, JUDGEMENT_BANDS, ageBreakdown
  };
}
