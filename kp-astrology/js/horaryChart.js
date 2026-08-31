// Casts a KP Horary chart: the 1st cusp (Lagna) is fixed to the horary
// number's Ascendant longitude (horaryTable.js); the other 11 cusps are
// derived by computing the REAL Placidus house framework for the moment of
// judgment (same placidusCusps.js used for natal charts) and ROTATING that
// whole framework so its own cusp 1 lands on the horary Ascendant —
// preserving the real relative spacing between houses. Planets are the
// REAL positions at the moment of judgment (ephemeris.js), untouched.
//
// This "rotate the real house framework to the horary Ascendant" approach
// is one documented, practical KP horary convention — reuses 100% existing,
// already-verified calculation code (no new astronomical calculation is
// introduced here), rather than inventing a new house-computation method.

const HORARY_CHART_LOGIC_TEXT = [
  ['KP Horary Chart Casting — Logic and Sequence'],
  [''],
  ['1. Horary Ascendant: looked up from the horary number (horaryTable.js).'],
  ['2. Real house framework: the actual Placidus cusps for the moment of judgment (date/time the question is being analyzed) and the querent\'s location, using the SAME placidusCusps.js already used for natal charts.'],
  ['3. Rotation: every real cusp is shifted by the same offset (horary Ascendant minus the real 1st cusp), so cusp 1 lands exactly on the horary Ascendant while every other cusp keeps its real angular distance from cusp 1 — preserving the real Placidus house proportions rather than using equal 30° houses.'],
  ['4. Planets: real sidereal longitudes at the moment of judgment (ephemeris.js) — completely unrotated, exactly as they actually are in the sky right now.'],
  ['5. Each rotated cusp and each planet then gets its sign/nakshatra/pada/star lord/sub lord/sub-sub lord derived the normal way (kpSubLords.js), and each planet is assigned to the house whose (rotated) cusp range contains it (autoChart.js\'s houseContainingLongitude, reused unchanged).'],
  [''],
  ['Caveat: this rotation technique is one documented, practical KP horary convention, not the only one described in KP literature — some practitioners instead re-derive full Placidus cusps directly from the horary Ascendant using an assumed local sidereal time. This app uses the rotation method because it reuses already-verified calculation code exactly and avoids inventing a new time-from-ascendant inversion. Revisit if your own practice differs.']
];

function rotateCuspLongitudes(realCusps, horaryAscendant) {
  const offset = normalizeDegrees(horaryAscendant - realCusps[1]);
  const rotated = {};
  for (let h = 1; h <= 12; h++) rotated[h] = normalizeDegrees(realCusps[h] + offset);
  return rotated;
}

// horaryNumber: 1-243 (see horaryTable.js). judgmentUtc: JS Date (UTC instant)
// the question is being analyzed. latitude/longitude: querent's location,
// degrees, east positive.
function castHoraryChart(horaryNumber, judgmentUtc, latitude, longitude) {
  const numberInfo = horaryNumberInfo(horaryNumber);
  if (!numberInfo) {
    throw new Error(`Horary number ${horaryNumber} is out of the currently supported range (${HORARY_NUMBER_MIN}-${HORARY_NUMBER_MAX}). See the Horary Number Table logic notes.`);
  }
  const horaryAscendant = numberInfo.midpointDeg;

  const realCusps = computePlacidusCuspsSidereal(judgmentUtc, latitude, longitude);
  const rotatedCuspLongitudes = rotateCuspLongitudes(realCusps, horaryAscendant);

  const cusps = [];
  for (let h = 1; h <= 12; h++) {
    const lords = deriveKpLords(rotatedCuspLongitudes[h]);
    cusps.push({
      house: h, sign: lords.sign, nakshatra: lords.nakshatra, pada: lords.pada,
      starLord: lords.starLord, subLord: lords.subLord, subSubLord: lords.subSubLord,
      longitude: Number(rotatedCuspLongitudes[h].toFixed(4))
    });
  }

  const planetLongitudes = computePlanetLongitudes(judgmentUtc);
  const planets = Object.keys(planetLongitudes).map(name => {
    const lon = planetLongitudes[name];
    const lords = deriveKpLords(lon);
    return {
      name, sign: lords.sign, nakshatra: lords.nakshatra, pada: lords.pada,
      house: houseContainingLongitude(lon, rotatedCuspLongitudes),
      starLord: lords.starLord, subLord: lords.subLord, subSubLord: lords.subSubLord,
      longitude: Number(lon.toFixed(4))
    };
  });

  return { horaryNumber: numberInfo.number, horaryAscendant, numberInfo, planets, cusps, judgmentUtc, latitude, longitude };
}

if (typeof module !== 'undefined') {
  module.exports = { HORARY_CHART_LOGIC_TEXT, castHoraryChart, rotateCuspLongitudes };
}
