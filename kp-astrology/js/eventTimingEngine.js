// KP Event Timing & Fructification Engine.
//
// Reuses the app's EXISTING calculation modules only — significators.js
// (house significators), dasha.js (Vimshottari Mahadasha/Antardasha/
// Pratyantardasha/Sookshmadasha), ephemeris.js (transiting planet
// longitudes), kpSubLords.js (sign/star/sub lord derivation). This file adds
// NO new astronomical calculation — it is purely a scoring/search layer on
// top of data those modules already produce. The natal chart it scores
// against is exactly the Planets/Cusps table already computed in the
// Chart & Analysis tab (state.planets/state.cusps) — nothing is
// re-calculated or duplicated.
//
// Internally organized into the sections the feature request asked for
// (dasha analysis, transit analysis, scoring, window detection) as clearly
// labeled groups within one file, rather than 8 separate files, since the
// amount of code in each section does not justify a separate file — the
// separation that matters (calculation engine vs. this scoring layer) is
// real and enforced: this file only ever *reads* the other modules' output.

const EVENT_TIMING_LOGIC_TEXT = [
  ['Event Timing & Fructification — Logic and Sequence'],
  [''],
  ['1. EVENT PROMISE (0-30 pts default): using the natal chart\'s existing significators (significators.js), find which planet(s) connect the MOST of the event\'s required houses. A planet connecting all required houses scores the full points; connecting fewer houses scores proportionally less. This does not override or duplicate the Life Topic Promise Analysis tab — it is the same underlying significator-connection idea, applied per-event here.'],
  ['2. DBA CAPABILITY (0-30 pts default): for a candidate date, find the running Mahadasha/Antardasha/Pratyantardasha/Sookshmadasha lords (dasha.js) and check how many of them are themselves significators of the event\'s required houses. More matching period lords -> higher score. A period whose lords have no connection to the required houses scores near zero here, regardless of transits.'],
  ['3. TRANSIT ACTIVATION (0-40 pts default, split into 4 sub-components): using the SAME transiting-planet longitudes the Live Transit Table/ephemeris.js already compute for any date -- (a) Transit -> Natal Significator: is a transiting planet itself one of the event\'s natal significators; (b) Transit -> Relevant Cusp: is a transiting planet currently in the same sign as one of the event\'s house cusps; (c) Transit Star Lord: is a transiting planet currently passing through a nakshatra ruled by one of the event\'s cuspal star lords; (d) Transit Sub Lord: same idea for the cuspal sub lord\'s KP sub-division.'],
  ['4. CONVERGENCE: the total score rewards Promise + capable DBA + transit activation occurring TOGETHER. A strong transit during an incapable DBA, or a capable DBA with no transit confirmation, both score lower than all three aligning at once -- by construction, since each component only contributes when its own condition is met.'],
  ['5. NEGATIVE FACTORS: houses configured as "opposing" for the event (e.g. 1st/6th/10th for marriage, indicating separation/bachelorhood themes) are checked the same way -- if the best promise-connecting planet or a running dasha lord ALSO significates an opposing house, this is recorded as a listed conflicting factor (shown separately from positive factors) though it does not subtract from the numeric score, per the requirement to always show conflicts explicitly rather than silently discard a period.'],
  ['6. PROGRESSIVE SEARCH: Level 1 (months) samples one point per month (mid-month, local noon) across the whole search horizon -- cheap, coarse. Only the highest-scoring months proceed to Level 2 (every day in that month, full score). Only the highest-scoring days proceed to Level 3 (every hour of that day). This avoids computing hourly transits for every hour of a multi-year search.'],
  ['7. WINDOWS: consecutive days at or above the "Favourable" threshold are grouped into one window with a peak day, rather than listed as isolated dates.'],
  [''],
  ['Caveat: the exact transit-activation rules (components 3a-3d above) are one reasonable, explicitly documented rule set -- KP practitioners differ on precise transit-timing conventions, and this does not claim to be the only correct method. All weights and thresholds below are configurable constants, not fixed doctrine. This tool reports an "Astrological Activation Score" for a timing WINDOW already established as promised elsewhere in this app -- it is not a probability of the event occurring, and does not itself judge whether the event is promised at all beyond the same significator-connection check used throughout this app.']
];

