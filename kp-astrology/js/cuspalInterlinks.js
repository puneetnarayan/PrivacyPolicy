// Cuspal Interlinks (Bhaskaran Paddhatee) Analysis — for a chosen set of
// house cusps, walks the Sub Lord -> (that planet's own) Star Lord -> (that
// planet's own) Sub Lord chain, shows each link's significated houses, and
// classifies favorability using the standard KP house-nature rule (1,3,5,
// 7,9,11 favorable; 4,8,12 unfavorable; 2,6,10 neutral). Modeled on a
// reference KP software's Cuspal Links screen (a screenshot the user
// supplied). Introduces NO new astronomical calculation — reuses
// significators.js and the star-lord/sub-lord fields already derived by
// kpSubLords.js for every planet/cusp.

const CUSPAL_INTERLINKS_LOGIC_TEXT = [
  ['Cuspal Interlinks (Bhaskaran Paddhatee) — Logic and Sequence'],
  [''],
  ['1. HOUSE FAVORABILITY RULE (fixed, standard KP doctrine): houses 1, 3, 5, 7, 9, 11 are Favorable; 4, 8, 12 are Unfavorable; 2, 6, 10 are Neutral.'],
  ['2. LINK CHAIN, per chosen cusp: Link 1 = the cusp\'s own Sub Lord (a planet). Link 2 = that planet\'s OWN Star Lord (the nakshatra lord of wherever that planet itself sits) — i.e. its .starLord field, already computed. Link 3 = that same planet\'s OWN Sub Lord — its .subLord field. Each link is shown with the houses it signifies (significators.js, reverse-looked-up).'],
  ['3. LINK (combined): the de-duplicated union of houses signified across all three links.'],
  ['4. POTENTIAL Stl (Star Lord) / POTENTIAL Sbl (Sub Lord): each of Link 2\'s and Link 3\'s own significated houses are classified via the favorability rule above (Favorable/Unfavorable/Neutral if all houses in that link agree, "Mixed" if the link signifies both a favorable and an unfavorable house).'],
  ['5. COMBINED VERDICT Stl-Sbl (Positive/Negative/Mixed): this app\'s OWN combination rule — Positive when both Potential Stl and Potential Sbl are Favorable, Negative when both are Unfavorable, Mixed otherwise (including whenever either side is itself Mixed, or the two disagree).'],
  ['6. MOON REFLECTS THE QUERY: when an event/query is selected, checks whether the Moon itself signifies any of that event\'s required houses — the same check already used for Horary query genuineness.'],
  ['7. FINAL / COMMON / FRUITFUL SIGNIFICATORS (when an event is selected): Final = the union of every analyzed cusp\'s three chain-planets that themselves signify at least one of the event\'s required houses. Common = chain-planets appearing in EVERY analyzed cusp\'s own chain. Fruitful = planets from the Final set whose own significated houses classify as fully Favorable per the rule above.'],
  [''],
  ['Caveat: steps 1-3 and 6-7 reproduce standard, well-established KP mechanics already used elsewhere in this app. Steps 4-5 (the Potential Stl/Sbl and combined Stl-Sbl verdict columns) reproduce the KIND of favorability judgment shown in the reference software\'s screenshot, but NOT its exact proprietary scoring formula, which could not be reliably reverse-engineered from a screenshot alone — this app\'s own documented combination rule is used instead and may disagree with that software\'s exact wording ("Sbl by 2 is Neutral", "From 2 to 10 is Fav") on specific rows. Cross-check a few rows against your existing KP software before relying on the Potential/Verdict columns specifically.']
];

const FAVORABLE_HOUSES = [1, 3, 5, 7, 9, 11];
const UNFAVORABLE_HOUSES = [4, 8, 12];
const NEUTRAL_HOUSES = [2, 6, 10];

function classifyHouse(house) {
  if (FAVORABLE_HOUSES.includes(house)) return 'Favorable';
  if (UNFAVORABLE_HOUSES.includes(house)) return 'Unfavorable';
  return 'Neutral';
}

