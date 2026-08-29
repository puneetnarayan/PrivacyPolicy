// Live Ruling Planets at the astrologer's own location (for horary/prashna
// consultation), plus a forward search for exactly when each component of
// the Ruling Planets (Ascendant sign/star/sub/sub-sub lord, Moon
// sign/star/sub/sub-sub lord) will next change — so a countdown can be shown.
// Entirely offline: only needs the astrologer's latitude/longitude and the
// current (or any chosen) moment.

const LIVE_RP_LOGIC_TEXT = [
  ['Live Ruling Planets — Logic and Sequence'],
  [''],
  ['1. The Ascendant at the astrologer\'s location, right now, is computed the same way as a birth Ascendant (placidusCusps.js\'s fast Ascendant formula) — using the current moment instead of a birth instant.'],
  ['2. Sign/star/sub/sub-sub lord of that Ascendant, and of the Moon\'s current position, are derived the same way as anywhere else in this app (kpSubLords.js).'],
  ['3. Day Lord uses the current weekday. All Ruling Planets = the de-duplicated union, exactly as in the birth-chart Ruling Planets section.'],
  ['4. "Next change" for each of those 8 components (Ascendant sign/star/sub/sub-sub, Moon sign/star/sub/sub-sub) is found by a forward stepping search: repeatedly sample that body\'s longitude a little further into the future until its sign/nakshatra/sub-lord/sub-sub-lord differs from now, then binary-search the exact crossing instant to within a second. The Ascendant moves fast (roughly 1° every 4 minutes, but at a rate that varies with latitude and time of day), so its sub-sub-lord can change every few minutes; the Moon moves far slower (about half a degree per hour), so its components change over hours to days.'],
  [''],
  ['Caveat: like the rest of this app\'s Ascendant/cusp math, this has not been cross-verified against a second trusted KP source in this offline environment — treat exact change times as close estimates pending that verification.']
];

function normalizeAngleDiff(deg) {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

function segmentKeyForLevel(longitude, level) {
  const lords = deriveKpLords(longitude);
  if (level === 'sign') return lords.sign;
  if (level === 'star') return lords.nakshatra;
  if (level === 'sub') return lords.nakshatra + '|' + lords.subLord;
  return lords.nakshatra + '|' + lords.subLord + '|' + lords.subSubLord; // 'subSub'
}

// Forward stepping search + binary refine for when `getLongitude(date)`'s
// segment (at `level`) next differs from its value at `fromDate`.
// stepMs/maxSteps controls resolution vs. how far ahead to search.
function findNextChange(getLongitude, level, fromDate, stepMs, maxSteps) {
  const startKey = segmentKeyForLevel(getLongitude(fromDate), level);
  let prev = fromDate;
  for (let i = 1; i <= maxSteps; i++) {
    const candidate = new Date(fromDate.getTime() + i * stepMs);
    const key = segmentKeyForLevel(getLongitude(candidate), level);
    if (key !== startKey) {
      let lo = prev.getTime(), hi = candidate.getTime();
      for (let b = 0; b < 20 && hi - lo > 1000; b++) {
        const mid = Math.floor((lo + hi) / 2);
        const midKey = segmentKeyForLevel(getLongitude(new Date(mid)), level);
        if (midKey === startKey) lo = mid; else hi = mid;
      }
      return { fromKey: startKey, toKey: key, changeAt: new Date(hi) };
    }
    prev = candidate;
  }
  return null;
}

function ascendantLongitudeFn(latitude, longitude) {
  return date => computeAscendantSidereal(date, latitude, longitude);
}
function moonLongitudeFn() {
  return date => computeSingleLongitude('Moon', date);
}

// Returns { dayLord, ascendantLords, moonLords, allRulingPlanets, ascendantLongitude, moonLongitude }
function computeLiveRulingPlanets(date, latitude, longitude) {
  const ascLon = computeAscendantSidereal(date, latitude, longitude);
  const moonLon = computeSingleLongitude('Moon', date);
  const ascLords = deriveKpLords(ascLon);
  const moonLords = deriveKpLords(moonLon);

  const ascendant = { sign: ascLords.sign, starLord: ascLords.starLord, subLord: ascLords.subLord };
  const moon = { sign: moonLords.sign, starLord: moonLords.starLord, subLord: moonLords.subLord };
  const rp = buildRulingPlanets(date, ascendant, moon);

  return {
    dayLord: rp.dayLord,
    ascendant: ascLords,
    moon: moonLords,
    allRulingPlanets: rp.allRulingPlanets,
    ascendantLongitude: ascLon,
    moonLongitude: moonLon
  };
}

// Search windows tuned per level: (stepMs, maxSteps) — small/fast for
// Ascendant's fine subdivisions, coarser/longer for the Moon's slow ones.
const SEARCH_PLAN = {
  ascendant: {
    subSub: [5000, 720],      // up to 1 hour, 5s steps
    sub: [15000, 1440],       // up to 6 hours, 15s steps
    star: [60000, 1440],      // up to 24 hours, 1min steps
    sign: [120000, 1440]      // up to 48 hours, 2min steps
  },
  moon: {
    subSub: [300000, 1440],   // up to 5 days, 5min steps
    sub: [1800000, 1440],     // up to 30 days, 30min steps
    star: [3600000, 1440],    // up to 60 days, 1hr steps
    sign: [7200000, 1440]     // up to 120 days, 2hr steps
  }
};

// Returns an array of { body, level, fromKey, toKey, changeAt } sorted soonest-first.
function getUpcomingChanges(date, latitude, longitude) {
  const ascFn = ascendantLongitudeFn(latitude, longitude);
  const moonFn = moonLongitudeFn();
  const results = [];

  ['subSub', 'sub', 'star', 'sign'].forEach(level => {
    const [stepMs, maxSteps] = SEARCH_PLAN.ascendant[level];
    const result = findNextChange(ascFn, level, date, stepMs, maxSteps);
    if (result) results.push({ body: 'Ascendant', level, ...result });
  });
  ['subSub', 'sub', 'star', 'sign'].forEach(level => {
    const [stepMs, maxSteps] = SEARCH_PLAN.moon[level];
    const result = findNextChange(moonFn, level, date, stepMs, maxSteps);
    if (result) results.push({ body: 'Moon', level, ...result });
  });

  results.sort((a, b) => a.changeAt.getTime() - b.changeAt.getTime());
  return results;
}

if (typeof module !== 'undefined') {
  module.exports = { LIVE_RP_LOGIC_TEXT, computeLiveRulingPlanets, getUpcomingChanges, findNextChange };
}
