// "Auto Predicted Event Promise" — a per-house/per-Moon breakdown table of
// the same Event Promise check already used elsewhere in this app (Event
// Timing, Horary Prediction), styled after a reference KP software's Event
// Analysis screen (row per required cusp + a Moon row, each showing its
// Sub Lord chain, significators, and whether it confirms the query).
// Introduces NO new astronomical calculation — reuses significators.js and
// the sign/nakshatra/star-lord/sub-lord/sub-sub-lord fields already derived
// by kpSubLords.js for every planet/cusp.

const EVENT_PROMISE_TABLE_LOGIC_TEXT = [
  ['Auto Predicted Event Promise — Logic and Sequence'],
  [''],
  ['1. ROWS: one row per relevant house cusp — the event\'s "topic cusp" (see topicCuspHouse in eventRules.js) plus each of its requiredHouses, de-duplicated — PLUS one row for the Moon (whose own placement, not a cusp, is checked the same way Ruling Planets/Horary genuineness already check it).'],
  ['2. Each cusp row shows: its Sign, Nakshatra, and degree (DMS); its Sub Lord, that Sub Lord\'s own placement (which house it occupies), the cusp\'s Star Lord, and its Sub-Sub Lord — the same fields already computed for every cusp, just laid out per-row instead of in one big table.'],
  ['3. SIGNIFICATORS: the full significator list for that house (occupant + owner + star lord of occupant + star lord of owner — significators.js, unchanged).'],
  ['4. CONFIRMS (Y/N): Y when that row\'s Sub Lord (or, for the Moon row, the Moon itself) signifies at least one of the event\'s required houses — the same rule already used by Event Timing\'s scorePromise and Horary\'s checkPromise/checkQueryGenuineness, just shown per-row here instead of only as a final verdict.'],
  [''],
  ['Caveat: this table\'s layout is modeled on a reference KP software\'s Event Analysis screen, reproducing the SAME underlying significator-connection logic already used throughout this app in a different, more detailed presentation — it is not a new prediction method, and the exact deeper "Sub Lord of Sub Lord" notation some KP software use has not been independently reproduced here (this table shows one level of Sub Lord placement, not a multi-level nested chain) — treat it as a detailed working, not a claim of matching any other software\'s exact notation.']
];

function houseOfPlanet(planets, planetName) {
  const p = planets.find(pl => pl.name === planetName);
  return p ? p.house : null;
}

function buildPromiseRow(label, longitude, sign, nakshatra, pada, starLord, subLord, subSubLord, planets, significators, requiredHouses) {
  const rowSignificators = [];
  let confirmHouses = [];
  if (label === 'Moon') {
    // The Moon's own signification (which houses it signifies), same idea as its "Analysis" chain.
    Object.keys(significators).forEach(h => {
      if (significators[h].allSignificators.includes('Moon')) rowSignificators.push(Number(h));
    });
    confirmHouses = requiredHouses.filter(h => significators[h] && significators[h].allSignificators.includes('Moon'));
  } else {
    const houseData = significators[label];
    if (houseData) rowSignificators.push(...houseData.allSignificators.map(String));
    confirmHouses = subLord ? requiredHouses.filter(h => significators[h] && significators[h].allSignificators.includes(subLord)) : [];
  }

  return {
    label, longitude, sign, nakshatra, pada, starLord, subLord, subSubLord,
    subLordHouse: subLord ? houseOfPlanet(planets, subLord) : null,
    significators: rowSignificators,
    confirmHouses, confirms: confirmHouses.length > 0
  };
}

// planets/cusps: the chart to analyze (natal state.planets/state.cusps, OR
// a Horary chart's .planets/.cusps — same shape either way).
function buildEventPromiseTable(planets, cusps, eventDef) {
  const significators = buildSignificators(planets, cusps);
  const houseNumbers = [...new Set([eventDef.topicCuspHouse, ...eventDef.requiredHouses])];

  const rows = houseNumbers.map(h => {
    const cusp = cusps.find(c => Number(c.house) === h);
    if (!cusp) return null;
    return buildPromiseRow(h, cusp.longitude, cusp.sign, cusp.nakshatra, cusp.pada, cusp.starLord, cusp.subLord, cusp.subSubLord, planets, significators, eventDef.requiredHouses);
  }).filter(Boolean);

  const moonPlanet = planets.find(p => p.name === 'Moon');
  if (moonPlanet) {
    rows.push(buildPromiseRow('Moon', moonPlanet.longitude, moonPlanet.sign, moonPlanet.nakshatra, moonPlanet.pada, moonPlanet.starLord, moonPlanet.subLord, moonPlanet.subSubLord, planets, significators, eventDef.requiredHouses));
  }

  return { eventDef, rows, significators };
}

if (typeof module !== 'undefined') {
  module.exports = { EVENT_PROMISE_TABLE_LOGIC_TEXT, buildEventPromiseTable };
}
