// KP Horary reading rules — the 4-step method shown in the reference
// screenshot (query genuineness via Moon + Lagna, promise via the topic
// cusp's sub lord, cuspal strength ranking) — applied to the horary chart
// produced by horaryChart.js. Reuses significators.js (unchanged) and the
// per-event requiredHouses/topicCuspHouse already defined in eventRules.js
// — covers ALL 32 existing event definitions, not just Business Gain, since
// the underlying method is the same for every topic.

const HORARY_ENGINE_LOGIC_TEXT = [
  ['KP Horary Prediction — Logic and Sequence'],
  [''],
  ['1. QUERY GENUINENESS: the Moon must signify at least one of the event\'s required houses, AND the Lagna (1st cusp) sub lord must signify at least one of the event\'s required houses. If either fails, the query itself is flagged as not clearly genuine — a reading is still shown, but with this caveat surfaced.'],
  ['2. EVENT PROMISE: the SUB LORD of the event\'s "topic cusp" (one cusp per event, e.g. the 7th for a business/partnership query, the 11th for a pure-gain query — see topicCuspHouse in eventRules.js) is checked against the event\'s required houses. If it signifies one or more of them, the event is promised; the specific connected houses are shown.'],
  ['3. CUSPAL STRENGTH: each of the event\'s required houses is ranked by how many significators it has (occupant + owner + star lord of occupant + star lord of owner, from significators.js) — more significators is read as a stronger indication that house\'s matters will favor the querent.'],
  ['4. CONFLICTS: the same checks are run against the event\'s opposingHouses; any overlap (the topic cusp sub lord or the Lagna sub lord ALSO signifying an opposing house) is listed separately as a conflicting factor, never silently dropped.'],
  [''],
  ['This is the same 4-step method shown in standard KP Horary practice (query genuineness -> promise via topic-cusp sub lord -> cuspal strength -> conflicts), applied here to whichever of the 32 configured event topics you choose — the topicCuspHouse per topic is this app\'s proposed KP default (see eventRules.js), not the only valid convention; correct it if your own practice differs for a given topic.']
];

function planetSignifiesHouses(significators, planetName, houses) {
  if (!planetName) return [];
  return houses.filter(h => significators[h] && significators[h].allSignificators.includes(planetName));
}

function checkQueryGenuineness(horaryChart, eventDef, significators) {
  const moonHouses = planetSignifiesHouses(significators, 'Moon', eventDef.requiredHouses);
  const lagna = horaryChart.cusps.find(c => Number(c.house) === 1);
  const lagnaSubLord = lagna ? lagna.subLord : null;
  const lagnaHouses = planetSignifiesHouses(significators, lagnaSubLord, eventDef.requiredHouses);

  return {
    moonGenuine: moonHouses.length > 0, moonHouses,
    lagnaSubLord, lagnaGenuine: lagnaHouses.length > 0, lagnaHouses,
    overallGenuine: moonHouses.length > 0 && lagnaHouses.length > 0
  };
}

function checkPromise(horaryChart, eventDef, significators) {
  const topicCusp = horaryChart.cusps.find(c => Number(c.house) === eventDef.topicCuspHouse);
  const topicSubLord = topicCusp ? topicCusp.subLord : null;
  const housesConnected = planetSignifiesHouses(significators, topicSubLord, eventDef.requiredHouses);
  const opposingConnected = planetSignifiesHouses(significators, topicSubLord, eventDef.opposingHouses);

  return {
    topicCuspHouse: eventDef.topicCuspHouse, topicSubLord,
    housesConnected, promised: housesConnected.length > 0,
    opposingConnected
  };
}

function rankCuspStrength(significators, houses) {
  return houses
    .map(h => ({
      house: h,
      significatorCount: significators[h] ? significators[h].allSignificators.length : 0,
      significators: significators[h] ? significators[h].allSignificators : []
    }))
    .sort((a, b) => b.significatorCount - a.significatorCount);
}

// Top-level: casts the horary chart and runs all 4 steps for one event key.
function analyzeHorary(horaryNumber, eventKey, judgmentUtc, latitude, longitude) {
  const eventDef = EVENT_RULES[eventKey];
  const horaryChart = castHoraryChart(horaryNumber, judgmentUtc, latitude, longitude);
  const significators = buildSignificators(horaryChart.planets, horaryChart.cusps);

  const genuineness = checkQueryGenuineness(horaryChart, eventDef, significators);
  const promise = checkPromise(horaryChart, eventDef, significators);
  const cuspStrength = rankCuspStrength(significators, eventDef.requiredHouses);

  const lagnaOpposing = planetSignifiesHouses(significators, genuineness.lagnaSubLord, eventDef.opposingHouses);

  return {
    horaryChart, eventDef, eventKey, significators,
    genuineness, promise, cuspStrength,
    conflicts: { topicSubLordOpposing: promise.opposingConnected, lagnaSubLordOpposing: lagnaOpposing }
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    HORARY_ENGINE_LOGIC_TEXT, checkQueryGenuineness, checkPromise, rankCuspStrength, analyzeHorary
  };
}
