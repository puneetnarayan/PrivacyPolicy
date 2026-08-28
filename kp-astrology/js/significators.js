// KP significators: 4-level standard hierarchy per house (1-12).
// Level A: Occupants        - planets placed IN the house (by house number on the planet record)
// Level B: Owners           - planet(s) that are the sign-lord of the house's cusp sign,
//                             PLUS (KP practice) any planet that is the house cusp's sub-lord
//                             occupies logic is separate; owner here = cuspal sign lord.
// Level C: Star lord of occupants (level A planets' nakshatra star lord)
// Level D: Star lord of owner  (level B planets' nakshatra star lord)
//
// Expects:
//   planets: [{ name, sign, house, starLord, subLord, subSubLord, retrograde }]
//   cusps:   [{ house, sign, starLord, subLord, subSubLord }]  (house 1-12)

function buildSignificators(planets, cusps) {
  const byHouse = {};
  for (let h = 1; h <= 12; h++) {
    const cusp = cusps.find(c => Number(c.house) === h);
    const occupants = planets.filter(p => Number(p.house) === h).map(p => p.name);

    const ownerSign = cusp ? cusp.sign : null;
    const ownerLord = ownerSign ? SIGN_LORD[ownerSign] : null;
    const owners = ownerLord ? [ownerLord] : [];

    const starLordsOfOccupants = uniquePlanetsByStarLord(planets, occupants);
    const starLordsOfOwners = uniquePlanetsByStarLord(planets, owners);

    byHouse[h] = {
      house: h,
      cuspSign: ownerSign,
      occupants,
      owners,
      starLordOfOccupants: starLordsOfOccupants,
      starLordOfOwners: starLordsOfOwners,
      // Combined, ordered, de-duplicated significator list (strongest to weakest per KP convention).
      allSignificators: dedupe([...occupants, ...owners, ...starLordsOfOccupants, ...starLordsOfOwners])
    };
  }
  return byHouse;
}

// For a list of planet names, find each named planet's record, collect the
// planet whose name equals that record's starLord (i.e. the star lord planet itself).
function uniquePlanetsByStarLord(planets, planetNames) {
  const lords = planetNames
    .map(name => planets.find(p => p.name === name))
    .filter(Boolean)
    .map(p => p.starLord)
    .filter(Boolean);
  return dedupe(lords);
}

function dedupe(arr) {
  return [...new Set(arr)];
}

// Reverse index: for a given planet, which houses does it signify (as occupant/owner/star lord)?
function planetSignificatorHouses(significatorsByHouse, planetName) {
  const houses = [];
  for (const h of Object.keys(significatorsByHouse)) {
    const s = significatorsByHouse[h];
    if (s.allSignificators.includes(planetName)) houses.push(Number(h));
  }
  return houses.sort((a, b) => a - b);
}

if (typeof module !== 'undefined') {
  module.exports = { buildSignificators, planetSignificatorHouses };
}
