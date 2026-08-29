// Visual D1 (Rasi), D9 (Navamsa), and KP charts — all rendered in the
// standard South Indian style (a fixed 4x4 grid where each sign always
// occupies the same cell, so a chart is read by which SIGN each planet is
// in, not by rotating house positions like the North Indian diamond style).
// This is purely a DISPLAY layer: it reuses the already-computed
// state.planets/state.cusps (sign, house, longitude, cuspal lords) — no new
// astronomical calculation except the one genuinely new piece, the
// Navamsa (D9) sign derivation, which is a standard, well-defined
// classical formula applied to the longitude ephemeris.js already computed.

const VEDIC_CHARTS_LOGIC_TEXT = [
  ['D1 / D9 / KP Charts — Logic and Sequence'],
  [''],
  ['1. Two selectable layouts, both standard: SOUTH INDIAN — a fixed 4x4 grid where each of the 12 signs always sits in the same cell; sign positions never rotate, only which house number lands in each sign changes. NORTH INDIAN — a diamond-in-square divided into 12 house-shaped regions in fixed SCREEN positions (house 1 always the top diamond, proceeding clockwise); here house positions never rotate, and instead the sign written inside each house rotates with the Ascendant.'],
  ['2. D1 (Rasi) Chart: South Indian places each planet in its natal sign\'s fixed cell. North Indian places each planet in its natal house\'s fixed position, with each house\'s cell labeled by counting signs forward from the Ascendant\'s sign one sign per house (the standard whole-sign convention North Indian charts use for the sign label, distinct from this app\'s Placidus cusps).'],
  ['3. D9 (Navamsa) Chart: each sign is divided into 9 equal parts of 3°20\' (a "navamsa"). Which sign a planet\'s navamsa falls in depends on the classical rule: for a movable sign (Aries/Cancer/Libra/Capricorn), navamsa counting starts from that same sign; for a fixed sign (Taurus/Leo/Scorpio/Aquarius), counting starts from the 9th sign from it; for a dual sign (Gemini/Virgo/Sagittarius/Pisces), counting starts from the 5th sign from it. South Indian places each planet directly in its resulting navamsa sign\'s fixed cell. North Indian first derives a "Navamsa Ascendant" (the natal Ascendant\'s own navamsa sign), then places each planet\'s house by counting whole signs forward from that Navamsa Ascendant — the standard way a divisional chart is read as its own self-contained whole-sign chart. Both need the planet\'s exact longitude (from Ephemeris/Auto-Generate) — without it a planet is omitted from D9 rather than guessed.'],
  ['3b. D9 degree shown: the planet\'s position WITHIN its 3°20\' navamsa part is rescaled proportionally to a full 0-30° span, becoming its degree within the resulting D9 sign — this is the standard way a divisional chart\'s own internal degree is derived, not the natal D1 degree.'],
  ['5. Each planet in every chart shows its exact degree-minute-second position within its cell\'s sign (D1/KP: the natal degree; D9: the rescaled D9-internal degree above), not just the sign name.'],
  ['4. KP Chart: uses the REAL Placidus house cusps already computed elsewhere in this app (not a simplified whole-sign offset) — each house\'s actual cusp sign and cuspal star/sub/sub-sub lord are shown, in whichever fixed layout (house positions for North Indian, sign positions for South Indian) is selected. This is the house-based view KP practice actually uses for significator work.'],
  [''],
  ['Caveat: at extreme latitudes a Placidus house can occupy the same sign as another house, or a sign can host no house cusp at all — the South Indian KP chart may then show multiple house numbers in one sign cell, or none. The North Indian diamond coordinate layout follows the standard clockwise-from-top convention but has not been visually cross-checked against a second reference chart image in this offline environment — spot-check house 1 lands on the Ascendant sign before relying on it. This display introduces no new planetary-position calculation beyond the Navamsa formula above.']
];

// Fixed South Indian grid: 4x4, reading each row left-to-right, top-to-bottom.
// null = the 4 unused center cells.
const SOUTH_INDIAN_GRID = [
  'Pisces', 'Aries', 'Taurus', 'Gemini',
  'Aquarius', null, null, 'Cancer',
  'Capricorn', null, null, 'Leo',
  'Sagittarius', 'Scorpio', 'Libra', 'Virgo'
];

