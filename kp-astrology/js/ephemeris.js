// Local (offline) ephemeris, backed by the astronomy-engine library bundled
// in astronomy.browser.min.js. No internet connection is used or required —
// everything here runs against VSOP87/analytic models shipped in that file,
// the same way the rest of this app keeps all chart data on the page.
//
// Provides exact sidereal longitudes for the 9 KP "planets" (7 classical +
// Rahu/Ketu as the Moon's mean lunar nodes), plus local sunrise — the extra
// precision needed for combustion, conjunction, aspect, and transit checks
// that sign/nakshatra-only data can't support.

const EPHEMERIS_LOGIC_TEXT = [
  ['Ephemeris — Logic and Sequence'],
  [''],
  ['0. PRIMARY ENGINE: the real Swiss Ephemeris, compiled to WebAssembly (js/swissephBridge.js), is used whenever it has finished loading (window.SWISSEPH_READY). It typically finishes loading within a fraction of a second of the page opening. Only if it is still loading, or failed to load at all, does this file\'s own astronomy-engine-based calculation below run instead, as an automatic, seamless fallback — you are not asked to do anything differently either way.'],
  ['1. [Fallback engine] Astronomy-engine computes each planet\'s TROPICAL geocentric ecliptic longitude (0-360°) for the given date/time, entirely offline from its built-in analytic/VSOP87 models — no network call is made.'],
  ['2. KP/Vedic astrology uses the SIDEREAL zodiac, which is offset from the tropical zodiac by the "ayanamsa" (precession of the equinoxes). This app uses the Lahiri ayanamsa (the standard for KP) in both engines.'],
  ['3. [Fallback engine] Sidereal longitude = Tropical longitude − Ayanamsa (wrapped to 0-360°). Swiss Ephemeris computes this natively via its own sidereal mode instead.'],
  ['4. Rahu and Ketu are not physical planets — they are the Moon\'s two orbital nodes. This app computes the MEAN ascending node (Rahu) — the smoothed, long-term-average node position, per standard KP practice (as taught by K.S. Krishnamurti and used in most KP software) — rather than the instantaneous true node. Ketu is exactly 180° opposite it.'],
  ['5. Local sunrise for a given date and birth place (latitude/longitude) is computed for the traditional Panchang-style day-lord boundary (the weekday changes at sunrise, not midnight), used to refine the Ruling Planets\' Day Lord for early-morning births.'],
  [''],
  ['Caveat: Ayanamsa choice (Lahiri here) is the single biggest source of disagreement between different KP software — if your other software uses a different ayanamsa, cusp/planet signs may shift by up to ~1°. Swiss Ephemeris here is licensed AGPL-3.0-or-later — fine for this app\'s personal, single-user, non-distributed use, but revisit before ever sharing or hosting this app for others.']
];

// astronomy-engine's LAHIRI-equivalent ayanamsa isn't exposed as a named
// constant; we compute it via its sidereal-time-adjacent helper: the
// difference between the tropical and Lahiri sidereal position of a fixed
// reference is handled internally by Astronomy.SiderealTime for the earth's
// rotation, not the ecliptic ayanamsa — so we implement the standard Lahiri
// ayanamsa formula directly (accurate to the arc-second level used in KP).
function lahiriAyanamsaDegrees(date) {
  const jd = astronomyDateToJulianDay(date);
  const t = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000.0
  // Standard Lahiri (Chitrapaksha) ayanamsa polynomial, referenced to J2000.0.
  const ayanamsaAtJ2000 = 23.85337988; // degrees, Lahiri ayanamsa at J2000.0
  const precessionRatePerCentury = 1.396042; // degrees/century (general precession)
  return ayanamsaAtJ2000 + precessionRatePerCentury * t;
}

function astronomyDateToJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function normalizeDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

const BODY_NAME_MAP = {
  Sun: 'Sun', Moon: 'Moon', Mars: 'Mars', Mercury: 'Mercury',
  Jupiter: 'Jupiter', Venus: 'Venus', Saturn: 'Saturn'
};

// Returns tropical geocentric ecliptic longitude (0-360°) for a classical body.
function tropicalLongitude(bodyName, date) {
  const vector = Astronomy.GeoVector(BODY_NAME_MAP[bodyName], date, true);
  const ecliptic = Astronomy.Ecliptic(vector);
  return normalizeDegrees(ecliptic.elon);
}

// Mean lunar ascending node (Rahu) longitude, tropical — the standard KP
// convention: a smoothed long-term formula (not the Moon's instantaneous,
// wobbling orbital plane), accurate to a few arc-minutes.
function meanLunarNodeLongitude(date) {
  const jd = astronomyDateToJulianDay(date);
  const t = (jd - 2451545.0) / 36525.0;
  const omega = 125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + t * t * t / 467441 - t * t * t * t / 60616000;
  return normalizeDegrees(omega);
}

// Computes sidereal longitudes (KP zodiac) for all 9 planets at the given date.
// Uses real Swiss Ephemeris once it's loaded (see swissephBridge.js); falls
// back to the astronomy-engine calculation below if it's still loading or
// failed to load.
function computePlanetLongitudes(date) {
  if (typeof window !== 'undefined' && window.SWISSEPH_READY) {
    return window.swePlanetLongitudes(date);
  }
  const ayanamsa = lahiriAyanamsaDegrees(date);
  const result = {};
  Object.keys(BODY_NAME_MAP).forEach(name => {
    result[name] = normalizeDegrees(tropicalLongitude(name, date) - ayanamsa);
  });
  const rahuTropical = meanLunarNodeLongitude(date);
  result.Rahu = normalizeDegrees(rahuTropical - ayanamsa);
  result.Ketu = normalizeDegrees(result.Rahu + 180);
  return result;
}

// Sidereal longitude of a single body — cheaper than computePlanetLongitudes()
// when only one body is needed repeatedly (e.g. a stepping search over time).
// Same Swiss-Ephemeris-first, astronomy-engine-fallback behavior as above.
function computeSingleLongitude(bodyName, date) {
  if (typeof window !== 'undefined' && window.SWISSEPH_READY) {
    return window.sweSingleLongitude(bodyName, date);
  }
  const ayanamsa = lahiriAyanamsaDegrees(date);
  if (bodyName === 'Rahu') return normalizeDegrees(meanLunarNodeLongitude(date) - ayanamsa);
  if (bodyName === 'Ketu') return normalizeDegrees(meanLunarNodeLongitude(date) - ayanamsa + 180);
  return normalizeDegrees(tropicalLongitude(bodyName, date) - ayanamsa);
}

// Computes local sunrise (as a JS Date, UTC-based) for a given calendar date
// and location. Falls back to null if the sun doesn't rise that day (polar).
function computeSunrise(date, latitude, longitude) {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const sunrise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, startOfDay, 1);
  return sunrise ? sunrise.date : null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    EPHEMERIS_LOGIC_TEXT, computePlanetLongitudes, computeSingleLongitude, computeSunrise,
    lahiriAyanamsaDegrees, normalizeDegrees
  };
}
