// Combustion, conjunction, and (whole-sign) aspect checks — all require exact
// planetary longitude, which only becomes available once the Ephemeris step
// (ephemeris.js) has filled in the Planets sheet's longitude column.

const PLANETARY_RELATIONS_LOGIC_TEXT = [
  ['Planetary Relations (Combustion / Conjunction / Aspect) — Logic and Sequence'],
  [''],
  ['1. Combustion: a planet within its traditional orb of the Sun\'s longitude is "combust" — weakened as a significator. Orbs used (degrees from Sun): Moon 12, Mercury 14 (12 if retrograde), Venus 10 (8 if retrograde), Mars 17, Jupiter 11, Saturn 15.'],
  ['2. Conjunction: any two planets within 10° of each other\'s longitude are flagged as conjunct — their significations blend, and a malefic conjunct a house significator can add obstruction.'],
  ['3. Aspect (Vedic whole-sign graha drishti): every planet aspects the sign 7th from its own position. Mars additionally aspects the 4th and 8th; Jupiter the 5th and 9th; Saturn the 3rd and 10th (all counted inclusively from the planet\'s own sign). An aspecting planet is treated as influencing any house whose cusp falls in the aspected sign.'],
  [''],
  ['Caveat: this is whole-sign (rasi) aspect, the simplest and most common Vedic convention — it does not weigh exact-degree (graha drishti with orb/strength tapering) aspect variants some traditions use.']
];

const COMBUSTION_ORBS = { Moon: 12, Mercury: 14, Venus: 10, Mars: 17, Jupiter: 11, Saturn: 15 };
const COMBUSTION_ORBS_RETROGRADE = { Mercury: 12, Venus: 8 };
const CONJUNCTION_ORB = 10;
const ASPECT_OFFSETS = {
  default: [6],
  Mars: [3, 6, 7],
  Jupiter: [4, 6, 8],
  Saturn: [2, 6, 9]
};

function angularSeparation(a, b) {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(diff, 360 - diff);
}

function signIndex(longitude) {
  return Math.floor(normalizeDegrees(longitude) / 30);
}

// planets: [{ name, longitude, retrograde }], all with numeric longitude (0-360).
function findCombustPlanets(planets) {
  const sun = planets.find(p => p.name === 'Sun');
  if (!sun) return [];
  return planets
    .filter(p => p.name !== 'Sun' && COMBUSTION_ORBS[p.name] !== undefined && typeof p.longitude === 'number')
    .map(p => {
      const orb = (p.retrograde && COMBUSTION_ORBS_RETROGRADE[p.name]) || COMBUSTION_ORBS[p.name];
      const separation = angularSeparation(p.longitude, sun.longitude);
      return { planet: p.name, separationFromSun: Math.round(separation * 100) / 100, orb, combust: separation <= orb };
    })
    .filter(r => r.combust);
}

function findConjunctions(planets) {
  const withLon = planets.filter(p => typeof p.longitude === 'number');
  const pairs = [];
  for (let i = 0; i < withLon.length; i++) {
    for (let j = i + 1; j < withLon.length; j++) {
      const sep = angularSeparation(withLon[i].longitude, withLon[j].longitude);
      if (sep <= CONJUNCTION_ORB) {
        pairs.push({ planetA: withLon[i].name, planetB: withLon[j].name, separation: Math.round(sep * 100) / 100 });
      }
    }
  }
  return pairs;
}

// cusps: [{ house, sign }] — used to translate an aspected sign into a house number.
function findAspects(planets, cusps) {
  const results = [];
  planets.filter(p => typeof p.longitude === 'number').forEach(p => {
    const fromSign = signIndex(p.longitude);
    const offsets = ASPECT_OFFSETS[p.name] || ASPECT_OFFSETS.default;
    const aspectedSignIndices = [...new Set(offsets.map(o => (fromSign + o) % 12))];
    const aspectedSigns = aspectedSignIndices.map(i => SIGNS[i]);
    const aspectedHouses = cusps
      .filter(c => aspectedSigns.includes(c.sign))
      .map(c => Number(c.house))
      .sort((a, b) => a - b);
    results.push({ planet: p.name, aspectedSigns, aspectedHouses });
  });
  return results;
}

function analyzePlanetaryRelations(planets, cusps) {
  return {
    combust: findCombustPlanets(planets),
    conjunctions: findConjunctions(planets),
    aspects: findAspects(planets, cusps)
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    PLANETARY_RELATIONS_LOGIC_TEXT, analyzePlanetaryRelations,
    findCombustPlanets, findConjunctions, findAspects
  };
}
