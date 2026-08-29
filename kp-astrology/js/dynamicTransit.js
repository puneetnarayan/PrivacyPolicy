// Live transit table: all 9 planets' current sidereal positions (sign,
// nakshatra, star/sub/sub-sub lord, and house relative to the given
// location's Ascendant), continuously refreshed — plus a forward search for
// when each planet's sign/nakshatra/sub-lord/sub-sub-lord next changes, for
// a live countdown. Entirely offline, reusing the same ephemeris and
// Placidus cusp calculations as the rest of the app.

const DYNAMIC_TRANSIT_LOGIC_TEXT = [
  ['Dynamic Transit Table — Logic and Sequence'],
  [''],
  ['1. For the given location and the current moment, compute each of the 9 planets\' exact sidereal longitude (ephemeris.js) and the 12 Placidus house cusps (placidusCusps.js), the same way as the birth-chart Auto-Generate feature — just for "now" instead of a birth instant.'],
  ['2. Derive each planet\'s sign, nakshatra, star/sub/sub-sub lord from its longitude (kpSubLords.js), and its house by finding which cusp-to-cusp arc its longitude falls in.'],
  ['3. For the countdown panel, each planet\'s next sign/nakshatra/sub-lord/sub-sub-lord change is found the same forward-stepping-search-plus-binary-refine method used for the Live Ruling Planets\' Ascendant/Moon countdown (liveRulingPlanets.js), just applied to all 9 planets. Search step size and horizon are tuned per planet\'s typical speed — fine and short for the fast-moving Moon, coarser and much longer for slow outer planets (Jupiter, Saturn) and the lunar nodes (Rahu/Ketu), so a Saturn sign change (which can take over two years) is still found without an impractically long search.'],
  [''],
  ['Caveat: like the rest of this app\'s cusp/Ascendant math, this has not been cross-verified against a second trusted KP source in this offline environment. A planet stationing near a sign/nakshatra boundary can briefly move backward (retrograde) — the search still finds the next real crossing, but "next change" during a retrograde period can occasionally mean the planet re-entering a sign/nakshatra it was already in, not a new one; check the retrograde status when a countdown looks unexpectedly short.']
];

const ALL_PLANET_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

// Per-planet search plans (stepMs, maxSteps) per level, tuned to roughly that
// planet's zodiacal speed so a real change is found without excessive search.
const TRANSIT_SEARCH_PLAN = {
  Moon: {
    subSub: [300000, 1440], sub: [1800000, 1440], star: [3600000, 1440], sign: [7200000, 1440]
  },
  Sun: {
    subSub: [120000, 1440], sub: [600000, 1440], star: [1800000, 1440], sign: [14400000, 1440]
  },
  Mercury: {
    subSub: [120000, 1440], sub: [600000, 1440], star: [1800000, 1440], sign: [14400000, 1500]
  },
  Venus: {
    subSub: [120000, 1440], sub: [600000, 1440], star: [1800000, 1440], sign: [14400000, 1500]
  },
  Mars: {
    subSub: [120000, 1440], sub: [600000, 1440], star: [1800000, 1440], sign: [14400000, 1500]
  },
  Jupiter: {
    subSub: [600000, 1440], sub: [3600000, 1440], star: [21600000, 1440], sign: [86400000, 1460]
  },
  Saturn: {
    subSub: [600000, 1440], sub: [3600000, 1440], star: [21600000, 1440], sign: [86400000, 1460]
  },
  Rahu: {
    subSub: [600000, 1440], sub: [3600000, 1440], star: [21600000, 1440], sign: [86400000, 1460]
  },
  Ketu: {
    subSub: [600000, 1440], sub: [3600000, 1440], star: [21600000, 1440], sign: [86400000, 1460]
  }
};

function planetLongitudeFn(planetName) {
  return date => computeSingleLongitude(planetName, date);
}

// Returns [{ name, sign, nakshatra, starLord, subLord, subSubLord, house, longitude }, ...] for all 9 planets.
function computeTransitTable(date, latitude, longitude) {
  const cusps = computePlacidusCuspsSidereal(date, latitude, longitude);
  return ALL_PLANET_NAMES.map(name => {
    const lon = computeSingleLongitude(name, date);
    const lords = deriveKpLords(lon);
    return {
      name, sign: lords.sign, nakshatra: lords.nakshatra,
      starLord: lords.starLord, subLord: lords.subLord, subSubLord: lords.subSubLord,
      house: houseContainingLongitude(lon, cusps),
      longitude: lon
    };
  });
}

// Returns an array of { body, level, fromKey, toKey, changeAt } sorted soonest-first,
// across all 9 planets and all 4 levels (subSub/sub/star/sign).
function computeAllPlanetUpcomingChanges(date) {
  const results = [];
  ALL_PLANET_NAMES.forEach(name => {
    const fn = planetLongitudeFn(name);
    const plan = TRANSIT_SEARCH_PLAN[name];
    ['subSub', 'sub', 'star', 'sign'].forEach(level => {
      const [stepMs, maxSteps] = plan[level];
      const result = findNextChange(fn, level, date, stepMs, maxSteps);
      if (result) results.push({ body: name, level, ...result });
    });
  });
  results.sort((a, b) => a.changeAt.getTime() - b.changeAt.getTime());
  return results;
}

if (typeof module !== 'undefined') {
  module.exports = { DYNAMIC_TRANSIT_LOGIC_TEXT, ALL_PLANET_NAMES, computeTransitTable, computeAllPlanetUpcomingChanges };
}
