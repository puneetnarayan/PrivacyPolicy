// KP Ruling Planets (RP): used chiefly for horary/prashna and event timing.
// Traditionally: Day Lord, Ascendant sign lord + star lord + sub lord,
// Moon sign lord + star lord + sub lord (Rahu/Ketu included if conjunct/aspecting - left to user judgement).
//
// Expects:
//   moment: JS Date (the moment ruling planets are cast for)
//   ascendant: { sign, starLord, subLord }
//   moon: { sign, starLord, subLord }

// Single source of truth for how ruling planets are derived — kept as data so
// the UI/exports can show the exact rule instead of duplicating this text.
const RULING_PLANET_LOGIC_TEXT = [
  ['KP Ruling Planets — Logic and Sequence'],
  [''],
  ['Ruling Planets (RP) are cast for a specific moment — typically the moment a horary/prashna question is asked, or "now" for general timing.'],
  ['1. Day Lord: the ruler of the weekday the moment falls on.'],
  ['2. Ascendant Lords: the sign lord, star lord, and sub lord of the House-1 cusp at that moment.'],
  ['3. Moon Lords: the sign lord, star lord, and sub lord of the Moon\'s position at that moment.'],
  ['4. All Ruling Planets: the de-duplicated union of the above — the set of planets considered "active" for that moment, used to judge event timing or to select among candidate significators.'],
  [''],
  ['Caveat: Rahu/Ketu are only included here when they appear as a sign/star/sub lord already (e.g. as a nakshatra star lord) — the traditional practice of also adding Rahu/Ketu when conjunct or aspecting the Ascendant/Moon is left to the user\'s own judgement, since conjunction/aspect data isn\'t part of this app\'s inputs.']
];

function buildRulingPlanets(moment, ascendant, moon) {
  const dayLord = WEEKDAY_LORD[moment.getDay()];

  const ascendantLords = {
    signLord: SIGN_LORD[ascendant.sign],
    starLord: ascendant.starLord,
    subLord: ascendant.subLord
  };
  const moonLords = {
    signLord: SIGN_LORD[moon.sign],
    starLord: moon.starLord,
    subLord: moon.subLord
  };

  const all = dedupe([
    dayLord,
    ascendantLords.signLord, ascendantLords.starLord, ascendantLords.subLord,
    moonLords.signLord, moonLords.starLord, moonLords.subLord
  ]);

  return { dayLord, ascendantLords, moonLords, allRulingPlanets: all };
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

if (typeof module !== 'undefined') {
  module.exports = { buildRulingPlanets, RULING_PLANET_LOGIC_TEXT };
}
