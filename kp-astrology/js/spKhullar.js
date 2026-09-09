// S.P. Khullar-style per-planet card, matching the reference screenshot's
// layout (Lords of / Positional / Star Lord / Sub Lord / S.S Lord). Reuses
// kpSubLords.js's sign/starLord/subLord/subSubLord fields and
// significators.js's reverse lookup (planetSignificatorHouses) unchanged —
// no new astronomical calculation.

const SP_KHULLAR_LOGIC_TEXT = [
  ['S.P. Khullar — Logic and Sequence'],
  [''],
  ['"Lords of" shows the Sign Lord, Star Lord, Sub Lord, and Sub-Sub Lord of the planet\'s OWN position, each with that lord\'s own occupied house — plus the planet\'s own occupied house ("Posited").'],
  ['"Positional" shows the planet\'s own significator houses (occupant/owner/star-lord chain, from significators.js, unchanged).'],
  ['"Star Lord" / "Sub Lord" / "S.S Lord" each show that LORD planet and its OWN significator houses (not the original planet\'s) — tracing the chain outward one link at a time.'],
  ['"(+)" marks a planet whose own significator houses include BOTH a supporting house (Favorable: 1,3,5,7,9,11) and an obstructing house (Unfavorable: 4,8,12).'],
  [''],
  ['Caveat: S.P. Khullar\'s published work centers on Cuspal Interlinks (see the separate "Cuspal Interlinks" tab for that cusp-level chain). This per-planet card reproduces a reference KP software\'s Khullar screen STRUCTURE; the significator logic underneath is this app\'s standard KP significator rule applied planet-first, not an independently re-derived Khullar formula — cross-check specific rows against your own Khullar reference.']
];

function khullarLordSummary(lordName, planets, significators) {
  if (!lordName) return { lord: null, occupiedHouse: null, houses: [] };
  const lordPlanet = findPlanetRecord(planets, lordName);
  return {
    lord: lordName,
    occupiedHouse: lordPlanet ? Number(lordPlanet.house) : null,
    houses: planetSignificatorHouses(significators, lordName)
  };
}

function analyzeKhullarPlanet(planet, chartData) {
  const { planets, significators } = chartData;
  const signLord = SIGN_LORD[planet.sign];
  const ownHouses = planetSignificatorHouses(significators, planet.name);

  return {
    planet: planet.name,
    notation: planetNotation(planets, planet),
    mixedMarker: hasSupportAndObstructMix(ownHouses),
    positedHouse: Number(planet.house),
    lordsOf: {
      sgn: khullarLordSummary(signLord, planets, significators),
      stl: khullarLordSummary(planet.starLord, planets, significators),
      sub: khullarLordSummary(planet.subLord, planets, significators),
      ssl: khullarLordSummary(planet.subSubLord, planets, significators)
    },
    positional: ownHouses,
    starLord: khullarLordSummary(planet.starLord, planets, significators),
    subLord: khullarLordSummary(planet.subLord, planets, significators),
    subSubLord: khullarLordSummary(planet.subSubLord, planets, significators)
  };
}

function analyzeKhullar(chartData) {
  return chartData.planets.map(p => analyzeKhullarPlanet(p, chartData));
}

if (typeof module !== 'undefined') {
  module.exports = { SP_KHULLAR_LOGIC_TEXT, khullarLordSummary, analyzeKhullarPlanet, analyzeKhullar };
}
