// "KP Default" tab: an enhanced, auditable presentation of the SAME
// standard KP significator engine already used throughout this app
// (significators.js, kpSubLords.js) — no new astronomical calculation, no
// new significator RULE. This is the app's baseline interpretation, laid
// out as: a planet-wise significator table, a Rahu/Ketu node-representation
// table, a detailed per-planet analysis (Self/STL/SUB/STL-of-SUB + cusp
// connections + aspects when available), a planet signification table
// (source of each house, per significator level), a cusp signification
// table (all 12 cusps), and the existing house-wise significator table.

const KP_DEFAULT_LOGIC_TEXT = [
  ['KP Default — Logic and Sequence'],
  [''],
  ['This tab is a presentation layer over the app\'s existing, unchanged significator engine (significators.js: occupant / owner / star-lord-of-occupant / star-lord-of-owner) and KP sub-lord derivation (kpSubLords.js) — it introduces no new significator rule.'],
  ['A. Planet Significator Table: for each planet, its Sign, Star Lord, Sub Lord, Sub-Sub Lord, and the houses it signifies (reverse-indexed from significators.js).'],
  ['B. Node Representation: for Rahu/Ketu, shown as two separately labeled conventions — the sign lord of the occupied sign, and any planet conjunct the node.'],
  ['C. Detailed Planet Analysis: for each planet, the houses signified via itself (Self), via its Star Lord (STL), via its Sub Lord (SUB), and via the Star Lord OF that Sub Lord (STL of SUB) — plus which cusps its chain touches and its aspects (Vedic whole-sign, from planetaryRelations.js) when exact longitude is available.'],
  ['D. Planet Signification Table: each house a planet signifies, with the SOURCE of that signification (Occupant / Owner / Star Lord of Occupant / Star Lord of Owner) shown separately, per significators.js\'s own 4-level hierarchy — strongest listed first.'],
  ['E. Cusp Signification Table: all 12 cusps with Sign, Sign Lord, Star Lord, Sub Lord, Sub-Sub Lord, and that house\'s significations.'],
  ['F. House-wise Significators: the same per-house Occupants/Owners/Star-Lord breakdown already shown on the Chart & Analysis tab, reproduced here for completeness alongside the planet-wise views above.'],
  [''],
  ['Caveat: this tab reuses the SAME data the Chart & Analysis tab already computes and shows (significators, sub-lords) — it does not recompute or override it. If a field is genuinely unavailable from the current chart (e.g. aspects without exact longitude), it is shown as "Not available from current calculation engine" rather than a guessed value.']
];

const NOT_AVAILABLE = 'Not available from current calculation engine';

// --- A. Planet Significator Table ---
function buildPlanetSignificatorTable(chartData) {
  const { planets, significators } = chartData;
  return planets.map(p => ({
    planet: p.name,
    notation: planetNotation(planets, p),
    retrograde: !!p.retrograde,
    sign: p.sign || NOT_AVAILABLE,
    starLord: p.starLord || NOT_AVAILABLE,
    subLord: p.subLord || NOT_AVAILABLE,
    subSubLord: p.subSubLord || NOT_AVAILABLE,
    significatorHouses: planetSignificatorHouses(significators, p.name)
  }));
}

// --- B. Node Representation ---
function buildNodeRepresentationTable(chartData) {
  return chartData.planets
    .filter(p => p.name === 'Rahu' || p.name === 'Ketu')
    .map(node => ({ node: node.name, ...nodeRepresentation(node, chartData.planets) }));
}

