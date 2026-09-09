// Comparative Analysis: for each event selected in the Event Analysis tab,
// compares KP Default, Four-Step Theory, S.P. Khullar, K. Bhaskaran, and
// Naadi Significators side by side. NOT a vote-counting rule — each
// methodology independently finds its OWN best-connecting planet from its
// OWN significator data; the Overall row reports the tally as a
// descriptive fact about this comparison, never as an astrological rule.

const COMPARATIVE_ANALYSIS_LOGIC_TEXT = [
  ['Comparative Analysis — Logic and Sequence'],
  [''],
  ['For each event selected in the Event Analysis tab: each methodology (KP Default, Four-Step Theory, S.P. Khullar, K. Bhaskaran, Naadi Significators) independently finds its OWN best-connecting planet against the event\'s required houses, using its OWN significator data (see each tab\'s own logic notes) — never a shared or mixed rule.'],
  ['Because this app\'s S.P. Khullar / K. Bhaskaran / Naadi tabs reuse the SAME underlying significator computation as KP Default (no independently-derived Khullar/Bhaskaran/Naadi formula was available — see each tab\'s own caveat), their comparison results will often match KP Default\'s exactly. Four-Step differs because it applies its own documented primary-only strength filter. This is an honest reflection of what is actually implemented in each tab, not an attempt to manufacture artificial disagreement between methods.'],
  ['The Overall row reports how many of the 5 methods support the event as a DESCRIPTIVE TALLY only — e.g. "4 of 5 support" is reported as a fact about this comparison, never treated as a voting procedure that decides the astrological answer.'],
  [''],
  ['Caveat: this tab draws no new astronomical or KP conclusion of its own — it only juxtaposes the methodology tabs\' own already-computed results for the events you have selected.']
];

function housesMapFor(houseListFn) {
  const map = {};
  PLANET_NAMES.forEach(name => { map[name] = houseListFn(name) || []; });
  return map;
}

function compareEventAcrossMethods(eventKey, chartData) {
  const eventDef = ALL_EVENT_RULES[eventKey];
  const { significators } = chartData;

  const kpDefaultMap = housesMapFor(name => planetSignificatorHouses(significators, name));

  const fourStepAnalyses = analyzeFourStep(chartData);
  const fourStepMap = housesMapFor(name => {
    const a = fourStepAnalyses.find(x => x.planet === name);
    return a ? a.primaryHouses : [];
  });

  const khullarAnalyses = analyzeKhullar(chartData);
  const khullarMap = housesMapFor(name => {
    const a = khullarAnalyses.find(x => x.planet === name);
    return a ? a.positional : [];
  });

  const bhaskaranTable2 = analyzeBhaskaran(chartData).table2;
  const bhaskaranMap = housesMapFor(name => {
    const a = bhaskaranTable2.find(x => x.planet === name);
    return a ? a.significatorHouses : [];
  });

  const naadiAnalyses = analyzeNaadi(chartData);
  const naadiMap = housesMapFor(name => {
    const a = naadiAnalyses.find(x => x.planet === name);
    return a ? a.self.houses : [];
  });

  const methodMaps = [
    ['KP Default', kpDefaultMap],
    ['Four-Step', fourStepMap],
    ['S.P. Khullar', khullarMap],
    ['K. Bhaskaran', bhaskaranMap],
    ['Naadi', naadiMap]
  ];

  const rows = methodMaps.map(([method, map]) => {
    const conn = bestConnectingPlanet(map, eventDef.requiredHouses);
    return {
      method, ...conn,
      result: judgementLanguage(conn.fraction),
      reason: conn.bestPlanet
        ? `${conn.bestPlanet} connects ${conn.housesConnected.length} of ${eventDef.requiredHouses.length} required houses (${conn.housesConnected.join(',') || '—'}).`
        : "No planet connects any required house in this method's own data."
    };
  });

  const supportedCount = rows.filter(r => r.fraction >= 0.5).length;
  const overall = {
    method: 'Overall',
    result: judgementLanguage(supportedCount / rows.length),
    housesConnected: eventDef.requiredHouses,
    reason: `${supportedCount} of ${rows.length} methods support the event (descriptive tally, not a voting rule).`
  };

  return { eventKey, eventDef, rows, overall };
}

if (typeof module !== 'undefined') {
  module.exports = { COMPARATIVE_ANALYSIS_LOGIC_TEXT, housesMapFor, compareEventAcrossMethods };
}
