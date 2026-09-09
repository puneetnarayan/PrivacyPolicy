// K. Bhaskaran-style tables, matching the reference screenshot: Table 1
// (Planetary Four-Level Table: PLA/STL/SUB/SSL, each cell showing that
// lord's own house placement + its own significator houses) and Table 2
// (Planet / Significator / Cusps — which cusp(s) each planet is the Sub
// Lord of). Reuses significators.js/kpSubLords.js unchanged — no new
// astronomical calculation.

const K_BHASKARAN_LOGIC_TEXT = [
  ['K. Bhaskaran — Logic and Sequence'],
  [''],
  ['Table 1 (Planetary Four-Level Table): for each planet, its Star Lord / Sub Lord / Sub-Sub Lord, each cell showing "LORD-OccupiedHouse (that lord\'s own significator houses)".'],
  ['Table 2 (Planet / Significator / Cusps): for each planet, its own significator houses (significators.js) and which house cusp(s) it is the SUB LORD of.'],
  [''],
  ['Caveat: K. Bhaskaran\'s published work is also centered on Cuspal Interlinks (see the separate "Cuspal Interlinks" tab). This table layout reproduces a reference KP software\'s Bhaskaran screen STRUCTURE, using this app\'s standard KP significator rule underneath — not an independently re-derived Bhaskaran formula.']
];

function bhaskaranCell(lordName, planets, significators) {
  if (!lordName) return { lord: null, occupiedHouse: null, houses: [] };
  const lordPlanet = findPlanetRecord(planets, lordName);
  return {
    lord: lordName,
    occupiedHouse: lordPlanet ? Number(lordPlanet.house) : null,
    houses: planetSignificatorHouses(significators, lordName)
  };
}

function cuspsWhereSubLord(cusps, planetName) {
  return cusps.filter(c => c.subLord === planetName).map(c => Number(c.house)).sort((a, b) => a - b);
}

function analyzeBhaskaran(chartData) {
  const { planets, cusps, significators } = chartData;

  const table1 = planets.map(p => ({
    planet: p.name,
    notation: planetNotation(planets, p),
    occupiedHouse: Number(p.house),
    stl: bhaskaranCell(p.starLord, planets, significators),
    sub: bhaskaranCell(p.subLord, planets, significators),
    ssl: bhaskaranCell(p.subSubLord, planets, significators)
  }));

  const table2 = planets.map(p => ({
    planet: p.name,
    significatorHouses: planetSignificatorHouses(significators, p.name),
    subLordOfCusps: cuspsWhereSubLord(cusps, p.name)
  }));

  return { table1, table2 };
}

if (typeof module !== 'undefined') {
  module.exports = { K_BHASKARAN_LOGIC_TEXT, bhaskaranCell, cuspsWhereSubLord, analyzeBhaskaran };
}