// --- Configuration (scoring weights + classification thresholds) ---
// All configurable — edit these constants (or later, load them from a
// settings/JSON source) without touching the functions below.
const EVENT_TIMING_WEIGHTS = {
  promise: 30,
  dba: 30,
  transitSignificator: 15,
  transitCusp: 10,
  transitStarLord: 10,
  transitSubLord: 5
};

const EVENT_TIMING_THRESHOLDS = [
  { min: 0, max: 29, label: 'Very Weak' },
  { min: 30, max: 49, label: 'Weak' },
  { min: 50, max: 64, label: 'Possible' },
  { min: 65, max: 79, label: 'Favourable' },
  { min: 80, max: 89, label: 'Strong' },
  { min: 90, max: 100, label: 'Peak Window' }
];

function classify(score, thresholds) {
  thresholds = thresholds || EVENT_TIMING_THRESHOLDS;
  const band = thresholds.find(t => score >= t.min && score <= t.max);
  return band ? band.label : 'Unclassified';
}

// --- Section: Event Promise (reuses significators.js output) ---
function scorePromise(eventDef, significators, weights) {
  const requiredHouses = eventDef.requiredHouses;
  const houseSig = requiredHouses.map(h => (significators[h] ? significators[h].allSignificators : []));

  let bestPlanet = null, bestCount = 0, bestHouses = [];
  PLANET_NAMES.forEach(planet => {
    const housesConnected = requiredHouses.filter((h, i) => houseSig[i].includes(planet));
    if (housesConnected.length > bestCount) {
      bestCount = housesConnected.length; bestPlanet = planet; bestHouses = housesConnected;
    }
  });

  const fraction = requiredHouses.length ? bestCount / requiredHouses.length : 0;
  const score = Math.round(weights.promise * fraction);
  const opposingMatch = bestPlanet && eventDef.opposingHouses.some(h =>
    significators[h] && significators[h].allSignificators.includes(bestPlanet));

  return {
    score, maxScore: weights.promise,
    promised: bestCount >= Math.min(2, requiredHouses.length),
    bestPlanet, housesConnected: bestHouses,
    conflictingHouse: opposingMatch
  };
}

// --- Section: DBA Capability (reuses dasha.js output) ---
function scoreDba(eventDef, significators, runningLords, weights) {
  const requiredHouses = eventDef.requiredHouses;
  const lords = [
    { role: 'Mahadasha', lord: runningLords.mahadasha },
    { role: 'Antardasha', lord: runningLords.antardasha },
    { role: 'Pratyantardasha', lord: runningLords.pratyantardasha },
    { role: 'Sookshmadasha', lord: runningLords.sookshmadasha }
  ].filter(l => l.lord);

  const matched = lords.map(l => {
    const housesMatched = requiredHouses.filter(h =>
      significators[h] && significators[h].allSignificators.includes(l.lord));
    const opposingMatched = eventDef.opposingHouses.filter(h =>
      significators[h] && significators[h].allSignificators.includes(l.lord));
    return { ...l, housesMatched, opposingMatched };
  });

  const capableCount = matched.filter(m => m.housesMatched.length > 0).length;
  const fraction = lords.length ? capableCount / lords.length : 0;
  const score = Math.round(weights.dba * fraction);

  return { score, maxScore: weights.dba, matched, capableCount, totalLords: lords.length };
}

