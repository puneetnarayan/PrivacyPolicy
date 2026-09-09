// Four-Step Theory: Planet -> Star Lord -> Sub Lord -> Star Lord OF the Sub
// Lord. Step 4 is explicitly NOT the same as the planet's ordinary
// Sub-Sub Lord (Sign->Star->Sub->Sub-Sub, from kpSubLords.js) — kept as a
// separate named field (subLordStarLord) rather than reusing/renaming
// subSubLord, per the required terminology distinction.
//
// Sourced from published Four-Step Theory descriptions (not invented):
// a lord's occupied-house connection is PRIMARY (strong) only when no
// other planet sits in that lord's own star; a lord's owned-house
// connection is PRIMARY only when no planet occupies that owned house.
// Reuses significators.js/kpSubLords.js output unchanged — no new
// astronomical calculation.

const FOUR_STEP_LOGIC_TEXT = [
  ['Four-Step Theory — Logic and Sequence'],
  [''],
  ['STEP 1 (Planet): the houses the planet itself occupies and owns (as cuspal sign lord).'],
  ['STEP 2 (Star Lord): the planet\'s own Star Lord, and the houses THAT lord occupies/owns.'],
  ['STEP 3 (Sub Lord): the planet\'s own Sub Lord, and the houses THAT lord occupies/owns.'],
  ['STEP 4 (Star Lord of the Sub Lord): the Sub Lord\'s OWN Star Lord (the nakshatra ruler of wherever the Sub Lord planet itself sits), and the houses THAT lord occupies/owns. This is explicitly NOT the original planet\'s ordinary Sub-Sub Lord — the two only coincide by chance, never by rule; kept as the separate field "subLordStarLord" here, vs. "planetSubSubLord" for the ordinary KP Sub-Sub Lord.'],
  ['STRENGTH: at each step, a lord\'s OCCUPIED house is a PRIMARY (strong) significator only if no other planet sits in that lord\'s own star; otherwise SECONDARY. A lord\'s OWNED house is PRIMARY only if no planet occupies that owned house; otherwise SECONDARY. Four-Step practice places particular weight on PRIMARY significators.'],
  [''],
  ['Caveat: this is the published Four-Step method (Planet/Star/Sub/Star-of-Sub with primary-vs-secondary strength) — not invented for this app. It is a separate analytical layer from the standard KP significator table; results are never mixed between the two.']
];

// One lord's own houses + primary/secondary split.
function fourStepLordHouses(lordName, planets, cusps) {
  if (!lordName) return null;
  const lordPlanet = findPlanetRecord(planets, lordName);
  const occupiedHouse = lordPlanet ? Number(lordPlanet.house) : null;
  const ownedHouses = housesOwnedBy(cusps, lordName);
  const occupiedIsPrimary = occupiedHouse !== null && noPlanetInOwnStar(planets, lordName);
  const primaryOwnedHouses = ownedHouses.filter(h => !planets.some(p => Number(p.house) === h));
  const secondaryOwnedHouses = ownedHouses.filter(h => planets.some(p => Number(p.house) === h));

  return {
    lord: lordName, occupiedHouse, occupiedIsPrimary, ownedHouses,
    primaryOwnedHouses, secondaryOwnedHouses,
    allHouses: [...new Set([occupiedHouse, ...ownedHouses].filter(h => h !== null))].sort((a, b) => a - b)
  };
}

function analyzeFourStepPlanet(planet, chartData) {
  const { planets, cusps } = chartData;

  const step1 = fourStepLordHouses(planet.name, planets, cusps);
  const step2 = fourStepLordHouses(planet.starLord, planets, cusps);
  const step3 = fourStepLordHouses(planet.subLord, planets, cusps);
  const subLordPlanet = findPlanetRecord(planets, planet.subLord);
  const subLordStarLord = subLordPlanet ? subLordPlanet.starLord : null;
  const step4 = fourStepLordHouses(subLordStarLord, planets, cusps);

  const steps = [step1, step2, step3, step4].filter(Boolean);
  const primaryHouses = [...new Set(steps.flatMap(s => [
    ...(s.occupiedIsPrimary ? [s.occupiedHouse] : []),
    ...s.primaryOwnedHouses
  ]))].sort((a, b) => a - b);
  const secondaryHouses = [...new Set(steps.flatMap(s => [
    ...(!s.occupiedIsPrimary && s.occupiedHouse !== null ? [s.occupiedHouse] : []),
    ...s.secondaryOwnedHouses
  ]))].filter(h => !primaryHouses.includes(h)).sort((a, b) => a - b);

  return {
    planet: planet.name,
    notation: planetNotation(planets, planet),
    step1, step2, step3, step4,
    planetSubLord: planet.subLord,
    planetSubSubLord: planet.subSubLord, // ordinary KP SSL — kept distinct from subLordStarLord
    subLordStarLord,                     // Four-Step's own Step 4 lord — never the same field as above
    primaryHouses, secondaryHouses,
    overallHouses: [...new Set([...primaryHouses, ...secondaryHouses])].sort((a, b) => a - b)
  };
}

function analyzeFourStep(chartData) {
  return chartData.planets.map(p => analyzeFourStepPlanet(p, chartData));
}

if (typeof module !== 'undefined') {
  module.exports = { FOUR_STEP_LOGIC_TEXT, fourStepLordHouses, analyzeFourStepPlanet, analyzeFourStep };
}
