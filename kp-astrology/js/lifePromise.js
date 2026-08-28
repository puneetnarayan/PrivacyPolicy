// KP "promise" analysis for common life questions (marriage, education, wealth,
// career, property, etc.) — built on top of the significators module.
//
// KP METHOD (standard teaching, summarized):
//   1. Every life event maps to a fixed set of houses. Some houses SUPPORT the
//      event ("favorable houses"); others typically DENY/OBSTRUCT it
//      ("obstacle houses") when they dominate.
//   2. For each house, list its significators (occupants, owner, star lord of
//      occupants, star lord of owner — see significators.js).
//   3. A planet that shows up as a significator of MULTIPLE favorable houses
//      is a "connecting planet" — it links those houses together and is a
//      candidate to "give"/promise the event during its dasha/bhukti.
//   4. A connecting planet that ALSO significates an obstacle house is
//      weakened/mixed — it may delay, complicate, or partially deny the very
//      thing it promises.
//   5. Verdict:
//        - Strongly Promised: a planet connects ALL favorable houses with NO
//          obstacle-house significance.
//        - Promised with some obstruction: a planet connects ALL favorable
//          houses but also touches an obstacle house.
//        - Partially/Weakly Promised: at least one planet connects 2+ (but
//          not all) favorable houses.
//        - Not clearly promised: no planet connects 2+ favorable houses from
//          the data given.
//   6. The current/running Mahadasha lord is checked separately — if it (or
//      its Antardasha lord) is one of the connecting planets, the event is
//      more likely to fructify NOW rather than merely being promised in the
//      chart.
//
// This is a simplified, deterministic heuristic capturing the core KP
// "significator connection" rule. It does NOT replace a full reading — it
// does not weigh planetary strength, aspects, cuspal sub-lord of the house
// itself (only occupants/owners), or retrogression nuances. Treat the
// verdict as a first-pass screening, to be confirmed against dasha timing
// and a qualified astrologer's judgement.

// Single source of truth for the "Logic" sheet in the Excel export (and any
// other place the method needs to be shown to a user) — kept as rows here so
// ui.js never hardcodes this text; it just requests it.
const LIFE_TOPIC_LOGIC_TEXT = [
  ['KP Life-Topic Promise Analysis — Logic and Sequence'],
  [''],
  ['1. Each life topic maps to a fixed set of houses: "favorable" houses that support the event, and "obstacle" houses that typically delay/deny it.'],
  ['2. For each favorable house, list its significators: occupants, owner (cusp sign lord), star lord of occupants, star lord of owner.'],
  ['3. A planet appearing as a significator of 2+ favorable houses is a "connecting planet" — a candidate to give the event, especially during its dasha/bhukti.'],
  ['4. A connecting planet that ALSO significates an obstacle house is weakened/mixed — may delay or complicate the event.'],
  ['5. Verdict:'],
  ['   - Strongly Promised: a planet connects ALL favorable houses with no obstacle-house significance.'],
  ['   - Promised with some obstruction: a planet connects ALL favorable houses but also touches an obstacle house.'],
  ['   - Partially / Weakly Promised: a planet connects 2+ (not all) favorable houses.'],
  ['   - Not clearly promised: no planet connects 2+ favorable houses in the data given.'],
  ['6. Timing: the running Mahadasha/Antardasha/Pratyantardasha lord is checked against the connecting planets — if it is one of them, the event is more likely to fructify in this period rather than remain a chart-only promise.'],
  [''],
  ['Caveat: this is a simplified, deterministic heuristic capturing the core KP "significator connection" rule.'],
  ['It does not weigh planetary strength, aspects, the house cusp\'s own sub-lord, or retrogression nuances.'],
  ['Treat the verdict as a first-pass screening to be confirmed against dasha timing and a qualified astrologer\'s judgement.']
];

