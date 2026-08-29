// Placidus house cusps — the house system KP traditionally uses — computed
// from birth date/time (UTC) + geographic latitude/longitude, entirely
// offline via astronomy-engine's sidereal-time and obliquity routines.

const PLACIDUS_LOGIC_TEXT = [
  ['Placidus House Cusps — Logic and Sequence'],
  [''],
  ['1. Compute GAST (Greenwich Apparent Sidereal Time) for the birth instant, then Local Sidereal Time by adding the birth place\'s geographic longitude (east positive). Converted to degrees, this is the ARMC (Right Ascension of the Midheaven).'],
  ['2. The Midheaven (10th cusp) and Ascendant (1st cusp) are computed directly from ARMC, the true obliquity of the ecliptic, and geographic latitude, using standard closed-form spherical astronomy formulas.'],
  ['3. Cusps 11, 12, 2, and 3 are Placidus-specific: each is defined by TIME, not degrees — the point on the ecliptic whose diurnal (11, 12) or nocturnal (2, 3) semi-arc has been trisected. This has no closed-form solution, so each is found by iterating: guess a longitude, compute its declination and "ascensional difference," derive the right ascension the point must have, convert back to a longitude, and repeat until it stops changing (a handful of iterations).'],
  ['4. Cusps 4-9 are exactly 180° opposite cusps 10-3 (a property of every quadrant house system, Placidus included), so they are mirrored rather than separately iterated.'],
  ['5. All cusps are computed in the tropical zodiac first, then converted to sidereal (KP\'s zodiac) by subtracting the same Lahiri ayanamsa used elsewhere in this app.'],
  [''],
  ['Caveat: Placidus cusp calculation is one of the more intricate pieces of classical astrology software, and this implementation has NOT been cross-checked against a second, independently-verified KP chart in this offline environment. Before relying on auto-generated cusps for real predictions, generate a chart for a birth you already have verified cusps for (from existing trusted KP software) and compare house-by-house. You can always override any auto-generated cusp by editing the Cusps table directly.'],
  ['Placidus cusps become unreliable or undefined at extreme latitudes (inside the polar circles) where the semi-arc trisection has no valid solution for some houses — this is a known limitation of the Placidus system itself, not specific to this implementation.']
];

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function normalizeAngleDiff(deg) {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

function raOfLongitude(lambdaDeg, epsDeg) {
  const l = toRad(lambdaDeg), e = toRad(epsDeg);
  return normalizeDegrees(toDeg(Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l))));
}
function decOfLongitude(lambdaDeg, epsDeg) {
  const l = toRad(lambdaDeg), e = toRad(epsDeg);
  return toDeg(Math.asin(Math.sin(e) * Math.sin(l)));
}
function longitudeOfRA(raDeg, epsDeg) {
  const ra = toRad(raDeg), e = toRad(epsDeg);
  return normalizeDegrees(toDeg(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(e))));
}
function ascensionalDifference(decDeg, latDeg) {
  const arg = Math.max(-1, Math.min(1, Math.tan(toRad(latDeg)) * Math.tan(toRad(decDeg))));
  return toDeg(Math.asin(arg));
}

// Fixed-point iteration for the Placidus semi-arc trisection.
function iteratePlacidusCusp(armcDeg, epsDeg, latDeg, targetRaOffsetFn, initialOffsetDeg) {
  let lambda = normalizeDegrees(armcDeg + initialOffsetDeg);
  for (let i = 0; i < 20; i++) {
    const dec = decOfLongitude(lambda, epsDeg);
    const ad = ascensionalDifference(dec, latDeg);
    const raTarget = normalizeDegrees(armcDeg + targetRaOffsetFn(ad));
    const nextLambda = longitudeOfRA(raTarget, epsDeg);
    if (Math.abs(normalizeAngleDiff(nextLambda - lambda)) < 1e-6) { lambda = nextLambda; break; }
    lambda = nextLambda;
  }
  return lambda;
}

function computeAscendant(armcDeg, epsDeg, latDeg) {
  const armc = toRad(armcDeg), e = toRad(epsDeg), lat = toRad(latDeg);
  const y = Math.cos(armc);
  const x = -(Math.sin(e) * Math.tan(lat) + Math.cos(e) * Math.sin(armc));
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}
function computeMidheaven(armcDeg, epsDeg) {
  const armc = toRad(armcDeg), e = toRad(epsDeg);
  return normalizeDegrees(toDeg(Math.atan2(Math.sin(armc), Math.cos(armc) * Math.cos(e))));
}

// Returns { 1: deg, 2: deg, ..., 12: deg } in the TROPICAL zodiac.
function computePlacidusCuspsTropical(armcDeg, epsDeg, latDeg) {
  const mc = computeMidheaven(armcDeg, epsDeg);
  const asc = computeAscendant(armcDeg, epsDeg, latDeg);
  const cusp11 = iteratePlacidusCusp(armcDeg, epsDeg, latDeg, ad => (1 / 3) * (90 + ad), 30);
  const cusp12 = iteratePlacidusCusp(armcDeg, epsDeg, latDeg, ad => (2 / 3) * (90 + ad), 60);
  const cusp2 = iteratePlacidusCusp(armcDeg, epsDeg, latDeg, ad => 180 - (2 / 3) * (90 - ad), 240);
  const cusp3 = iteratePlacidusCusp(armcDeg, epsDeg, latDeg, ad => 180 - (1 / 3) * (90 - ad), 270);

  const cusps = { 1: asc, 10: mc, 11: cusp11, 12: cusp12, 2: cusp2, 3: cusp3 };
  cusps[4] = normalizeDegrees(mc + 180);
  cusps[7] = normalizeDegrees(asc + 180);
  cusps[5] = normalizeDegrees(cusp11 + 180);
  cusps[6] = normalizeDegrees(cusp12 + 180);
  cusps[8] = normalizeDegrees(cusp2 + 180);
  cusps[9] = normalizeDegrees(cusp3 + 180);
  return cusps;
}

// Returns { 1: deg, ..., 12: deg } in the SIDEREAL (KP) zodiac, for the given
// birth UTC date/time and geographic latitude/longitude (degrees, east+).
function computePlacidusCuspsSidereal(date, latitude, longitude) {
  const gastHours = Astronomy.SiderealTime(date);
  const armc = normalizeDegrees((gastHours + longitude / 15) * 15);
  const eps = Astronomy.e_tilt(date).tobl;
  const tropical = computePlacidusCuspsTropical(armc, eps, latitude);
  const ayanamsa = lahiriAyanamsaDegrees(date);
  const sidereal = {};
  for (let h = 1; h <= 12; h++) sidereal[h] = normalizeDegrees(tropical[h] - ayanamsa);
  return sidereal;
}

// Ascendant only, sidereal — cheap (no iterative cusps), for repeated calls
// such as a live display or a stepping search over time.
function computeAscendantSidereal(date, latitude, longitude) {
  const gastHours = Astronomy.SiderealTime(date);
  const armc = normalizeDegrees((gastHours + longitude / 15) * 15);
  const eps = Astronomy.e_tilt(date).tobl;
  const ascTropical = computeAscendant(armc, eps, latitude);
  const ayanamsa = lahiriAyanamsaDegrees(date);
  return normalizeDegrees(ascTropical - ayanamsa);
}

if (typeof module !== 'undefined') {
  module.exports = {
    PLACIDUS_LOGIC_TEXT, computePlacidusCuspsTropical, computePlacidusCuspsSidereal,
    computeAscendantSidereal
  };
}
