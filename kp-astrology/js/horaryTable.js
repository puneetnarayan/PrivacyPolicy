// KP Horary Number Table — maps a horary number (as given by a querent,
// e.g. "169" out of 1-249) to a zodiac sub-division, whose midpoint becomes
// the Horary Ascendant used to cast a horary chart (horaryChart.js).

const HORARY_TABLE_LOGIC_TEXT = [
  ['KP Horary Number Table — Logic and Sequence'],
  [''],
  ['1. Numbers 1-243 are the SAME standard KP sub-lord divisions used everywhere else in this app (kpSubLords.js / significators.js): each of the 27 nakshatras (13°20\') is split into 9 unequal parts, proportional to Vimshottari dasha years, starting from that nakshatra\'s own star lord — the identical, already-verified method used for natal planets/cusps. These 243 divisions are simply flattened into one zodiacal sequence, numbered 1-243 starting from 0° Aries.'],
  ['2. A horary number\'s Ascendant longitude is taken as the MIDPOINT of its sub-division\'s span — one documented, practical convention for picking a specific point within the range; some software instead use the start of the range.'],
  [''],
  ['CAVEAT — read before trusting any number above ~200, or if a number 1-243 disagrees with your existing KP Horary software: classical KP Horary literature describes a 249-number system, 6 more than the 243 produced by the standard sub-lord table above. The precise classical rule for those extra 6 (and possibly for exactly which point within a span counts as "the" Ascendant) has NOT been reliably reproduced here from memory alone — rather than guess and risk silently shifting every number\'s mapping, this table deliberately stops at 243 (the well-established, directly verifiable portion) and leaves numbers 244-249 unmapped for now. Cross-check a few known numbers (like the 169 example) against your own KP Horary software; if anything disagrees, tell me the reference number and its expected sign/star-lord/sub-lord and this table will be corrected.']
];

// Builds the 243-entry table by flattening the standard per-nakshatra
// sub-lord subdivision (reuses subdivideByVimshottari from kpSubLords.js,
// and NAKSHATRA_TABLE from kpTables.js — no new subdivision logic).
function buildHoraryNumberTable() {
  const table = [];
  let number = 1;
  NAKSHATRA_TABLE.forEach(nak => {
    const subSegments = subdivideByVimshottari(nak.startDeg, nak.endDeg, nak.starLord);
    subSegments.forEach(seg => {
      const midpoint = (seg.startDeg + seg.endDeg) / 2;
      table.push({
        number,
        sign: SIGNS[Math.floor(normalizeDegrees(midpoint) / 30) % 12],
        nakshatra: nak.name,
        starLord: nak.starLord,
        subLord: seg.lord,
        startDeg: seg.startDeg,
        endDeg: seg.endDeg,
        midpointDeg: midpoint
      });
      number++;
    });
  });
  return table;
}

const HORARY_NUMBER_TABLE = buildHoraryNumberTable(); // 243 entries, numbers 1-243
const HORARY_NUMBER_MIN = 1;
const HORARY_NUMBER_MAX = 243;

function horaryNumberInfo(number) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < HORARY_NUMBER_MIN || n > HORARY_NUMBER_MAX) return null;
  return HORARY_NUMBER_TABLE[n - 1];
}

// The Horary Ascendant longitude for a given number — the midpoint of its
// sub-division span (see caveat above).
function horaryAscendantLongitude(number) {
  const entry = horaryNumberInfo(number);
  return entry ? entry.midpointDeg : null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    HORARY_TABLE_LOGIC_TEXT, HORARY_NUMBER_TABLE, HORARY_NUMBER_MIN, HORARY_NUMBER_MAX,
    horaryNumberInfo, horaryAscendantLongitude, buildHoraryNumberTable
  };
}
