// Fixed KP/Vedic astrology reference tables (not user data).
// Vimshottari dasha sequence, in order, with total years (adds to 120).
const VIMSHOTTARI_SEQUENCE = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const VIMSHOTTARI_YEARS = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17
};
const VIMSHOTTARI_TOTAL_YEARS = 120;

// 27 nakshatras in zodiac order, each spanning 13°20' (800 arcmin), with ruling (star) lord.
// Sequence of star lords repeats the 9-planet Vimshottari cycle three times.
const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

function buildNakshatraTable() {
  const table = [];
  const span = 360 / 27; // 13.3333...
  for (let i = 0; i < 27; i++) {
    const lord = VIMSHOTTARI_SEQUENCE[i % 9];
    table.push({
      name: NAKSHATRAS[i],
      startDeg: i * span,
      endDeg: (i + 1) * span,
      starLord: lord
    });
  }
  return table;
}
const NAKSHATRA_TABLE = buildNakshatraTable();

// 12 zodiac signs in order, with their traditional ruling planet (owner/lordship for houses via cusp sign).
const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];
const SIGN_LORD = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter'
};

// Given an ecliptic longitude 0-360, find its nakshatra + star lord + elapsed fraction (for dasha balance).
function nakshatraFromLongitude(longitude) {
  const lon = ((longitude % 360) + 360) % 360;
  const entry = NAKSHATRA_TABLE.find(n => lon >= n.startDeg && lon < n.endDeg);
  if (!entry) return null;
  const elapsedFraction = (lon - entry.startDeg) / (entry.endDeg - entry.startDeg);
  return { ...entry, elapsedFraction };
}

// Weekday lord (Ruling Planets: day lord), 0=Sunday..6=Saturday matching JS Date.getDay().
const WEEKDAY_LORD = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

const PLANET_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

// Case/whitespace-tolerant lookup: builds a map from a normalized key
// (lowercased, spaces collapsed) to the canonical spelling.
function buildCanonicalLookup(names) {
  const map = {};
  names.forEach(name => { map[normalizeKey(name)] = name; });
  return map;
}
function normalizeKey(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const PLANET_LOOKUP = buildCanonicalLookup(PLANET_NAMES);
const SIGN_LOOKUP = buildCanonicalLookup(SIGNS);
const NAKSHATRA_LOOKUP = buildCanonicalLookup(NAKSHATRAS);

// Returns the canonical spelling for a planet name, tolerating case and
// stray whitespace (e.g. " rahu " -> "Rahu"). Returns the trimmed original
// unchanged if it doesn't match any known planet, so unrecognized input is
// preserved (and can be flagged) rather than silently dropped.
function canonicalPlanetName(value) {
  if (value === undefined || value === null || value === '') return value;
  return PLANET_LOOKUP[normalizeKey(value)] || String(value).trim();
}
function canonicalSignName(value) {
  if (value === undefined || value === null || value === '') return value;
  return SIGN_LOOKUP[normalizeKey(value)] || String(value).trim();
}
function canonicalNakshatraName(value) {
  if (value === undefined || value === null || value === '') return value;
  return NAKSHATRA_LOOKUP[normalizeKey(value)] || String(value).trim();
}
function isKnownPlanetName(value) {
  return !!PLANET_LOOKUP[normalizeKey(value)];
}
function isKnownSignName(value) {
  return !!SIGN_LOOKUP[normalizeKey(value)];
}

// Splits a 0-360° longitude into { sign, degree, minute, second } — degree is
// the whole-degree position WITHIN the sign (0-29), matching the standard
// Vedic/KP notation "12°34'56" Leo", not the raw 0-360 value. Handles the
// 59.5999...->60 rounding edge case by rolling over into the next minute/
// degree/sign rather than ever printing ":60".
function longitudeToDegMinSec(longitude) {
  const lon = ((Number(longitude) % 360) + 360) % 360;
  let signIndex = Math.floor(lon / 30);
  let degInSign = lon - signIndex * 30;

  let degree = Math.floor(degInSign);
  let minuteFloat = (degInSign - degree) * 60;
  let minute = Math.floor(minuteFloat);
  let second = Math.round((minuteFloat - minute) * 60);

  if (second === 60) { second = 0; minute += 1; }
  if (minute === 60) { minute = 0; degree += 1; }
  if (degree === 30) { degree = 0; signIndex = (signIndex + 1) % 12; }

  return { sign: SIGNS[signIndex], degree, minute, second };
}

// "12°34'56" Leo" — the standard display format for a zodiacal position.
function formatDegMinSec(longitude) {
  if (longitude === undefined || longitude === null || longitude === '' || isNaN(Number(longitude))) return '';
  const { sign, degree, minute, second } = longitudeToDegMinSec(longitude);
  const pad = n => String(n).padStart(2, '0');
  return `${degree}°${pad(minute)}'${pad(second)}" ${sign.slice(0, 3)}`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    VIMSHOTTARI_SEQUENCE, VIMSHOTTARI_YEARS, VIMSHOTTARI_TOTAL_YEARS,
    NAKSHATRAS, NAKSHATRA_TABLE, SIGNS, SIGN_LORD, PLANET_NAMES,
    longitudeToDegMinSec, formatDegMinSec,
    nakshatraFromLongitude, WEEKDAY_LORD,
    canonicalPlanetName, canonicalSignName, canonicalNakshatraName,
    isKnownPlanetName, isKnownSignName
  };
}
