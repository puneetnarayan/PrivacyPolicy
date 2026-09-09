// Naadi Significators: per-planet card tracing Planet -> Star Lord -> Sub
// Lord -> Sub-Sub Lord, each shown with ITS OWN significator houses (not
// only the original planet's combined list) — the planetary linkage chain
// made visible rather than just a final list. Reuses significators.js's
// reverse lookup (planetSignificatorHouses) unchanged — no new
// astronomical calculation.
//
// Note: no Naadi-specific significator RULE distinct from the standard KP
// 4-level chain (Planet/Star/Sub/Sub-Sub) was found in published sources
// during research for this feature — this tab reproduces the reference
// screenshot's per-planet chain PRESENTATION using this app's standard
// significator logic; it is not a separately verified Naadi formula.

const NAADI_SIGNIFICATORS_LOGIC_TEXT = [
  ['Naadi Significators — Logic and Sequence'],
  [''],
  ['For each planet: Planet, Star Lord, Sub Lord, and Sub-Sub Lord are each shown with THEIR OWN significator houses (significators.js) — the chain of planetary linkage that leads to the final list, not only the combined result.'],
  [''],
  ['Caveat: no Naadi-specific significator rule distinct from the standard KP 4-level chain was found in published sources for this feature — this tab reproduces the reference screenshot\'s per-planet chain presentation using this app\'s standard significator logic, not an independently verified Naadi formula.']
];

function naadiLordSummary(lordName, significators) {
  if (!lordName) return { lord: null, houses: [] };
  return { lord: lordName, houses: planetSignificatorHouses(significators, lordName) };
}

function analyzeNaadiPlanet(planet, chartData) {
  const { planets, significators } = chartData;
  return {
    planet: planet.name,
    notation: planetNotation(planets, planet),
    self: { lord: planet.name, houses: planetSignificatorHouses(significators, planet.name) },
    starLord: naadiLordSummary(planet.starLord, significators),
    subLord: naadiLordSummary(planet.subLord, significators),
    subSubLord: naadiLordSummary(planet.subSubLord, significators)
  };
}

function analyzeNaadi(chartData) {
  return chartData.planets.map(p => analyzeNaadiPlanet(p, chartData));
}

if (typeof module !== 'undefined') {
  module.exports = { NAADI_SIGNIFICATORS_LOGIC_TEXT, naadiLordSummary, analyzeNaadiPlanet, analyzeNaadi };
}