const MOVABLE_SIGNS = ['Aries', 'Cancer', 'Libra', 'Capricorn'];
const FIXED_SIGNS = ['Taurus', 'Leo', 'Scorpio', 'Aquarius'];
// Dual signs (Gemini/Virgo/Sagittarius/Pisces) are the implicit remaining case.

// Classical Navamsa (D9) sign for a given sidereal longitude.
function navamsaSign(longitude) {
  return navamsaPosition(longitude).sign;
}

// Full Navamsa (D9) position: which sign the navamsa falls in, AND a
// synthetic 0-360° "D9 longitude" usable with formatDegMinSec() to show the
// planet's exact degree WITHIN that D9 sign — found by rescaling its
// position within the 3°20' navamsa part up to a full 0-30° span (the part
// it occupies exactly proportionally becomes the whole D9 sign).
function navamsaPosition(longitude) {
  const lon = normalizeDegrees(longitude);
  const signIndex = Math.floor(lon / 30);
  const sign = SIGNS[signIndex];
  const degInSign = lon % 30;
  const partSize = 30 / 9;
  const navamsaPart = Math.floor(degInSign / partSize);
  const remainderInPart = degInSign - navamsaPart * partSize;
  const scaledDegree = remainderInPart * 9; // 0-30, this navamsa's own internal degree

  let startIndex;
  if (MOVABLE_SIGNS.includes(sign)) startIndex = signIndex;
  else if (FIXED_SIGNS.includes(sign)) startIndex = (signIndex + 8) % 12;
  else startIndex = (signIndex + 4) % 12; // dual sign

  const resultSignIndex = (startIndex + navamsaPart) % 12;
  return { sign: SIGNS[resultSignIndex], longitude: resultSignIndex * 30 + scaledDegree };
}

// { sign: [{name, longitude}, ...] } for D1.
function buildD1ChartData(planets) {
  const bySign = {};
  SIGNS.forEach(s => { bySign[s] = []; });
  planets.forEach(p => {
    if (p.sign && bySign[p.sign]) bySign[p.sign].push({ name: p.name, longitude: parseFloat(p.longitude) });
  });
  return bySign;
}

// { sign: [{name, longitude: <synthetic D9 longitude>}, ...] } for D9.
// Planets without a numeric longitude are skipped (returned separately)
// since Navamsa needs exact degree.
function buildD9ChartData(planets) {
  const bySign = {};
  SIGNS.forEach(s => { bySign[s] = []; });
  const skipped = [];
  planets.forEach(p => {
    const lon = parseFloat(p.longitude);
    if (isNaN(lon)) { skipped.push(p.name); return; }
    const nav = navamsaPosition(lon);
    bySign[nav.sign].push({ name: p.name, longitude: nav.longitude });
  });
  return { bySign, skipped };
}

// { sign: { planets:[{name,longitude}...], houses:[{house, starLord, subLord, subSubLord}] } } for the KP chart.
function buildKpChartData(planets, cusps) {
  const bySign = {};
  SIGNS.forEach(s => { bySign[s] = { planets: [], houses: [] }; });
  planets.forEach(p => {
    if (p.sign && bySign[p.sign]) bySign[p.sign].planets.push({ name: p.name, longitude: parseFloat(p.longitude) });
  });
  cusps.forEach(c => {
    if (c.sign && bySign[c.sign]) {
      bySign[c.sign].houses.push({
        house: c.house, starLord: c.starLord, subLord: c.subLord, subSubLord: c.subSubLord
      });
    }
  });
  return bySign;
}