// Classifies a SET of houses together: Favorable/Unfavorable/Neutral if all
// agree, "Mixed" if the set contains both a favorable and an unfavorable house.
function classifyHouseSet(houses) {
  if (!houses.length) return 'Neutral';
  const classes = new Set(houses.map(classifyHouse));
  if (classes.has('Favorable') && classes.has('Unfavorable')) return 'Mixed';
  if (classes.has('Favorable')) return 'Favorable';
  if (classes.has('Unfavorable')) return 'Unfavorable';
  return 'Neutral';
}

function combinedVerdict(potentialStd, potentialSbl) {
  if (potentialStd === 'Favorable' && potentialSbl === 'Favorable') return 'Positive';
  if (potentialStd === 'Unfavorable' && potentialSbl === 'Unfavorable') return 'Negative';
  return 'Mixed';
}

function planetHouses(significators, planetName) {
  if (!planetName) return [];
  const houses = [];
  Object.keys(significators).forEach(h => {
    if (significators[h].allSignificators.includes(planetName)) houses.push(Number(h));
  });
  return houses.sort((a, b) => a - b);
}

function buildLink(planetName, planets, significators) {
  const houses = planetHouses(significators, planetName);
  return { planet: planetName, houses, potential: classifyHouseSet(houses) };
}

// planets/cusps: the chart to analyze. cuspHouses: array of house numbers
// (1-12) the user selected. eventKey: optional EVENT_RULES key, for the
// Moon-reflects-query check and Final/Common/Fruitful significators.
function buildCuspalInterlinks(planets, cusps, cuspHouses, eventKey) {
  const significators = buildSignificators(planets, cusps);
  const eventDef = eventKey ? EVENT_RULES[eventKey] : null;

  const rows = cuspHouses.map(h => {
    const cusp = cusps.find(c => Number(c.house) === h);
    if (!cusp) return null;
    const subLordPlanet = planets.find(p => p.name === cusp.subLord);

    const link1 = buildLink(cusp.subLord, planets, significators);
    const link2 = subLordPlanet ? buildLink(subLordPlanet.starLord, planets, significators) : { planet: null, houses: [], potential: 'Neutral' };
    const link3 = subLordPlanet ? buildLink(subLordPlanet.subLord, planets, significators) : { planet: null, houses: [], potential: 'Neutral' };

    const combinedHouses = [...new Set([...link1.houses, ...link2.houses, ...link3.houses])].sort((a, b) => a - b);
    const verdict = combinedVerdict(link2.potential, link3.potential);
    const chainPlanets = [...new Set([link1.planet, link2.planet, link3.planet].filter(Boolean))];

    const confirmsEvent = eventDef ? chainPlanets.some(p => eventDef.requiredHouses.some(h2 =>
      significators[h2] && significators[h2].allSignificators.includes(p))) : null;

    return {
      house: h, longitude: cusp.longitude, sign: cusp.sign, nakshatra: cusp.nakshatra, pada: cusp.pada,
      link1, link2, link3, combinedHouses, verdict, chainPlanets, confirmsEvent
    };
  }).filter(Boolean);

  let moonReflectsQuery = null;
  if (eventDef) {
    const moonHouses = planetHouses(significators, 'Moon');
    const matched = eventDef.requiredHouses.filter(h => moonHouses.includes(h));
    moonReflectsQuery = { reflects: matched.length > 0, matchedHouses: matched };
  }

  let finalSignificators = [], commonSignificators = [], fruitfulSignificators = [];
  if (eventDef && rows.length) {
    const perRowChains = rows.map(r => r.chainPlanets);
    const allChainPlanets = [...new Set(perRowChains.flat())];

    finalSignificators = allChainPlanets.filter(p => eventDef.requiredHouses.some(h =>
      significators[h] && significators[h].allSignificators.includes(p)));

    commonSignificators = allChainPlanets.filter(p => perRowChains.every(chain => chain.includes(p)));

    fruitfulSignificators = finalSignificators.filter(p => classifyHouseSet(planetHouses(significators, p)) === 'Favorable');
  }

  return { rows, significators, eventDef, moonReflectsQuery, finalSignificators, commonSignificators, fruitfulSignificators };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CUSPAL_INTERLINKS_LOGIC_TEXT, classifyHouse, classifyHouseSet, combinedVerdict, buildCuspalInterlinks
  };
}
