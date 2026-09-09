// Event Analysis tab: button-grid, multi-select event picker (independent,
// collapsible per-event result cards) over EVENT_RULES (eventRules.js,
// unchanged). Reuses eventTimingEngine.js's existing Promise/DBA/Transit
// scoring and progressive month->day search, dasha.js's
// computeVimshottariDasha/findActivePeriod, and fourStepTheory.js — no new
// astronomical calculation anywhere in this file.

const EVENT_ANALYSIS_LOGIC_TEXT = [
  ['Event Analysis — Logic and Sequence'],
  [''],
  ['1. SELECTION: click one or more event buttons (grouped by category); each selected event gets its own independent, collapsible result card below. Clicking a selected event again deselects it and removes ONLY that card.'],
  ['2. For each selected event: Event Promise (scorePromise, eventTimingEngine.js, unchanged), relevant houses/cusps, the strongest connecting planet, supporting vs. opposing significators, the relevant cusps\' own Sub/Star/Sub-Sub Lords, the Four-Step chain for the best-connecting planet (fourStepTheory.js, unchanged), CURRENT Dasha support (findActivePeriod against "now", dasha.js, unchanged), CURRENT Transit support (scoreTransit against "now", eventTimingEngine.js, unchanged), a plain-language Final Judgement (never a bare YES/NO), and future Timing Windows.'],
  ['3. TIMING WINDOWS: searches the chosen horizon (reusing searchMonths -> searchDays -> detectWindows, eventTimingEngine.js, unchanged) for windows at/above the "Favourable" threshold, each with its Dasha/Antardasha/Pratyantardasha lords and the native\'s AGE at the window\'s start and end (years-months-days-hours from the birth instant, kpMethodologyCommon.js\'s ageBreakdown()).'],
  [''],
  ['Caveat: a handful of event definitions eventRules.js does not yet have (a Health category, and a couple of Children-specific queries the original request named) are added here as a SEPARATE table (EXTRA_EVENT_RULES) merged only for THIS tab and Comparative Analysis — eventRules.js itself, and every other tab that reads it (Event Timing, Horary Prediction, Cuspal Interlinks), are completely unchanged. Final Judgement uses non-absolute language (Strongly/Moderately/Weakly Supported, Mixed/Conditional, Not Supported) — never a bare prediction that an event "will happen".']
];

// Additive-only: new event keys not already in EVENT_RULES, for the
// Children/Health categories the original request named. eventRules.js is
// NOT edited — this is a separate object, merged at read time below.
const EXTRA_EVENT_RULES = {
  conception: { label: 'Conception', category: 'Children', requiredHouses: [2, 5, 11], supportingHouses: [9], opposingHouses: [1, 4, 12], topicCuspHouse: 5 },
  child_education: { label: "Child's Education", category: 'Children', requiredHouses: [2, 4, 5, 11], supportingHouses: [9], opposingHouses: [3, 8, 12], topicCuspHouse: 5 },
  health_issue: { label: 'Health Issue', category: 'Health', requiredHouses: [6, 8, 12], supportingHouses: [], opposingHouses: [1, 5, 11], topicCuspHouse: 6 },
  hospitalization: { label: 'Hospitalization', category: 'Health', requiredHouses: [6, 8, 12], supportingHouses: [], opposingHouses: [1], topicCuspHouse: 8 },
  recovery: { label: 'Recovery', category: 'Health', requiredHouses: [1, 6, 11], supportingHouses: [5], opposingHouses: [8, 12], topicCuspHouse: 6 }
};

const ALL_EVENT_RULES = Object.assign({}, EVENT_RULES, EXTRA_EVENT_RULES);
const ALL_EVENT_CATEGORIES = [...new Set(Object.values(ALL_EVENT_RULES).map(e => e.category))];

function eventKeysByCategory() {
  const byCategory = {};
  Object.keys(ALL_EVENT_RULES).forEach(key => {
    const cat = ALL_EVENT_RULES[key].category;
    (byCategory[cat] = byCategory[cat] || []).push(key);
  });
  return byCategory;
}