// --- North Indian (diamond) layout: 12 fixed house-shaped polygons in a
// 300x300 square, house 1 = top diamond, proceeding clockwise. Each entry
// gives the polygon's SVG points and a label anchor point for text.
const NORTH_INDIAN_HOUSES = [
  { house: 1, points: '150,0 225,75 150,150 75,75', label: [150, 45] },
  { house: 2, points: '150,0 300,0 225,75', label: [200, 25] },
  { house: 3, points: '300,0 300,150 225,75', label: [270, 60] },
  { house: 4, points: '300,150 225,225 150,150 225,75', label: [250, 150] },
  { house: 5, points: '300,150 300,300 225,225', label: [270, 240] },
  { house: 6, points: '300,300 150,300 225,225', label: [200, 275] },
  { house: 7, points: '150,300 75,225 150,150 225,225', label: [150, 255] },
  { house: 8, points: '150,300 0,300 75,225', label: [100, 275] },
  { house: 9, points: '0,300 0,150 75,225', label: [30, 240] },
  { house: 10, points: '0,150 75,75 150,150 75,225', label: [50, 150] },
  { house: 11, points: '0,150 0,0 75,75', label: [30, 60] },
  { house: 12, points: '0,0 150,0 75,75', label: [100, 25] }
];

// Whole-sign house-1-from-ascendant offset: house N's sign = ascendantSignIndex + (N-1), wrapped.
function wholeSignHouseOf(signIndex, ascendantSignIndex) {
  return ((signIndex - ascendantSignIndex + 12) % 12) + 1;
}

// North Indian D1: planets placed by their actual house (already computed via
// Placidus elsewhere), sign label per house via simple whole-sign counting
// from the Ascendant sign (standard North Indian convention).
function buildD1NorthIndian(planets, cusps) {
  const ascCusp = cusps.find(c => Number(c.house) === 1);
  const ascSignIndex = ascCusp ? SIGNS.indexOf(ascCusp.sign) : 0;
  const byHouse = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = { signIndex: (ascSignIndex + h - 1) % 12, planets: [] };
  planets.forEach(p => {
    const h = Number(p.house);
    if (byHouse[h]) byHouse[h].planets.push({ name: p.name, longitude: parseFloat(p.longitude) });
  });
  return byHouse;
}

// North Indian D9: derive the Navamsa Ascendant (D9 sign of the natal
// Ascendant's own longitude), then place each planet's navamsa sign as a
// house counted forward from that Navamsa Ascendant (a divisional chart is
// read as its own whole-sign chart from its own re-derived lagna).
function buildD9NorthIndian(planets, cusps) {
  const ascCusp = cusps.find(c => Number(c.house) === 1);
  const ascLon = ascCusp ? parseFloat(ascCusp.longitude) : NaN;
  const navAscSignIndex = isNaN(ascLon) ? 0 : SIGNS.indexOf(navamsaSign(ascLon));

  const byHouse = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = { signIndex: (navAscSignIndex + h - 1) % 12, planets: [] };
  const skipped = [];
  planets.forEach(p => {
    const lon = parseFloat(p.longitude);
    if (isNaN(lon)) { skipped.push(p.name); return; }
    const nav = navamsaPosition(lon);
    const signIndex = SIGNS.indexOf(nav.sign);
    const house = wholeSignHouseOf(signIndex, navAscSignIndex);
    byHouse[house].planets.push({ name: p.name, longitude: nav.longitude });
  });
  return { byHouse, skipped, navAscSignIndex };
}

// North Indian KP chart: uses the REAL Placidus cusps (not a whole-sign
// offset) — each house's actual sign + cuspal lords, and planets by house.
function buildKpNorthIndian(planets, cusps) {
  const byHouse = {};
  for (let h = 1; h <= 12; h++) {
    const cusp = cusps.find(c => Number(c.house) === h);
    byHouse[h] = {
      sign: cusp ? cusp.sign : null, starLord: cusp ? cusp.starLord : null,
      subLord: cusp ? cusp.subLord : null, subSubLord: cusp ? cusp.subSubLord : null,
      planets: []
    };
  }
  planets.forEach(p => {
    const h = Number(p.house);
    if (byHouse[h]) byHouse[h].planets.push({ name: p.name, longitude: parseFloat(p.longitude) });
  });
  return byHouse;
}

if (typeof module !== 'undefined') {
  module.exports = {
    VEDIC_CHARTS_LOGIC_TEXT, SOUTH_INDIAN_GRID, NORTH_INDIAN_HOUSES,
    navamsaSign, navamsaPosition, wholeSignHouseOf,
    buildD1ChartData, buildD9ChartData, buildKpChartData,
    buildD1NorthIndian, buildD9NorthIndian, buildKpNorthIndian
  };
}