// --- Section: Transit Activation (reuses ephemeris.js + kpSubLords.js) ---
function scoreTransit(eventDef, natalCusps, significators, transitDate, weights) {
  const transitLongitudes = computePlanetLongitudes(transitDate);
  const transitInfo = {};
  Object.keys(transitLongitudes).forEach(name => { transitInfo[name] = deriveKpLords(transitLongitudes[name]); });

  const eventSignificatorPlanets = [...new Set(
    eventDef.requiredHouses.flatMap(h => (significators[h] ? significators[h].allSignificators : []))
  )];

  // (a) Transit -> Natal Significator: a transiting planet is itself an event significator.
  const significatorHits = Object.keys(transitInfo).filter(name => eventSignificatorPlanets.includes(name));
  const sigScore = Math.round(weights.transitSignificator * Math.min(1, significatorHits.length / 2));

  // Relevant cusps for this event = required + supporting houses.
  const relevantHouses = [...new Set([...eventDef.requiredHouses, ...eventDef.supportingHouses])];
  const relevantCusps = relevantHouses.map(h => natalCusps.find(c => Number(c.house) === h)).filter(Boolean);

  // (b) Transit -> Relevant Cusp: a transiting planet is currently in the same sign as that cusp.
  const cuspSignHits = relevantCusps.filter(cusp =>
    Object.values(transitInfo).some(info => info.sign === cusp.sign));
  const cuspScore = Math.round(weights.transitCusp * (relevantCusps.length ? cuspSignHits.length / relevantCusps.length : 0));

  // (c) Transit Star Lord: a transiting planet is currently passing through a nakshatra
  // ruled by one of the relevant cusps' own star lords.
  const starLordHits = relevantCusps.filter(cusp => cusp.starLord &&
    Object.values(transitInfo).some(info => info.starLord === cusp.starLord));
  const starScore = Math.round(weights.transitStarLord * (relevantCusps.length ? starLordHits.length / relevantCusps.length : 0));

  // (d) Transit Sub Lord: same idea for the cusp's KP sub lord.
  const subLordHits = relevantCusps.filter(cusp => cusp.subLord &&
    Object.values(transitInfo).some(info => info.subLord === cusp.subLord));
  const subScore = Math.round(weights.transitSubLord * (relevantCusps.length ? subLordHits.length / relevantCusps.length : 0));

  return {
    score: sigScore + cuspScore + starScore + subScore,
    maxScore: weights.transitSignificator + weights.transitCusp + weights.transitStarLord + weights.transitSubLord,
    breakdown: {
      significator: { score: sigScore, max: weights.transitSignificator, hits: significatorHits },
      cusp: { score: cuspScore, max: weights.transitCusp, hits: cuspSignHits.map(c => c.house) },
      starLord: { score: starScore, max: weights.transitStarLord, hits: starLordHits.map(c => c.house) },
      subLord: { score: subScore, max: weights.transitSubLord, hits: subLordHits.map(c => c.house) }
    }
  };
}

// --- Section: Combined Scoring (one candidate date/time) ---
// natal: { planets, cusps, significators, dashaResult } — built once per search, reused across all candidates.
function scoreCandidate(eventKey, natal, date, weights, thresholds) {
  const eventDef = EVENT_RULES[eventKey];
  weights = weights || EVENT_TIMING_WEIGHTS;
  thresholds = thresholds || EVENT_TIMING_THRESHOLDS;

  const promise = scorePromise(eventDef, natal.significators, weights);
  const runningLords = findActivePeriod(natal.dashaResult, date) || {};
  const dba = scoreDba(eventDef, natal.significators, runningLords, weights);
  const transit = scoreTransit(eventDef, natal.cusps, natal.significators, date, weights);

  const total = Math.min(100, promise.score + dba.score + transit.score);

  const positiveFactors = [];
  const negativeFactors = [];
  if (promise.bestPlanet) positiveFactors.push(`${promise.bestPlanet} signifies ${promise.housesConnected.join(', ')} of the required houses (${eventDef.requiredHouses.join(', ')}).`);
  dba.matched.forEach(m => {
    if (m.housesMatched.length) positiveFactors.push(`${m.role} lord ${m.lord} signifies house(s) ${m.housesMatched.join(', ')}.`);
    else negativeFactors.push(`${m.role} lord ${m.lord} does not signify any required house.`);
    if (m.opposingMatched.length) negativeFactors.push(`${m.role} lord ${m.lord} also signifies opposing house(s) ${m.opposingMatched.join(', ')}.`);
  });
  if (transit.breakdown.significator.hits.length) positiveFactors.push(`Transiting ${transit.breakdown.significator.hits.join(', ')} activate a natal event significator.`);
  if (transit.breakdown.cusp.hits.length) positiveFactors.push(`Transit activates relevant cusp(s): house ${transit.breakdown.cusp.hits.join(', ')}.`);
  if (transit.breakdown.starLord.hits.length) positiveFactors.push(`Transit star lord supports house(s) ${transit.breakdown.starLord.hits.join(', ')}.`);
  if (transit.breakdown.subLord.hits.length) positiveFactors.push(`Transit sub lord supports house(s) ${transit.breakdown.subLord.hits.join(', ')}.`);
  if (promise.conflictingHouse) negativeFactors.push(`${promise.bestPlanet} also signifies an opposing/obstruction house.`);

  return {
    date, eventKey, eventLabel: eventDef.label,
    total, classification: classify(total, thresholds),
    breakdown: { promise, dba, transit },
    runningLords, positiveFactors, negativeFactors,
    requiredHouses: eventDef.requiredHouses
  };
}

