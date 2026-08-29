// KP Birth Time Rectification: narrows down an uncertain/approximate birth
// time using known real-life events, per the standard KP method of matching
// running dasha lords against house significators.

const RECTIFICATION_LOGIC_TEXT = [
  ['Birth Time Rectification — Logic and Sequence'],
  [''],
  ['1. The Ascendant moves roughly 1° every 4 minutes, so its nakshatra star lord, sub lord, and sub-sub lord — and with them, the whole chart\'s house significators — can shift within just a few minutes. A birth time that is off by even 5-10 minutes can therefore point to a meaningfully different chart. Rectification works backward from real, already-known life events to find which candidate time actually fits.'],
  ['2. Each event type maps to fixed KP houses (the same house groupings used in the Life Topic Promise Analysis) — e.g. Marriage: 2, 7, 11; Career: 2, 6, 10, 11; Childbirth: 5, 11.'],
  ['3. For a candidate birth time, generate the full chart (planets, cusps, significators, Vimshottari dasha) exactly as the rest of this app does.'],
  ['4. For each known event, find which Mahadasha, Antardasha, and Pratyantardasha lords were running on the event\'s ACTUAL date (using that candidate\'s dasha timeline). Check how many of those 3 running lords are significators (occupant, owner, star lord of occupant, or star lord of owner — the standard 4-level hierarchy) of that event\'s houses.'],
  ['5. Score = total matches across all 3 period levels, summed across every known event you provide. A candidate time that "explains" more of your real events (higher score, closer to the maximum of 3 × number of events) is a better fit.'],
  ['6. Step through a range of candidate birth times (a search window in minutes, at a chosen resolution) and rank every candidate by score — the highest-scoring time(s) are the best-supported rectified birth time.'],
  [''],
  ['Caveat: this is a real, standard KP technique, but it is inherently probabilistic — with few events, or events whose houses overlap heavily, multiple candidate times can score identically. More independent, precisely-dated events (and a wider variety of event types) narrow the result down more reliably. Always sanity-check the winning candidate against your own judgement of the birth circumstances.']
];

// Same house groupings as lifePromise.js's LIFE_TOPICS, plus a few more event
// types useful specifically for rectification (health, travel, bereavement).
const RECTIFICATION_EVENT_TYPES = {
  marriage: { label: 'Marriage', houses: [2, 7, 11] },
  childbirth: { label: 'Childbirth', houses: [5, 11] },
  career: { label: 'Job / Career Change', houses: [2, 6, 10, 11] },
  property: { label: 'Property / Vehicle Purchase', houses: [4, 11, 12] },
  education: { label: 'Education Completion', houses: [4, 5, 9, 11] },
  health: { label: 'Major Health Event / Surgery', houses: [6, 8] },
  travel: { label: 'Foreign Travel / Relocation', houses: [3, 9, 12] },
  bereavement: { label: 'Death in Immediate Family', houses: [8] }
};

// Scores one candidate birth time against a list of { type, date } events.
// Returns { score, maxPossible, perEvent: [{ type, date, runningLords, houses, houseSignificators, matches }] }
function scoreCandidateBirthTime(birthUtc, latitude, longitude, events) {
  const chart = generateChart(birthUtc, latitude, longitude);
  const significators = buildSignificators(chart.planets, chart.cusps);
  const dasha = computeVimshottariDasha(chart.moonLongitude, birthUtc, { levels: 3 });

  let score = 0;
  const perEvent = events.map(event => {
    const eventDef = RECTIFICATION_EVENT_TYPES[event.type];
    const runningLords = findActivePeriod(dasha, event.date) || {};
    const houseSignificators = [...new Set(
      eventDef.houses.flatMap(h => (significators[h] ? significators[h].allSignificators : []))
    )];
    const candidateLords = [runningLords.mahadasha, runningLords.antardasha, runningLords.pratyantardasha].filter(Boolean);
    const matches = candidateLords.filter(l => houseSignificators.includes(l));
    score += matches.length;
    return {
      type: event.type, label: eventDef.label, date: event.date,
      houses: eventDef.houses, runningLords, houseSignificators, matches
    };
  });

  return { score, maxPossible: events.length * 3, perEvent };
}

// Steps through [centerUtc - windowMinutes, centerUtc + windowMinutes] at
// stepMinutes resolution, scoring each candidate. Returns results sorted
// best-score-first. Caps at 500 candidates as a sanity limit.
function rectifyBirthTime(centerUtc, windowMinutes, stepMinutes, latitude, longitude, events) {
  const results = [];
  const steps = Math.min(500, Math.floor((2 * windowMinutes) / stepMinutes) + 1);
  const startMs = centerUtc.getTime() - windowMinutes * 60000;
  for (let i = 0; i < steps; i++) {
    const candidateUtc = new Date(startMs + i * stepMinutes * 60000);
    const result = scoreCandidateBirthTime(candidateUtc, latitude, longitude, events);
    results.push({ candidateUtc, ...result });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

if (typeof module !== 'undefined') {
  module.exports = {
    RECTIFICATION_LOGIC_TEXT, RECTIFICATION_EVENT_TYPES,
    scoreCandidateBirthTime, rectifyBirthTime
  };
}
