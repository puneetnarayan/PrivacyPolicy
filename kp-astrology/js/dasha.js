// Vimshottari Mahadasha / Antardasha / Pratyantardasha calculation from Moon's
// birth longitude + birth datetime. Standard KP/Vedic timing method.

// Single source of truth for how the dasha timeline is derived — kept as data
// so the UI/exports can show the exact rule instead of duplicating this text.
const DASHA_LOGIC_TEXT = [
  ['Vimshottari Dasha — Logic and Sequence'],
  [''],
  ['1. Find the Moon\'s nakshatra (27 equal 13°20\' divisions of the zodiac) from its birth longitude, and that nakshatra\'s ruling star lord — this is the first Mahadasha lord.'],
  ['2. Find how far the Moon has traveled through that nakshatra (elapsed fraction) to compute the balance of the first Mahadasha already elapsed at birth vs. remaining.'],
  ['3. The 9 Mahadasha lords run in a fixed cycle (Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury) with fixed total years each (adding to 120), starting from the birth lord\'s remaining balance and then continuing full-length through the rest of the cycle.'],
  ['4. Each Mahadasha is subdivided into 9 Antardashas, each Antardasha into 9 Pratyantardashas — always the same 9-lord cycle, started from that period\'s own lord, with each sub-period\'s length proportional to its lord\'s share of the 120-year cycle.'],
  [''],
  ['This produces a full nested timeline (Mahadasha > Antardasha > Pratyantardasha) with exact start/end dates, used throughout KP to time when a house\'s significators (and hence its promised events) are expected to fructify.']
];

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
  module.exports = { computeVimshottariDasha, findActivePeriod, DASHA_LOGIC_TEXT, sequenceStartingFrom };
}