// Builds the reusable natal context once per search (significators + dasha),
// from the SAME planets/cusps/moonLongitude/birthDateTime already computed
// in the app's main Chart & Analysis tab — no re-calculation.
function buildNatalContext(planets, cusps, moonLongitude, birthDateTime) {
  const significators = buildSignificators(planets, cusps);
  const dashaResult = computeVimshottariDasha(moonLongitude, birthDateTime, { levels: 4 });
  return { planets, cusps, significators, dashaResult };
}

// --- Section: Progressive Search ---

function midOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 15, 12, 0, 0));
}
function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Level 1: one score per month across [startDate, endDate).
function searchMonths(eventKey, natal, startDate, endDate, weights, thresholds) {
  const results = [];
  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  while (cursor < endDate) {
    const sample = scoreCandidate(eventKey, natal, midOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth()), weights, thresholds);
    results.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth(), ...sample });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return results;
}

// Level 2: one score per day for a given year/month.
function searchDays(eventKey, natal, year, monthIndex, weights, thresholds) {
  const total = daysInMonth(year, monthIndex);
  const results = [];
  for (let d = 1; d <= total; d++) {
    const date = new Date(Date.UTC(year, monthIndex, d, 12, 0, 0));
    results.push({ day: d, ...scoreCandidate(eventKey, natal, date, weights, thresholds) });
  }
  return results;
}

// Level 3: one score per hour for a given date (year/monthIndex/day).
function searchHours(eventKey, natal, year, monthIndex, day, weights, thresholds) {
  const results = [];
  for (let h = 0; h < 24; h++) {
    const date = new Date(Date.UTC(year, monthIndex, day, h, 0, 0));
    results.push({ hour: h, ...scoreCandidate(eventKey, natal, date, weights, thresholds) });
  }
  return results;
}

// --- Section: Window Detection ---
// Groups consecutive day-scores (from searchDays, in day order) at/above
// thresholdScore into windows, each with its peak day.
function detectWindows(dayScores, thresholdScore) {
  const windows = [];
  let current = null;
  dayScores.forEach(d => {
    if (d.total >= thresholdScore) {
      if (!current) current = { days: [] };
      current.days.push(d);
    } else if (current) {
      windows.push(finalizeWindow(current));
      current = null;
    }
  });
  if (current) windows.push(finalizeWindow(current));
  return windows;
}
function finalizeWindow(current) {
  const peak = current.days.reduce((best, d) => (d.total > best.total ? d : best), current.days[0]);
  return { startDay: current.days[0].day, endDay: current.days[current.days.length - 1].day, days: current.days, peak };
}

if (typeof module !== 'undefined') {
  module.exports = {
    EVENT_TIMING_LOGIC_TEXT, EVENT_TIMING_WEIGHTS, EVENT_TIMING_THRESHOLDS, classify,
    scorePromise, scoreDba, scoreTransit, scoreCandidate, buildNatalContext,
    searchMonths, searchDays, searchHours, detectWindows
  };
}
