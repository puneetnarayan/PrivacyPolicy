// KP Ruling Planets (RP): used chiefly for horary/prashna and event timing.
// Traditionally: Day Lord, Ascendant sign lord + star lord + sub lord,
// Moon sign lord + star lord + sub lord (Rahu/Ketu included if conjunct/aspecting - left to user judgement).
//
// Expects:
//   moment: JS Date (the moment ruling planets are cast for)
//   ascendant: { sign, starLord, subLord }
//   moon: { sign, starLord, subLord }

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
  module.exports = { buildRulingPlanets };
}