// --- C. Detailed Planet Analysis ---
function detailedPlanetAnalysis(planet, chartData) {
  const { planets, cusps, significators } = chartData;

  const self = { lord: planet.name, houses: planetSignificatorHouses(significators, planet.name) };
  const stl = { lord: planet.starLord, houses: planetSignificatorHouses(significators, planet.starLord) };
  const sub = { lord: planet.subLord, houses: planetSignificatorHouses(significators, planet.subLord) };
  const subLordPlanet = findPlanetRecord(planets, planet.subLord);
  const stlOfSub = subLordPlanet
    ? { lord: subLordPlanet.starLord, houses: planetSignificatorHouses(significators, subLordPlanet.starLord) }
    : { lord: null, houses: [] };

  const chainPlanets = [self.lord, stl.lord, sub.lord, stlOfSub.lord].filter(Boolean);
  const cuspConnections = cusps
    .filter(c => chainPlanets.includes(c.subLord) || chainPlanets.includes(c.starLord))
    .map(c => Number(c.house))
    .sort((a, b) => a - b);

  // Aspects require exact longitude (planetaryRelations.js) — only
  // available once Ephemeris/Auto-Generate has filled it in; shown as
  // "not available" otherwise rather than guessed.
  let aspects = NOT_AVAILABLE;
  const planetsWithLon = planets.map(p => ({ ...p, longitude: parseFloat(p.longitude) })).filter(p => !isNaN(p.longitude));
  if (planetsWithLon.length === planets.length) {
    const found = findAspects(planetsWithLon, cusps).find(a => a.planet === planet.name);
    aspects = found ? found.aspectedHouses : [];
  }

  return { planet: planet.name, notation: planetNotation(planets, planet), self, stl, sub, stlOfSub, cuspConnections, aspects };
}

function buildDetailedPlanetAnalysis(chartData) {
  return chartData.planets.map(p => detailedPlanetAnalysis(p, chartData));
}

// --- D. Planet Signification Table (source of each house, per level) ---
function planetSignificationSources(planetName, chartData) {
  const { cusps, significators } = chartData;
  const sources = [];
  Object.keys(significators).forEach(h => {
    const s = significators[Number(h)];
    if (s.occupants.includes(planetName)) sources.push({ house: Number(h), level: 'Occupant' });
    if (s.owners.includes(planetName)) sources.push({ house: Number(h), level: 'Owner' });
    if (s.starLordOfOccupants.includes(planetName)) sources.push({ house: Number(h), level: 'Star Lord of Occupant' });
    if (s.starLordOfOwners.includes(planetName)) sources.push({ house: Number(h), level: 'Star Lord of Owner' });
  });
  const primary = sources.filter(s => s.level === 'Occupant' || s.level === 'Owner');
  const secondary = sources.filter(s => s.level === 'Star Lord of Occupant' || s.level === 'Star Lord of Owner');
  return { sources, primaryHouses: [...new Set(primary.map(s => s.house))].sort((a, b) => a - b), secondaryHouses: [...new Set(secondary.map(s => s.house))].sort((a, b) => a - b) };
}

function buildPlanetSignificationTable(chartData) {
  return chartData.planets.map(p => ({ planet: p.name, ...planetSignificationSources(p.name, chartData) }));
}

// --- E. Cusp Signification Table ---
function buildCuspSignificationTable(chartData) {
  const { cusps, significators } = chartData;
  return cusps.map(c => ({
    house: Number(c.house),
    sign: c.sign || NOT_AVAILABLE,
    signLord: SIGN_LORD[c.sign] || NOT_AVAILABLE,
    starLord: c.starLord || NOT_AVAILABLE,
    subLord: c.subLord || NOT_AVAILABLE,
    subSubLord: c.subSubLord || NOT_AVAILABLE,
    significations: significators[Number(c.house)] ? significators[Number(c.house)].allSignificators : []
  })).sort((a, b) => a.house - b.house);
}

if (typeof module !== 'undefined') {
  module.exports = {
    KP_DEFAULT_LOGIC_TEXT, NOT_AVAILABLE,
    buildPlanetSignificatorTable, buildNodeRepresentationTable,
    detailedPlanetAnalysis, buildDetailedPlanetAnalysis,
    planetSignificationSources, buildPlanetSignificationTable,
    buildCuspSignificationTable
  };
}