const LIFE_TOPICS = {
  marriage: {
    label: 'Marriage',
    favorable: [2, 7, 11],
    obstacles: [1, 6, 10],
    note: '2nd = family/togetherness, 7th = spouse/partnership, 11th = fulfillment of desire. 1,6,10 typically show delay/denial (bachelorhood houses).'
  },
  education: {
    label: 'Education',
    favorable: [4, 5, 9, 11],
    obstacles: [3, 8, 12],
    note: '4th = basic schooling, 5th = intellect/exams, 9th = higher education, 11th = successful completion/gains. 3,8,12 show interruption or discontinuation.'
  },
  wealth: {
    label: 'Wealth / Finance',
    favorable: [2, 6, 11],
    obstacles: [5, 8, 12],
    note: '2nd = accumulated wealth, 6th = income from service/debts recovered, 11th = gains. 5,8,12 show speculative loss, sudden loss, or expenditure.'
  },
  job: {
    label: 'Job / Career',
    favorable: [2, 6, 10, 11],
    obstacles: [5, 8, 12],
    note: '2nd = income, 6th = service/employment, 10th = profession/status, 11th = gains/fulfillment. 5,8,12 show job loss, obstacles, or forced change.'
  },
  house_property: {
    label: 'House / Property / Vehicle',
    favorable: [4, 11, 12],
    obstacles: [8, 9],
    note: '4th = property/vehicle/comforts, 11th = gains/fulfillment of desire, 12th = investment/expenditure (needed to acquire). 8,9 show obstruction or loss of property.'
  }
};

// significatorsByHouse: output of buildSignificators() from significators.js
// runningLords: optional { mahadasha, antardasha, pratyantardasha } from findActivePeriod()
function analyzeLifeTopic(topicKey, significatorsByHouse, runningLords) {
  const topic = LIFE_TOPICS[topicKey];
  if (!topic) throw new Error('Unknown life topic: ' + topicKey);

  const houseSig = topic.favorable.map(h => ({
    house: h,
    cuspSign: significatorsByHouse[h] ? significatorsByHouse[h].cuspSign : null,
    significators: significatorsByHouse[h] ? significatorsByHouse[h].allSignificators : []
  }));

  const connecting = PLANET_NAMES
    .map(planet => {
      const housesConnected = topic.favorable.filter(h =>
        significatorsByHouse[h] && significatorsByHouse[h].allSignificators.includes(planet));
      const obstacleHouses = topic.obstacles.filter(h =>
        significatorsByHouse[h] && significatorsByHouse[h].allSignificators.includes(planet));
      return { planet, housesConnected, obstacleHouses };
    })
    .filter(c => c.housesConnected.length >= 2)
    .sort((a, b) => b.housesConnected.length - a.housesConnected.length);

  const strongConnectors = connecting.filter(c => c.housesConnected.length === topic.favorable.length);
  const partialConnectors = connecting.filter(c => c.housesConnected.length < topic.favorable.length);

  let verdict;
  if (strongConnectors.some(c => c.obstacleHouses.length === 0)) {
    verdict = 'Strongly Promised';
  } else if (strongConnectors.length) {
    verdict = 'Promised with some obstruction';
  } else if (partialConnectors.length) {
    verdict = 'Partially / Weakly Promised';
  } else {
    verdict = 'Not clearly promised from this data';
  }

  let timingNote = 'No dasha/date supplied — timing not evaluated.';
  if (runningLords) {
    const connectingPlanets = connecting.map(c => c.planet);
    const activeLords = [runningLords.mahadasha, runningLords.antardasha, runningLords.pratyantardasha].filter(Boolean);
    const hits = activeLords.filter(l => connectingPlanets.includes(l));
    timingNote = hits.length
      ? `Running period lord(s) ${hits.join(', ')} ARE among the connecting planets — supports fructification now.`
      : `Running period lord(s) ${activeLords.join(' > ') || '(none)'} are NOT among the connecting planets — event less likely to fructify in this exact period.`;
  }

  return { topicKey, topic, houseSig, connecting, strongConnectors, partialConnectors, verdict, timingNote };
}

function analyzeAllLifeTopics(significatorsByHouse, runningLords) {
  const result = {};
  Object.keys(LIFE_TOPICS).forEach(key => {
    result[key] = analyzeLifeTopic(key, significatorsByHouse, runningLords);
  });
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = { LIFE_TOPICS, LIFE_TOPIC_LOGIC_TEXT, analyzeLifeTopic, analyzeAllLifeTopics };
}
