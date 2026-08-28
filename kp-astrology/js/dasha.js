// Vimshottari Mahadasha / Antardasha / Pratyantardasha calculation from Moon's
// birth longitude + birth datetime. Standard KP/Vedic timing method.

function addYearsFraction(date, years) {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + years * msPerYear);
}

function sequenceStartingFrom(lord) {
  const idx = VIMSHOTTARI_SEQUENCE.indexOf(lord);
  const seq = [];
  for (let i = 0; i < 9; i++) seq.push(VIMSHOTTARI_SEQUENCE[(idx + i) % 9]);
  return seq;
}

// Returns { balance: {lord, years, months, days}, mahadashas: [...] }
// mahadashas[i] = { lord, start, end, years, antardashas: [ { lord, start, end, pratyantardashas: [...] } ] }
function computeVimshottariDasha(moonLongitude, birthDateTime, opts) {
  opts = opts || {};
  const levels = opts.levels || 3; // 1=maha, 2=+antar, 3=+pratyantar

  const nak = nakshatraFromLongitude(moonLongitude);
  if (!nak) throw new Error('Invalid Moon longitude: ' + moonLongitude);

  const birthLord = nak.starLord;
  const birthLordYears = VIMSHOTTARI_YEARS[birthLord];
  const elapsedYears = birthLordYears * nak.elapsedFraction;
  const balanceYears = birthLordYears - elapsedYears;

  const balance = yearsToYMD(balanceYears);

  const order = sequenceStartingFrom(birthLord);
  const mahadashas = [];
  let cursor = birthDateTime;

  order.forEach((lord, i) => {
    const durationYears = i === 0 ? balanceYears : VIMSHOTTARI_YEARS[lord];
    const start = cursor;
    const end = addYearsFraction(start, durationYears);
    const maha = { lord, start, end, years: durationYears };
    if (levels >= 2) {
      maha.antardashas = buildSubPeriods(lord, start, end, levels >= 3);
    }
    mahadashas.push(maha);
    cursor = end;
  });

  return { birthNakshatra: nak, balance, mahadashas };
}

// Builds Antardasha periods within one Mahadasha, proportional to each planet's
// Vimshottari years out of the 120-year cycle. Optionally recurses one more
// level for Pratyantardasha.
function buildSubPeriods(mahaLord, start, end, includePratyantar) {
  const totalMs = end.getTime() - start.getTime();
  const order = sequenceStartingFrom(mahaLord);
  const periods = [];
  let cursor = start;
  order.forEach((subLord, i) => {
    const fraction = VIMSHOTTARI_YEARS[subLord] / VIMSHOTTARI_TOTAL_YEARS;
    const isLast = i === order.length - 1;
    const periodStart = cursor;
    const periodEnd = isLast ? end : new Date(cursor.getTime() + totalMs * fraction);
    const period = { lord: subLord, start: periodStart, end: periodEnd };
    if (includePratyantar) {
      period.pratyantardashas = buildSubPeriods(subLord, periodStart, periodEnd, false);
    }
    periods.push(period);
    cursor = periodEnd;
  });
  return periods;
}

function yearsToYMD(years) {
  const totalDays = years * 365.25;
  const y = Math.floor(totalDays / 365.25);
  const remAfterY = totalDays - y * 365.25;
  const m = Math.floor(remAfterY / 30.4375);
  const d = Math.round(remAfterY - m * 30.4375);
  return { years: y, months: m, days: d };
}

// Finds which mahadasha/antardasha/pratyantardasha is active on a given date.
function findActivePeriod(dashaResult, onDate) {
  const t = onDate.getTime();
  for (const maha of dashaResult.mahadashas) {
    if (t >= maha.start.getTime() && t < maha.end.getTime()) {
      const result = { mahadasha: maha.lord };
      if (maha.antardashas) {
        for (const antar of maha.antardashas) {
          if (t >= antar.start.getTime() && t < antar.end.getTime()) {
            result.antardasha = antar.lord;
            if (antar.pratyantardashas) {
              for (const praty of antar.pratyantardashas) {
                if (t >= praty.start.getTime() && t < praty.end.getTime()) {
                  result.pratyantardasha = praty.lord;
                }
              }
            }
          }
        }
      }
      return result;
    }
  }
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = { computeVimshottariDasha, findActivePeriod };
}
