// Ties ephemeris.js + placidusCusps.js + kpSubLords.js together into one
// call: given a birth UTC instant and place, produce a full Planets + Cusps
// data set in the exact shape the rest of the app already consumes — the
// same shape you'd otherwise type in by hand or upload as Excel.

const AUTO_CHART_LOGIC_TEXT = [
  ['Auto-Generate Chart — Logic and Sequence'],
  [''],
  ['1. Compute each of the 9 planets\' exact sidereal longitude at the birth UTC instant (ephemeris.js).'],
  ['2. Compute the 12 Placidus house cusp longitudes, sidereal, for the birth UTC instant and place (placidusCusps.js).'],
  ['3. For each planet and each cusp, derive sign / nakshatra / star lord / sub lord / sub-sub lord from its longitude (kpSubLords.js).'],
  ['4. Assign each planet to the house whose cusp range contains its longitude (houses are the zodiacal arcs between consecutive cusps, in cusp order).'],
  ['5. Retrograde: Mercury, Venus, Mars, Jupiter, and Saturn are flagged retrograde if their longitude one day later is behind (not ahead of) their longitude now. Rahu and Ketu are always marked retrograde, per standard Vedic convention (the lunar nodes only ever move backward through the zodiac). The Sun and Moon are never retrograde.'],
  [''],
  ['This produces a complete starting chart in one step. Everything it fills in remains a normal, editable row in the Planets/Cusps tables afterward — review and correct it like any manually-entered or uploaded chart before relying on it.']
];

function longitudeInWrappingRange(longitude, startDeg, endDeg) {
  if (startDeg <= endDeg) return longitude >= startDeg && longitude < endDeg;
  return longitude >= startDeg || longitude < endDeg;
}

function houseContainingLongitude(longitude, cuspLongitudes) {
  for (let h = 1; h <= 12; h++) {
    const nextH = h === 12 ? 1 : h + 1;
    if (longitudeInWrappingRange(longitude, cuspLongitudes[h], cuspLongitudes[nextH])) return h;
  }
  return null;
}

function isRetrogradeNow(bodyName, date) {
  if (bodyName === 'Sun' || bodyName === 'Moon') return false;
  if (bodyName === 'Rahu' || bodyName === 'Ketu') return true;
  const now = computePlanetLongitudes(date)[bodyName];
  const later = computePlanetLongitudes(new Date(date.getTime() + 86400000))[bodyName];
  const forwardMotion = ((later - now + 540) % 360) - 180; // signed shortest delta
  return forwardMotion < 0;
}

// birthDateUtc: JS Date (UTC instant). latitude/longitude: degrees, east positive.
function generateChart(birthDateUtc, latitude, longitude) {
  const planetLongitudes = computePlanetLongitudes(birthDateUtc);
  const cuspLongitudes = computePlacidusCuspsSidereal(birthDateUtc, latitude, longitude);

  const cusps = [];
  for (let h = 1; h <= 12; h++) {
    const lords = deriveKpLords(cuspLongitudes[h]);
    cusps.push({
      house: h, sign: lords.sign, nakshatra: lords.nakshatra, pada: lords.pada,
      starLord: lords.starLord, subLord: lords.subLord, subSubLord: lords.subSubLord,
      longitude: Number(cuspLongitudes[h].toFixed(4))
    });
  }

  const planets = Object.keys(planetLongitudes).map(name => {
    const lon = planetLongitudes[name];
    const lords = deriveKpLords(lon);
    return {
      name, sign: lords.sign, nakshatra: lords.nakshatra, pada: lords.pada,
      house: houseContainingLongitude(lon, cuspLongitudes),
      starLord: lords.starLord, subLord: lords.subLord, subSubLord: lords.subSubLord,
      retrograde: isRetrogradeNow(name, birthDateUtc),
      longitude: Number(lon.toFixed(4))
    };
  });

  return { planets, cusps, moonLongitude: planetLongitudes.Moon };
}

if (typeof module !== 'undefined') {
  module.exports = { AUTO_CHART_LOGIC_TEXT, generateChart, houseContainingLongitude };
}
