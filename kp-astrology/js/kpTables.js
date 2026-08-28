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

if (typeof module !== 'undefined') {
  module.exports = {
    VIMSHOTTARI_SEQUENCE, VIMSHOTTARI_YEARS, VIMSHOTTARI_TOTAL_YEARS,
    NAKSHATRAS, NAKSHATRA_TABLE, SIGNS, SIGN_LORD,
    nakshatraFromLongitude, WEEKDAY_LORD
  };
}