// Timing windows (Section 17-18): reuses eventTimingEngine.js's
// progressive month -> day search + detectWindows unchanged. Scoped to a
// practical horizon (samples one point per month, then only the top 3
// months get a full daily pass) rather than every day of a multi-year
// search, matching the existing Event Timing tab's own approach.
//
// IMPORTANT: eventTimingEngine.js's scoreCandidate() looks up the event by
// key directly in EVENT_RULES internally (`EVENT_RULES[eventKey]`), so it
// can only search events that are ACTUALLY registered there — it has no
// way to see this file's separately-merged EXTRA_EVENT_RULES. Rather than
// mutate the shared EVENT_RULES object (which would leak these 5 extra
// events into every other tab that reads it — Event Timing, Horary,
// Cuspal Interlinks — silently widening their behavior), timing windows
// are simply not computed for an EXTRA_EVENT_RULES-only event; Promise/
// DBA/Transit above are unaffected since those are called with the
// eventDef object directly, not by key.
function findEventTimingWindows(eventKey, natal, years) {
  if (!EVENT_RULES[eventKey]) return null; // not searchable — see note above
  const start = new Date();
  const end = new Date(Date.UTC(start.getUTCFullYear() + years, start.getUTCMonth(), start.getUTCDate()));
  const monthScores = searchMonths(eventKey, natal, start, end, EVENT_TIMING_WEIGHTS, EVENT_TIMING_THRESHOLDS);
  const topMonths = [...monthScores].sort((a, b) => b.total - a.total).slice(0, 3);
  const favourableThreshold = EVENT_TIMING_THRESHOLDS.find(t => t.label === 'Favourable').min;

  const windows = [];
  topMonths.forEach(m => {
    const dayScores = searchDays(eventKey, natal, m.year, m.month, EVENT_TIMING_WEIGHTS, EVENT_TIMING_THRESHOLDS);
    windows.push(...detectWindows(dayScores, favourableThreshold));
  });
  return windows.sort((a, b) => b.peak.total - a.peak.total);
}

// One event's full analysis (Section 14), for the CURRENTLY LOADED chart.
function analyzeEventFull(eventKey, chartData, birthDateTime, searchYears) {
  const eventDef = ALL_EVENT_RULES[eventKey];
  const { planets, cusps, significators } = chartData;

  const moonPlanet = findPlanetRecord(planets, 'Moon');
  const moonLon = moonPlanet ? parseFloat(moonPlanet.longitude) : NaN;
  const dashaResult = (!isNaN(moonLon) && birthDateTime) ? computeVimshottariDasha(moonLon, birthDateTime, { levels: 4 }) : null;
  const natal = { planets, cusps, significators, dashaResult };

  const promise = scorePromise(eventDef, significators, EVENT_TIMING_WEIGHTS);
  const now = new Date();
  const runningLords = dashaResult ? (findActivePeriod(dashaResult, now) || {}) : {};
  const dba = dashaResult ? scoreDba(eventDef, significators, runningLords, EVENT_TIMING_WEIGHTS) : null;
  const transit = scoreTransit(eventDef, cusps, significators, now, EVENT_TIMING_WEIGHTS);

  const relevantCusps = [...new Set([eventDef.topicCuspHouse, ...eventDef.requiredHouses])]
    .map(h => cusps.find(c => Number(c.house) === h)).filter(Boolean);

  const bestPlanetRecord = promise.bestPlanet ? findPlanetRecord(planets, promise.bestPlanet) : null;
  const fourStepChain = bestPlanetRecord ? analyzeFourStepPlanet(bestPlanetRecord, chartData) : null;

  const opposingSignificators = eventDef.opposingHouses
    .flatMap(h => significators[h] ? significators[h].allSignificators : [])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const overallFraction = Math.min(1,
    (promise.score / (promise.maxScore || 1)) * 0.6 +
    (dba ? (dba.score / (dba.maxScore || 1)) * 0.2 : 0) +
    (transit.score / (transit.maxScore || 1)) * 0.2
  );
  const judgement = judgementLanguage(overallFraction);

  const rawWindows = (dashaResult && birthDateTime) ? findEventTimingWindows(eventKey, natal, searchYears || 3) : null;
  const windows = rawWindows ? rawWindows.map(w => ({
    ...w,
    ageAtStart: ageBreakdown(birthDateTime, w.days[0].date),
    ageAtEnd: ageBreakdown(birthDateTime, w.days[w.days.length - 1].date)
  })) : [];

  return {
    eventKey, eventDef, promise, dba, transit, runningLords,
    relevantCusps, fourStepChain, opposingSignificators,
    judgement, overallFraction, windows,
    windowsAvailable: !!(dashaResult && birthDateTime),
    // null (not just an empty array) means the shared search engine can't
    // look up this event by key at all (an EXTRA_EVENT_RULES-only event) —
    // shown to the user as a distinct, honest reason, not "no window found".
    windowsSearchable: rawWindows !== null
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    EVENT_ANALYSIS_LOGIC_TEXT, EXTRA_EVENT_RULES, ALL_EVENT_RULES, ALL_EVENT_CATEGORIES,
    eventKeysByCategory, findEventTimingWindows, analyzeEventFull
  };
}
