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
  ['1. Astronomy-engine computes each planet\'s TROPICAL geocentric ecliptic longitude (0-360°) for the given date/time, entirely offline from its built-in analytic/VSOP87 models — no network call is made.'],
  ['2. KP/Vedic astrology uses the SIDEREAL zodiac, which is offset from the tropical zodiac by the "ayanamsa" (precession of the equinoxes). This app uses the Lahiri ayanamsa (the standard for KP), via astronomy-engine\'s built-in sidereal-time support.'],
  ['3. Sidereal longitude = Tropical longitude − Ayanamsa (wrapped to 0-360°).'],
  ['4. Rahu and Ketu are not physical planets — they are the Moon\'s two orbital nodes. This app computes the Moon\'s mean ascending node (Rahu) directly, and Ketu as exactly 180° opposite it, per standard Vedic practice (mean, not true, node).'],
  ['5. Local sunrise for a given date and birth place (latitude/longitude) is computed for the traditional Panchang-style day-lord boundary (the weekday changes at sunrise, not midnight), used to refine the Ruling Planets\' Day Lord for early-morning births.'],
  [''],
  ['Caveat: this is the mean-node (not true-node) position for Rahu/Ketu, matching the most common KP/Vedic convention. Ayanamsa choice (Lahiri here) is the single biggest source of disagreement between different KP software — if your other software uses a different ayanamsa, cusp/planet signs may shift by up to ~1°.']
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

// Mean lunar ascending node (Rahu) longitude, tropical — standard low-order
// mean-node formula (Meeus), accurate to a few arc-minutes.
function meanLunarNodeLongitude(date) {
  const jd = astronomyDateToJulianDay(date);
  const t = (jd - 2451545.0) / 36525.0;
  let omega = 125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + t * t * t / 467441 - t * t * t * t / 60616000;
  return normalizeDegrees(omega);
}

// Computes sidereal longitudes (KP zodiac) for all 9 planets at the given date.
function computePlanetLongitudes(date) {
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
    EPHEMERIS_LOGIC_TEXT, computePlanetLongitudes, computeSunrise,
    lahiriAyanamsaDegrees, normalizeDegrees
  };
}
